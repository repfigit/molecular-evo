/**
 * Cooperation System
 *
 * Handles cooperative interactions between related agents:
 * - Kin detection and recognition
 * - Cooperative link formation
 * - Resource sharing
 * - Coordinated movement
 * - Group defense
 * - Cheater detection (tit-for-tat reciprocal altruism)
 */

import { CONFIG } from '../config.js';
import { state, logEvent } from '../state.js';
import { vec, distance, normalize, scale, add } from '../utils/math.js';
import { isSameSpecies, geneticDistance } from '../core/genome.js';
import { calculateRelatedness, shouldActAltruistically } from '../core/agent.js';

// Track cooperation history between agent pairs for cheater detection
// Key: "agentId1_agentId2" (sorted), Value: { given: {id: amount}, received: {id: amount} }
const cooperationHistory = new Map();

// Track punishment history - who has been punished recently
const punishmentHistory = new Map();  // agent.id -> { last_punished: tick, punishment_count: n }

// Cheater threshold - if received/given ratio exceeds this, considered a cheater
const CHEATER_THRESHOLD = 2.0;  // Taking 2x more than giving = cheater
const CHEATER_MEMORY_DECAY = 0.001;  // How fast cooperation history decays

// Punishment parameters
const PUNISHMENT_COST = 5;      // Energy cost to punish a cheater
const PUNISHMENT_DAMAGE = 15;   // Energy damage inflicted on cheater
const PUNISHMENT_COOLDOWN = 100; // Ticks before can be punished again

/**
 * Get cooperation history key for two agents (consistent ordering)
 */
function getHistoryKey(agent1Id, agent2Id) {
    return agent1Id < agent2Id ? `${agent1Id}_${agent2Id}` : `${agent2Id}_${agent1Id}`;
}

/**
 * Record resource transfer in cooperation history
 */
function recordTransfer(giverId, receiverId, amount) {
    const key = getHistoryKey(giverId, receiverId);
    let history = cooperationHistory.get(key);

    if (!history) {
        history = {
            given: { [giverId]: 0, [receiverId]: 0 },
            received: { [giverId]: 0, [receiverId]: 0 }
        };
        cooperationHistory.set(key, history);
    }

    history.given[giverId] = (history.given[giverId] || 0) + amount;
    history.received[receiverId] = (history.received[receiverId] || 0) + amount;
}

/**
 * Check if agent considers other to be a cheater (tit-for-tat)
 */
function isCheater(agent, other) {
    const key = getHistoryKey(agent.id, other.id);
    const history = cooperationHistory.get(key);

    if (!history) return false;  // No history = benefit of the doubt

    const givenToOther = history.given[agent.id] || 0;
    const receivedFromOther = history.received[agent.id] || 0;

    // If we've given significant energy
    if (givenToOther > 5) {
        // Check if they're taking much more than giving back
        const ratio = receivedFromOther / (givenToOther + 0.1);
        if (ratio < 1 / CHEATER_THRESHOLD) {
            // They received a lot from us but gave little back = cheater
            return true;
        }
    }

    return false;
}

/**
 * KIN COMPETITION (Limited Dispersal Paradox / Hamilton's Viscosity)
 *
 * When offspring stay near parents, helping kin means competing with them for resources.
 * This discounts the inclusive fitness benefit of cooperation.
 *
 * Returns a discount factor (0-1) where 1 = no kin competition, 0 = full competition negation
 */
function calculateKinCompetitionDiscount(agent, spatialHash) {
    // Get nearby relatives
    const nearby = spatialHash.query(
        agent.position.x,
        agent.position.y,
        CONFIG.COOPERATION_RANGE * 1.5
    ).filter(other => other !== agent && other.alive);

    if (nearby.length === 0) return 1.0;  // No nearby agents = no kin competition

    let kinDensity = 0;
    let totalRelatedness = 0;

    for (const other of nearby) {
        const relatedness = calculateRelatedness(agent, other);
        if (relatedness > 0.1) {
            kinDensity++;
            totalRelatedness += relatedness;
        }
    }

    if (kinDensity === 0) return 1.0;  // No nearby kin

    // Kin competition factor: more related neighbors = more competition for same resources
    // This implements the "limited dispersal paradox" - viscous populations
    // have high relatedness but also high kin competition
    const avgRelatedness = totalRelatedness / kinDensity;

    // Discount factor: High kin density and relatedness means cooperation benefits
    // are partly offset by competition with those same kin
    // At kinDensity = 5 and avgRelatedness = 0.5, discount = 0.5 (50% benefit reduction)
    const competitionIntensity = Math.min(1, kinDensity / 10) * avgRelatedness;
    const discount = 1 - competitionIntensity * 0.5;  // Max 50% reduction

    return Math.max(0.3, discount);  // Floor at 30% benefit retention
}

/**
 * PUNISHMENT SYSTEM (Second-Order Public Goods)
 *
 * Cooperators can pay a cost to punish detected cheaters.
 * This maintains cooperation by making cheating unprofitable.
 * Punishment itself is a public good (everyone benefits, but punisher pays).
 */
function attemptPunishment(punisher, cheater, dt) {
    // Check if punisher is willing to punish (evolvable trait)
    const punishmentWillingness = punisher.genome.social.punishment_willingness || 0.3;

    // Check if cheater can be punished (cooldown)
    const cheaterHistory = punishmentHistory.get(cheater.id);
    if (cheaterHistory && state.tick - cheaterHistory.last_punished < PUNISHMENT_COOLDOWN) {
        return false;  // Recently punished, on cooldown
    }

    // Punishment probability based on willingness and cheater severity
    const cheatSeverity = getCheatSeverity(punisher, cheater);
    if (cheatSeverity < 0.3) return false;  // Minor cheating, not worth punishing

    const punishProb = punishmentWillingness * cheatSeverity * dt * 0.1;
    if (Math.random() > punishProb) return false;

    // Check if punisher can afford it
    if (punisher.energy < PUNISHMENT_COST * 2) return false;  // Don't punish if too weak

    // Execute punishment
    punisher.energy -= PUNISHMENT_COST;
    cheater.energy -= PUNISHMENT_DAMAGE;

    // Record punishment
    punishmentHistory.set(cheater.id, {
        last_punished: state.tick,
        punishment_count: (cheaterHistory?.punishment_count || 0) + 1
    });

    // Log event
    logEvent('punishment', {
        punisher: punisher.id,
        cheater: cheater.id,
        cost: PUNISHMENT_COST,
        damage: PUNISHMENT_DAMAGE
    });

    // Visual event
    state.visualEvents.push({
        type: 'punishment',
        position: {
            x: (punisher.position.x + cheater.position.x) / 2,
            y: (punisher.position.y + cheater.position.y) / 2
        },
        age: 0,
        duration: 20
    });

    return true;
}

/**
 * Get severity of cheating behavior (0-1)
 */
function getCheatSeverity(agent, other) {
    const key = getHistoryKey(agent.id, other.id);
    const history = cooperationHistory.get(key);

    if (!history) return 0;

    const givenToOther = history.given[agent.id] || 0;
    const receivedFromOther = history.received[agent.id] || 0;

    if (givenToOther < 3) return 0;  // Not enough history

    const expectedReturn = givenToOther * 0.8;  // Expect ~80% reciprocation
    const deficit = expectedReturn - receivedFromOther;

    if (deficit <= 0) return 0;  // They're reciprocating fairly

    // Severity scales with how much they've cheated
    return Math.min(1, deficit / givenToOther);
}

/**
 * Process punishment interactions
 */
function processPunishment(agents, spatialHash, dt) {
    for (const agent of agents) {
        if (!agent.alive) continue;
        if ((agent.genome.social.punishment_willingness || 0) < 0.1) continue;

        // Get nearby potential cheaters
        const nearby = spatialHash.query(
            agent.position.x,
            agent.position.y,
            CONFIG.COOPERATION_RANGE
        ).filter(other => other !== agent && other.alive);

        for (const other of nearby) {
            if (isCheater(agent, other)) {
                attemptPunishment(agent, other, dt);
            }
        }
    }
}

/**
 * Decay cooperation history over time (forgiveness mechanism)
 */
function decayCooperationHistory(dt) {
    for (const [key, history] of cooperationHistory.entries()) {
        // Decay all values
        for (const id of Object.keys(history.given)) {
            history.given[id] *= (1 - CHEATER_MEMORY_DECAY * dt);
            history.received[id] *= (1 - CHEATER_MEMORY_DECAY * dt);
        }

        // Remove entry if values are too small
        const totalActivity = Object.values(history.given).reduce((a, b) => a + b, 0) +
                             Object.values(history.received).reduce((a, b) => a + b, 0);
        if (totalActivity < 1) {
            cooperationHistory.delete(key);
        }
    }
}

/**
 * Process all cooperation interactions
 */
export function processCooperation(agents, spatialHash, dt) {
    // Decay cooperation history (forgiveness mechanism)
    decayCooperationHistory(dt);

    // Update existing cooperative links
    updateCooperativeLinks(dt);

    // Process new cooperation opportunities
    for (const agent of agents) {
        if (!agent.alive) continue;
        if (agent.genome.social.cooperation_willingness < 0.2) continue;

        // Get nearby potential cooperators
        const nearby = spatialHash.query(
            agent.position.x,
            agent.position.y,
            CONFIG.COOPERATION_RANGE
        ).filter(other =>
            other !== agent &&
            other.alive &&
            other.genome.social.cooperation_willingness >= 0.2
        );

        for (const other of nearby) {
            processCooperationOpportunity(agent, other, dt);
        }
    }

    // Process resource sharing in existing links
    processResourceSharing(dt);

    // Process coordinated movement
    processCoordinatedMovement(dt);

    // Process punishment of cheaters (second-order public goods)
    processPunishment(agents, spatialHash, dt);
}

/**
 * Process potential cooperation between two agents
 */
function processCooperationOpportunity(agent, other, dt) {
    // Check if already linked
    if (hasCooperativeLink(agent, other)) return;

    // Check if either agent has too many links
    if ((agent.cooperative_links?.length || 0) >= CONFIG.MAX_COOPERATIVE_LINKS) return;
    if ((other.cooperative_links?.length || 0) >= CONFIG.MAX_COOPERATIVE_LINKS) return;

    // Check kin recognition
    if (!canRecognizeAsKin(agent, other)) return;

    // Check if either considers the other a cheater (tit-for-tat)
    if (isCheater(agent, other) || isCheater(other, agent)) return;

    // Calculate cooperation probability
    const probability = calculateCooperationProbability(agent, other);
    if (Math.random() > probability * dt) return;

    // Form cooperative link
    formCooperativeLink(agent, other);
}

/**
 * Check if agent can recognize other as kin
 * Now uses explicit lineage-based relatedness (Hamilton's Rule)
 */
function canRecognizeAsKin(agent, other) {
    // Calculate true genetic relatedness based on lineage
    const relatedness = calculateRelatedness(agent, other);

    // Higher relatedness = easier to recognize as kin
    // Even with perfect kin recognition, there's some noise
    const recognitionProbability = agent.genome.social.kin_recognition * relatedness;

    if (relatedness >= 0.5) {
        // Close relatives (r >= 0.5, e.g., parent-child, full siblings)
        // Almost always recognized if kin recognition trait is high
        return Math.random() < recognitionProbability * 2;  // Boost for close kin
    } else if (relatedness >= 0.25) {
        // Half-siblings, grandparent-grandchild (r = 0.25)
        return Math.random() < recognitionProbability * 1.5;
    } else if (relatedness >= 0.125) {
        // First cousins (r = 0.125)
        return Math.random() < recognitionProbability;
    }

    // Fallback to species/genetic distance for unrelated or untracked lineage
    if (isSameSpecies(agent.genome, other.genome)) {
        // Same species but no tracked lineage - use species marker as proxy
        // This gives a low relatedness estimate for species-mates
        return Math.random() < agent.genome.social.kin_recognition * 0.1;
    }

    // Check genetic distance as last resort (phenotypic matching)
    const genDist = geneticDistance(agent.genome, other.genome);
    const threshold = CONFIG.KIN_RECOGNITION_THRESHOLD / 100;

    if (genDist < threshold) {
        return Math.random() < agent.genome.social.kin_recognition * (1 - genDist / threshold) * 0.2;
    }

    return false;
}

/**
 * Calculate probability of forming cooperation
 * Uses Hamilton's Rule: rB > C (relatedness × benefit > cost)
 */
function calculateCooperationProbability(agent, other) {
    // Calculate relatedness for Hamilton's Rule
    const relatedness = calculateRelatedness(agent, other);

    // Base on cooperation willingness
    let prob = (agent.genome.social.cooperation_willingness +
                other.genome.social.cooperation_willingness) / 2;

    // HAMILTON'S RULE: Scale cooperation by relatedness
    // Higher relatedness = more willing to cooperate
    // r = 0.5 (siblings) doubles cooperation probability
    // r = 0.25 (half-sibs/cousins) increases by 50%
    const hamiltonMultiplier = 1 + relatedness * 2;
    prob *= hamiltonMultiplier;

    // Bonus for same species (even without lineage tracking)
    if (isSameSpecies(agent.genome, other.genome) && relatedness < 0.1) {
        prob *= 1.2;  // Reduced from 1.5 since Hamilton multiplier handles relatives
    }

    // Bonus for complementary abilities (mutualistic cooperation)
    const agentHasMotors = agent.genome.motors.length > 0;
    const otherHasMotors = other.genome.motors.length > 0;
    const agentHasSensors = agent.genome.sensors.length > 0;
    const otherHasSensors = other.genome.sensors.length > 0;

    if ((agentHasMotors && !otherHasMotors) || (!agentHasMotors && otherHasMotors)) {
        prob *= 1.2;
    }
    if ((agentHasSensors && !otherHasSensors) || (!agentHasSensors && otherHasSensors)) {
        prob *= 1.2;
    }

    // Reduce probability if either is low energy
    // (can't afford to be altruistic when starving)
    const avgEnergy = (agent.energy + other.energy) / 2;
    const avgCapacity = (agent.genome.metabolism.storage_capacity +
                        other.genome.metabolism.storage_capacity) / 2;
    if (avgEnergy < avgCapacity * 0.3) {
        prob *= 0.5;
    }

    return Math.min(1, prob);
}

/**
 * Form a cooperative link between two agents
 */
function formCooperativeLink(agent, other) {
    const link = {
        id: `coop_${agent.id}_${other.id}`,
        partner_id: other.id,
        strength: 0.5,
        age: 0,
        shared_energy: 0
    };

    const reverseLink = {
        id: `coop_${other.id}_${agent.id}`,
        partner_id: agent.id,
        strength: 0.5,
        age: 0,
        shared_energy: 0
    };

    agent.cooperative_links = agent.cooperative_links || [];
    other.cooperative_links = other.cooperative_links || [];

    agent.cooperative_links.push(link);
    other.cooperative_links.push(reverseLink);

    // Add to global tracking
    state.cooperativeLinks.push({
        agent_a: agent,
        agent_b: other,
        strength: 0.5,
        age: 0
    });

    // Log event
    logEvent('cooperation_formed', {
        agent1: agent.id,
        agent2: other.id,
        species1: agent.genome.species_marker,
        species2: other.genome.species_marker
    });

    // Visual event
    state.visualEvents.push({
        type: 'cooperation_formed',
        from: { x: agent.position.x, y: agent.position.y },
        to: { x: other.position.x, y: other.position.y },
        age: 0,
        duration: 30
    });
}

/**
 * Check if two agents have a cooperative link
 */
function hasCooperativeLink(agent, other) {
    if (!agent.cooperative_links) return false;
    return agent.cooperative_links.some(link => link.partner_id === other.id);
}

/**
 * Update all cooperative links
 */
function updateCooperativeLinks(dt) {
    // Update agent-level links
    for (const agent of state.agents) {
        if (!agent.alive || !agent.cooperative_links) continue;

        // COOPERATION MAINTENANCE COSTS (Dunbar's number effect)
        // More links = exponentially increasing cost to maintain
        const linkCount = agent.cooperative_links.length;
        if (linkCount > 0) {
            // Base cost per link, with Dunbar penalty for each additional link
            const dunbarPenalty = 1 + linkCount * CONFIG.COOPERATION_DUNBAR_PENALTY;
            const maintenanceCost = linkCount * CONFIG.COOPERATION_LINK_COST * dunbarPenalty * dt;
            agent.energy -= maintenanceCost;
        }

        agent.cooperative_links = agent.cooperative_links.filter(link => {
            // Find partner
            const partner = state.agents.find(a => a.id === link.partner_id);
            if (!partner || !partner.alive) return false;

            // Check distance
            const dist = distance(agent.position, partner.position);
            if (dist > CONFIG.COOPERATION_RANGE * 2) {
                // Link breaks due to distance
                return false;
            }

            // Age the link
            link.age += dt;

            // Strengthen over time (up to max)
            link.strength = Math.min(1, link.strength + 0.001 * dt);

            return true;
        });
    }

    // Update global tracking
    state.cooperativeLinks = state.cooperativeLinks.filter(link => {
        if (!link.agent_a.alive || !link.agent_b.alive) return false;

        const dist = distance(link.agent_a.position, link.agent_b.position);
        if (dist > CONFIG.COOPERATION_RANGE * 2) return false;

        link.age += dt;
        link.strength = Math.min(1, link.strength + 0.001 * dt);

        return true;
    });
}

/**
 * Process resource sharing between cooperating agents
 * Uses Hamilton's Rule: rB > C to determine sharing amount
 */
function processResourceSharing(dt) {
    for (const link of state.cooperativeLinks) {
        const agent_a = link.agent_a;
        const agent_b = link.agent_b;

        if (!agent_a.alive || !agent_b.alive) continue;

        // Calculate relatedness for Hamilton's Rule
        const relatedness = calculateRelatedness(agent_a, agent_b);

        // Calculate energy difference
        const energyA = agent_a.energy / agent_a.genome.metabolism.storage_capacity;
        const energyB = agent_b.energy / agent_b.genome.metabolism.storage_capacity;
        const diff = energyA - energyB;

        // HAMILTON'S RULE: rB > C
        // Sharing is altruistic - the benefit to recipient (B) must outweigh
        // the cost to donor (C) weighted by relatedness (r)
        // Higher relatedness = more willing to share at personal cost
        const sharingWillingness = 0.1 + relatedness * 0.4;  // 10-50% based on relatedness

        // Share if significant difference
        if (Math.abs(diff) > 0.2) {
            // Scale share amount by relatedness (Hamilton multiplier)
            const hamiltonMultiplier = 1 + relatedness;
            const shareAmount = Math.abs(diff) * link.strength * CONFIG.RESOURCE_SHARE_RATE * hamiltonMultiplier * dt;

            if (diff > 0) {
                // A shares with B - check if Hamilton's Rule is satisfied
                const cost = shareAmount;
                const benefit = shareAmount * 0.9;  // 10% transfer loss
                const hamiltonValue = relatedness * benefit - cost;

                // Share more generously with relatives
                const maxShare = agent_a.energy * sharingWillingness;
                const actual = Math.min(shareAmount, maxShare);

                if (actual > 0) {
                    agent_a.energy -= actual;
                    agent_b.energy += actual * 0.9; // 10% loss in transfer
                    link.shared_energy = (link.shared_energy || 0) + actual;
                    link.relatedness = relatedness;  // Track relatedness in link
                    // Record transfer for cheater detection
                    recordTransfer(agent_a.id, agent_b.id, actual);
                }
            } else {
                // B shares with A
                const maxShare = agent_b.energy * sharingWillingness;
                const actual = Math.min(shareAmount, maxShare);

                if (actual > 0) {
                    agent_b.energy -= actual;
                    agent_a.energy += actual * 0.9;
                    link.shared_energy = (link.shared_energy || 0) + actual;
                    link.relatedness = relatedness;
                    // Record transfer for cheater detection
                    recordTransfer(agent_b.id, agent_a.id, actual);
                }
            }
        }
    }
}

/**
 * Process coordinated movement
 */
function processCoordinatedMovement(dt) {
    for (const link of state.cooperativeLinks) {
        const agent_a = link.agent_a;
        const agent_b = link.agent_b;

        if (!agent_a.alive || !agent_b.alive) continue;

        // Calculate average velocity
        const avgVelX = (agent_a.velocity.x + agent_b.velocity.x) / 2;
        const avgVelY = (agent_a.velocity.y + agent_b.velocity.y) / 2;

        // Blend velocities based on link strength
        const blendFactor = link.strength * CONFIG.COOPERATION_SPEED_BONUS * dt;

        agent_a.velocity.x += (avgVelX - agent_a.velocity.x) * blendFactor;
        agent_a.velocity.y += (avgVelY - agent_a.velocity.y) * blendFactor;

        agent_b.velocity.x += (avgVelX - agent_b.velocity.x) * blendFactor;
        agent_b.velocity.y += (avgVelY - agent_b.velocity.y) * blendFactor;

        // Apply slight attraction to keep together
        const dist = distance(agent_a.position, agent_b.position);
        if (dist > CONFIG.COOPERATION_RANGE * 0.5) {
            const dx = agent_b.position.x - agent_a.position.x;
            const dy = agent_b.position.y - agent_a.position.y;
            const len = dist || 1;

            const attraction = link.strength * 0.1 * dt;
            agent_a.velocity.x += (dx / len) * attraction;
            agent_a.velocity.y += (dy / len) * attraction;
            agent_b.velocity.x -= (dx / len) * attraction;
            agent_b.velocity.y -= (dy / len) * attraction;
        }
    }
}

/**
 * Apply group defense bonus
 */
export function getGroupDefenseBonus(agent) {
    if (!agent.cooperative_links || agent.cooperative_links.length === 0) {
        return 1.0;
    }

    // Each cooperator adds defense bonus
    let bonus = 1.0;
    for (const link of agent.cooperative_links) {
        const partner = state.agents.find(a => a.id === link.partner_id);
        if (partner && partner.alive) {
            const dist = distance(agent.position, partner.position);
            if (dist < CONFIG.COOPERATION_RANGE) {
                bonus += link.strength * 0.2;
            }
        }
    }

    return bonus;
}

/**
 * Get cooperation statistics
 */
export function getCooperationStats() {
    let totalLinks = 0;
    let totalStrength = 0;
    let cooperatingAgents = new Set();

    for (const link of state.cooperativeLinks) {
        if (link.agent_a.alive && link.agent_b.alive) {
            totalLinks++;
            totalStrength += link.strength;
            cooperatingAgents.add(link.agent_a.id);
            cooperatingAgents.add(link.agent_b.id);
        }
    }

    return {
        totalLinks,
        avgStrength: totalLinks > 0 ? totalStrength / totalLinks : 0,
        cooperatingAgentCount: cooperatingAgents.size,
        cooperationRate: state.agents.filter(a => a.alive).length > 0 ?
            cooperatingAgents.size / state.agents.filter(a => a.alive).length : 0
    };
}

/**
 * Find best cooperation partner for an agent
 */
export function findBestCooperationPartner(agent, spatialHash) {
    const nearby = spatialHash.query(
        agent.position.x,
        agent.position.y,
        CONFIG.COOPERATION_RANGE
    ).filter(other =>
        other !== agent &&
        other.alive &&
        !hasCooperativeLink(agent, other) &&
        canRecognizeAsKin(agent, other)
    );

    if (nearby.length === 0) return null;

    // Score each potential partner
    let bestPartner = null;
    let bestScore = 0;

    for (const other of nearby) {
        let score = calculateCooperationProbability(agent, other);

        // Bonus for closer distance
        const dist = distance(agent.position, other.position);
        score *= (1 - dist / CONFIG.COOPERATION_RANGE);

        if (score > bestScore) {
            bestScore = score;
            bestPartner = other;
        }
    }

    return bestPartner;
}

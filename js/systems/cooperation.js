/**
 * Cooperation System
 *
 * Handles cooperative interactions between related agents:
 * - Kin detection and recognition
 * - Cooperative link formation
 * - Resource sharing
 * - Coordinated movement
 * - Group defense
 */

import { CONFIG } from '../config.js';
import { state, logEvent } from '../state.js';
import { vec, distance, normalize, scale, add } from '../utils/math.js';
import { isSameSpecies, geneticDistance } from '../core/genome.js';

/**
 * Process all cooperation interactions
 */
export function processCooperation(agents, spatialHash, dt) {
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

    // Calculate cooperation probability
    const probability = calculateCooperationProbability(agent, other);
    if (Math.random() > probability * dt) return;

    // Form cooperative link
    formCooperativeLink(agent, other);
}

/**
 * Check if agent can recognize other as kin
 */
function canRecognizeAsKin(agent, other) {
    // Same species is easiest to recognize
    if (isSameSpecies(agent.genome, other.genome)) {
        return Math.random() < agent.genome.social.kin_recognition;
    }

    // Check genetic distance
    const genDist = geneticDistance(agent.genome, other.genome);
    const threshold = CONFIG.KIN_RECOGNITION_THRESHOLD / 100;

    // Lower genetic distance = easier to recognize
    if (genDist < threshold) {
        return Math.random() < agent.genome.social.kin_recognition * (1 - genDist / threshold);
    }

    return false;
}

/**
 * Calculate probability of forming cooperation
 */
function calculateCooperationProbability(agent, other) {
    let prob = 0;

    // Base on cooperation willingness
    prob = (agent.genome.social.cooperation_willingness +
            other.genome.social.cooperation_willingness) / 2;

    // Bonus for same species
    if (isSameSpecies(agent.genome, other.genome)) {
        prob *= 1.5;
    }

    // Bonus for complementary abilities
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
 */
function processResourceSharing(dt) {
    for (const link of state.cooperativeLinks) {
        const agent_a = link.agent_a;
        const agent_b = link.agent_b;

        if (!agent_a.alive || !agent_b.alive) continue;

        // Calculate energy difference
        const energyA = agent_a.energy / agent_a.genome.metabolism.storage_capacity;
        const energyB = agent_b.energy / agent_b.genome.metabolism.storage_capacity;
        const diff = energyA - energyB;

        // Share if significant difference
        if (Math.abs(diff) > 0.2) {
            const shareAmount = Math.abs(diff) * link.strength * CONFIG.RESOURCE_SHARE_RATE * dt;

            if (diff > 0) {
                // A shares with B
                const actual = Math.min(shareAmount, agent_a.energy * 0.1);
                agent_a.energy -= actual;
                agent_b.energy += actual * 0.9; // 10% loss in transfer
                link.shared_energy = (link.shared_energy || 0) + actual;
            } else {
                // B shares with A
                const actual = Math.min(shareAmount, agent_b.energy * 0.1);
                agent_b.energy -= actual;
                agent_a.energy += actual * 0.9;
                link.shared_energy = (link.shared_energy || 0) + actual;
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

/**
 * Competition System
 *
 * Handles competitive interactions between agents:
 * - Resource competition
 * - Territorial behavior
 * - Combat/aggression
 * - Fleeing mechanics
 */

import { CONFIG } from '../config.js';
import { state, logEvent } from '../state.js';
import { vec, distance, normalize, scale, add, subtract } from '../utils/math.js';
import { isSameSpecies } from '../core/genome.js';

/**
 * Process all competition interactions
 */
export function processCompetition(agents, spatialHash, dt) {
    for (const agent of agents) {
        if (!agent.alive) continue;

        // Get nearby agents
        const nearby = spatialHash.query(
            agent.position.x,
            agent.position.y,
            CONFIG.COMPETITION_RANGE
        ).filter(other => other !== agent && other.alive);

        if (nearby.length === 0) continue;

        // Process each nearby agent
        for (const other of nearby) {
            processAgentInteraction(agent, other, dt);
        }
    }
}

/**
 * Calculate ecological niche overlap between two agents
 * Higher overlap = more competition for same resources
 * Drives character displacement and adaptive radiation
 */
function calculateNicheOverlap(agent1, agent2) {
    // Food niche overlap - same food type = full overlap
    const food1 = agent1.genome.metabolism.primary_food;
    const food2 = agent2.genome.metabolism.primary_food;
    const foodOverlap = food1 === food2 ? 1.0 : 0.3;  // Different food = reduced overlap

    // Size niche overlap - similar sizes compete more
    const size1 = agent1.genome.nodes.length;
    const size2 = agent2.genome.nodes.length;
    const sizeDiff = Math.abs(size1 - size2);
    const sizeOverlap = Math.max(0, 1 - sizeDiff / CONFIG.NICHE_SIZE_FACTOR);

    // Average the two dimensions
    return (foodOverlap + sizeOverlap) / 2;
}

/**
 * Apply niche-based competition cost
 * Agents with overlapping niches drain each other's energy
 */
function applyNicheCompetition(agent, other, dist, dt) {
    const overlap = calculateNicheOverlap(agent, other);
    if (overlap < 0.1) return;  // Minimal overlap = no competition

    // Competition intensity decreases with distance
    const distanceFactor = 1 - (dist / CONFIG.COMPETITION_RANGE);

    // Energy cost from competition (shared equally)
    const competitionCost = overlap * distanceFactor * CONFIG.NICHE_COMPETITION_STRENGTH * dt;

    agent.energy -= competitionCost;
    // Note: other agent will have competition applied when they are the 'agent' in the loop
}

/**
 * Process interaction between two agents
 */
function processAgentInteraction(agent, other, dt) {
    const dist = distance(agent.position, other.position);
    if (dist > CONFIG.COMPETITION_RANGE) return;

    const sameSpecies = isSameSpecies(agent.genome, other.genome);

    // NICHE PARTITIONING: Apply competition cost based on ecological overlap
    // This drives character displacement and adaptive radiation
    applyNicheCompetition(agent, other, dist, dt);

    // Determine interaction type based on social traits
    const agentAggression = agent.genome.social.aggression;
    const otherAggression = other.genome.social.aggression;

    // Check for territorial behavior
    if (dist < CONFIG.TERRITORIAL_RADIUS) {
        // Territorial pressure - push away non-kin
        if (!sameSpecies) {
            applyTerritorialPressure(agent, other, dist, dt);
        }
    }

    // Combat check
    if (shouldFight(agent, other, sameSpecies)) {
        processCombat(agent, other, dt);
    }

    // Flee check
    if (shouldFlee(agent, other)) {
        processFlee(agent, other, dt);
    }

    // Resource stealing
    if (agentAggression > 0.7 && agent.energy < other.energy * 0.5) {
        processResourceStealing(agent, other, dt);
    }
}

/**
 * Apply territorial pressure (push agents apart)
 */
function applyTerritorialPressure(agent, other, dist, dt) {
    const strength = (1 - dist / CONFIG.TERRITORIAL_RADIUS) * CONFIG.TERRITORIAL_FORCE;

    // Direction from other to agent
    const delta = subtract(agent.position, other.position);
    const len = Math.sqrt(delta.x * delta.x + delta.y * delta.y) || 1;

    // Apply force to both agents
    const force = strength * dt;

    agent.velocity.x += (delta.x / len) * force;
    agent.velocity.y += (delta.y / len) * force;

    other.velocity.x -= (delta.x / len) * force;
    other.velocity.y -= (delta.y / len) * force;
}

/**
 * Determine if two agents should fight
 */
function shouldFight(agent, other, sameSpecies) {
    // Don't fight same species (usually)
    if (sameSpecies && Math.random() > 0.1) return false;

    // Both need some aggression
    const avgAggression = (agent.genome.social.aggression + other.genome.social.aggression) / 2;
    if (avgAggression < 0.3) return false;

    // Proximity check
    const dist = distance(agent.position, other.position);
    if (dist > CONFIG.COMBAT_RANGE) return false;

    // Random chance based on aggression
    return Math.random() < avgAggression * 0.1;
}

/**
 * Process combat between two agents
 */
function processCombat(agent, other, dt) {
    // Calculate combat power based on mass and energy
    const agentPower = calculateCombatPower(agent);
    const otherPower = calculateCombatPower(other);

    // Determine winner probabilistically
    const totalPower = agentPower + otherPower;
    const agentWinChance = agentPower / totalPower;

    const damage = CONFIG.COMBAT_DAMAGE * dt;

    if (Math.random() < agentWinChance) {
        // Agent wins this exchange
        other.energy -= damage;
        agent.energy -= damage * 0.3; // Winner takes some damage too

        // Add visual event
        addCombatEvent(agent, other, 'hit');
    } else {
        // Other wins
        agent.energy -= damage;
        other.energy -= damage * 0.3;

        addCombatEvent(other, agent, 'hit');
    }

    // Log significant combat
    if (Math.random() < 0.01) {
        logEvent('combat', {
            attacker: agent.id,
            defender: other.id,
            attackerPower: agentPower,
            defenderPower: otherPower
        });
    }
}

/**
 * Calculate combat power of an agent
 */
function calculateCombatPower(agent) {
    // Base power from mass
    let power = agent.genome.nodes.reduce((sum, n) => sum + n.mass, 0);

    // Energy bonus
    power *= (0.5 + agent.energy / agent.genome.metabolism.storage_capacity * 0.5);

    // Aggression bonus
    power *= (1 + agent.genome.social.aggression * 0.5);

    // Size bonus (more nodes = more powerful)
    power *= (1 + agent.genome.nodes.length * 0.1);

    return power;
}

/**
 * Determine if agent should flee from other
 */
function shouldFlee(agent, other) {
    // Compare threat levels
    const agentPower = calculateCombatPower(agent);
    const otherPower = calculateCombatPower(other);

    // Flee if significantly weaker and other is aggressive
    if (otherPower > agentPower * 1.5 && other.genome.social.aggression > 0.5) {
        return true;
    }

    // Flee if low energy
    if (agent.energy < agent.genome.metabolism.storage_capacity * 0.2) {
        return true;
    }

    return false;
}

/**
 * Process fleeing behavior
 */
function processFlee(agent, other, dt) {
    // Direction away from threat
    const delta = subtract(agent.position, other.position);
    const len = Math.sqrt(delta.x * delta.x + delta.y * delta.y) || 1;

    // Flee speed based on fear (inverse of aggression)
    const fleeStrength = (1 - agent.genome.social.aggression) * CONFIG.FLEE_SPEED * dt;

    agent.velocity.x += (delta.x / len) * fleeStrength;
    agent.velocity.y += (delta.y / len) * fleeStrength;
}

/**
 * Process resource stealing
 */
function processResourceStealing(thief, victim, dt) {
    // Stealing chance based on aggression difference
    const stealChance = thief.genome.social.aggression - victim.genome.social.aggression * 0.5;
    if (Math.random() > stealChance) return;

    // Amount stolen
    const stealAmount = Math.min(
        victim.energy * CONFIG.STEAL_PERCENTAGE,
        CONFIG.MAX_STEAL_AMOUNT
    ) * dt;

    if (stealAmount > 0) {
        victim.energy -= stealAmount;
        thief.energy += stealAmount * 0.8; // Some loss in transfer

        // Log stealing
        logEvent('steal', {
            thief: thief.id,
            victim: victim.id,
            amount: stealAmount
        });
    }
}

/**
 * Add combat visual event
 */
function addCombatEvent(winner, loser, type) {
    state.visualEvents.push({
        type: 'combat',
        subtype: type,
        position: {
            x: (winner.position.x + loser.position.x) / 2,
            y: (winner.position.y + loser.position.y) / 2
        },
        winner: winner.id,
        loser: loser.id,
        age: 0,
        duration: 20
    });
}

// === ECOLOGICAL CHARACTER DISPLACEMENT ===
// Tracks displacement pressure per agent for trait evolution

// Displacement pressure cache (refreshed periodically)
const displacementPressure = new Map();  // agent.id -> pressure object

/**
 * Calculate character displacement pressure on an agent
 * When niches overlap, selection favors trait divergence
 */
function calculateDisplacementPressure(agent, competitors) {
    const pressure = {
        size_direction: 0,       // +1 = select larger, -1 = select smaller
        food_switch_pressure: 0, // Pressure to change food preference
        activity_shift: 0,       // Pressure to shift activity timing (if implemented)
        total_overlap: 0         // Total niche overlap experienced
    };

    for (const competitor of competitors) {
        if (competitor === agent || !competitor.alive) continue;

        const overlap = calculateNicheOverlap(agent, competitor);
        if (overlap < 0.2) continue;  // Low overlap = no displacement pressure

        const dist = Math.sqrt(
            Math.pow(agent.position.x - competitor.position.x, 2) +
            Math.pow(agent.position.y - competitor.position.y, 2)
        );
        const proximity = Math.max(0, 1 - dist / CONFIG.COMPETITION_RANGE);

        const pressureStrength = overlap * proximity;
        pressure.total_overlap += pressureStrength;

        // SIZE DISPLACEMENT (Brown-Wilson character displacement)
        // If competitor is similar size, select for divergence away from them
        const agentSize = agent.genome.nodes.length;
        const competitorSize = competitor.genome.nodes.length;
        const sizeDiff = agentSize - competitorSize;

        if (Math.abs(sizeDiff) < 3) {
            // Too similar in size - select for divergence
            // Direction depends on which way creates more separation
            if (sizeDiff >= 0) {
                pressure.size_direction += pressureStrength;  // Select larger
            } else {
                pressure.size_direction -= pressureStrength;  // Select smaller
            }
        }

        // FOOD NICHE DISPLACEMENT
        // Same food type creates pressure to switch
        if (agent.genome.metabolism.primary_food === competitor.genome.metabolism.primary_food) {
            pressure.food_switch_pressure += pressureStrength;
        }
    }

    return pressure;
}

/**
 * Apply character displacement selection modifier
 * Rewards individuals that have diverged from competitors
 */
export function getDisplacementFitnessModifier(agent, competitors) {
    const pressure = calculateDisplacementPressure(agent, competitors);

    let modifier = 0;

    // Low total overlap = good niche separation (reward)
    if (pressure.total_overlap < 0.5) {
        modifier += 0.05;  // Bonus for niche separation
    }

    // Being at an extreme size when similar competitors exist = advantage
    const agentSize = agent.genome.nodes.length;
    const maxSize = CONFIG.MAX_NODES;

    if (pressure.size_direction > 0.5 && agentSize > maxSize * 0.6) {
        // Large when selection favors larger = advantage
        modifier += 0.03 * (agentSize / maxSize);
    } else if (pressure.size_direction < -0.5 && agentSize < maxSize * 0.4) {
        // Small when selection favors smaller = advantage
        modifier += 0.03 * (1 - agentSize / maxSize);
    }

    // Penalty for being in contested niche
    modifier -= pressure.food_switch_pressure * 0.02;

    return modifier;
}

/**
 * Get character displacement statistics
 */
export function getDisplacementStats(agents, spatialHash) {
    const living = agents.filter(a => a.alive);
    if (living.length < 10) return null;

    // Sample agents and calculate displacement metrics
    const sampleSize = Math.min(50, living.length);
    let totalOverlap = 0;
    let sizeVariance = 0;
    let foodDiversity = new Set();

    const sizes = [];

    for (let i = 0; i < sampleSize; i++) {
        const agent = living[Math.floor(Math.random() * living.length)];
        sizes.push(agent.genome.nodes.length);
        foodDiversity.add(agent.genome.metabolism.primary_food);

        // Get competitors
        const competitors = spatialHash.query(
            agent.position.x,
            agent.position.y,
            CONFIG.COMPETITION_RANGE
        ).filter(other => other !== agent && other.alive);

        if (competitors.length > 0) {
            const pressure = calculateDisplacementPressure(agent, competitors);
            totalOverlap += pressure.total_overlap;
        }
    }

    // Calculate size variance (character divergence indicator)
    const meanSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    sizeVariance = sizes.reduce((sum, s) => sum + Math.pow(s - meanSize, 2), 0) / sizes.length;

    return {
        avgNicheOverlap: totalOverlap / sampleSize,
        sizeVariance: sizeVariance,
        foodNicheDiversity: foodDiversity.size,
        characterDivergence: Math.sqrt(sizeVariance) / CONFIG.MAX_NODES  // Normalized
    };
}

/**
 * Check if limiting similarity is violated
 * Species too similar in niche cannot coexist stably
 */
export function checkLimitingSimilarity(speciesA, speciesB, agents) {
    const membersA = agents.filter(a => a.alive && a.genome.species_marker === speciesA);
    const membersB = agents.filter(a => a.alive && a.genome.species_marker === speciesB);

    if (membersA.length === 0 || membersB.length === 0) return { coexist: true, similarity: 0 };

    // Calculate average niche overlap between species
    let totalOverlap = 0;
    let comparisons = 0;

    const sampleA = membersA.slice(0, 10);
    const sampleB = membersB.slice(0, 10);

    for (const a of sampleA) {
        for (const b of sampleB) {
            totalOverlap += calculateNicheOverlap(a, b);
            comparisons++;
        }
    }

    const avgOverlap = comparisons > 0 ? totalOverlap / comparisons : 0;

    // Limiting similarity threshold (MacArthur & Levins)
    // If overlap > threshold, competitive exclusion likely
    const limitingSimilarityThreshold = 0.8;

    return {
        coexist: avgOverlap < limitingSimilarityThreshold,
        similarity: avgOverlap,
        exclusionRisk: avgOverlap > 0.6 ? (avgOverlap - 0.6) / 0.4 : 0
    };
}

/**
 * Get competition statistics
 */
export function getCompetitionStats() {
    let totalAggression = 0;
    let aggressiveCount = 0;
    let passiveCount = 0;

    for (const agent of state.agents) {
        if (!agent.alive) continue;

        totalAggression += agent.genome.social.aggression;

        if (agent.genome.social.aggression > 0.6) {
            aggressiveCount++;
        } else if (agent.genome.social.aggression < 0.3) {
            passiveCount++;
        }
    }

    const living = state.agents.filter(a => a.alive).length;

    return {
        avgAggression: living > 0 ? totalAggression / living : 0,
        aggressiveCount,
        passiveCount,
        neutralCount: living - aggressiveCount - passiveCount
    };
}

/**
 * Check if position is contested (multiple agents want it)
 */
export function isContestedArea(x, y, radius, spatialHash) {
    const agents = spatialHash.query(x, y, radius);
    return agents.length > 1;
}

/**
 * Get dominant agent in an area
 */
export function getDominantAgent(x, y, radius, spatialHash) {
    const agents = spatialHash.query(x, y, radius).filter(a => a.alive);
    if (agents.length === 0) return null;

    return agents.reduce((dominant, current) => {
        const currentPower = calculateCombatPower(current);
        const dominantPower = calculateCombatPower(dominant);
        return currentPower > dominantPower ? current : dominant;
    });
}

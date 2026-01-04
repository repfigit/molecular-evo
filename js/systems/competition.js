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
import { vec, distance, normalize, scale, add } from '../utils/math.js';
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
 * Process interaction between two agents
 */
function processAgentInteraction(agent, other, dt) {
    const dist = distance(agent.position, other.position);
    if (dist > CONFIG.COMPETITION_RANGE) return;

    const sameSpecies = isSameSpecies(agent.genome, other.genome);

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
    const dx = agent.position.x - other.position.x;
    const dy = agent.position.y - other.position.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // Apply force to both agents
    const force = strength * dt;

    agent.velocity.x += (dx / len) * force;
    agent.velocity.y += (dy / len) * force;

    other.velocity.x -= (dx / len) * force;
    other.velocity.y -= (dy / len) * force;
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
    const dx = agent.position.x - other.position.x;
    const dy = agent.position.y - other.position.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // Flee speed based on fear (inverse of aggression)
    const fleeStrength = (1 - agent.genome.social.aggression) * CONFIG.FLEE_SPEED * dt;

    agent.velocity.x += (dx / len) * fleeStrength;
    agent.velocity.y += (dy / len) * fleeStrength;
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

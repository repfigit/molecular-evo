/**
 * Population Management
 *
 * Handles creation, tracking, and management of agent populations.
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { generateRandomGenome } from './genome.js';
import { createAgent, shouldDie, killAgent, serializeAgent, deserializeAgent } from './agent.js';

/**
 * Initialize population with random agents
 */
export function initializePopulation(count = CONFIG.INITIAL_AGENT_COUNT) {
    const agents = [];

    for (let i = 0; i < count; i++) {
        const genome = generateRandomGenome();
        const agent = createAgent(genome);
        agents.push(agent);
    }

    return agents;
}

/**
 * Add an agent to the population
 */
export function addAgent(agent, agents = state.agents) {
    agents.push(agent);
    return agent;
}

/**
 * Remove an agent from the population
 */
export function removeAgent(agent, agents = state.agents) {
    const index = agents.indexOf(agent);
    if (index > -1) {
        agents.splice(index, 1);
        return true;
    }
    return false;
}

/**
 * Remove agent by ID
 */
export function removeAgentById(id, agents = state.agents) {
    const index = agents.findIndex(a => a.id === id);
    if (index > -1) {
        agents.splice(index, 1);
        return true;
    }
    return false;
}

/**
 * Get agent by ID
 */
export function getAgentById(id, agents = state.agents) {
    return agents.find(a => a.id === id);
}

/**
 * Get all living agents
 */
export function getLivingAgents(agents = state.agents) {
    return agents.filter(a => a.alive);
}

/**
 * Get dead agents
 */
export function getDeadAgents(agents = state.agents) {
    return agents.filter(a => !a.alive);
}

/**
 * Process agent deaths and return dead agents
 */
export function processDeaths(agents = state.agents) {
    const dead = [];

    for (const agent of agents) {
        if (shouldDie(agent)) {
            if (agent.alive) {
                killAgent(agent);
            }
            dead.push(agent);
        }
    }

    return dead;
}

/**
 * Remove all dead agents from population
 */
export function removeDeadAgents(agents = state.agents) {
    const dead = [];
    let i = agents.length;

    while (i--) {
        if (!agents[i].alive) {
            dead.push(agents[i]);
            agents.splice(i, 1);
        }
    }

    return dead;
}

/**
 * Get population statistics
 */
export function getPopulationStats(agents = state.agents) {
    const living = agents.filter(a => a.alive);

    if (living.length === 0) {
        return {
            count: 0,
            avgEnergy: 0,
            avgAge: 0,
            avgFitness: 0,
            avgNodes: 0,
            avgMotors: 0,
            avgSensors: 0,
            avgPlasmids: 0,
            speciesCount: 0,
            infectedCount: 0,
            cooperatingCount: 0,
            symbioticCount: 0
        };
    }

    const totalEnergy = living.reduce((sum, a) => sum + a.energy, 0);
    const totalAge = living.reduce((sum, a) => sum + a.age, 0);
    const totalFitness = living.reduce((sum, a) => sum + a.fitness, 0);
    const totalNodes = living.reduce((sum, a) => sum + a.genome.nodes.length, 0);
    const totalMotors = living.reduce((sum, a) => sum + a.genome.motors.length, 0);
    const totalSensors = living.reduce((sum, a) => sum + a.genome.sensors.length, 0);
    const totalPlasmids = living.reduce((sum, a) => sum + a.genome.hgt.plasmids.length, 0);

    const speciesSet = new Set(living.map(a => a.genome.species_marker));
    const infectedCount = living.filter(a => a.infection).length;
    const cooperatingCount = living.filter(a => a.cooperative_links.length > 0).length;
    const symbioticCount = living.filter(a => a.symbiont || a.host).length;

    return {
        count: living.length,
        avgEnergy: totalEnergy / living.length,
        avgAge: totalAge / living.length,
        avgFitness: totalFitness / living.length,
        avgNodes: totalNodes / living.length,
        avgMotors: totalMotors / living.length,
        avgSensors: totalSensors / living.length,
        avgPlasmids: totalPlasmids / living.length,
        speciesCount: speciesSet.size,
        infectedCount,
        cooperatingCount,
        symbioticCount
    };
}

/**
 * Get agents by species marker
 */
export function getAgentsBySpecies(speciesMarker, agents = state.agents) {
    return agents.filter(a => a.alive && a.genome.species_marker === speciesMarker);
}

/**
 * Get unique species markers in population
 */
export function getSpeciesMarkers(agents = state.agents) {
    const markers = new Set();
    for (const agent of agents) {
        if (agent.alive) {
            markers.add(agent.genome.species_marker);
        }
    }
    return Array.from(markers);
}

/**
 * Get species distribution (count per species)
 */
export function getSpeciesDistribution(agents = state.agents) {
    const distribution = new Map();

    for (const agent of agents) {
        if (!agent.alive) continue;

        const marker = agent.genome.species_marker;
        distribution.set(marker, (distribution.get(marker) || 0) + 1);
    }

    return distribution;
}

/**
 * Get the most common species
 */
export function getDominantSpecies(agents = state.agents) {
    const distribution = getSpeciesDistribution(agents);
    let dominant = null;
    let maxCount = 0;

    for (const [marker, count] of distribution) {
        if (count > maxCount) {
            maxCount = count;
            dominant = marker;
        }
    }

    return { marker: dominant, count: maxCount };
}

/**
 * Get agents within a rectangular region
 */
export function getAgentsInRect(x, y, width, height, agents = state.agents) {
    return agents.filter(a => {
        if (!a.alive) return false;
        return a.position.x >= x &&
               a.position.x <= x + width &&
               a.position.y >= y &&
               a.position.y <= y + height;
    });
}

/**
 * Get agents within radius of a point
 */
export function getAgentsInRadius(x, y, radius, agents = state.agents) {
    const radiusSq = radius * radius;

    return agents.filter(a => {
        if (!a.alive) return false;
        const dx = a.position.x - x;
        const dy = a.position.y - y;
        return dx * dx + dy * dy <= radiusSq;
    });
}

/**
 * Get the nearest agent to a point
 */
export function getNearestAgent(x, y, agents = state.agents, exclude = null) {
    let nearest = null;
    let nearestDistSq = Infinity;

    for (const agent of agents) {
        if (!agent.alive || agent === exclude) continue;

        const dx = agent.position.x - x;
        const dy = agent.position.y - y;
        const distSq = dx * dx + dy * dy;

        if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearest = agent;
        }
    }

    return nearest;
}

/**
 * Get K nearest agents to a point
 */
export function getKNearestAgents(x, y, k, agents = state.agents, exclude = null) {
    const withDist = agents
        .filter(a => a.alive && a !== exclude)
        .map(a => {
            const dx = a.position.x - x;
            const dy = a.position.y - y;
            return { agent: a, distSq: dx * dx + dy * dy };
        })
        .sort((a, b) => a.distSq - b.distSq);

    return withDist.slice(0, k).map(item => item.agent);
}

/**
 * Check if population needs replenishing
 */
export function needsReplenishment(agents = state.agents) {
    const living = agents.filter(a => a.alive).length;
    return living < CONFIG.TARGET_POPULATION * 0.5;
}

/**
 * Replenish population with random agents
 */
export function replenishPopulation(targetCount = CONFIG.TARGET_POPULATION, agents = state.agents) {
    const living = agents.filter(a => a.alive).length;
    const needed = targetCount - living;

    const added = [];

    for (let i = 0; i < needed; i++) {
        const genome = generateRandomGenome();
        const agent = createAgent(genome);
        agents.push(agent);
        added.push(agent);
    }

    return added;
}

/**
 * Cull population to target size (remove weakest)
 */
export function cullPopulation(targetCount = CONFIG.TARGET_POPULATION, agents = state.agents) {
    const living = agents.filter(a => a.alive);

    if (living.length <= targetCount) return [];

    // Sort by fitness (lowest first)
    living.sort((a, b) => a.fitness - b.fitness);

    const toRemove = living.length - targetCount;
    const culled = [];

    for (let i = 0; i < toRemove; i++) {
        const agent = living[i];
        killAgent(agent);
        culled.push(agent);
    }

    return culled;
}

/**
 * Get energy distribution in population
 */
export function getEnergyDistribution(agents = state.agents, buckets = 10) {
    const living = agents.filter(a => a.alive);
    if (living.length === 0) return new Array(buckets).fill(0);

    const maxEnergy = Math.max(...living.map(a => a.genome.metabolism.storage_capacity));
    const distribution = new Array(buckets).fill(0);

    for (const agent of living) {
        const ratio = agent.energy / maxEnergy;
        const bucket = Math.min(buckets - 1, Math.floor(ratio * buckets));
        distribution[bucket]++;
    }

    return distribution;
}

/**
 * Get age distribution in population
 */
export function getAgeDistribution(agents = state.agents, buckets = 10) {
    const living = agents.filter(a => a.alive);
    if (living.length === 0) return new Array(buckets).fill(0);

    const maxAge = Math.max(...living.map(a => a.age));
    if (maxAge === 0) return new Array(buckets).fill(living.length);

    const distribution = new Array(buckets).fill(0);

    for (const agent of living) {
        const ratio = agent.age / maxAge;
        const bucket = Math.min(buckets - 1, Math.floor(ratio * buckets));
        distribution[bucket]++;
    }

    return distribution;
}

/**
 * Reset all agents' temporary bonuses
 */
export function resetAllBonuses(agents = state.agents) {
    for (const agent of agents) {
        agent.movement_bonus = 1.0;
        agent.effective_mass_bonus = 0;
        agent.sense_range_multiplier = 1.0;
        agent.metabolism_efficiency_bonus = 0;
    }
}

/**
 * Serialize population for saving
 */
export function serializePopulation(agents = state.agents) {
    return agents.map(serializeAgent);
}

/**
 * Deserialize population from saved data
 */
export function deserializePopulation(data) {
    return data.map(deserializeAgent);
}

/**
 * Corpse System and Nutrient Cycling
 *
 * Implements decomposer trophic level and complete nutrient cycling:
 * - Corpse creation from dead agents
 * - Decomposer organisms that specialize in breaking down dead matter
 * - Nutrient particles released from decay (nitrogen, phosphorus)
 * - Nutrients absorbed by organisms, especially primary producers
 * - Complete cycle: producers -> herbivores -> carnivores -> decomposers -> nutrients -> producers
 */

import { CONFIG } from '../config.js';
import { state, logEvent } from '../state.js';
import { generateUUID, distance } from '../utils/math.js';
import { rememberFood, recordExperience } from '../core/agent.js';

// === NUTRIENT POOL ===
// Tracks nutrient particles in the environment
// Initialize if not present in state
if (!state.nutrients) {
    state.nutrients = [];
}

// Nutrient types (different nutrients have different effects)
const NUTRIENT_TYPES = ['nitrogen', 'phosphorus', 'carbon'];

/**
 * Create a nutrient particle from decomposition
 */
export function createNutrient(x, y, amount, type = 'nitrogen') {
    return {
        id: generateUUID(),
        position: { x, y },
        amount,
        type,
        age: 0
    };
}

/**
 * Release nutrients from corpse decay
 * This is the key recycling mechanism
 */
function releaseNutrients(corpse, decayAmount) {
    // Nutrients are released proportional to decay
    const nutrientEfficiency = 0.3;  // 30% of decayed energy becomes nutrients
    const nutrientAmount = decayAmount * nutrientEfficiency;

    if (nutrientAmount < 0.5) return;  // Minimum threshold

    // Create nutrient particle near corpse
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 20;
    const nutrient = createNutrient(
        corpse.position.x + Math.cos(angle) * dist,
        corpse.position.y + Math.sin(angle) * dist,
        nutrientAmount,
        NUTRIENT_TYPES[Math.floor(Math.random() * NUTRIENT_TYPES.length)]
    );

    state.nutrients.push(nutrient);
}

/**
 * Create a corpse from a dead agent
 */
export function createCorpse(agent) {
    const corpse = {
        id: generateUUID(),
        position: { x: agent.position.x, y: agent.position.y },
        // Energy = remaining agent energy + body mass contribution
        energy: Math.max(0, agent.energy) + (agent.genome.nodes.length * CONFIG.CORPSE_BASE_ENERGY),
        originalEnergy: Math.max(0, agent.energy) + (agent.genome.nodes.length * CONFIG.CORPSE_BASE_ENERGY),
        originalSpecies: agent.genome.species_marker,
        size: agent.genome.nodes.length,
        age: 0,
        agentId: agent.id  // Reference to original agent for tracking
    };

    state.corpses.push(corpse);

    logEvent('corpse_created', {
        corpseId: corpse.id,
        agentId: agent.id,
        species: agent.genome.species_marker,
        energy: corpse.energy,
        position: corpse.position
    });

    return corpse;
}

/**
 * Process corpse decay with nutrient release
 */
export function processCorpseDecay(dt) {
    for (const corpse of state.corpses) {
        corpse.age++;

        // Calculate decay amount
        const decayAmount = CONFIG.CORPSE_DECAY_RATE * corpse.originalEnergy;

        // Decay energy over time
        corpse.energy -= decayAmount;

        // NUTRIENT CYCLING: Natural decay releases nutrients
        // This returns matter to the nutrient pool
        if (decayAmount > 0 && Math.random() < 0.3) {  // 30% chance per tick
            releaseNutrients(corpse, decayAmount);
        }

        // Ensure energy doesn't go negative
        if (corpse.energy < 0) {
            corpse.energy = 0;
        }
    }
}

/**
 * Process decomposer feeding
 * Decomposers are specialists that efficiently break down dead matter
 * They accelerate nutrient cycling and get more energy from corpses
 */
export function processDecomposition(agents, spatialHash, dt) {
    const consumedCorpses = new Set();

    for (const agent of agents) {
        if (!agent.alive) continue;

        // Check if agent has decomposer ability
        const decomposer = agent.genome.metabolism.decomposer || 0;
        if (decomposer < 0.2) continue;  // Need at least 20% decomposer ability

        // Find nearby corpses
        for (const corpse of state.corpses) {
            if (consumedCorpses.has(corpse.id)) continue;
            if (corpse.energy <= 0) continue;

            const dist = distance(agent.position, corpse.position);

            if (dist <= CONFIG.SCAVENGE_RANGE * 1.5) {  // Decomposers have larger range
                // Decomposers are 2x more efficient than scavengers
                const decomposerEfficiency = decomposer * 2.0;
                const maxConsume = CONFIG.SCAVENGE_RATE * decomposerEfficiency * dt;
                const energyGain = Math.min(
                    maxConsume,
                    corpse.energy,
                    agent.genome.metabolism.storage_capacity - agent.energy
                );

                if (energyGain > 0) {
                    // Transfer energy from corpse to decomposer
                    agent.energy += energyGain * agent.genome.metabolism.efficiency;
                    corpse.energy -= energyGain;
                    agent.total_energy_gathered = (agent.total_energy_gathered || 0) + energyGain;

                    // NUTRIENT CYCLING: Decomposition releases more nutrients than decay
                    // Decomposers are key to nutrient cycling in ecosystems
                    const nutrientRelease = energyGain * 0.5;  // 50% becomes nutrients
                    if (nutrientRelease > 0.5) {
                        releaseNutrients(corpse, nutrientRelease);
                    }

                    // Track decomposition
                    agent.decompose_count = (agent.decompose_count || 0) + 1;

                    // Learning: Remember this location as having food (corpses)
                    rememberFood(agent, corpse.position.x, corpse.position.y, energyGain / 20, state.tick);
                    recordExperience(agent, 'exploit', energyGain / 30, corpse.position.x, corpse.position.y, state.tick);

                    // Add visual event
                    state.visualEvents.push({
                        type: 'decompose',
                        position: { x: corpse.position.x, y: corpse.position.y },
                        agentId: agent.id,
                        corpseId: corpse.id,
                        age: 0,
                        duration: 20
                    });
                }

                // Mark corpse as fully consumed if depleted
                if (corpse.energy <= 0) {
                    consumedCorpses.add(corpse.id);
                }

                // Only one corpse per agent per tick
                break;
            }
        }
    }
}

/**
 * Process scavenging - agents eating corpses
 */
export function processScavenging(agents, spatialHash, dt) {
    const consumedCorpses = new Set();

    for (const agent of agents) {
        if (!agent.alive) continue;

        // Check if agent has scavenging ability
        const scavenging = agent.genome.metabolism.scavenging || 0;
        if (scavenging < 0.1) continue;  // Need at least 10% scavenging ability

        // Find nearby corpses
        for (const corpse of state.corpses) {
            if (consumedCorpses.has(corpse.id)) continue;
            if (corpse.energy <= 0) continue;

            const dist = distance(agent.position, corpse.position);

            if (dist <= CONFIG.SCAVENGE_RANGE) {
                // Calculate energy gain based on scavenging ability
                const maxConsume = CONFIG.SCAVENGE_RATE * scavenging * dt;
                const energyGain = Math.min(
                    maxConsume,
                    corpse.energy,
                    agent.genome.metabolism.storage_capacity - agent.energy
                );

                if (energyGain > 0) {
                    // Transfer energy from corpse to agent
                    agent.energy += energyGain * agent.genome.metabolism.efficiency;
                    corpse.energy -= energyGain;
                    agent.total_energy_gathered = (agent.total_energy_gathered || 0) + energyGain;

                    // Track scavenging for fitness
                    agent.scavenge_count = (agent.scavenge_count || 0) + 1;

                    // Add visual event
                    state.visualEvents.push({
                        type: 'scavenge',
                        position: { x: corpse.position.x, y: corpse.position.y },
                        agentId: agent.id,
                        corpseId: corpse.id,
                        age: 0,
                        duration: 15
                    });
                }

                // Mark corpse as fully consumed if depleted
                if (corpse.energy <= 0) {
                    consumedCorpses.add(corpse.id);
                }

                // Only one corpse per agent per tick
                break;
            }
        }
    }
}

/**
 * Remove expired or depleted corpses
 */
export function removeExpiredCorpses() {
    const before = state.corpses.length;

    state.corpses = state.corpses.filter(corpse => {
        // Remove if too old
        if (corpse.age >= CONFIG.CORPSE_MAX_AGE) return false;
        // Remove if no energy left
        if (corpse.energy <= 0) return false;
        return true;
    });

    const removed = before - state.corpses.length;
    return removed;
}

/**
 * Process nutrient absorption by agents
 * Nutrients boost energy recovery, especially for herbivores/producers
 */
export function processNutrientAbsorption(agents, dt) {
    if (!state.nutrients || state.nutrients.length === 0) return;

    const consumedNutrients = new Set();
    const NUTRIENT_ABSORPTION_RANGE = 30;

    for (const agent of agents) {
        if (!agent.alive) continue;

        // Calculate nutrient affinity based on trophic level
        // Herbivores/producers benefit most from nutrients
        const carnivory = agent.genome.metabolism.carnivory || 0;
        const decomposer = agent.genome.metabolism.decomposer || 0;

        // Low carnivory = high nutrient affinity (producers/herbivores)
        const nutrientAffinity = 1 - (carnivory * 0.5) - (decomposer * 0.3);
        if (nutrientAffinity < 0.2) continue;  // Carnivores don't absorb nutrients well

        // Find nearby nutrients
        for (const nutrient of state.nutrients) {
            if (consumedNutrients.has(nutrient.id)) continue;
            if (nutrient.amount <= 0) continue;

            const dist = distance(agent.position, nutrient.position);

            if (dist <= NUTRIENT_ABSORPTION_RANGE) {
                // Absorb nutrient
                const absorbAmount = Math.min(
                    nutrient.amount * nutrientAffinity * 0.5 * dt,
                    nutrient.amount,
                    (agent.genome.metabolism.storage_capacity - agent.energy) * 0.2
                );

                if (absorbAmount > 0.1) {
                    // Nutrient type affects different traits
                    switch (nutrient.type) {
                        case 'nitrogen':
                            // Nitrogen boosts energy
                            agent.energy += absorbAmount * agent.genome.metabolism.efficiency;
                            break;
                        case 'phosphorus':
                            // Phosphorus boosts energy storage temporarily
                            agent.energy += absorbAmount * agent.genome.metabolism.efficiency * 0.8;
                            break;
                        case 'carbon':
                            // Carbon is basic energy
                            agent.energy += absorbAmount * agent.genome.metabolism.efficiency * 0.6;
                            break;
                    }

                    nutrient.amount -= absorbAmount;
                    agent.total_energy_gathered = (agent.total_energy_gathered || 0) + absorbAmount;

                    // Learning: remember nutrient location
                    rememberFood(agent, nutrient.position.x, nutrient.position.y, absorbAmount / 5, state.tick);
                }

                // Mark nutrient as consumed if depleted
                if (nutrient.amount <= 0.1) {
                    consumedNutrients.add(nutrient.id);
                }
            }
        }
    }
}

/**
 * Process nutrient decay and cleanup
 */
export function processNutrientDecay(dt) {
    if (!state.nutrients) return;

    // Decay nutrients over time
    for (const nutrient of state.nutrients) {
        nutrient.age++;
        nutrient.amount *= 0.999;  // Slow decay
    }

    // Remove depleted nutrients
    if (state.tick % 100 === 0) {
        state.nutrients = state.nutrients.filter(n => n.amount > 0.1 && n.age < 1000);
    }
}

/**
 * Process all corpse system updates
 */
export function processCorpses(agents, spatialHash, dt) {
    // Decay corpses (releases nutrients)
    processCorpseDecay(dt);

    // Process decomposer feeding (specialized corpse consumption)
    processDecomposition(agents, spatialHash, dt);

    // Process scavenging (general corpse consumption)
    processScavenging(agents, spatialHash, dt);

    // Process nutrient cycling
    processNutrientAbsorption(agents, dt);
    processNutrientDecay(dt);

    // Clean up expired corpses periodically
    if (state.tick % 50 === 0) {
        removeExpiredCorpses();
    }
}

/**
 * Get corpses near a position (for sensors)
 */
export function getCorpsesNear(x, y, radius) {
    const nearby = [];

    for (const corpse of state.corpses) {
        if (corpse.energy <= 0) continue;

        const dist = distance({ x, y }, corpse.position);

        if (dist <= radius) {
            nearby.push({
                corpse,
                distance: dist
            });
        }
    }

    return nearby;
}

/**
 * Get nutrient cycling statistics
 */
export function getNutrientStats() {
    const nutrients = state.nutrients || [];

    if (nutrients.length === 0) {
        return {
            count: 0,
            totalAmount: 0,
            byType: { nitrogen: 0, phosphorus: 0, carbon: 0 }
        };
    }

    let totalAmount = 0;
    const byType = { nitrogen: 0, phosphorus: 0, carbon: 0 };

    for (const nutrient of nutrients) {
        totalAmount += nutrient.amount;
        byType[nutrient.type] = (byType[nutrient.type] || 0) + nutrient.amount;
    }

    return {
        count: nutrients.length,
        totalAmount,
        byType
    };
}

/**
 * Get trophic level distribution
 */
export function getTrophicDistribution() {
    const living = state.agents.filter(a => a.alive);

    let herbivores = 0;    // Low carnivory, low decomposer
    let carnivores = 0;    // High carnivory
    let decomposers = 0;   // High decomposer
    let omnivores = 0;     // Mixed strategy

    for (const agent of living) {
        const carnivory = agent.genome.metabolism.carnivory || 0;
        const decomposer = agent.genome.metabolism.decomposer || 0;

        if (carnivory >= 0.3 && decomposer < 0.3) {
            carnivores++;
        } else if (decomposer >= 0.3 && carnivory < 0.3) {
            decomposers++;
        } else if (carnivory >= 0.3 && decomposer >= 0.3) {
            omnivores++;
        } else {
            herbivores++;  // Default to herbivore/producer
        }
    }

    return {
        herbivores,
        carnivores,
        decomposers,
        omnivores,
        total: living.length
    };
}

/**
 * Get corpse statistics
 */
export function getCorpseStats() {
    if (state.corpses.length === 0) {
        return {
            count: 0,
            totalEnergy: 0,
            avgAge: 0
        };
    }

    let totalEnergy = 0;
    let totalAge = 0;

    for (const corpse of state.corpses) {
        totalEnergy += corpse.energy;
        totalAge += corpse.age;
    }

    return {
        count: state.corpses.length,
        totalEnergy,
        avgAge: totalAge / state.corpses.length
    };
}

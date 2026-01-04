/**
 * Evolution System
 *
 * Handles evolutionary mechanics including:
 * - Fitness calculation
 * - Selection (elitism + tournament)
 * - Reproduction (asexual + sexual)
 * - Mutation
 */

import { CONFIG } from '../config.js';
import { state, logEvent } from '../state.js';
import {
    cloneGenome,
    mutateGenome,
    crossoverGenomes,
    geneticDistance,
    isSameSpecies
} from '../core/genome.js';
import { randomInt } from '../utils/math.js';
import { createAgent, shouldDie, killAgent } from '../core/agent.js';
import { addOrganicMatter } from './environment.js';
import { updateSpeciesTracking } from '../core/species.js';

/**
 * Process one evolution cycle
 */
export function processEvolution(dt) {
    // Check if it's time for reproduction
    if (state.tick % CONFIG.REPRODUCTION_INTERVAL !== 0) {
        return;
    }

    const agents = state.agents.filter(a => a.alive);

    // Process deaths
    const deaths = processDeaths(agents);

    // Check for reproduction eligibility
    const eligible = agents.filter(a => canReproduce(a));

    // Process reproductions
    const newAgents = processReproduction(eligible);

    // Add new agents to population
    for (const agent of newAgents) {
        state.agents.push(agent);
    }

    // Population control
    if (state.agents.filter(a => a.alive).length > CONFIG.TARGET_POPULATION * 1.5) {
        cullWeakest(state.agents.filter(a => a.alive).length - CONFIG.TARGET_POPULATION);
    }

    // Update species tracking
    updateSpeciesTracking(state.agents);

    // Increment generation if threshold reached
    if (state.tick % CONFIG.TICKS_PER_GENERATION === 0) {
        state.generation++;
        logEvent('generation', { generation: state.generation });
    }
}

/**
 * Process agent deaths
 */
function processDeaths(agents) {
    const deaths = [];

    for (const agent of agents) {
        if (shouldDie(agent)) {
            killAgent(agent);
            deaths.push(agent);

            // Release organic matter
            if (state.environment) {
                addOrganicMatter(
                    agent.position.x,
                    agent.position.y,
                    agent.genome.nodes.length * 0.1
                );
            }

            logEvent('death', {
                agentId: agent.id,
                species: agent.genome.species_marker,
                age: agent.age,
                cause: agent.energy <= 0 ? 'starvation' : 'age'
            });
        }
    }

    return deaths;
}

/**
 * Check if an agent can reproduce
 */
export function canReproduce(agent) {
    if (!agent.alive) return false;

    const energyThreshold = CONFIG.REPRODUCTION_ENERGY_THRESHOLD;

    return agent.energy >= energyThreshold;
}

/**
 * Calculate fitness for an agent
 */
export function calculateFitness(agent) {
    let fitness = 0;

    // Survival component (age)
    fitness += agent.age * CONFIG.FITNESS_WEIGHTS.survival;

    // Energy efficiency
    const energyRatio = agent.energy / agent.genome.metabolism.storage_capacity;
    fitness += energyRatio * CONFIG.FITNESS_WEIGHTS.energy;

    // Offspring count
    fitness += agent.offspring_count * CONFIG.FITNESS_WEIGHTS.offspring;

    // Distance traveled (exploration)
    const distFromStart = Math.sqrt(
        Math.pow(agent.position.x - agent.startPosition.x, 2) +
        Math.pow(agent.position.y - agent.startPosition.y, 2)
    );
    fitness += distFromStart * CONFIG.FITNESS_WEIGHTS.distance;

    // Social bonuses
    if (agent.cooperative_links?.length > 0) {
        fitness += agent.cooperative_links.length * CONFIG.FITNESS_WEIGHTS.cooperation;
    }

    if (agent.symbiont || agent.host) {
        fitness += CONFIG.FITNESS_WEIGHTS.symbiosis;
    }

    // Immunity bonus
    if (agent.genome.viral?.crispr_memory?.length > 0) {
        fitness += agent.genome.viral.crispr_memory.length * CONFIG.FITNESS_WEIGHTS.immunity;
    }

    // === NEW: BIOLOGICAL REALISM IMPROVEMENTS ===
    
    // Complexity cost - organisms with more genes have higher metabolic costs
    const genomeComplexity = agent.genome.nodes.length + 
                            agent.genome.links.length + 
                            agent.genome.motors.length + 
                            agent.genome.sensors.length;
    const complexityCost = genomeComplexity * CONFIG.GENOME_SIZE_PENALTY;
    fitness -= complexityCost;

    // Efficiency bonus - reward efficient use of body structure
    // Agents with fewer unused nodes/motors are more efficient
    const activeMotors = agent.genome.motors.filter(m => m.cycle_speed > 0.1).length;
    const motorUtilization = agent.genome.motors.length > 0 
        ? activeMotors / agent.genome.motors.length 
        : 0;
    fitness += motorUtilization * 5;  // Bonus for using all motors

    // Metabolic efficiency - reward high efficiency metabolism
    fitness += agent.genome.metabolism.efficiency * 10;

    // Frequency-dependent selection - rare phenotypes have slight advantage
    // This promotes diversity and prevents single-strategy dominance
    const rarityBonus = calculateRarityBonus(agent);
    fitness += rarityBonus;

    // Environmental adaptation - fitness depends on temperature tolerance
    if (state.environment) {
        const tempStress = calculateTemperatureStress(agent, state.environment.temperature);
        fitness -= tempStress * 5;  // Penalty for being poorly adapted
    }

    agent.fitness = Math.max(0, fitness);  // Fitness cannot be negative
    return agent.fitness;
}

/**
 * Calculate rarity bonus for frequency-dependent selection
 * Rare species/strategies have a slight advantage
 */
function calculateRarityBonus(agent) {
    // Use cached alive agents from state if available
    const agents = state.agents.filter(a => a.alive);
    const totalAgents = agents.length;
    
    if (totalAgents === 0) return 0;
    
    // Count agents with same species
    const sameSpecies = agents.filter(a => 
        a.genome.species_marker === agent.genome.species_marker
    ).length;
    
    const frequency = sameSpecies / totalAgents;
    
    // Rare species (< 10% of population) get a bonus
    // Common species (> 50% of population) get a penalty
    if (frequency < 0.1) {
        return 10 * (0.1 - frequency);  // Up to +10 bonus for very rare
    } else if (frequency > 0.5) {
        return -5 * (frequency - 0.5);  // Up to -2.5 penalty for very common
    }
    
    return 0;
}

/**
 * Calculate temperature stress based on environmental temperature
 * Agents with metabolism tuned to current temp perform better
 */
function calculateTemperatureStress(agent, envTemp) {
    // Assume agents have an optimal temperature range
    // This creates selection pressure for temperature adaptation
    const optimalTemp = agent.genome.metabolism.efficiency;  // Use efficiency as proxy for temp adaptation
    const tempDiff = Math.abs(envTemp - optimalTemp);
    
    // Exponential stress increase with temperature difference
    return tempDiff * tempDiff * 2;  // Quadratic penalty
}

/**
 * Process reproduction for eligible agents
 */
function processReproduction(eligible) {
    const newAgents = [];

    for (const parent of eligible) {
        // Decide reproduction type (30% chance of sexual reproduction)
        const sexualChance = CONFIG.SEXUAL_REPRODUCTION_RATE || 0.3;
        const useSexual = Math.random() < sexualChance;

        if (useSexual) {
            // Find a mate
            const mate = findMate(parent, eligible);
            if (mate) {
                const offspring = sexualReproduction(parent, mate);
                if (offspring) {
                    newAgents.push(offspring);

                    // Deduct energy cost
                    const cost = CONFIG.REPRODUCTION_ENERGY_COST || 30;
                    parent.energy -= cost * 0.5;
                    mate.energy -= cost * 0.5;

                    parent.offspring_count++;
                    mate.offspring_count++;

                    logEvent('reproduction', {
                        type: 'sexual',
                        parent1: parent.id,
                        parent2: mate.id,
                        offspringId: offspring.id
                    });
                }
            }
        } else {
            // Asexual reproduction
            const offspring = asexualReproduction(parent);
            if (offspring) {
                newAgents.push(offspring);

                // Deduct energy cost
                parent.energy -= CONFIG.REPRODUCTION_ENERGY_COST || 30;
                parent.offspring_count++;

                logEvent('reproduction', {
                    type: 'asexual',
                    parent: parent.id,
                    offspringId: offspring.id
                });
            }
        }
    }

    return newAgents;
}

/**
 * Find a suitable mate for an agent
 */
function findMate(agent, candidates) {
    // Prefer same species (kin)
    const sameSpecies = candidates.filter(c =>
        c !== agent &&
        c.alive &&
        canReproduce(c) &&
        isSameSpecies(agent.genome, c.genome)
    );

    if (sameSpecies.length > 0) {
        // Tournament selection among same species
        return tournamentSelect(sameSpecies, CONFIG.TOURNAMENT_SIZE);
    }

    // Fall back to any compatible candidate
    const compatible = candidates.filter(c =>
        c !== agent &&
        c.alive &&
        canReproduce(c) &&
        geneticDistance(agent.genome, c.genome) < CONFIG.CROSSOVER_MAX_DISTANCE
    );

    if (compatible.length > 0) {
        return tournamentSelect(compatible, CONFIG.TOURNAMENT_SIZE);
    }

    return null;
}

/**
 * Tournament selection with genetic drift
 * Adds stochasticity even for high-fitness individuals
 */
function tournamentSelect(population, tournamentSize) {
    if (population.length === 0) return null;
    if (population.length <= tournamentSize) {
        // Return the fittest (but with some drift for small populations)
        if (population.length < 5 && Math.random() < 0.2) {
            // GENETIC DRIFT: In small populations, random selection sometimes
            return population[randomInt(0, population.length - 1)];
        }
        return population.reduce((best, current) =>
            (current.fitness || 0) > (best.fitness || 0) ? current : best
        );
    }

    // Random tournament
    const tournament = [];
    for (let i = 0; i < tournamentSize; i++) {
        const idx = Math.floor(Math.random() * population.length);
        tournament.push(population[idx]);
    }

    // IMPROVED SELECTION: Not always the fittest wins
    // 80% chance: best fitness wins
    // 20% chance: random selection (genetic drift)
    if (Math.random() < 0.8) {
        return tournament.reduce((best, current) =>
            (current.fitness || 0) > (best.fitness || 0) ? current : best
        );
    } else {
        // Random drift - any tournament member can win
        return tournament[randomInt(0, tournament.length - 1)];
    }
}

/**
 * Asexual reproduction (clone + mutate)
 */
function asexualReproduction(parent) {
    // Clone parent genome
    const childGenome = cloneGenome(parent.genome);

    // Increment generation
    childGenome.generation++;

    // Apply mutations (if enabled)
    if (CONFIG.ENABLE_MUTATIONS) {
        mutateGenome(childGenome);
    }

    // Check for speciation - if child is too different from parent, it's a new species
    const genDist = geneticDistance(parent.genome, childGenome);
    if (genDist >= CONFIG.SPECIES_DISTANCE_THRESHOLD) {
        // Speciation event! Assign new species marker
        const oldMarker = childGenome.species_marker;
        childGenome.species_marker = randomInt(0, 1000000);

        logEvent('speciation', {
            type: 'asexual_drift',
            parentSpecies: oldMarker,
            newSpecies: childGenome.species_marker,
            geneticDistance: genDist,
            parentId: parent.id
        });
    }

    // Create offspring
    const offspring = createAgent(childGenome);

    // Position near parent
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = 20 + Math.random() * 10;
    offspring.position.x = parent.position.x + Math.cos(angle) * spawnDist;
    offspring.position.y = parent.position.y + Math.sin(angle) * spawnDist;

    // Clamp to world bounds
    offspring.position.x = Math.max(10, Math.min(CONFIG.WORLD_WIDTH - 10, offspring.position.x));
    offspring.position.y = Math.max(10, Math.min(CONFIG.WORLD_HEIGHT - 10, offspring.position.y));

    // Give initial energy
    offspring.energy = parent.energy * 0.3;
    offspring.startPosition = { x: offspring.position.x, y: offspring.position.y };

    // Record lineage
    offspring.parentId = parent.id;

    return offspring;
}

/**
 * Sexual reproduction (crossover + mutate)
 */
function sexualReproduction(parent1, parent2) {
    // Create child genome through crossover
    const childGenome = crossoverGenomes(parent1.genome, parent2.genome);

    // Increment generation
    childGenome.generation = Math.max(parent1.genome.generation, parent2.genome.generation) + 1;

    // Apply mutations (lower rate for sexual reproduction, if enabled)
    if (CONFIG.ENABLE_MUTATIONS && Math.random() < 0.5) {
        mutateGenome(childGenome);
    }

    // Check for speciation
    const distToParent1 = geneticDistance(parent1.genome, childGenome);
    const distToParent2 = geneticDistance(parent2.genome, childGenome);
    const minDistToParent = Math.min(distToParent1, distToParent2);
    const parentsAreDifferentSpecies = parent1.genome.species_marker !== parent2.genome.species_marker;

    // Speciation can occur in two ways:
    // 1. Child is too different from both parents (divergence)
    // 2. Parents are different species and child is a hybrid
    if (minDistToParent >= CONFIG.SPECIES_DISTANCE_THRESHOLD) {
        // Speciation through divergence
        childGenome.species_marker = randomInt(0, 1000000);

        logEvent('speciation', {
            type: 'sexual_divergence',
            parent1Species: parent1.genome.species_marker,
            parent2Species: parent2.genome.species_marker,
            newSpecies: childGenome.species_marker,
            geneticDistance: minDistToParent,
            parent1Id: parent1.id,
            parent2Id: parent2.id
        });
    } else if (parentsAreDifferentSpecies && Math.random() < 0.3) {
        // Hybrid speciation - offspring of different species sometimes forms new species
        childGenome.species_marker = randomInt(0, 1000000);

        logEvent('speciation', {
            type: 'hybridization',
            parent1Species: parent1.genome.species_marker,
            parent2Species: parent2.genome.species_marker,
            newSpecies: childGenome.species_marker,
            parent1Id: parent1.id,
            parent2Id: parent2.id
        });
    }

    // Create offspring
    const offspring = createAgent(childGenome);

    // Position between parents
    offspring.position.x = (parent1.position.x + parent2.position.x) / 2;
    offspring.position.y = (parent1.position.y + parent2.position.y) / 2;

    // Add some randomness
    offspring.position.x += (Math.random() - 0.5) * 20;
    offspring.position.y += (Math.random() - 0.5) * 20;

    // Clamp to world bounds
    offspring.position.x = Math.max(10, Math.min(CONFIG.WORLD_WIDTH - 10, offspring.position.x));
    offspring.position.y = Math.max(10, Math.min(CONFIG.WORLD_HEIGHT - 10, offspring.position.y));

    // Give initial energy (from both parents)
    offspring.energy = (parent1.energy * 0.15) + (parent2.energy * 0.15);
    offspring.startPosition = { x: offspring.position.x, y: offspring.position.y };

    // Record lineage
    offspring.parent1Id = parent1.id;
    offspring.parent2Id = parent2.id;

    return offspring;
}

/**
 * Cull the weakest agents to control population
 */
function cullWeakest(count) {
    const living = state.agents.filter(a => a.alive);
    if (living.length <= count) return;

    // Sort by fitness (lowest first)
    living.sort((a, b) => (a.fitness || 0) - (b.fitness || 0));

    // Kill the weakest
    for (let i = 0; i < count; i++) {
        if (living[i]) {
            killAgent(living[i]);
            logEvent('culled', { agentId: living[i].id, fitness: living[i].fitness });
        }
    }
}

/**
 * Get population statistics for evolution
 */
export function getEvolutionStats() {
    const living = state.agents.filter(a => a.alive);

    if (living.length === 0) {
        return {
            avgFitness: 0,
            maxFitness: 0,
            minFitness: 0,
            avgGeneration: 0,
            avgOffspring: 0
        };
    }

    const fitnesses = living.map(a => a.fitness || 0);
    const generations = living.map(a => a.genome.generation);
    const offsprings = living.map(a => a.offspring || 0);

    return {
        avgFitness: fitnesses.reduce((a, b) => a + b, 0) / living.length,
        maxFitness: Math.max(...fitnesses),
        minFitness: Math.min(...fitnesses),
        avgGeneration: generations.reduce((a, b) => a + b, 0) / living.length,
        avgOffspring: offsprings.reduce((a, b) => a + b, 0) / living.length
    };
}

/**
 * Force evolution of a specific trait in the population
 * (For testing/debugging)
 */
export function boostTrait(trait, amount) {
    for (const agent of state.agents) {
        if (!agent.alive) continue;

        // Apply based on trait type
        switch (trait) {
            case 'speed':
                for (const motor of agent.genome.motors) {
                    motor.cycle_speed *= (1 + amount);
                }
                break;
            case 'efficiency':
                agent.genome.metabolism.efficiency = Math.min(1,
                    agent.genome.metabolism.efficiency + amount
                );
                break;
            case 'cooperation':
                agent.genome.social.kin_recognition = Math.min(1,
                    agent.genome.social.kin_recognition + amount
                );
                agent.genome.social.cooperation_willingness = Math.min(1,
                    agent.genome.social.cooperation_willingness + amount
                );
                break;
            case 'aggression':
                agent.genome.social.aggression = Math.min(1,
                    agent.genome.social.aggression + amount
                );
                break;
        }
    }
}

/**
 * Apply selection pressure based on environment
 */
export function applySelectionPressure(type, intensity) {
    const living = state.agents.filter(a => a.alive);

    for (const agent of living) {
        let pressureFactor = 0;

        switch (type) {
            case 'temperature':
                // Agents not adapted to current temperature suffer
                const optimalTemp = 0.5; // Could be evolved
                const tempDiff = Math.abs(state.environment.temperature - optimalTemp);
                pressureFactor = tempDiff * intensity;
                break;

            case 'resources':
                // Agents in low-resource areas suffer more
                const resourceLevel = agent.energy / agent.genome.metabolism.storage_capacity;
                pressureFactor = (1 - resourceLevel) * intensity;
                break;

            case 'competition':
                // Agents near many others suffer
                const nearbyCount = state.agents.filter(other =>
                    other !== agent &&
                    other.alive &&
                    Math.sqrt(
                        Math.pow(other.position.x - agent.position.x, 2) +
                        Math.pow(other.position.y - agent.position.y, 2)
                    ) < 50
                ).length;
                pressureFactor = (nearbyCount / 10) * intensity;
                break;
        }

        // Apply pressure as energy drain
        agent.energy -= pressureFactor * 0.1;
    }
}

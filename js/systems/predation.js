/**
 * Predation System
 *
 * Handles carnivorous behavior where agents hunt and eat other living agents:
 * - Predation attempts based on carnivory trait
 * - Success calculation based on size, energy, and traits
 * - Energy transfer from prey to predator
 * - Cooldown between attacks
 */

import { CONFIG } from '../config.js';
import { state, logEvent } from '../state.js';
import { isSameSpecies } from '../core/genome.js';
import { killAgent, rememberDanger, recordExperience } from '../core/agent.js';
import { createCorpse } from './corpse.js';
import { distance, normalize, scale, subtract } from '../utils/math.js';

/**
 * Check if predator can attempt to hunt prey
 */
function canPredate(predator, prey) {
    // Must be alive
    if (!predator.alive || !prey.alive) return false;

    // Need significant carnivory trait
    const carnivory = predator.genome.metabolism.carnivory || 0;
    if (carnivory < 0.3) return false;

    // Check if still handling previous prey (Holling Type II functional response)
    if (predator.handlingUntil && state.tick < predator.handlingUntil) return false;

    // Check cooldown
    const lastAttack = predator.lastPredationAttempt || 0;
    if (state.tick - lastAttack < CONFIG.CARNIVORY_COOLDOWN) return false;

    // Need enough energy to attempt
    if (predator.energy < CONFIG.CARNIVORY_ATTACK_COST * 2) return false;

    // Check distance
    const dist = distance(predator.position, prey.position);
    if (dist > CONFIG.CARNIVORY_ATTACK_RANGE) return false;

    // Check prey preference
    const preference = predator.genome.metabolism.prey_preference || 'any';
    switch (preference) {
        case 'smaller':
            if (prey.genome.nodes.length >= predator.genome.nodes.length) return false;
            break;
        case 'weaker':
            if (prey.energy >= predator.energy) return false;
            break;
        case 'other_species':
            if (isSameSpecies(predator.genome, prey.genome)) return false;
            break;
        case 'any':
        default:
            // Can attack anyone (but same species has penalty)
            break;
    }

    return true;
}

/**
 * Calculate probability of successful predation
 */
function calculatePredationSuccess(predator, prey) {
    let successRate = CONFIG.CARNIVORY_SUCCESS_RATE_BASE;

    // Carnivory trait bonus
    const carnivory = predator.genome.metabolism.carnivory || 0;
    successRate += carnivory * 0.3;

    // Size advantage/disadvantage
    const sizeRatio = predator.genome.nodes.length / prey.genome.nodes.length;
    if (sizeRatio > 1) {
        successRate += (sizeRatio - 1) * 0.2;  // Bonus for being bigger
    } else {
        successRate -= (1 - sizeRatio) * 0.3;  // Penalty for being smaller
    }

    // Energy advantage
    const energyRatio = predator.energy / (prey.energy + 1);
    if (energyRatio > 1) {
        successRate += Math.min(energyRatio - 1, 0.5) * 0.2;
    }

    // Same species penalty (cannibalism is harder)
    if (isSameSpecies(predator.genome, prey.genome)) {
        successRate *= 0.5;
    }

    // Prey aggression can reduce success (fighting back)
    const preyAggression = prey.genome.social.competition.aggression || 0;
    successRate -= preyAggression * 0.2;

    // Cooperative defense - prey in groups are harder to kill
    const nearbyKin = state.cooperativeLinks.filter(link =>
        (link.agent_a === prey || link.agent_b === prey)
    ).length;
    successRate -= nearbyKin * 0.1;

    return Math.max(0.05, Math.min(0.95, successRate));
}

/**
 * Attempt predation on prey
 */
function attemptPredation(predator, prey) {
    // Mark cooldown
    predator.lastPredationAttempt = state.tick;

    // Pay energy cost for attempt
    predator.energy -= CONFIG.CARNIVORY_ATTACK_COST;

    // Calculate success
    const successRate = calculatePredationSuccess(predator, prey);
    const success = Math.random() < successRate;

    if (success) {
        // Kill prey and consume
        consumePrey(predator, prey);

        logEvent('predation', {
            predatorId: predator.id,
            preyId: prey.id,
            predatorSpecies: predator.genome.species_marker,
            preySpecies: prey.genome.species_marker,
            energyGained: prey.energy * CONFIG.CARNIVORY_ENERGY_EFFICIENCY,
            success: true
        });

        // Visual event for successful kill
        state.visualEvents.push({
            type: 'predation_success',
            position: { x: prey.position.x, y: prey.position.y },
            predatorId: predator.id,
            preyId: prey.id,
            age: 0,
            duration: 30
        });

        return true;
    } else {
        // Failed attack - prey may flee
        logEvent('predation', {
            predatorId: predator.id,
            preyId: prey.id,
            predatorSpecies: predator.genome.species_marker,
            preySpecies: prey.genome.species_marker,
            success: false
        });

        // Make prey flee
        triggerFleeResponse(prey, predator);

        // Visual event for failed attack
        state.visualEvents.push({
            type: 'predation_fail',
            position: {
                x: (predator.position.x + prey.position.x) / 2,
                y: (predator.position.y + prey.position.y) / 2
            },
            predatorId: predator.id,
            preyId: prey.id,
            age: 0,
            duration: 15
        });

        return false;
    }
}

/**
 * Consume prey - kill prey and transfer energy to predator
 */
function consumePrey(predator, prey) {
    // Calculate energy gained
    const preyEnergy = prey.energy;
    const preyMass = prey.genome.nodes.length * CONFIG.CORPSE_BASE_ENERGY;
    const totalEnergy = preyEnergy + preyMass;
    const energyGained = totalEnergy * CONFIG.CARNIVORY_ENERGY_EFFICIENCY;

    // Transfer energy (limited by storage capacity)
    const actualGain = Math.min(
        energyGained,
        predator.genome.metabolism.storage_capacity - predator.energy
    );

    predator.energy += actualGain * predator.genome.metabolism.efficiency;
    predator.total_energy_gathered = (predator.total_energy_gathered || 0) + actualGain;
    predator.kill_count = (predator.kill_count || 0) + 1;

    // Handling time - predator is busy consuming prey (Holling Type II functional response)
    // Larger prey takes longer to consume, creating realistic optimal foraging constraints
    const handlingTime = prey.genome.nodes.length * CONFIG.PREDATION_HANDLING_TIME_PER_NODE;
    predator.handlingUntil = state.tick + handlingTime;

    // Kill the prey - but don't create a corpse since it was eaten
    // Set prey energy to 0 first so no corpse gets created in death processing
    prey.energy = -1000;  // Mark as fully consumed
    killAgent(prey);

    // Remove prey from agents list immediately
    // Note: This will be cleaned up in the next tick's agent filter
}

/**
 * Trigger flee response in prey
 */
function triggerFleeResponse(prey, predator) {
    // Calculate direction away from predator
    const delta = subtract(prey.position, predator.position);
    const dist = Math.sqrt(delta.x * delta.x + delta.y * delta.y) || 1;

    // Apply flee velocity (away from predator)
    const fleeStrength = CONFIG.FLEE_SPEED * 2;
    prey.velocity.x += (delta.x / dist) * fleeStrength;
    prey.velocity.y += (delta.y / dist) * fleeStrength;

    // Set flee cooldown to prevent immediate re-engagement
    prey.fleeingUntil = state.tick + 30;

    // BEHAVIORAL LEARNING: Remember this location as dangerous
    // Surviving a predation attempt is a strong learning signal
    rememberDanger(prey, predator.position.x, predator.position.y, 1.0, state.tick);

    // Positive experience for successful flee (survived!)
    recordExperience(prey, 'flee', 0.5, prey.position.x, prey.position.y, state.tick);
}

// === FREQUENCY-DEPENDENT DIET SELECTION ===
// Tracks prey type abundances for predator switching behavior (Type III functional response)
let preyTypeAbundance = new Map();  // species_marker -> abundance
let lastAbundanceUpdate = 0;
const ABUNDANCE_UPDATE_INTERVAL = 50;  // Update every 50 ticks

/**
 * Update prey type abundance tracking
 */
function updatePreyAbundance(agents) {
    if (state.tick - lastAbundanceUpdate < ABUNDANCE_UPDATE_INTERVAL) return;

    lastAbundanceUpdate = state.tick;
    preyTypeAbundance.clear();

    // Count living prey (non-carnivores)
    for (const agent of agents) {
        if (!agent.alive) continue;
        if ((agent.genome.metabolism.carnivory || 0) >= 0.5) continue;  // Skip predators

        const species = agent.genome.species_marker;
        preyTypeAbundance.set(species, (preyTypeAbundance.get(species) || 0) + 1);
    }
}

/**
 * Calculate frequency-dependent selection score for prey type
 * TYPE III FUNCTIONAL RESPONSE: Common prey are disproportionately targeted
 * This protects rare prey and creates switching behavior
 */
function getFrequencyDependentScore(preySpecies, totalPreyCount) {
    const abundance = preyTypeAbundance.get(preySpecies) || 0;
    const frequency = totalPreyCount > 0 ? abundance / totalPreyCount : 0;

    // Type III response: S-shaped curve
    // Prey below threshold frequency are largely ignored (refuge effect)
    // Common prey are over-selected (predator switching)
    const switchingThreshold = 0.1;  // Prey below 10% are protected
    const exponent = 2;  // Steepness of switching

    if (frequency < switchingThreshold) {
        // Rare prey: protected by frequency
        return Math.pow(frequency / switchingThreshold, exponent);
    } else {
        // Common prey: increasingly targeted
        return 1 + Math.pow((frequency - switchingThreshold) / (1 - switchingThreshold), exponent);
    }
}

/**
 * Select prey using frequency-dependent diet selection
 * Implements predator switching behavior based on prey abundance
 */
function selectPreyFrequencyDependent(nearby, predator) {
    const totalPrey = Array.from(preyTypeAbundance.values()).reduce((a, b) => a + b, 0);

    // Score each potential prey by frequency-dependent attractiveness
    const scoredPrey = nearby.map(prey => {
        const fdScore = getFrequencyDependentScore(prey.genome.species_marker, totalPrey);

        // Combine with other factors (size, energy)
        const sizeScore = 1 / (prey.genome.nodes.length + 1);  // Prefer smaller
        const energyScore = prey.energy / 100;  // More energy = more attractive

        // Final score: frequency-dependent × size × energy value
        const score = fdScore * (0.5 + sizeScore) * (0.5 + energyScore);

        return { prey, score };
    });

    // Probabilistic selection weighted by score
    const totalScore = scoredPrey.reduce((sum, p) => sum + p.score, 0);
    if (totalScore <= 0) return nearby[0];  // Fallback

    let roll = Math.random() * totalScore;
    for (const { prey, score } of scoredPrey) {
        roll -= score;
        if (roll <= 0) return prey;
    }

    return scoredPrey[scoredPrey.length - 1].prey;  // Fallback
}

/**
 * Process all predation interactions
 */
export function processPredation(agents, spatialHash, dt) {
    // Update prey abundance tracking for frequency-dependent selection
    updatePreyAbundance(agents);

    // Get all potential predators (agents with carnivory)
    const predators = agents.filter(a =>
        a.alive &&
        (a.genome.metabolism.carnivory || 0) >= 0.3 &&
        a.energy >= CONFIG.CARNIVORY_ATTACK_COST * 2
    );

    for (const predator of predators) {
        // Skip if still handling previous prey
        if (predator.handlingUntil && state.tick < predator.handlingUntil) continue;

        // Skip if still on cooldown
        const lastAttack = predator.lastPredationAttempt || 0;
        if (state.tick - lastAttack < CONFIG.CARNIVORY_COOLDOWN) continue;

        // Find nearby potential prey
        const nearby = spatialHash.query(
            predator.position.x,
            predator.position.y,
            CONFIG.CARNIVORY_ATTACK_RANGE
        ).filter(other =>
            other !== predator &&
            other.alive &&
            canPredate(predator, other)
        );

        if (nearby.length === 0) continue;

        // Choose prey based on preference and frequency-dependent selection
        let targetPrey = null;
        const preference = predator.genome.metabolism.prey_preference || 'any';

        // Apply frequency-dependent diet selection for generalist predators
        // Specialists (smaller/other_species preference) are less affected
        const useFrequencyDependent = (preference === 'any' || preference === 'weaker') &&
                                      preyTypeAbundance.size > 1;

        if (useFrequencyDependent) {
            // FREQUENCY-DEPENDENT SELECTION: Type III functional response
            // Predators switch to focus on common prey, protecting rare species
            targetPrey = selectPreyFrequencyDependent(nearby, predator);
        } else {
            // Original selection logic for specialists
            switch (preference) {
                case 'smaller':
                    // Prefer smallest prey
                    nearby.sort((a, b) => a.genome.nodes.length - b.genome.nodes.length);
                    targetPrey = nearby[0];
                    break;
                case 'weaker':
                    // Prefer lowest energy prey
                    nearby.sort((a, b) => a.energy - b.energy);
                    targetPrey = nearby[0];
                    break;
                case 'other_species':
                    // Prefer different species, random selection
                    const otherSpecies = nearby.filter(p =>
                        !isSameSpecies(predator.genome, p.genome)
                    );
                    if (otherSpecies.length > 0) {
                        targetPrey = otherSpecies[Math.floor(Math.random() * otherSpecies.length)];
                    }
                    break;
                case 'any':
                default:
                    // Random selection with preference for weaker targets
                    nearby.sort((a, b) => a.energy - b.energy);
                    if (Math.random() < 0.7) {
                        targetPrey = nearby[0];
                    } else {
                        targetPrey = nearby[Math.floor(Math.random() * nearby.length)];
                    }
                    break;
            }
        }

        if (targetPrey) {
            attemptPredation(predator, targetPrey);
        }
    }
}

/**
 * Check if agent is currently handling (consuming) prey
 * Used by physics to reduce movement speed during handling
 */
export function isHandlingPrey(agent) {
    return agent.handlingUntil && state.tick < agent.handlingUntil;
}

/**
 * Get predation statistics
 */
export function getPredationStats() {
    const living = state.agents.filter(a => a.alive);

    let totalCarnivory = 0;
    let carnivoreCount = 0;
    let totalKills = 0;

    for (const agent of living) {
        const carnivory = agent.genome.metabolism.carnivory || 0;
        totalCarnivory += carnivory;

        if (carnivory >= 0.3) {
            carnivoreCount++;
        }

        totalKills += agent.kill_count || 0;
    }

    return {
        avgCarnivory: living.length > 0 ? totalCarnivory / living.length : 0,
        carnivoreCount,
        totalKills,
        carnivoreRatio: living.length > 0 ? carnivoreCount / living.length : 0
    };
}

/**
 * Get predator-prey dynamics information
 * Returns Lotka-Volterra style metrics
 */
export function getPredatorPreyDynamics() {
    const living = state.agents.filter(a => a.alive);

    // Classify agents as predators or prey
    const predators = living.filter(a => (a.genome.metabolism.carnivory || 0) >= 0.3);
    const prey = living.filter(a => (a.genome.metabolism.carnivory || 0) < 0.3);

    // Get prey species diversity
    const preySpecies = new Set(prey.map(a => a.genome.species_marker));

    // Calculate predator-prey ratio (Lotka-Volterra parameter)
    const ratio = prey.length > 0 ? predators.length / prey.length : 0;

    // Get prey type abundance distribution for frequency-dependent selection
    const abundanceDistribution = [];
    for (const [species, count] of preyTypeAbundance.entries()) {
        abundanceDistribution.push({
            species,
            count,
            frequency: prey.length > 0 ? count / prey.length : 0
        });
    }
    abundanceDistribution.sort((a, b) => b.count - a.count);

    return {
        predatorCount: predators.length,
        preyCount: prey.length,
        predatorPreyRatio: ratio,
        preySpeciesCount: preySpecies.size,
        topPreyTypes: abundanceDistribution.slice(0, 5),
        // Simpson's diversity index for prey
        preyDiversity: calculateSimpsonsDiversity(prey)
    };
}

/**
 * Calculate Simpson's Diversity Index for prey species
 * 1 - Σ(p_i^2) where p_i is frequency of species i
 */
function calculateSimpsonsDiversity(agents) {
    if (agents.length === 0) return 0;

    const speciesCounts = new Map();
    for (const agent of agents) {
        const species = agent.genome.species_marker;
        speciesCounts.set(species, (speciesCounts.get(species) || 0) + 1);
    }

    let sumPiSquared = 0;
    const total = agents.length;

    for (const count of speciesCounts.values()) {
        const pi = count / total;
        sumPiSquared += pi * pi;
    }

    return 1 - sumPiSquared;  // Higher = more diverse
}

/**
 * Epistasis System
 *
 * Implements gene-gene interactions that create rugged fitness landscapes:
 * - Magnitude epistasis: One gene modifies the effect size of another
 * - Sign epistasis: One gene can reverse the effect of another
 * - Reciprocal sign epistasis: Fitness valleys between peaks
 *
 * This creates:
 * - Multiple local optima (different ways to be fit)
 * - Historical contingency (path-dependent evolution)
 * - Genetic incompatibilities (Dobzhansky-Muller)
 */

import { CONFIG } from '../config.js';
import { clamp } from '../utils/math.js';

// Epistatic interaction rules
// [trait1, trait2, interactionType, strength]
const EPISTATIC_PAIRS = [
    // TROPHIC SPECIALIZATION
    // Carnivory needs aggression to hunt successfully
    ['carnivory', 'aggression', 'synergistic', 0.5],

    // Decomposers don't benefit from carnivory (niche conflict)
    ['decomposer', 'carnivory', 'antagonistic', 0.4],

    // MORPHOLOGICAL CONSTRAINTS
    // Motors are only useful with enough structural support (nodes)
    ['motor_count', 'node_count', 'threshold', 0.4],

    // Large organisms need efficient metabolism
    ['node_count', 'efficiency', 'synergistic', 0.3],

    // BEHAVIORAL TRADE-OFFS
    // Can't be highly cooperative AND highly aggressive
    ['cooperation_willingness', 'aggression', 'antagonistic', 0.6],

    // Learning and plasticity work together
    ['learning_rate', 'plasticity_range', 'synergistic', 0.3],

    // METABOLIC CONSTRAINTS
    // High efficiency with high storage has diminishing returns (resource allocation)
    ['efficiency', 'storage_capacity', 'diminishing', 0.3],

    // Scavenging and decomposer are complementary
    ['scavenging', 'decomposer', 'synergistic', 0.3],

    // REPRODUCTIVE STRATEGIES
    // High clutch size conflicts with high offspring investment
    ['clutch_size', 'offspring_investment', 'antagonistic', 0.5],

    // Sexual reproduction benefits from choosiness
    ['sexual_tendency', 'mate_choosiness', 'synergistic', 0.25],
];

/**
 * Get normalized trait value (0-1) from genome
 */
function getTraitValue(genome, traitName) {
    switch (traitName) {
        // Metabolism traits
        case 'carnivory':
            return genome.metabolism.carnivory || 0;
        case 'scavenging':
            return genome.metabolism.scavenging || 0;
        case 'decomposer':
            return genome.metabolism.decomposer || 0;
        case 'efficiency':
            return genome.metabolism.efficiency;
        case 'storage_capacity':
            return (genome.metabolism.storage_capacity - 50) / 250;  // Normalize 50-300 to 0-1
        case 'sexual_tendency':
            return genome.metabolism.sexual_tendency || 0.3;

        // Life history traits
        case 'clutch_size':
            return (genome.metabolism.life_history?.clutch_size || 2) / 6;  // 1-6 -> 0-1
        case 'offspring_investment':
            return genome.metabolism.life_history?.offspring_investment || 0.4;

        // Structural traits
        case 'motor_count':
            return Math.min(1, genome.motors.length / 5);  // Cap at 5 motors
        case 'node_count':
            return genome.nodes.length / CONFIG.MAX_NODES;

        // Social traits
        case 'aggression':
            return genome.social.competition?.aggression || 0;
        case 'cooperation_willingness':
            return genome.social.cooperation_willingness || 0;
        case 'mate_choosiness':
            return genome.social.mating?.mate_choosiness || 0.3;

        // Learning/plasticity traits
        case 'learning_rate':
            return genome.social.learning?.learning_rate ?
                   genome.social.learning.learning_rate / 0.1 : 0.5;
        case 'plasticity_range':
            return genome.metabolism.plasticity?.plasticity_range || 0.3;

        default:
            return null;
    }
}

/**
 * Calculate epistatic fitness modifier
 * Returns a value that modifies base fitness (can be positive or negative)
 */
export function calculateEpistaticFitness(genome) {
    let modifier = 0;

    for (const [trait1, trait2, interactionType, strength] of EPISTATIC_PAIRS) {
        const val1 = getTraitValue(genome, trait1);
        const val2 = getTraitValue(genome, trait2);

        if (val1 === null || val2 === null) continue;

        switch (interactionType) {
            case 'synergistic':
                // Both high = bonus, both low = small penalty
                // Creates fitness peak when both traits are high
                // Epistatic effect: AB > A + B (super-additive)
                modifier += (val1 * val2 - 0.25) * strength;
                break;

            case 'antagonistic':
                // Both high = penalty (incompatible strategies)
                // One high, one low = optimal
                // Creates two alternative fitness peaks
                const product = val1 * val2;
                modifier -= product * strength;  // Penalty for having both

                // Bonus for specializing in one or the other
                if ((val1 > 0.6 && val2 < 0.3) || (val2 > 0.6 && val1 < 0.3)) {
                    modifier += strength * 0.3;  // Specialist bonus
                }
                break;

            case 'diminishing':
                // Increasing one trait reduces marginal benefit of other
                // Models resource allocation constraints
                const combined = val1 + val2;
                if (combined > 1.2) {
                    // Over-investment penalty
                    modifier -= (combined - 1.2) * strength;
                }
                break;

            case 'threshold':
                // trait1 only beneficial if trait2 exceeds threshold
                // E.g., motors are useless without enough nodes
                if (val1 > 0.3 && val2 < 0.3) {
                    // Penalty: high trait1 with insufficient trait2
                    modifier -= val1 * strength;
                } else if (val1 > 0.3 && val2 > 0.5) {
                    // Bonus: trait1 works well with adequate trait2
                    modifier += val1 * val2 * strength;
                }
                break;
        }
    }

    return modifier;
}

/**
 * Check for sign epistasis
 * Returns true if a mutation to traitName would have opposite fitness effect
 * in different genetic backgrounds
 */
export function hasSignEpistasis(genome, traitName, mutationDirection) {
    // Example: Increasing aggression
    if (traitName === 'aggression') {
        const carnivory = genome.metabolism.carnivory || 0;
        const cooperation = genome.social.cooperation_willingness || 0;

        if (mutationDirection > 0) {
            // Increasing aggression is:
            // - Beneficial with high carnivory (helps hunting)
            // - Deleterious with high cooperation (conflicts)
            return (carnivory > 0.5) !== (cooperation > 0.5);
        }
    }

    // Increasing motors
    if (traitName === 'motor_count') {
        const nodes = genome.nodes.length / CONFIG.MAX_NODES;
        if (mutationDirection > 0) {
            // More motors beneficial only with enough nodes
            // Sign depends on node count
            return nodes > 0.5;  // True if would be beneficial, false if deleterious
        }
    }

    return false;
}

/**
 * Calculate fitness landscape curvature
 * Returns estimate of how rugged the local fitness landscape is
 * High values = agent is near a fitness peak or valley
 */
export function getFitnessLandscapeCurvature(genome) {
    const baseFitness = calculateEpistaticFitness(genome);

    // Sample nearby genotypes by simulating small changes
    let varianceSum = 0;
    const sampleTraits = ['carnivory', 'aggression', 'efficiency', 'cooperation_willingness'];

    for (const trait of sampleTraits) {
        const val = getTraitValue(genome, trait);
        if (val === null) continue;

        // Estimate second derivative (curvature) by finite differences
        // f''(x) ≈ (f(x+h) - 2f(x) + f(x-h)) / h^2
        const h = 0.1;

        // Create modified genomes (conceptually - we just recalculate)
        const fitPlus = calculateEpistaticFitnessWithModification(genome, trait, val + h);
        const fitMinus = calculateEpistaticFitnessWithModification(genome, trait, val - h);

        const curvature = Math.abs(fitPlus - 2 * baseFitness + fitMinus) / (h * h);
        varianceSum += curvature;
    }

    return varianceSum / sampleTraits.length;
}

/**
 * Calculate epistatic fitness with a modified trait value
 * Used for fitness landscape analysis
 */
function calculateEpistaticFitnessWithModification(genome, traitName, newValue) {
    // Create virtual modification
    const originalValue = getTraitValue(genome, traitName);
    const delta = newValue - originalValue;

    // Recalculate epistatic interactions with modified value
    let modifier = 0;

    for (const [trait1, trait2, interactionType, strength] of EPISTATIC_PAIRS) {
        let val1 = getTraitValue(genome, trait1);
        let val2 = getTraitValue(genome, trait2);

        if (val1 === null || val2 === null) continue;

        // Apply modification
        if (trait1 === traitName) val1 = clamp(val1 + delta, 0, 1);
        if (trait2 === traitName) val2 = clamp(val2 + delta, 0, 1);

        switch (interactionType) {
            case 'synergistic':
                modifier += (val1 * val2 - 0.25) * strength;
                break;
            case 'antagonistic':
                modifier -= val1 * val2 * strength;
                if ((val1 > 0.6 && val2 < 0.3) || (val2 > 0.6 && val1 < 0.3)) {
                    modifier += strength * 0.3;
                }
                break;
            case 'diminishing':
                const combined = val1 + val2;
                if (combined > 1.2) modifier -= (combined - 1.2) * strength;
                break;
            case 'threshold':
                if (val1 > 0.3 && val2 < 0.3) modifier -= val1 * strength;
                else if (val1 > 0.3 && val2 > 0.5) modifier += val1 * val2 * strength;
                break;
        }
    }

    return modifier;
}

/**
 * Identify which fitness peak an agent is on
 * Returns a characterization of the agent's strategy
 */
export function identifyFitnessPeak(genome) {
    const carnivory = genome.metabolism.carnivory || 0;
    const cooperation = genome.social.cooperation_willingness || 0;
    const decomposer = genome.metabolism.decomposer || 0;
    const aggression = genome.social.competition?.aggression || 0;

    // Identify dominant strategy (fitness peak)
    if (carnivory > 0.5 && aggression > 0.4) {
        return 'apex_predator';  // Peak: high carnivory + high aggression
    } else if (cooperation > 0.6 && aggression < 0.3) {
        return 'cooperative';     // Peak: high cooperation + low aggression
    } else if (decomposer > 0.4 && carnivory < 0.3) {
        return 'decomposer';      // Peak: decomposer specialist
    } else if (carnivory < 0.2 && decomposer < 0.2) {
        return 'herbivore';       // Peak: primary producer/herbivore
    } else {
        return 'generalist';      // Intermediate (valley or saddle)
    }
}

/**
 * Get summary statistics for epistasis in population
 */
export function getEpistasisStats(agents) {
    const living = agents.filter(a => a.alive);
    if (living.length === 0) return null;

    let totalEpistasis = 0;
    const peaks = new Map();

    for (const agent of living) {
        const epistasis = calculateEpistaticFitness(agent.genome);
        totalEpistasis += epistasis;

        const peak = identifyFitnessPeak(agent.genome);
        peaks.set(peak, (peaks.get(peak) || 0) + 1);
    }

    return {
        avgEpistaticFitness: totalEpistasis / living.length,
        peakDistribution: Object.fromEntries(peaks),
        dominantPeak: [...peaks.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    };
}

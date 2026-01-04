/**
 * Population Genetics System
 *
 * Tracks population-level genetic dynamics:
 * - Effective population size (Ne) - accounts for variance in reproductive success
 * - Genetic diversity (expected heterozygosity)
 * - Inbreeding coefficient (F)
 * - Founder effects and bottleneck detection
 * - Wright's Fst (genetic differentiation between subpopulations)
 *
 * These metrics affect evolutionary dynamics at the population level,
 * separate from individual-level selection.
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { neutralGeneticDistance } from '../core/genome.js';

// Population genetics tracking per species
const speciesGenetics = new Map();  // species_marker -> genetics object

// Historical population sizes for bottleneck detection
const populationHistory = new Map();  // species_marker -> size history array
const HISTORY_LENGTH = 100;

/**
 * Initialize or get population genetics for a species
 */
function getSpeciesGenetics(speciesMarker) {
    if (!speciesGenetics.has(speciesMarker)) {
        speciesGenetics.set(speciesMarker, {
            effective_size: 0,
            census_size: 0,
            genetic_diversity: 1.0,
            inbreeding_coefficient: 0,
            drift_rate: 0,
            bottleneck_severity: 0,
            historical_max_size: 0,
            founding_tick: state.tick,
            last_updated: 0,
            offspring_variance: 0
        });
    }
    return speciesGenetics.get(speciesMarker);
}

/**
 * Calculate effective population size (Ne)
 * Ne is usually smaller than census size due to:
 * - Variance in offspring number
 * - Unequal sex ratio (if applicable)
 * - Population fluctuations
 */
function calculateEffectiveSize(speciesMembers) {
    const N = speciesMembers.length;
    if (N <= 1) return N;

    // Get offspring counts (use energy as proxy for reproductive success)
    // In a real implementation, would track actual offspring
    const offspringCounts = speciesMembers.map(agent => {
        // Estimate offspring potential from energy and age
        const energyFactor = agent.energy / agent.genome.metabolism.storage_capacity;
        const ageFactor = agent.age > 50 ? 1 : 0;  // Mature individuals
        return energyFactor * ageFactor * 2;  // Average ~1 offspring equivalent
    });

    // Calculate variance in offspring number
    const mean = offspringCounts.reduce((a, b) => a + b, 0) / N;
    const variance = offspringCounts.reduce((sum, k) => {
        return sum + Math.pow(k - mean, 2);
    }, 0) / N;

    if (mean === 0) return N;

    // Wright's formula: Ne = (N * k - 1) / (k - 1 + Vk/k)
    // Where k = mean offspring, Vk = variance in offspring
    const k = mean;
    const Vk = variance;

    // Avoid division by zero
    const denominator = k - 1 + (Vk / k);
    if (denominator <= 0) return N;

    const Ne = (N * k - 1) / denominator;

    return Math.max(1, Math.min(N, Ne));  // Ne can't exceed census size
}

/**
 * Calculate genetic diversity (expected heterozygosity)
 * Based on neutral marker variation within species
 */
function calculateGeneticDiversity(speciesMembers) {
    if (speciesMembers.length < 2) return 0;

    // Sample pairs and calculate average genetic distance
    const sampleSize = Math.min(20, speciesMembers.length);
    let totalDistance = 0;
    let comparisons = 0;

    for (let i = 0; i < sampleSize; i++) {
        const agentA = speciesMembers[Math.floor(Math.random() * speciesMembers.length)];
        const agentB = speciesMembers[Math.floor(Math.random() * speciesMembers.length)];

        if (agentA !== agentB) {
            totalDistance += neutralGeneticDistance(agentA.genome, agentB.genome);
            comparisons++;
        }
    }

    if (comparisons === 0) return 0;

    // Normalize to 0-1 scale
    return Math.min(1, totalDistance / comparisons);
}

/**
 * Detect population bottleneck
 * A bottleneck is a severe reduction from historical maximum
 */
function detectBottleneck(speciesMarker, currentSize) {
    if (!populationHistory.has(speciesMarker)) {
        populationHistory.set(speciesMarker, []);
    }

    const history = populationHistory.get(speciesMarker);
    history.push(currentSize);

    // Trim history
    while (history.length > HISTORY_LENGTH) {
        history.shift();
    }

    if (history.length < 10) return 0;

    // Calculate historical maximum
    const historicalMax = Math.max(...history);
    const recentMin = Math.min(...history.slice(-10));

    if (historicalMax === 0) return 0;

    // Bottleneck severity: how much has population dropped from peak
    const severity = 1 - (recentMin / historicalMax);

    return Math.max(0, severity);
}

/**
 * Apply drift effects based on effective size
 * Small populations lose diversity faster
 */
function applyDriftEffects(genetics, dt) {
    const Ne = genetics.effective_size;
    if (Ne <= 0) return;

    // Genetic diversity decays at rate 1/(2Ne) per generation
    // Assuming ~100 ticks per generation
    const ticksPerGeneration = 100;
    const diversityLoss = (1 / (2 * Ne)) * (dt / ticksPerGeneration);

    genetics.genetic_diversity = Math.max(0, genetics.genetic_diversity * (1 - diversityLoss));

    // Inbreeding accumulates: dF = 1/(2Ne)
    const inbreedingGain = (1 / (2 * Ne)) * (dt / ticksPerGeneration);
    const currentF = genetics.inbreeding_coefficient;

    // F approaches 1 asymptotically: F_new = F + (1-F) * dF
    genetics.inbreeding_coefficient = currentF + (1 - currentF) * inbreedingGain;

    // Drift rate affects fixation probability of new mutations
    genetics.drift_rate = 1 / (4 * Ne);
}

/**
 * Update population genetics for all species
 * Call periodically from main game loop
 */
export function updatePopulationGenetics(agents, dt) {
    // Group agents by species
    const speciesGroups = new Map();

    for (const agent of agents) {
        if (!agent.alive) continue;

        const marker = agent.genome.species_marker;
        if (!speciesGroups.has(marker)) {
            speciesGroups.set(marker, []);
        }
        speciesGroups.get(marker).push(agent);
    }

    // Update genetics for each species
    for (const [marker, members] of speciesGroups.entries()) {
        const genetics = getSpeciesGenetics(marker);

        // Census size
        genetics.census_size = members.length;

        // Update historical max
        if (members.length > genetics.historical_max_size) {
            genetics.historical_max_size = members.length;
        }

        // Effective population size
        genetics.effective_size = calculateEffectiveSize(members);

        // Genetic diversity (less frequent calculation due to cost)
        if (state.tick % 50 === 0) {
            const newDiversity = calculateGeneticDiversity(members);
            // Smooth transition
            genetics.genetic_diversity = genetics.genetic_diversity * 0.9 + newDiversity * 0.1;
        }

        // Detect bottleneck
        genetics.bottleneck_severity = detectBottleneck(marker, members.length);

        // Apply drift effects
        applyDriftEffects(genetics, dt);

        genetics.last_updated = state.tick;
    }

    // Clean up extinct species (after grace period)
    for (const [marker, genetics] of speciesGenetics.entries()) {
        if (!speciesGroups.has(marker) && state.tick - genetics.last_updated > 200) {
            speciesGenetics.delete(marker);
            populationHistory.delete(marker);
        }
    }
}

/**
 * Get inbreeding coefficient for an agent's species
 * Used to calculate inbreeding depression
 */
export function getSpeciesInbreeding(speciesMarker) {
    const genetics = speciesGenetics.get(speciesMarker);
    if (!genetics) return 0;

    return genetics.inbreeding_coefficient;
}

/**
 * Get effective population size for a species
 */
export function getEffectivePopulationSize(speciesMarker) {
    const genetics = speciesGenetics.get(speciesMarker);
    if (!genetics) return 0;

    return genetics.effective_size;
}

/**
 * Check if species is experiencing a bottleneck
 * Returns severity 0-1 (0 = no bottleneck, 1 = severe)
 */
export function getBottleneckSeverity(speciesMarker) {
    const genetics = speciesGenetics.get(speciesMarker);
    if (!genetics) return 0;

    return genetics.bottleneck_severity;
}

/**
 * Get genetic diversity for a species (0-1)
 */
export function getGeneticDiversity(speciesMarker) {
    const genetics = speciesGenetics.get(speciesMarker);
    if (!genetics) return 1.0;

    return genetics.genetic_diversity;
}

/**
 * Calculate mutation fixation probability
 * In small populations, even deleterious mutations can fix by drift
 * In large populations, selection dominates
 *
 * Kimura's formula: P(fix) = (1 - e^(-2s)) / (1 - e^(-4Nes))
 * For neutral mutations (s=0): P(fix) = 1/(2N)
 */
export function getMutationFixationProbability(speciesMarker, selectionCoefficient = 0) {
    const genetics = speciesGenetics.get(speciesMarker);
    const Ne = genetics?.effective_size || 50;

    if (selectionCoefficient === 0) {
        // Neutral mutation
        return 1 / (2 * Ne);
    }

    // Kimura's formula for selected mutation
    const s = selectionCoefficient;
    const Nes = Ne * s;

    if (Math.abs(Nes) < 0.01) {
        // Effectively neutral (|Nes| << 1)
        return 1 / (2 * Ne);
    }

    const numerator = 1 - Math.exp(-2 * s);
    const denominator = 1 - Math.exp(-4 * Nes);

    if (denominator === 0) return 0;

    return Math.max(0, Math.min(1, numerator / denominator));
}

/**
 * Adjust fitness based on population-level effects
 * - Small Ne increases drift, reducing selection efficiency
 * - High inbreeding increases depression
 * - Bottlenecks can reduce fitness
 */
export function applyPopulationLevelEffects(agent) {
    const marker = agent.genome.species_marker;
    const genetics = speciesGenetics.get(marker);

    if (!genetics) return 1.0;

    let modifier = 1.0;

    // Inbreeding depression (uses genetic load from genome)
    if (genetics.inbreeding_coefficient > 0 && agent.genome.genetic_load) {
        const load = agent.genome.genetic_load.lethal_equivalents || 0;
        const F = genetics.inbreeding_coefficient;

        // Inbreeding exposes recessive load
        const exposedLoad = load * F * 2;  // Homozygosity multiplier
        modifier *= Math.exp(-exposedLoad);
    }

    // Bottleneck stress
    if (genetics.bottleneck_severity > 0.5) {
        // Severe bottleneck causes population-wide stress
        modifier *= 1 - (genetics.bottleneck_severity - 0.5) * 0.2;
    }

    // Loss of genetic diversity reduces adaptability (long-term effect)
    if (genetics.genetic_diversity < 0.3) {
        modifier *= 0.9 + genetics.genetic_diversity * 0.33;
    }

    return Math.max(0.1, modifier);
}

/**
 * Get population genetics summary statistics
 */
export function getPopulationGeneticsStats() {
    const allGenetics = Array.from(speciesGenetics.entries())
        .map(([marker, g]) => ({
            species: marker,
            ...g
        }))
        .sort((a, b) => b.census_size - a.census_size);

    const totalNe = allGenetics.reduce((sum, g) => sum + g.effective_size, 0);
    const avgDiversity = allGenetics.length > 0
        ? allGenetics.reduce((sum, g) => sum + g.genetic_diversity, 0) / allGenetics.length
        : 0;
    const avgInbreeding = allGenetics.length > 0
        ? allGenetics.reduce((sum, g) => sum + g.inbreeding_coefficient, 0) / allGenetics.length
        : 0;

    const bottleneckedSpecies = allGenetics.filter(g => g.bottleneck_severity > 0.3);

    return {
        speciesCount: allGenetics.length,
        totalEffectiveSize: totalNe,
        avgGeneticDiversity: avgDiversity,
        avgInbreeding: avgInbreeding,
        bottleneckedSpecies: bottleneckedSpecies.length,
        topSpecies: allGenetics.slice(0, 5).map(g => ({
            species: g.species,
            Ne: Math.round(g.effective_size),
            N: g.census_size,
            diversity: g.genetic_diversity.toFixed(3),
            F: g.inbreeding_coefficient.toFixed(3),
            bottleneck: g.bottleneck_severity.toFixed(2)
        }))
    };
}

/**
 * Record a founding event (new population from few individuals)
 * Reduces genetic diversity appropriately
 */
export function recordFoundingEvent(speciesMarker, founderCount) {
    const genetics = getSpeciesGenetics(speciesMarker);

    // Founder effect: diversity = 1 - 1/(2N) approximately
    // With few founders, diversity is significantly reduced
    genetics.genetic_diversity = Math.max(0.1, 1 - 1 / (2 * founderCount));

    // Founders increase inbreeding
    genetics.inbreeding_coefficient = 1 / (2 * founderCount);

    genetics.founding_tick = state.tick;
    genetics.historical_max_size = founderCount;
}

/**
 * Calculate genetic differentiation (Fst) between two species/populations
 * Returns 0-1 (0 = no differentiation, 1 = complete differentiation)
 */
export function calculateFst(speciesA, speciesB, agents) {
    const membersA = agents.filter(a => a.alive && a.genome.species_marker === speciesA);
    const membersB = agents.filter(a => a.alive && a.genome.species_marker === speciesB);

    if (membersA.length < 2 || membersB.length < 2) return 0;

    // Calculate within-population diversity
    const diversityA = calculateGeneticDiversity(membersA);
    const diversityB = calculateGeneticDiversity(membersB);
    const withinDiversity = (diversityA + diversityB) / 2;

    // Calculate between-population diversity
    let betweenDistance = 0;
    const sampleSize = Math.min(10, membersA.length, membersB.length);

    for (let i = 0; i < sampleSize; i++) {
        const agentA = membersA[Math.floor(Math.random() * membersA.length)];
        const agentB = membersB[Math.floor(Math.random() * membersB.length)];
        betweenDistance += neutralGeneticDistance(agentA.genome, agentB.genome);
    }
    const totalDiversity = betweenDistance / sampleSize;

    if (totalDiversity === 0) return 0;

    // Fst = (Ht - Hs) / Ht
    const Fst = (totalDiversity - withinDiversity) / totalDiversity;

    return Math.max(0, Math.min(1, Fst));
}

// === CLONAL INTERFERENCE AND SELECTIVE SWEEPS ===
// In asexual/partially sexual populations, beneficial mutations compete
// Selective sweeps reduce linked diversity (hitchhiking effect)

// Track beneficial mutations per species
const beneficialMutations = new Map();  // species_marker -> array of mutations

/**
 * Record a beneficial mutation arising in a lineage
 */
export function recordBeneficialMutation(speciesMarker, lineageId, selectionCoefficient) {
    if (!beneficialMutations.has(speciesMarker)) {
        beneficialMutations.set(speciesMarker, []);
    }

    const genetics = speciesGenetics.get(speciesMarker);
    const initialFreq = genetics ? 1 / genetics.census_size : 0.01;

    beneficialMutations.get(speciesMarker).push({
        lineage_id: lineageId,
        selection_coefficient: selectionCoefficient,
        frequency: initialFreq,
        origin_tick: state.tick,
        status: 'spreading'  // 'spreading', 'fixed', 'lost'
    });
}

/**
 * Update beneficial mutation frequencies
 * Mutations spread according to selection coefficient, modified by clonal interference
 */
export function updateBeneficialMutations(dt) {
    for (const [speciesMarker, mutations] of beneficialMutations.entries()) {
        const genetics = speciesGenetics.get(speciesMarker);
        if (!genetics) continue;

        const Ne = genetics.effective_size || 50;

        // Calculate clonal interference intensity
        const activeMutations = mutations.filter(m => m.status === 'spreading');
        const interferenceIntensity = Math.min(1, activeMutations.length / 5);

        for (const mutation of activeMutations) {
            // Selection drives frequency change
            // In diploids: dp/dt = s * p * (1-p) * (p + h*(1-2p))
            // Simplified for haploid/asexual: dp/dt = s * p * (1-p)
            const p = mutation.frequency;
            const s = mutation.selection_coefficient;

            // Clonal interference reduces effective selection
            // Multiple competing mutations slow each other's spread
            const effectiveS = s * (1 - interferenceIntensity * 0.5);

            // Frequency change (scaled by dt)
            const dp = effectiveS * p * (1 - p) * dt * 0.01;

            // Add drift component for small frequencies
            const driftMagnitude = Math.sqrt(p * (1 - p) / (2 * Ne)) * 0.1;
            const drift = (Math.random() - 0.5) * driftMagnitude * dt;

            mutation.frequency = Math.max(0, Math.min(1, p + dp + drift));

            // Check for fixation or loss
            if (mutation.frequency >= 0.99) {
                mutation.status = 'fixed';
                mutation.frequency = 1.0;
                // Trigger selective sweep effect
                processSelectiveSweep(speciesMarker, s);
            } else if (mutation.frequency <= 0.01) {
                mutation.status = 'lost';
                mutation.frequency = 0;
            }
        }

        // Clean up old mutations
        beneficialMutations.set(speciesMarker,
            mutations.filter(m => m.status === 'spreading' ||
                (state.tick - m.origin_tick < 500)));
    }
}

/**
 * Calculate clonal interference intensity for a species
 * High interference = multiple beneficial mutations competing
 */
export function getClonalInterference(speciesMarker) {
    const mutations = beneficialMutations.get(speciesMarker) || [];
    const activeMutations = mutations.filter(m =>
        m.status === 'spreading' &&
        m.frequency > 0.05 &&
        m.frequency < 0.95
    );

    // Interference is high when multiple beneficial mutations compete
    return Math.min(1, activeMutations.length / 3);
}

/**
 * Get adaptation penalty for asexual reproduction due to clonal interference
 * Sex breaks up linkage, allowing beneficial mutations to combine
 */
export function getAsexualInterferencePenalty(speciesMarker) {
    const interference = getClonalInterference(speciesMarker);

    // High interference = beneficial mutations take longer to fix in asexual pops
    // Returns multiplier on effective selection coefficient (0.5 = half as effective)
    return 1 / (1 + interference * 2);
}

/**
 * Process a selective sweep when a beneficial mutation fixes
 * Reduces diversity at linked neutral markers (hitchhiking)
 */
function processSelectiveSweep(speciesMarker, sweepStrength) {
    const genetics = speciesGenetics.get(speciesMarker);
    if (!genetics) return;

    // Sweep strength determines diversity reduction
    // Strong sweeps (high s) affect more of the genome
    const diversityReduction = Math.min(0.5, sweepStrength * 2);

    genetics.genetic_diversity *= (1 - diversityReduction);

    // Sweeps also temporarily reduce Ne (only sweeping lineage survives)
    const NeReduction = Math.min(0.3, sweepStrength);
    genetics.effective_size *= (1 - NeReduction);

    // Record sweep event
    if (!genetics.sweep_history) genetics.sweep_history = [];
    genetics.sweep_history.push({
        tick: state.tick,
        strength: sweepStrength,
        diversity_lost: diversityReduction
    });

    // Trim history
    while (genetics.sweep_history.length > 10) {
        genetics.sweep_history.shift();
    }
}

/**
 * Get statistics on clonal interference and sweeps
 */
export function getClonalInterferenceStats() {
    const stats = [];

    for (const [speciesMarker, mutations] of beneficialMutations.entries()) {
        const active = mutations.filter(m => m.status === 'spreading');
        const fixed = mutations.filter(m => m.status === 'fixed');
        const lost = mutations.filter(m => m.status === 'lost');

        stats.push({
            species: speciesMarker,
            activeMutations: active.length,
            fixedMutations: fixed.length,
            lostMutations: lost.length,
            interferenceLevel: getClonalInterference(speciesMarker),
            avgSelectionCoef: active.length > 0
                ? active.reduce((sum, m) => sum + m.selection_coefficient, 0) / active.length
                : 0
        });
    }

    return stats;
}

/**
 * Sexual reproduction advantage from breaking clonal interference
 * Returns bonus to fitness for sexual reproducers
 */
export function getSexualRecombinationAdvantage(speciesMarker) {
    const interference = getClonalInterference(speciesMarker);

    // Sexual reproduction can combine beneficial mutations from different lineages
    // This advantage scales with interference level
    return interference * 0.1;  // Up to 10% advantage when interference is high
}

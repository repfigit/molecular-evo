/**
 * Coevolutionary Dynamics System
 *
 * Implements Red Queen dynamics and coevolutionary arms races:
 * - Tracks antagonistic interactions (predator-prey, host-parasite)
 * - Species that suffer from antagonists face increased selection pressure
 * - High coevolutionary pressure favors sexual reproduction
 * - Creates perpetual evolutionary change even in stable environments
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';

// Coevolutionary pressure tracking per species
const coevolutionaryPressure = new Map();  // species_marker -> pressure object

// Recent interaction events for tracking arms race dynamics
const recentInteractions = [];
const MAX_INTERACTION_HISTORY = 500;

/**
 * Record a successful antagonistic interaction
 * This increases selection pressure on the victim species
 */
export function recordAntagonisticSuccess(victimSpecies, antagonistType, antagonistSpecies, severity = 1.0) {
    let pressure = coevolutionaryPressure.get(victimSpecies);
    if (!pressure) {
        pressure = {
            predation_pressure: 0,
            parasite_pressure: 0,
            competition_pressure: 0,
            last_event_tick: 0,
            antagonist_species: new Set()
        };
        coevolutionaryPressure.set(victimSpecies, pressure);
    }

    // Update pressure based on interaction type
    switch (antagonistType) {
        case 'predation':
            pressure.predation_pressure += 0.1 * severity;
            break;
        case 'parasite':
            pressure.parasite_pressure += 0.15 * severity;  // Parasites create strong pressure
            break;
        case 'competition':
            pressure.competition_pressure += 0.05 * severity;
            break;
    }

    pressure.last_event_tick = state.tick;
    pressure.antagonist_species.add(antagonistSpecies);

    // Record interaction for history
    recentInteractions.push({
        tick: state.tick,
        victim: victimSpecies,
        antagonist: antagonistSpecies,
        type: antagonistType,
        severity
    });

    // Trim history
    while (recentInteractions.length > MAX_INTERACTION_HISTORY) {
        recentInteractions.shift();
    }
}

/**
 * Get current coevolutionary pressure for a species
 * Pressure decays over time as counter-adaptations spread
 */
export function getCoevolutionaryPressure(speciesMarker) {
    const pressure = coevolutionaryPressure.get(speciesMarker);
    if (!pressure) return 0;

    // Pressure decays exponentially over time
    const ticksSinceEvent = state.tick - pressure.last_event_tick;
    const decayFactor = Math.exp(-ticksSinceEvent * 0.001);  // Half-life ~700 ticks

    const totalPressure = (
        pressure.predation_pressure +
        pressure.parasite_pressure * 1.5 +  // Parasites weighted more (Red Queen)
        pressure.competition_pressure * 0.5
    ) * decayFactor;

    return Math.min(2.0, totalPressure);  // Cap at 2.0
}

/**
 * Adjust sexual reproduction tendency based on coevolutionary pressure
 * RED QUEEN HYPOTHESIS: High parasite pressure favors sexual reproduction
 * because recombination generates novel genotypes parasites haven't adapted to
 */
export function getRedQueenSexBonus(agent) {
    const pressure = getCoevolutionaryPressure(agent.genome.species_marker);

    // High pressure increases sexual reproduction tendency
    // At pressure = 1.0, add 0.2 to sexual tendency
    // At pressure = 2.0, add 0.4 to sexual tendency
    return pressure * 0.2;
}

/**
 * Update coevolutionary dynamics
 * Called periodically to decay pressures and track arms race metrics
 */
export function updateCoevolution(dt) {
    // Decay all pressures over time
    for (const [species, pressure] of coevolutionaryPressure.entries()) {
        const decayRate = 0.001 * dt;
        pressure.predation_pressure *= (1 - decayRate);
        pressure.parasite_pressure *= (1 - decayRate);
        pressure.competition_pressure *= (1 - decayRate);

        // Remove species with negligible pressure
        if (pressure.predation_pressure < 0.01 &&
            pressure.parasite_pressure < 0.01 &&
            pressure.competition_pressure < 0.01) {
            coevolutionaryPressure.delete(species);
        }
    }
}

/**
 * Calculate arms race escalation index
 * Measures how intense the coevolutionary dynamics are
 */
export function getArmsRaceIntensity() {
    if (recentInteractions.length < 10) return 0;

    // Count recent interactions per species pair
    const pairCounts = new Map();
    const recentWindow = 200;  // Last 200 ticks

    for (const interaction of recentInteractions) {
        if (state.tick - interaction.tick > recentWindow) continue;

        const pairKey = `${interaction.victim}->${interaction.antagonist}`;
        pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
    }

    // High counts in specific pairs indicate active arms races
    const counts = Array.from(pairCounts.values());
    if (counts.length === 0) return 0;

    const maxCount = Math.max(...counts);
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;

    // Intensity is high when there are focused interactions (specific predator-prey pairs)
    return Math.min(1.0, (maxCount / 10) * (avgCount / 5));
}

/**
 * Get coevolution statistics
 */
export function getCoevolutionStats() {
    const speciesUnderPressure = Array.from(coevolutionaryPressure.entries())
        .filter(([_, p]) => getCoevolutionaryPressure(_) > 0.1)
        .map(([species, pressure]) => ({
            species,
            totalPressure: getCoevolutionaryPressure(species),
            predation: pressure.predation_pressure,
            parasite: pressure.parasite_pressure,
            antagonistCount: pressure.antagonist_species.size
        }))
        .sort((a, b) => b.totalPressure - a.totalPressure);

    return {
        speciesUnderPressure: speciesUnderPressure.slice(0, 5),
        armsRaceIntensity: getArmsRaceIntensity(),
        totalInteractions: recentInteractions.length,
        avgPressure: speciesUnderPressure.length > 0 ?
            speciesUnderPressure.reduce((sum, s) => sum + s.totalPressure, 0) / speciesUnderPressure.length : 0
    };
}

/**
 * Hook to call when predation occurs
 */
export function onPredationEvent(predatorSpecies, preySpecies, success) {
    if (success) {
        recordAntagonisticSuccess(preySpecies, 'predation', predatorSpecies, 1.0);
    } else {
        // Failed predation still creates some pressure
        recordAntagonisticSuccess(preySpecies, 'predation', predatorSpecies, 0.3);
    }
}

/**
 * Hook to call when viral infection occurs
 */
export function onParasiteEvent(hostSpecies, parasiteStrain, severity) {
    recordAntagonisticSuccess(hostSpecies, 'parasite', `virus_${parasiteStrain}`, severity);
}

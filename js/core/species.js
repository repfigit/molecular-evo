/**
 * Species Tracking System
 *
 * Tracks species, their characteristics, and evolutionary relationships.
 * Species are determined by genetic similarity (species marker + genome distance).
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { geneticDistance, isSameSpecies } from './genome.js';
import { numberToColor } from '../utils/math.js';

/**
 * Species data structure
 */
export function createSpeciesData(marker, representativeAgent) {
    return {
        marker,
        color: numberToColor(marker),
        count: 1,
        totalEnergy: representativeAgent?.energy || 0,
        totalFitness: representativeAgent?.fitness || 0,
        totalAge: representativeAgent?.age || 0,
        avgEnergy: representativeAgent?.energy || 0,
        avgFitness: representativeAgent?.fitness || 0,
        avgAge: representativeAgent?.age || 0,
        firstSeen: state.tick,
        lastSeen: state.tick,
        peakPopulation: 1,
        representative: representativeAgent?.genome || null,
        extinct: false
    };
}

/**
 * Update species tracking from current population
 */
export function updateSpeciesTracking(agents = state.agents) {
    const speciesMap = state.speciesMap;
    const currentMarkers = new Set();

    // Reset counts
    for (const species of speciesMap.values()) {
        species.count = 0;
        species.totalEnergy = 0;
        species.totalFitness = 0;
        species.totalAge = 0;
    }

    // Count agents per species
    for (const agent of agents) {
        if (!agent.alive) continue;

        const marker = agent.genome.species_marker;
        currentMarkers.add(marker);

        if (!speciesMap.has(marker)) {
            // New species discovered
            speciesMap.set(marker, createSpeciesData(marker, agent));
            state.speciesColors.set(marker, numberToColor(marker));

            // Log speciation event
            if (CONFIG.DEBUG_LOG_EVENTS) {
                console.log(`[Species] New species ${marker} discovered at tick ${state.tick}`);
            }
        }

        const species = speciesMap.get(marker);
        species.count++;
        species.totalEnergy += agent.energy;
        species.totalFitness += agent.fitness;
        species.totalAge += agent.age;
        species.lastSeen = state.tick;

        if (species.count > species.peakPopulation) {
            species.peakPopulation = species.count;
        }

        // Update representative if this is a better specimen
        if (!species.representative || agent.fitness > species.avgFitness) {
            species.representative = agent.genome;
        }
    }

    // Calculate averages and mark extinctions
    for (const [marker, species] of speciesMap) {
        if (species.count > 0) {
            species.avgEnergy = species.totalEnergy / species.count;
            species.avgFitness = species.totalFitness / species.count;
            species.avgAge = species.totalAge / species.count;
            species.extinct = false;
        } else if (!species.extinct && currentMarkers.size > 0) {
            // Species went extinct
            species.extinct = true;

            if (CONFIG.DEBUG_LOG_EVENTS) {
                console.log(`[Species] Species ${marker} went extinct at tick ${state.tick}`);
            }
        }
    }
}

/**
 * Get color for a species marker
 */
export function getSpeciesColor(marker) {
    if (!state.speciesColors.has(marker)) {
        state.speciesColors.set(marker, numberToColor(marker));
    }
    return state.speciesColors.get(marker);
}

/**
 * Get all living species
 */
export function getLivingSpecies() {
    const living = [];

    for (const [marker, species] of state.speciesMap) {
        if (!species.extinct && species.count > 0) {
            living.push(species);
        }
    }

    return living;
}

/**
 * Get extinct species
 */
export function getExtinctSpecies() {
    const extinct = [];

    for (const species of state.speciesMap.values()) {
        if (species.extinct) {
            extinct.push(species);
        }
    }

    return extinct;
}

/**
 * Get species sorted by population
 */
export function getSpeciesByPopulation() {
    return getLivingSpecies().sort((a, b) => b.count - a.count);
}

/**
 * Get species sorted by fitness
 */
export function getSpeciesByFitness() {
    return getLivingSpecies().sort((a, b) => b.avgFitness - a.avgFitness);
}

/**
 * Get dominant species
 */
export function getDominantSpecies() {
    const sorted = getSpeciesByPopulation();
    return sorted.length > 0 ? sorted[0] : null;
}

/**
 * Get species info for display
 */
export function getSpeciesInfo(marker) {
    return state.speciesMap.get(marker) || null;
}

/**
 * Get species count
 */
export function getSpeciesCount() {
    let count = 0;
    for (const species of state.speciesMap.values()) {
        if (!species.extinct && species.count > 0) {
            count++;
        }
    }
    return count;
}

/**
 * Get species distribution as percentages
 */
export function getSpeciesPercentages() {
    const living = getLivingSpecies();
    const total = living.reduce((sum, s) => sum + s.count, 0);

    if (total === 0) return [];

    return living.map(s => ({
        marker: s.marker,
        color: s.color,
        count: s.count,
        percentage: (s.count / total) * 100
    })).sort((a, b) => b.percentage - a.percentage);
}

/**
 * Cluster agents into species based on genetic distance
 * This recalculates species markers for all agents
 */
export function reclusterSpecies(agents = state.agents) {
    const living = agents.filter(a => a.alive);
    if (living.length === 0) return;

    // Simple clustering: agents within threshold distance share species
    const clusters = [];
    const assigned = new Set();

    for (const agent of living) {
        if (assigned.has(agent.id)) continue;

        // Start a new cluster
        const cluster = [agent];
        assigned.add(agent.id);

        // Find all agents close enough to join this cluster
        for (const other of living) {
            if (assigned.has(other.id)) continue;

            // Check distance to any cluster member
            for (const member of cluster) {
                if (isSameSpecies(member.genome, other.genome)) {
                    cluster.push(other);
                    assigned.add(other.id);
                    break;
                }
            }
        }

        clusters.push(cluster);
    }

    // Assign species markers based on clusters
    for (const cluster of clusters) {
        // Use the species marker of the oldest/most fit member
        let bestMember = cluster[0];
        for (const member of cluster) {
            if (member.fitness > bestMember.fitness) {
                bestMember = member;
            }
        }

        const marker = bestMember.genome.species_marker;

        for (const member of cluster) {
            member.genome.species_marker = marker;
        }
    }

    // Update tracking
    updateSpeciesTracking(agents);
}

/**
 * Calculate average genetic distance within a species
 */
export function getIntraSpeciesDistance(marker, agents = state.agents) {
    const members = agents.filter(a =>
        a.alive && a.genome.species_marker === marker
    );

    if (members.length < 2) return 0;

    let totalDistance = 0;
    let pairs = 0;

    for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
            totalDistance += geneticDistance(members[i].genome, members[j].genome);
            pairs++;
        }
    }

    return pairs > 0 ? totalDistance / pairs : 0;
}

/**
 * Calculate genetic distance between two species
 */
export function getInterSpeciesDistance(markerA, markerB, agents = state.agents) {
    const speciesA = state.speciesMap.get(markerA);
    const speciesB = state.speciesMap.get(markerB);

    if (!speciesA?.representative || !speciesB?.representative) {
        return Infinity;
    }

    return geneticDistance(speciesA.representative, speciesB.representative);
}

/**
 * Get phylogenetic relationships (simplified)
 * Returns a list of species with their nearest relatives
 */
export function getPhylogeny() {
    const living = getLivingSpecies();
    const relationships = [];

    for (const species of living) {
        let nearestMarker = null;
        let nearestDistance = Infinity;

        for (const other of living) {
            if (other.marker === species.marker) continue;

            if (species.representative && other.representative) {
                const dist = geneticDistance(species.representative, other.representative);
                if (dist < nearestDistance) {
                    nearestDistance = dist;
                    nearestMarker = other.marker;
                }
            }
        }

        relationships.push({
            marker: species.marker,
            color: species.color,
            count: species.count,
            nearestRelative: nearestMarker,
            relativeDistance: nearestDistance
        });
    }

    return relationships;
}

/**
 * Check if a species is endangered (low population)
 */
export function isEndangered(marker, threshold = 5) {
    const species = state.speciesMap.get(marker);
    return species && !species.extinct && species.count > 0 && species.count <= threshold;
}

/**
 * Get endangered species
 */
export function getEndangeredSpecies(threshold = 5) {
    return getLivingSpecies().filter(s => s.count <= threshold);
}

/**
 * Get species history (for timeline)
 */
export function getSpeciesHistory() {
    const history = [];

    for (const species of state.speciesMap.values()) {
        history.push({
            marker: species.marker,
            color: species.color,
            firstSeen: species.firstSeen,
            lastSeen: species.lastSeen,
            peakPopulation: species.peakPopulation,
            extinct: species.extinct,
            lifespan: species.lastSeen - species.firstSeen
        });
    }

    return history.sort((a, b) => a.firstSeen - b.firstSeen);
}

/**
 * Clear species tracking data
 */
export function clearSpeciesTracking() {
    state.speciesMap.clear();
    state.speciesColors.clear();
}

/**
 * Serialize species data for saving
 */
export function serializeSpeciesData() {
    const data = [];

    for (const [marker, species] of state.speciesMap) {
        data.push({
            marker,
            ...species,
            representative: species.representative // Keep genome reference
        });
    }

    return data;
}

/**
 * Deserialize species data from saved state
 */
export function deserializeSpeciesData(data) {
    state.speciesMap.clear();
    state.speciesColors.clear();

    for (const species of data) {
        state.speciesMap.set(species.marker, species);
        state.speciesColors.set(species.marker, species.color);
    }
}

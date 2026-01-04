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

// ============================================================
// SPATIAL POPULATION STRUCTURE (Meta-population dynamics)
// ============================================================

/**
 * Calculate spatial genetic structure (demes/subpopulations)
 *
 * Groups agents by location to identify local subpopulations.
 * This enables:
 * - Isolation by distance analysis
 * - Local adaptation tracking
 * - Meta-population dynamics
 *
 * @param {Array} agents - Agent population
 * @param {number} cellSize - Size of grid cells for grouping (default 100)
 * @returns {Array} - Array of deme objects
 */
export function calculateDemes(agents = state.agents, cellSize = 100) {
    const living = agents.filter(a => a.alive);
    if (living.length === 0) return [];

    // Group agents by location
    const grid = new Map();

    for (const agent of living) {
        const cellX = Math.floor(agent.position.x / cellSize);
        const cellY = Math.floor(agent.position.y / cellSize);
        const key = `${cellX},${cellY}`;

        if (!grid.has(key)) {
            grid.set(key, {
                key,
                cellX,
                cellY,
                centerX: (cellX + 0.5) * cellSize,
                centerY: (cellY + 0.5) * cellSize,
                members: []
            });
        }

        grid.get(key).members.push(agent);
    }

    // Calculate statistics for each deme
    const demes = [];

    for (const [key, deme] of grid) {
        if (deme.members.length < 2) continue;  // Need at least 2 for a deme

        // Calculate genetic diversity within deme
        const diversity = calculateLocalDiversity(deme.members);

        // Find dominant species in deme
        const speciesCounts = new Map();
        for (const agent of deme.members) {
            const marker = agent.genome.species_marker;
            speciesCounts.set(marker, (speciesCounts.get(marker) || 0) + 1);
        }
        let dominantSpecies = null;
        let maxCount = 0;
        for (const [marker, count] of speciesCounts) {
            if (count > maxCount) {
                maxCount = count;
                dominantSpecies = marker;
            }
        }

        // Calculate average traits for local adaptation analysis
        const avgEfficiency = deme.members.reduce((sum, a) =>
            sum + a.genome.metabolism.efficiency, 0) / deme.members.length;
        const avgAggression = deme.members.reduce((sum, a) =>
            sum + (a.genome.social.competition?.aggression || 0.3), 0) / deme.members.length;

        demes.push({
            key,
            position: { x: deme.centerX, y: deme.centerY },
            size: deme.members.length,
            diversity,
            dominantSpecies,
            speciesCount: speciesCounts.size,
            avgEfficiency,
            avgAggression,
            members: deme.members
        });
    }

    return demes;
}

/**
 * Calculate genetic diversity within a group
 */
function calculateLocalDiversity(members) {
    if (members.length < 2) return 0;

    let totalDistance = 0;
    let pairs = 0;

    // Sample pairs if population is large (for performance)
    const maxPairs = 50;
    if (members.length * (members.length - 1) / 2 > maxPairs) {
        // Random sampling
        for (let p = 0; p < maxPairs; p++) {
            const i = Math.floor(Math.random() * members.length);
            let j = Math.floor(Math.random() * members.length);
            if (i === j) j = (j + 1) % members.length;

            totalDistance += geneticDistance(members[i].genome, members[j].genome);
            pairs++;
        }
    } else {
        // Exhaustive comparison for small groups
        for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
                totalDistance += geneticDistance(members[i].genome, members[j].genome);
                pairs++;
            }
        }
    }

    return pairs > 0 ? totalDistance / pairs : 0;
}

/**
 * Calculate Isolation by Distance (IBD)
 *
 * Measures correlation between genetic distance and geographic distance.
 * Strong IBD indicates limited dispersal and local adaptation.
 *
 * @returns {Object} - IBD statistics
 */
export function calculateIsolationByDistance(agents = state.agents) {
    const living = agents.filter(a => a.alive);
    if (living.length < 10) return { correlation: 0, slope: 0, samples: 0 };

    // Sample pairs for correlation
    const maxSamples = 100;
    const geoDistances = [];
    const genDistances = [];

    for (let s = 0; s < maxSamples; s++) {
        const i = Math.floor(Math.random() * living.length);
        let j = Math.floor(Math.random() * living.length);
        if (i === j) continue;

        const agentA = living[i];
        const agentB = living[j];

        // Geographic distance
        const dx = agentA.position.x - agentB.position.x;
        const dy = agentA.position.y - agentB.position.y;
        const geoDist = Math.sqrt(dx * dx + dy * dy);

        // Genetic distance
        const genDist = geneticDistance(agentA.genome, agentB.genome);

        geoDistances.push(geoDist);
        genDistances.push(genDist);
    }

    if (geoDistances.length < 10) return { correlation: 0, slope: 0, samples: 0 };

    // Calculate Pearson correlation
    const n = geoDistances.length;
    const sumGeo = geoDistances.reduce((a, b) => a + b, 0);
    const sumGen = genDistances.reduce((a, b) => a + b, 0);
    const sumGeoSq = geoDistances.reduce((a, b) => a + b * b, 0);
    const sumGenSq = genDistances.reduce((a, b) => a + b * b, 0);
    const sumProduct = geoDistances.reduce((sum, geo, i) => sum + geo * genDistances[i], 0);

    const numerator = n * sumProduct - sumGeo * sumGen;
    const denominator = Math.sqrt(
        (n * sumGeoSq - sumGeo * sumGeo) * (n * sumGenSq - sumGen * sumGen)
    );

    const correlation = denominator > 0 ? numerator / denominator : 0;
    const slope = denominator > 0 ? numerator / (n * sumGeoSq - sumGeo * sumGeo) : 0;

    return {
        correlation,
        slope,
        samples: n,
        interpretation: correlation > 0.3 ? 'strong_IBD' :
                        correlation > 0.1 ? 'moderate_IBD' : 'weak_IBD'
    };
}

/**
 * Detect local adaptation patterns
 *
 * Compares traits between demes to identify divergent selection.
 *
 * @returns {Object} - Local adaptation statistics
 */
export function detectLocalAdaptation(agents = state.agents) {
    const demes = calculateDemes(agents);

    if (demes.length < 2) {
        return { adaptation_detected: false, deme_count: demes.length };
    }

    // Calculate trait variance between demes
    const efficiencies = demes.map(d => d.avgEfficiency);
    const aggressions = demes.map(d => d.avgAggression);

    const efficiencyVariance = calculateVariance(efficiencies);
    const aggressionVariance = calculateVariance(aggressions);

    // High between-deme variance suggests local adaptation
    const adaptationIndex = (efficiencyVariance + aggressionVariance) / 2;

    return {
        adaptation_detected: adaptationIndex > 0.01,
        deme_count: demes.length,
        efficiency_variance: efficiencyVariance,
        aggression_variance: aggressionVariance,
        adaptation_index: adaptationIndex,
        demes: demes.map(d => ({
            position: d.position,
            size: d.size,
            diversity: d.diversity,
            dominantSpecies: d.dominantSpecies
        }))
    };
}

/**
 * Calculate variance of an array
 */
function calculateVariance(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => (v - mean) * (v - mean));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Get spatial structure summary for UI display
 */
export function getSpatialStructureSummary(agents = state.agents) {
    const ibd = calculateIsolationByDistance(agents);
    const localAdaptation = detectLocalAdaptation(agents);
    const demes = calculateDemes(agents);

    return {
        deme_count: demes.length,
        total_population: agents.filter(a => a.alive).length,
        largest_deme: demes.length > 0 ? Math.max(...demes.map(d => d.size)) : 0,
        smallest_deme: demes.length > 0 ? Math.min(...demes.map(d => d.size)) : 0,
        isolation_by_distance: ibd.correlation,
        ibd_interpretation: ibd.interpretation,
        local_adaptation: localAdaptation.adaptation_detected,
        adaptation_index: localAdaptation.adaptation_index
    };
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

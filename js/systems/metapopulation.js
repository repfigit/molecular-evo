/**
 * Metapopulation System
 *
 * Implements spatially structured population dynamics based on Wright's
 * island model and stepping-stone models. This enables:
 *
 * 1. Geographic isolation leading to allopatric speciation
 * 2. Local adaptation with migration-selection balance
 * 3. Source-sink dynamics between productive and marginal habitats
 * 4. Population differentiation (Fst) between patches
 * 5. Rescue effects from immigration
 *
 * Key concepts:
 * - Habitat patches: Discrete spatial regions with distinct characteristics
 * - Migration: Movement between patches with associated costs/barriers
 * - Local adaptation: Fitness penalties for immigrants
 * - Fst: Measure of genetic differentiation between populations
 */

import { CONFIG } from '../config.js';
import { state, logEvent } from '../state.js';
import { neutralGeneticDistance } from '../core/genome.js';
import { randomInt, randomRange, clamp, generateUUID } from '../utils/math.js';

// ============================================================================
// HABITAT PATCH SYSTEM
// ============================================================================

// Active habitat patches
let habitatPatches = [];

// Migration history for analysis
const migrationHistory = [];

// Spatial grid for O(1) patch lookups
let patchGrid = null;
let patchGridCellSize = 50;  // Grid cell size for patch lookups

/**
 * PatchGrid - Provides O(1) lookup of which patch contains a point
 */
class PatchGrid {
    constructor(patches, cellSize = 50) {
        this.cellSize = cellSize;
        this.grid = new Map();  // "cx,cy" -> patch

        // Build grid mapping
        for (const patch of patches) {
            this._mapPatchToCells(patch);
        }
    }

    _mapPatchToCells(patch) {
        const { x, y, width, height } = patch.bounds;

        // Get all grid cells this patch covers
        const cx1 = Math.floor(x / this.cellSize);
        const cy1 = Math.floor(y / this.cellSize);
        const cx2 = Math.floor((x + width - 1) / this.cellSize);
        const cy2 = Math.floor((y + height - 1) / this.cellSize);

        for (let cx = cx1; cx <= cx2; cx++) {
            for (let cy = cy1; cy <= cy2; cy++) {
                this.grid.set(`${cx},${cy}`, patch);
            }
        }
    }

    /**
     * Get patch at position - O(1) lookup
     */
    getPatchAt(x, y) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return this.grid.get(`${cx},${cy}`) || null;
    }

    /**
     * Rebuild grid (call after patches change)
     */
    rebuild(patches) {
        this.grid.clear();
        for (const patch of patches) {
            this._mapPatchToCells(patch);
        }
    }
}

/**
 * Initialize habitat patches based on world configuration
 */
export function initializeHabitatPatches(options = {}) {
    const patchCount = options.patchCount || 4;
    habitatPatches = [];

    // Define patch locations (roughly evenly distributed)
    const cols = Math.ceil(Math.sqrt(patchCount));
    const rows = Math.ceil(patchCount / cols);

    const patchWidth = CONFIG.WORLD_WIDTH / cols;
    const patchHeight = CONFIG.WORLD_HEIGHT / rows;

    // Available resource types for differentiation
    const resourceTypes = ['chemical_A', 'chemical_B', 'light', 'organic_matter'];
    const climateTypes = ['tropical', 'temperate', 'cold', 'arid'];

    let patchId = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (patchId >= patchCount) break;

            const patch = {
                id: patchId,
                name: `Patch_${patchId}`,

                // Spatial bounds
                bounds: {
                    x: col * patchWidth,
                    y: row * patchHeight,
                    width: patchWidth,
                    height: patchHeight
                },

                // Center point
                center: {
                    x: col * patchWidth + patchWidth / 2,
                    y: row * patchHeight + patchHeight / 2
                },

                // Ecological characteristics
                primary_resource: resourceTypes[patchId % resourceTypes.length],
                secondary_resource: resourceTypes[(patchId + 1) % resourceTypes.length],
                resource_abundance: randomRange(0.5, 1.5),

                // Climate
                climate: climateTypes[patchId % climateTypes.length],
                base_temperature: 0.3 + (patchId % climateTypes.length) * 0.15,

                // Carrying capacity
                carrying_capacity: Math.floor(CONFIG.MAX_AGENTS / patchCount * randomRange(0.8, 1.2)),

                // Quality metrics
                quality: randomRange(0.4, 0.9),
                stability: randomRange(0.5, 0.9),

                // Population tracking
                current_population: 0,
                species_composition: new Map(),

                // Historical data
                extinctions: 0,
                colonizations: 0,
                genetic_diversity: 0
            };

            habitatPatches.push(patch);
            patchId++;
        }
    }

    // Build spatial grid for O(1) patch lookups
    patchGrid = new PatchGrid(habitatPatches, patchGridCellSize);

    // Define migration corridors between adjacent patches
    defineMigrationCorridors();

    logEvent('metapopulation_initialized', {
        patchCount: habitatPatches.length,
        patches: habitatPatches.map(p => ({ id: p.id, name: p.name, climate: p.climate }))
    });

    return habitatPatches;
}

/**
 * Define migration corridors between patches
 */
function defineMigrationCorridors() {
    for (let i = 0; i < habitatPatches.length; i++) {
        const patch = habitatPatches[i];
        patch.migration_corridors = [];

        for (let j = 0; j < habitatPatches.length; j++) {
            if (i === j) continue;

            const other = habitatPatches[j];
            const distance = Math.sqrt(
                Math.pow(patch.center.x - other.center.x, 2) +
                Math.pow(patch.center.y - other.center.y, 2)
            );

            // Only connect adjacent patches (within certain distance)
            const maxDistance = Math.max(CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT) / 2;
            if (distance < maxDistance) {
                patch.migration_corridors.push({
                    target_patch: j,
                    distance,
                    // Migration rate inversely proportional to distance
                    base_rate: Math.max(0.01, 0.1 - distance / maxDistance * 0.1),
                    // Barrier strength (0 = no barrier, 1 = impassable)
                    barrier_strength: randomRange(0, 0.5)
                });
            }
        }
    }
}

/**
 * Get the habitat patch containing a position
 */
export function getPatchAtPosition(x, y) {
    // Use spatial grid for O(1) lookup if available
    if (patchGrid) {
        return patchGrid.getPatchAt(x, y);
    }

    // Fallback to linear search (only if patches not initialized)
    for (const patch of habitatPatches) {
        if (x >= patch.bounds.x && x < patch.bounds.x + patch.bounds.width &&
            y >= patch.bounds.y && y < patch.bounds.y + patch.bounds.height) {
            return patch;
        }
    }
    return null;
}

/**
 * Get a patch by ID
 */
export function getPatchById(id) {
    return habitatPatches.find(p => p.id === id);
}

// ============================================================================
// LOCAL ADAPTATION
// ============================================================================

/**
 * Calculate local adaptation fitness modifier for an agent in a patch
 * Immigrants (agents adapted to different patches) have reduced fitness
 */
export function calculateLocalAdaptationFitness(agent, patch) {
    if (!patch || !agent.genome) return 1.0;

    let fitness = 1.0;

    // Check if agent's metabolism matches patch resources
    const metabolism = agent.genome.metabolism;
    if (metabolism) {
        // Primary food match
        if (metabolism.primary_food === patch.primary_resource) {
            fitness *= 1.1;  // 10% bonus for matching primary resource
        } else if (metabolism.primary_food === patch.secondary_resource) {
            fitness *= 1.0;  // No bonus/penalty for secondary
        } else {
            fitness *= 0.85;  // 15% penalty for mismatched food source
        }

        // Temperature adaptation
        const optimalTemp = metabolism.optimal_temperature || 0.5;
        const patchTemp = patch.base_temperature;
        const tempDiff = Math.abs(optimalTemp - patchTemp);
        fitness *= (1 - tempDiff * 0.3);  // Up to 30% penalty for temperature mismatch
    }

    // Track natal patch for future adaptation
    if (agent.natal_patch === undefined) {
        agent.natal_patch = patch.id;
    } else if (agent.natal_patch !== patch.id) {
        // Immigrant penalty
        fitness *= 0.9;  // 10% immigrant fitness penalty
    }

    // Density dependence within patch
    const densityRatio = patch.current_population / patch.carrying_capacity;
    if (densityRatio > 1) {
        fitness *= Math.pow(0.9, densityRatio - 1);  // Increasing penalty above K
    }

    return clamp(fitness, 0.1, 1.5);
}

/**
 * Update agent's local adaptation over time
 * Agents can acclimatize to new patches
 */
export function updateLocalAdaptation(agent, patch, dt) {
    if (!agent.local_adaptation) {
        agent.local_adaptation = {
            current_patch: patch?.id,
            time_in_patch: 0,
            acclimatization: 0
        };
    }

    if (!patch) return;

    if (agent.local_adaptation.current_patch === patch.id) {
        // Accumulate time in current patch
        agent.local_adaptation.time_in_patch += dt;

        // Gradual acclimatization (takes ~500 ticks for full acclimatization)
        agent.local_adaptation.acclimatization = Math.min(1,
            agent.local_adaptation.time_in_patch / 500
        );
    } else {
        // Entered new patch - reset acclimatization
        agent.local_adaptation.current_patch = patch.id;
        agent.local_adaptation.time_in_patch = 0;
        agent.local_adaptation.acclimatization = 0;
    }
}

// ============================================================================
// MIGRATION DYNAMICS
// ============================================================================

/**
 * Process migration events for all agents
 */
export function processMigration(agents, dt) {
    const migrations = [];

    for (const agent of agents) {
        if (!agent.alive) continue;

        const currentPatch = getPatchAtPosition(agent.position.x, agent.position.y);
        if (!currentPatch) continue;

        // Update local adaptation
        updateLocalAdaptation(agent, currentPatch, dt);

        // Check for migration triggers
        const migrationProbability = calculateMigrationProbability(agent, currentPatch, dt);

        if (Math.random() < migrationProbability) {
            const targetPatch = selectMigrationTarget(agent, currentPatch);
            if (targetPatch) {
                migrations.push({
                    agent,
                    from: currentPatch,
                    to: targetPatch
                });
            }
        }
    }

    // Execute migrations
    for (const migration of migrations) {
        executeMigration(migration.agent, migration.from, migration.to);
    }

    return migrations;
}

/**
 * Calculate probability of migration for an agent
 */
function calculateMigrationProbability(agent, patch, dt) {
    let baseProbability = 0.001 * dt;  // Low base migration rate

    // Higher migration if patch is overcrowded
    const densityRatio = patch.current_population / patch.carrying_capacity;
    if (densityRatio > 1) {
        baseProbability *= (1 + (densityRatio - 1) * 2);
    }

    // Lower migration if well-adapted
    if (agent.local_adaptation?.acclimatization > 0.5) {
        baseProbability *= 0.5;
    }

    // Higher migration for younger agents (dispersal age)
    if (agent.age && agent.age < 100) {
        baseProbability *= 1.5;
    }

    // Movement-related genes affect dispersal propensity
    if (agent.genome.social?.competition?.aggression < 0.3) {
        baseProbability *= 1.3;  // Less aggressive individuals more likely to disperse
    }

    return Math.min(0.1, baseProbability);  // Cap at 10% per tick
}

/**
 * Select a target patch for migration
 */
function selectMigrationTarget(agent, currentPatch) {
    if (!currentPatch.migration_corridors || currentPatch.migration_corridors.length === 0) {
        return null;
    }

    // Weight corridors by quality and accessibility
    const weights = currentPatch.migration_corridors.map(corridor => {
        const targetPatch = habitatPatches[corridor.target_patch];
        if (!targetPatch) return 0;

        // Prefer higher quality patches
        let weight = corridor.base_rate * targetPatch.quality;

        // Reduce weight for barriers
        weight *= (1 - corridor.barrier_strength);

        // Reduce weight for crowded patches
        const densityRatio = targetPatch.current_population / targetPatch.carrying_capacity;
        if (densityRatio > 0.8) {
            weight *= (1.2 - densityRatio);
        }

        return Math.max(0, weight);
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) return null;

    // Roulette wheel selection
    let random = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return habitatPatches[currentPatch.migration_corridors[i].target_patch];
        }
    }

    return null;
}

/**
 * Execute a migration event
 */
function executeMigration(agent, fromPatch, toPatch) {
    // Move agent to center of target patch (with random offset)
    agent.position.x = toPatch.center.x + randomRange(-50, 50);
    agent.position.y = toPatch.center.y + randomRange(-50, 50);

    // Clamp to world bounds
    agent.position.x = clamp(agent.position.x, 0, CONFIG.WORLD_WIDTH);
    agent.position.y = clamp(agent.position.y, 0, CONFIG.WORLD_HEIGHT);

    // Migration has energy cost
    agent.energy -= 10;

    // Reset local adaptation
    if (agent.local_adaptation) {
        agent.local_adaptation.current_patch = toPatch.id;
        agent.local_adaptation.time_in_patch = 0;
        agent.local_adaptation.acclimatization = 0;
    }

    // Record migration
    migrationHistory.push({
        tick: state.tick,
        agentId: agent.id,
        fromPatch: fromPatch.id,
        toPatch: toPatch.id,
        speciesMarker: agent.genome.species_marker
    });

    // Update patch statistics
    fromPatch.current_population = Math.max(0, fromPatch.current_population - 1);
    toPatch.current_population++;

    logEvent('migration', {
        agent: agent.id,
        from: fromPatch.name,
        to: toPatch.name
    });

    // Trim history
    while (migrationHistory.length > 1000) {
        migrationHistory.shift();
    }
}

// ============================================================================
// POPULATION DIFFERENTIATION (Fst)
// ============================================================================

/**
 * Calculate Fst (fixation index) between two patches
 * Fst = (Ht - Hs) / Ht
 * Where Ht = total heterozygosity, Hs = average within-patch heterozygosity
 *
 * Fst ranges from 0 (no differentiation) to 1 (complete differentiation)
 */
export function calculateFst(patchA, patchB, agents) {
    const agentsA = agents.filter(a =>
        a.alive && getPatchAtPosition(a.position.x, a.position.y)?.id === patchA.id
    );
    const agentsB = agents.filter(a =>
        a.alive && getPatchAtPosition(a.position.x, a.position.y)?.id === patchB.id
    );

    if (agentsA.length < 3 || agentsB.length < 3) {
        return { fst: 0, interpretation: 'insufficient_data' };
    }

    // Calculate within-patch heterozygosity (using neutral markers)
    const HsA = calculateHeterozygosity(agentsA);
    const HsB = calculateHeterozygosity(agentsB);
    const Hs = (HsA + HsB) / 2;  // Average within-patch heterozygosity

    // Calculate total heterozygosity (treating all as one population)
    const allAgents = [...agentsA, ...agentsB];
    const Ht = calculateHeterozygosity(allAgents);

    // Fst calculation
    const fst = Ht > 0 ? (Ht - Hs) / Ht : 0;

    // Interpretation
    let interpretation;
    if (fst < 0.05) interpretation = 'little_differentiation';
    else if (fst < 0.15) interpretation = 'moderate_differentiation';
    else if (fst < 0.25) interpretation = 'great_differentiation';
    else interpretation = 'very_great_differentiation';

    return {
        fst: clamp(fst, 0, 1),
        Ht,
        Hs,
        HsA,
        HsB,
        interpretation,
        sampleSizeA: agentsA.length,
        sampleSizeB: agentsB.length
    };
}

/**
 * Calculate heterozygosity from neutral markers
 */
function calculateHeterozygosity(agents) {
    if (agents.length < 2) return 0;

    // Use MHC heterozygosity as proxy
    let totalHet = 0;
    let count = 0;

    for (const agent of agents) {
        if (agent.genome.mhc?.heterozygosity !== undefined) {
            totalHet += agent.genome.mhc.heterozygosity;
            count++;
        }
    }

    return count > 0 ? totalHet / count : 0.5;
}

/**
 * Calculate pairwise Fst for all patch pairs
 */
export function calculateAllPairwiseFst(agents) {
    const results = [];

    for (let i = 0; i < habitatPatches.length; i++) {
        for (let j = i + 1; j < habitatPatches.length; j++) {
            const fstResult = calculateFst(habitatPatches[i], habitatPatches[j], agents);
            results.push({
                patchA: habitatPatches[i].name,
                patchB: habitatPatches[j].name,
                ...fstResult
            });
        }
    }

    return results;
}

// ============================================================================
// SOURCE-SINK DYNAMICS
// ============================================================================

/**
 * Classify patches as sources or sinks based on population dynamics
 * Sources: λ > 1 (produce excess individuals)
 * Sinks: λ < 1 (require immigration to persist)
 */
export function classifySourceSink(agents) {
    const classifications = [];

    for (const patch of habitatPatches) {
        const patchAgents = agents.filter(a =>
            a.alive && getPatchAtPosition(a.position.x, a.position.y)?.id === patch.id
        );

        // Estimate growth rate (λ) from recent births/deaths
        const births = patchAgents.filter(a => a.age < 50).length;
        const deaths = patch.recent_deaths || 0;
        const population = patchAgents.length;

        let lambda = 1.0;
        if (population > 0) {
            lambda = 1 + (births - deaths) / population;
        }

        // Immigration rate
        const recentImmigrants = migrationHistory.filter(m =>
            m.toPatch === patch.id &&
            state.tick - m.tick < 100
        ).length;

        const classification = {
            patch: patch.name,
            patchId: patch.id,
            population,
            lambda,
            type: lambda > 1.05 ? 'source' : lambda < 0.95 ? 'sink' : 'neutral',
            recentImmigrants,
            quality: patch.quality,
            sustainedBySelf: lambda >= 1,
            netExport: lambda > 1 ? (lambda - 1) * population : 0
        };

        classifications.push(classification);
    }

    return classifications;
}

// ============================================================================
// PATCH STATISTICS
// ============================================================================

/**
 * Update all patch statistics
 */
export function updatePatchStatistics(agents) {
    for (const patch of habitatPatches) {
        const patchAgents = agents.filter(a =>
            a.alive && getPatchAtPosition(a.position.x, a.position.y)?.id === patch.id
        );

        patch.current_population = patchAgents.length;

        // Update species composition
        patch.species_composition.clear();
        for (const agent of patchAgents) {
            const species = agent.genome.species_marker;
            patch.species_composition.set(
                species,
                (patch.species_composition.get(species) || 0) + 1
            );
        }

        // Calculate genetic diversity (Simpson's diversity index)
        if (patchAgents.length > 1) {
            let sumPiSquared = 0;
            for (const count of patch.species_composition.values()) {
                const pi = count / patchAgents.length;
                sumPiSquared += pi * pi;
            }
            patch.genetic_diversity = 1 - sumPiSquared;  // Simpson's D
        } else {
            patch.genetic_diversity = 0;
        }
    }
}

/**
 * Get metapopulation summary statistics
 */
export function getMetapopulationStats(agents) {
    updatePatchStatistics(agents);

    const totalPopulation = agents.filter(a => a.alive).length;
    const occupiedPatches = habitatPatches.filter(p => p.current_population > 0).length;

    // Calculate average Fst
    const fstResults = calculateAllPairwiseFst(agents);
    const avgFst = fstResults.length > 0
        ? fstResults.reduce((sum, r) => sum + r.fst, 0) / fstResults.length
        : 0;

    // Source-sink classification
    const sourceSink = classifySourceSink(agents);
    const sources = sourceSink.filter(s => s.type === 'source').length;
    const sinks = sourceSink.filter(s => s.type === 'sink').length;

    // Recent migration rate
    const recentMigrations = migrationHistory.filter(m =>
        state.tick - m.tick < 100
    ).length;

    return {
        totalPatches: habitatPatches.length,
        occupiedPatches,
        occupancyRate: occupiedPatches / habitatPatches.length,
        totalPopulation,
        avgPatchPopulation: totalPopulation / habitatPatches.length,
        avgFst,
        avgFstInterpretation: avgFst < 0.05 ? 'panmictic' :
                             avgFst < 0.15 ? 'low_structure' :
                             avgFst < 0.25 ? 'moderate_structure' : 'high_structure',
        sourcePatches: sources,
        sinkPatches: sinks,
        recentMigrations,
        migrationRate: recentMigrations / Math.max(1, totalPopulation),
        patchDetails: habitatPatches.map(p => ({
            id: p.id,
            name: p.name,
            population: p.current_population,
            capacity: p.carrying_capacity,
            diversity: p.genetic_diversity.toFixed(3),
            quality: p.quality.toFixed(2)
        }))
    };
}

/**
 * Get all habitat patches
 */
export function getHabitatPatches() {
    return habitatPatches;
}

/**
 * Reset metapopulation system
 */
export function resetMetapopulation() {
    habitatPatches = [];
    migrationHistory.length = 0;
    patchGrid = null;
}

/**
 * Evolutionary Visualization Manager
 *
 * Central hub for managing all evolutionary mechanism visualizations:
 * - Coordinate rendering of metapopulation, character displacement, etc.
 * - Manage visualization modes and overlays
 * - Track and display statistics for each mechanism
 * - Handle performance optimization
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';

// Import all evolutionary visualization modules
import * as MetapopRenderer from './metapopulationRenderer.js';
import * as CharDisplacementRenderer from './characterDisplacementRenderer.js';
import * as NicheConstructionRenderer from './nicheConstructionRenderer.js';
import * as EvolutionaryRenderer from './evolutionaryMechanismsRenderer.js';

// Visualization state
export const VISUALIZATION_MODES = {
    METAPOPULATION: 'metapopulation',
    CHARACTER_DISPLACEMENT: 'character_displacement',
    NICHE_CONSTRUCTION: 'niche_construction',
    EVOLUTIONARY_MECHANISMS: 'evolutionary_mechanisms',
    COMBINED: 'combined'
};

let activeVisualizations = new Set([VISUALIZATION_MODES.COMBINED]);
let showStatistics = true;
let statisticsPosition = { x: 10, y: 10 };

/**
 * Initialize evolutionary visualization system
 */
export function initializeEvolutionaryVisualizations() {
    // Initialize grids and state for all systems
    NicheConstructionRenderer.initNicheConstructionGrids();

    return {
        status: 'Evolutionary visualizations initialized',
        modes: Object.values(VISUALIZATION_MODES)
    };
}

/**
 * Toggle visualization mode on/off
 */
export function toggleVisualization(mode) {
    if (activeVisualizations.has(mode)) {
        activeVisualizations.delete(mode);

        // If removing a mode from combined, switch to individual
        if (mode !== VISUALIZATION_MODES.COMBINED && activeVisualizations.size === 0) {
            activeVisualizations.add(mode);
        }
    } else {
        activeVisualizations.add(mode);
    }

    // If combined is activated, ensure others are deactivated appropriately
    if (mode === VISUALIZATION_MODES.COMBINED) {
        if (activeVisualizations.has(VISUALIZATION_MODES.COMBINED)) {
            // Combined = show all
            activeVisualizations.clear();
            activeVisualizations.add(VISUALIZATION_MODES.COMBINED);
        }
    }

    return {
        mode,
        active: activeVisualizations.has(mode),
        currentModes: Array.from(activeVisualizations)
    };
}

/**
 * Set specific visualization modes
 */
export function setVisualizations(modes) {
    activeVisualizations.clear();
    for (const mode of modes) {
        if (Object.values(VISUALIZATION_MODES).includes(mode)) {
            activeVisualizations.add(mode);
        }
    }
}

/**
 * Main render function for evolutionary visualizations
 */
export function renderEvolutionaryVisualizations(ctx) {
    const shouldRender = activeVisualizations.size > 0;
    if (!shouldRender) return;

    // Render based on active modes
    if (activeVisualizations.has(VISUALIZATION_MODES.COMBINED) || activeVisualizations.size === 0) {
        renderCombinedVisualizations(ctx);
    } else {
        if (activeVisualizations.has(VISUALIZATION_MODES.METAPOPULATION)) {
            MetapopRenderer.renderMetapopulation(ctx);
        }
        if (activeVisualizations.has(VISUALIZATION_MODES.CHARACTER_DISPLACEMENT)) {
            CharDisplacementRenderer.renderCharacterDisplacement(ctx);
        }
        if (activeVisualizations.has(VISUALIZATION_MODES.NICHE_CONSTRUCTION)) {
            NicheConstructionRenderer.renderNicheConstruction(ctx);
        }
        if (activeVisualizations.has(VISUALIZATION_MODES.EVOLUTIONARY_MECHANISMS)) {
            EvolutionaryRenderer.renderMullersRatchet(ctx);
            EvolutionaryRenderer.renderEvolutionaryRescue(ctx);
            EvolutionaryRenderer.renderGeneticAssimilation(ctx);
            EvolutionaryRenderer.renderSexualConflict(ctx);
        }
    }

    // Render statistics if enabled
    if (showStatistics) {
        renderStatistics(ctx);
    }
}

/**
 * Render combined visualization showing all mechanisms simultaneously
 */
function renderCombinedVisualizations(ctx) {
    // Layer 1: Niche construction (background)
    NicheConstructionRenderer.renderNicheConstruction(ctx);

    // Layer 2: Metapopulation structure
    MetapopRenderer.renderMetapopulation(ctx);

    // Layer 3: Character displacement pressures
    CharDisplacementRenderer.renderCharacterDisplacement(ctx);

    // Layer 4: Evolutionary mechanisms
    EvolutionaryRenderer.renderMullersRatchet(ctx);
    EvolutionaryRenderer.renderEvolutionaryRescue(ctx);
    EvolutionaryRenderer.renderGeneticAssimilation(ctx);
    EvolutionaryRenderer.renderSexualConflict(ctx);
}

/**
 * Update all evolutionary tracking systems
 */
export function updateEvolutionaryVisualizations() {
    // Update niche construction grid
    NicheConstructionRenderer.updateNicheConstruction();

    // Update evolutionary mechanisms
    EvolutionaryRenderer.updateEvolutionaryMechanisms();
}

/**
 * Render statistics panel
 */
function renderStatistics(ctx) {
    const stats = gatherEvolutionaryStatistics();
    const x = statisticsPosition.x;
    const y = statisticsPosition.y;

    // Panel background
    const panelWidth = 400;
    const panelHeight = 280;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x, y, panelWidth, panelHeight);

    ctx.strokeStyle = 'rgba(100, 200, 100, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, panelWidth, panelHeight);

    // Title
    ctx.fillStyle = '#00FF00';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('EVOLUTIONARY DYNAMICS', x + 10, y + 20);

    // Statistics lines
    let lineY = y + 40;
    const lineHeight = 18;

    // Metapopulation stats
    if (stats.metapopulation) {
        ctx.fillStyle = '#CCCCCC';
        ctx.font = '10px monospace';
        ctx.fillText('METAPOPULATION:', x + 10, lineY);
        lineY += lineHeight;

        ctx.fillStyle = '#AAAAAA';
        ctx.fillText(`  Patches: ${stats.metapopulation.totalPatches}/${stats.metapopulation.occupiedPatches} occupied`, x + 10, lineY);
        lineY += lineHeight;
        ctx.fillText(`  Avg Fst: ${stats.metapopulation.avgFst.toFixed(3)}`, x + 10, lineY);
        lineY += lineHeight;
    }

    // Character displacement stats
    if (stats.characterDisplacement) {
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText('CHARACTER DISPLACEMENT:', x + 10, lineY);
        lineY += lineHeight;

        ctx.fillStyle = '#AAAAAA';
        ctx.fillText(`  Displacing pairs: ${stats.characterDisplacement.displacingSpeciesPairs}`, x + 10, lineY);
        lineY += lineHeight;
        ctx.fillText(`  Avg overlap: ${stats.characterDisplacement.averageNicheOverlap.toFixed(3)}`, x + 10, lineY);
        lineY += lineHeight;
        ctx.fillText(`  Avg pressure: ${stats.characterDisplacement.averageDivergencePressure.toFixed(3)}`, x + 10, lineY);
        lineY += lineHeight;
    }

    // Niche construction stats
    if (stats.nicheConstruction) {
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText('NICHE CONSTRUCTION:', x + 10, lineY);
        lineY += lineHeight;

        ctx.fillStyle = '#AAAAAA';
        ctx.fillText(`  Biofilm coverage: ${(stats.nicheConstruction.avgBiofilmCoverage * 100).toFixed(1)}%`, x + 10, lineY);
        lineY += lineHeight;
        ctx.fillText(`  Waste accumulation: ${(stats.nicheConstruction.avgWasteAccumulation * 100).toFixed(1)}%`, x + 10, lineY);
        lineY += lineHeight;
    }

    // Evolutionary mechanisms stats
    if (stats.mechanisms) {
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText('EVOLUTIONARY MECHANISMS:', x + 10, lineY);
        lineY += lineHeight;

        ctx.fillStyle = '#AAAAAA';
        ctx.fillText(`  Muller's Ratchet species: ${stats.mechanisms.asexualSpecies}`, x + 10, lineY);
        lineY += lineHeight;
        ctx.fillText(`  Evolutionary rescues: ${stats.mechanisms.activeEvolutionaryRescues}`, x + 10, lineY);
        lineY += lineHeight;
        ctx.fillText(`  Assimilating genes: ${stats.mechanisms.assimilatingGenes}`, x + 10, lineY);
    }
}

/**
 * Gather statistics from all visualization systems
 */
function gatherEvolutionaryStatistics() {
    const stats = {};

    try {
        stats.metapopulation = MetapopRenderer.getMetapopulationStats();
    } catch (e) {
        console.warn('Error gathering metapopulation stats:', e);
    }

    try {
        stats.characterDisplacement = CharDisplacementRenderer.getCharacterDisplacementStats();
    } catch (e) {
        console.warn('Error gathering character displacement stats:', e);
    }

    try {
        stats.nicheConstruction = NicheConstructionRenderer.getNicheConstructionStats();
    } catch (e) {
        console.warn('Error gathering niche construction stats:', e);
    }

    try {
        stats.mechanisms = EvolutionaryRenderer.getEvolutionaryMechanismsStats();
    } catch (e) {
        console.warn('Error gathering evolutionary mechanisms stats:', e);
    }

    return stats;
}

/**
 * Toggle statistics display
 */
export function toggleStatistics() {
    showStatistics = !showStatistics;
    return { statisticsVisible: showStatistics };
}

/**
 * Set statistics panel position
 */
export function setStatisticsPosition(x, y) {
    statisticsPosition = { x, y };
}

/**
 * Get current visualization configuration
 */
export function getVisualizationConfig() {
    return {
        activeVisualizations: Array.from(activeVisualizations),
        showStatistics,
        statisticsPosition,
        availableModes: Object.values(VISUALIZATION_MODES)
    };
}

/**
 * Get detailed legend for all visualization systems
 */
export function getVisualizationLegend() {
    return {
        metapopulation: {
            title: 'Metapopulation Structure',
            elements: [
                { symbol: 'Colored regions', meaning: 'Habitat patches (color = climate type)' },
                { symbol: 'Arrows', meaning: 'Migration corridors (thickness = migration rate)' },
                { symbol: 'Border thickness', meaning: 'Fst (genetic differentiation)' },
                { symbol: 'Green arrow', meaning: 'Source patch (λ > 1)' },
                { symbol: 'Red arrow', meaning: 'Sink patch (λ < 1)' },
                { symbol: 'Green halo', meaning: 'Local adaptation (acclimatization)' },
                { symbol: 'Yellow dashed', meaning: 'Recently migrated agent' }
            ]
        },
        characterDisplacement: {
            title: 'Character Displacement',
            elements: [
                { symbol: 'Circles', meaning: 'Niche hypervolume of species' },
                { symbol: 'Yellow gradient', meaning: 'Niche overlap zone' },
                { symbol: 'Red arrows', meaning: 'Divergence pressure (selection direction)' },
                { symbol: 'Orange dashed', meaning: 'Competitive conflict between agents' }
            ]
        },
        nicheConstruction: {
            title: 'Niche Construction',
            elements: [
                { symbol: 'Green overlay', meaning: 'Biofilm coverage' },
                { symbol: 'Brown overlay', meaning: 'Waste product accumulation' },
                { symbol: 'Colored regions', meaning: 'Territorial pheromones (color = species)' },
                { symbol: 'Dark overlay', meaning: 'Shade from large organisms' }
            ]
        },
        mechanisms: {
            title: 'Evolutionary Mechanisms',
            elements: [
                { symbol: 'Dark overlay on agent', meaning: 'Muller\'s Ratchet (genetic load)' },
                { symbol: 'Orange cracks', meaning: 'Ratchet click (sudden fitness drop)' },
                { symbol: 'Bright flash', meaning: 'Evolutionary rescue event' },
                { symbol: 'Purple halo', meaning: 'Genetic assimilation in progress' },
                { symbol: 'Red/Blue dashed', meaning: 'Sexual conflict (red=manipulation, blue=resistance)' }
            ]
        }
    };
}

/**
 * Generate help text for visualization system
 */
export function getVisualizationHelp() {
    return `
EVOLUTIONARY VISUALIZATION SYSTEM

This visualization system displays advanced evolutionary mechanisms including:

1. METAPOPULATION DYNAMICS
   - Habitat patches with different climates and resources
   - Migration corridors showing gene flow between patches
   - Fst values indicating genetic differentiation
   - Source vs sink patch classification

2. CHARACTER DISPLACEMENT
   - Niche overlap between competing species
   - Selection pressure arrows showing divergence direction
   - Real-time competitive conflicts

3. NICHE CONSTRUCTION
   - Biofilm formation by cooperative organisms
   - Territorial markings and pheromone gradients
   - Waste accumulation affecting environment
   - Shade effects from large bodies

4. EVOLUTIONARY MECHANISMS
   - Muller's Ratchet: Genetic load in asexual lineages
   - Evolutionary Rescue: Population recovery from near-extinction
   - Genetic Assimilation: Trait fixation and plasticity loss
   - Sexual Conflict: Manipulation vs resistance dynamics

KEYBOARD SHORTCUTS
   Press M: Toggle metapopulation view
   Press D: Toggle character displacement
   Press N: Toggle niche construction
   Press E: Toggle evolutionary mechanisms
   Press T: Toggle statistics display
   Press L: Display visualization legend
    `;
}

/**
 * Reset all visualization systems
 */
export function resetEvolutionaryVisualizations() {
    MetapopRenderer.resetMetapopulationRenderer();
    CharDisplacementRenderer.resetCharacterDisplacementRenderer();
    NicheConstructionRenderer.resetNicheConstructionRenderer();
    EvolutionaryRenderer.resetEvolutionaryMechanismsRenderer();

    activeVisualizations.clear();
    activeVisualizations.add(VISUALIZATION_MODES.COMBINED);

    return { status: 'Visualizations reset' };
}

/**
 * Export all statistics for analysis or logging
 */
export function exportEvolutionaryStats() {
    return {
        tick: state.tick,
        generation: state.generation,
        statistics: gatherEvolutionaryStatistics(),
        timestamp: new Date().toISOString()
    };
}

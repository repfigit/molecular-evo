/**
 * Evolution Statistics Panel
 *
 * Displays real-time evolutionary metrics and population statistics
 * including species count, genetic diversity, immunity investment,
 * plasmid prevalence, and other adaptive traits.
 *
 * Can be rendered as overlay widget or integrated into UI panels.
 */

import { state } from '../state.js';
import { CONFIG } from '../config.js';

/**
 * Calculate comprehensive evolutionary statistics from current population
 */
export function calculateEvolutionaryStats(agents, environment) {
    if (!agents || agents.length === 0) {
        return getEmptyStats();
    }

    const aliveAgents = agents.filter(a => a.alive);
    if (aliveAgents.length === 0) {
        return getEmptyStats();
    }

    // Species tracking
    const speciesMap = new Map();
    const speciesLineages = new Map(); // track generation of each species

    for (const agent of aliveAgents) {
        const marker = agent.genome.species_marker;
        if (!speciesMap.has(marker)) {
            speciesMap.set(marker, { count: 0, agents: [] });
        }
        speciesMap.get(marker).count++;
        speciesMap.get(marker).agents.push(agent);
    }

    // Calculate metrics
    const stats = {
        // Population
        totalAgents: aliveAgents.length,
        speciesCount: speciesMap.size,
        largestSpecies: Math.max(...Array.from(speciesMap.values()).map(s => s.count)),
        smallestSpecies: Math.min(...Array.from(speciesMap.values()).map(s => s.count)),

        // Fitness
        avgFitness: calculateAverage(aliveAgents, 'fitness'),
        maxFitness: Math.max(...aliveAgents.map(a => a.fitness || 0)),
        fitnessVariance: calculateVariance(aliveAgents, 'fitness'),

        // Energy
        avgEnergy: calculateAverage(aliveAgents, 'energy'),
        totalEnergyInSystem: aliveAgents.reduce((sum, a) => sum + a.energy, 0),

        // Age
        avgAge: calculateAverage(aliveAgents, 'age'),
        maxAge: Math.max(...aliveAgents.map(a => a.age || 0)),

        // Genetic diversity
        geneticDiversity: calculateGeneticDiversity(aliveAgents),
        mutationRate: calculateAverageMutationRate(aliveAgents),

        // Immunity
        avgInnateImmunity: calculateAverageImmunity(aliveAgents, 'innate'),
        avgAdaptiveImmunity: calculateAverageImmunity(aliveAgents, 'adaptive'),
        avgCRISPRSpacers: calculateAverageCRISPRSpacers(aliveAgents),

        // Horizontal Gene Transfer
        plasmidCarriage: calculatePlasmidCarriage(aliveAgents),
        avgPlasmidsPerAgent: calculateAveragePlasmids(aliveAgents),
        plasmidDiversity: calculatePlasmidDiversity(aliveAgents),

        // Social interactions
        cooperatingRate: calculateCooperatingRate(aliveAgents),
        symbioticPairs: calculateSymbioticPairs(aliveAgents),
        symbioticRate: calculateSymbioticRate(aliveAgents),

        // Viral pressure
        infectionRate: calculateInfectionRate(aliveAgents),
        viralDensity: state.viruses?.length || 0,

        // Body/Phenotype diversity
        avgNodeCount: calculateAverageBodySize(aliveAgents, 'nodes'),
        avgLinkCount: calculateAverageBodySize(aliveAgents, 'links'),
        avgSensorCount: calculateAverageBodySize(aliveAgents, 'sensors'),
        avgMotorCount: calculateAverageBodySize(aliveAgents, 'motors'),

        // Trophic strategy
        herbivoreFraction: calculateTrophicFraction(aliveAgents, a => (a.genome.metabolism.carnivory || 0) < 0.5),
        carnivoreFraction: calculateTrophicFraction(aliveAgents, a => (a.genome.metabolism.carnivory || 0) >= 0.5),
        omnivores: calculateTrophicFraction(aliveAgents, a => {
            const carn = a.genome.metabolism.carnivory || 0;
            return carn >= 0.3 && carn < 0.7;
        }),

        // Environment
        temperature: environment?.temperature || 0.5,
        resources: calculateEnvironmentResources(environment),

        // Generation data
        currentGeneration: state.generation || 0,
        generationTime: state.generationTime || 0,

        // Speciation metrics
        speciesAges: calculateSpeciesAges(aliveAgents, speciesMap),
        speciationEvents: state.speciationCount || 0
    };

    return stats;
}

/**
 * Get empty statistics object for initialization
 */
function getEmptyStats() {
    return {
        totalAgents: 0,
        speciesCount: 0,
        largestSpecies: 0,
        smallestSpecies: 0,
        avgFitness: 0,
        maxFitness: 0,
        fitnessVariance: 0,
        avgEnergy: 0,
        totalEnergyInSystem: 0,
        avgAge: 0,
        maxAge: 0,
        geneticDiversity: 0,
        mutationRate: 0,
        avgInnateImmunity: 0,
        avgAdaptiveImmunity: 0,
        avgCRISPRSpacers: 0,
        plasmidCarriage: 0,
        avgPlasmidsPerAgent: 0,
        plasmidDiversity: 0,
        cooperatingRate: 0,
        symbioticPairs: 0,
        symbioticRate: 0,
        infectionRate: 0,
        viralDensity: 0,
        avgNodeCount: 0,
        avgLinkCount: 0,
        avgSensorCount: 0,
        avgMotorCount: 0,
        herbivoreFraction: 0,
        carnivoreFraction: 0,
        omnivores: 0,
        temperature: 0.5,
        resources: 0,
        currentGeneration: 0,
        generationTime: 0,
        speciesAges: [],
        speciationEvents: 0
    };
}

/**
 * Helper: Calculate average of a numeric property
 */
function calculateAverage(agents, property) {
    if (agents.length === 0) return 0;
    const sum = agents.reduce((acc, a) => acc + (a[property] || 0), 0);
    return sum / agents.length;
}

/**
 * Helper: Calculate variance of a numeric property
 */
function calculateVariance(agents, property) {
    if (agents.length === 0) return 0;
    const avg = calculateAverage(agents, property);
    const squareDiffs = agents.map(a => Math.pow((a[property] || 0) - avg, 2));
    return squareDiffs.reduce((a, b) => a + b, 0) / agents.length;
}

/**
 * Calculate genetic diversity (0-1)
 * Based on variation in species markers, mutations, and genome features
 */
function calculateGeneticDiversity(agents) {
    if (agents.length < 2) return 0;

    // Count unique species markers
    const uniqueMarkers = new Set(agents.map(a => a.genome.species_marker));
    const speciesDiversity = (uniqueMarkers.size - 1) / (agents.length - 1); // 0-1

    // Calculate mutation variation
    const mutations = agents.map(a => a.genome.mutations?.count || 0);
    const mutationVariance = calculateVariance(agents, 'genome.mutations.count') || 0;
    const mutationDiversity = Math.min(1, mutationVariance / 100);

    // Combine metrics
    return (speciesDiversity * 0.6 + mutationDiversity * 0.4);
}

/**
 * Calculate average mutation rate
 */
function calculateAverageMutationRate(agents) {
    if (agents.length === 0) return 0;
    const sum = agents.reduce((acc, a) => acc + (a.genome.mutations?.rate || 0), 0);
    return sum / agents.length;
}

/**
 * Calculate average innate immunity investment
 */
function calculateAverageImmunity(agents, type) {
    if (agents.length === 0) return 0;

    const sum = agents.reduce((acc, a) => {
        if (type === 'innate') {
            return acc + (a.genome.immunity?.innate_immunity?.strength || 0);
        } else if (type === 'adaptive') {
            return acc + Math.min(1, (a.genome.immunity?.crispr?.spacers?.length || 0) / 10);
        }
        return acc;
    }, 0);

    return sum / agents.length;
}

/**
 * Calculate average CRISPR spacer count
 */
function calculateAverageCRISPRSpacers(agents) {
    if (agents.length === 0) return 0;
    const sum = agents.reduce((acc, a) => acc + (a.genome.immunity?.crispr?.spacers?.length || 0), 0);
    return sum / agents.length;
}

/**
 * Calculate fraction of agents carrying plasmids
 */
function calculatePlasmidCarriage(agents) {
    if (agents.length === 0) return 0;
    const withPlasmids = agents.filter(a => (a.genome.hgt?.plasmids?.length || 0) > 0).length;
    return withPlasmids / agents.length;
}

/**
 * Calculate average plasmids per agent
 */
function calculateAveragePlasmids(agents) {
    if (agents.length === 0) return 0;
    const sum = agents.reduce((acc, a) => acc + (a.genome.hgt?.plasmids?.length || 0), 0);
    return sum / agents.length;
}

/**
 * Calculate diversity of plasmid functions
 */
function calculatePlasmidDiversity(agents) {
    const functions = new Set();

    for (const agent of agents) {
        const plasmids = agent.genome.hgt?.plasmids || [];
        for (const plasmid of plasmids) {
            const genes = plasmid.gene_functions || [];
            for (const gene of genes) {
                functions.add(gene);
            }
        }
    }

    // Normalize by potential function types
    const maxFunctions = 10; // Estimate of distinct function types
    return Math.min(1, functions.size / maxFunctions);
}

/**
 * Calculate cooperation rate
 */
function calculateCooperatingRate(agents) {
    if (agents.length === 0) return 0;
    const cooperating = agents.filter(a => (a.cooperative_links?.length || 0) > 0).length;
    return cooperating / agents.length;
}

/**
 * Calculate number of symbiotic pairs
 */
function calculateSymbioticPairs(agents) {
    let pairs = 0;
    const counted = new Set();

    for (const agent of agents) {
        if (agent.symbiont && !counted.has(agent.id)) {
            pairs++;
            counted.add(agent.id);
            counted.add(agent.symbiont);
        }
    }

    return pairs;
}

/**
 * Calculate symbiosis rate (fraction in symbiotic relationships)
 */
function calculateSymbioticRate(agents) {
    if (agents.length === 0) return 0;
    const symbiotic = agents.filter(a => a.symbiont || a.host).length;
    return symbiotic / agents.length;
}

/**
 * Calculate infection rate
 */
function calculateInfectionRate(agents) {
    if (agents.length === 0) return 0;
    const infected = agents.filter(a => a.infection).length;
    return infected / agents.length;
}

/**
 * Calculate average body complexity metric
 */
function calculateAverageBodySize(agents, component) {
    if (agents.length === 0) return 0;

    const sum = agents.reduce((acc, a) => {
        let count = 0;
        if (component === 'nodes') count = a.body?.nodes?.length || 0;
        else if (component === 'links') count = a.body?.links?.length || 0;
        else if (component === 'sensors') count = a.body?.sensors?.length || 0;
        else if (component === 'motors') count = a.body?.motors?.length || 0;
        return acc + count;
    }, 0);

    return sum / agents.length;
}

/**
 * Calculate trophic strategy fraction
 */
function calculateTrophicFraction(agents, predicate) {
    if (agents.length === 0) return 0;
    const matching = agents.filter(predicate).length;
    return matching / agents.length;
}

/**
 * Calculate environment resource level
 */
function calculateEnvironmentResources(environment) {
    if (!environment?.resources) return 0;

    let totalResources = 0;
    let cellCount = 0;

    for (let y = 0; y < environment.resources.length; y++) {
        for (let x = 0; x < environment.resources[y].length; x++) {
            const cell = environment.resources[y][x];
            totalResources += (cell.chemical_A || 0) + (cell.chemical_B || 0) + (cell.organic_matter || 0);
            cellCount++;
        }
    }

    return cellCount > 0 ? totalResources / cellCount : 0;
}

/**
 * Calculate age of each species (when it speciated)
 */
function calculateSpeciesAges(agents, speciesMap) {
    const ages = [];

    for (const [marker, speciesData] of speciesMap) {
        const speciesAgents = speciesData.agents;
        const minGeneration = Math.min(...speciesAgents.map(a => a.lineage?.generation_born || 0));
        const currentGen = state.generation || 0;
        const age = Math.max(0, currentGen - minGeneration);

        ages.push({
            marker: marker,
            age: age,
            population: speciesAgents.length,
            avgFitness: speciesAgents.reduce((sum, a) => sum + (a.fitness || 0), 0) / speciesAgents.length
        });
    }

    return ages.sort((a, b) => b.age - a.age); // Newest first
}

/**
 * Render evolutionary statistics as overlay widget
 * Can be positioned on screen and shown/hidden
 */
export function renderEvolutionaryStatsWidget(ctx, stats, x, y, width, height) {
    const padding = 15;
    const lineHeight = 16;
    const columnWidth = width / 2;

    // Background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(x, y, width, height);

    // Border
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Title
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Evolution Metrics', x + padding, y + 25);

    // Divider line
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.4)';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 35);
    ctx.lineTo(x + width - 10, y + 35);
    ctx.stroke();

    let textY = y + 55;

    // Column 1: Population & Genetic
    const column1 = [
        { label: 'Species', value: stats.speciesCount, color: '#FFD400' },
        { label: 'Agents', value: stats.totalAgents, color: '#00FF88' },
        { label: 'Avg Fitness', value: stats.avgFitness.toFixed(1), color: '#FF8844' },
        { label: 'Genetic Div.', value: (stats.geneticDiversity * 100).toFixed(1) + '%', color: '#00FF00' },
        { label: 'Avg Age', value: Math.round(stats.avgAge), color: '#FFFFFF' }
    ];

    // Column 2: Immunity & HGT
    const column2 = [
        { label: 'Immunity Inv.', value: (stats.avgInnateImmunity * 100).toFixed(1) + '%', color: '#0096FF' },
        { label: 'Spacers', value: stats.avgCRISPRSpacers.toFixed(1), color: '#0096FF' },
        { label: 'Plasmids %', value: (stats.plasmidCarriage * 100).toFixed(1) + '%', color: '#FF44FF' },
        { label: 'Viral Pressure', value: stats.viralDensity, color: '#FF3333' },
        { label: 'Infection %', value: (stats.infectionRate * 100).toFixed(1) + '%', color: '#FF3333' }
    ];

    // Column 3: Behavior
    const column3 = [
        { label: 'Cooperation', value: (stats.cooperatingRate * 100).toFixed(1) + '%', color: '#44FF44' },
        { label: 'Symbiosis', value: stats.symbioticPairs, color: '#FF44FF' },
        { label: 'Herbivores', value: (stats.herbivoreFraction * 100).toFixed(0) + '%', color: '#88DD00' },
        { label: 'Carnivores', value: (stats.carnivoreFraction * 100).toFixed(0) + '%', color: '#DD4444' },
        { label: 'Generation', value: stats.currentGeneration, color: '#FFFF44' }
    ];

    // Draw columns
    const columns = [
        { data: column1, x: x + padding },
        { data: column2, x: x + padding + columnWidth },
        { data: column3, x: x + padding + columnWidth * 2 }
    ];

    for (const col of columns) {
        let colY = y + 55;
        for (const stat of col.data) {
            ctx.fillStyle = stat.color;
            ctx.font = '11px monospace';
            ctx.fillText(stat.label + ':', col.x, colY);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 11px monospace';
            ctx.fillText(stat.value, col.x + columnWidth - 50, colY);

            colY += lineHeight;
        }
    }
}

/**
 * Get color recommendation based on stat value
 */
export function getStatColor(statName, value, max) {
    const ratio = Math.min(1, value / (max || 100));

    if (ratio < 0.25) return '#FF3333';    // Red - low
    if (ratio < 0.5) return '#FFAA44';     // Orange - moderate
    if (ratio < 0.75) return '#FFFF44';    // Yellow - good
    return '#44FF44';                       // Green - excellent
}

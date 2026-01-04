/**
 * Evolutionary Mechanisms Renderer
 *
 * Visualizes advanced evolutionary processes:
 * - Muller's Ratchet: Asexual lineage degradation effects
 * - Evolutionary Rescue: Population recovery from extinction risk
 * - Genetic Assimilation: Trait fixation and plasticity reduction
 * - Sexual Conflict: Manipulation vs resistance dynamics
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { getSpeciesColor } from '../core/species.js';

// Tracking data for each mechanism
const mullersRatchetData = new Map();     // species -> { generations, decayRate, cracks }
let rescueEventMarkers = [];              // Array of active rescue events
const assimilationProgress = new Map();   // gene -> { plasticity, fixation, progress }
const sexualConflictMarkers = new Map();  // agent -> { manipulation, resistance, conflict }

const RESCUE_EFFECT_DURATION = 200;  // Ticks to display rescue event
const RATCHET_CRACK_DURATION = 100;  // Ticks to display crack effect
const ASSIMILATION_FADE = 150;       // Ticks for color transition

/**
 * Update evolutionary mechanism tracking
 */
export function updateEvolutionaryMechanisms() {
    updateMullersRatchet();
    updateEvolutionaryRescue();
    updateGeneticAssimilation();
    updateSexualConflict();

    // Clean up expired markers
    cleanupExpiredMarkers();
}

/**
 * Update Muller's Ratchet tracking for asexual lineages
 */
function updateMullersRatchet() {
    const asexualLineages = new Map();

    // Identify asexual populations (no mating)
    for (const agent of state.agents) {
        if (!agent.alive || !agent.genome.species_marker) continue;

        // Check if agent reproduces asexually
        const sexualReproduction = agent.genome.reproduction?.sexual_reproduction || 0;
        if (sexualReproduction > 0.5) continue;  // Sexual = skip

        const speciesId = agent.genome.species_marker;
        if (!asexualLineages.has(speciesId)) {
            asexualLineages.set(speciesId, []);
        }
        asexualLineages.get(speciesId).push(agent);
    }

    // Update ratchet data
    for (const [speciesId, members] of asexualLineages) {
        if (members.length === 0) continue;

        if (!mullersRatchetData.has(speciesId)) {
            mullersRatchetData.set(speciesId, {
                generations: 0,
                decayRate: 0,
                cracks: [],
                ratchetClicks: 0
            });
        }

        const data = mullersRatchetData.get(speciesId);
        data.generations++;

        // Decay rate increases with generations (genetic load accumulation)
        data.decayRate = Math.min(0.99, data.generations / 1000);

        // Detect "ratchet clicks" - sudden fitness drops
        const avgFitness = members.reduce((sum, a) => sum + (a.fitness || 0.5), 0) / members.length;
        const expectedFitness = 1 - data.decayRate;

        if (avgFitness < expectedFitness * 0.8) {
            // Ratchet click detected
            data.cracks.push({
                tick: state.tick,
                severity: 1 - (avgFitness / expectedFitness)
            });

            // Limit crack history
            data.cracks = data.cracks.filter(c => state.tick - c.tick < 500);
        }
    }
}

/**
 * Update evolutionary rescue events
 * A species near extinction that suddenly recovers
 */
function updateEvolutionaryRescue() {
    const populationHistoryKey = 'populationHistory';
    if (!state[populationHistoryKey]) {
        state[populationHistoryKey] = new Map();
    }

    const history = state[populationHistoryKey];

    // Track population by species
    const speciesPopulations = new Map();
    for (const agent of state.agents) {
        if (!agent.alive) continue;
        const speciesId = agent.genome.species_marker;
        speciesPopulations.set(speciesId, (speciesPopulations.get(speciesId) || 0) + 1);
    }

    // Detect rescue events
    for (const [speciesId, population] of speciesPopulations) {
        const previousPop = history.get(speciesId) || population;

        // Rescue if population < 10 and then suddenly increases > 2x
        if (previousPop < 10 && population > previousPop * 2) {
            rescueEventMarkers.push({
                tick: state.tick,
                speciesId,
                prevPopulation: previousPop,
                newPopulation: population,
                duration: RESCUE_EFFECT_DURATION
            });

            // Determine rescue type
            const rescueType = detectRescueType(speciesId);
            rescueEventMarkers[rescueEventMarkers.length - 1].type = rescueType;
        }

        history.set(speciesId, population);
    }
}

/**
 * Determine type of rescue (standing variation vs new mutation)
 */
function detectRescueType(speciesId) {
    const members = state.agents.filter(a =>
        a.alive && a.genome.species_marker === speciesId
    );

    if (members.length < 2) return 'unknown';

    // Check genetic diversity
    let diversitySum = 0;
    for (let i = 0; i < Math.min(5, members.length); i++) {
        for (let j = i + 1; j < Math.min(5, members.length); j++) {
            // Simple genetic distance
            const dist = members[i].age - members[j].age;  // Rough approximation
            diversitySum += Math.abs(dist);
        }
    }

    const diversity = diversitySum > 50 ? 'standing_variation' : 'new_mutation';
    return diversity;
}

/**
 * Update genetic assimilation tracking
 * Traits become fixed as genes rather than developmentally plastic
 */
function updateGeneticAssimilation() {
    const traitTracking = new Map();

    for (const agent of state.agents) {
        if (!agent.alive) continue;

        // Check for assimilated traits
        const genomeTraits = agent.genome || {};

        // Hypothetical genes that might be assimilating
        // (In real implementation, track specific loci)
        const possibleAssimilatedGenes = [
            { name: 'size', current: agent.genome.nodes?.length || 0, baseline: 50 },
            { name: 'motility', current: agent.genome.motors?.length || 0, baseline: 3 },
            { name: 'sensors', current: agent.genome.sensors?.length || 0, baseline: 3 }
        ];

        for (const gene of possibleAssimilatedGenes) {
            const key = `${agent.genome.species_marker}_${gene.name}`;

            if (!assimilationProgress.has(key)) {
                assimilationProgress.set(key, {
                    name: gene.name,
                    plasticity: 0.5,
                    fixation: 0,
                    progress: 0,
                    startTick: state.tick
                });
            }

            const data = assimilationProgress.get(key);

            // Plasticity decreases as trait becomes fixed
            // (Less environmental sensitivity)
            const fixationRate = 0.001;  // Slow fixation process
            data.plasticity = Math.max(0, data.plasticity - fixationRate);
            data.fixation = 1 - data.plasticity;

            // Progress is how far along the assimilation timeline we are
            const ageInTicks = state.tick - data.startTick;
            data.progress = Math.min(1, ageInTicks / 5000);  // Full in 5000 ticks
        }
    }
}

/**
 * Update sexual conflict tracking
 */
function updateSexualConflict() {
    sexualConflictMarkers.clear();

    // Find mating pairs and assess conflict
    const matingPairs = findMatingInteractions();

    for (const [male, female] of matingPairs) {
        // Manipulation trait (males trying to increase reproduction)
        const manipulation = male.genome.reproduction?.sexual_manipulation || 0;

        // Resistance trait (females resisting manipulation)
        const resistance = female.genome.reproduction?.mate_resistance || 0;

        // Conflict intensity
        const conflict = Math.abs(manipulation - resistance);

        // Cost to female of conflict
        const cost = resistance > 0 && manipulation > 0 ? 5 : 0;

        if (conflict > 0.1) {
            if (!sexualConflictMarkers.has(female)) {
                sexualConflictMarkers.set(female, {
                    manipulation,
                    resistance,
                    conflict,
                    cost
                });
            }
        }
    }
}

/**
 * Find potential mating interactions
 */
function findMatingInteractions() {
    const pairs = [];
    const checkDistance = 50;

    // Sample for efficiency
    const sampleAgents = state.agents.filter(a => a.alive).slice(0, 50);

    for (let i = 0; i < sampleAgents.length; i++) {
        for (let j = i + 1; j < sampleAgents.length; j++) {
            const agentA = sampleAgents[i];
            const agentB = sampleAgents[j];

            const dist = Math.sqrt(
                Math.pow(agentA.position.x - agentB.position.x, 2) +
                Math.pow(agentA.position.y - agentB.position.y, 2)
            );

            if (dist < checkDistance) {
                // Assume A is male, B is female for simplicity
                pairs.push([agentA, agentB]);
            }
        }
    }

    return pairs;
}

/**
 * Clean up expired markers
 */
function cleanupExpiredMarkers() {
    rescueEventMarkers = rescueEventMarkers.filter(
        m => state.tick - m.tick < m.duration
    );
}

/**
 * Render Muller's Ratchet effects
 */
export function renderMullersRatchet(ctx) {
    for (const agent of state.agents) {
        if (!agent.alive || !agent.genome.species_marker) continue;

        const speciesId = agent.genome.species_marker;
        const ratchetData = mullersRatchetData.get(speciesId);
        if (!ratchetData) continue;

        const x = agent.position.x;
        const y = agent.position.y;
        const decay = ratchetData.decayRate;

        if (decay > 0.1) {
            // Render darkening effect indicating genetic load
            ctx.fillStyle = `rgba(50, 30, 0, ${decay * 0.3})`;
            ctx.beginPath();
            ctx.arc(x, y, 10 + decay * 5, 0, Math.PI * 2);
            ctx.fill();

            // Cracks in the organism (visual metaphor for mutations)
            for (const crack of ratchetData.cracks) {
                const crackAge = state.tick - crack.tick;
                if (crackAge > RATCHET_CRACK_DURATION) continue;

                const fadeFactor = 1 - (crackAge / RATCHET_CRACK_DURATION);
                ctx.strokeStyle = `rgba(200, 100, 50, ${crack.severity * fadeFactor * 0.7})`;
                ctx.lineWidth = 1 + crack.severity * 2;

                // Random crack pattern
                const angle = Math.sin(crack.tick) * Math.PI;
                for (let i = 0; i < 3; i++) {
                    const crackAngle = angle + (Math.PI * 2 * i / 3);
                    const len = 8 * crack.severity;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(
                        x + Math.cos(crackAngle) * len,
                        y + Math.sin(crackAngle) * len
                    );
                    ctx.stroke();
                }
            }

            // Warning indicator for high ratchet risk
            if (decay > 0.5) {
                const pulse = Math.sin(state.tick * 0.1) * 0.5 + 0.5;
                ctx.strokeStyle = `rgba(255, 100, 0, ${pulse * 0.6})`;
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }
}

/**
 * Render evolutionary rescue events
 */
export function renderEvolutionaryRescue(ctx) {
    for (const rescueEvent of rescueEventMarkers) {
        // Find agents of rescued species
        const rescuedAgents = state.agents.filter(a =>
            a.alive && a.genome.species_marker === rescueEvent.speciesId
        );

        for (const agent of rescuedAgents.slice(0, 20)) {  // Limit for performance
            const x = agent.position.x;
            const y = agent.position.y;
            const progress = 1 - ((state.tick - rescueEvent.tick) / rescueEvent.duration);

            // Dramatic rescue flash effect
            const flashSize = 15 * progress;
            const color = rescueEvent.type === 'standing_variation'
                ? `rgba(100, 200, 255, ${progress * 0.6})`  // Blue for standing variation
                : `rgba(255, 200, 100, ${progress * 0.6})`;  // Orange for new mutation

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, flashSize, 0, Math.PI * 2);
            ctx.fill();

            // Radiating rings
            for (let i = 0; i < 2; i++) {
                ctx.strokeStyle = `rgba(255, 255, 100, ${(progress - i * 0.3) * 0.5})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, flashSize + i * 5, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }
}

/**
 * Render genetic assimilation progress
 */
export function renderGeneticAssimilation(ctx) {
    // Show assimilation halos on agents with actively assimilating traits
    for (const agent of state.agents) {
        if (!agent.alive || !agent.genome.species_marker) continue;

        let totalAssimilation = 0;
        let assimilatingTraits = 0;

        for (const [key, data] of assimilationProgress) {
            if (!key.startsWith(agent.genome.species_marker)) continue;

            totalAssimilation += data.fixation;
            assimilatingTraits++;
        }

        if (assimilatingTraits === 0) continue;

        const avgAssimilation = totalAssimilation / assimilatingTraits;
        if (avgAssimilation < 0.1) continue;

        const x = agent.position.x;
        const y = agent.position.y;

        // Purple halo for assimilating traits
        ctx.strokeStyle = `rgba(200, 100, 200, ${avgAssimilation * 0.5})`;
        ctx.lineWidth = 1 + avgAssimilation * 2;
        ctx.beginPath();
        ctx.arc(x, y, 8 + avgAssimilation * 4, 0, Math.PI * 2);
        ctx.stroke();

        // Color shift from plasticity (colorful) to fixation (grayscale)
        const plasticity = 1 - avgAssimilation;
        const colorGain = Math.floor(plasticity * 100);  // Fades to white as fixed
        ctx.fillStyle = `rgba(${100 + colorGain}, ${100 + colorGain}, ${100 + colorGain}, 0.1)`;
        ctx.fillRect(x - 5, y - 5, 10, 10);
    }
}

/**
 * Render sexual conflict markers
 */
export function renderSexualConflict(ctx) {
    for (const [agent, conflict] of sexualConflictMarkers) {
        if (!agent.alive) continue;

        const x = agent.position.x;
        const y = agent.position.y;
        const intensity = conflict.conflict;

        if (intensity < 0.1) continue;

        // Aura showing conflict intensity
        // Red = manipulation dominates, Blue = resistance dominates
        const colorIntensity = Math.abs(conflict.manipulation - conflict.resistance);
        const color = conflict.manipulation > conflict.resistance
            ? `rgba(255, 100, 100, ${intensity * 0.6})`  // Red for manipulation
            : `rgba(100, 100, 255, ${intensity * 0.6})`;  // Blue for resistance

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cost indicator (pulsing if conflict incurs fitness cost)
        if (conflict.cost > 0) {
            const pulse = Math.sin(state.tick * 0.15) * 0.5 + 0.5;
            ctx.strokeStyle = `rgba(255, 0, 0, ${pulse * 0.5})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

/**
 * Get evolutionary mechanism statistics
 */
export function getEvolutionaryMechanismsStats() {
    const asexualSpecies = mullersRatchetData.size;
    const avgRatchetDeck = mullersRatchetData.size > 0
        ? Array.from(mullersRatchetData.values())
            .reduce((sum, d) => sum + d.decayRate, 0) / mullersRatchetData.size
        : 0;

    const activeRescueEvents = rescueEventMarkers.length;
    const assimilatingGenes = assimilationProgress.size;

    return {
        asexualSpecies,
        averageRatchetDeck: avgRatchetDeck,
        activeEvolutionaryRescues: activeRescueEvents,
        assimilatingGenes,
        sexualConflictCount: sexualConflictMarkers.size
    };
}

/**
 * Reset evolutionary mechanisms renderer
 */
export function resetEvolutionaryMechanismsRenderer() {
    mullersRatchetData.clear();
    rescueEventMarkers.length = 0;
    assimilationProgress.clear();
    sexualConflictMarkers.clear();
}

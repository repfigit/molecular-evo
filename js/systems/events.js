/**
 * Events System
 *
 * Handles random and scheduled events:
 * - Catastrophes (temperature spikes, resource depletion)
 * - Environmental changes
 * - Viral outbreaks
 * - Resource blooms
 */

import { CONFIG } from '../config.js';
import { state, logEvent, addVirus, markAgentDead } from '../state.js';
import { createVirus } from '../core/virus.js';
import { addToxicZone } from './environment.js';

/**
 * Event types
 */
export const EVENT_TYPES = {
    TEMPERATURE_SPIKE: 'temperature_spike',
    TEMPERATURE_DROP: 'temperature_drop',
    RESOURCE_BLOOM: 'resource_bloom',
    RESOURCE_DEPLETION: 'resource_depletion',
    VIRAL_OUTBREAK: 'viral_outbreak',
    TOXIC_BLOOM: 'toxic_bloom',
    METEOR_STRIKE: 'meteor_strike',
    MUTATION_WAVE: 'mutation_wave'
};

/**
 * Active events
 */
let activeEvents = [];

/**
 * Process events each tick
 */
export function processEvents(dt) {
    // Check for new random events
    if (Math.random() < CONFIG.CATASTROPHE_CHANCE * dt) {
        triggerRandomEvent();
    }

    // Update active events
    updateActiveEvents(dt);

    // Check scheduled events
    processScheduledEvents();
}

/**
 * Trigger a random event
 */
function triggerRandomEvent() {
    const events = Object.values(EVENT_TYPES);
    const type = events[Math.floor(Math.random() * events.length)];

    triggerEvent(type);
}

/**
 * Trigger a specific event
 */
export function triggerEvent(type, options = {}) {
    const event = createEvent(type, options);
    if (!event) return null;

    activeEvents.push(event);
    applyEventStart(event);

    logEvent('event_started', {
        type: event.type,
        severity: event.severity,
        duration: event.duration
    });

    // Visual notification
    state.visualEvents.push({
        type: 'event_notification',
        eventType: type,
        message: getEventMessage(event),
        age: 0,
        duration: 120
    });

    return event;
}

/**
 * Create an event object
 */
function createEvent(type, options = {}) {
    const baseEvent = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        type,
        startTick: state.tick,
        severity: options.severity || 0.5 + Math.random() * 0.5,
        duration: options.duration || 200 + Math.random() * 300,
        age: 0,
        position: options.position || {
            x: Math.random() * CONFIG.WORLD_WIDTH,
            y: Math.random() * CONFIG.WORLD_HEIGHT
        },
        radius: options.radius || 100 + Math.random() * 200
    };

    // Type-specific properties
    switch (type) {
        case EVENT_TYPES.TEMPERATURE_SPIKE:
            baseEvent.temperatureChange = 0.3 + Math.random() * 0.4;
            break;

        case EVENT_TYPES.TEMPERATURE_DROP:
            baseEvent.temperatureChange = -(0.3 + Math.random() * 0.4);
            break;

        case EVENT_TYPES.RESOURCE_BLOOM:
            baseEvent.resourceType = ['chemical_A', 'chemical_B'][Math.floor(Math.random() * 2)];
            baseEvent.intensity = 0.5 + Math.random() * 0.5;
            break;

        case EVENT_TYPES.RESOURCE_DEPLETION:
            baseEvent.depletionRate = 0.3 + Math.random() * 0.4;
            break;

        case EVENT_TYPES.VIRAL_OUTBREAK:
            baseEvent.virusCount = 10 + Math.floor(Math.random() * 20);
            break;

        case EVENT_TYPES.TOXIC_BLOOM:
            baseEvent.toxicity = 0.5 + Math.random() * 0.5;
            break;

        case EVENT_TYPES.METEOR_STRIKE:
            baseEvent.damage = 0.7 + Math.random() * 0.3;
            baseEvent.radius = 50 + Math.random() * 100;
            baseEvent.duration = 50; // Quick event
            break;

        case EVENT_TYPES.MUTATION_WAVE:
            baseEvent.mutationBoost = 2 + Math.random() * 3;
            break;
    }

    return baseEvent;
}

/**
 * Apply event start effects
 */
function applyEventStart(event) {
    switch (event.type) {
        case EVENT_TYPES.VIRAL_OUTBREAK:
            // Spawn viruses
            for (let i = 0; i < event.virusCount; i++) {
                const virus = createVirus({
                    position: {
                        x: event.position.x + (Math.random() - 0.5) * event.radius,
                        y: event.position.y + (Math.random() - 0.5) * event.radius
                    }
                });
                addVirus(virus);
            }
            break;

        case EVENT_TYPES.TOXIC_BLOOM:
            addToxicZone(
                event.position.x,
                event.position.y,
                event.radius,
                event.toxicity
            );
            break;

        case EVENT_TYPES.METEOR_STRIKE:
            // Immediate damage to agents in radius
            for (const agent of state.agents) {
                if (!agent.alive) continue;
                const dx = agent.position.x - event.position.x;
                const dy = agent.position.y - event.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < event.radius) {
                    const damage = event.damage * (1 - dist / event.radius) * 100;
                    agent.energy -= damage;
                    if (agent.energy <= 0) markAgentDead(agent);
                }
            }

            // Create toxic aftermath
            addToxicZone(
                event.position.x,
                event.position.y,
                event.radius * 0.5,
                0.8
            );
            break;
    }
}

/**
 * Update active events
 */
function updateActiveEvents(dt) {
    activeEvents = activeEvents.filter(event => {
        event.age += dt;

        // Apply ongoing effects
        applyEventEffects(event, dt);

        // Check if event is over
        if (event.age >= event.duration) {
            applyEventEnd(event);
            logEvent('event_ended', { type: event.type });
            return false;
        }

        return true;
    });
}

/**
 * Apply ongoing event effects
 */
function applyEventEffects(event, dt) {
    const env = state.environment;
    if (!env) return;

    switch (event.type) {
        case EVENT_TYPES.TEMPERATURE_SPIKE:
        case EVENT_TYPES.TEMPERATURE_DROP:
            // Gradually apply temperature change
            const targetTemp = Math.max(0, Math.min(1,
                CONFIG.TEMPERATURE_CYCLE_BASE + event.temperatureChange * event.severity
            ));
            env.temperature = env.temperature * 0.99 + targetTemp * 0.01;
            break;

        case EVENT_TYPES.RESOURCE_BLOOM:
            // Add resources in radius
            applyResourceBloom(event, dt);
            break;

        case EVENT_TYPES.RESOURCE_DEPLETION:
            // Remove resources globally
            applyResourceDepletion(event, dt);
            break;

        case EVENT_TYPES.MUTATION_WAVE:
            // Boost mutations for agents
            for (const agent of state.agents) {
                if (!agent.alive) continue;
                agent.mutation_boost = event.mutationBoost;
            }
            break;
    }
}

/**
 * Apply resource bloom effect
 */
function applyResourceBloom(event, dt) {
    const env = state.environment;
    if (!env || !env.resources) return;

    const cx = Math.floor(event.position.x / env.cellSize);
    const cy = Math.floor(event.position.y / env.cellSize);
    const cellRadius = Math.ceil(event.radius / env.cellSize);

    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
            const x = cx + dx;
            const y = cy + dy;

            if (x < 0 || x >= env.cols || y < 0 || y >= env.rows) continue;

            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > cellRadius) continue;

            const factor = (1 - dist / cellRadius) * event.intensity * dt * 0.1;
            const cell = env.resources[y][x];
            cell[event.resourceType] = Math.min(CONFIG.RESOURCE_MAX,
                cell[event.resourceType] + factor
            );
        }
    }
}

/**
 * Apply resource depletion effect
 */
function applyResourceDepletion(event, dt) {
    const env = state.environment;
    if (!env || !env.resources) return;

    const depleteFactor = event.depletionRate * dt * 0.01;

    for (let y = 0; y < env.rows; y++) {
        for (let x = 0; x < env.cols; x++) {
            const cell = env.resources[y][x];
            cell.chemical_A *= (1 - depleteFactor);
            cell.chemical_B *= (1 - depleteFactor);
            cell.organic_matter *= (1 - depleteFactor);
        }
    }
}

/**
 * Apply event end effects
 */
function applyEventEnd(event) {
    switch (event.type) {
        case EVENT_TYPES.MUTATION_WAVE:
            // Remove mutation boost
            for (const agent of state.agents) {
                agent.mutation_boost = 1;
            }
            break;
    }
}

/**
 * Process scheduled events
 */
function processScheduledEvents() {
    // Check event queue
    while (state.eventQueue.length > 0 && state.eventQueue[0].triggerTick <= state.tick) {
        const scheduled = state.eventQueue.shift();
        triggerEvent(scheduled.type, scheduled.options);
    }
}

/**
 * Schedule an event for the future
 */
export function scheduleEvent(type, ticksFromNow, options = {}) {
    state.eventQueue.push({
        type,
        triggerTick: state.tick + ticksFromNow,
        options
    });

    // Keep queue sorted
    state.eventQueue.sort((a, b) => a.triggerTick - b.triggerTick);
}

/**
 * Get human-readable event message
 */
function getEventMessage(event) {
    switch (event.type) {
        case EVENT_TYPES.TEMPERATURE_SPIKE:
            return 'Heat wave detected!';
        case EVENT_TYPES.TEMPERATURE_DROP:
            return 'Cold snap incoming!';
        case EVENT_TYPES.RESOURCE_BLOOM:
            return `Resource bloom: ${event.resourceType}`;
        case EVENT_TYPES.RESOURCE_DEPLETION:
            return 'Resource scarcity!';
        case EVENT_TYPES.VIRAL_OUTBREAK:
            return 'Viral outbreak!';
        case EVENT_TYPES.TOXIC_BLOOM:
            return 'Toxic bloom detected!';
        case EVENT_TYPES.METEOR_STRIKE:
            return 'Meteor impact!';
        case EVENT_TYPES.MUTATION_WAVE:
            return 'Mutation wave!';
        default:
            return 'Unknown event';
    }
}

/**
 * Get active events
 */
export function getActiveEvents() {
    return activeEvents;
}

/**
 * Get event statistics
 */
export function getEventStats() {
    return {
        activeCount: activeEvents.length,
        queuedCount: state.eventQueue.length,
        activeTypes: activeEvents.map(e => e.type)
    };
}

/**
 * Clear all active events
 */
export function clearEvents() {
    activeEvents = [];
    state.eventQueue = [];
}

/**
 * Manually trigger catastrophe (for testing)
 */
export function triggerCatastrophe(severity = 1) {
    const catastropheTypes = [
        EVENT_TYPES.METEOR_STRIKE,
        EVENT_TYPES.VIRAL_OUTBREAK,
        EVENT_TYPES.TOXIC_BLOOM,
        EVENT_TYPES.RESOURCE_DEPLETION
    ];

    const type = catastropheTypes[Math.floor(Math.random() * catastropheTypes.length)];
    return triggerEvent(type, { severity });
}

// ============================================================================
// EVOLUTIONARY RESCUE
// ============================================================================
// Evolutionary rescue describes how populations can avoid extinction through
// rapid adaptation. The probability of rescue depends on:
// 1. Standing genetic diversity (pre-existing variation)
// 2. Mutation supply rate
// 3. Population size
// 4. Selection coefficient (strength of environmental challenge)

// Track rescue events for analysis
const rescueHistory = [];

/**
 * Evaluate whether a population can be rescued from a catastrophe
 * through evolutionary adaptation
 *
 * @param {string} speciesMarker - The species to evaluate
 * @param {string} catastropheType - Type of catastrophe
 * @param {number} severity - Severity of the catastrophe (0-1)
 * @param {Array} agents - All agents in simulation
 * @returns {Object} Rescue evaluation results
 */
export function evaluateEvolutionaryRescue(speciesMarker, catastropheType, severity, agents) {
    const speciesMembers = agents.filter(a =>
        a.alive && a.genome.species_marker === speciesMarker
    );

    if (speciesMembers.length === 0) {
        return { canRescue: false, reason: 'extinct' };
    }

    // Calculate genetic diversity (standing variation)
    const geneticDiversity = calculateGeneticDiversity(speciesMembers);

    // Calculate mutation supply (population size * mutation rate)
    const populationSize = speciesMembers.length;
    const avgMutationRate = speciesMembers.reduce((sum, a) => {
        return sum + (a.genome.mutagenesis?.base_mutation_modifier || 1);
    }, 0) / populationSize;
    const mutationSupply = populationSize * avgMutationRate * 0.01;

    // Calculate adaptive potential based on phenotypic variance
    const phenotypicVariance = calculatePhenotypicVariance(speciesMembers);

    // Rescue probability formula (simplified from Bell & Gonzalez 2009)
    // P(rescue) ≈ 2 * N * μ * s * V_A
    // Where: N = population size, μ = mutation rate, s = selection coef, V_A = additive variance
    const selectionCoefficient = severity;  // Strength of selection from catastrophe
    const rescueProbability = Math.min(0.95,
        2 * Math.log(populationSize + 1) *  // Population size effect (log scale)
        mutationSupply *                     // Mutation supply
        geneticDiversity *                   // Genetic diversity
        (1 - selectionCoefficient) *         // Easier to rescue from mild catastrophes
        phenotypicVariance                   // Phenotypic variance
    );

    // Determine rescue source
    let rescueSource = 'none';
    let rescueMutation = null;

    if (Math.random() < rescueProbability) {
        // Population will be rescued - determine mechanism
        if (geneticDiversity > 0.3 && Math.random() < 0.7) {
            // Rescue from standing variation (pre-existing alleles)
            rescueSource = 'standing_variation';
            rescueMutation = findRescueMutation(speciesMembers, catastropheType);
        } else {
            // Rescue from new mutation
            rescueSource = 'new_mutation';
            rescueMutation = generateRescueMutation(catastropheType);
        }
    }

    const result = {
        canRescue: rescueSource !== 'none',
        rescueSource,
        rescueMutation,
        probability: rescueProbability,
        geneticDiversity,
        populationSize,
        mutationSupply,
        phenotypicVariance,
        catastropheType,
        severity,
        tick: state.tick
    };

    // Log rescue attempt
    logEvent('rescue_attempt', result);

    // Track history
    rescueHistory.push({
        ...result,
        speciesMarker
    });

    // Trim history
    while (rescueHistory.length > 100) {
        rescueHistory.shift();
    }

    return result;
}

/**
 * Calculate genetic diversity from species members
 */
function calculateGeneticDiversity(members) {
    if (members.length < 2) return 0;

    let totalDist = 0;
    let count = 0;
    const sampleSize = Math.min(20, members.length);

    for (let i = 0; i < sampleSize; i++) {
        const a = members[Math.floor(Math.random() * members.length)];
        const b = members[Math.floor(Math.random() * members.length)];
        if (a === b) continue;

        // Use genome differences as proxy
        totalDist += Math.abs(
            (a.genome.metabolism?.efficiency || 0.5) -
            (b.genome.metabolism?.efficiency || 0.5)
        ) + Math.abs(
            (a.genome.viral?.resistance || 0.3) -
            (b.genome.viral?.resistance || 0.3)
        );
        count++;
    }

    return count > 0 ? Math.min(1, totalDist / count * 2) : 0;
}

/**
 * Calculate phenotypic variance in population
 */
function calculatePhenotypicVariance(members) {
    if (members.length < 2) return 0;

    // Calculate variance in key traits
    const sizes = members.map(a => a.genome.nodes?.length || 5);
    const efficiencies = members.map(a => a.genome.metabolism?.efficiency || 0.5);

    const meanSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const meanEff = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length;

    const sizeVar = sizes.reduce((sum, s) => sum + Math.pow(s - meanSize, 2), 0) / sizes.length;
    const effVar = efficiencies.reduce((sum, e) => sum + Math.pow(e - meanEff, 2), 0) / efficiencies.length;

    // Normalize and combine
    const normalizedSizeVar = sizeVar / (CONFIG.MAX_NODES * CONFIG.MAX_NODES);
    const normalizedEffVar = effVar;

    return Math.min(1, (normalizedSizeVar + normalizedEffVar) * 2);
}

/**
 * Find a rescue mutation from standing variation
 */
function findRescueMutation(members, catastropheType) {
    // Look for individuals with traits that could help survive
    let bestCandidate = null;
    let bestScore = 0;

    for (const member of members) {
        let score = 0;

        switch (catastropheType) {
            case EVENT_TYPES.TEMPERATURE_SPIKE:
            case EVENT_TYPES.TEMPERATURE_DROP:
                // Heat/cold tolerance from plasticity
                score = member.genome.metabolism?.plasticity?.plasticity_range || 0;
                break;

            case EVENT_TYPES.VIRAL_OUTBREAK:
                // Disease resistance
                score = member.genome.viral?.resistance || 0;
                score += member.genome.crispr?.efficiency || 0;
                break;

            case EVENT_TYPES.TOXIC_BLOOM:
                // Toxin resistance
                score = member.genome.viral?.resistance || 0;
                score += member.genome.metabolism?.efficiency || 0;
                break;

            case EVENT_TYPES.RESOURCE_DEPLETION:
                // Metabolic efficiency
                score = member.genome.metabolism?.efficiency || 0;
                score += member.genome.metabolism?.storage_capacity / 200 || 0;
                break;

            default:
                score = Math.random();
        }

        if (score > bestScore) {
            bestScore = score;
            bestCandidate = member;
        }
    }

    if (bestCandidate && bestScore > 0.3) {
        return {
            source: 'standing',
            donorId: bestCandidate.id,
            trait: getRelevantTrait(catastropheType),
            value: bestScore
        };
    }

    return null;
}

/**
 * Generate a new rescue mutation
 */
function generateRescueMutation(catastropheType) {
    const trait = getRelevantTrait(catastropheType);

    return {
        source: 'new',
        trait,
        value: 0.3 + Math.random() * 0.4,  // Moderate to strong effect
        selectionCoefficient: 0.1 + Math.random() * 0.2
    };
}

/**
 * Get the trait relevant for surviving a catastrophe
 */
function getRelevantTrait(catastropheType) {
    switch (catastropheType) {
        case EVENT_TYPES.TEMPERATURE_SPIKE:
            return 'heat_tolerance';
        case EVENT_TYPES.TEMPERATURE_DROP:
            return 'cold_tolerance';
        case EVENT_TYPES.VIRAL_OUTBREAK:
            return 'viral_resistance';
        case EVENT_TYPES.TOXIC_BLOOM:
            return 'toxin_resistance';
        case EVENT_TYPES.RESOURCE_DEPLETION:
            return 'metabolic_efficiency';
        case EVENT_TYPES.METEOR_STRIKE:
            return 'trauma_resistance';
        default:
            return 'general_fitness';
    }
}

/**
 * Apply rescue mutation to surviving population members
 */
export function applyRescueMutation(speciesMarker, rescueMutation, agents) {
    if (!rescueMutation) return;

    const members = agents.filter(a =>
        a.alive && a.genome.species_marker === speciesMarker
    );

    // Rescue mutation spreads gradually through population
    const spreadProbability = 0.1;  // 10% of population initially gets the mutation

    for (const member of members) {
        if (Math.random() < spreadProbability) {
            // Apply the rescue mutation to this individual
            switch (rescueMutation.trait) {
                case 'heat_tolerance':
                case 'cold_tolerance':
                    if (member.genome.metabolism?.plasticity) {
                        member.genome.metabolism.plasticity.plasticity_range =
                            Math.min(1, (member.genome.metabolism.plasticity.plasticity_range || 0.3) + rescueMutation.value * 0.5);
                    }
                    break;

                case 'viral_resistance':
                    if (member.genome.viral) {
                        member.genome.viral.resistance =
                            Math.min(1, (member.genome.viral.resistance || 0.3) + rescueMutation.value * 0.3);
                    }
                    break;

                case 'toxin_resistance':
                    if (member.genome.viral) {
                        member.genome.viral.resistance =
                            Math.min(1, (member.genome.viral.resistance || 0.3) + rescueMutation.value * 0.3);
                    }
                    break;

                case 'metabolic_efficiency':
                    if (member.genome.metabolism) {
                        member.genome.metabolism.efficiency =
                            Math.min(1, (member.genome.metabolism.efficiency || 0.5) + rescueMutation.value * 0.2);
                    }
                    break;
            }

            // Mark as rescued
            member.rescued = true;
            member.rescueMutation = rescueMutation.trait;
        }
    }

    logEvent('rescue_applied', {
        speciesMarker,
        mutation: rescueMutation,
        affectedCount: members.filter(m => m.rescued).length
    });
}

/**
 * Get evolutionary rescue statistics
 */
export function getEvolutionaryRescueStats() {
    const total = rescueHistory.length;
    const successful = rescueHistory.filter(r => r.canRescue).length;
    const fromStanding = rescueHistory.filter(r => r.rescueSource === 'standing_variation').length;
    const fromNew = rescueHistory.filter(r => r.rescueSource === 'new_mutation').length;

    const avgDiversity = total > 0
        ? rescueHistory.reduce((sum, r) => sum + r.geneticDiversity, 0) / total
        : 0;

    return {
        totalAttempts: total,
        successfulRescues: successful,
        rescueRate: total > 0 ? successful / total : 0,
        fromStandingVariation: fromStanding,
        fromNewMutation: fromNew,
        avgGeneticDiversity: avgDiversity,
        recentEvents: rescueHistory.slice(-5)
    };
}

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
import { state, logEvent } from '../state.js';
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
                state.viruses.push(virus);
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
                    if (agent.energy <= 0) agent.alive = false;
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

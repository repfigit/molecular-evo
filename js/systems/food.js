/**
 * Food System
 *
 * Manages food particles that agents can consume for energy.
 * Food spawns in patchy/clustered distribution (biologically realistic)
 * with resource hotspots that shift over time.
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { generateUUID, vec, distance } from '../utils/math.js';
import { rememberFood, recordExperience } from '../core/agent.js';

// Resource hotspots - areas where food is more likely to spawn
let resourceHotspots = [];
const HOTSPOT_COUNT = 5;
const HOTSPOT_RADIUS = 150;
const HOTSPOT_SHIFT_RATE = 0.001;  // How often hotspots move
const CLUSTER_PROBABILITY = 0.7;   // 70% chance to spawn near existing food/hotspot

/**
 * Initialize resource hotspots
 */
export function initHotspots() {
    resourceHotspots = [];
    for (let i = 0; i < HOTSPOT_COUNT; i++) {
        resourceHotspots.push({
            x: Math.random() * CONFIG.WORLD_WIDTH,
            y: Math.random() * CONFIG.WORLD_HEIGHT,
            strength: 0.5 + Math.random() * 0.5  // Variable productivity
        });
    }
}

/**
 * Update hotspot positions (slow drift simulates seasonal/environmental changes)
 */
function updateHotspots() {
    for (const hotspot of resourceHotspots) {
        // Random walk
        if (Math.random() < HOTSPOT_SHIFT_RATE) {
            hotspot.x += (Math.random() - 0.5) * 50;
            hotspot.y += (Math.random() - 0.5) * 50;

            // Keep in bounds
            hotspot.x = Math.max(50, Math.min(CONFIG.WORLD_WIDTH - 50, hotspot.x));
            hotspot.y = Math.max(50, Math.min(CONFIG.WORLD_HEIGHT - 50, hotspot.y));

            // Occasionally change strength (boom/bust cycles)
            if (Math.random() < 0.1) {
                hotspot.strength = 0.3 + Math.random() * 0.7;
            }
        }
    }
}

/**
 * Create a food particle
 */
export function createFood(x, y) {
    return {
        id: generateUUID(),
        position: vec(x, y),
        energy: CONFIG.FOOD_ENERGY_VALUE,
        consumed: false
    };
}

/**
 * Get spawn position - clustered/patchy distribution
 */
function getSpawnPosition() {
    // Decide spawn method
    const roll = Math.random();

    if (roll < CLUSTER_PROBABILITY && state.foodParticles.length > 0) {
        // Spawn near existing food (autocorrelated/clumped distribution)
        const nearFood = state.foodParticles[Math.floor(Math.random() * state.foodParticles.length)];
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 30 + 10;  // 10-40 units away
        return {
            x: Math.max(5, Math.min(CONFIG.WORLD_WIDTH - 5, nearFood.position.x + Math.cos(angle) * dist)),
            y: Math.max(5, Math.min(CONFIG.WORLD_HEIGHT - 5, nearFood.position.y + Math.sin(angle) * dist))
        };
    } else if (roll < CLUSTER_PROBABILITY + 0.2 && resourceHotspots.length > 0) {
        // Spawn near a hotspot (weighted by strength)
        const totalStrength = resourceHotspots.reduce((sum, h) => sum + h.strength, 0);
        let pick = Math.random() * totalStrength;
        let hotspot = resourceHotspots[0];
        for (const h of resourceHotspots) {
            pick -= h.strength;
            if (pick <= 0) {
                hotspot = h;
                break;
            }
        }
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * HOTSPOT_RADIUS;
        return {
            x: Math.max(5, Math.min(CONFIG.WORLD_WIDTH - 5, hotspot.x + Math.cos(angle) * dist)),
            y: Math.max(5, Math.min(CONFIG.WORLD_HEIGHT - 5, hotspot.y + Math.sin(angle) * dist))
        };
    } else {
        // Random spawn (rare, creates new patches)
        return {
            x: Math.random() * CONFIG.WORLD_WIDTH,
            y: Math.random() * CONFIG.WORLD_HEIGHT
        };
    }
}

/**
 * Spawn food particles in the environment (patchy distribution)
 */
export function spawnFood() {
    // Update hotspots occasionally
    updateHotspots();

    // Don't spawn if at max capacity
    if (state.foodParticles.length >= CONFIG.FOOD_MAX_COUNT) {
        return;
    }

    // Random chance to spawn food
    if (Math.random() < CONFIG.FOOD_SPAWN_RATE) {
        const pos = getSpawnPosition();
        const food = createFood(pos.x, pos.y);
        state.foodParticles.push(food);
    }
}

/**
 * Process food consumption by agents
 */
export function processFoodConsumption(agents) {
    const unconsumedFood = [];

    for (const food of state.foodParticles) {
        if (food.consumed) continue;

        // Check if any agent is close enough to eat this food
        let eaten = false;
        for (const agent of agents) {
            if (!agent.alive) continue;

            const dist = distance(agent.position, food.position);

            if (dist <= CONFIG.FOOD_CONSUMPTION_RANGE) {
                // Agent consumes the food
                const energyGain = Math.min(
                    food.energy,
                    agent.genome.metabolism.storage_capacity - agent.energy
                );
                agent.energy += energyGain;
                agent.total_energy_gathered = (agent.total_energy_gathered || 0) + energyGain;

                // BEHAVIORAL LEARNING: Remember this location as having food
                rememberFood(agent, food.position.x, food.position.y, energyGain / food.energy, state.tick);

                // Positive experience for exploitation (finding food)
                recordExperience(agent, 'exploit', energyGain / 20, food.position.x, food.position.y, state.tick);

                food.consumed = true;
                eaten = true;
                break;
            }
        }

        // Keep food that wasn't eaten
        if (!eaten) {
            unconsumedFood.push(food);
        }
    }

    // Update food list
    state.foodParticles = unconsumedFood;
}

/**
 * Update food system
 */
export function updateFood(dt) {
    // Spawn new food
    spawnFood();

    // Process food consumption
    processFoodConsumption(state.agents);
}

/**
 * Initialize food system with starting food (patchy distribution)
 */
export function initFood(count) {
    // Initialize resource hotspots first
    initHotspots();

    state.foodParticles = [];

    // Create initial food in clusters around hotspots
    for (let i = 0; i < count; i++) {
        // First few foods are random to seed the getSpawnPosition algorithm
        if (i < 5) {
            const x = Math.random() * CONFIG.WORLD_WIDTH;
            const y = Math.random() * CONFIG.WORLD_HEIGHT;
            state.foodParticles.push(createFood(x, y));
        } else {
            // Use patchy distribution for rest
            const pos = getSpawnPosition();
            state.foodParticles.push(createFood(pos.x, pos.y));
        }
    }
}

/**
 * Get food particles near a position
 */
export function getFoodNear(x, y, radius) {
    const nearby = [];

    for (const food of state.foodParticles) {
        if (food.consumed) continue;

        const dist = distance({ x, y }, food.position);

        if (dist <= radius) {
            nearby.push({
                food,
                distance: dist
            });
        }
    }

    return nearby;
}

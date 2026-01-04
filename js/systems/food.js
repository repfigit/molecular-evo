/**
 * Food System
 *
 * Manages food particles that agents can consume for energy.
 * Food spawns periodically and provides a reliable energy source
 * to sustain the population.
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { generateUUID, vec } from '../utils/math.js';

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
 * Spawn food particles in the environment
 */
export function spawnFood() {
    // Don't spawn if at max capacity
    if (state.foodParticles.length >= CONFIG.FOOD_MAX_COUNT) {
        return;
    }

    // Random chance to spawn food
    if (Math.random() < CONFIG.FOOD_SPAWN_RATE) {
        const x = Math.random() * CONFIG.WORLD_WIDTH;
        const y = Math.random() * CONFIG.WORLD_HEIGHT;
        const food = createFood(x, y);
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

            const dx = agent.position.x - food.position.x;
            const dy = agent.position.y - food.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= CONFIG.FOOD_CONSUMPTION_RANGE) {
                // Agent consumes the food
                const energyGain = Math.min(
                    food.energy,
                    agent.genome.metabolism.storage_capacity - agent.energy
                );
                agent.energy += energyGain;
                agent.total_energy_gathered = (agent.total_energy_gathered || 0) + energyGain;
                
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
 * Initialize food system with starting food
 */
export function initFood(count) {
    state.foodParticles = [];
    
    for (let i = 0; i < count; i++) {
        const x = Math.random() * CONFIG.WORLD_WIDTH;
        const y = Math.random() * CONFIG.WORLD_HEIGHT;
        const food = createFood(x, y);
        state.foodParticles.push(food);
    }
}

/**
 * Get food particles near a position
 */
export function getFoodNear(x, y, radius) {
    const nearby = [];
    const radiusSq = radius * radius;

    for (const food of state.foodParticles) {
        if (food.consumed) continue;

        const dx = food.position.x - x;
        const dy = food.position.y - y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radiusSq) {
            nearby.push({
                food,
                distance: Math.sqrt(distSq)
            });
        }
    }

    return nearby;
}

/**
 * Environment System
 *
 * Manages the simulation environment including:
 * - Resource grids (chemicals, light, organic matter)
 * - Temperature cycles and climate
 * - Viscosity effects
 * - Gradient calculations for chemotaxis
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { clamp, lerp } from '../utils/math.js';

/**
 * Create a new environment
 */
export function createEnvironment() {
    const cellSize = CONFIG.ENVIRONMENT_CELL_SIZE;
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / cellSize);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / cellSize);

    // Initialize resource grids
    const resources = [];
    for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
            row.push({
                chemical_A: Math.random() * 0.5 + 0.25,
                chemical_B: Math.random() * 0.5 + 0.25,
                light: calculateLightLevel(x, y, cols, rows),
                organic_matter: Math.random() * 0.2
            });
        }
        resources.push(row);
    }

    return {
        width: CONFIG.WORLD_WIDTH,
        height: CONFIG.WORLD_HEIGHT,
        cellSize,
        cols,
        rows,
        resources,
        temperature: CONFIG.TEMPERATURE_CYCLE_BASE,
        viscosity: CONFIG.VISCOSITY_BASE,
        time: 0,
        generation: 0,
        current: { x: 0, y: 0 },  // Global current/flow
        toxicZones: [],
        resourceSpots: []
    };
}

/**
 * Calculate initial light level based on position
 * Higher at top of world
 */
function calculateLightLevel(x, y, cols, rows) {
    const verticalGradient = 1 - (y / rows);
    const noise = (Math.random() - 0.5) * 0.2;
    return clamp(verticalGradient * 0.8 + 0.2 + noise, 0, 1);
}

/**
 * Initialize the environment system
 */
export function initEnvironment() {
    state.environment = createEnvironment();
    return state.environment;
}

/**
 * Main environment update
 */
export function updateEnvironment(dt) {
    const env = state.environment;
    if (!env) return;

    env.time++;

    // Update seasons and weather first (they affect other systems)
    if (CONFIG.ENABLE_SEASONS) {
        updateSeasons(dt);
    }
    if (CONFIG.ENABLE_WEATHER) {
        updateWeather(dt);
    }

    // Update temperature cycle (modified by season/weather)
    updateTemperature(env, dt);

    // Update viscosity
    updateViscosity(env, dt);

    // Regenerate resources
    regenerateResources(env, dt);

    // Decay organic matter
    decayOrganicMatter(env, dt);

    // Update toxic zones
    updateToxicZones(env, dt);

    // Update resource spots
    updateResourceSpots(env, dt);

    // Update current
    updateCurrent(env, dt);
}

/**
 * Update seasons
 */
function updateSeasons(dt) {
    const seasonOrder = ['spring', 'summer', 'fall', 'winter'];
    const currentIndex = seasonOrder.indexOf(state.currentSeason);

    // Progress through season
    state.seasonProgress += 1 / CONFIG.SEASON_LENGTH;

    // Check for season change
    if (state.seasonProgress >= 1) {
        state.seasonProgress = 0;
        const nextIndex = (currentIndex + 1) % 4;
        state.currentSeason = seasonOrder[nextIndex];

        // Track years
        if (nextIndex === 0) {
            state.yearCount++;
        }
    }
}

/**
 * Update weather
 */
function updateWeather(dt) {
    // Decrease weather duration
    if (state.weatherDuration > 0) {
        state.weatherDuration--;

        // Apply storm damage if applicable
        const weather = CONFIG.WEATHER_TYPES[state.currentWeather];
        if (weather.damage && Math.random() < weather.damage * 0.01) {
            applyWeatherDamage(weather.damage);
        }
    }

    // Check for weather change
    if (state.weatherDuration <= 0 || Math.random() < CONFIG.WEATHER_CHANGE_CHANCE) {
        changeWeather();
    }
}

/**
 * Change to a new weather type
 */
function changeWeather() {
    const season = CONFIG.SEASONS[state.currentSeason];
    const weatherTypes = Object.keys(CONFIG.WEATHER_TYPES);

    // Weight selection by season (storms more likely in stormy seasons)
    let newWeather;
    if (Math.random() < season.storms) {
        // Storm-like weather
        const stormyWeather = ['storm', 'rain', 'drought'];
        newWeather = stormyWeather[Math.floor(Math.random() * stormyWeather.length)];
    } else {
        // Normal weather distribution
        const weights = {
            clear: 0.4,
            rain: 0.2,
            drought: 0.1,
            storm: 0.05,
            heatwave: state.currentSeason === 'summer' ? 0.15 : 0.05,
            bloom: state.currentSeason === 'spring' ? 0.15 : 0.05
        };

        const rand = Math.random();
        let cumulative = 0;
        for (const [type, weight] of Object.entries(weights)) {
            cumulative += weight;
            if (rand < cumulative) {
                newWeather = type;
                break;
            }
        }
        newWeather = newWeather || 'clear';
    }

    state.currentWeather = newWeather;
    state.weatherDuration = CONFIG.WEATHER_TYPES[newWeather].duration;
}

/**
 * Apply damage from severe weather
 */
function applyWeatherDamage(damageRate) {
    for (const agent of state.agents) {
        if (!agent.alive) continue;
        // Random agents take damage
        if (Math.random() < 0.1) {
            agent.energy -= damageRate * 10;
        }
    }
}

/**
 * Get current environmental modifiers from season + weather
 */
export function getEnvironmentModifiers() {
    let tempMod = 0;
    let resourceMod = 1;

    if (CONFIG.ENABLE_SEASONS) {
        const season = CONFIG.SEASONS[state.currentSeason];
        tempMod += season.temp - 0.5;  // Offset from neutral
        resourceMod *= season.resources;
    }

    if (CONFIG.ENABLE_WEATHER) {
        const weather = CONFIG.WEATHER_TYPES[state.currentWeather];
        tempMod += weather.tempMod;
        resourceMod *= weather.resourceMod;
    }

    return { tempMod, resourceMod };
}

/**
 * Update temperature based on cycle + season + weather
 */
function updateTemperature(env, dt) {
    const period = CONFIG.TEMPERATURE_CYCLE_PERIOD;
    const cyclePos = (env.time % period) / period;

    // Base sinusoidal cycle (day/night)
    const base = CONFIG.TEMPERATURE_CYCLE_BASE;
    const amplitude = CONFIG.TEMPERATURE_CYCLE_AMPLITUDE;
    let cycleTemp = base + amplitude * Math.sin(cyclePos * Math.PI * 2);

    // Apply season/weather modifiers
    const mods = getEnvironmentModifiers();
    cycleTemp += mods.tempMod;

    // Add some noise
    const noise = (Math.random() - 0.5) * 0.02;

    env.temperature = clamp(cycleTemp + noise, 0, 1);
}

/**
 * Update viscosity based on temperature
 */
function updateViscosity(env, dt) {
    // Viscosity inversely related to temperature
    // Cold = thick/viscous, Hot = thin/fluid
    const tempFactor = 1 - env.temperature;
    env.viscosity = lerp(
        CONFIG.VISCOSITY_BASE * 0.5,
        CONFIG.VISCOSITY_BASE * 1.5,
        tempFactor
    );
}

/**
 * Regenerate resources over time
 */
function regenerateResources(env, dt) {
    const regenRate = CONFIG.RESOURCE_REGEN_BASE * dt;

    for (let y = 0; y < env.rows; y++) {
        for (let x = 0; x < env.cols; x++) {
            const cell = env.resources[y][x];

            // Chemical A regeneration
            if (cell.chemical_A < CONFIG.RESOURCE_MAX) {
                cell.chemical_A = Math.min(
                    CONFIG.RESOURCE_MAX,
                    cell.chemical_A + regenRate * 0.1
                );
            }

            // Chemical B regeneration
            if (cell.chemical_B < CONFIG.RESOURCE_MAX) {
                cell.chemical_B = Math.min(
                    CONFIG.RESOURCE_MAX,
                    cell.chemical_B + regenRate * 0.1
                );
            }

            // Light regeneration (instant, based on position)
            cell.light = lerp(
                cell.light,
                calculateLightLevel(x, y, env.cols, env.rows),
                0.01
            );
        }
    }
}

/**
 * Decay organic matter over time
 */
function decayOrganicMatter(env, dt) {
    const decayRate = CONFIG.ORGANIC_DECAY_RATE * dt;

    for (let y = 0; y < env.rows; y++) {
        for (let x = 0; x < env.cols; x++) {
            const cell = env.resources[y][x];

            // Decay organic matter
            if (cell.organic_matter > 0) {
                cell.organic_matter = Math.max(0, cell.organic_matter - decayRate);

                // Organic matter converts to chemicals as it decays
                const converted = decayRate * 0.5;
                cell.chemical_A = Math.min(CONFIG.RESOURCE_MAX, cell.chemical_A + converted);
                cell.chemical_B = Math.min(CONFIG.RESOURCE_MAX, cell.chemical_B + converted);
            }
        }
    }
}

/**
 * Update toxic zones (fade out)
 */
function updateToxicZones(env, dt) {
    env.toxicZones = env.toxicZones.filter(zone => {
        zone.intensity -= CONFIG.TOXIC_DECAY_RATE * dt;
        return zone.intensity > 0.01;
    });
}

/**
 * Update resource spots (special high-resource areas)
 */
function updateResourceSpots(env, dt) {
    // Spots slowly fade
    env.resourceSpots = env.resourceSpots.filter(spot => {
        spot.intensity -= 0.001 * dt;
        return spot.intensity > 0.01;
    });

    // Random chance to spawn new spot
    if (Math.random() < CONFIG.RESOURCE_SPOT_SPAWN_CHANCE * dt) {
        spawnResourceSpot(env);
    }
}

/**
 * Spawn a new resource spot
 */
function spawnResourceSpot(env) {
    env.resourceSpots.push({
        x: Math.random() * env.width,
        y: Math.random() * env.height,
        radius: 50 + Math.random() * 100,
        intensity: 0.5 + Math.random() * 0.5,
        type: Math.random() < 0.5 ? 'chemical_A' : 'chemical_B'
    });
}

/**
 * Update global current
 */
function updateCurrent(env, dt) {
    // Slowly varying current
    const time = env.time * 0.001;
    env.current.x = Math.sin(time) * 0.1;
    env.current.y = Math.cos(time * 0.7) * 0.1;
}

/**
 * Get resource cell at world position
 */
export function getResourceCell(x, y) {
    const env = state.environment;
    if (!env) return null;

    const cx = Math.floor(x / env.cellSize);
    const cy = Math.floor(y / env.cellSize);

    if (cx < 0 || cx >= env.cols || cy < 0 || cy >= env.rows) {
        return null;
    }

    return env.resources[cy][cx];
}

/**
 * Consume resources at a position
 */
export function consumeResource(x, y, resourceType, amount) {
    const cell = getResourceCell(x, y);
    if (!cell) return 0;

    const available = cell[resourceType] || 0;
    const consumed = Math.min(available, amount);
    cell[resourceType] = available - consumed;

    return consumed;
}

/**
 * Add organic matter at a position (from death, waste, etc.)
 */
export function addOrganicMatter(x, y, amount) {
    const cell = getResourceCell(x, y);
    if (!cell) return;

    cell.organic_matter = Math.min(
        CONFIG.RESOURCE_MAX,
        cell.organic_matter + amount
    );
}

/**
 * Get gradient at a position for a resource type
 */
export function getGradient(position, resourceType) {
    const env = state.environment;
    if (!env) return { x: 0, y: 0, strength: 0 };

    const cx = Math.floor(position.x / env.cellSize);
    const cy = Math.floor(position.y / env.cellSize);

    // Sample surrounding cells
    let gx = 0, gy = 0;
    let centerValue = 0;

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (nx < 0 || nx >= env.cols || ny < 0 || ny >= env.rows) continue;

            const value = env.resources[ny][nx][resourceType] || 0;

            if (dx === 0 && dy === 0) {
                centerValue = value;
            } else {
                gx += dx * value;
                gy += dy * value;
            }
        }
    }

    const strength = Math.sqrt(gx * gx + gy * gy);

    return {
        x: strength > 0 ? gx / strength : 0,
        y: strength > 0 ? gy / strength : 0,
        strength: centerValue
    };
}

/**
 * Check if a position is in a toxic zone
 */
export function getToxicity(x, y) {
    const env = state.environment;
    if (!env) return 0;

    let toxicity = 0;

    for (const zone of env.toxicZones) {
        const dx = x - zone.x;
        const dy = y - zone.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < zone.radius) {
            const factor = 1 - (dist / zone.radius);
            toxicity = Math.max(toxicity, zone.intensity * factor);
        }
    }

    return toxicity;
}

/**
 * Add a toxic zone
 */
export function addToxicZone(x, y, radius, intensity) {
    const env = state.environment;
    if (!env) return;

    env.toxicZones.push({ x, y, radius, intensity });
}

/**
 * Get total resources in a radius
 */
export function getResourcesInRadius(x, y, radius, resourceType) {
    const env = state.environment;
    if (!env) return 0;

    let total = 0;
    const radiusSq = radius * radius;

    // Get cells in radius
    const minCx = Math.max(0, Math.floor((x - radius) / env.cellSize));
    const maxCx = Math.min(env.cols - 1, Math.ceil((x + radius) / env.cellSize));
    const minCy = Math.max(0, Math.floor((y - radius) / env.cellSize));
    const maxCy = Math.min(env.rows - 1, Math.ceil((y + radius) / env.cellSize));

    for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
            const cellX = (cx + 0.5) * env.cellSize;
            const cellY = (cy + 0.5) * env.cellSize;
            const dx = cellX - x;
            const dy = cellY - y;

            if (dx * dx + dy * dy <= radiusSq) {
                total += env.resources[cy][cx][resourceType] || 0;
            }
        }
    }

    return total;
}

/**
 * Apply resource spot effects to the grid
 */
export function applyResourceSpots(env) {
    for (const spot of env.resourceSpots) {
        const minCx = Math.max(0, Math.floor((spot.x - spot.radius) / env.cellSize));
        const maxCx = Math.min(env.cols - 1, Math.ceil((spot.x + spot.radius) / env.cellSize));
        const minCy = Math.max(0, Math.floor((spot.y - spot.radius) / env.cellSize));
        const maxCy = Math.min(env.rows - 1, Math.ceil((spot.y + spot.radius) / env.cellSize));

        for (let cy = minCy; cy <= maxCy; cy++) {
            for (let cx = minCx; cx <= maxCx; cx++) {
                const cellX = (cx + 0.5) * env.cellSize;
                const cellY = (cy + 0.5) * env.cellSize;
                const dx = cellX - spot.x;
                const dy = cellY - spot.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= spot.radius) {
                    const factor = (1 - dist / spot.radius) * spot.intensity * 0.01;
                    const cell = env.resources[cy][cx];
                    cell[spot.type] = Math.min(CONFIG.RESOURCE_MAX, cell[spot.type] + factor);
                }
            }
        }
    }
}

/**
 * Get environment statistics
 */
export function getEnvironmentStats() {
    const env = state.environment;
    if (!env) return null;

    let totalChemA = 0, totalChemB = 0, totalLight = 0, totalOrganic = 0;

    for (let y = 0; y < env.rows; y++) {
        for (let x = 0; x < env.cols; x++) {
            const cell = env.resources[y][x];
            totalChemA += cell.chemical_A;
            totalChemB += cell.chemical_B;
            totalLight += cell.light;
            totalOrganic += cell.organic_matter;
        }
    }

    const cellCount = env.rows * env.cols;

    return {
        temperature: env.temperature,
        viscosity: env.viscosity,
        avgChemicalA: totalChemA / cellCount,
        avgChemicalB: totalChemB / cellCount,
        avgLight: totalLight / cellCount,
        avgOrganicMatter: totalOrganic / cellCount,
        totalResources: totalChemA + totalChemB + totalLight + totalOrganic,
        toxicZoneCount: env.toxicZones.length,
        resourceSpotCount: env.resourceSpots.length
    };
}

/**
 * Serialize environment for saving
 */
export function serializeEnvironment() {
    const env = state.environment;
    if (!env) return null;

    return {
        width: env.width,
        height: env.height,
        cellSize: env.cellSize,
        cols: env.cols,
        rows: env.rows,
        resources: env.resources,
        temperature: env.temperature,
        viscosity: env.viscosity,
        time: env.time,
        generation: env.generation,
        current: env.current,
        toxicZones: env.toxicZones,
        resourceSpots: env.resourceSpots
    };
}

/**
 * Deserialize environment from saved data
 */
export function deserializeEnvironment(data) {
    if (!data) {
        state.environment = createEnvironment();
        return;
    }

    state.environment = {
        width: data.width,
        height: data.height,
        cellSize: data.cellSize,
        cols: data.cols,
        rows: data.rows,
        resources: data.resources,
        temperature: data.temperature,
        viscosity: data.viscosity,
        time: data.time,
        generation: data.generation,
        current: data.current || { x: 0, y: 0 },
        toxicZones: data.toxicZones || [],
        resourceSpots: data.resourceSpots || []
    };
}

/**
 * Process agent feeding from environment
 */
export function processFeeding(agent, dt) {
    if (!agent.alive) return 0;

    const cell = getResourceCell(agent.position.x, agent.position.y);
    if (!cell) return 0;

    const metabolism = agent.genome.metabolism;
    let energyGained = 0;

    // Chemotrophy - consume chemicals
    if (metabolism.primary_food === 'chemical_A' || metabolism.primary_food === 'chemical_B' ||
        metabolism.secondary_food === 'chemical_A' || metabolism.secondary_food === 'chemical_B') {
        const isPrimary = metabolism.primary_food === 'chemical_A' || metabolism.primary_food === 'chemical_B';
        const efficiency = isPrimary ? metabolism.efficiency : metabolism.efficiency * 0.5;

        // Consume both chemicals
        const consumeA = Math.min(cell.chemical_A, efficiency * dt * 0.1);
        const consumeB = Math.min(cell.chemical_B, efficiency * dt * 0.1);

        cell.chemical_A -= consumeA;
        cell.chemical_B -= consumeB;

        energyGained += (consumeA + consumeB) * CONFIG.ENERGY_FROM_CHEMICAL * efficiency;
    }

    // Phototrophy - absorb light
    if (metabolism.primary_food === 'light' || metabolism.secondary_food === 'light') {
        const isPrimary = metabolism.primary_food === 'light';
        const efficiency = isPrimary ? metabolism.efficiency : metabolism.efficiency * 0.5;

        const lightAbsorbed = cell.light * efficiency * dt * 0.1;
        energyGained += lightAbsorbed * CONFIG.ENERGY_FROM_LIGHT * efficiency;
    }

    // Heterotrophy - consume organic matter
    if (metabolism.primary_food === 'organic_matter' || metabolism.secondary_food === 'organic_matter') {
        const isPrimary = metabolism.primary_food === 'organic_matter';
        const efficiency = isPrimary ? metabolism.efficiency : metabolism.efficiency * 0.5;

        const consumed = Math.min(cell.organic_matter, efficiency * dt * 0.2);
        cell.organic_matter -= consumed;

        energyGained += consumed * CONFIG.ENERGY_FROM_ORGANIC * efficiency;
    }

    // Apply efficiency bonus if present
    energyGained *= (1 + (agent.metabolism_efficiency_bonus || 0));

    // Add energy to agent
    const added = Math.min(
        energyGained,
        agent.genome.metabolism.storage_capacity - agent.energy
    );
    agent.energy += added;

    return added;
}

/**
 * Agent - A living organism in the simulation
 *
 * Agents have a physical body constructed from their genome,
 * energy for survival, and can participate in social interactions.
 */

import { CONFIG } from '../config.js';
import { generateUUID, vec, copy, randomInRect } from '../utils/math.js';
import { RingBuffer } from '../utils/ringbuffer.js';
import { markAgentDead } from '../state.js';
import {
    generateRandomGenome,
    cloneGenome,
    mutateGenome,
    crossover,
    calculateTotalPleiotropyEffect,
    calculateGrowthTradeOff,
    getSignalingCost,
    calculateCondition
} from './genome.js';

/**
 * Create a new agent from a genome
 */
export function createAgent(genome, options = {}) {
    const id = options.id || generateUUID();

    // Starting position
    const position = options.position || randomInRect(
        CONFIG.WORLD_WIDTH,
        CONFIG.WORLD_HEIGHT
    );

    // Build physical body from genome
    const body = buildBody(genome, position);

    const agent = {
        // Identity
        id,
        alive: true,

        // Position and movement (center of mass)
        position: vec(position.x, position.y),
        velocity: vec(0, 0),

        // Physical body
        body,

        // Genome
        genome: cloneGenome(genome),

        // Energy and survival
        energy: options.energy ?? CONFIG.INITIAL_ENERGY,
        age: 0,
        fitness: 0,

        // Starting position (for fitness calculation)
        startPosition: vec(position.x, position.y),

        // Statistics
        total_energy_gathered: 0,
        total_distance: 0,
        offspring: 0,
        offspring_count: 0,
        successful_transfers: 0,
        infections_survived: 0,

        // LINEAGE TRACKING (for Hamilton's Rule kin selection)
        // Stores ancestor IDs to calculate coefficient of relatedness
        lineage: {
            parent_ids: options.parent_ids || [],     // [parent1_id, parent2_id] or [parent_id]
            ancestor_chain: options.ancestor_chain || [], // Last 5 generations of ancestor IDs
            generation_born: options.generation_born || 0
        },

        // Infection state
        infection: null,

        // Social links
        cooperative_links: [],
        symbiont: null,
        host: null,

        // Temporary bonuses (from symbiosis, cooperation, etc.)
        movement_bonus: 1.0,
        effective_mass_bonus: 0,
        sense_range_multiplier: 1.0,
        metabolism_efficiency_bonus: 0,

        // PHENOTYPIC PLASTICITY state
        // Allows organisms to adjust to environment without genetic change
        plasticity: {
            acclimated_temperature: 0.5,      // Current temperature adaptation
            metabolic_upregulation: 1.0,      // Adjusts based on food availability
            recent_energy_intake: new RingBuffer(100),  // Fixed-size rolling buffer - O(1) push
            stress_level: 0                   // Accumulated environmental stress
        },

        // MATERNAL EFFECTS (Transgenerational Plasticity)
        // Non-genetic inheritance from mother's environment/condition
        maternal_effects: options.maternal_effects || {
            maternal_stress: 0,               // Mother's stress level at conception
            maternal_energy: 1.0,             // Mother's energy ratio at conception
            maternal_environment: null,       // Zone/conditions mother was in
            generation_offset: 0,             // Generations since maternal exposure (decays)
            effects_applied: false            // Whether effects have been applied to phenotype
        },

        // BEHAVIORAL LEARNING state
        // Simple reinforcement learning and spatial memory
        memory: {
            // Spatial memory: grid of remembered locations (food/danger)
            // Key: "x_y" (grid cell), Value: { food: number, danger: number, lastVisit: tick }
            spatial_map: new Map(),

            // Recent experiences for reinforcement learning
            // { action: string, outcome: number (-1 to 1), position: {x,y}, tick: number }
            experiences: [],

            // Learned action biases (modified by experience)
            action_biases: {
                explore: 0,      // Tendency to visit new areas
                exploit: 0,      // Tendency to revisit good areas
                flee: 0,         // Learned flee response
                approach: 0      // Learned approach response
            },

            // Memory decay - older memories fade
            memory_strength: 1.0
        },

        // Last position for distance tracking
        _lastPosition: vec(position.x, position.y)
    };

    return agent;
}

/**
 * Build physical body from genome
 */
export function buildBody(genome, worldPosition) {
    // Clone genome nodes and create physical nodes
    const nodes = genome.nodes.map((geneNode, idx) => ({
        id: idx,
        // Position in world coordinates
        position: vec(
            worldPosition.x + geneNode.position.x,
            worldPosition.y + geneNode.position.y
        ),
        // Velocity
        velocity: vec(0, 0),
        // Accumulated force
        force: vec(0, 0),
        // Physical properties from genome
        mass: geneNode.mass,
        friction: geneNode.friction,
        // For collision detection
        touching_surface: false
    }));

    // Clone links with current state
    const links = genome.links.map(geneLink => ({
        id: geneLink.id,
        node_a: geneLink.node_a,
        node_b: geneLink.node_b,
        rest_length: geneLink.rest_length,
        stiffness: geneLink.stiffness,
        damping: geneLink.damping,
        // Current target length (modified by motors)
        target_length: geneLink.rest_length,
        // Does this link have a motor?
        has_motor: genome.motors.some(m => m.attached_to === geneLink.id)
    }));

    // Clone motors with runtime state
    const motors = genome.motors.map(geneMotor => ({
        id: geneMotor.id,
        attached_to: geneMotor.attached_to,
        cycle_speed: geneMotor.cycle_speed,
        amplitude: geneMotor.amplitude,
        phase_offset: geneMotor.phase_offset,
        energy_cost: geneMotor.energy_cost,
        sensor_modulation: geneMotor.sensor_modulation,
        // Runtime state
        current_phase: geneMotor.phase_offset
    }));

    // Clone sensors with runtime state
    const sensors = genome.sensors.map(geneSensor => ({
        id: geneSensor.id,
        type: geneSensor.type,
        sensitivity: geneSensor.sensitivity,
        range: geneSensor.range,
        target: geneSensor.target,
        output_gain: geneSensor.output_gain,
        // Runtime state
        current_value: 0
    }));

    return {
        nodes,
        links,
        motors,
        sensors
    };
}

/**
 * Update agent's center position and velocity from body nodes
 */
export function updateAgentCenter(agent) {
    const nodes = agent.body.nodes;
    if (nodes.length === 0) return;

    let cx = 0, cy = 0;
    let vx = 0, vy = 0;
    let totalMass = 0;

    for (const node of nodes) {
        cx += node.position.x * node.mass;
        cy += node.position.y * node.mass;
        vx += node.velocity.x * node.mass;
        vy += node.velocity.y * node.mass;
        totalMass += node.mass;
    }

    if (totalMass > 0) {
        agent.position.x = cx / totalMass;
        agent.position.y = cy / totalMass;
        agent.velocity.x = vx / totalMass;
        agent.velocity.y = vy / totalMass;
    }
}

/**
 * Get total mass of agent
 */
export function getAgentMass(agent) {
    let mass = 0;
    for (const node of agent.body.nodes) {
        mass += node.mass;
    }
    return mass + agent.effective_mass_bonus;
}

/**
 * Get agent's bounding radius (for collision detection)
 */
export function getAgentRadius(agent) {
    let maxDist = 0;

    for (const node of agent.body.nodes) {
        const dx = node.position.x - agent.position.x;
        const dy = node.position.y - agent.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist) maxDist = dist;
    }

    return maxDist + CONFIG.COLLISION_RADIUS;
}

/**
 * Apply force to all nodes of an agent
 */
export function applyForceToAgent(agent, forceX, forceY) {
    const forcePerNode = {
        x: forceX / agent.body.nodes.length,
        y: forceY / agent.body.nodes.length
    };

    for (const node of agent.body.nodes) {
        node.force.x += forcePerNode.x;
        node.force.y += forcePerNode.y;
    }
}

/**
 * Apply impulse to move agent instantly
 */
export function applyImpulseToAgent(agent, impulseX, impulseY) {
    const impulsePerNode = {
        x: impulseX / agent.body.nodes.length,
        y: impulseY / agent.body.nodes.length
    };

    for (const node of agent.body.nodes) {
        node.velocity.x += impulsePerNode.x;
        node.velocity.y += impulsePerNode.y;
    }
}

/**
 * Check if agent can eat a food type
 */
export function canEat(agent, foodType) {
    return agent.genome.metabolism.primary_food === foodType ||
           agent.genome.metabolism.secondary_food === foodType;
}

/**
 * Get effective metabolism efficiency
 */
export function getEfficiency(agent) {
    return agent.genome.metabolism.efficiency + agent.metabolism_efficiency_bonus;
}

/**
 * Get effective sensor range
 */
export function getSensorRange(agent, sensorType) {
    const sensor = agent.body.sensors.find(s => s.type === sensorType);
    if (!sensor) return 0;
    return sensor.range * agent.sense_range_multiplier;
}

/**
 * Update distance traveled
 */
export function updateDistanceTraveled(agent) {
    const dx = agent.position.x - agent._lastPosition.x;
    const dy = agent.position.y - agent._lastPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    agent.total_distance += dist;

    agent._lastPosition.x = agent.position.x;
    agent._lastPosition.y = agent.position.y;
}

/**
 * PHENOTYPIC PLASTICITY: Update agent's plastic responses to environment
 *
 * Allows organisms to adjust phenotype without genetic change:
 * - Temperature acclimation (slow adjustment to ambient temp)
 * - Metabolic upregulation/downregulation based on food availability
 * - Stress accumulation affecting behavior
 *
 * Trade-off: High plasticity = more adaptable but higher metabolic cost
 */
export function updatePlasticity(agent, envTemperature, dt) {
    // Initialize plasticity state if needed
    if (!agent.plasticity) {
        agent.plasticity = {
            acclimated_temperature: 0.5,
            metabolic_upregulation: 1.0,
            recent_energy_intake: new RingBuffer(100),
            stress_level: 0
        };
    }

    // Get plasticity genome traits with defaults
    const plasticityTraits = agent.genome.metabolism.plasticity || {
        plasticity_range: 0.3,
        acclimation_rate: 0.005,
        plasticity_cost: 0.02
    };

    // === TEMPERATURE ACCLIMATION ===
    // Slowly shift acclimated temperature toward environmental temperature
    const tempDiff = envTemperature - agent.plasticity.acclimated_temperature;
    const acclimationAmount = tempDiff * plasticityTraits.acclimation_rate * plasticityTraits.plasticity_range * dt;
    agent.plasticity.acclimated_temperature += acclimationAmount;

    // Calculate temperature stress (difference between env and acclimated)
    const tempStress = Math.abs(envTemperature - agent.plasticity.acclimated_temperature);

    // === METABOLIC PLASTICITY ===
    // Track recent energy intake using RingBuffer (no manual trimming needed - O(1))
    const recentIntake = agent.plasticity.recent_energy_intake;

    // Calculate average recent intake - RingBuffer handles bounded size automatically
    const avgIntake = recentIntake.average();

    // Adjust metabolic rate based on food availability
    if (avgIntake < 0.5) {
        // Low food - downregulate metabolism to conserve energy
        agent.plasticity.metabolic_upregulation = Math.max(0.7,
            agent.plasticity.metabolic_upregulation - 0.001 * plasticityTraits.plasticity_range * dt
        );
    } else if (avgIntake > 2) {
        // High food - upregulate metabolism to process more
        agent.plasticity.metabolic_upregulation = Math.min(1.5,
            agent.plasticity.metabolic_upregulation + 0.002 * plasticityTraits.plasticity_range * dt
        );
    } else {
        // Normal - drift back toward 1.0
        agent.plasticity.metabolic_upregulation += (1.0 - agent.plasticity.metabolic_upregulation) * 0.001 * dt;
    }

    // === STRESS ACCUMULATION ===
    // Stress from temperature mismatch and low energy
    const energyRatio = agent.energy / agent.genome.metabolism.storage_capacity;
    const energyStress = Math.max(0, 0.5 - energyRatio);  // Stress when below 50% energy

    // Accumulate or recover stress
    const stressInput = (tempStress * 2 + energyStress) * dt;
    const stressRecovery = 0.01 * dt;
    agent.plasticity.stress_level = Math.max(0, Math.min(1,
        agent.plasticity.stress_level + stressInput - stressRecovery
    ));

    // === PLASTICITY COST ===
    // Maintaining plasticity machinery costs energy
    const plasticityCost = plasticityTraits.plasticity_cost * plasticityTraits.plasticity_range * dt;
    agent.energy -= plasticityCost;

    // === APPLY PLASTICITY BONUSES ===
    // Well-acclimated agents get efficiency bonus
    const acclimationBonus = (1 - tempStress) * 0.1 * plasticityTraits.plasticity_range;
    agent.metabolism_efficiency_bonus += acclimationBonus;
}

/**
 * Record energy intake for plasticity tracking
 */
export function recordEnergyIntake(agent, amount) {
    if (!agent.plasticity) return;
    agent.plasticity.recent_energy_intake.push(amount);
}

// === BEHAVIORAL LEARNING SYSTEM ===
// Simple reinforcement learning and spatial memory
// Allows agents to learn from experience within their lifetime

// Grid cell size for spatial memory (larger = less precise but more efficient)
const MEMORY_GRID_SIZE = 50;

/**
 * Convert world position to grid cell key
 */
function positionToGridKey(x, y) {
    const gx = Math.floor(x / MEMORY_GRID_SIZE);
    const gy = Math.floor(y / MEMORY_GRID_SIZE);
    return `${gx}_${gy}`;
}

/**
 * Update agent's spatial memory after encountering food
 */
export function rememberFood(agent, x, y, amount, currentTick) {
    if (!agent.memory) return;

    const learningTraits = agent.genome.social?.learning || { memory_capacity: 0.5, learning_rate: 0.05 };
    const key = positionToGridKey(x, y);

    let cell = agent.memory.spatial_map.get(key);
    if (!cell) {
        cell = { food: 0, danger: 0, lastVisit: currentTick };
        agent.memory.spatial_map.set(key, cell);
    }

    // Update food memory with learning rate
    cell.food += amount * learningTraits.learning_rate * 10;
    cell.food = Math.min(cell.food, 10);  // Cap at 10
    cell.lastVisit = currentTick;

    // Limit memory size based on capacity trait
    const maxCells = Math.floor(learningTraits.memory_capacity * 100) + 10;
    if (agent.memory.spatial_map.size > maxCells) {
        // Remove oldest entries
        trimSpatialMemory(agent, maxCells);
    }
}

/**
 * Update agent's spatial memory after encountering danger
 */
export function rememberDanger(agent, x, y, severity, currentTick) {
    if (!agent.memory) return;

    const learningTraits = agent.genome.social?.learning || { memory_capacity: 0.5, learning_rate: 0.05 };
    const key = positionToGridKey(x, y);

    let cell = agent.memory.spatial_map.get(key);
    if (!cell) {
        cell = { food: 0, danger: 0, lastVisit: currentTick };
        agent.memory.spatial_map.set(key, cell);
    }

    // Update danger memory with learning rate
    cell.danger += severity * learningTraits.learning_rate * 10;
    cell.danger = Math.min(cell.danger, 10);  // Cap at 10
    cell.lastVisit = currentTick;

    // Also record as negative experience
    recordExperience(agent, 'flee', -severity, x, y, currentTick);
}

/**
 * Record an experience for reinforcement learning
 */
export function recordExperience(agent, action, outcome, x, y, currentTick) {
    if (!agent.memory) return;

    const learningTraits = agent.genome.social?.learning || { learning_rate: 0.05 };

    // Add to experience buffer
    agent.memory.experiences.push({
        action,
        outcome: Math.max(-1, Math.min(1, outcome)),  // Clamp to [-1, 1]
        position: { x, y },
        tick: currentTick
    });

    // Limit experience buffer size
    while (agent.memory.experiences.length > 50) {
        agent.memory.experiences.shift();
    }

    // Update action biases based on outcome
    const bias = agent.memory.action_biases;
    const learningAmount = outcome * learningTraits.learning_rate;

    switch (action) {
        case 'explore':
            bias.explore += learningAmount;
            break;
        case 'exploit':
            bias.exploit += learningAmount;
            break;
        case 'flee':
            // Negative outcome increases flee response
            bias.flee -= learningAmount;  // Note: negative outcome -> positive flee
            break;
        case 'approach':
            bias.approach += learningAmount;
            break;
    }

    // Clamp biases
    for (const key of Object.keys(bias)) {
        bias[key] = Math.max(-1, Math.min(1, bias[key]));
    }
}

/**
 * Get memory-based movement guidance
 * Returns a direction vector suggesting where to move based on memory
 */
export function getMemoryGuidance(agent, currentX, currentY, currentTick) {
    if (!agent.memory || agent.memory.spatial_map.size === 0) {
        return { x: 0, y: 0, confidence: 0 };
    }

    const learningTraits = agent.genome.social?.learning || { exploration_drive: 0.5 };
    const biases = agent.memory.action_biases;

    let attractX = 0, attractY = 0;
    let repelX = 0, repelY = 0;
    let totalWeight = 0;

    // Look at nearby remembered cells
    const searchRadius = 3;  // Grid cells
    const currentGx = Math.floor(currentX / MEMORY_GRID_SIZE);
    const currentGy = Math.floor(currentY / MEMORY_GRID_SIZE);

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            if (dx === 0 && dy === 0) continue;

            const key = `${currentGx + dx}_${currentGy + dy}`;
            const cell = agent.memory.spatial_map.get(key);
            if (!cell) continue;

            // Calculate direction and distance
            const dirX = dx / Math.sqrt(dx * dx + dy * dy);
            const dirY = dy / Math.sqrt(dx * dx + dy * dy);
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Food attracts (exploit), weighted by memory age
            const ageFactor = Math.exp(-0.001 * (currentTick - cell.lastVisit));
            const foodWeight = cell.food * ageFactor * (1 + biases.exploit);
            attractX += dirX * foodWeight / dist;
            attractY += dirY * foodWeight / dist;

            // Danger repels, weighted by flee bias
            const dangerWeight = cell.danger * ageFactor * (1 + biases.flee);
            repelX -= dirX * dangerWeight / dist;
            repelY -= dirY * dangerWeight / dist;

            totalWeight += foodWeight + dangerWeight;
        }
    }

    // Combine attraction and repulsion
    let guidanceX = attractX + repelX;
    let guidanceY = attractY + repelY;

    // Add exploration tendency - prefer unvisited directions
    if (learningTraits.exploration_drive > 0.3 + biases.explore) {
        // Add some random exploration
        guidanceX += (Math.random() - 0.5) * learningTraits.exploration_drive;
        guidanceY += (Math.random() - 0.5) * learningTraits.exploration_drive;
    }

    // Normalize
    const mag = Math.sqrt(guidanceX * guidanceX + guidanceY * guidanceY);
    if (mag > 0.01) {
        guidanceX /= mag;
        guidanceY /= mag;
    }

    // Confidence based on amount of memory data
    const confidence = Math.min(1, totalWeight / 10) * agent.memory.memory_strength;

    return { x: guidanceX, y: guidanceY, confidence };
}

/**
 * Update memory decay and learning costs
 */
export function updateLearning(agent, dt, currentTick) {
    if (!agent.memory) return;

    const learningTraits = agent.genome.social?.learning || {
        memory_decay: 0.005,
        learning_cost: 0.02,
        memory_capacity: 0.5
    };

    // === MEMORY DECAY ===
    // Older memories fade over time
    for (const [key, cell] of agent.memory.spatial_map.entries()) {
        const age = currentTick - cell.lastVisit;
        const decayFactor = Math.exp(-learningTraits.memory_decay * age * 0.01);

        cell.food *= decayFactor;
        cell.danger *= decayFactor;

        // Remove very faint memories
        if (cell.food < 0.01 && cell.danger < 0.01) {
            agent.memory.spatial_map.delete(key);
        }
    }

    // === ACTION BIAS DECAY ===
    // Learned biases slowly return toward zero (extinction)
    const biasDecay = 0.0001 * dt;
    for (const key of Object.keys(agent.memory.action_biases)) {
        const bias = agent.memory.action_biases[key];
        agent.memory.action_biases[key] = bias * (1 - biasDecay);
    }

    // === MEMORY STRENGTH ===
    // Overall memory strength can decline under stress
    if (agent.plasticity?.stress_level > 0.5) {
        agent.memory.memory_strength = Math.max(0.5,
            agent.memory.memory_strength - 0.001 * agent.plasticity.stress_level * dt
        );
    } else {
        // Recover memory strength when not stressed
        agent.memory.memory_strength = Math.min(1.0,
            agent.memory.memory_strength + 0.0005 * dt
        );
    }

    // === LEARNING COST ===
    // Maintaining neural/learning machinery costs energy
    // Scales with memory capacity
    const learningCost = learningTraits.learning_cost * learningTraits.memory_capacity * dt;
    agent.energy -= learningCost;
}

/**
 * Trim spatial memory to max size (remove oldest entries)
 */
function trimSpatialMemory(agent, maxCells) {
    if (agent.memory.spatial_map.size <= maxCells) return;

    // Convert to array and sort by lastVisit
    const entries = [...agent.memory.spatial_map.entries()];
    entries.sort((a, b) => a[1].lastVisit - b[1].lastVisit);

    // Remove oldest until at capacity
    while (entries.length > maxCells) {
        const [key] = entries.shift();
        agent.memory.spatial_map.delete(key);
    }
}

/**
 * Check if agent should die
 * Enhanced with size-dependent mortality and antagonistic pleiotropy
 */
export function shouldDie(agent) {
    if (!agent.alive) return true;
    if (agent.energy <= CONFIG.DEATH_ENERGY_THRESHOLD) return true;

    // BIOLOGICAL REALISM: Larger organisms have higher metabolic costs
    // Calculate body size penalty
    const bodySize = agent.genome.nodes.length + agent.genome.motors.length;
    const sizePenalty = Math.max(0, (bodySize - 10) * 0.5);  // Penalty starts at 10 nodes

    // Apply size penalty to energy drain
    agent.energy -= sizePenalty * 0.01;

    // ANTAGONISTIC PLEIOTROPY: Apply life history trade-off costs
    // High vigor, high immune investment, etc. have metabolic costs
    const pleiotropyEffects = calculateTotalPleiotropyEffect(agent.genome, agent.age);
    agent.energy -= pleiotropyEffects.energy_cost;

    // HONEST SIGNALING: Apply condition-dependent signaling costs (Zahavi's handicap)
    // Signals are costly to produce, and poor-condition individuals pay more
    const signalingCost = getSignalingCost(agent, 1);  // dt=1 for per-tick cost
    agent.energy -= signalingCost;

    // SENESCENCE: Gompertz-Makeham mortality model
    // Mortality = baseline + exponential(age) after senescence threshold
    // Enhanced with pleiotropy-based aging acceleration
    const mortalityRate = calculateAgeMortality(agent, pleiotropyEffects);
    if (Math.random() < mortalityRate) {
        return true;
    }

    return false;
}

/**
 * Calculate age-dependent mortality using Gompertz-Makeham model
 * Medawar-Williams theory: selection weakens with age
 * Enhanced with antagonistic pleiotropy effects (Williams 1957)
 */
function calculateAgeMortality(agent, pleiotropyEffects = null) {
    const baseline = CONFIG.BASELINE_MORTALITY;
    const senescenceAge = CONFIG.SENESCENCE_AGE;
    let agingRate = CONFIG.AGING_RATE;

    // Antagonistic pleiotropy: high vigor accelerates aging
    if (pleiotropyEffects) {
        agingRate += pleiotropyEffects.aging_acceleration;
    }

    // Before senescence age: only baseline mortality (with early vigor bonus)
    if (agent.age < senescenceAge) {
        // Early life benefit from pleiotropy (if present)
        const earlyBonus = pleiotropyEffects?.fitness_modifier > 1.0 ? 0.5 : 1.0;
        return baseline * earlyBonus;
    }

    // After senescence: exponential increase in mortality
    // Gompertz component: mortality doubles every ~140 ticks after senescence
    // Pleiotropy amplifies this decline
    const ageFactor = agent.age - senescenceAge;
    let mortality = baseline * Math.exp(agingRate * ageFactor);

    // Late-life penalty from antagonistic pleiotropy
    if (pleiotropyEffects && pleiotropyEffects.fitness_modifier < 1.0) {
        mortality *= (2 - pleiotropyEffects.fitness_modifier);  // Up to 2x mortality
    }

    return mortality;
}

// === BET-HEDGING: DORMANCY SYSTEM ===

/**
 * Check if agent should enter dormancy (conservative bet-hedging)
 * Dormancy allows organisms to survive harsh conditions at reduced metabolism
 */
export function shouldEnterDormancy(agent, environmentalStress = 0) {
    if (agent.isDormant) return false;  // Already dormant

    const betHedging = agent.genome.bet_hedging;
    if (!betHedging || betHedging.dormancy_tendency < 0.01) return false;

    // Calculate energy ratio
    const energyRatio = agent.energy / agent.genome.metabolism.storage_capacity;

    // Probability increases with:
    // 1. Low energy (below threshold)
    // 2. High dormancy tendency trait
    // 3. Environmental stress

    if (energyRatio > betHedging.dormancy_threshold) {
        return false;  // Not stressed enough
    }

    const baseProbability = betHedging.dormancy_tendency;
    const stressMultiplier = 1 + environmentalStress * 2;
    const energyMultiplier = 1 + (betHedging.dormancy_threshold - energyRatio) * 3;

    return Math.random() < baseProbability * stressMultiplier * energyMultiplier * 0.01;
}

/**
 * Enter dormancy state
 */
export function enterDormancy(agent) {
    agent.isDormant = true;
    agent.dormancy_start_tick = agent.age;
    agent.dormancy_target_duration = agent.genome.bet_hedging?.dormancy_duration || 100;
}

/**
 * Check if agent should exit dormancy
 */
export function shouldExitDormancy(agent, environmentalQuality = 0.5) {
    if (!agent.isDormant) return false;

    const ticksInDormancy = agent.age - (agent.dormancy_start_tick || 0);
    const targetDuration = agent.dormancy_target_duration || 100;

    // Minimum dormancy period
    if (ticksInDormancy < 20) return false;

    // Exit probability increases with:
    // 1. Time in dormancy (approaching target duration)
    // 2. Good environmental conditions
    // 3. Accumulated energy (if somehow gained)

    const durationFactor = ticksInDormancy / targetDuration;
    const environmentFactor = environmentalQuality;

    // Past target duration: high exit probability
    if (durationFactor > 1.0) {
        return Math.random() < 0.1 * environmentFactor;
    }

    // Before target: lower exit probability
    return Math.random() < 0.02 * durationFactor * environmentFactor;
}

/**
 * Exit dormancy state
 */
export function exitDormancy(agent) {
    agent.isDormant = false;
    agent.dormancy_start_tick = null;
    agent.dormancy_target_duration = null;
}

/**
 * Get dormancy metabolism modifier
 * Dormant organisms have greatly reduced metabolism (survive longer on little energy)
 */
export function getDormancyMetabolismModifier(agent) {
    if (!agent.isDormant) return 1.0;
    return 0.1;  // 90% reduction in metabolism when dormant
}

/**
 * Kill an agent and mark for efficient batch removal
 */
export function killAgent(agent) {
    markAgentDead(agent);  // O(1) tracking for batch removal
    agent.energy = 0;

    // Clear social links
    agent.cooperative_links = [];
    agent.symbiont = null;
    agent.host = null;
}

/**
 * Create offspring from parent (asexual reproduction)
 * Uses life history traits for r/K selection dynamics
 */
export function reproduceAsexual(parent, mutate = true) {
    // Get life history traits with defaults
    const lifeHistory = parent.genome.metabolism.life_history || {
        offspring_investment: 0.4,
        clutch_size: 1,
        maturation_age: 100,
        reproductive_effort: 0.5
    };

    // Check maturation age
    if (parent.age < lifeHistory.maturation_age) {
        return null;  // Too young to reproduce
    }

    // Calculate energy costs based on life history
    const investmentPerOffspring = lifeHistory.offspring_investment;
    const clutchSize = lifeHistory.clutch_size;
    const energyPerChild = investmentPerOffspring * parent.genome.metabolism.storage_capacity;
    const totalCost = energyPerChild * clutchSize * 1.1;  // 10% overhead

    // Check if parent has enough energy (keep survival buffer)
    const survivalBuffer = parent.genome.metabolism.storage_capacity * 0.2;
    if (parent.energy < totalCost + survivalBuffer) {
        return null;  // Not enough energy for full clutch
    }

    const offspring = [];

    for (let i = 0; i < clutchSize; i++) {
        // Clone genome
        let childGenome = cloneGenome(parent.genome);

        // Mutate if requested
        if (mutate) {
            mutateGenome(childGenome);
        }

        // Create child near parent (spread out for clutch)
        const angle = (i / clutchSize) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 15 + Math.random() * 15;
        const childPosition = {
            x: parent.position.x + Math.cos(angle) * dist,
            y: parent.position.y + Math.sin(angle) * dist
        };

        // Clamp to world bounds
        childPosition.x = Math.max(10, Math.min(CONFIG.WORLD_WIDTH - 10, childPosition.x));
        childPosition.y = Math.max(10, Math.min(CONFIG.WORLD_HEIGHT - 10, childPosition.y));

        const child = createAgent(childGenome, {
            position: childPosition,
            energy: energyPerChild  // Energy based on investment trait
        });

        offspring.push(child);
        parent.energy -= energyPerChild * 1.1;  // Cost includes overhead
    }

    parent.offspring_count += clutchSize;

    // Return array of offspring (or single child for backward compatibility)
    return offspring.length === 1 ? offspring[0] : offspring;
}

/**
 * Create offspring from two parents (sexual reproduction)
 * Uses averaged life history traits from both parents
 */
export function reproduceSexual(parentA, parentB, mutate = true) {
    // Get life history traits (average of both parents)
    const lifeHistoryA = parentA.genome.metabolism.life_history || {
        offspring_investment: 0.4, clutch_size: 1, maturation_age: 100
    };
    const lifeHistoryB = parentB.genome.metabolism.life_history || {
        offspring_investment: 0.4, clutch_size: 1, maturation_age: 100
    };

    // Check maturation age for both parents
    const avgMaturationAge = (lifeHistoryA.maturation_age + lifeHistoryB.maturation_age) / 2;
    if (parentA.age < avgMaturationAge || parentB.age < avgMaturationAge) {
        return null;  // One or both too young
    }

    // Average investment from both parents
    const avgInvestment = (lifeHistoryA.offspring_investment + lifeHistoryB.offspring_investment) / 2;
    // For sexual reproduction, take smaller clutch size (more conservative)
    const clutchSize = Math.min(lifeHistoryA.clutch_size, lifeHistoryB.clutch_size);

    // Each parent contributes half
    const avgCapacity = (parentA.genome.metabolism.storage_capacity + parentB.genome.metabolism.storage_capacity) / 2;
    const energyPerChild = avgInvestment * avgCapacity;
    const costPerParent = (energyPerChild * clutchSize * 1.1) / 2;  // Split cost

    // Check if both parents have enough energy
    const survivalBuffer = 20;
    if (parentA.energy < costPerParent + survivalBuffer ||
        parentB.energy < costPerParent + survivalBuffer) {
        return null;
    }

    const offspring = [];

    for (let i = 0; i < clutchSize; i++) {
        // Create child genome through crossover
        let childGenome = crossover(parentA.genome, parentB.genome);

        // Mutate if requested
        if (mutate) {
            mutateGenome(childGenome);
        }

        // Create child between parents (spread out for clutch)
        const angle = (i / clutchSize) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 10 + Math.random() * 10;
        const midX = (parentA.position.x + parentB.position.x) / 2;
        const midY = (parentA.position.y + parentB.position.y) / 2;
        const childPosition = {
            x: midX + Math.cos(angle) * dist,
            y: midY + Math.sin(angle) * dist
        };

        // Clamp to world bounds
        childPosition.x = Math.max(10, Math.min(CONFIG.WORLD_WIDTH - 10, childPosition.x));
        childPosition.y = Math.max(10, Math.min(CONFIG.WORLD_HEIGHT - 10, childPosition.y));

        const child = createAgent(childGenome, {
            position: childPosition,
            energy: energyPerChild
        });

        offspring.push(child);
    }

    // Parents lose energy (split cost)
    parentA.energy -= costPerParent;
    parentB.energy -= costPerParent;
    parentA.offspring_count += clutchSize;
    parentB.offspring_count += clutchSize;

    // Return array of offspring (or single child for backward compatibility)
    return offspring.length === 1 ? offspring[0] : offspring;
}

/**
 * Reset temporary bonuses (called each tick)
 */
export function resetBonuses(agent) {
    agent.movement_bonus = 1.0;
    agent.effective_mass_bonus = 0;
    agent.sense_range_multiplier = 1.0;
    agent.metabolism_efficiency_bonus = 0;
}

/**
 * Check if two agents are kin (same species)
 */
export function isKin(agentA, agentB) {
    const markerDiff = Math.abs(
        agentA.genome.species_marker - agentB.genome.species_marker
    );
    return markerDiff < CONFIG.KIN_RECOGNITION_THRESHOLD;
}

/**
 * HAMILTON'S RULE: Calculate coefficient of relatedness between two agents
 *
 * r = 0.5^n where n is generations to most recent common ancestor
 * - Parent-offspring: r = 0.5
 * - Full siblings: r = 0.5
 * - Half-siblings: r = 0.25
 * - Cousins: r = 0.125
 * - Unrelated: r ≈ 0
 *
 * @returns {number} Coefficient of relatedness (0-1)
 */
export function calculateRelatedness(agentA, agentB) {
    // Same agent = r = 1
    if (agentA.id === agentB.id) return 1.0;

    // Initialize lineage if missing
    const lineageA = agentA.lineage || { parent_ids: [], ancestor_chain: [] };
    const lineageB = agentB.lineage || { parent_ids: [], ancestor_chain: [] };

    // Check parent-offspring relationship (r = 0.5)
    if (lineageA.parent_ids.includes(agentB.id) || lineageB.parent_ids.includes(agentA.id)) {
        return 0.5;
    }

    // Check if they share a parent (siblings, r = 0.5 for full, 0.25 for half)
    const sharedParents = lineageA.parent_ids.filter(id => lineageB.parent_ids.includes(id));
    if (sharedParents.length === 2) {
        return 0.5;  // Full siblings
    } else if (sharedParents.length === 1) {
        return 0.25;  // Half siblings
    }

    // Check ancestor chains for common ancestors
    // ancestor_chain format: [[gen1_parents], [gen2_grandparents], ...]
    const chainA = lineageA.ancestor_chain || [];
    const chainB = lineageB.ancestor_chain || [];

    // Find most recent common ancestor
    for (let genA = 0; genA < chainA.length; genA++) {
        const ancestorsA = chainA[genA] || [];
        for (let genB = 0; genB < chainB.length; genB++) {
            const ancestorsB = chainB[genB] || [];

            // Check for overlap
            for (const ancA of ancestorsA) {
                if (ancestorsB.includes(ancA)) {
                    // Found common ancestor at generation (genA+1) and (genB+1) back
                    // r = 0.5^(genA+1) * 0.5^(genB+1) = 0.5^(genA+genB+2)
                    const n = genA + genB + 2;
                    return Math.pow(0.5, n);
                }
            }
        }
    }

    // No common ancestor found in tracked lineage
    // Fall back to species-based estimate
    if (agentA.genome.species_marker === agentB.genome.species_marker) {
        return 0.02;  // Same species but unknown relationship
    }

    return 0.0;  // Different species = unrelated
}

/**
 * Apply Hamilton's Rule to determine if altruistic act should occur
 *
 * Hamilton's Rule: rB > C
 * - r = coefficient of relatedness
 * - B = benefit to recipient
 * - C = cost to actor
 *
 * @returns {boolean} Whether altruism should occur
 */
export function shouldActAltruistically(actor, recipient, benefit, cost) {
    const r = calculateRelatedness(actor, recipient);

    // Hamilton's Rule: altruism favored when rB > C
    return r * benefit > cost;
}

/**
 * Get lineage chain for a new offspring
 * Combines parent lineages and trims to max depth
 */
export function createOffspringLineage(parents, currentGeneration) {
    const maxDepth = 5;  // Track up to 5 generations back

    // Get parent IDs
    const parentIds = parents.map(p => p.id);

    // Combine parent ancestor chains
    const ancestorChain = [];

    // Generation 0: the parents themselves become ancestors
    ancestorChain.push(parentIds);

    // Merge subsequent generations from both parents
    for (let gen = 0; gen < maxDepth - 1; gen++) {
        const merged = [];
        for (const parent of parents) {
            const parentChain = parent.lineage?.ancestor_chain || [];
            if (parentChain[gen]) {
                merged.push(...parentChain[gen]);
            }
        }
        if (merged.length > 0) {
            // Deduplicate and limit size
            ancestorChain.push([...new Set(merged)].slice(0, 10));
        }
    }

    return {
        parent_ids: parentIds,
        ancestor_chain: ancestorChain.slice(0, maxDepth),
        generation_born: currentGeneration
    };
}

// === MATERNAL EFFECTS (Transgenerational Plasticity) ===
// Non-genetic inheritance from mother's environment and condition

/**
 * Capture maternal state for transmission to offspring
 * Called during reproduction to record mother's condition
 */
export function captureMaternalState(mother) {
    const energyRatio = mother.energy / mother.genome.metabolism.storage_capacity;
    const stressLevel = mother.plasticity?.stress_level || 0;

    return {
        maternal_stress: stressLevel,
        maternal_energy: energyRatio,
        maternal_environment: {
            // Could be extended to include zone info if position available
            temperature_acclimation: mother.plasticity?.acclimated_temperature || 0.5,
            metabolic_state: mother.plasticity?.metabolic_upregulation || 1.0
        },
        generation_offset: 0,  // Fresh maternal effect
        effects_applied: false
    };
}

/**
 * Apply maternal effects to offspring phenotype
 * Stressed mothers produce offspring pre-adapted to harsh conditions
 * Well-fed mothers produce larger, more invested offspring ("silver spoon")
 */
export function applyMaternalEffects(offspring) {
    if (!offspring.maternal_effects || offspring.maternal_effects.effects_applied) {
        return;  // No effects or already applied
    }

    const effects = offspring.maternal_effects;

    // Only apply if effects are fresh (generation_offset < 3)
    if (effects.generation_offset >= 3) {
        effects.effects_applied = true;
        return;  // Effects have decayed
    }

    // Decay factor based on generations since exposure
    const decayFactor = 1 - (effects.generation_offset * 0.3);  // 100% -> 70% -> 40% -> 10%

    // === STRESSED MOTHER EFFECTS (Predictive Adaptive Response) ===
    if (effects.maternal_stress > 0.3) {
        // Stressed mothers produce offspring with:
        // 1. Higher baseline metabolism (prepare for scarcity)
        // 2. More cautious behavior (higher flee threshold)
        // 3. Earlier stress response threshold

        const stressEffect = effects.maternal_stress * decayFactor;

        // Metabolic adjustment - higher metabolism when stress expected
        offspring.plasticity.metabolic_upregulation *= (1 + stressEffect * 0.2);

        // Pre-acclimate to stressful conditions
        offspring.plasticity.stress_level = stressEffect * 0.2;
    }

    // === WELL-FED MOTHER EFFECTS (Silver Spoon Hypothesis) ===
    if (effects.maternal_energy > 0.7) {
        // Well-fed mothers produce offspring with:
        // 1. Energy bonus at birth
        // 2. Slightly larger initial body mass

        const silverSpoonEffect = (effects.maternal_energy - 0.5) * decayFactor;

        // Energy bonus from maternal investment
        offspring.energy *= (1 + silverSpoonEffect * 0.3);

        // Better starting metabolic efficiency
        offspring.metabolism_efficiency_bonus += silverSpoonEffect * 0.1;
    }

    // === POOR CONDITION MOTHER EFFECTS ===
    if (effects.maternal_energy < 0.3) {
        // Undernourished mothers produce smaller offspring
        // But these offspring may be better adapted to scarcity

        const scarcityEffect = (0.5 - effects.maternal_energy) * decayFactor;

        // Slightly reduced starting energy (smaller offspring)
        offspring.energy *= (1 - scarcityEffect * 0.15);

        // But higher metabolic efficiency (thrifty phenotype)
        offspring.metabolism_efficiency_bonus += scarcityEffect * 0.05;
    }

    // === TEMPERATURE ACCLIMATION TRANSFER ===
    if (effects.maternal_environment?.temperature_acclimation !== undefined) {
        // Mother's acclimation partially transfers to offspring
        const tempTransfer = 0.3 * decayFactor;
        offspring.plasticity.acclimated_temperature =
            (1 - tempTransfer) * 0.5 + tempTransfer * effects.maternal_environment.temperature_acclimation;
    }

    effects.effects_applied = true;
}

/**
 * Propagate maternal effects to next generation (with decay)
 * Called when creating offspring of offspring
 */
export function propagateMaternalEffects(parentEffects) {
    if (!parentEffects) {
        return null;  // No effects to propagate
    }

    // Effects decay with each generation
    const newOffset = (parentEffects.generation_offset || 0) + 1;

    if (newOffset >= 3) {
        return null;  // Effects have fully decayed
    }

    return {
        maternal_stress: parentEffects.maternal_stress,
        maternal_energy: parentEffects.maternal_energy,
        maternal_environment: parentEffects.maternal_environment,
        generation_offset: newOffset,
        effects_applied: false
    };
}

/**
 * Get maternal effects modifier for fitness calculation
 * Returns a fitness modifier based on match between maternal prediction and actual environment
 */
export function getMaternalEffectsFitnessModifier(agent, actualStressLevel) {
    if (!agent.maternal_effects || agent.maternal_effects.generation_offset >= 3) {
        return 1.0;  // No modifier
    }

    const predictedStress = agent.maternal_effects.maternal_stress;
    const mismatch = Math.abs(predictedStress - actualStressLevel);

    // Good prediction = bonus, poor prediction = penalty
    // Predictive Adaptive Response only helps if prediction was accurate
    if (mismatch < 0.2) {
        return 1.05;  // 5% bonus for accurate maternal prediction
    } else if (mismatch > 0.5) {
        return 0.95;  // 5% penalty for inaccurate prediction
    }

    return 1.0;
}

/**
 * Get agent info for debugging/display
 */
export function getAgentInfo(agent) {
    return {
        id: agent.id,
        alive: agent.alive,
        position: { ...agent.position },
        energy: agent.energy,
        age: agent.age,
        fitness: agent.fitness,
        species: agent.genome.species_marker,
        generation: agent.genome.generation,
        nodes: agent.body.nodes.length,
        links: agent.body.links.length,
        motors: agent.body.motors.length,
        sensors: agent.body.sensors.length,
        plasmids: agent.genome.hgt.plasmids.length,
        infected: !!agent.infection,
        cooperating: agent.cooperative_links.length > 0,
        symbiotic: !!(agent.symbiont || agent.host)
    };
}

/**
 * Serialize agent for saving
 */
export function serializeAgent(agent) {
    return {
        id: agent.id,
        alive: agent.alive,
        position: { ...agent.position },
        velocity: { ...agent.velocity },
        genome: agent.genome,
        energy: agent.energy,
        age: agent.age,
        fitness: agent.fitness,
        total_energy_gathered: agent.total_energy_gathered,
        total_distance: agent.total_distance,
        offspring_count: agent.offspring_count,
        successful_transfers: agent.successful_transfers,
        infections_survived: agent.infections_survived,
        infection: agent.infection
    };
}

/**
 * Deserialize agent from saved data
 */
export function deserializeAgent(data) {
    const agent = createAgent(data.genome, {
        id: data.id,
        position: data.position,
        energy: data.energy
    });

    agent.alive = data.alive;
    agent.velocity = data.velocity || vec(0, 0);
    agent.age = data.age || 0;
    agent.fitness = data.fitness || 0;
    agent.total_energy_gathered = data.total_energy_gathered || 0;
    agent.total_distance = data.total_distance || 0;
    agent.offspring_count = data.offspring_count || 0;
    agent.successful_transfers = data.successful_transfers || 0;
    agent.infections_survived = data.infections_survived || 0;
    agent.infection = data.infection || null;

    return agent;
}

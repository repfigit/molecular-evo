/**
 * Agent - A living organism in the simulation
 *
 * Agents have a physical body constructed from their genome,
 * energy for survival, and can participate in social interactions.
 */

import { CONFIG } from '../config.js';
import { generateUUID, vec, copy, randomInRect } from '../utils/math.js';
import { generateRandomGenome, cloneGenome, mutateGenome, crossover } from './genome.js';

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
 * Check if agent should die
 * Enhanced with size-dependent mortality
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
    
    // BIOLOGICAL REALISM: Old age increases mortality risk
    // Only check every 10 ticks to reduce computational overhead
    if (agent.age % 10 === 0) {
        const maxAge = 5000;  // Maximum expected lifespan
        if (agent.age > maxAge * 0.8) {  // After 80% of max lifespan
            const ageFactor = (agent.age - maxAge * 0.8) / (maxAge * 0.2);
            const deathProbability = ageFactor * 0.01;  // Up to 1% per tick
            if (Math.random() < deathProbability) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Kill an agent
 */
export function killAgent(agent) {
    agent.alive = false;
    agent.energy = 0;

    // Clear social links
    agent.cooperative_links = [];
    agent.symbiont = null;
    agent.host = null;
}

/**
 * Create offspring from parent (asexual reproduction)
 */
export function reproduceAsexual(parent, mutate = true) {
    // Clone genome
    let childGenome = cloneGenome(parent.genome);

    // Mutate if requested
    if (mutate) {
        mutateGenome(childGenome);
    }

    // Create child near parent
    const childPosition = {
        x: parent.position.x + (Math.random() - 0.5) * 30,
        y: parent.position.y + (Math.random() - 0.5) * 30
    };

    // Clamp to world bounds
    childPosition.x = Math.max(10, Math.min(CONFIG.WORLD_WIDTH - 10, childPosition.x));
    childPosition.y = Math.max(10, Math.min(CONFIG.WORLD_HEIGHT - 10, childPosition.y));

    const child = createAgent(childGenome, {
        position: childPosition,
        energy: parent.energy * 0.4  // Child gets 40% of parent's energy
    });

    // Parent loses energy
    parent.energy *= 0.5;
    parent.offspring_count++;

    return child;
}

/**
 * Create offspring from two parents (sexual reproduction)
 */
export function reproduceSexual(parentA, parentB, mutate = true) {
    // Create child genome through crossover
    let childGenome = crossover(parentA.genome, parentB.genome);

    // Mutate if requested
    if (mutate) {
        mutateGenome(childGenome);
    }

    // Create child between parents
    const childPosition = {
        x: (parentA.position.x + parentB.position.x) / 2 + (Math.random() - 0.5) * 20,
        y: (parentA.position.y + parentB.position.y) / 2 + (Math.random() - 0.5) * 20
    };

    // Clamp to world bounds
    childPosition.x = Math.max(10, Math.min(CONFIG.WORLD_WIDTH - 10, childPosition.x));
    childPosition.y = Math.max(10, Math.min(CONFIG.WORLD_HEIGHT - 10, childPosition.y));

    // Child gets energy from both parents
    const childEnergy = parentA.energy * 0.25 + parentB.energy * 0.25;

    const child = createAgent(childGenome, {
        position: childPosition,
        energy: childEnergy
    });

    // Parents lose energy
    parentA.energy *= 0.7;
    parentB.energy *= 0.7;
    parentA.offspring_count++;
    parentB.offspring_count++;

    return child;
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

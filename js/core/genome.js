/**
 * Genome System - Encodes all heritable traits of an organism
 *
 * The genome defines body structure (nodes, links, motors, sensors),
 * metabolism, social behaviors, HGT capabilities, and viral susceptibility.
 */

import { CONFIG, SENSOR_TYPES, FOOD_TYPES, WASTE_TYPES, SYMBIOTIC_BENEFITS } from '../config.js';
import {
    generateUUID,
    randomRange,
    randomInt,
    randomBool,
    randomChoice,
    clamp
} from '../utils/math.js';

/**
 * Create a new genome with default/random values
 */
export function createGenome(options = {}) {
    const id = options.id || generateUUID();
    const speciesMarker = options.species_marker ?? randomInt(0, 1000000);

    const genome = {
        // === IDENTITY ===
        id,
        species_marker: speciesMarker,
        generation: options.generation || 0,

        // === BODY STRUCTURE ===
        nodes: options.nodes || [],
        links: options.links || [],
        motors: options.motors || [],
        sensors: options.sensors || [],

        // === METABOLISM ===
        metabolism: options.metabolism || createDefaultMetabolism(),

        // === SOCIAL BEHAVIORS ===
        social: options.social || createDefaultSocial(),

        // === HORIZONTAL GENE TRANSFER ===
        hgt: options.hgt || createDefaultHGT(),

        // === VIRAL SUSCEPTIBILITY ===
        viral: options.viral || createDefaultViral()
    };

    return genome;
}

/**
 * Create default metabolism settings
 */
export function createDefaultMetabolism() {
    return {
        primary_food: randomChoice(FOOD_TYPES),
        secondary_food: randomBool(0.3) ? randomChoice(FOOD_TYPES) : null,
        efficiency: randomRange(0.3, 0.7),
        storage_capacity: randomRange(80, 200),
        base_metabolism: randomRange(0.05, 0.15),
        waste_product: randomChoice(WASTE_TYPES)
    };
}

/**
 * Create default social behavior settings
 */
export function createDefaultSocial() {
    return {
        // Cooperation (same species)
        cooperation: {
            link_willingness: randomRange(0.2, 0.8),
            link_strength: randomRange(20, 60),
            resource_sharing: randomRange(0.1, 0.5),
            signal_response: randomRange(0.1, 0.6)
        },

        // Competition
        competition: {
            aggression: randomRange(0.1, 0.6),
            territorial_radius: randomBool(0.3) ? randomRange(20, 60) : 0,
            flee_threshold: randomRange(0.3, 0.7),
            resource_greed: randomRange(0.2, 0.8)
        },

        // Symbiosis (different species)
        symbiosis: {
            markers: [],  // Species markers willing to bond with
            offer: randomChoice(SYMBIOTIC_BENEFITS),
            need: randomChoice(SYMBIOTIC_BENEFITS),
            attachment_strength: randomRange(0.3, 0.8)
        },

        // Communication
        communication: {
            signal_emission: randomRange(0.1, 0.5),
            signal_type: randomInt(0, 10),
            signal_frequency: randomRange(0.1, 1.0)
        }
    };
}

/**
 * Create default HGT settings
 */
export function createDefaultHGT() {
    return {
        donor_willingness: randomRange(0.1, 0.5),
        recipient_openness: randomRange(0.2, 0.6),
        transfer_type: randomChoice(['conjugation', 'transformation', 'both']),
        plasmids: [],
        restriction_markers: [],
        dna_release_on_death: randomBool(0.7)
    };
}

/**
 * Create default viral susceptibility settings
 */
export function createDefaultViral() {
    // Random receptors (which viral strains can attach)
    const receptorCount = randomInt(1, 4);
    const receptors = [];
    for (let i = 0; i < receptorCount; i++) {
        receptors.push(randomInt(0, 100));
    }

    return {
        receptors,
        resistance: randomRange(0.1, 0.5),
        crispr_memory: []
    };
}

/**
 * Generate a random genome with body structure
 */
export function generateRandomGenome(options = {}) {
    const nodeCount = options.nodeCount || randomInt(
        CONFIG.INITIAL_NODE_COUNT_MIN,
        CONFIG.INITIAL_NODE_COUNT_MAX
    );

    const genome = createGenome(options);

    // Generate nodes in a rough circular pattern
    const centerX = 0;
    const centerY = 0;
    const radius = 10 + nodeCount * 2;

    for (let i = 0; i < nodeCount; i++) {
        const angle = (i / nodeCount) * Math.PI * 2;
        const r = radius * (0.7 + Math.random() * 0.6);

        genome.nodes.push({
            id: i,
            position: {
                x: centerX + Math.cos(angle) * r,
                y: centerY + Math.sin(angle) * r
            },
            mass: randomRange(0.5, 2.0),
            friction: randomRange(0.1, 0.5)
        });
    }

    // Generate links - connect adjacent nodes in a ring
    for (let i = 0; i < nodeCount; i++) {
        const nextI = (i + 1) % nodeCount;
        const nodeA = genome.nodes[i];
        const nodeB = genome.nodes[nextI];

        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const restLength = Math.sqrt(dx * dx + dy * dy);

        genome.links.push({
            id: i,
            node_a: i,
            node_b: nextI,
            rest_length: restLength,
            stiffness: randomRange(30, 80),
            damping: randomRange(0.3, 0.7)
        });
    }

    // Add some cross-links for structural stability (if enough nodes)
    if (nodeCount >= 4) {
        const crossLinkCount = Math.floor(nodeCount / 2);
        for (let i = 0; i < crossLinkCount; i++) {
            const nodeAIdx = i;
            const nodeBIdx = (i + Math.floor(nodeCount / 2)) % nodeCount;

            // Check if link already exists
            const exists = genome.links.some(l =>
                (l.node_a === nodeAIdx && l.node_b === nodeBIdx) ||
                (l.node_a === nodeBIdx && l.node_b === nodeAIdx)
            );

            if (!exists) {
                const nodeA = genome.nodes[nodeAIdx];
                const nodeB = genome.nodes[nodeBIdx];
                const dx = nodeB.position.x - nodeA.position.x;
                const dy = nodeB.position.y - nodeA.position.y;
                const restLength = Math.sqrt(dx * dx + dy * dy);

                genome.links.push({
                    id: genome.links.length,
                    node_a: nodeAIdx,
                    node_b: nodeBIdx,
                    rest_length: restLength,
                    stiffness: randomRange(20, 50),
                    damping: randomRange(0.3, 0.6)
                });
            }
        }
    }

    // Add motors to some links
    for (let i = 0; i < genome.links.length; i++) {
        if (randomBool(CONFIG.INITIAL_MOTOR_CHANCE)) {
            genome.motors.push({
                id: genome.motors.length,
                attached_to: i,
                cycle_speed: randomRange(1, 5),
                amplitude: randomRange(0.1, 0.4),
                phase_offset: randomRange(0, Math.PI * 2),
                energy_cost: randomRange(0.05, 0.2),
                sensor_modulation: -1  // No sensor modulation by default
            });
        }
    }

    // Add sensors
    const sensorCount = randomBool(CONFIG.INITIAL_SENSOR_CHANCE) ? randomInt(1, 3) : 0;
    for (let i = 0; i < sensorCount; i++) {
        genome.sensors.push(createRandomSensor(i));
    }

    // Maybe connect a motor to a sensor
    if (genome.motors.length > 0 && genome.sensors.length > 0 && randomBool(0.3)) {
        const motor = randomChoice(genome.motors);
        motor.sensor_modulation = randomInt(0, genome.sensors.length - 1);
    }

    return genome;
}

/**
 * Create a random sensor
 */
export function createRandomSensor(id) {
    const type = randomChoice(SENSOR_TYPES);

    let target = null;
    switch (type) {
        case 'chemical':
            target = randomChoice(FOOD_TYPES);
            break;
        case 'thermal':
            target = 'temperature';
            break;
        case 'proximity':
            target = 'agents';
            break;
        case 'kin':
            target = 'species';
            break;
        case 'signal':
            target = randomInt(0, 10).toString();
            break;
        case 'viral':
            target = 'virus';
            break;
    }

    return {
        id,
        type,
        sensitivity: randomRange(0.3, 1.0),
        range: randomRange(20, 80),
        target,
        output_gain: randomRange(0.5, 2.0)
    };
}

/**
 * Deep clone a genome
 */
export function cloneGenome(genome) {
    return JSON.parse(JSON.stringify(genome));
}

/**
 * Validate genome structure
 */
export function validateGenome(genome) {
    const errors = [];

    if (!genome.id) errors.push('Missing genome ID');
    if (typeof genome.species_marker !== 'number') errors.push('Invalid species marker');

    // Validate nodes
    if (!Array.isArray(genome.nodes) || genome.nodes.length < CONFIG.MIN_NODES) {
        errors.push(`Need at least ${CONFIG.MIN_NODES} nodes`);
    }

    // Validate links reference valid nodes
    for (const link of genome.links) {
        if (link.node_a >= genome.nodes.length || link.node_b >= genome.nodes.length) {
            errors.push(`Link ${link.id} references invalid node`);
        }
    }

    // Validate motors reference valid links
    for (const motor of genome.motors) {
        if (motor.attached_to >= genome.links.length) {
            errors.push(`Motor ${motor.id} attached to invalid link`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Calculate genome complexity (for fitness penalty)
 */
export function getGenomeComplexity(genome) {
    return genome.nodes.length +
           genome.links.length +
           genome.motors.length * 2 +
           genome.sensors.length * 2;
}

/**
 * Calculate genetic distance between two genomes
 */
export function geneticDistance(genomeA, genomeB) {
    let distance = 0;

    // Node count difference
    distance += Math.abs(genomeA.nodes.length - genomeB.nodes.length) * 0.5;

    // Link count difference
    distance += Math.abs(genomeA.links.length - genomeB.links.length) * 0.3;

    // Motor count difference
    distance += Math.abs(genomeA.motors.length - genomeB.motors.length) * 0.4;

    // Sensor count difference
    distance += Math.abs(genomeA.sensors.length - genomeB.sensors.length) * 0.4;

    // Metabolism difference
    if (genomeA.metabolism.primary_food !== genomeB.metabolism.primary_food) {
        distance += 1.0;
    }
    distance += Math.abs(genomeA.metabolism.efficiency - genomeB.metabolism.efficiency);

    // Social behavior differences
    distance += Math.abs(
        genomeA.social.cooperation.link_willingness -
        genomeB.social.cooperation.link_willingness
    ) * 0.5;

    distance += Math.abs(
        genomeA.social.competition.aggression -
        genomeB.social.competition.aggression
    ) * 0.5;

    // Normalize to 0-1 range approximately
    return distance / 10;
}

/**
 * Check if two genomes are same species
 */
export function isSameSpecies(genomeA, genomeB) {
    const dist = geneticDistance(genomeA, genomeB);
    return dist < CONFIG.SPECIES_DISTANCE_THRESHOLD;
}

/**
 * Mutate a genome in place
 */
export function mutateGenome(genome) {
    // Point mutations on numeric values
    if (randomBool(CONFIG.POINT_MUTATION_RATE)) {
        mutateNumericValues(genome);
    }

    // Structural mutations
    if (randomBool(CONFIG.ADD_NODE_RATE) && genome.nodes.length < CONFIG.MAX_NODES) {
        addNode(genome);
    }

    if (randomBool(CONFIG.REMOVE_NODE_RATE) && genome.nodes.length > CONFIG.MIN_NODES) {
        removeNode(genome);
    }

    if (randomBool(CONFIG.ADD_LINK_RATE)) {
        addLink(genome);
    }

    if (randomBool(CONFIG.REMOVE_LINK_RATE) && genome.links.length > genome.nodes.length) {
        removeLink(genome);
    }

    if (randomBool(CONFIG.ADD_MOTOR_RATE)) {
        addMotor(genome);
    }

    if (randomBool(CONFIG.REMOVE_MOTOR_RATE) && genome.motors.length > 0) {
        removeMotor(genome);
    }

    if (randomBool(CONFIG.ADD_SENSOR_RATE)) {
        addSensor(genome);
    }

    if (randomBool(CONFIG.REMOVE_SENSOR_RATE) && genome.sensors.length > 0) {
        removeSensor(genome);
    }

    // Social trait mutations
    if (randomBool(CONFIG.SOCIAL_MUTATION_RATE)) {
        mutateSocialTraits(genome);
    }

    // Increment generation
    genome.generation++;

    return genome;
}

/**
 * Mutate numeric values slightly
 */
function mutateNumericValues(genome) {
    const strength = CONFIG.POINT_MUTATION_STRENGTH;

    // Mutate node masses
    for (const node of genome.nodes) {
        if (randomBool(0.1)) {
            node.mass = clamp(node.mass + randomRange(-strength, strength), 0.1, 5.0);
        }
    }

    // Mutate link properties
    for (const link of genome.links) {
        if (randomBool(0.1)) {
            link.stiffness = clamp(link.stiffness + randomRange(-10, 10), 1, 100);
        }
        if (randomBool(0.1)) {
            link.damping = clamp(link.damping + randomRange(-0.1, 0.1), 0, 1);
        }
    }

    // Mutate motor properties
    for (const motor of genome.motors) {
        if (randomBool(0.1)) {
            motor.cycle_speed = clamp(motor.cycle_speed + randomRange(-0.5, 0.5), 0.1, 10);
        }
        if (randomBool(0.1)) {
            motor.amplitude = clamp(motor.amplitude + randomRange(-0.1, 0.1), 0, 0.5);
        }
    }

    // Mutate metabolism
    if (randomBool(0.1)) {
        genome.metabolism.efficiency = clamp(
            genome.metabolism.efficiency + randomRange(-0.1, 0.1), 0.1, 1.0
        );
    }
}

/**
 * Add a new node to the genome
 */
function addNode(genome) {
    // Pick a random link to split
    if (genome.links.length === 0) return;

    const linkIdx = randomInt(0, genome.links.length - 1);
    const link = genome.links[linkIdx];
    const nodeA = genome.nodes[link.node_a];
    const nodeB = genome.nodes[link.node_b];

    // Create new node at midpoint
    const newNodeId = genome.nodes.length;
    const newNode = {
        id: newNodeId,
        position: {
            x: (nodeA.position.x + nodeB.position.x) / 2,
            y: (nodeA.position.y + nodeB.position.y) / 2
        },
        mass: randomRange(0.5, 2.0),
        friction: randomRange(0.1, 0.5)
    };
    genome.nodes.push(newNode);

    // Update old link to connect to new node
    const oldNodeB = link.node_b;
    link.node_b = newNodeId;
    link.rest_length = link.rest_length / 2;

    // Create new link from new node to old node_b
    genome.links.push({
        id: genome.links.length,
        node_a: newNodeId,
        node_b: oldNodeB,
        rest_length: link.rest_length,
        stiffness: link.stiffness,
        damping: link.damping
    });
}

/**
 * Remove a node from the genome
 */
function removeNode(genome) {
    if (genome.nodes.length <= CONFIG.MIN_NODES) return;

    // Pick a random node (not first one to keep structure)
    const nodeIdx = randomInt(1, genome.nodes.length - 1);

    // Remove links connected to this node
    genome.links = genome.links.filter(link =>
        link.node_a !== nodeIdx && link.node_b !== nodeIdx
    );

    // Remove motors attached to removed links
    const validLinkIds = new Set(genome.links.map(l => l.id));
    genome.motors = genome.motors.filter(m => validLinkIds.has(m.attached_to));

    // Remove the node
    genome.nodes.splice(nodeIdx, 1);

    // Update node indices in remaining links
    for (const link of genome.links) {
        if (link.node_a > nodeIdx) link.node_a--;
        if (link.node_b > nodeIdx) link.node_b--;
    }

    // Update node IDs
    genome.nodes.forEach((node, i) => node.id = i);
}

/**
 * Add a new link between nodes
 */
function addLink(genome) {
    if (genome.nodes.length < 2) return;

    // Find two nodes that aren't already connected
    for (let attempts = 0; attempts < 10; attempts++) {
        const nodeAIdx = randomInt(0, genome.nodes.length - 1);
        let nodeBIdx = randomInt(0, genome.nodes.length - 1);

        if (nodeAIdx === nodeBIdx) continue;

        // Check if link exists
        const exists = genome.links.some(l =>
            (l.node_a === nodeAIdx && l.node_b === nodeBIdx) ||
            (l.node_a === nodeBIdx && l.node_b === nodeAIdx)
        );

        if (!exists) {
            const nodeA = genome.nodes[nodeAIdx];
            const nodeB = genome.nodes[nodeBIdx];
            const dx = nodeB.position.x - nodeA.position.x;
            const dy = nodeB.position.y - nodeA.position.y;
            const restLength = Math.sqrt(dx * dx + dy * dy);

            genome.links.push({
                id: genome.links.length,
                node_a: nodeAIdx,
                node_b: nodeBIdx,
                rest_length: restLength,
                stiffness: randomRange(20, 60),
                damping: randomRange(0.3, 0.6)
            });
            break;
        }
    }
}

/**
 * Remove a link from the genome
 */
function removeLink(genome) {
    // Keep at least n-1 links for n nodes (to stay connected)
    if (genome.links.length <= genome.nodes.length - 1) return;

    const linkIdx = randomInt(0, genome.links.length - 1);
    const linkId = genome.links[linkIdx].id;

    // Remove motors attached to this link
    genome.motors = genome.motors.filter(m => m.attached_to !== linkId);

    // Remove the link
    genome.links.splice(linkIdx, 1);

    // Update link IDs and motor attachments
    genome.links.forEach((link, i) => {
        const oldId = link.id;
        link.id = i;
        // Update motor attachments
        for (const motor of genome.motors) {
            if (motor.attached_to === oldId) {
                motor.attached_to = i;
            }
        }
    });
}

/**
 * Add a motor to a link
 */
function addMotor(genome) {
    if (genome.links.length === 0) return;

    // Find a link without a motor
    const linksWithMotors = new Set(genome.motors.map(m => m.attached_to));
    const availableLinks = genome.links.filter(l => !linksWithMotors.has(l.id));

    if (availableLinks.length === 0) return;

    const link = randomChoice(availableLinks);

    genome.motors.push({
        id: genome.motors.length,
        attached_to: link.id,
        cycle_speed: randomRange(1, 5),
        amplitude: randomRange(0.1, 0.4),
        phase_offset: randomRange(0, Math.PI * 2),
        energy_cost: randomRange(0.05, 0.2),
        sensor_modulation: genome.sensors.length > 0 && randomBool(0.3)
            ? randomInt(0, genome.sensors.length - 1)
            : -1
    });
}

/**
 * Remove a motor
 */
function removeMotor(genome) {
    if (genome.motors.length === 0) return;

    const motorIdx = randomInt(0, genome.motors.length - 1);
    genome.motors.splice(motorIdx, 1);

    // Update motor IDs
    genome.motors.forEach((motor, i) => motor.id = i);
}

/**
 * Add a sensor
 */
function addSensor(genome) {
    genome.sensors.push(createRandomSensor(genome.sensors.length));
}

/**
 * Remove a sensor
 */
function removeSensor(genome) {
    if (genome.sensors.length === 0) return;

    const sensorIdx = randomInt(0, genome.sensors.length - 1);

    // Update motor references
    for (const motor of genome.motors) {
        if (motor.sensor_modulation === sensorIdx) {
            motor.sensor_modulation = -1;
        } else if (motor.sensor_modulation > sensorIdx) {
            motor.sensor_modulation--;
        }
    }

    genome.sensors.splice(sensorIdx, 1);

    // Update sensor IDs
    genome.sensors.forEach((sensor, i) => sensor.id = i);
}

/**
 * Mutate social traits
 */
function mutateSocialTraits(genome) {
    const social = genome.social;
    const strength = 0.1;

    // Cooperation
    social.cooperation.link_willingness = clamp(
        social.cooperation.link_willingness + randomRange(-strength, strength), 0, 1
    );
    social.cooperation.resource_sharing = clamp(
        social.cooperation.resource_sharing + randomRange(-strength, strength), 0, 1
    );

    // Competition
    social.competition.aggression = clamp(
        social.competition.aggression + randomRange(-strength, strength), 0, 1
    );
    social.competition.flee_threshold = clamp(
        social.competition.flee_threshold + randomRange(-strength, strength), 0, 1
    );

    // Maybe change territorial behavior
    if (randomBool(0.1)) {
        if (social.competition.territorial_radius === 0) {
            social.competition.territorial_radius = randomRange(20, 60);
        } else {
            social.competition.territorial_radius = 0;
        }
    }
}

/**
 * Crossover two genomes (sexual reproduction)
 */
export function crossover(parentA, parentB) {
    const child = createGenome({
        species_marker: randomBool(0.5) ? parentA.species_marker : parentB.species_marker,
        generation: Math.max(parentA.generation, parentB.generation) + 1
    });

    // Body structure: take from one parent with some mixing
    const primaryParent = randomBool(0.5) ? parentA : parentB;
    const secondaryParent = primaryParent === parentA ? parentB : parentA;

    // Clone nodes from primary parent
    child.nodes = cloneGenome(primaryParent).nodes;

    // Clone links from primary parent
    child.links = cloneGenome(primaryParent).links;

    // Mix motors from both parents
    child.motors = [];
    const allMotors = [...parentA.motors, ...parentB.motors];
    for (const motor of allMotors) {
        if (motor.attached_to < child.links.length && randomBool(0.5)) {
            // Check if we already have a motor on this link
            const exists = child.motors.some(m => m.attached_to === motor.attached_to);
            if (!exists) {
                child.motors.push({
                    ...motor,
                    id: child.motors.length
                });
            }
        }
    }

    // Mix sensors
    child.sensors = [];
    const allSensors = [...parentA.sensors, ...parentB.sensors];
    for (const sensor of allSensors) {
        if (randomBool(0.5) && child.sensors.length < 5) {
            child.sensors.push({
                ...sensor,
                id: child.sensors.length
            });
        }
    }

    // Metabolism: inherit from one parent with blending
    if (randomBool(0.5)) {
        child.metabolism = cloneGenome(parentA).metabolism;
    } else {
        child.metabolism = cloneGenome(parentB).metabolism;
    }
    child.metabolism.efficiency = (parentA.metabolism.efficiency + parentB.metabolism.efficiency) / 2;

    // Social traits: blend values
    child.social = blendSocialTraits(parentA.social, parentB.social);

    // HGT traits: blend
    child.hgt = blendHGTTraits(parentA.hgt, parentB.hgt);

    // Viral traits: union of receptors, inherited CRISPR
    child.viral = {
        receptors: [...new Set([...parentA.viral.receptors, ...parentB.viral.receptors])].slice(0, 5),
        resistance: (parentA.viral.resistance + parentB.viral.resistance) / 2,
        crispr_memory: inheritCRISPR(parentA, parentB)
    };

    return child;
}

/**
 * Blend social traits from two parents
 */
function blendSocialTraits(socialA, socialB) {
    return {
        cooperation: {
            link_willingness: (socialA.cooperation.link_willingness + socialB.cooperation.link_willingness) / 2,
            link_strength: (socialA.cooperation.link_strength + socialB.cooperation.link_strength) / 2,
            resource_sharing: (socialA.cooperation.resource_sharing + socialB.cooperation.resource_sharing) / 2,
            signal_response: (socialA.cooperation.signal_response + socialB.cooperation.signal_response) / 2
        },
        competition: {
            aggression: (socialA.competition.aggression + socialB.competition.aggression) / 2,
            territorial_radius: randomBool(0.5) ? socialA.competition.territorial_radius : socialB.competition.territorial_radius,
            flee_threshold: (socialA.competition.flee_threshold + socialB.competition.flee_threshold) / 2,
            resource_greed: (socialA.competition.resource_greed + socialB.competition.resource_greed) / 2
        },
        symbiosis: randomBool(0.5) ? { ...socialA.symbiosis } : { ...socialB.symbiosis },
        communication: randomBool(0.5) ? { ...socialA.communication } : { ...socialB.communication }
    };
}

/**
 * Blend HGT traits from two parents
 */
function blendHGTTraits(hgtA, hgtB) {
    return {
        donor_willingness: (hgtA.donor_willingness + hgtB.donor_willingness) / 2,
        recipient_openness: (hgtA.recipient_openness + hgtB.recipient_openness) / 2,
        transfer_type: randomBool(0.5) ? hgtA.transfer_type : hgtB.transfer_type,
        plasmids: [],  // Plasmids handled separately
        restriction_markers: [...new Set([...hgtA.restriction_markers, ...hgtB.restriction_markers])],
        dna_release_on_death: randomBool(0.5) ? hgtA.dna_release_on_death : hgtB.dna_release_on_death
    };
}

/**
 * Inherit CRISPR memory from parents
 */
function inheritCRISPR(parentA, parentB) {
    const combined = [
        ...parentA.viral.crispr_memory,
        ...parentB.viral.crispr_memory
    ];

    // Remove duplicates
    const unique = [...new Set(combined)];

    // Trim to capacity
    if (unique.length > CONFIG.CRISPR_MEMORY_SLOTS) {
        return unique.slice(-CONFIG.CRISPR_MEMORY_SLOTS);
    }

    // Chance of memory decay
    return unique.filter(() => randomBool(1 - CONFIG.CRISPR_MEMORY_DECAY));
}

// Alias for crossover (used by evolution.js)
export const crossoverGenomes = crossover;

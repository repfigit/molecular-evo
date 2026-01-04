/**
 * Physics System - Soft-body dynamics using spring-mass-damper model
 *
 * Handles all physical simulation including:
 * - Spring forces between linked nodes
 * - Motor-driven oscillations
 * - Drag and friction
 * - Collision detection and response
 * - Boundary handling
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { vec, add, subtract, scale, length, normalize, distance } from '../utils/math.js';
import { SpatialHash } from '../utils/spatial.js';
import { checkBarrierCrossing } from './environment.js';

// Physics spatial hash for collision detection
let collisionHash = null;

/**
 * Initialize the physics system
 */
export function initPhysics() {
    collisionHash = new SpatialHash(CONFIG.SPATIAL_CELL_SIZE);
}

/**
 * Main physics update - processes all agents
 */
export function updatePhysics(agents, dt) {
    if (!collisionHash) {
        initPhysics();
    }

    // Phase 1: Reset forces and update motors
    for (const agent of agents) {
        if (!agent.alive) continue;
        resetForces(agent);
        updateMotors(agent, dt);
    }

    // Phase 2: Calculate spring forces
    for (const agent of agents) {
        if (!agent.alive) continue;
        calculateSpringForces(agent);
    }

    // Phase 3: Apply environmental forces (drag)
    for (const agent of agents) {
        if (!agent.alive) continue;
        applyEnvironmentalForces(agent, dt);
    }

    // Phase 4: Update collision hash and handle collisions
    collisionHash.clear();
    for (const agent of agents) {
        if (!agent.alive) continue;
        collisionHash.insert(agent);
    }
    handleCollisions(agents);

    // Phase 5: Integrate positions
    for (const agent of agents) {
        if (!agent.alive) continue;
        integrate(agent, dt);
    }

    // Phase 6: Enforce boundaries
    for (const agent of agents) {
        if (!agent.alive) continue;
        enforceBoundaries(agent);
    }

    // Phase 7: Update agent center positions
    for (const agent of agents) {
        if (!agent.alive) continue;
        updateAgentCenter(agent);
    }
}

/**
 * Reset forces on all nodes
 */
function resetForces(agent) {
    for (const node of agent.body.nodes) {
        node.force.x = 0;
        node.force.y = 0;
    }
}

/**
 * Update motor phases and apply to link target lengths
 */
function updateMotors(agent, dt) {
    for (const motor of agent.body.motors) {
        // Update phase
        motor.current_phase += motor.cycle_speed * dt;
        if (motor.current_phase > Math.PI * 2) {
            motor.current_phase -= Math.PI * 2;
        }

        // Get sensor modulation if connected
        let modulation = 1.0;
        if (motor.sensor_modulation >= 0 && motor.sensor_modulation < agent.body.sensors.length) {
            const sensor = agent.body.sensors[motor.sensor_modulation];
            if (sensor) {
                modulation = sensor.current_value * sensor.output_gain;
                modulation = Math.max(0, Math.min(2, modulation)); // Clamp modulation
            }
        }

        // Calculate oscillation and update link target length
        const link = agent.body.links[motor.attached_to];
        if (link) {
            const oscillation = Math.sin(motor.current_phase) * motor.amplitude * modulation;
            link.target_length = link.rest_length * (1 + oscillation);

            // Energy cost for motor activity
            const energyCost = motor.energy_cost * Math.abs(oscillation) * dt * agent.movement_bonus;
            agent.energy -= energyCost;
        }
    }
}

/**
 * Calculate spring forces using Hooke's law with damping
 */
function calculateSpringForces(agent) {
    for (const link of agent.body.links) {
        const nodeA = agent.body.nodes[link.node_a];
        const nodeB = agent.body.nodes[link.node_b];

        if (!nodeA || !nodeB) continue;

        // Calculate current length and direction
        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const currentLength = Math.sqrt(dx * dx + dy * dy);

        if (currentLength < 0.0001) continue; // Prevent division by zero

        // Normalized direction
        const nx = dx / currentLength;
        const ny = dy / currentLength;

        // Spring force (Hooke's law)
        const targetLength = link.target_length || link.rest_length;
        const displacement = currentLength - targetLength;
        const springForce = link.stiffness * displacement;

        // Damping force (relative velocity along spring axis)
        const relVelX = nodeB.velocity.x - nodeA.velocity.x;
        const relVelY = nodeB.velocity.y - nodeA.velocity.y;
        const relVelAlong = relVelX * nx + relVelY * ny;
        const dampingForce = link.damping * relVelAlong;

        // Total force
        const totalForce = springForce + dampingForce;

        // Apply forces to nodes (Newton's third law)
        const fx = totalForce * nx;
        const fy = totalForce * ny;

        nodeA.force.x += fx;
        nodeA.force.y += fy;
        nodeB.force.x -= fx;
        nodeB.force.y -= fy;
    }
}

/**
 * Apply environmental forces (drag, viscosity)
 */
function applyEnvironmentalForces(agent, dt) {
    const viscosity = state.environment?.viscosity || CONFIG.VISCOSITY_BASE;
    const drag = CONFIG.BASE_DRAG * (1 + viscosity);

    for (const node of agent.body.nodes) {
        // Apply drag force (opposes velocity)
        node.force.x -= node.velocity.x * drag * node.mass;
        node.force.y -= node.velocity.y * drag * node.mass;

        // Surface friction if touching boundary
        if (node.touching_surface) {
            const friction = node.friction * CONFIG.SURFACE_FRICTION;
            node.force.x -= node.velocity.x * friction;
            node.force.y -= node.velocity.y * friction;
        }
    }
}

/**
 * Handle collisions between agents
 */
function handleCollisions(agents) {
    const pairs = collisionHash.getPotentialCollisions();

    for (const [agentA, agentB] of pairs) {
        if (!agentA.alive || !agentB.alive) continue;

        // Check actual collision
        const dx = agentB.position.x - agentA.position.x;
        const dy = agentB.position.y - agentA.position.y;
        const distSq = dx * dx + dy * dy;

        // Get combined collision radius
        const radiusA = getAgentCollisionRadius(agentA);
        const radiusB = getAgentCollisionRadius(agentB);
        const minDist = radiusA + radiusB;

        if (distSq < minDist * minDist && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;

            // Normalized collision direction
            const nx = dx / dist;
            const ny = dy / dist;

            // Push agents apart (proportional to overlap)
            const pushForce = overlap * CONFIG.COLLISION_RESPONSE * 10;

            // Apply force to all nodes of each agent
            const forcePerNodeA = pushForce / agentA.body.nodes.length;
            const forcePerNodeB = pushForce / agentB.body.nodes.length;

            for (const node of agentA.body.nodes) {
                node.force.x -= nx * forcePerNodeA;
                node.force.y -= ny * forcePerNodeA;
            }

            for (const node of agentB.body.nodes) {
                node.force.x += nx * forcePerNodeB;
                node.force.y += ny * forcePerNodeB;
            }
        }
    }
}

/**
 * Get collision radius for an agent
 */
function getAgentCollisionRadius(agent) {
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
 * Integrate forces to update velocities and positions
 */
function integrate(agent, dt) {
    for (const node of agent.body.nodes) {
        // Calculate acceleration (F = ma, so a = F/m)
        const ax = node.force.x / node.mass;
        const ay = node.force.y / node.mass;

        // Update velocity (semi-implicit Euler)
        node.velocity.x += ax * dt;
        node.velocity.y += ay * dt;

        // Apply movement bonus from cooperation/symbiosis
        const movementMultiplier = agent.movement_bonus;
        node.velocity.x *= movementMultiplier > 1 ? 1 + (movementMultiplier - 1) * 0.01 : 1;
        node.velocity.y *= movementMultiplier > 1 ? 1 + (movementMultiplier - 1) * 0.01 : 1;

        // Clamp velocity to max speed
        const speed = Math.sqrt(node.velocity.x ** 2 + node.velocity.y ** 2);
        if (speed > CONFIG.MAX_SPEED) {
            const factor = CONFIG.MAX_SPEED / speed;
            node.velocity.x *= factor;
            node.velocity.y *= factor;
        }

        // Store old position for barrier checking
        const oldX = node.position.x;
        const oldY = node.position.y;

        // Update position
        node.position.x += node.velocity.x * dt;
        node.position.y += node.velocity.y * dt;

        // Check for geographic barrier crossing (allopatric speciation)
        const barrierCheck = checkBarrierCrossing(oldX, oldY, node.position.x, node.position.y);
        if (barrierCheck.blocked) {
            // Barrier blocks movement - revert position and reflect velocity
            node.position.x = oldX;
            node.position.y = oldY;
            node.velocity.x *= -0.5;  // Partial bounce
            node.velocity.y *= -0.5;
        }
    }
}

/**
 * Enforce world boundaries
 */
function enforceBoundaries(agent) {
    const margin = 2;
    const bounce = 0.3; // Coefficient of restitution

    for (const node of agent.body.nodes) {
        node.touching_surface = false;

        // Left boundary
        if (node.position.x < margin) {
            node.position.x = margin;
            node.velocity.x *= -bounce;
            node.touching_surface = true;
        }

        // Right boundary
        if (node.position.x > CONFIG.WORLD_WIDTH - margin) {
            node.position.x = CONFIG.WORLD_WIDTH - margin;
            node.velocity.x *= -bounce;
            node.touching_surface = true;
        }

        // Top boundary
        if (node.position.y < margin) {
            node.position.y = margin;
            node.velocity.y *= -bounce;
            node.touching_surface = true;
        }

        // Bottom boundary
        if (node.position.y > CONFIG.WORLD_HEIGHT - margin) {
            node.position.y = CONFIG.WORLD_HEIGHT - margin;
            node.velocity.y *= -bounce;
            node.touching_surface = true;
        }
    }
}

/**
 * Update agent center of mass position and velocity
 */
function updateAgentCenter(agent) {
    const nodes = agent.body.nodes;
    if (nodes.length === 0) return;

    let cx = 0, cy = 0;
    let vx = 0, vy = 0;
    let totalMass = 0;

    for (const node of nodes) {
        const mass = node.mass;
        cx += node.position.x * mass;
        cy += node.position.y * mass;
        vx += node.velocity.x * mass;
        vy += node.velocity.y * mass;
        totalMass += mass;
    }

    if (totalMass > 0) {
        agent.position.x = cx / totalMass;
        agent.position.y = cy / totalMass;
        agent.velocity.x = vx / totalMass;
        agent.velocity.y = vy / totalMass;
    }
}

/**
 * Apply external force to an agent (used by other systems)
 */
export function applyForceToAgent(agent, fx, fy) {
    if (!agent.alive || agent.body.nodes.length === 0) return;

    const forcePerNode = {
        x: fx / agent.body.nodes.length,
        y: fy / agent.body.nodes.length
    };

    for (const node of agent.body.nodes) {
        node.force.x += forcePerNode.x;
        node.force.y += forcePerNode.y;
    }
}

/**
 * Apply impulse to agent (instant velocity change)
 */
export function applyImpulseToAgent(agent, ix, iy) {
    if (!agent.alive || agent.body.nodes.length === 0) return;

    const impulsePerNode = {
        x: ix / agent.body.nodes.length,
        y: iy / agent.body.nodes.length
    };

    for (const node of agent.body.nodes) {
        node.velocity.x += impulsePerNode.x;
        node.velocity.y += impulsePerNode.y;
    }
}

/**
 * Get the physics spatial hash (for external queries)
 */
export function getCollisionHash() {
    return collisionHash;
}

/**
 * Update sensors based on environment and nearby entities
 */
export function updateSensors(agent, environment, nearbyAgents) {
    for (const sensor of agent.body.sensors) {
        sensor.current_value = 0;

        switch (sensor.type) {
            case 'chemical':
                // Detect chemical gradient (placeholder - environment system will provide this)
                if (environment?.getGradient) {
                    const gradient = environment.getGradient(agent.position, sensor.target);
                    sensor.current_value = gradient?.strength || 0;
                }
                break;

            case 'thermal':
                // Detect temperature
                const temp = environment?.temperature || 0.5;
                sensor.current_value = temp * sensor.sensitivity;
                break;

            case 'proximity':
                // Detect nearby agents
                let nearestDist = sensor.range;
                for (const other of nearbyAgents) {
                    if (other === agent) continue;
                    const dist = distance(agent.position, other.position);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                    }
                }
                sensor.current_value = 1 - (nearestDist / sensor.range);
                break;

            case 'kin':
                // Detect kin (same species)
                let kinCount = 0;
                for (const other of nearbyAgents) {
                    if (other === agent) continue;
                    const dist = distance(agent.position, other.position);
                    if (dist <= sensor.range) {
                        const markerDiff = Math.abs(
                            agent.genome.species_marker - other.genome.species_marker
                        );
                        if (markerDiff < CONFIG.KIN_RECOGNITION_THRESHOLD) {
                            kinCount++;
                        }
                    }
                }
                sensor.current_value = Math.min(1, kinCount / 5);
                break;

            case 'viral':
                // Detect nearby viruses
                let virusCount = 0;
                for (const virus of state.viruses) {
                    const dist = distance(agent.position, virus.position);
                    if (dist <= sensor.range) {
                        virusCount++;
                    }
                }
                sensor.current_value = Math.min(1, virusCount / 3);
                break;

            case 'signal':
                // Detect communication signals (placeholder)
                sensor.current_value = 0;
                break;

            case 'prey':
                // Detect potential prey (living agents or corpses based on target)
                let preySignal = 0;
                const target = sensor.target || 'both';

                // Detect living agents as prey
                if (target === 'living' || target === 'both') {
                    for (const other of nearbyAgents) {
                        if (other === agent || !other.alive) continue;
                        const dist = distance(agent.position, other.position);
                        if (dist <= sensor.range) {
                            // Stronger signal for weaker/smaller prey
                            const sizeRatio = agent.genome.nodes.length / other.genome.nodes.length;
                            const energyRatio = agent.energy / (other.energy + 1);
                            const preyValue = Math.min(1, (sizeRatio + energyRatio) / 2);
                            preySignal = Math.max(preySignal, preyValue * (1 - dist / sensor.range));
                        }
                    }
                }

                // Detect corpses
                if (target === 'dead' || target === 'both') {
                    for (const corpse of state.corpses) {
                        if (corpse.energy <= 0) continue;
                        const dist = distance(agent.position, corpse.position);
                        if (dist <= sensor.range) {
                            const corpseValue = Math.min(1, corpse.energy / 50);
                            preySignal = Math.max(preySignal, corpseValue * (1 - dist / sensor.range));
                        }
                    }
                }

                sensor.current_value = preySignal;
                break;
        }

        // Apply sensitivity
        sensor.current_value *= sensor.sensitivity;
    }
}

/**
 * Calculate kinetic energy of an agent
 */
export function getKineticEnergy(agent) {
    let ke = 0;
    for (const node of agent.body.nodes) {
        const speedSq = node.velocity.x ** 2 + node.velocity.y ** 2;
        ke += 0.5 * node.mass * speedSq;
    }
    return ke;
}

/**
 * Calculate potential energy stored in springs
 */
export function getPotentialEnergy(agent) {
    let pe = 0;
    for (const link of agent.body.links) {
        const nodeA = agent.body.nodes[link.node_a];
        const nodeB = agent.body.nodes[link.node_b];

        if (!nodeA || !nodeB) continue;

        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const currentLength = Math.sqrt(dx * dx + dy * dy);
        const displacement = currentLength - link.rest_length;

        // PE = 0.5 * k * x^2
        pe += 0.5 * link.stiffness * displacement * displacement;
    }
    return pe;
}

/**
 * Check if physics is stable (no NaN values)
 */
export function isPhysicsStable(agent) {
    for (const node of agent.body.nodes) {
        if (isNaN(node.position.x) || isNaN(node.position.y) ||
            isNaN(node.velocity.x) || isNaN(node.velocity.y)) {
            return false;
        }
    }
    return true;
}

/**
 * Reset physics state for an agent (emergency recovery)
 */
export function resetPhysicsState(agent) {
    const centerX = agent.position.x || CONFIG.WORLD_WIDTH / 2;
    const centerY = agent.position.y || CONFIG.WORLD_HEIGHT / 2;

    // Reset nodes to genome positions around center
    for (let i = 0; i < agent.body.nodes.length; i++) {
        const genomeNode = agent.genome.nodes[i];
        if (genomeNode) {
            agent.body.nodes[i].position.x = centerX + genomeNode.position.x;
            agent.body.nodes[i].position.y = centerY + genomeNode.position.y;
        }
        agent.body.nodes[i].velocity.x = 0;
        agent.body.nodes[i].velocity.y = 0;
        agent.body.nodes[i].force.x = 0;
        agent.body.nodes[i].force.y = 0;
    }

    // Reset link target lengths
    for (const link of agent.body.links) {
        link.target_length = link.rest_length;
    }

    // Reset motor phases
    for (const motor of agent.body.motors) {
        motor.current_phase = motor.phase_offset;
    }
}

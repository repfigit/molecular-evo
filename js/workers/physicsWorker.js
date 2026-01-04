/**
 * Physics Web Worker
 *
 * Handles physics calculations in a separate thread for better performance.
 * Receives agent body data, processes physics, and returns updated positions.
 *
 * Message Protocol:
 * - Main -> Worker: { type: 'update', agents: [...], config: {...}, dt: number }
 * - Worker -> Main: { type: 'result', agents: [...] }
 * - Main -> Worker: { type: 'init', config: {...} }
 * - Worker -> Main: { type: 'ready' }
 */

// Configuration (received from main thread)
let config = {
    WORLD_WIDTH: 800,
    WORLD_HEIGHT: 600,
    BASE_DRAG: 0.1,
    VISCOSITY_BASE: 0.3,
    MAX_SPEED: 10,
    COLLISION_RESPONSE: 0.5,
    COLLISION_RADIUS: 5,
    SPATIAL_CELL_SIZE: 50
};

// Spatial hash for collision detection
class SpatialHash {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    clear() {
        this.cells.clear();
    }

    hash(x, y) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }

    insert(entity, id) {
        const key = this.hash(entity.position.x, entity.position.y);
        if (!this.cells.has(key)) {
            this.cells.set(key, []);
        }
        this.cells.get(key).push({ ...entity, id });
    }

    getPotentialCollisions() {
        const pairs = [];
        const checked = new Set();

        for (const [key, cell] of this.cells) {
            // Within cell
            for (let i = 0; i < cell.length; i++) {
                for (let j = i + 1; j < cell.length; j++) {
                    const pairKey = [cell[i].id, cell[j].id].sort().join('-');
                    if (!checked.has(pairKey)) {
                        pairs.push([cell[i], cell[j]]);
                        checked.add(pairKey);
                    }
                }
            }

            // Adjacent cells
            const [cx, cy] = key.split(',').map(Number);
            const adjacentOffsets = [[1, 0], [1, 1], [0, 1], [-1, 1]];

            for (const [dx, dy] of adjacentOffsets) {
                const adjKey = `${cx + dx},${cy + dy}`;
                const adjCell = this.cells.get(adjKey);

                if (adjCell) {
                    for (const entityA of cell) {
                        for (const entityB of adjCell) {
                            const pairKey = [entityA.id, entityB.id].sort().join('-');
                            if (!checked.has(pairKey)) {
                                pairs.push([entityA, entityB]);
                                checked.add(pairKey);
                            }
                        }
                    }
                }
            }
        }

        return pairs;
    }
}

let collisionHash = new SpatialHash(50);

/**
 * Process physics for all agents
 */
function processPhysics(agentsData, dt, viscosity) {
    const agents = agentsData;

    // Phase 1: Reset forces and update motors
    for (const agent of agents) {
        resetForces(agent);
        updateMotors(agent, dt);
    }

    // Phase 2: Calculate spring forces
    for (const agent of agents) {
        calculateSpringForces(agent);
    }

    // Phase 3: Apply environmental forces
    for (const agent of agents) {
        applyEnvironmentalForces(agent, viscosity);
    }

    // Phase 4: Handle collisions
    collisionHash.clear();
    for (const agent of agents) {
        collisionHash.insert(agent, agent.id);
    }
    handleCollisions(agents);

    // Phase 5: Integrate
    for (const agent of agents) {
        integrate(agent, dt);
    }

    // Phase 6: Enforce boundaries
    for (const agent of agents) {
        enforceBoundaries(agent);
    }

    // Phase 7: Update center positions
    for (const agent of agents) {
        updateAgentCenter(agent);
    }

    return agents;
}

function resetForces(agent) {
    for (const node of agent.body.nodes) {
        node.force = { x: 0, y: 0 };
    }
}

function updateMotors(agent, dt) {
    for (const motor of agent.body.motors) {
        motor.current_phase += motor.cycle_speed * dt;
        if (motor.current_phase > Math.PI * 2) {
            motor.current_phase -= Math.PI * 2;
        }

        const link = agent.body.links[motor.attached_to];
        if (link) {
            const oscillation = Math.sin(motor.current_phase) * motor.amplitude;
            link.target_length = link.rest_length * (1 + oscillation);
            agent.energyCost = (agent.energyCost || 0) + motor.energy_cost * Math.abs(oscillation) * dt;
        }
    }
}

function calculateSpringForces(agent) {
    for (const link of agent.body.links) {
        const nodeA = agent.body.nodes[link.node_a];
        const nodeB = agent.body.nodes[link.node_b];

        if (!nodeA || !nodeB) continue;

        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const currentLength = Math.sqrt(dx * dx + dy * dy);

        if (currentLength < 0.0001) continue;

        const nx = dx / currentLength;
        const ny = dy / currentLength;

        const targetLength = link.target_length || link.rest_length;
        const displacement = currentLength - targetLength;
        const springForce = link.stiffness * displacement;

        const relVelX = nodeB.velocity.x - nodeA.velocity.x;
        const relVelY = nodeB.velocity.y - nodeA.velocity.y;
        const relVelAlong = relVelX * nx + relVelY * ny;
        const dampingForce = link.damping * relVelAlong;

        const totalForce = springForce + dampingForce;
        const fx = totalForce * nx;
        const fy = totalForce * ny;

        nodeA.force.x += fx;
        nodeA.force.y += fy;
        nodeB.force.x -= fx;
        nodeB.force.y -= fy;
    }
}

function applyEnvironmentalForces(agent, viscosity) {
    const drag = config.BASE_DRAG * (1 + viscosity);

    for (const node of agent.body.nodes) {
        node.force.x -= node.velocity.x * drag * node.mass;
        node.force.y -= node.velocity.y * drag * node.mass;
    }
}

function handleCollisions(agents) {
    const pairs = collisionHash.getPotentialCollisions();

    for (const [agentA, agentB] of pairs) {
        const dx = agentB.position.x - agentA.position.x;
        const dy = agentB.position.y - agentA.position.y;
        const distSq = dx * dx + dy * dy;

        const radiusA = getAgentRadius(agentA);
        const radiusB = getAgentRadius(agentB);
        const minDist = radiusA + radiusB;

        if (distSq < minDist * minDist && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            const pushForce = overlap * config.COLLISION_RESPONSE * 10;

            // Find actual agent objects to update forces
            const realAgentA = agents.find(a => a.id === agentA.id);
            const realAgentB = agents.find(a => a.id === agentB.id);

            if (realAgentA && realAgentB) {
                const forcePerNodeA = pushForce / realAgentA.body.nodes.length;
                const forcePerNodeB = pushForce / realAgentB.body.nodes.length;

                for (const node of realAgentA.body.nodes) {
                    node.force.x -= nx * forcePerNodeA;
                    node.force.y -= ny * forcePerNodeA;
                }

                for (const node of realAgentB.body.nodes) {
                    node.force.x += nx * forcePerNodeB;
                    node.force.y += ny * forcePerNodeB;
                }
            }
        }
    }
}

function getAgentRadius(agent) {
    let maxDist = 0;
    for (const node of agent.body.nodes) {
        const dx = node.position.x - agent.position.x;
        const dy = node.position.y - agent.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist) maxDist = dist;
    }
    return maxDist + config.COLLISION_RADIUS;
}

function integrate(agent, dt) {
    for (const node of agent.body.nodes) {
        const ax = node.force.x / node.mass;
        const ay = node.force.y / node.mass;

        node.velocity.x += ax * dt;
        node.velocity.y += ay * dt;

        const speed = Math.sqrt(node.velocity.x ** 2 + node.velocity.y ** 2);
        if (speed > config.MAX_SPEED) {
            const factor = config.MAX_SPEED / speed;
            node.velocity.x *= factor;
            node.velocity.y *= factor;
        }

        node.position.x += node.velocity.x * dt;
        node.position.y += node.velocity.y * dt;
    }
}

function enforceBoundaries(agent) {
    const margin = 2;
    const bounce = 0.3;

    for (const node of agent.body.nodes) {
        if (node.position.x < margin) {
            node.position.x = margin;
            node.velocity.x *= -bounce;
        }
        if (node.position.x > config.WORLD_WIDTH - margin) {
            node.position.x = config.WORLD_WIDTH - margin;
            node.velocity.x *= -bounce;
        }
        if (node.position.y < margin) {
            node.position.y = margin;
            node.velocity.y *= -bounce;
        }
        if (node.position.y > config.WORLD_HEIGHT - margin) {
            node.position.y = config.WORLD_HEIGHT - margin;
            node.velocity.y *= -bounce;
        }
    }
}

function updateAgentCenter(agent) {
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

// Message handler
self.onmessage = function(e) {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            config = { ...config, ...data.config };
            collisionHash = new SpatialHash(config.SPATIAL_CELL_SIZE);
            self.postMessage({ type: 'ready' });
            break;

        case 'update':
            const { agents, dt, viscosity } = data;
            const result = processPhysics(agents, dt, viscosity);

            // Return only the data needed to update main thread state
            const updateData = result.map(agent => ({
                id: agent.id,
                position: agent.position,
                velocity: agent.velocity,
                body: {
                    nodes: agent.body.nodes.map(n => ({
                        position: n.position,
                        velocity: n.velocity
                    })),
                    motors: agent.body.motors.map(m => ({
                        current_phase: m.current_phase
                    })),
                    links: agent.body.links.map(l => ({
                        target_length: l.target_length
                    }))
                },
                energyCost: agent.energyCost || 0
            }));

            self.postMessage({ type: 'result', data: updateData });
            break;

        case 'ping':
            self.postMessage({ type: 'pong' });
            break;
    }
};

// Signal ready
self.postMessage({ type: 'ready' });

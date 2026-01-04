/**
 * Viral System
 *
 * Handles viral lifecycle:
 * - Free virus diffusion and decay
 * - Infection (attachment, injection)
 * - Lytic cycle (replication, burst)
 * - Lysogenic cycle (integration, dormancy, induction)
 * - Transduction (gene transfer via viruses)
 */

import { CONFIG } from '../config.js';
import { state, logEvent, addViralEvent, addVirus } from '../state.js';
import { vec, distance, generateUUID } from '../utils/math.js';
import {
    createVirus,
    cloneVirus,
    canInfect,
    createTransducingParticle,
    VIRUS_STAGES
} from '../core/virus.js';
import { releaseDNAFragments } from './hgt.js';

/**
 * Process all viral activity
 */
export function processViral(agents, spatialHash, dt) {
    // Update free viruses
    updateFreeViruses(dt);

    // Update attached viruses to follow hosts
    updateAttachedViruses(agents);

    // Process infections
    processInfections(agents, spatialHash, dt);

    // Update infected hosts
    updateInfectedHosts(agents, dt);

    // Random virus spawning
    spawnNewViruses(dt);

    // Clean up dead viruses
    state.viruses = state.viruses.filter(v => v.lifespan > 0);
}

/**
 * Update attached viruses to follow their hosts
 */
function updateAttachedViruses(agents) {
    // Build a map of agent IDs to agents for quick lookup
    const agentMap = new Map();
    for (const agent of agents) {
        agentMap.set(agent.id, agent);
    }

    for (const virus of state.viruses) {
        // Only update viruses that are attached to a host
        if (virus.stage === VIRUS_STAGES.FREE) continue;
        if (!virus.host_id) continue;

        const host = agentMap.get(virus.host_id);
        if (host && host.alive) {
            // Follow the host position
            virus.position.x = host.position.x;
            virus.position.y = host.position.y;
        }
    }
}

/**
 * Update free viruses (movement and decay)
 */
function updateFreeViruses(dt) {
    for (const virus of state.viruses) {
        if (virus.stage !== VIRUS_STAGES.FREE) continue;

        // Age and decay
        virus.age += dt;
        virus.lifespan -= dt;

        // Brownian motion / diffusion
        virus.velocity.x += (Math.random() - 0.5) * CONFIG.VIRUS_DIFFUSION_RATE * dt;
        virus.velocity.y += (Math.random() - 0.5) * CONFIG.VIRUS_DIFFUSION_RATE * dt;

        // Damping
        virus.velocity.x *= 0.98;
        virus.velocity.y *= 0.98;

        // Update position
        virus.position.x += virus.velocity.x * dt;
        virus.position.y += virus.velocity.y * dt;

        // Boundary wrap/bounce
        if (virus.position.x < 0) {
            virus.position.x = 0;
            virus.velocity.x *= -0.5;
        }
        if (virus.position.x > CONFIG.WORLD_WIDTH) {
            virus.position.x = CONFIG.WORLD_WIDTH;
            virus.velocity.x *= -0.5;
        }
        if (virus.position.y < 0) {
            virus.position.y = 0;
            virus.velocity.y *= -0.5;
        }
        if (virus.position.y > CONFIG.WORLD_HEIGHT) {
            virus.position.y = CONFIG.WORLD_HEIGHT;
            virus.velocity.y *= -0.5;
        }
    }
}

/**
 * Process infection attempts
 */
function processInfections(agents, spatialHash, dt) {
    for (const virus of state.viruses) {
        if (virus.stage !== VIRUS_STAGES.FREE) continue;

        // Find nearby potential hosts
        const nearby = spatialHash.query(
            virus.position.x,
            virus.position.y,
            CONFIG.VIRUS_INFECTION_RANGE
        ).filter(agent =>
            agent.alive &&
            !agent.infection &&
            canInfect(virus, agent)
        );

        if (nearby.length === 0) continue;

        // Try to infect nearest host
        const host = nearby.reduce((closest, current) => {
            const distCurrent = distance(virus.position, current.position);
            const distClosest = distance(virus.position, closest.position);
            return distCurrent < distClosest ? current : closest;
        });

        attemptInfection(virus, host, dt);
    }
}

/**
 * Attempt to infect a host
 */
function attemptInfection(virus, host, dt) {
    // Move toward host
    const dx = host.position.x - virus.position.x;
    const dy = host.position.y - virus.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    virus.velocity.x += (dx / dist) * CONFIG.VIRUS_HOST_ATTRACTION * dt;
    virus.velocity.y += (dy / dist) * CONFIG.VIRUS_HOST_ATTRACTION * dt;

    // Check if close enough to attach
    if (dist < CONFIG.VIRUS_ATTACHMENT_RANGE) {
        // Check CRISPR immunity
        if (checkCRISPRImmunity(host, virus)) {
            // Virus destroyed by immunity
            virus.lifespan = 0;
            logEvent('crispr_defense', {
                host: host.id,
                virus: virus.id
            });
            return;
        }

        // Begin infection
        startInfection(virus, host);
    }
}

/**
 * Check if host has CRISPR immunity against virus
 */
function checkCRISPRImmunity(host, virus) {
    if (!host.genome.crispr?.active) return false;
    if (!host.genome.crispr.memory || host.genome.crispr.memory.length === 0) return false;

    // Check if any memory matches virus
    for (const memory of host.genome.crispr.memory) {
        if (memory.virus_marker === virus.genome.id ||
            virus.genome.surface_markers.includes(memory.virus_marker)) {
            // Immunity check
            const immunityChance = host.genome.crispr.efficiency * (1 - virus.genome.crispr_evasion);
            return Math.random() < immunityChance;
        }
    }

    return false;
}

/**
 * Start infection process
 */
function startInfection(virus, host) {
    virus.stage = VIRUS_STAGES.ATTACHED;
    virus.host_id = host.id;

    host.infection = {
        virus_id: virus.id,
        virus_genome_id: virus.genome.id,
        stage: 'attached',
        progress: 0,
        replication_count: 0,
        start_tick: state.tick
    };

    virus.infection_count++;

    logEvent('infection_start', {
        virus: virus.id,
        host: host.id
    });

    addViralEvent('infection', virus, host);
}

/**
 * Update infected hosts
 */
function updateInfectedHosts(agents, dt) {
    for (const agent of agents) {
        if (!agent.alive || !agent.infection) continue;

        const virus = state.viruses.find(v => v.id === agent.infection.virus_id);
        if (!virus) {
            // Virus gone, clear infection
            agent.infection = null;
            continue;
        }

        updateInfection(agent, virus, dt);
    }
}

/**
 * Update a single infection
 */
function updateInfection(host, virus, dt) {
    const infection = host.infection;

    switch (infection.stage) {
        case 'attached':
            // Progress injection
            infection.progress += virus.genome.injection_speed * dt;
            if (infection.progress >= 1) {
                infection.stage = 'injected';
                infection.progress = 0;
                virus.stage = VIRUS_STAGES.INJECTED;

                // Decide lytic vs lysogenic
                if (Math.random() < virus.genome.lytic_preference) {
                    infection.stage = 'lytic';
                    virus.stage = VIRUS_STAGES.LYTIC;
                } else {
                    infection.stage = 'lysogenic';
                    virus.stage = VIRUS_STAGES.LYSOGENIC;
                }
            }
            break;

        case 'lytic':
            processLyticCycle(host, virus, dt);
            break;

        case 'lysogenic':
            processLysogenicCycle(host, virus, dt);
            break;
    }
}

/**
 * Process lytic cycle (active replication)
 */
function processLyticCycle(host, virus, dt) {
    const infection = host.infection;

    // Drain host energy for replication
    const drainRate = CONFIG.LYTIC_ENERGY_DRAIN * dt;
    host.energy -= drainRate;

    // Progress replication
    infection.progress += virus.genome.replication_rate * dt * 0.1;

    // Check if ready to burst
    if (infection.progress >= 1) {
        // Burst!
        burstHost(host, virus);
    }

    // Host might die from energy loss
    if (host.energy <= 0) {
        burstHost(host, virus);
    }
}

/**
 * Process lysogenic cycle (dormant)
 */
function processLysogenicCycle(host, virus, dt) {
    // Small chance to trigger lytic cycle
    let triggerChance = CONFIG.LYSOGENIC_TRIGGER_RATE * dt;

    // Higher chance if host is stressed
    if (host.energy < host.genome.metabolism.storage_capacity * 0.2) {
        triggerChance *= 3;
    }

    if (Math.random() < triggerChance) {
        // Switch to lytic
        host.infection.stage = 'lytic';
        host.infection.progress = 0;
        virus.stage = VIRUS_STAGES.LYTIC;

        logEvent('lysogenic_induction', {
            host: host.id,
            virus: virus.id
        });
    }

    // Prophage can be passed to offspring (handled in reproduction)
}

/**
 * Burst host and release new viruses
 */
function burstHost(host, virus) {
    const burstCount = virus.genome.burst_size;
    const pos = { x: host.position.x, y: host.position.y };

    // Release new viruses
    for (let i = 0; i < burstCount; i++) {
        const newVirus = cloneVirus(virus);
        newVirus.position.x = pos.x + (Math.random() - 0.5) * 30;
        newVirus.position.y = pos.y + (Math.random() - 0.5) * 30;

        // Check for transduction (packaging host DNA)
        if (Math.random() < virus.genome.packaging_error_rate) {
            const hostGenes = extractHostGenes(host);
            if (hostGenes) {
                newVirus.cargo = {
                    type: 'transduction',
                    genes: hostGenes,
                    source_species: host.genome.species_marker
                };
            }
        }

        addVirus(newVirus);
        virus.offspring_count++;
    }

    // Kill host
    host.alive = false;
    host.infection = null;

    // Release DNA fragments
    releaseDNAFragments(host);

    logEvent('viral_burst', {
        host: host.id,
        virus: virus.id,
        newViruses: burstCount
    });

    addViralEvent('burst', virus, host);

    // Original virus is consumed
    virus.lifespan = 0;
}

/**
 * Extract genes from host for transduction
 */
function extractHostGenes(host) {
    // Package random genetic information
    const geneTypes = ['metabolism', 'social', 'motor', 'sensor'];
    const type = geneTypes[Math.floor(Math.random() * geneTypes.length)];

    switch (type) {
        case 'metabolism':
            return {
                type: 'metabolism',
                efficiency: host.genome.metabolism.efficiency,
                source_species: host.genome.species_marker
            };
        case 'social':
            return {
                type: 'social',
                cooperation: host.genome.social.cooperation_willingness,
                aggression: host.genome.social.aggression,
                source_species: host.genome.species_marker
            };
        case 'motor':
            if (host.genome.motors.length > 0) {
                const motor = host.genome.motors[Math.floor(Math.random() * host.genome.motors.length)];
                return {
                    type: 'motor',
                    motor: JSON.parse(JSON.stringify(motor)),
                    source_species: host.genome.species_marker
                };
            }
            return null;
        case 'sensor':
            if (host.genome.sensors.length > 0) {
                const sensor = host.genome.sensors[Math.floor(Math.random() * host.genome.sensors.length)];
                return {
                    type: 'sensor',
                    sensor: JSON.parse(JSON.stringify(sensor)),
                    source_species: host.genome.species_marker
                };
            }
            return null;
    }
    return null;
}

/**
 * Process transduction (gene transfer via virus)
 */
export function processTransduction(virus, newHost) {
    if (!virus.cargo || virus.cargo.type !== 'transduction') return false;

    const genes = virus.cargo.genes;

    // Integrate transduced genes
    switch (genes.type) {
        case 'metabolism':
            newHost.genome.metabolism.efficiency = Math.min(1,
                (newHost.genome.metabolism.efficiency + genes.efficiency) / 2
            );
            break;

        case 'social':
            newHost.genome.social.cooperation_willingness = Math.min(1,
                (newHost.genome.social.cooperation_willingness + genes.cooperation) / 2
            );
            newHost.genome.social.aggression = Math.min(1,
                (newHost.genome.social.aggression + genes.aggression) / 2
            );
            break;

        case 'motor':
            if (newHost.genome.motors.length < CONFIG.MAX_MOTORS) {
                const motor = genes.motor;
                motor.id = newHost.genome.motors.length;
                newHost.genome.motors.push(motor);
            }
            break;

        case 'sensor':
            if (newHost.genome.sensors.length < CONFIG.MAX_SENSORS) {
                const sensor = genes.sensor;
                sensor.id = newHost.genome.sensors.length;
                newHost.genome.sensors.push(sensor);
            }
            break;
    }

    logEvent('transduction', {
        host: newHost.id,
        geneType: genes.type,
        sourceSpecies: genes.source_species
    });

    return true;
}

/**
 * Spawn new viruses randomly
 */
function spawnNewViruses(dt) {
    if (Math.random() > CONFIG.VIRUS_SPAWN_RATE * dt) return;
    if (state.viruses.length >= CONFIG.MAX_VIRUSES) return;

    const virus = createVirus({
        position: {
            x: Math.random() * CONFIG.WORLD_WIDTH,
            y: Math.random() * CONFIG.WORLD_HEIGHT
        }
    });

    addVirus(virus);
}

/**
 * Initialize viral population
 */
export function initViruses(count = CONFIG.INITIAL_VIRUS_COUNT) {
    state.viruses = [];
    // Note: entityIndex.viruses is cleared in resetState(), called before this
    for (let i = 0; i < count; i++) {
        addVirus(createVirus({
            position: {
                x: Math.random() * CONFIG.WORLD_WIDTH,
                y: Math.random() * CONFIG.WORLD_HEIGHT
            }
        }));
    }
}

/**
 * Get viral statistics
 */
export function getViralStats() {
    const stages = {};
    for (const stage of Object.values(VIRUS_STAGES)) {
        stages[stage] = 0;
    }

    let totalAge = 0;
    let transducingCount = 0;

    for (const virus of state.viruses) {
        stages[virus.stage]++;
        totalAge += virus.age;
        if (virus.cargo) transducingCount++;
    }

    return {
        total: state.viruses.length,
        stages,
        avgAge: state.viruses.length > 0 ? totalAge / state.viruses.length : 0,
        transducingCount,
        infectedHosts: state.agents.filter(a => a.alive && a.infection).length
    };
}

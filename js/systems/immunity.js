/**
 * Immunity System
 *
 * Handles CRISPR-based adaptive immunity:
 * - Memory formation from survived infections
 * - Immune response to known pathogens
 * - Memory inheritance
 * - Cross-immunity effects
 */

import { CONFIG } from '../config.js';
import { state, logEvent } from '../state.js';
import { generateUUID } from '../utils/math.js';

/**
 * Process immunity for all agents
 */
export function processImmunity(agents, dt) {
    for (const agent of agents) {
        if (!agent.alive) continue;
        if (!agent.genome.crispr?.active) continue;

        // Update CRISPR system
        updateCRISPRSystem(agent, dt);

        // Check for memory formation from current infection
        if (agent.infection) {
            tryFormMemory(agent);
        }
    }
}

/**
 * Update CRISPR system for an agent
 */
function updateCRISPRSystem(agent, dt) {
    const crispr = agent.genome.crispr;
    if (!crispr) return;

    // Memory decay over time (very slow)
    if (crispr.memory && crispr.memory.length > 0) {
        crispr.memory = crispr.memory.filter(mem => {
            mem.age += dt;
            mem.strength -= CONFIG.CRISPR_MEMORY_DECAY * dt;
            return mem.strength > 0;
        });
    }

    // Boost efficiency if recently defended
    if (agent.recent_defense) {
        crispr.efficiency = Math.min(1, crispr.efficiency + 0.01);
        agent.recent_defense = false;
    }
}

/**
 * Try to form memory from current infection
 */
function tryFormMemory(agent) {
    const crispr = agent.genome.crispr;
    if (!crispr || !crispr.active) return;

    const infection = agent.infection;

    // Only form memory if survived long enough
    const infectionDuration = state.tick - infection.start_tick;
    if (infectionDuration < 50) return;

    // Check if already have memory for this virus
    const existingMemory = crispr.memory?.find(
        m => m.virus_genome_id === infection.virus_genome_id
    );

    if (existingMemory) {
        // Strengthen existing memory
        existingMemory.strength = Math.min(1, existingMemory.strength + 0.1);
        existingMemory.encounters++;
        return;
    }

    // Try to form new memory
    if (Math.random() > crispr.efficiency * CONFIG.CRISPR_MEMORY_FORMATION_RATE) {
        return;
    }

    // Check memory slots
    crispr.memory = crispr.memory || [];
    if (crispr.memory.length >= CONFIG.CRISPR_MEMORY_SLOTS) {
        // Remove weakest memory
        crispr.memory.sort((a, b) => a.strength - b.strength);
        crispr.memory.shift();
    }

    // Form new memory
    const virus = state.viruses.find(v => v.id === infection.virus_id);
    const memory = {
        id: generateUUID(),
        virus_genome_id: infection.virus_genome_id,
        virus_marker: virus?.genome.surface_markers[0] || infection.virus_genome_id,
        formed_tick: state.tick,
        strength: 0.5 + Math.random() * 0.3,
        age: 0,
        encounters: 1
    };

    crispr.memory.push(memory);

    logEvent('crispr_memory_formed', {
        agent: agent.id,
        virusGenome: infection.virus_genome_id
    });
}

/**
 * Check immunity against a virus
 * Returns: { immune: boolean, strength: number }
 */
export function checkImmunity(agent, virus) {
    const crispr = agent.genome.crispr;
    if (!crispr || !crispr.active) {
        return { immune: false, strength: 0 };
    }

    if (!crispr.memory || crispr.memory.length === 0) {
        return { immune: false, strength: 0 };
    }

    // Check each memory
    for (const memory of crispr.memory) {
        // Direct match
        if (memory.virus_genome_id === virus.genome.id) {
            const immuneChance = memory.strength * crispr.efficiency;
            if (Math.random() < immuneChance) {
                // Strengthen memory on successful defense
                memory.strength = Math.min(1, memory.strength + 0.1);
                memory.encounters++;
                agent.recent_defense = true;

                return { immune: true, strength: memory.strength };
            }
        }

        // Marker match (cross-immunity)
        if (virus.genome.surface_markers.includes(memory.virus_marker)) {
            const crossImmunity = memory.strength * crispr.efficiency * 0.5;
            if (Math.random() < crossImmunity) {
                memory.encounters++;
                agent.recent_defense = true;

                return { immune: true, strength: memory.strength * 0.5 };
            }
        }
    }

    // Check virus evasion
    if (Math.random() < virus.genome.crispr_evasion) {
        return { immune: false, strength: 0 };
    }

    return { immune: false, strength: 0 };
}

/**
 * Clear infection when immunity kicks in
 */
export function clearInfection(agent) {
    if (!agent.infection) return;

    const virus = state.viruses.find(v => v.id === agent.infection.virus_id);
    if (virus) {
        virus.lifespan = 0; // Destroy virus
    }

    agent.infection = null;
    agent.infections_survived++;

    logEvent('infection_cleared', {
        agent: agent.id
    });
}

/**
 * Inherit immunity from parent
 */
export function inheritImmunity(parent, child) {
    if (!parent.genome.crispr?.memory) return;
    if (!child.genome.crispr) {
        child.genome.crispr = {
            active: true,
            efficiency: 0.3,
            memory: []
        };
    }

    // Copy some memories (with reduced strength)
    for (const memory of parent.genome.crispr.memory) {
        if (Math.random() < CONFIG.CRISPR_INHERITANCE_RATE) {
            child.genome.crispr.memory.push({
                id: generateUUID(),
                virus_genome_id: memory.virus_genome_id,
                virus_marker: memory.virus_marker,
                formed_tick: state.tick,
                strength: memory.strength * 0.5, // Reduced strength
                age: 0,
                encounters: 0,
                inherited: true
            });
        }
    }

    // Also inherit prophages (lysogenic viruses)
    if (parent.lysogenic_viruses) {
        child.lysogenic_viruses = parent.lysogenic_viruses.map(v => ({
            ...v,
            id: generateUUID()
        }));
    }
}

/**
 * Get immunity statistics
 */
export function getImmunityStats() {
    let agentsWithCRISPR = 0;
    let totalMemories = 0;
    let avgEfficiency = 0;
    let immuneResponses = 0;

    for (const agent of state.agents) {
        if (!agent.alive) continue;
        if (!agent.genome.crispr?.active) continue;

        agentsWithCRISPR++;
        avgEfficiency += agent.genome.crispr.efficiency;
        totalMemories += agent.genome.crispr.memory?.length || 0;

        if (agent.infections_survived > 0) {
            immuneResponses += agent.infections_survived;
        }
    }

    return {
        agentsWithCRISPR,
        avgEfficiency: agentsWithCRISPR > 0 ? avgEfficiency / agentsWithCRISPR : 0,
        totalMemories,
        avgMemoriesPerAgent: agentsWithCRISPR > 0 ? totalMemories / agentsWithCRISPR : 0,
        immuneResponses
    };
}

/**
 * Initialize CRISPR system for an agent
 */
export function initCRISPR(agent) {
    if (!agent.genome.crispr) {
        agent.genome.crispr = {
            active: Math.random() < 0.3, // 30% chance to have CRISPR
            efficiency: 0.2 + Math.random() * 0.4,
            memory: []
        };
    }
}

/**
 * Boost immunity (for debugging/testing)
 */
export function boostImmunity(agent, amount = 0.1) {
    if (!agent.genome.crispr) {
        initCRISPR(agent);
        agent.genome.crispr.active = true;
    }

    agent.genome.crispr.efficiency = Math.min(1,
        agent.genome.crispr.efficiency + amount
    );
}

/**
 * Add artificial immunity memory
 */
export function addArtificialImmunity(agent, virusMarker) {
    if (!agent.genome.crispr) {
        initCRISPR(agent);
        agent.genome.crispr.active = true;
    }

    agent.genome.crispr.memory = agent.genome.crispr.memory || [];

    agent.genome.crispr.memory.push({
        id: generateUUID(),
        virus_genome_id: virusMarker,
        virus_marker: virusMarker,
        formed_tick: state.tick,
        strength: 0.8,
        age: 0,
        encounters: 0,
        artificial: true
    });
}

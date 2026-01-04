/**
 * History and Save/Load Utilities
 *
 * Handles simulation state serialization, deserialization,
 * and history tracking for replays and analysis.
 */

import { CONFIG } from '../config.js';
import { state, resetState } from '../state.js';
import { createAgent } from '../core/agent.js';

/**
 * Simulation snapshot for history
 */
export class SimulationSnapshot {
    constructor() {
        this.tick = 0;
        this.generation = 0;
        this.timestamp = Date.now();
        this.agentCount = 0;
        this.speciesCount = 0;
        this.avgFitness = 0;
        this.avgEnergy = 0;
    }

    static capture() {
        const snapshot = new SimulationSnapshot();
        snapshot.tick = state.tick;
        snapshot.generation = state.generation;
        snapshot.agentCount = state.agents.filter(a => a.alive).length;
        snapshot.speciesCount = state.stats.speciesCount;
        snapshot.avgFitness = state.stats.avgFitness;
        snapshot.avgEnergy = state.stats.avgEnergy;
        return snapshot;
    }
}

/**
 * History manager for tracking simulation over time
 */
export class HistoryManager {
    constructor(maxSnapshots = 1000) {
        this.snapshots = [];
        this.maxSnapshots = maxSnapshots;
        this.snapshotInterval = 100; // ticks between snapshots
    }

    /**
     * Record a snapshot if interval has passed
     */
    update() {
        if (state.tick % this.snapshotInterval === 0) {
            this.addSnapshot(SimulationSnapshot.capture());
        }
    }

    /**
     * Add a snapshot to history
     */
    addSnapshot(snapshot) {
        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }
    }

    /**
     * Get population data for graphing
     */
    getPopulationHistory() {
        return this.snapshots.map(s => ({
            tick: s.tick,
            count: s.agentCount
        }));
    }

    /**
     * Get fitness history for graphing
     */
    getFitnessHistory() {
        return this.snapshots.map(s => ({
            tick: s.tick,
            value: s.avgFitness
        }));
    }

    /**
     * Get species diversity history
     */
    getSpeciesHistory() {
        return this.snapshots.map(s => ({
            tick: s.tick,
            count: s.speciesCount
        }));
    }

    /**
     * Clear all history
     */
    clear() {
        this.snapshots = [];
    }

    /**
     * Export history to JSON
     */
    toJSON() {
        return {
            snapshots: this.snapshots,
            maxSnapshots: this.maxSnapshots,
            snapshotInterval: this.snapshotInterval
        };
    }

    /**
     * Import history from JSON
     */
    fromJSON(data) {
        this.snapshots = data.snapshots || [];
        this.maxSnapshots = data.maxSnapshots || 1000;
        this.snapshotInterval = data.snapshotInterval || 100;
    }
}

/**
 * Serialize the full simulation state to JSON-compatible object
 */
export function serializeState() {
    return {
        version: '1.0.0',
        timestamp: Date.now(),
        config: serializeConfig(),
        state: {
            tick: state.tick,
            generation: state.generation,
            speed: state.speed,
            agents: state.agents.map(serializeAgent),
            viruses: state.viruses.map(serializeVirus),
            dnaFragments: state.dnaFragments.map(serializeDNAFragment),
            environment: serializeEnvironment(),
            eventQueue: state.eventQueue,
            history: state.history,
            stats: state.stats
        }
    };
}

/**
 * Serialize config (only non-default values for smaller file)
 */
function serializeConfig() {
    // Store all config for full reproducibility
    return { ...CONFIG };
}

/**
 * Serialize an agent
 */
function serializeAgent(agent) {
    return {
        id: agent.id,
        alive: agent.alive,
        age: agent.age,
        energy: agent.energy,
        fitness: agent.fitness,
        position: { ...agent.position },
        genome: serializeGenome(agent.genome),
        infection: agent.infection ? { ...agent.infection } : null,
        cooperativeLinks: agent.cooperativeLinks?.map(link => ({
            partnerId: link.partner?.id,
            strength: link.strength,
            age: link.age
        })) || [],
        symbioticBonds: agent.symbioticBonds?.map(bond => ({
            partnerId: bond.partner?.id,
            benefitType: bond.benefitType,
            strength: bond.strength,
            age: bond.age
        })) || [],
        offspring_count: agent.offspring_count,
        territorial: agent.territorial,
        territory_center: agent.territory_center ? { ...agent.territory_center } : null,
        mutation_boost: agent.mutation_boost
    };
}

/**
 * Serialize genome
 */
function serializeGenome(genome) {
    return {
        id: genome.id,
        generation: genome.generation,
        species_marker: genome.species_marker,
        parent_id: genome.parent_id,
        nodes: genome.nodes.map(n => ({ ...n })),
        links: genome.links.map(l => ({ ...l })),
        motors: genome.motors.map(m => ({ ...m })),
        sensors: genome.sensors.map(s => ({ ...s })),
        metabolism: { ...genome.metabolism },
        social: { ...genome.social },
        hgt: {
            transfer_willingness: genome.hgt.transfer_willingness,
            uptake_efficiency: genome.hgt.uptake_efficiency,
            plasmids: genome.hgt.plasmids.map(p => ({ ...p }))
        },
        viral_susceptibility: genome.viral_susceptibility,
        crispr: genome.crispr ? {
            enabled: genome.crispr.enabled,
            efficiency: genome.crispr.efficiency,
            memory: [...(genome.crispr.memory || [])]
        } : null,
        novel_genes: genome.novel_genes ? genome.novel_genes.map(g => ({ ...g })) : []
    };
}

/**
 * Serialize virus
 */
function serializeVirus(virus) {
    return {
        id: virus.id,
        position: { ...virus.position },
        velocity: { ...virus.velocity },
        genome: { ...virus.genome },
        stage: virus.stage,
        hostId: virus.host?.id || null,
        age: virus.age,
        infectionProgress: virus.infectionProgress,
        transducedGenes: virus.transducedGenes ? [...virus.transducedGenes] : null
    };
}

/**
 * Serialize DNA fragment
 */
function serializeDNAFragment(fragment) {
    return {
        id: fragment.id,
        position: { ...fragment.position },
        genes: fragment.genes ? [...fragment.genes] : [],
        age: fragment.age,
        origin: fragment.origin
    };
}

/**
 * Serialize environment
 */
function serializeEnvironment() {
    const env = state.environment;
    if (!env) return null;

    return {
        temperature: env.temperature,
        viscosity: env.viscosity,
        rows: env.rows,
        cols: env.cols,
        cellSize: env.cellSize,
        resources: env.resources,
        toxicZones: env.toxicZones?.map(z => ({ ...z })) || []
    };
}

/**
 * Deserialize and restore simulation state
 */
export function deserializeState(data, spatialHash) {
    if (!data || !data.state) {
        throw new Error('Invalid save file format');
    }

    // Validate version
    if (data.version !== '1.0.0') {
        console.warn(`Save file version ${data.version} may not be fully compatible`);
    }

    // Reset state first
    resetState();

    // Restore basic state
    state.tick = data.state.tick;
    state.generation = data.state.generation;
    state.speed = data.state.speed || 1;

    // Restore environment
    if (data.state.environment) {
        state.environment = deserializeEnvironment(data.state.environment);
    }

    // Restore agents (need to rebuild body from genome)
    const agentMap = new Map();
    state.agents = data.state.agents.map(agentData => {
        const agent = deserializeAgent(agentData);
        agentMap.set(agent.id, agent);
        spatialHash?.insert(agent);
        return agent;
    });

    // Restore agent relationships (cooperative links, symbiotic bonds)
    for (const agentData of data.state.agents) {
        const agent = agentMap.get(agentData.id);
        if (!agent) continue;

        // Restore cooperative links
        agent.cooperativeLinks = (agentData.cooperativeLinks || [])
            .map(link => {
                const partner = agentMap.get(link.partnerId);
                if (!partner) return null;
                return {
                    partner,
                    strength: link.strength,
                    age: link.age
                };
            })
            .filter(Boolean);

        // Restore symbiotic bonds
        agent.symbioticBonds = (agentData.symbioticBonds || [])
            .map(bond => {
                const partner = agentMap.get(bond.partnerId);
                if (!partner) return null;
                return {
                    partner,
                    benefitType: bond.benefitType,
                    strength: bond.strength,
                    age: bond.age
                };
            })
            .filter(Boolean);
    }

    // Restore viruses
    state.viruses = (data.state.viruses || []).map(virusData => {
        const virus = deserializeVirus(virusData);
        // Reconnect host reference
        if (virusData.hostId) {
            virus.host = agentMap.get(virusData.hostId);
        }
        return virus;
    });

    // Restore DNA fragments
    state.dnaFragments = (data.state.dnaFragments || []).map(deserializeDNAFragment);

    // Restore event queue
    state.eventQueue = data.state.eventQueue || [];

    // Restore history
    state.history = data.state.history || { population: [], fitness: [], species: [] };

    // Restore stats
    if (data.state.stats) {
        Object.assign(state.stats, data.state.stats);
    }

    return true;
}

/**
 * Deserialize agent
 */
function deserializeAgent(data) {
    // Create agent from genome
    const agent = createAgent(data.genome, {
        position: { x: data.position.x, y: data.position.y }
    });

    // Restore runtime state
    agent.id = data.id;
    agent.alive = data.alive;
    agent.age = data.age;
    agent.energy = data.energy;
    agent.fitness = data.fitness;
    agent.infection = data.infection;
    agent.offspring_count = data.offspring_count || 0;
    agent.territorial = data.territorial || false;
    agent.territory_center = data.territory_center;
    agent.mutation_boost = data.mutation_boost || 1;

    return agent;
}

/**
 * Deserialize virus
 */
function deserializeVirus(data) {
    return {
        id: data.id,
        position: { ...data.position },
        velocity: { ...data.velocity },
        genome: { ...data.genome },
        stage: data.stage,
        host: null, // Will be reconnected after agents are loaded
        age: data.age,
        infectionProgress: data.infectionProgress || 0,
        transducedGenes: data.transducedGenes ? [...data.transducedGenes] : null
    };
}

/**
 * Deserialize DNA fragment
 */
function deserializeDNAFragment(data) {
    return {
        id: data.id,
        position: { ...data.position },
        genes: data.genes ? [...data.genes] : [],
        age: data.age,
        origin: data.origin
    };
}

/**
 * Deserialize environment
 */
function deserializeEnvironment(data) {
    return {
        temperature: data.temperature,
        viscosity: data.viscosity,
        rows: data.rows,
        cols: data.cols,
        cellSize: data.cellSize,
        resources: data.resources,
        toxicZones: data.toxicZones || []
    };
}

/**
 * Create downloadable save file
 */
export function downloadSaveFile(filename = null) {
    const data = serializeState();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `molecular-evolution-${formatTimestamp(data.timestamp)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return true;
}

/**
 * Load save file from File object
 */
export async function loadSaveFile(file, spatialHash) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                deserializeState(data, spatialHash);
                resolve(data);
            } catch (err) {
                reject(new Error(`Failed to parse save file: ${err.message}`));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * Format timestamp for filename
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Get save file metadata without full load
 */
export async function getSaveFileInfo(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                resolve({
                    version: data.version,
                    timestamp: data.timestamp,
                    tick: data.state?.tick,
                    generation: data.state?.generation,
                    agentCount: data.state?.agents?.length || 0,
                    virusCount: data.state?.viruses?.length || 0
                });
            } catch (err) {
                reject(new Error('Invalid save file'));
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Auto-save manager
 */
export class AutoSaveManager {
    constructor(intervalMinutes = 5) {
        this.interval = intervalMinutes * 60 * 1000;
        this.lastSave = Date.now();
        this.enabled = false;
        this.maxAutoSaves = 3;
    }

    /**
     * Enable auto-save
     */
    enable() {
        this.enabled = true;
        this.lastSave = Date.now();
    }

    /**
     * Disable auto-save
     */
    disable() {
        this.enabled = false;
    }

    /**
     * Check if auto-save is due
     */
    checkAutoSave() {
        if (!this.enabled) return false;

        const now = Date.now();
        if (now - this.lastSave >= this.interval) {
            this.lastSave = now;
            return true;
        }
        return false;
    }

    /**
     * Perform auto-save to localStorage
     */
    performAutoSave() {
        try {
            const data = serializeState();
            const key = `autosave-${Date.now()}`;

            // Store in localStorage
            localStorage.setItem(key, JSON.stringify(data));

            // Clean up old auto-saves
            this.cleanOldAutoSaves();

            console.log('Auto-save completed:', key);
            return true;
        } catch (err) {
            console.error('Auto-save failed:', err);
            return false;
        }
    }

    /**
     * Remove old auto-saves beyond max limit
     */
    cleanOldAutoSaves() {
        const keys = Object.keys(localStorage)
            .filter(k => k.startsWith('autosave-'))
            .sort()
            .reverse();

        while (keys.length > this.maxAutoSaves) {
            const oldKey = keys.pop();
            localStorage.removeItem(oldKey);
        }
    }

    /**
     * Get list of available auto-saves
     */
    getAutoSaves() {
        return Object.keys(localStorage)
            .filter(k => k.startsWith('autosave-'))
            .map(k => {
                try {
                    const data = JSON.parse(localStorage.getItem(k));
                    return {
                        key: k,
                        timestamp: data.timestamp,
                        tick: data.state?.tick,
                        generation: data.state?.generation
                    };
                } catch {
                    return null;
                }
            })
            .filter(Boolean)
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Load from auto-save
     */
    loadAutoSave(key, spatialHash) {
        try {
            const json = localStorage.getItem(key);
            if (!json) throw new Error('Auto-save not found');

            const data = JSON.parse(json);
            deserializeState(data, spatialHash);
            return data;
        } catch (err) {
            console.error('Failed to load auto-save:', err);
            throw err;
        }
    }
}

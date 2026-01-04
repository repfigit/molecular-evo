/**
 * Global state management for the Molecular Evolution Simulator
 * Centralized state that all systems can read from and write to
 */

import { CONFIG } from './config.js';

/**
 * The main simulation state object
 */
export const state = {
    // === SIMULATION STATUS ===
    running: false,
    paused: true,
    speed: 1.0,
    tick: 0,
    generation: 0,
    lastTickTime: 0,
    deltaTime: 0,
    fps: 0,

    // === ENTITIES ===
    agents: [],
    viruses: [],
    dnaFragments: [],

    // === ENVIRONMENT ===
    environment: null,

    // === SEASONS & WEATHER ===
    currentSeason: 'spring',
    seasonProgress: 0,              // 0-1 progress through current season
    currentWeather: 'clear',
    weatherDuration: 0,             // Ticks remaining for current weather
    yearCount: 0,                   // How many full years have passed

    // === RELATIONSHIPS ===
    cooperativeLinks: [],
    symbioticPairs: [],

    // === SELECTION ===
    selectedEntity: null,
    selectedType: null,          // 'agent', 'virus', or null

    // === VIEW STATE ===
    camera: {
        x: CONFIG.WORLD_WIDTH / 2,
        y: CONFIG.WORLD_HEIGHT / 2,
        zoom: 1.0
    },
    overlayMode: CONFIG.DEFAULT_OVERLAY,
    agentColorMode: CONFIG.DEFAULT_AGENT_COLOR_MODE,
    showEnergyBars: false,

    // === VISUAL EFFECTS ===
    visualEvents: [],                // For rendering visual effects (HGT, infections, etc.)

    // === STATISTICS ===
    stats: {
        totalAgents: 0,
        speciesCount: 0,
        cooperatingCount: 0,
        symbioticCount: 0,
        infectedCount: 0,
        avgPlasmids: 0,
        avgFitness: 0,
        avgEnergy: 0,
        viralLoad: 0,
        dnaFragmentCount: 0,
        totalResources: 0
    },

    // === HISTORY ===
    history: {
        population: [],
        speciesCount: [],
        avgFitness: [],
        events: []
    },

    // === EVENTS ===
    activeEvents: [],
    eventQueue: [],

    // === SPECIES TRACKING ===
    speciesMap: new Map(),           // species_marker -> species data
    speciesColors: new Map(),        // species_marker -> color

    // === HGT TRACKING ===
    hgtEvents: [],                   // Recent HGT events for visualization
    viralEvents: [],                 // Recent viral events

    // === PERFORMANCE ===
    physicsTime: 0,
    renderTime: 0,
    systemsTime: 0
};

/**
 * Reset the simulation state to initial values
 */
export function resetState() {
    state.running = false;
    state.paused = true;
    state.speed = 1.0;
    state.tick = 0;
    state.generation = 0;
    state.lastTickTime = 0;
    state.deltaTime = 0;
    state.fps = 0;

    state.agents = [];
    state.viruses = [];
    state.dnaFragments = [];

    state.environment = null;

    state.currentSeason = 'spring';
    state.seasonProgress = 0;
    state.currentWeather = 'clear';
    state.weatherDuration = 0;
    state.yearCount = 0;

    state.cooperativeLinks = [];
    state.symbioticPairs = [];

    state.selectedEntity = null;
    state.selectedType = null;

    state.camera = {
        x: CONFIG.WORLD_WIDTH / 2,
        y: CONFIG.WORLD_HEIGHT / 2,
        zoom: 1.0
    };
    state.overlayMode = CONFIG.DEFAULT_OVERLAY;
    state.agentColorMode = CONFIG.DEFAULT_AGENT_COLOR_MODE;
    state.showEnergyBars = false;
    state.visualEvents = [];

    state.stats = {
        totalAgents: 0,
        speciesCount: 0,
        cooperatingCount: 0,
        symbioticCount: 0,
        infectedCount: 0,
        avgPlasmids: 0,
        avgFitness: 0,
        avgEnergy: 0,
        viralLoad: 0,
        dnaFragmentCount: 0,
        totalResources: 0
    };

    state.history = {
        population: [],
        speciesCount: [],
        avgFitness: [],
        events: []
    };

    state.activeEvents = [];
    state.eventQueue = [];

    state.speciesMap.clear();
    state.speciesColors.clear();

    state.hgtEvents = [];
    state.viralEvents = [];

    state.physicsTime = 0;
    state.renderTime = 0;
    state.systemsTime = 0;
}

/**
 * Update statistics from current state
 */
export function updateStats() {
    const agents = state.agents;

    state.stats.totalAgents = agents.length;

    // Count unique species
    const speciesSet = new Set(agents.map(a => a.genome.species_marker));
    state.stats.speciesCount = speciesSet.size;

    // Count social relationships
    state.stats.cooperatingCount = state.cooperativeLinks.length * 2;
    state.stats.symbioticCount = state.symbioticPairs.length * 2;

    // Count infected
    state.stats.infectedCount = agents.filter(a => a.infection).length;

    // Average plasmids, fitness, energy
    if (agents.length > 0) {
        const totalPlasmids = agents.reduce((sum, a) => sum + (a.genome.hgt?.plasmids?.length || 0), 0);
        state.stats.avgPlasmids = totalPlasmids / agents.length;

        const totalFitness = agents.reduce((sum, a) => sum + (a.fitness || 0), 0);
        state.stats.avgFitness = totalFitness / agents.length;

        const totalEnergy = agents.reduce((sum, a) => sum + (a.energy || 0), 0);
        state.stats.avgEnergy = totalEnergy / agents.length;
    } else {
        state.stats.avgPlasmids = 0;
        state.stats.avgFitness = 0;
        state.stats.avgEnergy = 0;
    }

    // Viral and DNA counts
    state.stats.viralLoad = state.viruses.length;
    state.stats.dnaFragmentCount = state.dnaFragments.length;

    // Total resources (calculated by environment system)
    // state.stats.totalResources updated externally
}

/**
 * Record a history point
 */
export function recordHistory() {
    const maxHistoryLength = 1000;

    state.history.population.push({
        tick: state.tick,
        count: state.stats.totalAgents
    });

    state.history.speciesCount.push({
        tick: state.tick,
        count: state.stats.speciesCount
    });

    state.history.avgFitness.push({
        tick: state.tick,
        value: state.stats.avgFitness
    });

    // Trim history if too long
    if (state.history.population.length > maxHistoryLength) {
        state.history.population.shift();
        state.history.speciesCount.shift();
        state.history.avgFitness.shift();
    }
}

/**
 * Log an event to history
 */
export function logEvent(type, data) {
    const event = {
        type,
        tick: state.tick,
        generation: state.generation,
        time: Date.now(),
        data
    };

    state.history.events.push(event);

    // Keep only recent events
    if (state.history.events.length > 100) {
        state.history.events.shift();
    }

    if (CONFIG.DEBUG_LOG_EVENTS) {
        console.log(`[Event] ${type}:`, data);
    }

    return event;
}

/**
 * Add an HGT event for visualization
 */
export function addHGTEvent(type, donor, recipient, payload) {
    state.hgtEvents.push({
        type,
        donor: donor?.id,
        recipient: recipient?.id,
        donorPos: donor ? { x: donor.position.x, y: donor.position.y } : null,
        recipientPos: { x: recipient.position.x, y: recipient.position.y },
        payload,
        tick: state.tick,
        age: 0
    });

    // Keep only recent events
    if (state.hgtEvents.length > 50) {
        state.hgtEvents.shift();
    }
}

/**
 * Add a viral event for visualization
 */
export function addViralEvent(type, virus, host) {
    state.viralEvents.push({
        type,
        virusId: virus?.id,
        hostId: host?.id,
        position: { x: host.position.x, y: host.position.y },
        tick: state.tick,
        age: 0
    });

    // Keep only recent events
    if (state.viralEvents.length > 50) {
        state.viralEvents.shift();
    }
}

/**
 * Serialize state for saving
 */
export function serializeState() {
    return JSON.stringify({
        tick: state.tick,
        generation: state.generation,
        agents: state.agents,
        viruses: state.viruses,
        dnaFragments: state.dnaFragments,
        environment: state.environment,
        cooperativeLinks: state.cooperativeLinks.map(link => ({
            agent_a_id: link.agent_a.id,
            agent_b_id: link.agent_b.id,
            strength: link.strength,
            age: link.age
        })),
        symbioticPairs: state.symbioticPairs.map(pair => ({
            host_id: pair.host.id,
            symbiont_id: pair.symbiont.id,
            age: pair.age
        })),
        history: state.history,
        camera: state.camera,
        overlayMode: state.overlayMode,
        agentColorMode: state.agentColorMode
    });
}

/**
 * Deserialize state from saved data
 */
export function deserializeState(json) {
    try {
        const data = JSON.parse(json);

        resetState();

        state.tick = data.tick || 0;
        state.generation = data.generation || 0;
        state.agents = data.agents || [];
        state.viruses = data.viruses || [];
        state.dnaFragments = data.dnaFragments || [];
        state.environment = data.environment;
        state.history = data.history || state.history;
        state.camera = data.camera || state.camera;
        state.overlayMode = data.overlayMode || state.overlayMode;
        state.agentColorMode = data.agentColorMode || state.agentColorMode;

        // Rebuild agent map for relationship linking
        const agentMap = new Map();
        state.agents.forEach(a => agentMap.set(a.id, a));

        // Rebuild cooperative links
        if (data.cooperativeLinks) {
            state.cooperativeLinks = data.cooperativeLinks
                .filter(link => agentMap.has(link.agent_a_id) && agentMap.has(link.agent_b_id))
                .map(link => ({
                    agent_a: agentMap.get(link.agent_a_id),
                    agent_b: agentMap.get(link.agent_b_id),
                    strength: link.strength,
                    age: link.age
                }));
        }

        // Rebuild symbiotic pairs
        if (data.symbioticPairs) {
            state.symbioticPairs = data.symbioticPairs
                .filter(pair => agentMap.has(pair.host_id) && agentMap.has(pair.symbiont_id))
                .map(pair => ({
                    host: agentMap.get(pair.host_id),
                    symbiont: agentMap.get(pair.symbiont_id),
                    age: pair.age
                }));
        }

        updateStats();

        return true;
    } catch (e) {
        console.error('Failed to deserialize state:', e);
        return false;
    }
}

/**
 * Get an agent by ID
 */
export function getAgentById(id) {
    return state.agents.find(a => a.id === id);
}

/**
 * Get a virus by ID
 */
export function getVirusById(id) {
    return state.viruses.find(v => v.id === id);
}

/**
 * Remove dead agents from the simulation
 */
export function removeDeadAgents() {
    // Filter out dead agents
    const deadAgents = state.agents.filter(a => !a.alive || a.energy <= CONFIG.DEATH_ENERGY_THRESHOLD);

    // Remove from cooperative links
    state.cooperativeLinks = state.cooperativeLinks.filter(link =>
        link.agent_a.alive && link.agent_b.alive
    );

    // Remove from symbiotic pairs
    state.symbioticPairs = state.symbioticPairs.filter(pair =>
        pair.host.alive && pair.symbiont.alive
    );

    // Update agents list
    state.agents = state.agents.filter(a => a.alive && a.energy > CONFIG.DEATH_ENERGY_THRESHOLD);

    return deadAgents;
}

/**
 * Remove expired viruses
 */
export function removeDeadViruses() {
    const before = state.viruses.length;
    state.viruses = state.viruses.filter(v => v.lifespan > 0);
    return before - state.viruses.length;
}

/**
 * Age visualization events (for fade-out effects)
 */
export function ageVisualEvents() {
    const maxAge = 60; // frames

    state.hgtEvents = state.hgtEvents.filter(e => {
        e.age++;
        return e.age < maxAge;
    });

    state.viralEvents = state.viralEvents.filter(e => {
        e.age++;
        return e.age < maxAge;
    });

    // Age visual event notifications
    state.visualEvents = state.visualEvents.filter(e => {
        e.age++;
        return e.age < (e.duration || maxAge);
    });
}

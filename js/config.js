/**
 * Configuration parameters for the Molecular Evolution Simulator
 * All tunable parameters are centralized here for easy adjustment
 */

export const CONFIG = {
    // === SIMULATION ===
    TARGET_POPULATION: 150,
    TICKS_PER_GENERATION: 1000,
    DT: 0.016,                          // Time step (60fps)

    // === ENVIRONMENT ===
    WORLD_WIDTH: 800,
    WORLD_HEIGHT: 600,
    CELL_SIZE: 20,

    TEMPERATURE_CYCLE_BASE: 0.5,
    TEMPERATURE_CYCLE_AMPLITUDE: 0.3,
    TEMPERATURE_CYCLE_PERIOD: 500,
    TEMPERATURE_CYCLE_NOISE: 0.05,

    // === SEASONS & WEATHER ===
    ENABLE_SEASONS: true,
    SEASON_LENGTH: 2000,                // Ticks per season
    SEASONS: {
        spring: { temp: 0.5, resources: 1.2, light: 1.0, storms: 0.3 },
        summer: { temp: 0.8, resources: 1.0, light: 1.3, storms: 0.1 },
        fall:   { temp: 0.5, resources: 0.8, light: 0.8, storms: 0.2 },
        winter: { temp: 0.2, resources: 0.4, light: 0.5, storms: 0.4 }
    },

    ENABLE_WEATHER: true,
    WEATHER_CHANGE_CHANCE: 0.002,       // Chance per tick to change weather
    WEATHER_TYPES: {
        clear:    { tempMod: 0, resourceMod: 1.0, duration: 300 },
        rain:     { tempMod: -0.1, resourceMod: 1.5, duration: 200 },
        drought:  { tempMod: 0.2, resourceMod: 0.3, duration: 400 },
        storm:    { tempMod: -0.2, resourceMod: 0.5, duration: 100, damage: 0.1 },
        heatwave: { tempMod: 0.3, resourceMod: 0.6, duration: 250 },
        bloom:    { tempMod: 0, resourceMod: 2.0, duration: 150 }
    },

    VISCOSITY_BASE: 0.3,
    VISCOSITY_DRIFT_RATE: 0.001,

    RESOURCE_CAPACITY: {
        chemical_A: 100,
        chemical_B: 100,
        light: 50,
        organic_matter: 200
    },
    RESOURCE_REGEN_RATE: {
        chemical_A: 0.5,
        chemical_B: 0.3,
        light: 1.0,
        organic_matter: 0.1
    },
    RESOURCE_MAX: 1.0,                  // Maximum resource level per cell
    RESOURCE_REGEN_BASE: 0.01,          // Base resource regeneration rate
    ORGANIC_DECAY_RATE: 0.005,          // Organic matter decay rate
    TOXIC_DECAY_RATE: 0.01,             // Toxic zone decay rate
    RESOURCE_SPOT_SPAWN_CHANCE: 0.001,  // Chance to spawn resource spot
    ENVIRONMENT_CELL_SIZE: 20,          // Size of environment grid cells

    // Energy conversion rates
    ENERGY_FROM_CHEMICAL: 10,
    ENERGY_FROM_LIGHT: 8,
    ENERGY_FROM_ORGANIC: 15,

    // Food particles
    FOOD_SPAWN_RATE: 0.02,              // Chance per tick to spawn food
    FOOD_MAX_COUNT: 200,                // Maximum food particles
    FOOD_ENERGY_VALUE: 30,              // Energy gained from eating food
    FOOD_RADIUS: 3,                     // Visual radius of food particles
    FOOD_CONSUMPTION_RANGE: 15,         // Distance to consume food

    CATASTROPHE_CHANCE: 0.0001,         // Per tick chance

    // === PREDATION & SCAVENGING ===
    CARNIVORY_ATTACK_RANGE: 20,         // Range for predation attacks
    CARNIVORY_ATTACK_COST: 5,           // Energy cost to attempt a kill
    CARNIVORY_SUCCESS_RATE_BASE: 0.3,   // Base success rate for kills
    CARNIVORY_ENERGY_EFFICIENCY: 0.10,  // Fraction of victim's energy gained (10% rule - realistic trophic efficiency)
    CARNIVORY_COOLDOWN: 30,             // Ticks between predation attempts
    PREDATION_HANDLING_TIME_PER_NODE: 10, // Handling time per prey node (Holling Type II)
    SCAVENGE_RANGE: 15,                 // Range for eating corpses
    SCAVENGE_RATE: 5,                   // Energy consumed from corpse per tick
    CORPSE_DECAY_RATE: 0.02,            // How fast corpses lose energy per tick
    CORPSE_MAX_AGE: 500,                // Ticks before corpse disappears
    CORPSE_BASE_ENERGY: 10,             // Base energy per node in corpse

    // === PHYSICS ===
    BASE_DRAG: 0.1,
    SURFACE_FRICTION: 0.3,
    MAX_SPEED: 10,
    COLLISION_RESPONSE: 0.5,
    COLLISION_RADIUS: 5,                // Base collision radius per node

    // === AGENTS ===
    INITIAL_AGENT_COUNT: 100,
    MIN_NODES: 3,
    MAX_NODES: 20,
    INITIAL_ENERGY: 100,
    BASE_METABOLISM_COST: 0.1,
    DEATH_ENERGY_THRESHOLD: 0,

    // Initial genome generation
    INITIAL_NODE_COUNT_MIN: 3,
    INITIAL_NODE_COUNT_MAX: 6,
    INITIAL_MOTOR_CHANCE: 0.3,
    INITIAL_SENSOR_CHANCE: 0.2,

    // === SENESCENCE (Aging) ===
    // Gompertz-Makeham mortality model: baseline + exponential age-dependent component
    SENESCENCE_AGE: 500,                // Age at which senescence begins
    BASELINE_MORTALITY: 0.0001,         // Constant background mortality rate per tick
    AGING_RATE: 0.0005,                 // Exponential aging rate after senescence age

    // === DENSITY-DEPENDENT EFFECTS ===
    // Population regulation without hard culling
    DENSITY_METABOLISM_THRESHOLD: 0.8,  // Density (as fraction of target) at which metabolism increases
    DENSITY_METABOLISM_MULTIPLIER: 2.0, // Max metabolism increase at high density
    DENSITY_REPRODUCTION_THRESHOLD: 0.7,// Density at which reproduction becomes harder
    DENSITY_REPRODUCTION_PENALTY: 50,   // Energy penalty to reproduction threshold at max density

    // === NICHE PARTITIONING ===
    // Character displacement and competitive exclusion
    NICHE_COMPETITION_STRENGTH: 0.5,    // Energy cost from competition (scaled by overlap)
    NICHE_SIZE_FACTOR: 10,              // Size difference that eliminates overlap

    // === EVOLUTION ===
    ELITISM_RATE: 0.1,
    SURVIVAL_RATE: 0.5,
    TOURNAMENT_SIZE: 5,
    SEXUAL_REPRODUCTION_RATE: 0.3,
    REPRODUCTION_ENERGY_THRESHOLD: 80,
    REPRODUCTION_ENERGY_COST: 30,

    // Mutation rates (reduced for mutation-selection balance)
    BASE_MUTATION_RATE: 0.05,           // Overall mutation rate multiplier (was 0.1)
    POINT_MUTATION_RATE: 0.03,          // Per-trait mutation rate (was 0.1)
    POINT_MUTATION_STRENGTH: 0.1,       // Max change per mutation
    ADD_NODE_RATE: 0.002,               // Structural mutations are rare (10x less than point mutations)
    REMOVE_NODE_RATE: 0.002,
    ADD_LINK_RATE: 0.005,               // Link changes slightly more common than node changes
    REMOVE_LINK_RATE: 0.005,
    ADD_MOTOR_RATE: 0.02,
    REMOVE_MOTOR_RATE: 0.02,
    ADD_SENSOR_RATE: 0.02,
    REMOVE_SENSOR_RATE: 0.02,
    DUPLICATION_RATE: 0.01,
    SOCIAL_MUTATION_RATE: 0.01,

    // Fitness weights
    FITNESS_WEIGHTS: {
        energy: 1.0,
        survival: 0.5,
        offspring: 2.0,
        distance: 0.3,
        hgt: 0.3,
        immunity: 0.2,
        cooperation: 0.3,
        symbiosis: 0.5
    },
    GENOME_SIZE_PENALTY: 0.01,

    // Reproduction
    REPRODUCTION_INTERVAL: 50,          // Ticks between reproduction checks
    CROSSOVER_MAX_DISTANCE: 0.5,        // Max genetic distance for crossover

    SPECIES_DISTANCE_THRESHOLD: 0.3,

    // === COOPERATION ===
    COOPERATION_RANGE: 30,
    MAX_COOPERATIVE_LINKS: 5,
    COOPERATION_SPEED_BONUS: 0.2,
    COOPERATIVE_HGT_BONUS: 0.1,
    KIN_RECOGNITION_THRESHOLD: 10,
    RESOURCE_SHARE_RATE: 0.5,
    COOPERATION_LINK_COST: 0.05,        // Energy cost per link per tick
    COOPERATION_DUNBAR_PENALTY: 0.1,    // Additional cost multiplier per extra link (Dunbar's number effect)

    // === COMPETITION ===
    COMPETITION_RANGE: 50,
    TERRITORIAL_RADIUS: 30,
    TERRITORIAL_FORCE: 2,
    COMBAT_RANGE: 15,
    COMBAT_DAMAGE: 5,
    FLEE_SPEED: 3,
    FLEE_FORCE: 5,
    CONFLICT_COST: 5,
    STANDOFF_PUSH: 2,
    STEAL_PERCENTAGE: 0.1,
    MAX_STEAL_AMOUNT: 10,

    // === SYMBIOSIS ===
    SYMBIOSIS_RANGE: 20,
    SYMBIOSIS_MAINTENANCE_COST: 0.5,

    // === HORIZONTAL GENE TRANSFER ===
    CONJUGATION_RANGE: 15,
    MIN_ENERGY_FOR_TRANSFER: 30,
    TRANSFORMATION_RATE: 0.05,
    TRANSFORMATION_RANGE: 20,
    DNA_DECAY_RATE: 0.01,
    FRAGMENT_COUNT: 5,
    PLASMID_LOSS_RATE: 0.05,
    MAX_PLASMIDS: 5,
    HGT_ENERGY_COST: 5,

    // === VIRAL ===
    INITIAL_VIRUS_COUNT: 10,
    VIRUS_SPAWN_RATE: 0.005,
    VIRUS_MAX_LIFESPAN: 150,              // Reduced from 500 - viruses decay faster outside hosts
    VIRUS_DIFFUSION_RATE: 2,
    VIRUS_HOST_ATTRACTION: 0.5,
    VIRUS_INFECTION_RANGE: 30,
    VIRUS_ATTACHMENT_RANGE: 5,
    VIRUS_MUTATION_RATE: 0.1,
    VIRUS_RENDER_SIZE: 4,
    LYTIC_ENERGY_DRAIN: 2,
    MAX_VIRUSES: 100,
    MAX_MOTORS: 5,
    MAX_SENSORS: 5,
    TRANSDUCTION_RATE: 0.01,
    LYSOGENIC_TRIGGER_RATE: 0.01,
    NOVEL_GENE_RATE: 0.1,

    // === IMMUNITY ===
    CRISPR_MEMORY_FORMATION_RATE: 0.3,
    CRISPR_MEMORY_SLOTS: 10,
    CRISPR_MEMORY_DECAY: 0.001,
    CRISPR_INHERITANCE_RATE: 0.5,

    // === RENDERING ===
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 800,
    SIMULATION_AREA_WIDTH: 800,
    UI_PANEL_WIDTH: 400,

    DEFAULT_OVERLAY: 'none',
    DEFAULT_AGENT_COLOR_MODE: 'species',

    // Node and link rendering
    NODE_BASE_RADIUS: 3,
    LINK_WIDTH: 2,
    MOTOR_HIGHLIGHT_WIDTH: 4,

    // Colors
    COLORS: {
        background: '#1a1a2e',
        grid: '#2a2a4e',
        ui_panel: '#252540',
        ui_text: '#ffffff',
        ui_accent: '#4a9eff',
        cooperative_link: '#00ff00',
        symbiotic_bond: '#ff00ff',
        viral_particle: '#ff4444',
        dna_fragment: '#ffff00',
        selection: '#ffffff'
    },

    // Resource colors for overlay
    RESOURCE_COLORS: {
        chemical_A: { r: 0, g: 150, b: 255 },
        chemical_B: { r: 255, g: 150, b: 0 },
        light: { r: 255, g: 255, b: 100 },
        organic_matter: { r: 100, g: 200, b: 100 }
    },

    // === CAMERA ===
    CAMERA_ZOOM_MIN: 0.25,
    CAMERA_ZOOM_MAX: 4,
    CAMERA_ZOOM_SPEED: 0.1,
    CAMERA_PAN_SPEED: 10,

    // === SPATIAL HASHING ===
    SPATIAL_CELL_SIZE: 50,

    // === WEB WORKER ===
    USE_PHYSICS_WORKER: true,
    WORKER_UPDATE_INTERVAL: 16,         // ms between worker updates

    // === FEATURE TOGGLES ===
    ENABLE_VIRUSES: true,
    ENABLE_HGT: true,
    ENABLE_COOPERATION: true,
    ENABLE_COMPETITION: true,
    ENABLE_SYMBIOSIS: true,
    ENABLE_IMMUNITY: true,
    ENABLE_CATASTROPHES: true,
    ENABLE_MUTATIONS: true,
    ENABLE_PREDATION: true,

    // === PERFORMANCE ===
    MAX_SPEED: 32,                      // Maximum speed multiplier
    TURBO_RENDER_INTERVAL: 10,          // Only render every N frames in turbo mode
    TURBO_GRAPH_INTERVAL: 300,          // Update graphs less frequently in turbo

    // === DEBUG ===
    DEBUG_DRAW_SPATIAL_GRID: false,
    DEBUG_DRAW_COLLISION_RADIUS: false,
    DEBUG_DRAW_SENSORS: false,
    DEBUG_LOG_EVENTS: false
};

// Sensor types available
export const SENSOR_TYPES = [
    'chemical',
    'thermal',
    'proximity',
    'kin',
    'signal',
    'viral',
    'prey'
];

// Food types available
export const FOOD_TYPES = [
    'chemical_A',
    'chemical_B',
    'light',
    'organic_matter',
    'living_agent',
    'dead_agent'
];

// Waste products
export const WASTE_TYPES = [
    'waste_A',
    'waste_B',
    'heat'
];

// Symbiotic benefit types
export const SYMBIOTIC_BENEFITS = [
    'energy',
    'protection',
    'mobility',
    'sensing',
    'digestion'
];

// Plasmid payload types
export const PLASMID_TYPES = [
    'motor',
    'sensor',
    'metabolism',
    'resistance',
    'social',
    'hgt_boost'
];

// Viral integration modes
export const VIRAL_MODES = [
    'lytic',
    'lysogenic',
    'episomal'
];

// Event types
export const EVENT_TYPES = [
    'temperature_spike',
    'temperature_crash',
    'resource_depletion',
    'toxic_bloom',
    'viral_outbreak'
];

/**
 * Deep clone the config for modification
 */
export function cloneConfig() {
    return JSON.parse(JSON.stringify(CONFIG));
}

/**
 * Merge custom config with defaults
 */
export function mergeConfig(custom) {
    const merged = cloneConfig();
    for (const key in custom) {
        if (typeof custom[key] === 'object' && !Array.isArray(custom[key])) {
            merged[key] = { ...merged[key], ...custom[key] };
        } else {
            merged[key] = custom[key];
        }
    }
    return merged;
}

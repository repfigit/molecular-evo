/**
 * Plasmid - Extra-chromosomal genetic element
 *
 * Plasmids can be transferred between agents via HGT
 * and provide various benefits/abilities.
 */

import { generateUUID } from '../utils/math.js';
import { CONFIG } from '../config.js';

/**
 * Plasmid types and their effects
 */
export const PLASMID_TYPES = {
    METABOLIC: 'metabolic',       // Improves metabolism
    RESISTANCE: 'resistance',     // Virus/toxin resistance
    CONJUGATIVE: 'conjugative',   // Can self-transfer
    MOTOR: 'motor',               // Movement enhancement
    SENSOR: 'sensor',             // Sensing enhancement
    SOCIAL: 'social',             // Social behavior modification
    CRISPR: 'crispr'              // Immunity system
};

/**
 * Create a new plasmid
 */
export function createPlasmid(options = {}) {
    const type = options.type || randomPlasmidType();

    return {
        id: generateUUID(),
        type,
        genes: options.genes || generatePlasmidGenes(type),
        origin: options.origin || 'spontaneous',
        generation: options.generation || 0,
        age: 0,
        transferCount: 0,
        fitness_contribution: calculatePlasmidFitness(type)
    };
}

/**
 * Get random plasmid type
 */
function randomPlasmidType() {
    const types = Object.values(PLASMID_TYPES);
    return types[Math.floor(Math.random() * types.length)];
}

/**
 * Generate genes for a plasmid based on type
 */
function generatePlasmidGenes(type) {
    const genes = [];

    switch (type) {
        case PLASMID_TYPES.METABOLIC:
            genes.push({
                name: 'efficiency_boost',
                value: 0.1 + Math.random() * 0.2
            });
            if (Math.random() < 0.3) {
                genes.push({
                    name: 'secondary_metabolism',
                    value: ['chemotroph', 'phototroph', 'heterotroph'][Math.floor(Math.random() * 3)]
                });
            }
            break;

        case PLASMID_TYPES.RESISTANCE:
            genes.push({
                name: 'viral_resistance',
                value: 0.2 + Math.random() * 0.3
            });
            genes.push({
                name: 'toxin_resistance',
                value: 0.1 + Math.random() * 0.2
            });
            break;

        case PLASMID_TYPES.CONJUGATIVE:
            genes.push({
                name: 'transfer_ability',
                value: 0.3 + Math.random() * 0.4
            });
            genes.push({
                name: 'pilus_formation',
                value: true
            });
            break;

        case PLASMID_TYPES.MOTOR:
            genes.push({
                name: 'motor_efficiency',
                value: 0.1 + Math.random() * 0.2
            });
            genes.push({
                name: 'speed_boost',
                value: 0.05 + Math.random() * 0.15
            });
            break;

        case PLASMID_TYPES.SENSOR:
            genes.push({
                name: 'sensor_range',
                value: 0.2 + Math.random() * 0.3
            });
            genes.push({
                name: 'sensor_type',
                value: ['chemical', 'thermal', 'kin', 'viral'][Math.floor(Math.random() * 4)]
            });
            break;

        case PLASMID_TYPES.SOCIAL:
            genes.push({
                name: 'cooperation_modifier',
                value: -0.2 + Math.random() * 0.4
            });
            genes.push({
                name: 'aggression_modifier',
                value: -0.2 + Math.random() * 0.4
            });
            break;

        case PLASMID_TYPES.CRISPR:
            genes.push({
                name: 'crispr_efficiency',
                value: 0.3 + Math.random() * 0.4
            });
            genes.push({
                name: 'memory_capacity',
                value: Math.floor(3 + Math.random() * 5)
            });
            break;
    }

    return genes;
}

/**
 * Calculate fitness contribution of plasmid
 */
function calculatePlasmidFitness(type) {
    const baseValues = {
        [PLASMID_TYPES.METABOLIC]: 0.15,
        [PLASMID_TYPES.RESISTANCE]: 0.2,
        [PLASMID_TYPES.CONJUGATIVE]: 0.05,
        [PLASMID_TYPES.MOTOR]: 0.1,
        [PLASMID_TYPES.SENSOR]: 0.1,
        [PLASMID_TYPES.SOCIAL]: 0.08,
        [PLASMID_TYPES.CRISPR]: 0.25
    };

    return baseValues[type] || 0.1;
}

/**
 * Clone a plasmid
 */
export function clonePlasmid(plasmid) {
    return {
        id: generateUUID(),
        type: plasmid.type,
        genes: JSON.parse(JSON.stringify(plasmid.genes)),
        origin: plasmid.id,
        generation: plasmid.generation + 1,
        age: 0,
        transferCount: 0,
        fitness_contribution: plasmid.fitness_contribution
    };
}

/**
 * Mutate a plasmid
 */
export function mutatePlasmid(plasmid) {
    for (const gene of plasmid.genes) {
        if (Math.random() < CONFIG.POINT_MUTATION_RATE) {
            if (typeof gene.value === 'number') {
                gene.value += (Math.random() - 0.5) * 0.1;
                gene.value = Math.max(0, Math.min(1, gene.value));
            }
        }
    }
}

/**
 * Apply plasmid effects to an agent
 */
export function applyPlasmidEffects(agent) {
    if (!agent.genome.hgt?.plasmids) return;

    for (const plasmid of agent.genome.hgt.plasmids) {
        for (const gene of plasmid.genes) {
            applyGeneEffect(agent, gene, plasmid.type);
        }
    }
}

/**
 * Apply a single gene effect
 */
function applyGeneEffect(agent, gene, plasmidType) {
    switch (gene.name) {
        case 'efficiency_boost':
            agent.metabolism_efficiency_bonus = (agent.metabolism_efficiency_bonus || 0) + gene.value;
            break;

        case 'viral_resistance':
            agent.viral_resistance = (agent.viral_resistance || 0) + gene.value;
            break;

        case 'toxin_resistance':
            agent.toxin_resistance = (agent.toxin_resistance || 0) + gene.value;
            break;

        case 'motor_efficiency':
            // Applied in physics system
            break;

        case 'speed_boost':
            agent.movement_bonus = (agent.movement_bonus || 1) + gene.value;
            break;

        case 'sensor_range':
            agent.sense_range_multiplier = (agent.sense_range_multiplier || 1) + gene.value;
            break;

        case 'cooperation_modifier':
            // Modifies behavior in cooperation system
            break;

        case 'crispr_efficiency':
            // Used by immunity system
            break;
    }
}

/**
 * Check if agent can accept a plasmid
 */
export function canAcceptPlasmid(agent, plasmid) {
    // Check max plasmid count
    const currentCount = agent.genome.hgt?.plasmids?.length || 0;
    if (currentCount >= CONFIG.MAX_PLASMIDS) return false;

    // Check for duplicate type (some exclusion)
    const hasType = agent.genome.hgt?.plasmids?.some(p => p.type === plasmid.type);
    if (hasType && Math.random() > 0.3) return false;

    // Check compatibility
    if (agent.genome.hgt.transfer_resistance > Math.random()) return false;

    return true;
}

/**
 * Get plasmid info for display
 */
export function getPlasmidInfo(plasmid) {
    return {
        id: plasmid.id.substring(0, 8),
        type: plasmid.type,
        generation: plasmid.generation,
        genes: plasmid.genes.map(g => `${g.name}: ${typeof g.value === 'number' ? g.value.toFixed(2) : g.value}`),
        fitness: plasmid.fitness_contribution.toFixed(2)
    };
}

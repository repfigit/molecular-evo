/**
 * Genetics Utilities
 *
 * Handles novel gene generation, gene functionality evaluation,
 * and genetic analysis tools.
 */

import { CONFIG } from '../config.js';
import { generateUUID } from './math.js';

/**
 * Gene types that can be generated
 */
export const GENE_TYPES = {
    STRUCTURAL: 'structural',     // Affects body structure
    METABOLIC: 'metabolic',       // Affects metabolism
    REGULATORY: 'regulatory',     // Affects other genes
    MOTOR: 'motor',               // Movement-related
    SENSORY: 'sensory',           // Sensing-related
    SOCIAL: 'social',             // Social behavior
    IMMUNITY: 'immunity',         // Immune function
    NOVEL: 'novel'                // Completely new function
};

/**
 * Generate a novel gene (from viral insertion, mutation, etc.)
 */
export function generateNovelGene(context = {}) {
    const type = context.type || randomGeneType();

    const gene = {
        id: generateUUID(),
        type,
        origin: context.origin || 'spontaneous',
        generation: 0,
        sequence: generateRandomSequence(20 + Math.floor(Math.random() * 30)),
        expression_level: 0.3 + Math.random() * 0.7,
        effects: generateGeneEffects(type),
        fitness_impact: 0, // Calculated later
        age: 0
    };

    // Calculate initial fitness impact
    gene.fitness_impact = evaluateGeneFitness(gene);

    return gene;
}

/**
 * Get random gene type
 */
function randomGeneType() {
    const types = Object.values(GENE_TYPES);
    return types[Math.floor(Math.random() * types.length)];
}

/**
 * Generate a random DNA-like sequence
 */
function generateRandomSequence(length) {
    const bases = ['A', 'T', 'G', 'C'];
    let sequence = '';
    for (let i = 0; i < length; i++) {
        sequence += bases[Math.floor(Math.random() * 4)];
    }
    return sequence;
}

/**
 * Generate effects for a gene based on type
 */
function generateGeneEffects(type) {
    const effects = [];

    switch (type) {
        case GENE_TYPES.STRUCTURAL:
            effects.push({
                target: 'node_mass',
                modifier: (Math.random() - 0.5) * 0.4
            });
            if (Math.random() < 0.3) {
                effects.push({
                    target: 'link_stiffness',
                    modifier: (Math.random() - 0.5) * 0.3
                });
            }
            break;

        case GENE_TYPES.METABOLIC:
            effects.push({
                target: 'metabolism_efficiency',
                modifier: (Math.random() - 0.3) * 0.3
            });
            if (Math.random() < 0.4) {
                effects.push({
                    target: 'energy_storage',
                    modifier: (Math.random() - 0.5) * 0.2
                });
            }
            break;

        case GENE_TYPES.REGULATORY:
            effects.push({
                target: 'gene_expression',
                modifier: (Math.random() - 0.5) * 0.5
            });
            effects.push({
                target: 'mutation_rate',
                modifier: (Math.random() - 0.5) * 0.1
            });
            break;

        case GENE_TYPES.MOTOR:
            effects.push({
                target: 'motor_speed',
                modifier: (Math.random() - 0.3) * 0.4
            });
            if (Math.random() < 0.3) {
                effects.push({
                    target: 'motor_efficiency',
                    modifier: (Math.random() - 0.5) * 0.2
                });
            }
            break;

        case GENE_TYPES.SENSORY:
            effects.push({
                target: 'sensor_range',
                modifier: (Math.random() - 0.3) * 0.4
            });
            if (Math.random() < 0.4) {
                effects.push({
                    target: 'sensor_sensitivity',
                    modifier: (Math.random() - 0.5) * 0.3
                });
            }
            break;

        case GENE_TYPES.SOCIAL:
            effects.push({
                target: 'cooperation',
                modifier: (Math.random() - 0.5) * 0.4
            });
            effects.push({
                target: 'aggression',
                modifier: (Math.random() - 0.5) * 0.3
            });
            break;

        case GENE_TYPES.IMMUNITY:
            effects.push({
                target: 'crispr_efficiency',
                modifier: (Math.random() - 0.2) * 0.3
            });
            if (Math.random() < 0.3) {
                effects.push({
                    target: 'viral_resistance',
                    modifier: (Math.random() - 0.3) * 0.4
                });
            }
            break;

        case GENE_TYPES.NOVEL:
            // Novel genes have random, potentially unusual effects
            const possibleTargets = [
                'metabolism_efficiency', 'motor_speed', 'sensor_range',
                'cooperation', 'crispr_efficiency', 'reproduction_rate',
                'lifespan', 'size', 'speed'
            ];
            const numEffects = 1 + Math.floor(Math.random() * 3);
            for (let i = 0; i < numEffects; i++) {
                const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
                effects.push({
                    target,
                    modifier: (Math.random() - 0.5) * 0.6 // Higher variance
                });
            }
            break;
    }

    return effects;
}

/**
 * Evaluate fitness impact of a gene
 */
export function evaluateGeneFitness(gene) {
    let fitness = 0;

    for (const effect of gene.effects) {
        // Positive effects generally increase fitness
        const impact = effect.modifier * gene.expression_level;

        switch (effect.target) {
            case 'metabolism_efficiency':
            case 'motor_speed':
            case 'sensor_range':
            case 'crispr_efficiency':
            case 'viral_resistance':
                fitness += impact * 0.5; // Beneficial
                break;

            case 'mutation_rate':
                fitness += impact * -0.2; // Usually slightly negative
                break;

            case 'aggression':
                fitness += impact * 0.1; // Context-dependent
                break;

            case 'cooperation':
                fitness += impact * 0.3;
                break;

            default:
                fitness += impact * 0.2;
        }
    }

    // Novel genes have higher variance
    if (gene.type === GENE_TYPES.NOVEL) {
        fitness *= 1.5;
    }

    return fitness;
}

/**
 * Apply gene effects to an agent
 */
export function applyGeneEffects(agent, gene) {
    for (const effect of gene.effects) {
        const value = effect.modifier * gene.expression_level;

        switch (effect.target) {
            case 'metabolism_efficiency':
                agent.genome.metabolism.efficiency = Math.max(0.1, Math.min(1,
                    agent.genome.metabolism.efficiency + value
                ));
                break;

            case 'motor_speed':
                for (const motor of agent.genome.motors) {
                    motor.cycle_speed = Math.max(0.1, motor.cycle_speed * (1 + value));
                }
                break;

            case 'sensor_range':
                for (const sensor of agent.genome.sensors) {
                    sensor.range = Math.max(10, sensor.range * (1 + value));
                }
                break;

            case 'cooperation':
                agent.genome.social.cooperation_willingness = Math.max(0, Math.min(1,
                    agent.genome.social.cooperation_willingness + value
                ));
                break;

            case 'aggression':
                agent.genome.social.aggression = Math.max(0, Math.min(1,
                    agent.genome.social.aggression + value
                ));
                break;

            case 'crispr_efficiency':
                if (agent.genome.crispr) {
                    agent.genome.crispr.efficiency = Math.max(0.1, Math.min(1,
                        agent.genome.crispr.efficiency + value
                    ));
                }
                break;

            case 'node_mass':
                for (const node of agent.genome.nodes) {
                    node.mass = Math.max(0.5, node.mass * (1 + value));
                }
                break;

            case 'energy_storage':
                agent.genome.metabolism.storage_capacity = Math.max(50,
                    agent.genome.metabolism.storage_capacity * (1 + value)
                );
                break;
        }
    }
}

/**
 * Mutate a gene
 */
export function mutateGene(gene) {
    const mutatedGene = JSON.parse(JSON.stringify(gene));
    mutatedGene.id = generateUUID();
    mutatedGene.generation++;

    // Mutate expression level
    if (Math.random() < 0.3) {
        mutatedGene.expression_level += (Math.random() - 0.5) * 0.2;
        mutatedGene.expression_level = Math.max(0.1, Math.min(1, mutatedGene.expression_level));
    }

    // Mutate effects
    for (const effect of mutatedGene.effects) {
        if (Math.random() < 0.2) {
            effect.modifier += (Math.random() - 0.5) * 0.1;
        }
    }

    // Point mutation in sequence
    if (Math.random() < 0.1) {
        const pos = Math.floor(Math.random() * mutatedGene.sequence.length);
        const bases = ['A', 'T', 'G', 'C'];
        mutatedGene.sequence = mutatedGene.sequence.substring(0, pos) +
            bases[Math.floor(Math.random() * 4)] +
            mutatedGene.sequence.substring(pos + 1);
    }

    // Recalculate fitness
    mutatedGene.fitness_impact = evaluateGeneFitness(mutatedGene);

    return mutatedGene;
}

/**
 * Generate gene from viral insertion
 */
export function generateViralInsertionGene(virusGenome) {
    const gene = generateNovelGene({
        type: GENE_TYPES.NOVEL,
        origin: 'viral_insertion'
    });

    // Viral genes tend to have specific characteristics
    gene.effects.push({
        target: 'viral_resistance',
        modifier: -0.1 // Slight vulnerability to related viruses
    });

    if (Math.random() < CONFIG.NOVEL_GENE_RATE) {
        // Chance of beneficial novel function
        gene.effects.push({
            target: ['metabolism_efficiency', 'motor_speed', 'sensor_range'][Math.floor(Math.random() * 3)],
            modifier: Math.random() * 0.3
        });
    }

    return gene;
}

/**
 * Calculate genetic complexity of an agent
 */
export function calculateGeneticComplexity(agent) {
    let complexity = 0;

    // Base complexity from structure
    complexity += agent.genome.nodes.length * 2;
    complexity += agent.genome.links.length * 1.5;
    complexity += agent.genome.motors.length * 3;
    complexity += agent.genome.sensors.length * 3;

    // Complexity from plasmids
    const plasmidCount = agent.genome.hgt?.plasmids?.length || 0;
    complexity += plasmidCount * 5;

    // Complexity from CRISPR memory
    const memoryCount = agent.genome.crispr?.memory?.length || 0;
    complexity += memoryCount * 2;

    // Complexity from novel genes
    const novelGenes = agent.genome.novel_genes?.length || 0;
    complexity += novelGenes * 4;

    return complexity;
}

/**
 * Compare two genomes and return similarity score
 */
export function compareGenomes(genome1, genome2) {
    let similarity = 0;
    let comparisons = 0;

    // Compare basic properties
    similarity += 1 - Math.abs(genome1.metabolism.efficiency - genome2.metabolism.efficiency);
    comparisons++;

    similarity += 1 - Math.abs(genome1.social.cooperation_willingness - genome2.social.cooperation_willingness);
    comparisons++;

    similarity += 1 - Math.abs(genome1.social.aggression - genome2.social.aggression);
    comparisons++;

    // Compare structure similarity
    const nodeDiff = Math.abs(genome1.nodes.length - genome2.nodes.length);
    similarity += Math.max(0, 1 - nodeDiff / 10);
    comparisons++;

    const motorDiff = Math.abs(genome1.motors.length - genome2.motors.length);
    similarity += Math.max(0, 1 - motorDiff / 5);
    comparisons++;

    return similarity / comparisons;
}

/**
 * Get genome statistics
 */
export function getGenomeStats(genome) {
    return {
        nodes: genome.nodes.length,
        links: genome.links.length,
        motors: genome.motors.length,
        sensors: genome.sensors.length,
        plasmids: genome.hgt?.plasmids?.length || 0,
        crisprMemory: genome.crispr?.memory?.length || 0,
        novelGenes: genome.novel_genes?.length || 0,
        metabolismEfficiency: genome.metabolism.efficiency,
        cooperation: genome.social.cooperation_willingness,
        aggression: genome.social.aggression,
        generation: genome.generation
    };
}

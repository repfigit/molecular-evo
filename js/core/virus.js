/**
 * Virus - Obligate parasitic genetic element
 *
 * Viruses infect agents, replicate, and can transfer genes
 * through transduction.
 */

import { generateUUID, vec } from '../utils/math.js';
import { CONFIG } from '../config.js';

/**
 * Virus lifecycle stages
 */
export const VIRUS_STAGES = {
    FREE: 'free',           // Free in environment
    ATTACHED: 'attached',   // Attached to host
    INJECTED: 'injected',   // DNA injected
    LYTIC: 'lytic',         // Active replication
    LYSOGENIC: 'lysogenic', // Dormant in host genome
    BURST: 'burst'          // Released new virions
};

/**
 * Create a new virus
 */
export function createVirus(options = {}) {
    return {
        id: generateUUID(),
        position: options.position ? vec(options.position.x, options.position.y) : vec(0, 0),
        velocity: vec(
            (Math.random() - 0.5) * CONFIG.VIRUS_DIFFUSION_RATE,
            (Math.random() - 0.5) * CONFIG.VIRUS_DIFFUSION_RATE
        ),

        // Viral genome
        genome: options.genome || generateViralGenome(),

        // State
        stage: VIRUS_STAGES.FREE,
        lifespan: options.lifespan || CONFIG.VIRUS_MAX_LIFESPAN,
        age: 0,

        // Host interaction
        host_id: null,
        injection_progress: 0,
        replication_progress: 0,

        // Cargo (for transduction)
        cargo: options.cargo || null,

        // Fitness
        infection_count: 0,
        offspring_count: 0
    };
}

/**
 * Generate viral genome
 */
function generateViralGenome() {
    return {
        id: generateUUID(),

        // Infection properties
        host_specificity: Math.random() * 0.5 + 0.3, // How specific to certain hosts
        injection_speed: Math.random() * 0.5 + 0.3,
        replication_rate: Math.random() * 0.5 + 0.3,

        // Lifecycle preferences
        lytic_preference: Math.random(), // vs lysogenic
        burst_size: Math.floor(5 + Math.random() * 15),

        // Evasion
        crispr_evasion: Math.random() * 0.3, // Ability to evade CRISPR

        // Markers for host recognition
        surface_markers: [
            Math.random().toString(36).substring(7),
            Math.random().toString(36).substring(7)
        ],

        // For transduction
        packaging_error_rate: 0.01 + Math.random() * 0.09 // Chance to package host DNA
    };
}

/**
 * Clone a virus
 */
export function cloneVirus(virus, mutations = true) {
    const clone = {
        id: generateUUID(),
        position: vec(virus.position.x, virus.position.y),
        velocity: vec(
            (Math.random() - 0.5) * CONFIG.VIRUS_DIFFUSION_RATE,
            (Math.random() - 0.5) * CONFIG.VIRUS_DIFFUSION_RATE
        ),
        genome: JSON.parse(JSON.stringify(virus.genome)),
        stage: VIRUS_STAGES.FREE,
        lifespan: CONFIG.VIRUS_MAX_LIFESPAN,
        age: 0,
        host_id: null,
        injection_progress: 0,
        replication_progress: 0,
        cargo: null,
        infection_count: 0,
        offspring_count: 0
    };

    // Apply mutations
    if (mutations && Math.random() < CONFIG.VIRUS_MUTATION_RATE) {
        mutateViralGenome(clone.genome);
    }

    clone.genome.id = generateUUID();
    return clone;
}

/**
 * Mutate viral genome with improved coevolution
 */
function mutateViralGenome(genome) {
    const mutations = [
        () => genome.injection_speed += (Math.random() - 0.5) * 0.1,
        () => genome.replication_rate += (Math.random() - 0.5) * 0.1,
        () => genome.lytic_preference += (Math.random() - 0.5) * 0.1,
        () => genome.burst_size += Math.floor((Math.random() - 0.5) * 4),
        () => genome.crispr_evasion += (Math.random() - 0.5) * 0.1,
        () => genome.host_specificity += (Math.random() - 0.5) * 0.1
    ];

    // Apply 1-3 random mutations
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
        const mutation = mutations[Math.floor(Math.random() * mutations.length)];
        mutation();
    }

    // COEVOLUTION: Viruses evolve in response to host population
    // If there are many immune hosts, increase CRISPR evasion
    if (state.agents) {
        const totalAgents = state.agents.filter(a => a.alive).length;
        if (totalAgents > 0) {
            const immuneAgents = state.agents.filter(a => 
                a.alive && a.genome.viral?.crispr_memory?.length > 0
            ).length;
            const immuneRatio = immuneAgents / totalAgents;
            
            // If > 30% of population is immune, viruses evolve better evasion
            if (immuneRatio > 0.3) {
                genome.crispr_evasion += 0.05;  // Gradual increase
            }
            
            // If < 10% immune, evasion can drift downward (no selection pressure)
            if (immuneRatio < 0.1 && Math.random() < 0.3) {
                genome.crispr_evasion -= 0.02;
            }
        }
    }

    // TRADE-OFF: High burst size reduces replication rate
    // This creates evolutionary trade-offs
    if (genome.burst_size > 20) {
        genome.replication_rate *= 0.95;  // Slower replication for high burst
    }

    // Clamp values
    genome.injection_speed = Math.max(0.1, Math.min(1, genome.injection_speed));
    genome.replication_rate = Math.max(0.1, Math.min(1, genome.replication_rate));
    genome.lytic_preference = Math.max(0, Math.min(1, genome.lytic_preference));
    genome.burst_size = Math.max(2, Math.min(30, genome.burst_size));
    genome.crispr_evasion = Math.max(0, Math.min(0.5, genome.crispr_evasion));
    genome.host_specificity = Math.max(0.1, Math.min(0.9, genome.host_specificity));
}

/**
 * Check if virus can infect a host
 */
export function canInfect(virus, host) {
    // Host must be alive
    if (!host.alive) return false;

    // Check if already infected by this type
    if (host.infection && host.infection.virus_genome_id === virus.genome.id) {
        return false;
    }

    // Check host susceptibility
    const susceptibility = host.genome.viral?.susceptibility || 0.5;
    if (Math.random() > susceptibility) return false;

    // Check host specificity
    const specificityMatch = calculateSpecificityMatch(virus, host);
    if (specificityMatch < virus.genome.host_specificity) return false;

    // Check resistance from plasmids
    const resistance = host.plasmid_resistance_bonus || 0;
    if (Math.random() < resistance) return false;

    return true;
}

/**
 * Calculate how well virus matches host
 */
function calculateSpecificityMatch(virus, host) {
    // Based on species marker similarity and viral markers
    let match = 0.5;

    // Some hosts more susceptible based on traits
    if (host.genome.viral?.receptor_types) {
        for (const marker of virus.genome.surface_markers) {
            if (host.genome.viral.receptor_types.includes(marker)) {
                match += 0.2;
            }
        }
    }

    return Math.min(1, match);
}

/**
 * Create a transducing particle (virus carrying host DNA)
 */
export function createTransducingParticle(virus, hostGenes) {
    const particle = cloneVirus(virus, false);

    particle.cargo = {
        type: 'transduction',
        genes: hostGenes,
        source_species: hostGenes.source_species
    };

    // Transducing particles often can't replicate
    particle.genome.replication_rate *= 0.1;

    return particle;
}

/**
 * Get virus info for display
 */
export function getVirusInfo(virus) {
    return {
        id: virus.id.substring(0, 8),
        stage: virus.stage,
        age: virus.age,
        lifespan: virus.lifespan,
        hasCargoL: virus.cargo !== null,
        burstSize: virus.genome.burst_size,
        lyticPreference: (virus.genome.lytic_preference * 100).toFixed(0) + '%'
    };
}

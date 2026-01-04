/**
 * Genome System - Encodes all heritable traits of an organism
 *
 * The genome defines body structure (nodes, links, motors, sensors),
 * metabolism, social behaviors, HGT capabilities, and viral susceptibility.
 */

import { CONFIG, SENSOR_TYPES, FOOD_TYPES, WASTE_TYPES, SYMBIOTIC_BENEFITS } from '../config.js';
import {
    generateUUID,
    randomRange,
    randomInt,
    randomBool,
    randomChoice,
    clamp
} from '../utils/math.js';

/**
 * Create a new genome with default/random values
 */
export function createGenome(options = {}) {
    const id = options.id || generateUUID();
    const speciesMarker = options.species_marker ?? randomInt(0, 1000000);

    const genome = {
        // === IDENTITY ===
        id,
        species_marker: speciesMarker,
        generation: options.generation || 0,

        // === BODY STRUCTURE ===
        nodes: options.nodes || [],
        links: options.links || [],
        motors: options.motors || [],
        sensors: options.sensors || [],

        // === METABOLISM ===
        metabolism: options.metabolism || createDefaultMetabolism(),

        // === SOCIAL BEHAVIORS ===
        social: options.social || createDefaultSocial(),

        // === HORIZONTAL GENE TRANSFER ===
        hgt: options.hgt || createDefaultHGT(),

        // === VIRAL SUSCEPTIBILITY ===
        viral: options.viral || createDefaultViral(),

        // === GENE REGULATORY NETWORK ===
        grn: options.grn || createDefaultGRN(),

        // === NEUTRAL MARKERS (for molecular clock and population genetics) ===
        neutral_markers: options.neutral_markers || createDefaultNeutralMarkers(),

        // === BET-HEDGING STRATEGY ===
        bet_hedging: options.bet_hedging || createDefaultBetHedging(),

        // === GENETIC LOAD (Mutation-Selection Balance) ===
        genetic_load: options.genetic_load || createDefaultGeneticLoad(),

        // === DEVELOPMENTAL CANALIZATION ===
        canalization: options.canalization || createDefaultCanalization(),

        // === SELFISH GENETIC ELEMENTS ===
        selfish_elements: options.selfish_elements || createDefaultSelfishElements(),

        // === LINKAGE MAP (Recombination Hotspots) ===
        linkage_map: options.linkage_map || createDefaultLinkageMap(),

        // === MUTAGENESIS (Evolvable Mutation Rates) ===
        mutagenesis: options.mutagenesis || createDefaultMutagenesis(),

        // === ANTAGONISTIC PLEIOTROPY (Life History Trade-offs) ===
        pleiotropy: options.pleiotropy || createDefaultPleiotropy()
    };

    return genome;
}

/**
 * Create default metabolism settings
 */
export function createDefaultMetabolism() {
    return {
        primary_food: randomChoice(FOOD_TYPES),
        secondary_food: randomBool(0.3) ? randomChoice(FOOD_TYPES) : null,
        efficiency: randomRange(0.3, 0.7),
        storage_capacity: randomRange(80, 200),
        base_metabolism: randomRange(0.05, 0.15),
        waste_product: randomChoice(WASTE_TYPES),
        // Carnivory and scavenging traits
        carnivory: randomRange(0, 0.3),           // Ability to hunt living prey (0-1)
        scavenging: randomRange(0, 0.3),          // Ability to eat corpses (0-1)
        decomposer: randomRange(0, 0.2),          // Ability to decompose dead matter (0-1)
        prey_preference: randomChoice(['any', 'smaller', 'weaker', 'other_species']),
        // Reproductive strategy (evolvable per Red Queen hypothesis)
        sexual_tendency: randomRange(0.1, 0.5),   // Probability of sexual vs asexual reproduction

        // LIFE HISTORY TRAITS (r/K selection axis)
        // r-strategists: high offspring_investment low, clutch_size high, maturation_age low
        // K-strategists: offspring_investment high, clutch_size low, maturation_age high
        life_history: {
            offspring_investment: randomRange(0.2, 0.6),  // Energy fraction per offspring (0.2=r, 0.6=K)
            clutch_size: randomInt(1, 4),                  // Number of offspring per reproduction event
            maturation_age: randomInt(50, 200),            // Age before can reproduce
            reproductive_effort: randomRange(0.3, 0.8)     // Fraction of surplus energy to reproduction vs growth
        },

        // PHENOTYPIC PLASTICITY traits
        // Trade-off: Plastic organisms can adapt but pay metabolic cost
        plasticity: {
            plasticity_range: randomRange(0.1, 0.5),      // How much can phenotype shift (0=fixed, 1=highly plastic)
            acclimation_rate: randomRange(0.001, 0.01),   // How fast can acclimate
            plasticity_cost: randomRange(0.01, 0.05)      // Metabolic cost of maintaining plasticity machinery
        }
    };
}

/**
 * Create default social behavior settings
 */
export function createDefaultSocial() {
    return {
        // Top-level cooperation traits (used by cooperation.js)
        cooperation_willingness: randomRange(0.2, 0.8),  // Willingness to cooperate
        kin_recognition: randomRange(0.3, 0.8),          // Ability to recognize kin
        punishment_willingness: randomRange(0.1, 0.5),   // Willingness to punish cheaters (costly)

        // Cooperation (same species)
        cooperation: {
            link_willingness: randomRange(0.2, 0.8),
            link_strength: randomRange(20, 60),
            resource_sharing: randomRange(0.1, 0.5),
            signal_response: randomRange(0.1, 0.6)
        },

        // Competition
        competition: {
            aggression: randomRange(0.1, 0.6),
            territorial_radius: randomBool(0.3) ? randomRange(20, 60) : 0,
            flee_threshold: randomRange(0.3, 0.7),
            resource_greed: randomRange(0.2, 0.8)
        },

        // Symbiosis (different species)
        symbiosis: {
            markers: [],  // Species markers willing to bond with
            offer: randomChoice(SYMBIOTIC_BENEFITS),
            need: randomChoice(SYMBIOTIC_BENEFITS),
            attachment_strength: randomRange(0.3, 0.8)
        },

        // Communication
        communication: {
            signal_emission: randomRange(0.1, 0.5),
            signal_type: randomInt(0, 10),
            signal_frequency: randomRange(0.1, 1.0)
        },

        // Mate recognition (reproductive isolation - pre-zygotic barrier)
        // Enhanced with honest signaling (Zahavian handicap principle)
        mating: {
            mate_signal: randomInt(0, 100),              // Visual/chemical signal for mate recognition
            mate_preference: randomInt(0, 100),          // What signal is preferred in mates
            mate_choosiness: randomRange(0.1, 0.5),      // How strict mate choice is (0=any, 1=exact match only)
            courtship_display: randomRange(0.1, 0.8),    // Intensity of courtship display
            signal_honesty: randomRange(0.5, 1.0),       // How tied to fitness signal is (handicap principle)
            display_cost_multiplier: randomRange(0.5, 1.5) // Energy cost of signaling (honest handicap)
        },

        // BEHAVIORAL LEARNING traits
        // Capacity for associative learning and spatial memory
        // Trade-off: Better memory/learning = higher metabolic cost
        learning: {
            memory_capacity: randomRange(0.1, 0.8),      // Size of spatial memory grid (0=poor, 1=excellent)
            learning_rate: randomRange(0.01, 0.1),       // How fast experiences change behavior
            memory_decay: randomRange(0.001, 0.01),      // How fast memories fade
            exploration_drive: randomRange(0.2, 0.7),    // Innate tendency to explore vs exploit
            learning_cost: randomRange(0.01, 0.05)       // Metabolic cost of maintaining neural machinery
        }
    };
}

/**
 * Create default HGT settings
 */
export function createDefaultHGT() {
    return {
        donor_willingness: randomRange(0.1, 0.5),
        recipient_openness: randomRange(0.2, 0.6),
        transfer_type: randomChoice(['conjugation', 'transformation', 'both']),
        plasmids: [],
        restriction_markers: [],
        dna_release_on_death: randomBool(0.7)
    };
}

/**
 * Create default viral susceptibility settings
 */
export function createDefaultViral() {
    // Random receptors (which viral strains can attach)
    const receptorCount = randomInt(1, 4);
    const receptors = [];
    for (let i = 0; i < receptorCount; i++) {
        receptors.push(randomInt(0, 100));
    }

    return {
        receptors,
        resistance: randomRange(0.1, 0.5),
        crispr_memory: []
    };
}

/**
 * Create default neutral markers for molecular clock and population genetics
 * These markers are selectively neutral and accumulate mutations at constant rate
 */
export function createDefaultNeutralMarkers() {
    return {
        // Microsatellite-like markers (high mutation rate, neutral)
        // Used for population structure and recent divergence
        microsatellites: Array.from({ length: 8 }, () => randomInt(0, 100)),

        // SNP-like markers (low mutation rate, mostly neutral)
        // Used for deeper phylogenetic analysis
        snps: Array.from({ length: 16 }, () => randomBool(0.5) ? 1 : 0),

        // Accumulated neutral mutations (molecular clock proxy)
        neutral_mutation_count: 0,

        // Birth tick for molecular clock
        birth_tick: 0
    };
}

/**
 * Mutate neutral markers
 * Called during reproduction - these accumulate regardless of selection
 */
export function mutateNeutralMarkers(genome, currentTick = 0) {
    if (!genome.neutral_markers) {
        genome.neutral_markers = createDefaultNeutralMarkers();
        genome.neutral_markers.birth_tick = currentTick;
        return;
    }

    const markers = genome.neutral_markers;

    // Microsatellites mutate frequently (stepwise mutation model)
    for (let i = 0; i < markers.microsatellites.length; i++) {
        if (randomBool(0.02)) {  // 2% per marker per generation
            // Stepwise: +1 or -1
            markers.microsatellites[i] += randomBool(0.5) ? 1 : -1;
            markers.microsatellites[i] = clamp(markers.microsatellites[i], 0, 200);
        }
    }

    // SNPs mutate rarely (infinite sites approximation)
    for (let i = 0; i < markers.snps.length; i++) {
        if (randomBool(0.002)) {  // 0.2% per marker per generation
            markers.snps[i] = markers.snps[i] === 0 ? 1 : 0;
            markers.neutral_mutation_count++;
        }
    }

    markers.birth_tick = currentTick;
}

/**
 * Calculate neutral genetic distance between two genomes
 * Used for phylogenetic analysis (independent of selected traits)
 */
export function neutralGeneticDistance(genomeA, genomeB) {
    if (!genomeA.neutral_markers || !genomeB.neutral_markers) return 0;

    const markersA = genomeA.neutral_markers;
    const markersB = genomeB.neutral_markers;

    // Microsatellite distance (sum of absolute differences)
    let microDist = 0;
    for (let i = 0; i < markersA.microsatellites.length; i++) {
        microDist += Math.abs(markersA.microsatellites[i] - markersB.microsatellites[i]);
    }
    microDist /= (markersA.microsatellites.length * 50);  // Normalize

    // SNP distance (Hamming distance)
    let snpDist = 0;
    for (let i = 0; i < markersA.snps.length; i++) {
        if (markersA.snps[i] !== markersB.snps[i]) snpDist++;
    }
    snpDist /= markersA.snps.length;

    return (microDist + snpDist) / 2;
}

/**
 * Create default bet-hedging traits
 * Allows organisms to hedge against environmental unpredictability
 */
export function createDefaultBetHedging() {
    return {
        // Diversified bet-hedging: variance in offspring phenotypes
        offspring_variance: randomRange(0.0, 0.2),

        // Dormancy tendency: probability of entering dormant state under stress
        dormancy_tendency: randomRange(0.0, 0.15),

        // Dormancy threshold: energy level that triggers dormancy consideration
        dormancy_threshold: randomRange(0.1, 0.3),

        // Dormancy duration: how long dormancy typically lasts
        dormancy_duration: randomInt(50, 200)
    };
}

/**
 * Create default mutagenesis settings
 * Mutation rates are evolvable traits subject to selection
 * Stress-induced mutagenesis (SIM) increases mutation under harsh conditions
 */
export function createDefaultMutagenesis() {
    return {
        // Base mutation rate modifier (1.0 = use CONFIG values)
        // Can evolve to be higher (mutator) or lower (anti-mutator)
        base_mutation_modifier: randomRange(0.8, 1.2),

        // Stress-induced mutagenesis (SIM) - like bacterial SOS response
        // How much stress elevates mutation rate
        stress_induced_rate: randomRange(0.1, 0.4),

        // Stress threshold that triggers hypermutation
        hypermutator_threshold: randomRange(0.4, 0.7),

        // DNA repair efficiency (higher = fewer mutations but costs energy)
        repair_efficiency: randomRange(0.6, 0.9),

        // Energy cost of maintaining DNA repair (per tick, scaled by repair_efficiency)
        repair_energy_cost: 0.01,

        // Mutator phenotype flag - some lineages become hypermutators
        is_mutator: false,

        // Generation when mutator phenotype was acquired
        mutator_since: null
    };
}

/**
 * Calculate effective mutation rate based on mutagenesis traits and stress
 */
export function getEffectiveMutationRate(genome, baseRate, stressLevel = 0) {
    const mutagenesis = genome.mutagenesis;
    if (!mutagenesis) return baseRate;

    let effectiveRate = baseRate * mutagenesis.base_mutation_modifier;

    // Stress-induced mutagenesis (SIM)
    if (stressLevel > mutagenesis.hypermutator_threshold) {
        const stressExcess = stressLevel - mutagenesis.hypermutator_threshold;
        const simMultiplier = 1 + stressExcess * mutagenesis.stress_induced_rate * 3;
        effectiveRate *= simMultiplier;
    }

    // DNA repair reduces mutations (but costs energy)
    effectiveRate *= (1 - mutagenesis.repair_efficiency * 0.5);

    // Mutator phenotype doubles mutation rate
    if (mutagenesis.is_mutator) {
        effectiveRate *= 2;
    }

    return effectiveRate;
}

/**
 * Mutate the mutagenesis traits themselves
 * Mutation rates can evolve!
 */
export function mutateMutagenesis(mutagenesis) {
    if (!mutagenesis) return createDefaultMutagenesis();

    // Base mutation modifier can drift
    if (randomBool(0.02)) {
        mutagenesis.base_mutation_modifier = clamp(
            mutagenesis.base_mutation_modifier + randomRange(-0.1, 0.1),
            0.3, 3.0
        );
    }

    // Stress-induced rate can evolve
    if (randomBool(0.02)) {
        mutagenesis.stress_induced_rate = clamp(
            mutagenesis.stress_induced_rate + randomRange(-0.05, 0.05),
            0, 1.0
        );
    }

    // Hypermutator threshold can shift
    if (randomBool(0.02)) {
        mutagenesis.hypermutator_threshold = clamp(
            mutagenesis.hypermutator_threshold + randomRange(-0.1, 0.1),
            0.1, 0.9
        );
    }

    // Repair efficiency (costly to maintain)
    if (randomBool(0.02)) {
        mutagenesis.repair_efficiency = clamp(
            mutagenesis.repair_efficiency + randomRange(-0.05, 0.05),
            0.1, 0.99
        );
    }

    // Rare mutator phenotype acquisition
    if (!mutagenesis.is_mutator && randomBool(0.001)) {
        mutagenesis.is_mutator = true;
        mutagenesis.mutator_since = 0;  // Will be set to generation
    }

    // Mutator phenotypes can revert
    if (mutagenesis.is_mutator && randomBool(0.01)) {
        mutagenesis.is_mutator = false;
        mutagenesis.mutator_since = null;
    }

    return mutagenesis;
}

/**
 * Blend mutagenesis traits during crossover
 */
export function blendMutagenesis(mutagA, mutagB) {
    if (!mutagA) return mutagB || createDefaultMutagenesis();
    if (!mutagB) return mutagA;

    return {
        base_mutation_modifier: (mutagA.base_mutation_modifier + mutagB.base_mutation_modifier) / 2,
        stress_induced_rate: (mutagA.stress_induced_rate + mutagB.stress_induced_rate) / 2,
        hypermutator_threshold: (mutagA.hypermutator_threshold + mutagB.hypermutator_threshold) / 2,
        repair_efficiency: (mutagA.repair_efficiency + mutagB.repair_efficiency) / 2,
        repair_energy_cost: 0.01,
        // Mutator phenotype: only inherit if both parents are mutators (recessive restoration)
        is_mutator: mutagA.is_mutator && mutagB.is_mutator,
        mutator_since: (mutagA.is_mutator && mutagB.is_mutator) ? 0 : null
    };
}

/**
 * Get energy cost of DNA repair
 */
export function getDNARepairCost(genome, dt) {
    const mutagenesis = genome.mutagenesis;
    if (!mutagenesis) return 0;

    // Higher repair efficiency = higher maintenance cost
    return mutagenesis.repair_efficiency * mutagenesis.repair_energy_cost * dt;
}

/**
 * Blend pleiotropy traits from two parents
 * Trade-off intensities are inherited as averages
 */
export function blendPleiotropy(pleiotropyA, pleiotropyB) {
    if (!pleiotropyA) return pleiotropyB || createDefaultPleiotropy();
    if (!pleiotropyB) return pleiotropyA;

    return {
        // Vigor-longevity trade-off
        vigor: (pleiotropyA.vigor + pleiotropyB.vigor) / 2,
        vigor_aging_cost: (pleiotropyA.vigor_aging_cost + pleiotropyB.vigor_aging_cost) / 2,

        // Reproduction-survival trade-off
        reproductive_investment: (pleiotropyA.reproductive_investment + pleiotropyB.reproductive_investment) / 2,
        soma_neglect: (pleiotropyA.soma_neglect + pleiotropyB.soma_neglect) / 2,

        // Growth-reproduction trade-off
        growth_rate: (pleiotropyA.growth_rate + pleiotropyB.growth_rate) / 2,
        growth_reproduction_cost: (pleiotropyA.growth_reproduction_cost + pleiotropyB.growth_reproduction_cost) / 2,

        // Immune-metabolism trade-off
        immune_investment: (pleiotropyA.immune_investment + pleiotropyB.immune_investment) / 2,
        immune_metabolic_cost: (pleiotropyA.immune_metabolic_cost + pleiotropyB.immune_metabolic_cost) / 2,

        // Display-survival trade-off
        display_intensity: (pleiotropyA.display_intensity + pleiotropyB.display_intensity) / 2,
        display_predation_cost: (pleiotropyA.display_predation_cost + pleiotropyB.display_predation_cost) / 2,

        // Early-late life trade-off
        early_vigor_bonus: (pleiotropyA.early_vigor_bonus + pleiotropyB.early_vigor_bonus) / 2,
        late_life_penalty: (pleiotropyA.late_life_penalty + pleiotropyB.late_life_penalty) / 2,

        // Trade-off onset age (average with slight variation)
        trade_off_onset_age: Math.round(
            (pleiotropyA.trade_off_onset_age + pleiotropyB.trade_off_onset_age) / 2
        )
    };
}

/**
 * Create default linkage map
 * Defines which traits are linked (inherited together) and recombination rates
 * Coadapted gene complexes stay linked; recombination rates can evolve
 */
export function createDefaultLinkageMap() {
    return {
        // Linkage groups - traits within a group tend to be inherited together
        // Lower recombination_rate = tighter linkage
        groups: [
            {
                name: 'metabolism_cluster',
                traits: ['efficiency', 'carnivory', 'scavenging', 'decomposer', 'storage_capacity'],
                recombination_rate: randomRange(0.1, 0.3)  // Low = tightly linked
            },
            {
                name: 'social_cluster',
                traits: ['aggression', 'cooperation_willingness', 'punishment_willingness', 'kin_recognition'],
                recombination_rate: randomRange(0.2, 0.4)
            },
            {
                name: 'reproductive_cluster',
                traits: ['sexual_tendency', 'mate_choosiness', 'courtship_display', 'offspring_investment'],
                recombination_rate: randomRange(0.15, 0.35)
            },
            {
                name: 'morphology_cluster',
                traits: ['node_count', 'motor_count', 'sensor_count'],
                recombination_rate: randomRange(0.2, 0.5)  // Higher = more independent
            },
            {
                name: 'plasticity_cluster',
                traits: ['plasticity_range', 'learning_rate', 'canalization_strength'],
                recombination_rate: randomRange(0.1, 0.3)
            }
        ],

        // Global recombination modifier (evolvable)
        global_recombination_modifier: randomRange(0.8, 1.2),

        // Recombination hotspot locations (increases local recombination)
        hotspots: []
    };
}

/**
 * Get linkage group for a trait
 */
export function getTraitLinkageGroup(linkageMap, traitName) {
    if (!linkageMap?.groups) return null;

    for (const group of linkageMap.groups) {
        if (group.traits.includes(traitName)) {
            return group;
        }
    }
    return null;
}

/**
 * Check if two traits are linked (same linkage group)
 */
export function areTraitsLinked(linkageMap, trait1, trait2) {
    const group1 = getTraitLinkageGroup(linkageMap, trait1);
    const group2 = getTraitLinkageGroup(linkageMap, trait2);

    return group1 && group2 && group1.name === group2.name;
}

/**
 * Get recombination probability between two linked traits
 * Returns 0-1 where 0 = always inherited together, 1 = independent assortment
 */
export function getRecombinationProbability(linkageMap, trait1, trait2) {
    if (!linkageMap) return 0.5;  // Default: independent assortment

    const group = getTraitLinkageGroup(linkageMap, trait1);
    if (!group) return 0.5;

    // Check if same group
    if (!group.traits.includes(trait2)) {
        return 0.5;  // Different groups = independent
    }

    // Same group - use group recombination rate
    const baseRate = group.recombination_rate;
    const modifier = linkageMap.global_recombination_modifier || 1.0;

    return Math.min(0.5, baseRate * modifier);  // Cap at 0.5 (independent)
}

/**
 * Mutate linkage map (recombination rates can evolve)
 */
export function mutateLinkageMap(linkageMap) {
    if (!linkageMap) return createDefaultLinkageMap();

    // Mutate individual group recombination rates
    for (const group of linkageMap.groups) {
        if (randomBool(0.02)) {
            group.recombination_rate = clamp(
                group.recombination_rate + randomRange(-0.05, 0.05),
                0.01, 0.5
            );
        }
    }

    // Mutate global modifier
    if (randomBool(0.01)) {
        linkageMap.global_recombination_modifier = clamp(
            linkageMap.global_recombination_modifier + randomRange(-0.1, 0.1),
            0.5, 1.5
        );
    }

    // Rare hotspot creation
    if (randomBool(0.005) && linkageMap.hotspots.length < 3) {
        linkageMap.hotspots.push({
            group: randomChoice(linkageMap.groups).name,
            strength: randomRange(1.5, 3.0)
        });
    }

    return linkageMap;
}

/**
 * Blend linkage maps during crossover
 */
export function blendLinkageMaps(mapA, mapB) {
    if (!mapA) return mapB || createDefaultLinkageMap();
    if (!mapB) return mapA;

    const blended = {
        groups: [],
        global_recombination_modifier: (mapA.global_recombination_modifier + mapB.global_recombination_modifier) / 2,
        hotspots: []
    };

    // Blend group recombination rates
    for (let i = 0; i < mapA.groups.length; i++) {
        const groupA = mapA.groups[i];
        const groupB = mapB.groups[i];

        blended.groups.push({
            name: groupA.name,
            traits: [...groupA.traits],
            recombination_rate: (groupA.recombination_rate + groupB.recombination_rate) / 2
        });
    }

    // Inherit hotspots from one parent
    blended.hotspots = randomBool(0.5) ? [...(mapA.hotspots || [])] : [...(mapB.hotspots || [])];

    return blended;
}

/**
 * Create default genetic load (Haldane's mutation-selection balance)
 * Tracks accumulation of slightly deleterious mutations
 * Most mutations are slightly harmful (Fisher's geometric model)
 */
export function createDefaultGeneticLoad() {
    return {
        // Count of mildly deleterious alleles carried (heterozygous)
        deleterious_count: 0,

        // Cumulative lethality when homozygous (inbreeding depression)
        // Measured in "lethal equivalents" - 1.0 = equivalent to one lethal allele
        lethal_equivalents: 0,

        // Generation when load was last purged by selection
        last_purged_generation: 0,

        // Mutation accumulation rate modifier (evolvable DNA repair)
        mutation_resistance: randomRange(0.8, 1.2)
    };
}

/**
 * Create default developmental canalization (Waddington)
 * Buffers phenotype against genetic and environmental perturbations
 */
export function createDefaultCanalization() {
    return {
        // Buffering strength - how much mutations are masked (0-1)
        canalization_strength: randomRange(0.3, 0.7),

        // Cryptic genetic variation - masked mutations waiting to express
        // Each entry: { trait, effect, generation_acquired }
        cryptic_variants: [],

        // Stress threshold that breaks buffering and releases cryptic variation
        stress_threshold: randomRange(0.3, 0.6),

        // Evolvability trade-off: high canalization = stable but less evolvable
        evolvability_cost: randomRange(0.1, 0.4)
    };
}

/**
 * Create default selfish genetic elements
 * Genomic parasites that spread despite fitness costs
 */
export function createDefaultSelfishElements() {
    return {
        // Transposable element load (fraction of genome, 0-0.5)
        // TEs copy themselves, creating mutation burden
        transposon_load: randomRange(0, 0.05),

        // Meiotic drive alleles - cheat during meiosis (>50% transmission)
        // Each entry: { strength, fitness_cost, generation_acquired }
        drive_alleles: [],

        // Genome defense against selfish elements (CRISPR-like, piRNA-like)
        suppressor_strength: randomRange(0.3, 0.7),

        // Segregation distorter susceptibility
        distorter_susceptibility: randomRange(0.1, 0.5)
    };
}

/**
 * Create default antagonistic pleiotropy settings
 * Williams (1957): genes with beneficial early effects but harmful late effects
 * This creates mechanistic trade-offs that cannot be optimized away
 */
export function createDefaultPleiotropy() {
    return {
        // === VIGOR-LONGEVITY TRADE-OFF (Williams hypothesis) ===
        // High vigor = faster metabolism = more oxidative damage = shorter lifespan
        vigor: randomRange(0.3, 0.7),           // Activity level/metabolic intensity
        vigor_aging_cost: randomRange(0.5, 1.5), // How much vigor accelerates aging

        // === REPRODUCTION-SURVIVAL TRADE-OFF (Kirkwood's Disposable Soma) ===
        // Energy invested in reproduction is diverted from somatic maintenance
        reproductive_investment: randomRange(0.3, 0.7),  // Fraction of energy to reproduction
        soma_neglect: randomRange(0.3, 0.8),             // How much reproduction hurts maintenance

        // === GROWTH-REPRODUCTION TRADE-OFF ===
        // Fast growers delay reproduction or have lower quality offspring
        growth_rate: randomRange(0.3, 0.7),              // Rate of body size increase
        growth_reproduction_cost: randomRange(0.3, 0.7), // How growth delays/reduces reproduction

        // === IMMUNE-METABOLISM TRADE-OFF ===
        // Strong immune response is metabolically expensive
        immune_investment: randomRange(0.3, 0.7),        // Investment in immune function
        immune_metabolic_cost: randomRange(0.5, 1.0),    // Metabolic penalty of immunity

        // === DISPLAY-SURVIVAL TRADE-OFF (Zahavi's Handicap) ===
        // Elaborate displays attract mates but also predators
        display_intensity: randomRange(0.2, 0.6),        // Size/intensity of displays
        display_predation_cost: randomRange(0.3, 0.8),   // Predation risk from displays

        // === EARLY-LATE LIFE TRADE-OFF (Antagonistic Pleiotropy proper) ===
        // Benefits early in life, costs later
        early_vigor_bonus: randomRange(0.1, 0.3),        // Fitness boost in youth
        late_life_penalty: randomRange(0.3, 0.7),        // Accelerated decline after peak

        // Age at which trade-offs begin to manifest
        trade_off_onset_age: randomInt(300, 600)
    };
}

/**
 * Calculate vigor trade-off effects
 * High vigor increases activity but accelerates aging
 */
export function calculateVigorTradeOff(genome, age) {
    const pleiotropy = genome.pleiotropy;
    if (!pleiotropy) return { activity_bonus: 1.0, aging_penalty: 0 };

    // Vigor provides activity/speed bonus
    const activity_bonus = 1 + pleiotropy.vigor * 0.3;

    // But vigor accelerates aging after trade-off onset
    let aging_penalty = 0;
    if (age > pleiotropy.trade_off_onset_age) {
        const ageExcess = age - pleiotropy.trade_off_onset_age;
        // High vigor organisms age faster
        aging_penalty = pleiotropy.vigor * pleiotropy.vigor_aging_cost * ageExcess * 0.0001;
    }

    return { activity_bonus, aging_penalty };
}

/**
 * Calculate reproduction-survival trade-off (Disposable Soma)
 * Investment in reproduction reduces somatic maintenance
 */
export function calculateReproductiveTradeOff(genome) {
    const pleiotropy = genome.pleiotropy;
    if (!pleiotropy) return { reproduction_bonus: 1.0, maintenance_penalty: 0 };

    // Higher reproductive investment = more offspring
    const reproduction_bonus = 1 + pleiotropy.reproductive_investment * 0.5;

    // But somatic neglect reduces health/repair
    const maintenance_penalty = pleiotropy.reproductive_investment * pleiotropy.soma_neglect;

    return { reproduction_bonus, maintenance_penalty };
}

/**
 * Calculate growth-reproduction trade-off
 * Fast growers pay cost in reproduction timing/quality
 */
export function calculateGrowthTradeOff(genome) {
    const pleiotropy = genome.pleiotropy;
    if (!pleiotropy) return { growth_bonus: 1.0, reproduction_delay: 0 };

    // Growth rate bonus for size/mass
    const growth_bonus = 1 + pleiotropy.growth_rate * 0.3;

    // But growth delays reproduction
    const reproduction_delay = pleiotropy.growth_rate * pleiotropy.growth_reproduction_cost * 50;

    return { growth_bonus, reproduction_delay };
}

/**
 * Calculate immune-metabolism trade-off
 * Strong immunity requires metabolic resources
 */
export function calculateImmuneTradeOff(genome) {
    const pleiotropy = genome.pleiotropy;
    if (!pleiotropy) return { immune_bonus: 1.0, metabolic_cost: 0 };

    // Immune investment provides disease resistance
    const immune_bonus = 1 + pleiotropy.immune_investment * 0.5;

    // But requires energy
    const metabolic_cost = pleiotropy.immune_investment * pleiotropy.immune_metabolic_cost * 0.05;

    return { immune_bonus, metabolic_cost };
}

/**
 * Calculate display-survival trade-off (handicap principle)
 * Elaborate displays attract mates but increase predation risk
 */
export function calculateDisplayTradeOff(genome) {
    const pleiotropy = genome.pleiotropy;
    if (!pleiotropy) return { mate_attraction: 1.0, predation_risk: 0 };

    // Intense displays attract more mates
    const mate_attraction = 1 + pleiotropy.display_intensity * 0.5;

    // But increase predation risk
    const predation_risk = pleiotropy.display_intensity * pleiotropy.display_predation_cost;

    return { mate_attraction, predation_risk };
}

/**
 * Calculate age-dependent pleiotropic effects
 * Returns multiplier for fitness that changes with age
 */
export function calculateAgePleiotropyModifier(genome, age) {
    const pleiotropy = genome.pleiotropy;
    if (!pleiotropy) return 1.0;

    const onsetAge = pleiotropy.trade_off_onset_age;

    // Before trade-off onset: early vigor bonus
    if (age < onsetAge * 0.5) {
        return 1 + pleiotropy.early_vigor_bonus;
    }

    // During peak (50-100% of onset age): maximum fitness
    if (age < onsetAge) {
        return 1.0;
    }

    // After onset: accelerating decline (antagonistic pleiotropy kicks in)
    const ageFraction = (age - onsetAge) / onsetAge;
    const decline = pleiotropy.late_life_penalty * ageFraction * ageFraction;

    return Math.max(0.2, 1 - decline);
}

/**
 * Apply all pleiotropic trade-offs to calculate net fitness modifier
 * Integrates vigor, reproduction, immune, and age effects
 */
export function calculateTotalPleiotropyEffect(genome, age) {
    const pleiotropy = genome.pleiotropy;
    if (!pleiotropy) return { fitness_modifier: 1.0, energy_cost: 0, aging_acceleration: 0 };

    const vigorEffect = calculateVigorTradeOff(genome, age);
    const reproEffect = calculateReproductiveTradeOff(genome);
    const immuneEffect = calculateImmuneTradeOff(genome);
    const displayEffect = calculateDisplayTradeOff(genome);
    const ageModifier = calculateAgePleiotropyModifier(genome, age);

    // Combine benefits and costs
    const benefits = vigorEffect.activity_bonus * reproEffect.reproduction_bonus *
                    immuneEffect.immune_bonus * displayEffect.mate_attraction;

    // Costs compound
    const energy_cost = immuneEffect.metabolic_cost + reproEffect.maintenance_penalty * 0.02;
    const aging_acceleration = vigorEffect.aging_penalty;

    // Apply age-dependent modifier
    const fitness_modifier = benefits * ageModifier;

    return {
        fitness_modifier,
        energy_cost,
        aging_acceleration,
        predation_risk: displayEffect.predation_risk
    };
}

/**
 * Mutate pleiotropy traits
 * Trade-off magnitudes can evolve but the trade-offs themselves cannot be escaped
 */
export function mutatePleiotropy(pleiotropy) {
    if (!pleiotropy) return createDefaultPleiotropy();

    // Vigor can evolve (but aging cost is linked)
    if (randomBool(0.03)) {
        pleiotropy.vigor = clamp(pleiotropy.vigor + randomRange(-0.05, 0.05), 0.1, 0.9);
    }

    // Reproductive investment can shift
    if (randomBool(0.03)) {
        pleiotropy.reproductive_investment = clamp(
            pleiotropy.reproductive_investment + randomRange(-0.05, 0.05), 0.1, 0.9
        );
    }

    // Growth rate can evolve
    if (randomBool(0.03)) {
        pleiotropy.growth_rate = clamp(pleiotropy.growth_rate + randomRange(-0.05, 0.05), 0.1, 0.9);
    }

    // Immune investment can shift
    if (randomBool(0.03)) {
        pleiotropy.immune_investment = clamp(
            pleiotropy.immune_investment + randomRange(-0.05, 0.05), 0.1, 0.9
        );
    }

    // Display intensity can evolve (sexual selection)
    if (randomBool(0.03)) {
        pleiotropy.display_intensity = clamp(
            pleiotropy.display_intensity + randomRange(-0.05, 0.05), 0.05, 0.9
        );
    }

    // Trade-off costs are more constrained (harder to evolve away)
    // Only small changes possible - these represent fundamental constraints
    if (randomBool(0.01)) {
        pleiotropy.vigor_aging_cost = clamp(
            pleiotropy.vigor_aging_cost + randomRange(-0.02, 0.02), 0.3, 2.0
        );
    }

    return pleiotropy;
}

// ============================================================
// HONEST SIGNALING SYSTEM (Zahavi's Handicap Principle)
// ============================================================
// Signals that are costly to produce cannot be faked.
// Only individuals in good condition can afford elaborate displays.
// This maintains signal reliability and enables mate choice.

/**
 * Calculate condition index for an agent
 * Condition reflects overall health/quality - used for honest signaling
 * @param {object} agent - The agent
 * @returns {number} Condition index from 0 (poor) to 1 (excellent)
 */
export function calculateCondition(agent) {
    if (!agent) return 0.5;

    // Energy ratio (primary condition indicator)
    const energyRatio = agent.energy / (agent.genome.metabolism?.storage_capacity || 100);

    // Age factor - prime age has highest condition
    const senescenceAge = CONFIG?.SENESCENCE_AGE || 500;
    const primeAge = senescenceAge * 0.5;
    let ageFactor = 1.0;
    if (agent.age < primeAge * 0.3) {
        // Juvenile - still developing
        ageFactor = 0.5 + (agent.age / (primeAge * 0.3)) * 0.5;
    } else if (agent.age > senescenceAge) {
        // Post-senescence decline
        const decline = (agent.age - senescenceAge) / senescenceAge;
        ageFactor = Math.max(0.2, 1 - decline * 0.5);
    }

    // Size/body quality factor
    const bodySize = (agent.genome.nodes?.length || 3) + (agent.genome.motors?.length || 1);
    const sizeFactor = Math.min(1, bodySize / 10);

    // Genetic load penalty (if present)
    const loadPenalty = agent.genome.genetic_load?.lethal_equivalents || 0;
    const loadFactor = Math.exp(-loadPenalty * 0.5);

    // Combined condition
    const condition = (energyRatio * 0.4 + ageFactor * 0.3 + sizeFactor * 0.15 + loadFactor * 0.15);

    return Math.max(0, Math.min(1, condition));
}

/**
 * Calculate honest signal quality
 * Zahavi's handicap: signal quality is tied to condition
 * High-quality signals are expensive - only fit individuals can afford them
 *
 * @param {object} agent - The signaling agent
 * @returns {object} Signal characteristics
 */
export function calculateSignalQuality(agent) {
    const mating = agent.genome.social?.mating || {};
    const condition = calculateCondition(agent);

    // Base display intensity from genome
    const baseIntensity = mating.courtship_display || 0.5;

    // Signal honesty determines how much condition affects signal
    const honesty = mating.signal_honesty || 0.7;

    // Condition-dependent signal intensity
    // High honesty = signal strongly reflects condition
    // Low honesty = signal can exceed condition (but at higher cost)
    const conditionEffect = condition * honesty + (1 - honesty) * 0.5;
    const actualIntensity = baseIntensity * conditionEffect;

    // Attempted signal (what organism tries to produce)
    const attemptedSignal = baseIntensity;

    // Achieved signal (limited by condition if honest)
    const achievedSignal = Math.min(attemptedSignal, actualIntensity + (1 - honesty) * 0.3);

    // Cost calculation - trying to signal beyond condition is very expensive
    const overclaim = Math.max(0, attemptedSignal - condition);
    const baseCost = attemptedSignal * (mating.display_cost_multiplier || 1.0);

    // Dishonest signaling costs exponentially more
    const dishonestyCost = overclaim * overclaim * 3 * (mating.display_cost_multiplier || 1.0);

    return {
        intensity: achievedSignal,
        honesty: honesty,
        condition: condition,
        energyCost: baseCost + dishonestyCost,
        overclaim: overclaim,
        reliability: honesty * condition  // How trustworthy the signal is
    };
}

/**
 * Calculate signaling energy cost per tick
 * Maintains costly signaling throughout life
 *
 * @param {object} agent - The signaling agent
 * @param {number} dt - Time delta
 * @returns {number} Energy cost for signaling
 */
export function getSignalingCost(agent, dt) {
    const mating = agent.genome.social?.mating;
    if (!mating) return 0;

    const condition = calculateCondition(agent);
    const displayIntensity = mating.courtship_display || 0;
    const costMultiplier = mating.display_cost_multiplier || 1.0;
    const honesty = mating.signal_honesty || 0.7;

    // Base signaling cost
    const baseCost = displayIntensity * 0.01 * costMultiplier;

    // Condition-dependent cost (Zahavian handicap)
    // Poor-condition individuals pay MORE for the same signal
    // This is the key mechanism that maintains honesty
    const conditionPenalty = Math.max(1, 2 - condition);

    // Dishonesty penalty - trying to signal above your condition
    const overclaim = Math.max(0, displayIntensity - condition);
    const dishonestyPenalty = 1 + overclaim * overclaim * (1 - honesty) * 5;

    const totalCost = baseCost * conditionPenalty * dishonestyPenalty * dt;

    return totalCost;
}

/**
 * Evaluate potential mate based on honest signals
 * Choosers should prefer high-quality, reliable signals
 *
 * @param {object} chooser - The mate-selecting agent
 * @param {object} displayer - The signaling potential mate
 * @returns {number} Attractiveness score (0-1)
 */
export function evaluateMateAttractiveness(chooser, displayer) {
    const chooserMating = chooser.genome.social?.mating || {};
    const displayerSignal = calculateSignalQuality(displayer);

    // Base attractiveness from signal intensity
    let attractiveness = displayerSignal.intensity;

    // Choosiness affects threshold
    const choosiness = chooserMating.mate_choosiness || 0.3;

    // Signal type matching (species recognition)
    const preferredSignal = chooserMating.mate_preference || 50;
    const displayerType = displayer.genome.social?.mating?.mate_signal || 50;
    const signalMatch = 1 - Math.abs(preferredSignal - displayerType) / 100;

    // Experienced choosers may detect dishonesty
    // Signal reliability matters - unreliable signals are discounted
    const reliabilityBonus = displayerSignal.reliability * 0.3;

    // Combine factors
    attractiveness = (attractiveness * 0.4 + signalMatch * 0.3 + reliabilityBonus * 0.3);

    // Apply choosiness threshold
    if (attractiveness < choosiness * 0.5) {
        return 0;  // Below minimum acceptable threshold
    }

    return Math.max(0, Math.min(1, attractiveness));
}

/**
 * Calculate fitness benefit of honest signaling system
 * Used by natural selection to maintain signaling honesty
 *
 * @param {object} agent - The agent
 * @returns {number} Fitness modifier from signaling (0.5-1.5)
 */
export function getHonestSignalingFitness(agent) {
    const signal = calculateSignalQuality(agent);

    // Honest signalers in good condition benefit
    if (signal.honesty > 0.7 && signal.condition > 0.5) {
        return 1 + (signal.reliability * 0.2);  // Up to 20% fitness boost
    }

    // Dishonest signalers pay costs without benefits
    if (signal.overclaim > 0.2) {
        return Math.max(0.7, 1 - signal.overclaim * 0.5);  // Up to 30% penalty
    }

    return 1.0;
}

/**
 * Mutate mating/signaling traits with honest signaling constraints
 * Signal intensity can evolve, but honesty is harder to reduce
 */
export function mutateMatingTraits(mating) {
    if (!mating) return createDefaultSocial().mating;

    // Display intensity can evolve freely (sexual selection drives it up)
    if (randomBool(0.05)) {
        mating.courtship_display = clamp(
            mating.courtship_display + randomRange(-0.05, 0.08),  // Slight bias upward
            0.05, 1.0
        );
    }

    // Signal honesty is harder to reduce (maintained by receiver skepticism)
    if (randomBool(0.02)) {
        // Asymmetric mutation - easier to increase than decrease
        const change = randomRange(-0.02, 0.05);
        mating.signal_honesty = clamp(mating.signal_honesty + change, 0.3, 1.0);
    }

    // Cost multiplier evolves slowly
    if (randomBool(0.02)) {
        mating.display_cost_multiplier = clamp(
            mating.display_cost_multiplier + randomRange(-0.05, 0.05),
            0.3, 2.0
        );
    }

    // Choosiness can evolve (but high choosiness is costly in sparse populations)
    if (randomBool(0.03)) {
        mating.mate_choosiness = clamp(
            mating.mate_choosiness + randomRange(-0.03, 0.03),
            0.05, 0.9
        );
    }

    // Mate signals drift (speciation driver)
    if (randomBool(0.02)) {
        mating.mate_signal = clamp(
            mating.mate_signal + randomInt(-5, 5),
            0, 100
        );
    }

    // Preferences can shift (coevolution with signals)
    if (randomBool(0.02)) {
        mating.mate_preference = clamp(
            mating.mate_preference + randomInt(-5, 5),
            0, 100
        );
    }

    return mating;
}

/**
 * Apply genetic load during mutation
 * Most mutations are slightly deleterious (Fisher's geometric model)
 */
export function accumulateGeneticLoad(genome) {
    if (!genome.genetic_load) {
        genome.genetic_load = createDefaultGeneticLoad();
    }

    const load = genome.genetic_load;
    const resistance = load.mutation_resistance || 1.0;

    // Each mutation has a chance to add to load
    // ~70% of non-neutral mutations are deleterious
    if (randomBool(0.05 / resistance)) {
        load.deleterious_count++;
        // Each deleterious mutation adds small lethal equivalent
        load.lethal_equivalents += randomRange(0.01, 0.1);
    }

    // Cap lethal equivalents (beyond ~5, organism is unviable anyway)
    load.lethal_equivalents = Math.min(5.0, load.lethal_equivalents);
}

/**
 * Calculate fitness penalty from genetic load
 * Returns multiplier 0-1 (1 = no penalty, 0 = lethal)
 */
export function calculateLoadPenalty(genome) {
    if (!genome.genetic_load) return 1.0;

    const load = genome.genetic_load;

    // Multiplicative fitness model: each lethal equivalent reduces fitness
    // W = e^(-L) where L is lethal equivalents
    const loadPenalty = Math.exp(-load.lethal_equivalents);

    return Math.max(0.1, loadPenalty);  // Floor at 10% fitness
}

/**
 * Calculate inbreeding depression penalty
 * When relatives mate, recessive deleterious alleles become homozygous
 */
export function calculateInbreedingDepression(genome, inbreedingCoefficient) {
    if (!genome.genetic_load || inbreedingCoefficient <= 0) return 1.0;

    const load = genome.genetic_load;

    // Inbreeding exposes lethal equivalents
    // With inbreeding coefficient F, expected depression = 1 - e^(-BF)
    // where B = lethal equivalents
    const exposedLoad = load.lethal_equivalents * inbreedingCoefficient;
    const depression = 1 - Math.exp(-exposedLoad);

    return Math.max(0.1, 1 - depression);
}

/**
 * Purge genetic load through selection
 * Called when an organism with high load dies - reduces load in survivors
 */
export function purgeGeneticLoad(genome, selectionStrength = 0.1) {
    if (!genome.genetic_load) return;

    const load = genome.genetic_load;

    // Strong selection purges more load
    const purgeAmount = selectionStrength * 0.1;

    load.deleterious_count = Math.max(0, load.deleterious_count - 1);
    load.lethal_equivalents = Math.max(0, load.lethal_equivalents - purgeAmount);
    load.last_purged_generation = genome.generation;
}

/**
 * Apply canalization buffering to a mutation
 * Returns the effective mutation magnitude (may be 0 if buffered)
 */
export function applyCanalizedMutation(genome, traitName, mutationEffect) {
    if (!genome.canalization) {
        genome.canalization = createDefaultCanalization();
    }

    const canal = genome.canalization;

    // Canalization buffers small mutations more effectively
    const effectMagnitude = Math.abs(mutationEffect);
    const bufferProbability = canal.canalization_strength * (1 - effectMagnitude);

    if (randomBool(bufferProbability)) {
        // Mutation is buffered - store as cryptic variant
        canal.cryptic_variants.push({
            trait: traitName,
            effect: mutationEffect,
            generation_acquired: genome.generation
        });

        // Cap cryptic variants (genome can only store so many)
        while (canal.cryptic_variants.length > 20) {
            canal.cryptic_variants.shift();
        }

        return 0;  // No phenotypic effect
    }

    return mutationEffect;  // Full effect if not buffered
}

/**
 * Release cryptic genetic variation under stress
 * Capacitor effect - stress breaks buffering, exposing hidden variation
 */
export function releaseCrypticVariation(genome, stressLevel) {
    if (!genome.canalization || !genome.canalization.cryptic_variants) return [];

    const canal = genome.canalization;

    // Only release if stress exceeds threshold
    if (stressLevel < canal.stress_threshold) return [];

    // Probability of release scales with stress above threshold
    const releaseProbability = (stressLevel - canal.stress_threshold) / (1 - canal.stress_threshold);

    const released = [];

    // Filter and release variants
    canal.cryptic_variants = canal.cryptic_variants.filter(variant => {
        if (randomBool(releaseProbability)) {
            released.push(variant);
            return false;  // Remove from cryptic storage
        }
        return true;  // Keep buffered
    });

    return released;  // Return released variants for phenotypic application
}

/**
 * Process transposon spread during reproduction
 * TEs try to increase their copy number
 */
export function processTransposonSpread(genome) {
    if (!genome.selfish_elements) {
        genome.selfish_elements = createDefaultSelfishElements();
    }

    const selfish = genome.selfish_elements;

    // TEs spread at rate inversely proportional to suppressor strength
    const spreadRate = 0.01 * (1 - selfish.suppressor_strength);

    if (randomBool(spreadRate)) {
        selfish.transposon_load += randomRange(0.005, 0.02);
    }

    // Cap TE load at 50% of genome
    selfish.transposon_load = Math.min(0.5, selfish.transposon_load);

    // TEs can occasionally be purged (TE silencing, deletion)
    if (randomBool(selfish.suppressor_strength * 0.02)) {
        selfish.transposon_load = Math.max(0, selfish.transposon_load - 0.01);
    }
}

/**
 * Calculate fitness cost from selfish genetic elements
 */
export function calculateSelfishElementCost(genome) {
    if (!genome.selfish_elements) return 0;

    const selfish = genome.selfish_elements;

    // TE load creates fitness cost (insertional mutagenesis, metabolic burden)
    const teCost = selfish.transposon_load * 0.3;

    // Drive alleles have fitness costs
    const driveCost = selfish.drive_alleles.reduce((sum, drive) => {
        return sum + (drive.fitness_cost || 0.05);
    }, 0);

    return teCost + driveCost;
}

/**
 * Apply meiotic drive during sexual reproduction
 * Drive alleles get >50% transmission
 */
export function applyMeioticDrive(parentGenome, childGenome) {
    if (!parentGenome.selfish_elements?.drive_alleles) return;

    for (const drive of parentGenome.selfish_elements.drive_alleles) {
        // Drive strength determines transmission advantage (0.5 = Mendelian, 1.0 = 100%)
        const transmissionProb = 0.5 + drive.strength * 0.5;

        if (randomBool(transmissionProb)) {
            // Initialize child's selfish elements if needed
            if (!childGenome.selfish_elements) {
                childGenome.selfish_elements = createDefaultSelfishElements();
            }

            // Inherit drive allele (with possible mutation)
            const inheritedDrive = {
                strength: clamp(drive.strength + randomRange(-0.05, 0.05), 0, 0.9),
                fitness_cost: clamp(drive.fitness_cost + randomRange(-0.01, 0.01), 0.01, 0.3),
                generation_acquired: childGenome.generation
            };

            childGenome.selfish_elements.drive_alleles.push(inheritedDrive);
        }
    }

    // Cap drive alleles
    if (childGenome.selfish_elements?.drive_alleles.length > 3) {
        childGenome.selfish_elements.drive_alleles =
            childGenome.selfish_elements.drive_alleles.slice(-3);
    }
}

/**
 * Rare spontaneous origin of a drive allele
 */
export function maybeOriginateDriveAllele(genome) {
    if (!genome.selfish_elements) {
        genome.selfish_elements = createDefaultSelfishElements();
    }

    // Very rare event - ~0.01% per generation
    if (randomBool(0.0001)) {
        genome.selfish_elements.drive_alleles.push({
            strength: randomRange(0.1, 0.3),
            fitness_cost: randomRange(0.05, 0.15),
            generation_acquired: genome.generation
        });
    }
}

/**
 * Create default Gene Regulatory Network (GRN)
 * Models gene-gene interactions and environmental regulation
 *
 * Structure:
 * - regulatory_modules: Groups of co-regulated genes (modularity)
 * - connections: Regulatory links between genes/modules (activation/inhibition)
 * - environmental_inputs: How environment affects gene expression
 */
export function createDefaultGRN() {
    // Number of regulatory modules (gene clusters)
    const moduleCount = randomInt(2, 4);
    const modules = [];

    // Create regulatory modules
    const moduleTypes = ['metabolism', 'growth', 'defense', 'reproduction', 'locomotion'];
    for (let i = 0; i < moduleCount; i++) {
        modules.push({
            id: i,
            type: moduleTypes[i % moduleTypes.length],
            base_expression: randomRange(0.3, 0.8),  // Default expression level
            // Sensitivity to environmental signals
            temperature_response: randomRange(-0.5, 0.5),  // + = upregulated in heat
            energy_response: randomRange(-0.3, 0.3),       // + = upregulated when low energy
            density_response: randomRange(-0.3, 0.3)       // + = upregulated at high density
        });
    }

    // Create regulatory connections between modules (network topology)
    const connections = [];
    const connectionCount = randomInt(1, moduleCount);

    for (let i = 0; i < connectionCount; i++) {
        const from = randomInt(0, moduleCount - 1);
        let to = randomInt(0, moduleCount - 1);
        if (to === from && moduleCount > 1) {
            to = (to + 1) % moduleCount;
        }

        connections.push({
            from_module: from,
            to_module: to,
            weight: randomRange(-1, 1),  // Negative = inhibition, positive = activation
            delay: randomInt(0, 3)       // Ticks before effect (regulatory lag)
        });
    }

    return {
        modules,
        connections,
        // Global regulatory parameters
        regulation_strength: randomRange(0.1, 0.5),  // How much regulation affects traits
        noise_tolerance: randomRange(0.1, 0.3),       // Resistance to expression noise
        plasticity_coupling: randomRange(0, 0.5)      // Coupling to phenotypic plasticity
    };
}

/**
 * Generate a random genome with body structure
 */
export function generateRandomGenome(options = {}) {
    const nodeCount = options.nodeCount || randomInt(
        CONFIG.INITIAL_NODE_COUNT_MIN,
        CONFIG.INITIAL_NODE_COUNT_MAX
    );

    const genome = createGenome(options);

    // Generate nodes in a rough circular pattern
    const centerX = 0;
    const centerY = 0;
    const radius = 10 + nodeCount * 2;

    for (let i = 0; i < nodeCount; i++) {
        const angle = (i / nodeCount) * Math.PI * 2;
        const r = radius * (0.7 + Math.random() * 0.6);

        genome.nodes.push({
            id: i,
            position: {
                x: centerX + Math.cos(angle) * r,
                y: centerY + Math.sin(angle) * r
            },
            mass: randomRange(0.5, 2.0),
            friction: randomRange(0.1, 0.5)
        });
    }

    // Generate links - connect adjacent nodes in a ring
    for (let i = 0; i < nodeCount; i++) {
        const nextI = (i + 1) % nodeCount;
        const nodeA = genome.nodes[i];
        const nodeB = genome.nodes[nextI];

        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const restLength = Math.sqrt(dx * dx + dy * dy);

        genome.links.push({
            id: i,
            node_a: i,
            node_b: nextI,
            rest_length: restLength,
            stiffness: randomRange(30, 80),
            damping: randomRange(0.3, 0.7)
        });
    }

    // Add some cross-links for structural stability (if enough nodes)
    if (nodeCount >= 4) {
        const crossLinkCount = Math.floor(nodeCount / 2);
        for (let i = 0; i < crossLinkCount; i++) {
            const nodeAIdx = i;
            const nodeBIdx = (i + Math.floor(nodeCount / 2)) % nodeCount;

            // Check if link already exists
            const exists = genome.links.some(l =>
                (l.node_a === nodeAIdx && l.node_b === nodeBIdx) ||
                (l.node_a === nodeBIdx && l.node_b === nodeAIdx)
            );

            if (!exists) {
                const nodeA = genome.nodes[nodeAIdx];
                const nodeB = genome.nodes[nodeBIdx];
                const dx = nodeB.position.x - nodeA.position.x;
                const dy = nodeB.position.y - nodeA.position.y;
                const restLength = Math.sqrt(dx * dx + dy * dy);

                genome.links.push({
                    id: genome.links.length,
                    node_a: nodeAIdx,
                    node_b: nodeBIdx,
                    rest_length: restLength,
                    stiffness: randomRange(20, 50),
                    damping: randomRange(0.3, 0.6)
                });
            }
        }
    }

    // Add motors to some links
    for (let i = 0; i < genome.links.length; i++) {
        if (randomBool(CONFIG.INITIAL_MOTOR_CHANCE)) {
            genome.motors.push({
                id: genome.motors.length,
                attached_to: i,
                cycle_speed: randomRange(1, 5),
                amplitude: randomRange(0.1, 0.4),
                phase_offset: randomRange(0, Math.PI * 2),
                energy_cost: randomRange(0.05, 0.2),
                sensor_modulation: -1  // No sensor modulation by default
            });
        }
    }

    // Add sensors
    const sensorCount = randomBool(CONFIG.INITIAL_SENSOR_CHANCE) ? randomInt(1, 3) : 0;
    for (let i = 0; i < sensorCount; i++) {
        genome.sensors.push(createRandomSensor(i));
    }

    // Maybe connect a motor to a sensor
    if (genome.motors.length > 0 && genome.sensors.length > 0 && randomBool(0.3)) {
        const motor = randomChoice(genome.motors);
        motor.sensor_modulation = randomInt(0, genome.sensors.length - 1);
    }

    return genome;
}

/**
 * Create a random sensor
 */
export function createRandomSensor(id) {
    const type = randomChoice(SENSOR_TYPES);

    let target = null;
    switch (type) {
        case 'chemical':
            target = randomChoice(FOOD_TYPES);
            break;
        case 'thermal':
            target = 'temperature';
            break;
        case 'proximity':
            target = 'agents';
            break;
        case 'kin':
            target = 'species';
            break;
        case 'signal':
            target = randomInt(0, 10).toString();
            break;
        case 'viral':
            target = 'virus';
            break;
        case 'prey':
            target = randomChoice(['living', 'dead', 'both']);
            break;
    }

    return {
        id,
        type,
        sensitivity: randomRange(0.3, 1.0),
        range: randomRange(20, 80),
        target,
        output_gain: randomRange(0.5, 2.0)
    };
}

/**
 * Deep clone a genome
 */
export function cloneGenome(genome) {
    return JSON.parse(JSON.stringify(genome));
}

/**
 * Validate genome structure
 */
export function validateGenome(genome) {
    const errors = [];

    if (!genome.id) errors.push('Missing genome ID');
    if (typeof genome.species_marker !== 'number') errors.push('Invalid species marker');

    // Validate nodes
    if (!Array.isArray(genome.nodes) || genome.nodes.length < CONFIG.MIN_NODES) {
        errors.push(`Need at least ${CONFIG.MIN_NODES} nodes`);
    }

    // Validate links reference valid nodes
    for (const link of genome.links) {
        if (link.node_a >= genome.nodes.length || link.node_b >= genome.nodes.length) {
            errors.push(`Link ${link.id} references invalid node`);
        }
    }

    // Validate motors reference valid links
    for (const motor of genome.motors) {
        if (motor.attached_to >= genome.links.length) {
            errors.push(`Motor ${motor.id} attached to invalid link`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Calculate genome complexity (for fitness penalty)
 */
export function getGenomeComplexity(genome) {
    return genome.nodes.length +
           genome.links.length +
           genome.motors.length * 2 +
           genome.sensors.length * 2;
}

/**
 * DEVELOPMENTAL CONSTRAINTS (Evo-Devo)
 *
 * Enforces biological constraints on body plan:
 * - Motors require sufficient structural nodes to attach to
 * - Sensors have metabolic costs proportional to sensitivity
 * - Large body size requires proportionally more links for stability
 * - Body plan changes have cascading effects on other traits
 */
export function applyDevelopmentalConstraints(genome) {
    const nodeCount = genome.nodes.length;
    const linkCount = genome.links.length;

    // CONSTRAINT 1: Max motors based on body size
    // Can't have more motors than ~70% of links (need some structural links)
    const maxMotors = Math.max(1, Math.floor(linkCount * 0.7));
    while (genome.motors.length > maxMotors) {
        // Remove excess motors (weakest first based on amplitude)
        genome.motors.sort((a, b) => a.amplitude - b.amplitude);
        genome.motors.shift();
    }
    // Update motor IDs
    genome.motors.forEach((motor, i) => motor.id = i);

    // CONSTRAINT 2: Max sensors based on body size
    // Larger organisms can support more sensory apparatus
    const maxSensors = Math.max(1, Math.floor(nodeCount * 0.5));
    while (genome.sensors.length > maxSensors) {
        // Remove excess sensors (lowest sensitivity first)
        genome.sensors.sort((a, b) => a.sensitivity - b.sensitivity);
        genome.sensors.shift();
    }
    // Update sensor IDs and motor references
    genome.sensors.forEach((sensor, i) => sensor.id = i);
    for (const motor of genome.motors) {
        if (motor.sensor_modulation >= genome.sensors.length) {
            motor.sensor_modulation = -1;
        }
    }

    // CONSTRAINT 3: Minimum links for structural stability
    // Need at least n-1 links for n nodes, plus some for stability
    const minLinks = Math.max(nodeCount - 1, Math.floor(nodeCount * 1.2));
    // If we have too few links, body plan is unstable - add some
    while (genome.links.length < minLinks && genome.nodes.length >= 2) {
        addRandomLink(genome);
    }

    // CONSTRAINT 4: Motor validity - motors must attach to existing links
    genome.motors = genome.motors.filter(motor => {
        return motor.attached_to < genome.links.length;
    });
    genome.motors.forEach((motor, i) => motor.id = i);

    // CONSTRAINT 5: Sensor cost scales with sensitivity
    // High sensitivity sensors increase base metabolism
    let sensorMetabolicCost = 0;
    for (const sensor of genome.sensors) {
        sensorMetabolicCost += sensor.sensitivity * sensor.range * 0.0001;
    }
    // This cost is added to base_metabolism (capped)
    genome.metabolism.base_metabolism = clamp(
        (genome.metabolism.base_metabolism || 0.1) + sensorMetabolicCost,
        0.05, 0.4
    );

    return genome;
}

/**
 * Add a random structural link to genome
 */
function addRandomLink(genome) {
    if (genome.nodes.length < 2) return;

    // Find two nodes that aren't connected
    for (let attempts = 0; attempts < 20; attempts++) {
        const nodeAIdx = randomInt(0, genome.nodes.length - 1);
        const nodeBIdx = randomInt(0, genome.nodes.length - 1);

        if (nodeAIdx === nodeBIdx) continue;

        const exists = genome.links.some(l =>
            (l.node_a === nodeAIdx && l.node_b === nodeBIdx) ||
            (l.node_a === nodeBIdx && l.node_b === nodeAIdx)
        );

        if (!exists) {
            const nodeA = genome.nodes[nodeAIdx];
            const nodeB = genome.nodes[nodeBIdx];
            const dx = nodeB.position.x - nodeA.position.x;
            const dy = nodeB.position.y - nodeA.position.y;
            const restLength = Math.sqrt(dx * dx + dy * dy);

            genome.links.push({
                id: genome.links.length,
                node_a: nodeAIdx,
                node_b: nodeBIdx,
                rest_length: restLength,
                stiffness: randomRange(20, 60),
                damping: randomRange(0.3, 0.6)
            });
            return;
        }
    }
}

/**
 * Calculate genetic distance between two genomes
 */
export function geneticDistance(genomeA, genomeB) {
    let distance = 0;

    // Node count difference
    distance += Math.abs(genomeA.nodes.length - genomeB.nodes.length) * 0.5;

    // Link count difference
    distance += Math.abs(genomeA.links.length - genomeB.links.length) * 0.3;

    // Motor count difference
    distance += Math.abs(genomeA.motors.length - genomeB.motors.length) * 0.4;

    // Sensor count difference
    distance += Math.abs(genomeA.sensors.length - genomeB.sensors.length) * 0.4;

    // Metabolism difference
    if (genomeA.metabolism.primary_food !== genomeB.metabolism.primary_food) {
        distance += 1.0;
    }
    distance += Math.abs(genomeA.metabolism.efficiency - genomeB.metabolism.efficiency);

    // Social behavior differences
    distance += Math.abs(
        genomeA.social.cooperation.link_willingness -
        genomeB.social.cooperation.link_willingness
    ) * 0.5;

    distance += Math.abs(
        genomeA.social.competition.aggression -
        genomeB.social.competition.aggression
    ) * 0.5;

    // Normalize to 0-1 range approximately
    return distance / 10;
}

/**
 * Check if two genomes are same species
 */
export function isSameSpecies(genomeA, genomeB) {
    const dist = geneticDistance(genomeA, genomeB);
    return dist < CONFIG.SPECIES_DISTANCE_THRESHOLD;
}

// === GENE DUPLICATION SYSTEM (Ohno's Model) ===
// The primary mechanism by which genomes gain new genes
// After duplication, copies can: neofunctionalize, subfunctionalize, or pseudogenize

/**
 * Duplicate a motor (tandem duplication analog)
 * Creates initially identical copy that can diverge over time
 */
function duplicateMotor(genome) {
    const template = genome.motors[randomInt(0, genome.motors.length - 1)];

    const duplicate = {
        ...JSON.parse(JSON.stringify(template)),
        id: genome.motors.length,
        // Duplication metadata
        is_duplicate: true,
        parent_id: template.id,
        duplication_generation: genome.generation,
        divergence: 0,  // Tracks how much it has diverged from parent
        fate: 'undetermined'  // 'neofunctional', 'subfunctional', 'pseudogene', 'undetermined'
    };

    // Mark original as having a duplicate
    if (!template.duplicate_ids) template.duplicate_ids = [];
    template.duplicate_ids.push(duplicate.id);

    genome.motors.push(duplicate);

    // Duplication has a small fitness cost (dosage imbalance, metabolic cost)
    if (genome.genetic_load) {
        genome.genetic_load.lethal_equivalents += 0.02;
    }
}

/**
 * Duplicate a sensor
 */
function duplicateSensor(genome) {
    const template = genome.sensors[randomInt(0, genome.sensors.length - 1)];

    const duplicate = {
        ...JSON.parse(JSON.stringify(template)),
        id: genome.sensors.length,
        is_duplicate: true,
        parent_id: template.id,
        duplication_generation: genome.generation,
        divergence: 0,
        fate: 'undetermined'
    };

    if (!template.duplicate_ids) template.duplicate_ids = [];
    template.duplicate_ids.push(duplicate.id);

    genome.sensors.push(duplicate);

    if (genome.genetic_load) {
        genome.genetic_load.lethal_equivalents += 0.015;
    }
}

/**
 * Process divergence of duplicated genes over generations
 * Determines fate: neofunctionalization, subfunctionalization, or pseudogenization
 */
function processDuplicateDivergence(genome) {
    // Process motor duplicates
    for (const motor of genome.motors) {
        if (!motor.is_duplicate || motor.fate !== 'undetermined') continue;

        const generationsSinceDup = genome.generation - motor.duplication_generation;

        // Accumulate divergence
        if (randomBool(0.05)) {
            motor.divergence += randomRange(0.02, 0.1);
        }

        // Determine fate based on divergence and time
        if (motor.divergence > 0.5) {
            // Significant divergence - determine fate
            const fateRoll = Math.random();

            if (fateRoll < 0.1) {
                // Neofunctionalization - acquire new function
                motor.fate = 'neofunctional';
                // Modify to have different properties
                motor.cycle_speed *= randomRange(0.5, 2.0);
                motor.strength *= randomRange(0.5, 2.0);
                motor.phase_offset = randomRange(0, Math.PI * 2);
            } else if (fateRoll < 0.5) {
                // Subfunctionalization - split ancestral function
                motor.fate = 'subfunctional';
                // Reduce effectiveness but specialize
                motor.strength *= 0.7;
                // Could specialize for specific conditions
            } else if (fateRoll < 0.7 && generationsSinceDup > 20) {
                // Pseudogenization - become non-functional
                motor.fate = 'pseudogene';
                motor.strength = 0;  // Non-functional
                // Eventually will be removed by purifying selection
            }
            // Else: remain undetermined, continue diverging
        }
    }

    // Process sensor duplicates
    for (const sensor of genome.sensors) {
        if (!sensor.is_duplicate || sensor.fate !== 'undetermined') continue;

        const generationsSinceDup = genome.generation - sensor.duplication_generation;

        if (randomBool(0.05)) {
            sensor.divergence += randomRange(0.02, 0.1);
        }

        if (sensor.divergence > 0.5) {
            const fateRoll = Math.random();

            if (fateRoll < 0.15) {
                sensor.fate = 'neofunctional';
                // Change what the sensor detects
                const types = ['chemical_A', 'chemical_B', 'light', 'temperature', 'agent'];
                sensor.type = types[randomInt(0, types.length - 1)];
                sensor.range *= randomRange(0.5, 1.5);
            } else if (fateRoll < 0.5) {
                sensor.fate = 'subfunctional';
                sensor.range *= 0.7;
            } else if (fateRoll < 0.65 && generationsSinceDup > 20) {
                sensor.fate = 'pseudogene';
                sensor.range = 0;
            }
        }
    }
}

/**
 * Get duplication statistics for a genome
 */
export function getDuplicationStats(genome) {
    const motorDups = genome.motors.filter(m => m.is_duplicate);
    const sensorDups = genome.sensors.filter(s => s.is_duplicate);

    const motorFates = { neofunctional: 0, subfunctional: 0, pseudogene: 0, undetermined: 0 };
    const sensorFates = { neofunctional: 0, subfunctional: 0, pseudogene: 0, undetermined: 0 };

    for (const m of motorDups) {
        motorFates[m.fate || 'undetermined']++;
    }
    for (const s of sensorDups) {
        sensorFates[s.fate || 'undetermined']++;
    }

    return {
        totalMotorDuplicates: motorDups.length,
        totalSensorDuplicates: sensorDups.length,
        motorFates,
        sensorFates,
        avgMotorDivergence: motorDups.length > 0
            ? motorDups.reduce((sum, m) => sum + (m.divergence || 0), 0) / motorDups.length
            : 0,
        avgSensorDivergence: sensorDups.length > 0
            ? sensorDups.reduce((sum, s) => sum + (s.divergence || 0), 0) / sensorDups.length
            : 0
    };
}

/**
 * Check for redundancy between duplicate pairs
 * Redundant duplicates have diminishing fitness returns
 */
export function calculateDuplicationRedundancy(genome) {
    let redundancyPenalty = 0;

    for (const motor of genome.motors) {
        if (!motor.is_duplicate) continue;

        // Find parent
        const parent = genome.motors.find(m => m.id === motor.parent_id);
        if (!parent) continue;

        // Low divergence = high redundancy = penalty
        const divergence = motor.divergence || 0;
        if (divergence < 0.3) {
            // Redundant copies don't add much value
            redundancyPenalty += (0.3 - divergence) * 0.1;
        }
    }

    return redundancyPenalty;
}

/**
 * Mutate a genome in place
 */
export function mutateGenome(genome) {
    // Point mutations on numeric values
    if (randomBool(CONFIG.POINT_MUTATION_RATE)) {
        mutateNumericValues(genome);
    }

    // Structural mutations
    if (randomBool(CONFIG.ADD_NODE_RATE) && genome.nodes.length < CONFIG.MAX_NODES) {
        addNode(genome);
    }

    if (randomBool(CONFIG.REMOVE_NODE_RATE) && genome.nodes.length > CONFIG.MIN_NODES) {
        removeNode(genome);
    }

    if (randomBool(CONFIG.ADD_LINK_RATE)) {
        addLink(genome);
    }

    if (randomBool(CONFIG.REMOVE_LINK_RATE) && genome.links.length > genome.nodes.length) {
        removeLink(genome);
    }

    if (randomBool(CONFIG.ADD_MOTOR_RATE)) {
        addMotor(genome);
    }

    if (randomBool(CONFIG.REMOVE_MOTOR_RATE) && genome.motors.length > 0) {
        removeMotor(genome);
    }

    if (randomBool(CONFIG.ADD_SENSOR_RATE)) {
        addSensor(genome);
    }

    if (randomBool(CONFIG.REMOVE_SENSOR_RATE) && genome.sensors.length > 0) {
        removeSensor(genome);
    }

    // === GENE DUPLICATION (Ohno's Model) ===
    // Primary mechanism for genome evolution and new gene creation
    const duplicationRate = 0.005;  // Rare but important

    if (randomBool(duplicationRate) && genome.motors.length > 0 && genome.motors.length < 8) {
        duplicateMotor(genome);
    }

    if (randomBool(duplicationRate) && genome.sensors.length > 0 && genome.sensors.length < 6) {
        duplicateSensor(genome);
    }

    // Process divergence of existing duplicates (subfunctionalization)
    processDuplicateDivergence(genome);

    // Social trait mutations
    if (randomBool(CONFIG.SOCIAL_MUTATION_RATE)) {
        mutateSocialTraits(genome);
    }

    // Gene regulatory network mutations
    if (randomBool(CONFIG.SOCIAL_MUTATION_RATE * 0.5)) {
        genome.grn = mutateGRN(genome.grn);
    }

    // Linkage map mutations (recombination rates evolve)
    if (randomBool(0.05)) {
        genome.linkage_map = mutateLinkageMap(genome.linkage_map);
    }

    // Mutagenesis trait mutations (mutation rates evolve!)
    if (randomBool(0.03)) {
        genome.mutagenesis = mutateMutagenesis(genome.mutagenesis);
    }

    // Antagonistic pleiotropy trait mutations
    // Trade-off intensities can evolve but constraints remain
    if (randomBool(0.03)) {
        genome.pleiotropy = mutatePleiotropy(genome.pleiotropy);
    }

    // Increment generation
    genome.generation++;

    // Apply developmental constraints (evo-devo)
    // Ensures body plan is viable after mutations
    applyDevelopmentalConstraints(genome);

    // Accumulate genetic load (mutation-selection balance)
    accumulateGeneticLoad(genome);

    // Process transposon spread (selfish genetic elements)
    processTransposonSpread(genome);

    // Rare spontaneous drive allele origin
    maybeOriginateDriveAllele(genome);

    return genome;
}

/**
 * Mutate numeric values slightly
 * Enhanced with pleiotropy - mutations can affect multiple related traits
 */
function mutateNumericValues(genome) {
    const strength = CONFIG.POINT_MUTATION_STRENGTH;

    // Mutate node masses
    for (const node of genome.nodes) {
        if (randomBool(0.1)) {
            const massChange = randomRange(-strength, strength);
            node.mass = clamp(node.mass + massChange, 0.1, 5.0);
            
            // PLEIOTROPY: Mass changes affect friction (larger = more friction)
            // Initialize friction if not present
            if (node.friction === undefined) {
                node.friction = randomRange(0.3, 0.7);
            }
            node.friction = clamp(node.friction + massChange * 0.5, 0.1, 0.9);
        }
    }

    // Mutate link properties
    for (const link of genome.links) {
        if (randomBool(0.1)) {
            const stiffnessChange = randomRange(-10, 10);
            link.stiffness = clamp(link.stiffness + stiffnessChange, 1, 100);
            
            // PLEIOTROPY: Stiff springs need more damping to be stable
            link.damping = clamp(link.damping + stiffnessChange * 0.005, 0, 1);
        }
        if (randomBool(0.1)) {
            link.damping = clamp(link.damping + randomRange(-0.1, 0.1), 0, 1);
        }
    }

    // Mutate motor properties
    for (const motor of genome.motors) {
        if (randomBool(0.1)) {
            const speedChange = randomRange(-0.5, 0.5);
            motor.cycle_speed = clamp(motor.cycle_speed + speedChange, 0.1, 10);
            
            // PLEIOTROPY: Faster motors cost more energy
            motor.energy_cost = clamp(
                (motor.energy_cost || 0.1) + Math.abs(speedChange) * 0.1,
                0.05, 2.0
            );
        }
        if (randomBool(0.1)) {
            const ampChange = randomRange(-0.1, 0.1);
            motor.amplitude = clamp(motor.amplitude + ampChange, 0, 0.5);
            
            // PLEIOTROPY: Larger amplitude needs more energy
            motor.energy_cost = clamp(
                (motor.energy_cost || 0.1) + Math.abs(ampChange) * 0.2,
                0.05, 2.0
            );
        }
    }

    // Mutate metabolism with correlated changes
    if (randomBool(0.1)) {
        const efficiencyChange = randomRange(-0.1, 0.1);
        genome.metabolism.efficiency = clamp(
            genome.metabolism.efficiency + efficiencyChange, 0.1, 1.0
        );

        // PLEIOTROPY: Higher efficiency allows larger energy storage
        // but costs more to maintain (higher base metabolism)
        if (efficiencyChange > 0) {
            genome.metabolism.storage_capacity = clamp(
                genome.metabolism.storage_capacity + 10,
                50, 300
            );
            genome.metabolism.base_metabolism = clamp(
                genome.metabolism.base_metabolism + 0.01,
                0.05, 0.3
            );
        }
    }

    // Mutate carnivory trait
    if (randomBool(0.1)) {
        const carnivoryChange = randomRange(-0.1, 0.1);
        genome.metabolism.carnivory = clamp(
            (genome.metabolism.carnivory || 0) + carnivoryChange, 0, 1.0
        );

        // PLEIOTROPY: Higher carnivory increases aggression but costs more metabolism
        if (carnivoryChange > 0) {
            genome.social.competition.aggression = clamp(
                genome.social.competition.aggression + carnivoryChange * 0.5, 0, 1
            );
            genome.metabolism.base_metabolism = clamp(
                genome.metabolism.base_metabolism + carnivoryChange * 0.02,
                0.05, 0.3
            );
        }
    }

    // Mutate scavenging trait
    if (randomBool(0.1)) {
        const scavengingChange = randomRange(-0.1, 0.1);
        genome.metabolism.scavenging = clamp(
            (genome.metabolism.scavenging || 0) + scavengingChange, 0, 1.0
        );
    }

    // Mutate decomposer trait (for nutrient cycling trophic level)
    if (randomBool(0.1)) {
        const decomposerChange = randomRange(-0.1, 0.1);
        genome.metabolism.decomposer = clamp(
            (genome.metabolism.decomposer || 0) + decomposerChange, 0, 1.0
        );
        // PLEIOTROPY: Higher decomposer reduces carnivory (niche specialization)
        if (decomposerChange > 0.05 && (genome.metabolism.carnivory || 0) > 0.2) {
            genome.metabolism.carnivory = clamp(
                genome.metabolism.carnivory - decomposerChange * 0.3, 0, 1
            );
        }
    }

    // Mutate prey preference (rare)
    if (randomBool(0.02)) {
        genome.metabolism.prey_preference = randomChoice(['any', 'smaller', 'weaker', 'other_species']);
    }

    // Mutate sexual tendency (reproductive strategy - Red Queen hypothesis)
    // Sexual reproduction should increase under parasite pressure
    if (randomBool(0.05)) {
        const sexualChange = randomRange(-0.1, 0.1);
        genome.metabolism.sexual_tendency = clamp(
            (genome.metabolism.sexual_tendency || 0.3) + sexualChange, 0, 1.0
        );
    }

    // LIFE HISTORY TRAIT MUTATIONS (r/K selection)
    // Initialize life_history if not present (backward compatibility)
    if (!genome.metabolism.life_history) {
        genome.metabolism.life_history = {
            offspring_investment: randomRange(0.2, 0.6),
            clutch_size: randomInt(1, 4),
            maturation_age: randomInt(50, 200),
            reproductive_effort: randomRange(0.3, 0.8)
        };
    }

    const lifeHistory = genome.metabolism.life_history;

    // Offspring investment mutation (trade-off: investment vs quantity)
    if (randomBool(0.05)) {
        const investChange = randomRange(-0.05, 0.05);
        lifeHistory.offspring_investment = clamp(
            lifeHistory.offspring_investment + investChange, 0.1, 0.8
        );
        // PLEIOTROPY: Higher investment = fewer offspring (trade-off enforced)
        if (investChange > 0 && lifeHistory.clutch_size > 1) {
            lifeHistory.clutch_size = Math.max(1, lifeHistory.clutch_size - (randomBool(0.3) ? 1 : 0));
        }
    }

    // Clutch size mutation
    if (randomBool(0.03)) {
        const clutchChange = randomBool(0.5) ? 1 : -1;
        lifeHistory.clutch_size = clamp(lifeHistory.clutch_size + clutchChange, 1, 6);
        // PLEIOTROPY: More offspring = less investment each
        if (clutchChange > 0) {
            lifeHistory.offspring_investment = clamp(
                lifeHistory.offspring_investment - 0.03, 0.1, 0.8
            );
        }
    }

    // Maturation age mutation (trade-off: early reproduction vs growth)
    if (randomBool(0.05)) {
        const ageChange = randomInt(-20, 20);
        lifeHistory.maturation_age = clamp(lifeHistory.maturation_age + ageChange, 20, 400);
    }

    // Reproductive effort mutation
    if (randomBool(0.05)) {
        lifeHistory.reproductive_effort = clamp(
            lifeHistory.reproductive_effort + randomRange(-0.1, 0.1), 0.1, 1.0
        );
    }

    // PHENOTYPIC PLASTICITY trait mutations
    // Initialize plasticity traits if not present
    if (!genome.metabolism.plasticity) {
        genome.metabolism.plasticity = {
            plasticity_range: randomRange(0.1, 0.5),
            acclimation_rate: randomRange(0.001, 0.01),
            plasticity_cost: randomRange(0.01, 0.05)
        };
    }

    const plasticity = genome.metabolism.plasticity;

    // Plasticity range mutation (trade-off: adaptability vs cost)
    if (randomBool(0.03)) {
        const rangeChange = randomRange(-0.05, 0.05);
        plasticity.plasticity_range = clamp(plasticity.plasticity_range + rangeChange, 0, 0.8);
        // PLEIOTROPY: Higher plasticity = higher cost
        if (rangeChange > 0) {
            plasticity.plasticity_cost = clamp(plasticity.plasticity_cost + rangeChange * 0.1, 0.01, 0.1);
        }
    }

    // Acclimation rate mutation
    if (randomBool(0.03)) {
        plasticity.acclimation_rate = clamp(
            plasticity.acclimation_rate + randomRange(-0.002, 0.002), 0.0005, 0.02
        );
    }

    // MUTATIONAL LOAD: Rare beneficial mutations (Fisher's geometric model)
    // Most mutations are neutral or slightly deleterious; <0.1% are beneficial
    if (randomBool(0.001)) {  // 0.1% chance of beneficial mutation
        // Boost a random trait
        const beneficialType = randomInt(0, 2);  // 0, 1, or 2 (inclusive)
        switch (beneficialType) {
            case 0: // Metabolism boost
                genome.metabolism.efficiency = clamp(
                    genome.metabolism.efficiency * 1.1, 0.1, 1.0
                );
                break;
            case 1: // Energy storage boost
                genome.metabolism.storage_capacity = clamp(
                    genome.metabolism.storage_capacity * 1.1, 50, 300
                );
                break;
            case 2: // Reduce base cost
                genome.metabolism.base_metabolism = clamp(
                    genome.metabolism.base_metabolism * 0.9, 0.05, 0.3
                );
                break;
        }
    }
}

/**
 * Add a new node to the genome
 */
function addNode(genome) {
    // Pick a random link to split
    if (genome.links.length === 0) return;

    const linkIdx = randomInt(0, genome.links.length - 1);
    const link = genome.links[linkIdx];
    const nodeA = genome.nodes[link.node_a];
    const nodeB = genome.nodes[link.node_b];

    // Create new node at midpoint
    const newNodeId = genome.nodes.length;
    const newNode = {
        id: newNodeId,
        position: {
            x: (nodeA.position.x + nodeB.position.x) / 2,
            y: (nodeA.position.y + nodeB.position.y) / 2
        },
        mass: randomRange(0.5, 2.0),
        friction: randomRange(0.1, 0.5)
    };
    genome.nodes.push(newNode);

    // Update old link to connect to new node
    const oldNodeB = link.node_b;
    link.node_b = newNodeId;
    link.rest_length = link.rest_length / 2;

    // Create new link from new node to old node_b
    genome.links.push({
        id: genome.links.length,
        node_a: newNodeId,
        node_b: oldNodeB,
        rest_length: link.rest_length,
        stiffness: link.stiffness,
        damping: link.damping
    });
}

/**
 * Remove a node from the genome
 */
function removeNode(genome) {
    if (genome.nodes.length <= CONFIG.MIN_NODES) return;

    // Pick a random node (not first one to keep structure)
    const nodeIdx = randomInt(1, genome.nodes.length - 1);

    // Remove links connected to this node
    genome.links = genome.links.filter(link =>
        link.node_a !== nodeIdx && link.node_b !== nodeIdx
    );

    // Remove motors attached to removed links
    const validLinkIds = new Set(genome.links.map(l => l.id));
    genome.motors = genome.motors.filter(m => validLinkIds.has(m.attached_to));

    // Remove the node
    genome.nodes.splice(nodeIdx, 1);

    // Update node indices in remaining links
    for (const link of genome.links) {
        if (link.node_a > nodeIdx) link.node_a--;
        if (link.node_b > nodeIdx) link.node_b--;
    }

    // Update node IDs
    genome.nodes.forEach((node, i) => node.id = i);
}

/**
 * Add a new link between nodes
 */
function addLink(genome) {
    if (genome.nodes.length < 2) return;

    // Find two nodes that aren't already connected
    for (let attempts = 0; attempts < 10; attempts++) {
        const nodeAIdx = randomInt(0, genome.nodes.length - 1);
        let nodeBIdx = randomInt(0, genome.nodes.length - 1);

        if (nodeAIdx === nodeBIdx) continue;

        // Check if link exists
        const exists = genome.links.some(l =>
            (l.node_a === nodeAIdx && l.node_b === nodeBIdx) ||
            (l.node_a === nodeBIdx && l.node_b === nodeAIdx)
        );

        if (!exists) {
            const nodeA = genome.nodes[nodeAIdx];
            const nodeB = genome.nodes[nodeBIdx];
            const dx = nodeB.position.x - nodeA.position.x;
            const dy = nodeB.position.y - nodeA.position.y;
            const restLength = Math.sqrt(dx * dx + dy * dy);

            genome.links.push({
                id: genome.links.length,
                node_a: nodeAIdx,
                node_b: nodeBIdx,
                rest_length: restLength,
                stiffness: randomRange(20, 60),
                damping: randomRange(0.3, 0.6)
            });
            break;
        }
    }
}

/**
 * Remove a link from the genome
 */
function removeLink(genome) {
    // Keep at least n-1 links for n nodes (to stay connected)
    if (genome.links.length <= genome.nodes.length - 1) return;

    const linkIdx = randomInt(0, genome.links.length - 1);
    const linkId = genome.links[linkIdx].id;

    // Remove motors attached to this link
    genome.motors = genome.motors.filter(m => m.attached_to !== linkId);

    // Remove the link
    genome.links.splice(linkIdx, 1);

    // Update link IDs and motor attachments
    genome.links.forEach((link, i) => {
        const oldId = link.id;
        link.id = i;
        // Update motor attachments
        for (const motor of genome.motors) {
            if (motor.attached_to === oldId) {
                motor.attached_to = i;
            }
        }
    });
}

/**
 * Add a motor to a link
 */
function addMotor(genome) {
    if (genome.links.length === 0) return;

    // Find a link without a motor
    const linksWithMotors = new Set(genome.motors.map(m => m.attached_to));
    const availableLinks = genome.links.filter(l => !linksWithMotors.has(l.id));

    if (availableLinks.length === 0) return;

    const link = randomChoice(availableLinks);

    genome.motors.push({
        id: genome.motors.length,
        attached_to: link.id,
        cycle_speed: randomRange(1, 5),
        amplitude: randomRange(0.1, 0.4),
        phase_offset: randomRange(0, Math.PI * 2),
        energy_cost: randomRange(0.05, 0.2),
        sensor_modulation: genome.sensors.length > 0 && randomBool(0.3)
            ? randomInt(0, genome.sensors.length - 1)
            : -1
    });
}

/**
 * Remove a motor
 */
function removeMotor(genome) {
    if (genome.motors.length === 0) return;

    const motorIdx = randomInt(0, genome.motors.length - 1);
    genome.motors.splice(motorIdx, 1);

    // Update motor IDs
    genome.motors.forEach((motor, i) => motor.id = i);
}

/**
 * Add a sensor
 */
function addSensor(genome) {
    genome.sensors.push(createRandomSensor(genome.sensors.length));
}

/**
 * Remove a sensor
 */
function removeSensor(genome) {
    if (genome.sensors.length === 0) return;

    const sensorIdx = randomInt(0, genome.sensors.length - 1);

    // Update motor references
    for (const motor of genome.motors) {
        if (motor.sensor_modulation === sensorIdx) {
            motor.sensor_modulation = -1;
        } else if (motor.sensor_modulation > sensorIdx) {
            motor.sensor_modulation--;
        }
    }

    genome.sensors.splice(sensorIdx, 1);

    // Update sensor IDs
    genome.sensors.forEach((sensor, i) => sensor.id = i);
}

/**
 * Mutate social traits
 */
function mutateSocialTraits(genome) {
    const social = genome.social;
    const strength = 0.1;

    // Initialize top-level social traits if not present (backward compatibility)
    if (social.cooperation_willingness === undefined) {
        social.cooperation_willingness = randomRange(0.2, 0.8);
    }
    if (social.kin_recognition === undefined) {
        social.kin_recognition = randomRange(0.3, 0.8);
    }

    // Top-level cooperation traits
    social.cooperation_willingness = clamp(
        social.cooperation_willingness + randomRange(-strength, strength), 0, 1
    );
    social.kin_recognition = clamp(
        social.kin_recognition + randomRange(-strength, strength), 0, 1
    );

    // Punishment willingness (second-order cooperation)
    if (social.punishment_willingness === undefined) {
        social.punishment_willingness = randomRange(0.1, 0.5);
    }
    if (randomBool(0.05)) {
        social.punishment_willingness = clamp(
            social.punishment_willingness + randomRange(-strength, strength), 0, 1
        );
    }

    // Cooperation nested traits
    social.cooperation.link_willingness = clamp(
        social.cooperation.link_willingness + randomRange(-strength, strength), 0, 1
    );
    social.cooperation.resource_sharing = clamp(
        social.cooperation.resource_sharing + randomRange(-strength, strength), 0, 1
    );

    // Competition
    social.competition.aggression = clamp(
        social.competition.aggression + randomRange(-strength, strength), 0, 1
    );
    social.competition.flee_threshold = clamp(
        social.competition.flee_threshold + randomRange(-strength, strength), 0, 1
    );

    // Maybe change territorial behavior
    if (randomBool(0.1)) {
        if (social.competition.territorial_radius === 0) {
            social.competition.territorial_radius = randomRange(20, 60);
        } else {
            social.competition.territorial_radius = 0;
        }
    }

    // Initialize mating traits if not present (for backward compatibility)
    if (!social.mating) {
        social.mating = {
            mate_signal: randomInt(0, 100),
            mate_preference: randomInt(0, 100),
            mate_choosiness: randomRange(0.1, 0.5),
            courtship_display: randomRange(0.1, 0.8)
        };
    }

    // Mating signal mutation (reproductive isolation - can lead to speciation)
    // Signal and preference should drift slowly together to maintain compatibility within species
    if (randomBool(0.05)) {
        // Small signal drift - this is how reproductive isolation evolves
        const signalDrift = randomInt(-5, 5);
        social.mating.mate_signal = clamp(social.mating.mate_signal + signalDrift, 0, 100);

        // Preference often follows signal (runaway selection / Fisherian process)
        if (randomBool(0.7)) {
            social.mating.mate_preference = clamp(
                social.mating.mate_preference + signalDrift, 0, 100
            );
        }
    }

    // Choosiness mutation - affects strength of pre-zygotic isolation
    if (randomBool(0.03)) {
        social.mating.mate_choosiness = clamp(
            social.mating.mate_choosiness + randomRange(-0.1, 0.1), 0, 1
        );
    }

    // Courtship display mutation (with cost trade-off)
    if (randomBool(0.05)) {
        const displayChange = randomRange(-0.1, 0.1);
        social.mating.courtship_display = clamp(
            social.mating.courtship_display + displayChange, 0, 1
        );
        // PLEIOTROPY: Higher display = higher cost
        if (displayChange > 0) {
            social.mating.display_cost_multiplier = clamp(
                (social.mating.display_cost_multiplier || 1.0) + displayChange * 0.3, 0.3, 2.0
            );
        }
    }

    // Signal honesty mutation (trade-off: honest signals are more trusted but harder to produce)
    if (randomBool(0.03)) {
        social.mating.signal_honesty = clamp(
            (social.mating.signal_honesty || 0.7) + randomRange(-0.1, 0.1), 0.3, 1.0
        );
    }

    // Display cost multiplier mutation
    if (randomBool(0.03)) {
        social.mating.display_cost_multiplier = clamp(
            (social.mating.display_cost_multiplier || 1.0) + randomRange(-0.2, 0.2), 0.3, 2.0
        );
    }

    // BEHAVIORAL LEARNING trait mutations
    // Initialize learning traits if not present
    if (!social.learning) {
        social.learning = {
            memory_capacity: randomRange(0.1, 0.8),
            learning_rate: randomRange(0.01, 0.1),
            memory_decay: randomRange(0.001, 0.01),
            exploration_drive: randomRange(0.2, 0.7),
            learning_cost: randomRange(0.01, 0.05)
        };
    }

    const learning = social.learning;

    // Memory capacity mutation (trade-off: larger memory = higher cost)
    if (randomBool(0.03)) {
        const capacityChange = randomRange(-0.1, 0.1);
        learning.memory_capacity = clamp(learning.memory_capacity + capacityChange, 0.05, 0.95);
        // PLEIOTROPY: Better memory costs more to maintain
        if (capacityChange > 0) {
            learning.learning_cost = clamp(learning.learning_cost + capacityChange * 0.05, 0.01, 0.1);
        }
    }

    // Learning rate mutation (trade-off: fast learning can overfit)
    if (randomBool(0.03)) {
        learning.learning_rate = clamp(
            learning.learning_rate + randomRange(-0.02, 0.02), 0.005, 0.2
        );
    }

    // Memory decay mutation
    if (randomBool(0.03)) {
        learning.memory_decay = clamp(
            learning.memory_decay + randomRange(-0.002, 0.002), 0.0005, 0.02
        );
    }

    // Exploration drive mutation (trade-off: explore vs exploit)
    if (randomBool(0.03)) {
        learning.exploration_drive = clamp(
            learning.exploration_drive + randomRange(-0.1, 0.1), 0.1, 0.9
        );
    }
}

/**
 * Crossover two genomes (sexual reproduction)
 */
export function crossover(parentA, parentB) {
    const child = createGenome({
        species_marker: randomBool(0.5) ? parentA.species_marker : parentB.species_marker,
        generation: Math.max(parentA.generation, parentB.generation) + 1
    });

    // Body structure: take from one parent with some mixing
    const primaryParent = randomBool(0.5) ? parentA : parentB;
    const secondaryParent = primaryParent === parentA ? parentB : parentA;

    // Clone nodes from primary parent
    child.nodes = cloneGenome(primaryParent).nodes;

    // Clone links from primary parent
    child.links = cloneGenome(primaryParent).links;

    // Mix motors from both parents
    child.motors = [];
    const allMotors = [...parentA.motors, ...parentB.motors];
    for (const motor of allMotors) {
        if (motor.attached_to < child.links.length && randomBool(0.5)) {
            // Check if we already have a motor on this link
            const exists = child.motors.some(m => m.attached_to === motor.attached_to);
            if (!exists) {
                child.motors.push({
                    ...motor,
                    id: child.motors.length
                });
            }
        }
    }

    // Mix sensors
    child.sensors = [];
    const allSensors = [...parentA.sensors, ...parentB.sensors];
    for (const sensor of allSensors) {
        if (randomBool(0.5) && child.sensors.length < 5) {
            child.sensors.push({
                ...sensor,
                id: child.sensors.length
            });
        }
    }

    // Metabolism: inherit from one parent with blending
    if (randomBool(0.5)) {
        child.metabolism = cloneGenome(parentA).metabolism;
    } else {
        child.metabolism = cloneGenome(parentB).metabolism;
    }
    child.metabolism.efficiency = (parentA.metabolism.efficiency + parentB.metabolism.efficiency) / 2;

    // Blend carnivory/scavenging traits
    child.metabolism.carnivory = ((parentA.metabolism.carnivory || 0) + (parentB.metabolism.carnivory || 0)) / 2;
    child.metabolism.scavenging = ((parentA.metabolism.scavenging || 0) + (parentB.metabolism.scavenging || 0)) / 2;
    child.metabolism.prey_preference = randomBool(0.5)
        ? (parentA.metabolism.prey_preference || 'any')
        : (parentB.metabolism.prey_preference || 'any');

    // Blend sexual tendency (reproductive strategy)
    child.metabolism.sexual_tendency = ((parentA.metabolism.sexual_tendency || 0.3) + (parentB.metabolism.sexual_tendency || 0.3)) / 2;

    // Blend life history traits (r/K strategy inheritance)
    const lifeHistoryA = parentA.metabolism.life_history || {
        offspring_investment: 0.4, clutch_size: 2, maturation_age: 100, reproductive_effort: 0.5
    };
    const lifeHistoryB = parentB.metabolism.life_history || {
        offspring_investment: 0.4, clutch_size: 2, maturation_age: 100, reproductive_effort: 0.5
    };
    child.metabolism.life_history = {
        offspring_investment: (lifeHistoryA.offspring_investment + lifeHistoryB.offspring_investment) / 2,
        clutch_size: randomBool(0.5) ? lifeHistoryA.clutch_size : lifeHistoryB.clutch_size,
        maturation_age: Math.round((lifeHistoryA.maturation_age + lifeHistoryB.maturation_age) / 2),
        reproductive_effort: (lifeHistoryA.reproductive_effort + lifeHistoryB.reproductive_effort) / 2
    };

    // Blend plasticity traits
    const plasticityA = parentA.metabolism.plasticity || {
        plasticity_range: 0.3, acclimation_rate: 0.005, plasticity_cost: 0.02
    };
    const plasticityB = parentB.metabolism.plasticity || {
        plasticity_range: 0.3, acclimation_rate: 0.005, plasticity_cost: 0.02
    };
    child.metabolism.plasticity = {
        plasticity_range: (plasticityA.plasticity_range + plasticityB.plasticity_range) / 2,
        acclimation_rate: (plasticityA.acclimation_rate + plasticityB.acclimation_rate) / 2,
        plasticity_cost: (plasticityA.plasticity_cost + plasticityB.plasticity_cost) / 2
    };

    // Social traits: blend values
    child.social = blendSocialTraits(parentA.social, parentB.social);

    // HGT traits: blend
    child.hgt = blendHGTTraits(parentA.hgt, parentB.hgt);

    // Viral traits: union of receptors, inherited CRISPR
    child.viral = {
        receptors: [...new Set([...parentA.viral.receptors, ...parentB.viral.receptors])].slice(0, 5),
        resistance: (parentA.viral.resistance + parentB.viral.resistance) / 2,
        crispr_memory: inheritCRISPR(parentA, parentB)
    };

    // === GENETIC LOAD INHERITANCE ===
    // Sexual reproduction can reduce load through recombination (Muller's ratchet escape)
    const loadA = parentA.genetic_load || createDefaultGeneticLoad();
    const loadB = parentB.genetic_load || createDefaultGeneticLoad();

    // Recombination benefit: child gets lower of the two loads (purging effect)
    // Sexual reproduction advantage over asexual
    const recombinationBenefit = 0.8;  // 20% reduction from recombination
    child.genetic_load = {
        deleterious_count: Math.floor(Math.min(loadA.deleterious_count, loadB.deleterious_count) * recombinationBenefit),
        lethal_equivalents: Math.min(loadA.lethal_equivalents, loadB.lethal_equivalents) * recombinationBenefit,
        last_purged_generation: child.generation,
        mutation_resistance: (loadA.mutation_resistance + loadB.mutation_resistance) / 2
    };

    // === CANALIZATION INHERITANCE ===
    const canalA = parentA.canalization || createDefaultCanalization();
    const canalB = parentB.canalization || createDefaultCanalization();

    child.canalization = {
        canalization_strength: (canalA.canalization_strength + canalB.canalization_strength) / 2,
        cryptic_variants: [],  // Cryptic variants don't transfer (they're somatic)
        stress_threshold: (canalA.stress_threshold + canalB.stress_threshold) / 2,
        evolvability_cost: (canalA.evolvability_cost + canalB.evolvability_cost) / 2
    };

    // === SELFISH ELEMENTS INHERITANCE ===
    const selfishA = parentA.selfish_elements || createDefaultSelfishElements();
    const selfishB = parentB.selfish_elements || createDefaultSelfishElements();

    child.selfish_elements = {
        // TE load averages (some are homozygous, some heterozygous)
        transposon_load: (selfishA.transposon_load + selfishB.transposon_load) / 2,
        drive_alleles: [],  // Applied separately via applyMeioticDrive
        suppressor_strength: (selfishA.suppressor_strength + selfishB.suppressor_strength) / 2,
        distorter_susceptibility: (selfishA.distorter_susceptibility + selfishB.distorter_susceptibility) / 2
    };

    // Apply meiotic drive from both parents (biased transmission)
    applyMeioticDrive(parentA, child);
    applyMeioticDrive(parentB, child);

    // === LINKAGE MAP INHERITANCE ===
    // Recombination rates are inherited and can evolve
    child.linkage_map = blendLinkageMaps(parentA.linkage_map, parentB.linkage_map);

    // === MUTAGENESIS INHERITANCE ===
    // Mutation rates are heritable and evolvable
    child.mutagenesis = blendMutagenesis(parentA.mutagenesis, parentB.mutagenesis);

    // === ANTAGONISTIC PLEIOTROPY INHERITANCE ===
    // Life history trade-offs are heritable
    child.pleiotropy = blendPleiotropy(parentA.pleiotropy, parentB.pleiotropy);

    // Apply developmental constraints to ensure viable body plan
    applyDevelopmentalConstraints(child);

    return child;
}

/**
 * Blend social traits from two parents
 */
function blendSocialTraits(socialA, socialB) {
    // Handle missing top-level traits (backward compatibility)
    const coopWillA = socialA.cooperation_willingness ?? 0.5;
    const coopWillB = socialB.cooperation_willingness ?? 0.5;
    const kinRecA = socialA.kin_recognition ?? 0.5;
    const kinRecB = socialB.kin_recognition ?? 0.5;
    const punishWillA = socialA.punishment_willingness ?? 0.3;
    const punishWillB = socialB.punishment_willingness ?? 0.3;

    return {
        // Top-level cooperation traits
        cooperation_willingness: (coopWillA + coopWillB) / 2,
        kin_recognition: (kinRecA + kinRecB) / 2,
        punishment_willingness: (punishWillA + punishWillB) / 2,

        cooperation: {
            link_willingness: (socialA.cooperation.link_willingness + socialB.cooperation.link_willingness) / 2,
            link_strength: (socialA.cooperation.link_strength + socialB.cooperation.link_strength) / 2,
            resource_sharing: (socialA.cooperation.resource_sharing + socialB.cooperation.resource_sharing) / 2,
            signal_response: (socialA.cooperation.signal_response + socialB.cooperation.signal_response) / 2
        },
        competition: {
            aggression: (socialA.competition.aggression + socialB.competition.aggression) / 2,
            territorial_radius: randomBool(0.5) ? socialA.competition.territorial_radius : socialB.competition.territorial_radius,
            flee_threshold: (socialA.competition.flee_threshold + socialB.competition.flee_threshold) / 2,
            resource_greed: (socialA.competition.resource_greed + socialB.competition.resource_greed) / 2
        },
        symbiosis: randomBool(0.5) ? { ...socialA.symbiosis } : { ...socialB.symbiosis },
        communication: randomBool(0.5) ? { ...socialA.communication } : { ...socialB.communication },
        // Mating traits: blend with some inheritance pattern
        mating: blendMatingTraits(socialA.mating, socialB.mating)
    };
}

/**
 * Blend mating traits from two parents
 * Uses inheritance patterns that maintain assortative mating within lineages
 */
function blendMatingTraits(matingA, matingB) {
    // Handle missing mating traits (backward compatibility)
    const defaultMating = {
        mate_signal: randomInt(0, 100),
        mate_preference: randomInt(0, 100),
        mate_choosiness: randomRange(0.1, 0.5),
        courtship_display: randomRange(0.1, 0.8),
        signal_honesty: randomRange(0.5, 1.0),
        display_cost_multiplier: randomRange(0.5, 1.5)
    };

    const a = matingA || defaultMating;
    const b = matingB || defaultMating;

    return {
        // Signal tends to average (like plumage color)
        mate_signal: Math.round((a.mate_signal + b.mate_signal) / 2),
        // Preference also averages (imprinting-like)
        mate_preference: Math.round((a.mate_preference + b.mate_preference) / 2),
        // Choosiness can vary more
        mate_choosiness: randomBool(0.5) ? a.mate_choosiness : b.mate_choosiness,
        // Courtship display averages
        courtship_display: (a.courtship_display + b.courtship_display) / 2,
        // Honest signaling traits (Zahavian handicap)
        signal_honesty: ((a.signal_honesty || 0.7) + (b.signal_honesty || 0.7)) / 2,
        display_cost_multiplier: ((a.display_cost_multiplier || 1.0) + (b.display_cost_multiplier || 1.0)) / 2
    };
}

/**
 * Blend HGT traits from two parents
 */
function blendHGTTraits(hgtA, hgtB) {
    return {
        donor_willingness: (hgtA.donor_willingness + hgtB.donor_willingness) / 2,
        recipient_openness: (hgtA.recipient_openness + hgtB.recipient_openness) / 2,
        transfer_type: randomBool(0.5) ? hgtA.transfer_type : hgtB.transfer_type,
        plasmids: [],  // Plasmids handled separately
        restriction_markers: [...new Set([...hgtA.restriction_markers, ...hgtB.restriction_markers])],
        dna_release_on_death: randomBool(0.5) ? hgtA.dna_release_on_death : hgtB.dna_release_on_death
    };
}

/**
 * Inherit CRISPR memory from parents
 */
function inheritCRISPR(parentA, parentB) {
    const combined = [
        ...parentA.viral.crispr_memory,
        ...parentB.viral.crispr_memory
    ];

    // Remove duplicates
    const unique = [...new Set(combined)];

    // Trim to capacity
    if (unique.length > CONFIG.CRISPR_MEMORY_SLOTS) {
        return unique.slice(-CONFIG.CRISPR_MEMORY_SLOTS);
    }

    // Chance of memory decay
    return unique.filter(() => randomBool(1 - CONFIG.CRISPR_MEMORY_DECAY));
}

// Alias for crossover (used by evolution.js)
export const crossoverGenomes = crossover;

/**
 * Calculate honest signal strength (Zahavian handicap principle)
 *
 * Honest signals are costly and tied to actual fitness/condition.
 * High-quality individuals can afford more elaborate displays.
 * This prevents cheating because low-quality individuals can't
 * afford the metabolic cost of maintaining false signals.
 *
 * @param {Object} agent - The signaling agent
 * @returns {number} - Effective signal strength (0-1)
 */
export function calculateHonestSignal(agent) {
    const mating = agent.genome.social?.mating || {
        courtship_display: 0.5,
        signal_honesty: 0.7
    };

    const baseDisplay = mating.courtship_display;
    const honesty = mating.signal_honesty || 0.7;

    // Condition-dependent components
    const energyCondition = agent.energy / agent.genome.metabolism.storage_capacity;
    const geneticQuality = agent.genome.metabolism.efficiency;
    const ageVigor = agent.age < 200 ? 1.0 : Math.max(0.5, 1 - (agent.age - 200) / 1000);

    // Weighted condition score
    const condition = (energyCondition * 0.5 + geneticQuality * 0.3 + ageVigor * 0.2);

    // Honest signal is weighted by actual condition
    // High honesty = signal strongly tied to condition (hard to fake)
    // Low honesty = signal less tied to condition (easier to fake but less attractive)
    const honestComponent = condition * honesty;
    const dishonestComponent = (1 - honesty);

    return baseDisplay * (honestComponent + dishonestComponent);
}

/**
 * Calculate display cost for an agent (energy drain from signaling)
 * Honest costly signals drain more energy from low-quality individuals
 */
export function calculateDisplayCost(agent, dt) {
    const mating = agent.genome.social?.mating;
    if (!mating || mating.courtship_display < 0.2) return 0;

    // Base cost from display intensity
    const displayIntensity = mating.courtship_display;
    const costMultiplier = mating.display_cost_multiplier || 1.0;

    // Condition affects cost - low condition = higher relative cost
    const condition = agent.energy / agent.genome.metabolism.storage_capacity;
    const conditionPenalty = 1 + (1 - condition) * 0.5;  // Up to 1.5x cost when weak

    return displayIntensity * costMultiplier * conditionPenalty * 0.05 * dt;
}

/**
 * Check mate compatibility based on signals (pre-zygotic barrier)
 *
 * Returns a compatibility score from 0 to 1.
 * Higher choosiness means stricter matching required.
 *
 * This implements reproductive isolation through:
 * - Signal-preference matching (like bird song, plumage, pheromones)
 * - Choosiness affecting how strict the matching is
 * - Courtship display affecting attractiveness
 * - HONEST SIGNALING: Display weighted by condition (handicap principle)
 */
export function calculateMateCompatibility(genomeA, genomeB, agentA = null, agentB = null) {
    // Get mating traits with defaults for backward compatibility
    const matingA = genomeA.social?.mating || {
        mate_signal: 50, mate_preference: 50, mate_choosiness: 0.3, courtship_display: 0.5
    };
    const matingB = genomeB.social?.mating || {
        mate_signal: 50, mate_preference: 50, mate_choosiness: 0.3, courtship_display: 0.5
    };

    // Calculate how well each agent's signal matches the other's preference
    // Difference of 0 = perfect match, difference of 50 = worst possible match
    const diffA = Math.abs(matingA.mate_signal - matingB.mate_preference);
    const diffB = Math.abs(matingB.mate_signal - matingA.mate_preference);

    // Normalize to 0-1 (0 = no match, 1 = perfect match)
    const matchA = 1 - (diffA / 50);  // Max difference is 50 (signal 0-100)
    const matchB = 1 - (diffB / 50);

    // Each agent must accept the other based on their choosiness
    // High choosiness = need high match score
    const thresholdA = matingA.mate_choosiness;
    const thresholdB = matingB.mate_choosiness;

    // HONEST SIGNALING: Courtship display weighted by condition
    // If agents are provided, use honest signal calculation (condition-dependent)
    // Otherwise fall back to raw display value
    let displayA, displayB;
    if (agentA && agentB) {
        // Honest signals - high-quality individuals display better
        displayA = calculateHonestSignal(agentA);
        displayB = calculateHonestSignal(agentB);
    } else {
        // Raw display values (used when only genomes available)
        displayA = matingA.courtship_display;
        displayB = matingB.courtship_display;
    }

    // Courtship display can compensate somewhat for signal mismatch
    // Honest displays from high-quality individuals are more attractive
    const courtshipBonus = (displayA + displayB) / 4;  // Up to 0.4 bonus

    // Honesty bonus - individuals with high signal_honesty are more trusted
    const honestyA = matingA.signal_honesty || 0.7;
    const honestyB = matingB.signal_honesty || 0.7;
    const honestyBonus = (honestyA + honestyB - 1) * 0.1;  // Bonus for honest signalers

    const acceptedByA = (matchA + courtshipBonus + honestyBonus) >= thresholdA;
    const acceptedByB = (matchB + courtshipBonus + honestyBonus) >= thresholdB;

    // Both must accept for mating to occur
    if (!acceptedByA || !acceptedByB) {
        return 0;  // Incompatible - pre-zygotic isolation
    }

    // Return overall compatibility (used for mate choice)
    // Higher honest displays increase attractiveness
    return (matchA + matchB) / 2 + (displayA + displayB) / 10;
}

/**
 * Calculate hybrid fitness penalty (post-zygotic barrier)
 *
 * Hybrids between genetically distant parents suffer reduced fitness.
 * This creates selection against hybridization even when pre-zygotic
 * barriers are weak.
 *
 * Based on Dobzhansky-Muller incompatibilities where diverged genes
 * don't work well together.
 */
export function calculateHybridFitnessPenalty(parentA, parentB) {
    const genDist = geneticDistance(parentA, parentB);

    // No penalty for same species or closely related individuals
    if (genDist < 0.1) {
        return 0;
    }

    // Penalty increases quadratically with genetic distance
    // This models Dobzhansky-Muller incompatibilities
    // At genetic distance 0.5, penalty is ~25% fitness reduction
    // At genetic distance 1.0, penalty is ~100% (lethal hybrid)
    const penalty = Math.pow(genDist, 2);

    return Math.min(1, penalty);  // Cap at 100% penalty
}

// === GENE REGULATORY NETWORK FUNCTIONS ===

/**
 * Calculate GRN module expression levels based on environment and internal state
 * Returns a map of module type -> expression level (0-2, where 1 is baseline)
 */
export function calculateGRNExpression(agent, environment, populationDensity) {
    const grn = agent.genome.grn;
    if (!grn || !grn.modules || grn.modules.length === 0) {
        // No GRN - return default expression
        return new Map([
            ['metabolism', 1.0],
            ['growth', 1.0],
            ['defense', 1.0],
            ['reproduction', 1.0],
            ['locomotion', 1.0]
        ]);
    }

    // Calculate environmental signals
    const temp = environment?.temperature ?? 0.5;
    const tempSignal = (temp - 0.5) * 2;  // Normalize to -1 to +1

    const energyRatio = agent.energy / agent.genome.metabolism.storage_capacity;
    const energySignal = 1 - energyRatio;  // High signal when low energy

    const densitySignal = Math.min(1, populationDensity);  // 0 to 1

    // Initialize expression levels for each module
    const moduleExpression = new Map();

    for (const module of grn.modules) {
        // Start with base expression
        let expression = module.base_expression;

        // Apply environmental responses
        expression += tempSignal * module.temperature_response;
        expression += energySignal * module.energy_response;
        expression += densitySignal * module.density_response;

        // Clamp initial expression
        expression = clamp(expression, 0.1, 1.5);

        moduleExpression.set(module.id, expression);
    }

    // Apply regulatory connections (gene-gene interactions)
    // This creates epistasis and regulatory cascades
    for (const conn of grn.connections) {
        const fromExpr = moduleExpression.get(conn.from_module) || 1.0;
        const currentToExpr = moduleExpression.get(conn.to_module) || 1.0;

        // Regulatory effect: positive weight = activation, negative = inhibition
        const effect = (fromExpr - 0.5) * conn.weight * grn.regulation_strength;
        const newExpr = clamp(currentToExpr + effect, 0.1, 2.0);

        moduleExpression.set(conn.to_module, newExpr);
    }

    // Add some biological noise (stochastic gene expression)
    const noiseLevel = 1 - grn.noise_tolerance;
    for (const [id, expr] of moduleExpression.entries()) {
        const noise = (Math.random() - 0.5) * noiseLevel * 0.2;
        moduleExpression.set(id, clamp(expr + noise, 0.1, 2.0));
    }

    // Convert module IDs to types
    const typeExpression = new Map();
    for (const module of grn.modules) {
        const expr = moduleExpression.get(module.id) || 1.0;
        // Average if multiple modules of same type
        if (typeExpression.has(module.type)) {
            typeExpression.set(module.type, (typeExpression.get(module.type) + expr) / 2);
        } else {
            typeExpression.set(module.type, expr);
        }
    }

    // Set defaults for missing types
    const types = ['metabolism', 'growth', 'defense', 'reproduction', 'locomotion'];
    for (const type of types) {
        if (!typeExpression.has(type)) {
            typeExpression.set(type, 1.0);
        }
    }

    return typeExpression;
}

/**
 * Apply GRN expression to agent traits
 * Modulates effective traits based on gene expression levels
 */
export function applyGRNModulation(agent, expression) {
    // Store expression in agent for other systems to use
    agent.grn_expression = expression;

    // Metabolism modulation
    const metaExpr = expression.get('metabolism') || 1.0;
    agent.grn_metabolism_modifier = metaExpr;

    // Growth modulation (affects energy storage efficiency)
    const growthExpr = expression.get('growth') || 1.0;
    agent.grn_growth_modifier = growthExpr;

    // Defense modulation (affects flee response, immunity)
    const defenseExpr = expression.get('defense') || 1.0;
    agent.grn_defense_modifier = defenseExpr;

    // Reproduction modulation (affects reproductive threshold)
    const reproExpr = expression.get('reproduction') || 1.0;
    agent.grn_reproduction_modifier = reproExpr;

    // Locomotion modulation (affects motor efficiency)
    const locoExpr = expression.get('locomotion') || 1.0;
    agent.grn_locomotion_modifier = locoExpr;
}

/**
 * Mutate GRN structure and parameters
 */
export function mutateGRN(grn) {
    if (!grn) return createDefaultGRN();

    // Mutate module parameters
    for (const module of grn.modules) {
        if (randomBool(0.05)) {
            module.base_expression = clamp(
                module.base_expression + randomRange(-0.1, 0.1), 0.2, 1.0
            );
        }
        if (randomBool(0.03)) {
            module.temperature_response = clamp(
                module.temperature_response + randomRange(-0.1, 0.1), -1, 1
            );
        }
        if (randomBool(0.03)) {
            module.energy_response = clamp(
                module.energy_response + randomRange(-0.1, 0.1), -0.5, 0.5
            );
        }
        if (randomBool(0.03)) {
            module.density_response = clamp(
                module.density_response + randomRange(-0.1, 0.1), -0.5, 0.5
            );
        }
    }

    // Mutate regulatory connections
    for (const conn of grn.connections) {
        if (randomBool(0.05)) {
            conn.weight = clamp(conn.weight + randomRange(-0.2, 0.2), -1, 1);
        }
    }

    // Rare: Add new connection
    if (randomBool(0.02) && grn.modules.length > 1) {
        const from = randomInt(0, grn.modules.length - 1);
        let to = randomInt(0, grn.modules.length - 1);
        if (to === from) to = (to + 1) % grn.modules.length;

        grn.connections.push({
            from_module: from,
            to_module: to,
            weight: randomRange(-0.5, 0.5),
            delay: randomInt(0, 3)
        });
    }

    // Rare: Remove connection
    if (randomBool(0.02) && grn.connections.length > 1) {
        const idx = randomInt(0, grn.connections.length - 1);
        grn.connections.splice(idx, 1);
    }

    // Mutate global parameters
    if (randomBool(0.03)) {
        grn.regulation_strength = clamp(
            grn.regulation_strength + randomRange(-0.1, 0.1), 0.05, 0.8
        );
    }
    if (randomBool(0.03)) {
        grn.noise_tolerance = clamp(
            grn.noise_tolerance + randomRange(-0.05, 0.05), 0.05, 0.5
        );
    }

    return grn;
}

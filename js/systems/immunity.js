/**
 * Immunity System
 *
 * Implements a multi-layered immune system based on evolutionary principles:
 *
 * 1. INNATE IMMUNITY (Non-specific, fast)
 *    - Baseline resistance to all pathogens
 *    - Inflammation response (metabolic cost)
 *    - Fever capability (increases resistance but causes self-damage)
 *    - Complement system (pathogen opsonization)
 *    - Pattern recognition (PAMPs - Pathogen-Associated Molecular Patterns)
 *
 * 2. ADAPTIVE IMMUNITY (Specific, slow, memory-based)
 *    - CRISPR-like memory formation from survived infections
 *    - Cross-immunity through marker matching
 *    - Memory inheritance (reduced strength)
 *    - Affinity maturation (memory improves with exposure)
 *
 * 3. MHC DIVERSITY (Major Histocompatibility Complex)
 *    - Multiple loci with high polymorphism
 *    - Heterozygote advantage (more pathogen coverage)
 *    - Frequency-dependent selection maintains diversity
 *
 * 4. IMMUNE TRADE-OFFS
 *    - Autoimmunity risk at high immune investment
 *    - Immunopathology from excessive response
 *    - Tolerance vs. resistance strategies
 *    - Immune senescence with age
 *
 * 5. MATERNAL IMMUNITY
 *    - Passive antibody transfer to offspring
 *    - Temporary protection during early life
 *    - Memory priming from parent
 */

import { CONFIG } from '../config.js';
import { state, logEvent } from '../state.js';
import { generateUUID, randomInt, randomRange, clamp } from '../utils/math.js';

// ============================================================================
// INNATE IMMUNITY
// ============================================================================

/**
 * Create default innate immunity for a new agent
 */
export function createDefaultInnateImmunity() {
    return {
        // Baseline non-specific resistance
        baseline_resistance: randomRange(0.1, 0.3),

        // Inflammation state
        inflammation_active: false,
        inflammation_level: 0,

        // Fever capability
        fever_capable: Math.random() < 0.7,
        fever_active: false,
        fever_intensity: 0,

        // Complement system efficiency
        complement_efficiency: randomRange(0.2, 0.5),

        // Pattern recognition receptors (recognize different pathogen types)
        pattern_receptors: {
            lipid: randomRange(0.2, 0.6),      // Bacterial cell walls
            flagellin: randomRange(0.2, 0.6),  // Bacterial flagella
            dsRNA: randomRange(0.2, 0.6),      // Viral genetic material
            peptidoglycan: randomRange(0.2, 0.6) // Bacterial structure
        },

        // Immune investment level (trade-off with growth/reproduction)
        investment_level: randomRange(0.3, 0.7)
    };
}

/**
 * Process innate immunity for an agent
 */
export function processInnateImmunity(agent, dt) {
    const innate = agent.genome.innate_immunity;
    if (!innate) return;

    // Update inflammation
    if (innate.inflammation_active) {
        // Inflammation costs energy
        agent.energy -= CONFIG.INNATE_INFLAMMATION_COST * innate.inflammation_level * dt;

        // Inflammation naturally subsides
        innate.inflammation_level = Math.max(0, innate.inflammation_level - 0.01 * dt);
        if (innate.inflammation_level <= 0) {
            innate.inflammation_active = false;
        }
    }

    // Update fever
    if (innate.fever_active) {
        // Fever provides resistance bonus but causes self-damage
        agent.energy -= CONFIG.INNATE_FEVER_DAMAGE * innate.fever_intensity * dt;

        // Fever naturally subsides faster than inflammation
        innate.fever_intensity = Math.max(0, innate.fever_intensity - 0.02 * dt);
        if (innate.fever_intensity <= 0) {
            innate.fever_active = false;
        }
    }

    // Check for autoimmunity (high investment = risk of self-attack)
    if (innate.investment_level > CONFIG.AUTOIMMUNITY_THRESHOLD) {
        const autoimmune_risk = (innate.investment_level - CONFIG.AUTOIMMUNITY_THRESHOLD) * 0.1;
        if (Math.random() < autoimmune_risk * dt) {
            agent.energy -= CONFIG.AUTOIMMUNITY_DAMAGE;
            logEvent('autoimmune_damage', { agent: agent.id });
        }
    }
}

/**
 * Trigger innate immune response to infection
 */
export function triggerInnateResponse(agent, pathogen) {
    const innate = agent.genome.innate_immunity;
    if (!innate) return { blocked: false, response_strength: 0 };

    let response_strength = innate.baseline_resistance;

    // Pattern recognition adds to response
    if (pathogen.patterns) {
        for (const [pattern, presence] of Object.entries(pathogen.patterns)) {
            if (presence && innate.pattern_receptors[pattern]) {
                response_strength += innate.pattern_receptors[pattern] * 0.2;
            }
        }
    }

    // Complement system contribution
    response_strength += innate.complement_efficiency * CONFIG.INNATE_COMPLEMENT_EFFICIENCY;

    // Activate inflammation
    innate.inflammation_active = true;
    innate.inflammation_level = Math.min(1, innate.inflammation_level + 0.3);

    // Consider fever if capable
    if (innate.fever_capable && response_strength < 0.5) {
        innate.fever_active = true;
        innate.fever_intensity = Math.min(1, innate.fever_intensity + 0.4);
        response_strength += CONFIG.INNATE_FEVER_BONUS;
    }

    // Check if innate immunity blocks the infection
    const blocked = Math.random() < response_strength * innate.investment_level;

    if (blocked) {
        logEvent('innate_immunity_blocked', {
            agent: agent.id,
            response_strength
        });
    }

    return { blocked, response_strength };
}

// ============================================================================
// MHC DIVERSITY SYSTEM
// ============================================================================

/**
 * Create default MHC (Major Histocompatibility Complex)
 */
export function createDefaultMHC() {
    const loci = [];
    for (let i = 0; i < CONFIG.MHC_LOCI_COUNT; i++) {
        loci.push({
            allele_a: randomInt(0, CONFIG.MHC_ALLELE_RANGE),
            allele_b: randomInt(0, CONFIG.MHC_ALLELE_RANGE)
        });
    }

    return {
        loci,
        // Cached heterozygosity calculation
        heterozygosity: calculateHeterozygosity(loci)
    };
}

/**
 * Calculate MHC heterozygosity (diversity)
 */
function calculateHeterozygosity(loci) {
    let heteroCount = 0;
    for (const locus of loci) {
        if (locus.allele_a !== locus.allele_b) {
            heteroCount++;
        }
    }
    return heteroCount / loci.length;
}

/**
 * Check if MHC can present a pathogen's antigens
 * More diverse MHC = better pathogen coverage
 */
export function checkMHCRecognition(agent, pathogen) {
    const mhc = agent.genome.mhc;
    if (!mhc) return { recognized: false, strength: 0 };

    // Each MHC allele can recognize certain pathogen markers
    let recognition_strength = 0;
    const pathogen_marker = pathogen.genome?.surface_markers?.[0] || pathogen.id;

    for (const locus of mhc.loci) {
        // Simple model: allele "recognizes" pathogens with markers close to its value
        const dist_a = Math.abs((locus.allele_a % 100) - (pathogen_marker % 100));
        const dist_b = Math.abs((locus.allele_b % 100) - (pathogen_marker % 100));

        // Recognition inversely proportional to distance
        if (dist_a < 20) recognition_strength += (20 - dist_a) / 20 * CONFIG.MHC_PATHOGEN_COVERAGE;
        if (dist_b < 20) recognition_strength += (20 - dist_b) / 20 * CONFIG.MHC_PATHOGEN_COVERAGE;
    }

    // Heterozygote advantage
    recognition_strength *= (1 + mhc.heterozygosity * CONFIG.MHC_HETEROZYGOTE_BONUS);

    const recognized = recognition_strength > 0.1;

    return { recognized, strength: Math.min(1, recognition_strength) };
}

/**
 * Inherit MHC from parents (Mendelian inheritance)
 */
export function inheritMHC(parentA, parentB) {
    const mhcA = parentA.genome.mhc;
    const mhcB = parentB?.genome?.mhc;

    if (!mhcA) return createDefaultMHC();
    if (!mhcB) {
        // Asexual reproduction - copy with possible mutation
        return mutateMHC(JSON.parse(JSON.stringify(mhcA)));
    }

    // Sexual reproduction - Mendelian inheritance
    const childLoci = [];
    for (let i = 0; i < CONFIG.MHC_LOCI_COUNT; i++) {
        const locusA = mhcA.loci[i] || { allele_a: randomInt(0, CONFIG.MHC_ALLELE_RANGE), allele_b: randomInt(0, CONFIG.MHC_ALLELE_RANGE) };
        const locusB = mhcB.loci[i] || { allele_a: randomInt(0, CONFIG.MHC_ALLELE_RANGE), allele_b: randomInt(0, CONFIG.MHC_ALLELE_RANGE) };

        // Child gets one allele from each parent
        childLoci.push({
            allele_a: Math.random() < 0.5 ? locusA.allele_a : locusA.allele_b,
            allele_b: Math.random() < 0.5 ? locusB.allele_a : locusB.allele_b
        });
    }

    const mhc = {
        loci: childLoci,
        heterozygosity: calculateHeterozygosity(childLoci)
    };

    return mutateMHC(mhc);
}

/**
 * Mutate MHC alleles (rare, high polymorphism maintained by selection)
 */
function mutateMHC(mhc) {
    for (const locus of mhc.loci) {
        // MHC has high mutation rate due to balancing selection
        if (Math.random() < 0.01) {
            locus.allele_a = randomInt(0, CONFIG.MHC_ALLELE_RANGE);
        }
        if (Math.random() < 0.01) {
            locus.allele_b = randomInt(0, CONFIG.MHC_ALLELE_RANGE);
        }
    }
    mhc.heterozygosity = calculateHeterozygosity(mhc.loci);
    return mhc;
}

// ============================================================================
// ADAPTIVE IMMUNITY (CRISPR-based)
// ============================================================================

/**
 * Process immunity for all agents
 */
export function processImmunity(agents, dt) {
    for (const agent of agents) {
        if (!agent.alive) continue;

        // Process innate immunity
        if (agent.genome.innate_immunity) {
            processInnateImmunity(agent, dt);
        }

        // Process adaptive immunity
        if (agent.genome.crispr?.active) {
            updateCRISPRSystem(agent, dt);

            // Check for memory formation from current infection
            if (agent.infection) {
                tryFormMemory(agent);
            }
        }

        // Process immune senescence
        processImmuneSenescence(agent, dt);

        // Update maternal immunity decay
        if (agent.maternal_immunity) {
            updateMaternalImmunity(agent, dt);
        }
    }
}

/**
 * Update CRISPR system for an agent
 */
function updateCRISPRSystem(agent, dt) {
    const crispr = agent.genome.crispr;
    if (!crispr) return;

    // Memory decay over time (affected by age/senescence)
    if (crispr.memory && crispr.memory.length > 0) {
        const senescence_factor = getImmuneSenescenceFactor(agent);

        crispr.memory = crispr.memory.filter(mem => {
            mem.age += dt;
            // Older agents lose memory faster
            mem.strength -= CONFIG.CRISPR_MEMORY_DECAY * dt * (1 + senescence_factor);
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
 * Get immune senescence factor based on age
 */
function getImmuneSenescenceFactor(agent) {
    if (!agent.age || agent.age < CONFIG.IMMUNE_SENESCENCE_AGE) {
        return 0;
    }

    const age_past_threshold = agent.age - CONFIG.IMMUNE_SENESCENCE_AGE;
    return Math.min(0.5, age_past_threshold * CONFIG.IMMUNE_SENESCENCE_RATE);
}

/**
 * Process immune senescence effects
 */
function processImmuneSenescence(agent, dt) {
    const senescence = getImmuneSenescenceFactor(agent);
    if (senescence <= 0) return;

    // Reduce CRISPR efficiency with age
    if (agent.genome.crispr) {
        agent.genome.crispr.efficiency *= (1 - senescence * 0.001 * dt);
    }

    // Reduce innate immunity with age
    if (agent.genome.innate_immunity) {
        agent.genome.innate_immunity.investment_level *= (1 - senescence * 0.0005 * dt);
    }
}

/**
 * Try to form memory from current infection (with affinity maturation)
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
        // AFFINITY MATURATION: memory improves with repeated exposure
        const maturation_boost = CONFIG.AFFINITY_MATURATION_RATE * (1 + existingMemory.encounters * 0.1);
        existingMemory.strength = Math.min(1, existingMemory.strength + maturation_boost);
        existingMemory.affinity = Math.min(1, (existingMemory.affinity || 0.5) + 0.05);
        existingMemory.encounters++;
        return;
    }

    // Try to form new memory
    if (Math.random() > crispr.efficiency * CONFIG.CRISPR_MEMORY_FORMATION_RATE) {
        return;
    }

    // Check memory slots - implement competition for slots
    crispr.memory = crispr.memory || [];
    if (crispr.memory.length >= CONFIG.CRISPR_MEMORY_SLOTS) {
        // Remove weakest memory (competition for limited slots)
        crispr.memory.sort((a, b) => {
            // Consider both strength and affinity
            const score_a = a.strength * (a.affinity || 0.5);
            const score_b = b.strength * (b.affinity || 0.5);
            return score_a - score_b;
        });
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
        affinity: 0.3 + Math.random() * 0.2, // Initial affinity
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
 * Check immunity against a virus (multi-layered defense)
 * Returns: { immune: boolean, strength: number, layer: string }
 */
export function checkImmunity(agent, virus) {
    // Layer 1: Maternal immunity (temporary passive protection)
    if (agent.maternal_immunity?.active) {
        const maternal_result = checkMaternalImmunity(agent, virus);
        if (maternal_result.immune) {
            return { ...maternal_result, layer: 'maternal' };
        }
    }

    // Layer 2: Innate immunity (non-specific)
    const innate_result = triggerInnateResponse(agent, {
        id: virus.id,
        genome: virus.genome,
        patterns: {
            dsRNA: true, // Viruses typically have dsRNA
            lipid: Math.random() < 0.3 // Some have lipid envelope
        }
    });

    if (innate_result.blocked) {
        return { immune: true, strength: innate_result.response_strength, layer: 'innate' };
    }

    // Layer 3: MHC recognition (bridges innate and adaptive)
    const mhc_result = checkMHCRecognition(agent, virus);
    let mhc_bonus = mhc_result.recognized ? mhc_result.strength * 0.3 : 0;

    // Layer 4: Adaptive immunity (CRISPR)
    const crispr = agent.genome.crispr;
    if (!crispr || !crispr.active) {
        return { immune: false, strength: mhc_bonus, layer: 'none' };
    }

    if (!crispr.memory || crispr.memory.length === 0) {
        return { immune: false, strength: mhc_bonus, layer: 'none' };
    }

    // Check each memory
    for (const memory of crispr.memory) {
        // Direct match
        if (memory.virus_genome_id === virus.genome.id) {
            const immuneChance = memory.strength * memory.affinity * crispr.efficiency + mhc_bonus;

            // Check for immunopathology (excessive response)
            if (immuneChance > CONFIG.IMMUNOPATHOLOGY_THRESHOLD) {
                agent.energy -= CONFIG.IMMUNOPATHOLOGY_DAMAGE;
                logEvent('immunopathology', { agent: agent.id });
            }

            if (Math.random() < immuneChance) {
                // Strengthen memory on successful defense (affinity maturation)
                memory.strength = Math.min(1, memory.strength + CONFIG.AFFINITY_MATURATION_RATE);
                memory.affinity = Math.min(1, (memory.affinity || 0.5) + 0.02);
                memory.encounters++;
                agent.recent_defense = true;

                return { immune: true, strength: memory.strength, layer: 'adaptive' };
            }
        }

        // Marker match (cross-immunity)
        if (virus.genome.surface_markers.includes(memory.virus_marker)) {
            const crossImmunity = memory.strength * crispr.efficiency * 0.5 + mhc_bonus;
            if (Math.random() < crossImmunity) {
                memory.encounters++;
                agent.recent_defense = true;

                return { immune: true, strength: memory.strength * 0.5, layer: 'cross-immunity' };
            }
        }
    }

    // Check virus evasion
    if (Math.random() < virus.genome.crispr_evasion) {
        return { immune: false, strength: 0, layer: 'evaded' };
    }

    return { immune: false, strength: mhc_bonus, layer: 'none' };
}

// ============================================================================
// MATERNAL IMMUNITY
// ============================================================================

/**
 * Transfer maternal immunity to offspring
 */
export function transferMaternalImmunity(parent, child) {
    const maternal_immunity = {
        active: true,
        start_tick: state.tick,
        duration: CONFIG.MATERNAL_ANTIBODY_DURATION,
        strength: CONFIG.MATERNAL_IMMUNITY_STRENGTH,
        // Copy strongest memories from parent
        inherited_memories: [],
        // Track protection level
        protection_level: 1.0
    };

    // Transfer top memories from parent
    const parentCrispr = parent.genome.crispr;
    if (parentCrispr?.memory?.length > 0) {
        const sortedMemories = [...parentCrispr.memory]
            .sort((a, b) => (b.strength * (b.affinity || 0.5)) - (a.strength * (a.affinity || 0.5)));

        for (let i = 0; i < Math.min(CONFIG.MATERNAL_MEMORY_TRANSFER_COUNT, sortedMemories.length); i++) {
            maternal_immunity.inherited_memories.push({
                virus_marker: sortedMemories[i].virus_marker,
                strength: sortedMemories[i].strength * 0.7 // Reduced strength
            });
        }
    }

    // Transfer innate immunity priming
    if (parent.genome.innate_immunity) {
        maternal_immunity.innate_priming = parent.genome.innate_immunity.investment_level * 0.3;
    }

    child.maternal_immunity = maternal_immunity;

    logEvent('maternal_immunity_transferred', {
        parent: parent.id,
        child: child.id,
        memories: maternal_immunity.inherited_memories.length
    });
}

/**
 * Check maternal immunity against a virus
 */
function checkMaternalImmunity(agent, virus) {
    const maternal = agent.maternal_immunity;
    if (!maternal || !maternal.active) {
        return { immune: false, strength: 0 };
    }

    // Check inherited memories
    for (const mem of maternal.inherited_memories) {
        if (virus.genome.surface_markers.includes(mem.virus_marker)) {
            const immune_chance = mem.strength * maternal.protection_level * maternal.strength;
            if (Math.random() < immune_chance) {
                return { immune: true, strength: mem.strength };
            }
        }
    }

    // General passive protection
    const passive_protection = maternal.protection_level * maternal.strength * 0.3;
    if (Math.random() < passive_protection) {
        return { immune: true, strength: passive_protection };
    }

    return { immune: false, strength: 0 };
}

/**
 * Update maternal immunity (decays over time)
 */
function updateMaternalImmunity(agent, dt) {
    const maternal = agent.maternal_immunity;
    if (!maternal || !maternal.active) return;

    const age = state.tick - maternal.start_tick;

    if (age >= maternal.duration) {
        // Maternal immunity has expired
        maternal.active = false;
        logEvent('maternal_immunity_expired', { agent: agent.id });
        return;
    }

    // Gradual decay
    const decay_progress = age / maternal.duration;
    maternal.protection_level = 1 - decay_progress;
}

// ============================================================================
// TOLERANCE vs RESISTANCE
// ============================================================================

/**
 * Check if agent should use tolerance strategy instead of resistance
 * Tolerance: Accept infection but minimize damage (saves energy)
 */
export function shouldTolerate(agent, infection_severity) {
    const innate = agent.genome.innate_immunity;
    if (!innate) return false;

    // Low severity infections might be tolerated
    if (infection_severity < 0.3) {
        // Trade-off: tolerance saves energy but allows infection to persist
        const energy_ratio = agent.energy / CONFIG.INITIAL_ENERGY;

        // Low energy = prefer tolerance to save resources
        if (energy_ratio < 0.4) {
            return Math.random() < CONFIG.TOLERANCE_BENEFIT;
        }
    }

    return false;
}

// ============================================================================
// INFECTION MANAGEMENT
// ============================================================================

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

// ============================================================================
// INHERITANCE
// ============================================================================

/**
 * Inherit immunity from parent(s)
 */
export function inheritImmunity(parent, child, parentB = null) {
    // Inherit CRISPR (adaptive immunity)
    inheritCRISPR(parent, child);

    // Inherit MHC (sexual inheritance if two parents)
    child.genome.mhc = inheritMHC(parent, parentB);

    // Inherit innate immunity traits
    inheritInnateImmunity(parent, child, parentB);

    // Transfer maternal immunity (passive protection)
    transferMaternalImmunity(parent, child);

    // Inherit lysogenic viruses
    if (parent.lysogenic_viruses) {
        child.lysogenic_viruses = parent.lysogenic_viruses.map(v => ({
            ...v,
            id: generateUUID()
        }));
    }
}

/**
 * Inherit CRISPR system from parent
 */
function inheritCRISPR(parent, child) {
    if (!parent.genome.crispr?.memory) return;

    if (!child.genome.crispr) {
        child.genome.crispr = {
            active: true,
            efficiency: 0.3,
            memory: []
        };
    }

    // Copy some memories (with reduced strength - not full affinity maturation)
    for (const memory of parent.genome.crispr.memory) {
        if (Math.random() < CONFIG.CRISPR_INHERITANCE_RATE) {
            child.genome.crispr.memory.push({
                id: generateUUID(),
                virus_genome_id: memory.virus_genome_id,
                virus_marker: memory.virus_marker,
                formed_tick: state.tick,
                strength: memory.strength * 0.5, // Reduced strength
                affinity: (memory.affinity || 0.5) * 0.7, // Reduced affinity
                age: 0,
                encounters: 0,
                inherited: true
            });
        }
    }
}

/**
 * Inherit innate immunity traits
 */
function inheritInnateImmunity(parentA, child, parentB = null) {
    const innateA = parentA.genome.innate_immunity;
    const innateB = parentB?.genome?.innate_immunity;

    if (!innateA) {
        child.genome.innate_immunity = createDefaultInnateImmunity();
        return;
    }

    // Blend traits (with mutation)
    const blend = (valA, valB, mutationStrength = 0.1) => {
        const base = valB !== undefined ? (valA + valB) / 2 : valA;
        const mutation = (Math.random() - 0.5) * 2 * mutationStrength;
        return clamp(base + mutation, 0, 1);
    };

    child.genome.innate_immunity = {
        baseline_resistance: blend(
            innateA.baseline_resistance,
            innateB?.baseline_resistance
        ),
        inflammation_active: false,
        inflammation_level: 0,
        fever_capable: innateB
            ? (Math.random() < 0.5 ? innateA.fever_capable : innateB.fever_capable)
            : innateA.fever_capable,
        fever_active: false,
        fever_intensity: 0,
        complement_efficiency: blend(
            innateA.complement_efficiency,
            innateB?.complement_efficiency
        ),
        pattern_receptors: {
            lipid: blend(
                innateA.pattern_receptors.lipid,
                innateB?.pattern_receptors?.lipid
            ),
            flagellin: blend(
                innateA.pattern_receptors.flagellin,
                innateB?.pattern_receptors?.flagellin
            ),
            dsRNA: blend(
                innateA.pattern_receptors.dsRNA,
                innateB?.pattern_receptors?.dsRNA
            ),
            peptidoglycan: blend(
                innateA.pattern_receptors.peptidoglycan,
                innateB?.pattern_receptors?.peptidoglycan
            )
        },
        investment_level: blend(
            innateA.investment_level,
            innateB?.investment_level
        )
    };
}

// ============================================================================
// STATISTICS & UTILITIES
// ============================================================================

/**
 * Get immunity statistics
 */
export function getImmunityStats() {
    let agentsWithCRISPR = 0;
    let agentsWithInnate = 0;
    let totalMemories = 0;
    let avgEfficiency = 0;
    let avgInvestment = 0;
    let avgHeterozygosity = 0;
    let immuneResponses = 0;
    let maternalProtected = 0;

    for (const agent of state.agents) {
        if (!agent.alive) continue;

        if (agent.genome.crispr?.active) {
            agentsWithCRISPR++;
            avgEfficiency += agent.genome.crispr.efficiency;
            totalMemories += agent.genome.crispr.memory?.length || 0;
        }

        if (agent.genome.innate_immunity) {
            agentsWithInnate++;
            avgInvestment += agent.genome.innate_immunity.investment_level;
        }

        if (agent.genome.mhc) {
            avgHeterozygosity += agent.genome.mhc.heterozygosity;
        }

        if (agent.infections_survived > 0) {
            immuneResponses += agent.infections_survived;
        }

        if (agent.maternal_immunity?.active) {
            maternalProtected++;
        }
    }

    const aliveCount = state.agents.filter(a => a.alive).length;

    return {
        agentsWithCRISPR,
        agentsWithInnate,
        avgEfficiency: agentsWithCRISPR > 0 ? avgEfficiency / agentsWithCRISPR : 0,
        avgInvestment: agentsWithInnate > 0 ? avgInvestment / agentsWithInnate : 0,
        avgHeterozygosity: aliveCount > 0 ? avgHeterozygosity / aliveCount : 0,
        totalMemories,
        avgMemoriesPerAgent: agentsWithCRISPR > 0 ? totalMemories / agentsWithCRISPR : 0,
        immuneResponses,
        maternalProtected
    };
}

/**
 * Initialize complete immunity system for an agent
 */
export function initImmunity(agent) {
    // Initialize CRISPR (adaptive immunity)
    if (!agent.genome.crispr) {
        agent.genome.crispr = {
            active: Math.random() < 0.3, // 30% chance to have CRISPR
            efficiency: 0.2 + Math.random() * 0.4,
            memory: []
        };
    }

    // Initialize innate immunity
    if (!agent.genome.innate_immunity) {
        agent.genome.innate_immunity = createDefaultInnateImmunity();
    }

    // Initialize MHC
    if (!agent.genome.mhc) {
        agent.genome.mhc = createDefaultMHC();
    }

    // Initialize immunity tracking
    agent.infections_survived = agent.infections_survived || 0;
}

/**
 * Initialize CRISPR system for an agent (legacy compatibility)
 */
export function initCRISPR(agent) {
    initImmunity(agent);
}

/**
 * Boost immunity (for debugging/testing)
 */
export function boostImmunity(agent, amount = 0.1) {
    initImmunity(agent);

    // Boost CRISPR
    agent.genome.crispr.active = true;
    agent.genome.crispr.efficiency = Math.min(1, agent.genome.crispr.efficiency + amount);

    // Boost innate immunity
    agent.genome.innate_immunity.investment_level = Math.min(1,
        agent.genome.innate_immunity.investment_level + amount
    );
    agent.genome.innate_immunity.baseline_resistance = Math.min(1,
        agent.genome.innate_immunity.baseline_resistance + amount
    );
}

/**
 * Add artificial immunity memory
 */
export function addArtificialImmunity(agent, virusMarker) {
    initImmunity(agent);

    agent.genome.crispr.memory = agent.genome.crispr.memory || [];

    agent.genome.crispr.memory.push({
        id: generateUUID(),
        virus_genome_id: virusMarker,
        virus_marker: virusMarker,
        formed_tick: state.tick,
        strength: 0.8,
        affinity: 0.9, // High affinity for artificial immunity
        age: 0,
        encounters: 0,
        artificial: true
    });
}

/**
 * Calculate total immune fitness contribution
 */
export function calculateImmuneFitness(agent) {
    let fitness = 0;

    // CRISPR contribution
    if (agent.genome.crispr?.active) {
        fitness += agent.genome.crispr.efficiency * 0.3;
        fitness += (agent.genome.crispr.memory?.length || 0) * 0.05;
    }

    // Innate immunity contribution
    if (agent.genome.innate_immunity) {
        fitness += agent.genome.innate_immunity.baseline_resistance * 0.2;
        fitness += agent.genome.innate_immunity.investment_level * 0.2;
    }

    // MHC diversity contribution
    if (agent.genome.mhc) {
        fitness += agent.genome.mhc.heterozygosity * 0.3;
    }

    // Survival history bonus
    fitness += Math.min(0.5, (agent.infections_survived || 0) * 0.1);

    return Math.min(1, fitness);
}

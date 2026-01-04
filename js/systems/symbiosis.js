/**
 * Symbiosis System
 *
 * Handles cross-species mutualistic relationships:
 * - Symbiotic bond formation
 * - Benefit types (energy, protection, mobility, sensing, digestion)
 * - Bond maintenance and dissolution
 * - Endosymbiosis mechanics
 */

import { CONFIG } from '../config.js';
import { state, logEvent } from '../state.js';
import { vec, distance } from '../utils/math.js';
import { isSameSpecies, geneticDistance } from '../core/genome.js';

/**
 * Benefit types for symbiosis
 */
export const SYMBIOSIS_BENEFITS = {
    ENERGY: 'energy',           // Energy production bonus
    PROTECTION: 'protection',   // Defense bonus
    MOBILITY: 'mobility',       // Movement bonus
    SENSING: 'sensing',         // Sensor range bonus
    DIGESTION: 'digestion'      // Resource extraction bonus
};

/**
 * Process all symbiotic relationships
 */
export function processSymbiosis(agents, spatialHash, dt) {
    // Update existing symbiotic bonds
    updateSymbioticBonds(dt);

    // Look for new symbiosis opportunities
    for (const agent of agents) {
        if (!agent.alive) continue;
        if (agent.symbiont || agent.host) continue; // Already in symbiosis

        // Check symbiosis preference
        if (agent.genome.social.symbiosis_preference < 0.3) continue;

        // Get nearby potential symbionts (different species only)
        const nearby = spatialHash.query(
            agent.position.x,
            agent.position.y,
            CONFIG.SYMBIOSIS_RANGE
        ).filter(other =>
            other !== agent &&
            other.alive &&
            !other.symbiont &&
            !other.host &&
            !isSameSpecies(agent.genome, other.genome) &&
            other.genome.social.symbiosis_preference >= 0.3
        );

        for (const other of nearby) {
            if (tryFormSymbiosis(agent, other, dt)) {
                break; // Only one symbiosis at a time
            }
        }
    }

    // Apply symbiotic benefits
    applySymbioticBenefits(dt);
}

/**
 * Try to form symbiosis between two agents
 */
function tryFormSymbiosis(agent, other, dt) {
    // Calculate compatibility
    const compatibility = calculateSymbiosisCompatibility(agent, other);
    if (compatibility < 0.3) return false;

    // Random chance based on compatibility and preferences
    const formChance = compatibility *
        agent.genome.social.symbiosis_preference *
        other.genome.social.symbiosis_preference * 0.01 * dt;

    if (Math.random() > formChance) return false;

    // Determine host/symbiont relationship (larger = host)
    const agentSize = agent.genome.nodes.length;
    const otherSize = other.genome.nodes.length;

    let host, symbiont;
    if (agentSize >= otherSize) {
        host = agent;
        symbiont = other;
    } else {
        host = other;
        symbiont = agent;
    }

    // Form the bond
    formSymbioticBond(host, symbiont);
    return true;
}

/**
 * Calculate symbiosis compatibility between two agents
 */
function calculateSymbiosisCompatibility(agent, other) {
    let compatibility = 0.5;

    // Genetic distance affects compatibility (too similar = no benefit, too different = incompatible)
    const genDist = geneticDistance(agent.genome, other.genome);
    if (genDist < 0.1) {
        compatibility *= 0.5; // Too similar
    } else if (genDist > 0.7) {
        compatibility *= 0.3; // Too different
    } else {
        compatibility *= 1 + (0.4 - Math.abs(genDist - 0.4)); // Sweet spot around 0.4
    }

    // Complementary abilities increase compatibility
    const agentBenefits = getAgentBenefits(agent);
    const otherBenefits = getAgentBenefits(other);

    // Count complementary benefits
    let complementaryCount = 0;
    for (const benefit of Object.values(SYMBIOSIS_BENEFITS)) {
        if (agentBenefits[benefit] !== otherBenefits[benefit]) {
            complementaryCount++;
        }
    }
    compatibility *= 1 + complementaryCount * 0.1;

    return Math.min(1, compatibility);
}

/**
 * Get what benefits an agent can provide
 */
function getAgentBenefits(agent) {
    return {
        [SYMBIOSIS_BENEFITS.ENERGY]: agent.genome.metabolism.efficiency > 0.6,
        [SYMBIOSIS_BENEFITS.PROTECTION]: agent.genome.nodes.length > 5,
        [SYMBIOSIS_BENEFITS.MOBILITY]: agent.genome.motors.length > 1,
        [SYMBIOSIS_BENEFITS.SENSING]: agent.genome.sensors.length > 1,
        [SYMBIOSIS_BENEFITS.DIGESTION]: agent.genome.metabolism.primary_source === 'heterotroph'
    };
}

/**
 * Form a symbiotic bond between host and symbiont
 */
function formSymbioticBond(host, symbiont) {
    // Determine benefit type based on symbiont abilities
    const benefitType = determineBenefitType(symbiont);

    // Set up relationship
    host.symbiont = symbiont.id;
    symbiont.host = host.id;

    // Store bond details
    const bond = {
        host_id: host.id,
        symbiont_id: symbiont.id,
        host: host,
        symbiont: symbiont,
        benefit_type: benefitType,
        strength: 0.3,
        age: 0,
        total_benefit: 0
    };

    state.symbioticPairs.push(bond);

    // Log event
    logEvent('symbiosis_formed', {
        host: host.id,
        symbiont: symbiont.id,
        benefitType: benefitType
    });

    // Visual event
    state.visualEvents.push({
        type: 'symbiosis_formed',
        position: {
            x: (host.position.x + symbiont.position.x) / 2,
            y: (host.position.y + symbiont.position.y) / 2
        },
        age: 0,
        duration: 40
    });
}

/**
 * Determine what benefit type a symbiont provides
 */
function determineBenefitType(symbiont) {
    const benefits = getAgentBenefits(symbiont);

    // Prioritize based on what symbiont is good at
    if (benefits[SYMBIOSIS_BENEFITS.ENERGY]) return SYMBIOSIS_BENEFITS.ENERGY;
    if (benefits[SYMBIOSIS_BENEFITS.SENSING]) return SYMBIOSIS_BENEFITS.SENSING;
    if (benefits[SYMBIOSIS_BENEFITS.MOBILITY]) return SYMBIOSIS_BENEFITS.MOBILITY;
    if (benefits[SYMBIOSIS_BENEFITS.DIGESTION]) return SYMBIOSIS_BENEFITS.DIGESTION;
    if (benefits[SYMBIOSIS_BENEFITS.PROTECTION]) return SYMBIOSIS_BENEFITS.PROTECTION;

    // Default to energy
    return SYMBIOSIS_BENEFITS.ENERGY;
}

/**
 * Update all symbiotic bonds
 */
function updateSymbioticBonds(dt) {
    state.symbioticPairs = state.symbioticPairs.filter(bond => {
        const host = bond.host;
        const symbiont = bond.symbiont;

        // Check if both alive
        if (!host.alive || !symbiont.alive) {
            dissolveSymbiosis(bond, 'death');
            return false;
        }

        // Check distance
        const dist = distance(host.position, symbiont.position);
        if (dist > CONFIG.SYMBIOSIS_RANGE * 3) {
            dissolveSymbiosis(bond, 'distance');
            return false;
        }

        // Maintenance cost
        const cost = CONFIG.SYMBIOSIS_MAINTENANCE_COST * dt;
        host.energy -= cost * 0.3;
        symbiont.energy -= cost * 0.7;

        // Check if either is too low energy
        if (host.energy < 10 || symbiont.energy < 10) {
            dissolveSymbiosis(bond, 'energy');
            return false;
        }

        // Age and strengthen bond
        bond.age += dt;
        bond.strength = Math.min(1, bond.strength + 0.0005 * dt);

        // Keep symbiont near host
        if (dist > CONFIG.SYMBIOSIS_RANGE) {
            const dx = host.position.x - symbiont.position.x;
            const dy = host.position.y - symbiont.position.y;
            const len = dist || 1;

            symbiont.velocity.x += (dx / len) * 0.5 * dt;
            symbiont.velocity.y += (dy / len) * 0.5 * dt;
        }

        return true;
    });
}

/**
 * Dissolve a symbiotic relationship
 */
function dissolveSymbiosis(bond, reason) {
    const host = bond.host;
    const symbiont = bond.symbiont;

    if (host) host.symbiont = null;
    if (symbiont) symbiont.host = null;

    // Clear bonuses
    if (host) {
        host.metabolism_efficiency_bonus = 0;
        host.sense_range_multiplier = 1;
        host.movement_bonus = 1;
    }

    logEvent('symbiosis_dissolved', {
        host: host?.id,
        symbiont: symbiont?.id,
        reason,
        age: bond.age
    });
}

/**
 * Apply benefits from symbiotic relationships
 */
function applySymbioticBenefits(dt) {
    for (const bond of state.symbioticPairs) {
        const host = bond.host;
        const symbiont = bond.symbiont;

        if (!host.alive || !symbiont.alive) continue;

        const benefitStrength = bond.strength * dt;

        switch (bond.benefit_type) {
            case SYMBIOSIS_BENEFITS.ENERGY:
                // Symbiont produces energy for host
                const energyBonus = symbiont.genome.metabolism.efficiency * benefitStrength * 2;
                host.energy += energyBonus;
                bond.total_benefit += energyBonus;
                break;

            case SYMBIOSIS_BENEFITS.PROTECTION:
                // Host provides protection bonus (handled in combat calculations)
                host.effective_mass_bonus = symbiont.genome.nodes.length * bond.strength * 0.5;
                break;

            case SYMBIOSIS_BENEFITS.MOBILITY:
                // Symbiont helps with movement
                host.movement_bonus = 1 + (symbiont.genome.motors.length * bond.strength * 0.2);
                break;

            case SYMBIOSIS_BENEFITS.SENSING:
                // Symbiont extends sensing range
                host.sense_range_multiplier = 1 + (symbiont.genome.sensors.length * bond.strength * 0.3);
                break;

            case SYMBIOSIS_BENEFITS.DIGESTION:
                // Symbiont improves resource extraction
                host.metabolism_efficiency_bonus = symbiont.genome.metabolism.efficiency * bond.strength * 0.5;
                break;
        }

        // Symbiont also benefits (gets some energy from host)
        symbiont.energy += host.energy * 0.01 * benefitStrength;
    }
}

/**
 * Get symbiosis statistics
 */
export function getSymbiosisStats() {
    let totalBonds = 0;
    let totalStrength = 0;
    let byBenefitType = {};

    for (const type of Object.values(SYMBIOSIS_BENEFITS)) {
        byBenefitType[type] = 0;
    }

    for (const bond of state.symbioticPairs) {
        if (bond.host?.alive && bond.symbiont?.alive) {
            totalBonds++;
            totalStrength += bond.strength;
            byBenefitType[bond.benefit_type]++;
        }
    }

    return {
        totalBonds,
        avgStrength: totalBonds > 0 ? totalStrength / totalBonds : 0,
        agentsInSymbiosis: totalBonds * 2,
        byBenefitType
    };
}

/**
 * Check if agent is in symbiosis
 */
export function isInSymbiosis(agent) {
    return agent.symbiont !== null || agent.host !== null;
}

/**
 * Get symbiotic partner of an agent
 */
export function getSymbioticPartner(agent) {
    if (agent.symbiont) {
        return state.agents.find(a => a.id === agent.symbiont);
    }
    if (agent.host) {
        return state.agents.find(a => a.id === agent.host);
    }
    return null;
}

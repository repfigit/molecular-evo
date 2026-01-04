/**
 * Horizontal Gene Transfer (HGT) System
 *
 * Handles non-vertical gene transfer:
 * - Conjugation (direct transfer between agents)
 * - Transformation (uptake from environment)
 * - DNA fragment management
 */

import { CONFIG } from '../config.js';
import { state, logEvent, addHGTEvent } from '../state.js';
import { vec, distance, generateUUID } from '../utils/math.js';
import { createPlasmid, clonePlasmid, mutatePlasmid, canAcceptPlasmid, PLASMID_TYPES } from '../core/plasmid.js';
import { isSameSpecies } from '../core/genome.js';

/**
 * Process all HGT events
 */
export function processHGT(agents, spatialHash, dt) {
    // Process conjugation
    processConjugation(agents, spatialHash, dt);

    // Process transformation
    processTransformation(agents, dt);

    // Update DNA fragments
    updateDNAFragments(dt);

    // Apply plasmid effects
    for (const agent of agents) {
        if (agent.alive) {
            applyPlasmidBonuses(agent);
        }
    }

    // Random plasmid loss
    processPlasmidLoss(agents, dt);
}

/**
 * Process conjugation (cell-to-cell transfer)
 */
function processConjugation(agents, spatialHash, dt) {
    for (const donor of agents) {
        if (!donor.alive) continue;
        if (!canDonate(donor)) continue;

        // Find nearby potential recipients
        const nearby = spatialHash.query(
            donor.position.x,
            donor.position.y,
            CONFIG.CONJUGATION_RANGE
        ).filter(other =>
            other !== donor &&
            other.alive &&
            canReceive(other)
        );

        for (const recipient of nearby) {
            tryConjugation(donor, recipient, dt);
        }
    }
}

/**
 * Check if agent can donate plasmids
 */
function canDonate(agent) {
    // Need plasmids to donate
    if (!agent.genome.hgt?.plasmids || agent.genome.hgt.plasmids.length === 0) {
        return false;
    }

    // Need minimum energy
    if (agent.energy < CONFIG.MIN_ENERGY_FOR_TRANSFER) {
        return false;
    }

    // Check for conjugative plasmids
    const hasConjugative = agent.genome.hgt.plasmids.some(
        p => p.type === PLASMID_TYPES.CONJUGATIVE
    );

    // Higher transfer rate with conjugative plasmids
    const baseRate = agent.genome.hgt.donor_willingness || 0.3;
    return hasConjugative ? baseRate * 2 : baseRate > 0.3;
}

/**
 * Check if agent can receive plasmids
 */
function canReceive(agent) {
    // Not at max plasmids
    const currentCount = agent.genome.hgt?.plasmids?.length || 0;
    if (currentCount >= CONFIG.MAX_PLASMIDS) return false;

    // Check recipient openness
    return (agent.genome.hgt.recipient_openness || 0.5) > 0.1;
}

/**
 * Attempt conjugation between donor and recipient
 */
function tryConjugation(donor, recipient, dt) {
    // Calculate transfer probability
    let probability = (donor.genome.hgt.donor_willingness || 0.3) * dt;

    // Bonus for same species
    if (isSameSpecies(donor.genome, recipient.genome)) {
        probability *= 1.5;
    }

    // Reduce by recipient resistance (inverse of openness)
    probability *= (recipient.genome.hgt.recipient_openness || 0.5);

    // Cooperative bonus - check if they have a cooperative link
    const hasCoopLink = donor.cooperative_links?.some(link =>
        link.partner?.id === recipient.id
    );
    if (hasCoopLink) {
        probability *= (1 + CONFIG.COOPERATIVE_HGT_BONUS);
    }

    if (Math.random() > probability) return;

    // Select plasmid to transfer
    const plasmid = selectPlasmidForTransfer(donor);
    if (!plasmid) return;

    // Check if recipient can accept
    if (!canAcceptPlasmid(recipient, plasmid)) return;

    // Perform transfer
    const transferredPlasmid = clonePlasmid(plasmid);

    // Possible mutation during transfer
    if (Math.random() < CONFIG.POINT_MUTATION_RATE) {
        mutatePlasmid(transferredPlasmid);
    }

    // Add to recipient
    recipient.genome.hgt.plasmids = recipient.genome.hgt.plasmids || [];
    recipient.genome.hgt.plasmids.push(transferredPlasmid);

    // Energy cost
    donor.energy -= CONFIG.HGT_ENERGY_COST || 5;

    // Update stats
    donor.successful_transfers++;
    plasmid.transferCount++;

    // Log event
    logEvent('conjugation', {
        donor: donor.id,
        recipient: recipient.id,
        plasmid: plasmid.type
    });

    // Visual event
    addHGTEvent('conjugation', donor, recipient, {
        plasmidType: plasmid.type
    });
}

/**
 * Select a plasmid from donor for transfer
 */
function selectPlasmidForTransfer(donor) {
    const plasmids = donor.genome.hgt.plasmids;
    if (!plasmids || plasmids.length === 0) return null;

    // Prefer conjugative plasmids
    const conjugative = plasmids.filter(p => p.type === PLASMID_TYPES.CONJUGATIVE);
    if (conjugative.length > 0 && Math.random() < 0.7) {
        return conjugative[Math.floor(Math.random() * conjugative.length)];
    }

    // Otherwise random
    return plasmids[Math.floor(Math.random() * plasmids.length)];
}

/**
 * Process transformation (uptake from environment)
 */
function processTransformation(agents, dt) {
    if (state.dnaFragments.length === 0) return;

    for (const agent of agents) {
        if (!agent.alive) continue;
        if ((agent.genome.hgt.recipient_openness || 0.5) < 0.1) continue;

        // Check for nearby DNA fragments
        const nearbyFragments = state.dnaFragments.filter(frag => {
            const dist = distance(agent.position, frag.position);
            return dist < CONFIG.TRANSFORMATION_RANGE;
        });

        for (const fragment of nearbyFragments) {
            tryTransformation(agent, fragment, dt);
        }
    }
}

/**
 * Attempt transformation (DNA uptake)
 */
function tryTransformation(agent, fragment, dt) {
    // Probability based on recipient openness
    const probability = (agent.genome.hgt.recipient_openness || 0.5) * CONFIG.TRANSFORMATION_RATE * dt;
    if (Math.random() > probability) return;

    // Check fragment type
    if (fragment.type === 'plasmid' && fragment.plasmid) {
        // Uptake plasmid
        if (canAcceptPlasmid(agent, fragment.plasmid)) {
            const uptakePlasmid = clonePlasmid(fragment.plasmid);
            agent.genome.hgt.plasmids = agent.genome.hgt.plasmids || [];
            agent.genome.hgt.plasmids.push(uptakePlasmid);

            logEvent('transformation', {
                agent: agent.id,
                fragmentType: 'plasmid',
                plasmidType: fragment.plasmid.type
            });

            // Remove fragment
            const idx = state.dnaFragments.indexOf(fragment);
            if (idx >= 0) state.dnaFragments.splice(idx, 1);
        }
    } else if (fragment.type === 'gene') {
        // Integrate gene fragment (simplified)
        integrateGeneFragment(agent, fragment);

        // Remove fragment
        const idx = state.dnaFragments.indexOf(fragment);
        if (idx >= 0) state.dnaFragments.splice(idx, 1);
    }

    // Visual event
    addHGTEvent('transformation', null, agent, {
        fragmentType: fragment.type
    });
}

/**
 * Integrate a gene fragment into agent's genome
 */
function integrateGeneFragment(agent, fragment) {
    // Simplified gene integration - modify a random trait
    const trait = fragment.trait;
    const value = fragment.value;

    switch (trait) {
        case 'metabolism':
            agent.genome.metabolism.efficiency = Math.min(1,
                agent.genome.metabolism.efficiency + value * 0.1
            );
            break;
        case 'social':
            agent.genome.social.cooperation_willingness = Math.min(1,
                agent.genome.social.cooperation_willingness + value * 0.1
            );
            break;
        case 'immunity':
            if (!agent.genome.crispr) {
                agent.genome.crispr = { active: true, efficiency: 0.3, memory: [] };
            }
            agent.genome.crispr.efficiency = Math.min(1,
                agent.genome.crispr.efficiency + value * 0.1
            );
            break;
    }

    logEvent('gene_integration', {
        agent: agent.id,
        trait,
        value
    });
}

/**
 * Update DNA fragments in environment
 */
function updateDNAFragments(dt) {
    state.dnaFragments = state.dnaFragments.filter(fragment => {
        // Decay
        fragment.integrity -= CONFIG.DNA_DECAY_RATE * dt;
        fragment.age += dt;

        // Diffusion
        fragment.position.x += (Math.random() - 0.5) * 2;
        fragment.position.y += (Math.random() - 0.5) * 2;

        // Keep in bounds
        fragment.position.x = Math.max(0, Math.min(CONFIG.WORLD_WIDTH, fragment.position.x));
        fragment.position.y = Math.max(0, Math.min(CONFIG.WORLD_HEIGHT, fragment.position.y));

        return fragment.integrity > 0;
    });
}

/**
 * Release DNA fragments when agent dies
 */
export function releaseDNAFragments(agent) {
    // Release plasmids
    if (agent.genome.hgt?.plasmids) {
        for (const plasmid of agent.genome.hgt.plasmids) {
            state.dnaFragments.push({
                id: generateUUID(),
                type: 'plasmid',
                plasmid: clonePlasmid(plasmid),
                position: vec(
                    agent.position.x + (Math.random() - 0.5) * 20,
                    agent.position.y + (Math.random() - 0.5) * 20
                ),
                integrity: 1.0,
                age: 0,
                source: agent.id
            });
        }
    }

    // Release gene fragments
    const fragmentCount = Math.min(CONFIG.FRAGMENT_COUNT, agent.genome.nodes.length);
    for (let i = 0; i < fragmentCount; i++) {
        const traits = ['metabolism', 'social', 'immunity'];
        state.dnaFragments.push({
            id: generateUUID(),
            type: 'gene',
            trait: traits[Math.floor(Math.random() * traits.length)],
            value: Math.random(),
            position: vec(
                agent.position.x + (Math.random() - 0.5) * 30,
                agent.position.y + (Math.random() - 0.5) * 30
            ),
            integrity: 0.8 + Math.random() * 0.2,
            age: 0,
            source: agent.id
        });
    }
}

/**
 * Process random plasmid loss
 */
function processPlasmidLoss(agents, dt) {
    for (const agent of agents) {
        if (!agent.alive) continue;
        if (!agent.genome.hgt?.plasmids) continue;

        agent.genome.hgt.plasmids = agent.genome.hgt.plasmids.filter(plasmid => {
            // Base loss rate
            let lossChance = CONFIG.PLASMID_LOSS_RATE * dt;

            // Lower loss for conjugative plasmids
            if (plasmid.type === PLASMID_TYPES.CONJUGATIVE) {
                lossChance *= 0.5;
            }

            // Higher loss when low energy
            if (agent.energy < agent.genome.metabolism.storage_capacity * 0.2) {
                lossChance *= 2;
            }

            return Math.random() > lossChance;
        });
    }
}

/**
 * Apply bonuses from plasmids
 */
function applyPlasmidBonuses(agent) {
    // Reset bonuses
    agent.plasmid_efficiency_bonus = 0;
    agent.plasmid_resistance_bonus = 0;
    agent.plasmid_speed_bonus = 0;
    agent.plasmid_sense_bonus = 0;

    if (!agent.genome.hgt?.plasmids) return;

    for (const plasmid of agent.genome.hgt.plasmids) {
        for (const gene of plasmid.genes) {
            switch (gene.name) {
                case 'efficiency_boost':
                    agent.plasmid_efficiency_bonus += gene.value;
                    break;
                case 'viral_resistance':
                    agent.plasmid_resistance_bonus += gene.value;
                    break;
                case 'speed_boost':
                    agent.plasmid_speed_bonus += gene.value;
                    break;
                case 'sensor_range':
                    agent.plasmid_sense_bonus += gene.value;
                    break;
            }
        }
    }
}

/**
 * Get HGT statistics
 */
export function getHGTStats() {
    let totalPlasmids = 0;
    let agentsWithPlasmids = 0;
    let plasmidTypes = {};

    for (const type of Object.values(PLASMID_TYPES)) {
        plasmidTypes[type] = 0;
    }

    for (const agent of state.agents) {
        if (!agent.alive) continue;
        const plasmids = agent.genome.hgt?.plasmids || [];
        if (plasmids.length > 0) {
            agentsWithPlasmids++;
            totalPlasmids += plasmids.length;
            for (const p of plasmids) {
                plasmidTypes[p.type] = (plasmidTypes[p.type] || 0) + 1;
            }
        }
    }

    return {
        totalPlasmids,
        agentsWithPlasmids,
        avgPlasmidsPerAgent: agentsWithPlasmids > 0 ? totalPlasmids / agentsWithPlasmids : 0,
        dnaFragments: state.dnaFragments.length,
        plasmidTypes
    };
}

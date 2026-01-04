/**
 * Character Displacement Renderer
 *
 * Visualizes niche-based character displacement:
 * - Niche overlap between species (as overlapping circles/gradients)
 * - Divergence pressure arrows showing selection direction
 * - Species actively displacing each other
 * - Competitively excluded species
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { isSameSpecies } from '../core/genome.js';
import { getSpeciesColor } from '../core/species.js';

// Character displacement tracking
const displacementData = new Map();  // species_pair -> { overlap, pressure, instances }
const nicheEstimates = new Map();    // species -> { foodType, size, position }

/**
 * Main character displacement render function
 */
export function renderCharacterDisplacement(ctx) {
    if (state.agents.length === 0) return;

    // Update displacement data
    updateDisplacementMetrics();

    // Render niche overlap zones
    renderNicheOverlapZones(ctx);

    // Render divergence pressure arrows on agents
    renderDivergencePressures(ctx);

    // Render displacement events/conflicts
    renderDisplacementConflicts(ctx);
}

/**
 * Update character displacement metrics for all species pairs
 */
function updateDisplacementMetrics() {
    displacementData.clear();
    nicheEstimates.clear();

    // Group agents by species
    const speciesMemberships = new Map();

    for (const agent of state.agents) {
        if (!agent.alive || !agent.genome.species_marker) continue;

        const speciesId = agent.genome.species_marker;
        if (!speciesMemberships.has(speciesId)) {
            speciesMemberships.set(speciesId, []);
        }
        speciesMemberships.get(speciesId).push(agent);
    }

    // Calculate niche estimates for each species
    for (const [speciesId, members] of speciesMemberships) {
        const estimate = calculateNicheEstimate(members);
        nicheEstimates.set(speciesId, estimate);
    }

    // Calculate pairwise displacement metrics
    const speciesIds = Array.from(speciesMemberships.keys());

    for (let i = 0; i < speciesIds.length; i++) {
        for (let j = i + 1; j < speciesIds.length; j++) {
            const speciesA = speciesIds[i];
            const speciesB = speciesIds[j];

            const membersA = speciesMemberships.get(speciesA);
            const membersB = speciesMemberships.get(speciesB);

            const metrics = calculateDisplacementMetrics(
                speciesA, speciesB,
                nicheEstimates.get(speciesA),
                nicheEstimates.get(speciesB),
                membersA, membersB
            );

            const key = `${speciesA}_${speciesB}`;
            displacementData.set(key, metrics);
        }
    }
}

/**
 * Calculate niche position and size for a species
 */
function calculateNicheEstimate(members) {
    if (members.length === 0) return null;

    // Sample members for efficiency
    const sample = members.slice(0, Math.min(20, members.length));

    // Calculate mean position
    let meanX = 0, meanY = 0;
    let totalSize = 0;
    let foodTypes = {};

    for (const agent of sample) {
        meanX += agent.position.x;
        meanY += agent.position.y;
        totalSize += agent.genome.nodes.length;

        const food = agent.genome.metabolism?.primary_food || 'unknown';
        foodTypes[food] = (foodTypes[food] || 0) + 1;
    }

    meanX /= sample.length;
    meanY /= sample.length;
    totalSize /= sample.length;

    // Most common food type
    const primaryFood = Object.keys(foodTypes).reduce((a, b) =>
        foodTypes[a] > foodTypes[b] ? a : b
    );

    return {
        x: meanX,
        y: meanY,
        size: totalSize,
        food: primaryFood,
        count: members.length,
        radius: 30 + totalSize * 0.5  // Niche hypervolume visualization radius
    };
}

/**
 * Calculate displacement metrics between two species
 */
function calculateDisplacementMetrics(speciesA, speciesB, nicheA, nicheB, membersA, membersB) {
    if (!nicheA || !nicheB) return null;

    // Calculate niche overlap
    const foodOverlap = nicheA.food === nicheB.food ? 1.0 : 0.3;
    const sizeOverlap = calculateSizeOverlap(nicheA.size, nicheB.size);
    const spatialOverlap = calculateSpatialOverlap(nicheA, nicheB);

    const totalOverlap = (foodOverlap + sizeOverlap + spatialOverlap) / 3;

    // Calculate displacement/divergence pressure
    // Pressure indicates how much selection is pushing these species apart
    const pressure = calculateDivergencePressure(
        membersA, membersB,
        nicheA, nicheB,
        totalOverlap
    );

    // Find instances where agents are in direct competition
    const conflicts = findDirectConflicts(membersA, membersB);

    return {
        nicheA,
        nicheB,
        overlap: totalOverlap,
        pressure,
        conflictCount: conflicts.length,
        isDisplacing: totalOverlap > 0.4 && pressure > 0.3,
        conflictInstances: conflicts
    };
}

/**
 * Calculate overlap in size niche between two species
 */
function calculateSizeOverlap(sizeA, sizeB) {
    const maxSize = Math.max(sizeA, sizeB);
    const minSize = Math.min(sizeA, sizeB);

    if (maxSize === 0) return 0;

    // Complete overlap if sizes are very similar, decreases with difference
    const sizeRatio = minSize / maxSize;
    return Math.max(0, 2 * sizeRatio - sizeRatio * sizeRatio);  // Quadratic decay
}

/**
 * Calculate spatial niche overlap
 */
function calculateSpatialOverlap(nicheA, nicheB) {
    const distance = Math.sqrt(
        Math.pow(nicheA.x - nicheB.x, 2) +
        Math.pow(nicheA.y - nicheB.y, 2)
    );

    const maxDistance = Math.max(nicheA.radius, nicheB.radius) * 2;

    if (distance >= maxDistance) return 0;

    // Overlap decreases with distance
    return Math.max(0, 1 - (distance / maxDistance));
}

/**
 * Calculate divergence pressure (selection pushing species apart)
 */
function calculateDivergencePressure(membersA, membersB, nicheA, nicheB, overlap) {
    if (overlap < 0.1) return 0;  // No overlap = no competition

    // Count competitive interactions
    let competitiveInteractions = 0;
    const checkDistance = CONFIG.COMPETITION_RANGE || 100;

    for (const agentA of membersA.slice(0, 10)) {
        for (const agentB of membersB.slice(0, 10)) {
            const dist = Math.sqrt(
                Math.pow(agentA.position.x - agentB.position.x, 2) +
                Math.pow(agentA.position.y - agentB.position.y, 2)
            );

            if (dist < checkDistance) {
                competitiveInteractions++;
            }
        }
    }

    // Normalize to 0-1 range
    const interactionIntensity = competitiveInteractions / (membersA.length * membersB.length);

    // Pressure is overlap * interaction intensity
    return overlap * Math.min(1, interactionIntensity * 10);
}

/**
 * Find direct competitive conflicts between agents of two species
 */
function findDirectConflicts(membersA, membersB) {
    const conflicts = [];
    const checkDistance = CONFIG.COMPETITION_RANGE || 100;

    for (const agentA of membersA) {
        for (const agentB of membersB) {
            const dist = Math.sqrt(
                Math.pow(agentA.position.x - agentB.position.x, 2) +
                Math.pow(agentA.position.y - agentB.position.y, 2)
            );

            if (dist < checkDistance) {
                conflicts.push({
                    agentA,
                    agentB,
                    distance: dist,
                    intensity: 1 - (dist / checkDistance)
                });
            }
        }
    }

    // Return only top conflicts to avoid performance issues
    return conflicts.sort((a, b) => b.intensity - a.intensity).slice(0, 50);
}

/**
 * Render niche overlap zones (Venn diagram-like visualization)
 */
function renderNicheOverlapZones(ctx) {
    for (const [key, metrics] of displacementData) {
        if (!metrics || !metrics.isDisplacing) continue;

        const nicheA = metrics.nicheA;
        const nicheB = metrics.nicheB;
        const overlap = metrics.overlap;

        // Draw niche circles for both species
        const colorA = getSpeciesColor(nicheA.speciesId || 0);
        const colorB = getSpeciesColor(nicheB.speciesId || 1);

        // Species A niche circle
        ctx.strokeStyle = colorA;
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nicheA.x, nicheA.y, nicheA.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Species B niche circle
        ctx.strokeStyle = colorB;
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nicheB.x, nicheB.y, nicheB.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Draw overlap gradient
        if (overlap > 0.1) {
            renderNicheOverlapGradient(ctx, nicheA, nicheB, overlap, colorA, colorB);
        }
    }
}

/**
 * Render gradient zone where niches overlap
 */
function renderNicheOverlapGradient(ctx, nicheA, nicheB, overlap, colorA, colorB) {
    const midX = (nicheA.x + nicheB.x) / 2;
    const midY = (nicheA.y + nicheB.y) / 2;

    // Create radial gradient for overlap zone
    const gradient = ctx.createRadialGradient(midX, midY, 0, midX, midY, 40);
    gradient.addColorStop(0, `rgba(255, 200, 0, ${overlap * 0.3})`);  // Yellow center
    gradient.addColorStop(1, `rgba(255, 200, 0, 0)`);  // Fade out

    ctx.fillStyle = gradient;
    ctx.fillRect(midX - 50, midY - 50, 100, 100);
}

/**
 * Render divergence pressure arrows on agents
 */
function renderDivergencePressures(ctx) {
    const pressureMap = new Map();  // agent -> pressure vector

    // Calculate pressure vectors for all agents
    for (const [key, metrics] of displacementData) {
        if (!metrics || metrics.overlap < 0.2) continue;

        const { nicheA, nicheB, pressure, conflictInstances } = metrics;

        // Apply pressure to agents in conflict
        for (const conflict of conflictInstances) {
            const { agentA, agentB, intensity } = conflict;

            // Pressure on A is away from B
            const pressureStrengthA = pressure * intensity;
            const dirA = {
                x: agentA.position.x - agentB.position.x,
                y: agentA.position.y - agentB.position.y
            };
            const lenA = Math.sqrt(dirA.x * dirA.x + dirA.y * dirA.y);
            if (lenA > 0) {
                dirA.x /= lenA;
                dirA.y /= lenA;

                if (!pressureMap.has(agentA)) {
                    pressureMap.set(agentA, { x: 0, y: 0, strength: 0 });
                }
                const pA = pressureMap.get(agentA);
                pA.x += dirA.x * pressureStrengthA;
                pA.y += dirA.y * pressureStrengthA;
                pA.strength += pressureStrengthA;
            }

            // Pressure on B is away from A
            const pressureStrengthB = pressure * intensity;
            const dirB = {
                x: agentB.position.x - agentA.position.x,
                y: agentB.position.y - agentA.position.y
            };
            const lenB = Math.sqrt(dirB.x * dirB.x + dirB.y * dirB.y);
            if (lenB > 0) {
                dirB.x /= lenB;
                dirB.y /= lenB;

                if (!pressureMap.has(agentB)) {
                    pressureMap.set(agentB, { x: 0, y: 0, strength: 0 });
                }
                const pB = pressureMap.get(agentB);
                pB.x += dirB.x * pressureStrengthB;
                pB.y += dirB.y * pressureStrengthB;
                pB.strength += pressureStrengthB;
            }
        }
    }

    // Render pressure arrows
    for (const [agent, pressure] of pressureMap) {
        if (!agent.alive || pressure.strength < 0.1) continue;

        const x = agent.position.x;
        const y = agent.position.y;
        const arrowLength = Math.min(15, pressure.strength * 20);
        const angle = Math.atan2(pressure.y, pressure.x);

        // Normalize for display
        const len = Math.sqrt(pressure.x * pressure.x + pressure.y * pressure.y);
        if (len === 0) continue;

        const normalizedX = (pressure.x / len) * arrowLength;
        const normalizedY = (pressure.y / len) * arrowLength;

        // Draw arrow
        ctx.strokeStyle = `rgba(255, 100, 100, ${Math.min(1, pressure.strength * 0.8)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + normalizedX, y + normalizedY);
        ctx.stroke();

        // Arrow head
        const headSize = 4;
        ctx.beginPath();
        ctx.moveTo(x + normalizedX, y + normalizedY);
        ctx.lineTo(
            x + normalizedX - Math.cos(angle - Math.PI / 6) * headSize,
            y + normalizedY - Math.sin(angle - Math.PI / 6) * headSize
        );
        ctx.moveTo(x + normalizedX, y + normalizedY);
        ctx.lineTo(
            x + normalizedX - Math.cos(angle + Math.PI / 6) * headSize,
            y + normalizedY - Math.sin(angle + Math.PI / 6) * headSize
        );
        ctx.stroke();
    }
}

/**
 * Render displacement conflicts between agents
 */
function renderDisplacementConflicts(ctx) {
    for (const [key, metrics] of displacementData) {
        if (!metrics || !metrics.isDisplacing) continue;

        // Render lines between conflicting agent pairs
        for (const conflict of metrics.conflictInstances.slice(0, 20)) {  // Limit for performance
            const { agentA, agentB, intensity } = conflict;

            ctx.strokeStyle = `rgba(255, 100, 0, ${intensity * 0.6})`;
            ctx.lineWidth = 1 + intensity * 2;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(agentA.position.x, agentA.position.y);
            ctx.lineTo(agentB.position.x, agentB.position.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

/**
 * Get character displacement summary statistics
 */
export function getCharacterDisplacementStats() {
    const displacingPairs = Array.from(displacementData.values())
        .filter(m => m && m.isDisplacing);

    const avgOverlap = displacingPairs.length > 0
        ? displacingPairs.reduce((sum, m) => sum + m.overlap, 0) / displacingPairs.length
        : 0;

    const avgPressure = displacingPairs.length > 0
        ? displacingPairs.reduce((sum, m) => sum + m.pressure, 0) / displacingPairs.length
        : 0;

    const totalConflicts = displacingPairs.reduce((sum, m) => sum + m.conflictCount, 0);

    return {
        displacingSpeciesPairs: displacingPairs.length,
        averageNicheOverlap: avgOverlap,
        averageDivergencePressure: avgPressure,
        totalConflictInstances: totalConflicts
    };
}

/**
 * Reset character displacement visualization state
 */
export function resetCharacterDisplacementRenderer() {
    displacementData.clear();
    nicheEstimates.clear();
}

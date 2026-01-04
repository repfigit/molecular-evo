/**
 * Metapopulation Renderer
 *
 * Visualizes spatially structured populations:
 * - Habitat patches with distinct visual characteristics
 * - Migration corridors with flow indicators
 * - Fst (genetic differentiation) as patch borders
 * - Source vs sink patch classification
 * - Local adaptation status of agents
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { getHabitatPatches, calculateFst, classifySourceSink } from '../systems/metapopulation.js';

// Color scheme for climate types
const CLIMATE_COLORS = {
    tropical: { fill: '#FF8C42', border: '#E65100' },
    temperate: { fill: '#76D76C', border: '#2E7D32' },
    cold: { fill: '#42A5F5', border: '#1565C0' },
    arid: { fill: '#FFD54F', border: '#F57F17' }
};

// Patch visualization state
let patchBorders = null;
let fstMatrix = null;
let sourceSinkData = null;

/**
 * Main metapopulation render function
 */
export function renderMetapopulation(ctx) {
    const patches = getHabitatPatches();
    if (patches.length === 0) return;

    // Render background patch regions
    renderPatchRegions(ctx, patches);

    // Render migration corridors
    renderMigrationCorridors(ctx, patches);

    // Render patch borders with Fst thickness
    renderPatchBorders(ctx, patches);

    // Render source/sink indicators
    renderSourceSinkIndicators(ctx, patches);

    // Render local adaptation status
    renderLocalAdaptationHalo(ctx);
}

/**
 * Render habitat patch regions with climate coloring
 */
function renderPatchRegions(ctx, patches) {
    for (const patch of patches) {
        const bounds = patch.bounds;
        const climate = patch.climate || 'temperate';
        const colors = CLIMATE_COLORS[climate] || CLIMATE_COLORS.temperate;

        // Draw semi-transparent patch background
        ctx.fillStyle = colors.fill;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.globalAlpha = 1.0;

        // Draw patch label
        renderPatchLabel(ctx, patch, colors);
    }
}

/**
 * Render patch name and population info
 */
function renderPatchLabel(ctx, patch, colors) {
    const x = patch.center.x;
    const y = patch.center.y - 40;

    // Background for label
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 60, y - 12, 120, 24);

    // Patch name
    ctx.fillStyle = colors.border;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${patch.name}`, x, y - 2);

    // Population count
    ctx.fillStyle = '#CCCCCC';
    ctx.font = '9px monospace';
    ctx.fillText(`Pop: ${patch.current_population}`, x, y + 10);
}

/**
 * Render migration corridors between patches
 */
function renderMigrationCorridors(ctx, patches) {
    const drawnCorridors = new Set();  // Prevent double-drawing

    for (const patch of patches) {
        if (!patch.migration_corridors) continue;

        for (const corridor of patch.migration_corridors) {
            const targetPatch = patches[corridor.target_patch];
            if (!targetPatch) continue;

            // Create unique key to avoid duplicates
            const key = [patch.id, targetPatch.id].sort().join('-');
            if (drawnCorridors.has(key)) continue;
            drawnCorridors.add(key);

            // Draw migration corridor
            const x1 = patch.center.x;
            const y1 = patch.center.y;
            const x2 = targetPatch.center.x;
            const y2 = targetPatch.center.y;

            // Corridor width proportional to migration rate
            const baseRate = corridor.base_rate;
            const barrierStrength = corridor.barrier_strength;
            const flowIntensity = baseRate * (1 - barrierStrength);

            // Draw corridor line
            ctx.strokeStyle = `rgba(150, 150, 180, ${flowIntensity * 0.6})`;
            ctx.lineWidth = 2 + flowIntensity * 4;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Draw barrier indicator if strong
            if (barrierStrength > 0.3) {
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                ctx.strokeStyle = `rgba(255, 100, 100, ${barrierStrength * 0.8})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(midX, midY, 15, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Draw flow arrows
            if (flowIntensity > 0.05) {
                renderFlowArrows(ctx, x1, y1, x2, y2, flowIntensity);
            }
        }
    }
}

/**
 * Render directional flow arrows along corridors
 */
function renderFlowArrows(ctx, x1, y1, x2, y2, intensity) {
    const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowCount = Math.floor(intensity * 3) + 1;
    const arrowLength = 8;

    for (let i = 0; i < arrowCount; i++) {
        const t = (i + 0.5) / arrowCount;
        const arrowX = x1 + (x2 - x1) * t;
        const arrowY = y1 + (y2 - y1) * t;

        // Animate arrows along corridor
        const phase = (state.tick + i * 100) % 500 / 500;
        const animatedX = x1 + (x2 - x1) * (t + (phase - 0.5) * 0.1);
        const animatedY = y1 + (y2 - y1) * (t + (phase - 0.5) * 0.1);

        ctx.fillStyle = `rgba(100, 200, 255, ${intensity * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(animatedX, animatedY);
        ctx.lineTo(
            animatedX - Math.cos(angle) * arrowLength,
            animatedY - Math.sin(angle) * arrowLength
        );
        ctx.arc(
            animatedX - Math.cos(angle) * arrowLength * 0.5,
            animatedY - Math.sin(angle) * arrowLength * 0.5,
            3, 0, Math.PI * 2
        );
        ctx.fill();
    }
}

/**
 * Render patch borders with thickness/color based on Fst
 */
function renderPatchBorders(ctx, patches) {
    // Calculate Fst matrix if needed
    if (!fstMatrix || state.tick % 100 === 0) {
        updateFstMatrix(patches);
    }

    for (const patch of patches) {
        const bounds = patch.bounds;
        const colors = CLIMATE_COLORS[patch.climate] || CLIMATE_COLORS.temperate;

        // Find maximum Fst for this patch (differentiation from neighbors)
        let maxFst = 0;
        if (fstMatrix && fstMatrix.get(patch.id)) {
            const fstValues = Array.from(fstMatrix.get(patch.id).values());
            maxFst = fstValues.length > 0 ? Math.max(...fstValues) : 0;
        }

        // Border thickness based on Fst
        const borderWidth = 1 + maxFst * 4;  // 1-5px depending on differentiation
        const borderAlpha = 0.4 + maxFst * 0.6;  // More opaque if highly differentiated

        ctx.strokeStyle = colors.border;
        ctx.globalAlpha = borderAlpha;
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.globalAlpha = 1.0;

        // Fst label
        if (maxFst > 0) {
            ctx.fillStyle = colors.border;
            ctx.font = '9px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(
                `Fst: ${maxFst.toFixed(3)}`,
                bounds.x + bounds.width - 5,
                bounds.y + 15
            );
        }
    }
}

/**
 * Update Fst matrix between all patch pairs
 */
function updateFstMatrix(patches) {
    fstMatrix = new Map();

    for (const patchA of patches) {
        const fstRow = new Map();

        for (const patchB of patches) {
            if (patchA.id === patchB.id) continue;

            // Get agents in each patch
            const agentsA = state.agents.filter(a =>
                a.alive && a.position.x >= patchA.bounds.x &&
                a.position.x < patchA.bounds.x + patchA.bounds.width &&
                a.position.y >= patchA.bounds.y &&
                a.position.y < patchA.bounds.y + patchA.bounds.height
            );

            const agentsB = state.agents.filter(a =>
                a.alive && a.position.x >= patchB.bounds.x &&
                a.position.x < patchB.bounds.x + patchB.bounds.width &&
                a.position.y >= patchB.bounds.y &&
                a.position.y < patchB.bounds.y + patchB.bounds.height
            );

            // Try to use imported Fst calculation
            let fst = 0;
            try {
                const result = calculateFst(patchA, patchB, agentsA.concat(agentsB));
                fst = result.fst || 0;
            } catch (e) {
                // Fallback to simple calculation
                fst = calculateSimpleFst(agentsA, agentsB);
            }

            fstRow.set(patchB.id, fst);
        }

        fstMatrix.set(patchA.id, fstRow);
    }
}

/**
 * Simple Fst calculation fallback
 */
function calculateSimpleFst(agentsA, agentsB) {
    if (agentsA.length < 2 || agentsB.length < 2) return 0;

    // Calculate simple genetic distance between patch means
    let totalDist = 0;
    let comparisons = 0;

    const sampleA = agentsA.slice(0, Math.min(5, agentsA.length));
    const sampleB = agentsB.slice(0, Math.min(5, agentsB.length));

    for (const a of sampleA) {
        for (const b of sampleB) {
            // Simple marker distance
            const dist = Math.abs(
                (a.genome.mhc?.heterozygosity || 0.5) -
                (b.genome.mhc?.heterozygosity || 0.5)
            );
            totalDist += dist;
            comparisons++;
        }
    }

    return comparisons > 0 ? Math.min(1, totalDist / comparisons) : 0;
}

/**
 * Render source vs sink patch indicators
 */
function renderSourceSinkIndicators(ctx, patches) {
    // Update classification if needed
    if (!sourceSinkData || state.tick % 50 === 0) {
        sourceSinkData = classifySourceSink(state.agents);
    }

    for (const patch of patches) {
        const classification = sourceSinkData.find(s => s.patchId === patch.id);
        if (!classification) continue;

        const x = patch.bounds.x + patch.bounds.width;
        const y = patch.bounds.y;

        // Draw indicator based on type
        if (classification.type === 'source') {
            // Green upward arrow for source
            renderSourceIndicator(ctx, x - 15, y + 15);
        } else if (classification.type === 'sink') {
            // Red downward arrow for sink
            renderSinkIndicator(ctx, x - 15, y + 15);
        }

        // Show lambda value
        ctx.fillStyle = classification.lambda > 1 ? '#00FF00' : '#FF0000';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`λ: ${classification.lambda.toFixed(2)}`, x - 3, y + 28);
    }
}

/**
 * Render source indicator (upward arrow)
 */
function renderSourceIndicator(ctx, x, y) {
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.beginPath();
    ctx.moveTo(x, y - 8);  // Top point
    ctx.lineTo(x - 5, y);  // Bottom left
    ctx.lineTo(x + 5, y);  // Bottom right
    ctx.closePath();
    ctx.fill();

    // Pulse effect
    const pulse = Math.sin(state.tick * 0.1) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(0, 255, 0, ${pulse})`;
    ctx.lineWidth = 1;
    ctx.stroke();
}

/**
 * Render sink indicator (downward arrow)
 */
function renderSinkIndicator(ctx, x, y) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.moveTo(x, y + 8);  // Bottom point
    ctx.lineTo(x - 5, y);  // Top left
    ctx.lineTo(x + 5, y);  // Top right
    ctx.closePath();
    ctx.fill();

    // Pulse effect
    const pulse = Math.sin(state.tick * 0.1) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;
    ctx.lineWidth = 1;
    ctx.stroke();
}

/**
 * Render local adaptation halo around agents
 */
function renderLocalAdaptationHalo(ctx) {
    for (const agent of state.agents) {
        if (!agent.alive || !agent.local_adaptation) continue;

        const acclimatization = agent.local_adaptation.acclimatization || 0;
        if (acclimatization < 0.1) continue;  // Skip newly arrived agents

        const x = agent.position.x;
        const y = agent.position.y;
        const baseRadius = 8;

        // Green halo for well-adapted agents
        ctx.strokeStyle = `rgba(0, 255, 0, ${acclimatization * 0.4})`;
        ctx.lineWidth = 1 + acclimatization * 2;
        ctx.beginPath();
        ctx.arc(x, y, baseRadius + 3 + acclimatization * 2, 0, Math.PI * 2);
        ctx.stroke();

        // Immigrant indicator (yellow) for new arrivals
        if (acclimatization < 0.5) {
            ctx.strokeStyle = `rgba(255, 255, 0, ${(1 - acclimatization) * 0.6})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.arc(x, y, baseRadius + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

/**
 * Get metapopulation statistics for display
 */
export function getMetapopulationStats() {
    const patches = getHabitatPatches();
    if (patches.length === 0) return null;

    const occupiedPatches = patches.filter(p => p.current_population > 0).length;
    const totalPop = state.agents.filter(a => a.alive).length;

    return {
        totalPatches: patches.length,
        occupiedPatches,
        totalPopulation: totalPop,
        avgFst: fstMatrix ? calculateAverageFst() : 0
    };
}

/**
 * Calculate average Fst across all patch pairs
 */
function calculateAverageFst() {
    if (!fstMatrix) return 0;

    let total = 0;
    let count = 0;

    for (const row of fstMatrix.values()) {
        for (const fst of row.values()) {
            total += fst;
            count++;
        }
    }

    return count > 0 ? total / count : 0;
}

/**
 * Reset metapopulation visualization state
 */
export function resetMetapopulationRenderer() {
    patchBorders = null;
    fstMatrix = null;
    sourceSinkData = null;
}

/**
 * Plasmid Renderer
 *
 * Visualizes horizontal gene transfer and plasmid content:
 * - Plasmid dots colored by function (metabolic, virulence, cooperation, etc.)
 * - Distinction between native and acquired plasmids
 * - HGT transfer visualization
 * - Plasmid load indicators
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';

/**
 * Render plasmid status around an agent
 * Shows which plasmids the agent carries and their functions
 */
export function renderPlasmidStatus(ctx, agent) {
    if (!agent.genome?.hgt?.plasmids || agent.genome.hgt.plasmids.length === 0) {
        return;
    }

    const x = agent.position.x;
    const y = agent.position.y;
    const plasmids = agent.genome.hgt.plasmids;
    const numToShow = Math.min(plasmids.length, 16); // Max 16 visible
    const radius = 22;

    // Draw plasmid dots arranged in circle
    for (let i = 0; i < numToShow; i++) {
        const angle = (Math.PI * 2 / numToShow) * i;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;

        const plasmid = plasmids[i % plasmids.length];
        renderPlasmidDot(ctx, px, py, plasmid, i < plasmids.length);
    }

    // Show count if more than displayed
    if (plasmids.length > 16) {
        ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`+${plasmids.length - 16}`, x + radius + 10, y - 2);
        ctx.textAlign = 'start';
    }

    // Optional: Show total plasmid load as background glow
    renderPlasmidLoadGlow(ctx, x, y, plasmids.length);
}

/**
 * Render individual plasmid as colored dot
 */
function renderPlasmidDot(ctx, x, y, plasmid, isActive) {
    const color = getPlasmidColor(plasmid);
    const rgb = hexToRgb(color);
    const size = 2 + (plasmid.gene_count || 3) * 0.4;

    // Main dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Ring outline for foreign (transferred) plasmids
    if (plasmid.acquired_via_hgt) {
        ctx.strokeStyle = 'rgba(255, 255, 100, 0.8)';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Brighter highlight for recently acquired
    if (plasmid.age && plasmid.age < 100) {
        const recentFade = 1 - (plasmid.age / 100);
        ctx.fillStyle = `rgba(255, 255, 200, ${recentFade * 0.6})`;
        ctx.beginPath();
        ctx.arc(x, y, size + 1, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Render subtle glow based on plasmid load
 * Heavy plasmid loads show stronger aura
 */
function renderPlasmidLoadGlow(ctx, x, y, plasmidCount) {
    if (plasmidCount < 2) return;

    const load = Math.min(1, plasmidCount / 20); // 20 plasmids = 1.0
    if (load < 0.1) return;

    ctx.fillStyle = `rgba(200, 100, 255, ${load * 0.1})`;
    ctx.globalAlpha = load * 0.3;
    ctx.beginPath();
    ctx.arc(x, y, 28 + plasmidCount * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

/**
 * Get color for plasmid based on function
 * Each function type has distinct color for quick identification
 */
export function getPlasmidColor(plasmid) {
    // Check gene functions to determine color
    const genes = plasmid.gene_functions || [];
    const name = plasmid.name || '';

    // Priority-based coloring (virulence > metabolism > cooperation > other)
    if (genes.includes('virulence') || name.toLowerCase().includes('toxin')) {
        return '#FF4444';      // Bright red - virulence genes
    }

    if (genes.includes('resistance') || name.toLowerCase().includes('resist')) {
        return '#FFFF44';      // Yellow - antibiotic/poison resistance
    }

    if (genes.includes('metabolism') || name.toLowerCase().includes('metabol')) {
        return '#44FF44';      // Green - metabolic capability
    }

    if (genes.includes('cooperation') || name.toLowerCase().includes('cooper')) {
        return '#FF44FF';      // Magenta - cooperation genes
    }

    if (genes.includes('motility') || name.toLowerCase().includes('motor')) {
        return '#44FFFF';      // Cyan - movement/motor genes
    }

    if (genes.includes('sensory') || name.toLowerCase().includes('sensor')) {
        return '#FF8844';      // Orange - sensory genes
    }

    if (genes.includes('replication') || name.toLowerCase().includes('replic')) {
        return '#8844FF';      // Purple - replication/copy genes
    }

    return '#CCCCCC';  // Gray - unknown or generic
}

/**
 * Color palette for plasmid types
 */
export const PLASMID_COLORS = {
    virulence: '#FF4444',
    resistance: '#FFFF44',
    metabolism: '#44FF44',
    cooperation: '#FF44FF',
    motility: '#44FFFF',
    sensory: '#FF8844',
    replication: '#8844FF',
    unknown: '#CCCCCC'
};

/**
 * Render HGT transfer event with visual feedback
 */
export function renderHGTTransferEvent(ctx, event) {
    const age = event.age / event.duration;
    const alpha = 1 - age;

    // Animated dashed line showing transfer
    ctx.strokeStyle = `rgba(0, 255, 200, ${alpha * 0.8})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4 + age * 6, 4]);
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.moveTo(event.from.x, event.from.y);
    ctx.lineTo(event.to.x, event.to.y);
    ctx.stroke();

    // Animated particles traveling along transfer
    const segments = 5;
    for (let i = 0; i < segments; i++) {
        const t = (age + i / segments) % 1;
        const px = event.from.x + (event.to.x - event.from.x) * t;
        const py = event.from.y + (event.to.y - event.from.y) * t;

        ctx.fillStyle = `rgba(0, 255, 200, ${alpha * (1 - i / segments)})`;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
}

/**
 * Render successful HGT integration event (burst effect)
 */
export function renderHGTIntegrationEvent(ctx, event) {
    const age = event.age / event.duration;
    const alpha = 1 - age;

    ctx.fillStyle = `rgba(0, 255, 200, ${alpha * 0.6})`;
    ctx.strokeStyle = `rgba(0, 200, 150, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha;

    const radius = 15 + age * 15;

    // Central burst point
    ctx.beginPath();
    ctx.arc(event.position.x, event.position.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Radiating lines
    const rays = 6;
    for (let i = 0; i < rays; i++) {
        const angle = (Math.PI * 2 / rays) * i;
        const startX = event.position.x;
        const startY = event.position.y;
        const endX = event.position.x + Math.cos(angle) * (radius + 10);
        const endY = event.position.y + Math.sin(angle) * (radius + 10);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

/**
 * Render plasmid loss event (when plasmid is lost/degraded)
 */
export function renderPlasmidLossEvent(ctx, event) {
    const age = event.age / event.duration;
    const alpha = 1 - age;

    ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.5})`;
    ctx.strokeStyle = `rgba(150, 150, 150, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha;

    // Fading circle
    ctx.beginPath();
    ctx.arc(event.position.x, event.position.y, 10 + age * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Fade out "X"
    ctx.strokeStyle = `rgba(100, 100, 100, ${alpha})`;
    ctx.lineWidth = 2;
    const xSize = 5;
    ctx.beginPath();
    ctx.moveTo(event.position.x - xSize, event.position.y - xSize);
    ctx.lineTo(event.position.x + xSize, event.position.y + xSize);
    ctx.moveTo(event.position.x + xSize, event.position.y - xSize);
    ctx.lineTo(event.position.x - xSize, event.position.y + xSize);
    ctx.stroke();

    ctx.globalAlpha = 1;
}

/**
 * Render detailed plasmid inventory (for selected agent)
 */
export function renderPlasmidInventory(ctx, agent, x, y, width, height) {
    if (!agent.genome?.hgt?.plasmids || agent.genome.hgt.plasmids.length === 0) {
        ctx.fillStyle = '#888888';
        ctx.font = '10px monospace';
        ctx.fillText('No plasmids', x + 15, y + 25);
        return;
    }

    const plasmids = agent.genome.hgt.plasmids;

    // Background panel
    ctx.fillStyle = 'rgba(20, 20, 40, 0.9)';
    ctx.fillRect(x, y, width, height);

    // Border
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    let textY = y + 20;
    const lineHeight = 16;
    const padding = 15;

    // Title with count
    ctx.fillStyle = '#00FFCC';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`HGT Plasmids (${plasmids.length})`, x + padding, textY);
    textY += lineHeight + 5;

    // Summary stats
    const nativeCount = plasmids.filter(p => !p.acquired_via_hgt).length;
    const foreignCount = plasmids.filter(p => p.acquired_via_hgt).length;

    ctx.fillStyle = '#CCCCCC';
    ctx.font = '10px monospace';
    ctx.fillText(`Native: ${nativeCount}  |  Acquired: ${foreignCount}`, x + padding, textY);
    textY += lineHeight + 8;

    // List plasmids
    const maxShow = 6;
    for (let i = 0; i < Math.min(maxShow, plasmids.length); i++) {
        const plasmid = plasmids[i];
        const color = getPlasmidColor(plasmid);
        const rgb = hexToRgb(color);

        // Color indicator
        ctx.fillStyle = color;
        ctx.fillRect(x + padding, textY - 8, 8, 8);

        // Plasmid name/ID
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '9px monospace';
        const name = plasmid.name || `Plasmid #${i}`;
        ctx.fillText(name, x + padding + 12, textY);

        // Genes and origin
        const geneCount = plasmid.gene_count || 0;
        const origin = plasmid.acquired_via_hgt ? '(HGT)' : '(native)';
        ctx.fillStyle = '#999999';
        ctx.fillText(`${geneCount} genes ${origin}`, x + width - 100, textY);

        textY += lineHeight;
    }

    if (plasmids.length > maxShow) {
        ctx.fillStyle = '#999999';
        ctx.font = '9px monospace';
        ctx.fillText(`+${plasmids.length - maxShow} more plasmids...`, x + padding, textY);
    }
}

/**
 * Compare HGT content between agents
 */
export function compareHGTContent(agentA, agentB) {
    const plasmidsA = agentA.genome?.hgt?.plasmids || [];
    const plasmidsB = agentB.genome?.hgt?.plasmids || [];

    const functionMapA = getFunctionDistribution(plasmidsA);
    const functionMapB = getFunctionDistribution(plasmidsB);

    return {
        countA: plasmidsA.length,
        countB: plasmidsB.length,
        functionA: functionMapA,
        functionB: functionMapB,
        sharedFunctions: getSharedFunctions(functionMapA, functionMapB)
    };
}

/**
 * Get distribution of gene functions across plasmids
 */
function getFunctionDistribution(plasmids) {
    const dist = new Map();

    for (const plasmid of plasmids) {
        const genes = plasmid.gene_functions || [];
        for (const gene of genes) {
            dist.set(gene, (dist.get(gene) || 0) + 1);
        }
    }

    return dist;
}

/**
 * Get functions present in both agents' plasmids
 */
function getSharedFunctions(mapA, mapB) {
    const shared = [];
    for (const [func, countA] of mapA) {
        if (mapB.has(func)) {
            shared.push(func);
        }
    }
    return shared;
}

/**
 * Utility: Convert hex color to RGB
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
}

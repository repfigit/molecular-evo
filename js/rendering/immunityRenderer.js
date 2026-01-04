/**
 * Immunity Renderer
 *
 * Visualizes agent immune system status including:
 * - Innate immunity strength (yellow/orange aura)
 * - CRISPR adaptive immunity (cyan spikes showing spacer count)
 * - Autoimmunity risk (red pulsing halo)
 * - Active immune response (bright glow during infection fight)
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';

/**
 * Render immunity status around an agent
 */
export function renderImmunityIndicator(ctx, agent) {
    if (!agent.genome?.immunity) return;

    const x = agent.position.x;
    const y = agent.position.y;
    const baseRadius = 10;

    const innate = agent.genome.immunity.innate_immunity;
    const crispr = agent.genome.immunity.crispr;

    // Innate immunity - golden outer ring
    if (innate && innate.strength > 0) {
        renderInnateImmunityRing(ctx, x, y, baseRadius, innate);
    }

    // CRISPR adaptive immunity - blue spikes showing spacer count
    if (crispr && crispr.spacers && crispr.spacers.length > 0) {
        renderCRISPRSpikes(ctx, x, y, baseRadius, crispr);
    }

    // Autoimmunity risk indicator
    if (innate && innate.strength > 0.8) {
        renderAutoimmunityWarning(ctx, x, y, baseRadius, innate.strength);
    }

    // Active immune response (if currently infected)
    if (agent.infection) {
        renderActiveImmuneResponse(ctx, x, y, baseRadius, agent.infection);
    }
}

/**
 * Render innate immunity as golden outer ring
 */
function renderInnateImmunityRing(ctx, x, y, baseRadius, innate) {
    const strength = Math.min(1, innate.strength);
    const alpha = strength * 0.7;
    const lineWidth = 2 + strength * 2;

    ctx.strokeStyle = `rgba(255, 200, 0, ${alpha})`;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 1;

    // Outer ring intensity reflects investment level
    ctx.beginPath();
    ctx.arc(x, y, baseRadius + 4 + strength * 2, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary ring if very high investment
    if (strength > 0.6) {
        ctx.strokeStyle = `rgba(255, 150, 0, ${alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, baseRadius + 7 + strength * 3, 0, Math.PI * 2);
        ctx.stroke();
    }
}

/**
 * Render CRISPR adaptive immunity as spikes
 * Each spike represents a stored viral spacer (immune memory)
 */
function renderCRISPRSpikes(ctx, x, y, baseRadius, crispr) {
    const spacerCount = crispr.spacers.length;
    const numSpikes = Math.min(spacerCount, 16); // Max 16 spikes for clarity
    const spikeLength = 6 + Math.min(spacerCount, 8) * 1.5; // Longer with more spacers
    const alpha = Math.min(1, spacerCount / 4) * 0.8;

    ctx.strokeStyle = `rgba(0, 180, 255, ${alpha})`;
    ctx.lineWidth = 1.5;

    for (let i = 0; i < numSpikes; i++) {
        const angle = (Math.PI * 2 / numSpikes) * i;
        const startX = x + Math.cos(angle) * baseRadius;
        const startY = y + Math.sin(angle) * baseRadius;
        const endX = x + Math.cos(angle) * (baseRadius + spikeLength);
        const endY = y + Math.sin(angle) * (baseRadius + spikeLength);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Spike tip (small circle)
        ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(endX, endY, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Show spacer count if too many to display
    if (spacerCount > 16) {
        ctx.fillStyle = 'rgba(0, 200, 255, 0.8)';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`+${spacerCount - 16}`, x + baseRadius + spikeLength + 5, y - 2);
        ctx.textAlign = 'start';
    }
}

/**
 * Render autoimmunity risk as pulsing red halo
 * Indicates agent is investing so heavily in immunity it risks self-damage
 */
function renderAutoimmunityWarning(ctx, x, y, baseRadius, strength) {
    // Pulsing effect
    const pulse = Math.sin(state.tick * 0.008) * 0.5 + 0.5;
    const riskLevel = strength - 0.8; // 0-0.2 scale

    ctx.strokeStyle = `rgba(255, 50, 50, ${pulse * riskLevel * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.globalAlpha = pulse * 0.7;

    // Dashed ring around agent
    ctx.beginPath();
    ctx.arc(x, y, baseRadius + 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
}

/**
 * Render active immune response during infection
 */
function renderActiveImmuneResponse(ctx, x, y, baseRadius, infection) {
    // Bright pulse during active defense
    const battleIntensity = Math.sin(state.tick * 0.12) * 0.5 + 0.5;

    if (infection.stage === 'lytic') {
        // Red clash with infection
        ctx.strokeStyle = `rgba(255, 100, 0, ${battleIntensity * 0.6})`;
        ctx.lineWidth = 2;
        ctx.globalAlpha = battleIntensity * 0.8;

        ctx.beginPath();
        ctx.arc(x, y, baseRadius + 8, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

/**
 * Render immunity system detailed view (for selected agent)
 * Shows breakdown of immune components
 */
export function renderImmunityDetail(ctx, agent, x, y, width, height) {
    if (!agent.genome?.immunity) return;

    const innate = agent.genome.immunity.innate_immunity;
    const crispr = agent.genome.immunity.crispr;

    // Background panel
    ctx.fillStyle = 'rgba(20, 20, 40, 0.9)';
    ctx.fillRect(x, y, width, height);

    // Border
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    let textY = y + 20;
    const lineHeight = 18;
    const padding = 15;

    // Title
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('Immune System', x + padding, textY);
    textY += lineHeight + 5;

    // Innate Immunity
    if (innate) {
        ctx.fillStyle = '#FFD400';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('Innate Immunity:', x + padding, textY);
        textY += lineHeight;

        const innatePct = (innate.strength * 100).toFixed(1);
        ctx.fillStyle = '#CCCCCC';
        ctx.font = '10px monospace';
        ctx.fillText(`  Strength: ${innatePct}%`, x + padding, textY);
        textY += lineHeight;

        ctx.fillText(`  Response Time: ${innate.response_time || 'N/A'}`, x + padding, textY);
        textY += lineHeight;

        if (innate.strength > 0.8) {
            ctx.fillStyle = '#FF6666';
            ctx.fillText(`  WARNING: Autoimmunity risk!`, x + padding, textY);
            textY += lineHeight;
        }
    }

    textY += 5;

    // CRISPR Adaptive Immunity
    if (crispr) {
        ctx.fillStyle = '#00B0FF';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('CRISPR Immunity:', x + padding, textY);
        textY += lineHeight;

        const spacerCount = crispr.spacers?.length || 0;
        ctx.fillStyle = '#CCCCCC';
        ctx.font = '10px monospace';
        ctx.fillText(`  Stored Spacers: ${spacerCount}`, x + padding, textY);
        textY += lineHeight;

        ctx.fillText(`  Memory Capacity: ${crispr.max_spacers || 'N/A'}`, x + padding, textY);
        textY += lineHeight;

        // Show viral targets if available
        if (spacerCount > 0) {
            ctx.fillStyle = '#88FF88';
            ctx.font = '9px monospace';
            ctx.fillText(`  Protected against:`, x + padding, textY);
            textY += lineHeight * 0.8;

            // Show first 3 viral IDs
            for (let i = 0; i < Math.min(3, spacerCount); i++) {
                const spacer = crispr.spacers[i];
                const label = spacer.viral_id?.substring(0, 8) || `Virus #${i}`;
                ctx.fillText(`    • ${label}`, x + padding + 5, textY);
                textY += lineHeight * 0.8;
            }

            if (spacerCount > 3) {
                ctx.fillText(`    +${spacerCount - 3} more`, x + padding + 5, textY);
            }
        }
    }
}

/**
 * Compare immunity between two agents (for visualization)
 */
export function getImmunityComparison(agentA, agentB) {
    const scoreA = calculateImmunityScore(agentA);
    const scoreB = calculateImmunityScore(agentB);

    return {
        agentAScore: scoreA,
        agentBScore: scoreB,
        difference: scoreB - scoreA,
        adaptiveAdvantage: (agentB.genome.immunity.crispr?.spacers?.length || 0) -
                          (agentA.genome.immunity.crispr?.spacers?.length || 0)
    };
}

/**
 * Calculate overall immunity score for an agent
 */
export function calculateImmunityScore(agent) {
    if (!agent.genome?.immunity) return 0;

    const innate = (agent.genome.immunity.innate_immunity?.strength || 0) * 0.4;
    const adaptive = Math.min((agent.genome.immunity.crispr?.spacers?.length || 0) / 10, 1) * 0.6;

    return innate + adaptive;
}

/**
 * Color agent based on immunity status
 */
export function getImmunityColor(agent) {
    const score = calculateImmunityScore(agent);

    if (score < 0.2) {
        return '#FF6666';  // Red - weak immunity
    } else if (score < 0.5) {
        return '#FFAA44';  // Orange - moderate immunity
    } else if (score < 0.8) {
        return '#FFFF44';  // Yellow - strong immunity
    } else {
        return '#00FF88';  // Green - very strong immunity
    }
}

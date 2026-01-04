/**
 * Agent Renderer
 *
 * Handles rendering of agents including nodes, links, motors,
 * sensors, and various visual indicators.
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { getSpeciesColor } from '../core/species.js';

/**
 * Render all agents
 */
export function renderAgents(ctx, agents) {
    for (const agent of agents) {
        if (agent.alive) {
            renderAgent(ctx, agent);
        }
    }
}

/**
 * Render a single agent
 */
export function renderAgent(ctx, agent) {
    const color = getAgentColor(agent);

    // Draw links first (behind nodes)
    renderLinks(ctx, agent, color);

    // Draw nodes
    renderNodes(ctx, agent, color);

    // Draw sensors
    if (CONFIG.DEBUG_DRAW_SENSORS) {
        renderSensors(ctx, agent);
    }

    // Draw infection indicator
    if (agent.infection) {
        renderInfectionIndicator(ctx, agent);
    }

    // Draw carnivore indicator for predatory agents
    const carnivory = agent.genome.metabolism.carnivory || 0;
    if (carnivory >= 0.5) {
        renderCarnivoreIndicator(ctx, agent, carnivory);
    }

    // Draw energy bar if selected or always show option
    if (state.showEnergyBars || state.selectedEntity === agent) {
        renderEnergyBar(ctx, agent);
    }
}

/**
 * Render agent links (springs)
 */
function renderLinks(ctx, agent, baseColor) {
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = CONFIG.LINK_WIDTH;

    for (const link of agent.body.links) {
        const nodeA = agent.body.nodes[link.node_a];
        const nodeB = agent.body.nodes[link.node_b];

        if (!nodeA || !nodeB) continue;

        ctx.beginPath();
        ctx.moveTo(nodeA.position.x, nodeA.position.y);
        ctx.lineTo(nodeB.position.x, nodeB.position.y);
        ctx.stroke();

        // Highlight motor-driven links
        const motor = agent.body.motors.find(m => m.attached_to === link.id);
        if (motor) {
            renderMotorHighlight(ctx, nodeA, nodeB, motor);
        }
    }
}

/**
 * Render motor highlight effect on a link
 */
function renderMotorHighlight(ctx, nodeA, nodeB, motor) {
    const intensity = Math.abs(Math.sin(motor.current_phase));
    const alpha = intensity * 0.8;

    ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
    ctx.lineWidth = CONFIG.MOTOR_HIGHLIGHT_WIDTH;

    ctx.beginPath();
    ctx.moveTo(nodeA.position.x, nodeA.position.y);
    ctx.lineTo(nodeB.position.x, nodeB.position.y);
    ctx.stroke();
}

/**
 * Render agent nodes (masses)
 */
function renderNodes(ctx, agent, color) {
    ctx.fillStyle = color;

    for (const node of agent.body.nodes) {
        const radius = CONFIG.NODE_BASE_RADIUS * node.mass;

        ctx.beginPath();
        ctx.arc(node.position.x, node.position.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw node outline if touching surface
        if (node.touching_surface) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}

/**
 * Render sensor visualization
 */
function renderSensors(ctx, agent) {
    for (const sensor of agent.body.sensors) {
        const node = agent.body.nodes[sensor.attached_to];
        if (!node) continue;

        const x = node.position.x;
        const y = node.position.y;

        // Draw sensor range
        ctx.strokeStyle = getSensorColor(sensor.type);
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;

        ctx.beginPath();
        ctx.arc(x, y, sensor.range, 0, Math.PI * 2);
        ctx.stroke();

        // Draw sensor direction (if applicable)
        if (sensor.direction !== undefined) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            const dx = Math.cos(sensor.direction) * sensor.range;
            const dy = Math.sin(sensor.direction) * sensor.range;
            ctx.lineTo(x + dx, y + dy);
            ctx.stroke();
        }

        // Draw current value indicator
        ctx.globalAlpha = sensor.current_value;
        ctx.fillStyle = getSensorColor(sensor.type);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1.0;
    }
}

/**
 * Get color for sensor type
 */
function getSensorColor(type) {
    switch (type) {
        case 'chemical': return '#00ffff';
        case 'thermal': return '#ff8800';
        case 'proximity': return '#ff00ff';
        case 'kin': return '#00ff00';
        case 'viral': return '#ff0000';
        case 'signal': return '#ffff00';
        case 'prey': return '#ff4400';  // Orange-red for prey detection
        default: return '#ffffff';
    }
}

/**
 * Render infection indicator
 */
function renderInfectionIndicator(ctx, agent) {
    const x = agent.position.x;
    const y = agent.position.y;

    ctx.strokeStyle = CONFIG.COLORS.viral_particle;
    ctx.lineWidth = 2;

    // Pulsing ring
    const pulse = Math.sin(state.tick * 0.1) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;

    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Stage indicator
    if (agent.infection.stage === 'lytic') {
        // Multiple rings for lytic
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.stroke();
    } else if (agent.infection.stage === 'lysogenic') {
        // Dashed ring for lysogenic
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1.0;
}

/**
 * Render carnivore indicator for predatory agents
 */
function renderCarnivoreIndicator(ctx, agent, carnivory) {
    const x = agent.position.x;
    const y = agent.position.y;

    // Red "fangs" or spikes around the agent
    const intensity = (carnivory - 0.5) * 2;  // 0-1 scale for 0.5-1.0 carnivory
    ctx.strokeStyle = `rgba(255, 50, 50, ${0.3 + intensity * 0.5})`;
    ctx.fillStyle = `rgba(255, 0, 0, ${0.2 + intensity * 0.3})`;
    ctx.lineWidth = 1;

    // Draw small triangular "fangs" pointing outward
    const numFangs = 3;
    const fangSize = 4 + intensity * 4;

    for (let i = 0; i < numFangs; i++) {
        const angle = (Math.PI * 2 / numFangs) * i + state.tick * 0.02;
        const baseX = x + Math.cos(angle) * 12;
        const baseY = y + Math.sin(angle) * 12;
        const tipX = x + Math.cos(angle) * (12 + fangSize);
        const tipY = y + Math.sin(angle) * (12 + fangSize);

        ctx.beginPath();
        ctx.moveTo(baseX - Math.sin(angle) * 2, baseY + Math.cos(angle) * 2);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(baseX + Math.sin(angle) * 2, baseY - Math.cos(angle) * 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

/**
 * Render energy bar above agent
 */
function renderEnergyBar(ctx, agent) {
    const x = agent.position.x;
    const y = agent.position.y - 20;
    const width = 20;
    const height = 3;

    const energyRatio = Math.min(1, agent.energy / agent.genome.metabolism.storage_capacity);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x - width / 2, y, width, height);

    // Energy fill
    ctx.fillStyle = energyRatio > 0.3 ? CONFIG.COLORS.energy_high : CONFIG.COLORS.energy_low;
    ctx.fillRect(x - width / 2, y, width * energyRatio, height);
}

/**
 * Render selection highlight
 */
export function renderSelection(ctx, agent) {
    const x = agent.position.x;
    const y = agent.position.y;

    // Calculate selection radius based on agent size
    let maxDist = 0;
    for (const node of agent.body.nodes) {
        const dx = node.position.x - x;
        const dy = node.position.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist) maxDist = dist;
    }
    const radius = maxDist + 10;

    // Animated dashed circle
    const dashOffset = (state.tick * 0.5) % 20;

    ctx.strokeStyle = CONFIG.COLORS.selection;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -dashOffset;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Draw tracking line to edge if off-screen
    // (handled by UI renderer)
}

/**
 * Get color for agent based on current color mode
 */
export function getAgentColor(agent) {
    switch (state.agentColorMode) {
        case 'species':
            return getSpeciesColor(agent.genome.species_marker);

        case 'energy':
            return energyColor(agent.energy / agent.genome.metabolism.storage_capacity);

        case 'age':
            return ageColor(Math.min(agent.age / 10000, 1));

        case 'fitness':
            return fitnessColor(agent.fitness);

        case 'infection':
            return agent.infection ? CONFIG.COLORS.viral_particle : '#44ff44';

        case 'hgt':
            return agent.genome.hgt.plasmids.length > 0 ? '#00ffff' : '#888888';

        case 'cooperation':
            return agent.cooperative_links?.length > 0 ? CONFIG.COLORS.cooperative_link : '#888888';

        case 'symbiosis':
            return (agent.symbiont || agent.host) ? CONFIG.COLORS.symbiotic_bond : '#888888';

        default:
            return '#ffffff';
    }
}

/**
 * Energy-based color (red to green)
 */
function energyColor(ratio) {
    ratio = Math.max(0, Math.min(1, ratio));
    const r = Math.round(255 * (1 - ratio));
    const g = Math.round(255 * ratio);
    return `rgb(${r}, ${g}, 50)`;
}

/**
 * Age-based color (bright to dark)
 */
function ageColor(ratio) {
    ratio = Math.max(0, Math.min(1, ratio));
    const brightness = Math.round(255 * (1 - ratio * 0.7));
    return `rgb(${brightness}, ${brightness}, ${brightness})`;
}

/**
 * Fitness-based color (purple to gold)
 */
function fitnessColor(fitness) {
    const ratio = Math.min(fitness / 100, 1);
    const r = Math.round(128 + 127 * ratio);
    const g = Math.round(100 + 155 * ratio);
    const b = Math.round(255 * (1 - ratio));
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Render agent trail (for selected agent)
 */
export function renderAgentTrail(ctx, agent, trail) {
    if (!trail || trail.length < 2) return;

    ctx.strokeStyle = getAgentColor(agent);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);

    for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
    }

    ctx.stroke();
    ctx.globalAlpha = 1.0;
}

/**
 * Render ghost of dead agent (fade out effect)
 */
export function renderDeadAgent(ctx, agent, fadeProgress) {
    ctx.globalAlpha = 1 - fadeProgress;

    // Draw simplified agent shape
    ctx.fillStyle = '#666666';
    ctx.beginPath();
    ctx.arc(agent.position.x, agent.position.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;
}

/**
 * Render agent velocity vector (debug)
 */
export function renderVelocityVector(ctx, agent) {
    const scale = 5;
    const x = agent.position.x;
    const y = agent.position.y;
    const vx = agent.velocity.x * scale;
    const vy = agent.velocity.y * scale;

    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + vx, y + vy);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(vy, vx);
    const headLen = 5;
    ctx.beginPath();
    ctx.moveTo(x + vx, y + vy);
    ctx.lineTo(
        x + vx - headLen * Math.cos(angle - 0.5),
        y + vy - headLen * Math.sin(angle - 0.5)
    );
    ctx.moveTo(x + vx, y + vy);
    ctx.lineTo(
        x + vx - headLen * Math.cos(angle + 0.5),
        y + vy - headLen * Math.sin(angle + 0.5)
    );
    ctx.stroke();
}

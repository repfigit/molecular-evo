/**
 * Environment Renderer
 *
 * Handles rendering of environment elements including:
 * - World boundary
 * - Resource heatmaps
 * - Temperature visualization
 * - Gradient overlays
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';

/**
 * Main environment render function
 */
export function renderEnvironment(ctx, environment) {
    // Draw world boundary
    renderWorldBoundary(ctx);

    // Draw resource overlays based on current mode
    if (state.overlayMode !== 'none') {
        renderOverlay(ctx, environment);
    }
}

/**
 * Render world boundary
 */
function renderWorldBoundary(ctx) {
    ctx.strokeStyle = CONFIG.COLORS.grid;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);

    // Draw subtle corner markers
    const cornerSize = 20;
    ctx.strokeStyle = 'rgba(100, 120, 150, 0.5)';
    ctx.lineWidth = 1;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(0, cornerSize);
    ctx.lineTo(0, 0);
    ctx.lineTo(cornerSize, 0);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(CONFIG.WORLD_WIDTH - cornerSize, 0);
    ctx.lineTo(CONFIG.WORLD_WIDTH, 0);
    ctx.lineTo(CONFIG.WORLD_WIDTH, cornerSize);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(0, CONFIG.WORLD_HEIGHT - cornerSize);
    ctx.lineTo(0, CONFIG.WORLD_HEIGHT);
    ctx.lineTo(cornerSize, CONFIG.WORLD_HEIGHT);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(CONFIG.WORLD_WIDTH - cornerSize, CONFIG.WORLD_HEIGHT);
    ctx.lineTo(CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
    ctx.lineTo(CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT - cornerSize);
    ctx.stroke();
}

/**
 * Render overlay based on current mode
 */
function renderOverlay(ctx, environment) {
    switch (state.overlayMode) {
        case 'resources':
            renderResourceOverlay(ctx, environment);
            break;
        case 'temperature':
            renderTemperatureOverlay(ctx, environment);
            break;
        case 'chemical_a':
            renderChemicalOverlay(ctx, environment, 'chemical_A', '#00ff00');
            break;
        case 'chemical_b':
            renderChemicalOverlay(ctx, environment, 'chemical_B', '#0088ff');
            break;
        case 'light':
            renderLightOverlay(ctx, environment);
            break;
        case 'viral':
            renderViralDensityOverlay(ctx);
            break;
        case 'dna':
            renderDNADensityOverlay(ctx);
            break;
    }
}

/**
 * Render resource heatmap overlay
 */
function renderResourceOverlay(ctx, environment) {
    if (!environment?.resources) return;

    const cellSize = CONFIG.ENVIRONMENT_CELL_SIZE || 20;
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / cellSize);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / cellSize);

    ctx.globalAlpha = 0.3;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = environment.resources[y]?.[x];
            if (!cell) continue;

            // Combined resource intensity
            const intensity = (
                (cell.chemical_A || 0) +
                (cell.chemical_B || 0) +
                (cell.organic_matter || 0)
            ) / 3;

            if (intensity > 0.1) {
                ctx.fillStyle = resourceColor(intensity);
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    ctx.globalAlpha = 1.0;
}

/**
 * Resource intensity to color
 */
function resourceColor(intensity) {
    const r = Math.round(50 + 100 * intensity);
    const g = Math.round(150 + 105 * intensity);
    const b = Math.round(50);
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Render temperature overlay
 */
function renderTemperatureOverlay(ctx, environment) {
    if (!environment) return;

    // Simple gradient based on global temperature
    const temp = environment.temperature || 0.5;

    // Create gradient from top to bottom
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.WORLD_HEIGHT);

    if (temp > 0.6) {
        // Hot - orange/red
        gradient.addColorStop(0, `rgba(255, 100, 0, ${(temp - 0.5) * 0.3})`);
        gradient.addColorStop(1, `rgba(255, 50, 0, ${(temp - 0.5) * 0.2})`);
    } else if (temp < 0.4) {
        // Cold - blue
        gradient.addColorStop(0, `rgba(0, 100, 255, ${(0.5 - temp) * 0.2})`);
        gradient.addColorStop(1, `rgba(0, 50, 200, ${(0.5 - temp) * 0.3})`);
    } else {
        // Neutral - subtle
        gradient.addColorStop(0, 'rgba(100, 100, 100, 0.05)');
        gradient.addColorStop(1, 'rgba(100, 100, 100, 0.05)');
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
}

/**
 * Render chemical gradient overlay
 */
function renderChemicalOverlay(ctx, environment, chemicalType, baseColor) {
    if (!environment?.resources) return;

    const cellSize = CONFIG.ENVIRONMENT_CELL_SIZE || 20;
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / cellSize);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / cellSize);

    // Parse base color
    const rgb = hexToRgb(baseColor);

    ctx.globalAlpha = 0.4;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = environment.resources[y]?.[x];
            if (!cell) continue;

            const intensity = cell[chemicalType] || 0;
            if (intensity > 0.05) {
                ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    ctx.globalAlpha = 1.0;
}

/**
 * Render light intensity overlay
 */
function renderLightOverlay(ctx, environment) {
    if (!environment?.resources) return;

    const cellSize = CONFIG.ENVIRONMENT_CELL_SIZE || 20;
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / cellSize);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / cellSize);

    ctx.globalAlpha = 0.3;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = environment.resources[y]?.[x];
            if (!cell) continue;

            const light = cell.light || 0;
            if (light > 0.1) {
                const brightness = Math.round(255 * light);
                ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${Math.round(brightness * 0.8)})`;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    ctx.globalAlpha = 1.0;
}

/**
 * Render viral density overlay
 */
function renderViralDensityOverlay(ctx) {
    if (!state.viruses || state.viruses.length === 0) return;

    const cellSize = 50;
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / cellSize);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / cellSize);

    // Count viruses per cell
    const density = new Array(rows).fill(null).map(() => new Array(cols).fill(0));

    for (const virus of state.viruses) {
        const cx = Math.floor(virus.position.x / cellSize);
        const cy = Math.floor(virus.position.y / cellSize);
        if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
            density[cy][cx]++;
        }
    }

    // Render density
    ctx.globalAlpha = 0.4;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (density[y][x] > 0) {
                const intensity = Math.min(1, density[y][x] / 5);
                ctx.fillStyle = `rgba(255, 0, 0, ${intensity})`;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    ctx.globalAlpha = 1.0;
}

/**
 * Render DNA fragment density overlay
 */
function renderDNADensityOverlay(ctx) {
    if (!state.dnaFragments || state.dnaFragments.length === 0) return;

    const cellSize = 50;
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / cellSize);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / cellSize);

    // Count fragments per cell
    const density = new Array(rows).fill(null).map(() => new Array(cols).fill(0));

    for (const fragment of state.dnaFragments) {
        const cx = Math.floor(fragment.position.x / cellSize);
        const cy = Math.floor(fragment.position.y / cellSize);
        if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
            density[cy][cx]++;
        }
    }

    // Render density
    ctx.globalAlpha = 0.4;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (density[y][x] > 0) {
                const intensity = Math.min(1, density[y][x] / 10);
                ctx.fillStyle = `rgba(0, 255, 255, ${intensity})`;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    ctx.globalAlpha = 1.0;
}

/**
 * Render resource spots (concentrated resource areas)
 */
export function renderResourceSpots(ctx, spots) {
    if (!spots || spots.length === 0) return;

    for (const spot of spots) {
        const gradient = ctx.createRadialGradient(
            spot.x, spot.y, 0,
            spot.x, spot.y, spot.radius
        );

        gradient.addColorStop(0, `rgba(100, 200, 100, ${spot.intensity * 0.5})`);
        gradient.addColorStop(1, 'rgba(100, 200, 100, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(spot.x, spot.y, spot.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Render toxic zones
 */
export function renderToxicZones(ctx, zones) {
    if (!zones || zones.length === 0) return;

    for (const zone of zones) {
        const gradient = ctx.createRadialGradient(
            zone.x, zone.y, 0,
            zone.x, zone.y, zone.radius
        );

        gradient.addColorStop(0, `rgba(200, 50, 200, ${zone.intensity * 0.4})`);
        gradient.addColorStop(0.7, `rgba(200, 50, 200, ${zone.intensity * 0.2})`);
        gradient.addColorStop(1, 'rgba(200, 50, 200, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
        ctx.fill();

        // Hazard border
        ctx.strokeStyle = `rgba(255, 0, 255, ${zone.intensity * 0.5})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

/**
 * Render current flow (for environment with currents)
 */
export function renderCurrentFlow(ctx, environment) {
    if (!environment?.current) return;

    const spacing = 50;
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / spacing);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / spacing);

    ctx.strokeStyle = 'rgba(100, 150, 255, 0.3)';
    ctx.lineWidth = 1;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const px = x * spacing + spacing / 2;
            const py = y * spacing + spacing / 2;

            // Get current at this point
            const current = environment.current;
            const strength = Math.sqrt(current.x * current.x + current.y * current.y);

            if (strength > 0.01) {
                const angle = Math.atan2(current.y, current.x);
                const len = strength * 20;

                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
                ctx.stroke();
            }
        }
    }
}

/**
 * Render minimap
 */
export function renderMinimap(ctx, x, y, width, height) {
    const scaleX = width / CONFIG.WORLD_WIDTH;
    const scaleY = height / CONFIG.WORLD_HEIGHT;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, width, height);

    // Border
    ctx.strokeStyle = CONFIG.COLORS.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Draw agents as dots
    for (const agent of state.agents) {
        if (!agent.alive) continue;

        const ax = x + agent.position.x * scaleX;
        const ay = y + agent.position.y * scaleY;

        ctx.fillStyle = getSpeciesColorFast(agent.genome.species_marker);
        ctx.fillRect(ax - 1, ay - 1, 2, 2);
    }

    // Draw viruses as red dots
    if (state.viruses) {
        ctx.fillStyle = CONFIG.COLORS.viral_particle;
        for (const virus of state.viruses) {
            const vx = x + virus.position.x * scaleX;
            const vy = y + virus.position.y * scaleY;
            ctx.fillRect(vx, vy, 1, 1);
        }
    }

    // Draw viewport rectangle
    const bounds = getVisibleBounds();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(
        x + bounds.left * scaleX,
        y + bounds.top * scaleY,
        bounds.width * scaleX,
        bounds.height * scaleY
    );
}

/**
 * Get visible bounds (helper)
 */
function getVisibleBounds() {
    const canvas = document.getElementById('simulation-canvas');
    if (!canvas) return { left: 0, top: 0, width: 800, height: 600 };

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const left = state.camera.x - centerX / state.camera.zoom;
    const top = state.camera.y - centerY / state.camera.zoom;
    const width = canvas.width / state.camera.zoom;
    const height = canvas.height / state.camera.zoom;

    return { left, top, width, height };
}

/**
 * Fast species color lookup
 */
function getSpeciesColorFast(marker) {
    return state.speciesColors?.get(marker) || '#ffffff';
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
}

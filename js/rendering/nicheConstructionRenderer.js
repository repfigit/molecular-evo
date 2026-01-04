/**
 * Niche Construction Renderer
 *
 * Visualizes environmental modification by agents:
 * - Biofilm coverage on the environment grid
 * - Territorial markings (pheromone-like gradients)
 * - Waste product deposition creating resource gradients
 * - Shade effects from large organisms
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';

// Niche construction effect maps
const biofilmGrid = [];    // Biofilm coverage density
const pheromoneGrid = [];  // Territory markers
const wasteGrid = [];      // Waste product buildup
const shadeGrid = [];      // Shading from large bodies

const GRID_SIZE = 20;      // Grid cell size in world units

/**
 * Initialize niche construction grids
 */
export function initNicheConstructionGrids() {
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / GRID_SIZE);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / GRID_SIZE);

    for (let y = 0; y < rows; y++) {
        biofilmGrid[y] = [];
        pheromoneGrid[y] = [];
        wasteGrid[y] = [];
        shadeGrid[y] = [];

        for (let x = 0; x < cols; x++) {
            biofilmGrid[y][x] = 0;
            pheromoneGrid[y][x] = { intensity: 0, species: -1 };
            wasteGrid[y][x] = 0;
            shadeGrid[y][x] = 0;
        }
    }
}

/**
 * Update niche construction effects based on current agent positions
 */
export function updateNicheConstruction() {
    // Decay all grids slightly
    decayGrids();

    // Apply agent effects
    for (const agent of state.agents) {
        if (!agent.alive) continue;

        // Get grid cell for agent
        const cellX = Math.floor(agent.position.x / GRID_SIZE);
        const cellY = Math.floor(agent.position.y / GRID_SIZE);

        if (cellX < 0 || cellY < 0 || cellY >= biofilmGrid.length || cellX >= biofilmGrid[0].length) {
            continue;
        }

        // Apply niche construction effects
        applyBiofilmEffect(agent, cellX, cellY);
        applyPheromoneEffect(agent, cellX, cellY);
        applyWasteEffect(agent, cellX, cellY);
        applyShadeEffect(agent, cellX, cellY);
    }
}

/**
 * Decay all niche construction grids over time
 */
function decayGrids() {
    const decayRate = 0.98;  // 2% decay per tick

    for (let y = 0; y < biofilmGrid.length; y++) {
        for (let x = 0; x < biofilmGrid[y].length; x++) {
            biofilmGrid[y][x] *= decayRate;
            pheromoneGrid[y][x].intensity *= decayRate;
            wasteGrid[y][x] *= decayRate;
            shadeGrid[y][x] *= decayRate;

            // Diffusion - spread to neighbors
            if (biofilmGrid[y][x] > 0.1) {
                diffuseBiofilm(x, y);
            }
            if (pheromoneGrid[y][x].intensity > 0.05) {
                diffusePheromone(x, y);
            }
        }
    }
}

/**
 * Simple diffusion for biofilm
 */
function diffuseBiofilm(cx, cy) {
    const diffusionRate = 0.1;
    const baseValue = biofilmGrid[cy][cx];

    // Distribute to neighbors
    const neighbors = [
        [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]
    ];

    for (const [nx, ny] of neighbors) {
        if (nx >= 0 && ny >= 0 && ny < biofilmGrid.length && nx < biofilmGrid[0].length) {
            biofilmGrid[ny][nx] += baseValue * diffusionRate / 4;
        }
    }
}

/**
 * Simple diffusion for pheromones
 */
function diffusePheromone(cx, cy) {
    const diffusionRate = 0.1;
    const baseIntensity = pheromoneGrid[cy][cx].intensity;

    const neighbors = [
        [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]
    ];

    for (const [nx, ny] of neighbors) {
        if (nx >= 0 && ny >= 0 && ny < pheromoneGrid.length && nx < pheromoneGrid[0].length) {
            const neighbor = pheromoneGrid[ny][nx];
            if (neighbor.intensity < baseIntensity) {
                neighbor.intensity += baseIntensity * diffusionRate / 4;
                neighbor.species = pheromoneGrid[cy][cx].species;
            }
        }
    }
}

/**
 * Apply biofilm effect from an agent
 * Cooperative/colonial agents produce more biofilm
 */
function applyBiofilmEffect(agent, cx, cy) {
    // Niche construction genes
    const nicheConstruction = agent.genome.niche_construction || {};
    const biofilmProduction = nicheConstruction.biofilm_production || 0;

    // Cooperative agents produce more biofilm
    const cooperation = agent.genome.social?.cooperation || 0;

    const totalBiofilm = (biofilmProduction + cooperation * 0.5) * 0.1;

    if (totalBiofilm > 0) {
        biofilmGrid[cy][cx] = Math.min(1, biofilmGrid[cy][cx] + totalBiofilm);
    }
}

/**
 * Apply pheromone/territorial marking effect
 */
function applyPheromoneEffect(agent, cx, cy) {
    const territorial = agent.genome.social?.territoriality || 0;

    if (territorial > 0.1) {
        const marker = pheromoneGrid[cy][cx];
        marker.intensity = Math.min(1, marker.intensity + territorial * 0.05);
        marker.species = agent.genome.species_marker;
    }
}

/**
 * Apply waste product deposition
 */
function applyWasteEffect(agent, cx, cy) {
    // All agents produce waste proportional to their size and metabolism
    const agentSize = agent.genome.nodes.length;
    const metabolism = agent.genome.metabolism?.metabolic_rate || 0.5;

    const wasteProduction = (agentSize / 100) * metabolism * 0.01;

    if (wasteProduction > 0) {
        wasteGrid[cy][cx] = Math.min(1, wasteGrid[cy][cx] + wasteProduction);
    }
}

/**
 * Apply shade effect from large organisms
 */
function applyShadeEffect(agent, cx, cy) {
    const agentSize = agent.genome.nodes.length;
    const shadeRadius = Math.floor(agentSize / 50);

    if (shadeRadius < 1) return;

    // Cast shadow in multiple cells
    for (let dy = -shadeRadius; dy <= shadeRadius; dy++) {
        for (let dx = -shadeRadius; dx <= shadeRadius; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (nx >= 0 && ny >= 0 && ny < shadeGrid.length && nx < shadeGrid[0].length) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                const shadowIntensity = Math.max(0, 1 - (distance / shadeRadius));
                shadeGrid[ny][nx] = Math.min(1, shadeGrid[ny][nx] + shadowIntensity * 0.05);
            }
        }
    }
}

/**
 * Main niche construction render function
 */
export function renderNicheConstruction(ctx) {
    if (biofilmGrid.length === 0) return;

    // Render layers from back to front
    renderShadeLayer(ctx);
    renderBiofilmLayer(ctx);
    renderWasteLayer(ctx);
    renderPheromoneLayer(ctx);
}

/**
 * Render shade effects
 */
function renderShadeLayer(ctx) {
    for (let y = 0; y < shadeGrid.length; y++) {
        for (let x = 0; x < shadeGrid[y].length; x++) {
            const intensity = shadeGrid[y][x];
            if (intensity < 0.05) continue;

            const worldX = x * GRID_SIZE;
            const worldY = y * GRID_SIZE;

            ctx.fillStyle = `rgba(0, 0, 0, ${intensity * 0.3})`;
            ctx.fillRect(worldX, worldY, GRID_SIZE, GRID_SIZE);
        }
    }
}

/**
 * Render biofilm coverage
 */
function renderBiofilmLayer(ctx) {
    for (let y = 0; y < biofilmGrid.length; y++) {
        for (let x = 0; x < biofilmGrid[y].length; x++) {
            const intensity = biofilmGrid[y][x];
            if (intensity < 0.05) continue;

            const worldX = x * GRID_SIZE;
            const worldY = y * GRID_SIZE;

            // Biofilm appears as translucent green mucoid coating
            ctx.fillStyle = `rgba(100, 200, 100, ${intensity * 0.25})`;
            ctx.fillRect(worldX, worldY, GRID_SIZE, GRID_SIZE);

            // Add texture with small circles
            if (intensity > 0.3) {
                ctx.fillStyle = `rgba(80, 180, 80, ${intensity * 0.15})`;
                for (let i = 0; i < Math.floor(intensity * 3); i++) {
                    const px = worldX + Math.random() * GRID_SIZE;
                    const py = worldY + Math.random() * GRID_SIZE;
                    const radius = 1 + Math.random() * 2;
                    ctx.beginPath();
                    ctx.arc(px, py, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
}

/**
 * Render waste product deposits
 */
function renderWasteLayer(ctx) {
    for (let y = 0; y < wasteGrid.length; y++) {
        for (let x = 0; x < wasteGrid[y].length; x++) {
            const intensity = wasteGrid[y][x];
            if (intensity < 0.05) continue;

            const worldX = x * GRID_SIZE;
            const worldY = y * GRID_SIZE;

            // Waste appears as brown/red detritus
            ctx.fillStyle = `rgba(150, 100, 50, ${intensity * 0.2})`;
            ctx.fillRect(worldX, worldY, GRID_SIZE, GRID_SIZE);

            // Gradient from center showing accumulation
            const gradient = ctx.createRadialGradient(
                worldX + GRID_SIZE / 2, worldY + GRID_SIZE / 2, 0,
                worldX + GRID_SIZE / 2, worldY + GRID_SIZE / 2, GRID_SIZE / Math.sqrt(2)
            );
            gradient.addColorStop(0, `rgba(200, 150, 100, ${intensity * 0.15})`);
            gradient.addColorStop(1, `rgba(150, 100, 50, 0)`);

            ctx.fillStyle = gradient;
            ctx.fillRect(worldX, worldY, GRID_SIZE, GRID_SIZE);
        }
    }
}

/**
 * Render territorial pheromone markers
 */
function renderPheromoneLayer(ctx) {
    for (let y = 0; y < pheromoneGrid.length; y++) {
        for (let x = 0; x < pheromoneGrid[y].length; x++) {
            const marker = pheromoneGrid[y][x];
            if (marker.intensity < 0.05) continue;

            const worldX = x * GRID_SIZE;
            const worldY = y * GRID_SIZE;

            // Different colors for different species
            let color;
            if (marker.species >= 0) {
                // Use species color for territorial markers
                const hue = (marker.species * 137.5) % 360;
                color = `hsla(${hue}, 100%, 50%, ${marker.intensity * 0.3})`;
            } else {
                // Generic pheromone
                color = `rgba(200, 100, 200, ${marker.intensity * 0.2})`;
            }

            ctx.fillStyle = color;
            ctx.fillRect(worldX, worldY, GRID_SIZE, GRID_SIZE);

            // Add pheromone trail effect with dots
            if (marker.intensity > 0.2) {
                const dotCount = Math.floor(marker.intensity * 2);
                ctx.fillStyle = `rgba(255, 100, 255, ${marker.intensity * 0.5})`;
                for (let i = 0; i < dotCount; i++) {
                    const px = worldX + Math.random() * GRID_SIZE;
                    const py = worldY + Math.random() * GRID_SIZE;
                    ctx.beginPath();
                    ctx.arc(px, py, 0.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
}

/**
 * Get niche construction statistics
 */
export function getNicheConstructionStats() {
    let totalBiofilm = 0;
    let totalWaste = 0;
    let totalPheromone = 0;
    let totalShade = 0;
    let cellCount = 0;

    for (let y = 0; y < biofilmGrid.length; y++) {
        for (let x = 0; x < biofilmGrid[y].length; x++) {
            totalBiofilm += biofilmGrid[y][x];
            totalWaste += wasteGrid[y][x];
            totalPheromone += pheromoneGrid[y][x].intensity;
            totalShade += shadeGrid[y][x];
            cellCount++;
        }
    }

    return {
        avgBiofilmCoverage: cellCount > 0 ? totalBiofilm / cellCount : 0,
        avgWasteAccumulation: cellCount > 0 ? totalWaste / cellCount : 0,
        avgPheromoneIntensity: cellCount > 0 ? totalPheromone / cellCount : 0,
        avgShadeEffect: cellCount > 0 ? totalShade / cellCount : 0,
        cellsWithBiofilm: biofilmGrid.flat().filter(v => v > 0.1).length,
        cellsWithWaste: wasteGrid.flat().filter(v => v > 0.1).length,
        cellsWithPheromone: pheromoneGrid.flat().filter(m => m.intensity > 0.1).length
    };
}

/**
 * Reset niche construction grids
 */
export function resetNicheConstructionRenderer() {
    biofilmGrid.length = 0;
    pheromoneGrid.length = 0;
    wasteGrid.length = 0;
    shadeGrid.length = 0;
    initNicheConstructionGrids();
}

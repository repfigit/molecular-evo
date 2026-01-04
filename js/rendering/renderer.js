/**
 * Main Renderer
 *
 * Handles canvas rendering with layer system, camera controls,
 * and coordinate transformations.
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { renderAgents, renderSelection } from './agentRenderer.js';
import { renderEnvironment } from './environmentRenderer.js';

/**
 * Renderer class - manages all visual output
 */
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Rendering layers (back to front)
        this.layers = [
            'environment',  // Background, resources, temperature
            'grid',         // Spatial hash grid (debug)
            'food',         // Food particles
            'corpses',      // Dead agent bodies
            'dna',          // DNA fragments
            'agents',       // Agents/organisms
            'viruses',      // Viral particles
            'effects',      // HGT transfers, infections, predation
            'cooperative',  // Cooperative links
            'symbiotic',    // Symbiotic bonds
            'ui'            // Selection, tooltips
        ];

        // Layer visibility
        this.layerVisible = {
            environment: true,
            grid: false,
            food: true,
            corpses: true,
            dna: true,
            agents: true,
            viruses: true,
            effects: true,
            cooperative: true,
            symbiotic: true,
            ui: true
        };

        // Performance tracking
        this.renderTimes = {};
    }

    /**
     * Main render method - draws all visible layers
     */
    render() {
        const startTime = performance.now();
        const ctx = this.ctx;

        // Clear canvas
        ctx.fillStyle = CONFIG.COLORS.background;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply camera transform
        this.applyCameraTransform();

        // Render each visible layer
        for (const layer of this.layers) {
            if (this.layerVisible[layer]) {
                const layerStart = performance.now();
                this.renderLayer(layer);
                this.renderTimes[layer] = performance.now() - layerStart;
            }
        }

        // Restore transform
        ctx.restore();

        // Render screen-space UI (not affected by camera)
        this.renderScreenUI();

        state.renderTime = performance.now() - startTime;
    }

    /**
     * Apply camera transformation
     */
    applyCameraTransform() {
        const ctx = this.ctx;
        ctx.save();

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        ctx.translate(centerX, centerY);
        ctx.scale(state.camera.zoom, state.camera.zoom);
        ctx.translate(-state.camera.x, -state.camera.y);
    }

    /**
     * Render a specific layer
     */
    renderLayer(layer) {
        const ctx = this.ctx;

        switch (layer) {
            case 'environment':
                renderEnvironment(ctx, state.environment);
                break;

            case 'grid':
                this.renderSpatialGrid(ctx);
                break;

            case 'food':
                this.renderFood(ctx);
                break;

            case 'corpses':
                this.renderCorpses(ctx);
                break;

            case 'dna':
                this.renderDNAFragments(ctx);
                break;

            case 'agents':
                renderAgents(ctx, state.agents);
                break;

            case 'viruses':
                this.renderViruses(ctx);
                break;

            case 'effects':
                this.renderEffects(ctx);
                break;

            case 'cooperative':
                this.renderCooperativeLinks(ctx);
                break;

            case 'symbiotic':
                this.renderSymbioticBonds(ctx);
                break;

            case 'ui':
                if (state.selectedEntity && state.selectedType === 'agent') {
                    renderSelection(ctx, state.selectedEntity);
                }
                break;
        }
    }

    /**
     * Render screen-space UI (overlay panels, etc.)
     */
    renderScreenUI() {
        // Reserved for HUD elements that don't move with camera
        // Population count, minimap, etc.
    }

    /**
     * Render world boundary
     */
    renderWorldBoundary(ctx) {
        ctx.strokeStyle = CONFIG.COLORS.grid;
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
    }

    /**
     * Render spatial grid for debugging
     */
    renderSpatialGrid(ctx) {
        const cellSize = CONFIG.SPATIAL_CELL_SIZE;
        const cols = Math.ceil(CONFIG.WORLD_WIDTH / cellSize);
        const rows = Math.ceil(CONFIG.WORLD_HEIGHT / cellSize);

        ctx.strokeStyle = 'rgba(100, 100, 150, 0.2)';
        ctx.lineWidth = 1;

        // Vertical lines
        for (let i = 0; i <= cols; i++) {
            ctx.beginPath();
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, CONFIG.WORLD_HEIGHT);
            ctx.stroke();
        }

        // Horizontal lines
        for (let i = 0; i <= rows; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(CONFIG.WORLD_WIDTH, i * cellSize);
            ctx.stroke();
        }
    }

    /**
     * Render food particles
     */
    renderFood(ctx) {
        if (!state.foodParticles || state.foodParticles.length === 0) return;

        ctx.fillStyle = '#88ff88';  // Green color for food
        ctx.strokeStyle = '#44aa44';
        ctx.lineWidth = 1;

        for (const food of state.foodParticles) {
            if (food.consumed) continue;

            ctx.beginPath();
            ctx.arc(food.position.x, food.position.y, CONFIG.FOOD_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }

    /**
     * Render corpses (dead agent bodies)
     */
    renderCorpses(ctx) {
        if (!state.corpses || state.corpses.length === 0) return;

        for (const corpse of state.corpses) {
            if (corpse.energy <= 0) continue;

            // Calculate fade based on age and energy
            const ageFade = 1 - (corpse.age / CONFIG.CORPSE_MAX_AGE);
            const energyFade = corpse.energy / corpse.originalEnergy;
            const alpha = Math.max(0.2, Math.min(1, ageFade * energyFade));

            // Size based on original agent size
            const baseRadius = 3 + corpse.size * 1.5;

            // Draw corpse as a gray, fading shape
            ctx.globalAlpha = alpha;

            // Outer body (dark gray)
            ctx.fillStyle = '#555555';
            ctx.beginPath();
            ctx.arc(corpse.position.x, corpse.position.y, baseRadius, 0, Math.PI * 2);
            ctx.fill();

            // Inner detail (darker)
            ctx.fillStyle = '#333333';
            ctx.beginPath();
            ctx.arc(corpse.position.x, corpse.position.y, baseRadius * 0.6, 0, Math.PI * 2);
            ctx.fill();

            // "X" marks to indicate death
            ctx.strokeStyle = '#222222';
            ctx.lineWidth = 1;
            const xSize = baseRadius * 0.4;
            ctx.beginPath();
            ctx.moveTo(corpse.position.x - xSize, corpse.position.y - xSize);
            ctx.lineTo(corpse.position.x + xSize, corpse.position.y + xSize);
            ctx.moveTo(corpse.position.x + xSize, corpse.position.y - xSize);
            ctx.lineTo(corpse.position.x - xSize, corpse.position.y + xSize);
            ctx.stroke();

            ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Render DNA fragments in environment
     */
    renderDNAFragments(ctx) {
        if (!state.dnaFragments || state.dnaFragments.length === 0) return;

        ctx.fillStyle = CONFIG.COLORS.dna_fragment;

        for (const fragment of state.dnaFragments) {
            ctx.globalAlpha = fragment.integrity || 1.0;
            ctx.beginPath();
            ctx.arc(fragment.position.x, fragment.position.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1.0;
    }

    /**
     * Render viral particles
     */
    renderViruses(ctx) {
        if (!state.viruses || state.viruses.length === 0) return;

        for (const virus of state.viruses) {
            this.renderVirus(ctx, virus);
        }
    }

    /**
     * Render a single virus
     */
    renderVirus(ctx, virus) {
        const x = virus.position.x;
        const y = virus.position.y;
        const size = CONFIG.VIRUS_RENDER_SIZE;

        // Calculate opacity based on remaining lifespan (fade as they age)
        const lifespanRatio = virus.lifespan / CONFIG.VIRUS_MAX_LIFESPAN;
        const alpha = Math.max(0.1, Math.min(1, lifespanRatio));

        // Also shrink slightly as they decay
        const decaySize = size * (0.6 + 0.4 * lifespanRatio);

        ctx.globalAlpha = alpha;

        // Virus body (hexagonal shape)
        ctx.fillStyle = CONFIG.COLORS.viral_particle;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const px = x + Math.cos(angle) * decaySize;
            const py = y + Math.sin(angle) * decaySize;
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.fill();

        // Injection spike
        ctx.strokeStyle = CONFIG.COLORS.viral_particle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + decaySize);
        ctx.lineTo(x, y + decaySize * 2);
        ctx.stroke();

        ctx.globalAlpha = 1.0;
    }

    /**
     * Render visual effects (HGT transfers, infections, etc.)
     */
    renderEffects(ctx) {
        if (!state.visualEvents || state.visualEvents.length === 0) return;

        for (const event of state.visualEvents) {
            this.renderVisualEvent(ctx, event);
        }
    }

    /**
     * Render a visual event
     */
    renderVisualEvent(ctx, event) {
        const alpha = 1 - (event.age / event.duration);

        switch (event.type) {
            case 'hgt_transfer':
                ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(event.from.x, event.from.y);
                ctx.lineTo(event.to.x, event.to.y);
                ctx.stroke();
                ctx.setLineDash([]);
                break;

            case 'infection':
                ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(event.position.x, event.position.y, 20 * (1 - alpha), 0, Math.PI * 2);
                ctx.stroke();
                break;

            case 'burst':
                ctx.strokeStyle = `rgba(255, 100, 0, ${alpha})`;
                ctx.lineWidth = 2;
                const radius = 10 + 20 * (event.age / event.duration);
                ctx.beginPath();
                ctx.arc(event.position.x, event.position.y, radius, 0, Math.PI * 2);
                ctx.stroke();
                break;

            case 'reproduction':
                ctx.fillStyle = `rgba(100, 255, 100, ${alpha})`;
                ctx.beginPath();
                ctx.arc(event.position.x, event.position.y, 8 * alpha, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'predation_success':
                // Red burst for successful kill
                ctx.strokeStyle = `rgba(255, 50, 50, ${alpha})`;
                ctx.fillStyle = `rgba(200, 0, 0, ${alpha * 0.5})`;
                ctx.lineWidth = 3;
                const killRadius = 15 + 10 * (event.age / event.duration);
                ctx.beginPath();
                ctx.arc(event.position.x, event.position.y, killRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Blood splatter effect
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const splatX = event.position.x + Math.cos(angle) * killRadius * 1.2;
                    const splatY = event.position.y + Math.sin(angle) * killRadius * 1.2;
                    ctx.beginPath();
                    ctx.arc(splatX, splatY, 3 * alpha, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'predation_fail':
                // Yellow flash for failed attack
                ctx.strokeStyle = `rgba(255, 200, 0, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(event.position.x, event.position.y, 12, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                break;

            case 'scavenge':
                // Green glow for scavenging
                ctx.fillStyle = `rgba(100, 200, 100, ${alpha * 0.6})`;
                ctx.beginPath();
                ctx.arc(event.position.x, event.position.y, 8, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }

    /**
     * Render cooperative links between kin
     */
    renderCooperativeLinks(ctx) {
        ctx.strokeStyle = CONFIG.COLORS.cooperative_link;
        ctx.lineWidth = 1;

        for (const agent of state.agents) {
            if (!agent.alive || !agent.cooperative_links) continue;

            for (const link of agent.cooperative_links) {
                const partner = state.agents.find(a => a.id === link.partner_id);
                if (partner && partner.alive) {
                    ctx.beginPath();
                    ctx.moveTo(agent.position.x, agent.position.y);
                    ctx.lineTo(partner.position.x, partner.position.y);
                    ctx.stroke();
                }
            }
        }
    }

    /**
     * Render symbiotic bonds
     */
    renderSymbioticBonds(ctx) {
        ctx.strokeStyle = CONFIG.COLORS.symbiotic_bond;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);

        for (const agent of state.agents) {
            if (!agent.alive) continue;

            if (agent.symbiont) {
                const symbiont = state.agents.find(a => a.id === agent.symbiont);
                if (symbiont && symbiont.alive) {
                    ctx.beginPath();
                    ctx.moveTo(agent.position.x, agent.position.y);
                    ctx.lineTo(symbiont.position.x, symbiont.position.y);
                    ctx.stroke();
                }
            }
        }

        ctx.setLineDash([]);
    }

    /**
     * Toggle layer visibility
     */
    toggleLayer(layer) {
        if (this.layerVisible.hasOwnProperty(layer)) {
            this.layerVisible[layer] = !this.layerVisible[layer];
        }
    }

    /**
     * Set layer visibility
     */
    setLayerVisible(layer, visible) {
        if (this.layerVisible.hasOwnProperty(layer)) {
            this.layerVisible[layer] = visible;
        }
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = screenX - rect.left;
        const canvasY = screenY - rect.top;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        return {
            x: (canvasX - centerX) / state.camera.zoom + state.camera.x,
            y: (canvasY - centerY) / state.camera.zoom + state.camera.y
        };
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldX, worldY) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        return {
            x: (worldX - state.camera.x) * state.camera.zoom + centerX,
            y: (worldY - state.camera.y) * state.camera.zoom + centerY
        };
    }

    /**
     * Check if a world position is visible on screen
     */
    isVisible(worldX, worldY, margin = 50) {
        const screen = this.worldToScreen(worldX, worldY);
        return screen.x >= -margin &&
               screen.x <= this.canvas.width + margin &&
               screen.y >= -margin &&
               screen.y <= this.canvas.height + margin;
    }

    /**
     * Get visible bounds in world coordinates
     */
    getVisibleBounds() {
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(this.canvas.width, this.canvas.height);

        return {
            left: topLeft.x,
            top: topLeft.y,
            right: bottomRight.x,
            bottom: bottomRight.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
        };
    }

    /**
     * Center camera on a position
     */
    centerOn(x, y) {
        state.camera.x = x;
        state.camera.y = y;
    }

    /**
     * Center camera on an entity
     */
    centerOnEntity(entity) {
        if (entity && entity.position) {
            this.centerOn(entity.position.x, entity.position.y);
        }
    }

    /**
     * Get render statistics
     */
    getRenderStats() {
        return {
            totalTime: state.renderTime,
            layerTimes: { ...this.renderTimes },
            visibleAgents: state.agents.filter(a =>
                a.alive && this.isVisible(a.position.x, a.position.y)
            ).length
        };
    }

    /**
     * Handle canvas resize
     */
    handleResize() {
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        }
    }
}

/**
 * Create renderer instance
 */
export function createRenderer(canvas) {
    return new Renderer(canvas);
}

/**
 * Graphs and Charts
 *
 * Renders data visualizations for simulation statistics
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { getSpeciesColor } from '../core/species.js';

/**
 * Graph renderer class
 */
export class GraphRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.padding = { top: 20, right: 20, bottom: 30, left: 50 };
    }

    /**
     * Clear the canvas
     */
    clear() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draw population timeline
     */
    drawPopulationTimeline(history) {
        this.clear();
        const ctx = this.ctx;
        const width = this.canvas.width - this.padding.left - this.padding.right;
        const height = this.canvas.height - this.padding.top - this.padding.bottom;

        if (!history || history.length < 2) {
            this.drawNoDataMessage();
            return;
        }

        // Find max value
        const maxPop = Math.max(...history.map(h => h.count), 10);

        // Draw axes
        this.drawAxes(maxPop, 'Population', 'Time');

        // Draw line
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < history.length; i++) {
            const x = this.padding.left + (i / (history.length - 1)) * width;
            const y = this.padding.top + height - (history[i].count / maxPop) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        // Draw current value
        const current = history[history.length - 1];
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.fillText(`Current: ${current.count}`, this.padding.left + 10, this.padding.top + 15);
    }

    /**
     * Draw species diversity chart
     */
    drawSpeciesDiversity() {
        this.clear();
        const ctx = this.ctx;
        const width = this.canvas.width - this.padding.left - this.padding.right;
        const height = this.canvas.height - this.padding.top - this.padding.bottom;

        // Count species
        const speciesCounts = new Map();
        for (const agent of state.agents) {
            if (!agent.alive) continue;
            const marker = agent.genome.species_marker;
            speciesCounts.set(marker, (speciesCounts.get(marker) || 0) + 1);
        }

        if (speciesCounts.size === 0) {
            this.drawNoDataMessage();
            return;
        }

        // Sort by count
        const sorted = Array.from(speciesCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const total = sorted.reduce((sum, [_, count]) => sum + count, 0);
        const barHeight = height / sorted.length - 5;

        // Draw bars
        for (let i = 0; i < sorted.length; i++) {
            const [marker, count] = sorted[i];
            const barWidth = (count / total) * width;
            const y = this.padding.top + i * (barHeight + 5);

            ctx.fillStyle = getSpeciesColor(marker);
            ctx.fillRect(this.padding.left, y, barWidth, barHeight);

            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px monospace';
            ctx.fillText(`#${String(marker).slice(0, 6)}: ${count}`, this.padding.left + 5, y + barHeight / 2 + 3);
        }

        // Title
        ctx.fillStyle = '#888888';
        ctx.font = '12px monospace';
        ctx.fillText('Species Distribution', this.padding.left, this.padding.top - 5);
    }

    /**
     * Draw fitness distribution
     */
    drawFitnessDistribution() {
        this.clear();
        const ctx = this.ctx;
        const width = this.canvas.width - this.padding.left - this.padding.right;
        const height = this.canvas.height - this.padding.top - this.padding.bottom;

        // Get fitness values
        const fitnesses = state.agents
            .filter(a => a.alive)
            .map(a => a.fitness || 0);

        if (fitnesses.length === 0) {
            this.drawNoDataMessage();
            return;
        }

        // Create histogram
        const bins = 20;
        const minFit = Math.min(...fitnesses);
        const maxFit = Math.max(...fitnesses);
        const range = maxFit - minFit || 1;
        const binWidth = range / bins;

        const histogram = new Array(bins).fill(0);
        for (const fit of fitnesses) {
            const bin = Math.min(bins - 1, Math.floor((fit - minFit) / binWidth));
            histogram[bin]++;
        }

        const maxCount = Math.max(...histogram, 1);
        const barWidth = width / bins - 2;

        // Draw bars
        for (let i = 0; i < bins; i++) {
            const barHeight = (histogram[i] / maxCount) * height;
            const x = this.padding.left + i * (barWidth + 2);
            const y = this.padding.top + height - barHeight;

            // Color based on fitness level
            const hue = (i / bins) * 120; // Red to green
            ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
            ctx.fillRect(x, y, barWidth, barHeight);
        }

        // Axes labels
        ctx.fillStyle = '#888888';
        ctx.font = '10px monospace';
        ctx.fillText(minFit.toFixed(1), this.padding.left, this.canvas.height - 5);
        ctx.fillText(maxFit.toFixed(1), this.canvas.width - this.padding.right - 30, this.canvas.height - 5);

        // Title
        ctx.fillText('Fitness Distribution', this.padding.left, this.padding.top - 5);
    }

    /**
     * Draw energy distribution
     */
    drawEnergyDistribution() {
        this.clear();
        const ctx = this.ctx;
        const width = this.canvas.width - this.padding.left - this.padding.right;
        const height = this.canvas.height - this.padding.top - this.padding.bottom;

        // Get energy ratios
        const energies = state.agents
            .filter(a => a.alive)
            .map(a => a.energy / a.genome.metabolism.storage_capacity);

        if (energies.length === 0) {
            this.drawNoDataMessage();
            return;
        }

        // Create histogram (0-1 range)
        const bins = 10;
        const histogram = new Array(bins).fill(0);
        for (const energy of energies) {
            const bin = Math.min(bins - 1, Math.floor(energy * bins));
            histogram[bin]++;
        }

        const maxCount = Math.max(...histogram, 1);
        const barWidth = width / bins - 2;

        // Draw bars
        for (let i = 0; i < bins; i++) {
            const barHeight = (histogram[i] / maxCount) * height;
            const x = this.padding.left + i * (barWidth + 2);
            const y = this.padding.top + height - barHeight;

            // Color: red (low) to green (high)
            const r = Math.round(255 * (1 - i / bins));
            const g = Math.round(255 * (i / bins));
            ctx.fillStyle = `rgb(${r}, ${g}, 50)`;
            ctx.fillRect(x, y, barWidth, barHeight);
        }

        // Labels
        ctx.fillStyle = '#888888';
        ctx.font = '10px monospace';
        ctx.fillText('0%', this.padding.left, this.canvas.height - 5);
        ctx.fillText('100%', this.canvas.width - this.padding.right - 25, this.canvas.height - 5);
        ctx.fillText('Energy Distribution', this.padding.left, this.padding.top - 5);
    }

    /**
     * Draw multi-line history chart
     */
    drawMultiLineHistory(datasets, labels, colors) {
        this.clear();
        const ctx = this.ctx;
        const width = this.canvas.width - this.padding.left - this.padding.right;
        const height = this.canvas.height - this.padding.top - this.padding.bottom;

        if (!datasets || datasets.length === 0 || datasets[0].length < 2) {
            this.drawNoDataMessage();
            return;
        }

        // Find max across all datasets
        let maxVal = 0;
        for (const data of datasets) {
            const max = Math.max(...data.map(d => d.value || d.count || 0));
            if (max > maxVal) maxVal = max;
        }
        maxVal = maxVal || 1;

        // Draw axes
        this.drawAxes(maxVal, '', 'Time');

        // Draw each line
        for (let d = 0; d < datasets.length; d++) {
            const data = datasets[d];
            ctx.strokeStyle = colors[d] || '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let i = 0; i < data.length; i++) {
                const x = this.padding.left + (i / (data.length - 1)) * width;
                const val = data[i].value || data[i].count || 0;
                const y = this.padding.top + height - (val / maxVal) * height;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }

        // Legend
        for (let d = 0; d < labels.length; d++) {
            ctx.fillStyle = colors[d] || '#ffffff';
            ctx.fillRect(this.padding.left + d * 80, this.padding.top - 15, 10, 10);
            ctx.fillStyle = '#888888';
            ctx.font = '10px monospace';
            ctx.fillText(labels[d], this.padding.left + d * 80 + 15, this.padding.top - 6);
        }
    }

    /**
     * Draw axes
     */
    drawAxes(maxY, yLabel, xLabel) {
        const ctx = this.ctx;
        const width = this.canvas.width - this.padding.left - this.padding.right;
        const height = this.canvas.height - this.padding.top - this.padding.bottom;

        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 1;

        // Y axis
        ctx.beginPath();
        ctx.moveTo(this.padding.left, this.padding.top);
        ctx.lineTo(this.padding.left, this.padding.top + height);
        ctx.stroke();

        // X axis
        ctx.beginPath();
        ctx.moveTo(this.padding.left, this.padding.top + height);
        ctx.lineTo(this.padding.left + width, this.padding.top + height);
        ctx.stroke();

        // Y axis labels
        ctx.fillStyle = '#666666';
        ctx.font = '10px monospace';
        ctx.fillText(maxY.toFixed(0), 5, this.padding.top + 10);
        ctx.fillText('0', 5, this.padding.top + height);

        // Axis titles
        if (yLabel) {
            ctx.save();
            ctx.translate(12, this.padding.top + height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(yLabel, 0, 0);
            ctx.restore();
        }
        if (xLabel) {
            ctx.fillText(xLabel, this.padding.left + width / 2, this.canvas.height - 5);
        }
    }

    /**
     * Draw no data message
     */
    drawNoDataMessage() {
        const ctx = this.ctx;
        ctx.fillStyle = '#666666';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('No data yet', this.canvas.width / 2, this.canvas.height / 2);
        ctx.textAlign = 'left';
    }
}

/**
 * Create a mini sparkline
 */
export function drawSparkline(ctx, x, y, width, height, data, color = '#4a9eff') {
    if (!data || data.length < 2) return;

    const max = Math.max(...data, 1);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
        const px = x + (i / (data.length - 1)) * width;
        const py = y + height - (data[i] / max) * height;

        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.stroke();
}

/**
 * Create graph container
 */
export function createGraphPanel(id, title, width = 300, height = 150) {
    const container = document.createElement('div');
    container.className = 'graph-panel';
    container.innerHTML = `
        <div class="graph-header">${title}</div>
        <canvas id="${id}" width="${width}" height="${height}"></canvas>
    `;
    return container;
}

/**
 * Initialize all graphs
 */
export function initGraphs() {
    const graphContainer = document.getElementById('graphs-container');
    if (!graphContainer) return {};

    // Create graph panels
    graphContainer.appendChild(createGraphPanel('graph-population', 'Population'));
    graphContainer.appendChild(createGraphPanel('graph-species', 'Species'));
    graphContainer.appendChild(createGraphPanel('graph-fitness', 'Fitness'));
    graphContainer.appendChild(createGraphPanel('graph-energy', 'Energy'));

    // Create renderers
    return {
        population: new GraphRenderer(document.getElementById('graph-population')),
        species: new GraphRenderer(document.getElementById('graph-species')),
        fitness: new GraphRenderer(document.getElementById('graph-fitness')),
        energy: new GraphRenderer(document.getElementById('graph-energy'))
    };
}

/**
 * Update all graphs
 */
export function updateGraphs(renderers) {
    if (!renderers) return;

    if (renderers.population) {
        renderers.population.drawPopulationTimeline(state.history.population);
    }
    if (renderers.species) {
        renderers.species.drawSpeciesDiversity();
    }
    if (renderers.fitness) {
        renderers.fitness.drawFitnessDistribution();
    }
    if (renderers.energy) {
        renderers.energy.drawEnergyDistribution();
    }
}

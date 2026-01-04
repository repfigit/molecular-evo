/**
 * UI Panels
 *
 * Reusable panel components for displaying simulation data
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { getSpeciesColor } from '../core/species.js';

/**
 * Update all UI panels
 */
export function updateAllPanels() {
    updateEnvironmentPanel();
    updatePopulationPanel();
    updateGenerationDisplay();
}

/**
 * Update environment panel
 */
export function updateEnvironmentPanel() {
    const env = state.environment;
    if (!env) return;

    // Temperature
    const tempEl = document.getElementById('value-temperature');
    const tempGauge = document.getElementById('gauge-temperature');
    if (tempEl) tempEl.textContent = env.temperature.toFixed(2);
    if (tempGauge) tempGauge.style.width = (env.temperature * 100) + '%';

    // Viscosity
    const viscEl = document.getElementById('value-viscosity');
    const viscGauge = document.getElementById('gauge-viscosity');
    if (viscEl) viscEl.textContent = env.viscosity.toFixed(2);
    if (viscGauge) viscGauge.style.width = (env.viscosity * 100) + '%';
}

/**
 * Update population panel
 */
export function updatePopulationPanel() {
    const stats = state.stats;

    setElementText('value-total-agents', stats.totalAgents);
    setElementText('value-species-count', stats.speciesCount);
    setElementText('value-cooperating', stats.cooperatingCount);
    setElementText('value-symbiotic', stats.symbioticCount);
    setElementText('value-avg-plasmids', stats.avgPlasmids.toFixed(1));
    setElementText('value-infected', stats.infectedCount);
    setElementText('value-dna-fragments', stats.dnaFragmentCount);
    setElementText('value-viral-load', stats.viralLoad);
}

/**
 * Update generation display
 */
export function updateGenerationDisplay() {
    setElementText('generation-count', state.generation);
    setElementText('fps-count', state.fps);
}

/**
 * Update species list panel
 */
export function updateSpeciesPanel() {
    const container = document.getElementById('species-list');
    if (!container) return;

    // Get species counts
    const speciesCounts = new Map();
    for (const agent of state.agents) {
        if (!agent.alive) continue;
        const marker = agent.genome.species_marker;
        speciesCounts.set(marker, (speciesCounts.get(marker) || 0) + 1);
    }

    // Sort by count
    const sorted = Array.from(speciesCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10

    // Build HTML
    let html = '';
    for (const [marker, count] of sorted) {
        const color = getSpeciesColor(marker);
        const percent = ((count / state.agents.length) * 100).toFixed(1);
        html += `
            <div class="species-item">
                <div class="species-color" style="background: ${color}"></div>
                <span class="species-marker">${marker.substring(0, 8)}</span>
                <span class="species-count">${count}</span>
                <div class="species-bar" style="width: ${percent}%; background: ${color}"></div>
            </div>
        `;
    }

    container.innerHTML = html || '<div class="empty-state">No species yet</div>';
}

/**
 * Update selected entity panel
 */
export function updateSelectedPanel(getColorFn) {
    const content = document.getElementById('selected-content');
    if (!content) return;

    if (!state.selectedEntity) {
        content.innerHTML = '<div class="empty-state">Click an agent to inspect</div>';
        return;
    }

    const agent = state.selectedEntity;
    const color = getColorFn ? getColorFn(agent) : '#ffffff';

    content.innerHTML = `
        <div class="selected-header">
            <div class="selected-icon" style="background: ${color}"></div>
            <div>
                <div class="selected-title">Species ${agent.genome.species_marker.substring(0, 8)}</div>
                <div class="selected-subtitle">Gen ${agent.genome.generation}</div>
            </div>
        </div>
        <div class="stat-row">
            <span class="stat-label">Energy</span>
            <div class="gauge-container">
                <div class="gauge-fill energy" style="width: ${(agent.energy / agent.genome.metabolism.storage_capacity * 100)}%"></div>
            </div>
            <span class="stat-value">${agent.energy.toFixed(0)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Age</span>
            <span class="stat-value">${agent.age}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Fitness</span>
            <span class="stat-value">${(agent.fitness || 0).toFixed(1)}</span>
        </div>
        <div class="subheader">Genome</div>
        <div class="stat-row">
            <span class="stat-label">Nodes</span>
            <span class="stat-value">${agent.genome.nodes.length}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Links</span>
            <span class="stat-value">${agent.genome.links.length}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Motors</span>
            <span class="stat-value">${agent.genome.motors.length}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Sensors</span>
            <span class="stat-value">${agent.genome.sensors.length}</span>
        </div>
        <div class="subheader">Social</div>
        <div class="stat-row">
            <span class="stat-label">Cooperation</span>
            <span class="stat-value">${(agent.genome.social.cooperation_willingness * 100).toFixed(0)}%</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Aggression</span>
            <span class="stat-value">${(agent.genome.social.aggression * 100).toFixed(0)}%</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Offspring</span>
            <span class="stat-value">${agent.offspring || 0}</span>
        </div>
        <div class="subheader">Status</div>
        <div class="stat-row">
            <span class="stat-label">Infection</span>
            <span class="stat-value ${agent.infection ? 'status-danger' : 'status-healthy'}">
                ${agent.infection ? agent.infection.stage : 'Healthy'}
            </span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Plasmids</span>
            <span class="stat-value">${agent.genome.hgt.plasmids.length}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">CRISPR Memory</span>
            <span class="stat-value">${agent.genome.crispr?.memory?.length || 0}</span>
        </div>
    `;
}

/**
 * Create a stat row element
 */
export function createStatRow(label, value, options = {}) {
    const row = document.createElement('div');
    row.className = 'stat-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'stat-value';
    if (options.class) valueEl.classList.add(options.class);
    valueEl.textContent = value;

    row.appendChild(labelEl);

    if (options.gauge) {
        const gaugeContainer = document.createElement('div');
        gaugeContainer.className = 'gauge-container';
        const gaugeFill = document.createElement('div');
        gaugeFill.className = 'gauge-fill';
        if (options.gaugeClass) gaugeFill.classList.add(options.gaugeClass);
        gaugeFill.style.width = options.gauge + '%';
        gaugeContainer.appendChild(gaugeFill);
        row.appendChild(gaugeContainer);
    }

    row.appendChild(valueEl);
    return row;
}

/**
 * Create a collapsible panel
 */
export function createCollapsiblePanel(title, contentEl, expanded = true) {
    const panel = document.createElement('div');
    panel.className = 'panel collapsible';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `
        <span class="panel-title">${title}</span>
        <span class="collapse-icon">${expanded ? '−' : '+'}</span>
    `;

    const content = document.createElement('div');
    content.className = 'panel-content';
    if (!expanded) content.style.display = 'none';
    content.appendChild(contentEl);

    header.addEventListener('click', () => {
        const icon = header.querySelector('.collapse-icon');
        if (content.style.display === 'none') {
            content.style.display = '';
            icon.textContent = '−';
        } else {
            content.style.display = 'none';
            icon.textContent = '+';
        }
    });

    panel.appendChild(header);
    panel.appendChild(content);
    return panel;
}

/**
 * Show a toast notification
 */
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Create toast container if it doesn't exist
 */
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    return container;
}

/**
 * Helper to set element text safely
 */
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/**
 * Format large numbers
 */
export function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

/**
 * Format time duration
 */
export function formatDuration(ticks) {
    const seconds = Math.floor(ticks * CONFIG.DT);
    if (seconds < 60) return seconds + 's';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ' + (seconds % 60) + 's';
    const hours = Math.floor(minutes / 60);
    return hours + 'h ' + (minutes % 60) + 'm';
}

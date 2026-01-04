# Visual Enhancements - Implementation Guide

This guide shows how to integrate the new rendering modules into your molecular evolution simulation.

## Files Added

1. **js/rendering/immunityRenderer.js** - Visualize immune system status
2. **js/rendering/plasmidRenderer.js** - Visualize HGT and plasmid content
3. **js/ui/evolutionStatsPanel.js** - Display evolutionary statistics overlay

## Integration Steps

### Step 1: Update agentRenderer.js

Add immunity and plasmid visualization to the existing agent rendering:

```javascript
// At the top of agentRenderer.js, add imports:
import { renderImmunityIndicator } from './immunityRenderer.js';
import { renderPlasmidStatus } from './plasmidRenderer.js';

// In renderAgent() function, after rendering infection indicator:
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

    // NEW: Draw immunity indicator
    renderImmunityIndicator(ctx, agent);

    // NEW: Draw plasmid status
    renderPlasmidStatus(ctx, agent);

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
```

### Step 2: Update renderer.js

Add new overlay modes and event rendering:

```javascript
// In renderer.js, update the constructor to include new layers:

this.layers = [
    'environment',      // Background, resources, temperature
    'grid',             // Spatial hash grid (debug)
    'food',             // Food particles
    'corpses',          // Dead agent bodies
    'dna',              // DNA fragments
    'agents',           // Agents/organisms
    'viruses',          // Viral particles
    'effects',          // HGT transfers, infections, predation
    'cooperative',      // Cooperative links
    'symbiotic',        // Symbiotic bonds
    'immunity',         // NEW: Immunity indicators (rendered with agents)
    'plasmids',         // NEW: Plasmid indicators (rendered with agents)
    'ui'                // Selection, tooltips
];

// Or if keeping visual elements on agent render, ensure they're called during renderLayer()
```

### Step 3: Update environmentRenderer.js

Add support for new overlay modes:

```javascript
// In renderOverlay() function, add cases:

function renderOverlay(ctx, environment) {
    switch (state.overlayMode) {
        case 'resources':
            renderResourceOverlay(ctx, environment);
            break;
        case 'temperature':
            renderTemperatureOverlay(ctx, environment);
            break;
        // ... existing cases ...
        case 'immunity':
            renderImmunityOverlay(ctx);
            break;
        case 'plasmids':
            renderPlasmidOverlay(ctx);
            break;
        case 'species':
            renderSpeciesOverlay(ctx);
            break;
        // ... rest of cases ...
    }
}

// Add new overlay functions:

function renderImmunityOverlay(ctx) {
    if (!state.agents || state.agents.length === 0) return;

    const cellSize = 50;
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / cellSize);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / cellSize);

    // Count immunity investment per cell
    const immunityDensity = new Array(rows).fill(null).map(() => new Array(cols).fill(0));
    const immunityCount = new Array(rows).fill(null).map(() => new Array(cols).fill(0));

    for (const agent of state.agents) {
        if (!agent.alive) continue;

        const cx = Math.floor(agent.position.x / cellSize);
        const cy = Math.floor(agent.position.y / cellSize);

        if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
            const innateStr = agent.genome.immunity?.innate_immunity?.strength || 0;
            const adaptiveStr = Math.min((agent.genome.immunity?.crispr?.spacers?.length || 0) / 10, 1);
            const combined = (innateStr + adaptiveStr) / 2;

            immunityDensity[cy][cx] += combined;
            immunityCount[cy][cx]++;
        }
    }

    ctx.globalAlpha = 0.35;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (immunityCount[y][x] > 0) {
                const avgImmunity = immunityDensity[y][x] / immunityCount[y][x];
                const intensity = Math.min(1, avgImmunity);

                // Yellow-blue gradient: yellow for innate, blue for adaptive
                const r = Math.round(255 * intensity);
                const g = Math.round(200 * intensity);
                const b = Math.round(100 * (1 - intensity) + 255 * intensity);

                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${intensity})`;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    ctx.globalAlpha = 1.0;
}

function renderPlasmidOverlay(ctx) {
    if (!state.agents || state.agents.length === 0) return;

    const cellSize = 50;
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / cellSize);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / cellSize);

    // Count plasmids per cell
    const plasmidDensity = new Array(rows).fill(null).map(() => new Array(cols).fill(0));

    for (const agent of state.agents) {
        if (!agent.alive) continue;

        const cx = Math.floor(agent.position.x / cellSize);
        const cy = Math.floor(agent.position.y / cellSize);

        if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
            const count = agent.genome.hgt?.plasmids?.length || 0;
            plasmidDensity[cy][cx] += count;
        }
    }

    ctx.globalAlpha = 0.4;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (plasmidDensity[y][x] > 0) {
                const intensity = Math.min(1, plasmidDensity[y][x] / 10);
                ctx.fillStyle = `rgba(255, 100, 200, ${intensity})`;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    ctx.globalAlpha = 1.0;
}
```

### Step 4: Update UI Controls

Add new overlay options to the HTML/controls:

```javascript
// In ui/controls.js or HTML overlay-select element, add options:

const overlaySelect = document.getElementById('overlay-select');

// Add new options:
// <option value="immunity">Immunity</option>
// <option value="plasmids">Plasmids</option>

// And update the color mode select:
const colorModeSelect = document.getElementById('color-mode-select');

// Consider adding:
// <option value="immunity">Immunity</option>
// <option value="plasmid_load">Plasmid Load</option>
```

### Step 5: Add Evolutionary Statistics Widget

Create a new UI element to show stats overlay:

```javascript
// In main.js or state update loop:
import { calculateEvolutionaryStats, renderEvolutionaryStatsWidget } from './ui/evolutionStatsPanel.js';

// In your render loop (after canvas clear):
if (state.showEvolutionaryStats) {
    const stats = calculateEvolutionaryStats(state.agents, state.environment);
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Save context transform state
    ctx.save();
    // Make sure we're in screen space, not world space
    ctx.resetTransform();

    // Render widget in top-left corner
    renderEvolutionaryStatsWidget(ctx, stats, 10, 10, 450, 190);

    // Restore transform state
    ctx.restore();
}

// Add toggle for showing/hiding stats (e.g., keyboard shortcut)
// Add button to controls: <button id="btn-toggle-stats">Stats</button>
```

### Step 6: Add Event Handling for New Visuals

Update your event system to emit visual events for evolutionary milestones:

```javascript
// In systems/evolution.js or events.js:
import { renderHGTTransferEvent, renderHGTIntegrationEvent, renderPlasmidLossEvent } from '../rendering/plasmidRenderer.js';

// When HGT transfer occurs:
state.visualEvents.push({
    type: 'hgt_success',
    from: { x: donorAgent.position.x, y: donorAgent.position.y },
    to: { x: recipientAgent.position.x, y: recipientAgent.position.y },
    age: 0,
    duration: 20  // ticks
});

// When speciation occurs:
state.visualEvents.push({
    type: 'speciation',
    position: { x: newSpecies.centerX, y: newSpecies.centerY },
    age: 0,
    duration: 30
});

// When new immunity response activates:
if (agent.infection && agent.infection.stage === 'lytic') {
    state.visualEvents.push({
        type: 'viral_defense',
        position: { x: agent.position.x, y: agent.position.y },
        age: 0,
        duration: 25
    });
}
```

## Usage Examples

### Example 1: Show Immunity Status for Selected Agent

```javascript
// In your selected entity panel (ui/panels.js):
import { renderImmunityDetail } from '../rendering/immunityRenderer.js';

// When displaying selected agent:
if (state.selectedEntity && state.selectedType === 'agent') {
    const panelX = 20;
    const panelY = 100;
    const panelWidth = 250;
    const panelHeight = 180;

    renderImmunityDetail(ctx, state.selectedEntity, panelX, panelY, panelWidth, panelHeight);
}
```

### Example 2: Switch Between Color Modes Including New Ones

```javascript
// In agentRenderer.js, update getAgentColor():

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

        // NEW:
        case 'immunity':
            // Import from immunityRenderer
            return getImmunityColor(agent);

        case 'plasmid_load':
            return plasmidLoadColor(agent.genome.hgt?.plasmids?.length || 0);

        default:
            return '#ffffff';
    }
}

function plasmidLoadColor(plasmidCount) {
    if (plasmidCount === 0) return '#666666';
    if (plasmidCount < 3) return '#FF9900';
    if (plasmidCount < 6) return '#FF6600';
    if (plasmidCount < 10) return '#FF3300';
    return '#CC0000';
}
```

### Example 3: Display Plasmid Inventory in Info Panel

```javascript
// In ui/panels.js when displaying selected agent info:
import { renderPlasmidInventory } from '../rendering/plasmidRenderer.js';

// In updateSelectedEntityPanel():
if (state.selectedEntity && state.selectedType === 'agent') {
    const agent = state.selectedEntity;

    // ... existing code ...

    // NEW: Show plasmids
    if (agent.genome.hgt.plasmids.length > 0) {
        const plasmidPanel = document.createElement('div');
        plasmidPanel.className = 'entity-detail-section';
        plasmidPanel.innerHTML = `
            <h4>Plasmids (${agent.genome.hgt.plasmids.length})</h4>
            <div id="plasmid-canvas-container"></div>
        `;

        const plasmidCanvas = document.createElement('canvas');
        plasmidCanvas.width = 300;
        plasmidCanvas.height = 120;
        const plasmidCtx = plasmidCanvas.getContext('2d');

        renderPlasmidInventory(plasmidCtx, agent, 5, 5, 290, 110);

        document.getElementById('plasmid-canvas-container').appendChild(plasmidCanvas);
    }
}
```

## Configuration Options

Add to CONFIG to customize visuals:

```javascript
// In js/config.js:

// Immunity visualization
IMMUNITY_RENDER_INNATE: true,        // Show innate immunity rings
IMMUNITY_RENDER_ADAPTIVE: true,      // Show CRISPR spikes
IMMUNITY_RENDER_AUTOIMMUNE: true,    // Show autoimmunity warnings
IMMUNITY_RING_WIDTH: 2,               // Pixels
IMMUNITY_SPIKE_LENGTH: 8,             // Pixels

// Plasmid visualization
PLASMID_RENDER_MODE: 'dots',          // 'dots', 'detailed', 'minimal'
PLASMID_MAX_VISIBLE: 16,              // Max plasmids to show visually
PLASMID_SHOW_COUNT_LABEL: true,       // Show "+X" for overflow
PLASMID_SHOW_LOAD_GLOW: true,         // Show glow based on plasmid count

// Statistics widget
SHOW_EVOLUTION_STATS: true,           // Display stats by default
EVOLUTION_STATS_POSITION: 'top-left', // 'top-left', 'top-right', etc.
EVOLUTION_STATS_UPDATE_INTERVAL: 30,  // Ticks between recalculation

// Color modes
AGENT_COLOR_MODES: [
    'species',
    'energy',
    'age',
    'fitness',
    'infection',
    'hgt',
    'cooperation',
    'symbiosis',
    'immunity',        // NEW
    'plasmid_load'     // NEW
],

// Overlay modes
OVERLAY_MODES: [
    'none',
    'resources',
    'temperature',
    'chemical_a',
    'chemical_b',
    'light',
    'species',
    'viral',
    'dna',
    'immunity',        // NEW
    'plasmids'         // NEW
]
```

## Performance Optimization Tips

### 1. Cull Hidden Indicators

Only render immunity/plasmid indicators for visible agents:

```javascript
// In agentRenderer.js renderAgent():
if (!isVisible(agent.position.x, agent.position.y)) {
    return; // Skip detail rendering for off-screen agents
}

renderImmunityIndicator(ctx, agent);
renderPlasmidStatus(ctx, agent);
```

### 2. Cache Statistical Calculations

Calculate evolutionary stats less frequently:

```javascript
// In main.js:
if (state.tick % 30 === 0) {
    state.cachedEvolutionaryStats = calculateEvolutionaryStats(state.agents, state.environment);
}
```

### 3. Reduce Detail at Zoom-Out

Simplify visuals when zoomed far out:

```javascript
// In agentRenderer.js:
if (state.camera.zoom < 0.5) {
    // Simplified rendering: just circles, no details
    renderSimplifiedAgent(ctx, agent);
} else {
    // Full detail rendering
    renderAgent(ctx, agent);
}
```

## Testing Checklist

- [ ] Immunity indicators display correctly on all agents
- [ ] Plasmid dots appear and color-code properly
- [ ] Overlay modes toggle without errors
- [ ] Color modes include new options
- [ ] Statistics widget updates in real-time
- [ ] HGT transfer events show visual effects
- [ ] Speciation events trigger visible responses
- [ ] Performance remains acceptable with 500+ agents
- [ ] Mobile/touch devices render correctly
- [ ] Color blind users can distinguish key indicators

## Troubleshooting

### Immunity indicators not showing
- Check CONFIG.IMMUNITY_RENDER_INNATE is true
- Verify agent.genome.immunity exists
- Check for canvas context transform issues

### Plasmids showing but not colored
- Ensure plasmid.gene_functions array is populated
- Verify getPlasmidColor() is called correctly
- Check CONFIG.PLASMID_RENDER_MODE setting

### Statistics widget overlapping other UI
- Adjust position in renderEvolutionaryStatsWidget() call
- Use CONFIG.EVOLUTION_STATS_POSITION for different placement
- Consider making widget draggable

### Performance drop with new visuals
- Reduce PLASMID_MAX_VISIBLE
- Increase EVOLUTION_STATS_UPDATE_INTERVAL
- Disable overlays by default in CONFIG
- Use zoom-based culling as shown above

## Next Steps

After integrating these improvements:

1. Add phylogenetic tree visualization in UI panel
2. Implement interactive species comparison tool
3. Add more evolutionary event types (mutation, rescue, etc.)
4. Create animation system for significant events
5. Build data export for analyzing evolution patterns

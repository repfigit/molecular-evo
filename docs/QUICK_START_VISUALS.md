# Quick Start: Visual Enhancements Integration

Get the visual improvements running in 15 minutes with these simple steps.

## Step 1: Copy New Files (1 minute)

New files have been created:
```
js/rendering/immunityRenderer.js      (immunity visualization)
js/rendering/plasmidRenderer.js        (HGT/plasmid visualization)
js/ui/evolutionStatsPanel.js           (evolutionary statistics)
CONFIG_VISUAL_ADDITIONS.js             (configuration options)
```

These are ready to use—no modifications needed yet.

## Step 2: Update agentRenderer.js (3 minutes)

**Location:** `js/rendering/agentRenderer.js`

**Add these imports at the top:**
```javascript
import { renderImmunityIndicator } from './immunityRenderer.js';
import { renderPlasmidStatus } from './plasmidRenderer.js';
```

**Find the `renderAgent()` function and add these lines after the infection indicator:**

```javascript
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

    // ADD THESE TWO LINES:
    renderImmunityIndicator(ctx, agent);
    renderPlasmidStatus(ctx, agent);

    // Draw carnivore indicator for predatory agents
    const carnivory = agent.genome.metabolism.carnivory || 0;
    // ... rest of function
}
```

## Step 3: Add Evolutionary Stats to Main Render Loop (3 minutes)

**Location:** `js/main.js`

**Add import at top:**
```javascript
import { calculateEvolutionaryStats, renderEvolutionaryStatsWidget } from './ui/evolutionStatsPanel.js';
```

**Find your main render loop** (likely in the `render()` or `animationFrame()` function) and add this AFTER you restore the canvas context from camera transform:

```javascript
// In your render loop, after ctx.restore() (world space to screen space):

// Render evolutionary stats widget
if (state.showEvolutionaryStats) {
    const stats = calculateEvolutionaryStats(state.agents, state.environment);
    ctx.save();
    ctx.resetTransform();

    renderEvolutionaryStatsWidget(ctx, stats, 10, 10, 450, 190);

    ctx.restore();
}
```

## Step 4: Update HTML Controls (2 minutes)

**Location:** `index.html`

**Find the overlay select element** (search for `overlay-select`) and add new options:

```html
<select id="overlay-select">
    <option value="none">None</option>
    <option value="resources">Resources</option>
    <option value="temperature">Temperature</option>
    <option value="species">Species</option>
    <option value="viral">Viral</option>
    <option value="dna">DNA Fragments</option>
    <!-- NEW OPTIONS -->
    <option value="immunity">Immunity</option>
    <option value="plasmids">Plasmids</option>
</select>
```

**Find the color mode select element** and add new options:

```html
<select id="color-mode-select">
    <option value="species">Species</option>
    <option value="energy">Energy</option>
    <option value="age">Age</option>
    <option value="fitness">Fitness</option>
    <option value="infection">Infection</option>
    <!-- NEW OPTIONS -->
    <option value="immunity">Immunity Status</option>
    <option value="plasmid_load">Plasmid Load</option>
</select>
```

## Step 5: Update environmentRenderer.js (3 minutes)

**Location:** `js/rendering/environmentRenderer.js`

**Find the `renderOverlay()` function and add new cases:**

```javascript
function renderOverlay(ctx, environment) {
    switch (state.overlayMode) {
        // ... existing cases ...

        // ADD THESE NEW CASES:
        case 'immunity':
            renderImmunityOverlay(ctx);
            break;
        case 'plasmids':
            renderPlasmidOverlay(ctx);
            break;
    }
}
```

**Add these functions at the end of the file:**

```javascript
/**
 * Render immunity distribution overlay
 */
function renderImmunityOverlay(ctx) {
    if (!state.agents || state.agents.length === 0) return;

    const cellSize = 50;
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / cellSize);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / cellSize);

    // Count immunity per cell
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
                const r = Math.round(255 * avgImmunity);
                const g = Math.round(200 * avgImmunity);
                const b = Math.round(100 * (1 - avgImmunity) + 255 * avgImmunity);

                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${avgImmunity})`;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    ctx.globalAlpha = 1.0;
}

/**
 * Render plasmid distribution overlay
 */
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

## Step 6: Update getAgentColor() Function (2 minutes)

**Location:** `js/rendering/agentRenderer.js`

**Find the `getAgentColor()` function and add new cases:**

```javascript
export function getAgentColor(agent) {
    switch (state.agentColorMode) {
        case 'species':
            return getSpeciesColor(agent.genome.species_marker);

        case 'energy':
            return energyColor(agent.energy / agent.genome.metabolism.storage_capacity);

        // ... existing cases ...

        // ADD THESE NEW CASES:
        case 'immunity': {
            const score = calculateImmunityScore(agent);
            if (score < 0.2) return '#FF6666';    // Red - weak
            if (score < 0.5) return '#FFAA44';    // Orange
            if (score < 0.8) return '#FFFF44';    // Yellow
            return '#00FF88';                      // Green - strong
        }

        case 'plasmid_load': {
            const count = agent.genome.hgt?.plasmids?.length || 0;
            if (count === 0) return '#666666';
            if (count < 3) return '#FF9900';
            if (count < 6) return '#FF6600';
            if (count < 10) return '#FF3300';
            return '#CC0000';
        }

        default:
            return '#ffffff';
    }
}

// Add helper function at the bottom of the file:
function calculateImmunityScore(agent) {
    if (!agent.genome?.immunity) return 0;
    const innate = (agent.genome.immunity.innate_immunity?.strength || 0) * 0.4;
    const adaptive = Math.min((agent.genome.immunity.crispr?.spacers?.length || 0) / 10, 1) * 0.6;
    return innate + adaptive;
}
```

## Testing Checklist

Run through these checks to verify everything works:

- [ ] Simulation loads without console errors
- [ ] Agents render with colored dots around them (plasmids)
- [ ] Agents have rings/spikes around them (immunity)
- [ ] Statistics panel appears in top-left corner
- [ ] Overlay modes can be switched (immunity, plasmids, etc.)
- [ ] Color modes can be switched (immunity status, plasmid load)
- [ ] Stats update as agents evolve
- [ ] FPS remains acceptable (30+)

## Verification Commands

**Check if new files exist:**
```bash
ls -lh js/rendering/immunityRenderer.js
ls -lh js/rendering/plasmidRenderer.js
ls -lh js/ui/evolutionStatsPanel.js
```

**Count lines of code added:**
```bash
wc -l js/rendering/immunityRenderer.js js/rendering/plasmidRenderer.js js/ui/evolutionStatsPanel.js
```

## What You Should See

### Immunity Visualization
- **Golden rings** around agents (innate immunity)
- **Blue spikes** radiating outward (CRISPR spacers - 1 per spacer)
- **Red dashed ring** if immunity too high (autoimmunity warning)

### Plasmid Visualization
- **Colored dots** arranged in circle around agent
  - Red = virulence genes
  - Green = metabolism genes
  - Magenta = cooperation genes
  - Cyan = motility genes
  - Yellow = resistance genes
- **Bright outline** on dots for HGT-acquired plasmids
- **"+X" label** if more than 16 plasmids

### Statistics Widget
- **Top-left panel** showing:
  - Species count
  - Agent count
  - Average fitness
  - Genetic diversity
  - Immune investment
  - CRISPR spacers count
  - Plasmid prevalence
  - Viral pressure
  - Cooperation rate
  - And more...

## Troubleshooting

### Immunity/Plasmids not showing?
1. Check imports are added to agentRenderer.js
2. Verify renderImmunityIndicator() and renderPlasmidStatus() are called
3. Check agent.genome.immunity and agent.genome.hgt exist
4. Look at browser console for errors

### Stats widget not appearing?
1. Check calculateEvolutionaryStats import
2. Verify state.showEvolutionaryStats is true
3. Check ctx.resetTransform() is called before rendering
4. Ensure render happens after ctx.restore()

### Colors look wrong?
1. Verify hex color codes are correct
2. Check rgba alpha values (should be 0-1)
3. Try refreshing browser cache (Ctrl+Shift+R)

### Performance dropped?
1. This is normal with new visuals
2. Reduce PLASMID_MAX_VISIBLE in config
3. Disable statistics on lower-end devices
4. Or disable plasmid rendering at high zoom-out levels

## Next Steps

Once basic integration works:

1. **Customize colors** - Edit color schemes in renderers
2. **Add more overlays** - Extend environmentRenderer.js
3. **Add UI controls** - Create toggles for showing/hiding features
4. **Performance tune** - Profile and optimize as needed
5. **Read full docs** - See VISUAL_IMPROVEMENTS.md for advanced features

## Documentation Files

- **VISUAL_ENHANCEMENTS_SUMMARY.md** - Overview and features
- **VISUAL_IMPROVEMENTS.md** - Detailed analysis and recommendations
- **VISUAL_IMPLEMENTATION_GUIDE.md** - Complete integration steps
- **CONFIG_VISUAL_ADDITIONS.js** - All configuration options
- **This file (QUICK_START_VISUALS.md)** - 15-minute setup

## Support

If stuck:
1. Check the code in new renderer files - it's well-commented
2. Read function JSDoc comments for usage
3. Compare with example code in this guide
4. Check browser DevTools console for errors
5. Refer to full implementation guide for detailed explanations

## Estimated Time Breakdown

- Copy files: 1 min
- Update agentRenderer.js: 3 min
- Update main.js: 3 min
- Update HTML: 2 min
- Update environmentRenderer.js: 3 min
- Update getAgentColor(): 2 min
- Testing: 2 min
- **Total: ~15 minutes**

That's it! You now have comprehensive visual enhancements showing immunity systems, plasmid content, and evolutionary statistics in real-time.

Enjoy visualizing molecular evolution!

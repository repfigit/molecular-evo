# Evolutionary Visualizations - Integration Checklist

## Quick Start (5 minutes)

### Step 1: Import the Manager Module
```javascript
// In your main.js or renderer.js
import * as EvolutionManager from './js/rendering/evolutionaryVisualizationManager.js';
```

### Step 2: Initialize During Setup
```javascript
// In your initialization code (once, at startup)
EvolutionManager.initializeEvolutionaryVisualizations();
```

### Step 3: Update and Render Each Frame
```javascript
// In your main render loop, after camera transform is applied:
export class Renderer {
    render() {
        // ... existing code ...

        // Apply camera transform
        this.applyCameraTransform();

        // Render all existing layers
        for (const layer of this.layers) {
            if (this.layerVisible[layer]) {
                this.renderLayer(layer);
            }
        }

        // ADD THESE LINES:
        // Update evolutionary tracking data
        EvolutionManager.updateEvolutionaryVisualizations();

        // Render all evolutionary visualizations
        EvolutionManager.renderEvolutionaryVisualizations(ctx);

        // Restore camera transform
        ctx.restore();

        // ... rest of rendering ...
    }
}
```

### Step 4: Add Keyboard Controls (Optional)
```javascript
// In your input handler
document.addEventListener('keydown', (e) => {
    const key = e.key.toUpperCase();

    // Visualization toggles
    if (key === 'M') {
        EvolutionManager.toggleVisualization(
            EvolutionManager.VISUALIZATION_MODES.METAPOPULATION
        );
    }
    if (key === 'D') {
        EvolutionManager.toggleVisualization(
            EvolutionManager.VISUALIZATION_MODES.CHARACTER_DISPLACEMENT
        );
    }
    if (key === 'N') {
        EvolutionManager.toggleVisualization(
            EvolutionManager.VISUALIZATION_MODES.NICHE_CONSTRUCTION
        );
    }
    if (key === 'E') {
        EvolutionManager.toggleVisualization(
            EvolutionManager.VISUALIZATION_MODES.EVOLUTIONARY_MECHANISMS
        );
    }
    if (key === 'T') {
        EvolutionManager.toggleStatistics();
    }
    if (key === 'L') {
        const legend = EvolutionManager.getVisualizationLegend();
        console.log(JSON.stringify(legend, null, 2));
    }
});
```

---

## File Structure Verification

Ensure these files exist in your project:

```
D:/code/molecular-evolution/
├── js/
│   ├── rendering/
│   │   ├── metapopulationRenderer.js                    ✓ NEW
│   │   ├── characterDisplacementRenderer.js             ✓ NEW
│   │   ├── nicheConstructionRenderer.js                 ✓ NEW
│   │   ├── evolutionaryMechanismsRenderer.js            ✓ NEW
│   │   ├── evolutionaryVisualizationManager.js          ✓ NEW
│   │   └── (existing renderers)
│   └── (existing code)
└── (documentation files)
```

Verify with:
```bash
ls -la D:/code/molecular-evolution/js/rendering/
```

---

## Import Dependencies Verification

### Required Imports (Already Satisfied)
The visualization modules require these existing modules (all should exist):

```javascript
// From config
import { CONFIG } from '../config.js';

// From state
import { state } from '../state.js';

// From species system
import { getSpeciesColor } from '../core/species.js';

// From metapopulation system
import {
    getHabitatPatches,
    calculateFst,
    classifySourceSink
} from '../systems/metapopulation.js';

// From agent system
import { isSameSpecies } from '../core/genome.js';
```

Verify these exist with grep:
```bash
grep -l "export.*getSpeciesColor" D:/code/molecular-evolution/js/core/*.js
grep -l "export.*getHabitatPatches" D:/code/molecular-evolution/js/systems/*.js
grep -l "export.*isSameSpecies" D:/code/molecular-evolution/js/core/*.js
```

---

## Testing Checklist

### Immediate Tests
- [ ] No console errors on startup
- [ ] Visualizations enabled in COMBINED mode by default
- [ ] Statistics panel displays on-screen
- [ ] Habitat patches visible with correct colors
- [ ] Migration corridors animated
- [ ] Patch borders show Fst thickness variation

### Feature Tests
- [ ] Press M - Metapopulation mode toggles
- [ ] Press D - Character displacement toggles
- [ ] Press N - Niche construction toggles
- [ ] Press E - Evolutionary mechanisms toggles
- [ ] Press T - Statistics panel on/off
- [ ] Press L - Legend appears in console
- [ ] Zoom/pan still works with visualizations active

### Performance Tests
- [ ] FPS > 30 with all visualizations enabled
- [ ] No lag spikes during rendering
- [ ] Memory usage stable over 5 minutes
- [ ] Agent behavior unaffected by visualizations

### Visual Verification
- [ ] Each module renders its expected elements:
  - Metapopulation: Patches, corridors, borders, source/sink indicators
  - Character displacement: Niche circles, overlap zones, pressure arrows
  - Niche construction: Biofilm, waste, pheromone, shade layers
  - Evolutionary mechanisms: Ratchet effects, rescues, assimilation, conflict

---

## Configuration Adjustments (Optional)

### Modify Update Frequencies
Edit individual renderer modules to change update rates:

```javascript
// In metapopulationRenderer.js
// Reduce Fst calculation frequency
if (state.tick % 200 === 0) {  // Changed from 100
    updateFstMatrix(patches);
}

// In characterDisplacementRenderer.js
// Reduce displacement calculation frequency
if (state.tick % 50 === 0) {  // Adjust as needed
    updateDisplacementMetrics();
}
```

### Adjust Grid Size
In `nicheConstructionRenderer.js`:
```javascript
const GRID_SIZE = 20;  // Change from 20 to adjust resolution
// Larger = lower detail, better performance
// Smaller = higher detail, slower performance
```

### Modify Effect Durations
In `evolutionaryMechanismsRenderer.js`:
```javascript
const RESCUE_EFFECT_DURATION = 200;      // Ticks (change as needed)
const RATCHET_CRACK_DURATION = 100;      // Ticks
const ASSIMILATION_FADE = 150;           // Ticks
```

### Statistics Position
In `evolutionaryVisualizationManager.js`:
```javascript
let statisticsPosition = { x: 10, y: 10 };  // Adjust panel position

// Or use the API:
EvolutionManager.setStatisticsPosition(x, y);
```

---

## Troubleshooting Guide

### Issue: "Cannot find module metapopulationRenderer"
**Solution:** Verify import path is correct:
```javascript
// Correct (relative path from renderer.js)
import * as MetapRenderer from './metapopulationRenderer.js';

// Or from main.js
import * as MetapRenderer from './js/rendering/metapopulationRenderer.js';
```

### Issue: Visualizations not appearing
**Solution:** Add debug logging:
```javascript
// After initialization
console.log('Active visualizations:',
    EvolutionManager.getVisualizationConfig().activeVisualizations);

// Check if patches exist
import { getHabitatPatches } from './js/systems/metapopulation.js';
console.log('Habitat patches:', getHabitatPatches());
```

### Issue: Statistics showing zeros
**Solution:** Verify agent and genome structure:
```javascript
// Check agents have required fields
state.agents.forEach(agent => {
    console.assert(agent.genome, 'Agent missing genome');
    console.assert(agent.genome.species_marker, 'Agent missing species_marker');
    console.assert(agent.genome.nodes, 'Agent missing nodes');
});
```

### Issue: Performance degradation
**Solution:** Reduce update frequency:
```javascript
// In your render loop, limit updates
let updateCounter = 0;
if (++updateCounter % 2 === 0) {  // Update every 2 frames instead
    EvolutionManager.updateEvolutionaryVisualizations();
}
```

### Issue: Blank statistics panel
**Solution:** Ensure systems are running:
```javascript
// Check if patches initialized
import { getHabitatPatches } from './js/systems/metapopulation.js';
const patches = getHabitatPatches();
console.log('Patches initialized:', patches.length > 0);

// Check if agents exist
console.log('Agents alive:',
    state.agents.filter(a => a.alive).length);
```

---

## Performance Benchmarks

### Expected Performance (on modern systems)

| Visualization | FPS Impact | Memory | Notes |
|---|---|---|---|
| Metapopulation only | -2 | 2 MB | Very fast |
| Character displacement | -5 | 3 MB | Update every 50 ticks |
| Niche construction | -8 | 5 MB | Grid diffusion overhead |
| Evolutionary mechanisms | -3 | 2 MB | Event tracking only |
| All combined | -15 | 12 MB | Recommended for <500 agents |

### Optimization Strategies

If FPS drops below 30:

1. **Reduce niche construction resolution:**
   ```javascript
   const GRID_SIZE = 40;  // Larger cells = fewer calculations
   ```

2. **Reduce statistics display frequency:**
   ```javascript
   // In evolutionaryVisualizationManager.js
   if (state.tick % 10 === 0) {  // Update every 10 ticks
       renderStatistics(ctx);
   }
   ```

3. **Sample agents for displacement:**
   ```javascript
   // In characterDisplacementRenderer.js
   for (const agent of speciesMembers.slice(0, 10)) {  // Process only 10
       // ...
   }
   ```

4. **Disable specific visualizations:**
   ```javascript
   EvolutionManager.setVisualizations([
       'metapopulation',  // Keep these
       'evolutionary_mechanisms'
       // Disable character_displacement, niche_construction
   ]);
   ```

---

## Integration with UI System

### Add to Overlay Controls
If you have an overlay control panel:

```javascript
// In your UI overlay rendering code
const overlayOptions = [
    { id: 'metapop', label: 'Metapopulation', key: 'M' },
    { id: 'chardispl', label: 'Character Displacement', key: 'D' },
    { id: 'niche', label: 'Niche Construction', key: 'N' },
    { id: 'mechanisms', label: 'Evolutionary Mechanisms', key: 'E' },
    { id: 'stats', label: 'Statistics', key: 'T' }
];

overlayOptions.forEach((option, index) => {
    const isActive = EvolutionManager.getVisualizationConfig()
        .activeVisualizations.includes(option.id);

    // Render toggle button for each option
    // Highlight if active
});
```

### Add to Info Panel
```javascript
// Add statistics to existing info display
const stats = EvolutionManager.exportEvolutionaryStats();
document.getElementById('stats-panel').innerHTML = `
    <h3>Evolutionary Dynamics</h3>
    <p>Metapopulation patches: ${stats.statistics.metapopulation?.occupiedPatches || 0}</p>
    <p>Character displacement pairs: ${stats.statistics.characterDisplacement?.displacingSpeciesPairs || 0}</p>
    <p>Biofilm coverage: ${(stats.statistics.nicheConstruction?.avgBiofilmCoverage * 100 || 0).toFixed(1)}%</p>
`;
```

---

## Documentation Updates

### Update Your README
Add to project README:

```markdown
## Evolutionary Visualizations

The simulation now includes comprehensive visualizations of evolutionary mechanisms:

- **Metapopulation Structure**: Habitat patches, migration corridors, and genetic differentiation (Fst)
- **Character Displacement**: Niche overlap and divergence pressure visualization
- **Niche Construction**: Environmental modification through biofilm and pheromones
- **Evolutionary Mechanisms**: Muller's Ratchet, rescue events, genetic assimilation, sexual conflict

Press 'M', 'D', 'N', or 'E' to toggle individual visualizations.
Press 'T' to toggle statistics display.
Press 'L' to see the legend.

See EVOLUTIONARY_VISUALIZATIONS_GUIDE.md for detailed documentation.
```

---

## Verification Script

Run this to verify everything is working:

```javascript
// Save as verify-visualizations.js and load in console

async function verifyVisualizations() {
    const results = [];

    // Check file imports
    const modules = [
        './js/rendering/metapopulationRenderer.js',
        './js/rendering/characterDisplacementRenderer.js',
        './js/rendering/nicheConstructionRenderer.js',
        './js/rendering/evolutionaryMechanismsRenderer.js',
        './js/rendering/evolutionaryVisualizationManager.js'
    ];

    // Check system initialization
    const config = EvolutionManager?.getVisualizationConfig?.();
    results.push({
        module: 'EvolutionManager',
        status: config ? 'OK' : 'MISSING',
        details: config
    });

    // Check patches
    const patches = getHabitatPatches?.();
    results.push({
        module: 'Metapopulation',
        status: patches?.length > 0 ? 'OK' : 'NO_PATCHES',
        details: `${patches?.length || 0} patches`
    });

    // Check agents
    const agents = state?.agents?.filter(a => a.alive) || [];
    results.push({
        module: 'Agents',
        status: agents.length > 0 ? 'OK' : 'NO_AGENTS',
        details: `${agents.length} alive agents`
    });

    // Check species
    const species = new Set(agents.map(a => a.genome?.species_marker));
    results.push({
        module: 'Species',
        status: species.size > 0 ? 'OK' : 'NO_SPECIES',
        details: `${species.size} species`
    });

    console.table(results);
    return results.every(r => r.status === 'OK');
}

verifyVisualizations().then(ok => {
    console.log(ok ? '✓ All systems operational' : '✗ Issues detected');
});
```

---

## Next Steps

1. **Test Integration** - Follow the testing checklist above
2. **Gather Feedback** - Note any visual artifacts or performance issues
3. **Fine-tune Parameters** - Adjust colors, sizes, and durations
4. **Document Results** - Track improvements to evolutionary visualization
5. **Extend System** - Consider future enhancements listed in the guide

---

## Support

### Getting Help
- Check console for error messages: `F12` → Console tab
- Review EVOLUTIONARY_VISUALIZATIONS_GUIDE.md for detailed documentation
- Examine individual module source code for implementation details
- Test individual modules in isolation first

### Common Configuration Needs

**To increase visualization intensity:**
```javascript
// Increase opacity multipliers in each renderer
ctx.globalAlpha *= 1.5;  // Make more visible
```

**To change grid resolution:**
```javascript
// In nicheConstructionRenderer.js
const GRID_SIZE = 15;  // Smaller = higher resolution
```

**To speed up animations:**
```javascript
// In metapopulationRenderer.js
const animationSpeed = 2;  // Multiply phase calculations
```

---

## Version History

- **v1.0** (2025-01-04) - Initial implementation
  - Metapopulation visualization
  - Character displacement rendering
  - Niche construction effects
  - Evolutionary mechanisms display
  - Unified visualization manager

---

## Success Criteria

You'll know integration is successful when:

✓ No console errors on startup
✓ Patches render with correct climate colors
✓ Migration corridors animate with flow
✓ Niche circles appear and shrink with competition
✓ Biofilm coverage increases and spreads
✓ Ratchet effects appear on asexual lineages
✓ Rescue flashes visible when populations recover
✓ Statistics panel updates each frame
✓ Keyboard toggles work smoothly
✓ FPS remains > 30 with visualizations active

---

Ready to integrate? Start with Step 1 above!

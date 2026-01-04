# Evolutionary Visualizations - Complete Implementation Guide

## Overview

This comprehensive visualization system brings advanced evolutionary mechanisms to life, making population genetics, ecological interactions, and microevolutionary processes **visually intuitive and scientifically accurate**.

The system consists of 5 integrated rendering modules that work together to create a rich visual narrative of evolution in action.

---

## Architecture

### Core Modules

#### 1. **Metapopulation Renderer** (`metapopulationRenderer.js`)
Visualizes spatially structured populations and landscape genetics.

**Key Features:**
- Habitat patch visualization with climate-based coloring
- Migration corridor animation with flow intensity
- Fst (genetic differentiation) shown as border thickness/opacity
- Source vs sink patch classification with λ indicators
- Local adaptation halo showing acclimatization progress

**Visual Elements:**
```
Habitat Patch Display:
├── Background fill: Semi-transparent, climate-specific color
├── Border: Thickness ∝ Fst value (1-5px)
├── Label: Patch name and population count
├── Center: Climate type in colored text
└── Corner: λ value (green if source, red if sink)

Migration Corridor:
├── Line width: ∝ base_rate × (1 - barrier_strength)
├── Animated arrows: Moving along corridor showing flow
├── Dashed circle: If barrier strength > 0.3
└── Color: Light blue with varying opacity
```

**Implementation Example:**
```javascript
// In your rendering pipeline:
import { renderMetapopulation } from './rendering/metapopulationRenderer.js';

// During render phase:
renderMetapopulation(ctx);

// Access statistics:
const stats = MetapopulationRenderer.getMetapopulationStats();
console.log(`Average Fst: ${stats.avgFst}`);
console.log(`Occupied patches: ${stats.occupiedPatches}/${stats.totalPatches}`);
```

**Color Scheme:**
| Climate Type | Fill | Border |
|---|---|---|
| Tropical | #FF8C42 | #E65100 |
| Temperate | #76D76C | #2E7D32 |
| Cold | #42A5F5 | #1565C0 |
| Arid | #FFD54F | #F57F17 |

---

#### 2. **Character Displacement Renderer** (`characterDisplacementRenderer.js`)
Visualizes niche-based competition and adaptive divergence.

**Key Features:**
- Niche hypervolume visualization (as overlapping circles)
- Niche overlap zones with gradient highlighting
- Divergence pressure arrows on competing agents
- Direct competitive conflict visualization
- Character displacement summary statistics

**Visual Elements:**
```
Niche Visualization:
├── Species circles: ∝ niche hypervolume (30 + size × 0.5 pixels)
├── Overlap gradient: Yellow center, fades to transparent
├── Intensity: ∝ niche overlap value (0-1)
└── Color: Species-specific from getSpeciesColor()

Divergence Pressure Arrow:
├── Origin: Agent position
├── Direction: Away from competing species
├── Length: ∝ pressure strength × 20 (max 15px)
├── Color: Red with opacity ∝ pressure
└── Animation: Static, updated each frame
```

**Implementation Example:**
```javascript
import { renderCharacterDisplacement } from './rendering/characterDisplacementRenderer.js';

// During render phase:
renderCharacterDisplacement(ctx);

// Get displacement metrics:
const stats = CharDisplacementRenderer.getCharacterDisplacementStats();
console.log(`Displacing species pairs: ${stats.displacingSpeciesPairs}`);
console.log(`Avg niche overlap: ${stats.averageNicheOverlap.toFixed(3)}`);
```

**How It Works:**
1. Groups agents by species
2. Estimates niche position/size (food type, body size, spatial location)
3. Calculates pairwise overlap and pressure
4. Renders niche circles and pressure vectors
5. Shows conflict lines between competing agents

---

#### 3. **Niche Construction Renderer** (`nicheConstructionRenderer.js`)
Visualizes environmental modification by organisms.

**Key Features:**
- Biofilm formation by cooperative species
- Territorial pheromone gradients
- Waste product accumulation
- Shading effects from large bodies
- Grid-based environmental modification tracking

**Visual Elements:**
```
Biofilm Layer (Rendered First):
├── Green overlay: rgba(100, 200, 100, intensity × 0.25)
├── Texture: Random circles when intensity > 0.3
├── Coverage: Cell value 0-1 in biofilmGrid
└── Diffusion: Spreads to adjacent cells over time

Pheromone Layer:
├── Color: Species-specific hue (hue = species_id × 137.5°)
├── Intensity: Opacity ∝ pheromone strength
├── Markers: Dots showing territorial boundaries
└── Diffusion: Slower than biofilm, carries species information

Waste Layer:
├── Brown/red gradient: rgba(150, 100, 50, intensity × 0.2)
├── Radial gradient: Darker at center, fades outward
├── Sources: All agents (metabolic byproducts)
└── Accumulation: Represents nutrient depletion zones

Shade Layer (Background):
├── Black overlay: rgba(0, 0, 0, intensity × 0.3)
├── Source: Large organisms (size > 50 nodes)
├── Coverage: Multiple grid cells based on agent size
└── Effect: Simulates light competition
```

**Grid-Based System:**
```javascript
// Internal grid structure (20px cells by default)
biofilmGrid[y][x] = 0.0-1.0   // Biofilm coverage
pheromoneGrid[y][x] = {
    intensity: 0.0-1.0,       // Pheromone strength
    species: -1 to N          // Which species marked this
}
wasteGrid[y][x] = 0.0-1.0     // Waste accumulation
shadeGrid[y][x] = 0.0-1.0     // Light blocking
```

**Implementation Example:**
```javascript
import {
    initNicheConstructionGrids,
    updateNicheConstruction,
    renderNicheConstruction,
    getNicheConstructionStats
} from './rendering/nicheConstructionRenderer.js';

// Initialization (once at start):
initNicheConstructionGrids();

// Each frame:
updateNicheConstruction();  // Update grids based on agent positions
renderNicheConstruction(ctx);  // Render to canvas

// Get statistics:
const stats = getNicheConstructionStats();
console.log(`Biofilm coverage: ${(stats.avgBiofilmCoverage * 100).toFixed(1)}%`);
```

**Decay and Diffusion:**
- Decay rate: 2% per tick (multiplied by 0.98)
- Diffusion rate: 10% to adjacent cells per tick
- This simulates biofilm/pheromone fading and environmental recovery

---

#### 4. **Evolutionary Mechanisms Renderer** (`evolutionaryMechanismsRenderer.js`)
Visualizes complex evolutionary processes.

**Key Features:**
- Muller's Ratchet: Genetic load accumulation in asexual lines
- Evolutionary Rescue: Population recovery from extinction
- Genetic Assimilation: Trait fixation and plasticity reduction
- Sexual Conflict: Male manipulation vs female resistance

**Visual Elements:**

##### A. Muller's Ratchet
```
Darkening Effect:
├── Color: rgba(50, 30, 0, decay × 0.3)
├── Radius: 10 + decay × 5 pixels
├── Indicator: Shows genetic load accumulation
└── Subject: Asexual lineages only

Crack Effects (on "ratchet clicks"):
├── Pattern: 3 radial cracks from center
├── Duration: 100 ticks fade
├── Color: Orange/red rgba(200, 100, 50, severity × fade)
├── Trigger: Fitness drops > 20% from expected
└── Animation: Radiating from agent center

High Risk Warning (decay > 0.5):
├── Circle: dashed line around agent
├── Color: Orange rgba(255, 100, 0, pulse)
├── Pulse: sin(tick × 0.1) × 0.5 + 0.5
└── Meaning: Species at critical genetic load risk
```

##### B. Evolutionary Rescue
```
Rescue Flash (200 tick duration):
├── Core flash: Species-color circle, fading
├── Size: 15 × progress pixels
├── Color: Blue (standing variation) or Orange (new mutation)
├── Radiating rings: 2 rings fading outward
└── Fade time: 200 ticks (26 simulation seconds at normal speed)

Flash Colors:
├── Standing variation: rgba(100, 200, 255, progress × 0.6)
└── New mutation: rgba(255, 200, 100, progress × 0.6)

Detection Method:
├── Trigger: Population < 10 then increases > 2x
├── Analysis: Genetic diversity determines type
├── Duration: Marked for 200 ticks
└── Display: All rescued species members flash simultaneously
```

##### C. Genetic Assimilation
```
Assimilation Halo:
├── Color: Purple rgba(200, 100, 200, assimilation × 0.5)
├── Line width: 1 + assimilation × 2
├── Radius: 8 + assimilation × 4 pixels
└── Meaning: Trait becoming genetically fixed

Color Shift:
├── Progress: From colorful (plastic) to white (fixed)
├── Formula: rgb(100 + plasticity × 100) for all channels
├── Overlay: 10×10 pixel square at agent
└── Opacity: 0.1 (subtle background shift)

Tracking:
├── Per-gene basis (size, motility, sensors)
├── Plasticity: Decreases by 0.001 per tick
├── Fixation: 1 - plasticity (inverse relationship)
└── Progress: Time-based, full in 5000 ticks
```

##### D. Sexual Conflict
```
Conflict Aura:
├── Shape: Dashed circle around agent
├── Color: Red (manipulation > resistance) or Blue
├── Opacity: intensity × 0.6
├── Width: 2px line
└── Dash pattern: [3px on, 3px off]

Cost Indicator:
├── Shape: Pulsing circle at radius 12
├── Color: Red rgba(255, 0, 0, pulse)
├── Pulse: sin(tick × 0.15) × 0.5 + 0.5
├── Duration: Shows while conflict incurs fitness cost
└── Meaning: Female paying energetic cost of resistance
```

**Implementation Example:**
```javascript
import {
    updateEvolutionaryMechanisms,
    renderMullersRatchet,
    renderEvolutionaryRescue,
    renderGeneticAssimilation,
    renderSexualConflict,
    getEvolutionaryMechanismsStats
} from './rendering/evolutionaryMechanismsRenderer.js';

// Each frame:
updateEvolutionaryMechanisms();  // Track all mechanisms

// Render each mechanism:
renderMullersRatchet(ctx);
renderEvolutionaryRescue(ctx);
renderGeneticAssimilation(ctx);
renderSexualConflict(ctx);

// Get statistics:
const stats = getEvolutionaryMechanismsStats();
console.log(`Asexual species at ratchet risk: ${stats.asexualSpecies}`);
console.log(`Active evolutionary rescues: ${stats.activeEvolutionaryRescues}`);
```

---

#### 5. **Evolutionary Visualization Manager** (`evolutionaryVisualizationManager.js`)
Central coordination hub for all visualization systems.

**Key Features:**
- Unified rendering interface
- Visualization mode toggling
- Statistics aggregation and display
- Performance optimization
- Help and legend generation

**Visualization Modes:**
```javascript
VISUALIZATION_MODES = {
    METAPOPULATION: 'metapopulation',
    CHARACTER_DISPLACEMENT: 'character_displacement',
    NICHE_CONSTRUCTION: 'niche_construction',
    EVOLUTIONARY_MECHANISMS: 'evolutionary_mechanisms',
    COMBINED: 'combined'  // Shows all simultaneously
}
```

**Implementation Example:**
```javascript
import * as EvolutionManager from './rendering/evolutionaryVisualizationManager.js';

// Initialization:
EvolutionManager.initializeEvolutionaryVisualizations();

// Each frame:
EvolutionManager.updateEvolutionaryVisualizations();
EvolutionManager.renderEvolutionaryVisualizations(ctx);

// Toggle modes:
EvolutionManager.toggleVisualization(EvolutionManager.VISUALIZATION_MODES.METAPOPULATION);
EvolutionManager.toggleStatistics();

// Get configuration:
const config = EvolutionManager.getVisualizationConfig();
const legend = EvolutionManager.getVisualizationLegend();
const help = EvolutionManager.getVisualizationHelp();
```

---

## Integration with Main Renderer

To integrate into your main rendering pipeline:

```javascript
// In renderer.js or main.js
import * as EvolutionManager from './rendering/evolutionaryVisualizationManager.js';

export class Renderer {
    constructor(canvas) {
        // ... existing code ...

        // Initialize evolutionary visualizations
        EvolutionManager.initializeEvolutionaryVisualizations();
    }

    render() {
        // ... existing code ...

        // Within the camera transform (after applying camera):

        // Update evolutionary tracking
        EvolutionManager.updateEvolutionaryVisualizations();

        // Render evolutionary visualizations
        EvolutionManager.renderEvolutionaryVisualizations(ctx);

        // ... rest of rendering ...
    }
}
```

---

## Performance Optimization

### Per-Module Performance Tips

**Metapopulation Renderer:**
- Fst matrix updates: Every 100 ticks (configurable)
- Source/sink classification: Every 50 ticks
- Memory: O(n_patches²) for Fst matrix

**Character Displacement Renderer:**
- Full update: Every frame
- Agent sampling: For efficiency, samples up to 20 agents per species
- Memory: O(n_species²) for displacement data

**Niche Construction Renderer:**
- Grid updates: Every frame
- Diffusion: O(grid_cells) per update
- Memory: O(grid_width × grid_height × 4)

**Evolutionary Mechanisms Renderer:**
- Ratchet tracking: Per asexual species
- Rescue detection: O(n_species) per frame
- Memory: O(n_asexual_species + n_active_rescues)

### General Optimization Strategies

1. **Selective Rendering:**
   ```javascript
   // Only render mechanisms that are active
   if (activeVisualizations.has('metapopulation')) {
       MetapopRenderer.renderMetapopulation(ctx);
   }
   ```

2. **Update Frequency Control:**
   ```javascript
   // Update expensive operations less frequently
   if (state.tick % 50 === 0) {
       calculateExpensiveMetrics();
   }
   ```

3. **Agent Sampling:**
   ```javascript
   // For statistics, sample rather than processing all agents
   const sample = agents.slice(0, Math.min(50, agents.length));
   ```

---

## Color Reference

### Climate Types (Metapopulation)
```
Tropical:  #FF8C42 (fill)  #E65100 (border)
Temperate: #76D76C (fill)  #2E7D32 (border)
Cold:      #42A5F5 (fill)  #1565C0 (border)
Arid:      #FFD54F (fill)  #F57F17 (border)
```

### Migration & Flow
```
Corridor base:     rgba(150, 150, 180, 0-0.6)
Flow arrows:       rgba(100, 200, 255, 0-0.7)
Barrier indicator: rgba(255, 100, 100, 0-0.8)
```

### Local Adaptation
```
Acclimatized:  rgba(0, 255, 0, 0-0.4)    [Green halo]
Immigrant:     rgba(255, 255, 0, 0-0.6)  [Yellow dashed]
```

### Character Displacement
```
Niche circles:     Species color, opacity 0.2
Overlap gradient:  rgba(255, 200, 0, 0-0.3) [Yellow]
Pressure arrows:   rgba(255, 100, 100, 0-0.8) [Red]
Conflicts:         rgba(255, 100, 0, 0-0.6) [Orange]
```

### Niche Construction
```
Biofilm:          rgba(100, 200, 100, 0-0.25) [Green]
Waste:            rgba(150, 100, 50, 0-0.2)   [Brown]
Pheromones:       Species-specific hues
Shade:            rgba(0, 0, 0, 0-0.3)        [Black]
```

### Evolutionary Mechanisms
```
Genetic load:      rgba(50, 30, 0, 0-0.3)    [Dark brown]
Ratchet cracks:    rgba(200, 100, 50, 0-0.7) [Orange]
Ratchet warning:   rgba(255, 100, 0, pulse)  [Orange pulse]
Rescue - standing: rgba(100, 200, 255, fade) [Blue]
Rescue - mutation: rgba(255, 200, 100, fade) [Orange]
Assimilation:      rgba(200, 100, 200, 0-0.5) [Purple]
Conflict - male:   rgba(255, 100, 100, 0-0.6) [Red]
Conflict - female: rgba(100, 100, 255, 0-0.6) [Blue]
```

---

## Statistics Display

The system automatically collects and displays statistics:

```
EVOLUTIONARY DYNAMICS

METAPOPULATION:
  Patches: 4/4 occupied
  Avg Fst: 0.247

CHARACTER DISPLACEMENT:
  Displacing pairs: 2
  Avg overlap: 0.564
  Avg pressure: 0.341

NICHE CONSTRUCTION:
  Biofilm coverage: 23.5%
  Waste accumulation: 12.1%

EVOLUTIONARY MECHANISMS:
  Muller's Ratchet species: 1
  Evolutionary rescues: 0
  Assimilating genes: 5
```

---

## Keyboard Controls (Suggested Implementation)

```javascript
// In your event handler:
document.addEventListener('keydown', (e) => {
    switch(e.key.toUpperCase()) {
        case 'M':  // Metapopulation
            EvolutionManager.toggleVisualization(
                EvolutionManager.VISUALIZATION_MODES.METAPOPULATION
            );
            break;
        case 'D':  // Character displacement
            EvolutionManager.toggleVisualization(
                EvolutionManager.VISUALIZATION_MODES.CHARACTER_DISPLACEMENT
            );
            break;
        case 'N':  // Niche construction
            EvolutionManager.toggleVisualization(
                EvolutionManager.VISUALIZATION_MODES.NICHE_CONSTRUCTION
            );
            break;
        case 'E':  // Evolutionary mechanisms
            EvolutionManager.toggleVisualization(
                EvolutionManager.VISUALIZATION_MODES.EVOLUTIONARY_MECHANISMS
            );
            break;
        case 'T':  // Toggle statistics
            EvolutionManager.toggleStatistics();
            break;
        case 'L':  // Show legend
            console.log(EvolutionManager.getVisualizationLegend());
            break;
    }
});
```

---

## Advanced Usage

### Custom Visualization Combinations

```javascript
// Show only metapopulation and character displacement
EvolutionManager.setVisualizations([
    'metapopulation',
    'character_displacement'
]);

// Show all
EvolutionManager.setVisualizations(Object.values(
    EvolutionManager.VISUALIZATION_MODES
));

// Export data for analysis
const stats = EvolutionManager.exportEvolutionaryStats();
console.log(JSON.stringify(stats, null, 2));
```

### Custom Statistics Analysis

```javascript
// Get detailed metapopulation data
const metastats = MetapopRenderer.getMetapopulationStats();
const avgFst = metastats.avgFst;

// Get character displacement hotspots
const dispStats = CharDisplacementRenderer.getCharacterDisplacementStats();
const displacingPairs = dispStats.displacingSpeciesPairs;

// Monitor niche construction
const nicheStats = NicheConstructionRenderer.getNicheConstructionStats();
const totalBiofilm = nicheStats.avgBiofilmCoverage;

// Track evolutionary mechanisms
const mechStats = EvolutionaryRenderer.getEvolutionaryMechanismsStats();
const ratchetRisk = mechStats.asexualSpecies;
```

---

## Troubleshooting

### Visualizations not appearing
- Check that `initializeEvolutionaryVisualizations()` was called
- Verify canvas context is passed correctly to render functions
- Ensure `updateEvolutionaryVisualizations()` is called each frame

### Performance degradation
- Reduce update frequency: modify `if (state.tick % X === 0)` checks
- Disable niche construction grid updates temporarily
- Sample agents instead of processing all

### Statistics showing zeros
- Ensure patches/agents exist before rendering
- Check that genome structures contain required fields
- Verify state.agents contains alive agents

---

## Future Enhancements

Potential extensions to the visualization system:

1. **Phylogenetic Tree Display** - Show lineage divergence over time
2. **Genetic Load Tracking** - Detailed visualization of deleterious mutations
3. **Adaptive Peak Landscape** - Fitness landscape with populations
4. **Gene Flow Animation** - Specific allele frequency changes
5. **Speciation Events** - Real-time speciation visualization
6. **3D Visualization** - Extend to 3D rendering with Three.js
7. **Network Visualization** - Gene flow and disease transmission networks
8. **Time-lapse Recording** - Automatically generate evolution videos

---

## File Reference

```
js/rendering/
├── metapopulationRenderer.js          (~400 lines)
├── characterDisplacementRenderer.js   (~500 lines)
├── nicheConstructionRenderer.js       (~450 lines)
├── evolutionaryMechanismsRenderer.js  (~600 lines)
└── evolutionaryVisualizationManager.js (~500 lines)

Total: ~2450 lines of visualization code
```

---

## License & Citation

These visualization systems implement concepts from:
- Wright's Metapopulation Theory (1931)
- Brown & Wilson's Character Displacement (1956)
- Odling-Smee's Niche Construction Theory (1996)
- Muller's Ratchet in Asexual Evolution (1964)
- Evolutionary Rescue Theory (2015+)

For citations and theory references, see the main project documentation.

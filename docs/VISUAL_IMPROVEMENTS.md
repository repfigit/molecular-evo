# Molecular Evolution Simulation - Visual Improvements Analysis & Recommendations

## Executive Summary

The molecular evolution simulation has a solid foundation with 2D canvas rendering supporting multiple visualization layers, overlays, and color modes. This analysis identifies enhancement opportunities to make evolutionary dynamics more visually compelling and scientifically informative.

## Current System Assessment

### Strengths
- Clean layer-based architecture (11 distinct layers)
- Multiple overlay modes (resources, temperature, species, viral, DNA)
- Dynamic color modes (species, energy, age, fitness, infection, HGT, cooperation, symbiosis)
- Good visual effects for events (infections, HGT transfers, predation, burst effects)
- Entity selection with tracking
- Camera system with zoom and pan

### Gaps & Opportunities

1. **Immunity Visualization** - No visual representation of immunity layers despite complex immune system
2. **Plasmid/HGT Status** - Plasmids not visually distinguished by origin or type
3. **Species & Speciation** - Limited visual feedback on speciation events and species relationships
4. **Niche Construction** - No visual representation of environmental modification by agents
5. **Biofilm/Colony Behavior** - No clustering visualization for cooperative groups
6. **Evolutionary Time** - Limited feedback on evolutionary progress and adaptive radiation
7. **Generation Tracking** - Could show divergence trees and lineage relationships
8. **Population Diversity** - No visual diversity metrics or phylogenetic patterns
9. **Infection Stages** - Current indicator could be more detailed
10. **Agent Phenotype Detail** - Size, metabolism, movement complexity not visually distinct
11. **Environmental Gradients** - Chemical gradients could be more visually apparent
12. **UI Information Density** - Could display more evolution-relevant stats

## Recommended Visual Improvements

### 1. IMMUNITY LAYER VISUALIZATION

**Priority:** HIGH | **Complexity:** MEDIUM | **Impact:** HIGH

#### Concept
Show adaptive vs innate immunity as concentric rings or color gradients around agents.

#### Visual Design
- **Innate Immunity Ring**: Thin yellow/orange aura for non-specific immunity
- **CRISPR Memory**: Blue/cyan spikes showing adaptive immunity strength
- **Autoimmunity Risk**: Red pulsing when immunity investment too high
- **Active Defense**: Bright glow when recently infected

#### Implementation Details
```javascript
// Render immunity indicator around agent
function renderImmunityIndicator(ctx, agent) {
    const x = agent.position.x;
    const y = agent.position.y;
    const baseRadius = 10;

    // Innate immunity - yellow outer ring
    const innateStr = agent.genome.immunity.innate_immunity?.strength || 0;
    if (innateStr > 0) {
        ctx.strokeStyle = `rgba(255, 200, 0, ${innateStr * 0.7})`;
        ctx.lineWidth = 2 + innateStr * 2;
        ctx.beginPath();
        ctx.arc(x, y, baseRadius + 4, 0, Math.PI * 2);
        ctx.stroke();
    }

    // CRISPR adaptive immunity - blue spikes
    const adaptiveStr = agent.genome.immunity.crispr?.spacer_count || 0;
    if (adaptiveStr > 0) {
        const numSpikes = Math.min(adaptiveStr, 12);
        const spikeLength = 8 + adaptiveStr * 2;

        for (let i = 0; i < numSpikes; i++) {
            const angle = (Math.PI * 2 / numSpikes) * i;
            const startX = x + Math.cos(angle) * baseRadius;
            const startY = y + Math.sin(angle) * baseRadius;
            const endX = x + Math.cos(angle) * (baseRadius + spikeLength);
            const endY = y + Math.sin(angle) * (baseRadius + spikeLength);

            ctx.strokeStyle = `rgba(0, 150, 255, ${Math.min(1, adaptiveStr / 5)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }

    // Autoimmunity risk - red pulsing halo
    if (innateStr > 0.8) {
        const pulse = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(255, 0, 0, ${pulse * 0.4})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(x, y, baseRadius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}
```

**Color Palette:**
- Innate Immunity: `#FFD400` (golden yellow)
- CRISPR Spacers: `#0096FF` (cyan blue)
- Autoimmunity Risk: `#FF3333` (bright red)
- Active Response: `#FF66FF` (magenta pulse)

---

### 2. ENHANCED PLASMID VISUALIZATION

**Priority:** HIGH | **Complexity:** MEDIUM | **Impact:** MEDIUM

#### Concept
Distinguish plasmids visually by origin, function, and transfer events.

#### Visual Design
- **Plasmid Count**: Small colored dots around agent
- **Plasmid Type**: Different colors for metabolic, virulence, cooperation genes
- **Origin**: Different shading for native vs transferred
- **Horizontal Transfer Flash**: Bright glow during active transfer

#### Implementation Details
```javascript
function renderPlasmidStatus(ctx, agent) {
    const x = agent.position.x;
    const y = agent.position.y;

    if (!agent.genome.hgt.plasmids || agent.genome.hgt.plasmids.length === 0) {
        return;
    }

    const plasmids = agent.genome.hgt.plasmids;
    const numToShow = Math.min(plasmids.length, 12);
    const radius = 20;

    for (let i = 0; i < numToShow; i++) {
        const angle = (Math.PI * 2 / numToShow) * i;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;

        const plasmid = plasmids[i % plasmids.length];
        const color = getPlasmidColor(plasmid);
        const size = 3 + (plasmid.gene_count || 0) * 0.5;

        // Draw plasmid dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();

        // Outline for foreign (transferred) plasmids
        if (plasmid.acquired_via_hgt) {
            ctx.strokeStyle = 'rgba(255, 255, 100, 0.8)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    // Show count if more than can display
    if (plasmids.length > 12) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px monospace';
        ctx.fillText(`+${plasmids.length - 12}`, x + radius + 5, y - 2);
    }
}

function getPlasmidColor(plasmid) {
    const genes = plasmid.gene_functions || [];

    if (genes.includes('virulence')) return '#FF4444';      // Red
    if (genes.includes('metabolism')) return '#44FF44';     // Green
    if (genes.includes('cooperation')) return '#FF44FF';    // Magenta
    if (genes.includes('resistance')) return '#FFFF44';     // Yellow
    if (genes.includes('motility')) return '#44FFFF';       // Cyan

    return '#CCCCCC';  // Gray for unknown
}
```

**Color Scheme by Function:**
- Virulence/Toxins: `#FF4444` (red)
- Metabolism/Nutrition: `#44FF44` (green)
- Cooperation: `#FF44FF` (magenta)
- Antibiotic Resistance: `#FFFF44` (yellow)
- Motility/Motor: `#44FFFF` (cyan)
- Unknown/Generic: `#CCCCCC` (gray)

---

### 3. SPECIES & SPECIATION VISUALIZATION

**Priority:** HIGH | **Complexity:** HIGH | **Impact:** HIGH

#### Concept
Show species phylogeny, speciation events, and genetic distance relationships.

#### Visual Design A - Speciation Flash Events
Brief visual indication when new species emerge:
```javascript
function renderSpeciationEvent(ctx, event) {
    const age = event.age / event.duration;
    const size = 30 + age * 30;
    const alpha = 1 - age;

    ctx.strokeStyle = `rgba(200, 100, 255, ${alpha * 0.8})`;
    ctx.lineWidth = 3;
    ctx.globalAlpha = alpha;

    // Double circle for speciation
    ctx.beginPath();
    ctx.arc(event.position.x, event.position.y, size, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(event.position.x, event.position.y, size * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
}
```

#### Visual Design B - Phylogenetic Tree Panel
Add mini phylogenetic tree in UI showing species relationships.

#### Visual Design C - Species Distinction
Make species coloring more pronounced with better contrast:
```javascript
// In agentRenderer.js - enhance species color mode
function getSpeciesColorEnhanced(marker) {
    // Use golden ratio-based color distribution for maximum distinction
    const hash = marker.charCodeAt(0) || 0;
    const hue = ((hash * 137.508) % 360); // Golden angle
    const sat = 75 + (hash % 25);         // 75-100%
    const light = 50 + (hash % 20);       // 50-70%

    return `hsl(${hue}, ${sat}%, ${light}%)`;
}
```

---

### 4. NICHE CONSTRUCTION & BIOFILM VISUALIZATION

**Priority:** MEDIUM | **Complexity:** MEDIUM | **Impact:** MEDIUM

#### Concept
Visual representation of environmental modification by cooperating groups.

#### Visual Design
- **Biofilm Clusters**: Subtle background glow where agents cluster
- **Territorial Marks**: Faint color overlay showing resource claims
- **Environmental Modification**: Gradient changes indicating niche construction

#### Implementation
```javascript
// In environmentRenderer.js - add biofilm layer
function renderBiofilms(ctx, environment) {
    if (!environment.biofilms || environment.biofilms.length === 0) return;

    ctx.globalAlpha = 0.15;

    for (const biofilm of environment.biofilms) {
        const gradient = ctx.createRadialGradient(
            biofilm.center.x, biofilm.center.y, biofilm.radius * 0.3,
            biofilm.center.x, biofilm.center.y, biofilm.radius
        );

        const color = biofilm.color || '#888888';
        const rgb = hexToRgb(color);

        gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
        gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
        gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(biofilm.center.x, biofilm.center.y, biofilm.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1.0;
}

// Detect and visualize agent clusters
function detectAndVisualizeBiofilms(ctx, agents) {
    if (agents.length < 3) return;

    // Group agents by spatial proximity and species
    const clusters = new Map();

    for (const agent of agents) {
        if (!agent.alive) continue;

        const speciesKey = agent.genome.species_marker;

        if (!clusters.has(speciesKey)) {
            clusters.set(speciesKey, []);
        }
        clusters.get(speciesKey).push(agent);
    }

    // Render clusters
    for (const [species, members] of clusters) {
        if (members.length < 3) continue;

        // Find cluster center and bounds
        let centerX = 0, centerY = 0;
        let maxDist = 0;

        for (const member of members) {
            centerX += member.position.x;
            centerY += member.position.y;
        }
        centerX /= members.length;
        centerY /= members.length;

        for (const member of members) {
            const dx = member.position.x - centerX;
            const dy = member.position.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            maxDist = Math.max(maxDist, dist);
        }

        // Only show if cluster is tight (close together)
        if (maxDist < 100 && members.length >= 5) {
            const color = getSpeciesColor(species);
            const gradient = ctx.createRadialGradient(
                centerX, centerY, maxDist * 0.2,
                centerX, centerY, maxDist * 1.3
            );

            const rgb = hexToRgb(color);
            gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`);
            gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

            ctx.globalAlpha = 0.6;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, maxDist * 1.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }
}
```

---

### 5. EVOLUTIONARY TIMELINE & GENERATION TRACKING

**Priority:** MEDIUM | **Complexity:** LOW | **Impact:** MEDIUM

#### Concept
Enhanced visualization of evolutionary progress and adaptive radiation.

#### Visual Design
- **Temporal Gradient**: Show agent age with color intensity
- **Generation Cohorts**: Visual grouping of same-generation agents
- **Adaptive Radiation**: Show diversification visually

#### Implementation
```javascript
// Enhanced age-based visualization
function renderGenerationCohorts(ctx, agents) {
    const generationMap = new Map();

    for (const agent of agents) {
        if (!agent.alive) continue;
        const gen = agent.lineage?.generation_born || 0;

        if (!generationMap.has(gen)) {
            generationMap.set(gen, []);
        }
        generationMap.get(gen).push(agent);
    }

    // Render generation clouds
    for (const [generation, members] of generationMap) {
        if (members.length < 2) continue;

        // Calculate generation age (how old this generation is)
        const generationAge = state.generation - generation;
        const generationAlpha = Math.max(0.05, 1 - generationAge / 100);

        for (const agent of members) {
            // Subtle aura showing generation cohort
            const generationColor = getGenerationColor(generation);
            ctx.strokeStyle = `rgba(${generationColor}, ${generationAlpha * 0.3})`;
            ctx.lineWidth = 1;
            ctx.globalAlpha = generationAlpha * 0.2;

            ctx.beginPath();
            ctx.arc(agent.position.x, agent.position.y, 8 + generationAge * 0.1, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    ctx.globalAlpha = 1.0;
}

function getGenerationColor(generation) {
    // Cycle through generations with different colors
    const colors = [
        [100, 255, 100],   // Green - recent
        [100, 150, 255],   // Blue
        [255, 100, 100],   // Red
        [255, 255, 100],   // Yellow
        [255, 100, 255],   // Magenta
        [100, 255, 255],   // Cyan
    ];
    const color = colors[generation % colors.length];
    return color.join(', ');
}
```

---

### 6. ENHANCED INFECTION VISUALIZATION

**Priority:** MEDIUM | **Complexity:** MEDIUM | **Impact:** MEDIUM

#### Concept
More detailed visual representation of infection states and viral lifecycle.

#### Visual Design
```javascript
function renderInfectionStatus(ctx, agent) {
    if (!agent.infection) return;

    const x = agent.position.x;
    const y = agent.position.y;
    const inf = agent.infection;

    // Infection stage indicator
    switch (inf.stage) {
        case 'exposure':
            // Early stage - subtle blue halo
            ctx.strokeStyle = 'rgba(0, 100, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.stroke();
            break;

        case 'incubation':
            // Growing - expanding rings
            const incubAge = inf.age / inf.incubation_duration;
            ctx.strokeStyle = `rgba(0, 150, 255, ${0.3 + incubAge * 0.5})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 10 + incubAge * 5, 0, Math.PI * 2);
            ctx.stroke();
            break;

        case 'lytic':
            // Actively replicating - aggressive red
            const burst = Math.sin(state.tick * 0.15) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(255, 50, 50, ${burst})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.stroke();

            // Multiple rings for rapid replication
            ctx.strokeStyle = `rgba(255, 100, 100, ${burst * 0.6})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 18, 0, Math.PI * 2);
            ctx.stroke();
            break;

        case 'lysogenic':
            // Integrated - dashed ring
            ctx.strokeStyle = 'rgba(150, 100, 200, 0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(x, y, 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            break;

        case 'recovery':
            // Fading - pale color
            const recoveryAlpha = 1 - (inf.age / inf.recovery_duration);
            ctx.strokeStyle = `rgba(100, 200, 100, ${recoveryAlpha * 0.5})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, 16, 0, Math.PI * 2);
            ctx.stroke();
            break;
    }
}

// Color codes for infection stages
const INFECTION_COLORS = {
    exposure: '#0064FF',      // Blue
    incubation: '#0096FF',    // Light blue
    lytic: '#FF3232',         // Bright red
    lysogenic: '#9664C8',     // Purple
    recovery: '#64C864'       // Green
};
```

---

### 7. PHENOTYPIC COMPLEXITY VISUALIZATION

**Priority:** MEDIUM | **Complexity:** MEDIUM | **Impact:** LOW

#### Concept
Visualize agent complexity based on genome features.

#### Visual Design
- **Size variation**: Agents with more nodes/links appear slightly larger
- **Complexity aura**: Subtle glow intensity indicates genome complexity
- **Metabolic specialization**: Color saturation shows metabolic investment

#### Implementation
```javascript
function renderAgentComplexity(ctx, agent) {
    const x = agent.position.x;
    const y = agent.position.y;

    // Complexity metrics
    const nodeCount = agent.body.nodes?.length || 0;
    const linkCount = agent.body.links?.length || 0;
    const sensorCount = agent.body.sensors?.length || 0;
    const motorCount = agent.body.motors?.length || 0;

    const totalComplexity = nodeCount + linkCount * 0.5 + sensorCount * 2 + motorCount * 2;
    const complexityScore = Math.min(1, totalComplexity / 50);

    // Draw complexity aura
    if (complexityScore > 0.3) {
        ctx.strokeStyle = `rgba(200, 200, 255, ${complexityScore * 0.3})`;
        ctx.lineWidth = 1 + complexityScore * 2;
        ctx.globalAlpha = complexityScore * 0.5;

        ctx.beginPath();
        ctx.arc(x, y, 25, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 1.0;
    }

    // Sensor indication - small dots if many sensors
    if (sensorCount > 5) {
        const senseIntensity = Math.min(1, sensorCount / 10);
        ctx.fillStyle = `rgba(100, 200, 255, ${senseIntensity * 0.4})`;
        ctx.beginPath();
        ctx.arc(x + 8, y - 8, 3 + senseIntensity * 2, 0, Math.PI * 2);
        ctx.fill();
    }
}
```

---

### 8. ENVIRONMENTAL GRADIENT ENHANCEMENT

**Priority:** MEDIUM | **Complexity:** MEDIUM | **Impact:** MEDIUM

#### Concept
Better visualization of environmental chemical/resource gradients.

#### Implementation
```javascript
// Replace linear gradient with smoother field visualization
function renderChemicalFieldEnhanced(ctx, environment, chemicalType, baseColor) {
    if (!environment?.resources) return;

    const cellSize = CONFIG.ENVIRONMENT_CELL_SIZE || 20;
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / cellSize);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / cellSize);

    const imageData = ctx.createImageData(CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
    const data = imageData.data;

    const rgb = hexToRgb(baseColor);

    // Build gradient in image data (per-pixel, smoother than grid cells)
    for (let y = 0; y < CONFIG.WORLD_HEIGHT; y++) {
        for (let x = 0; x < CONFIG.WORLD_WIDTH; x++) {
            const cellX = Math.floor(x / cellSize);
            const cellY = Math.floor(y / cellSize);

            const cell = environment.resources[cellY]?.[cellX];
            const intensity = (cell?.[chemicalType] || 0);

            const idx = (y * CONFIG.WORLD_WIDTH + x) * 4;
            data[idx] = rgb.r;
            data[idx + 1] = rgb.g;
            data[idx + 2] = rgb.b;
            data[idx + 3] = intensity * 100; // Alpha based on intensity
        }
    }

    ctx.putImageData(imageData, 0, 0);
}
```

---

### 9. UI ENHANCEMENT - EVOLUTIONARY STATISTICS PANEL

**Priority:** HIGH | **Complexity:** LOW | **Impact:** HIGH

#### Concept
Add new overlay showing real-time evolutionary metrics.

#### Visual Design - Statistics Widget
```javascript
function renderEvolutionaryStatsOverlay(ctx, stats) {
    const padding = 20;
    const x = padding;
    const y = padding;
    const width = 280;
    const height = 220;

    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(x, y, width, height);

    // Border
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Evolution Metrics', x + 15, y + 25);

    // Divider
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.4)';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 35);
    ctx.lineTo(x + width - 10, y + 35);
    ctx.stroke();

    let textY = y + 55;
    const lineHeight = 20;

    // Stats to display
    const statsToShow = [
        { label: 'Species', value: stats.speciesCount, color: '#FFD400' },
        { label: 'Avg Fitness', value: stats.avgFitness.toFixed(1), color: '#FF8844' },
        { label: 'Genetic Div.', value: (stats.geneticDiversity * 100).toFixed(1) + '%', color: '#00FF00' },
        { label: 'Immunity Inv.', value: (stats.avgImmunity * 100).toFixed(1) + '%', color: '#0096FF' },
        { label: 'Plasmid Rate', value: (stats.plasmidCarriage * 100).toFixed(1) + '%', color: '#FF44FF' },
        { label: 'Viral Pressure', value: stats.viralDensity.toFixed(2), color: '#FF3333' },
        { label: 'Cooperation', value: (stats.cooperatingRate * 100).toFixed(1) + '%', color: '#44FF44' },
        { label: 'Symbiosis', value: stats.symbioticPairs, color: '#FF44FF' },
    ];

    for (const stat of statsToShow) {
        ctx.fillStyle = stat.color;
        ctx.font = '12px monospace';
        ctx.fillText(stat.label + ':', x + 15, textY);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(stat.value, x + width - 60, textY);

        textY += lineHeight;
    }
}
```

---

### 10. DYNAMIC VISUAL EFFECTS EXPANSION

**Priority:** MEDIUM | **Complexity:** MEDIUM | **Impact:** MEDIUM

#### Concept
More impactful visual feedback for significant evolutionary events.

#### New Effects
```javascript
// Gene duplication event
case 'gene_duplication':
    ctx.fillStyle = `rgba(0, 255, 200, ${alpha})`;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i;
        const sparkleX = event.position.x + Math.cos(angle) * (5 + event.age);
        const sparkleY = event.position.y + Math.sin(angle) * (5 + event.age);
        ctx.fillRect(sparkleX - 2, sparkleY - 2, 4, 4);
    }
    break;

// Mutation effect
case 'mutation':
    ctx.strokeStyle = `rgba(150, 150, 255, ${alpha * 0.8})`;
    ctx.lineWidth = 1 + alpha * 2;
    ctx.globalAlpha = alpha;
    const twistAngle = event.age / event.duration * Math.PI * 4;
    ctx.translate(event.position.x, event.position.y);
    ctx.rotate(twistAngle);
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(-twistAngle);
    ctx.translate(-event.position.x, -event.position.y);
    break;

// Speciation event
case 'speciation':
    ctx.strokeStyle = `rgba(200, 100, 255, ${alpha})`;
    ctx.lineWidth = 2 + alpha;
    ctx.globalAlpha = alpha;
    // Double spiral DNA-like pattern
    for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += 0.2) {
            const r = 10 + event.age;
            const px = event.position.x + Math.cos(a + i * Math.PI) * r;
            const py = event.position.y + Math.sin(a + i * Math.PI) * r;
            if (a === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
    }
    break;

// Horizontal gene transfer event
case 'hgt_success':
    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha;
    // Animated DNA helix
    ctx.setLineDash([3 * (1 - alpha), 3 * alpha]);
    ctx.beginPath();
    ctx.moveTo(event.from.x, event.from.y);
    ctx.lineTo(event.to.x, event.to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    break;

// CRISPR defense
case 'viral_defense':
    ctx.fillStyle = `rgba(0, 255, 150, ${alpha})`;
    ctx.globalAlpha = alpha * 0.6;
    // Shield pattern
    ctx.beginPath();
    ctx.arc(event.position.x, event.position.y, 12, Math.PI * 0.3, Math.PI * 1.7);
    ctx.lineTo(event.position.x, event.position.y + 12);
    ctx.closePath();
    ctx.fill();
    break;
```

---

## Implementation Priority & Roadmap

### Phase 1 (High Impact, Low Effort)
1. Enhanced species coloring (golden angle distribution)
2. Evolutionary statistics overlay (UI panel)
3. Biofilm cluster visualization
4. Enhanced infection visualization

### Phase 2 (Medium Impact, Medium Effort)
5. Immunity layer visualization
6. Enhanced plasmid visualization
7. Generation tracking visualization
8. New visual effects for evolutionary events

### Phase 3 (Long-term Enhancements)
9. Phenotypic complexity visualization
10. Environmental gradient enhancement
11. Phylogenetic tree UI component
12. Advanced niche construction visualization

---

## File Structure for Implementations

```
js/rendering/
├── renderer.js (main - add layer registration)
├── agentRenderer.js (enhance with new visualization functions)
├── environmentRenderer.js (add biofilm, gradient enhancements)
├── effectRenderer.js (new - separate effects management)
├── immunityRenderer.js (new - immunity visualization)
└── plasmidRenderer.js (new - plasmid-specific rendering)

js/ui/
├── panels.js (existing)
├── evolutionStatsPanel.js (new - evolutionary metrics display)
└── speciesTreePanel.js (new - phylogenetic visualization)
```

---

## Performance Considerations

### Optimization Strategies
1. **Layer Batching**: Group similar objects before rendering
2. **Dirty Region Updates**: Only re-render changed areas
3. **Level of Detail**: Reduce detail at high zoom-out levels
4. **Culling**: Skip rendering entities far outside visible bounds
5. **WebWorker Offloading**: Move complex calculations to workers

### Estimated Performance Impact
- Immunity indicator: +2-3% GPU
- Plasmid visualization: +3-4% GPU
- Biofilm rendering: +2-3% GPU (scales with agent density)
- Statistical overlay: +1-2% GPU
- New effects: +2-4% GPU (depends on event frequency)

**Recommendation**: Phase implementation and profile on target hardware.

---

## Color Harmony Guide

### Primary Evolutionary Indicators
- **Health/Energy**: Green → Yellow → Red
- **Age**: Bright → Dark
- **Fitness**: Purple → Blue → Cyan → Green → Yellow → Orange → Red
- **Generation**: Cycle through rainbow

### System State Indicators
- **Immunity**: Golden Yellow to Cyan
- **Infection**: Blue → Purple → Red
- **Viral Presence**: #FF3333 (bright red)
- **DNA/Genetic**: #00FFFF (cyan)
- **Cooperation**: #44FF44 (bright green)
- **Symbiosis**: #FF44FF (magenta)
- **Gene Transfer**: #00FFFF (cyan, dashed)

### Environmental
- **Resources**: Green tints
- **Temperature Hot**: Red/Orange
- **Temperature Cold**: Blue
- **Biofilm/Colony**: Semi-transparent species color
- **Niche Construction**: Subtle species-colored overlay

---

## Testing Recommendations

1. **Visual Clarity**: Ensure indicators are visible at multiple zoom levels
2. **Color Blindness**: Test with deuteranopia simulator
3. **Performance**: Monitor FPS with 1000+ agents
4. **Readability**: Validate UI at 1080p, 4K, and high-DPI displays
5. **Animation Smoothness**: Check effect frame rates at various speed settings


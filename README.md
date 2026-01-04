# Molecular Evolution Simulator

A browser-based artificial life simulation that models molecular-scale evolutionary dynamics. Watch soft-bodied organisms evolve, compete, cooperate, and exchange genetic material in real-time.

## Features

### Physics & Organisms
- **Soft-body physics** - Agents are constructed from nodes connected by spring-damper links
- **Motor-driven locomotion** - Oscillating motors attached to links enable movement
- **Sensors** - Chemical, thermal, proximity, and kin-detection sensors guide behavior

### Evolution
- **Genetic inheritance** - Genomes encode physical structure, metabolism, and behavior
- **Mutation** - Point mutations, structural changes (add/remove nodes, links, motors)
- **Sexual reproduction** - Crossover between compatible organisms
- **Species tracking** - Automatic clustering based on genetic distance

### Horizontal Gene Transfer
- **Conjugation** - Direct cell-to-cell plasmid transfer
- **Transformation** - Uptake of free DNA from the environment
- **Plasmids** - Mobile genetic elements conferring various benefits

### Viral Dynamics
- **Lytic cycle** - Viruses infect, replicate, and burst host cells
- **Lysogenic cycle** - Dormant integration into host genome
- **Transduction** - Viruses accidentally transfer host genes

### Immunity
- **CRISPR memory** - Adaptive immunity that remembers past infections
- **Inherited resistance** - Immune memory passed to offspring

### Social Behaviors
- **Kin recognition** - Organisms identify relatives
- **Cooperation** - Resource sharing and coordinated movement
- **Symbiosis** - Mutualistic bonds between different species
- **Competition** - Territorial behavior and resource conflicts

### Environment
- **Resource gradients** - Chemicals, light, and organic matter
- **Temperature cycles** - Periodic environmental changes
- **Catastrophic events** - Viral outbreaks, toxic blooms, meteor strikes

## How Evolution Works

### The Genome

Each organism carries a genome that encodes:

- **Nodes** - Physical masses with position, mass, and friction properties
- **Links** - Springs connecting nodes with stiffness and damping
- **Motors** - Oscillators attached to links that drive locomotion
- **Sensors** - Detectors for chemicals, temperature, nearby organisms
- **Metabolism** - Primary/secondary food sources and energy efficiency
- **Social traits** - Cooperation willingness, aggression, kin recognition
- **HGT traits** - Plasmid transfer/uptake rates

### Reproduction

Organisms reproduce when they accumulate enough energy:

1. **Asexual** (70% of reproductions)
   - Clone parent genome
   - Apply mutations
   - Offspring spawns near parent

2. **Sexual** (30% of reproductions)
   - Find a compatible mate (same or similar species)
   - Crossover: randomly mix genes from both parents
   - Apply mutations (lower rate than asexual)
   - Offspring spawns between parents

### Mutation

During reproduction, the genome can mutate:

| Mutation Type | Effect |
|---------------|--------|
| Point mutation | Tweak numeric values (mass, stiffness, speed) |
| Add node | Grow a new mass point |
| Remove node | Lose a mass point |
| Add/remove link | Change body connectivity |
| Add/remove motor | Gain or lose locomotion |
| Add/remove sensor | Change environmental awareness |
| Social mutation | Shift cooperation/aggression balance |

### Selection

Evolution emerges from differential survival and reproduction:

- **Energy** - Organisms need energy to survive and reproduce
- **Feeding** - Different metabolisms favor different food sources
- **Death** - Organisms die when energy reaches zero
- **Competition** - Aggressive organisms can steal energy
- **Cooperation** - Kin groups share resources and move together
- **Predation** - Viruses drain energy from infected hosts
- **Catastrophes** - Random events kill poorly-adapted organisms

### Fitness

Fitness is calculated from multiple factors:

```
fitness = (age × survival_weight)
        + (energy_ratio × energy_weight)
        + (offspring_count × offspring_weight)
        + (distance_traveled × exploration_weight)
        + (cooperative_links × cooperation_weight)
        + (immunity_memory × immunity_weight)
```

Higher fitness organisms are more likely to survive population culling and be selected as mates.

### Speciation

Species emerge automatically through genetic drift:

1. Organisms accumulate mutations over generations
2. Genetic distance is calculated between organisms
3. If distance exceeds threshold, they're different species
4. Same-species organisms preferentially mate together
5. Species are tracked and colored distinctly

Over time, you'll see the population diverge into multiple species occupying different niches - some fast-moving hunters, some efficient grazers, some cooperative colonies.

## Running the Simulation

1. Serve the files with any static HTTP server:
   ```bash
   # Python 3
   python -m http.server 3333

   # Node.js (npx)
   npx serve -p 3333

   # PHP
   php -S localhost:3333
   ```

2. Open `http://localhost:3333` in a modern browser

3. Click the **Play** button to start the simulation

## Controls

| Control | Action |
|---------|--------|
| **Space** | Play/Pause |
| **+/-** | Speed up/down |
| **Scroll** | Zoom in/out |
| **Drag** | Pan camera |
| **Click** | Select agent |
| **Ctrl+R** | Reset simulation |

## UI Panels

- **Environment** - Temperature, viscosity, resources
- **Population** - Agent counts, species diversity
- **Selected** - Details of clicked agent
- **View** - Overlay and coloring options
- **Statistics** - Population graphs over time
- **Inject** - Add agents, trigger events
- **Parameters** - Adjust mutation rate, reproduction threshold

## Project Structure

```
molecular-evolution/
├── index.html          # Main HTML page
├── css/
│   └── styles.css      # UI styling
└── js/
    ├── main.js         # Entry point, game loop
    ├── config.js       # Tunable parameters
    ├── state.js        # Global simulation state
    ├── core/           # Genome, agent, species, virus, plasmid
    ├── systems/        # Physics, evolution, HGT, viral, immunity
    ├── rendering/      # Canvas rendering
    ├── ui/             # Graphs, controls
    └── utils/          # Math, spatial hash, performance
```

## Configuration

All simulation parameters are in `js/config.js`. Key settings:

- `TARGET_POPULATION` - Ideal population size
- `INITIAL_AGENT_COUNT` - Starting organisms
- `POINT_MUTATION_RATE` - Chance of mutation per reproduction
- `REPRODUCTION_ENERGY_THRESHOLD` - Energy needed to reproduce
- `CATASTROPHE_CHANCE` - Random event frequency

## Browser Requirements

- Modern browser with ES6 module support
- Canvas 2D rendering
- Recommended: Chrome, Firefox, or Edge

## License

MIT

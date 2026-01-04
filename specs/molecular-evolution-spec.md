# Molecular Evolution Simulator

## Project Specification for Claude Code

**Version**: 1.0
**Last Updated**: January 2026

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technical Stack](#technical-stack)
3. [Architecture Overview](#architecture-overview)
4. [Core Systems](#core-systems)
   - [Genome System](#1-genome-system)
   - [Plasmid System](#2-plasmid-system)
   - [Horizontal Gene Transfer System](#3-horizontal-gene-transfer-system)
   - [Viral System](#4-viral-system)
   - [CRISPR Immunity System](#5-crispr-immunity-system)
   - [Physics System](#6-physics-system)
   - [Environment System](#7-environment-system)
   - [Cooperation System](#8-cooperation-system)
   - [Competition System](#9-competition-system)
   - [Symbiosis System](#10-symbiosis-system)
   - [Evolution System](#11-evolution-system)
   - [Visualization System](#12-visualization-system)
5. [File Structure](#file-structure)
6. [Configuration Parameters](#configuration-parameters)
7. [Initial Conditions](#initial-conditions)
8. [Success Criteria](#success-criteria)
9. [Development Todo List](#development-todo-list)
10. [Testing Checklist](#testing-checklist)

---

## Project Overview

Build a browser-based artificial life simulator that models the evolution of molecular-scale organisms capable of motility. The goal is to observe how simple building blocks, subject to mutation and selection pressure, can evolve increasingly complex behaviors including:

- Movement strategies and motility mechanisms
- Environmental adaptation
- Cooperation within species
- Competition for resources
- Cross-species symbiosis
- Horizontal gene transfer (bacterial-style genetic sharing)
- Viral infection and exogenous genetic introduction
- Adaptive immunity

This is inspired by how biological molecular motors (flagella, cilia, kinesin) evolved through variation and selection, and how microbial communities rapidly share genetic innovations through horizontal gene transfer and viral transduction.

### Key Principles

1. **Emergence over design**: Complex behaviors should emerge from simple rules, not be programmed directly
2. **Observability**: Every aspect of the simulation should be visible and inspectable
3. **Tunability**: All parameters should be adjustable at runtime
4. **Performance**: Support 200+ agents and 50+ viruses at 60fps
5. **Biological fidelity**: Mechanisms should mirror real biological processes

---

## Technical Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Rendering | HTML5 Canvas | Direct pixel control, good performance |
| Language | Vanilla JavaScript (ES6+) | No build step, easy debugging |
| Physics | Custom soft-body engine | Full control over behavior |
| Parallelism | Web Workers | Offload physics calculations |
| State | Plain objects | Simple serialization for save/load |
| Styling | CSS3 | Minimal, functional UI |

### Browser Requirements

- Modern browser with ES6 module support
- Canvas 2D context
- Web Worker support
- RequestAnimationFrame API

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MAIN LOOP (main.js)                            │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐     │
│   │  Input  │ → │ Update  │ → │ Systems │ → │ Render  │ → │  Output │     │
│   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
            ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
            │   AGENTS    │  │   VIRUSES   │  │ ENVIRONMENT │
            │             │  │             │  │             │
            │ - Genome    │  │ - Strain    │  │ - Grid      │
            │ - Body      │  │ - Payload   │  │ - Resources │
            │ - Plasmids  │  │ - Lifecycle │  │ - DNA frags │
            │ - Energy    │  │ - Position  │  │ - Climate   │
            └─────────────┘  └─────────────┘  └─────────────┘
                    │                │                │
                    └────────────────┼────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEMS                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Physics  │ │Evolution │ │   HGT    │ │  Viral   │ │ Immunity │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │Cooperate │ │ Compete  │ │Symbiosis │ │Environment│                       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VISUALIZATION                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Agents  │ │ Viruses  │ │   Env    │ │ Effects  │ │    UI    │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Systems

### 1. Genome System

The genome encodes all heritable traits of an organism.

#### Genome Structure

```javascript
Genome = {
  // === IDENTITY ===
  id: string,                    // Unique identifier
  species_marker: number,        // Used for kin recognition
  generation: number,            // How many generations from origin
  
  // === BODY STRUCTURE ===
  nodes: [
    {
      id: number,
      position: { x: number, y: number },  // Relative to body center
      mass: number,                         // 0.1 - 5.0
      friction: number                      // Surface friction coefficient
    }
  ],
  
  links: [
    {
      id: number,
      node_a: number,            // Index of first node
      node_b: number,            // Index of second node
      rest_length: number,       // Equilibrium length
      stiffness: number,         // Spring constant (1 - 100)
      damping: number            // Damping coefficient (0 - 1)
    }
  ],
  
  motors: [
    {
      id: number,
      attached_to: number,       // Link index
      cycle_speed: number,       // Oscillation frequency (0.1 - 10)
      amplitude: number,         // Contraction range (0 - 0.5 of rest_length)
      phase_offset: number,      // Initial phase (0 - 2π)
      energy_cost: number,       // Energy per cycle
      sensor_modulation: number  // Which sensor modulates this motor (-1 = none)
    }
  ],
  
  sensors: [
    {
      id: number,
      type: 'chemical' | 'thermal' | 'proximity' | 'kin' | 'signal' | 'viral',
      sensitivity: number,       // Detection threshold
      range: number,             // Detection radius
      target: string,            // What to detect (resource type, species marker, etc.)
      output_gain: number        // Signal amplification
    }
  ],
  
  // === METABOLISM ===
  metabolism: {
    primary_food: string,        // 'chemical_A', 'chemical_B', 'light', 'organic_matter'
    secondary_food: string,      // Fallback food source (optional)
    efficiency: number,          // Conversion rate (0.1 - 1.0)
    storage_capacity: number,    // Max energy (50 - 500)
    base_metabolism: number,     // Energy cost per tick just to exist
    waste_product: string        // What gets deposited
  },
  
  // === SOCIAL BEHAVIORS ===
  social: {
    // Cooperation (same species)
    cooperation: {
      link_willingness: number,    // 0-1, probability of linking with kin
      link_strength: number,       // Physical spring strength
      resource_sharing: number,    // Rate of energy sharing (0-1)
      signal_response: number      // How much to follow kin signals
    },
    
    // Competition
    competition: {
      aggression: number,          // 0-1, tendency to push others
      territorial_radius: number,  // Space to defend (0 = none)
      flee_threshold: number,      // When to retreat (0-1)
      resource_greed: number       // How aggressively to claim resources
    },
    
    // Symbiosis (different species)
    symbiosis: {
      markers: [number],           // Species markers willing to bond with
      offer: string,               // 'energy', 'protection', 'mobility', 'sensing', 'digestion'
      need: string,                // What this organism wants
      attachment_strength: number  // Bond durability
    },
    
    // Communication
    communication: {
      signal_emission: number,     // Strength of broadcast signals (0-1)
      signal_type: number,         // Information content identifier
      signal_frequency: number     // How often to emit
    }
  },
  
  // === HORIZONTAL GENE TRANSFER ===
  hgt: {
    donor_willingness: number,     // 0-1, probability of initiating transfer
    recipient_openness: number,    // 0-1, probability of accepting genes
    transfer_type: 'conjugation' | 'transformation' | 'both',
    plasmids: [Plasmid],           // Carried plasmids (see Plasmid System)
    restriction_markers: [number], // Rejected foreign plasmid markers
    dna_release_on_death: boolean  // Release genome fragments when dying
  },
  
  // === VIRAL SUSCEPTIBILITY ===
  viral: {
    receptors: [number],           // Which viral strains can attach
    resistance: number,            // General resistance (0-1)
    crispr_memory: [number]        // Previously encountered viral signatures
  }
}
```

#### Mutation Operations

| Mutation Type | Description | Probability |
|---------------|-------------|-------------|
| Point mutation | Small change to numeric value | 0.1 per gene |
| Add node | Insert new mass point | 0.02 |
| Remove node | Delete mass point and connected links | 0.02 |
| Add link | Connect two existing nodes | 0.03 |
| Remove link | Delete connection | 0.03 |
| Add motor | Attach motor to existing link | 0.02 |
| Remove motor | Delete motor | 0.02 |
| Add sensor | Add new environmental sensor | 0.02 |
| Remove sensor | Delete sensor | 0.02 |
| Duplicate gene | Copy gene with variation | 0.01 |
| Metabolism shift | Change food preference | 0.005 |
| Social shift | Modify cooperation/competition balance | 0.01 |

#### Crossover (Sexual Reproduction)

```javascript
function crossover(parent_a, parent_b) {
  child = new Genome();
  
  // Body structure: take random segments from each parent
  crossover_point = random_int(0, min(parent_a.nodes.length, parent_b.nodes.length));
  child.nodes = parent_a.nodes.slice(0, crossover_point)
                .concat(parent_b.nodes.slice(crossover_point));
  
  // Rebuild links for valid node references
  child.links = merge_links(parent_a.links, parent_b.links, child.nodes);
  
  // Motors and sensors: randomly select from either parent
  child.motors = random_selection(parent_a.motors, parent_b.motors);
  child.sensors = random_selection(parent_a.sensors, parent_b.sensors);
  
  // Metabolism: inherit from one parent with possible blending
  child.metabolism = random() < 0.5 ? parent_a.metabolism : parent_b.metabolism;
  
  // Social traits: blend values
  child.social = blend_social(parent_a.social, parent_b.social);
  
  // HGT traits: blend
  child.hgt = blend_hgt(parent_a.hgt, parent_b.hgt);
  
  // Plasmids: inherit from both with stability check
  child.hgt.plasmids = inherit_plasmids(parent_a, parent_b);
  
  // Viral traits: union of receptors, inherited CRISPR
  child.viral.receptors = union(parent_a.viral.receptors, parent_b.viral.receptors);
  child.viral.crispr_memory = inherit_crispr(parent_a, parent_b);
  
  return child;
}
```

---

### 2. Plasmid System

Plasmids are self-contained, transferable gene packages.

#### Plasmid Structure

```javascript
Plasmid = {
  id: string,                      // Unique identifier
  origin_marker: number,           // Species that first evolved this
  compatibility_markers: [number], // Which species can integrate this
  
  // Payload - capabilities conferred
  payload: {
    type: 'motor' | 'sensor' | 'metabolism' | 'social' | 'resistance' | 'hgt_boost',
    genes: {
      // Type-specific gene data
      // For 'motor': motor gene object
      // For 'sensor': sensor gene object
      // For 'metabolism': efficiency_boost, new_food_source
      // For 'resistance': viral_strain, toxin_type
      // For 'hgt_boost': donor_boost, recipient_boost
    },
    expression_strength: number    // How strongly payload is expressed (0-1)
  },
  
  // Transfer properties
  transfer_cost: number,           // Energy to donate
  integration_cost: number,        // Energy to integrate
  copy_fidelity: number,           // Mutation rate during transfer (0-1, 1 = perfect)
  
  // Persistence
  stability: number,               // Probability retained each generation (0-1)
  copy_number: number,             // Copies in host (affects expression)
  
  // Metadata
  transfer_count: number,          // Times this plasmid has been transferred
  age: number                      // Generations since creation
}
```

#### Plasmid Types

| Type | Payload Effect | Example |
|------|----------------|---------|
| Motor | Adds new motor to body | Flagellum-like appendage |
| Sensor | Adds new sensing capability | Chemical detector |
| Metabolism | Improves efficiency or adds food source | Digest chemical_B |
| Resistance | Confers immunity to virus or toxin | Anti-viral defense |
| Social | Modifies social behaviors | Increased cooperation |
| HGT Boost | Improves gene transfer ability | Better donor/recipient |

#### Plasmid Creation

```javascript
function create_plasmid(host_genome, type) {
  plasmid = {
    id: generate_uuid(),
    origin_marker: host_genome.species_marker,
    compatibility_markers: [host_genome.species_marker],
    
    payload: generate_payload(type, host_genome),
    
    transfer_cost: random_range(5, 20),
    integration_cost: random_range(5, 15),
    copy_fidelity: random_range(0.8, 0.99),
    
    stability: random_range(0.7, 0.95),
    copy_number: 1,
    
    transfer_count: 0,
    age: 0
  };
  
  return plasmid;
}
```

---

### 3. Horizontal Gene Transfer System

Three mechanisms for genetic sharing between agents.

#### 3.1 Conjugation (Direct Contact Transfer)

```javascript
function process_conjugation(agents, config) {
  for (agent of agents) {
    if (agent.energy < config.MIN_ENERGY_FOR_TRANSFER) continue;
    
    // Find nearby potential recipients
    nearby = spatial_query(agent.position, config.CONJUGATION_RANGE);
    
    for (other of nearby) {
      if (other === agent) continue;
      if (other.energy < config.MIN_ENERGY_FOR_TRANSFER) continue;
      
      // Check if donor willing
      if (random() > agent.genome.hgt.donor_willingness) continue;
      
      // Check if recipient open
      if (random() > other.genome.hgt.recipient_openness) continue;
      
      // Select plasmid to transfer
      plasmid = select_transferable_plasmid(agent);
      if (!plasmid) continue;
      
      // Check compatibility
      if (!is_compatible(plasmid, other)) continue;
      
      // Execute transfer
      execute_transfer(agent, other, plasmid, config);
    }
  }
}

function execute_transfer(donor, recipient, plasmid, config) {
  // Energy costs
  donor.energy -= plasmid.transfer_cost;
  recipient.energy -= plasmid.integration_cost;
  
  // Copy plasmid with potential mutations
  copied_plasmid = deep_copy(plasmid);
  if (random() > plasmid.copy_fidelity) {
    mutate_plasmid(copied_plasmid);
  }
  
  // Add to recipient
  recipient.genome.hgt.plasmids.push(copied_plasmid);
  
  // Integrate payload genes
  integrate_payload(recipient, copied_plasmid.payload);
  
  // Update metadata
  plasmid.transfer_count++;
  copied_plasmid.transfer_count = plasmid.transfer_count;
  
  // Log event for visualization
  log_hgt_event('conjugation', donor, recipient, plasmid);
}
```

#### 3.2 Transformation (Environmental DNA Uptake)

```javascript
// DNA fragment in environment
DNAFragment = {
  id: string,
  source_species: number,
  genes: object,                   // Partial genome or plasmid data
  completeness: number,            // 0-1, how intact
  position: { x: number, y: number },
  age: number,
  decay_rate: number
}

function process_transformation(agents, environment, config) {
  for (agent of agents) {
    cell = environment.get_cell(agent.position);
    fragments = cell.dna_fragments;
    
    if (fragments.length === 0) continue;
    if (random() > agent.genome.hgt.recipient_openness) continue;
    
    // Try to uptake a fragment
    for (fragment of fragments) {
      if (random() > config.TRANSFORMATION_RATE) continue;
      
      // Check compatibility (less strict than conjugation)
      if (!is_loosely_compatible(fragment, agent)) continue;
      
      // Integrate fragment
      integrate_fragment(agent, fragment);
      
      // Remove or degrade fragment
      fragment.completeness -= 0.5;
      if (fragment.completeness <= 0) {
        cell.remove_fragment(fragment);
      }
      
      log_hgt_event('transformation', null, agent, fragment);
      break;  // One uptake per tick
    }
  }
}

function release_dna_on_death(agent, environment) {
  if (!agent.genome.hgt.dna_release_on_death) return;
  
  cell = environment.get_cell(agent.position);
  
  // Fragment genome into pieces
  fragments = fragment_genome(agent.genome, config.FRAGMENT_COUNT);
  
  for (fragment of fragments) {
    cell.dna_fragments.push({
      id: generate_uuid(),
      source_species: agent.genome.species_marker,
      genes: fragment,
      completeness: random_range(0.3, 0.9),
      position: jitter(agent.position, 10),
      age: 0,
      decay_rate: config.DNA_DECAY_RATE
    });
  }
  
  // Also release any plasmids
  for (plasmid of agent.genome.hgt.plasmids) {
    cell.dna_fragments.push({
      id: generate_uuid(),
      source_species: plasmid.origin_marker,
      genes: { plasmid: plasmid },
      completeness: 0.9,
      position: jitter(agent.position, 5),
      age: 0,
      decay_rate: config.DNA_DECAY_RATE * 0.5  // Plasmids more stable
    });
  }
}
```

#### 3.3 Transduction (Virus-Mediated Transfer)

See Viral System section - transduction occurs when viruses accidentally package host genes.

---

### 4. Viral System

Viruses are independent entities that inject genetic material into hosts.

#### Virus Structure

```javascript
Virus = {
  id: string,
  strain_marker: number,           // Identifies viral lineage
  
  // Targeting
  receptor_binding: [number],      // Host receptors this virus attaches to
  host_specificity: number,        // 0-1, how selective (0 = broad, 1 = narrow)
  
  // Genetic payload
  payload: {
    genes: object,                 // Novel genes to introduce
    integration_mode: 'lytic' | 'lysogenic' | 'episomal',
    payload_origin: 'viral' | 'transduced',
    source_species: number         // If transduced, original host species
  },
  
  // Lifecycle
  replication_rate: number,        // Copies produced per infection (5-50)
  virulence: number,               // Damage to host (0-1)
  latency_period: number,          // Ticks before activation (lysogenic)
  mutation_rate: number,           // 0-1, how fast genome changes
  
  // Physical properties
  position: { x: number, y: number },
  velocity: { x: number, y: number },
  lifespan: number,                // Ticks remaining
  max_lifespan: number,
  size: number,                    // Affects visualization
  
  // Metadata
  infection_count: number,
  generation: number,
  parent_strain: number
}
```

#### Viral Lifecycle Implementation

```javascript
function process_viruses(viruses, agents, environment, config) {
  new_viruses = [];
  viruses_to_remove = [];
  
  for (virus of viruses) {
    // Age and decay
    virus.lifespan--;
    if (virus.lifespan <= 0) {
      viruses_to_remove.push(virus);
      continue;
    }
    
    // Movement (Brownian motion + drift toward hosts)
    update_virus_position(virus, agents, config);
    
    // Check for host contact
    host = find_contactable_host(virus, agents, config);
    if (host) {
      result = attempt_infection(virus, host, config);
      
      if (result.success) {
        if (result.new_viruses) {
          new_viruses.push(...result.new_viruses);
        }
        if (result.virus_consumed) {
          viruses_to_remove.push(virus);
        }
      }
    }
  }
  
  // Process infected hosts
  for (agent of agents) {
    if (agent.infection) {
      process_infection(agent, new_viruses, config);
    }
  }
  
  // Remove dead viruses, add new ones
  viruses = viruses.filter(v => !viruses_to_remove.includes(v));
  viruses.push(...new_viruses);
  
  // Spontaneous virus generation (rare)
  if (random() < config.VIRUS_SPAWN_RATE) {
    viruses.push(generate_novel_virus(config));
  }
  
  return viruses;
}

function attempt_infection(virus, host, config) {
  // Check receptor compatibility
  matching_receptors = intersection(virus.receptor_binding, host.genome.viral.receptors);
  if (matching_receptors.length === 0) {
    return { success: false };
  }
  
  // Check resistance
  if (random() < host.genome.viral.resistance) {
    // Host resisted - chance to form CRISPR memory
    if (random() < config.CRISPR_MEMORY_FORMATION_RATE) {
      add_crispr_memory(host, virus.strain_marker);
    }
    return { success: false };
  }
  
  // Check CRISPR immunity
  if (host.genome.viral.crispr_memory.includes(virus.strain_marker)) {
    return { success: false };
  }
  
  // Infection succeeds
  host.infection = {
    virus: virus,
    stage: virus.payload.integration_mode,
    progress: 0,
    viral_load: 1
  };
  
  // Integrate payload genes
  integrate_viral_payload(host, virus.payload);
  
  virus.infection_count++;
  log_viral_event('infection', virus, host);
  
  return { 
    success: true, 
    virus_consumed: virus.payload.integration_mode !== 'episomal' 
  };
}

function process_infection(agent, new_viruses, config) {
  infection = agent.infection;
  
  switch (infection.stage) {
    case 'lytic':
      // Drain host energy
      agent.energy -= infection.virus.virulence * 5;
      
      // Build viral copies
      infection.progress++;
      if (infection.progress >= 10) {
        infection.viral_load++;
        infection.progress = 0;
      }
      
      // Check for burst
      if (infection.viral_load >= infection.virus.replication_rate || agent.energy <= 0) {
        // Host dies, release viruses
        released = release_viral_copies(agent, infection, config);
        new_viruses.push(...released);
        agent.alive = false;
        log_viral_event('lytic_burst', infection.virus, agent);
      }
      break;
      
    case 'lysogenic':
      // Dormant - check trigger conditions
      if (agent.energy < agent.genome.metabolism.storage_capacity * 0.2 ||
          random() < config.LYSOGENIC_TRIGGER_RATE) {
        // Switch to lytic
        infection.stage = 'lytic';
        log_viral_event('lysogenic_activation', infection.virus, agent);
      }
      break;
      
    case 'episomal':
      // Persistent - slow release
      if (random() < 0.05) {
        new_virus = copy_virus(infection.virus);
        new_virus.position = jitter(agent.position, 5);
        new_viruses.push(new_virus);
      }
      break;
  }
}

function release_viral_copies(agent, infection, config) {
  copies = [];
  
  for (i = 0; i < infection.viral_load; i++) {
    // Chance of transduction
    if (random() < config.TRANSDUCTION_RATE) {
      // Package host genes instead of viral genes
      copy = create_transducing_particle(agent, infection.virus);
    } else {
      copy = copy_virus(infection.virus);
      // Apply mutations
      if (random() < infection.virus.mutation_rate) {
        mutate_virus(copy);
      }
    }
    
    copy.position = jitter(agent.position, 20);
    copy.velocity = random_direction(random_range(1, 3));
    copies.push(copy);
  }
  
  return copies;
}

function create_transducing_particle(host, virus) {
  return {
    ...copy_virus(virus),
    payload: {
      genes: extract_random_genes(host.genome),
      integration_mode: 'lysogenic',  // Transduced genes integrate
      payload_origin: 'transduced',
      source_species: host.genome.species_marker
    }
  };
}

function generate_novel_virus(config) {
  // Create genuinely new genetic material
  return {
    id: generate_uuid(),
    strain_marker: generate_strain_marker(),
    
    receptor_binding: [random_int(0, 100)],
    host_specificity: random_range(0.3, 0.8),
    
    payload: {
      genes: generate_novel_genes(),  // Random but potentially functional
      integration_mode: random_choice(['lytic', 'lysogenic', 'episomal']),
      payload_origin: 'viral',
      source_species: -1
    },
    
    replication_rate: random_int(5, 30),
    virulence: random_range(0.1, 0.8),
    latency_period: random_int(50, 500),
    mutation_rate: random_range(0.01, 0.1),
    
    position: random_position(),
    velocity: random_direction(1),
    lifespan: config.VIRUS_MAX_LIFESPAN,
    max_lifespan: config.VIRUS_MAX_LIFESPAN,
    size: random_range(2, 5),
    
    infection_count: 0,
    generation: 0,
    parent_strain: -1
  };
}
```

---

### 5. CRISPR Immunity System

Adaptive immunity that remembers past viral encounters.

```javascript
function add_crispr_memory(host, strain_marker) {
  memory = host.genome.viral.crispr_memory;
  
  // Check if already known
  if (memory.includes(strain_marker)) return;
  
  // Check capacity
  if (memory.length >= config.CRISPR_MEMORY_SLOTS) {
    // Remove oldest memory
    memory.shift();
  }
  
  memory.push(strain_marker);
  log_immunity_event('crispr_acquired', host, strain_marker);
}

function inherit_crispr(parent_a, parent_b) {
  // Combine memories from both parents
  combined = [...parent_a.genome.viral.crispr_memory, 
              ...parent_b.genome.viral.crispr_memory];
  
  // Remove duplicates
  unique = [...new Set(combined)];
  
  // Trim to capacity
  if (unique.length > config.CRISPR_MEMORY_SLOTS) {
    unique = unique.slice(-config.CRISPR_MEMORY_SLOTS);
  }
  
  // Chance of memory degradation
  return unique.filter(() => random() > config.CRISPR_MEMORY_DECAY);
}

function check_crispr_immunity(host, virus) {
  return host.genome.viral.crispr_memory.includes(virus.strain_marker);
}
```

---

### 6. Physics System

Soft-body dynamics using spring-mass-damper model.

#### Physics Update Loop

```javascript
function physics_update(agents, viruses, environment, dt, config) {
  // Phase 1: Update motors
  for (agent of agents) {
    update_motors(agent, dt);
  }
  
  // Phase 2: Calculate spring forces
  for (agent of agents) {
    calculate_spring_forces(agent);
  }
  
  // Phase 3: Environmental forces
  for (agent of agents) {
    apply_environmental_forces(agent, environment, config);
  }
  
  // Phase 4: Agent-agent interactions
  handle_collisions(agents, config);
  handle_cooperative_links(agents);
  handle_symbiotic_attachments(agents);
  
  // Phase 5: Integrate positions
  for (agent of agents) {
    integrate(agent, dt, config);
  }
  
  // Phase 6: Virus physics
  for (virus of viruses) {
    update_virus_physics(virus, agents, environment, dt, config);
  }
  
  // Phase 7: Boundary handling
  for (agent of agents) {
    enforce_boundaries(agent, environment);
  }
}

function update_motors(agent, dt) {
  for (motor of agent.body.motors) {
    // Update phase
    motor.current_phase += motor.cycle_speed * dt;
    if (motor.current_phase > 2 * Math.PI) {
      motor.current_phase -= 2 * Math.PI;
    }
    
    // Apply sensor modulation if connected
    modulation = 1.0;
    if (motor.sensor_modulation >= 0) {
      sensor = agent.body.sensors[motor.sensor_modulation];
      if (sensor) {
        modulation = sensor.current_value * sensor.output_gain;
      }
    }
    
    // Calculate target length change
    link = agent.body.links[motor.attached_to];
    oscillation = Math.sin(motor.current_phase) * motor.amplitude * modulation;
    link.target_length = link.rest_length * (1 + oscillation);
    
    // Energy cost
    agent.energy -= motor.energy_cost * Math.abs(oscillation) * dt;
  }
}

function calculate_spring_forces(agent) {
  for (link of agent.body.links) {
    node_a = agent.body.nodes[link.node_a];
    node_b = agent.body.nodes[link.node_b];
    
    // Calculate current length and direction
    dx = node_b.position.x - node_a.position.x;
    dy = node_b.position.y - node_a.position.y;
    current_length = Math.sqrt(dx * dx + dy * dy);
    
    if (current_length === 0) continue;
    
    // Normalized direction
    nx = dx / current_length;
    ny = dy / current_length;
    
    // Spring force (Hooke's law)
    target = link.target_length || link.rest_length;
    displacement = current_length - target;
    spring_force = link.stiffness * displacement;
    
    // Damping force
    rel_vel_x = node_b.velocity.x - node_a.velocity.x;
    rel_vel_y = node_b.velocity.y - node_a.velocity.y;
    rel_vel_along = rel_vel_x * nx + rel_vel_y * ny;
    damping_force = link.damping * rel_vel_along;
    
    // Total force
    total_force = spring_force + damping_force;
    
    // Apply to nodes
    fx = total_force * nx;
    fy = total_force * ny;
    
    node_a.force.x += fx;
    node_a.force.y += fy;
    node_b.force.x -= fx;
    node_b.force.y -= fy;
  }
}

function apply_environmental_forces(agent, environment, config) {
  cell = environment.get_cell(agent.position);
  
  for (node of agent.body.nodes) {
    // Drag (viscosity)
    drag = config.BASE_DRAG * environment.viscosity;
    node.force.x -= node.velocity.x * drag;
    node.force.y -= node.velocity.y * drag;
    
    // Friction with surface
    if (node.touching_surface) {
      friction = node.friction * config.SURFACE_FRICTION;
      node.force.x -= node.velocity.x * friction;
      node.force.y -= node.velocity.y * friction;
    }
    
    // Chemical gradient (if agent has chemical sensor)
    if (agent.has_sensor('chemical')) {
      gradient = cell.get_gradient(agent.genome.metabolism.primary_food);
      sensor_strength = agent.get_sensor_strength('chemical');
      node.force.x += gradient.x * sensor_strength;
      node.force.y += gradient.y * sensor_strength;
    }
  }
}

function integrate(agent, dt, config) {
  for (node of agent.body.nodes) {
    // Acceleration
    ax = node.force.x / node.mass;
    ay = node.force.y / node.mass;
    
    // Velocity update
    node.velocity.x += ax * dt;
    node.velocity.y += ay * dt;
    
    // Velocity clamping
    speed = Math.sqrt(node.velocity.x ** 2 + node.velocity.y ** 2);
    if (speed > config.MAX_SPEED) {
      node.velocity.x *= config.MAX_SPEED / speed;
      node.velocity.y *= config.MAX_SPEED / speed;
    }
    
    // Position update
    node.position.x += node.velocity.x * dt;
    node.position.y += node.velocity.y * dt;
    
    // Reset forces for next frame
    node.force.x = 0;
    node.force.y = 0;
  }
  
  // Update agent center position
  update_agent_center(agent);
}
```

#### Spatial Hashing for Collisions

```javascript
class SpatialHash {
  constructor(cell_size) {
    this.cell_size = cell_size;
    this.cells = new Map();
  }
  
  clear() {
    this.cells.clear();
  }
  
  hash(x, y) {
    cx = Math.floor(x / this.cell_size);
    cy = Math.floor(y / this.cell_size);
    return `${cx},${cy}`;
  }
  
  insert(entity) {
    key = this.hash(entity.position.x, entity.position.y);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key).push(entity);
  }
  
  query(x, y, radius) {
    results = [];
    cells_to_check = Math.ceil(radius / this.cell_size);
    
    cx = Math.floor(x / this.cell_size);
    cy = Math.floor(y / this.cell_size);
    
    for (dx = -cells_to_check; dx <= cells_to_check; dx++) {
      for (dy = -cells_to_check; dy <= cells_to_check; dy++) {
        key = `${cx + dx},${cy + dy}`;
        if (this.cells.has(key)) {
          for (entity of this.cells.get(key)) {
            dist = distance(x, y, entity.position.x, entity.position.y);
            if (dist <= radius) {
              results.push(entity);
            }
          }
        }
      }
    }
    
    return results;
  }
}
```

---

### 7. Environment System

Dynamic environment with resources, climate, and DNA fragments.

#### Environment Structure

```javascript
Environment = {
  width: number,
  height: number,
  cell_size: number,
  grid: [[Cell]],
  
  // Global parameters
  temperature: number,             // 0-1
  viscosity: number,               // 0-1
  time: number,                    // Simulation ticks
  generation: number,
  
  // Cycle parameters
  temperature_cycle: {
    base: number,
    amplitude: number,
    period: number,
    noise: number
  },
  
  viscosity_drift: {
    current: number,
    trend: number,
    variance: number
  },
  
  // Event tracking
  active_events: [Event],
  event_history: [Event]
}

Cell = {
  x: number,
  y: number,
  
  resources: {
    chemical_A: number,
    chemical_B: number,
    light: number,
    organic_matter: number
  },
  
  toxicity: number,
  movement_cost: number,
  
  dna_fragments: [DNAFragment],
  viral_particles: [Virus],
  
  // For gradient calculation
  resource_gradient: {
    chemical_A: { x: number, y: number },
    chemical_B: { x: number, y: number }
  }
}
```

#### Environment Update

```javascript
function update_environment(environment, agents, config) {
  environment.time++;
  
  // Update climate
  update_temperature(environment);
  update_viscosity(environment);
  
  // Update resources
  regenerate_resources(environment, config);
  diffuse_chemicals(environment, config);
  
  // Update DNA fragments
  decay_dna_fragments(environment, config);
  
  // Process agent effects
  for (agent of agents) {
    process_agent_environment_interaction(agent, environment, config);
  }
  
  // Recalculate gradients
  calculate_gradients(environment);
  
  // Random events
  if (random() < config.CATASTROPHE_CHANCE) {
    trigger_catastrophe(environment, config);
  }
  
  // Check for generation turnover
  if (should_advance_generation(environment, agents)) {
    environment.generation++;
  }
}

function update_temperature(environment) {
  cycle = environment.temperature_cycle;
  t = environment.time;
  
  // Sinusoidal base
  cycle_position = (t % cycle.period) / cycle.period;
  base_temp = cycle.base + cycle.amplitude * Math.sin(2 * Math.PI * cycle_position);
  
  // Add noise
  noise = (random() - 0.5) * cycle.noise;
  
  environment.temperature = clamp(base_temp + noise, 0, 1);
}

function regenerate_resources(environment, config) {
  for (row of environment.grid) {
    for (cell of row) {
      for (resource_type of ['chemical_A', 'chemical_B', 'light']) {
        // Natural regeneration
        current = cell.resources[resource_type];
        max_capacity = config.RESOURCE_CAPACITY[resource_type];
        regen_rate = config.RESOURCE_REGEN_RATE[resource_type];
        
        if (current < max_capacity) {
          cell.resources[resource_type] += regen_rate;
        }
      }
      
      // Organic matter from dead agents handled elsewhere
    }
  }
}

function trigger_catastrophe(environment, config) {
  event_type = random_choice([
    'temperature_spike',
    'temperature_crash', 
    'resource_depletion',
    'toxic_bloom',
    'viral_outbreak'
  ]);
  
  event = { type: event_type, time: environment.time, duration: 0 };
  
  switch (event_type) {
    case 'temperature_spike':
      environment.temperature_cycle.base += 0.3;
      event.duration = random_int(100, 300);
      break;
      
    case 'temperature_crash':
      environment.temperature_cycle.base -= 0.3;
      event.duration = random_int(100, 300);
      break;
      
    case 'resource_depletion':
      for (row of environment.grid) {
        for (cell of row) {
          for (key in cell.resources) {
            cell.resources[key] *= 0.1;
          }
        }
      }
      break;
      
    case 'toxic_bloom':
      cx = random_int(0, environment.width);
      cy = random_int(0, environment.height);
      radius = random_int(5, 15);
      
      for (cell of cells_in_radius(environment, cx, cy, radius)) {
        cell.toxicity = 1.0;
      }
      event.duration = random_int(200, 500);
      event.center = { x: cx, y: cy };
      event.radius = radius;
      break;
      
    case 'viral_outbreak':
      // Spawn many viruses of a new strain
      new_strain = generate_novel_virus(config);
      for (i = 0; i < 20; i++) {
        virus = copy_virus(new_strain);
        virus.position = random_position(environment);
        environment.viruses.push(virus);
      }
      break;
  }
  
  environment.active_events.push(event);
  environment.event_history.push(event);
  log_event('catastrophe', event);
}
```

---

### 8. Cooperation System

Same-species cooperative behavior.

```javascript
function process_cooperation(agents, config) {
  // Phase 1: Find potential cooperative pairs
  for (agent of agents) {
    if (agent.cooperative_links.length >= config.MAX_COOPERATIVE_LINKS) continue;
    
    nearby_kin = find_nearby_kin(agent, agents, config.COOPERATION_RANGE);
    
    for (kin of nearby_kin) {
      if (already_linked(agent, kin)) continue;
      if (kin.cooperative_links.length >= config.MAX_COOPERATIVE_LINKS) continue;
      
      // Check willingness
      agent_willing = random() < agent.genome.social.cooperation.link_willingness;
      kin_willing = random() < kin.genome.social.cooperation.link_willingness;
      
      if (agent_willing && kin_willing) {
        form_cooperative_link(agent, kin);
      }
    }
  }
  
  // Phase 2: Process existing links
  for (link of all_cooperative_links) {
    process_cooperative_link(link, config);
  }
  
  // Phase 3: Break strained links
  for (link of all_cooperative_links) {
    if (should_break_link(link, config)) {
      break_cooperative_link(link);
    }
  }
}

function form_cooperative_link(agent_a, agent_b) {
  link = {
    id: generate_uuid(),
    agent_a: agent_a,
    agent_b: agent_b,
    strength: Math.min(
      agent_a.genome.social.cooperation.link_strength,
      agent_b.genome.social.cooperation.link_strength
    ),
    age: 0
  };
  
  agent_a.cooperative_links.push(link);
  agent_b.cooperative_links.push(link);
  
  log_social_event('cooperation_formed', agent_a, agent_b);
}

function process_cooperative_link(link, config) {
  agent_a = link.agent_a;
  agent_b = link.agent_b;
  
  // 1. Physical spring force (keeps agents together)
  apply_link_spring_force(link);
  
  // 2. Resource sharing
  share_rate_a = agent_a.genome.social.cooperation.resource_sharing;
  share_rate_b = agent_b.genome.social.cooperation.resource_sharing;
  
  total_energy = agent_a.energy + agent_b.energy;
  avg_energy = total_energy / 2;
  
  // Move toward average based on sharing rates
  agent_a.energy = agent_a.energy * (1 - share_rate_a) + avg_energy * share_rate_a;
  agent_b.energy = agent_b.energy * (1 - share_rate_b) + avg_energy * share_rate_b;
  
  // 3. Movement coordination bonus
  if (is_moving_together(agent_a, agent_b)) {
    agent_a.movement_bonus = 1 + config.COOPERATION_SPEED_BONUS;
    agent_b.movement_bonus = 1 + config.COOPERATION_SPEED_BONUS;
  }
  
  // 4. Plasmid sharing (increased HGT within cooperative groups)
  if (random() < config.COOPERATIVE_HGT_BONUS) {
    attempt_plasmid_share(agent_a, agent_b);
  }
  
  link.age++;
}

function find_nearby_kin(agent, agents, range) {
  nearby = spatial_query(agent.position, range);
  
  return nearby.filter(other => {
    if (other === agent) return false;
    
    // Check species marker similarity
    marker_diff = Math.abs(agent.genome.species_marker - other.genome.species_marker);
    return marker_diff < config.KIN_RECOGNITION_THRESHOLD;
  });
}
```

---

### 9. Competition System

Resource and territorial competition.

```javascript
function process_competition(agents, environment, config) {
  // Phase 1: Resource competition
  for (cell of environment.cells_with_agents) {
    agents_in_cell = cell.agents;
    if (agents_in_cell.length <= 1) continue;
    
    resolve_resource_competition(agents_in_cell, cell, config);
  }
  
  // Phase 2: Territorial behavior
  for (agent of agents) {
    if (agent.genome.social.competition.territorial_radius <= 0) continue;
    
    intruders = find_intruders(agent, agents, config);
    
    for (intruder of intruders) {
      resolve_territorial_conflict(agent, intruder, config);
    }
  }
}

function resolve_resource_competition(agents, cell, config) {
  // Calculate total claim strength
  claims = agents.map(a => ({
    agent: a,
    strength: a.genome.social.competition.aggression * get_agent_mass(a)
  }));
  
  total_strength = claims.reduce((sum, c) => sum + c.strength, 0);
  
  // Distribute resources proportionally
  for (resource_type in cell.resources) {
    available = cell.resources[resource_type];
    if (available <= 0) continue;
    
    for (claim of claims) {
      share = (claim.strength / total_strength) * available;
      
      // Check if agent can use this resource
      if (claim.agent.genome.metabolism.primary_food === resource_type ||
          claim.agent.genome.metabolism.secondary_food === resource_type) {
        energy_gained = share * claim.agent.genome.metabolism.efficiency;
        claim.agent.energy += energy_gained;
      }
    }
    
    cell.resources[resource_type] = 0;  // Depleted
  }
}

function resolve_territorial_conflict(defender, intruder, config) {
  // Check if intruder is kin (don't fight kin)
  if (is_kin(defender, intruder)) return;
  
  defender_aggression = defender.genome.social.competition.aggression;
  intruder_flee_threshold = intruder.genome.social.competition.flee_threshold;
  
  if (defender_aggression > intruder_flee_threshold) {
    // Intruder flees
    direction = normalize(subtract(intruder.position, defender.position));
    intruder.velocity.x += direction.x * config.FLEE_FORCE;
    intruder.velocity.y += direction.y * config.FLEE_FORCE;
    
    log_social_event('fled', intruder, defender);
  } else {
    // Standoff - both pay energy cost
    defender.energy -= config.CONFLICT_COST;
    intruder.energy -= config.CONFLICT_COST;
    
    // Slight push apart
    direction = normalize(subtract(intruder.position, defender.position));
    intruder.velocity.x += direction.x * config.STANDOFF_PUSH;
    intruder.velocity.y += direction.y * config.STANDOFF_PUSH;
    defender.velocity.x -= direction.x * config.STANDOFF_PUSH;
    defender.velocity.y -= direction.y * config.STANDOFF_PUSH;
  }
}
```

---

### 10. Symbiosis System

Cross-species mutualistic relationships.

```javascript
function process_symbiosis(agents, config) {
  // Phase 1: Find potential symbiotic pairs
  for (agent of agents) {
    if (agent.symbiont || agent.host) continue;  // Already in relationship
    
    nearby_others = find_nearby_different_species(agent, agents, config.SYMBIOSIS_RANGE);
    
    for (other of nearby_others) {
      if (other.symbiont || other.host) continue;
      
      if (is_symbiotically_compatible(agent, other)) {
        form_symbiosis(agent, other);
        break;
      }
    }
  }
  
  // Phase 2: Process existing symbiotic relationships
  for (pair of symbiotic_pairs) {
    process_symbiotic_benefits(pair, config);
  }
  
  // Phase 3: Check for bond breaking
  for (pair of symbiotic_pairs) {
    if (should_break_symbiosis(pair, config)) {
      break_symbiosis(pair);
    }
  }
}

function is_symbiotically_compatible(agent_a, agent_b) {
  // Check marker recognition
  a_accepts_b = agent_b.genome.species_marker in agent_a.genome.social.symbiosis.markers;
  b_accepts_a = agent_a.genome.species_marker in agent_b.genome.social.symbiosis.markers;
  
  if (!a_accepts_b || !b_accepts_a) return false;
  
  // Check offer/need matching (mutualism)
  a_offers = agent_a.genome.social.symbiosis.offer;
  a_needs = agent_a.genome.social.symbiosis.need;
  b_offers = agent_b.genome.social.symbiosis.offer;
  b_needs = agent_b.genome.social.symbiosis.need;
  
  return (a_offers === b_needs) && (b_offers === a_needs);
}

function form_symbiosis(host, symbiont) {
  // Determine who is host based on size
  if (get_agent_mass(symbiont) > get_agent_mass(host)) {
    [host, symbiont] = [symbiont, host];
  }
  
  pair = {
    id: generate_uuid(),
    host: host,
    symbiont: symbiont,
    attachment_point: find_attachment_point(host),
    age: 0
  };
  
  host.symbiont = symbiont;
  symbiont.host = host;
  
  symbiotic_pairs.push(pair);
  log_social_event('symbiosis_formed', host, symbiont);
}

function process_symbiotic_benefits(pair, config) {
  host = pair.host;
  symbiont = pair.symbiont;
  
  // Apply benefit from symbiont to host
  apply_symbiotic_benefit(host, symbiont.genome.social.symbiosis.offer);
  
  // Apply benefit from host to symbiont
  apply_symbiotic_benefit(symbiont, host.genome.social.symbiosis.offer);
  
  // Maintenance cost
  host.energy -= config.SYMBIOSIS_MAINTENANCE_COST;
  symbiont.energy -= config.SYMBIOSIS_MAINTENANCE_COST;
  
  // Keep symbiont attached to host
  symbiont.position = add(host.position, pair.attachment_point);
  symbiont.velocity = { ...host.velocity };
  
  pair.age++;
}

SYMBIOTIC_BENEFITS = {
  'energy': (beneficiary, provider) => {
    beneficiary.energy += provider.genome.metabolism.efficiency * 2;
  },
  'protection': (beneficiary, provider) => {
    beneficiary.effective_mass_bonus = get_agent_mass(provider) * 0.3;
  },
  'mobility': (beneficiary, provider) => {
    beneficiary.movement_bonus = 1.5;
  },
  'sensing': (beneficiary, provider) => {
    beneficiary.sense_range_multiplier = 2.0;
  },
  'digestion': (beneficiary, provider) => {
    beneficiary.metabolism_efficiency_bonus = 0.5;
  }
};

function apply_symbiotic_benefit(beneficiary, benefit_type) {
  if (SYMBIOTIC_BENEFITS[benefit_type]) {
    SYMBIOTIC_BENEFITS[benefit_type](beneficiary, beneficiary.symbiont || beneficiary.host);
  }
}
```

---

### 11. Evolution System

Selection, reproduction, and speciation.

```javascript
function process_evolution(agents, config) {
  // Phase 1: Evaluate fitness
  for (agent of agents) {
    agent.fitness = calculate_fitness(agent, config);
  }
  
  // Phase 2: Selection
  survivors = select_survivors(agents, config);
  
  // Phase 3: Reproduction
  offspring = produce_offspring(survivors, config);
  
  // Phase 4: Mutation
  for (child of offspring) {
    mutate_genome(child.genome, config);
  }
  
  // Phase 5: Update population
  agents = [...survivors, ...offspring];
  
  // Phase 6: Update species assignments
  update_species(agents, config);
  
  return agents;
}

function calculate_fitness(agent, config) {
  fitness = 0;
  
  // Energy accumulated
  fitness += agent.total_energy_gathered * config.FITNESS_WEIGHT_ENERGY;
  
  // Survival duration
  fitness += agent.age * config.FITNESS_WEIGHT_SURVIVAL;
  
  // Offspring produced
  fitness += agent.offspring_count * config.FITNESS_WEIGHT_OFFSPRING;
  
  // Distance traveled (exploration)
  fitness += agent.total_distance * config.FITNESS_WEIGHT_DISTANCE;
  
  // Successful gene transfers (HGT donor)
  fitness += agent.successful_transfers * config.FITNESS_WEIGHT_HGT;
  
  // Viral infections survived
  fitness += agent.infections_survived * config.FITNESS_WEIGHT_IMMUNITY;
  
  // Cooperative relationships
  fitness += agent.cooperative_links.length * config.FITNESS_WEIGHT_COOPERATION;
  
  // Symbiotic relationships
  if (agent.symbiont || agent.host) {
    fitness += config.FITNESS_WEIGHT_SYMBIOSIS;
  }
  
  // Penalty for genome size (efficiency pressure)
  genome_size = count_genes(agent.genome);
  fitness -= genome_size * config.GENOME_SIZE_PENALTY;
  
  return Math.max(0, fitness);
}

function select_survivors(agents, config) {
  // Sort by fitness
  sorted = [...agents].sort((a, b) => b.fitness - a.fitness);
  
  // Elitism: top N% always survive
  elite_count = Math.floor(agents.length * config.ELITISM_RATE);
  elite = sorted.slice(0, elite_count);
  
  // Tournament selection for the rest
  remaining_slots = Math.floor(agents.length * config.SURVIVAL_RATE) - elite_count;
  tournament_winners = [];
  
  for (i = 0; i < remaining_slots; i++) {
    winner = tournament_select(agents, config.TOURNAMENT_SIZE);
    tournament_winners.push(winner);
  }
  
  return [...elite, ...tournament_winners];
}

function tournament_select(agents, tournament_size) {
  contestants = random_sample(agents, tournament_size);
  return contestants.reduce((best, current) => 
    current.fitness > best.fitness ? current : best
  );
}

function produce_offspring(parents, config) {
  offspring = [];
  target_count = config.TARGET_POPULATION - parents.length;
  
  for (i = 0; i < target_count; i++) {
    if (random() < config.SEXUAL_REPRODUCTION_RATE && parents.length >= 2) {
      // Sexual reproduction
      parent_a = weighted_random_select(parents);
      parent_b = weighted_random_select(parents.filter(p => p !== parent_a));
      child_genome = crossover(parent_a.genome, parent_b.genome);
    } else {
      // Asexual reproduction
      parent = weighted_random_select(parents);
      child_genome = deep_copy(parent.genome);
    }
    
    child = create_agent(child_genome);
    child.genome.generation = Math.max(
      parent_a?.genome.generation || 0,
      parent_b?.genome.generation || 0
    ) + 1;
    
    offspring.push(child);
  }
  
  return offspring;
}

function mutate_genome(genome, config) {
  // Point mutations
  mutate_numeric_values(genome, config.POINT_MUTATION_RATE);
  
  // Structural mutations
  if (random() < config.ADD_NODE_RATE) add_node(genome);
  if (random() < config.REMOVE_NODE_RATE) remove_node(genome);
  if (random() < config.ADD_LINK_RATE) add_link(genome);
  if (random() < config.REMOVE_LINK_RATE) remove_link(genome);
  if (random() < config.ADD_MOTOR_RATE) add_motor(genome);
  if (random() < config.REMOVE_MOTOR_RATE) remove_motor(genome);
  if (random() < config.ADD_SENSOR_RATE) add_sensor(genome);
  if (random() < config.REMOVE_SENSOR_RATE) remove_sensor(genome);
  
  // Gene duplication
  if (random() < config.DUPLICATION_RATE) duplicate_gene(genome);
  
  // Plasmid mutations
  for (plasmid of genome.hgt.plasmids) {
    if (random() < config.PLASMID_LOSS_RATE) {
      genome.hgt.plasmids.remove(plasmid);
    } else {
      mutate_plasmid(plasmid, config);
    }
  }
  
  // Social trait drift
  if (random() < config.SOCIAL_MUTATION_RATE) {
    mutate_social_traits(genome);
  }
}

function update_species(agents, config) {
  // Calculate genetic distances
  distance_matrix = calculate_distance_matrix(agents);
  
  // Cluster into species
  clusters = cluster_by_distance(agents, distance_matrix, config.SPECIES_DISTANCE_THRESHOLD);
  
  // Assign species markers
  for (cluster of clusters) {
    species_marker = cluster[0].genome.species_marker;
    for (agent of cluster) {
      agent.genome.species_marker = species_marker;
    }
  }
  
  // Check for speciation events
  for (cluster of clusters) {
    if (is_new_species(cluster, config)) {
      log_event('speciation', cluster);
    }
  }
}
```

---

### 12. Visualization System

Real-time Canvas rendering with multiple layers.

#### Renderer Architecture

```javascript
class Renderer {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;
    
    this.layers = {
      environment: new EnvironmentRenderer(this),
      agents: new AgentRenderer(this),
      viruses: new VirusRenderer(this),
      effects: new EffectsRenderer(this),
      ui: new UIRenderer(this)
    };
    
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1
    };
    
    this.overlay_mode = 'none';  // 'resources', 'temperature', 'species', 'viral', 'dna'
    this.selected_entity = null;
  }
  
  render(state) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.save();
    this.apply_camera();
    
    // Render layers in order
    this.layers.environment.render(state.environment, this.overlay_mode);
    this.layers.viruses.render(state.viruses);
    this.layers.agents.render(state.agents);
    this.layers.effects.render(state.effects);
    
    this.ctx.restore();
    
    // UI renders without camera transform
    this.layers.ui.render(state, this.selected_entity);
  }
  
  apply_camera() {
    this.ctx.translate(
      -this.camera.x * this.camera.zoom + this.canvas.width / 2,
      -this.camera.y * this.camera.zoom + this.canvas.height / 2
    );
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
  }
}
```

#### Agent Rendering

```javascript
class AgentRenderer {
  render(agents) {
    for (agent of agents) {
      this.render_agent(agent);
    }
    
    // Render cooperative links
    for (link of cooperative_links) {
      this.render_cooperative_link(link);
    }
    
    // Render symbiotic bonds
    for (pair of symbiotic_pairs) {
      this.render_symbiotic_bond(pair);
    }
  }
  
  render_agent(agent) {
    ctx = this.renderer.ctx;
    
    // Determine color based on mode
    color = this.get_agent_color(agent);
    
    // Render links
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    for (link of agent.body.links) {
      node_a = agent.body.nodes[link.node_a];
      node_b = agent.body.nodes[link.node_b];
      
      ctx.beginPath();
      ctx.moveTo(node_a.position.x, node_a.position.y);
      ctx.lineTo(node_b.position.x, node_b.position.y);
      ctx.stroke();
      
      // Highlight motors
      if (link.has_motor) {
        motor = get_motor_for_link(agent, link);
        intensity = Math.abs(Math.sin(motor.current_phase));
        ctx.strokeStyle = `rgba(255, 255, 0, ${intensity})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
    
    // Render nodes
    ctx.fillStyle = color;
    for (node of agent.body.nodes) {
      ctx.beginPath();
      ctx.arc(node.position.x, node.position.y, node.mass * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Render infection indicator
    if (agent.infection) {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(agent.position.x, agent.position.y, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Render selection indicator
    if (agent === this.renderer.selected_entity) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(agent.position.x, agent.position.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  
  get_agent_color(agent) {
    switch (this.renderer.config.agent_color_mode) {
      case 'species':
        return species_to_color(agent.genome.species_marker);
      case 'energy':
        return energy_to_color(agent.energy, agent.genome.metabolism.storage_capacity);
      case 'age':
        return age_to_color(agent.age);
      case 'fitness':
        return fitness_to_color(agent.fitness);
      case 'infection':
        return agent.infection ? 'red' : 'green';
      default:
        return 'white';
    }
  }
  
  render_cooperative_link(link) {
    ctx = this.renderer.ctx;
    
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(link.agent_a.position.x, link.agent_a.position.y);
    ctx.lineTo(link.agent_b.position.x, link.agent_b.position.y);
    ctx.stroke();
  }
  
  render_symbiotic_bond(pair) {
    ctx = this.renderer.ctx;
    
    ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(pair.host.position.x, pair.host.position.y);
    ctx.lineTo(pair.symbiont.position.x, pair.symbiont.position.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
```

#### UI Panels

```javascript
class UIRenderer {
  render(state, selected) {
    this.render_environment_panel(state.environment);
    this.render_population_panel(state.agents, state.viruses);
    this.render_genetic_flow_panel(state.hgt_events, state.viral_events);
    this.render_timeline(state.history);
    this.render_controls();
    
    if (selected) {
      if (selected.type === 'agent') {
        this.render_agent_panel(selected);
      } else if (selected.type === 'virus') {
        this.render_virus_panel(selected);
      }
    }
  }
  
  render_environment_panel(env) {
    panel = this.panels.environment;
    
    panel.clear();
    panel.add_gauge('Temperature', env.temperature, 0, 1);
    panel.add_gauge('Viscosity', env.viscosity, 0, 1);
    panel.add_gauge('Resources', calculate_total_resources(env), 0, env.max_resources);
    panel.add_text('Season', get_season_name(env));
    panel.add_text('Generation', env.generation);
    
    if (env.active_events.length > 0) {
      panel.add_text('Event', env.active_events[0].type, 'warning');
    }
    
    panel.add_gauge('Free DNA', count_dna_fragments(env), 0, 1000);
    panel.add_gauge('Viral Load', count_viruses(env), 0, 200);
  }
  
  render_population_panel(agents, viruses) {
    panel = this.panels.population;
    
    panel.clear();
    panel.add_stat('Total Agents', agents.length);
    panel.add_stat('Species', count_species(agents));
    
    stats = calculate_social_stats(agents);
    panel.add_stat('Cooperating', `${stats.cooperating} (${stats.coop_pct}%)`);
    panel.add_stat('Symbiotic', `${stats.symbiotic} (${stats.symb_pct}%)`);
    panel.add_stat('Competing', `${stats.competing} (${stats.comp_pct}%)`);
    
    panel.add_stat('Avg Plasmids', calculate_avg_plasmids(agents).toFixed(1));
    panel.add_stat('Infected', count_infected(agents));
    panel.add_stat('Viral Strains', count_viral_strains(viruses));
    
    panel.add_pie_chart('Species Distribution', get_species_distribution(agents));
  }
  
  render_agent_panel(agent) {
    panel = this.panels.selected;
    
    panel.clear();
    panel.add_header('Selected Agent');
    panel.add_text('Species', get_species_name(agent.genome.species_marker));
    panel.add_gauge('Energy', agent.energy, 0, agent.genome.metabolism.storage_capacity);
    panel.add_text('Age', agent.age);
    panel.add_text('Generation', agent.genome.generation);
    
    panel.add_subheader('Genome');
    panel.add_text('Nodes', agent.genome.nodes.length);
    panel.add_text('Links', agent.genome.links.length);
    panel.add_text('Motors', agent.genome.motors.length);
    panel.add_text('Sensors', agent.genome.sensors.length);
    
    panel.add_subheader('Social');
    panel.add_text('Coop Links', agent.cooperative_links.length);
    if (agent.symbiont) {
      panel.add_text('Symbiont', get_species_name(agent.symbiont.genome.species_marker));
    }
    if (agent.host) {
      panel.add_text('Host', get_species_name(agent.host.genome.species_marker));
    }
    
    panel.add_subheader('Genetics');
    panel.add_text('Plasmids', agent.genome.hgt.plasmids.length);
    panel.add_text('Metabolism', agent.genome.metabolism.primary_food);
    panel.add_text('Waste', agent.genome.metabolism.waste_product);
    
    panel.add_subheader('Immunity');
    if (agent.infection) {
      panel.add_text('Infection', agent.infection.stage, 'danger');
    } else {
      panel.add_text('Status', 'Healthy', 'success');
    }
    panel.add_text('CRISPR Memory', agent.genome.viral.crispr_memory.length);
    
    panel.add_button('View Genome', () => show_genome_modal(agent));
    panel.add_button('Track Lineage', () => highlight_lineage(agent));
  }
}
```

---

## File Structure

```
molecular-evolution/
├── index.html                    # Main HTML file
├── css/
│   └── styles.css               # All styling
├── js/
│   ├── main.js                  # Entry point, game loop, initialization
│   ├── config.js                # All configurable parameters
│   ├── state.js                 # Global state management
│   │
│   ├── core/
│   │   ├── genome.js            # Genome structure, creation, validation
│   │   ├── plasmid.js           # Plasmid structure and operations
│   │   ├── virus.js             # Virus structure and operations
│   │   ├── agent.js             # Agent class, body construction
│   │   ├── population.js        # Population management
│   │   └── species.js           # Species tracking, genetic distance
│   │
│   ├── systems/
│   │   ├── physics.js           # Soft-body physics engine
│   │   ├── environment.js       # Dynamic environment, resources, climate
│   │   ├── cooperation.js       # Cooperative behavior
│   │   ├── competition.js       # Competition and territories
│   │   ├── symbiosis.js         # Cross-species relationships
│   │   ├── evolution.js         # Selection, fitness, reproduction
│   │   ├── hgt.js               # Horizontal gene transfer (all types)
│   │   ├── viral.js             # Viral infection and lifecycle
│   │   └── immunity.js          # CRISPR-like adaptive immunity
│   │
│   ├── rendering/
│   │   ├── renderer.js          # Main renderer, camera, layers
│   │   ├── agentRenderer.js     # Agent and relationship drawing
│   │   ├── virusRenderer.js     # Virus particle drawing
│   │   ├── environmentRenderer.js # Background, gradients, grid
│   │   ├── effectsRenderer.js   # HGT animations, infection effects
│   │   └── uiRenderer.js        # Panels, graphs, controls
│   │
│   ├── ui/
│   │   ├── panels.js            # UI panel components
│   │   ├── graphs.js            # Timeline and statistics graphs
│   │   ├── controls.js          # Playback and parameter controls
│   │   └── modals.js            # Genome viewer, lineage viewer
│   │
│   ├── utils/
│   │   ├── spatial.js           # Spatial hashing
│   │   ├── math.js              # Vector math, random utilities
│   │   ├── genetics.js          # Gene comparison, distance calculation
│   │   ├── colors.js            # Color utilities and palettes
│   │   └── history.js           # Simulation history tracking
│   │
│   └── workers/
│       └── physicsWorker.js     # Web Worker for parallel physics
│
├── assets/
│   └── (optional icons/images)
│
└── README.md                    # Project documentation
```

---

## Configuration Parameters

All tunable parameters centralized in `config.js`:

```javascript
export const CONFIG = {
  // === SIMULATION ===
  TARGET_POPULATION: 150,
  TICKS_PER_GENERATION: 1000,
  DT: 0.016,                       // Time step (60fps)
  
  // === ENVIRONMENT ===
  WORLD_WIDTH: 800,
  WORLD_HEIGHT: 600,
  CELL_SIZE: 20,
  
  TEMPERATURE_CYCLE_BASE: 0.5,
  TEMPERATURE_CYCLE_AMPLITUDE: 0.3,
  TEMPERATURE_CYCLE_PERIOD: 500,
  TEMPERATURE_CYCLE_NOISE: 0.05,
  
  VISCOSITY_BASE: 0.3,
  VISCOSITY_DRIFT_RATE: 0.001,
  
  RESOURCE_CAPACITY: {
    chemical_A: 100,
    chemical_B: 100,
    light: 50,
    organic_matter: 200
  },
  RESOURCE_REGEN_RATE: {
    chemical_A: 0.5,
    chemical_B: 0.3,
    light: 1.0,
    organic_matter: 0.1
  },
  
  CATASTROPHE_CHANCE: 0.01,
  
  // === PHYSICS ===
  BASE_DRAG: 0.1,
  SURFACE_FRICTION: 0.3,
  MAX_SPEED: 10,
  COLLISION_RESPONSE: 0.5,
  
  // === AGENTS ===
  INITIAL_AGENT_COUNT: 100,
  MIN_NODES: 3,
  MAX_NODES: 20,
  INITIAL_ENERGY: 100,
  BASE_METABOLISM_COST: 0.1,
  
  // === EVOLUTION ===
  ELITISM_RATE: 0.1,
  SURVIVAL_RATE: 0.5,
  TOURNAMENT_SIZE: 5,
  SEXUAL_REPRODUCTION_RATE: 0.3,
  
  POINT_MUTATION_RATE: 0.1,
  ADD_NODE_RATE: 0.02,
  REMOVE_NODE_RATE: 0.02,
  ADD_LINK_RATE: 0.03,
  REMOVE_LINK_RATE: 0.03,
  ADD_MOTOR_RATE: 0.02,
  REMOVE_MOTOR_RATE: 0.02,
  ADD_SENSOR_RATE: 0.02,
  REMOVE_SENSOR_RATE: 0.02,
  DUPLICATION_RATE: 0.01,
  SOCIAL_MUTATION_RATE: 0.01,
  
  FITNESS_WEIGHT_ENERGY: 1.0,
  FITNESS_WEIGHT_SURVIVAL: 0.5,
  FITNESS_WEIGHT_OFFSPRING: 2.0,
  FITNESS_WEIGHT_DISTANCE: 0.3,
  FITNESS_WEIGHT_HGT: 0.3,
  FITNESS_WEIGHT_IMMUNITY: 0.2,
  FITNESS_WEIGHT_COOPERATION: 0.3,
  FITNESS_WEIGHT_SYMBIOSIS: 0.5,
  GENOME_SIZE_PENALTY: 0.01,
  
  SPECIES_DISTANCE_THRESHOLD: 0.3,
  
  // === COOPERATION ===
  COOPERATION_RANGE: 30,
  MAX_COOPERATIVE_LINKS: 5,
  COOPERATION_SPEED_BONUS: 0.2,
  COOPERATIVE_HGT_BONUS: 0.1,
  KIN_RECOGNITION_THRESHOLD: 10,
  
  // === COMPETITION ===
  FLEE_FORCE: 5,
  CONFLICT_COST: 5,
  STANDOFF_PUSH: 2,
  
  // === SYMBIOSIS ===
  SYMBIOSIS_RANGE: 20,
  SYMBIOSIS_MAINTENANCE_COST: 0.5,
  
  // === HORIZONTAL GENE TRANSFER ===
  CONJUGATION_RANGE: 15,
  MIN_ENERGY_FOR_TRANSFER: 30,
  TRANSFORMATION_RATE: 0.05,
  DNA_DECAY_RATE: 0.01,
  FRAGMENT_COUNT: 5,
  PLASMID_LOSS_RATE: 0.05,
  
  // === VIRAL ===
  INITIAL_VIRUS_COUNT: 10,
  VIRUS_SPAWN_RATE: 0.005,
  VIRUS_MAX_LIFESPAN: 500,
  VIRUS_DIFFUSION_RATE: 2,
  VIRUS_HOST_ATTRACTION: 0.5,
  TRANSDUCTION_RATE: 0.01,
  LYSOGENIC_TRIGGER_RATE: 0.01,
  NOVEL_GENE_RATE: 0.1,
  
  // === IMMUNITY ===
  CRISPR_MEMORY_FORMATION_RATE: 0.3,
  CRISPR_MEMORY_SLOTS: 10,
  CRISPR_MEMORY_DECAY: 0.01,
  
  // === RENDERING ===
  CANVAS_WIDTH: 1200,
  CANVAS_HEIGHT: 800,
  SIMULATION_AREA_WIDTH: 800,
  UI_PANEL_WIDTH: 400,
  
  DEFAULT_OVERLAY: 'none',
  DEFAULT_AGENT_COLOR_MODE: 'species',
  
  COLORS: {
    background: '#1a1a2e',
    grid: '#2a2a4e',
    ui_panel: '#252540',
    ui_text: '#ffffff',
    ui_accent: '#4a9eff',
    cooperative_link: '#00ff00',
    symbiotic_bond: '#ff00ff',
    viral_particle: '#ff4444',
    dna_fragment: '#ffff00'
  }
};
```

---

## Initial Conditions

```javascript
function initialize_simulation(config) {
  // Create environment
  environment = new Environment(config);
  environment.initialize_resources();
  
  // Create initial population
  agents = [];
  for (i = 0; i < config.INITIAL_AGENT_COUNT; i++) {
    genome = generate_random_genome(config);
    agent = create_agent(genome);
    agent.position = random_position(environment);
    agents.push(agent);
  }
  
  // Distribute initial plasmids
  plasmid_types = generate_initial_plasmid_types(10);
  for (agent of random_sample(agents, 30)) {
    plasmid = random_choice(plasmid_types);
    agent.genome.hgt.plasmids.push(deep_copy(plasmid));
  }
  
  // Create initial viruses
  viruses = [];
  virus_strains = generate_initial_virus_strains(3);
  for (strain of virus_strains) {
    for (i = 0; i < 5; i++) {
      virus = copy_virus(strain);
      virus.position = random_position(environment);
      viruses.push(virus);
    }
  }
  
  return { environment, agents, viruses };
}
```

---

## Success Criteria

The simulation is functioning correctly when you observe:

### Tier 1: Basic Function (Must Have)
- [ ] Agents render and move in response to motor activity
- [ ] Physics simulation is stable (no explosions or freezing)
- [ ] Resources deplete when consumed, regenerate over time
- [ ] Agents die when energy reaches zero
- [ ] Reproduction creates offspring with mutations
- [ ] UI displays current state accurately

### Tier 2: Evolution (Should Have)
- [ ] Motility improves over generations (agents move more efficiently)
- [ ] Different species emerge with distinct characteristics
- [ ] Population responds to environmental changes
- [ ] Fitness-based selection drives adaptation

### Tier 3: Social Dynamics (Should Have)
- [ ] Cooperative links form between same-species agents
- [ ] Territorial behavior creates spatial organization
- [ ] Symbiotic pairs form between compatible species

### Tier 4: Genetic Transfer (Should Have)
- [ ] Conjugation transfers plasmids between nearby agents
- [ ] Dead agents release DNA fragments
- [ ] Transformation allows uptake of environmental DNA
- [ ] Beneficial plasmids spread through population

### Tier 5: Viral Dynamics (Should Have)
- [ ] Viruses infect susceptible hosts
- [ ] Lytic cycle kills hosts and releases new viruses
- [ ] Lysogenic cycle integrates viral genes
- [ ] CRISPR immunity develops after surviving infection
- [ ] Transduction moves genes between unrelated species

### Tier 6: Emergent Complexity (Nice to Have)
- [ ] Boom/bust population cycles
- [ ] Viral epidemics followed by immunity evolution
- [ ] Novel capabilities from viral genes become fixed
- [ ] Cross-species gene flow via transduction
- [ ] Increasing average genome complexity
- [ ] Niche differentiation (species specialize on different resources)

---

## Development Todo List

### Phase 1: Foundation
- [ ] **1.1** Set up project structure and files
- [ ] **1.2** Create `index.html` with canvas and basic layout
- [ ] **1.3** Create `styles.css` with UI styling
- [ ] **1.4** Create `config.js` with all parameters
- [ ] **1.5** Create `main.js` with game loop skeleton
- [ ] **1.6** Create `state.js` for global state management
- [ ] **1.7** Create `utils/math.js` with vector operations
- [ ] **1.8** Create `utils/spatial.js` with spatial hash

### Phase 2: Core Entities
- [ ] **2.1** Create `core/genome.js` - genome structure and validation
- [ ] **2.2** Create `core/agent.js` - agent class with body construction
- [ ] **2.3** Create random genome generator
- [ ] **2.4** Create `core/population.js` - population management
- [ ] **2.5** Create `core/species.js` - species tracking

### Phase 3: Basic Physics
- [ ] **3.1** Create `systems/physics.js` - physics system shell
- [ ] **3.2** Implement spring force calculation
- [ ] **3.3** Implement motor oscillation
- [ ] **3.4** Implement position integration
- [ ] **3.5** Implement boundary handling
- [ ] **3.6** Implement collision detection and response
- [ ] **3.7** Test single agent physics stability

### Phase 4: Basic Rendering
- [ ] **4.1** Create `rendering/renderer.js` - main renderer
- [ ] **4.2** Create `rendering/agentRenderer.js` - agent drawing
- [ ] **4.3** Implement node and link rendering
- [ ] **4.4** Implement motor visualization
- [ ] **4.5** Implement camera pan and zoom
- [ ] **4.6** Test rendering with multiple agents

### Phase 5: Environment
- [ ] **5.1** Create `systems/environment.js` - environment system
- [ ] **5.2** Implement resource grid
- [ ] **5.3** Implement resource consumption
- [ ] **5.4** Implement resource regeneration
- [ ] **5.5** Implement temperature cycles
- [ ] **5.6** Implement viscosity effects
- [ ] **5.7** Create `rendering/environmentRenderer.js`
- [ ] **5.8** Implement resource gradient visualization

### Phase 6: Basic Evolution
- [ ] **6.1** Create `systems/evolution.js` - evolution system
- [ ] **6.2** Implement fitness calculation
- [ ] **6.3** Implement selection (elitism + tournament)
- [ ] **6.4** Implement asexual reproduction
- [ ] **6.5** Implement point mutations
- [ ] **6.6** Implement structural mutations (add/remove genes)
- [ ] **6.7** Implement sexual reproduction (crossover)
- [ ] **6.8** Test evolution over multiple generations

### Phase 7: UI Basics
- [ ] **7.1** Create `ui/panels.js` - panel components
- [ ] **7.2** Create `rendering/uiRenderer.js` - UI rendering
- [ ] **7.3** Implement environment panel
- [ ] **7.4** Implement population panel
- [ ] **7.5** Implement agent selection
- [ ] **7.6** Implement selected agent panel
- [ ] **7.7** Create `ui/controls.js` - playback controls
- [ ] **7.8** Implement play/pause/step/speed controls

### Phase 8: Competition
- [ ] **8.1** Create `systems/competition.js` - competition system
- [ ] **8.2** Implement resource competition logic
- [ ] **8.3** Implement territorial behavior
- [ ] **8.4** Implement flee/standoff mechanics
- [ ] **8.5** Test competition dynamics

### Phase 9: Cooperation
- [ ] **9.1** Create `systems/cooperation.js` - cooperation system
- [ ] **9.2** Implement kin detection
- [ ] **9.3** Implement cooperative link formation
- [ ] **9.4** Implement resource sharing
- [ ] **9.5** Implement movement coordination bonus
- [ ] **9.6** Implement cooperative link rendering
- [ ] **9.7** Test cooperation dynamics

### Phase 10: Symbiosis
- [ ] **10.1** Create `systems/symbiosis.js` - symbiosis system
- [ ] **10.2** Implement compatibility matching
- [ ] **10.3** Implement symbiotic bond formation
- [ ] **10.4** Implement symbiotic benefits (all types)
- [ ] **10.5** Implement symbiotic attachment physics
- [ ] **10.6** Implement symbiotic bond rendering
- [ ] **10.7** Test symbiosis dynamics

### Phase 11: Plasmids and HGT
- [ ] **11.1** Create `core/plasmid.js` - plasmid structure
- [ ] **11.2** Generate initial plasmid types
- [ ] **11.3** Create `systems/hgt.js` - HGT system
- [ ] **11.4** Implement conjugation transfer
- [ ] **11.5** Implement plasmid integration into genome
- [ ] **11.6** Implement DNA fragment release on death
- [ ] **11.7** Implement transformation (DNA uptake)
- [ ] **11.8** Implement DNA fragment decay
- [ ] **11.9** Create `rendering/effectsRenderer.js`
- [ ] **11.10** Implement HGT visualization effects
- [ ] **11.11** Test HGT spreading through population

### Phase 12: Viruses
- [ ] **12.1** Create `core/virus.js` - virus structure
- [ ] **12.2** Generate initial virus strains
- [ ] **12.3** Create `systems/viral.js` - viral system
- [ ] **12.4** Implement virus physics (movement, decay)
- [ ] **12.5** Implement infection attempt logic
- [ ] **12.6** Implement lytic cycle
- [ ] **12.7** Implement lysogenic cycle
- [ ] **12.8** Implement episomal persistence
- [ ] **12.9** Implement virus replication and release
- [ ] **12.10** Create `rendering/virusRenderer.js`
- [ ] **12.11** Implement virus particle rendering
- [ ] **12.12** Implement infection effect rendering
- [ ] **12.13** Test viral epidemic dynamics

### Phase 13: Transduction
- [ ] **13.1** Implement transducing particle creation
- [ ] **13.2** Implement transduced gene integration
- [ ] **13.3** Test cross-species gene transfer

### Phase 14: Immunity
- [ ] **14.1** Create `systems/immunity.js` - immunity system
- [ ] **14.2** Implement CRISPR memory formation
- [ ] **14.3** Implement CRISPR immunity check
- [ ] **14.4** Implement CRISPR inheritance
- [ ] **14.5** Implement memory decay
- [ ] **14.6** Test immunity evolution after epidemics

### Phase 15: Novel Genes
- [ ] **15.1** Implement novel gene generation for viruses
- [ ] **15.2** Implement gene functionality evaluation
- [ ] **15.3** Track gene origins (vertical vs HGT vs viral)
- [ ] **15.4** Test novel capability emergence

### Phase 16: Advanced UI
- [ ] **16.1** Create `ui/graphs.js` - statistics graphs
- [ ] **16.2** Implement timeline graph
- [ ] **16.3** Implement population history graph
- [ ] **16.4** Create `ui/modals.js` - modal dialogs
- [ ] **16.5** Implement genome viewer modal
- [ ] **16.6** Implement lineage viewer
- [ ] **16.7** Implement genetic flow panel
- [ ] **16.8** Implement virus panel
- [ ] **16.9** Implement overlay toggle (resources, temperature, etc.)
- [ ] **16.10** Implement agent color mode toggle

### Phase 17: Events and Catastrophes
- [ ] **17.1** Implement catastrophe triggering
- [ ] **17.2** Implement temperature spike/crash
- [ ] **17.3** Implement resource depletion event
- [ ] **17.4** Implement toxic bloom
- [ ] **17.5** Implement viral outbreak event
- [ ] **17.6** Implement event visualization
- [ ] **17.7** Implement event history in timeline

### Phase 18: Performance
- [ ] **18.1** Create `workers/physicsWorker.js`
- [ ] **18.2** Offload physics to Web Worker
- [ ] **18.3** Optimize spatial hashing
- [ ] **18.4** Implement entity pooling
- [ ] **18.5** Profile and optimize hot paths
- [ ] **18.6** Test performance with 200+ agents

### Phase 19: Save/Load
- [ ] **19.1** Implement state serialization
- [ ] **19.2** Implement state deserialization
- [ ] **19.3** Implement save to localStorage
- [ ] **19.4** Implement save to file download
- [ ] **19.5** Implement load from file
- [ ] **19.6** Add save/load UI buttons

### Phase 20: Polish
- [ ] **20.1** Add parameter adjustment panel
- [ ] **20.2** Add manual virus injection button
- [ ] **20.3** Add manual plasmid injection
- [ ] **20.4** Improve tooltips and help text
- [ ] **20.5** Add keyboard shortcuts
- [ ] **20.6** Write README documentation
- [ ] **20.7** Final testing and bug fixes

---

## Testing Checklist

### Unit Tests
- [ ] Vector math functions
- [ ] Spatial hash insert and query
- [ ] Genome validation
- [ ] Mutation operations
- [ ] Crossover operation
- [ ] Fitness calculation
- [ ] Plasmid compatibility check
- [ ] Viral infection logic
- [ ] CRISPR immunity check

### Integration Tests
- [ ] Single agent physics stability (1000 ticks)
- [ ] Multi-agent collision handling
- [ ] Cooperation link formation and breaking
- [ ] Symbiosis formation between compatible species
- [ ] HGT conjugation between agents
- [ ] Viral infection and lifecycle completion
- [ ] Evolution produces viable offspring

### Performance Tests
- [ ] 100 agents at 60fps
- [ ] 200 agents at 60fps
- [ ] 200 agents + 50 viruses at 60fps
- [ ] 1000 generation evolution run

### Emergent Behavior Tests
- [ ] Run 500 generations - observe species diversification
- [ ] Run 500 generations - observe cooperation emergence
- [ ] Introduce novel virus - observe epidemic and immunity response
- [ ] Run 1000 generations - observe increasing complexity

---

## Notes for Claude Code

1. **Build incrementally**: Complete each phase before moving to the next. Test thoroughly at each stage.

2. **Start simple**: Initial genomes should have minimal structure (3-5 nodes, 1-2 motors). Complexity should emerge through evolution.

3. **Prioritize observability**: Always ensure you can see what's happening. Add console logging for major events during development.

4. **Balance parameters carefully**: 
   - HGT rates: Too high makes vertical evolution irrelevant; too low shows no gene flow
   - Viral virulence: Too high kills all hosts and viruses die; too low has no impact
   - Mutation rates: Too high prevents selection; too low prevents adaptation

5. **Use spatial hashing**: Critical for performance. Don't use O(n²) collision checks.

6. **Save working states**: Before major changes, save a working state you can revert to.

7. **Test edge cases**: Empty populations, single agent, maximum population, zero resources.

---

*End of Specification*

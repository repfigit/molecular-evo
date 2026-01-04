/**
 * Environment System
 *
 * Manages the simulation environment including:
 * - Resource grids (chemicals, light, organic matter)
 * - Temperature cycles and climate
 * - Viscosity effects
 * - Gradient calculations for chemotaxis
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { clamp, lerp } from '../utils/math.js';

// === ENVIRONMENTAL HETEROGENEITY ===
// Persistent spatial zones with different selection regimes
// Enables local adaptation and divergent selection
let environmentalZones = [];

/**
 * Create a new environment
 */
export function createEnvironment() {
    const cellSize = CONFIG.ENVIRONMENT_CELL_SIZE;
    const cols = Math.ceil(CONFIG.WORLD_WIDTH / cellSize);
    const rows = Math.ceil(CONFIG.WORLD_HEIGHT / cellSize);

    // Initialize resource grids
    const resources = [];
    for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
            row.push({
                chemical_A: Math.random() * 0.5 + 0.25,
                chemical_B: Math.random() * 0.5 + 0.25,
                light: calculateLightLevel(x, y, cols, rows),
                organic_matter: Math.random() * 0.2
            });
        }
        resources.push(row);
    }

    return {
        width: CONFIG.WORLD_WIDTH,
        height: CONFIG.WORLD_HEIGHT,
        cellSize,
        cols,
        rows,
        resources,
        temperature: CONFIG.TEMPERATURE_CYCLE_BASE,
        viscosity: CONFIG.VISCOSITY_BASE,
        time: 0,
        generation: 0,
        current: { x: 0, y: 0 },  // Global current/flow
        toxicZones: [],
        resourceSpots: []
    };
}

/**
 * Calculate initial light level based on position
 * Higher at top of world
 */
function calculateLightLevel(x, y, cols, rows) {
    const verticalGradient = 1 - (y / rows);
    const noise = (Math.random() - 0.5) * 0.2;
    return clamp(verticalGradient * 0.8 + 0.2 + noise, 0, 1);
}

/**
 * Initialize the environment system
 */
export function initEnvironment() {
    state.environment = createEnvironment();
    initEnvironmentalZones();
    initGeographicBarriers();  // Initialize allopatric barriers
    return state.environment;
}

// === ENVIRONMENTAL ZONE SYSTEM ===
// Creates persistent spatial heterogeneity for local adaptation

/**
 * Initialize environmental zones with different selection regimes
 * Each zone has different optimal phenotypes, driving divergent selection
 */
export function initEnvironmentalZones() {
    environmentalZones = [];

    // Create 4-6 distinct zones with different selection regimes
    const zoneCount = 4 + Math.floor(Math.random() * 3);
    const resourceTypes = ['chemical_A', 'chemical_B', 'light', 'organic_matter'];

    for (let i = 0; i < zoneCount; i++) {
        // Position zones somewhat evenly distributed
        const angle = (i / zoneCount) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 0.25 + Math.random() * 0.2;  // 25-45% from center
        const centerX = CONFIG.WORLD_WIDTH * 0.5 + Math.cos(angle) * CONFIG.WORLD_WIDTH * dist;
        const centerY = CONFIG.WORLD_HEIGHT * 0.5 + Math.sin(angle) * CONFIG.WORLD_HEIGHT * dist;

        environmentalZones.push({
            id: i,
            name: `Zone_${String.fromCharCode(65 + i)}`,  // Zone_A, Zone_B, etc.

            // Spatial extent
            centerX: clamp(centerX, 100, CONFIG.WORLD_WIDTH - 100),
            centerY: clamp(centerY, 100, CONFIG.WORLD_HEIGHT - 100),
            radius: 80 + Math.random() * 120,  // 80-200 radius

            // SELECTION REGIME - different optima in each zone
            temperatureOptimum: 0.25 + (i / zoneCount) * 0.5,  // Gradient from cold to hot
            dominantResource: resourceTypes[i % resourceTypes.length],
            predationRisk: Math.random(),  // 0-1, how dangerous the zone is

            // Zone characteristics affecting fitness
            resourceMultiplier: 0.6 + Math.random() * 0.8,  // 0.6-1.4
            viscosityModifier: 0.8 + Math.random() * 0.4,   // 0.8-1.2
            toxicityLevel: Math.random() * 0.3,             // 0-0.3 background toxicity

            // Zone stability (how predictable the zone is)
            stability: 0.5 + Math.random() * 0.5,  // 0.5-1.0

            // === ECOLOGICAL SUCCESSION STATE ===
            // Tracks time since disturbance and community development
            succession: {
                stage: 0,                          // 0 = pioneer, 1 = climax
                time_since_disturbance: 0,         // Ticks since last major disturbance
                climax_time: 2000 + Math.random() * 2000,  // Ticks to reach climax
                disturbance_history: [],           // Recent disturbance events
                current_density: 0,                // Organism density affects succession
                pioneer_threshold: 0.3,            // Stage < this = early succession
                climax_threshold: 0.7              // Stage > this = climax community
            }
        });
    }

    // Store in state for access by other systems
    if (state.environment) {
        state.environment.zones = environmentalZones;
    }
}

/**
 * Get the zone at a given position
 * Returns the zone with highest influence, or null if outside all zones
 */
export function getZoneAt(x, y) {
    let bestZone = null;
    let bestInfluence = 0;

    for (const zone of environmentalZones) {
        const dx = x - zone.centerX;
        const dy = y - zone.centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < zone.radius) {
            // Influence is stronger toward center
            const influence = 1 - (dist / zone.radius);
            if (influence > bestInfluence) {
                bestInfluence = influence;
                bestZone = zone;
            }
        }
    }

    return { zone: bestZone, influence: bestInfluence };
}

/**
 * Calculate local adaptation fitness bonus for an agent
 * Agents whose phenotype matches local optimum get fitness advantage
 */
export function getLocalAdaptationBonus(agent) {
    const { zone, influence } = getZoneAt(agent.position.x, agent.position.y);
    if (!zone || influence < 0.1) return 0;

    let bonus = 0;
    const metabolism = agent.genome.metabolism;

    // 1. TEMPERATURE ADAPTATION
    // Calculate how well agent's phenotype matches zone temperature
    // Use plasticity acclimation as proxy for temperature preference
    const agentTempPref = agent.plasticity?.acclimated_temperature ?? 0.5;
    const tempMatch = 1 - Math.abs(agentTempPref - zone.temperatureOptimum);
    bonus += tempMatch * 0.3 * influence;

    // 2. RESOURCE SPECIALIZATION
    // Agents that feed on the dominant resource get bonus
    if (metabolism.primary_food === zone.dominantResource) {
        bonus += 0.4 * influence;  // Large bonus for matching primary food
    } else if (metabolism.secondary_food === zone.dominantResource) {
        bonus += 0.15 * influence;  // Smaller bonus for secondary
    }

    // 3. PREDATION ADAPTATION
    // High-predation zones favor defense traits (aggression, size, speed)
    // Low-predation zones favor energy efficiency
    const agentDefense = (agent.genome.social.competition.aggression +
                          agent.genome.nodes.length / 10) / 2;

    if (zone.predationRisk > 0.5) {
        // High predation - defense is adaptive
        if (agentDefense > 0.4) {
            bonus += (agentDefense - 0.4) * 0.3 * influence;
        }
    } else {
        // Low predation - efficiency is adaptive
        if (agentDefense < 0.3) {
            bonus += (0.3 - agentDefense) * 0.2 * influence;
        }
    }

    // 4. TOXICITY RESISTANCE
    // Agents in toxic zones need resistance
    if (zone.toxicityLevel > 0.1) {
        const resistance = agent.genome.viral?.resistance ?? 0.3;
        bonus += resistance * zone.toxicityLevel * influence;
    }

    return bonus;
}

/**
 * Get zone-specific resource modifier
 * Dominant resources are more abundant in their zone
 */
export function getZoneResourceModifier(x, y, resourceType) {
    const { zone, influence } = getZoneAt(x, y);
    if (!zone || influence < 0.1) return 1.0;

    // Dominant resource is more abundant
    if (resourceType === zone.dominantResource) {
        return 1 + (zone.resourceMultiplier - 1) * influence;
    }

    // Non-dominant resources are somewhat rarer
    return 1 - (0.2 * influence);
}

/**
 * Get zone-specific metabolism cost modifier
 * Based on temperature mismatch and toxicity
 */
export function getZoneMetabolismModifier(agent) {
    const { zone, influence } = getZoneAt(agent.position.x, agent.position.y);
    if (!zone || influence < 0.1) return 1.0;

    let modifier = 1.0;

    // Temperature mismatch increases metabolism cost
    const agentTempPref = agent.plasticity?.acclimated_temperature ?? 0.5;
    const tempMismatch = Math.abs(agentTempPref - zone.temperatureOptimum);
    modifier += tempMismatch * 0.5 * influence;

    // Toxicity increases metabolism (detoxification cost)
    modifier += zone.toxicityLevel * influence;

    // Viscosity affects movement costs
    modifier *= zone.viscosityModifier;

    return modifier;
}

/**
 * Get summary of agent distribution across zones
 */
export function getZonePopulationStats() {
    const living = state.agents.filter(a => a.alive);
    const zonePopulations = new Map();

    // Initialize counts
    for (const zone of environmentalZones) {
        zonePopulations.set(zone.id, {
            count: 0,
            avgFitness: 0,
            dominantResource: zone.dominantResource,
            temperatureOptimum: zone.temperatureOptimum
        });
    }
    zonePopulations.set('outside', { count: 0, avgFitness: 0 });

    // Count agents per zone
    for (const agent of living) {
        const { zone } = getZoneAt(agent.position.x, agent.position.y);
        const zoneId = zone ? zone.id : 'outside';
        const pop = zonePopulations.get(zoneId);
        pop.count++;
        pop.avgFitness += agent.energy;  // Proxy for fitness
    }

    // Calculate averages
    for (const [id, pop] of zonePopulations.entries()) {
        if (pop.count > 0) {
            pop.avgFitness /= pop.count;
        }
    }

    return zonePopulations;
}

// === ECOLOGICAL SUCCESSION SYSTEM ===
// Simulates community development from pioneer to climax stages
// Creates temporal niche partitioning between r- and K-strategists

/**
 * Update succession state for all zones
 * Called periodically from main update loop
 */
export function updateSuccession(agents, dt) {
    // Get population per zone for density-dependent effects
    const zonePops = getZonePopulationStats();

    for (const zone of environmentalZones) {
        if (!zone.succession) continue;

        const succession = zone.succession;
        const pop = zonePops.get(zone.id);
        succession.current_density = pop ? pop.count : 0;

        // Time advances succession toward climax
        succession.time_since_disturbance += dt;

        // Calculate succession stage (0 = pioneer, 1 = climax)
        const rawStage = succession.time_since_disturbance / succession.climax_time;

        // Density accelerates succession (organisms create conditions for successors)
        const densityFactor = 1 + Math.min(succession.current_density / 20, 0.5);
        succession.stage = clamp(rawStage * densityFactor, 0, 1);
    }
}

/**
 * Trigger a disturbance event in a zone
 * Resets succession to pioneer stage
 */
export function triggerDisturbance(zoneId, severity = 1.0) {
    const zone = environmentalZones.find(z => z.id === zoneId);
    if (!zone || !zone.succession) return;

    const succession = zone.succession;

    // Reset succession based on severity (1.0 = complete reset)
    succession.time_since_disturbance *= (1 - severity);
    succession.stage *= (1 - severity * 0.8);

    // Record disturbance
    succession.disturbance_history.push({
        tick: state.tick,
        severity
    });

    // Trim history
    while (succession.disturbance_history.length > 10) {
        succession.disturbance_history.shift();
    }

    // Disturbance can kill some organisms in the zone (handled elsewhere)
}

/**
 * Get succession-based selection modifier
 * Early succession favors r-strategists; climax favors K-strategists
 */
export function getSuccessionSelectionModifier(agent) {
    const { zone, influence } = getZoneAt(agent.position.x, agent.position.y);
    if (!zone?.succession || influence < 0.1) return 1.0;

    const succession = zone.succession;
    const lifeHistory = agent.genome.metabolism.life_history || {};

    let modifier = 1.0;

    // === EARLY SUCCESSION (Pioneer Phase) ===
    if (succession.stage < succession.pioneer_threshold) {
        // Favor r-strategists: high clutch size, fast maturation, exploration
        const pioneerTraits = {
            clutch_size: (lifeHistory.clutch_size || 2) / 6,  // Normalize to 0-1
            maturation_speed: 1 - (lifeHistory.maturation_age || 100) / 300,
            exploration: agent.genome.social?.learning?.exploration_drive || 0.5,
            dispersal: 1 - (agent.genome.social?.cooperation_willingness || 0.5)
        };

        const pioneerScore = (
            pioneerTraits.clutch_size * 0.3 +
            pioneerTraits.maturation_speed * 0.3 +
            pioneerTraits.exploration * 0.2 +
            pioneerTraits.dispersal * 0.2
        );

        // Early succession bonus for pioneer traits
        modifier += pioneerScore * 0.3 * influence * (1 - succession.stage / succession.pioneer_threshold);
    }

    // === CLIMAX STAGE (K-selected Community) ===
    if (succession.stage > succession.climax_threshold) {
        // Favor K-strategists: high investment, efficiency, competitive ability
        const climaxTraits = {
            offspring_investment: lifeHistory.offspring_investment || 0.4,
            efficiency: agent.genome.metabolism.efficiency || 0.5,
            competitive_ability: agent.genome.social?.competition?.aggression || 0.3,
            cooperation: agent.genome.social?.cooperation_willingness || 0.5
        };

        const climaxScore = (
            climaxTraits.offspring_investment * 0.3 +
            climaxTraits.efficiency * 0.25 +
            climaxTraits.competitive_ability * 0.25 +
            climaxTraits.cooperation * 0.2
        );

        // Climax bonus for K-selected traits
        const climaxProgress = (succession.stage - succession.climax_threshold) / (1 - succession.climax_threshold);
        modifier += climaxScore * 0.3 * influence * climaxProgress;
    }

    // === INTERMEDIATE SUCCESSION ===
    // Both strategies viable, generalists may have slight advantage
    if (succession.stage >= succession.pioneer_threshold && succession.stage <= succession.climax_threshold) {
        // Moderate bonus for balanced phenotypes
        const rValue = (lifeHistory.clutch_size || 2) / 6;
        const kValue = lifeHistory.offspring_investment || 0.4;
        const balance = 1 - Math.abs(rValue - kValue);
        modifier += balance * 0.1 * influence;
    }

    return modifier;
}

/**
 * Check if zone should experience natural disturbance
 * Called periodically to simulate fires, floods, disease outbreaks
 */
export function checkNaturalDisturbances(dt) {
    const disturbanceRate = 0.0001 * dt;  // Low baseline rate

    for (const zone of environmentalZones) {
        if (!zone.succession) continue;

        // Climax communities are more stable but not immune
        const stability = zone.stability;
        const climaxResistance = zone.succession.stage * 0.5;
        const effectiveRate = disturbanceRate * (1 - stability * 0.5) * (1 - climaxResistance);

        if (Math.random() < effectiveRate) {
            // Natural disturbance event
            const severity = 0.3 + Math.random() * 0.5;  // 0.3-0.8 severity
            triggerDisturbance(zone.id, severity);

            // Could trigger catastrophe in state for agents
            state.visualEvents?.push({
                type: 'disturbance',
                position: { x: zone.centerX, y: zone.centerY },
                radius: zone.radius,
                severity,
                age: 0,
                duration: 50
            });
        }
    }
}

/**
 * Get succession statistics for all zones
 */
export function getSuccessionStats() {
    const stats = [];

    for (const zone of environmentalZones) {
        if (!zone.succession) continue;

        const succession = zone.succession;
        let stageLabel;

        if (succession.stage < succession.pioneer_threshold) {
            stageLabel = 'pioneer';
        } else if (succession.stage > succession.climax_threshold) {
            stageLabel = 'climax';
        } else {
            stageLabel = 'mid-succession';
        }

        stats.push({
            zoneId: zone.id,
            zoneName: zone.name,
            stage: succession.stage,
            stageLabel,
            timeSinceDisturbance: succession.time_since_disturbance,
            density: succession.current_density,
            recentDisturbances: succession.disturbance_history.length
        });
    }

    return stats;
}

/**
 * Get colonization-competition trade-off modifier
 * Good colonizers are poor competitors and vice versa
 */
export function getColonizationCompetitionTradeoff(agent, zone) {
    if (!zone?.succession) return { colonization: 0.5, competition: 0.5 };

    const lifeHistory = agent.genome.metabolism.life_history || {};

    // r-selected traits = good colonizer
    const colonizationAbility = (
        (lifeHistory.clutch_size || 2) / 6 * 0.4 +
        (1 - (lifeHistory.maturation_age || 100) / 300) * 0.3 +
        (agent.genome.social?.learning?.exploration_drive || 0.5) * 0.3
    );

    // K-selected traits = good competitor
    const competitiveAbility = (
        (lifeHistory.offspring_investment || 0.4) * 0.3 +
        (agent.genome.metabolism.efficiency || 0.5) * 0.3 +
        (agent.genome.social?.competition?.aggression || 0.3) * 0.2 +
        (agent.genome.nodes?.length || 5) / CONFIG.MAX_NODES * 0.2
    );

    // Trade-off: sum should be roughly constant
    // Agents can't be both excellent colonizers AND competitors
    const total = colonizationAbility + competitiveAbility;
    const normalizedColonization = colonizationAbility / total;
    const normalizedCompetition = competitiveAbility / total;

    return {
        colonization: normalizedColonization,
        competition: normalizedCompetition,
        isColonizer: normalizedColonization > 0.55,
        isCompetitor: normalizedCompetition > 0.55,
        isGeneralist: Math.abs(normalizedColonization - 0.5) < 0.1
    };
}

/**
 * Get all environmental zones
 */
export function getEnvironmentalZones() {
    return environmentalZones;
}

// ============================================================
// ALLOPATRIC SPECIATION: GEOGRAPHICAL BARRIERS
// ============================================================
// Physical barriers that prevent gene flow between populations
// Enables divergent evolution and eventual speciation
// Barriers can form, persist, and break down over geological time

let geographicBarriers = [];

/**
 * Initialize geographical barriers for allopatric speciation
 * Creates impassable zones that divide the world into isolated regions
 */
export function initGeographicBarriers() {
    geographicBarriers = [];

    // Create 1-3 major barriers
    const barrierCount = 1 + Math.floor(Math.random() * 3);

    for (let i = 0; i < barrierCount; i++) {
        const barrier = createBarrier(i);
        if (barrier) {
            geographicBarriers.push(barrier);
        }
    }

    // Store in state for persistence
    if (state.environment) {
        state.environment.barriers = geographicBarriers;
    }

    return geographicBarriers;
}

/**
 * Create a single geographical barrier
 * Barriers can be rivers, mountain ranges, deserts, or ocean channels
 */
function createBarrier(id) {
    const barrierTypes = ['mountain', 'river', 'desert', 'ocean'];
    const type = barrierTypes[id % barrierTypes.length];

    // Determine orientation and position
    const isVertical = Math.random() > 0.5;
    const position = 0.25 + Math.random() * 0.5;  // 25-75% across the world

    let startX, startY, endX, endY, width;

    if (isVertical) {
        startX = CONFIG.WORLD_WIDTH * position;
        startY = CONFIG.WORLD_HEIGHT * 0.05;
        endX = startX + (Math.random() - 0.5) * CONFIG.WORLD_WIDTH * 0.2;  // Slight curve
        endY = CONFIG.WORLD_HEIGHT * 0.95;
        width = 30 + Math.random() * 40;  // 30-70 pixels wide
    } else {
        startX = CONFIG.WORLD_WIDTH * 0.05;
        startY = CONFIG.WORLD_HEIGHT * position;
        endX = CONFIG.WORLD_WIDTH * 0.95;
        endY = startY + (Math.random() - 0.5) * CONFIG.WORLD_HEIGHT * 0.2;
        width = 30 + Math.random() * 40;
    }

    return {
        id,
        type,
        isVertical,

        // Barrier geometry (line segment with width)
        startX,
        startY,
        endX,
        endY,
        width,

        // Barrier properties
        permeability: getBarrierPermeability(type),  // 0 = impassable, 1 = no effect
        permanence: 0.95 + Math.random() * 0.05,     // How stable the barrier is

        // Age and dynamics
        formation_tick: state.tick || 0,
        age: 0,
        is_active: true,

        // Gaps in the barrier (potential corridors)
        gaps: [],

        // Population isolation tracking
        populations: {
            side_A: { count: 0, avg_marker: 0 },
            side_B: { count: 0, avg_marker: 0 }
        },

        // Genetic divergence tracking
        fst_history: [],  // Track Fst (genetic differentiation) over time
        last_gene_flow: 0
    };
}

/**
 * Get baseline permeability for barrier type
 */
function getBarrierPermeability(type) {
    switch (type) {
        case 'ocean': return 0.0;      // Completely impassable
        case 'mountain': return 0.05;  // Nearly impassable
        case 'desert': return 0.15;    // Difficult but possible
        case 'river': return 0.3;      // Significant obstacle
        default: return 0.5;
    }
}

/**
 * Check if movement from point A to B crosses a barrier
 * Returns barrier info if blocked, null if movement is allowed
 */
export function checkBarrierCrossing(x1, y1, x2, y2) {
    for (const barrier of geographicBarriers) {
        if (!barrier.is_active) continue;

        const crossing = lineSegmentIntersectsBarrier(x1, y1, x2, y2, barrier);
        if (crossing.intersects) {
            // Check if movement is allowed (based on permeability)
            if (Math.random() > barrier.permeability) {
                return {
                    blocked: true,
                    barrier,
                    intersection: crossing.point
                };
            }
        }
    }

    return { blocked: false };
}

/**
 * Check if a line segment intersects a barrier (treated as thick line)
 */
function lineSegmentIntersectsBarrier(x1, y1, x2, y2, barrier) {
    // Barrier as a line segment
    const bx1 = barrier.startX;
    const by1 = barrier.startY;
    const bx2 = barrier.endX;
    const by2 = barrier.endY;

    // Vector math for line-line intersection
    const dx1 = x2 - x1;
    const dy1 = y2 - y1;
    const dx2 = bx2 - bx1;
    const dy2 = by2 - by1;

    const cross = dx1 * dy2 - dy1 * dx2;

    // Parallel lines
    if (Math.abs(cross) < 0.0001) {
        // Check if close enough to barrier (within width)
        const distToBarrier = pointToLineDistance(x1, y1, bx1, by1, bx2, by2);
        return {
            intersects: distToBarrier < barrier.width / 2,
            point: null
        };
    }

    const dx3 = bx1 - x1;
    const dy3 = by1 - y1;

    const t = (dx3 * dy2 - dy3 * dx2) / cross;
    const u = (dx3 * dy1 - dy3 * dx1) / cross;

    // Check if intersection is within both segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        // Check if within barrier width
        const intersectX = x1 + t * dx1;
        const intersectY = y1 + t * dy1;

        return {
            intersects: true,
            point: { x: intersectX, y: intersectY }
        };
    }

    return { intersects: false, point: null };
}

/**
 * Calculate distance from point to line segment
 */
function pointToLineDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
        // Line segment is a point
        return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }

    // Project point onto line
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

/**
 * Determine which side of a barrier an agent is on
 * Returns 'A', 'B', or null if not near barrier
 */
export function getBarrierSide(x, y, barrier) {
    // Use cross product to determine side
    const dx = barrier.endX - barrier.startX;
    const dy = barrier.endY - barrier.startY;
    const px = x - barrier.startX;
    const py = y - barrier.startY;

    const cross = dx * py - dy * px;

    return cross > 0 ? 'A' : 'B';
}

/**
 * Update barrier dynamics over time
 * Barriers can weaken, form gaps, or break down
 */
export function updateBarriers(dt) {
    for (const barrier of geographicBarriers) {
        if (!barrier.is_active) continue;

        barrier.age += dt;

        // Very rare barrier breakdown (geological time scale)
        if (Math.random() < 0.00001 * dt) {
            // Barrier begins to weaken
            barrier.permeability = Math.min(1, barrier.permeability + 0.1);

            // If permeability reaches 1, barrier is effectively gone
            if (barrier.permeability >= 1) {
                barrier.is_active = false;
            }
        }

        // Rare gap formation (corridor opens)
        if (Math.random() < 0.00005 * dt && barrier.gaps.length < 3) {
            // Random position along barrier
            const gapPosition = Math.random();
            barrier.gaps.push({
                position: gapPosition,
                width: 20 + Math.random() * 30,
                formation_tick: state.tick
            });

            // Gaps increase effective permeability
            barrier.permeability = Math.min(1, barrier.permeability + 0.1);
        }
    }
}

/**
 * Track population isolation across barriers
 * Calculates genetic differentiation (Fst) between isolated populations
 */
export function trackPopulationIsolation(agents) {
    for (const barrier of geographicBarriers) {
        if (!barrier.is_active) continue;

        // Reset counts
        barrier.populations.side_A = { count: 0, markers: [] };
        barrier.populations.side_B = { count: 0, markers: [] };

        // Count agents on each side
        for (const agent of agents) {
            if (!agent.alive) continue;

            const side = getBarrierSide(agent.position.x, agent.position.y, barrier);
            const pop = barrier.populations[`side_${side}`];
            pop.count++;
            pop.markers.push(agent.genome.species_marker);
        }

        // Calculate Fst (genetic differentiation)
        const fst = calculateFst(
            barrier.populations.side_A.markers,
            barrier.populations.side_B.markers
        );

        // Track Fst history
        if (barrier.fst_history.length > 100) {
            barrier.fst_history.shift();
        }
        barrier.fst_history.push({
            tick: state.tick,
            fst,
            pop_A: barrier.populations.side_A.count,
            pop_B: barrier.populations.side_B.count
        });
    }
}

/**
 * Calculate Fst (fixation index) between two populations
 * Fst = (Ht - Hs) / Ht where Ht is total heterozygosity, Hs is within-subpop
 * Higher Fst = more genetic differentiation = more speciation progress
 */
function calculateFst(markersA, markersB) {
    if (markersA.length < 5 || markersB.length < 5) {
        return 0;  // Need minimum sample size
    }

    // Calculate variance within each population
    const meanA = markersA.reduce((a, b) => a + b, 0) / markersA.length;
    const meanB = markersB.reduce((a, b) => a + b, 0) / markersB.length;

    const varA = markersA.reduce((sum, m) => sum + (m - meanA) ** 2, 0) / markersA.length;
    const varB = markersB.reduce((sum, m) => sum + (m - meanB) ** 2, 0) / markersB.length;

    // Within-population heterozygosity
    const Hs = (varA + varB) / 2;

    // Total heterozygosity (combined population)
    const allMarkers = [...markersA, ...markersB];
    const meanTotal = allMarkers.reduce((a, b) => a + b, 0) / allMarkers.length;
    const Ht = allMarkers.reduce((sum, m) => sum + (m - meanTotal) ** 2, 0) / allMarkers.length;

    if (Ht === 0) return 0;

    // Fst calculation
    const fst = Math.max(0, (Ht - Hs) / Ht);

    return Math.min(1, fst);  // Clamp to 0-1
}

/**
 * Check if speciation has occurred across a barrier
 * Speciation criteria: Fst > 0.25 for extended period
 */
export function checkAllopatricSpeciation(barrier) {
    if (!barrier.is_active || barrier.fst_history.length < 50) {
        return { speciated: false };
    }

    // Average recent Fst
    const recentFst = barrier.fst_history.slice(-20);
    const avgFst = recentFst.reduce((sum, entry) => sum + entry.fst, 0) / recentFst.length;

    // Check for stable high differentiation
    const allHighFst = recentFst.every(entry => entry.fst > 0.15);

    if (avgFst > 0.25 && allHighFst) {
        return {
            speciated: true,
            fst: avgFst,
            pop_A_size: barrier.populations.side_A.count,
            pop_B_size: barrier.populations.side_B.count
        };
    }

    return {
        speciated: false,
        fst: avgFst,
        diverging: avgFst > 0.1
    };
}

/**
 * Get barrier statistics for display/analysis
 */
export function getBarrierStats() {
    return geographicBarriers.map(barrier => {
        const speciationCheck = checkAllopatricSpeciation(barrier);
        const recentFst = barrier.fst_history.length > 0
            ? barrier.fst_history[barrier.fst_history.length - 1].fst
            : 0;

        return {
            id: barrier.id,
            type: barrier.type,
            isActive: barrier.is_active,
            permeability: barrier.permeability,
            age: barrier.age,
            gapCount: barrier.gaps.length,
            populationA: barrier.populations.side_A.count,
            populationB: barrier.populations.side_B.count,
            currentFst: recentFst,
            speciationStatus: speciationCheck.speciated ? 'speciated' :
                             speciationCheck.diverging ? 'diverging' : 'mixing'
        };
    });
}

/**
 * Get all geographic barriers
 */
export function getGeographicBarriers() {
    return geographicBarriers;
}

/**
 * Main environment update
 */
export function updateEnvironment(dt) {
    const env = state.environment;
    if (!env) return;

    env.time++;

    // Update seasons and weather first (they affect other systems)
    if (CONFIG.ENABLE_SEASONS) {
        updateSeasons(dt);
    }
    if (CONFIG.ENABLE_WEATHER) {
        updateWeather(dt);
    }

    // Update temperature cycle (modified by season/weather)
    updateTemperature(env, dt);

    // Update viscosity
    updateViscosity(env, dt);

    // Regenerate resources
    regenerateResources(env, dt);

    // Decay organic matter
    decayOrganicMatter(env, dt);

    // Update toxic zones
    updateToxicZones(env, dt);

    // Update resource spots
    updateResourceSpots(env, dt);

    // Update current
    updateCurrent(env, dt);

    // Update geographical barriers (allopatric speciation)
    updateBarriers(dt);

    // Periodically track population isolation across barriers
    if (env.time % 100 === 0 && state.agents) {
        trackPopulationIsolation(state.agents.filter(a => a.alive));
    }
}

/**
 * Update seasons
 */
function updateSeasons(dt) {
    const seasonOrder = ['spring', 'summer', 'fall', 'winter'];
    const currentIndex = seasonOrder.indexOf(state.currentSeason);

    // Progress through season
    state.seasonProgress += 1 / CONFIG.SEASON_LENGTH;

    // Check for season change
    if (state.seasonProgress >= 1) {
        state.seasonProgress = 0;
        const nextIndex = (currentIndex + 1) % 4;
        state.currentSeason = seasonOrder[nextIndex];

        // Track years
        if (nextIndex === 0) {
            state.yearCount++;
        }
    }
}

/**
 * Update weather
 */
function updateWeather(dt) {
    // Decrease weather duration
    if (state.weatherDuration > 0) {
        state.weatherDuration--;

        // Apply storm damage if applicable
        const weather = CONFIG.WEATHER_TYPES[state.currentWeather];
        if (weather.damage && Math.random() < weather.damage * 0.01) {
            applyWeatherDamage(weather.damage);
        }
    }

    // Check for weather change
    if (state.weatherDuration <= 0 || Math.random() < CONFIG.WEATHER_CHANGE_CHANCE) {
        changeWeather();
    }
}

/**
 * Change to a new weather type
 */
function changeWeather() {
    const season = CONFIG.SEASONS[state.currentSeason];
    const weatherTypes = Object.keys(CONFIG.WEATHER_TYPES);

    // Weight selection by season (storms more likely in stormy seasons)
    let newWeather;
    if (Math.random() < season.storms) {
        // Storm-like weather
        const stormyWeather = ['storm', 'rain', 'drought'];
        newWeather = stormyWeather[Math.floor(Math.random() * stormyWeather.length)];
    } else {
        // Normal weather distribution
        const weights = {
            clear: 0.4,
            rain: 0.2,
            drought: 0.1,
            storm: 0.05,
            heatwave: state.currentSeason === 'summer' ? 0.15 : 0.05,
            bloom: state.currentSeason === 'spring' ? 0.15 : 0.05
        };

        const rand = Math.random();
        let cumulative = 0;
        for (const [type, weight] of Object.entries(weights)) {
            cumulative += weight;
            if (rand < cumulative) {
                newWeather = type;
                break;
            }
        }
        newWeather = newWeather || 'clear';
    }

    state.currentWeather = newWeather;
    state.weatherDuration = CONFIG.WEATHER_TYPES[newWeather].duration;
}

/**
 * Apply damage from severe weather
 */
function applyWeatherDamage(damageRate) {
    for (const agent of state.agents) {
        if (!agent.alive) continue;
        // Random agents take damage
        if (Math.random() < 0.1) {
            agent.energy -= damageRate * 10;
        }
    }
}

/**
 * Get current environmental modifiers from season + weather
 */
export function getEnvironmentModifiers() {
    let tempMod = 0;
    let resourceMod = 1;

    if (CONFIG.ENABLE_SEASONS) {
        const season = CONFIG.SEASONS[state.currentSeason];
        tempMod += season.temp - 0.5;  // Offset from neutral
        resourceMod *= season.resources;
    }

    if (CONFIG.ENABLE_WEATHER) {
        const weather = CONFIG.WEATHER_TYPES[state.currentWeather];
        tempMod += weather.tempMod;
        resourceMod *= weather.resourceMod;
    }

    return { tempMod, resourceMod };
}

/**
 * Update temperature based on cycle + season + weather
 */
function updateTemperature(env, dt) {
    const period = CONFIG.TEMPERATURE_CYCLE_PERIOD;
    const cyclePos = (env.time % period) / period;

    // Base sinusoidal cycle (day/night)
    const base = CONFIG.TEMPERATURE_CYCLE_BASE;
    const amplitude = CONFIG.TEMPERATURE_CYCLE_AMPLITUDE;
    let cycleTemp = base + amplitude * Math.sin(cyclePos * Math.PI * 2);

    // Apply season/weather modifiers
    const mods = getEnvironmentModifiers();
    cycleTemp += mods.tempMod;

    // Add some noise
    const noise = (Math.random() - 0.5) * 0.02;

    env.temperature = clamp(cycleTemp + noise, 0, 1);
}

/**
 * Update viscosity based on temperature
 */
function updateViscosity(env, dt) {
    // Viscosity inversely related to temperature
    // Cold = thick/viscous, Hot = thin/fluid
    const tempFactor = 1 - env.temperature;
    env.viscosity = lerp(
        CONFIG.VISCOSITY_BASE * 0.5,
        CONFIG.VISCOSITY_BASE * 1.5,
        tempFactor
    );
}

/**
 * Regenerate resources over time
 */
function regenerateResources(env, dt) {
    // Get season/weather modifiers
    const mods = getEnvironmentModifiers();
    const regenRate = CONFIG.RESOURCE_REGEN_BASE * dt * mods.resourceMod;

    for (let y = 0; y < env.rows; y++) {
        for (let x = 0; x < env.cols; x++) {
            const cell = env.resources[y][x];

            // Chemical A regeneration (affected by season/weather)
            if (cell.chemical_A < CONFIG.RESOURCE_MAX) {
                cell.chemical_A = Math.min(
                    CONFIG.RESOURCE_MAX,
                    cell.chemical_A + regenRate * 0.1
                );
            }

            // Chemical B regeneration (affected by season/weather)
            if (cell.chemical_B < CONFIG.RESOURCE_MAX) {
                cell.chemical_B = Math.min(
                    CONFIG.RESOURCE_MAX,
                    cell.chemical_B + regenRate * 0.1
                );
            }

            // Light regeneration (instant, based on position and season)
            const seasonalLightMod = CONFIG.ENABLE_SEASONS ? 
                CONFIG.SEASONS[state.currentSeason].light : 1.0;
            const targetLight = calculateLightLevel(x, y, env.cols, env.rows) * seasonalLightMod;
            cell.light = lerp(
                cell.light,
                Math.min(CONFIG.RESOURCE_MAX, targetLight),
                0.01
            );
        }
    }
}

/**
 * Decay organic matter over time
 */
function decayOrganicMatter(env, dt) {
    const decayRate = CONFIG.ORGANIC_DECAY_RATE * dt;

    for (let y = 0; y < env.rows; y++) {
        for (let x = 0; x < env.cols; x++) {
            const cell = env.resources[y][x];

            // Decay organic matter
            if (cell.organic_matter > 0) {
                cell.organic_matter = Math.max(0, cell.organic_matter - decayRate);

                // Organic matter converts to chemicals as it decays
                const converted = decayRate * 0.5;
                cell.chemical_A = Math.min(CONFIG.RESOURCE_MAX, cell.chemical_A + converted);
                cell.chemical_B = Math.min(CONFIG.RESOURCE_MAX, cell.chemical_B + converted);
            }
        }
    }
}

/**
 * Update toxic zones (fade out)
 */
function updateToxicZones(env, dt) {
    env.toxicZones = env.toxicZones.filter(zone => {
        zone.intensity -= CONFIG.TOXIC_DECAY_RATE * dt;
        return zone.intensity > 0.01;
    });
}

/**
 * Update resource spots (special high-resource areas)
 */
function updateResourceSpots(env, dt) {
    // Spots slowly fade
    env.resourceSpots = env.resourceSpots.filter(spot => {
        spot.intensity -= 0.001 * dt;
        return spot.intensity > 0.01;
    });

    // Random chance to spawn new spot
    if (Math.random() < CONFIG.RESOURCE_SPOT_SPAWN_CHANCE * dt) {
        spawnResourceSpot(env);
    }
}

/**
 * Spawn a new resource spot
 */
function spawnResourceSpot(env) {
    env.resourceSpots.push({
        x: Math.random() * env.width,
        y: Math.random() * env.height,
        radius: 50 + Math.random() * 100,
        intensity: 0.5 + Math.random() * 0.5,
        type: Math.random() < 0.5 ? 'chemical_A' : 'chemical_B'
    });
}

/**
 * Update global current
 */
function updateCurrent(env, dt) {
    // Slowly varying current
    const time = env.time * 0.001;
    env.current.x = Math.sin(time) * 0.1;
    env.current.y = Math.cos(time * 0.7) * 0.1;
}

/**
 * Get resource cell at world position
 */
export function getResourceCell(x, y) {
    const env = state.environment;
    if (!env) return null;

    const cx = Math.floor(x / env.cellSize);
    const cy = Math.floor(y / env.cellSize);

    if (cx < 0 || cx >= env.cols || cy < 0 || cy >= env.rows) {
        return null;
    }

    return env.resources[cy][cx];
}

/**
 * Consume resources at a position
 */
export function consumeResource(x, y, resourceType, amount) {
    const cell = getResourceCell(x, y);
    if (!cell) return 0;

    const available = cell[resourceType] || 0;
    const consumed = Math.min(available, amount);
    cell[resourceType] = available - consumed;

    return consumed;
}

/**
 * Add organic matter at a position (from death, waste, etc.)
 */
export function addOrganicMatter(x, y, amount) {
    const cell = getResourceCell(x, y);
    if (!cell) return;

    cell.organic_matter = Math.min(
        CONFIG.RESOURCE_MAX,
        cell.organic_matter + amount
    );
}

/**
 * Get gradient at a position for a resource type
 */
export function getGradient(position, resourceType) {
    const env = state.environment;
    if (!env) return { x: 0, y: 0, strength: 0 };

    const cx = Math.floor(position.x / env.cellSize);
    const cy = Math.floor(position.y / env.cellSize);

    // Sample surrounding cells
    let gx = 0, gy = 0;
    let centerValue = 0;

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (nx < 0 || nx >= env.cols || ny < 0 || ny >= env.rows) continue;

            const value = env.resources[ny][nx][resourceType] || 0;

            if (dx === 0 && dy === 0) {
                centerValue = value;
            } else {
                gx += dx * value;
                gy += dy * value;
            }
        }
    }

    const strength = Math.sqrt(gx * gx + gy * gy);

    return {
        x: strength > 0 ? gx / strength : 0,
        y: strength > 0 ? gy / strength : 0,
        strength: centerValue
    };
}

/**
 * Check if a position is in a toxic zone
 */
export function getToxicity(x, y) {
    const env = state.environment;
    if (!env) return 0;

    let toxicity = 0;

    for (const zone of env.toxicZones) {
        const dx = x - zone.x;
        const dy = y - zone.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < zone.radius) {
            const factor = 1 - (dist / zone.radius);
            toxicity = Math.max(toxicity, zone.intensity * factor);
        }
    }

    return toxicity;
}

/**
 * Add a toxic zone
 */
export function addToxicZone(x, y, radius, intensity) {
    const env = state.environment;
    if (!env) return;

    env.toxicZones.push({ x, y, radius, intensity });
}

/**
 * Get total resources in a radius
 */
export function getResourcesInRadius(x, y, radius, resourceType) {
    const env = state.environment;
    if (!env) return 0;

    let total = 0;
    const radiusSq = radius * radius;

    // Get cells in radius
    const minCx = Math.max(0, Math.floor((x - radius) / env.cellSize));
    const maxCx = Math.min(env.cols - 1, Math.ceil((x + radius) / env.cellSize));
    const minCy = Math.max(0, Math.floor((y - radius) / env.cellSize));
    const maxCy = Math.min(env.rows - 1, Math.ceil((y + radius) / env.cellSize));

    for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
            const cellX = (cx + 0.5) * env.cellSize;
            const cellY = (cy + 0.5) * env.cellSize;
            const dx = cellX - x;
            const dy = cellY - y;

            if (dx * dx + dy * dy <= radiusSq) {
                total += env.resources[cy][cx][resourceType] || 0;
            }
        }
    }

    return total;
}

/**
 * Apply resource spot effects to the grid
 */
export function applyResourceSpots(env) {
    for (const spot of env.resourceSpots) {
        const minCx = Math.max(0, Math.floor((spot.x - spot.radius) / env.cellSize));
        const maxCx = Math.min(env.cols - 1, Math.ceil((spot.x + spot.radius) / env.cellSize));
        const minCy = Math.max(0, Math.floor((spot.y - spot.radius) / env.cellSize));
        const maxCy = Math.min(env.rows - 1, Math.ceil((spot.y + spot.radius) / env.cellSize));

        for (let cy = minCy; cy <= maxCy; cy++) {
            for (let cx = minCx; cx <= maxCx; cx++) {
                const cellX = (cx + 0.5) * env.cellSize;
                const cellY = (cy + 0.5) * env.cellSize;
                const dx = cellX - spot.x;
                const dy = cellY - spot.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= spot.radius) {
                    const factor = (1 - dist / spot.radius) * spot.intensity * 0.01;
                    const cell = env.resources[cy][cx];
                    cell[spot.type] = Math.min(CONFIG.RESOURCE_MAX, cell[spot.type] + factor);
                }
            }
        }
    }
}

/**
 * Get environment statistics
 */
export function getEnvironmentStats() {
    const env = state.environment;
    if (!env) return null;

    let totalChemA = 0, totalChemB = 0, totalLight = 0, totalOrganic = 0;

    for (let y = 0; y < env.rows; y++) {
        for (let x = 0; x < env.cols; x++) {
            const cell = env.resources[y][x];
            totalChemA += cell.chemical_A;
            totalChemB += cell.chemical_B;
            totalLight += cell.light;
            totalOrganic += cell.organic_matter;
        }
    }

    const cellCount = env.rows * env.cols;

    return {
        temperature: env.temperature,
        viscosity: env.viscosity,
        avgChemicalA: totalChemA / cellCount,
        avgChemicalB: totalChemB / cellCount,
        avgLight: totalLight / cellCount,
        avgOrganicMatter: totalOrganic / cellCount,
        totalResources: totalChemA + totalChemB + totalLight + totalOrganic,
        toxicZoneCount: env.toxicZones.length,
        resourceSpotCount: env.resourceSpots.length
    };
}

/**
 * Serialize environment for saving
 */
export function serializeEnvironment() {
    const env = state.environment;
    if (!env) return null;

    return {
        width: env.width,
        height: env.height,
        cellSize: env.cellSize,
        cols: env.cols,
        rows: env.rows,
        resources: env.resources,
        temperature: env.temperature,
        viscosity: env.viscosity,
        time: env.time,
        generation: env.generation,
        current: env.current,
        toxicZones: env.toxicZones,
        resourceSpots: env.resourceSpots
    };
}

/**
 * Deserialize environment from saved data
 */
export function deserializeEnvironment(data) {
    if (!data) {
        state.environment = createEnvironment();
        return;
    }

    state.environment = {
        width: data.width,
        height: data.height,
        cellSize: data.cellSize,
        cols: data.cols,
        rows: data.rows,
        resources: data.resources,
        temperature: data.temperature,
        viscosity: data.viscosity,
        time: data.time,
        generation: data.generation,
        current: data.current || { x: 0, y: 0 },
        toxicZones: data.toxicZones || [],
        resourceSpots: data.resourceSpots || []
    };
}

// ============================================================================
// NICHE CONSTRUCTION
// ============================================================================
// Organisms modify their environment, creating ecological inheritance
// Examples: beaver dams, earthworm soil modification, bacterial biofilms
// This creates evolutionary feedback loops

/**
 * Apply niche construction effects from an agent
 * Agents modify local environment based on their metabolism and behavior
 */
export function applyNicheConstruction(agent, dt) {
    if (!agent.alive) return;

    const x = agent.position.x;
    const y = agent.position.y;
    const cell = getResourceCell(x, y);
    if (!cell) return;

    const metabolism = agent.genome.metabolism;
    const nicheConstruction = agent.genome.niche_construction || {};

    // 1. WASTE PRODUCT DEPOSITION
    // Different metabolisms produce different waste products
    // These become resources for other species
    const wasteProduct = getWasteProduct(metabolism.primary_food);
    if (wasteProduct && nicheConstruction.waste_production !== false) {
        const wasteAmount = metabolism.efficiency * 0.005 * dt;
        cell[wasteProduct] = Math.min(
            CONFIG.RESOURCE_MAX,
            (cell[wasteProduct] || 0) + wasteAmount
        );
    }

    // 2. DECOMPOSER EFFECTS
    // Decomposers break down organic matter into chemicals
    if (metabolism.primary_food === 'organic_matter' || metabolism.secondary_food === 'organic_matter') {
        const decomposerStrength = nicheConstruction.decomposer_efficiency || 0.5;
        const conversionAmount = cell.organic_matter * decomposerStrength * 0.01 * dt;

        if (conversionAmount > 0.001) {
            cell.organic_matter -= conversionAmount;
            cell.chemical_A = Math.min(CONFIG.RESOURCE_MAX, cell.chemical_A + conversionAmount * 0.5);
            cell.chemical_B = Math.min(CONFIG.RESOURCE_MAX, cell.chemical_B + conversionAmount * 0.5);
        }
    }

    // 3. BIOFILM FORMATION (for social organisms)
    if (agent.genome.social?.cooperation_willingness > 0.5) {
        const biofilmStrength = agent.genome.social.cooperation_willingness * 0.3;

        // Biofilms modify local viscosity (protection)
        if (!cell.biofilm) cell.biofilm = 0;
        cell.biofilm = Math.min(1, cell.biofilm + biofilmStrength * 0.001 * dt);

        // Biofilms slowly decay without maintenance
        cell.biofilm *= (1 - 0.0005 * dt);
    }

    // 4. NUTRIENT MINING (bringing resources from depth)
    // Large organisms can access deeper nutrients
    if (agent.genome.nodes?.length > 8) {
        const miningStrength = (agent.genome.nodes.length - 8) / CONFIG.MAX_NODES;
        const miningAmount = miningStrength * 0.002 * dt;

        // "Mine" resources from the global pool
        cell.chemical_A = Math.min(CONFIG.RESOURCE_MAX, cell.chemical_A + miningAmount);
        cell.chemical_B = Math.min(CONFIG.RESOURCE_MAX, cell.chemical_B + miningAmount);
    }

    // 5. SHADE/LIGHT MODIFICATION
    // Large organisms reduce light for cells beneath them
    if (metabolism.primary_food === 'light' && agent.genome.nodes?.length > 5) {
        const shadeEffect = (agent.genome.nodes.length / CONFIG.MAX_NODES) * 0.3;
        // Reduce light in surrounding cells (creates shaded microhabitat)
        applyLocalLightReduction(x, y, shadeEffect);
    }

    // 6. TERRITORIAL MARKING (pheromone-like)
    if (agent.genome.social?.competition?.aggression > 0.5) {
        if (!cell.territorial_marks) cell.territorial_marks = new Map();
        cell.territorial_marks.set(agent.genome.species_marker, {
            strength: agent.genome.social.competition.aggression,
            age: 0
        });
    }
}

/**
 * Get waste product type based on food source
 */
function getWasteProduct(primaryFood) {
    switch (primaryFood) {
        case 'chemical_A':
            return 'chemical_B';  // Chemical A consumers produce chemical B
        case 'chemical_B':
            return 'chemical_A';  // Chemical B consumers produce chemical A
        case 'light':
            return 'organic_matter';  // Photosynthesizers produce organic matter
        case 'organic_matter':
            return 'chemical_A';  // Decomposers produce chemicals
        default:
            return null;
    }
}

/**
 * Apply local light reduction (shading effect)
 */
function applyLocalLightReduction(x, y, shadeEffect) {
    const env = state.environment;
    if (!env) return;

    const cx = Math.floor(x / env.cellSize);
    const cy = Math.floor(y / env.cellSize);

    // Affect surrounding cells (shade spreads)
    for (let dy = 0; dy <= 2; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;  // Only affects cells "below" (higher y)

            if (nx < 0 || nx >= env.cols || ny < 0 || ny >= env.rows) continue;

            const dist = Math.sqrt(dx * dx + dy * dy);
            const falloff = 1 / (1 + dist);
            env.resources[ny][nx].light *= (1 - shadeEffect * falloff * 0.01);
        }
    }
}

/**
 * Process niche construction effects for all agents
 */
export function processNicheConstruction(agents, dt) {
    for (const agent of agents) {
        if (!agent.alive) continue;
        applyNicheConstruction(agent, dt);
    }

    // Decay territorial marks
    decayTerritorialMarks(dt);

    // Decay biofilms
    decayBiofilms(dt);
}

/**
 * Decay territorial marks over time
 */
function decayTerritorialMarks(dt) {
    const env = state.environment;
    if (!env) return;

    for (let y = 0; y < env.rows; y++) {
        for (let x = 0; x < env.cols; x++) {
            const cell = env.resources[y][x];
            if (!cell.territorial_marks) continue;

            for (const [species, mark] of cell.territorial_marks.entries()) {
                mark.age += dt;
                mark.strength *= (1 - 0.005 * dt);  // Decay

                if (mark.strength < 0.1 || mark.age > 500) {
                    cell.territorial_marks.delete(species);
                }
            }

            if (cell.territorial_marks.size === 0) {
                cell.territorial_marks = null;
            }
        }
    }
}

/**
 * Decay biofilms over time (without organisms maintaining them)
 */
function decayBiofilms(dt) {
    const env = state.environment;
    if (!env) return;

    for (let y = 0; y < env.rows; y++) {
        for (let x = 0; x < env.cols; x++) {
            const cell = env.resources[y][x];
            if (cell.biofilm && cell.biofilm > 0) {
                cell.biofilm *= (1 - 0.001 * dt);
                if (cell.biofilm < 0.01) cell.biofilm = 0;
            }
        }
    }
}

/**
 * Get niche construction bonus for an agent
 * Agents benefit from environments modified by their ancestors
 */
export function getNicheConstructionBonus(agent) {
    const cell = getResourceCell(agent.position.x, agent.position.y);
    if (!cell) return 0;

    let bonus = 0;

    // Biofilm bonus for social organisms
    if (cell.biofilm > 0 && agent.genome.social?.cooperation_willingness > 0.3) {
        bonus += cell.biofilm * 0.1;  // Protection from biofilm
    }

    // Territorial bonus for matching species
    if (cell.territorial_marks?.has(agent.genome.species_marker)) {
        bonus += 0.05;  // Home territory advantage
    }

    // Territorial penalty for non-matching species
    if (cell.territorial_marks) {
        for (const [species, mark] of cell.territorial_marks.entries()) {
            if (species !== agent.genome.species_marker) {
                bonus -= mark.strength * 0.03;  // Penalty for being in rival territory
            }
        }
    }

    return bonus;
}

/**
 * Get niche construction statistics
 */
export function getNicheConstructionStats() {
    const env = state.environment;
    if (!env) return null;

    let totalBiofilm = 0;
    let biofilmCells = 0;
    let territorialCells = 0;
    let speciesWithTerritory = new Set();

    for (let y = 0; y < env.rows; y++) {
        for (let x = 0; x < env.cols; x++) {
            const cell = env.resources[y][x];

            if (cell.biofilm > 0.01) {
                totalBiofilm += cell.biofilm;
                biofilmCells++;
            }

            if (cell.territorial_marks?.size > 0) {
                territorialCells++;
                for (const species of cell.territorial_marks.keys()) {
                    speciesWithTerritory.add(species);
                }
            }
        }
    }

    return {
        biofilmCoverage: biofilmCells / (env.rows * env.cols),
        avgBiofilmStrength: biofilmCells > 0 ? totalBiofilm / biofilmCells : 0,
        territorialCoverage: territorialCells / (env.rows * env.cols),
        speciesWithTerritory: speciesWithTerritory.size
    };
}

/**
 * Process agent feeding from environment
 */
export function processFeeding(agent, dt) {
    if (!agent.alive) return 0;

    const cell = getResourceCell(agent.position.x, agent.position.y);
    if (!cell) return 0;

    const metabolism = agent.genome.metabolism;
    let energyGained = 0;

    // Chemotrophy - consume chemicals
    if (metabolism.primary_food === 'chemical_A' || metabolism.primary_food === 'chemical_B' ||
        metabolism.secondary_food === 'chemical_A' || metabolism.secondary_food === 'chemical_B') {
        const isPrimary = metabolism.primary_food === 'chemical_A' || metabolism.primary_food === 'chemical_B';
        const efficiency = isPrimary ? metabolism.efficiency : metabolism.efficiency * 0.5;

        // Consume both chemicals
        const consumeA = Math.min(cell.chemical_A, efficiency * dt * 0.1);
        const consumeB = Math.min(cell.chemical_B, efficiency * dt * 0.1);

        cell.chemical_A -= consumeA;
        cell.chemical_B -= consumeB;

        energyGained += (consumeA + consumeB) * CONFIG.ENERGY_FROM_CHEMICAL * efficiency;
    }

    // Phototrophy - absorb light
    if (metabolism.primary_food === 'light' || metabolism.secondary_food === 'light') {
        const isPrimary = metabolism.primary_food === 'light';
        const efficiency = isPrimary ? metabolism.efficiency : metabolism.efficiency * 0.5;

        const lightAbsorbed = cell.light * efficiency * dt * 0.1;
        energyGained += lightAbsorbed * CONFIG.ENERGY_FROM_LIGHT * efficiency;
    }

    // Heterotrophy - consume organic matter
    if (metabolism.primary_food === 'organic_matter' || metabolism.secondary_food === 'organic_matter') {
        const isPrimary = metabolism.primary_food === 'organic_matter';
        const efficiency = isPrimary ? metabolism.efficiency : metabolism.efficiency * 0.5;

        const consumed = Math.min(cell.organic_matter, efficiency * dt * 0.2);
        cell.organic_matter -= consumed;

        energyGained += consumed * CONFIG.ENERGY_FROM_ORGANIC * efficiency;
    }

    // Apply efficiency bonus if present
    energyGained *= (1 + (agent.metabolism_efficiency_bonus || 0));

    // Apply temperature stress - extreme temperatures reduce energy efficiency
    const env = state.environment;
    if (env) {
        const optimalTemp = 0.5;
        const tempDiff = Math.abs(env.temperature - optimalTemp);
        const tempStress = 1 - (tempDiff * 0.5); // Up to 50% penalty at extreme temps
        energyGained *= Math.max(0.5, tempStress);
    }

    // Add energy to agent
    const added = Math.min(
        energyGained,
        agent.genome.metabolism.storage_capacity - agent.energy
    );
    agent.energy += added;

    return added;
}

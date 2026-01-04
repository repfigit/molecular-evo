/**
 * Main entry point for the Molecular Evolution Simulator
 * Handles initialization, game loop, and UI event bindings
 */

import { CONFIG } from './config.js';
import { state, resetState, updateStats, recordHistory, ageVisualEvents } from './state.js';
import { SpatialHash } from './utils/spatial.js';

// Core modules
import { generateRandomGenome } from './core/genome.js';
import { createAgent, updateAgentCenter, getAgentRadius } from './core/agent.js';
import { initializePopulation, getPopulationStats } from './core/population.js';
import { updateSpeciesTracking, getSpeciesColor } from './core/species.js';

// Systems
import { initPhysics, updatePhysics, updateSensors } from './systems/physics.js';
import { initEnvironment, updateEnvironment, processFeeding } from './systems/environment.js';
import { processEvolution, calculateFitness } from './systems/evolution.js';
import { processCompetition } from './systems/competition.js';
import { processCooperation } from './systems/cooperation.js';
import { processSymbiosis } from './systems/symbiosis.js';
import { processHGT } from './systems/hgt.js';
import { processViral, initViruses } from './systems/viral.js';
import { processImmunity } from './systems/immunity.js';
import { processEvents, getActiveEvents, triggerEvent, EVENT_TYPES, triggerCatastrophe } from './systems/events.js';
import { initFood, updateFood } from './systems/food.js';

// Rendering
import { createRenderer } from './rendering/renderer.js';
import { getAgentColor } from './rendering/agentRenderer.js';

// UI
import { initGraphs, updateGraphs } from './ui/graphs.js';

// Performance
import { perfMonitor, getVisibleEntities, AdaptiveQuality } from './utils/performance.js';

// History and Save/Load
import { HistoryManager, downloadSaveFile, loadSaveFile, AutoSaveManager } from './utils/history.js';

/**
 * Main simulation class
 */
class Simulation {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.renderer = null;
        this.spatialHash = null;
        this.lastTime = 0;
        this.accumulator = 0;
        this.frameCount = 0;
        this.fpsTime = 0;
        this.graphRenderers = null;
        this.adaptiveQuality = new AdaptiveQuality();
        this.graphUpdateCounter = 0;
        this.historyManager = new HistoryManager();
        this.autoSaveManager = new AutoSaveManager(5); // Auto-save every 5 minutes
        this.turboMode = false;
        this.framesSinceRender = 0;
        this.updateCount = 0;

        // Bind methods
        this.loop = this.loop.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    /**
     * Initialize the simulation
     */
    async init() {
        console.log('Initializing Molecular Evolution Simulator...');

        // Get canvas
        this.canvas = document.getElementById('simulation-canvas');
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }
        this.ctx = this.canvas.getContext('2d');

        // Set up canvas size
        this.handleResize();
        window.addEventListener('resize', this.handleResize);

        // Create renderer
        this.renderer = createRenderer(this.canvas);

        // Initialize spatial hash
        this.spatialHash = new SpatialHash(CONFIG.SPATIAL_CELL_SIZE);

        // Reset state
        resetState();

        // Initialize environment
        initEnvironment();

        // Initialize food system
        initFood(CONFIG.FOOD_MAX_COUNT / 2);

        // Initialize population with proper agents
        this.initPopulation();

        // Initialize viruses
        initViruses(CONFIG.INITIAL_VIRUS_COUNT);

        // Set up UI event listeners
        this.setupUIListeners();

        // Set up input handlers
        this.setupInputHandlers();

        // Initialize graphs
        this.graphRenderers = initGraphs();

        // Mark as running
        state.running = true;
        state.paused = true;

        console.log('Simulation initialized');

        // Update UI
        this.updateUI();

        // Start the loop
        requestAnimationFrame(this.loop);
    }

    /**
     * Initialize population with proper genome-based agents
     */
    initPopulation() {
        // Create agents using proper genome and agent modules
        state.agents = initializePopulation(CONFIG.INITIAL_AGENT_COUNT);

        // Add all agents to spatial hash
        for (const agent of state.agents) {
            this.spatialHash.insert(agent);
        }

        // Update species tracking
        updateSpeciesTracking(state.agents);

        // Update statistics
        updateStats();

        console.log(`Initialized ${state.agents.length} agents`);
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const container = document.getElementById('simulation-container');
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        }
        // Update renderer if it exists
        if (this.renderer) {
            this.renderer.handleResize();
            this.renderer.setLayerVisible('grid', CONFIG.DEBUG_DRAW_SPATIAL_GRID);
        }
    }

    /**
     * Main game loop
     */
    loop(currentTime) {
        if (!state.running) return;

        // Calculate delta time
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Update FPS counter
        this.frameCount++;
        this.fpsTime += deltaTime;
        if (this.fpsTime >= 1000) {
            state.fps = Math.round(this.frameCount * 1000 / this.fpsTime);
            this.frameCount = 0;
            this.fpsTime = 0;
            document.getElementById('fps-count').textContent = state.fps;

            // Show updates per second in turbo mode
            if (this.turboMode) {
                document.getElementById('ups-count').textContent = this.updateCount;
            }
            this.updateCount = 0;

            // Update adaptive quality based on FPS
            this.adaptiveQuality.update(state.fps);
        }

        // Update simulation if not paused
        if (!state.paused) {
            this.accumulator += deltaTime * state.speed;

            // Fixed timestep updates
            const fixedDt = CONFIG.DT * 1000; // Convert to ms

            // In turbo mode, allow more updates per frame
            const maxUpdatesPerFrame = this.turboMode ? 50 : 10;
            let updates = 0;

            while (this.accumulator >= fixedDt && updates < maxUpdatesPerFrame) {
                this.update(CONFIG.DT);
                this.accumulator -= fixedDt;
                this.updateCount++;
                updates++;
            }

            // Prevent accumulator from growing too large
            if (this.accumulator > fixedDt * maxUpdatesPerFrame) {
                this.accumulator = fixedDt * maxUpdatesPerFrame;
            }
        }

        // Render based on mode
        this.framesSinceRender++;
        const renderInterval = this.turboMode ? CONFIG.TURBO_RENDER_INTERVAL : 1;

        if (this.framesSinceRender >= renderInterval) {
            this.render();
            this.framesSinceRender = 0;
        }

        // Continue loop
        requestAnimationFrame(this.loop);
    }

    /**
     * Update simulation state
     */
    update(dt) {
        const startTime = performance.now();

        state.tick++;
        state.deltaTime = dt;

        // Update environment system
        updateEnvironment(dt);

        // Update food system
        updateFood(dt);

        // Update physics using the physics system
        updatePhysics(state.agents, dt);

        // Process feeding for all agents
        for (const agent of state.agents) {
            if (agent.alive) {
                processFeeding(agent, dt);

                // Age agents
                agent.age++;

                // Apply base metabolism cost, increased by temperature stress
                let metabolismCost = CONFIG.BASE_METABOLISM_COST * dt;
                
                // Temperature affects metabolism - extreme temps cost more energy
                if (state.environment) {
                    const optimalTemp = 0.5;
                    const tempDiff = Math.abs(state.environment.temperature - optimalTemp);
                    const tempStressFactor = 1 + (tempDiff * 2); // Up to 3x cost at extreme temps
                    metabolismCost *= tempStressFactor;
                }
                
                agent.energy -= metabolismCost;

                // Update fitness periodically
                if (state.tick % 100 === 0) {
                    calculateFitness(agent);
                }
            }
        }

        // Process evolution (reproduction, death)
        processEvolution(dt);

        // Update spatial hash (needed for social systems)
        this.spatialHash.updateAll(state.agents);

        // Process social systems (if enabled)
        if (CONFIG.ENABLE_COMPETITION) {
            processCompetition(state.agents, this.spatialHash, dt);
        }
        if (CONFIG.ENABLE_COOPERATION) {
            processCooperation(state.agents, this.spatialHash, dt);
        }
        if (CONFIG.ENABLE_SYMBIOSIS) {
            processSymbiosis(state.agents, this.spatialHash, dt);
        }

        // Process HGT (if enabled)
        if (CONFIG.ENABLE_HGT) {
            processHGT(state.agents, this.spatialHash, dt);
        }

        // Process viral system (if enabled)
        if (CONFIG.ENABLE_VIRUSES) {
            processViral(state.agents, this.spatialHash, dt);
        }

        // Process immunity (if enabled)
        if (CONFIG.ENABLE_IMMUNITY) {
            processImmunity(state.agents, dt);
        }

        // Process random events and catastrophes (if enabled)
        if (CONFIG.ENABLE_CATASTROPHES) {
            processEvents(dt);
        }

        // Remove dead agents periodically
        if (state.tick % 50 === 0) {
            state.agents = state.agents.filter(a => a.alive);
        }

        // Update sensors for agents
        for (const agent of state.agents) {
            if (agent.alive && agent.body.sensors.length > 0) {
                const nearbyAgents = this.spatialHash.query(
                    agent.position.x, agent.position.y, 100
                );
                updateSensors(agent, state.environment, nearbyAgents);
            }
        }

        // Age visual events
        ageVisualEvents();

        // Record history periodically
        if (state.tick % 100 === 0) {
            updateStats();
            recordHistory();
            this.historyManager.update();
        }

        // Check for auto-save
        if (this.autoSaveManager.checkAutoSave()) {
            this.autoSaveManager.performAutoSave();
        }

        // Update generation counter
        if (state.tick % CONFIG.TICKS_PER_GENERATION === 0) {
            state.generation++;
            document.getElementById('generation-count').textContent = state.generation;
        }

        state.systemsTime = performance.now() - startTime;
    }

    /**
     * Render the simulation
     */
    render() {
        // Use the renderer module
        this.renderer.render();

        // Update UI if needed
        if (state.tick % 30 === 0) {
            this.updateSelectedPanel();
            this.updateSeasonWeatherDisplay();
        }

        // Update graphs periodically (less often in turbo mode)
        this.graphUpdateCounter++;
        const graphInterval = this.turboMode ? CONFIG.TURBO_GRAPH_INTERVAL : 60;
        if (this.graphUpdateCounter >= graphInterval) {
            this.graphUpdateCounter = 0;
            updateGraphs(this.graphRenderers);
        }
    }

    /**
     * Set up UI event listeners
     */
    setupUIListeners() {
        // Play/Pause button
        const playPauseBtn = document.getElementById('btn-play-pause');
        playPauseBtn?.addEventListener('click', () => {
            state.paused = !state.paused;
            this.updatePlayPauseButton();
        });

        // Step button
        const stepBtn = document.getElementById('btn-step');
        stepBtn?.addEventListener('click', () => {
            if (state.paused) {
                this.update(CONFIG.DT);
                this.render();
            }
        });

        // Speed slider
        const speedSlider = document.getElementById('speed-slider');
        const speedValue = document.getElementById('speed-value');
        speedSlider?.addEventListener('input', (e) => {
            state.speed = parseFloat(e.target.value);
            speedValue.textContent = state.speed + 'x';
        });

        // Turbo mode button
        const turboBtn = document.getElementById('btn-turbo');
        turboBtn?.addEventListener('click', () => {
            this.turboMode = !this.turboMode;
            turboBtn.classList.toggle('active', this.turboMode);
            document.getElementById('ups-display').style.display = this.turboMode ? '' : 'none';

            // Auto-set high speed in turbo mode
            if (this.turboMode && state.speed < 8) {
                state.speed = 16;
                speedSlider.value = 16;
                speedValue.textContent = '16x';
            }
        });

        // Toggle panel button in overlay controls
        const togglePanelBtn = document.getElementById('btn-toggle-panel');
        togglePanelBtn?.addEventListener('click', () => {
            this.togglePanelVisibility();
        });

        // Panel toggle button on panel edge
        this.setupPanelToggle();

        // Collapse/Expand controls functionality
        this.setupControlsCollapse();

        // Overlay select
        const overlaySelect = document.getElementById('overlay-select');
        overlaySelect?.addEventListener('change', (e) => {
            state.overlayMode = e.target.value;
        });

        // Color mode select
        const colorModeSelect = document.getElementById('color-mode-select');
        colorModeSelect?.addEventListener('change', (e) => {
            state.agentColorMode = e.target.value;
        });

        // Reset button
        const resetBtn = document.getElementById('btn-reset');
        resetBtn?.addEventListener('click', () => {
            this.reset();
        });

        // Save button
        const saveBtn = document.getElementById('btn-save');
        saveBtn?.addEventListener('click', () => {
            this.saveState();
        });

        // Load button
        const loadBtn = document.getElementById('btn-load');
        loadBtn?.addEventListener('click', () => {
            document.getElementById('file-input')?.click();
        });

        // File input
        const fileInput = document.getElementById('file-input');
        fileInput?.addEventListener('change', (e) => {
            this.loadState(e.target.files[0]);
        });

        // Injection buttons
        document.getElementById('btn-inject-agents')?.addEventListener('click', () => {
            this.injectAgents(10);
        });

        document.getElementById('btn-inject-virus')?.addEventListener('click', () => {
            triggerEvent(EVENT_TYPES.VIRAL_OUTBREAK, { virusCount: 20 });
            this.showToast('Viral outbreak triggered!', 'warning');
        });

        document.getElementById('btn-inject-resources')?.addEventListener('click', () => {
            triggerEvent(EVENT_TYPES.RESOURCE_BLOOM);
            this.showToast('Resource bloom triggered!');
        });

        document.getElementById('btn-inject-catastrophe')?.addEventListener('click', () => {
            triggerCatastrophe(1);
            this.showToast('Catastrophe triggered!', 'error');
        });

        // Parameter sliders
        this.setupParameterSliders();

        // Environment controls
        this.setupEnvironmentControls();

        // Feature toggles
        this.setupFeatureToggles();

        // Tab navigation
        this.setupTabNavigation();

        // Collapsible panels
        this.setupCollapsiblePanels();

        // Season/weather controls
        this.setupSeasonWeatherControls();
    }

    /**
     * Set up parameter adjustment sliders
     */
    setupParameterSliders() {
        const mutationSlider = document.getElementById('param-mutation-rate');
        const reproSlider = document.getElementById('param-reproduction');
        const catastropheSlider = document.getElementById('param-catastrophe');

        mutationSlider?.addEventListener('input', (e) => {
            CONFIG.BASE_MUTATION_RATE = parseFloat(e.target.value);
            document.getElementById('value-mutation-rate').textContent = e.target.value;
        });

        reproSlider?.addEventListener('input', (e) => {
            CONFIG.REPRODUCTION_ENERGY_THRESHOLD = parseFloat(e.target.value);
            document.getElementById('value-reproduction').textContent = e.target.value;
        });

        catastropheSlider?.addEventListener('input', (e) => {
            CONFIG.CATASTROPHE_CHANCE = parseFloat(e.target.value);
            document.getElementById('value-catastrophe').textContent = e.target.value;
        });

        // Initialize slider values from config
        if (mutationSlider) {
            mutationSlider.value = CONFIG.BASE_MUTATION_RATE;
            document.getElementById('value-mutation-rate').textContent = CONFIG.BASE_MUTATION_RATE;
        }
        if (reproSlider) {
            reproSlider.value = CONFIG.REPRODUCTION_ENERGY_THRESHOLD;
            document.getElementById('value-reproduction').textContent = CONFIG.REPRODUCTION_ENERGY_THRESHOLD;
        }
        if (catastropheSlider) {
            catastropheSlider.value = CONFIG.CATASTROPHE_CHANCE;
            document.getElementById('value-catastrophe').textContent = CONFIG.CATASTROPHE_CHANCE;
        }
    }

    /**
     * Set up environment control sliders
     */
    setupEnvironmentControls() {
        const tempSlider = document.getElementById('env-temperature');
        const viscSlider = document.getElementById('env-viscosity');
        const resSlider = document.getElementById('env-resources');

        tempSlider?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (state.environment) {
                state.environment.temperature = val;
            }
            document.getElementById('value-env-temperature').textContent = val.toFixed(2);
        });

        viscSlider?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (state.environment) {
                state.environment.viscosity = val;
            }
            document.getElementById('value-env-viscosity').textContent = val.toFixed(2);
        });

        resSlider?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            CONFIG.RESOURCE_REGEN_BASE = val;
            document.getElementById('value-env-resources').textContent = val.toFixed(3);
        });

        // Initialize values from current state
        if (state.environment) {
            tempSlider.value = state.environment.temperature;
            document.getElementById('value-env-temperature').textContent = state.environment.temperature.toFixed(2);
            viscSlider.value = state.environment.viscosity;
            document.getElementById('value-env-viscosity').textContent = state.environment.viscosity.toFixed(2);
        }
        resSlider.value = CONFIG.RESOURCE_REGEN_BASE;
        document.getElementById('value-env-resources').textContent = CONFIG.RESOURCE_REGEN_BASE.toFixed(3);
    }

    /**
     * Set up feature toggle checkboxes
     */
    setupFeatureToggles() {
        const toggles = [
            { id: 'toggle-viruses', config: 'ENABLE_VIRUSES' },
            { id: 'toggle-hgt', config: 'ENABLE_HGT' },
            { id: 'toggle-cooperation', config: 'ENABLE_COOPERATION' },
            { id: 'toggle-competition', config: 'ENABLE_COMPETITION' },
            { id: 'toggle-symbiosis', config: 'ENABLE_SYMBIOSIS' },
            { id: 'toggle-immunity', config: 'ENABLE_IMMUNITY' },
            { id: 'toggle-catastrophes', config: 'ENABLE_CATASTROPHES' },
            { id: 'toggle-mutations', config: 'ENABLE_MUTATIONS' }
        ];

        for (const toggle of toggles) {
            const checkbox = document.getElementById(toggle.id);
            if (!checkbox) continue;

            // Set initial state from config
            checkbox.checked = CONFIG[toggle.config];

            // Add change listener
            checkbox.addEventListener('change', (e) => {
                CONFIG[toggle.config] = e.target.checked;
                this.showToast(`${toggle.config.replace('ENABLE_', '')} ${e.target.checked ? 'enabled' : 'disabled'}`);
            });
        }
    }

    /**
     * Set up tab navigation
     */
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;

                // Update button states
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update content visibility
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `tab-${targetTab}`) {
                        content.classList.add('active');
                    }
                });
            });
        });
    }

    /**
     * Set up collapsible panel functionality
     */
    setupCollapsiblePanels() {
        const headers = document.querySelectorAll('.panel.collapsible .panel-header');

        headers.forEach(header => {
            header.addEventListener('click', () => {
                const panel = header.closest('.panel.collapsible');
                const icon = header.querySelector('.collapse-icon');

                panel.classList.toggle('collapsed');

                // Update icon
                if (panel.classList.contains('collapsed')) {
                    icon.textContent = '+';
                } else {
                    icon.textContent = '-';
                }
            });
        });
    }

    /**
     * Set up season and weather controls
     */
    setupSeasonWeatherControls() {
        const seasonToggle = document.getElementById('toggle-seasons');
        const weatherToggle = document.getElementById('toggle-weather');
        const seasonLengthSlider = document.getElementById('param-season-length');

        seasonToggle?.addEventListener('change', (e) => {
            CONFIG.ENABLE_SEASONS = e.target.checked;
            this.showToast(`Seasons ${e.target.checked ? 'enabled' : 'disabled'}`);
        });

        weatherToggle?.addEventListener('change', (e) => {
            CONFIG.ENABLE_WEATHER = e.target.checked;
            this.showToast(`Weather ${e.target.checked ? 'enabled' : 'disabled'}`);
        });

        seasonLengthSlider?.addEventListener('input', (e) => {
            CONFIG.SEASON_LENGTH = parseInt(e.target.value);
            document.getElementById('value-season-length').textContent = e.target.value;
        });

        // Initialize values
        if (seasonToggle) seasonToggle.checked = CONFIG.ENABLE_SEASONS;
        if (weatherToggle) weatherToggle.checked = CONFIG.ENABLE_WEATHER;
        if (seasonLengthSlider) {
            seasonLengthSlider.value = CONFIG.SEASON_LENGTH;
            document.getElementById('value-season-length').textContent = CONFIG.SEASON_LENGTH;
        }
    }

    /**
     * Inject new agents into the simulation
     */
    injectAgents(count) {
        for (let i = 0; i < count; i++) {
            const genome = generateRandomGenome();
            const agent = createAgent(genome, {
                position: {
                    x: Math.random() * CONFIG.WORLD_WIDTH,
                    y: Math.random() * CONFIG.WORLD_HEIGHT
                }
            });
            state.agents.push(agent);
            this.spatialHash.insert(agent);
        }
        this.showToast(`Added ${count} agents!`);
    }

    /**
     * Set up input handlers for canvas interaction
     */
    setupInputHandlers() {
        let isDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;

        // Mouse down
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                isDragging = true;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;

                // Check for entity selection
                const worldPos = this.screenToWorld(e.clientX, e.clientY);
                this.selectEntityAt(worldPos.x, worldPos.y);
            }
        });

        // Mouse move
        this.canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - lastMouseX;
                const dy = e.clientY - lastMouseY;

                state.camera.x -= dx / state.camera.zoom;
                state.camera.y -= dy / state.camera.zoom;

                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            } else {
                // Handle hover tooltip
                this.updateHoverTooltip(e);
            }
        });

        // Mouse up
        this.canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Mouse leave
        this.canvas.addEventListener('mouseleave', () => {
            isDragging = false;
            this.hideTooltip();
        });

        // Mouse wheel for zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = state.camera.zoom * zoomFactor;

            state.camera.zoom = Math.max(CONFIG.CAMERA_ZOOM_MIN,
                Math.min(CONFIG.CAMERA_ZOOM_MAX, newZoom));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    state.paused = !state.paused;
                    this.updatePlayPauseButton();
                    break;
                case 'Equal':
                case 'NumpadAdd':
                    state.speed = Math.min(4, state.speed + 0.25);
                    document.getElementById('speed-slider').value = state.speed;
                    document.getElementById('speed-value').textContent = state.speed + 'x';
                    break;
                case 'Minus':
                case 'NumpadSubtract':
                    state.speed = Math.max(0.25, state.speed - 0.25);
                    document.getElementById('speed-slider').value = state.speed;
                    document.getElementById('speed-value').textContent = state.speed + 'x';
                    break;
                case 'KeyR':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.reset();
                    }
                    break;
                case 'KeyH':
                    // Toggle panel visibility
                    e.preventDefault();
                    this.togglePanelVisibility();
                    break;
                case 'KeyT':
                    // Toggle turbo mode
                    this.turboMode = !this.turboMode;
                    const turboBtn = document.getElementById('btn-turbo');
                    turboBtn?.classList.toggle('active', this.turboMode);
                    document.getElementById('ups-display').style.display = this.turboMode ? '' : 'none';
                    if (this.turboMode && state.speed < 8) {
                        state.speed = 16;
                        document.getElementById('speed-slider').value = 16;
                        document.getElementById('speed-value').textContent = '16x';
                    }
                    this.showToast(`Turbo mode ${this.turboMode ? 'ON' : 'OFF'}`);
                    break;
            }
        });
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        return this.renderer.screenToWorld(screenX, screenY);
    }

    /**
     * Select entity at world position
     */
    selectEntityAt(x, y) {
        const nearby = this.spatialHash.queryWithDistance(x, y, 30);

        if (nearby.length > 0) {
            state.selectedEntity = nearby[0].entity;
            state.selectedType = 'agent';
            this.updateSelectedPanel();
        } else {
            state.selectedEntity = null;
            state.selectedType = null;
            this.updateSelectedPanel();
        }
    }

    /**
     * Update play/pause button state
     */
    updatePlayPauseButton() {
        const playIcon = document.querySelector('.icon-play');
        const pauseIcon = document.querySelector('.icon-pause');

        if (state.paused) {
            playIcon.style.display = '';
            pauseIcon.style.display = 'none';
        } else {
            playIcon.style.display = 'none';
            pauseIcon.style.display = '';
        }
    }

    /**
     * Update UI panels
     */
    updateUI() {
        updateStats();

        // Season and Weather display
        const seasonEl = document.getElementById('value-season');
        const weatherEl = document.getElementById('value-weather');

        if (seasonEl) {
            const season = state.currentSeason.charAt(0).toUpperCase() + state.currentSeason.slice(1);
            seasonEl.textContent = season;
            seasonEl.className = `stat-value season-${state.currentSeason}`;
        }

        if (weatherEl) {
            const weather = state.currentWeather.charAt(0).toUpperCase() + state.currentWeather.slice(1);
            weatherEl.textContent = weather;
            weatherEl.className = `stat-value weather-${state.currentWeather}`;
        }

        // Environment panel
        document.getElementById('value-temperature').textContent =
            state.environment?.temperature.toFixed(2) || '0.00';
        document.getElementById('gauge-temperature').style.width =
            (state.environment?.temperature * 100 || 50) + '%';

        document.getElementById('value-viscosity').textContent =
            state.environment?.viscosity.toFixed(2) || '0.00';
        document.getElementById('gauge-viscosity').style.width =
            (state.environment?.viscosity * 100 || 30) + '%';

        // Population panel
        document.getElementById('value-total-agents').textContent = state.stats.totalAgents;
        document.getElementById('value-species-count').textContent = state.stats.speciesCount;
        document.getElementById('value-cooperating').textContent = state.stats.cooperatingCount;
        document.getElementById('value-symbiotic').textContent = state.stats.symbioticCount;
        document.getElementById('value-avg-plasmids').textContent = state.stats.avgPlasmids.toFixed(1);
        document.getElementById('value-infected').textContent = state.stats.infectedCount;
        document.getElementById('value-food-count').textContent = state.stats.foodCount;
        document.getElementById('value-dna-fragments').textContent = state.stats.dnaFragmentCount;
        document.getElementById('value-viral-load').textContent = state.stats.viralLoad;

        // Generation
        document.getElementById('generation-count').textContent = state.generation;
    }

    /**
     * Update hover tooltip based on mouse position
     */
    updateHoverTooltip(e) {
        const tooltip = document.getElementById('canvas-tooltip');
        if (!tooltip) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldPos = this.screenToWorld(e.clientX, e.clientY);

        // Check for virus under cursor
        const hoverRadius = 15 / state.camera.zoom;
        let foundEntity = null;

        // Check viruses first (smaller, harder to see)
        for (const virus of state.viruses) {
            const dx = virus.position.x - worldPos.x;
            const dy = virus.position.y - worldPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < hoverRadius) {
                foundEntity = { type: 'virus', entity: virus };
                break;
            }
        }

        // Check DNA fragments
        if (!foundEntity) {
            for (const dna of state.dnaFragments) {
                const dx = dna.position.x - worldPos.x;
                const dy = dna.position.y - worldPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < hoverRadius) {
                    foundEntity = { type: 'dna', entity: dna };
                    break;
                }
            }
        }

        // Check agents
        if (!foundEntity) {
            const nearby = this.spatialHash.queryWithDistance(worldPos.x, worldPos.y, 30);
            if (nearby.length > 0) {
                foundEntity = { type: 'agent', entity: nearby[0].entity };
            }
        }

        if (foundEntity) {
            this.showTooltipFor(foundEntity, mouseX, mouseY);
        } else {
            this.hideTooltip();
        }
    }

    /**
     * Show tooltip for a specific entity
     */
    showTooltipFor(found, mouseX, mouseY) {
        const tooltip = document.getElementById('canvas-tooltip');
        if (!tooltip) return;

        let html = '';

        switch (found.type) {
            case 'virus':
                const virus = found.entity;
                const freshness = Math.round((virus.lifespan / CONFIG.VIRUS_MAX_LIFESPAN) * 100);
                const freshnessLabel = freshness > 70 ? 'Fresh' : freshness > 30 ? 'Decaying' : 'Dying';
                const stageLabel = virus.stage === 'free' ? 'Free-floating' :
                                   virus.stage === 'attached' ? 'Attached to host' :
                                   virus.stage === 'lytic' ? 'Lytic (replicating)' :
                                   virus.stage === 'lysogenic' ? 'Lysogenic (dormant)' : virus.stage;
                html = `
                    <div class="tooltip-title">
                        <span class="tooltip-icon" style="background: #ff4444; opacity: ${freshness/100};"></span>
                        Virus (${freshnessLabel})
                    </div>
                    <div class="tooltip-desc">
                        Status: ${stageLabel}<br>
                        Integrity: ${freshness}%<br>
                        <em>Decays over time outside a host.</em>
                    </div>
                `;
                break;

            case 'dna':
                html = `
                    <div class="tooltip-title">
                        <span class="tooltip-icon" style="background: #ffff00;"></span>
                        DNA Fragment
                    </div>
                    <div class="tooltip-desc">
                        Free genetic material released from dead agents. Can be absorbed by living agents through transformation (horizontal gene transfer).
                    </div>
                `;
                break;

            case 'agent':
                const agent = found.entity;
                const status = agent.infection ? 'Infected' : 'Healthy';
                html = `
                    <div class="tooltip-title">
                        <span class="tooltip-icon" style="background: ${this.getAgentColorForTooltip(agent)};"></span>
                        Agent (Species ${String(agent.genome.species_marker).slice(0, 6)})
                    </div>
                    <div class="tooltip-desc">
                        Energy: ${agent.energy.toFixed(0)} | Age: ${agent.age}<br>
                        Status: ${status}
                    </div>
                `;
                break;
        }

        tooltip.innerHTML = html;
        tooltip.classList.add('visible');

        // Position tooltip
        tooltip.style.left = (mouseX + 15) + 'px';
        tooltip.style.top = (mouseY + 15) + 'px';
    }

    /**
     * Get agent color for tooltip
     */
    getAgentColorForTooltip(agent) {
        // Simple species-based color
        const marker = agent.genome.species_marker;
        const hue = (marker * 137.508) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

    /**
     * Hide the tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('canvas-tooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
        }
    }

    /**
     * Update season and weather display only (called frequently)
     */
    updateSeasonWeatherDisplay() {
        const seasonEl = document.getElementById('value-season');
        const weatherEl = document.getElementById('value-weather');

        if (seasonEl) {
            const season = state.currentSeason.charAt(0).toUpperCase() + state.currentSeason.slice(1);
            seasonEl.textContent = season;
            seasonEl.className = `stat-value season-${state.currentSeason}`;
        }

        if (weatherEl) {
            const weather = state.currentWeather.charAt(0).toUpperCase() + state.currentWeather.slice(1);
            weatherEl.textContent = weather;
            weatherEl.className = `stat-value weather-${state.currentWeather}`;
        }
    }

    /**
     * Update selected entity panel
     */
    updateSelectedPanel() {
        const content = document.getElementById('selected-content');
        if (!content) return;

        if (!state.selectedEntity) {
            content.innerHTML = '<div class="empty-state">Click an agent to inspect</div>';
            return;
        }

        const agent = state.selectedEntity;
        content.innerHTML = `
            <div class="selected-header">
                <div class="selected-icon" style="background: ${getAgentColor(agent)}"></div>
                <div>
                    <div class="selected-title">Species ${agent.genome.species_marker}</div>
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
            <div class="subheader">Genome</div>
            <div class="stat-row">
                <span class="stat-label">Nodes</span>
                <span class="stat-value">${agent.genome.nodes.length}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Motors</span>
                <span class="stat-value">${agent.genome.motors.length}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Sensors</span>
                <span class="stat-value">${agent.genome.sensors.length}</span>
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
        `;
    }

    /**
     * Toggle panel visibility
     */
    togglePanelVisibility() {
        const uiPanel = document.getElementById('ui-panel');
        const toggleBtn = document.getElementById('btn-toggle-panel');
        const isHidden = uiPanel.classList.toggle('hidden');
        toggleBtn?.classList.toggle('active', isHidden);
        this.showToast(isHidden ? 'Panel hidden (H to show)' : 'Panel visible');
        return isHidden;
    }

    /**
     * Set up panel toggle button on panel edge
     */
    setupPanelToggle() {
        const panelToggle = document.getElementById('panel-toggle');
        if (!panelToggle) return;

        panelToggle.addEventListener('click', () => {
            this.togglePanelVisibility();
        });
    }

    /**
     * Set up controls collapse/expand functionality
     */
    setupControlsCollapse() {
        const collapseBtn = document.getElementById('btn-collapse-controls');
        const expandBtn = document.getElementById('btn-expand-controls');
        const overlayControls = document.getElementById('overlay-controls');

        collapseBtn?.addEventListener('click', () => {
            overlayControls.classList.add('collapsed');
            expandBtn.style.display = '';
        });

        expandBtn?.addEventListener('click', () => {
            overlayControls.classList.remove('collapsed');
            expandBtn.style.display = 'none';
        });
    }

    /**
     * Reset simulation
     */
    reset() {
        state.paused = true;
        this.updatePlayPauseButton();

        this.spatialHash.clear();
        resetState();

        initEnvironment();
        initFood(CONFIG.FOOD_MAX_COUNT / 2);
        this.initPopulation();
        initViruses(CONFIG.INITIAL_VIRUS_COUNT);

        this.updateUI();
    }

    /**
     * Save state to file
     */
    saveState() {
        try {
            downloadSaveFile();
            this.showToast('Simulation saved!');
        } catch (err) {
            console.error('Failed to save:', err);
            this.showToast('Failed to save simulation', 'error');
        }
    }

    /**
     * Load state from file
     */
    async loadState(file) {
        if (!file) return;

        try {
            state.paused = true;
            this.updatePlayPauseButton();

            // Clear spatial hash
            this.spatialHash.clear();

            // Load the save file
            await loadSaveFile(file, this.spatialHash);

            // Update UI
            this.updateUI();
            this.showToast(`Loaded: Gen ${state.generation}, Tick ${state.tick}`);

            console.log('State loaded successfully');
        } catch (err) {
            console.error('Failed to load state:', err);
            this.showToast('Failed to load save file', 'error');
        }
    }

    /**
     * Show a toast notification
     */
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

// Initialize on DOM ready
const simulation = new Simulation();

document.addEventListener('DOMContentLoaded', () => {
    simulation.init().catch(err => {
        console.error('Failed to initialize simulation:', err);
    });
});

// Export for debugging
window.simulation = simulation;
window.state = state;
window.CONFIG = CONFIG;

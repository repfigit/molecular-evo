/**
 * UI Controls
 *
 * Handles simulation control UI elements
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';

/**
 * Initialize all control bindings
 */
export function initControls(simulation) {
    initPlayPauseControl(simulation);
    initSpeedControl();
    initViewControls();
    initKeyboardShortcuts(simulation);
}

/**
 * Initialize play/pause button
 */
function initPlayPauseControl(simulation) {
    const btn = document.getElementById('btn-play-pause');
    if (!btn) return;

    btn.addEventListener('click', () => {
        state.paused = !state.paused;
        updatePlayPauseButton();
    });

    // Step button
    const stepBtn = document.getElementById('btn-step');
    stepBtn?.addEventListener('click', () => {
        if (state.paused) {
            simulation.update(CONFIG.DT);
            simulation.render();
        }
    });
}

/**
 * Update play/pause button state
 */
export function updatePlayPauseButton() {
    const playIcon = document.querySelector('.icon-play');
    const pauseIcon = document.querySelector('.icon-pause');

    if (playIcon && pauseIcon) {
        if (state.paused) {
            playIcon.style.display = '';
            pauseIcon.style.display = 'none';
        } else {
            playIcon.style.display = 'none';
            pauseIcon.style.display = '';
        }
    }
}

/**
 * Initialize speed control
 */
function initSpeedControl() {
    const slider = document.getElementById('speed-slider');
    const value = document.getElementById('speed-value');

    if (slider) {
        slider.value = state.speed;
        slider.addEventListener('input', (e) => {
            state.speed = parseFloat(e.target.value);
            if (value) value.textContent = state.speed + 'x';
        });
    }
}

/**
 * Initialize view controls
 */
function initViewControls() {
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

    // Energy bars toggle
    const energyBarsToggle = document.getElementById('toggle-energy-bars');
    energyBarsToggle?.addEventListener('change', (e) => {
        state.showEnergyBars = e.target.checked;
    });

    // Grid toggle
    const gridToggle = document.getElementById('toggle-grid');
    gridToggle?.addEventListener('change', (e) => {
        CONFIG.DEBUG_DRAW_SPATIAL_GRID = e.target.checked;
    });
}

/**
 * Initialize keyboard shortcuts
 */
function initKeyboardShortcuts(simulation) {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                state.paused = !state.paused;
                updatePlayPauseButton();
                break;

            case 'Equal':
            case 'NumpadAdd':
                increaseSpeed();
                break;

            case 'Minus':
            case 'NumpadSubtract':
                decreaseSpeed();
                break;

            case 'KeyR':
                if (e.ctrlKey) {
                    e.preventDefault();
                    simulation.reset();
                }
                break;

            case 'KeyG':
                // Toggle grid
                CONFIG.DEBUG_DRAW_SPATIAL_GRID = !CONFIG.DEBUG_DRAW_SPATIAL_GRID;
                break;

            case 'KeyE':
                // Toggle energy bars
                state.showEnergyBars = !state.showEnergyBars;
                break;

            case 'Digit1':
                state.agentColorMode = 'species';
                break;

            case 'Digit2':
                state.agentColorMode = 'energy';
                break;

            case 'Digit3':
                state.agentColorMode = 'age';
                break;

            case 'Digit4':
                state.agentColorMode = 'fitness';
                break;

            case 'Digit5':
                state.agentColorMode = 'infection';
                break;

            case 'Escape':
                state.selectedEntity = null;
                state.selectedType = null;
                break;

            case 'KeyF':
                // Follow selected
                if (state.selectedEntity) {
                    simulation.renderer?.centerOnEntity(state.selectedEntity);
                }
                break;

            case 'Home':
                // Reset camera
                state.camera.x = CONFIG.WORLD_WIDTH / 2;
                state.camera.y = CONFIG.WORLD_HEIGHT / 2;
                state.camera.zoom = 1.0;
                break;

            case 'KeyO':
                // Cycle overlay mode
                cycleOverlayMode();
                break;
        }
    });
}

/**
 * Increase simulation speed
 */
function increaseSpeed() {
    state.speed = Math.min(4, state.speed + 0.25);
    updateSpeedDisplay();
}

/**
 * Decrease simulation speed
 */
function decreaseSpeed() {
    state.speed = Math.max(0.25, state.speed - 0.25);
    updateSpeedDisplay();
}

/**
 * Update speed display
 */
function updateSpeedDisplay() {
    const slider = document.getElementById('speed-slider');
    const value = document.getElementById('speed-value');

    if (slider) slider.value = state.speed;
    if (value) value.textContent = state.speed + 'x';
}

/**
 * Cycle through overlay modes
 */
function cycleOverlayMode() {
    const modes = ['none', 'resources', 'temperature', 'species', 'viral', 'dna'];
    const currentIndex = modes.indexOf(state.overlayMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    state.overlayMode = modes[nextIndex];
    
    // Update the dropdown to match
    const overlaySelect = document.getElementById('overlay-select');
    if (overlaySelect) {
        overlaySelect.value = state.overlayMode;
    }
}

/**
 * Create injection buttons for debugging/testing
 */
export function createInjectionButtons(container, handlers) {
    const buttons = [
        { label: 'Add Agent', handler: handlers.addAgent, icon: '+' },
        { label: 'Add Virus', handler: handlers.addVirus, icon: 'V' },
        { label: 'Catastrophe', handler: handlers.catastrophe, icon: '!' },
        { label: 'Boost Food', handler: handlers.boostFood, icon: 'F' }
    ];

    for (const btn of buttons) {
        const button = document.createElement('button');
        button.className = 'inject-btn';
        button.title = btn.label;
        button.textContent = btn.icon;
        button.addEventListener('click', btn.handler);
        container.appendChild(button);
    }
}

/**
 * Setup canvas interaction handlers
 */
export function setupCanvasInteraction(canvas, simulation) {
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Mouse down
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            // Check for entity selection
            const worldPos = simulation.screenToWorld(e.clientX, e.clientY);
            simulation.selectEntityAt(worldPos.x, worldPos.y);
        }
    });

    // Mouse move
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;

            state.camera.x -= dx / state.camera.zoom;
            state.camera.y -= dy / state.camera.zoom;

            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    });

    // Mouse up
    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Mouse leave
    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    // Mouse wheel for zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = state.camera.zoom * zoomFactor;

        state.camera.zoom = Math.max(
            CONFIG.CAMERA_ZOOM_MIN,
            Math.min(CONFIG.CAMERA_ZOOM_MAX, newZoom)
        );
    });

    // Double click to center
    canvas.addEventListener('dblclick', (e) => {
        const worldPos = simulation.screenToWorld(e.clientX, e.clientY);
        state.camera.x = worldPos.x;
        state.camera.y = worldPos.y;
    });
}

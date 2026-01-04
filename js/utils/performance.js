/**
 * Performance Utilities
 *
 * Tools for optimizing simulation performance:
 * - Object pooling
 * - Render culling
 * - Update throttling
 * - Performance monitoring
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';

/**
 * Object pool for reusable objects
 */
export class ObjectPool {
    constructor(factory, reset, initialSize = 50) {
        this.factory = factory;
        this.reset = reset;
        this.pool = [];
        this.active = new Set();

        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(factory());
        }
    }

    /**
     * Get an object from the pool
     */
    acquire() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.factory();
        }
        this.active.add(obj);
        return obj;
    }

    /**
     * Return an object to the pool
     */
    release(obj) {
        if (this.active.has(obj)) {
            this.active.delete(obj);
            this.reset(obj);
            this.pool.push(obj);
        }
    }

    /**
     * Release all active objects
     */
    releaseAll() {
        for (const obj of this.active) {
            this.reset(obj);
            this.pool.push(obj);
        }
        this.active.clear();
    }

    /**
     * Get pool statistics
     */
    getStats() {
        return {
            pooled: this.pool.length,
            active: this.active.size,
            total: this.pool.length + this.active.size
        };
    }
}

/**
 * Vector pool
 */
export const vectorPool = new ObjectPool(
    () => ({ x: 0, y: 0 }),
    (v) => { v.x = 0; v.y = 0; },
    100
);

/**
 * Performance monitor
 */
export class PerformanceMonitor {
    constructor() {
        this.samples = {};
        this.maxSamples = 60;
    }

    /**
     * Start timing a section
     */
    start(name) {
        if (!this.samples[name]) {
            this.samples[name] = {
                times: [],
                current: 0
            };
        }
        this.samples[name].current = performance.now();
    }

    /**
     * End timing a section
     */
    end(name) {
        if (!this.samples[name]) return;

        const elapsed = performance.now() - this.samples[name].current;
        this.samples[name].times.push(elapsed);

        // Keep only recent samples
        if (this.samples[name].times.length > this.maxSamples) {
            this.samples[name].times.shift();
        }
    }

    /**
     * Get average time for a section
     */
    getAverage(name) {
        if (!this.samples[name] || this.samples[name].times.length === 0) {
            return 0;
        }
        const sum = this.samples[name].times.reduce((a, b) => a + b, 0);
        return sum / this.samples[name].times.length;
    }

    /**
     * Get all stats
     */
    getStats() {
        const stats = {};
        for (const name in this.samples) {
            stats[name] = {
                avg: this.getAverage(name).toFixed(2),
                last: this.samples[name].times[this.samples[name].times.length - 1]?.toFixed(2) || 0
            };
        }
        return stats;
    }

    /**
     * Clear all samples
     */
    clear() {
        this.samples = {};
    }
}

// Global performance monitor
export const perfMonitor = new PerformanceMonitor();

/**
 * Throttle function calls
 */
export function throttle(func, limit) {
    let inThrottle = false;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Debounce function calls
 */
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Check if a position is visible on screen
 */
export function isVisible(x, y, camera, canvas, margin = 50) {
    const screenX = (x - camera.x) * camera.zoom + canvas.width / 2;
    const screenY = (y - camera.y) * camera.zoom + canvas.height / 2;

    return screenX >= -margin &&
           screenX <= canvas.width + margin &&
           screenY >= -margin &&
           screenY <= canvas.height + margin;
}

/**
 * Get visible entities for rendering
 */
export function getVisibleEntities(entities, camera, canvas, margin = 50) {
    return entities.filter(entity => {
        if (!entity.alive && entity.alive !== undefined) return false;
        return isVisible(entity.position.x, entity.position.y, camera, canvas, margin);
    });
}

/**
 * Batch operations for better performance
 */
export class BatchProcessor {
    constructor(batchSize = 50) {
        this.batchSize = batchSize;
        this.queue = [];
    }

    /**
     * Add item to queue
     */
    add(item) {
        this.queue.push(item);
    }

    /**
     * Process items in batches
     */
    process(processor) {
        const results = [];
        for (let i = 0; i < this.queue.length; i += this.batchSize) {
            const batch = this.queue.slice(i, i + this.batchSize);
            results.push(...batch.map(processor));
        }
        this.queue = [];
        return results;
    }

    /**
     * Process with async/requestAnimationFrame breaks
     */
    async processAsync(processor) {
        const results = [];
        for (let i = 0; i < this.queue.length; i += this.batchSize) {
            const batch = this.queue.slice(i, i + this.batchSize);
            results.push(...batch.map(processor));

            // Yield to browser
            if (i + this.batchSize < this.queue.length) {
                await new Promise(resolve => requestAnimationFrame(resolve));
            }
        }
        this.queue = [];
        return results;
    }
}

/**
 * Frame rate limiter
 */
export class FrameRateLimiter {
    constructor(targetFps = 60) {
        this.targetFps = targetFps;
        this.frameInterval = 1000 / targetFps;
        this.lastFrame = 0;
    }

    /**
     * Check if enough time has passed for next frame
     */
    shouldRender(currentTime) {
        const elapsed = currentTime - this.lastFrame;
        if (elapsed >= this.frameInterval) {
            this.lastFrame = currentTime - (elapsed % this.frameInterval);
            return true;
        }
        return false;
    }

    /**
     * Set target FPS
     */
    setTargetFps(fps) {
        this.targetFps = fps;
        this.frameInterval = 1000 / fps;
    }
}

/**
 * Memory-efficient array operations
 */
export const ArrayUtils = {
    /**
     * Remove item from array in place (fast, doesn't preserve order)
     */
    removeUnordered(array, index) {
        if (index < 0 || index >= array.length) return;
        array[index] = array[array.length - 1];
        array.pop();
    },

    /**
     * Remove items matching predicate
     */
    removeWhere(array, predicate) {
        let writeIndex = 0;
        for (let i = 0; i < array.length; i++) {
            if (!predicate(array[i])) {
                array[writeIndex++] = array[i];
            }
        }
        array.length = writeIndex;
    },

    /**
     * Shuffle array in place
     */
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
};

/**
 * Adaptive quality settings
 */
export class AdaptiveQuality {
    constructor() {
        this.currentQuality = 1.0;
        this.targetFps = 60;
        this.fpsHistory = [];
        this.maxHistory = 30;
    }

    /**
     * Update with current FPS
     */
    update(currentFps) {
        this.fpsHistory.push(currentFps);
        if (this.fpsHistory.length > this.maxHistory) {
            this.fpsHistory.shift();
        }

        const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

        // Adjust quality based on FPS
        if (avgFps < this.targetFps * 0.8) {
            this.currentQuality = Math.max(0.25, this.currentQuality - 0.05);
        } else if (avgFps > this.targetFps * 0.95 && this.currentQuality < 1) {
            this.currentQuality = Math.min(1, this.currentQuality + 0.02);
        }

        return this.currentQuality;
    }

    /**
     * Get current quality level
     */
    getQuality() {
        return this.currentQuality;
    }

    /**
     * Should skip update for performance?
     */
    shouldSkipUpdate(entityCount) {
        if (this.currentQuality >= 0.9) return false;

        // Skip some updates based on quality
        const skipChance = 1 - this.currentQuality;
        return Math.random() < skipChance * 0.5;
    }
}

/**
 * Get memory usage estimate
 */
export function getMemoryEstimate() {
    const agentSize = 500; // bytes per agent estimate
    const virusSize = 200;

    return {
        agents: state.agents.length * agentSize,
        viruses: state.viruses.length * virusSize,
        dnaFragments: state.dnaFragments.length * 100,
        total: (state.agents.length * agentSize +
                state.viruses.length * virusSize +
                state.dnaFragments.length * 100)
    };
}

/**
 * Log performance warning if needed
 */
export function checkPerformance() {
    const warnings = [];

    if (state.agents.length > CONFIG.TARGET_POPULATION * 2) {
        warnings.push(`High agent count: ${state.agents.length}`);
    }

    if (state.viruses.length > CONFIG.MAX_VIRUSES * 1.5) {
        warnings.push(`High virus count: ${state.viruses.length}`);
    }

    if (state.fps < 30) {
        warnings.push(`Low FPS: ${state.fps}`);
    }

    return warnings;
}

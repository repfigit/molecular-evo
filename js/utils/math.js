/**
 * Math utilities for the Molecular Evolution Simulator
 * Vector operations, random functions, and common math helpers
 */

// === VECTOR OPERATIONS ===

/**
 * Create a new vector
 */
export function vec(x = 0, y = 0) {
    return { x, y };
}

/**
 * Add two vectors
 */
export function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * Subtract vector b from vector a
 */
export function subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * Multiply vector by scalar
 */
export function scale(v, s) {
    return { x: v.x * s, y: v.y * s };
}

/**
 * Divide vector by scalar
 */
export function divide(v, s) {
    if (s === 0) return { x: 0, y: 0 };
    return { x: v.x / s, y: v.y / s };
}

/**
 * Get vector length (magnitude)
 */
export function length(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

/**
 * Get squared length (faster, avoids sqrt)
 */
export function lengthSquared(v) {
    return v.x * v.x + v.y * v.y;
}

/**
 * Normalize vector to unit length
 */
export function normalize(v) {
    const len = length(v);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
}

/**
 * Dot product of two vectors
 */
export function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}

/**
 * Cross product (2D returns scalar)
 */
export function cross(a, b) {
    return a.x * b.y - a.y * b.x;
}

/**
 * Distance between two points
 */
export function distance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Squared distance (faster)
 */
export function distanceSquared(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return dx * dx + dy * dy;
}

/**
 * Linear interpolation between two vectors
 */
export function lerpVec(a, b, t) {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
    };
}

/**
 * Rotate vector by angle (radians)
 */
export function rotate(v, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: v.x * cos - v.y * sin,
        y: v.x * sin + v.y * cos
    };
}

/**
 * Get perpendicular vector (90 degrees counterclockwise)
 */
export function perpendicular(v) {
    return { x: -v.y, y: v.x };
}

/**
 * Reflect vector off a surface with given normal
 */
export function reflect(v, normal) {
    const d = 2 * dot(v, normal);
    return {
        x: v.x - d * normal.x,
        y: v.y - d * normal.y
    };
}

/**
 * Get angle of vector in radians
 */
export function angle(v) {
    return Math.atan2(v.y, v.x);
}

/**
 * Create vector from angle and magnitude
 */
export function fromAngle(angle, magnitude = 1) {
    return {
        x: Math.cos(angle) * magnitude,
        y: Math.sin(angle) * magnitude
    };
}

/**
 * Copy a vector
 */
export function copy(v) {
    return { x: v.x, y: v.y };
}

/**
 * Check if vectors are equal (within epsilon)
 */
export function equals(a, b, epsilon = 0.0001) {
    return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
}

// === SCALAR MATH ===

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Inverse lerp - get t value for x between a and b
 */
export function inverseLerp(a, b, x) {
    if (a === b) return 0;
    return (x - a) / (b - a);
}

/**
 * Map value from one range to another
 */
export function map(value, inMin, inMax, outMin, outMax) {
    return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

/**
 * Smooth step interpolation
 */
export function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

/**
 * Wrap value around range [min, max)
 */
export function wrap(value, min, max) {
    const range = max - min;
    if (range === 0) return min;
    return ((((value - min) % range) + range) % range) + min;
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians) {
    return radians * (180 / Math.PI);
}

// === RANDOM FUNCTIONS ===

/**
 * Random float in range [min, max)
 */
export function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Random integer in range [min, max]
 */
export function randomInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

/**
 * Random boolean with given probability of true
 */
export function randomBool(probability = 0.5) {
    return Math.random() < probability;
}

/**
 * Random element from array
 */
export function randomChoice(array) {
    if (array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Random sample of n elements from array (no duplicates)
 */
export function randomSample(array, n) {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, array.length));
}

/**
 * Weighted random selection
 * Items should have a 'weight' property or provide a weight function
 */
export function weightedRandomChoice(items, getWeight = (item) => item.weight || 1) {
    if (items.length === 0) return undefined;

    const totalWeight = items.reduce((sum, item) => sum + getWeight(item), 0);
    if (totalWeight === 0) return randomChoice(items);

    let random = Math.random() * totalWeight;

    for (const item of items) {
        random -= getWeight(item);
        if (random <= 0) return item;
    }

    return items[items.length - 1];
}

/**
 * Shuffle array in place (Fisher-Yates)
 */
export function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Random unit vector (direction)
 */
export function randomDirection() {
    const angle = Math.random() * Math.PI * 2;
    return { x: Math.cos(angle), y: Math.sin(angle) };
}

/**
 * Random point within a circle
 */
export function randomInCircle(radius = 1) {
    const r = Math.sqrt(Math.random()) * radius;
    const angle = Math.random() * Math.PI * 2;
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}

/**
 * Random point within a rectangle
 */
export function randomInRect(width, height, offsetX = 0, offsetY = 0) {
    return {
        x: offsetX + Math.random() * width,
        y: offsetY + Math.random() * height
    };
}

/**
 * Gaussian random (Box-Muller transform)
 * Returns value with mean 0 and stddev 1
 */
export function randomGaussian() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Add random jitter to a position
 */
export function jitter(position, amount) {
    return {
        x: position.x + (Math.random() - 0.5) * 2 * amount,
        y: position.y + (Math.random() - 0.5) * 2 * amount
    };
}

// === UUID GENERATION ===

/**
 * Generate a UUID v4
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Generate a short ID (8 characters)
 */
export function generateShortId() {
    return Math.random().toString(36).substring(2, 10);
}

// === ARRAY UTILITIES ===

/**
 * Find minimum value in array by key function
 */
export function minBy(array, key) {
    if (array.length === 0) return undefined;
    return array.reduce((min, item) => key(item) < key(min) ? item : min);
}

/**
 * Find maximum value in array by key function
 */
export function maxBy(array, key) {
    if (array.length === 0) return undefined;
    return array.reduce((max, item) => key(item) > key(max) ? item : max);
}

/**
 * Sum array values
 */
export function sum(array) {
    return array.reduce((a, b) => a + b, 0);
}

/**
 * Average of array values
 */
export function average(array) {
    if (array.length === 0) return 0;
    return sum(array) / array.length;
}

/**
 * Get intersection of two arrays
 */
export function intersection(a, b) {
    const setB = new Set(b);
    return a.filter(x => setB.has(x));
}

/**
 * Get union of two arrays
 */
export function union(a, b) {
    return [...new Set([...a, ...b])];
}

/**
 * Remove duplicates from array
 */
export function unique(array) {
    return [...new Set(array)];
}

// === COLOR UTILITIES ===

/**
 * HSL to RGB conversion
 */
export function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

/**
 * RGB to hex string
 */
export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Generate a color from a number (for species coloring)
 */
export function numberToColor(n, saturation = 0.7, lightness = 0.5) {
    const hue = (n * 0.618033988749895) % 1; // Golden ratio for good distribution
    const rgb = hslToRgb(hue, saturation, lightness);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Interpolate between two colors
 */
export function lerpColor(color1, color2, t) {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(lerp(r1, r2, t));
    const g = Math.round(lerp(g1, g2, t));
    const b = Math.round(lerp(b1, b2, t));

    return rgbToHex(r, g, b);
}

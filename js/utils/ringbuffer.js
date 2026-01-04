/**
 * RingBuffer - Fixed-size circular buffer for efficient bounded arrays
 *
 * Provides O(1) push operations without memory reallocation.
 * When the buffer is full, oldest elements are automatically overwritten.
 *
 * Use cases:
 * - Tracking recent energy intake in agent plasticity
 * - Event history with bounded memory
 * - Rolling statistics windows
 */

export class RingBuffer {
    /**
     * Create a new ring buffer
     * @param {number} capacity - Maximum number of elements
     */
    constructor(capacity) {
        this.capacity = capacity;
        this.buffer = new Array(capacity);
        this.head = 0;      // Next write position
        this.size = 0;      // Current number of elements
    }

    /**
     * Add an element to the buffer - O(1)
     * Overwrites oldest element if at capacity
     */
    push(value) {
        this.buffer[this.head] = value;
        this.head = (this.head + 1) % this.capacity;
        if (this.size < this.capacity) {
            this.size++;
        }
    }

    /**
     * Get element at index (0 = oldest) - O(1)
     */
    get(index) {
        if (index < 0 || index >= this.size) return undefined;
        const actualIndex = (this.head - this.size + index + this.capacity) % this.capacity;
        return this.buffer[actualIndex];
    }

    /**
     * Get the most recent element - O(1)
     */
    getLast() {
        if (this.size === 0) return undefined;
        const lastIndex = (this.head - 1 + this.capacity) % this.capacity;
        return this.buffer[lastIndex];
    }

    /**
     * Get the oldest element - O(1)
     */
    getFirst() {
        if (this.size === 0) return undefined;
        const firstIndex = (this.head - this.size + this.capacity) % this.capacity;
        return this.buffer[firstIndex];
    }

    /**
     * Calculate average of all values - O(n)
     */
    average() {
        if (this.size === 0) return 0;
        let sum = 0;
        for (let i = 0; i < this.size; i++) {
            sum += this.get(i);
        }
        return sum / this.size;
    }

    /**
     * Calculate sum of all values - O(n)
     */
    sum() {
        let total = 0;
        for (let i = 0; i < this.size; i++) {
            total += this.get(i);
        }
        return total;
    }

    /**
     * Find minimum value - O(n)
     */
    min() {
        if (this.size === 0) return undefined;
        let minVal = this.get(0);
        for (let i = 1; i < this.size; i++) {
            const val = this.get(i);
            if (val < minVal) minVal = val;
        }
        return minVal;
    }

    /**
     * Find maximum value - O(n)
     */
    max() {
        if (this.size === 0) return undefined;
        let maxVal = this.get(0);
        for (let i = 1; i < this.size; i++) {
            const val = this.get(i);
            if (val > maxVal) maxVal = val;
        }
        return maxVal;
    }

    /**
     * Convert to array (ordered oldest to newest) - O(n)
     */
    toArray() {
        const result = new Array(this.size);
        for (let i = 0; i < this.size; i++) {
            result[i] = this.get(i);
        }
        return result;
    }

    /**
     * Iterate over elements (oldest to newest)
     */
    *[Symbol.iterator]() {
        for (let i = 0; i < this.size; i++) {
            yield this.get(i);
        }
    }

    /**
     * Clear all elements - O(1)
     */
    clear() {
        this.head = 0;
        this.size = 0;
    }

    /**
     * Check if buffer is empty
     */
    isEmpty() {
        return this.size === 0;
    }

    /**
     * Check if buffer is at capacity
     */
    isFull() {
        return this.size === this.capacity;
    }

    /**
     * Get current number of elements
     */
    get length() {
        return this.size;
    }

    /**
     * Serialize for save/load
     */
    toJSON() {
        return {
            capacity: this.capacity,
            data: this.toArray()
        };
    }

    /**
     * Create from serialized data
     */
    static fromJSON(json) {
        const buffer = new RingBuffer(json.capacity);
        for (const value of json.data) {
            buffer.push(value);
        }
        return buffer;
    }
}

/**
 * Create a ring buffer with initial values
 */
export function createRingBuffer(capacity, initialValues = []) {
    const buffer = new RingBuffer(capacity);
    for (const value of initialValues) {
        buffer.push(value);
    }
    return buffer;
}

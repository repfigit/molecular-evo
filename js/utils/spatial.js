/**
 * Spatial hashing for efficient proximity queries
 * Used for collision detection, finding nearby agents, etc.
 */

import { distance } from './math.js';

/**
 * SpatialHash - A grid-based spatial partitioning structure
 * Provides O(1) average case for nearby entity queries
 */
export class SpatialHash {
    /**
     * Create a new spatial hash
     * @param {number} cellSize - Size of each grid cell
     */
    constructor(cellSize = 50) {
        this.cellSize = cellSize;
        this.cells = new Map();
        this.entityCells = new Map(); // Track which cell each entity is in
    }

    /**
     * Get the cell key for a position
     */
    _hash(x, y) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }

    /**
     * Get cell coordinates from position
     */
    _getCellCoords(x, y) {
        return {
            cx: Math.floor(x / this.cellSize),
            cy: Math.floor(y / this.cellSize)
        };
    }

    /**
     * Clear all entities from the hash
     */
    clear() {
        this.cells.clear();
        this.entityCells.clear();
    }

    /**
     * Insert an entity into the hash
     * Entity must have an 'id' property and a 'position' property with x, y
     * Uses Set for O(1) add/delete operations
     */
    insert(entity) {
        if (!entity || !entity.position) return;

        const key = this._hash(entity.position.x, entity.position.y);

        // Remove from old cell if exists - O(1) with Set
        if (this.entityCells.has(entity.id)) {
            const oldKey = this.entityCells.get(entity.id);
            if (oldKey !== key) {
                const oldCell = this.cells.get(oldKey);
                if (oldCell) {
                    oldCell.delete(entity);  // O(1) Set delete
                    if (oldCell.size === 0) {
                        this.cells.delete(oldKey);
                    }
                }
            }
        }

        // Add to new cell - O(1) with Set
        if (!this.cells.has(key)) {
            this.cells.set(key, new Set());
        }

        this.cells.get(key).add(entity);  // O(1) Set add (handles duplicates)
        this.entityCells.set(entity.id, key);
    }

    /**
     * Remove an entity from the hash - O(1) with Set
     */
    remove(entity) {
        if (!entity || !this.entityCells.has(entity.id)) return;

        const key = this.entityCells.get(entity.id);
        const cell = this.cells.get(key);

        if (cell) {
            cell.delete(entity);  // O(1) Set delete
            if (cell.size === 0) {
                this.cells.delete(key);
            }
        }

        this.entityCells.delete(entity.id);
    }

    /**
     * Update an entity's position in the hash
     * Call this after moving an entity
     */
    update(entity) {
        this.insert(entity); // insert handles the update
    }

    /**
     * Update all entities in a list
     */
    updateAll(entities) {
        this.clear();
        for (const entity of entities) {
            this.insert(entity);
        }
    }

    /**
     * Query for entities within a radius of a point
     * @param {number} x - X coordinate of center
     * @param {number} y - Y coordinate of center
     * @param {number} radius - Search radius
     * @param {Function} filter - Optional filter function
     * @returns {Array} Entities within radius
     */
    query(x, y, radius, filter = null) {
        const results = [];
        const radiusSquared = radius * radius;
        const cellsToCheck = Math.ceil(radius / this.cellSize);

        const { cx, cy } = this._getCellCoords(x, y);

        for (let dx = -cellsToCheck; dx <= cellsToCheck; dx++) {
            for (let dy = -cellsToCheck; dy <= cellsToCheck; dy++) {
                const key = `${cx + dx},${cy + dy}`;
                const cell = this.cells.get(key);

                if (cell) {
                    for (const entity of cell) {
                        const ex = entity.position.x;
                        const ey = entity.position.y;
                        const distSq = (ex - x) * (ex - x) + (ey - y) * (ey - y);

                        if (distSq <= radiusSquared) {
                            if (!filter || filter(entity)) {
                                results.push(entity);
                            }
                        }
                    }
                }
            }
        }

        return results;
    }

    /**
     * Query for entities within a radius, returning with distances
     */
    queryWithDistance(x, y, radius, filter = null) {
        const results = [];
        const radiusSquared = radius * radius;
        const cellsToCheck = Math.ceil(radius / this.cellSize);

        const { cx, cy } = this._getCellCoords(x, y);

        for (let dx = -cellsToCheck; dx <= cellsToCheck; dx++) {
            for (let dy = -cellsToCheck; dy <= cellsToCheck; dy++) {
                const key = `${cx + dx},${cy + dy}`;
                const cell = this.cells.get(key);

                if (cell) {
                    for (const entity of cell) {
                        const ex = entity.position.x;
                        const ey = entity.position.y;
                        const distSq = (ex - x) * (ex - x) + (ey - y) * (ey - y);

                        if (distSq <= radiusSquared) {
                            if (!filter || filter(entity)) {
                                results.push({
                                    entity,
                                    distance: Math.sqrt(distSq),
                                    distanceSquared: distSq
                                });
                            }
                        }
                    }
                }
            }
        }

        // Sort by distance
        results.sort((a, b) => a.distanceSquared - b.distanceSquared);

        return results;
    }

    /**
     * Find the nearest entity to a point
     */
    findNearest(x, y, maxRadius = Infinity, filter = null) {
        let nearest = null;
        let nearestDistSq = Infinity;

        // Start with nearby cells and expand
        const startRadius = this.cellSize;
        let searchRadius = startRadius;

        while (searchRadius <= maxRadius) {
            const results = this.query(x, y, searchRadius, filter);

            for (const entity of results) {
                const distSq = (entity.position.x - x) ** 2 + (entity.position.y - y) ** 2;
                if (distSq < nearestDistSq) {
                    nearestDistSq = distSq;
                    nearest = entity;
                }
            }

            if (nearest && Math.sqrt(nearestDistSq) <= searchRadius - this.cellSize) {
                // Found one and it's definitely the closest
                break;
            }

            searchRadius += this.cellSize;
        }

        return nearest;
    }

    /**
     * Find K nearest entities
     */
    findKNearest(x, y, k, maxRadius = Infinity, filter = null) {
        const results = this.queryWithDistance(x, y, maxRadius, filter);
        return results.slice(0, k).map(r => r.entity);
    }

    /**
     * Get all entities in a rectangular region
     */
    queryRect(x1, y1, x2, y2, filter = null) {
        const results = [];

        const { cx: cx1, cy: cy1 } = this._getCellCoords(Math.min(x1, x2), Math.min(y1, y2));
        const { cx: cx2, cy: cy2 } = this._getCellCoords(Math.max(x1, x2), Math.max(y1, y2));

        for (let cx = cx1; cx <= cx2; cx++) {
            for (let cy = cy1; cy <= cy2; cy++) {
                const key = `${cx},${cy}`;
                const cell = this.cells.get(key);

                if (cell) {
                    for (const entity of cell) {
                        const ex = entity.position.x;
                        const ey = entity.position.y;

                        if (ex >= Math.min(x1, x2) && ex <= Math.max(x1, x2) &&
                            ey >= Math.min(y1, y2) && ey <= Math.max(y1, y2)) {
                            if (!filter || filter(entity)) {
                                results.push(entity);
                            }
                        }
                    }
                }
            }
        }

        return results;
    }

    /**
     * Get all potential collision pairs
     * Returns pairs of entities that might be colliding (in same or adjacent cells)
     */
    getPotentialCollisions() {
        const pairs = [];
        const checked = new Set();

        for (const [key, cellSet] of this.cells) {
            // Convert Set to array for indexed access
            const cell = [...cellSet];

            // Check within this cell
            for (let i = 0; i < cell.length; i++) {
                for (let j = i + 1; j < cell.length; j++) {
                    const pairKey = [cell[i].id, cell[j].id].sort().join('-');
                    if (!checked.has(pairKey)) {
                        pairs.push([cell[i], cell[j]]);
                        checked.add(pairKey);
                    }
                }
            }

            // Check adjacent cells
            const [cx, cy] = key.split(',').map(Number);
            const adjacentOffsets = [
                [1, 0], [1, 1], [0, 1], [-1, 1]
            ];

            for (const [dx, dy] of adjacentOffsets) {
                const adjKey = `${cx + dx},${cy + dy}`;
                const adjCell = this.cells.get(adjKey);

                if (adjCell) {
                    for (const entityA of cellSet) {
                        for (const entityB of adjCell) {
                            const pairKey = [entityA.id, entityB.id].sort().join('-');
                            if (!checked.has(pairKey)) {
                                pairs.push([entityA, entityB]);
                                checked.add(pairKey);
                            }
                        }
                    }
                }
            }
        }

        return pairs;
    }

    /**
     * Get entities in the same cell as the given entity
     */
    getNeighborsInCell(entity) {
        if (!entity || !this.entityCells.has(entity.id)) return [];

        const key = this.entityCells.get(entity.id);
        const cell = this.cells.get(key);

        if (!cell) return [];

        // Convert Set to array and filter
        return [...cell].filter(e => e !== entity);
    }

    /**
     * Get the number of entities in the hash
     */
    get size() {
        let count = 0;
        for (const cell of this.cells.values()) {
            count += cell.size;  // Set.size instead of array.length
        }
        return count;
    }

    /**
     * Get the number of non-empty cells
     */
    get cellCount() {
        return this.cells.size;
    }

    /**
     * Debug: Get all cell boundaries for visualization
     */
    getCellBounds() {
        const bounds = [];
        for (const key of this.cells.keys()) {
            const [cx, cy] = key.split(',').map(Number);
            bounds.push({
                x: cx * this.cellSize,
                y: cy * this.cellSize,
                width: this.cellSize,
                height: this.cellSize,
                key,
                count: this.cells.get(key).size  // Set.size instead of array.length
            });
        }
        return bounds;
    }
}

/**
 * Create a spatial hash optimized for the simulation
 */
export function createSpatialHash(cellSize) {
    return new SpatialHash(cellSize);
}

/**
 * Helper to find all pairs within a distance
 */
export function findPairsWithinDistance(entities, maxDistance, spatialHash = null) {
    const pairs = [];

    if (spatialHash) {
        // Use spatial hash for efficiency
        const checked = new Set();

        for (const entity of entities) {
            const nearby = spatialHash.query(
                entity.position.x,
                entity.position.y,
                maxDistance,
                other => other !== entity
            );

            for (const other of nearby) {
                const pairKey = [entity.id, other.id].sort().join('-');
                if (!checked.has(pairKey)) {
                    const dist = distance(entity.position, other.position);
                    if (dist <= maxDistance) {
                        pairs.push({ a: entity, b: other, distance: dist });
                    }
                    checked.add(pairKey);
                }
            }
        }
    } else {
        // Brute force O(n^2)
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const dist = distance(entities[i].position, entities[j].position);
                if (dist <= maxDistance) {
                    pairs.push({ a: entities[i], b: entities[j], distance: dist });
                }
            }
        }
    }

    return pairs;
}

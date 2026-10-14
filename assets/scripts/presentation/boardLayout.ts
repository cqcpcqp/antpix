import { GRID_WIDTH } from '../domain/levels/levels';
import type { RoutePoint } from '../domain/routing/routing';

// Logical canvas coordinates. These describe presentation, not collection rules.
export const CELL_SIZE = 584 / GRID_WIDTH;
export const BOARD_LEFT = -292;
export const BOARD_TOP = 608;
export const COLLECTION_SLOT_Y = -310;
export const NEST = { x: 0, y: -203 };
export const EXTRA_SLOT_X = 228;
export const EXTRA_SLOT_Y = -200;
export const EXPANSION_COLUMNS = [4, 3, 1, 0] as const;

export function queueColumnX(column: number): number {
    return (column - 2) * 114;
}

export function collectionSlotX(slot: number, count: number): number {
    return queueColumnX(slot >= 5 ? EXPANSION_COLUMNS[slot - 5] : slot);
}

export function collectionSlotY(slot: number): number {
    return slot >= 5 ? EXTRA_SLOT_Y : COLLECTION_SLOT_Y;
}

/** Grid coordinates refer to cell centers; grid y increases downward. */
export function gridToWorld(point: RoutePoint): RoutePoint {
    return {
        x: BOARD_LEFT + (point.x + 0.5) * CELL_SIZE,
        y: BOARD_TOP - (point.y + 0.5) * CELL_SIZE,
    };
}

export function worldToGrid(point: RoutePoint): RoutePoint {
    return {
        x: (point.x - BOARD_LEFT) / CELL_SIZE - 0.5,
        y: (BOARD_TOP - point.y) / CELL_SIZE - 0.5,
    };
}

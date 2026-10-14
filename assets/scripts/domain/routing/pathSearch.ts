import { clearSegment, smoothCheckedRoute } from './routeGeometry';
import { AntRouteSearch } from './routeSearch';
import type { BoardGrid, RoutePoint } from './routeTypes';

export const DIAGONAL_COST = Math.hypot(1, 1);

export const DIAGONAL_HEURISTIC = Math.SQRT2 - 1;

/** A* on eight-connected free cells; diagonals never cut through occupied corners. */
export function findAntRoute(
    board: BoardGrid,
    start: RoutePoint,
    target: RoutePoint,
    clearance = 0,
    search = new AntRouteSearch(),
): RoutePoint[] {
    search.begin();
    return searchAntRoute(board, start, target, clearance, search);
}

export function searchAntRoute(
    board: BoardGrid,
    start: RoutePoint,
    target: RoutePoint,
    clearance: number,
    search: AntRouteSearch,
): RoutePoint[] {
    const minX = -1,
        maxX = board.width,
        minY = 0,
        maxY = Math.max(board.height + 6, Math.ceil(start.y), Math.ceil(target.y));
    const stride = maxX - minX + 1;
    const id = (x: number, y: number) => y * stride + x - minX;
    const point = (i: number): RoutePoint => ({
        x: (i % stride) + minX,
        y: Math.floor(i / stride),
    });
    const free = (x: number, y: number) =>
        x >= minX &&
        x <= maxX &&
        y >= minY &&
        y <= maxY &&
        (y >= board.height || (x >= 0 && x < board.width && board.pixels[y * board.width + x] < 0));
    const source = { x: Math.round(start.x), y: Math.round(start.y) };
    const goal = { x: Math.round(target.x), y: Math.round(target.y) };
    if (!free(source.x, source.y) || !free(goal.x, goal.y))
        throw new Error('Ant route endpoint is occupied');
    if (clearSegment(board, start, target, clearance)) return [start, target];
    const sourceId = id(source.x, source.y),
        goalId = id(goal.x, goal.y);
    search.reset(stride * (maxY + 1), stride);
    const { costs, previous, steps } = search;
    costs[sourceId] = 0;
    const heuristic = (x: number, y: number) => {
        const dx = x < goal.x ? goal.x - x : x - goal.x;
        const dy = y < goal.y ? goal.y - y : y - goal.y;
        return dx > dy ? dx + DIAGONAL_HEURISTIC * dy : dy + DIAGONAL_HEURISTIC * dx;
    };
    search.push(sourceId, heuristic(source.x, source.y), 0);
    // For integer unit steps and extent < 1, occupied cells can only touch a
    // diagonal via its two corner cells, both tested below. Longer/fractional
    // segments still use exact clearance checks, as do larger clearances.
    const checkStepClearance = clearance > 0 && 0.5 + clearance >= 1;
    const from = { x: 0, y: 0 },
        to = { x: 0, y: 0 };
    while (search.heapSize) {
        let current = search.pop();
        if (search.poppedCost !== costs[current]) continue;
        if (current === goalId) {
            const path: RoutePoint[] = [point(current)];
            while (previous[current] !== -1) {
                current = previous[current];
                path.push(point(current));
            }
            path.reverse();
            if (Math.hypot(path[0].x - start.x, path[0].y - start.y) > 0.001) path.unshift(start);
            return smoothCheckedRoute(path, (a, b) =>
                search.clearLine(board, a, b, clearance, start),
            );
        }
        const x = (current % stride) + minX,
            y = Math.floor(current / stride);
        let edges = steps[current];
        if (!edges) {
            edges = 256; // Computed, including a cell with no outgoing edges.
            from.x = x;
            from.y = y;
            let bit = 1;
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const edge = bit;
                    bit <<= 1;
                    const nx = x + dx,
                        ny = y + dy;
                    if (!free(nx, ny) || (dx && dy && (!free(nx, y) || !free(x, ny)))) continue;
                    if (checkStepClearance) {
                        to.x = nx;
                        to.y = ny;
                        if (!clearSegment(board, from, to, clearance)) continue;
                    }
                    edges |= edge;
                }
            steps[current] = edges;
        }
        let bit = 1;
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                const edge = bit;
                bit <<= 1;
                if (!(edges & edge)) continue;
                const nx = x + dx,
                    ny = y + dy;
                const next = id(nx, ny),
                    cost = costs[current] + (dx && dy ? DIAGONAL_COST : 1);
                if (cost < costs[next]) {
                    costs[next] = cost;
                    previous[next] = current;
                    search.push(next, cost + heuristic(nx, ny), cost);
                }
            }
    }
    throw new Error('Exposed pixel must have a route to the nest');
}

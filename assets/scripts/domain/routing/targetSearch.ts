const DIAGONAL_COST = Math.hypot(1, 1);
import { clearSegment, smoothCheckedRoute } from './routeGeometry';
import { AntRouteSearch } from './routeSearch';
import type {
    AntAssignment,
    AntTarget,
    BoardGrid,
    RoutePoint,
    TargetCandidate,
} from './routeTypes';

/** One synchronous, multi-target grid search per dispatch. */
export class AntTargetSearch {
    readonly goals = new Map<number, TargetCandidate>();
    readonly routeSearch = new AntRouteSearch();
}

/** Choose the nearest contact by grid walking distance, then smooth only its route. */
export function nearestAntTarget(
    board: BoardGrid,
    start: RoutePoint,
    targets: readonly AntTarget[],
    clearance = 0.45,
    search = new AntTargetSearch(),
): AntAssignment | null {
    if (!targets.length) return null;
    const stride = board.width + 2;
    let maxY = Math.max(board.height + 6, Math.ceil(start.y));
    const id = (x: number, y: number) => y * stride + x + 1;
    const goals = search.goals;
    goals.clear();
    for (const target of targets)
        for (const approach of target.approaches) {
            maxY = Math.max(maxY, Math.ceil(approach.y));
            const key = id(approach.x, approach.y),
                old = goals.get(key);
            if (!old || target.pixel < old.pixel) goals.set(key, { pixel: target.pixel, approach });
        }
    if (!goals.size) return null;
    const free = (x: number, y: number) =>
        x >= -1 &&
        x <= board.width &&
        y >= 0 &&
        y <= maxY &&
        (y >= board.height || (x >= 0 && x < board.width && board.pixels[y * board.width + x] < 0));
    const sx = Math.round(start.x),
        sy = Math.round(start.y);
    if (!free(sx, sy)) throw new Error('Ant route endpoint is occupied');
    const route = search.routeSearch;
    route.begin();
    route.reset(stride * (maxY + 1), stride);
    const { costs, previous } = route;
    const source = id(sx, sy);
    costs[source] = 0;
    route.push(source, 0, 0);
    let best: TargetCandidate | null = null,
        bestId = -1,
        distance = Infinity;
    const from = { x: 0, y: 0 },
        to = { x: 0, y: 0 };
    const checkClearance = clearance > 0 && 0.5 + clearance >= 1;
    while (route.heapSize) {
        const current = route.pop(),
            cost = costs[current];
        if (route.poppedCost !== cost) continue;
        if (cost > distance + 1e-9) break;
        const goal = goals.get(current);
        if (goal) {
            if (
                !best ||
                goal.pixel < best.pixel ||
                (goal.pixel === best.pixel &&
                    (goal.approach.y < best.approach.y ||
                        (goal.approach.y === best.approach.y && goal.approach.x < best.approach.x)))
            ) {
                best = goal;
                bestId = current;
                distance = cost;
            }
            continue;
        }
        const x = (current % stride) - 1,
            y = Math.floor(current / stride);
        from.x = x;
        from.y = y;
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx,
                    ny = y + dy;
                if ((!dx && !dy) || !free(nx, ny) || (dx && dy && (!free(nx, y) || !free(x, ny))))
                    continue;
                if (checkClearance) {
                    to.x = nx;
                    to.y = ny;
                    if (!clearSegment(board, from, to, clearance)) continue;
                }
                const next = id(nx, ny),
                    nextCost = cost + (dx && dy ? DIAGONAL_COST : 1);
                if (nextCost < costs[next] && nextCost <= distance + 1e-9) {
                    costs[next] = nextCost;
                    previous[next] = current;
                    route.push(next, nextCost, nextCost);
                }
            }
    }
    if (!best) throw new Error('Exposed pixel must have a route to the nest');
    const path: RoutePoint[] = [];
    for (let at = bestId; at !== -1; at = previous[at])
        path.push({ x: (at % stride) - 1, y: Math.floor(at / stride) });
    path.reverse();
    if (Math.hypot(path[0].x - start.x, path[0].y - start.y) > 0.001) path.unshift(start);
    return {
        pixel: best.pixel,
        approach: best.approach,
        path: smoothCheckedRoute(path, (a, b) => route.clearLine(board, a, b, clearance, start)),
    };
}

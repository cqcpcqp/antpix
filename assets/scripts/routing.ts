export interface RoutePoint {
    x: number;
    y: number;
}

export interface RoutePose extends RoutePoint {
    angle: number;
}

export interface PreparedRoute {
    path: readonly RoutePoint[];
    lengths: Float64Array;
    angles: Float64Array;
    distance: number;
}

export interface BoardGrid {
    width: number;
    height: number;
    pixels: readonly number[];
}

export interface AntTarget {
    pixel: number;
    approaches: readonly RoutePoint[];
}

export interface AntAssignment {
    pixel: number;
    approach: RoutePoint;
    path: RoutePoint[];
}

type TargetCandidate = { pixel: number; approach: RoutePoint };
type OccupiedRows = { first: number[]; last: number[] };

/** Scratch storage only: every route resets costs, parents and the heap. */
export class AntRouteSearch {
    costs = new Float64Array(0);
    previous = new Int32Array(0);
    steps = new Uint16Array(0);
    private gridSize = 0;
    private gridStride = 0;
    private readonly visibility = new Map<number, boolean>();
    private readonly occupiedRows: OccupiedRows = { first: [], last: [] };
    private rowsReady = false;
    readonly heapIds: number[] = [];
    readonly heapScores: number[] = [];
    readonly heapCosts: number[] = [];
    heapSize = 0;
    poppedCost = 0;

    begin() {
        this.steps.fill(0);
        this.visibility.clear();
        this.rowsReady = false;
    }

    reset(size: number, stride: number) {
        if (this.costs.length < size) {
            this.costs = new Float64Array(size);
            this.previous = new Int32Array(size);
            this.steps = new Uint16Array(size);
        }
        if (size !== this.gridSize || stride !== this.gridStride) {
            this.steps.fill(0);
            this.visibility.clear();
            this.gridSize = size;
            this.gridStride = stride;
        }
        this.costs.fill(Infinity, 0, size);
        this.previous.fill(-1, 0, size);
        this.heapSize = 0;
    }

    clearLine(board: BoardGrid, a: RoutePoint, b: RoutePoint, clearance: number, origin: RoutePoint): boolean {
        const from = a.x === (a.x | 0) && a.y === (a.y | 0) ? a.y * this.gridStride + a.x + 1
            : a.x === origin.x && a.y === origin.y ? this.gridSize : -1;
        const to = b.x === (b.x | 0) && b.y === (b.y | 0) ? b.y * this.gridStride + b.x + 1
            : b.x === origin.x && b.y === origin.y ? this.gridSize : -1;
        if (from < 0 || to < 0) return clearSegment(board, a, b, clearance);
        // Keep direction in the key, including exact floating-point contact
        // behavior. Only integer search vertices and this query's origin enter.
        const key = from * (this.gridSize + 1) + to;
        const known = this.visibility.get(key);
        if (known !== undefined) return known;
        if (!this.rowsReady) {
            for (let y = 0; y < board.height; y++) {
                let first = board.width, last = -1;
                for (let x = 0; x < board.width; x++)
                    if (board.pixels[y * board.width + x] >= 0) {
                        if (first === board.width) first = x;
                        last = x;
                    }
                this.occupiedRows.first[y] = first;
                this.occupiedRows.last[y] = last;
            }
            this.rowsReady = true;
        }
        const clear = clearSegmentInRows(board, a, b, clearance, this.occupiedRows);
        this.visibility.set(key, clear);
        return clear;
    }

    push(id: number, score: number, cost: number) {
        let i = this.heapSize++;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.heapScores[parent] <= score) break;
            this.heapIds[i] = this.heapIds[parent];
            this.heapScores[i] = this.heapScores[parent];
            this.heapCosts[i] = this.heapCosts[parent];
            i = parent;
        }
        this.heapIds[i] = id;
        this.heapScores[i] = score;
        this.heapCosts[i] = cost;
    }

    pop(): number {
        const first = this.heapIds[0];
        this.poppedCost = this.heapCosts[0];
        const last = --this.heapSize;
        const id = this.heapIds[last], score = this.heapScores[last], cost = this.heapCosts[last];
        if (last > 0) {
            let i = 0;
            while (i * 2 + 1 < last) {
                let child = i * 2 + 1;
                if (child + 1 < last && this.heapScores[child + 1] < this.heapScores[child]) child++;
                if (this.heapScores[child] >= score) break;
                this.heapIds[i] = this.heapIds[child];
                this.heapScores[i] = this.heapScores[child];
                this.heapCosts[i] = this.heapCosts[child];
                i = child;
            }
            this.heapIds[i] = id;
            this.heapScores[i] = score;
            this.heapCosts[i] = cost;
        }
        return first;
    }
}

const DIAGONAL_COST = Math.hypot(1, 1);
const DIAGONAL_HEURISTIC = Math.SQRT2 - 1;

/** One synchronous, multi-target grid search per dispatch. */
export class AntTargetSearch {
    readonly goals = new Map<number, TargetCandidate>();
    readonly routeSearch = new AntRouteSearch();
}

/** Choose the nearest contact by grid walking distance, then smooth only its route. */
export function nearestAntTarget(board: BoardGrid, start: RoutePoint, targets: readonly AntTarget[], clearance = .45, search = new AntTargetSearch()): AntAssignment | null {
    if (!targets.length) return null;
    const stride = board.width + 2;
    let maxY = Math.max(board.height + 6, Math.ceil(start.y));
    const id = (x: number, y: number) => y * stride + x + 1;
    const goals = search.goals;
    goals.clear();
    for (const target of targets) for (const approach of target.approaches) {
        maxY = Math.max(maxY, Math.ceil(approach.y));
        const key = id(approach.x, approach.y), old = goals.get(key);
        if (!old || target.pixel < old.pixel) goals.set(key, { pixel: target.pixel, approach });
    }
    if (!goals.size) return null;
    const free = (x: number, y: number) => x >= -1 && x <= board.width && y >= 0 && y <= maxY &&
        (y >= board.height || x >= 0 && x < board.width && board.pixels[y * board.width + x] < 0);
    const sx = Math.round(start.x), sy = Math.round(start.y);
    if (!free(sx, sy)) throw new Error('Ant route endpoint is occupied');
    const route = search.routeSearch;
    route.begin();
    route.reset(stride * (maxY + 1), stride);
    const { costs, previous } = route;
    const source = id(sx, sy);
    costs[source] = 0;
    route.push(source, 0, 0);
    let best: TargetCandidate | null = null, bestId = -1, distance = Infinity;
    const from = { x: 0, y: 0 }, to = { x: 0, y: 0 };
    const checkClearance = clearance > 0 && .5 + clearance >= 1;
    while (route.heapSize) {
        const current = route.pop(), cost = costs[current];
        if (route.poppedCost !== cost) continue;
        if (cost > distance + 1e-9) break;
        const goal = goals.get(current);
        if (goal) {
            if (!best || goal.pixel < best.pixel || goal.pixel === best.pixel &&
                (goal.approach.y < best.approach.y || goal.approach.y === best.approach.y && goal.approach.x < best.approach.x)) {
                best = goal;
                bestId = current;
                distance = cost;
            }
            continue;
        }
        const x = current % stride - 1, y = Math.floor(current / stride);
        from.x = x;
        from.y = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if ((!dx && !dy) || !free(nx, ny) || dx && dy && (!free(nx, y) || !free(x, ny))) continue;
            if (checkClearance) {
                to.x = nx;
                to.y = ny;
                if (!clearSegment(board, from, to, clearance)) continue;
            }
            const next = id(nx, ny), nextCost = cost + (dx && dy ? DIAGONAL_COST : 1);
            if (nextCost < costs[next] && nextCost <= distance + 1e-9) {
                costs[next] = nextCost;
                previous[next] = current;
                route.push(next, nextCost, nextCost);
            }
        }
    }
    if (!best) throw new Error('Exposed pixel must have a route to the nest');
    const path: RoutePoint[] = [];
    for (let at = bestId; at !== -1; at = previous[at]) path.push({ x: at % stride - 1, y: Math.floor(at / stride) });
    path.reverse();
    if (Math.hypot(path[0].x - start.x, path[0].y - start.y) > .001) path.unshift(start);
    return { pixel: best.pixel, approach: best.approach,
        path: smoothCheckedRoute(path, (a, b) => route.clearLine(board, a, b, clearance, start)) };
}

/** A* on eight-connected free cells; diagonals never cut through occupied corners. */
export function findAntRoute(board: BoardGrid, start: RoutePoint, target: RoutePoint, clearance = 0, search = new AntRouteSearch()): RoutePoint[] {
    search.begin();
    return searchAntRoute(board, start, target, clearance, search);
}

function searchAntRoute(board: BoardGrid, start: RoutePoint, target: RoutePoint, clearance: number, search: AntRouteSearch): RoutePoint[] {
    const minX = -1, maxX = board.width, minY = 0, maxY = Math.max(board.height + 6, Math.ceil(start.y), Math.ceil(target.y));
    const stride = maxX - minX + 1;
    const id = (x: number, y: number) => y * stride + x - minX;
    const point = (i: number): RoutePoint => ({ x: i % stride + minX, y: Math.floor(i / stride) });
    const free = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY &&
        (y >= board.height || x >= 0 && x < board.width && board.pixels[y * board.width + x] < 0);
    const source = { x: Math.round(start.x), y: Math.round(start.y) };
    const goal = { x: Math.round(target.x), y: Math.round(target.y) };
    if (!free(source.x, source.y) || !free(goal.x, goal.y))
        throw new Error('Ant route endpoint is occupied');
    if (clearSegment(board, start, target, clearance))
        return [start, target];
    const sourceId = id(source.x, source.y), goalId = id(goal.x, goal.y);
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
    const checkStepClearance = clearance > 0 && .5 + clearance >= 1;
    const from = { x: 0, y: 0 }, to = { x: 0, y: 0 };
    while (search.heapSize) {
        let current = search.pop();
        if (search.poppedCost !== costs[current])
            continue;
        if (current === goalId) {
            const path: RoutePoint[] = [point(current)];
            while (previous[current] !== -1) {
                current = previous[current];
                path.push(point(current));
            }
            path.reverse();
            if (Math.hypot(path[0].x - start.x, path[0].y - start.y) > .001)
                path.unshift(start);
            return smoothCheckedRoute(path, (a, b) => search.clearLine(board, a, b, clearance, start));
        }
        const x = current % stride + minX, y = Math.floor(current / stride);
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
                    const nx = x + dx, ny = y + dy;
                    if (!free(nx, ny) || dx && dy && (!free(nx, y) || !free(x, ny))) continue;
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
                const nx = x + dx, ny = y + dy;
                const next = id(nx, ny), cost = costs[current] + (dx && dy ? DIAGONAL_COST : 1);
                if (cost < costs[next]) {
                    costs[next] = cost;
                    previous[next] = current;
                    search.push(next, cost + heuristic(nx, ny), cost);
                }
            }
    }
    throw new Error('Exposed pixel must have a route to the nest');
}

/** Exact segment/rectangle intersection, including corners: no sampling gaps. */
export function clearSegment(board: BoardGrid, a: RoutePoint, b: RoutePoint, clearance = 0): boolean {
    return clearSegmentInRows(board, a, b, clearance);
}

function clearSegmentInRows(board: BoardGrid, a: RoutePoint, b: RoutePoint, clearance: number, occupied?: OccupiedRows): boolean {
    // Side borders are closed above the bottom entrance. Check the entire
    // segment so smoothing and per-frame waiting checks obey the same walls.
    const entranceY = board.height - .5;
    if (Math.min(a.y, b.y) < entranceY) {
        const inside = a.y <= b.y ? a : b, outside = a.y <= b.y ? b : a;
        const endX = outside.y <= entranceY ? outside.x
            : inside.x + (outside.x - inside.x) * (entranceY - inside.y) / (outside.y - inside.y);
        // World/grid round trips can place a boundary center a few ulps outside.
        if (Math.min(inside.x, endX) < -1e-9 || Math.max(inside.x, endX) > board.width - 1 + 1e-9)
            return false;
    }
    const dx = b.x - a.x, dy = b.y - a.y, extent = .5 + clearance;
    const left = Math.max(0, Math.ceil(Math.min(a.x, b.x) - extent)), right = Math.min(board.width - 1, Math.floor(Math.max(a.x, b.x) + extent));
    const top = Math.max(0, Math.ceil(Math.min(a.y, b.y) - extent)), bottom = Math.min(board.height - 1, Math.floor(Math.max(a.y, b.y) + extent));
    const vertical = dx > -1e-9 && dx < 1e-9, horizontal = dy > -1e-9 && dy < 1e-9;
    for (let y = top; y <= bottom; y++) {
        let nearY = 0, farY = 1, rowLeft = left, rowRight = right;
        if (occupied) {
            if (occupied.first[y] > rowLeft) rowLeft = occupied.first[y];
            if (occupied.last[y] < rowRight) rowRight = occupied.last[y];
            if (rowLeft > rowRight) continue;
        }
        if (horizontal) {
            if (a.y < y - extent || a.y > y + extent) continue;
        } else {
            const t1 = (y - extent - a.y) / dy, t2 = (y + extent - a.y) / dy;
            const enter = t1 < t2 ? t1 : t2, leave = t1 > t2 ? t1 : t2;
            if (enter > nearY) nearY = enter;
            if (leave < farY) farY = leave;
            if (nearY > farY) continue;
            // Visit the strip crossed in this row, not the entire segment's
            // bounding rectangle. An extra cell on either side keeps this
            // broad phase conservative at floating-point boundary contacts.
            const x1 = a.x + dx * nearY, x2 = a.x + dx * farY;
            const stripLeft = Math.ceil((x1 < x2 ? x1 : x2) - extent) - 1;
            const stripRight = Math.floor((x1 > x2 ? x1 : x2) + extent) + 1;
            if (stripLeft > rowLeft) rowLeft = stripLeft;
            if (stripRight < rowRight) rowRight = stripRight;
        }
        for (let x = rowLeft; x <= rowRight; x++) {
            if (board.pixels[y * board.width + x] < 0)
                continue;
            let near = nearY, far = farY;
            if (vertical) {
                if (a.x < x - extent || a.x > x + extent)
                    continue;
            }
            else {
                const t1 = (x - extent - a.x) / dx, t2 = (x + extent - a.x) / dx;
                const enter = t1 < t2 ? t1 : t2, leave = t1 > t2 ? t1 : t2;
                if (enter > near) near = enter;
                if (leave < far) far = leave;
            }
            if (near <= far)
                return false;
        }
    }
    return true;
}

export function smoothRoute(board: BoardGrid, path: RoutePoint[], clearance = 0): RoutePoint[] {
    return smoothCheckedRoute(path, (a, b) => clearSegment(board, a, b, clearance));
}

function smoothCheckedRoute(path: RoutePoint[], clear: (a: RoutePoint, b: RoutePoint) => boolean): RoutePoint[] {
    if (path.length < 3)
        return path;
    const result = [path[0]];
    let index = 0;
    while (index < path.length - 1) {
        let next = path.length - 1;
        while (next > index + 1 && !clear(path[index], path[next]))
            next--;
        result.push(path[next]);
        index = next;
    }
    return result;
}

export function routeLength(path: readonly RoutePoint[]): number {
    let total = 0;
    for (let i = 1; i < path.length; i++)
        total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    return total;
}

export function sampleRoute(path: readonly RoutePoint[], distance: number): RoutePoint & {
    angle: number;
} {
    for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i], length = Math.hypot(b.x - a.x, b.y - a.y);
        if (distance <= length || i === path.length - 1) {
            const t = length ? Math.max(0, Math.min(1, distance / length)) : 0;
            return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
        }
        distance -= length;
    }
    return { ...path[0], angle: Math.PI / 2 };
}

/** Prepare once per new route. Its points must stay unchanged during the trip. */
export function prepareRoute(path: readonly RoutePoint[]): PreparedRoute {
    const lengths = new Float64Array(Math.max(0, path.length - 1)), angles = new Float64Array(lengths.length);
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
        const dx = path[i].x - path[i - 1].x, dy = path[i].y - path[i - 1].y;
        lengths[i - 1] = Math.hypot(dx, dy);
        angles[i - 1] = Math.atan2(dy, dx);
        distance += lengths[i - 1];
    }
    return {
        path, lengths, angles, distance
    };
}

/** No per-frame allocation or trigonometry; preserve sampleRoute's arithmetic. */
export function samplePreparedRoute(route: PreparedRoute, distance: number, out: RoutePose): RoutePose {
    const { path, lengths, angles } = route;
    for (let i = 1; i < path.length; i++) {
        const length = lengths[i - 1];
        if (distance <= length || i === path.length - 1) {
            const a = path[i - 1], b = path[i], t = length ? Math.max(0, Math.min(1, distance / length)) : 0;
            out.x = a.x + (b.x - a.x) * t;
            out.y = a.y + (b.y - a.y) * t;
            out.angle = angles[i - 1];
            return out;
        }
        distance -= length;
    }
    out.x = path[0].x;
    out.y = path[0].y;
    out.angle = Math.PI / 2;
    return out;
}

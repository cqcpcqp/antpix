// Pre-optimization A*, full-rectangle collision and smoothing.
// Only the closed-side-border rule has been updated; keep the search and
// pixel collision implementation independent of production optimizations.
export function findAntRoute(board, start, target, clearance = 0) {
    const minX = -1, maxX = board.width, minY = 0, maxY = Math.max(board.height + 6, Math.ceil(start.y), Math.ceil(target.y));
    const stride = maxX - minX + 1;
    const id = (x, y) => y * stride + x - minX;
    const point = (i) => ({ x: i % stride + minX, y: Math.floor(i / stride) });
    const free = (x, y) => x >= minX && x <= maxX && y >= minY && y <= maxY &&
        (y >= board.height || x >= 0 && x < board.width && board.pixels[y * board.width + x] < 0);
    const source = { x: Math.round(start.x), y: Math.round(start.y) };
    const goal = { x: Math.round(target.x), y: Math.round(target.y) };
    if (!free(source.x, source.y) || !free(goal.x, goal.y))
        throw new Error('Ant route endpoint is occupied');
    if (clearSegment(board, start, target, clearance))
        return [start, target];
    const sourceId = id(source.x, source.y), goalId = id(goal.x, goal.y);
    const costs = new Map([[sourceId, 0]]), previous = new Map();
    const heap = [];
    const push = (entry) => {
        let i = heap.length;
        heap.push(entry);
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (heap[parent].score <= entry.score)
                break;
            heap[i] = heap[parent];
            i = parent;
        }
        heap[i] = entry;
    };
    const pop = () => {
        const first = heap[0], last = heap.pop();
        if (heap.length) {
            let i = 0;
            while (i * 2 + 1 < heap.length) {
                let child = i * 2 + 1;
                if (child + 1 < heap.length && heap[child + 1].score < heap[child].score)
                    child++;
                if (heap[child].score >= last.score)
                    break;
                heap[i] = heap[child];
                i = child;
            }
            heap[i] = last;
        }
        return first;
    };
    const heuristic = (p) => {
        const dx = Math.abs(p.x - goal.x), dy = Math.abs(p.y - goal.y);
        return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    push({ id: sourceId, score: heuristic(source), cost: 0 });
    while (heap.length) {
        const entry = pop();
        let current = entry.id;
        if (entry.cost !== costs.get(current))
            continue;
        if (current === goalId) {
            const path = [point(current)];
            while (previous.has(current)) {
                current = previous.get(current);
                path.push(point(current));
            }
            path.reverse();
            if (Math.hypot(path[0].x - start.x, path[0].y - start.y) > .001)
                path.unshift(start);
            return smoothRoute(board, path, clearance);
        }
        const p = point(current);
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
                if ((!dx && !dy) || !free(p.x + dx, p.y + dy))
                    continue;
                if (dx && dy && (!free(p.x + dx, p.y) || !free(p.x, p.y + dy)))
                    continue;
                if (clearance > 0 && !clearSegment(board, p, { x: p.x + dx, y: p.y + dy }, clearance))
                    continue;
                const next = id(p.x + dx, p.y + dy), cost = costs.get(current) + Math.hypot(dx, dy);
                if (cost < (costs.get(next) ?? Infinity)) {
                    costs.set(next, cost);
                    previous.set(next, current);
                    push({ id: next, cost, score: cost + heuristic({ x: p.x + dx, y: p.y + dy }) });
                }
            }
    }
    throw new Error('Exposed pixel must have a route to the nest');
}
/** Exact segment/rectangle intersection, including corners: no sampling gaps. */
export function clearSegment(board, a, b, clearance = 0) {
    // Clip the segment against the board-height half-plane, then test both
    // clipped endpoints against the closed sides (independent reference).
    const entranceY = board.height - .5;
    const inBounds = x => x >= -1e-9 && x <= board.width - 1 + 1e-9;
    for (const p of [a, b]) if (p.y < entranceY && !inBounds(p.x)) return false;
    if ((a.y < entranceY) !== (b.y < entranceY)) {
        const t = (entranceY - a.y) / (b.y - a.y);
        if (!inBounds(a.x + t * (b.x - a.x))) return false;
    }
    const dx = b.x - a.x, dy = b.y - a.y, extent = .5 + clearance;
    const left = Math.max(0, Math.ceil(Math.min(a.x, b.x) - extent)), right = Math.min(board.width - 1, Math.floor(Math.max(a.x, b.x) + extent));
    const top = Math.max(0, Math.ceil(Math.min(a.y, b.y) - extent)), bottom = Math.min(board.height - 1, Math.floor(Math.max(a.y, b.y) + extent));
    for (let y = top; y <= bottom; y++)
        for (let x = left; x <= right; x++) {
            if (board.pixels[y * board.width + x] < 0)
                continue;
            let near = 0, far = 1;
            // Slab intersection without allocating nested arrays for every obstacle
            // visited by A* and line-of-sight smoothing. Keep the same tolerances.
            if (Math.abs(dx) < 1e-9) {
                if (a.x < x - extent || a.x > x + extent)
                    continue;
            }
            else {
                const t1 = (x - extent - a.x) / dx, t2 = (x + extent - a.x) / dx;
                near = Math.max(near, Math.min(t1, t2));
                far = Math.min(far, Math.max(t1, t2));
            }
            if (Math.abs(dy) < 1e-9) {
                if (a.y < y - extent || a.y > y + extent)
                    continue;
            }
            else {
                const t1 = (y - extent - a.y) / dy, t2 = (y + extent - a.y) / dy;
                near = Math.max(near, Math.min(t1, t2));
                far = Math.min(far, Math.max(t1, t2));
            }
            if (near <= far)
                return false;
        }
    return true;
}
export function smoothRoute(board, path, clearance = 0) {
    if (path.length < 3)
        return path;
    const result = [path[0]];
    let index = 0;
    while (index < path.length - 1) {
        let next = path.length - 1;
        while (next > index + 1 && !clearSegment(board, path[index], path[next], clearance))
            next--;
        result.push(path[next]);
        index = next;
    }
    return result;
}

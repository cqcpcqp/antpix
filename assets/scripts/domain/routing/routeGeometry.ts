import type { BoardGrid, OccupiedRows, RoutePoint } from './routeTypes';

/** Exact segment/rectangle intersection, including corners: no sampling gaps. */
export function clearSegment(
    board: BoardGrid,
    a: RoutePoint,
    b: RoutePoint,
    clearance = 0,
): boolean {
    return clearSegmentInRows(board, a, b, clearance);
}

export function clearSegmentInRows(
    board: BoardGrid,
    a: RoutePoint,
    b: RoutePoint,
    clearance: number,
    occupied?: OccupiedRows,
): boolean {
    // Side borders are closed above the bottom entrance. Check the entire
    // segment so smoothing and per-frame waiting checks obey the same walls.
    const entranceY = board.height - 0.5;
    if (Math.min(a.y, b.y) < entranceY) {
        const inside = a.y <= b.y ? a : b,
            outside = a.y <= b.y ? b : a;
        const endX =
            outside.y <= entranceY
                ? outside.x
                : inside.x +
                  ((outside.x - inside.x) * (entranceY - inside.y)) / (outside.y - inside.y);
        // World/grid round trips can place a boundary center a few ulps outside.
        if (Math.min(inside.x, endX) < -1e-9 || Math.max(inside.x, endX) > board.width - 1 + 1e-9)
            return false;
    }
    const dx = b.x - a.x,
        dy = b.y - a.y,
        extent = 0.5 + clearance;
    const left = Math.max(0, Math.ceil(Math.min(a.x, b.x) - extent)),
        right = Math.min(board.width - 1, Math.floor(Math.max(a.x, b.x) + extent));
    const top = Math.max(0, Math.ceil(Math.min(a.y, b.y) - extent)),
        bottom = Math.min(board.height - 1, Math.floor(Math.max(a.y, b.y) + extent));
    const vertical = dx > -1e-9 && dx < 1e-9,
        horizontal = dy > -1e-9 && dy < 1e-9;
    for (let y = top; y <= bottom; y++) {
        let nearY = 0,
            farY = 1,
            rowLeft = left,
            rowRight = right;
        if (occupied) {
            if (occupied.first[y] > rowLeft) rowLeft = occupied.first[y];
            if (occupied.last[y] < rowRight) rowRight = occupied.last[y];
            if (rowLeft > rowRight) continue;
        }
        if (horizontal) {
            if (a.y < y - extent || a.y > y + extent) continue;
        } else {
            const t1 = (y - extent - a.y) / dy,
                t2 = (y + extent - a.y) / dy;
            const enter = t1 < t2 ? t1 : t2,
                leave = t1 > t2 ? t1 : t2;
            if (enter > nearY) nearY = enter;
            if (leave < farY) farY = leave;
            if (nearY > farY) continue;
            // Visit the strip crossed in this row, not the entire segment's
            // bounding rectangle. An extra cell on either side keeps this
            // broad phase conservative at floating-point boundary contacts.
            const x1 = a.x + dx * nearY,
                x2 = a.x + dx * farY;
            const stripLeft = Math.ceil((x1 < x2 ? x1 : x2) - extent) - 1;
            const stripRight = Math.floor((x1 > x2 ? x1 : x2) + extent) + 1;
            if (stripLeft > rowLeft) rowLeft = stripLeft;
            if (stripRight < rowRight) rowRight = stripRight;
        }
        for (let x = rowLeft; x <= rowRight; x++) {
            if (board.pixels[y * board.width + x] < 0) continue;
            let near = nearY,
                far = farY;
            if (vertical) {
                if (a.x < x - extent || a.x > x + extent) continue;
            } else {
                const t1 = (x - extent - a.x) / dx,
                    t2 = (x + extent - a.x) / dx;
                const enter = t1 < t2 ? t1 : t2,
                    leave = t1 > t2 ? t1 : t2;
                if (enter > near) near = enter;
                if (leave < far) far = leave;
            }
            if (near <= far) return false;
        }
    }
    return true;
}

export function smoothRoute(board: BoardGrid, path: RoutePoint[], clearance = 0): RoutePoint[] {
    return smoothCheckedRoute(path, (a, b) => clearSegment(board, a, b, clearance));
}

export function smoothCheckedRoute(
    path: RoutePoint[],
    clear: (a: RoutePoint, b: RoutePoint) => boolean,
): RoutePoint[] {
    if (path.length < 3) return path;
    const result = [path[0]];
    let index = 0;
    while (index < path.length - 1) {
        let next = path.length - 1;
        while (next > index + 1 && !clear(path[index], path[next])) next--;
        result.push(path[next]);
        index = next;
    }
    return result;
}

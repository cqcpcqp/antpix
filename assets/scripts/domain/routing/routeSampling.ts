import type { PreparedRoute, RoutePoint, RoutePose } from './routeTypes';

export function routeLength(path: readonly RoutePoint[]): number {
    let total = 0;
    for (let i = 1; i < path.length; i++)
        total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    return total;
}

export function sampleRoute(
    path: readonly RoutePoint[],
    distance: number,
): RoutePoint & {
    angle: number;
} {
    for (let i = 1; i < path.length; i++) {
        const a = path[i - 1],
            b = path[i],
            length = Math.hypot(b.x - a.x, b.y - a.y);
        if (distance <= length || i === path.length - 1) {
            const t = length ? Math.max(0, Math.min(1, distance / length)) : 0;
            return {
                x: a.x + (b.x - a.x) * t,
                y: a.y + (b.y - a.y) * t,
                angle: Math.atan2(b.y - a.y, b.x - a.x),
            };
        }
        distance -= length;
    }
    return { ...path[0], angle: Math.PI / 2 };
}

/** Prepare once per new route. Its points must stay unchanged during the trip. */
export function prepareRoute(path: readonly RoutePoint[]): PreparedRoute {
    const lengths = new Float64Array(Math.max(0, path.length - 1)),
        angles = new Float64Array(lengths.length);
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
        const dx = path[i].x - path[i - 1].x,
            dy = path[i].y - path[i - 1].y;
        lengths[i - 1] = Math.hypot(dx, dy);
        angles[i - 1] = Math.atan2(dy, dx);
        distance += lengths[i - 1];
    }
    return {
        path,
        lengths,
        angles,
        distance,
    };
}

/** No per-frame allocation or trigonometry; preserve sampleRoute's arithmetic. */
export function samplePreparedRoute(
    route: PreparedRoute,
    distance: number,
    out: RoutePose,
): RoutePose {
    const { path, lengths, angles } = route;
    for (let i = 1; i < path.length; i++) {
        const length = lengths[i - 1];
        if (distance <= length || i === path.length - 1) {
            const a = path[i - 1],
                b = path[i],
                t = length ? Math.max(0, Math.min(1, distance / length)) : 0;
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

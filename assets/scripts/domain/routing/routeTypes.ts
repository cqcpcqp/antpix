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

export type TargetCandidate = { pixel: number; approach: RoutePoint };

export type OccupiedRows = { first: number[]; last: number[] };

import { Color, Graphics, Label, Node, Sprite, UIOpacity } from 'cc';
import type { Pickup } from '../domain/game/model';
import type { PreparedRoute, RoutePoint, RoutePose } from '../domain/routing/routing';
import { ISLAND } from './islandTheme';
export const INK = ISLAND.ink,
    MUTED = ISLAND.muted,
    PAPER = ISLAND.paper,
    GREEN = ISLAND.primary;

export const DISPATCH_INTERVAL = 0.5; // Seconds per container at 1× speed.
export const LAUNCH_DURATION = 0.28;
export const ANT_LAUNCH_DURATION = 0.14;

export const color = (hex: string) => new Color(hex);

// Cocos uses upward-positive Y and counterclockwise angles.
// [x, y, angle, scaleX, scaleY, opacity]
export type ContainerPose = readonly [number, number, number, number, number, number];
export const SELECT_POSES: readonly ContainerPose[] = [
    [0, 0, 0, 1, 1, 255],
    [0, 5, 12, 1, 1, 255],
    [0, 0, -5, 1, 1, 255],
    [0, 0, 0, 1, 1, 255],
];
export const ENTRY_POSES: readonly ContainerPose[] = [
    [-30, 38, 25, 0.5, 0.5, 0],
    [-8, 20, 10, 0.9, 0.9, 255],
    [0, -4, -6, 1.05, 0.9, 255],
    [0, 0, 0, 1, 1, 255],
];
export const EXIT_POSES: readonly ContainerPose[] = [
    [0, 0, 0, 1, 1, 255],
    [10, 15, -14, 0.75, 0.75, 255],
    [30, 40, -35, 0.1, 0.1, 0],
];

export interface CardView {
    motion: Node;
    selectElapsed: number;
    node: Node;
    art: Graphics;
    label: Label;
    id: number;
    row: number;
    column: number;
    targetY: number;
    sprite: Sprite;
}

export interface SlotView {
    art: Graphics;
    label: Label;
    id: number;
    container: Node;
    body: Graphics;
    sprite: Sprite;
    color: number;
    launchElapsed: number;
    entryElapsed: number;
    opacity: UIOpacity;
    exit: Node;
    exitBody: Graphics;
    exitSprite: Sprite;
    exitOpacity: UIOpacity;
    exitElapsed: number;
}

export interface AntVisual {
    node: Node;
    frames: Node[];
    cargo: Node;
    color: number;
    frame: number;
    body: Sprite | null;
    cargoSprite: Sprite | null;
    bodyDetail: Sprite | null;
    cargoDetail: Sprite | null;
}

export interface HoldPreview {
    node: Node;
    color: number;
    elapsed: number;
    shown: boolean;
    valid: () => boolean;
}

export interface Celebration {
    elapsed: number;
    art: Node;
    rows: Node[];
    album: Node;
    actions: Node;
    status: Label;
    skip: Node;
}

export interface AntTrip {
    visual: AntVisual;
    pickup: Pickup;
    elapsed: number;
    phase: 'launch' | 'outbound' | 'grasp' | 'return' | 'enter';
    path: RoutePoint[];
    route: PreparedRoute;
    pose: RoutePose;
    gripAngle: number;
    gripTurn: number;
    distance: number;
    lifted: boolean;
    launchOrigin: RoutePoint;
    fromPose: RoutePose;
    toPose: RoutePose;
    fromGrid: RoutePoint;
    toGrid: RoutePoint;
    clearanceBlocked: boolean;
    clearanceRemaining: number;
}

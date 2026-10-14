import type { GardenRuntime } from '../../app/GardenRuntime';
import { ANT_LAUNCH_DURATION } from '../../presentation/gameVisuals';
import type { PreparedRoute, RoutePoint } from '../../domain/routing/routing';
import {
    AntRouteSearch,
    clearSegment,
    findAntRoute,
    prepareRoute,
    samplePreparedRoute,
} from '../../domain/routing/routing';
import {
    BOARD_LEFT,
    BOARD_TOP,
    CELL_SIZE,
    collectionSlotX,
    collectionSlotY,
    gridToWorld,
    NEST,
    worldToGrid,
} from '../../presentation/boardLayout';
import type { AntTrip } from '../../presentation/gameVisuals';

/** Advances trip phases; real pixels govern clearance and lifting. */
export class AntFlights {
    constructor(private readonly game: Pick<GardenRuntime, 'session' | 'ants' | 'layout'>) {}
    flights: AntTrip[] = [];

    readonly returnRouteSearch = new AntRouteSearch();

    /** Reused board view for per-frame route clearance checks. */
    routeBoard = { width: 0, height: 0, pixels: [] as readonly number[] };

    routeHasBlockedSegment(route: PreparedRoute): boolean {
        for (let i = 1; i < route.path.length; i++) {
            const a = route.path[i - 1],
                b = route.path[i];
            if (
                !clearSegment(
                    this.routeBoard,
                    {
                        x: (a.x - BOARD_LEFT) / CELL_SIZE - 0.5,
                        y: (BOARD_TOP - a.y) / CELL_SIZE - 0.5,
                    },
                    {
                        x: (b.x - BOARD_LEFT) / CELL_SIZE - 0.5,
                        y: (BOARD_TOP - b.y) / CELL_SIZE - 0.5,
                    },
                    0.45,
                )
            )
                return true;
        }
        return false;
    }

    updateFlights(dt: number): boolean {
        let arrived = false;
        for (let i = this.flights.length - 1; i >= 0; i--) {
            const trip = this.flights[i];
            const previousElapsed = trip.elapsed;
            trip.elapsed += dt * this.game.session.effectiveSpeed;
            const walk = Math.max(0.8, trip.distance / (trip.phase === 'return' ? 160 : 210));
            if (trip.phase === 'outbound') {
                // A frame that crosses a bend must stop on its waypoint first;
                // the chord between two samples could cut an occupied corner.
                const previousDistance = trip.distance * Math.min(1, previousElapsed / walk);
                let boundary = 0;
                for (const length of trip.route.lengths) {
                    boundary += length;
                    if (boundary > previousDistance + 1e-7) {
                        trip.elapsed = Math.min(trip.elapsed, (boundary / trip.distance) * walk);
                        break;
                    }
                }
                if (trip.clearanceBlocked) {
                    const from = samplePreparedRoute(
                        trip.route,
                        trip.distance * Math.min(1, previousElapsed / walk),
                        trip.fromPose,
                    );
                    const to = samplePreparedRoute(
                        trip.route,
                        trip.distance * Math.min(1, trip.elapsed / walk),
                        trip.toPose,
                    );
                    trip.fromGrid.x = (from.x - BOARD_LEFT) / CELL_SIZE - 0.5;
                    trip.fromGrid.y = (BOARD_TOP - from.y) / CELL_SIZE - 0.5;
                    trip.toGrid.x = (to.x - BOARD_LEFT) / CELL_SIZE - 0.5;
                    trip.toGrid.y = (BOARD_TOP - to.y) / CELL_SIZE - 0.5;
                    if (!clearSegment(this.routeBoard, trip.fromGrid, trip.toGrid, 0.45)) {
                        // Hold at the last safe position until earlier workers
                        // actually clear the reserved corridor. Never tunnel.
                        trip.elapsed = previousElapsed;
                        this.game.ants.updateAntVisual(trip);
                        continue;
                    }
                    // Pixels only disappear during play, so once every segment
                    // is clear this trip no longer needs per-frame scans.
                    // remaining changes on each successful lift, including lifts
                    // earlier in this frame. Reservations and arrivals do not alter obstacles.
                    if (trip.clearanceRemaining !== this.game.session.model.remaining) {
                        trip.clearanceBlocked = this.routeHasBlockedSegment(trip.route);
                        trip.clearanceRemaining = this.game.session.model.remaining;
                    }
                }
            }
            if (trip.phase === 'launch' && trip.elapsed >= ANT_LAUNCH_DURATION) {
                trip.elapsed -= ANT_LAUNCH_DURATION;
                trip.phase = 'outbound';
            } else if (trip.phase === 'outbound' && trip.elapsed >= walk) {
                if (!this.game.session.model.lift(trip.pickup)) {
                    trip.elapsed = walk;
                    this.game.ants.updateAntVisual(trip);
                    continue;
                }
                trip.elapsed = 0;
                trip.phase = 'grasp';
                trip.lifted = true;
                if (trip.lifted) {
                    const row = Math.floor(trip.pickup.pixel / this.game.session.model.level.width);
                    this.game.layout.dirtyRows.add(row);
                    // Removing a block also exposes the lower wall of the
                    // block above it. Right walls stay within the same row.
                    if (row > 0) this.game.layout.dirtyRows.add(row - 1);
                }
                // Other workers may have cleared a shortcut since departure.
                trip.path = this.antRoute(
                    trip.pickup.pixel,
                    true,
                    trip.pickup.slot,
                    trip.pickup.approach,
                );
                trip.route = prepareRoute(trip.path);
                trip.distance = trip.route.distance;
                trip.clearanceBlocked = false;
                const returnAngle = samplePreparedRoute(trip.route, 0, trip.pose).angle;
                trip.gripAngle = Math.atan2(
                    trip.pickup.approach.y -
                        Math.floor(trip.pickup.pixel / this.game.session.model.level.width),
                    (trip.pickup.pixel % this.game.session.model.level.width) -
                        trip.pickup.approach.x,
                );
                trip.gripTurn = Math.atan2(
                    Math.sin(returnAngle - trip.gripAngle),
                    Math.cos(returnAngle - trip.gripAngle),
                );
            } else if (trip.phase === 'grasp' && trip.elapsed >= 0.35) {
                trip.elapsed = 0;
                trip.phase = 'return';
            } else if (trip.phase === 'return' && trip.elapsed >= walk) {
                trip.elapsed = 0;
                trip.phase = 'enter';
            } else if (trip.phase === 'enter' && trip.elapsed >= 0.35) {
                this.game.session.model.arrive(trip.pickup);
                this.game.ants.releaseAnt(trip.visual);
                this.flights.splice(i, 1);
                arrived = true;
                continue;
            }
            this.game.ants.updateAntVisual(trip);
        }
        return arrived;
    }

    antRoute(pixel: number, returning: boolean, slot = 0, contact?: RoutePoint): RoutePoint[] {
        const width = this.game.session.model.level.width;
        const origin = returning
            ? NEST
            : {
                  x: collectionSlotX(slot, this.game.session.model.slots.length),
                  y: collectionSlotY(slot) + 42,
              };
        const nest = worldToGrid(origin);
        const approach = contact ?? this.game.session.model.approachCells(pixel)[0];
        const gridPath = findAntRoute(
            {
                width,
                height: this.game.session.model.level.height,
                pixels: this.game.session.model.pixels,
            },
            nest,
            approach,
            0.45,
            this.returnRouteSearch,
        );
        const world = gridPath.map(gridToWorld);
        return returning ? world.reverse() : world;
    }
}

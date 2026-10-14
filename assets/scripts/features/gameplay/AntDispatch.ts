import type { GardenRuntime } from '../../app/GardenRuntime';
import { DISPATCH_INTERVAL } from '../../presentation/gameVisuals';
import { AntTargetSearch, nearestAntTarget, prepareRoute } from '../../domain/routing/routing';
import {
    collectionSlotX,
    collectionSlotY,
    gridToWorld,
    worldToGrid,
} from '../../presentation/boardLayout';

/** Reserves targets and dispatches independently for each container. */
export class AntDispatch {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'session' | 'containers' | 'motion' | 'flights' | 'ants'
        >,
    ) {}
    dispatchAnts(dt: number) {
        // Each slot dispatches independently at its own interval. In-flight trips
        // reserve jar capacity, but never impose an additional worker-count cap.
        for (let slot = 0; slot < this.game.session.model.slots.length; slot++) {
            const jar = this.game.session.model.slots[slot],
                id = jar?.id ?? -1;
            if (this.dispatchJarIds[slot] !== id) {
                this.dispatchJarIds[slot] = id;
                this.dispatchClocks[slot] = DISPATCH_INTERVAL;
            }
            if (!jar) {
                this.dispatchClocks[slot] = 0;
                continue;
            }
            // Land before releasing ants so their launch origin stays at the rim.
            if (this.game.containers.slotViews[slot].entryElapsed >= 0) continue;
            this.dispatchClocks[slot] = Math.min(
                DISPATCH_INTERVAL,
                this.dispatchClocks[slot] + dt * this.game.session.effectiveSpeed,
            );
            if (this.dispatchClocks[slot] < DISPATCH_INTERVAL) continue;
            const origin = worldToGrid({
                x: collectionSlotX(slot, this.game.session.model.slots.length),
                y: collectionSlotY(slot) + 42,
            });
            const targets = this.game.session.model.availableTargets(slot);
            const assignment = nearestAntTarget(
                {
                    width: this.game.session.model.level.width,
                    height: this.game.session.model.level.height,
                    pixels: this.game.session.model.plannedPixels,
                },
                origin,
                targets,
                0.45,
                this.targetSearch,
            );
            if (!assignment) continue;
            const pickup = this.game.session.model.pick(slot, assignment);
            if (!pickup) continue;
            this.dispatchClocks[slot] = 0;
            this.game.containers.slotViews[slot].launchElapsed = 0;
            if (this.game.session.model.slots[slot]) {
                this.game.containers.slotLabels[slot].string = String(
                    this.game.session.model.undispatched(slot),
                );
                this.game.containers.containerNumber(this.game.containers.slotLabels[slot]);
            } else {
                this.game.motion.startContainerExit(this.game.containers.slotViews[slot], jar);
                this.game.containers.drawSlots();
            }
            const path = assignment.path.map(gridToWorld);
            const route = prepareRoute(path);
            this.game.flights.flights.push({
                visual: this.game.ants.acquireAnt(pickup.color),
                pickup,
                elapsed: 0,
                phase: 'launch',
                path,
                route,
                pose: { x: 0, y: 0, angle: 0 },
                gripAngle: 0,
                gripTurn: 0,
                distance: route.distance,
                lifted: false,
                launchOrigin: {
                    x: collectionSlotX(slot, this.game.session.model.slots.length),
                    y: collectionSlotY(slot) + 25,
                },
                fromPose: { x: 0, y: 0, angle: 0 },
                toPose: { x: 0, y: 0, angle: 0 },
                fromGrid: { x: 0, y: 0 },
                toGrid: { x: 0, y: 0 },
                clearanceBlocked: this.game.flights.routeHasBlockedSegment(route),
                clearanceRemaining: this.game.session.model.remaining,
            });
        }
    }

    targetSearch = new AntTargetSearch();

    dispatchClocks = Array(5).fill(0);

    dispatchJarIds = Array(5).fill(-1);
}

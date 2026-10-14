import { createContainerColumns } from './containerQueue';
import type { Level } from '../levels/levels';
import type { AntTarget } from '../routing/routing';
import { PlannedExposure } from './PlannedExposure';

import type { Jar, Pickup } from './modelTypes';
export type { Jar, Pickup } from './modelTypes';

/** Pure gameplay state: reservation, physical removal and delivery are distinct operations. */
export class GardenModel {
    pixels: number[];
    readonly columns: Jar[][];

    get queue(): Jar[] {
        const result: Jar[] = [];
        const depth = Math.max(...this.columns.map((c) => c.length));
        for (let row = 0; row < depth; row++)
            for (const column of this.columns) if (column[row]) result.push(column[row]);
        return result;
    }

    get visibleQueue(): {
        jar: Jar;
        column: number;
        row: number;
    }[] {
        const result: {
            jar: Jar;
            column: number;
            row: number;
        }[] = [];
        for (let row = 0; row < 2; row++)
            this.columns.forEach((column, index) => {
                if (column[row]) result.push({ jar: column[row], column: index, row });
            });
        return result;
    }
    slots: (Jar | null)[] = Array(5).fill(null);
    remaining: number;
    moves = 0;
    collected = 0;
    private cursor = 0;
    private pending = new Map<number, Pickup>();
    // Task ownership survives the visible slot being released and reused.
    private workingJars = new Map<number, Jar>();
    private exposureDirty = true;
    private reachable = new Set<number>();
    private exposed = new Set<number>();
    private reservations = new Map<number, number>();
    // Grid adjacency is fixed for a level, even as its pixels are removed.
    private neighborCache: number[][] = [];
    private readonly planned: PlannedExposure;
    readonly level: Level;
    private random: () => number;

    constructor(level: Level, random: () => number = Math.random) {
        this.level = level;
        this.random = random;
        this.pixels = [...level.pixels];
        this.remaining = this.pixels.length;
        this.planned = new PlannedExposure(level, this.pixels, this.pending, (pixel) =>
            this.neighbors(pixel),
        );
        this.columns = createContainerColumns(level, this.pixels, random);
        this.shuffle();
    }

    get complete() {
        return (
            this.remaining === 0 && this.pending.size === 0 && this.slots.every((s) => s === null)
        );
    }

    get inFlight() {
        return this.pending.size;
    }

    get finishing() {
        // Once every container is selected, exact per-color capacities cover
        // the remaining board. Full slots alone do not imply a safe finish.
        return !this.complete && this.columns.every((column) => column.length === 0);
    }

    get carrying() {
        let count = 0;
        this.pending.forEach((p) => {
            if (this.pixels[p.pixel] < 0) count++;
        });
        return count;
    }

    private refreshExposure() {
        if (!this.exposureDirty) return;
        this.exposureDirty = false;
        this.reachable.clear();
        this.exposed.clear();
        const { width, height } = this.level,
            queue: number[] = [];
        // The bottom is the entrance. Other outer edges do not expose pixels.
        for (let x = 0; x < width; x++) {
            const p = (height - 1) * width + x;
            if (this.pixels[p] < 0) {
                this.reachable.add(p);
                queue.push(p);
            }
        }
        for (let i = 0; i < queue.length; i++) {
            for (const n of this.neighbors(queue[i])) {
                if (this.pixels[n] < 0 && !this.reachable.has(n)) {
                    this.reachable.add(n);
                    queue.push(n);
                }
            }
        }
        for (let p = 0; p < this.pixels.length; p++) {
            if (
                this.pixels[p] >= 0 &&
                (Math.floor(p / width) === height - 1 ||
                    this.neighbors(p).some((n) => this.reachable.has(n)))
            )
                this.exposed.add(p);
        }
    }

    private neighbors(pixel: number): number[] {
        const cached = this.neighborCache[pixel];
        if (cached) return cached;
        const { width, height } = this.level,
            x = pixel % width,
            y = Math.floor(pixel / width),
            result: number[] = [];
        if (y + 1 < height) result.push(pixel + width);
        if (x > 0) result.push(pixel - 1);
        if (x + 1 < width) result.push(pixel + 1);
        if (y > 0) result.push(pixel - width);
        this.neighborCache[pixel] = result;
        return result;
    }

    get exposedPixels(): number[] {
        this.refreshExposure();
        return Array.from(this.exposed).sort((a, b) => a - b);
    }

    approachCells(pixel: number): {
        x: number;
        y: number;
    }[] {
        this.refreshExposure();
        const { width, height } = this.level,
            result: {
                x: number;
                y: number;
            }[] = [];
        if (Math.floor(pixel / width) === height - 1) result.push({ x: pixel % width, y: height });
        for (const p of this.neighbors(pixel))
            if (this.reachable.has(p)) result.push({ x: p % width, y: Math.floor(p / width) });
        return result;
    }

    get canCollect() {
        return this.nextAssignment() !== null;
    }

    undispatched(slot: number): number {
        const jar = this.slots[slot];
        if (!jar) return 0;
        return jar.remaining - (this.reservations.get(jar.id) ?? 0);
    }

    previewPixels(color: number): number[] {
        // Preview is a whole-picture color lookup, independent of dispatch eligibility.
        const result: number[] = [];
        this.pixels.forEach((c, pixel) => {
            if (c >= 0 && c === color) result.push(pixel);
        });
        return result;
    }

    get blocked() {
        return (
            !this.complete &&
            this.pending.size === 0 &&
            this.slots.every((jar) => jar !== null) &&
            !this.canCollect
        );
    }

    shuffle() {
        if (this.level.containerPlans) {
            // Permute whole stacks, preserving all five precedence chains and the
            // selectable set. Never bury a prerequisite below a later container.
            const stacks = this.columns.map((column) => [...column]);
            for (let i = stacks.length - 1; i > 0; i--) {
                const j = Math.floor(this.random() * (i + 1));
                [stacks[i], stacks[j]] = [stacks[j], stacks[i]];
            }
            this.columns.forEach((column, i) => {
                column.length = 0;
                column.push(...stacks[i]);
            });
            return;
        }
        const jars = this.queue;
        for (let i = jars.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [jars[i], jars[j]] = [jars[j], jars[i]];
        }
        this.columns.forEach((column) => (column.length = 0));
        jars.forEach((jar, index) => this.columns[index % 5].push(jar));
    }

    place(id: number): number {
        const slot = this.slots.indexOf(null);
        if (slot < 0) return -1;
        for (const column of this.columns) {
            const row = column.findIndex((jar) => jar.id === id);
            if (row !== 0) continue;
            // Only this vertical queue advances; empty columns stay empty.
            this.slots[slot] = column.splice(row, 1)[0];
            this.workingJars.set(id, this.slots[slot]!);
            this.moves++;
            return slot;
        }
        return -1;
    }

    private nextAssignment(requestedSlot?: number): {
        pixel: number;
        slot: number;
    } | null {
        const reservations = this.slots.map((jar, slot) =>
            jar === null ? 0 : jar.remaining - this.undispatched(slot),
        );
        this.refreshExposure();
        const exposed = this.exposed;
        // Pick each container's lowest exposed target first, then share workers
        // across containers. A globally lower color must not starve an idle one.
        const candidates: {
            pixel: number;
            slot: number;
        }[] = [];
        const homeColumn = (this.level.width - 1) / 2;
        for (let slot = 0; slot < this.slots.length; slot++) {
            if (requestedSlot !== undefined && slot !== requestedSlot) continue;
            const jar = this.slots[slot];
            if (!jar || jar.remaining <= reservations[slot]) continue;
            let target = -1;
            for (const pixel of exposed) {
                if (this.pending.has(pixel) || this.pixels[pixel] !== jar.color) continue;
                const row = Math.floor(pixel / this.level.width),
                    bestRow = Math.floor(target / this.level.width);
                if (
                    target < 0 ||
                    row > bestRow ||
                    (row === bestRow &&
                        (Math.abs((pixel % this.level.width) - homeColumn) <
                            Math.abs((target % this.level.width) - homeColumn) ||
                            (Math.abs((pixel % this.level.width) - homeColumn) ===
                                Math.abs((target % this.level.width) - homeColumn) &&
                                pixel < target)))
                )
                    target = pixel;
            }
            if (target >= 0) candidates.push({ pixel: target, slot });
        }
        // Fewest active trips first; equally busy slots retain bottom priority,
        // then rotate ties so left/right positions have no scheduling advantage.
        candidates.sort(
            (a, b) =>
                reservations[a.slot] - reservations[b.slot] ||
                Math.floor(b.pixel / this.level.width) - Math.floor(a.pixel / this.level.width) ||
                ((a.slot - this.cursor + this.slots.length) % this.slots.length) -
                    ((b.slot - this.cursor + this.slots.length) % this.slots.length),
        );
        if (candidates.length) return candidates[0];
        return null;
    }

    /** Borrowed, read-only targets; only affected colors/approaches change on reservation. */
    availableTargets(slot: number): readonly AntTarget[] {
        const jar = this.slots[slot];
        if (!jar || this.undispatched(slot) <= 0) return [];
        this.planned.refreshDispatchExposure();
        return this.planned.dispatchTargets.get(jar.color) ?? [];
    }

    /** Dispatch sees already reserved blocks as future empty cells. Rendering,
     * actual routing clearance and lifting continue to use the real pixels. */
    get plannedPixels(): readonly number[] {
        this.planned.refreshDispatchExposure();
        return this.planned.dispatchPixels;
    }

    pick(
        slot?: number,
        selection?: {
            pixel: number;
            approach: {
                x: number;
                y: number;
            };
        },
    ): Pickup | null {
        this.planned.refreshDispatchExposure();
        if (selection) {
            if (
                slot === undefined ||
                !this.slots[slot] ||
                this.undispatched(slot) <= 0 ||
                this.pending.has(selection.pixel) ||
                !this.planned.dispatchExposed.has(selection.pixel) ||
                this.pixels[selection.pixel] !== this.slots[slot]!.color ||
                !this.planned
                    .dispatchApproaches(selection.pixel)
                    .some((p) => p.x === selection.approach.x && p.y === selection.approach.y)
            )
                return null;
        }
        const target = selection
            ? { pixel: selection.pixel, slot: slot! }
            : this.nextAssignment(slot);
        if (!target) return null;
        const jar = this.slots[target.slot]!;
        const pickup = {
            ...target,
            color: jar.color,
            jarId: jar.id,
            approach: selection ? selection.approach : this.approachCells(target.pixel)[0],
        };
        this.pending.set(target.pixel, pickup);
        this.planned.reserveDispatchPixel(target.pixel);
        this.reservations.set(jar.id, (this.reservations.get(jar.id) ?? 0) + 1);
        if (this.undispatched(target.slot) === 0) this.slots[target.slot] = null;
        this.cursor = (target.slot + 1) % this.slots.length;
        return pickup;
    }

    lift(pickup: Pickup): boolean {
        if (this.pending.get(pickup.pixel) !== pickup || this.pixels[pickup.pixel] < 0)
            return false;
        this.refreshExposure();
        // A reserved future target is not physically removable until its
        // chosen contact cell is connected to the real bottom entrance.
        if (
            !this.approachCells(pickup.pixel).some(
                (p) => p.x === pickup.approach.x && p.y === pickup.approach.y,
            )
        )
            return false;
        this.pixels[pickup.pixel] = -1;
        this.exposed.delete(pickup.pixel);
        // Removal only grows connectivity. Flood newly connected empty cells,
        // adding their occupied neighbors, instead of rescanning all 2000 cells.
        const queue = [pickup.pixel];
        this.reachable.add(pickup.pixel);
        for (let i = 0; i < queue.length; i++)
            for (const n of this.neighbors(queue[i])) {
                if (this.pixels[n] >= 0) this.exposed.add(n);
                else if (!this.reachable.has(n)) {
                    this.reachable.add(n);
                    queue.push(n);
                }
            }
        this.remaining--;
        return true;
    }

    arrive(pickup: Pickup): boolean {
        if (this.pending.get(pickup.pixel) !== pickup || this.pixels[pickup.pixel] >= 0)
            return false;
        const jar = this.workingJars.get(pickup.jarId);
        if (!jar) return false;
        this.pending.delete(pickup.pixel);
        const reserved = this.reservations.get(jar.id)! - 1;
        if (reserved === 0) this.reservations.delete(jar.id);
        else this.reservations.set(jar.id, reserved);
        jar.remaining--;
        this.collected++;
        if (jar.remaining === 0) {
            this.workingJars.delete(pickup.jarId);
            return true;
        }
        return false;
    }
}

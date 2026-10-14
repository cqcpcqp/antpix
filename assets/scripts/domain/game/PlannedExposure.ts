import type { Level } from '../levels/levels';
import type { AntTarget } from '../routing/routing';
import type { Pickup } from './model';
/** Predictive connectivity grows on reservation; it never mutates the physical board. */
export class PlannedExposure {
    private readonly level: Level;
    private readonly pixels: number[];
    private readonly pending: ReadonlyMap<number, Pickup>;
    private readonly neighbors: (pixel: number) => number[];
    constructor(
        level: Level,
        pixels: number[],
        pending: ReadonlyMap<number, Pickup>,
        neighbors: (pixel: number) => number[],
    ) {
        this.level = level;
        this.pixels = pixels;
        this.pending = pending;
        this.neighbors = neighbors;
    }
    dispatchInitialized = false;

    dispatchTargets = new Map<number, AntTarget[]>();

    dispatchFlood: number[] = [];

    changedDispatchTargets = new Set<number>();

    dispatchPixels: number[] = [];

    dispatchReachable = new Set<number>();

    dispatchExposed = new Set<number>();

    refreshDispatchExposure() {
        if (this.dispatchInitialized) return;
        this.dispatchInitialized = true;
        this.dispatchPixels = this.pixels.map((color, pixel) =>
            this.pending.has(pixel) ? -1 : color,
        );
        this.dispatchReachable.clear();
        this.dispatchExposed.clear();
        const { width, height } = this.level,
            queue: number[] = [];
        for (let x = 0; x < width; x++) {
            const p = (height - 1) * width + x;
            if (this.dispatchPixels[p] < 0) {
                this.dispatchReachable.add(p);
                queue.push(p);
            }
        }
        for (let i = 0; i < queue.length; i++)
            for (const n of this.neighbors(queue[i]))
                if (this.dispatchPixels[n] < 0 && !this.dispatchReachable.has(n)) {
                    this.dispatchReachable.add(n);
                    queue.push(n);
                }
        for (let p = 0; p < this.pixels.length; p++) {
            if (
                this.dispatchPixels[p] >= 0 &&
                (Math.floor(p / width) === height - 1 ||
                    this.neighbors(p).some((n) => this.dispatchReachable.has(n)))
            ) {
                this.dispatchExposed.add(p);
                this.updateDispatchTarget(p);
            }
        }
    }

    updateDispatchTarget(pixel: number) {
        const color = this.pixels[pixel];
        let targets = this.dispatchTargets.get(color);
        if (!targets) {
            targets = [];
            this.dispatchTargets.set(color, targets);
        }
        // Keep the old ascending pixel order without sorting every color on every pick.
        let left = 0,
            right = targets.length;
        while (left < right) {
            const middle = (left + right) >>> 1;
            if (targets[middle].pixel < pixel) left = middle + 1;
            else right = middle;
        }
        const existing = targets[left]?.pixel === pixel;
        if (!this.dispatchExposed.has(pixel)) {
            if (existing) targets.splice(left, 1);
        } else if (existing) {
            targets[left].approaches = this.dispatchApproaches(pixel);
        } else {
            targets.splice(left, 0, { pixel, approaches: this.dispatchApproaches(pixel) });
        }
    }

    reserveDispatchPixel(pixel: number) {
        // Every reserved target touches the planned bottom-connected region.
        // Opening it can only grow that region, including any newly connected holes.
        this.dispatchPixels[pixel] = -1;
        this.dispatchExposed.delete(pixel);
        this.updateDispatchTarget(pixel);
        const queue = this.dispatchFlood,
            changed = this.changedDispatchTargets;
        queue.length = 0;
        changed.clear();
        this.dispatchReachable.add(pixel);
        queue.push(pixel);
        for (let i = 0; i < queue.length; i++) {
            for (const neighbor of this.neighbors(queue[i])) {
                if (this.dispatchPixels[neighbor] >= 0) {
                    this.dispatchExposed.add(neighbor);
                    changed.add(neighbor);
                } else if (!this.dispatchReachable.has(neighbor)) {
                    this.dispatchReachable.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
        for (const target of changed) this.updateDispatchTarget(target);
    }

    dispatchApproaches(pixel: number): { x: number; y: number }[] {
        const { width, height } = this.level,
            result: { x: number; y: number }[] = [];
        if (Math.floor(pixel / width) === height - 1) result.push({ x: pixel % width, y: height });
        for (const p of this.neighbors(pixel))
            if (this.dispatchReachable.has(p))
                result.push({ x: p % width, y: Math.floor(p / width) });
        return result;
    }
}

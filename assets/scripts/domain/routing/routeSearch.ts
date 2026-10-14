import { clearSegment, clearSegmentInRows } from './routeGeometry';
import type { BoardGrid, OccupiedRows, RoutePoint } from './routeTypes';

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

    clearLine(
        board: BoardGrid,
        a: RoutePoint,
        b: RoutePoint,
        clearance: number,
        origin: RoutePoint,
    ): boolean {
        const from =
            a.x === (a.x | 0) && a.y === (a.y | 0)
                ? a.y * this.gridStride + a.x + 1
                : a.x === origin.x && a.y === origin.y
                  ? this.gridSize
                  : -1;
        const to =
            b.x === (b.x | 0) && b.y === (b.y | 0)
                ? b.y * this.gridStride + b.x + 1
                : b.x === origin.x && b.y === origin.y
                  ? this.gridSize
                  : -1;
        if (from < 0 || to < 0) return clearSegment(board, a, b, clearance);
        // Keep direction in the key, including exact floating-point contact
        // behavior. Only integer search vertices and this query's origin enter.
        const key = from * (this.gridSize + 1) + to;
        const known = this.visibility.get(key);
        if (known !== undefined) return known;
        if (!this.rowsReady) {
            for (let y = 0; y < board.height; y++) {
                let first = board.width,
                    last = -1;
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
        const id = this.heapIds[last],
            score = this.heapScores[last],
            cost = this.heapCosts[last];
        if (last > 0) {
            let i = 0;
            while (i * 2 + 1 < last) {
                let child = i * 2 + 1;
                if (child + 1 < last && this.heapScores[child + 1] < this.heapScores[child])
                    child++;
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

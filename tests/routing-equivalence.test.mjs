import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AntRouteSearch,
  AntTargetSearch,
  findAntRoute,
  nearestAntTarget,
  clearSegment,
  routeLength,
} from '../assets/scripts/domain/routing/routing.ts';
import {
  findAntRoute as reference,
  clearSegment as referenceClear,
} from './fixtures/routing-reference.mjs';

const result = (fn) => {
  try {
    return { path: fn() };
  } catch (error) {
    return { error: error.message };
  }
};

test('row strip collision matches full-rectangle checks including corner contacts and tiny deltas', () => {
  let seed = 193;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let n = 0; n < 25000; n++) {
    const width = 3 + (n % 17),
      height = 3 + (n % 19);
    const board = {
      width,
      height,
      pixels: Array.from({ length: width * height }, () => (random() < 0.18 ? 0 : -1)),
    };
    const a = { x: random() * (width + 4) - 2, y: random() * (height + 4) - 2 };
    const b = { x: random() * (width + 4) - 2, y: random() * (height + 4) - 2 };
    const clearance = [0, 0.45, 0.499999999, 0.5, 0.9, 1.5][n % 6];
    if (n % 7 === 0) b.x = a.x + (n % 2 ? 1e-10 : 0);
    if (n % 11 === 0) b.y = a.y + (n % 2 ? 1e-10 : 0);
    if (n % 13 === 0) {
      a.x = Math.floor(a.x) + 0.5 + clearance;
      b.y = Math.floor(b.y) - 0.5 - clearance;
    }
    assert.equal(
      clearSegment(board, a, b, clearance),
      referenceClear(board, a, b, clearance),
      `forward ${n}`,
    );
    assert.equal(
      clearSegment(board, b, a, clearance),
      referenceClear(board, b, a, clearance),
      `reverse ${n}`,
    );
  }
});

test('integer step shortcut matches exact clearance for every local obstacle arrangement', () => {
  for (let mask = 0; mask < 512; mask++) {
    const board = {
      width: 3,
      height: 3,
      pixels: Array.from({ length: 9 }, (_, i) => (mask & (1 << i) ? 0 : -1)),
    };
    if (board.pixels[4] >= 0) continue;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const free = (x, y) => board.pixels[y * 3 + x] < 0;
        if (!free(1 + dx, 1 + dy)) continue;
        const canStep = !(dx && dy) || (free(1 + dx, 1) && free(1, 1 + dy));
        for (const clearance of [0, 0.01, 0.45, 0.499999999])
          assert.equal(
            clearSegment(board, { x: 1, y: 1 }, { x: 1 + dx, y: 1 + dy }, clearance),
            canStep,
          );
      }
  }
});

test('reused array A* preserves old paths, ties and errors across changing boards and clearances', () => {
  let seed = 71;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const scratch = new AntRouteSearch();
  for (let i = 0; i < 1200; i++) {
    const width = 3 + (i % 14),
      height = 3 + (i % 17);
    const board = {
      width,
      height,
      pixels: Array.from({ length: width * height }, () => (random() < 0.27 ? 0 : -1)),
    };
    const start = {
      x: i % 3 ? Math.floor(random() * width) : width / 2 - 0.5,
      y: height + 2 + (i % 3),
    };
    const target = { x: Math.floor(random() * width), y: Math.floor(random() * height) };
    board.pixels[target.y * width + target.x] = -1;
    const clearance = [0, 0.45, 0.499999999, 0.5, 0.7][i % 5];
    assert.deepEqual(
      result(() => findAntRoute(board, start, target, clearance, scratch)),
      result(() => reference(board, start, target, clearance)),
      `case ${i}`,
    );
    board.pixels.fill(-1);
    assert.deepEqual(
      findAntRoute(board, start, target, clearance, scratch),
      reference(board, start, target, clearance),
    );
  }
});

test('candidate edge cache preserves selection and cannot survive a new board snapshot', () => {
  const search = new AntTargetSearch();
  const choose = (board, start, targets, clearance) => {
    const candidates = targets
      .flatMap((t) =>
        t.approaches.map((approach) => ({
          pixel: t.pixel,
          approach,
          lower: Math.hypot(approach.x - start.x, approach.y - start.y),
        })),
      )
      .sort(
        (a, b) =>
          a.lower - b.lower ||
          a.pixel - b.pixel ||
          a.approach.y - b.approach.y ||
          a.approach.x - b.approach.x,
      );
    let best = null,
      distance = Infinity;
    for (const c of candidates) {
      if (c.lower >= distance - 1e-9) break;
      const path = reference(board, start, c.approach, clearance),
        length = routeLength(path);
      if (length < distance - 1e-9) {
        distance = length;
        best = { pixel: c.pixel, approach: c.approach, path };
      }
    }
    return best;
  };
  for (const width of [9, 13, 9])
    for (const clearance of [0.45, 0, 0.5, 0.45]) {
      const board = { width, height: 12, pixels: Array(width * 12).fill(-1) };
      for (let y = 0; y < 9; y++) board.pixels[y * width + 4] = 0;
      const targets = Array.from({ length: 4 }, (_, i) => ({
        pixel: i,
        approaches: [
          { x: 6, y: i },
          { x: width - 1, y: i },
        ],
      }));
      for (const start of [
        { x: 1, y: 1 },
        { x: 1.3, y: 15 },
        { x: 0, y: 17 },
      ]) {
        assert.deepEqual(
          nearestAntTarget(board, start, targets, clearance, search),
          choose(board, start, targets, clearance),
        );
        board.pixels[7 * width + 4] = -1;
        assert.deepEqual(
          nearestAntTarget(board, start, targets, clearance, search),
          choose(board, start, targets, clearance),
        );
        assert.equal(nearestAntTarget(board, start, [], clearance, search), null);
      }
    }
});

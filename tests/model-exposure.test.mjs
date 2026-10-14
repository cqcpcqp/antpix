import assert from 'node:assert/strict';
import test from 'node:test';
import { GardenModel } from '../assets/scripts/domain/game/model.ts';
import { makeLevel } from '../assets/scripts/domain/levels/levels.ts';
import assertContact from '../scripts/assert-contact.cjs';
import { pickLift, placeColor, seeded, small } from './helpers/model-fixtures.mjs';

test('same-color jars reserve independently and arrivals are idempotent', () => {
  const m = new GardenModel(
    { name: 'test', subtitle: '', width: 6, height: 1, pixels: [1, 1, 1, 1, 1, 1], capacity: 2 },
    seeded(1),
  );
  while (m.queue.length) m.place(m.queue[0].id);
  const pending = [];
  for (let p; (p = pickLift(m));) pending.push(p);
  assert.equal(pending.length, 6);
  assert.equal(m.complete, false);
  assert.equal(pickLift(m), null);
  pending.reverse().forEach((p) => {
    m.arrive(p);
    const collected = m.collected;
    assert.equal(m.arrive(p), false);
    assert.equal(m.collected, collected);
  });
  assert.equal(m.complete, true);
});

test('restart creates independent pixels and pending state', () => {
  const level = makeLevel(0),
    a = new GardenModel(level);
  a.place(a.queue[0].id);
  pickLift(a);
  const b = new GardenModel(level);
  assert.deepEqual(b.pixels, level.pixels);
  assert.equal(b.inFlight, 0);
  assert.equal(b.collected, 0);
});

test('whole-picture preview includes covered and reserved pixels, excluding only removed cells', () => {
  const m = small(2, 3, [1, 1, 1, 2, 1, 2]);
  const before = [...m.pixels];
  assert.deepEqual(m.previewPixels(1), [0, 1, 2, 4]);
  assert.deepEqual(m.previewPixels(2), [3, 5]);
  assert.deepEqual(m.previewPixels(3), []);
  assert.deepEqual(m.pixels, before);
  assert.equal(m.inFlight, 0);
  placeColor(m, 1);
  const p = m.pick();
  assert.equal(p.pixel, 4);
  assert.deepEqual(m.previewPixels(1), [0, 1, 2, 4]);
  m.lift(p);
  assert.deepEqual(m.previewPixels(1), [0, 1, 2]);
  assert.deepEqual(m.previewPixels(2), [3, 5]);
  assert.deepEqual(m.previewPixels(-1), []);
});

test('only the bottom row is exposed at the beginning; top matching color is blocked', () => {
  const m = small(3, 2, [1, 1, 1, 2, 2, 2]);
  assert.deepEqual(m.exposedPixels, [3, 4, 5]);
  placeColor(m, 1);
  assert.equal(pickLift(m), null);
  assert.equal(m.remaining, 6);
  assert.equal(m.canCollect, false);
  assert.equal(m.blocked, false);
});

test('an opened channel exposes neighboring pixels from the side', () => {
  const m = small(2, 3, [3, 3, 1, 1, 2, 4]);
  placeColor(m, 2);
  const bottom = pickLift(m);
  assert.equal(bottom.pixel, 4);
  assert.deepEqual(m.exposedPixels, [2, 5]);
  placeColor(m, 1);
  const middle = pickLift(m);
  assert.equal(middle.pixel, 2);
  assert.deepEqual(m.exposedPixels, [0, 3, 5]);
  assert.equal(m.pixels[3], 1);
  assert.equal(m.pixels[1], 3);
});

test('a three-row game can finish strictly from bottom to top', () => {
  const m = small(2, 3, [3, 3, 2, 2, 1, 1], 2);
  const rows = [];
  for (const c of [1, 2, 3]) {
    placeColor(m, c);
    let p;
    while ((p = pickLift(m))) {
      rows.push(Math.floor(p.pixel / 2));
      m.arrive(p);
    }
  }
  assert.deepEqual(rows, [2, 2, 1, 1, 0, 0]);
  assert.equal(m.complete, true);
});

test('five mismatched containers block, while free slots do not', () => {
  const m = small(5, 2, [1, 2, 3, 4, 5, 6, 6, 6, 6, 6], 5);
  for (const c of [1, 2, 3, 4]) placeColor(m, c);
  assert.equal(m.blocked, false);
  placeColor(m, 5);
  assert.equal(pickLift(m), null);
  assert.equal(m.blocked, true);
});

test('wait for in-flight pixels before declaring blocked, including a slot about to free', () => {
  const m = small(5, 2, [1, 2, 3, 4, 5, 6, 6, 6, 6, 6], 5);
  for (const c of [1, 2, 3, 4, 6]) placeColor(m, c);
  const flights = [];
  let p;
  while ((p = pickLift(m))) flights.push(p);
  assert.equal(m.blocked, false);
  flights.forEach((p) => m.arrive(p));
  assert.equal(m.slots.includes(null), true);
  assert.equal(m.blocked, false);
});

test('dispatch reserves a pixel but removal waits for the ant to reach it', () => {
  const m = small(1, 2, [1, 1], 2);
  placeColor(m, 1);
  const trip = m.pick();
  assert.equal(trip.pixel, 1);
  assert.deepEqual(m.pixels, [1, 1]);
  assert.equal(m.remaining, 2);
  assert.equal(m.carrying, 0);
  assert.equal(m.pick(), null);
  assert.equal(m.arrive(trip), false);
  assert.equal(m.collected, 0);
  assert.equal(m.lift(trip), true);
  assert.equal(m.lift(trip), false);
  assert.deepEqual(m.exposedPixels, [0]);
  assert.equal(m.remaining, 1);
  assert.equal(m.carrying, 1);
  assert.equal(m.slots[0].remaining, 2);
  m.arrive(trip);
  assert.equal(m.collected, 1);
  assert.equal(m.slots[0].remaining, 1);
});

test('lowest exposed row wins over leftmost column for the same color', () => {
  const m = small(2, 3, [1, 1, 1, 1, 1, 1], 6);
  placeColor(m, 1);
  const first = m.pick();
  assert.equal(first.pixel, 4);
  m.lift(first);
  const second = m.pick();
  assert.equal(second.pixel, 5, 'right bottom comes before exposed left middle');
  m.lift(second);
  const third = m.pick();
  assert.equal(third.pixel, 2);
});

test('bottom priority also wins over earlier slot colors', () => {
  const m = small(2, 3, [1, 1, 1, 1, 2, 3], 3);
  placeColor(m, 2);
  const bottom = m.pick();
  m.lift(bottom);
  m.arrive(bottom);
  placeColor(m, 1);
  placeColor(m, 3);
  assert.equal(m.pick().pixel, 5, 'lower right color wins before left upper color');
});

test('two ants cannot reserve the same pixel; stale trips cannot mutate a restarted game', () => {
  const m = small(1, 1, [1]);
  placeColor(m, 1);
  const trip = m.pick();
  assert.equal(m.pick(), null);
  const restarted = small(1, 1, [1]);
  placeColor(restarted, 1);
  assert.equal(restarted.lift(trip), false);
  assert.equal(restarted.arrive(trip), false);
  assert.deepEqual(restarted.pixels, [1]);
});

test('reserved lower jobs do not stall exposed same-color cells in another column', () => {
  const m = small(2, 3, [1, 1, 1, 1, 1, 1], 6);
  placeColor(m, 1);
  const left = m.pick(),
    right = m.pick();
  m.lift(left);
  assert.equal(m.canCollect, true);
  assert.equal(m.blocked, false);
  const next = m.pick();
  assert.equal(next.pixel, 2, 'use idle workers on the exposed left middle');
  assert.equal(m.pick(), null, 'both exposed cells now already have workers');
  m.lift(right);
  assert.equal(m.pick().pixel, 3, 'new lower work still has priority');
});

test('reserved lower jobs do not stall a different matching color in another column', () => {
  const m = small(2, 2, [1, 1, 2, 3], 2);
  placeColor(m, 2);
  placeColor(m, 3);
  placeColor(m, 1);
  const first = m.pick(),
    second = m.pick();
  m.lift(first);
  assert.equal(m.pick().pixel, 0);
  m.lift(second);
  assert.equal(m.pick().pixel, 1);
});

test('in-flight capacity cannot overbook a container even with exposed matching cells', () => {
  const m = small(2, 2, [1, 1, 1, 1], 1);
  placeColor(m, 1);
  const first = m.pick();
  m.lift(first);
  assert.equal(m.pick(), null);
  placeColor(m, 1);
  const second = m.pick();
  assert.equal(second.pixel, 3, 'lowest unassigned cell wins');
  assert.notEqual(first.jarId, second.jarId);
  assert.equal(m.pick(), null);
});

test('unmatched lower color does not lock a reachable higher matching color', () => {
  const m = small(2, 2, [1, 1, 2, 3], 2);
  placeColor(m, 2);
  const p = m.pick();
  m.lift(p);
  m.arrive(p);
  placeColor(m, 1);
  assert.equal(m.pick().pixel, 0);
});

test('same-layer workers balance across matching containers', () => {
  const m = small(10, 1, Array(10).fill(1), 5);
  placeColor(m, 1);
  placeColor(m, 1);
  const jobs = Array.from({ length: 10 }, () => m.pick());
  assert.deepEqual(
    jobs.map((j) => j.slot),
    [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  );
  assert.equal(new Set(jobs.map((j) => j.pixel)).size, 10);
});

test('same-layer distance uses the shared central nest regardless of container slot', () => {
  const m = small(10, 1, Array(10).fill(1), 10);
  placeColor(m, 1);
  // Exercise the same color from the rightmost cave.
  m.slots[4] = m.slots[0];
  m.slots[0] = null;
  assert.equal(m.pick().pixel, 4);
});

test('top-only contact is valid; sealed holes, diagonal gaps and outer edges are not', () => {
  function fixture(holes) {
    const pixels = Array(25).fill(2);
    pixels[12] = 1;
    const m = small(5, 5, pixels, 25);
    for (const p of holes) m.pixels[p] = -1;
    return m;
  }
  const top = fixture([20, 15, 10, 5, 6, 7]);
  placeColor(top, 1);
  const p = top.pick();
  assert.equal(p.pixel, 12);
  assert.deepEqual(p.approach, { x: 2, y: 1 });
  assertContact(top.pixels, 5, 5, p);
  const sealed = fixture([7]);
  assert.ok(!sealed.exposedPixels.includes(12));
  const diagonal = fixture([21, 16]);
  assert.ok(!diagonal.exposedPixels.includes(12));
  const edges = fixture([]);
  assert.deepEqual(edges.exposedPixels, [20, 21, 22, 23, 24]);
});

test('incremental exposure matches independent full flood after every pickup', () => {
  const width = 12,
    height = 15,
    m = small(width, height, Array(width * height).fill(1), 180);
  placeColor(m, 1);
  function oracle() {
    const free = new Set(),
      queue = [];
    for (let x = 0; x < width; x++) {
      const p = (height - 1) * width + x;
      if (m.pixels[p] < 0) {
        free.add(p);
        queue.push(p);
      }
    }
    const neighbors = (p) => {
      const x = p % width,
        y = Math.floor(p / width);
      return [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]
        .filter(([x, y]) => x >= 0 && x < width && y >= 0 && y < height)
        .map(([x, y]) => y * width + x);
    };
    for (let i = 0; i < queue.length; i++)
      for (const p of neighbors(queue[i]))
        if (m.pixels[p] < 0 && !free.has(p)) {
          free.add(p);
          queue.push(p);
        }
    return m.pixels.flatMap((c, p) =>
      c >= 0 && (p >= (height - 1) * width || neighbors(p).some((n) => free.has(n))) ? [p] : [],
    );
  }
  for (let i = 0; i < width * height; i++) {
    assert.deepEqual(m.exposedPixels, oracle());
    const p = m.pick(0);
    assert.ok(p);
    m.lift(p);
    m.arrive(p);
  }
  assert.deepEqual(m.exposedPixels, []);
  assert.equal(m.complete, true);
});

test('planned selection reserves exactly the chosen exposed target and rejects duplicates', () => {
  const m = new GardenModel(
    { name: 'selection', subtitle: '', width: 4, height: 2, pixels: Array(8).fill(0), capacity: 4 },
    () => 0.5,
  );
  m.place(m.visibleQueue.find((v) => v.row === 0).jar.id);
  const targets = m.availableTargets(0);
  assert.deepEqual(targets.map((t) => t.pixel).sort(), [4, 5, 6, 7]);
  const selection = { pixel: 7, approach: { x: 3, y: 2 } };
  const p = m.pick(0, selection);
  assert.equal(p.pixel, 7);
  assert.deepEqual(p.approach, selection.approach);
  assert.equal(m.undispatched(0), 3);
  assert.equal(m.pick(0, selection), null);
  assert.ok(!m.availableTargets(0).some((t) => t.pixel === 7));
  assert.equal(m.pick(0, { pixel: 0, approach: { x: 0, y: 1 } }), null);
  assert.equal(m.pick(0, { pixel: 6, approach: { x: 0, y: 0 } }), null);
  assert.equal(m.undispatched(0), 3);
});

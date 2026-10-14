import assert from 'node:assert/strict';
import test from 'node:test';
import { GardenModel } from '../assets/scripts/domain/game/model.ts';
import { makeLevel } from '../assets/scripts/domain/levels/levels.ts';
import { placeColor, seeded, small } from './helpers/model-fixtures.mjs';

test('selecting a top card advances only its column in original order', () => {
  const m = new GardenModel(makeLevel(0), seeded(1));
  const before = m.columns.map((c) => c.map((j) => j.id));
  const id = m.columns[2][0].id;
  assert.equal(m.place(id), 0);
  assert.deepEqual(
    m.columns[2].map((j) => j.id),
    before[2].slice(1),
  );
  for (const c of [0, 1, 3, 4])
    assert.deepEqual(
      m.columns[c].map((j) => j.id),
      before[c],
    );
  assert.equal(m.visibleQueue.find((v) => v.column === 2 && v.row === 0).jar.id, before[2][1]);
});

test('second-row selection is rejected without mutating columns, slots or moves', () => {
  const m = new GardenModel(makeLevel(0), seeded(2));
  const before = m.columns.map((c) => c.map((j) => j.id));
  for (const column of m.columns) assert.equal(m.place(column[1].id), -1);
  assert.deepEqual(
    m.columns.map((c) => c.map((j) => j.id)),
    before,
  );
  assert.ok(m.slots.every((j) => j === null));
  assert.equal(m.moves, 0);
});

test('second-row card becomes selectable only after its own first-row card is removed', () => {
  const m = new GardenModel(makeLevel(0), seeded(2));
  const first = m.columns[3][0].id,
    second = m.columns[3][1].id;
  assert.equal(m.place(second), -1);
  assert.equal(m.place(first), 0);
  assert.equal(m.place(second), 1);
  assert.equal(m.slots[1].id, second);
});

test('empty columns stay empty and hidden third-row cards cannot be clicked', () => {
  const m = small(15, 1, Array(15).fill(1), 1);
  for (let i = 0; i < 3; i++) m.place(m.columns[0][0].id);
  assert.equal(m.columns[0].length, 0);
  assert.ok(m.visibleQueue.every((v) => v.column !== 0));
  assert.equal(m.place(m.columns[1][2].id), -1);
  assert.equal(
    m.visibleQueue.find((v) => v.column === 1 && v.row === 0).jar.id,
    m.columns[1][0].id,
  );
});

test('manual shuffle preserves every unselected card exactly once', () => {
  const m = new GardenModel(makeLevel(0), seeded(4));
  m.place(m.columns[2][0].id);
  const ids = m.queue.map((j) => j.id).sort((a, b) => a - b);
  m.shuffle();
  assert.deepEqual(
    m.queue.map((j) => j.id).sort((a, b) => a - b),
    ids,
  );
});

test('an idle rightmost color gets a worker even while lower light pixels remain', () => {
  const width = 40,
    upper = Array(width).fill(2);
  upper[19] = 3;
  const m = small(width, 2, [...upper, ...Array(width).fill(2)], 100);
  placeColor(m, 2);
  // Clear the center-bottom cell so dark is exposed above many lower light cells.
  let job;
  do {
    job = m.pick();
    m.lift(job);
    m.arrive(job);
  } while (job.pixel !== width + 19);
  placeColor(m, 3);
  m.slots[4] = m.slots[1];
  m.slots[1] = null;
  const light = m.pick();
  assert.equal(light.color, 2);
  assert.ok(light.pixel >= width);
  const dark = m.pick();
  assert.equal(dark.color, 3, 'lower light jobs must not monopolize workers');
  assert.equal(dark.slot, 4);
  assert.equal(dark.pixel, 19);
});

test('slot-specific dispatch never borrows another container or exceeds its capacity', () => {
  const m = small(4, 2, [1, 1, 1, 1, 2, 2, 2, 2], 2);
  placeColor(m, 1);
  placeColor(m, 2);
  placeColor(m, 2);
  assert.equal(m.pick(0), null, 'covered color must not silently dispatch from a different slot');
  const a = m.pick(1),
    b = m.pick(2);
  assert.equal(a.slot, 1);
  assert.equal(b.slot, 2);
  assert.notEqual(a.pixel, b.pixel);
  m.pick(1);
  assert.equal(m.pick(1), null, 'capacity already reserved');
  m.lift(a);
  assert.equal(m.pick(0).color, 1, 'newly exposed color can launch independently');
  assert.equal(m.pick(4), null, 'empty slot cannot borrow work');
});

test('last dispatch releases the slot immediately, victory waits for delivery', () => {
  const m = small(2, 1, [1, 1], 2);
  placeColor(m, 1);
  assert.equal(m.undispatched(0), 2);
  const a = m.pick(0);
  assert.equal(m.undispatched(0), 1);
  m.lift(a);
  m.arrive(a);
  assert.equal(m.undispatched(0), 1);
  const b = m.pick(0);
  assert.equal(m.undispatched(0), 0);
  assert.equal(m.slots[0], null);
  assert.equal(m.complete, false);
  assert.equal(m.pick(0), null);
  assert.equal(m.undispatched(0), 0);
  m.lift(b);
  assert.equal(m.undispatched(0), 0);
  assert.equal(m.arrive(b), true);
  assert.equal(m.slots[0], null);
  assert.equal(m.complete, true);
  m.arrive(b);
  assert.equal(m.undispatched(0), 0);
});

test('late deliveries belong to departed jars and never change replacements in the same slot', () => {
  const m = small(4, 1, [1, 1, 1, 1], 1);
  const trips = [];
  for (let i = 0; i < 4; i++) {
    placeColor(m, 1);
    assert.ok(m.slots[0]);
    const p = m.pick(0);
    trips.push(p);
    assert.equal(m.slots[0], null);
    assert.equal(m.complete, false);
  }
  trips.reverse().forEach((p, i) => {
    assert.equal(m.lift(p), true);
    assert.equal(m.arrive(p), true);
    assert.equal(m.arrive(p), false);
    assert.equal(m.collected, i + 1);
  });
  assert.equal(m.complete, true);
  const n = small(3, 1, [1, 1, 1], 1);
  placeColor(n, 1);
  const old = n.pick(0);
  placeColor(n, 1);
  const next = n.slots[0];
  n.lift(old);
  n.arrive(old);
  assert.equal(n.slots[0], next);
  assert.equal(n.undispatched(0), 1);
});

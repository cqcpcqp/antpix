import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLevel, LEVEL_COUNT } from '../assets/scripts/levels.ts';
import { GardenModel } from '../assets/scripts/model.ts';
import {
  encodeContainerPlan,
  planContainers,
  distributeColumns,
  selectLayout,
  colorClosure,
} from '../scripts/container-planner.mjs';
import { settleContainers, simulatePlan } from '../scripts/container-simulation.mjs';

test('explicit columns preserve prerequisites through permutation and independent advancement', () => {
  const level = {
    name: 'columns',
    subtitle: '',
    width: 2,
    height: 2,
    pixels: [1, 1, 0, 0],
    capacity: 2,
    containerPlans: [
      [
        [0, 2, 4],
        [1, 2, 4],
      ],
    ],
  };
  const m = new GardenModel(level, () => 0.5);
  assert.equal(m.columns.filter((c) => c.length).length, 1);
  assert.equal(m.place(1), -1);
  assert.equal(m.place(0), 0);
  settleContainers(m, true);
  m.shuffle();
  assert.equal(m.place(1), 0);
  settleContainers(m, true);
  assert.equal(m.complete, true);
});

test('cross-color witness holds one slot and releases it after another color opens a route', () => {
  const level = {
    name: 'dependency',
    subtitle: '',
    width: 2,
    height: 3,
    pixels: [1, 2, 2, 2, 1, 1],
    capacity: 3,
  };
  const plan = [
    [1, 3, 2],
    [2, 3, 4],
  ];
  const m = new GardenModel({ ...level, containerPlans: [plan] }, () => 0);
  m.place(0);
  assert.equal(settleContainers(m, true), 2);
  assert.equal(m.slots[0].remaining, 1);
  assert.equal(m.place(1), 1);
  assert.equal(settleContainers(m, true), 4);
  assert.equal(m.complete, true);
  assert.equal(simulatePlan(level, plan, { policy: 'witness', nearest: true }).maxStalled, 1);
});

test('single-container construction is deterministic, exact and replayable', () => {
  const level = {
    name: 'planning',
    subtitle: '',
    width: 4,
    height: 4,
    pixels: [2, 2, 1, 1, 2, 3, 3, 1, 0, 0, 3, 3, 0, 0, 0, 0],
    capacity: 3,
  };
  const a = planContainers(level, 19),
    b = planContainers(level, 19);
  assert.deepEqual(a, b);
  const plan = distributeColumns(a.jars, 91);
  for (const color of new Set(level.pixels))
    assert.equal(
      plan.filter((j) => j[0] === color).reduce((s, j) => s + j[1], 0),
      level.pixels.filter((c) => c === color).length,
    );
  assert.ok(plan.every((j) => j[1] > 0 && j[1] <= level.capacity));
  assert.ok(simulatePlan(level, plan, { policy: 'witness', nearest: true }).win);
});

test('closure only enters from the bottom and uses four-way connectivity', () => {
  assert.deepEqual(colorClosure([1, 1, 2, 2, 0, 0], 2, 3, 1), []);
  assert.deepEqual(colorClosure([1, 2, 2, 1], 2, 2, 1), [3]);
});

test('layout reserves two ready opening columns without hiding the witness', () => {
  const jars = [
    [0, 2],
    [1, 2],
    [0, 2],
    [2, 2],
    [3, 2],
    [4, 2],
  ];
  const plan = distributeColumns(jars, 31, 9, 2);
  assert.notEqual(plan[0][2], plan[2][2]);
  const columns = Array.from({ length: 5 }, () => []);
  plan.forEach((jar, id) => columns[jar[2]].push(id));
  for (let id = 0; id < plan.length; id++) {
    const column = columns.find((c) => c[0] === id);
    assert.ok(column);
    column.shift();
  }
});

test('reserved opening column does not prevent long intervening sequences from being assigned', () => {
  const jars = [[0, 1], ...Array.from({ length: 80 }, (_, i) => [1 + (i % 4), 1]), [0, 1]];
  const plan = distributeColumns(jars, 4, 3, 2);
  assert.equal(plan.length, jars.length);
  assert.notEqual(plan[0][2], plan.at(-1)[2]);
});

test('saved early, middle and late plans reproduce with the current generator', () => {
  for (const index of [0, 49, 99]) {
    const level = makeLevel(index),
      difficulty = index / (LEVEL_COUNT - 1),
      seed = 1009;
    const { jars } = planContainers(level, seed, difficulty);
    assert.deepEqual(selectLayout(level, jars, seed, difficulty).plan, level.containerPlans[0]);
  }
});

test('compact encoding represents every legal entry in two distinct ASCII bytes', () => {
  const swatches = Array.from({ length: 24 }, (_, i) => i),
    encoded = new Set();
  for (const color of swatches)
    for (let count = 1; count <= 40; count++)
      for (let column = 0; column < 5; column++) {
        const value = encodeContainerPlan([[color, count, column]], swatches);
        assert.equal(Buffer.byteLength(value), 2);
        assert.equal(JSON.stringify(value).length, 4, 'packing must not need JSON escaping');
        encoded.add(value);
      }
  assert.equal(encoded.size, 24 * 40 * 5);
  assert.throws(() => encodeContainerPlan([[0, 41, 0]], swatches));
  assert.throws(() => encodeContainerPlan([[0, 1, 5]], swatches));
});

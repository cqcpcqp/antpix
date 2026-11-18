import test from 'node:test';
import { createRequire } from 'node:module';
import { fixture } from './helpers/cloud-game.mjs';
const require = createRequire(import.meta.url);
const { levels } = require('../cloudfunctions/game/catalog.json');
import assert from 'node:assert/strict';
import { GardenModel } from '../assets/scripts/domain/game/model.ts';
import { makeLevel } from '../assets/scripts/domain/levels/levels.ts';
import { settleContainers } from '../scripts/container-simulation.mjs';

test('initial empty cells are routes, never jars, pickups or outstanding work', () => {
  const level = {
    name: 'isolated center',
    subtitle: '',
    width: 5,
    height: 5,
    capacity: 2,
    pixels: [
      -1, -1, -1, -1, -1, -1, 0, 0, 1, -1, -1, 0, -1, 1, -1, -1, 0, 1, 1, -1, -1, -1, -1, -1, -1,
    ],
  };
  const model = new GardenModel(level, () => 0);
  assert.equal(model.totalPixels, 8);
  assert.equal(model.remaining, 8);
  assert.equal(
    model.queue.reduce((sum, jar) => sum + jar.capacity, 0),
    8,
  );
  assert.ok(model.queue.every((jar) => jar.color >= 0));
  assert.deepEqual(model.exposedPixels, [6, 7, 8, 11, 13, 16, 17, 18]);
  while (model.queue.length) {
    assert.ok(model.place(model.queue[0].id) >= 0);
    settleContainers(model, true);
  }
  assert.equal(model.collected, 8);
  assert.equal(model.totalPixels, 8);
  assert.equal(model.complete, true);
  assert.deepEqual(model.level.pixels, level.pixels);
});

test('approved tutorials use exact foreground counts with increasing collection work', () => {
  for (const [index, colors, cells] of [
    [0, 3, 158],
    [1, 4, 400],
    [2, 6, 836],
  ]) {
    const level = makeLevel(index);
    assert.equal(level.tutorial, true);
    assert.equal(level.colors, colors);
    assert.equal(level.pixels.filter((color) => color >= 0).length, cells);
    assert.equal(level.pixels.filter((color) => color === -1).length, 2880 - cells);
    assert.ok(level.containerPlans.every((plan) => plan.every(([color]) => color >= 0)));
  }
  assert.equal(makeLevel(3).id, 'rainy-day');
  assert.ok(makeLevel(3).pixels.every((color) => color >= 0));
});

test('cloud accepts quick tutorial completions with their new container counts', async () => {
  const f = fixture();
  await f.call('login');
  for (let level = 0; level < 3; level++) {
    const start = await f.call('start', { level });
    f.advance(15000);
    assert.ok(levels[level].minimumSeconds < 15);
    const result = await f.call('complete', {
      runId: start.output.runId,
      seconds: 15,
      moves: levels[level].moves[0],
    });
    assert.equal(result.ok, true);
    assert.ok(result.profile.completed.includes(level));
  }
});

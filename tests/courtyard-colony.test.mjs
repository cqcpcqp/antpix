import test from 'node:test';
import assert from 'node:assert/strict';
import { CourtyardColony } from '../assets/scripts/domain/courtyard/courtyardColony.ts';

function simulate(colony, living, garden, hour, seconds) {
  const rests = new Set();
  for (let i = 0; i < seconds * 60; i++) {
    colony.update(1 / 60, living, garden, hour);
    if (colony.resident.action === 'rest') rests.add(colony.resident.activity);
  }
  return rests;
}

test('Lili visits the chair and takes other stops during an outing', () => {
  const colony = new CourtyardColony(() => 0.5);
  const seen = simulate(colony, 'leaf-bed', '', 12, 150);
  assert.ok(seen.has('chair'));
  assert.ok(seen.has('look'));
});

test('Lili drinks and looks at her reflection, then leaves when the pond is removed', () => {
  const colony = new CourtyardColony(() => 0.5);
  const seen = simulate(colony, 'dew-pond', '', 12, 75);
  assert.ok(seen.has('drink'));
  assert.ok(seen.has('mirror'));
  assert.ok(['mirror', 'drink'].includes(colony.resident.activity));
  colony.update(1 / 60, '', '', 12);
  assert.ok(!['drink', 'mirror'].includes(colony.resident.activity));
});

test('lantern visits stop at dawn or when the garden is removed', () => {
  for (const [garden, hour] of [
    ['lantern-garden', 6],
    ['', 22],
  ]) {
    const colony = new CourtyardColony(() => 0.5);
    assert.ok(simulate(colony, '', 'lantern-garden', 22, 12).has('lantern'));
    colony.update(1 / 60, '', garden, hour);
    assert.notEqual(colony.resident.activity, 'lantern');
  }
});

test('feeding holds Lili at her current position without pausing the scenery', () => {
  const colony = new CourtyardColony(() => 0.5);
  simulate(colony, '', '', 12, 3);
  const { resident } = colony;
  assert.equal(resident.action, 'walk');
  const before = [resident.x, resident.y, resident.elapsed];
  const time = colony.elapsed;
  colony.update(0.05, '', '', 12, true);
  assert.deepEqual([resident.x, resident.y, resident.elapsed], before);
  assert.ok(colony.elapsed > time);
  colony.update(0.05, '', '', 12);
  assert.ok(resident.elapsed > before[2]);
});

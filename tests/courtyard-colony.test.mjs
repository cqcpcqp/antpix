import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CourtyardColony,
  FEEDING_SPOT,
} from '../assets/scripts/domain/courtyard/courtyardColony.ts';

function simulate(colony, living, garden, seconds) {
  const rests = new Set();
  for (let i = 0; i < seconds * 60; i++) {
    colony.update(1 / 60, living, garden);
    if (colony.resident.action === 'rest') rests.add(colony.resident.activity);
  }
  return rests;
}

test('Lili visits the chair and takes other stops during an outing', () => {
  const colony = new CourtyardColony(() => 0.5);
  const seen = simulate(colony, 'leaf-bed', '', 150);
  assert.ok(seen.has('chair'));
  assert.ok([...seen].some((activity) => activity !== 'chair'));
});

test('Lili drinks and looks at her reflection, then leaves when the pond is removed', () => {
  const colony = new CourtyardColony(() => 0.5);
  const seen = simulate(colony, 'dew-pond', '', 75);
  assert.ok(seen.has('drink'));
  assert.ok(seen.has('mirror'));
  for (
    let frame = 0;
    frame < 90 * 60 && !['drink', 'mirror'].includes(colony.resident.activity);
    frame++
  )
    colony.update(1 / 60, 'dew-pond', '');
  assert.ok(['mirror', 'drink'].includes(colony.resident.activity));
  colony.update(1 / 60, '', '');
  assert.ok(!['drink', 'mirror'].includes(colony.resident.activity));
});

test('a longer outing rotates through hobbies and sometimes asks for a share', () => {
  const colony = new CourtyardColony(() => 0.5);
  const { resident } = colony;
  const seen = new Set();
  const lines = new Set();
  const returns = [];
  for (let frame = 0; frame < 420 * 60; frame++) {
    const before = [resident.x, resident.y, resident.action];
    colony.update(1 / 60, '', '');
    if (resident.action === 'run') {
      seen.add('run');
      assert.ok(Math.hypot(resident.x - before[0], resident.y - before[1]) < 4);
    }
    if (resident.action === 'return' && before[2] !== 'return') returns.push(frame / 60);
    if (resident.action !== 'rest') continue;
    seen.add(resident.activity);
    if (resident.plan?.speech) lines.add(resident.plan.speech);
  }
  for (const activity of ['run', 'exercise', 'read', 'news', 'game', 'sleep', 'talk'])
    assert.ok(seen.has(activity), `missing ${activity}`);
  assert.ok(lines.size >= 2 && lines.has('主人，帮我分享下吧'));
  assert.ok(returns.length >= 1 && returns[0] > 120);
});

test('removing the seed pantry ends its visit immediately', () => {
  const colony = new CourtyardColony(() => 0.5);
  assert.ok(simulate(colony, 'seed-pantry', '', 13).has('pantry'));
  colony.update(1 / 60, '', '');
  assert.notEqual(colony.resident.activity, 'pantry');
});

test('lantern visits end when the furnishing is removed', () => {
  const colony = new CourtyardColony(() => 0.5);
  assert.ok(simulate(colony, '', 'lantern-garden', 12).has('lantern'));
  colony.update(1 / 60, '', '');
  assert.notEqual(colony.resident.activity, 'lantern');
});

test('feeding holds Lili at her current position without pausing the scenery', () => {
  const colony = new CourtyardColony(() => 0.5);
  simulate(colony, '', '', 3);
  const { resident } = colony;
  assert.equal(resident.action, 'walk');
  const before = [resident.x, resident.y, resident.elapsed];
  const time = colony.elapsed;
  colony.update(0.05, '', '', true);
  assert.deepEqual([resident.x, resident.y, resident.elapsed], before);
  assert.ok(colony.elapsed > time);
  colony.update(0.05, '', '');
  assert.ok(resident.elapsed > before[2]);
});

test('courtyard strolls rotate furnishings and do not revisit either of the last two sites', () => {
  const colony = new CourtyardColony(() => 0.5);
  const seen = new Set();
  const places = [];
  let last;
  for (let i = 0; i < 180 * 60; i++) {
    colony.update(1 / 60, 'dew-pond', 'lantern-garden');
    const { plan, action } = colony.resident;
    if (action !== 'rest' || !plan || plan === last) continue;
    last = plan;
    const place = `${plan.x},${plan.y}`;
    assert.ok(!places.slice(-2).includes(place));
    assert.ok(plan.restSeconds >= 3 && plan.restSeconds <= 9);
    places.push(place);
    seen.add(plan.activity);
  }
  assert.ok(seen.has('drink') && seen.has('mirror') && seen.has('lantern'));
  assert.ok(places.length > 10);
});

test('Lili goes to the bowl when hungry and keeps the same route when fed on the way', () => {
  const colony = new CourtyardColony(() => 0.5);
  const hungry = { hungry: true, tired: false, happy: false };
  for (let frame = 0; frame < 3 * 60; frame++) colony.update(1 / 60, 'leaf-bed', '', false, hungry);
  const { resident } = colony;
  assert.equal(resident.activity, 'hungry');
  assert.equal(resident.action, 'walk');
  assert.ok(Math.hypot(resident.plan.x - FEEDING_SPOT.x, resident.plan.y - FEEDING_SPOT.y) < 60);
  const state = [resident.x, resident.y, resident.elapsed, resident.plan];
  colony.update(0.05, 'leaf-bed', '', true, { ...hungry, hungry: false });
  assert.equal(resident.activity, 'look');
  assert.deepEqual([resident.x, resident.y, resident.elapsed, resident.plan], state);
  colony.update(0.05, 'leaf-bed', '');
  assert.ok(resident.elapsed > state[2]);
});

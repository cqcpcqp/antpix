import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { load } = require('../scripts/headless-game.cjs');
const { CourtyardColony } = load(
  process.cwd() + '/assets/scripts/domain/courtyard/courtyardColony.ts',
);
const tick = (c, seconds, living = '', garden = '', hour = 12, inspect = () => {}) => {
  for (let i = 0; i < seconds * 60; i++) {
    c.update(1 / 60, living, garden, hour);
    inspect(c);
  }
};
test('all three residents finish outings; one chair is reserved at a time', () => {
  const c = new CourtyardColony(() => 0.5),
    seen = [new Set(), new Set(), new Set()];
  tick(c, 240, 'leaf-bed', '', 12, () => {
    c.residents.forEach((r, i) => seen[i].add(r.action));
    assert.ok(
      c.residents.filter((r) => r.chair && ['walk', 'sit', 'rest', 'rise'].includes(r.action))
        .length <= 1,
    );
  });
  for (const phases of seen)
    for (const p of ['emerge', 'walk', 'rest', 'return', 'enter']) assert.ok(phases.has(p), p);
});
test('pond offers distinct interactions and removal releases both occupants', () => {
  const c = new CourtyardColony(() => 0.5),
    seen = new Set();
  tick(c, 90, 'dew-pond', '', 12, () => {
    for (const r of c.residents) if (r.action === 'rest') seen.add(r.activity);
  });
  assert.ok(seen.has('drink'));
  assert.ok(seen.has('mirror'));
  tick(c, 1, '');
  assert.ok(c.residents.every((r) => !['drink', 'mirror'].includes(r.activity)));
});
test('seed requires two ready workers, moves continuously with both, and cancels on removal', () => {
  const c = new CourtyardColony(() => 0.5);
  let carrying = 0,
    lowered = false;
  tick(c, 180, 'seed-pantry', '', 12, () => {
    if (c.seedPhase === 'carry') {
      carrying++;
      const [a, b] = c.residents;
      assert.equal(a.activity, 'seed');
      assert.equal(b.activity, 'seed');
      assert.ok(Math.abs(b.x - a.x - 64) < 1e-6);
      assert.equal(a.y, b.y);
      assert.ok(Math.abs((a.x + b.x) / 2 - c.seedX) < 1e-6);
    }
    lowered ||= c.seedPhase === 'lower';
  });
  assert.ok(carrying > 0);
  assert.ok(lowered);
  tick(c, 1, '');
  assert.equal(c.seedPhase, 'idle');
  assert.ok(c.residents.every((r) => r.activity !== 'seed'));
});
test('night gatherings require placed lanterns and end at dawn or removal', () => {
  for (const end of ['dawn', 'removed']) {
    const c = new CourtyardColony(() => 0.5);
    const seen = new Set();
    tick(c, 70, '', 'lantern-garden', 22, () => {
      c.residents.forEach((r, i) => {
        if (r.action === 'rest' && r.activity === 'party') seen.add(i);
      });
    });
    assert.equal(seen.size, 3);
    tick(c, 1, '', end === 'removed' ? '' : 'lantern-garden', end === 'dawn' ? 9 : 22);
    assert.ok(c.residents.every((r) => r.activity !== 'party'));
  }
});
test('rapid furniture swaps and long frames never teleport residents or leave stale interactions', () => {
  const c = new CourtyardColony(() => 0.5);
  const choices = ['leaf-bed', 'dew-pond', 'seed-pantry', ''];
  for (let i = 0; i < 12000; i++) {
    const before = c.residents.map((r) => [r.x, r.y]);
    c.update(i % 200 === 0 ? 300 : 1 / 60, choices[Math.floor(i / 400) % 4], '', 12);
    c.residents.forEach((r, id) => {
      assert.ok(Math.hypot(r.x - before[id][0], r.y - before[id][1]) < 4);
      assert.ok(Number.isFinite(r.x));
    });
  }
});

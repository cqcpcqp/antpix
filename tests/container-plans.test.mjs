import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { makeLevel, LEVEL_COUNT } from '../assets/scripts/domain/levels/levels.ts';
import { GardenModel } from '../assets/scripts/domain/game/model.ts';
import { settleContainers } from '../scripts/container-simulation.mjs';
const report = JSON.parse(
  readFileSync(new URL('../art/container-plan-report.json', import.meta.url)),
);
for (let index = 0; index < LEVEL_COUNT; index++)
  test(`level ${index + 1}: all planned variants solve with real nearest-path pickup`, () => {
    const level = makeLevel(index);
    assert.equal(
      report[index].sourceHash,
      createHash('sha256').update(JSON.stringify(level.pixels)).digest('hex'),
      'regenerate plans when artwork changes',
    );
    assert.equal(level.containerPlans.length, 3);
    for (let variant = 0; variant < 3; variant++) {
      const plan = level.containerPlans[variant],
        m = new GardenModel(level, () => (variant + 0.1) / 3);
      const counts = new Map();
      for (const [c, n, column] of plan) {
        assert.ok(Number.isInteger(column) && column >= 0 && column < 5);
        assert.ok(n >= 1 && n <= 40);
        counts.set(c, (counts.get(c) || 0) + n);
      }
      for (const c of new Set(level.pixels))
        assert.equal(counts.get(c), level.pixels.filter((p) => p === c).length);
      assert.equal(
        report[index].variants[variant].planHash,
        createHash('sha256').update(JSON.stringify(plan)).digest('hex'),
      );
      let collected = 0;
      for (let id = 0; id < plan.length; id++) {
        if (id % 7 === 0) {
          const before = m.columns.map((c) => c.map((j) => j.id).join(',')).sort();
          m.shuffle();
          assert.deepEqual(m.columns.map((c) => c.map((j) => j.id).join(',')).sort(), before);
        }
        const head = m.columns.map((c) => c[0]).find((j) => j?.id === id);
        assert.ok(head, 'witness must only select column heads');
        const slot = m.place(id);
        assert.ok(slot >= 0, 'five basic slots must suffice');
        collected += settleContainers(m, true);
        assert.ok(m.slots.filter(Boolean).length <= 1, 'at most one unresolved witness dependency');
      }
      assert.equal(collected, level.pixels.length);
      assert.equal(m.complete, true);
      assert.equal(m.inFlight, 0);
    }
  });

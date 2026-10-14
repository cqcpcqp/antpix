import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { makeLevel, LEVEL_COUNT } from '../assets/scripts/levels.ts';
import { GardenModel } from '../assets/scripts/model.ts';
import { nearestAntTarget } from '../assets/scripts/routing.ts';
import headless from '../scripts/headless-game.cjs';
const { worldToGrid, collectionSlotX, collectionSlotY } = headless.load(
  new URL('../assets/scripts/boardLayout.ts', import.meta.url).pathname,
);
import { colorClosure } from '../scripts/container-planner.mjs';
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
      for (const [c, n] of plan) {
        assert.ok(n >= 1 && n <= 40);
        counts.set(c, (counts.get(c) || 0) + n);
      }
      for (const c of new Set(level.pixels))
        assert.equal(counts.get(c), level.pixels.filter((p) => p === c).length);
      let collected = 0;
      for (let id = 0; id < plan.length; id++) {
        if (id % 7 === 0) {
          const before = m.columns.map((c) => c.map((j) => j.id).join(',')).sort();
          m.shuffle();
          assert.deepEqual(m.columns.map((c) => c.map((j) => j.id).join(',')).sort(), before);
        }
        const head = m.columns.map((c) => c[0]).find((j) => j?.id === id);
        assert.ok(head, 'witness must only select column heads');
        assert.ok(
          colorClosure(m.pixels, level.width, level.height, head.color).length >= head.capacity,
          'each witness container can finish without needing a sixth slot',
        );
        const slot = m.place(id);
        assert.equal(slot, 0);
        for (let n = 0; n < head.capacity; n++) {
          const selected = nearestAntTarget(
            { width: level.width, height: level.height, pixels: m.pixels },
            worldToGrid({
              x: collectionSlotX(slot, m.slots.length),
              y: collectionSlotY(slot) + 42,
            }),
            m.availableTargets(slot),
          );
          assert.ok(selected);
          const p = m.pick(slot, selected);
          assert.ok(p);
          assert.ok(m.lift(p));
          m.arrive(p);
          collected++;
        }
        assert.equal(m.slots[slot], null);
      }
      assert.equal(collected, level.pixels.length);
      assert.equal(m.complete, true);
      assert.equal(m.inFlight, 0);
    }
  });

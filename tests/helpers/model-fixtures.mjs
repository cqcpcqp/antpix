import assert from 'node:assert/strict';
import { GardenModel } from '../../assets/scripts/domain/game/model.ts';
export function pickLift(m) {
  const p = m.pick();
  if (p) assert.equal(m.lift(p), true);
  return p;
}

export function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function small(width, height, pixels, capacity = 1) {
  return new GardenModel(
    { name: 'exposure', subtitle: '', width, height, pixels, capacity },
    seeded(3),
  );
}

export function placeColor(m, color) {
  let jar = m.columns.map((c) => c[0]).find((j) => j?.color === color);
  for (let tries = 0; !jar && tries < 100; tries++) {
    m.shuffle();
    jar = m.columns.map((c) => c[0]).find((j) => j?.color === color);
  }
  assert.ok(jar);
  assert.ok(m.place(jar.id) >= 0);
}

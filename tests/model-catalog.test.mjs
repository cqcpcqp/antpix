import assert from 'node:assert/strict';
import test from 'node:test';
import { GardenModel } from '../assets/scripts/domain/game/model.ts';
import { LEVEL_COUNT, makeLevel, PALETTE } from '../assets/scripts/domain/levels/levels.ts';
import assertContact from '../scripts/assert-contact.cjs';
import { pickLift, seeded } from './helpers/model-fixtures.mjs';

for (let level = 0; level < LEVEL_COUNT; level++) {
  test(`level ${level + 1}: palette and exact per-color capacity`, () => {
    const l = makeLevel(level),
      m = new GardenModel(l, seeded(1));
    assert.equal(l.width, 48);
    assert.equal(l.height, 60);
    assert.equal(l.pixels.length, 2880);
    assert.ok(new Set(l.pixels).size <= 24);
    const counts = Array(PALETTE.length).fill(0),
      capacity = [...counts];
    l.pixels.forEach((c) => {
      assert.ok(c >= 0 && c < PALETTE.length);
      counts[c]++;
    });
    m.queue.forEach((j) => {
      assert.ok(j.capacity > 0);
      capacity[j.color] += j.capacity;
    });
    assert.deepEqual(capacity, counts);
  });
  test(`level ${level + 1}: 25 randomized games respect reachable contact and terminate`, () => {
    for (let seed = 1; seed <= 25; seed++) {
      const random = seeded(seed),
        m = new GardenModel(makeLevel(level), random),
        flights = [],
        seen = new Set();
      let steps = 0;
      while (!m.complete && !m.blocked && steps++ < 10000) {
        if (random() < 0.08) m.shuffle();
        if (m.queue.length && m.slots.includes(null)) {
          const visible = m.visibleQueue.filter((v) => v.row === 0);
          const j = visible[Math.floor(random() * visible.length)].jar;
          assert.ok(m.place(j.id) >= 0);
        }
        for (let i = 0; i < 7; i++) {
          const before = [...m.pixels];
          const p = pickLift(m);
          if (p) {
            assertContact(before, m.level.width, m.level.height, p);
            assert.ok(!seen.has(p.pixel));
            seen.add(p.pixel);
            flights.push(p);
          }
        }
        if (flights.length) {
          const i = Math.floor(random() * flights.length);
          m.arrive(flights.splice(i, 1)[0]);
        }
        assert.equal(m.remaining + m.inFlight + m.collected, m.level.pixels.length);
        m.slots.forEach((j) => {
          if (j) assert.ok(j.remaining > 0 && j.remaining <= j.capacity);
        });
      }
      assert.ok(m.complete || m.blocked, `seed ${seed} did not terminate`);
      if (m.complete) {
        assert.equal(seen.size, m.level.pixels.length);
        assert.equal(m.queue.length, 0);
      } else {
        assert.equal(m.inFlight, 0);
        assert.ok(m.slots.every(Boolean));
        assert.ok(m.exposedPixels.every((p) => m.slots.every((j) => j.color !== m.pixels[p])));
      }
    }
  });
}

test('full slots, hidden containers and repeat clicks do not mutate the queue', () => {
  const m = new GardenModel(makeLevel(0), seeded(2));
  assert.equal(m.place(m.queue[10].id), -1);
  const first = m.queue[0].id;
  assert.equal(m.place(first), 0);
  assert.equal(m.place(first), -1);
  for (let i = 0; i < 4; i++) m.place(m.queue[0].id);
  const before = JSON.stringify(m.queue);
  assert.equal(m.place(m.queue[0].id), -1);
  assert.equal(JSON.stringify(m.queue), before);
});

test('catalog uses the ten approved image2 illustrations in difficulty order', () => {
  const expectedIds = [
    'penguin-sailor',
    'berry-basket',
    'seaside-seal',
    'rainy-day',
    'corgi-garden',
    'little-gardener',
    'lemon-teapot',
    'baker-morning',
    'red-panda',
    'flower-bicycle',
  ];
  assert.ok(LEVEL_COUNT >= expectedIds.length);
  assert.deepEqual(
    Array.from({ length: expectedIds.length }, (_, i) => makeLevel(i).id),
    expectedIds,
  );
  const pictures = new Set();
  for (let index = 0; index < LEVEL_COUNT; index++) {
    const level = makeLevel(index);
    assert.equal(level.width, 48);
    assert.equal(level.height, 60);
    assert.equal(level.pixels.length, 2880);
    assert.equal(level.colors, new Set(level.pixels).size);
    const [minimum, maximum] = index < 30 ? [10, 12] : index < 70 ? [13, 18] : [19, 24];
    assert.ok(level.colors >= minimum && level.colors <= maximum);
    pictures.add(JSON.stringify(level.pixels));
  }
  assert.equal(pictures.size, LEVEL_COUNT, 'each illustration must be distinct');
});

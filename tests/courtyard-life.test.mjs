import test from 'node:test';
import assert from 'node:assert/strict';
import { CourtyardLife } from '../assets/scripts/domain/courtyard/courtyardLife.ts';
const step = (life, chair, seconds) => {
  for (let i = 0; i < seconds * 60; i++) life.update(1 / 60, chair);
};

test('resident completes sunbathing and chair cycles without leaving courtyard', () => {
  for (const chair of [false, true]) {
    const life = new CourtyardLife(() => 0.5);
    const seen = new Set();
    let stops = 0;
    let outdoor = 0;
    let entered = false;
    for (let i = 0; i < 60 * 180; i++) {
      const x = life.x,
        y = life.y,
        previous = life.action;
      life.update(1 / 60, chair);
      seen.add(life.action);
      assert.ok(Math.hypot(life.x - x, life.y - y) < 1, 'no position jumps');
      assert.ok(life.y >= 672 && life.y <= 915);
      if (life.action === 'rest') {
        if (previous !== 'rest') stops++;
        assert.equal(life.activity, chair ? 'chair' : 'sun');
      }
      if (life.action === 'inside') assert.equal(life.opacity, 0);
      if (life.opacity === 1) outdoor++;
      if (previous === 'enter' && life.action === 'inside') {
        entered = true;
        break;
      }
    }
    assert.ok(entered);
    assert.equal(stops, 4);
    assert.ok(outdoor >= 60 * 80, 'four outdoor stops before returning to the nest');
    for (const action of ['inside', 'emerge', 'walk', 'sit', 'rest', 'rise', 'return', 'enter'])
      assert.ok(seen.has(action), action);
  }
});
test('removing an occupied chair makes the resident leave continuously', () => {
  const life = new CourtyardLife(() => 0);
  while (life.action !== 'rest') step(life, true, 1 / 60);
  const x = life.x,
    y = life.y;
  life.update(1 / 60, false);
  assert.equal(life.action, 'rise');
  assert.ok(Math.hypot(life.x - x, life.y - y) < 1);
  step(life, false, 35);
  assert.equal(life.chair, false);
});
test('a newly equipped chair is selected on the next outing; long resume ticks cannot teleport', () => {
  const life = new CourtyardLife(() => 0);
  step(life, false, 4);
  assert.equal(life.chair, false);
  const x = life.x,
    y = life.y;
  life.update(999, true);
  assert.ok(Math.hypot(life.x - x, life.y - y) < 3);
  let used = false;
  for (let i = 0; i < 60 * 80; i++) {
    life.update(1 / 60, true);
    used ||= life.action === 'rest' && life.chair;
  }
  assert.ok(used);
});

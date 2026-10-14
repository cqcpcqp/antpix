import test from 'node:test';
import assert from 'node:assert/strict';
import { CourtyardLife } from '../assets/scripts/courtyardLife.ts';
const step = (life, chair, seconds) => {
  for (let i = 0; i < seconds * 60; i++) life.update(1 / 60, chair);
};

test('resident completes sunbathing and chair cycles without leaving courtyard', () => {
  for (const chair of [false, true]) {
    const life = new CourtyardLife(() => 0.5);
    const seen = new Set();
    let rested = false;
    for (let i = 0; i < 60 * 90; i++) {
      const x = life.x,
        y = life.y;
      life.update(1 / 60, chair);
      seen.add(life.action);
      assert.ok(Math.hypot(life.x - x, life.y - y) < 1, 'no position jumps');
      assert.ok(life.y >= 672 && life.y <= 915);
      if (life.action === 'rest') {
        rested = true;
        assert.equal(life.frame, chair ? 6 : 5);
      }
      if (life.action === 'inside') assert.equal(life.opacity, 0);
    }
    assert.ok(rested);
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
  assert.notEqual(life.frame, 6);
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
    used ||= life.frame === 6;
  }
  assert.ok(used);
});

test('pond and party transitions do not flash the sunbathing pose', () => {
  for (const activity of ['drink', 'mirror', 'party']) {
    const life = new CourtyardLife(() => 0.5);
    life.activity = activity;
    for (const action of ['sit', 'rise']) {
      life.stay(action, 1.1);
      for (let frame = 0; frame < 65; frame++) {
        assert.ok(![5, 6].includes(life.frame), `${activity} ${action}`);
        life.update(1 / 60, false);
      }
    }
  }
});

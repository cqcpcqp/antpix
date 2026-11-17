import test from 'node:test';
import assert from 'node:assert/strict';
import { imageMetrics, imageReview } from '../scripts/level-image-metrics.mjs';

test('image components do not merge diagonal cells or wrap across row edges', () => {
  const metrics = imageMetrics({ width: 2, height: 2, pixels: [0, 1, 1, 0], capacity: 2 });
  assert.equal(metrics.maxComponent, 1);
  assert.equal(metrics.componentCount, 4);
  assert.equal(metrics.openingColors, 2);
});

test('a color barrier exposes a partial color before its upper region unlocks', () => {
  const metrics = imageMetrics({
    width: 3,
    height: 3,
    pixels: [0, 0, 0, 1, 1, 1, 0, 0, 0],
    capacity: 6,
  });
  assert.equal(metrics.largestOpening, 3);
  assert.equal(metrics.maxComponent, 3);
  assert.deepEqual(
    metrics.sweeps.map((sweep) => sweep.color),
    [0, 1, 0],
  );
  assert.equal(metrics.sweeps[0].opportunities, 1);
  assert.equal(metrics.opportunityStates, 1);
});

test('large solid regions differ from a separated image with equal color totals', () => {
  const solid = imageMetrics({
    width: 4,
    height: 4,
    pixels: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    capacity: 2,
  });
  const split = imageMetrics({
    width: 4,
    height: 4,
    pixels: [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0],
    capacity: 2,
  });
  assert.equal(solid.topThreeColorShare, split.topThreeColorShare);
  assert.equal(solid.maxComponent, 8);
  assert.equal(split.maxComponent, 1);
  assert.equal(solid.bulkPixelShare, 1);
  assert.equal(split.bulkPixelShare, 0);
});

test('draft triage reports structural reasons without approving artwork', () => {
  assert.deepEqual(
    imageReview({ maxComponentShare: 0.24, topThreeColorShare: 0.66, bulkPixelShare: 0.69 }),
    {
      tier: 'priority',
      reasons: ['large-connected-region', 'dominant-three-colors', 'bulk-area'],
    },
  );
  assert.deepEqual(
    imageReview({ maxComponentShare: 0.04, topThreeColorShare: 0.3, bulkPixelShare: 0.1 }),
    { tier: 'candidate', reasons: [] },
  );
});

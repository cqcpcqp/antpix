import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { imageMetrics, imageReview } from './level-image-metrics.mjs';
import {
  difficultyForLevel,
  dependencySettings,
  planContainers,
  selectLayout,
} from './container-planner.mjs';
import { simulatePlan } from './container-simulation.mjs';

// Validate review-only pixel exports through the production planner and model.
// These files do not install artwork or change the shipped cloud catalog.
const directory = process.argv[2];
assert.ok(directory, 'Pass a candidate directory');
const entries = JSON.parse(readFileSync(`${directory}/candidate-pixels.json`, 'utf8'));
const baseline = JSON.parse(readFileSync('art/difficulty-review/image-audit.json', 'utf8')).rows;
const structures = [],
  gameplay = [];
for (const entry of entries) {
  assert.equal(entry.approved, false, 'Candidates must await artwork acceptance');
  assert.equal(entry.pixels.length, 2880);
  const colors = new Set(entry.pixels);
  assert.equal(colors.size, entry.colors);
  const [min, max] = entry.level <= 30 ? [10, 12] : entry.level <= 70 ? [13, 18] : [19, 24];
  assert.ok(colors.size >= min && colors.size <= max);
  const after = imageMetrics(entry);
  structures.push({
    level: entry.level,
    id: entry.id,
    name: entry.name,
    before: baseline[entry.level - 1].metrics,
    after,
    review: imageReview(after),
  });
  const { stage, difficulty } = difficultyForLevel(entry.level);
  const variants = [];
  for (let variant = 0; variant < 3; variant++) {
    const seed = 1009 + variant * 7919;
    const witness = planContainers(entry, seed, difficulty);
    const layout = selectLayout(entry, witness.jars, seed, difficulty);
    const replay = simulatePlan(entry, layout.plan, { policy: 'witness', nearest: true });
    assert.equal(replay.win, true, `${entry.id}: real nearest-path witness must solve`);
    assert.ok(witness.peakUnfinished <= dependencySettings(difficulty).maxUnfinished);
    for (const color of colors)
      assert.equal(
        layout.plan.filter((j) => j[0] === color).reduce((sum, j) => sum + j[1], 0),
        entry.pixels.filter((pixel) => pixel === color).length,
      );
    const policies = Object.fromEntries(
      ['random', 'exposed', 'capacity'].map((policy) => {
        const runs = Array.from({ length: 5 }, (_, trial) =>
          simulatePlan(entry, layout.plan, {
            policy,
            seed: 50021 + (entry.level - 1) * 131 + variant * 17 + trial * 100003,
          }),
        );
        return [policy, { games: runs.length, wins: runs.filter((run) => run.win).length }];
      }),
    );
    variants.push({
      variant,
      containers: layout.plan.length,
      dependencies: witness.dependencies,
      peakUnfinished: witness.peakUnfinished,
      metrics: layout.metrics,
      nearestPathWitness: 'passed',
      policies,
      plan: layout.plan,
    });
  }
  gameplay.push({
    level: entry.level,
    id: entry.id,
    stage,
    difficulty,
    settings: dependencySettings(difficulty),
    sourceHash: createHash('sha256').update(JSON.stringify(entry.pixels)).digest('hex'),
    variants,
  });
  console.log(
    JSON.stringify({
      level: entry.level,
      maxBefore: baseline[entry.level - 1].metrics.maxComponent,
      maxAfter: after.maxComponent,
      tier: imageReview(after).tier,
      waitingPeaks: variants.map((v) => v.peakUnfinished),
    }),
  );
}
writeFileSync(`${directory}/structure-review.json`, JSON.stringify(structures, null, 2) + '\n');
writeFileSync(
  `${directory}/gameplay-review.json`,
  JSON.stringify(
    {
      status: 'candidate-only-not-installed',
      method:
        'Three plans per image; five basic slots and real nearest-path witness; proxy strategies are not human win rates.',
      rows: gameplay,
    },
    null,
    2,
  ) + '\n',
);

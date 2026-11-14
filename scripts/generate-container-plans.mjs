import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { planContainers, selectLayout, encodeContainerPlan } from './container-planner.mjs';
const file = resolve(process.argv[2] || 'assets/scripts/domain/levels/levels.ts');
const reportFile = resolve(process.argv[3] || 'art/container-plan-report.json');
const { ARTWORKS, GRID_WIDTH, GRID_HEIGHT } = await import(pathToFileURL(file));
// Optional catalog/report pair preserves already shipped plans during an append.
const reuseFile = process.argv[4];
const reuseReportFile = process.argv[5];
assert.equal(Boolean(reuseFile), Boolean(reuseReportFile));
const reused = new Map();
if (reuseFile) {
  const previous = await import(pathToFileURL(resolve(reuseFile)));
  const previousReport = JSON.parse(readFileSync(reuseReportFile, 'utf8'));
  assert.equal(previousReport.length, previous.ARTWORKS.length);
  previous.ARTWORKS.forEach((art, index) => {
    reused.set(art.id, {
      art,
      plans: previous.CONTAINER_PLANS[art.id],
      report: {
        ...previousReport[index],
        generationDifficulty:
          previousReport[index].generationDifficulty ??
          index / Math.max(1, previous.ARTWORKS.length - 1),
      },
    });
  });
}
const plans = {},
  report = [];
for (const [index, art] of ARTWORKS.entries()) {
  const level = { ...art, width: GRID_WIDTH, height: GRID_HEIGHT };
  const previous = reused.get(art.id);
  if (previous) {
    assert.deepEqual(art.pixels, previous.art.pixels, `Cannot reuse changed artwork: ${art.id}`);
    assert.deepEqual(art.swatches, previous.art.swatches);
    assert.equal(previous.report.id, art.id);
    assert.equal(
      previous.report.sourceHash,
      createHash('sha256').update(JSON.stringify(level.pixels)).digest('hex'),
    );
    plans[art.id] = previous.plans.map((plan) => encodeContainerPlan(plan, art.swatches));
    report.push(previous.report);
    console.log(`${report.length}/${ARTWORKS.length} ${art.id}: preserved shipped plans`);
    continue;
  }
  const variants = Array.from({ length: 3 }, (_, i) => {
    const seed = 1009 + i * 7919;
    const result = planContainers(level, seed, index / Math.max(1, ARTWORKS.length - 1));
    const layout = selectLayout(level, result.jars, seed, index / Math.max(1, ARTWORKS.length - 1));
    return {
      ...result,
      jars: layout.plan,
      metrics: layout.metrics,
      trainingWins: layout.trainingWins,
    };
  });
  plans[art.id] = variants.map((v) => encodeContainerPlan(v.jars, art.swatches));
  report.push({
    id: art.id,
    name: art.name,
    generationDifficulty: index / Math.max(1, ARTWORKS.length - 1),
    sourceHash: createHash('sha256').update(JSON.stringify(level.pixels)).digest('hex'),
    variants: variants.map((v) => ({
      ...v.metrics,
      planHash: createHash('sha256').update(JSON.stringify(v.jars)).digest('hex'),
      stages: v.stages,
      dependencies: v.dependencies,
      trainingWins: v.trainingWins,
    })),
  });
  console.log(
    `${report.length}/${ARTWORKS.length} ${art.id}: ${variants.map((v) => v.jars.length).join('/')} containers`,
  );
}
const source = readFileSync(file, 'utf8');
writeFileSync(
  file,
  source.replace(
    /^const PACKED_CONTAINER_PLANS:.*$/m,
    'const PACKED_CONTAINER_PLANS: Record<string, string[]> = ' + JSON.stringify(plans) + ';',
  ),
);
writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');

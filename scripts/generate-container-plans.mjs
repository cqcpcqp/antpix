import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { planContainers, selectLayout, encodeContainerPlan } from './container-planner.mjs';
const relayout = process.argv.includes('--relayout');
const args = process.argv.slice(2).filter((arg) => arg !== '--relayout');
const file = resolve(args[0] || 'assets/scripts/domain/levels/levels.ts');
const reportFile = resolve(args[1] || 'art/container-plan-report.json');
const { ARTWORKS, GRID_WIDTH, GRID_HEIGHT, CONTAINER_PLANS } = await import(pathToFileURL(file));
// Repartition shipped witnesses without changing capacities, move counts or
// their original generation difficulty. Only the explicit column field changes.
const layoutReports = relayout ? JSON.parse(readFileSync(reportFile, 'utf8')) : [];
// Optional catalog/report pair preserves already shipped plans during an append.
const reuseFile = args[2];
const reuseReportFile = args[3];
assert.ok(!relayout || !reuseFile, 'Relayout and shipped-plan reuse are exclusive');
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
  const layoutReport = layoutReports[index];
  if (relayout) {
    assert.equal(layoutReport.id, art.id);
    assert.equal(
      layoutReport.sourceHash,
      createHash('sha256').update(JSON.stringify(level.pixels)).digest('hex'),
    );
  }
  const difficulty = relayout
    ? layoutReport.generationDifficulty
    : index / Math.max(1, ARTWORKS.length - 1);
  const variants = Array.from({ length: 3 }, (_, i) => {
    const seed = 1009 + i * 7919;
    const result = relayout
      ? {
          jars: CONTAINER_PLANS[art.id][i].map(([color, capacity]) => [color, capacity]),
          stages: layoutReport.variants[i].stages,
          dependencies: layoutReport.variants[i].dependencies,
        }
      : planContainers(level, seed, difficulty);
    const layout = selectLayout(level, result.jars, seed, difficulty);
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
    generationDifficulty: difficulty,
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

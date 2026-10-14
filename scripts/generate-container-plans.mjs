import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { planContainers, selectLayout, encodeContainerPlan } from './container-planner.mjs';
const file = resolve(process.argv[2] || 'assets/scripts/domain/levels/levels.ts');
const reportFile = resolve(process.argv[3] || 'art/container-plan-report.json');
const { ARTWORKS, GRID_WIDTH, GRID_HEIGHT } = await import(pathToFileURL(file));
const plans = {},
  report = [];
for (const [index, art] of ARTWORKS.entries()) {
  const level = { ...art, width: GRID_WIDTH, height: GRID_HEIGHT };
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

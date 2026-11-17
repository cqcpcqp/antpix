import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { makeLevel } from '../assets/scripts/domain/levels/levels.ts';
import { planContainers, selectLayout } from './container-planner.mjs';
import { simulatePlan } from './container-simulation.mjs';

// Candidate-only experiments never write installed artwork, plans or cloud data.
const levels = (process.argv[2] || '13,23,25,26,34,75,100,138,300').split(',').map(Number);
const output = process.argv[3] || 'art/difficulty-review/planner-experiment.json';
const reports = JSON.parse(readFileSync('art/container-plan-report.json', 'utf8'));
const profiles = [
  { name: 'legacy-one-waiting', options: { maxUnfinished: 1, dependencyRate: 0.25 } },
  { name: 'two-waiting', options: { maxUnfinished: 2, dependencyRate: 0.65, dependencyBudget: 8 } },
  {
    name: 'three-waiting',
    options: { maxUnfinished: 3, dependencyRate: 0.8, dependencyBudget: 12 },
  },
];
const rows = [];
for (const number of levels) {
  const level = makeLevel(number - 1),
    difficulty = reports[number - 1].generationDifficulty;
  for (const profile of profiles) {
    const variants = [];
    for (let variant = 0; variant < 3; variant++) {
      const seed = 1009 + variant * 7919;
      const witness = planContainers(level, seed, difficulty, {
        dependencyBudget: Math.ceil(difficulty * 4),
        ...profile.options,
      });
      const layout = selectLayout(level, witness.jars, seed, difficulty);
      // Independent seeds differ from candidate layout training. These proxy
      // policies settle reachable work between decisions; they are not players.
      const policies = Object.fromEntries(
        ['random', 'exposed', 'capacity'].map((policy) => {
          const runs = Array.from({ length: 5 }, (_, trial) =>
            simulatePlan(level, layout.plan, {
              policy,
              seed: 50021 + (number - 1) * 131 + variant * 17 + trial * 100003,
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
        policies,
        plan: layout.plan,
      });
    }
    const row = { level: number, name: level.name, profile: profile.name, variants };
    rows.push(row);
    console.log(
      JSON.stringify({
        level: number,
        profile: profile.name,
        peakUnfinished: variants.map((v) => v.peakUnfinished),
        dependencies: variants.map((v) => v.dependencies),
      }),
    );
  }
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  JSON.stringify(
    {
      status: 'candidate-only-not-installed',
      profiles,
      levels,
      training: 'unchanged selectLayout exposed-policy target',
      evaluation:
        'Five independent seeds per variant and policy; abstract pickup, five slots; each witness constructed with actual nearest-path pickup.',
      rows,
    },
    null,
    2,
  ) + '\n',
);

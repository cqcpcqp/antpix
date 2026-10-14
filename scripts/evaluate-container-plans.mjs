import { readFileSync, writeFileSync } from 'node:fs';
import { ARTWORKS, makeLevel } from '../assets/scripts/domain/levels/levels.ts';
import { planMetrics, simulatePlan } from './container-simulation.mjs';

const args = process.argv.slice(2);
function option(name, defaultValue) {
  const i = args.indexOf(name);
  return i < 0 ? defaultValue : args[i + 1];
}
const output = option('--output', 'art/container-evaluation.json');
const trials = Number(option('--trials', '5'));
const nearest = args.includes('--nearest');
const selectedLevels = option('--levels', '').split(',').filter(Boolean).map(Number);
const baselineFile = option('--baseline', '');
const datasets = [{ name: 'current', levels: ARTWORKS.map((_, i) => makeLevel(i)) }];
if (baselineFile)
  datasets.unshift({ name: 'baseline', levels: JSON.parse(readFileSync(baselineFile, 'utf8')) });
if (!Number.isInteger(trials) || trials < 1) throw new Error('Trials must be a positive integer');
const results = [];
for (const dataset of datasets) {
  const rows = [];
  for (const [index, level] of dataset.levels.entries()) {
    if (selectedLevels.length && !selectedLevels.includes(index + 1)) continue;
    for (const [variant, plan] of level.containerPlans.entries()) {
      const policies = {};
      for (const policy of ['random', 'exposed', 'capacity']) {
        const runs = Array.from({ length: trials }, (_, trial) =>
          simulatePlan(level, plan, {
            policy,
            seed: 50021 + index * 131 + variant * 17 + trial * 100003,
            nearest,
          }),
        );
        policies[policy] = {
          games: runs.length,
          wins: runs.filter((r) => r.win).length,
          earlyFailures: runs.filter((r) => !r.win && r.collected < level.pixels.length * 0.15)
            .length,
          maxStalled: Math.max(...runs.map((r) => r.maxStalled)),
        };
      }
      rows.push({ level: index + 1, variant, ...planMetrics(plan), policies });
    }
  }
  const stages = [
    [1, 10],
    [11, 30],
    [31, 60],
    [61, 100],
  ].map(([from, to]) => {
    const subset = rows.filter((r) => r.level >= from && r.level <= to);
    return {
      from,
      to,
      plans: subset.length,
      singleColorOpenings: subset.filter((r) => r.openingColors === 1).length,
      containers: subset.reduce((s, r) => s + r.containers, 0),
      longRunContainers: subset.reduce((s, r) => s + r.longRunContainers, 0),
      policies: Object.fromEntries(
        ['random', 'exposed', 'capacity'].map((policy) => [
          policy,
          ['games', 'wins', 'earlyFailures'].reduce((result, key) => {
            result[key] = subset.reduce((s, r) => s + r.policies[policy][key], 0);
            return result;
          }, {}),
        ]),
      ),
    };
  });
  results.push({ name: dataset.name, stages, rows });
  console.log(JSON.stringify({ name: dataset.name, stages }));
}
writeFileSync(
  output,
  JSON.stringify(
    {
      nearest,
      trials,
      method:
        'Five basic slots; settle reachable work after each selection. Fixed held-out seeds; not human win rates or animation timing.',
      results,
    },
    null,
    2,
  ) + '\n',
);

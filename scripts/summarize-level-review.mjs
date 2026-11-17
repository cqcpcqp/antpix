import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { makeLevel, LEVEL_COUNT } from '../assets/scripts/domain/levels/levels.ts';
import { planMetrics } from './container-simulation.mjs';

// Join independent image and strategy measurements into a provisional review.
// These bands describe one-step heuristics, not human difficulty or approval.
const directory = process.argv[2] || 'art/difficulty-review';
const images = JSON.parse(readFileSync(`${directory}/image-audit.json`, 'utf8'));
const strategies = JSON.parse(readFileSync(`${directory}/stage-strategies.json`, 'utf8'));
assert.equal(strategies.results[0].name, 'current');
assert.equal(strategies.nearest, false);
assert.ok(strategies.trials >= 5, 'Use at least five independent seeds per variant');
assert.equal(images.rows.length, LEVEL_COUNT);
const rows = images.rows.map((image, index) => {
  const level = makeLevel(index);
  assert.equal(image.level, index + 1);
  assert.equal(image.id, level.id);
  assert.equal(
    image.sourceHash,
    createHash('sha256').update(JSON.stringify(level.pixels)).digest('hex'),
  );
  const variants = strategies.results[0].rows.filter((row) => row.level === image.level);
  assert.equal(variants.length, level.containerPlans.length);
  for (const variant of variants) {
    const metrics = planMetrics(level.containerPlans[variant.variant]);
    for (const key of Object.keys(metrics)) assert.deepEqual(variant[key], metrics[key]);
  }
  const policies = Object.fromEntries(
    ['random', 'exposed', 'capacity'].map((policy) => [
      policy,
      variants.reduce(
        (sum, variant) => ({
          games: sum.games + variant.policies[policy].games,
          wins: sum.wins + variant.policies[policy].wins,
        }),
        { games: 0, wins: 0 },
      ),
    ]),
  );
  const ratio = policies.capacity.wins / policies.capacity.games;
  return {
    level: image.level,
    id: image.id,
    name: image.name,
    imageTier: image.review.tier,
    maxComponent: image.metrics.maxComponent,
    topThreeColorShare: image.metrics.topThreeColorShare,
    provisionalTier: ratio >= 0.8 ? '较易' : ratio >= 0.4 ? '中等' : '挑战风险',
    policies,
  };
});
const summary = {
  image: images.summary,
  strategy: Object.fromEntries(
    ['较易', '中等', '挑战风险'].map((tier) => [
      tier,
      rows.filter((row) => row.provisionalTier === tier).length,
    ]),
  ),
};
writeFileSync(
  `${directory}/level-review.json`,
  JSON.stringify(
    {
      status: 'draft-not-human-difficulty-or-artwork-approval',
      method:
        'Five slots, at least five held-out seeds per variant. Capacity-heuristic win rate: >=80% easy proxy, >=40% mixed proxy, below40% planning-risk proxy. Neither repeated collection boredom nor human planning is measured.',
      summary,
      rows,
    },
    null,
    2,
  ) + '\n',
);
const imageNames = { priority: '优先重绘审核', review: '复核', candidate: '低结构风险候选' };
writeFileSync(
  `${directory}/level-review.md`,
  [
    '# 300 关联合审核与暂定评级',
    '',
    '这是研究初筛，不是最终玩家难度评级。图片等级来自连通区与颜色集中度；策略档位只来自单步容量判断策略（≥80% 较易、40%–80% 中等、<40% 挑战风险），每关三套方案各五次独立种子，共 15 局。它不能区分“有趣的规划”和“重复收集很久”，也不代表真人通关率。',
    '',
    '本表对应固定阶段重建后的正式容器方案。图片初筛与策略档位必须分别看：图片大块同色，即使策略容易失败也仍可能需要重绘；图片分区合理但策略易通过，可以先调整容器方案。确认替换前需原图/像素图对照、实际路径验证与试玩。图片和 approved 状态均未改变。',
    '',
    `图片：优先审核 ${summary.image.priority} / 复核 ${summary.image.review} / 低风险候选 ${summary.image.candidate}。策略初分：较易 ${summary.strategy['较易']} / 中等 ${summary.strategy['中等']} / 挑战风险 ${summary.strategy['挑战风险']}。`,
    '',
    '| 关卡 | 名称 | 图片结构审核 | 暂定策略档位 | 容量判断通过 | 只看可达颜色通过 | 随机通过 | 最大同色连通区 / 格 | 前三色占比 |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map(
      (row) =>
        `| ${row.level} | ${row.name} | ${imageNames[row.imageTier]} | ${row.provisionalTier} | ${row.policies.capacity.wins}/${row.policies.capacity.games} | ${row.policies.exposed.wins}/${row.policies.exposed.games} | ${row.policies.random.wins}/${row.policies.random.games} | ${row.maxComponent} | ${(row.topThreeColorShare * 100).toFixed(1)}% |`,
    ),
  ].join('\n') + '\n',
);
console.log(JSON.stringify(summary));

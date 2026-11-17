import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { ARTWORKS, makeLevel, PALETTE } from '../assets/scripts/domain/levels/levels.ts';
import { imageMetrics, imageReview, IMAGE_REVIEW_THRESHOLDS } from './level-image-metrics.mjs';

// Audit the installed pixel data; no regeneration, approval or runtime writes.
const output = resolve(process.argv[2] || 'art/difficulty-review/image-audit.json');
const catalog = JSON.parse(readFileSync('art/cartoons/runtime-catalog.json', 'utf8'));
const sources = new Map();
for (const directory of catalog.sources)
  for (const entry of JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8')))
    sources.set(entry.id, { directory, entry });
const rows = ARTWORKS.map((_, index) => {
  const level = makeLevel(index),
    metrics = imageMetrics(level);
  const source = sources.get(level.id);
  return {
    level: index + 1,
    id: level.id,
    name: level.name,
    sourceHash: createHash('sha256').update(JSON.stringify(level.pixels)).digest('hex'),
    pixelFile: `${source.directory}/${source.entry.runtimePixelFile}`,
    review: imageReview(metrics),
    metrics: {
      ...metrics,
      topComponents: metrics.topComponents.map((component) => ({
        ...component,
        hex: PALETTE[component.color],
      })),
      topColors: metrics.topColors.map((color) => ({ ...color, hex: PALETTE[color.color] })),
    },
  };
});
const report = {
  status: 'draft-triage-not-approved-difficulty',
  method:
    'Exact-color four-way components; bottom-entry greedy full-color sweeps ignore container order, capacity limits and slots. Opportunity states indicate potential, not required dependencies.',
  limitations: [
    'Similar colors remain separate; visual review required.',
    'Image structure does not determine a complete level difficulty.',
    'Thresholds are proposed triage criteria, not user-approved rejection gates.',
  ],
  thresholds: IMAGE_REVIEW_THRESHOLDS,
  summary: Object.fromEntries(
    ['priority', 'review', 'candidate'].map((tier) => [
      tier,
      rows.filter((row) => row.review.tier === tier).length,
    ]),
  ),
  rows,
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const tierNames = { priority: '优先重绘审核', review: '复核', candidate: '低结构风险候选' };
const reviewFile = resolve(dirname(output), 'image-review.md');
const table = [
  '# 存量关卡图片结构初筛',
  '',
  '本表覆盖正式 300 关。等级是暂定的结构审核优先级，不是玩家难度、最终不合格结论或替换授权。阈值、算法局限和完整分量见同目录 image-audit.json。所有原图和 approved 状态保持不变。',
  '',
  '连通区只合并精确同色且四向相邻的像素；近似色可能使大区域被低估，需要结合视觉复核。开局可收集量忽略容器容量，表示图片本身可连续收集的潜力。',
  '',
  '| 关卡 | 图片 | 初筛级别 | 最大同色连通区 / 格 | 最大连通区占比 | 前三色占比 | 开局最大可收集量 / 格 |',
  '| --- | --- | --- | ---: | ---: | ---: | ---: |',
  ...rows.map(
    (row) =>
      `| ${row.level} | [${row.name}](${relative(dirname(output), resolve(row.pixelFile))}) | ${tierNames[row.review.tier]} | ${row.metrics.maxComponent} | ${(row.metrics.maxComponentShare * 100).toFixed(1)}% | ${(row.metrics.topThreeColorShare * 100).toFixed(1)}% | ${row.metrics.largestOpening} |`,
  ),
];
writeFileSync(reviewFile, table.join('\n') + '\n');
console.log(JSON.stringify({ output, summary: report.summary }));
for (const number of [1, 25, 26, 100, 150, 300]) {
  const row = rows[number - 1];
  console.log(
    JSON.stringify({
      level: number,
      name: row.name,
      tier: row.review.tier,
      maxComponent: row.metrics.maxComponent,
      largestOpening: row.metrics.largestOpening,
      opportunityStates: row.metrics.opportunityStates,
      sweepCount: row.metrics.sweepCount,
    }),
  );
}

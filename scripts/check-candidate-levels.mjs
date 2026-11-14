// Validate a review-only catalog through the production model before artwork
// approval. This never installs candidates into the game or cloud catalog.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { GardenModel } from '../assets/scripts/domain/game/model.ts';
import { settleContainers } from './container-simulation.mjs';

const file = resolve(process.argv[2]);
const reportFile = resolve(process.argv[3]);
const resultFile = resolve(process.argv[4]);
const { LEVEL_COUNT, PALETTE, makeLevel } = await import(pathToFileURL(file));
const report = JSON.parse(readFileSync(reportFile, 'utf8'));
const pictures = new Set();
let variants = 0;
for (let index = 0; index < LEVEL_COUNT; index++) {
  const level = makeLevel(index);
  assert.equal(level.width, 48);
  assert.equal(level.height, 60);
  assert.equal(level.pixels.length, 2880);
  const colors = new Set(level.pixels);
  const [minimum, maximum] = index < 30 ? [10, 12] : index < 70 ? [13, 18] : [19, 24];
  assert.equal(colors.size, level.colors);
  assert.ok(colors.size >= minimum && colors.size <= maximum);
  assert.ok(level.pixels.every((color) => Number.isInteger(color) && PALETTE[color]));
  const picture = JSON.stringify(level.pixels);
  assert.ok(!pictures.has(picture), `Duplicate artwork: ${level.id}`);
  pictures.add(picture);
  assert.equal(report[index].sourceHash, createHash('sha256').update(picture).digest('hex'));
  assert.equal(level.containerPlans.length, 3);
  for (let variant = 0; variant < 3; variant++) {
    const plan = level.containerPlans[variant];
    assert.equal(
      report[index].variants[variant].planHash,
      createHash('sha256').update(JSON.stringify(plan)).digest('hex'),
    );
    const capacity = new Map();
    for (const [color, count, column] of plan) {
      assert.ok(colors.has(color));
      assert.ok(Number.isInteger(count) && count >= 1 && count <= 40);
      assert.ok(Number.isInteger(column) && column >= 0 && column < 5);
      capacity.set(color, (capacity.get(color) || 0) + count);
    }
    for (const color of colors)
      assert.equal(capacity.get(color), level.pixels.filter((pixel) => pixel === color).length);
    const model = new GardenModel(level, () => (variant + 0.1) / 3);
    let collected = 0;
    for (let id = 0; id < plan.length; id++) {
      assert.ok(model.columns.some((column) => column[0]?.id === id));
      assert.ok(model.place(id) >= 0, `Five slots must suffice: ${level.id}, variant ${variant}`);
      collected += settleContainers(model, true);
      assert.ok(model.slots.filter(Boolean).length <= 1);
    }
    assert.equal(collected, 2880);
    assert.equal(model.complete, true);
    assert.equal(model.inFlight, 0);
    variants++;
  }
  console.log(`${index + 1}/${LEVEL_COUNT}: ${level.id} — three witness solutions passed`);
}
writeFileSync(
  resultFile,
  JSON.stringify(
    {
      levels: LEVEL_COUNT,
      variants,
      uniquePictures: pictures.size,
      nearestPathWitnesses: 'passed',
    },
    null,
    2,
  ) + '\n',
);

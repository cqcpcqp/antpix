// Bake the existing vector artwork, without duplicating its geometry or palette.
// NODE_PATH can point to a tool runtime containing @napi-rs/canvas.
const { createCanvas } = require('@napi-rs/canvas');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { load } = require('./headless-game.cjs');
const { drawAnt, drawBoardPixel } = load(
  process.cwd() + '/assets/scripts/presentation/gardenDrawing.ts',
);
const { CELL_SIZE } = load(process.cwd() + '/assets/scripts/presentation/boardLayout.ts');
const PALETTE = ['#000000', '#FFFFFF'];
const CELL = 64,
  COLUMNS = 4,
  SCALE = 2;
const canvas = createCanvas(CELL * COLUMNS, Math.ceil((PALETTE.length * 4) / COLUMNS) * CELL);
const ctx = canvas.getContext('2d');
const css = (c) => `rgba(${c.r},${c.g},${c.b},${c.a / 255})`;
class CanvasGraphics {
  constructor() {
    this.lineWidth = 1;
    ctx.beginPath();
  }
  moveTo(x, y) {
    ctx.moveTo(x, y);
  }
  lineTo(x, y) {
    ctx.lineTo(x, y);
  }
  close() {
    ctx.closePath();
  }
  rect(x, y, w, h) {
    ctx.rect(x, y, w, h);
  }
  roundRect(x, y, w, h, r) {
    ctx.roundRect(x, y, w, h, r);
  }
  circle(x, y, r) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  fill() {
    ctx.fillStyle = css(this.fillColor);
    ctx.fill();
    ctx.beginPath();
  }
  stroke() {
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = css(this.strokeColor);
    ctx.stroke();
    ctx.beginPath();
  }
}
for (let c = 0; c < PALETTE.length; c++)
  for (let pose = 0; pose < 4; pose++) {
    const tile = c * 4 + pose,
      x = (tile % COLUMNS) * CELL,
      y = Math.floor(tile / COLUMNS) * CELL;
    ctx.save();
    ctx.translate(x + CELL / 2, y + CELL / 2);
    ctx.scale(SCALE, -SCALE);
    const g = new CanvasGraphics();
    if (pose < 3) drawAnt(g, 0, 0, 0, pose * 0.084, 1, PALETTE[c]);
    else drawBoardPixel(g, -CELL_SIZE / 2, CELL_SIZE / 2, PALETTE[c]);
    ctx.restore();
    // A transparent border prevents neighboring colors/poses from bleeding when
    // the GPU linearly filters the atlas. Also detect artwork clipped by a tile.
    const pixels = ctx.getImageData(x, y, CELL, CELL).data;
    for (let i = 0; i < CELL; i++)
      for (const edge of [i, (CELL - 1) * CELL + i, i * CELL, i * CELL + CELL - 1])
        assert.equal(
          pixels[edge * 4 + 3],
          0,
          `Artwork touches tile edge: color ${c}, pose ${pose}`,
        );
  }
mkdirSync('assets/resources/ants', { recursive: true });
// Store color-dependent shapes once. Detail overlay keeps legs, eyes, shadows
// and highlights neutral while Sprite.color applies the exact level palette.
const compressed = spawnSync('python3', ['scripts/split-tint-layers.py'], {
  input: canvas.toBuffer('image/png'),
  maxBuffer: 4 * 1024 * 1024,
});
if (compressed.status !== 0) throw Error(compressed.stderr.toString());
const output = compressed.stdout,
  path = 'assets/resources/ants/workers.png';
if (process.argv.includes('--check'))
  assert.deepEqual(
    readFileSync(path),
    output,
    'Regenerate atlas after changing ant/cargo artwork or palette',
  );
else writeFileSync(path, output);
console.log('Ant atlas: 512x64, 4 tintable poses/cargo + 4 neutral detail overlays');

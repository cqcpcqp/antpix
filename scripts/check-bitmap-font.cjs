// Verify visible glyph centers using Cocos single-line bitmap layout equations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const glyphs = new Map();
for (const line of fs
  .readFileSync('assets/resources/fonts/ant-nest-bitmap.fnt', 'utf8')
  .split('\n')) {
  if (!line.startsWith('char id=')) continue;
  const values = Object.fromEntries(
    [...line.matchAll(/(\w+)=(-?[\d.]+)/g)].map((m) => [m[1], Number(m[2])]),
  );
  glyphs.set(values.id, values);
}
(async () => {
  const atlas = await loadImage('assets/resources/fonts/ant-nest-bitmap.png');
  const canvas = createCanvas(600, 360),
    ctx = canvas.getContext('2d');
  ctx.fillStyle = '#F7F3DF';
  ctx.fillRect(0, 0, 600, 360);
  const strings = ['35', '34', '16', '第 3 关', '重新开始', '速度 ×1'];
  strings.forEach((text, row) => {
    const letters = [...text].map((c) => glyphs.get(c.codePointAt(0)));
    assert.ok(letters.every(Boolean));
    let advance = 0,
      right = 0;
    for (const glyph of letters) {
      right = advance + glyph.xoffset + glyph.width;
      advance += glyph.xadvance;
    }
    const cx = 300,
      cy = 30 + row * 55,
      scale = 0.7;
    let x = cx - (right * scale) / 2;
    ctx.strokeStyle = '#BFAE94';
    ctx.strokeRect(180, cy - 24, 240, 48);
    for (const glyph of letters) {
      if (glyph.width) {
        assert.equal(glyph.xoffset, 0);
        assert.equal(glyph.yoffset + glyph.height / 2, 24);
        assert.equal(glyph.xadvance, glyph.width);
        ctx.drawImage(
          atlas,
          glyph.x,
          glyph.y,
          glyph.width,
          glyph.height,
          x,
          cy + (glyph.yoffset - 24) * scale,
          glyph.width * scale,
          glyph.height * scale,
        );
      }
      x += glyph.xadvance * scale;
    }
  });
  fs.mkdirSync('temp/previews', { recursive: true });
  fs.writeFileSync('temp/previews/bitmap-alignment.png', canvas.toBuffer('image/png'));
  console.log('Numeric and Chinese bitmap glyph centers verified.');
})();

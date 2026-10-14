// Rounded numeric glyphs baked locally; no platform font needed at runtime.
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { writeFileSync, readFileSync, existsSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
GlobalFonts.registerFromPath('/System/Library/Fonts/SFCompactRounded.ttf', 'ContainerRounded');
const canvas = createCanvas(320, 128),
  ctx = canvas.getContext('2d');
ctx.font = '800 48px ContainerRounded';
ctx.textBaseline = 'alphabetic';
ctx.fillStyle = '#FFFFFF';
const lines = [
  'info face="Ant Nest Clean Digits" size=48 bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=0,0',
  'common lineHeight=48 base=48 scaleW=320 scaleH=128 pages=1 packed=0',
  'page id=0 file="container-digits.png"',
  'chars count=10',
];
const metrics = [];
for (let i = 0; i < 10; i++) {
  const x = (i % 5) * 64,
    y = Math.floor(i / 5) * 64;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.strokeText(String(i), x + 8, y + 48);
  ctx.fillText(String(i), x + 8, y + 48);
  const data = ctx.getImageData(x, y, 64, 64).data;
  let left = 64,
    top = 64,
    right = 0,
    bottom = 0;
  for (let py = 0; py < 64; py++)
    for (let px = 0; px < 64; px++)
      if (data[(py * 64 + px) * 4 + 3]) {
        left = Math.min(left, px);
        top = Math.min(top, py);
        right = Math.max(right, px);
        bottom = Math.max(bottom, py);
      }
  const w = right - left + 1,
    h = bottom - top + 1;
  let weight = 0,
    moment = 0;
  for (let py = top; py <= bottom; py++)
    for (let px = left; px <= right; px++) {
      const alpha = data[(py * 64 + px) * 4 + 3];
      weight += alpha;
      moment += (px - left + 0.5) * alpha;
    }
  metrics.push([w, weight, moment / weight]);
  lines.push(
    `char id=${48 + i} x=${x + left} y=${y + top} width=${w} height=${h} xoffset=0 yoffset=${(48 - h) / 2} xadvance=${w + 3} page=0 chnl=15`,
  );
}
writeFileSync(
  'assets/scripts/containerTypography.ts',
  `// Generated from visible digit ink; do not use system-font advance widths.\nconst metrics: number[][] = ${JSON.stringify(metrics)};\n\nexport function containerNumberOffset(text: string, size: number): number {\n    let pen = 0, weight = 0, moment = 0, right = 0;\n    for (const digit of text) {\n        const [width, mass, center] = metrics[Number(digit)];\n        moment += (pen + center) * mass;\n        weight += mass;\n        right = pen + width;\n        pen += width + 3;\n    }\n    return weight ? (right / 2 - moment / weight) * size / 48 : 0;\n}\n`,
);
const base = 'assets/resources/fonts/container-digits';
writeFileSync(base + '.png', canvas.toBuffer('image/png'));
writeFileSync(base + '.fnt', lines.join('\n') + '\n');
if (!existsSync(base + '.png.meta')) {
  const meta = JSON.parse(readFileSync('assets/resources/ants/workers.png.meta', 'utf8')),
    id = randomUUID();
  meta.uuid = id;
  for (const sub of Object.values(meta.subMetas)) {
    sub.uuid = id + '@6c48a';
    sub.displayName = 'container-digits';
    sub.userData.imageUuidOrDatabaseUri = id;
  }
  meta.userData.redirect = id + '@6c48a';
  writeFileSync(base + '.png.meta', JSON.stringify(meta, null, 2) + '\n');
}
if (!existsSync(base + '.fnt.meta'))
  writeFileSync(
    base + '.fnt.meta',
    JSON.stringify(
      {
        ver: '1.0.6',
        importer: 'bitmap-font',
        imported: false,
        uuid: randomUUID(),
        files: [],
        subMetas: {},
        userData: {},
      },
      null,
      2,
    ) + '\n',
  );
console.log('Clean container digits generated.');

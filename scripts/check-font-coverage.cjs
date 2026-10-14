// Check the shipped bitmap, including dynamic artwork names and UI copy.
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const glyphs = new Map();
for (const line of readFileSync('assets/resources/fonts/ant-nest-bitmap.fnt', 'utf8').split('\n')) {
  if (!line.startsWith('char id=')) continue;
  const glyph = Object.fromEntries(
    [...line.matchAll(/(\w+)=(-?[\d.]+)/g)].map((m) => [m[1], Number(m[2])]),
  );
  glyphs.set(glyph.id, glyph);
}
const required = new Set(Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)));
for (const file of readdirSync('assets/scripts', { recursive: true }).filter((f) =>
  f.endsWith('.ts'),
))
  for (const char of readFileSync(`assets/scripts/${file}`, 'utf8'))
    if (char.codePointAt(0) >= 160) required.add(char);
for (const char of readFileSync('cloudfunctions/game/service.js', 'utf8'))
  if (char.codePointAt(0) >= 160) required.add(char);
const missing = [...required].filter((char) => {
  const glyph = glyphs.get(char.codePointAt(0));
  return !glyph || (!/\s/u.test(char) && !(glyph.width > 0 && glyph.height > 0));
});
assert.deepEqual(
  missing,
  [],
  `UI font is missing glyphs: ${missing.join(' ')}. Regenerate the TTF subset and bitmap together.`,
);
console.log(`UI font coverage passed: ${required.size} characters, including all artwork names.`);

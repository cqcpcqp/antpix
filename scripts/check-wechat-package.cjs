// Validate the final package, including files copied after the Creator build.
const assert = require('node:assert/strict');
const { readFileSync, existsSync, readdirSync, statSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve('build/wechatgame');
const game = JSON.parse(readFileSync(resolve(root, 'game.json'), 'utf8'));
assert.equal(game.openDataContext, 'open-data');
for (const name of [
  'game.js',
  'project.config.json',
  'open-data/index.js',
  'THIRD_PARTY_NOTICES.txt',
])
  assert.ok(existsSync(resolve(root, name)), `Incomplete WeChat package: ${name}`);
assert.deepEqual(
  readFileSync(resolve(root, 'open-data/index.js')),
  readFileSync('wechat/open-data/index.js'),
);
const size = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const path = resolve(dir, entry.name);
    return total + (entry.isDirectory() ? size(path) : statSync(path).size);
  }, 0);
const bytes = size(root);
assert.ok(bytes < 4 * 1024 * 1024, `WeChat main package is ${(bytes / 1024).toFixed(1)} KiB`);
console.log(
  `WeChat package complete: ${(bytes / 1024).toFixed(1)} / 4096 KiB, open-data entry verified.`,
);

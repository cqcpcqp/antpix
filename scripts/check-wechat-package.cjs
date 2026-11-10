// Validate the final package, including files copied after the Creator build.
const assert = require('node:assert/strict');
const { readFileSync, existsSync, readdirSync, statSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve('build/wechatgame');
const game = JSON.parse(readFileSync(resolve(root, 'game.json'), 'utf8'));
assert.equal(game.openDataContext, 'open-data');
for (const name of [
  'game.js',
  'logo.png',
  'slogan.png',
  'project.config.json',
  'open-data/index.js',
  'THIRD_PARTY_NOTICES.txt',
  'startup/painter.js',
  'startup/layout.js',
  'startup/assets.js',
])
  assert.ok(existsSync(resolve(root, name)), `Incomplete WeChat package: ${name}`);
assert.deepEqual(
  readFileSync(resolve(root, 'open-data/index.js')),
  readFileSync('wechat/open-data/index.js'),
);
const { checkStartupModules } = require('./check-startup-modules.cjs');
const { layout: startup, artwork } = checkStartupModules(root);
assert.equal(startup.registration, '沪ICP备2026059452');
for (const path of Object.values(artwork)) assert.ok(existsSync(resolve(root, path)));
assert.deepEqual(
  readFileSync(resolve(root, 'first-screen.js')),
  readFileSync('wechat/startup/first-screen.js'),
);
const settings = JSON.parse(readFileSync(resolve(root, 'src/settings.json'), 'utf8'));
assert.equal(settings.splashScreen.totalTime, 0);
assert.equal(settings.splashScreen.logo.type, 'none');
for (const name of ['logo.png', 'slogan.png'])
  assert.deepEqual(
    readFileSync(resolve(root, name)).subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    `Invalid WeChat upload image: ${name}`,
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

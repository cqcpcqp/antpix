import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const name = 'level-catalog';
const packageRoot = `subpackages/${name}/`;
const modulePrefix = 'System.register("chunks:///_virtual/levels.ts",';
const start = "firstScreen.start('default', 'default', 'false').then(() => {";

/** Moves the emitted catalog to an ordinary WeChat subpackage while retaining its SystemJS ID. */
export function installLevelCatalog(root) {
  const mainPath = resolve(root, 'assets/main/index.js');
  const entryPath = resolve(root, 'game.js');
  const configPath = resolve(root, 'game.json');
  const lines = readFileSync(mainPath, 'utf8').split('\n');
  const catalog = lines.filter((line) => line.startsWith(modulePrefix));
  assert.equal(catalog.length, 1, 'Expected one Cocos level catalog module');
  assert.ok(catalog[0].endsWith('));'), 'Expected one complete level catalog registration');

  const entry = readFileSync(entryPath, 'utf8');
  assert.equal(entry.split(start).length, 2, 'Expected one Cocos first-screen boot sequence');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.ok(!config.subpackages.some((item) => item.name === name));
  config.subpackages.push({ name, root: packageRoot });

  mkdirSync(resolve(root, packageRoot), { recursive: true });
  writeFileSync(resolve(root, packageRoot, 'game.js'), catalog[0] + '\n');
  writeFileSync(mainPath, lines.filter((line) => !line.startsWith(modulePrefix)).join('\n'));
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  writeFileSync(
    entryPath,
    entry.replace(
      start,
      `function loadLevelCatalog() {
    return new Promise((resolve, reject) => {
        wx.loadSubpackage({
            name: '${name}',
            success: resolve,
            fail(error) {
                wx.showModal({
                    title: '关卡加载失败',
                    content: '请检查网络后重试',
                    confirmText: '重试',
                    showCancel: false,
                    success: () => loadLevelCatalog().then(resolve, reject),
                    fail: () => reject(error),
                });
            },
        });
    });
}

${start}
    return loadLevelCatalog();
}).then(() => {`,
    ),
  );
}

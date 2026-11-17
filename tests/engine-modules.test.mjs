import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { engineExports, checkEngineModules } = require('../scripts/check-engine-modules.cjs');

test('avatar masking is enabled in both Creator engine selections', () => {
  const { modules } = JSON.parse(readFileSync('settings/v2/packages/engine.json', 'utf8'));
  const config = modules.configs[modules.globalConfigKey];
  assert.equal(config.cache.mask._value, true);
  assert.equal(config.cache.ui._value, true);
  assert.ok(config.includeModules.includes('ui'));
  assert.ok(config.includeModules.includes('mask'));
});

test('engine export inspection distinguishes actual exports from internal component references', () => {
  const stripped =
    'System.register([], (function (publish, context) { return { execute: function () { const deprecated = "Mask"; publish({ Sprite: SpriteClass }); } }; }));';
  assert.deepEqual([...engineExports(stripped)], ['Sprite']);
  const enabled = stripped.replace('Sprite: SpriteClass', 'Sprite: SpriteClass, Mask: MaskClass');
  assert.deepEqual([...engineExports(enabled)], ['Sprite', 'Mask']);
});

if (process.env.CHECK_BUILT)
  test('real WeChat engine exports the components used by leaderboard avatars', () => {
    checkEngineModules('build/wechatgame');
  });

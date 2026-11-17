import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { sharingFixture } from './helpers/wechat-sharing.mjs';
const require = createRequire(import.meta.url);
const ts = require('typescript');

function load(wx) {
  if (process.env.CHECK_BUILT) {
    const { cc } = require('../scripts/headless-game.cjs');
    const built = require('../scripts/load-built.cjs')(cc, wx ? { wx } : {});
    return built('chunks:///_virtual/sharing.ts').initializeWechatSharing;
  }
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(readFileSync('assets/scripts/platform/wechat/sharing.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    { module, exports: module.exports, ...(wx ? { wx } : {}) },
  );
  return module.exports.initializeWechatSharing;
}

test('native sharing enables both menus and releases only its own callbacks on teardown', () => {
  const f = sharingFixture();
  const existing = () => ({ title: 'other subscriber' });
  f.api.onShareAppMessage(existing);
  f.api.onShareTimeline(existing);
  const initialize = load(f.api);
  const dispose = initialize();
  assert.deepEqual(f.menus, ['shareAppMessage', 'shareTimeline']);
  for (const handlers of [f.friends, f.timeline]) {
    assert.equal(handlers.size, 2);
    const handler = [...handlers].find((entry) => entry !== existing);
    assert.match(handler().title, /生态蚂蚁窝/);
  }
  dispose();
  assert.deepEqual([...f.friends], [existing]);
  assert.deepEqual([...f.timeline], [existing]);
  const disposeAgain = initialize();
  assert.equal(f.friends.size, 2, 'scene re-entry registers one fresh callback');
  disposeAgain();
  assert.equal(f.friends.size, 1);
});

test('non-WeChat previews start and tear down without a native SDK', () => {
  assert.doesNotThrow(() => load(undefined)()());
});

test('clients without timeline APIs retain friend forwarding', () => {
  const f = sharingFixture();
  delete f.api.onShareTimeline;
  delete f.api.offShareTimeline;
  const dispose = load(f.api)();
  assert.deepEqual(f.menus, ['shareAppMessage']);
  assert.equal(f.friends.size, 1);
  assert.equal(f.timeline.size, 0);
  dispose();
  assert.equal(f.friends.size, 0);
});

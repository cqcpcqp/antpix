import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');

function load(wx, page = 'RECOMMENDATION_OPENLINK') {
  if (process.env.CHECK_BUILT) {
    const { cc } = require('../scripts/headless-game.cjs');
    const built = require('../scripts/load-built.cjs')(cc, { wx });
    const api = built('chunks:///_virtual/WechatPage.ts');
    return new api.WechatPage(api[page]);
  }
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(readFileSync('assets/scripts/platform/wechat/WechatPage.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    { module, exports: module.exports, wx },
  );
  return new module.exports.WechatPage(module.exports[page]);
}

test('recommendation serializes opening, retries SDK failures and releases the native page', async () => {
  let resolveShow;
  let creates = 0;
  let destroys = 0;
  const requests = [];
  const manager = {
    show: (options) => {
      requests.push(options);
      return new Promise((resolve) => (resolveShow = resolve));
    },
    destroy: () => destroys++,
  };
  const recommendation = load({ createPageManager: () => (creates++, manager) });
  const opening = recommendation.show();
  assert.equal(await recommendation.show(), 'busy');
  assert.equal(
    requests[0].openlink,
    'TWFRCqV5WeM2AkMXhKwJ03MhfPOieJfAsvXKUbWvQFQtLyyA5etMPabBehga950uzfZcH3Vi3QeEh41xRGEVFw',
  );
  resolveShow();
  assert.equal(await opening, 'shown');
  const failure = new Error('network unavailable');
  manager.show = () => Promise.reject(failure);
  await assert.rejects(recommendation.show(), (error) => error === failure);
  manager.show = () => Promise.resolve();
  assert.equal(await recommendation.show(), 'shown');
  assert.equal(creates, 1);
  recommendation.destroy();
  recommendation.destroy();
  assert.equal(destroys, 1);
  assert.equal(await recommendation.show(), 'busy');
});

test('previews and older WeChat clients cannot invoke the native recommendation', async () => {
  for (const wx of [undefined, {}]) {
    const recommendation = load(wx);
    assert.equal(await recommendation.show(), 'unsupported');
    recommendation.destroy();
  }
});

test('game circle opens the supplied homepage independently of recommendation and releases its page', async () => {
  const requests = [];
  let destroys = 0;
  const wx = {
    createPageManager: () => ({
      show: async (options) => {
        requests.push(options.openlink);
      },
      destroy: () => destroys++,
    }),
  };
  const circle = load(wx, 'GAME_CLUB_OPENLINK');
  const recommendation = load(wx);
  await circle.show();
  await recommendation.show();
  await circle.show();
  assert.equal(requests[0], requests[2]);
  assert.notEqual(requests[0], requests[1]);
  assert.ok(requests[0].startsWith('-SSEykJvFV3pORt5kTNpSxp0AahrVL-1'));
  assert.ok(requests[0].includes('HRSwYhnyT-_WBvufCP7fklrjsKWPBTV_'));
  assert.ok(requests[0].endsWith('OuZPDPR05zm_jt6_vyWIQ'));
  assert.equal(requests[0].includes('\\'), false, 'Markdown escaping is not part of the openlink');
  circle.destroy();
  recommendation.destroy();
  assert.equal(destroys, 2);
});

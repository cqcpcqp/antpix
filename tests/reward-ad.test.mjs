import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const flush = () => new Promise(setImmediate);

function fixture() {
  const ads = [];
  const module = { exports: {} };
  const wx = {
    createRewardedVideoAd({ adUnitId }) {
      const close = new Set();
      const error = new Set();
      const ad = {
        adUnitId,
        shows: 0,
        loads: 0,
        failShows: 0,
        failLoad: false,
        async show() {
          this.shows++;
          if (this.failShows-- > 0) {
            for (const listener of error) listener();
            throw new Error('show failed');
          }
        },
        async load() {
          this.loads++;
          if (this.failLoad) {
            for (const listener of error) listener();
            throw new Error('load failed');
          }
        },
        onClose: (listener) => close.add(listener),
        offClose: (listener) => close.delete(listener),
        onError: (listener) => error.add(listener),
        offError: (listener) => error.delete(listener),
        close(ended) {
          for (const listener of close) listener({ isEnded: ended });
        },
        error() {
          for (const listener of error) listener();
        },
        listeners: () => close.size + error.size,
      };
      ads.push(ad);
      return ad;
    },
  };
  if (process.env.CHECK_BUILT) {
    const { cc } = require('../scripts/headless-game.cjs');
    const load = require('../scripts/load-built.cjs')(cc, { wx });
    return { ads, show: load('chunks:///_virtual/rewardAd.ts').showRewardedVideo };
  }
  vm.runInNewContext(
    ts.transpileModule(readFileSync('assets/scripts/platform/wechat/rewardAd.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    { module, exports: module.exports, wx },
  );
  return { ads, show: module.exports.showRewardedVideo };
}

test('real placement IDs are routed separately, instances reused, and playback serialized', async () => {
  const { ads, show } = fixture();
  const speed = show('speed');
  assert.equal(ads[0].adUnitId, 'adunit-f322986754089230');
  assert.equal(await show('slot'), false);
  ads[0].close(true);
  assert.equal(await speed, true);
  const slot = show('slot');
  assert.equal(ads[1].adUnitId, 'adunit-f249e4574cf20141');
  ads[1].close(false);
  assert.equal(await slot, false);
  const again = show('speed');
  assert.equal(ads.length, 2);
  ads[0].close(true);
  assert.equal(await again, true);
  assert.equal(ads[0].listeners() + ads[1].listeners(), 0);
});

test('failed show retries load/show once even when SDK emits onError first', async () => {
  const { ads, show } = fixture();
  const warmup = show('slot');
  ads[0].close(false);
  await warmup;
  const ad = ads[0];
  ad.failShows = 1;
  const watching = show('slot');
  await flush();
  assert.equal(ad.shows, 3);
  assert.equal(ad.loads, 1);
  assert.equal(ad.listeners(), 2);
  ad.close(true);
  assert.equal(await watching, true);
  assert.equal(ad.listeners(), 0);
});

test('load failure, retry show failure, and visible-video error grant nothing and allow retry', async () => {
  for (const failure of ['load', 'show', 'visible']) {
    const { ads, show } = fixture();
    const warmup = show('speed');
    ads[0].close(false);
    await warmup;
    const ad = ads[0];
    ad.failShows = failure === 'visible' ? 0 : failure === 'show' ? 2 : 1;
    ad.failLoad = failure === 'load';
    const watching = show('speed');
    await flush();
    if (failure === 'visible') ad.error();
    assert.equal(await watching, false, failure);
    assert.equal(ad.listeners(), 0);
    ad.failShows = 0;
    ad.failLoad = false;
    const retry = show('speed');
    ad.close(true);
    assert.equal(await retry, true);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import { freshProfile, FURNISHINGS } from '../assets/scripts/domain/profile/profile.ts';
const require = createRequire(import.meta.url);
const { cc, resourceLoads } = require('../scripts/headless-game.cjs');
const ts = require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript');
const { createService } = require('../cloudfunctions/game/service.js');
const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise(setImmediate);
};

// Run the real scene against a callback SDK, including the exact review error.
function fixture({ local = new Map(), handler, cloudMissing = false } = {}) {
  const actions = [];
  const records = new Map();
  let serial = 0;
  const service = createService(
    {
      transaction: (work) =>
        work({
          get: async (collection, id) => structuredClone(records.get(collection + id)),
          set: async (collection, id, data) => records.set(collection + id, structuredClone(data)),
        }),
      leaderboard: async () => [],
    },
    Date.now,
    () => 'offline-test-' + ++serial,
  );
  const wx = cloudMissing
    ? {}
    : {
        cloud: {
          init() {},
          callFunction(options) {
            actions.push(options.data);
            if (handler?.(options)) return;
            service(options.data, { APPID: 'wxd8e27ad9cd0289df', OPENID: 'offline-user' }).then(
              (result) => options.success({ result }),
              options.fail,
            );
          },
        },
        createRewardedVideoAd() {
          throw new Error('offline play must not request advertisements');
        },
      };
  cc.sys.localStorage = {
    getItem: (key) => (key === 'ant-controls-seen' ? '1' : (local.get(key) ?? null)),
    setItem: (key, value) => local.set(key, value),
    removeItem: (key) => local.delete(key),
  };
  const cache = new Map();
  const built = process.env.CHECK_BUILT ? require('../scripts/load-built.cjs')(cc, { wx }) : null;
  function load(path) {
    if (built) return built('chunks:///_virtual/' + path.split('/').pop());
    if (cache.has(path)) return cache.get(path);
    const module = { exports: {} };
    cache.set(path, module.exports);
    const source = readFileSync(path, 'utf8');
    vm.runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          experimentalDecorators: true,
        },
      }).outputText,
      {
        wx,
        module,
        exports: module.exports,
        console,
        require: (name) => (name === 'cc' ? cc : load(resolve(dirname(path), name + '.ts'))),
      },
    );
    return module.exports;
  }
  const { PixelGarden } = load(resolve('assets/scripts/PixelGarden.ts'));
  function open() {
    const game = new PixelGarden();
    game.onLoad();
    for (const [path, callback] of resourceLoads) {
      const asset = new cc.Texture2D();
      asset.width = path === 'home/title/texture' ? 1152 : 1024;
      asset.height = path === 'home/title/texture' ? 384 : 1536;
      callback(null, asset);
    }
    return game;
  }
  return { open, local, actions, records };
}
function finishStartup(game) {
  assert.equal(game.runtime.startup.progress, 100);
  for (let i = 0; i < 4; i++) game.update(0.05);
  assert.equal(game.runtime.startup.active, false);
  assert.equal(game.runtime.startupView.root, null);
}
function textIn(node, value) {
  return (
    node.components.some((component) => component.string === value) ||
    node.children.some((child) => textIn(child, value))
  );
}

test('review -9003 starts a fresh offline game with persisted progress, rewards and decoration', async () => {
  const f = fixture({
    handler(options) {
      options.fail({ errCode: -9003, errMsg: "api can't use in offline mode" });
      return true;
    },
  });
  const game = f.open();
  await flush();
  finishStartup(game);
  const r = game.runtime;
  assert.equal(r.cloud.cloudMode, false);
  assert.equal(r.cloud.cloudBusy, false);
  assert.equal(r.cloud.cloudRetry, null);
  r.session.startLevel(0);
  assert.ok(r.session.model);
  r.session.elapsed = 120;
  r.session.model.moves = 64;
  r.victory.victory();
  assert.equal(r.profile.save.unlocked, 1);
  assert.ok(r.profile.save.completed.includes(0));
  r.victory.finishCelebration();
  r.home.showHome();
  r.home.homeRewardButton.emit('end');
  assert.equal(r.profile.save.coins, 130);
  r.home.showHome();
  assert.equal(r.home.homeRewardButton, null, 'rewards cannot be claimed twice');
  r.session.startLevel(1);
  r.session.elapsed = 120;
  r.victory.victory();
  r.home.showHome();
  r.home.homeRewardButton.emit('end');
  const item = FURNISHINGS[0];
  r.shop.purchaseFurnishing(item);
  assert.equal(r.profile.save.coins, 230 - item.price);
  assert.equal(r.profile.save.courtyard.equipped[item.slot], item.id);
  r.shop.clearFurnishing(item.slot);
  assert.equal(r.profile.save.courtyard.equipped[item.slot], '');
  r.shop.purchaseFurnishing(item);
  assert.equal(r.profile.save.coins, 230 - item.price, 'owned decorations equip for free');
  r.social.leaderboard();
  assert.ok(textIn(r.overlays.modal, '本机速通榜 · 按每关最佳用时排序'));
  r.home.showHome();
  r.session.startLevel(2);
  assert.equal(f.actions.length, 1, 'offline gameplay never invokes cloud actions');
  game.onDestroy();
  const reopened = f.open();
  finishStartup(reopened);
  assert.equal(reopened.runtime.profile.save.unlocked, 2);
  assert.equal(reopened.runtime.profile.save.coins, 230 - item.price);
  assert.equal(reopened.runtime.profile.save.courtyard.equipped[item.slot], item.id);
  assert.equal(f.actions.length, 1, 'saved local selection survives restart');
  reopened.onDestroy();
});

test('missing cloud SDK and ordinary network failures also allow first-time local play', async () => {
  for (const options of [
    { cloudMissing: true },
    {
      handler: ({ fail }) => {
        fail(new Error('network unavailable'));
        return true;
      },
    },
  ]) {
    const f = fixture(options);
    const game = f.open();
    await flush();
    finishStartup(game);
    assert.equal(game.runtime.cloud.cloudMode, false);
    game.runtime.session.startLevel(0);
    assert.equal(game.runtime.home.home, null);
    game.onDestroy();
  }
});

test('silent login times out and late login cannot replace local progress or reopen UI', async () => {
  let login;
  const f = fixture({
    handler(options) {
      login = options;
      return true;
    },
  });
  const game = f.open();
  assert.equal(game.runtime.startup.progress, 90);
  game.update(8);
  finishStartup(game);
  game.runtime.session.startLevel(0);
  game.runtime.session.elapsed = 30;
  game.runtime.victory.victory();
  game.runtime.settings.settings();
  const settings = game.runtime.overlays.modal;
  login.success({
    result: {
      ok: true,
      profile: freshProfile(),
      highest: 0,
      reachedAt: 0,
      serverTime: Date.now(),
      output: { userId: 'late-user' },
    },
  });
  await flush();
  assert.equal(game.runtime.cloud.cloudMode, false);
  assert.equal(game.runtime.profile.save.unlocked, 1);
  assert.equal(game.runtime.overlays.modal, settings);
  game.onDestroy();
});

test('local/cloud switching preserves separate assets and audio preferences, including reconnect failure', async () => {
  const localProfile = freshProfile();
  localProfile.coins = 777;
  const local = new Map([
    ['ant-play-mode', 'local'],
    ['pixel-garden-v1', JSON.stringify(localProfile)],
  ]);
  let failLogin = false;
  const f = fixture({
    local,
    handler(options) {
      if (failLogin) {
        options.fail({ errCode: -9003 });
        return true;
      }
    },
  });
  const game = f.open();
  finishStartup(game);
  const r = game.runtime;
  assert.equal(f.actions.length, 0);
  r.profile.save.music = false;
  r.profile.persist();
  r.settings.settings();
  assert.ok(textIn(r.overlays.modal, '存档：本机'));
  r.settings.playMode();
  r.overlays.modal.children.find((node) => node.name === '使用云存档').emit('end');
  await flush();
  assert.equal(r.cloud.cloudMode, true);
  assert.equal(r.cloud.cloudReady, true);
  assert.equal(r.profile.save.coins, 0);
  assert.equal(r.profile.save.music, false);
  r.cloud.claimCloudRewards();
  await flush();
  assert.equal(r.profile.save.coins, 30);
  assert.equal(JSON.parse(local.get('pixel-garden-v1')).coins, 777);
  r.cloud.enterOffline();
  assert.equal(r.profile.save.coins, 777);
  assert.equal(r.profile.save.music, false);
  failLogin = true;
  r.cloud.useCloud();
  await flush();
  assert.equal(r.cloud.cloudMode, false);
  assert.equal(r.profile.save.coins, 777);
  failLogin = false;
  r.cloud.useCloud();
  await flush();
  assert.equal(r.profile.save.coins, 30, 'cloud account keeps its own assets');
  assert.equal(JSON.parse(local.get('pixel-garden-v1')).coins, 777);
  game.onDestroy();
});

test('business login rejection remains visible and is never converted into offline success', async () => {
  const f = fixture({
    handler({ success }) {
      success({ result: { ok: false, code: 'VERSION', message: '请更新游戏后重试' } });
      return true;
    },
  });
  const game = f.open();
  await flush();
  assert.equal(game.runtime.cloud.cloudMode, true);
  assert.equal(game.runtime.startup.progress, 90);
  assert.ok(game.runtime.cloud.cloudMessage.includes('请更新游戏后重试'));
  assert.equal(game.runtime.cloud.offlineAvailable, false);
  game.onDestroy();
});

test('failed cloud writes retain receipts and offer isolated local play without granting cloud assets', async () => {
  let failClaim = true;
  const f = fixture({
    handler({ data, fail }) {
      if (data.action === 'claim' && failClaim) {
        fail(new Error('network lost'));
        return true;
      }
    },
  });
  const game = f.open();
  await flush();
  finishStartup(game);
  const r = game.runtime;
  r.cloud.claimCloudRewards();
  await flush();
  assert.equal(r.profile.save.coins, 0);
  const pendingKey = [...f.local.keys()].find((key) => key.startsWith('ant-cloud-pending:'));
  const pending = f.local.get(pendingKey);
  assert.ok(pending);
  const button = r.cloudStatus.cloudStatus.children.find((node) => node.name === '离线游玩');
  assert.ok(button);
  button.emit('end');
  assert.equal(r.cloud.cloudMode, false);
  assert.equal(r.cloud.cloudBusy, false);
  assert.equal(f.local.get(pendingKey), pending);
  r.session.startLevel(0);
  assert.ok(r.session.model);
  r.home.showHome();
  failClaim = false;
  r.cloud.useCloud();
  await flush();
  assert.equal(r.cloud.cloudReady, true);
  assert.equal(r.profile.save.coins, 30, 'pending cloud write replays once on reconnect');
  assert.equal(f.local.has(pendingKey), false);
  game.onDestroy();
});

test('silent cloud write can reconnect and replay once while ignoring its late response', async () => {
  let heldClaim;
  const f = fixture({
    handler(options) {
      if (options.data.action === 'claim' && !heldClaim) {
        heldClaim = options;
        return true;
      }
    },
  });
  const game = f.open();
  await flush();
  finishStartup(game);
  const r = game.runtime;
  r.cloud.claimCloudRewards();
  game.update(8);
  assert.ok(r.cloud.offlineAvailable);
  assert.equal(r.profile.save.coins, 0);
  r.cloudStatus.cloudStatus.emit('end');
  await flush();
  assert.equal(r.cloud.cloudReady, true);
  assert.equal(r.cloud.cloudBusy, false);
  assert.equal(r.profile.save.coins, 30);
  const currentProfile = r.profile.save;
  heldClaim.success({ result: { ok: true, profile: freshProfile(), output: {} } });
  await flush();
  assert.equal(r.profile.save, currentProfile);
  assert.equal(r.profile.save.coins, 30);
  game.onDestroy();
});

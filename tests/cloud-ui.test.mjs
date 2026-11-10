import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { cc, resourceLoads } = require('../scripts/headless-game.cjs');
const ts = require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript');
const { createService } = require('../cloudfunctions/game/service.js');
const { levels } = require('../cloudfunctions/game/catalog.json');
const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
};

test('WeChat scene waits for cloud, settles victories and resumes with server progress', async () => {
  const records = new Map(),
    local = new Map([['ant-controls-seen', '1']]);
  let now = Date.now(),
    serial = 0;
  let releaseLogin;
  let loginGate = new Promise((resolve) => {
    releaseLogin = resolve;
  });
  let releaseBoard;
  let boardGate = null;
  let failClaim = false;
  let friendPermission;
  let settingsOpened = 0;
  let identityTap;
  let identityDestroyed = 0;
  const service = createService(
    {
      transaction: async (work) =>
        work({
          get: async (collection, id) => structuredClone(records.get(collection + id)),
          set: async (collection, id, data) => {
            records.set(collection + id, structuredClone(data));
          },
        }),
      leaderboard: async () => [],
    },
    () => now,
    () => 'run-' + ++serial,
  );
  const hidden = new Set(),
    shown = new Set(),
    actions = [],
    friendMessages = [];
  const wx = {
    cloud: {
      init: ({ env }) => assert.equal(env, 'cloudbase-d9glil4qk6b5865ba'),
      callFunction: async ({ name, data }) => {
        assert.equal(name, 'game');
        actions.push(data.action);
        if (data.action === 'login' && loginGate) await loginGate;
        if (data.action === 'leaderboard' && boardGate) await boardGate;
        if (data.action === 'claim' && failClaim) throw new Error('test connection failure');
        return {
          result: await service(data, { APPID: 'wxd8e27ad9cd0289df', OPENID: 'scene-user' }),
        };
      },
    },
    setUserCloudStorage: ({ success }) => success(),
    authorize: ({ success }) => success(),
    requirePrivacyAuthorize: ({ success }) => success(),
    getSetting: ({ success }) =>
      success({ authSetting: { 'scope.WxFriendInteraction': friendPermission } }),
    openSetting: ({ success }) => {
      settingsOpened++;
      friendPermission = true;
      success({ authSetting: { 'scope.WxFriendInteraction': true } });
    },
    createUserInfoButton: () => ({
      onTap: (callback) => {
        identityTap = callback;
      },
      destroy: () => {
        identityDestroyed++;
      },
    }),
    getOpenDataContext: () => ({ postMessage: (message) => friendMessages.push(message) }),
  };
  cc.sys.localStorage = {
    getItem: (key) => local.get(key) ?? null,
    setItem: (key, value) => local.set(key, value),
    removeItem: (key) => local.delete(key),
  };
  let load;
  if (process.env.CHECK_BUILT) {
    const built = require('../scripts/load-built.cjs')(cc, { wx });
    load = (path) => built('chunks:///_virtual/' + path.split('/').pop());
  } else {
    const cache = new Map();
    load = (path) => {
      if (cache.has(path)) return cache.get(path);
      const module = { exports: {} };
      cache.set(path, module.exports);
      const code = ts.transpileModule(readFileSync(path, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          experimentalDecorators: true,
        },
      }).outputText;
      vm.runInNewContext(code, {
        wx,
        module,
        exports: module.exports,
        console,
        require: (name) => (name === 'cc' ? cc : load(resolve(dirname(path), name + '.ts'))),
      });
      return module.exports;
    };
  }
  const { PixelGarden } = load(resolve('assets/scripts/PixelGarden.ts'));
  const game = new PixelGarden();
  game.onLoad();
  assert.equal(game.runtime.cloud.cloudBusy, true);
  assert.equal(game.runtime.overlays.modal, null, 'login must not open a blocking dialog');
  assert.equal(game.runtime.cloudStatus.cloudStatus, null, 'startup owns the only login status');
  assert.ok(game.runtime.startupView.root, 'login stays in the unified startup surface');
  // Apply real loader callbacks before interacting with the ready app.
  for (const [path, callback] of resourceLoads) {
    const asset = new cc.Texture2D();
    asset.width = path === 'home/title/texture' ? 1152 : 1024;
    asset.height = path === 'home/title/texture' ? 384 : 1536;
    callback(null, asset);
  }
  assert.equal(game.runtime.startup.progress, 90, 'resources alone cannot finish startup');
  const beforeLoginActions = actions.length;
  game.runtime.session.startLevel(0);
  assert.equal(actions.length, beforeLoginActions, 'cannot start before progress is known');
  game.runtime.settings.settings();
  const settings = game.runtime.overlays.modal;
  releaseLogin();
  loginGate = null;
  await flush();
  assert.equal(game.runtime.startup.progress, 100);
  for (let i = 0; i < 4; i++) game.runtime.startup.update(0.05);
  assert.equal(game.runtime.startupView.root, null);
  assert.equal(game.runtime.overlays.modal, settings, 'login must not dismiss local settings');
  game.runtime.overlays.closeModal();

  assert.equal(game.runtime.cloud.cloudBusy, false);
  assert.equal(game.runtime.profile.save.unlocked, 0);
  game.runtime.session.startLevel(0);
  assert.equal(game.runtime.cloud.cloudBusy, true);
  assert.equal(game.runtime.overlays.modal, null, 'starting keeps the homepage visible');
  const startCount = actions.filter((action) => action === 'start').length;
  game.runtime.session.startLevel(0);
  assert.equal(actions.filter((action) => action === 'start').length, startCount);
  await flush();
  assert.equal(game.runtime.cloud.cloudRunId, 'run-2');
  const previousRequests = actions.length;

  now += 120000;
  game.runtime.session.elapsed = 120;
  game.runtime.session.model.moves = levels[0].moves[0];
  game.runtime.victory.victory();
  assert.equal(
    game.runtime.profile.save.completed.length,
    0,
    'no optimistic progress before cloud confirmation',
  );
  game.runtime.settings.settings();
  const savingSettings = game.runtime.overlays.modal;
  await flush();
  assert.equal(
    game.runtime.overlays.modal,
    savingSettings,
    'settlement must preserve an open settings drawer',
  );
  game.runtime.overlays.closeModal();
  game.runtime.overlays.updateOverlays(0);
  assert.equal(game.runtime.profile.save.unlocked, 1);
  assert.equal(game.runtime.profile.save.completed[0], 0);
  assert.ok(game.runtime.victory.celebration);
  game.runtime.victory.finishCelebration();
  const victoryView = game.runtime.overlays.modal;
  failClaim = true;
  game.runtime.cloud.claimCloudRewards();
  await flush();
  assert.equal(game.runtime.overlays.modal, victoryView, 'failure keeps the original content');
  assert.equal(game.runtime.profile.save.coins, 0, 'failed claim must not grant optimistic coins');
  assert.ok(game.runtime.cloud.cloudRetry);
  failClaim = false;
  game.runtime.cloudStatus.cloudStatus.emit('end');
  await flush();
  assert.equal(game.runtime.profile.save.coins, 130);
  boardGate = new Promise((resolve) => {
    releaseBoard = resolve;
  });
  game.runtime.social.worldLeaderboard(0);
  assert.ok(
    game.runtime.overlays.modal.children.some((node) =>
      node.components.some((c) => c.string === '世界排行榜'),
    ),
  );
  assert.equal(
    game.runtime.cloudStatus.cloudStatus.parent,
    game.runtime.overlays.modal,
    'rank loading stays in the rank content',
  );
  game.runtime.overlays.closeModal();
  assert.equal(game.runtime.cloud.cloudBusy, false, 'leaving a read-only view releases the UI');
  game.runtime.settings.settings();
  const newerView = game.runtime.overlays.modal;
  releaseBoard();
  boardGate = null;
  await flush();
  assert.equal(
    game.runtime.overlays.modal,
    newerView,
    'late rank data must not reopen a dismissed view',
  );
  game.runtime.overlays.closeModal();
  game.runtime.social.friendLeaderboard(0);
  await flush();
  game.runtime.overlays.modal.children.find((node) => node.name === '刷新').emit('end');
  assert.equal(friendMessages.filter((message) => message.type === 'ant-friends').length, 2);
  game.runtime.overlays.closeModal();
  friendPermission = false;
  game.runtime.social.friendLeaderboard(0);
  await flush();
  const permissionPanel = game.runtime.overlays.modal;
  permissionPanel.children.find((node) => node.name === '打开授权设置').emit('end');
  assert.equal(settingsOpened, 1, 'openSetting is called directly within the user click');
  await flush();
  assert.ok(game.runtime.overlays.modal.children.some((node) => node.name === 'Friend board'));
  game.runtime.overlays.closeModal();
  game.runtime.social.worldLeaderboard(0);
  await flush();
  game.runtime.overlays.modal.children.find((node) => node.name === '微信头像昵称').emit('end');
  await flush();
  identityTap({
    errMsg: 'getUserInfo:ok',
    userInfo: {
      nickName: '真实昵称',
      avatarUrl: 'https://thirdwx.qlogo.cn/mmopen/test/132',
    },
  });
  await flush();
  assert.equal(identityDestroyed, 1);
  assert.ok(actions.includes('identity'), 'identity is persisted only after native authorization');

  game.runtime.overlays.closeModal();
  assert.equal(
    local.has('pixel-garden-v1'),
    false,
    'cloud assets are not written to legacy local save',
  );
  const reopened = new PixelGarden();
  reopened.onLoad();
  await flush();
  assert.equal(reopened.runtime.profile.save.selected, 1);
  assert.equal(reopened.runtime.profile.save.coins, 130);
});

test('open data domain sorts friends, stays on valid pages and ignores late responses', () => {
  let receive;
  const requests = [],
    text = [],
    images = [],
    drawn = [];
  const context = {
    clearRect() {
      text.length = 0;
    },
    drawImage: (image) => drawn.push(image),
    save() {},
    restore() {},
    scale() {},
    fillText: (value) => text.push(value),
  };
  const wx = {
    getSharedCanvas: () => ({ width: 640, height: 960, getContext: () => context }),
    onMessage: (callback) => {
      receive = callback;
    },
    getFriendCloudStorage: (options) => requests.push(options),
    createImage: () => {
      const image = {};
      images.push(image);
      return image;
    },
  };
  vm.runInNewContext(readFileSync('wechat/open-data/index.js', 'utf8'), { wx, console });
  receive({ type: 'ant-friends', page: 0 });
  receive({ type: 'ant-friends', page: 0 });
  const friend = (nickname, highest, reachedAt) => ({
    nickname,
    avatarUrl: `https://example.com/${nickname}.png`,
    openid: nickname,
    KVDataList: [{ key: 'ant-progress-v4', value: JSON.stringify({ highest, reachedAt }) }],
  });
  requests[1].success({
    data: [friend('后来', 2, 20), friend('先到', 2, 10), friend('领先', 3, 30)],
  });
  assert.equal(text[0], '1');
  assert.equal(text[1], '领先');
  assert.equal(text[3], '2');
  assert.equal(text[4], '先到');
  images[0].onload();
  assert.equal(drawn.at(-1), images[0]);
  requests[0].success({ data: [] });
  assert.equal(text[0], '1');
  assert.equal(text[1], '领先');
  for (let i = 0; i < 20; i++) receive({ type: 'ant-friends-page', delta: 1 });
  receive({ type: 'ant-friends-page', delta: -1 });
  assert.ok(text.includes('第 1 / 1 页'));
  receive({ type: 'ant-friends', page: 0 });
  const count = drawn.length;
  images[1].onload();
  assert.equal(drawn.length, count, 'late avatar must not repaint a refreshed board');
  requests[2].fail({ errMsg: 'test read failure' });
  assert.ok(text.includes('读取失败，请点击刷新重试'));
  receive({ type: 'ant-friends', page: 0 });
  requests[3].success({ data: [friend('领先', 3, 30)] });
  assert.equal(text[0], '1');
  assert.equal(text[1], '领先');
});

test('reward video grants only on complete close, removes listeners and recovers from errors', async () => {
  let close,
    error,
    removed = 0;
  const ad = {
    load: async () => {},
    show: async () => {},
    onClose: (callback) => {
      close = callback;
    },
    offClose: () => {
      removed++;
    },
    onError: (callback) => {
      error = callback;
    },
    offError: () => {
      removed++;
    },
  };
  const source = readFileSync('assets/scripts/platform/wechat/rewardAd.ts', 'utf8').replace(
    "REWARDED_VIDEO_AD_UNIT_ID = ''",
    "REWARDED_VIDEO_AD_UNIT_ID = 'test-placement'",
  );
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    { module, exports: module.exports, wx: { createRewardedVideoAd: () => ad } },
  );
  const show = module.exports.showRewardedVideo;
  const cancelled = show();
  assert.equal(await show(), false);
  close({ isEnded: false });
  assert.equal(await cancelled, false);
  const completed = show();
  close({ isEnded: true });
  assert.equal(await completed, true);
  const failed = show();
  error();
  assert.equal(await failed, false);
  assert.equal(removed, 6);
});

import { rankingNodes } from './helpers/leaderboard-view.mjs';
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
  const service = createService(
    {
      transaction: async (work) =>
        work({
          get: async (collection, id) => structuredClone(records.get(collection + id)),
          set: async (collection, id, data) => {
            records.set(collection + id, structuredClone(data));
          },
        }),
      leaderboard: async (skip, limit) =>
        [...records]
          .filter(([key, record]) => key.startsWith('players') && record.highest > 0)
          .map(([key, record]) => ({ ...record, _id: key.slice('players'.length) }))
          .sort((a, b) => b.highest - a.highest || a.reachedAt - b.reachedAt)
          .slice(skip, skip + limit),
    },
    () => now,
    () => 'run-' + ++serial,
  );
  const actions = [];
  let permission;
  let needsPrivacy = false;
  const nativeButtons = [];
  const userInfo = { nickName: '微信测试玩家🙂', avatarUrl: 'https://thirdwx.qlogo.cn/avatar/0' };
  const wx = {
    getSetting: ({ success }) => success({ authSetting: { 'scope.userInfo': permission } }),
    getPrivacySetting: ({ success }) => success({ needAuthorization: needsPrivacy }),
    requirePrivacyAuthorize: ({ success }) => {
      needsPrivacy = false;
      success();
    },
    getUserInfo: ({ success }) => success({ userInfo }),
    openSetting: ({ success }) => success({ authSetting: { 'scope.userInfo': permission } }),
    createUserInfoButton: (options) => {
      const button = {
        options,
        visible: true,
        destroyed: false,
        tap: null,
        onTap(callback) {
          this.tap = callback;
        },
        show() {
          this.visible = true;
        },
        hide() {
          this.visible = false;
        },
        destroy() {
          this.destroyed = true;
          this.visible = false;
        },
      };
      nativeButtons.push(button);
      return button;
    },
    cloud: {
      init: ({ env }) => assert.equal(env, 'cloudbase-d9glil4qk6b5865ba'),
      callFunction: ({ name, data, success, fail }) => {
        assert.equal(name, 'game');
        actions.push(data.action);
        const run = async () => {
          if (data.action === 'login' && loginGate) await loginGate;
          if (data.action === 'leaderboard' && boardGate) await boardGate;
          if (data.action === 'claim' && failClaim) throw new Error('test connection failure');
          return {
            result: await service(data, { APPID: 'wxd8e27ad9cd0289df', OPENID: 'scene-user' }),
          };
        };
        run().then(success, fail);
      },
    },
  };
  const avatarLoads = [];
  cc.assetManager = { loadRemote: (url, options, callback) => avatarLoads.push({ url, callback }) };
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
  const playerNodes = () => rankingNodes(game.runtime).rows.children;
  const rankingContent = () =>
    game.runtime.overlays.modal.children.find((node) => node.name === 'Leaderboard content');
  game.runtime.social.worldLeaderboard();
  assert.ok(
    rankingContent().children.some((node) =>
      node.components.some((c) => c.string === '世界排行榜'),
    ),
  );
  assert.equal(
    game.runtime.cloudStatus.cloudStatus.parent,
    game.runtime.overlays.modal,
    'rank loading stays in the rank content',
  );
  await flush(); // Identity writes finish before the ranking becomes a cancellable read.
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
  game.runtime.social.worldLeaderboard();
  await flush();
  const labels = playerNodes().map((node) => node.getComponent(cc.Label)?.string);
  assert.ok(
    labels.some((text) => /^蚂蚁/.test(text)),
    'self remains anonymous without consent',
  );
  assert.equal(
    rankingContent().children.some((node) => node.name === '微信授权设置'),
    false,
  );
  assert.ok(labels.includes('1 关'));
  assert.ok(playerNodes().some((node) => node.name === 'Player avatar'));

  game.runtime.overlays.closeModal();
  game.runtime.notices.notification = null;
  game.runtime.identity.update();
  await flush(); // Closing board consent re-prepares the native home entry.
  const native = nativeButtons.at(-1);
  assert.equal(native.visible, true);
  assert.equal(native.options.text, '');
  assert.ok(native.options.style.width < cc.view.getFrameSize().width / 2);
  game.runtime.settings.settings();
  assert.equal(native.visible, false, 'native trigger cannot cover settings');
  game.runtime.overlays.closeModal();
  game.runtime.lifecycle.hideHandler();
  game.runtime.lifecycle.showHandler();
  assert.equal(native.destroyed, false, 'native callbacks survive native-dialog resume');
  permission = true;
  native.tap({ errMsg: 'getUserInfo:ok', userInfo });
  await flush();
  assert.equal(native.destroyed, true);
  assert.equal(avatarLoads.at(-1).url, userInfo.avatarUrl);
  const avatarNode = playerNodes().find((node) => node.name === 'Player avatar');
  const image = new cc.Texture2D();
  avatarLoads.at(-1).callback(null, image);
  assert.equal(image.refs, 1);
  const avatarFrame = avatarNode.children[1].children[1].getComponent(cc.Sprite).spriteFrame;
  assert.equal(avatarNode.children[1].children[0].active, false);
  avatarNode.emit(cc.Node.EventType.NODE_DESTROYED);
  assert.equal(avatarFrame.destroyed, true);
  assert.equal(avatarFrame.texture.destroyed, true);
  assert.equal(image.refs, 0, 'remote avatar references are released with their row');

  assert.ok(
    playerNodes().some((node) => node.getComponent(cc.Label)?.string === userInfo.nickName),
  );
  const player = [...records.values()].find((record) => record.identity);
  assert.equal(player.identity.nickname, userInfo.nickName);
  game.runtime.overlays.closeModal();
  game.runtime.social.worldLeaderboard();
  await flush();
  const waitingAvatar = playerNodes().find((node) => node.name === 'Player avatar');
  const waitingLoad = avatarLoads.at(-1);
  waitingAvatar.isValid = false;
  waitingLoad.callback(null, image);
  assert.equal(image.refs, 0, 'late avatar loads do not retain resources for destroyed rows');
  const coins = game.runtime.profile.save.coins;
  permission = false;
  game.runtime.identity.settings();
  await flush();
  assert.equal([...records.values()].find((record) => record.profile)?.identity, null);
  assert.equal(game.runtime.profile.save.coins, coins);
  assert.equal(game.runtime.cloud.cloudHighest, 1);
  game.runtime.overlays.closeModal();
  game.runtime.home.showHome();
  await flush();
  const count = nativeButtons.length;
  game.runtime.identity.open();
  await flush();
  assert.equal(nativeButtons.length, count, 'refused users are not prompted on every entry');
  game.runtime.overlays.closeModal();
  permission = undefined;
  needsPrivacy = true;
  game.runtime.home.showHome();
  await flush();
  game.runtime.identity.open();
  await flush();
  assert.ok(game.runtime.overlays.modal, 'privacy approval automatically opens the board');
  game.runtime.notices.notification = null;
  game.runtime.identity.update();
  const firstUse = nativeButtons.at(-1);
  permission = false;
  firstUse.tap({ errMsg: 'getUserInfo:fail auth deny' });
  await flush();
  assert.ok(
    game.runtime.overlays.modal,
    'declining first authorization still opens the same board',
  );
  assert.equal([...records.values()].find((record) => record.profile)?.identity, null);
  permission = true;
  game.runtime.identity.settings();
  await flush();
  assert.equal(
    [...records.values()].find((record) => record.profile)?.identity.nickname,
    userInfo.nickName,
  );

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
  const source = readFileSync('assets/scripts/platform/wechat/rewardAd.ts', 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    { module, exports: module.exports, wx: { createRewardedVideoAd: () => ad } },
  );
  const show = module.exports.showRewardedVideo;
  const cancelled = show('speed');
  assert.equal(await show('slot'), false);
  close({ isEnded: false });
  assert.equal(await cancelled, false);
  const completed = show('speed');
  close({ isEnded: true });
  assert.equal(await completed, true);
  const failed = show('slot');
  await flush();
  error();
  assert.equal(await failed, false);
  assert.equal(removed, 6);
});

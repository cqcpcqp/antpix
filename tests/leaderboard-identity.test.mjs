import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { cc } = require('../scripts/headless-game.cjs');
const ts = require('typescript');
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
};

function fixture({ permission, privacy = false, slow = false, holdPrivacy = false } = {}) {
  const buttons = [],
    writes = [],
    notes = [],
    diagnostics = [];
  let release,
    privacyRequest,
    privacyCalls = 0,
    fail = false,
    boardCalls = 0;
  const wx = {
    getSetting(options) {
      const complete = () =>
        fail
          ? options.fail({ errMsg: 'getSetting:fail test unavailable' })
          : options.success({ authSetting: { 'scope.userInfo': permission } });
      if (slow) release = complete;
      else complete();
    },
    getPrivacySetting: ({ success }) => success({ needAuthorization: privacy }),
    requirePrivacyAuthorize: (options) => {
      privacyCalls++;
      privacyRequest = options;
      if (!holdPrivacy) {
        privacy = false;
        options.success();
      }
    },
    getUserInfo: ({ success }) =>
      success({ userInfo: { nickName: 'Player', avatarUrl: 'https://thirdwx.qlogo.cn/a/0' } }),
    openSetting: ({ success }) => success({ authSetting: { 'scope.userInfo': permission } }),
    createUserInfoButton(options) {
      const button = {
        options,
        visible: true,
        destroyed: false,
        tapped: null,
        onTap(callback) {
          this.tapped = callback;
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
      buttons.push(button);
      return button;
    },
  };
  const cache = new Map();
  const loadSource = (path) => {
    if (cache.has(path)) return cache.get(path);
    const module = { exports: {} };
    cache.set(path, module.exports);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(code, {
      module,
      exports: module.exports,
      wx,
      console: {
        info: (...args) => diagnostics.push(args),
        warn: (...args) => diagnostics.push(args),
      },
      require: (name) => (name === 'cc' ? cc : load(resolve(dirname(path), name + '.ts'))),
    });
    return module.exports;
  };
  const built = process.env.CHECK_BUILT
    ? require('../scripts/load-built.cjs')(cc, {
        wx,
        console: {
          info: (...args) => diagnostics.push(args),
          warn: (...args) => diagnostics.push(args),
        },
      })
    : null;
  const load = built ? (path) => built('chunks:///_virtual/' + path.split('/').pop()) : loadSource;
  const { LeaderboardIdentity } = load(
    resolve('assets/scripts/features/home/LeaderboardIdentity.ts'),
  );
  const game = {
    host: { isValid: true },
    home: { home: { active: true } },
    lifecycle: { screenWidth: 750, screenHeight: 1500, paused: false },
    overlays: { modal: null },
    startup: { active: false },
    cloud: {
      cloudMode: true,
      cloudReady: true,
      cloudBusy: false,
      cloudRequest: 1,
      cloud: { mutate: async (action, fields) => writes.push({ action, ...fields }) },
    },
    notices: {
      notification: null,
      notify: (...args) => {
        notes.push(args);
        game.notices.notification = { node: new cc.Node('Notification') };
      },
    },
    social: {
      worldLeaderboard: () => {
        boardCalls++;
        game.overlays.modal?.destroy();
        const board = new cc.Node('Board');
        game.overlays.modal = board;
        identity.boardOpened(board, 0);
        void identity.synchronize().then(() => identity.offerConsent(board, -375));
      },
      leaderboard: () => {
        boardCalls++;
      },
    },
  };
  const identity = new LeaderboardIdentity(game);
  game.identity = identity;
  const entry = new cc.Node('排行榜');
  entry.setPosition(220, -605);
  entry.on(cc.Node.EventType.TOUCH_END, () => identity.open());
  identity.attach(entry);
  return {
    identity,
    load,
    game,
    entry,
    buttons,
    writes,
    notes,
    diagnostics,
    get privacyCalls() {
      return privacyCalls;
    },
    agreePrivacy() {
      privacy = false;
      privacyRequest.success();
    },
    refusePrivacy() {
      privacyRequest.fail({ errMsg: 'requirePrivacyAuthorize:fail auth deny', errno: 104 });
    },
    get boardCalls() {
      return boardCalls;
    },
    setPermission(value) {
      permission = value;
    },
    failSettings() {
      fail = true;
    },
    finishPreparation() {
      slow = false;
      release();
    },
    tapRank() {
      identity.update();
      const button = buttons.findLast((item) => item.visible && !item.destroyed);
      if (button) return button;
      entry.emit(cc.Node.EventType.TOUCH_END);
      return null;
    },
  };
}

test('privacy success opens the leaderboard and offers native consent there without another ranking click', async () => {
  const f = fixture({ privacy: true });
  await flush();
  f.tapRank();
  await flush();
  assert.equal(f.boardCalls, 1);
  assert.equal(f.notes.length, 0, 'no click-the-ranking-again toast');
  const native = f.buttons.findLast((item) => item.visible && !item.destroyed);
  assert.ok(native, 'native consent is ready inside the opened board');
  const frame = cc.view.getFrameSize(),
    scale = frame.width / 750;
  assert.equal(native.options.style.left + native.options.style.width / 2, frame.width / 2);
  assert.equal(
    native.options.style.top + native.options.style.height / 2,
    frame.height / 2 + 375 * scale,
  );
});

test('official privacy success callback unlocks profile consent before uploading the native result', async () => {
  const f = fixture({ privacy: true, holdPrivacy: true });
  await flush();
  f.tapRank();
  f.tapRank();
  await flush();
  assert.equal(f.privacyCalls, 1, 'one native privacy request while the dialog is pending');
  assert.equal(f.identity.retainEntry, true, 'native dialog backgrounding retains its callback');
  assert.equal(f.buttons.length, 0, 'profile API waits for privacy consent');
  assert.equal(f.writes.length, 0);
  assert.equal(f.boardCalls, 0);
  f.agreePrivacy();
  await flush();
  assert.equal(f.boardCalls, 1, 'privacy callback opens the board automatically');
  const native = f.buttons.findLast((item) => item.visible && !item.destroyed);
  assert.ok(native, 'profile consent is offered within the leaderboard');
  native.tapped({
    errMsg: 'getUserInfo:ok',
    userInfo: { nickName: 'Consenting Player', avatarUrl: 'https://thirdwx.qlogo.cn/agreed/0' },
  });
  await flush();
  assert.equal(f.boardCalls, 2, 'profile success refreshes the leaderboard');
  assert.equal(f.writes.at(-1).nickname, 'Consenting Player');
  assert.equal(f.writes.at(-1).avatarUrl, 'https://thirdwx.qlogo.cn/agreed/0');
});

test('official privacy rejection keeps the same leaderboard accessible without requesting profile', async () => {
  const f = fixture({ privacy: true, holdPrivacy: true });
  await flush();
  f.tapRank();
  f.refusePrivacy();
  await flush();
  assert.equal(f.boardCalls, 1);
  assert.equal(f.buttons.length, 0);
  assert.equal(f.writes.at(-1).nickname, null);
  assert.equal(f.writes.at(-1).avatarUrl, null);
  assert.equal(f.identity.settingsAvailable, false, 'privacy refusal is not profile scope refusal');
});

test('late official privacy callback cannot revive a destroyed home entry', async () => {
  const f = fixture({ privacy: true, holdPrivacy: true });
  await flush();
  f.tapRank();
  f.identity.detach();
  f.agreePrivacy();
  await flush();
  assert.equal(f.buttons.length, 0);
  assert.equal(f.boardCalls, 0);
  assert.equal(f.writes.length, 0);
});

test('canvas events cannot skip first authorization or mistake preparation for refusal', async () => {
  const f = fixture({ slow: true });
  f.entry.emit(cc.Node.EventType.TOUCH_END);
  assert.equal(f.boardCalls, 0, 'SDK preflight is not a reason to silently open anonymously');
  f.finishPreparation();
  await flush();
  f.entry.emit(cc.Node.EventType.TOUCH_END);
  assert.equal(f.boardCalls, 0, 'canvas touch forwarding must leave first authorization to WeChat');
});

test('settings entry is offered only for a confirmed denied scope', async () => {
  const first = fixture();
  await flush();
  assert.equal(first.identity.settingsAvailable, false);
  const refused = fixture({ permission: false });
  await flush();
  assert.equal(refused.identity.settingsAvailable, true);
  assert.equal(refused.buttons.length, 0);
  refused.tapRank();
  await flush();
  assert.equal(refused.boardCalls, 1);
  assert.equal(refused.writes.at(-1).nickname, null);
});

test('native success supplies the granted profile without a stale getSetting round trip', async () => {
  const f = fixture();
  await flush();
  const native = f.tapRank();
  native.tapped({
    errMsg: 'getUserInfo:ok',
    userInfo: { nickName: 'Native Name', avatarUrl: 'https://thirdwx.qlogo.cn/native/0' },
  });
  await flush();
  assert.equal(f.writes.at(-1).nickname, 'Native Name');
  assert.equal(f.identity.authorized, true);
  assert.equal(f.identity.settingsAvailable, false);
});

test('SDK failures are not treated as denied consent and do not clear public data', async () => {
  const f = fixture({ permission: true });
  await flush();
  f.failSettings();
  await f.identity.synchronize();
  assert.equal(f.writes.length, 0);
  assert.equal(f.identity.settingsAvailable, false);
  assert.ok(f.notes.length);
});

test('native trigger stays within the ranking tile and hides behind real overlays and in background', async () => {
  const f = fixture();
  await flush();
  const native = f.tapRank();
  const frame = cc.view.getFrameSize(),
    scale = frame.width / 750;
  const { left, top, width, height } = native.options.style;
  assert.equal(left + width / 2, frame.width / 2 + 220 * scale);
  assert.equal(top + height / 2, frame.height / 2 + 605 * scale);
  assert.equal(width, 144 * scale);
  f.game.overlays.modal = new cc.Node('Modal');
  f.identity.update();
  assert.equal(native.visible, false);
  f.game.overlays.modal = null;
  f.game.lifecycle.paused = true;
  f.identity.update();
  assert.equal(native.visible, false);
  f.game.lifecycle.paused = false;
  f.identity.update();
  assert.equal(native.visible, true);
  f.identity.detach();
  assert.equal(native.destroyed, true);
});

test('actual leaderboard UI distinguishes first use, refusal and SDK failure', async () => {
  for (const scenario of ['first', 'denied', 'error']) {
    const f = fixture({ permission: scenario === 'denied' ? false : undefined });
    await flush();
    if (scenario === 'error') f.failSettings();
    const labels = [];
    f.game.ui = { button: (_node, label) => labels.push(label), text: () => {} };
    f.game.overlays.openModal = () => {
      const board = new cc.Node('Board');
      f.game.overlays.modal = board;
      return board;
    };
    f.game.cloud.cloudTask = (work, complete) => work().then(complete);
    f.game.cloud.cloud.leaderboard = async () => ({ rows: [], hasNext: false });
    const { SocialScreen } = f.load(resolve('assets/scripts/features/home/SocialScreen.ts'));
    new SocialScreen(f.game).worldLeaderboard(0);
    await flush();
    assert.equal(labels.includes('微信授权设置'), scenario === 'denied', scenario);
    assert.equal(labels.includes('微信资料授权'), scenario === 'first', scenario);
    assert.ok(labels.includes('返回'), 'the same leaderboard remains accessible');
  }
});

test('board consent hides in background and is destroyed on closing without stale profile writes', async () => {
  const f = fixture({ privacy: true });
  await flush();
  f.tapRank();
  await flush();
  const native = f.buttons.findLast((item) => item.visible && !item.destroyed);
  f.game.lifecycle.paused = true;
  f.identity.update();
  assert.equal(native.visible, false);
  f.game.lifecycle.paused = false;
  f.identity.update();
  assert.equal(native.visible, true);
  const writes = f.writes.length;
  f.game.overlays.modal.destroy();
  f.game.overlays.modal = null;
  f.identity.update();
  native.tapped({
    errMsg: 'getUserInfo:ok',
    userInfo: { nickName: 'Late', avatarUrl: 'https://thirdwx.qlogo.cn/late/0' },
  });
  await flush();
  assert.equal(native.destroyed, true);
  assert.equal(f.writes.length, writes);
  assert.equal(f.boardCalls, 1);
  assert.ok(f.tapRank(), 'home native entry is restored after closing the board');
});

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { cc } = require('../../scripts/headless-game.cjs');
const ts = require('typescript');
export const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
};

export function fixture({ permission, privacy = false, slow = false, holdPrivacy = false } = {}) {
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
    ? require('../../scripts/load-built.cjs')(cc, {
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
        identity.boardOpened(board);
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

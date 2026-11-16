import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
export const { cc, load } = require('../../scripts/headless-game.cjs');

/** Real UI controllers with deterministic platform data; no network or browser. */
export function leaderboardFixture(
  rows,
  { page = 0, consent = false, touchSize = 88, viewport = null } = {},
) {
  const requests = [];
  const screenWidth = viewport ? Math.max(750, (1500 * viewport.width) / viewport.height) : 750;
  const screenHeight = viewport ? Math.max(1500, (750 * viewport.height) / viewport.width) : 1500;
  cc.assetManager = { loadRemote: (url, options, callback) => requests.push({ url, callback }) };
  const { UiFactory } = load(resolve('assets/scripts/features/ui/UiFactory.ts'));
  const { OverlayController } = load(resolve('assets/scripts/features/ui/OverlayController.ts'));
  const { SocialScreen } = load(resolve('assets/scripts/features/home/SocialScreen.ts'));
  const game = {
    lifecycle: {
      root: new cc.Node('Root'),
      screenWidth,
      screenHeight,
      minimumTextSize: viewport ? (12 * screenWidth) / viewport.width : 24,
      touchSize,
    },
    audio: { play() {} },
    settings: {},
    boosts: {},
    shop: {},
    victory: {},
    courtyard: { refreshCourtyard() {} },
    preview: { clearPreview() {} },
    cloudStatus: { refreshCloudStatus() {} },
    identity: {
      hide() {},
      boardOpened() {},
      synchronize: async () => {},
      consentAvailable: consent,
      settingsAvailable: false,
      offerConsent(node, y) {
        game.nativeConsent = { node, y };
      },
    },
    cloud: {
      cloudReady: true,
      cloudBusy: false,
      cloud: { leaderboard: async () => ({ rows, hasNext: page === 0 }) },
      cloudTask(work, complete) {
        return work().then(complete);
      },
    },
  };
  game.ui = new UiFactory(game);
  game.overlays = new OverlayController(game);
  game.social = new SocialScreen(game);
  game.social.worldLeaderboard(page);
  return { game, requests };
}
export async function settleLeaderboard() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
}
export function players(first = 1, count = 10) {
  return Array.from({ length: count }, (_, i) => ({
    rank: first + i,
    highest: 108 - i,
    self: i === 1,
    player: `匿名玩家${i}`,
    identity:
      i === 5
        ? null
        : {
            nickname: ['小蚂蚁', '这是一位昵称特别特别长的花园旅行家', 'WWWWWWWWWWWWWWW'][i % 3],
            avatarUrl: `https://thirdwx.qlogo.cn/avatar-${i}/0`,
          },
  }));
}

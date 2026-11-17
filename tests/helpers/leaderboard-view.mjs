import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
export const { cc, load } = require('../../scripts/headless-game.cjs');

/** Load the production atlas via its actual resource owner, without a platform request. */
export function installLeaderboardArt(game) {
  const { LeaderboardAssets } = load(resolve('assets/scripts/app/LeaderboardAssets.ts'));
  game.assets = { leaderboardFrames: new Map(), leaderboardTexture: null };
  const texture = new cc.Texture2D();
  const owner = new LeaderboardAssets({
    assets: game.assets,
    host: { isValid: true },
    startup: { load: (_path, _type, complete) => complete(null, texture) },
  });
  owner.load();
  return owner;
}

/** Real UI controllers with deterministic platform data; no network or browser. */
export function leaderboardFixture(
  rows,
  { consent = false, touchSize = 88, viewport = null } = {},
) {
  const requests = [];
  const screenWidth = viewport ? Math.max(750, (1500 * viewport.width) / viewport.height) : 750;
  const screenHeight = viewport ? Math.max(1500, (750 * viewport.height) / viewport.width) : 1500;
  cc.assetManager = { loadRemote: (url, options, callback) => requests.push({ url, callback }) };
  const { UiFactory } = load(resolve('assets/scripts/features/ui/UiFactory.ts'));
  const { OverlayController } = load(resolve('assets/scripts/features/ui/OverlayController.ts'));
  const { SocialScreen } = load(resolve('assets/scripts/features/home/SocialScreen.ts'));
  const game = {
    host: { isValid: true },
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
      revision: 0,
      hide() {},
      boardOpened() {},
      synchronize: async () => {},
      consentAvailable: consent,
      settingsAvailable: false,
      offerConsent(node, y, x, width) {
        game.nativeConsent = { node, y, x, width };
      },
    },
    cloud: {
      cloudHighest: 0,
      cloudReachedAt: 0,
      cloudReady: true,
      cloudBusy: false,
      cloud: { leaderboardAll: async () => ({ ok: true, rows, hasNext: false }) },
      cloudTask(work, complete) {
        return work().then(complete);
      },
    },
  };
  installLeaderboardArt(game);
  const { LeaderboardData } = load(resolve('assets/scripts/app/LeaderboardData.ts'));
  game.leaderboardData = new LeaderboardData(game);
  game.ui = new UiFactory(game);
  game.overlays = new OverlayController(game);
  game.social = new SocialScreen(game);
  game.social.worldLeaderboard();
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

/** Return the actual fixed chrome, scroller and player container for UI assertions. */
export function rankingNodes(game) {
  const chrome = game.overlays.modal.children.find((node) => node.name === 'Leaderboard content');
  const viewport = chrome.children.find((node) => node.name === 'Leaderboard viewport');
  const scroll = viewport.getComponent(cc.ScrollView);
  return { chrome, viewport, scroll, rows: scroll.content.children[0] };
}

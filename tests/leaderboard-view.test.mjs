import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  cc,
  installLeaderboardArt,
  rankingNodes,
  load,
  leaderboardFixture,
  players,
  settleLeaderboard,
} from './helpers/leaderboard-view.mjs';
const { ellipsizeNickname, nicknameClusters } = load(
  resolve('assets/scripts/presentation/playerNickname.ts'),
);
const { worldBoardFooter } = load(resolve('assets/scripts/presentation/leaderboardLayout.ts'));

test('nickname ellipsis preserves Unicode clusters and measures width instead of character count', () => {
  const measure = (s) => [...s].reduce((n, c) => n + (c === 'W' ? 3 : 1), 0);
  assert.equal(ellipsizeNickname('小蚂蚁', 4, measure), '小蚂蚁');
  assert.equal(ellipsizeNickname('很长很长的微信昵称', 5, measure), '很长很长…');
  assert.equal(ellipsizeNickname('WWWWWW', 7, measure), 'WW…');
  assert.equal(ellipsizeNickname('iiiiii', 7, measure), 'iiiiii');
  assert.equal(ellipsizeNickname('名字\n换行', 20, measure), '名字 换行');
  for (const cluster of ['e\u0301', '👍🏽', '👨‍👩‍👧‍👦', '🇨🇳', '✌️']) {
    assert.deepEqual([...nicknameClusters(cluster + cluster)], [cluster, cluster]);
    assert.equal(
      ellipsizeNickname(cluster.repeat(3), [...cluster].length + 1, measure),
      cluster + '…',
    );
  }
});

test('first page renders live champion, silver and bronze cards with enlarged circular portraits', async () => {
  const { game, requests } = leaderboardFixture(players());
  await settleLeaderboard();
  const board = rankingNodes(game).rows;
  assert.equal(board.children.filter((n) => n.name.endsWith('plaque')).length, 3);
  assert.equal(board.children.filter((n) => n.name.endsWith('medal')).length, 3);
  const avatars = board.children.filter((n) => n.name === 'Player avatar');
  assert.equal(avatars.length, 10);
  assert.deepEqual(
    avatars.map((n) => n.children[1].getComponent(cc.UITransform).width),
    [128, 86, 86, 62, 62, 62, 62, 62, 62, 62],
  );
  assert.ok(avatars.every((n) => n.children[1].getComponent(cc.Mask)));
  assert.equal(requests.length, 9, 'anonymous player uses the default portrait');
  const names = board.children.filter((n) => n.name === 'Player nickname');
  assert.ok(names[1].getComponent(cc.Label).string.endsWith('…'));
  assert.ok(names.every((n) => game.ui.systemFontLabels.has(n.getComponent(cc.Label))));
  assert.ok(names.every((n) => n.getComponent(cc.Label).fontSize >= 24));
  assert.equal(board.children.filter((n) => n.name === 'My ranking').length, 1);
});

test('all 100 players share one bounded native scroller with a fixed header and return', async () => {
  const { game } = leaderboardFixture(players(1, 100));
  await settleLeaderboard();
  const { chrome, viewport, scroll, rows } = rankingNodes(game);
  assert.equal(rows.children.filter((n) => n.name === 'Player avatar').length, 100);
  assert.equal(rows.children.filter((n) => n.name.endsWith('medal')).length, 3);
  assert.equal(scroll.horizontal, false);
  assert.equal(scroll.vertical, true);
  assert.equal(scroll.inertia, true);
  assert.equal(scroll.elastic, true);
  assert.equal(viewport.getComponent(cc.Mask).type, cc.Mask.Type.GRAPHICS_RECT);
  assert.deepEqual(scroll.content.getComponent(cc.UITransform).anchorPoint, { x: 0.5, y: 1 });
  const contentHeight = scroll.content.getComponent(cc.UITransform).height;
  const viewportHeight = viewport.getComponent(cc.UITransform).height;
  assert.ok(contentHeight > viewportHeight * 7);
  assert.ok(!chrome.children.some((n) => ['上一页', '下一页'].includes(n.name)));
  const back = chrome.children.find((n) => n.name === '返回');
  const fixedY = back.position.y;
  scroll.scrollToBottom();
  const avatars = rows.children.filter((n) => n.name === 'Player avatar');
  const lastY =
    viewport.position.y + scroll.content.position.y + rows.position.y + avatars[99].position.y;
  assert.ok(lastY > -450 && lastY < -370, 'rank 100 clears the viewport bottom with padding');
  assert.equal(back.position.y, fixedY);
  scroll.scrollToTop();
  assert.equal(scroll.content.position.y, viewportHeight / 2);
});

test('consent, scroll viewport and return hit areas stay separate at narrow device sizes', async () => {
  for (const touchSize of [88, 104, 138]) {
    const { game } = leaderboardFixture(players(), { consent: true, touchSize });
    await settleLeaderboard();
    const { chrome, viewport } = rankingNodes(game);
    const back = chrome.children.find((n) => n.name === '返回');
    const consent = chrome.children.find((n) => n.name === '微信资料授权');
    assert.equal(game.nativeConsent.y, consent.position.y);
    assert.equal(consent.position.y, back.position.y);
    assert.ok(consent.position.x - 330 / 2 > back.position.x + 210 / 2);
    assert.equal(game.nativeConsent.x, consent.position.x);
    assert.equal(game.nativeConsent.width, 330);
    const bottom = viewport.position.y - viewport.getComponent(cc.UITransform).height / 2;
    assert.ok(bottom > consent.position.y + touchSize / 2);
    const footer = worldBoardFooter(touchSize);
    assert.ok(back.position.y - touchSize / 2 > footer.panelY - footer.height / 2);
  }
});

test('empty and partial boards preserve the return action and actual player count', async () => {
  for (const count of [0, 1, 2, 3]) {
    const { game } = leaderboardFixture(players(1, count));
    await settleLeaderboard();
    const board = rankingNodes(game).rows;
    assert.equal(board.children.filter((n) => n.name === 'Player avatar').length, count);
    assert.ok(rankingNodes(game).chrome.children.some((n) => n.name === '返回'));
    assert.equal(rankingNodes(game).scroll.content.getComponent(cc.UITransform).height, 936);
  }
});

test('shared artwork frames stay inside the PNG atlas and release once with the app', async () => {
  const { readFileSync } = await import('node:fs');
  const png = readFileSync('assets/resources/leaderboard/laurel.png');
  const width = png.readUInt32BE(16),
    height = png.readUInt32BE(20);
  const game = {};
  const owner = installLeaderboardArt(game);
  const texture = game.assets.leaderboardTexture;
  const frames = [...game.assets.leaderboardFrames.values()];
  assert.equal(texture.refs, 1);
  assert.equal(frames.length, 11);
  for (const frame of frames) {
    assert.equal(frame.texture, texture);
    assert.ok(frame.rect.x >= 0 && frame.rect.y >= 0);
    assert.ok(frame.rect.x + frame.rect.width <= width);
    assert.ok(frame.rect.y + frame.rect.height <= height);
    assert.ok(frame.insetLeft + frame.insetRight < frame.rect.width);
    assert.ok(frame.insetTop + frame.insetBottom < frame.rect.height);
  }
  owner.destroy();
  assert.ok(frames.every((frame) => frame.destroyed));
  assert.equal(game.assets.leaderboardFrames.size, 0);
  assert.equal(texture.refs, 0);
  owner.destroy();
  assert.equal(texture.refs, 0, 'repeated teardown does not release twice');
});

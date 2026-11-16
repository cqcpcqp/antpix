import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  cc,
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
  const board = game.overlays.modal;
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

test('later page retains ranks and row spacing without awarding extra podium medals', async () => {
  const { game } = leaderboardFixture(players(11), { page: 1 });
  await settleLeaderboard();
  const board = game.overlays.modal;
  assert.equal(board.children.filter((n) => n.name.endsWith('medal')).length, 0);
  const avatars = board.children.filter((n) => n.name === 'Player avatar');
  assert.equal(avatars.length, 10);
  assert.equal(avatars[0].position.y - avatars[9].position.y, 9 * 84);
  assert.equal(
    board.children.some((n) => n.name === '上一页'),
    true,
  );
  assert.equal(
    board.children.some((n) => n.name === '下一页'),
    false,
  );
});

test('consent, pagination and return hit areas stay separate at narrow device sizes', async () => {
  for (const touchSize of [88, 104, 138]) {
    const { game } = leaderboardFixture(players(), { consent: true, touchSize });
    await settleLeaderboard();
    const board = game.overlays.modal;
    const back = board.children.find((n) => n.name === '返回');
    const consent = board.children.find((n) => n.name === '微信资料授权');
    const next = board.children.find((n) => n.name === '下一页');
    assert.equal(game.nativeConsent.y, consent.position.y);
    assert.ok(consent.position.y - back.position.y > touchSize);
    assert.ok(next.position.y - consent.position.y > touchSize);
    const footer = worldBoardFooter(touchSize);
    assert.ok(back.position.y - touchSize / 2 > -footer.height / 2);
  }
});

test('empty and partial boards preserve the return action and actual player count', async () => {
  for (const count of [0, 1, 2, 3]) {
    const { game } = leaderboardFixture(players(1, count));
    await settleLeaderboard();
    const board = game.overlays.modal;
    assert.equal(board.children.filter((n) => n.name === 'Player avatar').length, count);
    assert.ok(board.children.some((n) => n.name === '返回'));
  }
});

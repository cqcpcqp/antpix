import test from 'node:test';
import assert from 'node:assert/strict';
import {
  leaderboardFixture,
  rankingNodes,
  players,
  settleLeaderboard,
  cc,
} from './helpers/leaderboard-view.mjs';

test('one loading message keeps the skeleton visible through permission and network stages', async () => {
  const { game } = leaderboardFixture(players(1, 100));
  await settleLeaderboard();
  let allow, finish;
  const messages = [];
  game.identity.synchronize = () => new Promise((resolve) => (allow = resolve));
  game.cloud.cloud.leaderboardAll = () => new Promise((resolve) => (finish = resolve));
  game.cloud.cloudTask = (work, complete, message) => {
    messages.push(message);
    return work().then(complete);
  };
  game.social.worldLeaderboard();
  const content = () => game.overlays.modal.children.find((n) => n.name === 'Leaderboard content');
  assert.ok(content().children.some((n) => n.name === 'Leaderboard skeleton'));
  assert.equal(
    content().children.some((n) => n.name === 'Leaderboard viewport'),
    false,
    'cache is not shown before verifying consent',
  );
  allow();
  await settleLeaderboard();
  assert.ok(
    content().children.some((n) => n.name === 'Leaderboard viewport'),
    'verified cache is visible during refresh',
  );
  const oldScroll = rankingNodes(game).scroll;
  oldScroll.scrollToOffset(new cc.Vec2(0, 220));
  finish({ ok: true, rows: players(1, 100), hasNext: false });
  await settleLeaderboard();
  assert.equal(rankingNodes(game).scroll.getScrollOffset().y, 220);
  assert.deepEqual(messages, ['正在加载排行榜…', '正在加载排行榜…']);
});

test('revoked cache stays hidden while fresh anonymous data loads; late response cannot reopen a closed board', async () => {
  const { game } = leaderboardFixture(players(1, 100));
  await settleLeaderboard();
  let finish;
  game.identity.synchronize = async () => {
    game.identity.revision++;
  };
  game.cloud.cloud.leaderboardAll = () => new Promise((resolve) => (finish = resolve));
  game.social.worldLeaderboard();
  await settleLeaderboard();
  const content = game.overlays.modal.children.find((n) => n.name === 'Leaderboard content');
  assert.ok(content.children.some((n) => n.name === 'Leaderboard skeleton'));
  assert.equal(
    content.children.some((n) => n.name === 'Leaderboard viewport'),
    false,
  );
  game.overlays.closeModal();
  finish({ ok: true, rows: [], hasNext: false });
  await settleLeaderboard();
  assert.equal(game.overlays.modal, null);
});

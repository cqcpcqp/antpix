import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { load } from './helpers/leaderboard-view.mjs';
const { CloudGame } = load(resolve('assets/scripts/platform/wechat/cloudGame.ts'));
const require = createRequire(import.meta.url);
const { createService } = require('../cloudfunctions/game/service.js');
const records = Array.from({ length: 120 }, (_, i) => ({
  _id: `uid-${i}`,
  player: `匿名${i}`,
  identityConsentVersion: i % 2,
  identity: { nickname: `玩家${i}`, avatarUrl: 'https://thirdwx.qlogo.cn/a/0' },
  highest: 1000 - i,
  reachedAt: i,
}));

test('top 100 uses one exact transport request and preserves its response', async () => {
  for (const count of [0, 1, 10, 11, 100]) {
    const requests = [];
    const response = { ok: true, rows: records.slice(0, count), hasNext: false };
    const cloud = new CloudGame(
      async (request) => {
        requests.push(request);
        return response;
      },
      { getItem: () => null, setItem() {}, removeItem() {} },
    );
    assert.equal(await cloud.leaderboardAll(), response);
    assert.deepEqual(JSON.parse(JSON.stringify(requests)), [
      { action: 'leaderboardTop', catalogVersion: 4 },
    ]);
    await cloud.leaderboard(3);
    assert.deepEqual(JSON.parse(JSON.stringify(requests[1])), {
      action: 'leaderboard',
      page: 3,
      catalogVersion: 4,
    });
  }
});

test('network failure rejects unchanged and permits an explicit retry', async () => {
  const error = new Error('offline');
  let calls = 0;
  const response = { ok: true, rows: [], hasNext: false };
  const cloud = new CloudGame(
    async () => {
      if (++calls === 1) throw error;
      return response;
    },
    { getItem: () => null, setItem() {}, removeItem() {} },
  );
  await assert.rejects(cloud.leaderboardAll(), (actual) => actual === error);
  assert.equal(await cloud.leaderboardAll(), response);
  assert.equal(calls, 2);
});

test('server reads top 100 once and retains the old pagination contract', async () => {
  const calls = [];
  const service = createService({
    leaderboard: async (start, limit) => {
      calls.push([start, limit]);
      return records.slice(start, start + limit);
    },
  });
  const context = { APPID: 'wxd8e27ad9cd0289df', OPENID: 'alice' };
  const top = await service({ action: 'leaderboardTop', catalogVersion: 4 }, context);
  assert.deepEqual(calls, [[0, 100]]);
  assert.equal(top.rows.length, 100);
  assert.equal(top.hasNext, false);
  assert.equal(top.rows[0].identity, null);
  assert.deepEqual(top.rows[1].identity, records[1].identity);
  for (let page = 0; page < 10; page++) {
    const result = await service({ action: 'leaderboard', catalogVersion: 4, page }, context);
    assert.deepEqual(result.rows, top.rows.slice(page * 10, page * 10 + 10));
    assert.equal(result.hasNext, page < 9);
    assert.deepEqual(calls.at(-1), [page * 10, 11]);
  }
});

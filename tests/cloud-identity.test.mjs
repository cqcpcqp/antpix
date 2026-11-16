import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createService } = require('../cloudfunctions/game/service.js');

function fixture() {
  const records = new Map();
  let serial = 0;
  const service = createService({
    transaction: async (work) =>
      work({
        get: async (collection, id) => structuredClone(records.get(collection + id)),
        set: async (collection, id, data) => records.set(collection + id, structuredClone(data)),
      }),
    leaderboard: async () =>
      [...records]
        .filter(([key]) => key.startsWith('players'))
        .map(([key, data]) => ({ ...data, _id: key.slice(7) })),
  });
  const call = (action, fields = {}, user = 'alice') =>
    service(
      {
        action,
        catalogVersion: 4,
        requestId: `identity-request-${++serial}`,
        ...fields,
      },
      { APPID: 'wxd8e27ad9cd0289df', OPENID: user },
    );
  return { records, call };
}
const profile = {
  consentVersion: 1,
  nickname: '微信玩家🙂',
  avatarUrl: 'https://thirdwx.qlogo.cn/a/0',
};

test('historical accounts migrate only consent fields, preserving progress and balances', async () => {
  const f = fixture();
  const login = await f.call('login');
  const key = 'players' + login.output.userId;
  const old = f.records.get(key);
  old.profile.coins = 730;
  old.highest = 12;
  old.reachedAt = 456;
  old.identity = { nickname: 'obsolete', avatarUrl: 'https://thirdwx.qlogo.cn/old' };
  delete old.identityConsentVersion;
  const before = structuredClone(old);
  assert.equal((await f.call('leaderboard', { page: 0 })).rows[0].identity, null);
  const resumed = await f.call('login');
  assert.equal(resumed.output.userId, login.output.userId);
  assert.deepEqual(f.records.get(key), { ...before, identity: null, identityConsentVersion: 1 });
  assert.equal(resumed.profile.coins, 730);
  assert.equal(resumed.highest, 12);
  assert.equal(resumed.reachedAt, 456);
});

test('consented identities share one board; clear and idempotent retries preserve accounts', async () => {
  const f = fixture();
  await f.call('login');
  await f.call('login', {}, 'bob');
  const fields = { ...profile, requestId: 'identity-retry-123456' };
  assert.equal((await f.call('identity', fields)).ok, true);
  assert.equal((await f.call('identity', fields)).ok, true);
  let board = await f.call('leaderboard', { page: 0 });
  assert.equal(board.rows.length, 2);
  assert.deepEqual(
    board.rows.map((row) => row.identity),
    [{ nickname: profile.nickname, avatarUrl: profile.avatarUrl }, null],
  );
  await f.call('identity', { consentVersion: 1, nickname: null, avatarUrl: null });
  board = await f.call('leaderboard', { page: 0 });
  assert.ok(board.rows.every((row) => row.identity === null));
});

test('profile updates require current consent version and valid bounded WeChat data', async () => {
  const f = fixture();
  await f.call('login');
  for (const invalid of [
    { consentVersion: 0 },
    { nickname: '' },
    { nickname: 'a'.repeat(65) },
    { avatarUrl: 'https://qlogo.cn.evil.test/avatar' },
    { avatarUrl: 'http://qlogo.cn/a' },
    { avatarUrl: null },
  ])
    assert.equal((await f.call('identity', { ...profile, ...invalid })).code, 'INPUT');
  assert.equal((await f.call('identity', profile, 'not-logged-in')).code, 'LOGIN');
});

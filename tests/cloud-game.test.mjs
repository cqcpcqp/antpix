import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CloudGame } from '../assets/scripts/platform/wechat/cloudGame.ts';
import { freshProfile, SKINS } from '../assets/scripts/domain/profile/profile.ts';
import { LEVEL_COUNT, makeLevel } from '../assets/scripts/domain/levels/levels.ts';
const require = createRequire(import.meta.url);
const { dayAt } = require('../cloudfunctions/game/service.js');
const { levels } = require('../cloudfunctions/game/catalog.json');
const generated = require('../cloudfunctions/game/profile.js');
import { APPID, fixture, win } from './helpers/cloud-game.mjs';

const memory = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};
test('old cloud profile schemas are rejected before applying or discarding a pending claim', async () => {
  const f = fixture();
  let legacy = true;
  const storage = memory();
  const transport = async (request) => {
    const state = await f.service(request, { APPID, OPENID: 'alice' });
    if (legacy && state.ok) delete state.profile.pets;
    return state;
  };
  const client = new CloudGame(transport, storage);
  await assert.rejects(client.login(), { code: 'VERSION' });
  await assert.rejects(client.mutate('claim'), /Cloud login is required/);

  legacy = false;
  assert.equal((await client.login()).profile.pets.residents.length, 1);
  legacy = true;
  await assert.rejects(client.mutate('claim'), { code: 'VERSION' });

  legacy = false;
  const resumed = await new CloudGame(transport, storage).login();
  assert.equal(resumed.output.amount, 30);
  assert.equal(resumed.profile.coins, 30);
});
test('generated server rules match client catalog and assets', () => {
  assert.deepEqual(generated.freshProfile(0), freshProfile(0));
  assert.deepEqual(generated.SKINS, SKINS);
  assert.equal(levels.length, LEVEL_COUNT);
  for (let index = 0; index < LEVEL_COUNT; index++) {
    const level = makeLevel(index);
    assert.deepEqual(levels[index].moves, [...new Set(level.containerPlans.map((p) => p.length))]);
    for (const plan of level.containerPlans) {
      const fastestDispatch =
        ((level.pixels.filter((c) => c >= 0).length - plan.length) * (0.5 / 5.2)) / 9;
      assert.ok(levels[index].minimumSeconds <= fastestDispatch, `level ${index + 1}`);
    }
  }
});
test('level 17 accepts accelerated scores and still rejects scores below the time bound', async () => {
  const f = fixture();
  await f.call('login');
  for (let level = 0; level < 16; level++) assert.equal((await win(f, level)).ok, true);
  for (const moves of levels[16].moves) {
    const start = await f.call('start', { level: 16 });
    f.advance(120000);
    const request = { runId: start.output.runId, moves };
    assert.equal(
      (await f.call('complete', { ...request, seconds: levels[16].minimumSeconds - 0.01 })).code,
      'SCORE',
    );
    assert.equal(
      (await f.call('complete', { ...request, seconds: levels[16].minimumSeconds })).ok,
      true,
    );
  }
});
test('trusted WeChat identity only; users cannot submit balance or another identity', async () => {
  const f = fixture();
  assert.equal(
    (await f.service({ action: 'login', catalogVersion: 4 }, { APPID: 'wrong', OPENID: 'alice' }))
      .code,
    'UNAUTHORIZED',
  );
  const a = await f.call('login', { coins: 99999, openid: 'bob' });
  const b = await f.call('login', {}, 'bob');
  assert.equal(a.profile.coins, 0);
  assert.notEqual(a.output.userId, b.output.userId);
  assert.equal((await f.call('start', { level: 1 })).code, 'LOCKED');
});
test('progress advances sequentially and ranking timestamps survive replays', async () => {
  const f = fixture();
  await f.call('login');
  const first = await win(f, 0);
  assert.equal(first.profile.unlocked, 1);
  const replay = await win(f, 0);
  assert.equal(replay.reachedAt, first.reachedAt);
  const next = await win(f, 1);
  assert.equal(next.highest, 2);
  assert.ok(next.reachedAt > first.reachedAt);
  const resumed = await f.call('login');
  assert.deepEqual(resumed.profile.completed, [0, 1]);
});
test('progress keeps one resident and only Lili can be fed', async () => {
  const f = fixture();
  const pet = (operation, petId, value) => f.call('pet', { operation, petId, value });
  assert.equal((await f.call('login')).profile.pets.residents.length, 1);
  for (let level = 0; level < 8; level++) {
    assert.equal((await win(f, level)).profile.pets.residents.length, 1);
  }
  assert.equal((await pet('dispatch', 1)).code, 'PET');
  assert.equal((await pet('claim', 2)).code, 'PET');
  assert.equal((await pet('feed', 1, 'ration')).code, 'PET');
  f.advance(73 * 3600000);
  assert.equal((await pet('feed', 0, 'ration')).ok, true);
  assert.equal((await pet('feed', 0, 'ration')).code, 'PET');
  await f.call('claim');
  const bought = await pet('buy', -1);
  assert.equal(bought.profile.pets.melons, 1);
  const fed = await pet('feed', 0, 'melon');
  assert.equal(fed.profile.pets.melons, 0);
  assert.equal(fed.profile.pets.residents[0].fedUntil, fed.serverTime + 72 * 3600000);
  assert.equal((await pet('rename', 0, '小栗')).profile.pets.residents[0].name, '小栗');
  const patRequest = { operation: 'pat', petId: 0, requestId: 'pat-care-retry-0001' };
  const pat = await f.call('pet', patRequest);
  assert.equal(pat.profile.pets.residents[0].care.pats, 1);
  const retry = await f.call('pet', patRequest);
  assert.deepEqual(retry.profile.pets, pat.profile.pets);
});

test('cloud migration stores only Lili and preserves her care history and the wallet', async () => {
  const f = fixture();
  const login = await f.call('login');
  const queen = { id: 0, name: '小栗', fedUntil: login.serverTime, rationDay: login.day };
  const userId = login.output.userId;
  await f.store.transaction(async (tx) => {
    const user = await tx.get('players', userId);
    user.profile.coins = 50;
    user.profile.pets = {
      residents: [
        { ...queen, jobDay: '', returnsAt: 0 },
        { id: 1, name: '工蚁', jobDay: login.day, returnsAt: login.serverTime },
        { id: 2, name: '兵蚁', jobDay: '', returnsAt: 0 },
      ],
      melons: 3,
    };
    await tx.set('players', userId, user);
  });
  const migrated = await f.call('login');
  assert.deepEqual(migrated.profile.pets, {
    residents: [{ ...queen, care: freshProfile(migrated.serverTime).pets.residents[0].care }],
    melons: 3,
  });
  assert.equal(migrated.profile.coins, 50);
  assert.deepEqual(
    (await f.store.transaction((tx) => tx.get('players', userId))).profile.pets,
    migrated.profile.pets,
  );
});
test('world board sorts progress descending, first achievement ascending; no private profiles', async () => {
  const f = fixture();
  for (const user of ['alice', 'bob', 'carol']) await f.call('login', {}, user);
  await win(f, 0, 'alice');
  await win(f, 0, 'bob');
  await win(f, 0, 'carol');
  await win(f, 1, 'carol');
  const result = await f.call('leaderboard', { page: 0 });
  assert.deepEqual(
    result.rows.map((row) => row.highest),
    [2, 1, 1],
  );
  assert.equal(result.rows[1].self, true);
  assert.deepEqual(Object.keys(result.rows[0]).sort(), [
    'highest',
    'identity',
    'player',
    'rank',
    'reachedAt',
    'self',
  ]);
});
test('concurrent reward and purchase attempts cannot duplicate money or go negative', async () => {
  const f = fixture();
  await f.call('login');
  await win(f, 0);
  const claims = await Promise.all([f.call('claim'), f.call('claim')]);
  assert.deepEqual(
    claims.map((r) => r.output.amount).sort((a, b) => a - b),
    [0, 130],
  );
  const purchases = await Promise.all([
    f.call('shop', { skin: 'moss' }),
    f.call('shop', { skin: 'moss' }),
  ]);
  assert.equal(purchases[1].profile.coins, 30);
  assert.equal(purchases[1].output.purchase, 'equipped');
  assert.equal((await f.call('shop', { skin: 'rose' })).code, 'COINS');
  f.advance(86400000);
  assert.equal((await f.call('claim')).output.amount, 30);
});
test('ad completion is bound to a run and exactly once even with different request IDs', async () => {
  const f = fixture();
  await f.call('login');
  const start = await f.call('start', { level: 0 });
  const ad = await f.call('adStart', { runId: start.output.runId, placement: 'speed' });
  const request = { adId: ad.output.adId, requestId: 'same-request-12345678' };
  const done = await f.call('adComplete', request);
  assert.equal(done.adViews, 1);
  assert.equal((await f.call('adComplete', request)).adViews, 1);
  assert.equal((await f.call('adComplete', { adId: ad.output.adId })).code, 'SESSION');
  assert.equal((await f.call('adComplete', { ...request, adId: 'different' })).code, 'INPUT');
});
test('invalid sessions, impossible scores and incompatible catalogs are rejected', async () => {
  const f = fixture();
  await f.call('login');
  const a = await f.call('start', { level: 0 });
  const b = await f.call('start', { level: 0 });
  assert.equal(
    (await f.call('complete', { runId: a.output.runId, seconds: 120, moves: levels[0].moves[0] }))
      .code,
    'SESSION',
  );
  assert.equal(
    (await f.call('complete', { runId: b.output.runId, seconds: 1, moves: 1 })).code,
    'SCORE',
  );
  assert.equal((await f.call('login', { catalogVersion: 3 })).code, 'VERSION');
  assert.equal((await f.call('leaderboard', { page: -1 })).code, 'INPUT');
});
test('lost response is retried after relaunch without granting rewards twice', async () => {
  const f = fixture(),
    storage = memory();
  let loseResponse = true;
  const transport = async (request) => {
    const result = await f.service(request, { APPID, OPENID: 'alice' });
    if (request.action === 'claim' && loseResponse) {
      loseResponse = false;
      throw new Error('network timeout');
    }
    return result;
  };
  const first = new CloudGame(transport, storage);
  await first.login();
  await assert.rejects(first.mutate('claim'), /network timeout/);
  await assert.rejects(first.mutate('shop', { skin: 'moss' }), /pending request/);
  const reopened = new CloudGame(transport, storage);
  const state = await reopened.login();
  assert.equal(state.profile.coins, 30);
  assert.equal((await reopened.mutate('claim')).output.amount, 0);
});
test('cloud request errors are surfaced; different accounts never replay each others pending events', async () => {
  const f = fixture(),
    storage = memory();
  const alice = new CloudGame(async (request) => {
    if (request.action === 'claim') throw new Error('offline');
    return f.service(request, { APPID, OPENID: 'alice' });
  }, storage);
  await alice.login();
  await assert.rejects(alice.mutate('claim'), /offline/);
  const bob = new CloudGame((request) => f.service(request, { APPID, OPENID: 'bob' }), storage);
  assert.equal((await bob.login()).profile.coins, 0);
  await assert.rejects(bob.mutate('start', { level: 9 }), /前一关/);
  assert.equal((await bob.mutate('start', { level: 0 })).ok, true);
});
test('reward date uses Shanghai midnight', () => {
  assert.equal(dayAt(Date.UTC(2026, 9, 9, 15, 59, 59)), '2026-10-9');
  assert.equal(dayAt(Date.UTC(2026, 9, 9, 16)), '2026-10-10');
});

test('login persists the next unlock after appending levels without changing wallet or ranking', async () => {
  const f = fixture();
  const login = await f.call('login');
  await f.store.transaction(async (tx) => {
    const user = await tx.get('players', login.output.userId);
    user.profile.completed = [0];
    user.profile.unlocked = 0;
    user.profile.claimed = [0];
    user.profile.coins = 230;
    user.highest = 1;
    user.reachedAt = 123;
    await tx.set('players', login.output.userId, user);
  });
  const migrated = await f.call('login');
  assert.equal(migrated.profile.unlocked, 1);
  assert.equal(migrated.profile.coins, 230);
  assert.deepEqual(migrated.profile.claimed, [0]);
  assert.equal(migrated.highest, 1);
  assert.equal(migrated.reachedAt, 123);
  assert.equal((await f.call('start', { level: 1 })).ok, true);
  assert.deepEqual((await f.call('login')).profile, { ...migrated.profile, selected: 1 });
});

test('courtyard purchases are server-priced, atomic and durable across login', async () => {
  const f = fixture();
  await f.call('login');
  await win(f, 0);
  await win(f, 1);
  await f.call('claim');
  const purchases = await Promise.all([
    f.call('furnish', { item: 'leaf-awning', price: 0 }),
    f.call('furnish', { item: 'leaf-awning', price: 0 }),
  ]);
  assert.ok(purchases.every((result) => result.ok));
  assert.equal(purchases[1].profile.coins, 50);
  assert.deepEqual(purchases[1].profile.courtyard.owned, ['leaf-awning']);
  assert.equal((await f.call('furnish', { item: 'flower-arch' })).code, 'COINS');
  assert.equal((await f.call('furnish', { item: 'unknown' })).code, 'INPUT');
  const resumed = await f.call('login');
  assert.equal(resumed.profile.coins, 50);
  assert.equal(resumed.profile.courtyard.equipped.entrance, 'leaf-awning');
});

test('storing courtyard furniture preserves ownership and rejects invalid positions', async () => {
  const f = fixture();
  await f.call('login');
  await win(f, 0);
  await win(f, 1);
  await f.call('claim');
  await f.call('furnish', { item: 'leaf-awning' });
  assert.equal((await f.call('unfurnish', { slot: 'unknown' })).code, 'INPUT');
  const stored = await f.call('unfurnish', { slot: 'entrance' });
  assert.equal(stored.profile.courtyard.equipped.entrance, '');
  assert.deepEqual(stored.profile.courtyard.owned, ['leaf-awning']);
  const equipped = await f.call('furnish', { item: 'leaf-awning' });
  assert.equal(equipped.profile.coins, 50);
  assert.equal(equipped.profile.courtyard.equipped.entrance, 'leaf-awning');
});

test('world leaderboard hides legacy public profiles until fresh consent', async () => {
  const f = fixture();
  const login = await f.call('login');
  await win(f, 0);
  await f.store.transaction(async (tx) => {
    const user = await tx.get('players', login.output.userId);
    // Legacy records must not leak their previously stored public profile.
    user.identity = { nickname: 'old name', avatarUrl: 'https://example.com/avatar' };
    delete user.identityConsentVersion;
    await tx.set('players', login.output.userId, user);
  });
  const board = await f.call('leaderboard', { page: 0 });
  assert.match(board.rows[0].player, /^蚂蚁/);
  assert.equal(board.rows[0].identity, null);
  assert.equal((await f.call('identity')).code, 'INPUT');
});

test('login discards retired profile uploads while preserving cloud progress', async () => {
  const f = fixture(),
    storage = memory();
  const oldClient = new CloudGame(async (request) => {
    if (request.action === 'identity') throw new Error('offline');
    return f.service(request, { APPID, OPENID: 'alice' });
  }, storage);
  await oldClient.login();
  await assert.rejects(oldClient.mutate('identity', { nickname: 'old name' }), /offline/);
  const actions = [];
  const client = new CloudGame(async (request) => {
    actions.push(request.action);
    return f.service(request, { APPID, OPENID: 'alice' });
  }, storage);
  assert.equal((await client.login()).highest, 0);
  assert.deepEqual(actions, ['login'], 'never replay retired personal data');
  assert.equal((await client.mutate('claim')).profile.coins, 30);
});

test('late writes from a timed-out client cannot clear newer pending cloud requests', async () => {
  const f = fixture(),
    storage = memory();
  let finishOld;
  const transport = (request) => f.service(request, { APPID, OPENID: 'alice' });
  const old = new CloudGame((request) => {
    if (request.action === 'claim')
      return new Promise((resolve) => {
        finishOld = resolve;
      });
    return transport(request);
  }, storage);
  const login = await old.login();
  const oldWrite = old.mutate('claim');
  let finishNew;
  const current = new CloudGame((request) => {
    if (request.action === 'start')
      return new Promise((resolve) => {
        finishNew = resolve;
      });
    return transport(request);
  }, storage);
  const replayed = await current.login();
  assert.equal(replayed.profile.coins, 30);
  const newWrite = current.mutate('start', { level: 0 });
  const key = `ant-cloud-pending:cloudbase-d9glil4qk6b5865ba:${login.output.userId}`;
  const pending = storage.getItem(key);
  assert.equal(JSON.parse(pending).action, 'start');
  finishOld(replayed);
  await oldWrite;
  assert.equal(storage.getItem(key), pending, 'late completion preserves the newer receipt');
  await assert.rejects(current.mutate('claim'), /Another cloud request/);
  finishNew({ ...replayed, output: { runId: 'new-run' } });
  await newWrite;
  assert.equal(storage.getItem(key), null);
  const reopened = new CloudGame(transport, storage);
  assert.equal((await reopened.login()).profile.coins, 30);
});

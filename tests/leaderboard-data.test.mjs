import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { load } from './helpers/leaderboard-view.mjs';
const { LeaderboardData } = load(resolve('assets/scripts/app/LeaderboardData.ts'));
const board = { ok: true, rows: [], hasNext: false };
function fixture() {
  let now = 0;
  const game = {
    host: { isValid: true },
    identity: { revision: 0 },
    cloud: { cloudHighest: 1, cloudReachedAt: 5, cloud: { leaderboardAll: async () => board } },
  };
  return { game, data: new LeaderboardData(game, () => now), advance: (value) => (now += value) };
}

test('successful cache expires after 30 seconds and invalidates on identity, score or session changes', async () => {
  for (const change of [
    (f) => f.advance(30000),
    (f) => f.game.identity.revision++,
    (f) => f.game.cloud.cloudHighest++,
    (f) => f.game.cloud.cloudReachedAt++,
    (f) => (f.game.cloud.cloud = { leaderboardAll: async () => board }),
  ]) {
    const f = fixture();
    assert.equal(f.data.cached(), null);
    assert.equal(await f.data.load(), board);
    f.advance(29999);
    assert.equal(f.data.cached(), board);
    change(f);
    assert.equal(f.data.cached(), null);
  }
});

test('late results cannot seed a changed or destroyed session', async () => {
  for (const change of [(f) => f.game.identity.revision++, (f) => (f.game.host.isValid = false)]) {
    const f = fixture();
    let resolve;
    f.game.cloud.cloud.leaderboardAll = () => new Promise((done) => (resolve = done));
    const loading = f.data.load();
    change(f);
    resolve(board);
    assert.equal(await loading, board);
    assert.equal(f.data.cached(), null);
  }
});

test('failed reads propagate and do not populate the cache', async () => {
  const f = fixture(),
    error = new Error('offline');
  f.game.cloud.cloud.leaderboardAll = async () => {
    throw error;
  };
  await assert.rejects(f.data.load(), (actual) => actual === error);
  assert.equal(f.data.cached(), null);
});

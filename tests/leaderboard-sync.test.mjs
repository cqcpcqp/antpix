import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, flush } from './helpers/leaderboard-identity.mjs';

test('reopening checks consent and skips an already acknowledged profile; revocation clears once', async () => {
  const f = fixture({ permission: true });
  await flush();
  await f.identity.synchronize();
  const revision = f.identity.revision;
  await f.identity.synchronize();
  assert.equal(f.writes.length, 1);
  assert.equal(f.identity.revision, revision);
  f.setPermission(false);
  await f.identity.synchronize();
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[1].nickname, null);
  assert.ok(f.identity.revision > revision);
  await f.identity.synchronize();
  assert.equal(f.writes.length, 2);
});

test('new cloud sessions resynchronize and failed writes are never acknowledged', async () => {
  const f = fixture({ permission: true });
  await flush();
  await f.identity.synchronize();
  const error = new Error('write failed');
  let calls = 0;
  f.game.cloud.cloud = {
    mutate: async () => {
      if (++calls === 1) throw error;
    },
  };
  await assert.rejects(f.identity.synchronize(), (actual) => actual === error);
  await f.identity.synchronize();
  await f.identity.synchronize();
  assert.equal(calls, 2);
});

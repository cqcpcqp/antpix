import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createService } = require('../../cloudfunctions/game/service.js');
const { levels } = require('../../cloudfunctions/game/catalog.json');
export const APPID = 'wxd8e27ad9cd0289df';

export function fixture() {
  let data = new Map(),
    time = Date.UTC(2026, 9, 9, 12),
    serial = 0,
    lock = Promise.resolve();
  const store = {
    transaction(work) {
      const operation = lock.then(async () => {
        const draft = structuredClone(data);
        const result = await work({
          get: async (collection, id) => draft.get(collection + '/' + id),
          set: async (collection, id, value) => {
            draft.set(collection + '/' + id, structuredClone(value));
          },
        });
        data = draft;
        return structuredClone(result);
      });
      lock = operation.catch(() => {});
      return operation;
    },
    async leaderboard(skip, limit) {
      return [...data]
        .filter(([key, user]) => key.startsWith('players/') && user.highest > 0)
        .map(([key, user]) => ({ ...user, _id: key.split('/')[1] }))
        .sort(
          (a, b) =>
            b.highest - a.highest || a.reachedAt - b.reachedAt || a._id.localeCompare(b._id),
        )
        .slice(skip, skip + limit);
    },
  };
  const service = createService(
    store,
    () => time,
    () => `00000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`,
  );
  const call = (action, values = {}, user = 'alice') =>
    service(
      {
        catalogVersion: 4,
        action,
        requestId: `request-${String(++serial).padStart(16, '0')}`,
        ...values,
      },
      { APPID, OPENID: user },
    );
  return {
    service,
    call,
    advance: (ms) => {
      time += ms;
    },
    store,
  };
}
export async function win(f, level, user = 'alice') {
  const start = await f.call('start', { level }, user);
  assert.equal(start.ok, true);
  f.advance(120000);
  return f.call(
    'complete',
    { runId: start.output.runId, seconds: 120, moves: levels[level].moves[0] },
    user,
  );
}

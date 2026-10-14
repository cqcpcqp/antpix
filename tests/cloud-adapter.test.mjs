import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const entry = new URL('../cloudfunctions/game/index.js', import.meta.url);
const require = createRequire(entry);

test('CloudBase adapter excludes immutable document ID when saving existing players', async () => {
  let documents = new Map();
  const db = {
    async runTransaction(work) {
      const draft = structuredClone(documents);
      const result = await work({
        collection: (collection) => ({
          doc: (id) => ({
            async get() {
              return { data: draft.get(`${collection}/${id}`) };
            },
            async set({ data }) {
              assert.equal(
                Object.hasOwn(data, '_id'),
                false,
                'CloudBase rejects writes containing _id',
              );
              draft.set(`${collection}/${id}`, structuredClone({ ...data, _id: id }));
            },
          }),
        }),
      });
      documents = draft;
      return result;
    },
  };
  const sdk = {
    init() {},
    database: () => db,
    getWXContext: () => ({ APPID: 'wxd8e27ad9cd0289df', OPENID: 'adapter-test' }),
  };
  const exports = {};
  runInNewContext(
    readFileSync(entry, 'utf8'),
    {
      exports,
      require: (name) => (name === 'wx-server-sdk' ? sdk : require(name)),
    },
    { filename: entry.pathname },
  );
  const call = (action, values = {}) => exports.main({ catalogVersion: 4, action, ...values });

  await call('login');
  const request = { requestId: 'claim-adapter-00000001' };
  const claimed = await call('claim', request);
  assert.equal(claimed.profile.coins, 30);
  assert.equal(claimed.output.amount, 30);
  assert.equal((await call('claim', request)).profile.coins, 30);
  assert.equal((await call('login')).profile.coins, 30);
  assert.equal((await call('start', { requestId: 'start-adapter-00000001', level: 0 })).ok, true);
  assert.equal(documents.size, 3);
  for (const [key, document] of documents) assert.equal(document._id, key.split('/')[1]);
});

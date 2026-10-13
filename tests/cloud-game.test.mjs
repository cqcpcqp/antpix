import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CloudGame } from '../assets/scripts/cloudGame.ts';
import { freshProfile, SKINS } from '../assets/scripts/profile.ts';
const require = createRequire(import.meta.url);
const { createService, dayAt } = require('../cloudfunctions/game/service.js');
const { levels } = require('../cloudfunctions/game/catalog.json');
const generated = require('../cloudfunctions/game/profile.js');
const APPID = 'wxd8e27ad9cd0289df';

function fixture() {
    let data = new Map(), time = Date.UTC(2026, 9, 9, 12), serial = 0, lock = Promise.resolve();
    const store = {
        transaction(work) {
            const operation = lock.then(async () => {
                const draft = structuredClone(data);
                const result = await work({
                    get: async (collection, id) => draft.get(collection + '/' + id),
                    set: async (collection, id, value) => { draft.set(collection + '/' + id, structuredClone(value)); },
                });
                data = draft;
                return structuredClone(result);
            });
            lock = operation.catch(() => {});
            return operation;
        },
        async leaderboard(skip, limit) {
            return [...data].filter(([key, user]) => key.startsWith('players/') && user.highest > 0)
                .map(([key, user]) => ({ ...user, _id: key.split('/')[1] }))
                .sort((a, b) => b.highest - a.highest || a.reachedAt - b.reachedAt || a._id.localeCompare(b._id))
                .slice(skip, skip + limit);
        },
    };
    const service = createService(store, () => time, () => `00000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`);
    const call = (action, values = {}, user = 'alice') => service({ catalogVersion: 4, action,
        requestId: `request-${String(++serial).padStart(16, '0')}`, ...values }, { APPID, OPENID: user });
    return { service, call, advance: ms => { time += ms; }, store };
}
const memory = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
async function win(f, level, user = 'alice') {
    const start = await f.call('start', { level }, user);
    assert.equal(start.ok, true);
    f.advance(120000);
    return f.call('complete', { runId: start.output.runId, seconds: 120, moves: levels[level].moves[0] }, user);
}

test('generated server rules match client catalog and assets', () => {
    assert.deepEqual(generated.freshProfile(), freshProfile());
    assert.deepEqual(generated.SKINS, SKINS);
});
test('trusted WeChat identity only; users cannot submit balance or another identity', async () => {
    const f = fixture();
    assert.equal((await f.service({ action: 'login', catalogVersion: 4 }, { APPID: 'wrong', OPENID: 'alice' })).code, 'UNAUTHORIZED');
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
test('world board sorts progress descending, first achievement ascending; no private profiles', async () => {
    const f = fixture();
    for (const user of ['alice', 'bob', 'carol']) await f.call('login', {}, user);
    await win(f, 0, 'alice');
    await win(f, 0, 'bob');
    await win(f, 0, 'carol');
    await win(f, 1, 'carol');
    const result = await f.call('leaderboard', { page: 0 });
    assert.deepEqual(result.rows.map(row => row.highest), [2, 1, 1]);
    assert.equal(result.rows[1].self, true);
    assert.deepEqual(Object.keys(result.rows[0]).sort(), ['highest', 'player', 'rank', 'reachedAt', 'self']);
});
test('concurrent reward and purchase attempts cannot duplicate money or go negative', async () => {
    const f = fixture();
    await f.call('login');
    await win(f, 0);
    const claims = await Promise.all([f.call('claim'), f.call('claim')]);
    assert.deepEqual(claims.map(r => r.output.amount).sort((a, b) => a - b), [0, 130]);
    const purchases = await Promise.all([f.call('shop', { skin: 'moss' }), f.call('shop', { skin: 'moss' })]);
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
    assert.equal((await f.call('complete', { runId: a.output.runId, seconds: 120, moves: levels[0].moves[0] })).code, 'SESSION');
    assert.equal((await f.call('complete', { runId: b.output.runId, seconds: 1, moves: 1 })).code, 'SCORE');
    assert.equal((await f.call('login', { catalogVersion: 3 })).code, 'VERSION');
    assert.equal((await f.call('leaderboard', { page: -1 })).code, 'INPUT');
});
test('lost response is retried after relaunch without granting rewards twice', async () => {
    const f = fixture(), storage = memory();
    let loseResponse = true;
    const transport = async request => {
        const result = await f.service(request, { APPID, OPENID: 'alice' });
        if (request.action === 'claim' && loseResponse) { loseResponse = false; throw new Error('network timeout'); }
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
    const f = fixture(), storage = memory();
    const alice = new CloudGame(async request => {
        if (request.action === 'claim') throw new Error('offline');
        return f.service(request, { APPID, OPENID: 'alice' });
    }, storage);
    await alice.login();
    await assert.rejects(alice.mutate('claim'), /offline/);
    const bob = new CloudGame(request => f.service(request, { APPID, OPENID: 'bob' }), storage);
    assert.equal((await bob.login()).profile.coins, 0);
    await assert.rejects(bob.mutate('start', { level: 9 }), /前一关/);
    assert.equal((await bob.mutate('start', { level: 0 })).ok, true);
});
test('reward date uses Shanghai midnight', () => {
    assert.equal(dayAt(Date.UTC(2026, 9, 9, 15, 59, 59)), '2026-10-9');
    assert.equal(dayAt(Date.UTC(2026, 9, 9, 16)), '2026-10-10');
});

test('login persists the next unlock after appending levels without changing wallet or ranking',async()=>{
 const f=fixture();const login=await f.call('login');
 await f.store.transaction(async tx=>{
  const user=await tx.get('players',login.output.userId);
  user.profile.completed=[0];user.profile.unlocked=0;user.profile.claimed=[0];
  user.profile.coins=230;user.highest=1;user.reachedAt=123;
  await tx.set('players',login.output.userId,user);
 });
 const migrated=await f.call('login');
 assert.equal(migrated.profile.unlocked,1);assert.equal(migrated.profile.coins,230);
 assert.deepEqual(migrated.profile.claimed,[0]);assert.equal(migrated.highest,1);assert.equal(migrated.reachedAt,123);
 assert.equal((await f.call('start',{level:1})).ok,true);
 assert.deepEqual((await f.call('login')).profile,{...migrated.profile,selected:1});
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
    assert.ok(purchases.every(result => result.ok));
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
    await f.call('login');await win(f,0);await win(f,1);await f.call('claim');
    await f.call('furnish',{item:'leaf-awning'});
    assert.equal((await f.call('unfurnish',{slot:'unknown'})).code,'INPUT');
    const stored=await f.call('unfurnish',{slot:'entrance'});
    assert.equal(stored.profile.courtyard.equipped.entrance,'');
    assert.deepEqual(stored.profile.courtyard.owned,['leaf-awning']);
    const equipped=await f.call('furnish',{item:'leaf-awning'});
    assert.equal(equipped.profile.coins,50);
    assert.equal(equipped.profile.courtyard.equipped.entrance,'leaf-awning');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { PET_HOUR, petAction, petVitals } from '../assets/scripts/domain/profile/pets.ts';
import {
  freshProfile,
  readProfile,
  rewardAmount,
  claimRewards,
  buyOrEquip,
  recordWin,
} from '../assets/scripts/domain/profile/profile.ts';

test('offline care respects the hunger grace period, recovery and the daily mood cap', () => {
  const profile = freshProfile(0);
  const [pet] = profile.pets.residents;
  const hour = (hours) => hours * PET_HOUR;
  assert.equal(petVitals(pet, hour(86)).health, 100);
  assert.equal(petVitals(pet, hour(87)).health, 99);
  assert.equal(petVitals(pet, hour(240)).health, 60);
  assert.equal(petAction(profile, 'feed', 0, 'ration', hour(240), 'day-1'), '');
  assert.deepEqual(petVitals(pet, hour(242)), { health: 62, satiety: 2200 / 72, mood: 64 });
  for (let i = 0; i < 4; i++)
    assert.equal(petAction(profile, 'pat', 0, '', hour(242), 'day-1'), '');
  assert.equal(petVitals(pet, hour(242)).mood, 88);
  const restored = readProfile(JSON.stringify(profile), 6, hour(248));
  const [savedPet] = restored.pets.residents;
  assert.equal(petVitals(savedPet, hour(248)).mood, 87);
  assert.equal(petVitals(savedPet, hour(248)).health, 68);
  assert.equal(petAction(restored, 'pat', 0, '', hour(248), 'day-2'), '');
  assert.equal(petVitals(savedPet, hour(248)).mood, 95);
});
test('existing save upgrades without losing progress', () => {
  const p = readProfile(
    JSON.stringify({
      catalogVersion: 4,
      unlocked: 3,
      selected: 2,
      sound: false,
      completed: [0, 1, 2],
    }),
    6,
  );
  assert.equal(p.selected, 2);
  assert.equal(p.sound, false);
  assert.deepEqual(p.completed, [0, 1, 2]);
  assert.equal(p.coins, 0);
  assert.deepEqual(p.owned, ['sand']);
});
test('daily and first-clear rewards can each be claimed only once', () => {
  const p = freshProfile();
  p.completed = [0, 1];
  assert.equal(rewardAmount(p, '2026-9-28'), 230);
  assert.equal(claimRewards(p, '2026-9-28'), 230);
  assert.equal(claimRewards(p, '2026-9-28'), 0);
  assert.equal(claimRewards(p, '2026-9-29'), 30);
  p.completed.push(2);
  assert.equal(claimRewards(p, '2026-9-29'), 100);
  assert.equal(p.coins, 360);
});
test('insufficient coins never charge or grant a skin; repeated equip does not charge', () => {
  const p = freshProfile();
  assert.equal(buyOrEquip(p, 'rose'), 'insufficient');
  assert.deepEqual(p.owned, ['sand']);
  assert.equal(p.coins, 0);
  p.coins = 160;
  assert.equal(buyOrEquip(p, 'rose'), 'purchased');
  assert.equal(p.coins, 10);
  assert.equal(p.nest, 'rose');
  assert.equal(buyOrEquip(p, 'rose'), 'equipped');
  assert.equal(p.coins, 10);
  assert.equal(buyOrEquip(p, 'unknown'), 'invalid');
  assert.equal(p.coins, 10);
});
test('recording a win unlocks once and retains the best actual time', () => {
  const p = freshProfile();
  recordWin(p, { level: 0, seconds: 200, moves: 40 }, 6);
  recordWin(p, { level: 0, seconds: 300, moves: 30 }, 6);
  assert.equal(p.best[0].seconds, 200);
  assert.equal(p.unlocked, 1);
  assert.deepEqual(p.completed, [0]);
  recordWin(p, { level: 0, seconds: 180, moves: 38 }, 6);
  assert.equal(p.best[0].seconds, 180);
  assert.equal(p.best.length, 1);
  recordWin(p, { level: 5, seconds: 150, moves: 30 }, 6);
  assert.equal(p.unlocked, 5);
});
test('coins, claims, skins and records survive a round-trip', () => {
  const p = freshProfile();
  recordWin(p, { level: 0, seconds: 120, moves: 40 }, 6);
  claimRewards(p, '2026-9-28');
  buyOrEquip(p, 'moss');
  assert.deepEqual(readProfile(JSON.stringify(p), 6), p);
  assert.equal(claimRewards(readProfile(JSON.stringify(p), 6), '2026-9-28'), 0);
});
test('damaged local fields cannot grant invalid skins or negative coins', () => {
  const p = freshProfile();
  p.coins = -30;
  p.owned = ['invalid'];
  p.nest = 'invalid';
  p.best = [{ level: 99, seconds: -1, moves: 0 }];
  const restored = readProfile(JSON.stringify(p), 6);
  assert.equal(restored.coins, 0);
  assert.deepEqual(restored.owned, ['sand']);
  assert.equal(restored.nest, 'sand');
  assert.deepEqual(restored.best, []);
  assert.deepEqual(readProfile('broken', 6, 0), freshProfile(0));
});

test('replacing the catalog clears artwork identities but preserves wallet and skins', () => {
  for (const version of [undefined, 2]) {
    const old = {
      catalogVersion: version,
      unlocked: 99,
      selected: 75,
      sound: false,
      completed: [0, 75],
      claimed: [0],
      coins: 150,
      owned: ['sand', 'moss'],
      nest: 'moss',
      best: [{ level: 75, seconds: 123, moves: 7 }],
      daily: '2026-09-28',
    };
    const p = readProfile(JSON.stringify(old), 1);
    assert.equal(p.catalogVersion, 4);
    assert.equal(p.selected, 0);
    assert.equal(p.unlocked, 0);
    assert.deepEqual(p.completed, []);
    assert.deepEqual(p.claimed, []);
    assert.deepEqual(p.best, []);
    assert.equal(p.coins, 150);
    assert.equal(p.nest, 'moss');
    assert.deepEqual(p.owned, ['sand', 'moss']);
    assert.equal(p.sound, false);
    assert.equal(p.daily, old.daily);
    assert.deepEqual(readProfile(JSON.stringify(p), 1), p);
    recordWin(p, { level: 0, seconds: 123, moves: 7 }, 1);
    assert.equal(p.unlocked, 0);
    assert.deepEqual(readProfile(JSON.stringify(p), 1), p);
  }
});

test('appending artworks preserves Nick collections and resources', () => {
  const p = freshProfile();
  recordWin(p, { level: 0, seconds: 120, moves: 50 }, 1);
  claimRewards(p, '2026-9-29');
  buyOrEquip(p, 'moss');
  assert.deepEqual(readProfile(JSON.stringify(p), 5), { ...p, unlocked: 1 });
});

test('music setting persists independently and old muted saves remain muted', () => {
  const old = freshProfile();
  delete old.music;
  old.sound = false;
  assert.equal(readProfile(JSON.stringify(old), 5).music, false);
  old.sound = true;
  assert.equal(readProfile(JSON.stringify(old), 5).music, true);
  const separate = freshProfile();
  separate.music = false;
  separate.sound = true;
  assert.equal(readProfile(JSON.stringify(separate), 5).music, false);
  assert.equal(readProfile(JSON.stringify(separate), 5).sound, true);
});

test('100-level extension unlocks level 11 for an old full-clear save and preserves earned resources', () => {
  const old = freshProfile();
  for (let level = 0; level < 10; level++) recordWin(old, { level, seconds: 120, moves: 90 }, 10);
  old.selected = 9;
  claimRewards(old, '2026-10-10');
  buyOrEquip(old, 'moss');
  const restored = readProfile(JSON.stringify(old), 100);
  assert.deepEqual(restored, { ...old, unlocked: 10 });
  assert.deepEqual(readProfile(JSON.stringify(restored), 100), restored);
  for (let level = 10; level < 100; level++)
    recordWin(restored, { level, seconds: 120, moves: 90 }, 100);
  assert.equal(restored.unlocked, 99);
  assert.equal(restored.completed.length, 100);
  assert.equal(readProfile(JSON.stringify(restored), 100).unlocked, 99);
});

test('local migration drops old companions and keeps Lili, food and coins', () => {
  const profile = freshProfile(0);
  const queen = { id: 0, name: '小栗', fedUntil: 1234, rationDay: '2026-11-23' };
  const saved = {
    ...profile,
    coins: 49,
    pets: {
      residents: [
        { ...queen, jobDay: '', returnsAt: 0 },
        { id: 1, name: '工蚁', returnsAt: 5678 },
        { id: 2, name: '兵蚁', returnsAt: 0 },
      ],
      melons: 2,
    },
  };
  const restored = readProfile(JSON.stringify(saved), 8, 2000);
  assert.deepEqual(restored.pets, {
    residents: [{ ...queen, care: freshProfile(2000).pets.residents[0].care }],
    melons: 2,
  });
  assert.equal(restored.coins, 49);
});

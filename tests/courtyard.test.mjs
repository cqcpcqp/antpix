import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshProfile,
  readProfile,
  buyOrEquipFurnishing,
  upgradeCourtyard,
} from '../assets/scripts/domain/profile/profile.ts';

test('furnishings charge once, equip independently and preserve balance on rejected purchases', () => {
  const profile = freshProfile();
  profile.coins = 800;
  assert.equal(buyOrEquipFurnishing(profile, 'leaf-awning'), 'purchased');
  assert.equal(buyOrEquipFurnishing(profile, 'daisy-bed'), 'purchased');
  assert.equal(profile.coins, 320);
  assert.equal(profile.courtyard.equipped.entrance, 'leaf-awning');
  assert.equal(profile.courtyard.equipped.garden, 'daisy-bed');
  const before = structuredClone(profile);
  assert.equal(buyOrEquipFurnishing(profile, 'flower-arch'), 'insufficient');
  assert.equal(buyOrEquipFurnishing(profile, 'unknown'), 'invalid');
  assert.deepEqual(profile, before);
  assert.equal(buyOrEquipFurnishing(profile, 'leaf-awning'), 'equipped');
  assert.deepEqual(profile, before);
  assert.deepEqual(readProfile(JSON.stringify(profile), 100), profile);
});

test('stored profile migration preserves existing money and skins and only runs once', () => {
  const profile = freshProfile();
  profile.coins = 760;
  profile.owned.push('rose');
  profile.nest = 'rose';
  delete profile.courtyard;
  const old = structuredClone(profile);
  assert.equal(upgradeCourtyard(profile), true);
  assert.equal(upgradeCourtyard(profile), false);
  const { courtyard, ...preserved } = profile;
  assert.deepEqual(preserved, old);
  assert.deepEqual(courtyard, freshProfile().courtyard);
  assert.deepEqual(readProfile(JSON.stringify(old), 100), profile);
});

test('local save cannot equip an unowned furnishing or move it into the wrong slot', () => {
  const profile = freshProfile();
  profile.courtyard.owned = ['leaf-awning', 'unknown', 'leaf-awning'];
  profile.courtyard.equipped = {
    entrance: 'flower-arch',
    path: 'leaf-awning',
    garden: '',
    living: '',
  };
  const restored = readProfile(JSON.stringify(profile), 100);
  assert.deepEqual(restored.courtyard.owned, ['leaf-awning']);
  assert.deepEqual(restored.courtyard.equipped, freshProfile().courtyard.equipped);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { load, cc, Texture2D, resourceLoads } = require('../scripts/headless-game.cjs');
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
const { FURNISHINGS } = load(process.cwd() + '/assets/scripts/profile.ts');
const item = (id) => FURNISHINGS.find((value) => value.id === id);
const makeGame = () => {
  const game = new PixelGarden();
  game.onLoad();
  return game;
};

test('selecting decorations preserves the drawer position and opening animation', () => {
  const game = makeGame();
  game.shop();
  const modal = game.modal,
    sheet = game.drawerSheet,
    opening = game.drawerMotion;
  game.updateOverlays(0.12);
  const openingY = sheet.position.y;
  const clickItem = (id) => {
    const row = game.courtyardShopContent.children.find((node) =>
      node.children.some((child) => child.name === 'Furnishing thumbnail ' + id),
    );
    row.emit('end');
  };
  clickItem('mushroom-awning');
  assert.equal(game.courtyardPreview.id, 'mushroom-awning');
  assert.equal(game.modal, modal);
  assert.equal(game.drawerSheet, sheet);
  assert.equal(sheet.position.y, openingY);
  assert.equal(game.drawerMotion, opening);
  assert.equal(opening.elapsed, 0.12);
  game.updateOverlays(0.3);
  const openY = sheet.position.y;
  clickItem('flower-arch');
  game.shop('garden', 'daisy-bed');
  assert.equal(game.courtyardPreview.id, 'daisy-bed');
  assert.equal(game.drawerSheet, sheet);
  assert.equal(sheet.position.y, openY);
  assert.equal(game.drawerMotion, null);
  game.dismissOverlay();
  game.updateOverlays(0.4);
  assert.equal(game.modal, null);
  assert.equal(game.courtyardShopContent, null);
  assert.equal(game.courtyardPreview, undefined);
  game.shop();
  assert.notEqual(game.drawerSheet, sheet);
  assert.ok(game.drawerMotion);
  game.onDestroy();
});

test('courtyard previews never charge or persist, closing restores actual furnishings', () => {
  const game = makeGame();
  game.save.coins = 1000;
  const before = JSON.stringify(game.save);
  game.shop('entrance', 'flower-arch');
  assert.equal(game.courtyardPreview.id, 'flower-arch');
  assert.equal(game.courtyardNode.children[0].name, 'Furnishing flower-arch');
  assert.equal(JSON.stringify(game.save), before);
  game.closeModal();
  assert.equal(game.courtyardPreview, undefined);
  assert.equal(
    game.courtyardNode.children.filter((node) => node.name.startsWith('Furnishing ')).length,
    0,
  );
  assert.equal(game.homeScene.node.position.y, 0);
  assert.equal(game.homeTitle.node.active, true);
  game.onDestroy();
});

test('closing decoration drawers keeps every animation frame covered and fades the veil', () => {
  const originalFrameSize = cc.view.getFrameSize;
  try {
    for (const frame of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 750, height: 1500 },
    ]) {
      cc.view.getFrameSize = () => frame;
      for (const slot of ['entrance', 'path', 'garden', 'living']) {
        for (const openingTime of [0, 0.06, 0.4]) {
          const game = makeGame();
          game.shop(slot);
          game.updateOverlays(openingTime);
          const before = JSON.stringify(game.save);
          game.dismissOverlay();
          const motion = game.drawerMotion;
          game.dismissOverlay();
          assert.equal(game.drawerMotion, motion, 'repeated dismissal must not restart closing');
          let previousOffset = game.homeScene.node.position.y;
          let previousOpacity = game.drawerVeil.opacity;
          for (let i = 0; i < 21; i++) {
            game.updateOverlays(1 / 60);
            const offset = game.homeScene.node.position.y;
            const sheet = game.drawerSheet;
            const visibleTop =
              sheet.position.y + sheet.getComponent(cc.UITransform).height / 2 - 30;
            const coveredHeight = Math.max(0, visibleTop + game.screenHeight / 2);
            assert.ok(
              offset <= coveredHeight + 1e-8,
              'the drawer must cover the exposed background',
            );
            assert.ok(offset <= previousOffset, 'the background must return monotonically');
            assert.equal(game.courtyardNode.position.y, offset);
            assert.ok(game.drawerVeil.opacity < previousOpacity);
            previousOffset = offset;
            previousOpacity = game.drawerVeil.opacity;
            if (i === 8) {
              game.refreshCourtyard();
              assert.ok(
                Math.abs(game.homeScene.node.position.y - offset) < 1e-8,
                'refreshing furnishings during dismissal must preserve animation progress',
              );
            }
          }
          game.updateOverlays(1 / 60);
          assert.equal(game.homeScene.node.position.y, 0);
          assert.equal(game.modal, null);
          assert.equal(game.drawerVeil, null);
          assert.equal(game.courtyardPreview, undefined);
          assert.equal(game.homeTitle.node.active, true);
          assert.equal(JSON.stringify(game.save), before);
          game.onDestroy();
        }
      }
    }
  } finally {
    cc.view.getFrameSize = originalFrameSize;
  }
});

test('buy, switch, store and re-equip keep independent positions and charge only once', () => {
  const game = makeGame();
  game.save.coins = 2000;
  game.shop();
  game.purchaseFurnishing(item('leaf-awning'));
  game.purchaseFurnishing(item('mushroom-awning'));
  game.purchaseFurnishing(item('daisy-bed'));
  assert.equal(game.save.coins, 1020);
  game.purchaseFurnishing(item('leaf-awning'));
  assert.equal(game.save.coins, 1020);
  assert.equal(game.save.courtyard.equipped.entrance, 'leaf-awning');
  assert.equal(game.save.courtyard.equipped.garden, 'daisy-bed');
  game.clearFurnishing('entrance');
  assert.equal(game.save.courtyard.equipped.entrance, '');
  assert.equal(game.save.courtyard.equipped.garden, 'daisy-bed');
  game.purchaseFurnishing(item('leaf-awning'));
  assert.equal(game.save.coins, 1020);
  game.closeModal();
  assert.equal(
    game.courtyardNode.children.filter((node) => node.name.startsWith('Furnishing ')).length,
    2,
  );
  game.onDestroy();
});

test('insufficient funds preserve wallet and preview; resource arrival fills open thumbnails', () => {
  const game = makeGame();
  game.shop();
  const before = JSON.stringify(game.save),
    modal = game.modal;
  game.purchaseFurnishing(item('leaf-awning'));
  assert.equal(JSON.stringify(game.save), before);
  assert.equal(game.modal, modal);
  const texture = new Texture2D();
  texture.width = 1024;
  texture.height = 768;
  resourceLoads.get('home/furnishings/texture')(null, texture);
  assert.equal(game.furnishingFrames.size, 12);
  const selected = game.courtyardNode.children[0].getComponent(cc.Sprite);
  assert.equal(selected.spriteFrame, game.furnishingFrames.get('leaf-awning'));
  const samples = [];
  const walk = (node) => {
    if (node.name.startsWith('Furnishing thumbnail')) samples.push(node);
    node.children.forEach(walk);
  };
  walk(game.modal);
  assert.equal(samples.length, 3);
  assert.ok(samples.every((node) => node.getComponent(cc.Sprite).spriteFrame));
  game.onDestroy();
  assert.equal(texture.refs, 0);
});

test('cloud purchase has no optimistic spend and ignores additional taps while pending', async () => {
  const game = makeGame();
  game.save.coins = 500;
  game.cloudMode = true;
  game.cloudReady = true;
  game.cloudHighest = 0;
  game.cloudReachedAt = 0;
  let resolve,
    requests = 0;
  game.cloud = {
    mutate: () => {
      requests++;
      return new Promise((done) => {
        resolve = done;
      });
    },
  };
  game.shop();
  const before = JSON.stringify(game.save);
  game.purchaseFurnishing(item('leaf-awning'));
  game.purchaseFurnishing(item('leaf-awning'));
  assert.equal(requests, 1);
  assert.equal(JSON.stringify(game.save), before);
  game.closeModal();
  const profile = JSON.parse(before);
  profile.coins = 320;
  profile.courtyard.owned = ['leaf-awning'];
  profile.courtyard.equipped.entrance = 'leaf-awning';
  resolve({
    ok: true,
    profile,
    day: '2026-10-10',
    serverTime: Date.now(),
    adViews: 0,
    highest: 0,
    reachedAt: 0,
    output: { purchase: 'purchased' },
  });
  await new Promise((done) => setImmediate(done));
  assert.equal(game.save.coins, 320);
  assert.equal(game.save.courtyard.equipped.entrance, 'leaf-awning');
  assert.equal(game.modal, null, 'late completion must not reopen a dismissed drawer');
  game.onDestroy();
});

test('homepage life survives decoration refresh and pauses behind overlays or in background', () => {
  const game = makeGame();
  const texture = new Texture2D();
  texture.width = 512;
  texture.height = 384;
  resourceLoads.get('home/resident/texture')(null, texture);
  const life = game.courtyardLife;
  for (let i = 0; i < 180; i++) game.update(1 / 60);
  assert.notEqual(life.action, 'inside');
  const before = { x: life.x, y: life.y, elapsed: life.elapsed };
  game.shop('living', 'leaf-bed');
  for (let i = 0; i < 100; i++) game.update(1 / 60);
  assert.deepEqual({ x: life.x, y: life.y, elapsed: life.elapsed }, before);
  assert.equal(life.chair, false, 'unbought preview does not unlock an interaction');
  game.closeModal();
  game.showHome();
  assert.equal(game.courtyardLife, life);
  assert.deepEqual({ x: life.x, y: life.y, elapsed: life.elapsed }, before);
  game.paused = true;
  game.update(0.05);
  assert.equal(life.elapsed, before.elapsed);
  game.paused = false;
  game.update(0.05);
  assert.ok(life.elapsed > before.elapsed);
  game.onDestroy();
});

test('three residents and night lighting stay below home controls and pause together', () => {
  const game = makeGame();
  const texture = new Texture2D();
  texture.width = 512;
  texture.height = 384;
  resourceLoads.get('home/resident/texture')(null, texture);
  game.courtyardHour = () => 22;
  game.save.courtyard.equipped.garden = 'lantern-garden';
  game.refreshCourtyard();
  assert.equal(game.courtyardResidents.length, 3);
  for (const view of game.courtyardResidents) assert.equal(view.root.parent, game.courtyardNode);
  for (let i = 0; i < 120; i++) game.update(1 / 60);
  assert.equal(game.courtyardColony.night, true);
  const before = game.courtyardColony.residents.map((r) => [r.x, r.y, r.elapsed]);
  game.shop('living', 'dew-pond');
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  assert.deepEqual(
    game.courtyardColony.residents.map((r) => [r.x, r.y, r.elapsed]),
    before,
  );
  assert.ok(game.courtyardResidents.every((v) => !v.root.active));
  game.closeModal();
  game.update(1 / 60);
  assert.ok(game.courtyardResidents.every((v) => v.root.active));
  game.courtyardHour = () => 12;
  game.update(1 / 60);
  assert.equal(game.courtyardColony.night, false);
  game.onDestroy();
});

test('different-sized residents share the same ground anchor as their shadow', () => {
  const game = makeGame();
  const texture = new Texture2D();
  texture.width = 512;
  texture.height = 384;
  resourceLoads.get('home/resident/texture')(null, texture);
  game.courtyardColony.residents.forEach((r, i) => {
    r.x = 450 + i * 60;
    r.y = 870;
    r.action = 'rest';
    r.activity = 'sun';
    r.elapsed = 0;
    const view = game.courtyardResidents[i];
    view.render(r, false);
    const body = view.root.children.find((n) => n.name === 'Resident pose');
    const shadow = view.root.children.find((n) => n.name === 'Resident ground shadow');
    const height = body.getComponent(cc.UITransform).height;
    assert.ok(Math.abs(shadow.position.y + (height * 58) / 128) < 1e-8);
    assert.ok(Math.abs(view.root.position.y + shadow.position.y - (768 - r.y) * view.scale) < 1e-8);
  });
  game.onDestroy();
});

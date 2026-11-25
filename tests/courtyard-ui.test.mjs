import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { load, cc, Texture2D, resourceLoads } = require('../scripts/headless-game.cjs');
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
const { FURNISHINGS } = load(process.cwd() + '/assets/scripts/domain/profile/profile.ts');
const item = (id) => FURNISHINGS.find((value) => value.id === id);
const makeGame = () => {
  const game = new PixelGarden();
  game.onLoad();
  return game;
};

test('courtyard renders local furnishing effects without a full-screen tint', () => {
  const game = makeGame();
  const { courtyard } = game.runtime;
  const nodes = courtyard.courtyardNode.children;
  assert.equal(
    nodes.find((n) => n.name === 'Courtyard evening light'),
    undefined,
  );
  const effects = nodes.find((n) => n.name === 'Courtyard furniture effects');
  assert.ok(effects.active);
  assert.equal(effects.getComponent(cc.Graphics).commands.length, 0);
  game.onDestroy();
});

test('selecting decorations preserves the drawer position and opening animation', () => {
  const game = makeGame();
  game.runtime.shop.shop();
  const modal = game.runtime.overlays.modal,
    sheet = game.runtime.overlays.drawerSheet,
    opening = game.runtime.overlays.drawerMotion;
  game.runtime.overlays.updateOverlays(0.12);
  const openingY = sheet.position.y;
  const clickItem = (id) => {
    const row = game.runtime.shop.courtyardShopContent.children.find((node) =>
      node.children.some((child) => child.name === 'Furnishing thumbnail ' + id),
    );
    row.emit('end');
  };
  clickItem('mushroom-awning');
  assert.equal(game.runtime.courtyard.courtyardPreview.id, 'mushroom-awning');
  assert.equal(game.runtime.overlays.modal, modal);
  assert.equal(game.runtime.overlays.drawerSheet, sheet);
  assert.equal(sheet.position.y, openingY);
  assert.equal(game.runtime.overlays.drawerMotion, opening);
  assert.equal(opening.elapsed, 0.12);
  game.runtime.overlays.updateOverlays(0.3);
  const openY = sheet.position.y;
  clickItem('flower-arch');
  game.runtime.shop.shop('garden', 'daisy-bed');
  assert.equal(game.runtime.courtyard.courtyardPreview.id, 'daisy-bed');
  assert.equal(game.runtime.overlays.drawerSheet, sheet);
  assert.equal(sheet.position.y, openY);
  assert.equal(game.runtime.overlays.drawerMotion, null);
  game.runtime.overlays.dismissOverlay();
  game.runtime.overlays.updateOverlays(0.4);
  assert.equal(game.runtime.overlays.modal, null);
  assert.equal(game.runtime.shop.courtyardShopContent, null);
  assert.equal(game.runtime.courtyard.courtyardPreview, undefined);
  game.runtime.shop.shop();
  assert.notEqual(game.runtime.overlays.drawerSheet, sheet);
  assert.ok(game.runtime.overlays.drawerMotion);
  game.onDestroy();
});

test('courtyard previews never charge or persist, closing restores actual furnishings', () => {
  const game = makeGame();
  game.runtime.profile.save.coins = 1000;
  const before = JSON.stringify(game.runtime.profile.save);
  game.runtime.shop.shop('entrance', 'flower-arch');
  assert.equal(game.runtime.courtyard.courtyardPreview.id, 'flower-arch');
  assert.deepEqual(
    game.runtime.courtyard.courtyardNode.children
      .filter((node) => node.name.startsWith('Furnishing '))
      .map((node) => node.name),
    ['Furnishing flower-arch'],
  );
  assert.equal(JSON.stringify(game.runtime.profile.save), before);
  game.runtime.overlays.closeModal();
  assert.equal(game.runtime.courtyard.courtyardPreview, undefined);
  assert.equal(
    game.runtime.courtyard.courtyardNode.children.filter((node) =>
      node.name.startsWith('Furnishing '),
    ).length,
    0,
  );
  assert.equal(game.runtime.home.homeScene.node.position.y, 0);
  assert.equal(game.runtime.home.homeTitle.node.active, true);
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
          game.runtime.shop.shop(slot);
          game.runtime.overlays.updateOverlays(openingTime);
          const before = JSON.stringify(game.runtime.profile.save);
          game.runtime.overlays.dismissOverlay();
          const motion = game.runtime.overlays.drawerMotion;
          game.runtime.overlays.dismissOverlay();
          assert.equal(
            game.runtime.overlays.drawerMotion,
            motion,
            'repeated dismissal must not restart closing',
          );
          let previousOffset = game.runtime.home.homeScene.node.position.y;
          let previousOpacity = game.runtime.overlays.drawerVeil.opacity;
          for (let i = 0; i < 21; i++) {
            game.runtime.overlays.updateOverlays(1 / 60);
            const offset = game.runtime.home.homeScene.node.position.y;
            const sheet = game.runtime.overlays.drawerSheet;
            const visibleTop =
              sheet.position.y + sheet.getComponent(cc.UITransform).height / 2 - 30;
            const coveredHeight = Math.max(0, visibleTop + game.runtime.lifecycle.screenHeight / 2);
            assert.ok(
              offset <= coveredHeight + 1e-8,
              'the drawer must cover the exposed background',
            );
            assert.ok(offset <= previousOffset, 'the background must return monotonically');
            assert.equal(game.runtime.courtyard.courtyardNode.position.y, offset);
            assert.ok(game.runtime.overlays.drawerVeil.opacity < previousOpacity);
            previousOffset = offset;
            previousOpacity = game.runtime.overlays.drawerVeil.opacity;
            if (i === 8) {
              game.runtime.courtyard.refreshCourtyard();
              assert.ok(
                Math.abs(game.runtime.home.homeScene.node.position.y - offset) < 1e-8,
                'refreshing furnishings during dismissal must preserve animation progress',
              );
            }
          }
          game.runtime.overlays.updateOverlays(1 / 60);
          assert.equal(game.runtime.home.homeScene.node.position.y, 0);
          assert.equal(game.runtime.overlays.modal, null);
          assert.equal(game.runtime.overlays.drawerVeil, null);
          assert.equal(game.runtime.courtyard.courtyardPreview, undefined);
          assert.equal(game.runtime.home.homeTitle.node.active, true);
          assert.equal(JSON.stringify(game.runtime.profile.save), before);
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
  game.runtime.profile.save.coins = 2000;
  game.runtime.shop.shop();
  game.runtime.shop.purchaseFurnishing(item('leaf-awning'));
  game.runtime.shop.purchaseFurnishing(item('mushroom-awning'));
  game.runtime.shop.purchaseFurnishing(item('daisy-bed'));
  assert.equal(game.runtime.profile.save.coins, 1020);
  game.runtime.shop.purchaseFurnishing(item('leaf-awning'));
  assert.equal(game.runtime.profile.save.coins, 1020);
  assert.equal(game.runtime.profile.save.courtyard.equipped.entrance, 'leaf-awning');
  assert.equal(game.runtime.profile.save.courtyard.equipped.garden, 'daisy-bed');
  game.runtime.shop.clearFurnishing('entrance');
  assert.equal(game.runtime.profile.save.courtyard.equipped.entrance, '');
  assert.equal(game.runtime.profile.save.courtyard.equipped.garden, 'daisy-bed');
  game.runtime.shop.purchaseFurnishing(item('leaf-awning'));
  assert.equal(game.runtime.profile.save.coins, 1020);
  game.runtime.overlays.closeModal();
  assert.equal(
    game.runtime.courtyard.courtyardNode.children.filter((node) =>
      node.name.startsWith('Furnishing '),
    ).length,
    2,
  );
  game.onDestroy();
});

test('insufficient funds preserve wallet and preview; resource arrival fills open thumbnails', () => {
  const game = makeGame();
  game.runtime.shop.shop();
  const before = JSON.stringify(game.runtime.profile.save),
    modal = game.runtime.overlays.modal;
  game.runtime.shop.purchaseFurnishing(item('leaf-awning'));
  assert.equal(JSON.stringify(game.runtime.profile.save), before);
  assert.equal(game.runtime.overlays.modal, modal);
  const texture = new Texture2D();
  texture.width = 1024;
  texture.height = 768;
  resourceLoads.get('home/furnishings/texture')(null, texture);
  assert.equal(game.runtime.assets.furnishingFrames.size, 12);
  const selected = game.runtime.courtyard.courtyardNode.children
    .find((node) => node.name === 'Furnishing leaf-awning')
    .getComponent(cc.Sprite);
  assert.equal(selected.spriteFrame, game.runtime.assets.furnishingFrames.get('leaf-awning'));
  const samples = [];
  const walk = (node) => {
    if (node.name.startsWith('Furnishing thumbnail')) samples.push(node);
    node.children.forEach(walk);
  };
  walk(game.runtime.overlays.modal);
  assert.equal(samples.length, 3);
  assert.ok(samples.every((node) => node.getComponent(cc.Sprite).spriteFrame));
  game.onDestroy();
  assert.equal(texture.refs, 0);
});

test('cloud purchase has no optimistic spend and ignores additional taps while pending', async () => {
  const game = makeGame();
  game.runtime.profile.save.coins = 500;
  game.runtime.cloud.cloudMode = true;
  game.runtime.cloud.cloudReady = true;
  game.runtime.cloud.cloudHighest = 0;
  game.runtime.cloud.cloudReachedAt = 0;
  let resolve,
    requests = 0;
  game.runtime.cloud.cloud = {
    mutate: () => {
      requests++;
      return new Promise((done) => {
        resolve = done;
      });
    },
  };
  game.runtime.shop.shop();
  const before = JSON.stringify(game.runtime.profile.save);
  game.runtime.shop.purchaseFurnishing(item('leaf-awning'));
  game.runtime.shop.purchaseFurnishing(item('leaf-awning'));
  assert.equal(game.runtime.cloudStatus.cloudStatus, null);
  assert.equal(game.runtime.overlays.drawerSubtitle.node.active, true);
  assert.equal(requests, 1);
  assert.equal(JSON.stringify(game.runtime.profile.save), before);
  game.runtime.overlays.closeModal();
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
  assert.equal(game.runtime.profile.save.coins, 320);
  assert.equal(game.runtime.profile.save.courtyard.equipped.entrance, 'leaf-awning');
  assert.equal(
    game.runtime.overlays.modal,
    null,
    'late completion must not reopen a dismissed drawer',
  );
  game.onDestroy();
});

test('homepage life survives decoration refresh and pauses behind overlays or in background', () => {
  const game = makeGame();
  const life = game.runtime.courtyard.courtyardLife;
  for (let i = 0; i < 180; i++) game.update(1 / 60);
  assert.notEqual(life.action, 'inside');
  const before = { x: life.x, y: life.y, elapsed: life.elapsed };
  game.runtime.shop.shop('living', 'leaf-bed');
  for (let i = 0; i < 100; i++) game.update(1 / 60);
  assert.deepEqual({ x: life.x, y: life.y, elapsed: life.elapsed }, before);
  assert.equal(life.chair, false, 'unbought preview does not unlock an interaction');
  game.runtime.overlays.closeModal();
  game.runtime.home.showHome();
  assert.equal(game.runtime.courtyard.courtyardLife, life);
  assert.deepEqual({ x: life.x, y: life.y, elapsed: life.elapsed }, before);
  game.runtime.lifecycle.paused = true;
  game.update(0.05);
  assert.equal(life.elapsed, before.elapsed);
  game.runtime.lifecycle.paused = false;
  game.update(0.05);
  assert.ok(life.elapsed > before.elapsed);
  game.onDestroy();
});

test('Lili and furnishing effects stay below home controls and pause together', () => {
  const game = makeGame();
  const { courtyard, profile, shop, overlays } = game.runtime;
  profile.save.completed = Array.from({ length: 8 }, (_, index) => index);
  profile.save.courtyard.equipped.garden = 'lantern-garden';
  courtyard.refreshCourtyard();
  assert.equal(courtyard.courtyardResident.root.parent.parent, courtyard.courtyardNode);
  const life = courtyard.courtyardLife;
  for (let i = 0; i < 120; i++) game.update(1 / 60);
  const anchor = () => [life.x, life.y, life.elapsed];
  const before = anchor();
  shop.shop('living', 'dew-pond');
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  assert.deepEqual(anchor(), before);
  assert.equal(courtyard.courtyardResident.root.active, false);
  overlays.closeModal();
  for (let i = 0; i < 720; i++) game.update(1 / 60);
  const outside = courtyard.courtyardResident.root.parent;
  assert.equal(outside.name, 'Residents outside');
  assert.deepEqual(outside.children, [courtyard.courtyardResident.root]);
  assert.ok(courtyard.courtyardResident.root.active);
  game.update(1 / 60);
  game.onDestroy();
});

test('a hungry Lili keeps walking with her shadow on the same ground anchor', () => {
  const game = makeGame();
  const { courtyard, profile } = game.runtime;
  profile.save.pets.residents[0].fedUntil = 0;
  const r = courtyard.courtyardLife;
  r.x = 450;
  r.y = 870;
  r.move('walk', 550, 870);
  const view = courtyard.courtyardResident;
  view.render(r, false);
  const body = view.root.children.find((n) => n.name === 'Resident pose');
  const shadow = view.root.children.find((n) => n.name === 'Resident ground shadow');
  assert.ok(view.root.getComponent(cc.UITransform).height / view.scale > 120);
  const thorax = body.children.find((node) => node.name === 'Thorax joint');
  const leg = thorax.children.find((node) => node.name === 'Leg 1');
  const knee = leg.children.find((node) => node.name === 'Leg 1 hinge');
  const before = view.root.position.x;
  const firstKnee = knee.angle;
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  assert.ok(view.root.position.x > before);
  assert.notEqual(knee.angle, firstKnee);
  assert.ok(Math.abs(view.root.position.y + shadow.position.y - (768 - r.y) * view.scale) < 1e-8);
  game.onDestroy();
});

test('outdoor activities show the correct prop or speech and hide it during other activities', () => {
  const game = makeGame();
  const { courtyard } = game.runtime;
  resourceLoads.get('home/lili')(null, new cc.sp.SkeletonData());
  const life = courtyard.courtyardLife;
  life.x = 500;
  life.y = 880;
  const view = courtyard.courtyardResident;
  const rig = view.root.children.find((node) => node.name === 'Resident pose');
  const skeleton = rig.children[0].getComponent(cc.sp.Skeleton);
  const layer = courtyard.courtyardNode.children.find(
    (node) => node.name === 'Resident interactions',
  );
  const show = (activity) => {
    life.activity = activity;
    life.stay('rest', 6.2);
    life.elapsed = 1.3;
    game.update(1 / 60);
  };
  for (const [activity, prop] of [
    ['read', 'Resident book'],
    ['news', 'Resident newspaper'],
    ['game', 'Resident phone'],
  ]) {
    show(activity);
    assert.equal(skeleton.animation, activity);
    assert.equal(rig.children.find((node) => node.name === prop).active, true);
  }
  life.plan = { activity: 'talk', x: life.x, y: life.y, facing: 1, speech: '主人，帮我分享下吧' };
  show('talk');
  const bubble = layer.children.find((node) => node.name === 'Resident speech');
  assert.equal(
    bubble.children.find((node) => node.name === 'Text').getComponent(cc.Label).string,
    life.plan.speech,
  );
  assert.equal(bubble.active, true);
  view.root.emit('end');
  game.update(1 / 60);
  assert.equal(bubble.active, false);
  assert.equal(rig.children.find((node) => node.name === 'Resident phone').active, false);
  assert.equal(life.elapsed, 1.3 + 1 / 60);
  game.onDestroy();
});

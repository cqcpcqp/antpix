import test from 'node:test';
import assert from 'node:assert/strict';
import headless from '../scripts/headless-game.cjs';
const { load, cc, Texture2D, resourceLoads } = headless;
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
const { FURNISHINGS } = load(process.cwd() + '/assets/scripts/domain/profile/profile.ts');
const create = () => {
  const game = new PixelGarden();
  game.onLoad();
  return game;
};
const flush = () => new Promise((resolve) => setImmediate(resolve));
const strings = (node) =>
  node.components
    .filter((c) => c instanceof cc.Label)
    .map((c) => c.string)
    .concat(node.children.filter((child) => child.active).flatMap(strings));

function hitAreas(node, x = 0, y = 0, scale = 1, result = []) {
  if (!node.active) return result;
  x += node.position.x * scale;
  y += node.position.y * scale;
  scale *= node.scale.x;
  const bounds = node.getComponent(cc.UITransform);
  if (node.events.end && !['Drawer sheet', 'Drawer mask'].includes(node.name))
    result.push({ name: node.name, x, y, w: bounds.width * scale, h: bounds.height * scale });
  for (const child of node.children) hitAreas(child, x, y, scale, result);
  return result;
}

test('drawer controls have separate 44px hit areas and stay on screen at phone sizes', () => {
  const original = cc.view.getFrameSize;
  try {
    for (const frame of [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 390, height: 844 },
    ]) {
      cc.view.getFrameSize = () => frame;
      const game = create();
      for (const open of [
        () => game.runtime.shop.shop(),
        () => game.runtime.shop.nestShop(),
        () => game.runtime.settings.settings(),
        () => {
          game.runtime.session.startLevel(0);
          game.runtime.settings.settings();
        },
      ]) {
        game.runtime.overlays.closeModal();
        open();
        game.runtime.cloud.cloudBusy = true;
        game.runtime.cloud.cloudMessage = '连接未完成，点击重试';
        game.runtime.cloudStatus.refreshCloudStatus();
        game.runtime.overlays.updateOverlays(0.5);
        const areas = hitAreas(game.runtime.overlays.modal),
          scale = frame.width / game.runtime.lifecycle.screenWidth;
        for (let i = 0; i < areas.length; i++) {
          const a = areas[i];
          assert.ok(a.h * scale >= 44 - 1e-6, `${a.name} must be easy to touch`);
          assert.ok(
            Math.abs(a.y) + a.h / 2 <= game.runtime.lifecycle.screenHeight / 2,
            `${a.name} must remain visible`,
          );
          for (const b of areas.slice(i + 1))
            assert.ok(
              Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2,
              `${frame.width}: ${a.name} overlaps ${b.name}`,
            );
        }
        assert.equal(game.runtime.overlays.drawerSubtitle.node.active, false);
        game.runtime.cloud.cloudBusy = false;
        game.runtime.cloud.cloudMessage = '';
      }
      game.onDestroy();
    }
  } finally {
    cc.view.getFrameSize = original;
  }
});

test('late purchase refreshes a reopened shop without changing its selection or position', async () => {
  const game = create();
  game.runtime.profile.save.coins = 1000;
  game.runtime.cloud.cloudMode = true;
  game.runtime.cloud.cloudReady = true;
  game.runtime.cloud.cloudHighest = 0;
  game.runtime.cloud.cloudReachedAt = 0;
  let resolve;
  game.runtime.cloud.cloud = {
    mutate: () =>
      new Promise((done) => {
        resolve = done;
      }),
  };
  game.runtime.shop.shop('entrance', 'leaf-awning');
  game.runtime.shop.purchaseFurnishing(FURNISHINGS.find((item) => item.id === 'leaf-awning'));
  game.runtime.overlays.closeModal();
  game.runtime.shop.shop('garden', 'daisy-bed');
  game.runtime.overlays.updateOverlays(0.5);
  const sheet = game.runtime.overlays.drawerSheet,
    y = sheet.position.y;
  const profile = JSON.parse(JSON.stringify(game.runtime.profile.save));
  profile.coins = 820;
  profile.courtyard.owned = ['leaf-awning'];
  profile.courtyard.equipped.entrance = 'leaf-awning';
  resolve({
    profile,
    highest: 0,
    reachedAt: 0,
    serverTime: Date.now(),
    output: { purchase: 'purchased' },
  });
  await flush();
  assert.equal(game.runtime.overlays.drawerSheet, sheet);
  assert.equal(sheet.position.y, y);
  assert.equal(game.runtime.overlays.drawerMotion, null);
  assert.equal(game.runtime.courtyard.courtyardPreview.id, 'daisy-bed');
  assert.match(game.runtime.overlays.drawerSubtitle.string, /820/);
  game.runtime.shop.shop('entrance', 'leaf-awning');
  assert.ok(strings(game.runtime.shop.courtyardShopContent).includes('已布置在庭院'));
  assert.ok(!strings(game.runtime.shop.courtyardShopContent).includes('购买并布置 · 180 金币'));
  game.onDestroy();
});

test('nest shop updates in place, ignores equipped items and returns to the selected decoration', () => {
  const game = create();
  game.runtime.profile.save.coins = 1000;
  game.runtime.shop.shop('garden', 'daisy-bed');
  game.runtime.shop.nestShop();
  game.runtime.overlays.updateOverlays(0.5);
  const sheet = game.runtime.overlays.drawerSheet,
    y = sheet.position.y;
  game.runtime.shop.nestShopContent.children.find((n) => n.name === '使用中').emit('end');
  assert.equal(game.runtime.notices.notification, null);
  assert.equal(game.runtime.overlays.drawerSheet, sheet);
  game.runtime.shop.nestShopContent.children.find((n) => n.name === '兑换').emit('end');
  assert.equal(game.runtime.profile.save.coins, 900);
  assert.equal(game.runtime.profile.save.nest, 'moss');
  assert.equal(game.runtime.overlays.drawerSheet, sheet);
  assert.equal(sheet.position.y, y);
  assert.equal(game.runtime.overlays.drawerMotion, null);
  const texture = new Texture2D();
  texture.width = 416;
  texture.height = 60;
  resourceLoads.get('trays/wood-hole/texture')(null, texture);
  const samples = game.runtime.shop.nestShopContent.children.filter(
    (n) => n.name === 'Wooden nest sample',
  );
  assert.equal(samples.length, 4);
  assert.ok(samples.every((n) => n.getComponent(cc.Sprite).spriteFrame));
  assert.equal(game.runtime.overlays.drawerSheet, sheet);
  game.runtime.shop.nestShopContent.children.find((n) => n.name === '返回装修').emit('end');
  assert.equal(game.runtime.courtyard.courtyardPreview.id, 'daisy-bed');
  game.onDestroy();
});

test('canceling a level switch preserves the page being browsed', () => {
  const game = create();
  game.runtime.profile.save.unlocked = 19;
  game.runtime.session.startLevel(0);
  game.runtime.session.model.place(game.runtime.session.model.visibleQueue[0].jar.id);
  game.runtime.home.showHome();
  game.runtime.album.levelPicker(1);
  game.runtime.overlays.modal.children.find((n) => n.name.startsWith('第 11 关')).emit('end');
  game.runtime.overlays.modal.children.find((n) => n.name === '选择关卡').emit('end');
  assert.ok(strings(game.runtime.overlays.modal).some((s) => s.startsWith('第 2 / 10 页')));
  game.onDestroy();
});

test('returning on a new day refreshes rewards while preserving an open drawer', () => {
  const game = create();
  game.runtime.cloud.rewardDay = () => '2026-10-12';
  game.runtime.profile.save.daily = '2026-10-12';
  game.runtime.home.showHome();
  assert.ok(!strings(game.runtime.home.home).some((s) => s.startsWith('领取奖励')));
  game.runtime.shop.shop('garden', 'daisy-bed');
  game.runtime.overlays.updateOverlays(0.5);
  const sheet = game.runtime.overlays.drawerSheet;
  game.runtime.lifecycle.hideHandler();
  game.runtime.cloud.rewardDay = () => '2026-10-13';
  game.runtime.lifecycle.showHandler();
  assert.ok(
    strings(game.runtime.home.home).some((s) => s.includes('领取奖励') && s.includes('30')),
  );
  assert.equal(game.runtime.overlays.drawerSheet, sheet);
  assert.equal(game.runtime.courtyard.courtyardPreview.id, 'daisy-bed');
  game.onDestroy();
});

test('each selected decoration stays above the drawer on short and tall phones', () => {
  const original = cc.view.getFrameSize;
  try {
    for (const frame of [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 390, height: 844 },
    ]) {
      cc.view.getFrameSize = () => frame;
      const game = create();
      for (const item of FURNISHINGS) {
        game.runtime.shop.shop(item.slot, item.id);
        game.runtime.overlays.updateOverlays(0.5);
        const node = game.runtime.courtyard.courtyardNode.children.find(
          (n) => n.name === 'Furnishing ' + item.id,
        );
        const bottom =
          game.runtime.courtyard.courtyardNode.position.y +
          node.position.y -
          node.getComponent(cc.UITransform).height / 2;
        const top =
          game.runtime.overlays.drawerSheet.position.y +
          game.runtime.overlays.drawerSheet.getComponent(cc.UITransform).height / 2 -
          30;
        assert.ok(
          bottom >= top + 27.9,
          `${frame.width}: ${item.id} must not hide behind the drawer`,
        );
      }
      game.onDestroy();
    }
  } finally {
    cc.view.getFrameSize = original;
  }
});

test('home retry replaces the reward action instead of overlapping it', () => {
  const original = cc.view.getFrameSize;
  cc.view.getFrameSize = () => ({ width: 320, height: 568 });
  try {
    const game = create();
    game.runtime.cloud.cloudMode = true;
    game.runtime.cloud.cloudReady = true;
    game.runtime.home.showHome();
    assert.ok(game.runtime.home.homeRewardButton.active);
    game.runtime.cloud.cloudBusy = true;
    game.runtime.cloud.cloudMessage = '连接未完成，点击重试';
    game.runtime.cloudStatus.refreshCloudStatus();
    assert.equal(game.runtime.home.homeRewardButton.active, false);
    const retry = hitAreas(game.runtime.home.home).find((area) => area.name === 'Cloud status');
    for (const area of hitAreas(game.runtime.home.home).filter(
      (area) => area.name !== 'Cloud status',
    ))
      assert.ok(
        Math.abs(retry.x - area.x) >= (retry.w + area.w) / 2 ||
          Math.abs(retry.y - area.y) >= (retry.h + area.h) / 2,
      );
    game.runtime.cloud.cloudBusy = false;
    game.runtime.cloud.cloudMessage = '';
    game.runtime.cloudStatus.refreshCloudStatus();
    assert.ok(game.runtime.home.homeRewardButton.active);
    game.onDestroy();
  } finally {
    cc.view.getFrameSize = original;
  }
});

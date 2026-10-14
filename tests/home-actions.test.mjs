import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { load, cc, Texture2D, resourceLoads } = require('../scripts/headless-game.cjs');
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');

test('home actions leave separate touch targets for rewards and bottom navigation', () => {
  const originalFrame = cc.view.getFrameSize;
  try {
    for (const [width, height] of [
      [320, 568],
      [375, 750],
      [390, 844],
      [768, 1024],
    ]) {
      cc.view.getFrameSize = () => ({ width, height });
      const game = new PixelGarden();
      game.onLoad();
      game.runtime.profile.save.daily = '';
      game.runtime.home.showHome();
      const home = game.runtime.home;
      const play = home.home.children.find((n) => n.name === '开始游戏');
      const reward = home.homeRewardButton;
      const navigation = home.home.children.filter((n) =>
        ['关卡', '装饰', '排行榜'].includes(n.name),
      );
      const halfHeight = (n) => n.getComponent(cc.UITransform).height / 2;
      assert.ok(play.position.y - halfHeight(play) > reward.position.y + halfHeight(reward));
      for (const node of navigation) {
        assert.ok(reward.position.y - halfHeight(reward) > node.position.y + halfHeight(node));
        assert.ok(
          node.position.y - halfHeight(node) >= -game.runtime.lifecycle.screenHeight / 2 + 60,
        );
        assert.ok(node.getComponent(cc.UITransform).width >= game.runtime.lifecycle.touchSize);
        node.emit('start');
        node.emit('cancel');
        assert.equal(node.position.y, -game.runtime.lifecycle.screenHeight / 2 + 145);
      }
      game.onDestroy();
    }
  } finally {
    cc.view.getFrameSize = originalFrame;
  }
});

test('illustrated start/resume lettering loads asynchronously and yields to cloud status', () => {
  const game = new PixelGarden();
  game.onLoad();
  const { home, assets, cloud, cloudStatus } = game.runtime;
  const textures = [];
  for (const name of ['play-start', 'play-resume']) {
    const texture = new Texture2D();
    texture.width = 495;
    texture.height = 132;
    resourceLoads.get(`home/${name}/texture`)(null, texture);
    textures.push(texture);
  }
  assert.equal(home.homePlayArtwork.name, 'Home asset play-start');
  assert.equal(
    home.homePlayArtwork.getComponent(cc.Sprite).spriteFrame,
    assets.homeActionFrames.get('play-start'),
  );
  cloud.cloudMode = true;
  cloud.cloudReady = false;
  cloud.cloudBusy = true;
  cloud.cloudMessage = '正在同步进度…';
  cloudStatus.refreshCloudStatus();
  assert.equal(home.homePlayArtwork.active, false);
  assert.equal(cloudStatus.cloudStatus.position.y, home.homePlayY);
  home.home.children.find((n) => n.name === '开始游戏').emit('end');
  assert.ok(home.home, 'syncing cannot start a level');
  cloud.cloudMode = false;
  cloud.cloudBusy = false;
  cloud.cloudMessage = '';
  cloudStatus.refreshCloudStatus();
  assert.equal(home.homePlayArtwork.active, true);
  home.home.children.find((n) => n.name === '开始游戏').emit('end');
  home.showHome();
  assert.equal(home.homePlayArtwork.name, 'Home asset play-resume');
  assert.equal(
    home.homePlayArtwork.getComponent(cc.Sprite).spriteFrame,
    assets.homeActionFrames.get('play-resume'),
  );
  game.onDestroy();
  assert.ok(textures.every((texture) => texture.refs === 0));
});

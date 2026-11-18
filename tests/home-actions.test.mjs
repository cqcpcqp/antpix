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
      const settings = home.home.children.find((n) => n.name === 'Settings menu');
      const recommend = home.home.children.find((n) => n.name === 'Recommend game');
      const favorite = home.home.children.find((n) => n.name === 'Favorite game');
      const circle = home.home.children.find((n) => n.name === 'Game club');
      assert.equal(circle.position.x, favorite.position.x);
      assert.ok(
        favorite.position.y - favorite.getComponent(cc.UITransform).height / 2 >
          circle.position.y + circle.getComponent(cc.UITransform).height / 2,
      );
      assert.equal(
        recommend.children.some((n) => n.getComponent(cc.Label)),
        false,
      );
      assert.equal(recommend.position.x, settings.position.x);
      assert.ok(
        settings.position.y - settings.getComponent(cc.UITransform).height / 2 >
          recommend.position.y + recommend.getComponent(cc.UITransform).height / 2,
      );
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

test('home game circle entry opens its page repeatedly and leaves gameplay without an entry', async () => {
  const game = new PixelGarden();
  game.onLoad();
  let opens = 0;
  game.runtime.gameClub.show = async () => {
    opens++;
    return 'shown';
  };
  const click = () =>
    game.runtime.home.home.children.find((n) => n.name === 'Game club').emit('end');
  try {
    click();
    await Promise.resolve();
    game.runtime.home.showHome();
    click();
    await Promise.resolve();
    assert.equal(opens, 2);
    game.runtime.home.hideHome();
    assert.equal(game.runtime.home.home, null);
    assert.equal(
      game.runtime.lifecycle.gameRoot.children.some((n) => n.name === 'Game club'),
      false,
    );
  } finally {
    game.onDestroy();
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
  assert.equal(cloudStatus.cloudStatus, null, 'initial login uses the unified startup');
  assert.ok(game.runtime.startupView.root);
  home.home.children.find((n) => n.name === '开始游戏').emit('end');
  assert.ok(home.home, 'syncing cannot start a level');
  cloud.cloudMode = false;
  cloud.cloudBusy = false;
  cloud.cloudMessage = '';
  cloudStatus.refreshCloudStatus();
  assert.equal(home.homePlayArtwork.active, true);
  home.home.children.find((n) => n.name === '开始游戏').emit('end');
  assert.equal(home.home, null, 'starting gameplay removes the home recommendation entry');
  assert.equal(
    game.runtime.lifecycle.gameRoot.children.some((n) => n.name === 'Recommend game'),
    false,
  );
  home.showHome();
  assert.equal(home.homePlayArtwork.name, 'Home asset play-resume');
  assert.equal(
    home.homePlayArtwork.getComponent(cc.Sprite).spriteFrame,
    assets.homeActionFrames.get('play-resume'),
  );
  game.onDestroy();
  assert.ok(textures.every((texture) => texture.refs === 0));
});

test('clicking recommendation hides the icon immediately and across home rebuilds and restarts', async () => {
  const originalStorage = cc.sys.localStorage;
  const stored = new Map();
  cc.sys.localStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  };
  let game;
  try {
    game = new PixelGarden();
    game.onLoad();
    const { home, recommendation } = game.runtime;
    let requests = 0;
    recommendation.show = async () => {
      requests++;
      throw new Error('unavailable');
    };
    const icon = home.home.children.find((n) => n.name === 'Recommend game');
    const favorite = home.home.children.find((n) => n.name === 'Favorite game');
    const circle = home.home.children.find((n) => n.name === 'Game club');
    const recommendationY = icon.position.y;
    const favoriteY = favorite.position.y;
    icon.emit('end');
    assert.equal(icon.active, false, 'a click hides the entry before the SDK settles');
    assert.equal(favorite.position.y, recommendationY, 'favorite fills the empty row immediately');
    assert.equal(circle.position.y, favoriteY, 'game circle follows favorite upward');
    icon.emit('end');
    assert.equal(requests, 1, 'repeated taps cannot reopen the component');
    await Promise.resolve();
    home.showHome();
    assert.equal(
      home.home.children.find((n) => n.name === 'Favorite game').position.y,
      recommendationY,
    );
    assert.equal(home.home.children.find((n) => n.name === 'Game club').position.y, favoriteY);
    assert.equal(
      home.home.children.some((n) => n.name === 'Recommend game'),
      false,
    );
    game.onDestroy();
    game = new PixelGarden();
    game.onLoad();
    assert.equal(
      game.runtime.home.home.children.find((n) => n.name === 'Favorite game').position.y,
      recommendationY,
    );
    assert.equal(
      game.runtime.home.home.children.find((n) => n.name === 'Game club').position.y,
      favoriteY,
    );
    assert.equal(game.runtime.profile.recommendationClicked, true);
    assert.equal(
      game.runtime.home.home.children.some((n) => n.name === 'Recommend game'),
      false,
    );
  } finally {
    game?.onDestroy();
    cc.sys.localStorage = originalStorage;
  }
});

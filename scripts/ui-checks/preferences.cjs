module.exports = function checkPreferences({ cc, Label, PixelGarden, game, assert }) {
  // Reward entry is conditional, claims once, and disappears immediately after claiming.
  game.runtime.home.showHome();
  assert.ok(!game.runtime.home.home.children.some((n) => n.name.startsWith('领取奖励')));
  game.runtime.profile.save.daily = '';
  game.runtime.home.showHome();
  const claim = game.runtime.home.home.children.find((n) => n.name.startsWith('领取奖励'));
  assert.ok(claim);
  const beforeClaim = game.runtime.profile.save.coins;
  claim.emit('end');
  assert.equal(game.runtime.profile.save.coins, beforeClaim + 30);
  assert.ok(!game.runtime.home.home.children.some((n) => n.name.startsWith('领取奖励')));
  claim.emit('end');
  assert.equal(
    game.runtime.profile.save.coins,
    beforeClaim + 30,
    'stale double tap cannot grant rewards twice',
  );
  game.runtime.profile.save.completed.push(3);
  game.runtime.home.showHome();
  assert.ok(game.runtime.home.home.children.some((n) => n.name === '领取奖励  +100 金币'));
  const homeCopy = game.runtime.home.home.children.flatMap((n) =>
    n.components.filter((c) => c instanceof Label).map((c) => c.string),
  );
  assert.ok(
    !homeCopy.some(
      (s) =>
        s.includes('已收集') ||
        s.includes('小 窝 生 活') ||
        s.includes('归处') ||
        s.includes('进度保存在'),
    ),
  );
  console.log('Minimal home copy and conditional, idempotent reward claim passed.');

  // Music waits for interaction, fades in, respects separate toggles and app lifecycle.
  const audioGame = new PixelGarden();
  audioGame.onLoad();
  audioGame.runtime.audio.music.clip = {};
  audioGame.runtime.audio.syncMusic();
  assert.equal(audioGame.runtime.audio.music.playing, false);
  audioGame.runtime.audio.play('tap');
  assert.equal(audioGame.runtime.audio.music.playing, true);
  for (let i = 0; i < 30; i++) audioGame.update(0.05);
  assert.equal(audioGame.runtime.audio.music.volume, 0.22);
  audioGame.runtime.lifecycle.hideHandler();
  assert.equal(audioGame.runtime.audio.music.playing, false);
  audioGame.runtime.lifecycle.showHandler();
  assert.equal(audioGame.runtime.audio.music.playing, true);
  audioGame.runtime.profile.save.music = false;
  audioGame.runtime.audio.syncMusic();
  assert.equal(audioGame.runtime.audio.music.playing, false);
  audioGame.runtime.lifecycle.hideHandler();
  audioGame.runtime.lifecycle.showHandler();
  assert.equal(audioGame.runtime.audio.music.playing, false);
  audioGame.runtime.profile.save.sound = false;
  audioGame.runtime.profile.save.music = true;
  audioGame.runtime.audio.play('tap');
  assert.equal(audioGame.runtime.audio.music.playing, true);
  audioGame.onDestroy();
  assert.equal(audioGame.runtime.audio.music.playing, false);
  console.log(
    'Music gesture gate, fade-in, independent mute, background pause and teardown passed.',
  );

  // Loaded custom font updates existing screens and is reused by later labels.
  let fontCallback;
  const originalLoad = cc.resources.load;
  cc.resources.load = (path, type, callback) => {
    if (path === 'fonts/ant-nest-bitmap') fontCallback = callback;
  };
  const fontGame = new PixelGarden();
  fontGame.onLoad();
  const fontAsset = { name: 'Ant Nest Heavy' };
  fontCallback(null, fontAsset);
  function checkFont(node) {
    for (const c of node.components)
      if (c instanceof Label) {
        assert.equal(c.font, fontAsset);
        assert.equal(c.isBold, false);
      }
    for (const child of node.children) checkFont(child);
  }
  checkFont(fontGame.runtime.home.home);
  fontGame.runtime.session.startLevel(0);
  assert.equal(fontGame.runtime.layout.levelLabel.color.r, 98);
  assert.equal(fontGame.runtime.layout.levelLabel.enableOutline, false);
  assert.ok(
    fontGame.runtime.layout.speedLabel.node.parent.getComponent(cc.UITransform).height >= 88,
  );
  assert.equal(fontGame.runtime.layout.queueCount.string, '已收集 0%');
  fontGame.runtime.session.model.collected = fontGame.runtime.session.model.level.pixels.length / 2;
  fontGame.update(0.016);
  assert.equal(fontGame.runtime.layout.queueCount.string, '已收集 50%');
  for (const card of fontGame.runtime.queue.cardViews) {
    assert.equal(card.label.font, fontAsset);
    assert.equal(card.label.enableOutline, false);
    assert.equal(card.label.color.r, 73);
  }
  fontGame.runtime.settings.settings();
  checkFont(fontGame.runtime.overlays.drawerSheet);
  fontGame.onDestroy();
  cc.resources.load = originalLoad;
  console.log(
    'Heavy font updates existing and future screens; container counters remain dark on cream.',
  );
};

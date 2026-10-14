module.exports = function checkOverlays({ cc, Graphics, completeTestAd, game, assert }) {
  // Mobile overlays run on the home screen and pause gameplay while a drawer is open.
  game.runtime.session.startLevel(0);
  game.runtime.settings.settings();
  assert.equal(game.runtime.overlays.modal.name, 'Bottom drawer');
  const drawer = game.runtime.overlays.drawerSheet,
    elapsed = game.runtime.session.elapsed;
  for (let i = 0; i < 8; i++) game.update(0.05);
  assert.equal(
    drawer.position.y - drawer.getComponent(cc.UITransform).height / 2,
    -game.runtime.lifecycle.screenHeight / 2,
  );
  assert.equal(game.runtime.session.elapsed, elapsed);
  game.runtime.notices.notify('奖励已收下', '30 金币已经放进你的小窝', 'success');
  assert.equal(game.runtime.notices.notification.node.name, 'Notification');
  game.runtime.lifecycle.hideHandler();
  game.update(1);
  assert.equal(game.runtime.notices.notification.elapsed, 0);
  game.runtime.lifecycle.showHandler();
  game.runtime.overlays.modal.children.find((n) => n.name === 'Drawer mask').emit('end');
  assert.equal(game.runtime.overlays.drawerMotion.closing, true);
  for (let i = 0; i < 8; i++) game.update(0.05);
  assert.equal(game.runtime.overlays.modal, null);
  assert.equal(game.runtime.overlays.drawerSheet, null);
  assert.ok(game.runtime.notices.notification, 'closing drawer must not remove notification');
  game.runtime.session.startLevel(0);
  game.runtime.settings.settings();
  assert.ok(game.runtime.overlays.drawerSheet.children.some((n) => n.name === '返回主页'));
  assert.ok(game.runtime.overlays.drawerSheet.children.some((n) => n.name === '重新开始'));
  assert.ok(game.runtime.overlays.drawerSheet.children.some((n) => n.name === '继续游戏'));
  game.runtime.overlays.drawerSheet.children.find((n) => n.name === '继续游戏').emit('end');
  assert.equal(
    game.runtime.boosts.rewardAdDemo,
    null,
    'resuming from settings must not request an ad',
  );
  for (let i = 0; i < 8; i++) game.update(0.05);
  assert.equal(
    game.runtime.overlays.modal,
    null,
    'continue dismisses the drawer just like its close button',
  );
  game.runtime.session.startLevel(0);
  game.runtime.settings.showBlocked();
  assert.ok(
    game.runtime.overlays.modal.children.some((n) => n.name === '重新开始') &&
      game.runtime.overlays.modal.children.some((n) => n.name === '解锁槽位'),
  );
  assert.ok(!game.runtime.overlays.modal.children.some((n) => n.name === '查看画册'));
  game.runtime.overlays.modal.children.find((n) => n.name === '解锁槽位').emit('end');
  assert.equal(game.runtime.overlays.modal.name, 'Dialog');
  completeTestAd();
  assert.equal(
    game.runtime.overlays.modal,
    null,
    'blocked expansion should close after returning from sharing',
  );
  assert.equal(game.runtime.session.model.slots.length, 6);
  game.runtime.home.showHome();
  for (let i = 0; i < 72; i++) game.update(0.05);
  assert.equal(game.runtime.notices.notification, null);
  game.runtime.shop.nestShop();
  for (let i = 0; i < 8; i++) game.update(0.05);
  assert.equal(
    game.runtime.overlays.drawerSheet.position.y -
      game.runtime.overlays.drawerSheet.getComponent(cc.UITransform).height / 2,
    -game.runtime.lifecycle.screenHeight / 2,
  );
  game.runtime.overlays.closeModal();
  game.runtime.session.startLevel(0);
  game.runtime.settings.restart();
  assert.ok(
    game.runtime.overlays.modal
      .getComponent(Graphics)
      .commands.some((c) => c.kind === 'polygon' && c.p.length > 100),
    'confirmation uses original organic modal contour',
  );
  game.runtime.overlays.modal.children.find((n) => n.name === '继续游戏').emit('end');
  assert.equal(game.runtime.overlays.modal, null);
  game.runtime.home.showHome();
  game.runtime.social.rewards();
  const rewardAction = game.runtime.overlays.modal.children.find((n) => n.name === '领取全部');
  assert.ok(rewardAction);
  const coinsBefore = game.runtime.profile.save.coins;
  rewardAction.emit('end');
  assert.ok(game.runtime.profile.save.coins > coinsBefore);
  assert.equal(game.runtime.overlays.modal, null);
  assert.ok(game.runtime.notices.notification);
  console.log(
    'Drawer entry/exit, mask dismissal, gameplay pause, notification lifetime and reward feedback passed.',
  );
  // Commerce feedback keeps the drawer and gameplay context intact.
  game.runtime.session.startLevel(0);
  game.runtime.profile.save.coins = 0;
  game.runtime.shop.nestShop();
  for (let i = 0; i < 8; i++) game.update(0.05);
  const shopDrawer = game.runtime.overlays.modal;
  game.runtime.shop.nestShopContent.children.find((n) => n.name === '兑换').emit('end');
  assert.equal(game.runtime.profile.save.coins, 0);
  assert.equal(game.runtime.overlays.modal, shopDrawer);
  assert.ok(game.runtime.notices.notification);
  assert.equal(game.runtime.home.home, null);
  game.runtime.notices.notification.node.children
    .find((n) => n.name === 'Dismiss notification')
    .emit('end');
  assert.equal(game.runtime.notices.notification, null);
  game.runtime.overlays.drawerSheet.children
    .find((n) => n.name === 'Drawer handle')
    .emit('end', { getUIStartLocation: () => ({ y: 100 }), getUILocation: () => ({ y: 40 }) });
  for (let i = 0; i < 8; i++) game.update(0.05);
  assert.equal(game.runtime.overlays.modal, null);
  console.log(
    'Insufficient funds stay in drawer; notification close and downward handle dismissal passed.',
  );
};

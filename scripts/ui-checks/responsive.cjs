module.exports = function checkResponsive({
  cc,
  Graphics,
  Label,
  Sprite,
  Texture2D,
  resourceLoads,
  PixelGarden,
  assert,
}) {
  // Tall phones and wider screens fill the viewport without cropping the game board.
  for (const frame of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
  ]) {
    cc.view.getFrameSize = () => frame;
    const responsive = new PixelGarden();
    responsive.onLoad();
    assert.ok(
      Math.abs(
        responsive.runtime.lifecycle.screenWidth / responsive.runtime.lifecycle.screenHeight -
          frame.width / frame.height,
      ) < 1e-9,
    );
    assert.ok(
      responsive.runtime.lifecycle.screenWidth >= 750 &&
        responsive.runtime.lifecycle.screenHeight >= 1500,
    );
    const background = responsive.runtime.home.home.children
      .find((n) => n.components.some((c) => c instanceof Graphics))
      .getComponent(Graphics).commands[0];
    assert.equal(background.p[2], responsive.runtime.lifecycle.screenWidth);
    assert.equal(background.p[3], responsive.runtime.lifecycle.screenHeight);
    assert.equal(
      responsive.runtime.home.home.children.find((n) => n.name === 'Settings menu').position.x,
      -286,
    );
    assert.ok(
      responsive.runtime.home.home.children.some(
        (n) =>
          n.position.x === 216 &&
          n.components.some((c) => c instanceof Label && c.string.startsWith('金币')),
      ),
    );
    assert.ok(
      !responsive.runtime.home.home.children.some((n) =>
        n.components.some((c) => c instanceof Label && c.string.includes('和小蚂蚁一起')),
      ),
    );
    const homeTexture = new Texture2D();
    homeTexture.width = 768;
    homeTexture.height = 1152;
    resourceLoads.get('home/garden/texture')(null, homeTexture);
    const landscape = responsive.runtime.home.homeScene;
    assert.equal(landscape.spriteFrame.texture, homeTexture);
    const crop = landscape.spriteFrame.rect;
    assert.ok(
      crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= 768 && crop.y + crop.height <= 1152,
    );
    assert.ok(Math.abs(crop.width / crop.height - frame.width / frame.height) < 1e-9);
    assert.equal(homeTexture.refs, 1);
    const titleTexture = new Texture2D();
    titleTexture.width = 1128;
    titleTexture.height = 376;
    resourceLoads.get('home/title/texture')(null, titleTexture);
    assert.equal(responsive.runtime.home.homeTitle.spriteFrame.texture, titleTexture);
    assert.equal(titleTexture.refs, 1);
    assert.ok(
      !responsive.runtime.home.home.children.some((n) =>
        n.components.some((c) => c instanceof Label && c.string === '生态蚂蚁窝'),
      ),
    );
    const titleBounds = responsive.runtime.home.homeTitle.node.getComponent(cc.UITransform);
    assert.equal(titleBounds.width / titleBounds.height, titleTexture.width / titleTexture.height);
    const headerBottom = 633 - 68 / 2,
      paintingTop = 315 + 155 / 2 + 4;
    assert.ok(
      responsive.runtime.home.homeTitle.node.position.y + titleBounds.height / 2 < headerBottom,
    );
    assert.ok(
      responsive.runtime.home.homeTitle.node.position.y - titleBounds.height / 2 > paintingTop,
    );
    const actionTextures = [];
    for (const name of ['play', 'album', 'shop', 'rank']) {
      const texture = new Texture2D();
      texture.width = name === 'play' ? 1260 : 304;
      texture.height = name === 'play' ? 200 : 272;
      actionTextures.push(texture);
      resourceLoads.get(`home/${name}/texture`)(null, texture);
      const find = (node) =>
        node.name === `Home asset ${name}` ? node : node.children.map(find).find(Boolean);
      assert.equal(
        find(responsive.runtime.home.home).getComponent(Sprite).spriteFrame.texture,
        texture,
      );
      assert.equal(texture.refs, 1);
    }
    responsive.runtime.home.showHome();
    assert.equal(responsive.runtime.home.homeScene.spriteFrame.texture, homeTexture);
    assert.equal(responsive.runtime.home.homeTitle.spriteFrame.texture, titleTexture);
    const controls = ['开始游戏', '关卡', '装修', '排行榜'];
    for (const name of controls) {
      const node = responsive.runtime.home.home.children.find((n) => n.name === name),
        bounds = node.getComponent(cc.UITransform);
      assert.ok(
        Math.abs(node.position.x) + bounds.width / 2 <=
          responsive.runtime.lifecycle.screenWidth / 2,
      );
      assert.ok(
        Math.abs(node.position.y) + bounds.height / 2 <=
          responsive.runtime.lifecycle.screenHeight / 2 - 60,
      );
      node.emit('start');
      assert.equal(node.scale.x, 0.96);
      node.emit('cancel');
      assert.equal(node.scale.x, 1);
      assert.equal(responsive.runtime.overlays.modal, null);
      assert.ok(responsive.runtime.home.home);
    }
    const play = responsive.runtime.home.home.children.find((n) => n.name === '开始游戏');
    assert.ok(play.children.some((n) => n.name === 'Level paper tag'));
    play.emit('end');
    assert.equal(responsive.runtime.home.home, null);
    assert.equal(responsive.runtime.lifecycle.gameRoot.active, true);
    responsive.runtime.home.showHome();
    const resume = responsive.runtime.home.home.children.find((n) => n.name === '继续游戏');
    assert.ok(resume);
    assert.equal(
      resume.children.find((n) => n.name === 'Home asset play').getComponent(Sprite).spriteFrame,
      responsive.runtime.assets.homeActionFrames.get('play'),
    );
    resume.emit('end');
    assert.equal(responsive.runtime.home.home, null);
    responsive.runtime.home.showHome();
    responsive.runtime.home.home.children.find((n) => n.name === '关卡').emit('end');
    assert.ok(responsive.runtime.overlays.modal);
    responsive.runtime.overlays.closeModal();
    responsive.runtime.home.home.children.find((n) => n.name === '排行榜').emit('end');
    assert.ok(responsive.runtime.overlays.modal);
    responsive.runtime.overlays.closeModal();
    responsive.runtime.shop.nestShop();
    for (let i = 0; i < 8; i++) responsive.update(0.05);
    assert.ok(
      Math.abs(
        responsive.runtime.overlays.drawerSheet.position.y -
          responsive.runtime.overlays.drawerSheet.getComponent(cc.UITransform).height / 2 +
          responsive.runtime.lifecycle.screenHeight / 2,
      ) < 1e-9,
    );
    assert.ok(!responsive.runtime.overlays.drawerSheet.children.some((n) => n.name === '完成'));
    const mask = responsive.runtime.overlays.modal.children
      .find((n) => n.name === 'Drawer mask')
      .getComponent(Graphics).commands[0];
    assert.equal(mask.p[2], responsive.runtime.lifecycle.screenWidth);
    assert.equal(mask.p[3], responsive.runtime.lifecycle.screenHeight);
    responsive.runtime.overlays.closeModal();
    responsive.onDestroy();
    assert.equal(homeTexture.refs, 0);
    assert.equal(titleTexture.refs, 0);
    assert.equal(responsive.runtime.assets.homeTitleFrame.destroyed, true);
    assert.ok(actionTextures.every((texture) => texture.refs === 0));
  }
  cc.view.getFrameSize = () => ({ width: 750, height: 1500 });
  console.log(
    'Tall/wide viewport backgrounds, drawer bottom anchoring, header order and compact shop passed.',
  );
};

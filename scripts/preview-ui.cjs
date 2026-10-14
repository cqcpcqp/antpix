// Render the real component node tree offline; no browser or Cocos screenshot.
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { writeFileSync, mkdirSync, readFileSync } = require('node:fs');
const {
  load,
  cc,
  Graphics,
  Label,
  Sprite,
  Texture2D,
  resourceLoads,
} = require('./headless-game.cjs');
cc.Node.prototype.destroy = function () {
  this.active = false;
  this.isValid = false;
};
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
GlobalFonts.registerFromPath('art/fonts/ant-nest-heavy.ttf', 'Game');
const css = (c) => `rgba(${c.r},${c.g},${c.b},${c.a / 255})`;
(async () => {
  const previewHeight = Number(process.env.PREVIEW_HEIGHT || 844),
    previewWidth = Number(process.env.PREVIEW_WIDTH || 390);
  cc.view.getFrameSize = () => ({ width: previewWidth, height: previewHeight });
  const levelIndex = Number(process.env.PREVIEW_LEVEL || 0);
  const game = new PixelGarden();
  game.onLoad();
  game.runtime.profile.save.unlocked = Math.max(game.runtime.profile.save.unlocked, levelIndex);
  game.runtime.session.startLevel(levelIndex);
  const digitFont = { name: 'Clean container digits' };
  resourceLoads.get('fonts/container-digits')(null, digitFont);
  const digitImage = await loadImage('assets/resources/fonts/container-digits.png');
  const glyphs = new Map(),
    digitTints = new Map();
  for (const line of readFileSync('assets/resources/fonts/container-digits.fnt', 'utf8').split(
    '\n',
  )) {
    if (!line.startsWith('char id=')) continue;
    const glyph = Object.fromEntries(
      [...line.matchAll(/(\w+)=(-?[\d.]+)/g)].map((m) => [m[1], Number(m[2])]),
    );
    glyphs.set(String.fromCharCode(glyph.id), glyph);
  }
  const bodyFont = { name: 'UI bitmap' };
  resourceLoads.get('fonts/ant-nest-bitmap')(null, bodyFont);
  const bodyImage = await loadImage('assets/resources/fonts/ant-nest-bitmap.png'),
    bodyGlyphs = new Map(),
    bodyTints = new Map();
  for (const line of readFileSync('assets/resources/fonts/ant-nest-bitmap.fnt', 'utf8').split(
    '\n',
  )) {
    if (!line.startsWith('char id=')) continue;
    const glyph = Object.fromEntries(
      [...line.matchAll(/(\w+)=(-?[\d.]+)/g)].map((m) => [m[1], Number(m[2])]),
    );
    bodyGlyphs.set(String.fromCodePoint(glyph.id), glyph);
  }
  const sources = new Map(),
    tints = new Map();
  for (const [path, file] of [
    ...[['containers/boxes/texture', 'assets/resources/containers/boxes.png']],
    ...['wood', 'acorn', 'wood-hole'].map((name) => [
      'trays/' + name + '/texture',
      'assets/resources/trays/' + name + '.png',
    ]),
    ['trays/garden-background/texture', 'assets/resources/trays/garden-background.jpg'],
    ['ants/workers/texture', 'assets/resources/ants/workers.png'],
  ]) {
    const image = await loadImage(file),
      texture = new Texture2D();
    texture.width = image.width;
    texture.height = image.height;
    resourceLoads.get(path)(null, texture);
    sources.set(texture, image);
  }
  const render = (width, height, root, zoom = 1, center = { x: 0, y: 0 }) => {
    const canvas = createCanvas(width, height),
      ctx = canvas.getContext('2d');
    ctx.fillStyle = '#F6F3DF';
    ctx.fillRect(0, 0, width, height);
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, -zoom);
    ctx.translate(-center.x, -center.y);
    const draw = (node) => {
      if (!node.active) return;
      ctx.save();
      ctx.translate(node.position.x, node.position.y);
      ctx.rotate((node.angle * Math.PI) / 180);
      ctx.scale(node.scale.x, node.scale.y);
      for (const c of node.components) {
        if (c instanceof Graphics)
          for (const command of c.commands) {
            ctx.beginPath();
            const p = command.p;
            if (command.kind === 'rect') ctx.roundRect(...p);
            else if (command.kind === 'ellipse') ctx.ellipse(...p, 0, 0, Math.PI * 2);
            else {
              p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
              ctx.closePath();
            }
            if (command.stroke) {
              ctx.strokeStyle = css(command.color);
              ctx.lineWidth = command.stroke;
              ctx.stroke();
            } else {
              ctx.fillStyle = css(command.color);
              ctx.fill();
            }
          }
        if (c instanceof Sprite && c.spriteFrame) {
          const frame = c.spriteFrame,
            bounds = node.getComponent(cc.UITransform),
            source = sources.get(frame.texture);
          ctx.save();
          ctx.scale(1, -1);
          if (c.color && (c.color.r !== 255 || c.color.g !== 255 || c.color.b !== 255)) {
            const key = css(c.color) + JSON.stringify(frame.rect);
            if (!tints.has(key)) {
              const fw = frame.rect.width,
                fh = frame.rect.height;
              const tinted = createCanvas(fw, fh),
                tc = tinted.getContext('2d');
              tc.drawImage(source, frame.rect.x, frame.rect.y, fw, fh, 0, 0, fw, fh);
              tc.globalCompositeOperation = 'multiply';
              tc.fillStyle = css(c.color);
              tc.fillRect(0, 0, fw, fh);
              tc.globalCompositeOperation = 'destination-in';
              tc.drawImage(source, frame.rect.x, frame.rect.y, fw, fh, 0, 0, fw, fh);
              tints.set(key, tinted);
            }
            ctx.drawImage(
              tints.get(key),
              -bounds.width / 2,
              -bounds.height / 2,
              bounds.width,
              bounds.height,
            );
          } else if (c.type === Sprite.Type.SLICED) {
            const sx = [0, frame.insetLeft, frame.rect.width - frame.insetRight, frame.rect.width];
            const sy = [
              0,
              frame.insetTop,
              frame.rect.height - frame.insetBottom,
              frame.rect.height,
            ];
            const dx = [
              -bounds.width / 2,
              -bounds.width / 2 + frame.insetLeft,
              bounds.width / 2 - frame.insetRight,
              bounds.width / 2,
            ];
            const dy = [
              -bounds.height / 2,
              -bounds.height / 2 + frame.insetTop,
              bounds.height / 2 - frame.insetBottom,
              bounds.height / 2,
            ];
            for (let row = 0; row < 3; row++)
              for (let col = 0; col < 3; col++)
                ctx.drawImage(
                  source,
                  frame.rect.x + sx[col],
                  frame.rect.y + sy[row],
                  sx[col + 1] - sx[col],
                  sy[row + 1] - sy[row],
                  dx[col],
                  dy[row],
                  dx[col + 1] - dx[col],
                  dy[row + 1] - dy[row],
                );
          } else
            ctx.drawImage(
              source,
              frame.rect.x,
              frame.rect.y,
              frame.rect.width,
              frame.rect.height,
              -bounds.width / 2,
              -bounds.height / 2,
              bounds.width,
              bounds.height,
            );
          ctx.restore();
        }
        if (c instanceof Label) {
          if (c.font === digitFont || c.font === bodyFont) {
            const map = c.font === digitFont ? glyphs : bodyGlyphs,
              atlas = c.font === digitFont ? digitImage : bodyImage,
              cache = c.font === digitFont ? digitTints : bodyTints;
            ctx.save();
            ctx.scale(1, -1);
            let scale = c.fontSize / 48;
            const chars = [...c.string];
            const lineWidth = chars.reduce(
              (sum, ch, i) =>
                sum +
                (i === chars.length - 1
                  ? map.get(ch).xoffset + map.get(ch).width
                  : map.get(ch).xadvance),
              0,
            );
            scale = Math.min(
              scale,
              node.getComponent(cc.UITransform).width / Math.max(1, lineWidth),
            );
            let x = (-lineWidth * scale) / 2;
            for (const ch of c.string) {
              const g = map.get(ch),
                key = ch + css(c.color);
              if (!g.width || !g.height) {
                x += g.xadvance * scale;
                continue;
              }
              if (!cache.has(key)) {
                const tile = createCanvas(g.width, g.height),
                  tc = tile.getContext('2d');
                tc.drawImage(atlas, g.x, g.y, g.width, g.height, 0, 0, g.width, g.height);
                tc.globalCompositeOperation = 'source-in';
                tc.fillStyle = css(c.color);
                tc.fillRect(0, 0, g.width, g.height);
                cache.set(key, tile);
              }
              ctx.drawImage(
                cache.get(key),
                x + g.xoffset * scale,
                (-24 + g.yoffset) * scale,
                g.width * scale,
                g.height * scale,
              );
              x += g.xadvance * scale;
            }
            ctx.restore();
            continue;
          }
          ctx.save();
          ctx.scale(1, -1);
          ctx.font = `${c.fontSize}px Game`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (c.enableOutline) {
            ctx.strokeStyle = css(c.outlineColor);
            ctx.lineWidth = c.outlineWidth * 2;
            ctx.lineJoin = 'round';
            ctx.strokeText(c.string, 0, 0);
          }
          ctx.fillStyle = css(c.color);
          ctx.fillText(c.string, 0, 0);
          ctx.restore();
        }
      }
      node.children.forEach(draw);
      ctx.restore();
    };
    draw(root);
    return canvas.toBuffer('image/png');
  };

  const out = process.env.PREVIEW_OUT || `temp/previews/ui-${previewWidth}x${previewHeight}`;
  mkdirSync(out, { recursive: true });
  for (const name of ['garden', 'title', 'play', 'album', 'shop', 'rank', 'furnishings']) {
    const im = await loadImage(
        'assets/resources/home/' + name + (name === 'garden' ? '.jpg' : '.png'),
      ),
      tx = new Texture2D();
    tx.width = im.width;
    tx.height = im.height;
    resourceLoads.get('home/' + name + '/texture')(null, tx);
    sources.set(tx, im);
  }
  const shot = (name) =>
    writeFileSync(
      out + '/' + name + '.png',
      render(
        previewWidth,
        previewHeight,
        game.runtime.lifecycle.root,
        previewWidth / game.runtime.lifecycle.screenWidth,
      ),
    );
  game.runtime.session.startLevel(levelIndex);
  shot('game');
  for (let i = 0; i < 3; i++)
    game.runtime.session.model.place(
      game.runtime.session.model.visibleQueue.find((v) => v.row === 0).jar.id,
    );
  game.runtime.containers.drawSlots();
  game.runtime.queue.drawQueue();
  for (let i = 0; i < 80; i++) game.update(0.05);
  shot('playing');
  game.runtime.settings.settings();
  game.runtime.overlays.updateOverlays(0.5);
  shot('settings');
  game.runtime.overlays.closeModal();
  game.runtime.boosts.requestSpeed();
  shot('speed');
  game.runtime.overlays.closeModal();
  game.runtime.settings.showBlocked();
  shot('blocked');
  game.runtime.overlays.closeModal();
  game.runtime.session.startLevel(levelIndex);
  game.runtime.session.model.pixels.fill(-1);
  game.runtime.session.model.remaining = 0;
  game.runtime.session.model.collected = game.runtime.session.model.level.pixels.length;
  game.runtime.layout.drawBoard();
  game.runtime.layout.queueCount.string = game.runtime.queue.queueCaption();
  game.runtime.victory.victory();
  game.runtime.victory.finishCelebration();
  shot('victory');
  game.runtime.overlays.closeModal();
  game.runtime.home.showHome();
  shot('home');
  game.runtime.album.levelPicker();
  shot('levels');
  game.runtime.overlays.closeModal();
  game.runtime.profile.save.unlocked = 0;
  game.runtime.album.levelPicker();
  shot('locked-levels');
  game.runtime.overlays.closeModal();
  game.runtime.shop.shop();
  game.runtime.overlays.updateOverlays(0.5);
  shot('shop');
  game.runtime.overlays.closeModal();
  game.runtime.profile.save.coins = 10000;
  game.runtime.shop.shop('garden', 'lantern-garden');
  game.runtime.overlays.updateOverlays(0.5);
  shot('courtyard-preview');
  game.runtime.overlays.closeModal();
  const { FURNISHINGS, buyOrEquipFurnishing } = load(
    process.cwd() + '/assets/scripts/domain/profile/profile.ts',
  );
  for (const id of ['flower-arch', 'wood-path', 'lantern-garden', 'dew-pond'])
    buyOrEquipFurnishing(game.runtime.profile.save, id);
  game.runtime.home.showHome();
  shot('courtyard-furnished');
  game.runtime.shop.nestShop();
  game.runtime.overlays.updateOverlays(0.5);
  shot('nest-shop');
  game.runtime.overlays.closeModal();
  game.runtime.social.leaderboard();
  shot('records');
  game.runtime.overlays.closeModal();
  game.runtime.home.favoriteGuide();
  shot('favorite');
  game.runtime.overlays.closeModal();
  game.runtime.cloud.cloudMode = true;
  game.runtime.cloud.cloudReady = false;
  game.runtime.cloud.cloudRunId = '';
  game.runtime.home.showHome();
  game.runtime.cloud.cloudTask(
    () => new Promise(() => {}),
    () => {},
    '正在同步进度…',
  );
  shot('cloud-home');
  game.runtime.settings.settings();
  game.runtime.overlays.updateOverlays(0.5);
  shot('cloud-settings');
  game.runtime.overlays.closeModal();
  game.runtime.cloud.cloudBusy = false;
  game.runtime.cloud.cloudMessage = '';
  game.runtime.cloud.cloudReady = true;
  game.runtime.home.showHome();
  game.runtime.cloud.cloud = { leaderboard: () => new Promise(() => {}) };
  game.runtime.social.worldLeaderboard(0);
  shot('cloud-rank');
  game.runtime.overlays.closeModal();
  game.onDestroy();
  console.log('UI previews saved to ' + out);
})();

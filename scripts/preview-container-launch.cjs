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
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
GlobalFonts.registerFromPath('assets/resources/fonts/ant-nest-heavy.ttf', 'Game');
const css = (c) => `rgba(${c.r},${c.g},${c.b},${c.a / 255})`;
(async () => {
  const previewHeight = Number(process.env.PREVIEW_HEIGHT || 822);
  cc.view.getFrameSize = () => ({ width: 411, height: previewHeight });
  const game = new PixelGarden();
  game.onLoad();
  game.startLevel(0);
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
  for (let i = 0; i < 3; i++)
    game.model.place(game.model.visibleQueue.find((v) => v.row === 0).jar.id);
  game.drawSlots();
  game.drawQueue();
  if (process.env.TRAY_PREVIEW)
    for (const card of game.cardViews) card.node.setPosition(card.node.position.x, card.targetY);
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
          if (c.font === digitFont) {
            ctx.save();
            ctx.scale(1, -1);
            const scale = c.fontSize / 48;
            const chars = [...c.string];
            const lineWidth = chars.reduce(
              (sum, ch, i) =>
                sum +
                (i === chars.length - 1
                  ? glyphs.get(ch).xoffset + glyphs.get(ch).width
                  : glyphs.get(ch).xadvance),
              0,
            );
            let x = (-lineWidth * scale) / 2;
            for (const ch of c.string) {
              const g = glyphs.get(ch),
                key = ch + css(c.color);
              if (!digitTints.has(key)) {
                const tile = createCanvas(g.width, g.height),
                  tc = tile.getContext('2d');
                tc.drawImage(digitImage, g.x, g.y, g.width, g.height, 0, 0, g.width, g.height);
                tc.globalCompositeOperation = 'source-in';
                tc.fillStyle = css(c.color);
                tc.fillRect(0, 0, g.width, g.height);
                digitTints.set(key, tile);
              }
              ctx.drawImage(
                digitTints.get(key),
                x + g.xoffset * scale,
                -c.fontSize / 2 + g.yoffset * scale,
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
  const out = process.env.PREVIEW_OUT || 'temp/previews/container-launch';
  mkdirSync(out, { recursive: true });
  writeFileSync(
    `${out}/game.png`,
    render(411, previewHeight, game.gameRoot, 411 / game.screenWidth),
  );
  writeFileSync(
    `${out}/containers.png`,
    render(750, process.env.TRAY_PREVIEW ? 450 : 345, game.gameRoot, 1, {
      x: 0,
      y: process.env.TRAY_PREVIEW ? -435 : -397,
    }),
  );
  const sampleLabels = [
    game.slotViews[0].label,
    game.slotViews[1].label,
    ...game.cardViews.filter((c) => c.node.active).map((c) => c.label),
  ];
  const originalNumbers = sampleLabels.map((label) => label.string);
  sampleLabels.forEach((label, i) => {
    label.string = ['1', '11', '12', '13', '23'][i % 5];
    game.containerNumber(label);
  });
  writeFileSync(`${out}/alignment.png`, render(750, 345, game.gameRoot, 1, { x: 0, y: -397 }));
  sampleLabels.forEach((label, i) => {
    label.string = originalNumbers[i];
    game.containerNumber(label);
  });
  for (let i = 0; i < 36; i++) {
    game.update(1 / 60);
    writeFileSync(
      `${out}/launch-${String(i).padStart(2, '0')}.png`,
      render(750, 190, game.gameRoot, 1, { x: 0, y: -275 }),
    );
  }
  if (process.env.PIXEL_D_PREVIEW) {
    // Identical comparison removal pattern, rendered by the actual game method.
    for (let row = game.model.level.height - 8; row < game.model.level.height; row++)
      for (let col = 0; col < game.model.level.width; col++) {
        const depth = (col * 17 + 7) % 9;
        if (
          row >= game.model.level.height - 7 + depth * 0.65 ||
          (row >= game.model.level.height - 4 && (col % 7 === 0 || col % 11 === 0))
        )
          game.model.pixels[row * game.model.level.width + col] = -1;
      }
    game.drawBoard();
    writeFileSync(
      `${out}/game-with-edge.png`,
      render(411, 822, game.gameRoot, 411 / game.screenWidth),
    );
    writeFileSync(`${out}/dense.png`, render(640, 330, game.gameRoot, 2.6, { x: -32, y: 365 }));
    writeFileSync(`${out}/edge.png`, render(640, 330, game.gameRoot, 2.6, { x: 0, y: -59 }));
  }
  if (process.env.TRAY_PREVIEW) {
    writeFileSync(`${out}/wood-nest.png`, render(750, 560, game.gameRoot, 1, { x: 0, y: -390 }));
    game.startLevel(0);
    for (const card of game.cardViews) card.node.setPosition(card.node.position.x, card.targetY);
    writeFileSync(`${out}/empty-slots.png`, render(750, 450, game.gameRoot, 1, { x: 0, y: -435 }));
    game.requestSlotExpansion();
    game.rewardAdDemo.complete();
    game.rewardAdDemo = null;
    game.closeModal();
    for (let i = 0; i < 6; i++)
      game.model.place(game.model.visibleQueue.find((v) => v.row === 0).jar.id);
    game.drawSlots();
    game.drawQueue();
    for (const card of game.cardViews) card.node.setPosition(card.node.position.x, card.targetY);
    writeFileSync(
      `${out}/expanded-game.png`,
      render(411, previewHeight, game.gameRoot, 411 / game.screenWidth),
    );
    for (let expansion = 0; expansion < 3; expansion++) {
      game.requestSlotExpansion();
      game.rewardAdDemo.complete();
      game.rewardAdDemo = null;
      game.closeModal();
      game.model.place(game.model.visibleQueue.find((v) => v.row === 0).jar.id);
    }
    game.drawSlots();
    game.drawQueue();
    for (const card of game.cardViews) card.node.setPosition(card.node.position.x, card.targetY);
    writeFileSync(
      `${out}/fully-expanded-game.png`,
      render(411, previewHeight, game.gameRoot, 411 / game.screenWidth),
    );
  }
  game.onDestroy();
  console.log(out);
})();

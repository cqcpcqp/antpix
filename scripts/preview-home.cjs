// Offline composition preview using the real home node tree; not a Cocos screenshot.
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { writeFileSync, mkdirSync } = require('node:fs');
mkdirSync('temp/previews', { recursive: true });
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
// Match Cocos sibling ordering for the offline renderer (the test mock is minimal).
cc.Node.prototype.setSiblingIndex = function (index) {
  if (!this.parent) return;
  const siblings = this.parent.children;
  const current = siblings.indexOf(this);
  if (current >= 0) siblings.splice(current, 1);
  siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, this);
};

GlobalFonts.registerFromPath('art/fonts/ant-nest-heavy.ttf', 'Game');
const css = (c) => `rgba(${c.r},${c.g},${c.b},${c.a / 255})`;
(async () => {
  const image = await loadImage('assets/resources/home/garden.jpg');
  const title = await loadImage('assets/resources/home/title.png');
  const actions = {};
  for (const name of ['play', 'album', 'shop', 'rank'])
    actions[name] = await loadImage(`assets/resources/home/${name}.png`);
  for (const [width, height] of [
    [390, 844],
    [375, 750],
    [768, 1024],
  ]) {
    cc.view.getFrameSize = () => ({ width, height });
    const game = new PixelGarden();
    game.onLoad();
    const texture = new Texture2D();
    texture.width = image.width;
    texture.height = image.height;
    resourceLoads.get('home/garden/texture')(null, texture);
    const titleTexture = new Texture2D();
    titleTexture.width = title.width;
    titleTexture.height = title.height;
    resourceLoads.get('home/title/texture')(null, titleTexture);
    const sources = new Map([
      [texture, image],
      [titleTexture, title],
    ]);
    for (const [name, image] of Object.entries(actions)) {
      const texture = new Texture2D();
      texture.width = image.width;
      texture.height = image.height;
      resourceLoads.get(`home/${name}/texture`)(null, texture);
      sources.set(texture, image);
    }
    for (const name of ['furnishings', 'resident', 'resident-door']) {
      const image = await loadImage(`assets/resources/home/${name}.png`);
      const texture = new Texture2D();
      texture.width = image.width;
      texture.height = image.height;
      resourceLoads.get(`home/${name}/texture`)(null, texture);
      sources.set(texture, image);
    }
    if (process.env.RESIDENT_PREVIEW) {
      game.courtyardColony.random = () => 0.5;
      game.courtyardColony.residents.forEach((r) => {
        r.random = () => 0.5;
      });
      const furniture =
        process.env.RESIDENT_PREVIEW === 'pond'
          ? 'dew-pond'
          : process.env.RESIDENT_PREVIEW === 'seed'
            ? 'seed-pantry'
            : 'leaf-bed';
      game.save.courtyard.equipped.living = furniture;
      game.save.courtyard.owned.push(furniture);
      game.courtyardHour = () => (process.env.RESIDENT_PREVIEW === 'night' ? 22 : 12);
      if (process.env.RESIDENT_PREVIEW === 'night') {
        game.save.courtyard.equipped.garden = 'lantern-garden';
        game.save.courtyard.owned.push('lantern-garden');
      }
      game.refreshCourtyard();
    }
    const canvas = createCanvas(width, height),
      ctx = canvas.getContext('2d');
    ctx.translate(width / 2, height / 2);
    ctx.scale(width / game.screenWidth, -height / game.screenHeight);
    const tinted = new Map();
    const draw = (node) => {
      if (!node.active) return;
      ctx.save();
      const opacity = node.getComponent(cc.UIOpacity);
      if (opacity) ctx.globalAlpha *= opacity.opacity / 255;
      ctx.translate(node.position.x, node.position.y);
      ctx.rotate((node.angle * Math.PI) / 180);
      ctx.scale(node.scale.x, node.scale.y);
      for (const component of node.components) {
        if (component instanceof Graphics)
          for (const command of component.commands) {
            ctx.beginPath();
            const p = command.p;
            if (command.kind === 'rect') ctx.roundRect(p[0], p[1], p[2], p[3], p[4]);
            else if (command.kind === 'ellipse')
              ctx.ellipse(p[0], p[1], p[2], p[3], 0, 0, Math.PI * 2);
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
        if (component instanceof Sprite && component.spriteFrame) {
          const crop = component.spriteFrame.rect,
            bounds = node.getComponent(cc.UITransform);
          ctx.save();
          ctx.scale(1, -1);
          let source = sources.get(component.spriteFrame.texture);
          const c = component.color;
          if (c && (c.r !== 255 || c.g !== 255 || c.b !== 255)) {
            const key =
              [...sources.keys()].indexOf(component.spriteFrame.texture) +
              ':' +
              c.r +
              ':' +
              c.g +
              ':' +
              c.b;
            if (!tinted.has(key)) {
              const copy = createCanvas(source.width, source.height),
                paint = copy.getContext('2d');
              paint.drawImage(source, 0, 0);
              paint.globalCompositeOperation = 'multiply';
              paint.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
              paint.fillRect(0, 0, source.width, source.height);
              paint.globalCompositeOperation = 'destination-in';
              paint.drawImage(source, 0, 0);
              tinted.set(key, copy);
            }
            source = tinted.get(key);
          }
          ctx.drawImage(
            source,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            -bounds.width / 2,
            -bounds.height / 2,
            bounds.width,
            bounds.height,
          );
          ctx.restore();
        }
        if (component instanceof Label) {
          ctx.save();
          ctx.scale(1, -1);
          ctx.font = `${component.fontSize}px Game`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (component.enableOutline) {
            ctx.strokeStyle = css(component.outlineColor);
            ctx.lineWidth = component.outlineWidth * 2;
            ctx.lineJoin = 'round';
            ctx.strokeText(component.string, 0, 0);
          }
          ctx.fillStyle = css(component.color);
          ctx.fillText(component.string, 0, 0);
          ctx.restore();
        }
      }
      node.children.forEach(draw);
      ctx.restore();
    };
    if (process.env.RESIDENT_PREVIEW && width === 390) {
      mkdirSync(`temp/previews/resident-${process.env.RESIDENT_PREVIEW}`, { recursive: true });
      for (let frame = 0; frame < 480; frame++) {
        for (let tick = 0; tick < 5; tick++) game.update(1 / 60);
        ctx.save();
        ctx.resetTransform();
        ctx.clearRect(0, 0, width, height);
        ctx.restore();
        draw(game.home);
        writeFileSync(
          `temp/previews/resident-${process.env.RESIDENT_PREVIEW}/${String(frame).padStart(4, '0')}.png`,
          canvas.toBuffer('image/png'),
        );
      }
    }
    draw(game.home);
    writeFileSync(`temp/previews/home-${width}x${height}.png`, canvas.toBuffer('image/png'));
    game.onDestroy();
  }
})();

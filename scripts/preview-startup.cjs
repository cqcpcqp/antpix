// Offline preview of the actual startup node tree and pre-engine painter; no browser/GPU.
const { createCanvas, loadImage, GlobalFonts, ImageData } = require('@napi-rs/canvas');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const vm = require('node:vm');
const {
  load,
  cc,
  Graphics,
  Sprite,
  Label,
  Texture2D,
  resourceLoads,
} = require('./headless-game.cjs');
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
const { STARTUP } = load(process.cwd() + '/assets/scripts/presentation/startupLayout.ts');
const moduleObject = { exports: {} };
vm.runInNewContext(readFileSync('wechat/startup/painter.js', 'utf8'), {
  module: moduleObject,
  require: () => STARTUP,
});
GlobalFonts.registerFromPath('art/fonts/ant-nest-heavy.ttf', 'Game');
GlobalFonts.registerFromPath('art/fonts/noto-NotoSansSC[wght].ttf', 'sans-serif');
const css = (c) => `rgba(${c.r},${c.g},${c.b},${c.a / 255})`;
async function main() {
  mkdirSync('temp/previews', { recursive: true });
  const background = await loadImage('assets/resources/home/garden.jpg');
  const title = await loadImage('assets/resources/home/title.png');
  for (const [width, height] of [
    [390, 844],
    [375, 667],
    [768, 1024],
  ]) {
    cc.view.getFrameSize = () => ({ width, height });
    const game = new PixelGarden();
    game.onLoad();
    const sources = new Map();
    for (const [path, image] of [
      ['home/garden/texture', background],
      ['home/title/texture', title],
    ]) {
      const texture = new Texture2D();
      texture.width = image.width;
      texture.height = image.height;
      resourceLoads.get(path)(null, texture);
      sources.set(texture, image);
    }
    game.runtime.startupView.refresh(78, STARTUP.syncing);
    const canvas = createCanvas(width, height),
      ctx = canvas.getContext('2d');
    ctx.translate(width / 2, height / 2);
    ctx.scale(
      width / game.runtime.lifecycle.screenWidth,
      -height / game.runtime.lifecycle.screenHeight,
    );
    const draw = (node) => {
      if (!node.active) return;
      ctx.save();
      ctx.translate(node.position.x, node.position.y);
      for (const component of node.components) {
        if (component instanceof Graphics) {
          for (const command of component.commands) {
            const p = command.p;
            ctx.beginPath();
            ctx.roundRect(p[0], p[1], p[2], p[3], p[4]);
            ctx.fillStyle = css(command.color);
            ctx.fill();
          }
        }
        if (component instanceof Sprite && component.spriteFrame) {
          const frame = component.spriteFrame;
          const size = node.getComponent(cc.UITransform);
          ctx.save();
          ctx.scale(1, -1);
          if (!sources.has(frame.texture)) {
            const texture = frame.texture;
            const gradient = createCanvas(texture.width, texture.height);
            gradient
              .getContext('2d')
              .putImageData(
                new ImageData(new Uint8ClampedArray(texture.pixels), texture.width, texture.height),
                0,
                0,
              );
            sources.set(texture, gradient);
          }
          ctx.drawImage(
            sources.get(frame.texture),
            frame.rect.x,
            frame.rect.y,
            frame.rect.width,
            frame.rect.height,
            -size.width / 2,
            -size.height / 2,
            size.width,
            size.height,
          );
          ctx.restore();
        }
        if (component instanceof Label) {
          ctx.save();
          ctx.scale(1, -1);
          ctx.font = `${component.fontSize}px Game`;
          ctx.fillStyle = css(component.color);
          ctx.textBaseline = 'middle';
          const size = node.getComponent(cc.UITransform);
          ctx.textAlign =
            component.horizontalAlign === Label.HorizontalAlign.LEFT
              ? 'left'
              : component.horizontalAlign === Label.HorizontalAlign.RIGHT
                ? 'right'
                : 'center';
          const x =
            ctx.textAlign === 'left'
              ? -size.width / 2
              : ctx.textAlign === 'right'
                ? size.width / 2
                : 0;
          ctx.fillText(component.string, x, 0, size.width);
          ctx.restore();
        }
      }
      node.children.forEach(draw);
      ctx.restore();
    };
    draw(game.runtime.startupView.root);
    writeFileSync(`temp/previews/startup-${width}x${height}.png`, canvas.toBuffer('image/png'));
    const early = createCanvas(width, height);
    moduleObject.exports.paint(
      early.getContext('2d'),
      early,
      { background, title },
      78,
      STARTUP.syncing,
    );
    writeFileSync(
      `temp/previews/startup-early-${width}x${height}.png`,
      early.toBuffer('image/png'),
    );
    game.onDestroy();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

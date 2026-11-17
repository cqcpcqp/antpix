// Software preview of real UI node geometry, not a device/GPU screenshot. No browser.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  cc,
  leaderboardFixture,
  rankingNodes,
  players,
  settleLeaderboard,
} from '../tests/helpers/leaderboard-view.mjs';
const require = createRequire(import.meta.url);
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
GlobalFonts.registerFromPath('art/fonts/ant-nest-heavy.ttf', 'Game');
GlobalFonts.registerFromPath('art/fonts/noto-NotoSansSC[wght].ttf', 'Nickname');
const measure = createCanvas(1, 1).getContext('2d');
cc.Label.prototype.updateRenderData = function () {
  if (this.overflow !== cc.Label.Overflow.NONE) return;
  measure.font = `${this.isBold ? 'bold ' : ''}${this.fontSize}px Nickname`;
  this.node
    .getComponent(cc.UITransform)
    .setContentSize(measure.measureText(this.string).width, this.fontSize * 1.6);
};
const background = await loadImage('assets/resources/home/garden.jpg');
const atlas = await loadImage('assets/resources/leaderboard/laurel.png');
const out = 'output/leaderboard-laurel-v2';
mkdirSync(out, { recursive: true });
const css = (c) => `rgba(${c.r},${c.g},${c.b},${c.a / 255})`;
for (const [name, options] of [
  ['top-100', {}],
  ['loading', { loading: true }],
  ['anonymous', { anonymous: true }],
  ['bottom-100', { bottom: true }],
  ['narrow-with-consent', { consent: true, touchSize: 116 }],
]) {
  const viewport = options.consent ? { width: 320, height: 568 } : { width: 390, height: 844 };
  const { game, requests } = leaderboardFixture(
    players(1, 100).map((row) => (options.anonymous ? { ...row, identity: null } : row)),
    {
      ...options,
      viewport,
    },
  );
  if (options.loading) {
    game.identity.synchronize = () => new Promise(() => {});
    game.social.worldLeaderboard();
  }
  await settleLeaderboard();
  if (options.bottom) rankingNodes(game).scroll.scrollToBottom();
  // Distinct coloured sample portraits exercise the real remote-image and mask path.
  const portraits = new Map();
  for (let i = 0; i < requests.length; i++) {
    const portrait = createCanvas(128, 128),
      p = portrait.getContext('2d');
    p.fillStyle = ['#b5d3b1', '#d7c7a8', '#e6b59a'][i % 3];
    p.fillRect(0, 0, 128, 128);
    p.fillStyle = '#fff4da';
    p.beginPath();
    p.ellipse(64, 65, 38, 40, 0, 0, Math.PI * 2);
    p.fill();
    p.fillStyle = '#614a33';
    for (const x of [51, 77]) {
      p.beginPath();
      p.arc(x, 63, 3, 0, Math.PI * 2);
      p.fill();
    }
    p.strokeStyle = '#a97955';
    p.lineWidth = 3;
    p.beginPath();
    p.arc(64, 75, 9, 0, Math.PI);
    p.stroke();
    const image = { addRef() {}, decRef() {} };
    portraits.set(image, portrait);
    requests[i].callback(null, image);
  }
  const width = options.consent ? 320 : 390,
    height = options.consent ? 568 : 844;
  const canvas = createCanvas(width * 2, height * 2),
    ctx = canvas.getContext('2d');
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  const scale = canvas.width / game.lifecycle.screenWidth;
  ctx.scale(scale, -scale);
  function draw(node) {
    if (!node.active) return;
    ctx.save();
    ctx.translate(node.position.x, node.position.y);
    ctx.rotate((node.angle * Math.PI) / 180);
    ctx.scale(node.scale.x, node.scale.y);
    const bounds = node.getComponent(cc.UITransform);
    if (node.getComponent(cc.Mask)) {
      ctx.beginPath();
      if (node.getComponent(cc.Mask).type === cc.Mask.Type.GRAPHICS_RECT)
        ctx.rect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height);
      else ctx.ellipse(0, 0, bounds.width / 2, bounds.height / 2, 0, 0, Math.PI * 2);
      ctx.clip();
    }
    for (const component of node.components) {
      if (component instanceof cc.Graphics)
        for (const command of component.commands) {
          ctx.beginPath();
          if (command.kind === 'rect') ctx.roundRect(...command.p);
          else if (command.kind === 'ellipse') ctx.ellipse(...command.p, 0, 0, Math.PI * 2);
          else {
            command.p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
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
      if (component instanceof cc.Sprite && component.spriteFrame) {
        ctx.save();
        ctx.scale(1, -1);
        const frame = component.spriteFrame;
        const portrait = portraits.get(frame.texture.image);
        if (portrait)
          ctx.drawImage(
            portrait,
            -bounds.width / 2,
            -bounds.height / 2,
            bounds.width,
            bounds.height,
          );
        else if (component.type === cc.Sprite.Type.SLICED) {
          // Integer offscreen tessellation avoids Canvas antialiasing seams between slices.
          const surface = createCanvas(Math.round(bounds.width), Math.round(bounds.height));
          const painter = surface.getContext('2d');
          const sx = [0, frame.insetLeft, frame.rect.width - frame.insetRight, frame.rect.width];
          const sy = [0, frame.insetTop, frame.rect.height - frame.insetBottom, frame.rect.height];
          const dx = [0, frame.insetLeft, surface.width - frame.insetRight, surface.width];
          const dy = [0, frame.insetTop, surface.height - frame.insetBottom, surface.height];
          for (let row = 0; row < 3; row++)
            for (let col = 0; col < 3; col++) {
              if (sx[col + 1] === sx[col] || sy[row + 1] === sy[row]) continue;
              painter.drawImage(
                atlas,
                frame.rect.x + sx[col],
                frame.rect.y + sy[row],
                sx[col + 1] - sx[col],
                sy[row + 1] - sy[row],
                dx[col],
                dy[row],
                dx[col + 1] - dx[col],
                dy[row + 1] - dy[row],
              );
            }
          ctx.drawImage(
            surface,
            -bounds.width / 2,
            -bounds.height / 2,
            bounds.width,
            bounds.height,
          );
        } else
          ctx.drawImage(
            atlas,
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
      if (component instanceof cc.Label) {
        ctx.save();
        ctx.scale(1, -1);
        ctx.font = `${component.isBold ? 'bold ' : ''}${component.fontSize}px ${component.useSystemFont ? 'Nickname' : 'Game'}`;
        ctx.textAlign =
          component.horizontalAlign === cc.Label.HorizontalAlign.LEFT ? 'left' : 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = css(component.color);
        if (component.overflow === cc.Label.Overflow.CLAMP) {
          ctx.beginPath();
          ctx.rect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height);
          ctx.clip();
        }
        ctx.fillText(
          component.string,
          component.horizontalAlign === cc.Label.HorizontalAlign.LEFT ? -bounds.width / 2 : 0,
          0,
          bounds.width,
        );
        ctx.restore();
      }
    }
    node.children.forEach(draw);
    ctx.restore();
  }
  draw(game.overlays.modal);
  writeFileSync(`${out}/${name}.png`, canvas.toBuffer('image/png'));
}
console.log(`Leaderboard scene previews saved to ${out}`);

// Software preview of real UI node geometry, not a device/GPU screenshot. No browser.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  cc,
  leaderboardFixture,
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
  measure.font = `bold ${this.fontSize}px Nickname`;
  this.node
    .getComponent(cc.UITransform)
    .setContentSize(measure.measureText(this.string).width, this.fontSize * 1.6);
};
const background = await loadImage('assets/resources/home/garden.jpg');
const out = 'output/leaderboard-c-implementation';
mkdirSync(out, { recursive: true });
const css = (c) => `rgba(${c.r},${c.g},${c.b},${c.a / 255})`;
for (const [name, options] of [
  ['first-page', {}],
  ['later-page', { page: 1 }],
  ['narrow-with-consent', { consent: true, touchSize: 116 }],
]) {
  const viewport = options.consent ? { width: 320, height: 568 } : { width: 390, height: 844 };
  const { game, requests } = leaderboardFixture(players(options.page ? 11 : 1), {
    ...options,
    viewport,
  });
  await settleLeaderboard();
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
      ctx.ellipse(0, 0, bounds.width / 2, bounds.height / 2, 0, 0, Math.PI * 2);
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
        ctx.drawImage(
          portraits.get(component.spriteFrame.texture.image),
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

// Actual component lifecycle, using the same headless Cocos adapter as check:ui.
const assert = require('node:assert/strict');
const { load, cc, Texture2D, resourceLoads } = require('./headless-game.cjs');
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
const { GardenModel } = load(process.cwd() + '/assets/scripts/domain/game/model.ts');
const { GRID_WIDTH, GRID_HEIGHT } = load(process.cwd() + '/assets/scripts/domain/levels/levels.ts');
const PIXEL_COUNT = GRID_WIDTH * GRID_HEIGHT;
const game = new PixelGarden();
game.onLoad();
const setup = (capacity = 10) => {
  game.runtime.session.startLevel(0);
  game.runtime.session.model = new GardenModel({
    name: 'launch',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels: Array(PIXEL_COUNT).fill(0),
    capacity,
  });
  game.runtime.session.model.place(game.runtime.session.model.queue[0].id);
  game.runtime.containers.drawSlots();
  game.runtime.queue.drawQueue();
};
setup();
game.update(0.02);
const slot = game.runtime.containers.slotViews[0],
  trip = game.runtime.flights.flights[0];
assert.equal(trip.phase, 'launch');
assert.equal(trip.launchOrigin.x, slot.art.node.position.x);
assert.equal(trip.launchOrigin.y, slot.art.node.position.y + 25);
assert.ok(slot.container.scale.y < 1, 'launch starts by compressing the box');
assert.equal(slot.art.node.scale.y, 1, 'the tray remains stationary');
assert.equal(slot.label.node.parent, slot.container, 'number follows the box');
const frozen = [slot.launchElapsed, slot.container.scale.y, trip.elapsed];
game.runtime.lifecycle.hideHandler();
game.update(0.05);
assert.deepEqual([slot.launchElapsed, slot.container.scale.y, trip.elapsed], frozen);
game.runtime.lifecycle.showHandler();
game.update(0.05);
game.update(0.04);
assert.ok(slot.container.scale.y > 1, 'the box rebounds during release');
assert.ok(trip.visual.node.position.y > trip.launchOrigin.y, 'ant leaves through the top');
for (let i = 0; i < 4; i++) game.update(0.05);
assert.equal(slot.container.scale.x, 1);
assert.equal(slot.container.scale.y, 1);
assert.equal(slot.container.position.y, 0);
assert.equal(trip.phase, 'outbound');
const texture = new Texture2D();
resourceLoads.get('containers/boxes/texture')(null, texture);
assert.equal(texture.refs, 1);
assert.equal(slot.sprite.spriteFrame.texture, texture);
assert.equal(slot.sprite.spriteFrame.rect.width, 88);
assert.equal(
  slot.sprite.color.r,
  parseInt(
    load(process.cwd() + '/assets/scripts/domain/levels/levels.ts').PALETTE[0].slice(1, 3),
    16,
  ),
);
assert.equal(
  game.runtime.containers.containerDetails.get(slot.sprite).spriteFrame,
  game.runtime.assets.containerFrames[1],
);
const bounds = slot.sprite.node.getComponent(cc.UITransform);
assert.equal(bounds.width, 102);
assert.equal(bounds.height, 90);
assert.ok(
  game.runtime.queue.cardViews.every((card) => card.node.scale.x === 1 && card.node.scale.y === 1),
  'both queue rows use the same scale',
);
for (const text of ['1', '11', '12', '23']) {
  slot.label.string = text;
  game.runtime.containers.containerNumber(slot.label);
  const { containerNumberOffset } = load(
    process.cwd() + '/assets/scripts/presentation/containerTypography.ts',
  );
  assert.equal(slot.label.node.position.x, containerNumberOffset(text, 32));
}
const { PALETTE } = load(process.cwd() + '/assets/scripts/domain/levels/levels.ts');
assert.equal(
  game.runtime.assets.containerFrames.length,
  2,
  'all colors share two container layers',
);
assert.equal(game.runtime.assets.containerFrames[1].rect.x, 88);
assert.equal(game.runtime.assets.containerFrames[1].texture, texture);
for (let index = 0; index < PALETTE.length; index++) {
  game.runtime.containers.applyContainerMaterial(slot.sprite, index);
  assert.equal(slot.sprite.spriteFrame, game.runtime.assets.containerFrames[0]);
  assert.equal(slot.sprite.color.b, parseInt(PALETTE[index].slice(5, 7), 16));
  assert.equal(
    game.runtime.containers.containerDetails.get(slot.sprite).spriteFrame,
    game.runtime.assets.containerFrames[1],
  );
}
assert.equal(slot.body.commands.length, 0);
assert.equal(slot.label.enableOutline, false);
assert.ok(
  game.runtime.queue.cardViews
    .filter((c) => c.node.active)
    .every(
      (c) =>
        c.sprite.spriteFrame.texture === texture &&
        c.art.commands.every((p) => p.kind === 'ellipse'),
    ),
);
const digits = { name: 'clean digits' },
  mainFont = { name: 'outlined UI' };
resourceLoads.get('fonts/container-digits')(null, digits);
resourceLoads.get('fonts/ant-nest-bitmap')(null, mainFont);
assert.equal(slot.label.font, digits, 'late loading UI font must not replace the clean digit font');
assert.ok(game.runtime.queue.cardViews.every((c) => c.label.font === digits));
assert.equal(slot.label.fontSize, 32);
const sounds = [];
const originalPlay = game.runtime.audio.play;
game.runtime.audio.play = (name) => sounds.push(name);
setup(1);
game.update(0.02);
assert.equal(game.runtime.session.model.slots[0], null);
assert.equal(game.runtime.containers.slotLabels[0].string, '');
assert.equal(
  game.runtime.containers.slotViews[0].container.active,
  false,
  'the last departure immediately removes the container',
);
assert.equal(game.runtime.containers.slotViews[0].launchElapsed, -1);
assert.equal(
  game.runtime.flights.flights.length,
  1,
  'the final ant continues after its container disappears',
);
assert.deepEqual(sounds, [], 'container removal is silent');
game.runtime.audio.play = originalPlay;
for (let i = 0; i < 6; i++) game.update(0.05);
assert.equal(game.runtime.containers.slotViews[0].container.active, false);
assert.equal(game.runtime.containers.slotLabels[0].string, '');
setup(1);
game.update(0.02);
game.runtime.session.model.place(game.runtime.session.model.queue[0].id);
game.runtime.containers.drawSlots();
assert.equal(game.runtime.containers.slotViews[0].launchElapsed, -1);
assert.equal(game.runtime.containers.slotViews[0].container.scale.y, 1);
assert.equal(
  game.runtime.containers.slotLabels[0].string,
  '1',
  'reusing the freed slot shows the new container immediately',
);
for (const speed of [1, 2]) {
  setup();
  game.runtime.session.speed = speed;
  game.update(0.02);
  for (let i = 0; i < Math.ceil(0.3 / (0.02 * speed)); i++) game.update(0.02);
  assert.equal(game.runtime.containers.slotViews[0].launchElapsed, -1);
  assert.equal(game.runtime.containers.slotViews[0].container.scale.y, 1);
}
setup();
game.update(0.02);
game.runtime.session.startLevel(0);
assert.ok(
  game.runtime.containers.slotViews.every(
    (s) => s.launchElapsed === -1 && s.container.scale.y === 1,
  ),
);
// Selected side-hop: exercise actual touch placement, independent exit visuals,
// pause/resume and reuse rather than only sampling the animation equations.
const prepareMotion = (capacity = 1) => {
  game.runtime.session.startLevel(0);
  game.runtime.session.model = new GardenModel({
    name: 'side hop',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels: Array(PIXEL_COUNT).fill(0),
    capacity,
  });
  game.runtime.containers.drawSlots();
  game.runtime.queue.drawQueue();
};
prepareMotion();
let card = game.runtime.queue.cardViews.find((c) => c.node.active && c.row === 0);
card.node.emit('start');
game.update(0.04);
assert.ok(card.motion.angle > 0, 'selection tilts the container');
assert.ok(card.motion.position.y > 0, 'selection lifts the container');
card.node.emit('cancel');
assert.equal(card.motion.angle, 0);
assert.equal(card.motion.position.y, 0);
assert.equal(game.runtime.session.model.moves, 0, 'cancelled selection does not place');
card.node.emit('start');
card.node.emit('end');
assert.equal(game.runtime.session.model.moves, 1);
assert.equal(slot.entryElapsed, 0);
assert.equal(slot.container.position.x, -30);
assert.equal(slot.opacity.opacity, 0);
card.node.emit('end');
assert.equal(game.runtime.session.model.moves, 1, 'duplicate release cannot place again');
game.update(0.05);
assert.equal(game.runtime.flights.flights.length, 0, 'ants wait until the container lands');
const entryFrozen = [slot.entryElapsed, slot.container.position.x, slot.opacity.opacity];
game.runtime.lifecycle.hideHandler();
game.update(0.05);
assert.deepEqual([slot.entryElapsed, slot.container.position.x, slot.opacity.opacity], entryFrozen);
game.runtime.lifecycle.showHandler();
for (let i = 0; i < 8; i++) game.update(0.05);
assert.equal(slot.entryElapsed, -1);
assert.equal(game.runtime.session.model.slots[0], null);
assert.equal(slot.container.active, false);
assert.equal(slot.label.string, '');
assert.equal(slot.exit.active, true, 'numberless exit plays after the slot is freed');
assert.equal(slot.exit.getComponent(cc.Label), null);
assert.equal(
  slot.exit.children.some((n) => n.getComponent(cc.Label)),
  false,
);
assert.equal(game.runtime.flights.flights.length, 1);
const exitNode = slot.exit;
card = game.runtime.queue.cardViews.find((c) => c.node.active && c.row === 0);
card.node.emit('start');
card.node.emit('end');
const replacementId = slot.id;
assert.ok(replacementId >= 0);
assert.equal(slot.entryElapsed, 0);
assert.equal(slot.exit, exitNode);
assert.equal(slot.exit.active, true);
assert.equal(slot.label.string, '1', 'replacement has its own count');
game.update(0.05);
assert.ok(slot.exit.position.x > 0 && slot.exit.position.y > 0, 'exit hops up and right');
assert.ok(slot.exit.angle < 0 && slot.exit.scale.x < 1);
const exitFrozen = [slot.exitElapsed, slot.exit.position.x];
game.runtime.lifecycle.hideHandler();
game.update(0.05);
assert.deepEqual([slot.exitElapsed, slot.exit.position.x], exitFrozen);
game.runtime.lifecycle.showHandler();
for (let i = 0; i < 4; i++) game.update(0.05);
assert.equal(slot.exit.active, false);
assert.equal(slot.id, replacementId);
assert.equal(slot.container.active, true, 'old exit completion must not hide the replacement');
game.runtime.session.startLevel(0);
assert.ok(
  game.runtime.containers.slotViews.every(
    (v) =>
      v.entryElapsed === -1 &&
      v.exitElapsed === -1 &&
      !v.exit.active &&
      v.container.angle === 0 &&
      v.opacity.opacity === 255,
  ),
);
assert.ok(
  game.runtime.queue.cardViews.every((c) => c.selectElapsed === -1 && c.motion.angle === 0),
);
for (const speed of [1, 2]) {
  prepareMotion(10);
  game.runtime.session.speed = speed;
  card = game.runtime.queue.cardViews.find((c) => c.node.active && c.row === 0);
  card.node.emit('start');
  card.node.emit('end');
  for (let i = 0; i < 7; i++) game.update(0.05);
  assert.equal(game.runtime.flights.flights.length, 0);
  for (let i = 0; i < 2; i++) game.update(0.05);
  assert.equal(slot.entryElapsed, -1);
  assert.equal(slot.container.angle, 0);
  assert.equal(game.runtime.flights.flights.length, 1, 'both speeds launch after landing');
}
console.log(
  'Side-hop selection, entry, silent numberless exit, pause, immediate reuse and restart passed.',
);
const trayTextures = [];
for (const [name, width, height] of [
  ['wood', 204, 178],
  ['acorn', 100, 81],
  ['garden-background', 384, 576],
]) {
  const trayTexture = new Texture2D();
  trayTexture.width = width;
  trayTexture.height = height;
  resourceLoads.get(`trays/${name}/texture`)(null, trayTexture);
  trayTextures.push(trayTexture);
}
assert.equal(game.runtime.layout.traySprites.length, 4);
const woodSprites = game.runtime.layout.traySprites.filter((sprite) => sprite.node.name === 'wood');
assert.equal(woodSprites[0].spriteFrame, woodSprites[1].spriteFrame);
assert.ok(game.runtime.layout.traySprites.every((sprite) => sprite.spriteFrame));
const trayFrames = game.runtime.assets.trayFrames.slice();
const nestTexture = new Texture2D();
nestTexture.width = 416;
nestTexture.height = 60;
resourceLoads.get('trays/wood-hole/texture')(null, nestTexture);
assert.equal(
  game.runtime.layout.nestArt.commands.length,
  0,
  'loaded wooden nest replaces the old flat ellipses',
);
assert.equal(game.runtime.layout.nestSprite.spriteFrame, game.runtime.assets.nestFrames[0]);
const { NEST } = load(process.cwd() + '/assets/scripts/presentation/boardLayout.ts');
assert.equal(game.runtime.layout.nestSprite.node.position.x - 52 + 46, NEST.x);
assert.equal(game.runtime.layout.nestSprite.node.position.y + 30 - 22, NEST.y);
game.runtime.profile.save.nest = 'moss';
game.runtime.layout.drawNest();
assert.equal(game.runtime.layout.nestSprite.spriteFrame, game.runtime.assets.nestFrames[1]);
const nestFrames = game.runtime.assets.nestFrames.slice();
const frames = game.runtime.assets.containerFrames.slice();
game.onDestroy();
assert.equal(nestTexture.refs, 0);
assert.ok(nestFrames.every((frame) => frame.destroyed));
assert.ok(trayTextures.every((texture) => texture.refs === 0));
assert.ok(trayFrames.every((frame) => frame.destroyed));
assert.equal(texture.refs, 0);
assert.ok(frames.every((f) => f.destroyed));
console.log(
  'Top exit, recoil, pause, 2x, final shot, immediate reuse, restart and texture lifecycle passed.',
);

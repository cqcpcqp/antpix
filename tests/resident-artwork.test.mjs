import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { load, cc, Texture2D, resourceLoads } = require('../scripts/headless-game.cjs');
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
const { DOORSTEP_Y } = load(process.cwd() + '/assets/scripts/domain/courtyard/courtyardLife.ts');

function findNode(node, name) {
  if (node.name === name) return node;
  for (const child of node.children) {
    const match = findNode(child, name);
    if (match) return match;
  }
}

test('Lili keeps standing proportions and briefly blinks at rest', () => {
  const { animations } = require('../assets/resources/home/lili.json');
  const breathing = animations.rest.bones.body.scale;
  for (const key of [breathing[0], breathing.at(-1)]) {
    assert.equal(key.x, 1);
    assert.equal(key.y, 1);
  }
  assert.ok(breathing.every(({ y }) => y >= 1 && y <= 1.03));
  const [start, blink, reopen] = animations.rest.slots.skin.attachment;
  assert.deepEqual(start, { time: 0, name: 'open' });
  assert.equal(blink.name, 'closed');
  assert.ok(blink.time >= 1);
  assert.equal(reopen.name, 'open');
  assert.ok(reopen.time > blink.time && reopen.time - blink.time <= 0.2);
  assert.ok(reopen.time <= 1.8);
});

test('the parts-based rig keeps Lili at walking height when she stops on the path', () => {
  const game = new PixelGarden();
  game.onLoad();
  const { courtyard } = game.runtime;
  resourceLoads.get('home/resident-rig/texture')(null, new Texture2D());
  const life = courtyard.courtyardLife;
  life.x = 513;
  life.y = 864;
  life.move('walk', 530, life.y);
  const view = courtyard.courtyardResident;
  const torso = findNode(findNode(view.root, 'Resident pose'), 'Thorax joint');
  game.update(1 / 60);
  const walkingHeight = view.root.position.y + torso.position.y * view.artScale;
  for (let frame = 0; frame < 160; frame++) {
    game.update(1 / 60);
    const height = view.root.position.y + torso.position.y * view.artScale;
    assert.ok(Math.abs(height - walkingHeight) < 2 * view.artScale);
  }
  assert.equal(life.action, 'rest');
  game.onDestroy();
});

test('Lili uses one shared Spine skin and advances reactions only on courtyard ticks', () => {
  const game = new PixelGarden();
  game.onLoad();
  const { courtyard, lifecycle, profile } = game.runtime;
  profile.save.pets.residents[0].fedUntil = Date.now() + 3600000;
  resourceLoads.get('home/resident-rig/texture')(null, new Texture2D());
  const data = new cc.sp.SkeletonData();
  resourceLoads.get('home/lili')(null, data);
  const queen = courtyard.courtyardResident;
  const skin = (node) => findNode(node, 'Resident weighted mesh').getComponent(cc.sp.Skeleton);
  const rig = skin(findNode(queen.root, 'Resident pose'));
  assert.equal(rig.skeletonData, data);
  assert.equal(skin(findNode(queen.root, 'Resident water reflection')).skeletonData, data);
  courtyard.courtyardLife.y = DOORSTEP_Y - 1;
  courtyard.courtyardLife.stay('emerge', 2);
  queen.render(courtyard.courtyardLife, false);
  assert.equal(queen.root.parent.name, 'Resident doorway');
  courtyard.courtyardLife.y = 836;
  courtyard.courtyardLife.stay('rest', 3);
  game.update(1 / 60);
  queen.root.emit('end');
  for (let i = 0; i < 16; i++) game.update(1 / 60);
  findNode(findNode(courtyard.courtyardNode, 'Resident arc'), 'Resident pet').emit('end');
  game.update(0.03);
  assert.equal(rig.animation, 'pet');
  assert.equal(rig.loop, false);
  assert.equal(rig.lastStep, 0.03);
  assert.equal(rig.paused, true);
  lifecycle.paused = true;
  game.update(0.04);
  assert.equal(rig.lastStep, 0.03);
  game.onDestroy();
  assert.equal(data.refs, 0);
});

test('all resident joints are clipped by the arch until the feet cross the doorstep', () => {
  const game = new PixelGarden();
  game.onLoad();
  const { courtyard } = game.runtime;
  resourceLoads.get('home/resident-rig/texture')(null, new Texture2D());
  const doorway = findNode(courtyard.courtyardNode, 'Resident doorway');
  const outside = findNode(courtyard.courtyardNode, 'Residents outside');
  assert.equal(doorway.getComponent(cc.Mask).type, cc.Mask.Type.GRAPHICS_STENCIL);
  assert.equal(doorway.getComponent(cc.Graphics).commands[0].kind, 'polygon');
  const view = courtyard.courtyardResident;
  const life = courtyard.courtyardLife;
  life.stay('emerge', 2);
  life.y = DOORSTEP_Y - 1;
  view.render(life, false);
  assert.equal(view.root.parent, doorway);
  assert.ok(findNode(view.root, 'Resident antennaNear'));
  assert.equal(view.canInteract, false);
  const rig = findNode(view.root, 'Resident pose');
  const doorScale = rig.scale.y;
  life.y = DOORSTEP_Y;
  life.stay('walk', 2);
  view.render(life, false);
  assert.equal(view.root.parent, outside);
  assert.equal(doorway.children.includes(view.root), false);
  assert.equal(view.canInteract, true);
  assert.equal(rig.scale.y, doorScale);
  life.y = DOORSTEP_Y + 65;
  view.render(life, false);
  assert.equal(rig.scale.y, view.artScale);
  life.y = DOORSTEP_Y - 1;
  life.stay('enter', 2);
  view.render(life, false);
  assert.equal(view.root.parent, doorway);
  game.onDestroy();
});

test('queen artwork shares its atlas with the reflection and responds to petting', () => {
  const game = new PixelGarden();
  game.onLoad();
  const { courtyard, profile } = game.runtime;
  profile.save.pets.residents[0].fedUntil = Date.now() + 3600000;
  const texture = new Texture2D();
  resourceLoads.get('home/resident-rig/texture')(null, texture);
  const queen = courtyard.courtyardResident;
  const body = findNode(queen.root, 'Resident pose');
  const reflection = findNode(queen.root, 'Resident water reflection');
  const face = findNode(body, 'Resident head');
  const closed = findNode(body, 'Resident closed');
  const frame = (node) => node.getComponent(cc.Sprite).spriteFrame;
  assert.equal(frame(face), frame(findNode(reflection, 'Resident head')));
  const paw = findNode(body, 'Resident paw');
  assert.equal(frame(paw).rect.y, 198);
  const neck = face.parent;
  assert.ok(neck.getSiblingIndex() > findNode(body, 'Resident torso').getSiblingIndex());
  assert.ok(neck.getSiblingIndex() < paw.parent.parent.getSiblingIndex());
  assert.equal(texture.refs, 1);
  courtyard.courtyardLife.x = 513;
  courtyard.courtyardLife.y = 834;
  courtyard.courtyardLife.activity = 'look';
  courtyard.courtyardLife.stay('rest', 10);
  game.update(1 / 60);
  assert.equal(face.active, true);
  queen.root.emit('end');
  const menu = findNode(courtyard.courtyardNode, 'Resident arc');
  for (let i = 0; i < 16; i++) game.update(1 / 60);
  findNode(menu, 'Resident pet').emit('end');
  for (let index = 0; index < 12; index++) game.update(1 / 60);
  assert.equal(closed.active, true);
  assert.equal(face.active, false);
  for (let index = 0; index < 90; index++) game.update(1 / 60);
  assert.equal(face.active, true);
  game.onDestroy();
  assert.equal(frame(face).destroyed, true);
  assert.equal(texture.refs, 0);
});

test('the icon-only resident arc opens renaming and feeds without a drawer', () => {
  const game = new PixelGarden();
  game.onLoad();
  const { courtyard, overlays, profile } = game.runtime;
  const queen = profile.save.pets.residents[0];
  queen.fedUntil = Date.now() + 30 * 3600000;
  for (let i = 0; i < 180; i++) game.update(1 / 60);
  const openArc = () =>
    courtyard.courtyardNode.children
      .find((node) => node.name === 'Resident interactions')
      .children.findLast((node) => node.active && node.name === 'Resident arc');
  courtyard.courtyardResident.root.emit('end');
  const buttons = () => openArc().children;
  const settle = () => {
    for (let i = 0; i < 16; i++) game.update(1 / 60);
  };
  assert.ok(buttons().every((node) => !node.active));
  game.update(1 / 60);
  assert.deepEqual(
    buttons().map((node) => node.active),
    [true, false, false],
  );
  settle();
  assert.ok(buttons().every((node) => node.active && node.scale.x === 1));
  assert.deepEqual(
    buttons().map((node) => node.name),
    ['Resident feed', 'Resident pet', 'Resident info'],
  );
  const [feedIcon, patIcon, infoIcon] = buttons();
  const rowSpacing = game.runtime.lifecycle.touchSize + 4;
  assert.equal(feedIcon.position.y - patIcon.position.y, rowSpacing);
  assert.equal(patIcon.position.y - infoIcon.position.y, rowSpacing);
  assert.equal(feedIcon.position.x, infoIcon.position.x);
  assert.ok(
    buttons().every(
      (node) => node.children.length === 1 && node.children[0].getComponent(cc.Graphics),
    ),
  );
  buttons()
    .find((node) => node.name === 'Resident info')
    .emit('end');
  const card = () => findNode(courtyard.courtyardNode, 'Resident care card');
  assert.equal(findNode(card(), 'Resident health').getComponent(cc.Label).string, '100');
  assert.equal(findNode(card(), 'Resident mood').getComponent(cc.Label).string, '60');
  assert.ok(Number(findNode(card(), 'Resident satiety').getComponent(cc.Label).string) > 0);
  findNode(card(), 'Resident rename').emit('end');
  const editor = overlays.modal.children
    .find((node) => node.name === 'Resident name input')
    .getComponent(cc.EditBox);
  assert.equal(editor.string, queen.name);
  editor.string = '小栗';
  overlays.modal.children.find((node) => node.name === '保存').emit('end');
  assert.equal(queen.name, '小栗');
  assert.equal(overlays.modal, null);
  findNode(card(), 'Close resident care').emit('end');
  settle();
  openArc()
    .children.find((node) => node.name === 'Resident feed')
    .emit('end');
  assert.deepEqual(
    buttons().map((node) => node.name),
    ['Resident ration', 'Resident melon'],
  );
  settle();
  assert.ok(
    buttons().every(
      (node) => node.children.length === 1 && node.children[0].getComponent(cc.Graphics),
    ),
  );
  openArc()
    .children.find((node) => node.name === 'Resident ration')
    .emit('end');
  assert.equal(queen.rationDay, game.runtime.cloud.rewardDay());
  assert.equal(openArc(), undefined);
  assert.equal(overlays.modal, null);
  game.onDestroy();
});

test('cloud petting saves quietly and still offers retry after a connection failure', async () => {
  const game = new PixelGarden();
  game.onLoad();
  const { cloud, cloudStatus, courtyard, home, profile } = game.runtime;
  Object.assign(cloud, { cloudMode: true, cloudReady: true });
  let settle;
  cloud.cloud = {
    mutate(action, input) {
      assert.equal(action, 'pet');
      assert.equal(input.operation, 'pat');
      return new Promise((resolve, reject) => {
        settle = { resolve, reject };
      });
    },
  };
  const life = courtyard.courtyardLife;
  life.y = 864;
  life.stay('rest', 20);
  game.update(1 / 60);
  courtyard.courtyardResident.root.emit('end');
  for (let i = 0; i < 16; i++) game.update(1 / 60);
  findNode(courtyard.courtyardNode, 'Resident pet').emit('end');
  assert.equal(cloud.cloudBusy, true);
  assert.equal(cloudStatus.cloudStatus, null);
  assert.equal(home.homeRewardButton.active, true);
  settle.reject(new Error('test connection failure'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(cloudStatus.cloudStatus);
  cloudStatus.cloudStatus.emit('end');
  assert.equal(cloudStatus.cloudStatus, null);
  const updated = structuredClone(profile.save);
  updated.pets.residents[0].care.mood = 68;
  settle.resolve({ profile: updated, highest: 0, reachedAt: 0, serverTime: Date.now() });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cloud.cloudBusy, false);
  assert.equal(cloudStatus.cloudStatus, null);
  assert.equal(profile.save.pets.residents[0].care.mood, 68);
  assert.ok(findNode(courtyard.courtyardNode, 'Resident reaction'));
  game.onDestroy();
});

test('Lili eats once, finishes her Spine reaction and resumes the same walk', () => {
  const game = new PixelGarden();
  game.onLoad();
  const { courtyard, profile, pets } = game.runtime;
  profile.save.pets.melons = 2;
  profile.save.pets.residents[0].fedUntil = Date.now() + 30 * 3600000;
  resourceLoads.get('home/resident-rig/texture')(null, new Texture2D());
  const data = new cc.sp.SkeletonData();
  resourceLoads.get('home/lili')(null, data);
  const life = courtyard.courtyardLife;
  life.x = 345;
  life.y = 825;
  life.move('walk', life.x + 160, life.y + 25);
  const tick = (count) => {
    for (let index = 0; index < count; index++) game.update(1 / 60);
  };
  tick(15);
  const view = courtyard.courtyardResident;
  const rig = findNode(view.root, 'Resident pose');
  const skeleton = findNode(rig, 'Resident weighted mesh').getComponent(cc.sp.Skeleton);
  const layer = findNode(courtyard.courtyardNode, 'Resident interactions');
  const arc = () => layer.children.findLast((node) => node.active && node.name === 'Resident arc');
  assert.equal(skeleton.skeletonData, data);
  assert.equal(skeleton.animation, 'walk');
  view.root.emit('end');
  tick(16);
  findNode(arc(), 'Resident feed').emit('end');
  tick(16);
  arc()
    .children.find((node) => node.name === 'Resident melon')
    .emit('end');

  assert.equal(profile.save.pets.melons, 1);
  const anchor = life.x;
  const food = findNode(rig, 'Resident food melon');
  const bowl = findNode(rig, 'Resident food bowl');
  const crumb = findNode(rig, 'Resident crumb');
  tick(56);
  assert.equal(skeleton.animation, 'eat');
  assert.equal(skeleton.lastBone, 'mouth');
  assert.ok(bowl.active && food.active);
  const portion = food.scale.x;
  tick(7);
  assert.ok(crumb.active && food.scale.x < portion);
  assert.equal(life.x, anchor);
  view.root.emit('end');
  assert.equal(arc(), undefined);
  tick(150);
  assert.ok(!bowl.active && !food.active && !crumb.active);
  assert.ok(life.x > anchor && !pets.isEating());
  assert.equal(profile.save.pets.melons, 1);
  game.onDestroy();
  assert.equal(data.refs, 0);
});

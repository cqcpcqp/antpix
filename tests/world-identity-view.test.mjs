import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');

function fixture() {
  const loads = [],
    labels = [],
    sprites = [],
    cleanups = [];
  let released = 0;
  class Texture2D {
    destroy() {
      released++;
    }
  }
  class SpriteFrame {
    destroy() {
      released++;
    }
  }
  class Sprite {
    static SizeMode = { CUSTOM: 0 };
  }
  const cc = {
    assetManager: { loadRemote: (url, options, complete) => loads.push({ url, complete }) },
    Texture2D,
    SpriteFrame,
    Sprite,
    Node: { EventType: { NODE_DESTROYED: 'destroyed' } },
  };
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(readFileSync('assets/scripts/features/home/WorldIdentity.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    { module, exports: module.exports, console, require: (name) => (name === 'cc' ? cc : {}) },
  );
  const parent = { isValid: true };
  const game = {
    overlays: { modal: parent },
    ui: {
      text: (_parent, string) => {
        const label = { string };
        labels.push(label);
        return label;
      },
      node2d: () => ({
        addComponent: () => {
          const sprite = {};
          sprites.push(sprite);
          return sprite;
        },
        on: (_event, callback) => cleanups.push(callback),
      }),
    },
  };
  return {
    game,
    parent,
    loads,
    labels,
    sprites,
    cleanups,
    released: () => released,
    draw: module.exports.drawWorldPlayer,
  };
}
const row = {
  rank: 1,
  player: '蚂蚁123',
  highest: 12,
  reachedAt: 1,
  self: true,
  identity: { nickname: '名字🙂', avatarUrl: 'https://thirdwx.qlogo.cn/avatar/132' },
};

test('world rows render authorized names with system glyphs and release avatar resources', () => {
  const f = fixture();
  f.draw(f.game, f.parent, row, 0);
  assert.equal(f.labels[1].string, '名字🙂');
  assert.equal(f.labels[1].useSystemFont, true);
  assert.equal(f.loads[0].url, row.identity.avatarUrl);
  let references = 0;
  f.loads[0].complete(null, { addRef: () => references++, decRef: () => references-- });
  assert.equal(references, 1);
  assert.ok(f.sprites[0].spriteFrame);
  f.cleanups[0]();
  assert.equal(references, 0);
  assert.equal(f.released(), 2);
});

test('anonymous rows do not load images and late avatars cannot populate a closed board', () => {
  const f = fixture();
  f.draw(f.game, f.parent, { ...row, identity: null }, 0);
  assert.equal(f.labels[1].string, '我');
  assert.equal(f.loads.length, 0);
  f.draw(f.game, f.parent, row, 0);
  f.game.overlays.modal = {};
  let refs = 0;
  f.loads[0].complete(null, { addRef: () => refs++, decRef: () => refs-- });
  assert.equal(refs, 0, 'closed view must not retain image');
  assert.equal(f.sprites.length, 0);
});

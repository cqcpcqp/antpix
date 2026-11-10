import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import headless from '../scripts/headless-game.cjs';
import { STARTUP } from '../assets/scripts/presentation/startupLayout.ts';
const { cc, load } = headless;
const { StartupController } = load(process.cwd() + '/assets/scripts/app/StartupController.ts');

function fixture() {
  const callbacks = new Map();
  const original = cc.resources.load;
  cc.resources.load = (path, type, callback) => callbacks.set(path, callback);
  const frames = [];
  let shown = 0,
    closed = 0,
    homes = 0;
  const game = {
    host: { isValid: true },
    cloud: { cloudMode: true, cloudReady: false, cloudRetry: null, cloudMessage: '' },
    startupView: {
      show() {
        shown++;
      },
      refresh(progress, message) {
        frames.push({ progress, message });
      },
      close() {
        closed++;
      },
    },
    home: {
      showHome() {
        homes++;
      },
    },
  };
  const startup = new StartupController(game);
  startup.begin();
  return {
    game,
    startup,
    callbacks,
    frames,
    counts: () => ({ shown, closed, homes }),
    restore: () => {
      cc.resources.load = original;
    },
  };
}

test('startup waits for applied assets and login in either completion order', () => {
  for (const loginFirst of [true, false]) {
    const f = fixture();
    try {
      let applied = 0;
      f.startup.load('first', cc.Texture2D, () => applied++);
      f.startup.load('second', cc.Texture2D, () => applied++);
      f.startup.seal();
      if (loginFirst) {
        f.game.cloud.cloudReady = true;
        f.startup.refresh();
      }
      f.callbacks.get('first')(null, new cc.Texture2D());
      f.startup.update(1);
      assert.equal(f.startup.active, true);
      f.callbacks.get('second')(null, new cc.Texture2D());
      if (!loginFirst) {
        assert.equal(f.startup.progress, 90);
        assert.equal(f.frames.at(-1).message, STARTUP.syncing);
        f.startup.update(1);
        assert.equal(f.counts().closed, 0);
        f.game.cloud.cloudReady = true;
        f.startup.refresh();
      }
      assert.equal(applied, 2);
      assert.equal(f.startup.progress, 100);
      assert.equal(f.counts().closed, 0, '100% must have a visible frame');
      for (let i = 0; i < 4; i++) f.startup.update(0.05);
      assert.equal(f.startup.active, false);
      assert.deepEqual(f.counts(), { shown: 1, closed: 1, homes: 1 });
      assert.ok(
        f.frames.every((frame, i) => i === 0 || frame.progress >= f.frames[i - 1].progress),
      );
    } finally {
      f.restore();
    }
  }
});

test('startup retries only failed resources and keeps the same surface and progress', () => {
  const f = fixture();
  try {
    let applied = 0,
      cloudRetries = 0;
    f.startup.load('cached', cc.Texture2D, () => applied++);
    f.startup.load('failed', cc.Texture2D, () => {});
    f.startup.seal();
    f.callbacks.get('cached')(null, new cc.Texture2D());
    f.callbacks.get('failed')(new Error('download failed'));
    const progress = f.startup.progress;
    assert.equal(f.frames.at(-1).message, STARTUP.resourceError);
    f.game.cloud.cloudMessage = '连接未完成，点击重试';
    f.game.cloud.cloudRetry = () => {
      cloudRetries++;
    };
    f.startup.retry();
    assert.equal(applied, 1, 'successful texture application must not addRef twice');
    assert.equal(cloudRetries, 1);
    assert.equal(f.startup.progress, progress);
    assert.equal(f.counts().shown, 1);
    f.callbacks.get('failed')(null, new cc.Texture2D());
    assert.equal(f.frames.at(-1).message, f.game.cloud.cloudMessage);
    f.game.host.isValid = false;
    f.startup.destroy();
    const count = f.frames.length;
    f.callbacks.get('failed')(null, new cc.Texture2D());
    assert.equal(f.frames.length, count, 'destroyed startup ignores late resource callbacks');
  } finally {
    f.restore();
  }
});

test('synchronous cache hits cannot complete startup before all tasks are registered', () => {
  const f = fixture();
  try {
    cc.resources.load = (path, type, callback) => callback(null, new cc.Texture2D());
    f.game.cloud.cloudMode = false;
    for (const path of ['one', 'two', 'three']) {
      f.startup.load(path, cc.Texture2D, () => {});
      assert.equal(f.startup.progress, 30);
    }
    f.startup.seal();
    assert.equal(f.startup.progress, 100);
  } finally {
    f.restore();
  }
});

test('WeChat first screen retains the A1 layout and hands off at 30%, releasing GL resources', async () => {
  const calls = [],
    contexts = [];
  const gl = new Proxy(
    {},
    {
      get(target, key) {
        if (typeof key === 'string' && key === key.toUpperCase()) return key;
        if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
        if (key === 'getAttribLocation') return (program, name) => (name === 'uv' ? 1 : 0);
        if (key.startsWith('create')) return () => ({ kind: key });
        return (...args) => calls.push([key, ...args]);
      },
    },
  );
  const canvas = {
    width: 750,
    height: 1624,
    getContext(type) {
      contexts.push(type);
      return gl;
    },
  };
  const paintings = [];
  const module = { exports: {} };
  vm.runInNewContext(readFileSync('wechat/startup/first-screen.js', 'utf8'), {
    module,
    window: {},
    canvas,
    requestAnimationFrame: (done) => done(),
    wx: {
      getSystemInfoSync: () => ({ windowWidth: 375 }),
      createCanvas: () => ({ getContext: () => ({}) }),
      createImage: () => {
        const image = {};
        Object.defineProperty(image, 'src', {
          set() {
            image.onload();
          },
        });
        return image;
      },
    },
    require: (path) => {
      if (path.endsWith('painter'))
        return { paint: (ctx, surface, images, progress) => paintings.push(progress) };
      if (path.endsWith('layout.js')) return STARTUP;
      return { background: 'background.jpg', title: 'title.png' };
    },
  });
  const screen = module.exports;
  await screen.start();
  await screen.setProgress(0.6);
  await screen.setProgress(0.2);
  await screen.end();
  assert.deepEqual(contexts, ['webgl'], 'main canvas must remain WebGL for Cocos');
  assert.deepEqual(paintings, [0, 18, 18, 30]);
  for (const method of ['deleteTexture', 'deleteBuffer', 'deleteProgram'])
    assert.equal(calls.filter(([name]) => name === method).length, 1);
});

test('startup surface fits supported viewports and releases only its own gradient texture', () => {
  const original = cc.view.getFrameSize;
  const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
  try {
    for (const frame of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
    ]) {
      cc.view.getFrameSize = () => frame;
      const game = new PixelGarden();
      game.onLoad();
      const root = game.runtime.startupView.root;
      assert.ok(root.getComponent(cc.BlockInputEvents), 'loading must intercept homepage touches');
      const wash = root.children
        .find((child) => child.name === 'Startup footer wash')
        .getComponent(cc.Sprite).spriteFrame;
      assert.equal(wash.texture.width, 2);
      assert.equal(wash.texture.wrapT, cc.Texture2D.WrapMode.CLAMP_TO_EDGE);
      const texture = new cc.Texture2D();
      texture.width = 1024;
      texture.height = 1536;
      headless.resourceLoads.get('home/garden/texture')(null, texture);
      assert.equal(texture.refs, 1);
      const borrowed = game.runtime.assets.homeFrame;
      assert.equal(
        root.children.find((child) => child.name === 'Startup landscape').getComponent(cc.Sprite)
          .spriteFrame,
        borrowed,
      );
      for (const child of root.children) {
        const label = child.getComponent(cc.Label);
        if (!label) continue;
        const size = child.getComponent(cc.UITransform);
        assert.ok(
          Math.abs(child.position.x) + size.width / 2 <= game.runtime.lifecycle.screenWidth / 2,
        );
        assert.ok(
          Math.abs(child.position.y) + size.height / 2 <= game.runtime.lifecycle.screenHeight / 2,
        );
        assert.ok(
          !['小小蚂蚁，搬出大大快乐', '正在准备你的蚂蚁窝', '快乐，即将开工'].includes(
            label.string,
          ),
        );
      }
      assert.ok(
        root.children.some(
          (child) => child.getComponent(cc.Label)?.string === STARTUP.registration,
        ),
      );
      game.runtime.startupView.close();
      assert.equal(wash.destroyed, true);
      assert.equal(wash.texture.destroyed, true);
      assert.equal(borrowed.destroyed, undefined, 'the home frame belongs to lifecycle');
      assert.equal(texture.refs, 1);
      game.onDestroy();
      assert.equal(texture.refs, 0);
    }
  } finally {
    cc.view.getFrameSize = original;
  }
});

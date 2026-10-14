// Headless component checks; this mocks rendering and does not measure GPU/FPS.
const fs = require('fs'),
  vm = require('vm');
const resources =
  process.env.COCOS_RESOURCES ||
  '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources';
const ts = require(resources + '/app.asar.unpacked/node_modules/typescript');
const transformWrites = { position: 0, angle: 0, scale: 0 };
class Node {
  constructor(name) {
    this.name = name;
    this.children = [];
    this.components = [];
    this.events = {};
    this.position = { x: 0, y: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
    this._angle = 0;
    this.isValid = true;
    this.active = true;
  }
  set parent(p) {
    this._parent = p;
    p.children.push(this);
  }
  get parent() {
    return this._parent;
  }
  setPosition(x, y) {
    transformWrites.position++;
    this.position = { x, y };
  }
  get angle() {
    return this._angle;
  }
  set angle(value) {
    transformWrites.angle++;
    this._angle = value;
  }
  getComponent(C) {
    return this.components.find((c) => c instanceof C) || null;
  }
  setSiblingIndex() {}
  setScale(x, y, z) {
    transformWrites.scale++;
    this.scale = { x, y, z };
  }
  on(type, fn) {
    (this.events[type] ??= []).push(fn);
  }
  emit(type, event) {
    for (const fn of this.events[type] || []) fn(event);
  }
  addComponent(C) {
    if (
      (C === Sprite || C === Graphics) &&
      this.components.some((c) => c instanceof Sprite || c instanceof Graphics)
    )
      throw Error('Only one UI renderer is allowed per node, including deferred destruction');
    const c = new C();
    c.node = this;
    this.components.push(c);
    return c;
  }
  removeAllChildren() {
    this.children = [];
  }
  destroy() {}
}
Node.EventType = {
  TOUCH_START: 'start',
  TOUCH_END: 'end',
  TOUCH_CANCEL: 'cancel',
  TOUCH_MOVE: 'move',
};
class Color {
  constructor(r, g, b, a = 255) {
    if (typeof r === 'string') {
      this.r = parseInt(r.slice(1, 3), 16);
      this.g = parseInt(r.slice(3, 5), 16);
      this.b = parseInt(r.slice(5, 7), 16);
      this.a = 255;
    } else Object.assign(this, { r, g, b, a });
  }
}
class Graphics {
  destroy() {
    this.destroyed = true;
  }
  close() {
    if (this.polygon) {
      this.paths.push({ kind: 'polygon', p: this.polygon });
      this.polygon = null;
    }
  }
  constructor() {
    this.commands = [];
    this.paths = [];
  }
  moveTo(x, y) {
    this.polygon = [[x, y]];
  }
  lineTo(x, y) {
    if (this.polygon) this.polygon.push([x, y]);
  }
  clear() {
    this.commands = [];
    this.paths = [];
  }
  roundRect(...p) {
    this.paths.push({ kind: 'rect', p });
  }
  rect(...p) {
    this.roundRect(...p, 0);
  }
  circle(x, y, r) {
    this.ellipse(x, y, r, r);
  }
  ellipse(...p) {
    this.paths.push({ kind: 'ellipse', p });
  }
  fill() {
    this.commands.push(...this.paths.map((p) => ({ ...p, color: this.fillColor })));
    this.paths = [];
  }
  stroke() {
    this.commands.push(
      ...this.paths.map((p) => ({ ...p, color: this.strokeColor, stroke: this.lineWidth })),
    );
    this.paths = [];
  }
}
class Sprite {}
Sprite.SizeMode = { CUSTOM: 0 };
Sprite.Type = { SIMPLE: 0, SLICED: 1 };
class SpriteFrame {
  destroy() {
    this.destroyed = true;
  }
}
class Texture2D {
  refs = 0;
  addRef() {
    this.refs++;
  }
  decRef() {
    this.refs--;
  }
}
class Size {
  constructor(width, height) {
    Object.assign(this, { width, height });
  }
}
class Rect {
  constructor(x, y, width, height) {
    Object.assign(this, { x, y, width, height });
  }
}
const resourceLoads = new Map();
class Label {}
Label.HorizontalAlign = { CENTER: 0 };
Label.VerticalAlign = { CENTER: 0 };
Label.Overflow = { SHRINK: 0 };
class UITransform {
  setContentSize(width, height) {
    this.width = width;
    this.height = height;
  }
}
class Camera {}
Camera.ProjectionType = { ORTHO: 0 };
function Component() {
  this.node = new Node('Game');
  this.isValid = true;
  this.active = true;
}
class AudioSource {
  playing = false;
  play() {
    this.playing = true;
  }
  pause() {
    this.playing = false;
  }
  stop() {
    this.playing = false;
  }
  playOneShot() {}
}
const cc = {
  cclegacy: { _RF: { push() {}, pop() {} } },
  _decorator: { ccclass: () => (C) => C },
  Component,
  Node,
  Sprite,
  SpriteFrame,
  Texture2D,
  Rect,
  Size,
  SubContextView: class {},
  Canvas: class {},
  Camera,
  UITransform,
  Graphics,
  Color,
  Label,
  UIOpacity: class {
    opacity = 255;
  },
  Font: class {},
  Layers: { Enum: { UI_2D: 1 } },
  view: {
    getFrameSize() {
      return { width: 750, height: 1500 };
    },
    setDesignResolutionSize() {},
  },
  ResolutionPolicy: { SHOW_ALL: 0 },
  sys: {
    localStorage: {
      getItem(key) {
        return key === 'ant-controls-seen' ? '1' : null;
      },
      setItem() {},
    },
  },
  resources: {
    load(path, type, callback) {
      resourceLoads.set(path, callback);
    },
  },
  AudioClip: class {},
  AudioSource,
  game: { on() {}, off() {} },
  Game: {},
};
const built = process.env.CHECK_BUILT ? require('./load-built.cjs')(cc) : null;
const cache = {};
function load(path) {
  if (built) return built('chunks:///_virtual/' + require('path').basename(path));
  if (cache[path]) return cache[path];
  const module = { exports: {} };
  cache[path] = module.exports;
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      experimentalDecorators: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (n) =>
      n === 'cc' ? cc : load(require('path').resolve(require('path').dirname(path), n + '.ts')),
    console,
    Math,
  });
  return module.exports;
}

module.exports = {
  load,
  cc,
  Node,
  Graphics,
  Label,
  AudioSource,
  Sprite,
  Texture2D,
  resourceLoads,
  transformWrites,
};

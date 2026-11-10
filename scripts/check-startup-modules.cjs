// WeChat's script require appends .js; unlike Node, it does not decode JSON modules.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const vm = require('node:vm');

function checkStartupModules(root) {
  const cache = new Map();
  function load(file) {
    const path = resolve(root, file.endsWith('.js') ? file : file + '.js');
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} };
    cache.set(path, module);
    vm.runInNewContext(
      readFileSync(path, 'utf8'),
      {
        module,
        require: (request) => {
          assert.ok(request.startsWith('.'), `Unexpected startup dependency: ${request}`);
          return load(resolve(dirname(path), request));
        },
      },
      { filename: path },
    );
    return module.exports;
  }
  const screen = load('first-screen.js');
  for (const method of ['start', 'setProgress', 'end'])
    assert.equal(typeof screen[method], 'function', `Missing first screen API: ${method}`);
  return { screen, layout: load('startup/layout.js'), artwork: load('startup/assets.js') };
}
module.exports = { checkStartupModules };

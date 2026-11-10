import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { installStartup } from '../scripts/install-startup.mjs';
import { STARTUP } from '../assets/scripts/presentation/startupLayout.ts';
const require = createRequire(import.meta.url);
const { checkStartupModules } = require('../scripts/check-startup-modules.cjs');

function withPackage(run) {
  const root = mkdtempSync(resolve(tmpdir(), 'antpix-startup-'));
  mkdirSync(resolve(root, 'startup'));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('WeChat module check reproduces the JSON require startup crash', () => {
  withPackage((root) => {
    writeFileSync(
      resolve(root, 'first-screen.js'),
      "module.exports = require('./startup/painter');",
    );
    writeFileSync(
      resolve(root, 'startup/painter.js'),
      "module.exports = require('./layout.json');",
    );
    writeFileSync(resolve(root, 'startup/layout.json'), '{}');
    assert.throws(() => checkStartupModules(root), /layout\.json\.js/);
  });
});

test('installed startup loads actual dependency modules under WeChat script resolution', () => {
  withPackage((root) => {
    mkdirSync(resolve(root, 'src'));
    writeFileSync(
      resolve(root, 'src/settings.json'),
      JSON.stringify({ splashScreen: { totalTime: 3000, logo: { type: 'default' } } }),
    );
    for (const source of ['assets/resources/home/garden.jpg', 'assets/resources/home/title.png']) {
      const { uuid } = JSON.parse(readFileSync(source + '.meta', 'utf8'));
      const directory = resolve(root, 'assets/resources/native', uuid.slice(0, 2));
      mkdirSync(directory, { recursive: true });
      writeFileSync(resolve(directory, uuid + source.slice(source.lastIndexOf('.'))), '');
    }
    for (const name of ['layout', 'assets'])
      writeFileSync(resolve(root, `startup/${name}.json`), '{}');
    const legacyImage = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    );
    for (const name of ['logo.png', 'slogan.png']) writeFileSync(resolve(root, name), legacyImage);
    installStartup(root);
    for (const name of ['logo.png', 'slogan.png'])
      assert.deepEqual(
        readFileSync(resolve(root, name)),
        legacyImage,
        'WeChat upload must retain generated startup images',
      );
    const settings = JSON.parse(readFileSync(resolve(root, 'src/settings.json'), 'utf8'));
    assert.equal(settings.splashScreen.totalTime, 0);
    assert.equal(settings.splashScreen.logo.type, 'none');
    const { screen, layout, artwork } = checkStartupModules(root);
    assert.equal(typeof screen.start, 'function');
    assert.deepEqual(JSON.parse(JSON.stringify(layout)), STARTUP);
    for (const path of Object.values(artwork)) assert.ok(existsSync(resolve(root, path)));
    assert.equal(existsSync(resolve(root, 'startup/layout.json')), false);
    assert.equal(existsSync(resolve(root, 'startup/assets.json')), false);
    installStartup(root);
    assert.equal(checkStartupModules(root).layout.registration, STARTUP.registration);
  });
});

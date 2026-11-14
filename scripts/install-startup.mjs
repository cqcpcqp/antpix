import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { STARTUP } from '../assets/scripts/presentation/startupLayout.ts';

/** Keep the first screen drawable before the resource subpackage is downloaded. */
export function installStartup(root = resolve('build/wechatgame')) {
  const native = resolve(root, 'subpackages/resources/native');
  const files = readdirSync(native, { recursive: true });
  mkdirSync(resolve(root, 'startup/artwork'), { recursive: true });
  const artwork = (source) => {
    const { uuid } = JSON.parse(readFileSync(source + '.meta', 'utf8'));
    const matches = files.filter((file) =>
      file
        .split('/')
        .pop()
        .startsWith(uuid + '.'),
    );
    assert.equal(matches.length, 1, `Expected one emitted startup texture: ${source}`);
    const path = 'startup/artwork/' + source.split('/').pop();
    cpSync(resolve(native, matches[0]), resolve(root, path));
    return path;
  };
  const paths = {
    background: artwork('assets/resources/home/garden.jpg'),
    title: artwork('assets/resources/home/title.png'),
  };
  mkdirSync(resolve(root, 'startup'), { recursive: true });
  cpSync('wechat/startup/painter.js', resolve(root, 'startup/painter.js'));
  cpSync('wechat/startup/first-screen.js', resolve(root, 'first-screen.js'));
  // WeChat require loads scripts only; data must be exported by real JS modules.
  for (const [name, data] of [
    ['assets', paths],
    ['layout', STARTUP],
  ]) {
    writeFileSync(
      resolve(root, `startup/${name}.js`),
      `module.exports = ${JSON.stringify(data)};\n`,
    );
    rmSync(resolve(root, `startup/${name}.json`), { force: true });
  }
  const settingsPath = resolve(root, 'src/settings.json');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  settings.splashScreen.totalTime = 0;
  settings.splashScreen.logo = { type: 'none' };
  writeFileSync(settingsPath, JSON.stringify(settings));
  // Keep Creator's logo.png and slogan.png: WeChat's device upload can still read
  // these generated files after the first screen changes. Display is disabled above.
}

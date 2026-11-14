import { installStartup } from './install-startup.mjs';
import wechatPackage from './wechat-package.cjs';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const creator =
  process.env.COCOS_CREATOR ||
  '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator';
const cloudPrep = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--import',
    './scripts/register-typescript.mjs',
    'scripts/prepare-cloud.mjs',
  ],
  { stdio: 'inherit' },
);
if (cloudPrep.status !== 0) process.exit(cloudPrep.status ?? 1);
if (!existsSync(creator)) {
  console.error('请通过 COCOS_CREATOR 指定 CocosCreator 可执行文件');
  process.exit(1);
}
const existingConfig = resolve('build/wechatgame/project.config.json');
const existingAppid = existsSync(existingConfig)
  ? JSON.parse(readFileSync(existingConfig, 'utf8')).appid
  : undefined;
const appid =
  process.env.WECHAT_APPID || (existingAppid !== 'touristappid' ? existingAppid : undefined);
if (!appid)
  console.log(
    '尚未设置 WECHAT_APPID：构建供本地导入，微信真机预览前需在开发者工具填写自己的 AppID。',
  );
mkdirSync('temp', { recursive: true });
const config = {
  name: JSON.parse(readFileSync('package.json', 'utf8')).name,
  platform: 'wechatgame',
  buildPath: 'project://build',
  debug: false,
  startScene: '11fcb94f-5e35-4cc7-8d90-b131a8958ac1',
  scenes: [{ url: 'db://assets/scenes/Main.scene', uuid: '11fcb94f-5e35-4cc7-8d90-b131a8958ac1' }],
  packages: { wechatgame: { appid: appid || '', orientation: 'portrait' } },
};
const configPath = resolve('temp/build-wechat.json');
writeFileSync(configPath, JSON.stringify(config, null, 2));
// Bundle layout changes must not leave old main-package copies in the upload.
rmSync('build/wechatgame', { recursive: true, force: true });
const result = spawnSync(
  creator,
  ['--project', process.cwd(), '--build', `configPath=${configPath}`],
  { stdio: 'inherit' },
);
if (result.status === 0 || result.status === 36) {
  const path = resolve('build/wechatgame/project.config.json');
  const project = JSON.parse(readFileSync(path, 'utf8'));
  project.appid = appid || 'touristappid';
  project.projectname = '生态蚂蚁窝';
  project.description = '生态蚂蚁窝 · 微信小游戏';
  project.cloudfunctionRoot = '../../cloudfunctions/';
  writeFileSync(path, JSON.stringify(project, null, 2));
  // Remove obsolete friend data from incremental builds as well.
  rmSync('build/wechatgame/open-data', { recursive: true, force: true });
  const gamePath = resolve('build/wechatgame/game.json');
  const gameConfig = JSON.parse(readFileSync(gamePath, 'utf8'));
  delete gameConfig.openDataContext;
  writeFileSync(gamePath, JSON.stringify(gameConfig, null, 2));
  writeFileSync(
    resolve('build/wechatgame/THIRD_PARTY_NOTICES.txt'),
    readFileSync('THIRD_PARTY_NOTICES.md', 'utf8'),
  );
  installStartup();
  const { mainBytes, totalBytes, packages } = wechatPackage.checkPackageSize('build/wechatgame');
  console.log(`微信主包：${(mainBytes / 1024).toFixed(1)} / 4096 KiB`);
  for (const pkg of packages)
    console.log(`微信分包 ${pkg.name}：${(pkg.bytes / 1024).toFixed(1)} KiB`);
  console.log(`微信总包：${(totalBytes / 1024).toFixed(1)} / 30720 KiB`);
}
// Verify the emitted code, since Cocos compilation can change iterable semantics.
if (result.status === 0 || result.status === 36) {
  for (const script of [
    'scripts/check-wechat-package.cjs',
    'scripts/check-built.cjs',
    'scripts/check-ui.cjs',
    'scripts/check-container-launch.cjs',
    'scripts/check-predictive-dispatch.cjs',
    'scripts/check-level-picker.cjs',
  ]) {
    const check = spawnSync(process.execPath, [script], {
      stdio: 'inherit',
      env: { ...process.env, CHECK_BUILT: '1' },
    });
    if (check.status !== 0) process.exit(check.status ?? 1);
  }
  const cloudCheck = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--import',
      './scripts/register-typescript.mjs',
      '--test',
      'tests/cloud-ui.test.mjs',
      'tests/offline-ui.test.mjs',
      'tests/startup.test.mjs',
      'tests/startup-package.test.mjs',
      'tests/courtyard-ui.test.mjs',
      'tests/interaction-polish.test.mjs',
    ],
    { stdio: 'inherit', env: { ...process.env, CHECK_BUILT: '1' } },
  );
  if (cloudCheck.status !== 0) process.exit(cloudCheck.status ?? 1);
}
// Creator documents exit code 36 as successful command-line build.
process.exit(result.status === 36 ? 0 : (result.status ?? 1));

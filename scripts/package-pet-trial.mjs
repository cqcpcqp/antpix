import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import wechatPackage from './wechat-package.cjs';

const source = resolve('build/wechatgame');
const trial = resolve('build/pet-trial');
const trialFiles = new Set(['game.js', 'project.config.json', 'project.private.config.json']);

function pruneObsoleteBuildFiles(sourceDir, trialDir) {
  const sourceEntries = new Set(readdirSync(sourceDir));
  for (const entry of readdirSync(trialDir, { withFileTypes: true })) {
    if (trialDir === trial && trialFiles.has(entry.name)) continue;
    const path = resolve(trialDir, entry.name);
    if (!sourceEntries.has(entry.name)) rmSync(path, { recursive: true });
    else if (entry.isDirectory()) pruneObsoleteBuildFiles(resolve(sourceDir, entry.name), path);
  }
}

wechatPackage.checkPackageSize(source);
cpSync(source, trial, {
  recursive: true,
  filter: (path) => !trialFiles.has(relative(source, path)),
});
pruneObsoleteBuildFiles(source, trial);
const entry = readFileSync(resolve(source, 'game.js'), 'utf8');
writeFileSync(resolve(trial, 'game.js'), 'globalThis.ANTPIX_PET_TRIAL = true;\n' + entry);
const config = JSON.parse(readFileSync(resolve(source, 'project.config.json'), 'utf8'));
config.projectname = '生态蚂蚁窝 · 宠物试玩';
writeFileSync(resolve(trial, 'project.config.json'), JSON.stringify(config, null, 2));
wechatPackage.checkPackageSize(trial);
console.log(`本机宠物试玩包：${trial}`);

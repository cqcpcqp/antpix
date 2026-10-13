import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';
const creator=process.env.COCOS_CREATOR||'/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator';
const cloudPrep=spawnSync(process.execPath,['--experimental-strip-types','scripts/prepare-cloud.mjs'],{stdio:'inherit'});
if(cloudPrep.status!==0)process.exit(cloudPrep.status??1);
if(!existsSync(creator)){console.error('请通过 COCOS_CREATOR 指定 CocosCreator 可执行文件');process.exit(1);}
const existingConfig=resolve('build/wechatgame/project.config.json');
const existingAppid=existsSync(existingConfig)?JSON.parse(readFileSync(existingConfig,'utf8')).appid:undefined;
const appid=process.env.WECHAT_APPID||(existingAppid!=='touristappid'?existingAppid:undefined);
if(!appid)console.log('尚未设置 WECHAT_APPID：构建供本地导入，微信真机预览前需在开发者工具填写自己的 AppID。');
mkdirSync('temp',{recursive:true});
const config={name:JSON.parse(readFileSync('package.json','utf8')).name,platform:'wechatgame',buildPath:'project://build',debug:false,startScene:'11fcb94f-5e35-4cc7-8d90-b131a8958ac1',scenes:[{url:'db://assets/scenes/Main.scene',uuid:'11fcb94f-5e35-4cc7-8d90-b131a8958ac1'}],packages:{wechatgame:{appid:appid||'',orientation:'portrait'}}};
const configPath=resolve('temp/build-wechat.json');writeFileSync(configPath,JSON.stringify(config,null,2));
const result=spawnSync(creator,['--project',process.cwd(),'--build',`configPath=${configPath}`],{stdio:'inherit'});
if(result.status===0||result.status===36){
  const path=resolve('build/wechatgame/project.config.json');
  const project=JSON.parse(readFileSync(path,'utf8'));
  project.appid=appid||'touristappid';
  project.projectname='生态蚂蚁窝';
  project.description='生态蚂蚁窝 · 微信小游戏';
  project.cloudfunctionRoot='../../cloudfunctions/';
  writeFileSync(path,JSON.stringify(project,null,2));
  cpSync('wechat/open-data','build/wechatgame/open-data',{recursive:true});
  const gamePath=resolve('build/wechatgame/game.json');
  const gameConfig=JSON.parse(readFileSync(gamePath,'utf8'));
  gameConfig.openDataContext='open-data';
  writeFileSync(gamePath,JSON.stringify(gameConfig,null,2));
  writeFileSync(resolve('build/wechatgame/THIRD_PARTY_NOTICES.txt'),readFileSync('THIRD_PARTY_NOTICES.md','utf8'));
  // Keep the whole local package below WeChat's 4 MiB main-package limit.
  const folderSize=dir=>readdirSync(dir,{withFileTypes:true}).reduce((total,entry)=>{
    const file=resolve(dir,entry.name);
    return total+(entry.isDirectory()?folderSize(file):statSync(file).size);
  },0);
  const bytes=folderSize(resolve('build/wechatgame'));
  console.log(`微信包体（包含本地配置）：${(bytes/1024).toFixed(1)} KB / 4096 KB`);
  if(bytes>=4*1024*1024){console.error('微信包体超过 4 MiB，请减小包体后再上传。');process.exit(1);}
}
// Verify the emitted code, since Cocos compilation can change iterable semantics.
if(result.status===0||result.status===36){
  for(const script of ['scripts/check-built.cjs','scripts/check-ui.cjs','scripts/check-container-launch.cjs','scripts/check-predictive-dispatch.cjs','scripts/check-level-picker.cjs']){
    const check=spawnSync(process.execPath,[script],{stdio:'inherit',env:{...process.env,CHECK_BUILT:'1'}});
    if(check.status!==0)process.exit(check.status??1);
  }
  const cloudCheck=spawnSync(process.execPath,['--experimental-strip-types','--test','tests/cloud-ui.test.mjs','tests/courtyard-ui.test.mjs','tests/interaction-polish.test.mjs'],{stdio:'inherit',env:{...process.env,CHECK_BUILT:'1'}});
  if(cloudCheck.status!==0)process.exit(cloudCheck.status??1);
}
// Creator documents exit code 36 as successful command-line build.
process.exit(result.status===36?0:result.status??1);

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const base=process.env.COCOS_RESOURCES||'/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources';
const tsc=base+'/app.asar.unpacked/node_modules/typescript/lib/tsc.js';
if(!existsSync(tsc)){console.error('请通过 COCOS_RESOURCES 指定 Cocos Resources 目录');process.exit(1);}
const result=spawnSync(process.execPath,[tsc,'--noEmit','--strict','--experimentalDecorators','--skipLibCheck','--target','ES2020','--moduleResolution','node',base+'/resources/3d/engine/bin/.declarations/cc.d.ts','assets/scripts/PixelGarden.ts'],{stdio:'inherit'});process.exit(result.status??1);

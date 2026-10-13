import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {planContainers} from './container-planner.mjs';
const file=resolve(process.argv[2]||'assets/scripts/levels.ts');
const reportFile=resolve(process.argv[3]||'art/container-plan-report.json');
const {ARTWORKS,GRID_WIDTH,GRID_HEIGHT}=await import(pathToFileURL(file));
const plans={},report=[],counts='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
for(const art of ARTWORKS){
 const level={...art,width:GRID_WIDTH,height:GRID_HEIGHT};
 const variants=Array.from({length:3},(_,i)=>planContainers(level,1009+i*7919));
 plans[art.id]=variants.map(v=>v.jars.map(([color,count])=>{
  const local=art.swatches.indexOf(color);
  if(local<0||local>=24||count<1||count>40)throw Error(`Invalid plan in ${art.id}`);
  return String.fromCharCode(65+local)+counts[count];
 }).join(''));
 report.push({id:art.id,name:art.name,sourceHash:createHash('sha256').update(JSON.stringify(level.pixels)).digest('hex'),variants:variants.map(v=>({containers:v.jars.length,stages:v.stages,minCapacity:Math.min(...v.jars.map(j=>j[1])),maxCapacity:Math.max(...v.jars.map(j=>j[1]))}))});
 console.log(`${report.length}/${ARTWORKS.length} ${art.id}: ${variants.map(v=>v.jars.length).join('/')} containers`);
}
const source=readFileSync(file,'utf8');
writeFileSync(file,source.replace(/^const PACKED_CONTAINER_PLANS:.*$/m,'const PACKED_CONTAINER_PLANS: Record<string, string[]> = '+JSON.stringify(plans)+';'));
writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');

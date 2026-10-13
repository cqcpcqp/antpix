// Real artwork dispatch, using the production update loop and mocked rendering.
// This measures CPU logic, not Cocos rendering, GPU time or device FPS.
const {performance}=require('node:perf_hooks');
const {createHash}=require('node:crypto');
const {load,Texture2D,resourceLoads}=require('./headless-game.cjs');
const root=process.env.GAME_SCRIPT_ROOT||process.cwd()+'/assets/scripts';
const {PixelGarden}=load(root+'/PixelGarden.ts');
const {GardenModel}=load(root+'/model.ts');
const {makeLevel}=load(root+'/levels.ts');
const levels=(process.env.BENCH_LEVELS||'1,5,9').split(',').map(Number);
const scenarios=process.env.BENCH_SLOTS
 ? [[Number(process.env.BENCH_SLOTS),Number(process.env.BENCH_SPEED||1)]] : [[5,1],[9,2]];
const limit=Number(process.env.BENCH_FRAMES||3600);
const policy=process.env.BENCH_POLICY||'plan';
const refill=process.env.BENCH_REFILL!=='0';
const results=[];
for(const level of levels)for(const [slots,speed] of scenarios){
 let seed=1;
 Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const g=new PixelGarden();g.onLoad();g.startLevel(0);
 resourceLoads.get('ants/workers/texture')(null,new Texture2D());
 g.model=new GardenModel(makeLevel(level-1),()=>.5);
 while(g.model.slots.length<slots)g.model.slots.push(null);
 g.drawSlots();g.drawQueue();g.drawBoard();g.speed=speed;
 const hash=createHash('sha256'),times=[],draining=[];
 let dispatchMs=0,peakAnts=0,frame=0;
 const dispatch=g.dispatchAnts;
 g.dispatchAnts=function(dt){const t=performance.now();dispatch.call(this,dt);dispatchMs+=performance.now()-t;};
 for(;frame<limit&&!g.won&&!g.modal;frame++){
  // Follow the offline plan's order via selectable column heads, or reproduce
  // a naive queue-first player. Neither policy changes game rules or timings.
  while((refill||frame===0)&&g.model.slots.includes(null)&&g.model.queue.length){
   const jar=policy==='queue'?g.model.queue[0]:g.model.columns.map(c=>c[0]).filter(Boolean).sort((a,b)=>a.id-b.id)[0];
   g.model.place(jar.id);g.drawSlots();g.drawQueue();
  }
  const onlyFlights=g.model.slots.every(j=>j===null)&&g.flights.length>0;
  const begin=performance.now();g.update(1/60);times.push(performance.now()-begin);
  if(onlyFlights)draining.push(times.at(-1));
  peakAnts=Math.max(peakAnts,g.flights.length);
  hash.update(JSON.stringify([g.model.collected,g.model.remaining,g.model.pixels,g.model.slots,g.model.queue,
   g.dispatchClocks,g.flights.map(f=>[f.pickup,f.phase,f.elapsed,f.path,f.visual.node.position,
    f.visual.node.angle,f.visual.node.scale,f.visual.frame,f.visual.cargo.active,f.visual.cargo.angle])]));
 }
 times.sort((a,b)=>a-b);
 results.push({level,slots,speed,frames:frame,peakAnts,collected:g.model.collected,blocked:!!g.modal,
  totalMs:times.reduce((a,b)=>a+b,0),dispatchMs,p99Ms:times[Math.floor(times.length*.99)],
  maxMs:times.at(-1),over16ms:times.filter(t=>t>1000/60).length,over33ms:times.filter(t=>t>1000/30).length,
  drainingFrames:draining.length,drainingMeanMs:draining.length?draining.reduce((a,b)=>a+b,0)/draining.length:0,
  behaviorHash:hash.digest('hex')});
 console.error(`Level ${level}, ${slots} slots, ${speed}x: ${frame} frames, p99 ${results.at(-1).p99Ms.toFixed(2)} ms`);
 g.onDestroy();
}
console.log(JSON.stringify({built:!!process.env.CHECK_BUILT,rendering:'mock',policy,refill,results},null,2));

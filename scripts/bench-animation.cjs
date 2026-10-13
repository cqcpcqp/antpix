// Deterministic production update loop; mocked rendering measures CPU, not FPS.
const {performance}=require('node:perf_hooks');
const {createHash}=require('node:crypto');
const {load,Texture2D,resourceLoads,transformWrites}=require('./headless-game.cjs');
// Seed startup too: initial card placement affects later pooled-card motion.
// Seeding only the stress model leaves transform-write counts nondeterministic.
let seed=1;
Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const scriptRoot=process.env.GAME_SCRIPT_ROOT||process.cwd()+'/assets/scripts';
const {PixelGarden}=load(scriptRoot+'/PixelGarden.ts');
const {GardenModel}=load(scriptRoot+'/model.ts');
const {GRID_WIDTH,GRID_HEIGHT}=load(scriptRoot+'/levels.ts');
const PIXEL_COUNT=GRID_WIDTH*GRID_HEIGHT;
const slots=Number(process.env.BENCH_SLOTS||5);
if(slots!==5&&slots!==9)throw Error('BENCH_SLOTS must be 5 or 9');
const g=new PixelGarden();g.onLoad();g.startLevel(0);
if(process.env.ANT_ATLAS==='1')resourceLoads.get('ants/workers/texture')(null,new Texture2D());
g.model=new GardenModel({name:'crowded 2x',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:Array(PIXEL_COUNT).fill(0),capacity:40},()=>.5);
while(g.model.slots.length<slots)g.model.slots.push(null);
g.drawSlots();g.drawQueue();g.drawBoard();g.speed=2;
for(const key of Object.keys(transformWrites))transformWrites[key]=0;
const frames=[],hash=createHash('sha256');let peak=0,frame=0;
while(!g.won&&frame<50000){
 while(g.model.slots.includes(null)&&g.model.queue.length){g.model.place(g.model.queue[0].id);g.drawSlots();g.drawQueue();}
 const begin=performance.now();g.update(1/60);frames.push(performance.now()-begin);
 peak=Math.max(peak,g.flights.length);
 hash.update(JSON.stringify([g.model.collected,g.model.remaining,g.flights.map(f=>[f.pickup.pixel,f.pickup.jarId,f.phase,f.elapsed,f.path,f.visual.node.position,f.visual.node.angle,f.visual.node.scale,f.visual.frame,f.visual.cargo.active,f.visual.cargo.position,f.visual.cargo.angle]) ]));
 frame++;
}
if(!g.won||g.model.collected!==PIXEL_COUNT)throw Error('Incomplete collection');
const total=frames.reduce((a,b)=>a+b,0);frames.sort((a,b)=>a-b);
console.log(JSON.stringify({scenario:`${PIXEL_COUNT} pixels, ${slots} slots, 2x, 60Hz; CPU only`,atlas:process.env.ANT_ATLAS==='1',frames:frame,peakAnts:peak,totalMs:total,p95Ms:frames[Math.floor(frame*.95)],p99Ms:frames[Math.floor(frame*.99)],maxMs:frames.at(-1),transformWrites,behaviorHash:hash.digest('hex')},null,2));

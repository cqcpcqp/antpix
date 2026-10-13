const {performance}=require('node:perf_hooks');
const load=require('./load-built.cjs')({cclegacy:{_RF:{push(){},pop(){}}}});
const {GardenModel}=load('chunks:///_virtual/model.ts');
const {GRID_WIDTH,GRID_HEIGHT}=load('chunks:///_virtual/levels.ts');
const PIXEL_COUNT=GRID_WIDTH*GRID_HEIGHT;
const runs=[];
for(let run=0;run<6;run++){
 const m=new GardenModel({name:'benchmark',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:Array(PIXEL_COUNT).fill(0),capacity:40},()=>.5);
 const start=performance.now();let count=0;
 while(!m.complete){
  while(m.slots.includes(null)&&m.queue.length)m.place(m.queue[0].id);
  for(let slot=0;slot<5;slot++){const p=m.pick(slot);if(p){m.lift(p);m.arrive(p);count++;}}
 }
 runs.push(performance.now()-start);if(count!==PIXEL_COUNT)throw Error('lost pixels');
}
runs.shift();runs.sort((a,b)=>a-b);console.log(JSON.stringify({medianMs:runs[2],runs,scenario:`${PIXEL_COUNT} pickups, five slots, actual build; CPU only`}));

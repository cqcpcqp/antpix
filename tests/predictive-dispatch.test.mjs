import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenModel} from '../assets/scripts/model.ts';
import {nearestAntTarget} from '../assets/scripts/routing.ts';

test('reservation exposes future tasks immediately but never permits premature lifting',()=>{
 const m=new GardenModel({name:'chain',subtitle:'',width:1,height:3,pixels:[0,0,0],capacity:3},()=>.5);
 m.place(m.queue[0].id);
 const reserve=()=>{
  const targets=m.availableTargets(0);
  const assignment=nearestAntTarget({width:1,height:3,pixels:m.plannedPixels},{x:0,y:5},targets);
  return m.pick(0,assignment);
 };
 const bottom=reserve();assert.equal(bottom.pixel,2);
 assert.deepEqual(m.pixels,[0,0,0]);assert.deepEqual(m.availableTargets(0).map(t=>t.pixel),[1]);
 const middle=reserve(),top=reserve();assert.equal(middle.pixel,1);assert.equal(top.pixel,0);
 assert.equal(m.slots[0],null);assert.equal(m.inFlight,3);assert.equal(m.complete,false);
 assert.equal(m.lift(top),false);assert.equal(m.lift(middle),false);assert.equal(m.remaining,3);
 assert.equal(m.lift(bottom),true);assert.equal(m.lift(middle),true);assert.equal(m.lift(top),true);
 for(const p of [top,bottom,middle])m.arrive(p);
 assert.equal(m.collected,3);assert.equal(m.complete,true);
});

test('prediction crosses reserved colors but never unreserved blockers',()=>{
 const m=new GardenModel({name:'colors',subtitle:'',width:1,height:3,pixels:[2,1,0],capacity:1},()=>.5);
 for(const color of [0,1,2])m.place(m.visibleQueue.find(v=>v.row===0&&v.jar.color===color).jar.id);
 assert.equal(m.availableTargets(2).length,0);
 const first=m.pick(0,{pixel:2,approach:{x:0,y:3}});
 assert.equal(m.availableTargets(1)[0].pixel,1);assert.equal(m.availableTargets(2).length,0);
 const next=m.pick(1,{pixel:1,approach:{x:0,y:2}});
 assert.equal(m.availableTargets(2)[0].pixel,0);
 assert.equal(m.pick(2,{pixel:0,approach:{x:0,y:2}}),null);
 assert.equal(m.lift(next),false);assert.equal(m.lift(first),true);assert.equal(m.lift(next),true);
});

// Independent full flood: no production exposure/cache helpers are used here.
function fullPlannedState(model, pending) {
 const {width,height}=model.level;
 const pixels=model.pixels.map((color,pixel)=>pending.has(pixel)?-1:color);
 const reached=new Set(),queue=[];
 const neighbors=p=>{
  const x=p%width,y=Math.floor(p/width),out=[];
  if(y+1<height)out.push(p+width);
  if(x>0)out.push(p-1);
  if(x+1<width)out.push(p+1);
  if(y>0)out.push(p-width);
  return out;
 };
 for(let p=(height-1)*width;p<pixels.length;p++)if(pixels[p]<0){reached.add(p);queue.push(p);}
 for(let i=0;i<queue.length;i++)for(const p of neighbors(queue[i]))if(pixels[p]<0&&!reached.has(p)){reached.add(p);queue.push(p);}
 const targets=[];
 for(let p=0;p<pixels.length;p++){
  if(pixels[p]<0)continue;
  const approaches=[];
  if(Math.floor(p/width)===height-1)approaches.push({x:p%width,y:height});
  for(const n of neighbors(p))if(reached.has(n))approaches.push({x:n%width,y:Math.floor(n/width)});
  if(approaches.length)targets.push({pixel:p,approaches});
 }
 return {pixels,targets};
}

test('incremental planned targets match a full flood through reservations, sealed holes, lifting and out-of-order arrivals',()=>{
 for(let seed=1;seed<=12;seed++){
  let state=seed;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const width=8,height=9;
  const pixels=Array.from({length:width*height},()=>Math.floor(random()*4));
  const m=new GardenModel({name:'mixed prediction',subtitle:'',width,height,pixels,capacity:width*height},random);
  // Include sealed cavities and bottom-connected gaps before cache initialization.
  for(const p of [10,11,18,19,35,43,51,59,67])m.pixels[p]=-1;
  m.remaining=m.pixels.filter(c=>c>=0).length;
  while(m.queue.length)m.place(m.queue[0].id);
  const pending=new Map();
  const verify=()=>{
   const oracle=fullPlannedState(m,pending);
   assert.deepEqual(m.plannedPixels,oracle.pixels);
   for(let slot=0;slot<m.slots.length;slot++){
    const jar=m.slots[slot];
    const expected=jar&&m.undispatched(slot)>0?oracle.targets.filter(t=>m.pixels[t.pixel]===jar.color):[];
    assert.deepEqual(m.availableTargets(slot),expected,`seed ${seed}, slot ${slot}`);
   }
  };
  verify();
  for(let step=0;step<width*height*12&&!m.complete;step++){
   const slots=Array.from({length:m.slots.length},(_,i)=>i).filter(i=>m.availableTargets(i).length);
   if(slots.length){
    const slot=slots[Math.floor(random()*slots.length)],targets=m.availableTargets(slot);
    const target=targets[Math.floor(random()*targets.length)];
    const chosen={pixel:target.pixel,approach:target.approaches[Math.floor(random()*target.approaches.length)]};
    const pickup=step%7===0?m.pick(slot):m.pick(slot,chosen);
    if(pickup){pending.set(pickup.pixel,pickup);verify();assert.equal(m.pick(slot,{pixel:pickup.pixel,approach:pickup.approach}),null);}
   }
   // Some followers wait behind reserved but still physically occupied pixels.
   for(const pickup of [...pending.values()].reverse())if(random()<.45&&m.pixels[pickup.pixel]>=0){m.lift(pickup);verify();}
   for(const pickup of [...pending.values()].reverse())if(random()<.35&&m.pixels[pickup.pixel]<0){const before=m.collected;m.arrive(pickup);assert.equal(m.collected,before+1);pending.delete(pickup.pixel);verify();}
   // Synthetic holes leave unused jar capacity, so all physical pixels is the terminal condition.
   if(m.remaining===0&&pending.size===0)break;
  }
  assert.equal(m.remaining,0,`seed ${seed} must collect every non-hole pixel`);
  assert.equal(pending.size,0);
 }
});

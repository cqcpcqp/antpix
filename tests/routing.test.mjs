import test from 'node:test';
import assert from 'node:assert/strict';
import { findAntRoute, clearSegment, routeLength, sampleRoute, prepareRoute, samplePreparedRoute } from '../assets/scripts/routing.ts';
import { makeLevel, LEVEL_COUNT } from '../assets/scripts/levels.ts';
const grid=(width,height,pixels)=>({width,height,pixels});
function clearPath(b,path){for(let i=1;i<path.length;i++)assert.ok(clearSegment(b,path[i-1],path[i]),`segment ${i} crosses a pixel`);}
test('unobstructed movement takes one straight line',()=>{
 const b=grid(6,5,Array(30).fill(-1)),start={x:2.5,y:8},end={x:0,y:1};
 const p=findAntRoute(b,start,end);assert.equal(p.length,2);assert.deepEqual(p[0],start);assert.deepEqual(p.at(-1),end);
 assert.ok(Math.abs(routeLength(p)-Math.hypot(2.5,7))<1e-8);clearPath(b,p);
});
test('a wall forces a detour without passing through pixels',()=>{
 const b=grid(5,5,Array(25).fill(-1));for(let y=0;y<4;y++)b.pixels[y*5+2]=1;
 const start={x:0,y:0},end={x:4,y:0};assert.equal(clearSegment(b,start,end),false);
 const p=findAntRoute(b,start,end);assert.ok(routeLength(p)>4);clearPath(b,p);
});
test('corner touching is blocked rather than squeezing diagonally through blocks',()=>{
 const b=grid(2,2,[-1,1,1,-1]);assert.equal(clearSegment(b,{x:0,y:0},{x:1,y:1}),false);
});
test('slab intersection handles parallel, touching and zero-length segments with clearance',()=>{
 const b=grid(5,5,Array(25).fill(-1));b.pixels[12]=0;
 for(const [a,z,clearance,clear] of [
  [{x:0,y:1},{x:4,y:1},.45,true],
  [{x:0,y:1.05},{x:4,y:1.05},.45,false],
  [{x:1,y:0},{x:1,y:4},.45,true],
  [{x:1.05,y:0},{x:1.05,y:4},.45,false],
  [{x:2,y:2},{x:2,y:2},0,false],
  [{x:0,y:0},{x:0,y:0},.45,true],
  [{x:0,y:2},{x:1,y:2},.45,true],
  [{x:0,y:2},{x:1.05,y:2},.45,false],
 ]){
  assert.equal(clearSegment(b,a,z,clearance),clear);
  assert.equal(clearSegment(b,z,a,clearance),clear);
 }
});
test('return replans a shorter path when other workers remove an obstacle',()=>{
 const b=grid(5,5,Array(25).fill(-1));b.pixels[2*5+2]=1;
 const start={x:0,y:2},end={x:4,y:2};const before=findAntRoute(b,start,end);b.pixels[12]=-1;
 const after=findAntRoute(b,start,end);assert.ok(routeLength(after)<routeLength(before));assert.equal(routeLength(after),4);
});
test('path sample preserves position at bends and clamps at the cave',()=>{
 const p=[{x:0,y:0},{x:3,y:0},{x:3,y:4}];
 assert.equal(routeLength(p),7);assert.deepEqual(sampleRoute(p,2),{x:2,y:0,angle:0});
 assert.deepEqual(sampleRoute(p,5),{x:3,y:2,angle:Math.PI/2});assert.deepEqual(sampleRoute(p,100),{x:3,y:4,angle:Math.PI/2});
});
test('prepared sampling reuses its output and exactly preserves poses at bends and clamped ends',()=>{
 const paths=[
  [{x:4,y:7}],
  [{x:0,y:0},{x:0,y:0},{x:3,y:0},{x:3,y:4},{x:3,y:4}],
  [{x:1.2,y:-3.7},{x:-6.1,y:8.2},{x:0,y:0},{x:23.45,y:-.67}],
 ];
 let seed=101;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<100;i++)paths.push(Array.from({length:2+i%9},()=>({x:random()*800-400,y:random()*1200-600})));
 const out={x:0,y:0,angle:0};
 for(const path of paths){
  const prepared=prepareRoute(path);assert.equal(prepared.distance,routeLength(path));
  const distances=[-10,0,prepared.distance,prepared.distance+10];
  let bend=0;
  for(const length of prepared.lengths){bend+=length;distances.push(bend-1e-10,bend,bend+1e-10);}
  for(let i=0;i<100;i++)distances.push(random()*prepared.distance);
  for(const distance of distances){
   assert.equal(samplePreparedRoute(prepared,distance,out),out);
   assert.deepEqual(out,sampleRoute(path,distance));
  }
 }
});
test('all columns of each artwork can be approached from the common cave',()=>{
 for(let i=0;i<LEVEL_COUNT;i++){
  const b=makeLevel(i),nest={x:b.width/2-.5,y:b.height+5.7};
  for(let x=0;x<b.width;x++){const target={x,y:b.height};const path=findAntRoute(b,nest,target);clearPath(b,path);assert.deepEqual(path.at(-1),target);}
 }
});
test('uneven cleared columns route around the remaining picture',()=>{
 const b=grid(12,15,Array(180).fill(1));
 const heights=[12,12,12,4,3,3,9,9,5,5,2,2];
 for(let x=0;x<12;x++)for(let y=heights[x]+1;y<15;y++)b.pixels[y*12+x]=-1;
 for(let x=0;x<12;x++){const p=findAntRoute(b,{x:5.5,y:19},{x,y:heights[x]+1});clearPath(b,p);}
});
test('card origins below the shared cave can reach all bottom columns',()=>{
 const b=grid(40,50,Array(2000).fill(1));
 for(const x of [.69,10.09,19.5,28.9,38.31]){
  for(const column of [0,10,20,30,39]){
   const start={x,y:59.43},end={x:column,y:50};
   const path=findAntRoute(b,start,end);assert.deepEqual(path[0],start);assert.deepEqual(path.at(-1),end);clearPath(b,path);
  }
 }
});
test('straight-line shortcut still rejects an occupied endpoint',()=>{
 const b=grid(2,2,[1,1,1,1]);assert.throws(()=>findAntRoute(b,{x:0,y:3},{x:0,y:1}),/occupied/);
});

test('carrying return leaves clearance instead of shaving across an occupied corner',()=>{
 const b=grid(7,7,Array(49).fill(-1));b.pixels[3*7+3]=1;
 const start={x:2,y:2},nest={x:5,y:7};
 const path=findAntRoute(b,start,nest,.45);
 assert.ok(path.length>2);
 for(let i=1;i<path.length;i++)assert.ok(clearSegment(b,path[i-1],path[i],.45));
});
test('clearance preserves single-cell passages and routes around a return wall',()=>{
 const b=grid(7,7,Array(49).fill(1));
 for(let y=1;y<7;y++)b.pixels[y*7+1]=-1;
 for(let x=1;x<6;x++)b.pixels[1*7+x]=-1;
 const start={x:5,y:1},nest={x:3,y:9},p=findAntRoute(b,start,nest,.45);
 assert.ok(p.length>2);assert.deepEqual(p[0],start);assert.deepEqual(p.at(-1),nest);
 for(let i=1;i<p.length;i++)assert.ok(clearSegment(b,p[i-1],p[i],.45));
});

test('nearest assignment compares walking distance instead of row or straight-line proximity',async()=>{
 const {nearestAntTarget}=await import('../assets/scripts/routing.ts');
 const b=grid(7,7,Array(49).fill(-1));
 for(let y=0;y<6;y++)b.pixels[y*7+2]=1;
 const start={x:0,y:0},targets=[{pixel:10,approaches:[{x:3,y:0}]},{pixel:35,approaches:[{x:0,y:5}]}];
 const choice=nearestAntTarget(b,start,targets);
 assert.equal(choice.pixel,35);assert.equal(routeLength(choice.path),5);
 for(const t of targets)for(const a of t.approaches)assert.ok(routeLength(choice.path)<=routeLength(findAntRoute(b,start,a,.45))+1e-9);
});
test('nearest assignment evaluates every contact side and uses the individual departure point',async()=>{
 const {nearestAntTarget}=await import('../assets/scripts/routing.ts');
 const b=grid(7,7,Array(49).fill(-1));
 const targets=[{pixel:0,approaches:[{x:0,y:5},{x:1,y:4}]},{pixel:6,approaches:[{x:6,y:5}]}];
 const left=nearestAntTarget(b,{x:1,y:3},targets);
 assert.equal(left.pixel,0);assert.deepEqual(left.approach,{x:1,y:4});
 assert.equal(nearestAntTarget(b,{x:6,y:6},targets).pixel,6);
 assert.equal(nearestAntTarget(b,{x:6,y:6},[]),null);
});

test('reused target search preserves equal-distance ties and never reuses routes after start or board changes', async()=>{
 const {AntTargetSearch,nearestAntTarget,routeLength}=await import('../assets/scripts/routing.ts');
 const search=new AntTargetSearch();
 function reference(board,start,targets){
  const candidates=targets.flatMap(t=>t.approaches.map(approach=>({pixel:t.pixel,approach,lower:Math.hypot(approach.x-start.x,approach.y-start.y)})))
   .sort((a,b)=>a.lower-b.lower||a.pixel-b.pixel||a.approach.y-b.approach.y||a.approach.x-b.approach.x);
  let best=null,distance=Infinity;
  for(const c of candidates){
   if(c.lower>=distance-1e-9)break;
   const path=findAntRoute(board,start,c.approach,.45),length=routeLength(path);
   if(length<distance-1e-9){distance=length;best={pixel:c.pixel,approach:c.approach,path};}
  }
  return best;
 }
 const board={width:7,height:7,pixels:Array(49).fill(-1)};
 board.pixels[3*7+3]=1;
 const targets=[{pixel:12,approaches:[{x:5,y:2},{x:1,y:2}]},{pixel:8,approaches:[{x:1,y:2},{x:5,y:2}]}];
 for(const start of [{x:3,y:9},{x:0,y:8},{x:6,y:8}]){
  assert.deepEqual(nearestAntTarget(board,start,targets,.45,search),reference(board,start,targets));
  assert.deepEqual(nearestAntTarget(board,start,[...targets].reverse(),.45,search),reference(board,start,targets));
 }
 board.pixels[3*7+3]=-1;
 assert.deepEqual(nearestAntTarget(board,{x:3,y:9},targets,.45,search),reference(board,{x:3,y:9},targets));
 assert.equal(nearestAntTarget(board,{x:3,y:9},[],.45,search),null);
 assert.deepEqual(nearestAntTarget(board,{x:3,y:9},targets,.45,search),reference(board,{x:3,y:9},targets));
});

test('outbound and return routes use interior passages instead of either side border', async()=>{
 const {nearestAntTarget}=await import('../assets/scripts/routing.ts');
 for(const mirrored of [false,true]){
  const board=grid(7,7,Array(49).fill(-1));
  const x=v=>mirrored?6-v:v;
  for(let column=0;column<6;column++)board.pixels[4*7+x(column)]=1;
  const start={x:x(0),y:9},target={x:x(0),y:3};
  for(const path of [nearestAntTarget(board,start,[{pixel:14+x(0),approaches:[target]}],.45).path,findAntRoute(board,target,start,.45)]){
   assert.ok(path.some(p=>p.x===x(6)),'must walk through the interior opening');
   for(let i=1;i<path.length;i++){
    assert.ok(clearSegment(board,path[i-1],path[i],.45));
    for(let t=0;t<=1;t+=.01){
     const px=path[i-1].x+(path[i].x-path[i-1].x)*t;
     const py=path[i-1].y+(path[i].y-path[i-1].y)*t;
     if(py<board.height-.5)assert.ok(px>=0&&px<=board.width-1,'smoothed route must remain inside');
    }
   }
  }
 }
});

test('side walls block smoothing and waiting movement but leave the bottom entrance open',()=>{
 const board=grid(7,7,Array(49).fill(-1));
 for(const x of [-1,7]){
  assert.equal(clearSegment(board,{x,y:6},{x,y:2},.45),false);
  assert.equal(clearSegment(board,{x,y:8},{x:3,y:0},.45),false);
  assert.equal(clearSegment(board,{x:3,y:0},{x,y:8},.45),false);
  assert.equal(clearSegment(board,{x,y:8},{x:3,y:6},.45),true);
 }
 assert.equal(clearSegment(board,{x:-1,y:8},{x:7,y:8},.45),true);
 assert.equal(clearSegment(board,{x:0,y:8},{x:0,y:0},.45),true);
});

test('a reserved passage keeps followers waiting inside instead of bypassing the wall',async()=>{
 const {nearestAntTarget}=await import('../assets/scripts/routing.ts');
 const real=grid(7,7,Array(49).fill(-1));
 for(let x=0;x<7;x++)real.pixels[4*7+x]=1;
 const start={x:0,y:9},target={x:0,y:3};
 assert.throws(()=>findAntRoute(real,start,target,.45),/must have a route/);
 const planned={...real,pixels:[...real.pixels]};
 planned.pixels[4*7+3]=-1;
 const {path}=nearestAntTarget(planned,start,[{pixel:14,approaches:[target]}],.45);
 assert.ok(path.some(p=>p.x===3),'followers must use the reserved interior corridor');
 assert.ok(path.slice(1).some((p,i)=>!clearSegment(real,path[i],p,.45)),'real obstacle must hold followers');
 real.pixels[4*7+3]=-1;
 for(let i=1;i<path.length;i++)assert.ok(clearSegment(real,path[i-1],path[i],.45),'lifting prerequisite releases the route');
});

test('world-coordinate roundoff at edge cell centers cannot strand waiting ants',()=>{
 const board=grid(48,60,Array(48*60).fill(-1));
 const size=584/48;
 const roundTrip=x=>(-292+(x+.5)*size+292)/size-.5;
 for(const x of [0,47]){
  assert.equal(clearSegment(board,{x,y:60},{x:roundTrip(x),y:59},.45),true);
  assert.equal(clearSegment(board,{x:roundTrip(x),y:59},{x:roundTrip(x),y:58},.45),true);
 }
 assert.equal(clearSegment(board,{x:-.000001,y:59},{x:0,y:58},.45),false);
 assert.equal(clearSegment(board,{x:47.000001,y:59},{x:47,y:58},.45),false);
});

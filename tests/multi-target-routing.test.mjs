import test from 'node:test';
import assert from 'node:assert/strict';
import {AntTargetSearch,nearestAntTarget,clearSegment} from '../assets/scripts/routing.ts';

// Independent small-board oracle: linear minimum selection, no production heap,
// no path smoothing, and exact collision checks on every graph edge.
function distances(board,start){
 const maxY=Math.max(board.height+6,Math.ceil(start.y)),stride=board.width+2;
 const free=(x,y)=>x>=-1&&x<=board.width&&y>=0&&y<=maxY&&
  (y>=board.height||(x>=0&&x<board.width&&board.pixels[y*board.width+x]<0));
 const id=(x,y)=>y*stride+x+1;
 const distance=new Map([[id(Math.round(start.x),Math.round(start.y)),0]]),closed=new Set();
 while(true){
  let current=-1,best=Infinity;
  for(const [key,value] of distance)if(!closed.has(key)&&value<best){current=key;best=value;}
  if(current<0)break;
  closed.add(current);
  const x=current%stride-1,y=Math.floor(current/stride);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const nx=x+dx,ny=y+dy;
   if((!dx&&!dy)||!free(nx,ny)||!clearSegment(board,{x,y},{x:nx,y:ny},.45))continue;
   const key=id(nx,ny),cost=best+Math.hypot(dx,dy);
   if(cost<(distance.get(key)??Infinity))distance.set(key,cost);
  }
 }
 return p=>distance.get(id(p.x,p.y))??Infinity;
}

test('one multi-target search chooses minimum grid distance and preserves safe smoothed paths',()=>{
 let seed=129;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const scratch=new AntTargetSearch();
 for(let n=0;n<120;n++){
  const width=5+n%5,height=6+n%4;
  const board={width,height,pixels:Array.from({length:width*height},()=>random()<.3?0:-1)};
  const start={x:width/2-.3,y:height+3.4};
  const targets=Array.from({length:8},(_,pixel)=>({pixel,approaches:Array.from({length:2},()=>({x:Math.floor(random()*width),y:Math.floor(random()*height)}))}));
  for(const t of targets)for(const p of t.approaches)board.pixels[p.y*width+p.x]=-1;
  const distance=distances(board,start);
  const candidates=targets.flatMap(t=>t.approaches.map(approach=>({pixel:t.pixel,approach,d:distance(approach)}))).filter(c=>Number.isFinite(c.d));
  const min=Math.min(...candidates.map(c=>c.d));
  const expected=candidates.filter(c=>Math.abs(c.d-min)<1e-9).sort((a,b)=>a.pixel-b.pixel||a.approach.y-b.approach.y||a.approach.x-b.approach.x)[0];
  if(!expected){assert.throws(()=>nearestAntTarget(board,start,targets,.45,scratch));continue;}
  const actual=nearestAntTarget(board,start,targets,.45,scratch);
  assert.equal(actual.pixel,expected.pixel);assert.deepEqual(actual.approach,expected.approach);
  assert.deepEqual(actual.path[0],start);assert.deepEqual(actual.path.at(-1),actual.approach);
  for(let i=1;i<actual.path.length;i++)assert.ok(clearSegment(board,actual.path[i-1],actual.path[i],.45));
  assert.deepEqual(nearestAntTarget(board,start,[...targets].reverse(),.45,scratch),actual,'target enumeration does not change ties');
 }
});

test('shared contact ties use pixel order, and empty/new snapshots cannot retain old goals',()=>{
 const search=new AntTargetSearch(),board={width:8,height:8,pixels:Array(64).fill(-1)},start={x:3,y:11};
 const targets=[{pixel:9,approaches:[{x:3,y:7}]},{pixel:2,approaches:[{x:3,y:7}]}];
 assert.equal(nearestAntTarget(board,start,targets,.45,search).pixel,2);
 assert.equal(nearestAntTarget(board,start,[],.45,search),null);
 assert.equal(nearestAntTarget(board,start,[targets[0]],.45,search).pixel,9);
});

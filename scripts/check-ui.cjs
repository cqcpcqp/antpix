// Headless component checks; rendering is mocked, so these do not measure FPS.
const {load,cc,Node,Graphics,Label,AudioSource,Sprite,Texture2D,resourceLoads}=require('./headless-game.cjs');
function completeTestAd(){ game.rewardAdDemo.complete(); game.rewardAdDemo=null; game.closeModal(); }
const {PixelGarden}=load(process.cwd()+'/assets/scripts/PixelGarden.ts');const game=new PixelGarden();game.onLoad();
const assert=require('node:assert/strict');
const {CELL_SIZE}=load(process.cwd()+'/assets/scripts/boardLayout.ts');
const {GRID_WIDTH,GRID_HEIGHT,PALETTE,LEVEL_COUNT}=load(process.cwd()+'/assets/scripts/levels.ts');
const PIXEL_COUNT=GRID_WIDTH*GRID_HEIGHT;
assert.equal(GRID_WIDTH,48);assert.equal(GRID_HEIGHT,60);
assert.equal(game.boardRows.length,GRID_HEIGHT);assert.equal(game.hintRows.length,GRID_HEIGHT);
assert.equal(CELL_SIZE*GRID_WIDTH,584);assert.equal(CELL_SIZE*GRID_HEIGHT,730);
game.startLevel(0);
for(let column=0;column<5;column++){
 const card=game.cardViews.find(v=>v.column===column&&v.row===0);
 assert.equal(game.slotViews[column].art.node.position.x,card.node.position.x,'collection slots and queue columns must align');
}
assert.equal(game.expansionBoard.position.x,game.cardViews.find(v=>v.column===4).node.position.x,'extra slot must align with fifth column');
assert.equal(game.expansionBoard.parent,game.queue.parent);
assert.equal(game.boardRows[0].node.parent,game.effects.node.parent,'board and ants must share the playfield transform');
assert.equal(game.playfield.scale.x,game.playfield.scale.y,'pixels retain their aspect ratio');
const shelfBottom=game.playfield.position.y-594*game.playfield.scale.y;
assert.ok(shelfBottom < -660,'main game fills the removed button row');
assert.ok(shelfBottom > -game.screenHeight/2+32,'bottom safe margin is preserved');
assert.ok(game.speedLabel.node.parent.position.x<0,'speed avoids the WeChat capsule on the right');
const expansionTop=game.expansionBoard.position.y+29;
const expansionBottom=game.expansionBoard.position.y-33;
const aboveGap=-163-expansionTop,belowGap=expansionBottom-(-243);
assert.ok(aboveGap>=8&&belowGap>=8,'unlock board clears the artwork shadow and visible wood rim');
assert.ok(Math.abs(aboveGap-belowGap)<=3,'unlock board is visually centred between the artwork and wood rim');
const testArt=new Graphics();game.boardPixel(testArt,-CELL_SIZE/2,CELL_SIZE/2,load(process.cwd()+'/assets/scripts/levels.ts').PALETTE[0]);
const worker=game.acquireAnt(0);const carried=worker.cargo.getComponent(Graphics);
assert.deepEqual(JSON.parse(JSON.stringify(carried.commands)),JSON.parse(JSON.stringify(testArt.commands)),'carried block must use exactly the same size, color and shadow geometry');
game.releaseAnt(worker);
const initialCards=game.cardViews.length,initialSlots=game.slotViews.length;
const second=game.model.columns[2][1].id;
game.model.place(game.model.columns[2][0].id);game.drawSlots();game.drawQueue();
assert.equal(game.cardViews.length,initialCards);assert.equal(game.slotViews.length,initialSlots);
const promoted=game.cardViews.find(v=>v.id===second);assert.equal(promoted.row,0);assert.ok(promoted.node.position.y<promoted.targetY);
for(let i=0;i<50;i++)game.update(1/60);assert.ok(Math.abs(promoted.node.position.y-promoted.targetY)<.1);
game.startLevel(0);
const {GardenModel}=load(process.cwd()+'/assets/scripts/model.ts');
game.model=new GardenModel({name:'stress',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:Array(PIXEL_COUNT).fill(0),capacity:Math.ceil(PIXEL_COUNT/5)});
while(game.model.queue.length)game.model.place(game.model.queue[0].id);
game.drawSlots();game.drawBoard();game.speed=2;
for(const slot of [0,2,4]){const out=game.antRoute((PIXEL_COUNT-1),false,slot);assert.ok(Math.abs(out[0].x-game.slotViews[slot].art.node.position.x)<1e-6);assert.ok(Math.abs(out[0].y-(game.slotViews[slot].art.node.position.y+42))<1e-6);const back=game.antRoute((PIXEL_COUNT-1),true,slot);assert.equal(back.at(-1).x,0);assert.ok(Math.abs(back.at(-1).y+203)<1e-6);}
let draws=0;const original=game.drawAnt.bind(game);game.drawAnt=(...args)=>{draws++;return original(...args);};
let rowDraws=0;const boardDraw=game.drawBoard.bind(game);game.drawBoard=(rows)=>{assert.ok(rows,'animation must never redraw the whole board');rowDraws+=rows.size;return boardDraw(rows);};
let peakWorkers=0;const acquire=game.acquireAnt.bind(game);game.acquireAnt=(c)=>{const worker=acquire(c);peakWorkers=Math.max(peakWorkers,game.antPool.filter(v=>v.node.active).length);return worker;};
for(let i=0;i<1800;i++)game.update(1/60);
game.acquireAnt=acquire;
assert.ok(game.model.collected>0);assert.equal(game.antPool.length,peakWorkers,'pool should reuse idle workers rather than grow each trip');assert.ok(draws<=3*game.antPool.length,'same-colored workers must reuse cached geometry');
assert.ok(rowDraws<=2*(game.model.level.pixels.length-game.model.remaining),'a pickup redraws only its own row and the newly exposed wall above');
for(const f of game.flights){assert.equal(f.visual.color,f.pickup.color);assert.equal(f.visual.cargo.active,f.lifted);}
console.log(JSON.stringify({frames:1800,poolSize:game.antPool.length,antGeometryDraws:draws,dirtyRows:rowDraws,delivered:game.model.collected}));
// Loading during active trips must preserve poses, cargo and animation phases.
const poses=game.antPool.map(v=>[v.node.active,v.node.position,v.node.angle,v.frame,v.cargo.active,v.cargo.angle]);
const atlas=new Texture2D();resourceLoads.get('ants/workers/texture')(null,atlas);
assert.equal(atlas.refs,1);
assert.deepEqual(game.antPool.map(v=>[v.node.active,v.node.position,v.node.angle,v.frame,v.cargo.active,v.cargo.angle]),poses);
for(const v of game.antPool){
 assert.equal(v.frames.length,0);assert.ok(v.body instanceof Sprite);
 assert.equal(v.body.spriteFrame.texture,atlas);assert.equal(v.cargoSprite.spriteFrame.texture,atlas);
 assert.equal(v.body.spriteFrame,game.antFrames[v.frame]);
 assert.equal(v.cargoSprite.spriteFrame,game.antFrames[3]);
 assert.equal(v.body.node.getComponent(cc.UITransform).width,32);
 assert.equal(v.cargo.getComponent(cc.UITransform).width,32);
 assert.equal(v.cargo.getComponent(Graphics),null);
 assert.equal(v.body.spriteFrame.originalSize.width,64);
 assert.equal(v.body.spriteFrame.originalSize.height,64);
}
const drawsBeforeAtlas=draws;
for(let i=0;i<180;i++)game.update(1/60);
assert.equal(draws,drawsBeforeAtlas,'atlas workers must not tessellate vector geometry');
for(const f of game.flights)assert.equal(f.visual.body.spriteFrame,game.antFrames[f.visual.frame]);
console.log('Shared atlas replaces live workers without changing poses, cargo or walk frames.');
game.drawBoard=boardDraw;game.startLevel(0);assert.ok(game.antPool.every(v=>!v.node.active));
// Recolored pooled workers and newly allocated workers share exactly one texture.
for(let c=0;c<PALETTE.length;c++){
 const v=game.acquireAnt(c);
 assert.equal(v.body.spriteFrame,game.antFrames[0]);
 assert.equal(v.cargoSprite.spriteFrame,game.antFrames[3]);
 assert.equal(v.cargoSprite.spriteFrame.rect.x,3*64);
 assert.equal(v.cargoSprite.spriteFrame.rect.y,0);
 assert.equal(v.bodyDetail.spriteFrame,game.antFrames[4]);
 assert.equal(v.cargoDetail.spriteFrame,game.antFrames[7]);
 assert.equal(v.body.color.r,parseInt(PALETTE[c].slice(1,3),16));
 assert.equal(v.cargoSprite.color.g,parseInt(PALETTE[c].slice(3,5),16));
 game.releaseAnt(v);
}


// Short taps place; holds preview without placing, and cancellation never commits.
game.startLevel(0);
let card=game.cardViews.find(v=>v.row===0),moves=game.model.moves;
card.node.emit('start');game.update(.3);
assert.equal(game.hold.shown,true);assert.match(game.queueCount.string,/同色/);
card.node.emit('end');assert.equal(game.model.moves,moves);assert.equal(game.hold,null);assert.ok(game.hintRows.every(g=>g.commands.length===0));
card.node.emit('start');card.node.emit('end');assert.equal(game.model.moves,moves+1);
card=game.cardViews.find(v=>v.row===0);
card.node.emit('start');game.update(.3);card.node.emit('cancel');card.node.emit('end');assert.equal(game.model.moves,moves+1);
card.node.emit('start');card.node.emit('move',{getUILocation:()=>({x:30,y:0}),getUIStartLocation:()=>({x:0,y:0})});card.node.emit('end');assert.equal(game.model.moves,moves+1);
const secondRow=game.cardViews.find(v=>v.row===1);secondRow.node.emit('start');game.update(.3);assert.equal(game.hold.shown,true);secondRow.node.emit('end');assert.equal(game.model.moves,moves+1);
card.node.emit('start');game.update(.3);game.hideHandler();assert.equal(game.hold,null);game.showHandler();card.node.emit('end');assert.equal(game.model.moves,moves+1);
// A held slot previews and clears when its jar disappears.
const slot=game.slotViews.find(v=>v.id>=0);slot.art.node.emit('start');game.update(.3);assert.ok(game.hold.shown);slot.art.node.emit('end');assert.equal(game.model.moves,moves+1);
// Reconstruct from the immutable artwork, persist immediately, and allow skipping.
game.startLevel(0);const originalPixels=[...game.model.level.pixels];game.model.pixels.fill(-1);game.model.collected=game.model.level.pixels.length;game.model.remaining=0;
game.victory();let celebration=game.celebration;
assert.ok(game.save.completed.includes(0));assert.equal(celebration.actions.active,false);assert.equal(celebration.rows.length,GRID_HEIGHT);
assert.equal(celebration.rows.reduce((sum,r)=>sum+r.getComponent(Graphics).commands.length,0),GRID_WIDTH*GRID_HEIGHT);
assert.deepEqual([...game.model.level.pixels],originalPixels);
game.update(.05);const beforePause=celebration.elapsed;game.hideHandler();game.update(.05);assert.equal(celebration.elapsed,beforePause);game.showHandler();
for(let i=0;i<70;i++)game.update(.05);
assert.equal(game.celebration,null);assert.equal(celebration.actions.active,true);assert.equal(celebration.album.active,true);assert.equal(celebration.skip.active,false);
assert.ok(celebration.rows.every(r=>r.active&&r.scale.x===1));assert.equal(celebration.art.scale.x,.72);
game.startLevel(0);game.victory();celebration=game.celebration;celebration.skip.emit('end');assert.equal(game.celebration,null);assert.equal(celebration.actions.active,true);assert.equal(game.save.completed.filter(i=>i===0).length,1);
game.startLevel(1);assert.equal(game.modal,null);assert.equal(game.celebration,null);assert.equal(game.won,false);
console.log('Hold preview, cancellation, backgrounding, collection animation and skip checks passed.');

// Whole-picture highlight includes covered and reserved pixels and updates only dirty rows.
game.startLevel(0);game.model=new GardenModel({name:'highlight',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:Array(PIXEL_COUNT).fill(0),capacity:PIXEL_COUNT});
game.model.place(game.model.queue[0].id);game.drawSlots();game.drawQueue();
const previewNode=game.slotViews[0].art.node;previewNode.emit('start');game.updatePreview(.3);
assert.equal(game.hintCounts.reduce((a,b)=>a+b,0),PIXEL_COUNT);assert.ok(game.hintRows[0].commands.length>0);
const pending=game.model.pick();game.updatePreview(.1);assert.equal(game.hintCounts.reduce((a,b)=>a+b,0),PIXEL_COUNT);
let clears=Array(GRID_HEIGHT).fill(0);for(let i=0;i<GRID_HEIGHT;i++){const clear=game.hintRows[i].clear.bind(game.hintRows[i]);game.hintRows[i].clear=()=>{clears[i]++;clear();};}
for(let i=0;i<60;i++)game.updatePreview(1/60);assert.equal(clears.reduce((a,b)=>a+b,0),0,'idle hold must not redraw the picture');
game.model.lift(pending);game.drawPreview(new Set([GRID_HEIGHT-1]));assert.equal(game.hintCounts.reduce((a,b)=>a+b,0),(PIXEL_COUNT-1));assert.equal(clears[GRID_HEIGHT-1],1);assert.ok(clears.slice(0,GRID_HEIGHT-1).every(n=>n===0));
previewNode.emit('end');assert.ok(game.hintRows.every(g=>g.commands.length===0));
// UI loop must dispatch to a newly exposed column while another bottom worker travels.
game.startLevel(0);game.model=new GardenModel({name:'dispatch',subtitle:'',width:8,height:3,pixels:Array(24).fill(0),capacity:24});
game.model.place(game.model.queue[0].id);const bottomJobs=Array.from({length:8},()=>game.model.pick());game.model.lift(bottomJobs[0]);game.dispatchClocks.fill(.5);
game.drawSlots();game.update(.016);assert.equal(game.flights.length,1);assert.ok(game.flights[0].pickup.pixel < 16);
console.log('Whole-picture highlight caching and non-blocking bottom-first dispatch checks passed.');

// Five independent dispatchers keep launching at intervals even above three in flight.
// Keep more containers queued so this checks ordinary 1x dispatch, not finishing.
game.startLevel(0);game.model=new GardenModel({name:'parallel',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:Array(PIXEL_COUNT).fill(0),capacity:PIXEL_COUNT/10},()=>.5);
for(let slot=0;slot<5;slot++)game.model.place(game.model.queue[0].id);
const dispatched=[],pickParallel=game.model.pick.bind(game.model);
game.model.pick=(...args)=>{const pickup=pickParallel(...args);if(pickup)dispatched.push(pickup);return pickup;};
game.drawSlots();game.drawQueue();game.update(.016);
assert.equal(game.flights.length,5);assert.equal(new Set(game.flights.map(f=>f.pickup.slot)).size,5);
for(let i=0;i<9;i++)game.update(.05);
assert.equal(game.flights.length,5,'must not dispatch before 0.5 seconds');
for(let i=0;i<13;i++)game.update(.05);
assert.equal(game.flights.length,15);
for(let slot=0;slot<5;slot++)assert.equal(game.flights.filter(f=>f.pickup.slot===slot).length,3);
game.update(.05);assert.equal(game.flights.length,15);
assert.equal(new Set(game.flights.map(f=>f.pickup.pixel)).size,15);
for(let i=0;i<21;i++)game.update(.05);
assert.equal(dispatched.length,25,'all five containers should keep launching independently of earlier arrivals');
for(let slot=0;slot<5;slot++)assert.equal(dispatched.filter(p=>p.slot===slot).length,5);
assert.equal(new Set(dispatched.map(p=>p.pixel)).size,25);
console.log('Five slots independently dispatch beyond three in flight; interval and pixel reservations preserved.');

// Container labels decrement in the departure frame, stay stable on delivery,
// and release the slot on the final departure, before the ant returns.
game.startLevel(0);game.model=new GardenModel({name:'counter',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:Array(PIXEL_COUNT).fill(0),capacity:2});
game.model.place(game.model.columns[0][0].id);game.drawSlots();game.drawQueue();assert.equal(game.slotLabels[0].string,'2');
game.update(.016);assert.equal(game.slotLabels[0].string,'1');assert.equal(game.model.collected,0);
const firstTrip=game.flights[0];game.model.lift(firstTrip.pickup);firstTrip.lifted=true;firstTrip.phase='enter';firstTrip.elapsed=.35;
game.update(.016);assert.equal(game.slotLabels[0].string,'1','arrival must not decrement again');
game.drawSlots();assert.equal(game.slotLabels[0].string,'1','redraw preserves undispatched count');
game.dispatchClocks[0]=.5;game.update(.016);assert.equal(game.slotLabels[0].string,'');assert.equal(game.model.slots[0],null);
assert.equal(game.slotViews[0].container.active,false,'final departure immediately removes the box');
game.drawSlots();assert.equal(game.slotLabels[0].string,'','redraw cannot restore an empty container');
// Reuse immediately while the previous jar's final trip is still in flight.
game.model.place(game.model.queue[0].id);game.drawSlots();const replacement=game.model.slots[0];
game.dispatchJarIds[0]=replacement.id;game.dispatchClocks[0]=0;
const lastTrip=game.flights[0];game.model.lift(lastTrip.pickup);lastTrip.lifted=true;lastTrip.phase='enter';lastTrip.elapsed=.35;
game.update(.016);assert.equal(game.slotLabels[0].string,'2');assert.equal(game.model.slots[0],replacement);
console.log('Dispatch counters update immediately; deliveries never double-decrement.');

// Actual elapsed time must include slow foreground frames, but exclude pauses.
game.startLevel(0);game.update(.2);assert.equal(game.elapsed,.2);game.hideHandler();game.update(1);assert.equal(game.elapsed,.2);game.showHandler();game.settings();game.update(1);assert.equal(game.elapsed,.2);game.closeModal();game.update(.1);assert.ok(Math.abs(game.elapsed-.3)<1e-9);
console.log('Foreground timing and pause checks passed.');

// Full animation lifecycle through many capacity-40 jar replacements, using the
// shipped current catalog dimensions. Check displayed values every frame, not just at launch.
game.startLevel(0);game.model=new GardenModel({name:'full counter lifecycle',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:Array(PIXEL_COUNT).fill(0),capacity:40});
game.drawSlots();game.drawQueue();game.drawBoard();game.speed=2;
let fullFrames=0;
while(!game.won&&fullFrames++<50000){
 let placed=false;
 while(game.model.slots.includes(null)&&game.model.queue.length){game.model.place(game.model.queue[0].id);placed=true;}
 if(placed){game.drawSlots();game.drawQueue();}
 game.update(.05);
 assert.equal(game.flights.length,game.model.inFlight);
 for(let slot=0;slot<5;slot++){
  const jar=game.model.slots[slot];
  assert.equal(game.slotLabels[slot].string,jar?String(game.model.undispatched(slot)):'');
  if(jar){assert.ok(game.model.undispatched(slot)>0);assert.ok(game.model.undispatched(slot)<=jar.capacity);}
 }
}
assert.equal(game.won,true);assert.equal(game.model.collected,PIXEL_COUNT);assert.equal(game.flights.length,0);assert.equal(game.model.queue.length,0);
console.log(JSON.stringify({fullAnimationFrames:fullFrames,delivered:game.model.collected,replacedContainers:game.model.moves,allFrameCounters:'passed'}));

// A target with an occupied bottom/left/right must be approached from its open top.
game.startLevel(0);
const topPixels=Array(PIXEL_COUNT).fill(0),topTarget=(GRID_HEIGHT-3)*GRID_WIDTH+20;topPixels[topTarget]=1;
game.model=new GardenModel({name:'top approach',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:topPixels,capacity:PIXEL_COUNT});
for(const p of [(GRID_HEIGHT-1)*GRID_WIDTH+18,(GRID_HEIGHT-2)*GRID_WIDTH+18,(GRID_HEIGHT-3)*GRID_WIDTH+18,(GRID_HEIGHT-4)*GRID_WIDTH+18,(GRID_HEIGHT-4)*GRID_WIDTH+19,(GRID_HEIGHT-4)*GRID_WIDTH+20])game.model.pixels[p]=-1;
const topJar=game.model.queue.find(j=>j.color===1);game.model.place(topJar.id);game.drawSlots();game.drawQueue();game.update(.016);
assert.equal(game.flights.length,1);const topTrip=game.flights[0];assert.equal(topTrip.pickup.pixel,topTarget);
assert.equal(topTrip.pickup.approach.x,20);assert.equal(topTrip.pickup.approach.y,GRID_HEIGHT-4);
const topEnd=topTrip.path.at(-1);assert.ok(Math.abs(topEnd.y-(608-(GRID_HEIGHT-3.5)*CELL_SIZE))<1e-8);
for(let i=0;i<500&&(topTrip.phase==='launch'||topTrip.phase==='outbound');i++)game.update(.05);
assert.equal(topTrip.phase,'grasp');assert.equal(topTrip.lifted,true);
assert.ok(Math.abs(topTrip.visual.node.angle+90)<1e-8,'ant must face down to grip a block below it');
assert.ok(Math.abs(topTrip.path[0].x-topEnd.x)<1e-8&&Math.abs(topTrip.path[0].y-topEnd.y)<1e-8,'return must start at the actual contact point');
for(let i=0;i<500&&game.flights.length;i++)game.update(.05);
assert.equal(game.flights.length,0);assert.equal(game.model.collected,1);
console.log('Top-side pickup, gripping orientation and continuous return route passed.');

// Exercise the production RETURN route, including reversal and world/grid conversion.
game.startLevel(0);const maze=Array(PIXEL_COUNT).fill(0);
for(let y=GRID_HEIGHT-7;y<GRID_HEIGHT;y++)maze[y*GRID_WIDTH+18]=-1;
for(let x=18;x<=23;x++)maze[(GRID_HEIGHT-7)*GRID_WIDTH+x]=-1;
maze[(GRID_HEIGHT-6)*GRID_WIDTH+23]=-1; // picked block; contact is above, lower wall still blocks direct return
const routeModel=new GardenModel({name:'return wall',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:Array(PIXEL_COUNT).fill(0),capacity:40});
routeModel.pixels=maze;game.model=routeModel;
const returning=game.antRoute((GRID_HEIGHT-6)*GRID_WIDTH+23,true,0,{x:23,y:GRID_HEIGHT-7});
assert.ok(returning.length>2,'return must bend around the occupied wall');
const routing=load(process.cwd()+'/assets/scripts/routing.ts');
const toGrid=p=>({x:(p.x+292)/CELL_SIZE-.5,y:(608-p.y)/CELL_SIZE-.5});
for(let i=1;i<returning.length;i++)assert.ok(routing.clearSegment({width:GRID_WIDTH,height:GRID_HEIGHT,pixels:maze},toGrid(returning[i-1]),toGrid(returning[i]),.45-1e-8),'every return segment needs clearance');
assert.equal(returning.at(-1).x,0);assert.ok(Math.abs(returning.at(-1).y+203)<1e-8);
console.log('Actual return route bends around remaining pixels with clearance.');

// Level selection exposes unlocked levels and keeps locked levels unavailable.
game.showHome();game.levelPicker();
assert.equal(game.modal.children.filter(n=>n.name.includes('第 ')).length,10);
game.save.unlocked=0;game.levelPicker();
assert.equal(game.modal.children.filter(n=>n.name.includes('第 1 关')).length,1);
assert.doesNotThrow(()=>game.modal.children.find(n=>n.name.includes('第 2 关')).emit('end'));
game.save.unlocked=LEVEL_COUNT-1;game.startLevel(LEVEL_COUNT-1);game.victory();assert.equal(game.save.unlocked,LEVEL_COUNT-1);assert.ok(game.save.completed.includes(LEVEL_COUNT-1));game.finishCelebration();
assert.ok(game.modal.children.some(n=>n.name==='Collection actions'&&n.children.some(c=>c.name==='完成全部关卡')));
console.log('Sequential unlock and level selection passed.');

// Real dispatch starts at each card, rather than choosing the board centre.
game.startLevel(0);
game.model=new GardenModel({name:'nearby',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:Array(PIXEL_COUNT).fill(0),capacity:Math.ceil(PIXEL_COUNT/5)});
while(game.model.slots.includes(null))game.model.place(game.model.visibleQueue.find(v=>v.row===0).jar.id);
game.update(.01);
assert.equal(game.flights.find(f=>f.pickup.slot===0).pickup.pixel,(GRID_HEIGHT-1)*GRID_WIDTH+Math.round((-228+292)/CELL_SIZE-.5));
assert.equal(game.flights.find(f=>f.pickup.slot===4).pickup.pixel,(GRID_HEIGHT-1)*GRID_WIDTH+Math.round((228+292)/CELL_SIZE-.5));
assert.equal(new Set(game.flights.map(f=>f.pickup.pixel)).size,5);
console.log('Five cards select distinct nearby targets from their own departure positions.');

// Mobile overlays run on the home screen and pause gameplay while a drawer is open.
game.startLevel(0);game.settings();
assert.equal(game.modal.name,'Bottom drawer');
const drawer=game.drawerSheet,elapsed=game.elapsed;
for(let i=0;i<8;i++)game.update(.05);
assert.equal(drawer.position.y - drawer.getComponent(cc.UITransform).height / 2, -game.screenHeight / 2);assert.equal(game.elapsed,elapsed);
game.notify('奖励已收下','30 金币已经放进你的小窝','success');
assert.equal(game.notification.node.name,'Notification');
game.hideHandler();game.update(1);assert.equal(game.notification.elapsed,0);game.showHandler();
game.modal.children.find(n=>n.name==='Drawer mask').emit('end');
assert.equal(game.drawerMotion.closing,true);
for(let i=0;i<8;i++)game.update(.05);
assert.equal(game.modal,null);assert.equal(game.drawerSheet,null);
assert.ok(game.notification,'closing drawer must not remove notification');
game.startLevel(0);game.settings();
assert.ok(game.drawerSheet.children.some(n=>n.name==='返回主页'));
assert.ok(game.drawerSheet.children.some(n=>n.name==='重新开始'));
assert.ok(game.drawerSheet.children.some(n=>n.name==='继续游戏'));
game.drawerSheet.children.find(n=>n.name==='继续游戏').emit('end');
assert.equal(game.rewardAdDemo,null,'resuming from settings must not request an ad');
for(let i=0;i<8;i++)game.update(.05);
assert.equal(game.modal,null,'continue dismisses the drawer just like its close button');
game.startLevel(0);game.showBlocked();
assert.ok(game.modal.children.some(n=>n.name==='重新开始')&&game.modal.children.some(n=>n.name==='解锁槽位'));
assert.ok(!game.modal.children.some(n=>n.name==='查看画册'));
game.modal.children.find(n=>n.name==='解锁槽位').emit('end');
assert.equal(game.modal.name,'Dialog');
completeTestAd();
assert.equal(game.modal,null,'blocked expansion should close after returning from sharing');
assert.equal(game.model.slots.length,6);
game.showHome();for(let i=0;i<72;i++)game.update(.05);assert.equal(game.notification,null);
game.nestShop();for(let i=0;i<8;i++)game.update(.05);
assert.equal(game.drawerSheet.position.y - game.drawerSheet.getComponent(cc.UITransform).height / 2, -game.screenHeight / 2);
game.closeModal();game.startLevel(0);game.restart();
assert.ok(game.modal.getComponent(Graphics).commands.some(c=>c.kind==='polygon'&&c.p.length>100),'confirmation uses original organic modal contour');
game.modal.children.find(n=>n.name==='继续游戏').emit('end');assert.equal(game.modal,null);
game.showHome();game.rewards();
const rewardAction=game.modal.children.find(n=>n.name==='领取全部');
assert.ok(rewardAction);const coinsBefore=game.save.coins;rewardAction.emit('end');
assert.ok(game.save.coins>coinsBefore);assert.equal(game.modal,null);assert.ok(game.notification);
console.log('Drawer entry/exit, mask dismissal, gameplay pause, notification lifetime and reward feedback passed.');
// Commerce feedback keeps the drawer and gameplay context intact.
game.startLevel(0);game.save.coins=0;game.nestShop();for(let i=0;i<8;i++)game.update(.05);
const shopDrawer=game.modal;
game.nestShopContent.children.find(n=>n.name==='兑换').emit('end');
assert.equal(game.save.coins,0);assert.equal(game.modal,shopDrawer);assert.ok(game.notification);assert.equal(game.home,null);
game.notification.node.children.find(n=>n.name==='Dismiss notification').emit('end');assert.equal(game.notification,null);
game.drawerSheet.children.find(n=>n.name==='Drawer handle').emit('end',{getUIStartLocation:()=>({y:100}),getUILocation:()=>({y:40})});
for(let i=0;i<8;i++)game.update(.05);assert.equal(game.modal,null);
console.log('Insufficient funds stay in drawer; notification close and downward handle dismissal passed.');

// Tall phones and wider screens fill the viewport without cropping the game board.
for(const frame of [{width:390,height:844},{width:768,height:1024}]){
 cc.view.getFrameSize=()=>frame;
 const responsive=new PixelGarden();responsive.onLoad();
 assert.ok(Math.abs(responsive.screenWidth/responsive.screenHeight-frame.width/frame.height)<1e-9);
 assert.ok(responsive.screenWidth>=750&&responsive.screenHeight>=1500);
 const background=responsive.home.children.find(n=>n.components.some(c=>c instanceof Graphics)).getComponent(Graphics).commands[0];
 assert.equal(background.p[2],responsive.screenWidth);assert.equal(background.p[3],responsive.screenHeight);
 assert.equal(responsive.home.children.find(n=>n.name==='Settings menu').position.x,-286);
 assert.ok(responsive.home.children.some(n=>n.position.x===216&&n.components.some(c=>c instanceof Label&&c.string.startsWith('金币'))));
 assert.ok(!responsive.home.children.some(n=>n.components.some(c=>c instanceof Label&&c.string.includes('和小蚂蚁一起'))));
 const homeTexture=new Texture2D();homeTexture.width=768;homeTexture.height=1152;
 resourceLoads.get('home/garden/texture')(null,homeTexture);
 const landscape=responsive.homeScene;
 assert.equal(landscape.spriteFrame.texture,homeTexture);
 const crop=landscape.spriteFrame.rect;
 assert.ok(crop.x>=0&&crop.y>=0&&crop.x+crop.width<=768&&crop.y+crop.height<=1152);
 assert.ok(Math.abs(crop.width/crop.height-frame.width/frame.height)<1e-9);
 assert.equal(homeTexture.refs,1);
 const titleTexture=new Texture2D();titleTexture.width=1128;titleTexture.height=376;
 resourceLoads.get('home/title/texture')(null,titleTexture);
 assert.equal(responsive.homeTitle.spriteFrame.texture,titleTexture);
 assert.equal(titleTexture.refs,1);
 assert.ok(!responsive.home.children.some(n=>n.components.some(c=>c instanceof Label&&c.string==='生态蚂蚁窝')));
 const titleBounds=responsive.homeTitle.node.getComponent(cc.UITransform);
 assert.equal(titleBounds.width/titleBounds.height,titleTexture.width/titleTexture.height);
 const headerBottom=633-68/2,paintingTop=315+155/2+4;
 assert.ok(responsive.homeTitle.node.position.y+titleBounds.height/2<headerBottom);
 assert.ok(responsive.homeTitle.node.position.y-titleBounds.height/2>paintingTop);
 const actionTextures=[];
 for(const name of ['play','album','shop','rank']){
  const texture=new Texture2D();texture.width=name==='play'?1260:304;texture.height=name==='play'?200:272;
  actionTextures.push(texture);resourceLoads.get(`home/${name}/texture`)(null,texture);
  const find=node=>node.name===`Home asset ${name}`?node:node.children.map(find).find(Boolean);
  assert.equal(find(responsive.home).getComponent(Sprite).spriteFrame.texture,texture);
  assert.equal(texture.refs,1);
 }
 responsive.showHome();assert.equal(responsive.homeScene.spriteFrame.texture,homeTexture);
 assert.equal(responsive.homeTitle.spriteFrame.texture,titleTexture);
 const controls=['开始游戏','关卡','装修','排行榜'];
 for(const name of controls){
  const node=responsive.home.children.find(n=>n.name===name),bounds=node.getComponent(cc.UITransform);
  assert.ok(Math.abs(node.position.x)+bounds.width/2<=responsive.screenWidth/2);
  assert.ok(Math.abs(node.position.y)+bounds.height/2<=responsive.screenHeight/2-60);
  node.emit('start');assert.equal(node.scale.x,.96);
  node.emit('cancel');assert.equal(node.scale.x,1);
  assert.equal(responsive.modal,null);assert.ok(responsive.home);
 }
 const play=responsive.home.children.find(n=>n.name==='开始游戏');
 assert.ok(play.children.some(n=>n.name==='Level paper tag'));
 play.emit('end');assert.equal(responsive.home,null);assert.equal(responsive.gameRoot.active,true);
 responsive.showHome();
 const resume=responsive.home.children.find(n=>n.name==='继续游戏');
 assert.ok(resume);assert.equal(resume.children.find(n=>n.name==='Home asset play').getComponent(Sprite).spriteFrame,responsive.homeActionFrames.get('play'));
 resume.emit('end');assert.equal(responsive.home,null);
 responsive.showHome();
 responsive.home.children.find(n=>n.name==='关卡').emit('end');assert.ok(responsive.modal);responsive.closeModal();
 responsive.home.children.find(n=>n.name==='排行榜').emit('end');assert.ok(responsive.modal);responsive.closeModal();
 responsive.nestShop();for(let i=0;i<8;i++)responsive.update(.05);
 assert.ok(Math.abs(responsive.drawerSheet.position.y-responsive.drawerSheet.getComponent(cc.UITransform).height/2+responsive.screenHeight/2)<1e-9);
 assert.ok(!responsive.drawerSheet.children.some(n=>n.name==='完成'));
 const mask=responsive.modal.children.find(n=>n.name==='Drawer mask').getComponent(Graphics).commands[0];
 assert.equal(mask.p[2],responsive.screenWidth);assert.equal(mask.p[3],responsive.screenHeight);
 responsive.closeModal();responsive.onDestroy();assert.equal(homeTexture.refs,0);
 assert.equal(titleTexture.refs,0);assert.equal(responsive.homeTitleFrame.destroyed,true);
 assert.ok(actionTextures.every(texture=>texture.refs===0));
}
cc.view.getFrameSize=()=>({width:750,height:1500});
console.log('Tall/wide viewport backgrounds, drawer bottom anchoring, header order and compact shop passed.');

// Reward entry is conditional, claims once, and disappears immediately after claiming.
game.showHome();
assert.ok(!game.home.children.some(n=>n.name.startsWith('领取奖励')));
game.save.daily='';game.showHome();
const claim=game.home.children.find(n=>n.name.startsWith('领取奖励'));
assert.ok(claim);const beforeClaim=game.save.coins;
claim.emit('end');assert.equal(game.save.coins,beforeClaim+30);
assert.ok(!game.home.children.some(n=>n.name.startsWith('领取奖励')));
claim.emit('end');assert.equal(game.save.coins,beforeClaim+30,'stale double tap cannot grant rewards twice');
game.save.completed.push(3);game.showHome();
assert.ok(game.home.children.some(n=>n.name==='领取奖励  +100 金币'));
const homeCopy=game.home.children.flatMap(n=>n.components.filter(c=>c instanceof Label).map(c=>c.string));
assert.ok(!homeCopy.some(s=>s.includes('已收集')||s.includes('小 窝 生 活')||s.includes('归处')||s.includes('进度保存在')));
console.log('Minimal home copy and conditional, idempotent reward claim passed.');

// Music waits for interaction, fades in, respects separate toggles and app lifecycle.
const audioGame=new PixelGarden();audioGame.onLoad();audioGame.music.clip={};
audioGame.syncMusic();assert.equal(audioGame.music.playing,false);
audioGame.play('tap');assert.equal(audioGame.music.playing,true);
for(let i=0;i<30;i++)audioGame.update(.05);
assert.equal(audioGame.music.volume,.22);
audioGame.hideHandler();assert.equal(audioGame.music.playing,false);
audioGame.showHandler();assert.equal(audioGame.music.playing,true);
audioGame.save.music=false;audioGame.syncMusic();assert.equal(audioGame.music.playing,false);
audioGame.hideHandler();audioGame.showHandler();assert.equal(audioGame.music.playing,false);
audioGame.save.sound=false;audioGame.save.music=true;audioGame.play('tap');assert.equal(audioGame.music.playing,true);
audioGame.onDestroy();assert.equal(audioGame.music.playing,false);
console.log('Music gesture gate, fade-in, independent mute, background pause and teardown passed.');

// Loaded custom font updates existing screens and is reused by later labels.
let fontCallback;
const originalLoad=cc.resources.load;
cc.resources.load=(path,type,callback)=>{if(path==='fonts/ant-nest-bitmap')fontCallback=callback;};
const fontGame=new PixelGarden();fontGame.onLoad();const fontAsset={name:'Ant Nest Heavy'};
fontCallback(null,fontAsset);
function checkFont(node){
 for(const c of node.components)if(c instanceof Label){assert.equal(c.font,fontAsset);assert.equal(c.isBold,false);}
 for(const child of node.children)checkFont(child);
}
checkFont(fontGame.home);fontGame.startLevel(0);
assert.equal(fontGame.levelLabel.color.r,98);assert.equal(fontGame.levelLabel.enableOutline,false);
assert.ok(fontGame.speedLabel.node.parent.getComponent(cc.UITransform).height>=88);
assert.equal(fontGame.queueCount.string,'已收集 0%');
fontGame.model.collected=fontGame.model.level.pixels.length/2;fontGame.update(.016);assert.equal(fontGame.queueCount.string,'已收集 50%');
for(const card of fontGame.cardViews){assert.equal(card.label.font,fontAsset);assert.equal(card.label.enableOutline,false);assert.equal(card.label.color.r,73);}
fontGame.settings();checkFont(fontGame.drawerSheet);fontGame.onDestroy();cc.resources.load=originalLoad;
console.log('Heavy font updates existing and future screens; container counters remain dark on cream.');

// Removing a lower block reveals its neighbor's vertical wall without a full
// board rebuild. This dependency is also required when the atlas is loaded.
game.startLevel(0);game.model=new GardenModel({name:'exposed walls',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:Array(PIXEL_COUNT).fill(0),capacity:Math.ceil(PIXEL_COUNT/5)});
game.model.place(game.model.queue[0].id);game.drawSlots();game.drawBoard();game.update(.016);
const wallTrip=game.flights[0],wallRow=Math.floor(wallTrip.pickup.pixel/GRID_WIDTH);
wallTrip.phase='outbound';wallTrip.elapsed=100;game.update(.016);
assert.equal(wallTrip.lifted,true);assert.deepEqual([...game.dirtyRows].sort((a,b)=>a-b),[wallRow-1,wallRow]);
console.log('Pixel removal redraws its row and the exposed wall above, including atlas workers.');
// Spatial expansion is gated by completion, preserves the original five columns,
// and launches from the unlocked board rather than the main tray.
game.startLevel(0);
const originalSlotPositions=game.slotViews.slice(0,5).map(v=>({...v.art.node.position}));
assert.ok(!game.gameRoot.children.some(n=>n.name==='打乱容器'||n.name==='扩展槽位'||n.name==='开启二倍速'));
assert.equal(typeof game.requestShuffle,'undefined');
game.expansionBoard.emit('end');
assert.ok(game.modal);
assert.equal(game.model.slots.length,5);
game.modal.children.find(n=>n.name==='取消').emit('end');
for(let i=0;i<70;i++)game.update(.05);
assert.equal(game.model.slots.length,5,'cancelled ad never grants a slot');
assert.equal(game.expansionBoard.active,true);
game.expansionBoard.emit('end');
completeTestAd();
assert.equal(game.model.slots.length,6);
assert.equal(game.expansionBoard.active,true);
assert.equal(game.expansionBoard.position.x,114);
assert.deepEqual(game.slotViews.slice(0,5).map(v=>({...v.art.node.position})),originalSlotPositions);
const {EXTRA_SLOT_X,EXTRA_SLOT_Y}=load(process.cwd()+'/assets/scripts/boardLayout.ts');
const sixth=game.slotViews[5];
assert.equal(sixth.art.node.position.x,EXTRA_SLOT_X);
assert.equal(sixth.art.node.position.y,EXTRA_SLOT_Y);
// Use identical, exposed colors so availability does not depend on generated art.
game.model=new GardenModel({name:'six-slot launch',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:Array(PIXEL_COUNT).fill(0),capacity:100});
game.model.slots.push(null);
for(let i=0;i<6;i++){const jar=game.model.visibleQueue.find(v=>v.row===0).jar;assert.equal(game.model.place(jar.id),i);}
game.drawSlots();game.drawQueue();game.update(.016);
const extraTrip=game.flights.find(f=>f.pickup.slot===5);
assert.ok(extraTrip,'the unlocked slot dispatches its own worker');
assert.equal(extraTrip.launchOrigin.x,EXTRA_SLOT_X);
assert.equal(extraTrip.launchOrigin.y,EXTRA_SLOT_Y+25);
assert.ok(sixth.launchElapsed>=0);
game.startLevel(0);
const columns=[4,3,1,0];
for(let step=0;step<4;step++){
 assert.equal(game.expansionBoard.active,true);
 assert.equal(game.expansionBoard.position.x,(columns[step]-2)*114);
 game.expansionBoard.emit('end');
 assert.equal(game.model.slots.length,5+step,'reward only arrives on completion');
 if(step===1){
  game.modal.children.find(n=>n.name==='取消').emit('end');
  assert.equal(game.model.slots.length,6);
  assert.equal(game.expansionBoard.position.x,114);
  game.expansionBoard.emit('end');
 }
 completeTestAd();
 assert.equal(game.model.slots.length,6+step);
 assert.equal(game.slotViews[5+step].art.node.position.x,(columns[step]-2)*114);
 assert.equal(game.slotViews[5+step].art.node.position.y,EXTRA_SLOT_Y);
 assert.deepEqual(game.slotViews.slice(0,5).map(v=>({...v.art.node.position})),originalSlotPositions);
}
assert.equal(game.expansionBoard.active,false);
game.requestSlotExpansion();assert.equal(game.model.slots.length,9);assert.equal(game.modal,null);
game.model=new GardenModel({name:'nine-slot launch',subtitle:'',width:GRID_WIDTH,height:GRID_HEIGHT,pixels:Array(PIXEL_COUNT).fill(0),capacity:100});
for(let i=0;i<4;i++)game.model.slots.push(null);
for(let i=0;i<9;i++)assert.equal(game.model.place(game.model.visibleQueue.find(v=>v.row===0).jar.id),i);
game.drawSlots();game.drawQueue();game.update(.016);
for(let i=0;i<4;i++){
 const trip=game.flights.find(f=>f.pickup.slot===5+i);
 assert.ok(trip,'every expanded slot dispatches independently');
 assert.equal(trip.launchOrigin.x,(columns[i]-2)*114);
 assert.equal(trip.launchOrigin.y,EXTRA_SLOT_Y+25);
}
game.startLevel(0);
assert.equal(game.model.slots.length,5);assert.ok(game.slotViews.slice(5).every(v=>!v.art.node.active));
assert.equal(game.expansionBoard.position.x,228);
assert.equal(game.expansionBoard.active,true);assert.equal(game.speedLabel.string,'1×');
game.speedLabel.node.parent.emit('end');
assert.ok(game.modal);game.modal.children.find(n=>n.name==='取消').emit('end');
assert.equal(game.speed,1);
game.speedLabel.node.parent.emit('end');
completeTestAd();
assert.equal(game.speed,2);assert.equal(game.speedLabel.string,'2×');
game.startLevel(0);
game.requestSlotExpansion();
completeTestAd();
game.startLevel(0);
console.log('Spatial ad unlock, cancellation, unchanged five columns, sixth-slot dispatch, restart and compact speed control passed.');
const ownedFrames=[...game.antFrames];game.onDestroy();assert.equal(atlas.refs,0);assert.ok(ownedFrames.every(f=>f.destroyed));

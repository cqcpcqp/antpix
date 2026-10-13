// Exercise real modal navigation and selection bounds without a browser.
const assert=require('node:assert/strict');
const {load}=require('./headless-game.cjs');
const {PixelGarden}=load(process.cwd()+'/assets/scripts/PixelGarden.ts');
const {LEVEL_COUNT}=load(process.cwd()+'/assets/scripts/levels.ts');
const game=new PixelGarden();game.onLoad();game.save.unlocked=LEVEL_COUNT-1;game.save.selected=LEVEL_COUNT-1;
const labels=()=>game.modal.children.filter(n=>/^第 \d+ 关/.test(n.name));
game.levelPicker();
const lastPage=Math.floor((LEVEL_COUNT-1)/10);
assert.ok(labels().some(n=>n.name.startsWith(`第 ${LEVEL_COUNT} 关`)),'selected level opens on its page');
for(let page=lastPage;page>=0;page--){
 const entries=labels();assert.equal(entries.length,Math.min(10,LEVEL_COUNT-page*10));
 assert.equal(new Set(entries.map(n=>n.name)).size,entries.length);
 for(let i=0;i<entries.length;i++){
  assert.ok(entries[i].name.startsWith(`第 ${page*10+i+1} 关`));
  assert.ok(entries[i].position.y>=-160&&entries[i].position.y<=240,'level buttons stay inside the visible modal');
 }
 assert.equal(game.modal.children.some(n=>n.name==='上一页'),page>0);
 assert.equal(game.modal.children.some(n=>n.name==='下一页'),page<lastPage);
 if(page>0)game.modal.children.find(n=>n.name==='上一页').emit('end');
}
for(let page=0;page<lastPage;page++)game.modal.children.find(n=>n.name==='下一页').emit('end');
let picked=-1;game.confirmLevel=index=>picked=index;labels().at(-1).emit('end');assert.equal(picked,LEVEL_COUNT-1);
game.save.unlocked=0;game.levelPicker(lastPage);picked=-1;
if(LEVEL_COUNT>1){labels().at(-1).emit('end');assert.equal(picked,-1,'paging never unlocks a locked level');}
game.onDestroy();console.log(`Level picker: ${LEVEL_COUNT} levels, ${lastPage+1} pages, bounds, navigation and unlock checks passed.`);

// Bake static heavy glyphs so WeChat/iOS never needs to register a system font.
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
const {readFileSync,readdirSync,writeFileSync}=require('node:fs');
GlobalFonts.registerFromPath('assets/resources/fonts/ant-nest-heavy.ttf','GameHeavy');
const chars=new Set(Array.from({length:95},(_,i)=>String.fromCharCode(i+32)));
for(const file of readdirSync('assets/scripts').filter(f=>f.endsWith('.ts')))
 for(const char of readFileSync(`assets/scripts/${file}`,'utf8'))if(char.codePointAt(0)>=160)chars.add(char);
for(const char of readFileSync('cloudfunctions/game/service.js','utf8'))if(char.codePointAt(0)>=160)chars.add(char);
const list=[...chars].sort((a,b)=>a.codePointAt(0)-b.codePointAt(0));
const cell=72,columns=24,width=cell*columns,height=Math.ceil(list.length/columns)*cell;
const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
ctx.font='48px GameHeavy';ctx.textBaseline='alphabetic';ctx.lineJoin='round';
const lines=[`info face="Ant Nest Heavy Bitmap" size=48 bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=0,0`,
 `common lineHeight=65 base=52 scaleW=${width} scaleH=${height} pages=1 packed=0`,
 'page id=0 file="ant-nest-bitmap.png"',`chars count=${list.length}`];
list.forEach((char,i)=>{
 const x=i%columns*cell,y=Math.floor(i/columns)*cell,advance=Math.ceil(ctx.measureText(char).width);
 // White glyphs are tinted by each Label; do not bake an outline into body copy.
 ctx.fillStyle='#FFFFFF';ctx.fillText(char,x+8,y+52);
 const pixels=ctx.getImageData(x,y,cell,cell).data;
 let left=cell,top=cell,right=-1,bottom=-1;
 for(let py=0;py<cell;py++)for(let px=0;px<cell;px++)if(pixels[(py*cell+px)*4+3]>0){
  left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
 }
 const visible=right>=left,w=visible?right-left+1:0,h=visible?bottom-top+1:0;
 // Cocos centers single-line bitmap labels around originFontSize, not commonHeight.
 lines.push(`char id=${char.codePointAt(0)} x=${x+(visible?left:0)} y=${y+(visible?top:0)} width=${w} height=${h} xoffset=0 yoffset=${(48-h)/2} xadvance=${visible?w:advance} page=0 chnl=15`);
});
writeFileSync('assets/resources/fonts/ant-nest-bitmap.png',canvas.toBuffer('image/png'));
writeFileSync('assets/resources/fonts/ant-nest-bitmap.fnt',lines.join('\n')+'\n');
require('node:child_process').execFileSync('python3',['scripts/compress-bitmap-font.py'],{stdio:'inherit'});
console.log(`Bitmap font: ${list.length} glyphs, ${width} x ${height}`);

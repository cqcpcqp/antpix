const assert=require('node:assert/strict');
// Independent oracle: walk from the chosen contact back to the bottom entrance.
module.exports=function assertContact(pixels,width,height,pickup){
 const {pixel,approach:a}=pickup,x=pixel%width,y=Math.floor(pixel/width);
 assert.equal(Math.abs(x-a.x)+Math.abs(y-a.y),1,'must stand at an orthogonal neighbor');
 assert.ok(a.x>=0&&a.x<width&&a.y>=0&&a.y<=height);
 if(a.y===height){assert.equal(y,height-1);return;}
 const start=a.y*width+a.x;assert.equal(pixels[start],-1,'contact cell must be empty');
 const seen=new Set([start]),stack=[start];let connected=false;
 while(stack.length){const p=stack.pop(),px=p%width,py=Math.floor(p/width);if(py===height-1){connected=true;break;}
  for(const [nx,ny] of [[px-1,py],[px+1,py],[px,py-1],[px,py+1]]){
   if(nx<0||nx>=width||ny<0||ny>=height)continue;const n=ny*width+nx;
   if(pixels[n]===-1&&!seen.has(n)){seen.add(n);stack.push(n);}
  }
 }
 assert.ok(connected,'contact must connect to the entrance, not a sealed hole');
};

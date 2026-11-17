from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import sys, subprocess, json
sys.path.insert(0,'/tmp/antpix-video-deps')
import imageio_ffmpeg
root=Path('/Users/cqcpcqp/Projects/antpix');out=root/'art/branding/wechat-promo-20261116/extended'
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
font=root/'art/fonts/noto-NotoSansSC[wght].ttf'
from functools import lru_cache
@lru_cache(None)
def get_font(size):
 f=ImageFont.truetype(str(font),size);f.set_variation_by_axes([800]);return f
ink='#074E49';cream='#FFF9DC'
def text(draw,xy,value,size,fill=ink):
 draw.text(xy,value,font=get_font(size),fill=fill,spacing=14,stroke_width=0)
def fill(im,w,h):
 ratio=max(w/im.width,h/im.height);im=im.resize((round(im.width*ratio),round(im.height*ratio)),Image.Resampling.LANCZOS)
 x=(im.width-w)//2;y=(im.height-h)//2
 return im.crop((x,y,x+w,y+h))
hero=Image.open(out/'promotion-landscape.png').convert('RGB')
cover=Image.open(root/'art/branding/wechat-promo-20261116/cover-master-1664x640.png').convert('RGB')
base=fill(cover,1280,720).filter(ImageFilter.GaussianBlur(28))
base=Image.blend(base,Image.new('RGB',(1280,720),'#E4F6D9'),.87)
shots=[Image.open(root/f'temp/previews/promo-frames/frame-{i:04d}.png').convert('RGB').resize((338,600),Image.Resampling.LANCZOS) for i in range(120)]
last=Image.new('RGB',(1280,720),'#D5F6DF')
last.paste(fill(cover,1280,492),(0,228))
d=ImageDraw.Draw(last)
text(d,(68,28),'再搬一块？',76)
text(d,(72,134),'生态蚂蚁窝 · 等你来开工',39)
frames=[]
for frame in range(450):
 t=frame/30
 if t<3:
  scale=1+.018*t/3
  im=fill(hero,round(1280*scale),round(720*scale))
  x=(im.width-1280)//2;y=(im.height-720)//2
  im=im.crop((x,y,x+1280,y+720))
 elif t<11:
  im=base.copy();d=ImageDraw.Draw(im)
  text(d,(66,135),'选个颜色',58)
  text(d,(66,215),'小蚂蚁就开工',43)
  text(d,(74,340),'颜色选得妙',32)
  text(d,(74,390),'像素搬得快',32)
  d.rounded_rectangle((457,44,817,660),radius=25,fill=cream)
  index=min(119,int((t-3)/8*120))
  im.paste(shots[index],(468,52))
  text(d,(866,162),'一块一块搬',41)
  text(d,(866,231),'越看越解压',41)
  text(d,(866,372),'就想再来一关',32)
  text(d,(475,677),'玩法画面 · 离线渲染 / 加速展示',17,'#426B5D')
 else:
  im=last.copy()
  d=ImageDraw.Draw(im)
  if (t-11)%1.5<1.1: text(d,(884,83),'来玩一关',42)
 if t<.35: im=Image.blend(Image.new('RGB',(1280,720),'#D5F6DF'),im,t/.35)
 if t>14.6: im=Image.blend(im,Image.new('RGB',(1280,720),'#D5F6DF'),(t-14.6)/.4)
 if frame in [30,150,270,375]: im.save(out/f'video-preview-{frame:03d}.jpg',quality=90)
 frames.append(im)
silent=out/'video-silent.mp4'
proc=subprocess.Popen([ffmpeg,'-hide_banner','-loglevel','error','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','30','-i','-','-an','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(silent)],stdin=subprocess.PIPE)
for im in frames: proc.stdin.write(im.tobytes())
proc.stdin.close();assert proc.wait()==0
final=out/'promotion-video-15s.mp4'
subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(silent),'-stream_loop','-1','-i',str(root/'assets/resources/audio/garden-bgm.mp3'),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','128k','-af','volume=0.45,afade=t=in:st=0:d=0.4,afade=t=out:st=14:d=1','-t','15','-movflags','+faststart',str(final)],check=True)
silent.unlink()
print(final,final.stat().st_size,flush=True)

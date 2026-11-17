from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,shutil,zipfile
root=Path('/Users/cqcpcqp/Projects/antpix');base=root/'art/branding/wechat-promo-20261116';out=base/'extended';upload=out/'upload';upload.mkdir(exist_ok=True)
images=[('promotion-landscape.png','01-promotion-landscape.jpg',(1920,1080)),('promotion-portrait-final.png','02-promotion-portrait.jpg',(1080,1620)),('share-challenge.png','03-share-challenge.jpg',(1000,800)),('share-funny.png','04-share-funny.jpg',(1000,800)),('share-relax.png','05-share-relax.jpg',(1000,800))]
report=[]
for src,name,size in images:
 im=Image.open(out/src).convert('RGB');assert im.size==size
 im.save(upload/name,'JPEG',quality=92,optimize=True,subsampling=0)
 with Image.open(upload/name) as check: assert check.format=='JPEG' and check.size==size
 report.append({'file':name,'width':im.width,'height':im.height,'bytes':(upload/name).stat().st_size})
copy=['蚂蚁搬砖我上头','再搬一块就睡','这群蚂蚁有点忙','看蚂蚁搬砖上头','一搬就停不下','小蚂蚁大上头','搬空像素才下班','你的蚂蚁开工了','选对颜色开搬','看它们搬好解压']
assert all(len(s)<=8 for s in copy)
(upload/'06-promotion-copy.txt').write_text('推广文案（每条不超过 8 字）\n推荐：蚂蚁搬砖我上头\n\n'+'\n'.join(f'{i+1}. {s}（{len(s)} 字）' for i,s in enumerate(copy))+'\n')
# Preview sheet is only an index; separate JPGs are the upload files.
canvas=Image.new('RGB',(1500,1270),'#F4F8EE');d=ImageDraw.Draw(canvas)
f=ImageFont.truetype(str(root/'art/fonts/noto-NotoSansSC[wght].ttf'),25);f.set_variation_by_axes([700])
def thumb(src,x,y,w,h,label):
 im=Image.open(out/src).convert('RGB');im.thumbnail((w,h),Image.Resampling.LANCZOS)
 canvas.paste(im,(x+(w-im.width)//2,y));d.text((x,y+h+10),label,font=f,fill='#145D50')
thumb('promotion-landscape.png',30,30,960,540,'01 横版推广图 · 1920×1080')
thumb('promotion-portrait-final.png',1050,30,390,585,'02 竖版推广图 · 1080×1620')
thumb('share-challenge.png',30,700,460,368,'03 分享图 · 挑战版')
thumb('share-funny.png',520,700,460,368,'04 分享图 · 搞怪版')
thumb('share-relax.png',1010,700,460,368,'05 分享图 · 解压版')
d.text((30,1175),'推广文案推荐：蚂蚁搬砖我上头（7字）',font=f,fill='#145D50')
canvas.save(out/'all-materials-preview.jpg',quality=90)
(out/'validation-images.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))

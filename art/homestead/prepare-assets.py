from pathlib import Path
from PIL import Image
import json,uuid
root=Path('assets/resources/home')
Image.open('art/homestead/courtyard-base.png').convert('RGB').save(root/'garden.jpg',quality=80,optimize=True)
sheet=Image.open('art/homestead/furnishings-sheet.png').convert('RGBA')
# The provider returned transparent, individually usable sprites; retain their native proportions.
columns=[0,350,605,910,1225];rows=[80,452,826,1240]
atlas=Image.new('RGBA',(1024,768))
for row in range(3):
 for col in range(4):
  item=sheet.crop((columns[col],rows[row],columns[col+1],rows[row+1]))
  alpha=item.getchannel('A').point(lambda value:0 if value<120 else value)
  item.putalpha(alpha)
  box=alpha.getbbox()
  item=item.crop(box)
  item.thumbnail((240,240),Image.Resampling.LANCZOS)
  atlas.alpha_composite(item,(col*256+(256-item.width)//2,row*256+(256-item.height)//2))
atlas.quantize(colors=256,method=Image.Quantize.FASTOCTREE).save(root/'furnishings.png',optimize=True)
for target in ['furnishings.png']:
 if (root/(target+'.meta')).exists(): continue
 source=root/('garden.jpg.meta' if target.endswith('jpg') else 'shop.png.meta')
 meta=source.read_text()
 import re
 ids=set(re.findall(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',meta))
 for value in ids:meta=meta.replace(value,str(uuid.uuid4()))
 (root/(target+'.meta')).write_text(meta)

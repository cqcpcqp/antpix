"""Prepare the selected A sprite and existing shop colors without changing geometry."""
from PIL import Image
from pathlib import Path
import colorsys,json,uuid
source=Image.open('art/ui/sources/wood-hole.png').convert('RGBA')
# Native crop ratio is retained; opening centre maps to (46,22) in each tile.
base=source.crop((235,200,1380,860)).resize((104,60),Image.Resampling.LANCZOS)
atlas=Image.new('RGBA',(416,60))
for i,target in enumerate([None,'#B5C992','#E9B0A3','#9FBAD8']):
    tile=base.copy()
    if target:
        th,ts,tv=colorsys.rgb_to_hsv(*(int(target[j:j+2],16)/255 for j in (1,3,5)))
        data=[]
        for r,g,b,a in tile.getdata():
            # Only stain the wood: preserve green leaf, dark opening and shadow.
            if a>100 and r>g*1.035 and g>b*1.1 and max(r,g,b)>120:
                h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
                nr,ng,nb=colorsys.hsv_to_rgb(th,ts*min(1.6,.75+s),min(1,v*tv/.94))
                data.append((round(nr*255),round(ng*255),round(nb*255),a))
            else: data.append((r,g,b,a))
        tile.putdata(data)
    atlas.paste(tile,(i*104,0))
out=Path('assets/resources/trays/wood-hole.png')
atlas.quantize(colors=192,method=Image.Quantize.FASTOCTREE).save(out,optimize=True)
meta=Path(str(out)+'.meta')
if not meta.exists():
    data=json.loads(Path('assets/resources/trays/acorn.png.meta').read_text());uid=str(uuid.uuid4())
    data['uuid']=uid;sub=data['subMetas']['6c48a'];sub['uuid']=uid+'@6c48a';sub['displayName']='wood-hole';sub['userData']['imageUuidOrDatabaseUri']=uid;data['userData']['redirect']=uid+'@6c48a'
    meta.write_text(json.dumps(data,indent=2)+'\n')
print('Wood nest atlas:',out.stat().st_size,'bytes')

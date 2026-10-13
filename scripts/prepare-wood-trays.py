"""Extract the chosen C artwork; keep its wood rim and acorn, never bake game contents."""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import json, uuid
source = Image.open('art/ui/sources/wood-tray.png').convert('RGBA')
out = Path('assets/resources/trays')
out.mkdir(exist_ok=True)
# High-resolution rounded masks retain antialiasing around the original artwork.
tray = source.crop((76,535,740,713))
mask = Image.new('L', tray.size)
ImageDraw.Draw(mask).rounded_rectangle((3,5,658,171), radius=62, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(.7))
tray.putalpha(mask)
# Replace only the contents, retaining the original inner bevel and dark recess.
inside = Image.new('L', tray.size)
ImageDraw.Draw(inside).rounded_rectangle((37,38,627,151), radius=35, fill=255)
inside = inside.filter(ImageFilter.GaussianBlur(2))
cream = Image.new('RGBA', tray.size)
draw = ImageDraw.Draw(cream)
for y in range(tray.height):
    # Warm edge shadow gives way to a luminous cream centre.
    edge = max(0, 1-(y-38)/20) * 12 + max(0,(y-127)/24)*5
    draw.line((0,y,tray.width,y), fill=(round(249-edge),round(243-edge),round(220-edge),255))
tray.paste(cream,(0,0),inside)
# Remove the long middle rather than downscale the corners and bevel.
# The runtime nine-slice restores width while keeping native, thick wood edges.
compact = Image.new('RGBA',(204,178))
compact.paste(tray.crop((0,0,82,178)),(0,0))
compact.paste(tray.crop((310,0,350,178)),(82,0))
compact.paste(tray.crop((582,0,664,178)),(122,0))
# Reuse the upper rim geometry for the lower rim. The concept's lower edge
# was thinner; stretching that asymmetry made the dispatch tray look pinched.
lower = compact.crop((0,0,204,89)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
compact.paste(lower,(0,89))
compact.quantize(colors=192,method=Image.Quantize.FASTOCTREE).save(out/'wood.png', optimize=True)
ornament = source.crop((600,872,750,994))
# Outline coordinates measured on a 4× view of the selected artwork.
points=[(43,418),(44,382),(59,341),(90,306),(130,281),(177,276),(216,282),(242,294),(257,263),(257,234),(272,207),(304,186),(335,176),(369,175),(373,140),(390,107),(427,74),(470,46),(518,31),(546,30),(563,42),(570,64),(570,109),(559,158),(540,194),(506,226),(482,242),(497,280),(503,316),(496,344),(477,366),(456,372),(438,405),(413,427),(380,442),(344,447),(322,448),(309,452),(288,453),(272,446),(257,425),(237,437),(205,447),(162,452),(124,450),(85,442),(57,432)]
mask=Image.new('L',(600,488)); ImageDraw.Draw(mask).polygon(points,fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(1.2)).resize(ornament.size,Image.Resampling.LANCZOS)
ornament.putalpha(mask)
ornament.resize((100,81),Image.Resampling.LANCZOS).quantize(colors=192,method=Image.Quantize.FASTOCTREE).save(out/'acorn.png', optimize=True)
base=json.loads(Path('assets/resources/ants/workers.png.meta').read_text())
for name in ['wood','acorn']:
    path=out/(name+'.png.meta')
    if path.exists(): continue
    meta=json.loads(json.dumps(base)); uid=str(uuid.uuid4());meta['uuid']=uid
    sub=meta['subMetas']['6c48a'];sub['uuid']=uid+'@6c48a';sub['displayName']=name;sub['userData']['imageUuidOrDatabaseUri']=uid
    meta['userData']['redirect']=uid+'@6c48a';path.write_text(json.dumps(meta,indent=2)+'\n')
p=Path(str(out)+'.meta')
if not p.exists(): p.write_text(json.dumps({'ver':'1.2.0','importer':'directory','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n')
print('Tray artwork:', sum(p.stat().st_size for p in out.glob('*.png')), 'bytes')

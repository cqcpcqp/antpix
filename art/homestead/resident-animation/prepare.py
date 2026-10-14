"""Extract AI poses into a compact alpha atlas. No runtime image processing."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, uuid
root=Path(__file__).resolve().parents[3]
source=Image.open(Path(__file__).with_name('source.png')).convert('RGBA')
interactions=Image.open(Path(__file__).with_name('interactions.png')).convert('RGBA')
atlas=Image.new('RGBA',(512,384))
for i in range(12):
    tile=source.crop((i%4*384,i//4*512,i%4*384+384,i//4*512+512)) if i<8 else interactions.crop(((i-8)*384,0,(i-7)*384,512))
    px=tile.load()
    for y in range(tile.height):
        for x in range(tile.width):
            r,g,b,a=px[x,y]
            # The source backdrop is neutral white; the resident is warm brown.
            neutral=min(r,g,b)
            alpha=255 if neutral<180 else max(0,255-(neutral-180)*255//55)
            px[x,y]=(r,g,b,alpha)
    box=tile.getbbox(); tile=tile.crop(box)
    factor=min(110/tile.width,116/tile.height)
    tile=tile.resize((round(tile.width*factor),round(tile.height*factor)),Image.Resampling.LANCZOS)
    atlas.alpha_composite(tile,(i%4*128+(128-tile.width)//2,i//4*128+122-tile.height))
out=root/'assets/resources/home/resident.png';atlas.quantize(colors=128,method=Image.Quantize.FASTOCTREE).save(out,optimize=True)
# A copy of the original doorway surround masks residents behind the earthen lip.
base=Image.open(root/'assets/resources/home/garden.jpg').convert('RGBA')
box=(425,580,605,723); rim=base.crop(box)
mask=Image.new('L',rim.size,255); d=ImageDraw.Draw(mask)
# Keep the arch and side walls, but leave the walking corridor open through
# the bottom of the crop. An opaque bottom strip cuts exiting ants in half.
d.polygon([(26,143),(26,89),(36,60),(54,34),(80,18),(101,19),(121,31),(139,57),(151,90),(154,124),(154,143)],fill=0)
rim.putalpha(mask);rim.quantize(colors=128,method=Image.Quantize.FASTOCTREE).save(root/'assets/resources/home/resident-door.png',optimize=True)
for name in ['resident','resident-door']:
    target=root/f'assets/resources/home/{name}.png.meta'
    if target.exists():continue
    meta=json.loads((root/'assets/resources/home/furnishings.png.meta').read_text())
    old=meta['uuid']; new=str(uuid.uuid4())
    raw=json.dumps(meta).replace(old,new).replace('furnishings',name)
    target.write_text(json.dumps(json.loads(raw),indent=2)+'\n')
for name in ['courtyardLife','courtyardResident','courtyardColony','courtyardAtmosphere']:
    target=root/f'assets/scripts/{name}.ts.meta'
    if not target.exists():target.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n')
print('Prepared 512x384 resident atlas and doorway occluder')

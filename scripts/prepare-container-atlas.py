"""Prepare one tintable body and one neutral detail layer for every container."""
import json
import uuid
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/resources/containers'
SIZE = 88

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(ROOT / 'art/ui/sources/containers.png').convert('RGB')
    crop = source.crop((845, 820, 1038, 1044))
    # Reconstruct only the plain center of the inset, preserving the original
    # curved inset rim and its cast shadow instead of painting a new plaque.
    for y in range(89,160):
        left=crop.getpixel((37,y));right=crop.getpixel((153,y))
        for x in range(40,150):
            t=(x-37)/116
            crop.putpixel((x,y),tuple(round(v+(w-v)*t) for v,w in zip(left,right)))
    palette=['#000000','#FFFFFF']
    # Trace just inside the original curved contour at supersampled resolution.
    silhouette=Image.new('L',(crop.width*4,crop.height*4))
    points=[]
    def curve(a,b,c,d):
        for i in range(41):
            t=i/40;u=1-t
            points.append(tuple(4*(u*u*u*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*d[k]) for k in range(2)))
    curve((52,12),(90,10),(128,10),(143,12))
    curve((143,12),(183,13),(186,39),(186,69))
    curve((186,69),(188,110),(188,161),(180,180))
    curve((180,180),(174,199),(151,199),(123,199))
    curve((123,199),(83,200),(43,199),(27,196))
    curve((27,196),(7,193),(5,174),(5,147))
    curve((5,147),(4,110),(5,72),(9,50))
    curve((9,50),(13,20),(28,12),(52,12))
    ImageDraw.Draw(silhouette).polygon(points,fill=255)
    silhouette=silhouette.resize(crop.size,Image.Resampling.LANCZOS)
    plaque=Image.new('L',crop.size)
    ImageDraw.Draw(plaque).rounded_rectangle((28,73,164,177),radius=30,fill=255)
    tiles=[]
    for index,hexcolor in enumerate(palette):
        target=tuple(int(hexcolor[i:i+2],16)/255 for i in (1,3,5))
        tile=crop.convert('RGBA');px=tile.load()
        for y in range(tile.height):
            for x in range(tile.width):
                r,g,b,_=px[x,y]
                # Retain the cream inset and dark top hole in full color. Body
                # lighting uses additive warm highlights, not whole-image tint.
                if not plaque.getpixel((x,y)) and not (y<45 and 45<x<148 and r<135):
                    value=r/255
                    shade=min(1,value/.82)
                    highlight=max(0,(value-.82)/.18)*.48
                    ambient=max(0,(g/255-.31*shade))*.12
                    rgb=tuple(min(255,round((c*shade+(light-c)*highlight+ambient)*255)) for c,light in zip(target,(1,.95,.84)))
                else:
                    rgb=(r,g,b)
                px[x,y]=(*rgb,silhouette.getpixel((x,y)))
        tile.thumbnail((SIZE-8,SIZE-8),Image.Resampling.LANCZOS)
        padded=Image.new('RGBA',(SIZE,SIZE))
        padded.alpha_composite(tile,((SIZE-tile.width)//2,(SIZE-tile.height)//2))
        tiles.append(padded)
    import importlib.util
    spec=importlib.util.spec_from_file_location('tint_layers',ROOT/'scripts/split-tint-layers.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    base,detail=module.split(*tiles)
    atlas=Image.new('RGBA',(SIZE*2,SIZE));atlas.paste(base,(0,0));atlas.paste(detail,(SIZE,0))
    atlas.save(OUT/'boxes.png',optimize=True)
    folder=ROOT/'assets/resources/containers.meta'
    if not folder.exists():
        meta=json.loads((ROOT/'assets/resources/ants.meta').read_text());meta['uuid']=str(uuid.uuid4())
        folder.write_text(json.dumps(meta,indent=2)+'\n')
    for stale in OUT.glob('boxes-*.png'):
        stale.unlink()
        stale.with_suffix('.png.meta').unlink(missing_ok=True)
    print(f'Tintable container: 2 shared {SIZE}px layers, {(OUT/"boxes.png").stat().st_size} bytes')
if __name__=='__main__':main()

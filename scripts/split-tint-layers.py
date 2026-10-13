"""Factor black/white renders into a tinted base and an untinted detail overlay.
Uses premultiplied-alpha equations, so antialiasing and transparent edges survive.
Input: a PNG with the black render above the white render. Output: base|detail PNG.
"""
import sys
from PIL import Image

def split(black,white):
    assert black.size==white.size
    base=Image.new('RGBA',black.size);detail=Image.new('RGBA',black.size)
    bases=[];details=[]
    for b,w in zip(black.getdata(),white.getdata()):
        # Rasterization at separate atlas rows can differ by one alpha unit.
        assert abs(b[3]-w[3])<=1
        a=b[3]/255
        coeff=[max(0,(w[i]-b[i])/255) for i in range(3)]
        scale=max(coeff)
        overlay_a=a*(1-scale)
        base_a=a*scale/(1-overlay_a) if overlay_a<1 else 0
        bases.append(tuple(round(v/scale*255) if scale else 0 for v in coeff)+(round(base_a*255),))
        details.append(tuple(min(255,round(b[i]/(1-scale))) if scale<1 else 0 for i in range(3))+(round(overlay_a*255),))
    base.putdata(bases);detail.putdata(details)
    return base,detail

if __name__=='__main__':
    im=Image.open(sys.stdin.buffer).convert('RGBA');h=im.height//2
    base,detail=split(im.crop((0,0,im.width,h)),im.crop((0,h,im.width,2*h)))
    result=Image.new('RGBA',(im.width*2,h));result.paste(base,(0,0));result.paste(detail,(im.width,0))
    result.save(sys.stdout.buffer,format='PNG',optimize=True)

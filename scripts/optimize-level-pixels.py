"""Create edge-aware, perceptual 48x60 pixel candidates from AI originals.
Writes pixel PNGs and review comparisons; installing them is a separate step.
Run with PYTHONPATH=temp/pixel-research-libs for the local numpy dependency.
"""
from pathlib import Path
import json, math, argparse
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',type=Path,default=ROOT/'art/cartoons/sources/image2-20261010')
parser.add_argument('--resume',action='store_true',help='Reuse existing pixel PNGs; still rebuild comparisons and validation')
parser.add_argument('--anchor-dark',action='store_true',help='Reserve the darkest substantial source color to retain eyes and outlines at small palettes')
parser.add_argument('--available',action='store_true',help='Process only originals already generated in an in-progress batch')
args=parser.parse_args()
SRC=args.source.resolve()
OUT=SRC/'review-48x60'
OUT.mkdir(parents=True,exist_ok=True)
M1=np.array([[.4122214708,.5363325363,.0514459929],[.2119034982,.6806995451,.1073969566],[.0883024619,.2817188376,.6299787005]])
M2=np.array([[.2104542553,.7936177850,-.0040720468],[1.9779984951,-2.4285922050,.4505937099],[.0259040371,.7827717662,-.8086757660]])
def lab(rgb):
 x=np.asarray(rgb,dtype=np.float64)/255
 x=np.where(x<=.04045,x/12.92,((x+.055)/1.055)**2.4)
 return np.cbrt(x@M1.T)@M2.T
def nearest(points,centers):return ((points[:,None]-centers[None])**2).sum(2).argmin(1)
def palette_for(img,k):
 # Preserve source colors instead of inventing muddy interpolation colors.
 sample=np.asarray(img.resize((192,240),Image.Resampling.NEAREST)).reshape(-1,3)
 q=(sample//8).astype(np.int16); colors,inv=np.unique(q,axis=0,return_inverse=True)
 rgb=np.stack([np.bincount(inv,weights=sample[:,i])/np.maximum(1,np.bincount(inv)) for i in range(3)],1)
 p=lab(rgb)
 # Emphasize colors appearing near high-contrast boundaries and central subject.
 small=np.asarray(img.resize((192,240),Image.Resampling.BILINEAR),dtype=float)
 gray=small.mean(2); edge=np.zeros_like(gray);edge[1:-1,1:-1]=np.abs(gray[1:-1,2:]-gray[1:-1,:-2])+np.abs(gray[2:,1:-1]-gray[:-2,1:-1])
 yy,xx=np.mgrid[:240,:192]; center=np.exp(-(((xx-96)/82)**2+((yy-120)/106)**2)); importance=(1+1.8*edge/255+.6*center).reshape(-1)
 weights=np.bincount(inv,weights=importance)
 centers=[]; centers.append(p[np.argmax(weights)])
 dark_anchor=None
 if args.anchor_dark:
  counts=np.bincount(inv)
  substantial=np.flatnonzero(counts>=max(12,len(sample)*.0005))
  dark_anchor=p[substantial[np.argmin(p[substantial,0])]]
 for _ in range(1,k):
  if _==1 and dark_anchor is not None:
   centers.append(dark_anchor);continue
  d=((p[:,None]-np.array(centers)[None])**2).sum(2).min(1);prob=weights*d
  centers.append(p[np.random.default_rng(4+_).choice(len(p),p=prob/prob.sum())])
 centers=np.array(centers)
 for _ in range(50):
  labels=nearest(p,centers); new=centers.copy()
  for j in range(k):
   mask=labels==j
   if mask.any():new[j]=np.average(p[mask],0,weights=weights[mask])
  if dark_anchor is not None:new[1]=dark_anchor
  if np.max(np.abs(new-centers))<1e-6:break
  centers=new
 rep=nearest(centers,p)
 return np.rint(rgb[rep]).astype('uint8')
def make(img,k,pal):
 # Supersample, calculate edge strength, then choose a representative sample per cell.
 hi=np.asarray(img.resize((192,240),Image.Resampling.LANCZOS),dtype=np.uint8)
 hiplab=lab(hi.reshape(-1,3)).reshape(240,192,3)
 gray=hi.mean(2); gx=np.zeros_like(gray);gy=np.zeros_like(gray);gx[:,1:-1]=np.abs(gray[:,2:]-gray[:,:-2]);gy[1:-1]=np.abs(gray[2:]-gray[:-2]); edge=gx+gy
 out=np.empty((60,48,3),dtype=np.uint8)
 plab=lab(pal)
 cells=[]; blocks=[]; block_weights=[]
 for y in range(60):
  for x in range(48):
   block=hiplab[y*4:y*4+4,x*4:x*4+4].reshape(-1,3)
   # Center samples represent area; edge samples preserve boundaries. Blend both.
   e=edge[y*4:y*4+4,x*4:x*4+4].reshape(-1)
   center=np.array([1,2,2,1]); w=np.outer(center,center).reshape(-1).astype(float)
   w*=1+1.5*e/(e.max()+1)
   color=np.average(block,0,weights=w)
   cells.append(color);blocks.append(block);block_weights.append(w)
   # Map the weighted perceptual color to the nearest source-palette color.
   d=((plab-color)**2).sum(1)
   out[y,x]=pal[d.argmin()]
 if args.anchor_dark:
  # If a source palette color vanishes during downsampling, use that slot for
  # the worst represented cell instead of padding the image with arbitrary dots.
  cells=np.array(cells)
  def assign(centers):
   # A cell may only choose colors substantially present in its source block.
   # This avoids inventing green/brown fringes by averaging dark eyes with skin.
   result=[]
   for point,block,w in zip(cells,blocks,block_weights):
    votes=np.bincount(nearest(block,centers),weights=w,minlength=k)
    allowed=votes>=w.sum()*.18
    allowed[votes.argmax()]=True # Keep a real local color even in a highly varied block.
    d=((centers-point)**2).sum(1);d[~allowed]=np.inf
    result.append(d.argmin())
   return np.array(result)
  source=hi.reshape(-1,3); source_lab=hiplab.reshape(-1,3)
  for _ in range(k):
   plab=lab(pal); labels=assign(plab)
   unused=sorted(set(range(k))-set(labels.tolist()))
   if not unused:break
   errors=((cells-plab[labels])**2).sum(1)
   candidate=cells[errors.argmax()]
   pal[unused[0]]=source[((source_lab-candidate)**2).sum(1).argmin()]
  out=pal[assign(lab(pal))].reshape(60,48,3)
 return Image.fromarray(out)
manifest=sorted(json.loads((SRC/'manifest.json').read_text()),key=lambda e:e['level'])
if args.available: manifest=[e for e in manifest if (SRC/e['file']).exists()]
validation=[]
# Ten pairs per page remain readable without an enormous 90-picture sheet.
pages=[]
for start in range(0,len(manifest),10):
 entries=manifest[start:start+10]
 contact=Image.new('RGB',(1320,440*math.ceil(len(entries)/2)),'#fff8ec')
 for i,e in enumerate(entries):
  original=Image.open(SRC/e['file']).convert('RGB')
  assert abs(original.width/original.height-.8)<.01,f"{e['id']}: regenerate source with a 4:5 aspect ratio"
  pixel_path=OUT/f"{e['id']}-48x60.png"
  if args.resume and pixel_path.exists():
   result=Image.open(pixel_path).convert('RGB')
  else:
   pal=palette_for(original,e['colors']); result=make(original,e['colors'],pal); result.save(pixel_path)
  actual=len(result.getcolors(2880))
  assert result.size==(48,60),e['id']
  assert actual==e['colors'],f"{e['id']}: expected {e['colors']} colors, got {actual}"
  validation.append(dict(level=e['level'],id=e['id'],width=48,height=60,colors=actual,targetColors=e['colors'],approved=e['approved']))
  pair=Image.new('RGB',(660,440),'#fff8ec');pair.paste(original.resize((320,400),Image.Resampling.LANCZOS),(5,35));pair.paste(result.resize((320,400),Image.Resampling.NEAREST),(335,35));d=ImageDraw.Draw(pair);d.text((8,10),f"LEVEL {e['level']:03d} ORIGINAL",fill='#233341');d.text((338,10),f"48x60 | {actual} COLORS",fill='#233341');pair.save(OUT/f"{e['id']}-comparison.jpg",quality=95)
  contact.paste(pair,((i%2)*660,(i//2)*440))
  print(f"Level {e['level']}: {e['id']} / {actual} colors",flush=True)
 name='contact-sheet.jpg' if len(manifest)<=10 else f"contact-{entries[0]['level']:03d}-{entries[-1]['level']:03d}.jpg"
 contact.save(OUT/name,quality=95);pages.append(name)
(OUT/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
(OUT/'pages.json').write_text(json.dumps(pages,indent=2)+'\n')
print(f'Generated {len(manifest)} optimized candidates in {OUT}')

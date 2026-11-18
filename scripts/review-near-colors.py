"""Probe adjacent near-color regions in candidate pixel images.

OKLab cutoffs are exploratory sensitivity checks, not approval thresholds.
Transitive adjacency may join colors whose endpoints differ substantially.
Requires numpy and Pillow, as does optimize-level-pixels.py.
"""
import json,sys
from pathlib import Path
import numpy as np
from PIL import Image
out=Path(sys.argv[1]);results=[]
M1=np.array([[.4122214708,.5363325363,.0514459929],[.2119034982,.6806995451,.1073969566],[.0883024619,.2817188376,.6299787005]])
M2=np.array([[.2104542553,.7936177850,-.0040720468],[1.9779984951,-2.4285922050,.4505937099],[.0259040371,.7827717662,-.8086757660]])
for e in json.loads((out/'manifest.json').read_text()):
 rgb=np.asarray(Image.open(out/e['runtimePixelFile']).convert('RGB')).astype(float)/255
 linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
 lab=np.cbrt(linear@M1.T)@M2.T;h,w=rgb.shape[:2];counts={}
 for cutoff in [0,.06,.10]:
  visited=set();largest=0
  for y in range(h):
   for x in range(w):
    if (x,y) in visited:continue
    stack=[(x,y)];visited.add((x,y));size=0
    while stack:
     px,py=stack.pop();size+=1
     for nx,ny in [(px-1,py),(px+1,py),(px,py-1),(px,py+1)]:
      if 0<=nx<w and 0<=ny<h and (nx,ny) not in visited and np.linalg.norm(lab[ny,nx]-lab[py,px])<=cutoff:
       visited.add((nx,ny));stack.append((nx,ny))
    largest=max(largest,size)
  counts[str(cutoff)]=largest
 results.append(dict(level=e['level'],id=e['id'],largestAdjacentNearColorComponent=counts))
report=dict(method='Exploratory four-way adjacency using OKLab Euclidean edge distance. Transitive chains can join distant end colors. Cutoffs are sensitivity probes, not acceptance limits.',rows=results)
(out/'near-color-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False))

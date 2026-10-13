"""Verify decoded TypeScript catalog pixels against every source review PNG."""
import argparse,json,subprocess
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser(description=__doc__);p.add_argument('catalog',type=Path);p.add_argument('sources',nargs='+',type=Path);args=p.parse_args()
script="import {pathToFileURL} from 'node:url';const m=await import(pathToFileURL(process.argv[1]));console.log(JSON.stringify({palette:m.PALETTE,artworks:m.ARTWORKS}));"
result=subprocess.run(['node','--experimental-strip-types','-e',script,str(args.catalog.resolve())],capture_output=True,text=True,check=True)
data=json.loads(result.stdout)
expected=sorted([(source,e) for source in args.sources for e in json.loads((source/'manifest.json').read_text())],key=lambda pair:pair[1]['level'])
assert len(data['artworks'])==len(expected)
for art,(source,e) in zip(data['artworks'],expected):
 assert art['id']==e['id']
 im=Image.open(source/e['runtimePixelFile']).convert('RGB')
 decoded=[data['palette'][index] for index in art['pixels']]
 assert decoded==['#%02X%02X%02X'%rgb for rgb in im.getdata()],e['id']
 assert len(set(decoded))==e['colors']
print(f'{len(expected)} catalog images match reviewed PNGs exactly, including all colors and pixel positions.')

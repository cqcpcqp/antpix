"""Build compact 48x60 level data. Official output requires approved artwork.
Use --source multiple times to combine manifests. --candidate writes only to art/.
Always regenerate container plans after this command.
"""
import argparse,json
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',action='append',type=Path)
parser.add_argument('--output',type=Path,default=root/'assets/scripts/levels.ts')
parser.add_argument('--candidate',action='store_true')
args=parser.parse_args()
output=args.output.resolve()
if args.candidate:
    assert output.is_relative_to(root/'art'), 'Unapproved candidate catalogs must stay in art/'
sources=args.source or [root/path for path in json.loads((root/'art/cartoons/runtime-catalog.json').read_text())['sources']]
entries=sorted([(source.resolve(),e) for source in sources for e in json.loads((source/'manifest.json').read_text())],key=lambda pair:pair[1]['level'])
assert [e['level'] for _,e in entries]==list(range(1,len(entries)+1))
assert len({e['id'] for _,e in entries})==len(entries)
if not args.candidate:
    assert all(e['approved'] is True for _,e in entries), 'Catalog contains artwork awaiting user approval'
palette=[];artworks=[]
def base36(n):
    digits='0123456789abcdefghijklmnopqrstuvwxyz';s=''
    while n:s=digits[n%36]+s;n//=36
    return s
for source,e in entries:
    if not args.candidate: assert e['approved'] is True, e['id']
    assert e['runtimeGrid']==[48,60]
    small=Image.open(source/e['runtimePixelFile']).convert('RGB')
    assert small.size==(48,60)
    assert len(small.getcolors(2880))==e['colors']
    local=[];ids=[]
    for rgb in small.getdata():
        value='#%02X%02X%02X'%rgb
        if value not in palette:palette.append(value)
        global_id=palette.index(value)
        if global_id not in local:local.append(global_id)
        ids.append(local.index(global_id))
    runs=[];start=0
    while start<len(ids):
        end=start+1
        while end<len(ids) and ids[end]==ids[start]:end+=1
        length=end-start
        runs.append(chr(65+ids[start])+(base36(length) if length>1 else ''))
        start=end
    artworks.append(dict(id=e['id'],name=e['name'],subtitle=e['subtitle'],colors=e['colors'],difficulty=16000,capacity=40,swatches=local,data=''.join(runs)))
lines=[
 'const PACKED_CONTAINER_PLANS: Record<string, string[]> = {};',
 '// Generated from underelay image2 illustrations. Source manifests retain review status.',
 'export const GRID_WIDTH = 48;', 'export const GRID_HEIGHT = 60;',
 'export const PALETTE: string[] = '+json.dumps(palette,separators=(',',':'))+';',
 'export interface Level { containerPlans?: [number,number][][]; id?: string; difficulty?: number; colors?: number; name: string; subtitle: string; width: number; height: number; pixels: number[]; capacity: number; }',
 'const PACKED_ARTWORKS = '+json.dumps(artworks,ensure_ascii=False,separators=(',',':'))+';',
 '''export const ARTWORKS = PACKED_ARTWORKS.map(({data, ...art}) => {
 const pixels: number[] = [];
 const runs = /([A-X])([0-9a-z]*)/g;
 let match: RegExpExecArray | null;
 while ((match = runs.exec(data))) {
  const count = match[2] ? parseInt(match[2], 36) : 1;
  const color = art.swatches[match[1].charCodeAt(0) - 65];
  for (let i = 0; i < count; i++) pixels.push(color);
 }
 return {...art, pixels};
});''',
 '''const COUNTS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
export const CONTAINER_PLANS: Record<string, [number,number][][]> = {};
for (const art of ARTWORKS) {
 const packed = PACKED_CONTAINER_PLANS[art.id];
 if (!packed) continue; // Plans are added by the offline generation step.
 CONTAINER_PLANS[art.id] = packed.map(data => {
  const jars: [number,number][] = [];
  for (let i = 0; i < data.length; i += 2)
   jars.push([art.swatches[data.charCodeAt(i) - 65], COUNTS.indexOf(data[i+1])]);
  return jars;
 });
}''',
 'export const LEVEL_COUNT = ARTWORKS.length;',
 'export function makeLevel(index: number): Level {',
 ' const art = ARTWORKS[index % LEVEL_COUNT];',
 ' return { ...art, containerPlans: CONTAINER_PLANS[art.id], width: GRID_WIDTH, height: GRID_HEIGHT, pixels: [...art.pixels] };','}',
]
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text('\n'.join(lines)+'\n')
print(f'Generated {len(artworks)} '+('CANDIDATE' if args.candidate else 'approved')+f' levels, {len(palette)} colors, {output.stat().st_size} bytes: {output}')

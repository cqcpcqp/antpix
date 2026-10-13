"""Compress the generated B wallpaper while retaining soft tone and foliage."""
from pathlib import Path
from PIL import Image
import json,uuid
out=Path('assets/resources/trays/garden-background.jpg')
Image.open('art/ui/sources/game-background.png').convert('RGB').resize((384,576),Image.Resampling.LANCZOS).save(out,quality=74,optimize=True)
p=Path(str(out)+'.meta')
if not p.exists():
    meta=json.loads(Path('assets/resources/home/garden.jpg.meta').read_text());uid=str(uuid.uuid4());meta['uuid']=uid
    sub=meta['subMetas']['6c48a'];sub['uuid']=uid+'@6c48a';sub['displayName']='garden-background';sub['userData']['imageUuidOrDatabaseUri']=uid
    meta['userData']['redirect']=uid+'@6c48a';p.write_text(json.dumps(meta,indent=2)+'\n')
print('Garden background:',out.stat().st_size,'bytes')

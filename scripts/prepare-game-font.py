"""Generate the UI's static 700-weight font subset. Requires fonttools.
Run again after adding UI copy: PYTHONPATH=/tmp/ant-font-libs python3 scripts/prepare-game-font.py
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
root=Path(__file__).resolve().parents[1]
chars=set(chr(i) for i in range(32,127))
for p in (root/'assets/scripts').rglob('*.ts'):
 chars.update(c for c in p.read_text() if ord(c)>=160)
chars.update(c for c in (root/'cloudfunctions/game/service.js').read_text() if ord(c)>=160)
font=TTFont(root/'art/fonts/noto-NotoSansSC[wght].ttf')
missing=sorted(ord(c) for c in chars if ord(c) not in font.getBestCmap())
if missing:raise RuntimeError('Missing glyphs: '+str([chr(c) for c in missing]))
font=instantiateVariableFont(font,{'wght':700},inplace=True)
options=subset.Options();options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
s=subset.Subsetter(options=options);s.populate(unicodes=[ord(c) for c in chars]);s.subset(font)
# Modified/subset family name; retain upstream copyright and license records.
for name_id,value in [(1,'Ant Nest Heavy'),(2,'Regular'),(3,'AntNestHeavy-700-subset'),(4,'Ant Nest Heavy'),(6,'AntNestHeavy')]:
 font['name'].setName(value,name_id,3,1,0x409)
out=root/'art/fonts';out.mkdir(exist_ok=True)
font.save(out/'ant-nest-heavy.ttf')
print('Subset:',len(chars),'characters,',round((out/'ant-nest-heavy.ttf').stat().st_size/1024,1),'KB')

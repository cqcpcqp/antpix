"""Build review sheets and a readable report from candidate review outputs.

Does not install images or change approval. Source originals remain available
for before/after comparisons even after their manifest entries are replaced.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
args = parser.parse_args()
folder = args.directory.resolve()
entries = json.loads((folder / 'manifest.json').read_text())
assert all(e['approved'] is False for e in entries), 'Use this review tool for unapproved candidates only'
structures = {r['id']: r for r in json.loads((folder / 'structure-review.json').read_text())}
games = {r['id']: r for r in json.loads((folder / 'gameplay-review.json').read_text())['rows']}
font = ImageFont.truetype(str(ROOT / 'art/fonts/noto-NotoSansSC[wght].ttf'), 19)
small = ImageFont.truetype(str(ROOT / 'art/fonts/noto-NotoSansSC[wght].ttf'), 16)
height = ((len(entries) + 1) // 2) * 380
sheet = Image.new('RGB', (1020, height), '#fff8ec')
before = Image.new('RGB', (1020, height), '#fff8ec')
draw = ImageDraw.Draw(sheet)
old_draw = ImageDraw.Draw(before)
report = ['# 本批重绘复核', '', '候选待用户验收，未接入正式关卡。结构筛查级别不等于实际游戏难度，也不等于最终验收结论。', '',
          '|关卡|候选|色数|最大同色区旧→新/格|前三色旧→新|结构初筛|等待峰值|容量策略通过|',
          '|---|---|---:|---:|---:|---|---|---:|']
notes = []
for i, entry in enumerate(entries):
    structure = structures[entry['id']]
    game = games[entry['id']]
    original = Image.open(folder / entry['file']).convert('RGB')
    pixels = Image.open(folder / entry['runtimePixelFile']).convert('RGB')
    assert original.size == (1024, 1280), entry['id']
    assert pixels.size == (48, 60), entry['id']
    assert len(pixels.getcolors(2880)) == entry['colors'], entry['id']
    x, y = i % 2 * 510, i // 2 * 380
    original_thumb = original.resize((230, 288), Image.Resampling.LANCZOS)
    pixel_thumb = pixels.resize((230, 288), Image.Resampling.NEAREST)
    draw.text((x + 10, y + 5), f"{entry['level']:03d} {entry['name']} · {entry['colors']}色", font=font, fill='#23443b')
    sheet.paste(original_thumb, (x + 10, y + 38))
    sheet.paste(pixel_thumb, (x + 260, y + 38))
    draw.text((x + 10, y + 330), '新原图', font=small, fill='#23443b')
    draw.text((x + 260, y + 330), '48×60 像素图', font=small, fill='#23443b')
    old_max, new_max = structure['before']['maxComponent'], structure['after']['maxComponent']
    draw.text((x + 10, y + 354), f'最大同色区：{old_max} → {new_max} 格', font=small, fill='#23443b')
    source = ROOT / entry['sourceDirectory']
    old_pixels = Image.open(source / entry['sourcePixelFile']).convert('RGB')
    old_original = Image.open(source / entry['sourceFile']).convert('RGB')
    old_draw.text((x + 10, y + 5), f"{entry['level']:03d} 旧像素图 → 新像素图", font=font, fill='#23443b')
    before.paste(old_pixels.resize((230, 288), Image.Resampling.NEAREST), (x + 10, y + 38))
    before.paste(pixel_thumb, (x + 260, y + 38))
    old_draw.text((x + 10, y + 334), entry['sourceName'], font=small, fill='#23443b')
    old_draw.text((x + 260, y + 334), entry['name'], font=small, fill='#23443b')
    four = Image.new('RGB', (1000, 390), '#fff8ec')
    four_draw = ImageDraw.Draw(four)
    for col, (image, label, sampling) in enumerate([
        (old_original, '旧原图', Image.Resampling.LANCZOS),
        (old_pixels, '旧像素', Image.Resampling.NEAREST),
        (original, '新原图', Image.Resampling.LANCZOS),
        (pixels, '新像素', Image.Resampling.NEAREST),
    ]):
        four.paste(image.resize((240, 300), sampling), (col * 250 + 5, 38))
        four_draw.text((col * 250 + 8, 8), label, font=font, fill='#23443b')
    four_draw.text((8, 351), f"第 {entry['level']} 关：{entry['sourceName']} → {entry['name']}", font=font, fill='#23443b')
    four.save(folder / f"{entry['id']}-before-after.jpg", quality=94)
    peaks = '/'.join(str(v['peakUnfinished']) for v in game['variants'])
    wins = sum(v['policies']['capacity']['wins'] for v in game['variants'])
    report.append(f"|{entry['level']}|{entry['name']}|{entry['colors']}|{old_max} → {new_max}|{structure['before']['topThreeColorShare']:.1%} → {structure['after']['topThreeColorShare']:.1%}|{structure['review']['tier']}|{peaks}|{wins}/15|")
    notes.append(f"- 第{entry['level']}关：{entry['visualReview']} [四图对照]({entry['id']}-before-after.jpg)。")
sheet.save(folder / 'candidates-original-pixel.jpg', quality=94)
before.save(folder / 'before-after.jpg', quality=94)
report += ['', '每关三套方案均通过五个基础槽的实际最近路径通关回放、逐色容量守恒和对应阶段等待上限检查；策略通过率不代表玩家胜率。', '', '## 目视复核', ''] + notes
report += ['', '## 近色与相似性', '',
           '近色探索报告见 near-color-review.json：OKLab 邻接边距离 0.06 / 0.10 用来观察敏感性，不是已确认验收线；链式合并可能把端点色差较大的颜色连接起来。', '',
           '相似检索见 similarity-review.json，覆盖当前正式 300 关及本批互比；已查看前五近邻并补查同题材组。未观察到直接重复，检索不是语义模型，不保证不存在相似画面。', '',
           '退回版本的图片和提示词保留在 rejected-v1/、rejected-v2/；当前 manifest 保持 approved:false。']
if (folder / 'recognition-review.json').exists():
    report += ['', '## 主体与关键部位辨识', '',
               '先查看无原图、无标题的 pixels-only-no-labels.png，再检查关键部位网格及原图。此项是同一审阅者的目视复核，不是独立盲测；不根据结构分数自动判为视觉合格。', '',
               '本轮复核记录与具体像素文件哈希绑定，见 recognition-review.json。放大网格只展示现有像素，不会补回细节。', '']
    for row in json.loads((folder / 'recognition-review.json').read_text())['rows']:
        report.append(f"- 第{row['level']}关：[关键部位网格]({row['id']}-diagnostic-grid.png)。{row['notes']}")
(folder / 'review-results.md').write_text('\n'.join(report) + '\n')
print(f'Prepared {len(entries)} candidate comparisons without changing approval.')

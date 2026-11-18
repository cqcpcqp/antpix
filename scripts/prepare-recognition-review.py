"""Prepare pixel-only and diagnostic-part views for human recognition review.

These views do not classify subjects or grant approval. Enlarging uses nearest
neighbors; missing facial or object details cannot be recovered by enlargement.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
args = parser.parse_args()
folder = args.directory.resolve()
entries = json.loads((folder / 'manifest.json').read_text())
font = ImageFont.truetype(str(ROOT / 'art/fonts/noto-NotoSansSC[wght].ttf'), 17)
rows = (len(entries) + 2) // 3
sheet = Image.new('RGB', (780, rows * 330), '#fff8ec')
for index, entry in enumerate(entries):
    pixels = Image.open(folder / entry['runtimePixelFile']).convert('RGB')
    assert pixels.size == (48, 60), entry['id']
    sheet.paste(pixels.resize((240, 300), Image.Resampling.NEAREST),
                (index % 3 * 260 + 10, index // 3 * 330 + 10))
sheet.save(folder / 'pixels-only-no-labels.png')
# Boxes are explicitly recorded by the reviewer, not inferred from metadata.
# Half-open coordinates refer to the 48x60 grid, measured from top left.
review_file = folder / 'recognition-review.json'
if review_file.exists():
    review = json.loads(review_file.read_text())
    for row in review['rows']:
        entry = next(entry for entry in entries if entry['id'] == row['id'])
        pixel_file = folder / entry['runtimePixelFile']
        assert hashlib.sha256(pixel_file.read_bytes()).hexdigest() == row['pixelSha256'], 'Recognition review refers to old pixels'
        pixels = Image.open(pixel_file).convert('RGB')
        box = row['diagnosticBox']
        left, top, right, bottom = box
        assert 0 <= left < right <= 48 and 0 <= top < bottom <= 60
        scale = 16
        crop = pixels.crop(box).resize(((right - left) * scale, (bottom - top) * scale), Image.Resampling.NEAREST)
        image = Image.new('RGB', (max(520, crop.width + 20), crop.height + 64), '#fff8ec')
        image.paste(crop, (10, 54))
        draw = ImageDraw.Draw(image)
        draw.text((10, 8), f"{row['level']:03d} 关键部位 · 原网格 {right-left}×{bottom-top}", font=font, fill='#23443b')
        draw.text((10, 30), '像素放大不补回细节；最终仍需单独查看整图', font=font, fill='#23443b')
        for x in range(10, 11 + crop.width, scale):
            draw.line((x, 54, x, 54 + crop.height), fill='#888888', width=1)
        for y in range(54, 55 + crop.height, scale):
            draw.line((10, y, 10 + crop.width, y), fill='#888888', width=1)
        image.save(folder / f"{entry['id']}-diagnostic-grid.png")
print(f'Prepared {len(entries)} pixel-only views; no automatic recognition or approval.')

"""Rank visual neighbors of redraw candidates against the installed catalog.

Requires Pillow and numpy (the same environment as optimize-level-pixels.py).
Scores are review aids, not semantic duplicate decisions or artwork approval.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('candidate', type=Path)
parser.add_argument('--peer', action='append', default=[], type=Path, help='Other uninstalled batches to compare without changing their files')
args = parser.parse_args()
folder = args.candidate.resolve()
font = ImageFont.truetype(str(ROOT / 'art/fonts/noto-NotoSansSC[wght].ttf'), 17)


def descriptor(path):
    image = Image.open(path).convert('RGB')
    rgb = np.asarray(image.resize((12, 15), Image.Resampling.BOX), dtype=float) / 255
    gray = np.asarray(image.resize((32, 32), Image.Resampling.BOX).convert('L'), dtype=float)
    x = np.arange(32)
    transform = np.cos(np.pi * (2 * x[None, :] + 1) * np.arange(8)[:, None] / 64)
    spectrum = (transform @ gray @ transform.T).reshape(-1)[1:]
    phash = spectrum > np.median(spectrum)
    hsv = np.asarray(image.resize((96, 120), Image.Resampling.BOX).convert('HSV'))
    bins = hsv[..., 0].astype(int) // 32 * 16 + hsv[..., 1].astype(int) // 64 * 4 + hsv[..., 2].astype(int) // 64
    histogram = np.bincount(bins.reshape(-1), minlength=128).astype(float)
    histogram /= histogram.sum()
    return dict(rgb=rgb, phash=phash, histogram=histogram,
                digest=hashlib.sha256(np.asarray(image).tobytes()).hexdigest())


def distance(a, b):
    shape = float(np.mean(a['phash'] != b['phash']))
    layout = float(np.sqrt(np.mean((a['rgb'] - b['rgb']) ** 2)))
    palette = float(np.abs(a['histogram'] - b['histogram']).sum() / 2)
    return dict(rankDistance=0.45 * shape + 0.35 * layout + 0.20 * palette,
                shapeHamming=shape, spatialRgbRMSE=layout, paletteDistance=palette,
                exactDuplicate=a['digest'] == b['digest'])


catalog = []
for source in json.loads((ROOT / 'art/cartoons/runtime-catalog.json').read_text())['sources']:
    for entry in json.loads((ROOT / source / 'manifest.json').read_text()):
        path = ROOT / source / entry['runtimePixelFile']
        catalog.append(dict(level=entry['level'], id=entry['id'], name=entry['name'],
                            path=path, feature=descriptor(path)))
candidates = []
pixel_rows = []
for entry in json.loads((folder / 'manifest.json').read_text()):
    path = folder / entry['runtimePixelFile']
    if path.exists():
        image = Image.open(path).convert('RGB')
        data = np.asarray(image).reshape(-1, 3)
        palette, pixels = np.unique(data, axis=0, return_inverse=True)
        assert image.size == (48, 60), entry['id']
        assert len(palette) == entry['colors'], entry['id']
        pixel_rows.append(dict(**entry, pixels=pixels.tolist(), palette=palette.tolist(),
                               width=48, height=60, capacity=40))
        candidates.append(dict(level=entry['level'], id=entry['id'], name=entry['name'],
                               path=path, feature=descriptor(path)))
(folder / 'candidate-pixels.json').write_text(json.dumps(pixel_rows, ensure_ascii=False) + '\n')
peers = []
for peer_folder in args.peer:
    peer_folder = peer_folder.resolve()
    assert peer_folder != folder, 'Peer must be a different batch'
    for entry in json.loads((peer_folder / 'manifest.json').read_text()):
        path = peer_folder / entry['runtimePixelFile']
        peers.append(dict(level=entry['level'], id=entry['id'], name=entry['name'],
                          pixelFile=str(path.relative_to(ROOT)), feature=descriptor(path)))
rows = []
for candidate in candidates:
    neighbors = sorted([dict(level=entry['level'], name=entry['name'], id=entry['id'],
                             pixelFile=str(entry['path'].relative_to(ROOT)),
                             **distance(candidate['feature'], entry['feature']))
                        for entry in catalog], key=lambda row: row['rankDistance'])[:5]
    other_candidates = [dict(level=entry['level'], name=entry['name'],
                             **distance(candidate['feature'], entry['feature']))
                        for entry in candidates if entry['id'] != candidate['id']]
    rows.append(dict(level=candidate['level'], id=candidate['id'], installedNeighbors=neighbors,
                     candidateNeighbors=sorted(other_candidates, key=lambda row: row['rankDistance']),
                     otherBatchNeighbors=sorted([dict(level=entry['level'], name=entry['name'],
                         id=entry['id'], pixelFile=entry['pixelFile'],
                         **distance(candidate['feature'], entry['feature'])) for entry in peers],
                         key=lambda row: row['rankDistance'])))
    sheet = Image.new('RGB', (1050, 300), '#fff8ec')
    draw = ImageDraw.Draw(sheet)
    for index, entry in enumerate([candidate] + neighbors):
        x = index * 175 + 8
        path = candidate['path'] if index == 0 else ROOT / entry['pixelFile']
        sheet.paste(Image.open(path).convert('RGB').resize((156, 195), Image.Resampling.NEAREST), (x, 45))
        draw.text((x, 8), f"{entry['level']:03d} {'候选' if index == 0 else '近邻'}", font=font, fill='#24443b')
        draw.text((x, 245), entry['name'][:9], font=font, fill='#24443b')
    sheet.save(folder / f"{candidate['id']}-neighbors.jpg", quality=93)

# All-pairs catalog retrieval surfaces overlooked repeats, but does not declare
# distinct themes duplicates merely because a common sky or palette matches.
pairs = []
for index, a in enumerate(catalog):
    for b in catalog[index + 1:]:
        pairs.append(dict(levels=[a['level'], b['level']], names=[a['name'], b['name']],
                          **distance(a['feature'], b['feature'])))
report = dict(method='63-bit luminance DCT hash + spatial RGB + HSV histogram, ranking only; no semantic model or acceptance threshold',
              catalogCount=len(catalog), pairsCompared=len(pairs), candidateCount=len(candidates), peerCandidateCount=len(peers),
              candidateRows=rows, catalogNearestPairs=sorted(pairs, key=lambda row: row['rankDistance'])[:60])
(folder / 'similarity-review.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(dict(catalog=len(catalog), pairs=len(pairs), candidates=len(candidates)), ensure_ascii=False))

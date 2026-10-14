"""Extract mint artwork at 3x phone display density (1.5x the logical canvas).

Requires Pillow and imagequant. The perceptual palette keeps smooth shading while
fitting the WeChat main package; the full-colour source remains in art/ui/sources.
"""
import json
from pathlib import Path
from PIL import Image
import imagequant

source = Image.open("art/ui/sources/home-play-mint.png").convert("RGBA")
# Remove the solid magenta matte, including counters between Chinese strokes.
# Recover edge colours before resampling so linear filtering cannot leave pink fringes.
pixels = source.load()
for y in range(source.height):
    for x in range(source.width):
        r, g, b, _ = pixels[x, y]
        excess = max(0, min(r, b) - g)
        alpha = max(0, min(1, 1 - excess / 180))
        if alpha < 1:
            r = max(0, min(255, round((r - 255 * (1 - alpha)) / alpha))) if alpha else 0
            b = max(0, min(255, round((b - 255 * (1 - alpha)) / alpha))) if alpha else 0
        pixels[x, y] = (r, g, b, round(alpha * 255))

regions = {
    "play": ((0, 0, 1536, 455), (750, 240), "38927a42-9ae4-41c9-a101-9733549d53a1"),
    "play-start": ((0, 455, 1536, 735), (495, 132), "8bb44289-7308-4983-954e-d6ff81977929"),
    "play-resume": ((0, 735, 1536, 1024), (495, 132), "15b99871-c8cd-4f7c-8f71-352678390864"),
}
template = json.loads(Path("assets/resources/home/play.png.meta").read_text())
for name, (region, size, uuid) in regions.items():
    image = source.crop(region)
    image = image.crop(image.getchannel("A").point(lambda a: 255 if a > 32 else 0).getbbox())
    image.thumbnail((size[0] - 8, size[1] - 8), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size)
    canvas.alpha_composite(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    target = Path(f"assets/resources/home/{name}.png")
    imagequant.quantize_pil_image(
        canvas, dithering_level=0.5, max_colors=256, min_quality=85, max_quality=100
    ).save(target, optimize=True)
    meta = json.loads(json.dumps(template))
    meta["uuid"] = uuid
    texture = meta["subMetas"]["6c48a"]
    texture["uuid"] = uuid + "@6c48a"
    texture["displayName"] = name
    texture["userData"]["imageUuidOrDatabaseUri"] = uuid
    meta["userData"]["redirect"] = uuid + "@6c48a"
    Path(str(target) + ".meta").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"{name}: {target.stat().st_size / 1024:.1f} KiB")

import json
from pathlib import Path
from PIL import Image

source = Image.open("art/ui/sources/home-actions.png").convert("RGBA")
# Remove the requested chroma background, including the holes in bag handles.
pixels = source.load()
for y in range(source.height):
    for x in range(source.width):
        r, g, b, a = pixels[x, y]
        excess = min(r, b) - g
        if excess > 40:
            alpha = max(0, min(255, round(255 * (100 - excess) / 60)))
            pixels[x, y] = (r, g, b, alpha)

regions = {
    "play": ((0, 0, 1536, 380), (1260, 200), "38927a42-9ae4-41c9-a101-9733549d53a1"),
    "album": ((0, 390, 512, 1024), (304, 272), "59a82e23-950f-4966-b222-9cf219830a02"),
    "shop": ((512, 390, 1000, 1024), (304, 272), "7bcc2739-9a80-4312-a333-f9d4da734b03"),
    "rank": ((1000, 390, 1536, 1024), (304, 272), "8df319e4-4f84-43b8-a444-bcd212ca5c04"),
}
template = json.loads(Path("assets/resources/home/title.png.meta").read_text())
for name, (region, size, uuid) in regions.items():
    image = source.crop(region)
    bounds = image.getchannel("A").point(lambda value: 255 if value > 32 else 0).getbbox()
    image = image.crop(bounds)
    image.thumbnail((size[0] - 8, size[1] - 8), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size)
    canvas.alpha_composite(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    target = Path(f"assets/resources/home/{name}.png")
    canvas.quantize(colors=128, method=Image.Quantize.FASTOCTREE).save(target, optimize=True)
    meta = json.loads(json.dumps(template))
    meta["uuid"] = uuid
    texture = meta["subMetas"]["6c48a"]
    texture["uuid"] = uuid + "@6c48a"
    texture["displayName"] = name
    texture["userData"]["imageUuidOrDatabaseUri"] = uuid
    meta["userData"]["redirect"] = uuid + "@6c48a"
    Path(str(target) + ".meta").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"{name}: {target.stat().st_size // 1024} KiB")

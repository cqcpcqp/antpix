"""Lossless for the white fill; quantize antialiasing to keep the WeChat package small."""
from pathlib import Path
from PIL import Image

path = Path("assets/resources/fonts/ant-nest-bitmap.png")
image = Image.open(path).convert("RGBA")
image.quantize(colors=64, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
print(f"Bitmap font atlas: {path.stat().st_size // 1024} KiB")

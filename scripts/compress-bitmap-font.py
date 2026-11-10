"""Quantize antialiasing, then compress PNG losslessly. Requires Pillow and zopfli."""
from pathlib import Path
from PIL import Image
from zopfli.png import optimize

path = Path("assets/resources/fonts/ant-nest-bitmap.png")
image = Image.open(path).convert("RGBA")
image.quantize(colors=64, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
path.write_bytes(optimize(path.read_bytes(), num_iterations=5, num_iterations_large=5))
print(f"Bitmap font atlas: {path.stat().st_size // 1024} KiB")

from pathlib import Path
from PIL import Image

source = Path("art/ui/sources/home-title.png")
target = Path("assets/resources/home/title.png")
image = Image.open(source).convert("RGBA")
image = image.resize((1128, 376), Image.Resampling.LANCZOS)
target.parent.mkdir(parents=True, exist_ok=True)
image.save(target, optimize=True)
print(f"Title asset: {target}, {image.size}, {target.stat().st_size // 1024} KiB")

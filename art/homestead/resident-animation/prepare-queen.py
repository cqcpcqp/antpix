"""Pack the painted resident joints and food props into one runtime atlas."""

from collections import deque
from pathlib import Path

from PIL import Image, ImageOps
from lili_parts import pack_lili


def isolate(image):
    alpha = image.getchannel('A')
    width, height = image.size
    mask = alpha.point(lambda value: 255 if value >= 96 else 0)
    pixels = mask.load()
    strongest = []
    for row in range(height):
        for col in range(width):
            if not pixels[col, row]:
                continue
            queue = deque([(col, row)])
            pixels[col, row] = 0
            component = []
            while queue:
                xpos, ypos = queue.popleft()
                component.append((xpos, ypos))
                for nx, ny in ((xpos - 1, ypos), (xpos + 1, ypos), (xpos, ypos - 1), (xpos, ypos + 1)):
                    if 0 <= nx < width and 0 <= ny < height and pixels[nx, ny]:
                        pixels[nx, ny] = 0
                        queue.append((nx, ny))
            if len(component) > len(strongest):
                strongest = component
    cleaned = Image.new('RGBA', image.size)
    for position in strongest:
        red, green, blue, opacity = image.getpixel(position)
        cleaned.putpixel(position, (red, green, blue, min(255, round((opacity - 96) * 255 / 144))))
    return cleaned.crop(cleaned.getbbox())


def pack_food(source):
    crops = (
        ((0, 0, 512, 512), (260, 260, 66, 50)),
        ((512, 0, 1024, 512), (331, 260, 60, 60)),
        ((0, 512, 512, 1024), (396, 260, 40, 34)),
    )
    for crop, (left, top, width, height) in crops:
        part = isolate(source.crop(crop))
        part = ImageOps.contain(part, (width, height))
        atlas.alpha_composite(part, (left + (width - part.width) // 2,
                                     top + (height - part.height) // 2))


assets = Path(__file__).resolve().parent
atlas = Image.new('RGBA', (512, 512))
pack_lili(atlas)
pack_food(Image.open(assets / 'snacks-parts.png').convert('RGBA'))

target = assets.parents[2] / 'assets/resources/home/resident-rig.png'
atlas.save(target, optimize=True)

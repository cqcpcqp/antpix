"""Cut the approved Lili concept into transparent, independently posed atlas parts."""

from math import hypot
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


def silhouette(source, outline, bounds=None):
    mask = Image.new('L', source.size)
    ImageDraw.Draw(mask).polygon(outline, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.65))
    result = source.copy()
    result.putalpha(mask)
    return result.crop(bounds or mask.getbbox())


def insert(atlas, part, bounds):
    left, top, width, height = bounds
    fitted = ImageOps.contain(part, (width, height), Image.Resampling.LANCZOS)
    atlas.alpha_composite(fitted, (left + (width - fitted.width) // 2,
                                   top + (height - fitted.height) // 2))


def closed_eyes(source):
    result = source.copy()
    for bounds, sample in [((185, 319, 305, 400), (161, 302, 201, 330)),
                           ((362, 230, 456, 338), (431, 322, 468, 349))]:
        width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
        patch = source.crop(sample).resize((width, height), Image.Resampling.BICUBIC)
        patch = patch.filter(ImageFilter.GaussianBlur(3))
        mask = Image.new('L', patch.size)
        ImageDraw.Draw(mask).rounded_rectangle((4, 4, width - 5, height - 5), 20, fill=255)
        result.paste(patch, bounds[:2], mask.filter(ImageFilter.GaussianBlur(3)))
    draw = ImageDraw.Draw(result)
    draw.line([(208, 370), (217, 375), (229, 376), (243, 372), (256, 364), (266, 355)],
              fill='#59321e', width=7, joint='curve')
    draw.line([(383, 300), (394, 304), (403, 304), (414, 300), (423, 292), (431, 282)],
              fill='#59321e', width=7, joint='curve')
    return result


def pack_lili(atlas):
    source = Image.open(Path(__file__).with_name('lili-concept.png')).convert('RGBA')
    head = [
        (102, 378), (108, 337), (121, 288), (147, 244), (180, 207), (199, 192),
        (184, 181), (176, 167), (185, 158), (219, 156), (210, 139), (209, 118),
        (215, 93), (224, 92), (248, 106), (266, 130), (273, 148), (282, 128),
        (299, 112), (306, 110), (311, 122), (306, 146), (298, 154), (331, 149),
        (356, 150), (392, 159), (427, 175), (461, 199), (487, 226), (509, 255),
        (524, 285), (529, 308), (528, 333), (520, 362), (505, 389), (484, 413),
        (459, 432), (449, 437), (434, 425), (418, 415), (404, 418), (391, 426),
        (382, 440), (369, 446), (358, 448), (346, 438), (332, 436), (317, 441),
        (302, 451), (287, 469), (256, 482), (224, 492), (196, 495), (170, 491),
        (147, 477), (128, 458), (114, 432), (106, 409),
    ]
    insert(atlas, silhouette(source, head), (2, 2, 109, 122))
    insert(atlas, silhouette(closed_eyes(source), head), (115, 2, 109, 122))
    for outline, bounds in [
        ([(25, 197), (30, 178), (45, 159), (64, 146), (86, 137), (111, 137),
          (137, 145), (158, 161), (177, 181), (190, 200), (178, 220), (168, 199),
          (152, 183), (135, 173), (113, 166), (100, 167), (93, 181), (87, 200),
          (72, 218), (56, 228), (42, 226), (29, 218)], (161, 132, 55, 56)),
        ([(335, 151), (338, 115), (344, 86), (354, 61), (370, 43), (392, 27),
          (414, 19), (434, 16), (452, 21), (465, 31), (471, 45), (467, 60),
          (454, 71), (432, 77), (411, 77), (385, 68), (372, 76), (361, 95),
          (354, 117), (350, 151)], (161, 192, 55, 60)),
        ([(452, 493), (470, 471), (493, 477), (516, 491), (530, 508),
          (537, 529), (536, 551), (526, 575), (510, 589), (486, 598), (461, 599),
          (445, 583), (440, 546)], (64, 132, 92, 81)),
        ([(234, 601), (254, 606), (271, 619), (269, 634), (262, 647),
          (245, 650), (231, 642), (226, 628), (226, 611)], (222, 48, 31, 45)),
        ([(259, 507), (268, 489), (283, 468), (303, 450), (320, 440),
          (337, 438), (351, 445), (358, 457), (357, 471), (346, 490), (328, 512),
          (309, 530), (291, 540), (271, 541), (259, 533), (254, 522)], (2, 198, 43, 51)),
    ]:
        part = silhouette(source, outline)
        if bounds[1] == 198:
            part = part.rotate(-35, Image.Resampling.BICUBIC, expand=True)
            part = ImageOps.flip(part.crop(part.getbbox()))
        insert(atlas, part, bounds)

    torso = Image.new('RGBA', (236, 184))
    texture = source.crop((307, 538, 419, 604)).resize(torso.size, Image.Resampling.LANCZOS)
    for row in range(torso.height):
        for col in range(torso.width):
            radius = hypot((col - 117) / 115, (row - 84) / 91)
            if radius >= 1.005:
                continue
            shade = max(0, min(1, (radius - 0.56) / 0.44)) * 0.6
            red, green, blue, _ = texture.getpixel((col, row))
            torso.putpixel((col, row), (round(red - shade * 51), round(green - shade * 86),
                                        round(blue - shade * 81),
                                        round(min(1, max(0, (1.005 - radius) * 105)) * 255)))
    insert(atlas, torso, (2, 132, 58, 60))

"""Export the original painted Lili as a weighted Spine 3.8 mesh and authored clips."""

import json
from math import exp
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
from lili_parts import silhouette
from resident_spine_export import clip
from lili_courtyard_clips import COURTYARD_CLIPS

HERE = Path(__file__).resolve().parent
TARGET = HERE.parents[2] / 'assets/resources/home'
WIDTH, HEIGHT = 508, 686
ORIGIN_X, ORIGIN_Y = 282, 680
SCALE = 0.138

OUTLINE = [
    (12, 173), (17, 151), (29, 133), (47, 116), (67, 104), (88, 95),
    (106, 94), (124, 99), (142, 108), (160, 121), (178, 139), (176, 131),
    (191, 131), (210, 132), (223, 142), (218, 128), (216, 111), (219, 95),
    (228, 78), (234, 72), (246, 77), (260, 89), (270, 104), (277, 123),
    (292, 110), (310, 104), (318, 104), (320, 113), (318, 128), (310, 144),
    (306, 150), (329, 150), (331, 136), (337, 111), (345, 88), (356, 66),
    (372, 47), (391, 30), (414, 17), (436, 12), (452, 13), (473, 20),
    (484, 30), (491, 41), (495, 56), (491, 68), (481, 78), (461, 84),
    (440, 85), (421, 81), (404, 75), (390, 72), (375, 81), (363, 96),
    (354, 115), (348, 137), (345, 158), (362, 170), (389, 181), (416, 199),
    (442, 221), (462, 247), (478, 275), (489, 305), (496, 335), (499, 360),
    (495, 387), (486, 414), (472, 440), (453, 460), (431, 477), (405, 490),
    (380, 502), (390, 514), (409, 531), (427, 547), (436, 559), (440, 568),
    (436, 578), (444, 586), (451, 597), (454, 610), (452, 625), (444, 638),
    (432, 647), (410, 654), (393, 655), (375, 652), (362, 651), (361, 662),
    (355, 674), (346, 680), (332, 680), (321, 674), (312, 665), (282, 666),
    (252, 664), (247, 673), (240, 680), (225, 681), (215, 677), (208, 668),
    (203, 653), (188, 644), (177, 630), (171, 613), (168, 594), (153, 595),
    (137, 591), (127, 583), (126, 572), (132, 560), (145, 548), (161, 535),
    (178, 516), (183, 510), (161, 504), (135, 492), (111, 475), (91, 456),
    (77, 434), (68, 407), (64, 382), (65, 355), (69, 328), (77, 300),
    (89, 275), (104, 250), (123, 228), (147, 206), (174, 189), (166, 174),
    (154, 158), (140, 144), (126, 135), (113, 134), (102, 142), (92, 160),
    (82, 178), (69, 195), (53, 203), (39, 206), (26, 202), (16, 192),
]

JOINTS = [
    ('root', None, ORIGIN_X, ORIGIN_Y), ('body', 'root', 282, 568),
    ('head', 'body', 280, 475), ('antennaLeft', 'head', 182, 182),
    ('antennaRight', 'head', 337, 152), ('handLeft', 'body', 201, 520),
    ('handRight', 'body', 362, 519), ('footLeft', 'body', 227, 649),
    ('footRight', 'body', 338, 650), ('tail', 'body', 399, 604),
    ('mouth', 'head', 305, 398),
]
POSITIONS = {name: (xpos, ypos) for name, _, xpos, ypos in JOINTS}


def blend(value, start, end):
    progress = max(0, min(1, (value - start) / (end - start)))
    return progress * progress * (3 - 2 * progress)


def weights(xpos, ypos):
    result = {'body': 1.0}
    # Keep the jaw with the face. Share the bend across the shoulder seam.
    head = 1 - blend(ypos, 485, 540)
    result.update(body=1 - head, head=head)
    zones = [
        ('antennaLeft', (1 - blend(xpos, 150, 191)) * (1 - blend(ypos, 172, 216))),
        ('antennaRight', blend(xpos, 322, 351) * (1 - blend(ypos, 126, 168))),
        ('tail', blend(xpos, 394, 435) * blend(ypos, 561, 599)),
        ('footLeft', (1 - blend(xpos, 250, 275)) * blend(ypos, 649, 676)),
        ('footRight', blend(xpos, 294, 333) * blend(ypos, 649, 676)),
    ]
    for name, center, radius in [
        ('handLeft', (153, 567), (45, 49)), ('handRight', (413, 553), (43, 41)),
    ]:
        distance = ((xpos - center[0]) / radius[0]) ** 2 + ((ypos - center[1]) / radius[1]) ** 2
        zones.append((name, min(0.93, exp(-1.9 * distance)) * (1 - blend(distance, 0.65, 1.8))))
    for name, influence in zones:
        for key in result:
            result[key] *= 1 - influence
        result[name] = influence
    selected = [(key, value) for key, value in result.items() if value > 0.008]
    total = sum(value for _, value in selected)
    return [(key, value / total) for key, value in selected]


def mesh():
    cols, rows = 24, 28
    vertices, uvs, triangles = [], [], []
    indices = {name: index for index, (name, *_) in enumerate(JOINTS)}
    for row in range(rows + 1):
        for col in range(cols + 1):
            xpos = WIDTH * col / cols
            ypos = HEIGHT * row / rows
            uvs.extend((col / cols, row / rows))
            influences = weights(xpos, ypos)
            vertices.append(len(influences))
            for name, weight in influences:
                joint_x, joint_y = POSITIONS[name]
                vertices.extend((indices[name], round((xpos - joint_x) * SCALE, 5),
                                 round((joint_y - ypos) * SCALE, 5), round(weight, 6)))
            if col < cols and row < rows:
                top = row * (cols + 1) + col
                bottom = top + cols + 1
                triangles.extend((top, bottom, bottom + 1, top, bottom + 1, top + 1))
    return {'type': 'mesh', 'uvs': uvs, 'triangles': triangles, 'vertices': vertices,
            'width': WIDTH, 'height': HEIGHT, 'hull': 0}


def closed_eyes(source):
    result = source.copy()
    for left, top, right, bottom in [(175, 312, 250, 407), (346, 284, 418, 380)]:
        width, height = right - left, bottom - top
        patch = Image.new('RGBA', (width, height))
        for row in range(height):
            left_color = source.getpixel((left, top + row))
            right_color = source.getpixel((right, top + row))
            for col in range(width):
                amount = col / (width - 1)
                patch.putpixel((col, row), tuple(
                    round(start + (end - start) * amount)
                    for start, end in zip(left_color, right_color)
                ))
        mask = Image.new('L', patch.size)
        ImageDraw.Draw(mask).rounded_rectangle((3, 3, width - 4, height - 4), 14, fill=255)
        result.paste(patch, (left, top), mask.filter(ImageFilter.GaussianBlur(1.6)))
    draw = ImageDraw.Draw(result)
    for points in [
        [(187, 357), (194, 364), (204, 369), (214, 369), (223, 365), (231, 357)],
        [(360, 328), (368, 336), (378, 340), (387, 340), (396, 335), (403, 328)],
    ]:
        draw.line(points, fill='#683513', width=7, joint='curve')
    return result


ANIMATIONS = {
    'idle': clip(3.2, {
        'body': {'scale': [(0, 1, 1), (0.8, 1.018, 0.982), (1.65, 0.987, 1.022), (3.2, 1, 1)]},
        'head': {'rotate': [(0, 0), (1.12, 5), (1.72, 5), (2.48, -3), (3.2, 0)]},
        'antennaLeft': {'rotate': [(0, 0), (1.16, -8), (1.57, 6), (2.3, -3), (3.2, 0)]},
        'antennaRight': {'rotate': [(0, 0), (1.24, 7), (1.68, -5), (2.3, 3), (3.2, 0)]},
    }, [(1.35, 1.45)]),
    'walk': clip(0.72, {
        'body': {'translate': [(0, -1, 0), (.18, 0, 4), (.36, 1, 0), (.54, 0, 4), (.72, -1, 0)],
                 'rotate': [(0, -5), (.18, 0), (.36, 5), (.54, 0), (.72, -5)]},
        'head': {'rotate': [(0, 4), (.36, -4), (.72, 4)]},
        'handLeft': {'rotate': [(0, 13), (.36, -9), (.72, 13)],
                     'translate': [(0, -4, -5), (.36, -2, -2), (.72, -4, -5)]},
        'handRight': {'rotate': [(0, -11), (.36, 11), (.72, -11)],
                      'translate': [(0, 2, -2), (.36, 4, -5), (.72, 2, -2)]},
        'footLeft': {'translate': [(0, 3, -1), (.23, -3, 0), (.47, -1, 5), (.72, 3, -1)]},
        'footRight': {'translate': [(0, -2, 4), (.23, 3, -1), (.49, -3, 0), (.72, -2, 4)]},
        'antennaLeft': {'rotate': [(0, -8), (.24, 12), (.47, -10), (.72, -8)]},
        'antennaRight': {'rotate': [(0, 6), (.31, -11), (.57, 9), (.72, 6)]},
        'tail': {'rotate': [(0, 6), (.36, -8), (.72, 6)]},
    }),
    'rest': clip(2.8, {
        # Match the standing proportions when the walk comes to a stop.
        'body': {'scale': [(0, 1, 1), (1.4, 1.012, 1.018), (2.8, 1, 1)]},
        'head': {'rotate': [(0, 0), (1.4, -3), (2.8, 0)]},
    }, [(1.32, 1.47)]),
    'look': clip(2.7, {
        'head': {'rotate': [(0, 0), (.5, 14), (1.02, 14), (1.58, -12), (2.12, -12), (2.7, 0)]},
        'antennaLeft': {'rotate': [(0, 0), (.65, -15), (1.48, 14), (2.34, -5), (2.7, 0)]},
        'antennaRight': {'rotate': [(0, 0), (.7, -11), (1.57, 14), (2.35, 5), (2.7, 0)]},
    }, [(1.15, 1.26)]),
    'groom': clip(2.4, {
        'head': {'rotate': [(0, 0), (.43, -11), (.75, -5), (1.12, -11), (1.56, -6), (2.4, 0)]},
        'handLeft': {'translate': [(0, 0, 0), (.46, -3, 6), (.74, 0, 3), (1.06, -3, 7),
                                    (1.4, 0, 3), (2.4, 0, 0)]},
    }, [(.44, 1.59)]),
    'sip': clip(5.4, {
        'body': {'rotate': [(0, 0), (.7, -9), (1.75, -8), (2.27, 0), (5.4, 0)]},
        'head': {'rotate': [(0, 0), (.69, -6), (.98, 1), (1.37, -6), (1.67, 1),
                            (2.25, 7), (2.6, 3), (3.1, 0), (5.4, 0)]},
        'handRight': {'translate': [(0, 0, 0), (.65, 4, -4), (1.33, 4, -3),
                                     (2.26, 1, 4), (2.7, 0, 0), (5.4, 0, 0)]},
        'antennaRight': {'rotate': [(0, 0), (.64, -9), (1.37, -6), (2.35, 9),
                                    (2.68, -4), (5.4, 0)]},
    }, [(.76, .96), (1.44, 1.64), (2.22, 2.53)]),
    'hungry': clip(2.6, {
        'head': {'rotate': [(0, 0), (.22, -5), (.4, 2), (.59, -5), (.82, 0), (1.18, -7), (2.05, -7), (2.6, 0)]},
        'body': {'translate': [(0, 0, 0), (.22, 2, -1), (.4, 1, 0),
                               (.59, 3, -1), (.86, 0, 0), (2.6, 0, 0)]},
        'antennaRight': {'rotate': [(0, 0), (.25, 14), (.46, -7), (.64, 10), (.83, 0), (2.6, 0)]},
        'handLeft': {'translate': [(0, 0, 0), (.75, 0, 0), (1.1, 9, -4), (1.31, 12, -2),
                                   (1.55, 8, -5), (1.8, 12, -2), (2.05, 8, -4), (2.6, 0, 0)]},
    }, [(1.1, 1.24)]),
    'pet': clip(1.35, {
        'body': {'rotate': [(0, 0), (.21, -1), (.6, 2), (.91, 2), (1.35, 0)]},
        'head': {'rotate': [(0, 0), (.18, -2), (.48, 6), (.78, 7), (1.35, 0)],
                 'translate': [(0, 0, 0), (.46, 0, -1.2), (.83, 0, -1.2), (1.35, 0, 0)]},
        'antennaLeft': {'rotate': [(0, 0), (.26, 6), (.53, -8), (.81, 3), (1.35, 0)]},
        'antennaRight': {'rotate': [(0, 0), (.31, -7), (.59, 7), (.87, -3), (1.35, 0)]},
    }, [(.25, .98)]),
    'petHappy': clip(1.65, {
        'body': {'rotate': [(0, 0), (.18, 1.3), (.55, -3.6), (1.07, -3.2), (1.65, 0)],
                 'translate': [(0, 0, 0), (.53, 1.8, -.7), (1.05, 1.8, -.7), (1.65, 0, 0)]},
        'head': {'translate': [(0, 0, 0), (.52, 2.5, .4), (.83, 2.0, .8),
                               (1.04, 2.6, .4), (1.65, 0, 0)],
                 'rotate': [(0, 0), (.19, 2), (.55, -3), (.81, -1),
                            (1.04, -4), (1.65, 0)]},
        'antennaLeft': {'rotate': [(0, 0), (.26, -5), (.65, 8), (.9, -3), (1.65, 0)]},
        'antennaRight': {'rotate': [(0, 0), (.29, 6), (.68, -7), (.95, 4), (1.65, 0)]},
    }, [(.46, 1.14)]),
    'cheer': clip(1.35, {
        'body': {'translate': [(0, 0, 0), (.18, 0, -5), (.42, 0, 19), (.64, 0, 0),
                               (.73, 0, -4), (.9, 0, 4), (1.35, 0, 0)],
                 'scale': [(0, 1, 1), (.18, 1.15, .78), (.34, .89, 1.13),
                           (.64, 1, 1), (.73, 1.13, .83), (.9, .97, 1.05), (1.35, 1, 1)]},
        'head': {'rotate': [(0, 0), (.18, -7), (.43, 12), (.64, -7), (1.02, 4), (1.35, 0)]},
        'handLeft': {'rotate': [(0, 0), (.17, 8), (.39, -24), (.55, -14), (1.35, 0)]},
        'handRight': {'rotate': [(0, 0), (.18, -8), (.4, 24), (.63, 14), (1.35, 0)]},
        'antennaRight': {'rotate': [(0, 0), (.19, -17), (.42, 18), (.73, -14), (1.35, 0)]},
    }, [(.31, .61)]),
    'eat': clip(4.15, {
        'body': {'rotate': [(0, 0), (.5, -7), (.93, 0), (4.15, 0)],
                 'scale': [(0, 1, 1), (.5, 1.025, .977), (.93, .996, 1.02),
                           (2.33, .99, 1.022), (3.2, 1, 1), (3.38, 1.016, .991),
                           (3.51, 1, 1), (3.68, 1.016, .991), (3.86, 1, 1)]},
        'head': {'rotate': [(0, 0), (.52, -13), (.93, 2), (1.03, 8), (1.19, 1),
                            (1.44, 8), (1.61, 1), (1.88, 8), (2.06, 1), (2.33, 11), (3.2, 0),
                            (3.40, 4), (3.53, 1), (3.70, 5), (4.07, 0)]},
        'handLeft': {'rotate': [(0, 0), (.53, 10), (.93, -12), (2.0, -12), (3.2, 0)],
                     'translate': [(0, 0, 0), (.53, 2, -2), (.93, 7, 13),
                                   (2.0, 7, 13), (3.2, 0, 0)]},
        'handRight': {'rotate': [(0, 0), (.53, -10), (.93, 15), (2.0, 15), (3.2, 0),
                                 (3.37, 15), (3.51, 6), (3.67, 17), (4.03, 0)],
                      'translate': [(0, 0, 0), (.53, -2, -2), (.93, -8, 13),
                                    (2.0, -8, 13), (3.2, 0, 0), (3.37, -6, -2),
                                    (3.51, -2, 1), (3.67, -7, -2), (4.03, 0, 0)]},
        'antennaRight': {'rotate': [(0, 0), (.57, -17), (1.02, 8), (1.45, -9), (1.88, 9), (3.2, 0)]},
    }, [(2.16, 2.72), (3.35, 3.82)]),

    **COURTYARD_CLIPS,
}


source = Image.open(HERE / 'lili-d-concept.png').convert('RGBA')
atlas = Image.new('RGBA', (WIDTH * 2, HEIGHT))
origin = silhouette(source, OUTLINE, (0, 0, WIDTH, HEIGHT))
closed = silhouette(closed_eyes(source), OUTLINE, (0, 0, WIDTH, HEIGHT))
atlas.alpha_composite(origin, (0, 0))
atlas.alpha_composite(closed, (WIDTH, 0))
atlas.save(TARGET / 'lili-skin.png', optimize=True)

bone_data = []
for name, parent, xpos, ypos in JOINTS:
    parent_x, parent_y = POSITIONS[parent or name]
    bone = {'name': name, 'x': round((xpos - parent_x) * SCALE, 5),
            'y': round((parent_y - ypos) * SCALE, 5)}
    if parent:
        bone['parent'] = parent
    bone_data.append(bone)
attachments = {'open': mesh(), 'closed': {'type': 'linkedmesh', 'parent': 'open'}}
rig = {'skeleton': {'spine': '3.8.99', 'width': WIDTH * SCALE, 'height': HEIGHT * SCALE}, 'bones': bone_data,
       'slots': [{'name': 'skin', 'bone': 'root', 'attachment': 'open'}],
       'skins': [{'name': 'default', 'attachments': {'skin': attachments}}],
       'animations': ANIMATIONS}
(TARGET / 'lili.json').write_text(json.dumps(rig, separators=(',', ':')) + '\n')
header = f'\nlili-skin.png\nsize: {WIDTH * 2},{HEIGHT}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n'
regions = ''.join(
    f'{name}\n  rotate: false\n  xy: {left}, 0\n  size: {WIDTH}, {HEIGHT}\n'
    f'  orig: {WIDTH}, {HEIGHT}\n  offset: 0, 0\n  index: -1\n'
    for name, left in [('open', 0), ('closed', WIDTH)]
)
(TARGET / 'lili.atlas').write_text(header + regions)

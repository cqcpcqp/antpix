"""Authored Spine clips for Lili's outdoor activities and furnishing visits."""

from resident_spine_export import clip


def sleep_shift(frames):
    turns = [(time, angle) for time, angle, _, _ in frames]
    positions = [(time, x, y) for time, _, x, y in frames]
    return {'root': {'rotate': turns, 'translate': positions}}


LYING = (-79, -39, 21)
DOWN = [(0, 0, 0, 0), (.19, 4, -2, 2), (.5, -27, -13, 3),
        (.8, -70, -34, 16), (1.1, *LYING)]
UP = [(round(1.1 - t, 2), angle, x, y) for t, angle, x, y in reversed(DOWN)]


def held_item(duration, phone=False, newspaper=False):
    left = (8, 5) if phone else (5, 7)
    right = (-9, 7) if phone else (-5, 8)
    beat = .75 if phone else 1.45
    return clip(duration, {
        'head': {'rotate': [(0, 0), (.54, -5), (beat + .32, -3),
                            (duration - .55, -5), (duration, 0)]},
        'handLeft': {'translate': [(0, 0, 0), (.56, *left), (duration - .55, *left), (duration, 0, 0)]},
        'handRight': {'translate': [(0, 0, 0), (.59, *right), (beat, *right),
                                    (beat + .15, right[0] + 2, right[1] + 2),
                                    (beat + .31, *right),
                                    (2.85, *right), (3.02, right[0] + 3, right[1] + 1),
                                    (3.2, *right), (duration - .55, *right), (duration, 0, 0)]},
        'antennaRight': {'rotate': [(0, 0), (.72, -9), (1.44, 3), (2.75, -5),
                                    (3.2, 4 if newspaper else 9), (duration, 0)]},
    }, [(1.12, 1.23), (3.45, 3.56)])


COURTYARD_CLIPS = {
    'run': clip(.48, {
        'body': {'translate': [(0, 1, 0), (.12, 2, 6), (.24, 1, 0), (.36, 2, 6), (.48, 1, 0)],
                 'rotate': [(0, -7), (.12, -10), (.24, -7), (.36, -10), (.48, -7)]},
        'head': {'rotate': [(0, 3), (.12, 6), (.24, 3), (.36, 6), (.48, 3)]},
        'handLeft': {'translate': [(0, 5, 3), (.24, -5, -3), (.48, 5, 3)]},
        'handRight': {'translate': [(0, -5, -3), (.24, 5, 3), (.48, -5, -3)]},
        'footLeft': {'translate': [(0, 3, 0), (.22, -5, -1), (.36, -2, 5), (.48, 3, 0)]},
        'footRight': {'translate': [(0, -5, -1), (.12, -2, 5), (.24, 3, 0), (.48, -5, -1)]},
        'antennaLeft': {'rotate': [(0, 8), (.12, 17), (.24, 8), (.36, 17), (.48, 8)]},
        'antennaRight': {'rotate': [(0, 4), (.16, 14), (.24, 4), (.4, 14), (.48, 4)]},
    }),
    'exercise': clip(5.8, {
        'body': {'translate': [(0, 0, 0), (.55, 0, 1), (.98, 0, -3), (1.3, 0, 9), (1.63, 0, 0),
                               (2.12, 0, -3), (2.46, 0, 10), (2.79, 0, 0), (3.31, 0, -3),
                               (3.67, 0, 10), (4.02, 0, 0), (4.5, 0, -2), (5.8, 0, 0)]},
        'footLeft': {'translate': [(0, 0, 0), (.98, 0, 3), (1.3, -4, 1), (1.63, 0, 0),
                                   (2.12, 0, 3), (2.46, -4, 1), (2.79, 0, 0),
                                   (3.31, 0, 3), (3.67, -4, 1), (4.02, 0, 0)]},
        'footRight': {'translate': [(0, 0, 0), (.98, 0, 3), (1.3, 4, 1), (1.63, 0, 0),
                                    (2.12, 0, 3), (2.46, 4, 1), (2.79, 0, 0),
                                    (3.31, 0, 3), (3.67, 4, 1), (4.02, 0, 0)]},
        'head': {'rotate': [(0, 0), (1.3, 4), (1.63, -3), (2.46, 4), (2.79, -3),
                            (3.67, 5), (4.02, -3), (4.5, 5), (5.8, 0)]},
        'handLeft': {'translate': [(0, 0, 0), (1.3, -3, 10), (1.63, 0, 0),
                                    (2.46, -3, 11), (2.79, 0, 0), (3.67, -3, 11), (4.21, 0, 0)]},
        'handRight': {'translate': [(0, 0, 0), (1.3, 3, 9), (1.63, 0, 0),
                                     (2.46, 3, 10), (2.79, 0, 0), (3.67, 3, 10), (4.21, 0, 0)]},
        'antennaRight': {'rotate': [(0, 0), (1.31, 12), (1.69, -8), (2.49, 13),
                                    (2.86, -9), (3.72, 13), (4.12, -8), (5.8, 0)]},
    }, [(1.24, 1.46), (2.39, 2.62), (3.61, 3.84)]),
    'read': held_item(6.2),
    'news': held_item(6.2, newspaper=True),
    'game': held_item(6.2, phone=True),
    'talk': clip(5, {
        'head': {'rotate': [(0, 0), (.48, 5), (.82, 0), (1.24, 4), (1.6, 0),
                            (3.2, -3), (3.7, 0), (5, 0)]},
        'handRight': {'translate': [(0, 0, 0), (.56, 2, 6), (1.15, 4, 3), (1.6, 2, 6), (2.4, 0, 0)]},
    }, [(1.8, 1.94)]),
    'lieDown': clip(1.1, sleep_shift(DOWN), attachments=[(0, 'open'), (.75, 'closed')]),
    'sleep': clip(3, {**sleep_shift([(0, *LYING), (3, *LYING)]),
                     'body': {'scale': [(0, 1, 1), (1.5, 1.014, 1.01), (3, 1, 1)]}},
                  attachments=[(0, 'closed')]),
    'lieUp': clip(1.1, sleep_shift(UP), attachments=[(0, 'closed'), (.42, 'open')]),
    'chairDown': clip(1.1, {
        'body': {'rotate': [(0, 0), (.52, 6), (1.1, 13)]},
        'footLeft': {'translate': [(0, 0, 0), (.65, 2, 2), (1.1, 4, 3)]},
        'footRight': {'translate': [(0, 0, 0), (.65, 3, 1), (1.1, 6, 2)]},
    }),
    'chairRest': clip(3.2, {
        'body': {'rotate': [(0, 13), (1.6, 14.5), (3.2, 13)]},
        'head': {'rotate': [(0, 0), (1.45, -4), (3.2, 0)]},
        'footLeft': {'translate': [(0, 4, 3), (1.6, 4, 2), (3.2, 4, 3)]},
        'footRight': {'translate': [(0, 6, 2), (1.6, 6, 1), (3.2, 6, 2)]},
    }, [(1.0, 2.2)]),
    'chairUp': clip(1.1, {
        'body': {'rotate': [(0, 13), (.42, 7), (.77, -3), (1.1, 0)]},
        'footLeft': {'translate': [(0, 4, 3), (1.1, 0, 0)]},
        'footRight': {'translate': [(0, 6, 2), (1.1, 0, 0)]},
    }),
    'mirror': clip(5.4, {
        'body': {'rotate': [(0, 0), (.72, -7), (1.7, -7), (2.28, 0), (5.4, 0)]},
        'head': {'rotate': [(0, 0), (.86, -5), (1.61, 4), (2.25, 1), (5.4, 0)]},
        'handRight': {'translate': [(0, 0, 0), (2.1, 0, 0), (2.65, 3, 7), (3.04, 0, 8),
                                     (3.42, 4, 5), (3.8, 0, 7), (4.44, 0, 0)]},
    }, [(1.18, 1.32), (3.8, 3.94)]),
    'pantry': clip(5.4, {
        'body': {'rotate': [(0, 0), (.61, -6), (1.23, 0), (4.0, 0), (4.5, -6), (5.4, 0)]},
        'head': {'rotate': [(0, 0), (.56, -4), (1.08, 2), (1.68, -5), (2.73, 3), (5.4, 0)]},
        'handRight': {'translate': [(0, 0, 0), (.58, 5, -3), (1.18, 0, 7), (3.94, 0, 7),
                                     (4.5, 5, -3), (5.4, 0, 0)]},
    }, [(2.0, 2.14)]),
    'lantern': clip(5.4, {
        'head': {'rotate': [(0, 0), (.57, 7), (1.18, 4), (1.8, 8), (2.66, 4), (4.8, 0)]},
        'antennaRight': {'rotate': [(0, 0), (.7, 13), (1.28, -4), (2.0, 12), (3.2, 0)]},
        'handRight': {'translate': [(0, 0, 0), (1.18, 0, 0), (1.85, 4, 7),
                                     (2.18, 2, 6), (3.02, 0, 0)]},
    }, [(3.1, 3.42)]),
}

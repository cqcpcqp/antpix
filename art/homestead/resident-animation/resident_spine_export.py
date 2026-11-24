"""Write the common timelines used by the painted residents' Spine 3.8 rigs."""


def clip(duration, tracks, closed=(), attachments=None):
    bones = {}
    fields = {'rotate': ('angle',), 'translate': ('x', 'y'), 'scale': ('x', 'y')}
    for name, channels in tracks.items():
        bones[name] = {}
        for channel, frames in channels.items():
            timeline = [dict(time=time, **dict(zip(fields[channel], values)))
                        for time, *values in frames]
            for keyframe in timeline[:-1]:
                keyframe['curve'] = [0.3, 0, 0.65, 1]
            if timeline[-1]['time'] < duration:
                timeline.append(dict(timeline[-1], time=duration))
            bones[name][channel] = timeline
    if attachments is None:
        attachments = [(0, 'open')]
        for start, end in closed:
            attachments.extend([(start, 'closed'), (end, 'open')])
    return {'bones': bones, 'slots': {'skin': {'attachment': [
        {'time': time, 'name': name} for time, name in attachments
    ]}}}

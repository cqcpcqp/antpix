"""Generate the soft button tap without touching music or collection sounds."""
import math
import struct
import wave
from pathlib import Path

rate = 24000
duration = 0.20
samples = []
for i in range(round(rate * duration)):
    t = i / rate
    envelope = (1 - math.exp(-t / 0.018)) * math.exp(-t / 0.045)
    envelope *= min(1, max(0, (duration - t) / 0.045))
    # Pure low tones avoid the bright overtone of the old wooden click.
    value = envelope * (0.40 * math.sin(2 * math.pi * 190 * t)
                        + 0.12 * math.sin(2 * math.pi * 130 * t))
    samples.append(round(value * 32767))

target = Path(__file__).resolve().parents[1] / "assets/resources/audio/tap.wav"
with wave.open(str(target), "wb") as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(rate)
    output.writeframes(struct.pack(f"<{len(samples)}h", *samples))
print(f"Soft tap: {duration}s, 190/130 Hz, peak {max(abs(v) for v in samples) / 32767:.3f}")

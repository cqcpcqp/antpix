"""Usage: PYTHONPATH=/tmp/ant-audio-libs python3 scripts/prepare-audio.py /path/to/Easy-Lemon.mp3
Requires numpy and imageio-ffmpeg. Source music is not distributed in the game package.
"""
import sys, subprocess, wave
from pathlib import Path
import numpy as np
import imageio_ffmpeg
root=Path(__file__).resolve().parents[1];out=root/'assets/resources/audio'
ff=imageio_ffmpeg.get_ffmpeg_exe()
# 32 bars at 82 BPM, starting after the introduction. Tail/head crossfade for looping.
rate=24000;beat=60/82;length=128*beat;cross=round(2*beat*rate)
raw=subprocess.check_output([ff,'-v','error','-ss',str(16*beat),'-i',sys.argv[1],'-t',str(length+2*beat),'-af','lowpass=f=6500','-ar',str(rate),'-ac','1','-f','f32le','-'])
a=np.frombuffer(raw,dtype='<f4').copy();n=round(length*rate)
assert len(a)>=n+cross
fade=np.linspace(0,1,cross)
a[:cross]=a[n:n+cross]*(1-fade)+a[:cross]*fade
a=a[:n];a*=.65/max(abs(a))
subprocess.run([ff,'-v','error','-y','-f','f32le','-ar',str(rate),'-ac','1','-i','pipe:0','-c:a','libmp3lame','-b:a','64k',str(out/'garden-bgm.mp3')],input=a.astype('<f4').tobytes(),check=True)
def save(name,events,duration):
 t=np.arange(round(duration*rate))/rate;v=np.zeros_like(t)
 for start,hz,gain in events:
  u=t-start;active=u>=0;u=np.maximum(u,0)
  envelope=(1-np.exp(-u/.009))*np.exp(-u/.095)*active
  v+=gain*envelope*(np.sin(2*np.pi*hz*u)+.18*np.sin(2*np.pi*hz*2*u))
 v*=np.minimum(1,np.maximum(0,(duration-t)/.045))
 with wave.open(str(out/(name+'.wav')),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((np.clip(v,-1,1)*32767).astype('<i2').tobytes())
subprocess.run([sys.executable,str(root/'scripts/prepare-tap.py')],check=True)
save('win',[(0,261.63,.32),(.16,329.63,.30),(.32,392,.28),(.48,523.25,.24)],1.15)
print('Prepared mellow wood tones and',round(n/rate,2),'second music loop')

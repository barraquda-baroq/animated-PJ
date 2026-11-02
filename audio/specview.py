"""Render a log-frequency spectrogram (+ waveform strip) of a wav to PNG for visual QA."""
import sys, numpy as np
from PIL import Image, ImageDraw
from scipy import signal
import dsp

def spec_png(path_in, path_out, t0=0.0, t1=None, w=1600, h=500, fmin=30, fmax=16000, title=None):
    x = dsp.load(path_in); m = dsp.mono(x)
    s0 = int(t0 * dsp.SR); s1 = int((t1 if t1 else len(m) / dsp.SR) * dsp.SR); m = m[s0:s1]
    f, t, S = signal.stft(m, fs=dsp.SR, nperseg=4096, noverlap=4096 - 512)
    mag = 20 * np.log10(np.abs(S) + 1e-9)
    # map to log-frequency rows
    ys = np.geomspace(fmin, fmax, h)
    idx = np.clip(np.searchsorted(f, ys), 0, len(f) - 1)
    img = mag[idx][::-1]
    img = np.clip((img + 100) / 90, 0, 1)
    img = np.array(Image.fromarray((img * 255).astype(np.uint8)).resize((w, h)))
    rgb = np.stack([img ** 1.0, (img ** 1.6), (img ** 3.0) * 0 + img * 0.6], -1).astype(np.uint8)
    im = Image.new('RGB', (w, h + 120), (12, 12, 16)); im.paste(Image.fromarray(rgb), (0, 0))
    d = ImageDraw.Draw(im)
    # waveform strip
    env = np.abs(m); step = max(1, len(env) // w)
    pk = [env[i * step:(i + 1) * step].max() if (i + 1) * step <= len(env) else 0 for i in range(w)]
    for i, p in enumerate(pk):
        hh = int(min(1, p) * 55); d.line([(i, h + 60 - hh), (i, h + 60 + hh)], fill=(120, 200, 255))
    for fr in (100, 1000, 10000):
        yy = int(h - (np.log(fr / fmin) / np.log(fmax / fmin)) * h); d.line([(0, yy), (12, yy)], fill=(255, 255, 255)); d.text((14, yy - 6), f'{fr}Hz', fill=(255, 255, 255))
    dur = len(m) / dsp.SR
    for k in range(int(dur) + 1):
        xx = int(k / dur * w); d.line([(xx, h), (xx, h + 8)], fill=(255, 255, 255)); d.text((xx + 2, h + 8), f'{t0 + k:.0f}s', fill=(200, 200, 200))
    if title: d.text((20, h + 100), title, fill=(255, 220, 160))
    im.save(path_out)

if __name__ == '__main__':
    spec_png(sys.argv[1], sys.argv[2], *(float(a) for a in sys.argv[3:5]))

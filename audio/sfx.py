"""Procedural sound effects (48 kHz stereo float32). Every function is seeded/deterministic."""
import numpy as np
from scipy import signal
from dsp import (SR, butter, lowpass, highpass, bandpass, filt, reverb, fade, pan, stereo, db, envelope)


def _rng(seed):
    return np.random.default_rng(seed)


def _t(sec):
    return np.arange(int(sec * SR)) / SR


def _pink(n, rng):
    # Voss-McCartney-ish via filtering white noise (Paul Kellet's refined method)
    w = rng.standard_normal(n).astype(np.float32)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w).astype(np.float32) * 6


def _brown(n, rng):
    w = rng.standard_normal(n).astype(np.float32)
    b = signal.lfilter([1], [1, -0.995], w)
    return (b / (np.max(np.abs(b)) + 1e-9)).astype(np.float32)


def _st(rng, n, kind='pink'):
    f = {'pink': _pink, 'brown': _brown}[kind]
    return np.stack([f(n, rng), f(n, rng)], axis=1)


def _smooth_noise(n, rate_hz, rng):
    """slowly varying random control signal in [0,1]."""
    k = max(4, int(n / SR * rate_hz) + 4)
    pts = rng.uniform(0, 1, k)
    x = np.linspace(0, k - 3, n)
    return np.interp(x, np.arange(k), pts).astype(np.float32)


# ------------------------------------------------------------------ weather / nature
def rain(sec, intensity=1.0, seed=1, window=False):
    rng = _rng(seed); n = int(sec * SR)
    bed = _st(rng, n, 'pink')
    bed = highpass(lowpass(bed, 7000 if not window else 4500), 300)
    mod = 0.75 + 0.25 * _smooth_noise(n, 0.7, rng)
    out = bed * mod[:, None] * 0.12 * intensity
    # droplets
    nd = int(sec * (220 if not window else 60) * intensity)
    for _ in range(nd):
        i = rng.integers(0, max(1, n - 2400)); L = rng.integers(200, 1200)
        f = rng.uniform(1800, 6500) if not window else rng.uniform(900, 3500)
        tt = np.arange(L) / SR
        d = np.sin(2 * np.pi * f * tt * (1 - 0.3 * tt * 40)) * np.exp(-tt * rng.uniform(120, 400))
        p = rng.uniform(-0.9, 0.9); a = rng.uniform(0.01, 0.05 if not window else 0.09) * intensity
        out[i:i + L, 0] += d * a * (1 - p) / 2 * 1.4
        out[i:i + L, 1] += d * a * (1 + p) / 2 * 1.4
    return fade(out.astype(np.float32), 0.5, 0.5)


def thunder(sec=6.0, seed=1, crack=True, distance=0.5):
    """distance 0 (close, sharp crack) .. 1 (far rumble)."""
    rng = _rng(seed); n = int(sec * SR); t = _t(sec)
    rum = _st(rng, n, 'brown')
    rum = lowpass(rum, 160 + 300 * (1 - distance))
    env = np.zeros(n, np.float32)
    for k in range(int(rng.integers(3, 7))):
        c = rng.uniform(0.05, sec * 0.6); w = rng.uniform(0.3, 1.6)
        env += rng.uniform(0.4, 1.0) * np.exp(-((t - c) / w) ** 2) * (t > 0)
    env += np.exp(-t / (sec * 0.35)) * 0.6
    out = rum * env[:, None] * 0.9
    if crack and distance < 0.8:
        cl = int(0.35 * SR); cn = rng.standard_normal((cl, 2)).astype(np.float32)
        cn = highpass(cn, 900) * np.exp(-np.arange(cl) / SR * 18)[:, None]
        # crackle: random impulses
        for _ in range(60):
            i = rng.integers(0, cl - 200); cn[i:i + 60] += rng.standard_normal((60, 2)) * 0.8 * np.exp(-i / cl * 3)
        out[:cl] += cn * 0.55 * (1 - distance)
    out = reverb(out, rt60=3.5, wet=0.35, hp=40)[:n]
    return fade(out, 0.002, 1.0)


def wind(sec, strength=1.0, seed=1, whistle=True):
    rng = _rng(seed); n = int(sec * SR)
    nz = _st(rng, n, 'pink')
    out = np.zeros_like(nz)
    ctrl = _smooth_noise(n, 0.35, rng)
    # time-varying band via block processing
    blk = 4800
    for s in range(0, n, blk):
        fc = 250 + 900 * ctrl[s] * strength
        seg = nz[s:s + blk + 2048]
        y = bandpass(seg, fc, 0.6)[:blk]
        out[s:s + len(y)] = y
    amp = (0.35 + 0.65 * _smooth_noise(n, 0.25, rng)) * strength
    out *= amp[:, None] * 0.6
    if whistle:
        t = _t(sec); f = 700 + 500 * _smooth_noise(n, 0.2, rng)
        ph = 2 * np.pi * np.cumsum(f) / SR
        wh = np.sin(ph) * (_smooth_noise(n, 0.3, rng) ** 3) * 0.02 * strength
        out += pan(wh.astype(np.float32), 0.3)
    return fade(out.astype(np.float32), 1.0, 1.0)


def waves(sec, seed=1, calm=1.0):
    rng = _rng(seed); n = int(sec * SR); t = _t(sec)
    nz = _st(rng, n, 'pink')
    low = lowpass(nz, 500) ; hiss = highpass(lowpass(nz, 6000), 1500)
    env = np.zeros(n, np.float32); tc = rng.uniform(0, 3)
    while tc < sec + 4:
        per = rng.uniform(5.5, 9.0); w = rng.uniform(1.2, 2.2)
        env += np.exp(-((t - tc) / w) ** 2) * rng.uniform(0.6, 1.0)
        tc += per
    env = 0.25 + env
    out = (low * 0.5 + hiss * 0.22 * calm) * env[:, None] * 0.5
    return fade(out.astype(np.float32), 1.5, 1.5)


def cicadas(sec, seed=1, kind='abura', amount=1.0):
    rng = _rng(seed); n = int(sec * SR); t = _t(sec)
    out = np.zeros((n, 2), np.float32)
    voices = 6 if kind == 'abura' else 3
    for v in range(voices):
        nz = rng.standard_normal(n).astype(np.float32)
        if kind == 'abura':
            y = bandpass(nz, rng.uniform(3800, 5600), 3.5)
            am = 0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(70, 110) * t)
            sw = 0.5 + 0.5 * _smooth_noise(n, 0.15, rng)
            y = y * am * sw
        else:  # minmin: pulsing tone
            f = rng.uniform(3000, 4200)
            puls = (np.sin(2 * np.pi * rng.uniform(2.5, 4.0) * t) > 0.2).astype(np.float32)
            puls = lowpass(puls, 40)
            y = np.sin(2 * np.pi * f * t + 3 * np.sin(2 * np.pi * 90 * t)) * puls * 0.5
        out += pan(y, rng.uniform(-0.8, 0.8)) * rng.uniform(0.4, 1.0)
    out = reverb(out * 0.05 * amount, rt60=1.2, wet=0.2)[:n]
    return fade(out, 1.0, 1.0)


# ------------------------------------------------------------------ school / city
def bell_tone(f, dur=2.5, seed=0, bright=1.0):
    t = _t(dur)
    partials = [(1.0, 1.0, 1.0), (2.0, 0.35, 1.8), (3.0, 0.12, 2.5), (4.07, 0.18, 2.8), (5.4, 0.06, 4.0), (6.8, 0.04, 5.0)]
    y = np.zeros_like(t)
    for ratio, amp, dk in partials:
        y += amp * bright ** (ratio - 1) * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * dk * 0.9)
    y *= np.minimum(1, t / 0.004)
    return y.astype(np.float32)


def school_chime(seed=1, speaker=True, start_gain=1.0):
    """Japanese school 'kinkonkankon' (Westminster quarters)."""
    seq = [('E5', 0), ('C5', 0.75), ('D5', 1.5), ('G4', 2.25), ('G4', 3.75), ('D5', 4.5), ('E5', 5.25), ('C5', 6.0)]
    freqs = {'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'G4': 392.0}
    total = 8.6; out = np.zeros(int(total * SR), np.float32)
    for name, at in seq:
        b = bell_tone(freqs[name], 2.6, bright=0.8)
        i = int(at * SR); out[i:i + len(b)] += b[: len(out) - i] * 0.3
    if speaker:
        out = bandpass(out, 1400, 0.5) * 2.2 + lowpass(out, 3000) * 0.4
    st = reverb(stereo(out), rt60=2.4, wet=0.45, predelay=0.04)[: len(out)]
    return (st * start_gain).astype(np.float32)


def clap(seed=0):
    rng = _rng(seed); L = int(0.09 * SR)
    nz = rng.standard_normal(L).astype(np.float32)
    y = bandpass(nz, rng.uniform(1100, 2200), 1.2) * np.exp(-np.arange(L) / SR * rng.uniform(45, 70))
    y[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return y * 0.8


def applause(times, seed=1, room=1.6):
    """Few claps in an empty room. times = list of seconds."""
    rng = _rng(seed); total = max(times) + 2.0
    out = np.zeros((int(total * SR), 2), np.float32)
    for k, tt in enumerate(times):
        c = clap(seed * 100 + k); i = int(tt * SR)
        out[i:i + len(c)] += pan(c, rng.uniform(-0.1, 0.1))
    return reverb(out, rt60=room, wet=0.5)[: len(out)]


def crowd(sec, seed=1, mood='murmur', amount=1.0):
    """'murmur' or 'boo' (dissatisfied crowd) built from formant-filtered buzz voices."""
    rng = _rng(seed); n = int(sec * SR); t = _t(sec)
    out = np.zeros((n, 2), np.float32)
    nv = 40 if mood == 'boo' else 26
    for v in range(nv):
        f0 = rng.uniform(95, 190) if rng.random() < 0.7 else rng.uniform(180, 280)
        vib = 1 + 0.02 * np.sin(2 * np.pi * rng.uniform(4, 7) * t + rng.uniform(0, 6))
        if mood == 'boo':
            glide = 1 - 0.12 * np.clip((t % rng.uniform(1.5, 3.0)) / 1.5, 0, 1)
        else:
            glide = 1 + 0.15 * (_smooth_noise(n, 3.0, rng) - 0.5)
        ph = 2 * np.pi * np.cumsum(f0 * vib * glide) / SR
        saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
        nz = rng.standard_normal(n).astype(np.float32) * 0.15
        src = (saw + nz).astype(np.float32)
        if mood == 'boo':
            F = [(320, 4.0, 1.0), (800, 5.0, 0.6), (2300, 6.0, 0.15)]  # 'u/o'
            gate = (_smooth_noise(n, 0.9, rng) > 0.35).astype(np.float32)
        else:
            F = [(rng.uniform(400, 800), 3.0, 1.0), (rng.uniform(1100, 1900), 4.0, 0.5)]
            gate = (_smooth_noise(n, 4.0, rng) > 0.5).astype(np.float32)
        gate = lowpass(gate, 6)
        y = sum(bandpass(src, f, q) * g for f, q, g in F) * gate
        out += pan(y.astype(np.float32), rng.uniform(-0.9, 0.9)) * rng.uniform(0.3, 1.0)
    out = lowpass(out, 4000) * 0.06 * amount
    out = reverb(out, rt60=1.8, wet=0.4)[:n]
    return fade(out, 0.4, 0.6)


# ------------------------------------------------------------------ instruments / devices
def string_snap(seed=1, through_amp=True):
    rng = _rng(seed); dur = 1.6; t = _t(dur); n = len(t)
    f = 330 * (1 + 2.2 * np.exp(-t * 30))  # quick pitch spike then fall
    ph = 2 * np.pi * np.cumsum(f) / SR
    tw = (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3.1 * ph)) * np.exp(-t * 6)
    click = rng.standard_normal(n) * np.exp(-t * 300) * 1.2
    rattle = bandpass(rng.standard_normal(n), 2500, 2) * np.exp(-t * 14) * (np.sin(2 * np.pi * 37 * t) > 0) * 0.5
    y = (tw * 0.6 + click + rattle).astype(np.float32)
    if through_amp:
        y = np.tanh(y * 4) * 0.5
        y = lowpass(highpass(y, 120), 5000)
    return reverb(pan(y, 0.1), rt60=1.2, wet=0.25)[: n + int(0.5 * SR)]


def ecg_beep(f=1000, dur=0.11):
    t = _t(dur)
    y = np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.003) * np.minimum(1, (dur - t) / 0.01) * 0.25
    return stereo(y.astype(np.float32))


def ecg_track(sec, bpm=72, seed=1, f=1000.0, start=0.2, dur=0.11):
    out = np.zeros((int(sec * SR), 2), np.float32); b = ecg_beep(f, dur); per = 60 / bpm; tt = start
    while tt < sec - 0.2:
        i = int(tt * SR); out[i:i + len(b)] += b; tt += per
    return reverb(out, rt60=0.8, wet=0.25)[: len(out)]


def heartbeat(bpm=64, beats=4, seed=1, gain=1.0):
    per = 60 / bpm; total = beats * per + 1.0; out = np.zeros(int(total * SR), np.float32)
    for k in range(beats):
        for off, amp in ((0.0, 1.0), (0.28, 0.7)):
            L = int(0.18 * SR); tt = np.arange(L) / SR
            th = np.sin(2 * np.pi * (55 - 20 * tt) * tt) * np.exp(-tt * 28) * amp
            i = int((k * per + off) * SR); out[i:i + L] += th
    return stereo(lowpass(out, 180) * gain)


def ship_horn(dur=3.5, seed=1, f=98.0):
    t = _t(dur)
    y = np.zeros_like(t)
    for h, a in ((1, 1.0), (1.5, 0.6), (2, 0.5), (3, 0.25), (4, 0.12)):
        y += a * np.sign(np.sin(2 * np.pi * f * h * t)) * 0.3
    env = np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.8)
    y = lowpass(y * env, 900).astype(np.float32)
    return reverb(stereo(y) * 0.25, rt60=4.0, wet=0.7, predelay=0.08)


def hum(sec, base=50, amount=1.0):
    t = _t(sec); y = sum(a * np.sin(2 * np.pi * base * k * t) for k, a in ((1, 1), (2, 0.5), (3, 0.35), (5, 0.12), (7, 0.06)))
    return stereo((y * 0.03 * amount).astype(np.float32))


def tinnitus(sec=3.0, f=5200, seed=1):
    t = _t(sec); y = np.sin(2 * np.pi * f * t) * 0.035 * np.minimum(1, t / 0.08) * np.exp(-t / (sec * 0.6))
    return stereo(y.astype(np.float32))


def heels(times, seed=1):
    rng = _rng(seed); total = max(times) + 0.6; out = np.zeros((int(total * SR), 2), np.float32)
    for k, tt in enumerate(times):
        L = int(0.06 * SR); x = np.arange(L) / SR
        c = (np.sin(2 * np.pi * rng.uniform(1800, 2600) * x) * np.exp(-x * 120) + rng.standard_normal(L) * np.exp(-x * 300) * 0.4) * 0.35
        i = int(tt * SR); out[i:i + L] += pan(c.astype(np.float32), rng.uniform(-0.2, 0.2))
    return reverb(out, rt60=0.9, wet=0.3)[: len(out)]


def brake_screech(dur=1.4, seed=1):
    rng = _rng(seed); t = _t(dur); n = len(t)
    nz = rng.standard_normal(n).astype(np.float32)
    y = sum(bandpass(nz, f * (1 + 0.04 * np.sin(2 * np.pi * 7 * t[0])), 25) for f in (2100, 2900, 3700))
    tone = np.sin(2 * np.pi * np.cumsum(2400 + 200 * np.sin(2 * np.pi * 6 * t)) / SR) * 0.3
    env = np.minimum(1, t / 0.25) * (0.7 + 0.3 * np.sin(2 * np.pi * 11 * t))
    out = (y * 0.5 + tone) * env
    return reverb(pan(out.astype(np.float32) * 0.25, -0.2), rt60=1.0, wet=0.2)


# ------------------------------------------------------------------ trailer sound design
def sub_boom(dur=3.0, f0=62, f1=28, gain=1.0):
    t = _t(dur); f = f1 + (f0 - f1) * np.exp(-t * 3)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) * np.minimum(1, t / 0.005)
    return stereo((y * 0.8 * gain).astype(np.float32))


def impact(seed=1, dur=4.0, gain=1.0):
    rng = _rng(seed); n = int(dur * SR); t = _t(dur)
    nz = rng.standard_normal((n, 2)).astype(np.float32)
    body = lowpass(nz, 220) * np.exp(-t * 4)[:, None] * 1.4
    snap = highpass(nz, 2500) * np.exp(-t * 40)[:, None] * 0.5
    out = body + snap + sub_boom(dur)[:n]
    return reverb(out * 0.6 * gain, rt60=3.2, wet=0.45, hp=60)[: n + SR]


def riser(dur=3.0, seed=1, gain=1.0):
    rng = _rng(seed); n = int(dur * SR); t = _t(dur)
    nz = rng.standard_normal((n, 2)).astype(np.float32)
    out = np.zeros_like(nz); blk = 2400
    for s in range(0, n, blk):
        fc = 400 + 7000 * (s / n) ** 2
        out[s:s + blk] = bandpass(nz[s:s + blk + 1024], fc, 1.2)[:blk]
    env = (t / dur) ** 2.2
    tone = np.sin(2 * np.pi * np.cumsum(110 + 330 * (t / dur) ** 2) / SR) * 0.15
    out = (out * 0.5 + stereo(tone.astype(np.float32))) * env[:, None]
    return reverb(out * gain * 0.5, rt60=2.5, wet=0.4)[:n]


def reverse_swell(dur=2.0, seed=1, gain=1.0):
    """reverse cymbal-like swell ending exactly at dur."""
    rng = _rng(seed); n = int(dur * SR); t = _t(dur)
    nz = highpass(rng.standard_normal((n, 2)).astype(np.float32), 3000)
    y = nz * np.exp(-t * 2.5)[:, None]
    y = reverb(y, rt60=2.0, wet=0.6)[:n]
    return (y[::-1] * gain * 0.4).astype(np.float32)


def braam(dur=4.0, f=55.0, seed=1, gain=1.0):
    t = _t(dur); y = np.zeros_like(t)
    for d in (-0.6, 0.0, 0.7):
        ph = 2 * np.pi * (f + d) * t; saw = 2 * ((ph / (2 * np.pi)) % 1) - 1; y += saw
        ph2 = 2 * np.pi * (f * 2 + d) * t; y += 0.5 * (2 * ((ph2 / (2 * np.pi)) % 1) - 1)
    env = np.minimum(1, t / 0.05) * np.exp(-t * 0.6)
    y = np.tanh(y * 0.8) * env
    y = lowpass(y.astype(np.float32), 700)
    return reverb(stereo(y) * 0.35 * gain, rt60=3.0, wet=0.5, hp=40)


def guitar_harmonic(f=659.26, dur=4.0, seed=1):
    """Bell-like natural harmonic (12th fret) of a steel string."""
    rng = _rng(seed); t = _t(dur)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 0.9) + 0.18 * np.sin(2 * np.pi * f * 2.003 * t) * np.exp(-t * 2.2) + 0.06 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 4)
    y *= np.minimum(1, t / 0.002)
    click = bandpass(rng.standard_normal(len(t)).astype(np.float32), 3500, 1.5) * np.exp(-t * 400) * 0.25
    y = (y * 0.32 + click).astype(np.float32)
    return reverb(pan(y, -0.15), rt60=2.6, wet=0.4)[: len(t) + SR]


# ------------------------------------------------------------------ small foley (added for the storyboard)
def drip(seed=1, f0=1400, gain=1.0):
    rng = _rng(seed); dur = 0.35; t = _t(dur)
    f = f0 * (1 + 1.8 * np.minimum(1, t / 0.025))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28) * np.minimum(1, t / 0.001)
    return reverb(pan(y.astype(np.float32) * 0.25 * gain, rng.uniform(-0.2, 0.2)), rt60=0.9, wet=0.3)[: len(t) + SR // 2]


def sparkle(seed=1, dur=1.0, gain=1.0):
    rng = _rng(seed); t = _t(dur); y = np.zeros_like(t)
    for k in range(6):
        f = rng.uniform(3000, 7000); t0 = rng.uniform(0, dur * 0.4); env = np.exp(-np.maximum(t - t0, 0) * 6) * (t >= t0)
        y += np.sin(2 * np.pi * f * t) * env * rng.uniform(0.3, 1.0)
    return reverb(pan(y.astype(np.float32) * 0.05 * gain, 0.1), rt60=1.6, wet=0.5)[: len(t) + SR]


def breath(kind='in', dur=0.5, seed=1, gain=1.0):
    rng = _rng(seed); t = _t(dur); n = len(t)
    nz = rng.standard_normal(n).astype(np.float32)
    y = bandpass(nz, 1600 if kind == 'in' else 900, 0.8) * 0.6 + highpass(nz, 3000) * 0.3
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** (1.5 if kind == 'in' else 0.8)
    return stereo((y * env * 0.12 * gain).astype(np.float32))


def cloth(dur=0.8, seed=1, gain=1.0):
    rng = _rng(seed); t = _t(dur); n = len(t)
    nz = rng.standard_normal(n).astype(np.float32)
    y = bandpass(nz, 2200, 0.6) * (0.4 + 0.6 * _smooth_noise(n, 9, rng)) * np.sin(np.pi * np.clip(t / dur, 0, 1))
    return reverb(stereo((y * 0.08 * gain).astype(np.float32)), rt60=0.6, wet=0.2)[:n]


def shutter(seed=1):
    out = np.zeros(int(0.25 * SR), np.float32)
    for at, f in ((0.0, 2600), (0.085, 1900)):
        L = int(0.03 * SR); x = np.arange(L) / SR
        c = (np.sin(2 * np.pi * f * x) * np.exp(-x * 160) + _rng(seed).standard_normal(L) * np.exp(-x * 400) * 0.5) * 0.3
        i = int(at * SR); out[i:i + L] += c
    return stereo(out)


def notify(seed=1):
    """two-note phone chime A5 -> D6"""
    out = np.zeros(int(0.9 * SR), np.float32)
    for at, f in ((0.0, 880.0), (0.14, 1174.66)):
        b = bell_tone(f, 0.7, bright=0.5); i = int(at * SR); out[i:i + len(b)] += b[: len(out) - i] * 0.18
    return stereo(out)


def train(dur=3.0, seed=1, gain=1.0):
    rng = _rng(seed); n = int(dur * SR); t = _t(dur)
    rumble = lowpass(rng.standard_normal((n, 2)).astype(np.float32), 220) * 0.25
    out = rumble * (0.7 + 0.3 * np.sin(2 * np.pi * 0.7 * t))[:, None]
    tc = 0.15
    while tc < dur:
        for off in (0.0, 0.11):
            L = int(0.07 * SR); x = np.arange(L) / SR; i = int((tc + off) * SR)
            if i + L < n:
                c = lowpass(rng.standard_normal(L).astype(np.float32), 900) * np.exp(-x * 60) * 0.8
                out[i:i + L] += stereo(c)
        tc += 0.78
    return reverb(out * 0.5 * gain, rt60=0.8, wet=0.2)[:n]


def tick(times, gain=1.0):
    total = max(times) + 0.3; out = np.zeros(int(total * SR), np.float32)
    for tt in times:
        L = int(0.012 * SR); x = np.arange(L) / SR
        c = np.sin(2 * np.pi * 3200 * x) * np.exp(-x * 600) * 0.25; i = int(tt * SR); out[i:i + L] += c
    return reverb(stereo(out * gain), rt60=0.5, wet=0.15)[: len(out)]


def clip(seed=1):
    rng = _rng(seed); L = int(0.05 * SR); x = np.arange(L) / SR
    c = (np.sin(2 * np.pi * 4200 * x) * np.exp(-x * 220) + rng.standard_normal(L) * np.exp(-x * 500) * 0.6) * 0.35
    return stereo(c.astype(np.float32))


def pen(dur=1.4, seed=1, gain=1.0):
    rng = _rng(seed); n = int(dur * SR); t = _t(dur)
    nz = rng.standard_normal(n).astype(np.float32)
    strokes = (np.sin(2 * np.pi * 3.2 * t) > -0.2).astype(np.float32); strokes = lowpass(strokes, 30)
    y = bandpass(nz, 4200, 1.5) * strokes * (0.5 + 0.5 * _smooth_noise(n, 12, rng))
    return stereo((y * 0.05 * gain).astype(np.float32))


def door(seed=1):
    rng = _rng(seed); dur = 0.6; t = _t(dur); n = len(t)
    thump = np.sin(2 * np.pi * 85 * t) * np.exp(-t * 18) * 0.5
    latch = np.zeros(n); i = int(0.06 * SR); L = int(0.02 * SR); latch[i:i + L] = np.sin(2 * np.pi * 2400 * np.arange(L) / SR) * np.exp(-np.arange(L) / SR * 300) * 0.2
    return reverb(stereo((thump + latch).astype(np.float32) * 0.6), rt60=0.7, wet=0.25)[:n]


def tap(seed=1):
    L = int(0.02 * SR); x = np.arange(L) / SR
    return stereo((np.sin(2 * np.pi * 1800 * x) * np.exp(-x * 500) * 0.12).astype(np.float32))


def cough(seed=1):
    """a small, deliberate throat-clear in a hall ('ゴホン')"""
    rng = _rng(seed); out = np.zeros(int(0.45 * SR), np.float32)
    for at, d, f1 in ((0.0, 0.11, 520), (0.15, 0.16, 430)):
        L = int(d * SR); x = np.arange(L) / SR
        src = rng.standard_normal(L).astype(np.float32) + 0.6 * np.sign(np.sin(2 * np.pi * 120 * x))
        y = bandpass(src, f1, 1.2) * 1.0 + bandpass(src, f1 * 2.6, 2.0) * 0.4
        env = np.minimum(1, x / 0.006) * np.exp(-x * 14)
        i = int(at * SR); out[i:i + L] += y * env * 0.35
    return reverb(pan(out, -0.4), rt60=2.2, wet=0.55, predelay=0.03)[: len(out) + SR]


def birds(dur=2.2, seed=1, gain=1.0):
    rng = _rng(seed); n = int(dur * SR); out = np.zeros((n, 2), np.float32)
    for k in range(7):
        t0 = rng.uniform(0, dur - 0.3); L = int(rng.uniform(0.06, 0.16) * SR); x = np.arange(L) / SR
        f = rng.uniform(3000, 5200) * (1 + 0.25 * np.sin(2 * np.pi * rng.uniform(15, 35) * x))
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / x[-1]) * 0.05
        i = int(t0 * SR); out[i:i + L] += pan(y.astype(np.float32), rng.uniform(-0.7, 0.7))
    return reverb(out * gain, rt60=1.2, wet=0.35)[:n]


def car_horn(dur=0.5, gain=1.0):
    t = _t(dur); y = (np.sign(np.sin(2 * np.pi * 415 * t)) + np.sign(np.sin(2 * np.pi * 523 * t))) * 0.2
    y = lowpass(y.astype(np.float32), 2500) * np.minimum(1, t / 0.01)
    return pan(y * gain, 0.4)


def river(dur=4.0, seed=1, gain=1.0):
    rng = _rng(seed); n = int(dur * SR)
    y = lowpass(rng.standard_normal((n, 2)).astype(np.float32), 300) * 0.5 + bandpass(rng.standard_normal((n, 2)).astype(np.float32), 900, 0.7) * 0.1
    return fade(y * gain, 0.3, 0.3)


def room_tone(dur=4.0, seed=1, gain=1.0):
    rng = _rng(seed); n = int(dur * SR)
    y = lowpass(_st(rng, n, 'pink'), 1200) * 0.012 + hum(dur, 50, 0.08)[:n]
    return fade(y * gain, 0.2, 0.2)


def kids(dur=1.2, seed=1, gain=1.0):
    x = crowd(dur, seed, 'murmur', 0.6)
    return highpass(x, 600) * gain


def shop_music(dur=1.2, seed=1, gain=1.0):
    t = _t(dur); y = np.zeros_like(t)
    notes = [523.25, 659.25, 783.99, 659.25, 698.46, 880.0]
    for k, f in enumerate(notes):
        t0 = k * dur / len(notes); env = np.exp(-np.maximum(t - t0, 0) * 5) * (t >= t0)
        y += np.sin(2 * np.pi * f * t) * env * 0.1
    y = bandpass(y.astype(np.float32), 1200, 0.6)
    return reverb(pan(y * gain, 0.5), rt60=1.2, wet=0.5)[: len(t)]

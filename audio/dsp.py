"""Audio DSP toolkit for the PV mix (48 kHz float32 stereo numpy arrays, shape (n, 2))."""
import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000


# ----------------------------------------------------------------- I/O
def load(path, sr=SR):
    x, fs = sf.read(path, dtype='float32', always_2d=True)
    if fs != sr:
        g = np.gcd(int(fs), int(sr))
        x = signal.resample_poly(x, sr // g, fs // g, axis=0).astype(np.float32)
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    return x[:, :2]


def save(path, x, sr=SR, subtype='PCM_24'):
    sf.write(path, np.clip(x, -1, 1).astype(np.float32), sr, subtype=subtype)


def silence(sec, sr=SR):
    return np.zeros((int(round(sec * sr)), 2), np.float32)


def mono(x):
    return x.mean(axis=1) if x.ndim == 2 else x


def stereo(m):
    return np.stack([m, m], axis=1).astype(np.float32) if m.ndim == 1 else m


def db(g):
    return 10 ** (g / 20)


# ----------------------------------------------------------------- filters (RBJ biquads)
def _biquad(kind, f0, q=0.707, gain_db=0.0, sr=SR):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / sr
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2 * q)
    if kind == 'lp':
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'hp':
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'bp':
        b = [alpha, 0, -alpha]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'peak':
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]; a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind == 'lowshelf':
        sa = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sa)]
        a = [(A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sa]
    elif kind == 'highshelf':
        sa = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sa)]
        a = [(A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sa]
    else:
        raise ValueError(kind)
    return np.array(b) / a[0], np.array(a) / a[0]


def filt(x, kind, f0, q=0.707, gain_db=0.0, sr=SR):
    b, a = _biquad(kind, f0, q, gain_db, sr)
    return signal.lfilter(b, a, x, axis=0).astype(np.float32)


def lowpass(x, f, q=0.707):
    return filt(x, 'lp', f, q)


def highpass(x, f, q=0.707):
    return filt(x, 'hp', f, q)


def bandpass(x, f, q=1.0):
    return filt(x, 'bp', f, q)


def eq(x, bands):
    """bands: list of (kind, f0, q, gain_db)."""
    for kind, f0, q, g in bands:
        x = filt(x, kind, f0, q, g)
    return x


def butter(x, kind, f, order=4, sr=SR):
    sos = signal.butter(order, f, btype=kind, fs=sr, output='sos')
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


# ----------------------------------------------------------------- dynamics
def envelope(m, attack=0.005, release=0.08, sr=SR):
    """Peak envelope follower of a mono signal."""
    a_a = np.exp(-1 / (attack * sr)); a_r = np.exp(-1 / (release * sr))
    x = np.abs(m)
    # vectorised approximation: smooth with release, then max with fast attack smoothing
    env = signal.lfilter([1 - a_r], [1, -a_r], x)
    env = np.maximum(env, signal.lfilter([1 - a_a], [1, -a_a], x))
    return env.astype(np.float32)


def compress(x, thresh_db=-18, ratio=3.0, attack=0.01, release=0.15, makeup_db=0.0, knee_db=6):
    m = mono(x) if x.ndim == 2 else x
    env = envelope(m, attack, release) + 1e-9
    lvl = 20 * np.log10(env)
    over = lvl - thresh_db
    gr = np.where(over <= -knee_db / 2, 0,
                  np.where(over >= knee_db / 2, over * (1 - 1 / ratio),
                           (1 - 1 / ratio) * (over + knee_db / 2) ** 2 / (2 * knee_db)))
    g = db(-gr + makeup_db).astype(np.float32)
    return x * (g[:, None] if x.ndim == 2 else g)


def limiter(x, ceiling_db=-1.0, lookahead=0.005, release=0.08, sr=SR):
    ceil = db(ceiling_db)
    peak = np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)
    la = int(lookahead * sr)
    # running max over lookahead window
    from scipy.ndimage import maximum_filter1d
    pk = maximum_filter1d(peak, size=2 * la + 1, mode='nearest')
    need = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    a_r = np.exp(-1 / (release * sr))
    # smooth gain: instant down, slow up
    g = np.empty_like(need)
    cur = 1.0
    for i in range(len(need)):  # simple loop is fine at 48k x 180s? use chunked numba-free approach
        v = need[i]
        cur = v if v < cur else cur * a_r + v * (1 - a_r)
        g[i] = cur
    y = x * (g[:, None] if x.ndim == 2 else g)
    return np.clip(y, -ceil, ceil).astype(np.float32)


def fast_limiter(x, ceiling_db=-1.0, lookahead=0.004, release=0.06, sr=SR):
    """Vectorised limiter: gain = smoothed min over window (no python loop)."""
    from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
    ceil = db(ceiling_db)
    peak = np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)
    la = max(1, int(lookahead * sr))
    pk = maximum_filter1d(peak, size=2 * la + 1, mode='nearest')
    need = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    rel = max(1, int(release * sr))
    g = minimum_filter1d(need, size=rel, mode='nearest')
    g = uniform_filter1d(g, size=la * 2 + 1, mode='nearest')
    g = np.minimum(g, need)  # never exceed
    y = x * (g[:, None] if x.ndim == 2 else g)
    return np.clip(y, -ceil, ceil).astype(np.float32)


# ----------------------------------------------------------------- reverb
def reverb_ir(rt60=2.2, predelay=0.02, sr=SR, seed=1, bright=6000, dark=1500, early=True, width=1.0):
    """Synthetic stereo hall IR: decorrelated noise, exponential decay, darker tail."""
    rng = np.random.default_rng(seed)
    n = int((rt60 * 1.4 + predelay) * sr)
    t = np.arange(n) / sr
    ir = np.zeros((n, 2), np.float32)
    pd = int(predelay * sr)
    decay = np.exp(-6.91 * np.maximum(t - predelay, 0) / rt60)
    for ch in range(2):
        nz = rng.standard_normal(n).astype(np.float32)
        # split into bright and dark component with different decay (air absorption)
        b = butter(nz, 'low', bright, 2) * decay
        d = butter(nz, 'low', dark, 2) * np.exp(-6.91 * np.maximum(t - predelay, 0) / (rt60 * 1.35))
        mix = 0.55 * b + 0.45 * d
        mix[:pd] = 0
        ir[:, ch] = mix
    if early:
        for k in range(14):
            dt = predelay + rng.uniform(0.004, 0.07)
            i = int(dt * sr)
            if i < n:
                ir[i, 0] += rng.uniform(-0.6, 0.6) * np.exp(-dt * 20)
                ir[i + int(rng.uniform(0, 0.003) * sr), 1] += rng.uniform(-0.6, 0.6) * np.exp(-dt * 20)
    # width: blend toward mid
    mid = ir.mean(axis=1, keepdims=True)
    ir = mid + (ir - mid) * width
    ir /= np.sqrt(np.sum(ir ** 2) / 2) + 1e-9
    return ir.astype(np.float32)


_IR_CACHE = {}


def reverb(x, rt60=2.2, wet=0.25, dry=1.0, predelay=0.02, seed=1, bright=6000, dark=1500, width=1.0, hp=180):
    key = (rt60, predelay, seed, bright, dark, width)
    if key not in _IR_CACHE:
        _IR_CACHE[key] = reverb_ir(rt60, predelay, seed=seed, bright=bright, dark=dark, width=width)
    ir = _IR_CACHE[key]
    x = stereo(x) if x.ndim == 1 else x
    src = highpass(x, hp) if hp else x
    wl = signal.fftconvolve(src[:, 0], ir[:, 0])[: len(x) + len(ir)]
    wr = signal.fftconvolve(src[:, 1], ir[:, 1])[: len(x) + len(ir)]
    out = np.zeros((len(wl), 2), np.float32)
    out[: len(x)] += x * dry
    out[:, 0] += wl * wet * 0.35
    out[:, 1] += wr * wet * 0.35
    return out


# ----------------------------------------------------------------- utilities
def fade(x, fin=0.0, fout=0.0, sr=SR, curve='sine'):
    x = x.copy(); n = len(x)
    if fin > 0:
        k = min(n, int(fin * sr)); r = np.linspace(0, 1, k)
        w = np.sin(r * np.pi / 2) if curve == 'sine' else r
        x[:k] *= w[:, None] if x.ndim == 2 else w
    if fout > 0:
        k = min(n, int(fout * sr)); r = np.linspace(1, 0, k)
        w = np.sin(r * np.pi / 2) if curve == 'sine' else r
        x[n - k:] *= w[:, None] if x.ndim == 2 else w
    return x


def pan(m, p=0.0):
    """Equal-power pan of a mono signal; p in [-1, 1]."""
    m = mono(m) if m.ndim == 2 else m
    a = (p + 1) * np.pi / 4
    return np.stack([m * np.cos(a), m * np.sin(a)], axis=1).astype(np.float32)


def place(bus, clip, t, gain_db=0.0, sr=SR):
    """Add clip into bus at time t (seconds); bus grows if needed. Returns bus."""
    i = int(round(t * sr))
    if i < 0:
        clip = clip[-i:]; i = 0
    end = i + len(clip)
    if end > len(bus):
        bus = np.concatenate([bus, np.zeros((end - len(bus), 2), np.float32)])
    bus[i:end] += clip * db(gain_db)
    return bus


def fit(x, sec, sr=SR):
    n = int(round(sec * sr))
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros((n - len(x), 2), np.float32)])


def gain_curve(n, points, sr=SR):
    """points: list of (time_sec, gain_db) -> per-sample linear gain (piecewise linear in dB)."""
    t = np.arange(n) / sr
    ts = [p[0] for p in points]; gs = [p[1] for p in points]
    return db(np.interp(t, ts, gs)).astype(np.float32)


def duck(music, key, depth_db=-8.0, attack=0.06, release=0.45, thresh=0.01):
    """Sidechain-duck music under the key signal (e.g. dialogue)."""
    k = mono(key)
    if len(k) < len(music):
        k = np.concatenate([k, np.zeros(len(music) - len(k), np.float32)])
    k = k[: len(music)]
    env = envelope(k, attack=attack, release=release)
    amt = np.clip(env / thresh, 0, 1)
    # smooth the duck amount further for musical motion
    a = np.exp(-1 / (0.12 * SR))
    amt = signal.lfilter([1 - a], [1, -a], amt)
    amt = np.maximum(amt, signal.lfilter([1 - a], [1, -a], amt[::-1])[::-1])  # pre-duck slightly before speech
    g = db(depth_db * np.clip(amt, 0, 1)).astype(np.float32)
    return music * g[:, None]


def loudness(x, sr=SR):
    import pyloudnorm as pyln
    return pyln.Meter(sr).integrated_loudness(x)


def normalize_lufs(x, target=-14.0, sr=SR):
    lv = loudness(x, sr)
    return (x * db(target - lv)).astype(np.float32), lv


def peak_db(x):
    return 20 * np.log10(np.max(np.abs(x)) + 1e-12)


# ----------------------------------------------------------------- character effects
def phone_speaker(x, seed=3):
    """Tiny phone loudspeaker: band-limited, slightly saturated, mono, faint hiss."""
    m = mono(x)
    m = butter(m, 'high', 480, 4); m = butter(m, 'low', 4200, 4)
    m = filt(m, 'peak', 1600, 0.8, 5.0)
    m = np.tanh(m * 2.2) / 2.2
    rng = np.random.default_rng(seed)
    m = m + butter(rng.standard_normal(len(m)).astype(np.float32) * 0.002, 'high', 3000, 2)
    return stereo(m.astype(np.float32))


def muffle(x, cutoff=320):
    """'Underwater' shock filter (hearing goes dull)."""
    return butter(x, 'low', cutoff, 4)


def tape_wobble(x, depth=0.0025, rate=0.6, sr=SR):
    """Gentle pitch wobble (memory/recording feel) via variable delay."""
    n = len(x); t = np.arange(n) / sr
    d = (depth * sr) * (1 + np.sin(2 * np.pi * rate * t)) / 2 + 4
    idx = np.clip(np.arange(n) - d, 0, n - 1)
    i0 = np.floor(idx).astype(int); fr = (idx - i0)[:, None]
    i1 = np.minimum(i0 + 1, n - 1)
    return (x[i0] * (1 - fr) + x[i1] * fr).astype(np.float32)

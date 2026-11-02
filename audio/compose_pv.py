"""The PV score, composed to picture (storyboard music cues M1-M21).

Main theme <Session> in D major, 80 bpm (1 bar = 3.0 s). NE motif = A4 -> F#5 (her 'ねえ').
Piano = her (panned left), guitar = him (panned right).
Each cue is its own Score; notes are placed in absolute seconds via at(t) helpers.
Run:  python3 audio/compose_pv.py   ->  audio/out/score.wav  (+ audio/out/cues/*.wav)
"""
import os
import numpy as np
import dsp, music, themes, sfx
from music import p

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'out'); CUES = os.path.join(OUT, 'cues'); TMP = '/tmp/claude-0/score'
os.makedirs(CUES, exist_ok=True)
DUR = 180.0
PAN_PIANO, PAN_GUITAR = 36, 92


class Cue:
    """A score segment starting at absolute time t0 with constant tempo bpm; place notes by absolute seconds."""
    def __init__(self, name, t0, bpm=80.0, seed=1):
        self.name, self.t0, self.bpm = name, t0, bpm
        self.S = music.Score(bpm=bpm, seed=seed)

    def b(self, t):  # absolute seconds -> beats in this cue
        return (t - self.t0) * self.bpm / 60.0

    def track(self, *a, **k):
        return self.S.track(*a, **k)

    def n(self, tn, t, dur_s, pitch, vel=70, human=0.008):
        self.S.note(tn, self.b(t), dur_s * self.bpm / 60.0, pitch, vel, human)

    def chord(self, tn, t, dur_s, pitches, vel=60, roll=0.0):
        for k, q in enumerate(pitches):
            self.n(tn, t + k * roll, dur_s - k * roll, q, vel)

    def seq(self, tn, t, items, vel=70, legato=1.0):
        """items: (pitch|None, dur_beats[, vel]) at this cue's tempo, starting at absolute t."""
        b = self.b(t)
        for it in items:
            if it[0] is not None:
                self.S.note(tn, b, it[1] * legato, it[0], it[2] if len(it) > 2 else vel, 0.006)
            b += it[1]
        return self.t0 + b * 60.0 / self.bpm

    def pedal(self, tn, t0, t1):
        self.S.pedal(tn, self.b(t0), self.b(t1))

    def cc(self, tn, t, num, val):
        self.S.cc(tn, self.b(t), num, val)

    def ramp(self, tn, t0, t1, num, v0, v1, steps=16):
        self.S.cc_ramp(tn, self.b(t0), self.b(t1), num, v0, v1, steps)

    def render(self, gains, rt60=2.4, wet=0.28, length=None, tag=None):
        out = None
        for name, g in gains.items():
            if name not in self.S.tracks:
                continue
            x = self.S.render(name, os.path.join(TMP, tag or self.name)) * g
            out = x if out is None else _add(out, x)
        if wet > 0:
            out = dsp.reverb(out, rt60=rt60, wet=wet, predelay=0.022)
        if length:
            out = dsp.fit(out, length)
        return out


def _add(a, b):
    n = max(len(a), len(b)); o = np.zeros((n, 2), np.float32); o[:len(a)] += a; o[:len(b)] += b; return o


def seg(x, s0, s1):
    return x[int(s0 * dsp.SR): int(s1 * dsp.SR)]


BUS = dsp.silence(DUR + 12)


def put(x, t, gain_db=0.0, name=None, lufs=None):
    global BUS
    if lufs is not None and dsp.loudness(x) > -70:
        x, _ = dsp.normalize_lufs(x, lufs)
    if name:
        dsp.save(os.path.join(CUES, name + '.wav'), x)
    BUS = dsp.place(BUS, x, t, gain_db)


def lvl(x):
    try:
        return round(dsp.loudness(x), 1)
    except Exception:
        return -99


# =================================================================== M1  2.6 - 10.0  <雪あらし> Bb minor storm
def m1():
    c = Cue('M1', 2.6, bpm=60, seed=3)
    c.track('pf', 0, vol=120, pan=PAN_PIANO)
    T0, END = 2.6, 9.6
    # LH: octave tremolo Bb1/Bb2 (rumble growing out of the thunder), then harmonic motion
    bass_plan = [(2.6, 'Bb1'), (5.0, 'Gb1'), (6.4, 'F1'), (8.0, 'Bb1')]
    for i in range(int((END - T0) / 0.0625)):
        t = T0 + i * 0.0625
        root = [b for (tt, b) in bass_plan if tt <= t][-1]
        cres = min(1.0, (t - T0) / 0.6)
        v = int(40 + 50 * cres + 12 * np.sin(i * 0.7))
        c.n('pf', t, 0.07, p(root) + (12 if i % 2 else 0), v, human=0.003)
    # RH: chord tremolo from the white flash (3.0) with chromatic descents
    rh_plan = [(3.0, ['Bb3', 'Db4', 'F4']), (5.0, ['Bb3', 'Db4', 'Gb4']), (6.4, ['A3', 'C4', 'F4']), (8.0, ['Bb3', 'Db4', 'F4'])]
    for i in range(int((END - 3.0) / 0.0625)):
        t = 3.0 + i * 0.0625
        tri = [q for (tt, q) in rh_plan if tt <= t][-1]
        pair = (tri[0], tri[2]) if i % 2 == 0 else (tri[1], p(tri[2]) + 12)
        for q in pair:
            c.n('pf', t, 0.065, q, int(78 + 18 * np.sin(i * 0.37)), human=0.003)
    for start in (3.8, 5.6, 7.0):           # descending chromatic octaves (the hail)
        top = p('F6')
        for k in range(10):
            for q in (top - k, top - k - 12):
                c.n('pf', start + k * 0.08, 0.08, q, 96)
    for t in (7.6, 8.4):                     # her mistakes: hard semitone clusters
        c.chord('pf', t, 0.22, ['A4', 'Bb4', 'B4', 'E5', 'F5', 'F#5'], 116)
    # 9.6 the clean final chord (no mistake) then pedal off at 10.0 -> silence
    c.chord('pf', 9.6, 0.4, ['Bb1', 'F2', 'Bb2', 'Db3', 'F3', 'Bb3', 'Db4', 'F4', 'Bb4'], 120)
    for t0, t1 in ((2.6, 5.0), (5.0, 6.4), (6.4, 8.0), (8.0, 9.55), (9.6, 9.99)):
        c.pedal('pf', t0, t1)
    x = c.render({'pf': 1.0}, rt60=1.5, wet=0.18, length=7.4 + 0.02)
    x = dsp.fade(x, 0.25, 0.03)
    put(x, 2.6, name='M1', lufs=-17.5)


# =================================================================== M2  13.0 - 19.6  violin harmonic A6 (barely audible)
def m2():
    t = np.arange(int(6.6 * dsp.SR)) / dsp.SR
    f = 1760 * (1 + 0.0025 * np.sin(2 * np.pi * 5.2 * t))
    y = np.sin(2 * np.pi * np.cumsum(f) / dsp.SR) * 0.5 + 0.08 * np.sin(2 * np.pi * np.cumsum(2 * f) / dsp.SR)
    y *= np.minimum(1, t / 1.2) * np.minimum(1, (6.6 - t) / 1.0)
    x = dsp.reverb(dsp.pan(y.astype(np.float32), -0.1), rt60=2.5, wet=0.5)[: len(t)]
    put(x, 13.0, name='M2', lufs=-44)


# =================================================================== M3+M4  19.8 - 36.6  first 'ねえ' -> Session A
def m3_m4():
    c = Cue('M34', 19.8, bpm=80, seed=7)
    c.track('pf', 0, vol=112, pan=PAN_PIANO); c.track('gt', 25, vol=104, pan=PAN_GUITAR)
    c.track('pad', 89, vol=80); c.track('cel', 8, vol=86, pan=70); c.track('st', 49, vol=86)
    # 20.4 warm D(add9) pad + celesta sparkle into the white
    c.chord('pad', 20.4, 2.2, ['D3', 'A3', 'E4', 'F#4'], 46)
    for k, q in enumerate(['A5', 'D6', 'E6', 'F#6']):
        c.n('cel', 20.45 + k * 0.17, 1.4, q, 48 - 4 * k)
    # NE motif: 21.25 A4 (the tear) -> 22.0 F#5 (head of the theme)
    c.n('pf', 21.25, 0.75, 'A4', 58); c.n('pf', 22.0, 1.5, 'F#5', 70); c.pedal('pf', 21.2, 23.4)
    # 22.0 guitar answers (2 beats) / 23.5 piano answers (2 beats)
    c.seq('gt', 22.0, [('D4', 0.5), ('C#4', 0.5), ('A3', 1.0)], vel=66)
    c.chord('gt', 22.0, 1.5, ['D3', 'A3'], 50)
    c.seq('pf', 23.5, [('F#5', 0.5), ('E5', 0.5), ('D5', 1.0)], vel=68); c.pedal('pf', 23.45, 24.95)
    c.chord('pf', 23.5, 1.5, ['D3', 'A3'], 46)
    # 25.0 one-beat exchanges over A/C#: G 25.0 / P 25.75 / G 26.5
    c.chord('gt', 25.0, 2.25, ['C#3', 'A3', 'E4'], 50)
    c.seq('gt', 25.0, [('A4', 0.5), ('B4', 0.5)], vel=66)
    c.seq('pf', 25.75, [('C#5', 0.5), ('E5', 0.5)], vel=68)
    c.seq('gt', 26.5, [('D5', 0.5), ('C#5', 0.5)], vel=68)
    # 27.25 unison run-up, 28.0 land together on Bm(add11)
    for who in ('gt', 'pf'):
        c.seq(who, 27.25, [('F#4', 0.25), ('G4', 0.25), ('A4', 0.25), ('C#5', 0.25)], vel=70)
    c.chord('gt', 28.0, 3.0, ['B2', 'F#3', 'B3', 'D4', 'E4'], 58, roll=0.03)
    c.chord('pf', 28.0, 2.0, ['B2', 'F#3', 'D4', 'F#4'], 52); c.pedal('pf', 27.95, 30.9)
    # bar 3 (28.0-31.0): guitar alone, soft fingerpicking under 'ねえ……左手、見せて'
    themes.guitar_pick(c.S, 'gt', c.b(28.0), [[(2, 'B1', ['B2', 'F#3', 'A3', 'D4']), (2, 'G1', ['G2', 'D3', 'F#3', 'B3'])]], vel=48)
    # 31.0 piano sings MEL_A (bars 1-2) with rubato, guitar accompanies; first small peak 35.6
    mel = [('F#5', 1.6), ('E5', 0.45), ('D5', 0.95), ('A4', 1.0), ('C#5', 1.5), ('D5', 0.5), ('E5', 2.0)]
    c.seq('pf', 31.0, [(m[0], m[1], 74 if m[0] != 'E5' else 80) for m in mel])
    c.chord('pf', 31.0, 3.0, ['D3', 'A3'], 48); c.chord('pf', 34.0, 2.25, ['C#3', 'A3'], 48); c.chord('pf', 36.25, 0.75, ['A2', 'G3'], 50)
    c.pedal('pf', 31.0, 33.95); c.pedal('pf', 34.0, 36.2); c.pedal('pf', 36.25, 36.95)
    themes.guitar_pick(c.S, 'gt', c.b(31.0), [themes.PROG_A[0], [(3, 'C#2', ['A2', 'E3', 'A3', 'C#4']), (1, 'A1', ['A2', 'E3', 'G3', 'C#4'])]], vel=50)
    c.chord('st', 31.0, 3.0, ['D3', 'A3', 'F#4'], 40); c.chord('st', 34.0, 2.25, ['C#3', 'A3', 'E4'], 44); c.chord('st', 36.25, 1.2, ['A2', 'G3', 'C#4', 'E4'], 46)
    # dynamics: the call-and-response grows; the sung phrase swells to the small peak (35.6) and relaxes into A7
    def dyn(b):
        t = c.t0 + b * 60.0 / c.bpm
        if t < 22.0: return 0.9
        if t < 28.0: return 0.92 + 0.1 * (t - 22.0) / 6.0
        if t < 31.0: return 0.86
        if t < 35.6: return 0.9 + 0.18 * (t - 31.0) / 4.6
        return 1.08 - 0.25 * min(1.0, (t - 35.6) / 1.0)
    c.S.shape_velocity(dyn, names=['pf', 'gt'])
    # the two instruments move toward the centre as they start to sing together
    c.ramp('pf', 31.0, 34.0, 10, PAN_PIANO, 52, 12); c.ramp('gt', 31.0, 34.0, 10, PAN_GUITAR, 76, 12)
    x = c.render({'pf': 1.0, 'gt': 0.85, 'pad': 0.35, 'cel': 0.4, 'st': 0.42}, rt60=2.3, wet=0.28, length=36.95 - 19.8)
    x = dsp.fade(x, 0.0, 0.25)
    put(x, 19.8, name='M3_M4', lufs=-24)


# =================================================================== M5  36.6 - 40.4  strings hold A7 (pp)
def m5():
    c = Cue('M5', 36.9, bpm=60, seed=9)
    c.track('st', 49, vol=80)
    c.chord('st', 36.9, 3.6, ['A2', 'E3', 'G3', 'C#4', 'E4'], 34)
    x = c.render({'st': 1.0}, rt60=2.8, wet=0.4, length=3.6)
    put(dsp.fade(x, 0.3, 1.0), 36.9, name='M5', lufs=-34)


# =================================================================== M6  40.5 - 46.5  festival (diegetic)
def m6():
    full = dsp.load(os.path.join(ROOT, 'assets', 'festival_recording_full.wav'))
    a = dsp.fade(seg(full, 0.0, 1.5), 0.0, 0.08)        # the D major blast (42.0)
    b = dsp.fade(seg(full, 8.2, 12.7), 0.03, 0.8)        # 43.5 -> snap at 43.74 (=8.44), boos, blues
    x = dsp.silence(4.6)
    x = dsp.place(x, a, 0.0)
    x = dsp.place(x, b, 1.5)
    # live cymbal + kick on the blast
    kick = sfx.sub_boom(1.0, 70, 40, 0.9); x = dsp.place(x, kick, 0.0, -4)
    put(x, 42.0, name='M6', lufs=-15)


# =================================================================== M7  46.5 - 49.4  summer theme (bright)
def m7():
    c = Cue('M7', 46.5, bpm=80, seed=11)
    c.track('pf', 0, vol=110, pan=PAN_PIANO); c.track('gt', 25, vol=104, pan=PAN_GUITAR); c.track('glk', 9, vol=80, pan=64)
    c.seq('pf', 46.5, [('F#5', 1.5), ('E5', 0.5), ('D5', 1.0), ('A4', 1.0)], vel=78)
    c.seq('glk', 46.5, [('F#6', 1.5), ('E6', 0.5), ('D6', 1.0), ('A5', 1.0)], vel=54)
    themes.guitar_pick(c.S, 'gt', 0, [themes.PROG_A[0]], vel=60)
    c.chord('pf', 46.5, 2.9, ['D3', 'A3'], 50); c.pedal('pf', 46.5, 49.4)
    x = c.render({'pf': 1.0, 'gt': 0.85, 'glk': 0.35}, rt60=1.8, wet=0.22, length=2.5)
    x = dsp.fade(x, 0.02, 0.05)   # the shutter (49.0) stops it
    put(x, 46.5, name='M7', lufs=-21)


# =================================================================== M8 + M9  53.0 - 59.9  competition
def m8_m9():
    c = Cue('M8', 53.0, bpm=50, seed=13)
    c.track('pf', 0, vol=118, pan=58)
    # M8: lento cantabile in E major (melody over inner 16ths), from 53.1
    themes.competition_etude(c.S, 'pf', c.b(53.1), bars=1, vel=64)
    x8 = c.render({'pf': 1.0}, rt60=2.4, wet=0.36, length=4.0)
    x8 = dsp.fade(x8, 0.05, 0.5)
    put(x8, 53.0, name='M8', lufs=-24)
    # M9: 'Winter Wind'-like torrent in A minor: right hand cascades from the top, left hand chords
    d = Cue('M9', 57.0, bpm=138, seed=17)
    d.track('pf', 0, vol=120, pan=58)
    scale = [p(x) for x in ('A6', 'G6', 'F6', 'E6', 'D6', 'C6', 'B5', 'A5', 'G#5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G#4', 'E4', 'C4')]
    t = 57.0
    for run in range(4):
        for k, q in enumerate(scale[: 12 + run * 2]):
            d.n('pf', t + k * 0.055, 0.07, q, 92 - k)
        t += 0.62
    for t0, ch in ((57.0, ['A2', 'E3', 'A3', 'C4']), (57.62, ['F2', 'C3', 'A3']), (58.24, ['D2', 'A2', 'F3']), (58.86, ['E2', 'B2', 'G#3', 'E4'])):
        d.chord('pf', t0, 0.5, ch, 96)
    d.chord('pf', 59.4, 0.5, ['A1', 'A2', 'E3', 'A3', 'C4', 'E4', 'A4'], 118)
    d.pedal('pf', 59.4, 59.85)
    x9 = d.render({'pf': 1.0}, rt60=2.2, wet=0.3, length=2.9)
    x9 = x9 * dsp.gain_curve(len(x9), [(0, 0), (0.15, -8), (2.3, -8), (2.4, 0), (2.9, 0)])[:, None]
    put(dsp.fade(x9, 0.02, 0.3), 57.0, name='M9', lufs=-20)


# =================================================================== M10  60.0 - 63.0  train: theme head, piano solo ppp
def m10():
    c = Cue('M10', 60.0, bpm=66, seed=19)
    c.track('pf', 0, vol=96, pan=PAN_PIANO)
    c.seq('pf', 60.6, [('F#5', 1.0), ('E5', 0.4), ('D5', 0.7), (None, 0.5), ('A4', 1.0)], vel=50)
    c.chord('pf', 60.6, 2.4, ['D3', 'A3'], 36); c.pedal('pf', 60.6, 63.0)
    x = c.render({'pf': 1.0}, rt60=2.6, wet=0.35, length=3.0)
    put(dsp.fade(x, 0.1, 0.6), 60.0, name='M10', lufs=-34)


# =================================================================== M11  63.0 - 75.5  the promise (ends unresolved)
def m11():
    c = Cue('M11', 63.0, bpm=80, seed=23)
    c.track('pf', 0, vol=112, pan=PAN_PIANO); c.track('gt', 25, vol=104, pan=PAN_GUITAR)
    c.track('st', 49, vol=96); c.track('vc', 42, vol=92, pan=50)
    # 63.0 strings + guitar crescendo -> 64.8 she runs into his chest (peak) -> 66.5 strings recede
    c.chord('st', 63.0, 1.8, ['G2', 'D3', 'B3', 'D4', 'G4'], 54); c.ramp('st', 63.0, 64.8, 11, 60, 127)
    c.chord('st', 64.8, 1.8, ['A2', 'E3', 'C#4', 'E4', 'A4'], 92); c.ramp('st', 64.8, 66.5, 11, 127, 60)
    themes.guitar_pick(c.S, 'gt', 0, [[(2.4, 'G1', ['G2', 'D3', 'G3', 'B3']), (2.27, 'A1', ['A2', 'E3', 'A3', 'C#4'])]], vel=62)
    c.chord('vc', 63.0, 1.8, ['G2'], 70); c.chord('vc', 64.8, 1.8, ['A2'], 80)
    # 66.5 hush: D pedal in strings
    c.chord('st', 66.6, 3.4, ['D3', 'A3', 'F#4'], 40)
    # 67.25 / 68.0 piano NE ('ね' 'え') — the silent subtitle
    c.n('pf', 67.25, 0.75, 'A4', 60); c.n('pf', 68.0, 0.8, 'F#5', 66); c.pedal('pf', 67.2, 68.7)
    c.chord('pf', 67.25, 1.4, ['D3', 'A3'], 40)
    # 68.75 guitar ANSWER ('ん？')
    c.seq('gt', 68.75, [('D5', 0.5), ('C#5', 0.5), ('A4', 0.9)], vel=64)
    # 70.0 first unison: piano + guitar sing the same line (over G - Em - Bm - A7sus4)
    line = [('B4', 2.0), ('A4', 1.0), ('F#4', 1.0), ('G4', 1.5), ('F#4', 0.5), ('E4', 1.5)]
    c.seq('pf', 70.0, [(q[0], q[1], 72) for q in line]); c.seq('gt', 70.0, [(q[0], q[1], 66) for q in line])
    c.chord('pf', 70.0, 3.0, ['G2', 'D3', 'B3'], 44); c.chord('pf', 73.0, 1.0, ['E2', 'B2', 'G3'], 44)
    c.pedal('pf', 70.0, 72.95); c.pedal('pf', 73.0, 73.95)
    c.chord('st', 70.0, 3.0, ['G2', 'D3', 'B3', 'D4'], 46); c.chord('st', 73.0, 1.0, ['E2', 'B2', 'G3', 'D4'], 46)
    themes.guitar_pick(c.S, 'gt', c.b(70.0), [[(4, 'G1', ['G2', 'D3', 'B3', 'D4'])], [(1.33, 'E1', ['E2', 'B2', 'G3', 'D4'])]], vel=48)
    # 74.0 A7sus4 held, unresolved, cut at 75.5
    c.chord('st', 74.0, 1.6, ['A2', 'E3', 'G3', 'D4', 'E4'], 50); c.chord('pf', 74.0, 1.5, ['A2', 'E3', 'G3', 'D4'], 50)
    c.chord('gt', 74.0, 1.5, ['A2', 'E3', 'G3', 'D4', 'E4'], 54, roll=0.035); c.pedal('pf', 74.0, 75.45)
    def dyn11(b):
        t = c.t0 + b * 60.0 / c.bpm
        if 70.0 <= t < 72.2: return 0.95 + 0.12 * (t - 70.0) / 2.2
        if 72.2 <= t < 74.0: return 1.07 - 0.15 * (t - 72.2) / 1.8
        return 1.0
    c.S.shape_velocity(dyn11, names=['pf', 'gt'])
    x = c.render({'pf': 1.0, 'gt': 0.85, 'st': 0.5, 'vc': 0.45}, rt60=2.6, wet=0.3, length=12.5)
    x = dsp.fade(x, 0.3, 0.06)
    put(x, 63.0, name='M11', lufs=-23)


# =================================================================== M12  75.5 - 77.9  the music in her head; the brake swallows NE
def m12():
    c = Cue('M12', 75.5, bpm=80, seed=29)
    c.track('pf', 0, vol=104, pan=PAN_PIANO)
    c.seq('pf', 75.5, [('F#5', 1.5, 64), ('E5', 0.5, 58), ('D5', 1.0, 60), ('A4', 1.0, 62)], legato=0.8)  # A4 at 77.75 = NE 'ね'
    x = c.render({'pf': 1.0}, rt60=1.6, wet=0.2, length=77.9 - 75.5)
    x = x * dsp.gain_curve(len(x), [(0, 0), (2.3, 0), (2.4, -40)])[:, None]   # swallowed at 77.85
    put(x, 75.5, name='M12', lufs=-28)


# =================================================================== M14  93.6 - 95.8  one-handed melody (felt piano, low)
def m14():
    c = Cue('M14', 93.6, bpm=54, seed=31)
    c.track('pf', 0, bank=8, vol=96, pan=PAN_PIANO)   # Mellow Grand (una corda feel)
    c.seq('pf', 93.6, [('B3', 1.0), ('G#3', 0.5), ('A3', 0.25), ('B3', 0.25), ('C#4', 0.6)], vel=48, legato=1.1)
    x = c.render({'pf': 1.0}, rt60=2.4, wet=0.3, length=2.4)
    x = x * dsp.gain_curve(len(x), [(0, 0), (2.1, 0), (2.25, -40)])[:, None]   # stops before the peak
    put(dsp.lowpass(x, 3500), 93.6, name='M14', lufs=-33)


# =================================================================== M15  96.0 - 116.7  the storm (no piano)
def m15():
    c = Cue('M15', 96.0, bpm=60, seed=37)
    for n, pr, v in (('trem', 44, 110), ('lo', 48, 104), ('vc', 42, 104), ('timp', 47, 116), ('fb', 30, 86), ('br', 60, 92), ('vn', 49, 96)):
        c.track(n, pr, vol=v, bank=8 if n == 'fb' else 0)
    c.S.tracks['fb'].program = 30
    # 96.0 low string tremolo with the thunder (D minor)
    c.chord('trem', 96.0, 2.7, ['D2', 'A2', 'D3', 'F3'], 92)
    c.n('timp', 96.0, 1.5, 'D2', 110)
    # 98.7 the rain stops: only a low D drone
    c.chord('lo', 98.7, 4.0, ['D1', 'D2'], 60)
    # 102.7 thunder + tutti accent
    c.chord('trem', 102.7, 2.8, ['D2', 'A2', 'D3', 'F3', 'A3'], 104); c.chord('br', 102.7, 0.9, ['D2', 'A2', 'D3', 'F3'], 100); c.n('timp', 102.7, 1.0, 'D2', 120)
    # 105.5 impact: timpani hit; 106.3 drone under the dialogue
    c.n('timp', 105.5, 2.0, 'A1', 127); c.chord('lo', 105.5, 4.0, ['D1', 'D2', 'A2'], 70)
    c.n('fb', 106.0, 3.5, 'D3', 60); c.ramp('fb', 106.0, 109.5, 11, 20, 90)
    # 109.5 thunder + tutti accent
    c.chord('trem', 109.5, 1.2, ['Bb1', 'F2', 'Bb2', 'D3', 'F3'], 104); c.chord('br', 109.5, 0.9, ['Bb1', 'F2', 'Bb2', 'D3'], 98); c.n('timp', 109.5, 0.8, 'Bb1', 118)
    # 110.0 cello solo: NE in minor (A3 -> F4)
    c.n('vc', 110.0, 1.2, 'A3', 82); c.n('vc', 111.2, 3.4, 'F4', 86)
    c.chord('lo', 110.0, 5.0, ['D2', 'A2'], 54)
    # 115.0 strings begin to rise (she looks up to the sky)
    for k, q in enumerate(['D3', 'E3', 'F3', 'G3', 'A3', 'Bb3', 'C#4']):
        c.n('vn', 115.0 + k * 0.24, 0.3 if k < 6 else 0.9, q, 70 + k * 6)
    c.chord('vn', 116.6, 0.6, ['A3', 'C#4', 'E4'], 96)
    x = c.render({'trem': 0.7, 'lo': 0.7, 'vc': 0.75, 'timp': 0.85, 'fb': 0.32, 'br': 0.5, 'vn': 0.55}, rt60=3.0, wet=0.34, length=20.7)
    put(dsp.fade(x, 0.02, 0.25), 96.0, name='M15', lufs=-21)


# =================================================================== M16  116.5 - 123.3  the vow (his guitar sings her melody)
def m16():
    c = Cue('M16', 116.5, bpm=80, seed=41)
    c.track('gt', 27, vol=110, pan=PAN_GUITAR)        # white Strat, clean
    c.track('st', 49, vol=100); c.track('vn', 40, vol=92); c.track('timp', 47, vol=110)
    c.track('vc', 42, vol=98); c.track('br', 60, vol=96); c.track('pf', 0, vol=100, pan=PAN_PIANO)
    c.track('dr', 48, bank=128, vol=110, drums=True)
    # 117.0 strings let D major light in; guitar: MEL_A head an octave lower (F#4 E4 D4 A3 | C#4 D4 E4)
    c.chord('st', 117.0, 3.0, ['D3', 'A3', 'D4', 'F#4'], 56); c.ramp('st', 117.0, 122.6, 11, 50, 127)
    c.n('timp', 117.0, 3.0, 'D2', 44)
    for k in range(int((122.7 - 117.0) / 0.0625)):                       # timpani roll building
        c.n('timp', 117.0 + k * 0.0625, 0.07, 'A1' if k % 2 else 'D2', int(30 + 70 * k / 91))
    c.seq('gt', 117.0, [('F#4', 1.5), ('E4', 0.5), ('D4', 1.0), ('A3', 0.9)], vel=84)      # until 120.0
    # 120.0 the pause after '俺が' — resume 120.6
    c.seq('gt', 120.6, [('C#4', 1.4), ('D4', 0.5), ('E4', 1.5)], vel=88)
    c.chord('st', 120.0, 2.7, ['A2', 'E3', 'G3', 'C#4', 'E4'], 70)
    c.chord('vc', 117.0, 3.0, ['D3'], 62); c.chord('vc', 120.0, 2.7, ['A2'], 70)
    # 122.7 'よ' -> D major tutti ff (peak), freeze 122.9, cut 123.3
    tutti = ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4', 'A4', 'D5']
    c.chord('st', 122.7, 0.6, tutti, 120); c.chord('br', 122.7, 0.6, tutti[:6], 118); c.chord('vn', 122.7, 0.6, ['D5', 'F#5', 'A5', 'D6'], 112)
    c.chord('pf', 122.7, 0.6, ['D1', 'D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4'], 118); c.n('timp', 122.7, 0.6, 'D2', 127)
    c.chord('gt', 122.7, 0.6, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], 110, roll=0.01)
    c.n('dr', 122.7, 0.6, 49, 127); c.n('dr', 122.7, 0.4, 36, 127)
    x = c.render({'gt': 0.95, 'st': 0.55, 'vn': 0.4, 'timp': 0.7, 'vc': 0.5, 'br': 0.45, 'pf': 0.6, 'dr': 0.6}, rt60=2.8, wet=0.32, length=123.3 - 116.5)
    x = dsp.fade(x, 0.2, 0.0)
    x[int((123.3 - 116.5) * dsp.SR) - 60:] = 0      # hard cut out
    put(x, 116.5, name='M16', lufs=-18)


# =================================================================== M17  137.9 - 144.2  cello pedal D
def m17():
    c = Cue('M17', 137.9, bpm=60, seed=43)
    c.track('vc', 42, vol=96, pan=60)
    c.n('vc', 137.9, 6.3, 'D2', 62)
    x = c.render({'vc': 1.0}, rt60=2.4, wet=0.3, length=6.3)
    x = x * dsp.gain_curve(len(x), [(0, -40), (0.8, 0), (6.0, 0), (6.3, -40)])[:, None]
    put(x, 137.9, name='M17', lufs=-33)


# =================================================================== M18  144.9 - 150.2  the recording on the phone
def m18():
    ph = dsp.load(os.path.join(ROOT, 'assets', 'festival_recording_phone.wav'))
    x = dsp.silence(5.4)
    x = dsp.place(x, dsp.fade(seg(ph, 0.0, 2.45), 0.0, 0.05), 0.0)
    x = dsp.place(x, dsp.fade(seg(ph, 3.1, 4.85), 0.05, 0.05), 2.4)
    x = dsp.place(x, dsp.fade(seg(ph, 8.2, 9.45), 0.03, 0.12), 4.1)
    put(dsp.fit(x, 5.4), 144.9, name='M18', lufs=-22)


# =================================================================== M19  154.5 - 161.0  cello + strings under his confession
def m19():
    c = Cue('M19', 154.5, bpm=60, seed=47)
    c.track('vc', 42, vol=98, pan=60); c.track('st', 49, vol=84)
    c.seq('vc', 154.6, [('D3', 1.5), ('C#3', 1.5), ('B2', 1.6), ('G2', 1.8)], vel=60, legato=1.02)
    c.chord('st', 154.6, 3.0, ['F#3', 'A3', 'D4'], 32); c.chord('st', 157.6, 3.2, ['D3', 'G3', 'B3'], 34)
    x = c.render({'vc': 0.9, 'st': 0.45}, rt60=2.6, wet=0.35, length=6.5)
    put(dsp.fade(x, 0.6, 0.8), 154.5, name='M19', lufs=-32)


# =================================================================== M20  161.4 - 167.6  bloom: the recording opens into the real thing
def m20():
    full = dsp.load(os.path.join(ROOT, 'assets', 'festival_recording_full.wav'))
    rec = seg(full, 0.0, 2.1)                                   # 161.4 -> 163.5 : the blast again
    n = len(rec); t = np.arange(n) / dsp.SR
    # time-varying lowpass 3.5k -> 20k from 161.8 to 163.3 (0.4 -> 1.9 s), mono -> stereo
    out = np.zeros_like(rec); blk = 1200
    for s in range(0, n, blk):
        tt = s / dsp.SR; k = np.clip((tt - 0.4) / 1.5, 0, 1)
        fc = 3500 * (20000 / 3500) ** k
        y = dsp.butter(rec[max(0, s - 2400): s + blk], 'low', min(fc, 22000), 2)[-min(blk, n - s):]
        m = y.mean(axis=1, keepdims=True); out[s: s + len(y)] = m + (y - m) * k
    ph = dsp.phone_speaker(rec)
    w = np.clip((t - 0.4) / 1.5, 0, 1)[:, None]
    rec_mix = ph * (1 - w) + out * w
    rec_mix = rec_mix * dsp.gain_curve(n, [(0, 0), (1.85, 0), (2.1, -30)])[:, None]
    put(dsp.fit(rec_mix, 2.1), 161.4, name='M20a', lufs=-19)
    # 163.5 the full theme, ff (MEL_A2 head) — biggest catharsis; 166.5 decrescendo; 167.0 strings hold D/F#
    c = Cue('M20', 163.5, bpm=80, seed=53)
    for nme, pr, v, pn in (('pf', 0, 118, PAN_PIANO), ('gt', 25, 106, PAN_GUITAR), ('egt', 29, 84, 80), ('st', 49, 104, 64), ('vn', 40, 98, 70),
                           ('vc', 42, 100, 54), ('bs', 33, 104, 64)):
        c.track(nme, pr, vol=v, pan=pn)
    c.track('dr', 16, bank=128, vol=110, drums=True)
    mel = [('F#5', 1.5), ('E5', 0.5), ('D5', 1.0), ('A4', 1.0), ('C#5', 1.5), ('D5', 0.5), ('E5', 1.5)]
    c.seq('pf', 163.5, [(m[0], m[1], 100) for m in mel]); c.seq('pf', 163.5, [(p(m[0]) - 12, m[1], 84) for m in mel])
    c.seq('vn', 163.5, [(p(m[0]) + 12, m[1], 88) for m in mel], legato=1.02)
    c.chord('pf', 163.5, 3.0, ['D2', 'A2', 'D3', 'F#3'], 80); c.chord('pf', 166.5, 1.1, ['C#2', 'A2', 'E3'], 64)
    c.pedal('pf', 163.5, 166.45); c.pedal('pf', 166.5, 167.6)
    themes.guitar_pick(c.S, 'gt', 0, [themes.PROG_A[0], [(2, 'C#2', ['A2', 'E3', 'A3', 'C#4'])]], vel=72)
    c.chord('egt', 163.5, 2.9, ['D3', 'A3', 'D4', 'F#4'], 90, roll=0.012); c.chord('egt', 166.5, 1.0, ['C#3', 'A3', 'E4'], 70, roll=0.012)
    c.chord('st', 163.5, 3.0, ['D3', 'A3', 'D4', 'F#4', 'A4'], 100); c.chord('st', 166.5, 0.5, ['C#3', 'A3', 'E4'], 76)
    c.chord('st', 167.0, 0.6, ['F#2', 'D3', 'A3', 'D4'], 64)
    c.seq('vc', 163.5, [('D3', 2.0), ('C#3', 2.0), ('B2', 1.5)], vel=92)
    c.seq('bs', 163.5, [('D2', 2.0), ('D2', 2.0), ('C#2', 1.5)], vel=96)
    c.n('dr', 163.5, 1.5, 49, 124); c.n('dr', 163.5, 0.5, 36, 124); c.n('dr', 163.5, 1.5, 57, 110)
    for k in range(1, 6):
        t = 163.5 + k * 0.75
        c.n('dr', t, 0.3, 38 if k % 2 == 1 else 36, 96 - k * 6)
        c.n('dr', t, 0.3, 51, 70 - k * 5)
    c.n('dr', 164.25, 0.4, 37, 70)     # rim on the train's beat
    x = c.render({'pf': 1.0, 'gt': 0.7, 'egt': 0.35, 'st': 0.6, 'vn': 0.42, 'vc': 0.55, 'bs': 0.6, 'dr': 0.62}, rt60=2.4, wet=0.28, length=4.1)
    x = x * dsp.gain_curve(len(x), [(0, 0), (3.0, 0), (3.6, -7), (4.1, -12)])[:, None]
    put(dsp.fade(x, 0.0, 0.08), 163.5, name='M20b', lufs=-14.5)


# =================================================================== M21  167.6 - 180.0  finale & title
def m21():
    c = Cue('M21', 167.6, bpm=80, seed=59)
    c.track('pf', 0, vol=112, pan=PAN_PIANO); c.track('gt', 25, vol=104, pan=PAN_GUITAR)
    c.track('st', 49, vol=92); c.track('cel', 8, vol=80, pan=64)
    # 167.75 'ね' / 168.5 'え' — the second note finally arrives
    c.n('pf', 167.75, 0.75, 'A4', 58); c.n('pf', 168.5, 1.2, 'F#5', 66); c.pedal('pf', 167.7, 169.9)
    # 169.25 guitar ANSWER ('何？')
    c.seq('gt', 169.25, [('D5', 0.5), ('C#5', 0.5), ('A4', 0.9)], vel=62)
    # 170.0 the promise chord A7sus4 returns ppp, held under the hands
    c.chord('st', 170.0, 4.75, ['A2', 'E3', 'G3', 'D4', 'E4'], 30); c.ramp('st', 170.0, 174.75, 11, 70, 105)
    c.chord('pf', 170.0, 4.6, ['A2', 'E3', 'D4'], 38); c.pedal('pf', 170.0, 174.7)
    themes.guitar_pick(c.S, 'gt', c.b(171.5), [[(4, 'A1', ['A2', 'E3', 'D4', 'G4'])]], vel=40)
    # 174.75 nine strokes: piano / guitar alternate triplet eighths (0.25 s) over A7sus4
    nine = ['A4', 'D5', 'E5', 'G5', 'A5', 'D6', 'E6', 'G6', 'A6']
    for k, q in enumerate(nine):
        who = 'pf' if k % 2 == 0 else 'gt'
        c.n(who, 174.75 + k * 0.25, 0.6, q, 50 + k * 5)
    c.chord('st', 174.75, 2.25, ['A2', 'E3', 'G3', 'D4', 'E4', 'A4'], 60)
    c.pedal('pf', 174.75, 176.95)
    # 177.0 D(add9) tutti — the promise resolves, the title completes; 177.35 guitar strum ('アイロニー')
    c.chord('pf', 177.0, 2.6, ['D1', 'D2', 'A2', 'D3', 'F#3', 'A3', 'E4', 'F#4', 'A4', 'D5'], 92); c.pedal('pf', 177.0, 179.55)
    c.chord('st', 177.0, 2.6, ['D2', 'A2', 'D3', 'F#3', 'A3', 'E4', 'F#4'], 82)
    c.chord('gt', 177.35, 2.3, ['D3', 'A3', 'D4', 'E4', 'F#4', 'A4'], 80, roll=0.022)
    for k, q in enumerate(['D6', 'E6', 'F#6', 'A6']):
        c.n('cel', 177.0 + k * 0.12, 2.0, q, 50)
    x = c.render({'pf': 1.0, 'gt': 0.85, 'st': 0.5, 'cel': 0.35}, rt60=2.8, wet=0.32, length=180.0 - 167.6)
    x = x * dsp.gain_curve(len(x), [(0, 0), (11.4, 0), (12.0, -60), (12.4, -60)])[:, None]   # 179.6 total silence
    put(x, 167.6, name='M21', lufs=-21)


if __name__ == '__main__':
    for f in (m1, m2, m3_m4, m5, m6, m7, m8_m9, m10, m11, m12, m14, m15, m16, m17, m18, m19, m20, m21):
        f(); print('done', f.__name__)
    BUS = dsp.fit(BUS, DUR)
    # the brake's digital silence 78.5-80.5 and the ends of cuts must be exact zeros in the score
    BUS[int(77.9 * dsp.SR): int(80.5 * dsp.SR)] = 0
    dsp.save(os.path.join(OUT, 'score.wav'), BUS)
    print('score.wav', round(len(BUS) / dsp.SR, 2), 's', lvl(BUS), 'LUFS, peak', round(dsp.peak_db(BUS), 1))

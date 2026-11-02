"""Score cues as duration-fitted modules. Each cue_* returns a 48 kHz stereo array of exactly `dur`
seconds (+ optional tail) and is self-contained (own tempo, own render).
"""
import os
import numpy as np
import dsp, music, themes, sfx
from music import p

TMP = '/tmp/claude-0/cues'


def _mk(bpm, seed=1):
    return music.Score(bpm=bpm, seed=seed)


KEY = {'semis': 0}   # global transposition relative to D (set to 2 for E major)


def _render(S, names, gains, tag, rt60=2.4, wet=0.28, tail=4.0, hall=True, transpose=True):
    if transpose and KEY['semis'] and not getattr(S, '_transposed', False):
        S.transpose(KEY['semis']); S._transposed = True
    out = None
    for n in names:
        x = S.render(n, os.path.join(TMP, tag))
        x = x * gains.get(n, 1.0)
        out = x if out is None else _add(out, x)
    if hall:
        out = dsp.reverb(out, rt60=rt60, wet=wet, predelay=0.025)
    return out


def _add(a, b):
    n = max(len(a), len(b)); o = np.zeros((n, 2), np.float32); o[:len(a)] += a; o[:len(b)] += b; return o


def _fit_bpm(beats, dur, lo=60, hi=110):
    return float(np.clip(beats * 60.0 / dur, lo, hi))


def _finish(x, dur, fin=0.0, fout=0.0, tail=0.0):
    x = dsp.fit(x, dur + tail)
    return dsp.fade(x, fin, fout if not tail else 0.0)


# ------------------------------------------------------------------ opening storm (雪あらし)
def cue_snowstorm(dur=10.0, sour=True):
    bars = max(2, int(round(dur / 3.4)))
    S = _mk(_fit_bpm(bars * 4 + (1 if sour else 0), dur, 56, 96), seed=3)
    S.track('piano', 0, vol=118)
    themes.snowstorm(S, 'piano', 0, bars, vel=82, sour_end=sour)
    x = _render(S, ['piano'], {}, 'snow', rt60=1.6, wet=0.22, transpose=False)
    return _finish(x, dur, 0.05, 0.0, tail=2.5)


# ------------------------------------------------------------------ first warm chord after the applause
def cue_first_light(dur=6.0):
    S = _mk(60, seed=5)
    S.track('piano', 0, vol=100); S.track('celesta', 8, vol=80); S.track('pad', 89, vol=70)
    for q in ('D2', 'A2', 'E3', 'F#3', 'A3', 'D4'):
        S.note('piano', 0.0 + 0.04 * (p(q) % 7), 6, q, 58)
    S.pedal('piano', 0, 6)
    for i, q in enumerate(('A5', 'D6', 'E6', 'F#6', 'A6')):
        S.note('celesta', 0.5 + i * 0.33, 2.5, q, 52 - i * 3)
    S.notes('pad', 0, 6, [p('D3'), p('A3'), p('E4'), p('F#4')], vel=45)
    # NE motif pickup into the theme at the end
    S.note('piano', 4.0, 1.0, 'A4', 64); S.note('piano', 5.0, 1.2, 'F#5', 70)
    x = _render(S, ['piano', 'celesta', 'pad'], {'celesta': 0.5, 'pad': 0.35}, 'first', rt60=2.8, wet=0.35)
    return _finish(x, dur, 0.02, 0.0, tail=3.0)


# ------------------------------------------------------------------ session theme (intimate / full)
def cue_theme(dur=24.0, version='intimate', semis=0, mel='A', start_with_pickup=False, drums=True, vel=1.0, fade_out=1.5, cresc=None):
    beats = 32 + (4 if start_with_pickup else 0)
    bpm = _fit_bpm(beats, dur, 66, 100)
    S = _mk(bpm, seed=11)
    for n, pr, v, pn in (('piano', 0, 112, 64), ('guitar', 25, 100, 44), ('strings', 49, 92, 64), ('violins', 40, 84, 76),
                         ('cello', 42, 92, 52), ('bass', 33, 96, 64)):
        S.track(n, pr, vol=v, pan=pn)
    S.track('drums', 8, bank=128, vol=100, drums=True)
    b = 0
    if start_with_pickup:
        music.melody(S, 'piano', 0, [(None, 3), (p('A4') + semis, 1, 70)])
        b = 4
    if version == 'intimate':
        themes.theme_intimate(S, b, semis=semis, mel=mel, vel=vel)
        names = ['piano', 'guitar']; gains = {'guitar': 0.85}
    elif version == 'warm':
        themes.theme_intimate(S, b, semis=semis, mel=mel, vel=vel)
        themes.strings_pad(S, 'strings', b, themes.transpose_prog(themes.PROG_A if mel == 'A' else themes.PROG_A2, semis), vel=int(52 * vel))
        names = ['piano', 'guitar', 'strings']; gains = {'guitar': 0.85, 'strings': 0.55}
    else:
        themes.theme_full(S, b, semis=semis, mel=mel, vel=vel, drums=drums)
        names = ['piano', 'guitar', 'strings', 'violins', 'cello', 'bass'] + (['drums'] if drums else [])
        gains = {'guitar': 0.7, 'strings': 0.6, 'violins': 0.45, 'cello': 0.6, 'bass': 0.75, 'drums': 0.7}
    if cresc:
        b0, b1 = cresc.get('from', 0), cresc.get('to', beats)
        lo, hi = cresc.get('lo', 0.8), cresc.get('hi', 1.12)
        S.shape_velocity(lambda b: lo + (hi - lo) * float(np.clip((b - b0) / max(1e-6, b1 - b0), 0, 1)))
    x = _render(S, names, gains, f'theme_{version}', rt60=2.3, wet=0.26)
    return _finish(x, dur, 0.02, fade_out, tail=0.0), S


# ------------------------------------------------------------------ festival blast (D major) and band hit
def cue_festival(dur=6.0):
    S = _mk(100, seed=13)
    S.track('gtr', 30, vol=110, pan=60); S.track('bass', 34, vol=100); S.track('drums', 16, bank=128, vol=110, drums=True)
    themes.dmajor_blast(S, 'gtr', 0.0, dur=min(dur, 6.0) * 100 / 60 * 0.55, vel=122)
    S.note('bass', 0.0, 3.0, 'D2', 110)
    S.note('drums', 0.0, 2.0, 49, 120); S.note('drums', 0.0, 1.0, 36, 120); S.note('drums', 0.0, 2.0, 57, 110)
    x = _render(S, ['gtr', 'bass', 'drums'], {'gtr': 1.0, 'bass': 0.7, 'drums': 0.8}, 'fest', rt60=2.0, wet=0.35, transpose=False)
    crowd = sfx.crowd(dur + 1, seed=31, mood='murmur', amount=1.2)
    x = _add(x, crowd * 0.8)
    return _finish(x, dur, 0.0, 0.8)


# ------------------------------------------------------------------ competition (white world)
def cue_competition(dur=16.0, bars=None):
    bars = bars or max(3, min(8, int(round(dur / 4.0))))
    S = _mk(_fit_bpm(bars * 4, dur, 52, 72), seed=17)
    S.track('piano', 0, vol=118)
    themes.competition_etude(S, 'piano', 0, bars=bars, vel=66)
    x = _render(S, ['piano'], {}, 'comp', rt60=2.9, wet=0.36, transpose=False)
    return _finish(x, dur, 0.3, 1.2)


# ------------------------------------------------------------------ the promise (night park) — ends unresolved on V
def cue_promise(dur=14.0):
    bars = 4
    S = _mk(_fit_bpm(bars * 4, dur, 56, 84), seed=19)
    S.track('piano', 0, vol=108); S.track('guitar', 24, vol=96, pan=40); S.track('strings', 49, vol=88)
    prog = [themes.PROG_A[3], themes.PROG_A[4], themes.PROG_A[2], [(4, 'A1', ['A2', 'E3', 'C#4', 'G4'])]]
    themes.guitar_pick(S, 'guitar', 0, prog, vel=50)
    themes.strings_pad(S, 'strings', 0, prog, vel=48)
    # unison: guitar and piano play the same line for the first time
    line = [('B4', 2), ('A4', 1), ('F#4', 1), ('G4', 1.5), ('F#4', 0.5), ('E4', 2), ('F#4', 1.5), ('E4', 0.5), ('D4', 1), ('F#4', 1), ('E4', 4)]
    music.melody(S, 'piano', 0, [(x[0], x[1], 70) for x in line])
    music.melody(S, 'guitar', 0, [(p(x[0]), x[1], 64) for x in line])
    for k in range(4):
        S.pedal('piano', k * 4, k * 4 + 4)
    x = _render(S, ['piano', 'guitar', 'strings'], {'guitar': 0.75, 'strings': 0.5}, 'promise', rt60=2.6, wet=0.32)
    return _finish(x, dur, 0.4, 0.0, tail=0.0)


# ------------------------------------------------------------------ hospital: cold drone + distant high notes
def cue_hospital(dur=14.0):
    S = _mk(60, seed=23)
    S.track('glass', 92, vol=80); S.track('strings', 44, vol=70); S.track('piano', 0, vol=90)
    S.notes('glass', 0, dur, [p('D3'), p('A3'), p('E4')], vel=50)
    S.notes('strings', 0, dur, [p('D2'), p('A2')], vel=40)
    for k, q in enumerate(('E6', 'D6', 'A5', 'E6')):
        t = 2 + k * (dur - 4) / 4
        S.note('piano', t, 4, q, 40)
    x = _render(S, ['glass', 'strings', 'piano'], {'glass': 0.45, 'strings': 0.35, 'piano': 0.5}, 'hosp', rt60=3.5, wet=0.45)
    return _finish(x, dur, 1.5, 1.5)


# ------------------------------------------------------------------ storm on the bridge (D minor), climax at climax_t
def cue_storm(dur=26.0, climax_t=None, cut_after_climax=2.5):
    climax_t = climax_t if climax_t is not None else dur - 4.0
    bpm = 92.0
    S = _mk(bpm, seed=29)
    for n, pr, v in (('lo', 48, 104), ('cello', 42, 100), ('timp', 47, 110), ('gtr', 30, 92), ('choir', 52, 90), ('brass', 60, 90), ('piano', 0, 104)):
        S.track(n, pr, vol=v)
    S.track('drums', 48, bank=128, vol=110, drums=True)
    beats_total = int(dur * bpm / 60) + 4
    cb = climax_t * bpm / 60
    prog = ['D2', 'D2', 'Bb1', 'Bb1', 'G1', 'G1', 'A1', 'A1']
    for k in range(0, beats_total, 1):
        bar = int(k // 4); root = p(prog[bar % 8])
        build = min(1.0, k / max(1, cb))
        if k < cb:
            for e in range(2):   # eighth ostinato in low strings
                S.note('lo', k + e * 0.5, 0.45, root + 12 + (0 if e == 0 else 12 if (k % 2) else 7), int(60 + 40 * build))
    # timpani rolls on bar starts, growing
    for bar in range(int(cb // 4) + 1):
        b = bar * 4
        if b < cb:
            for r in range(8):
                S.note('timp', b + r * 0.125, 0.12, p(prog[bar % 8]) + 12, int(40 + 50 * min(1, b / cb)))
    # cello line (lament) entering mid-way
    lam = [('F3', 2), ('E3', 2), ('D3', 2), ('A2', 2), ('Bb2', 2), ('A2', 2), ('G2', 2), ('A2', 2)]
    music.melody(S, 'cello', max(0, cb - 24), [(x[0], x[1], 84) for x in lam])
    # feedback guitar swells
    for b in (0, 8, 16):
        if b < cb:
            S.note('gtr', b, 6, 'D3', 70 + b); S.cc_ramp('gtr', b, b + 6, 11, 30, 127, 12)
    # climax: tutti D minor -> Bb, choir & brass, cymbal
    for q in ('D2', 'A2', 'D3', 'F3', 'A3', 'D4', 'F4'):
        S.note('brass', cb, 4, q, 110); S.note('choir', cb, 5, q, 100)
    S.note('drums', cb, 3, 49, 127); S.note('drums', cb, 1, 36, 127); S.note('timp', cb, 3, 'D2', 127)
    for q in ('Bb1', 'F2', 'Bb2', 'D3', 'F3', 'Bb3', 'D4'):
        S.note('brass', cb + 4, 4, q, 104); S.note('choir', cb + 4, 5, q, 96)
    names = ['lo', 'cello', 'timp', 'gtr', 'choir', 'brass', 'drums']
    x = _render(S, names, {'lo': 0.8, 'cello': 0.8, 'timp': 0.9, 'gtr': 0.35, 'choir': 0.55, 'brass': 0.55, 'drums': 0.6}, 'storm', rt60=3.0, wet=0.35)
    end = climax_t + cut_after_climax
    x = dsp.fit(x, end)
    x = dsp.fade(x, 0.5, min(1.5, cut_after_climax))
    return dsp.fit(x, dur)


# ------------------------------------------------------------------ silent days: left hand alone
def cue_left_hand(dur=16.0):
    S = _mk(_fit_bpm(16, dur, 50, 80), seed=31)
    S.track('piano', 0, vol=104)
    themes.left_hand_alone(S, 'piano', 0, vel=50)
    x = _render(S, ['piano'], {}, 'lh', rt60=2.6, wet=0.3)
    x = dsp.lowpass(x, 5000)
    return _finish(x, dur, 0.2, 1.5)


# ------------------------------------------------------------------ the epilogue duet
def cue_epilogue(dur=10.0):
    S = _mk(_fit_bpm(8, dur, 54, 80), seed=37)
    S.track('piano', 0, vol=100); S.track('guitar', 25, vol=96, pan=44)
    music.melody(S, 'piano', 0, [('F#5', 1.5, 66), ('E5', 0.5, 60), ('D5', 1, 60), ('A4', 1, 58), ('D5', 4, 62)])
    music.melody(S, 'guitar', 0, [(p('D4'), 4, 56), (p('A3'), 4, 54)])
    for q in ('D3', 'A3', 'F#4'):
        S.note('guitar', 4.0 + 0.08 * (p(q) % 5), 4, q, 50)
    S.pedal('piano', 0, 8)
    x = _render(S, ['piano', 'guitar'], {'guitar': 0.8}, 'epi', rt60=2.8, wet=0.35)
    return _finish(x, dur, 0.1, 2.0)

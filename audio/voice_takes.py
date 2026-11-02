"""Phrase-by-phrase VOICEVOX takes for the 18 trailer lines.

Each line is split where the acting notes ask for a pause, so every pause has an exact length,
and each phrase can carry its own style (e.g. 玄野武宏 ノーマル → 悲しみ) and prosody.
  python3 audio/voice_takes.py            # needs the VOICEVOX ENGINE on 127.0.0.1:50021
Writes audio/voice_out/<id>.wav and durations.json (with per-phrase onsets).

Phrase keys: t (text for synthesis), style, speed, pitch, intonation, volume, gap (silence after, s),
tremble (per-mora pitch wobble, log-F0 units), lift (raise the last mora), drop (lower the last mora),
breathy (0..1 noise-excited mix, for whispered / hoarse delivery), pause (VOICEVOX comma-pause scale).
"""
import json, os, sys, tempfile
import numpy as np
from scipy.signal import lfilter
import dsp
from voice import _post, CAST_VV, vv_alive, trim

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'voice_out')

TAKES = {
    'V01': ('先輩', [
        dict(t='ねえ', speed=0.84, pitch=-0.02, intonation=1.05, volume=0.82, breathy=0.22, gap=0.55),
        dict(t='どうして今日は、拍手をくれたの？', speed=0.97, pitch=-0.01, intonation=1.1, volume=0.86, breathy=0.15),
    ]),
    'V02': ('彼', [
        dict(t='え？', speed=1.0, intonation=1.25, gap=0.3),
        dict(t='だって、今のはミスなかったじゃん', speed=1.06, intonation=1.2, volume=1.0, drop=0.06),
    ]),
    'V03': ('先輩', [
        dict(t='ねえ', speed=0.84, pitch=-0.02, intonation=1.05, volume=0.78, breathy=0.28, gap=0.5),
        dict(t='左手、見せて', speed=0.88, pitch=-0.01, intonation=1.1, volume=0.8, breathy=0.25),
    ]),
    'V04': ('彼', [
        dict(t='俺', style='sad', speed=0.86, intonation=0.95, volume=0.85, tremble=0.025, gap=0.55),
        dict(t='先輩の音。', style='sad', speed=0.88, intonation=0.95, volume=0.85, tremble=0.025, gap=0.38),
        dict(t='好きだよ', style='sad', speed=0.84, intonation=0.9, volume=0.88, tremble=0.03, drop=0.05),
    ]),
    'V05': ('先輩', [
        dict(t='コンクールが終わったらさ', speed=0.93, intonation=1.15, volume=0.86, gap=0.5),
        dict(t='また、', speed=0.9, intonation=1.1, volume=0.84, gap=0.12),
        dict(t='セッションしようね', speed=0.88, intonation=1.2, volume=0.86, drop=0.04),
    ]),
    'V06': ('彼', [
        dict(t='先輩', style='sad', speed=0.82, pitch=-0.03, intonation=0.6, volume=0.85, gap=0.7),
        dict(t='その右手、もう', style='sad', speed=0.84, pitch=-0.04, intonation=0.55, volume=0.8, drop=0.08, breathy=0.2),
    ]),
    'V07': ('彼', [
        dict(t='動かないんだってさ', style='sad', speed=0.86, pitch=-0.05, intonation=0.45, volume=0.9, breathy=0.12),
    ]),
    'V08': ('先輩', [
        dict(t='この気持ちが', speed=0.96, pitch=-0.03, intonation=0.95, volume=0.95, tremble=0.03, gap=0.5),
        dict(t='分からないわよ！', speed=1.1, pitch=0.05, intonation=1.6, volume=1.35, gap=0.12),
        dict(t='貴方には！', speed=1.04, pitch=0.08, intonation=1.65, volume=1.4, breathy=0.12),
    ]),
    'V09': ('先輩', [
        dict(t='コードが', speed=1.0, pitch=0.02, intonation=1.3, volume=1.15, gap=0.38),
        dict(t='押さえられなくなるじゃない！', speed=1.14, pitch=0.07, intonation=1.6, volume=1.4, breathy=0.1),
    ]),
    'V10': ('彼', [
        dict(t='自分のために生きられないなら', speed=0.95, pitch=-0.01, intonation=1.0, volume=0.9, gap=0.5),
        dict(t='俺のために、生きてよ', style='sad', speed=0.88, intonation=1.25, volume=1.08, tremble=0.025),
    ]),
    'V11': ('彼', [
        dict(t='全部は無理だけど', speed=0.92, intonation=0.95, volume=0.88, gap=0.5),
        dict(t='俺が', speed=0.88, intonation=1.0, volume=1.0, gap=0.48),
        dict(t='先輩の右手になるよ', speed=0.86, intonation=1.05, volume=1.06),
    ]),
    'V12': ('先輩', [
        dict(t='だって、', speed=0.86, pitch=-0.07, intonation=0.4, volume=0.92, gap=0.28),
        dict(t='貴方が、', speed=0.86, pitch=-0.07, intonation=0.4, volume=0.92, gap=0.28),
        dict(t='ワタシの右手の代わりに、なってくれるんでしょう', speed=0.88, pitch=-0.07, intonation=0.38, volume=0.92, drop=0.04),
    ]),
    'V13': ('先輩', [
        dict(t='はなして。', speed=0.8, pitch=-0.02, intonation=0.5, volume=0.6, breathy=0.6),
    ]),
    'V14': ('彼', [
        dict(t='嫌だ', style='sad', speed=0.84, intonation=0.9, volume=0.8, tremble=0.03, gap=0.5),
        dict(t='離したくない', style='sad', speed=0.84, intonation=0.95, volume=0.8, tremble=0.035, drop=0.05, breathy=0.12),
    ]),
    'V15': ('叔母', [
        dict(t='ちゃんと、人を好きになりなさい', speed=0.92, pause=0.32, pitch=-0.03, intonation=0.8, volume=0.9, drop=0.03),
    ]),
    'V16': ('先輩', [
        dict(t='なんで', speed=0.82, pitch=-0.02, intonation=0.75, volume=0.78, breathy=0.35, tremble=0.02, gap=0.6),
        dict(t='あるの', speed=0.82, pitch=-0.03, intonation=0.7, volume=0.75, breathy=0.35, tremble=0.025),
    ]),
    'V17': ('彼', [
        dict(t='そんなの', style='sad', speed=0.95, intonation=1.15, volume=0.95, tremble=0.03, gap=0.42),
        dict(t='先輩との、', style='sad', speed=0.95, intonation=1.15, volume=0.95, tremble=0.03, gap=0.1),
        dict(t='演奏が、', style='sad', speed=0.95, intonation=1.15, volume=0.98, tremble=0.035, gap=0.1),
        dict(t='楽しかったからに', style='sad', speed=0.93, intonation=1.2, volume=1.0, tremble=0.04, gap=0.5),
        dict(t='決まってるだろ', style='sad', speed=0.9, intonation=1.0, volume=0.95, tremble=0.04, drop=0.06, breathy=0.15),
    ]),
    'V18': ('先輩', [
        dict(t='左手、見せて', speed=0.9, intonation=1.15, volume=0.84, breathy=0.12),
    ]),
}


def query(text, sid):
    return json.loads(_post('/audio_query', {'text': text, 'speaker': sid}))


def shape(q, p, k0=0):
    """Edit mora pitches: tremble (deterministic wobble), lift/drop on the last voiced mora."""
    moras = [m for ap in q['accent_phrases'] for m in ap['moras'] if m['pitch'] > 0]
    tr = p.get('tremble', 0.0)
    for i, m in enumerate(moras):
        if tr:
            m['pitch'] += tr * np.sin(1.9 * (i + k0) + 0.7) * (0.6 + 0.4 * np.sin(0.83 * i))
    if moras:
        if p.get('lift'):
            moras[-1]['pitch'] += p['lift']
        if p.get('drop'):
            moras[-1]['pitch'] -= p['drop']
            if len(moras) > 1:
                moras[-2]['pitch'] -= p['drop'] * 0.4
    return q


def synth_phrase(speaker, p, k0=0):
    cast = CAST_VV[speaker]
    sid = cast.get(p.get('style', 'default'), cast['default'])
    q = query(p['t'], sid)
    q = shape(q, p, k0)
    q['speedScale'] = p.get('speed', 1.0)
    q['pitchScale'] = p.get('pitch', 0.0)
    q['intonationScale'] = p.get('intonation', 1.0)
    q['volumeScale'] = p.get('volume', 1.0)
    if 'pause' in p:
        q['pauseLengthScale'] = p['pause']
    q['prePhonemeLength'] = 0.04
    q['postPhonemeLength'] = 0.06
    q['outputSamplingRate'] = 48000
    q['outputStereo'] = False
    wav = _post('/synthesis', {'speaker': sid}, q)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        f.write(wav); path = f.name
    x = dsp.mono(dsp.load(path)); os.unlink(path)
    x = trim(x[:, None] if x.ndim == 1 else x, thresh_db=-45, pad=0.02)
    x = dsp.mono(x)
    if p.get('breathy'):
        x = breathy(x, p['breathy'])
    return x


def lpc(frame, order):
    r = np.correlate(frame, frame, 'full')[len(frame) - 1: len(frame) + order]
    if r[0] <= 1e-9:
        return np.zeros(order + 1), 0.0
    a = np.zeros(order + 1); a[0] = 1.0; e = r[0]
    for i in range(1, order + 1):
        k = -(r[i] + np.dot(a[1:i], r[i - 1:0:-1])) / e
        a[1:i + 1] = a[1:i + 1] + k * np.concatenate([a[i - 1:0:-1], [1.0]])
        e *= (1 - k * k)
        if e <= 0:
            break
    return a, max(e, 0.0)


def breathy(x, amount, order=32):
    """Mix in an LPC whisper (same spectral envelope, noise excitation): breath and hoarseness."""
    n = 1024; hop = 256; win = np.hanning(n)
    rng = np.random.default_rng(7)
    out = np.zeros(len(x) + n)
    norm = np.zeros(len(x) + n)
    xp = np.concatenate([x, np.zeros(n)])
    for s in range(0, len(x), hop):
        fr = xp[s:s + n] * win
        a, e = lpc(fr, order)
        if not a.any():
            continue
        g = np.sqrt(e / n)
        y = lfilter([g], a, rng.standard_normal(n)) * win
        out[s:s + n] += y; norm[s:s + n] += win ** 2
    w = out[:len(x)] / np.maximum(norm[:len(x)], 1e-3)
    w = dsp.mono(dsp.highpass(w[:, None], 700))
    # match loudness of the voiced take, then crossfade
    rx = np.sqrt(np.mean(x ** 2)) + 1e-9; rw = np.sqrt(np.mean(w ** 2)) + 1e-9
    w *= rx / rw
    return (1 - amount) * x + amount * 0.9 * w


def polish(x):
    x = x[:, None] if x.ndim == 1 else x
    x = dsp.highpass(x, 85)
    x = dsp.eq(x, [('peak', 250, 1.0, -1.5), ('peak', 3200, 0.9, 1.5), ('highshelf', 9000, 0.7, 1.0)])
    x = dsp.compress(x, thresh_db=-24, ratio=2.2, attack=0.008, release=0.12, makeup_db=4)
    x = dsp.fade(x, 0.008, 0.05)
    rms = np.sqrt(np.mean(dsp.mono(x) ** 2)) + 1e-9
    return (x * (dsp.db(-21) / rms)).astype(np.float32)


def render_line(lid, speaker, phrases, max_dur, scale=1.0):
    parts, onsets, t = [], [], 0.0
    lead = np.zeros(int(0.03 * dsp.SR))
    parts.append(lead); t += len(lead) / dsp.SR
    for k, p in enumerate(phrases):
        p = dict(p); p['speed'] = p.get('speed', 1.0) * scale
        x = synth_phrase(speaker, p, k0=3 * k)
        onsets.append(round(t, 3))
        parts.append(x); t += len(x) / dsp.SR
        if k < len(phrases) - 1:
            g = np.zeros(int(p.get('gap', 0.15) * scale ** -0.5 * dsp.SR))
            parts.append(g); t += len(g) / dsp.SR
    tail = np.zeros(int(0.12 * dsp.SR)); parts.append(tail)
    y = np.concatenate(parts)
    return polish(y), onsets


def main(only=None):
    if not vv_alive():
        sys.exit('VOICEVOX ENGINE is not running (tools/start_voicevox.sh)')
    sb = json.load(open(os.path.join(os.path.dirname(ROOT), 'pv', 'storyboard.json'), encoding='utf-8'))
    maxd = {v['id']: v.get('max_dur', 9.9) for v in sb['voice']}
    os.makedirs(OUT, exist_ok=True)
    dpath = os.path.join(OUT, 'durations.json')
    meta = {d['id']: d for d in (json.load(open(dpath)) if os.path.exists(dpath) else [])}
    for lid, (speaker, phrases) in TAKES.items():
        if only and lid not in only:
            continue
        scale = 1.0
        for _ in range(6):
            y, onsets = render_line(lid, speaker, phrases, maxd[lid], scale)
            d = len(y) / dsp.SR
            if d <= maxd[lid] - 0.02:
                break
            scale *= min(1.12, (d / (maxd[lid] - 0.05)) ** 1.1)   # speed up a little and retry
        dsp.save(os.path.join(OUT, f'{lid}.wav'), y)
        meta[lid] = {'id': lid, 'speaker': speaker, 'dur': round(d, 3), 'engine': 'voicevox',
                     'voice': CAST_VV[speaker]['name'], 'speed_scale': round(scale, 3), 'onsets': onsets,
                     'path': os.path.join(OUT, f'{lid}.wav')}
        print(f"{lid} {speaker:3s} {d:5.2f}s / max {maxd[lid]:.2f}  scale {scale:.3f}  onsets {onsets}")
    with open(dpath, 'w', encoding='utf-8') as f:
        json.dump([meta[k] for k in sorted(meta)], f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main(sys.argv[1:] or None)

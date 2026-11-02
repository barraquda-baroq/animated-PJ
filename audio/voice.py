"""Dialogue synthesis for the PV.

Two engines behind one interface:
  * 'voicevox'  — VOICEVOX ENGINE HTTP API (http://127.0.0.1:50021), used when it is running.
  * 'openjtalk' — HTS voices (mei = female via pyopenjtalk-plus, nitech m001 = male via open_jtalk CLI).
Each line: {id, speaker, text, tts_text?, delivery?, style?, speed?, pitch?, intonation?, volume?, pre?, post?}
"""
import json, os, subprocess, tempfile, urllib.request, urllib.parse
import numpy as np
import dsp

VV = 'http://127.0.0.1:50021'

# VOICEVOX casting: speaker -> default style id, plus named emotional styles
CAST_VV = {
    '先輩': {'default': 14, 'name': '冥鳴ひまり'},
    '彼': {'default': 11, 'sad': 41, 'joy': 39, 'angry': 40, 'name': '玄野武宏'},
    '叔母': {'default': 16, 'whisper': 19, 'sexy': 17, 'name': '九州そら'},
    'ミカ': {'default': 46, 'name': '小夜/SAYO'},
    'レイジ': {'default': 13, 'name': '青山龍星'},
    '委員長': {'default': 8, 'name': '春日部つむぎ'},
}
# Open JTalk fallback casting (HTS): voice, pitch shift (semitones), alpha, speed
HTS_M001 = '/usr/share/hts-voice/nitech-jp-atr503-m001/nitech_jp_atr503_m001.htsvoice'
DIC = '/var/lib/mecab/dic/open-jtalk/naist-jdic'
CAST_OJT = {
    '先輩': {'voice': 'mei', 'fm': 0.0, 'alpha': 0.55, 'speed': 0.92},
    '彼': {'voice': 'm001', 'fm': 2.5, 'alpha': 0.53, 'speed': 0.95},
    '叔母': {'voice': 'mei', 'fm': -2.5, 'alpha': 0.58, 'speed': 0.9},
    'ミカ': {'voice': 'mei', 'fm': 2.0, 'alpha': 0.53, 'speed': 1.0},
    'レイジ': {'voice': 'm001', 'fm': -1.0, 'alpha': 0.56, 'speed': 1.0},
    '委員長': {'voice': 'mei', 'fm': 1.5, 'alpha': 0.54, 'speed': 1.0},
}


def vv_alive():
    try:
        with urllib.request.urlopen(VV + '/version', timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def _post(path, params, body=None):
    url = VV + path + '?' + urllib.parse.urlencode(params)
    data = json.dumps(body).encode() if body is not None else b''
    req = urllib.request.Request(url, data=data, method='POST', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def synth_vv(line):
    cast = CAST_VV[line['speaker']]
    sid = line.get('style_id') or cast.get(line.get('style', 'default'), cast['default'])
    text = line.get('tts_text') or line['text']
    q = json.loads(_post('/audio_query', {'text': text, 'speaker': sid}))
    q['speedScale'] = line.get('speed', 1.0)
    q['pitchScale'] = line.get('pitch', 0.0)
    q['intonationScale'] = line.get('intonation', 1.0)
    q['volumeScale'] = line.get('volume', 1.0)
    q['prePhonemeLength'] = line.get('pre', 0.12)
    q['postPhonemeLength'] = line.get('post', 0.2)
    if 'pause' in line:
        q['pauseLengthScale'] = line['pause']
    q['outputSamplingRate'] = 48000
    q['outputStereo'] = False
    wav = _post('/synthesis', {'speaker': sid}, q)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        f.write(wav); path = f.name
    x = dsp.load(path); os.unlink(path)
    return x


def synth_ojt(line):
    cast = CAST_OJT[line['speaker']]
    text = (line.get('tts_text') or line['text']).replace('……', '、').replace('…', '、').replace('――', '、').replace('―', '、')
    speed = cast['speed'] * line.get('speed', 1.0)
    fm = cast['fm'] + line.get('pitch', 0.0) * 12  # VOICEVOX pitchScale ~ octaves-ish; treat as semitone/12
    jf = line.get('intonation', 1.0)
    with tempfile.TemporaryDirectory() as td:
        out = os.path.join(td, 'o.wav')
        if cast['voice'] == 'mei':
            import pyopenjtalk
            voice = os.path.join(os.path.dirname(pyopenjtalk.__file__), 'htsvoice', 'mei_normal.htsvoice')
        else:
            voice = HTS_M001
        cmd = ['open_jtalk', '-x', DIC, '-m', voice, '-ow', out, '-r', f'{speed:.3f}', '-fm', f'{fm:.2f}',
               '-a', f"{cast['alpha']:.3f}", '-jf', f'{jf:.2f}', '-s', '48000', '-p', '240']
        subprocess.run(cmd, input=text.encode('utf-8'), check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        x = dsp.load(out)
    return x * dsp.db(line.get('gain_db', 0.0))


def trim(x, thresh_db=-50, pad=0.04):
    m = np.abs(dsp.mono(x)); th = dsp.db(thresh_db) * max(1e-6, m.max())
    idx = np.where(m > th)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * dsp.SR)); b = min(len(x), idx[-1] + int(pad * 2 * dsp.SR))
    return x[a:b]


def polish(x, kind='dialogue'):
    """Broadcast-style voice chain: HPF, gentle presence, compression, level."""
    x = dsp.highpass(x, 85)
    x = dsp.eq(x, [('peak', 250, 1.0, -1.5), ('peak', 3200, 0.9, 2.0), ('highshelf', 9000, 0.7, 1.5)])
    x = dsp.compress(x, thresh_db=-24, ratio=2.5, attack=0.008, release=0.12, makeup_db=4)
    x = trim(x)
    x = dsp.fade(x, 0.01, 0.06)
    # level to roughly -20 LUFS short-term (lines are short; use RMS approximation)
    rms = np.sqrt(np.mean(dsp.mono(x) ** 2)) + 1e-9
    x = x * (dsp.db(-21) / rms)
    return x.astype(np.float32)


def synth(line, engine=None):
    engine = engine or ('voicevox' if vv_alive() else 'openjtalk')
    line = prepare_line(line)
    x = synth_vv(line) if engine == 'voicevox' else synth_ojt(line)
    return polish(x), engine


def render_all(lines, outdir, engine=None):
    os.makedirs(outdir, exist_ok=True)
    meta = []
    for ln in lines:
        x, eng = synth(ln, engine)
        path = os.path.join(outdir, f"{ln['id']}.wav")
        dsp.save(path, x)
        meta.append({'id': ln['id'], 'speaker': ln['speaker'], 'dur': round(len(x) / dsp.SR, 3), 'engine': eng, 'path': path})
    with open(os.path.join(outdir, 'durations.json'), 'w') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    return meta


# ----------------------------------------------------------------- acting direction -> synthesis params
DIRECTION_RULES = [
    # (keywords, params) — first matching rules are merged in order
    (('叫', '絶叫', '怒鳴', '強く', '激し', 'シャウト'), {'speed': 1.04, 'pitch': 0.04, 'intonation': 1.55, 'volume': 1.35, 'style': 'angry'}),
    (('泣', '嗚咽', '涙', '震え', '詰まら', '掠れ'), {'speed': 0.84, 'pitch': 0.02, 'intonation': 1.25, 'pause': 1.35}),
    (('囁', 'ささや', '小さく', '吐息', 'かすか'), {'speed': 0.86, 'intonation': 0.85, 'volume': 0.75, 'style': 'whisper'}),
    (('淡々', '平坦', '感情のない', '抑揚のない', '温度のない', '無表情'), {'intonation': 0.55, 'speed': 0.92}),
    (('優し', '柔らか', 'そっと', '慈しみ', '穏やか'), {'speed': 0.9, 'intonation': 1.1, 'pitch': -0.01}),
    (('明る', '軽', 'あっけらかん', '飄々', '笑'), {'speed': 1.02, 'intonation': 1.2, 'style': 'joy'}),
    (('悲し', '寂し', '沈ん', '切な', '痛ま'), {'speed': 0.88, 'intonation': 0.95, 'style': 'sad'}),
    (('ゆっくり', '間を', 'ためら', '躊躇'), {'speed': 0.84, 'pause': 1.4}),
    (('決意', 'きっぱり', '力強', '真っ直ぐ'), {'speed': 0.95, 'intonation': 1.15, 'volume': 1.1}),
]


def direction_params(delivery):
    out = {}
    if not delivery:
        return out
    for keys, params in DIRECTION_RULES:
        if any(k in delivery for k in keys):
            for k, v in params.items():
                out.setdefault(k, v)
    return out


def prepare_line(line):
    """Merge acting direction into explicit params (explicit values win)."""
    d = direction_params(line.get('delivery', ''))
    ln = dict(line)
    for k, v in d.items():
        if k == 'style':
            cast = CAST_VV.get(ln['speaker'], {})
            if v in cast and 'style' not in line:
                ln['style'] = v
            continue
        ln.setdefault(k, v)
    return ln

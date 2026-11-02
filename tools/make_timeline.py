"""storyboard.json (+ actual voice durations + overrides) -> pv/timeline.js and audio cue sheet.

  python3 tools/make_timeline.py
Reads:
  pv/storyboard.json                 shots / voice / music / sfx (from the storyboard team)
  pv/edit.json            (optional) director's overrides: {"shots": {"C05": {...}}, "voice": {"V03": {...}}, "texts": [...]}
  audio/voice_out/durations.json (optional) real line durations
Writes:
  pv/timeline.js, audio/cues.json
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SB = os.path.join(ROOT, 'pv', 'storyboard.json')
ED = os.path.join(ROOT, 'pv', 'edit.json')
DUR = os.path.join(ROOT, 'audio', 'voice_out', 'durations.json')


def load(p, default=None):
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    return default


def main():
    sb = load(SB)
    ed = load(ED, {}) or {}
    durs = {d['id']: d['dur'] for d in (load(DUR, []) or [])}
    shots_out, texts = [], []
    for s in sb['shots']:
        o = dict(s)
        o.update(ed.get('shots', {}).get(s['id'], {}))
        sh = {k: o[k] for k in ('id', 'start', 'end') if k in o}
        sh['renderer'] = o.get('renderer', o['id'])
        sh['transition_in'] = o.get('transition_in', 'cut')
        for k in ('transition_dur', 'post', 'grade', 'params'):
            if k in o:
                sh[k] = o[k]
        shots_out.append(sh)
        for tx in o.get('text', []) or []:
            if tx.get('type') == 'subtitle':
                continue  # subtitles come from voice lines
            t = dict(tx)
            # storyboard times may be absolute or shot-local; treat values < shot start as local
            if t.get('start', 0) < s['start'] - 0.01 or t.get('local'):
                t['start'] = s['start'] + t.get('start', 0); t['end'] = s['start'] + t.get('end', s['end'] - s['start'])
            st = t.get('style', 'center')
            t['style'] = {'vertical_right': 'vertical_right', 'vertical_left': 'vertical_left', 'center': 'center', 'bottom': 'bottom'}.get(st, st)
            if t.get('type') == 'monologue' and 'reveal' not in t:
                t['reveal'] = min(2.2, 0.09 * len(t.get('text', '')))
            if t.get('type') == 'credit' and ed.get('credit_text'):
                t['text'] = ed['credit_text']; t.pop('html', None)
            if t.get('type') == 'copy' and 'reveal' not in t:
                t['reveal'] = min(1.6, 0.08 * len(t.get('text', '')))
            texts.append(t)
    for t in ed.get('texts', []):
        texts.append(t)
    # voice subtitles
    voice = []
    for v in sb.get('voice', []):
        o = dict(v); o.update(ed.get('voice', {}).get(v['id'], {}))
        if o.get('drop'):
            continue
        d = durs.get(o['id'], o.get('max_dur', 3.0))
        o['dur'] = d
        voice.append(o)
        if o.get('subtitle', True):
            # subtitle slot follows the storyboard (max_dur), so swapping the TTS engine never needs a video re-render
            slot = max(o.get('max_dur', d), min(d, o.get('max_dur', d) + 0.6))
            texts.append({'type': 'subtitle', 'text': o.get('subtitle_text', o['text']), 'start': round(o['start'] + 0.05, 3),
                          'end': round(o['start'] + slot + o.get('sub_hold', 0.3), 3), 'speaker': o['speaker']})
    subs = sorted([t for t in texts if t['type'] == 'subtitle'], key=lambda t: t['start'])
    for t in subs:  # never run more than 0.15 s into the next shot
        sh = next((x for x in shots_out if x['start'] <= t['start'] < x['end']), None)
        if sh and t['end'] > sh['end'] + 0.15:
            t['end'] = round(sh['end'] + 0.15, 3)
    for a, b in zip(subs, subs[1:]):
        if a['end'] > b['start'] - 0.08:
            a['end'] = round(b['start'] - 0.08, 3)
    duration = sb.get('duration', shots_out[-1]['end'])
    tl = {'fps': sb.get('fps', 24), 'duration': duration, 'post': ed.get('post', {}), 'shots': shots_out, 'texts': texts}
    with open(os.path.join(ROOT, 'pv', 'timeline.js'), 'w', encoding='utf-8') as f:
        f.write('PV.timeline = ' + json.dumps(tl, ensure_ascii=False, indent=1) + ';\n')
    cues = {'duration': duration, 'voice': voice, 'music': sb.get('music', []), 'sfx': sb.get('sfx', []) + ed.get('sfx', []),
            'shots': [{'id': s['id'], 'start': s['start'], 'end': s['end']} for s in shots_out]}
    with open(os.path.join(ROOT, 'audio', 'cues.json'), 'w', encoding='utf-8') as f:
        json.dump(cues, f, ensure_ascii=False, indent=1)
    # sanity
    prev = 0.0
    for s in shots_out:
        if abs(s['start'] - prev) > 1e-3:
            print('WARN gap/overlap before', s['id'], prev, s['start'])
        prev = s['end']
    print(f"timeline.js: {len(shots_out)} shots, {len(texts)} texts, {len(voice)} voice lines, duration {duration}")


if __name__ == '__main__':
    main()

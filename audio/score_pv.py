"""Assemble the PV score from duration-fitted cue modules.

  python3 audio/score_pv.py
Reads audio/score_map.json:
  {"key_semis": 2,
   "cues": [{"id": "M1", "start": 0.0, "end": 12.0, "module": "snowstorm", "args": {...},
             "gain_db": 0, "fade_in": 0.0, "fade_out": 0.5, "lufs": -20, "lp": null, "tail": 0}],
   "events": [{"t": 33.0, "kind": "note", ...}]}     # optional one-shot musical stingers
Writes audio/out/score.wav (exact PV duration) and per-cue wavs in audio/out/cues/.
"""
import json, os, sys
import numpy as np
import dsp, cues_lib as C, sfx

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'out')

MODULES = {
    'snowstorm': lambda d, a: C.cue_snowstorm(d, a.get('sour', True)),
    'first_light': lambda d, a: C.cue_first_light(d),
    'theme': lambda d, a: C.cue_theme(d, a.get('version', 'intimate'), a.get('semis', 0), a.get('mel', 'A'), a.get('pickup', False), a.get('drums', True), a.get('vel', 1.0), a.get('fade_out', 1.5), a.get('cresc'))[0],
    'festival': lambda d, a: C.cue_festival(d),
    'competition': lambda d, a: C.cue_competition(d, a.get('bars')),
    'promise': lambda d, a: C.cue_promise(d),
    'hospital': lambda d, a: C.cue_hospital(d),
    'storm': lambda d, a: C.cue_storm(d, a.get('climax_t'), a.get('cut_after', 2.5)),
    'left_hand': lambda d, a: C.cue_left_hand(d),
    'epilogue': lambda d, a: C.cue_epilogue(d),
    'wav': lambda d, a: dsp.fit(dsp.load(a['path']), d),
    'silence': lambda d, a: dsp.silence(d),
}


def main():
    sm = json.load(open(os.path.join(ROOT, 'score_map.json'), encoding='utf-8'))
    C.KEY['semis'] = sm.get('key_semis', 0)
    dur = sm['duration']
    bus = dsp.silence(dur + 10)
    os.makedirs(os.path.join(OUT, 'cues'), exist_ok=True)
    for cue in sm['cues']:
        d = cue['end'] - cue['start']
        x = MODULES[cue['module']](d + cue.get('tail', 0.0), cue.get('args', {}))
        if cue.get('lp'):
            x = dsp.lowpass(x, cue['lp'])
        if 'lufs' in cue and dsp.loudness(x) > -70:
            x, _ = dsp.normalize_lufs(x, cue['lufs'])
        x = dsp.fade(x, cue.get('fade_in', 0.0), cue.get('fade_out', 0.0))
        dsp.save(os.path.join(OUT, 'cues', f"{cue['id']}.wav"), x)
        bus = dsp.place(bus, x, cue['start'], cue.get('gain_db', 0.0))
        print(f"{cue['id']:5s} {cue['module']:12s} {cue['start']:7.2f}-{cue['end']:7.2f}  {dsp.loudness(x) if len(x) > 4800 else -99:6.1f} LUFS")
    for ev in sm.get('events', []):
        if ev['kind'] == 'harmonic':
            x = sfx.guitar_harmonic(ev.get('f', 659.26), ev.get('dur', 4.0))
        elif ev['kind'] == 'wav':
            x = dsp.load(ev['path'])
        else:
            continue
        bus = dsp.place(bus, x, ev['t'], ev.get('gain_db', 0.0))
    bus = dsp.fit(bus, dur)
    dsp.save(os.path.join(OUT, 'score.wav'), bus)
    print('score.wav', round(len(bus) / dsp.SR, 2), 's', round(dsp.loudness(bus), 1), 'LUFS')


if __name__ == '__main__':
    main()

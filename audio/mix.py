"""Final mix: dialogue + score + SFX on one timeline -> audio/out/master.wav

Inputs
  audio/cues.json            (from tools/make_timeline.py: voice lines with start/dur, shots)
  audio/out/score.wav        (from score_pv.py, starts at t=0)
  audio/voice_out/<id>.wav   (from voice.py)
  audio/sfx_plan.json        list of {"t": sec, "fx": name, "gain": dB, "args": {...}, "pan": -1..1}
Per-line voice options (in storyboard/edit voice entries): gain_db, reverb (0..1), phone (bool), offset
"""
import json, os, sys
import numpy as np
import dsp, sfx

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'out')

FX = {
    'rain': lambda a: sfx.rain(a.get('dur', 6), a.get('intensity', 1.0), a.get('seed', 1), a.get('window', False)),
    'thunder': lambda a: sfx.thunder(a.get('dur', 6), a.get('seed', 1), a.get('crack', True), a.get('distance', 0.4)),
    'wind': lambda a: sfx.wind(a.get('dur', 5), a.get('strength', 1.0), a.get('seed', 1)),
    'waves': lambda a: sfx.waves(a.get('dur', 8), a.get('seed', 1)),
    'cicadas': lambda a: sfx.cicadas(a.get('dur', 6), a.get('seed', 1), a.get('kind', 'abura'), a.get('amount', 1.0)),
    'chime': lambda a: sfx.school_chime(a.get('seed', 1)),
    'applause': lambda a: sfx.applause(a.get('times', [0, 0.38, 0.74, 1.1]), a.get('seed', 1)),
    'boo': lambda a: sfx.crowd(a.get('dur', 4), a.get('seed', 1), 'boo', a.get('amount', 1.0)),
    'murmur': lambda a: sfx.crowd(a.get('dur', 4), a.get('seed', 1), 'murmur', a.get('amount', 1.0)),
    'snap': lambda a: sfx.string_snap(a.get('seed', 1), a.get('amp', True)),
    'ecg': lambda a: sfx.ecg_track(a.get('dur', 4), a.get('bpm', 72), f=a.get('f', 1000.0), start=a.get('start', 0.2), dur=a.get('beep', 0.11)),
    'beep': lambda a: sfx.ecg_beep(),
    'heartbeat': lambda a: sfx.heartbeat(a.get('bpm', 64), a.get('beats', 3), gain=a.get('g', 1.0)),
    'horn': lambda a: sfx.ship_horn(a.get('dur', 3.5), f=a.get('f', 98.0)),
    'impact': lambda a: sfx.impact(a.get('seed', 1), a.get('dur', 4.0)),
    'sub': lambda a: sfx.sub_boom(a.get('dur', 3.0)),
    'riser': lambda a: sfx.riser(a.get('dur', 3.0), a.get('seed', 1)),
    'swell': lambda a: sfx.reverse_swell(a.get('dur', 2.0), a.get('seed', 1)),
    'braam': lambda a: sfx.braam(a.get('dur', 4.0), a.get('f', 55.0)),
    'tinnitus': lambda a: sfx.tinnitus(a.get('dur', 3.0), a.get('f', 5200)),
    'brake': lambda a: sfx.brake_screech(a.get('dur', 1.4)),
    'hum': lambda a: sfx.hum(a.get('dur', 3.0), amount=a.get('amount', 1.0)),
    'heels': lambda a: sfx.heels(a.get('times', [0, 0.32, 0.64, 0.96, 1.28])),
    'wav': lambda a: dsp.load(a['path'] if a['path'].startswith('/') else os.path.join(ROOT, a['path'])),
    'drip': lambda a: sfx.drip(a.get('seed', 1), a.get('f0', 1400)),
    'sparkle': lambda a: sfx.sparkle(a.get('seed', 1), a.get('dur', 1.0)),
    'breath': lambda a: sfx.breath(a.get('kind', 'in'), a.get('dur', 0.5), a.get('seed', 1)),
    'cloth': lambda a: sfx.cloth(a.get('dur', 0.8), a.get('seed', 1)),
    'shutter': lambda a: sfx.shutter(),
    'notify': lambda a: sfx.notify(),
    'train': lambda a: sfx.train(a.get('dur', 3.0), a.get('seed', 1)),
    'tick': lambda a: sfx.tick(a.get('times', [0, 1, 2])),
    'clip': lambda a: sfx.clip(),
    'pen': lambda a: sfx.pen(a.get('dur', 1.4)),
    'door': lambda a: sfx.door(),
    'tap': lambda a: sfx.tap(),
    'cough': lambda a: sfx.cough(),
    'birds': lambda a: sfx.birds(a.get('dur', 2.2)),
    'car_horn': lambda a: sfx.car_horn(a.get('dur', 0.5)),
    'river': lambda a: sfx.river(a.get('dur', 4.0)),
    'room_tone': lambda a: sfx.room_tone(a.get('dur', 4.0)),
    'kids': lambda a: sfx.kids(a.get('dur', 1.2)),
    'shop_music': lambda a: sfx.shop_music(a.get('dur', 1.2)),
    'harmonic': lambda a: sfx.guitar_harmonic(a.get('f', 659.26), a.get('dur', 4.0)),
}


def build_sfx(plan, dur):
    bus = dsp.silence(dur + 8)
    for ev in plan:
        x = FX[ev['fx']](ev.get('args', {}))
        if 'trim' in ev:
            x = x[int(ev['trim'][0] * dsp.SR): int(ev['trim'][1] * dsp.SR)]
        if ev.get('curve'):
            x = x * dsp.gain_curve(len(x), ev['curve'])[:, None]
        if ev.get('reverb'):
            x = dsp.reverb(x, rt60=ev['reverb'].get('rt60', 1.5), wet=ev['reverb'].get('wet', 0.3))
        if ev.get('fade'):
            x = dsp.fade(x, *ev['fade'])
        if ev.get('lp'):
            x = dsp.lowpass(x, ev['lp'])
        if 'pan' in ev:
            x = dsp.pan(dsp.mono(x), ev['pan'])
        if ev.get('phone'):
            x = dsp.phone_speaker(x)
        bus = dsp.place(bus, x, ev['t'], ev.get('gain', 0.0))
    return bus


def build_voice(lines, dur):
    dry = dsp.silence(dur + 8)
    for v in lines:
        path = os.path.join(ROOT, 'voice_out', f"{v['id']}.wav")
        if not os.path.exists(path):
            print('missing voice', v['id']); continue
        x = dsp.load(path)
        if v.get('phone'):
            x = dsp.phone_speaker(x)
        if v.get('lp'):
            x = dsp.lowpass(x, v['lp'])
        rv = v.get('reverb', 0.18)
        if rv > 0:
            x = dsp.reverb(x, rt60=v.get('rt60', 1.1), wet=rv, predelay=0.015, hp=200)
        dry = dsp.place(dry, x, v['start'] + v.get('offset', 0.0), v.get('gain_db', 0.0))
    return dry


def main():
    cues = json.load(open(os.path.join(ROOT, 'cues.json'), encoding='utf-8'))
    dur = cues['duration']
    planfile = json.load(open(os.path.join(ROOT, 'sfx_plan.json'), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, 'sfx_plan.json')) else {}
    plan = planfile.get('events', []) if isinstance(planfile, dict) else planfile
    global plan_silence
    plan_silence = planfile.get('silence', []) if isinstance(planfile, dict) else []
    score = dsp.load(os.path.join(OUT, 'score.wav')) if os.path.exists(os.path.join(OUT, 'score.wav')) else dsp.silence(dur)
    score = dsp.fit(score, dur + 8)
    voice = build_voice(cues['voice'], dur)
    fx = build_sfx(plan, dur)
    n = int((dur + 0.5) * dsp.SR)
    score, voice, fx = score[:n], voice[:n], fx[:n]
    score_d = dsp.duck(score, voice, depth_db=-6.5, attack=0.05, release=0.5, thresh=0.02)
    # exact digital-silence windows (storyboard): zero every bus
    for (a, b) in plan_silence:
        i0, i1 = int(a * dsp.SR), int(b * dsp.SR)
        for x in (score_d, voice, fx):
            x[i0:i1] = 0
    # stems for inspection
    os.makedirs(OUT, exist_ok=True)
    for name, x in (('stem_voice', voice), ('stem_score', score_d), ('stem_sfx', fx)):
        dsp.save(os.path.join(OUT, name + '.wav'), x)
    mix = score_d * dsp.db(-1.5) + fx * dsp.db(-2.0) + voice * dsp.db(1.5)
    mix = dsp.eq(mix, [('highpass', 0, 0, 0)] if False else [('lowshelf', 90, 0.7, 1.0), ('highshelf', 11000, 0.7, 1.0)])
    mix = dsp.compress(mix, thresh_db=-16, ratio=1.8, attack=0.02, release=0.25, makeup_db=0)
    mix, lv = dsp.normalize_lufs(mix, -14.5)
    mix = dsp.fast_limiter(mix, -1.2)
    for (a, b) in plan_silence:
        mix[int(a * dsp.SR): int(b * dsp.SR)] = 0
    dsp.save(os.path.join(OUT, 'master.wav'), mix)
    print(f'master: {len(mix)/dsp.SR:.2f}s  pre-norm {lv:.1f} LUFS -> {dsp.loudness(mix):.1f} LUFS, peak {dsp.peak_db(mix):.1f} dBFS')


if __name__ == '__main__':
    main()

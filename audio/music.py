"""Tiny score-writing toolkit: write notes in beats, export per-instrument MIDI stems,
render them with FluidSynth (MuseScore General Full soundfont), return 48 kHz stereo arrays."""
import os, subprocess, re
import numpy as np
import mido
import dsp

SF = '/usr/share/sounds/sf3/MuseScore_General_Full.sf3'
TPB = 960
NOTE_RE = re.compile(r'^([A-Ga-g])([#b]*)(-?\d)$')
BASE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def p(name):
    """'C4' -> 60, 'F#5' -> 78, 'Bb3' -> 58; ints pass through."""
    if isinstance(name, (int, np.integer)):
        return int(name)
    m = NOTE_RE.match(name.strip())
    if not m:
        raise ValueError(name)
    l, acc, octv = m.groups()
    v = BASE[l.upper()] + acc.count('#') - acc.count('b')
    return 12 * (int(octv) + 1) + v


def chord(*names):
    return [p(n) for n in names]


class Track:
    def __init__(self, name, program, bank=0, channel=0, vol=100, pan=64, drums=False):
        self.name, self.program, self.bank, self.channel = name, program, bank, channel
        self.vol, self.pan, self.drums = vol, pan, drums
        self.events = []  # (beat, kind, data)


class Score:
    def __init__(self, bpm=80.0, seed=7):
        self.tempo = [(0.0, float(bpm))]
        self.tracks = {}
        self.rng = np.random.default_rng(seed)

    # ---------------- tempo
    def set_tempo(self, beat, bpm):
        self.tempo.append((float(beat), float(bpm)))
        self.tempo.sort()

    def ramp_tempo(self, b0, b1, bpm0, bpm1, steps=8):
        for k in range(steps + 1):
            f = k / steps
            self.set_tempo(b0 + (b1 - b0) * f, bpm0 + (bpm1 - bpm0) * f)

    def beat_to_sec(self, beat):
        s = 0.0
        tm = self.tempo
        for i, (b, bpm) in enumerate(tm):
            nb = tm[i + 1][0] if i + 1 < len(tm) else None
            if nb is not None and beat > nb:
                s += (nb - b) * 60 / bpm
            else:
                s += (beat - b) * 60 / bpm
                return s
        return s

    def sec_to_beat(self, sec):
        lo, hi = 0.0, 4000.0
        for _ in range(60):
            mid = (lo + hi) / 2
            if self.beat_to_sec(mid) < sec:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2

    # ---------------- content
    def track(self, name, program, bank=0, vol=100, pan=64, drums=False):
        ch = 9 if drums else len([t for t in self.tracks.values() if not t.drums]) % 16
        if not drums and ch == 9:
            ch = 10
        t = Track(name, program, bank, ch, vol, pan, drums)
        self.tracks[name] = t
        return t

    def note(self, tn, beat, dur, pitch, vel=80, human=0.012, vh=4):
        t = self.tracks[tn]
        jit = self.rng.normal(0, human) if human else 0.0  # beats
        v = int(np.clip(vel + (self.rng.normal(0, vh) if vh else 0), 1, 127))
        b0 = max(0.0, beat + jit)
        t.events.append((b0, 'on', (p(pitch), v)))
        t.events.append((b0 + max(0.02, dur), 'off', (p(pitch), 0)))

    def notes(self, tn, beat, dur, pitches, vel=80, roll=0.0, human=0.012):
        for k, pp in enumerate(pitches):
            self.note(tn, beat + k * roll, dur - k * roll, pp, vel, human)

    def cc(self, tn, beat, num, val):
        self.tracks[tn].events.append((float(beat), 'cc', (num, int(np.clip(val, 0, 127)))))

    def cc_ramp(self, tn, b0, b1, num, v0, v1, steps=16):
        for k in range(steps + 1):
            f = k / steps
            self.cc(tn, b0 + (b1 - b0) * f, num, v0 + (v1 - v0) * f)

    def pedal(self, tn, b0, b1):
        self.cc(tn, b0 + 0.02, 64, 127)
        self.cc(tn, b1 - 0.02, 64, 0)

    def pitchbend(self, tn, beat, val):
        self.tracks[tn].events.append((float(beat), 'pb', int(val)))

    # ---------------- export
    def _tempo_track(self):
        tr = mido.MidiTrack()
        last = 0
        for b, bpm in self.tempo:
            tick = int(round(b * TPB))
            tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm), time=tick - last))
            last = tick
        return tr

    def export_track(self, name, path):
        t = self.tracks[name]
        mf = mido.MidiFile(ticks_per_beat=TPB)
        mf.tracks.append(self._tempo_track())
        tr = mido.MidiTrack(); mf.tracks.append(tr)
        ch = t.channel
        head = [(0.0, 'cc', (0, t.bank)), (0.0, 'cc', (32, 0)), (0.0, 'prog', t.program), (0.0, 'cc', (7, t.vol)), (0.0, 'cc', (10, t.pan)), (0.0, 'cc', (11, 127))]
        order = {'prog': 0, 'cc': 1, 'pb': 1, 'off': 2, 'on': 3}
        evs = sorted(head + t.events, key=lambda e: (e[0], order[e[1]]))
        last = 0
        for b, kind, d in evs:
            tick = int(round(b * TPB)); dt = max(0, tick - last); last = max(last, tick)
            if kind == 'on':
                tr.append(mido.Message('note_on', channel=ch, note=d[0], velocity=d[1], time=dt))
            elif kind == 'off':
                tr.append(mido.Message('note_off', channel=ch, note=d[0], velocity=0, time=dt))
            elif kind == 'cc':
                tr.append(mido.Message('control_change', channel=ch, control=d[0], value=d[1], time=dt))
            elif kind == 'prog':
                tr.append(mido.Message('program_change', channel=ch, program=d, time=dt))
            elif kind == 'pb':
                tr.append(mido.Message('pitchwheel', channel=ch, pitch=int(np.clip(d, -8192, 8191)), time=dt))
        mf.save(path)

    def render(self, name, outdir, gain=0.55, tail=6.0):
        os.makedirs(outdir, exist_ok=True)
        mid = os.path.join(outdir, f'{name}.mid'); wav = os.path.join(outdir, f'{name}.wav')
        self.export_track(name, mid)
        subprocess.run(['fluidsynth', '-ni', '-q', '-g', str(gain), '-r', '48000', '-R', '0', '-C', '0',
                        '-o', 'synth.polyphony=512', '-F', wav, SF, mid], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return dsp.load(wav)


# ---------------------------------------------------------------- helpers for writing music
def arpeggio(score, tn, beat, beats, pitches, step=0.5, vel=60, legato=1.6, accent_first=8, human=0.01):
    """Repeat an arpeggio pattern over `beats` beats."""
    n = int(round(beats / step))
    for k in range(n):
        pp = pitches[k % len(pitches)]
        score.note(tn, beat + k * step, step * legato, pp, vel + (accent_first if k % len(pitches) == 0 else 0), human)


def melody(score, tn, beat, seq, vel=78, human=0.01, legato=0.98):
    """seq: list of (pitch or None for rest, dur_beats[, vel]). Returns end beat."""
    b = beat
    for item in seq:
        pitch, dur = item[0], item[1]
        v = item[2] if len(item) > 2 else vel
        if pitch is not None:
            if isinstance(pitch, (list, tuple)):
                for pp in pitch:
                    score.note(tn, b, dur * legato, pp, v, human)
            else:
                score.note(tn, b, dur * legato, pitch, v, human)
        b += dur
    return b

"""Lo-fi phone recording of the school-festival duo (novel ch.14):
D major overdrive blast -> crunch chords -> thin keyboard playing Bach's Air -> a string snaps -> boos -> gritty blues bend."""
import numpy as np, dsp, sfx, music, themes
from music import p

S = music.Score(bpm=72, seed=21)
S.track('gtr_od', 29, vol=100, pan=58)     # overdrive guitar
S.track('gtr_cr', 29, vol=78, pan=70)      # crunchier backing (lower gain via velocity)
S.track('keys', 2, vol=100, pan=50)        # 'Electric Grand' = cheap keyboard piano sound
S.track('keys_lh', 2, vol=80, pan=50)
# 0.0 - 2.4 s : the blast (let ring)
themes.dmajor_blast(S, 'gtr_od', 0.0, dur=2.9*72/60, vel=120)
# 2.5 s -> Air bars 1-2 (8 s): keyboard melody (stiff, thin) + continuo bass in the left hand, guitar crunch chords
b0 = 3.1*72/60
air = themes.AIR_MELODY[:10]
music.melody(S, 'keys', b0, [(m[0], m[1], 82) for m in air], human=0.0)
for i, q in enumerate(themes.AIR_BASS[:16]):
    S.note('keys_lh', b0 + i * 0.5, 0.48, q, 64, human=0.0)
for k, chord in enumerate([['D3', 'A3', 'D4', 'F#4'], ['A2', 'E3', 'A3', 'C#4'], ['B2', 'F#3', 'B3', 'D4'], ['F#2', 'C#3', 'F#3', 'A3'],
                           ['G2', 'D3', 'G3', 'B3'], ['E2', 'B2', 'E3', 'G#3'], ['A2', 'E3', 'A3', 'C#4'], ['A2', 'E3', 'G3', 'C#4']]):
    S.notes('gtr_cr', b0 + k * 1.0, 0.95, [p(x) for x in chord], vel=60, roll=0.012)
# 10.6 s : string snaps (sfx). 11.4 s : gritty blues bend + vibrato on the B string
BL = 9.3*72/60
S.note('gtr_od', BL, 3.2, 'B4', 112)
S.pitchbend('gtr_od', BL, 0)
for k in range(1, 9):
    S.pitchbend('gtr_od', BL + k * 0.05, int(4096 * k / 8))
for k in range(34):
    S.pitchbend('gtr_od', BL + 0.6 + k * 0.08, int(4096 + 900 * np.sin(k * 1.4)))
S.pitchbend('gtr_od', BL + 3.4, 0)

stems = {n: S.render(n, '/tmp/claude-0/fest') for n in S.tracks}
L = int(15.0 * dsp.SR)
band = np.zeros((L, 2), np.float32)
for n, x in stems.items():
    x = dsp.fit(x, 15.0)
    g = {'gtr_od': 1.0, 'gtr_cr': 0.55, 'keys': 0.85, 'keys_lh': 0.55}[n]
    if n in ('gtr_cr', 'keys', 'keys_lh'):
        x = x * dsp.gain_curve(len(x), [(0, 0), (8.44, 0), (8.6, -40), (15, -40)])[:, None]
    band += x * g
band = dsp.place(band, sfx.string_snap(seed=4), 8.44, gain_db=3)[:L]
# the string snaps mid-phrase: everything sustained cuts short
cut = dsp.gain_curve(L, [(0, 0), (8.44, 0), (8.5, -30), (9.25, -30), (9.3, 0), (15, 0)])
crowd = sfx.crowd(15.0, seed=12, mood='boo', amount=1.0)[:L]
cg = dsp.gain_curve(L, [(0, -9), (2.9, -16), (8.4, -14), (8.8, -2), (15.0, -4)])
mix = band + crowd * cg[:, None] * 2.0
mix = dsp.reverb(mix, rt60=2.0, wet=0.45, predelay=0.03)[:L]      # school gym
lofi = dsp.tape_wobble(dsp.phone_speaker(mix), depth=0.0012, rate=0.9)
lofi, _ = dsp.normalize_lufs(lofi, -20)
dsp.save('assets/festival_recording_phone.wav', dsp.fast_limiter(lofi, -2))
full, _ = dsp.normalize_lufs(mix, -18)
dsp.save('assets/festival_recording_full.wav', dsp.fast_limiter(full, -1.5))
print('festival recording 15.0 s: blast 0-2.9, Air 3.1-8.44, snap 8.44, blues 9.3-12.7')

"""Thematic material for the PV score (original composition).

Main theme "Session" (D major): her voice = piano melody, his voice = fingerpicked guitar.
Motifs
  NE (ねえ)      : rising sixth A4 -> F#5, the question that opens the theme.
  ANSWER         : his descending guitar fill D5 C#5 A4 | B4 A4 F#4.
  RIGHT_HAND     : the theme's first bar played by the left hand alone, low, in D minor (the lost right hand).
All functions write into a music.Score at a beat offset and return the end beat.
"""
import numpy as np
from music import p, melody, arpeggio

# ----------------------------------------------------------------- harmony (one chord per 4 beats unless split)
# each bar: list of (beats, bass, [upper chord tones])
PROG_A = [
    [(4, 'D2', ['D3', 'A3', 'F#4'])],
    [(4, 'C#2', ['A2', 'E3', 'A3', 'C#4'])],
    [(4, 'B1', ['B2', 'F#3', 'A3', 'D4'])],
    [(4, 'G1', ['G2', 'D3', 'F#3', 'B3'])],
    [(4, 'E2', ['E3', 'B3', 'D4', 'G4'])],
    [(2, 'A1', ['A2', 'E3', 'D4']), (2, 'A1', ['A2', 'E3', 'C#4', 'G4'])],
    [(2, 'F#2', ['F#3', 'A3', 'D4']), (2, 'G2', ['G3', 'B3', 'E4'])],
    [(2, 'A1', ['A2', 'E3', 'D4']), (2, 'A1', ['A2', 'E3', 'C#4'])],
]
PROG_A2 = PROG_A[:6] + [
    [(2, 'G2', ['G3', 'B3', 'D4']), (2, 'A2', ['A3', 'C#4', 'E4'])],
    [(4, 'D2', ['D3', 'A3', 'F#4'])],
]

MEL_A = [
    ('F#5', 1.5), ('E5', 0.5), ('D5', 1), ('A4', 1),
    ('C#5', 1.5), ('D5', 0.5), ('E5', 2),
    ('F#5', 1.5), ('E5', 0.5), ('D5', 1), ('F#5', 1),
    ('B5', 2), ('A5', 1), ('F#5', 0.5), ('E5', 0.5),
    ('G5', 1.5), ('F#5', 0.5), ('E5', 1), ('D5', 1),
    ('E5', 3), ('A4', 1),
    ('F#5', 1), ('A5', 1), ('G5', 1), ('F#5', 0.5), ('E5', 0.5),
    ('E5', 3), (None, 1),
]
MEL_A2 = [
    ('F#5', 1.5), ('E5', 0.5), ('D5', 1), ('A4', 1),
    ('C#5', 1.5), ('D5', 0.5), ('E5', 1), ('A5', 1),
    ('A5', 1.5), ('G5', 0.5), ('F#5', 1), ('E5', 0.5), ('F#5', 0.5),
    ('B5', 1.5), ('A5', 0.5), ('F#5', 1), ('D5', 1),
    ('G5', 1.5), ('F#5', 0.5), ('E5', 1), ('B4', 1),
    ('C#5', 1), ('E5', 1), ('A5', 2),
    ('B5', 1.5), ('A5', 0.5), ('G5', 1), ('F#5', 0.5), ('E5', 0.5),
    ('D5', 4),
]
NE = [(None, 3), ('A4', 1)]           # pickup bar into the theme
ANSWER = [('D5', 0.5), ('C#5', 0.5), ('A4', 1), ('B4', 0.5), ('A4', 0.5), ('F#4', 1)]


def transpose_seq(seq, semis):
    out = []
    for it in seq:
        if it[0] is None:
            out.append(it)
        else:
            out.append((p(it[0]) + semis,) + tuple(it[1:]))
    return out


def transpose_prog(prog, semis):
    return [[(b, p(bs) + semis, [p(x) + semis for x in up]) for (b, bs, up) in bar] for bar in prog]


# ----------------------------------------------------------------- accompaniment writers
def piano_lh(S, tn, beat, prog, vel=52, pattern='broken', pedal=True):
    b = beat
    for bar in prog:
        for (beats, bass, up) in bar:
            bp = p(bass) if not isinstance(bass, int) else bass
            ups = [p(x) if not isinstance(x, int) else x for x in up]
            if pattern == 'broken':
                tones = sorted(u for u in ups if u > bp)
                while len(tones) < 3:
                    tones.append(tones[-1] + 12 if tones else bp + 12)
                seq = [bp, tones[0], tones[1], tones[2]]
                n = int(beats * 2)
                for k in range(n):
                    S.note(tn, b + k * 0.5, 0.9 if k else beats, seq[k % len(seq)], vel + (10 if k == 0 else 0))
            elif pattern == 'block':
                S.note(tn, b, beats, bp, vel + 6)
                for u in ups:
                    S.note(tn, b + 0.02, beats, u, vel - 6)
            elif pattern == 'pulse':  # repeated chords (Waldstein-like heartbeat)
                for k in range(int(beats * 2)):
                    for u in [bp] + ups[:2]:
                        S.note(tn, b + k * 0.5, 0.45, u, vel + (6 if k % 2 == 0 else 0))
            if pedal:
                S.pedal(tn, b, b + beats)
            b += beats
    return b


def guitar_pick(S, tn, beat, prog, vel=56, octave=0):
    """Fingerpicked steel-string pattern (bass on 1 & 3, trebles between)."""
    b = beat
    for bar in prog:
        for (beats, bass, up) in bar:
            bp = (p(bass) if not isinstance(bass, int) else bass) + 12 + octave
            while bp < 40:
                bp += 12
            ups = sorted([(p(x) if not isinstance(x, int) else x) for x in up])
            tre = [u for u in ups if u >= 52][:3] or [u + 12 for u in ups][:3]
            while len(tre) < 3:
                tre.append(tre[-1] + 5)
            mids = [u for u in ups if bp < u < tre[0]]
            alt = mids[0] if mids else bp
            pat = [bp, tre[0], tre[1], tre[2], alt, tre[1], tre[2], tre[1]]
            n = int(beats * 2)
            for k in range(n):
                S.note(tn, b + k * 0.5, 1.6, pat[k % 8], vel + (8 if k % 4 == 0 else 0) - (4 if k % 2 else 0), human=0.008)
            b += beats
    return b


def strings_pad(S, tn, beat, prog, vel=50, top=True, oct_shift=12):
    b = beat
    for bar in prog:
        for (beats, bass, up) in bar:
            bp = p(bass) if not isinstance(bass, int) else bass
            ups = [(p(x) if not isinstance(x, int) else x) for x in up]
            S.note(tn, b, beats, bp + 12, vel)
            for u in ups:
                S.note(tn, b, beats, u + (oct_shift if u < 60 else 0), vel - 4)
            b += beats
    return b


def bass_line(S, tn, beat, prog, vel=70):
    b = beat
    for bar in prog:
        for (beats, bass, up) in bar:
            bp = p(bass) if not isinstance(bass, int) else bass
            while bp > 52:
                bp -= 12
            while bp < 28:
                bp += 12
            S.note(tn, b, beats * 0.5 - 0.05, bp, vel)
            S.note(tn, b + beats * 0.5, beats * 0.5 - 0.05, bp, vel - 8)
            b += beats
    return b


def drums_ballad(S, tn, beat, bars, vel=80, fill_last=True, crash_first=True):
    KICK, SNARE, HAT, RIDE, CRASH, TOM_H, TOM_L = 36, 38, 42, 51, 49, 48, 45
    for k in range(bars):
        b = beat + 4 * k
        if crash_first and k == 0:
            S.note(tn, b, 2, CRASH, vel + 10)
        S.note(tn, b, 0.5, KICK, vel); S.note(tn, b + 1.5, 0.5, KICK, vel - 14); S.note(tn, b + 2.0, 0.5, KICK, vel - 4)
        S.note(tn, b + 1, 0.5, SNARE, vel - 2); S.note(tn, b + 3, 0.5, SNARE, vel + 2)
        for e in range(8):
            S.note(tn, b + e * 0.5, 0.3, RIDE if k % 2 else HAT, vel - 24 + (8 if e % 2 == 0 else 0))
        if fill_last and k == bars - 1:
            for i, (o, d) in enumerate([(3.0, SNARE), (3.25, SNARE), (3.5, TOM_H), (3.75, TOM_L)]):
                S.note(tn, b + o, 0.25, d, vel - 6 + i * 4)
    return beat + 4 * bars


# ----------------------------------------------------------------- special cues
def snowstorm(S, tn, beat, bars=3, vel=78, sour_end=True):
    """Liszt-like 'Chasse-neige' storm in Bb minor: tremolos + chromatic descents, crescendo.
    Ends on a harsh clipped cluster (her mistakes) if sour_end."""
    prog = [('Bb1', ['Bb3', 'Db4', 'F4']), ('Gb1', ['Bb3', 'Db4', 'Gb4']), ('F1', ['A3', 'C4', 'F4']), ('Bb1', ['Bb3', 'Db4', 'E4'])]
    b = beat
    for k in range(bars):
        bass, tri = prog[k % len(prog)]
        cres = (k + 1) / bars
        # LH: rumbling octave tremolo
        lo = p(bass)
        for i in range(32):
            S.note(tn, b + i * 0.125, 0.14, lo if i % 2 == 0 else lo + 12, int(vel * 0.75 + 18 * cres * i / 32), human=0.004, vh=6)
        # RH: chord tremolo (alternate upper/lower dyads), slight random accents
        tt = [p(x) for x in tri]
        for i in range(32):
            pair = (tt[0], tt[2]) if i % 2 == 0 else (tt[1], tt[2] + 12)
            for q in pair:
                S.note(tn, b + i * 0.125, 0.13, q, int(vel * 0.7 + 30 * cres * i / 32), human=0.004, vh=8)
        # chromatic descent in octaves on beats 3-4
        top = tt[2] + 24
        for i in range(8):
            for q in (top - i, top - i - 12):
                S.note(tn, b + 2 + i * 0.25, 0.24, q, int(vel * 0.8 + 25 * cres), human=0.006)
        S.pedal(tn, b, b + 2); S.pedal(tn, b + 2, b + 4)
        b += 4
    if sour_end:
        for q in ('Bb1', 'Bb2', 'E3', 'F3', 'Bb3', 'B3', 'Db4', 'E4', 'F4', 'Gb4'):
            S.note(tn, b, 0.6, q, 118, human=0.0)
        b += 1
    return b


def left_hand_alone(S, tn, beat, vel=46, reps=1):
    """The theme's opening, D minor, low register, as if played by the left hand only."""
    seq = [('F3', 1.5), ('E3', 0.5), ('D3', 1), ('A2', 1), ('C#3', 1.5), ('D3', 0.5), ('E3', 2),
           ('F3', 1.5), ('E3', 0.5), ('D3', 1), ('F3', 1), ('Bb3', 2), ('A3', 2)]
    b = beat
    for r in range(reps):
        b0 = b
        b = melody(S, tn, b, [(x[0], x[1], vel - (4 if i % 3 else 0)) for i, x in enumerate(seq)], legato=1.15)
        # sparse low fifths underneath
        for i, (bs, at) in enumerate((('D2', 0), ('A1', 4), ('D2', 8), ('Bb1', 12))):
            S.note(tn, b0 + at, 4, bs, vel - 10)
        S.pedal(tn, b0, b0 + 8); S.pedal(tn, b0 + 8, b)
    return b


def competition_etude(S, tn, beat, bars=8, vel=64):
    """Original lento cantabile in E major, 2/4-feel written in 4/4 (melody over flowing inner 16ths)."""
    prog = [('E2', ['B2', 'E3', 'G#3']), ('B1', ['B2', 'D#3', 'A3']), ('C#2', ['C#3', 'E3', 'G#3']), ('A1', ['A2', 'E3', 'C#4']),
            ('F#2', ['A2', 'C#3', 'F#3']), ('B1', ['A2', 'D#3', 'F#3']), ('G#1', ['B2', 'E3', 'G#3']), ('B1', ['A2', 'D#3', 'F#3'])]
    mel = [('B4', 2), ('G#4', 1), ('A4', 0.5), ('B4', 0.5),
           ('C#5', 1.5), ('B4', 0.5), ('A4', 2),
           ('G#4', 1.5), ('A4', 0.5), ('B4', 1), ('E5', 1),
           ('E5', 1.5), ('D#5', 0.5), ('C#5', 2),
           ('C#5', 1.5), ('B4', 0.5), ('A4', 1), ('F#4', 1),
           ('D#5', 1.5), ('C#5', 0.5), ('B4', 1), ('A4', 1),
           ('G#4', 1), ('B4', 1), ('E5', 1.5), ('D#5', 0.5),
           ('F#5', 3), ('E5', 1)]
    b = beat
    for k in range(bars):
        bass, tri = prog[k % len(prog)]
        S.note(tn, b, 4, bass, vel - 8)
        tones = [p(x) for x in tri]
        for i in range(16):  # inner sixteenths
            S.note(tn, b + i * 0.25, 0.3, tones[(i % 3)], vel - 22 + (6 if i % 4 == 0 else 0), human=0.006, vh=3)
        S.pedal(tn, b, b + 2); S.pedal(tn, b + 2, b + 4)
        b += 4
    melody(S, tn, beat, [(m[0], m[1], vel + 10) for m in mel][: 4 * bars])
    return b


def dmajor_blast(S, tn, beat, dur=3.0, vel=120):
    """The festival opener: 'ありったけの爆音でＤメジャーのコードを鳴らす'."""
    for q in ('D2', 'A2', 'D3', 'F#3', 'A3', 'D4'):
        S.note(tn, beat, dur, q, vel, human=0.0)
        S.note(tn, beat + 0.012 * p(q) / 10, dur, q, vel - 10, human=0.0)
    return beat + dur


# ----------------------------------------------------------------- arrangements of the main theme
CELLO_COUNTER = [('D3', 2), ('C#3', 2), ('B2', 2), ('A2', 2), ('G2', 2), ('F#2', 2), ('E2', 2), ('G2', 2),
                 ('E2', 2), ('F#2', 2), ('G2', 2), ('A2', 2), ('F#2', 2), ('G2', 2), ('A2', 3), ('A2', 1)]


def theme_intimate(S, beat, semis=0, mel='A', piano='piano', guitar='guitar', with_melody=True, vel=1.0):
    """Guitar fingerpicking + piano melody (+ light LH). 8 bars."""
    prog = transpose_prog(PROG_A if mel == 'A' else PROG_A2, semis)
    seq = transpose_seq(MEL_A if mel == 'A' else MEL_A2, semis)
    guitar_pick(S, guitar, beat, prog, vel=int(54 * vel))
    if with_melody:
        melody(S, piano, beat, [(m[0], m[1], int(76 * vel)) if m[0] is not None else m for m in seq])
        b = beat
        for bar in prog:  # soft LH roots only
            for (beats, bass, up) in bar:
                S.note(piano, b, beats, bass + 12 if isinstance(bass, int) else p(bass) + 12, int(44 * vel))
                S.pedal(piano, b, b + beats); b += beats
    return beat + 32


def theme_full(S, beat, semis=0, mel='A2', tracks=None, vel=1.0, drums=True):
    """Full climax: piano melody in octaves, guitar, strings pad + violins doubling, cello counter, bass, drums. 8 bars."""
    t = dict(piano='piano', guitar='guitar', strings='strings', violins='violins', cello='cello', bass='bass', drums='drums')
    t.update(tracks or {})
    prog = transpose_prog(PROG_A2 if mel == 'A2' else PROG_A, semis)
    seq = transpose_seq(MEL_A2 if mel == 'A2' else MEL_A, semis)
    # piano: melody in octaves (right hand) + broken LH
    melody(S, t['piano'], beat, [(m[0], m[1], int(92 * vel)) if m[0] is not None else m for m in seq])
    melody(S, t['piano'], beat, [((m[0] - 12) if m[0] is not None else None, m[1], int(74 * vel)) for m in seq])
    piano_lh(S, t['piano'], beat, prog, vel=int(60 * vel))
    guitar_pick(S, t['guitar'], beat, prog, vel=int(62 * vel))
    strings_pad(S, t['strings'], beat, prog, vel=int(62 * vel))
    melody(S, t['violins'], beat, [((m[0] + 12) if m[0] is not None else None, m[1], int(70 * vel)) for m in seq], legato=1.02)
    melody(S, t['cello'], beat, [(p(c[0]) + semis, c[1], int(72 * vel)) for c in CELLO_COUNTER], legato=1.0)
    bass_line(S, t['bass'], beat, prog, vel=int(84 * vel))
    if drums:
        drums_ballad(S, t['drums'], beat, 8, vel=int(86 * vel))
    return beat + 32


def guitar_lament(S, tn, beat, vel=104, key_semis=0):
    """Distorted guitar crying alone in the storm (E minor at key_semis=0 -> written in E minor).
    Uses pitch bends (+-2 semitone range) for wailing bends and wide vibrato."""
    phrase = [  # (pitch, beats, bend_from_semitones_below, vibrato)
        ('B4', 2.0, 1, True), ('G4', 1.0, 0, False), ('A4', 1.0, 0, False),
        ('B4', 3.0, 2, True), (None, 1.0, 0, False),
        ('D5', 2.0, 2, True), ('C5', 1.0, 0, False), ('B4', 1.0, 0, False),
        ('A4', 1.5, 0, False), ('G4', 0.5, 0, False), ('F#4', 1.0, 0, False), ('E4', 5.0, 0, True),
    ]
    b = beat
    for pitch, dur, bend, vib in phrase:
        if pitch is None:
            b += dur; continue
        pp = p(pitch) + key_semis
        S.note(tn, b, dur * 0.98, pp, vel, human=0.0)
        if bend:
            S.pitchbend(tn, b, int(-4096 * bend))
            for k in range(1, 7):
                S.pitchbend(tn, b + k * 0.06, int(-4096 * bend * (1 - k / 6)))
        else:
            S.pitchbend(tn, b, 0)
        if vib and dur >= 1.5:
            n = int((dur - 0.6) / 0.09)
            for k in range(n):
                S.pitchbend(tn, b + 0.6 + k * 0.09, int(700 * np.sin(k * 1.25)))
        b += dur
    S.pitchbend(tn, b, 0)
    return b


# ----------------------------------------------------------------- J.S. Bach, Air (BWV 1068), bars 1-4 (public domain;
# transcribed from the Mutopia Project LilyPond source bach-air-notes.ly)
AIR_MELODY = [
    ('F#5', 4.0),                                                                            # 1
    ('F#5', 0.5), ('B5', 0.25), ('G5', 0.25), ('E5', 0.25), ('D5', 0.25), ('C#5', 0.25), ('D5', 0.25), ('C#5', 1.0), ('A4', 1.0),  # 2
    ('A5', 2.0), ('A5', 0.25), ('F#5', 0.25), ('C5', 0.25), ('B4', 0.25), ('E5', 0.25), ('D#5', 0.25), ('A5', 0.25), ('G5', 0.25),  # 3
    ('G5', 2.0), ('G5', 0.25), ('E5', 0.25), ('B4', 0.25), ('A4', 0.25), ('D5', 0.25), ('C#5', 0.25), ('G5', 0.25), ('F#5', 0.25),  # 4
]
AIR_BASS = ['D3', 'D4', 'C#4', 'C#3', 'B2', 'B3', 'A3', 'A2', 'G2', 'G3', 'G#3', 'G#2', 'A2', 'A3', 'G3', 'G2',
            'F#2', 'F#3', 'E3', 'E2', 'D#2', 'D#3', 'B2', 'B3', 'E2', 'E3', 'D3', 'D2', 'C#2', 'C#3', 'A2', 'A3']


def bach_air(S, mel_tn, bass_tn, beat, vel=84, bass_vel=70, stiff=True):
    """Bars 1-4 of the Air: melody + walking octave bass (eighths)."""
    music_seq = [(m[0], m[1], vel) for m in AIR_MELODY]
    melody(S, mel_tn, beat, music_seq, human=0.0 if stiff else 0.01, legato=1.0)
    for i, q in enumerate(AIR_BASS):
        S.note(bass_tn, beat + i * 0.5, 0.48, q, bass_vel, human=0.0 if stiff else 0.01)
    return beat + 16

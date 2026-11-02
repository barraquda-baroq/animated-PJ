"""Writes audio/sfx_plan.json from the storyboard's 70 SFX notes (hand-mapped to synth functions)."""
import json, os
ROOT = os.path.dirname(os.path.abspath(__file__))

E = []


def ev(t, fx, gain=0.0, **kw):
    d = {'t': t, 'fx': fx, 'gain': gain}
    args = kw.pop('args', {})
    if args:
        d['args'] = args
    d.update(kw)
    E.append(d)


# --- C01 storm flash-forward (0.0-3.0)
ev(0.0, 'rain', -3, args={'dur': 3.1, 'intensity': 0.8, 'seed': 1}, fade=[1.0, 0.12], trim=[0, 3.02])
ev(0.9, 'thunder', -7, args={'dur': 2.0, 'seed': 3, 'crack': True, 'distance': 0.15}, trim=[0, 0.7], fade=[0, 0.3])
ev(1.5, 'thunder', -5, args={'dur': 3.0, 'seed': 5, 'crack': False, 'distance': 0.8}, trim=[0, 1.6], fade=[0.2, 0.6])
ev(2.55, 'drip', -10, args={'seed': 2})
ev(2.72, 'swell', -9, args={'dur': 0.32, 'seed': 3})
# --- C02-C06 music room
ev(3.0, 'murmur', -12, args={'dur': 4.3, 'seed': 4}, fade=[0.4, 0.8])
ev(10.0, 'room_tone', 2, args={'dur': 2.6})
ev(10.6, 'applause', -5, args={'times': [0, 0.5, 1.0], 'seed': 2})
ev(12.5, 'breath', -4, args={'kind': 'out', 'dur': 0.45, 'seed': 3})
ev(12.9, 'room_tone', 0, args={'dur': 7.0})
ev(18.6, 'cloth', -5, args={'dur': 0.9, 'seed': 6})
ev(19.95, 'swell', -12, args={'dur': 0.45, 'seed': 7})
ev(20.3, 'sparkle', -8, args={'seed': 8, 'dur': 1.2})
ev(21.25, 'sparkle', -12, args={'seed': 9, 'dur': 0.8})
ev(35.75, 'drip', -8, args={'seed': 5, 'f0': 900})
ev(36.6 - 6.0, 'chime', -16, trim=[6.0, 8.6], fade=[0.05, 0.5])   # last note of the chime arrives at 36.6
# --- C13-C14 festival
ev(40.5, 'boo', -3, args={'dur': 1.4, 'seed': 7}, trim=[0, 1.2], fade=[0.2, 0.12])
ev(42.0, 'impact', -11, args={'seed': 2, 'dur': 1.6})
ev(44.0, 'boo', -3, args={'dur': 2.6, 'seed': 9}, fade=[0.4, 0.5])
# --- C15 summer sea
ev(46.5, 'waves', -3, args={'dur': 3.2, 'seed': 5}, fade=[0.3, 0.2])
ev(46.5, 'cicadas', -7, args={'dur': 3.2, 'seed': 6, 'amount': 0.6}, fade=[0.3, 0.2])
ev(47.0, 'horn', -10, args={'dur': 2.2, 'f': 110.0})
ev(49.0, 'shutter', -5)
# --- C16-C18 competition
ev(49.5, 'tinnitus', -2, args={'dur': 1.95, 'f': 5200}, trim=[0, 1.9])
ev(49.5, 'heartbeat', -3, args={'bpm': 56, 'beats': 2})
ev(51.4, 'cough', -5)
ev(52.4, 'breath', -5, args={'kind': 'in', 'dur': 0.5, 'seed': 5})
# his remembered voice: V02 from its second phrase (「だって、…」), onset read from the takes
_d = {d['id']: d for d in json.load(open(os.path.join(ROOT, 'voice_out', 'durations.json'), encoding='utf-8'))}
_v2 = _d.get('V02', {}); _a = max(0.0, (_v2.get('onsets') or [0, 0.42])[1] - 0.03)
ev(57.2, 'wav', -10, args={'path': 'voice_out/V02.wav'}, trim=[round(_a, 3), round(_a + 2.55, 3)], lp=3500, reverb={'rt60': 2.6, 'wet': 0.6}, fade=[0.05, 0.4])
ev(59.6, 'applause', -13, args={'times': [round(0.03 * k + (k % 7) * 0.011, 3) for k in range(48)], 'seed': 11})
# --- C19 train
ev(60.0, 'train', -8, args={'dur': 3.1, 'seed': 2}, fade=[0.2, 0.3])
ev(60.3, 'notify', -9)
ev(61.6, 'drip', -14, args={'seed': 7, 'f0': 2400})
# --- C20-C22 night park
ev(63.0, 'waves', -8, args={'dur': 12.6, 'seed': 9}, fade=[0.5, 0.15])
ev(63.2, 'heels', -3, args={'times': [0, 0.36, 0.68, 0.96, 1.2, 1.4]})
ev(64.8, 'breath', -5, args={'kind': 'out', 'dur': 0.4, 'seed': 8})
# --- C23 morning, the accident
ev(75.6, 'birds', -10, args={'dur': 2.2})
ev(77.85, 'brake', 0, args={'dur': 0.75}, trim=[0, 0.65], fade=[0.04, 0.0])
ev(77.95, 'car_horn', -4, args={'dur': 0.55})
# --- C24-C25 hospital: ECG on F#5 every 0.75 s
ev(80.5, 'ecg', -4, args={'dur': 10.5, 'bpm': 80, 'f': 739.99, 'start': 0.0, 'beep': 0.1}, pan=-0.4)
ev(81.0, 'wind', -16, args={'dur': 2.6, 'strength': 0.4, 'seed': 3})
# --- C27-C32 storm
ev(95.6, 'thunder', -7, args={'dur': 2.0, 'seed': 11, 'crack': False, 'distance': 0.9}, trim=[0, 1.0], fade=[0.1, 0.3])
ev(96.0, 'thunder', -2, args={'dur': 4.0, 'seed': 13, 'crack': True, 'distance': 0.15})
ev(96.0, 'rain', 1, args={'dur': 2.8, 'intensity': 1.4, 'seed': 15}, trim=[0, 2.7], fade=[0.02, 0.08])
ev(96.0, 'wind', -4, args={'dur': 2.8, 'strength': 1.5, 'seed': 5}, trim=[0, 2.7], fade=[0.02, 0.08])
ev(98.7, 'river', -12, args={'dur': 4.0})
ev(98.7, 'tinnitus', -9, args={'dur': 3.8, 'f': 4800})
ev(102.7, 'thunder', -2, args={'dur': 4.0, 'seed': 17, 'crack': True, 'distance': 0.2})
ev(102.9, 'rain', 0, args={'dur': 20.4, 'intensity': 1.3, 'seed': 19}, curve=[[0, 0], [7.1, -5], [20.3, -5], [20.4, -60]], fade=[0.05, 0.0])
ev(103.7, 'heartbeat', -3, args={'bpm': 90, 'beats': 2})
ev(105.5, 'impact', 0, args={'seed': 3, 'dur': 3.0})
ev(105.5, 'sub', -3, args={'dur': 2.5})
ev(109.5, 'thunder', -2, args={'dur': 4.0, 'seed': 23, 'crack': True, 'distance': 0.15})
ev(110.1, 'thunder', -6, args={'dur': 3.0, 'seed': 29, 'crack': False, 'distance': 0.7})
# --- C33-C36 the cage (muffled room, a clock)
ev(123.8, 'room_tone', 4, args={'dur': 20.4}, lp=800)
ev(123.8, 'rain', -14, args={'dur': 20.4, 'intensity': 0.4, 'seed': 21}, lp=800, fade=[1.0, 0.3])
ev(124.0, 'tick', -5, args={'times': [float(k) for k in range(20)]})   # 124.0 ... 143.0; 134.0 coincides with the clip
ev(125.0, 'tinnitus', -13, args={'dur': 5.0, 'f': 6100})
ev(130.2, 'pen', -3, args={'dur': 1.4})
ev(131.8, 'drip', -11, args={'seed': 11, 'f0': 700})
ev(134.0, 'clip', -3)
ev(135.2, 'cloth', -5, args={'dur': 0.8, 'seed': 5})
ev(144.0, 'door', -7)
# --- C37-C40 the recording
ev(144.7, 'tap', 0)
ev(150.2, 'room_tone', 2, args={'dur': 4.3})
ev(161.2, 'tap', 0)
# --- C41 the world's sounds return, on the beat
ev(163.6, 'wind', -11, args={'dur': 1.6, 'strength': 0.6, 'seed': 9})
ev(164.25, 'train', -11, args={'dur': 1.6, 'seed': 4}, fade=[0.1, 0.4])
ev(165.0, 'kids', -7, args={'dur': 1.2})
ev(165.75, 'shop_music', -11, args={'dur': 1.2})
# --- C42-C44 finale
ev(167.0, 'waves', -11, args={'dur': 12.6, 'seed': 21}, fade=[0.5, 1.5])
ev(167.0, 'wind', -19, args={'dur': 12.6, 'strength': 0.3, 'seed': 11}, fade=[0.5, 1.5])

SILENCE = [[41.7, 42.0], [78.5, 80.5], [91.0, 93.6], [123.3, 123.8], [179.6, 180.0]]

with open(os.path.join(ROOT, 'sfx_plan.json'), 'w', encoding='utf-8') as f:
    json.dump({'events': E, 'silence': SILENCE}, f, ensure_ascii=False, indent=1)
print(len(E), 'events;', len(SILENCE), 'silence windows')

/* anime.js — shared style kit for the anime-style characters (PV.anime).
 *
 * This file is the common ground for the character libraries:
 *   anime_head.js  (faces, eyes, hair, expressions, busts)    -> PV.anime.head / PV.anime.bust ...
 *   anime_body.js  (bodies, costumes, poses, two-person poses) -> PV.anime.figure ...
 * It holds the character designs (colours, proportions), the lighting palettes, the ink (line-art) helpers,
 * blink / lip-sync timing. Everything is deterministic (no Math.random / Date).
 *
 * Colour model: every material has five tones — base, shade (1st cel shadow), deep (2nd shadow / occlusion),
 * hi (highlight), line (ink). A lighting condition grades those tones and adds a rim colour:
 *   const m = PV.anime.mat('skin', 'sunset');  // {base, shade, deep, hi, line, rim, rimA, glow}
 */
(function () {
  const PV = window.PV; const A = (PV.anime = PV.anime || {});
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ------------------------------------------------------------------ character designs */
  // Heights are in head units (1 head = chin to crown). Colours are the "day" model-sheet colours.
  A.DESIGN = {
    senpai: {
      name: '先輩', age: 18, headsTall: 7.0, build: 'slim',
      hair: 'long straight blue-black, to the small of the back; see-through bangs parted slightly to her right, ' +
        'falling to the eyebrows; long side locks framing the face to the chest; ends taper in soft points',
      eyes: 'long almond eyes, slightly upturned outer corners (beauty, a little cool), long upper lashes, violet-grey irises',
      outfits: {
        uniform: 'white blouse, red 3rd-year ribbon tie at the collar, navy pleated skirt (knee length), navy socks, brown loafers',
        blazer: 'uniform + navy blazer (spring)',
        dress: 'competition: plain navy dress (cap sleeves, knee length), hair up in a low chignon, thin chain necklace, low heels',
        dress_cardigan: 'the night park: the navy dress + a pale grey cardigan, hair half come loose from the chignon',
        summer: 'white one-piece dress, wide-brimmed white hat with a navy band',
        gown: 'hospital: pale blue pyjamas, white cast + sling on the right arm',
        home: 'long-sleeved loose grey knit (the silent days)',
      },
    },
    boy: {
      name: '彼', age: 17, headsTall: 7.3, build: 'tall, thin',
      hair: 'slightly long, messy black hair; bangs fall over the eyes in uneven pointed clumps; spiky nape',
      eyes: 'narrow, sleepy-looking eyes that turn sharp when he focuses; dark brown irises; few lashes; straight brows',
      outfits: {
        uniform: 'white shirt, sleeves rolled to the forearm, loosened navy tie, charcoal trousers',
        blazer: 'uniform + navy blazer',
        tee: 'summer: white T-shirt, open light-blue shirt',
        jacket: 'night: worn dark-brown leather jacket over a black T-shirt',
        wet: 'the storm: white shirt soaked, clinging, hair flattened by rain',
      },
      guitar: 'white Stratocaster with worn paint (his mother\'s), or the music room\'s scuffed acoustic',
    },
    aunt: {
      name: '叔母', age: 40, headsTall: 7.2, build: 'slim',
      hair: 'shoulder-length dark hair tied low', eyes: 'expressionless, seeing-through gaze',
      outfits: { coat: 'long dark coat' },
    },
  };

  // base model-sheet colours: [base, shade, deep, hi, line]
  A.COLORS = {
    skin: ['#fbe4d7', '#efbcaa', '#d99686', '#fff5ee', '#86503f'],
    blush: ['#f3a29c', '#e8857f', '#d86c68', '#ffc7c0', '#b85a55'],
    lips: ['#e9a49b', '#d4847b', '#b9655d', '#f8cfc8', '#9c4f46'],
    hair_senpai: ['#262a40', '#171a2b', '#0f111d', '#56648f', '#0b0c16'],
    hair_boy: ['#27252d', '#17161c', '#0e0d12', '#5a5866', '#0a0a0e'],
    hair_aunt: ['#2d2629', '#1c1719', '#120f10', '#5e5157', '#0d0a0b'],
    iris_senpai: ['#5a4d7c', '#2e2546', '#1a1329', '#a497c9', '#140e1f'],   // base=mid, shade=top, deep=pupil, hi=bottom glow
    iris_boy: ['#5a463b', '#2c211c', '#160f0c', '#8f7464', '#120c09'],
    sclera: ['#ffffff', '#e3e6f2', '#c7cbe0', '#ffffff', '#6a5a66'],
    blouse: ['#f8f9fc', '#cdd3e4', '#aab3cb', '#ffffff', '#5e6780'],
    ribbon: ['#cf3442', '#98222f', '#6e1722', '#f06b74', '#561019'],
    skirt: ['#2e3756', '#1e2542', '#141a31', '#4a5682', '#0e1228'],
    blazer: ['#28324f', '#19213b', '#10162b', '#43507c', '#0b1024'],
    dress: ['#212a4a', '#151b36', '#0d1226', '#3d4b7e', '#090c1c'],
    cardigan: ['#d9dbe1', '#aeb3c0', '#8d93a3', '#f2f3f6', '#565b68'],
    onepiece: ['#fdfcf9', '#dcd8d0', '#c1bcb2', '#ffffff', '#7b756c'],
    hat: ['#f7f0e1', '#dccfb4', '#c2b190', '#fffaf0', '#7d6c50'],
    hatband: ['#2b3456', '#1b2140', '#11162d', '#46527c', '#0b0f22'],
    gown: ['#cfe0ee', '#a4bad0', '#8399b3', '#eaf3fa', '#4f6278'],
    cast: ['#f4f6f8', '#cbd3dd', '#aab4c2', '#ffffff', '#66707e'],
    knit: ['#9ea1aa', '#7c7f89', '#5f626c', '#c3c6ce', '#3c3e46'],
    shirt: ['#f6f7f9', '#c6ccda', '#a3abbe', '#ffffff', '#5a627a'],
    tie: ['#2a3456', '#1a2140', '#11162d', '#46527c', '#0b0f22'],
    trousers: ['#34373f', '#23252c', '#18191e', '#555963', '#101115'],
    tee: ['#f7f7f7', '#cfd2d9', '#b0b4be', '#ffffff', '#62666f'],
    jacket: ['#33291f', '#211a14', '#15100c', '#6a5848', '#0e0a07'],
    coat: ['#2a2a30', '#1b1b20', '#121216', '#4a4a54', '#0b0b0e'],
    sock: ['#232a44', '#171c33', '#0f1325', '#3c4570', '#0a0d1c'],
    shoe: ['#5b3a2a', '#3d261b', '#2a1911', '#8a5f47', '#1d110b'],
    heel: ['#1b1f30', '#11141f', '#0a0c14', '#454b66', '#06070c'],
    strat: ['#f1efe8', '#cfcabd', '#b0a994', '#ffffff', '#5b5547'],   // white Strat (worn)
    acoustic: ['#c9924f', '#9d6a33', '#734a22', '#e8b980', '#4a2d12'],
  };

  /* ------------------------------------------------------------------ lighting conditions */
  // light: colour multiplied into lit tones; shadow: colour the shadows lean toward; amb: how far everything
  // leans toward the shadow colour (0 = model sheet, 1 = silhouette); rim: rim-light colour and strength;
  // sat: saturation multiplier; dark: overall exposure (1 = as is).
  A.LIGHT = {
    day: { light: '#fff8ef', shadow: '#a79fd0', amb: 0.0, rim: '#ffffff', rimA: 0.0, sat: 1.0, dark: 1.0 },
    window: { light: '#fff1de', shadow: '#7f86b0', amb: 0.28, rim: '#fff4df', rimA: 0.95, sat: 0.9, dark: 0.86 },   // backlit by a bright window
    classroom: { light: '#fff6e8', shadow: '#9c98c4', amb: 0.08, rim: '#fff3dc', rimA: 0.45, sat: 1.0, dark: 1.0 },
    sunset: { light: '#ffc58e', shadow: '#6f4f86', amb: 0.25, rim: '#ffd79e', rimA: 1.0, sat: 1.05, dark: 0.9 },
    dusk: { light: '#e8d0ff', shadow: '#4f4a86', amb: 0.35, rim: '#ffd0b0', rimA: 0.7, sat: 0.9, dark: 0.78 },
    night: { light: '#b8c4ff', shadow: '#2c3168', amb: 0.5, rim: '#ffd59a', rimA: 0.8, sat: 0.8, dark: 0.62 },     // city lights rim
    storm: { light: '#aebbd6', shadow: '#28324c', amb: 0.55, rim: '#d6e2ff', rimA: 0.7, sat: 0.55, dark: 0.52 },
    lightning: { light: '#eef3ff', shadow: '#5c6a94', amb: 0.1, rim: '#ffffff', rimA: 1.0, sat: 0.4, dark: 1.15 },
    stage: { light: '#ffffff', shadow: '#b8c0d8', amb: 0.0, rim: '#ffffff', rimA: 0.3, sat: 0.92, dark: 1.06 },     // the white competition world
    spot: { light: '#ffe2b4', shadow: '#2c2338', amb: 0.4, rim: '#ffe6bd', rimA: 1.0, sat: 1.0, dark: 0.82 },       // gym spotlight from above
    room_gray: { light: '#e9e9ea', shadow: '#6b6e7c', amb: 0.25, rim: '#f0f0f0', rimA: 0.25, sat: 0.35, dark: 0.82 }, // the silent days
    lamp: { light: '#ffd9a8', shadow: '#2d2638', amb: 0.45, rim: '#ffcf96', rimA: 0.75, sat: 0.85, dark: 0.66 },
    hospital: { light: '#f4f9ff', shadow: '#9fb3c8', amb: 0.06, rim: '#ffffff', rimA: 0.5, sat: 0.85, dark: 1.02 },
    summer: { light: '#fffbf0', shadow: '#8f9ad0', amb: 0.02, rim: '#ffffff', rimA: 0.5, sat: 1.08, dark: 1.03 },
    golden: { light: '#fff1cf', shadow: '#a08cb6', amb: 0.08, rim: '#fff0c8', rimA: 0.8, sat: 1.02, dark: 1.02 },   // the world's sound returns
  };

  const _rgb = {};
  function rgb(h) { return _rgb[h] || (_rgb[h] = PV.hex2rgb(h)); }
  function hex(c) { return '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join(''); }
  function satAdj(c, s) { const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return c.map(v => l + (v - l) * s); }
  A.hex = hex; A.rgb = rgb;
  A.mixHex = (a, b, t) => { const p = rgb(a), q = rgb(b); return hex([lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)]); };
  A.rgbaHex = (h, a) => { const c = rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

  const _matCache = {};
  /** Graded tones of a material under a lighting condition. light may be a name or an object like A.LIGHT.day.
   *  opts.amb overrides how much the figure sits in shadow (0..1); opts.wet darkens & glosses (rain). */
  A.mat = function (material, light = 'day', opts = {}) {
    const key = material + '|' + (typeof light === 'string' ? light : JSON.stringify(light)) + '|' + (opts.amb ?? '') + '|' + (opts.wet ?? '');
    if (_matCache[key]) return _matCache[key];
    const L = typeof light === 'string' ? (A.LIGHT[light] || A.LIGHT.day) : light;
    const C = A.COLORS[material] || A.COLORS.skin;
    const amb = opts.amb ?? L.amb, wet = opts.wet || 0;
    const lc = rgb(L.light), sc = rgb(L.shadow);
    const tone = (h, isShadow, isLine) => {
      let c = rgb(h).slice();
      c = c.map((v, i) => v * lc[i] / 255);                                   // light colour
      const k = isLine ? amb * 0.5 : (isShadow ? Math.min(1, amb + 0.18) : amb);
      c = c.map((v, i) => lerp(v, v * sc[i] / 255 * 1.35, isShadow ? 0.35 : 0)); // shadows lean toward the shadow hue
      c = c.map((v, i) => lerp(v, sc[i] * (isLine ? 0.35 : 0.62), k));         // ambient: toward silhouette
      c = satAdj(c, L.sat);
      c = c.map(v => v * L.dark * (1 - wet * 0.25));
      return hex(c);
    };
    const m = {
      base: tone(C[0], false), shade: tone(C[1], true), deep: tone(C[2], true), hi: tone(C[3], false), line: tone(C[4], false, true),
      rim: L.rim, rimA: L.rimA, light: L.light, shadowCol: L.shadow, amb,
    };
    if (wet) m.hi = A.mixHex(m.hi, '#ffffff', 0.25 * wet);
    return (_matCache[key] = m);
  };

  /* ------------------------------------------------------------------ geometry helpers */
  /** Catmull-Rom resample of control points [[x,y],...] -> dense points. */
  A.spline = function (pts, closed = false, per = 8) {
    const n = pts.length; if (n < 3) return pts.slice();
    const out = [];
    const P = (i) => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  };

  /** Trace a closed smooth shape into the current path (no beginPath). */
  A.shapePath = function (ctx, pts, closed = true, per = 6) {
    const s = A.spline(pts, closed, per);
    ctx.moveTo(s[0][0], s[0][1]);
    for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]);
    if (closed) ctx.closePath();
  };

  /** Variable-width ink stroke along points (already dense, or set smooth=true to spline them).
   *  w: width at each end and middle — {w0, w1, mid} in px; or a function(u 0..1) -> px. Filled, so no stroke joins. */
  A.taper = function (ctx, pts, w, color, smooth = true) {
    const P = smooth && pts.length >= 3 ? A.spline(pts, false, 6) : pts;
    const n = P.length; if (n < 2) return;
    const wf = typeof w === 'function' ? w : (u) => {
      const w0 = w.w0 ?? 0.2, w1 = w.w1 ?? 0.2, mid = w.mid ?? Math.max(w0, w1);
      const base = lerp(w0, w1, u); return base + Math.max(0, mid - base) * Math.sin(Math.PI * u);
    };
    // arc-length parameter
    const len = [0]; for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const total = len[n - 1] || 1;
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const hw = Math.max(0, wf(len[i] / total)) / 2;
      L.push([P[i][0] - dy * hw, P[i][1] + dx * hw]); R.push([P[i][0] + dy * hw, P[i][1] - dx * hw]);
    }
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath(); ctx.fill();
  };

  /** Recommended main contour width (px) for a character whose head (chin to crown) is headPx tall on screen. */
  A.inkW = (headPx) => clamp(0.55 + headPx * 0.0105, 0.7, 4.2);

  /** Paint base fill, then shade shapes clipped to the base (cel shading). base: function(ctx) that traces a path. */
  A.cel = function (ctx, tracePath, m, shades = [], opts = {}) {
    ctx.save();
    ctx.beginPath(); tracePath(ctx); ctx.fillStyle = opts.fill || m.base; ctx.fill();
    if (shades.length) {
      ctx.clip();
      for (const s of shades) { ctx.beginPath(); s.path(ctx); ctx.fillStyle = s.col || m.shade; ctx.globalAlpha = s.a ?? 1; ctx.fill(); }
    }
    ctx.restore();
    if (opts.line) { ctx.save(); ctx.beginPath(); tracePath(ctx); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = opts.line; ctx.strokeStyle = m.line; ctx.stroke(); ctx.restore(); }
  };

  /* ------------------------------------------------------------------ timing: blinks, lip-sync, "on twos" */
  /** Hold time on N-per-second drawings (anime 'on twos' = 12). */
  A.onTwos = (T, fps = 12) => Math.floor(T * fps + 1e-6) / fps;

  /** Eyelid openness 0..1 at global time T: a blink every ~2.6-5.2 s (closing 2 frames, closed 1, opening 2). */
  A.blink = function (T, seed = 1) {
    let t = 0, k = 0;
    while (t < T + 6) {
      const gap = 2.6 + 2.6 * PV.rand1(k, seed);
      t += gap; k++;
      const d = T - t;                       // seconds since this blink started
      if (d >= 0 && d < 0.22) {
        const f = Math.floor(d * 24);        // frames 0..4
        return [0.5, 0.08, 0.0, 0.35, 0.8][Math.min(4, f)];
      }
      if (t > T) break;
    }
    return 1;
  };

  /** Lip-sync: active line at global time T for a speaker ('先輩' | '彼' | '叔母' or the design keys
   *  'senpai'|'boy'|'aunt'). Returns {open 0..1 (quantised on twos to 4 mouth drawings), id} or {open:0}. */
  const SPK = { senpai: '先輩', boy: '彼', aunt: '叔母' };
  A.mouth = function (T, who) {
    const name = SPK[who] || who; const E = PV.voiceEnv || [];
    const tq = A.onTwos(T);
    for (const e of E) {
      if (name && e.speaker !== name) continue;
      const i = Math.floor((tq - e.t0) * e.fps);
      if (i < 0 || i >= e.v.length) continue;
      const v = e.v[i];
      return { open: v < 0.12 ? 0 : v < 0.45 ? 0.33 : v < 0.75 ? 0.66 : 1, raw: v, id: e.id };
    }
    return { open: 0, raw: 0, id: null };
  };

  /** Smooth deterministic wobble for hair / cloth: sum of two noises, time in seconds. */
  A.sway = (t, seed = 0, freq = 0.5) => PV.noise2(t * freq + seed * 7.13, seed * 3.7) * 0.7 + PV.noise2(t * freq * 2.3 + 11.1, seed * 1.9) * 0.3;
})();

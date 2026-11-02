/* ============================================================================
 * PV engine core — 『キミの右手のアイロニー』 3-minute PV
 * Deterministic, frame-indexed renderer: Canvas2D for images, DOM for text.
 *
 *   PV.shot(id, { draw(ctx, t, d, S, env) })   register a shot renderer
 *     ctx : CanvasRenderingContext2D of a 1920x1080 layer (already cleared)
 *     t   : local time in seconds since the shot's start (may be < 0 or > d
 *           while a transition overlaps neighbouring shots)
 *     d   : shot duration in seconds
 *     S   : the shot's entry from the timeline (params live in S.params)
 *     env : { T: global time, frame, rng(seed), ... }
 *   PV.renderFrame(frameIndex)                  draws one frame (sync)
 *
 * Rules for shot code: NEVER use Math.random() or Date — use PV.rng(seed),
 * PV.noise2/3, and the time arguments so every frame is reproducible.
 * ========================================================================== */
(function () {
  'use strict';
  const PV = (window.PV = window.PV || {});
  PV.W = 1920; PV.H = 1080; PV.FPS = 24;

  /* ----------------------------------------------------------- math utils */
  const clamp = (PV.clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x));
  const lerp = (PV.lerp = (a, b, t) => a + (b - a) * t);
  PV.invLerp = (a, b, x) => clamp((x - a) / (b - a));
  PV.smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  PV.smoother = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * t * (t * (t * 6 - 15) + 10); };
  // fade in over [a,b], hold, fade out over [c,e]
  PV.window = (x, a, b, c, e) => PV.smooth(a, b, x) * (1 - PV.smooth(c, e, x));
  PV.ease = {
    linear: t => t,
    inQuad: t => t * t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: t => t * t * t,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  PV.TAU = Math.PI * 2;

  /* ------------------------------------------------------------- RNG */
  // mulberry32 — returns a function producing floats in [0,1)
  PV.rng = function (seed) {
    let a = (typeof seed === 'string' ? PV.hash(seed) : seed) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  PV.hash = function (s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  // stable pseudo-random value for integer i (and optional salt)
  PV.rand1 = (i, salt = 0) => { let x = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt | 0, 0xc2b2ae35); x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

  /* ------------------------------------------------------------- noise */
  // Simplex noise (2D/3D), seeded permutation — Stefan Gustavson's algorithm
  const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  const perm = new Uint8Array(512), permMod12 = new Uint8Array(512);
  (function seedNoise() {
    const r = PV.rng(1337); const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; permMod12[i] = perm[i] % 12; }
  })();
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  PV.noise2 = function (xin, yin) {
    let n0, n1, n2; const s = (xin + yin) * F2; const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2; const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1; if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0; if (t0 < 0) n0 = 0; else { const g = grad3[permMod12[ii + perm[jj]]]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1; if (t1 < 0) n1 = 0; else { const g = grad3[permMod12[ii + i1 + perm[jj + j1]]]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2; if (t2 < 0) n2 = 0; else { const g = grad3[permMod12[ii + 1 + perm[jj + 1]]]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * (n0 + n1 + n2); // [-1,1]
  };
  const F3 = 1 / 3, G3 = 1 / 6;
  PV.noise3 = function (xin, yin, zin) {
    let n0, n1, n2, n3; const s = (xin + yin + zin) * F3; const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3; const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) { if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } }
    else { if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3, x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0; if (t0 < 0) n0 = 0; else { const g = grad3[permMod12[ii + perm[jj + perm[kk]]]]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0 + g[2] * z0); }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1; if (t1 < 0) n1 = 0; else { const g = grad3[permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1 + g[2] * z1); }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2; if (t2 < 0) n2 = 0; else { const g = grad3[permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2 + g[2] * z2); }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3; if (t3 < 0) n3 = 0; else { const g = grad3[permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]]; t3 *= t3; n3 = t3 * t3 * (g[0] * x3 + g[1] * y3 + g[2] * z3); }
    return 32 * (n0 + n1 + n2 + n3);
  };
  // fractal brownian motion
  PV.fbm2 = (x, y, oct = 4, lac = 2, gain = 0.5) => { let a = 1, f = 1, s = 0, n = 0; for (let o = 0; o < oct; o++) { s += a * PV.noise2(x * f, y * f); n += a; a *= gain; f *= lac; } return s / n; };
  PV.fbm3 = (x, y, z, oct = 4, lac = 2, gain = 0.5) => { let a = 1, f = 1, s = 0, n = 0; for (let o = 0; o < oct; o++) { s += a * PV.noise3(x * f, y * f, z * f); n += a; a *= gain; f *= lac; } return s / n; };

  /* ------------------------------------------------------------- color */
  PV.hex2rgb = function (h) {
    h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  PV.rgba = (hex, a = 1) => { const [r, g, b] = PV.hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; };
  PV.mix = function (h1, h2, t, a = 1) {
    const c1 = PV.hex2rgb(h1), c2 = PV.hex2rgb(h2);
    return `rgba(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))},${a})`;
  };
  // multi-stop gradient helper: stops = [[0,'#hex',alpha?], ...]
  PV.linGrad = function (ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const s of stops) g.addColorStop(s[0], s.length > 2 ? PV.rgba(s[1], s[2]) : s[1]);
    return g;
  };
  PV.radGrad = function (ctx, x, y, r0, r1, stops, x1, y1) {
    const g = ctx.createRadialGradient(x, y, r0, x1 === undefined ? x : x1, y1 === undefined ? y : y1, r1);
    for (const s of stops) g.addColorStop(s[0], s.length > 2 ? PV.rgba(s[1], s[2]) : s[1]);
    return g;
  };

  /* ------------------------------------------------------------- canvases */
  PV.makeCanvas = function (w = PV.W, h = PV.H) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    return { canvas: c, ctx: c.getContext('2d') };
  };
  // cached offscreen buffers by key (re-used across frames)
  const bufCache = {};
  PV.buffer = function (key, w = PV.W, h = PV.H) {
    let b = bufCache[key];
    if (!b || b.canvas.width !== w || b.canvas.height !== h) { b = bufCache[key] = PV.makeCanvas(w, h); }
    b.ctx.setTransform(1, 0, 0, 1, 0, 0); b.ctx.globalAlpha = 1; b.ctx.globalCompositeOperation = 'source-over'; b.ctx.filter = 'none';
    return b;
  };
  // memoize expensive static artwork (e.g. a background painted once)
  const artCache = {};
  PV.cached = function (key, w, h, paint) {
    if (!artCache[key]) { const b = PV.makeCanvas(w, h); paint(b.ctx, w, h); artCache[key] = b.canvas; }
    return artCache[key];
  };

  /* ------------------------------------------------------------- shots */
  PV.shots = {};
  PV.shot = function (id, def) { PV.shots[id] = def; };

  // camera helper: apply a 2D camera (zoom about a focus point, offset, rotation)
  PV.camera = function (ctx, { zoom = 1, x = 0, y = 0, rot = 0, cx = PV.W / 2, cy = PV.H / 2 } = {}) {
    ctx.translate(cx + x, cy + y); ctx.rotate(rot); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy);
  };

  /* ------------------------------------------------------------- render */
  const DEFAULT_TRANS = { crossfade: 0.6, fade_from_black: 1.0, dip_black: 0.5, dip_white: 0.6, white_flash: 0.5, flash_cut: 0.12, fade_from_white: 1.0, cut: 0 };
  PV.transDur = function (S) { if (S.transition_dur !== undefined) return S.transition_dur; return DEFAULT_TRANS[S.transition_in || 'cut'] || 0; };

  function drawShotInto(layer, S, T, env) {
    const ctx = layer.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, PV.W, PV.H);
    const def = PV.shots[S.renderer || S.id];
    const t = T - S.start, d = S.end - S.start;
    if (!def) {
      ctx.fillStyle = '#222'; ctx.fillRect(0, 0, PV.W, PV.H);
      ctx.fillStyle = '#888'; ctx.font = '48px sans-serif'; ctx.fillText('missing shot: ' + (S.renderer || S.id), 80, 120);
      return;
    }
    ctx.save();
    try { def.draw(ctx, t, d, S, env); }
    catch (e) { ctx.restore(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#400'; ctx.fillRect(0, 0, PV.W, 200); ctx.fillStyle = '#fff'; ctx.font = '32px monospace'; ctx.fillText('ERROR ' + (S.renderer || S.id) + ': ' + e.message, 40, 100); console.error(e); }
    ctx.restore();
    // optional per-shot grade (CSS filter string) applied in place
    if (S.grade) {
      const tmp = PV.buffer('grade');
      tmp.ctx.drawImage(layer.canvas, 0, 0);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = S.grade; ctx.drawImage(tmp.canvas, 0, 0); ctx.restore();
    }
  }

  PV.renderFrame = function (frame) {
    const TL = PV.timeline; const T = frame / PV.FPS;
    const out = PV.out; const ctx = out.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, PV.W, PV.H);
    const shots = TL.shots;
    let i = shots.findIndex(s => T >= s.start && T < s.end);
    if (i < 0) i = T < shots[0].start ? 0 : shots.length - 1;
    const S = shots[i], prev = shots[i - 1], next = shots[i + 1];
    const env = { T, frame, shotIndex: i };
    const A = PV.buffer('A'), B = PV.buffer('B');
    const tin = S.transition_in || 'cut', tdur = PV.transDur(S), tt = T - S.start;
    // transitions that need the previous shot
    const nextT = next ? (next.transition_in || 'cut') : 'cut', nextDur = next ? PV.transDur(next) : 0, toNext = next ? next.start - T : 1e9;

    if (tin === 'crossfade' && prev && tt < tdur) {
      drawShotInto(B, prev, T, env); drawShotInto(A, S, T, env);
      ctx.drawImage(B.canvas, 0, 0); ctx.globalAlpha = PV.ease.sine(clamp(tt / tdur)); ctx.drawImage(A.canvas, 0, 0); ctx.globalAlpha = 1;
    } else {
      drawShotInto(A, S, T, env); ctx.drawImage(A.canvas, 0, 0);
      // entering effects on the current shot
      if (tin === 'fade_from_black' && tt < tdur) { ctx.fillStyle = `rgba(0,0,0,${1 - PV.ease.sine(clamp(tt / tdur))})`; ctx.fillRect(0, 0, PV.W, PV.H); }
      if (tin === 'fade_from_white' && tt < tdur) { ctx.fillStyle = `rgba(255,255,255,${1 - PV.ease.sine(clamp(tt / tdur))})`; ctx.fillRect(0, 0, PV.W, PV.H); }
      if (tin === 'dip_black' && tt < tdur) { ctx.fillStyle = `rgba(0,0,0,${1 - clamp(tt / tdur)})`; ctx.fillRect(0, 0, PV.W, PV.H); }
      if (tin === 'dip_white' && tt < tdur) { ctx.fillStyle = `rgba(255,255,255,${1 - PV.ease.outQuad(clamp(tt / tdur))})`; ctx.fillRect(0, 0, PV.W, PV.H); }
      if (tin === 'white_flash' && tt < tdur) { ctx.fillStyle = `rgba(255,255,255,${Math.pow(1 - clamp(tt / tdur), 2)})`; ctx.fillRect(0, 0, PV.W, PV.H); }
      if (tin === 'flash_cut' && tt < tdur) { ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(0, 0, PV.W, PV.H); }
      // leaving effects (the next shot's transition reaches back into this one)
      if (next && nextT === 'dip_black' && toNext < nextDur) { ctx.fillStyle = `rgba(0,0,0,${1 - clamp(toNext / nextDur)})`; ctx.fillRect(0, 0, PV.W, PV.H); }
      if (next && nextT === 'dip_white' && toNext < nextDur) { ctx.fillStyle = `rgba(255,255,255,${PV.ease.inQuad(1 - clamp(toNext / nextDur))})`; ctx.fillRect(0, 0, PV.W, PV.H); }
      if (next && nextT === 'white_flash' && toNext < 0.15) { ctx.fillStyle = `rgba(255,255,255,${1 - clamp(toNext / 0.15)})`; ctx.fillRect(0, 0, PV.W, PV.H); }
    }
    // global overlays painted on canvas (e.g. lightning flashes keyed by time)
    if (PV.globalOverlay) PV.globalOverlay(ctx, T, env);
    if (PV.post) PV.post(ctx, T, frame, S);
    if (PV.text && PV.text.update) PV.text.update(T, frame);
    return true;
  };

  PV.init = function () {
    const c = document.getElementById('stage');
    PV.out = { canvas: c, ctx: c.getContext('2d') };
  };
})();

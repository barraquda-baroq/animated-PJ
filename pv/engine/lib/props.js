/* ============================================================================
 * Props & daily-life library — 『キミの右手のアイロニー』PV
 * 小物と生活のアセット。すべて Canvas2D・決定論的（PV.rng / PV.noise2）。
 * Namespace: PV.lib.*      API reference: analysis/art_review/props_API.md
 *
 * Common options accepted by every prop:
 *   x, y    anchor position in px (each function documents where its anchor is)
 *   s       scale (1 = natural size, see API doc)          rot   rotation (rad)
 *   alpha   overall opacity
 *   tone    colour key of the scene: 'day' | 'warm' | 'cool' | 'rain' | 'night'
 *           | 'sunset' | 'mute' | 'white'  (or an object {amb,k,sat,hi,sh,rim,rimA})
 *   light   direction TOWARD the key light in screen space (rad). default -2.3
 *           (upper-left).  Math.PI = light from the left (window on the left).
 *   rimA    0..1 strength of the rim light on the light-facing edges (default by tone)
 *   shadow  draw the cast / contact shadow on the supporting surface (default true)
 *   ink     strength of the thin coloured outline (色トレス) 0..1
 * ========================================================================== */
(function () {
  'use strict';
  const PV = window.PV; const L = (PV.lib = PV.lib || {});
  const TAU = Math.PI * 2;
  const lerp = PV.lerp;
  const cl = (x, a, b) => (x < a ? a : x > b ? b : x);

  /* ------------------------------------------------------------ colour */
  const rgbMemo = new Map();
  function rgb(h) { let v = rgbMemo.get(h); if (!v) { v = PV.hex2rgb(h); rgbMemo.set(h, v); } return v; }
  function hex(r, g, b) { return '#' + ((1 << 24) | (cl(Math.round(r), 0, 255) << 16) | (cl(Math.round(g), 0, 255) << 8) | cl(Math.round(b), 0, 255)).toString(16).slice(1); }
  function mixH(a, b, t) { const A = rgb(a), B = rgb(b); return hex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
  const rgba = (h, a) => { const c = rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

  // Scene colour keys.  amb: ambient multiply colour, k: its strength, sat: saturation,
  // hi: specular colour, sh: cast-shadow colour, rim: rim light colour, rimA: rim strength
  const TONES = {
    day: { amb: '#ffffff', k: 0, sat: 1, hi: '#ffffff', sh: '#3a3150', rim: '#fff9ee', rimA: 0.25 },
    warm: { amb: '#ffe4bf', k: 0.28, sat: 1.04, hi: '#fffaf0', sh: '#55344a', rim: '#ffe6b4', rimA: 0.55 },
    cool: { amb: '#e2ecf7', k: 0.24, sat: 0.88, hi: '#f8fcff', sh: '#33405f', rim: '#f0f7ff', rimA: 0.45 },
    rain: { amb: '#a2aec2', k: 0.5, sat: 0.62, hi: '#e8eef8', sh: '#212a3e', rim: '#cbd8ec', rimA: 0.4 },
    night: { amb: '#5a6aa0', k: 0.6, sat: 0.82, hi: '#ffeccf', sh: '#0f152c', rim: '#ffcf92', rimA: 0.65 },
    sunset: { amb: '#ffc697', k: 0.36, sat: 1.06, hi: '#fff2db', sh: '#4a2a42', rim: '#ffb672', rimA: 0.65 },
    mute: { amb: '#b4aea6', k: 0.3, sat: 0.32, hi: '#f3f0ea', sh: '#3f3a36', rim: '#ece6dc', rimA: 0.2 },
    white: { amb: '#ffffff', k: 0, sat: 0.85, hi: '#ffffff', sh: '#5d6478', rim: '#ffffff', rimA: 0.35 },
  };
  const toneMemo = {};
  function tone(o) {
    const key = typeof o.tone === 'object' ? JSON.stringify(o.tone) : (o.tone || 'day');
    if (toneMemo[key]) return toneMemo[key];
    const T = Object.assign({}, TONES.day, typeof o.tone === 'object' ? o.tone : (TONES[o.tone] || TONES.day));
    const am = rgb(T.amb); const memo = new Map();
    T.key = key;
    T.c = function (h) {
      let v = memo.get(h); if (v) return v;
      let [r, g, b] = rgb(h); const l = 0.3 * r + 0.59 * g + 0.11 * b;
      r = l + (r - l) * T.sat; g = l + (g - l) * T.sat; b = l + (b - l) * T.sat;
      r = lerp(r, r * am[0] / 255, T.k); g = lerp(g, g * am[1] / 255, T.k); b = lerp(b, b * am[2] / 255, T.k);
      v = hex(r, g, b); memo.set(h, v); return v;
    };
    T.a = (h, a) => rgba(T.c(h), a);
    toneMemo[key] = T; return T;
  }
  function setup(o, defLight) {
    const T = tone(o);
    const la = o.light === undefined ? (defLight === undefined ? -2.3 : defLight) : o.light;
    const s = o.s || 1;
    return {
      T, la, lx: Math.cos(la), ly: Math.sin(la), s,
      rimA: o.rimA === undefined ? T.rimA : o.rimA,
      ink: o.ink === undefined ? 0.55 : o.ink,
      LW: (o.lw || 1.4) / Math.sqrt(Math.max(0.3, s)),
    };
  }
  function begin(ctx, o) {
    ctx.save(); ctx.translate(o.x || 0, o.y || 0); if (o.rot) ctx.rotate(o.rot);
    const s = o.s || 1; if (s !== 1) ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  }

  /* ------------------------------------------------------------ paths */
  function rr(x, y, w, h, r) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }
  function ell(cx, cy, rx, ry, rot) { const p = new Path2D(); p.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); return p; }
  function smoothClosed(pts) {
    const p = new Path2D(); const n = pts.length; const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = mid(pts[n - 1], pts[0]); p.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; const m = mid(a, b); p.quadraticCurveTo(a[0], a[1], m[0], m[1]); }
    p.closePath(); return p;
  }
  function smoothOpen(p, pts) {
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    const e = pts[pts.length - 1]; p.lineTo(e[0], e[1]); return p;
  }
  // lumpy closed blob (noise-modulated ellipse)
  function blob(cx, cy, rx, ry, seed, amp, n, freq) {
    n = n || 16; freq = freq || 1.6; amp = amp === undefined ? 0.12 : amp; const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU; const k = 1 + amp * PV.noise2(seed * 7.31 + Math.cos(a) * freq, seed * 3.17 + Math.sin(a) * freq);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return smoothClosed(pts);
  }
  const M = (a, b, c, d, e, f) => new DOMMatrix([a, b, c, d, e, f]);
  function moved(P, dx, dy) { const q = new Path2D(); q.addPath(P, M(1, 0, 0, 1, dx, dy)); return q; }

  /* ------------------------------------------------------------ shading */
  // fill the part of P that is NOT covered by P shifted by (dx,dy): a crescent on the far side
  function crescent(c, P, dx, dy, style) {
    const q = new Path2D(); q.addPath(P); q.addPath(P, M(1, 0, 0, 1, dx, dy));
    c.save(); c.clip(P); c.fillStyle = style; c.fill(q, 'evenodd'); c.restore();
  }
  function softEll(c, x, y, rx, ry, col, a, inner) {
    if (rx <= 0 || ry <= 0) return;
    c.save(); c.translate(x, y); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, rx * (inner || 0), 0, 0, rx);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
  }
  function glossy(c, x, y, rx, ry, rot, col, a) {
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(0.5, rgba(col, a * 0.6)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
  }
  function spec(c, x, y, rx, ry, rot, col, a) { c.fillStyle = rgba(col, a); c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); c.fill(); }
  // shaded ball-ish object: radial light, cel crescent, bounce light, rim
  function ball(c, D, P, x, y, RX, RY, col, o) {
    o = o || {}; const { T, lx, ly } = D; const R = Math.max(RX, RY);
    const g = c.createRadialGradient(x + lx * RX * 0.42, y + ly * RY * 0.42, R * 0.04, x - lx * RX * 0.15, y - ly * RY * 0.15, R * 1.12);
    g.addColorStop(0, T.c(col.light)); g.addColorStop(o.mid || 0.48, T.c(col.base)); g.addColorStop(1, T.c(col.shade));
    c.fillStyle = g; c.fill(P);
    if (o.cel !== false) crescent(c, P, lx * R * (o.celW || 0.3), ly * R * (o.celW || 0.3), T.a(col.deep || col.shade, o.celA || 0.5));
    if (col.bounce) crescent(c, P, lx * R * 0.12, ly * R * 0.12, T.a(col.bounce, 0.0)); // reserved
    if (D.rimA > 0 && o.rim !== false) crescent(c, P, -lx * R * 0.09, -ly * R * 0.09, rgba(T.rim, D.rimA * (o.rimMul || 0.6)));
  }
  function inkStroke(c, D, P, col, w) {
    if (D.ink <= 0) return; c.save(); c.strokeStyle = D.T.a(col, D.ink); c.lineWidth = D.LW * (w || 1); c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(P); c.restore();
  }

  /* ------------------------------------------------------------ sprite cache */
  // Paint static artwork once per (key, resolution bucket); returns {img, r}
  function sprite(key, w, h, s, paint) {
    const r = Math.pow(2, Math.ceil(Math.log2(Math.max(0.35, s)) * 2) / 2);
    const img = PV.cached('props:' + key + '@' + r.toFixed(3), Math.ceil(w * r), Math.ceil(h * r), (c) => { c.scale(r, r); paint(c, r); });
    return { img, r };
  }
  // static prop helper: o (options), key, bounding box (local units, origin offset), paint(c, D)
  function staticProp(ctx, o, key, bw, bh, ox, oy, paint, defLight) {
    const D = setup(o, defLight);
    begin(ctx, o);
    if (o.cache === false) { paint(ctx, D); }
    else {
      const sp = sprite(key + '|' + D.T.key + '|' + D.la.toFixed(2) + '|' + D.ink + '|' + D.rimA, bw, bh, D.s * (o.res || 1), (c, r) => {
        c.translate(ox, oy); const D2 = Object.assign({}, D, { LW: (o.lw || 1.4) / Math.sqrt(Math.max(0.3, r)) }); paint(c, D2);
      });
      ctx.drawImage(sp.img, -ox, -oy, bw, bh);
    }
    ctx.restore();
  }
  L.propsTone = tone; // exposed for scenes that want the same colour keys

  /* ===================================================================== BENTO
   * Box-local coordinates: u → right, v → toward the viewer, z → up.
   * Orthographic view with elevation e: screenX = u, screenY = v*k − z*m (k=sin e, m=cos e)
   * ======================================================================== */
  function viewOf(o, def) {
    const e = o.elev !== undefined ? o.elev : ({ top: 1.32, flat: Math.PI / 2, angle: 0.8, low: 0.6 })[o.view || def || 'angle'] || 0.92;
    return { e, k: Math.sin(e), m: Math.cos(e) };
  }
  function footM(D, u, v, z, rotDeg) { let m = new DOMMatrix().translate(u, v * D.k - z * D.m).scale(1, D.k); if (rotDeg) m = m.rotate(rotDeg); return m; }
  function atZ(D, F, u, v, z, rotDeg) { const p = new Path2D(); p.addPath(F, footM(D, u, v, z, rotDeg)); return p; }
  function extrude(D, F, u, v, z0, z1, rotDeg) {
    const p = new Path2D(); const n = Math.max(1, Math.ceil(Math.abs(z1 - z0) * D.m / 1.2));
    for (let i = 0; i <= n; i++) p.addPath(F, footM(D, u, v, z0 + (z1 - z0) * i / n, rotDeg));
    return p;
  }
  // projected silhouette of an ellipsoid centred at (u,v,zc) with semi axes rx (u), ry (v), rz (z)
  function eSil(D, u, v, zc, rx, ry, rz) { return { x: u, y: v * D.k - zc * D.m, RX: rx, RY: Math.sqrt((ry * D.k) ** 2 + (rz * D.m) ** 2) }; }

  // --- tapered tube along a polyline (legs, cables, straws ...) -------------
  function ribbon(pts, w0, w1, caps) {
    const n = pts.length; const Lp = [], Rp = []; const seg = [0]; let total = 0;
    for (let i = 1; i < n; i++) { total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(total); }
    const tang = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; tang.push([dx, dy]);
      const w = (typeof w1 === 'function' ? w1(total ? seg[i] / total : 0) : lerp(w0, w1, total ? seg[i] / total : 0)) / 2;
      Lp.push([pts[i][0] - dy * w, pts[i][1] + dx * w, w]); Rp.push([pts[i][0] + dy * w, pts[i][1] - dx * w, w]);
    }
    const p = new Path2D();
    const run = (arr, first) => {
      if (first) p.moveTo(arr[0][0], arr[0][1]); else p.lineTo(arr[0][0], arr[0][1]);
      for (let i = 1; i < arr.length - 1; i++) { const a = arr[i], b = arr[i + 1]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
      const e = arr[arr.length - 1]; p.lineTo(e[0], e[1]);
    };
    run(Lp, true);
    const te = tang[n - 1], ae = Math.atan2(te[1], te[0]);
    if (caps !== false) p.arc(pts[n - 1][0], pts[n - 1][1], Lp[n - 1][2], ae + Math.PI / 2, ae - Math.PI / 2, true);
    run(Rp.slice().reverse(), false);
    const t0 = tang[0], a0 = Math.atan2(t0[1], t0[0]);
    if (caps !== false) p.arc(pts[0][0], pts[0][1], Lp[0][2], a0 - Math.PI / 2, a0 - Math.PI * 1.5, true);
    p.closePath(); return p;
  }

  // --- rice texture field (inside a clip) ---------------------------------
  function riceGrains(c, D, cu, cv, w, d, z, seed, n, dome, sz) {
    const { T, k, m, lx, ly } = D; const r = PV.rng(seed); sz = sz || 1;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const u = cu + (r() - 0.5) * w, v = cv + (r() - 0.5) * d; const ang = r() * Math.PI;
      const du = (u - cu) / (w / 2), dv = (v - cv) / (d / 2); const bump = dome * Math.max(0, 1 - (du * du + dv * dv) * 0.8);
      pts.push([u, v * k - (z + bump) * m, ang, (0.85 + r() * 0.35) * sz, r()]);
    }
    pts.sort((a, b) => a[1] - b[1]);
    const kk = 0.55 + 0.45 * k;
    c.fillStyle = T.a('#8f98b2', 0.34);
    for (const p of pts) { c.beginPath(); c.ellipse(p[0] - lx * 1.8 * p[3], p[1] - ly * 1.8 * p[3] * k, 5.4 * p[3], 3.0 * p[3] * kk, p[2], 0, TAU); c.fill(); }
    for (const p of pts) {
      c.fillStyle = T.c(p[4] > 0.5 ? '#fefefc' : '#f3f2ed');
      c.beginPath(); c.ellipse(p[0], p[1], 5.1 * p[3], 2.8 * p[3] * kk, p[2], 0, TAU); c.fill();
    }
    c.fillStyle = rgba(T.hi, 0.95);
    for (const p of pts) { if (p[4] < 0.5) continue; c.beginPath(); c.ellipse(p[0] + lx * 1.6 * p[3], p[1] + ly * 1.1 * p[3], 1.7 * p[3], 0.8 * p[3], p[2], 0, TAU); c.fill(); }
  }

  // --- items (all sizes are real-world: box 560 px ≈ 19 cm) ----------------
  function umeboshi(c, D, u, v, z) {
    const { T } = D; const S = eSil(D, u, v, z + 12, 31, 28, 19);
    const st = eSil(D, u, v, z, 46, 42, 0); softEll(c, st.x, st.y, st.RX, st.RY, T.c('#f39fb3'), 0.5, 0.4);
    softEll(c, S.x - D.lx * 8, S.y + 8, S.RX * 1.1, S.RY * 0.85, T.c('#8d4f63'), 0.38);
    const P = blob(S.x, S.y, S.RX, S.RY, 3.3, 0.08, 16, 2.0);
    ball(c, D, P, S.x, S.y, S.RX, S.RY, { light: '#ee6b80', base: '#c52b48', shade: '#7c1430', deep: '#5a0c22' }, { celW: 0.28 });
    c.save(); c.clip(P); c.strokeStyle = T.a('#6a0d26', 0.5); c.lineWidth = 1.6; c.lineCap = 'round';
    const r = PV.rng(77);
    for (let i = 0; i < 11; i++) { const a = r() * TAU, rr0 = 4 + r() * 18; c.beginPath(); c.arc(S.x + Math.cos(a) * rr0, S.y + Math.sin(a) * rr0 * 0.8, 6 + r() * 10, a, a + 0.8 + r() * 1.2, false); c.stroke(); }
    c.strokeStyle = T.a('#f58aa0', 0.45); c.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { const a = D.la + (r() - 0.5) * 1.4, rr0 = 6 + r() * 14; c.beginPath(); c.arc(S.x + Math.cos(a) * rr0, S.y + Math.sin(a) * rr0 * 0.8, 5 + r() * 6, a, a + 0.6 + r(), false); c.stroke(); }
    c.restore();
    spec(c, S.x + D.lx * 11, S.y + D.ly * 9, 6.5, 3.6, D.la + 1.2, D.T.hi, 0.95);
    spec(c, S.x + D.lx * 3, S.y + D.ly * 15, 2.2, 1.4, 0, D.T.hi, 0.8);
    inkStroke(c, D, P, '#5e0b22', 1);
  }

  function rice(c, D, cu, cv, w, d, radii, z, seed, o) {
    const { T, k, m } = D;
    const F = rr(-w / 2, -d / 2, w, d, radii);
    const top = atZ(D, F, cu, cv, z);
    const y = cv * k - z * m;
    const g = c.createRadialGradient(cu + D.lx * w * 0.2, y + D.ly * d * k * 0.2, 5, cu, y, Math.max(w, d * k) * 0.72);
    g.addColorStop(0, T.c('#ffffff')); g.addColorStop(0.6, T.c('#f3f2ee')); g.addColorStop(1, T.c('#d0d4de'));
    c.fillStyle = g; c.fill(top);
    c.save(); c.clip(top);
    riceGrains(c, D, cu, cv, w + 24, d + 24, z, seed, Math.round(w * d / 95), 6, 1.15);
    c.fillStyle = PV.linGrad(c, 0, y - d * k / 2, 0, y + d * k / 2, [[0, '#7d86a3', 0.2], [0.3, '#7d86a3', 0], [1, '#7d86a3', 0.06]]);
    c.fill(top);
    c.restore();
  }

  function onigiri(c, D, u, v, rot, seed, z0, sz) {
    const { T, k, m, lx, ly } = D; const r = PV.rng(seed); sz = sz || 1;
    const pts = []; // lopsided rounded triangle (made one-handed)
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * TAU / 3 + (r() - 0.5) * 0.3; const rad = 80 * sz * (0.88 + r() * 0.24); pts.push([Math.cos(a) * rad, Math.sin(a) * rad * 0.95]); }
    const P0 = []; for (let i = 0; i < 3; i++) { const a = pts[i], b = pts[(i + 1) % 3]; P0.push(a, [lerp(a[0], b[0], 0.5) * 1.14, lerp(a[1], b[1], 0.5) * 1.14]); }
    const F = smoothClosed(P0);
    const h = 44 * sz;
    softEll(c, u - lx * 10, v * k + 6, 90 * sz, 60 * sz * k, T.c('#5a5048'), 0.35);
    const side = extrude(D, F, u, v, z0, z0 + h, rot);
    c.fillStyle = T.c('#d6d9e2'); c.fill(side);
    const top = atZ(D, F, u, v, z0 + h, rot);
    const cy = v * k - (z0 + h) * m;
    c.fillStyle = PV.radGrad(c, u + lx * 30, cy + ly * 24, 4, 100 * sz, [[0, T.c('#ffffff')], [0.7, T.c('#f1f0ec')], [1, T.c('#cdd1db')]]); c.fill(top);
    c.save(); c.clip(side);
    riceGrains(c, D, u, v, 190 * sz, 190 * sz, z0 + h, seed + 3, 320, 3, 1.1);
    c.restore();
    // nori band wrapping the lower part
    c.save(); c.clip(side);
    const band = rr(-44 * sz, 30 * sz, 88 * sz, 120 * sz, 6);
    const nori = extrude(D, band, u, v, z0, z0 + h, rot);
    c.fillStyle = T.c('#1c2822'); c.fill(nori);
    c.save(); c.clip(nori);
    c.fillStyle = PV.linGrad(c, u - 60, 0, u + 60, 0, [[0, '#6f8f7a', 0.0], [0.4, '#88a893', 0.32], [0.6, '#7fa08a', 0.06], [1, '#6f8f7a', 0.0]]); c.fill(nori);
    c.strokeStyle = T.a('#3f5a4a', 0.55); c.lineWidth = 1; const rn = PV.rng(seed + 5);
    for (let i = 0; i < 40; i++) { const xx = u - 44 * sz + rn() * 88 * sz, yy = cy + 20 * sz * k + rn() * 110 * sz * k; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + 8, yy + (rn() - 0.5) * 3); c.stroke(); }
    c.restore();
    inkStroke(c, D, nori, '#0e1512', 0.7);
    c.restore();
    inkStroke(c, D, side, '#8f96a8', 0.9);
  }

  // squircle footprint helper
  function squircle(w, d, rough, seed, bite) {
    const r = PV.rng(seed); const pts = []; const n = 22;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU; const ca = Math.cos(a), sa = Math.sin(a);
      const sq = Math.pow(Math.abs(ca) ** 4 + Math.abs(sa) ** 4, -0.25);
      let f = 1 + (r() - 0.5) * rough; if (bite && Math.abs(i - bite) < 2) f -= 0.22;
      pts.push([ca * sq * w * 0.5 * f, sa * sq * d * 0.5 * f]);
    }
    return smoothClosed(pts);
  }

  function tamagoSlice(c, D, u, v, rot, seed, burnt, z0, sz) {
    const { T, k, m, lx, ly } = D; const r = PV.rng(seed); sz = sz || 1;
    const w = 98 * sz, d = 58 * sz, h = 40 * sz; z0 = z0 || 0;
    const F = burnt ? squircle(w * 0.92, d, 0.26, seed, 5 + (seed % 7)) : squircle(w, d, 0.04, seed);
    softEll(c, u - lx * 10, v * k + 6, w * 0.6, d * 0.7 * k, T.c('#6a4a28'), 0.35);
    const side = extrude(D, F, u, v, z0, z0 + h, rot);
    const ys = v * k - z0 * m;
    c.fillStyle = PV.linGrad(c, u - w / 2, ys - h * m, u + w / 2, ys, burnt
      ? [[0, T.c('#b8692a')], [0.5, T.c('#8a4a1e')], [1, T.c('#5a2c12')]]
      : [[0, T.c('#f9d466')], [0.6, T.c('#ecb848')], [1, T.c('#d69638')]]);
    c.fill(side);
    c.save(); c.clip(side);
    for (let i = 0; i < (burnt ? 14 : 6); i++) {
      const px = u + (r() - 0.5) * w * 1.05, py = ys - r() * h * m + (r() - 0.5) * d * k * 0.6;
      softEll(c, px, py, (7 + r() * (burnt ? 18 : 10)) * sz, (3 + r() * 6) * sz, T.c(burnt ? '#24120a' : '#c27428'), burnt ? 0.8 : 0.5);
    }
    c.restore();
    const top = atZ(D, F, u, v, z0 + h, rot);
    const ty = v * k - (z0 + h) * m;
    c.fillStyle = PV.radGrad(c, u + lx * 20, ty + ly * 14, 2, 70 * sz, burnt
      ? [[0, T.c('#f3d27c')], [0.7, T.c('#e2b452')], [1, T.c('#c88d36')]]
      : [[0, T.c('#fff4ae')], [0.55, T.c('#fde27c')], [1, T.c('#f1c552')]]);
    c.fill(top);
    // rolled layers: squircle spiral on the cut face
    c.save(); c.clip(top);
    c.setTransform(c.getTransform().multiply(footM(D, u, v, z0 + h, rot)));
    c.lineCap = 'round'; c.lineJoin = 'round';
    const turns = 3.2, N = 150;
    for (const pass of [0, 1]) {
      c.beginPath();
      for (let i = 0; i <= N; i++) {
        const tt = i / N; const th = tt * turns * TAU + seed;
        const rad = 0.12 + 0.86 * tt;
        const ca = Math.cos(th), sa = Math.sin(th);
        const sq = Math.pow(Math.abs(ca) ** 3.2 + Math.abs(sa) ** 3.2, -1 / 3.2);
        const wob = 1 + 0.035 * PV.noise2(seed + tt * 9, 3.1);
        const x = ca * sq * rad * w * 0.47 * wob + (pass ? 0.9 : 0), y = sa * sq * rad * d * 0.44 * wob + (pass ? 1.1 : 0);
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.strokeStyle = pass ? rgba(T.hi, 0.55) : rgba(T.c(burnt ? '#a8662a' : '#dda43c'), 0.85);
      c.lineWidth = pass ? 0.9 : 1.7; c.stroke();
    }
    if (burnt) {
      for (let i = 0; i < 7; i++) softEll(c, (r() - 0.5) * w * 0.9, (r() - 0.5) * d * 0.9, (4 + r() * 10) * sz, (2 + r() * 5) * sz, T.c('#6b3814'), 0.6);
      c.strokeStyle = T.a('#7a4418', 0.75); c.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { c.beginPath(); const x = (r() - 0.5) * w * 0.7; c.moveTo(x, -d / 2); c.lineTo(x + (r() - 0.5) * 14, (r() - 0.3) * d * 0.6); c.stroke(); }
    }
    c.restore();
    crescent(c, top, -lx * 4, -ly * 3, rgba(T.hi, 0.6));
    if (D.rimA > 0) crescent(c, side, -lx * 3, -ly * 3, rgba(T.rim, D.rimA * 0.5));
    inkStroke(c, D, side, burnt ? '#4a220c' : '#b07020', 1);
    inkStroke(c, D, top, burnt ? '#7a4418' : '#d6a03a', 0.6);
  }

  function karaage(c, D, u, v, rad, seed) {
    const { T, k, m, lx, ly } = D; const r = PV.rng(seed);
    const S = eSil(D, u, v, rad * 0.6, rad, rad * 0.86, rad * 0.62);
    softEll(c, S.x - lx * 10, v * k + 6, rad * 1.1, rad * 0.55 * k, T.c('#4a2a14'), 0.5);
    const P = blob(S.x, S.y, S.RX, S.RY, seed * 1.7, 0.17, 20, 2.4);
    ball(c, D, P, S.x, S.y, S.RX, S.RY, { light: '#f3bd6a', base: '#c87b30', shade: '#8a4518', deep: '#5e2b0e' }, { celW: 0.26, celA: 0.6 });
    c.save(); c.clip(P);
    // crispy batter: lumps lit from the key light
    for (let i = 0; i < 70; i++) {
      const a = r() * TAU, rr0 = Math.sqrt(r()) * 0.98; const px = S.x + Math.cos(a) * S.RX * rr0, py = S.y + Math.sin(a) * S.RY * rr0;
      const lit = (Math.cos(a) * lx + Math.sin(a) * ly) * rr0; const sz = 2.5 + r() * 6.5;
      if (lit > -0.15) { c.fillStyle = T.a('#7c3a12', 0.35); c.beginPath(); c.ellipse(px - lx * 1.6, py - ly * 1.6, sz, sz * 0.7, r() * 3, 0, TAU); c.fill(); }
      c.fillStyle = lit > 0.05 ? T.a('#ffd28a', 0.55 + lit * 0.3) : T.a('#a0561f', 0.55);
      c.beginPath(); c.ellipse(px, py, sz * 0.8, sz * 0.55, r() * 3, 0, TAU); c.fill();
    }
    c.strokeStyle = T.a('#5a250b', 0.55); c.lineWidth = 1.5; c.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const px = S.x + (r() - 0.5) * S.RX * 1.4, py = S.y + (r() - 0.5) * S.RY * 1.3; c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + 6, py + (r() - 0.5) * 10, px + 8 + r() * 10, py + (r() - 0.5) * 8); c.stroke(); }
    c.restore();
    for (let i = 0; i < 9; i++) { const a = PV.lerp(-0.7, 0.7, r()) + D.la, rr0 = 0.3 + r() * 0.5; spec(c, S.x + Math.cos(a) * S.RX * rr0, S.y + Math.sin(a) * S.RY * rr0, 2 + r() * 3, 1.1 + r() * 1.3, a, D.T.hi, 0.9); }
    inkStroke(c, D, P, '#5a250b', 1);
  }

  function hamburg(c, D, u, v, seed) {
    const { T, k, m, lx, ly } = D; const r = PV.rng(seed);
    const F = blob(0, 0, 78, 56, seed, 0.06, 18, 1.4); const h = 34;
    softEll(c, u - lx * 12, v * k + 8, 88, 52 * k, T.c('#2e1a0e'), 0.45);
    const side = extrude(D, F, u, v, 0, h);
    c.fillStyle = PV.linGrad(c, u - 80, 0, u + 80, 0, [[0, T.c('#8e5634')], [1, T.c('#4a2814')]]); c.fill(side);
    c.save(); c.clip(side); for (let i = 0; i < 26; i++) softEll(c, u + (r() - 0.5) * 150, v * k - r() * h * m + 10 * k, 4 + r() * 5, 2 + r() * 3, T.c(r() > 0.5 ? '#3a1f10' : '#a8714a'), 0.6); c.restore();
    const top = atZ(D, F, u, v, h);
    const ty = v * k - h * m;
    c.fillStyle = PV.radGrad(c, u + lx * 26, ty + ly * 18, 4, 90, [[0, T.c('#94603c')], [1, T.c('#5b331d')]]); c.fill(top);
    const sauceF = blob(0, -4, 66, 46, seed + 4, 0.1, 22, 2.6);
    const sauce = atZ(D, sauceF, u, v, h + 2);
    c.save(); c.clip(side);
    c.fillStyle = T.c('#4a1a0c');
    for (let i = 0; i < 6; i++) { const a = 0.3 + r() * 2.5; const px = u + Math.cos(a) * 68, py = v * k + Math.sin(a) * 46 * k - h * m; c.beginPath(); c.ellipse(px, py + 8, 7 + r() * 5, 10 + r() * 14, 0, 0, TAU); c.fill(); }
    c.restore();
    c.fillStyle = PV.radGrad(c, u + lx * 18, ty + ly * 12, 2, 80, [[0, T.c('#8e3c1c')], [0.55, T.c('#5c2210')], [1, T.c('#371006')]]); c.fill(sauce);
    c.save(); c.clip(sauce);
    c.strokeStyle = rgba(T.hi, 0.9); c.lineCap = 'round';
    c.lineWidth = 4.2; c.beginPath(); c.ellipse(u + lx * 14, ty + ly * 10, 40, 22 * k, D.la + Math.PI / 2, -0.95, 0.45); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.ellipse(u + lx * 20, ty + ly * 14, 54, 30 * k, D.la + Math.PI / 2, -0.45, 0.15); c.stroke();
    // reflected window (two small panes) — a classic anime food highlight
    c.fillStyle = rgba(T.hi, 0.85);
    c.save(); c.translate(u + lx * 30, ty + ly * 20); c.rotate(D.la + Math.PI / 2); c.fillRect(-9, -4, 7, 6); c.fillRect(0, -4, 7, 6); c.restore();
    c.restore();
    for (let i = 0; i < 10; i++) spec(c, u + (r() - 0.5) * 100, ty + (r() - 0.5) * 60 * k, 1.2 + r() * 2.6, 0.8 + r() * 1.2, 0.3, D.T.hi, 0.8);
    crescent(c, sauce, -lx * 2.5, -ly * 2.5, rgba(T.hi, 0.35));
    inkStroke(c, D, side, '#2e1408', 1);
  }

  // lettuce leaf leaning on the back wall: frilly crown + veins
  function lettuce(c, D, u0, u1, vBack, vFront, zLo, zHi, seed) {
    const { T, k, m } = D; const r = PV.rng(seed);
    const Y = (v, z) => v * k - z * m;
    const lobes = Math.max(3, Math.round((u1 - u0) / 70));
    for (let j = 0; j < lobes; j++) {
      const a0 = lerp(u0, u1, j / lobes) - 18, a1 = lerp(u0, u1, (j + 1) / lobes) + 18;
      const P = new Path2D(); const n = 22; const top = [];
      const zz = zHi - (j % 2) * 8 + r() * 6;
      for (let i = 0; i <= n; i++) {
        const t = i / n; const uu = lerp(a0, a1, t);
        const arch = Math.sin(t * Math.PI);
        const frill = Math.sin(t * 17 + seed + j) * 6 + Math.sin(t * 41 + j) * 3;
        top.push([uu, Y(vBack + frill * 0.5, zLo + (zz - zLo) * (0.55 + 0.45 * arch) + frill)]);
      }
      P.moveTo(a0 + 10, Y(vFront, zLo)); for (const p of top) P.lineTo(p[0], p[1]); P.lineTo(a1 - 10, Y(vFront, zLo)); P.closePath();
      c.fillStyle = PV.linGrad(c, 0, Y(vBack, zz), 0, Y(vFront, zLo), [[0, T.c(j % 2 ? '#6fb33a' : '#7cc043')], [0.4, T.c('#a6d75a')], [1, T.c('#e6f4b0')]]); c.fill(P);
      c.save(); c.clip(P);
      c.strokeStyle = T.a('#3f7f22', 0.6); c.lineWidth = 4;
      c.beginPath(); top.forEach((p, i) => (i ? c.lineTo(p[0], p[1] + 4) : c.moveTo(p[0], p[1] + 4))); c.stroke();
      c.strokeStyle = T.a('#c9ec88', 0.8); c.lineWidth = 1.4;
      c.beginPath(); top.forEach((p, i) => (i ? c.lineTo(p[0], p[1] + 1.2) : c.moveTo(p[0], p[1] + 1.2))); c.stroke();
      c.strokeStyle = T.a('#f6fde0', 0.8); c.lineWidth = 1.6;
      const mu = (a0 + a1) / 2; c.beginPath(); c.moveTo(mu, Y(vFront, zLo)); c.lineTo(mu + 4, Y(vBack, zz - 6)); c.stroke();
      c.lineWidth = 1;
      for (let i = 0; i < 4; i++) { const tt = 0.2 + i * 0.2; const yy = lerp(Y(vFront, zLo), Y(vBack, zz), tt); c.beginPath(); c.moveTo(mu + 2, yy); c.quadraticCurveTo(mu - 16, yy - 6, mu - 30 - r() * 8, yy - 14); c.moveTo(mu + 2, yy); c.quadraticCurveTo(mu + 18, yy - 6, mu + 32 + r() * 8, yy - 14); c.stroke(); }
      c.restore();
      inkStroke(c, D, P, '#3b6e1e', 0.7);
    }
  }

  function broccoli(c, D, u, v, seed, size) {
    const { T, k, m, lx, ly } = D; const r = PV.rng(seed); size = size || 1;
    const S = eSil(D, u, v, 34 * size, 34 * size, 32 * size, 24 * size);
    softEll(c, S.x - lx * 8, v * k + 4, 38 * size, 20 * size * k, T.c('#1d2a14'), 0.45);
    if (m > 0.3) { const st = ell(u + 6 * size, v * k - 10 * m * size, 10 * size, 16 * size * m); c.fillStyle = T.c('#b6d585'); c.fill(st); inkStroke(c, D, st, '#5d7a3a', 0.6); }
    const buds = [];
    for (let i = 0; i < 11; i++) { const a = r() * TAU, rr0 = Math.sqrt(r()) * 0.62; buds.push([S.x + Math.cos(a) * S.RX * rr0, S.y + Math.sin(a) * S.RY * rr0, (12 + r() * 7) * size]); }
    buds.sort((a, b) => a[1] - b[1]);
    for (const b of buds) {
      const P = blob(b[0], b[1], b[2], b[2] * 0.9, b[0] * 0.07, 0.2, 12, 2.2);
      ball(c, D, P, b[0], b[1], b[2], b[2] * 0.9, { light: '#93c95c', base: '#4f8d34', shade: '#2a5a22', deep: '#1a3f17' }, { celW: 0.34, rimMul: 0.4 });
      c.save(); c.clip(P);
      for (let j = 0; j < 12; j++) { const a = r() * TAU, rr0 = r() * b[2] * 0.85; const px = b[0] + Math.cos(a) * rr0, py = b[1] + Math.sin(a) * rr0; const lit = (px - b[0]) * lx + (py - b[1]) * ly; c.fillStyle = lit > 0 ? T.a('#c2e886', 0.6) : T.a('#173a12', 0.4); c.beginPath(); c.arc(px, py, 1.4 + r() * 1.6, 0, TAU); c.fill(); }
      c.restore();
      inkStroke(c, D, P, '#1a3f17', 0.6);
    }
  }

  function cherryTomato(c, D, u, v, rad, seed) {
    const { T, k, m, lx, ly } = D;
    const S = eSil(D, u, v, rad, rad, rad, rad);
    softEll(c, S.x - lx * 9, v * k + 5, rad * 1.15, rad * 0.6 * k + 2, T.c('#4a1612'), 0.5);
    const P = ell(S.x, S.y, S.RX, S.RY);
    ball(c, D, P, S.x, S.y, S.RX, S.RY, { light: '#ff8466', base: '#e2352a', shade: '#9a1a1c', deep: '#6e0f14' }, { celW: 0.26 });
    const tx = S.x, ty = S.y - rad * m * 0.95; c.save(); c.translate(tx, ty); c.scale(1, Math.max(0.4, k));
    c.fillStyle = T.c('#3d7a2a');
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + seed; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a + 0.3) * 8, Math.sin(a + 0.3) * 8, Math.cos(a) * 15, Math.sin(a) * 15); c.quadraticCurveTo(Math.cos(a - 0.3) * 8, Math.sin(a - 0.3) * 8, 0, 0); c.fill(); }
    c.fillStyle = T.c('#6aa244'); c.fillRect(-2, -7, 4, 8);
    c.restore();
    c.save(); c.translate(S.x + lx * rad * 0.42, S.y + ly * rad * 0.42); c.rotate(D.la + Math.PI / 2);
    c.fillStyle = rgba(T.hi, 0.95); c.beginPath(); c.roundRect(-7, -4.5, 6.2, 9, 2); c.fill(); c.beginPath(); c.roundRect(0.8, -4.5, 6.2, 9, 2); c.fill(); c.restore();
    spec(c, S.x - lx * rad * 0.2, S.y - ly * rad * 0.62, 3, 1.6, D.la, T.hi, 0.45);
    crescent(c, P, -lx * 3, -ly * 3, rgba(T.rim, D.rimA * 0.8));
    inkStroke(c, D, P, '#6e0f14', 1);
  }

  // tako-san wiener (octopus sausage), standing on its legs.  burnt → misshapen legs, scorched, no eyes
  function tako(c, D, u, v, seed, burnt, eyes, sz) {
    const { T, k, m, lx, ly } = D; const r = PV.rng(seed); sz = sz || 1;
    c.save(); c.translate(u, v * k); c.scale(sz, sz);
    const P3 = (x, y, z) => [x, y * k - z * m];
    softEll(c, -lx * 10, 4, 52, 24 * k + 3, T.c('#4e2018'), 0.45);
    const hr = 30, hz = 60; // head radius & centre height
    const red = { light: '#ff8f74', base: '#e8513f', shade: '#b02b25', deep: '#7e1a18' };
    const legs = [];
    const n = burnt ? 6 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * TAU + (burnt ? (r() - 0.5) * 0.55 : (r() - 0.5) * 0.12);
      legs.push({ a, len: burnt ? 0.55 + r() * 0.75 : 0.95 + r() * 0.1, w: burnt ? 12 + r() * 12 : 17, twist: burnt ? (r() - 0.5) * 0.8 : 0 });
    }
    legs.sort((p, q) => Math.sin(p.a) - Math.sin(q.a));
    function leg(Lg) {
      const ca = Math.cos(Lg.a), sa = Math.sin(Lg.a), ca2 = Math.cos(Lg.a + Lg.twist), sa2 = Math.sin(Lg.a + Lg.twist);
      const R = (rad) => rad * Lg.len;
      const pts = [P3(ca * 20, sa * 20, 40), P3(ca * (24 + R(6)), sa * (24 + R(6)), 24), P3(ca2 * (30 + R(16)), sa2 * (30 + R(16)), 9), P3(ca2 * (38 + R(26)), sa2 * (38 + R(26)), 6), P3(ca2 * (44 + R(30)), sa2 * (44 + R(30)), 14 + 10 * Lg.len)];
      const P = ribbon(pts, Lg.w, Lg.w * 0.62);
      const front = sa > 0;
      c.fillStyle = PV.linGrad(c, pts[0][0], pts[0][1], pts[4][0], pts[4][1], [[0, T.c(front ? red.base : red.shade)], [1, T.c(front ? '#d9473a' : '#952320')]]);
      c.fill(P);
      // the pale cut face shows on the inside of the curl
      c.save(); c.clip(P);
      const tip = pts[4], pre = pts[3];
      c.fillStyle = T.c(front ? '#f8cdb6' : '#dc9a86');
      c.beginPath(); c.ellipse(tip[0] * 0.92 + pre[0] * 0.08, tip[1] - 2, Lg.w * 0.45, Lg.w * 0.42, Lg.a, 0, TAU); c.fill();
      c.fillStyle = T.a(front ? '#f8cdb6' : '#dc9a86', 0.85);
      c.beginPath(); c.ellipse((tip[0] + pre[0]) / 2, (tip[1] + pre[1]) / 2 - Lg.w * 0.18, Lg.w * 0.4, Lg.w * 0.18, Math.atan2(tip[1] - pre[1], tip[0] - pre[0]), 0, TAU); c.fill();
      if (front) spec(c, pts[1][0] + lx * 3, pts[1][1] + ly * 2, 3.5, 1.6, Lg.a, T.hi, 0.6);
      c.restore();
      inkStroke(c, D, P, '#7e1a18', 0.9);
    }
    for (const Lg of legs) if (Math.sin(Lg.a) < 0) leg(Lg);
    // body (cylinder 0..44) + head (dome)
    const S = eSil(D, 0, 0, hz, hr, hr, hr * 1.05);
    const body = new Path2D();
    const yb = P3(0, 0, 36)[1];
    body.moveTo(-hr * 0.82, yb); body.lineTo(-hr, S.y);
    body.ellipse(S.x, S.y, hr, S.RY, 0, Math.PI, 0, false);
    body.lineTo(hr * 0.82, yb); body.ellipse(0, yb, hr * 0.82, hr * 0.82 * k, 0, 0, Math.PI, false); body.closePath();
    if (burnt) { /* lumpy head */ }
    ball(c, D, body, 0, S.y + 6, hr, S.RY + 8, red, { celW: 0.3, celA: 0.45, rimMul: 0.75 });
    c.save(); c.clip(body); c.strokeStyle = T.a('#9a2620', 0.6); c.lineWidth = 1.4;
    for (let i = -3; i <= 3; i++) { const xx = i * 8.5; c.beginPath(); c.moveTo(xx * 1.05, yb + 8); c.lineTo(xx, yb - 6); c.stroke(); }
    c.restore();
    c.save(); c.translate(lx * 12, S.y + ly * 10 - 2); c.rotate(D.la + Math.PI / 2 + 0.25);
    c.fillStyle = rgba(T.hi, 0.92); c.beginPath(); c.ellipse(0, 0, 10, 4.4, 0, 0, TAU); c.fill(); c.restore();
    spec(c, lx * 20 + 2, S.y + ly * 4 + 8, 2.2, 1.6, 0, T.hi, 0.75);
    if (eyes && !burnt) {
      const ey = P3(0, hr * 0.86, hz - 4)[1];
      for (const sx of [-9, 9]) {
        c.fillStyle = T.c('#2a1c1a'); c.beginPath(); c.ellipse(sx, ey, 2.8, 3.8, sx * 0.02, 0, TAU); c.fill();
        c.fillStyle = rgba(T.hi, 0.95); c.beginPath(); c.arc(sx - 0.8, ey - 1.3, 1.1, 0, TAU); c.fill();
      }
    }
    if (burnt) { c.save(); c.clip(body); softEll(c, 10 + r() * 6, S.y + 4, 14, 9, T.c('#2e0e08'), 0.6); softEll(c, -12, yb - 4, 9, 6, T.c('#2e0e08'), 0.5); softEll(c, 2, S.y - 12, 8, 5, T.c('#3a120a'), 0.45); c.restore(); }
    inkStroke(c, D, body, '#7e1a18', 1);
    for (const Lg of legs) if (Math.sin(Lg.a) >= 0) leg(Lg);
    c.restore();
  }

  // rabbit apple (うさぎリンゴ) lying skin-up, long axis along u (rotated by rot deg); ears toward −u
  function rabbitWedge(c, D, u, v, rot, seed, sz, ears) {
    const { T, k, m, lx, ly } = D; sz = sz || 1; ears = ears !== false;
    const Lh = 76 * sz, Wh = 32 * sz, Hh = 40 * sz;
    const lens = (hw, len, bl) => { const p = new Path2D(); p.moveTo(-len, 0); p.bezierCurveTo(-len * (bl || 0.7), -hw * 1.3, len * 0.62, -hw * 1.32, len, 0); p.bezierCurveTo(len * 0.62, hw * 1.32, -len * (bl || 0.7), hw * 1.3, -len, 0); p.closePath(); return p; };
    softEll(c, u - lx * 10, v * k + 6, Lh * 1.08, Wh * k + 6, T.c('#4a3020'), 0.4);
    const F = lens(Wh, Lh);
    const body = extrude(D, F, u, v, 0, Hh * 0.72, rot);
    c.fillStyle = PV.linGrad(c, u - Lh, 0, u + Lh, 0, [[0, T.c('#fff7da')], [0.6, T.c('#f6e6b4')], [1, T.c('#e2c88c')]]); c.fill(body);
    c.save(); c.clip(body);
    c.fillStyle = PV.linGrad(c, 0, v * k - Hh * 0.72 * m, 0, v * k + Wh * k, [[0, '#fffdf0', 0.0], [0.45, '#fffdf0', 0.55], [1, '#c9a868', 0.3]]); c.fill(body);
    c.restore();
    inkStroke(c, D, body, '#c2a062', 0.8);
    const skinF = lens(Wh * 0.78, Lh * 0.98);
    const zS = Hh;
    const skinSide = extrude(D, skinF, u, v, Hh * 0.62, zS, rot);
    const topSkin = atZ(D, skinF, u, v, zS, rot);
    // V notch footprint (skin removed) toward −u
    const notchF = new Path2D(); notchF.moveTo(-Lh * 0.06, 0); notchF.lineTo(-Lh * 1.2, -Wh * 0.5); notchF.lineTo(-Lh * 1.2, Wh * 0.5); notchF.closePath();
    c.save();
    if (ears) { const clipP = new Path2D(); clipP.rect(-5000, -5000, 10000, 10000); clipP.addPath(notchF, footM(D, u, v, zS, rot)); c.clip(clipP, 'evenodd'); }
    c.fillStyle = T.c('#9a1426'); c.fill(skinSide);
    c.fillStyle = PV.linGrad(c, u + lx * Lh, v * k - zS * m + ly * Wh, u - lx * Lh, v * k - zS * m - ly * Wh, [[0, T.c('#ff6f70')], [0.4, T.c('#dc2a3c')], [1, T.c('#8e1226')]]);
    c.fill(topSkin);
    c.save(); c.clip(topSkin); c.strokeStyle = T.a('#ffd36e', 0.32); c.lineWidth = 1.3; const r = PV.rng(seed);
    for (let i = 0; i < 16; i++) { const x = u + (r() - 0.5) * Lh * 1.9; c.beginPath(); c.moveTo(x, v * k - zS * m - Wh * k * 1.2); c.quadraticCurveTo(x + (r() - 0.5) * 10, v * k - zS * m, x + (r() - 0.5) * 12, v * k - zS * m + Wh * k * 1.2); c.stroke(); }
    glossy(c, u + lx * Lh * 0.15 + Lh * 0.15, v * k - zS * m + ly * Wh * k * 0.35, Lh * 0.5, Wh * 0.22 * k + 2.5, (rot || 0) * Math.PI / 180, T.hi, 0.85);
    spec(c, u + Lh * 0.42 + lx * 4, v * k - zS * m + ly * Wh * k * 0.45, 5, 1.6, (rot || 0) * Math.PI / 180, T.hi, 0.9);
    c.restore();
    c.restore();
    if (ears) {
      // exposed flesh in the notch
      const nf = new Path2D(); nf.addPath((() => { const p = new Path2D(); p.moveTo(-Lh * 0.06, 0); p.lineTo(-Lh * 1.0, -Wh * 0.42); p.quadraticCurveTo(-Lh * 1.04, 0, -Lh * 1.0, Wh * 0.42); p.closePath(); return p; })(), footM(D, u, v, zS - 4, rot));
      c.save(); c.clip(body); c.fillStyle = T.c('#fff6d8'); c.fill(nf); c.strokeStyle = T.a('#d9bd84', 0.8); c.lineWidth = 1; c.stroke(nf); c.restore();
      // lifted ear tips (skin flaps peel slightly off the flesh)
      for (const sgn of [-1, 1]) {
        const ear = new Path2D(); ear.moveTo(-Lh * 0.62, sgn * Wh * 0.42); ear.quadraticCurveTo(-Lh * 0.95, sgn * Wh * 0.72, -Lh * 1.12, sgn * Wh * 0.52); ear.quadraticCurveTo(-Lh * 1.05, sgn * Wh * 0.36, -Lh * 0.7, sgn * Wh * 0.2); ear.closePath();
        const ep = atZ(D, ear, u, v, zS + 5, rot);
        c.save(); c.globalAlpha *= 0.4; c.fillStyle = T.c('#7a5232'); c.fill(atZ(D, ear, u, v, zS - 6, rot)); c.restore();
        c.fillStyle = T.c(sgn > 0 ? '#c41f33' : '#e0364a'); c.fill(ep);
        inkStroke(c, D, ep, '#6e0c1c', 0.8);
      }
    }
    inkStroke(c, D, topSkin, '#6e0c1c', 0.9);
  }

  function parchment(c, D, pts, h) {
    // pleated cooking-sheet divider standing on the floor: pts = [[u,v],...]
    const { T, k, m } = D;
    const Y = (v, z) => v * k - z * m;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const P = new Path2D(); P.moveTo(a[0], Y(a[1], 0)); P.lineTo(b[0], Y(b[1], 0)); P.lineTo(b[0], Y(b[1], h + (i % 2) * 4)); P.lineTo(a[0], Y(a[1], h + ((i + 1) % 2) * 4)); P.closePath();
      c.fillStyle = T.a(i % 2 ? '#e4e9f0' : '#ffffff', 0.88); c.fill(P);
      c.strokeStyle = T.a('#c3cbd8', 0.6); c.lineWidth = 0.8; c.stroke(P);
    }
    c.strokeStyle = T.a('#ffffff', 0.95); c.lineWidth = 3; c.lineJoin = 'round';
    c.beginPath(); pts.forEach((p, i) => { const y = Y(p[1], h + ((i + 1) % 2) * 4); if (i) c.lineTo(p[0], y); else c.moveTo(p[0], y); }); c.stroke();
  }

  // ---- box --------------------------------------------------------------
  const BX = { w: 560, d: 380, H: 66, t: 12, r: 52, floor: 5, part: -84, pt: 9 };
  function boxOuter(c, D, col) {
    const { T, k, m, lx } = D; const { w, d, H, r } = BX;
    const Y = (v, z) => v * k - z * m;
    const P = new Path2D();
    P.moveTo(-w / 2, Y(0, 0)); P.lineTo(-w / 2, Y(d / 2 - r, 0));
    P.ellipse(-w / 2 + r, Y(d / 2 - r, 0), r, r * k, 0, Math.PI, Math.PI / 2, true);
    P.lineTo(w / 2 - r, Y(d / 2, 0));
    P.ellipse(w / 2 - r, Y(d / 2 - r, 0), r, r * k, 0, Math.PI / 2, 0, true);
    P.lineTo(w / 2, Y(0, H));
    P.lineTo(w / 2, Y(d / 2 - r, H)); P.ellipse(w / 2 - r, Y(d / 2 - r, H), r, r * k, 0, 0, Math.PI / 2, false);
    P.lineTo(-w / 2 + r, Y(d / 2, H)); P.ellipse(-w / 2 + r, Y(d / 2 - r, H), r, r * k, 0, Math.PI / 2, Math.PI, false);
    P.closePath();
    const gl = PV.linGrad(c, -w / 2, 0, w / 2, 0, lx < 0
      ? [[0, T.c(col.sideLit)], [0.1, T.c(col.side)], [0.86, T.c(col.side)], [1, T.c(col.sideDark)]]
      : [[0, T.c(col.sideDark)], [0.14, T.c(col.side)], [0.9, T.c(col.side)], [1, T.c(col.sideLit)]]);
    c.fillStyle = gl; c.fill(P);
    c.fillStyle = PV.linGrad(c, 0, Y(d / 2, H), 0, Y(d / 2, 0), [[0, '#ffffff', 0.12], [0.3, '#ffffff', 0], [1, '#000000', 0.25]]); c.fill(P);
    c.save(); c.clip(P);
    c.fillStyle = PV.linGrad(c, -w / 2, 0, w / 2, 0, [[0, T.hi, 0], [0.2, T.hi, 0.0], [0.26, T.hi, 0.3], [0.32, T.hi, 0.0], [1, T.hi, 0]]);
    c.fill(P);
    c.fillStyle = rgba(T.hi, 0.35); c.fillRect(-w / 2, Y(d / 2, H) + 3, w, 2.2); // edge sheen under the rim
    c.restore();
    inkStroke(c, D, P, col.line, 1);
    return P;
  }
  function boxRimAndInterior(c, D, col, inner) {
    const { T, k, m } = D; const { w, d, H, t, r, floor } = BX;
    const outerTop = atZ(D, rr(-w / 2, -d / 2, w, d, r), 0, 0, H);
    const innerF = rr(-w / 2 + t, -d / 2 + t, w - 2 * t, d - 2 * t, r - t);
    const innerTop = atZ(D, innerF, 0, 0, H);
    const ring = new Path2D(); ring.addPath(outerTop); ring.addPath(innerTop);
    c.fillStyle = PV.linGrad(c, -w / 2, -d / 2 * k, w / 2, d / 2 * k, [[0, T.c(col.rimLit)], [0.5, T.c(col.rim)], [1, T.c(col.rimDark)]]);
    c.fill(ring, 'evenodd');
    c.save(); c.clip(ring, 'evenodd');
    c.strokeStyle = rgba(T.hi, 0.6); c.lineWidth = 2.4;
    const hl = atZ(D, rr(-w / 2 + t * 0.45, -d / 2 + t * 0.45, w - t * 0.9, d - t * 0.9, r - t * 0.45), 0, 0, H);
    c.setLineDash([160, 70, 36, 500]); c.lineDashOffset = 60; c.stroke(hl); c.setLineDash([]);
    c.restore();
    inkStroke(c, D, outerTop, col.line, 0.9); inkStroke(c, D, innerTop, col.line, 0.7);
    c.save(); c.clip(innerTop);
    c.fillStyle = PV.linGrad(c, 0, Y0(D, -d / 2, H), 0, Y0(D, d / 2, 0), [[0, T.c(col.innerWallDark)], [0.4, T.c(col.innerWall)], [1, T.c(col.innerWall)]]);
    c.fill(innerTop);
    const floorP = atZ(D, innerF, 0, 0, floor);
    c.fillStyle = T.c(col.floor); c.fill(floorP);
    inner(c);
    c.lineWidth = 22; c.strokeStyle = rgba(T.c(col.ao), 0.2); c.stroke(innerTop);
    c.lineWidth = 8; c.strokeStyle = rgba(T.c(col.ao), 0.22); c.stroke(innerTop);
    c.restore();
    return innerTop;
  }
  const Y0 = (D, v, z) => v * D.k - z * D.m;

  const BOX_COLORS = {
    navy: { side: '#34476e', sideLit: '#5f77a6', sideDark: '#1d2946', rim: '#40558a', rimLit: '#7088bb', rimDark: '#283658', line: '#141d36', innerWall: '#e2d9c8', innerWallDark: '#c3b59e', floor: '#eae2d2', ao: '#4a3a2c' },
    pink: { side: '#e8a9b4', sideLit: '#f7cdd3', sideDark: '#c07f8d', rim: '#f0b9c2', rimLit: '#fde0e4', rimDark: '#cf8e9b', line: '#9a5462', innerWall: '#f3ece4', innerWallDark: '#dcd0c3', floor: '#f6efe7', ao: '#6a4a4a' },
    wood: { side: '#b97a45', sideLit: '#dba46d', sideDark: '#86522b', rim: '#c98a52', rimLit: '#e8b57e', rimDark: '#93592c', line: '#5e3518', innerWall: '#d9b07c', innerWallDark: '#b98a58', floor: '#dcb683', ao: '#4a2e18' },
  };

  function paintBento(c, D, o) {
    const V = viewOf(o, 'angle'); Object.assign(D, V);
    const { T, k, m, lx, ly } = D; const { w, d, H, t, floor } = BX;
    const col = BOX_COLORS[o.box || 'navy'] || BOX_COLORS.navy;
    const burnt = !!o.burnt;
    if (o.shadow !== false) {
      const sx = -lx * 54, sy = -ly * 34 * k + 10;
      c.save(); c.filter = 'blur(12px)'; c.fillStyle = rgba(T.sh, 0.42);
      c.fill(moved(atZ(D, rr(-w / 2, -d / 2, w, d, BX.r), 0, 0, 0), sx, sy)); c.filter = 'none';
      c.fillStyle = rgba(T.sh, 0.4); c.fill(moved(atZ(D, rr(-w / 2 + 6, -d / 2 + 6, w - 12, d - 12, BX.r), 0, 0, 0), sx * 0.1, 3));
      c.restore();
    }
    if (m > 0.04) boxOuter(c, D, col);
    const pu = BX.part;
    boxRimAndInterior(c, D, col, (c) => {
      const rw = (pu - BX.pt / 2) - (-w / 2 + t), rcu = (-w / 2 + t + pu - BX.pt / 2) / 2;
      if (!burnt) {
        rice(c, D, rcu, 0, rw, d - 2 * t, [BX.r - t, 4, 4, BX.r - t], H - 9, 11);
        umeboshi(c, D, rcu + 4, 6, H - 7);
      } else {
        onigiri(c, D, rcu + 6, -82, -10, 21, floor, 0.98);
        onigiri(c, D, rcu - 2, 74, 16, 22, floor, 1.0);
      }
      const ptP = atZ(D, rr(pu - BX.pt / 2, -d / 2 + t, BX.pt, d - 2 * t, 2), 0, 0, H - 4);
      if (m > 0.04) { const ps = extrude(D, rr(pu - BX.pt / 2, -d / 2 + t, BX.pt, d - 2 * t, 2), 0, 0, H - 34, H - 4); c.fillStyle = T.c(col.innerWallDark); c.fill(ps); }
      c.fillStyle = T.c(col.innerWall); c.fill(ptP); inkStroke(c, D, ptP, col.line, 0.5);
      const ox0 = pu + BX.pt / 2; // okazu compartment starts here (≈ -80) and ends at 268
      if (!burnt) {
        lettuce(c, D, ox0 + 2, 120, -176, -120, 14, 70, 2);
        karaage(c, D, -18, -118, 52, 1);
        parchment(c, D, [[104, -178], [96, -158], [106, -138], [96, -118], [106, -98], [96, -78], [104, -60]], 54);
        hamburg(c, D, 186, -104, 3);
        karaage(c, D, 58, -110, 47, 2);
        broccoli(c, D, 228, -10, 5, 1.2);
        cherryTomato(c, D, 132, -34, 28, 10);
        parchment(c, D, [[ox0 + 2, -40], [ox0 + 30, -48], [ox0 + 58, -40], [ox0 + 86, -48], [ox0 + 112, -40]], 46);
        tamagoSlice(c, D, -26, 6, -4, 4, false, 0);
        tamagoSlice(c, D, -24, 68, 3, 5, false, 0);
        tako(c, D, 70, 28, 7, false, true, 0.95);
        rabbitWedge(c, D, 190, 52, 6, 9, 1.0, true);
        tamagoSlice(c, D, -28, 130, -2, 6, false, 0);
        tako(c, D, 86, 112, 8, false, true, 1.0);
        rabbitWedge(c, D, 196, 132, -5, 11, 1.0, true);
      } else {
        lettuce(c, D, ox0 + 2, w / 2 - t - 2, -176, -122, 12, 62, 4);
        tamagoSlice(c, D, -8, -88, 14, 31, true, 0, 0.95);
        tamagoSlice(c, D, 104, -84, -18, 32, true, 0, 0.9);
        tamagoSlice(c, D, 206, -72, 28, 33, true, 0, 0.85);
        tako(c, D, 10, 40, 35, true, false, 1.0);
        tako(c, D, 132, 20, 36, true, false, 0.92);
        tamagoSlice(c, D, 220, 30, -32, 34, true, 0, 0.8);
        tako(c, D, 70, 120, 37, true, false, 1.05);
        tako(c, D, 196, 128, 38, true, false, 0.88);
      }
    });
    if (o.wash !== false) {
      c.save(); c.globalCompositeOperation = 'soft-light';
      const g = c.createLinearGradient(lx * 340, ly * 240, -lx * 340, -ly * 240);
      g.addColorStop(0, rgba(T.hi, 0.4)); g.addColorStop(1, rgba(T.sh, 0.3));
      c.fillStyle = g; c.fill(atZ(D, rr(-w / 2 - 2, -d / 2 - 2, w + 4, d + 4, BX.r), 0, 0, H));
      if (m > 0.04) { c.fill(extrude(D, rr(-w / 2 - 2, -d / 2 - 2, w + 4, d + 4, BX.r), 0, 0, 0, H)); }
      c.restore();
    }
  }

  function paintLid(c, D, o) {
    const V = viewOf(o, 'angle'); Object.assign(D, V);
    const { T, k, m, lx, ly } = D; const { w, d, r } = BX; const col = BOX_COLORS[o.box || 'navy'] || BOX_COLORS.navy;
    const Hh = 20; const F = rr(-w / 2 - 3, -d / 2 - 3, w + 6, d + 6, r + 3);
    if (o.shadow !== false) { c.save(); c.filter = 'blur(10px)'; c.fillStyle = rgba(T.sh, 0.38); c.fill(moved(atZ(D, F, 0, 0, 0), -lx * 24, -ly * 16 + 5)); c.restore(); }
    const side = extrude(D, F, 0, 0, 0, Hh); c.fillStyle = T.c(col.sideDark); c.fill(side);
    const top = atZ(D, F, 0, 0, Hh);
    c.fillStyle = PV.linGrad(c, -w / 2, -d / 2 * k, w / 2, d / 2 * k, [[0, T.c(col.sideLit)], [0.6, T.c(col.side)], [1, T.c(col.sideDark)]]); c.fill(top);
    const pan = atZ(D, rr(-w / 2 + 34, -d / 2 + 34, w - 68, d - 68, r - 22), 0, 0, Hh);
    c.strokeStyle = rgba(T.hi, 0.25); c.lineWidth = 2.2; c.stroke(pan);
    c.save(); c.clip(top); c.fillStyle = PV.linGrad(c, -w / 2, -d * k / 2, w / 2, d * k / 2, [[0.2, T.hi, 0], [0.32, T.hi, 0.24], [0.42, T.hi, 0], [1, T.hi, 0]]); c.fill(top); c.restore();
    inkStroke(c, D, side, col.line, 1); inkStroke(c, D, top, col.line, 0.8);
  }

  function paintChopsticks(c, D, o) {
    const { T } = D;
    c.save(); c.rotate(-0.06);
    const cs = rr(-160, -15, 320, 30, 15);
    softEll(c, 14, 20, 172, 16, T.sh, 0.38);
    c.fillStyle = PV.linGrad(c, 0, -15, 0, 15, [[0, T.c('#f3dce2')], [0.5, T.c('#e7b9c4')], [1, T.c('#b5808f')]]); c.fill(cs);
    c.fillStyle = rgba(T.hi, 0.55); c.fillRect(-148, -10, 260, 3);
    inkStroke(c, D, cs, '#7c4f5b', 1);
    for (const [dy, a] of [[-28, 0.02], [-39, -0.015]]) {
      c.save(); c.translate(0, dy); c.rotate(a);
      const st = new Path2D(); st.moveTo(-180, -3.8); st.lineTo(160, -1.7); st.lineTo(160, 1.7); st.lineTo(-180, 3.8); st.closePath();
      c.fillStyle = PV.linGrad(c, 0, -4, 0, 4, [[0, T.c('#8a4b3a')], [0.4, T.c('#5e2c22')], [1, T.c('#3f1c16')]]); c.fill(st);
      c.fillStyle = T.c('#c9a46c'); c.fillRect(118, -2.1, 42, 4.2);
      c.fillStyle = rgba(T.hi, 0.6); c.fillRect(-170, -2.5, 240, 1.1);
      inkStroke(c, D, st, '#2b120c', 0.8);
      c.restore();
    }
    c.restore();
  }

  /** PV.lib.bento(ctx, o)
   *  Open bento box.  Anchor (x,y) = centre of the box floor.  Natural size 520×360 (footprint).
   *  o.view: 'angle' (斜め上から, default) | 'top' (真上に近い) | 'flat' (真上) ; or o.elev (rad)
   *  o.burnt: true → 崩れて焦げた卵焼き・歪なタコさんウインナー・おにぎり (後半)
   *  o.box: 'navy' | 'pink' | 'wood' ; o.lid: true (蓋を奥に) ; o.chopsticks: true (手前に箸と箸箱)
   */
  L.bento = function (ctx, o) {
    o = o || {};
    const key = 'bento|' + [o.view, o.elev, o.burnt, o.box, o.lid, o.chopsticks, o.shadow, o.wash].join(',');
    staticProp(ctx, o, key, 1200, 900, 600, 470, (c, D) => {
      if (o.lid) { c.save(); c.translate(80, -170); paintLid(c, Object.assign({}, D), o); c.restore(); }
      paintBento(c, D, o);
      if (o.chopsticks) { c.save(); c.translate(-10, 270); paintChopsticks(c, D, o); c.restore(); }
    });
  };
})();

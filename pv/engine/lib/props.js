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
      ink: o.ink === undefined ? 0.8 : o.ink,
      LW: (o.lw || 1.5) / Math.sqrt(Math.max(0.3, s)),
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
  // same, for paths that are unions of overlapping sub-paths (extrusions): evenodd would
  // stripe them, so the crescent is cut out on an offscreen mask instead (sprite-time only)
  function crescentU(c, P, dx, dy, style) {
    const cv = c.canvas; const b = PV.buffer('props_cres', cv.width, cv.height); const x = b.ctx;
    x.clearRect(0, 0, cv.width, cv.height); x.setTransform(c.getTransform());
    x.fillStyle = style; x.fill(P);
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; x.fill(moved(P, dx, dy));
    x.globalCompositeOperation = 'source-over';
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(b.canvas, 0, 0); c.restore();
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
  // silhouette outline for union paths (extrusions): call BEFORE filling P
  function inkUnder(c, D, P, col, w) {
    if (D.ink <= 0) return; c.save(); c.strokeStyle = D.T.a(col, D.ink); c.lineWidth = D.LW * (w || 1) * 2; c.lineJoin = 'round'; c.stroke(P); c.restore();
  }
  function inkStroke(c, D, P, col, w) {
    if (D.ink <= 0) return; c.save(); c.strokeStyle = D.T.a(col, D.ink); c.lineWidth = D.LW * (w || 1); c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(P); c.restore();
  }

  /* ------------------------------------------------------------ sprite cache */
  // Paint static artwork once per (key, resolution bucket); returns {img, r}
  // warp (optional): {p, cx, y0, y1} keystone in sprite-local units — rows above y0 are
  // squeezed horizontally by (1-p) toward cx, rows below y1 untouched (mild perspective)
  function sprite(key, w, h, s, paint, warp) {
    const r = Math.pow(2, Math.ceil(Math.log2(Math.max(0.35, s)) * 2) / 2);
    const cw = Math.ceil(w * r), ch = Math.ceil(h * r);
    const img = PV.cached('props:' + key + '@' + r.toFixed(3), cw, ch, (c) => {
      if (!warp || !warp.p) { c.scale(r, r); paint(c, r); return; }
      const tmp = PV.makeCanvas(cw, ch); tmp.ctx.scale(r, r); paint(tmp.ctx, r);
      const cx = warp.cx * r;
      for (let y = 0; y < ch; y++) {
        const f = cl((y / r - warp.y0) / (warp.y1 - warp.y0), 0, 1);
        const sc = 1 - warp.p * (1 - f * f * (3 - 2 * f) * 0.35 - f * 0.65);
        c.drawImage(tmp.canvas, 0, y, cw, 1, cx - cx * sc, y, cw * sc, 1);
      }
    });
    return { img, r };
  }
  // static prop helper: o (options), key, bounding box (local units, origin offset), paint(c, D)
  function staticProp(ctx, o, key, bw, bh, ox, oy, paint, defLight, warp) {
    const D = setup(o, defLight);
    begin(ctx, o);
    if (o.cache === false) { paint(ctx, D); }
    else {
      const wk = warp && warp.p ? '|w' + warp.p.toFixed(3) : '';
      const sp = sprite(key + '|' + D.T.key + '|' + D.la.toFixed(2) + '|' + D.ink + '|' + D.rimA + wk, bw, bh, o.cacheScale || D.s * (o.res || 1), (c, r) => {
        c.translate(ox, oy); const D2 = Object.assign({}, D, { LW: (o.lw || 1.5) / Math.sqrt(Math.max(0.3, r)) }); paint(c, D2);
      }, warp && warp.p ? { p: warp.p, cx: ox, y0: oy + warp.y0, y1: oy + warp.y1 } : null);
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
    inkUnder(c, D, side, '#8f96a8', 0.9);
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
    c.fillStyle = T.c('#141d19'); c.fill(nori);
    c.save(); c.clip(nori);
    c.fillStyle = PV.linGrad(c, u - 60, 0, u + 60, 0, [[0, '#6f8f7a', 0.0], [0.4, '#88a893', 0.18], [0.6, '#7fa08a', 0.04], [1, '#6f8f7a', 0.0]]); c.fill(nori);
    c.strokeStyle = T.a('#3f5a4a', 0.55); c.lineWidth = 1; const rn = PV.rng(seed + 5);
    for (let i = 0; i < 40; i++) { const xx = u - 44 * sz + rn() * 88 * sz, yy = cy + 20 * sz * k + rn() * 110 * sz * k; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + 8, yy + (rn() - 0.5) * 3); c.stroke(); }
    c.restore();
    c.restore();
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
    inkUnder(c, D, side, burnt ? '#4a220c' : '#b07020', 1);
    c.fillStyle = PV.linGrad(c, u - w / 2, ys - h * m, u + w / 2, ys, burnt
      ? [[0, T.c('#f0c45a')], [0.55, T.c('#d9a040')], [1, T.c('#b07428')]]
      : [[0, T.c('#f9d466')], [0.6, T.c('#ecb848')], [1, T.c('#d69638')]]);
    c.fill(side);
    c.save(); c.clip(side);
    if (burnt) { // scorched in patches: brown halo + near-black core, heavier toward the pan side (bottom)
      for (let i = 0; i < 16; i++) {
        const px = u + (r() - 0.5) * w * 1.05, py = ys - Math.pow(r(), 1.8) * h * m + (r() - 0.5) * d * k * 0.5;
        const rx = (6 + r() * 16) * sz, ry = (3 + r() * 6) * sz;
        softEll(c, px, py, rx * 1.5, ry * 1.5, T.c('#8a4a16'), 0.55); softEll(c, px, py, rx, ry, T.c('#2a1206'), 0.75);
      }
      c.fillStyle = PV.linGrad(c, 0, ys - 8 * sz, 0, ys + 2, [[0, '#2a1206', 0], [1, '#2a1206', 0.65]]); c.fillRect(u - w, ys - 8 * sz, w * 2, 12 * sz);
    } else {
      for (let i = 0; i < 6; i++) {
        const px = u + (r() - 0.5) * w * 1.05, py = ys - r() * h * m + (r() - 0.5) * d * k * 0.6;
        softEll(c, px, py, (7 + r() * 10) * sz, (3 + r() * 6) * sz, T.c('#c27428'), 0.5);
      }
    }
    c.restore();
    const top = atZ(D, F, u, v, z0 + h, rot);
    const ty = v * k - (z0 + h) * m;
    c.fillStyle = PV.radGrad(c, u + lx * 20, ty + ly * 14, 2, 70 * sz, burnt
      ? [[0, T.c('#fbe48e')], [0.65, T.c('#f0c860')], [1, T.c('#d49a40')]]
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
      c.strokeStyle = pass ? rgba(T.hi, 0.55) : rgba(T.c(burnt ? '#a25a1c' : '#dda43c'), burnt ? 0.9 : 0.85);
      c.lineWidth = pass ? 0.9 : (burnt ? 2.1 : 1.7); c.stroke();
    }
    if (burnt) {
      // the outermost (pan-side) layer came out brown-black all round the cut face, unevenly
      c.restore(); c.save(); c.clip(top);
      c.lineJoin = 'round'; c.strokeStyle = T.a('#7a3c10', 0.8); c.lineWidth = 10 * sz; c.stroke(top);
      c.strokeStyle = T.a('#2e1406', 0.7); c.lineWidth = 4.5 * sz; c.stroke(top);
      c.setTransform(c.getTransform().multiply(footM(D, u, v, z0 + h, rot)));
      for (let i = 0; i < 6; i++) { const a = r() * TAU; softEll(c, Math.cos(a) * w * 0.44, Math.sin(a) * d * 0.42, (7 + r() * 9) * sz, (4 + r() * 4) * sz, T.c('#3a1a08'), 0.7); }
      for (let i = 0; i < 4; i++) softEll(c, (r() - 0.5) * w * 0.6, (r() - 0.5) * d * 0.6, (3 + r() * 5) * sz, (2 + r() * 3) * sz, T.c('#a0621e'), 0.55);
    }
    c.restore();
    crescent(c, top, -lx * 4, -ly * 3, rgba(T.hi, 0.6));
    if (D.rimA > 0) crescentU(c, side, -lx * 3, -ly * 3, rgba(T.rim, D.rimA * 0.5));
    inkStroke(c, D, top, burnt ? '#7a4418' : '#d6a03a', 0.6);
  }

  function karaage(c, D, u, v, rad, seed) {
    const { T, k, m, lx, ly } = D; const r = PV.rng(seed);
    const S = eSil(D, u, v, rad * 0.6, rad, rad * 0.86, rad * 0.62);
    softEll(c, S.x - lx * 10, v * k + 6, rad * 1.1, rad * 0.55 * k, T.c('#4a2a14'), 0.5);
    // craggy fried silhouette: low-frequency lumps + high-frequency crunchy bits
    const pts = []; const n = 40;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU; const k1 = 1 + 0.16 * PV.noise2(seed * 7.3 + Math.cos(a) * 1.5, seed * 3.1 + Math.sin(a) * 1.5) + 0.07 * PV.noise2(seed * 2.1 + Math.cos(a) * 5, Math.sin(a) * 5 + seed);
      pts.push([S.x + Math.cos(a) * S.RX * k1, S.y + Math.sin(a) * S.RY * k1]);
    }
    const P = smoothClosed(pts);
    ball(c, D, P, S.x, S.y, S.RX, S.RY, { light: '#f0b456', base: '#c4782c', shade: '#8a4216', deep: '#5a240a' }, { celW: 0.26, celA: 0.6 });
    c.save(); c.clip(P);
    // batter crags: each lump = dark crevice on the shadow side + golden cap on the lit side
    for (let i = 0; i < 46; i++) {
      const a = r() * TAU, rr0 = Math.sqrt(r()) * 0.95; const px = S.x + Math.cos(a) * S.RX * rr0, py = S.y + Math.sin(a) * S.RY * rr0;
      const lit = (Math.cos(a) * lx + Math.sin(a) * ly) * rr0; const sz = 3 + r() * 7;
      c.fillStyle = T.a('#5a2408', 0.42); c.beginPath(); c.ellipse(px - lx * 2.2, py - ly * 2.2, sz * 1.05, sz * 0.75, r() * 3, 0, TAU); c.fill();
      c.fillStyle = lit > 0.1 ? T.a('#f7c46c', 0.5 + lit * 0.35) : lit > -0.35 ? T.a('#d08a3a', 0.6) : T.a('#9a5220', 0.6);
      c.beginPath(); c.ellipse(px, py, sz * 0.8, sz * 0.58, r() * 3, 0, TAU); c.fill();
    }
    // a few deep cracks
    c.strokeStyle = T.a('#4a1a06', 0.55); c.lineWidth = 1.6; c.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const px = S.x + (r() - 0.5) * S.RX * 1.3, py = S.y + (r() - 0.5) * S.RY * 1.2; c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + 5, py + (r() - 0.5) * 9, px + 7 + r() * 9, py + (r() - 0.5) * 7); c.stroke(); }
    c.restore();
    // warm oil glints (small, cream-gold — not white specks)
    for (let i = 0; i < 6; i++) { const a = PV.lerp(-0.6, 0.6, r()) + D.la, rr0 = 0.35 + r() * 0.45; spec(c, S.x + Math.cos(a) * S.RX * rr0, S.y + Math.sin(a) * S.RY * rr0, 2.4 + r() * 2.6, 1.1 + r() * 1.1, a, mixH(T.hi, '#ffd890', 0.45), 0.85); }
    inkStroke(c, D, P, '#5a250b', 1);
  }

  function hamburg(c, D, u, v, seed) {
    const { T, k, m, lx, ly } = D; const r = PV.rng(seed);
    const F = blob(0, 0, 76, 54, seed, 0.07, 18, 1.4); const h = 26;
    softEll(c, u - lx * 12, v * k + 8, 86, 50 * k, T.c('#2e1a0e'), 0.45);
    const side = extrude(D, F, u, v, 0, h);
    inkUnder(c, D, side, '#3a1a0a', 1);
    c.fillStyle = PV.linGrad(c, u - 80, 0, u + 80, 0, [[0, T.c('#a8683e')], [0.5, T.c('#8a5130')], [1, T.c('#5e3419')]]); c.fill(side);
    c.save(); c.clip(side);
    for (let i = 0; i < 60; i++) { const px = u + (r() - 0.5) * 156, py = v * k + (r() - 0.3) * 56 * k - r() * h * m; c.fillStyle = r() > 0.5 ? T.a('#4a2610', 0.55) : T.a('#c58a58', 0.55); c.beginPath(); c.ellipse(px, py, 2 + r() * 3.5, 1.2 + r() * 2, 0, 0, TAU); c.fill(); }
    c.restore();
    const top = atZ(D, F, u, v, h);
    const ty = v * k - h * m;
    c.fillStyle = PV.radGrad(c, u + lx * 26, ty + ly * 18, 4, 90, [[0, T.c('#a46a42')], [1, T.c('#6a3a1e')]]); c.fill(top);
    const sauceF = blob(0, -6, 60, 40, seed + 4, 0.13, 22, 2.6);
    const sauce = atZ(D, sauceF, u, v, h + 2.5);
    c.save(); c.clip(side);
    c.fillStyle = T.c('#6a2410');
    for (let i = 0; i < 5; i++) { const a = 0.5 + r() * 2.2; const px = u + Math.cos(a) * 62, py = v * k + Math.sin(a) * 40 * k - h * m; c.beginPath(); c.ellipse(px, py + 5, 6 + r() * 5, 8 + r() * 10, 0, 0, TAU); c.fill(); }
    c.restore();
    c.fillStyle = PV.radGrad(c, u + lx * 18, ty + ly * 12, 2, 72, [[0, T.c('#b4502a')], [0.5, T.c('#7c2c14')], [1, T.c('#4a160a')]]); c.fill(sauce);
    c.save(); c.clip(sauce);
    for (let i = 0; i < 18; i++) softEll(c, u + (r() - 0.5) * 110, ty + (r() - 0.5) * 70 * k, 6 + r() * 8, 3 + r() * 4, T.c('#3e1006'), 0.35);
    c.strokeStyle = rgba(T.hi, 0.92); c.lineCap = 'round';
    c.lineWidth = 4.4; c.beginPath(); c.ellipse(u + lx * 10, ty + ly * 7, 38, 21 * k, D.la + Math.PI / 2, -0.95, 0.4); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.ellipse(u + lx * 16, ty + ly * 11, 50, 28 * k, D.la + Math.PI / 2, -0.4, 0.1); c.stroke();
    c.fillStyle = rgba(T.hi, 0.9);
    c.save(); c.translate(u + lx * 30, ty + ly * 20); c.rotate(D.la + Math.PI / 2); c.fillRect(-9, -4, 7, 6); c.fillRect(0, -4, 7, 6); c.restore();
    c.restore();
    for (let i = 0; i < 12; i++) spec(c, u + (r() - 0.5) * 96, ty + (r() - 0.5) * 56 * k, 1.2 + r() * 2.4, 0.8 + r() * 1.1, 0.3, D.T.hi, 0.85);
    crescent(c, sauce, -lx * 2.5, -ly * 2.5, rgba(T.hi, 0.4));
    inkStroke(c, D, sauce, '#3a0e04', 0.5);
  }

  // lettuce leaves leaning on the back wall: overlapping frilly lobes, pale ribs
  function lettuce(c, D, u0, u1, vBack, vFront, zLo, zHi, seed) {
    const { T, k, m } = D; const r = PV.rng(seed);
    const Y = (v, z) => v * k - z * m;
    const lobes = Math.max(3, Math.round((u1 - u0) / 62));
    for (let j = 0; j < lobes; j++) {
      const cu = lerp(u0, u1, (j + 0.5) / lobes) + (r() - 0.5) * 16, half = (u1 - u0) / lobes * 0.75 + r() * 14;
      const zz = zHi - r() * 16, lean = (r() - 0.5) * 16;
      const P = new Path2D(); const n = 46; const edge = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n; const uu = cu - half + 2 * half * t;
        const arch = Math.pow(Math.sin(t * Math.PI), 0.7);
        const fr = Math.sin(t * 38 + j * 3 + seed) * 4.5 + Math.sin(t * 71 + j) * 2.2 + PV.noise2(t * 9 + j * 5, seed) * 6;
        edge.push([uu + lean * arch * 0.5, Y(vBack + fr * 0.6, zLo + (zz - zLo) * arch + fr * arch)]);
      }
      P.moveTo(cu - half * 0.8, Y(vFront, zLo)); for (const p of edge) P.lineTo(p[0], p[1]); P.lineTo(cu + half * 0.8, Y(vFront, zLo)); P.closePath();
      const yTop = Y(vBack, zz), yBot = Y(vFront, zLo);
      inkUnder(c, D, P, '#3b6e1e', 0.7);
      c.fillStyle = PV.linGrad(c, 0, yTop - 6, 0, yBot, [[0, T.c(j % 2 ? '#5ea52e' : '#6eb238')], [0.25, T.c('#93cd4e')], [0.6, T.c('#c6e584')], [1, T.c('#eef7c6')]]);
      c.fill(P);
      c.save(); c.clip(P);
      // ruffle shading just below the frilly edge
      c.strokeStyle = T.a('#3e7d22', 0.5); c.lineWidth = 6;
      c.beginPath(); edge.forEach((p, i) => (i ? c.lineTo(p[0], p[1] + 7) : c.moveTo(p[0], p[1] + 7))); c.stroke();
      c.strokeStyle = T.a('#d8f29e', 0.9); c.lineWidth = 1.6;
      c.beginPath(); edge.forEach((p, i) => (i ? c.lineTo(p[0], p[1] + 1.4) : c.moveTo(p[0], p[1] + 1.4))); c.stroke();
      // ribs fanning from the stem
      const sx = cu + lean * 0.2, sy = yBot;
      c.strokeStyle = T.a('#f7fde4', 0.85); c.lineWidth = 2.4; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + lean * 0.3, (sy + yTop) / 2, cu + lean * 0.5, yTop + 10); c.stroke();
      c.lineWidth = 1.1;
      for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; c.beginPath(); c.moveTo(sx, sy - 6); c.quadraticCurveTo(sx + Math.sin(a) * half * 0.4, sy - (sy - yTop) * 0.5, sx + Math.sin(a) * half * 0.95, yTop + 8 + Math.abs(a) * 10); c.stroke(); }
      c.restore();
    }
  }

  function broccoli(c, D, u, v, seed, size) {
    const { T, k, m, lx, ly } = D; const r = PV.rng(seed); size = size || 1;
    const S = eSil(D, u, v, 32 * size, 36 * size, 33 * size, 22 * size);
    softEll(c, S.x - lx * 9, v * k + 5, 40 * size, 22 * size * k, T.c('#1d2a14'), 0.5);
    if (m > 0.3) { const st = ribbon([[u + 2 * size, v * k - 2], [u + 8 * size, v * k - 14 * m * size], [u + 4 * size, v * k - 26 * m * size]], 18 * size, 14 * size); c.fillStyle = PV.linGrad(c, u - 10, 0, u + 14, 0, [[0, T.c('#d6eaa8')], [1, T.c('#8fb55e')]]); c.fill(st); inkStroke(c, D, st, '#5d7a3a', 0.6); }
    // florets: overlapping clusters, each densely bumped
    const cls = [];
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + r() * 0.5, rr0 = i === 6 ? 0 : 0.5 + r() * 0.12; cls.push([S.x + Math.cos(a) * S.RX * rr0 * 0.75, S.y + Math.sin(a) * S.RY * rr0 * 0.7 - (i === 6 ? 6 : 0), (15 + r() * 6) * size]); }
    cls.sort((a, b) => a[1] - b[1]);
    for (const b of cls) {
      const P = blob(b[0], b[1], b[2], b[2] * 0.88, b[0] * 0.11 + seed, 0.16, 14, 2.6);
      ball(c, D, P, b[0], b[1], b[2], b[2] * 0.88, { light: '#7fb84e', base: '#3f7a2c', shade: '#21481c', deep: '#143212' }, { celW: 0.38, celA: 0.5, rimMul: 0.35 });
      c.save(); c.clip(P);
      for (let j = 0; j < 34; j++) {
        const a = r() * TAU, rr0 = Math.sqrt(r()) * b[2]; const px = b[0] + Math.cos(a) * rr0, py = b[1] + Math.sin(a) * rr0 * 0.9;
        const lit = ((px - b[0]) * lx + (py - b[1]) * ly) / b[2];
        const rad = (1.6 + r() * 1.6) * size;
        c.fillStyle = T.a('#0f2a0e', 0.35); c.beginPath(); c.arc(px - lx * 1.2, py - ly * 1.2, rad, 0, TAU); c.fill();
        c.fillStyle = lit > 0.15 ? T.a('#b5df7a', 0.75) : lit > -0.3 ? T.a('#5e9a3c', 0.7) : T.a('#2f5f25', 0.6);
        c.beginPath(); c.arc(px, py, rad * 0.8, 0, TAU); c.fill();
      }
      c.restore();
      inkStroke(c, D, P, '#143212', 0.55);
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
    softEll(c, -lx * 10, 4, 48, 22 * k + 3, T.c('#4e2018'), 0.5);
    const hr = 27, hz = 64;
    const red = { light: '#ff9478', base: '#ea5440', shade: '#b52e26', deep: '#7e1a18' };
    const legs = [];
    const n = burnt ? 6 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * TAU + 0.18 + (burnt ? (r() - 0.5) * 0.6 : (r() - 0.5) * 0.12);
      legs.push({ a, len: burnt ? 0.45 + r() * 0.8 : 0.92 + r() * 0.12, w: burnt ? 13 + r() * 11 : 19, tw: burnt ? (r() - 0.5) * 0.9 : (r() - 0.5) * 0.15 });
    }
    legs.sort((p, q) => Math.sin(p.a) - Math.sin(q.a));
    function leg(Lg) {
      const ca = Math.cos(Lg.a), sa = Math.sin(Lg.a), cb = Math.cos(Lg.a + Lg.tw), sb = Math.sin(Lg.a + Lg.tw);
      const e = Lg.len;
      const pts = [P3(ca * 17, sa * 17, 40), P3(ca * (20 + 6 * e), sa * (20 + 6 * e), 24), P3(cb * (24 + 12 * e), sb * (24 + 12 * e), 10), P3(cb * (29 + 17 * e), sb * (29 + 17 * e), 5), P3(cb * (33 + 19 * e), sb * (33 + 19 * e), 12 + 7 * e), P3(cb * (32 + 17 * e), sb * (32 + 17 * e), 18 + 8 * e)];
      const P = ribbon(pts, Lg.w, Lg.w * 0.72);
      const front = sa > -0.2;
      c.fillStyle = PV.linGrad(c, pts[0][0], pts[0][1], pts[3][0], pts[3][1], [[0, T.c(front ? red.base : red.shade)], [1, T.c(front ? '#dc4a38' : '#952320')]]);
      c.fill(P);
      // the pale cut face shows on the inside of the curl (top of the tip)
      c.save(); c.clip(P);
      const tip = pts[5], pre = pts[3];
      c.fillStyle = PV.linGrad(c, pre[0], pre[1], tip[0], tip[1], [[0, T.c(front ? '#f0a28c' : '#c97a68'), 0], [0.35, T.c(front ? '#f6c2aa' : '#d8907c')], [1, T.c(front ? '#fbdccb' : '#e2a894')]]);
      c.beginPath(); c.ellipse(tip[0] * 0.75 + pre[0] * 0.25, tip[1] * 0.75 + pre[1] * 0.25 - Lg.w * 0.2, Lg.w * 0.62, Lg.w * 0.5, Math.atan2(tip[1] - pre[1], tip[0] - pre[0]), 0, TAU); c.fill();
      if (front) spec(c, pts[1][0] + lx * 4, pts[1][1] + ly * 3, 4, 1.8, Lg.a + 1.2, T.hi, 0.55);
      if (burnt && Lg.len > 0.7) { c.fillStyle = T.a('#2a0c06', 0.7); c.beginPath(); c.ellipse(tip[0], tip[1], Lg.w * 0.45, Lg.w * 0.35, Lg.a, 0, TAU); c.fill(); }
      c.restore();
      inkStroke(c, D, P, '#7e1a18', 0.9);
    }
    for (const Lg of legs) if (Math.sin(Lg.a) < -0.2) leg(Lg);
    if (burnt) { c.save(); c.translate(0, -30); c.rotate((r() - 0.5) * 0.5); c.scale(1 + (r() - 0.3) * 0.28, 1 - r() * 0.18); c.translate(0, 30); }
    // trunk + head dome
    const S = eSil(D, 0, 0, hz, hr, hr, hr * 1.02);
    const yb = P3(0, 0, 34)[1];
    const body = new Path2D();
    body.moveTo(-hr * 0.9, yb); body.lineTo(-hr, S.y);
    body.ellipse(S.x, S.y, hr, S.RY, 0, Math.PI, 0, false);
    body.lineTo(hr * 0.9, yb); body.ellipse(0, yb, hr * 0.9, hr * 0.9 * k, 0, 0, Math.PI, false); body.closePath();
    ball(c, D, body, 0, S.y + 8, hr, S.RY + 12, red, { celW: 0.3, celA: 0.45, rimMul: 0.75 });
    c.save(); c.clip(body); c.fillStyle = PV.linGrad(c, 0, yb - 10, 0, yb + 6, [[0, '#7e1a18', 0], [1, '#7e1a18', 0.35]]); c.fillRect(-hr - 2, yb - 12, hr * 2 + 4, 24); c.restore();
    c.save(); c.translate(lx * 11, S.y + ly * 10 - 3); c.rotate(D.la + Math.PI / 2 + 0.25);
    c.fillStyle = rgba(T.hi, burnt ? 0.6 : 0.94); c.beginPath(); c.ellipse(0, 0, burnt ? 6 : 9.5, burnt ? 2.6 : 4.2, 0, 0, TAU); c.fill(); c.restore();
    spec(c, lx * 19 + 2, S.y + ly * 4 + 9, 2, 1.5, 0, T.hi, 0.75);
    if (eyes && !burnt) {
      // black-sesame eyes on the front of the head, just above its equator (clear of the front legs)
      const ez = hz + 6, ev = Math.sqrt(hr * hr - 36) * 0.95; const ey = P3(0, ev, ez)[1];
      for (const sx of [-8.5, 8.5]) {
        c.fillStyle = T.c('#24160f'); c.beginPath(); c.ellipse(sx, ey, 2.9, 4.0 * (0.55 + 0.45 * m), sx * 0.02, 0, TAU); c.fill();
        c.fillStyle = rgba(T.hi, 0.95); c.beginPath(); c.arc(sx - 0.8, ey - 1.4 * (0.55 + 0.45 * m), 0.95, 0, TAU); c.fill();
      }
    }
    if (burnt) {
      c.save(); c.clip(body);
      softEll(c, 9 + r() * 8, S.y + 4, 19, 13, T.c('#2a0c06'), 0.85); softEll(c, -13, yb - 8, 14, 9, T.c('#2a0c06'), 0.75); softEll(c, -2, S.y - 12, 11, 7, T.c('#3a120a'), 0.7);
      c.restore();
    }
    inkStroke(c, D, body, '#7e1a18', 1);
    if (burnt) c.restore();
    for (const Lg of legs) if (Math.sin(Lg.a) >= -0.2) leg(Lg);
    c.restore();
  }

  function parchment(c, D, pts, h) {
    // pleated cooking-sheet divider standing on the floor: pts = [[u,v],...] (alternating pleat ridges)
    const { T, k, m } = D;
    const Y = (v, z) => v * k - z * m;
    const topZ = (i) => h + 3 * Math.sin(i * 2.1) + 2 * Math.sin(i * 5.3);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const P = new Path2D(); P.moveTo(a[0], Y(a[1], 0)); P.lineTo(b[0], Y(b[1], 0));
      P.lineTo(b[0], Y(b[1], topZ(i + 1))); P.quadraticCurveTo((a[0] + b[0]) / 2, Y((a[1] + b[1]) / 2, (topZ(i) + topZ(i + 1)) / 2 + 2.5), a[0], Y(a[1], topZ(i))); P.closePath();
      const facing = (b[1] - a[1]) * (b[0] - a[0]) < 0; // pleat faces toward / away from the light
      c.fillStyle = PV.linGrad(c, 0, Y(a[1], h), 0, Y(a[1], 0), facing ? [[0, T.c('#ffffff'), 0.92], [1, T.c('#e9edf2'), 0.85]] : [[0, T.c('#e2e7ee'), 0.9], [1, T.c('#c4ccd8'), 0.85]]);
      c.fill(P);
      c.strokeStyle = T.a('#aab4c4', 0.55); c.lineWidth = 0.8; c.stroke(P);
    }
    c.strokeStyle = T.a('#ffffff', 0.95); c.lineWidth = 2.2; c.lineJoin = 'round';
    c.beginPath(); pts.forEach((p, i) => { const y = Y(p[1], topZ(i)); if (i) c.lineTo(p[0], y); else c.moveTo(p[0], y); }); c.stroke();
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
    const hl = atZ(D, rr(-w / 2 + t * 0.45, -d / 2 + t * 0.45, w - t * 0.9, d - t * 0.9, r - t * 0.45), 0, 0, H);
    c.strokeStyle = PV.linGrad(c, D.lx * w * 0.5, D.ly * d * 0.5 * k, -D.lx * w * 0.5, -D.ly * d * 0.5 * k, [[0, T.hi, 0.75], [0.35, T.hi, 0.35], [0.6, T.hi, 0.0], [1, T.hi, 0]]);
    c.lineWidth = 2.6; c.stroke(hl);
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
    const rsq = cl(1.25 - 0.3 * D.e, 0.75, 1); // face squash of the side-lying rabbit apples for this elevation
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
        rabbitSide(c, D, 202, Y0(D, 34, BX.floor), 0.6, 9, false, true, rsq);
        tamagoSlice(c, D, -28, 130, -2, 6, false, 0);
        tako(c, D, 86, 112, 8, false, true, 1.0);
        rabbitSide(c, D, 192, Y0(D, 108, BX.floor), 0.6, 11, false, true, rsq);
      } else {
        lettuce(c, D, ox0 + 2, w / 2 - t - 2, -176, -122, 12, 62, 4);
        tamagoSlice(c, D, -10, -92, 14, 31, true, 0, 0.95);
        tamagoSlice(c, D, 100, -88, -18, 32, true, 0, 0.9);
        tamagoSlice(c, D, 204, -80, 28, 33, true, 0, 0.88);
        broccoli(c, D, 244, -2, 41, 1.05);
        cherryTomato(c, D, -44, 30, 25, 12);
        tako(c, D, 26, 34, 35, true, false, 1.0);
        tako(c, D, 134, 14, 36, true, false, 0.92);
        rabbitSide(c, D, 212, Y0(D, 66, BX.floor), 0.55, 39, false, false, rsq);
        cherryTomato(c, D, -36, 108, 24, 13);
        tako(c, D, 64, 112, 37, true, false, 1.05);
        rabbitSide(c, D, 182, Y0(D, 120, BX.floor), 0.52, 40, true, false, rsq);
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
    const Hh = 20; const F = rr(-w / 2 - 3, -d / 2 - 3, w + 6, d + 6, r + 3); const rot = o.lidRot === undefined ? -12 : o.lidRot;
    if (o.shadow !== false) { c.save(); c.filter = 'blur(10px)'; c.fillStyle = rgba(T.sh, 0.38); c.fill(moved(atZ(D, F, 0, 0, 0, rot), -lx * 24, -ly * 16 + 5)); c.restore(); }
    // latch clips on the short sides (behind the lid edge)
    for (const sx of [-1, 1]) {
      const cf = rr(sx * (w / 2 + 3) - (sx > 0 ? 0 : 16), -48, 16, 96, 5);
      const cs = extrude(D, cf, 0, 0, Hh - 26, Hh - 2, rot); c.fillStyle = T.c(col.rimDark); c.fill(cs); inkStroke(c, D, atZ(D, cf, 0, 0, Hh - 2, rot), col.line, 0.6);
      c.fillStyle = T.c(col.rim); c.fill(atZ(D, cf, 0, 0, Hh - 2, rot));
    }
    const side = extrude(D, F, 0, 0, 0, Hh, rot); inkUnder(c, D, side, col.line, 1);
    c.fillStyle = T.c(col.sideDark); c.fill(side);
    // the lip catches the light along its upper edge
    c.save(); c.clip(side); c.strokeStyle = T.a(col.sideLit, 0.7); c.lineWidth = 3; c.stroke(atZ(D, F, 0, 0, Hh - 2, rot)); c.restore();
    const top = atZ(D, F, 0, 0, Hh, rot);
    c.fillStyle = PV.linGrad(c, -w / 2, -d / 2 * k, w / 2, d / 2 * k, [[0, T.c(col.sideLit)], [0.55, T.c(col.side)], [1, T.c(col.sideDark)]]); c.fill(top);
    // raised centre panel with a soft bevel
    const panF = rr(-w / 2 + 30, -d / 2 + 30, w - 60, d - 60, r - 18);
    const pan = atZ(D, panF, 0, 0, Hh + 2, rot);
    c.fillStyle = PV.linGrad(c, -w / 2, -d / 2 * k, w / 2, d / 2 * k, [[0, T.c(mixH(col.sideLit, '#ffffff', 0.12))], [0.6, T.c(mixH(col.side, col.sideLit, 0.3))], [1, T.c(col.side)]]); c.fill(pan);
    c.strokeStyle = T.a(col.line, 0.45); c.lineWidth = 1.6; c.stroke(moved(pan, -lx * 1.2, -ly * 1.2 + 1));
    c.strokeStyle = rgba(T.hi, 0.45); c.lineWidth = 1.4; c.stroke(moved(pan, lx * 1, ly * 1 - 0.6));
    // glossy plastic: two soft diagonal reflections of the window + a hard edge glint
    c.save(); c.clip(top);
    c.fillStyle = PV.linGrad(c, -w / 2, -d * k / 2, w / 2, d * k / 2, [[0.12, T.hi, 0], [0.2, T.hi, 0.28], [0.26, T.hi, 0.06], [0.31, T.hi, 0.18], [0.36, T.hi, 0], [1, T.hi, 0]]); c.fill(top);
    c.restore();
    c.strokeStyle = PV.linGrad(c, lx * w * 0.5, ly * d * 0.5 * k, -lx * w * 0.5, -ly * d * 0.5 * k, [[0, T.hi, 0.8], [0.4, T.hi, 0.2], [0.7, T.hi, 0]]);
    c.lineWidth = 2.2; c.stroke(atZ(D, rr(-w / 2, -d / 2, w, d, r), 0, 0, Hh, rot));
    inkStroke(c, D, top, col.line, 0.8);
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
      c.save(); c.filter = 'blur(2.5px)'; c.fillStyle = rgba(T.sh, 0.35); c.fill(moved(st, -D.lx * 6, -D.ly * 3 + 5)); c.restore();
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
   *  o.box: 'navy' | 'pink' | 'wood' ; o.lid: true (蓋。既定は箱の下に敷く／o.lidX,o.lidY,o.lidRot で横に置く)
   *  o.chopsticks: true (手前に箸と箸箱)
   */
  L.bento = function (ctx, o) {
    o = o || {};
    const V = viewOf(o, 'angle');
    const persp = o.persp !== undefined ? o.persp : (V.e < 1.0 ? 0.13 : V.e < 1.45 ? 0.05 : 0);
    const key = 'bento|' + [o.view, o.elev, o.burnt, o.box, o.lid, o.lidX, o.lidY, o.lidRot, o.chopsticks, o.shadow, o.wash, o.persp].join(',');
    staticProp(ctx, o, key, 1600, 900, 800, 470, (c, D) => {
      // lid: by default slipped under the box (only its rim shows round the foot); lidX/lidY put it beside
      if (o.lid) { c.save(); c.translate(o.lidX === undefined ? 24 : o.lidX, o.lidY === undefined ? 28 : o.lidY); paintLid(c, Object.assign({}, D), Object.assign({}, o, { lidRot: o.lidRot === undefined ? (o.lidX === undefined ? -6 : -12) : o.lidRot })); c.restore(); }
      paintBento(c, D, o);
      if (o.chopsticks) { c.save(); c.translate(-10, 270); paintChopsticks(c, D, o); c.restore(); }
    }, undefined, { p: persp, y0: -BX.d / 2 * V.k - BX.H * V.m, y1: BX.d / 2 * V.k });
  };
  /* ===================================================================== 3D helpers
   * yaw θ around the vertical axis, elevation e (camera looks down by e).
   * object coords: x right, y up, z away from the viewer. Screen: X right, Y down.
   */
  function cam(th, e) {
    const ct = Math.cos(th), st = Math.sin(th), ce = Math.cos(e), se = Math.sin(e);
    const f = (x, y, z) => { const X = x * ct + z * st, Zd = -x * st + z * ct; return [X, -y * ce - Zd * se]; };
    f.depth = (x, y, z) => (-x * st + z * ct) * ce - y * se; // larger = further away
    f.ct = ct; f.st = st; f.ce = ce; f.se = se; return f;
  }
  const polyP = (pts) => { const p = new Path2D(); pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); return p; };

  /* ===================================================================== PACK JUICE
   * 200ml paper carton (紙パック) with an inserted straw whose tip is bitten flat (歯形).
   * Anchor: bottom centre on the table.  Natural size ≈ 150×300 (+ straw ≈ 110 above).
   * o.turn: yaw (default 0.55)   o.elev (default 0.32)   o.flavor: 'apple'|'peach'|'coffee'
   * o.straw (default true)   o.bite (default true)   o.strawLean (rad)   o.dent 0..1 (squeezed)
   */
  const JUICE = {
    apple: { band: '#9fd06b', bandDark: '#6aa83e', base: '#fbf6e6', fruit: '#d8263a', text: 'りんご', en: 'APPLE 100%', side: '#e9efdc' },
    peach: { band: '#f6a7a0', bandDark: '#e07a78', base: '#fff3ea', fruit: '#f4a07a', text: 'もも', en: 'PEACH', side: '#f6e6de' },
    coffee: { band: '#a8724b', bandDark: '#6e4428', base: '#f4ead8', fruit: '#6e4428', text: 'コーヒー', en: 'CAFÉ AU LAIT', side: '#e6dccb' },
  };
  function paintJuice(c, D, o) {
    const { T, lx, ly } = D; const J = JUICE[o.flavor || 'apple'] || JUICE.apple;
    const th = o.turn === undefined ? 0.55 : o.turn, e = o.elev === undefined ? 0.32 : o.elev;
    const P = cam(th, e); const w = 120, dp = 84, h = 236, dent = o.dent || 0;
    const X0 = -w / 2, X1 = w / 2, Z0 = -dp / 2, Z1 = dp / 2;
    // cast shadow
    if (o.shadow !== false) {
      const sh = [P(X0, 0, Z0), P(X1, 0, Z0), P(X1, 0, Z1), P(X0, 0, Z1)].map(q => [q[0] - lx * 36, q[1] - ly * 8]);
      c.save(); c.filter = 'blur(7px)'; c.fillStyle = rgba(T.sh, 0.38); c.fill(polyP(sh)); c.restore();
      softEll(c, 0, 4, 90, 18, T.sh, 0.35);
    }
    const front = polyP([P(X0, 0, Z0), P(X1, 0, Z0), P(X1, h, Z0), P(X0, h, Z0)]);
    const side = polyP([P(X1, 0, Z0), P(X1, 0, Z1), P(X1, h, Z1), P(X1, h, Z0)]);
    const top = polyP([P(X0, h, Z0), P(X1, h, Z0), P(X1, h, Z1), P(X0, h, Z1)]);
    // side panel
    inkUnder(c, D, side, '#5a5a4a', 1);
    const sa = P(X1, h * 0.5, Z0), sb = P(X1, h * 0.5, Z1);
    c.fillStyle = PV.linGrad(c, sa[0], sa[1], sb[0], sb[1], [[0, T.c(J.side)], [1, T.c(mixH(J.side, '#8a8f84', 0.4))]]); c.fill(side);
    c.save(); c.clip(side);
    const bb = [P(X1, h * 0.84, Z0), P(X1, h * 0.84, Z1), P(X1, h, Z1), P(X1, h, Z0)]; c.fillStyle = T.c(mixH(J.band, '#5a6a50', 0.25)); c.fill(polyP(bb));
    c.strokeStyle = T.a('#7d8476', 0.55); c.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) { const yy = h * (0.72 - i * 0.06); const a = P(X1, yy, Z0 + 10), b = P(X1, yy, Z1 - 10 - (i % 3) * 14); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    // folded ear (flap) pressed onto the side panel
    const ear = polyP([P(X1, h - 2, Z0 + 4), P(X1, h - 2, Z1 - 4), P(X1, h - 30, (Z0 + Z1) / 2)]);
    c.fillStyle = T.a(mixH(J.band, '#ffffff', 0.15), 1); c.fill(ear); inkStroke(c, D, ear, '#5a6a50', 0.6);
    c.fillStyle = PV.linGrad(c, 0, P(0, h, 0)[1], 0, P(0, h - 40, 0)[1], [[0, '#000000', 0.12], [1, '#000000', 0]]); c.fill(ear);
    c.restore();
    // front panel
    inkUnder(c, D, front, '#5a5a4a', 1);
    const fa = P(X0, 0, Z0), fb = P(X1, 0, Z0);
    c.fillStyle = PV.linGrad(c, fa[0], 0, fb[0], 0, [[0, T.c(J.base)], [1, T.c(mixH(J.base, '#d8d2c0', 0.5))]]); c.fill(front);
    c.save(); c.clip(front);
    // top colour band with a soft wave edge
    const band = new Path2D(); const nB = 16;
    band.moveTo(...P(X0, h, Z0));
    for (let i = 0; i <= nB; i++) { const x = lerp(X0, X1, i / nB); band.lineTo(...P(x, h * 0.665 + Math.sin(i / nB * Math.PI * 2 + 0.6) * 8, Z0)); }
    band.lineTo(...P(X1, h, Z0)); band.closePath();
    c.fillStyle = PV.linGrad(c, fa[0], 0, fb[0], 0, [[0, T.c(J.band)], [1, T.c(J.bandDark)]]); c.fill(band);
    // fruit illustration (apple with a leaf + a slice)
    const ap = P(-6, h * 0.42, Z0); const R = 30;
    c.save(); c.translate(ap[0], ap[1]); c.transform(P.ct, -P.st * P.se * 0.0, 0, 1, 0, 0);
    const flav = o.flavor || 'apple';
    if (flav === 'coffee') {
      for (const [bx, by, ba] of [[-8, -4, 0.5], [14, 10, -0.4]]) {
        c.save(); c.translate(bx, by); c.rotate(ba);
        c.fillStyle = PV.radGrad(c, -6, -8, 2, 26, [[0, T.c('#9a6a44')], [1, T.c('#4a2a14')]]); c.beginPath(); c.ellipse(0, 0, 17, 23, 0, 0, TAU); c.fill();
        c.strokeStyle = T.c('#2a1408'); c.lineWidth = 2.2; c.beginPath(); c.moveTo(-3, -19); c.quadraticCurveTo(7, 0, -3, 19); c.stroke();
        c.restore();
      }
    } else if (flav === 'peach') {
      // peach: round with a pointed tip, the suture line, yellow→pink blush, two leaves
      const pe = new Path2D(); pe.moveTo(2, -R * 1.02); pe.bezierCurveTo(R * 0.7, -R * 0.95, R * 1.08, -R * 0.35, R * 1.0, R * 0.2); pe.bezierCurveTo(R * 0.92, R * 0.82, R * 0.4, R * 1.02, 0, R * 1.0); pe.bezierCurveTo(-R * 0.45, R * 1.02, -R * 0.98, R * 0.78, -R * 1.0, R * 0.15); pe.bezierCurveTo(-R * 1.02, -R * 0.42, -R * 0.62, -R * 0.9, 2, -R * 1.02); pe.closePath();
      c.fillStyle = PV.radGrad(c, -R * 0.35, R * 0.3, 2, R * 1.25, [[0, T.c('#ffe2a8')], [0.45, T.c('#ffb98a')], [0.8, T.c('#f2788a')], [1, T.c('#d8526c')]]); c.fill(pe);
      c.save(); c.clip(pe); softEll(c, R * 0.35, -R * 0.3, R * 0.75, R * 0.6, T.c('#ee5a72'), 0.45); c.restore();
      c.strokeStyle = T.a('#c8485e', 0.7); c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(2, -R * 0.98); c.bezierCurveTo(R * 0.32, -R * 0.4, R * 0.28, R * 0.35, R * 0.02, R * 0.92); c.stroke();
      c.fillStyle = rgba(T.hi, 0.75); c.beginPath(); c.ellipse(-R * 0.48, -R * 0.2, R * 0.16, R * 0.28, 0.4, 0, TAU); c.fill();
      for (const [lx0, la] of [[-R * 0.18, -0.6], [R * 0.2, 0.5]]) { c.save(); c.translate(lx0 + 2, -R * 1.0); c.rotate(la); c.fillStyle = T.c(la < 0 ? '#5f9e3c' : '#7ab84e'); c.beginPath(); c.ellipse(0, -R * 0.22, R * 0.14, R * 0.3, 0, 0, TAU); c.fill(); c.strokeStyle = T.a('#c8ec9a', 0.8); c.lineWidth = 1; c.beginPath(); c.moveTo(0, -R * 0.02); c.lineTo(0, -R * 0.44); c.stroke(); c.restore(); }
      inkStroke(c, D, pe, '#a8384e', 0.8);
    } else {
      const apP = new Path2D(); apP.moveTo(0, -R * 0.7); apP.bezierCurveTo(R * 0.5, -R * 1.15, R * 1.15, -R * 0.6, R * 1.0, R * 0.15); apP.bezierCurveTo(R * 0.9, R * 0.85, R * 0.3, R * 1.05, 0, R * 0.88); apP.bezierCurveTo(-R * 0.3, R * 1.05, -R * 0.9, R * 0.85, -R * 1.0, R * 0.15); apP.bezierCurveTo(-R * 1.15, -R * 0.6, -R * 0.5, -R * 1.15, 0, -R * 0.7); apP.closePath();
      c.fillStyle = PV.radGrad(c, -R * 0.35, -R * 0.3, 2, R * 1.2, [[0, T.c(mixH(J.fruit, '#ffffff', 0.35))], [0.5, T.c(J.fruit)], [1, T.c(mixH(J.fruit, '#3a0010', 0.35))]]); c.fill(apP);
      c.fillStyle = rgba(T.hi, 0.85); c.beginPath(); c.ellipse(-R * 0.45, -R * 0.35, R * 0.18, R * 0.1, -0.7, 0, TAU); c.fill();
      c.strokeStyle = T.c('#5a3a20'); c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -R * 0.68); c.quadraticCurveTo(2, -R * 1.0, 6, -R * 1.2); c.stroke();
      c.fillStyle = T.c('#5f9e3c'); c.beginPath(); c.ellipse(R * 0.42, -R * 1.02, R * 0.36, R * 0.15, -0.5, 0, TAU); c.fill();
      inkStroke(c, D, apP, '#6e1020', 0.8);
      // half apple in cross-section (cream flesh, red rim, star core with seeds) overlapping lower right
      c.save(); c.translate(R * 0.95, R * 0.62); const hR = R * 0.56;
      const half = new Path2D(); half.moveTo(0, -hR * 0.78); half.bezierCurveTo(hR * 0.55, -hR * 1.1, hR * 1.12, -hR * 0.55, hR * 1.0, hR * 0.12); half.bezierCurveTo(hR * 0.92, hR * 0.8, hR * 0.32, hR * 1.0, 0, hR * 0.86); half.bezierCurveTo(-hR * 0.32, hR * 1.0, -hR * 0.92, hR * 0.8, -hR * 1.0, hR * 0.12); half.bezierCurveTo(-hR * 1.12, -hR * 0.55, -hR * 0.55, -hR * 1.1, 0, -hR * 0.78); half.closePath();
      c.fillStyle = T.c(J.fruit); c.fill(half);
      c.save(); c.scale(0.86, 0.86); c.fillStyle = PV.radGrad(c, 0, 0, 1, hR, [[0, T.c('#fffbe6')], [1, T.c('#f6e2a6')]]); c.fill(half); c.restore();
      c.strokeStyle = T.a('#d8b46a', 0.9); c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU - Math.PI / 2; const rr0 = (i % 2 ? 0.16 : 0.34) * hR; i ? c.lineTo(Math.cos(a) * rr0, Math.sin(a) * rr0 + 2) : c.moveTo(Math.cos(a) * rr0, Math.sin(a) * rr0 + 2); } c.closePath(); c.stroke();
      c.fillStyle = T.c('#5a3216'); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; c.beginPath(); c.ellipse(Math.cos(a) * hR * 0.2, Math.sin(a) * hR * 0.2 + 2, 1.6, 2.8, a + Math.PI / 2, 0, TAU); c.fill(); }
      inkStroke(c, D, half, '#6e1020', 0.7);
      c.restore();
    }
    c.restore();
    // label text
    c.save(); const tp = P(X0 + 10, h * 0.87, Z0); c.translate(tp[0], tp[1]); c.transform(P.ct, -P.st * P.se, 0, 1, 0, 0);
    c.fillStyle = T.c('#ffffff'); c.font = '700 30px "IPAPGothic", sans-serif'; c.textBaseline = 'middle'; c.fillText(J.text, 0, 0);
    c.font = '600 11px "Inter", sans-serif'; c.fillStyle = T.a('#ffffff', 0.9); c.fillText(J.en, 2, 24);
    c.restore();
    c.save(); const bp = P(X0 + 12, h * 0.1, Z0); c.translate(bp[0], bp[1]); c.transform(P.ct, -P.st * P.se, 0, 1, 0, 0);
    c.fillStyle = T.a('#6a6a5a', 0.75); c.font = '500 12px "IPAPGothic", sans-serif'; c.fillText('200ml', 0, 0); c.restore();
    // paper sheen + squeeze dent
    c.fillStyle = PV.linGrad(c, fa[0], 0, fb[0], 0, [[0, T.hi, 0.0], [0.1, T.hi, 0.22], [0.22, T.hi, 0.0], [1, T.hi, 0]]); c.fill(front);
    if (dent > 0) { // squeezed by two hands: the panel caves in — a soft shadowed hollow under a lit ridge, low on the carton
      const d0 = P(X0 + 6, h * 0.24, Z0), d1 = P(X1 - 4, h * 0.3, Z0), dm = P((X0 + X1) / 2, h * 0.2, Z0);
      c.save(); c.filter = 'blur(4px)';
      c.strokeStyle = rgba(T.sh, 0.32 * dent); c.lineWidth = 14; c.beginPath(); c.moveTo(d0[0], d0[1]); c.quadraticCurveTo(dm[0], dm[1] + 8 * dent, d1[0], d1[1]); c.stroke();
      c.strokeStyle = rgba(T.hi, 0.5 * dent); c.lineWidth = 5; c.beginPath(); c.moveTo(d0[0], d0[1] - 10); c.quadraticCurveTo(dm[0], dm[1] - 2 + 8 * dent, d1[0], d1[1] - 10); c.stroke();
      c.restore();
    }
    c.restore();
    if (D.rimA > 0) crescent(c, front, -lx * 3, -ly * 3, rgba(T.rim, D.rimA * 0.5));
    // top panel + sealed fin
    c.fillStyle = PV.linGrad(c, P(X0, h, Z0)[0], 0, P(X1, h, Z1)[0], 0, [[0, T.c(mixH(J.base, '#ffffff', 0.4))], [1, T.c(J.base)]]); c.fill(top);
    inkStroke(c, D, top, '#5a5a4a', 0.9);
    const finA = P(X0 + 2, h, 0), finB = P(X1 - 2, h, 0), finC = P(X1 - 2, h + 7, 0), finD = P(X0 + 2, h + 7, 0);
    const fin = polyP([finA, finB, finC, finD]); c.fillStyle = T.c(mixH(J.base, '#e8e2d0', 0.5)); c.fill(fin); inkStroke(c, D, fin, '#6a6a5a', 0.7);
    c.strokeStyle = T.a('#b8b2a0', 0.8); c.lineWidth = 0.8; for (let i = 1; i < 12; i++) { const a = P(lerp(X0 + 4, X1 - 4, i / 12), h + 1, 0), b = P(lerp(X0 + 4, X1 - 4, i / 12), h + 6, 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    // straw hole
    const hx = X0 + w * 0.26, hz = Z0 + dp * 0.3;
    const hc = P(hx, h, hz);
    c.fillStyle = T.c('#c9c3b0'); c.beginPath(); c.ellipse(hc[0], hc[1], 11, 11 * P.se + 2, 0, 0, TAU); c.fill();
    c.fillStyle = T.c('#9a9484'); c.beginPath(); c.ellipse(hc[0], hc[1], 6.5, 6.5 * P.se + 1.2, 0, 0, TAU); c.fill();
    if (o.straw !== false) paintStraw(c, D, hc, o);
  }
  function paintStraw(c, D, base, o) {
    const { T, lx, ly } = D; const lean = o.strawLean === undefined ? 0.22 : o.strawLean;
    const L1 = 70, L2 = 46; const bend = o.strawBend === undefined ? 0.75 : o.strawBend;
    const a1 = -Math.PI / 2 + lean, a2 = a1 + bend;
    const p0 = [base[0], base[1] + 6], p1 = [p0[0] + Math.cos(a1) * L1, p0[1] + Math.sin(a1) * L1], p2 = [p1[0] + Math.cos(a2) * L2, p1[1] + Math.sin(a2) * L2];
    const pts = []; for (let i = 0; i <= 8; i++) pts.push([lerp(p0[0], p1[0], i / 8), lerp(p0[1], p1[1], i / 8)]);
    const mid = []; for (let i = 1; i <= 6; i++) { const t = i / 6; const a = lerp(a1, a2, t); const last = mid.length ? mid[mid.length - 1] : p1; mid.push([last[0] + Math.cos(a) * 3.2, last[1] + Math.sin(a) * 3.2]); }
    const q1 = mid[mid.length - 1]; const pts2 = []; for (let i = 1; i <= 8; i++) pts2.push([q1[0] + Math.cos(a2) * L2 * i / 8, q1[1] + Math.sin(a2) * L2 * i / 8]);
    const all = pts.concat(mid, pts2);
    const tipW = o.bite === false ? 9 : 13;
    const S = ribbon(all, 9, (t) => (t > 0.9 ? lerp(9, tipW, (t - 0.9) / 0.1) : 9), false);
    inkUnder(c, D, S, '#8a8a90', 0.8);
    c.fillStyle = T.a('#fbfbfd', 0.97); c.fill(S);
    c.save(); c.clip(S);
    // translucent tube shading + a stripe
    c.lineCap = 'butt';
    c.strokeStyle = T.a('#c7cad6', 0.6); c.lineWidth = 3; c.beginPath(); all.forEach((p, i) => (i ? c.lineTo(p[0] + 2.5, p[1] + 1) : c.moveTo(p[0] + 2.5, p[1] + 1))); c.stroke();
    c.strokeStyle = rgba(T.hi, 0.95); c.lineWidth = 1.6; c.beginPath(); all.forEach((p, i) => (i ? c.lineTo(p[0] - 2, p[1] - 0.6) : c.moveTo(p[0] - 2, p[1] - 0.6))); c.stroke();
    c.strokeStyle = T.a('#e05a6a', 0.5); c.lineWidth = 1.4; c.beginPath(); all.forEach((p, i) => (i ? c.lineTo(p[0] + 0.5, p[1]) : c.moveTo(p[0] + 0.5, p[1]))); c.stroke();
    // accordion rings at the bend
    c.strokeStyle = T.a('#9aa0b0', 0.8); c.lineWidth = 1;
    for (const q of mid) { const a = Math.atan2(q[1] - p1[1], q[0] - p1[0]) + Math.PI / 2; c.beginPath(); c.moveTo(q[0] + Math.cos(a) * 5, q[1] + Math.sin(a) * 5); c.lineTo(q[0] - Math.cos(a) * 5, q[1] - Math.sin(a) * 5); c.stroke(); }
    c.restore();
    // bitten, flattened tip with tooth dents
    if (o.bite !== false) {
      const tip = pts2[pts2.length - 1], nx = -Math.sin(a2), ny = Math.cos(a2), dx = Math.cos(a2), dy = Math.sin(a2);
      c.strokeStyle = T.a('#7f8494', 0.85); c.lineWidth = 1.2; c.lineCap = 'round';
      for (const [f, s] of [[-0.35, 4], [0.1, 3.4], [0.45, 4.2]]) { const bx = tip[0] - dx * 5 + nx * f * tipW, by = tip[1] - dy * 5 + ny * f * tipW; c.beginPath(); c.moveTo(bx - dx * s * 0.5, by - dy * s * 0.5); c.lineTo(bx + dx * s * 0.5, by + dy * s * 0.5); c.stroke(); }
      c.strokeStyle = T.a('#9aa0ae', 0.7); c.beginPath(); c.moveTo(tip[0] - dx * 11 + nx * tipW * 0.5, tip[1] - dy * 11 + ny * tipW * 0.5); c.lineTo(tip[0] - dx * 11 - nx * tipW * 0.5, tip[1] - dy * 11 - ny * tipW * 0.5); c.stroke();
    }
  }
  L.packJuice = function (ctx, o) {
    o = o || {};
    const key = 'juice2|' + [o.flavor, o.turn, o.elev, o.straw, o.bite, o.strawLean, o.strawBend, o.dent, o.shadow].join(',');
    staticProp(ctx, o, key, 420, 520, 210, 440, (c, D) => paintJuice(c, D, o));
  };

  /* ===================================================================== APPLE
   * Whole red apple (Fuji).  Anchor: centre of the apple.  Natural size ≈ 160 px wide.
   * o.leaf (default true)  o.shadow  o.bite? no.  o.yaw: stem tilt (rad)
   */
  function applePath(R, seed) {
    const r = PV.rng(seed || 3); const p = new Path2D(); const j = () => 1 + (r() - 0.5) * 0.04;
    p.moveTo(0, -R * 0.66);
    p.bezierCurveTo(R * 0.32 * j(), -R * 1.0, R * 0.95 * j(), -R * 0.98, R * 1.04, -R * 0.3);
    p.bezierCurveTo(R * 1.12, R * 0.28, R * 0.86 * j(), R * 0.86, R * 0.42, R * 0.93);
    p.bezierCurveTo(R * 0.24, R * 0.96, R * 0.12, R * 0.88, 0, R * 0.9);
    p.bezierCurveTo(-R * 0.12, R * 0.88, -R * 0.24, R * 0.96, -R * 0.42, R * 0.93);
    p.bezierCurveTo(-R * 0.86 * j(), R * 0.86, -R * 1.12, R * 0.28, -R * 1.04, -R * 0.3);
    p.bezierCurveTo(-R * 0.95 * j(), -R * 0.98, -R * 0.32 * j(), -R * 1.0, 0, -R * 0.66);
    p.closePath(); return p;
  }
  function paintApple(c, D, o, R) {
    const { T, lx, ly } = D; R = R || 80; const seed = o.seed || 3;
    if (o.shadow !== false) { softEll(c, -lx * 26, R * 0.86, R * 1.05, R * 0.24, T.sh, 0.45); softEll(c, -lx * 6, R * 0.9, R * 0.62, R * 0.1, T.sh, 0.5); }
    const A = applePath(R, seed);
    inkUnder(c, D, A, '#5e0c1c', 1.1);
    c.fillStyle = PV.radGrad(c, lx * R * 0.4, ly * R * 0.35, R * 0.05, R * 1.25, [[0, T.c('#ff8a72')], [0.28, T.c('#e2353a')], [0.65, T.c('#b8162e')], [1, T.c('#6e0a1c')]], -lx * R * 0.1, -ly * R * 0.05);
    c.fill(A);
    c.save(); c.clip(A);
    // yellow-green blush around the stem cavity & bottom
    softEll(c, 0, -R * 0.62, R * 0.62, R * 0.3, T.c('#e7c24e'), 0.45);
    softEll(c, R * 0.1, R * 0.86, R * 0.5, R * 0.2, T.c('#e9b04a'), 0.3);
    // vertical streaks following the form
    const r = PV.rng(seed + 7);
    for (let i = 0; i < 26; i++) {
      const a = (r() - 0.5) * 2.6; const x0 = Math.sin(a) * R * 0.98; const wv = (r() - 0.5) * 10;
      c.strokeStyle = r() > 0.5 ? T.a('#ff6b5a', 0.25) : T.a('#7a0a1e', 0.22); c.lineWidth = 1 + r() * 2.2;
      c.beginPath(); c.moveTo(x0 * 0.55, -R * 0.62); c.bezierCurveTo(x0 * 1.02 + wv, -R * 0.2, x0 * 1.0 - wv, R * 0.4, x0 * 0.5, R * 0.88); c.stroke();
    }
    // lenticels
    for (let i = 0; i < 70; i++) { const a = r() * TAU, rr0 = Math.sqrt(r()) * R * 0.92; c.fillStyle = T.a('#ffd9a0', 0.25 + r() * 0.35); c.beginPath(); c.ellipse(Math.cos(a) * rr0, Math.sin(a) * rr0 * 0.95, 1.2, 0.8, a, 0, TAU); c.fill(); }
    // cel shadow crescent + reflected light
    crescent(c, A, lx * R * 0.34, ly * R * 0.3, T.a('#5a0618', 0.42));
    crescent(c, A, lx * R * 0.08, ly * R * 0.06, T.a('#ff9a8a', 0.0));
    // stem cavity
    softEll(c, 0, -R * 0.64, R * 0.24, R * 0.09, T.c('#6a3a1a'), 0.6);
    c.restore();
    // highlights: window-shaped + soft
    glossy(c, lx * R * 0.48, ly * R * 0.42, R * 0.32, R * 0.2, D.la + 1.2, T.hi, 0.55);
    c.save(); c.translate(lx * R * 0.5, ly * R * 0.44); c.rotate(D.la + Math.PI / 2 + 0.2); c.fillStyle = rgba(T.hi, 0.95);
    c.beginPath(); c.roundRect(-R * 0.13, -R * 0.07, R * 0.12, R * 0.14, 3); c.fill(); c.beginPath(); c.roundRect(R * 0.01, -R * 0.07, R * 0.12, R * 0.14, 3); c.fill(); c.restore();
    spec(c, -lx * R * 0.62, -ly * R * 0.5 + R * 0.2, R * 0.08, R * 0.03, 1.2, T.hi, 0.35);
    if (D.rimA > 0) crescent(c, A, -lx * 4, -ly * 4, rgba(T.rim, D.rimA * 0.7));
    // stem + leaf
    const st = ribbon([[0, -R * 0.62], [R * 0.03, -R * 0.82], [R * 0.1, -R * 1.02]], 6, 4.5);
    c.fillStyle = PV.linGrad(c, -4, 0, 6, 0, [[0, T.c('#8a5a30')], [1, T.c('#4a2a12')]]); c.fill(st); inkStroke(c, D, st, '#2e1a0a', 0.8);
    if (o.leaf !== false) {
      c.save(); c.translate(R * 0.1, -R * 0.92); c.rotate(-0.55);
      const lf = new Path2D(); lf.moveTo(0, 0); lf.bezierCurveTo(R * 0.18, -R * 0.2, R * 0.52, -R * 0.18, R * 0.66, 0); lf.bezierCurveTo(R * 0.5, R * 0.14, R * 0.18, R * 0.16, 0, 0); lf.closePath();
      inkUnder(c, D, lf, '#244a16', 0.9);
      c.fillStyle = PV.linGrad(c, 0, -R * 0.15, 0, R * 0.12, [[0, T.c('#8cc65a')], [0.5, T.c('#56963a')], [1, T.c('#2f6a22')]]); c.fill(lf);
      c.strokeStyle = T.a('#c8ec9a', 0.85); c.lineWidth = 1.2; c.beginPath(); c.moveTo(2, 0); c.quadraticCurveTo(R * 0.3, -R * 0.03, R * 0.62, 0); c.stroke();
      c.restore();
    }
  }
  L.apple = function (ctx, o) {
    o = o || {};
    staticProp(ctx, o, 'apple|' + [o.leaf, o.shadow, o.seed].join(','), 300, 300, 150, 160, (c, D) => paintApple(c, D, o, 80));
  };

  /* ===================================================================== RABBIT APPLE
   * うさぎリンゴ on a small plate.  Anchor: centre of the plate (table level).
   * Shown lying on its side (cut face to camera, ears lifted) — the iconic silhouette.
   * o.count 1..3 (default 2)  o.plate (default true)
   */
  function plate(c, D, rx, ry, depth, col) {
    const { T, lx, ly } = D; col = col || '#f7f6f2';
    softEll(c, -lx * 18, 10, rx * 1.02, ry * 1.05, T.sh, 0.4);
    const base = ell(0, depth, rx, ry);
    c.fillStyle = T.c(mixH(col, '#b8bcc8', 0.35)); c.fill(base);
    const rim = ell(0, 0, rx, ry);
    c.fillStyle = PV.radGrad(c, lx * rx * 0.3, ly * ry * 0.3, 4, rx * 1.1, [[0, T.c('#ffffff')], [0.7, T.c(col)], [1, T.c(mixH(col, '#9aa2b4', 0.3))]]); c.fill(rim);
    const well = ell(0, depth * 0.4, rx * 0.72, ry * 0.72);
    c.fillStyle = PV.radGrad(c, -lx * rx * 0.25, -ly * ry * 0.4, 4, rx * 0.8, [[0, T.c('#ffffff')], [1, T.c(mixH(col, '#c8ccd8', 0.4))]]); c.fill(well);
    c.strokeStyle = T.a('#b9bfcc', 0.6); c.lineWidth = 1.2; c.stroke(well);
    c.save(); c.clip(rim); c.strokeStyle = rgba(T.hi, 0.9); c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, rx * 0.93, ry * 0.9, 0, Math.PI * 1.05, Math.PI * 1.55); c.stroke(); c.restore();
    inkStroke(c, D, rim, '#7f899c', 0.95);
  }
  // うさぎリンゴ, the iconic side view: the wedge lies on one cut face, the other cut face (a cream
  // half-moon) looks up at the camera, the red skin runs along the arc, and on the back half the skin is
  // cut free in a V and the two flaps stand up and back like rabbit ears.  Nose → +x (flip mirrors).
  // sq: vertical squash of the face (view from higher up), ears=false → plain skin-on wedge.
  function rabbitSide(c, D, x, y, sz, seed, flip, ears, sq) {
    if (ears === undefined) ears = true; sq = sq || 1;
    const { T, lx, ly } = D; const r = PV.rng(seed);
    const fx = flip ? -1 : 1; const llx = lx * fx; // light direction in the (possibly mirrored) local frame
    c.save(); c.translate(x, y); c.scale(sz * fx, sz * sq);
    const L2 = 92, Hm = 56;
    const Q = [[-L2, 0], [-L2 * 0.92, -Hm * 1.2], [L2 * 0.55, -Hm * 1.34], [L2, -4]];
    const bez = (u) => { const v = 1 - u; return [v * v * v * Q[0][0] + 3 * v * v * u * Q[1][0] + 3 * v * u * u * Q[2][0] + u * u * u * Q[3][0], v * v * v * Q[0][1] + 3 * v * v * u * Q[1][1] + 3 * v * u * u * Q[2][1] + u * u * u * Q[3][1]]; };
    const arcPts = (u0, u1, n, dx, dy) => { const a = []; for (let i = 0; i <= n; i++) { const p = bez(lerp(u0, u1, i / n)); a.push([p[0] + (dx || 0), p[1] + (dy || 0)]); } return a; };
    const moonP = (dx, dy) => { const p = new Path2D(); const a = arcPts(0, 1, 28, dx, dy); p.moveTo(a[0][0], a[0][1]); for (const q of a) p.lineTo(q[0], q[1]); p.quadraticCurveTo(L2 * 0.3 + dx, 9 + dy, L2 * 0.2 + dx, 6 + dy); p.quadraticCurveTo(0 + dx, -7 + dy, -L2 * 0.26 + dx, 6 + dy); p.quadraticCurveTo(-L2 * 0.6 + dx, 8 + dy, -L2 + dx, dy); p.closePath(); return p; };
    const uE = 0.5; // ears are cut free from the back tip (u=0) up to here
    // contact shadow
    softEll(c, -llx * 10, 7 / sq, L2 * 1.06, 15 / sq, T.sh, 0.5);
    // thickness: the top of the skin seen beyond the face (red), and under the ears the bared flesh
    const TH = [7, -11];
    const back = moonP(TH[0], TH[1]);
    inkUnder(c, D, back, '#5e0a18', 0.9);
    c.fillStyle = PV.linGrad(c, 0, -Hm * 1.3, 0, 0, [[0, T.c('#e8364a')], [1, T.c('#9e1028')]]); c.fill(back);
    if (ears) { // flesh where the ear skin was lifted off (back half of the top)
      const bare = new Path2D(); const a = arcPts(0.02, uE + 0.03, 14), b = arcPts(0.02, uE + 0.03, 14, TH[0], TH[1]).reverse();
      bare.moveTo(a[0][0], a[0][1]); for (const q of a) bare.lineTo(q[0], q[1]); for (const q of b) bare.lineTo(q[0], q[1]); bare.closePath();
      c.fillStyle = T.c('#f3dfa6'); c.fill(bare);
    }
    // ---- ear geometry (attached along the arc between uA..uB, tip lifted up & back)
    const ear = (uA, uB, ang, len, off, wMul) => {
      const A = bez(uA), B = bez(uB); const base = [(A[0] + B[0]) / 2 + off[0], (A[1] + B[1]) / 2 + off[1]];
      const dir = [-Math.cos(ang), -Math.sin(ang)], nrm = [-dir[1], dir[0]];
      const tip = [base[0] + dir[0] * len, base[1] + dir[1] * len];
      const hw = Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.5 * (wMul || 1);
      const P = new Path2D();
      P.moveTo(A[0] + off[0], A[1] + off[1]);
      P.bezierCurveTo(base[0] + dir[0] * len * 0.3 - nrm[0] * hw * 1.05, base[1] + dir[1] * len * 0.3 - nrm[1] * hw * 1.05, tip[0] - dir[0] * len * 0.32 - nrm[0] * hw * 0.55, tip[1] - dir[1] * len * 0.32 - nrm[1] * hw * 0.55, tip[0], tip[1]);
      P.bezierCurveTo(tip[0] - dir[0] * len * 0.3 + nrm[0] * hw * 0.62, tip[1] - dir[1] * len * 0.3 + nrm[1] * hw * 0.62, base[0] + dir[0] * len * 0.32 + nrm[0] * hw * 1.1, base[1] + dir[1] * len * 0.32 + nrm[1] * hw * 1.1, B[0] + off[0], B[1] + off[1]);
      P.closePath();
      return { P, A: [A[0] + off[0], A[1] + off[1]], B: [B[0] + off[0], B[1] + off[1]], tip, base, dir, nrm, hw, len };
    };
    const paintEar = (E, dark) => {
      inkUnder(c, D, E.P, '#4a0814', 1);
      c.fillStyle = PV.linGrad(c, E.tip[0], E.tip[1], E.base[0], E.base[1], dark ? [[0, T.c('#c21c36')], [1, T.c('#8a0e24')]] : [[0, T.c('#ff5a62')], [0.45, T.c('#e2263e')], [1, T.c('#b0142e')]]);
      c.fill(E.P);
      c.save(); c.clip(E.P);
      // pale cut edge (the thin layer of flesh left on the skin) along the lower edge
      c.strokeStyle = T.c(dark ? '#e6c890' : '#fff0c8'); c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(E.A[0], E.A[1]); c.bezierCurveTo(E.base[0] + E.dir[0] * E.len * 0.3 - E.nrm[0] * E.hw * 1.05, E.base[1] + E.dir[1] * E.len * 0.3 - E.nrm[1] * E.hw * 1.05, E.tip[0] - E.dir[0] * E.len * 0.32 - E.nrm[0] * E.hw * 0.55, E.tip[1] - E.dir[1] * E.len * 0.32 - E.nrm[1] * E.hw * 0.55, E.tip[0], E.tip[1]); c.stroke();
      if (!dark) { // glossy streak along the upper edge
        c.strokeStyle = rgba(T.hi, 0.85); c.lineWidth = 2.2;
        c.beginPath(); const m0 = 0.25, m1 = 0.8; for (let i = 0; i <= 10; i++) { const f = lerp(m0, m1, i / 10); const px = lerp(E.base[0], E.tip[0], f) + E.nrm[0] * E.hw * (0.55 - 0.45 * f), py = lerp(E.base[1], E.tip[1], f) + E.nrm[1] * E.hw * (0.55 - 0.45 * f); i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke();
      }
      c.restore();
      inkStroke(c, D, E.P, '#4a0814', 0.9);
    };
    const E2 = ears ? ear(0.3, uE, 0.98, 80, [TH[0] * 0.9, TH[1] * 0.9], 0.9) : null; // far ear (behind)
    const E1 = ears ? ear(0.24, uE - 0.04, 0.68, 92, [0, 0], 1.0) : null; // near ear
    if (E2) paintEar(E2, true);
    // ---- face (cream half-moon)
    const face = moonP(0, 0);
    inkUnder(c, D, face, '#7a4a1a', 1);
    c.fillStyle = PV.radGrad(c, -L2 * 0.1 + llx * 24, -Hm * 0.45 + ly * 10, 4, L2 * 1.15, [[0, T.c('#fffbea')], [0.55, T.c('#faecc0')], [1, T.c('#e6c88e')]]); c.fill(face);
    c.save(); c.clip(face);
    // skin band along the arc (only the front half when the ears are cut)
    const band = arcPts(ears ? uE - 0.02 : 0, 1, 24);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = PV.linGrad(c, -L2 * 0.2, -Hm, L2, 0, [[0, T.c('#f0404c')], [0.6, T.c('#d42238')], [1, T.c('#a0122a')]]); c.lineWidth = 15;
    c.beginPath(); band.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
    c.strokeStyle = T.a('#fff4d0', 0.75); c.lineWidth = 1.6; // white flesh line just inside the skin
    c.beginPath(); band.forEach((q, i) => (i ? c.lineTo(q[0], q[1] + 8.2) : c.moveTo(q[0], q[1] + 8.2))); c.stroke();
    if (ears) { // the bared top under the ears, slightly yellower, with the shadow cast by the near ear
      c.strokeStyle = T.a('#e2bf74', 0.7); c.lineWidth = 5; const bb = arcPts(0.0, uE - 0.02, 12); c.beginPath(); bb.forEach((q, i) => (i ? c.lineTo(q[0], q[1] + 2) : c.moveTo(q[0], q[1] + 2))); c.stroke();
      const sh = bez(0.3); softEll(c, sh[0] + 10, sh[1] + 12, 46, 13, T.c('#9a6a2a'), 0.32);
    }
    // where the core was cut away: a faint hollow line (no seeds — they read as a face), juicy sheen
    c.strokeStyle = T.a('#d8b878', 0.6); c.lineWidth = 1.3; c.beginPath(); c.moveTo(-L2 * 0.3, 5); c.quadraticCurveTo(-L2 * 0.02, -9, L2 * 0.24, 5); c.stroke();
    glossy(c, -L2 * 0.12 + llx * 8, -Hm * 0.42, L2 * 0.5, 9, -0.12, T.hi, 0.55);
    spec(c, L2 * 0.18 + llx * 4, -Hm * 0.55, 6, 2, -0.2, T.hi, 0.8);
    c.restore();
    inkStroke(c, D, face, '#7a4a1a', 0.9);
    // highlight on the skin band
    c.strokeStyle = rgba(T.hi, 0.9); c.lineWidth = 2.6; c.lineCap = 'round';
    const hl = arcPts(0.6, 0.84, 8, 1, 0); c.beginPath(); hl.forEach((q, i) => (i ? c.lineTo(q[0], q[1] + 3.5) : c.moveTo(q[0], q[1] + 3.5))); c.stroke();
    if (E1) { // cast shadow of the near ear on the far ear / bare flesh, then the ear itself
      paintEar(E1, false);
    }
    if (D.rimA > 0) crescent(c, face, -llx * 3, -ly * 3, rgba(T.rim, D.rimA * 0.6));
    c.restore();
  }
  L.rabbitApple = function (ctx, o) {
    o = o || {};
    const n = o.count === undefined ? 2 : o.count;
    staticProp(ctx, o, 'rabbit2|' + [n, o.plate].join(','), 560, 420, 280, 230, (c, D) => {
      D.k = 0.5; D.m = 0.86;
      if (o.plate !== false) plate(c, D, 200, 96, 12, '#efece6');
      const lay = [[[0, 30, 1, false]], [[-56, 12, 0.95, false], [60, 46, 0.95, true]], [[-80, 6, 0.85, false], [74, 18, 0.85, true], [-6, 54, 0.9, false]]][Math.max(0, Math.min(2, n - 1))];
      lay.forEach((q, i) => rabbitSide(c, D, q[0], q[1], q[2], 50 + i, q[3]));
    });
  };

  /* ===================================================================== EARPLUGS
   * A pair of soft foam earplugs.  Anchor: centre of the pair (surface level).
   * Natural size ≈ 200×110.  o.color (default amber '#f3a64a')  o.case: true → clear case behind
   * o.accent 0..1 (default 0.45): share of the colour that ignores the scene grade (stays a warm accent in rain)
   */
  function earplug(c, D, x, y, ang, len, rad, col, seed, accent, squeeze) {
    const { T, lx, ly } = D; const r = PV.rng(seed);
    const C = (h) => mixH(T.c(h), h, accent); // accent colours resist the scene grade a little
    const A = (h, a) => rgba(C(h), a);
    // contact shadow (screen space: directly under the plug, pushed away from the light)
    c.save(); c.translate(x - lx * 5, y + rad * 0.55 - ly * 2); c.rotate(ang);
    softEll(c, 0, 0, len * 0.58, rad * 0.62, T.sh, 0.55); softEll(c, 0, rad * 0.1, len * 0.42, rad * 0.32, T.sh, 0.5);
    c.restore();
    c.save(); c.translate(x, y); c.rotate(ang);
    const ca = Math.cos(-ang), sa = Math.sin(-ang); const llx = lx * ca - ly * sa, lly = lx * sa + ly * ca; // light in the plug frame
    const a = rad, b = rad * 0.84, sq = squeeze || 0; // flat-end radius, domed-end radius, waist squeeze
    const body = new Path2D();
    body.moveTo(-len / 2, -a * 0.92);
    body.bezierCurveTo(-len * 0.18, -a * (1 - sq * 0.25), len * 0.12, -b * 1.03, len * 0.3, -b * 0.98);
    body.bezierCurveTo(len * 0.5, -b * 0.9, len * 0.56, -b * 0.38, len * 0.56, 0);
    body.bezierCurveTo(len * 0.56, b * 0.38, len * 0.5, b * 0.9, len * 0.3, b * 0.98);
    body.bezierCurveTo(len * 0.12, b * 1.03, -len * 0.18, a * (1 - sq * 0.25), -len / 2, a * 0.92);
    body.quadraticCurveTo(-len / 2 - a * 0.12, 0, -len / 2, -a * 0.92); body.closePath();
    const lit = lly < 0 ? -1 : 1; // which long edge faces the light
    inkUnder(c, D, body, mixH(col, '#3a1206', 0.6), 1);
    c.fillStyle = PV.linGrad(c, 0, lit * a, 0, -lit * a, [[0, C(mixH(col, '#fff2d8', 0.5))], [0.32, C(mixH(col, '#ffe8c0', 0.12))], [0.7, C(col)], [1, C(mixH(col, '#8a2e06', 0.42))]]);
    c.fill(body);
    c.save(); c.clip(body);
    // matte foam: fine, low-contrast pores and a broad soft sheen (no hard specular)
    for (let i = 0; i < 90; i++) { const px = (r() - 0.5) * len * 1.1, py = (r() - 0.5) * a * 1.9; c.fillStyle = A(mixH(col, '#6a2a08', 0.5), 0.12 + r() * 0.1); c.beginPath(); c.arc(px, py, 0.45 + r() * 0.6, 0, TAU); c.fill(); }
    glossy(c, len * 0.04, lit * a * 0.5, len * 0.5, a * 0.24, 0, T.hi, 0.3);
    // subsurface glow on the shadow-side edge (foam lets light through)
    c.strokeStyle = A(mixH(col, '#ffcf6a', 0.4), 0.4); c.lineWidth = 3; c.stroke(moved(body, 0, -lit * 2.4));
    c.restore();
    // flat end face (seen almost edge-on)
    const cap = ell(-len / 2 + 0.5, 0, a * 0.3, a * 0.9);
    c.fillStyle = PV.radGrad(c, -len / 2 + 1, -lit * 3, 1, a, [[0, C(mixH(col, '#fff0d8', 0.35))], [1, C(mixH(col, '#a8461a', 0.3))]]); c.fill(cap);
    c.save(); c.clip(cap); for (let i = 0; i < 26; i++) { c.fillStyle = A(mixH(col, '#5a2006', 0.55), 0.3); c.beginPath(); c.arc(-len / 2 + (r() - 0.5) * a * 0.5, (r() - 0.5) * a * 1.7, 0.5 + r() * 0.7, 0, TAU); c.fill(); } c.restore();
    inkStroke(c, D, cap, mixH(col, '#3a1206', 0.6), 0.7);
    if (D.rimA > 0) crescent(c, body, llx * -2.5, lly * -2.5, rgba(T.rim, D.rimA * 0.55));
    inkStroke(c, D, body, mixH(col, '#3a1206', 0.6), 0.9);
    c.restore();
  }
  L.earplugs = function (ctx, o) {
    o = o || {}; const col = o.color || '#f3a64a'; const acc = o.accent === undefined ? 0.45 : o.accent;
    staticProp(ctx, o, 'plugs2|' + [col, o.case, o.shadow, acc].join(','), 360, 240, 180, 120, (c, D) => {
      if (o.case) {
        const cs = rr(-108, -74, 216, 104, 44); c.fillStyle = D.T.a('#e8f0f8', 0.22); c.fill(cs);
        c.strokeStyle = D.T.a('#ffffff', 0.7); c.lineWidth = 2.2; c.stroke(cs);
        c.strokeStyle = D.T.a('#9fb0c8', 0.5); c.lineWidth = 1; c.stroke(rr(-102, -68, 204, 92, 38));
        c.strokeStyle = rgba(D.T.hi, 0.8); c.lineWidth = 3; c.beginPath(); c.moveTo(-70, -66); c.lineTo(40, -66); c.stroke();
      }
      earplug(c, D, -40, -6, -0.35, 66, 21, col, 5, acc, 0.15);
      earplug(c, D, 44, 16, 0.5, 64, 20, col, 6, acc, 0);
    });
  };

  /* ===================================================================== KEY
   * 部屋の鍵 + split ring + guitar-pick charm (his spare key).  Anchor: ring centre.
   * Natural size ≈ 260 × 220.  o.mode: 'laid' (default, on a surface/palm) | 'hang' (held by the ring)
   * o.swing (rad, for 'hang')  o.pick: colour of the pick charm (default '#7fb6d9' pearloid blue)
   */
  function paintKey(c, D, o) {
    const { T, lx, ly } = D; const hang = o.mode === 'hang';
    const keyAng = hang ? Math.PI / 2 + (o.swing || 0) : (o.keyAng === undefined ? 0.62 : o.keyAng);
    const pickAng = hang ? Math.PI / 2 + (o.swing || 0) * 1.4 + 0.25 : (o.pickAng === undefined ? 2.15 : o.pickAng);
    const RR = 30; // ring radius
    const shadow = o.shadow !== false && !hang;
    const metal = (x0, x1) => PV.linGrad(c, x0, -12, x1, 12, [[0, T.c('#f4f6f8')], [0.25, T.c('#b9c0c8')], [0.45, T.c('#eef1f4')], [0.6, T.c('#8d96a2')], [0.8, T.c('#d6dbe1')], [1, T.c('#7d8692')]]);
    // --- pick charm: a standard (351-shape) guitar pick on a jump ring
    function pick() {
      c.save(); c.rotate(pickAng); c.translate(RR + 6, 0);
      const ring2 = () => { c.beginPath(); c.ellipse(8, 0, 11.5, 5.5, 0, 0, TAU); };
      c.strokeStyle = T.a('#4a525e', D.ink); c.lineWidth = 3.4 + D.LW; ring2(); c.stroke();
      c.strokeStyle = T.c('#b4bcc6'); c.lineWidth = 2.6; ring2(); c.stroke();
      c.translate(12, 0); c.rotate(-Math.PI / 2);
      const pk = new Path2D();
      pk.moveTo(0, -1);
      pk.bezierCurveTo(16, -1.6, 30, 1, 33, 10); pk.bezierCurveTo(35.5, 17, 32, 25, 26, 33);
      pk.bezierCurveTo(18, 44, 7, 55, 1.6, 58.6); pk.quadraticCurveTo(0, 59.6, -1.6, 58.6);
      pk.bezierCurveTo(-7, 55, -18, 44, -26, 33); pk.bezierCurveTo(-32, 25, -35.5, 17, -33, 10);
      pk.bezierCurveTo(-30, 1, -16, -1.6, 0, -1); pk.closePath();
      if (shadow) { c.save(); c.translate(-lx * 6, -ly * 6 + 4); c.fillStyle = rgba(T.sh, 0.3); c.filter = 'blur(3px)'; c.fill(pk); c.restore(); }
      inkUnder(c, D, pk, '#1e3a58', 0.9);
      const col = o.pick || '#7fb6d9';
      c.fillStyle = PV.linGrad(c, -30, 0, 30, 58, [[0, T.c(mixH(col, '#ffffff', 0.5))], [0.45, T.c(col)], [1, T.c(mixH(col, '#1a2a4a', 0.4))]]); c.fill(pk);
      c.save(); c.clip(pk); const r = PV.rng(9);
      // pearloid swirls
      for (let i = 0; i < 10; i++) { c.fillStyle = T.a(i % 3 ? '#ffffff' : mixH(col, '#1a3050', 0.5), 0.14 + r() * 0.16); c.beginPath(); c.ellipse((r() - 0.5) * 50, 4 + r() * 50, 6 + r() * 12, 1.6 + r() * 3, r() * 3, 0, TAU); c.fill(); }
      c.strokeStyle = T.a('#ffffff', 0.3); c.lineWidth = 1.2; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc((r() - 0.5) * 30, 14 + r() * 30, 6 + r() * 9, r() * 6, r() * 6 + 2); c.stroke(); }
      // printed star logo
      c.save(); c.translate(0, 30); c.fillStyle = T.a('#ffffff', 0.85); c.beginPath(); for (let i = 0; i < 10; i++) { const a2 = i / 10 * TAU - Math.PI / 2, rr0 = i % 2 ? 3 : 7.5; i ? c.lineTo(Math.cos(a2) * rr0, Math.sin(a2) * rr0) : c.moveTo(Math.cos(a2) * rr0, Math.sin(a2) * rr0); } c.closePath(); c.fill(); c.restore();
      // bevelled edge: bright on the lit side, dark on the far side
      c.strokeStyle = rgba(T.hi, 0.9); c.lineWidth = 2.4; c.stroke(moved(pk, 1.4, 1.4));
      c.strokeStyle = T.a(mixH(col, '#0a1a30', 0.6), 0.45); c.lineWidth = 2; c.stroke(moved(pk, -1.2, -1.2));
      c.restore();
      // hole + the bit of the jump ring passing through it
      c.fillStyle = T.c('#24384e'); c.beginPath(); c.arc(0, 7.5, 3, 0, TAU); c.fill();
      c.strokeStyle = T.c('#c6ccd4'); c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 7.5); c.lineTo(0, -4); c.stroke();
      c.strokeStyle = rgba(T.hi, 0.8); c.lineWidth = 1; c.beginPath(); c.moveTo(-0.7, 6); c.lineTo(-0.7, -3); c.stroke();
      inkStroke(c, D, pk, '#1e3a58', 0.8);
      c.restore();
    }
    // --- key
    function key() {
      c.save(); c.rotate(keyAng); c.translate(RR - 6, 0);
      const k = new Path2D();
      // bow (head) with a hole
      k.moveTo(0, -24); k.bezierCurveTo(-10, -24, -12, -10, -12, 0); k.bezierCurveTo(-12, 10, -10, 24, 0, 24);
      k.bezierCurveTo(26, 26, 48, 22, 52, 12); k.lineTo(58, 10); k.lineTo(58, 7.5);
      // blade with bitting cuts along the bottom edge
      k.lineTo(170, 7.5); k.lineTo(176, 2); k.lineTo(176, -1);
      const cuts = [[166, -4], [158, -10], [150, -6], [142, -12], [132, -8], [122, -12], [112, -6], [102, -11], [92, -7], [82, -9], [72, -8]];
      for (const q of cuts) k.lineTo(q[0], q[1] - 2);
      k.lineTo(62, -9); k.lineTo(58, -10); k.lineTo(52, -12);
      k.bezierCurveTo(48, -22, 26, -26, 0, -24); k.closePath();
      k.moveTo(8, 0); k.arc(2, 0, 7, 0, TAU, true);
      if (shadow) { c.save(); c.rotate(-keyAng); c.translate(-lx * 7, -ly * 7 + 5); c.rotate(keyAng); c.fillStyle = rgba(T.sh, 0.32); c.filter = 'blur(3px)'; c.fill(k, 'evenodd'); c.restore(); }
      c.save(); c.strokeStyle = T.a('#3a424e', D.ink); c.lineWidth = D.LW * 2; c.lineJoin = 'round'; c.stroke(k); c.restore();
      c.fillStyle = metal(0, 60); c.fill(k, 'evenodd');
      c.save(); c.clip(k, 'evenodd');
      // groove along the blade + hard specular bands (anime metal)
      c.fillStyle = T.a('#6c7682', 0.55); c.fillRect(62, -2.2, 108, 3.4);
      c.fillStyle = rgba(T.hi, 0.9); c.fillRect(62, -6.5, 104, 2); c.fillRect(-10, -12, 50, 3);
      c.fillStyle = T.a('#5a6470', 0.35); c.fillRect(62, 3.5, 108, 3.5);
      c.restore();
      c.restore();
    }
    // --- split ring (two turns)
    function ring(front) {
      c.save(); c.lineCap = 'round';
      const arcs = front ? [[-0.4, 2.6]] : [[2.6, 5.9]];
      for (const [a0, a1] of arcs) {
        c.strokeStyle = T.a('#4a525e', D.ink); c.lineWidth = 6 + D.LW * 2; c.beginPath(); c.arc(0, 0, RR, a0, a1); c.stroke();
        c.strokeStyle = T.c('#aeb6c0'); c.lineWidth = 6; c.beginPath(); c.arc(0, 0, RR, a0, a1); c.stroke();
        c.strokeStyle = rgba(T.hi, 0.9); c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, RR - 1.2, a0 + 0.2, a1 - 0.2); c.stroke();
        c.strokeStyle = T.c('#c3cad2'); c.lineWidth = 4; c.beginPath(); c.arc(0, 0, RR + 3.2, a0 + 0.3, a0 + 1.8); c.stroke();
      }
      c.restore();
    }
    if (shadow) { c.save(); c.translate(-lx * 6, -ly * 6 + 4); c.strokeStyle = rgba(T.sh, 0.3); c.lineWidth = 8; c.filter = 'blur(3px)'; c.beginPath(); c.arc(0, 0, RR, 0, TAU); c.stroke(); c.restore(); }
    ring(false); pick(); key(); ring(true);
  }
  L.key = function (ctx, o) {
    o = o || {};
    const key = 'key|' + [o.mode, (o.swing || 0).toFixed(2), o.keyAng, o.pickAng, o.pick, o.shadow].join(',');
    staticProp(ctx, o, key, 520, 520, 260, 260, (c, D) => paintKey(c, D, o));
  };

  /* ===================================================================== HAND CREAM
   * 誕生日プレゼント: hand-cream tube + aluminium carrying tin.
   * Anchor: centre of the arrangement (surface level).  Natural size ≈ 520 × 300.
   * o.tube (default true)  o.tin (default true)  o.open (tin lid off, cream visible)
   * o.giftBox: the opened present — sage box with gold-foil mark, lid leaning behind, crisp faceted tissue
   *   with the tin nested in it, untied satin ribbon; the tube lies in front.  o.tubeAt {x,y,rot}, o.tinAt {x,y}
   */
  function paintTube(c, D, o) {
    const { T, lx, ly } = D;
    const Lt = 300, R0 = 30; // tube from crimp (x=-Lt/2) to shoulder
    if (o.shadow !== false) { c.save(); c.translate(-lx * 16, -ly * 10 + 16); c.fillStyle = rgba(T.sh, 0.32); c.filter = 'blur(6px)'; c.fill(rr(-Lt / 2, -R0 * 0.9, Lt + 40, R0 * 1.8, R0)); c.restore(); }
    // body: flattens toward the crimp
    const b = new Path2D();
    b.moveTo(-Lt / 2, -R0 * 1.18); b.bezierCurveTo(-Lt * 0.1, -R0 * 1.12, Lt * 0.25, -R0, Lt * 0.4, -R0 * 0.98);
    b.quadraticCurveTo(Lt * 0.47, -R0 * 0.96, Lt * 0.5, -R0 * 0.6); b.lineTo(Lt * 0.5, R0 * 0.6); b.quadraticCurveTo(Lt * 0.47, R0 * 0.96, Lt * 0.4, R0 * 0.98);
    b.bezierCurveTo(Lt * 0.25, R0, -Lt * 0.1, R0 * 1.12, -Lt / 2, R0 * 1.18); b.closePath();
    inkUnder(c, D, b, '#6a5a4a', 1);
    c.fillStyle = PV.linGrad(c, 0, -R0, 0, R0, [[0, T.c('#fffdf8')], [0.3, T.c('#f5efe4')], [0.7, T.c('#e6dccb')], [1, T.c('#b9ad99')]]); c.fill(b);
    c.save(); c.clip(b);
    // label band + text
    c.fillStyle = PV.linGrad(c, 0, -R0, 0, R0, [[0, T.c('#c9d8c2')], [0.5, T.c('#a9c0a2')], [1, T.c('#7d9676')]]); c.fillRect(-Lt * 0.18, -R0 * 1.3, Lt * 0.42, R0 * 2.6);
    c.fillStyle = T.a('#ffffff', 0.92); c.font = 'italic 600 15px "Cormorant", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('fleur de pommier', Lt * 0.03, -5); c.font = '500 8px "Inter", sans-serif'; c.fillText('H A N D   C R E A M', Lt * 0.03, 10);
    // tiny apple-blossom mark
    c.save(); c.translate(-Lt * 0.25, 0); c.fillStyle = T.a('#d9a6a0', 0.9); for (let i = 0; i < 5; i++) { c.rotate(TAU / 5); c.beginPath(); c.ellipse(0, -5, 3.2, 4.6, 0, 0, TAU); c.fill(); } c.fillStyle = T.c('#e8c46a'); c.beginPath(); c.arc(0, 0, 2, 0, TAU); c.fill(); c.restore();
    // satin sheen
    c.fillStyle = PV.linGrad(c, 0, -R0, 0, R0, [[0, T.hi, 0], [0.18, T.hi, 0.75], [0.3, T.hi, 0.05], [0.8, T.hi, 0], [0.9, T.hi, 0.18], [1, T.hi, 0]]); c.fillRect(-Lt, -R0 * 1.5, Lt * 2, R0 * 3);
    c.restore();
    // crimped seal
    const cr0 = rr(-Lt / 2 - 14, -R0 * 1.24, 18, R0 * 2.48, 2);
    c.fillStyle = PV.linGrad(c, 0, -R0, 0, R0, [[0, T.c('#f3ece0')], [1, T.c('#c4b8a4')]]); c.fill(cr0);
    c.strokeStyle = T.a('#9a8e7a', 0.8); c.lineWidth = 0.9; for (let i = -10; i <= 10; i++) { c.beginPath(); c.moveTo(-Lt / 2 - 12, i * R0 * 0.115); c.lineTo(-Lt / 2 + 2, i * R0 * 0.115); c.stroke(); }
    inkStroke(c, D, cr0, '#6a5a4a', 0.8);
    // cap (brushed champagne gold)
    const cp = rr(Lt * 0.5 - 2, -R0 * 0.86, 58, R0 * 1.72, [4, 10, 10, 4]);
    inkUnder(c, D, cp, '#5a4422', 1);
    c.fillStyle = PV.linGrad(c, 0, -R0, 0, R0, [[0, T.c('#fff1d0')], [0.22, T.c('#e2c28a')], [0.45, T.c('#f6e2b8')], [0.7, T.c('#b8945a')], [1, T.c('#8a6a3a')]]); c.fill(cp);
    c.save(); c.clip(cp); c.strokeStyle = T.a('#8a6a3a', 0.35); c.lineWidth = 0.8; for (let i = 0; i < 14; i++) { const x = Lt * 0.5 + 4 + i * 4; c.beginPath(); c.moveTo(x, -R0); c.lineTo(x, R0); c.stroke(); } c.restore();
  }
  function paintTin(c, D, o) {
    const { T, lx, ly } = D; const R = 70, Ht = 26, k = 0.55;
    if (o.shadow !== false) { c.save(); c.translate(-lx * 18, -ly * 10 + 10); c.fillStyle = rgba(T.sh, 0.36); c.filter = 'blur(6px)'; c.beginPath(); c.ellipse(0, 6, R, R * k, 0, 0, TAU); c.fill(); c.restore(); }
    const brushed = (cx, cy, rx, ry) => {
      const g = c.createConicGradient ? c.createConicGradient(D.la + 0.4, cx, cy) : null;
      if (!g) return T.c('#d4d9de');
      const stops = [[0, '#f6f8fa'], [0.12, '#aab2bc'], [0.25, '#e8ecf0'], [0.38, '#8e98a4'], [0.5, '#f6f8fa'], [0.62, '#aab2bc'], [0.75, '#e2e6ea'], [0.88, '#8e98a4'], [1, '#f6f8fa']];
      for (const s of stops) g.addColorStop(s[0], T.c(s[1])); return g;
    };
    // body side
    const side = new Path2D(); side.moveTo(-R, 0); side.lineTo(-R, Ht); side.ellipse(0, Ht, R, R * k, 0, Math.PI, 0, true); side.lineTo(R, 0); side.ellipse(0, 0, R, R * k, 0, 0, Math.PI, false); side.closePath();
    inkUnder(c, D, side, '#3a424e', 1);
    c.fillStyle = PV.linGrad(c, -R, 0, R, 0, [[0, T.c('#eef1f4')], [0.18, T.c('#a9b1bb')], [0.4, T.c('#dfe4e9')], [0.7, T.c('#8790a0')], [1, T.c('#c4cad2')]]); c.fill(side);
    if (o.open) {
      // open: cream inside, lid leaning behind
      c.save(); c.translate(R * 0.9, -R * 0.75); c.rotate(0.35);
      const lid = ell(0, 0, R * 1.02, R * 0.92); inkUnder(c, D, lid, '#3a424e', 1); c.fillStyle = brushed(0, 0); c.fill(lid);
      c.strokeStyle = T.a('#7d8692', 0.6); c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, R * 0.78, R * 0.7, 0, 0, TAU); c.stroke();
      c.restore();
      const rim = ell(0, 0, R, R * k); c.fillStyle = T.c('#c9cfd6'); c.fill(rim); inkStroke(c, D, rim, '#3a424e', 0.9);
      const cream = ell(0, 3, R * 0.9, R * k * 0.88);
      c.fillStyle = PV.radGrad(c, lx * 18, ly * 10, 2, R, [[0, T.c('#ffffff')], [1, T.c('#ece6dc')]]); c.fill(cream);
      c.save(); c.clip(cream); c.strokeStyle = T.a('#d8d0c2', 0.9); c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 60; i++) { const a = i * 0.32, rr0 = 4 + i * 0.95; const x = Math.cos(a) * rr0, y = 3 + Math.sin(a) * rr0 * k; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      c.strokeStyle = rgba(T.hi, 0.9); c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 60; i++) { const a = i * 0.32, rr0 = 4 + i * 0.95; const x = Math.cos(a) * rr0 - 1, y = 2 + Math.sin(a) * rr0 * k; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore();
    } else {
      const top = ell(0, 0, R, R * k); c.fillStyle = brushed(0, 0); c.fill(top);
      c.save(); c.clip(top);
      for (let i = 1; i < 22; i++) { c.strokeStyle = T.a(i % 2 ? '#ffffff' : '#7d8692', 0.12); c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, R * i / 22, R * k * i / 22, 0, 0, TAU); c.stroke(); }
      // embossed ring + a small engraved mark
      c.strokeStyle = T.a('#ffffff', 0.7); c.lineWidth = 1.6; c.beginPath(); c.ellipse(-1, -1, R * 0.72, R * k * 0.72, 0, 0, TAU); c.stroke();
      c.strokeStyle = T.a('#6c7682', 0.6); c.lineWidth = 1.6; c.beginPath(); c.ellipse(1, 1, R * 0.72, R * k * 0.72, 0, 0, TAU); c.stroke();
      c.fillStyle = T.a('#6c7682', 0.75); c.font = 'italic 600 13px "Cormorant", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.save(); c.scale(1, k); c.fillText('fleur de pommier', 0, 0); c.restore();
      c.restore();
      inkStroke(c, D, top, '#3a424e', 0.9);
      glossy(c, lx * R * 0.4, ly * R * k * 0.4, R * 0.36, R * k * 0.16, -0.3, T.hi, 0.6);
    }
    if (D.rimA > 0) crescent(c, side, -lx * 3, -ly * 3, rgba(T.rim, D.rimA * 0.6));
  }
  // opened gift box: sage-green box with gold-foil mark, lid leaning behind it, crisp crumpled tissue
  // (faceted, shaded per facet), contents nested in the tissue, an untied satin ribbon on the table.
  function paintGiftBox(c, D, o, contents) {
    const { T, lx, ly } = D; const P = cam(0.16, 0.9);
    const bw = 236, bd = 172, bh = 60, tw = 5;
    const L3 = (() => { const v = [lx, 1.0, -ly * 0.6]; const l = Math.hypot(...v); return v.map(q => q / l); })();
    const box = { side: '#9db896', sideDark: '#6f8c6a', rim: '#c9dcc2', inner: '#e9efe2', innerDark: '#c3d0bc', line: '#3e5a40' };
    const Q = (pts) => polyP(pts.map(p => P(...p)));
    softEll(c, -lx * 30, 26, bw * 0.78, bd * 0.42, T.sh, 0.42);
    // ---- lid leaning against the back of the box (outer face toward the camera)
    const lean = 0.42, LH = bd + 10, LW = bw + 10, zb = bd / 2 + 14;
    const lc = (u, v) => [lerp(-LW / 2, LW / 2, u), Math.cos(lean) * LH * v, zb + Math.sin(lean) * LH * v];
    const lidF = Q([lc(0, 0), lc(1, 0), lc(1, 1), lc(0, 1)]);
    const lidE = Q([lc(0, 1), lc(1, 1), [LW / 2, Math.cos(lean) * LH + 9, zb + Math.sin(lean) * LH - 6], [-LW / 2, Math.cos(lean) * LH + 9, zb + Math.sin(lean) * LH - 6]]);
    c.save(); c.translate(-lx * 22, 8); c.filter = 'blur(8px)'; c.fillStyle = rgba(T.sh, 0.3); c.fill(lidF); c.restore();
    c.fillStyle = T.c(box.sideDark); c.fill(lidE); inkStroke(c, D, lidE, box.line, 0.7);
    inkUnder(c, D, lidF, box.line, 1);
    const l0 = P(...lc(0, 1)), l1 = P(...lc(1, 0));
    c.fillStyle = PV.linGrad(c, l0[0], l0[1], l1[0], l1[1], [[0, T.c(mixH(box.side, '#ffffff', 0.25))], [0.6, T.c(box.side)], [1, T.c(box.sideDark)]]); c.fill(lidF);
    // gold-foil mark on the lid (affine-mapped onto the face)
    { const a = P(...lc(0, 0)), b = P(...lc(1, 0)), d2 = P(...lc(0, 1));
      c.save(); c.clip(lidF); c.transform((b[0] - a[0]) / LW, (b[1] - a[1]) / LW, (d2[0] - a[0]) / LH, (d2[1] - a[1]) / LH, a[0], a[1]);
      c.translate(LW / 2, LH * 0.55); c.scale(1, -1);
      c.strokeStyle = T.a('#e8cf8e', 0.9); c.lineWidth = 1.6; c.strokeRect(-LW * 0.36, -LH * 0.3, LW * 0.72, LH * 0.6);
      c.fillStyle = T.c('#efd796'); c.font = 'italic 600 21px "Cormorant", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('fleur de pommier', 0, -4);
      c.font = '500 8px "Inter", sans-serif'; c.fillText('H A N D   C A R E', 0, 16);
      c.save(); c.translate(0, -30); for (let i = 0; i < 5; i++) { c.rotate(TAU / 5); c.beginPath(); c.ellipse(0, -5, 3, 4.4, 0, 0, TAU); c.fill(); } c.restore();
      c.restore(); }
    c.save(); c.clip(lidF); c.fillStyle = PV.linGrad(c, l0[0], l0[1], l1[0], l1[1], [[0.15, T.hi, 0], [0.25, T.hi, 0.22], [0.33, T.hi, 0], [1, T.hi, 0]]); c.fill(lidF); c.restore();
    inkStroke(c, D, lidF, box.line, 0.8);
    // ---- box: inner walls (back & left), visible above the tissue
    const X0 = -bw / 2, X1 = bw / 2, Z0 = -bd / 2, Z1 = bd / 2;
    const innerBack = Q([[X0 + tw, 0, Z1 - tw], [X1 - tw, 0, Z1 - tw], [X1 - tw, bh, Z1 - tw], [X0 + tw, bh, Z1 - tw]]);
    const innerLeft = Q([[X0 + tw, 0, Z0 + tw], [X0 + tw, 0, Z1 - tw], [X0 + tw, bh, Z1 - tw], [X0 + tw, bh, Z0 + tw]]);
    c.fillStyle = T.c(box.innerDark); c.fill(innerBack); c.fillStyle = T.c(mixH(box.inner, box.innerDark, 0.4)); c.fill(innerLeft);
    // ---- tissue: a faceted crumpled sheet over the opening, nest in the middle, drapes over front/right rims
    const NX = 10, NZ = 7, mg = 13; const rT = PV.rng(41);
    const V = [];
    for (let j = 0; j <= NZ; j++) { V.push([]); for (let i = 0; i <= NX; i++) {
      const x = lerp(X0 - mg, X1 + mg, i / NX), z = lerp(Z0 - mg, Z1 + 8, j / NZ);
      const ix = Math.max(X0 + tw - x, x - (X1 - tw), 0), iz = Math.max(Z0 + tw - z, 0); // distance beyond the front / side walls
      let y = bh * 0.78 + (rT() - 0.5) * 18 + 8 * Math.sin(i * 1.7 + j * 2.3);
      const nd = Math.hypot(x / (bw * 0.3), (z + 6) / (bd * 0.3)); if (nd < 1) y -= (1 - nd * nd) * bh * 0.42; // nest
      if (ix > 0 || iz > 0) y = bh + 3 - Math.max(ix, iz) * 0.9 + (rT() - 0.5) * 5; // folds over the rim and droops a little
      if (z > Z1 - tw) y = Math.min(y, bh + 2);
      V[j].push([x + (rT() - 0.5) * 10, y, z + (rT() - 0.5) * 8]);
    } }
    const tris = [];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const a = V[j][i], b = V[j][i + 1], cc = V[j + 1][i + 1], d2 = V[j + 1][i];
      const flip = (i + j) % 2;
      tris.push(flip ? [a, b, cc] : [a, b, d2], flip ? [a, cc, d2] : [b, cc, d2]);
    }
    const outside = (p) => p[0] < X0 + tw - 1 || p[0] > X1 - tw + 1 || p[2] < Z0 + tw - 1;
    const tissueCol = (n) => { const lam = cl(n[0] * L3[0] + n[1] * L3[1] + n[2] * L3[2], 0, 1); return T.c(mixH('#e7d2db', '#fffdfd', Math.pow(lam, 0.7))); };
    const drawTris = (list) => {
      list.sort((A, B) => P.depth(...B.cen) - P.depth(...A.cen));
      for (const tr of list) {
        const pp = tr.v.map(q => P(...q)); const pa = new Path2D(); pa.moveTo(...pp[0]); pa.lineTo(...pp[1]); pa.lineTo(...pp[2]); pa.closePath();
        c.fillStyle = T.a(tissueCol(tr.n), 0.96); c.fill(pa); c.strokeStyle = c.fillStyle; c.lineWidth = 0.8; c.stroke(pa);
        if (tr.crease) { c.strokeStyle = T.a('#c9aab8', 0.55); c.lineWidth = 0.9; c.beginPath(); c.moveTo(...pp[0]); c.lineTo(...pp[1]); c.stroke(); }
      }
    };
    const inner = [], drape = [];
    for (const v3 of tris) {
      const e1 = [v3[1][0] - v3[0][0], v3[1][1] - v3[0][1], v3[1][2] - v3[0][2]], e2 = [v3[2][0] - v3[0][0], v3[2][1] - v3[0][1], v3[2][2] - v3[0][2]];
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const nl = Math.hypot(...n) || 1; n = n.map(q => q / nl); if (n[1] < 0) n = n.map(q => -q);
      const tr = { v: v3, n, cen: [(v3[0][0] + v3[1][0] + v3[2][0]) / 3, (v3[0][1] + v3[1][1] + v3[2][1]) / 3, (v3[0][2] + v3[1][2] + v3[2][2]) / 3], crease: rT() < 0.35 };
      (v3.some(outside) ? drape : inner).push(tr);
    }
    // tissue corners poking up out of the box (crisp two-facet flaps)
    const flap = (A, B, Tp, crease) => {
      const M2 = [lerp(A[0], B[0], crease), lerp(A[1], B[1], crease) + 4, lerp(A[2], B[2], crease)];
      const mk = (v3) => { const e1 = [v3[1][0] - v3[0][0], v3[1][1] - v3[0][1], v3[1][2] - v3[0][2]], e2 = [v3[2][0] - v3[0][0], v3[2][1] - v3[0][1], v3[2][2] - v3[0][2]]; let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const nl = Math.hypot(...n) || 1; n = n.map(q => q / nl); if (n[2] > 0) n = n.map(q => -q); return { v: v3, n, cen: v3[0], crease: true }; };
      return [mk([A, M2, Tp]), mk([M2, B, Tp])];
    };
    const backFlaps = [].concat(
      flap([X0 + 16, bh - 6, Z1 - 12], [X0 + 96, bh - 4, Z1 - 8], [X0 - 4, bh + 46, Z1 + 4], 0.55),
      flap([X1 - 104, bh - 6, Z1 - 8], [X1 - 18, bh - 6, Z1 - 16], [X1 + 6, bh + 40, Z1 - 4], 0.4),
      flap([X1 - 8, bh - 4, -36], [X1 - 8, bh - 4, 34], [X1 + 22, bh + 26, 2], 0.5));
    drawTris(backFlaps);
    // clip the inner tissue to the box opening
    const opening = Q([[X0 + tw, bh, Z0 + tw], [X1 - tw, bh, Z0 + tw], [X1 - tw, bh, Z1 - tw], [X0 + tw, bh, Z1 - tw]]);
    const below = new Path2D(); below.addPath(opening); { const a = P(X0 + tw, bh, Z0 + tw), b = P(X1 - tw, bh, Z0 + tw); below.addPath(polyP([a, b, [b[0], b[1] + 400], [a[0], a[1] + 400]])); }
    c.save(); c.clip(innerBack.constructor === Path2D ? (() => { const u = new Path2D(); u.addPath(opening); u.addPath(innerBack); u.addPath(innerLeft); u.addPath(polyP([P(X0 + tw, bh, Z0 + tw), P(X1 - tw, bh, Z0 + tw), P(X1 - tw, 0, Z0 + tw), P(X0 + tw, 0, Z0 + tw)])); return u; })() : opening);
    drawTris(inner);
    c.restore();
    // contents nested in the tissue
    if (contents) {
      const nc = P(0, bh * 0.5, -6);
      softEll(c, nc[0] - lx * 8, nc[1] + 18, 80, 30, '#8a6a78', 0.3);
      c.save(); c.translate(nc[0], nc[1] - 4); c.scale(0.82, 0.82); contents(c); c.restore();
    }
    // ---- outer walls (front & right) + rim
    const front = Q([[X0, 0, Z0], [X1, 0, Z0], [X1, bh, Z0], [X0, bh, Z0]]);
    const right = Q([[X1, 0, Z0], [X1, 0, Z1], [X1, bh, Z1], [X1, bh, Z0]]);
    inkUnder(c, D, front, box.line, 1); inkUnder(c, D, right, box.line, 1);
    const f0 = P(X0, 0, Z0), f1 = P(X1, 0, Z0);
    c.fillStyle = PV.linGrad(c, f0[0], 0, f1[0], 0, [[0, T.c(mixH(box.side, '#ffffff', 0.18))], [1, T.c(box.side)]]); c.fill(front);
    c.fillStyle = PV.linGrad(c, f1[0], 0, P(X1, 0, Z1)[0], 0, [[0, T.c(box.sideDark)], [1, T.c(mixH(box.sideDark, '#000000', 0.15))]]); c.fill(right);
    { const a = P(X0, 0, Z0), b = P(X1, 0, Z0), d2 = P(X0, bh, Z0); // gold-foil wordmark on the front
      c.save(); c.clip(front); c.transform((b[0] - a[0]) / bw, (b[1] - a[1]) / bw, (d2[0] - a[0]) / bh, (d2[1] - a[1]) / bh, a[0], a[1]); c.translate(bw / 2, bh * 0.45); c.scale(1, -1);
      c.fillStyle = T.c('#efd796'); c.font = 'italic 600 15px "Cormorant", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('fleur de pommier', 0, 0); c.restore(); }
    const rim = Q([[X0, bh, Z0], [X1, bh, Z0], [X1, bh, Z1], [X0, bh, Z1]]);
    const rimHole = Q([[X0 + tw, bh, Z0 + tw], [X1 - tw, bh, Z0 + tw], [X1 - tw, bh, Z1 - tw], [X0 + tw, bh, Z1 - tw]]);
    const ring = new Path2D(); ring.addPath(rim); ring.addPath(rimHole); c.fillStyle = T.c(box.rim); c.fill(ring, 'evenodd');
    inkStroke(c, D, front, box.line, 0.9); inkStroke(c, D, right, box.line, 0.9); inkStroke(c, D, rim, box.line, 0.7);
    if (D.rimA > 0) { crescent(c, front, -lx * 3, -ly * 3, rgba(T.rim, D.rimA * 0.5)); }
    // tissue drooping over the front / right rims
    drawTris(drape);
    // ---- untied satin ribbon on the table (two-tone faces, twisting, swallowtail ends)
    const rpts = []; const NR = 46;
    for (let i = 0; i <= NR; i++) { const f = i / NR; rpts.push([lerp(-bw * 1.08, bw * 0.62, f) + Math.sin(f * 6.0 + 0.3) * 52, 0, -bd * 0.6 - 34 - Math.sin(f * 3.6 + 0.8) * 38 - f * 16]); }
    const rw = 25; const face = '#c23650', back = '#8e1e34';
    for (let i = 0; i < NR; i++) {
      const p0 = rpts[i], p1 = rpts[i + 1]; const tw0 = Math.cos(i * 0.21 + 0.4), tw1 = Math.cos((i + 1) * 0.21 + 0.4);
      const dx = p1[0] - p0[0], dz = p1[2] - p0[2], dl = Math.hypot(dx, dz) || 1; const nx = -dz / dl, nz = dx / dl;
      const A0 = P(p0[0] + nx * rw * tw0 / 2, 0, p0[2] + nz * rw * tw0 / 2), B0 = P(p0[0] - nx * rw * tw0 / 2, 0, p0[2] - nz * rw * tw0 / 2);
      const A1 = P(p1[0] + nx * rw * tw1 / 2, 0, p1[2] + nz * rw * tw1 / 2), B1 = P(p1[0] - nx * rw * tw1 / 2, 0, p1[2] - nz * rw * tw1 / 2);
      const seg = polyP([A0, A1, B1, B0]); const up = (tw0 + tw1) > 0;
      c.fillStyle = T.c(up ? face : back); c.fill(seg); c.strokeStyle = c.fillStyle; c.lineWidth = 0.8; c.stroke(seg);
      if (up && Math.abs(tw0) > 0.45) { c.strokeStyle = rgba(T.hi, 0.55 * Math.abs(tw0)); c.lineWidth = 2; const m0 = P(p0[0] + nx * rw * tw0 * 0.15, 0, p0[2] + nz * rw * tw0 * 0.15), m1 = P(p1[0] + nx * rw * tw1 * 0.15, 0, p1[2] + nz * rw * tw1 * 0.15); c.beginPath(); c.moveTo(...m0); c.lineTo(...m1); c.stroke(); }
    }
    for (const end of [0, NR]) { // swallowtail ends
      const p0 = rpts[end], pn = rpts[end ? end - 1 : 1]; const dx = p0[0] - pn[0], dz = p0[2] - pn[2], dl = Math.hypot(dx, dz) || 1; const ux = dx / dl, uz = dz / dl, nx = -uz, nz = ux; const tw0 = Math.cos(end * 0.21 + 0.4);
      const a = P(p0[0] + nx * rw * tw0 / 2, 0, p0[2] + nz * rw * tw0 / 2), b = P(p0[0] - nx * rw * tw0 / 2, 0, p0[2] - nz * rw * tw0 / 2);
      const tA = P(p0[0] + ux * 14 + nx * rw * tw0 / 2, 0, p0[2] + uz * 14 + nz * rw * tw0 / 2), tB = P(p0[0] + ux * 14 - nx * rw * tw0 / 2, 0, p0[2] + uz * 14 - nz * rw * tw0 / 2), mid = P(p0[0] + ux * 5, 0, p0[2] + uz * 5);
      const tail = polyP([a, tA, mid, tB, b]); c.fillStyle = T.c(tw0 > 0 ? face : back); c.fill(tail);
    }
    const rib = new Path2D(); rpts.forEach((p, i) => { const q = P(...p); i ? rib.lineTo(q[0], q[1]) : rib.moveTo(q[0], q[1]); });
    c.save(); c.globalCompositeOperation = 'destination-over'; c.translate(-lx * 5, 5); c.strokeStyle = rgba(T.sh, 0.28); c.lineWidth = rw * 0.9; c.lineCap = 'round'; c.filter = 'blur(3px)'; c.stroke(rib); c.restore();
  }
  L.handCream = function (ctx, o) {
    o = o || {};
    const key = 'cream2|' + [o.tube, o.tin, o.open, o.giftBox, o.shadow, JSON.stringify(o.tubeAt || 0), JSON.stringify(o.tinAt || 0)].join(',');
    staticProp(ctx, o, key, 820, 640, 410, 350, (c, D) => {
      if (o.giftBox) {
        // the tin sits in the tissue inside the opened box, the tube lies in front of it
        c.save(); c.translate(-30, -30);
        paintGiftBox(c, D, o, o.tin !== false ? (cc) => paintTin(cc, D, Object.assign({}, o, { shadow: false })) : null);
        c.restore();
        if (o.tube !== false) { const ta = o.tubeAt || { x: 60, y: 150, rot: -0.1 }; c.save(); c.translate(ta.x, ta.y); c.rotate(ta.rot || 0); paintTube(c, D, o); c.restore(); }
        return;
      }
      if (o.tin !== false) { const ia = o.tinAt || { x: 205, y: -52 }; c.save(); c.translate(ia.x, ia.y); paintTin(c, D, o); c.restore(); }
      if (o.tube !== false) { const ta = o.tubeAt || { x: -95, y: 48, rot: -0.2 }; c.save(); c.translate(ta.x, ta.y); c.rotate(ta.rot || 0); paintTube(c, D, o); c.restore(); }
    });
  };

  /* ===================================================================== PHONE
   * Smartphone (portrait).  Anchor: centre of the phone.  Natural size 300×620.
   * o.screen: 'message' | 'player' | 'photo' | 'off' | 'call' | 'lock' | 'none'
   *   message: o.messages=[{text, me, at?}], o.name (header), o.reveal (s per message, animates),
   *            o.typing (bool: "…" bubble), o.clock ('12:41')
   *   player : o.title, o.artist, o.progress (0..1) | o.duration (s, progress from t), o.paused, o.drawArt(ctx,w,h)
   *   photo  : o.drawPhoto(ctx, w, h, t) draws the picture inside the screen; o.ui (default true)
   *   off    : black glass with a faint reflection of a face (o.reflect 0..1, default 0.6)
   *   call   : o.name, ringing pulse; o.vibrate makes the body buzz
   *   lock   : o.clock, o.date, o.notice = {app, title, text}
   * o.notify: true|'#hex' blinking notification LED (top bezel).  o.glow: light spill (0..1)
   * o.bright: screen brightness 0..1   o.back: true → back side (face down)   o.case: '#hex'
   */
  const UIF = '"IPAPGothic", "IPAGothic", sans-serif', NUMF = '"Inter", "DejaVu Sans", sans-serif';
  function wrapJP(c, text, maxW) {
    const lines = []; let cur = '';
    for (const ch of Array.from(text)) {
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      if (c.measureText(cur + ch).width > maxW && cur) { // keep closing punctuation on the line
        if ('、。…」）！？'.includes(ch)) { cur += ch; lines.push(cur); cur = ''; continue; }
        lines.push(cur); cur = ch;
      } else cur += ch;
    }
    if (cur) lines.push(cur); return lines;
  }
  function statusBar(c, w, clock, dark) {
    c.fillStyle = dark ? 'rgba(255,255,255,0.92)' : 'rgba(30,34,44,0.85)';
    c.font = `600 15px ${NUMF}`; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(clock === undefined ? '12:41' : clock, 16, 15);
    c.textAlign = 'right';
    // battery + signal
    c.strokeStyle = c.fillStyle; c.lineWidth = 1.4; c.strokeRect(w - 40, 9, 22, 11); c.fillRect(w - 38, 11, 14, 7); c.fillRect(w - 17, 12.5, 2, 4);
    for (let i = 0; i < 4; i++) c.fillRect(w - 68 + i * 5, 19 - i * 3, 3.2, 3 + i * 3);
  }
  function phoneScreen(c, t, o, w, h) {
    const mode = o.screen || 'message';
    c.save(); c.textBaseline = 'alphabetic';
    if (mode === 'message') {
      c.fillStyle = '#eef1f5'; c.fillRect(0, 0, w, h);
      // header
      c.fillStyle = '#fbfcfd'; c.fillRect(0, 0, w, 76);
      statusBar(c, w, o.clock, false);
      c.fillStyle = '#2b3240'; c.font = `600 19px ${UIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.name || '先輩', w / 2, 52);
      c.strokeStyle = '#4a7bd0'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(22, 44); c.lineTo(14, 52); c.lineTo(22, 60); c.stroke();
      c.fillStyle = '#d6dbe3'; c.fillRect(0, 75, w, 1);
      // messages, bottom-aligned, newest at the bottom
      const msgs = o.messages || [];
      const rev = o.reveal || 0; const visible = [];
      msgs.forEach((m, i) => { const at = m.at !== undefined ? m.at : (rev ? i * rev : -1); const age = t - at; if (age >= 0 || !rev) visible.push({ m, age: rev || m.at !== undefined ? age : 9 }); });
      c.font = `500 17px ${UIF}`;
      const maxW = w * 0.62, lh = 24, padX = 13, padY = 10;
      const blocks = visible.map(({ m, age }) => { const lines = wrapJP(c, m.text, maxW - padX * 2); const bw = Math.max(...lines.map(l => c.measureText(l).width)) + padX * 2; return { m, age, lines, bw, bh: lines.length * lh + padY * 2 - 4 }; });
      if (o.typing) blocks.push({ typing: true, age: 9, bw: 62, bh: 36, m: { me: false } });
      let y = h - 64; const inputY = h - 52;
      for (let i = blocks.length - 1; i >= 0; i--) {
        const B = blocks[i]; y -= B.bh + 16; if (y < 70) break;
        const pop = Math.min(1, Math.max(0, B.age / 0.28)); const ease = PV.ease.outBack(pop);
        const me = B.m.me; const x = me ? w - 14 - B.bw : 14 + (me ? 0 : 0);
        c.save(); c.globalAlpha *= Math.min(1, pop * 1.5);
        const cx = me ? x + B.bw : x, cy = y + B.bh; c.translate(cx, cy); c.scale(0.85 + 0.15 * ease, 0.85 + 0.15 * ease); c.translate(-cx, -cy);
        const bub = new Path2D(); bub.roundRect(x, y, B.bw, B.bh, 16);
        // tail
        if (me) { bub.moveTo(x + B.bw - 10, y + B.bh - 12); bub.quadraticCurveTo(x + B.bw + 2, y + B.bh, x + B.bw + 8, y + B.bh + 1); bub.quadraticCurveTo(x + B.bw - 4, y + B.bh + 2, x + B.bw - 18, y + B.bh - 4); }
        else { bub.moveTo(x + 10, y + B.bh - 12); bub.quadraticCurveTo(x - 2, y + B.bh, x - 8, y + B.bh + 1); bub.quadraticCurveTo(x + 4, y + B.bh + 2, x + 18, y + B.bh - 4); }
        c.fillStyle = me ? '#bfe0ff' : '#ffffff'; c.fill(bub);
        if (!me) { c.strokeStyle = '#d9dee6'; c.lineWidth = 1; c.stroke(bub); }
        if (B.typing) {
          for (let k = 0; k < 3; k++) { const ph = (t * 2.2 - k * 0.22) % 1; c.fillStyle = `rgba(120,128,140,${0.35 + 0.6 * Math.max(0, Math.sin(ph * Math.PI))})`; c.beginPath(); c.arc(x + 18 + k * 13, y + B.bh / 2, 4, 0, TAU); c.fill(); }
        } else {
          c.fillStyle = '#1f2633'; c.textAlign = 'left'; c.textBaseline = 'top'; c.font = `500 17px ${UIF}`;
          B.lines.forEach((l, j) => c.fillText(l, x + padX, y + padY + j * lh));
          if (B.m.time || o.stamps !== false) { c.fillStyle = '#8a93a2'; c.font = `500 10px ${NUMF}`; c.textAlign = me ? 'right' : 'left'; c.textBaseline = 'bottom'; c.fillText(B.m.time || '', me ? x - 6 : x + B.bw + 6, y + B.bh); if (me && B.m.read) c.fillText('既読', x - 6, y + B.bh - 12); }
        }
        c.restore();
      }
      // input bar
      c.fillStyle = '#fbfcfd'; c.fillRect(0, inputY - 10, w, h - inputY + 10);
      c.fillStyle = '#eef1f5'; c.beginPath(); c.roundRect(46, inputY, w - 92, 34, 17); c.fill();
      c.fillStyle = '#a3abb8'; c.font = `500 13px ${UIF}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('メッセージを入力', 60, inputY + 17);
      c.strokeStyle = '#8a95a8'; c.lineWidth = 2; c.beginPath(); c.arc(24, inputY + 17, 10, 0, TAU); c.moveTo(24, inputY + 11); c.lineTo(24, inputY + 23); c.moveTo(18, inputY + 17); c.lineTo(30, inputY + 17); c.stroke();
      c.fillStyle = '#4a7bd0'; c.beginPath(); c.moveTo(w - 34, inputY + 8); c.lineTo(w - 14, inputY + 17); c.lineTo(w - 34, inputY + 26); c.lineTo(w - 30, inputY + 17); c.closePath(); c.fill();
    } else if (mode === 'player') {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a3350'); g.addColorStop(1, '#0f1424'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      statusBar(c, w, o.clock, true);
      const as = w - 56, ax = 28, ay = 70;
      c.save(); c.beginPath(); c.roundRect(ax, ay, as, as, 10); c.clip();
      if (o.drawArt) o.drawArt(c, as, as, t); else {
        c.translate(ax, ay);
        const ag = c.createLinearGradient(0, 0, as, as); ag.addColorStop(0, '#f6c79a'); ag.addColorStop(0.5, '#c86a7a'); ag.addColorStop(1, '#3b3f7a'); c.fillStyle = ag; c.fillRect(0, 0, as, as);
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(as * 0.68, as * 0.34, as * 0.2, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.4; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, as * (0.62 + i * 0.05)); c.bezierCurveTo(as * 0.3, as * (0.55 + i * 0.05), as * 0.6, as * (0.72 + i * 0.04), as, as * (0.6 + i * 0.05)); c.stroke(); }
      }
      c.restore();
      c.fillStyle = '#ffffff'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.font = `600 21px ${UIF}`; c.fillText(o.title || '放課後の音楽室', ax, ay + as + 42);
      c.fillStyle = 'rgba(255,255,255,0.65)'; c.font = `500 15px ${UIF}`; c.fillText(o.artist || '', ax, ay + as + 66);
      const prog = o.progress !== undefined ? o.progress : (o.duration ? (t / o.duration) % 1 : 0.35);
      const by = ay + as + 96; c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(ax, by, as, 4); c.fillStyle = '#ffffff'; c.fillRect(ax, by, as * prog, 4); c.beginPath(); c.arc(ax + as * prog, by + 2, 7, 0, TAU); c.fill();
      const tot = o.length || 238, el = Math.floor(tot * prog); const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = `500 12px ${NUMF}`; c.fillText(fmt(el), ax, by + 24); c.textAlign = 'right'; c.fillText('-' + fmt(tot - el), ax + as, by + 24);
      // controls
      const cy = by + 74, cx = w / 2; c.fillStyle = '#ffffff';
      const tri = (x, y, s, dir) => { c.beginPath(); c.moveTo(x - s * dir, y - s); c.lineTo(x + s * dir, y); c.lineTo(x - s * dir, y + s); c.closePath(); c.fill(); };
      tri(cx - 78, cy, 10, -1); tri(cx - 92, cy, 10, -1); tri(cx + 78, cy, 10, 1); tri(cx + 92, cy, 10, 1);
      c.beginPath(); c.arc(cx, cy, 30, 0, TAU); c.fill(); c.fillStyle = '#1b2236';
      if (o.paused) tri(cx + 3, cy, 12, 1); else { c.fillRect(cx - 9, cy - 11, 6, 22); c.fillRect(cx + 3, cy - 11, 6, 22); }
    } else if (mode === 'photo') {
      c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      if (o.drawPhoto) { c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip(); o.drawPhoto(c, w, h, t); c.restore(); }
      if (o.ui !== false) {
        c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(0, 0, w, 64); c.fillRect(0, h - 58, w, 58);
        statusBar(c, w, o.clock, true);
        c.fillStyle = 'rgba(255,255,255,0.9)'; c.font = `500 13px ${UIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.caption || '', w / 2, 48);
        c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(40, h - 38); c.lineTo(40, h - 20); c.lineTo(56, h - 20); c.lineTo(56, h - 38); c.stroke();
        c.beginPath(); c.moveTo(w / 2 - 10, h - 34); c.bezierCurveTo(w / 2 - 10, h - 44, w / 2, h - 42, w / 2, h - 36); c.bezierCurveTo(w / 2, h - 42, w / 2 + 10, h - 44, w / 2 + 10, h - 34); c.lineTo(w / 2, h - 22); c.closePath(); c.stroke();
        c.strokeRect(w - 58, h - 38, 18, 18);
      }
    } else if (mode === 'call') {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a5f7a'); g.addColorStop(1, '#16243a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      statusBar(c, w, o.clock, true);
      const ay = 190; const pulse = (t * 0.9) % 1;
      for (let k = 0; k < 2; k++) { const p = (pulse + k * 0.5) % 1; c.strokeStyle = `rgba(255,255,255,${0.45 * (1 - p)})`; c.lineWidth = 2; c.beginPath(); c.arc(w / 2, ay, 50 + p * 60, 0, TAU); c.stroke(); }
      c.fillStyle = '#d7e4ee'; c.beginPath(); c.arc(w / 2, ay, 50, 0, TAU); c.fill();
      c.fillStyle = '#5c7a92'; c.font = `600 38px ${UIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((o.name || '先輩').slice(0, 1), w / 2, ay + 2);
      c.fillStyle = '#ffffff'; c.font = `600 25px ${UIF}`; c.fillText(o.name || '先輩', w / 2, ay + 100);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.font = `500 14px ${UIF}`; c.fillText(o.sub || '着信中…', w / 2, ay + 132);
      const by = h - 92;
      c.fillStyle = '#e8474b'; c.beginPath(); c.arc(w * 0.27, by, 30, 0, TAU); c.fill();
      c.fillStyle = '#35c26a'; c.beginPath(); c.arc(w * 0.73, by + Math.sin(t * 12) * (o.vibrate ? 2 : 0), 30, 0, TAU); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.lineCap = 'round';
      for (const [x, rot] of [[w * 0.27, 2.36], [w * 0.73, 0]]) { c.save(); c.translate(x, by); c.rotate(rot); c.beginPath(); c.arc(0, 12, 15, -2.4, -0.74); c.stroke(); c.restore(); }
    } else if (mode === 'lock') {
      const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#9fb7d6'); g.addColorStop(0.6, '#5d6f99'); g.addColorStop(1, '#2b3150'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      statusBar(c, w, '', true);
      c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = `300 76px ${NUMF}`; c.fillText(o.clock || '12:41', w / 2, 150);
      c.font = `500 15px ${UIF}`; c.fillText(o.date || '9月5日 金曜日', w / 2, 178);
      if (o.notice) {
        const n = o.notice; const appear = o.noticeAt !== undefined ? PV.smooth(o.noticeAt, o.noticeAt + 0.35, t) : 1;
        c.save(); c.globalAlpha *= appear; c.translate(0, (1 - appear) * -12);
        c.fillStyle = 'rgba(250,250,252,0.86)'; c.beginPath(); c.roundRect(12, 210, w - 24, 88, 16); c.fill();
        c.fillStyle = '#4a7bd0'; c.beginPath(); c.roundRect(24, 222, 20, 20, 5); c.fill();
        c.fillStyle = '#5a6272'; c.font = `500 12px ${UIF}`; c.textAlign = 'left'; c.fillText(n.app || 'メッセージ', 52, 237); c.textAlign = 'right'; c.fillText(n.when || 'いま', w - 26, 237);
        c.textAlign = 'left'; c.fillStyle = '#1f2633'; c.font = `600 15px ${UIF}`; c.fillText(n.title || '', 24, 264);
        c.font = `500 14px ${UIF}`; c.fillStyle = '#3a4252'; const nl = wrapJP(c, n.text || '', w - 60); c.fillText((nl[0] || '') + (nl.length > 1 ? '…' : ''), 24, 286);
        c.restore();
      }
    }
    c.restore();
  }
  function faceReflection(c, w, h, a, T) {
    // dim, blurred head-and-shoulders silhouette + environment glare on black glass
    c.save(); c.globalAlpha *= a;
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(160,170,190,0.18)'); g.addColorStop(0.45, 'rgba(60,66,80,0.05)'); g.addColorStop(1, 'rgba(120,130,150,0.12)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.filter = 'blur(9px)'; c.fillStyle = 'rgba(150,158,176,0.32)';
    c.beginPath(); c.ellipse(w * 0.5, h * 0.42, w * 0.25, h * 0.17, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(w * 0.05, h); c.quadraticCurveTo(w * 0.12, h * 0.66, w * 0.5, h * 0.62); c.quadraticCurveTo(w * 0.88, h * 0.66, w * 0.95, h); c.closePath(); c.fill();
    c.fillStyle = 'rgba(30,32,40,0.5)'; // hair falling over the face
    c.beginPath(); c.moveTo(w * 0.22, h * 0.36); c.quadraticCurveTo(w * 0.32, h * 0.2, w * 0.52, h * 0.22); c.quadraticCurveTo(w * 0.76, h * 0.24, w * 0.78, h * 0.42); c.quadraticCurveTo(w * 0.6, h * 0.32, w * 0.4, h * 0.4); c.closePath(); c.fill();
    c.filter = 'none';
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.moveTo(w * 0.62, 0); c.lineTo(w, 0); c.lineTo(w, h * 0.22); c.lineTo(w * 0.2, h); c.lineTo(0, h); c.lineTo(0, h * 0.8); c.closePath(); c.fill();
    c.restore();
  }
  // draw a cached layer (sprite) in the current local frame; paint(c, D2) gets resolution-corrected line widths
  function layer(ctx, o, D, key, bw, bh, ox, oy, paint) {
    if (o.cache === false) { paint(ctx, D); return; }
    const sp = sprite(key + '|' + D.T.key + '|' + D.la.toFixed(2) + '|' + D.ink + '|' + D.rimA, bw, bh, o.cacheScale || (o.s || 1) * (o.res || 1), (c, r) => {
      c.translate(ox, oy); paint(c, Object.assign({}, D, { LW: (o.lw || 1.5) / Math.sqrt(Math.max(0.3, r)) }));
    });
    ctx.drawImage(sp.img, -ox, -oy, bw, bh);
  }
  L.phone = function (ctx, t, o) {
    o = o || {}; const D = setup(o); const { T, lx, ly } = D;
    const W0 = 300, H0 = 620, R = 42, PAD = 80;
    let vx = 0, vy = 0;
    if (o.vibrate) { const on = (t % 1.6) < 0.9; if (on) { vx = Math.sin(t * 95) * 2.4; vy = Math.cos(t * 83) * 1.2; } }
    begin(ctx, Object.assign({}, o, { x: (o.x || 0) + vx * (o.s || 1), y: (o.y || 0) + vy * (o.s || 1) }));
    const c = ctx;
    const shadow = o.shadow !== false && !o.held;
    const body = rr(-W0 / 2, -H0 / 2, W0, H0, R);
    const glass = rr(-W0 / 2 + 5, -H0 / 2 + 5, W0 - 10, H0 - 10, R - 5);
    const sx = -W0 / 2 + 14, sy = -H0 / 2 + 50, sw = W0 - 28, sh = H0 - 96;
    const paintShadow = (pc) => { pc.save(); pc.translate(-lx * 22, -ly * 22 + 8); pc.fillStyle = rgba(T.sh, 0.45); pc.filter = 'blur(12px)'; pc.fill(body); pc.restore(); };
    if (o.back) {
      layer(c, o, D, 'phone-back|' + [shadow, o.case].join(','), W0 + PAD * 2, H0 + PAD * 2, W0 / 2 + PAD, H0 / 2 + PAD, (pc, D2) => {
        if (shadow) paintShadow(pc);
        inkUnder(pc, D2, body, '#0a0c12', 1);
        const cc = o.case || '#2b3346';
        pc.fillStyle = PV.linGrad(pc, -W0 / 2, -H0 / 2, W0 / 2, H0 / 2, [[0, T.c(mixH(cc, '#ffffff', 0.18))], [0.5, T.c(cc)], [1, T.c(mixH(cc, '#000000', 0.35))]]); pc.fill(body);
        const cam = rr(-W0 / 2 + 22, -H0 / 2 + 22, 92, 150, 26); pc.fillStyle = T.c(mixH(cc, '#000000', 0.25)); pc.fill(cam); inkStroke(pc, D2, cam, '#0a0c12', 0.6);
        for (const [x, y, rr0] of [[-W0 / 2 + 68, -H0 / 2 + 62, 24], [-W0 / 2 + 68, -H0 / 2 + 128, 24]]) { pc.fillStyle = T.c('#0b0d14'); pc.beginPath(); pc.arc(x, y, rr0, 0, TAU); pc.fill(); pc.fillStyle = T.c('#26324a'); pc.beginPath(); pc.arc(x, y, rr0 * 0.55, 0, TAU); pc.fill(); pc.fillStyle = rgba(T.hi, 0.7); pc.beginPath(); pc.arc(x - 6, y - 6, 4, 0, TAU); pc.fill(); }
        glossy(pc, -W0 * 0.15, -H0 * 0.1, W0 * 0.5, H0 * 0.3, -0.6, T.hi, 0.12);
        if (D2.rimA > 0) crescent(pc, body, -lx * 3, -ly * 3, rgba(T.rim, D2.rimA * 0.8));
      });
    } else {
      const bright = o.bright === undefined ? 1 : o.bright;
      const mode = o.screen || 'message';
      const dark = mode === 'off' || mode === 'none' || bright <= 0;
      // under: shadow, frame, black glass, top bezel (+ the static dark-screen reflection) — cached
      layer(c, o, D, 'phone-u|' + [shadow, dark ? mode : 'lit', o.reflect].join(','), W0 + PAD * 2, H0 + PAD * 2, W0 / 2 + PAD, H0 / 2 + PAD, (pc, D2) => {
        if (shadow) paintShadow(pc);
        inkUnder(pc, D2, body, '#05070b', 1);
        pc.fillStyle = PV.linGrad(pc, -W0 / 2, 0, W0 / 2, 0, [[0, T.c('#c9ced8')], [0.04, T.c('#5c6372')], [0.5, T.c('#262a33')], [0.96, T.c('#5c6372')], [1, T.c('#c9ced8')]]); pc.fill(body);
        pc.fillStyle = '#07080c'; pc.fill(glass);
        pc.fillStyle = '#20242e'; pc.beginPath(); pc.roundRect(-34, -H0 / 2 + 22, 68, 6, 3); pc.fill();
        pc.fillStyle = '#12151c'; pc.beginPath(); pc.arc(-62, -H0 / 2 + 25, 7, 0, TAU); pc.fill(); pc.fillStyle = '#2a3a5a'; pc.beginPath(); pc.arc(-62, -H0 / 2 + 25, 3, 0, TAU); pc.fill();
        if (dark) { pc.save(); pc.beginPath(); pc.roundRect(sx, sy, sw, sh, 6); pc.clip(); pc.translate(sx, sy); pc.fillStyle = '#05060a'; pc.fillRect(0, 0, sw, sh); if (mode === 'off') faceReflection(pc, sw, sh, o.reflect === undefined ? 0.6 : o.reflect, T); pc.restore(); }
      });
      // the lit screen itself is the only per-frame part
      if (!dark) { c.save(); c.beginPath(); c.roundRect(sx, sy, sw, sh, 6); c.clip(); c.translate(sx, sy); c.globalAlpha *= bright; phoneScreen(c, t, o, sw, sh); c.restore(); }
      // over: glass sheen, frame highlight, rim — cached
      layer(c, o, D, 'phone-o', W0 + 20, H0 + 20, W0 / 2 + 10, H0 / 2 + 10, (pc, D2) => {
        pc.save(); pc.clip(glass);
        pc.fillStyle = PV.linGrad(pc, -W0 / 2, -H0 / 2, W0 / 2, H0 / 2, [[0, '#ffffff', 0.10], [0.3, '#ffffff', 0.0], [0.55, '#ffffff', 0.0], [0.62, '#ffffff', 0.06], [0.7, '#ffffff', 0.0]]); pc.fillRect(-W0, -H0, W0 * 2, H0 * 2);
        pc.restore();
        pc.strokeStyle = rgba(T.hi, 0.55); pc.lineWidth = 2; pc.beginPath(); pc.roundRect(-W0 / 2 + 2, -H0 / 2 + 2, W0 - 4, H0 - 4, R - 2); pc.stroke();
        if (D2.rimA > 0) crescent(pc, body, -lx * 3, -ly * 3, rgba(T.rim, D2.rimA * 0.8));
      });
    }
    // notification LED (blinks)
    if (o.notify && !o.back) {
      const col = typeof o.notify === 'string' ? o.notify : '#5cf0a0';
      const ph = (t % 1.6) / 1.6; const on = Math.pow(Math.max(0, Math.sin(ph * Math.PI)), 2);
      c.fillStyle = mixH('#1a2a22', col, on); c.beginPath(); c.arc(60, -H0 / 2 + 25, 4.5, 0, TAU); c.fill();
      if (on > 0.02) { c.save(); c.globalCompositeOperation = 'screen'; glossy(c, 60, -H0 / 2 + 25, 34, 34, 0, col, 0.85 * on); glossy(c, 60, -H0 / 2 + 25, 10, 10, 0, '#ffffff', 0.9 * on); c.restore(); }
    } else if (o.notify && o.back) { // the LED is on the front: only a faint glow leaks round the edge
      const col = typeof o.notify === 'string' ? o.notify : '#5cf0a0'; const ph = (t % 1.6) / 1.6; const on = Math.pow(Math.max(0, Math.sin(ph * Math.PI)), 2);
      if (on > 0.02) { c.save(); c.globalCompositeOperation = 'screen'; glossy(c, 60, -H0 / 2 + 4, 60, 22, 0, col, 0.35 * on); c.restore(); }
    }
    c.restore();
    // light spill from the screen (in world space, around the phone)
    const mode = o.screen || 'message';
    if (o.glow && !o.back && mode !== 'off' && mode !== 'none') {
      const bright = o.bright === undefined ? 1 : o.bright;
      const gc = mode === 'player' ? '#9fb2ff' : mode === 'call' ? '#9fd0ff' : '#dfeaff';
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const gx = o.x || 0, gy = o.y || 0, s = o.s || 1;
      L.glow ? L.glow(ctx, gx, gy, 520 * s, gc, 0.35 * o.glow * bright) : glossy(ctx, gx, gy, 520 * s, 520 * s, 0, gc, 0.35 * o.glow * bright);
      ctx.restore();
    }
  };

  /* ===================================================================== EARPHONES
   * Wired in-ear earphones shared by two people (one bud each), cable arcing between them.
   * o.a, o.b : {x, y, ang} earbud positions (ang = direction the cable leaves the bud, default down)
   * o.split  : {x, y} Y-splitter (default: below the midpoint)   o.end: {x, y} main cable end (phone/pocket)
   * o.sag (px, default 40)   o.sway (px, default 6, animated by t)   o.color 'black'|'white'
   * o.bud (earbud scale, default 1 ≈ 46 px long)   o.lw (cable width, default 3)   o.budsVisible (default true)
   * o.plug: draw a 3.5 mm plug at o.end (default false)
   * o.mode 'laid': earphones put down on a surface (loose coil, buds on their sides, plug) — static sprite;
   *   anchor = coil centre, o.k foreshortening (0.3 bench seat … 0.55 desk), o.seed, o.color, o.lw (4.2)
   */
  function earbud(c, D, x, y, ang, sc, col) {
    const { T, lx, ly } = D; const dark = col === 'black';
    c.save(); c.translate(x, y); c.rotate(ang - Math.PI / 2); c.scale(sc, sc);
    // stem / strain relief toward +y (cable side)
    const st = rr(-4.5, 8, 9, 22, 4); c.fillStyle = T.c(dark ? '#1c1f26' : '#e9ebef'); c.fill(st); inkStroke(c, D, st, '#05070a', 0.6);
    // housing
    const hb = new Path2D(); hb.ellipse(0, 0, 14, 17, 0, 0, TAU);
    inkUnder(c, D, hb, '#05070a', 0.9);
    c.fillStyle = PV.radGrad(c, lx * 6, ly * 6 - 3, 1, 20, dark ? [[0, T.c('#6a7282')], [0.4, T.c('#262a33')], [1, T.c('#0c0e13')]] : [[0, T.c('#ffffff')], [0.5, T.c('#e6e9ee')], [1, T.c('#a9afba')]]); c.fill(hb);
    // brushed metal ring + tip
    c.strokeStyle = T.c('#c9ced6'); c.lineWidth = 2.2; c.beginPath(); c.ellipse(0, -2, 12, 14, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    const tip = ell(0, -18, 9, 7); c.fillStyle = T.a(dark ? '#4a5060' : '#cfd3da', 0.95); c.fill(tip); inkStroke(c, D, tip, '#05070a', 0.6);
    spec(c, lx * 6, ly * 7 - 2, 4, 2, ang, T.hi, 0.8);
    c.restore();
  }
  function cablePath(A, B, sag, sway, t, seed) {
    const pts = []; const n = 22;
    for (let i = 0; i <= n; i++) {
      const s = i / n; const w = 4 * s * (1 - s);
      const sx = PV.noise2(seed + s * 1.3, t * 0.35) * sway * w, sy = PV.noise2(seed + 7 + s * 1.1, t * 0.3) * sway * 0.5 * w;
      pts.push([lerp(A[0], B[0], s) + sx, lerp(A[1], B[1], s) + sag * w + sy]);
    }
    return pts;
  }
  function strokeCable(c, D, pts, lw, col) {
    const { T, lx, ly } = D; const dark = col === 'black';
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    const path = (dx, dy) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] + dx, p[1] + dy) : c.moveTo(p[0] + dx, p[1] + dy))); };
    path(0, 0); c.strokeStyle = T.a(dark ? '#05070a' : '#5a606c', 0.9); c.lineWidth = lw + D.LW * 1.4; c.stroke();
    path(0, 0); c.strokeStyle = T.c(dark ? '#1b1e25' : '#eef0f3'); c.lineWidth = lw; c.stroke();
    path(lx * lw * 0.25, ly * lw * 0.25); c.strokeStyle = rgba(T.hi, dark ? 0.55 : 0.9); c.lineWidth = Math.max(0.8, lw * 0.32); c.stroke();
    if (D.rimA > 0) { path(-lx * lw * 0.3, -ly * lw * 0.3); c.strokeStyle = rgba(T.rim, D.rimA * 0.6); c.lineWidth = Math.max(0.6, lw * 0.25); c.stroke(); }
    c.restore();
  }
  // earphones put down on a surface: buds on their sides, the two leads meeting at the splitter and the
  // main cable lying in a loose coil to the plug.  Anchor = centre of the coil, o.k = foreshortening.  Static.
  function laidEarphones(ctx, o) {
    const col = o.color || 'black'; const k = o.k || 0.55; const seed = o.seed || 3;
    staticProp(ctx, o, 'buds-laid|' + [col, k, seed, o.shadow, o.plug, o.lw].join(','), 760, 560, 380, 280, (c, D) => {
      const { T, lx, ly } = D; D.LW = 1.2; const r = PV.rng(seed); const lw = o.lw || 4.2;
      const Pp = (u, v) => [u, v * k];
      const curve = (pts, n) => { // Catmull-Rom through plane points → screen polyline
        const out = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
          for (let j = 0; j < n; j++) { const t2 = j / n, t3 = t2 * t2, t4 = t3 * t2; const f = (a, b, cc, d) => 0.5 * ((2 * b) + (-a + cc) * t2 + (2 * a - 5 * b + 4 * cc - d) * t3 + (-a + 3 * b - 3 * cc + d) * t4); out.push(Pp(f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]))); }
        }
        const e = pts[pts.length - 1]; out.push(Pp(e[0], e[1])); return out;
      };
      const budA = { u: -150, v: -150, ang: 0.35 }, budB = { u: -40, v: -205, ang: 2.75 };
      const stem = (b) => [b.u + Math.cos(b.ang) * 30, b.v + Math.sin(b.ang) * 30];
      const sp = [-60, -70];
      const leadA = curve([stem(budA), [budA.u + 40, budA.v + 70], [sp[0] - 30, sp[1] - 10], sp], 8);
      const leadB = curve([stem(budB), [budB.u + 30, budB.v + 80], [sp[0] + 26, sp[1] - 30], sp], 8);
      // main cable: a loose, slightly irregular coil around the anchor, then off to the plug
      const coil = [sp, [sp[0] + 10, sp[1] + 40]];
      for (let i = 0; i <= 14; i++) { const th = -2.2 + i / 14 * 1.75 * TAU; const R = 150 + 26 * Math.sin(i * 1.3 + seed) + i * 3; coil.push([Math.cos(th) * R * 1.08 + 20, Math.sin(th) * R * 0.92 + 10]); }
      const last = coil[coil.length - 1], prev = coil[coil.length - 2]; const dl = Math.hypot(last[0] - prev[0], last[1] - prev[1]) || 1;
      const plugAt = [last[0] + (last[0] - prev[0]) / dl * 80, last[1] + (last[1] - prev[1]) / dl * 80 + 12]; coil.push(plugAt); // tail runs on, no hairpin
      const main = curve(coil, 6);
      if (o.shadow !== false) {
        c.save(); c.filter = 'blur(2.5px)'; c.strokeStyle = rgba(T.sh, 0.4); c.lineWidth = lw + 2; c.lineCap = 'round'; c.lineJoin = 'round';
        for (const pl of [main, leadA, leadB]) { c.beginPath(); pl.forEach((q, i) => (i ? c.lineTo(q[0] - lx * 3, q[1] + 3) : c.moveTo(q[0] - lx * 3, q[1] + 3))); c.stroke(); }
        for (const b of [budA, budB]) { const q = Pp(b.u, b.v); softEll(c, q[0] - lx * 6, q[1] + 8, 30, 15, T.sh, 0.6); }
        c.restore();
      }
      // draw the coil in chunks so later turns cross over earlier ones with a visible outline
      const CH = 14; for (let i = 0; i < main.length - 1; i += CH) strokeCable(c, D, main.slice(i, Math.min(main.length, i + CH + 1)), lw * 1.1, col);
      strokeCable(c, D, leadA, lw, col); strokeCable(c, D, leadB, lw, col);
      const spS = Pp(sp[0], sp[1]); const spr = rr(spS[0] - 6, spS[1] - 5, 12, 22, 4); c.fillStyle = D.T.c(col === 'black' ? '#2a2e37' : '#d9dce2'); c.fill(spr); inkStroke(c, D, spr, '#05070a', 0.8);
      c.fillStyle = rgba(T.hi, 0.7); c.fillRect(spS[0] - 3, spS[1] - 3, 1.6, 16);
      if (o.plug !== false) { // 3.5 mm plug lying flat
        const a = main[main.length - 2], b = main[main.length - 1]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        c.save(); c.translate(b[0], b[1]); c.rotate(ang - Math.PI / 2);
        const pb = rr(-6.5, -4, 13, 36, 4); c.fillStyle = D.T.c(col === 'black' ? '#2a2e37' : '#e2e5ea'); c.fill(pb); inkStroke(c, D, pb, '#05070a', 0.8);
        c.fillStyle = rgba(T.hi, 0.6); c.fillRect(-4, -1, 1.6, 30);
        c.fillStyle = PV.linGrad(c, -3, 0, 3, 0, [[0, D.T.c('#f2e2b0')], [0.5, D.T.c('#c9a85a')], [1, D.T.c('#8a6a2a')]]); c.fillRect(-2.8, 32, 5.6, 22);
        c.fillStyle = '#20232a'; c.fillRect(-2.8, 39, 5.6, 1.3); c.fillRect(-2.8, 45, 5.6, 1.3); c.beginPath(); c.arc(0, 54, 2.8, 0, Math.PI); c.fillStyle = D.T.c('#c9a85a'); c.fill();
        c.restore();
      }
      for (const b of [budA, budB]) { const q = Pp(b.u, b.v); earbud(c, D, q[0], q[1], b.ang, 1.35, col); }
    });
  }
  L.earphones = function (ctx, t, o) {
    o = o || {}; if (o.mode === 'laid') return laidEarphones(ctx, o); const D = setup(o); D.LW = (o.lwInk || 1.2);
    const col = o.color || 'black'; const lw = o.lw || 3; const sc = o.bud || 1;
    const A = o.a || { x: 760, y: 420 }, B = o.b || { x: 1160, y: 440 };
    const S = o.split || { x: (A.x + B.x) / 2, y: Math.max(A.y, B.y) + 160 };
    const sag = o.sag === undefined ? 40 : o.sag, sway = o.sway === undefined ? 6 : o.sway;
    ctx.save(); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    const ex = (P, len) => { const a = P.ang === undefined ? Math.PI / 2 : P.ang; return [P.x + Math.cos(a) * len * sc, P.y + Math.sin(a) * len * sc]; };
    const a0 = ex(A, 30), b0 = ex(B, 30);
    const ca = cablePath(a0, [S.x, S.y], sag, sway, t, 1.7), cb = cablePath(b0, [S.x, S.y], sag, sway, t, 4.1);
    strokeCable(ctx, D, ca, lw, col); strokeCable(ctx, D, cb, lw, col);
    if (o.end) { const cm = cablePath([S.x, S.y + 10], [o.end.x, o.end.y], o.sagMain === undefined ? sag * 0.5 : o.sagMain, sway * 0.5, t, 8.3); strokeCable(ctx, D, cm, lw * 1.15, col); }
    // splitter
    const sp = rr(S.x - 5, S.y - 4, 10, 20, 4); ctx.fillStyle = D.T.c(col === 'black' ? '#2a2e37' : '#d9dce2'); ctx.fill(sp); inkStroke(ctx, D, sp, '#05070a', 0.8);
    ctx.fillStyle = rgba(D.T.hi, 0.7); ctx.fillRect(S.x - 3, S.y - 2, 1.6, 15);
    if (o.end && o.plug) {
      ctx.save(); ctx.translate(o.end.x, o.end.y); ctx.rotate(o.plugAng || 0);
      const pb = rr(-6, 0, 12, 34, 4); ctx.fillStyle = D.T.c('#2a2e37'); ctx.fill(pb); inkStroke(ctx, D, pb, '#05070a', 0.8);
      ctx.fillStyle = PV.linGrad(ctx, -3, 0, 3, 0, [[0, D.T.c('#f2e2b0')], [0.5, D.T.c('#c9a85a')], [1, D.T.c('#8a6a2a')]]); ctx.fillRect(-2.6, 34, 5.2, 20);
      ctx.fillStyle = '#20232a'; ctx.fillRect(-2.6, 41, 5.2, 1.2); ctx.fillRect(-2.6, 47, 5.2, 1.2);
      ctx.restore();
    }
    if (o.budsVisible !== false) { earbud(ctx, D, A.x, A.y, A.ang === undefined ? Math.PI / 2 : A.ang, sc, col); earbud(ctx, D, B.x, B.y, B.ang === undefined ? Math.PI / 2 : B.ang, sc, col); }
    ctx.restore();
  };

  /* ===================================================================== NECKLACE
   * Thin chain + a tiny crystal drop (妹のプレゼント).
   * o.mode 'worn' (default): chain hangs between o.a and o.b (neck sides) dipping o.drop px, pendant at the lowest point
   *        'hang' : held at o.a (fingertips); two strands hang to the pendant, swinging with t
   *        'laid' : lying loosely on a surface around (x,y), o.r radius
   * o.pendant 'drop'|'pearl'   o.metal 'silver'|'gold'   o.size (pendant scale)   o.sparkle (0..1, default 1)
   */
  function chainStroke(c, D, pts, metal, t) {
    const { T } = D; const base = metal === 'gold' ? '#c9a24e' : '#b9c0ca', dark = metal === 'gold' ? '#6a4e1a' : '#5d6672';
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    const path = (dx, dy) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] + dx, p[1] + dy) : c.moveTo(p[0] + dx, p[1] + dy))); };
    path(0, 0.6); c.strokeStyle = T.a(dark, 0.8); c.lineWidth = 2.4; c.stroke();
    path(0, 0); c.strokeStyle = T.c(base); c.lineWidth = 1.5; c.stroke();
    // links: alternating bright dashes
    path(0, -0.2); c.setLineDash([2.2, 2.6]); c.lineDashOffset = 0; c.strokeStyle = rgba(T.hi, 0.85); c.lineWidth = 1.1; c.stroke(); c.setLineDash([]);
    // travelling glint
    let L0 = 0; const seg = [0]; for (let i = 1; i < pts.length; i++) { L0 += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(L0); }
    // travelling glint: a short bright run along the links (not a bead), with a small star twinkle at its head
    const at = (pos) => { let i = seg.findIndex(v => v >= pos); if (i < 1) i = 1; const f = (pos - seg[i - 1]) / Math.max(1e-6, seg[i] - seg[i - 1]); return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]; };
    for (let g = 0; g < 2; g++) {
      const pos = ((t * 0.18 + g * 0.5) % 1) * L0; const run = 26;
      c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round';
      for (let j = 0; j < 6; j++) { const p0 = at(Math.max(0, pos - run * (j + 1) / 6)), p1 = at(Math.max(0, pos - run * j / 6)); c.strokeStyle = rgba(T.hi, 0.85 * (1 - j / 6)); c.lineWidth = 2.2 - j * 0.25; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke(); }
      const h = at(pos); const tw = 0.6 + 0.4 * Math.sin(t * 7 + g * 2);
      c.fillStyle = rgba(T.hi, 0.9 * tw); c.beginPath(); c.moveTo(h[0], h[1] - 6 * tw); c.lineTo(h[0] + 0.9, h[1]); c.lineTo(h[0], h[1] + 6 * tw); c.lineTo(h[0] - 0.9, h[1]); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(h[0] - 5 * tw, h[1]); c.lineTo(h[0], h[1] + 0.8); c.lineTo(h[0] + 5 * tw, h[1]); c.lineTo(h[0], h[1] - 0.8); c.closePath(); c.fill();
      glossy(c, h[0], h[1], 5, 5, 0, T.hi, 0.5 * tw);
      c.restore();
    }
    c.restore();
  }
  function pendant(c, D, x, y, ang, sz, kind, metal, t, sparkle) {
    const { T, lx, ly } = D;
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(sz, sz);
    const mcol = metal === 'gold' ? '#d9b464' : '#d8dde4';
    c.strokeStyle = T.c(mcol); c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, 2.5, 2.2, 3, 0, 0, TAU); c.stroke();
    if (kind === 'pearl') {
      const p = ell(0, 11, 6.5, 6.5); c.fillStyle = PV.radGrad(c, lx * 3, 11 + ly * 3, 0.5, 8, [[0, T.c('#ffffff')], [0.5, T.c('#f3ece6')], [1, T.c('#b8b0b8')]]); c.fill(p); inkStroke(c, D, p, '#6a6470', 0.6);
    } else {
      const p = new Path2D(); p.moveTo(0, 4.5); p.bezierCurveTo(5.5, 9, 6.5, 14, 0, 19.5); p.bezierCurveTo(-6.5, 14, -5.5, 9, 0, 4.5); p.closePath();
      c.fillStyle = PV.linGrad(c, -6, 4, 6, 20, [[0, T.c('#ffffff')], [0.35, T.c('#cfe6ff')], [0.6, T.c('#7fa8d8')], [1, T.c('#eaf4ff')]]); c.fill(p);
      c.strokeStyle = T.c(mcol); c.lineWidth = 1.3; c.stroke(p);
      c.strokeStyle = rgba(T.hi, 0.9); c.lineWidth = 0.9; c.beginPath(); c.moveTo(0, 5); c.lineTo(-2.6, 12); c.lineTo(0, 19); c.moveTo(-2.6, 12); c.lineTo(3, 11); c.stroke();
    }
    c.restore();
    const tw = Math.pow(Math.max(0, Math.sin(t * 2.3 + x * 0.01)), 8) * (sparkle === undefined ? 1 : sparkle);
    if (tw > 0.02) {
      const sx = x + Math.sin(ang) * -12 * sz, sy = y + Math.cos(ang) * 12 * sz;
      c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = rgba(T.hi, tw);
      c.beginPath(); c.moveTo(sx, sy - 16 * tw * sz); c.lineTo(sx + 1.4, sy); c.lineTo(sx, sy + 16 * tw * sz); c.lineTo(sx - 1.4, sy); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(sx - 12 * tw * sz, sy); c.lineTo(sx, sy + 1.2); c.lineTo(sx + 12 * tw * sz, sy); c.lineTo(sx, sy - 1.2); c.closePath(); c.fill();
      glossy(c, sx, sy, 9 * sz, 9 * sz, 0, T.hi, 0.7 * tw);
      c.restore();
    }
  }
  L.necklace = function (ctx, t, o) {
    o = o || {}; const D = setup(o); const mode = o.mode || 'worn'; const metal = o.metal || 'silver'; const sz = (o.size || 1) * (o.s || 1);
    ctx.save(); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    if (mode === 'worn') {
      const A = o.a || { x: 900, y: 500 }, B = o.b || { x: 1020, y: 500 }; const drop = o.drop === undefined ? 90 : o.drop;
      const n = 40, pts = [];
      for (let i = 0; i <= n; i++) { const s = i / n; const x = lerp(A.x, B.x, s), y = lerp(A.y, B.y, s) + drop * (1 - Math.pow(2 * s - 1, 2)) * (0.85 + 0.15 * Math.sin(s * Math.PI)); pts.push([x, y]); }
      chainStroke(ctx, D, pts, metal, t);
      const mid = pts[n >> 1]; pendant(ctx, D, mid[0], mid[1] - 2, Math.sin(t * 1.3) * 0.05, sz, o.pendant, metal, t, o.sparkle);
    } else if (mode === 'hang') {
      const A = o.a || { x: o.x || 960, y: o.y || 300 }; const len = (o.len || 200) * (o.s || 1);
      const sw = Math.sin(t * 2.1) * 0.12 * (o.swing === undefined ? 1 : o.swing);
      const tip = [A.x + Math.sin(sw) * len, A.y + Math.cos(sw) * len];
      const strand = (off) => { const pts = []; for (let i = 0; i <= 24; i++) { const s = i / 24; pts.push([lerp(A.x, tip[0], s) + Math.sin(s * Math.PI) * off * (1 - s * 0.3), lerp(A.y, tip[1], s)]); } return pts; };
      chainStroke(ctx, D, strand(-10 * (o.s || 1)), metal, t); chainStroke(ctx, D, strand(10 * (o.s || 1)), metal, t + 0.4);
      pendant(ctx, D, tip[0], tip[1] - 3, -sw, sz, o.pendant, metal, t, o.sparkle);
    } else {
      const cx = o.x || 960, cy = o.y || 540, R = (o.r || 110) * (o.s || 1); const pts = [];
      for (let i = 0; i <= 80; i++) { const a = i / 80 * TAU * 1.04 - 0.4; const rr0 = R * (1 + 0.08 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7)); pts.push([cx + Math.cos(a) * rr0, cy + Math.sin(a) * rr0 * 0.55]); }
      ctx.save(); ctx.translate(-D.lx * 3, -D.ly * 3 + 2); ctx.globalAlpha *= 0.35; ctx.strokeStyle = rgba(D.T.sh, 0.8); ctx.lineWidth = 2; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.restore();
      chainStroke(ctx, D, pts, metal, t);
      const p = pts[52]; pendant(ctx, D, p[0], p[1] - 4, 0.9, sz, o.pendant, metal, t, o.sparkle);
    }
    ctx.restore();
  };

  /* ===================================================================== HANDKERCHIEF
   * Cotton handkerchief.  o.mode: 'held' (default, hanging from a pinch at (x,y), fluttering)
   *                              | 'folded' (neat quarter-fold on a surface, centred at (x,y))
   * o.size (side length, default 300)  o.color (default pale blue '#bcd5ec')  o.pattern 'check'|'plain'|'border'
   * o.wind 0..1 (flutter strength, default 0.4)
   */
  function clothColor(u, v, o) {
    const base = o.color || '#bcd5ec';
    if ((o.pattern || 'check') === 'check') {
      const a = Math.floor(u * 9) % 2, b = Math.floor(v * 9) % 2;
      return a && b ? mixH(base, '#5a7aa8', 0.38) : (a || b) ? mixH(base, '#7f9cc4', 0.18) : base;
    }
    if (o.pattern === 'border') { const e = Math.min(u, v, 1 - u, 1 - v); return e < 0.06 ? mixH(base, '#3e5f90', 0.5) : base; }
    return base;
  }
  // quarter-folded handkerchief lying on a surface: soft rolled folds on the back & left edges, the four
  // hems fanned on the open (right & front) edges, a little thickness, embroidered corner.  Static → sprite.
  function paintFoldedCloth(ctx, o) {
    const S = o.size || 300; const base = o.color || '#bcd5ec'; const pat = o.pattern || 'check';
    staticProp(ctx, o, 'kerchief|' + [S, base, pat, o.shadow, o.k].join(','), S * 1.3, S * 1.1, S * 0.65, S * 0.55, (c, D) => {
      const { T, lx, ly } = D; const w = S * 0.5, k = o.k || 0.62, th = 7; const r = PV.rng(17);
      const P = (x, y, z) => [x, y * k - (z || 0) * 0.78];
      const wob = (i, n) => PV.noise2(i * 0.9, n * 3.7) * 1.6;
      // outline of one cloth layer (local square, soft corners, slightly wavy), offset for stacked hems
      const layer = (dx, dy, z, shrink) => {
        const pts = []; const h = w / 2 - (shrink || 0); const n = 10;
        const cr = (x, y) => pts.push(P(x + dx, y + dy, z));
        for (let i = 0; i <= n; i++) cr(-h + 2 * h * i / n, -h + wob(i, 1));          // back edge (fold)
        for (let i = 1; i <= n; i++) cr(h + wob(i, 2) * 1.6, -h + 2 * h * i / n);      // right edge (open)
        for (let i = 1; i <= n; i++) cr(h - 2 * h * i / n, h + wob(i, 3) * 1.6);       // front edge (open)
        for (let i = 1; i < n; i++) cr(-h + wob(i, 4), h - 2 * h * i / n);             // left edge (fold)
        return smoothClosed(pts);
      };
      const tone0 = (f) => T.c(mixH(base, '#4a5a74', f));
      if (o.shadow !== false) { c.save(); c.translate(-lx * 10, -ly * 6 + 7); c.fillStyle = rgba(T.sh, 0.38); c.filter = 'blur(6px)'; c.fill(layer(2, 2, 0, -4)); c.restore(); }
      // thickness band along the open front edge + the lower hems fanning out
      for (let L2 = 3; L2 >= 1; L2--) {
        const q = layer(L2 * 1.9, L2 * 2.4, th * (1 - L2 / 4), -L2 * 0.6);
        c.fillStyle = tone0(0.1 + L2 * 0.06); c.fill(q); inkStroke(c, D, q, mixH(base, '#2a3a56', 0.6), 0.45);
      }
      const top = layer(0, 0, th, 0);
      inkUnder(c, D, top, mixH(base, '#2a3a56', 0.6), 0.9);
      c.save(); c.clip(top);
      c.fillStyle = T.c(base); c.fillRect(-w, -w, w * 2, w * 2);
      if (pat === 'check') { // gingham: two crossed sets of translucent bands
        const nS = 6, st = w / nS; c.fillStyle = T.a(mixH(base, '#3e5f90', 0.55), 0.3);
        for (let i = -1; i <= nS; i++) { const x0 = -w / 2 + i * st + st * 0.5; const a0 = P(x0, 0); c.fillRect(a0[0], -w, st * 0.5, w * 2); const y0 = P(0, -w / 2 + i * st + st * 0.5)[1]; c.fillRect(-w, y0, w * 2, st * 0.5 * k); }
      } else if (pat === 'border') { // the original hem border shows only on the open edges of a quarter fold
        c.strokeStyle = T.a(mixH(base, '#3e5f90', 0.55), 0.85); c.lineWidth = 6;
        c.beginPath(); c.moveTo(...P(w / 2 - 12, -w / 2 - 4, th)); c.lineTo(...P(w / 2 - 12, w / 2 - 12, th)); c.lineTo(...P(-w / 2 - 4, w / 2 - 12, th)); c.stroke();
        c.lineWidth = 1.4; c.beginPath(); c.moveTo(...P(w / 2 - 20, -w / 2 - 4, th)); c.lineTo(...P(w / 2 - 20, w / 2 - 20, th)); c.lineTo(...P(-w / 2 - 4, w / 2 - 20, th)); c.stroke();
      }
      // soft cloth light: lit from the key side, a gentle puff in the middle, darker toward the folds' undersides
      c.fillStyle = PV.linGrad(c, lx * w * 0.5, ly * w * 0.5 * k, -lx * w * 0.5, -ly * w * 0.5 * k, [[0, T.hi, 0.28], [0.5, T.hi, 0.04], [1, '#1a2438', 0.14]]); c.fillRect(-w, -w, w * 2, w * 2);
      softEll(c, -6, P(0, 4, th)[1], w * 0.32, w * 0.2 * k, T.hi, 0.22);
      // rolled fold edges: bright roll just inside, darker turn-under at the edge
      c.lineCap = 'round';
      const foldBack = [P(-w / 2, -w / 2 + 5, th), P(w / 2, -w / 2 + 5, th)], foldLeft = [P(-w / 2 + 5, -w / 2, th), P(-w / 2 + 5, w / 2, th)];
      for (const [p0, p1] of [foldBack, foldLeft]) { c.strokeStyle = rgba(T.hi, 0.5); c.lineWidth = 4; c.beginPath(); c.moveTo(...p0); c.lineTo(...p1); c.stroke(); }
      // creases: the inner fold lines show faintly through the top layer
      c.strokeStyle = T.a(mixH(base, '#2a3a56', 0.5), 0.22); c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(...P(-w / 2 + 6, w * 0.02, th)); c.quadraticCurveTo(...P(0, w * 0.06, th), ...P(w / 2 - 4, -w * 0.02, th)); c.stroke();
      for (let i = 0; i < 4; i++) { const x0 = (r() - 0.5) * w * 0.7, y0 = (r() - 0.5) * w * 0.7; c.strokeStyle = T.a('#ffffff', 0.3); c.lineWidth = 1.2; c.beginPath(); c.moveTo(...P(x0, y0, th)); c.quadraticCurveTo(...P(x0 + 14, y0 + 6, th), ...P(x0 + 26, y0 + 2, th)); c.stroke(); }
      // embroidered flower on the open corner
      const em = P(w / 2 - 30, w / 2 - 30, th); c.save(); c.translate(em[0], em[1]); c.scale(1, k);
      c.fillStyle = T.a(mixH(base, '#3e5f90', 0.7), 0.9); for (let i = 0; i < 5; i++) { c.rotate(TAU / 5); c.beginPath(); c.ellipse(0, -4.6, 2.4, 3.8, 0, 0, TAU); c.fill(); }
      c.fillStyle = T.c('#f3e2a0'); c.beginPath(); c.arc(0, 0, 1.8, 0, TAU); c.fill(); c.restore();
      c.restore();
      // turn-under shading on the fold edges (outside the top face, toward the table)
      c.strokeStyle = T.a(mixH(base, '#2a3a56', 0.5), 0.6); c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(...P(-w / 2 + 2, -w / 2 + 1, th * 0.6)); c.lineTo(...P(w / 2 - 2, -w / 2 + 1, th * 0.6)); c.stroke();
      if (D.rimA > 0) crescent(c, top, -lx * 3, -ly * 3, rgba(T.rim, D.rimA * 0.55));
      inkStroke(c, D, top, mixH(base, '#2a3a56', 0.6), 0.8);
    });
  }
  L.handkerchief = function (ctx, t, o) {
    o = o || {}; const D = setup(o); const { T, lx, ly } = D; const mode = o.mode || 'held';
    begin(ctx, o); const c = ctx; const S = o.size || 300;
    if (mode === 'folded') { c.restore(); paintFoldedCloth(ctx, o); return; }
    // ---- held: cloth hanging from a pinched corner. (u,v) in [0,1]^2, pinch at u=v=0
    const wind = o.wind === undefined ? 0.4 : o.wind; const N = 26;
    const L1 = S * 0.72;
    const pos = (u, v) => {
      const d = Math.hypot(u, v) * L1; const th = Math.atan2(v, u) - Math.PI / 4; // −π/4..π/4 across the cloth
      const dn = d / L1;
      const sway = (PV.noise2(3.1, t * 0.45 * (0.5 + wind)) * 0.22 * wind + Math.sin(t * 1.5) * 0.05 * wind) * dn;
      const spread = 0.42 + 0.12 * Math.min(1, dn);
      const ph = th * 8 + t * 1.3 * wind + PV.noise2(dn * 1.5, t * 0.3) * 0.8;
      const fold = Math.sin(ph) * 13 * Math.min(1, dn * 1.2);
      const a = th * spread + sway;
      return [d * Math.sin(a) + fold, d * Math.cos(a) * (1 - 0.05 * Math.abs(Math.sin(ph)))];
    };
    const shadeAt = (u, v) => {
      const d = Math.hypot(u, v), th = Math.atan2(v, u) - Math.PI / 4; const ph = th * 8 + t * 1.3 * wind + PV.noise2(d * 1.5, t * 0.3) * 0.8;
      return cl(Math.cos(ph) * Math.min(1, d * 1.4) * (lx < 0 ? 1 : -1), -1, 1);
    };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u0 = i / N, v0 = j / N, u1 = (i + 1) / N, v1 = (j + 1) / N;
      const p = [pos(u0, v0), pos(u1, v0), pos(u1, v1), pos(u0, v1)];
      const sh = shadeAt((u0 + u1) / 2, (v0 + v1) / 2);
      const base = clothColor((u0 + u1) / 2, (v0 + v1) / 2, o);
      c.fillStyle = sh >= 0 ? T.c(mixH(base, '#ffffff', sh * 0.4)) : T.c(mixH(base, '#34445e', -sh * 0.5));
      c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (let q = 1; q < 4; q++) c.lineTo(p[q][0], p[q][1]); c.closePath(); c.fill();
      c.strokeStyle = c.fillStyle; c.lineWidth = 0.9; c.stroke();
    }
    // hem outline
    const edge = []; for (let i = 0; i <= N; i++) edge.push(pos(i / N, 0)); for (let j = 1; j <= N; j++) edge.push(pos(1, j / N)); for (let i = N - 1; i >= 0; i--) edge.push(pos(i / N, 1)); for (let j = N - 1; j > 0; j--) edge.push(pos(0, j / N));
    const ep = polyP(edge);
    c.strokeStyle = T.a('#ffffff', 0.55); c.lineWidth = 3; c.stroke(ep);
    inkStroke(c, D, ep, '#34445e', 1);
    c.restore();
  };

  /* ===================================================================== UMBRELLA
   * Open umbrella with rain trickling down the canopy.  Anchor: the tip (ferrule) at the canopy top.
   * o.r (canopy radius, default 330)   o.type 'vinyl' (clear, default) | 'navy'
   * o.elev: camera elevation (rad, + from above, − from below; default 0.28)   o.yaw (rad)
   * o.tilt: 2D lean of the whole umbrella (rad, default 0)   o.shaft (px, default 1.5·r)
   * o.rain 0..1 (beads + trickling drops + drips, default 0.8)   o.ribs (default 8)
   */
  L.umbrella = function (ctx, t, o) {
    o = o || {}; const D = setup(o); const { T } = D;
    const R = o.r || 330, n = o.ribs || 8, Hc = R * 0.46, e = o.elev === undefined ? 0.28 : o.elev, yaw = o.yaw || 0.13;
    const vinyl = (o.type || 'vinyl') === 'vinyl'; const rain = o.rain === undefined ? 0.8 : o.rain;
    const P = cam(yaw, e);
    // local: apex at y=Hc, rim at y≈0.  screen origin = apex
    const S = (x, y, z) => { const q = P(x, y - Hc, z); return q; };
    const dep = (x, y, z) => P.depth(x, y - Hc, z);
    const yS = (rho) => Hc * (1 - Math.pow(rho, 1.9));
    const surf = (rho, phi, frac) => { // frac: 0..1 position between ribs (for scallop & concavity)
      const sc = Math.sin(Math.PI * frac); const rr0 = rho * R * (1 - 0.045 * sc * rho);
      return [rr0 * Math.cos(phi), yS(rho) + R * 0.035 * sc * Math.pow(rho, 6), rr0 * Math.sin(phi)];
    };
    const LV = (() => { const v = [D.lx * 0.7, 0.75, -0.35]; const l = Math.hypot(...v); return v.map(q => q / l); })();
    begin(ctx, Object.assign({}, o, { s: o.s || 1 }));
    const c = ctx; if (o.tilt) c.rotate(o.tilt);
    const shaftL = o.shaft || R * 1.5;
    const drawShaft = () => {
      const a = S(0, Hc + 18, 0), b = S(0, Hc - shaftL, 0);
      c.save(); c.lineCap = 'round';
      c.strokeStyle = T.a('#1a1e26', 0.9); c.lineWidth = 9; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      c.strokeStyle = T.c(vinyl ? '#d8dde4' : '#3a3f4a'); c.lineWidth = 6; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      c.strokeStyle = rgba(T.hi, 0.6); c.lineWidth = 1.5; c.beginPath(); c.moveTo(a[0] - 1.5, a[1]); c.lineTo(b[0] - 1.5, b[1]); c.stroke();
      // J handle
      const hcx = b[0] + 26, hcy = b[1];
      c.strokeStyle = T.a('#1a1e26', 0.9); c.lineWidth = 17; c.beginPath(); c.moveTo(b[0], b[1] - 40); c.lineTo(b[0], b[1]); c.arc(hcx, hcy, 26, Math.PI, 0, true); c.stroke();
      c.strokeStyle = T.c(vinyl ? '#f0f1f3' : '#5a3a26'); c.lineWidth = 13; c.beginPath(); c.moveTo(b[0], b[1] - 40); c.lineTo(b[0], b[1]); c.arc(hcx, hcy, 26, Math.PI, 0, true); c.stroke();
      c.strokeStyle = rgba(T.hi, 0.55); c.lineWidth = 3; c.beginPath(); c.moveTo(b[0] - 3, b[1] - 38); c.lineTo(b[0] - 3, b[1]); c.stroke();
      // runner (the slider under the canopy)
      const rn = S(0, Hc - R * 0.42, 0); c.fillStyle = T.c(vinyl ? '#e9edf2' : '#20242c'); c.beginPath(); c.roundRect(rn[0] - 7, rn[1] - 12, 14, 24, 4); c.fill();
      c.restore();
    };
    const panels = [];
    for (let i = 0; i < n; i++) {
      const p0 = (i / n) * TAU + (o.spin || 0), p1 = ((i + 1) / n) * TAU + (o.spin || 0);
      const pts = []; const M2 = 10;
      // apex → rib i tip → scalloped rim → rib i+1 tip → apex
      for (let k = 0; k <= 6; k++) { const rho = k / 6; const q = surf(rho, p0, 0); pts.push(S(...q)); }
      for (let k = 1; k < M2; k++) { const f = k / M2; const q = surf(1, lerp(p0, p1, f), f); pts.push(S(...q)); }
      for (let k = 6; k >= 0; k--) { const rho = k / 6; const q = surf(rho, p1, 0); pts.push(S(...q)); }
      const pm = (p0 + p1) / 2; const cq = surf(0.62, pm, 0.5);
      // normal ≈ outward radial tilted up
      const nr = [Math.cos(pm) * 0.62, 0.78, Math.sin(pm) * 0.62]; const lam = cl(nr[0] * LV[0] + nr[1] * LV[1] + nr[2] * LV[2], 0, 1);
      panels.push({ i, p0, p1, pm, pts, d: dep(...cq), lam, facing: P.depth(Math.cos(pm), 0, Math.sin(pm)) < 0 });
    }
    panels.sort((a, b) => b.d - a.d);
    // the shaft is under the canopy: seen from above it must be covered by an opaque canopy
    if (vinyl || e >= 0) drawShaft();
    const beadsR = PV.rng(o.seed || 12);
    const beads = []; const nb = Math.round(150 * rain * (vinyl ? 1 : 0.6));
    for (let k = 0; k < nb; k++) beads.push([beadsR() * n, 0.18 + 0.8 * Math.sqrt(beadsR()), beadsR()]);
    for (const pn of panels) {
      const path = polyP(pn.pts);
      if (vinyl) {
        c.fillStyle = T.a('#e6eef8', pn.facing ? 0.13 + pn.lam * 0.14 : 0.07); c.fill(path);
        const a0 = pn.pts[0], am = pn.pts[Math.floor(pn.pts.length / 2)];
        c.fillStyle = PV.linGrad(c, a0[0], a0[1], am[0], am[1], [[0, T.hi, 0.0], [0.45, T.hi, pn.facing ? 0.22 * pn.lam : 0.04], [0.6, T.hi, 0.0]]); c.fill(path);
        c.strokeStyle = T.a('#ffffff', pn.facing ? 0.55 : 0.25); c.lineWidth = 1.2; c.stroke(path);
      } else {
        const col = mixH('#111a32', '#4f69a6', Math.pow(pn.lam, 1.3));
        inkUnder(c, D, path, '#05070e', 0.7);
        const a0 = pn.pts[0], am = pn.pts[Math.floor(pn.pts.length / 2)];
        c.fillStyle = PV.linGrad(c, a0[0], a0[1], am[0], am[1], [[0, T.c(mixH(col, '#ffffff', 0.08))], [1, T.c(mixH(col, '#000000', 0.15))]]); c.fill(path);
        if (pn.facing) { c.fillStyle = PV.linGrad(c, a0[0], a0[1], am[0], am[1], [[0, T.hi, 0.0], [0.5, T.hi, 0.12 * pn.lam], [0.7, T.hi, 0.0]]); c.fill(path); }
      }
      // beads on this panel
      if (pn.facing || vinyl) {
        c.save(); c.clip(path);
        for (const b of beads) {
          if (Math.floor(b[0]) !== pn.i) continue; const f = b[0] - pn.i;
          const q = S(...surf(b[1], lerp(pn.p0, pn.p1, f), f)); const rad = (1.4 + b[2] * 2.6) * (vinyl ? 1 : 0.8);
          c.fillStyle = T.a(vinyl ? '#5a6a80' : '#05070e', vinyl ? 0.35 : 0.4); c.beginPath(); c.ellipse(q[0] + 0.6, q[1] + 0.8, rad, rad * 0.85, 0, 0, TAU); c.fill();
          c.fillStyle = rgba(T.hi, vinyl ? 0.85 : 0.55); c.beginPath(); c.ellipse(q[0] - rad * 0.3, q[1] - rad * 0.3, rad * 0.45, rad * 0.35, 0, 0, TAU); c.fill();
        }
        // trickling drops: slide from mid-panel to the rim, accelerating
        const nd = Math.round(3 * rain);
        for (let k = 0; k < nd; k++) {
          const per = 2.2 + PV.rand1(pn.i * 7 + k, 3) * 2.4, ph = PV.rand1(pn.i * 7 + k, 5) * per; const u = ((t + ph) % per) / per;
          const rho = 0.3 + 0.7 * u * u; const f = 0.25 + 0.5 * PV.rand1(pn.i * 7 + k, 9);
          const q = S(...surf(rho, lerp(pn.p0, pn.p1, f), f)), q0 = S(...surf(Math.max(0.25, rho - 0.08), lerp(pn.p0, pn.p1, f), f));
          c.strokeStyle = T.a(vinyl ? '#ffffff' : '#9fb4d8', 0.35); c.lineWidth = 2; c.beginPath(); c.moveTo(q0[0], q0[1]); c.lineTo(q[0], q[1]); c.stroke();
          c.fillStyle = T.a(vinyl ? '#56667c' : '#020308', 0.5); c.beginPath(); c.ellipse(q[0] + 0.8, q[1] + 1, 3.6, 4.2, 0, 0, TAU); c.fill();
          c.fillStyle = rgba(T.hi, 0.95); c.beginPath(); c.ellipse(q[0] - 1, q[1] - 1, 1.8, 1.6, 0, 0, TAU); c.fill();
        }
        c.restore();
      }
    }
    // ribs, rim tape and rib tips
    for (let i = 0; i < n; i++) {
      const phi = (i / n) * TAU + (o.spin || 0); const pts = []; for (let k = 0; k <= 8; k++) pts.push(S(...surf(k / 8, phi, 0)));
      const front = P.depth(Math.cos(phi), 0, Math.sin(phi)) < 0;
      c.strokeStyle = vinyl ? T.a('#ffffff', front ? 0.95 : 0.5) : T.a('#0a0d16', 0.9); c.lineWidth = vinyl ? 2 : 1.6;
      c.beginPath(); pts.forEach((q, k) => (k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
      const tp = pts[8]; c.fillStyle = T.c(vinyl ? '#f4f6f8' : '#8a909c'); c.beginPath(); c.arc(tp[0], tp[1], vinyl ? 3.2 : 2.4, 0, TAU); c.fill();
      // drips falling from the rib tips
      if (rain > 0 && front) {
        const per = 1.4 + PV.rand1(i, 13) * 1.2, ph = PV.rand1(i, 17) * per; const u = ((t + ph) % per) / per;
        if (u < 0.65) { const g = u / 0.65; c.fillStyle = T.a('#e8f2ff', 0.85); c.beginPath(); c.ellipse(tp[0], tp[1] + 3 + g * 3, 1.5 + g * 2.2, 2 + g * 3, 0, 0, TAU); c.fill(); }
        else { const g = (u - 0.65) / 0.35; const yy = tp[1] + 8 + g * g * 260; c.strokeStyle = T.a('#e8f2ff', 0.8 * (1 - g)); c.lineWidth = 2.2; c.beginPath(); c.moveTo(tp[0], yy - 14); c.lineTo(tp[0], yy); c.stroke(); }
      }
    }
    if (vinyl) {
      const rim = []; for (let k = 0; k <= n * 10; k++) { const f = (k % 10) / 10; const phi = (k / (n * 10)) * TAU + (o.spin || 0); rim.push(S(...surf(1, phi, f))); }
      c.strokeStyle = T.a('#ffffff', 0.85); c.lineWidth = 3; c.beginPath(); rim.forEach((q, k) => (k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
    } else if (e < 0) drawShaft();
    // ferrule tip
    const ft = S(0, Hc + 26, 0), fb = S(0, Hc, 0); c.strokeStyle = T.c('#d6dae0'); c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(fb[0], fb[1]); c.lineTo(ft[0], ft[1]); c.stroke();
    c.restore();
  };

  /* ===================================================================== ECG MONITOR
   * Bedside patient monitor.  Anchor: centre of the housing.  Natural size 560×420.
   * o.bpm (default 68)  o.spo2 (98)  o.nibp ('116/74')  o.rr (16)  o.mode 'sweep' (default) | 'scroll'
   * o.speed (trace px/s, default 110)  o.mount: true → arm/pole stub below   o.screenGlow (0..1, default 0.6)
   * Beat times: t = o.phase + n·60/bpm (use PV.lib.ecgBeat(t, bpm, phase) for sound sync: returns
   * seconds since the last beat).
   */
  const gauss = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (2 * s * s));
  function ecgWave(s) { return 0.09 * gauss(s, 0.1, 0.025) - 0.12 * gauss(s, 0.2, 0.008) + 1.0 * gauss(s, 0.222, 0.0095) - 0.26 * gauss(s, 0.245, 0.01) + 0.26 * gauss(s, 0.46, 0.045); }
  function plethWave(s, Tb) { const x = s / Tb; return gauss(x, 0.42, 0.11) + 0.32 * gauss(x, 0.68, 0.07) + 0.15 * gauss(x + 1, 0.68, 0.07); }
  L.ecgBeat = function (t, bpm, phase) { const Tb = 60 / (bpm || 68); return ((t - (phase || 0)) % Tb + Tb) % Tb; };
  L.ecgMonitor = function (ctx, t, o) {
    o = o || {}; const D = setup(o); const { T, lx, ly } = D;
    const bpm = o.bpm || 68, Tb = 60 / bpm, ph0 = o.phase || 0;
    const sinceBeat = L.ecgBeat(t - 0.222, bpm, ph0);
    begin(ctx, o); const c = ctx;
    const Wh = 560, Hh = 420, Rh = 30;
    const sx = -Wh / 2 + 26, sy = -Hh / 2 + 28, sw = 410, sh = 300;
    // static housing (mount, shadow, handle, body, bezel, dark screen + grid, controls) — cached
    layer(c, o, D, 'ecg-u|' + [o.mount, o.shadow].join(','), Wh + 160, Hh + 640, Wh / 2 + 80, Hh / 2 + 120, (pc, D2) => {
      if (o.mount) { pc.fillStyle = T.c('#9aa1ab'); pc.fillRect(-26, Hh / 2 - 6, 52, 60); pc.fillStyle = T.c('#7a828e'); pc.fillRect(-14, Hh / 2 + 50, 28, 400); inkStroke(pc, D2, rr(-26, Hh / 2 - 6, 52, 60, 4), '#2a2f38', 0.8); }
      if (o.shadow !== false) { pc.save(); pc.translate(-lx * 18, -ly * 18 + 10); pc.fillStyle = rgba(T.sh, 0.35); pc.filter = 'blur(14px)'; pc.fill(rr(-Wh / 2, -Hh / 2, Wh, Hh, Rh)); pc.restore(); }
      const hd = new Path2D(); hd.roundRect(-150, -Hh / 2 - 34, 300, 46, 20); hd.roundRect(-128, -Hh / 2 - 16, 256, 30, 10);
      pc.fillStyle = T.c('#d9dcd8'); pc.fill(hd, 'evenodd'); inkStroke(pc, D2, hd, '#4a4f56', 0.8);
      const body = rr(-Wh / 2, -Hh / 2, Wh, Hh, Rh);
      inkUnder(pc, D2, body, '#3a3f46', 1);
      pc.fillStyle = PV.linGrad(pc, -Wh / 2, -Hh / 2, Wh / 2, Hh / 2, [[0, T.c('#f6f7f3')], [0.55, T.c('#e2e5e1')], [1, T.c('#b9beba')]]); pc.fill(body);
      pc.save(); pc.clip(body); pc.fillStyle = PV.linGrad(pc, 0, -Hh / 2, 0, -Hh / 2 + 30, [[0, T.hi, 0.6], [1, T.hi, 0]]); pc.fillRect(-Wh / 2, -Hh / 2, Wh, 30); pc.restore();
      if (D2.rimA > 0) crescent(pc, body, -lx * 4, -ly * 4, rgba(T.rim, D2.rimA * 0.9));
      const bez = rr(sx - 10, sy - 10, sw + 20, sh + 20, 10); pc.fillStyle = T.c('#2d3238'); pc.fill(bez);
      pc.save(); pc.beginPath(); pc.rect(sx, sy, sw, sh); pc.clip(); pc.translate(sx, sy);
      pc.fillStyle = '#04100c'; pc.fillRect(0, 0, sw, sh);
      pc.strokeStyle = 'rgba(60,140,110,0.14)'; pc.lineWidth = 1; for (let x = 0; x < sw; x += 20) { pc.beginPath(); pc.moveTo(x + 0.5, 22); pc.lineTo(x + 0.5, sh); pc.stroke(); } for (let y = 22; y < sh; y += 20) { pc.beginPath(); pc.moveTo(0, y + 0.5); pc.lineTo(276, y + 0.5); pc.stroke(); }
      pc.fillStyle = 'rgba(180,220,210,0.85)'; pc.font = `600 12px ${NUMF}`; pc.textBaseline = 'middle'; pc.textAlign = 'left'; pc.fillText('BED 05', 8, 11);
      pc.fillStyle = 'rgba(120,160,150,0.3)'; pc.fillRect(0, 21, sw, 1); pc.fillRect(280, 22, 1, sh);
      pc.font = `600 11px ${NUMF}`; pc.textAlign = 'left'; pc.fillStyle = '#3dff8e'; pc.fillText('II', 6, 34); pc.fillStyle = '#4fd6ff'; pc.fillText('Pleth', 6, 160); pc.fillStyle = '#f3e35a'; pc.fillText('Resp', 6, 248);
      pc.font = `600 13px ${NUMF}`; pc.fillStyle = '#3dff8e'; pc.fillText('HR', 290, 40); pc.fillStyle = '#4fd6ff'; pc.fillText('SpO₂', 290, 140);
      pc.fillStyle = '#e8ecf0'; pc.font = `600 12px ${NUMF}`; pc.fillText('NIBP', 290, 222); pc.fillStyle = '#f3e35a'; pc.fillText('RR', 290, 280);
      pc.restore();
      const kx = Wh / 2 - 62;
      const knob = ell(kx, 40, 30, 30); pc.fillStyle = PV.radGrad(pc, kx + lx * 10, 40 + ly * 10, 2, 32, [[0, T.c('#f2f3f0')], [1, T.c('#8e949c')]]); pc.fill(knob); inkStroke(pc, D2, knob, '#3a3f46', 0.9);
      pc.strokeStyle = T.a('#5a6068', 0.6); pc.lineWidth = 1.2; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; pc.beginPath(); pc.moveTo(kx + Math.cos(a) * 22, 40 + Math.sin(a) * 22); pc.lineTo(kx + Math.cos(a) * 28, 40 + Math.sin(a) * 28); pc.stroke(); }
      for (let i = 0; i < 4; i++) { const b2 = rr(kx - 26, -Hh / 2 + 34 + i * 34, 52, 24, 6); pc.fillStyle = T.c(i === 0 ? '#e0a64a' : '#cfd3d0'); pc.fill(b2); inkStroke(pc, D2, b2, '#3a3f46', 0.7); }
      pc.fillStyle = T.a('#4a4f56', 0.8); pc.font = `600 11px ${NUMF}`; pc.textAlign = 'left'; pc.fillText('M-500', -Wh / 2 + 28, Hh / 2 - 26);
      inkStroke(pc, D2, ell(Wh / 2 - 62, Hh / 2 - 40, 7, 7), '#2a2f38', 0.7);
    });
    // ---- dynamic screen content
    c.save(); c.beginPath(); c.rect(sx, sy, sw, sh); c.clip(); c.translate(sx, sy);
    // header clock
    c.fillStyle = 'rgba(180,220,210,0.85)'; c.font = `600 12px ${NUMF}`; c.textBaseline = 'middle';
    c.textAlign = 'right'; const hh = Math.floor(((o.clockBase || 14 * 3600 + 32 * 60) + t) / 60); c.fillText(String(Math.floor(hh / 60) % 24).padStart(2, '0') + ':' + String(hh % 60).padStart(2, '0'), sw - 8, 11);
    // traces
    const tw = 276, spd = o.speed || 110, gap = 16; const wx = ((t * spd) % tw + tw) % tw; const scroll = o.mode === 'scroll';
    const trace = (y0, amp, col, fn, glow) => {
      const segs = [[]];
      for (let x = 0; x <= tw; x += 1.5) {
        let age;
        if (scroll) age = (tw - x) / spd; else { if (x > wx && x < wx + gap) { if (segs[segs.length - 1].length) segs.push([]); continue; } age = x <= wx ? (wx - x) / spd : (wx - x + tw) / spd; }
        const tau = t - age; const s = ((tau - ph0) % Tb + Tb) % Tb;
        segs[segs.length - 1].push([x, y0 - fn(s, tau) * amp]);
      }
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
      for (const [lw, a] of [[7, 0.12 * glow], [3.4, 0.35], [1.7, 1]]) {
        c.strokeStyle = rgba(col, a); c.lineWidth = lw;
        for (const sg of segs) { if (sg.length < 2) continue; c.beginPath(); sg.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); }
      }
      if (!scroll) { const hx = wx, last = segs.flat().reduce((b, p) => (Math.abs(p[0] - hx) < Math.abs(b[0] - hx) ? p : b), [0, y0]); glossy(c, last[0], last[1], 10, 10, 0, col, 0.7); }
      c.restore();
    };
    const glow = o.screenGlow === undefined ? 0.6 : o.screenGlow;
    trace(105, 62, '#3dff8e', (s, tau) => ecgWave(s) + 0.012 * PV.noise2(tau * 9, 1), 1 + glow);
    trace(205, 42, '#4fd6ff', (s) => plethWave(s, Tb), 1 + glow);
    trace(270, 14, '#f3e35a', (s, tau) => Math.sin(tau * TAU / 3.8), 1 + glow);
    // numerics
    const hr = Math.round(bpm + PV.noise2(Math.floor(t / 2), 4) * 1.4);
    const beatA = Math.exp(-sinceBeat * 9);
    c.fillStyle = '#3dff8e'; c.font = `300 64px ${NUMF}`; c.textAlign = 'right'; c.fillText(String(hr), sw - 10, 86);
    c.fillStyle = `rgba(61,255,142,${0.25 + 0.75 * beatA})`; c.save(); c.translate(300, 62); c.scale(0.9, 0.9); c.beginPath(); c.moveTo(0, 4); c.bezierCurveTo(0, -4, 10, -4, 10, 3); c.bezierCurveTo(10, -4, 20, -4, 20, 4); c.bezierCurveTo(20, 10, 12, 14, 10, 18); c.bezierCurveTo(8, 14, 0, 10, 0, 4); c.fill(); c.restore();
    c.fillStyle = '#4fd6ff'; c.textAlign = 'right'; c.font = `300 48px ${NUMF}`; c.fillText(String(o.spo2 || 98), sw - 10, 184);
    c.fillStyle = '#e8ecf0'; c.font = `400 22px ${NUMF}`; c.fillText(o.nibp || '116/74', sw - 10, 250);
    c.fillStyle = '#f3e35a'; c.fillText(String(o.rr || 16), sw - 10, 284);
    // glass glare
    c.fillStyle = PV.linGrad(c, 0, 0, sw, sh, [[0, '#ffffff', 0.08], [0.35, '#ffffff', 0.0], [0.62, '#ffffff', 0.0], [0.7, '#ffffff', 0.05], [0.78, '#ffffff', 0.0]]); c.fillRect(0, 0, sw, sh);
    c.restore();
    // beat lamp: blinks with every beat (ピッ)
    const lampX = Wh / 2 - 62, lampY = Hh / 2 - 40;
    c.fillStyle = mixH('#1e3a2a', '#5cff9a', beatA); c.beginPath(); c.arc(lampX, lampY, 6.2, 0, TAU); c.fill();
    if (beatA > 0.05) { c.save(); c.globalCompositeOperation = 'screen'; glossy(c, lampX, lampY, 34, 34, 0, '#5cff9a', 0.8 * beatA); c.restore(); }
    c.restore();
    // screen light spill in world space
    if (glow > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; const s = o.s || 1; glossy(ctx, (o.x || 0) - 40 * s, (o.y || 0) - 10 * s, 420 * s, 300 * s, 0, '#4fe0b0', 0.1 * glow); ctx.restore(); }
  };

  /* ===================================================================== IV DRIP
   * Drip bag on a stand.  Anchor: the hook at the top of the pole.  Natural size ≈ 220×760 (bag+chamber+tube).
   * o.rate (drops/s, default 0.75)  o.level (bag fill 0..1, default 0.6)  o.pole (default true, o.poleLen 900)
   * o.tubeTo {dx, dy}: where the tube runs to, relative to the anchor (default {dx: 160, dy: 760})
   * o.label (default '500mL')   o.poleX: x of the pole relative to the hook (default -96: the bag hangs clear of it)
   */
  L.ivDrip = function (ctx, t, o) {
    o = o || {}; const D = setup(o); const { T, lx, ly } = D;
    begin(ctx, o); const c = ctx;
    const rate = o.rate || 0.75, level = o.level === undefined ? 0.6 : o.level;
    const PX = o.poleX === undefined ? -96 : o.poleX; // the pole stands clear of the bag; crown arms carry the hooks
    if (o.pole !== false) {
      const pl = o.poleLen || 900;
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      const metal = (w0) => { c.strokeStyle = T.a('#2a2f38', 0.9); c.lineWidth = w0 + 3; c.stroke(); c.strokeStyle = PV.linGrad(c, PX - 6, 0, PX + 6, 0, [[0, T.c('#f2f4f6')], [0.4, T.c('#aab2bc')], [1, T.c('#6c7480')]]); c.lineWidth = w0; c.stroke(); };
      c.beginPath(); c.moveTo(PX, -44); c.lineTo(PX, pl); metal(8);
      // crown: two curved arms (ram's horn), the bag hangs from the right one
      const arm = (x1) => { c.beginPath(); c.moveTo(PX, -36); c.bezierCurveTo(PX + (x1 - PX) * 0.35, -62, x1 - (x1 - PX) * 0.1, -52, x1, -26); };
      arm(PX - 74); metal(4.5); arm(22); metal(4.5);
      c.fillStyle = T.c('#d6dbe0'); c.beginPath(); c.arc(PX, -46, 6, 0, TAU); c.fill(); inkStroke(c, D, ell(PX, -46, 6, 6), '#2a2f38', 0.8);
      c.strokeStyle = T.c('#b9c0c8'); c.lineWidth = 3; c.beginPath(); c.moveTo(PX - 74, -26); c.arc(PX - 80, -22, 6, -0.6, Math.PI * 0.9); c.stroke();
      c.restore();
    }
    // hook
    c.strokeStyle = T.c('#b9c0c8'); c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(22, -26); c.lineTo(22, -4); c.arc(16, -4, 6, 0, Math.PI * 0.9); c.stroke();
    // bag
    const bw = 150, bh = 250, by0 = 2;
    const bag = new Path2D();
    bag.moveTo(16 - bw / 2 + 10, by0 + 10); bag.lineTo(16 + bw / 2 - 10, by0 + 10); bag.quadraticCurveTo(16 + bw / 2 + 4, by0 + 14, 16 + bw / 2, by0 + 40);
    bag.lineTo(16 + bw / 2 - 4, by0 + bh - 40); bag.quadraticCurveTo(16 + bw / 2 - 10, by0 + bh, 16 + 18, by0 + bh + 6); bag.lineTo(16 - 18, by0 + bh + 6);
    bag.quadraticCurveTo(16 - bw / 2 + 10, by0 + bh, 16 - bw / 2 + 4, by0 + bh - 40); bag.lineTo(16 - bw / 2, by0 + 40); bag.quadraticCurveTo(16 - bw / 2 - 4, by0 + 14, 16 - bw / 2 + 10, by0 + 10); bag.closePath();
    // hanger tab with hole
    const tab = new Path2D(); tab.roundRect(16 - 22, by0 - 10, 44, 26, 6); tab.moveTo(16 + 6, by0); tab.arc(16, by0, 6, 0, TAU, true);
    c.fillStyle = T.a('#eef3f7', 0.85); c.fill(tab, 'evenodd'); inkStroke(c, D, tab, '#6a7a8a', 0.6);
    c.fillStyle = T.a('#e8f0f6', 0.38); c.fill(bag);
    // liquid
    c.save(); c.clip(bag);
    const ly0 = by0 + 30 + (1 - level) * (bh - 50);
    c.fillStyle = PV.linGrad(c, 0, ly0, 0, by0 + bh, [[0, '#d9ecf8', 0.55], [1, '#b8d6ec', 0.7]]); c.fillRect(-200, ly0, 400, bh);
    c.strokeStyle = rgba(T.hi, 0.9); c.lineWidth = 2; c.beginPath(); c.moveTo(16 - bw / 2, ly0); c.quadraticCurveTo(16, ly0 + 3, 16 + bw / 2, ly0); c.stroke();
    // label
    const lb = rr(16 - 52, by0 + 70, 104, 110, 4); c.fillStyle = T.a('#ffffff', 0.92); c.fill(lb);
    c.fillStyle = T.c('#2f5fa8'); c.fillRect(16 - 52, by0 + 70, 104, 16);
    c.fillStyle = T.c('#ffffff'); c.font = `600 10px ${UIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('点滴静注用', 16, by0 + 78);
    c.fillStyle = T.c('#1f2a3a'); c.font = `700 15px ${UIF}`; c.fillText('輸液', 16, by0 + 104); c.font = `600 18px ${NUMF}`; c.fillText(o.label || '500mL', 16, by0 + 132);
    c.fillStyle = T.a('#7a8494', 0.8); for (let i = 0; i < 4; i++) c.fillRect(16 - 40, by0 + 150 + i * 7, 80 - (i % 2) * 22, 2);
    // scale marks
    c.strokeStyle = T.a('#4a6a8a', 0.7); c.lineWidth = 1; c.font = `500 8px ${NUMF}`; c.fillStyle = T.a('#4a6a8a', 0.8); c.textAlign = 'left';
    for (let i = 1; i <= 4; i++) { const yy = by0 + 40 + i * 42; c.beginPath(); c.moveTo(16 + bw / 2 - 18, yy); c.lineTo(16 + bw / 2 - 8, yy); c.stroke(); c.fillText(String(i * 100), 16 + bw / 2 - 34, yy); }
    // creases & sheen of soft plastic
    c.strokeStyle = rgba(T.hi, 0.7); c.lineWidth = 3; c.beginPath(); c.moveTo(16 - bw / 2 + 14, by0 + 30); c.quadraticCurveTo(16 - bw / 2 + 6, by0 + bh * 0.5, 16 - bw / 2 + 16, by0 + bh - 30); c.stroke();
    c.strokeStyle = T.a('#9fb2c4', 0.45); c.lineWidth = 1.5; c.beginPath(); c.moveTo(16 + 20, by0 + 20); c.quadraticCurveTo(16 + 34, by0 + 60, 16 + 26, by0 + 90); c.stroke();
    c.restore();
    inkStroke(c, D, bag, '#5a6a7a', 0.8);
    if (D.rimA > 0) crescent(c, bag, -lx * 4, -ly * 4, rgba(T.rim, D.rimA));
    // port + spike → drip chamber
    const px = 16, py = by0 + bh + 6;
    c.fillStyle = T.a('#f2f5f8', 0.9); c.fillRect(px - 6, py, 12, 18); inkStroke(c, D, rr(px - 6, py, 12, 18, 2), '#5a6a7a', 0.6);
    const cx0 = px, cy0 = py + 22, cw = 28, ch = 84;
    const chamber = rr(cx0 - cw / 2, cy0, cw, ch, 8);
    c.fillStyle = T.a('#eef4f9', 0.3); c.fill(chamber);
    const liq = cy0 + ch * 0.66;
    c.save(); c.clip(chamber); c.fillStyle = T.a('#bcd8ee', 0.6); c.fillRect(cx0 - cw, liq, cw * 2, ch); c.restore();
    // drops
    const per = 1 / rate, u = (((t - (o.phase || 0)) % per) + per) % per / per; const orifY = cy0 + 10;
    c.fillStyle = T.a('#e6f2fc', 0.95);
    if (u < 0.78) { const g = u / 0.78; const rD = 1 + g * 3.6; c.beginPath(); c.ellipse(cx0, orifY + rD * 0.9, rD * 0.95, rD * 1.1, 0, 0, TAU); c.fill(); c.fillStyle = rgba(T.hi, 0.95); c.beginPath(); c.arc(cx0 - rD * 0.35, orifY + rD * 0.6, rD * 0.3, 0, TAU); c.fill(); }
    else { const g = (u - 0.78) / 0.22; const yy = orifY + 6 + g * g * (liq - orifY - 6); c.beginPath(); c.ellipse(cx0, yy, 3.2, 4.4 + g * 2, 0, 0, TAU); c.fill(); c.fillStyle = rgba(T.hi, 0.95); c.beginPath(); c.arc(cx0 - 1, yy - 1.4, 1.1, 0, TAU); c.fill(); }
    if (u < 0.25) { const g = u / 0.25; c.strokeStyle = T.a('#ffffff', 0.7 * (1 - g)); c.lineWidth = 1.2; c.beginPath(); c.ellipse(cx0, liq + 1, 4 + g * 9, 1 + g * 1.6, 0, 0, TAU); c.stroke(); }
    c.fillStyle = T.a('#cfe0ee', 0.9); c.fillRect(cx0 - 3, orifY - 8, 6, 8);
    c.strokeStyle = rgba(T.hi, 0.8); c.lineWidth = 2; c.beginPath(); c.moveTo(cx0 - cw / 2 + 5, cy0 + 8); c.lineTo(cx0 - cw / 2 + 5, cy0 + ch - 8); c.stroke();
    inkStroke(c, D, chamber, '#5a6a7a', 0.8);
    // tube with a roller clamp
    const to = o.tubeTo || { dx: 160, dy: 760 };
    const tb = [[cx0, cy0 + ch], [cx0, cy0 + ch + 120], [cx0 + 10, cy0 + ch + 260], [lerp(cx0, to.dx, 0.6), lerp(cy0 + ch + 260, to.dy, 0.6) + 40], [to.dx, to.dy]];
    const tp = new Path2D(); smoothOpen(tp, tb);
    c.save(); c.lineCap = 'round'; c.strokeStyle = T.a('#6a7a8a', 0.8); c.lineWidth = 6.5; c.stroke(tp); c.strokeStyle = T.a('#eef4f8', 0.9); c.lineWidth = 4.2; c.stroke(tp); c.strokeStyle = rgba(T.hi, 0.9); c.lineWidth = 1.2; c.save(); c.translate(-1.2, 0); c.stroke(tp); c.restore(); c.restore();
    const clY = cy0 + ch + 150; const cl0 = rr(cx0 - 15, clY, 30, 46, 6); c.fillStyle = T.c('#e8ecf0'); c.fill(cl0); inkStroke(c, D, cl0, '#3a4a5a', 0.8);
    c.fillStyle = T.c('#3b78c8'); c.beginPath(); c.ellipse(cx0 + 2, clY + 20, 9, 9, 0, 0, TAU); c.fill(); inkStroke(c, D, ell(cx0 + 2, clY + 20, 9, 9), '#1a3a6a', 0.7);
    c.restore();
  };

  /* ===================================================================== NOTEBOOK (NAME)
   * 左手で何度も書かれた名前（字は伏せ、歪んだ擬似漢字の筆跡）と、落ちてシミになる涙。
   * Anchor: centre of the open notebook (gutter).  Natural size 800×560 (two B5 pages).
   * o.k (vertical foreshortening, default 0.86)   o.page 'right' (default) | 'left'
   * o.lines (number of written lines, default 11)   o.perLine (names per line, default 3)
   * o.progress 0..1 (how much is written)  — or o.writeStart + o.writeSpeed (strokes/s) to animate with t
   * o.tears: [{at, u, v}] tear drops (time, page coords 0..1). default: one tear at o.tearAt (if set)
   * Returns {x, y} (screen) of the current pen tip so a hand can be placed there.
   */
  function glyphDefs(seed) {
    // four pseudo-kanji (surname 2 + given name 2): plausible stroke clusters that spell nothing
    const H = (y, x0 = 0.12, x1 = 0.88) => [[x0, y], [x1, y - 0.04]], V = (x, y0 = 0.1, y1 = 0.92) => [[x, y0], [x + 0.02, y1]];
    return [
      [[[0.18, 0.12], [0.1, 0.4]], H(0.3, 0.3, 0.9), V(0.6, 0.12, 0.62), [[0.32, 0.5], [0.86, 0.46], [0.8, 0.9]], [[0.36, 0.72], [0.62, 0.7]], [[0.1, 0.62], [0.24, 0.92]]],
      [[[0.12, 0.3], [0.44, 0.18]], [[0.3, 0.1], [0.24, 0.9], [0.14, 0.82]], [[0.56, 0.16], [0.9, 0.14], [0.86, 0.5]], H(0.5, 0.56, 0.86), [[0.6, 0.62], [0.52, 0.92]], [[0.72, 0.64], [0.92, 0.9]]],
      [[[0.5, 0.08], [0.54, 0.26]], H(0.3, 0.1, 0.9), [[0.26, 0.42], [0.74, 0.42], [0.7, 0.62], [0.28, 0.64], [0.26, 0.42]], [[0.5, 0.64], [0.2, 0.92]], [[0.5, 0.66], [0.84, 0.9]]],
      [[[0.16, 0.18], [0.36, 0.3]], [[0.1, 0.5], [0.34, 0.46]], [[0.2, 0.92], [0.4, 0.66]], [[0.5, 0.2], [0.9, 0.18], [0.84, 0.84], [0.72, 0.78]], [[0.56, 0.52], [0.78, 0.5]], [[0.6, 0.34], [0.62, 0.8]]],
    ];
  }
  const NB_INK = new Map();
  L.notebookName = function (ctx, t, o) {
    o = o || {}; const D = setup(o); const { T, lx, ly } = D;
    const k = o.k || 0.86, PW = 380, PH = 540, lineH = 30;
    begin(ctx, o); const c = ctx;
    // ---- paper (cached)
    const paperKey = 'nb|' + D.T.key + '|' + k;
    const spr = sprite(paperKey, 900, 700, (o.s || 1), (pc) => {
      pc.translate(450, 350); pc.scale(1, k);
      const pages = rr(-PW - 6, -PH / 2, PW * 2 + 12, PH, 6);
      pc.save(); pc.translate(-lx * 16, -ly * 16 + 10); pc.fillStyle = rgba(T.sh, 0.4); pc.filter = 'blur(12px)'; pc.fill(pages); pc.restore();
      // page stack edges
      for (let i = 4; i >= 1; i--) { pc.fillStyle = T.c(mixH('#f1ede4', '#9a958a', i * 0.12)); pc.fill(rr(-PW - 6 - i, -PH / 2 + i * 1.5, PW * 2 + 12 + i * 2, PH, 6)); }
      // cover peeking
      pc.fillStyle = T.c('#3d5a86'); pc.fill(rr(-PW - 12, -PH / 2 - 4, PW * 2 + 24, PH + 10, 8));
      for (const side of [-1, 1]) {
        const pg = rr(side < 0 ? -PW : 0, -PH / 2, PW, PH, side < 0 ? [6, 0, 0, 6] : [0, 6, 6, 0]);
        pc.fillStyle = PV.linGrad(pc, side * PW, 0, 0, 0, [[0, T.c('#fbfaf6')], [0.82, T.c('#f4f2ec')], [1, T.c('#d6d2c8')]]); pc.fill(pg);
        pc.save(); pc.clip(pg);
        pc.strokeStyle = T.a('#8fb0d4', 0.55); pc.lineWidth = 1.1;
        for (let y = -PH / 2 + 62; y < PH / 2 - 20; y += lineH) { pc.beginPath(); pc.moveTo(side < 0 ? -PW + 18 : 14, y); pc.lineTo(side < 0 ? -14 : PW - 18, y); pc.stroke(); }
        pc.strokeStyle = T.a('#e39aa6', 0.5); pc.beginPath(); pc.moveTo(side < 0 ? -PW + 18 : 14, -PH / 2 + 42); pc.lineTo(side < 0 ? -14 : PW - 18, -PH / 2 + 42); pc.stroke();
        pc.fillStyle = T.a('#7a8aa8', 0.7); pc.font = `500 11px ${NUMF}`; pc.textBaseline = 'middle'; pc.fillText('No.', side < 0 ? -PW + 22 : 18, -PH / 2 + 26); pc.fillText('Date  .  .', side < 0 ? -150 : PW - 120, -PH / 2 + 26);
        // gutter shadow + paper tooth
        pc.fillStyle = PV.linGrad(pc, 0, 0, side * 70, 0, [[0, '#6a6458', 0.35], [1, '#6a6458', 0]]); pc.fillRect(side < 0 ? -70 : 0, -PH / 2, 70, PH);
        pc.restore();
        inkStroke(pc, D, pg, '#8a8478', 0.6);
      }
    });
    c.drawImage(spr.img, -450, -350, 900, 700);
    // ---- writing (dynamic)
    const G = glyphDefs(o.seed || 1);
    const nLines = o.lines === undefined ? 11 : o.lines, perLine = o.perLine || 3;
    const x0 = (o.page === 'left' ? -PW + 28 : 26), yTop = -PH / 2 + 62;
    // total stroke count for progress
    const strokes = [];
    for (let li = 0; li < nLines; li++) for (let ni = 0; ni < perLine; ni++) for (let gi = 0; gi < 4; gi++) for (let si = 0; si < G[gi].length; si++) strokes.push([li, ni, gi, si]);
    let shown = strokes.length;
    if (o.progress !== undefined) shown = Math.floor(o.progress * strokes.length);
    else if (o.writeSpeed) shown = Math.max(0, Math.min(strokes.length, Math.floor((t - (o.writeStart || 0)) * o.writeSpeed)));
    let tip = null;
    const strokePts = (li, ni, gi, si, partial) => {
      const r = PV.rng(li * 977 + ni * 131 + gi * 17 + si * 3 + 5);
      const sz = 22 + 5 * PV.rand1(li * 7 + ni, 2) + (r() - 0.5) * 4; // size wobbles per glyph
      const gx = x0 + ni * 118 + gi * 26 + (gi >= 2 ? 10 : 0) + (r() - 0.5) * 3, gy = yTop + li * lineH - sz - 3 + (r() - 0.5) * 3 + PV.rand1(li * 3 + ni, 8) * 3;
      const slant = (PV.rand1(li * 11 + ni * 3 + gi, 4) - 0.5) * 0.35;
      const src = G[gi][si]; const pts = [];
      const shake = 0.06 + 0.04 * PV.rand1(li, 6);
      for (let a = 0; a < src.length - 1; a++) {
        const p = src[a], q = src[a + 1]; const steps = 7;
        for (let s2 = 0; s2 <= steps; s2++) {
          if (a > 0 && s2 === 0) continue; const f = s2 / steps;
          let u = lerp(p[0], q[0], f), v = lerp(p[1], q[1], f);
          u += PV.noise2(li * 3.1 + ni + gi * 1.7 + u * 6, si * 2.3 + v * 6) * shake; v += PV.noise2(li * 1.3 + gi * 2.9 + u * 6, si * 5.1 + v * 6 + 9) * shake;
          pts.push([gx + (u + (1 - v) * slant) * sz, gy + v * sz]);
        }
      }
      if (partial !== undefined) { const n = Math.max(2, Math.floor(pts.length * partial)); return pts.slice(0, n); }
      return pts;
    };
    const pageY = (py) => py * k;
    const strokePath = (c2, pts) => { c2.beginPath(); pts.forEach((p, j) => (j ? c2.lineTo(p[0], pageY(p[1])) : c2.moveTo(p[0], pageY(p[1])))); c2.stroke(); };
    // finished strokes accumulate in a cached ink layer (only the new strokes are drawn each frame)
    const rB = Math.pow(2, Math.ceil(Math.log2(Math.max(0.35, (o.s || 1) * (o.res || 1))) * 2) / 2);
    const inkKey = [paperKey, o.seed || 1, nLines, perLine, o.page, rB].join('|');
    let ink = NB_INK.get(inkKey);
    if (!ink) { ink = PV.makeCanvas(Math.ceil(900 * rB), Math.ceil(700 * rB)); ink.count = 0; NB_INK.set(inkKey, ink); }
    if (shown < ink.count) { ink.ctx.setTransform(1, 0, 0, 1, 0, 0); ink.ctx.clearRect(0, 0, ink.canvas.width, ink.canvas.height); ink.count = 0; }
    if (shown > ink.count) {
      const ic = ink.ctx; ic.setTransform(rB, 0, 0, rB, 450 * rB, 350 * rB); ic.lineCap = 'round'; ic.lineJoin = 'round'; ic.strokeStyle = rgba('#1d2440', 0.92);
      for (let i = ink.count; i < shown; i++) { const [li, ni, gi, si] = strokes[i]; ic.lineWidth = 1.7 + 0.5 * PV.rand1(i, 1); strokePath(ic, strokePts(li, ni, gi, si)); }
      ink.count = shown;
    }
    c.drawImage(ink.canvas, -450, -350, 900, 700);
    // the stroke being written right now (partial)
    if (shown < strokes.length && (o.writeSpeed && t >= (o.writeStart || 0))) {
      const fr = ((t - (o.writeStart || 0)) * o.writeSpeed) % 1; const [li, ni, gi, si] = strokes[shown]; const pts = strokePts(li, ni, gi, si, fr);
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = rgba('#1d2440', 0.92); c.lineWidth = 1.8; strokePath(c, pts); c.restore();
      const e = pts[pts.length - 1]; tip = [e[0], e[1] * k];
    }
    // ---- tears: the paper goes translucent and darker where wet, a tide line forms at the rim, the
    // ruled lines and the ink bleed; the wet sheen only lasts while the drop is fresh
    const tears = o.tears || (o.tearAt !== undefined ? [{ at: o.tearAt, u: o.tearU === undefined ? 0.46 : o.tearU, v: o.tearV === undefined ? 0.2 : o.tearV }] : []);
    let soft = null;
    for (const tr of tears) {
      const tx = (o.page === 'left' ? -PW : 0) + tr.u * PW, ty = (-PH / 2 + tr.v * PH) * k; const age = t - tr.at;
      if (age < -0.35) continue;
      if (age < 0) { // falling drop
        const g = 1 + age / 0.35; const yy = ty - (1 - g) * 260; const rr0 = 5 + g * 4;
        c.save(); c.fillStyle = 'rgba(220,235,250,0.55)'; c.beginPath(); c.moveTo(tx, yy - rr0 * 2.2); c.quadraticCurveTo(tx + rr0, yy - rr0 * 0.4, tx, yy + rr0); c.quadraticCurveTo(tx - rr0, yy - rr0 * 0.4, tx, yy - rr0 * 2.2); c.fill();
        c.fillStyle = rgba(T.hi, 0.95); c.beginPath(); c.ellipse(tx - rr0 * 0.3, yy - rr0 * 0.2, rr0 * 0.25, rr0 * 0.4, 0, 0, TAU); c.fill(); c.restore();
        continue;
      }
      const rad = 30 * (1 - Math.exp(-age * 2.6)) + 3; const seed = Math.round(tr.u * 100 + tr.v * 1000);
      const stain = blob(tx, ty, rad, rad * k * 0.92, seed, 0.16, 18, 1.8);
      c.save(); c.clip(stain);
      c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgba(218,222,232,0.8)'; c.fill(stain);
      c.fillStyle = PV.radGrad(c, tx, ty, rad * 0.45, rad, [[0, '#ffffff', 0], [0.88, '#a8b0c4', 0.18], [1, '#7c86a2', 0.32]]); c.fill(stain);
      c.globalCompositeOperation = 'source-over';
      // ruled lines bleed (wider, softer, bluer)
      c.strokeStyle = 'rgba(120,150,200,0.32)'; c.lineWidth = 3.2;
      for (let y = -PH / 2 + 62; y < PH / 2 - 20; y += lineH) { const yy = y * k; if (Math.abs(yy - ty) > rad) continue; c.beginPath(); c.moveTo(tx - rad, yy + 0.6); c.lineTo(tx + rad, yy + 0.6); c.stroke(); }
      // ink bleed: a soft (down-sampled) copy of the ink, tinted blue
      if (!soft) {
        soft = PV.buffer('nb_soft', Math.ceil(ink.canvas.width / 4), Math.ceil(ink.canvas.height / 4)); const sc = soft.ctx;
        sc.clearRect(0, 0, soft.canvas.width, soft.canvas.height); sc.imageSmoothingQuality = 'high'; sc.drawImage(ink.canvas, 0, 0, soft.canvas.width, soft.canvas.height);
        sc.globalCompositeOperation = 'source-atop'; sc.fillStyle = '#34488e'; sc.fillRect(0, 0, soft.canvas.width, soft.canvas.height); sc.globalCompositeOperation = 'source-over';
      }
      c.globalAlpha *= 0.75; c.drawImage(soft.canvas, -450, -350, 900, 700); c.globalAlpha /= 0.75;
      // the paper cockles a little: a light and a dark crescent
      c.fillStyle = PV.linGrad(c, tx + lx * rad, ty + ly * rad * k, tx - lx * rad, ty - ly * rad * k, [[0, '#ffffff', 0.18], [0.5, '#ffffff', 0], [1, '#3a4260', 0.1]]); c.fill(stain);
      c.restore();
      const wet = Math.exp(-age * 1.4);
      c.save(); c.strokeStyle = 'rgba(92,100,130,0.34)'; c.lineWidth = 1.1; c.stroke(stain); if (wet > 0.05) { c.strokeStyle = `rgba(255,255,255,${0.35 * wet})`; c.lineWidth = 1; c.stroke(moved(stain, 0, 1.4)); } c.restore();
      if (wet > 0.03) { glossy(c, tx + lx * rad * 0.3, ty + ly * rad * 0.28 * k, rad * 0.32, rad * 0.16 * k, -0.4, T.hi, 0.45 * wet); spec(c, tx + lx * rad * 0.38, ty + ly * rad * 0.3 * k, 2.6, 1.4, -0.4, T.hi, 0.9 * wet); }
      if (age < 0.25) { const g = age / 0.25; c.strokeStyle = rgba(T.hi, 0.6 * (1 - g)); c.lineWidth = 1.5; c.beginPath(); c.ellipse(tx, ty, 8 + g * 34, (8 + g * 34) * k * 0.9, 0, 0, TAU); c.stroke(); }
    }
    c.restore();
    if (!tip) return null;
    const s = o.s || 1, rot = o.rot || 0; const ca = Math.cos(rot), sa = Math.sin(rot);
    return { x: (o.x || 0) + (tip[0] * ca - tip[1] * sa) * s, y: (o.y || 0) + (tip[0] * sa + tip[1] * ca) * s };
  };

  /* ===================================================================== COURTYARD BENCH
   * 中庭の吹きさらしの古いベンチ（変色、端が欠けている）と木漏れ日。
   * Anchor: ground point under the centre of the seat.  Natural size ≈ 760×380.
   * o.yaw (default 0.32)  o.elev (default 0.22)  o.t (time, animates the dappled light)
   * o.komorebi 0..1 (default 0.8) — leaf shade with sunlit spots drifting   o.sun '#hex'
   */
  L.courtyardBench = function (ctx, o) {
    o = o || {}; const D = setup(o); const { T, lx, ly } = D; const t = o.t || 0;
    const P = cam(o.yaw === undefined ? 0.32 : o.yaw, o.elev === undefined ? 0.22 : o.elev);
    const Lb = 620, seatH = 150, depth = 150;
    const statKey = 'bench2|' + [o.yaw, o.elev, D.T.key, D.la.toFixed(2)].join(',');
    begin(ctx, o); const c = ctx;
    const parts = [];
    const box = (x0, x1, y0, y1, z0, z1, kind, seed) => parts.push({ x0, x1, y0, y1, z0, z1, kind, seed });
    // frames (two ends), seat slats, back slats
    for (const ex of [-Lb / 2 + 50, Lb / 2 - 50]) { box(ex - 8, ex + 8, 0, seatH - 8, -depth / 2 + 6, -depth / 2 + 22, 'iron'); box(ex - 8, ex + 8, 0, seatH - 8, depth / 2 - 22, depth / 2 - 6, 'iron'); box(ex - 7, ex + 7, seatH - 22, seatH - 8, -depth / 2, depth / 2, 'iron'); box(ex - 7, ex + 7, seatH - 8, seatH + 190, depth / 2 - 4, depth / 2 + 12, 'iron'); }
    const slW = 30, gap = 10;
    for (let i = 0; i < 4; i++) { const z0 = -depth / 2 + i * (slW + gap); box(-Lb / 2, Lb / 2, seatH - 8, seatH + 6, z0, z0 + slW, 'wood', 10 + i); }
    for (let i = 0; i < 2; i++) { const y0 = seatH + 60 + i * 64; box(-Lb / 2 + 6, Lb / 2 - 6, y0, y0 + 40, depth / 2 + 12, depth / 2 + 26, 'wood', 20 + i); }
    // draw order by layer, then far-first inside each layer: under-seat iron (legs, side rails) →
    // backrest slats → backrest posts (in front of the slats) → seat slats (cover the legs' tops & posts' feet)
    parts.forEach(p => {
      p.d = P.depth((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2);
      p.layer = p.kind === 'iron' ? (p.y1 <= seatH ? 0 : 2) : (p.y0 > seatH + 20 ? 1 : 3);
    });
    parts.sort((a, b) => a.layer - b.layer || b.d - a.d);
    const sp = sprite(statKey, 1000, 700, (o.s || 1), (sc) => {
      sc.translate(500, 520);
      // ground contact shadow
      sc.save(); sc.fillStyle = rgba(T.sh, 0.32); sc.filter = 'blur(14px)'; const g0 = [P(-Lb / 2, 0, -depth / 2), P(Lb / 2, 0, -depth / 2), P(Lb / 2, 0, depth / 2 + 30), P(-Lb / 2, 0, depth / 2 + 30)].map(q => [q[0] - lx * 60, q[1] - ly * 10]); sc.fill(polyP(g0)); sc.restore();
      for (const p of parts) {
        const faces = [
          { n: [0, 1, 0], q: [[p.x0, p.y1, p.z0], [p.x1, p.y1, p.z0], [p.x1, p.y1, p.z1], [p.x0, p.y1, p.z1]] },
          { n: [0, 0, -1], q: [[p.x0, p.y0, p.z0], [p.x1, p.y0, p.z0], [p.x1, p.y1, p.z0], [p.x0, p.y1, p.z0]] },
          { n: [-1, 0, 0], q: [[p.x0, p.y0, p.z0], [p.x0, p.y0, p.z1], [p.x0, p.y1, p.z1], [p.x0, p.y1, p.z0]] },
          { n: [1, 0, 0], q: [[p.x1, p.y0, p.z0], [p.x1, p.y0, p.z1], [p.x1, p.y1, p.z1], [p.x1, p.y1, p.z0]] },
          { n: [0, -1, 0], q: [[p.x0, p.y0, p.z0], [p.x1, p.y0, p.z0], [p.x1, p.y0, p.z1], [p.x0, p.y0, p.z1]] },
        ];
        for (const f of faces) {
          const vis = P.depth(...f.n) < -0.001 || (f.n[1] === 1 && (o.elev === undefined || o.elev > 0));
          if (!vis) continue;
          let q = f.q.map(v => P(...v));
          // chipped corner on the front slat's left end (a bite out of the top face and the front face)
          if (p.kind === 'wood' && p.seed === 10 && f.n[1] === 1) { const a = q[0], d2 = q[3]; q = [[a[0] + 40, a[1] - 3], q[1], q[2], d2, [lerp(a[0], d2[0], 0.55) + 6, lerp(a[1], d2[1], 0.55)], [a[0] + 18, a[1] + 1]]; }
          if (p.kind === 'wood' && p.seed === 10 && f.n[2] === -1) { const a = q[3], b2 = q[0]; q = [[b2[0] + 10, b2[1] - 2], q[1], q[2], [a[0] + 40, a[1] - 3], [a[0] + 18, a[1] + 5], [a[0] + 8, lerp(a[1], b2[1], 0.6)]]; }
          const path = polyP(q);
          const lam = cl(0.55 + f.n[1] * 0.45 - f.n[0] * D.lx * 0.4 + f.n[2] * 0.15, 0, 1);
          if (p.kind === 'iron') {
            sc.fillStyle = T.c(mixH('#1d2a24', '#4d6a5a', lam)); sc.fill(path);
            const r = PV.rng(p.x0 * 3 + p.y0); sc.save(); sc.clip(path); for (let i = 0; i < 6; i++) softEll(sc, lerp(q[0][0], q[2][0], r()), lerp(q[0][1], q[2][1], r()), 3 + r() * 6, 2 + r() * 4, T.c('#8a4a24'), 0.5); sc.restore();
            inkStroke(sc, D, path, '#0a100c', 0.8);
          } else {
            const r = PV.rng(p.seed * 7 + f.n[0] * 3 + f.n[2] * 5);
            const tone0 = mixH('#7a6a56', '#b8a88e', lam);
            sc.fillStyle = T.c(mixH(tone0, '#8a8a84', 0.25 + r() * 0.1)); sc.fill(path);
            sc.save(); sc.clip(path);
            // weathered grain, grey bleaching and dark water stains
            sc.strokeStyle = T.a(mixH(tone0, '#3a3024', 0.55), 0.45); sc.lineWidth = 1;
            for (let i = 0; i < 16; i++) { const fy = r(); const a = [lerp(q[0][0], q[3][0], fy), lerp(q[0][1], q[3][1], fy)], b = [lerp(q[1][0], q[2][0], fy), lerp(q[1][1], q[2][1], fy)]; sc.beginPath(); sc.moveTo(a[0], a[1]); for (let s2 = 1; s2 <= 12; s2++) { const ff = s2 / 12; sc.lineTo(lerp(a[0], b[0], ff), lerp(a[1], b[1], ff) + Math.sin(ff * 9 + i) * 0.8); } sc.stroke(); }
            for (let i = 0; i < 5; i++) { const fx = r(), fy = r(); const cx = lerp(lerp(q[0][0], q[1][0], fx), lerp(q[3][0], q[2][0], fx), fy), cy = lerp(lerp(q[0][1], q[1][1], fx), lerp(q[3][1], q[2][1], fx), fy); softEll(sc, cx, cy, 20 + r() * 60, 4 + r() * 8, T.c(r() > 0.5 ? '#d8d4c8' : '#3a2e22'), 0.3); }
            if (f.n[1] === 1) { sc.fillStyle = PV.linGrad(sc, q[0][0], q[0][1], q[3][0], q[3][1], [[0, T.hi, 0.18], [0.5, T.hi, 0.0]]); sc.fill(path); }
            sc.restore();
            inkStroke(sc, D, path, '#3a2c1e', 0.8);
          }
        }
      }
    });
    c.drawImage(sp.img, -500, -520, 1000, 700);
    // ---- komorebi: drifting leaf shade with sunlit gaps, clipped to the bench
    const kb = o.komorebi === undefined ? 0.8 : o.komorebi;
    if (kb > 0) {
      // shade layer with soft sunlit holes, masked by the bench sprite itself
      const buf = PV.buffer('props_komorebi', 1024, 720); const b = buf.ctx; b.clearRect(0, 0, 1024, 720);
      b.save(); b.translate(512, 530);
      b.fillStyle = rgba(T.sh, 0.6 * kb); b.fillRect(-512, -530, 1024, 720);
      b.globalCompositeOperation = 'destination-out';
      const r = PV.rng(o.seed || 31);
      for (let i = 0; i < 52; i++) {
        const bx = (r() - 0.5) * 920, by = -420 + r() * 560; const rad = 7 + Math.pow(r(), 2) * 38;
        const x = bx + PV.noise2(i * 1.7, t * 0.25) * 14, y = by + PV.noise2(i * 2.3 + 5, t * 0.22) * 8;
        const g = b.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        b.fillStyle = g; b.beginPath(); b.ellipse(x, y, rad, rad * 0.62, 0, 0, TAU); b.fill();
      }
      b.globalCompositeOperation = 'destination-in'; b.drawImage(sp.img, -500, -520, 1000, 700);
      b.restore();
      c.save(); c.globalCompositeOperation = 'multiply'; c.drawImage(buf.canvas, -512, -530); c.restore();
      // warm sun wash on the lit wood (masked too)
      const b2 = PV.buffer('props_komorebi2', 1024, 720); const w2 = b2.ctx; w2.clearRect(0, 0, 1024, 720);
      w2.save(); w2.translate(512, 530); w2.drawImage(sp.img, -500, -520, 1000, 700); w2.globalCompositeOperation = 'source-in'; w2.fillStyle = rgba(o.sun || '#fff1c8', 0.4 * kb); w2.fillRect(-512, -530, 1024, 720);
      w2.globalCompositeOperation = 'destination-out'; w2.drawImage(buf.canvas, -512, -530); w2.restore();
      c.save(); c.globalCompositeOperation = 'soft-light'; c.drawImage(b2.canvas, -512, -530); c.restore();
    }
    c.restore();
  };

  /* ===================================================================== PEELED APPLE + FRUIT KNIFE
   * 病室：剥きかけのリンゴと、皿の上で一続きに垂れる皮。果物ナイフは皿の縁に静かに置かれている。
   * Anchor: centre of the plate.  Natural size ≈ 520×340.   o.peeled 0..1 (default 0.55)  o.knife (default true)
   */
  L.fruitKnifeAndApple = function (ctx, o) {
    o = o || {};
    staticProp(ctx, o, 'peel2|' + [o.peeled, o.knife, o.shadow].join(','), 760, 560, 380, 280, (c, D) => {
      const { T, lx, ly } = D; const R = 74; const pf = o.peeled === undefined ? 0.55 : o.peeled;
      D.k = 0.5; plate(c, D, 230, 112, 12, '#f4f3ef');
      const AX = -46, AY = -40; // apple centre (plate-local)
      // the peeled zone is everything above a tilted boundary that rises to the right (where the knife stopped)
      const by = lerp(-0.66, 0.5, pf) * R;
      const bnd = (x) => by - x * 0.24 - 0.05 * R * Math.sin(x / R * 2.6 + 0.4);
      const A = applePath(R, 5);
      // ---- the peel: one continuous ribbon from the cut edge down the side and coiling on the plate
      const p0 = [AX + R * 0.97, AY + bnd(R * 0.97)];
      const ctrl = [p0, [AX + R * 1.16, AY + bnd(R) + 24], [AX + R * 1.22, AY + R * 0.62]];
      const cx0 = AX + R * 0.55, cy0 = AY + R * 1.12;
      for (let i = 0; i <= 9; i++) { const th = -0.15 + i / 9 * 3.3; const rad = 70 + i * 6; ctrl.push([cx0 + Math.cos(th) * rad * 1.1, cy0 + Math.sin(th) * rad * 0.42]); }
      const pts = [];
      for (let i = 0; i < ctrl.length - 1; i++) {
        const q0 = ctrl[Math.max(0, i - 1)], q1 = ctrl[i], q2 = ctrl[i + 1], q3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
        for (let j = 0; j < 6; j++) { const t2 = j / 6, t3 = t2 * t2, t4 = t3 * t2; const f = (a, b, cc, d) => 0.5 * ((2 * b) + (-a + cc) * t2 + (2 * a - 5 * b + 4 * cc - d) * t3 + (-a + 3 * b - 3 * cc + d) * t4); pts.push([f(q0[0], q1[0], q2[0], q3[0]), f(q0[1], q1[1], q2[1], q3[1])]); }
      }
      pts.push(ctrl[ctrl.length - 1]);
      const PW = 17; const twist = (i) => 0.42 + 0.62 * Math.cos(i * 0.19 + 0.9); // mostly skin-up, flipping now and then
      const peelSeg = (i0, i1) => {
        for (let i = i0; i < i1 && i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1]; const dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1; const nx = -dy / dl, ny = dx / dl;
          const w0 = Math.max(2.2, PW * Math.abs(twist(i))) / 2, w1 = Math.max(2.2, PW * Math.abs(twist(i + 1))) / 2;
          const q = polyP([[a[0] + nx * w0, a[1] + ny * w0], [b[0] + nx * w1, b[1] + ny * w1], [b[0] - nx * w1, b[1] - ny * w1], [a[0] - nx * w0, a[1] - ny * w0]]);
          const skin = twist(i) + twist(i + 1) > 0;
          c.fillStyle = skin ? T.c(i % 7 < 3 ? '#d42a40' : '#c01e36') : T.c('#fbefc8'); c.fill(q); c.strokeStyle = c.fillStyle; c.lineWidth = 0.8; c.stroke(q);
          if (skin && Math.abs(twist(i)) > 0.6) { c.strokeStyle = rgba(T.hi, 0.6); c.lineWidth = 1.4; c.beginPath(); c.moveTo(a[0] + nx * w0 * 0.4, a[1] + ny * w0 * 0.4); c.lineTo(b[0] + nx * w1 * 0.4, b[1] + ny * w1 * 0.4); c.stroke(); }
          if (!skin) { c.strokeStyle = T.a('#c8303e', 0.85); c.lineWidth = 1.4; c.beginPath(); c.moveTo(a[0] + nx * w0, a[1] + ny * w0); c.lineTo(b[0] + nx * w1, b[1] + ny * w1); c.moveTo(a[0] - nx * w0, a[1] - ny * w0); c.lineTo(b[0] - nx * w1, b[1] - ny * w1); c.stroke(); }
        }
      };
      const peelPath = new Path2D(); pts.forEach((p, i) => (i ? peelPath.lineTo(p[0], p[1]) : peelPath.moveTo(p[0], p[1])));
      // shadow of the peel on the plate
      c.save(); c.translate(-lx * 4, 4); c.filter = 'blur(3px)'; c.strokeStyle = rgba(T.sh, 0.3); c.lineWidth = PW * 0.8; c.lineCap = 'round'; c.stroke(peelPath); c.restore();
      // ---- apple
      c.save(); c.translate(AX, AY);
      softEll(c, -lx * 16, R * 0.9, R * 1.02, R * 0.24, T.sh, 0.5); softEll(c, 0, R * 0.92, R * 0.6, R * 0.1, T.sh, 0.5);
      inkUnder(c, D, A, '#5e0c1c', 1);
      c.fillStyle = PV.radGrad(c, lx * R * 0.4, ly * R * 0.35, R * 0.05, R * 1.25, [[0, T.c('#ff8a72')], [0.3, T.c('#e2353a')], [0.68, T.c('#b8162e')], [1, T.c('#6e0a1c')]]); c.fill(A);
      c.save(); c.clip(A);
      const r = PV.rng(15);
      for (let i = 0; i < 18; i++) { const a = (r() - 0.5) * 2.6; const x0 = Math.sin(a) * R * 0.98; c.strokeStyle = r() > 0.5 ? T.a('#ff6b5a', 0.22) : T.a('#7a0a1e', 0.2); c.lineWidth = 1 + r() * 2; c.beginPath(); c.moveTo(x0 * 0.55, -R * 0.62); c.bezierCurveTo(x0 * 1.02, -R * 0.2, x0, R * 0.4, x0 * 0.5, R * 0.88); c.stroke(); }
      // peeled zone
      const cut = new Path2D(); cut.moveTo(-R * 1.3, -R * 1.4); cut.lineTo(R * 1.3, -R * 1.4); for (let i = 0; i <= 20; i++) { const x = lerp(R * 1.3, -R * 1.3, i / 20); cut.lineTo(x, bnd(x)); } cut.closePath();
      c.fillStyle = PV.radGrad(c, lx * R * 0.45, ly * R * 0.45, 2, R * 1.25, [[0, T.c('#fffbe8')], [0.55, T.c('#f8ebbe')], [1, T.c('#dcc184')]]); c.fill(cut);
      c.save(); c.clip(cut);
      // knife facets: bands following the spiral, alternately catching the light
      for (let j = 1; j < 7; j++) {
        const off = -j * R * 0.21; c.beginPath(); for (let i = 0; i <= 16; i++) { const x = lerp(-R * 1.2, R * 1.2, i / 16); const y = bnd(x) + off; i ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.strokeStyle = j % 2 ? T.a('#ffffff', 0.16) : T.a('#d8b878', 0.1); c.lineWidth = R * 0.12; c.stroke();
        c.strokeStyle = T.a('#c8a464', 0.13); c.lineWidth = 0.8; c.stroke();
      }
      crescent(c, A, lx * R * 0.34, ly * R * 0.3, T.a('#b08a48', 0.28));
      glossy(c, lx * R * 0.38, ly * R * 0.42, R * 0.3, R * 0.14, -0.5, T.hi, 0.7);
      c.restore();
      // the cut edge of the skin: a fine pale rim with a hairline of red, and a soft step shadow on the flesh
      c.beginPath(); for (let i = 0; i <= 20; i++) { const x = lerp(-R * 1.1, R * 1.1, i / 20); i ? c.lineTo(x, bnd(x)) : c.moveTo(x, bnd(x)); }
      c.strokeStyle = T.a('#fff6dc', 0.95); c.lineWidth = 3; c.stroke();
      c.strokeStyle = T.a('#9a6a30', 0.35); c.lineWidth = 2; c.save(); c.translate(0, -3); c.stroke(); c.restore();
      crescent(c, A, lx * R * 0.34, ly * R * 0.3, T.a('#5a0618', 0.3));
      c.restore();
      if (D.rimA > 0) crescent(c, A, -lx * 3, -ly * 3, rgba(T.rim, D.rimA * 0.6));
      inkStroke(c, D, A, '#6e1c22', 0.9);
      // stem in its dimple
      softEll(c, R * 0.02, -R * 0.64, R * 0.16, R * 0.06, T.c('#a07a44'), 0.6);
      const st = ribbon([[0, -R * 0.62], [R * 0.03, -R * 0.82], [R * 0.1, -R * 1.0]], 6, 4.5); c.fillStyle = PV.linGrad(c, -4, 0, 6, 0, [[0, T.c('#8a5a30')], [1, T.c('#4a2a12')]]); c.fill(st); inkStroke(c, D, st, '#2e1a0a', 0.8);
      c.restore();
      // ---- the peel in front of the apple
      peelSeg(0, pts.length);
      // knife resting on the plate rim (small, blade pointing out of frame, wooden handle)
      if (o.knife !== false) {
        c.save(); c.translate(150, 46); c.rotate(-0.42);
        softEll(c, -lx * 8 + 10, 10, 120, 10, T.sh, 0.4);
        const hd = rr(-120, -9, 92, 18, 8); inkUnder(c, D, hd, '#3a2412', 1);
        c.fillStyle = PV.linGrad(c, 0, -9, 0, 9, [[0, T.c('#e2c69a')], [0.5, T.c('#c49a62')], [1, T.c('#8a6234')]]); c.fill(hd);
        c.strokeStyle = T.a('#8a6234', 0.5); c.lineWidth = 1; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-116, -6 + i * 2.4); c.quadraticCurveTo(-74, -4 + i * 2.6, -32, -6 + i * 2.4); c.stroke(); }
        for (const x of [-100, -60]) { c.fillStyle = T.c('#d9dde2'); c.beginPath(); c.arc(x, 0, 2.6, 0, TAU); c.fill(); }
        const bl = new Path2D(); bl.moveTo(-30, -6); bl.lineTo(56, -4); bl.quadraticCurveTo(78, -2, 86, 3); bl.lineTo(-30, 7); bl.closePath();
        inkUnder(c, D, bl, '#3a424e', 0.9);
        c.fillStyle = PV.linGrad(c, 0, -6, 0, 7, [[0, T.c('#f4f6f8')], [0.45, T.c('#b4bcc6')], [1, T.c('#e6eaee')]]); c.fill(bl);
        c.fillStyle = rgba(T.hi, 0.8); c.fillRect(-26, -3.5, 70, 1.4);
        c.restore();
      }
    });
  };

  /* ===================================================================== APPLE PIE
   * 喫茶店のアップルパイ（看板メニュー）+ コーヒー.  Anchor: centre of the plate.  Natural size ≈ 640×380.
   * o.coffee (default true)  o.fork (default true)  o.cream (default true: whipped-cream quenelle + mint)
   */
  L.applePie = function (ctx, o) {
    o = o || {};
    staticProp(ctx, o, 'pie2|' + [o.coffee, o.fork, o.cream, o.shadow].join(','), 960, 640, 440, 330, (c, D) => {
      const { T, lx, ly } = D; const k = 0.5; D.k = k;
      if (o.coffee !== false) {
        c.save(); c.translate(300, -86);
        softEll(c, -lx * 20, 20, 140, 50, T.sh, 0.4);
        const sau = ell(0, 10, 128, 128 * k * 0.9); c.fillStyle = PV.radGrad(c, 0, 0, 10, 130, [[0, T.c('#ffffff')], [1, T.c('#d8d6d0')]]); c.fill(sau); inkStroke(c, D, sau, '#8a8478', 0.8);
        const body = new Path2D(); body.moveTo(-72, -40); body.lineTo(-62, 26); body.quadraticCurveTo(0, 52, 62, 26); body.lineTo(72, -40); body.closePath();
        const handle = new Path2D(); handle.ellipse(86, -12, 22, 26, 0, -1.4, 1.6); c.strokeStyle = T.c('#8a8478'); c.lineWidth = 14; c.lineCap = 'round'; c.stroke(handle); c.strokeStyle = T.c('#ecebe6'); c.lineWidth = 10; c.stroke(handle);
        inkUnder(c, D, body, '#7a7468', 1); c.fillStyle = PV.linGrad(c, -72, 0, 72, 0, [[0, T.c('#ffffff')], [0.6, T.c('#ecebe6')], [1, T.c('#bdbab2')]]); c.fill(body);
        const rim = ell(0, -40, 72, 72 * k * 0.55); c.fillStyle = T.c('#f6f5f1'); c.fill(rim); inkStroke(c, D, rim, '#7a7468', 0.8);
        const cof = ell(0, -38, 64, 64 * k * 0.5); c.fillStyle = PV.radGrad(c, -10, -44, 2, 66, [[0, T.c('#6a3e22')], [0.7, T.c('#3a1e0e')], [1, T.c('#24120a')]]); c.fill(cof);
        c.fillStyle = rgba(T.hi, 0.65); c.beginPath(); c.ellipse(-22, -44, 16, 3, -0.1, 0, TAU); c.fill();
        c.strokeStyle = rgba('#ffffff', 0.2); c.lineWidth = 7; c.lineCap = 'round'; for (let i = 0; i < 2; i++) { c.beginPath(); c.moveTo(-10 + i * 22, -60); c.bezierCurveTo(-30 + i * 22, -100, 10 + i * 22, -130, -12 + i * 22, -170); c.stroke(); }
        c.restore();
      }
      plate(c, D, 236, 116, 12, '#f7f6f1');
      // wedge: apex front-left, opening toward the back-right, so the crimped rim runs diagonally at the back
      const ax = -150, ay = 64, rad = 236, a0 = -1.22, a1 = -0.42, hP = 64, bc = 13, tc = 12;
      const at = (a, r, z) => [ax + Math.cos(a) * r, ay + Math.sin(a) * r * k - z];
      softEll(c, -40 - lx * 16, ay - 10, 170, 44, T.sh, 0.45);
      // ---- outer crust (heel) along the arc
      const heel = []; for (let i = 0; i <= 18; i++) heel.push(at(lerp(a0, a1, i / 18), rad + 4, hP + 4)); for (let i = 18; i >= 0; i--) heel.push(at(lerp(a0, a1, i / 18), rad + 2, 0));
      const heelP = polyP(heel); inkUnder(c, D, heelP, '#5a3412', 1);
      c.fillStyle = PV.linGrad(c, 0, at(-0.8, rad, hP)[1], 0, at(-0.8, rad, 0)[1], [[0, T.c('#e8b25e')], [0.5, T.c('#c9863a')], [1, T.c('#9a5e22')]]); c.fill(heelP);
      // ---- front cut face (a1): bottom crust / apple slices in syrup / top lattice crust in section
      const fc = (r, z) => at(a1, r, z);
      const face = polyP([fc(0, 0), fc(rad + 2, 0), fc(rad + 4, hP + 4), fc(0, hP)]);
      inkUnder(c, D, face, '#5a3412', 1);
      c.fillStyle = T.c('#b8742a'); c.fill(face); // caramel syrup between the slices
      c.save(); c.clip(face);
      const r = PV.rng(31);
      for (let row = 0; row < 4; row++) for (let i = 0; i < 7; i++) { // stacked apple slices, a little tilted and translucent
        const u = (i + 0.5 + (r() - 0.5) * 0.5 + (row % 2) * 0.4) / 7, z = bc + 6 + row * ((hP - bc - tc - 8) / 3.4) + (r() - 0.5) * 4;
        const p = fc(u * rad, z); const ang = Math.atan2(fc(rad, 0)[1] - fc(0, 0)[1], fc(rad, 0)[0] - fc(0, 0)[0]) + (r() - 0.5) * 0.35;
        c.save(); c.translate(p[0], p[1]); c.rotate(ang);
        const L1 = 22 + r() * 10, H1 = 5 + r() * 3;
        c.fillStyle = PV.linGrad(c, 0, -H1, 0, H1, [[0, T.c('#fbe6a0')], [0.6, T.c('#f0c86a')], [1, T.c('#d89a42')]]);
        c.beginPath(); c.moveTo(-L1, 1); c.quadraticCurveTo(0, -H1 * 2.2, L1, 1); c.quadraticCurveTo(0, H1 * 0.9, -L1, 1); c.fill();
        c.fillStyle = rgba(T.hi, 0.5); c.beginPath(); c.ellipse(-L1 * 0.2, -H1 * 0.55, L1 * 0.45, 1.1, 0, 0, TAU); c.fill();
        c.restore();
      }
      // bottom & top crust bands
      const band = (z0, z1, cols) => { const q = polyP([fc(0, z0), fc(rad + 3, z0), fc(rad + 3, z1), fc(0, z1)]); c.fillStyle = PV.linGrad(c, 0, fc(0, z1)[1], 0, fc(0, z0)[1], cols); c.fill(q); };
      band(0, bc, [[0, T.c('#e2a650')], [1, T.c('#b8742c')]]);
      band(hP - tc + 2, hP + 6, [[0, T.c('#e6ab56')], [0.7, T.c('#d08c3a')], [1, T.c('#a8682a')]]);
      c.strokeStyle = T.a('#6a3a12', 0.5); c.lineWidth = 1.2; for (const z of [bc, hP - tc + 2]) { c.beginPath(); c.moveTo(...fc(0, z)); c.lineTo(...fc(rad + 3, z)); c.stroke(); }
      glossy(c, ...fc(rad * 0.55, hP * 0.5), 60, 8, Math.atan2(fc(rad, 0)[1] - fc(0, 0)[1], fc(rad, 0)[0] - fc(0, 0)[0]), T.hi, 0.35);
      c.restore();
      inkStroke(c, D, face, '#5a3412', 0.9);
      // ---- top: glossy filling showing through a woven lattice
      const tp = [at(0, 0, hP)]; for (let i = 0; i <= 18; i++) tp.push(at(lerp(a0, a1, i / 18), rad, hP));
      const topP = polyP(tp); inkUnder(c, D, topP, '#5a3412', 1);
      c.fillStyle = PV.radGrad(c, ...at(-0.8, rad * 0.5, hP), 4, rad * 0.8, [[0, T.c('#d8923e')], [1, T.c('#a85e1c')]]); c.fill(topP);
      c.save(); c.clip(topP);
      const strip = (dir, off) => { // a lattice strip on the top plane (dir: angle in the plane)
        const cxp = ax + Math.cos(-0.82) * rad * 0.55, cyp = ay + Math.sin(-0.82) * rad * 0.55 * k;
        const nx = -Math.sin(dir), ny = Math.cos(dir); const P0 = [cxp + nx * off - Math.cos(dir) * 400, cyp + (ny * off - Math.sin(dir) * 400) * k - hP], P1 = [cxp + nx * off + Math.cos(dir) * 400, cyp + (ny * off + Math.sin(dir) * 400) * k - hP];
        return [P0, P1];
      };
      for (const [di, dir] of [[0, -0.1], [1, 1.35]]) {
        for (let j = -4; j <= 4; j++) {
          const [P0, P1] = strip(dir, j * 46);
          c.lineCap = 'butt';
          c.strokeStyle = T.a('#5a2e0e', 0.55); c.lineWidth = 30; c.beginPath(); c.moveTo(...P0); c.lineTo(...P1); c.stroke();
          c.strokeStyle = PV.linGrad(c, P0[0], P0[1], P1[0], P1[1], [[0, T.c('#f2bc62')], [0.5, T.c('#e2a24a')], [1, T.c('#c9822e')]]); c.lineWidth = 24; c.stroke();
          c.strokeStyle = rgba(T.hi, 0.45); c.lineWidth = 3; c.beginPath(); c.moveTo(P0[0], P0[1] - 6); c.lineTo(P1[0], P1[1] - 6); c.stroke();
          if (di === 1) { // weave: the first set passes over every other crossing
            for (let m2 = -4; m2 <= 4; m2++) { if ((m2 + j) % 2 === 0) continue; const [Q0, Q1] = strip(-0.1, m2 * 46); const ix = intersect(P0, P1, Q0, Q1); if (!ix) continue; c.save(); c.translate(ix[0], ix[1]); c.rotate(Math.atan2(Q1[1] - Q0[1], Q1[0] - Q0[0])); c.fillStyle = PV.linGrad(c, -16, 0, 16, 0, [[0, T.c('#e8ae56')], [1, T.c('#d4923e')]]); c.fillRect(-16, -12, 32, 24); c.strokeStyle = T.a('#5a2e0e', 0.5); c.lineWidth = 2.5; c.beginPath(); c.moveTo(-16, -12); c.lineTo(16, -12); c.moveTo(-16, 12); c.lineTo(16, 12); c.stroke(); c.restore(); }
          }
        }
      }
      // powdered sugar
      for (let i = 0; i < 70; i++) { const p = at(lerp(a0, a1, r()), rad * Math.sqrt(r()) * 0.95, hP); c.fillStyle = T.a('#ffffff', 0.55 + r() * 0.4); c.beginPath(); c.arc(p[0], p[1], 0.8 + r() * 1.2, 0, TAU); c.fill(); }
      c.restore();
      inkStroke(c, D, topP, '#5a3412', 0.8);
      // crimped heel on top of the arc
      for (let i = 0; i <= 13; i++) { const p = at(lerp(a0, a1, i / 13), rad - 6, hP + 2); c.fillStyle = PV.radGrad(c, p[0] - 3, p[1] - 4, 1, 14, [[0, T.c('#f6c878')], [1, T.c('#c8843a')]]); c.beginPath(); c.ellipse(p[0], p[1], 13, 8, -0.45, 0, TAU); c.fill(); c.strokeStyle = T.a('#7a4416', 0.7); c.lineWidth = 1.1; c.stroke(); }
      if (D.rimA > 0) crescent(c, heelP, -lx * 3, -ly * 3, rgba(T.rim, D.rimA * 0.6));
      // whipped cream quenelle + mint: the café signature
      if (o.cream !== false) {
        const qx = 120, qy = 34;
        softEll(c, qx - lx * 6, qy + 16, 54, 14, T.sh, 0.35);
        const qn = new Path2D(); qn.moveTo(qx - 52, qy + 8); qn.bezierCurveTo(qx - 50, qy - 26, qx + 30, qy - 34, qx + 52, qy - 4); qn.bezierCurveTo(qx + 44, qy + 16, qx - 20, qy + 22, qx - 52, qy + 8); qn.closePath();
        inkUnder(c, D, qn, '#a89c8a', 0.9);
        c.fillStyle = PV.radGrad(c, qx - 10 + lx * 10, qy - 14, 2, 60, [[0, T.c('#ffffff')], [0.7, T.c('#f7f2e8')], [1, T.c('#ddd2c0')]]); c.fill(qn);
        c.strokeStyle = T.a('#d8ccb8', 0.8); c.lineWidth = 1.4; c.beginPath(); c.moveTo(qx - 40, qy + 2); c.bezierCurveTo(qx - 20, qy - 18, qx + 20, qy - 22, qx + 40, qy - 6); c.stroke();
        c.save(); c.translate(qx + 18, qy - 22); c.rotate(-0.5); for (const [dx2, a2] of [[-7, -0.6], [7, 0.5]]) { c.save(); c.translate(dx2, 0); c.rotate(a2); const lf = ell(0, -8, 6, 11); c.fillStyle = PV.linGrad(c, 0, -18, 0, 2, [[0, T.c('#8fd06a')], [1, T.c('#3f8a32')]]); c.fill(lf); c.strokeStyle = T.a('#cff0b0', 0.8); c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -16); c.stroke(); inkStroke(c, D, lf, '#2a5a1e', 0.7); c.restore(); } c.restore();
      }
      if (o.fork !== false) {
        c.save(); c.translate(60, 112); c.rotate(-0.12);
        const fk = new Path2D(); fk.roundRect(-150, -6, 170, 12, 6); fk.moveTo(20, -10); fk.lineTo(60, -12); fk.lineTo(60, 12); fk.lineTo(20, 10); fk.closePath();
        softEll(c, -40 - lx * 6, 10, 110, 8, T.sh, 0.35);
        inkUnder(c, D, fk, '#3a424e', 0.9); c.fillStyle = PV.linGrad(c, 0, -10, 0, 10, [[0, T.c('#f4f6f8')], [0.5, T.c('#a9b1bb')], [1, T.c('#dfe3e8')]]); c.fill(fk);
        c.fillStyle = T.c('#4a525e'); for (let i = 1; i < 4; i++) c.fillRect(38, -12 + i * 6, 22, 1.4);
        c.restore();
      }
    });
  };
  function intersect(a, b, c2, d) { const r1 = [b[0] - a[0], b[1] - a[1]], r2 = [d[0] - c2[0], d[1] - c2[1]]; const den = r1[0] * r2[1] - r1[1] * r2[0]; if (Math.abs(den) < 1e-6) return null; const tt = ((c2[0] - a[0]) * r2[1] - (c2[1] - a[1]) * r2[0]) / den; return [a[0] + r1[0] * tt, a[1] + r1[1] * tt]; }

  /* ===================================================================== APPLE CAKE
   * 苺の代わりにリンゴを使った小さなホールケーキ.  Anchor: centre of the cake base.  Natural size ≈ 520×420.
   * o.box (default true: opened cake-box base & doily)   o.k (default 0.46)
   */
  L.appleCake = function (ctx, o) {
    o = o || {};
    staticProp(ctx, o, 'cake2|' + [o.box, o.k, o.shadow].join(','), 700, 600, 350, 330, (c, D) => {
      const { T, lx, ly } = D; const k = o.k || 0.46; const R = 160, Hk = 120;
      if (o.box !== false) {
        softEll(c, -lx * 30, 30, 290, 130, T.sh, 0.45);
        const base = ell(0, 10, 236, 236 * k + 6); c.fillStyle = PV.linGrad(c, 0, -110, 0, 120, [[0, T.c('#e9d9b4')], [1, T.c('#b89a62')]]); c.fill(base); c.strokeStyle = T.a('#fff2c8', 0.6); c.lineWidth = 2; c.stroke(base); inkStroke(c, D, base, '#6a5030', 0.8);
        // doily (scalloped paper lace)
        const dl = new Path2D(); for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU; const rr0 = (R + 34) * (1 + 0.04 * Math.cos(a * 24)); const x = Math.cos(a) * rr0, y = Math.sin(a) * rr0 * k + 8; i ? dl.lineTo(x, y) : dl.moveTo(x, y); } dl.closePath();
        c.fillStyle = T.c('#fbfaf6'); c.fill(dl); c.strokeStyle = T.a('#cfc8b8', 0.8); c.lineWidth = 1; c.stroke(dl);
        c.save(); c.clip(dl); c.fillStyle = T.a('#d8d0c0', 0.6); for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; c.beginPath(); c.arc(Math.cos(a) * (R + 22), Math.sin(a) * (R + 22) * k + 8, 3, 0, TAU); c.fill(); } c.restore();
      }
      softEll(c, -lx * 14, 6, R * 1.04, R * k * 1.05, T.sh, 0.5);
      // side
      const side = new Path2D(); side.moveTo(-R, -Hk); side.lineTo(-R, 0); side.ellipse(0, 0, R, R * k, 0, Math.PI, 0, true); side.lineTo(R, -Hk); side.ellipse(0, -Hk, R, R * k, 0, 0, Math.PI, false); side.closePath();
      inkUnder(c, D, side, '#9a8e80', 1);
      // cel-shaded side: lit side, core shadow, bounce from the board on the far edge
      const sl = lx < 0 ? 1 : -1; // which way the light falls across the drum
      c.fillStyle = PV.linGrad(c, -R * sl, 0, R * sl, 0, [[0, T.c('#fffefa')], [0.26, T.c('#f6f0e6')], [0.52, T.c('#ddd2c0')], [0.78, T.c('#b6a890')], [0.92, T.c('#a69880')], [1, T.c('#c6baa4')]]); c.fill(side);
      c.save(); c.clip(side);
      const rc = PV.rng(23);
      for (let i = 0; i < 9; i++) { const yy = -Hk * (0.12 + rc() * 0.76); const a0 = 0.2 + rc() * 1.2, a1 = a0 + 0.4 + rc() * 1.0; c.strokeStyle = rc() > 0.5 ? T.a('#ffffff', 0.55) : T.a('#cfc2ac', 0.4); c.lineWidth = 1 + rc() * 1.5; c.beginPath(); c.ellipse(0, yy, R, R * k, 0, a0, a1); c.stroke(); } // spatula streaks
      c.fillStyle = PV.linGrad(c, 0, -Hk, 0, R * k, [[0, '#ffffff', 0.0], [0.85, '#a89880', 0.0], [1, '#a89880', 0.25]]); c.fill(side); c.restore();
      // top
      const topP = ell(0, -Hk, R, R * k); c.fillStyle = PV.radGrad(c, lx * 60, -Hk + ly * 24, 4, R * 1.25, [[0, T.c('#ffffff')], [0.55, T.c('#f4eee4')], [1, T.c('#d8ccb8')]]); c.fill(topP); inkStroke(c, D, topP, '#a89c8a', 0.7);
      // centre: glazed apple slices fanned into a rose (outer ring first)
      for (const [n, rr0, len, z] of [[12, 64, 46, 0], [9, 40, 40, 5], [6, 18, 32, 10]]) {
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + rr0 * 0.05; const x = Math.cos(a) * rr0, y = -Hk - 4 - z + Math.sin(a) * rr0 * k;
          c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2); c.scale(1, 0.5 + 0.5 * k);
          const sl = new Path2D(); sl.moveTo(-len / 2, 4); sl.bezierCurveTo(-len * 0.4, -len * 0.42, len * 0.4, -len * 0.42, len / 2, 4); sl.quadraticCurveTo(0, -2, -len / 2, 4); sl.closePath();
          c.fillStyle = PV.linGrad(c, 0, -len * 0.35, 0, 4, [[0, T.c('#fbe6a8')], [0.7, T.c('#f0c060')], [1, T.c('#c88a38')]]); c.fill(sl);
          c.strokeStyle = T.a('#c8283a', 0.85); c.lineWidth = 1.8; c.beginPath(); c.moveTo(-len * 0.42, -1); c.bezierCurveTo(-len * 0.34, -len * 0.38, len * 0.34, -len * 0.38, len * 0.42, -1); c.stroke();
          c.strokeStyle = T.a('#8a5a20', 0.5); c.lineWidth = 0.9; c.stroke(sl);
          c.restore();
        }
      }
      glossy(c, 0, -Hk - 10, 90, 34, 0, '#ffcf70', 0.25);
      for (let i = 0; i < 10; i++) { const a = i * 0.7; spec(c, Math.cos(a) * 50, -Hk - 8 + Math.sin(a) * 50 * k, 3, 1.4, a, T.hi, 0.9); }
      // piped cream rosettes with apple wedges around the edge
      const items = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + 0.15; items.push({ a, x: Math.cos(a) * (R - 26), y: -Hk + Math.sin(a) * (R - 26) * k, d: Math.sin(a) }); }
      items.sort((p, q) => p.d - q.d);
      for (const it of items) {
        const rp = new Path2D(); for (let j = 0; j < 7; j++) { const aa = j / 7 * TAU; const x = it.x + Math.cos(aa) * 13, y = it.y - 8 + Math.sin(aa) * 9; rp.moveTo(x + 9, y); rp.ellipse(x, y, 9, 8, aa, 0, TAU); }
        c.fillStyle = T.c('#fffdf8'); c.fill(rp); c.strokeStyle = T.a('#d2c6b2', 0.9); c.lineWidth = 1.2; c.stroke(rp);
        c.fillStyle = T.c('#fffefb'); c.beginPath(); c.ellipse(it.x, it.y - 18, 10, 9, 0, 0, TAU); c.fill(); c.stroke();
        // a thin apple wedge lying on the cream, red skin outward (苺の代わりにリンゴ)
        c.save(); c.translate(it.x, it.y - 24); c.rotate(it.a + Math.PI / 2); c.scale(1.35, 1.0);
        const w0 = new Path2D(); w0.moveTo(-18, 2); w0.quadraticCurveTo(0, -20, 18, 2); w0.quadraticCurveTo(0, -4, -18, 2); w0.closePath();
        inkUnder(c, D, w0, '#5e0a18', 0.9); c.fillStyle = T.c('#fff2cc'); c.fill(w0);
        c.strokeStyle = PV.linGrad(c, -18, -10, 18, 2, [[0, T.c('#ff6a6a')], [1, T.c('#b0142c')]]); c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-15, -2); c.quadraticCurveTo(0, -20, 15, -2); c.stroke();
        c.fillStyle = rgba(T.hi, 0.9); c.beginPath(); c.ellipse(-3, -11, 4, 1.3, -0.1, 0, TAU); c.fill();
        c.restore();
      }
      // piped shell border round the foot (front half)
      for (let i = 0; i <= 22; i++) {
        const a = lerp(0.05, Math.PI - 0.05, i / 22); const x = Math.cos(a) * R, y = Math.sin(a) * R * k - 2; const dep = Math.sin(a);
        c.save(); c.translate(x, y); c.rotate(-a + Math.PI / 2 - Math.PI / 2 * 0);
        const sh2 = new Path2D(); sh2.moveTo(-9, 2); sh2.bezierCurveTo(-10, -10, 8, -12, 11, -2); sh2.quadraticCurveTo(4, 4, -9, 2); sh2.closePath();
        c.fillStyle = PV.radGrad(c, -3 + lx * 3, -6, 1, 12, [[0, T.c('#ffffff')], [1, T.c(dep > 0.4 ? '#e6dccb' : '#d6c9b4')]]); c.fill(sh2);
        c.strokeStyle = T.a('#c8baa2', 0.8); c.lineWidth = 0.9; c.stroke(sh2);
        c.restore();
      }
      if (D.rimA > 0) { crescent(c, side, -lx * 4, -ly * 4, rgba(T.rim, D.rimA * 0.9)); }
    });
  };

})();

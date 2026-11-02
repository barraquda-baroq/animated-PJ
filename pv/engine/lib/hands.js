/* ============================================================================
 * Hands library — 『キミの右手のアイロニー』PV   (手の作画ライブラリ)
 *
 *   PV.lib.hand(ctx, o)              generic 2D hand rig (pseudo-3D skeleton)
 *   PV.lib.handRig(o)                build a rig without drawing (joint positions)
 *   PV.lib.handRender(ctx, rigs, ro) draw several rigs depth-sorted together
 *   pose functions (each returns its rig(s)):
 *   PV.lib.handOnKeys(ctx,o)     right hand playing a 3D keyboard (IK on keys, press[] per finger, shadow, fallboard reflection)
 *   PV.lib.handOnFrets(ctx,o)    his left hand fretting a chord on a rosewood neck (IK on strings, vibrato, finger shadows)
 *   PV.lib.handsTouch(ctx,o)     第五話「左手、見せて」: her fingertip touches his calloused fingertip (approach 0..1)
 *   PV.lib.handsInterlock(ctx,o) final cut: her scarred right hand + his left hand, fingers interlaced
 *   PV.lib.armCast(ctx,o)        right forearm in a white cast + arm sling, fingertips peeking out
 *   PV.lib.handOffer(ctx,o)      palm-up hand offering a folded handkerchief
 *   PV.lib.handPress(ctx,o)      palm pressed against a (rainy) window: blanched pads + fog halo
 *   PV.lib.handReach(ctx,o)      open hand reaching toward the light (great with style:'rim')
 *   PV.lib.handFist(ctx,o)       clenched, trembling fist
 *   PV.lib.handKeys(ctx,o), PV.lib.handPressCurve(u)   helpers
 *   API doc: analysis/art_review/hands_API.md
 *
 * The hand is modelled as a small 3D skeleton (metacarpal "palm discs",
 * 3 phalanges per finger, thumb = metacarpal + 2 phalanges), posed with
 * anatomical flexion, projected with a weak-perspective camera and drawn as
 * cel-shaded 2D shapes (tapered capsules + convex palm hull) with a single
 * warm outline, 1-shadow cel shading, highlights, short nails, joint
 * wrinkles, palmar creases, calluses and scars.
 *
 * Common options (o):
 *   x,y      wrist position in px          rot   screen rotation (rad, 0 = fingers up)
 *   scale    1 = hand ~195px wrist→middle fingertip
 *   side     'R' | 'L'        kind  'her' (slender pianist) | 'him' (bony guitarist)
 *   view     'back' | 'palm' | 'side' (thumb side) | 'edge' (little-finger side)
 *   yaw,pitch  extra camera rotation (rad) on top of view
 *   curl     [thumb,index,middle,ring,little] 0..1   spread  0..1 (finger fan)
 *   flex     optional per-finger [[mcp,pip,dip] rad ...] (index 0 = thumb [mcp,ip])
 *   thumb    optional {abd, opp, flex:[mcp,ip]}
 *   style    'cel' | 'silhouette' | 'rim'
 *   skin, shade, hi, line   colour overrides       light  angle TOWARD the light (rad)
 *   calluses, thumbScar, surgicalScars   booleans (defaults follow the character)
 *   t, tremble   time and tremor amplitude (0..1)
 *   arm      visible forearm length (local units, default 320), sleeve '#hex'
 *   alpha, blur   compositing
 * Deterministic: no Math.random.
 * ========================================================================== */
(function () {
  'use strict';
  const PV = window.PV; const L = (PV.lib = PV.lib || {});
  const TAU = Math.PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp, smooth = PV.smooth;

  /* ------------------------------------------------------------ vectors */
  const V = (x, y, z) => ({ x, y, z });
  const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
  const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
  const mul = (a, s) => V(a.x * s, a.y * s, a.z * s);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const vlen = a => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  const norm = a => { const l = vlen(a) || 1; return V(a.x / l, a.y / l, a.z / l); };
  const mix3 = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  function rotAxis(v, k, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), kd = dot(k, v), kv = cross(k, v);
    return V(v.x * c + kv.x * s + k.x * kd * (1 - c), v.y * c + kv.y * s + k.y * kd * (1 - c), v.z * c + kv.z * s + k.z * kd * (1 - c));
  }
  // 3x3 row-major matrices
  const M = {
    id: () => [1, 0, 0, 0, 1, 0, 0, 0, 1],
    rx: a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; },
    ry: a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; },
    rz: a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; },
    mul: (A, B) => { const R = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return R; },
    ap: (A, v) => V(A[0] * v.x + A[1] * v.y + A[2] * v.z, A[3] * v.x + A[4] * v.y + A[5] * v.z, A[6] * v.x + A[7] * v.y + A[8] * v.z),
    // columns = images of local x, y, z axes
    cols: (X, Y, Z) => [X.x, Y.x, Z.x, X.y, Y.y, Z.y, X.z, Y.z, Z.z],
  };
  L._handMath = { V, add, sub, mul, dot, cross, norm, vlen, mix3, rotAxis, M };

  /* ------------------------------------------------------------ colour */
  const PAL = {
    her: { base: '#f3d3bf', shade: '#d9a38e', hi: '#fff1e6', line: '#6b3f33', blush: '#ef9a8a', nail: '#fbe4dc', nailLine: '#b07264', cast: '#c98f7b' },
    him: { base: '#efcab1', shade: '#d39b84', hi: '#fcebdd', line: '#5f392d', blush: '#e39383', nail: '#f7ddd0', nailLine: '#9e6758', cast: '#bf8670' },
  };
  function hexMix(a, b, t) { const A = PV.hex2rgb(a), B = PV.hex2rgb(b); const h = v => ('0' + Math.round(v).toString(16)).slice(-2); return '#' + h(lerp(A[0], B[0], t)) + h(lerp(A[1], B[1], t)) + h(lerp(A[2], B[2], t)); }
  L._hexMix = L._hexMix || hexMix;

  /* ------------------------------------------------------------ model */
  // Right hand, "back" frame: +x toward the little finger, -y toward the fingertips,
  // +z out of the back of the hand.  ~1 unit = 1px at scale 1.
  const MODELS = {};
  function model(kind) {
    if (MODELS[kind]) return MODELS[kind];
    const her = kind !== 'him';
    const k = her ? 1 : 1.07, kw = her ? 1 : 1.1;
    // finger shafts are slimmer than the knuckles they grow from (anime stylisation: long, slender pianist's
    // fingers for her; bony, slightly thinner-than-knuckle fingers for him) and taper to a narrower tip.
    const slim = her ? 0.85 : 0.9, tipK = 0.84;
    const F = (x, y, len, rad, splay) => ({ mcp: V(x * kw, y * k, 0), len: len.map(v => v * k), rad: rad.map((v, i) => v * kw * slim * (i === 3 ? tipK : i === 2 ? 0.96 : 1)), r0: rad[0] * kw, splay });
    const fingers = [
      F(-29.5, -89, [44, 26, 21.5], [9.0, 8.0, 7.1, 6.1], -0.075),   // index
      F(-9.5, -93, [49, 30, 23], [9.4, 8.4, 7.4, 6.4], -0.015),       // middle
      F(10.5, -90, [46, 28, 22], [8.9, 7.9, 7.0, 6.0], 0.045),        // ring
      F(28.5, -81, [36, 21.5, 20], [7.8, 6.9, 6.2, 5.3], 0.12),       // little
    ];
    const ts = her ? 0.88 : 0.93;
    const thumb = { cmc: V(-17 * kw, -16 * k, -6 * kw), len: [43 * k, 31 * k, 28.5 * k], rad: [11.8 * kw, 9.9 * kw * ts, 9.3 * kw * ts, 7.7 * kw * ts * 0.9] };
    const D = (x, y, z, r) => ({ p: V(x * kw, y * k, z * kw), r: r * kw });
    const palm = [
      D(-21, -52, -2, 14.5), D(0, -55, -3, 15.5), D(19, -50, -2, 14),   // mid palm
      D(19, -25, -6, 14), D(-5, -22, -5, 16),                            // hypothenar / carpus
      D(-12.5, 1, 0, 12), D(12.5, 1, 0, 12), D(0, 0, -9, 12.5),          // wrist
    ];
    for (const f of fingers) { palm.push({ p: f.mcp, r: f.r0 + 0.2 * kw }); palm.push({ p: add(f.mcp, V(0, 2.5, 3.2 * kw)), r: f.r0 * 0.9 }); }
    palm.push(D(-18, -29, -8, 14.5), D(-12, -12, -8, 13.5));   // thenar eminence: a convex mass at the thumb's root (appended: keeps indices)
    const arm = [ // two parallel tapered tubes -> flattened forearm section
      [D(-8.5, 3, -2, 15), D(-10.5, 120, -3, 20.5), D(-10, 330, -3, 21.5)],
      [D(8.5, 3, -2, 15), D(10.5, 120, -3, 20.5), D(10, 330, -3, 21.5)],
    ];
    // ulnar styloid sits INSIDE the wrist silhouette (a visible bump on the outline reads as a wart)
    MODELS[kind] = { kind, her, k, kw, fingers, thumb, palm, arm, styloid: D(19, 3, 3, 3.8), bulge: her ? 0.03 : 0.055 };
    return MODELS[kind];
  }

  /* ------------------------------------------------------------ pose */
  function makePose(o, m) {
    const curl = o.curl || [0.12, 0.12, 0.14, 0.16, 0.18];
    const spread = o.spread == null ? 0.3 : o.spread;
    const t = o.t || 0, trem = o.tremble || 0, seed = (o.seed || 0) * 13.7;
    const F = [];
    for (let i = 0; i < 4; i++) {
      const c = curl[i + 1] == null ? 0.15 : curl[i + 1];
      let fl;
      if (o.flex && o.flex[i + 1]) fl = o.flex[i + 1].slice();
      else fl = c >= 0 ? [0.05 + 1.3 * c, 0.09 + 1.72 * c, 0.05 + 1.1 * c] : [0.55 * c, 0.02 * c, 0.18 * c];
      if (trem) for (let j = 0; j < 3; j++) fl[j] += trem * 0.05 * PV.noise2(t * 5.3 + i * 7.1 + seed, j * 3.3);
      const spreadK = [-0.17, -0.03, 0.11, 0.27][i];
      const conv = [0.0, 0.06, 0.13, 0.22][i];
      let splay = m.fingers[i].splay * (1 - 0.6 * clamp(c, 0, 1)) + spreadK * spread - conv * clamp(fl[0] / 1.3, 0, 1);
      if (o.splay && o.splay[i + 1] != null) splay = o.splay[i + 1];
      if (trem) splay += trem * 0.02 * PV.noise2(t * 4.1 + i * 3.7 + seed, 9.1);
      F.push({ flex: fl, splay });
    }
    const c0 = curl[0] == null ? 0.15 : curl[0];
    const T = { abd: 0.46 + 0.42 * spread - 0.22 * c0, opp: 0.22 + 0.75 * c0, flex: [0.08 + 0.55 * c0, 0.1 + 0.95 * c0], twist: 0 };
    if (o.flex && o.flex[0]) T.flex = o.flex[0].slice();
    if (o.thumb) Object.assign(T, o.thumb);
    if (trem) { T.flex = T.flex.map((v, j) => v + trem * 0.05 * PV.noise2(t * 5 + seed, 20 + j)); }
    return { F, T };
  }

  function fingerChain(fm, fp) {
    const s = fp.splay;
    let f = V(Math.sin(s), -Math.cos(s), 0), d = V(0, 0, 1);
    const P = [fm.mcp], Fw = [], Dn = []; let p = fm.mcp;
    for (let j = 0; j < 3; j++) {
      const th = fp.flex[j], c = Math.cos(th), sn = Math.sin(th);
      const f2 = V(f.x * c - d.x * sn, f.y * c - d.y * sn, f.z * c - d.z * sn);
      const d2 = V(d.x * c + f.x * sn, d.y * c + f.y * sn, d.z * c + f.z * sn);
      f = f2; d = d2; p = add(p, mul(f, fm.len[j])); P.push(p); Fw.push(f); Dn.push(d);
    }
    return { P, F: Fw, D: Dn, rad: fm.rad, len: fm.len, flex: fp.flex };
  }
  function thumbChain(tm, tp) {
    const abd = tp.abd, opp = tp.opp;
    let f = norm(V(-Math.sin(abd) * Math.cos(opp), -Math.cos(abd), -Math.sin(abd) * Math.sin(opp) - 0.06));
    let d = norm(sub(V(0, 0, 1), mul(f, f.z)));
    d = rotAxis(d, f, 0.62 + 0.62 * opp + (tp.twist || 0));
    const P = [tm.cmc], Fw = [], Dn = []; let p = add(tm.cmc, mul(f, tm.len[0]));
    P.push(p); Fw.push(f); Dn.push(d);
    for (let j = 0; j < 2; j++) {
      const th = tp.flex[j], c = Math.cos(th), sn = Math.sin(th);
      const f2 = V(f.x * c - d.x * sn, f.y * c - d.y * sn, f.z * c - d.z * sn);
      const d2 = V(d.x * c + f.x * sn, d.y * c + f.y * sn, d.z * c + f.z * sn);
      f = f2; d = d2; p = add(p, mul(f, tm.len[j + 1])); P.push(p); Fw.push(f); Dn.push(d);
    }
    return { P, F: Fw, D: Dn, rad: tm.rad, len: tm.len, flex: [0].concat(tp.flex), thumb: true };
  }

  // Finger IK: flex/splay so that the tip of finger i (1..4) reaches `target` (right-hand local).
  function solveFinger(fm, target, opt) {
    opt = opt || {};
    const k3 = opt.dip == null ? 0.66 : opt.dip;
    const d = sub(target, fm.mcp);
    const splay = opt.splay != null ? opt.splay : clamp(Math.atan2(d.x, -d.y), -0.55, 0.55);   // opt.splay: fixed finger plane (e.g. a finger wrapping back around something)
    const f0 = V(Math.sin(splay), -Math.cos(splay), 0);
    const u = dot(d, f0), v = -d.z;
    const [L1, L2, L3] = fm.len;
    const fk = (a, b) => { const c = b * k3; return [L1 * Math.cos(a) + L2 * Math.cos(a + b) + L3 * Math.cos(a + b + c), L1 * Math.sin(a) + L2 * Math.sin(a + b) + L3 * Math.sin(a + b + c)]; };
    let a = opt.a0 == null ? 0.35 : opt.a0, b = opt.b0 == null ? 0.9 : opt.b0;
    const aMin = opt.aMin == null ? -0.35 : opt.aMin, aMax = opt.aMax == null ? 1.55 : opt.aMax;
    const bMin = opt.bMin == null ? 0 : opt.bMin, bMax = opt.bMax == null ? 1.95 : opt.bMax;
    for (let it = 0; it < 40; it++) {
      const [x, y] = fk(a, b); const ex = u - x, ey = v - y;
      if (ex * ex + ey * ey < 0.004) break;
      const e = 1e-3; const [xa, ya] = fk(a + e, b), [xb, yb] = fk(a, b + e);
      const j11 = (xa - x) / e, j21 = (ya - y) / e, j12 = (xb - x) / e, j22 = (yb - y) / e;
      const det = j11 * j22 - j12 * j21; if (Math.abs(det) < 1e-7) { b += 0.1; continue; }
      let da = (j22 * ex - j12 * ey) / det, db = (-j21 * ex + j11 * ey) / det;
      const mx = Math.max(Math.abs(da), Math.abs(db)); if (mx > 0.25) { da *= 0.25 / mx; db *= 0.25 / mx; }
      a = clamp(a + da, aMin, aMax); b = clamp(b + db, bMin, bMax);
    }
    return { flex: [a, b, b * k3], splay };
  }
  L._handSolveFinger = solveFinger;
  L._handModel = model;

  /* ------------------------------------------------------------ 2D geometry */
  function hull(pts) {
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  function area(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  const orient = pts => (area(pts) > 0 ? pts.slice().reverse() : pts);   // negative area = arcs' winding
  function inPoly(x, y, pts) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
    return c;
  }
  function distSeg(x, y, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
    return Math.hypot(x - ax - dx * t, y - ay - dy * t);
  }
  function capsulePath(c, ax, ay, ar, bx, by, br) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    if (d <= Math.abs(ar - br) + 0.05) { const big = ar > br; const x = big ? ax : bx, y = big ? ay : by, r = Math.max(ar, br); c.moveTo(x + r, y); c.arc(x, y, r, 0, -TAU, true); return; }
    const ux = dx / d, uy = dy / d, nx = -uy, ny = ux, k = (ar - br) / d, q = Math.sqrt(Math.max(0, 1 - k * k));
    const mx = k * ux + q * nx, my = k * uy + q * ny, m2x = k * ux - q * nx, m2y = k * uy - q * ny;
    const a1 = Math.atan2(my, mx), a2 = Math.atan2(m2y, m2x);
    c.moveTo(ax + ar * mx, ay + ar * my); c.lineTo(bx + br * mx, by + br * my);
    c.arc(bx, by, br, a1, a2, true); c.lineTo(ax + ar * m2x, ay + ar * m2y); c.arc(ax, ay, ar, a2, a1, true); c.closePath();
  }
  function smoothPoly(c, pts, dx, dy) {
    const n = pts.length; if (n < 3) return;
    const mx = i => (pts[i % n][0] + pts[(i + 1) % n][0]) / 2 + dx, my = i => (pts[i % n][1] + pts[(i + 1) % n][1]) / 2 + dy;
    c.moveTo(mx(n - 1), my(n - 1));
    for (let i = 0; i < n; i++) c.quadraticCurveTo(pts[i][0] + dx, pts[i][1] + dy, mx(i), my(i));
    c.closePath();
  }
  function addSub(c, sp, dx, dy) {
    if (sp.t === 'cap') capsulePath(c, sp.ax + dx, sp.ay + dy, sp.ar, sp.bx + dx, sp.by + dy, sp.br);
    else if (sp.t === 'disc') { c.moveTo(sp.x + dx + sp.r, sp.y + dy); c.arc(sp.x + dx, sp.y + dy, sp.r, 0, -TAU, true); }
    else if (sp.t === 'poly') { if (sp.smooth === false) { c.moveTo(sp.pts[0][0] + dx, sp.pts[0][1] + dy); for (let i = 1; i < sp.pts.length; i++) c.lineTo(sp.pts[i][0] + dx, sp.pts[i][1] + dy); c.closePath(); } else smoothPoly(c, sp.pts, dx, dy); }
  }
  // mode 0: plain, 1: per-sub lit shift, 2: uniform shift (dx,dy)
  function itemPath(c, it, mode, dx, dy) {
    c.beginPath();
    for (const sp of it.subs) addSub(c, sp, mode === 1 ? sp.lx : mode === 2 ? dx : 0, mode === 1 ? sp.ly : mode === 2 ? dy : 0);
  }
  function clipOut(c, discs, box) {
    if (!discs || !discs.length) return;
    c.beginPath(); c.rect(box[0] - 10, box[1] - 10, box[2] - box[0] + 20, box[3] - box[1] + 20);
    for (const d of discs) { c.moveTo(d[0] + d[2], d[1]); c.arc(d[0], d[1], d[2], 0, TAU); }
    c.clip('evenodd');
  }
  function polyline(c, pts) { c.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y); }
  function smoothLine(c, pts) {
    c.moveTo(pts[0].x, pts[0].y);
    if (pts.length < 3) { for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y); return; }
    for (let i = 1; i < pts.length - 1; i++) c.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    c.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }
  // tapered stroke (filled ribbon) through device points with width profile w(t)
  function taper(c, pts, w0, w1, wMid) {
    if (pts.length < 2) return;
    const n = pts.length, L1 = [], L2 = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const t = i / (n - 1); const w = (wMid == null ? lerp(w0, w1, t) : (t < 0.5 ? lerp(w0, wMid, t * 2) : lerp(wMid, w1, t * 2 - 1))) / 2;
      L1.push([pts[i].x - ty * w, pts[i].y + tx * w]); L2.push([pts[i].x + ty * w, pts[i].y - tx * w]);
    }
    c.beginPath(); c.moveTo(L1[0][0], L1[0][1]); for (let i = 1; i < n; i++) c.lineTo(L1[i][0], L1[i][1]);
    for (let i = n - 1; i >= 0; i--) c.lineTo(L2[i][0], L2[i][1]); c.closePath(); c.fill();
  }

  /* ------------------------------------------------------------ rig */
  L.handRig = function (o) {
    o = o || {};
    const side = o.side === 'L' ? 'L' : 'R';
    const kind = o.kind || (side === 'L' ? 'him' : 'her');
    const m = model(kind);
    const mirror = side === 'L' ? -1 : 1;
    const pose = o.pose || makePose(o, m);
    const view = o.view || 'back';
    const presetYaw = view === 'palm' ? Math.PI : view === 'side' ? mirror * Math.PI / 2 : view === 'edge' ? -mirror * Math.PI / 2 : 0;
    const Mv = o.camera || M.mul(M.rx(o.pitch || 0), M.ry(presetYaw + (o.yaw || 0)));
    const Mh = o.handMatrix || M.id(), Th = o.handPos || V(0, 0, 0);
    const Fz = o.focal || 1100;
    const sc = o.scale || 1, rot = o.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot), X0 = o.x || 0, Y0 = o.y || 0;
    const mt = o._m || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, ms = Math.sqrt(Math.abs(mt.a * mt.d - mt.b * mt.c)) || 1;
    const Pw = q0 => { // world -> device
      const q = M.ap(Mv, q0); const k = Fz === Infinity ? 1 : Fz / Math.max(Fz * 0.25, Fz - q.z);
      const lx = q.x * k, ly = q.y * k, sx = X0 + sc * (lx * cr - ly * sr), sy = Y0 + sc * (lx * sr + ly * cr);
      return { x: mt.a * sx + mt.c * sy + mt.e, y: mt.b * sx + mt.d * sy + mt.f, z: q.z, k: k * sc * ms };
    };
    const wmap = o.worldMap;
    const toWorld = wmap ? (p => wmap(add(M.ap(Mh, V(p.x * mirror, p.y, p.z)), Th))) : (p => add(M.ap(Mh, V(p.x * mirror, p.y, p.z)), Th));
    const P = p => Pw(toWorld(p));
    const N = n => M.ap(Mv, M.ap(Mh, V(n.x * mirror, n.y, n.z)));   // camera-space direction
    const rig = { o, m, side, kind, mirror, pose, P, Pw, N, toWorld, Mv, Mh, Th, view, scale: sc };
    rig.chains = [thumbChain(m.thumb, pose.T)];
    for (let i = 0; i < 4; i++) rig.chains.push(fingerChain(m.fingers[i], pose.F[i]));
    rig.chains.forEach((ch, i) => { ch.i = i; });
    // screen positions of tips / joints (handy for props)
    rig.tips = rig.chains.map(ch => P(ch.P[3]));
    rig.joints = rig.chains.map(ch => ch.P.map(P));
    rig.wrist = P(V(0, 0, 0));
    rig.unit = rig.wrist.k; // device px per local unit at the wrist
    return rig;
  };

  /* ------------------------------------------------------------ style */
  // multiply-tint a colour by a light colour (amount t): skin lit by amber spots, rainy blue, night...
  function tintMul(hex, light, t) {
    if (!light || !t) return hex;
    const A = PV.hex2rgb(hex), B = PV.hex2rgb(light), h = v => ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2);
    return '#' + h(lerp(A[0], A[0] * B[0] / 255, t)) + h(lerp(A[1], A[1] * B[1] / 255, t)) + h(lerp(A[2], A[2] * B[2] / 255, t));
  }
  L._handTint = tintMul;
  function styleFor(rig) {
    const o = rig.o, pal = PAL[rig.kind === 'him' ? 'him' : 'her'];
    const style = o.style || 'cel';
    const ang = o.light == null ? -2.3 : o.light;
    const S = { style, L: { x: Math.cos(ang), y: Math.sin(ang) } };
    const handPx = 195 * rig.unit;
    // style guide: a thin warm line, 1.2–2px at 1080p.  lw = visible width on the lit side; the shadow side
    // gets ~1.7x.  Details (wrinkles, creases, scars) use their own width dw.
    S.lw = o.lw || clamp(0.95 + handPx / 700, 1.1, 2.1);
    S.dw = clamp(0.55 + handPx / 430, 0.85, 2.7);
    S.u = rig.unit;
    if (style === 'cel') {
      S.base = o.skin || pal.base; S.shade = o.shade || pal.shade; S.hi = o.hi || pal.hi; S.line = o.line || pal.line;
      S.blush = o.blush || pal.blush; S.nail = o.nail || pal.nail; S.nailLine = o.nailLine || pal.nailLine; S.cast = o.castColor || pal.cast;
      S.castAlpha = o.castAlpha == null ? 0.55 : o.castAlpha; S.shadeAmt = o.shadeAmt == null ? 1 : o.shadeAmt; S.detail = o.detail == null ? 1 : o.detail;
      // scene light: keyColor tints the lit colours, fillColor the shadow side and the line (tint = amount)
      const ta = o.tint == null ? 0.7 : o.tint;
      // (the shadow keeps some of the key light and only leans toward the fill colour, so the cel step stays a
      // gentle 1-shadow and never turns into a dark halo)
      if (o.keyColor) { S.base = tintMul(S.base, o.keyColor, ta); S.hi = tintMul(S.hi, o.keyColor, ta * 0.5); S.nail = tintMul(S.nail, o.keyColor, ta); S.blush = tintMul(S.blush, o.keyColor, ta * 0.6); S.shade = tintMul(S.shade, o.keyColor, ta * 0.55); }
      if (o.fillColor) { S.shade = tintMul(S.shade, o.fillColor, ta * 0.5); S.line = tintMul(S.line, o.fillColor, ta * 0.4); S.nailLine = tintMul(S.nailLine, o.fillColor, ta * 0.4); S.cast = tintMul(S.cast, o.fillColor, ta * 0.6); }
    } else if (style === 'rim') {
      S.base = o.dark || '#3e2c33'; S.shade = S.base; S.line = o.rimLine || 'rgba(36,18,22,0.9)'; S.rim = o.rimColor || '#fff1d6'; S.sss = o.sss || '#ff7a4a';
      S.rimW = (o.rimWidth || 1) * clamp(1.6 + handPx / 200, 2.2, 8.5); S.bounce = o.bounce || '#6f5a78'; S.detail = o.detail == null ? 0.15 : o.detail;
      S.blush = o.sss || '#ff7f52'; S.hi = S.rim; S.nail = hexMix(S.base, '#ffffff', 0.08); S.nailLine = S.line; S.castAlpha = 0; S.shadeAmt = 0;
    } else {
      S.base = o.color || '#0d0f18'; S.shade = S.base; S.line = S.base; S.rim = o.rimColor || '#fff1d6'; S.rimW = o.rimWidth ? o.rimWidth * clamp(1 + handPx / 300, 1.2, 4) : 0; S.detail = 0; S.castAlpha = 0;
    }
    return S;
  }

  /* ------------------------------------------------------------ items */
  function lateralShift(ax, ay, bx, by, Lv, amt) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    if (d < 1e-3) return [Lv.x * amt, Lv.y * amt];
    const ux = dx / d, uy = dy / d, along = Lv.x * ux + Lv.y * uy;
    return [(Lv.x - ux * along) * amt, (Lv.y - uy * along) * amt];
  }
  function bboxOf(subs) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const ext = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
    for (const s of subs) { if (s.t === 'cap') { ext(s.ax, s.ay, s.ar); ext(s.bx, s.by, s.br); } else if (s.t === 'disc') ext(s.x, s.y, s.r); else for (const p of s.pts) ext(p[0], p[1], 0); }
    return [x0, y0, x1, y1];
  }

  function buildItems(rig) {
    if (rig.items) return rig.items;
    const S = rig.S = styleFor(rig), o = rig.o, m = rig.m, P = rig.P, Lv = S.L;
    const shadeK = S.style === 'cel' ? S.shadeAmt : 0;
    // ---- segments
    const segs = [];
    rig.chains.forEach(ch => {
      ch.segs = [];
      for (let j = 0; j < 3; j++) {
        const a3 = ch.P[j], b3 = j === 2 ? sub(ch.P[3], mul(ch.F[2], ch.rad[3])) : ch.P[j + 1];
        const A = P(a3), B = P(b3);
        const s = { chain: ch.i, j, a3, b3, A, B, ar: ch.rad[j] * A.k, br: ch.rad[j + 1] * B.k, z: (A.z + B.z) / 2, f: ch.F[j], d: ch.D[j], ch };
        const amt = 0.62 * (s.ar + s.br) / 2 * shadeK;
        [s.lx, s.ly] = lateralShift(A.x, A.y, B.x, B.y, Lv, amt);
        ch.segs.push(s); segs.push(s);
      }
    });
    rig.segs = segs;
    const bul = 1 + m.bulge;
    const capSub = (s) => ({ t: 'cap', ax: s.A.x, ay: s.A.y, ar: s.ar, bx: s.B.x, by: s.B.y, br: s.br, lx: s.lx, ly: s.ly });
    const fingerSubs = (ch, from, to, endJoint) => {
      to = to == null ? 3 : to;
      const subs = [];
      for (let j = from; j < to; j++) subs.push(capSub(ch.segs[j]));
      const jEnd = Math.min(2, endJoint ? to : to - 1);
      for (let j = Math.max(1, from); j <= jEnd; j++) {
        // joints: the bulge sits on the DORSAL side (knuckle), the sides of the finger stay smooth.  The disc
        // takes the lit-shift of the neighbouring phalanges so the cel shadow band runs on without a blob.
        const dn = norm(add(ch.D[j - 1], ch.D[j])), sA = ch.segs[j - 1], sB = ch.segs[j];
        const J = P(add(ch.P[j], mul(dn, ch.rad[j] * 0.08))); const r = ch.rad[j] * (1 + rig.m.bulge * 0.35) * J.k;
        subs.push({ t: 'disc', x: J.x, y: J.y, r, lx: (sA.lx + sB.lx) / 2, ly: (sA.ly + sB.ly) / 2 });
        const fl = ch.flex[j] || 0;
        if (fl > 0.5) { // a firmly bent knuckle shows a slightly squared dorsal corner (side views)
          const k2 = clamp((fl - 0.5) / 0.9, 0, 1);
          const Kp = P(add(ch.P[j], mul(dn, ch.rad[j] * 0.16 * k2))); const rk = ch.rad[j] * 0.86 * Kp.k;
          subs.push({ t: 'disc', x: Kp.x, y: Kp.y, r: rk, lx: (sA.lx + sB.lx) / 2, ly: (sA.ly + sB.ly) / 2 });
        }
      }
      if (to === 3) { // fleshy pad on the palm side of the tip; the nail side stays flatter
        const pad = P(sub(sub(ch.P[3], mul(ch.F[2], ch.rad[3] * 1.12)), mul(ch.D[2], ch.rad[3] * 0.22)));
        const rp = ch.rad[3] * 0.98 * pad.k, s2 = ch.segs[2]; subs.push({ t: 'disc', x: pad.x, y: pad.y, r: rp, lx: s2.lx * 0.8, ly: s2.ly * 0.8 });
      }
      return subs;
    };
    // ---- palm hull
    const pdiscs = m.palm.map(d => { const q = P(d.p); return { x: q.x, y: q.y, r: d.r * q.k, z: q.z }; });
    const hp = [];
    for (const d of pdiscs) for (let i = 0; i < 30; i++) { const a = i / 30 * TAU; hp.push([d.x + Math.cos(a) * d.r, d.y + Math.sin(a) * d.r]); }
    const H = orient(hull(hp));
    rig.hull = H;
    const palmZ = pdiscs.reduce((s, d) => s + d.z, 0) / pdiscs.length;
    const pw = Math.hypot(pdiscs[8].x - pdiscs[14].x, pdiscs[8].y - pdiscs[14].y) || 60 * rig.unit;
    const palmSh = 0.11 * pw * shadeK;
    const palmSubs = [{ t: 'poly', pts: H, lx: Lv.x * palmSh, ly: Lv.y * palmSh }];
    // thumb metacarpal (part of the palm mass)
    const th = rig.chains[0];
    palmSubs.push(capSub(th.segs[0]));
    // web between thumb and index
    {
      const idx = m.fingers[0];
      const A3 = mix3(th.P[0], th.P[1], 0.92), B3 = add(mix3(idx.mcp, V(idx.mcp.x + 6, -30, -2), 0.36), V(-2, 0, -3));
      const C3 = mix3(mix3(A3, B3, 0.5), mix3(th.P[0], V(-6, -40, -4), 0.5), 0.32);
      const base3 = V(-6, -36, -4);
      const pts = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8; const q = add(add(mul(A3, (1 - t) * (1 - t)), mul(C3, 2 * t * (1 - t))), mul(B3, t * t)); const p = P(q); pts.push([p.x, p.y]); }
      const b = P(base3), c0 = P(th.P[0]); pts.push([b.x, b.y]); pts.push([c0.x, c0.y]);
      palmSubs.push({ t: 'poly', pts: orient(pts), lx: Lv.x * palmSh * 0.6, ly: Lv.y * palmSh * 0.6 });
    }
    // forearm
    const armLen = o.arm == null ? 320 : o.arm;
    const sleeveAt = o.sleeveAt || 70, hasSleeve = !!o.sleeve && armLen > sleeveAt;
    // camera looking INTO the cuff (elbow farther than the wrist): the bare arm must stop at the cuff
    rig.sleeveInto = hasSleeve && rig.N(V(0, 1, 0)).z < -0.12;
    const armEnd = rig.sleeveInto ? Math.min(armLen, sleeveAt + 6) : armLen;
    if (armEnd > 0) {
      const ends = [];
      for (const tube of m.arm) {
        let last = null;
        for (let j = 0; j < tube.length - 1; j++) {
          const a = tube[j], b0 = tube[j + 1]; if (a.p.y >= armEnd) break;
          const t = clamp((armEnd - a.p.y) / (b0.p.y - a.p.y), 0, 1); const bp = mix3(a.p, b0.p, t), br = lerp(a.r, b0.r, t);
          const A = P(a.p), B = P(bp); const s = { ax: A.x, ay: A.y, ar: a.r * A.k, bx: B.x, by: B.y, br: br * B.k };
          const [lx, ly] = lateralShift(A.x, A.y, B.x, B.y, Lv, 0.55 * (s.ar + s.br) / 2 * shadeK);
          palmSubs.push(Object.assign({ t: 'cap', lx, ly, arm: true }, s));
          last = { p: bp, r: br, lx, ly };
        }
        if (last) ends.push(last);
      }
      // close the two tube ends with one capsule: a single rounded end instead of a "double bump"
      if (ends.length === 2 && !hasSleeve) { const A = P(ends[0].p), B = P(ends[1].p); palmSubs.push({ t: 'cap', ax: A.x, ay: A.y, ar: ends[0].r * A.k, bx: B.x, by: B.y, br: ends[1].r * B.k, lx: ends[0].lx, ly: ends[0].ly, arm: true }); }
      const st = P(m.styloid.p); palmSubs.push({ t: 'disc', x: st.x, y: st.y, r: m.styloid.r * st.k, lx: Lv.x * 2 * shadeK, ly: Lv.y * 2 * shadeK });
    }
    // ---- decide which fingers merge into the palm group (G0)
    const items = [];
    const palmItem = { rig, S, kind: 'palm', subs: palmSubs, segs: [], excl: [], depth: palmZ, cast: 0 };
    const layer = o.layer || {};
    for (let i = 0; i < 5; i++) {
      const ch = rig.chains[i], from = i === 0 ? 1 : 0;
      let mode = layer[i] || o.layerAll;
      const fz = ch.segs.slice(from).reduce((s, q) => s + q.z, 0) / (3 - from);
      if (!mode) {
        let inside = 0;
        const test = i === 0 ? [ch.segs[2]] : [ch.segs[1], ch.segs[2]];
        for (const s of test) { if (inPoly((s.A.x + s.B.x) / 2, (s.A.y + s.B.y) / 2, H)) inside++; if (inPoly(s.B.x, s.B.y, H)) inside++; }
        mode = inside === 0 ? 'g0' : (fz > palmZ ? 'front' : 'back');
      }
      ch.layer = mode;
      const sj = o.split && o.split[i];
      if (sj && sj > from && sj < 3) {
        const root = ch.segs[from], J3 = ch.P[sj], Jp = P(J3), rj = ch.rad[sj] * Jp.k;
        const zA = ch.segs.slice(from, sj).reduce((a, q) => a + q.z, 0) / (sj - from), zB = ch.segs.slice(sj).reduce((a, q) => a + q.z, 0) / (3 - sj);
        const A = { rig, S, kind: i === 0 ? 'thumb' : 'finger', fi: i, part: 'A', subs: fingerSubs(ch, from, sj, true), segs: ch.segs.slice(from, sj), excl: [[root.A.x, root.A.y, root.ar * 1.32]], depth: zA, cast: 0, rootFill: [root.A.x, root.A.y, root.ar] };
        const B = { rig, S, kind: i === 0 ? 'thumb' : 'finger', fi: i, part: 'B', subs: fingerSubs(ch, sj, 3), segs: ch.segs.slice(sj), excl: [[Jp.x, Jp.y, rj * 1.08]], depth: zB, cast: 0 };
        if (S.style === 'cel') B.cast = 2.5 * rig.unit;
        items.push(A, B);
        continue;
      }
      if (mode === 'g0') {
        palmItem.subs.push(...fingerSubs(ch, from)); palmItem.segs.push(...ch.segs.slice(from));
      } else {
        const root = ch.segs[from]; const rr = (root.ar) * 1.32;
        const it = { rig, S, kind: i === 0 ? 'thumb' : 'finger', fi: i, subs: fingerSubs(ch, from), segs: ch.segs.slice(from), excl: [[root.A.x, root.A.y, rr]], depth: mode === 'front' ? Math.max(fz, palmZ + 0.5) : Math.min(fz, palmZ - 0.5) };
        it.rootFill = [root.A.x, root.A.y, root.ar];
        it.cast = mode === 'front' && S.style === 'cel' ? clamp((fz - palmZ) * 0.12, 1.5, 7) * rig.unit : 0;
        if (o.zBias && o.zBias[i]) it.depth += o.zBias[i];
        items.push(it);
      }
    }
    if (o.zBias && o.zBias.palm) palmItem.depth += o.zBias.palm;
    items.push(palmItem); rig.palmItem = palmItem;
    if (hasSleeve) items.push(...sleeveItem(rig, S, palmZ, armLen));
    for (const it of items) { it.bb = bboxOf(it.subs); it.rigId = rig; }
    if (o.depthFn) for (const it of items) { const d = o.depthFn(it, rig); if (d != null) it.depth = d; }
    // details
    attachDetails(rig, palmItem, pdiscs);
    rig.items = items; rig.palmItem = palmItem; rig.palmZ = palmZ;
    return items;
  }

  // fabric sleeve over the forearm from y = o.sleeveAt (cuff) to the arm end. o.sleeve = base colour.
  function sleeveItem(rig, S, palmZ, armLen) {
    const o = rig.o, P = rig.P, kw = rig.m.kw, Lv = S.L, cel = S.style === 'cel';
    const y0 = o.sleeveAt || 70, y1 = armLen + 40, rx = (o.sleeveW || 31) * kw, rz = (o.sleeveD || 23) * kw;
    const seed = (o.seed || 0) * 3.7 + (rig.side === 'L' ? 11 : 0);
    // the cuff is a little loose and the sleeve widens toward the elbow (no "drainpipe")
    const ring = (y, sx, sz, n, wob) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; const w = 1 + (wob || 0) * PV.noise2(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3 + y * 0.02); pts.push(P(V(Math.cos(a) * sx * w, y, Math.sin(a) * sz * w - 3))); } return pts; };
    const near = ring(y0, rx, rz, 28, 0.03), far = ring(y1, rx * 1.24, rz * 1.2, 28, 0.04);
    const mids = []; for (let k = 1; k <= 5; k++) { const yy = lerp(y0, y1, k / 6); mids.push(...ring(yy, rx * (1.03 + 0.2 * k / 6) * (1 + 0.04 * PV.noise2(k * 1.7, seed)), rz * (1.03 + 0.16 * k / 6), 28, 0.05)); }
    const H2 = orient(hull(near.concat(far, mids).map(q => [q.x, q.y])));
    const pw = Math.hypot(near[0].x - near[14].x, near[0].y - near[14].y), sh = 0.16 * pw * (cel ? S.shadeAmt : 0);
    const subs = [{ t: 'poly', pts: H2, lx: Lv.x * sh, ly: Lv.y * sh }];
    const into = !!rig.sleeveInto;
    const base = cel ? o.sleeve : S.base;
    const col = { base, shade: cel ? hexMix(o.sleeve, '#262838', 0.38) : S.base, line: cel ? hexMix(o.sleeve, '#120d14', 0.7) : S.line, hi: hexMix(base, '#ffffff', 0.35) };
    const inside = cel ? hexMix(o.sleeve, '#0b0810', 0.72) : S.line;
    // looking into the cuff: sleeve BEHIND the hand, dark opening, and a front lip drawn over the arm
    const it = { rig, S, kind: 'sleeve', subs, segs: [], excl: [], depth: into ? palmZ - 0.02 : palmZ + 0.02, cast: 0, col };
    const inner = into ? ring(y0 + 1, rx - 3.4 * kw, rz - 3.4 * kw, 32) : null;
    it.palmDetails = (c) => {
      if (inner) { c.save(); c.beginPath(); smoothPoly(c, inner.map(q => [q.x, q.y]), 0, 0); c.fillStyle = inside; c.fill(); c.restore(); }
      if (!cel) return;
      // cuff seam
      const seam = []; for (let i = 0; i <= 28; i++) { const a = i / 28 * TAU; const n3 = V(Math.cos(a), 0, Math.sin(a)); const q = P(V(Math.cos(a) * rx * 1.005, y0 + 11, Math.sin(a) * rz * 1.005 - 3)); q.f = rig.N(n3).z; seam.push(q); }
      strokeFaced(c, seam, S.dw * 0.7, col.line, 0.55, 0.1);
      // soft folds: short diagonal strokes on the visible side
      const folds = [[y0 + 26, 0.7, 0.5, 9], [y0 + 44, 0.55, -0.6, -8], [y0 + 70, 0.65, 0.15, 10], [y0 + 98, 0.5, -0.3, -9], [y0 + 128, 0.45, 0.7, 8]];
      for (const [yy, span, ph, sk] of folds) {
        const wk = 1 + 0.2 * (yy - y0) / Math.max(1, y1 - y0);
        const pts = [];
        for (let i = 0; i <= 8; i++) { const u = -1 + 2 * i / 8; const a = ph + u * span; const n3 = V(Math.cos(a), 0, Math.sin(a)); const q = P(V(Math.cos(a) * rx * 1.02 * wk, yy + u * sk, Math.sin(a) * rz * 1.02 * wk - 3)); q.f = rig.N(n3).z; pts.push(q); }
        strokeFaced(c, pts, S.dw * 0.85, col.line, 0.4, 0.2);
      }
    };
    it.bb = bboxOf(subs);
    if (!into) return [it];
    // front lip: the near half of the cuff's rim (outer ring -> inner ring), over the arm going in
    const n = 48, outer = [], inn = [], fac = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU; outer.push(P(V(Math.cos(a) * rx, y0, Math.sin(a) * rz - 3))); inn.push(P(V(Math.cos(a) * (rx - 3.4 * kw), y0 + 1, Math.sin(a) * (rz - 3.4 * kw) - 3))); fac.push(rig.N(V(Math.cos(a), 0, Math.sin(a))).z); }
    let st = 0; while (st < n && fac[st] > -0.02) st++;
    const run = []; for (let k = 1; k <= n; k++) { const i = (st + k) % n; if (fac[i] > -0.02) run.push(i); else if (run.length) break; }
    if (run.length < 3) return [it];
    const band = run.map(i => [outer[i].x, outer[i].y]).concat(run.slice().reverse().map(i => [inn[i].x, inn[i].y]));
    const lip = { rig, S, kind: 'sleeve', subs: [{ t: 'poly', pts: orient(band), smooth: false, lx: Lv.x * 1.5, ly: Lv.y * 1.5 }], segs: [], excl: [], depth: palmZ + 0.03, cast: 0, col };
    // inside the opening, the arm fades into the sleeve's shadow
    const nearP = outer[run[Math.floor(run.length / 2)]], farI = (run[Math.floor(run.length / 2)] + n / 2) % n, farP = inn[farI];
    lip.overlay = (c) => {
      c.beginPath(); smoothPoly(c, inner.map(q => [q.x, q.y]), 0, 0); c.clip();
      const g = c.createLinearGradient(nearP.x, nearP.y, farP.x, farP.y);
      g.addColorStop(0, PV.rgba(inside, 0.15)); g.addColorStop(0.35, PV.rgba(inside, 0.75)); g.addColorStop(1, PV.rgba(inside, 0.95));
      c.fillStyle = g; c.fillRect(Math.min(nearP.x, farP.x) - 400, Math.min(nearP.y, farP.y) - 400, Math.abs(nearP.x - farP.x) + 800, Math.abs(nearP.y - farP.y) + 800);
    };
    lip.bb = bboxOf(lip.subs);
    return [it, lip];
  }

  /* ------------------------------------------------------------ details */
  // project a 3D surface curve; returns device points with facing (camera z of normal)
  function surfCurve(rig, pts3, normals3) { return pts3.map((p, i) => { const q = rig.P(p); q.f = rig.N(normals3[i] || normals3[0]).z; return q; }); }
  function strokeFaced(c, pts, w, col, alpha, f0) {
    // draw a polyline segment by segment, alpha by facing
    f0 = f0 == null ? 0.05 : f0;
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]; const f = Math.min(a.f, b.f); if (f < f0) continue;
      c.globalAlpha = alpha * smooth(f0, f0 + 0.25, f);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    c.globalAlpha = 1;
  }
  // surface point on a finger segment: s along (0..1), phi around (0 = dorsal), radius scale
  function segSurf(ch, j, s, phi, rs) {
    const a = ch.P[j], f = ch.F[j], d = ch.D[j], side = norm(cross(f, d));
    const r = lerp(ch.rad[j], ch.rad[j + 1], s) * (rs || 1);
    const c = add(a, mul(f, s * ch.len[j]));
    const n = add(mul(d, Math.cos(phi)), mul(side, Math.sin(phi)));
    return { p: add(c, mul(n, r)), n };
  }

  function attachDetails(rig, palmItem, pdiscs) {
    const S = rig.S, o = rig.o, P = rig.P, N = rig.N, lw = S.dw;
    if (S.style === 'silhouette') return;
    const det = S.detail;
    const isHim = rig.kind === 'him';
    const calluses = o.calluses == null ? (isHim && rig.side === 'L') : o.calluses;
    const thumbScar = o.thumbScar == null ? false : o.thumbScar;
    const surg = o.surgicalScars == null ? false : o.surgicalScars;
    const cel = S.style === 'cel';
    const lineA = cel ? 1 : 0.5;

    rig.chains.forEach(ch => {
      const fromJ = ch.thumb ? 1 : 0;
      for (const s of ch.segs) {
        if (s.j < fromJ) continue;
        const j = s.j;
        s.details = (c) => {
          if (cel && j === 2) { const q = rig.P(sub(sub(ch.P[3], mul(ch.F[2], ch.rad[3] * 1.4)), mul(ch.D[2], ch.rad[3] * 0.45))); blushAt(c, q, ch.rad[3] * 1.9 * q.k, S.blush, 0.22); }
          if (cel && j === 1 && !ch.thumb) { const q = rig.P(ch.P[1]); blushAt(c, q, ch.rad[1] * 1.4 * q.k, S.blush, 0.07); }
          // highlight streak on the lit side (cel)
          if (cel && det > 0.3) {
            const [lx, ly] = [s.lx, s.ly]; const ll = Math.hypot(lx, ly);
            if (ll > 0.35 * s.ar * 0.62) {
              const nx = lx / ll, ny = ly / ll; const off = 0.5;
              const p0 = { x: lerp(s.A.x, s.B.x, 0.22) + nx * s.ar * off, y: lerp(s.A.y, s.B.y, 0.22) + ny * s.ar * off };
              const p1 = { x: lerp(s.A.x, s.B.x, 0.78) + nx * s.br * off, y: lerp(s.A.y, s.B.y, 0.78) + ny * s.br * off };
              c.fillStyle = PV.rgba(S.hi, 0.85 * det); taper(c, [p0, { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }, p1], 0.2, 0.2, lw * 0.9);
            }
          }
          // dorsal wrinkles at PIP (j==1 start) / DIP (j==2 start)
          if (j >= 1 && det > 0.2) wrinkles(c, rig, ch, j, S);
          // palmar creases
          if (det > 0.2) creases(c, rig, ch, j, S);
          if (j === 2) {
            if (calluses && !ch.thumb) callus(c, rig, ch, S);
            nail(c, rig, ch, S);
          }
          if (ch.thumb && thumbScar && j === 1) scarThumb(c, rig, ch, S);
          if (surg && !ch.thumb && (ch.i === 1 || ch.i === 2) && j === 0) scarFinger(c, rig, ch, S);
        };
      }
    });
    // palm details
    palmItem.palmDetails = (c) => {
      if (det < 0.2 && !surg) return;   // backlit: knuckle lines / creases are lost in the dark skin
      const dorsal = N(V(0, 0, 1)).z;
      if (dorsal > 0.15) knuckles(c, rig, S, dorsal);
      if (dorsal < -0.15) palmCreases(c, rig, S, -dorsal);
      if (surg) scarsPalm(c, rig, S);
    };
    // soft colour (blush/AO) inside the palm group
    palmItem.soft = (c) => softPalm(c, rig, S, pdiscs);
  }

  function nail(c, rig, ch, S) {
    // Backlit / silhouette: the nail is not readable against the light -> not drawn.
    if (S.style !== 'cel') return;
    const d = ch.D[2], facing = rig.N(d).z; if (facing < 0.12) return;
    const her = rig.kind === 'her';
    // short nails (she is self-conscious about them): the plate stops well before the tip, no white free edge
    const W = ch.thumb ? 0.84 : 0.76, s0 = ch.thumb ? 0.36 : 0.4, s1 = her ? 0.82 : 0.86;
    const pts = [];
    for (let i = 0; i <= 8; i++) { const u = -1 + 2 * i / 8; pts.push(rig.P(segSurf(ch, 2, s0 + 0.09 * u * u, u * W, 1.015).p)); }
    for (let i = 0; i <= 8; i++) { const u = 1 - 2 * i / 8; pts.push(rig.P(segSurf(ch, 2, s1 - 0.035 * u * u, u * W * 0.96, 1.015).p)); }
    const a = smooth(0.12, 0.5, facing);
    const plate = hexMix(S.base, S.nail, 0.55), bed = hexMix(S.base, S.blush, 0.22);
    c.globalAlpha = a;
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y); c.closePath();
    c.fillStyle = bed; c.fill();
    c.save(); c.clip();
    // lit half of the plate is paler, a narrow soft highlight along it
    const pL = rig.P(segSurf(ch, 2, 0.6, -0.45, 1).p), pR = rig.P(segSurf(ch, 2, 0.6, 0.45, 1).p);
    const sgn = ((pL.x - pR.x) * S.L.x + (pL.y - pR.y) * S.L.y) > 0 ? -1 : 1;
    const half = []; for (let i = 0; i <= 6; i++) { const u = i / 6; half.push(rig.P(segSurf(ch, 2, lerp(s0, s1, u), sgn * W * 1.2, 1.02).p)); }
    for (let i = 6; i >= 0; i--) { const u = i / 6; half.push(rig.P(segSurf(ch, 2, lerp(s0, s1, u), -sgn * 0.12, 1.02).p)); }
    c.beginPath(); c.moveTo(half[0].x, half[0].y); for (const q of half) c.lineTo(q.x, q.y); c.closePath(); c.fillStyle = plate; c.fill();
    const h0 = rig.P(segSurf(ch, 2, s0 + 0.12, sgn * 0.42, 1.03).p), h1 = rig.P(segSurf(ch, 2, s1 - 0.12, sgn * 0.42, 1.03).p);
    c.fillStyle = PV.rgba('#ffffff', 0.55); taper(c, [h0, { x: (h0.x + h1.x) / 2, y: (h0.y + h1.y) / 2 }, h1], 0.2, 0.2, S.dw * 0.75);
    c.restore();
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y); c.closePath();
    c.globalAlpha = a * 0.75; c.strokeStyle = S.nailLine; c.lineWidth = S.dw * 0.42; c.lineJoin = 'round'; c.stroke();
    c.globalAlpha = 1;
  }

  function wrinkles(c, rig, ch, j, S) {
    // joint j (1=PIP, 2=DIP) lies at the start of segment j
    const fa = ch.F[j - 1], fb = ch.F[j];
    const flex = Math.acos(clamp(dot(fa, fb), -1, 1));
    const d = norm(add(ch.D[j - 1], ch.D[j])), f = norm(add(fa, fb)), side = norm(cross(f, d));
    const facing = rig.N(d).z; if (facing < 0.2) return;
    const J = ch.P[j], r = ch.rad[j] * 1.04;
    const k = 1 - clamp(flex / 1.1, 0, 1);
    const n = j === 1 ? 3 : 2;
    c.strokeStyle = S.line; c.lineCap = 'round';
    for (let w = 0; w < n; w++) {
      const off = (w - (n - 1) / 2) * r * 0.32;
      const span = (w === Math.floor(n / 2) ? 0.62 : 0.42) * (j === 1 ? 1 : 0.8);
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const u = -1 + 2 * i / 6, phi = u * span;
        const nn = add(mul(d, Math.cos(phi)), mul(side, Math.sin(phi)));
        pts.push(rig.P(add(add(J, mul(f, off - r * 0.12 * u * u)), mul(nn, r))));
      }
      c.globalAlpha = (rig.kind === 'him' ? 0.5 : 0.36) * k * smooth(0.2, 0.55, facing) * S.detail;
      c.fillStyle = S.line; taper(c, pts, 0.15, 0.15, S.dw * 0.62);
    }
    // knuckle highlight when bent
    if (S.style === 'cel' && flex > 0.45) {
      const q = rig.P(add(J, mul(d, r * 1.02)));
      c.globalAlpha = 0.32 * smooth(0.45, 1.1, flex) * facing;
      const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * q.k * 0.7); g.addColorStop(0, PV.rgba(S.hi, 1)); g.addColorStop(1, PV.rgba(S.hi, 0));
      c.fillStyle = g; c.fillRect(q.x - r * q.k, q.y - r * q.k, r * q.k * 2, r * q.k * 2);
    }
    c.globalAlpha = 1;
  }

  function creases(c, rig, ch, j, S) {
    const pd = mul(ch.D[j], -1), facing = rig.N(pd).z; if (facing < 0.15) return;
    const list = j === 0 ? (ch.thumb ? [] : [[0.3, 0.55], [0.36, 0.45]]) : j === 1 ? (ch.thumb ? [[0.06, 0.6], [0.12, 0.45]] : [[0.02, 0.6], [0.09, 0.5]]) : (ch.thumb ? [[0.04, 0.55]] : [[0.0, 0.55]]);
    for (const [s, span] of list) {
      const pts = [];
      for (let i = 0; i <= 6; i++) { const u = -1 + 2 * i / 6; const q = segSurf(ch, j, s + 0.02 * u * u, Math.PI + u * span * 1.3, 1.01); pts.push(rig.P(q.p)); }
      c.globalAlpha = 0.42 * smooth(0.15, 0.5, facing) * S.detail; c.fillStyle = S.line; taper(c, pts, 0.15, 0.15, S.dw * 0.6);
    }
    c.globalAlpha = 1;
  }

  function callus(c, rig, ch, S) {
    // 弦のタコ: hardened, slightly flattened fingertip pad -- a paler, matte, faintly yellow oval with a light-brown
    // rim on its proximal side and two fine string grooves across it (style guide: 薄い茶色の線).
    const pd = mul(ch.D[2], -1), facing = rig.N(pd).z; if (facing < 0.05) return;
    const a = smooth(0.05, 0.45, facing) * (S.style === 'cel' ? 1 : 0.25);
    const ring = []; for (let i = 0; i < 16; i++) { const th = i / 16 * TAU; ring.push(rig.P(segSurf(ch, 2, 0.7 + 0.2 * Math.cos(th), Math.PI + 0.72 * Math.sin(th), 1.01).p)); }
    c.globalAlpha = 0.78 * a; c.fillStyle = hexMix(S.base, '#f2dcae', 0.62);
    c.beginPath(); c.moveTo(ring[0].x, ring[0].y); for (const q of ring) c.lineTo(q.x, q.y); c.closePath(); c.fill();
    c.globalAlpha = 0.3 * a; c.strokeStyle = '#b8875f'; c.lineWidth = S.dw * 0.45; c.stroke();
    const cen = rig.P(segSurf(ch, 2, 0.72, Math.PI, 1.0).p), r = ch.rad[2] * 0.9 * cen.k;
    const g = c.createRadialGradient(cen.x, cen.y, 0, cen.x, cen.y, r);
    g.addColorStop(0, PV.rgba('#fff3dc', 0.55 * a)); g.addColorStop(1, PV.rgba('#fff3dc', 0));
    c.globalAlpha = 1; c.fillStyle = g; c.fillRect(cen.x - r, cen.y - r, r * 2, r * 2);
    // light-brown edge of the thickened skin (proximal arc) + fine string grooves
    const arc = []; for (let i = 0; i <= 8; i++) { const u = -1 + 2 * i / 8; arc.push(rig.P(segSurf(ch, 2, 0.5 + 0.1 * u * u, Math.PI + u * 0.78, 1.012).p)); }
    c.globalAlpha = 0.85 * a; c.fillStyle = '#b07e57'; taper(c, arc, 0.1, 0.1, S.dw * 0.8);
    [[0.66, -0.05, 0.6], [0.8, 0.04, 0.52]].forEach(([s0, sk, span], gi) => {
      const pts = []; for (let i = 0; i <= 6; i++) { const u = -1 + 2 * i / 6; pts.push(rig.P(segSurf(ch, 2, s0 + sk * u, Math.PI + u * span + 0.08 * gi, 1.015).p)); }
      c.globalAlpha = 0.75 * a; c.fillStyle = '#a3714b'; taper(c, pts, 0.1, 0.1, S.dw * 0.62);
    });
    c.globalAlpha = 1;
  }

  function scarLine(c, rig, pts3, nrm3, S, opt) {
    // A HEALED surgical scar (months later): a slightly raised, shiny pale line in a soft pink halo, with a few
    // faint suture dots on alternating sides -- not a stitched "ladder".
    opt = opt || {};
    const pts = surfCurve(rig, pts3, nrm3);
    const w = S.dw * (opt.w || 1.5) * 0.85;
    const a = S.style === 'cel' ? (opt.alpha == null ? 1 : opt.alpha) : 0.1;
    const seed = Math.round((pts3[0].x * 7 + pts3[0].y * 13) * 10);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const pass = (col, alpha, wk) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i], B = pts[i + 1]; const f = Math.min(A.f, B.f); if (f < 0.05) continue;
        const k = 0.8 + 0.3 * PV.noise2(i * 0.9, seed * 0.01);
        c.globalAlpha = alpha * a * smooth(0.05, 0.35, f); c.strokeStyle = col; c.lineWidth = w * wk * k;
        c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
      }
    };
    pass(opt.halo || '#e09c93', 0.32, 3.0);
    pass(opt.edge || '#cc857d', 0.58, 1.5);
    pass(opt.core || '#fbece6', 0.85, 0.62);
    c.globalAlpha = 1;
    if (opt.ticks === false) return;
    let acc = 0, n = 0; const step = (opt.step || 7) * 1.45 * rig.unit;
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1]; const seg = Math.hypot(B.x - A.x, B.y - A.y); if (seg < 1e-3) continue;
      const ux = (B.x - A.x) / seg, uy = (B.y - A.y) / seg;
      while (acc < seg) {
        const tt = acc / seg; const x = lerp(A.x, B.x, tt), y = lerp(A.y, B.y, tt), f = lerp(A.f, B.f, tt);
        if (f > 0.12 && PV.rand1(n, seed + 7) < 0.75) {
          const side = n % 2 ? 1 : -1, off = (opt.tick || 3.6) * 0.62 * rig.unit, len = (opt.tick || 3.6) * 0.38 * rig.unit * (0.7 + 0.5 * PV.rand1(n, seed));
          const nx = -uy * side, ny = ux * side;
          c.globalAlpha = (0.16 + 0.14 * PV.rand1(n, seed + 2)) * a * smooth(0.12, 0.4, f); c.strokeStyle = opt.tickCol || '#c98078'; c.lineWidth = S.dw * 0.5;
          c.beginPath(); c.moveTo(x + nx * off, y + ny * off); c.lineTo(x + nx * (off + len), y + ny * (off + len)); c.stroke();
        }
        acc += step * (0.8 + 0.4 * PV.rand1(n, seed + 3)); n++;
      }
      acc -= seg;
    }
    c.globalAlpha = 1;
  }
  function scarsPalm(c, rig, S) {
    const D = V(0, 0, 1), Pn = V(0, 0, -1);
    const line = (a, b, n, z, bow, steps) => { const pts = [], ns = []; for (let i = 0; i <= steps; i++) { const t = i / steps; const p = mix3(a, b, t); p.x += Math.sin(t * Math.PI) * bow; p.z = z; pts.push(p); ns.push(n); } return [pts, ns]; };
    const armLen = rig.o.arm == null ? 320 : rig.o.arm;
    const k = rig.m.k;
    // dorsal: back of hand toward index/middle valley, wrist transverse, forearm long scars
    let [p, n] = line(V(-2, -6, 0), V(-19, -80, 0), D, 12.5, 4, 10); scarLine(c, rig, p, n, S);
    [p, n] = line(V(-19, 8, 0), V(18, 6, 0), D, 13.5, -3, 8); scarLine(c, rig, p, n, S, { w: 1.3 });
    if (armLen > 60) { [p, n] = line(V(-5, 24, 0), V(3, Math.min(armLen, 300), 0), D, 18, 6, 16); scarLine(c, rig, p, n, S, { w: 1.7 }); }
    if (armLen > 140) { [p, n] = line(V(14, 90, 0), V(17, Math.min(armLen, 260), 0), D, 16, -3, 10); scarLine(c, rig, p, n, S, { w: 1.2, step: 8 }); }
    // palmar: wrist, palm (carpal), forearm
    [p, n] = line(V(-17, 6, 0), V(16, 4, 0), Pn, -18, 2, 8); scarLine(c, rig, p, n, S, { w: 1.3 });
    [p, n] = line(V(6, -8, 0), V(12, -58, 0), Pn, -18, -3, 8); scarLine(c, rig, p, n, S, { w: 1.2 });
    if (armLen > 60) { [p, n] = line(V(2, 30, 0), V(-4, Math.min(armLen, 280), 0), Pn, -20, -5, 16); scarLine(c, rig, p, n, S, { w: 1.6 }); }
    void k;
  }
  function scarFinger(c, rig, ch, S) {
    const pts = [], ns = [];
    for (let i = 0; i <= 6; i++) { const t = 0.08 + 0.8 * i / 6; const q = segSurf(ch, 0, t, 0.25 * Math.sin(t * 3), 1.02); pts.push(q.p); ns.push(q.n); }
    scarLine(c, rig, pts, ns, S, { w: 1.1, step: 6, tick: 3.2 });
  }
  function scarThumb(c, rig, ch, S) {
    // short oblique scar across the base of the thumb (proximal phalanx root / MCP), wraps radial side
    const pts = [], ns = [];
    for (let i = 0; i <= 10; i++) { const u = i / 10; const q = segSurf(ch, 1, 0.06 + 0.2 * u, Math.PI - 1.15 + 2.6 * u, 1.03); pts.push(q.p); ns.push(q.n); }
    scarLine(c, rig, pts, ns, S, { w: 1.7, step: 5.5, tick: 3.4, core: '#f9e6df', edge: '#c9827a', halo: '#dc968c' });
  }

  function knuckles(c, rig, S, dorsal) {
    const det = S.detail;
    // knuckle bumps: short arcs + highlight, stronger when MCP is flexed; extensor tendons faint
    for (let i = 1; i <= 4; i++) {
      const ch = rig.chains[i], fl = ch.flex[0];
      const r = ch.rad[0], d = ch.D[0], f = ch.F[0], side = norm(cross(f, d));
      const top = add(ch.P[0], mul(V(0, 0, 1), r * 1.05));
      const k = smooth(0.15, 0.9, fl);
      const pts = [];
      for (let q = 0; q <= 6; q++) { const u = -1 + 2 * q / 6; pts.push(rig.P(add(add(top, mul(side, u * r * 0.62)), mul(V(0, -1, 0), (1 - u * u) * r * 0.3 - r * 0.25)))); }
      c.globalAlpha = (0.18 + 0.4 * k) * dorsal * det; c.fillStyle = S.line; taper(c, pts, 0.1, 0.1, S.dw * 0.6);
      if (S.style === 'cel') {
        const h = rig.P(add(top, V(0, -r * 0.1, 0)));
        const g = c.createRadialGradient(h.x, h.y, 0, h.x, h.y, r * h.k * 0.9); g.addColorStop(0, PV.rgba(S.hi, 0.42 * (0.3 + 0.7 * k) * dorsal)); g.addColorStop(1, PV.rgba(S.hi, 0));
        c.globalAlpha = 1; c.fillStyle = g; c.fillRect(h.x - r * h.k, h.y - r * h.k, r * h.k * 2, r * h.k * 2);
      }
      // tendon toward the wrist
      const t0 = add(ch.P[0], V(0, 12, 6)), t1 = V(lerp(ch.P[0].x, 0, 0.75), -10, 8);
      const tp = []; for (let q = 0; q <= 4; q++) tp.push(rig.P(mix3(t0, t1, q / 4)));
      c.globalAlpha = (rig.kind === 'him' ? 0.2 : 0.05) * dorsal * det * (1 - 0.6 * k); c.fillStyle = S.line; taper(c, tp, S.dw * 0.5, 0.1);
    }
    // thumb metacarpal edge line (back of hand)
    const th = rig.chains[0];
    const e0 = mix3(th.P[1], th.P[0], 0.15), e1 = mix3(th.P[1], th.P[0], 0.75);
    const side = norm(cross(th.F[0], V(0, 0, 1)));
    const ep = [rig.P(add(e0, mul(side, -th.rad[1] * 0.2))), rig.P(add(mix3(e0, e1, 0.5), mul(side, -th.rad[1] * 0.35))), rig.P(add(e1, mul(side, -th.rad[1] * 0.2)))];
    c.globalAlpha = 0.28 * dorsal * det; c.fillStyle = S.line; taper(c, ep, S.dw * 0.7, 0.1);
    c.globalAlpha = 1;
  }

  function palmCreases(c, rig, S, facing) {
    const z = -16.5 * rig.m.kw, k = rig.m.k, kw = rig.m.kw;
    const curves = [
      [[35, -63], [18, -67], [2, -73], [-12, -79]],          // heart line
      [[-34, -54], [-16, -58], [2, -59], [17, -54]],          // head line
      [[-31, -52], [-24, -34], [-17, -16], [-8, -3]],         // life line (thenar crease)
      [[4, -10], [6, -30], [8, -50]],                         // fate line (faint)
    ];
    const alphas = [0.5, 0.45, 0.5, 0.18];
    curves.forEach((cv, i) => {
      const pts = cv.map(([x, y]) => rig.P(V(x * kw, y * k, z)));
      c.globalAlpha = alphas[i] * smooth(0.15, 0.5, facing) * S.detail; c.fillStyle = S.line;
      taper(c, pts, S.dw * 0.25, S.dw * 0.15, S.dw * 0.8);
    });
    // wrist creases
    for (const yy of [2, 7]) {
      const pts = [-14, -5, 5, 14].map(x => rig.P(V(x * kw, yy * k + Math.abs(x) * 0.08, -19 * kw)));
      c.globalAlpha = 0.3 * smooth(0.15, 0.5, facing) * S.detail; taper(c, pts, 0.2, 0.2, S.dw * 0.6);
    }
    c.globalAlpha = 1;
  }

  function softPalm(c, rig, S, pdiscs) {
    if (S.style !== 'cel') return;
    const dorsal = rig.N(V(0, 0, 1)).z;
    // palm-side warmth
    const cpt = rig.P(V(0, -45, dorsal < 0 ? -14 : 10)); const R = 70 * cpt.k;
    const g = c.createRadialGradient(cpt.x, cpt.y, 0, cpt.x, cpt.y, R);
    g.addColorStop(0, PV.rgba(S.blush, dorsal < 0 ? 0.2 : 0.06)); g.addColorStop(1, PV.rgba(S.blush, 0));
    c.fillStyle = g; c.fillRect(cpt.x - R, cpt.y - R, R * 2, R * 2);
    void pdiscs;
  }
  function blushAt(c, q, r, col, a) {
    const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); g.addColorStop(0, PV.rgba(col, a)); g.addColorStop(1, PV.rgba(col, 0));
    c.fillStyle = g; c.fillRect(q.x - r, q.y - r, r * 2, r * 2);
  }

  /* ------------------------------------------------------------ drawing */
  function overlaps(s, o) {
    // s is drawn in front of o.  Same finger, front segment more PROXIMAL than the one behind it (finger bending
    // away from the camera): the knuckle surface is continuous, so there is no contour unless folded right back.
    if (s.ch === o.ch && s.j < o.j - 1) { let fl = 0; for (let j = s.j + 1; j <= o.j; j++) fl += s.ch.flex[j] || 0; if (fl < 2.1) return false; }
    const shared = s.chain === o.chain && s.ch === o.ch && Math.abs(s.j - o.j) === 1;
    const J = shared ? (s.j > o.j ? s.A : s.B) : null;
    const rs = (s.ar + s.br) / 2;
    if (J) { // adjacent phalanges: only a real fold (both pointing the same way from the joint) needs a line
      const Se = s.j > o.j ? s.B : s.A, Oe = s.j > o.j ? o.A : o.B;
      const ax = Se.x - J.x, ay = Se.y - J.y, bx = Oe.x - J.x, by = Oe.y - J.y, la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < rs * 0.9 || lb < rs * 0.9) return false;
      if ((ax * bx + ay * by) / (la * lb) < Math.cos(1.25)) return false;
    }
    for (let t = 0; t <= 1.0001; t += 0.2) {
      const x = lerp(s.A.x, s.B.x, t), y = lerp(s.A.y, s.B.y, t);
      if (J && Math.hypot(x - J.x, y - J.y) < rs * 1.6) continue;
      if (distSeg(x, y, o.A.x, o.A.y, o.B.x, o.B.y) < (o.ar + o.br) / 2 + lerp(s.ar, s.br, t) * (J ? 0.45 : 0.85)) return true;
    }
    return false;
  }
  function segCap(c, s, dx, dy) { capsulePath(c, s.A.x + (dx || 0), s.A.y + (dy || 0), s.ar, s.B.x + (dx || 0), s.B.y + (dy || 0), s.br); }

  // item outline cached as Path2D (mode 0: plain, 1: per-sub lit shift); shifted copies are drawn with
  // translate() instead of re-issuing every arc/curve from JS (the main cost of the two-hand cuts)
  function pathOf(it, mode) {
    const key = mode === 1 ? '_p1' : '_p0'; if (it[key]) return it[key];
    const p = new Path2D(); for (const sp of it.subs) addSub(p, sp, mode === 1 ? sp.lx : 0, mode === 1 ? sp.ly : 0);
    return (it[key] = p);
  }
  function fillAt(c, path, dx, dy, style) { c.save(); c.translate(dx, dy); if (style) c.fillStyle = style; c.fill(path); c.restore(); }
  function strokeAt(c, path, dx, dy) { c.save(); c.translate(dx, dy); c.stroke(path); c.restore(); }

  function drawItem(c, it, box) {
    const S = it.col ? Object.assign({}, it.S, it.col) : it.S, lw = S.lw;
    const style = S.style, P0 = pathOf(it, 0), Lx = S.L.x, Ly = S.L.y;
    if (it.overlay) { c.save(); it.overlay(c); c.restore(); }
    // ---- cast shadow onto what is already drawn
    if (it.cast > 0 && S.castAlpha > 0) {
      c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = S.castAlpha;
      clipOut(c, it.excl, box);
      fillAt(c, P0, -Lx * it.cast, -Ly * it.cast, S.cast);
      c.restore();
    }
    // ---- outline
    c.save(); clipOut(c, it.excl, box);
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = S.line; c.lineWidth = lw * 2;
    if (style === 'rim') {
      // 色トレス: the line is eaten by the light on the lit side -- one stroke pushed away from the light: it
      // falls inside the silhouette (covered by the rim fill) on the lit side and thickens on the shadow side
      strokeAt(c, P0, -Lx * lw * 1.25, -Ly * lw * 1.25);
    } else {
      c.stroke(P0);
      if (style === 'cel') strokeAt(c, P0, -Lx * lw * 0.75, -Ly * lw * 0.75);
    }
    c.restore();
    // ---- fill
    if (style === 'cel') {
      c.fillStyle = S.shade; c.fill(P0);
      c.save(); c.clip(P0);
      c.fillStyle = S.base; c.fill(pathOf(it, 1));
      if (it.rootFill) { const r = it.rootFill; c.beginPath(); c.arc(r[0], r[1], r[2] * 1.02, 0, TAU); c.fill(); }
      if (it.soft) it.soft(c);
      c.restore();
    } else if (style === 'rim') {
      const rw = S.rimW;
      c.save(); c.clip(P0);
      // bright rim at the edge -> warm translucent (SSS) band -> dark skin
      c.fillStyle = S.rim; c.fill(P0);
      fillAt(c, P0, -Lx * rw * 1.15, -Ly * rw * 1.15, S.rimSss || (S.rimSss = hexMix(S.sss, S.rim, 0.25)));
      fillAt(c, P0, -Lx * rw * 2.6, -Ly * rw * 2.6, S.rimDeep || (S.rimDeep = hexMix(S.base, S.sss, 0.34)));
      fillAt(c, P0, -Lx * rw * 3.9, -Ly * rw * 3.9, S.base);
      if (it.rootFill) { const r = it.rootFill; c.fillStyle = S.base; c.beginPath(); c.arc(r[0], r[1], r[2] * 1.05, 0, TAU); c.fill(); }
      // faint bounce light from the room side (opposite the window) so the dark skin is not flat
      const bb = it.bb; const g = c.createLinearGradient(bb[0] - Lx * 200, bb[1] - Ly * 200, bb[0] + Lx * 200, bb[1] + Ly * 200);
      g.addColorStop(0, PV.rgba(S.bounce, 0.35)); g.addColorStop(1, PV.rgba(S.bounce, 0));
      c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.8; c.save(); c.translate(-Lx * rw * 3.9, -Ly * rw * 3.9); c.fillStyle = g; c.translate(0, 0); c.fill(P0); c.restore(); c.globalAlpha = 1;
      c.restore();
    } else {
      c.fillStyle = S.base; c.fill(P0);
      if (S.rimW > 0) { c.save(); c.clip(P0); c.fillStyle = S.rim; c.fill(P0); fillAt(c, P0, -Lx * S.rimW, -Ly * S.rimW, S.base); c.restore(); }
    }
    if (style === 'silhouette') return;
    // ---- palm details first, then segments back to front with fold lines (one clip per item)
    c.save(); c.clip(P0);
    if (it.palmDetails) { c.save(); it.palmDetails(c); c.restore(); }
    const segs = it.segs.slice().sort((p, q) => p.z - q.z);
    for (let k = 0; k < segs.length; k++) {
      const s = segs[k];
      const over = [];
      for (let j = 0; j < k; j++) if (overlaps(s, segs[j])) over.push(segs[j]);
      if (over.length) {
        c.save();
        c.beginPath(); for (const q of over) segCap(c, q); c.clip();
        const joints = []; for (const q of over) if (q.ch === s.ch && Math.abs(q.j - s.j) === 1) { const J = s.j > q.j ? s.A : s.B; joints.push([J.x, J.y, Math.max(s.ar, s.br) * 1.25]); }
        clipOut(c, joints, box);
        c.beginPath(); segCap(c, s); c.save(); c.clip();
        if (style === 'cel') { c.fillStyle = S.shade; c.fill(); c.beginPath(); segCap(c, s, s.lx, s.ly); c.fillStyle = S.base; c.fill(); }
        else { c.fillStyle = S.base; c.fill(); }
        c.restore();
        c.beginPath(); segCap(c, s); c.strokeStyle = S.line; c.lineWidth = lw * 1.25; c.lineJoin = 'round'; c.stroke();
        c.restore();
      }
      if (s.details) { c.save(); s.details(c); c.restore(); }
    }
    c.restore();
  }

  /* ------------------------------------------------------------ render */
  L.handRender = function (ctx, rigs, ro) {
    ro = ro || {};
    let items = [];
    for (const rig of rigs) for (const it of buildItems(rig)) if (!ro.filter || ro.filter(it)) items.push(it);
    if (!items.length) return;
    items.sort((a, b) => a.depth - b.depth);
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const it of items) { x0 = Math.min(x0, it.bb[0]); y0 = Math.min(y0, it.bb[1]); x1 = Math.max(x1, it.bb[2]); y1 = Math.max(y1, it.bb[3]); }
    const pad = 16 + (ro.pad || 0);
    x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(cw, Math.ceil(x1 + pad)); y1 = Math.min(ch, Math.ceil(y1 + pad));
    if (x1 <= x0 || y1 <= y0) return;
    const box = [x0, y0, x1, y1], bw = x1 - x0, bh = y1 - y0;
    const buf = PV.buffer('hands:main:' + cw + 'x' + ch, cw, ch), c = buf.ctx;
    c.clearRect(x0, y0, bw, bh);
    const castDone = new Set();
    for (const it of items) {
      const rig = it.rig;
      if (rig.o.dropShadow && !castDone.has(rig)) { castDone.add(rig); dropShadow(c, rig, box); }
      if (ro.before) ro.before(c, it);
      drawItem(c, it, box);
      if (ro.after) ro.after(c, it);
    }
    const a0 = ctx.globalAlpha, aa = a0 * (ro.alpha == null ? 1 : ro.alpha);
    blurBlit(ctx, buf.canvas, x0, y0, bw, bh, ro.blur || 0, { alpha: aa });
    // rim glow (bright rim pixels only, blurred at low resolution)
    const glow = rigs.some(r => r.S && (r.S.style === 'rim' || (r.S.style === 'silhouette' && r.S.rimW > 0)));
    if (glow && ro.glow !== 0) {
      const gpx = Math.max(3, (rigs[0].S.rimW || 3) * 2.2), g = ro.glow == null ? 0.85 : ro.glow;
      blurBlit(ctx, buf.canvas, x0, y0, bw, bh, gpx, { alpha: a0 * g, op: 'screen', pre: 'contrast(5) brightness(0.85)' });
      blurBlit(ctx, buf.canvas, x0, y0, bw, bh, gpx * 3, { alpha: a0 * 0.5 * g, op: 'screen', pre: 'contrast(5) brightness(0.8)' });
    }
  };
  // soft drop shadow of a whole rig (silhouette) offset by o.dropShadow = {dx,dy,blur,alpha,color}
  function dropShadow(c, rig, box) {
    const ds = rig.o.dropShadow, cw = c.canvas.width, ch = c.canvas.height;
    const T = PV.buffer('hands:shadow:' + cw + 'x' + ch, cw, ch), tc = T.ctx;
    tc.clearRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    tc.fillStyle = ds.color || '#a8705e';
    for (const it of rig.items) tc.fill(pathOf(it, 0));
    blurBlit(c, T.canvas, box[0], box[1], box[2] - box[0], box[3] - box[1], ds.blur || 0, { dx: ds.dx || 0, dy: ds.dy || 0, alpha: ds.alpha == null ? 0.35 : ds.alpha, op: 'source-atop' });
  }

  function matOf(ctx) { const t = ctx.getTransform(); return { a: t.a, b: t.b, c: t.c, d: t.d, e: t.e, f: t.f }; }
  L._handMatOf = matOf;
  // cheap soft blit: blur a region of `src` at reduced resolution and draw it (device space) into dst
  function blurBlit(dst, src, x0, y0, w, h, blur, o) {
    o = o || {};
    const dx = o.dx || 0, dy = o.dy || 0;
    dst.save(); dst.setTransform(1, 0, 0, 1, 0, 0);
    if (o.alpha != null) dst.globalAlpha = o.alpha; if (o.op) dst.globalCompositeOperation = o.op;
    if (blur <= 2.5) { const fl = ((o.pre || '') + (blur > 0 ? ` blur(${blur}px)` : '')).trim(); if (fl) { dst.beginPath(); dst.rect(x0 + dx - 8, y0 + dy - 8, w + 16, h + 16); dst.clip(); dst.filter = fl; } dst.drawImage(src, x0, y0, w, h, x0 + dx, y0 + dy, w, h); dst.restore(); return; }
    const f = clamp(2.2 / blur, 0.1, 0.5), padD = Math.ceil(blur * 2.6);
    const X0 = x0 - padD, Y0 = y0 - padD, Wd = w + padD * 2, Hd = h + padD * 2;
    const sw = Math.ceil(Wd * f), sh = Math.ceil(Hd * f);
    const B = PV.buffer('hands:blur', Math.max(64, Math.ceil(1920 * 0.55)), Math.max(64, Math.ceil(1200 * 0.55)));
    if (sw > B.canvas.width || sh > B.canvas.height) { dst.filter = (o.pre || '') + ` blur(${blur}px)`; dst.drawImage(src, x0, y0, w, h, x0 + dx, y0 + dy, w, h); dst.restore(); return; }
    const c = B.ctx; c.clearRect(0, 0, sw + 2, sh + 2);
    c.save(); c.beginPath(); c.rect(0, 0, sw, sh); c.clip();      // bounds the filter layer (big win in software raster)
    c.filter = (o.pre || '') + ` blur(${(blur * f).toFixed(2)}px)`;
    c.drawImage(src, x0, y0, w, h, padD * f, padD * f, w * f, h * f);
    c.restore();
    dst.drawImage(B.canvas, 0, 0, sw, sh, X0 + dx, Y0 + dy, sw / f, sh / f);
    dst.restore();
  }
  L._handBlurBlit = blurBlit;

  /* ------------------------------------------------------------ scene helpers */
  // camera looking at the origin from azimuth az (0 = from +Z, + = from +X) and elevation el (+ = from above)
  function lookCam(az, el, roll) {
    const zc = V(Math.cos(el) * Math.sin(az), -Math.sin(el), Math.cos(el) * Math.cos(az));
    const D = V(0, 1, 0); const yc = norm(sub(D, mul(zc, dot(D, zc)))); const xc = cross(yc, zc);
    let Mv = [xc.x, xc.y, xc.z, yc.x, yc.y, yc.z, zc.x, zc.y, zc.z];
    if (roll) Mv = M.mul(M.rz(roll), Mv);
    return Mv;
  }
  L._handLookCam = lookCam;
  const transpose = A => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
  // world -> right-hand local (inverse of rig.toWorld without worldMap)
  function toLocal(Mh, Th, mirror, q) { const v = M.ap(transpose(Mh), sub(q, Th)); return V(v.x * mirror, v.y, v.z); }
  // thumb IK by coordinate descent on {abd, opp, flex[0], flex[1]} (+ regularisation toward a natural pose)
  function solveThumb(tm, target, init) {
    const p = init ? [init.abd, init.opp, init.flex[0], init.flex[1]] : [0.5, 0.5, 0.3, 0.3];
    const nat = p.slice(); const lo = [-0.1, -0.2, -0.2, -0.3], hi = [1.4, 1.6, 1.2, 1.5];
    const cost = q => { const ch = thumbChain(tm, { abd: q[0], opp: q[1], flex: [q[2], q[3]], twist: 0 }); const e = sub(ch.P[3], target); let r = 0; for (let i = 0; i < 4; i++) r += (q[i] - nat[i]) ** 2; return dot(e, e) + 6 * r; };
    let best = cost(p), step = 0.2;
    for (let it = 0; it < 60 && step > 0.002; it++) {
      let improved = false;
      for (let i = 0; i < 4; i++) for (const sgn of [1, -1]) {
        const q = p.slice(); q[i] = clamp(q[i] + sgn * step, lo[i], hi[i]); const c = cost(q);
        if (c < best) { best = c; p[i] = q[i]; improved = true; }
      }
      if (!improved) step *= 0.5;
    }
    return { abd: p[0], opp: p[1], flex: [p[2], p[3]], twist: 0 };
  }
  L._handSolveThumb = solveThumb;
  function fillPoly(c, pts, col) { c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y); c.closePath(); if (col) { c.fillStyle = col; c.fill(); } }
  function faceVis(Mv, n) { return M.ap(Mv, n).z; }

  /* ------------------------------------------------------------ piano keys (shared camera) */
  const KEY = { w: 25.5, l: 163, bw: 14.6, bl: 100, bh: 12.5, fh: 15, travel: 10.5 };
  L.handKeyGeom = KEY;
  // key-press envelope for a finger whose strike time is u = 0 (seconds-ish units): lift -> strike -> hold -> release.
  // returns -0.6..1 for o.press[i] of handOnKeys.  e.g. press[i] = L.handPressCurve(t * tempo - i * gap)
  L.handPressCurve = u => -0.6 * smooth(-0.5, -0.18, u) * (1 - smooth(-0.14, -0.02, u)) + smooth(-0.06, 0.04, u) * (1 - smooth(0.7, 0.95, u));
  const isBlackAfter = w => [0, 1, 3, 4, 5].indexOf(((w % 7) + 7) % 7) >= 0;   // white index 0 = C
  // draw a keyboard in the camera of `Pw`. o: kMin,kMax (white indices), x0 (world X of white key 0 left edge),
  // pressW{w:depth}, pressB{w:depth} (black key after white w), Mv (camera), tone
  function drawKeys(c, Pw, Mv, o) {
    const K = KEY, x0 = o.x0, kMin = o.kMin, kMax = o.kMax, pw = o.pressW || {}, pb = o.pressB || {};
    const T = Object.assign({ top: '#f7f3ec', top2: '#e9e2d6', front: '#d6cdbf', side: '#bfb4a4', gap: '#231d1a', btop: '#2e2c34', bbody: '#141318', bside: '#1d1b22', bhi: '#8a8796', edge: '#ffffff' }, o.tone || {});
    const P = (x, y, z) => Pw(V(x, y, z));
    // key bed
    fillPoly(c, [P(x0 + kMin * K.w - 4, 3, 1), P(x0 + (kMax + 1) * K.w + 4, 3, 1), P(x0 + (kMax + 1) * K.w + 4, 3, -K.l - 14), P(x0 + kMin * K.w - 4, 3, -K.l - 14)], T.gap);
    // white keys: pressed first
    const order = []; for (let w = kMin; w <= kMax; w++) order.push(w);
    order.sort((a, b) => (pw[b] || 0) - (pw[a] || 0));
    const topVis = faceVis(Mv, V(0, -1, 0)) > 0, frontVis = faceVis(Mv, V(0, 0, 1)) > 0;
    for (const w of order) {
      const xl = x0 + w * K.w + 0.55, xr = x0 + (w + 1) * K.w - 0.55, dy = (pw[w] || 0) * K.travel, dyb = dy * 0.45;
      if (dy > 0.2) { // neighbours' exposed side walls
        for (const [xs, nx] of [[xl - 1.1, 1], [xr + 1.1, -1]]) if (faceVis(Mv, V(nx, 0, 0)) > 0) fillPoly(c, [P(xs, 0, 0), P(xs, 0, -K.l), P(xs, dyb, -K.l), P(xs, dy, 0)], T.side);
      }
      if (topVis) {
        const q = [P(xl, dy, 0), P(xr, dy, 0), P(xr, dyb, -K.l), P(xl, dyb, -K.l)];
        const g = c.createLinearGradient(q[0].x, q[0].y, q[3].x, q[3].y); g.addColorStop(0, T.top); g.addColorStop(1, T.top2);
        fillPoly(c, q, g);
        if (dy > 0.2) { c.globalAlpha = 0.18 * (pw[w] || 0); fillPoly(c, q, '#6b5a4c'); c.globalAlpha = 1; }
      }
      if (frontVis) {
        const f = [P(xl, dy, 0), P(xr, dy, 0), P(xr, dy + K.fh, 0), P(xl, dy + K.fh, 0)]; fillPoly(c, f, T.front);
        c.strokeStyle = PV.rgba(T.edge, 0.85); c.lineWidth = Math.max(1, 1.1 * f[0].k); c.beginPath(); c.moveTo(f[0].x, f[0].y); c.lineTo(f[1].x, f[1].y); c.stroke();
      }
    }
    // black keys, far to near
    const blacks = []; for (let w = kMin - 1; w <= kMax; w++) if (isBlackAfter(w)) blacks.push(w);
    const cz = w => M.ap(Mv, V(x0 + (w + 1) * K.w, 0, -K.l + K.bl / 2)).z; blacks.sort((a, b) => cz(a) - cz(b));
    for (const w of blacks) {
      const cx = x0 + (w + 1) * K.w + [-2.2, 2.2, 0, -2.6, 0, 2.6, 0][((w % 7) + 7) % 7];
      const dy = (pb[w] || 0) * K.travel * 0.9, h = -K.bh + dy, zb = -K.l - 1, zf = -K.l + K.bl;
      const xl = cx - K.bw / 2, xr = cx + K.bw / 2, tl = xl + 1.6, tr = xr - 1.6, zt = zf - 4;
      const faces = [
        { n: V(0, 0, 1), pts: [P(tl, h, zt), P(tr, h, zt), P(xr, 2, zf), P(xl, 2, zf)], col: T.bbody },
        { n: V(-1, 0, 0), pts: [P(xl, 2, zb), P(xl, 2, zf), P(tl, h, zt), P(tl, h, zb)], col: T.bside },
        { n: V(1, 0, 0), pts: [P(xr, 2, zb), P(xr, 2, zf), P(tr, h, zt), P(tr, h, zb)], col: T.bside },
      ];
      for (const f of faces) if (faceVis(Mv, f.n) > 0) fillPoly(c, f.pts, f.col);
      const tp = [P(tl, h, zt), P(tr, h, zt), P(tr, h, zb), P(tl, h, zb)];
      const g = c.createLinearGradient(tp[0].x, tp[0].y, tp[3].x, tp[3].y); g.addColorStop(0, T.btop); g.addColorStop(0.5, T.bbody); g.addColorStop(1, T.btop);
      fillPoly(c, tp, g);
      // glossy highlight line along the front-top edge and a long soft sheen
      c.strokeStyle = PV.rgba(T.bhi, 0.9); c.lineWidth = Math.max(1, 0.9 * tp[0].k); c.beginPath(); c.moveTo(tp[0].x, tp[0].y); c.lineTo(tp[1].x, tp[1].y); c.stroke();
      const s0 = P(tl + 2.5, h, zt - 6), s1 = P(tl + 2.5, h, zb + 10);
      c.strokeStyle = PV.rgba(T.bhi, 0.35); c.lineWidth = Math.max(1, 1.6 * s0.k); c.beginPath(); c.moveTo(s0.x, s0.y); c.lineTo(s1.x, s1.y); c.stroke();
    }
  }
  L.handKeys = function (ctx, o) { // standalone keyboard in a hand camera (o.az, o.el, x, y, scale...)
    const Mv = o.camera || lookCam(o.az == null ? -0.7 : o.az, o.el == null ? 0.62 : o.el, o.roll || 0);
    const rig = L.handRig({ camera: Mv, x: o.x, y: o.y, scale: o.scale, focal: o.focal || 900, _m: matOf(ctx) });
    drawKeys(ctx, q => rig.Pw(sub(q, o.lookAt || V(0, -20, 10))), Mv, o);
  };

  /* ------------------------------------------------------------ handOnKeys */
  // Right (or left) hand playing: 3/4 view from above. o.press[5] (thumb..little): -1 lifted .. 0 resting .. 1 key down.
  // o.keys[5]: white-key offsets (relative to the middle finger's key) or {b:offset} for the black key right of it.
  L.handOnKeys = function (ctx, o) {
    o = Object.assign({}, o || {});
    const side = o.side === 'L' ? 'L' : 'R', mirror = side === 'L' ? -1 : 1, kind = o.kind || (side === 'L' && o.him ? 'him' : 'her');
    const m = model(kind);
    // default camera: in front of the keyboard, to the player's right and above -- the hand, the pressed key and
    // the hand's reflection in the black fallboard all read at once (az -2.35 = from the music-stand side)
    const Mv = o.camera || lookCam(o.az == null ? 0.8 : o.az, o.el == null ? 0.52 : o.el, o.camRoll || 0);
    const K = KEY, t = o.t || 0;
    const keys = o.keys || (mirror > 0 ? [-2, -1, 0, 1, 2] : [2, 1, 0, -1, -2]);
    const press = o.press || [0, 0, 0, 0, 0];
    const lookAt = o.lookAt || V(0, -22, 8);
    const x0 = -K.w / 2;   // middle finger's white key spans [-w/2, w/2]
    // hand placement
    const tilt = o.tilt == null ? 0.16 : o.tilt, roll = o.roll == null ? -0.04 : o.roll, turn = o.turn == null ? 0 : o.turn;
    let Mh = M.cols(V(1, 0, 0), V(0, 0, 1), V(0, -1, 0));
    Mh = M.mul(M.rz(-roll * mirror), M.mul(M.ry(turn), M.mul(M.rx(-tilt), Mh)));
    const midMcp = M.ap(Mh, V(m.fingers[1].mcp.x * mirror, m.fingers[1].mcp.y, m.fingers[1].mcp.z));
    const breath = o.breath == null ? 1 : o.breath;
    const Th = V(-midMcp.x + (o.handX || 0) * K.w + 1.5 * mirror, (o.wristY == null ? -31 : o.wristY) + Math.sin(t * 1.3) * 1.2 * breath, o.wristZ == null ? 106 : o.wristZ);
    const keyX = k => (typeof k === 'object' ? (k.b + 1) * K.w + x0 : (k + 0.5) * K.w + x0);
    const pressW = {}, pressB = {};
    const F = [];
    // make sure every finger can reach its key (lower / advance the hand if needed)
    const tgtOf = (i) => { const k = keys[i], pr = press[i] || 0, black = typeof k === 'object'; const depth = pr > 0 ? pr * K.travel : 0, lift = pr < 0 ? pr * 24 : 0; const zt = black ? -K.l + K.bl - 16 : (o.keyZ == null ? -16 : o.keyZ) - [0, 2, 6, 3, -7][i]; return V(keyX(k), (black ? -K.bh : 0) + depth + lift - 1.5, zt); };
    for (let it = 0; it < 8; it++) {
      let worst = 0;
      for (let i = 1; i <= 4; i++) { const fm = m.fingers[i - 1], L3 = fm.len[0] + fm.len[1] + fm.len[2]; const d = vlen(sub(toLocal(Mh, Th, mirror, tgtOf(i)), fm.mcp)); worst = Math.max(worst, d - 0.86 * L3); }
      if (worst <= 0) break;
      Th.y += worst * 0.7; Th.z -= worst * 0.45;
    }
    for (let i = 1; i <= 4; i++) {
      const k = keys[i], pr = press[i] || 0, black = typeof k === 'object';
      if (pr > 0) { if (black) pressB[k.b] = Math.max(pressB[k.b] || 0, pr); else pressW[k] = Math.max(pressW[k] || 0, pr); }
      const loc = toLocal(Mh, Th, mirror, tgtOf(i));
      F.push(solveFinger(m.fingers[i - 1], loc, { a0: 0.5, b0: 0.8, aMin: 0.05, bMin: 0.25 }));
    }
    // thumb plays on its radial side, closer to the front edge
    {
      const k = keys[0], pr = press[0] || 0, black = typeof k === 'object';
      const depth = pr > 0 ? pr * K.travel : 0, lift = pr < 0 ? pr * 18 : 0;
      if (pr > 0) { if (black) pressB[k.b] = Math.max(pressB[k.b] || 0, pr); else pressW[k] = Math.max(pressW[k] || 0, pr); }
      const tgt = V(keyX(k) + 3 * mirror, (black ? -K.bh : 0) + depth + lift - 3, black ? -K.l + K.bl - 14 : -14);
      F.unshift(solveThumb(m.thumb, toLocal(Mh, Th, mirror, tgt), { abd: 0.55, opp: 0.75, flex: [0.25, 0.25] }));
    }
    const pose = { F: F.slice(1), T: F[0] };
    const base = Object.assign({}, o, { side, kind, pose, camera: Mv, handMatrix: Mh, handPos: sub(Th, lookAt), focal: o.focal || 900, _m: matOf(ctx), arm: o.arm == null ? 260 : o.arm });
    delete base.x0;
    const rig = L.handRig(base);
    const Pw = q => rig.Pw(sub(q, lookAt));
    const range = o.range || [-9, 8];
    if (o.drawKeys !== false) {
      if (o.fallboard !== false && faceVis(Mv, V(0, 0, 1)) > 0.05) fallboard(ctx, Pw, Mv, rig, o, x0, range, lookAt);
      drawKeys(ctx, Pw, Mv, { x0, kMin: range[0], kMax: range[1], pressW, pressB, tone: o.keyTone });
    }
    // planar cast shadow on the key surface
    if (o.shadow !== false) {
      const sun = norm(o.sun || V(-0.55, -1, 0.25)); const Ld = mul(sun, -1);
      const sh = L.handRig(Object.assign({}, base, { style: 'silhouette', color: o.shadowColor || '#4a3530', worldMap: q => { const yw = q.y + lookAt.y; const tt = yw / Ld.y; return V(q.x - Ld.x * tt, -lookAt.y - 0.5, q.z - Ld.z * tt); } }));
      L.handRender(ctx, [sh], { alpha: o.shadowAlpha == null ? 0.22 : o.shadowAlpha, blur: Math.max(1.5, 2.2 * rig.unit) });
    }
    L.handRender(ctx, [rig], { alpha: o.alpha, glow: o.glow });
    rig.keyX = keyX; rig.Pkey = Pw; rig.pressW = pressW;
    return rig;
  };
  function fallboard(ctx, Pw, Mv, rig, o, x0, range, lookAt) {
    const K = KEY, zf = -K.l - 16, xl = x0 + range[0] * K.w - 6, xr = x0 + (range[1] + 1) * K.w + 6;
    const q = [Pw(V(xl, 2, zf)), Pw(V(xr, 2, zf)), Pw(V(xr, -150, zf)), Pw(V(xl, -150, zf))];
    const g = ctx.createLinearGradient(q[0].x, q[0].y, q[3].x, q[3].y); g.addColorStop(0, '#16131a'); g.addColorStop(0.5, '#0c0b10'); g.addColorStop(1, '#08080b');
    fillPoly(ctx, q, g);
    if (o.reflection === false) return;
    // reflection of keys (pale band) and of the hand (dim, blurred) in the black lacquer
    ctx.save(); fillPoly(ctx, q); ctx.clip();
    const rq = [Pw(V(xl, -1, zf)), Pw(V(xr, -1, zf)), Pw(V(xr, -16, zf)), Pw(V(xl, -16, zf))];
    const g2 = ctx.createLinearGradient(rq[0].x, rq[0].y, rq[3].x, rq[3].y); g2.addColorStop(0, 'rgba(240,232,220,0.28)'); g2.addColorStop(1, 'rgba(240,232,220,0)');
    fillPoly(ctx, rq, g2);
    const refl = L.handRig(Object.assign({}, rig.o, { worldMap: qq => V(qq.x, qq.y, 2 * (zf - lookAt.z) - qq.z), shadow: false }));
    L.handRender(ctx, [refl], { alpha: o.reflAlpha == null ? 0.2 : o.reflAlpha, blur: 1.2 * rig.unit });
    ctx.restore();
    void Mv;
  }

  /* ------------------------------------------------------------ guitar neck + handOnFrets */
  // World: neck along X (headstock toward +X), fretboard face at Z=0 facing the camera (+Z),
  // strings along X, low E at the top (-Y).  1 unit ≈ 0.92 mm.
  const NECK = { scale: 704, wNut: 46, w12: 60, thick: 27 };
  L.handNeckGeom = NECK;
  function fretX(n) { return -NECK.scale * (1 - Math.pow(2, -n / 12)); }      // nut at X = 0
  function neckHalfW(x) { return lerp(NECK.wNut, NECK.w12, clamp(-x / (NECK.scale / 2), 0, 1.4)) / 2; }
  function stringY(si, x) { const hw = neckHalfW(x) - 3.4; return lerp(-hw, hw, (6 - si) / 5); }   // si: 1 (high E, bottom) .. 6 (low E, top)
  function drawNeck(c, Pw, Mv, o) {
    const fr0 = o.fretFrom == null ? 1 : o.fretFrom, fr1 = o.fretTo == null ? 13 : o.fretTo;
    const xa = fretX(fr0 - 1) + 6, xb = fretX(fr1) - 4;
    const P = (x, y, z) => Pw(V(x, y, z));
    const T = Object.assign({ board: '#4a2e22', board2: '#3a231a', maple: '#e9c48d', maple2: '#c99a62', fret: '#d8dce2', fretHi: '#ffffff', dot: '#efe6d6', string: '#d9d4c8', wound: '#b9a789' }, o.tone || {});
    const N = 18; const top = [], bot = [];
    for (let i = 0; i <= N; i++) { const x = lerp(xa, xb, i / N); top.push([x, -neckHalfW(x)]); bot.push([x, neckHalfW(x)]); }
    // neck back (rounded) visible from below / above
    const backVis = M.ap(Mv, V(0, 1, 0)).z, topVis = M.ap(Mv, V(0, -1, 0)).z;
    if (backVis > 0) { const q = bot.map(([x, y]) => P(x, y, 0)).concat(bot.slice().reverse().map(([x, y]) => P(x, y * 0.7, -NECK.thick))); fillPoly(c, q, T.maple2); }
    if (topVis > 0) { const q = top.map(([x, y]) => P(x, y, 0)).concat(top.slice().reverse().map(([x, y]) => P(x, y * 0.7, -NECK.thick))); const g = c.createLinearGradient(q[0].x, q[0].y, q[q.length - 1].x, q[q.length - 1].y); g.addColorStop(0, T.maple); g.addColorStop(1, T.maple2); fillPoly(c, q, g); }
    // fretboard face
    const face = top.map(([x, y]) => P(x, y, 0)).concat(bot.slice().reverse().map(([x, y]) => P(x, y, 0)));
    const g = c.createLinearGradient(face[0].x, face[0].y, face[face.length - 1].x, face[face.length - 1].y); g.addColorStop(0, T.board); g.addColorStop(0.5, T.board2); g.addColorStop(1, T.board);
    fillPoly(c, face, g);
    // wood grain (deterministic)
    c.save(); fillPoly(c, face); c.clip();
    for (let k = 0; k < 14; k++) { const yy = lerp(-0.9, 0.9, PV.rand1(k, 5)); const pts = []; for (let i = 0; i <= 12; i++) { const x = lerp(xa, xb, i / 12); pts.push(P(x, neckHalfW(x) * (yy + 0.04 * PV.noise2(i * 0.6, k)), 0.1)); } c.strokeStyle = PV.rgba(k % 2 ? '#6a4432' : '#2c1912', 0.35); c.lineWidth = 1; c.beginPath(); smoothLine(c, pts); c.stroke(); }
    c.restore();
    // inlay dots
    for (const n of [3, 5, 7, 9, 12]) { if (n < fr0 || n > fr1) continue; const xm = (fretX(n - 1) + fretX(n)) / 2; const ys = n === 12 ? [-neckHalfW(xm) * 0.45, neckHalfW(xm) * 0.45] : [0]; for (const y of ys) { const q = P(xm, y, 0.2); c.fillStyle = T.dot; c.beginPath(); c.ellipse(q.x, q.y, 3.4 * q.k, 3.4 * q.k * Math.max(0.25, Math.abs(M.ap(Mv, V(0, 0, 1)).z)), 0, 0, TAU); c.fill(); } }
    // frets
    for (let n = fr0 - 1; n <= fr1; n++) {
      const x = fretX(n); if (x > xa + 0.1 || x < xb - 0.1) continue; const hw = neckHalfW(x);
      const a = P(x, -hw, 1.2), b = P(x, hw, 1.2), a2 = P(x + 1.2, -hw, 0), b2 = P(x + 1.2, hw, 0);
      c.strokeStyle = n === 0 ? '#f2ead8' : T.fret; c.lineWidth = Math.max(1.2, (n === 0 ? 3.2 : 1.9) * a.k); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.strokeStyle = PV.rgba(T.fretHi, 0.8); c.lineWidth = Math.max(0.8, 0.6 * a.k); c.beginPath(); c.moveTo(a2.x, a2.y - 0.6 * a.k); c.lineTo(b2.x, b2.y - 0.6 * a.k); c.stroke();
    }
    // edge binding line
    c.strokeStyle = PV.rgba('#1a0f0b', 0.7); c.lineWidth = 1.2; c.beginPath(); polyline(c, top.map(([x, y]) => P(x, y, 0))); c.stroke(); c.beginPath(); polyline(c, bot.map(([x, y]) => P(x, y, 0))); c.stroke();
  }
  function drawStrings(c, Pw, o, xa, xb, vib) {
    for (let si = 6; si >= 1; si--) {
      const w = [0, 0.45, 0.55, 0.75, 0.95, 1.15, 1.35][si];
      const pts = []; for (let i = 0; i <= 10; i++) { const x = lerp(xa, xb, i / 10); pts.push(Pw(V(x, stringY(si, x) + (vib ? vib(si, x) : 0), 2.6))); }
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(20,12,8,0.35)'; c.lineWidth = Math.max(1, (w + 0.8) * pts[5].k); c.beginPath(); polyline(c, pts.map(p => ({ x: p.x + 0.8 * p.k, y: p.y + 1.6 * p.k }))); c.stroke();
      c.strokeStyle = si >= 4 ? '#cdbb98' : '#e3e0d8'; c.lineWidth = Math.max(0.9, w * pts[5].k); c.beginPath(); polyline(c, pts); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = Math.max(0.5, w * 0.35 * pts[5].k); c.beginPath(); polyline(c, pts.map(p => ({ x: p.x, y: p.y - w * 0.25 * p.k }))); c.stroke();
    }
  }
  // o.chord: [[fret,string] | null] for index..little (default: C-shape at 5th position); o.thumbOver (default true)
  L.handOnFrets = function (ctx, o) {
    o = Object.assign({}, o || {});
    const side = o.side === 'R' ? 'R' : 'L', mirror = side === 'L' ? -1 : 1, kind = o.kind || (side === 'L' ? 'him' : 'her');
    const m = model(kind), t = o.t || 0;
    // default camera: from the body side and a little above -- the four fingers read as separate arches with
    // their tips on the strings (from straight in front they foreshorten into stubs)
    const Mv = o.camera || lookCam(o.az == null ? -0.5 : o.az, o.el == null ? 0.42 : o.el, o.camRoll || 0);
    const chord = o.chord || [[5, 2], [6, 4], [7, 5], null];
    const press = o.press || [1, 1, 1, 1, 1];
    const tgts = chord.map(cs => cs ? V(fretX(cs[0]) + 0.3 * (fretX(cs[0] - 1) - fretX(cs[0])), stringY(cs[1], fretX(cs[0])), 2.2) : null);
    const xs = tgts.filter(Boolean).map(v => v.x); const xMid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : fretX(6);
    const hwMid = neckHalfW(xMid);
    // hand frame: fingers up (-Y) & leaning toward the audience, back of the hand facing the audience and the floor
    const lean = o.lean == null ? 0.7 : o.lean, turn = o.turn == null ? 0.3 : o.turn;
    let Mh = M.cols(V(1, 0, 0), V(0, Math.cos(lean), -Math.sin(lean)), V(0, Math.sin(lean), Math.cos(lean)));
    Mh = M.mul(M.rz(-turn), Mh);
    const midM = M.ap(Mh, V(m.fingers[1].mcp.x * mirror, m.fingers[1].mcp.y, m.fingers[1].mcp.z));
    const Th = V(xMid - midM.x + (o.handX || 0), hwMid + (o.drop == null ? 13 : o.drop) - midM.y, (o.handZ == null ? 20 : o.handZ) - midM.z);
    let F = [];
    const solveAll = () => {
      F = [];
      for (let i = 1; i <= 4; i++) {
        let tg = tgts[i - 1];
        const pr = press[i] == null ? 1 : press[i];
        const mcpW = add(M.ap(Mh, V(m.fingers[i - 1].mcp.x * mirror, m.fingers[i - 1].mcp.y, m.fingers[i - 1].mcp.z)), Th);
        if (!tg) tg = V(mcpW.x - 4, -hwMid * 0.1, 26);       // a free finger relaxes, hovering above the strings
        tg = V(tg.x, tg.y, tg.z + (1 - clamp(pr, 0, 1)) * 14);
        if (o.vibrato && o.vibrato[i]) tg.y += Math.sin(t * 34) * o.vibrato[i] * 3.5;
        const sol = solveFinger(m.fingers[i - 1], toLocal(Mh, Th, mirror, tg), { a0: 0.75, b0: 1.3, aMin: 0.1, aMax: 1.5, bMin: 0.45, dip: 0.72 });
        sol.target = tg; sol.pressing = !!tgts[i - 1];
        const P3 = fingerChain(m.fingers[i - 1], sol).P[3]; sol.tipW = add(M.ap(Mh, V(P3.x * mirror, P3.y, P3.z)), Th);
        F.push(sol);
      }
    };
    // slide the hand along the neck / up-down until every pressing fingertip reaches its string
    for (let it = 0; it < 6; it++) {
      solveAll();
      let ex = 0, ey = 0, n = 0, worst = 0;
      for (const f of F) if (f.pressing) { const e = sub(f.target, f.tipW); ex += e.x; ey += e.y; n++; worst = Math.max(worst, vlen(e)); }
      if (!n || worst < 1.5) break;
      Th.x += 0.8 * ex / n; Th.y += 0.6 * ey / n;
    }
    const thumbOver = !!o.thumbOver;   // true: the thumb tip hooks over the top edge (Hendrix-style); default: behind the neck
    const hx = Th.x + midM.x;
    const tt = thumbOver ? V(hx + 36, -neckHalfW(hx) - 1, 4) : V(hx + 16, -hwMid * 0.45, -NECK.thick - 2);
    const T = solveThumb(m.thumb, toLocal(Mh, Th, mirror, tt), { abd: 0.5, opp: 0.9, flex: [0.3, 0.4] });
    const base = Object.assign({}, o, { side, kind, pose: { F, T }, camera: Mv, handMatrix: Mh, handPos: Th, focal: o.focal || 1100, _m: matOf(ctx), arm: o.arm == null ? 300 : o.arm, layer: { 0: 'back', 1: 'front', 2: 'front', 3: 'front', 4: 'front' }, split: thumbOver ? { 0: 2 } : null });
    const look = o.lookAt || V(xMid, 0, -12);
    base.handPos = sub(Th, look);
    const rig = L.handRig(base);
    const Pw = q => rig.Pw(sub(q, look));
    const fr0 = o.fretFrom == null ? 1 : o.fretFrom, fr1 = o.fretTo == null ? 13 : o.fretTo;
    const xa = fretX(fr0 - 1) + 6, xb = fretX(fr1) - 4;
    // 1) thumb behind the neck (with thumbOver only its root: the tip hooks over the top edge, drawn after the neck)
    L.handRender(ctx, [rig], { filter: it => it.kind === 'thumb' && it.part !== 'B' });
    // 2) neck + strings
    if (o.drawNeck !== false) drawNeck(ctx, Pw, Mv, o);
    const vib = o.stringVib ? (si, x) => o.stringVib * Math.sin(t * 90 + si) * Math.sin(Math.PI * clamp((x - xb) / (xa - xb), 0, 1)) * (si / 6) : null;
    if (o.drawNeck !== false) drawStrings(ctx, Pw, o, xa + 2, xb, vib);
    // 3) finger shadows on the fretboard
    if (o.shadow !== false) {
      const sun = norm(o.sun || V(-0.3, -0.8, 1)); const Ld = mul(sun, -1);
      const sh = L.handRig(Object.assign({}, base, { style: 'silhouette', color: '#140906', worldMap: q => { const zw = q.z + look.z; const tt2 = zw / Ld.z; return V(q.x - Ld.x * tt2, q.y - Ld.y * tt2, 0.3 - look.z); } }));
      ctx.save(); const face = []; for (let i = 0; i <= 12; i++) { const x = lerp(xa, xb, i / 12); face.push(Pw(V(x, -neckHalfW(x), 0))); } for (let i = 12; i >= 0; i--) { const x = lerp(xa, xb, i / 12); face.push(Pw(V(x, neckHalfW(x), 0))); }
      fillPoly(ctx, face); ctx.clip();
      L.handRender(ctx, [sh], { filter: it => it.kind === 'finger', alpha: 0.45, blur: Math.max(1.5, 1.8 * rig.unit) });
      ctx.restore();
    }
    // 4) palm (clipped away where it passes behind the neck) then fingers
    ctx.save();
    const nq = []; for (let i = 0; i <= 12; i++) { const x = lerp(xa - 40, xb - 40, i / 12); nq.push(Pw(V(x, -neckHalfW(x) - 1, 0))); } for (let i = 12; i >= 0; i--) { const x = lerp(xa - 40, xb - 40, i / 12); nq.push(Pw(V(x, neckHalfW(x) * 0.96, 0))); }
    ctx.beginPath(); ctx.rect(-10, -10, ctx.canvas.width + 20, ctx.canvas.height + 20); ctx.moveTo(nq[0].x, nq[0].y); for (const q of nq) ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.clip('evenodd');
    L.handRender(ctx, [rig], { filter: it => it.kind === 'palm' || it.kind === 'sleeve' });
    ctx.restore();
    L.handRender(ctx, [rig], { filter: it => it.kind === 'finger' || (it.kind === 'thumb' && it.part === 'B') });
    if (o.debug) { for (let i = 1; i <= 4; i++) { const tg = F[i - 1].target; if (!tg) continue; const a = Pw(tg), b = rig.tips[i]; ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(a.x, a.y, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#0af'; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText(String(i), b.x + 6, b.y); }
      const mc = rig.joints.slice(1).map(j => j[0]); ctx.fillStyle = '#ff0'; for (const q of mc) { ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, TAU); ctx.fill(); }
      const ta = Pw(tt), tb = rig.tips[0]; ctx.fillStyle = '#f0f'; ctx.beginPath(); ctx.arc(ta.x, ta.y, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#0f0'; ctx.beginPath(); ctx.arc(tb.x, tb.y, 5, 0, TAU); ctx.fill(); }
    rig.Pneck = Pw; rig.fretX = fretX; rig.stringY = stringY;
    return rig;
  };

  /* ------------------------------------------------------------ helpers for 2-hand poses */
  // build a rig whose local point fn(rig) lands at user-space (x, y)
  function rigAt(o, m, x, y, fn) {
    const probe = L.handRig(Object.assign({}, o, { x: 0, y: 0, _m: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }));
    const q = fn(probe);
    return L.handRig(Object.assign({}, o, { x: x - q.x, y: y - q.y, _m: m }));
  }
  const padPoint = (rig, i, k) => { const ch = rig.chains[i]; return rig.P(sub(sub(ch.P[3], mul(ch.F[2], ch.rad[3] * (k == null ? 1.25 : k))), mul(ch.D[2], ch.rad[3] * 0.85))); };
  const tipPoint = (rig, i) => { const ch = rig.chains[i]; return rig.P(sub(ch.P[3], mul(ch.D[2], ch.rad[3] * 0.35))); };
  L._handPadPoint = padPoint;

  /* ------------------------------------------------------------ handsTouch (第五話「左手、見せて」) */
  // His open left palm (string calluses) seen from above; her right fingertip gently touches his fingertip.
  // o: x,y (contact point), scale, approach 0..1 (1 = touching), touchFinger (his finger 1..4, default 2),
  //    angle (rotate the whole composition), style, light, t, his:{...}, her:{...} rig overrides, glow
  L.handsTouch = function (ctx, o) {
    o = Object.assign({}, o || {});
    const m = matOf(ctx), t = o.t || 0, sc = o.scale || 2.4, ap = clamp(o.approach == null ? 1 : o.approach, 0, 1);
    const cx = o.x == null ? 960 : o.x, cy = o.y == null ? 560 : o.y, ang = o.angle || 0;
    const tf = o.touchFinger == null ? 2 : o.touchFinger;
    const light = o.light == null ? -2.3 : o.light;
    const hisO = Object.assign({ side: 'L', kind: 'him', view: 'palm', pitch: -0.12, scale: sc, rot: -0.42 + ang, curl: [0.14, 0.1, 0.1, 0.14, 0.2], spread: 0.3, calluses: true, thumbScar: !!o.thumbScar, arm: 300, light, style: o.style, t, tremble: 0.1, seed: 2 }, o.his || {});
    const his = rigAt(hisO, m, cx, cy, r => padPoint(r, tf));
    // her hand hovers above (closer to camera); approach slides it in along its own finger direction
    const dist = (1 - PV.ease.inOutCubic(ap)) * 150 * sc;
    const ha = 2.55 + ang, dx = -Math.sin(ha) * dist, dy = Math.cos(ha) * dist;
    const herO = Object.assign({ side: 'R', kind: 'her', view: 'back', pitch: 0.42, yaw: 0.12, scale: sc * 1.04, rot: ha, curl: [0.32, 0.06, 0.4, 0.56, 0.64], spread: 0.12, arm: 300, light, style: o.style, t, tremble: 0.35 * ap, seed: 5, surgicalScars: !!o.herScars, sleeve: o.herSleeve, sleeveAt: 70 }, o.her || {});
    const contact = { x: cx + dx, y: cy + dy };
    const her = rigAt(herO, m, contact.x, contact.y, r => tipPoint(r, 1));
    // soft shadow of her hand on his palm: offset grows with height
    const h = 10 + 46 * (1 - ap);
    her.o.dropShadow = { dx: -Math.cos(light) * h * her.unit, dy: -Math.sin(light) * h * her.unit, blur: (2 + 5 * (1 - ap)) * her.unit, alpha: 0.3 - 0.12 * (1 - ap), color: '#9b5f50' };
    her.o.depthFn = it => it.depth + 1000;
    L.handRender(ctx, [his, her], { alpha: o.alpha, pad: 40 });
    // a tiny warm glow where they touch
    if (o.glow !== false && ap > 0.85 && (!o.style || o.style === 'cel')) {
      const q = padPoint(his, tf); const k = smooth(0.85, 1, ap) * (0.75 + 0.25 * Math.sin(t * 2.2));
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 34 * his.unit); g.addColorStop(0, PV.rgba('#fff2d8', 0.55 * k)); g.addColorStop(1, PV.rgba('#ffd9a8', 0));
      ctx.fillStyle = g; ctx.fillRect(q.x - 40 * his.unit, q.y - 40 * his.unit, 80 * his.unit, 80 * his.unit); ctx.restore();
    }
    return { his, her, contact: padPoint(his, tf) };
  };

  /* ------------------------------------------------------------ handsInterlock (final cut) */
  // Her right hand and his left hand, fingers interlaced ("恋人つなぎ"): palms together, fingers pointing the same
  // way, thumbs on the same side.  The FRONT hand shows its back to the camera; the other hand's fingers come
  // through between its fingers and curl over its knuckles (fingertips + nails in the valleys between the
  // knuckles), and the other hand's thumb lies over its radial edge.  All finger poses are solved by IK against
  // the partner hand's surface, so the clasp stays physically consistent for any camera / squeeze.
  // o.from: 'her' (default: her scarred back of hand, his fingers + scarred thumb over it) | 'him'.
  // o.x,o.y centre of the clasp, o.rot (0 = fingers pointing down), o.az/o.el camera, o.squeeze 0..1,
  // o.trace 0..1 (the thumb strokes the back of the partner's hand), o.scars, o.vee, style, light, t.
  L.handsInterlock = function (ctx, o) {
    o = Object.assign({}, o || {});
    const m = matOf(ctx), t = o.t || 0, sc = o.scale || 2.4, sq = o.squeeze == null ? 0.6 : o.squeeze;
    const fromHer = o.from !== 'him', scars = o.scars !== false;
    const Mv = o.camera || lookCam(o.az == null ? -0.3 : o.az, o.el == null ? -0.1 : o.el, 0);
    const fK = fromHer ? 'her' : 'him', bK = fromHer ? 'him' : 'her';
    const fM = model(fK), bM = model(bK), fSide = fromHer ? 'R' : 'L', bSide = fromHer ? 'L' : 'R';
    const mirF = fSide === 'L' ? -1 : 1, mirB = bSide === 'L' ? -1 : 1;
    const va = o.vee == null ? 0.2 : o.vee;
    // world: camera on +Z, fingers point down (+Y).  Front: dorsum to the camera.  Back: palm to the camera.
    const MhF = M.mul(M.rz(va), M.cols(V(-1, 0, 0), V(0, -1, 0), V(0, 0, 1)));
    const MhB = M.mul(M.rz(-va), M.cols(V(1, 0, 0), V(0, -1, 0), V(0, 0, -1)));
    const toW = (Mh, Th, mir, p) => add(M.ap(Mh, V(p.x * mir, p.y, p.z)), Th);
    const zF = 15, zB = zF - 36 + 4 * sq;
    const ThF = sub(V(0, 0, zF), toW(MhF, V(0, 0, 0), mirF, fM.fingers[1].mcp));
    const thumbSgn = fromHer ? 1 : -1;   // world X side of the thumbs
    // the back hand sits half a finger toward the thumbs: its index lies beside the front index (radial side), so
    // its thumb root is OUTSIDE the front hand's silhouette and can come over the radial edge onto the back of it
    const dx = o.interleave == null ? thumbSgn * 10.5 : o.interleave;
    const ThB = sub(V(dx, o.dy == null ? 4 : o.dy, zB), toW(MhB, V(0, 0, 0), mirB, bM.fingers[1].mcp));
    const wob = (i, k) => 0.025 * PV.noise2(t * 0.6 + i * 3.1, k * 1.7);
    const fX = fM.fingers.map(f => f.mcp.x);
    const bPose = { F: [], T: null }, fPose = { F: [], T: null };
    const bSpl = o.backSplay || [-0.16, -0.04, 0.08, 0.2], fSpl = o.frontSplay || [-0.2, -0.06, 0.08, 0.24];
    const tipY = o.tipY || [-80, -88, -87, -83], tipZ = (o.tipZ == null ? 17 : o.tipZ) - 2 * sq;
    for (let i = 0; i < 4; i++) {
      // back hand finger i: tip in the valley between the front hand's knuckles i-1 and i (index: beside her index)
      const gx = i > 0 ? (fX[i - 1] + fX[i]) / 2 : fX[0] - (fX[1] - fX[0]) * 0.55;
      const tw = toW(MhF, ThF, mirF, V(gx, tipY[i] + 2 * PV.noise2(t * 0.4, i * 2.3), tipZ));
      const sb = solveFinger(bM.fingers[i], toLocal(MhB, ThB, mirB, tw), { splay: bSpl[i], a0: 1.0, b0: 1.5, aMin: 0.2, aMax: 1.6, bMin: 0.6, bMax: 2.1, dip: 0.6 });
      sb.flex = sb.flex.map((v, k) => v + wob(i + 9, k)); bPose.F.push(sb);
      // front hand finger i: wraps onto the back hand's dorsum (mostly hidden)
      const tw2 = toW(MhB, ThB, mirB, V(bM.fingers[i].mcp.x + (i < 3 ? 10 : 6), -72, 18));
      const sf = solveFinger(fM.fingers[i], toLocal(MhF, ThF, mirF, tw2), { splay: fSpl[i], a0: 0.8, b0: 1.5, aMin: 0.1, aMax: 1.6, bMin: 0.6, bMax: 2.1, dip: 0.6 });
      sf.flex = sf.flex.map((v, k) => v + wob(i, k)); fPose.F.push(sf);
    }
    // thumbs: the back hand's thumb crosses onto the front hand's back (and strokes it with o.trace);
    // the front hand's thumb wraps onto the back hand's dorsum (hidden)
    const tr = o.trace == null ? 0 : o.trace, trw = Math.sin(tr * Math.PI * 2);
    const thT = toW(MhF, ThF, mirF, V(-20 + 5 * trw, -50 + 9 * trw, 20));
    bPose.T = solveThumb(bM.thumb, toLocal(MhB, ThB, mirB, thT), { abd: 0.7, opp: 1.0, flex: [0.4, 0.3] });
    fPose.T = solveThumb(fM.thumb, toLocal(MhF, ThF, mirF, toW(MhB, ThB, mirB, V(-26, -58, 18))), { abd: 0.6, opp: 0.9, flex: [0.3, 0.3] });
    const look = o.lookAt || V(4, 20, 0);
    const common = { scale: sc, x: o.x == null ? 960 : o.x, y: o.y == null ? 540 : o.y, rot: o.rot || 0, camera: Mv, focal: o.focal || 1100, _m: m, style: o.style, light: o.light, t,
      arm: o.arm == null ? 330 : o.arm, color: o.color, rimColor: o.rimColor, dark: o.dark, rimWidth: o.rimWidth, keyColor: o.keyColor, fillColor: o.fillColor, tint: o.tint };
    const rigF = L.handRig(Object.assign({}, common, { side: fSide, kind: fK, pose: fPose, handMatrix: MhF, handPos: sub(ThF, look), split: { 1: 1, 2: 1, 3: 1, 4: 1 },
      surgicalScars: scars && fK === 'her', thumbScar: scars && fK === 'him', sleeve: fromHer ? o.herSleeve : o.hisSleeve, sleeveAt: 80 }, fromHer ? o.her : o.his));
    const rigB = L.handRig(Object.assign({}, common, { side: bSide, kind: bK, pose: bPose, handMatrix: MhB, handPos: sub(ThB, look), split: { 0: 2, 1: 1, 2: 1, 3: 1, 4: 1 },
      surgicalScars: scars && bK === 'her', thumbScar: scars && bK === 'him', sleeve: fromHer ? o.hisSleeve : o.herSleeve, sleeveAt: 80 }, fromHer ? o.his : o.her));
    // the back hand's thumb lies ON the front hand: draw both of its parts in front of the front palm
    rigB.o.depthFn = (it) => (it.kind === 'thumb' ? 200 + it.depth : null);
    L.handRender(ctx, [rigB, rigF], { alpha: o.alpha, glow: o.glow, pad: 30 });
    return { front: rigF, back: rigB, her: fromHer ? rigF : rigB, him: fromHer ? rigB : rigF };
  };

  /* ------------------------------------------------------------ tube helper (cast / sling) */
  // closed hull of elliptical rings along the hand's local y axis.  rings: [[y, rx, rz, zc]...]
  function tubeHull(rig, rings, n, wob, seed) {
    const pts = [];
    for (const [y, rx, rz, zc] of rings) for (let i = 0; i < n; i++) {
      const a = i / n * TAU, w = 1 + (wob || 0) * PV.noise2(Math.cos(a) * 1.4 + (seed || 0), Math.sin(a) * 1.4 + y * 0.03);
      const q = rig.P(V(Math.cos(a) * rx * w, y, Math.sin(a) * rz * w + (zc || 0))); pts.push([q.x, q.y]);
    }
    return orient(hull(pts));
  }
  // insert points along each edge so smoothPoly only softens the corners (keeps straight sides)
  function densify(pts, n) { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; for (let k = 0; k < n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]); } return out; }
  function celFill(c, pts, Lv, sw, base, shade, line, lw) {
    c.save(); c.lineJoin = 'round'; c.strokeStyle = line; c.lineWidth = lw * 2;
    c.beginPath(); smoothPoly(c, pts, 0, 0); c.stroke(); c.beginPath(); smoothPoly(c, pts, -Lv.x * lw * 0.7, -Lv.y * lw * 0.7); c.stroke();
    c.beginPath(); smoothPoly(c, pts, 0, 0); c.fillStyle = shade; c.fill();
    c.clip(); c.beginPath(); smoothPoly(c, pts, Lv.x * sw, Lv.y * sw); c.fillStyle = base; c.fill();
    c.restore();
  }

  /* ------------------------------------------------------------ armCast */
  // Her right forearm in a white cast lying in an arm sling, the four fingers out of the cast from the knuckles.
  // o: x,y = wrist, scale, rot (default: forearm horizontal, fingers to the right), sling (true),
  //    slingColor, castColor, coverFingers (0..1 of the proximal phalanx hidden by the cast, default 0.1),
  //    style, light, t, tremble (fingertips), view/yaw/pitch as in hand()
  L.armCast = function (ctx, o) {
    o = Object.assign({}, o || {});
    const m = matOf(ctx), t = o.t || 0;
    const ro = Object.assign({ side: 'R', kind: 'her', view: 'back', yaw: -0.25, pitch: 0.28, rot: Math.PI / 2 + 0.1, scale: 2.2, x: 960, y: 560,
      curl: [0.22, 0.12, 0.16, 0.22, 0.3], spread: 0.14, arm: 330, t, tremble: o.tremble == null ? 0.25 : o.tremble, layerAll: 'front', surgicalScars: false }, o, { _m: m });
    const rig = L.handRig(ro);
    rig.S = rig.S || styleFor(rig);
    const S = styleFor(rig), Lv = S.L, lw = S.lw, u = rig.unit, cel = S.style === 'cel';
    // sling geometry (screen space): forearm axis from the elbow end to the wrist
    const sling = o.sling !== false;
    const armL = Math.min(330, ro.arm || 330);
    const a0 = rig.P(V(0, armL + 16, -3)), a1 = rig.P(V(0, 4, -3));
    const ax = a1.x - a0.x, ay = a1.y - a0.y, al = Math.hypot(ax, ay) || 1, ux = ax / al, uy = ay / al;
    let nx = -uy, ny = ux; if (ny < 0) { nx = -nx; ny = -ny; }          // n: "down" across the arm
    const half = f => lerp(36, 31, f) * u;                                 // cast half-width (incl. padding)
    const sc = cel ? (o.slingColor || '#a9bfdc') : S.base, ssh = cel ? hexMix(sc, '#2a3450', 0.3) : S.base, sl = cel ? hexMix(sc, '#10141f', 0.62) : S.line;
    const at = (f, off) => ({ x: a0.x + ax * f + nx * off, y: a0.y + ay * f + ny * off });
    // 1) straps behind the arm: from both ends of the pouch up toward the neck (off frame)
    if (sling) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const up = { x: -nx, y: -ny }, Ls = 1400 * u, sw = 21 * u;
      for (const [f, lean] of [[0.04, 0.38], [0.84, -0.32]]) {
        const p0 = at(f, half(f) * 0.15), dir = { x: up.x + ux * lean, y: up.y + uy * lean }, dl = Math.hypot(dir.x, dir.y); dir.x /= dl; dir.y /= dl;
        const sx = -dir.y * sw / 2, sy = dir.x * sw / 2;
        const strap = densify([[p0.x - sx, p0.y - sy], [p0.x + sx, p0.y + sy], [p0.x + sx + dir.x * Ls, p0.y + sy + dir.y * Ls], [p0.x - sx + dir.x * Ls, p0.y - sy + dir.y * Ls]], 6);
        celFill(ctx, strap, Lv, 0.3 * sw, ssh, hexMix(ssh, '#1a2034', 0.3), sl, lw);
        ctx.save(); ctx.beginPath(); smoothPoly(ctx, strap, 0, 0); ctx.clip(); ctx.setLineDash([lw * 2.4, lw * 2.2]); ctx.strokeStyle = PV.rgba(sl, 0.5); ctx.lineWidth = S.dw * 0.5;
        for (const k of [-0.32, 0.32]) { ctx.beginPath(); ctx.moveTo(p0.x + sx * k * 2, p0.y + sy * k * 2); ctx.lineTo(p0.x + sx * k * 2 + dir.x * Ls, p0.y + sy * k * 2 + dir.y * Ls); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
    }
    // 2) the hand (fingers out of the cast)
    L.handRender(ctx, [rig], { alpha: o.alpha });
    const cBase = cel ? (o.castColor || '#f7f6f2') : S.base, cShade = cel ? '#c9cfdc' : S.base, cLine = cel ? '#7d8698' : S.line;
    // 3) cast = the arm + palm + thumb base + finger roots, inflated by `pad`
    const pad = (o.castPad == null ? 6 : o.castPad) * u, cf = o.coverFingers == null ? 0.1 : o.coverFingers;
    // forearm + palm as ONE convex shell (a plaster cast has no wrist step), then the thumb and finger roots
    const shellPts = [];
    for (const q of rig.palmItem.subs) {
      if (q.t === 'cap' && !q.arm) continue;
      if (q.t === 'poly') for (const p2 of q.pts) shellPts.push(p2);
      else if (q.t === 'disc') { for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; shellPts.push([q.x + Math.cos(a) * q.r, q.y + Math.sin(a) * q.r]); } }
      else for (const [cx, cy, r] of [[q.ax, q.ay, q.ar], [q.bx, q.by, q.br]]) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; shellPts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    }
    const subs = [{ t: 'poly', pts: orient(hull(shellPts)) }];
    for (let i = 1; i <= 4; i++) { const sg = rig.chains[i].segs[0]; subs.push({ t: 'cap', ax: sg.A.x, ay: sg.A.y, ar: sg.ar, bx: lerp(sg.A.x, sg.B.x, cf), by: lerp(sg.A.y, sg.B.y, cf), br: lerp(sg.ar, sg.br, cf) }); }
    const ts = rig.chains[0].segs[1]; subs.push({ t: 'cap', ax: ts.A.x, ay: ts.A.y, ar: ts.ar, bx: lerp(ts.A.x, ts.B.x, 0.55), by: lerp(ts.A.y, ts.B.y, 0.55), br: ts.ar });
    const it = { subs };
    const bb = bboxOf(subs), cw = ctx.canvas.width, ch = ctx.canvas.height;
    const x0 = Math.max(0, Math.floor(bb[0] - pad * 3)), y0 = Math.max(0, Math.floor(bb[1] - pad * 3)), x1 = Math.min(cw, Math.ceil(bb[2] + pad * 3)), y1 = Math.min(ch, Math.ceil(bb[3] + pad * 3));
    if (x1 > x0 && y1 > y0) {
      const B = PV.buffer('hands:cast:' + cw + 'x' + ch, cw, ch), c = B.ctx; c.clearRect(x0, y0, x1 - x0, y1 - y0);
      const inflated = (dx, dy, extra, col) => { c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2 * (pad + extra); itemPath(c, it, 2, dx, dy); c.stroke(); c.fill(); };
      inflated(0, 0, lw, cLine); inflated(-Lv.x * lw * 0.75, -Lv.y * lw * 0.75, lw, cLine);
      inflated(0, 0, 0, cShade);
      c.save(); c.globalCompositeOperation = 'source-atop'; inflated(Lv.x * 10 * u, Lv.y * 10 * u, 0, cBase);
      // soft core shadow along the far side + a broad highlight on the lit side (a rounded plaster tube)
      c.globalAlpha = 0.5; inflated(-Lv.x * 2 * u, -Lv.y * 2 * u, -pad * 0.55, PV.rgba(cBase, 1)); c.globalAlpha = 1;
      // tape layer edges: soft arcs across the arm (irregular spacing) + plaster speckle
      const A0 = rig.P(V(0, 380, 0)), A1 = rig.P(V(0, -60, 0)); const bx = A1.x - A0.x, by = A1.y - A0.y, bl = Math.hypot(bx, by), vx = bx / bl, vy = by / bl;
      for (const f of [0.08, 0.27, 0.41, 0.6, 0.74, 0.86]) {
        const cx = A0.x + bx * f, cy = A0.y + by * f, w = 42 * u, bow = 8 * u;
        c.strokeStyle = cel ? 'rgba(130,140,165,0.3)' : 'rgba(0,0,0,0.18)'; c.lineWidth = S.dw * 0.7;
        c.beginPath(); c.moveTo(cx - vy * w - vx * 7 * u, cy + vx * w - vy * 7 * u); c.quadraticCurveTo(cx + vx * bow, cy + vy * bow, cx + vy * w + vx * 7 * u, cy - vx * w + vy * 7 * u); c.stroke();
      }
      if (cel) for (let k = 0; k < 140; k++) { const f = PV.rand1(k, 3), g = PV.rand1(k, 4) * 2 - 1; const px = A0.x + bx * f - vy * g * 34 * u, py = A0.y + by * f + vx * g * 34 * u; c.fillStyle = PV.rgba(PV.rand1(k, 5) > 0.5 ? '#ffffff' : '#b8bfcf', 0.3); c.fillRect(px, py, 1.3 * u, 1.3 * u); }
      // stockinette cuff (soft rolled cotton edge) where the fingers come out
      const ends = [1, 2, 3, 4].map(i => rig.P(add(rig.chains[i].P[0], mul(rig.chains[i].F[0], rig.chains[i].len[0] * cf + 3))));
      const ex = (ends[0].x - ends[3].x) * 0.14, ey = (ends[0].y - ends[3].y) * 0.14;
      const rollPts = [{ x: ends[0].x + ex, y: ends[0].y + ey }, ends[1], ends[2], { x: ends[3].x - ex, y: ends[3].y - ey }];
      for (const [w2, col] of [[9 * u + lw * 2, cLine], [9 * u, cel ? '#eef1f6' : S.base]]) { c.strokeStyle = col; c.lineWidth = w2; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); smoothLine(c, rollPts); c.stroke(); }
      c.restore();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (cel) blurBlit(ctx, B.canvas, x0, y0, x1 - x0, y1 - y0, 3 * u, { alpha: 0.2, dx: -Lv.x * 7 * u, dy: -Lv.y * 7 * u, pre: 'brightness(0.35)' });
      ctx.globalAlpha *= (o.alpha == null ? 1 : o.alpha); ctx.drawImage(B.canvas, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
    }
    // 4) the pouch's front wall: covers the lower part of the cast, open at the hand end
    if (sling) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const N = 18, fEnd = 0.86, hem = [], bot = [];
      for (let i = 0; i <= N; i++) {
        const f = fEnd * i / N, h = half(f);
        hem.push(at(f, h * 0.08 + 3 * u * Math.sin(f * 9 + 0.5)));
        bot.push(at(f, h + (9 * Math.sin(Math.PI * clamp(f / fEnd, 0, 1)) + 4) * u + 1.5 * u * Math.sin(f * 7 + t * 0.7)));
      }
      // closed, rounded elbow end; the open hand end bows outward a little
      const back = []; for (let k = 1; k < 6; k++) { const s2 = k / 6; const p = { x: lerp(bot[0].x, hem[0].x, s2), y: lerp(bot[0].y, hem[0].y, s2) }; const bow = Math.sin(Math.PI * s2) * 14 * u; back.push({ x: p.x - ux * bow, y: p.y - uy * bow }); }
      const open = []; for (let k = 1; k < 5; k++) { const s2 = k / 5; const p = { x: lerp(hem[N].x, bot[N].x, s2), y: lerp(hem[N].y, bot[N].y, s2) }; const bow = Math.sin(Math.PI * s2) * 6 * u; open.push({ x: p.x + ux * bow, y: p.y + uy * bow }); }
      const poly = hem.concat(open, bot.slice().reverse(), back).map(p => [p.x, p.y]);
      celFill(ctx, poly, Lv, 0.16 * half(0.5), sc, ssh, sl, lw);
      ctx.save(); ctx.beginPath(); smoothPoly(ctx, poly, 0, 0); ctx.clip(); ctx.lineCap = 'round';
      { // the cloth wraps under the arm: darker toward the bottom
        const m0 = at(0.45, 0), m1 = at(0.45, half(0.45) + 14 * u), g = ctx.createLinearGradient(m0.x, m0.y, m1.x, m1.y);
        g.addColorStop(0, PV.rgba(ssh, 0)); g.addColorStop(0.55, PV.rgba(ssh, 0.1)); g.addColorStop(1, PV.rgba(ssh, 0.75));
        ctx.fillStyle = g; ctx.fill(); ctx.beginPath(); smoothPoly(ctx, poly, 0, 0); ctx.fillStyle = g; ctx.fill();
      }
      // shadow under the hem fold (the cast presses the cloth), a light fold line, stitched hem, pulled folds
      ctx.strokeStyle = PV.rgba(ssh, 0.55); ctx.lineWidth = 7 * u; ctx.beginPath(); smoothLine(ctx, hem.map(p => ({ x: p.x + nx * 6 * u, y: p.y + ny * 6 * u }))); ctx.stroke();
      ctx.strokeStyle = PV.rgba(hexMix(sc, '#ffffff', 0.55), 0.8); ctx.lineWidth = 2.2 * u; ctx.beginPath(); smoothLine(ctx, hem.map(p => ({ x: p.x + nx * 2 * u, y: p.y + ny * 2 * u }))); ctx.stroke();
      ctx.setLineDash([S.dw * 2.4, S.dw * 2.2]); ctx.strokeStyle = PV.rgba(sl, 0.5); ctx.lineWidth = S.dw * 0.55; ctx.beginPath(); smoothLine(ctx, hem.map(p => ({ x: p.x + nx * 10 * u, y: p.y + ny * 10 * u }))); ctx.stroke(); ctx.setLineDash([]);
      for (let k = 0; k < 4; k++) { const f = 0.14 + k * 0.19, p0 = at(f, half(f) * 0.25), p1 = at(f - 0.07, half(f) + 10 * u); ctx.strokeStyle = PV.rgba(sl, 0.32); ctx.lineWidth = S.dw * 0.8; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo((p0.x + p1.x) / 2 + ux * 10 * u, (p0.y + p1.y) / 2 + uy * 10 * u, p1.x, p1.y); ctx.stroke(); }
      ctx.restore();
      ctx.restore();
    }
    return rig;
  };

  /* ------------------------------------------------------------ handkerchief + handOffer */
  // folded handkerchief lying on the palm (hand-local coords): soft cloth -- rounded corners, slightly wavy edges,
  // two layers at the folded edge, a diagonal crease, a hem stripe, and one corner draped over the little-finger
  // side (gravity: the palm faces up, so "down" is the back of the hand, +z).
  function hankie(c, rig, o) {
    const S = rig.S, lw = S.lw, Lv = S.L, cel = S.style === 'cel', t = o.t || 0;
    const col = cel ? (o.hankieColor || '#f6f3ec') : S.base, sh = cel ? hexMix(col, '#8f9bb5', 0.32) : S.base, ln = cel ? hexMix(col, '#3c3a48', 0.72) : S.line, pat = o.hankiePattern || '#8fb0d8';
    const Z = -17 * rig.m.kw, sway = Math.sin(t * 1.4) * 2.5;
    const Q = (x, y, z) => rig.P(V(x, y, z == null ? Z : z));
    // cloth outline: corners + wavy midpoints, then rounded by smoothPoly
    const wav = (a, b, k) => { const m2 = mix3(a, b, 0.5); return add(m2, V(0, 0, 1.6 * Math.sin(k * 2.3 + 1))); };
    const A = V(-38, -120, Z - 1.5), B = V(33, -113, Z - 2.5), C = V(38, -36, Z - 4), D = V(-36, -40, Z - 3);
    const quad = (p, dx, dy, dz) => p.map(q => add(q, V(dx, dy, dz)));
    const ring = (cs) => { const out = []; for (let i = 0; i < 4; i++) { const a = cs[i], b = cs[(i + 1) % 4]; out.push(a, wav(a, b, i)); } return out; };
    const proj = pts => densify(pts.map(q => { const p2 = rig.P(q); return [p2.x, p2.y]; }), 3);
    const lower = proj(ring(quad([A, B, C, D], 1.4, 1.8, 0.8)));
    const upper = proj(ring([A, B, C, D]));
    // draped corner over the little-finger edge
    const flap = proj([B, V(B.x + 9, B.y + 14, Z + 20 + sway), V(B.x + 13 + sway * 0.4, (B.y + C.y) / 2 + 6, Z + 30 + sway), V(C.x + 10 + sway * 0.6, C.y - 10, Z + 22 + sway), C, V((B.x + C.x) / 2 + 2, (B.y + C.y) / 2, Z - 3)]);
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    const draw = (pts, fill, sw) => {
      c.beginPath(); smoothPoly(c, pts, 0, 0); c.strokeStyle = ln; c.lineWidth = lw * 2; c.stroke();
      c.beginPath(); smoothPoly(c, pts, -Lv.x * lw * 0.7, -Lv.y * lw * 0.7); c.stroke();
      c.beginPath(); smoothPoly(c, pts, 0, 0); c.fillStyle = sw ? sh : fill; c.fill();
      if (sw) { c.save(); c.clip(); c.beginPath(); smoothPoly(c, pts, Lv.x * sw, Lv.y * sw); c.fillStyle = fill; c.fill(); c.restore(); }
    };
    draw(flap, hexMix(col, sh, 0.35), 5 * rig.unit);
    draw(lower, hexMix(col, sh, 0.25), 0);
    draw(upper, col, 7 * rig.unit);
    if (cel) {
      c.save(); c.beginPath(); smoothPoly(c, upper, 0, 0); c.clip();
      // hem stripe a little inside the edge
      const inset = [A, B, C, D].map((q, i, arr) => mix3(q, mix3(arr[(i + 2) % 4], q, 0.5), 0.12));
      const ip = densify(inset.map(q => { const p2 = rig.P(q); return [p2.x, p2.y]; }), 3);
      c.strokeStyle = PV.rgba(pat, 0.85); c.lineWidth = S.dw * 1.1; c.beginPath(); smoothPoly(c, ip, 0, 0); c.stroke();
      // diagonal crease: a soft shadow on one side, a highlight on the other
      const k0 = rig.P(mix3(A, C, 0.06)), k1 = rig.P(mix3(A, C, 0.94)), nx2 = -(k1.y - k0.y), ny2 = k1.x - k0.x, nl = Math.hypot(nx2, ny2) || 1, off = 2.2 * rig.unit;
      c.strokeStyle = PV.rgba(sh, 0.6); c.lineWidth = 3.5 * rig.unit; c.beginPath(); c.moveTo(k0.x + nx2 / nl * off, k0.y + ny2 / nl * off); c.lineTo(k1.x + nx2 / nl * off, k1.y + ny2 / nl * off); c.stroke();
      c.strokeStyle = PV.rgba('#ffffff', 0.75); c.lineWidth = 1.3 * rig.unit; c.beginPath(); c.moveTo(k0.x, k0.y); c.lineTo(k1.x, k1.y); c.stroke();
      // soft cloth shading where it dips between the finger bases
      for (const x of [-20, 0, 19]) { const p0 = Q(x, -100), p1 = Q(x + 1, -84); c.strokeStyle = PV.rgba(sh, 0.28); c.lineWidth = 4 * rig.unit; c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke(); }
      c.restore();
    }
    c.restore();
  }
  // Hand offering a folded handkerchief, palm up (第一話). o: side (default 'R'), kind (default 'him'), x,y wrist, scale, rot,
  // reach 0..1 (extends the arm toward the camera), hankieColor, hankiePattern, style, light, t
  L.handOffer = function (ctx, o) {
    o = Object.assign({}, o || {});
    const m = matOf(ctx);
    const reach = o.reach == null ? 1 : o.reach;
    const ro = Object.assign({ side: 'R', kind: 'him', view: 'palm', pitch: 0.45 - 0.2 * (1 - reach), yaw: -0.1, rot: -1.1, scale: 2.4, x: 960, y: 640,
      curl: [0.2, 0.16, 0.2, 0.26, 0.34], spread: 0.1, arm: 320, layer: { 0: 'front' }, thumb: { abd: 0.42, opp: 0.75, flex: [0.18, 0.3] }, sleeve: o.sleeve, sleeveAt: 75 }, o, { _m: m });
    const rig = L.handRig(ro);
    L.handRender(ctx, [rig], { filter: it => it.kind !== 'thumb', alpha: o.alpha });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); hankie(ctx, rig, o); ctx.restore();
    L.handRender(ctx, [rig], { filter: it => it.kind === 'thumb', alpha: o.alpha });
    return rig;
  };

  /* ------------------------------------------------------------ handPress (palm against glass) */
  // Palm pressed flat against a window seen from outside (rain / hospital). o: x,y wrist, scale, rot, side, kind,
  // press 0..1 (contact: blanched skin + fog halo on the glass), fog colour, style, light, t
  L.handPress = function (ctx, o) {
    o = Object.assign({}, o || {});
    const m = matOf(ctx), pr = o.press == null ? 1 : o.press, t = o.t || 0;
    const ro = Object.assign({ side: 'R', kind: 'her', view: 'palm', scale: 2.4, x: 960, y: 700, curl: [-0.05, -0.08, -0.06, -0.05, -0.02], spread: 0.42, arm: 260, tremble: 0.15 }, o, { _m: m });
    const rig = L.handRig(ro);
    // condensation where warm skin touches cold glass: whitish fog that is densest around the CONTACT patches
    // (palm pads, thenar, finger pads) and fades out -- not a glow around the whole silhouette
    const spots = [[V(0, -60, -16), 30], [V(-20, -26, -17), 22], [V(19, -30, -16), 19], [V(-6, -10, -18), 17]];
    for (let i = 1; i <= 4; i++) { const ch = rig.chains[i]; spots.push([sub(ch.P[3], mul(ch.F[2], ch.rad[3] * 1.5)), ch.rad[3] * 1.9]); spots.push([ch.P[1], ch.rad[1] * 1.3]); spots.push([mix3(ch.P[0], ch.P[1], 0.5), ch.rad[0] * 1.2]); }
    { const th = rig.chains[0]; spots.push([sub(th.P[3], mul(th.F[2], th.rad[3] * 1.4)), th.rad[3] * 1.9]); }
    if (pr > 0) {
      const cw = ctx.canvas.width, chh = ctx.canvas.height, b = PV.buffer('hands:fog', cw, chh), c = b.ctx;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const pts = spots.map(([p3, r]) => { const q = rig.P(p3); const rr = r * q.k; x0 = Math.min(x0, q.x - rr); y0 = Math.min(y0, q.y - rr); x1 = Math.max(x1, q.x + rr); y1 = Math.max(y1, q.y + rr); return [q.x, q.y, rr]; });
      const pad = 40 * rig.unit; x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(cw, Math.ceil(x1 + pad)); y1 = Math.min(chh, Math.ceil(y1 + pad));
      if (x1 > x0 && y1 > y0) {
        c.clearRect(x0, y0, x1 - x0, y1 - y0); c.fillStyle = o.fogColor || '#eef3f8';
        for (const [x, y, r] of pts) { c.beginPath(); c.arc(x, y, r * 1.25, 0, TAU); c.fill(); }
        const fa = 0.34 * pr * (0.88 + 0.12 * Math.sin(t * 1.3));
        blurBlit(ctx, b.canvas, x0, y0, x1 - x0, y1 - y0, 12 * rig.unit, { alpha: fa * 0.6, op: 'screen' });
        blurBlit(ctx, b.canvas, x0, y0, x1 - x0, y1 - y0, 26 * rig.unit, { alpha: fa * 0.6, op: 'screen' });
      }
    }
    L.handRender(ctx, [rig], { alpha: o.alpha, after: (c, it) => {
      if (it.kind !== 'palm' || rig.S.style !== 'cel' || pr <= 0) return;
      // blanched contact patches: palm pads + fingertip pads
      c.save(); itemPath(c, it, 0); c.clip(); c.globalCompositeOperation = 'source-atop';
      for (const [p3, r0] of spots) { const r = r0 * 0.8; const q = rig.P(p3); const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * q.k); g.addColorStop(0, PV.rgba('#fff4ee', 0.32 * pr)); g.addColorStop(1, PV.rgba('#fff4ee', 0)); c.fillStyle = g; c.fillRect(q.x - r * q.k, q.y - r * q.k, r * q.k * 2, r * q.k * 2); }
      c.restore();
    } });
    return rig;
  };

  /* ------------------------------------------------------------ handReach / handFist */
  // An open hand reaching toward the light (great with style:'rim'). o.open 0..1 (0 = relaxed, 1 = fingers stretched)
  L.handReach = function (ctx, o) {
    o = Object.assign({}, o || {});
    const op = o.open == null ? 0.7 : o.open;
    const c = lerp(0.35, -0.04, op);
    return L.hand(ctx, Object.assign({ side: 'R', view: 'back', pitch: 0.35, yaw: 0.15, curl: [c + 0.1, c, c + 0.03, c + 0.06, c + 0.1], spread: lerp(0.2, 0.75, op), tremble: 0.2, arm: 400 }, o));
  };
  // A clenched fist (crushing a can / holding back tears). o.clench 0..1, o.shake (tremor amplitude).
  // Fingers fully tucked (tips into the palm, flat front of middle phalanges), the thumb locked across the
  // middle phalanges of the index and middle fingers (solved by IK so it really lies on them).
  L.handFist = function (ctx, o) {
    o = Object.assign({}, o || {});
    const k = o.clench == null ? 1 : o.clench, side = o.side === 'L' ? 'L' : 'R';
    const m = model(o.kind || (side === 'L' ? 'him' : 'her')), t = o.t || 0, sh = o.shake == null ? 0.6 : o.shake, seed = (o.seed || 0) * 7.1;
    const tight = [[1.42, 1.86, 0.6], [1.5, 1.92, 0.58], [1.5, 1.9, 0.6], [1.44, 1.84, 0.66]], loose = [[0.35, 0.5, 0.3], [0.38, 0.55, 0.3], [0.42, 0.6, 0.32], [0.48, 0.66, 0.36]];
    const F = tight.map((b, i) => ({ flex: b.map((v, j) => lerp(loose[i][j], v, k) + sh * 0.035 * PV.noise2(t * 6.3 + i * 5.1 + seed, j * 2.7)), splay: [-0.07, -0.015, 0.04, 0.11][i] * (1 - 0.4 * k) }));
    const ci = fingerChain(m.fingers[0], F[0]), cm = fingerChain(m.fingers[1], F[1]);
    const mid = mix3(mix3(ci.P[1], ci.P[2], 0.55), mix3(cm.P[1], cm.P[2], 0.55), 0.35), Dn = norm(add(ci.D[1], cm.D[1]));
    const tgt = add(mid, mul(Dn, ci.rad[1] + m.thumb.rad[3] * 0.9));
    const Tk = solveThumb(m.thumb, tgt, { abd: 0.25, opp: 1.15, flex: [0.45, 0.35] });
    const T = { abd: lerp(0.55, Tk.abd, k), opp: lerp(0.45, Tk.opp, k), flex: [lerp(0.15, Tk.flex[0], k) + sh * 0.03 * PV.noise2(t * 5.7 + seed, 31), lerp(0.2, Tk.flex[1], k)], twist: 0 };
    return L.hand(ctx, Object.assign({ side, view: 'back', yaw: -0.38, pitch: 0.62, pose: { F, T }, arm: 300 }, o));
  };

  /* ------------------------------------------------------------ generic */
  L.hand = function (ctx, o) {
    o = Object.assign({}, o || {}); o._m = matOf(ctx);
    const rig = L.handRig(o);
    L.handRender(ctx, [rig], { alpha: o.alpha, blur: o.blur, glow: o.glow });
    return rig;
  };
})();

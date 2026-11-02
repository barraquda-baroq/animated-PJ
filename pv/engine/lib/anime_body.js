/* anime_body.js — anime-style bodies, costumes and poses (作画監督：体・衣装・ポーズ) for 『キミの右手のアイロニー』.
 *
 * Extends PV.anime (see anime.js for DESIGN / COLORS / LIGHT / mat / taper / inkW / onTwos):
 *   PV.anime.figure(ctx, o)     one character: body + costume + pose; the head through PV.anime.head / headBack
 *   PV.anime.pair(ctx, o)       two-person poses (sit_back, leap_embrace, embrace, collapsed)
 *   PV.anime.bodyScale(who, px) o.scale that makes the character stand px tall
 * API notes: analysis/art_review/anime_body_API.md.  Showcase: pv/scenes/_dev_anime_body.js.
 *
 * How it is drawn (why it should not read as 3D CG):
 *   - Only the SKELETON is 3D: joints, a torso lofted from elliptic rings, a skirt draped from rings. Every visible thing is a
 *     smooth 2D shape built from the projected rig (Catmull-Rom contours) — nothing is shaded per facet or by a 3D gradient.
 *   - Line art: the parts of one depth layer share ONE outer contour (stroked behind the fills, heavier on the side away from
 *     the key light = anime line weight). Where a part overlaps a different part of the same layer it gets a thinner inner line,
 *     but never where forms merge (sleeve into shoulder, forearm into upper arm): those contours taper out (入り抜き).
 *     Line colours are the material's ink (skin = warm brown, white cloth = blue grey, navy = deep navy).
 *   - Cel paint: base + one crisp shadow band on the side away from the key light + designed shadows (collar and ribbon cast,
 *     skirt hem on the thighs, jaw on the neck, the arm on the torso, pleat stripes) + highlight bands on glossy materials
 *     (loafers, lacquer, leather) + a crisp rim band toward o.rimDir under back-lit conditions (PV.anime.LIGHT[*].rimA).
 * Everything is deterministic in (o.T, options); cloth and limb sway are sampled on twos (PV.anime.onTwos).
 */
(function () {
  'use strict';
  const PV = window.PV; const A = (PV.anime = PV.anime || {});
  const TAU = Math.PI * 2, PI = Math.PI, HP = Math.PI / 2;
  const sin = Math.sin, cos = Math.cos, abs = Math.abs, sqrt = Math.sqrt, atan2 = Math.atan2, hypot = Math.hypot, max = Math.max, min = Math.min;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const N2 = (x, y) => PV.noise2(x, y);
  const R1 = (i, s) => PV.rand1(i, s);

  /* ================================================================ extra materials (added only if absent) */
  const COL = {
    shirt_blue: ['#d3e3f3', '#a9c0dc', '#8aa3c3', '#f0f6fd', '#4d6486'],
    tee_black: ['#2c2d33', '#1d1e23', '#141519', '#4d505b', '#0b0b0e'],
    jeans: ['#3b465d', '#29324a', '#1d2436', '#5d6c8a', '#121726'],
    belt: ['#3d2b22', '#2a1e17', '#1d1410', '#6e5446', '#130d0a'],
    buckle: ['#cfccc3', '#a19d92', '#7d796e', '#ffffff', '#4f4b42'],
    sole: ['#ece8e0', '#cbc6ba', '#aca698', '#ffffff', '#6f695d'],
    sneaker: ['#e9eaee', '#c3c6cf', '#a3a7b2', '#ffffff', '#5d616c'],
    slipper: ['#e6edf3', '#bccad8', '#9dafc1', '#ffffff', '#5b6b7d'],
    chain: ['#e6e1d4', '#b3ab98', '#8a8270', '#ffffff', '#6a6250'],
    wood: ['#cfa06a', '#ad7e49', '#8a5e32', '#ebc795', '#5d3c1d'],
    steel: ['#a7aeb8', '#838b96', '#666e79', '#dfe4ea', '#3d434c'],
    lacquer: ['#29282f', '#1a191e', '#111014', '#62606e', '#070709'],
    cushion: ['#3a2f36', '#2a2127', '#1d171b', '#6a5862', '#110c0f'],
    carton: ['#f7f4ec', '#d8d2c4', '#bcb4a3', '#ffffff', '#6f6858'],
    carton_band: ['#f29a3d', '#d0762a', '#a9561b', '#ffc489', '#7a3c10'],
    straw: ['#f4f6f8', '#cfd6de', '#b0b9c4', '#ffffff', '#6a7380'],
    sofa: ['#9a9ca3', '#7b7d85', '#62646c', '#c3c5cb', '#3f4148'],
    strap: ['#2b2a30', '#1d1c21', '#141317', '#55535e', '#0a0a0c'],
    rosewood: ['#4e3526', '#3a271c', '#291b13', '#7a5844', '#1a100b'],
    maple: ['#ecc98f', '#cfa76c', '#b08750', '#fbe3b8', '#6e4f25'],
    guard: ['#f6f3ea', '#d7d2c4', '#bbb4a3', '#ffffff', '#6d6757'],
    chrome: ['#d9dde3', '#a7aeb8', '#868e99', '#ffffff', '#4f5660'],
    rail: ['#e3e7ec', '#bfc6cf', '#a2aab5', '#ffffff', '#5b636e'],
    grass: ['#5f8a4a', '#466e37', '#345428', '#8fbf6a', '#22381a'],
    tights: ['#2d2c33', '#1f1e24', '#151418', '#4f4d58', '#0c0b0e'],
    boot: ['#2a2224', '#1c1618', '#130f10', '#5a4a4e', '#0b0809'],
    pumps: ['#1d2236', '#131727', '#0c0f1a', '#4a5275', '#07080f'],
    sandal: ['#f3ece0', '#d6cbb8', '#bcae96', '#ffffff', '#776a52'],
    bandage: ['#f5f6f7', '#d3d8de', '#b8bfc8', '#ffffff', '#6a7280'],
    pajama_pants: ['#c4d6e6', '#9ab0c8', '#7c93ae', '#e3edf6', '#4a5d75'],
    long_skirt: ['#3a3d4a', '#2a2c37', '#1e2029', '#5a5e70', '#121318'],
    turtle: ['#3b3a42', '#2a2930', '#1d1c22', '#5d5c68', '#111014'],
    piping: ['#5c79a3', '#455f86', '#344a6b', '#86a0c6', '#1f2f48'],
    sash: ['#f4f1ea', '#d6d0c3', '#bbb4a5', '#ffffff', '#726b5e'],
    sling: ['#eef2f6', '#c8d1db', '#aab5c3', '#ffffff', '#5d6979'],
  };
  for (const k in COL) if (!A.COLORS[k]) A.COLORS[k] = COL[k];

  /* ================================================================ 3D math (x right, y down, z toward the viewer) */
  const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = hypot(a[0], a[1], a[2]) || 1e-9; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  };
  function mm(P, Q) { const C = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] = P[i * 3] * Q[j] + P[i * 3 + 1] * Q[3 + j] + P[i * 3 + 2] * Q[6 + j]; return C; }
  function mv(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
  // R = Ry(yaw) * Rx(pitch) * Rz(roll). yaw +: the front (+z) turns toward +x (screen right); pitch +: the top leans forward
  // (toward +z); roll +: the top tilts toward +x.
  function rot(yaw = 0, pitch = 0, roll = 0) {
    const cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch), cr = cos(roll), sr = sin(roll);
    return mm([cy, 0, sy, 0, 1, 0, -sy, 0, cy], mm([1, 0, 0, 0, cp, sp, 0, -sp, cp], [cr, -sr, 0, sr, cr, 0, 0, 0, 1]));
  }
  // two-bone IK: root S, target T, lengths l1/l2, pole = rough direction the middle joint should point to
  function ik3(S, T, l1, l2, pole) {
    const d = v3.sub(T, S); let D = v3.len(d); const dn = v3.mul(d, 1 / (D || 1e-9));
    D = clamp(D, abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
    const a = (l1 * l1 - l2 * l2 + D * D) / (2 * D), h = sqrt(max(0, l1 * l1 - a * a));
    const pp = v3.norm(v3.sub(pole, v3.mul(dn, v3.dot(pole, dn))));
    return [v3.add(S, v3.add(v3.mul(dn, a), v3.mul(pp, h))), v3.add(S, v3.mul(dn, D))];
  }

  /* ================================================================ 2D paths */
  // Catmull-Rom through pts ([x,y] or [x,y,1] = sharp corner) as bezier segments on a Path2D
  function crPath(path, pts, closed, move = true, k = 1) {
    const n = pts.length; if (n < 2) return path;
    const P = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    if (move) path.moveTo(pts[0][0], pts[0][1]); else path.lineTo(pts[0][0], pts[0][1]);
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const s1 = p1[2] ? 0 : k / 6, s2 = p2[2] ? 0 : k / 6;
      path.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * s1, p1[1] + (p2[1] - p0[1]) * s1, p2[0] - (p3[0] - p1[0]) * s2, p2[1] - (p3[1] - p1[1]) * s2, p2[0], p2[1]);
    }
    if (closed) path.closePath();
    return path;
  }
  const area = (pts) => { let s = 0; for (let i = 0, n = pts.length; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  // closed smooth shape with a consistent (positive) orientation so unions clip correctly with the nonzero rule
  function shape(pts, k = 1) { const q = area(pts) < 0 ? pts.slice().reverse() : pts; return crPath(new Path2D(), q, true, true, k); }
  function polyPath(pts) { const p = new Path2D(); const q = area(pts) < 0 ? pts.slice().reverse() : pts; p.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) p.lineTo(q[i][0], q[i][1]); p.closePath(); return p; }
  const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul2 = (a, k) => [a[0] * k, a[1] * k];
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const norm2 = (a) => { const l = hypot(a[0], a[1]) || 1e-9; return [a[0] / l, a[1] / l]; };
  const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
  const centroid = (P) => { let x = 0, y = 0; for (const p of P) { x += p[0]; y += p[1]; } return [x / P.length, y / P.length]; };
  function hull(pts) { // monotone chain convex hull
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  // smooth interpolation of a key profile [[f, v...], ...]
  function profAt(prof, f) {
    if (f <= prof[0][0]) return prof[0].slice(1);
    for (let i = 0; i < prof.length - 1; i++) if (f <= prof[i + 1][0]) {
      const a = prof[i], b = prof[i + 1], k = sstep(0, 1, (f - a[0]) / ((b[0] - a[0]) || 1));
      const out = []; for (let j = 1; j < a.length; j++) out.push(lerp(a[j], b[j], k)); return out;
    }
    return prof[prof.length - 1].slice(1);
  }

  /* ================================================================ render context + cel painter */
  const BIGR = 90;
  function shiftedComp(path, dx, dy) { const p = new Path2D(); p.rect(-BIGR, -BIGR, 2 * BIGR, 2 * BIGR); p.addPath(path, new DOMMatrix([1, 0, 0, 1, dx, dy])); return p; }

  function makeRC(ctx, o, s, flip) {
    const m = ctx.getTransform(); const zoom = hypot(m.a, m.b) || 1;
    const headPx = s * zoom, W = A.inkW(headPx) * (o.line || 1), px = 1 / headPx;
    const light = o.light || 'day';
    const LT = typeof light === 'string' ? (A.LIGHT[light] || A.LIGHT.day) : light;
    let kd = o.keyDir !== undefined ? o.keyDir : (o.rimDir !== undefined ? o.rimDir : -2.3);
    let rd = o.rimDir !== undefined ? o.rimDir : kd;
    if (flip) { kd = PI - kd; rd = PI - rd; }
    const R = {
      ctx, s, zoom, headPx, W, px, light, LT, flip,
      lx: cos(kd), ly: sin(kd), rx: cos(rd), ry: sin(rd),
      rimA: clamp((o.rimA !== undefined ? o.rimA : LT.rimA) * (LT.dark < 0.7 ? 1.1 : 1)), rimCol: o.rimColor || LT.rim,
      amb: o.amb, wet: o.wet || 0,
      wA: 0.62 * W * px, wB: 0.78 * W * px, sOff: 0.5 * W * px,   // outline: ~0.62 W on the lit side, ~1.3 W in shadow
      wIn: 0.85 * W * px, wDet: 0.6 * W * px, rimW: max(1.6, W * 1.05) * px * (LT.dark < 0.7 ? 1.25 : 1),
      cache: {},
    };
    // skin uses the same lifted ambient as the faces (PV.anime.faceAmb in anime_head.js) so neck / hands match the face;
    // clothes get a milder lift in dark lights so night and storm figures keep their colours (brief: no black silhouettes)
    const SKINY = { skin: 1, blush: 1, lips: 1 };
    const ambOf = (name) => {
      if (R.amb !== undefined) return R.amb;
      if (SKINY[name]) return typeof A.faceAmb === 'function' ? A.faceAmb(light, o.faceLift) : LT.amb * (1 - (LT.dark < 0.8 ? 0.35 : 0.12));
      return LT.amb * (1 - (LT.dark < 0.8 ? 0.22 : 0.06));
    };
    R.m = (name, wet) => { const k = name + '|' + (wet || 0); return R.cache[k] || (R.cache[k] = A.mat(name, light, { amb: ambOf(name), wet: wet || 0 })); };
    return R;
  }

  function paintPart(R, p) {
    const c = R.ctx, m = p.m;
    c.fillStyle = p.fill || m.base; c.fill(p.path);
    c.save(); c.clip(p.path);
    if (p.band) {
      let bx = R.lx, by = R.ly;
      if (p.bandDir === 'x') { bx = Math.sign(R.lx || 1); by = 0; }
      c.fillStyle = p.bandCol || m.shade; c.fill(shiftedComp(p.path, bx * p.band, by * p.band), 'evenodd');
    }
    if (p.cast) for (const k of p.cast) {
      if (!k.path) continue;
      c.save(); c.translate(-R.lx * k.d + (k.dx || 0), -R.ly * k.d + (k.dy || 0)); c.globalAlpha = k.a ?? 1; c.fillStyle = k.col || m.shade; c.fill(k.path); c.restore();
    }
    if (p.shades) for (const s of p.shades) { if (!s.path) continue; c.globalAlpha = s.a ?? 1; c.fillStyle = s.col || m[s.tone || 'shade']; c.fill(s.path, s.rule || 'nonzero'); }
    c.globalAlpha = 1;
    if (p.paint) p.paint(c, R, m);
    if (p.hi) { c.globalAlpha = p.hiA ?? 1; c.fillStyle = m.hi; c.fill(shiftedComp(p.path, -R.lx * p.hi, -R.ly * p.hi), 'evenodd'); c.globalAlpha = 1; }
    if (R.rimA > 0.02 && p.rim !== false) {
      const w = R.rimW * (p.rimWk ?? 1);
      c.globalAlpha = clamp(R.rimA * (p.rimK ?? 1)); c.fillStyle = R.rimCol; c.fill(shiftedComp(p.path, -R.rx * w, -R.ry * w), 'evenodd'); c.globalAlpha = 1;
    }
    c.restore();
  }
  function inkPart(R, p) {
    const c = R.ctx, col = p.lineCol || p.m.line, w = R.wIn * (p.lw || 1) * (p.inkK || 1);
    if (p.inkPts) {
      for (const L of p.inkPts) if (L.pts && L.pts.length > 1) A.taper(c, L.pts, L.wf ? (u) => L.wf(u) * w : { w0: w * 0.1, mid: w, w1: w * 0.1 }, col, L.smooth !== false);
      return;
    }
    c.strokeStyle = col; c.lineWidth = w; c.stroke(p.inkPath || p.path);
  }
  function drawLines(R, p) {
    const c = R.ctx;
    c.save(); if (p.clipLines !== false) c.clip(p.path);
    for (const L of p.lines) {
      if (!L.pts || L.pts.length < 2) continue;
      const w = (L.w || 1) * R.wDet;
      if (L.fill) { c.fillStyle = L.col || p.m[L.tone || 'line']; c.globalAlpha = L.a ?? 1; c.fill(shape(L.pts)); c.globalAlpha = 1; continue; }
      c.globalAlpha = L.a ?? 1;
      A.taper(c, L.pts, { w0: w * (L.w0 ?? 0.15), mid: w, w1: w * (L.w1 ?? 0.15) }, L.col || p.m[L.tone || 'line'], L.smooth !== false);
      c.globalAlpha = 1;
    }
    c.restore();
  }
  // A depth layer: one outer contour for the union, then fills / cel paint; inner lines where a part lies over a part of a
  // different family drawn earlier in the same layer.
  function paintGroup(R, parts) {
    const c = R.ctx; c.lineJoin = 'round'; c.lineCap = 'round';
    for (const p of parts) {
      if (p.noOutline || !p.path) continue;
      const k = p.lw || 1; c.strokeStyle = p.lineCol || p.m.line;
      c.lineWidth = 2 * R.wA * k; c.stroke(p.path);
      c.save(); c.translate(-R.lx * R.sOff * k, -R.ly * R.sOff * k); c.lineWidth = 2 * R.wB * k; c.stroke(p.path); c.restore();
    }
    const done = [];
    for (const p of parts) {
      if (p.path) paintPart(R, p);
      if (p.path && p.ink !== false && done.length) {
        const clip = new Path2D(); let any = false;
        for (const q of done) if (!p.fam || q.fam !== p.fam) { clip.addPath(q.path); any = true; }
        if (any) { c.save(); c.clip(clip); inkPart(R, p); c.restore(); }
      }
      if (p.lines && p.lines.length) drawLines(R, p);
      if (p.after) p.after(c, R, p.m);
      if (p.path && !p.noUnion) done.push(p);
    }
  }

  /* ================================================================ character specs (head units; ground = 0, up = -y) */
  const SPECS = {
    senpai: {
      who: 'senpai', H: 7.0, girl: true,
      hipY: -3.72, waistY: -4.32, chestY: -4.95, neckBaseY: -5.62, neckLen: 0.44, neckR: [0.106, 0.096],
      hipJ: [0.2, 0.03, 0.0], sh: [0.565, -5.385, -0.02], acro: [0.535, -5.505, -0.035],
      upArm: 1.12, foreArm: 0.93, hand: 0.6, thigh: 1.74, shin: 1.75, ankleH: 0.23, foot: 0.58,
      rings: { // name: [frame, yAbs, a, b, cz]
        neck: ['c', -5.62, 0.112, 0.105, -0.03], chestTop: ['c', -5.2, 0.43, 0.245, 0.0], bust: ['c', -4.96, 0.42, 0.29, 0.045],
        underbust: ['c', -4.72, 0.37, 0.24, 0.02], waist: ['w', -4.32, 0.315, 0.21, 0.0], hipTop: ['p', -4.02, 0.41, 0.24, -0.01],
        hip: ['p', -3.72, 0.49, 0.275, -0.035], seat: ['p', -3.48, 0.46, 0.255, -0.03],
      },
      upW: [[0, 0.098], [0.3, 0.083], [0.7, 0.069], [1, 0.061]], foreW: [[0, 0.06], [0.25, 0.064], [0.7, 0.048], [1, 0.037]],
      // [f, outer, inner, front, back] half-widths (the side of the leg seen on screen picks a blend of the four)
      thighW: [[0, 0.18, 0.17, 0.17, 0.17], [0.3, 0.162, 0.148, 0.158, 0.15], [0.62, 0.135, 0.118, 0.13, 0.118], [0.86, 0.106, 0.096, 0.1, 0.094], [1, 0.094, 0.088, 0.09, 0.088]],
      shinW: [[0, 0.092, 0.088, 0.088, 0.09], [0.1, 0.088, 0.09, 0.078, 0.1], [0.3, 0.1, 0.098, 0.07, 0.118], [0.55, 0.082, 0.08, 0.064, 0.088], [0.8, 0.06, 0.058, 0.055, 0.058], [1, 0.047, 0.046, 0.046, 0.05]],
    },
    boy: {
      who: 'boy', H: 7.3, girl: false,
      hipY: -3.95, waistY: -4.55, chestY: -5.2, neckBaseY: -5.88, neckLen: 0.45, neckR: [0.135, 0.126],
      hipJ: [0.235, 0.03, 0.0], sh: [0.70, -5.62, -0.02], acro: [0.665, -5.77, -0.035],
      upArm: 1.2, foreArm: 1.0, hand: 0.68, thigh: 1.86, shin: 1.83, ankleH: 0.26, foot: 0.7,
      rings: {
        neck: ['c', -5.88, 0.15, 0.135, -0.03], chestTop: ['c', -5.45, 0.55, 0.28, 0.0], chest: ['c', -5.2, 0.54, 0.3, 0.03],
        lowChest: ['c', -4.92, 0.49, 0.275, 0.02], waist: ['w', -4.55, 0.42, 0.24, 0.0], hipTop: ['p', -4.25, 0.44, 0.25, 0.0],
        hip: ['p', -3.95, 0.465, 0.27, -0.025], seat: ['p', -3.72, 0.44, 0.255, -0.02],
      },
      upW: [[0, 0.112], [0.3, 0.098], [0.7, 0.086], [1, 0.077]], foreW: [[0, 0.078], [0.25, 0.084], [0.7, 0.066], [1, 0.052]],
      thighW: [[0, 0.19, 0.18, 0.19, 0.19], [0.35, 0.17, 0.158, 0.172, 0.165], [0.75, 0.13, 0.12, 0.125, 0.122], [1, 0.106, 0.1, 0.104, 0.104]],
      shinW: [[0, 0.106, 0.1, 0.104, 0.106], [0.3, 0.114, 0.11, 0.088, 0.13], [0.6, 0.092, 0.09, 0.078, 0.1], [1, 0.058, 0.056, 0.056, 0.06]],
    },
  };
  { // the aunt: the heroine's frame, slightly taller (7.2 heads), a little fuller
    const s = SPECS.senpai, k = 7.2 / 7.0, au = JSON.parse(JSON.stringify(s));
    au.who = 'aunt'; au.H = 7.2;
    for (const key of ['hipY', 'waistY', 'chestY', 'neckBaseY']) au[key] = s[key] * k;
    au.sh = [s.sh[0] * 1.02, s.sh[1] * k, s.sh[2]]; au.acro = [s.acro[0] * 1.02, s.acro[1] * k, s.acro[2]];
    au.thigh = s.thigh * k; au.shin = s.shin * k; au.upArm *= k; au.foreArm *= k;
    for (const n in au.rings) { au.rings[n][1] *= k; au.rings[n][2] *= 1.03; }
    SPECS.aunt = au;
  }
  A.BODY_SPECS = SPECS;
  /** o.scale (px per head) that makes `who` stand heightPx tall (crown to soles). */
  A.bodyScale = (who, heightPx) => heightPx / (SPECS[who] || SPECS.senpai).H;

  /* ================================================================ rig: frames + joints in body space (anchor at origin) */
  // P (from a pose): pelvis {pos, yaw, pitch, roll}, spine {twist, bend, side}, neck {yaw, pitch, roll}, shrugL/R, breath 0..1
  function buildRig(sp, P) {
    const pz = P.pelvis || {};
    const pM = rot(pz.yaw || 0, pz.pitch || 0, pz.roll || 0), po = pz.pos || [0, sp.hipY, 0];
    const sn = P.spine || {};
    const Mw = mm(pM, rot((sn.twist || 0) * 0.45, (sn.bend || 0) * 0.45, (sn.side || 0) * 0.45));
    const Mc = mm(pM, rot(sn.twist || 0, sn.bend || 0, sn.side || 0));
    const wo = v3.add(po, mv(pM, [0, sp.waistY - sp.hipY, 0]));
    const co = v3.add(wo, mv(Mw, [0, sp.chestY - sp.waistY, 0]));
    const F = { p: { o: po, M: pM, y0: sp.hipY }, w: { o: wo, M: Mw, y0: sp.waistY }, c: { o: co, M: Mc, y0: sp.chestY } };
    const at = (f, x, yAbs, z) => v3.add(F[f].o, mv(F[f].M, [x, yAbs - F[f].y0, z]));
    const br = P.breath || 0;
    const J = { F, at, sp, P };
    J.neckBase = at('c', 0, sp.neckBaseY - br * 0.008, -0.03);
    const nk = P.neck || {};
    J.Mn = mm(Mc, rot(nk.yaw || 0, nk.pitch || 0, nk.roll || 0));
    J.neckTop = v3.add(J.neckBase, mv(J.Mn, [0, -sp.neckLen, 0.035]));
    for (const side of ['L', 'R']) {
      const sg = side === 'L' ? 1 : -1, sh = (P['shrug' + side] || 0) + br * 0.012;
      J['S' + side] = at('c', sg * sp.sh[0], sp.sh[1] - sh, sp.sh[2]);
      J['Ac' + side] = at('c', sg * sp.acro[0], sp.acro[1] - sh, sp.acro[2]);
      J['H' + side] = at('p', sg * sp.hipJ[0], sp.hipY + sp.hipJ[1], sp.hipJ[2]);
    }
    return J;
  }
  // limbs from the pose's limb callback: arms {L,R}: {E,W} | {W, pole}; legs {L,R}: {K,A} | {A, pole}
  function solveLimbs(J, LB) {
    const sp = J.sp;
    for (const side of ['L', 'R']) {
      const sg = side === 'L' ? 1 : -1;
      const a = (LB.arms && LB.arms[side]) || {};
      let E = a.E, W = a.W;
      if (!W) W = v3.add(J['S' + side], [sg * 0.08, sp.upArm + sp.foreArm - 0.04, 0.03]);
      if (!E) [E, W] = ik3(J['S' + side], W, sp.upArm, sp.foreArm, a.pole || [sg * 0.25, 0, -1]);
      J['E' + side] = E; J['W' + side] = W; J['hand' + side] = a.hand || {};
      const l = (LB.legs && LB.legs[side]) || {};
      let K = l.K, An = l.A;
      if (!An) An = [J['H' + side][0] + sg * 0.02, -sp.ankleH, 0];
      if (!K) [K, An] = ik3(J['H' + side], An, sp.thigh, sp.shin, l.pole || [0, 0, 1]);
      J['K' + side] = K; J['A' + side] = An; J['foot' + side] = l.foot || {};
    }
  }

  /* ================================================================ lofted surfaces (torso, skirts) */
  // ring spec: {f: frame key, y: absolute rest y, a, b, cz, cx, dip (front drops), dipB (back drops), sq (boxiness 0..0.5),
  //             front (extra forward bulge), off(ph) -> [dx,dy,dz] in frame}
  function ringSample(G, r, N) {
    const F = G.J.F[r.f], P2 = [], Z = [], P3 = [];
    for (let k = 0; k < N; k++) {
      const ph = (k / N) * TAU, c = cos(ph), s = sin(ph);
      const sq = r.sq || 0, cc = sq ? Math.sign(c) * Math.pow(abs(c), 1 - sq) : c, ss = sq ? Math.sign(s) * Math.pow(abs(s), 1 - sq) : s;
      let x = (r.cx || 0) + r.a * cc, z = (r.cz || 0) + r.b * ss + (s > 0 ? (r.front || 0) * s * s : 0);
      let y = r.y - F.y0 + (r.dip ? r.dip * Math.pow(max(0, s), r.dipP || 2) : 0) + (r.dipB ? r.dipB * Math.pow(max(0, -s), 2) : 0);
      if (r.off) { const d = r.off(ph, k, s, c); x += d[0]; y += d[1]; z += d[2]; }
      const w3 = v3.add(F.o, mv(F.M, [x, y, z])), v = G.V(w3);
      P2.push([v[0], v[1]]); Z.push(v[2]); P3.push(w3);
    }
    return { P2, Z, P3, r };
  }
  function extreme(P, n, sign) {
    const N = P.length; let best = -1e9, k = 0;
    const f = (i) => { const q = P[((i % N) + N) % N]; return sign * (q[0] * n[0] + q[1] * n[1]); };
    for (let i = 0; i < N; i++) { const d = f(i); if (d > best) { best = d; k = i; } }
    const fm = f(k - 1), f0 = f(k), fp = f(k + 1), den = fm - 2 * f0 + fp;
    let dl = den < -1e-9 ? 0.5 * (fm - fp) / den : 0; dl = clamp(dl, -0.5, 0.5);
    const j = dl >= 0 ? k + 1 : k - 1, q = P[((j % N) + N) % N], p = P[k], t = abs(dl);
    return { pt: [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], k, kf: k + dl, v: best };
  }
  // indices strictly between kA and kB (exclusive) along the side of the ring nearer to the viewer
  function nearIdx(ring, kA, kB) {
    const N = ring.P2.length;
    const walk = (dir) => { const idx = []; let i = kA, g = 0; while (g++ < N) { i = (i + dir + N) % N; if (i === kB) break; idx.push(i); } return idx; };
    const a = walk(1), b = walk(-1);
    const md = (idx) => (idx.length ? idx.reduce((s, i) => s + ring.Z[i], 0) / idx.length : -1e9);
    return md(a) >= md(b) ? a : b;
  }
  // silhouette of a loft (rings top -> bottom). opt.topArc / opt.botArc: include the near arcs; opt.sharpBot: sharp hem corners;
  // opt.inserts: {afterTop: {R: [pts], L: [pts]}}
  function loftOutline(rs, opt = {}) {
    const top = rs[0], bot = rs[rs.length - 1];
    const cT = centroid(top.P2), cB = centroid(bot.P2);
    const u = norm2(sub2(cT, cB)), n = opt.n || [-u[1], u[0]];
    const Rx = rs.map(r => extreme(r.P2, n, 1)), Lx = rs.map(r => extreme(r.P2, n, -1));
    const pts = [];
    pts.push(opt.sharpTop ? [...Rx[0].pt, 1] : Rx[0].pt);
    if (opt.insR) for (const q of opt.insR) pts.push(q);
    for (let i = 1; i < rs.length; i++) pts.push(i === rs.length - 1 && opt.sharpBot ? [...Rx[i].pt, 1] : Rx[i].pt);
    if (opt.botArc !== false) for (const i of nearIdx(bot, Rx[rs.length - 1].k, Lx[rs.length - 1].k)) pts.push(opt.botPts ? opt.botPts[i] : bot.P2[i]);
    for (let i = rs.length - 1; i >= 1; i--) pts.push(i === rs.length - 1 && opt.sharpBot ? [...Lx[i].pt, 1] : Lx[i].pt);
    if (opt.insL) for (const q of opt.insL) pts.push(q);
    pts.push(opt.sharpTop ? [...Lx[0].pt, 1] : Lx[0].pt);
    if (opt.topArc !== false) for (const i of nearIdx(top, Lx[0].k, Rx[0].k)) pts.push(top.P2[i]);
    return { pts, Rx, Lx, n, u };
  }
  // a point on ring r at angle phDeg (0 = +x side, 90 = front, 180 = -x side, 270 = back), lifted along the normal by out
  function ringPoint(G, r, phDeg, yAbs, out = 0, dz = 0) {
    const F = G.J.F[r.f], ph = phDeg * PI / 180, c = cos(ph), s = sin(ph);
    const nrm = v3.norm([c / r.a, 0, s / r.b]);
    const yy = (yAbs === undefined ? r.y : yAbs) - F.y0 + (r.dip ? r.dip * Math.pow(max(0, s), r.dipP || 2) : 0);
    const loc = [(r.cx || 0) + r.a * c + nrm[0] * out, yy, (r.cz || 0) + r.b * s + (s > 0 ? (r.front || 0) * s * s : 0) + nrm[2] * out + dz];
    return v3.add(F.o, mv(F.M, loc));
  }
  const facing = (G, F, dir) => G.Vr(mv(G.J.F[F].M, dir))[2];   // view-space z of a frame direction (+: toward the viewer)
  // a point on the surface between two rings (t: 0 = rA .. 1 = rB) at angle phDeg, lifted along the normal by out
  function surfPt(G, rA, rB, t, phDeg, out = 0) {
    const p = v3.lerp(ringPoint(G, rA, phDeg), ringPoint(G, rB, phDeg), t);
    if (!out) return p;
    const ph = phDeg * PI / 180, F = G.J.F[rA.f];
    return v3.add(p, v3.mul(v3.norm(mv(F.M, [cos(ph) / lerp(rA.a, rB.a, t), 0, sin(ph) / lerp(rA.b, rB.b, t)])), out));
  }
  const nzAt = (G, f, phDeg) => facing(G, f, [cos(phDeg * PI / 180), 0, sin(phDeg * PI / 180)]);

  /* ================================================================ limbs (2D capsules from projected joints) */
  // capsule p0->p1 with prof [[f, wA, wB], ...]; A = left of travel. Returns {pts (closed), A, B, ink (open U contour)}
  function capsule(p0, p1, prof, o = {}) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = hypot(dx, dy) || 1e-6, ux = dx / l, uy = dy / l, ax = uy, ay = -ux;
    const S = [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1];
    const A = [], B = [];
    for (const f of S) { const w = profAt(prof, f); const px = p0[0] + dx * f, py = p0[1] + dy * f; A.push([px + ax * w[0], py + ay * w[0]]); B.push([px - ax * w[1], py - ay * w[1]]); }
    const cap = (pc, wa, wb, fwd) => { // semicircle from A side to B side bulging along fwd (+1 forward, -1 backward)
      const r = (wa + wb) / 2, off = (wa - wb) / 2, c = [pc[0] + ax * off, pc[1] + ay * off], out = [];
      const k = fwd > 0 ? (o.capK ?? 1) : (o.capK0 ?? 1);
      for (let j = 1; j < 4; j++) { const a = (j / 4) * PI; out.push([c[0] + ax * r * cos(a) * (fwd > 0 ? 1 : 1) + ux * fwd * r * sin(a) * k, c[1] + ay * r * cos(a) + uy * fwd * r * sin(a) * k]); }
      return fwd > 0 ? out : out.reverse();
    };
    const w1 = profAt(prof, 1), w0 = profAt(prof, 0);
    const c1 = cap(p1, w1[0], w1[1], 1);            // from A to B around p1
    const c0 = cap(p0, w0[0], w0[1], -1);           // from B to A around p0 (reversed order below)
    const pts = A.concat(c1, B.slice().reverse(), c0);
    return { pts, A, B, c1, c0 };
  }
  // ONE closed outline for a two-segment limb p0 -> p1 -> p2 (shoulder-elbow-wrist / hip-knee-ankle). prof1/prof2: [[f, wA, wB], ...].
  // The inner side of the bend is mitred at the intersection of the two offset edges, the outer side runs round the joint on
  // an arc: no round "ball joint", and the cel band / rim run through the joint without a seam.
  // Returns {pts (closed), ink (open U contour from f0 on the first segment round the far end and back), A, B}
  function limb2(p0, p1, p2, prof1, prof2, o = {}) {
    const S = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 1];
    const seg = (a, b, prof) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], l = hypot(dx, dy) || 1e-6, ux = dx / l, uy = dy / l, nx = uy, ny = -ux;
      const A = [], B = [];
      for (const f of S) { const w = profAt(prof, f); const px = a[0] + dx * f, py = a[1] + dy * f; A.push([px + nx * w[0], py + ny * w[0], f]); B.push([px - nx * w[1], py - ny * w[1], f]); }
      return { A, B, u: [ux, uy], n: [nx, ny], l };
    };
    const s1 = seg(p0, p1, prof1), s2 = seg(p1, p2, prof2);
    const cr = s1.u[0] * s2.u[1] - s1.u[1] * s2.u[0], dt = dot2(s1.u, s2.u);
    const isect = (a0, a1, b0, b1) => {
      const r = sub2(a1, a0), q = sub2(b1, b0), den = r[0] * q[1] - r[1] * q[0];
      if (abs(den) < 1e-9) return null;
      const t = ((b0[0] - a0[0]) * q[1] - (b0[1] - a0[1]) * q[0]) / den;
      return [a0[0] + r[0] * t, a0[1] + r[1] * t];
    };
    const joinSide = (L1, L2, inner, sgn) => {
      const n = L1.length;
      if (abs(cr) < 0.02 && dt > 0) return L1.slice(0, n - 1).concat(L2.slice(1));            // straight: just continue
      if (inner) {
        const I = isect(L1[n - 2], L1[n - 1], L2[0], L2[1]);
        const wmax = hypot(L1[n - 1][0] - p1[0], L1[n - 1][1] - p1[1]) + hypot(L2[0][0] - p1[0], L2[0][1] - p1[1]);
        if (!I || dt < -0.35 || hypot(I[0] - p1[0], I[1] - p1[1]) > wmax * 1.6) return L1.slice(0, n - 1).concat(L2.slice(1));
        const d1 = dot2(sub2(I, p1), s1.u), d2 = dot2(sub2(I, p1), s2.u);
        const a = L1.filter(q => dot2(sub2(q, p1), s1.u) < d1 - 1e-4), b = L2.filter(q => dot2(sub2(q, p1), s2.u) > d2 + 1e-4);
        const Ip = [I[0], I[1]]; Ip.sharp = true;
        return a.concat([Ip], b);
      }
      // outer: arc round p1 from the end of L1 to the start of L2
      const a0 = atan2(L1[n - 1][1] - p1[1], L1[n - 1][0] - p1[0]), a1 = atan2(L2[0][1] - p1[1], L2[0][0] - p1[0]);
      let da = a1 - a0; while (da > PI) da -= TAU; while (da < -PI) da += TAU;
      const r0 = hypot(L1[n - 1][0] - p1[0], L1[n - 1][1] - p1[1]), r1 = hypot(L2[0][0] - p1[0], L2[0][1] - p1[1]);
      const arc = []; const k = Math.max(1, Math.ceil(abs(da) / 0.35));
      for (let i = 1; i < k; i++) { const t = i / k, a = a0 + da * t, r = lerp(r0, r1, t); arc.push([p1[0] + cos(a) * r, p1[1] + sin(a) * r]); }
      void sgn;
      return L1.concat(arc, L2);
    };
    const innerA = cr < 0;
    const A = joinSide(s1.A, s2.A, innerA, 1), B = joinSide(s1.B, s2.B, !innerA, -1);
    // caps
    const cap = (pc, wa, wb, u, n, fwd, k) => {
      const r = (wa + wb) / 2, off = (wa - wb) / 2, c = [pc[0] + n[0] * off, pc[1] + n[1] * off], out = [];
      for (let j = 1; j < 4; j++) { const a = (j / 4) * PI; out.push([c[0] + n[0] * r * cos(a) + u[0] * fwd * r * sin(a) * k, c[1] + n[1] * r * cos(a) + u[1] * fwd * r * sin(a) * k]); }
      return out;   // from the A side to the B side
    };
    const w2 = profAt(prof2, 1), w0 = profAt(prof1, 0);
    const c2 = cap(p2, w2[0], w2[1], s2.u, s2.n, 1, o.capK ?? 1);
    const c0 = cap(p0, w0[0], w0[1], s1.u, s1.n, -1, o.capK0 ?? 1).reverse();
    const xy = (q) => (q.sharp ? [q[0], q[1], 1] : [q[0], q[1]]);
    const pts = A.map(xy).concat(c2, B.slice().reverse().map(xy), c0);
    const f0 = o.f0 ?? 0.25;
    const first = (L) => { const i = L.findIndex(q => q.length > 2 && !q.sharp && q[2] >= f0); return i < 0 ? 0 : i; };
    const ink = A.slice(first(A)).map(q => [q[0], q[1]]).concat(c2, B.slice(first(B)).reverse().map(q => [q[0], q[1]]));
    return { pts, ink, A, B, s1, s2 };
  }
  // open ink contour of a capsule, skipping the proximal end (f < f0) so it merges into what it grows from
  function capsuleInk(cap, f0 = 0.15, endCap = true) {
    const S = [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1];
    const i0 = S.findIndex(f => f >= f0);
    const A = cap.A.slice(i0), B = cap.B.slice(i0).reverse();
    return endCap ? A.concat(cap.c1, B) : null;
  }
  function mergeParts(name, fam, list, extra = {}) {
    const ok = list.filter(Boolean); if (!ok.length) return null;
    const path = new Path2D(); for (const q of ok) path.addPath(q.path);
    const cat = (k) => { const out = []; for (const q of ok) if (q[k]) out.push(...q[k]); return out; };
    return Object.assign({ name, fam, path, m: ok[0].m, band: ok[0].band, inkPts: cat('inkPts'), lines: cat('lines'), shades: cat('shades'), cast: cat('cast'), lw: ok[0].lw, hi: ok[0].hi, hiA: ok[0].hiA }, extra);
  }
  const taperBoth = (a = 0.12, b = 0.12) => (u) => sstep(0, a, u) * sstep(0, b, 1 - u) * 0.85 + 0.15 * sstep(0, a * 0.5, u) * sstep(0, b * 0.5, 1 - u);

  /* ================================================================ figure builder */
  // G: per-figure build state: J (rig), V (body->view), Vr (rotation only), R (render ctx), parts per layer
  function newBuild(J, VM, R, o, sp) {
    const G = { J, R, o, sp, layers: {}, VM };
    G.V = (p) => mv(VM, p);
    G.Vr = (d) => mv(VM, d);
    G.P2 = (p) => { const v = mv(VM, p); return [v[0], v[1]]; };
    G.Z = (p) => mv(VM, p)[2];
    G.add = (layer, part) => { (G.layers[layer] || (G.layers[layer] = [])).push(part); return part; };
    return G;
  }

  /* ---------------------------------------------------------------- outfits */
  // Each outfit: garment flags used by the builders below.
  const OUTFITS = {
    senpai: {
      uniform: { top: 'blouse', tuck: true, sleeve: 'long', collar: 'blouse', ribbon: true, bottom: 'pleats', legs: 'socks', shoes: 'loafer' },
      blazer: { top: 'blouse', tuck: true, outer: 'blazer', sleeve: 'blazer', collar: 'blouse', ribbon: true, bottom: 'pleats', legs: 'socks', shoes: 'loafer' },
      dress: { top: 'dress', tuck: true, sleeve: 'cap', neckline: 'scoop', bottom: 'dress', legs: 'bare', shoes: 'pumps', necklace: true, waistSeam: true },
      dress_cardigan: { top: 'dress', tuck: true, outer: 'cardigan', sleeve: 'cardigan', neckline: 'scoop', bottom: 'dress', legs: 'bare', shoes: 'pumps', necklace: true, waistSeam: true },
      summer: { top: 'onepiece', tuck: true, sleeve: 'short', neckline: 'square', bottom: 'onepiece', legs: 'bare', shoes: 'sandal', hat: true, sash: true },
      gown: { top: 'pajama', tuck: false, sleeve: 'pajama', collar: 'pajama', bottom: 'pajama_pants', legs: 'pants', shoes: 'slipper', cast: true },
      home: { top: 'knit', tuck: false, sleeve: 'knit', neckline: 'crew', bottom: 'long_skirt', legs: 'bare', shoes: 'slipper' },
    },
    boy: {
      uniform: { top: 'shirt', tuck: true, sleeve: 'rolled', collar: 'open', tie: true, bottom: 'trousers', belt: true, legs: 'pants', shoes: 'loafer_dark' },
      blazer: { top: 'shirt', tuck: true, outer: 'blazer_boy', sleeve: 'blazer_boy', collar: 'open', tie: true, bottom: 'trousers', belt: true, legs: 'pants', shoes: 'loafer_dark' },
      tee: { top: 'tee', tuck: false, outer: 'open_shirt', sleeve: 'rolled_blue', neckline: 'crew', bottom: 'trousers', belt: true, legs: 'pants', shoes: 'sneaker' },
      jacket: { top: 'tee_black', tuck: false, outer: 'jacket', sleeve: 'jacket', neckline: 'crew', bottom: 'jeans', legs: 'pants', shoes: 'sneaker' },
      wet: { top: 'shirt', tuck: true, sleeve: 'rolled_wet', collar: 'open', bottom: 'trousers', belt: true, legs: 'pants', shoes: 'loafer_dark', wet: true, cling: true },
    },
    aunt: { coat: { top: 'turtle', tuck: true, outer: 'coat', sleeve: 'coat', neckline: 'turtle', bottom: null, legs: 'tights', shoes: 'boot' } },
  };
  const DEFAULT_OUTFIT = { senpai: 'uniform', boy: 'uniform', aunt: 'coat' };
  A.OUTFITS = OUTFITS;

  // torso garment rings (eased from the body rings)
  function bodyRing(sp, name, da = 0, db = 0, extra = {}) {
    const r = sp.rings[name]; return Object.assign({ f: r[0], y: r[1], a: r[2] + da, b: r[3] + db, cz: r[4] }, extra);
  }
  function torsoRings(G, kind) {
    const sp = G.sp, girl = sp.girl, br = (G.J.P.breath || 0) * 0.008;
    if (girl) {
      const ease = { blouse: [0.032, 0.03], dress: [0.012, 0.012], onepiece: [0.022, 0.02], pajama: [0.05, 0.045], knit: [0.075, 0.065], turtle: [0.025, 0.025] }[kind] || [0.03, 0.03];
      const [ea, eb] = ease;
      const rs = [
        bodyRing(sp, 'neck', ea * 1.1, eb * 1.1, { dip: kind === 'dress' || kind === 'onepiece' ? 0.12 : kind === 'knit' ? 0.07 : 0.045 }),
        bodyRing(sp, 'chestTop', ea + br, eb + br),
        bodyRing(sp, 'bust', ea + br, eb + br, kind === 'knit' ? { front: -0.01 } : {}),
        bodyRing(sp, 'underbust', ea + (kind === 'knit' ? 0.03 : 0.005), eb + 0.008),
        bodyRing(sp, 'waist', ea + (kind === 'blouse' ? 0.012 : kind === 'knit' ? 0.07 : 0.0), eb + (kind === 'blouse' ? 0.012 : kind === 'knit' ? 0.06 : 0.0)),
      ];
      if (kind === 'blouse') rs.push({ f: 'p', y: sp.waistY + 0.16, a: sp.rings.waist[2] + 0.06, b: sp.rings.waist[3] + 0.05, cz: 0 });
      else if (kind === 'knit' || kind === 'pajama') rs.push(bodyRing(sp, 'hipTop', ea + 0.02, eb + 0.02), bodyRing(sp, 'hip', ea, eb, { y: sp.rings.hip[1] - 0.06 }));
      else rs.push({ f: 'p', y: sp.waistY + 0.1, a: sp.rings.waist[2] + ea + 0.03, b: sp.rings.waist[3] + eb + 0.02, cz: 0 });
      return rs;
    }
    // boy / shirts
    const ease = G.OF && G.OF.cling ? [0.012, 0.012] : ({ shirt: [0.04, 0.035], tee: [0.035, 0.03], tee_black: [0.035, 0.03] }[kind] || [0.04, 0.035]);
    const [ea, eb] = ease;
    return [
      bodyRing(sp, 'neck', ea * 0.9, eb * 0.9, { dip: kind === 'shirt' ? 0.05 : 0.06 }),
      bodyRing(sp, 'chestTop', ea + br, eb + br),
      bodyRing(sp, 'chest', ea + br, eb + br),
      bodyRing(sp, 'lowChest', ea + 0.01, eb + 0.01),
      bodyRing(sp, 'waist', ea + 0.04, eb + 0.035),
      kind === 'shirt' || (G.OF && G.OF.tuck) ? bodyRing(sp, 'hipTop', ea + 0.02, eb + 0.02, { y: sp.rings.hipTop[1] + 0.06 })
        : bodyRing(sp, 'hip', ea + 0.025, eb + 0.025, { y: sp.rings.hip[1] + 0.13 }),   // untucked: the hem hangs over the hips
    ];
  }

  /* ---------------------------------------------------------------- neck */
  function buildNeck(G, layer) {
    const J = G.J, sp = G.sp, R = G.R, m = R.m('skin');
    const b = G.P2(J.neckBase), t3 = v3.add(J.neckTop, mv(J.Mn, [0, -0.1, 0])), t = G.P2(t3);
    const [r0, r1] = sp.neckR;
    const cap = capsule(b, t, [[0, r0, r0], [0.6, r1 * 1.0, r1], [1, r1, r1]]);
    const path = shape(cap.pts);
    // jaw shadow: the top of the neck is in the shade of the head, with a V pointing down on the shadow side
    const d = norm2(sub2(b, t)), nn = [d[1], -d[0]], L = hypot(b[0] - t[0], b[1] - t[1]);
    const ls = dot2([R.lx, R.ly], nn) >= 0 ? 1 : -1;  // +1: light on the nn side
    const W = r0 * 1.6, at = (f, w) => [t[0] + d[0] * L * f + nn[0] * w, t[1] + d[1] * L * f + nn[1] * w];
    const sh = shape([at(-0.1, -W), at(-0.1, W), at(ls > 0 ? 0.4 : 0.62, W), at(0.66, -ls * r0 * 0.15), at(ls > 0 ? 0.62 : 0.4, -W)]);
    return G.add(layer, { name: 'neck', fam: 'neck', path, m, band: r0 * 0.5, shades: [{ path: sh }], inkPts: [{ pts: cap.A.slice(2).reverse(), wf: taperBoth(0.3, 0.3) }, { pts: cap.B.slice(2).reverse(), wf: taperBoth(0.3, 0.3) }], lw: 0.85 });
  }

  /* ---------------------------------------------------------------- torso garment */
  function buildTorso(G, layer, kind, matName, opt = {}) {
    const J = G.J, R = G.R, sp = G.sp, m = R.m(matName, opt.wet);
    const rings = opt.rings || torsoRings(G, kind);
    const rs = rings.map(r => ringSample(G, r, 24));
    // shoulders: the trapezius slope from the neck to each acromion (only where it lies outside the neck ring)
    const base = loftOutline(rs, { topArc: false, botArc: false });
    const n = base.n, nt = base.Rx[0].pt, ntL = base.Lx[0].pt;
    const ac = ['L', 'R'].map(s => { const p = G.P2(v3.add(J['Ac' + s], [0, -0.012, 0])); return { s, p, d: dot2(p, n) }; }).sort((a, b) => b.d - a.d);
    const insR = [], insL = [];
    const shoulderUp = opt.shoulderUp || 0.02;
    if (ac[0].d > dot2(nt, n) + 0.04) { const mid = lerp2(nt, ac[0].p, 0.45); insR.push([mid[0], mid[1] - shoulderUp - 0.012]); insR.push(ac[0].p); }
    if (ac[1].d < dot2(ntL, n) - 0.04) { const mid = lerp2(ntL, ac[1].p, 0.45); insL.push(ac[1].p); insL.push([mid[0], mid[1] - shoulderUp - 0.012]); }
    const ol = loftOutline(rs, { insR, insL, topArc: true, botArc: true });
    const path = shape(ol.pts);
    const part = G.add(layer, { name: 'torso', fam: 'torso', path, m, band: opt.band ?? 0.11, bandDir: 'x', rs, ol, cast: [], shades: [], lines: [], rings });
    return part;
  }

  function torsoDetails(G, torso, kind) {
    const sp = G.sp, rs = torso.rings, fz = facing(G, 'c', [0, 0, 1]);
    const find = (y) => { let best = 1; for (let i = 1; i < rs.length; i++) if (abs(rs[i].y - y) < abs(rs[best].y - y)) best = i; return best; };
    if (sp.girl && (kind === 'blouse' || kind === 'dress' || kind === 'onepiece' || kind === 'pajama' || kind === 'knit')) {
      // under-bust: a crescent of shade under each breast, stronger on the side away from the light
      const iB = find(sp.rings.bust[1]), iU = find(sp.rings.underbust[1]);
      const rB = rs[iB], rU = rs[iU];
      const soft = kind === 'knit' || kind === 'pajama' ? 0.45 : 1;
      for (const sg of [1, -1]) {
        const ph = (d) => 90 - sg * d;
        if (nzAt(G, 'c', ph(40)) < 0.05) continue;
        const pts = [surfPt(G, rB, rU, 0.45, ph(8), 0.004), surfPt(G, rB, rU, 0.62, ph(30), 0.004), surfPt(G, rB, rU, 0.62, ph(52), 0.004), surfPt(G, rB, rU, 0.5, ph(76), 0.004),
          surfPt(G, rB, rU, 0.82, ph(62), 0.004), surfPt(G, rB, rU, 0.95, ph(36), 0.004), surfPt(G, rB, rU, 0.78, ph(14), 0.004)].map(G.P2);
        const lit = dot2([G.R.lx, G.R.ly], sub2(pts[3], pts[0])) > 0;
        torso.shades.push({ path: shape(pts), a: (lit ? 0.45 : 0.9) * soft });
      }
    }
    if (kind === 'blouse' || kind === 'shirt') {
      // tucked in: a few short folds rising from the waistband
      const iW = find(sp.waistY);
      const rW = rs[iW], rUp = rs[max(1, iW - 1)];
      const yb = kind === 'shirt' ? 0 : 0;
      for (const d of [-62, -30, 24, 58]) {
        if (nzAt(G, rW.f, 90 + d) < 0.15) continue;
        const a = surfPt(G, rW, rs[min(rs.length - 1, iW + 1)], 0.15 + yb, 90 + d, 0.004), b = surfPt(G, rUp, rW, 0.55, 90 + d * 1.15, 0.004);
        torso.lines.push({ pts: [G.P2(a), lerp2(G.P2(a), G.P2(b), 0.5), G.P2(b)], w: 0.5, w0: 0.6, w1: 0.05, a: 0.55 });
      }
    }
    void fz;
  }

  /* ---------------------------------------------------------------- blouse collar, ribbon, placket */
  function collarBlouse(G, layer, torso, opt = {}) {
    const R = G.R, m = R.m(opt.mat || 'blouse', opt.wet), r = torso.rings[0];
    const yN = r.y, parts = [];
    const fz = facing(G, 'c', [0, 0, 1]);
    // back band (stand collar hugging the back of the neck)
    const nr = G.sp.neckR[0], rb = Object.assign({}, r, { a: nr + 0.03, b: nr + 0.028, dip: 0 });
    const band = [];
    for (let a = 40; a >= -220; a -= 20) band.push(G.P2(ringPoint(G, rb, a, yN - 0.07, 0.0)));
    for (let a = -220; a <= 40; a += 20) band.push(G.P2(ringPoint(G, rb, a, yN + 0.01, 0.0)));
    const backBand = { name: 'collarBack', fam: 'collarB', path: shape(band), m, band: 0.03, lw: 0.8 };
    const r1 = torso.rings[1];
    for (const sg of [1, -1]) {
      const ph = (d) => 90 - sg * d;
      const pts3 = [ringPoint(G, r, ph(3), yN - 0.06, 0.012), ringPoint(G, r, ph(60), yN - 0.085, 0.012), ringPoint(G, r, ph(82), yN + 0.005, 0.02),
        surfPt(G, r, r1, 0.3, ph(57), 0.035), [...surfPt(G, r, r1, 0.43, ph(37), 0.045), 1], surfPt(G, r, r1, 0.22, ph(13), 0.035), ringPoint(G, r, ph(4), yN + 0.035, 0.025)];
      const nz = nzAt(G, 'c', ph(40));
      if (nz < -0.3) continue;
      const pts = pts3.map(q => { const v = G.P2(q); return q[3] ? [v[0], v[1], 1] : v; });
      const p = { name: 'collar' + sg, fam: 'collar' + sg, path: shape(pts), m, band: 0.04, lw: 0.85, z: nz };
      p.lines = [{ pts: [lerp2(pts[0], pts[1], 0.25), lerp2(pts[2], pts[3], 0.2)], w: 0.55, a: 0.6 }];   // the roll line of the collar
      parts.push(p);
    }
    parts.sort((a, b) => a.z - b.z);
    return { backBand, flaps: parts, front: fz };
  }
  function ribbonBow(G, layer, torso, opt = {}) {
    const R = G.R, m = R.m('ribbon'), r = torso.rings[0];
    const c3 = surfPt(G, r, torso.rings[1], 0.1, 90, 0.06);
    const ex = G.Vr(mv(G.J.F.c.M, [1, 0, 0])), ey = G.Vr(mv(G.J.F.c.M, [0, 1, 0])), ez = G.Vr(mv(G.J.F.c.M, [0, 0, 1]));
    if (ez[2] < -0.05) return null;
    const c = G.P2(c3), sw = opt.size || 0.8;
    const T = (x, y) => [c[0] + (ex[0] * x + ey[0] * y) * sw, c[1] + (ex[1] * x + ey[1] * y) * sw];
    const loopL = [T(0, 0), T(-0.05, -0.045), T(-0.12, -0.062), [...T(-0.165, -0.035), 0], T(-0.16, 0.025), T(-0.11, 0.05), T(-0.045, 0.03)];
    const LX = [0, -0.05, -0.12, -0.165, -0.16, -0.11, -0.045], LY = [0, -0.045, -0.062, -0.035, 0.025, 0.05, 0.03];
    const loopR = LX.map((x, i) => T(-x, LY[i]));
    const sway = opt.sway || 0;
    const tailL = [T(-0.02, 0.015), T(-0.07 + sway, 0.12), T(-0.1 + sway * 1.4, 0.215), [...T(-0.075 + sway * 1.4, 0.2), 1], [...T(-0.055 + sway * 1.4, 0.228), 1], T(-0.04 + sway, 0.13), T(0.005, 0.02)];
    const tailR = [T(0.02, 0.015), T(0.06 + sway, 0.13), T(0.085 + sway * 1.4, 0.225), [...T(0.062 + sway * 1.4, 0.206), 1], [...T(0.04 + sway * 1.4, 0.232), 1], T(0.03 + sway, 0.135), T(-0.005, 0.02)];
    const knot = [T(-0.032, -0.03), T(0.032, -0.03), T(0.036, 0.028), T(-0.036, 0.028)];
    const P = (pts) => shape(pts);
    const parts = [
      { name: 'ribTailL', fam: 'rib1', path: P(tailL), m, band: 0.03, lw: 0.75 },
      { name: 'ribTailR', fam: 'rib2', path: P(tailR), m, band: 0.03, lw: 0.75 },
      { name: 'ribLoopL', fam: 'rib3', path: P(loopL), m, band: 0.035, lw: 0.75, lines: [{ pts: [T(-0.03, -0.004), T(-0.09, -0.01), T(-0.13, -0.005)], w: 0.55 }] },
      { name: 'ribLoopR', fam: 'rib4', path: P(loopR), m, band: 0.035, lw: 0.75, lines: [{ pts: [T(0.03, -0.004), T(0.09, -0.01), T(0.13, -0.005)], w: 0.55 }] },
      { name: 'ribKnot', fam: 'rib5', path: P(knot), m, band: 0.02, lw: 0.75 },
    ];
    return { parts, all: (() => { const p = new Path2D(); for (const q of parts) p.addPath(q.path); return p; })() };
  }
  // front placket line + buttons down the centre of the chest
  function placket(G, torso, opt = {}) {
    const rs = torso.rings, pts = [], btn = [];
    const fz = facing(G, 'c', [0, 0, 1]);
    if (fz < 0.05) return [];
    const ys = opt.ys || rs.map(r => r.y);
    for (let i = 0; i < rs.length - 1; i++) {
      const r = rs[i];
      pts.push(G.P2(ringPoint(G, r, 90 + (opt.off || 0), r.y + (i === 0 ? (opt.top || 0.12) : 0), 0.004)));
    }
    const lines = [{ pts, w: 0.75, w0: 0.3, w1: 0.6, a: 0.85 }];
    return lines;
  }

  /* ---------------------------------------------------------------- skirts (pleated / dress / flared / long) */
  // A skirt hangs from the waist ring; each hem point drops along gravity, flares, and is pushed by the thighs when seated
  // (o.seat), by the knees when walking, and by the wind (screen-space vector). Pleats alternate the hem radius.
  function buildSkirt(G, layer, kind, opt = {}) {
    const J = G.J, R = G.R, sp = G.sp, o = G.o, tq = opt.tq || 0;
    const mat = { pleats: 'skirt', dress: 'dress', onepiece: 'onepiece', long_skirt: 'long_skirt', coat_skirt: 'coat', knit: 'knit' }[kind] || 'skirt';
    const m = R.m(mat, opt.wet);
    const pleated = kind === 'pleats';
    const N = pleated ? 32 : 24;
    const wr = sp.rings.waist, hr = sp.rings.hip;
    const len = opt.len ?? { pleats: 1.95, dress: 2.15, onepiece: 2.75, long_skirt: 3.2, coat_skirt: 3.0 }[kind] ?? 2.0;
    const flare = opt.flare ?? { pleats: 0.11, dress: 0.1, onepiece: 0.36, long_skirt: 0.22, coat_skirt: 0.1 }[kind] ?? 0.1;
    const yW = (opt.waistY ?? sp.waistY) - 0.02;
    const waist = { f: 'w', y: yW, a: wr[2] + (opt.waistEase ?? 0.035), b: wr[3] + (opt.waistEase ?? 0.035) * 0.9, cz: 0 };
    const hipR = { f: 'p', y: hr[1] - 0.06, a: hr[2] + 0.035, b: hr[3] + 0.045, cz: hr[4] };
    const upHip = { f: 'p', y: lerp(yW, hipR.y, 0.5), a: lerp(waist.a, hipR.a, 0.72), b: lerp(waist.b, hipR.b, 0.72), cz: hr[4] * 0.5 };
    // hem points in body space
    const pF = J.F.p, down = [0, 1, 0];
    const seated = opt.seat; // {knees: [KL, KR] body space, hips: [HL, HR]}
    const wind = opt.wind || 0, wd = opt.windDir ?? 0;
    // wind as a body-space vector (screen direction mapped back through the facing rotation)
    const wv = G.toBody([cos(wd), sin(wd) * 0.6, 0]);
    const hem = [], mid = [];
    for (let k = 0; k < N; k++) {
      const ph = (k / N) * TAU, c = cos(ph), s = sin(ph);
      const hp = v3.add(pF.o, mv(pF.M, [hipR.a * c, hipR.y - pF.y0, hipR.cz + hipR.b * s]));
      const radial = v3.norm(mv(pF.M, [c, 0, s]));
      const pl = pleated ? (k % 2 === 0 ? 1 : -1) : 0;
      const L = len - (hipR.y - yW);
      let dir = mv(pF.M, down);
      let reach = L, spread = flare;
      let seatedHem = null;
      if (seated) {
        // the cloth runs along the thigh (front zone farther, sides less, back stays on the seat), then the remaining length
        // falls under gravity: clamped at the seat for the sides / back, down to the shins for the front (in front of the seat)
        let td = null, fwd = -1, sd0 = 'L';
        for (const sd of ['L', 'R']) {
          const th = v3.norm(v3.sub(J['K' + sd], J['H' + sd])), thf = v3.norm([th[0], 0, th[2]]), d = v3.dot(radial, thf);
          if (d > fwd) { fwd = d; td = th; sd0 = sd; }
        }
        const seatY = opt.seatY ?? 0, thR = sp.girl ? 0.15 : 0.18;
        const front = sstep(0.2, 0.85, fwd), back = sstep(0.0, -0.6, fwd);
        const reachMax = sp.thigh * 0.95 + 0.1;
        const along = min(reachMax, (L + 0.25) * lerp(0.1, 0.9, sstep(-0.55, 0.75, fwd)));
        const p0 = v3.add(hp, v3.mul(td, along));
        const rem = max(0, L - along) * 0.85;
        const floorY = max(J['A' + sd0][1], seatY) - 0.08;
        const seatDrop = max(0.04, seatY + 0.02 - p0[1]);
        const dropSide = clamp(rem, min(thR + 0.06, seatDrop), max(min(thR + 0.06, seatDrop), seatDrop));
        const dropFront = clamp(rem + 0.06, 0.06, max(0.06, floorY - p0[1]));
        const drop = lerp(lerp(dropSide, dropFront, front), seatDrop, back);
        seatedHem = v3.add(p0, v3.add(v3.mul(radial, flare * lerp(0.6, 0.25, back) + pl * 0.02), [0, drop, rem > 0.2 && front > 0.5 ? 0.08 : 0]));
        if (back > 0.5) seatedHem[1] = min(seatedHem[1], seatY + 0.03);
      }
      let h = seatedHem || v3.add(hp, v3.add(v3.mul(dir, reach), v3.mul(radial, spread + pl * (pleated ? 0.028 : 0))));
      if (pleated && pl < 0) h = v3.add(h, [0, -0.025, 0]);
      // wind: leeward side billows, windward side presses on the legs; on twos
      if (wind > 0) {
        const lee = clamp(0.5 + 0.5 * v3.dot(radial, v3.norm(wv)) * 1.4);
        const n1 = N2(k * 0.37 + 3.1, tq * 1.7), n2 = N2(k * 0.21 + 9.7, tq * 2.9);
        const amp = wind * (0.12 + 0.3 * lee) * (1 + 0.25 * n1);
        h = v3.add(h, v3.add(v3.mul(wv, amp), [0, -wind * 0.06 * lee * (1 + n2) * (seated ? 0 : 1), 0]));
        h = v3.add(h, v3.mul(radial, 0.03 * wind * n2));
      }
      if (opt.knees) { // walking/running: the forward knee pushes the hem
        for (const Kk of opt.knees) {
          const dk = v3.sub(h, Kk); const d = hypot(dk[0], dk[2]);
          if (Kk[1] - 0.25 < h[1] && d < 0.35) h = v3.add(h, v3.mul(v3.norm([dk[0], 0, dk[2]]), (0.35 - d) * 0.8));
        }
      }
      hem.push(h);
      mid.push(seated ? v3.add(v3.lerp(hp, h, 0.5), [0, -0.04, 0]) : v3.lerp(hp, h, 0.5));
    }
    const proj = (arr) => { const P2 = [], Z = []; for (const p of arr) { const v = G.V(p); P2.push([v[0], v[1]]); Z.push(v[2]); } return { P2, Z }; };
    const rW = ringSample(G, waist, N), rUH = ringSample(G, upHip, N), rH = ringSample(G, hipR, N), rHem = proj(hem), rMid = proj(mid);
    const rs = [rW, rUH, rH, rMid, rHem], iHem = rs.length - 1;
    const ol = loftOutline(rs, { sharpBot: true, sharpTop: true, topArc: true });
    const path = shape(ol.pts);
    const part = G.add(layer, { name: 'skirt', fam: 'skirt', path, m, band: opt.band ?? 0.13, bandDir: 'x', lw: 1, rs, hem: rHem, ol, lines: [], shades: [], cast: [] });
    // pleats: fold lines + alternating shaded strips on the near side
    const nearK = nearIdx(rHem, ol.Rx[iHem].k, ol.Lx[iHem].k);
    if (pleated) {
      const strips = new Path2D();
      for (let i = 0; i < nearK.length; i++) {
        const k = nearK[i], k2 = (k + 1) % N;
        if (!nearK.includes(k2) && k2 !== ol.Lx[iHem].k && k2 !== ol.Rx[iHem].k) continue;
        const a0 = rH.P2[k], a1 = rH.P2[k2], b0 = rHem.P2[k], b1 = rHem.P2[k2];
        if (k % 2 === 1) { strips.moveTo(a0[0], a0[1]); strips.lineTo(a1[0], a1[1]); strips.lineTo(b1[0], b1[1] + 0.02); strips.lineTo(b0[0], b0[1] + 0.02); strips.closePath(); }
      }
      part.shades.push({ path: strips, a: 0.55 });
      for (const k of nearK) if (k % 2 === 0) {
        const top = lerp2(rW.P2[k], rH.P2[k], 0.55), bot = rHem.P2[k];
        part.lines.push({ pts: [top, lerp2(top, bot, 0.5), bot], w: 0.6, w0: 0.05, w1: 0.5, a: 0.75 });
      }
    } else {
      // soft folds: a few long lines from the hip to the hem, more at the flare
      for (const k of nearK) if (k % 4 === 1) {
        const top = lerp2(rH.P2[k], rHem.P2[k], 0.35), bot = rHem.P2[k];
        part.lines.push({ pts: [top, lerp2(top, bot, 0.6), bot], w: 0.5, w0: 0.02, w1: 0.4, a: 0.55 });
      }
    }
    // waistband
    if (opt.waistband !== false) {
      const wb = { f: 'w', y: yW + 0.07, a: waist.a + 0.004, b: waist.b + 0.004, cz: 0 };
      const rB = ringSample(G, wb, N);
      const ex = loftOutline([rB, rH], {});
      const idx = nearIdx(rB, ex.Rx[0].k, ex.Lx[0].k).map(i => rB.P2[i]);
      if (idx.length > 2) part.lines.push({ pts: [ex.Rx[0].pt].concat(idx, [ex.Lx[0].pt]), w: 0.65, w0: 0.5, w1: 0.5, a: 0.85 });
    }
    return part;
  }

  /* ---------------------------------------------------------------- legs, socks, trousers, shoes */
  // per-side widths of a leg segment from its 3D 'front' vector
  // per-side widths of a limb segment: prof rows [f, outer, inner, front, back]; fr3 = anatomical front, out3 = lateral outward
  function legProf(G, p0, p1, fr3, prof, out3) {
    const a = G.P2(p0), b = G.P2(p1), d = norm2(sub2(b, a)), nA = [d[1], -d[0]];
    const f = G.Vr(fr3), o = G.Vr(out3 || [1, 0, 0]);
    const cF = dot2(nA, [f[0], f[1]]), cO = dot2(nA, [o[0], o[1]]);
    const kF = cF * cF, kO = cO * cO, sum = kF + kO || 1;
    const side = (sF, sO) => (row) => {
      const [, wo, wi, wf, wb] = row;
      return ((sF > 0 ? wf : wb) * kF + (sO > 0 ? wo : wi) * kO) / sum;
    };
    const wa = side(cF, cO), wb = side(-cF, -cO);
    return prof.map((row) => [row[0], wa(row), wb(row)]);
  }
  function shoeShape(G, side, kind) {
    const J = G.J, sp = G.sp, An = J['A' + side], ft = J['foot' + side] || {};
    const sg = side === 'L' ? 1 : -1;
    // foot frame: fwd (toe direction, may point down for a pointed foot), lat (to the foot's side), up (instep normal)
    const raw = ft.dir || mv(J.F.p.M, [sg * 0.16, 0, 1]);
    const flat = v3.norm([raw[0], 0, raw[2]]);
    const lat = v3.norm(v3.cross([0, -1, 0], flat));
    const fwd = v3.norm(raw), up = v3.norm(v3.cross(fwd, lat));
    const Lf = sp.foot, h = sp.ankleH;
    // heel lift (pumps / tiptoe): the sole rises toward the heel, the ball stays where it is
    const heelLift = (kind === 'pumps' ? 0.1 : kind === 'boot' ? 0.03 : 0.0) + (ft.tip || 0) * 0.3;
    const P = (f, u, s) => {
      const lift = heelLift * clamp((0.5 - f) / 0.7);
      return v3.add(An, v3.add(v3.add(v3.mul(fwd, f * Lf), v3.mul(up, u - h + lift)), v3.mul(lat, s)));
    };
    const W = sp.girl ? 0.075 : 0.09;
    const pts3 = [
      P(-0.2, 0.0, -W * 0.7), P(-0.2, 0.0, W * 0.7), P(-0.22, 0.12, -W * 0.6), P(-0.22, 0.12, W * 0.6), P(-0.16, 0.24, 0), // heel
      P(0.15, 0.0, -W), P(0.15, 0.0, W), P(0.45, 0.0, -W * 1.05), P(0.45, 0.0, W * 1.05), P(0.72, 0.0, -W * 0.75), P(0.72, 0.0, W * 0.75), P(0.8, 0.03, 0), // sole
      P(0.78, 0.09, -W * 0.5), P(0.78, 0.09, W * 0.5), P(0.55, 0.15, -W * 0.8), P(0.55, 0.15, W * 0.8), P(0.25, 0.2, -W * 0.65), P(0.25, 0.2, W * 0.65), // toe box / vamp
      P(0.0, 0.25, -W * 0.6), P(0.0, 0.25, W * 0.6), P(0.05, 0.2, 0),
    ];
    if (kind === 'boot') pts3.push(P(-0.15, 0.55, -W * 0.85), P(-0.15, 0.55, W * 0.85), P(0.15, 0.55, -W * 0.8), P(0.15, 0.55, W * 0.8));
    const P2 = pts3.map(G.P2);
    const hl = hull(P2);
    return { hull: hl, P2, pts3, fwd: flat, lat, W, Lf, P, An };
  }
  function buildShoe(G, layer, side, kind) {
    const R = G.R, mat = { loafer: 'shoe', loafer_dark: 'shoe', pumps: 'pumps', sandal: 'sandal', slipper: 'slipper', sneaker: 'sneaker', boot: 'boot' }[kind] || 'shoe';
    const m = R.m(mat);
    const S = shoeShape(G, side, kind);
    const path = shape(S.hull, 0.9);
    const part = { name: 'shoe' + side, fam: 'shoe' + side, path, m, band: 0.05, hi: kind === 'loafer' || kind === 'loafer_dark' || kind === 'pumps' || kind === 'boot' ? 0.022 : 0, hiA: 0.8, lines: [] };
    // sole edge
    const sole = [S.P(-0.2, 0.035, 0), S.P(0.2, 0.035, 0), S.P(0.6, 0.035, 0), S.P(0.78, 0.05, 0)].map(G.P2);
    const solePts = [S.P(-0.21, 0.0, -S.W * 0.75), S.P(-0.21, 0.0, S.W * 0.75), S.P(0.8, 0.0, -S.W * 0.8), S.P(0.8, 0.0, S.W * 0.8), S.P(0.82, 0.04, 0), S.P(-0.22, 0.04, 0),
      S.P(0.45, 0.0, -S.W * 1.08), S.P(0.45, 0.0, S.W * 1.08), S.P(0.45, 0.045, -S.W * 1.08), S.P(0.45, 0.045, S.W * 1.08), S.P(-0.21, 0.045, -S.W * 0.75), S.P(-0.21, 0.045, S.W * 0.75), S.P(0.8, 0.045, -S.W * 0.8), S.P(0.8, 0.045, S.W * 0.8)].map(G.P2);
    const soleH = hull(solePts);
    const sm = kind === 'sneaker' ? R.m('sole') : null;
    part.shades = [{ path: shape(soleH, 0.9), col: sm ? sm.base : m.deep }];
    // the opening / strap (loafer) on the near side
    if (kind === 'loafer' || kind === 'loafer_dark') {
      const s1 = [S.P(0.3, 0.17, -S.W * 0.85), S.P(0.34, 0.185, 0), S.P(0.3, 0.17, S.W * 0.85)].map(G.P2);
      part.lines.push({ pts: s1, w: 0.7, a: 0.85 });
    }
    if (kind === 'sneaker') {
      part.lines.push({ pts: [S.P(0.08, 0.2, 0), S.P(0.38, 0.15, 0)].map(G.P2), w: 0.6, a: 0.6 });
    }
    void sole;
    return G.add(layer, part);
  }
  function buildLeg(G, layer, side, kind, opt = {}) {
    const J = G.J, R = G.R, sp = G.sp, sg = side === 'L' ? 1 : -1;
    const Hh = J['H' + side], K = J['K' + side], An = J['A' + side];
    // anatomical front of each segment (perpendicular to the bone, toward the knee cap / the toes) and the lateral side
    const toe = (J['foot' + side] && J['foot' + side].dir) || mv(J.F.p.M, [0, 0, 1]);
    const frontOf = (a, b, hint) => { const d = v3.norm(v3.sub(b, a)); const f = v3.sub(hint, v3.mul(d, v3.dot(hint, d))); return v3.norm(f); };
    const kneeOut = v3.sub(K, v3.lerp(Hh, An, 0.5));            // a bent knee points this way
    const fThigh = frontOf(Hh, K, v3.add(mv(J.F.p.M, [0, 0, 1]), v3.mul(kneeOut, 2)));
    const fShin = frontOf(K, An, v3.add(v3.norm(toe), v3.mul(kneeOut, 1.5)));
    const outT = v3.norm(v3.cross(v3.sub(K, Hh), fThigh)), outS = v3.norm(v3.cross(v3.sub(An, K), fShin));
    const oT = v3.dot(outT, mv(J.F.p.M, [sg, 0, 0])) >= 0 ? outT : v3.mul(outT, -1);
    const oS = v3.dot(outS, mv(J.F.p.M, [sg, 0, 0])) >= 0 ? outS : v3.mul(outS, -1);
    const pants = kind === 'pants' || kind === 'jeans';
    const out = [];
    const dkv = (k, e) => { const d = norm2(sub2(e, k)); return [d, [d[1], -d[0]]]; };
    if (pants) {
      const mat = opt.mat || 'trousers', m = R.m(mat, opt.wet);
      const tW = opt.thighW || (sp.girl ? [[0, 0.2, 0.19, 0.2, 0.2], [0.5, 0.172, 0.165, 0.17, 0.17], [1, 0.142, 0.138, 0.14, 0.14]]
        : [[0, 0.22, 0.205, 0.215, 0.215], [0.5, 0.19, 0.18, 0.19, 0.185], [1, 0.162, 0.155, 0.16, 0.158]]);
      const sW = opt.shinW || (sp.girl ? [[0, 0.142, 0.138, 0.14, 0.14], [0.6, 0.132, 0.128, 0.13, 0.13], [1, 0.136, 0.132, 0.135, 0.135]]
        : [[0, 0.158, 0.152, 0.156, 0.158], [0.5, 0.15, 0.144, 0.148, 0.15], [0.9, 0.146, 0.142, 0.145, 0.145], [1, 0.152, 0.148, 0.15, 0.15]]);
      const a = G.P2(Hh), k = G.P2(K), e = G.P2(v3.add(An, [0, 0.04, 0]));
      const LL = limb2(a, k, e, legProf(G, Hh, K, fThigh, tW, oT), legProf(G, K, An, fShin, sW, oS), { capK: 0.3, f0: 0.3 });
      const pThigh = { name: 'leg' + side, fam: 'leg' + side, path: shape(LL.pts), m, band: 0.09, inkPts: [{ pts: LL.ink, wf: taperBoth(0.12, 0.06) }], lines: [], cast: [] };
      const pShin = pThigh;
      const [dk, nk] = dkv(k, e), wk = profAt(tW, 1)[0];
      const bent = 1 - clamp(v3.dot(v3.norm(v3.sub(K, Hh)), v3.norm(v3.sub(An, K))));
      // knee folds (a pair of short curved lines; more when bent), the front crease, the break above the shoe
      const kf = 1 + bent * 2;
      pThigh.lines.push({ pts: [add2(add2(k, mul2(dk, -0.2)), mul2(nk, wk * 0.55)), add2(add2(k, mul2(dk, -0.09)), mul2(nk, wk * 0.1)), add2(add2(k, mul2(dk, -0.05 * kf)), mul2(nk, -wk * 0.45))], w: 0.6, a: 0.65 });
      pShin.lines.push({ pts: [add2(add2(k, mul2(dk, 0.05)), mul2(nk, -wk * 0.6)), add2(add2(k, mul2(dk, 0.11)), mul2(nk, -wk * 0.05)), add2(add2(k, mul2(dk, 0.2)), mul2(nk, wk * 0.35))], w: 0.5, a: 0.55 });
      pShin.lines.push({ pts: [add2(add2(e, mul2(dk, -0.24)), mul2(nk, wk * 0.85)), add2(add2(e, mul2(dk, -0.15)), mul2(nk, 0.05)), add2(add2(e, mul2(dk, -0.2)), mul2(nk, -wk * 0.6))], w: 0.55, a: 0.6 });
      const fz = G.Vr(fThigh)[2];
      if (fz > 0.35) { // the pressed crease down the front
        const c0 = lerp2(a, k, 0.25), c9 = lerp2(k, e, 0.82);
        pThigh.lines.push({ pts: [c0, lerp2(c0, k, 0.5), k], w: 0.4, a: 0.35 });
        pShin.lines.push({ pts: [k, lerp2(k, c9, 0.5), c9], w: 0.4, a: 0.35 });
      }
      out.push(pThigh);
      return { parts: out };
    }
    // bare legs (+ socks / tights)
    const mat = kind === 'tights' ? 'tights' : 'skin';
    const m = R.m(mat);
    const a = G.P2(Hh), k = G.P2(K), e = G.P2(An);
    const tProf = legProf(G, Hh, K, fThigh, sp.thighW, oT), sProf = legProf(G, K, An, fShin, sp.shinW, oS);
    const LL = limb2(a, k, e, tProf, sProf, { f0: 0.35 });
    const pThigh = { name: 'leg' + side, fam: 'leg' + side, path: shape(LL.pts), m, band: 0.055, inkPts: [{ pts: LL.ink, wf: taperBoth(0.12, 0.06) }], cast: [], lines: [] };
    const pShin = pThigh;
    // knee: two short soft lines (the under-edge of the knee cap and the inner knee) in front-ish views
    const [dk, nk] = dkv(k, e);
    const fv = G.Vr(fShin), ov = G.Vr(oS), nIn = dot2(nk, [ov[0], ov[1]]) > 0 ? -1 : 1;   // nk * nIn points to the inner side
    if (fv[2] > 0.45) {
      pShin.lines.push({ pts: [add2(add2(k, mul2(dk, 0.03)), mul2(nk, -nIn * 0.035)), add2(add2(k, mul2(dk, 0.07)), mul2(nk, nIn * 0.005)), add2(add2(k, mul2(dk, 0.05)), mul2(nk, nIn * 0.04))], w: 0.45, a: 0.5 });
      pThigh.lines.push({ pts: [add2(add2(k, mul2(dk, -0.12)), mul2(nk, nIn * 0.075)), add2(add2(k, mul2(dk, -0.04)), mul2(nk, nIn * 0.082))], w: 0.4, a: 0.45 });
    }
    out.push(pThigh);
    if (kind === 'socks') {
      const ms = R.m(opt.sockMat || 'sock');
      const f0 = opt.sockTop ?? 0.17;
      const s0 = lerp2(k, e, f0);
      const sub = sProf.filter(q => q[0] > f0).map(([u, wa, wb]) => [(u - f0) / (1 - f0), wa + 0.007, wb + 0.007]);
      const w0 = profAt(sProf, f0); sub.unshift([0, w0[0] + 0.01, w0[1] + 0.01]);
      const c3 = capsule(s0, e, sub, { capK: 0.4 });
      const pSock = { name: 'sock' + side, fam: 'sock' + side, path: shape(c3.pts), m: ms, band: 0.045, hi: 0.014, hiA: 0.35, lines: [] };
      const [d2, n2] = dkv(s0, e);
      const tb = add2(s0, mul2(d2, 0.065));
      pSock.lines.push({ pts: [add2(tb, mul2(n2, w0[0] * 0.95)), add2(add2(tb, mul2(d2, 0.014)), mul2(n2, 0)), add2(tb, mul2(n2, -w0[1] * 0.95))], w: 0.5, a: 0.6 });
      out.push(pSock);
    }
    return { parts: out };
  }

  /* ---------------------------------------------------------------- arms, sleeves, hands */
  function armFront(G, S, E, W) { // a direction perpendicular to the upper arm (for per-side profiles: symmetric for now)
    return null;
  }
  const SLEEVES = {
    long: { up: 0.03, fore: 0.028, to: 1.0, cuff: 0.11, cuffW: 0.012, mat: null },
    blazer: { up: 0.052, fore: 0.048, to: 0.93, cuff: 0, mat: 'blazer', under: 'blouse', underCuff: 0.1 },
    rolled: { up: 0.034, fore: 0.032, to: 0.42, roll: 0.11, mat: null },
    rolled_blue: { up: 0.045, fore: 0.04, to: 0.4, roll: 0.11, mat: 'shirt_blue' },
    rolled_wet: { up: 0.018, fore: 0.016, to: 0.44, roll: 0.09, mat: null },
    cap: { up: 0.03, to: -0.28, mat: null },        // negative: ends on the upper arm at 28%
    short: { up: 0.035, to: -0.4, mat: null, flutter: 0.035 },
    cardigan: { up: 0.045, fore: 0.04, to: 1.03, cuff: 0.1, cuffW: 0.008, mat: 'cardigan', rib: true },
    pajama: { up: 0.05, fore: 0.05, to: 1.0, cuff: 0.0, mat: null },
    pajama_elbow: { up: 0.05, fore: 0.05, to: 0.14, roll: 0.06, mat: null },
    knit: { up: 0.07, fore: 0.065, to: 1.12, cuff: 0.12, cuffW: 0.0, mat: null, rib: true },
    jacket: { up: 0.055, fore: 0.05, to: 0.98, cuff: 0.08, cuffW: 0.006, mat: 'jacket' },
    coat: { up: 0.055, fore: 0.05, to: 0.98, cuff: 0.0, mat: 'coat' },
    blazer_boy: { up: 0.055, fore: 0.05, to: 0.94, cuff: 0, mat: 'blazer', under: 'shirt', underCuff: 0.0 },
  };
  function buildArm(G, layer, side, sleeveKind, topMat, opt = {}) {
    const J = G.J, R = G.R, sp = G.sp;
    const S3 = J['S' + side], E3 = J['E' + side], W3 = J['W' + side];
    const S = G.P2(S3), E = G.P2(E3), W = G.P2(W3);
    const sl = SLEEVES[sleeveKind] || SLEEVES.long;
    const mS = R.m(sl.mat || topMat, opt.wet), mSkin = R.m('skin');
    const fam = 'arm' + side, parts = [];
    const up = sp.upW, fo = sp.foreW;
    const prof2 = (P, e) => P.map(([f, w]) => [f, w + e, w + e]);
    // bare skin first (under the sleeves)
    const cU = capsule(S, E, prof2(up, 0)), cF = capsule(E, W, prof2(fo, 0));
    const skinUp = { name: 'upSkin' + side, fam, path: shape(cU.pts), m: mSkin, band: 0.045, inkPts: [{ pts: capsuleInk(cU, 0.3), wf: taperBoth(0.2, 0.2) }] };
    const skinFo = { name: 'foSkin' + side, fam, path: shape(cF.pts), m: mSkin, band: 0.04, inkPts: [{ pts: capsuleInk(cF, 0.3), wf: taperBoth(0.2, 0.2) }] };
    const bareFore = sl.to < 1 && sl.to >= 0 || sl.to < 0, bareUp = sl.to < 0;
    if (bareUp) { const LA = limb2(S, E, W, prof2(up, 0), prof2(fo, 0), { f0: 0.3 }); parts.push({ name: 'upSkin' + side, fam, path: shape(LA.pts), m: mSkin, band: 0.045, inkPts: [{ pts: LA.ink, wf: taperBoth(0.15, 0.08) }] }); }
    else if (bareFore || sl.to < 1) parts.push(skinFo);
    void skinUp;
    // hand
    const hand = buildHand(G, side, opt);
    // sleeves
    if (sl.to < 0) { // short sleeve on the upper arm
      const t = -sl.to, p1 = lerp2(S, E, t);
      const flutter = sl.flutter || 0;
      const c = capsule(S, p1, [[0, up[0][1] + sl.up + 0.01, up[0][1] + sl.up + 0.01], [0.6, profAt(up, t * 0.6)[0] + sl.up + flutter * 0.4, profAt(up, t * 0.6)[0] + sl.up + flutter * 0.4], [1, profAt(up, t)[0] + sl.up * 1.2 + flutter, profAt(up, t)[0] + sl.up * 1.2 + flutter]], { capK: 0.25 });
      parts.push({ name: 'sleeve' + side, fam, path: shape(c.pts), m: mS, band: 0.05, inkPts: [{ pts: capsuleInk(c, 0.35), wf: taperBoth(0.2, 0.1) }], lines: [], z: 1 });
    } else {
      const wS = up[0][1] + sl.up, wUe = profAt(up, 1)[0] + sl.up * 1.1;
      const profU = [[0, wS, wS], [0.25, profAt(up, 0.25)[0] + sl.up, profAt(up, 0.25)[0] + sl.up], [0.6, profAt(up, 0.6)[0] + sl.up * 0.95, profAt(up, 0.6)[0] + sl.up * 0.95], [1, wUe, wUe]];
      const upS = { name: 'sleeveUp' + side, fam, m: mS, band: 0.055, lines: [] };
      const to = min(sl.to, 1.0);
      const pEnd = lerp2(E, W, to + (sl.to > 1 ? (sl.to - 1) : 0));
      const cuffLen = sl.cuff || 0;
      const pCuffStart = lerp2(E, W, max(0.05, to - (cuffLen / max(0.3, hypot(W[0] - E[0], W[1] - E[1])))));
      const wE = profAt(fo, 0)[0] + sl.fore * 1.05, wM = profAt(fo, to * 0.55)[0] + sl.fore * 0.9;
      const wP = profAt(fo, to * 0.9)[0] + sl.fore * (cuffLen ? 1.15 : 0.95), wT = profAt(fo, to)[0] + sl.fore * (sl.to > 1 ? 1.35 : cuffLen ? 1.0 : 0.85);
      const LS = limb2(S, E, cuffLen ? pCuffStart : pEnd, profU, [[0, wE, wE], [0.5, wM, wM], [0.85, wP, wP], [1, wT, wT]], { f0: 0.3, capK: cuffLen ? 0.6 : 0.45 });
      upS.path = shape(LS.pts); upS.inkPts = [{ pts: LS.ink, wf: taperBoth(0.15, 0.06) }];
      const foS = { lines: [] };
      // elbow folds (where the sleeve bunches): curved lines on the inner side of the bend + a little shadow wedge
      const de = norm2(sub2(W, E)), ne = [de[1], -de[0]], du = norm2(sub2(E, S));
      const crs = du[0] * de[1] - du[1] * de[0];                   // bend direction in 2D
      const inner = crs > 0 ? -1 : 1, bend = 1 - clamp(dot2(du, de));
      const nf = bend > 0.05 ? 3 : 2;
      for (let i = 0; i < nf; i++) {
        const o0 = add2(E, mul2(de, -0.06 + i * 0.065)), w0 = wE * (1 - i * 0.08);
        foS.lines.push({ pts: [add2(o0, mul2(ne, inner * w0 * 1.02)), add2(add2(o0, mul2(de, 0.035)), mul2(ne, inner * w0 * 0.45)), add2(add2(o0, mul2(de, 0.02 + i * 0.01)), mul2(ne, inner * w0 * 0.05))], w: 0.6, w0: 0.7, w1: 0.05, a: 0.8 });
      }
      foS.shades = [{ path: shape([add2(E, mul2(ne, inner * wE * 1.1)), add2(add2(E, mul2(de, 0.16)), mul2(ne, inner * wE * 1.1)), add2(add2(E, mul2(de, 0.07)), mul2(ne, inner * wE * 0.35))]), a: 0.8 }];
      upS.lines.push({ pts: [add2(add2(E, mul2(du, -0.1)), mul2([du[1], -du[0]], inner * wUe * 1.0)), add2(add2(E, mul2(du, -0.05)), mul2([du[1], -du[0]], inner * wUe * 0.4))], w: 0.55, w0: 0.7, w1: 0.05, a: 0.7 });
      if (sl.underCuff) { // the blouse cuff peeking out of the blazer sleeve
        const u0 = lerp2(E, W, to - 0.06), u1 = lerp2(E, W, min(1.0, to + sl.underCuff));
        const wu = profAt(fo, 1)[0] + 0.024;
        const cc = capsule(u0, u1, [[0, wu, wu], [1, wu, wu]], { capK: 0.3 });
        parts.push({ name: 'underCuff' + side, fam: fam + 'u', path: shape(cc.pts), m: R.m(sl.under, opt.wet), band: 0.03 });
      }
      upS.lines.push(...foS.lines); upS.shades = foS.shades || [];
      parts.push(upS);
      if (cuffLen) {
        const wc = wT + (sl.cuffW || 0);
        const cc = capsule(pCuffStart, pEnd, [[0, wc, wc], [1, wc, wc]], { capK: 0.3 });
        const mC = sl.rib ? mS : mS;
        const cuff = { name: 'cuff' + side, fam: fam + 'c', path: shape(cc.pts), m: mC, band: 0.035, lines: [] };
        if (sl.rib) { const dd = norm2(sub2(pEnd, pCuffStart)), nn = [dd[1], -dd[0]]; for (let i = 1; i < 4; i++) { const q = lerp2(pCuffStart, pEnd, i / 4); cuff.lines.push({ pts: [add2(q, mul2(nn, wc * 0.8)), add2(q, mul2(nn, -wc * 0.8))].map((p, j) => add2(p, mul2(dd, j ? 0.005 : -0.005))), w: 0.35, a: 0.5 }); } }
        else { const q = lerp2(pCuffStart, pEnd, 0.55), dd = norm2(sub2(pEnd, pCuffStart)), nn = [dd[1], -dd[0]]; cuff.after = (c, R2, m) => { c.fillStyle = m.line; c.globalAlpha = 0.55; c.beginPath(); c.arc(q[0] + nn[0] * wc * 0.45, q[1] + nn[1] * wc * 0.45, 0.011, 0, TAU); c.fill(); c.globalAlpha = 1; }; }
        parts.push(cuff);
      }
      if (sl.roll) { // rolled-up band
        const p0 = lerp2(E, W, max(0.05, to - 0.06)), p1 = lerp2(E, W, to + sl.roll * 0.8);
        const wr = profAt(fo, to)[0] + sl.fore * 1.35;
        const cr = capsule(p0, p1, [[0, wr, wr], [0.5, wr * 1.05, wr * 1.05], [1, wr * 0.95, wr * 0.95]], { capK: 0.35 });
        const roll = { name: 'roll' + side, fam: fam + 'r', path: shape(cr.pts), m: mS, band: 0.035, lines: [] };
        const dd = norm2(sub2(p1, p0)), nn = [dd[1], -dd[0]];
        for (const f of [0.38, 0.7]) { const q = lerp2(p0, p1, f); roll.lines.push({ pts: [add2(q, mul2(nn, wr * 0.9)), add2(add2(q, mul2(dd, 0.012)), mul2(nn, 0)), add2(q, mul2(nn, -wr * 0.9))], w: 0.5, a: 0.65 }); }
        parts.push(roll);
      }
    }
    return { parts, hand };
  }

  /* ---------------------------------------------------------------- hands (simplified anime hands) */
  // canonical RIGHT hand, unit length (wrist -> middle fingertip = 1), wrist at the origin, fingers toward +x.
  // view 'back' (dorsal; thumb at -y), 'palm' (thumb at +y), 'side' (thumb side; palm toward +y), 'edge' (little-finger side)
  function handShapes(view, curl, spread, kind) {
    const c = clamp(curl), sp = clamp(spread), out = { main: null, thumb: null, lines: [] };
    if (kind === 'fist' || kind === 'grip') {
      if (view === 'side' || view === 'edge') {
        out.main = [[0, -0.085], [0.22, -0.1], [0.4, -0.1], [0.52, -0.07], [0.57, 0.0], [0.55, 0.08], [0.46, 0.13], [0.32, 0.13], [0.2, 0.11], [0, 0.08]];
        if (view === 'side') out.thumb = [[0.16, 0.0], [0.3, -0.035], [0.43, -0.03], [0.47, 0.01], [0.42, 0.045], [0.28, 0.055], [0.2, 0.05]];
        out.lines = [[[0.45, -0.07], [0.5, 0.0], [0.47, 0.07]], [[0.36, 0.1], [0.44, 0.11]]];
      } else {
        out.main = [[0, -0.12], [0.2, -0.15], [0.4, -0.16], [0.53, -0.12], [0.58, -0.04], [0.58, 0.05], [0.54, 0.13], [0.42, 0.16], [0.2, 0.15], [0, 0.11]];
        out.thumb = view === 'back' ? [[0.08, -0.1], [0.22, -0.18], [0.36, -0.19], [0.42, -0.14], [0.32, -0.1]] : null;
        out.lines = [[[0.5, -0.07], [0.57, -0.065]], [[0.51, 0.015], [0.58, 0.018]], [[0.49, 0.095], [0.56, 0.1]]];
      }
      return out;
    }
    if (view === 'side' || view === 'edge') {
      // the finger stack seen from the thumb (or little-finger) side: the back of the hand, then a gentle arch of three phalanges
      const kn = [0.44, -0.03], seg = [0.19, 0.12, 0.09], ang = [0.08 + 0.3 * c, 0.1 + 0.48 * c, 0.06 + 0.36 * c], th = [0.066, 0.055, 0.044];
      let p = kn, a = -0.05; const top = [], bot = [];
      for (let i = 0; i < 3; i++) {
        a += ang[i]; const q = [p[0] + cos(a) * seg[i], p[1] + sin(a) * seg[i]], nx = -sin(a), ny = cos(a);
        top.push([q[0] - nx * th[i], q[1] - ny * th[i]]); bot.push([q[0] + nx * th[i] * 1.1, q[1] + ny * th[i] * 1.1]);
        p = q;
      }
      const tip = [p[0] + cos(a) * 0.032, p[1] + sin(a) * 0.032];
      out.main = [[0, -0.075], [0.2, -0.095], [0.38, -0.1], [kn[0], -0.095]].concat(top, [tip], bot.slice().reverse(), [[0.42, 0.085 + 0.02 * c], [0.24, 0.1], [0, 0.075]]);
      if (view === 'side') out.thumb = [[0.07, 0.03], [0.19, 0.08], [0.31, 0.112 - 0.02 * c], [0.4, 0.1 - 0.035 * c], [0.38, 0.062 - 0.02 * c], [0.26, 0.04], [0.14, 0.012]];
      out.lines.push([lerp2(top[0], bot[0], 0.42), lerp2(top[1], bot[1], 0.45), lerp2(top[2], bot[2], 0.5)]);   // the index / middle finger edge
      return out;
    }
    // back (dorsal) / palm: fingers together, rounded tips with shallow notches, the curl shortens them
    const Lf = [0.42, 0.48, 0.44, 0.34], yb = [-0.125, -0.042, 0.042, 0.118], kx = [0.45, 0.47, 0.46, 0.43], hw = 0.043;
    const tips = [], dirs = [];
    for (let i = 0; i < 4; i++) {
      const a = (i - 1.5) * 0.12 * sp, L = Lf[i] * (1 - 0.5 * c), d = [cos(a), sin(a)];
      dirs.push(d); tips.push([kx[i] + d[0] * L, yb[i] * (1 + 0.45 * sp) + d[1] * L]);
    }
    const edge = [];
    for (let i = 0; i < 4; i++) {
      const t = tips[i], d = dirs[i], n = [-d[1], d[0]];
      edge.push([t[0] - d[0] * 0.03 - n[0] * hw, t[1] - d[1] * 0.03 - n[1] * hw]);
      edge.push([t[0] + d[0] * 0.012 - n[0] * hw * 0.35, t[1] + d[1] * 0.012 - n[1] * hw * 0.35]);
      edge.push([t[0] + d[0] * 0.012 + n[0] * hw * 0.35, t[1] + d[1] * 0.012 + n[1] * hw * 0.35]);
      edge.push([t[0] - d[0] * 0.03 + n[0] * hw, t[1] - d[1] * 0.03 + n[1] * hw]);
      if (i < 3) { const m = lerp2(tips[i], tips[i + 1], 0.5); edge.push([m[0] - 0.055 - 0.06 * sp, m[1]]); }
    }
    out.main = [[0, -0.115], [0.2, -0.15], [kx[0], -0.168 - sp * 0.02], lerp2([kx[0], -0.168], [tips[0][0], tips[0][1] - hw], 0.55)].concat(edge,
      [lerp2([kx[3], 0.158], [tips[3][0], tips[3][1] + hw], 0.55), [kx[3], 0.158 + sp * 0.02], [0.2, 0.145], [0, 0.11]]);
    for (let i = 0; i < 3; i++) {
      const a = [lerp(kx[i], kx[i + 1], 0.5) + 0.06, (yb[i] + yb[i + 1]) / 2 * (1 + 0.45 * sp)], m = lerp2(tips[i], tips[i + 1], 0.5), b = [m[0] - 0.06 - 0.06 * sp, m[1]];
      out.lines.push([a, lerp2(a, b, 0.5), b]);
    }
    out.thumb = [[0.06, -0.1], [0.17, -0.185], [0.28, -0.25 + 0.05 * c], [0.36, -0.262 + 0.06 * c], [0.39, -0.23 + 0.06 * c], [0.3, -0.165], [0.18, -0.105]];
    if (view === 'palm') {
      const fl = (P) => P.map(([x, y]) => [x, -y]);
      out.main = fl(out.main); out.lines = out.lines.map(fl); out.thumb = fl(out.thumb);
      out.lines.push([[0.1, 0.07], [0.24, 0.03], [0.38, -0.01]], [[0.2, -0.1], [0.3, -0.05], [0.4, -0.06]]);
    }
    return out;
  }
  function buildHand(G, side, opt = {}) {
    const J = G.J, R = G.R, sp = G.sp;
    const hd = J['hand' + side] || {};
    if (hd.hidden) return null;
    const E3 = J['E' + side], W3 = J['W' + side], sg = side === 'L' ? 1 : -1;
    const fore = v3.norm(v3.sub(W3, E3));
    const f3 = v3.norm(hd.f || fore);
    // default palm: toward the body midline (relaxed arm)
    let P3 = hd.palm ? v3.norm(hd.palm) : v3.norm(mv(J.F.c.M, [-sg, 0, 0]));
    P3 = v3.norm(v3.sub(P3, v3.mul(f3, v3.dot(P3, f3))));
    const t3 = side === 'R' ? v3.cross(P3, f3) : v3.cross(f3, P3);
    const f = G.Vr(f3), Pv = G.Vr(P3), tv = G.Vr(t3);
    const sc = { back: -Pv[2], palm: Pv[2], side: tv[2], edge: -tv[2] };
    let view = hd.view || Object.keys(sc).reduce((a, b) => (sc[a] >= sc[b] ? a : b));
    const L = sp.hand * (hd.size || 1);
    const w2 = G.P2(W3);
    const fl = hypot(f[0], f[1]);
    const ex = fl > 1e-3 ? [f[0] / fl, f[1] / fl] : norm2(sub2(w2, G.P2(E3)));
    let ey = [-ex[1], ex[0]];
    // orient: thumb at -y (back), +y (palm); palm at +y (side/edge)
    const ref = (view === 'back' || view === 'palm') ? [tv[0], tv[1]] : [Pv[0], Pv[1]];
    const want = view === 'back' ? -1 : 1;
    if (dot2(ref, ey) * want < 0) ey = [-ey[0], -ey[1]];
    const kx = L * max(0.55, fl), ky = L * (view === 'side' || view === 'edge' ? 1.0 : 0.95);
    const T = ([x, y]) => [w2[0] + ex[0] * x * kx + ey[0] * y * ky, w2[1] + ex[1] * x * kx + ey[1] * y * ky];
    const sh = handShapes(view, hd.curl ?? 0.3, hd.spread ?? 0.1, hd.kind);
    const m = R.m(hd.mat || 'skin', opt.wet);
    const small = R.headPx * L < 22;
    const parts = [];
    const mainPts = sh.main.map(T);
    const thumbPts = sh.thumb ? sh.thumb.map(T) : null;
    const thumbBehind = (view === 'back' || view === 'edge') && !hd.kind;
    const mk = (pts, name, fam) => ({ name, fam, path: shape(pts), m, band: 0.025, lw: 0.85 });
    const main = mk(mainPts, 'hand' + side, 'hand' + side);
    main.inkPts = [{ pts: mainPts.slice(1, -1), wf: taperBoth(0.12, 0.12) }];
    main.lines = small ? [] : sh.lines.map(Lp => ({ pts: Lp.map(T), w: 0.5, a: 0.75 }));
    if (thumbPts) {
      const th = mk(thumbPts, 'thumb' + side, 'thumb' + side);
      th.inkPts = [{ pts: thumbPts.slice(1), wf: taperBoth(0.25, 0.1) }];
      if (thumbBehind) parts.push(th, main); else parts.push(main, th);
    } else parts.push(main);
    return { parts, view, wrist: w2, tipDir: ex };
  }

  /* ---------------------------------------------------------------- boy: open collar, loosened tie, belt, trousers seat */
  function collarOpen(G, torso, opt = {}) {
    const R = G.R, m = R.m(opt.mat || 'shirt', opt.wet), r = torso.rings[0], yN = r.y, parts = [];
    const nr = G.sp.neckR[0], rb = Object.assign({}, r, { a: nr + 0.035, b: nr + 0.032, dip: 0 });
    const band = [];
    for (let a = 30; a >= -210; a -= 20) band.push(G.P2(ringPoint(G, rb, a, yN - 0.065, 0.0)));
    for (let a = -210; a <= 30; a += 20) band.push(G.P2(ringPoint(G, rb, a, yN + 0.01, 0.0)));
    const backBand = { name: 'collarBack', fam: 'collarB', path: shape(band), m, band: 0.03, lw: 0.8 };
    for (const sg of [1, -1]) {
      const ph = (d) => 90 - sg * d;
      // the open collar: points spread outward and down over the collarbone
      const r1 = torso.rings[1];
      const pts3 = [ringPoint(G, r, ph(20), yN - 0.06, 0.014), ringPoint(G, r, ph(68), yN - 0.08, 0.014), ringPoint(G, r, ph(92), yN + 0.0, 0.02),
        surfPt(G, r, r1, 0.3, ph(80), 0.035), surfPt(G, r, r1, 0.5, ph(50), 0.04), surfPt(G, r, r1, 0.25, ph(28), 0.035)];
      const nz = facing(G, 'c', v3.norm([cos(ph(45) * PI / 180), 0, sin(ph(45) * PI / 180)]));
      if (nz < -0.25) continue;
      const pts = pts3.map(G.P2); pts[4] = [...pts[4], 1];
      parts.push({ name: 'collar' + sg, fam: 'collar' + sg, path: shape(pts), m, band: 0.035, lw: 0.85, z: nz, lines: [{ pts: [lerp2(pts[0], pts[1], 0.2), lerp2(pts[2], pts[3], 0.3)], w: 0.55, a: 0.7 }] });
    }
    parts.sort((a, b) => a.z - b.z);
    // the open neck: skin V between the collar points
    const vpts = [ringPoint(G, r, 90 - 26, yN - 0.03, 0.006), ringPoint(G, r, 90, yN + 0.17, 0.006), ringPoint(G, r, 90 + 26, yN - 0.03, 0.006)].map(G.P2);
    return { backBand, flaps: parts, vneck: vpts };
  }
  function tieLoose(G, torso, opt = {}) {
    const R = G.R, m = R.m('tie'), r = torso.rings[0];
    const ez = G.Vr(mv(G.J.F.c.M, [0, 0, 1]));
    if (ez[2] < -0.1) return null;
    const ex = G.Vr(mv(G.J.F.c.M, [1, 0, 0])), ey = G.Vr(mv(G.J.F.c.M, [0, 1, 0]));
    const k3 = ringPoint(G, r, 90 + 6, r.y + 0.2, 0.045);
    const c = G.P2(k3), sw = opt.sway || 0;
    const T = (x, y) => [c[0] + ex[0] * x + ey[0] * y, c[1] + ex[1] * x + ey[1] * y];
    const knot = [T(-0.05, -0.05), T(0.05, -0.055), [...T(0.034, 0.05), 1], [...T(-0.028, 0.05), 1]];
    // the blade follows the chest: sample the front centre of the rings below
    const rs = torso.rings, blade = [];
    const L = 1.15;
    const pts = [T(-0.03, 0.04), T(0.035, 0.04)];
    const cen = [];
    for (let i = 1; i < rs.length - 1; i++) cen.push(G.P2(ringPoint(G, rs[i], 90 + 6, undefined, 0.035)));
    const bottom = G.P2(ringPoint(G, rs[rs.length - 2], 92, rs[rs.length - 2].y + 0.15, 0.04));
    const pathC = [c].concat(cen.filter(p => p[1] > c[1] + 0.05), [bottom]);
    // widths along the blade (wider toward the tip), across the chest's own x axis so the tie foreshortens
    const wAt = (u) => lerp(0.042, 0.082, u);
    const exx = [ex[0], ex[1]];
    const A2 = [], B2 = [];
    for (let i = 0; i < pathC.length; i++) {
      const u = i / (pathC.length - 1), w = wAt(u), ps = add2(pathC[i], [sw * u * 0.06, 0]);
      A2.push(add2(ps, mul2(exx, w))); B2.push(add2(ps, mul2(exx, -w)));
    }
    const end = pathC[pathC.length - 1], dEnd = norm2(sub2(end, pathC[pathC.length - 2]));
    const tip = add2(add2(end, [sw * 0.06, 0]), mul2(dEnd, 0.07));
    blade.push(...A2, [...tip, 1], ...B2.reverse());
    const pb = { name: 'tie', fam: 'tie', path: shape(blade), m, band: 0.04, lw: 0.8, lines: [] };
    const pk = { name: 'tieKnot', fam: 'tieK', path: shape(knot), m, band: 0.03, lw: 0.8 };
    return { parts: [pb, pk], all: (() => { const p = new Path2D(); p.addPath(pb.path); p.addPath(pk.path); return p; })() };
  }
  function trouserSeat(G, layer, matName, opt = {}) {
    const R = G.R, sp = G.sp, m = R.m(matName, opt.wet);
    const yTop = opt.top ?? (sp.rings.hipTop[1] + 0.02);
    const rings = [
      { f: 'p', y: yTop, a: sp.rings.hipTop[2] + 0.045, b: sp.rings.hipTop[3] + 0.04, cz: 0 },
      { f: 'p', y: sp.rings.hip[1], a: sp.rings.hip[2] + 0.04, b: sp.rings.hip[3] + 0.04, cz: sp.rings.hip[4] },
      { f: 'p', y: sp.rings.seat[1] + 0.06, a: sp.rings.seat[2] + 0.02, b: sp.rings.seat[3] + 0.03, cz: sp.rings.seat[4] },
    ];
    const rs = rings.map(r => ringSample(G, r, 24));
    const ol = loftOutline(rs, {});
    const part = G.add(layer, { name: 'seat', fam: 'pants', path: shape(ol.pts), m, band: 0.1, rs, rings, lines: [] });
    // fly + pocket lines on the near side
    const fz = facing(G, 'p', [0, 0, 1]);
    if (fz > 0.1) {
      part.lines.push({ pts: [G.P2(ringPoint(G, rings[0], 90, rings[0].y + 0.06, 0.004)), G.P2(ringPoint(G, rings[1], 92, rings[1].y + 0.05, 0.004)), G.P2(ringPoint(G, rings[2], 96, rings[2].y - 0.02, 0.004))], w: 0.55, a: 0.7 });
    }
    for (const sg of [1, -1]) {
      const ph = 90 - sg * 55, nz = facing(G, 'p', [cos(ph * PI / 180), 0, sin(ph * PI / 180)]);
      if (nz > 0.05) part.lines.push({ pts: [G.P2(ringPoint(G, rings[0], 90 - sg * 38, rings[0].y + 0.04, 0.004)), G.P2(ringPoint(G, rings[1], 90 - sg * 68, rings[1].y - 0.05, 0.004))], w: 0.55, a: 0.7 });
    }
    return part;
  }
  function beltPart(G, torsoRingsList, opt = {}) {
    const R = G.R, sp = G.sp, m = R.m('belt');
    const y0 = opt.y ?? (sp.rings.hipTop[1] + 0.02), h = 0.075;
    const r0 = { f: 'p', y: y0 - 0.005, a: sp.rings.hipTop[2] + 0.05, b: sp.rings.hipTop[3] + 0.045, cz: 0 };
    const r1 = Object.assign({}, r0, { y: y0 + h, a: r0.a + 0.004, b: r0.b + 0.004 });
    const rs = [ringSample(G, r0, 24), ringSample(G, r1, 24)];
    const ol = loftOutline(rs, {});
    const part = { name: 'belt', fam: 'belt', path: shape(ol.pts), m, band: 0.04, hi: 0.012, hiA: 0.5, lw: 0.8 };
    const fz = facing(G, 'p', [0, 0, 1]);
    if (fz > 0.15) {
      const mb = R.m('buckle'), c = G.P2(ringPoint(G, r0, 90, y0 + h / 2, 0.012));
      const ex = G.Vr(mv(G.J.F.p.M, [1, 0, 0]));
      part.after = (c2) => { c2.save(); c2.translate(c[0], c[1]); c2.transform(ex[0], ex[1], 0, 1, 0, 0); c2.fillStyle = mb.base; c2.strokeStyle = mb.line; c2.lineWidth = R.wDet * 0.8; c2.beginPath(); c2.roundRect(-0.05, -0.045, 0.1, 0.09, 0.012); c2.fill(); c2.stroke(); c2.fillStyle = mb.shade; c2.fillRect(-0.03, -0.022, 0.06, 0.044); c2.restore(); };
    }
    return part;
  }

  /* ---------------------------------------------------------------- outer garments (blazer, cardigan, open shirt, jacket, coat) */
  // A shell lofted over the inner top, with the opening cut out as a hole (the inner layer, collar and ribbon show through it
  // and the opening edges get the shell's ink). The hole is only cut while the front faces the viewer.
  function shapeWithHoles(outer, holes) {
    const p = new Path2D(); const o = area(outer) < 0 ? outer.slice().reverse() : outer; crPath(p, o, true, true, 1);
    for (const h of holes) { const q = area(h) > 0 ? h.slice().reverse() : h; crPath(p, q, true, true, 1); }
    return p;
  }
  const OUTER = {
    blazer: { mat: 'blazer', ease: [0.07, 0.065], sq: 0.12, hem: 'hip', hemDy: 0.0, hemEase: 0.06, open: { top: 21, low: 'button', btnT: 0.35, split: 9 }, lapel: true, buttons: 2, pockets: true },
    blazer_boy: { mat: 'blazer', ease: [0.075, 0.07], sq: 0.15, hem: 'hip', hemDy: 0.1, hemEase: 0.065, open: { top: 20, low: 'button', btnT: 0.62, split: 0 }, lapel: true, buttons: 2, pockets: true },
    cardigan: { mat: 'cardigan', ease: [0.055, 0.05], sq: 0.0, hem: 'hip', hemDy: 0.02, hemEase: 0.075, open: { top: 27, low: 'open', bot: 13 }, rib: true, buttons: 5, bandLines: true },
    open_shirt: { mat: 'shirt_blue', ease: [0.065, 0.06], sq: 0.05, hem: 'hip', hemDy: 0.12, hemEase: 0.08, open: { top: 20, low: 'open', bot: 15 }, collar: 'shirt', bandLines: true },
    jacket: { mat: 'jacket', ease: [0.09, 0.085], sq: 0.2, hem: 'hipTop', hemDy: 0.1, hemEase: 0.1, open: { top: 23, low: 'open', bot: 19 }, collar: 'jacket', zip: true, pockets: true, hi: 0.02 },
    coat: { mat: 'coat', ease: [0.08, 0.075], sq: 0.08, hem: 'hip', hemDy: 0.0, hemEase: 0.08, open: { top: 21, low: 'button', btnT: 0.1, split: 0 }, lapel: true, buttons: 3, long: 3.05 },
  };
  function outerRings(G, kind) {
    const sp = G.sp, D = OUTER[kind], [ea, eb] = D.ease, br = (G.J.P.breath || 0) * 0.008;
    const names = sp.girl ? ['neck', 'chestTop', 'bust', 'underbust', 'waist', 'hipTop'] : ['neck', 'chestTop', 'chest', 'lowChest', 'waist', 'hipTop'];
    const rs = names.map((n, i) => bodyRing(sp, n, (i === 0 ? ea * 0.75 : ea + (i === 4 ? 0.02 : 0)) + br, (i === 0 ? eb * 0.75 : eb + (i === 4 ? 0.015 : 0)) + br, { sq: i === 0 ? 0 : D.sq }));
    if (D.hem === 'hip') rs.push(bodyRing(sp, 'hip', D.hemEase, D.hemEase * 0.9, { y: sp.rings.hip[1] + D.hemDy, sq: D.sq }));
    else { rs[rs.length - 1] = bodyRing(sp, 'hipTop', D.hemEase, D.hemEase * 0.9, { y: sp.rings.hipTop[1] + D.hemDy, sq: D.sq }); }
    return rs;
  }
  function buildOuter(G, kind, opt = {}) {
    const R = G.R, J = G.J, D = OUTER[kind], m = R.m(D.mat, opt.wet);
    const rings = outerRings(G, kind);
    const rs = rings.map(r => ringSample(G, r, 24));
    const base = loftOutline(rs, { topArc: false, botArc: false });
    const n = base.n, nt = base.Rx[0].pt, ntL = base.Lx[0].pt;
    const ac = ['L', 'R'].map(sd => { const p = G.P2(v3.add(J['Ac' + sd], [0, -0.03, 0])); return { p, d: dot2(p, n) }; }).sort((a, b) => b.d - a.d);
    const insR = [], insL = [];
    if (ac[0].d > dot2(nt, n) + 0.04) { const mid = lerp2(nt, ac[0].p, 0.45); insR.push([mid[0], mid[1] - 0.035]); insR.push(ac[0].p); }
    if (ac[1].d < dot2(ntL, n) - 0.04) { const mid = lerp2(ntL, ac[1].p, 0.45); insL.push(ac[1].p); insL.push([mid[0], mid[1] - 0.035]); }
    const ol = loftOutline(rs, { insR, insL, topArc: true, botArc: true, sharpBot: !!D.open });
    const fz = facing(G, 'c', [0, 0, 1]);
    const r0 = rings[0], r1 = rings[1], r2 = rings[2], r3 = rings[3], rW = rings[4], rH = rings[rings.length - 1];
    // the opening edge: from the neck down along the front, as surface points (so it curves round the body in 3/4)
    const O = D.open, holes = [], edge = { L: [], R: [] };
    const S = (rA, rB, t, ph, out = 0.006) => G.P2(surfPt(G, rA, rB, t, ph, out));
    const chain = [r0, r1, r2, r3, rW, rH];
    const along = (sg, f) => { // f: 0 at the neck .. 1 at the hem; returns 2D point on the opening edge of side sg
      const segs = chain.length - 1, x = f * segs, i = Math.min(segs - 1, Math.floor(x)), t = x - i;
      let ph;
      if (O.low === 'button') { const fb = O.btnT * 0.6 + 0.25; ph = f < fb ? lerp(O.top, 0, sstep(0, 1, f / fb)) : (f > 0.82 ? lerp(0, O.split, (f - 0.82) / 0.18) : 0); }
      else ph = lerp(O.top, O.bot, sstep(0, 1, f));
      return { p: S(chain[i], chain[i + 1], t, 90 - sg * ph), ph };
    };
    if (fz > 0.38) {
      const K = 14;
      for (const sg of [1, -1]) for (let k = 0; k <= K; k++) edge[sg > 0 ? 'L' : 'R'].push(along(sg, k / K).p);
      if (O.low === 'button') {
        const fb = O.btnT * 0.6 + 0.25, kb = Math.round(fb * K);
        holes.push(edge.L.slice(0, kb + 1).concat([...edge.R.slice(0, kb + 1)].reverse()));
        if (O.split) { const k0 = Math.round(0.82 * K); holes.push(edge.L.slice(k0).concat([...edge.R.slice(k0)].reverse()).concat([])); }
      } else holes.push(edge.L.concat([...edge.R].reverse()));
    }
    const path = holes.length ? shapeWithHoles(ol.pts, holes.map(h => h.map((q, i) => (i === 0 || i === h.length - 1 ? q : q)))) : shape(ol.pts);
    const part = { name: 'outer', fam: 'outer', path, m, band: 0.12, bandDir: 'x', hi: D.hi || 0, hiA: 0.5, rings, rs, ol, lines: [], shades: [], cast: [], extra: [] };
    // ribbed hem / band lines
    if (D.rib) {
      const iH = rs.length - 1, hb = Object.assign({}, rH, { y: rH.y - 0.09 });
      const r9 = ringSample(G, hb, 24), e9 = loftOutline([r9, rs[iH]], {});
      const idx = nearIdx(r9, e9.Rx[0].k, e9.Lx[0].k).map(i => r9.P2[i]);
      if (idx.length > 2) part.lines.push({ pts: [e9.Rx[0].pt, ...idx, e9.Lx[0].pt], w: 0.55, a: 0.6 });
    }
    // lapels / collars sit on the shell around the opening
    if (fz > 0.38 && (D.lapel || D.collar)) {
      for (const sg of [1, -1]) {
        const ph = (d) => 90 - sg * d, nz = nzAt(G, 'c', ph(40));
        if (nz < -0.2) continue;
        let pts;
        if (D.lapel) {
          const fb = O.btnT * 0.6 + 0.25;
          const P3 = [ringPoint(G, r0, ph(O.top - 1), r0.y + 0.005, 0.012), ringPoint(G, r0, ph(64), r0.y - 0.075, 0.012), surfPt(G, r0, r1, 0.3, ph(74), 0.022),
            surfPt(G, r0, r1, 0.4, ph(56), 0.026), surfPt(G, r0, r1, 0.5, ph(68), 0.03), surfPt(G, r1, r2, 0.55, ph(34), 0.026)];
          const pts2 = P3.map(G.P2); pts2[3] = [...pts2[3], 1]; pts2[4] = [...pts2[4], 1];
          const vb = along(sg, fb).p;
          pts = pts2.concat([[...vb, 1]], [along(sg, fb * 0.55).p]);
        } else if (D.collar === 'shirt' || D.collar === 'jacket') {
          const big = D.collar === 'jacket' ? 1.3 : 1;
          const P3 = [ringPoint(G, r0, ph(O.top - 3), r0.y + 0.02, 0.014), ringPoint(G, r0, ph(64), r0.y - 0.035, 0.016), ringPoint(G, r0, ph(100), r0.y - 0.02, 0.016),
            surfPt(G, r0, r1, 0.22 * big, ph(96), 0.03), surfPt(G, r0, r1, 0.5 * big, ph(56), 0.035), surfPt(G, r0, r1, 0.36 * big, ph(O.top + 1), 0.03)];
          pts = P3.map(G.P2); pts[4] = [...pts[4], 1];
        }
        const lp = { name: 'lapel' + sg, fam: 'lapel' + sg, path: shape(pts), m, band: 0.04, lw: 0.9, hi: D.hi ? 0.012 : 0, hiA: 0.5, lines: [], z: nz };
        if (D.lapel) lp.lines.push({ pts: [lerp2(pts[0], pts[pts.length - 1], 0.0), pts[pts.length - 1]], w: 0.45, a: 0.4 });
        part.extra.push(lp);
      }
      part.extra.sort((a, b) => a.z - b.z);
    }
    // buttons (the wearer's left front edge for the blazer / coat; the cardigan's button band)
    if (fz > 0.25 && D.buttons) {
      const btn = [];
      if (O.low === 'button') { const fb = O.btnT * 0.6 + 0.25; for (let i = 0; i < D.buttons; i++) btn.push(G.P2(surfPt(G, chain[Math.min(5, Math.floor((fb + i * 0.13) * 5))], chain[Math.min(5, Math.floor((fb + i * 0.13) * 5) + 1)] || rH, ((fb + i * 0.13) * 5) % 1, 90 + 6, 0.02))); }
      else for (let i = 0; i < D.buttons; i++) btn.push(along(-1, 0.18 + i * 0.16).p);
      const br = D.buttons > 3 ? 0.016 : 0.022;
      part.after = (c, R2, mm2) => { for (const q of btn) { c.fillStyle = mm2.hi; c.strokeStyle = mm2.line; c.lineWidth = R2.wDet * 0.8; c.beginPath(); c.arc(q[0], q[1], br, 0, TAU); c.fill(); c.stroke(); } };
    }
    // edge band lines (cardigan button band, shirt placket) along the opening
    if (fz > 0.38 && D.bandLines) for (const sd of ['L', 'R']) { const e = edge[sd]; if (e.length > 3) part.lines.push({ pts: e.slice(1).map((q, i) => add2(q, [sd === 'L' ? 0.035 : -0.035, 0])), w: 0.5, a: 0.55 }); }
    if (fz > 0.38 && D.zip) { const e = edge.R; if (e.length > 3) part.lines.push({ pts: e.slice(2).map(q => add2(q, [-0.02, 0])), w: 0.7, a: 0.7 }); }
    // pocket flaps
    if (D.pockets) for (const sg of [1, -1]) {
      const ph = 90 - sg * 52; if (nzAt(G, 'p', ph) < 0.2) continue;
      const a = G.P2(surfPt(G, rW, rH, 0.62, ph - 14, 0.01)), b = G.P2(surfPt(G, rW, rH, 0.62, ph + 14, 0.01));
      part.lines.push({ pts: [a, lerp2(a, b, 0.5), b], w: 0.6, w0: 0.6, w1: 0.6, a: 0.7 });
    }
    // the coat's long skirt
    if (D.long) part.coatSkirt = true;
    return part;
  }

  /* ---------------------------------------------------------------- necklines, skin yoke, necklace, knit rib, turtleneck, sash */
  function skinYoke(G) {
    const sp = G.sp, R = G.R;
    const rings = [bodyRing(sp, 'neck', 0.0, 0.0), bodyRing(sp, 'chestTop', 0.01, 0.01), bodyRing(sp, sp.girl ? 'bust' : 'chest', 0.0, 0.0)];
    const rs = rings.map(r => ringSample(G, r, 20));
    const base = loftOutline(rs, { topArc: false, botArc: false }), n = base.n;
    const ac = ['L', 'R'].map(sd => { const p = G.P2(G.J['Ac' + sd]); return { p, d: dot2(p, n) }; }).sort((a, b) => b.d - a.d);
    const ol = loftOutline(rs, { insR: [ac[0].p], insL: [ac[1].p] });
    const part = { name: 'yoke', fam: 'yoke', path: shape(ol.pts), m: R.m('skin'), band: 0.06, lines: [], shades: [] };
    // collarbones
    if (facing(G, 'c', [0, 0, 1]) > 0.2) for (const sg of [1, -1]) {
      const a = G.P2(surfPt(G, rings[0], rings[1], 0.32, 90 - sg * 18, 0.005)), b = G.P2(surfPt(G, rings[0], rings[1], 0.25, 90 - sg * 52, 0.005)), c = G.P2(surfPt(G, rings[0], rings[1], 0.12, 90 - sg * 70, 0.005));
      part.lines.push({ pts: [a, lerp2(lerp2(a, b, 0.5), [lerp2(a, b, 0.5)[0], lerp2(a, b, 0.5)[1] + 0.012], 1), b, c], w: 0.5, w0: 0.1, w1: 0.05, a: 0.6 });
    }
    return part;
  }
  function necklineRing(G, kind) {
    const sp = G.sp, nb = sp.rings.neck, ct = sp.rings.chestTop;
    if (kind === 'scoop') return { f: 'c', y: lerp(nb[1], ct[1], 0.28), a: 0.27, b: 0.205, cz: -0.01, dip: 0.13, dipP: 1.6, dipB: 0.03 };
    if (kind === 'square') return { f: 'c', y: lerp(nb[1], ct[1], 0.3), a: 0.25, b: 0.2, cz: -0.01, dip: 0.12, dipP: 0.6, sq: 0.35, dipB: 0.04 };
    return null;
  }
  function necklace(G, torso) {
    const R = G.R, m = R.m('chain'), r0 = bodyRing(G.sp, 'neck', 0.004, 0.004), r1 = bodyRing(G.sp, 'chestTop', 0.0, 0.0);
    if (facing(G, 'c', [0, 0, 1]) < 0.15) return null;
    const pts = [];
    for (const d of [-80, -60, -40, -20, 0, 20, 40, 60, 80]) { const t = 0.05 + 0.3 * Math.pow(cos(d * PI / 180), 2.5); if (nzAt(G, 'c', 90 + d) > -0.05) pts.push(G.P2(surfPt(G, r0, r1, t, 90 + d, 0.01))); }
    const pend = G.P2(surfPt(G, r0, r1, 0.39, 90, 0.014));
    return { name: 'necklace', fam: 'necklace', path: null, m, lines: [], after: (c, R2) => {
      if (pts.length > 2) A.taper(c, pts, { w0: R2.wDet * 0.5, mid: R2.wDet * 0.85, w1: R2.wDet * 0.5 }, m.shade, true);
      c.fillStyle = m.hi; c.strokeStyle = m.line; c.lineWidth = R2.wDet * 0.6; c.beginPath(); c.ellipse(pend[0], pend[1], 0.016, 0.022, 0, 0, TAU); c.fill(); c.stroke();
    } };
  }
  function knitRib(G, torso) { // crew-neck rib band and the ribbed hem of the knit
    const r = torso.rings[0], rr = Object.assign({}, r, { y: r.y + 0.06, a: r.a + 0.01, b: r.b + 0.01 });
    const rs = [ringSample(G, r, 24), ringSample(G, rr, 24)], e = loftOutline(rs, {});
    const idx = nearIdx(rs[1], e.Rx[1].k, e.Lx[1].k).map(i => rs[1].P2[i]);
    if (idx.length > 2) torso.lines.push({ pts: [e.Rx[1].pt, ...idx, e.Lx[1].pt], w: 0.55, a: 0.6 });
    const rh = torso.rings[torso.rings.length - 1], rh2 = Object.assign({}, rh, { y: rh.y - 0.1 });
    const rs2 = [ringSample(G, rh2, 24), ringSample(G, rh, 24)], e2 = loftOutline(rs2, {});
    const id2 = nearIdx(rs2[0], e2.Rx[0].k, e2.Lx[0].k);
    const pts = id2.map(i => rs2[0].P2[i]);
    if (pts.length > 2) torso.lines.push({ pts: [e2.Rx[0].pt, ...pts, e2.Lx[0].pt], w: 0.55, a: 0.6 });
    for (const i of id2) if (i % 2 === 0) torso.lines.push({ pts: [rs2[0].P2[i], rs2[1].P2[i]], w: 0.35, a: 0.4 });
  }
  function turtleneck(G) {
    const J = G.J, sp = G.sp, R = G.R, m = R.m('turtle');
    const b = G.P2(v3.add(J.neckBase, [0, 0.03, 0])), t = G.P2(v3.add(J.neckBase, mv(J.Mn, [0, -sp.neckLen * 0.55, 0.01])));
    const r0 = sp.neckR[0] + 0.03, r1 = sp.neckR[1] + 0.028;
    const cap = capsule(b, t, [[0, r0, r0], [1, r1, r1]], { capK: 0.3 });
    const part = { name: 'turtle', fam: 'turtle', path: shape(cap.pts), m, band: 0.04, lines: [] };
    const d = norm2(sub2(t, b)), nn = [d[1], -d[0]];
    for (const f of [0.35, 0.65]) { const q = lerp2(b, t, f); part.lines.push({ pts: [add2(q, mul2(nn, r0 * 0.9)), add2(add2(q, mul2(d, -0.012)), mul2(nn, 0)), add2(q, mul2(nn, -r0 * 0.9))], w: 0.45, a: 0.5 }); }
    return part;
  }
  function sashBelt(G, torso) {
    const sp = G.sp, R = G.R, m = R.m('sash');
    const r0 = { f: 'w', y: sp.waistY - 0.05, a: sp.rings.waist[2] + 0.03, b: sp.rings.waist[3] + 0.03, cz: 0 }, r1 = Object.assign({}, r0, { y: sp.waistY + 0.06, a: r0.a + 0.012, b: r0.b + 0.012 });
    const rs = [ringSample(G, r0, 24), ringSample(G, r1, 24)], ol = loftOutline(rs, {});
    const part = { name: 'sash', fam: 'sash', path: shape(ol.pts), m, band: 0.03, lw: 0.75 };
    if (nzAt(G, 'w', 125) > 0.1) { // a small bow at the side
      const c = G.P2(ringPoint(G, r0, 125, sp.waistY, 0.03));
      part.after = (cc, R2, mm2) => { cc.save(); cc.fillStyle = mm2.base; cc.strokeStyle = mm2.line; cc.lineWidth = R2.wDet * 0.8;
        for (const sg of [-1, 1]) { const p = shape([c, [c[0] + sg * 0.07, c[1] - 0.035], [c[0] + sg * 0.085, c[1] + 0.02]]); cc.fill(p); cc.stroke(p); }
        const tl = shape([c, [c[0] - 0.03, c[1] + 0.17], [c[0] - 0.005, c[1] + 0.16], [c[0] + 0.02, c[1] + 0.02]]); cc.fill(tl); cc.stroke(tl); cc.restore(); };
    }
    return part;
  }
  // wet cloth: skin shows through where the shirt clings (shoulders, chest), plus pulled folds
  function wetCling(G, torso) {
    const R = G.R, sk = R.m('skin'), rs = torso.rings;
    if (facing(G, 'c', [0, 0, 1]) < -0.3) return;
    const blot = new Path2D();
    const sh = (rA, rB, t0, t1, p0, p1) => { const q = [surfPt(G, rA, rB, t0, p0), surfPt(G, rA, rB, t0, p1), surfPt(G, rA, rB, t1, p1 - 6), surfPt(G, rA, rB, t1, p0 + 8)].map(G.P2); const p = shape(q); blot.addPath(p); };
    sh(rs[0], rs[1], 0.25, 0.9, 30, 70); sh(rs[0], rs[1], 0.25, 0.9, 110, 150); sh(rs[1], rs[2], 0.1, 0.8, 40, 80); sh(rs[1], rs[2], 0.1, 0.8, 100, 140); sh(rs[2], rs[3], 0.2, 0.9, 60, 120);
    torso.shades.push({ path: blot, col: A.mixHex(sk.base, torso.m.shade, 0.35), a: 0.42 });
    for (const [a, b, c2] of [[[30, 0.2], [60, 0.7], [80, 1.3]], [[150, 0.2], [120, 0.7], [100, 1.3]], [[45, 1.6], [70, 2.4], [85, 3.2]], [[135, 1.6], [110, 2.4], [95, 3.2]]]) {
      const P = [a, b, c2].map(([ph, f]) => { const i = Math.min(rs.length - 2, Math.floor(f)); return G.P2(surfPt(G, rs[i], rs[i + 1], f - i, ph, 0.004)); });
      torso.lines.push({ pts: P, w: 0.5, w0: 0.05, w1: 0.05, a: 0.55 });
    }
  }

  /* ---------------------------------------------------------------- the cast + sling (先輩, after the accident) */
  function castArm(G, side, opt = {}) {
    const J = G.J, R = G.R, sp = G.sp, m = R.m('cast'), mS = R.m('sling');
    const E = G.P2(J['E' + side]), W = G.P2(J['W' + side]), S = G.P2(J['S' + side]);
    const d = norm2(sub2(W, E)), nn = [d[1], -d[0]];
    const c0 = lerp2(E, W, 0.12), c1 = add2(W, mul2(d, sp.hand * 0.42));
    const cap = capsule(c0, c1, [[0, 0.085, 0.085], [0.3, 0.09, 0.09], [0.8, 0.072, 0.072], [1, 0.065, 0.065]], { capK: 0.5 });
    const cast = { name: 'cast', fam: 'cast', path: shape(cap.pts), m, band: 0.045, lines: [] };
    for (const f of [0.3, 0.55, 0.78]) { const q = lerp2(c0, c1, f); cast.lines.push({ pts: [add2(q, mul2(nn, 0.085)), add2(add2(q, mul2(d, 0.025)), mul2(nn, 0)), add2(q, mul2(nn, -0.085))], w: 0.4, a: 0.35 }); }
    // fingers peeking out of the cast end
    const fp = [];
    for (let i = 0; i < 4; i++) { const o = (i - 1.5) * 0.028; const b = add2(c1, mul2(nn, o)); fp.push(capsule(b, add2(b, mul2(d, 0.075 - abs(i - 1.5) * 0.012)), [[0, 0.016, 0.016], [1, 0.013, 0.013]])); }
    const fingers = fp.map((c, i) => ({ name: 'fing' + i, fam: 'fing' + i, path: shape(c.pts), m: R.m('skin'), band: 0.01, lw: 0.7 }));
    // the sling: a pouch under the forearm and a strap up to the opposite side of the neck
    const pouch = shape([add2(E, mul2(nn, -0.11)), add2(lerp2(E, W, 0.5), mul2(nn, -0.13)), add2(W, mul2(nn, -0.11)), add2(add2(W, mul2(d, 0.05)), mul2(nn, 0.04)),
      [...add2(lerp2(E, W, 0.4), mul2(nn, -0.28)), 1], add2(add2(E, mul2(d, -0.06)), mul2(nn, 0.02))]);
    const sgn = side === 'R' ? 1 : -1;
    const nkF = G.P2(v3.add(J.neckBase, mv(J.F.c.M, [sgn * 0.13, 0.05, 0.02]))), nkN = G.P2(v3.add(J.neckBase, mv(J.F.c.M, [-sgn * 0.12, 0.05, 0.02])));
    const strapA = capsule(add2(lerp2(E, W, 0.92), mul2(nn, -0.04)), nkF, [[0, 0.04, 0.04], [1, 0.032, 0.032]], { capK: 0.2, capK0: 0.3 });
    const strapB = capsule(add2(lerp2(E, W, 0.08), mul2(nn, -0.04)), nkN, [[0, 0.04, 0.04], [1, 0.032, 0.032]], { capK: 0.2, capK0: 0.3 });
    void S;
    return {
      parts: [{ name: 'strapB', fam: 'sling0', path: shape(strapB.pts), m: mS, band: 0.03, lw: 0.8 }, { name: 'strap', fam: 'sling1', path: shape(strapA.pts), m: mS, band: 0.03, lw: 0.8 }, cast, ...fingers,
        { name: 'pouch', fam: 'sling2', path: pouch, m: mS, band: 0.05, lw: 0.85, lines: [{ pts: [add2(lerp2(E, W, 0.2), mul2(nn, -0.13)), add2(lerp2(E, W, 0.42), mul2(nn, -0.24))], w: 0.5, a: 0.6 }] }],
    };
  }

  /* ---------------------------------------------------------------- the summer hat (drawn after the head) */
  function drawHat(ctx, G, o, head, args) {
    const s = args.size, R = G.R, m = A.mat('hat', o.light || 'day'), mb = A.mat('hatband', o.light || 'day');
    let cx = args.x + sin(args.roll || 0) * s * 0.66, cy = args.y - cos(args.roll || 0) * s * 0.66, roll = args.roll || 0;
    if (head && head.crown) { cx = head.crown[0]; cy = head.crown[1] + s * 0.22; }
    const yaw = clamp(args.yaw || 0, -1, 1), tq = A.onTwos(o.T || 0), W = o.wind || 0;
    const lw = A.inkW(s * R.zoom) / R.zoom;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(roll - 0.06 * yaw - 0.05); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const bx = s * 0.92, by = s * 0.27, flap = W * 0.03 * s * sin(tq * 5.1);
    // brim (a wide ellipse with a soft wave), crown, band, bow, tails in the wind
    const brim = []; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, wav = 1 + 0.025 * sin(a * 3 + 1) + (sin(a) > 0 ? flap / (s * 0.9) * sin(a * 2) : 0); brim.push([cos(a) * bx * wav, sin(a) * by * wav + (sin(a) > 0 ? s * 0.03 : 0)]); }
    const crown = [[-s * 0.4 + yaw * s * 0.05, 0.02 * s], [-s * 0.41 + yaw * s * 0.05, -s * 0.2], [-s * 0.3, -s * 0.36], [0, -s * 0.41], [s * 0.3, -s * 0.36], [s * 0.41 + yaw * s * 0.05, -s * 0.2], [s * 0.4 + yaw * s * 0.05, 0.02 * s]];
    const pB = shape(brim), pC = shape(crown);
    ctx.strokeStyle = m.line; ctx.lineWidth = lw * 1.6; ctx.stroke(pB); ctx.fillStyle = m.base; ctx.fill(pB);
    ctx.save(); ctx.clip(pB); ctx.fillStyle = m.shade; ctx.beginPath(); ctx.ellipse(0, by * 0.35, bx * 0.8, by * 0.75, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.stroke(pC); ctx.fill(pC);
    ctx.save(); ctx.clip(pC); ctx.fillStyle = m.shade; ctx.fill(shiftedComp(pC, -R.lx * s * 0.12, -R.ly * s * 0.12), 'evenodd');
    const band = shape([[-s * 0.41, -s * 0.06], [0, -s * 0.03], [s * 0.41, -s * 0.06], [s * 0.41, s * 0.03], [0, s * 0.06], [-s * 0.41, s * 0.03]]);
    ctx.fillStyle = mb.base; ctx.fill(band); ctx.restore();
    ctx.strokeStyle = mb.line; ctx.lineWidth = lw; ctx.stroke(band);
    // bow + tails on the side away from the viewer's centre
    const bxp = s * 0.36, byp = s * 0.0, sw = W * 0.12 * s;
    ctx.fillStyle = mb.base; ctx.strokeStyle = mb.line; ctx.lineWidth = lw * 0.9;
    for (const [dx, dy] of [[-0.09, -0.04], [0.09, -0.03]]) { const p = shape([[bxp, byp], [bxp + dx * s, byp + dy * s - 0.03 * s], [bxp + dx * s * 1.1, byp + dy * s + 0.035 * s]]); ctx.fill(p); ctx.stroke(p); }
    for (const k of [0, 1]) {
      const ph = tq * (4.3 + k) + k * 1.7, L = s * (0.42 + 0.08 * k);
      const tail = [[bxp, byp], [bxp + sw * 0.5 + 0.06 * s + k * 0.02 * s, byp + L * 0.4 + 0.03 * s * sin(ph)], [bxp + sw + 0.1 * s, byp + L + 0.04 * s * sin(ph + 1)], [bxp + sw + 0.06 * s, byp + L * 0.95], [bxp + 0.02 * s, byp + 0.04 * s]];
      const p = shape(tail); ctx.fill(p); ctx.stroke(p);
    }
    ctx.restore();
  }

  /* ================================================================ props (3D placed, drawn as cel parts) */
  // affine matrix that maps a flat object's local 2D coords (axes ux, uy in body space, origin O) onto the screen
  function planeM(G, O, ux, uy) { const o = G.P2(O), a = G.Vr(ux), b = G.Vr(uy); return new DOMMatrix([a[0], a[1], b[0], b[1], o[0], o[1]]); }
  function tPath(localPts, M, k = 1, poly = false) { const p = new Path2D(); p.addPath(poly ? polyPath(localPts) : shape(localPts, k), M); return p; }
  // a box: centre c (body space), half sizes [hx, hy, hz], rotation Mr (3x3) -> visible faces as parts (top lit, sides shaded)
  function boxParts(G, c, h, Mr, mat, opt = {}) {
    const R = G.R, m = typeof mat === 'string' ? R.m(mat) : mat, out = [];
    const P = (x, y, z) => G.P2(v3.add(c, mv(Mr, [x * h[0], y * h[1], z * h[2]])));
    const faces = [
      { n: [0, -1, 0], q: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], tone: 'base' },
      { n: [0, 0, 1], q: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], tone: 'shade' },
      { n: [0, 0, -1], q: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]], tone: 'shade' },
      { n: [1, 0, 0], q: [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]], tone: 'deep' },
      { n: [-1, 0, 0], q: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], tone: 'deep' },
      { n: [0, 1, 0], q: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]], tone: 'deep' },
    ];
    let i = 0;
    for (const f of faces) {
      const nz = G.Vr(mv(Mr, f.n))[2]; if (nz <= 0.02) continue;
      const nv = G.Vr(mv(Mr, f.n)), lit = -(nv[0] * R.lx + nv[1] * R.ly);
      const tone = f.n[1] < 0 ? 'base' : lit > 0.25 ? 'base' : lit > -0.3 ? 'shade' : 'deep';
      const pts = f.q.map(([x, y, z]) => P(x, y, z));
      out.push({ name: (opt.name || 'box') + i, fam: (opt.name || 'box') + i++, path: polyPath(pts), m, fill: m[opt.tones ? opt.tones[f.tone] || tone : tone], lw: opt.lw || 0.8, rim: opt.rim });
    }
    return out;
  }
  function legPart(G, a3, b3, r, mat, name) { const c = capsule(G.P2(a3), G.P2(b3), [[0, r, r], [1, r * 0.9, r * 0.9]], { capK: 0.4, capK0: 0.4 }); return { name, fam: name, path: shape(c.pts), m: G.R.m(mat), band: r * 0.7, lw: 0.75 }; }

  // piano bench (anchor = seat top centre): padded top + lacquered frame + four legs
  function pianoBench(G, opt = {}) {
    const H = opt.h ?? 1.9, w = opt.w ?? 0.78, d = opt.d ?? 0.4, parts = [];
    const I = rot(opt.yaw || 0, 0, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push({ z: G.Z(mv(I, [sx * (w - 0.08), H * 0.6, sz * (d - 0.07)])), p: legPart(G, mv(I, [sx * (w - 0.1), 0.3, sz * (d - 0.1)]), mv(I, [sx * (w - 0.05), H, sz * (d - 0.05)]), 0.065, 'lacquer', 'bleg' + sx + sz) });
    parts.sort((a, b) => a.z - b.z);
    const out = parts.map(q => q.p);
    out.push(...boxParts(G, mv(I, [0, 0.2, 0]), [w, 0.12, d], I, 'lacquer', { name: 'bframe' }));
    out.push(...boxParts(G, mv(I, [0, 0.05, 0]), [w + 0.01, 0.06, d + 0.01], I, 'cushion', { name: 'bcush' }));
    return out;
  }
  // school chair (anchor = seat top centre), facing +z: wooden seat and back, steel frame
  function schoolChair(G, opt = {}) {
    const H = opt.h ?? 1.75, w = 0.5, d = 0.47, I = rot(opt.yaw || 0, 0, 0), out = [];
    const legs = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) legs.push({ z: G.Z(mv(I, [sx * w, H * 0.5, sz * d])), p: legPart(G, mv(I, [sx * (w - 0.04), 0.05, sz * (d - 0.04)]), mv(I, [sx * (w - 0.02), H, sz * (d - 0.02)]), 0.028, 'steel', 'cleg' + sx + sz) });
    for (const sx of [-1, 1]) legs.push({ z: G.Z(mv(I, [sx * w, -0.8, -d])), p: legPart(G, mv(I, [sx * (w - 0.04), 0.05, -d + 0.02]), mv(I, [sx * (w - 0.06), -1.55, -d - 0.12]), 0.026, 'steel', 'cpost' + sx) });
    legs.sort((a, b) => a.z - b.z);
    out.push(...legs.map(q => q.p));
    out.push(...boxParts(G, mv(I, [0, -1.2, -d - 0.08]), [w - 0.03, 0.26, 0.03], mv(I, rot(0, -0.12, 0)), 'wood', { name: 'cback' }));
    out.push(...boxParts(G, mv(I, [0, 0.03, 0]), [w, 0.035, d], I, 'wood', { name: 'cseat' }));
    return out;
  }
  // acoustic guitar: flat art placed on a plane (origin = body centre, ux = toward the headstock, uy = across the body)
  const ACOUSTIC = [[-1.15, 0], [-1.08, 0.5], [-0.75, 0.86], [-0.3, 0.84], [0.05, 0.6], [0.32, 0.66], [0.62, 0.6], [0.86, 0.32], [0.92, 0.11], [0.92, -0.11], [0.86, -0.32], [0.62, -0.6], [0.32, -0.66], [0.05, -0.6], [-0.3, -0.84], [-0.75, -0.86], [-1.08, -0.5]];
  const STRAT = [[-1.02, 0.02], [-0.92, 0.5], [-0.55, 0.72], [-0.15, 0.58], [0.12, 0.53], [0.42, 0.6], [0.62, 0.48, 1], [0.44, 0.28], [0.33, 0.12], [0.33, -0.12], [0.5, -0.28], [0.8, -0.5, 1], [0.56, -0.64], [0.12, -0.54], [-0.2, -0.6], [-0.6, -0.74], [-0.94, -0.5]];
  function guitarParts(G, kind, O, ux, uy, opt = {}) {
    const R = G.R, sc = opt.scale || 1;
    const nrm = v3.norm(v3.cross(ux, uy)), M = planeM(G, O, v3.mul(ux, sc), v3.mul(uy, sc));
    const front = G.Vr(nrm)[2] < 0;      // the top faces the viewer (normal = ux x uy points away)
    const th = (kind === 'strat' ? 0.17 : 0.42) / sc;
    const Mb = planeM(G, v3.add(O, v3.mul(nrm, th * sc * (front ? 1 : -1))), v3.mul(ux, sc), v3.mul(uy, sc));
    const body = kind === 'strat' ? STRAT : ACOUSTIC;
    const mBody = R.m(kind === 'strat' ? 'strat' : 'acoustic'), parts = [];
    const neckLen = kind === 'strat' ? 2.35 : 2.95, neck0 = kind === 'strat' ? 0.3 : 0.9, nw = kind === 'strat' ? 0.1 : 0.11;
    // rim (the body seen from the side) then the face
    parts.push({ name: 'grim', fam: 'grim', path: tPath(body, Mb), m: mBody, fill: kind === 'strat' ? mBody.shade : R.m('acoustic').deep, lw: 0.9 });
    const neck = [[neck0, -nw], [neckLen, -nw * 0.82], [neckLen, nw * 0.82], [neck0, nw]];
    const head = kind === 'strat' ? [[neckLen - 0.03, 0.09], [neckLen + 0.02, -0.1], [neckLen + 0.17, -0.22], [neckLen + 0.45, -0.24], [neckLen + 0.55, -0.15], [neckLen + 0.6, -0.02], [neckLen + 0.55, 0.06], [neckLen + 0.35, 0.07], [neckLen + 0.15, 0.1]]
      : [[neckLen - 0.03, -0.1], [neckLen + 0.1, -0.17], [neckLen + 0.67, -0.16, 1], [neckLen + 0.71, 0], [neckLen + 0.67, 0.16, 1], [neckLen + 0.1, 0.17], [neckLen - 0.03, 0.1]];
    const mNeck = R.m(kind === 'strat' ? 'maple' : 'rosewood');
    const faceP = tPath(body, M);
    const face = { name: 'gface', fam: 'gface', path: faceP, m: mBody, band: 0.1, hi: kind === 'strat' ? 0.025 : 0.02, hiA: 0.7, lines: [], shades: [] };
    if (front) {
      if (kind === 'strat') {
        const mG = R.m('guard');
        const guard = [[-0.62, -0.38], [-0.2, -0.46], [0.25, -0.4], [0.42, -0.22], [0.38, 0.2], [0.05, 0.42], [-0.45, 0.46], [-0.75, 0.2], [-0.78, -0.15]];
        face.after = (c, R2) => {
          c.save(); c.transform(M.a, M.b, M.c, M.d, M.e, M.f);
          const lw = R2.wDet / Math.max(0.2, Math.hypot(M.a, M.b));
          c.fillStyle = mG.base; c.strokeStyle = mG.line; c.lineWidth = lw; const pg = shape(guard); c.fill(pg); c.stroke(pg);
          // worn paint: wood showing through near the strumming arm
          c.fillStyle = R.m('maple').shade; c.globalAlpha = 0.55; c.fill(shape([[-0.98, 0.15], [-0.86, 0.45], [-0.66, 0.6], [-0.7, 0.42], [-0.9, 0.2]])); c.globalAlpha = 1;
          const mc = R.m('chrome');
          for (const x of [-0.42, -0.12, 0.16]) { c.fillStyle = mG.hi; c.beginPath(); c.roundRect(x - 0.045, -0.2, 0.09, 0.4, 0.04); c.fill(); c.stroke(); }
          c.fillStyle = mc.base; c.beginPath(); c.roundRect(-0.74, -0.2, 0.12, 0.4, 0.02); c.fill(); c.stroke();
          for (const [x, y] of [[-0.55, 0.33], [-0.38, 0.38], [-0.22, 0.4]]) { c.fillStyle = mG.shade; c.beginPath(); c.arc(x, y, 0.045, 0, TAU); c.fill(); c.stroke(); }
          c.restore();
        };
      } else {
        face.after = (c, R2) => {
          c.save(); c.transform(M.a, M.b, M.c, M.d, M.e, M.f);
          const lw = R2.wDet / Math.max(0.2, Math.hypot(M.a, M.b));
          c.strokeStyle = mBody.line; c.lineWidth = lw * 1.4; c.beginPath(); c.arc(0.42, 0, 0.27, 0, TAU); c.stroke();      // rosette
          c.fillStyle = R.m('rosewood').deep; c.beginPath(); c.arc(0.42, 0, 0.2, 0, TAU); c.fill();                          // sound hole
          c.fillStyle = R.m('rosewood').base; c.beginPath(); c.roundRect(-0.72, -0.26, 0.12, 0.52, 0.03); c.fill();         // bridge
          c.fillStyle = mBody.deep; c.globalAlpha = 0.35; c.fill(shape([[0.08, -0.5], [0.42, -0.33], [0.56, -0.18], [0.3, -0.16], [0.12, -0.3]])); c.globalAlpha = 1; // pick guard
          c.strokeStyle = mBody.line; c.globalAlpha = 0.45; c.lineWidth = lw * 0.6; c.beginPath(); c.moveTo(-0.95, 0.35); c.lineTo(-0.8, 0.5); c.moveTo(0.6, 0.45); c.lineTo(0.72, 0.38); c.stroke(); c.globalAlpha = 1; // scuffs
          c.restore();
        };
      }
    }
    parts.push(face);
    const neckP = { name: 'gneck', fam: 'gneck', path: tPath(neck, M, 1, true), m: mNeck, band: 0.03, lw: 0.85 };
    if (front) neckP.after = (c, R2) => {
      c.save(); c.transform(M.a, M.b, M.c, M.d, M.e, M.f); const lw = R2.wDet / Math.max(0.2, Math.hypot(M.a, M.b));
      c.strokeStyle = R.m('chrome').shade; c.lineWidth = lw * 0.7;
      for (let i = 1; i < 20; i++) { const x = neck0 + (neckLen - neck0) * (1 - Math.pow(0.94, i * 1.2)) * 1.55; if (x > neckLen - 0.02) break; c.beginPath(); c.moveTo(x, -nw * 0.9); c.lineTo(x, nw * 0.9); c.stroke(); }
      c.strokeStyle = R.m('chrome').hi; c.globalAlpha = 0.85; c.lineWidth = lw * 0.45;
      for (let i = 0; i < 6; i++) { const y = (i - 2.5) * nw * 0.3; c.beginPath(); c.moveTo(kind === 'strat' ? -0.72 : -0.66, y * 1.6); c.lineTo(neckLen, y); c.stroke(); }
      c.globalAlpha = 1; c.restore();
    };
    parts.push(neckP);
    parts.push({ name: 'ghead', fam: 'ghead', path: tPath(head, M), m: kind === 'strat' ? R.m('maple') : R.m('rosewood'), band: 0.03, lw: 0.85 });
    return { parts, M, front, nrm, at: (x, y) => v3.add(O, v3.add(v3.mul(ux, x * sc), v3.mul(uy, y * sc))) };
  }
  // juice carton with a straw (o: centre, Mr: rotation, the straw from the top toward 'straw' dir)
  function juiceParts(G, c, Mr, opt = {}) {
    const parts = boxParts(G, c, [0.085, 0.14, 0.055], Mr, 'carton', { name: 'jbox', lw: 0.6 });
    const front = parts.find(p => p.name === 'jbox1');
    const band = boxParts(G, v3.add(c, mv(Mr, [0, 0.03, 0])), [0.087, 0.05, 0.057], Mr, 'carton_band', { name: 'jband', lw: 0.5 });
    const top = v3.add(c, mv(Mr, [0.04, -0.14, 0.0])), tip = v3.add(top, mv(Mr, opt.straw || [-0.03, -0.17, 0.05]));
    const st = capsule(G.P2(top), G.P2(tip), [[0, 0.011, 0.011], [1, 0.011, 0.011]], { capK: 0.2, capK0: 0.2 });
    void front;
    return parts.concat(band, [{ name: 'straw', fam: 'straw', path: shape(st.pts), m: G.R.m('straw'), lw: 0.5 }]);
  }
  // a sofa seen from the front-oblique (anchor = seat top centre), width w
  function sofaParts(G, opt = {}) {
    const w = opt.w || 2.6, I = rot(opt.yaw || 0, 0, 0), out = [];
    out.push(...boxParts(G, mv(I, [0, -1.0, -0.62]), [w + 0.3, 0.75, 0.18], I, 'sofa', { name: 'sback' }));
    out.push(...boxParts(G, mv(I, [0, 0.35, 0.0]), [w + 0.3, 0.38, 0.62], I, 'sofa', { name: 'sbase' }));
    out.push(...boxParts(G, mv(I, [0, 0.0, 0.04]), [w, 0.12, 0.56], I, 'sofa', { name: 'sseat' }));
    for (const sx of [-1, 1]) out.push(...boxParts(G, mv(I, [sx * (w + 0.18), -0.45, -0.02]), [0.16, 0.42, 0.64], I, 'sofa', { name: 'sarm' + sx }));
    return out;
  }
  // a railing in front of / beside the figure: top bar + posts (x0..x1 along the body x axis, at depth z, height h)
  function railingParts(G, opt = {}) {
    const h = opt.h ?? 4.45, z = opt.z ?? 0.75, x0 = opt.x0 ?? -2.4, x1 = opt.x1 ?? 2.4, mat = opt.mat || 'rail', out = [];
    const I = rot(opt.yaw || 0, 0, 0);
    for (let x = x0 + 0.2; x <= x1; x += 1.6) out.push(legPart(G, mv(I, [x, -h, z]), mv(I, [x, 0, z]), 0.04, mat, 'rpost' + x.toFixed(1)));
    const bar = capsule(G.P2(mv(I, [x0, -h, z])), G.P2(mv(I, [x1, -h, z])), [[0, 0.06, 0.06], [1, 0.06, 0.06]], { capK: 0.3, capK0: 0.3 });
    out.push({ name: 'rbar', fam: 'rbar', path: shape(bar.pts), m: G.R.m(mat), band: 0.03, hi: 0.015, hiA: 0.6, lw: 0.85 });
    const bar2 = capsule(G.P2(mv(I, [x0, -h * 0.5, z])), G.P2(mv(I, [x1, -h * 0.5, z])), [[0, 0.03, 0.03], [1, 0.03, 0.03]], { capK: 0.3, capK0: 0.3 });
    out.push({ name: 'rbar2', fam: 'rbar2', path: shape(bar2.pts), m: G.R.m(mat), band: 0.02, lw: 0.75 });
    return out;
  }

  /* ================================================================ poses */
  // A pose = { facing (default), body(sp, prm, tq, o) -> {pelvis, spine, neck, shrugL/R, breath, head}, limbs(J, sp, prm, tq, o) ->
  //            {arms: {L, R}, legs: {L, R}}, props(G) (optional) }. Body space: anchor at the origin, +z = the character's front.
  const POSES = {};
  const breath = (tq) => 0.5 + 0.5 * sin(tq * TAU / 3.6);
  // the injured right arm rests in the sling: elbow at the side, forearm across the belly
  function slingArm(J, sp, prm, arms, OF) {
    if (!OF || !OF.cast || prm.castFree) return;
    arms.R = { E: J.at('c', -0.47, sp.chestY + 0.62, 0.12), W: J.at('c', 0.12, sp.chestY + 0.5, 0.34), hand: { f: [1, -0.15, 0.1], palm: [0, -0.3, -1], curl: 0.5 } };
  }

  POSES.stand = {
    facing: 'front', anchor: 'ground point between the feet',
    // params: weight -1..1 (+: on the character's left leg), arms 'relax'|'chest'|'behind'|'bow'|'strap', bow 0..1, twist,
    //         tilt (head roll), nod (head pitch), neckYaw, stance (foot spacing)
    body(sp, prm, tq) {
      const w = prm.weight ?? 0.5;
      const sway = 0.01 * N2(3.3, tq * 0.35);
      const bow = prm.bow || 0;
      return {
        pelvis: { pos: [w * 0.06 + sway, sp.hipY + abs(w) * 0.035 + bow * 0.04, -bow * 0.14], yaw: (prm.yaw || 0) - w * 0.05, pitch: 0.04 + bow * 0.3, roll: -w * 0.075 },
        spine: { twist: (prm.twist || 0) + w * 0.06, bend: -0.04 + bow * 0.5, side: w * 0.13 },
        neck: { pitch: 0.05 + bow * 0.3 + (prm.nod || 0), roll: -w * 0.07 + (prm.tilt || 0), yaw: prm.neckYaw || 0 },
        breath: breath(tq),
      };
    },
    props(G, prm, tq) {
      if ((prm.arms || '') === 'strat') { const g = stratFrame(G.J, G.sp, prm, tq, false); insertBeforeArm(G, null, guitarParts(G, 'strat', g.O, g.ux, g.uy, { scale: 1 }).parts.concat([g.strap(G)])); }
    },
    armsFrontWhen: (prm) => ['strat', 'keys', 'cover', 'reach'].includes(prm.arms),
    limbs(J, sp, prm, tq) {
      const w = prm.weight ?? 0.5, arms = {}, legs = {};
      const st = prm.stance ?? (sp.girl ? 0.11 : 0.16);
      for (const s of ['L', 'R']) {
        const sg = s === 'L' ? 1 : -1, load = sg * w > 0 ? abs(w) : 0, free = sg * w < 0 ? abs(w) : 0;
        // the loaded leg plants under the pelvis; the free leg steps a little out and forward, its knee turning in
        const H = J['H' + s];
        legs[s] = {
          A: [H[0] * 0.25 + sg * st * (1 - load * 0.7) + sg * free * 0.06, -sp.ankleH, free * 0.12 - load * 0.02],
          pole: [-sg * free * 0.6, 0, 1], foot: { dir: [sg * (0.2 + free * 0.25), 0, 1] },
        };
        const swing = 0.012 * sin(tq * 1.3 + sg);
        arms[s] = {
          W: v3.add(J['S' + s], [sg * (sp.girl ? 0.09 : 0.1), sp.upArm + sp.foreArm - 0.12, 0.12 + swing]),
          pole: [sg * 0.35, 0, -1], hand: { curl: 0.42, f: [-sg * 0.1, 1, 0.16] },
        };
      }
      const pose = prm.arms || 'relax';
      slingArm(J, sp, prm, arms, arguments[5]);
      if (pose === 'chest') { // her right hand pressed to her chest
        arms.R = { W: J.at('c', 0.02, sp.chestY - 0.06, 0.36), pole: [-1, 0.4, -0.3], hand: { curl: 0.2, spread: 0.12, f: [0.75, -0.45, 0.1], palm: [0, 0, -1] } };
      } else if (pose === 'behind') {
        for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; arms[s] = { W: J.at('p', sg * 0.06, sp.hipY + 0.05, -0.34), pole: [sg * 0.8, 0, -0.5], hand: { curl: 0.4, f: [-sg, 0.4, 0], view: 'edge' } }; }
      } else if (pose === 'bow') {
        for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; arms[s] = { W: J.at('p', sg * 0.07, sp.hipY + 0.32, 0.3), pole: [sg * 0.3, 0, -1], hand: { curl: 0.2, f: [-sg * 0.4, 1, 0.3] } }; }
      } else if (pose === 'cover') { // the left hand pressed over the face (crying)
        arms.L = { W: v3.add(J.neckTop, [0.05, -0.12, 0.38]), pole: [1, 0.6, -0.2], hand: { f: [-0.5, -1, 0.1], palm: [0, 0, -1], curl: 0.25, spread: 0.2 } };
      } else if (pose === 'reach') { // one hand reaching out (toward the camera / a partner)
        arms.R = { W: J.at('c', -0.35, sp.chestY + 0.2, 1.6), pole: [-1, 0.3, -0.4], hand: { f: [0, 0.1, 1], palm: [0.3, 1, 0], curl: 0.25, spread: 0.5 } };
      } else if (pose === 'pocket') { // hands in the trouser pockets
        for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; arms[s] = { W: J.at('p', sg * 0.4, sp.hipY - 0.08, 0.12), pole: [sg, 0, -0.6], hand: { hidden: true } }; }
      } else if (pose === 'strat' || pose === 'keys') { // playing the white Strat on a strap / a keyboard stand at hip height
        if (pose === 'strat') {
          const g = stratFrame(J, sp, prm, tq, false);
          arms.L = { W: g.fret, pole: [1, 0.6, -0.5], hand: { f: [0.2, 0.6, 0.6], palm: [-0.5, 0, -1], curl: 0.6 } };
          arms.R = { W: v3.add(g.strum, [0, 0.05 * sin(tq * 8), 0]), pole: [-1, 0.3, -0.8], hand: { f: [0.6, 0.6, 0.4], palm: [0, 0, -1], curl: 0.5 } };
        } else {
          for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; arms[s] = { W: [sg * (0.32 + 0.12 * (0.5 + 0.5 * sin(tq * 3 + sg))), sp.hipY - 0.55 - 0.05 * max(0, sin(tq * 6 + sg)), 0.95], pole: [sg, 0.2, -0.5], hand: { f: [0, 0.45, 1], palm: [0, 1, -0.1], curl: 0.6 } }; }
        }
      }
      return { arms, legs };
    },
  };

  /* ---------------------------------------------------------------- a) piano: 先輩 at the grand piano */
  // anchor: top centre of the bench. The keyboard is in front of her (+z): keys ~1.0 head above the seat, ~1.12 in front.
  // params: intensity 0..1 (calm -> 〈雪あらし〉), play 0..1 (hands moving), hands 'keys'|'lap'|'lift', look 'keys'|'ahead'|'up',
  //         breathe 0..1 (heavy breathing after the last chord), lean, tilt, neckYaw, bench (true), keyH, keyZ, benchH
  POSES.piano = {
    facing: '3q_right', anchor: 'top centre of the piano bench',
    body(sp, prm, tq) {
      const I = prm.intensity ?? 0.4, ph = tq * (1.2 + I * 1.6);
      const sway = I * (0.07 * sin(ph * 0.7) + 0.03 * N2(4.1, tq * 1.1));
      const surge = Math.pow(max(0, sin(ph * 0.45 + 1)), 2) * I;
      const hb = prm.breathe || 0, br = hb ? 0.5 + 0.5 * sin(tq * TAU / 1.3) : breath(tq);
      const look = prm.look || 'keys';
      return {
        pelvis: { pos: [sway * 0.25, -0.27, -0.06], yaw: 0, pitch: 0.07 + 0.05 * I + hb * 0.04 * br, roll: -sway * 0.4 },
        spine: { twist: -sway * 0.5, bend: 0.07 + 0.1 * surge + (prm.lean || 0) + hb * 0.06 * br, side: sway * 0.7 },
        neck: { pitch: (look === 'up' ? -0.3 : look === 'ahead' ? -0.05 : 0.12) + 0.05 * surge, roll: sway * 0.6 + (prm.tilt || 0), yaw: prm.neckYaw || 0 },
        breath: hb ? br * (1 + hb * 2) : br, shrugL: 0.02 * surge + hb * 0.03 * br, shrugR: 0.02 * surge + hb * 0.03 * br,
        seated: true, seatY: 0,
      };
    },
    limbs(J, sp, prm, tq) {
      const I = prm.intensity ?? 0.4, play = prm.play ?? 1, ph = tq * (1.6 + I * 2.2), kY = -(prm.keyH ?? 1.0), kZ = prm.keyZ ?? 1.12;
      const legs = {}, arms = {}, H = prm.benchH ?? 1.9;
      for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; legs[s] = { A: [sg * 0.15, H - sp.ankleH, 1.66 + (s === 'R' ? 0.12 : 0)], pole: [sg * 0.15, -1, 0.7], foot: { dir: [sg * 0.12, 0.22, 1] } }; }
      const handPos = (sg, k) => {
        const travel = play * (0.18 + 0.32 * I) * (0.5 + 0.5 * sin(ph * (0.8 + 0.15 * k) + k * 2.1)) + 0.03 * N2(k * 3.3, tq * 2);
        const lift = play * max(0, sin(ph * (2.3 + 0.4 * k) + k)) * (0.04 + 0.08 * I);
        return [sg * (0.3 + travel), kY - lift - (prm.hands === 'lift' ? 0.18 : 0), kZ];
      };
      if (prm.hands === 'lap') {
        for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; arms[s] = { W: [sg * 0.1, -0.3, 0.8], pole: [sg, 0.3, -0.6], hand: { f: [-sg * 0.7, 0.35, 0.6], palm: [0, 1, 0], curl: 0.3 } }; }
      } else {
        arms.L = { W: handPos(1, 0), pole: [0.45, 1, -0.35], hand: { f: [-0.1, 0.18, 1], palm: [0, 1, -0.1], curl: prm.hands === 'lift' ? 0.3 : 0.55 } };
        arms.R = { W: handPos(-1, 1), pole: [-0.45, 1, -0.35], hand: { f: [0.1, 0.18, 1], palm: [0, 1, -0.1], curl: prm.hands === 'lift' ? 0.3 : 0.55 } };
      }
      return { arms, legs };
    },
    props(G, prm) { if (prm.bench !== false) for (const p of pianoBench(G, { h: prm.benchH })) G.add(abs(G.theta) > HP ? 'propsMid' : 'propsBack', p); },
  };

  POSES.piano_back = Object.assign({}, POSES.piano, { facing: '3q_back_right' });

  /* ---------------------------------------------------------------- b) seated on a school chair */
  // anchor: top centre of the chair seat. params.variant 'idle'|'juice'|'clap'|'guitar'; sip 0..1 (juice: the straw at his mouth),
  // claps [t...] (global seconds of each clap) or clap 0..1; strum 0..1; headDown; chair (true); seatH; cross (legs crossed)
  POSES.seated_chair = {
    facing: '3q_left', anchor: 'top centre of the chair seat',
    armsFront: true,
    body(sp, prm, tq) {
      const v = prm.variant || 'idle';
      const lean = v === 'guitar' ? 0.2 : v === 'clap' ? 0.06 : -0.08;
      return {
        pelvis: { pos: [0, -0.28, -0.14], pitch: lean * 0.5 - 0.06, roll: 0, yaw: 0 },
        spine: { bend: lean + (prm.slump || 0), twist: v === 'guitar' ? 0.1 : 0, side: 0 },
        neck: { pitch: v === 'guitar' ? 0.3 + (prm.headDown || 0) : (prm.nod ?? 0.06) + (v === 'juice' ? 0.1 * (prm.sip ?? 1) : 0), roll: prm.tilt || 0, yaw: prm.neckYaw || 0 },
        breath: breath(tq), seated: true, seatY: 0,
      };
    },
    limbs(J, sp, prm, tq, o) {
      const v = prm.variant || 'idle', legs = {}, arms = {}, H = prm.seatH ?? (sp.girl ? 1.85 : 1.75);
      const spread = v === 'guitar' ? 0.34 : 0.26;
      for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; legs[s] = { A: [sg * spread, H - sp.ankleH, 1.5 + (s === 'L' ? 0.14 : 0)], pole: [sg * 0.25, -1, 0.6], foot: { dir: [sg * 0.22, 0, 1] } }; }
      for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; arms[s] = { W: [sg * 0.24, -0.24, 0.92], pole: [sg, 0.4, -0.5], hand: { f: [-sg * 0.25, 0.25, 1], palm: [0, 1, 0], curl: 0.35 } }; }
      if (v === 'juice') {
        const sip = prm.sip ?? 1, nt = J.neckTop;
        const atMouth = v3.add(nt, [-0.04, 0.18, 0.4]), onKnee = [-0.28, -0.32, 1.25];
        arms.R = { W: v3.lerp(onKnee, atMouth, sstep(0, 1, sip)), pole: [-1, 0.9, -0.3], hand: { kind: 'grip', f: [0.9, -0.1, 0.3], palm: [0, 0, -1], curl: 0.8 } };
      } else if (v === 'clap') {
        let k = prm.clap ?? 0;
        if (prm.claps) { const T = o.T || 0; for (const c of prm.claps) { const d = T - c; if (d > -0.12 && d < 0.18) k = max(k, d < 0 ? 1 + d / 0.12 : 1 - d / 0.18); } }
        const gap = lerp(0.22, 0.0, clamp(k));
        const c0 = J.at('c', 0, G_CHEST(sp) + 0.45, 0.62);
        arms.L = { W: v3.add(c0, [0.04 + gap, 0, 0]), pole: [1, 0.6, -0.4], hand: { f: [-0.25, -1, 0.35], palm: [-1, 0, 0], curl: 0.08, view: 'side' } };
        arms.R = { W: v3.add(c0, [-0.04 - gap, 0.02, 0]), pole: [-1, 0.6, -0.4], hand: { f: [0.25, -1, 0.35], palm: [1, 0, 0], curl: 0.08, view: 'side' } };
      } else if (v === 'guitar') {
        const g = guitarFrame(J, sp, prm, tq);
        arms.L = { W: g.fret, pole: [1, 0.8, -0.6], hand: { f: v3.add(v3.mul(g.uy, -1), [0, -0.3, 0]), palm: v3.mul(g.nrm, -1), curl: 0.65 } };
        arms.R = { W: g.strum, pole: [-1, 0.2, -1], hand: { f: v3.add(g.uy, [0, 0.4, 0]), palm: v3.mul(g.nrm, 1), curl: 0.45 } };
      }
      return { arms, legs };
    },
    props(G, prm, tq) {
      const v = prm.variant || 'idle';
      if (prm.chair !== false) for (const p of schoolChair(G, { h: prm.seatH })) G.add('propsBack', p);
      if (v === 'juice') {
        const W = G.J.WR, fa = v3.norm(v3.sub(G.J.WR, G.J.ER));
        const c = v3.add(W, v3.add(v3.mul(fa, 0.07), [0, -0.05, 0])), sip = prm.sip ?? 1;
        const Mr = rot(0.3, 0, lerp(0.0, -0.35, sip));
        insertBeforeArm(G, 'R', juiceParts(G, c, Mr, { straw: lerp2([-0.0, -0.17], [0.06, -0.15], sip).concat([0.08]) }), true);
      }
      if (v === 'guitar') {
        const g = guitarFrame(G.J, G.sp, prm, tq);
        insertBeforeArm(G, null, guitarParts(G, 'acoustic', g.O, g.ux, g.uy, { scale: 0.92 }).parts);
      }
    },
  };
  function G_CHEST(sp) { return sp.chestY; }
  // the acoustic on his right thigh: body centre, axes (ux toward the headstock = his left and up; uy across the body)
  function guitarFrame(J, sp, prm, tq) {
    const KR = J.KR || v3.add(J.HR, [-0.06, 0.03, sp.thigh * 0.97]);       // limbs run before the IK: estimate the knee
    const thigh = v3.lerp(J.HR, KR, 0.45);
    const O = v3.add(thigh, [0.05, -0.42, 0.18]);
    const ux = v3.norm([1, -0.42, 0.18]), up0 = [0, -1, 0];
    const nrm = v3.norm(v3.cross(ux, v3.norm([0, 0.25, -1])));      // the top faces forward-up
    const uy = v3.norm(v3.cross(nrm, ux));
    const strum = 0.06 * sin(tq * 9.0) * (prm.strum ?? 0.6);
    return { O, ux, uy: v3.mul(uy, -1), nrm: v3.mul(nrm, -1), fret: v3.add(O, v3.add(v3.mul(ux, 2.1 * 0.92), v3.mul(uy, 0.22))), strum: v3.add(O, v3.add(v3.mul(ux, (0.25 + strum) * 0.92), v3.add(v3.mul(uy, -0.05), v3.mul(nrm, -0.12)))), up0 };
  }
  // insert prop parts into the body layer just before an arm (or before every arm), so the hands grip over the prop
  function insertBeforeArm(G, side, parts, afterHand) {
    const L = side && G.overHeadSide === side ? (G.layers.overHead || (G.layers.overHead = [])) : (G.layers.main || (G.layers.main = []));
    let i = L.findIndex(p => p.isArm && (!side || p.isArm === side) && (!afterHand || p.name.startsWith('hand') || p.name.startsWith('thumb')));
    if (afterHand) { const j = L.findIndex(p => p.isArm === side && p.name.startsWith('thumb')); i = j >= 0 ? j : i; }
    if (i < 0) i = L.length;
    L.splice(i, 0, ...parts);
  }

  /* ---------------------------------------------------------------- h) kneeling with the white Strat (stage) */
  // anchor: the floor point under his knees. params.variant 'raise' (Strat held up, face to the sky) | 'down' (head bowed, guitar on
  // the strap) ; params.look (neck pitch override)
  POSES.kneel_guitar = {
    facing: '3q_left', anchor: 'floor under the knees', armsFront: true,
    body(sp, prm, tq) {
      const up = (prm.variant || 'raise') === 'raise', br = 0.02 * sin(tq * 1.3);
      return {
        pelvis: { pos: [0, -(sp.thigh * (up ? 0.96 : 0.86) + 0.12), up ? -0.12 : -0.3], pitch: up ? -0.1 : 0.2, roll: 0.02, yaw: 0 },
        spine: { bend: up ? -0.28 + br : 0.16 + br, twist: 0, side: 0 },
        neck: { pitch: prm.look ?? (up ? -0.55 : 0.3), roll: up ? 0.05 : -0.06 },
        breath: breath(tq),
      };
    },
    limbs(J, sp, prm, tq) {
      const up = (prm.variant || 'raise') === 'raise', legs = {}, arms = {};
      for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; legs[s] = { K: [sg * 0.2, -0.12, 0.08 + (s === 'L' ? 0.05 : 0)], A: [sg * 0.19, -0.16, -1.66], foot: { dir: [0, 0.6, -1], tip: 0.5 } }; }
      if (up) {
        const shake = 0.025 * sin(tq * 7);
        arms.L = { W: v3.add(J.SL, [0.12, -1.95 + shake, 0.3]), pole: [1, 0, -0.3], hand: { kind: 'grip', f: [0, -1, 0.2], palm: [0, 0, -1], curl: 0.8 } };
        arms.R = { W: v3.add(J.SR, [-0.05, -1.98 - shake, 0.32]), pole: [-1, 0, -0.3], hand: { kind: 'grip', f: [0, -1, 0.2], palm: [0, 0, -1], curl: 0.8 } };
      } else {
        arms.L = { W: J.at('p', 0.32, sp.hipY - 0.15, 0.62), pole: [1, 0.6, -0.4], hand: { f: [-0.2, 0.7, 0.6], palm: [-0.3, 0.2, -1], curl: 0.45 } };
        arms.R = { W: J.at('p', -0.25, sp.hipY - 0.3, 0.58), pole: [-1, 0.6, -0.4], hand: { f: [0.3, 0.7, 0.5], palm: [0.3, 0.2, -1], curl: 0.45 } };
      }
      return { arms, legs };
    },
    props(G, prm, tq) {
      const up = (prm.variant || 'raise') === 'raise';
      const g = stratFrame(G.J, G.sp, prm, tq, up);
      insertBeforeArm(G, null, guitarParts(G, 'strat', g.O, g.ux, g.uy, { scale: 1 }).parts.concat(g.strap ? [g.strap(G)] : []));
    },
  };
  function stratFrame(J, sp, prm, tq, up) {
    if (prm.variant === 'down') { // the guitar leans against his thighs, neck up past his shoulder
      const O = J.at('p', 0.02, sp.hipY + 0.05, 0.7);
      const ux = v3.norm([0.25, -1, 0.25]), uy = v3.norm(v3.cross(v3.norm([0.0, 0.2, -1]), ux));
      return { O, ux, uy };
    }
    if (up) {
      const mid = v3.lerp(J.WL, J.WR, 0.5);
      const ux = v3.norm(v3.sub(J.WL, J.WR)), uy = v3.norm(v3.cross([0, 0, 1], ux));
      return { O: v3.add(mid, v3.add(v3.mul(ux, -0.75), [0, -0.05, 0.05])), ux, uy };
    }
    const O = J.at('p', -0.22, sp.hipY - 0.05, 0.4);
    const ux = v3.norm([0.9, -0.38, 0.16]), uy = v3.norm(v3.cross(v3.norm([0.08, 0.15, -1]), ux));
    return {
      O, ux, uy, fret: v3.add(O, v3.add(v3.mul(ux, 1.7), v3.mul(uy, 0.18))), strum: v3.add(O, v3.add(v3.mul(ux, -0.1), [0, -0.05, 0.16])),
      strap: (G) => { const a = G.P2(v3.add(O, v3.mul(ux, -0.95))), b = G.P2(J.SR), c = G.P2(v3.add(O, v3.mul(ux, 0.6))); const cp = capsule(a, b, [[0, 0.04, 0.04], [1, 0.04, 0.04]], { capK: 0.2, capK0: 0.2 }); void c; return { name: 'strap', fam: 'strap', path: shape(cp.pts), m: G.R.m('strap'), band: 0.02, lw: 0.7 }; },
    };
  }

  /* ---------------------------------------------------------------- f) running (toward the camera in 3/4) */
  // anchor: ground point under the pelvis. params: speed (cycles/s), phase, stride 0..1 (0.75 in heels), arms 'swing'|'open' (arms opening
  // for the leap)
  POSES.run = {
    facing: '3q_left', anchor: 'ground under the pelvis',
    body(sp, prm, tq) {
      const cyc = (prm.phase ?? 0) + tq * (prm.speed ?? 1.4), st = prm.stride ?? 0.8;
      const c = TAU * cyc;
      // leg angles (thigh swing a, knee bend b) for both legs; the pelvis height plants the lower foot on the ground
      const leg = (p) => { const a = 0.62 * sin(p) * st, b = 0.22 + 1.25 * max(0, sin(p - 0.9)) * st + 0.1 * st; return { a, b }; };
      const L = leg(c), Rg = leg(c + PI);
      const hgt = (q) => sp.thigh * cos(q.a) + sp.shin * cos(q.a - q.b);
      const hip = max(hgt(L), hgt(Rg)) + sp.ankleH * 0.85 + 0.03 * max(0, sin(2 * c));   // short flight phase
      return {
        pelvis: { pos: [0, -hip, 0], pitch: 0.12 + 0.05 * st, yaw: 0.12 * sin(c) * st, roll: 0.035 * sin(c) },
        spine: { twist: -0.26 * sin(c) * st, bend: 0.1 + 0.03 * abs(sin(c)), side: -0.03 * sin(c) },
        neck: { pitch: -0.14, roll: 0.03 * sin(c), yaw: 0.08 * sin(c) * st },
        breath: 0.5 + 0.5 * sin(c * 2), run: { c, st, legs: { L, R: Rg } },
      };
    },
    limbs(J, sp, prm, tq) {
      const { c, st, legs: LG } = J.P.run, legs = {}, arms = {};
      const soft = (prm.style ?? (sp.girl ? 'girl' : 'boy')) === 'girl';
      for (const s of ['L', 'R']) {
        const sg = s === 'L' ? 1 : -1, p = c + (s === 'L' ? 0 : PI), { a, b } = LG[s];
        const H = J['H' + s], K = v3.add(H, [sg * 0.02, cos(a) * sp.thigh, sin(a) * sp.thigh]);
        const An = v3.add(K, [0, cos(a - b) * sp.shin, sin(a - b) * sp.shin]);
        const air = max(0, sin(p - 0.9));
        legs[s] = { K, A: An, foot: { dir: [sg * 0.08, 0.15 + 0.55 * air, 1], tip: 0.15 + 0.3 * air } };
        // arms pump against the legs: elbows bent, the forward hand comes up toward the chest, the back elbow drives back
        const ua = -(soft ? 0.62 : 0.9) * sin(p) * st;
        const E = v3.add(J['S' + s], [sg * (soft ? 0.14 : 0.1), cos(ua) * sp.upArm, sin(ua) * sp.upArm]);
        const fa = ua + (soft ? 1.3 : 1.35) + 0.3 * sin(p) * st;
        let W = v3.add(E, [-sg * (soft ? 0.12 : 0.14), cos(fa) * sp.foreArm, sin(fa) * sp.foreArm]);
        if (prm.arms === 'open') { E[0] += sg * 0.35; E[1] -= 0.25; W = v3.add(E, [sg * 0.45, -0.25, 0.65]); }
        arms[s] = { E, W, hand: { kind: prm.arms === 'open' || soft ? undefined : 'fist', f: v3.norm(v3.sub(W, E)), palm: [-sg, 0, 0], curl: prm.arms === 'open' ? 0.2 : soft ? 0.6 : 0.75 } };
      }
      return { arms, legs };
    },
  };

  /* ---------------------------------------------------------------- e) at a railing */
  // anchor: ground between the feet; the rail runs along x in front of her (z = railZ, top at -railH).
  // params.variant 'lean' (forearms on the rail, C15) | 'hold' (hands on the rail, C27) | 'hat' (one hand holding the hat brim);
  // railing (draw the rail, default false), railH (4.45), railZ (0.78), railMat ('rail' | 'steel'), turn (twist toward the camera)
  POSES.railing = {
    facing: '3q_left', anchor: 'ground between the feet',
    body(sp, prm, tq) {
      const v = prm.variant || 'lean', lean = v === 'lean' ? 0.42 : v === 'hat' ? 0.14 : 0.06;
      return {
        pelvis: { pos: [0.03, sp.hipY + 0.05, -0.12 - lean * 0.15], pitch: lean * 0.5, roll: -0.04, yaw: 0 },
        spine: { bend: lean * 0.7, twist: prm.turn || 0, side: 0.04 },
        neck: { pitch: v === 'lean' ? -0.25 : 0.05, roll: prm.tilt || 0, yaw: (prm.turn || 0) * 0.8 + (prm.neckYaw || 0) },
        breath: breath(tq),
      };
    },
    limbs(J, sp, prm, tq, o, OF) {
      const v = prm.variant || 'lean', legs = {}, arms = {}, h = prm.railH ?? 4.45, z = prm.railZ ?? 0.78;
      for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; legs[s] = { A: [sg * 0.12 + (s === 'R' ? 0.06 : 0), -sp.ankleH, s === 'R' ? 0.12 : -0.05], pole: [sg * 0.1, 0, 1], foot: { dir: [sg * 0.25, 0, 1] } }; }
      if (v === 'lean' || v === 'hat') {
        for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; arms[s] = { E: [sg * 0.36, -h + 0.02, z - 0.05], W: [sg * 0.06, -h - 0.04, z + 0.12], hand: { f: [-sg, -0.1, 0.2], palm: [0, 1, 0], curl: 0.35 } }; }
        if (v === 'hat') { const top = v3.add(J.neckTop, [-0.42, -0.62, 0.3]); arms.R = { W: top, pole: [-1, 0.3, -0.5], hand: { f: [0.3, -0.6, 0.5], palm: [0.3, 0.6, -0.7], curl: 0.4 } }; }
      } else {
        for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; arms[s] = { W: [sg * 0.36, -h - 0.02, z], pole: [sg, 0.3, -0.6], hand: { kind: 'grip', f: [0, 0.35, 1], palm: [0, 1, 0], curl: 0.8 } }; }
      }
      slingArm(J, sp, prm, arms, OF);
      return { arms, legs };
    },
    props(G, prm) { if (prm.railing) for (const p of railingParts(G, { h: prm.railH, z: prm.railZ, mat: prm.railMat })) G.add(G.Z([0, -4, prm.railZ ?? 0.78]) > G.Z([0, -4, 0]) ? 'front' : 'propsBack', p); },
  };

  /* ---------------------------------------------------------------- d) sitting on the ground / on a sofa */
  // anchor: the ground (or seat) point under the pelvis. params: knees 'up'|'cross'|'out', arms 'knees'|'prop'|'lap'|'hug',
  // lean 0..1 (sideways toward params.leanDir +1 = her left / -1 = her right: the head comes to rest on a shoulder), look (neck yaw)
  POSES.sit_ground = {
    facing: '3q_left', anchor: 'ground under the pelvis',
    body(sp, prm, tq) {
      const ln = prm.lean || 0, ld = prm.leanDir ?? 1, sofa = !!prm.sofa;
      return {
        pelvis: { pos: [ld * ln * 0.08, -(sp.girl ? 0.26 : 0.28), -0.05], pitch: sofa ? -0.18 : -0.06, roll: 0, yaw: 0 },
        spine: { bend: (sofa ? 0.02 : 0.14) + (prm.slump || 0), side: ld * ln * 0.26, twist: (prm.twist || 0) + ld * ln * 0.1 },
        neck: { pitch: (prm.nod ?? 0.06) + ln * 0.1, roll: ld * ln * 0.42 + (prm.tilt || 0), yaw: (prm.look || 0) + ld * ln * 0.2 },
        breath: breath(tq), seated: true, seatY: 0.0,
      };
    },
    limbs(J, sp, prm, tq) {
      const legs = {}, arms = {}, kn = prm.knees || 'up', sofa = !!prm.sofa, H = sofa ? (prm.seatH ?? 1.55) : 0;
      for (const s of ['L', 'R']) {
        const sg = s === 'L' ? 1 : -1;
        if (sofa) legs[s] = { A: [sg * 0.2, H - sp.ankleH, 1.45 + (s === 'L' ? 0.1 : 0)], pole: [sg * 0.2, -1, 0.6], foot: { dir: [sg * 0.2, 0, 1] } };
        else if (kn === 'up') legs[s] = { A: [sg * 0.2, -sp.ankleH + 0.02, 1.62], pole: [sg * 0.15, -1, 0.25], foot: { dir: [sg * 0.15, 0, 1] } };
        else if (kn === 'out') legs[s] = { A: [sg * 0.3, -0.2, 2.9], pole: [sg * 0.2, -1, 0.3], foot: { dir: [sg * 0.3, -0.6, 1] } };
        else legs[s] = { A: [-sg * 0.35, -0.2, 1.05], pole: [sg * 1, -0.6, 0.4], foot: { dir: [-sg, 0, 0.6] } };   // cross-legged
      }
      const knee = (s) => (kn === 'up' && !sofa ? [s === 'L' ? 0.22 : -0.22, -1.28, 0.95] : [s === 'L' ? 0.22 : -0.22, -0.3, 1.2]);
      const a = prm.arms || (sp.girl ? 'knees' : 'prop');
      for (const s of ['L', 'R']) {
        const sg = s === 'L' ? 1 : -1;
        if (a === 'knees' || a === 'hug') arms[s] = { W: v3.add(knee(s), [-sg * (a === 'hug' ? 0.25 : 0.05), a === 'hug' ? 0.25 : -0.02, a === 'hug' ? 0.15 : 0.1]), pole: [sg, 0.5, -0.4], hand: { f: [-sg * 0.8, 0.3, 0.4], palm: [0, 0.6, -0.8], curl: 0.4 } };
        else if (a === 'lap') arms[s] = { W: [sg * 0.12, -0.38, 0.72], pole: [sg, 0.3, -0.5], hand: { f: [-sg * 0.7, 0.3, 0.6], palm: [0, 1, 0], curl: 0.35 } };
        else arms[s] = { W: [sg * 0.48, -0.06, -0.55], pole: [sg * 0.5, -0.3, 1], hand: { f: [sg * 0.3, 0.2, -1], palm: [0, 1, 0], curl: 0.25 } };   // propped behind
      }
      if (prm.armR) arms.R = Object.assign({}, arms.R, prm.armR);
      if (prm.armL) arms.L = Object.assign({}, arms.L, prm.armL);
      return { arms, legs };
    },
    props(G, prm) { if (prm.sofaProp) for (const p of sofaParts(G, { w: prm.sofaW })) G.add('propsBack', p); },
  };

  /* ---------------------------------------------------------------- lying on the back (彼 on the wet ground) / kneeling up / straddle */
  // anchor: the ground under the pelvis; the head toward -z (body space). params.headUp (lift the head), arms 'side'|'reach'|'chest'
  POSES.lie_back = {
    facing: 'left', anchor: 'ground under the pelvis',
    body(sp, prm, tq) {
      return {
        pelvis: { pos: [0, -0.26, 0], pitch: -HP + 0.04, roll: 0.03, yaw: 0 },
        spine: { bend: (prm.headUp || 0) * 0.35, side: 0, twist: 0.05 },
        neck: { pitch: 0.25 + (prm.headUp || 0) * 0.7, roll: 0, yaw: prm.look || 0 },
        breath: 0.5 + 0.5 * sin(tq * TAU / 1.6),
      };
    },
    limbs(J, sp, prm, tq) {
      const legs = {}, arms = {};
      for (const s of ['L', 'R']) {
        const sg = s === 'L' ? 1 : -1;
        legs[s] = { A: [sg * 0.25, -0.2, sp.thigh + sp.shin - 0.25 + (s === 'L' ? -0.3 : 0)], pole: [0, -1, 0.2], foot: { dir: [sg * 0.25, -1, 0.3] } };
        arms[s] = { W: [sg * 0.62, -0.12, -1.3], pole: [sg, -0.2, 0.3], hand: { f: [sg * 0.2, 0.2, 1], palm: [0, 1, 0], curl: 0.4 } };
      }
      if (prm.arms === 'reach') arms.R = { W: [-0.25, -2.2, -1.4], pole: [-1, 0, 0.5], hand: { f: [0, -1, 0.2], palm: [0, 0, 1], curl: 0.25, spread: 0.4 } };
      if (prm.arms === 'chest') arms.R = { W: [0.05, -0.55, -1.25], pole: [-1, -0.4, 0.2], hand: { f: [1, 0, 0.3], palm: [0, 1, 0], curl: 0.3 } };
      return { arms, legs };
    },
  };
  // kneeling upright / leaning over on all fours (rise 0 = over him on her hands, 1 = upright on her knees, face to the sky)
  POSES.kneel_up = {
    facing: 'right', anchor: 'ground under the knees',
    body(sp, prm, tq) {
      const r = prm.rise ?? 1, sob = (prm.sob || 0) * 0.025 * sin(tq * 9);
      return {
        pelvis: { pos: [0, -(sp.thigh * lerp(0.62, 0.95, r) + 0.12), lerp(-0.55, -0.1, r)], pitch: lerp(0.95, -0.05, r), roll: 0, yaw: 0 },
        spine: { bend: lerp(0.35, -0.2, r) + sob, side: 0, twist: 0 },
        neck: { pitch: prm.look ?? lerp(0.25, -0.6, r), roll: 0.05 },
        breath: 0.5 + 0.5 * sin(tq * TAU / 1.4),
      };
    },
    limbs(J, sp, prm, tq, o, OF) {
      const r = prm.rise ?? 1, legs = {}, arms = {};
      for (const s of ['L', 'R']) {
        const sg = s === 'L' ? 1 : -1;
        legs[s] = { K: [sg * 0.2, -0.12, 0.08], A: [sg * 0.19, -0.15, -1.66], foot: { dir: [0, 0.5, -1], tip: 0.4 } };
        const down = [sg * 0.34, -0.06, prm.reach ?? 1.6], up = v3.add(J['S' + s], [sg * 0.12, 1.95, 0.25]);
        arms[s] = { W: v3.lerp(down, up, sstep(0, 1, r)), pole: [sg, -0.2, -0.5], hand: { f: v3.lerp([0, 0.3, 1], [0, 1, 0.2], r), palm: v3.lerp([0, 1, 0], [-sg, 0, 0], r), curl: 0.35 } };
      }
      if (prm.fist) arms.L = { W: v3.add(J.SL, [-0.25, 0.95, 0.75]), pole: [1, 0.3, -0.5], hand: { kind: 'fist', f: [-0.3, 0.6, 0.7], palm: [-1, 0, 0], curl: 0.9 } };
      slingArm(J, sp, prm, arms, OF);
      return { arms, legs };
    },
  };

  /* ---------------------------------------------------------------- g) standing hug (used by pair 'embrace' / 'leap_embrace') */
  // anchor: ground between the feet. params.partner: 'over' (his arms over her shoulders/back) | 'under' (hers round his back/neck),
  // reachZ (distance to the partner's back), lift (her heels up), headSide (+1 / -1: which shoulder the head rests on)
  POSES.hug = {
    facing: 'front', anchor: 'ground between the feet',
    body(sp, prm, tq) {
      const hs = prm.headSide ?? 1, lb = prm.leanBack || 0;
      return {
        pelvis: { pos: [0, sp.hipY + (prm.dip || 0), lb * -0.1], pitch: 0.06 - lb * 0.2 + (prm.lean || 0), roll: 0, yaw: 0 },
        spine: { bend: 0.1 - lb * 0.15 + (prm.bend || 0), side: prm.side || 0, twist: hs * 0.12 },
        neck: { pitch: prm.nod ?? 0.15, roll: hs * 0.12 + (prm.tilt || 0), yaw: hs * (prm.headYaw ?? 0.7) },
        breath: breath(tq),
      };
    },
    limbs(J, sp, prm, tq, o, OF) {
      const legs = {}, arms = {}, z = prm.reachZ ?? 0.62, lift = prm.lift || 0, kick = prm.kick || 0;
      for (const s of ['L', 'R']) {
        const sg = s === 'L' ? 1 : -1;
        legs[s] = { A: [sg * 0.12, -sp.ankleH - lift * 0.2 - (s === 'L' ? kick : 0) * 1.1, (s === 'L' ? -kick * 1.3 : 0.05)], pole: [0, kick ? 0.6 : 0, 1], foot: { dir: [sg * 0.15, lift * 0.8 + (s === 'L' ? kick : 0), 1], tip: lift } };
      }
      const hY = prm.handY ?? (sp.chestY - 0.25), hz = z;
      if ((prm.partner || 'over') === 'over') { // his arms: one high across her shoulder blades, one low at her waist
        arms.L = { W: [0.12, hY + (prm.asym ?? 0.0), hz], pole: [1, 0.2, -0.3], hand: { f: [-1, 0.1, 0.2], palm: [0, 0, -1], curl: 0.25, spread: 0.3 } };
        arms.R = { W: [-0.18, hY + 0.75, hz - 0.05], pole: [-1, 0.6, -0.3], hand: { f: [1, 0.1, 0.2], palm: [0, 0, -1], curl: 0.3, spread: 0.25 } };
      } else { // hers: round his neck / under his arms onto his back
        arms.L = { W: [0.0, hY - 0.25, hz], pole: [1, 0.5, -0.3], hand: { f: [-1, 0.2, 0.2], palm: [0, 0, -1], curl: 0.3 } };
        arms.R = { W: [-0.1, hY + 0.15, hz], pole: [-1, 0.6, -0.3], hand: { f: [1, 0.2, 0.2], palm: [0, 0, -1], curl: 0.3 } };
      }
      slingArm(J, sp, prm, arms, OF);
      return { arms, legs };
    },
  };

  /* ================================================================ figure assembly */
  const FACING = { front: 0, '3q_right': PI / 4, right: HP, '3q_back_right': 3 * PI / 4, back: PI, '3q_back_left': -3 * PI / 4, left: -HP, '3q_left': -PI / 4 };
  function facingAngle(f, def) { if (typeof f === 'number') return f; if (f && FACING[f] !== undefined) return FACING[f]; return FACING[def] ?? 0; }

  function assemble(ctx, o, R) {
    const who = o.who || 'senpai', sp = SPECS[who] || SPECS.senpai;
    const outfitName = o.outfit || DEFAULT_OUTFIT[who];
    const OFS = OUTFITS[who] || OUTFITS.senpai;
    const OF = Object.assign({}, OFS[outfitName] || OFS[DEFAULT_OUTFIT[who]], o.costume || {});
    const pose = POSES[o.pose || 'stand'] || POSES.stand;
    const T = o.T || 0, tq = A.onTwos(T), prm = o.params || {};
    const theta = facingAngle(o.facing, pose.facing);
    const VM = mm(rot(0, o.camPitch || 0, 0), rot(theta, 0, 0));
    const P = pose.body(sp, prm, tq, o, OF);
    const J = buildRig(sp, P);
    solveLimbs(J, pose.limbs(J, sp, prm, tq, o, OF));
    const G = newBuild(J, VM, R, o, sp);
    G.theta = theta; G.tq = tq; G.OF = OF; G.pose = pose; G.P = P; G.outfit = outfitName;
    const VMi = mm(rot(-theta, 0, 0), rot(0, -(o.camPitch || 0), 0));
    G.toBody = (v) => mv(VMi, v);
    const wet = OF.wet ? 1 : (o.wet || 0);
    if ((o.pose === 'run') && o.wind === undefined) { const f = G.Vr(mv(J.F.p.M, [0, 0, 1])); G.wind = 0.9; G.windDir = atan2(-f[1] * 0.3 + 0.15, -f[0] || 1e-3); }
    else { G.wind = o.wind || 0; G.windDir = o.windDir; }
    const torsoZ = G.Z(J.F.c.o);
    const armZ = (s) => (G.Z(J['E' + s]) * 2 + G.Z(J['W' + s]) + G.Z(J['S' + s])) / 4;
    const legZ = (s) => (G.Z(J['K' + s]) + G.Z(J['A' + s])) / 2;
    const parts = {};
    const main = (p) => G.add('main', p);
    const fz = facing(G, 'c', [0, 0, 1]);

    /* ---- legs + shoes (behind the body layer; trouser legs move into it below) */
    const legKind = OF.legs || 'bare';
    const legOrder = ['L', 'R'].sort((a, b) => legZ(a) - legZ(b));
    const pantsMat = { trousers: 'trousers', jeans: 'jeans', pajama_pants: 'pajama_pants' }[OF.bottom];
    for (const s of legOrder) {
      const lay = s === legOrder[0] ? 'legsFar' : 'legsNear';
      const shoe = buildShoe(G, '__tmp', s, OF.shoes || 'loafer');
      const leg = buildLeg(G, '__tmp', s, legKind, { mat: pantsMat, wet });
      parts['leg' + s] = leg;
      if (pantsMat) { G.add(lay, shoe); for (const p of leg.parts) G.add(lay, p); }
      else { for (const p of leg.parts) G.add(lay, p); G.add(lay, shoe); }
    }
    delete G.layers.__tmp;

    /* ---- inner top */
    const topKind = OF.top;
    const topMat = { blouse: 'blouse', shirt: 'shirt', dress: 'dress', onepiece: 'onepiece', pajama: 'gown', knit: 'knit', tee: 'tee', tee_black: 'tee_black', turtle: 'turtle' }[topKind] || 'blouse';
    const nl = necklineRing(G, OF.neckline);
    let rings = torsoRings(G, topKind);
    if (nl) rings = [nl].concat(rings.slice(1).filter(r => r.y > nl.y + 0.05));
    const torso = buildTorso(G, '__t', topKind, topMat, { wet, rings });
    delete G.layers.__t;
    let collar = null;
    if (OF.collar === 'blouse') collar = collarBlouse(G, 'main', torso, { wet });
    else if (OF.collar === 'open') collar = collarOpen(G, torso, { wet });
    else if (OF.collar === 'pajama') collar = collarOpen(G, torso, { wet, mat: 'gown' });
    if (collar && fz >= 0) main(collar.backBand);
    buildNeck(G, 'main');
    if (collar && fz < 0) main(collar.backBand);
    if (nl) main(skinYoke(G));
    if (OF.neckline === 'turtle') { /* added after the torso */ }
    // trousers: under a tucked top they go after it; an untucked top hangs over them
    let seat = null;
    const addSeat = () => { seat = trouserSeat(G, 'main', pantsMat, { wet }); if (OF.belt) main(beltPart(G)); };
    if (pantsMat && !OF.tuck) addSeat();
    main(torso);
    if (pantsMat && OF.tuck) addSeat();
    if (pantsMat) { // trouser legs in front of / level with the hips belong to the body layer, after the seat
      for (const s of legOrder) {
        const lay = s === legOrder[0] ? 'legsFar' : 'legsNear', arr = G.layers[lay] || [];
        const legParts = arr.filter(p => p.fam === 'leg' + s);
        if (legZ(s) > torsoZ - 0.15) {
          G.layers[lay] = arr.filter(p => p.fam !== 'leg' + s);
          const si = seat ? G.layers.main.indexOf(seat) : -1;
          if (!OF.tuck && si >= 0) G.layers.main.splice(si + 1, 0, ...legParts); else for (const p of legParts) main(p);
        }
      }
    }
    // inner-top details
    if (topKind === 'blouse' || topKind === 'shirt' || topKind === 'pajama') torso.lines.push(...placket(G, torso, { top: topKind === 'blouse' ? 0.16 : 0.22 }));
    torsoDetails(G, torso, topKind);
    if (topKind === 'knit') knitRib(G, torso);
    if (topKind === 'tee' || topKind === 'tee_black') { // crew-neck rib
      const r = torso.rings[0], rr = Object.assign({}, r, { y: r.y + 0.05 });
      const rsx = [ringSample(G, r, 24), ringSample(G, rr, 24)], e = loftOutline(rsx, {});
      const idx = nearIdx(rsx[1], e.Rx[1].k, e.Lx[1].k).map(i => rsx[1].P2[i]);
      if (idx.length > 2) torso.lines.push({ pts: [e.Rx[1].pt, ...idx, e.Lx[1].pt], w: 0.5, a: 0.55 });
    }
    if (OF.cling) wetCling(G, torso);
    if (OF.waistSeam) { const r = { f: 'w', y: sp.waistY, a: sp.rings.waist[2] + 0.014, b: sp.rings.waist[3] + 0.014 }, rsx = [ringSample(G, r, 24)], e = loftOutline([rsx[0], rsx[0]], {}); const idx = nearIdx(rsx[0], e.Rx[0].k, e.Lx[0].k).map(i => rsx[0].P2[i]); if (idx.length > 2) torso.lines.push({ pts: [e.Rx[0].pt, ...idx, e.Lx[0].pt], w: 0.55, a: 0.6 }); }
    if (OF.neckline === 'turtle') main(turtleneck(G));
    if (collar) {
      if (collar.vneck && fz > 0.1) { const vp = { name: 'vneck', fam: 'vneck', path: shape(collar.vneck), m: R.m('skin'), band: 0.0, lw: 0.7, noOutline: true, ink: false }; G.layers.main.splice(G.layers.main.indexOf(torso) + 1, 0, vp); }
      for (const f of collar.flaps) { main(f); torso.cast.push({ path: f.path, d: 0.045 }); if (OF.collar === 'pajama') f.lines = (f.lines || []).concat([]); }
    }
    if (OF.ribbon) { const rb = ribbonBow(G, 'main', torso, { sway: 0.01 * sin(tq * 1.7) }); if (rb) { for (const p of rb.parts) main(p); torso.cast.push({ path: rb.all, d: 0.04 }); } }
    if (OF.tie) {
      const tie = tieLoose(G, torso, { sway: 0.4 * N2(5.1, tq * 0.7) });
      if (tie) { const vi = G.layers.main.findIndex(p => p.name === 'vneck'); const ti = vi >= 0 ? vi : G.layers.main.indexOf(torso); G.layers.main.splice(ti + 1, 0, ...tie.parts); torso.cast.push({ path: tie.all, d: 0.04 }); }
    }
    if (OF.necklace) { const nk = necklace(G, torso); if (nk) { nk.path = null; nk.lines = null; G.layers.main.splice(G.layers.main.indexOf(torso) + 1, 0, nk); } }
    if (OF.sash) main(sashBelt(G, torso));

    /* ---- skirt (under an outer garment's hem) */
    let skirt = null;
    if (!pantsMat && OF.bottom) {
      skirt = buildSkirt(G, 'main', OF.bottom, { tq, wind: G.wind, windDir: G.windDir, seat: !!P.seated, seatY: P.seatY, wet, knees: P.seated ? null : [J.KL, J.KR] });
      for (const s of ['L', 'R']) for (const p of parts['leg' + s].parts) { p.cast = p.cast || []; p.cast.push({ path: skirt.path, d: 0.1 }); }
    }

    /* ---- outer garment */
    let outer = null;
    if (OF.outer) {
      outer = buildOuter(G, OF.outer, { wet });
      main(outer);
      for (const p of outer.extra) main(p);
      if (outer.coatSkirt) {
        const cs = buildSkirt(G, 'main', 'coat_skirt', { tq, wind: o.wind || 0, windDir: o.windDir, seat: !!P.seated, seatY: P.seatY, waistY: sp.rings.hip[1] - 0.15, waistEase: 0.12, len: 2.75, waistband: false });
        // the coat skirt continues the shell: same family (no seam line), but a centre-front line
        cs.fam = 'outer'; cs.m = R.m('coat');
        if (fz > 0.3) { const a = G.P2(ringPoint(G, cs.rs[0].r, 90 + 4)), b = cs.hem.P2[Math.round(cs.hem.P2.length / 4)]; cs.lines.push({ pts: [a, lerp2(a, b, 0.5), b], w: 0.7, a: 0.7 }); }
        for (const s of ['L', 'R']) for (const p of parts['leg' + s].parts) { p.cast = p.cast || []; p.cast.push({ path: cs.path, d: 0.1 }); }
      }
    }

    /* ---- arms */
    const sleeve = OF.sleeve || 'long';
    const armsFront = !!(pose.armsFront || (pose.armsFrontWhen && pose.armsFrontWhen(prm)));
    for (const s of ['L', 'R']) {
      const list = [];
      if (OF.cast && s === 'R' && !prm.castFree) {
        const ca = castArm(G, s);
        const arm = buildArm(G, '__a', s, 'pajama_elbow', topMat, { wet });
        list.push(...arm.parts.filter(p => p.name.startsWith('upSkin') || p.name.startsWith('sleeveUp') || p.name.startsWith('sleeve')));
        list.push(...ca.parts);
        parts['arm' + s] = { list, behind: !armsFront && armZ(s) < torsoZ - 0.12, z: armZ(s) };
        continue;
      }
      const arm = buildArm(G, '__a', s, sleeve, OF.outer ? OUTER[OF.outer].mat : topMat, { wet });
      const behind = !armsFront && armZ(s) < torsoZ - 0.12;
      if (arm.hand) {
        list.push(...arm.parts.filter(p => p.name.startsWith('upSkin') || p.name.startsWith('foSkin')));
        list.push(...arm.hand.parts);
        list.push(...arm.parts.filter(p => !(p.name.startsWith('upSkin') || p.name.startsWith('foSkin'))));
      } else list.push(...arm.parts);
      parts['arm' + s] = { list, behind, z: armZ(s) };
      if (!behind) {
        const up = arm.parts.find(p => p.name.startsWith('sleeveUp') || p.name.startsWith('sleeve')) || arm.parts[0];
        if (up) { const tgt = outer || torso; tgt.cast = tgt.cast || []; tgt.cast.push({ path: up.path, d: 0.07 }); if (skirt) skirt.cast.push({ path: up.path, d: 0.07 }); }
      }
    }
    delete G.layers.__a;
    const armOrder = ['L', 'R'].sort((a, b) => parts['arm' + a].z - parts['arm' + b].z);
    const headZ = G.Z(J.neckTop), headP = G.P2(v3.add(J.neckTop, mv(J.Mn, [0, -0.45, 0])));
    for (const s of armOrder) {
      const a = parts['arm' + s], W3 = J['W' + s], w2 = G.P2(W3);
      const overHead = !a.behind && G.Z(W3) > headZ + 0.08 && hypot(w2[0] - headP[0], w2[1] - headP[1]) < 0.75;
      for (const p of a.list) {
        p.isArm = s;
        const distal = /^(foSkin|sleeveFo|cuff|roll|hand|thumb|underCuff|cast|fing)/.test(p.name);
        G.add(a.behind ? 'armsBack' : overHead && distal ? 'overHead' : 'main', p);
      }
      if (overHead) G.overHeadSide = s;
    }
    if (pose.props) pose.props(G, prm, tq, o);
    return G;
  }

  /* ================================================================ head call (with a placeholder until anime_head.js exists) */
  function headArgs(G, o, s, layer) {
    const J = G.J, sp = G.sp, P = G.P, hp = o.head || {};
    const nt = G.P2(J.neckTop), nb = G.P2(J.neckBase);
    const flipK = o.flip ? -1 : 1;
    // view yaw of the head: body facing + spine twist + neck turn (+ optional head turn)
    let ang = G.theta + ((P.pelvis && P.pelvis.yaw) || 0) + ((P.spine && P.spine.twist) || 0) + ((P.neck && P.neck.yaw) || 0) + (hp.turn || 0) * HP;
    ang = Math.atan2(sin(ang), cos(ang));
    let back = abs(ang) > HP + 0.32, yaw = back ? Math.sign(ang) * (PI - abs(ang)) / HP : clamp(ang / HP, -1, 1);
    if (hp.yaw !== undefined) yaw = hp.yaw;
    if (hp.back !== undefined) back = hp.back;
    yaw *= flipK;
    const dv = sub2(nt, nb), roll = atan2(dv[0], -dv[1]) * flipK * 0.9 + (hp.roll || 0);
    const pitchBody = ((P.pelvis && P.pelvis.pitch) || 0) + ((P.spine && P.spine.bend) || 0) + ((P.neck && P.neck.pitch) || 0) - 0.08;
    const pitch = hp.pitch !== undefined ? hp.pitch : clamp(-pitchBody * 0.8, -0.4, 0.4);
    const x = (o.x || 0) + nt[0] * s * flipK, y = (o.y || 0) + nt[1] * s;
    const args = Object.assign({}, hp, {
      who: o.who || 'senpai', x, y, size: s * (hp.sizeK || 1), yaw, back, pitch, roll,
      light: o.light || 'day', rimDir: o.rimDir, T: o.T || 0, seed: o.seed, line: o.line, alpha: o.alpha, layer,
    });
    args.hair = Object.assign({ wind: G.wind ?? (o.wind || 0), windDir: G.windDir ?? (o.windDir || 0) }, hp.hair || {});
    if (o.outfit === 'dress' && !(hp.hair && hp.hair.style)) args.hair.style = 'updo';
    if (o.outfit === 'dress_cardigan' && !(hp.hair && hp.hair.style)) args.hair.style = 'loose';
    if (G.OF.wet && !(hp.hair && hp.hair.style)) args.hair.style = 'wet';
    if (G.OF.hat && !o.noHat && args.hat === undefined) args.hat = true;
    delete args.turn; delete args.sizeK;
    return args;
  }
  const realHead = () => typeof A.head === 'function' && !A.head.__placeholder;
  function callHead(ctx, fn, args) {
    const f = A[fn];
    if (typeof f === 'function' && !f.__placeholder) {
      try { return f(ctx, args); } catch (e) { if (!A.__headErr) { A.__headErr = true; console.error('anime_body: head library threw: ' + e.message); } }
    }
    return placeholderHead(ctx, fn, args);
  }
  // A plain stand-in head (used only while PV.anime.head is missing or throws): face, hair mass, eyes
  function placeholderHead(ctx, fn, o) {
    const s = o.size, who = o.who, yaw = clamp(o.yaw || 0, -1, 1), back = !!o.back;
    const hm = A.mat('hair_' + (who === 'boy' ? 'boy' : who === 'aunt' ? 'aunt' : 'senpai'), o.light || 'day');
    const km = A.mat('skin', o.light || 'day');
    const lw = A.inkW(s) / s;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.roll || 0); ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const long = who === 'senpai' && (!o.hair || !o.hair.style || o.hair.style === 'down' || o.hair.style === 'loose' || o.hair.style === 'wet');
    const hx = yaw * 0.05;
    if (fn === 'headBack') {
      if (long && !back) { ctx.fillStyle = hm.base; ctx.strokeStyle = hm.line; ctx.lineWidth = lw; const p = shape([[-0.5 + hx, -0.55], [0.5 + hx, -0.55], [0.6 + hx, 0.4], [0.5 + hx * 2, 1.9], [0.0 + hx * 2, 2.0], [-0.5 + hx * 2, 1.9], [-0.6 + hx, 0.4]]); ctx.stroke(p); ctx.fill(p); }
      ctx.restore(); return { neck: [o.x, o.y], size: s };
    }
    const fc = [hx * 2.2, -0.43];
    if (back) {
      ctx.fillStyle = hm.base; ctx.strokeStyle = hm.line; ctx.lineWidth = lw * 1.2;
      const p = long ? shape([[-0.48, -0.5], [-0.42, -0.85], [0, -1.0], [0.42, -0.85], [0.48, -0.5], [0.58, 0.4], [0.5, 1.9], [0, 2.0], [-0.5, 1.9], [-0.58, 0.4]]) : shape([[-0.46, -0.5], [-0.4, -0.86], [0, -0.99], [0.4, -0.86], [0.46, -0.5], [0.42, -0.05], [0.25, 0.08], [0, 0.12], [-0.25, 0.08], [-0.42, -0.05]]);
      ctx.stroke(p); ctx.fill(p);
      ctx.restore(); return { neck: [o.x, o.y], size: s };
    }
    // face
    const cw = 0.36 * (1 - abs(yaw) * 0.15);
    const face = shape([[fc[0] - cw, -0.62], [fc[0] - cw * 1.02, -0.32], [fc[0] - cw * 0.8 + yaw * 0.08, -0.08], [fc[0] + yaw * 0.16, 0.12, 1], [fc[0] + cw * 0.8 + yaw * 0.08, -0.08], [fc[0] + cw * 1.02, -0.32], [fc[0] + cw, -0.62], [fc[0], -0.9]]);
    ctx.fillStyle = km.base; ctx.strokeStyle = km.line; ctx.lineWidth = lw; ctx.stroke(face); ctx.fill(face);
    // eyes
    for (const sg of [-1, 1]) {
      const ex = fc[0] + sg * 0.15 * (1 - abs(yaw) * 0.4) + yaw * 0.12, k = 1 - max(0, sg * -yaw) * 0.6;
      if (k < 0.3) continue;
      ctx.fillStyle = A.mat(who === 'boy' ? 'iris_boy' : 'iris_senpai', o.light || 'day').base;
      ctx.beginPath(); ctx.ellipse(ex, -0.33, 0.055 * k, who === 'boy' ? 0.05 : 0.075, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = hm.line; ctx.lineWidth = lw * 1.6; ctx.beginPath(); ctx.moveTo(ex - 0.075 * k, -0.4); ctx.quadraticCurveTo(ex, -0.43, ex + 0.08 * k, -0.39); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 0.015, -0.355, 0.016, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = km.line; ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.moveTo(fc[0] + yaw * 0.1 - 0.03, -0.07); ctx.lineTo(fc[0] + yaw * 0.1 + 0.03, -0.07); ctx.stroke();
    // hair cap + bangs
    ctx.fillStyle = hm.base; ctx.strokeStyle = hm.line; ctx.lineWidth = lw * 1.1;
    const cap = who === 'boy' ? [[-0.47 + hx, -0.25], [-0.5 + hx, -0.6], [-0.36, -0.92], [0, -1.02], [0.36, -0.92], [0.5 + hx, -0.6], [0.47 + hx, -0.25], [0.36 + hx, -0.32], [0.3 + hx, -0.5], [0.2 + hx * 2, -0.38], [0.1 + hx * 2, -0.55], [-0.02 + hx * 2, -0.36], [-0.12 + hx * 2, -0.55], [-0.24 + hx * 2, -0.4], [-0.32 + hx, -0.55], [-0.38 + hx, -0.3]]
      : [[-0.46 + hx, 0.1], [-0.5 + hx, -0.6], [-0.36, -0.93], [0, -1.02], [0.36, -0.93], [0.5 + hx, -0.6], [0.46 + hx, 0.25], [0.38 + hx, 0.3], [0.36 + hx, -0.4], [0.22 + hx * 2, -0.44], [0.1 + hx * 2, -0.58], [-0.02 + hx * 2, -0.43], [-0.15 + hx * 2, -0.56], [-0.28 + hx * 2, -0.42], [-0.36 + hx, -0.45], [-0.38 + hx, 0.3]];
    const hp = shape(cap); ctx.stroke(hp); ctx.fill(hp);
    ctx.restore();
    return { neck: [o.x, o.y], size: s };
  }
  placeholderHead.__placeholder = true;

  const LAYER_ORDER = ['propsBack', 'back', 'armsBack', 'legsFar', 'legsNear', 'propsMid', 'main', 'propsFront', 'front'];
  /* ================================================================ public: figure */
  function prepFigure(ctx, o) {
    const s = o.scale || 100, flip = !!o.flip;
    const R = makeRC(ctx, o, s, flip);
    const G = assemble(ctx, o, R);
    // arms that a pair wants drawn later (over the partner) go to their own layer
    if (o.splitArms) for (const k of Object.keys(G.layers)) {
      const keep = [];
      for (const p of G.layers[k]) { if (p.isArm && o.splitArms.includes(p.isArm) && k !== 'overHead') (G.layers.armsSplit || (G.layers.armsSplit = [])).push(p); else keep.push(p); }
      G.layers[k] = keep;
    }
    return { o, s, flip, R, G, head: null };
  }
  function drawStep(ctx, F, step) {
    const { o, s, flip, R, G } = F; R.ctx = ctx;
    const oh = Object.assign({}, o); delete oh.alpha;
    if (step === 'hb') { callHead(ctx, 'headBack', headArgs(G, oh, s, 'back')); return; }
    const local = (fn) => { ctx.save(); ctx.translate(o.x || 0, o.y || 0); if (flip) ctx.scale(-1, 1); ctx.scale(s, s); fn(); ctx.restore(); };
    if (step === 'body') local(() => { for (const k of LAYER_ORDER) if (G.layers[k] && G.layers[k].length) paintGroup(R, G.layers[k]); });
    else if (step === 'arms') local(() => { if (G.layers.armsSplit && G.layers.armsSplit.length) paintGroup(R, G.layers.armsSplit); });
    else if (step === 'head') {
      const hargs = headArgs(G, oh, s, 'front');
      F.head = callHead(ctx, 'head', hargs);
      if (G.OF.hat && !o.noHat && !realHead()) drawHat(ctx, G, o, F.head, hargs);
      if (G.layers.overHead && G.layers.overHead.length) local(() => paintGroup(R, G.layers.overHead));
    }
  }
  function figInfo(F) {
    const { o, s, flip, G } = F, toPx = (p) => [(o.x || 0) + p[0] * s * (flip ? -1 : 1), (o.y || 0) + p[1] * s];
    const J = G.J;
    return { head: F.head, neck: toPx(G.P2(J.neckTop)), hands: { L: toPx(G.P2(J.WL)), R: toPx(G.P2(J.WR)) }, shoulders: { L: toPx(G.P2(J.SL)), R: toPx(G.P2(J.SR)) }, pelvis: toPx(G.P2(J.F.p.o)) };
  }
  function withAlpha(ctx, alpha, fn) {
    if (alpha === undefined || alpha >= 1) return fn(ctx);
    const buf = PV.buffer('animeFig', ctx.canvas.width, ctx.canvas.height);
    buf.ctx.clearRect(0, 0, buf.canvas.width, buf.canvas.height); buf.ctx.setTransform(ctx.getTransform());
    const r = fn(buf.ctx);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= alpha; ctx.drawImage(buf.canvas, 0, 0); ctx.restore();
    return r;
  }
  /** One character. Returns {head (PV.anime.head's return), neck, hands {L,R}, shoulders, pelvis} in ctx coordinates. */
  A.figure = function (ctx, o = {}) {
    return withAlpha(ctx, o.alpha, (c) => {
      c.save();
      const F = prepFigure(c, o);
      for (const st of ['hb', 'body', 'arms', 'head']) drawStep(c, F, st);
      c.restore();
      return figInfo(F);
    });
  };

  /* ================================================================ public: pair */
  // Two characters in a shared 'pair space' in 先輩's head units (+x = screen right, +z = toward the camera at facing 'front').
  // o.facing turns the whole pair (camera angle); 彼 is drawn at 1.04x her head size (7.3 heads of a bigger head = ~8% taller).
  // o.senpai / o.boy: per-character overrides (outfit, head {expr, eyes, mouth, talk ...}, params ...).
  const BOY_K = 1.04;
  const PAIRS = {
    // C22 / C42 (grass) and C33 (sofa, with a gap): side by side, seen from the front-oblique. params: side 'left'|'right' (her side,
    // as he sees it), gap, lean 0..1 (her head on his shoulder), look 0..1 (she turns her face to him), seat 'grass'|'sofa', sofa (draw it)
    sit_side: {
      facing: '3q_left',
      layout(prm) {
        const sg = (prm.side || 'left') === 'left' ? 1 : -1, gap = prm.gap || 0, lean = prm.lean || 0, sofa = prm.seat === 'sofa';
        return {
          senpai: { pos: [sg * (0.6 + gap / 2) - sg * lean * 0.12, sofa ? 0 : 0, 0.02], pose: 'sit_ground', params: { sofa, knees: sofa ? 'down' : 'up', arms: sofa ? 'lap' : 'knees', lean, leanDir: -sg, look: -sg * 0.95 * (prm.look || 0) * (1 - lean * 0.5) } },
          boy: { pos: [-sg * (0.68 + gap / 2), 0, -0.02], pose: 'sit_ground', params: { sofa, knees: sofa ? 'down' : 'up', arms: sofa ? 'lap' : (sg > 0 ? 'prop' : 'prop'), nod: prm.boyNod ?? 0.08, look: prm.boyLook || 0 } },
          order: 'depth',
          props: sofa && prm.sofa !== false ? 'sofa' : null,
        };
      },
    },
    // C32 / C20: standing hug. params.progress 0..1 (0 = the moment she lands: in the air, legs kicked back, him leaning back),
    // headSide (+1: her head over his left shoulder)
    embrace: {
      facing: 'front',
      // camera on his front: her head rests on his left shoulder (screen right), his face looks over her left shoulder
      layout(prm) {
        const pr = prm.progress ?? 1, air = 1 - sstep(0, 1, pr), hs = prm.headSide ?? -1;
        return {
          boy: { pos: [hs * 0.07, 0, -0.27], yaw: 0, pose: 'hug', params: { partner: 'over', reachZ: 0.74, headSide: hs, tilt: hs * 0.1, leanBack: air * 0.5, nod: 0.3, headYaw: 0.3, handY: -5.05, side: hs * 0.08 } },
          senpai: { pos: [-hs * 0.1, -air * 0.35, 0.24], yaw: PI, pose: 'hug', params: { partner: 'under', reachZ: 0.74, headSide: hs, tilt: hs * 0.22, lift: 0.35 + air * 0.6, kick: air * 0.5, nod: 0.05, headYaw: 0.95, handY: -5.85, side: hs * 0.12 } },
          order: 'embrace',
        };
      },
    },
    // C31: on the wet ground — he lies on his back, she is over him (rise 0) and comes up on her knees (rise 1)
    collapsed: {
      facing: 'right',
      layout(prm) {
        const r = prm.rise ?? 0;
        return {
          boy: { pos: [0, 0, 0], yaw: 0, pose: 'lie_back', params: { headUp: prm.headUp ?? 0.15, arms: prm.boyArms || 'side', look: 0.25 } },
          senpai: { pos: [0.05, 0, 0.55], yaw: PI, pose: 'kneel_up', params: { rise: r, sob: prm.sob ?? 1, look: prm.look } },
          order: 'collapsed',
        };
      },
    },
  };
  // the names of the original brief (back views); same poses, default camera from behind (faces need facing / head.turn)
  PAIRS.sit_back = { facing: 'back', layout: (prm, tq, o) => PAIRS.sit_side.layout(prm, tq, o) };
  PAIRS.leap_embrace = { facing: 'front', layout: (prm) => PAIRS.embrace.layout(Object.assign({ progress: prm.progress ?? 0.3 }, prm)) };
  A.PAIR_POSES = PAIRS;
  /** Two-person poses. o: pose, x, y (anchor = ground point between them), scale (her head px), facing, T, light, rimDir, wind,
   *  params, senpai {...}, boy {...}, camPitch, alpha. Returns {senpai: info, boy: info}. */
  A.pair = function (ctx, o = {}) {
    const def = PAIRS[o.pose || 'sit_side'] || PAIRS.sit_side;
    const prm = o.params || {}, T = o.T || 0, tq = A.onTwos(T), s = o.scale || 100;
    const cam = facingAngle(o.facing, def.facing);
    const L = def.layout(prm, tq, o);
    const VMc = mm(rot(0, o.camPitch || 0, 0), rot(cam, 0, 0));
    return withAlpha(ctx, o.alpha, (c) => {
      c.save();
      const F = {}, z = {};
      for (const who of ['senpai', 'boy']) {
        const f = L[who], k = who === 'boy' ? BOY_K : 1, pv = mv(VMc, f.pos), ov = o[who] || {};
        const fo = Object.assign({}, o, ov, {
          who, pose: f.pose, params: Object.assign({}, f.params, ov.params || {}), facing: cam + (f.yaw || 0),
          x: (o.x || 0) + pv[0] * s, y: (o.y || 0) + pv[1] * s, scale: s * k * (ov.scaleK || 1),
          head: Object.assign({}, f.head || {}, ov.head || {}), alpha: undefined,
        });
        if (L.order === 'embrace' && who === 'boy') fo.splitArms = ['L', 'R'];
        F[who] = prepFigure(c, fo); z[who] = pv[2];
      }
      const far = z.senpai < z.boy ? 'senpai' : 'boy', near = far === 'senpai' ? 'boy' : 'senpai';
      let steps;
      if (L.order === 'embrace') steps = [['boy', 'hb'], ['senpai', 'hb'], ['boy', 'body'], ['senpai', 'body'], ['boy', 'arms'], ...(z.senpai > z.boy ? [['boy', 'head'], ['senpai', 'head']] : [['senpai', 'head'], ['boy', 'head']])];
      else if (L.order === 'collapsed') steps = [['boy', 'hb'], ['boy', 'body'], ['boy', 'arms'], ['boy', 'head'], ['senpai', 'hb'], ['senpai', 'body'], ['senpai', 'arms'], ['senpai', 'head']];
      else steps = [[far, 'hb'], [far, 'body'], [far, 'arms'], [far, 'head'], [near, 'hb'], [near, 'body'], [near, 'arms'], [near, 'head']];
      if (L.props === 'sofa') { const Gs = F.boy.G; c.save(); c.translate(o.x || 0, o.y || 0); c.scale(s, s); const Rr = F.boy.R; Rr.ctx = c;
        const tmp = newBuild(Gs.J, VMc, Rr, o, Gs.sp); paintGroup(Rr, sofaParts(tmp, { w: 1.55 + (prm.gap || 0) * 0.5 })); c.restore(); }
      for (const [who, st] of steps) drawStep(c, F[who], st);
      c.restore();
      return { senpai: figInfo(F.senpai), boy: figInfo(F.boy) };
    });
  };
  A.FIG_POSES = POSES;
  A.__body = { SPECS, OUTFITS, POSES, rot, mm, mv, v3 };
})();

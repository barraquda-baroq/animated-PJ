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
      rimA: clamp(o.rimA !== undefined ? o.rimA : LT.rimA), rimCol: o.rimColor || LT.rim,
      amb: o.amb, wet: o.wet || 0,
      wA: 0.62 * W * px, wB: 0.78 * W * px, sOff: 0.5 * W * px,   // outline: ~0.62 W on the lit side, ~1.3 W in shadow
      wIn: 0.85 * W * px, wDet: 0.6 * W * px, rimW: max(1.6, W * 1.05) * px,
      cache: {},
    };
    R.m = (name, wet) => { const k = name + '|' + (wet || 0); return R.cache[k] || (R.cache[k] = A.mat(name, light, { amb: R.amb, wet: wet || 0 })); };
    return R;
  }

  function paintPart(R, p) {
    const c = R.ctx, m = p.m;
    c.fillStyle = p.fill || m.base; c.fill(p.path);
    c.save(); c.clip(p.path);
    if (p.band) { c.fillStyle = p.bandCol || m.shade; c.fill(shiftedComp(p.path, R.lx * p.band, R.ly * p.band), 'evenodd'); }
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
      hipY: -3.72, waistY: -4.32, chestY: -4.95, neckBaseY: -5.62, neckLen: 0.47, neckR: [0.1, 0.088],
      hipJ: [0.2, 0.03, 0.0], sh: [0.565, -5.385, -0.02], acro: [0.535, -5.505, -0.035],
      upArm: 1.12, foreArm: 0.93, hand: 0.64, thigh: 1.74, shin: 1.75, ankleH: 0.23, foot: 0.58,
      rings: { // name: [frame, yAbs, a, b, cz]
        neck: ['c', -5.62, 0.112, 0.105, -0.03], chestTop: ['c', -5.2, 0.43, 0.245, 0.0], bust: ['c', -4.96, 0.42, 0.29, 0.045],
        underbust: ['c', -4.72, 0.37, 0.24, 0.02], waist: ['w', -4.32, 0.315, 0.21, 0.0], hipTop: ['p', -4.02, 0.41, 0.24, -0.01],
        hip: ['p', -3.72, 0.49, 0.275, -0.035], seat: ['p', -3.48, 0.46, 0.255, -0.03],
      },
      upW: [[0, 0.098], [0.3, 0.083], [0.7, 0.069], [1, 0.061]], foreW: [[0, 0.06], [0.25, 0.064], [0.7, 0.048], [1, 0.037]],
      thighW: [[0, 0.165, 0.165, 0.165], [0.35, 0.142, 0.15, 0.14], [0.75, 0.108, 0.105, 0.1], [1, 0.087, 0.088, 0.086]],  // [f, lateral, front, back]
      shinW: [[0, 0.087, 0.086, 0.088], [0.14, 0.09, 0.08, 0.1], [0.32, 0.093, 0.072, 0.113], [0.58, 0.077, 0.064, 0.086], [0.82, 0.057, 0.054, 0.058], [1, 0.046, 0.046, 0.05]],
    },
    boy: {
      who: 'boy', H: 7.3, girl: false,
      hipY: -3.95, waistY: -4.55, chestY: -5.2, neckBaseY: -5.88, neckLen: 0.5, neckR: [0.13, 0.118],
      hipJ: [0.235, 0.03, 0.0], sh: [0.70, -5.62, -0.02], acro: [0.665, -5.77, -0.035],
      upArm: 1.2, foreArm: 1.0, hand: 0.72, thigh: 1.86, shin: 1.83, ankleH: 0.26, foot: 0.7,
      rings: {
        neck: ['c', -5.88, 0.15, 0.135, -0.03], chestTop: ['c', -5.45, 0.55, 0.28, 0.0], chest: ['c', -5.2, 0.54, 0.3, 0.03],
        lowChest: ['c', -4.92, 0.49, 0.275, 0.02], waist: ['w', -4.55, 0.42, 0.24, 0.0], hipTop: ['p', -4.25, 0.44, 0.25, 0.0],
        hip: ['p', -3.95, 0.465, 0.27, -0.025], seat: ['p', -3.72, 0.44, 0.255, -0.02],
      },
      upW: [[0, 0.122], [0.3, 0.103], [0.7, 0.088], [1, 0.078]], foreW: [[0, 0.077], [0.25, 0.082], [0.7, 0.062], [1, 0.049]],
      thighW: [[0, 0.19, 0.19, 0.19], [0.35, 0.168, 0.172, 0.165], [0.75, 0.13, 0.125, 0.122], [1, 0.106, 0.104, 0.104]],
      shinW: [[0, 0.106, 0.104, 0.106], [0.3, 0.112, 0.088, 0.13], [0.6, 0.092, 0.078, 0.1], [1, 0.058, 0.056, 0.06]],
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
    pts.push(Rx[0].pt);
    if (opt.insR) for (const q of opt.insR) pts.push(q);
    for (let i = 1; i < rs.length; i++) pts.push(i === rs.length - 1 && opt.sharpBot ? [...Rx[i].pt, 1] : Rx[i].pt);
    if (opt.botArc !== false) for (const i of nearIdx(bot, Rx[rs.length - 1].k, Lx[rs.length - 1].k)) pts.push(opt.botPts ? opt.botPts[i] : bot.P2[i]);
    for (let i = rs.length - 1; i >= 1; i--) pts.push(i === rs.length - 1 && opt.sharpBot ? [...Lx[i].pt, 1] : Lx[i].pt);
    if (opt.insL) for (const q of opt.insL) pts.push(q);
    pts.push(Lx[0].pt);
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

  /* ================================================================ limbs (2D capsules from projected joints) */
  // capsule p0->p1 with prof [[f, wA, wB], ...]; A = left of travel. Returns {pts (closed), A, B, ink (open U contour)}
  function capsule(p0, p1, prof, o = {}) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = hypot(dx, dy) || 1e-6, ux = dx / l, uy = dy / l, ax = uy, ay = -ux;
    const S = [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1];
    const A = [], B = [];
    for (const f of S) { const w = profAt(prof, f); const px = p0[0] + dx * f, py = p0[1] + dy * f; A.push([px + ax * w[0], py + ay * w[0]]); B.push([px - ax * w[1], py - ay * w[1]]); }
    const cap = (pc, wa, wb, fwd) => { // semicircle from A side to B side bulging along fwd (+1 forward, -1 backward)
      const r = (wa + wb) / 2, off = (wa - wb) / 2, c = [pc[0] + ax * off, pc[1] + ay * off], out = [];
      const k = o.capK ?? 1;
      for (let j = 1; j < 4; j++) { const a = (j / 4) * PI; out.push([c[0] + ax * r * cos(a) * (fwd > 0 ? 1 : 1) + ux * fwd * r * sin(a) * k, c[1] + ay * r * cos(a) + uy * fwd * r * sin(a) * k]); }
      return fwd > 0 ? out : out.reverse();
    };
    const w1 = profAt(prof, 1), w0 = profAt(prof, 0);
    const c1 = cap(p1, w1[0], w1[1], 1);            // from A to B around p1
    const c0 = cap(p0, w0[0], w0[1], -1);           // from B to A around p0 (reversed order below)
    const pts = A.concat(c1, B.slice().reverse(), c0);
    return { pts, A, B, c1, c0 };
  }
  // open ink contour of a capsule, skipping the proximal end (f < f0) so it merges into what it grows from
  function capsuleInk(cap, f0 = 0.15, endCap = true) {
    const S = [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1];
    const i0 = S.findIndex(f => f >= f0);
    const A = cap.A.slice(i0), B = cap.B.slice(i0).reverse();
    return endCap ? A.concat(cap.c1, B) : null;
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
      uniform: { top: 'blouse', sleeve: 'long', cuff: true, collar: 'blouse', ribbon: true, bottom: 'pleats', legs: 'socks', shoes: 'loafer' },
      blazer: { top: 'blouse', outer: 'blazer', sleeve: 'blazer', collar: 'blouse', ribbon: true, bottom: 'pleats', legs: 'socks', shoes: 'loafer' },
      dress: { top: 'dress', sleeve: 'cap', neckline: 'round', bottom: 'dress', legs: 'bare', shoes: 'pumps', necklace: true },
      dress_cardigan: { top: 'dress', outer: 'cardigan', sleeve: 'cardigan', neckline: 'round', bottom: 'dress', legs: 'bare', shoes: 'pumps', necklace: true },
      summer: { top: 'onepiece', sleeve: 'short', neckline: 'round', bottom: 'onepiece', legs: 'bare', shoes: 'sandal', hat: true },
      gown: { top: 'pajama', sleeve: 'pajama', collar: 'pajama', bottom: 'pajama_pants', legs: 'pants', shoes: 'slipper', cast: true },
      home: { top: 'knit', sleeve: 'knit', neckline: 'crew', bottom: 'long_skirt', legs: 'bare', shoes: 'slipper' },
    },
    boy: {
      uniform: { top: 'shirt', sleeve: 'rolled', collar: 'open', tie: true, bottom: 'trousers', belt: true, legs: 'pants', shoes: 'loafer_dark' },
      blazer: { top: 'shirt', outer: 'blazer_boy', sleeve: 'blazer', collar: 'open', tie: true, bottom: 'trousers', belt: true, legs: 'pants', shoes: 'loafer_dark' },
      tee: { top: 'tee', outer: 'open_shirt', sleeve: 'rolled_blue', neckline: 'crew', bottom: 'trousers', belt: true, legs: 'pants', shoes: 'sneaker' },
      jacket: { top: 'tee_black', outer: 'jacket', sleeve: 'jacket', neckline: 'crew', bottom: 'jeans', legs: 'pants', shoes: 'sneaker' },
      wet: { top: 'shirt', sleeve: 'rolled', collar: 'open', bottom: 'trousers', belt: true, legs: 'pants', shoes: 'loafer_dark', wet: true },
    },
    aunt: { coat: { top: 'turtle', outer: 'coat', sleeve: 'coat', neckline: 'crew', bottom: 'coat_skirt', legs: 'tights', shoes: 'boot' } },
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
      const ease = { blouse: [0.032, 0.03], dress: [0.012, 0.012], onepiece: [0.022, 0.02], pajama: [0.05, 0.045], knit: [0.075, 0.065], turtle: [0.02, 0.02] }[kind] || [0.03, 0.03];
      const [ea, eb] = ease;
      const rs = [
        bodyRing(sp, 'neck', ea * 1.1, eb * 1.1, { dip: kind === 'dress' || kind === 'onepiece' ? 0.12 : kind === 'knit' ? 0.07 : 0.045 }),
        bodyRing(sp, 'chestTop', ea + br, eb + br),
        bodyRing(sp, 'bust', ea + br, eb + br, kind === 'knit' ? { front: -0.01 } : {}),
        bodyRing(sp, 'underbust', ea + (kind === 'knit' ? 0.03 : 0.005), eb + 0.008),
        bodyRing(sp, 'waist', ea + (kind === 'blouse' ? 0.03 : kind === 'knit' ? 0.07 : 0.0), eb + (kind === 'blouse' ? 0.025 : kind === 'knit' ? 0.06 : 0.0)),
      ];
      if (kind === 'blouse') rs.push({ f: 'p', y: sp.waistY + 0.16, a: sp.rings.waist[2] + 0.07, b: sp.rings.waist[3] + 0.055, cz: 0 });
      else if (kind === 'knit' || kind === 'pajama') rs.push(bodyRing(sp, 'hipTop', ea + 0.02, eb + 0.02), bodyRing(sp, 'hip', ea, eb, { y: sp.rings.hip[1] - 0.06 }));
      else rs.push({ f: 'p', y: sp.waistY + 0.1, a: sp.rings.waist[2] + ea + 0.03, b: sp.rings.waist[3] + eb + 0.02, cz: 0 });
      return rs;
    }
    // boy / shirts
    const ease = { shirt: [0.04, 0.035], tee: [0.035, 0.03], tee_black: [0.035, 0.03] }[kind] || [0.04, 0.035];
    const [ea, eb] = ease;
    return [
      bodyRing(sp, 'neck', ea * 0.9, eb * 0.9, { dip: kind === 'shirt' ? 0.05 : 0.06 }),
      bodyRing(sp, 'chestTop', ea + br, eb + br),
      bodyRing(sp, 'chest', ea + br, eb + br),
      bodyRing(sp, 'lowChest', ea + 0.01, eb + 0.01),
      bodyRing(sp, 'waist', ea + 0.04, eb + 0.035),
      bodyRing(sp, 'hipTop', ea + 0.02, eb + 0.02, { y: sp.rings.hipTop[1] + 0.06 }),
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
    const part = G.add(layer, { name: 'torso', fam: 'torso', path, m, band: opt.band ?? 0.11, rs, ol, cast: [], shades: [], lines: [], rings });
    return part;
  }

  /* ---------------------------------------------------------------- blouse collar, ribbon, placket */
  function collarBlouse(G, layer, torso, opt = {}) {
    const R = G.R, m = R.m(opt.mat || 'blouse', opt.wet), r = torso.rings[0];
    const yN = r.y, parts = [];
    const fz = facing(G, 'c', [0, 0, 1]);
    // back band (stand collar around the back of the neck)
    const band = [];
    for (let a = 40; a >= -220; a -= 20) band.push(G.P2(ringPoint(G, r, a, yN - 0.075, 0.012)));
    for (let a = -220; a <= 40; a += 20) band.push(G.P2(ringPoint(G, r, a, yN + 0.005, 0.0)));
    const backBand = { name: 'collarBack', fam: 'collarB', path: shape(band), m, band: 0.03, lw: 0.8 };
    for (const sg of [1, -1]) {
      const ph = (d) => 90 - sg * d;
      const pts3 = [ringPoint(G, r, ph(5), yN - 0.06, 0.012), ringPoint(G, r, ph(62), yN - 0.075, 0.01), ringPoint(G, r, ph(70), yN + 0.02, 0.02),
        ringPoint(G, r, ph(42), yN + 0.17, 0.04), ringPoint(G, r, ph(28), yN + 0.205, 0.045), ringPoint(G, r, ph(9), yN + 0.07, 0.03)];
      const nz = facing(G, 'c', v3.norm([cos(ph(35) * PI / 180), 0, sin(ph(35) * PI / 180)]));
      if (nz < -0.25) continue;
      const pts = pts3.map(G.P2); pts[4] = [...pts[4], 1];
      const p = { name: 'collar' + sg, fam: 'collar' + sg, path: shape(pts), m, band: 0.035, lw: 0.85, z: nz };
      p.lines = [{ pts: [lerp2(pts[0], pts[1], 0.15), lerp2(pts[2], pts[3], 0.25)], w: 0.6, a: 0.7 }];   // the fold of the collar
      parts.push(p);
    }
    parts.sort((a, b) => a.z - b.z);
    return { backBand, flaps: parts, front: fz };
  }
  function ribbonBow(G, layer, torso, opt = {}) {
    const R = G.R, m = R.m('ribbon'), r = torso.rings[0];
    const c3 = ringPoint(G, r, 90, r.y + 0.06, 0.05);
    const ex = G.Vr(mv(G.J.F.c.M, [1, 0, 0])), ey = G.Vr(mv(G.J.F.c.M, [0, 1, 0])), ez = G.Vr(mv(G.J.F.c.M, [0, 0, 1]));
    if (ez[2] < -0.05) return null;
    const c = G.P2(c3), sw = opt.size || 1;
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
    const flare = opt.flare ?? { pleats: 0.2, dress: 0.14, onepiece: 0.26, long_skirt: 0.12, coat_skirt: 0.1 }[kind] ?? 0.15;
    const yW = (opt.waistY ?? sp.waistY) - 0.02;
    const waist = { f: 'w', y: yW, a: wr[2] + (opt.waistEase ?? 0.035), b: wr[3] + (opt.waistEase ?? 0.035) * 0.9, cz: 0 };
    const hipR = { f: 'p', y: hr[1] - 0.06, a: hr[2] + 0.05, b: hr[3] + 0.06, cz: hr[4] };
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
      if (seated) {
        // over the thighs: the cloth follows the thigh line toward the knees; at the back it lies on the seat
        let best = 0, td = null;
        for (const sd of ['L', 'R']) {
          const Hh = J['H' + sd], Kk = J['K' + sd], th = v3.norm(v3.sub(Kk, Hh));
          const toward = v3.dot(radial, v3.norm([th[0], 0, th[2]]));
          const lat = 1 - abs(v3.dot(radial, v3.norm(mv(pF.M, [1, 0, 0])))) * 0.0;
          const wgt = clamp(toward * 1.25 + 0.15) * lat;
          if (wgt > best) { best = wgt; td = th; }
        }
        if (td) { dir = v3.norm(v3.lerp(dir, v3.add(td, [0, 0.12, 0]), sstep(0, 1, best))); reach = L * lerp(0.92, 0.82, best); }
        const back = clamp(-v3.dot(radial, mv(pF.M, [0, 0, 1])) * 1.4);
        if (back > 0) { dir = v3.norm(v3.lerp(dir, v3.add(radial, [0, 0.35, 0]), back * 0.8)); reach = L * lerp(reach / L, 0.45, back); spread = flare * (1 + back); }
      }
      let h = v3.add(hp, v3.add(v3.mul(dir, reach), v3.mul(radial, spread + pl * (pleated ? 0.028 : 0))));
      if (pleated && pl < 0) h = v3.add(h, [0, -0.025, 0]);
      if (seated && opt.seatY !== undefined) h[1] = min(h[1], opt.seatY + 0.04);
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
      mid.push(v3.lerp(hp, h, 0.5));
    }
    const proj = (arr) => { const P2 = [], Z = []; for (const p of arr) { const v = G.V(p); P2.push([v[0], v[1]]); Z.push(v[2]); } return { P2, Z }; };
    const rW = ringSample(G, waist, N), rH = ringSample(G, hipR, N), rHem = proj(hem), rMid = proj(mid);
    const rs = [rW, rH, rMid, rHem];
    const ol = loftOutline(rs, { sharpBot: true, topArc: true });
    const path = shape(ol.pts);
    const part = G.add(layer, { name: 'skirt', fam: 'skirt', path, m, band: opt.band ?? 0.13, lw: 1, rs, hem: rHem, ol, lines: [], shades: [], cast: [] });
    // pleats: fold lines + alternating shaded strips on the near side
    const nearK = nearIdx(rHem, ol.Rx[3].k, ol.Lx[3].k);
    if (pleated) {
      const strips = new Path2D();
      for (let i = 0; i < nearK.length; i++) {
        const k = nearK[i], k2 = (k + 1) % N;
        if (!nearK.includes(k2) && k2 !== ol.Lx[3].k && k2 !== ol.Rx[3].k) continue;
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
  function legProf(G, p0, p1, fr3, prof) {
    const a = G.P2(p0), b = G.P2(p1), d = norm2(sub2(b, a)), nA = [d[1], -d[0]];
    const f = G.Vr(fr3), f2 = [f[0], f[1]], cA = dot2(nA, f2);
    return prof.map(([u, lat, fw, bk]) => {
      const wA = lat + (cA > 0 ? (fw - lat) : (bk - lat)) * abs(cA);
      const wB = lat + (cA > 0 ? (bk - lat) : (fw - lat)) * abs(cA);
      return [u, wA, wB];
    });
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
    const J = G.J, R = G.R, sp = G.sp;
    const Hh = J['H' + side], K = J['K' + side], An = J['A' + side];
    // anatomical front of the leg: perpendicular to the bone, toward the toes / the knee cap
    const toe = (J['foot' + side] && J['foot' + side].dir) || mv(J.F.p.M, [0, 0, 1]);
    const bendN = v3.cross(v3.sub(K, Hh), v3.sub(An, K));
    const frontOf = (a, b, hint) => { const d = v3.norm(v3.sub(b, a)); const f = v3.sub(hint, v3.mul(d, v3.dot(hint, d))); return v3.norm(f); };
    const fThigh = frontOf(Hh, K, v3.add(mv(J.F.p.M, [0, 0, 1]), v3.mul(v3.sub(K, v3.lerp(Hh, An, 0.5)), 2)));
    const fShin = frontOf(K, An, v3.add(toe, v3.mul(v3.sub(K, v3.lerp(Hh, An, 0.5)), 1.5)));
    void bendN;
    const pants = kind === 'pants' || kind === 'jeans';
    const out = [];
    const mSkin = R.m('skin');
    if (pants) {
      const mat = opt.mat || 'trousers', m = R.m(mat, opt.wet);
      const tW = opt.thighW || (sp.girl ? [[0, 0.2, 0.2, 0.2], [0.5, 0.17, 0.17, 0.17], [1, 0.14, 0.14, 0.14]] : [[0, 0.215, 0.215, 0.215], [0.5, 0.188, 0.19, 0.185], [1, 0.16, 0.16, 0.158]]);
      const sW = opt.shinW || (sp.girl ? [[0, 0.14, 0.14, 0.14], [0.6, 0.13, 0.13, 0.13], [1, 0.135, 0.135, 0.135]] : [[0, 0.158, 0.156, 0.158], [0.5, 0.15, 0.148, 0.15], [0.92, 0.145, 0.145, 0.145], [1, 0.15, 0.15, 0.15]]);
      const a = G.P2(Hh), k = G.P2(K), e = G.P2(v3.add(An, [0, 0.03, 0]));
      const c1 = capsule(a, k, legProf(G, Hh, K, fThigh, tW));
      const c2 = capsule(k, e, legProf(G, K, An, fShin, sW), { capK: 0.35 });
      const pThigh = { name: 'thigh' + side, fam: 'leg' + side, path: shape(c1.pts), m, band: 0.09, inkPts: [{ pts: capsuleInk(c1, 0.3), wf: taperBoth(0.15, 0.15) }], lines: [] };
      const pShin = { name: 'shin' + side, fam: 'leg' + side, path: shape(c2.pts), m, band: 0.085, inkPts: [{ pts: capsuleInk(c2, 0.25), wf: taperBoth(0.1, 0.1) }], lines: [] };
      // folds: behind the knee and a break at the hem
      const kn = k, dk = norm2(sub2(e, k)), nk = [dk[1], -dk[0]];
      const wk = profAt(tW, 1)[0];
      pThigh.lines.push({ pts: [add2(kn, mul2(nk, -wk * 0.7)), add2(add2(kn, mul2(dk, -0.12)), mul2(nk, -wk * 0.1)), add2(add2(kn, mul2(dk, -0.2)), mul2(nk, wk * 0.3))], w: 0.6, a: 0.7 });
      pShin.lines.push({ pts: [add2(add2(e, mul2(dk, -0.22)), mul2(nk, wk * 0.85)), add2(add2(e, mul2(dk, -0.14)), mul2(nk, 0.0)), add2(add2(e, mul2(dk, -0.19)), mul2(nk, -wk * 0.6))], w: 0.55, a: 0.6 });
      out.push(pThigh, pShin);
      return { parts: out };
    }
    // bare legs (+ socks / tights)
    const mat = kind === 'tights' ? 'tights' : 'skin';
    const m = R.m(mat);
    const a = G.P2(Hh), k = G.P2(K), e = G.P2(An);
    const c1 = capsule(a, k, legProf(G, Hh, K, fThigh, sp.thighW));
    const c2 = capsule(k, e, legProf(G, K, An, fShin, sp.shinW));
    const pThigh = { name: 'thigh' + side, fam: 'leg' + side, path: shape(c1.pts), m, band: 0.06, inkPts: [{ pts: capsuleInk(c1, 0.35), wf: taperBoth(0.15, 0.15) }], cast: [], lines: [] };
    const pShin = { name: 'shin' + side, fam: 'leg' + side, path: shape(c2.pts), m, band: 0.05, inkPts: [{ pts: capsuleInk(c2, 0.2), wf: taperBoth(0.1, 0.1) }], cast: [], lines: [] };
    // knee: a short soft line on the lit side of the knee cap (front views) / the back of the knee (bent)
    const dk = norm2(sub2(e, k)), nk = [dk[1], -dk[0]];
    const fv = G.Vr(fShin);
    if (abs(fv[2]) > 0.5) pShin.lines.push({ pts: [add2(add2(k, mul2(dk, -0.07)), mul2(nk, -0.03)), add2(add2(k, mul2(dk, 0.0)), mul2(nk, -0.045)), add2(add2(k, mul2(dk, 0.07)), mul2(nk, -0.03))], w: 0.5, a: 0.55 });
    out.push(pThigh, pShin);
    if (kind === 'socks') {
      const ms = R.m(opt.sockMat || 'sock');
      const f0 = opt.sockTop ?? 0.16;
      const s0 = lerp2(k, e, f0);
      const prof = legProf(G, K, An, fShin, sp.shinW).map(([u, wa, wb]) => [u, wa, wb]);
      const sub = prof.filter(q => q[0] >= f0).map(([u, wa, wb]) => [(u - f0) / (1 - f0), wa + 0.006, wb + 0.006]);
      const w0 = profAt(prof, f0); sub.unshift([0, w0[0] + 0.008, w0[1] + 0.008]);
      const c3 = capsule(s0, e, sub, { capK: 0.4 });
      const pSock = { name: 'sock' + side, fam: 'sock' + side, path: shape(c3.pts), m: ms, band: 0.045, lines: [] };
      // ribbed top band
      const d2 = norm2(sub2(e, s0)), n2 = [d2[1], -d2[0]];
      const tb = add2(s0, mul2(d2, 0.06));
      pSock.lines.push({ pts: [add2(tb, mul2(n2, w0[0] * 0.95)), add2(add2(tb, mul2(d2, 0.012)), mul2(n2, 0)), add2(tb, mul2(n2, -w0[1] * 0.95))], w: 0.5, a: 0.6 });
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
    blazer: { up: 0.05, fore: 0.045, to: 0.96, cuff: 0, mat: 'blazer', under: 'blouse' },
    rolled: { up: 0.04, fore: 0.036, to: 0.42, roll: 0.11, mat: null },
    rolled_blue: { up: 0.045, fore: 0.04, to: 0.4, roll: 0.11, mat: 'shirt_blue' },
    cap: { up: 0.03, to: -0.28, mat: null },        // negative: ends on the upper arm at 28%
    short: { up: 0.035, to: -0.42, mat: null },
    cardigan: { up: 0.045, fore: 0.04, to: 1.03, cuff: 0.1, cuffW: 0.008, mat: 'cardigan', rib: true },
    pajama: { up: 0.05, fore: 0.05, to: 1.0, cuff: 0.0, mat: null },
    knit: { up: 0.07, fore: 0.065, to: 1.12, cuff: 0.12, cuffW: 0.0, mat: null, rib: true },
    jacket: { up: 0.055, fore: 0.05, to: 0.98, cuff: 0.08, cuffW: 0.006, mat: 'jacket' },
    coat: { up: 0.055, fore: 0.05, to: 0.98, cuff: 0.0, mat: 'coat' },
    blazer_boy: { up: 0.05, fore: 0.045, to: 0.96, cuff: 0, mat: 'blazer' },
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
    if (bareUp) parts.push(skinUp);
    if (bareFore || sl.to < 1) parts.push(skinFo);
    // hand
    const hand = buildHand(G, side, opt);
    // sleeves
    if (sl.to < 0) { // short sleeve on the upper arm
      const t = -sl.to, p1 = lerp2(S, E, t);
      const c = capsule(S, p1, [[0, up[0][1] + sl.up + 0.01, up[0][1] + sl.up + 0.01], [0.6, profAt(up, t * 0.6)[0] + sl.up, profAt(up, t * 0.6)[0] + sl.up], [1, profAt(up, t)[0] + sl.up * 1.2, profAt(up, t)[0] + sl.up * 1.2]], { capK: 0.25 });
      parts.push({ name: 'sleeve' + side, fam, path: shape(c.pts), m: mS, band: 0.05, inkPts: [{ pts: capsuleInk(c, 0.35), wf: taperBoth(0.2, 0.1) }], lines: [], z: 1 });
    } else {
      const cu = capsule(S, E, [[0, up[0][1] + sl.up + 0.012, up[0][1] + sl.up + 0.012], [0.5, profAt(up, 0.5)[0] + sl.up, profAt(up, 0.5)[0] + sl.up], [1, profAt(up, 1)[0] + sl.up * 1.15, profAt(up, 1)[0] + sl.up * 1.15]]);
      const upS = { name: 'sleeveUp' + side, fam, path: shape(cu.pts), m: mS, band: 0.055, inkPts: [{ pts: capsuleInk(cu, 0.3), wf: taperBoth(0.2, 0.15) }], lines: [] };
      const to = min(sl.to, 1.0);
      const pEnd = lerp2(E, W, to + (sl.to > 1 ? (sl.to - 1) : 0));
      const cuffLen = sl.cuff || 0;
      const pCuffStart = lerp2(E, W, max(0.05, to - (cuffLen / max(0.3, hypot(W[0] - E[0], W[1] - E[1])))));
      const wE = profAt(fo, 0)[0] + sl.fore * 1.15, wM = profAt(fo, to * 0.6)[0] + sl.fore, wT = profAt(fo, to)[0] + sl.fore * (sl.to > 1 ? 1.4 : 0.9);
      const cf = capsule(E, cuffLen ? pCuffStart : pEnd, [[0, wE, wE], [0.5, wM, wM], [1, wT, wT]]);
      const foS = { name: 'sleeveFo' + side, fam, path: shape(cf.pts), m: mS, band: 0.05, inkPts: [{ pts: capsuleInk(cf, 0.3), wf: taperBoth(0.2, 0.1) }], lines: [] };
      // elbow folds (where the sleeve bunches)
      const de = norm2(sub2(W, E)), ne = [de[1], -de[0]], bend = dot2(norm2(sub2(E, S)), de);
      const nf = bend < 0.92 ? 3 : 2;
      for (let i = 0; i < nf; i++) {
        const sgn = i % 2 ? -1 : 1, o0 = add2(E, mul2(de, -0.05 + i * 0.07));
        foS.lines.push({ pts: [add2(o0, mul2(ne, sgn * wE * 0.95)), add2(add2(o0, mul2(de, 0.05)), mul2(ne, sgn * wE * 0.3))], w: 0.55, a: 0.7 });
      }
      parts.push(upS, foS);
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
    const c = clamp(curl), out = { main: null, thumb: null, lines: [] };
    if (kind === 'fist' || kind === 'grip') {
      if (view === 'side' || view === 'edge') {
        out.main = [[0, -0.1], [0.22, -0.115], [0.42, -0.11], [0.56, -0.06], [0.6, 0.02], [0.55, 0.1], [0.42, 0.14], [0.22, 0.12], [0, 0.09]];
        if (view === 'side') out.thumb = [[0.18, 0.0], [0.34, -0.035], [0.47, -0.025], [0.5, 0.02], [0.4, 0.05], [0.22, 0.07]];
        out.lines = [[[0.44, -0.08], [0.5, -0.0], [0.47, 0.08]]];
      } else {
        out.main = [[0, -0.14], [0.2, -0.17], [0.42, -0.17], [0.55, -0.12], [0.6, -0.02], [0.58, 0.1], [0.46, 0.17], [0.22, 0.16], [0, 0.13]];
        out.thumb = view === 'back' ? [[0.08, -0.12], [0.25, -0.2], [0.4, -0.2], [0.45, -0.14], [0.32, -0.1]] : null;
        out.lines = [[[0.48, -0.075], [0.58, -0.07]], [[0.49, 0.015], [0.6, 0.018]], [[0.47, 0.095], [0.57, 0.1]]];
      }
      return out;
    }
    if (view === 'side' || view === 'edge') {
      // a blade: back of the hand on top (-y), fingers curl toward +y
      const kn = [0.48, -0.06], segs = [0.25, 0.15, 0.12], ang = [0.35 * c + 0.06, 0.75 * c + 0.05, 0.6 * c + 0.03];
      let p = kn, a = 0.05; const top = [], bot = [], w = [0.06, 0.05, 0.042];
      for (let i = 0; i < 3; i++) {
        a += ang[i]; const q = [p[0] + cos(a) * segs[i], p[1] + sin(a) * segs[i]];
        const nx = -sin(a), ny = cos(a);
        top.push([q[0] - nx * w[i], q[1] - ny * w[i]]); bot.push([q[0] + nx * w[i] * 1.05, q[1] + ny * w[i] * 1.05]);
        p = q;
      }
      const tipN = [cos(a), sin(a)];
      const tip = [p[0] + tipN[0] * 0.035, p[1] + tipN[1] * 0.035];
      out.main = [[0, -0.075], [0.25, -0.1], [0.46, -0.105]].concat(top, [tip], bot.reverse(), [[0.44, 0.075 + 0.02 * c], [0.22, 0.09], [0, 0.075]]);
      if (view === 'side') {
        const ta = -0.25 - 0.2 * (1 - c);
        out.thumb = [[0.1, 0.02], [0.24, 0.07 + 0.03 * c], [0.38 + 0.03 * c, 0.1 + 0.02 * c], [0.46, 0.08], [0.44, 0.04], [0.3, 0.02], [0.18, -0.01]];
        void ta;
      }
      // finger separation along the blade
      const mid = lerp2(top[1], bot[1], 0.45);
      out.lines.push([[0.5, 0.0], lerp2([0.5, 0.0], mid, 0.5), mid]);
      return out;
    }
    // back / palm: fingers together (slightly fanned by spread), tips pulled in by curl
    const f = [[-0.135, 0.44], [-0.045, 0.5], [0.045, 0.46], [0.13, 0.36]];
    const kx = [0.46, 0.48, 0.47, 0.44];
    const tips = f.map(([y, L], i) => { const Lc = L * (1 - 0.55 * c), a = (i - 1.5) * 0.12 * spread; return [kx[i] + cos(a) * Lc, y * (1 + spread * 0.5) + sin(a) * Lc]; });
    const W = 0.042;
    out.main = [[0, -0.145], [0.2, -0.18], [kx[0], -0.19 - spread * 0.02], lerp2([kx[0], -0.185], [tips[0][0], tips[0][1] - W], 0.6),
      [tips[0][0] - 0.015, tips[0][1] - W * 0.9], [tips[0][0] + 0.02, tips[0][1]], [tips[1][0] + 0.02, tips[1][1] - 0.005], [tips[2][0] + 0.02, tips[2][1] + 0.005], [tips[3][0] + 0.015, tips[3][1] + 0.01],
      [tips[3][0] - 0.02, tips[3][1] + W * 0.95], lerp2([kx[3], 0.18], [tips[3][0], tips[3][1] + W], 0.5), [kx[3], 0.19 + spread * 0.02], [0.2, 0.17], [0, 0.14]];
    for (let i = 0; i < 3; i++) {
      const a = [lerp(kx[i], kx[i + 1], 0.5) + 0.05, (f[i][0] + f[i + 1][0]) / 2 * (1 + spread * 0.5)], b = lerp2(tips[i], tips[i + 1], 0.5);
      out.lines.push([a, lerp2(a, b, 0.5), [b[0] - 0.03, b[1]]]);
    }
    out.thumb = view === 'back' ? [[0.06, -0.12], [0.2, -0.22], [0.33, -0.29 + c * 0.05], [0.41, -0.29 + c * 0.06], [0.42, -0.24 + c * 0.05], [0.3, -0.16], [0.18, -0.1]]
      : [[0.06, 0.12], [0.2, 0.22], [0.33, 0.29 - c * 0.05], [0.41, 0.29 - c * 0.06], [0.42, 0.24 - c * 0.05], [0.3, 0.16], [0.18, 0.1]];
    if (view === 'palm') { out.main = out.main.map(([x, y]) => [x, -y]); out.lines = out.lines.map(L => L.map(([x, y]) => [x, -y])); out.lines.push([[0.12, 0.08], [0.25, 0.02], [0.4, -0.02]]); }
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
    const thumbBehind = view === 'back' && !hd.kind;
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
    const band = [];
    for (let a = 30; a >= -210; a -= 20) band.push(G.P2(ringPoint(G, r, a, yN - 0.085, 0.012)));
    for (let a = -210; a <= 30; a += 20) band.push(G.P2(ringPoint(G, r, a, yN + 0.005, 0.0)));
    const backBand = { name: 'collarBack', fam: 'collarB', path: shape(band), m, band: 0.03, lw: 0.8 };
    for (const sg of [1, -1]) {
      const ph = (d) => 90 - sg * d;
      // the open collar: points spread outward and down over the collarbone
      const pts3 = [ringPoint(G, r, ph(22), yN - 0.07, 0.012), ringPoint(G, r, ph(70), yN - 0.085, 0.01), ringPoint(G, r, ph(78), yN + 0.03, 0.02),
        ringPoint(G, r, ph(55), yN + 0.2, 0.045), ringPoint(G, r, ph(40), yN + 0.24, 0.05), ringPoint(G, r, ph(25), yN + 0.06, 0.03)];
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
    const knot = [T(-0.05, -0.05), T(0.05, -0.055), T(0.035, 0.05), T(-0.03, 0.05)];
    // the blade follows the chest: sample the front centre of the rings below
    const rs = torso.rings, blade = [];
    const L = 1.15;
    const pts = [T(-0.03, 0.04), T(0.035, 0.04)];
    const cen = [];
    for (let i = 1; i < rs.length - 1; i++) cen.push(G.P2(ringPoint(G, rs[i], 90 + 6, undefined, 0.035)));
    const bottom = G.P2(ringPoint(G, rs[rs.length - 2], 92, rs[rs.length - 2].y + 0.15, 0.04));
    const pathC = [c].concat(cen.filter(p => p[1] > c[1] + 0.05), [bottom]);
    // widths along the blade (wider toward the tip)
    const wAt = (u) => lerp(0.045, 0.085, u);
    const A2 = [], B2 = [];
    for (let i = 0; i < pathC.length; i++) {
      const p = pathC[i], q = pathC[min(pathC.length - 1, i + 1)], pr = pathC[max(0, i - 1)];
      const d = norm2(sub2(q, pr)), n = [d[1], -d[0]], u = i / (pathC.length - 1), w = wAt(u);
      const ps = add2(p, [sw * u * 0.06, 0]);
      A2.push(add2(ps, mul2(n, w))); B2.push(add2(ps, mul2(n, -w)));
    }
    const end = pathC[pathC.length - 1], dEnd = norm2(sub2(end, pathC[pathC.length - 2]));
    const tip = add2(add2(end, [sw * 0.06, 0]), mul2(dEnd, 0.07));
    blade.push(...A2, [...tip, 1], ...B2.reverse());
    void L; void pts;
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

  /* ================================================================ poses */
  // A pose = { facing (default), body(sp, prm, tq, o) -> {pelvis, spine, neck, shrugL/R, breath, head}, limbs(J, sp, prm, tq, o) ->
  //            {arms: {L, R}, legs: {L, R}}, props(G) (optional) }. Body space: anchor at the origin, +z = the character's front.
  const POSES = {};
  const breath = (tq) => 0.5 + 0.5 * sin(tq * TAU / 3.6);

  POSES.stand = {
    facing: 'front', anchor: 'ground between the feet',
    body(sp, prm, tq) {
      const w = prm.weight ?? 0.4;   // + : weight on the character's left leg (+x)
      const sway = 0.012 * N2(3.3, tq * 0.4);
      const bow = prm.bow || 0;
      return {
        pelvis: { pos: [w * 0.035 + sway, sp.hipY + abs(w) * 0.02 + bow * 0.05, -bow * 0.12], yaw: (prm.yaw || 0), pitch: 0.03 + bow * 0.25, roll: -w * 0.045 },
        spine: { twist: prm.twist || 0, bend: -0.03 + bow * 0.55, side: w * 0.065 },
        neck: { pitch: 0.06 + bow * 0.35 + (prm.nod || 0), roll: -w * 0.025 + (prm.tilt || 0), yaw: prm.neckYaw || 0 },
        breath: breath(tq),
      };
    },
    limbs(J, sp, prm, tq) {
      const w = prm.weight ?? 0.4, arms = {}, legs = {};
      const st = prm.stance ?? (sp.girl ? 0.1 : 0.15);
      for (const s of ['L', 'R']) {
        const sg = s === 'L' ? 1 : -1, load = sg * w > 0 ? 1 : 0;
        legs[s] = { A: [sg * st + w * 0.03 + (load ? 0 : sg * 0.03), -sp.ankleH - (load ? 0 : 0.0), load ? 0 : 0.05], pole: [sg * 0.05, 0, 1], foot: { dir: [sg * (0.18 + (load ? 0 : 0.12)), 0, 1] } };
        const swing = 0.015 * sin(tq * 1.3 + sg);
        arms[s] = { W: v3.add(J['S' + s], [sg * (sp.girl ? 0.11 : 0.14), sp.upArm + sp.foreArm - 0.06, 0.05 + swing]), pole: [sg * 0.3, 0, -1], hand: { curl: 0.35, f: [sg * -0.05, 1, 0.12] } };
      }
      const pose = prm.arms || 'relax';
      if (pose === 'chest') { // her right hand on her chest
        const tgt = v3.add(J.at('c', -0.06, sp.chestY - 0.12, 0.33), [0, 0, 0]);
        arms.R = { W: tgt, pole: [-1, 0.3, -0.4], hand: { curl: 0.15, spread: 0.15, f: [0.6, -0.35, 0.3], palm: [0, 0, -1] } };
      } else if (pose === 'behind') {
        for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; arms[s] = { W: J.at('p', sg * 0.05, sp.hipY + 0.05, -0.32), pole: [sg * 0.8, 0, -0.5], hand: { curl: 0.4, f: [-sg, 0.4, 0], view: 'edge' } }; }
      } else if (pose === 'bow') {
        for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; arms[s] = { W: J.at('p', sg * 0.06, sp.hipY + 0.35, 0.25), pole: [sg * 0.3, 0, -1], hand: { curl: 0.2, f: [-sg * 0.4, 1, 0.3] } }; }
      }
      return { arms, legs };
    },
  };

  /* ================================================================ figure assembly */
  const FACING = { front: 0, '3q_right': PI / 4, right: HP, '3q_back_right': 3 * PI / 4, back: PI, '3q_back_left': -3 * PI / 4, left: -HP, '3q_left': -PI / 4 };
  function facingAngle(f, def) { if (typeof f === 'number') return f; if (f && FACING[f] !== undefined) return FACING[f]; return FACING[def] ?? 0; }

  function assemble(ctx, o, R) {
    const who = o.who || 'senpai', sp = SPECS[who] || SPECS.senpai;
    const outfitName = o.outfit || DEFAULT_OUTFIT[who];
    const OF = (OUTFITS[who] || OUTFITS.senpai)[outfitName] || (OUTFITS[who] || OUTFITS.senpai)[DEFAULT_OUTFIT[who]];
    const pose = POSES[o.pose || 'stand'] || POSES.stand;
    const T = o.T || 0, tq = A.onTwos(T), prm = o.params || {};
    const theta = facingAngle(o.facing, pose.facing);
    const VM = mm(rot(0, o.camPitch || 0, 0), rot(theta, 0, 0));
    const P = pose.body(sp, prm, tq, o, OF);
    const J = buildRig(sp, P);
    solveLimbs(J, pose.limbs(J, sp, prm, tq, o, OF));
    const G = newBuild(J, VM, R, o, sp);
    G.theta = theta; G.tq = tq; G.OF = OF; G.pose = pose; G.P = P;
    const VMi = mm(rot(-theta, 0, 0), rot(0, -(o.camPitch || 0), 0));
    G.toBody = (v) => mv(VMi, v);
    const wet = OF.wet ? 1 : (o.wet || 0);
    const layers = { back: [], legsFar: [], legsNear: [], armsBack: [], main: [], front: [] };
    // depth helpers
    const torsoZ = G.Z(J.F.c.o);
    const armZ = (s) => (G.Z(J['E' + s]) + G.Z(J['W' + s]) + G.Z(J['S' + s])) / 3;
    const legZ = (s) => (G.Z(J['K' + s]) + G.Z(J['A' + s])) / 2;
    const parts = {};

    /* ---- legs + shoes */
    const legKind = OF.legs || 'bare';
    const legOrder = ['L', 'R'].sort((a, b) => legZ(a) - legZ(b));
    const pantsMat = { trousers: 'trousers', jeans: 'jeans', pajama_pants: 'pajama_pants' }[OF.bottom];
    const skirted = !pantsMat;
    for (const s of legOrder) {
      const lay = s === legOrder[0] ? 'legsFar' : 'legsNear';
      const shoe = buildShoe(G, '__tmp', s, OF.shoes || 'loafer');
      const leg = buildLeg(G, '__tmp', s, legKind, { mat: pantsMat, wet });
      parts['leg' + s] = leg;
      if (skirted) { G.add(lay, shoe); for (const p of leg.parts) G.add(lay, p); }
      else { // trousers: the shoe under the hem
        G.add(lay, shoe); for (const p of leg.parts) G.add(lay, p);
      }
      // move the leg/shoe parts so that the bare leg is drawn first, then the sock, then the shoe (opening over the ankle)
      const arr = G.layers[lay];
      if (skirted) { const i = arr.indexOf(shoe); arr.splice(i, 1); arr.push(shoe); }
    }
    delete G.layers.__tmp;

    /* ---- torso */
    const topKind = OF.top;
    const topMat = { blouse: 'blouse', shirt: 'shirt', dress: 'dress', onepiece: 'onepiece', pajama: 'gown', knit: 'knit', tee: 'tee', tee_black: 'tee_black', turtle: 'coat' }[topKind] || 'blouse';
    // the collar back band sits behind the neck in front views and over it in back views
    const fz = facing(G, 'c', [0, 0, 1]);
    const torso = buildTorso(G, '__t', topKind, topMat, { wet });
    delete G.layers.__t;
    let collar = null;
    if (OF.collar === 'blouse') collar = collarBlouse(G, 'main', torso, { wet });
    else if (OF.collar === 'open') collar = collarOpen(G, torso, { wet });
    if (collar && fz >= 0) G.add('main', collar.backBand);
    buildNeck(G, 'main');
    if (collar && fz < 0) G.add('main', collar.backBand);
    G.add('main', torso);
    // trousers seat + belt (shirt tucked in)
    let seat = null, belt = null;
    if (pantsMat) { seat = trouserSeat(G, 'main', pantsMat, { wet }); if (OF.belt) { belt = beltPart(G); G.add('main', belt); } }
    // trouser legs belong to the main layer (they emerge from the seat)
    if (pantsMat) {
      for (const s of legOrder) {
        const lay = s === legOrder[0] ? 'legsFar' : 'legsNear';
        const arr = G.layers[lay] || [];
        const legParts = arr.filter(p => p.fam === 'leg' + s);
        if (legZ(s) > torsoZ - 0.15) { // in front of / level with the hips: inside the main layer, after the seat
          G.layers[lay] = arr.filter(p => p.fam !== 'leg' + s);
          for (const p of legParts) G.add('main', p);
        }
      }
    }
    // placket / buttons
    if (topKind === 'blouse' || topKind === 'shirt') torso.lines.push(...placket(G, torso, { top: topKind === 'shirt' ? 0.22 : 0.16 }));
    // collar flaps + ribbon / tie
    if (collar) {
      for (const f of collar.flaps) { G.add('main', f); torso.cast.push({ path: f.path, d: 0.045 }); }
      if (collar.vneck) { const mSk = R.m('skin'); const vp = { name: 'vneck', fam: 'vneck', path: shape(collar.vneck), m: mSk, band: 0.0, lw: 0.7, noOutline: true, ink: false }; const ti = G.layers.main.indexOf(torso); G.layers.main.splice(ti + 1, 0, vp); }
    }
    if (OF.ribbon) { const rb = ribbonBow(G, 'main', torso, { sway: 0.01 * sin(tq * 1.7) }); if (rb) { for (const p of rb.parts) G.add('main', p); torso.cast.push({ path: rb.all, d: 0.04 }); } }
    if (OF.tie) {
      const tie = tieLoose(G, torso, { sway: 0.4 * N2(5.1, tq * 0.7) });
      if (tie) { const vi = G.layers.main.findIndex(p => p.name === 'vneck'); const ti = vi >= 0 ? vi : G.layers.main.indexOf(torso); G.layers.main.splice(ti + 1, 0, ...tie.parts); torso.cast.push({ path: tie.all, d: 0.04 }); }
    }
    /* ---- skirt */
    let skirt = null;
    if (skirted && OF.bottom) {
      skirt = buildSkirt(G, 'main', OF.bottom, { tq, wind: o.wind || 0, windDir: o.windDir, seat: P.seated ? true : false, seatY: P.seatY, wet, knees: P.knees });
      // the hem casts a band of shadow on the legs
      for (const s of ['L', 'R']) for (const p of parts['leg' + s].parts) { p.cast = p.cast || []; p.cast.push({ path: skirt.path, d: 0.1 }); }
    }
    /* ---- arms */
    const sleeve = OF.sleeve || 'long';
    for (const s of ['L', 'R']) {
      const arm = buildArm(G, '__a', s, sleeve, topMat, { wet });
      const behind = armZ(s) < torsoZ - 0.12;
      const lay = behind ? 'armsBack' : 'main';
      const list = [];
      if (arm.hand) { // the hand goes under the cuff
        list.push(...arm.parts.filter(p => p.name.startsWith('upSkin') || p.name.startsWith('foSkin')));
        list.push(...arm.hand.parts);
        list.push(...arm.parts.filter(p => !(p.name.startsWith('upSkin') || p.name.startsWith('foSkin'))));
      } else list.push(...arm.parts);
      parts['arm' + s] = { list, behind, z: armZ(s) };
      if (!behind) { // the arm darkens the torso / skirt beside it
        const up = arm.parts.find(p => p.name.startsWith('sleeveUp') || p.name.startsWith('sleeve')) || arm.parts[0];
        if (up) { torso.cast.push({ path: up.path, d: 0.07 }); if (skirt) skirt.cast.push({ path: up.path, d: 0.07 }); }
      }
    }
    const armOrder = ['L', 'R'].sort((a, b) => parts['arm' + a].z - parts['arm' + b].z);
    for (const s of armOrder) { const a = parts['arm' + s]; for (const p of a.list) G.add(a.behind ? 'armsBack' : 'main', p); }
    delete G.layers.__a;
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
    let back = abs(ang) > HP + 1e-3, yaw = back ? Math.sign(ang) * (PI - abs(ang)) / HP : ang / HP;
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
    args.hair = Object.assign({ wind: o.wind || 0, windDir: o.windDir || 0 }, hp.hair || {});
    if (o.outfit === 'dress' && !(hp.hair && hp.hair.style)) args.hair.style = 'updo';
    if (o.outfit === 'dress_cardigan' && !(hp.hair && hp.hair.style)) args.hair.style = 'loose';
    if (G.OF.wet && !(hp.hair && hp.hair.style)) args.hair.style = 'wet';
    delete args.turn; delete args.sizeK;
    return args;
  }
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

  /* ================================================================ public: figure */
  function drawFigure(ctx, o, extra) {
    const s = o.scale || 100, flip = !!o.flip;
    ctx.save();
    const R = makeRC(ctx, o, s, flip);
    const G = assemble(ctx, o, R);
    const hasAlpha = o.alpha !== undefined && o.alpha < 1;
    let dst = ctx, buf = null;
    if (hasAlpha) {
      buf = PV.buffer('animeFig', ctx.canvas.width, ctx.canvas.height); buf.ctx.clearRect(0, 0, buf.canvas.width, buf.canvas.height);
      buf.ctx.setTransform(ctx.getTransform()); dst = buf.ctx; R.ctx = dst;
    }
    const oh = Object.assign({}, o); delete oh.alpha;
    // 1) hair behind the body
    callHead(dst, 'headBack', headArgs(G, oh, s, 'back'));
    // 2) body layers in depth order
    dst.save(); dst.translate(o.x || 0, o.y || 0); if (flip) dst.scale(-1, 1); dst.scale(s, s);
    for (const k of ['back', 'armsBack', 'legsFar', 'legsNear', 'main', 'front']) if (G.layers[k] && G.layers[k].length) paintGroup(R, G.layers[k]);
    dst.restore();
    // 3) the head (face + front hair)
    const head = callHead(dst, 'head', headArgs(G, oh, s, 'front'));
    if (buf) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= o.alpha; ctx.drawImage(buf.canvas, 0, 0); ctx.restore(); }
    ctx.restore();
    const toPx = (p) => [o.x + p[0] * s * (flip ? -1 : 1), o.y + p[1] * s];
    return { head, neck: toPx(G.P2(G.J.neckTop)), hands: { L: toPx(G.P2(G.J.WL)), R: toPx(G.P2(G.J.WR)) }, G };
  }
  A.figure = function (ctx, o = {}) { return drawFigure(ctx, o); };
  A.FIG_POSES = POSES;
  A.__body = { SPECS, OUTFITS, POSES, rot, mm, mv, v3 };
})();

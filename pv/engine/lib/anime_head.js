/* anime_head.js — anime-style heads for 『キミの右手のアイロニー』: faces, eyes, hair, expressions, busts.
 *   PV.anime.head(ctx, o) / PV.anime.headBack(ctx, o) / PV.anime.bust(ctx, o) / PV.anime.EXPR / PV.anime.neck(ctx, o)
 * API reference: analysis/art_review/anime_head_API.md
 *
 * Construction ("2.5D model sheet"):
 *  - Each character's head volume is defined by model-sheet curves in head units H (chin y=0, crown y=-1, x to the
 *    viewer's right when facing the camera, z toward the viewer, z=0 through the ears): front half-width w(y),
 *    face line zf(y) (profile without nose / lips), side line zs(y), back line zb(y), plus narrow nose / lip bumps,
 *    eye sockets and cheekbones.
 *  - Horizontal slices of that volume are rotated (pitch about the neck point, then yaw) and projected
 *    orthographically; their left / right extremes give the silhouette, so front, 3/4, profile and back views all come
 *    from the same model and turn smoothly.
 *  - Feature anchors (eyes, brows, nose, mouth, ears, hairline, hair roots) live on that surface and turn with it.
 *    Eyes are drawn as flat anime shapes in their own foreshortened 2D frame (squeezed in 3/4, a wedge in profile);
 *    brows and mouth are drawn on the surface.
 *  - Hair = a smooth cap (offset of the skull silhouette, clipped at the projected hairline) + clumps (3D centre
 *    lines -> 2D ribbons with pointed tips) drawn far-to-near, each with a tapered outline, cel shadow at the root and
 *    along the side away from the light; a zig-zag angel ring crosses the cap and the bangs.
 *  - Colours: every tone comes from PV.anime.mat(material, o.light). Rim light = crisp band on the light side of the
 *    union silhouette (offscreen mask, shifted copy subtracted).
 * Deterministic in (o.T, o.seed); hair / cloth sway is quantised on twos.
 */
(function () {
  'use strict';
  const PV = window.PV; const A = (PV.anime = PV.anime || {});
  const PI = Math.PI, TAU = PI * 2, HP = PI / 2;
  const sin = Math.sin, cos = Math.cos, abs = Math.abs, sqrt = Math.sqrt, pow = Math.pow, min = Math.min, max = Math.max;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const bell = (x, c, w) => { const d = (x - c) / w; return Math.exp(-d * d); };
  const L2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const nrm = (v) => { const l = Math.hypot(v[0], v[1]) || 1e-9; return [v[0] / l, v[1] / l]; };
  const rgba = (h, a) => A.rgbaHex(h, clamp(a));
  const mixH = (a, b, t) => A.mixHex(a, b, clamp(t));
  const D2R = PI / 180;

  /* ================================================================== small path helpers */
  function poly(ctx, P, close = true) { if (!P.length) return; ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); if (close) ctx.closePath(); }
  function fillPoly(ctx, P, col) { ctx.beginPath(); poly(ctx, P); ctx.fillStyle = col; ctx.fill(); }
  function smooth(P, closed = false, per = 4) { return P.length < 3 ? P.slice() : A.spline(P, closed, per); }
  function area(P) { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function ccw(P) { return area(P) < 0 ? P.slice().reverse() : P; }       // consistent winding (union clips)
  function bbox(list) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const P of list) for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    return [x0, y0, x1, y1];
  }
  // tapered ink stroke with a width profile f(u) (px); pts already in screen space
  function ink(ctx, pts, f, col, smoothIt = true) { if (pts.length >= 2) A.taper(ctx, pts, f, col, smoothIt && pts.length >= 3); }
  // offset a closed polygon outward by d(i) px (vertex normals; fine for the convex-ish skull outline)
  function offsetPoly(P, d) {
    const n = P.length, out = []; const sg = area(P) < 0 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
      const t = nrm([b[0] - a[0], b[1] - a[1]]); const k = typeof d === 'function' ? d(i) : d;
      out.push([P[i][0] + t[1] * k * sg, P[i][1] - t[0] * k * sg]);
    }
    return out;
  }

  /* ================================================================== monotone-ish cubic key curves */
  function curve(keys, linear = false) {
    const K = keys.slice().sort((a, b) => a[0] - b[0]); const n = K.length;
    const X = K.map(k => k[0]), Y = K.map(k => k[1]);
    const M = Y.map((_, i) => {
      if (i === 0) return (Y[1] - Y[0]) / (X[1] - X[0]);
      if (i === n - 1) return (Y[n - 1] - Y[n - 2]) / (X[n - 1] - X[n - 2]);
      const d0 = (Y[i] - Y[i - 1]) / (X[i] - X[i - 1]), d1 = (Y[i + 1] - Y[i]) / (X[i + 1] - X[i]);
      if (d0 * d1 <= 0) return 0;                                   // keep extremes flat: no overshoot
      return (d0 * (X[i + 1] - X[i]) + d1 * (X[i] - X[i - 1])) / (X[i + 1] - X[i - 1]);
    });
    return function (x) {
      if (x <= X[0]) return Y[0]; if (x >= X[n - 1]) return Y[n - 1];
      let i = 0; while (x > X[i + 1]) i++;
      const h = X[i + 1] - X[i], t = (x - X[i]) / h;
      if (linear) return Y[i] + (Y[i + 1] - Y[i]) * t;
      const t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * Y[i] + (t3 - 2 * t2 + t) * h * M[i] + (-2 * t3 + 3 * t2) * Y[i + 1] + (t3 - t2) * h * M[i + 1];
    };
  }

  /* ================================================================== character head models (unit = H) */
  const MODEL_DEF = {
    senpai: {
      w: [[-1.0, 0.0], [-0.99, 0.085], [-0.97, 0.15], [-0.94, 0.205], [-0.89, 0.255], [-0.82, 0.298], [-0.74, 0.33], [-0.64, 0.35], [-0.54, 0.356],
        [-0.46, 0.354], [-0.40, 0.348], [-0.33, 0.334], [-0.26, 0.31], [-0.19, 0.272], [-0.13, 0.226], [-0.085, 0.176], [-0.05, 0.13], [-0.022, 0.086], [-0.006, 0.052], [0.0, 0.03]],
      zf: [[-1.0, -0.06], [-0.97, 0.10], [-0.92, 0.19], [-0.85, 0.262], [-0.76, 0.314], [-0.66, 0.343], [-0.6, 0.352], [-0.54, 0.349], [-0.47, 0.334],
        [-0.42, 0.338], [-0.34, 0.346], [-0.27, 0.35], [-0.22, 0.343], [-0.17, 0.33], [-0.13, 0.326], [-0.09, 0.322], [-0.06, 0.312], [-0.035, 0.319], [-0.012, 0.303], [0.0, 0.272]],
      zs: [[-1.0, -0.06], [-0.6, -0.03], [-0.36, -0.02], [-0.28, 0.0], [-0.20, 0.05], [-0.13, 0.11], [-0.07, 0.17], [-0.03, 0.22], [0.0, 0.25]],
      zb: [[-1.0, -0.06], [-0.97, -0.21], [-0.92, -0.31], [-0.84, -0.40], [-0.72, -0.455], [-0.58, -0.47], [-0.45, -0.45], [-0.36, -0.40], [-0.29, -0.32],
        [-0.25, -0.12], [-0.2, -0.07], [-0.16, -0.03], [-0.11, 0.06], [-0.07, 0.13], [-0.035, 0.19], [0.0, 0.24]],
      nose: [[-0.47, 0.0], [-0.42, 0.007], [-0.36, 0.02], [-0.31, 0.036], [-0.28, 0.049], [-0.264, 0.056], [-0.25, 0.05], [-0.238, 0.033], [-0.228, 0.014], [-0.218, 0.0]],
      noseY: -0.258, mouthY: -0.118, mouthW: 0.09, lipU: 0.02, lipL: 0.016,
      eyeY: -0.43, eyeX: 0.152, eyeW: 0.158, eyeH: 0.66, browY: -0.575, earY: [-0.47, -0.30],
      neckR: 0.094, pivot: [0, -0.12, -0.08], kind: 'f', cheek: 0.036,
    },
    boy: {
      w: [[-1.0, 0.0], [-0.985, 0.105], [-0.95, 0.198], [-0.90, 0.258], [-0.83, 0.306], [-0.74, 0.340], [-0.64, 0.356], [-0.54, 0.361],
        [-0.46, 0.358], [-0.40, 0.352], [-0.33, 0.341], [-0.26, 0.321], [-0.21, 0.3], [-0.16, 0.268], [-0.11, 0.222], [-0.065, 0.168], [-0.03, 0.112], [-0.01, 0.072], [0.0, 0.046]],
      zf: [[-1.0, -0.06], [-0.97, 0.10], [-0.92, 0.19], [-0.85, 0.262], [-0.76, 0.318], [-0.66, 0.350], [-0.59, 0.366], [-0.53, 0.356], [-0.47, 0.338],
        [-0.42, 0.342], [-0.34, 0.352], [-0.27, 0.356], [-0.22, 0.348], [-0.17, 0.336], [-0.13, 0.332], [-0.09, 0.327], [-0.06, 0.318], [-0.035, 0.326], [-0.012, 0.31], [0.0, 0.28]],
      zs: [[-1.0, -0.06], [-0.6, -0.03], [-0.36, -0.02], [-0.28, -0.01], [-0.20, 0.03], [-0.13, 0.09], [-0.07, 0.16], [-0.03, 0.21], [0.0, 0.25]],
      zb: [[-1.0, -0.06], [-0.97, -0.22], [-0.92, -0.335], [-0.84, -0.435], [-0.72, -0.495], [-0.58, -0.51], [-0.45, -0.49], [-0.36, -0.43], [-0.29, -0.34],
        [-0.25, -0.13], [-0.2, -0.08], [-0.16, -0.035], [-0.11, 0.05], [-0.07, 0.125], [-0.035, 0.19], [0.0, 0.245]],
      nose: [[-0.48, 0.0], [-0.43, 0.009], [-0.37, 0.025], [-0.32, 0.045], [-0.285, 0.062], [-0.267, 0.07], [-0.252, 0.062], [-0.24, 0.04], [-0.229, 0.016], [-0.22, 0.0]],
      noseY: -0.262, mouthY: -0.125, mouthW: 0.084, lipU: 0.006, lipL: 0.004,
      eyeY: -0.44, eyeX: 0.152, eyeW: 0.162, eyeH: 0.52, browY: -0.555, earY: [-0.48, -0.30],
      neckR: 0.13, pivot: [0, -0.12, -0.08], kind: 'm', cheek: 0.026,
    },
  };
  // the aunt: a narrower, slightly longer mature face derived from 先輩
  MODEL_DEF.aunt = Object.assign({}, MODEL_DEF.senpai, {
    w: [[-1.0, 0.0], [-0.985, 0.10], [-0.95, 0.19], [-0.90, 0.25], [-0.83, 0.296], [-0.74, 0.328], [-0.64, 0.343], [-0.54, 0.347],
      [-0.46, 0.344], [-0.40, 0.336], [-0.33, 0.320], [-0.26, 0.294], [-0.19, 0.254], [-0.13, 0.206], [-0.08, 0.154], [-0.045, 0.108], [-0.018, 0.066], [0.0, 0.032]],
    eyeY: -0.445, eyeX: 0.146, eyeW: 0.150, eyeH: 0.56, browY: -0.575, mouthW: 0.084, neckR: 0.104, mouthY: -0.122, cheek: 0.03,
  });

  const SOCKET = 0.03;
  function buildModel(name) {
    const d = MODEL_DEF[name];
    const M = Object.assign({}, d, { name, w: curve(d.w), zf: curve(d.zf), zs: curve(d.zs), zb: curve(d.zb, true), nose: curve(d.nose) });
    // front surface (no bumps) and with bumps
    M.zFront0 = (x, y) => {
      const w = M.w(y), zs = M.zs(y), zf = M.zf(y); if (w < 1e-4) return zf;
      const ax = min(1, abs(x) / w), n = 2.0 + 0.6 * sstep(-0.62, -0.42, y) - 0.4 * sstep(-0.2, -0.02, y);
      return zs + (zf - zs) * pow(max(0, 1 - pow(ax, n)), 1 / n);
    };
    M.zFront = (x, y) => {
      let z = M.zFront0(x, y);
      const nb = M.nose(y); if (nb > 0) { const s = 0.015 + 0.024 * sstep(-0.42, -0.24, y); z += nb * Math.exp(-(x / s) * (x / s)); }
      const lx = Math.exp(-(x / 0.05) * (x / 0.05));
      z += lx * (M.lipU * bell(y, M.mouthY - 0.017, 0.016) + M.lipL * bell(y, M.mouthY + 0.019, 0.015) - 0.006 * bell(y, M.mouthY, 0.006));
      const ax = abs(x);
      z -= SOCKET * bell(ax, M.eyeX, 0.075) * bell(y, M.eyeY, 0.07);
      // cheekbone / cheek fullness on the side-front: invisible in front and profile, it is what makes the far cheek
      // contour pass outside the far eye in 3/4 (anime convention)
      z += (M.cheek || 0.012) * bell(ax, 0.278, 0.072) * bell(y, -0.30, 0.085);
      return z;
    };
    M.zBack = (x, y) => {
      const w = M.w(y), zs = M.zs(y), zb = M.zb(y); if (w < 1e-4) return zb;
      const ax = min(1, abs(x) / w);
      return zs - (zs - zb) * pow(max(0, 1 - pow(ax, 2.2)), 1 / 2.2);
    };
    // horizontal slices of the volume (head frame points) for the silhouette
    const Ys = []; for (let y = -1; y < -0.9; y += 0.0125) Ys.push(y); for (let y = -0.9; y < -0.5; y += 0.025) Ys.push(y); for (let y = -0.5; y <= 0.0001; y += 0.0125) Ys.push(Math.min(0, y));
    M.slices = Ys.map(y => {
      const w = Math.max(1e-4, M.w(y)), pts = [];
      const NF = 49, NB = 21;
      for (let i = 0; i < NF; i++) { const s = -1 + 2 * i / (NF - 1); const x = w * Math.sign(s) * pow(abs(s), 1.55); pts.push(x, y, M.zFront(x, y), 1); }
      for (let i = 1; i < NB - 1; i++) { const s = -1 + 2 * i / (NB - 1); const x = w * Math.sign(s) * pow(abs(s), 0.8); pts.push(x, y, M.zBack(x, y), 0); }
      return { y, pts };
    });
    // surface point with a normal-ish outward offset (shell for hair). theta in degrees: 0 front, +90 viewer-right side, 180 back
    M.shell = (thDeg, y, off = 0) => {
      const th = thDeg * D2R, ct = cos(th);
      let x, z;
      if (ct >= 0 || y <= -0.29) { const w = M.w(y); x = w * sin(th); z = ct >= 0 ? M.zFront0(x, y) : M.zBack(x, y); }
      else { // nape: the skull base blends into the back of the neck (the head volume itself ends at the jaw there)
        const k = clamp((y + 0.29) / 0.14), w0 = M.w(-0.29), rN = M.neckR * 1.3;
        const xs = w0 * sin(th), zsk = M.zBack(xs, -0.29);
        x = lerp(xs, rN * sin(th), k); z = lerp(zsk, M.pivot[2] + rN * ct, k);
      }
      const c = [0, -0.5, -0.07]; let n = [x - c[0], (y - c[1]) * 0.9, z - c[2]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
      return [x + n[0] * off, y + n[1] * off, z + n[2] * off];
    };
    // point on the face surface (x, y) lifted by off along z
    M.surf = (x, y, off = 0) => [x, y, M.zFront(x, y) + off];
    M.surfN = (x, y) => { // outward normal of the front surface
      const e = 0.004; const dzx = (M.zFront(x + e, y) - M.zFront(x - e, y)) / (2 * e), dzy = (M.zFront(x, y + e) - M.zFront(x, y - e)) / (2 * e);
      const l = Math.hypot(dzx, dzy, 1); return [-dzx / l, -dzy / l, 1 / l];
    };
    return M;
  }
  const MODELS = {};
  const model = (who) => MODELS[who] || (MODELS[who] = buildModel(MODEL_DEF[who] ? who : 'senpai'));

  /* ================================================================== view transform */
  // ang: rotation about the vertical axis (0 faces the viewer, +PI/2 profile facing screen-right, PI = back view)
  function makeView(o, M) {
    const yaw = clamp(o.yaw || 0, -1, 1);
    let ang = yaw * HP;
    if (o.back) ang = (yaw >= 0 ? 1 : -1) * (PI - abs(yaw) * HP);
    const pitch = clamp(o.pitch || 0, -0.6, 0.6), roll = o.roll || 0;
    return { ang, ca: cos(ang), sa: sin(ang), cp: cos(pitch), sp: sin(pitch), cr: cos(roll), sr: sin(roll), roll, pitch, yaw,
      s: o.size || 200, ox: o.x || 0, oy: o.y || 0, pv: M.pivot, facing: cos(ang) };
  }
  // head frame -> view (H units, origin at the neck point; X right, Y down, Z toward viewer), before roll & scale
  function rot(V, p) {
    const x = p[0] - V.pv[0], y = p[1] - V.pv[1], z = p[2] - V.pv[2];
    const y1 = y * V.cp - z * V.sp, z1 = y * V.sp + z * V.cp;
    return [x * V.ca + z1 * V.sa, y1, -x * V.sa + z1 * V.ca];
  }
  function rotN(V, n) {
    const y1 = n[1] * V.cp - n[2] * V.sp, z1 = n[1] * V.sp + n[2] * V.cp;
    return [n[0] * V.ca + z1 * V.sa, y1, -n[0] * V.sa + z1 * V.ca];
  }
  // view -> screen; hang (0..1) removes that share of the roll (hanging hair keeps falling straight down)
  function scr(V, q, hang = 0) {
    const X = q[0] * V.s, Y = q[1] * V.s;
    let c = V.cr, s = V.sr;
    if (hang) { const r = V.roll * (1 - hang); c = cos(r); s = sin(r); }
    return [V.ox + X * c - Y * s, V.oy + X * s + Y * c];
  }
  const proj = (V, p, hang = 0) => scr(V, rot(V, p), hang);
  // screen direction of a head-frame vector (length = foreshortened length in px per H)
  function projVec(V, v) { const r = rotN(V, v); return [(r[0] * V.cr - r[1] * V.sr) * V.s, (r[0] * V.sr + r[1] * V.cr) * V.s, r[2]]; }

  /* ================================================================== silhouette of the head volume */
  function silhouette(V, M) {
    const pv = V.pv, R = [], Lf = [];
    for (const sl of M.slices) {
      const p = sl.pts; let iMax = 0, vMax = -1e9, iMin = 0, vMin = 1e9;
      for (let i = 0; i < p.length; i += 4) {
        const y = p[i + 1] - pv[1], z = p[i + 2] - pv[2];
        const X = (p[i] - pv[0]) * V.ca + (y * V.sp + z * V.cp) * V.sa;
        if (X > vMax + 1e-9 || (abs(X - vMax) < 1e-9 && p[i + 3])) { vMax = X; iMax = i; }
        if (X < vMin - 1e-9 || (abs(X - vMin) < 1e-9 && p[i + 3])) { vMin = X; iMin = i; }
      }
      const mk = (i) => { const q = [p[i], p[i + 1], p[i + 2]]; const s = scr(V, rot(V, q)); s.f = q; s.front = p[i + 3]; return s; };
      R.push(mk(iMax)); Lf.push(mk(iMin));
    }
    const poly = R.concat(Lf.slice().reverse());
    // edge runs where a contour line belongs: the face side of the volume (front half) and the jaw underside
    const lineOK = (s) => s.front || s.f[1] > -0.24;
    return { R, L: Lf, poly, lineOK };
  }

  /* ================================================================== materials for a call */
  const HAIRMAT = { senpai: 'hair_senpai', boy: 'hair_boy', aunt: 'hair_aunt' };
  const IRISMAT = { senpai: 'iris_senpai', boy: 'iris_boy', aunt: 'iris_boy' };
  // amb used for faces: dark lights are lifted a little so faces stay readable (anime "face light"); o.faceLift 0..1
  A.faceAmb = function (light, lift) {
    const Lt = typeof light === 'string' ? (A.LIGHT[light] || A.LIGHT.day) : (light || A.LIGHT.day);
    const k = lift ?? (Lt.dark < 0.6 ? 0.78 : Lt.dark < 0.7 ? 0.62 : Lt.dark < 0.9 ? 0.3 : 0.12);
    return Lt.amb * (1 - clamp(k));
  };
  /** The light object used for faces / skin of the heads (dark scenes are lifted so faces stay readable).
   *  Bodies can use PV.anime.mat('skin', PV.anime.faceLight(light)) to match the neck and face. */
  A.faceLight = function (light, lift) {
    const Lt = typeof light === 'string' ? (A.LIGHT[light] || A.LIGHT.day) : (light || A.LIGHT.day);
    const k = clamp(lift ?? (Lt.dark < 0.6 ? 0.78 : Lt.dark < 0.7 ? 0.62 : Lt.dark < 0.9 ? 0.3 : 0.12));
    return Object.assign({}, Lt, { amb: Lt.amb * (1 - k), dark: Lt.dark + Math.max(0, 1 - Lt.dark) * 0.6 * k, sat: lerp(Lt.sat, 1, 0.45 * k) });
  };
  function mats(o, who) {
    const L = o.light || 'day'; const wet = (o.hair && o.hair.style === 'wet') ? 1 : 0;
    const Lt = typeof L === 'string' ? (A.LIGHT[L] || A.LIGHT.day) : L;
    const FL = A.faceLight(L, o.faceLift), ea = FL.amb * 0.5;
    return {
      skin: A.mat('skin', FL), blush: A.mat('blush', FL), lips: A.mat('lips', FL), sclera: A.mat('sclera', FL, { amb: ea }),
      under: A.mat(A.COLORS.undereye ? 'undereye' : 'blush', FL),
      iris: A.mat(IRISMAT[who] || 'iris_senpai', FL, { amb: ea }), hair: A.mat(HAIRMAT[who] || 'hair_senpai', L, wet ? { wet: 1 } : {}), FL,
      L: Lt, lightName: L,
    };
  }

  /* ================================================================== eyes */
  // Local eye frame: x from -0.5 (inner corner) to +0.5 (outer corner), y down, unit = eye width W.
  // Design sheet (character_design_from_text.md 2-3 / 3-3 / 4-3):
  //  先輩: large almond, h/w ~0.75 with the lid line, outer corner up ~6 deg, crease centre->outer corner, 2-3 lash flicks,
  //        1-2 short lower lashes on the outer third, plum-brown iris, 2 highlights; neutral lid just touches the iris.
  //  彼:   narrow long half-lidded eye, h/w ~0.5, outer corner ~3 deg down, crease on the outer third only, no lashes
  //        (thicker outer end), top third of the iris under the lid, 1 small highlight + a thin reflected light under the iris.
  //  叔母: his eye shape made feminine, h/w ~0.56, outer corner ~4 deg up, heavy lid over the top quarter of the iris,
  //        a fine eyeliner flick, no lower lashes, 1 small highlight.
  const EYE_DEF = {
    senpai: {
      U: [[-0.50, 0.075], [-0.44, -0.06], [-0.34, -0.195], [-0.18, -0.295], [0.0, -0.34], [0.18, -0.342], [0.34, -0.30], [0.47, -0.205], [0.56, -0.035]],
      Lo: [[-0.50, 0.075], [-0.40, 0.205], [-0.22, 0.315], [0.0, 0.36], [0.22, 0.33], [0.40, 0.225], [0.50, 0.09], [0.56, -0.035]],
      C: [[-0.50, 0.10], [-0.30, 0.19], [-0.05, 0.235], [0.20, 0.22], [0.42, 0.14], [0.56, 0.02]],
      iris: [0.30, 0.37, 0.035], pupil: [0.105, 0.15], lid: 0.115, lashes: 3, crease: 'full', lower: 0.024, lowerLash: 2, hl: 2,
    },
    boy: {
      U: [[-0.50, 0.045], [-0.43, -0.075], [-0.30, -0.165], [-0.10, -0.212], [0.12, -0.222], [0.32, -0.205], [0.46, -0.125], [0.56, 0.085]],
      Lo: [[-0.50, 0.045], [-0.36, 0.15], [-0.14, 0.215], [0.10, 0.235], [0.32, 0.22], [0.48, 0.165], [0.56, 0.085]],
      C: [[-0.50, 0.08], [-0.30, 0.13], [-0.05, 0.16], [0.20, 0.16], [0.42, 0.13], [0.56, 0.1]],
      iris: [0.265, 0.335, -0.10], pupil: [0.095, 0.13], lid: 0.125, lashes: 0, dark: 0.55, crease: 'outer', lower: 0.02, lowerLash: 0, hl: 1, reflect: true,
    },
    aunt: {
      U: [[-0.50, 0.05], [-0.43, -0.08], [-0.30, -0.19], [-0.10, -0.245], [0.12, -0.255], [0.32, -0.232], [0.46, -0.16], [0.56, -0.025]],
      Lo: [[-0.50, 0.05], [-0.36, 0.17], [-0.14, 0.25], [0.10, 0.27], [0.32, 0.24], [0.48, 0.13], [0.56, -0.025]],
      C: [[-0.50, 0.08], [-0.30, 0.15], [-0.05, 0.18], [0.20, 0.17], [0.42, 0.12], [0.56, 0.04]],
      iris: [0.265, 0.335, -0.075], pupil: [0.09, 0.125], lid: 0.105, lashes: 0, dark: 0.45, liner: true, crease: 'full', lower: 0.018, lowerLash: 0, hl: 'small',
    },
  };
  const EYES = {};
  function eyeDef(who) {
    if (EYES[who]) return EYES[who];
    const d = EYE_DEF[who] || EYE_DEF.senpai;
    return (EYES[who] = Object.assign({}, d, { Uf: curve(d.U), Lf: curve(d.Lo), Cf: curve(d.C) }));
  }
  const XS = []; for (let i = 0; i <= 16; i++) XS.push(-0.5 + 1.06 * i / 16);

  // Anime 3/4 convention: features on the FAR half of the face are drawn closer to the nose line than a real
  // projection puts them (the far eye stays inside the face, the far cheek contour passes outside it).
  // Returns the head-frame x to use for a feature at x (only far-side x are pulled in).
  function farX(V, x) {
    const sa = sin(V.ang), far = x * sa > 0 && V.facing > 0;
    return far ? x * (1 - 0.2 * abs(sa) * clamp(V.facing * 1.6)) : x;
  }
  // silhouette x (view space, H units, before roll) on one side at view height yv
  function silXAt(C, sideList, yv) {
    const V = C.V; let best = null, bd = 1e9;
    for (const p of sideList) { const r = rot(V, p.f); const d = abs(r[1] - yv); if (d < bd) { bd = d; best = r[0]; } }
    return best;
  }
  const toView = (V, p) => { const dx = (p[0] - V.ox) / V.s, dy = (p[1] - V.oy) / V.s; return [dx * V.cr + dy * V.sr, -dx * V.sr + dy * V.cr]; };

  // Eye placement in screen space: centre, local axes (px per W), visibility, foreshortening, profile-ness.
  function eyeFrame(C, side) {
    const { M, V } = C; const x = farX(V, side * M.eyeX), y = M.eyeY;
    const c3 = M.surf(x, y, 0.004), n = M.surfN(x, y);
    const nv = rotN(V, n);
    const tx = projVec(V, [1, 0, (M.zFront(x + 0.01, y) - M.zFront(x - 0.01, y)) / 0.02]);
    const ty = projVec(V, [0, 1, (M.zFront(x, y + 0.01) - M.zFront(x, y - 0.01)) / 0.02]);
    const lx = Math.hypot(tx[0], tx[1]) / V.s, ly = Math.hypot(ty[0], ty[1]) / V.s;
    const fRaw = clamp(lx);
    const fs = 0.2 + 0.8 * pow(fRaw, 0.85);                   // anime: the far eye squeezes a little less than real
    const fv = 0.74 + 0.26 * clamp(ly);
    const W = M.eyeW * V.s;
    const ex = nrm([tx[0], tx[1]]), ey = nrm([ty[0], ty[1]]);
    const q = sstep(0.62, 0.3, fRaw) * (nv[2] > 0 ? 1 : 0);  // profile-ness of this eye
    const F = { side, c: proj(V, c3), ax: [ex[0] * W * fs * side, ex[1] * W * fs * side], ay: [ey[0] * W * fv, ey[1] * W * fv],
      vis: nv[2] > -0.05 ? clamp((nv[2] + 0.05) / 0.2) : 0, nz: nv[2], fRaw, fs, q, W };
    if (q > 0.01) { const d = -Math.sign(sin(V.ang)) * 0.038 * q * V.s; F.c = [F.c[0] + d * V.cr, F.c[1] + d * V.sr]; }
    // keep the far eye inside the far cheek contour (fades out toward profile, where the anime far eye peeks past the bridge)
    const sa = sin(V.ang), farEye = side * sa > 0;
    if (farEye && V.facing > 0.2 && C.sil) {
      const fdir = sa > 0 ? 1 : -1, list = fdir > 0 ? C.sil.R : C.sil.L;
      const oc = EP(F, 0.6, -0.02), ocv = toView(V, oc), cv = toView(V, F.c);
      const xs = silXAt(C, list, ocv[1]), xs2 = silXAt(C, list, cv[1] + 0.03);
      const lim = Math.min(xs * fdir, xs2 * fdir) - (0.034 + 0.01 * abs(sa));          // margin for the contour ink + cheek
      const over = ocv[0] * fdir - lim;
      const k = sstep(0.12, 0.3, V.facing);                                            // relax near profile
      if (over > 0) { const d = -over * fdir * k * V.s; F.c = [F.c[0] + d * V.cr, F.c[1] + d * V.sr]; }
    }
    return F;
  }
  const EP = (F, u, v) => [F.c[0] + F.ax[0] * u + F.ay[0] * v, F.c[1] + F.ax[1] * u + F.ay[1] * v];

  // lid curves for an expression: returns {U:[[u,v]..], L:[[u,v]..], open, closedShape}
  function eyeCurves(C, F) {
    const E = C.eyeE, D = C.eyeD; const q = F.q;
    const cut = 0.26 * q;                                     // profile: the inner corner disappears into the front edge
    const open = clamp(E.open, 0, 1.25), sm = E.smile || 0, fo = E.focus || 0, sad = E.sad || 0, sq = E.squeeze || 0;
    const tiny = C.who !== 'senpai' ? clamp((110 - C.V.s) / 70) * 0.7 : 0;      // small heads: the narrow eyes open a little
    const wide = (E.wide || 0) + tiny;
    const xs = XS.filter(x => x >= -0.5 + cut - 1e-6); if (xs[0] > -0.5 + cut + 1e-6) xs.unshift(-0.5 + cut);
    const U = [], Lw = [];
    for (const x of xs) {
      const b = 1 - Math.min(1, (2 * x) * (2 * x));
      let u = D.Uf(x), l = D.Lf(x), cl = D.Cf(x);
      u += fo * (0.085 + 0.12 * (0.5 - x)) * (0.45 + 0.55 * b) + sad * 0.13 * pow(clamp(x + 0.5), 1.6) - wide * 0.075 * b + sq * 0.22 * b;
      l += -sm * 0.30 * pow(b, 0.8) - fo * 0.08 * b + wide * 0.03 * b - sq * 0.14 * b;
      if (E.closed === 'up') cl = D.Cf(x) - 0.20 * b - 0.04;          // happy ^ ^
      const op = open > 1 ? 1 : open;
      const uu = open > 1 ? u - (open - 1) * 0.3 * b : lerp(cl, u, op);
      const ll = lerp(cl, l, sstep(0, 0.55, op));
      U.push([x, uu]); Lw.push([x, Math.max(uu, ll)]);
    }
    const shut = open < 0.13 || U.every((p, i) => Lw[i][1] - p[1] < 0.02);
    return { U, L: Lw, shut, cut, xs };
  }

  function drawEye(ctx, C, F, onlyLines) {
    if (F.vis <= 0.01) return;
    const { m } = C; const E = C.eyeE, D = C.eyeD; const lod = C.lod;
    const K = eyeCurves(C, F); const W = F.W;
    const lash = C.lashCol, lashA = F.vis;
    const P = (u, v) => EP(F, u, v);
    const tw = clamp((E.tears || 0) / 0.5), dull = E.dull || 0, shine = E.shine ?? 1;
    ctx.save(); ctx.globalAlpha *= lashA;
    // dark circles under the eyes (silent days): a soft tinted crescent + one fine line
    if (!onlyLines && (E.undereye || 0) > 0.02 && lod > 0) {
      const ue = E.undereye, um = C.m.under;
      const lo = K.L.filter(p => p[0] > -0.42 && p[0] < 0.5);
      const cres = lo.map(p => P(p[0], p[1] + 0.07)).concat(lo.slice().reverse().map(p => P(p[0] * 0.92 + 0.02, p[1] + 0.2 + 0.07 * (1 - 4 * p[0] * p[0]))));
      fillPoly(ctx, cres, rgba(um.base, 0.38 * ue));
      ink(ctx, lo.filter(p => p[0] > -0.3 && p[0] < 0.35).map(p => P(p[0] * 0.95, p[1] + 0.17 + 0.05 * (1 - 4 * p[0] * p[0]))), (u) => 0.02 * W * sin(PI * u), rgba(um.line, 0.45 * ue));
    }
    if (!K.shut && !onlyLines) {
      // opening
      const open = K.U.map(p => P(p[0], p[1])).concat(K.L.slice().reverse().map(p => P(p[0], p[1])));
      ctx.beginPath(); poly(ctx, open); ctx.fillStyle = m.sclera.base; ctx.fill();
      ctx.save(); ctx.clip();
      // shadow of the upper lid on the white
      const band = K.U.map(p => P(p[0], p[1] - 0.05)).concat(K.U.slice().reverse().map(p => P(p[0], p[1] + 0.17)));
      fillPoly(ctx, band, m.sclera.shade);
      // iris
      const ir = D.iris; const look = E.look || [0, 0];
      const wideK = 1 - 0.14 * (E.wide || 0);
      let ix = F.side * look[0] * 0.13, iy = ir[2] + look[1] * 0.08;
      ix = lerp(ix, -0.5 + K.cut + ir[0] * 0.75, F.q * 0.85);
      const rx = ir[0] * wideK, ry = ir[1] * wideK;
      const ic = P(ix, iy);
      const axL = Math.hypot(F.ax[0], F.ax[1]), ayL = Math.hypot(F.ay[0], F.ay[1]), ang = Math.atan2(F.ax[1] * F.side, F.ax[0] * F.side);
      const top = P(ix, iy - ry), bot = P(ix, iy + ry);
      const dk = D.dark || 0;
      let irisFill;
      if (lod && W > 13) {
        const g = ctx.createLinearGradient(top[0], top[1], bot[0], bot[1]);
        if (dull > 0.5) { // empty eyes: a flat dark disc, no glow ("holes in the face")
          const flat = mixH(m.iris.base, m.iris.shade, 0.55 + dk * 0.2);
          g.addColorStop(0, mixH(m.iris.shade, m.iris.deep, 0.3)); g.addColorStop(0.5, flat); g.addColorStop(1, mixH(flat, m.iris.base, 0.35));
        } else {
          g.addColorStop(0, m.iris.shade); g.addColorStop(0.42, mixH(m.iris.base, m.iris.shade, 0.18 + dull * 0.4 + dk * 0.45));
          g.addColorStop(0.78, mixH(m.iris.base, m.iris.hi, Math.max(0, 0.32 - dull * 0.3 - dk * 0.3 + tw * 0.15)));
          g.addColorStop(1, mixH(m.iris.hi, m.iris.base, Math.max(0, 0.2 + dull * 0.5 + dk * 0.45 - tw * 0.15)));
        }
        irisFill = g;
      } else irisFill = mixH(m.iris.shade, m.iris.deep, 0.35);
      ctx.beginPath(); ctx.ellipse(ic[0], ic[1], rx * axL, ry * ayL, ang, 0, TAU); ctx.fillStyle = irisFill; ctx.fill();
      if (lod > 0) {
        // limbal ring + a light ring around the pupil + a bright arc in the lower iris
        ctx.lineWidth = Math.max(0.6, 0.05 * W); ctx.strokeStyle = mixH(m.iris.line, m.iris.shade, 0.25); ctx.stroke();
        if (lod > 1 && dull < 0.5) {
          ctx.beginPath(); ctx.ellipse(ic[0], ic[1] + 0.02 * ayL, rx * axL * 0.62, ry * ayL * 0.62, ang, 0, TAU);
          ctx.lineWidth = Math.max(0.5, 0.032 * W); ctx.strokeStyle = rgba(m.iris.hi, 0.26); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(ic[0], ic[1], rx * axL * 0.8, ry * ayL * 0.8, ang, 0.2 * PI, 0.8 * PI);
          ctx.lineWidth = Math.max(0.5, 0.03 * W); ctx.strokeStyle = rgba(mixH(m.iris.hi, '#ffffff', 0.3), 0.55 * (1 - dk * 0.6)); ctx.stroke();
        }
      }
      // pupil (soft-edged when empty)
      const ps = (E.pupil ?? 1) * wideK;
      const pc = P(ix, iy - 0.02);
      ctx.beginPath(); ctx.ellipse(pc[0], pc[1], D.pupil[0] * axL * ps, D.pupil[1] * ayL * ps, ang, 0, TAU);
      ctx.fillStyle = dull > 0.5 ? rgba(m.iris.deep, 0.55) : mixH(m.iris.deep, m.iris.shade, dull * 0.5); ctx.fill();
      // shadow of the upper lid across the iris
      const band2 = K.U.map(p => P(p[0], p[1] - 0.05)).concat(K.U.slice().reverse().map(p => P(p[0], p[1] + 0.24)));
      ctx.globalAlpha *= 0.55; fillPoly(ctx, band2, m.iris.shade); ctx.globalAlpha /= 0.55;
      // welling tears: a water layer along the lower lid with a bright wavy surface line
      if (tw > 0.01) drawTearWell(ctx, C, F, K, tw);
      // highlights: 先輩 two (big oval on the light side + small dot), 彼 one small + a thin reflected light under the iris,
      // 叔母 one small. Same screen side in both eyes. Wet eyes: highlights tremble and multiply.
      if (shine > 0.02 && dull < 0.98) {
        const hs = C.hlSide * F.side;
        const wob = tw > 0 ? [PV.noise2(C.Tq * 3.1, F.side * 7) * 0.025 * tw, PV.noise2(C.Tq * 2.7, F.side * 3 + 1) * 0.02 * tw] : [0, 0];
        const hl = D.hl || 2, big = W > 16 ? 1 : 1.35, sh = shine * (1 - dull);
        ctx.fillStyle = rgba('#ffffff', 0.95 * sh);
        if (hl === 2) {
          const h1 = P(ix + hs * 0.115 + wob[0], iy - 0.14 + wob[1]);
          ctx.beginPath(); ctx.ellipse(h1[0], h1[1], 0.125 * axL * big * (E.hlK || 1), 0.1 * ayL * big * (E.hlK || 1), ang - 0.4 * hs, 0, TAU); ctx.fill();
          if (lod > 0) { const h2 = P(ix - hs * 0.11 + wob[0] * 0.5, iy + 0.18); ctx.beginPath(); ctx.ellipse(h2[0], h2[1], 0.05 * axL, 0.044 * ayL, 0, 0, TAU); ctx.fill(); }
        } else {
          const small = hl === 'small' ? 0.75 : 1;
          const h1 = P(ix + hs * 0.1 + wob[0], iy + (hl === 'small' ? -0.02 : 0.0) + wob[1]);
          ctx.beginPath(); ctx.ellipse(h1[0], h1[1], 0.085 * axL * big * small, 0.075 * ayL * big * small, ang - 0.3 * hs, 0, TAU); ctx.fill();
        }
        if (D.reflect && lod > 0) { // thin reflected light under the iris (stays even in shade)
          ctx.beginPath(); ctx.ellipse(ic[0], ic[1], rx * axL * 0.78, ry * ayL * 0.82, ang, 0.28 * PI, 0.72 * PI);
          ctx.lineWidth = Math.max(0.6, 0.038 * W); ctx.strokeStyle = rgba(mixH(m.iris.hi, '#ffffff', 0.45), 0.7 * sh); ctx.stroke();
        }
        if (tw > 0.2 && lod > 0) { // extra sparkles on wet eyes
          ctx.fillStyle = rgba('#ffffff', 0.9 * tw * sh);
          for (let k = 0; k < 3; k++) { const s2 = P(ix + (k - 1) * 0.13 + wob[0], iy + 0.25 - abs(k - 1) * 0.05 + wob[1] * 0.5); ctx.beginPath(); ctx.arc(s2[0], s2[1], (0.02 + 0.012 * (k === 1)) * W, 0, TAU); ctx.fill(); }
        }
      } else if (shine > 0.02 && E.dimShine) { // the dependent phase: one small dull grey glint
        const hs = C.hlSide * F.side, h1 = P(ix + hs * 0.1, iy - 0.06);
        ctx.fillStyle = rgba('#c9c6cf', 0.75 * shine); ctx.beginPath(); ctx.ellipse(h1[0], h1[1], 0.05 * axL, 0.045 * ayL, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // lower lid line (short, thin, outer part) + short lower lashes on the outer third (先輩)
      const lw0 = D.lower * W * (1 + (E.smile || 0) * 0.6 + (E.squeeze || 0) * 0.6);
      const lowPts = K.L.filter(p => p[0] > -0.12 + (E.smile || 0) * -0.25 + (E.squeeze || 0) * -0.2).map(p => P(p[0], p[1] + 0.012));
      ink(ctx, lowPts, (u) => lw0 * Math.min(1, 2.2 * u) * (0.55 + 0.6 * u) * (u > 0.95 ? (1 - u) * 20 : 1), C.lowCol);
      if (D.lowerLash && lod > 1) {
        for (let k = 0; k < D.lowerLash; k++) {
          const x0 = 0.3 + k * 0.1, y0 = D.Lf(x0) + (E.smile || 0) * -0.3 * 0.8 + 0.02;
          ink(ctx, [P(x0, y0), P(x0 + 0.05, y0 + 0.07 + 0.015 * k)], (u) => lw0 * 0.8 * (1 - u), C.lowCol, false);
        }
      }
      if (tw > 0.05) ink(ctx, K.L.filter(p => p[0] > -0.38 && p[0] < 0.48).map(p => P(p[0], p[1] - 0.012)), (u) => 0.026 * W * sin(PI * u) * (0.6 + 0.4 * tw), rgba('#ffffff', 0.9 * tw));
    }
    // upper lid line (thick toward the outer corner) + lashes
    const lidW = Math.max(lod === 0 ? 1.45 : W < 16 ? 1.15 : 0.9, D.lid * W * (1 + 0.25 * (E.squeeze || 0)) * (K.shut ? 0.85 : 1));
    const lidPts = (K.shut ? K.U.map((p, i) => [p[0], (p[1] + K.L[i][1]) / 2]) : K.U).map(p => P(p[0], p[1]));
    const f = (u) => lidW * (0.32 + 0.68 * sstep(0.0, 0.62, u)) * (u > 0.93 ? lerp(1, 0.62, (u - 0.93) / 0.07) : 1);
    if (F.q < 0.98) ink(ctx, lidPts, f, lash);
    else ink(ctx, lidPts, (u) => f(u) * sstep(0, 0.15, u), lash);
    // lash flicks at the outer corner (先輩 2-3 clumps out-up) / eyeliner flick (叔母)
    if ((D.lashes || D.liner) && lod > 0) {
      const o = K.U[K.U.length - 1], o2 = K.U[K.U.length - 3];
      const flicks = D.liner ? [[0.0, -0.01, 0.13, -0.05]] : [[0.0, -0.015, 0.19, -0.11], [-0.06, -0.10, 0.15, -0.19], [-0.13, -0.17, 0.09, -0.22]].slice(0, D.lashes);
      for (const fl of flicks) {
        const b0 = [o[0] + fl[0], (K.shut ? (o[1] + K.L[K.L.length - 1][1]) / 2 : lerp(o[1], o2[1], -fl[0] * 4)) + fl[1] * 0.4];
        const tip = K.shut && E.closed !== 'up' ? [b0[0] + fl[2], b0[1] + 0.07 + fl[3] * -0.2] : [b0[0] + fl[2], b0[1] + fl[3]];
        const mid = [lerp(b0[0], tip[0], 0.5), lerp(b0[1], tip[1], 0.5) + 0.02];
        ink(ctx, [P(b0[0], b0[1]), P(mid[0], mid[1]), P(tip[0], tip[1])], (u) => lidW * (D.liner ? 0.7 : 0.95) * pow(1 - u, 0.8), lash);
      }
    }
    // double-eyelid crease: 先輩/叔母 from the centre to the outer corner, 彼 on the outer third only
    if (D.crease && lod > 1 && !K.shut && F.q < 0.7 && !onlyLines) {
      const x0 = D.crease === 'outer' ? 0.18 : -0.2;
      const cr = K.U.filter(p => p[0] > x0 && p[0] < 0.46).map(p => P(p[0] + 0.02, p[1] - 0.12 - 0.03 * (E.wide || 0) + 0.04 * (E.squeeze || 0)));
      ink(ctx, cr, (u) => 0.022 * W * sin(PI * u), rgba(C.skinLine, D.crease === 'outer' ? 0.5 : 0.62));
    }
    // inner corner
    if (!K.shut && lod > 1 && F.q < 0.4) {
      const ic0 = K.U[0];
      ink(ctx, [P(ic0[0] - 0.03, ic0[1] - 0.03), P(ic0[0] + 0.04, ic0[1] + 0.06)], (u) => 0.02 * W * sin(PI * u), rgba(C.skinLine, 0.6), false);
    }
    ctx.restore();
  }

  // welling tears: the water sits along the lower lid; the iris under it brightens (no grey wash), its surface is a
  // trembling bright line
  function drawTearWell(ctx, C, F, K, tw) {
    const P = (u, v) => EP(F, u, v); const tq = C.Tq;
    const top = K.L.map(p => [p[0], p[1] - 0.1 - 0.16 * tw + 0.016 * sin(p[0] * 9 + tq * 6 + F.side)]);
    const pts = top.map(p => P(p[0], p[1])).concat(K.L.slice().reverse().map(p => P(p[0], p[1] + 0.05)));
    fillPoly(ctx, pts, rgba('#eaf4ff', 0.12 + 0.12 * tw));
    ink(ctx, top.filter(p => p[0] > -0.4 && p[0] < 0.46).map(p => P(p[0], p[1])), (u) => 0.026 * F.W * sin(PI * u), rgba('#ffffff', 0.8 * tw));
  }

  // streaming tears: a ribbon of water from the lower lid down the cheek (bright edge, faint dark edge), drops at the jaw
  function drawTearStreams(ctx, C, ts) {
    const { M, V } = C; const s = V.s;
    for (const side of [-1, 1]) {
      const F = side < 0 ? C.eyeFL : C.eyeFR; if (!F || F.vis < 0.3) continue;
      const start = EP(F, 0.12, 0.34);
      const ex = side * M.eyeX;
      const path3 = [[ex + side * 0.02, M.eyeY + 0.085], [ex + side * 0.035, M.eyeY + 0.16], [ex + side * 0.04, -0.2], [ex + side * 0.02, -0.11], [side * 0.12, -0.04]];
      const n = path3.length; const len = clamp(ts * 1.15);
      const pts = [start];
      for (let i = 0; i < n; i++) { const k = (i + 1) / n; if (k > len + 0.2) break; const p = path3[i]; pts.push(proj(V, M.surf(farX(V, p[0]), p[1], 0.006))); }
      if (pts.length < 2) continue;
      const wob = 0.0015 * s * sin(C.Tq * 5 + side);
      const sp = smooth(pts, false, 6).map((p, i, a) => [p[0] + wob * (i / a.length), p[1]]);
      const cut = Math.max(2, Math.floor(sp.length * clamp(len / 1.0)));
      const st = sp.slice(0, cut);
      const wv = (u) => (0.017 * (1 - u * 0.35)) * s * sstep(0, 0.08, u) * (u > 0.88 ? 0.5 + (1 - u) * 4.2 : 1) * (C.lod ? 1 : 1.4);
      ink(ctx, st.map(p => [p[0] + 0.002 * s, p[1]]), (u) => wv(u) * 1.15, rgba(C.m.skin.line, 0.3), false);
      ink(ctx, st, wv, rgba(mixH(C.m.skin.hi, '#dff0ff', 0.65), 0.72), false);
      ink(ctx, st.map(p => [p[0] - 0.004 * s, p[1]]), (u) => wv(u) * 0.32, rgba('#ffffff', 0.95), false);
      // drops falling from the jaw
      if (ts > 0.85) {
        const end = st[st.length - 1];
        for (let k = 0; k < 2; k++) {
          const ph = ((C.Tq * 0.9 + k * 0.5 + (side > 0 ? 0.27 : 0)) % 1);
          const dy = ph * ph * 0.9 * s, r = 0.009 * s;
          const dx = end[0], dyy = end[1] + 0.01 * s + dy;
          ctx.beginPath(); ctx.moveTo(dx, dyy - r * 2.2); ctx.quadraticCurveTo(dx + r * 1.1, dyy - r * 0.2, dx, dyy + r); ctx.quadraticCurveTo(dx - r * 1.1, dyy - r * 0.2, dx, dyy - r * 2.2);
          ctx.fillStyle = rgba('#d8ecff', 0.85 * (1 - ph * 0.5)); ctx.fill();
          ctx.fillStyle = rgba('#ffffff', 0.9); ctx.beginPath(); ctx.arc(dx - r * 0.3, dyy - r * 0.2, r * 0.3, 0, TAU); ctx.fill();
        }
      }
    }
  }

  /* ================================================================== brows */
  function drawBrows(ctx, C, alpha = 1) {
    const { M, V } = C; const B = C.browE; const s = V.s; const boy = M.kind === 'm';
    const by = M.browY;
    for (const side of [-1, 1]) {
      const n = rotN(V, M.surfN(side * 0.16, by)); if (n[2] < -0.1) continue;
      const vis = clamp((n[2] + 0.1) / 0.25);
      const keys = boy
        ? [[0.055, 0.004], [0.10, -0.003], [0.16, -0.006], [0.22, -0.004], [0.272, 0.006]]
        : [[0.06, 0.006], [0.10, -0.004], [0.15, -0.01], [0.2, -0.0105], [0.245, -0.003], [0.276, 0.01]];
      const nk = keys.length;
      const pts = keys.map(([x, y], i) => {
        const t = i / (nk - 1); let yy = by + y, xx = x;
        yy -= (B.inner || 0) * 0.062 * (1 - t) * (1 - t) + (B.outer || 0) * 0.04 * t * t;
        if ((B.inner || 0) < 0) yy += 0.0;                  // lowering handled by the negative inner above
        xx -= (B.furrow || 0) * 0.012 * (1 - t); yy += (B.furrow || 0) * 0.006 * (1 - t);
        return proj(V, M.surf(farX(V, side * xx), yy, 0.006));
      });
      const w0 = (boy ? 0.021 : 0.0145) * s, w1 = (boy ? 0.012 : 0.0045) * s;
      ctx.save(); ctx.globalAlpha *= alpha * vis;
      ink(ctx, pts, (u) => lerp(w0, w1, u) * (0.6 + 0.4 * sstep(0, 0.12, u)) * (u > 0.85 ? lerp(1, 0.4, (u - 0.85) / 0.15) : 1), C.browCol);
      ctx.restore();
    }
    if ((B.furrow || 0) > 0.25 && alpha > 0.9) {
      for (const side of [-1, 1]) {
        const a = proj(V, M.surf(side * 0.032, by - 0.01, 0.006)), b = proj(V, M.surf(side * 0.04, by + 0.025, 0.006));
        ink(ctx, [a, b], (u) => 0.004 * s * sin(PI * u), rgba(C.skinLine, 0.6 * (B.furrow - 0.2)), false);
      }
    }
  }

  /* ================================================================== nose */
  function drawNose(ctx, C) {
    const { M, V, m } = C; const s = V.s; const ny = M.noseY;
    const yawAbs = abs(sin(V.ang)); const facing = V.facing; if (facing < -0.05) return;
    const far = Math.sign(sin(V.ang)) || 1;          // the far side (where the nose points)
    const away = C.lightVec[0] > 0 ? -1 : 1;         // side of the nose away from the light (head frame, approx.)
    // small cel shadow under / beside the tip
    const sh = [M.surf(away * 0.002, ny - 0.03, 0.004), M.surf(away * 0.02, ny + 0.002, 0.002), M.surf(away * 0.004, ny + 0.014, 0.002)].map(p => proj(V, p));
    fillPoly(ctx, sh, rgba(m.skin.shade, 0.85));
    // nose tip line
    const tip = [M.surf(-0.008 * far, ny + 0.012, 0.004), M.surf(0.0, ny + 0.007, 0.004), M.surf(0.011 * far, ny + 0.002, 0.004)].map(p => proj(V, p));
    ink(ctx, tip, (u) => C.lw * 0.42 * sin(PI * u), rgba(m.skin.line, 0.85));
    // 3/4: bridge line on the far side
    if (yawAbs > 0.18 && yawAbs < 0.97) {
      const a = clamp((yawAbs - 0.18) / 0.25) * clamp((0.97 - yawAbs) / 0.15);
      const br = [M.surf(far * 0.012, ny - 0.085, 0.003), M.surf(far * 0.017, ny - 0.04, 0.003), M.surf(far * 0.012, ny - 0.005, 0.003)].map(p => proj(V, p));
      ink(ctx, br, (u) => C.lw * 0.32 * sin(PI * u), rgba(m.skin.line, 0.55 * a));
    }
    // profile: nostril
    if (yawAbs > 0.75) {
      const nn = -far;
      const nb = [M.surf(nn * 0.016, ny + 0.012, 0.004), M.surf(nn * 0.02, ny + 0.002, 0.004), M.surf(nn * 0.012, ny - 0.008, 0.004)].map(p => proj(V, p));
      ink(ctx, nb, (u) => C.lw * 0.3 * sin(PI * u), rgba(m.skin.line, 0.6 * clamp((yawAbs - 0.75) / 0.15)));
    }
  }

  /* ================================================================== mouth */
  function mouthGeom(shape, open, M) {
    const y0 = M.mouthY, k = M.mouthW / 0.088;
    const pw = (x, hw, p) => pow(max(0, 1 - (x / hw) * (x / hw)), p);
    const N = 12, mk = (hw, top, bot) => {
      const T = [], B = [];
      for (let i = 0; i <= N; i++) { const x = -hw + 2 * hw * i / N; T.push([x, top(x)]); B.push([x, bot(x)]); }
      return { top: T, bot: B, hw };
    };
    if (open < 0.04) {
      const hw = { smile: 0.034, frown: 0.028, flat: 0.026, shout: 0.03, o: 0.016, u: 0.014 }[shape] ?? 0.026;
      const H = hw * k;
      const fy = shape === 'smile' ? (x) => y0 + 0.003 - 0.010 * (x / H) * (x / H) : shape === 'frown' ? (x) => y0 - 0.002 + 0.008 * (x / H) * (x / H) : (x) => y0 + 0.0015 * (1 - (x / H) * (x / H));
      const L = []; for (let i = 0; i <= N; i++) { const x = -H + 2 * H * i / N; L.push([x, fy(x)]); }
      return { line: L, hw: H };
    }
    const o = open;
    switch (shape) {
      case 'o': return mk(0.021 * k, (x) => y0 - 0.010 * o * pw(x, 0.021 * k, 0.5), (x) => y0 + 0.032 * o * pw(x, 0.021 * k, 0.5));
      case 'u': return mk(0.015 * k, (x) => y0 - 0.006 * o * pw(x, 0.015 * k, 0.5), (x) => y0 + 0.018 * o * pw(x, 0.015 * k, 0.5));
      case 'i': return mk(0.04 * k, (x) => y0 - 0.002 * o, (x) => y0 + 0.016 * o * pw(x, 0.04 * k, 0.6));
      case 'e': return mk(0.035 * k, (x) => y0 - 0.004 * o * pw(x, 0.035 * k, 1), (x) => y0 + 0.03 * o * pw(x, 0.035 * k, 0.7));
      case 'smile': { const hw = 0.039 * k; return mk(hw, (x) => y0 - 0.009 * (x / hw) * (x / hw), (x) => y0 - 0.009 * (x / hw) * (x / hw) + 0.036 * o * pw(x, hw, 0.8)); }
      case 'frown': { const hw = (0.03 + 0.012 * o) * k; return mk(hw, (x) => y0 + 0.008 * (x / hw) * (x / hw) - 0.006 * o * pw(x, hw, 1), (x) => y0 + 0.008 * (x / hw) * (x / hw) + 0.04 * o * pw(x, hw, 0.8)); }
      case 'shout': { const hw = (0.04 + 0.026 * o) * k; return mk(hw, (x) => y0 + 0.012 * o - 0.012 * o * pw(x, hw, 1.2) - 0.004, (x) => y0 + 0.012 * o + 0.1 * o * pw(x, hw, 0.42)); }
      default: { const hw = 0.034 * k; return mk(hw, (x) => y0 - 0.004 * o * pw(x, hw, 1), (x) => y0 + 0.05 * o * pw(x, hw, 0.72)); } // 'a'
    }
  }
  function drawMouth(ctx, C) {
    const { M, V, m } = C; if (V.facing < -0.1) return;
    const Mo = C.mouthE; const s = V.s;
    let shape = Mo.shape || 'flat', open = clamp(Mo.open || 0, 0, 1.2);
    if (open >= 0.04 && shape === 'flat') shape = open < 0.4 ? 'e' : 'a';
    const G = mouthGeom(shape, open, M);
    const pj = (p, off = 0.003) => proj(V, M.surf(p[0], p[1], off));
    const vis = clamp((rotN(V, M.surfN(0, M.mouthY))[2] + 0.2) / 0.3);
    ctx.save(); ctx.globalAlpha *= vis;
    if (G.line) {
      const L = G.line.map(p => pj(p));
      ink(ctx, L, (u) => C.lw * 0.55 * pow(sin(PI * u), 0.6) * (C.lod ? 1 : 1.3), m.skin.line);
      if (C.lod > 1 && s > 160) { // lower lip hint
        const ll = [[-0.012, M.mouthY + 0.024], [0, M.mouthY + 0.026], [0.012, M.mouthY + 0.024]].map(p => pj(p));
        ink(ctx, ll, (u) => C.lw * 0.3 * sin(PI * u), rgba(m.skin.shade, 0.9));
      }
    } else {
      const T = G.top.map(p => pj(p)), B = G.bot.map(p => pj(p));
      const inside = T.concat(B.slice().reverse());
      const dark = mixH(m.lips.deep, '#2a0d12', 0.45);
      ctx.beginPath(); poly(ctx, inside); ctx.fillStyle = dark; ctx.fill();
      ctx.save(); ctx.clip();
      // tongue
      const by = G.bot[Math.floor(G.bot.length / 2)][1], ty = G.top[Math.floor(G.top.length / 2)][1];
      const depth = by - ty;
      if (depth > 0.012) {
        const tc = pj([0, by - depth * 0.08]); const tr = pj([G.hw * 0.62, by - depth * 0.08]);
        const rx = Math.hypot(tr[0] - tc[0], tr[1] - tc[1]);
        ctx.beginPath(); ctx.ellipse(tc[0], tc[1], rx, depth * s * 0.42, V.roll, PI, TAU); ctx.ellipse(tc[0], tc[1], rx, depth * s * 0.2, V.roll, 0, PI);
        ctx.fillStyle = mixH(m.lips.base, m.lips.shade, 0.35); ctx.fill();
      }
      // upper teeth
      if ((shape === 'i' || shape === 'e' || shape === 'shout' || shape === 'a' || (shape === 'smile' && open > 0.2) || (shape === 'frown' && open > 0.5)) && depth > 0.014) {
        const th = Math.min(0.011, depth * 0.3);
        const teeth = G.top.map(p => pj(p, 0.001)).concat(G.top.slice().reverse().map(p => pj([p[0], p[1] + th * pow(1 - (p[0] / G.hw) * (p[0] / G.hw), 0.3)], 0.001)));
        fillPoly(ctx, teeth, mixH(m.sclera.base, m.sclera.shade, 0.15));
      }
      ctx.restore();
      ink(ctx, T, (u) => C.lw * 0.6 * pow(sin(PI * u), 0.4), m.skin.line);
      ink(ctx, B, (u) => C.lw * 0.38 * pow(sin(PI * u), 0.7), rgba(m.skin.line, 0.85));
    }
    ctx.restore();
  }

  /* ================================================================== blush */
  function drawBlush(ctx, C, amt) {
    const { M, V, m } = C; const s = V.s;
    for (const side of [-1, 1]) {
      const n = rotN(V, M.surfN(side * 0.2, -0.3)); if (n[2] < 0.05) continue;
      const c = proj(V, M.surf(farX(V, side * 0.2), -0.3, 0.004));
      const fx = 0.4 + 0.6 * clamp(n[2]);
      ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(V.roll); ctx.scale(fx, 0.5);
      const r = 0.085 * s;
      ctx.fillStyle = PV.radGrad(ctx, 0, 0, 0, r, [[0, m.blush.base, 0.55 * amt], [0.6, m.blush.base, 0.25 * amt], [1, m.blush.base, 0]]);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.restore();
      if (amt > 0.28 && C.lod > 0) {
        for (let k = -1; k <= 1; k++) {
          const a = proj(V, M.surf(side * (0.2 + k * 0.026) + 0.006, -0.315, 0.005)), b = proj(V, M.surf(side * (0.2 + k * 0.026) - 0.006, -0.288, 0.005));
          ink(ctx, [a, b], (u) => C.lw * 0.32 * sin(PI * u), rgba(m.blush.line, 0.75 * (amt - 0.2)), false);
        }
      }
    }
  }

  /* ================================================================== face skin, contour, ears, neck */
  function earPts(M, side) {
    const w = M.w(-0.38), s = side, y0 = M.earY[0], y1 = M.earY[1], h = y1 - y0;
    const Y = (k) => y0 + h * k;
    return {
      out: [[s * (w - 0.006), Y(0.05), 0.012], [s * (w + 0.016), Y(-0.04), -0.018], [s * (w + 0.034), Y(0.1), -0.056], [s * (w + 0.040), Y(0.38), -0.076],
        [s * (w + 0.034), Y(0.66), -0.07], [s * (w + 0.02), Y(0.9), -0.044], [s * (w + 0.006), Y(1.0), -0.012], [s * (w - 0.006), Y(0.9), 0.012]],
      helix: [[s * (w + 0.008), Y(0.12), -0.012], [s * (w + 0.024), Y(0.12), -0.044], [s * (w + 0.03), Y(0.38), -0.058], [s * (w + 0.022), Y(0.66), -0.048], [s * (w + 0.01), Y(0.78), -0.024]],
      bowl: [[s * (w + 0.006), Y(0.25), -0.012], [s * (w + 0.018), Y(0.26), -0.035], [s * (w + 0.02), Y(0.5), -0.042], [s * (w + 0.01), Y(0.66), -0.025], [s * (w + 0.002), Y(0.55), -0.006]],
      n: [s * 0.95, 0, -0.3],
    };
  }
  function drawEar(ctx, C, side) {
    const { M, V, m } = C; const E = earPts(M, side);
    const out = smooth(E.out.map(p => proj(V, p)), true, 5);
    ctx.beginPath(); poly(ctx, out); ctx.fillStyle = m.skin.base; ctx.fill();
    const nz = rotN(V, E.n)[2];
    if (nz > -0.2 && C.lod > 0) {
      ctx.save(); ctx.clip();
      fillPoly(ctx, smooth(E.bowl.map(p => proj(V, p)), true, 4), m.skin.shade);
      ctx.restore();
      ink(ctx, E.helix.map(p => proj(V, p)), (u) => C.lw * 0.45 * sin(PI * u), rgba(m.skin.line, 0.8));
    }
    ctx.beginPath(); poly(ctx, out); ctx.lineWidth = C.lw * 0.62; ctx.strokeStyle = m.skin.line; ctx.lineJoin = 'round'; ctx.stroke();
  }

  function drawFaceSkin(ctx, C) {
    const { sil, m, V } = C; const P = sil.poly;
    ctx.beginPath(); poly(ctx, P); ctx.fillStyle = m.skin.base; ctx.fill();
    // cel shadow: the silhouette minus a copy shifted toward the light = crescent on the far side
    const d = C.shadeD * V.s, lv = [C.lightVec[0], C.lightVec[1] * (C.lightVec[1] < 0 ? 0.35 : 0.8)];
    ctx.save(); ctx.beginPath(); poly(ctx, P); ctx.clip();
    ctx.beginPath(); poly(ctx, P.map(p => [p[0] + lv[0] * d, p[1] + lv[1] * d])); ctx.rect(-1e5, -1e5, 2e5, 2e5);
    ctx.fillStyle = m.skin.shade; ctx.fill('evenodd');
    // soft warm bounce on the lit cheek (allowed gradient: cheeks)
    ctx.restore();
  }
  function drawFaceLine(ctx, C) {
    const { sil } = C; const S = sil.R.concat(sil.L.slice().reverse()); const n = S.length;
    const ok = S.map(p => sil.lineOK(p));
    let start = ok.findIndex(v => !v); if (start < 0) start = 0;
    const runs = []; let cur = [];
    for (let k = 1; k <= n; k++) {
      const i = (start + k) % n;
      if (ok[i]) cur.push(S[i]); else if (cur.length) { runs.push(cur); cur = []; }
    }
    if (cur.length) runs.push(cur);
    const w = C.lw * 0.78;
    for (const r of runs) if (r.length > 2) ink(ctx, r, (u) => w * (0.35 + 0.65 * sstep(0, 0.08, u) * sstep(1, 0.92, u)), C.m.skin.line);
  }

  // neck: belongs to the body frame (does not yaw with the head). anchor = neck point.
  // Anime neck: slim, slightly waisted, visible ~0.35-0.45 H from the jaw to the collar; seen from the side it is deeper
  // (throat to nape), leans forward ~17 deg into the shoulders, its back line starts up at the skull base (behind / below
  // the ear, higher than the throat, which starts under the jaw) and flows into the trapezius slope.
  const NECKR = { senpai: [0.071, 1.3], boy: [0.088, 1.25], aunt: [0.073, 1.3] };   // half-width (H) front, depth factor
  function neckShape(C, o) {
    const { V, M } = C; const s = V.s;
    const bAng = o.bodyYaw != null ? o.bodyYaw * HP : V.ang;
    const side = sin(bAng), sa = abs(side), fdir = side >= 0 ? 1 : -1;
    const nr = NECKR[M.name] || NECKR.senpai;
    const rt = nr[0] * s * (o.neckW || 1) * lerp(1, nr[1], sa);
    const len = ((o.neckLen ?? 0.40) + 0.24) * s;
    const lean = o.neckLean ?? (-side * 0.3);
    const top = [V.ox + side * 0.035 * s, V.oy - 0.24 * s];   // starts behind the jaw / under the skull: hidden by the face
    const dir = [sin(lean), cos(lean)], nm = [cos(lean), -sin(lean)];
    const flare = o.neckFlare ?? (!!o.neck && !o.neckFade);
    const N = 16, Lp = [], Rp = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, c = [top[0] + dir[0] * len * t, top[1] + dir[1] * len * t];
      const w = rt * (1 - 0.08 * sin(PI * clamp(t * 1.15))) * (1 + 0.16 * t * t);
      // trapezius / collar flare at the base: both sides in front view; in profile the back flares, the throat less
      const fl = flare && t > 0.76 ? pow((t - 0.76) / 0.24, 2) : 0;
      const fBack = lerp(0.55, 1.6, sa), fFront = lerp(0.55, 0.3, sa);
      // left/right in screen: the back of the neck is on the side opposite to the facing direction
      const wl = w + rt * fl * (fdir > 0 ? fBack : fFront), wr = w + rt * fl * (fdir > 0 ? fFront : fBack);
      const yl = fl * rt * 0.35 * (fdir > 0 ? 1 : 0.4), yr = fl * rt * 0.35 * (fdir > 0 ? 0.4 : 1);
      Lp.push([c[0] - nm[0] * wl, c[1] - nm[1] * wl - yl]); Rp.push([c[0] + nm[0] * wr, c[1] + nm[1] * wr - yr]);
    }
    const P = Lp.concat(Rp.slice().reverse());
    return { P, Lp, Rp, top, bot: [top[0] + dir[0] * len, top[1] + dir[1] * len], r: rt, t: nm, dir, len, flare, side, fdir, sa };
  }
  function drawNeck(ctx, C, o) {
    const { m, V } = C; const N = neckShape(C, o); const s = V.s;
    // a head without a body: the neck base dissolves (no hard horizontal cut)
    const fadeFill = N.flare ? (col, al = 1) => { const a = N.top, b = N.bot, g = ctx.createLinearGradient(a[0], a[1], b[0], b[1] + 0.06 * s);
      g.addColorStop(0, rgba(col, al)); g.addColorStop(0.66, rgba(col, al)); g.addColorStop(0.97, rgba(col, 0)); return g; } : (col, al = 1) => (al < 1 ? rgba(col, al) : col);
    ctx.beginPath(); poly(ctx, N.P); ctx.fillStyle = fadeFill(m.skin.base); ctx.fill();
    ctx.save(); ctx.clip();
    // shadow cast by the jaw: the face silhouette pushed down (deepest under the chin) + a narrow band away from the light
    const lv = C.lightVec; const dx = -lv[0] * 0.035 * s, dy = (0.085 + 0.02 * N.sa) * s;
    ctx.beginPath(); poly(ctx, C.sil.poly.map(p => [p[0] + dx, p[1] + dy])); ctx.fillStyle = fadeFill(m.skin.shade); ctx.fill();
    const sd = lv[0] > 0 ? -1 : 1;
    const band = [];
    for (let i = 0; i <= 16; i += 2) { const p = (sd > 0 ? N.Rp : N.Lp)[i], t = i / 16; const k = lerp(0.42, 0.62, t); band.push([lerp(p[0], N.top[0] + N.dir[0] * N.len * t, k), lerp(p[1], N.top[1] + N.dir[1] * N.len * t, k)]); }
    const edge = (sd > 0 ? N.Rp : N.Lp).filter((_, i) => i % 2 === 0).map(p => [p[0] + sd * 0.05 * s, p[1]]);
    ctx.beginPath(); poly(ctx, band.concat(edge.reverse())); ctx.fillStyle = fadeFill(m.skin.shade, 0.92); ctx.fill();
    ctx.restore();
    const lw = C.lw * 0.68;
    const fadeL = o.neckFade ? (u) => sstep(1, 0.82, u) : N.flare ? (u) => sstep(1, 0.7, u) : () => 1;
    const LpI = N.Lp.slice(3), RpI = N.Rp.slice(3);
    ink(ctx, LpI, (u) => lw * sstep(0.0, 0.25, u) * fadeL(u), m.skin.line, false);
    ink(ctx, RpI, (u) => lw * sstep(0.0, 0.25, u) * fadeL(u), m.skin.line, false);
    if (C.lod > 1 && N.sa > 0.25 && V.facing > -0.3) { // sternocleidomastoid: a soft line from behind the ear to the pit of the neck
      const back = N.fdir > 0 ? N.Lp : N.Rp, front = N.fdir > 0 ? N.Rp : N.Lp;
      const a = L2(back[5], front[5], 0.3), b = L2(back[13], front[13], 0.82);
      ink(ctx, [a, L2(a, b, 0.5), b], (u) => lw * 0.55 * sin(PI * u), rgba(m.skin.line, 0.38 * clamp((N.sa - 0.25) / 0.3)), true);
    }
    if (C.M.kind === 'm' && C.lod > 1) { // Adam's apple: a small notch on the throat line (profile-ish) or a short tick (front)
      const front = N.fdir > 0 ? N.Rp : N.Lp, p = front[7];
      if (N.sa > 0.4) ink(ctx, [[p[0] - N.fdir * 0.004 * s, p[1] - 0.02 * s], [p[0] + N.fdir * 0.006 * s, p[1]], [p[0] - N.fdir * 0.002 * s, p[1] + 0.02 * s]], (u) => lw * 0.8 * sin(PI * u), m.skin.line);
      else { const c = L2(N.top, N.bot, 0.55); ink(ctx, [[c[0] - 0.008 * s, c[1]], [c[0], c[1] + 0.006 * s], [c[0] + 0.008 * s, c[1]]], (u) => lw * 0.4 * sin(PI * u), rgba(m.skin.line, 0.5)); }
    }
    return N;
  }

  /* ================================================================== hair: styles */
  // lock = clump: centre line P (head-frame control points), w max half-width (H), w0 root half-width, taper from `tip`
  // (0..1 of the length) with exponent k, hang = share of gravity (hanging parts ignore head roll), g = group.
  function lock(g, P, w, o = {}) { return Object.assign({ g, P, w, w0: w * 0.8, tip: 0.45, k: 1.2, hang: 0, side: 0, seed: 0, windK: 1 }, o); }
  const shX = (M, x, y, off) => { const w = Math.max(1e-4, M.w(y)); return M.shell(Math.asin(clamp(x / w, -1, 1)) / D2R, y, off); };
  const sym = (keys) => curve(keys.concat(keys.filter(k => k[0] > 0).map(k => [-k[0], k[1]])));

  function styleSenpai(M, st) {
    const style = st || 'down';
    const wet = style === 'wet', up = style === 'updo' || style === 'loose', loose = style === 'loose';
    const th = wet ? 0.022 : up ? 0.034 : 0.05;
    const H = {
      capTh: wet ? { top: 0.024, side: 0.024, back: 0.03 } : up ? { top: 0.044, side: 0.036, back: 0.044 } : { top: 0.064, side: 0.054, back: 0.062 },
      hairline: sym(up ? [[0, -0.80], [35, -0.77], [60, -0.70], [80, -0.58], [92, -0.50], [110, -0.42], [140, -0.30], [180, -0.25]]
        : [[0, -0.80], [35, -0.77], [60, -0.70], [80, -0.56], [95, -0.34], [110, -0.30], [140, -0.25], [180, -0.22]]),
      ringY: -0.865, part: -0.075, flow: up ? 'bun' : 'part', ears: up, locks: [], bun: null, wet,
    };
    const L = H.locks; const r = (i, k) => PV.rand1(i, 77 + k) - 0.5;
    // see-through bangs at brow height, parted slightly to her right (screen-left, x<0): 6 clumps of varied width with narrow
    // gaps + 2 short temple clumps + 2 wisps; slight S-curves, tips tapered and turned a little inward
    // [x tip, y tip, half width, sweep, S amplitude]
    const bangs = wet
      ? [[-0.30, -0.44, 0.022, -1, 0.004], [-0.22, -0.505, 0.026, -0.8, 0.005], [-0.135, -0.53, 0.02, -0.45, 0.004], [-0.045, -0.515, 0.03, 0.1, 0.005],
        [0.06, -0.535, 0.022, 0.35, 0.004], [0.155, -0.52, 0.028, 0.6, 0.005], [0.245, -0.49, 0.022, 0.85, 0.004], [0.31, -0.43, 0.02, 1.05, 0.003]]
      : [[-0.322, -0.452, 0.023, -1.15, 0.008], [-0.238, -0.53, 0.036, -0.95, 0.013], [-0.152, -0.548, 0.027, -0.35, 0.015],
        [-0.045, -0.552, 0.048, 0.3, 0.017], [0.072, -0.57, 0.03, 0.2, 0.014], [0.168, -0.54, 0.045, 0.8, 0.017],
        [0.262, -0.512, 0.03, 0.85, 0.012], [0.333, -0.44, 0.022, 1.18, 0.008]];
    const wisps = wet ? [] : [[-0.098, -0.528, 0.011, -0.25, 0.006], [0.125, -0.548, 0.0105, 0.55, 0.006]];
    const addBang = ([xt, yt, w, cu, sc], i, wisp) => {
      const xr = H.part + (xt - H.part) * 0.22, yr = -0.905, jx = r(i, 3) * 0.02, sw = (i % 2 ? 1 : -1) * 0.0028;
      const P = [shX(M, xr, yr, th * 0.9), shX(M, lerp(xr, xt, 0.45) + cu * 0.008 + jx, -0.79, th * 0.75 + 0.008),
        M.surf(lerp(xr, xt, 0.75) + cu * 0.012 - jx * 0.5 + sw, -0.68, wet ? 0.008 : 0.026), M.surf(lerp(xr, xt, 0.93) + cu * 0.006 - sw, lerp(-0.68, yt, 0.62), wet ? 0.006 : 0.018),
        M.surf(xt + cu * 0.014 + sw * 0.6, yt, wet ? 0.005 : 0.013)];
      P[4][2] = Math.max(P[4][2], P[3][2] - 0.01); P[3][2] = Math.max(P[3][2], P[2][2] - 0.012);
      L.push(lock('bang', P, w, { w0: w * (wisp ? 0.6 : 0.78), tip: wisp ? 0.3 : 0.44, k: wisp ? 1.2 : 0.95, seed: i + (wisp ? 20 : 0), windK: 0.35,
        side: Math.sign(xt), sc, scF: 0.75, scPh: 1.3 + i * 2.1, tipIn: wisp ? 0.002 : 0.009, bulge: wisp ? 0 : 0.18, wisp }));
    };
    wisps.forEach((b, i) => addBang(b, i, true));
    bangs.forEach((b, i) => addBang(b, i, false));
    if (wet) { // strands pasted to the cheeks
      for (const s of [-1, 1]) L.push(lock('bang', [shX(M, s * 0.25, -0.76, th), M.surf(s * 0.31, -0.55, 0.006), M.surf(s * 0.285, -0.33, 0.005), M.surf(s * 0.24, -0.16, 0.004)], 0.016, { tip: 0.4, k: 1.3, windK: 0.1, side: s, sc: 0.006 }));
    }
    // side locks: long, framing the face, curving in along the cheek and falling to the chest, tips turned in
    for (const s of [-1, 1]) {
      if (!up) {
        const pull = wet ? 0.93 : 1;
        // outer lock from above the ear (behind the face-framing one)
        L.push(lock('side', [shX(M, s * 0.335, -0.62, th * 0.5), [s * 0.41 * pull, -0.42, 0.05], [s * 0.425 * pull, -0.12, 0.045], [s * 0.44 * pull, 0.25, 0.06], [s * 0.45, 0.62, 0.07], [s * 0.43, 0.98, 0.07]],
          wet ? 0.03 : 0.05, { w0: 0.012, hang: 0.85, tip: 0.56, k: 1.0, side: s, seed: 11 + s, sc: wet ? 0.006 : 0.016, scF: 0.6, tipIn: 0.022, bulge: 0.1 }));
        // the face-framing lock (触角): in along the cheek, out over the collarbone, tip in at the chest
        L.push(lock('side', [shX(M, s * 0.305, -0.68, th * 0.5), [s * 0.372 * pull, -0.49, 0.14], [s * 0.36 * pull, -0.26, 0.145], [s * 0.345 * pull, -0.03, 0.15], [s * 0.37, 0.27, 0.16], [s * 0.39, 0.6, 0.17], [s * 0.37, 0.9, 0.16]],
          wet ? 0.032 : 0.054, { w0: 0.013, hang: 0.8, tip: 0.56, k: 0.95, side: s, seed: 13 + s, sc: wet ? 0.005 : 0.012, scF: 0.7, scPh: 0.6, tipIn: 0.024, bulge: 0.12 }));
        // thin strand along the cheek
        L.push(lock('side', [shX(M, s * 0.255, -0.73, th * 0.45), [s * 0.322 * pull, -0.56, 0.24], [s * 0.335 * pull, -0.36, 0.23], [s * 0.318 * pull, -0.14, 0.21], [s * 0.335, 0.12, 0.2], [s * 0.355, 0.36, 0.2]],
          wet ? 0.016 : 0.021, { w0: 0.008, hang: 0.6, tip: 0.5, k: 1.0, side: s, seed: 17 + s, sc: 0.008, scF: 0.9, tipIn: 0.012, cheek: true }));
        // over the shoulder: from behind the ear, forward over the shoulder onto the chest
        if (!wet) L.push(lock('side', [M.shell(s * 112, -0.52, th * 0.6), [s * 0.45, -0.18, -0.07], [s * 0.5, 0.17, 0.0], [s * 0.505, 0.5, 0.1], [s * 0.475, 0.84, 0.14], [s * 0.44, 1.1, 0.14]],
          0.06, { w0: 0.03, hang: 0.9, tip: 0.55, k: 1.0, side: s, seed: 19 + s, sc: 0.02, scF: 0.55, scPh: 2.2 + s, tipIn: 0.026, bulge: 0.12, shoulder: true }));
      } else {
        // updo: thin face-framing strands only
        if (!loose) L.push(lock('side', [shX(M, s * 0.29, -0.76, th), [s * 0.36, -0.56, 0.2], [s * 0.37, -0.30, 0.18], [s * 0.36 + s * 0.01 * sin(1 + s), -0.05, 0.17], [s * 0.355, 0.02, 0.17]],
          0.016, { hang: 0.6, tip: 0.45, k: 1.1, side: s, seed: 21 + s, sc: 0.008, scF: 1.2, tipIn: 0.01 }));
        else { // coming undone: wavy strands around the face and the neck
          L.push(lock('side', [shX(M, s * 0.29, -0.76, th), [s * 0.365, -0.56, 0.2], [s * 0.36, -0.34, 0.19], [s * 0.378, -0.12, 0.18], [s * 0.37, 0.08, 0.18], [s * 0.388, 0.26, 0.18], [s * 0.376 + s * 0.012, 0.38, 0.19]],
            0.021, { w0: 0.012, hang: 0.6, tip: 0.42, k: 1.1, side: s, seed: 21 + s, sc: 0.007, scF: 0.9, tipIn: 0.01 }));
          L.push(lock('side', [M.shell(s * 100, -0.62, th), [s * 0.38, -0.38, -0.02], [s * 0.372, -0.18, -0.02], [s * 0.392, 0.02, -0.01], [s * 0.384, 0.2, 0.0], [s * 0.405, 0.36, 0.02], [s * 0.395 - s * 0.012, 0.47, 0.03]],
            0.015, { w0: 0.009, hang: 0.7, tip: 0.42, side: s, seed: 25 + s, sc: 0.006, scF: 0.8 }));
          if (s > 0) L.push(lock('side', [shX(M, s * 0.2, -0.86, th), [s * 0.3, -0.7, 0.24], [s * 0.33, -0.55, 0.26], [s * 0.3, -0.42, 0.27]], 0.01, { w0: 0.008, tip: 0.4, side: s, seed: 27, sc: 0.006 }));
        }
      }
    }
    // back curtain to the waist: clumps of varied width and length that converge down the back (no flat "cape")
    if (!up) {
      const ths = wet ? [100, 118, 136, 154, 172, 190, 208, 226, 244, 262] : [100, 121, 143, 165, 180, 195, 217, 239, 260];
      ths.forEach((t0, i) => {
        const t = t0 > 180 ? t0 - 360 : t0; const sx = sin(t * D2R), cz = cos(t * D2R);
        const wv = 1 + r(i, 4) * 0.62;
        const xh = sx * (wet ? 0.40 : 0.46), zh = cz * 0.28 - 0.12, j = r(i, 1) * 0.05, tipY = (wet ? 1.68 : 1.74) + r(i, 2) * 0.36;
        const tc = 180 + (((t + 360) % 360) - 180) * 0.45, conv = 0.8;
        L.push(lock('back', [M.shell(tc, -0.975, th * 0.1), M.shell(lerp(tc, t, 0.7), -0.8, th * 0.35), M.shell(t, -0.55, th * 0.5), M.shell(t, -0.3, th * 0.8), [xh, 0.05, zh], [xh * 1.03, 0.6, zh - 0.03], [xh * lerp(1, conv, 0.55) + j, tipY - 0.35, zh - 0.04], [xh * conv + j * 1.5, tipY, zh - 0.04]],
          (wet ? 0.06 : 0.1) * wv, { w0: wet ? 0.018 : 0.022, hang: 1, tip: 0.76, k: 0.9, seed: 31 + i, side: Math.sign(sx), sc: wet ? 0.008 : 0.024, scF: 0.55, tipIn: wet ? 0.01 : 0.03, bulge: 0.08 }));
      });
    } else {
      H.bun = loose ? { c: [0, -0.17, -0.5], r: [0.19, 0.15, 0.12], loose: 1 } : { c: [0, -0.24, -0.52], r: [0.165, 0.13, 0.105], loose: 0 };
      if (loose) for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        L.push(lock('back', [[s * 0.05, -0.12, -0.6], [s * 0.08, 0.05, -0.55], [s * 0.1, 0.3, -0.5], [s * 0.09, 0.55, -0.48]], 0.022, { hang: 1, tip: 0.5, seed: 41 + i, side: s, sc: 0.006, scF: 0.8 }));
      }
    }
    return H;
  }

  function styleBoy(M, st) {
    const wet = st === 'wet';
    const th = wet ? 0.03 : 0.085;
    const H = {
      capTh: wet ? { top: 0.03, side: 0.03, back: 0.035 } : { top: 0.08, side: 0.056, back: 0.08 },
      hairline: sym([[0, -0.80], [35, -0.77], [60, -0.70], [80, -0.6], [92, -0.52], [110, -0.40], [140, -0.24], [180, -0.18]]),
      ringY: -0.87, part: null, flow: 'crown', locks: [], bun: null, wet, ears: true, ringK: 0.6,
    };
    const L = H.locks; const r = (i, k) => PV.rand1(i, 55 + k) - 0.5;
    // messy bangs to the upper eyelids: uneven pointed clumps of varied width and length, flowing from the crown slightly
    // to his left (screen-right); the clumps over the eyes are thin so the eyes always read. [x tip, y tip, half w, sweep]
    const bangs = wet
      ? [[-0.31, -0.5, 0.028, -1.0], [-0.22, -0.47, 0.034, -0.7], [-0.12, -0.44, 0.024, -0.4], [-0.03, -0.43, 0.036, -0.1], [0.06, -0.45, 0.026, 0.2],
        [0.15, -0.44, 0.03, 0.45], [0.24, -0.47, 0.032, 0.7], [0.32, -0.51, 0.026, 1.0]]
      : [[-0.33, -0.52, 0.038, -1.0], [-0.235, -0.455, 0.052, -0.7], [-0.13, -0.5, 0.026, -0.35], [-0.06, -0.425, 0.055, -0.05],
        [0.045, -0.47, 0.03, 0.2], [0.13, -0.445, 0.05, 0.45], [0.235, -0.49, 0.042, 0.78], [0.33, -0.535, 0.032, 1.1], [-0.18, -0.58, 0.02, -0.5], [0.09, -0.585, 0.018, 0.35]];
    bangs.forEach(([xt, yt, w, cu], i) => {
      const xr = 0.05 + xt * 0.32, drift = 0.03;   // overall flow to his left (screen-right)
      const p3 = M.surf(lerp(xr, xt, 0.82) + cu * 0.024 + drift * 0.8, -0.63, wet ? 0.012 : 0.034), p4 = M.surf(xt + cu * 0.03 + drift * 0.5, yt, wet ? 0.008 : 0.02);
      p4[2] = Math.max(p4[2], p3[2] - 0.012);          // no backward hook at the temple in profile
      const P = [shX(M, xr, -0.97, th * 0.85), shX(M, lerp(xr, xt, 0.5) - 0.01 + cu * 0.014 + drift, -0.8, wet ? 0.03 : 0.06), p3, p4];
      L.push(lock('bang', P, wet ? w * 0.75 : w, { w0: w * 0.82, tip: 0.3 + 0.08 * PV.rand1(i, 4), k: 1.35, seed: 50 + i, windK: 0.4, side: Math.sign(xt),
        sc: wet ? 0.002 : 0.003 + 0.003 * PV.rand1(i, 5), scF: 0.6, scPh: i * 2.3, bulge: 0.1 }));
    });
    // sides: pointed clumps on the side of the skull covering the top half of the ear (they follow the head's surface:
    // no hooks in profile), a thinner one at the temple and one behind the ear
    for (const s of [-1, 1]) {
      const o = wet ? 0.6 : 1;
      L.push(lock('side', [M.shell(s * 70, -0.84, th * 0.6), M.shell(s * 72, -0.68, th * 0.8 * o), M.shell(s * 74, -0.54, (th * 0.55 + 0.012) * o), M.shell(s * 76, -0.45, 0.024)], wet ? 0.022 : 0.03,
        { w0: 0.022, tip: 0.36, k: 1.35, side: s, seed: 62 + s, sc: 0.002, bulge: 0.05 }));
      L.push(lock('side', [M.shell(s * 84, -0.82, th * 0.6), M.shell(s * 87, -0.64, th * 0.85 * o), M.shell(s * 89, -0.49, (th * 0.6 + 0.014) * o), M.shell(s * 91, -0.385, 0.03)], wet ? 0.034 : 0.046,
        { w0: 0.03, tip: 0.34, k: 1.35, side: s, seed: 60 + s, sc: 0.002, bulge: 0.06 }));
      L.push(lock('side', [M.shell(s * 104, -0.8, th * 0.6), M.shell(s * 108, -0.62, th * 0.9 * o), M.shell(s * 111, -0.47, (th * 0.65 + 0.014) * o), M.shell(s * 113, -0.355, 0.03)], wet ? 0.03 : 0.044,
        { w0: 0.03, tip: 0.36, k: 1.35, side: s, seed: 64 + s, sc: 0.002, bulge: 0.06 }));
    }
    // jagged back + nape: clumps down the back of the skull, the lowest ones touch the collar and flick out
    const back = wet ? [[104, -0.34], [128, -0.27], [152, -0.22], [-152, -0.23], [-128, -0.28], [-104, -0.35]]
      : [[100, -0.37], [122, -0.3], [143, -0.24], [164, -0.2], [-164, -0.19], [-143, -0.23], [-122, -0.29], [-100, -0.36]];
    back.forEach(([t, ye], i) => L.push(lock('nape', [M.shell(t, -0.66, th * 0.7), M.shell(t, -0.48, th + 0.008), M.shell(t * 1.03, ye + r(i, 1) * 0.04, th + 0.03 + 0.02 * PV.rand1(i, 2))],
      (wet ? 0.042 : 0.052) * (1 + r(i, 3) * 0.5), { w0: 0.04, tip: 0.36, k: 1.35, seed: 64 + i, side: Math.sign(t), sc: 0.002, scPh: i, bulge: 0.05 })));
    [[168, -0.12], [-175, -0.1], [150, -0.15]].forEach(([t, ye], i) => L.push(lock('nape', [M.shell(t, -0.42, th * 0.6), M.shell(t, -0.25, th * 0.85), M.shell(t + (i === 1 ? -14 : 14), ye, th + 0.07)],
      wet ? 0.034 : 0.044, { w0: 0.032, tip: 0.36, k: 1.35, seed: 72 + i, side: Math.sign(t), sc: 0.004 })));
    if (!wet) {
      // crown: a whorl slightly back of the top; a few spikes break the silhouette (slept-on messiness)
      [[166, -0.86, 172, -0.96, 182, -0.995, 0.034], [-148, -0.82, -154, -0.91, -168, -0.95, 0.028], [128, -0.78, 132, -0.88, 140, -0.93, 0.026],
        [30, -0.9, 18, -0.975, 2, -1.02, 0.026]].forEach(([a0, y0, a1, y1, a2, y2, w], i) =>
        L.push(lock('top', [M.shell(a0, y0, th * 0.6), M.shell(a1, y1, th + 0.02), M.shell(a2, y2, th + 0.055)], w, { w0: w * 0.75, tip: 0.3, k: 1.35, seed: 80 + i, sc: 0.004 })));
    }
    return H;
  }

  function styleAunt(M) {
    const th = 0.04;
    const H = {
      capTh: { top: 0.05, side: 0.058, back: 0.056 },
      hairline: sym([[0, -0.82], [35, -0.78], [60, -0.70], [80, -0.58], [95, -0.42], [110, -0.33], [140, -0.26], [180, -0.24]]),
      ringY: -0.84, part: 0.0, flow: 'tail', locks: [], bun: null, wet: false, ears: true,
    };
    const L = H.locks;
    for (const s of [-1, 1]) {
      L.push(lock('bang', [shX(M, s * 0.02, -0.94, th), shX(M, s * 0.17, -0.87, th + 0.012), shX(M, s * 0.30, -0.72, th + 0.012), [s * 0.37, -0.54, 0.07], [s * 0.37, -0.42, 0.005]], 0.06, { tip: 0.55, k: 1.2, side: s, seed: 90 + s, windK: 0.4 }));
      L.push(lock('side', [shX(M, s * 0.25, -0.79, th), [s * 0.335, -0.62, 0.19], [s * 0.35, -0.44, 0.18], [s * 0.342, -0.27, 0.165]], 0.016, { tip: 0.4, hang: 0.5, side: s, seed: 93 + s, sc: 0.006, scF: 0.8, tipIn: 0.006 }));
    }
    L.push(lock('tail', [M.shell(180, -0.34, th + 0.02), [0.0, -0.2, -0.57], [0.02, 0.08, -0.53], [0.0, 0.38, -0.46], [0.012, 0.58, -0.43]], 0.07, { w0: 0.05, hang: 1, tip: 0.55, k: 1.1, seed: 97 }));
    H.tie = [0, -0.33, -0.54];
    return H;
  }
  function hairStyle(M, who, st) { return who === 'boy' ? styleBoy(M, st) : who === 'aunt' ? styleAunt(M) : styleSenpai(M, st); }

  /* ================================================================== hair: geometry */
  const SHELLC = [0, -0.5, -0.07];
  function shellNz(V, p) { const n = [p[0] - SHELLC[0], (p[1] - SHELLC[1]) * 0.9, p[2] - SHELLC[2]]; const l = Math.hypot(n[0], n[1], n[2]) || 1; return rotN(V, [n[0] / l, n[1] / l, n[2] / l])[2]; }
  // longest cyclic run of indices whose flag is true
  function visRun(flags) {
    const n = flags.length; if (flags.every(Boolean)) return [...Array(n).keys()];
    let best = [], i0 = flags.findIndex(f => !f);
    let cur = [];
    for (let k = 1; k <= n; k++) { const i = (i0 + k) % n; if (flags[i]) cur.push(i); else { if (cur.length > best.length) best = cur; cur = []; } }
    if (cur.length > best.length) best = cur;
    return best;
  }
  // region above the projected (visible) hairline, extended sideways: clip for the cap
  function hairRegion(C, H) {
    const { M, V } = C; const s = V.s; const pts = [], flags = [];
    for (let t = -180; t < 180; t += 7.5) { const p = M.shell(t, H.hairline(t), 0); pts.push(proj(V, p)); flags.push(shellNz(V, p) > -0.03); }
    let arc = visRun(flags).map(i => pts[i]);
    const right = [V.cr, V.sr], up = [V.sr, -V.cr];
    if (arc.length < 2) return null;
    if ((arc[arc.length - 1][0] - arc[0][0]) * right[0] + (arc[arc.length - 1][1] - arc[0][1]) * right[1] < 0) arc = arc.reverse();
    const a = arc[0], b = arc[arc.length - 1], E = 3 * s, U = 5 * s;
    const region = arc.concat([[b[0] + right[0] * E, b[1] + right[1] * E], [b[0] + right[0] * E + up[0] * U, b[1] + right[1] * E + up[1] * U],
      [a[0] - right[0] * E + up[0] * U, a[1] - right[1] * E + up[1] * U], [a[0] - right[0] * E, a[1] - right[1] * E]]);
    return { region, arc };
  }
  function capPoly(C, H) {
    const T = H.capTh, s = C.V.s;
    // only the skull part of the silhouette: points above the hairline at their own azimuth (not the jaw / face)
    const keep = (p) => { const th = Math.atan2(p.f[0], p.f[2] + 0.07) / D2R; return p.f[1] <= H.hairline(th) + 0.05; };
    const all = C.sil.poly, flags = all.map(keep);
    const P = visRun(flags).map(i => all[i]);
    if (P.length < 3) return [];
    const off = smooth(offsetPoly(P, (i) => { const p = P[i]; const top = sstep(-0.55, -0.98, p.f[1]); return lerp(p.front ? T.side : T.back, T.top, top) * s; }), false, 2);
    // close through the nape (the hairline clip trims the rest), so the cap covers the scalp down to the hairline
    const M = C.M, nape = [proj(C.V, M.shell(150, -0.17, T.back * 0.6)), proj(C.V, M.shell(180, -0.15, T.back * 0.6)), proj(C.V, M.shell(-150, -0.17, T.back * 0.6))];
    const b = off[off.length - 1], d0 = Math.hypot(nape[0][0] - b[0], nape[0][1] - b[1]), d2 = Math.hypot(nape[2][0] - b[0], nape[2][1] - b[1]);
    const res = off.concat(d0 < d2 ? nape : nape.reverse()); res.off = off;
    return res;
  }
  // ink with a per-vertex width (px)
  function inkVar(ctx, pts, widths, col) {
    const n = pts.length; if (n < 2) return;
    const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = cum[n - 1] || 1;
    A.taper(ctx, pts, (u) => { const d = u * tot; let i = 1; while (i < n - 1 && cum[i] < d) i++; const k = (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return lerp(widths[i - 1], widths[i], clamp(k)); }, col, false);
  }

  // wind + idle sway: re-bend the projected control polyline segment by segment (lengths preserved, on twos)
  function bend(C, pts, Lk) {
    const w = C.wind * (Lk.windK ?? 1), s = C.V.s; if (C.still && w < 1e-3) return pts;
    const wv = C.windVec, gust = 0.82 + 0.22 * A.sway(C.Tq * 0.8, 5);
    const out = [pts[0]]; let acc = 0; const free = Lk.free ?? 1;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dy) || 1e-6;
      let d = [dx / l, dy / l];
      if (i >= free) {
        acc += l / s;
        const k = Math.min(0.8, clamp(w * 0.55 * gust * pow(acc, 0.7) * (1 + 0.25 * A.sway(C.Tq * 2.2 - acc * 2, Lk.seed + 9))));
        if (k > 0) d = nrm([d[0] * (1 - k) + wv[0] * k, d[1] * (1 - k) + wv[1] * k]);
        const a = (0.035 + 0.2 * w) * A.sway(C.Tq * (0.8 + w * 0.9) - acc * (0.8 + 1.4 * w), Lk.seed + 1) * min(1, acc * 1.6);
        const ca = cos(a), sa = sin(a); d = [d[0] * ca - d[1] * sa, d[0] * sa + d[1] * ca];
      }
      out.push([out[i - 1][0] + d[0] * l, out[i - 1][1] + d[1] * l]);
    }
    return out;
  }

  function lockGeo(C, Lk) {
    const { V, M } = C; const s = V.s;
    let z = 0; for (const p of Lk.P) z += rot(V, p)[2]; z /= Lk.P.length;
    let pts = Lk.P.map((p) => proj(V, p, Lk.hang * sstep(-0.4, 0.25, p[1])));
    pts = bend(C, pts, Lk);
    let c = A.spline(pts, false, 5); const n = c.length;
    const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
    const tot = cum[n - 1] || 1, u = cum.map(v => v / tot);
    // organic shape: a gentle S-curve across the clump and the tip turning in (toward the head's axis / the body)
    if ((Lk.sc || Lk.tipIn) && n > 3) {
      const a = c[0], b = c[n - 1], d = nrm([b[0] - a[0], b[1] - a[1]]), pn = [-d[1], d[0]];
      const axisX = V.ox + (b[1] - V.oy) * -V.sr;                          // the head's vertical axis at the tip height (approx.)
      const inS = Lk.tipDir || (((axisX - b[0]) * pn[0] + 0 * pn[1]) >= 0 ? 1 : -1);
      const ph = Lk.scPh ?? (Lk.seed * 1.7), fq = Lk.scF ?? 1.0, amp = (Lk.sc || 0) * s, ti = (Lk.tipIn || 0) * s;
      c = c.map((p, i) => {
        const t = u[i]; const o = amp * sin(TAU * fq * t + ph) * sstep(0, 0.3, t) * (1 - 0.4 * t) + ti * inS * pow(sstep(0.62, 1, t), 1.6);
        return [p[0] + pn[0] * o, p[1] + pn[1] * o];
      });
    }
    let fore = 1;
    if (Lk.g === 'bang') { const q = Lk.P[Lk.P.length - 1]; fore = 0.5 + 0.5 * clamp(rotN(V, M.surfN(clamp(q[0], -0.3, 0.3), q[1]))[2]); }
    const u0 = Lk.lineFrom != null ? u[Math.min(n - 1, Lk.lineFrom * 5)] : 0.03;
    const wFull = Lk.lineFrom != null ? u0 + 0.07 : (Lk.wFull ?? 0.3);     // clumps lying on the scalp stay narrow until they leave it
    const wStart = Lk.lineFrom != null ? Math.max(0, u0 - 0.04) : 0;
    const bul = Lk.bulge || 0;
    const hw = u.map(t => s * lerp(Lk.w0, Lk.w, sstep(wStart, wFull, t)) * fore * (1 + bul * sin(PI * clamp(t / Math.max(0.2, Lk.tip)))) *
      (t < Lk.tip ? 1 : pow(max(0, 1 - (t - Lk.tip) / (1 - Lk.tip)), Lk.k)));
    const nv = c.map((p, i) => { const a = c[max(0, i - 1)], b = c[min(n - 1, i + 1)]; const t = nrm([b[0] - a[0], b[1] - a[1]]); return [-t[1], t[0]]; });
    const Lt = c.map((p, i) => [p[0] + nv[i][0] * hw[i], p[1] + nv[i][1] * hw[i]]), Rt = c.map((p, i) => [p[0] - nv[i][0] * hw[i], p[1] - nv[i][1] * hw[i]]);
    const polyP = Lt.concat(Rt.slice().reverse());
    // outlines: `fat` = silhouette ink (full width), `fatIn` = the thin line between overlapping clumps (no ink at the root)
    const lw = C.lwHair;
    const tE = nrm([c[n - 1][0] - c[n - 2][0], c[n - 1][1] - c[n - 2][1]]);
    const mkFat = (k) => {
      const ext = [c[n - 1][0] + tE[0] * lw * 1.6 * k, c[n - 1][1] + tE[1] * lw * 1.6 * k];
      const fw = u.map((t, i) => hw[i] + lw * k * sstep(u0, u0 + 0.12, t));
      return c.map((p, i) => [p[0] + nv[i][0] * fw[i], p[1] + nv[i][1] * fw[i]]).concat([ext]).concat(c.map((p, i) => [p[0] - nv[i][0] * fw[i], p[1] - nv[i][1] * fw[i]]).reverse());
    };
    const fat = mkFat(1), fatIn = mkFat(0.42);
    const mid = Math.floor(n * 0.5);
    const shadeSide = (nv[mid][0] * C.lightVec[0] + nv[mid][1] * C.lightVec[1]) > 0 ? -1 : 1;
    return { Lk, c, u, hw, nv, poly: polyP, fat, fatIn, z, shadeSide, u0 };
  }
  function ribbonAt(G, t, v) {
    const u = G.u; let lo = 0, hi = u.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (u[m] <= t) lo = m; else hi = m; }
    const k = (t - u[lo]) / ((u[hi] - u[lo]) || 1);
    const c = L2(G.c[lo], G.c[hi], k), n = L2(G.nv[lo], G.nv[hi], k), w = lerp(G.hw[lo], G.hw[hi], k);
    return [c[0] + n[0] * w * v, c[1] + n[1] * w * v];
  }
  const ROOTSH = { bang: 0.4, side: 0.0, back: 0.0, nape: 0.34, top: 0.3, tail: 0.18 };
  // simple = hidden / inner hair (inside of the curtain): ink + flat base + one shadow shape
  // thick silhouette ink of a whole group of clumps (drawn once, before the group): lines between overlapping clumps stay thin
  function drawBacking(ctx, list, col) {
    if (!list.length) return;
    ctx.beginPath(); for (const G of list) poly(ctx, ccw(G.fat)); ctx.fillStyle = col; ctx.fill();
  }
  function drawLock(ctx, C, G, cols, simple) {
    const Lk = G.Lk, s = C.V.s;
    if (!simple) fillPoly(ctx, G.fatIn || G.fat, Lk.inkCol || cols.lineIn || cols.line);
    const len = Math.hypot(G.c[G.c.length - 1][0] - G.c[0][0], G.c[G.c.length - 1][1] - G.c[0][1]);
    if (cols.tipT && C.lod > 0 && !simple && len > 0.45 * s) {
      const a = G.c[0], b = G.c[G.c.length - 1];
      const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, cols.base); g.addColorStop(0.45, cols.base); g.addColorStop(1, cols.tipT);
      fillPoly(ctx, G.poly, g);
    } else fillPoly(ctx, G.poly, cols.base);
    if (simple) { // the inner side of the curtain (front views): a flat dark fill + one thin separating line (the backing gives the silhouette)
      if (C.lod > 0) { const n = G.c.length, e = []; for (let i = 0; i < n; i += 2) e.push([G.c[i][0] + G.nv[i][0] * G.hw[i], G.c[i][1] + G.nv[i][1] * G.hw[i]]);
        ink(ctx, e, (u) => C.lwHair * 0.5 * sstep(0.08, 0.2, u) * sstep(1, 0.85, u), cols.line, false); }
      return;
    }
    if (C.lod === 0) return;
    // cel shadows in one path: root shadow (pointed toward the tip) + the side away from the light
    ctx.beginPath();
    const ur = (ROOTSH[Lk.g] ?? 0.2) * (Lk.rootK ?? 1);
    if (ur > 0.01 && !simple) {
      const rs = [];
      for (let k = 0; k <= 3; k++) rs.push(ribbonAt(G, ur * 0.55 * k / 3, 1));
      for (let k = 0; k <= 8; k++) { const v = 1 - 2 * k / 8; rs.push(ribbonAt(G, ur * (1 - 0.45 * abs(v)) * (1 + 0.12 * PV.rand1(k, Lk.seed)), v)); }
      for (let k = 3; k >= 0; k--) rs.push(ribbonAt(G, ur * 0.55 * k / 3, -1));
      poly(ctx, ccw(rs));
    }
    const sd = G.shadeSide, ua = Math.max(0.16, Lk.lineFrom != null ? G.u0 : 0), ss = [], si = [];
    for (let k = 0; k <= 12; k++) {
      const t = ua + (1 - ua) * k / 12; ss.push(ribbonAt(G, t, sd));
      si.push(ribbonAt(G, t, sd * (1 - (Lk.shadeK ?? 0.62) * pow(sin(PI * (t - ua) / (1 - ua)), 0.55))));
    }
    poly(ctx, ccw(ss.concat(si.reverse())));
    ctx.fillStyle = cols.shade; ctx.fill();
    if (simple) return;
    if (C.H && C.H.ring && C.lod > 0) { const R = clumpRing(C, C.H, G); if (R) fillPoly(ctx, R.poly, rgba(cols.hi, (C.who === 'boy' ? 0.55 : 0.8) * clamp(R.a + 0.2))); }
    if (C.lod > 1 && Lk.w > 0.025 && s >= 200) { // inner split line (big heads only)
      const ln = []; for (let k = 0; k <= 6; k++) ln.push(ribbonAt(G, 0.5 + 0.44 * k / 6, -0.2 * sd));
      ink(ctx, ln, (t) => C.lw * 0.32 * sin(PI * t), rgba(cols.line, 0.75));
    }
    if (C.wetHair && C.lod > 0) { // wet: thin sharp glints along the clump
      const gl = [], g0 = Math.max(0.12, (G.u0 || 0) + 0.04), sv = -sd * (0.25 + 0.25 * PV.rand1(3, Lk.seed));
      for (let k = 0; k <= 8; k++) gl.push(ribbonAt(G, g0 + (0.55 - g0 * 0.3) * k / 8, sv));
      ink(ctx, gl, (t) => C.lw * 0.42 * sin(PI * t), rgba(mixH(cols.hi, '#ffffff', 0.55), 0.75));
    }
    if (cols.gloss && (Lk.g === 'side' || Lk.g === 'back' || Lk.g === 'tail')) { // gloss on long hanging clumps
      const gl = [], gi = [];
      const g0 = Math.max(0.2, (G.u0 || 0) + 0.02);
      for (let k = 0; k <= 6; k++) { const t = g0 + 0.14 * k / 6; gl.push(ribbonAt(G, t, -sd * 0.55)); gi.push(ribbonAt(G, t, -sd * (0.55 - 0.45 * sin(PI * k / 6)))); }
      fillPoly(ctx, gl.concat(gi.reverse()), rgba(cols.gloss, 0.55));
    }
  }

  // angel ring: zig-zag band around the visible part of the head at ringY
  // angel ring on the cap: a tilted band (lower at the front, higher at the back) broken into irregular pieces,
  // each with its own small offset and uneven teeth on the lower edge (real 作画 breaks it per clump)
  function ringBand(C, H) {
    const { M, V } = C; const yR = H.ringY, th = (H.capTh.top + H.capTh.side) * 0.5;
    const S = [];
    let i = 0;
    for (let t = -180; t < 180; t += 3, i++) {
      const yc = yR + 0.06 * cos(t * D2R);
      const p = M.shell(t, yc, th); const nz = shellNz(V, p);
      S.push({ t, yc, nz, ok: nz > 0.06 });
    }
    const run = visRun(S.map(q => q.ok)); if (run.length < 2) return null;
    const pieces = []; let k = 0, piece = 0;
    const dull = H.wet ? 0.7 : 1, wk = H.ringK ?? 1;
    while (k < run.length) {
      const len = 6 + Math.floor(PV.rand1(piece, 11) * 5), jit = (PV.rand1(piece, 12) - 0.5) * 0.012;
      const ids = run.slice(k, k + len); k += len + (PV.rand1(piece, 13) < 0.55 ? 1 : 0); piece++;
      if (ids.length < 2) continue;
      const top = [], bot = [];
      ids.forEach((j, q) => {
        const sm = S[j], amp = sstep(0.06, 0.5, sm.nz) * wk * dull;
        const end = Math.min(q, ids.length - 1 - q) === 0 ? 0.35 : 1;               // pieces taper at their ends
        const r1 = PV.rand1(j, 5), r2 = PV.rand1(j * 7 + piece, 6);
        const tooth = (q % 2 === 0) ? 0.01 + 0.03 * r2 : 0.002 + 0.006 * r2;
        top.push(proj(V, M.shell(sm.t, sm.yc + jit - (0.006 + 0.004 * r1) * amp * end, th + 0.002)));
        bot.push(proj(V, M.shell(sm.t, sm.yc + jit + (0.004 + tooth) * amp * end, th + 0.002)));
      });
      pieces.push(top.concat(bot.reverse()));
    }
    return pieces;
  }
  // angel ring across one clump: a short band in the clump's own (t, v) frame, smooth upper edge, uneven teeth below
  function clumpRing(C, H, G) {
    const Lk = G.Lk, P = Lk.P; if (G.u.length < 6) return null;
    let tr = null, nz = 0;
    for (let k = 0; k < P.length - 1 && tr == null; k++) {
      const a = P[k], b = P[k + 1];
      const th = Math.atan2(lerp(a[0], b[0], 0.5), lerp(a[2], b[2], 0.5) + 0.07) / D2R, yc = H.ringY + 0.06 * cos(th * D2R) + (H.ringDrop || 0);
      if ((a[1] - yc) * (b[1] - yc) <= 0 && abs(b[1] - a[1]) > 1e-4) {
        const f = (yc - a[1]) / (b[1] - a[1]); const idx = Math.min(G.u.length - 1, Math.round((k + f) * 5));
        tr = G.u[idx]; nz = shellNz(C.V, [lerp(a[0], b[0], f), yc, lerp(a[2], b[2], f)]);
      }
    }
    if (tr == null || nz < 0.05) return null;
    const lenPx = Math.hypot(G.c[G.c.length - 1][0] - G.c[0][0], G.c[G.c.length - 1][1] - G.c[0][1]) + 1;
    const s = C.V.s, dt = (0.022 * s) / lenPx, sd = Lk.seed * 3 + 1, amp = sstep(0.05, 0.4, nz) * (H.wet ? 0.7 : 1) * (H.ringK ?? 1);
    const jit = (PV.rand1(sd, 21) - 0.5) * dt * 1.4;
    const vs = [-0.92, -0.62, -0.3, 0.02, 0.34, 0.64, 0.92], top = [], bot = [];
    vs.forEach((v, q) => {
      const r = PV.rand1(sd + q, 22), tooth = q % 2 === 0 ? 0.9 + 1.3 * r : 0.15 + 0.35 * r;
      top.push(ribbonAt(G, clamp(tr + jit - dt * 0.55 * amp * (1 - 0.35 * v * v), 0, 1), v));
      bot.push(ribbonAt(G, clamp(tr + jit + dt * tooth * amp, 0, 1), v * 0.96));
    });
    return { poly: top.concat(bot.reverse()), a: amp };
  }

  // flow lines on the cap (thin strokes converging to the parting / crown / bun)
  function capLines(ctx, C, H, col) {
    const { M, V } = C; if (C.lod < 2) return;
    let cen;
    if (H.flow === 'part') cen = shX(M, H.part, -0.975, H.capTh.top * 0.6);
    else if (H.flow === 'crown') cen = M.shell(175, -0.9, H.capTh.top * 0.6);
    else if (H.bun) cen = H.bun.c; else cen = M.shell(180, -0.33, H.capTh.back * 0.6);
    const cr = Math.hypot(cen[0] - SHELLC[0], cen[1] - SHELLC[1], cen[2] - SHELLC[2]);
    for (let t = -165; t <= 165; t += 15) {
      const end = M.shell(t, H.hairline(t) - 0.035, H.capTh.side * 0.55);
      const er = Math.hypot(end[0] - SHELLC[0], end[1] - SHELLC[1], end[2] - SHELLC[2]);
      const pts = [], vis = [];
      for (let k = 0; k <= 10; k++) {
        const f = k / 10, q = [lerp(cen[0], end[0], f), lerp(cen[1], end[1], f), lerp(cen[2], end[2], f)];
        const d = [q[0] - SHELLC[0], q[1] - SHELLC[1], q[2] - SHELLC[2]], l = Math.hypot(d[0], d[1], d[2]) || 1, r = lerp(cr, er, f);
        const p = [SHELLC[0] + d[0] / l * r, SHELLC[1] + d[1] / l * r, SHELLC[2] + d[2] / l * r];
        pts.push(proj(V, p)); vis.push(shellNz(V, p));
      }
      const a = 3 + (Math.abs(t) % 2), b = 8;
      if (vis[a] < 0.15 || vis[b] < 0.15) continue;
      ink(ctx, pts.slice(a, b + 1), (u) => C.lw * 0.34 * sin(PI * u), rgba(col, 0.5));
    }
  }

  function drawCap(ctx, C, H, cols) {
    if (!H.reg) return;
    const cap = H.cap;
    ctx.save(); ctx.beginPath(); poly(ctx, H.reg.region); ctx.clip();
    // outline: line weight follows the light (thin where the light hits the crown, heavier on the shadow side)
    if (cap.off && cap.off.length > 2) {
      const O = cap.off, lv = C.lightVec, n = O.length, sg = area(cap) > 0 ? 1 : -1;
      const wd = O.map((p, i) => { const a = O[max(0, i - 1)], b = O[min(n - 1, i + 1)], t = nrm([b[0] - a[0], b[1] - a[1]]); const nx = sg > 0 ? t[1] : -t[1], ny = sg > 0 ? -t[0] : t[0];
        const sh = clamp(0.5 - 0.5 * (nx * lv[0] + ny * lv[1])); return C.lwHair * (0.55 + 1.15 * sh); });
      inkVar(ctx, O.map((p, i) => { const a = O[max(0, i - 1)], b = O[min(n - 1, i + 1)], t = nrm([b[0] - a[0], b[1] - a[1]]); const nx = sg > 0 ? t[1] : -t[1], ny = sg > 0 ? -t[0] : t[0]; return [p[0] + nx * wd[i] * 0.4, p[1] + ny * wd[i] * 0.4]; }), wd, cols.line);
    } else { ctx.beginPath(); poly(ctx, cap); ctx.lineWidth = C.lwHair * 2; ctx.lineJoin = 'round'; ctx.strokeStyle = cols.line; ctx.stroke(); }
    ctx.beginPath(); poly(ctx, cap); ctx.fillStyle = cols.base; ctx.fill();
    ctx.save(); ctx.beginPath(); poly(ctx, cap); ctx.clip();
    // cel shadow on the side away from the light + under-band near the hairline
    const d = 0.1 * C.V.s, lv = C.lightVec;
    ctx.beginPath(); poly(ctx, cap.map(p => [p[0] + lv[0] * d, p[1] + lv[1] * d])); ctx.rect(-1e5, -1e5, 2e5, 2e5); ctx.fillStyle = cols.shade; ctx.fill('evenodd');
    if (H.reg.arc.length > 1) {
      const up = [C.V.sr, -C.V.cr], k = 0.07 * C.V.s;
      const band = H.reg.arc.map((p, i) => [p[0] + up[0] * k * (0.6 + 0.4 * PV.rand1(i, 3)), p[1] + up[1] * k * (0.6 + 0.4 * PV.rand1(i, 3))]).concat(H.reg.arc.slice().reverse().map(p => [p[0] - up[0] * k, p[1] - up[1] * k]));
      fillPoly(ctx, band, cols.shade);
    }
    capLines(ctx, C, H, cols.line);
    if (H.ring) { ctx.beginPath(); for (const pc of H.ring) poly(ctx, pc); ctx.fillStyle = rgba(cols.hi, 0.8); ctx.fill(); }
    ctx.restore(); ctx.restore();
    // hairline edge
    if (H.reg.arc.length > 2) ink(ctx, H.reg.arc, (u) => C.lwHair * 0.5 * sin(PI * u), rgba(cols.line, 0.8));
  }

  function drawBun(ctx, C, H, cols) {
    const B = H.bun, { V } = C, s = V.s;
    const c = proj(V, B.c), a = V.ang;
    const rx = s * Math.hypot(B.r[0] * cos(a), B.r[2] * sin(a)), ry = s * B.r[1];
    const pts = []; for (let k = 0; k < 28; k++) { const t = k / 28 * TAU; const r = 1 + 0.035 * sin(t * 6 + 1) + B.loose * 0.06 * sin(t * 3 + 2); pts.push([c[0] + (rx * cos(t) * V.cr - ry * sin(t) * V.sr) * r, c[1] + (rx * cos(t) * V.sr + ry * sin(t) * V.cr) * r]); }
    ctx.beginPath(); poly(ctx, pts); ctx.lineWidth = C.lwHair * 2; ctx.lineJoin = 'round'; ctx.strokeStyle = cols.line; ctx.stroke(); ctx.fillStyle = cols.base; ctx.fill();
    H.bunPts = offsetPoly(pts, C.lwHair);
    ctx.save(); ctx.clip();
    const lv = C.lightVec;
    ctx.beginPath(); poly(ctx, pts.map(p => [p[0] + lv[0] * rx * 0.45, p[1] + lv[1] * ry * 0.45])); ctx.rect(-1e5, -1e5, 2e5, 2e5); ctx.fillStyle = cols.shade; ctx.fill('evenodd');
    // swirl clumps
    for (let k = 0; k < 3; k++) {
      const sw = []; for (let j = 0; j <= 12; j++) { const t = -0.4 + k * 2.1 + j / 12 * 2.4; const r = 0.92 - j / 12 * 0.5; sw.push([c[0] + rx * r * cos(t), c[1] + ry * r * sin(t)]); }
      ink(ctx, sw, (u) => C.lw * 0.42 * sin(PI * u), rgba(cols.line, 0.85));
    }
    if (V.facing < 0.3) { // highlight arc
      const hl = []; for (let j = 0; j <= 10; j++) { const t = -2.3 + j / 10 * 1.4; hl.push([c[0] + rx * 0.62 * cos(t), c[1] + ry * 0.62 * sin(t)]); }
      ink(ctx, hl, (u) => ry * 0.16 * sin(PI * u), rgba(cols.hi, 0.75));
    }
    ctx.restore();
  }

  /* ================================================================== rim light (crisp band on the light side) */
  /* raster rim: one continuous crisp band inside the union silhouette on the light side (anime backlight).
     band = union mask minus the same mask shifted toward the light; then kept only on this layer's own shapes.
     Width thins naturally where the contour turns away from the light. Drawn in device pixels (camera-safe). */
  const RIMBUF = {};
  function rimBuf(key, w, h) {
    let B = RIMBUF[key];
    if (!B || B.canvas.width < w || B.canvas.height < h) {
      const c = document.createElement('canvas'); c.width = Math.ceil(Math.max(w, B ? B.canvas.width : 0) / 64) * 64; c.height = Math.ceil(Math.max(h, B ? B.canvas.height : 0) / 64) * 64;
      B = RIMBUF[key] = { canvas: c, ctx: c.getContext('2d', { willReadFrequently: true }) };   // CPU-backed: cheap small fills/copies
    }
    const b = B.ctx; b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
    return B;
  }
  function rimRaster(ctx, C, union, keep) {
    const R = C.rimA; if (R <= 0.01 || !union.length || !keep.length) return;
    const lv = C.rimVec || C.lightVec;
    const PP = (x) => (Array.isArray(x) ? x : x.P);
    const T = ctx.getTransform(), sc0 = Math.hypot(T.a, T.b) || 1;
    const bb = bbox(keep.map(PP)), pad = 4 + C.rimW * 2;
    const cx = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]].map(p => [T.a * p[0] + T.c * p[1] + T.e, T.b * p[0] + T.d * p[1] + T.f]);
    let X0 = Math.floor(Math.min(...cx.map(p => p[0])) - pad), Y0 = Math.floor(Math.min(...cx.map(p => p[1])) - pad);
    let X1 = Math.ceil(Math.max(...cx.map(p => p[0])) + pad), Y1 = Math.ceil(Math.max(...cx.map(p => p[1])) + pad);
    const cv = ctx.canvas; X0 = Math.max(X0, -64); Y0 = Math.max(Y0, -64); X1 = Math.min(X1, cv.width + 64); Y1 = Math.min(Y1, cv.height + 64);
    if (X1 - X0 < 4 || Y1 - Y0 < 4) return;
    // the mask is computed at a reduced resolution (k): the band is a few px wide, the upscale keeps it smooth
    const k = Math.min(1, Math.max(0.42, (C.rimRes || 1) * Math.sqrt(110000 / ((X1 - X0) * (Y1 - Y0)))));
    const w = Math.ceil((X1 - X0) * k), h = Math.ceil((Y1 - Y0) * k);
    const A1 = rimBuf('rimA', w + 2, h + 2), a = A1.ctx;
    a.clearRect(0, 0, w + 2, h + 2);
    const setT = (c, ox = 0, oy = 0) => c.setTransform(T.a * k, T.b * k, T.c * k, T.d * k, (T.e - X0) * k + ox, (T.f - Y0) * k + oy);
    const fillItems = (c, items) => {
      c.beginPath(); for (const it of items) if (Array.isArray(it) || !it.clip) poly(c, ccw(PP(it))); c.fill();
      for (const it of items) if (!Array.isArray(it) && it.clip) { c.save(); c.beginPath(); poly(c, it.clip); c.clip(); c.beginPath(); poly(c, it.P); c.fill(); c.restore(); }
    };
    setT(a); a.fillStyle = C.rimCol; fillItems(a, union);
    const d = C.rimW * sc0 * k, dx = lv[0] * d, dy = lv[1] * d;
    // keep pixels whose neighbour toward the light is outside the union: subtract the union shifted away from the light
    a.globalCompositeOperation = 'destination-out'; setT(a, -dx, -dy); fillItems(a, union);
    a.globalCompositeOperation = 'source-over'; a.setTransform(1, 0, 0, 1, 0, 0);
    // composite, only over this layer's own shapes (clip in user space)
    ctx.save(); ctx.beginPath(); for (const it of keep) poly(ctx, ccw(PP(it))); ctx.clip();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= clamp(R); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(A1.canvas, 0, 0, w, h, X0, Y0, w / k, h / k); ctx.restore();
  }

  /* ================================================================== expressions */
  // eyes: open (0..1.25), smile (lower lid up), focus (sharp, flatter upper lid), sad (outer lid droops), wide, squeeze,
  //       closed: 'down' (serene) | 'up' (happy ^^), shine (0 = no highlights), dull (flat iris), tears, pupil, look [x,y]
  // brows: inner / outer (-1..1, + raises), furrow (0..1)   mouth: shape + open   blush 0..1   noBlink
  A.EXPR = {
    neutral: { eyes: { open: 1 }, brows: { inner: 0, outer: 0 }, mouth: { shape: 'flat', open: 0 }, blush: 0.12 },
    smile: { eyes: { open: 0.9, smile: 0.52, hlK: 1.15 }, brows: { inner: 0.25, outer: 0.1 }, mouth: { shape: 'smile', open: 0.38 }, blush: 0.36 },
    gentle: { eyes: { open: 0.8, smile: 0.28 }, brows: { inner: 0.3, outer: -0.05 }, mouth: { shape: 'smile', open: 0 }, blush: 0.24 },
    closed: { eyes: { open: 0, closed: 'down', smile: 0.2 }, brows: { inner: 0.15, outer: 0 }, mouth: { shape: 'smile', open: 0 }, blush: 0.18, noBlink: true },
    teary: { eyes: { open: 0.96, tears: 0.55, sad: 0.3, squeeze: 0.08 }, brows: { inner: 0.75, outer: -0.2, furrow: 0.2 }, mouth: { shape: 'frown', open: 0.12 }, blush: 0.38 },
    cry: { eyes: { open: 0.42, tears: 1, sad: 0.65, squeeze: 0.6 }, brows: { inner: 1, outer: -0.4, furrow: 0.85 }, mouth: { shape: 'frown', open: 0.85 }, blush: 0.62, noBlink: true },
    shout: { eyes: { open: 1.15, wide: 0.75, focus: 0.08, pupil: 0.72 }, brows: { inner: -0.85, outer: 0.35, furrow: 1 }, mouth: { shape: 'shout', open: 1 }, blush: 0.34, noBlink: true },
    surprise: { eyes: { open: 1.2, wide: 1, pupil: 0.7 }, brows: { inner: 0.9, outer: 0.8 }, mouth: { shape: 'o', open: 0.45 }, blush: 0.12, noBlink: true },
    sad: { eyes: { open: 0.72, sad: 0.65, look: [0, 0.4] }, brows: { inner: 0.7, outer: -0.22 }, mouth: { shape: 'frown', open: 0 }, blush: 0.12 },
    empty: { eyes: { open: 0.84, shine: 0, dull: 1, undereye: 0.45 }, brows: { inner: 0.04, outer: -0.1 }, mouth: { shape: 'flat', open: 0 }, blush: 0, noBlink: true },
    determined: { eyes: { open: 1.0, focus: 0.5, hlK: 1.1 }, brows: { inner: -0.65, outer: 0.22, furrow: 0.4 }, mouth: { shape: 'flat', open: 0 }, blush: 0.1 },
    pain: { eyes: { open: 0.48, squeeze: 0.55, sad: 0.4 }, brows: { inner: 0.9, outer: -0.3, furrow: 1 }, mouth: { shape: 'i', open: 0.4 }, blush: 0.22 },
    sleep: { eyes: { open: 0, closed: 'down' }, brows: { inner: 0.05, outer: -0.05 }, mouth: { shape: 'flat', open: 0.0 }, blush: 0.15, noBlink: true },
    focus: { eyes: { open: 0.86, focus: 1 }, brows: { inner: -0.45, outer: 0.05, furrow: 0.45 }, mouth: { shape: 'flat', open: 0 }, blush: 0.05 },
  };
  // character defaults under every preset (叔母: calm, see-through gaze) and per-character takes on a preset
  // (彼's resolve shows the whole iris with one clear highlight; his laugh closes the eyes into crescents)
  const CHAR_EYES = { aunt: { shine: 0.8 } };
  const CHAR_EXPR = {
    boy: {
      determined: { eyes: { open: 1.2, wide: 0.55, focus: 0.35 } },
      smile: { eyes: { open: 0, closed: 'up', smile: 0.4 }, mouth: { shape: 'smile', open: 0.5 }, blush: 0.25 },
      shout: { eyes: { open: 1.2, wide: 0.9 } },
      surprise: { eyes: { open: 1.25, wide: 1.1 } },
      // losing the light in the eyes is her sign only: his tired / blank face keeps one small highlight (design 3-3)
      empty: { eyes: { open: 0.8, shine: 0.75, dull: 0.35, undereye: 0.3 } },
    },
    aunt: {
      neutral: { eyes: { open: 0.95 } },
      // the probing gaze (L639, L5137): the whole iris, one small highlight
      focus: { eyes: { open: 1.15, wide: 0.45, focus: 0.3 } }, determined: { eyes: { open: 1.15, wide: 0.45, focus: 0.3 } },
    },
  };
  function exprOf(o) {
    const P = A.EXPR[o.expr] || A.EXPR.neutral, X = (CHAR_EXPR[o.who] || {})[o.expr || 'neutral'] || {};
    return {
      eyes: Object.assign({ look: [0, 0] }, CHAR_EYES[o.who] || {}, P.eyes, X.eyes || {}, o.undereye != null ? { undereye: o.undereye } : {}, o.eyes || {}),
      brows: Object.assign({}, P.brows, X.brows || {}, o.brows || {}),
      mouth: Object.assign({}, P.mouth, X.mouth || {}, o.mouth || {}), blush: o.blush ?? X.blush ?? P.blush ?? 0, noBlink: P.noBlink || o.noBlink,
    };
  }

  /* ================================================================== call state */
  function mulColor(base, shade) { const a = A.rgb(base), b = A.rgb(shade); return A.hex(a.map((v, i) => Math.min(255, 255 * b[i] / Math.max(1, v)))); }
  function makeCall(o) {
    const who = MODEL_DEF[o.who] ? o.who : 'senpai';
    const M = model(who), V = makeView(o, M), s = V.s, m = mats(o, who);
    const T = o.T || 0, Tq = A.onTwos(T), seed = o.seed ?? (who === 'boy' ? 7 : who === 'aunt' ? 13 : 3);
    const E = exprOf(o);
    if (!E.noBlink && (E.eyes.open ?? 1) > 0.3) E.eyes.open = (E.eyes.open ?? 1) * A.blink(T + (o.blinkOffset || 0), seed);
    if (o.talk) {
      const mo = A.mouth(T, who);
      if (mo.open > 0) { E.mouth.open = Math.max(E.mouth.open || 0, mo.open * (E.mouth.shape === 'shout' ? 1 : 0.8)); }
      else if (E.mouth.shape !== 'shout') E.mouth.open = Math.min(E.mouth.open || 0, 0.0);
    }
    const ld = o.lightDir ?? o.rimDir ?? -2.25;
    const hs = o.hair || {}, wd = hs.windDir ?? 0;
    const C = {
      o, who, M, V, m, T, Tq, seed, lod: s < 58 ? 0 : s < 120 ? 1 : 2,
      lw: A.inkW(s) * (o.line ?? 1), eyeE: E.eyes, browE: E.brows, mouthE: E.mouth, blush: E.blush,
      lightVec: [cos(ld), sin(ld)], wind: hs.wind || 0, windVec: [cos(wd), sin(wd)], still: !!hs.still,
      rimA: (m.L.rimA || 0) * (o.rim ?? 1), rimCol: m.L.rim || "#ffffff", rimW: clamp(0.012 * s, 1.4, 8) * (o.rimW ?? 1),
      shadeD: o.shade ?? (m.L.rimA > 0.6 ? 0.035 : 0.06),
    };
    if (o.rimDir != null) C.rimVec = [cos(o.rimDir), sin(o.rimDir)];
    C.lwHair = C.lw * 0.9; C.wetHair = (o.hair && o.hair.style === 'wet');
    C.hlSide = C.lightVec[0] >= 0 ? 1 : -1;
    C.lashCol = mixH(m.hair.line, m.skin.line, 0.15); C.lowCol = mixH(m.skin.line, m.hair.line, 0.5);
    C.browCol = mixH(m.hair.base, m.hair.line, 0.45); C.skinLine = m.skin.line; C.mulShade = mulColor(m.skin.base, m.skin.shade);
    C.eyeD = eyeDef(who);
    C.sil = silhouette(V, M);
    C.eyeFL = eyeFrame(C, -1); C.eyeFR = eyeFrame(C, 1);
    return C;
  }

  function prepareHair(C) {
    const hs = C.o.hair || {}; const V = C.V;
    const H = hairStyle(C.M, C.who, hs.style); C.H = H;
    H.reg = hairRegion(C, H); H.cap = capPoly(C, H); H.ring = C.lod > 0 ? ringBand(C, H) : null;
    const mh = C.m.hair;
    H.cols = { base: mixH(mh.base, mh.hi, 0.1), shade: mixH(mh.shade, mh.deep, 0.15), deep: mh.deep, hi: mixH(mh.hi, '#ffffff', 0.12), line: mh.line, gloss: mh.hi, tipT: mixH(mh.base, mh.hi, 0.3) };
    H.colsIn = { base: mixH(mh.shade, mh.deep, 0.3), shade: mh.deep, deep: mh.deep, hi: mh.shade, line: mh.line, gloss: null, tipT: mixH(mh.shade, mh.base, 0.4) };
    H.back = []; H.front = []; H.behind = [];
    for (const Lk of H.locks) {
      let layer;
      if (Lk.g === 'back' || Lk.g === 'tail') layer = V.facing > 0.3 ? 'back' : 'front';
      else if (Lk.g === 'side') {
        layer = shellNz(V, Lk.P[0]) > -0.25 ? 'front' : 'back';
        // 3/4: a side lock on the far side hangs beyond the far cheek -> behind the face (the face contour reads against it)
        const sa = sin(V.ang);
        if (layer === 'front' && V.facing > 0.2 && Lk.P[0][0] * sa > 0 && abs(sa) > 0.2) layer = 'behind';
      }
      else if (Lk.g === 'bang') { if (V.facing < -0.35) continue; layer = 'front'; }
      else if (Lk.g === 'nape') layer = V.facing > 0.25 ? 'back' : 'front';
      else layer = 'front';
      if (Lk.g === 'back') { Lk.free = 4; Lk.lineFrom = 3; }
      let L2k = Lk;
      // toward profile, the near face-framing locks swing back beside the cheek: they never cover the eye / profile line
      const saV = sin(V.ang), prof = sstep(0.45, 0.92, abs(saV));
      if (Lk.g === 'side' && prof > 0 && V.facing > -0.2 && Lk.P[Lk.P.length - 1][0] * saV < 0) {
        const pb = (Lk.cheek ? 0.15 : 0.1) * prof;
        L2k = Object.assign({}, Lk, { P: Lk.P.map((p, i) => (i === 0 ? p : [p[0], p[1], p[2] - pb * sstep(-0.75, -0.45, p[1]) * (p[2] > 0.02 ? 1 : 0.3)])) });
      }
      if (Lk.g === 'side' && layer === 'front' && V.facing < -0.05) { // seen from behind: root starts up under the cap
        const r0 = Lk.P[0], th0 = Math.atan2(r0[0], r0[2] + 0.07) / D2R;
        L2k = Object.assign({}, Lk, { P: [C.M.shell(th0 * 0.85, -0.9, 0.0)].concat(Lk.P), w0: Lk.w0 * 0.6, free: 2 });
      }
      (layer === 'back' ? H.back : layer === 'behind' ? H.behind : H.front).push(lockGeo(C, L2k));
    }
    H.back.sort((a, b) => a.z - b.z); H.front.sort((a, b) => a.z - b.z); H.behind.sort((a, b) => a.z - b.z);
    H.bunLayer = H.bun ? (V.facing > 0.3 ? 'back' : 'front') : null;
    return H;
  }

  /* ================================================================== hat (summer: wide white brim, navy band) */
  function hatGeo(C) {
    const { V } = C; const yb = -0.8, zc = -0.04, R = 0.9, Rc = 0.47, hc = 0.27, tilt = -0.22;
    // brim ring tilted about x (front edge up), drooping at the edge
    const ring = (r, droop) => { const P = [], Z = []; for (let k = 0; k < 48; k++) { const a = k / 48 * TAU, x = r * sin(a), z = r * cos(a);
      const y = yb + droop, yy = y + z * sin(tilt) * 0.6, zz = zc + z; const p = [x, yy, zz]; P.push(proj(V, p)); Z.push(rot(V, p)[2]); } return { P, Z }; };
    const outer = ring(R, 0.11), inner = ring(Rc * 1.02, 0.0);
    const dome = [];
    for (let k = 0; k <= 18; k++) { const a = k / 18 * PI; dome.push(proj(V, [-Rc * cos(a), yb - hc * sin(a) * 0.95, zc + 0.0])); }
    return { outer, inner, dome, zc: rot(V, [0, yb, zc])[2], yb, zc0: zc, R, Rc, hc };
  }
  function drawHatBack(ctx, C, cols) {
    const G = C.hat; if (!G) return;
    ctx.beginPath(); poly(ctx, smooth(G.outer.P, true, 3)); ctx.lineWidth = C.lw * 1.6; ctx.lineJoin = 'round'; ctx.strokeStyle = cols.line; ctx.stroke();
    ctx.fillStyle = cols.shade; ctx.fill();
  }
  function drawHatFront(ctx, C, cols, band) {
    const G = C.hat; if (!G) return; const { V } = C; const s = V.s;
    // shadow of the brim over the face and hair
    ctx.save(); ctx.beginPath(); poly(ctx, C.sil.poly); ctx.clip(); ctx.globalCompositeOperation = 'multiply';
    ctx.beginPath(); poly(ctx, G.outer.P.map(p => [p[0], p[1] + 0.3 * s])); ctx.rect(-1e5, -1e5, 2e5, 1e5 - 0); ctx.fillStyle = C.mulShade; ctx.fill('evenodd'); ctx.restore();
    // front half of the brim: top surface + the underside band at the rim
    const idx = visRun(G.outer.Z.map(z => z >= G.zc - 0.02));
    if (idx.length > 2) {
      const o = idx.map(k => G.outer.P[k]), i = idx.map(k => G.inner.P[k]);
      const shape = smooth(o, false, 3).concat(smooth(i.slice().reverse(), false, 3));
      ctx.beginPath(); poly(ctx, shape); ctx.lineWidth = C.lw * 1.6; ctx.lineJoin = 'round'; ctx.strokeStyle = cols.line; ctx.stroke(); ctx.fillStyle = cols.base; ctx.fill();
      ctx.save(); ctx.clip();
      const lv = C.lightVec, d = 0.12 * s;
      ctx.beginPath(); poly(ctx, shape.map(p => [p[0] + lv[0] * d, p[1] + lv[1] * d])); ctx.rect(-1e5, -1e5, 2e5, 2e5); ctx.fillStyle = cols.shade; ctx.fill('evenodd');
      ctx.restore();
    }
    // crown + navy band
    const dome = smooth(G.dome, false, 3);
    const base0 = proj(V, [G.Rc, G.yb + 0.012, G.zc0]), base1 = proj(V, [-G.Rc, G.yb + 0.012, G.zc0]);
    const shape = dome.concat([base0, base1]);
    ctx.beginPath(); poly(ctx, shape); ctx.lineWidth = C.lw * 1.6; ctx.strokeStyle = cols.line; ctx.stroke(); ctx.fillStyle = cols.base; ctx.fill();
    ctx.save(); ctx.clip();
    const lv = C.lightVec, d = 0.14 * s;
    ctx.beginPath(); poly(ctx, shape.map(p => [p[0] + lv[0] * d, p[1] + lv[1] * d])); ctx.rect(-1e5, -1e5, 2e5, 2e5); ctx.fillStyle = cols.shade; ctx.fill('evenodd');
    const b0 = proj(V, [-G.Rc * 1.05, G.yb - 0.08, G.zc0]), b1 = proj(V, [G.Rc * 1.05, G.yb - 0.08, G.zc0]);
    fillPoly(ctx, [b0, b1, base0, base1], band.base);
    ctx.restore();
  }

  /* ================================================================== layers */
  function bangShadow(ctx, C, H) {
    const list = H.front.filter(G => G.Lk.g === 'bang' || (G.Lk.g === 'side' && shellNz(C.V, G.Lk.P[0]) > 0.1)); if (!list.length) return;
    const lv = C.lightVec, s = C.V.s, dx = -lv[0] * 0.02 * s, dy = (0.03 - lv[1] * 0.01) * s;
    ctx.save(); ctx.beginPath(); poly(ctx, C.sil.poly); ctx.clip();
    if (H.reg) { ctx.beginPath(); poly(ctx, H.reg.region); ctx.rect(-1e5, -1e5, 2e5, 2e5); ctx.clip('evenodd'); }
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = C.mulShade;
    ctx.beginPath(); for (const G of list) poly(ctx, ccw(G.poly.map(p => [p[0] + dx, p[1] + dy]))); ctx.fill();
    ctx.restore();
  }
  function drawFeatures(ctx, C) {
    if (C.blush > 0.02) drawBlush(ctx, C, C.blush);
    drawNose(ctx, C); drawMouth(ctx, C);
    ctx.save(); ctx.beginPath(); poly(ctx, C.sil.poly); ctx.clip();
    drawEye(ctx, C, C.eyeFL); drawEye(ctx, C, C.eyeFR);
    drawBrows(ctx, C, 1);
    const ts = clamp(((C.eyeE.tears || 0) - 0.5) / 0.5);
    if (ts > 0.01) drawTearStreams(ctx, C, ts);
    ctx.restore();
  }
  // union of everything the front layer covers, including the ink (for rim masks)
  // polygons standing for the front layer in rim masks (face, visible cap, front clumps; ink included)
  function frontMask(C, H) {
    if (!H.silInk) {
      H.silInk = offsetPoly(C.sil.poly, C.lw * 0.45); H.capInk = H.cap.length ? offsetPoly(H.cap, C.lwHair) : [];
      // face edges that can catch a rim: skin below the hairline only
      H.silOk = C.sil.poly.map(p => { const th = Math.atan2(p.f[0], p.f[2] + 0.07) / D2R; return p.f[1] > H.hairline(th) + 0.03; });
      H.capVis = (H.capInk.length && H.reg) ? { P: H.capInk, clip: H.reg.region } : null;
    }
    return [H.silInk].concat(H.capVis ? [H.capVis] : [], H.front.map(G => G.fat), H.behind.map(G => G.fat));
  }
  function drawBackLayer(ctx, C, H, noRim) {
    const inside = C.V.facing > 0.35;
    drawBacking(ctx, H.back, H.cols.line);
    for (const G of H.back) { const inn = inside && (G.Lk.g === 'back' || G.Lk.g === 'tail' || G.Lk.g === 'side'); drawLock(ctx, C, G, inn ? H.colsIn : H.cols, inn); }
    if (H.bunLayer === 'back') drawBun(ctx, C, H, H.cols);
    if (!noRim && C.rimA > 0.01 && H.back.length) { const bk = H.back.map(G => G.fat).concat(H.bunLayer === 'back' && H.bunPts ? [H.bunPts] : []); rimRaster(ctx, C, bk, bk); }
  }
  function drawFrontLayer(ctx, C, H, withBack) {
    const { V, M } = C;
    const hatCols = C.hat ? { base: A.mat('hat', C.m.lightName).base, shade: A.mat('hat', C.m.lightName).shade, line: A.mat('hat', C.m.lightName).line } : null;
    if (C.hat) drawHatBack(ctx, C, hatCols);
    const earNz = [-1, 1].map(s => rotN(V, earPts(M, s).n)[2]);
    if (H.ears) [-1, 1].forEach((s, i) => { if (earNz[i] <= 0.25 && earNz[i] > -0.75) drawEar(ctx, C, s); });
    if (H.behind.length) { drawBacking(ctx, H.behind, H.cols.line); for (const G of H.behind) drawLock(ctx, C, G, H.cols); }
    drawFaceSkin(ctx, C);
    if (H.ears) [-1, 1].forEach((s, i) => { if (earNz[i] > 0.25) drawEar(ctx, C, s); });
    if (V.facing > -0.2) drawFeatures(ctx, C);
    drawFaceLine(ctx, C);
    // seen from behind, the side locks hang on the far side of the skull: under the cap
    const under = V.facing < -0.05 ? H.front.filter(G => G.Lk.g === 'side') : [];
    for (const G of under) drawLock(ctx, C, G, H.cols);
    drawBacking(ctx, H.front.filter(G => !under.includes(G)), H.cols.line);
    drawCap(ctx, C, H, H.cols);
    if (V.facing > -0.3) bangShadow(ctx, C, H);
    if (H.bunLayer === 'front') drawBun(ctx, C, H, H.cols);
    for (const G of H.front) if (!under.includes(G)) drawLock(ctx, C, G, H.cols);

    if (V.facing > 0.25) { // eyes and brows drawn through the bangs (anime convention)
      ctx.save(); ctx.beginPath(); poly(ctx, C.sil.poly); ctx.clip();
      drawBrows(ctx, C, C.who === 'boy' ? 0.62 : 0.78);
      ctx.globalAlpha *= C.V.s < 110 ? lerp(1, C.who === 'boy' ? 0.8 : 0.66, clamp((C.V.s - 50) / 60)) : C.who === 'boy' ? 0.8 : 0.66; drawEye(ctx, C, C.eyeFL); drawEye(ctx, C, C.eyeFR);
      ctx.restore();
    }
    if (C.hat) drawHatFront(ctx, C, hatCols, A.mat('hatband', C.m.lightName));
    if (C.rimA > 0.01) {
      const fm = frontMask(C, H), bm = H.back.map(G => G.fat).concat(H.bunLayer === 'back' && H.bunPts ? [H.bunPts] : []);
      const fb = H.bunLayer === 'front' && H.bunPts ? [H.bunPts] : [];
      rimRaster(ctx, C, fm.concat(bm, fb, C.hatPoly ? [C.hatPoly] : []), fm.concat(fb, withBack ? bm : []));
    }
  }

  function anchors(C) {
    const { M, V } = C; const we = M.w(-0.38) + 0.02;
    return {
      neck: [V.ox, V.oy], chin: proj(V, [0, 0, M.zf(0)]), mouth: proj(V, M.surf(0, M.mouthY)),
      eyeL: proj(V, M.surf(-M.eyeX, M.eyeY)), eyeR: proj(V, M.surf(M.eyeX, M.eyeY)),
      crown: proj(V, [0, -1, -0.06]), earL: proj(V, [-we, -0.38, -0.04]), earR: proj(V, [we, -0.38, -0.04]),
      nose: proj(V, M.surf(0, M.noseY)), size: V.s, facing: V.facing,
    };
  }

  // draw through an offscreen layer when o.alpha < 1 (so overlapping parts do not double up)
  function withAlpha(ctx, o, fn) {
    const a = o.alpha ?? 1; if (a >= 0.999) return fn(ctx);
    const cv = ctx.canvas, B = PV.buffer('animeHeadAlpha', cv.width, cv.height), b = B.ctx;
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, cv.width, cv.height); b.setTransform(ctx.getTransform());
    const r = fn(b);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= a; ctx.drawImage(B.canvas, 0, 0); ctx.restore();
    return r;
  }


  /* ================================================================== busts: torso volume + garments */
  // torso sections [y, half-width (shoulders/arms included), front z, back z], head units, origin = neck point
  const TORSO_DEF = {
    senpai: [[0.255, 0.086, 0.055, -0.115], [0.3, 0.16, 0.07, -0.15], [0.36, 0.33, 0.1, -0.19], [0.43, 0.52, 0.135, -0.215], [0.5, 0.67, 0.16, -0.22],
      [0.58, 0.73, 0.18, -0.21], [0.72, 0.724, 0.2, -0.21], [0.95, 0.7, 0.235, -0.2], [1.25, 0.676, 0.23, -0.2], [1.6, 0.66, 0.2, -0.19], [2.3, 0.64, 0.19, -0.19]],
    boy: [[0.255, 0.105, 0.065, -0.13], [0.3, 0.2, 0.08, -0.165], [0.36, 0.42, 0.11, -0.205], [0.43, 0.66, 0.145, -0.23], [0.5, 0.83, 0.17, -0.24],
      [0.58, 0.9, 0.19, -0.24], [0.72, 0.9, 0.2, -0.24], [0.95, 0.87, 0.215, -0.23], [1.25, 0.84, 0.21, -0.22], [1.6, 0.81, 0.2, -0.21], [2.3, 0.78, 0.2, -0.21]],
  };
  TORSO_DEF.aunt = TORSO_DEF.senpai.map(([y, w, f, b]) => [y, w * (y > 0.4 ? 1.02 : 0.98), f * 0.96, b]);
  const TORSOS = {};
  function torsoModel(who) {
    if (TORSOS[who]) return TORSOS[who];
    const K = TORSO_DEF[who] || TORSO_DEF.senpai;
    const w = curve(K.map(k => [k[0], k[1]])), zf = curve(K.map(k => [k[0], k[2]])), zb = curve(K.map(k => [k[0], k[3]]));
    const T = { w, zf, zb, pivot: [0, 0, 0] };
    T.zFront = (x, y) => { const W = w(y), zs = (zf(y) + zb(y)) * 0.5; const ax = min(1, abs(x) / W); return zs + (zf(y) - zs) * pow(max(0, 1 - pow(ax, 2.6)), 1 / 2.6); };
    T.zBack = (x, y) => { const W = w(y), zs = (zf(y) + zb(y)) * 0.5; const ax = min(1, abs(x) / W); return zs - (zs - zb(y)) * pow(max(0, 1 - pow(ax, 2.4)), 1 / 2.4); };
    T.surf = (x, y, off = 0) => [x, y, T.zFront(x, y) + off];
    const Ys = []; for (let y = 0.255; y <= 2.3001; y += (y < 0.7 ? 0.02 : 0.08)) Ys.push(y);
    T.slices = Ys.map(y => {
      const W = w(y), pts = [];
      for (let i = 0; i < 25; i++) { const s = -1 + 2 * i / 24, x = W * s; pts.push(x, y, T.zFront(x, y), 1); }
      for (let i = 1; i < 12; i++) { const s = -1 + 2 * i / 12, x = W * s; pts.push(x, y, T.zBack(x, y), 0); }
      return { y, pts };
    });
    return (TORSOS[who] = T);
  }
  const OUTFIT = { // garment material, sleeve kind, neckline, extras
    senpai: { uniform: { mat: 'blouse', neck: 'collar', tie: 'ribbon' }, blazer: { mat: 'blazer', neck: 'collar', tie: 'ribbon', jacket: 'blazer', inner: 'blouse' },
      dress: { mat: 'dress', neck: 'round', necklace: true }, dress_cardigan: { mat: 'dress', neck: 'round', necklace: true, jacket: 'cardigan' },
      summer: { mat: 'onepiece', neck: 'round_small', shortSleeve: true, hat: 'summer' }, gown: { mat: 'gown', neck: 'pajama', cast: true }, home: { mat: 'knit', neck: 'wide' } },
    boy: { uniform: { mat: 'shirt', neck: 'open', tie: 'tie' }, blazer: { mat: 'blazer', neck: 'open', tie: 'tie', jacket: 'blazer', inner: 'shirt' },
      tee: { mat: 'tee', neck: 'crew', jacket: 'shirtOpen' }, jacket: { mat: 'tee', neck: 'crew', jacket: 'leather', teeCol: 'black' }, wet: { mat: 'shirt', neck: 'open', wet: true } },
    aunt: { coat: { mat: 'coat', neck: 'turtle', jacket: 'coat' } },
  };

  function bustCall(o) {
    const who = MODEL_DEF[o.who] ? o.who : 'senpai';
    const T = torsoModel(who);
    const by = o.bodyYaw ?? clamp((o.yaw || 0) * 0.45, -0.9, 0.9);
    const Vb = makeView({ x: o.x, y: o.y, size: o.size, yaw: by, back: o.back }, T);
    const L = o.light || 'day';
    const FL = A.faceLight(L, o.faceLift);
    return { who, T, Vb, s: Vb.s, L, FL, skin: A.mat('skin', FL), lv: (() => { const d = o.lightDir ?? o.rimDir ?? -2.25; return [cos(d), sin(d)]; })(), lw: A.inkW(o.size || 200) * (o.line ?? 1) };
  }
  const GY = -0.065; // garment shapes are authored for the older, lower shoulder line
  const tp = (B, x, y, off = 0.004) => proj(B.Vb, B.T.surf(x, y + GY, off));
  // cel-shade a filled region: base, crescent away from the light, ink
  function celRegion(ctx, B, P, m, d = 0.07, lineW) {
    ctx.beginPath(); poly(ctx, P); ctx.fillStyle = m.base; ctx.fill();
    ctx.save(); ctx.clip();
    const k = d * B.s; ctx.beginPath(); poly(ctx, P.map(p => [p[0] + B.lv[0] * k, p[1] + B.lv[1] * k])); ctx.rect(-1e5, -1e5, 2e5, 2e5); ctx.fillStyle = m.shade; ctx.fill('evenodd');
    ctx.restore();
    if (lineW) { ctx.beginPath(); poly(ctx, P); ctx.lineWidth = lineW; ctx.lineJoin = 'round'; ctx.strokeStyle = m.line; ctx.stroke(); }
  }
  function surfPoly(B, pts, off) { return smooth(pts.map(p => tp(B, p[0], p[1], off)), true, 3); }


  // the arm / torso boundary (front view x at height y); arms hang at the sides of a bust
  const armX = (B, y) => B.T.w(y + GY) - (B.who === 'boy' ? 0.2 : 0.17) - 0.02 * sstep(0.8, 2, y);
  function drawTorso(ctx, B, fit, o) {
    const { T, Vb } = B; const s = B.s, lw = B.lw;
    const sil = silhouette(Vb, T); B.sil = sil;
    const mg = A.mat(fit.inner || fit.mat, B.L, fit.wet ? { wet: 1 } : {});
    let gm = mg;
    if (fit.wet) { const sk = B.skin; gm = { base: mixH(mg.base, sk.base, 0.32), shade: mixH(mg.shade, sk.shade, 0.4), deep: mg.deep, hi: mg.hi, line: mg.line }; }
    if (fit.teeCol === 'black') gm = A.mat(A.COLORS.tee_black ? 'tee_black' : 'trousers', B.L);
    // 1 body in the garment colour
    celRegion(ctx, B, sil.poly, gm, 0.08);
    ctx.save(); ctx.beginPath(); poly(ctx, sil.poly); ctx.clip();
    // 2 skin: neck opening and bare arms
    const sk = B.skin; const skinP = [];
    const nk = Vb.facing < -0.05 ? 'back' : fit.neck;
    if (nk === 'round') skinP.push(surfPoly(B, [[-0.12, 0.18], [-0.13, 0.34], [-0.21, 0.42], [-0.17, 0.48], [-0.09, 0.53], [0, 0.545], [0.09, 0.53], [0.17, 0.48], [0.21, 0.42], [0.13, 0.34], [0.12, 0.18]]));
    else if (nk === 'round_small') skinP.push(surfPoly(B, [[-0.12, 0.18], [-0.13, 0.34], [-0.17, 0.41], [-0.1, 0.47], [0, 0.49], [0.1, 0.47], [0.17, 0.41], [0.13, 0.34], [0.12, 0.18]]));
    else if (nk === 'wide') skinP.push(surfPoly(B, [[-0.16, 0.18], [-0.2, 0.36], [-0.28, 0.43], [-0.15, 0.5], [0, 0.52], [0.15, 0.5], [0.28, 0.43], [0.2, 0.36], [0.16, 0.18]]));
    else if (nk === 'square') skinP.push(surfPoly(B, [[-0.14, 0.18], [-0.16, 0.4], [-0.21, 0.5], [-0.215, 0.66], [0, 0.67], [0.215, 0.66], [0.21, 0.5], [0.16, 0.4], [0.14, 0.18]]));
    else if (nk === 'open' || nk === 'pajama') skinP.push(surfPoly(B, [[-0.14, 0.18], [-0.12, 0.38], [-0.03, nk === 'open' ? 0.56 : 0.62], [0, nk === 'open' ? 0.6 : 0.66], [0.03, nk === 'open' ? 0.56 : 0.62], [0.12, 0.38], [0.14, 0.18]]));
    else if (nk !== 'turtle') skinP.push(surfPoly(B, [[-0.14, 0.18], [-0.15, 0.4], [0, 0.46], [0.15, 0.4], [0.14, 0.18]]));
    for (const P of skinP) celRegion(ctx, B, P, sk, 0.05);
    if (fit.sleeveless || fit.shortSleeve || fit.mat === 'dress') {         // bare arms (cap sleeves on the dress, short sleeves on the one-piece)
      const y0 = fit.sleeveless ? 0.56 : fit.shortSleeve ? 1.1 : 0.86;
      for (const sd of [-1, 1]) {
        const P = [];
        for (let y = y0; y <= 2.35; y += 0.1) P.push(tp(B, sd * (armX(B, y) + (y < 0.9 ? (0.9 - y) * 0.5 : 0)), y));
        for (let y = 2.35; y >= y0; y -= 0.1) P.push(tp(B, sd * (T.w(y + GY) + 0.1), y));
        celRegion(ctx, B, smooth(P, true, 2), sk, 0.06);
      }
    }
    if (nk === 'back' && fit.neck === 'square') skinP.length = 0;
    // 3 summer dress body over the skin (square neckline + wide straps)
    if (nk === 'square') {
      const m = A.mat('onepiece', B.L);
      const P = [[-0.21, 0.5], [-0.34, 0.5], [-0.43, 0.62], [-0.46, 0.86], [-0.48, 1.4], [-0.5, 2.4], [0.5, 2.4], [0.48, 1.4], [0.46, 0.86], [0.43, 0.62], [0.34, 0.5], [0.21, 0.5], [0.215, 0.66], [0, 0.675], [-0.215, 0.66]];
      celRegion(ctx, B, P.map(p => tp(B, p[0], p[1], 0.006)), m, 0.07, lw * 0.6);
    }
    // 4 folds: arm / torso boundary + a few creases
    const lc = gm.line;
    for (const sd of [-1, 1]) {
      const pts = []; for (let y = 0.84; y <= 2.2; y += 0.12) pts.push(tp(B, sd * armX(B, y), y));
      ink(ctx, pts, (u) => lw * 0.55 * sstep(0, 0.15, u), rgba(lc, 0.85));
      if (B.s > 120) {
        ink(ctx, [tp(B, sd * (armX(B, 0.9) - 0.02), 0.92), tp(B, sd * (armX(B, 0.9) - 0.12), 1.02), tp(B, sd * (armX(B, 0.9) - 0.2), 1.06)], (u) => lw * 0.35 * sin(PI * u), rgba(lc, 0.6));
        ink(ctx, [tp(B, sd * (armX(B, 1.4) + 0.05), 1.3), tp(B, sd * (armX(B, 1.4) + 0.09), 1.55)], (u) => lw * 0.3 * sin(PI * u), rgba(lc, 0.5));
      }
    }
    if (B.who !== 'boy' && fit.mat !== 'coat' && B.s > 120) { // soft chest line
      for (const sd of [-1, 1]) ink(ctx, [tp(B, sd * 0.05, 1.1), tp(B, sd * 0.17, 1.16), tp(B, sd * 0.3, 1.12)], (u) => lw * 0.32 * sin(PI * u), rgba(lc, 0.45));
    }
    if (fit.wet && B.s > 120) { // clinging, see-through folds
      for (let k = 0; k < 5; k++) { const x = -0.4 + k * 0.2; ink(ctx, [tp(B, x, 0.75), tp(B, x + 0.05, 1.0), tp(B, x - 0.02, 1.3)], (u) => lw * 0.35 * sin(PI * u), rgba(mg.line, 0.5)); }
    }
    // 5 jackets with a V opening
    if (fit.jacket && nk === 'back') celRegion(ctx, B, sil.poly, A.mat(fit.jacket === 'blazer' ? 'blazer' : fit.jacket === 'cardigan' ? 'cardigan' : fit.jacket === 'leather' ? 'jacket' : fit.jacket === 'coat' ? 'coat' : 'gown', B.L), 0.09);
    if (fit.jacket && nk !== 'back') {
      const jm = A.mat(fit.jacket === 'blazer' ? 'blazer' : fit.jacket === 'cardigan' ? 'cardigan' : fit.jacket === 'leather' ? 'jacket' : fit.jacket === 'coat' ? 'coat' : 'gown', B.L);
      const vb = fit.jacket === 'blazer' ? 1.12 : fit.jacket === 'cardigan' ? 0.95 : fit.jacket === 'coat' ? 1.0 : 2.4;
      const vw = fit.jacket === 'shirtOpen' ? 0.26 : fit.jacket === 'leather' ? 0.2 : fit.jacket === 'coat' ? 0.14 : 0.1;
      const V = [[-0.16, 0.3], [-0.15, 0.42], [-vw, 0.6], [-vw * 0.4, vb], [0, vb + 0.02], [0.02, 2.5], [-0.02, 2.5], [vw * 0.4, vb], [vw, 0.6], [0.15, 0.42], [0.16, 0.3]];
      const Vp = smooth(V.map(p => tp(B, p[0], p[1])), true, 2);
      ctx.save(); ctx.beginPath(); poly(ctx, Vp); ctx.rect(-1e5, -1e5, 2e5, 2e5); ctx.clip('evenodd');
      celRegion(ctx, B, sil.poly, jm, 0.09);
      for (const sd of [-1, 1]) { const pts = []; for (let y = 0.84; y <= 2.2; y += 0.12) pts.push(tp(B, sd * armX(B, y), y)); ink(ctx, pts, (u) => lw * 0.55 * sstep(0, 0.15, u), rgba(jm.line, 0.9)); }
      ctx.restore();
      // lapels
      for (const sd of [-1, 1]) {
        const lp = fit.jacket === 'cardigan' || fit.jacket === 'shirtOpen'
          ? [[sd * 0.15, 0.42], [sd * vw, 0.6], [sd * vw * 0.4, vb], [sd * (vw * 0.4 + 0.05), vb], [sd * (vw + 0.05), 0.6], [sd * 0.2, 0.42]]
          : [[sd * 0.16, 0.36], [sd * vw, 0.62], [sd * vw * 0.4, vb], [sd * (vw * 0.4 + 0.07), vb - 0.12], [sd * (vw + 0.16), 0.66], [sd * (vw + 0.2), 0.55], [sd * (vw + 0.12), 0.52], [sd * 0.24, 0.42]];
        const LP = lp.map(p => tp(B, p[0], p[1], 0.012));
        fillPoly(ctx, LP.map(p => [p[0] + 0.012 * s, p[1] + 0.018 * s]), rgba(jm.deep, 0.55));
        celRegion(ctx, B, LP, { base: mixH(jm.base, jm.hi, 0.12), shade: jm.shade, line: jm.line }, 0.05, lw * 0.55);
      }
      ink(ctx, smooth(V.slice(1, 5).map(p => tp(B, p[0], p[1], 0.012)), false, 3), (u) => lw * 0.6, jm.line);
      ink(ctx, smooth(V.slice(7, 11).map(p => tp(B, p[0], p[1], 0.012)), false, 3), (u) => lw * 0.6, jm.line);
      if (fit.jacket === 'blazer' || fit.jacket === 'cardigan' || fit.jacket === 'coat') {
        const ys = fit.jacket === 'cardigan' ? [1.05, 1.3, 1.55, 1.8] : [1.25, 1.6];
        for (const y of ys) { const c = tp(B, -0.04, y, 0.015); ctx.beginPath(); ctx.arc(c[0], c[1], 0.018 * s, 0, TAU); ctx.fillStyle = jm.deep; ctx.fill(); ctx.lineWidth = lw * 0.35; ctx.strokeStyle = jm.line; ctx.stroke(); }
      }
      if (fit.jacket === 'leather') ink(ctx, [tp(B, 0.17, 0.75, 0.01), tp(B, 0.15, 1.4, 0.01), tp(B, 0.14, 2.3, 0.01)], (u) => lw * 0.35, rgba(jm.hi, 0.6));
    }
    ctx.restore();
    const olc = A.mat(fit.jacket === 'leather' ? 'jacket' : fit.jacket === 'coat' ? 'coat' : fit.jacket ? 'blazer' : fit.mat, B.L).line;
    ink(ctx, sil.R.filter(p => p.f[1] > 0.31), (u) => lw * 0.85 * sstep(0, 0.05, u), olc);
    ink(ctx, sil.L.filter(p => p.f[1] > 0.31), (u) => lw * 0.85 * sstep(0, 0.05, u), olc);
  }

  // collars, ribbon / tie, necklace, cast: drawn after the neck
  function drawTorsoFront(ctx, B, fit, o) {
    if (B.Vb.facing < -0.05) return;            // seen from behind: collars, ties, necklace are on the far side
    const s = B.s, lw = B.lw; const nk = fit.neck;
    const gm = A.mat(fit.inner || fit.mat, B.L);
    if (nk === 'collar' || nk === 'open' || nk === 'pajama') {
      const open = nk === 'open', pj = nk === 'pajama';
      const cm = pj ? A.mat('gown', B.L) : A.mat(fit.inner || fit.mat, B.L, fit.wet ? { wet: 1 } : {});
      if (open && fit.tie) { // loosened tie under the open collar
        const tm = A.mat('tie', B.L);
        const bandL = [[-0.11, 0.37], [-0.035, 0.56], [-0.015, 0.56], [-0.085, 0.37]], bandR = [[0.11, 0.37], [0.035, 0.56], [0.015, 0.56], [0.085, 0.37]];
        for (const b of [bandL, bandR]) fillPoly(ctx, b.map(p => tp(B, p[0], p[1], 0.008)), tm.shade);
        const sw = 0.012 * A.sway(A.onTwos(o.T || 0), 4);
        const blade = [[-0.03, 0.62], [-0.06, 1.0 + sw], [-0.055, 1.38], [0.0 + sw, 1.46], [0.055, 1.38], [0.06, 1.0 + sw], [0.03, 0.62]];
        celRegion(ctx, B, smooth(blade.map(p => tp(B, p[0], p[1], 0.012)), true, 2), tm, 0.04, lw * 0.55);
        celRegion(ctx, B, [[-0.04, 0.55], [0.04, 0.55], [0.028, 0.63], [-0.028, 0.63]].map(p => tp(B, p[0], p[1], 0.016)), tm, 0.02, lw * 0.55);
      }
      for (const sd of [-1, 1]) {
        const fl = pj ? [[sd * 0.02, 0.6], [sd * 0.115, 0.37], [sd * 0.14, 0.385], [sd * 0.25, 0.5], [sd * 0.15, 0.66]]
          : open ? [[sd * 0.04, 0.53], [sd * 0.12, 0.36], [sd * 0.145, 0.375], [sd * 0.23, 0.5], [sd * 0.14, 0.6]]
            : [[sd * 0.008, 0.455], [sd * 0.105, 0.365], [sd * 0.127, 0.38], [sd * 0.195, 0.5], [sd * 0.115, 0.575]];
        const FP = fl.map(p => tp(B, p[0], p[1], 0.014));
        fillPoly(ctx, FP.map(p => [p[0] + sd * 0.004 * s, p[1] + 0.018 * s]), rgba(cm.shade, 0.9));
        celRegion(ctx, B, FP, cm, 0.035, lw * 0.6);
      }
      if (fit.tie === 'ribbon') {
        const rm = A.mat('ribbon', B.L);
        const tails = [[[-0.01, 0.49], [-0.05, 0.6], [-0.033, 0.628], [-0.003, 0.52]], [[0.01, 0.49], [0.044, 0.615], [0.064, 0.6], [0.022, 0.5]]];
        for (const t of tails) celRegion(ctx, B, t.map(p => tp(B, p[0], p[1], 0.018)), rm, 0.02, lw * 0.5);
        for (const sd of [-1, 1]) {
          const lp = [[0, 0.468], [sd * 0.058, 0.432], [sd * 0.105, 0.448], [sd * 0.1, 0.5], [sd * 0.05, 0.505]];
          celRegion(ctx, B, smooth(lp.map(p => tp(B, p[0], p[1], 0.022)), true, 3), rm, 0.025, lw * 0.5);
          ink(ctx, [tp(B, sd * 0.02, 0.47, 0.024), tp(B, sd * 0.07, 0.468, 0.024)], (u) => lw * 0.3 * sin(PI * u), rgba(rm.line, 0.7));
        }
        celRegion(ctx, B, [[-0.017, 0.457], [0.017, 0.457], [0.02, 0.495], [-0.02, 0.495]].map(p => tp(B, p[0], p[1], 0.026)), rm, 0.015, lw * 0.5);
      }
      if (pj) for (const y of [0.78, 1.05, 1.32, 1.6]) { const c = tp(B, 0.035, y, 0.012); ctx.beginPath(); ctx.arc(c[0], c[1], 0.014 * s, 0, TAU); ctx.fillStyle = A.mat('cast', B.L).base; ctx.fill(); ctx.lineWidth = lw * 0.3; ctx.strokeStyle = cm.line; ctx.stroke(); }
    }
    if (nk === 'crew' || nk === 'turtle') {
      const cm = A.mat(fit.teeCol === 'black' ? (A.COLORS.tee_black ? 'tee_black' : 'trousers') : fit.mat === 'coat' ? 'coat' : fit.mat, B.L);
      const band = nk === 'turtle' ? [[-0.112, 0.3], [-0.125, 0.43], [0, 0.465], [0.125, 0.43], [0.112, 0.3], [0, 0.33]] : [[-0.15, 0.385], [-0.165, 0.425], [0, 0.48], [0.165, 0.425], [0.15, 0.385], [0, 0.445]];
      celRegion(ctx, B, smooth(band.map(p => tp(B, p[0], p[1], 0.01)), true, 3), cm, 0.04, lw * 0.55);
      if ((fit.mat === 'knit' || nk === 'turtle') && s > 120) for (let k = -4; k <= 4; k++) { const y0 = nk === 'turtle' ? 0.33 : 0.445 - 0.012 * abs(k), y1 = nk === 'turtle' ? 0.45 : 0.475 - 0.013 * abs(k); ink(ctx, [tp(B, k * 0.027, y0 + (nk === 'turtle' ? 0 : 0.0), 0.012), tp(B, k * 0.03, y1, 0.012)], (u) => lw * 0.25, rgba(cm.line, 0.5)); }
    }
    if (fit.necklace) { // thin silver chain, a rice-grain silver drop between the collarbones (design sheet)
      const nm = A.COLORS.necklace ? A.mat('necklace', B.L) : { base: '#c8ccd8', hi: '#ffffff', line: '#6a7080' };
      const pts = []; for (let k = 0; k <= 12; k++) { const a = k / 12; pts.push(tp(B, lerp(-0.105, 0.105, a), 0.39 + 0.12 * sin(PI * a) ** 1.2, 0.012)); }
      ink(ctx, pts, (u) => lw * 0.32, mixH(nm.base, B.skin.line, 0.25));
      const c = tp(B, 0, 0.525, 0.014), r = 0.009 * s;
      ctx.beginPath(); ctx.moveTo(c[0], c[1] - r * 1.6); ctx.quadraticCurveTo(c[0] + r, c[1], c[0], c[1] + r); ctx.quadraticCurveTo(c[0] - r, c[1], c[0], c[1] - r * 1.6);
      ctx.fillStyle = nm.base; ctx.fill(); ctx.lineWidth = lw * 0.28; ctx.strokeStyle = nm.line; ctx.stroke();
      ctx.fillStyle = nm.hi; ctx.beginPath(); ctx.arc(c[0] - r * 0.3, c[1] - r * 0.2, r * 0.3, 0, TAU); ctx.fill();
    }
    if (nk === 'wide' || nk === 'round_small') { // knit rib / a narrow binding along the neckline
      const cm = A.mat(fit.mat, B.L), wide = nk === 'wide';
      const edge = (wide ? [[-0.28, 0.43], [-0.15, 0.5], [0, 0.52], [0.15, 0.5], [0.28, 0.43]] : [[-0.17, 0.41], [-0.1, 0.47], [0, 0.49], [0.1, 0.47], [0.17, 0.41]]).map(p => tp(B, p[0], p[1], 0.01));
      ink(ctx, smooth(edge, false, 4), (u) => lw * (wide ? 1.6 : 0.9) * sstep(0, 0.1, u) * sstep(1, 0.9, u), rgba(cm.shade, 0.95));
      ink(ctx, smooth(edge, false, 4), (u) => lw * 0.5 * sstep(0, 0.1, u) * sstep(1, 0.9, u), cm.line);
    }
    if (fit.cast) { // right forearm (her right = viewer's left) in a white cast, held across the chest by a sling
      const cm = A.mat('cast', B.L), slm = A.mat('gown', B.L);
      celRegion(ctx, B, [[0.16, 0.42], [0.24, 0.45], [-0.3, 1.32], [-0.4, 1.26]].map(p => tp(B, p[0], p[1], 0.03)), { base: mixH(slm.base, '#ffffff', 0.3), shade: slm.shade, line: slm.line }, 0.03, lw * 0.5);
      const arm = [[-0.62, 1.18], [-0.5, 1.12], [0.05, 1.02], [0.16, 1.0], [0.2, 1.08], [0.14, 1.16], [0.02, 1.2], [-0.5, 1.34], [-0.64, 1.32]];
      celRegion(ctx, B, smooth(arm.map(p => tp(B, p[0], p[1], 0.06)), true, 3), cm, 0.05, lw * 0.6);
      const hand = [[0.15, 1.0], [0.27, 0.98], [0.31, 1.03], [0.25, 1.1], [0.16, 1.12]];
      celRegion(ctx, B, smooth(hand.map(p => tp(B, p[0], p[1], 0.06)), true, 3), B.skin, 0.03, lw * 0.5);
      celRegion(ctx, B, [[-0.55, 1.22], [0.12, 1.12], [0.14, 1.22], [-0.5, 1.4]].map(p => tp(B, p[0], p[1], 0.065)), { base: mixH(slm.base, '#ffffff', 0.3), shade: slm.shade, line: slm.line }, 0.03, lw * 0.5);
    }
  }

  A.bust = function (ctx, o = {}) {
    return withAlpha(ctx, o, (cx) => {
      const B = bustCall(o);
      const set = OUTFIT[B.who] || OUTFIT.senpai;
      const fit = set[o.outfit] || set[Object.keys(set)[0]];
      const hair = Object.assign({}, o.hair || {}); if (!hair.style) hair.style = fit.wet ? 'wet' : o.outfit === 'dress' ? 'updo' : o.outfit === 'dress_cardigan' ? 'loose' : undefined;
      if (!hair.style) delete hair.style;
      const ho = Object.assign({}, o, { alpha: 1, neck: false, hat: o.hat ?? fit.hat, bodyYaw: B.Vb.yaw, hair });
      cx.save(); cx.lineJoin = 'round'; cx.lineCap = 'round';
      A.headBack(cx, ho);
      const NL = { collar: 0.5, open: 0.52, pajama: 0.52, round: 0.56, square: 0.56, crew: 0.45, turtle: 0.36 };
      A.head(cx, Object.assign({}, ho, { layer: 'neck', neckLen: o.neckLen ?? NL[fit.neck] ?? 0.5, neckFade: true }));
      drawTorso(cx, B, fit, o);
      drawTorsoFront(cx, B, fit, o);
      const r = A.head(cx, Object.assign({}, ho, { layer: 'front' }));
      cx.restore();
      return r;
    });
  };

  /* ================================================================== public API */
  A.head = function (ctx, o = {}) {
    return withAlpha(ctx, o, (cx) => {
      const C = makeCall(o); const layer = o.layer || 'all';
      if (o.hat) C.hat = hatGeo(C);
      const H = prepareHair(C);
      cx.save(); cx.lineCap = 'round'; cx.lineJoin = 'round';
      if (layer === 'all' || layer === 'back') drawBackLayer(cx, C, H, layer === 'all');
      if (layer === 'neck' || ((layer === 'all' || layer === 'front') && o.neck)) drawNeck(cx, C, o);
      if (layer === 'all' || layer === 'front') drawFrontLayer(cx, C, H, layer === 'all');
      cx.restore();
      return anchors(C);
    });
  };
  A.headBack = function (ctx, o = {}) {
    return withAlpha(ctx, o, (cx) => { const C = makeCall(o); const H = prepareHair(C); cx.save(); drawBackLayer(cx, C, H); cx.restore(); return anchors(C); });
  };
  A.neck = function (ctx, o = {}) { const C = makeCall(o); ctx.save(); const N = drawNeck(ctx, C, o); ctx.restore(); return { top: N.top, bottom: N.bot, r: N.r }; };
  A.headInfo = function (o = {}) { const C = makeCall(o); return anchors(C); };
  A._headModel = model;
  A._headDebug = function (ctx, o) { // dev: outlines of the silhouette, cap, hairline region
    const C = makeCall(o); const H = prepareHair(C);
    const st = (P, col, w = 2) => { ctx.beginPath(); poly(ctx, P); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
    const GC = { back: '#ff8800', side: '#00cccc', bang: '#ff00ff', nape: '#888800', top: '#008800', tail: '#aa0000' };
    for (const G of H.back) st(G.poly, GC[G.Lk.g] || '#000', 1.5); for (const G of H.front) st(G.poly, GC[G.Lk.g] || '#000', 1);
    st(C.sil.poly, '#00aa00'); if (H.cap.length) st(H.cap, '#0044ff'); if (H.reg) { st(H.reg.region, '#ff0000', 1.5); ctx.fillStyle = '#ff00ff'; for (const p of H.reg.arc) { ctx.fillRect(p[0] - 2, p[1] - 2, 4, 4); } }
  };
})();

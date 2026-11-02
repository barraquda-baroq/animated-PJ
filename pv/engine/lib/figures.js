/* figures.js — silhouette character library (back views, backlit silhouettes, profiles).
 * Faces are never acted: pose, hair and light tell the emotion.
 *
 * Common options for every PV.lib.<figure>(ctx, t, o):
 *   x, y      anchor in ctx coordinates (each function documents its anchor)
 *   scale     1 = girl standing height ~660px (1 head unit = 92px)
 *   flip      mirror horizontally
 *   style     'silhouette' (near-black + rim light) | 'soft' (dark flat + faint gradient)
 *   light     angle (rad, screen space) pointing FROM the figure TOWARD the light. 0=right, -PI/2=top
 *   rimColor, rim (0..2 multiplier), backlight (0..1 all-round soft rim), glow (0..1 outer halo)
 *   fill      override body colour, alpha, fps (pose/hair sampling rate, default 12 = "on twos")
 *   wind (0..2), windDir (rad, direction the wind blows TOWARD), seed
 * Everything is deterministic in (t, options).
 * Rendering: a bounds pre-pass measures each figure so the per-pixel light passes run on a tight rectangle; the rim is
 * derived from the silhouette's alpha; static set pieces (hospital bed, blanket, railing) are cached per light setting.
 * API notes / reviewed showcases: analysis/art_review/figures_API.md, figures_critique.md
 */
(function () {
  'use strict';
  const PV = window.PV; const L = (PV.lib = PV.lib || {});
  const TAU = Math.PI * 2, PI = Math.PI, HP = Math.PI / 2;
  const U = 92;
  const clamp = PV.clamp, lerp = PV.lerp, sstep = PV.smooth;
  const N2 = PV.noise2, R1 = PV.rand1;
  const sin = Math.sin, cos = Math.cos;

  /* ================================================================ math */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const mix2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const len2 = (a) => Math.hypot(a[0], a[1]);
  const norm = (a) => { const l = Math.hypot(a[0], a[1]) || 1e-9; return [a[0] / l, a[1] / l]; };
  const polar = (p, ang, r) => [p[0] + cos(ang) * r, p[1] + sin(ang) * r];
  const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; };
  const angLerp = (a, b, k) => a + angDiff(a, b) * k;
  const bell = (x, c, w) => Math.exp(-((x - c) / w) * ((x - c) / w));
  // a local frame: origin o, unit "up" vector -> (x, h) maps to o + right*x + up*h  (right = up rotated +90deg)
  const frame = (o, up) => (x, h) => [o[0] - up[1] * x + up[0] * h, o[1] + up[0] * x + up[1] * h];
  function parseCol(c) { if (c[0] === '#') return PV.hex2rgb(c).concat([1]); const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; }
  function mixCol(a, b, k) { const A = parseCol(a), B = parseCol(b); return 'rgba(' + Math.round(lerp(A[0], B[0], k)) + ',' + Math.round(lerp(A[1], B[1], k)) + ',' + Math.round(lerp(A[2], B[2], k)) + ',' + lerp(A[3], B[3], k).toFixed(3) + ')'; }
  const quant = (t, fps) => (fps ? Math.floor(t * fps + 1e-6) / fps : t);
  // two-bone IK: returns elbow/knee position. bend = +1/-1 chooses the side.
  function ik(a, c, l1, l2, bend) {
    const d = sub(c, a); let D = len2(d); D = clamp(D, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
    const base = Math.atan2(d[1], d[0]); const cosA = (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D);
    return polar(a, base + bend * Math.acos(clamp(cosA, -1, 1)), l1);
  }

  /* ============================================================ drawing prims */
  // Catmull-Rom spline through pts ([x,y] or [x,y,1] = sharp corner). Appends to the current path.
  function spline(c, pts, closed, move = true, k = 1) {
    const n = pts.length; if (n < 2) return;
    const P = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    if (move) c.moveTo(pts[0][0], pts[0][1]); else c.lineTo(pts[0][0], pts[0][1]);
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const s1 = p1[2] ? 0 : k / 6, s2 = p2[2] ? 0 : k / 6;
      c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * s1, p1[1] + (p2[1] - p0[1]) * s1,
        p2[0] - (p3[0] - p1[0]) * s2, p2[1] - (p3[1] - p1[1]) * s2, p2[0], p2[1]);
    }
    if (closed) c.closePath();
  }
  function blob(c, pts, k) { c.beginPath(); spline(c, pts, true, true, k); c.fill(); }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(1e-4, rx), Math.max(1e-4, ry), rot, 0, TAU); c.fill(); }
  // tapered limb segment p0->p1 with end half-widths r0,r1 and side bulges (A = left of travel, B = right)
  function seg(c, p0, p1, r0, r1, bA, fA, bB, fB) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / l, uy = dy / l, ax = uy, ay = -ux, ang = Math.atan2(uy, ux);
    if (bA === undefined) bA = (r0 + r1) / 2; if (fA === undefined) fA = 0.5;
    if (bB === undefined) bB = bA; if (fB === undefined) fB = fA;
    const sA = [p0[0] + ax * r0, p0[1] + ay * r0], eA = [p1[0] + ax * r1, p1[1] + ay * r1];
    const mA = [p0[0] + dx * fA + ax * bA, p0[1] + dy * fA + ay * bA];
    const sB = [p0[0] - ax * r0, p0[1] - ay * r0], eB = [p1[0] - ax * r1, p1[1] - ay * r1];
    const mB = [p0[0] + dx * fB - ax * bB, p0[1] + dy * fB - ay * bB];
    const k1 = l * fA * 0.4, k2 = l * (1 - fA) * 0.4, j1 = l * fB * 0.4, j2 = l * (1 - fB) * 0.4;
    c.beginPath(); c.moveTo(sA[0], sA[1]);
    c.bezierCurveTo(sA[0] + ux * k1, sA[1] + uy * k1, mA[0] - ux * k1, mA[1] - uy * k1, mA[0], mA[1]);
    c.bezierCurveTo(mA[0] + ux * k2, mA[1] + uy * k2, eA[0] - ux * k2, eA[1] - uy * k2, eA[0], eA[1]);
    c.arc(p1[0], p1[1], Math.max(1e-4, r1), ang - HP, ang + HP, false);
    c.bezierCurveTo(eB[0] - ux * j2, eB[1] - uy * j2, mB[0] + ux * j2, mB[1] + uy * j2, mB[0], mB[1]);
    c.bezierCurveTo(mB[0] - ux * j1, mB[1] - uy * j1, sB[0] + ux * j1, sB[1] + uy * j1, sB[0], sB[1]);
    c.arc(p0[0], p0[1], Math.max(1e-4, r0), ang + HP, ang + 3 * HP, false);
    c.closePath(); c.fill();
  }
  // smooth polyline through points using midpoint quadratics (appends to path)
  function smoothPoly(c, P, move) {
    const n = P.length; if (move) c.moveTo(P[0][0], P[0][1]); else c.lineTo(P[0][0], P[0][1]);
    if (n < 3) { for (let i = 1; i < n; i++) c.lineTo(P[i][0], P[i][1]); return; }
    for (let i = 1; i < n - 1; i++) c.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
    c.lineTo(P[n - 1][0], P[n - 1][1]);
  }
  // limb p0->p1 with a multi-key profile [[f, wA, wB], ...] (f 0..1; A = left of travel). Smooth (cosine) interpolation.
  function limb(c, p0, p1, prof, n = 16) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1e-6, ux = dx / l, uy = dy / l, ax = uy, ay = -ux;
    const at = (f) => {
      for (let i = 0; i < prof.length - 1; i++) if (f <= prof[i + 1][0]) { const a = prof[i], b = prof[i + 1]; const k = clamp((f - a[0]) / ((b[0] - a[0]) || 1)); const e = k * k * (3 - 2 * k); return [lerp(a[1], b[1], e), lerp(a[2], b[2], e)]; }
      const z = prof[prof.length - 1]; return [z[1], z[2]];
    };
    const A = [], B = [];
    for (let i = 0; i <= n; i++) { const f = i / n, w = at(f), px = p0[0] + dx * f, py = p0[1] + dy * f; A.push([px + ax * w[0], py + ay * w[0]]); B.push([px - ax * w[1], py - ay * w[1]]); }
    const ang = Math.atan2(uy, ux), w0 = at(0), w1 = at(1);
    const r1 = (w1[0] + w1[1]) / 2, o1 = (w1[0] - w1[1]) / 2, r0 = (w0[0] + w0[1]) / 2, o0 = (w0[0] - w0[1]) / 2;
    c.beginPath(); smoothPoly(c, A, true);
    c.arc(p1[0] + ax * o1, p1[1] + ay * o1, Math.max(1e-4, r1), ang - HP, ang + HP, false);
    smoothPoly(c, B.reverse(), false);
    c.arc(p0[0] + ax * o0, p0[1] + ay * o0, Math.max(1e-4, r0), ang + HP, ang + 3 * HP, false);
    c.closePath(); c.fill();
  }
  // outer/inner profile helper: sg=-1 means "outer" is side B (screen-left limb travelling down)
  const prof = (P, sg) => P.map(([f, o, i]) => (sg < 0 ? [f, i, o] : [f, o, i]));
  // place a shape defined in a local frame (origin p, x-axis at angle a, scale k, mirror my)
  function local(c, p, a, k, my, fn) { c.save(); c.translate(p[0], p[1]); c.rotate(a); c.scale(k, k * (my || 1)); fn(c); c.restore(); }

  /* ======================================================== render pipeline */
  // Layers are painted flat into an accumulation buffer; light is then derived from the OUTER contour only
  // (thin crisp rim on the light-facing edges, a wide soft falloff and an outer halo computed at 1/4 res).
  // wideU / omniU are in head units, so the soft light keeps the same proportion at every on-screen size
  // (a small figure must not turn grey: its limbs are only a few px wide).
  const STYLES = {
    silhouette: { fill: '#0c1019', rim: '#ffe6c0', rimA: 1.0, rimW: 2.3, wideU: 0.075, wideA: 0.26, omni: 0.2, omniU: 0.04, glow: 0.55, grad: 0.0 },
    soft: { fill: '#273042', rim: '#fff0da', rimA: 0.42, rimW: 1.6, wideU: 0.1, wideA: 0.16, omni: 0.15, omniU: 0.05, glow: 0.18, grad: 0.3 },
  };
  /* Bounds pre-pass: a stand-in 2D context that only tracks the device-space extent of what would be painted.
   * Every figure records its layers once through it, so the expensive per-pixel passes run on a tight rectangle
   * (the old fixed boxes were 2-3x larger than the figure: railings, beds, hair "in case of wind"). */
  function BCtx() { this.m = [1, 0, 0, 1, 0, 0]; this.stk = []; this.lineWidth = 1; this.reset(); }
  BCtx.prototype = {
    reset() { this.x0 = this.y0 = 1e9; this.x1 = this.y1 = -1e9; this.stk.length = 0; this.beginPath(); },
    save() { this.stk.push([this.m.slice(), this.lineWidth]); },
    restore() { const s = this.stk.pop(); if (s) { this.m = s[0]; this.lineWidth = s[1]; } },
    setTransform(a, b, c, d, e, f) { this.m = typeof a === 'object' ? [a.a, a.b, a.c, a.d, a.e, a.f] : [a, b, c, d, e, f]; },
    transform(a, b, c, d, e, f) { const m = this.m; this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; },
    translate(x, y) { this.transform(1, 0, 0, 1, x, y); },
    scale(x, y) { this.transform(x, 0, 0, y === undefined ? x : y, 0, 0); },
    rotate(a) { const c = cos(a), s = sin(a); this.transform(c, s, -s, c, 0, 0); },
    pt(x, y) { const m = this.m, X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5]; if (X < this.p0) this.p0 = X; if (X > this.p1) this.p1 = X; if (Y < this.q0) this.q0 = Y; if (Y > this.q1) this.q1 = Y; },
    beginPath() { this.p0 = this.q0 = 1e9; this.p1 = this.q1 = -1e9; },
    closePath() {}, moveTo(x, y) { this.pt(x, y); }, lineTo(x, y) { this.pt(x, y); },
    quadraticCurveTo(a, b, x, y) { this.pt(a, b); this.pt(x, y); },
    bezierCurveTo(a, b, c, d, x, y) { this.pt(a, b); this.pt(c, d); this.pt(x, y); },
    arc(x, y, r) { this.pt(x - r, y - r); this.pt(x + r, y + r); this.pt(x - r, y + r); this.pt(x + r, y - r); },
    ellipse(x, y, rx, ry) { this.arc(x, y, Math.max(rx, ry)); },
    rect(x, y, w, h) { this.pt(x, y); this.pt(x + w, y + h); this.pt(x + w, y); this.pt(x, y + h); },
    roundRect(x, y, w, h) { this.rect(x, y, w, h); },
    merge(pad) { if (this.p1 < this.p0) return; this.x0 = Math.min(this.x0, this.p0 - pad); this.y0 = Math.min(this.y0, this.q0 - pad); this.x1 = Math.max(this.x1, this.p1 + pad); this.y1 = Math.max(this.y1, this.q1 + pad); },
    fill() { this.merge(0.5); },
    stroke() { const m = this.m; this.merge(0.5 + Math.hypot(m[0], m[1]) * this.lineWidth * 0.5); },
    fillRect(x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.fill(); },
    clearRect() {}, drawImage() {}, clip() {}, setLineDash() {}, fillText() {},
    createLinearGradient() { return { addColorStop() {} }; }, createRadialGradient() { return { addColorStop() {} }; },
  };
  const BC = new BCtx();
  const pool = {};
  function buf(key, w, h) {
    let b = pool[key];
    if (!b || b.canvas.width < w || b.canvas.height < h) {
      const nw = Math.max(w, b ? b.canvas.width : 0), nh = Math.max(h, b ? b.canvas.height : 0);
      b = pool[key] = PV.makeCanvas(Math.ceil(nw / 128) * 128, Math.ceil(nh / 128) * 128);
    }
    const c = b.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    return b;
  }
  // rim of mask `src` (w x h) into dst ctx: src minus src shifted away from light, coloured
  function rimInto(dst, src, w, h, dx, dy, col, blurPx) {
    dst.globalCompositeOperation = 'copy'; dst.globalAlpha = 1; dst.filter = 'none'; dst.drawImage(src, 0, 0, w, h, 0, 0, w, h);
    dst.globalCompositeOperation = 'destination-out'; if (blurPx) dst.filter = 'blur(' + blurPx.toFixed(2) + 'px)';
    dst.drawImage(src, 0, 0, w, h, -dx, -dy, w, h); dst.filter = 'none';
    dst.globalCompositeOperation = 'source-in'; dst.fillStyle = col; dst.fillRect(0, 0, w, h); dst.globalCompositeOperation = 'source-over';
  }

  // Begin a figure. paint(F) declares layers with F.layer(opt, draw) / F.raw(draw) in local head units around the
  // anchor. (bbox is accepted for API compatibility but no longer needed: the extent is measured by a bounds pass.)
  const prep = (c, col) => { c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; };
  function figure(ctx, o, bbox, paint) {
    const st = Object.assign({}, STYLES[o.style] || STYLES.silhouette);
    const s = (o.scale || 1) * U, fl = o.flip ? -1 : 1;
    const m = ctx.getTransform();
    const T0 = new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]).translate(o.x || 0, o.y || 0).scale(fl * s, s);
    const devS = Math.hypot(m.a, m.b) * s / U;
    const light = o.light === undefined ? -2.2 : o.light;
    const rimCol = o.rimColor || st.rim, rimK = (o.rim === undefined ? 1 : o.rim);
    const rimPx = clamp(st.rimW * Math.pow(devS, 0.6) * (o.rimWidth || 1), 1.1, 9);
    const dx = cos(light) * rimPx, dy = sin(light) * rimPx;
    const baseFill = o.fill || st.fill;
    const omni = (o.backlight === undefined ? st.omni : o.backlight);
    // 1) record the layers and measure them
    const rec = [];
    BC.reset();
    const F = {
      T: T0, s, flip: fl, light, devS, st, rimCol, rimK, bounds: true,
      fill: baseFill,
      tone(k, toward) { return k ? mixCol(baseFill, toward || '#c9d2e0', k) : baseFill; },
      // One flat layer. opt {fill, tone, toward, inner}
      // inner (0..1): rim on this layer's own light-facing edges (to separate overlapping parts). It is made by
      // drawing the layer twice: rim-tinted, then the plain fill shifted away from the light with 'source-atop'.
      layer(opt, draw) { rec.push([opt, draw]); BC.setTransform(T0); BC.lineWidth = 1; draw(BC, opt.fill || baseFill); },
      // free drawing in the same coordinates (colours are up to the caller; use 'source-atop' to stay inside)
      raw(draw) { rec.push([null, draw]); BC.setTransform(T0); BC.lineWidth = 1; draw(BC); },
      // hair sheen for drawHair (strand highlights + 天使の輪): colour, light vector in the local (possibly mirrored) frame
      hl(a) { return { col: rimCol, lx: fl * cos(light), ly: sin(light), a: (a === undefined ? 0.55 : a) * clamp(rimK) * st.rimA }; },
    };
    paint(F);
    F.bounds = false;
    if (BC.x1 <= BC.x0) return;
    const cw = ctx.canvas.width, ch = ctx.canvas.height, pad = Math.ceil(8 + rimPx * 5 + devS * 6);
    if (o._measure) return [BC.x0 - pad, BC.y0 - pad, BC.x1 + pad, BC.y1 + pad];
    const x0 = Math.max(0, Math.floor(BC.x0 - pad)), y0 = Math.max(0, Math.floor(BC.y0 - pad));
    const x1 = Math.min(cw, Math.ceil(BC.x1 + pad)), y1 = Math.min(ch, Math.ceil(BC.y1 + pad));
    if (x1 - x0 < 2 || y1 - y0 < 2) return;
    const bw = x1 - x0, bh = y1 - y0, sw = Math.ceil(bw / 4), sh = Math.ceil(bh / 4);
    const T = new DOMMatrix().translate(-x0, -y0).multiply(T0);
    const Tin = new DOMMatrix().translate(-dx * 0.85, -dy * 0.85).multiply(T);
    F.T = T;
    const A = buf('figA', bw, bh), Rb = buf('figR', bw, bh);
    const S = buf('figS', sw, sh), S2 = buf('figS2', sw, sh);
    const a = A.ctx; a.clearRect(0, 0, bw, bh);
    // 2) paint the layers flat
    for (const [opt, draw] of rec) {
      if (!opt) { a.save(); a.setTransform(T); a.lineWidth = 1; draw(a); a.restore(); continue; }
      const fc = opt.fill || (opt.tone ? F.tone(opt.tone, opt.toward) : baseFill);
      const inner = clamp((opt.inner || 0) * rimK * st.rimA);
      a.save(); a.setTransform(T); a.lineWidth = 1; prep(a, inner > 0 ? mixCol(fc, rimCol, inner) : fc); draw(a, fc); a.restore();
      if (inner > 0) { a.save(); a.setTransform(Tin); a.lineWidth = 1; a.globalCompositeOperation = 'source-atop'; prep(a, fc); draw(a, fc); a.restore(); }
    }
    if (st.grad > 0) { // soft style: faint directional gradient over the whole figure
      const cx = bw / 2, cy = bh / 2, R = Math.hypot(bw, bh) / 2, gk = st.grad;
      const g = a.createLinearGradient(cx + cos(light) * R, cy + sin(light) * R, cx - cos(light) * R, cy - sin(light) * R);
      g.addColorStop(0, PV.rgba(rimCol, gk * 0.5)); g.addColorStop(0.5, PV.rgba(rimCol, gk * 0.1)); g.addColorStop(1, 'rgba(0,0,0,' + (gk * 0.3).toFixed(3) + ')');
      a.globalCompositeOperation = 'source-atop'; a.fillStyle = g; a.fillRect(0, 0, bw, bh); a.globalCompositeOperation = 'source-over';
    }
    const gl = (o.glow === undefined ? st.glow : o.glow) * rimK;
    if (rimK > 0) {
      // 3) light from the silhouette's alpha. quarter-res mask first (wide falloff, omni backlight, halo)
      const sc = S.ctx; sc.globalCompositeOperation = 'copy'; sc.drawImage(A.canvas, 0, 0, bw, bh, 0, 0, sw, sh); sc.globalCompositeOperation = 'source-over';
      const wq = st.wideU * U * devS / 4; // quarter-res px
      const s2 = S2.ctx; rimInto(s2, S.canvas, sw, sh, cos(light) * wq, sin(light) * wq, rimCol, wq * 0.5);
      if (omni > 0) {
        const tmp = buf('figS3', sw, sh).ctx; rimInto(tmp, S.canvas, sw, sh, 0, 0, rimCol, clamp(st.omniU * U * devS / 4, 0.5, 6));
        s2.globalAlpha = clamp(omni * 0.75); s2.drawImage(tmp.canvas, 0, 0, sw, sh, 0, 0, sw, sh); s2.globalAlpha = 1;
      }
      // crisp rim (full res): silhouette minus itself shifted toward the light
      const r = Rb.ctx; r.globalCompositeOperation = 'copy'; r.drawImage(A.canvas, 0, 0, bw, bh, 0, 0, bw, bh);
      r.globalCompositeOperation = 'destination-out'; r.drawImage(A.canvas, 0, 0, bw, bh, -dx, -dy, bw, bh);
      r.globalCompositeOperation = 'source-in'; r.fillStyle = rimCol; r.fillRect(0, 0, bw, bh); r.globalCompositeOperation = 'source-over';
      a.globalCompositeOperation = 'source-atop'; a.globalAlpha = clamp(st.wideA * rimK); a.imageSmoothingQuality = 'high';
      a.drawImage(S2.canvas, 0, 0, sw, sh, 0, 0, bw, bh);
      a.globalAlpha = clamp(st.rimA * rimK); a.drawImage(Rb.canvas, 0, 0, bw, bh, 0, 0, bw, bh);
      a.globalAlpha = 1; a.globalCompositeOperation = 'source-over';
      if (gl > 0) { // halo source: a quarter-res rim, blurred (S2 is free again)
        const h = buf('figS3', sw, sh).ctx; rimInto(h, S.canvas, sw, sh, dx / 4, dy / 4, rimCol, 0);
        s2.globalCompositeOperation = 'copy'; s2.filter = 'blur(' + Math.max(0.8, rimPx * 0.8).toFixed(1) + 'px)';
        s2.drawImage(h.canvas, 0, 0, sw, sh, 0, 0, sw, sh); s2.filter = 'none'; s2.globalCompositeOperation = 'source-over';
      }
    }
    // 4) composite to target
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.drawImage(A.canvas, 0, 0, bw, bh, x0, y0, bw, bh);
    if (gl > 0 && rimK > 0) {
      const ga = ctx.globalAlpha; ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = ga * clamp(gl);
      ctx.drawImage(S2.canvas, 0, 0, sw, sh, x0, y0, bw, bh);
    }
    ctx.restore();
  }
  L.figureRender = figure; // exposed for other libs that want the same rim-light treatment
  // Static set pieces (hospital bed, blanket, bridge railing) go through the same light pipeline ONCE per
  // (key, light, colours, scale, device zoom quantised to 2^(1/4) steps) and are blitted afterwards. Small LRU.
  const PROP_CACHE = new Map();
  function cachedFigure(ctx, o, key, paint) {
    const m = ctx.getTransform(), zoom = Math.hypot(m.a, m.b);
    const q = Math.pow(2, Math.ceil(Math.log2(Math.max(0.05, zoom)) * 4 - 1e-6) / 4);
    // light parameters are quantised (0.03 rad, 0.05 steps) so a slowly animated light re-renders the prop only now and then
    const qz = (v, k) => (v === undefined ? undefined : Math.round(v / k) * k);
    const lo = { light: qz(o.light, 0.03), backlight: qz(o.backlight, 0.05), rim: qz(o.rim, 0.05), glow: qz(o.glow, 0.05) };
    const ck = key + '|' + q.toFixed(4) + '|' + JSON.stringify([o.scale, o.style, lo.light, o.rimColor, lo.rim, lo.backlight, lo.glow, o.fill, !!o.flip, o.rimWidth]);
    let e = PROP_CACHE.get(ck);
    if (e) { PROP_CACHE.delete(ck); PROP_CACHE.set(ck, e); } else {
      const o2 = Object.assign({}, o, lo, { x: 0, y: 0, alpha: undefined });
      const fake = { canvas: { width: 1e7, height: 1e7 }, getTransform: () => new DOMMatrix([q, 0, 0, q, 0, 0]) };
      const b = figure(fake, Object.assign({}, o2, { _measure: true }), null, paint); if (!b) return;
      const w = Math.ceil(b[2] - b[0]), h = Math.ceil(b[3] - b[1]); if (w < 2 || h < 2) return;
      const cv = PV.makeCanvas(w, h); cv.ctx.setTransform(q, 0, 0, q, -b[0], -b[1]);
      figure(cv.ctx, o2, null, paint);
      e = { canvas: cv.canvas, x0: b[0] / q, y0: b[1] / q, w: w / q, h: h / q };
      PROP_CACHE.set(ck, e); while (PROP_CACHE.size > 12) PROP_CACHE.delete(PROP_CACHE.keys().next().value);
    }
    ctx.save(); ctx.translate(o.x || 0, o.y || 0); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.drawImage(e.canvas, e.x0, e.y0, e.w, e.h); ctx.restore();
  }

  /* ================================================================= hair */
  // Long hair as overlapping ribbon "locks" (anime 髪束) + a few thin wisps, around a head centred at (0,0).
  // Every lock starts at the crown and first follows the skull (a meridian of the head ellipse, so the strands
  // converge on the whorl and the dome stays one smooth curve), then leaves the head at the nape / temple and
  // falls free: gravity, shoulder flare, wind (a clump of locks moves together), motion lag (swing).
  // o: view 'back'|'side', len (head centre -> tips), cap (half width), count, wisps, wind, windDir, droop,
  //    tilt (head rotation), swing (extra rad, e.g. motion lag), spread (shoulder flare), seed, thick, mess, backTilt
  const HC = { back: { cx: 0, cy: -0.02, ay: 0.57 }, side: { cx: -0.06, cy: -0.07, ax: 0.5, ay: 0.56 } };
  function hairLocks(t, o) {
    const back = (o.view || 'back') === 'back', n = o.count || 20, nw = o.wisps === undefined ? 5 : o.wisps, seed = o.seed || 7;
    const len = o.len || 2.7, cap = o.cap || 0.47, H = back ? HC.back : HC.side, ax = back ? cap : H.ax * cap / 0.47;
    const wind = o.wind || 0, wd = o.windDir === undefined ? 0 : o.windDir;
    const gust = 0.8 + 0.2 * N2(seed * 0.13, t * 0.42) + 0.1 * N2(seed * 0.21 + 5, t * 1.5);
    const Wd = wind * gust, Wc = Math.min(1, Wd), tilt = o.tilt || 0, swing = o.swing || 0, mess = o.mess || 0;
    const dsgn = cos(wd) >= 0 ? 1 : -1;
    const droop = (o.droop === undefined ? 0.34 : o.droop) * dsgn / (1 + Wd * 0.45);
    const nC = o.clumps || 5, spr = o.spread === undefined ? 0.05 : o.spread;
    const ct = cos(tilt), st = sin(tilt), rot = (p) => [p[0] * ct - p[1] * st, p[0] * st + p[1] * ct];
    const NS = 7, K = 16, locks = [];
    for (let i = 0; i < n + nw; i++) {
      const wisp = i >= n; const r = R1(i, seed), r2 = R1(i, seed + 1), r3 = R1(i, seed + 2), r4 = R1(i, seed + 3);
      let q; const skull = [];
      if (back) { // meridians of the back of the skull, crown -> nape (centre) / temple (sides)
        q = wisp ? (r * 2 - 1) * 0.9 : (n === 1 ? 0 : (i / (n - 1)) * 2 - 1);
        q = clamp(q + (r2 - 0.5) * 0.06, -1, 1);
        const sl = sin(q * 1.42), fL = lerp(2.2, 1.66, Math.abs(q)) + (r3 - 0.5) * 0.1;
        for (let j = 0; j <= NS; j++) { const ph = 0.04 + (fL - 0.04) * j / NS; skull.push(rot([H.cx + ax * sin(ph) * sl, H.cy - H.ay * cos(ph)])); }
      } else { // profile facing +x: arcs over the side / back of the head, from the parting to the nape
        q = wisp ? 0.15 + 0.7 * r : (n === 1 ? 0 : i / (n - 1));
        const rf = 1 - 0.3 * q, a0 = -HP + 0.5 - 0.6 * q, a1 = -PI - 0.78 + 0.3 * q + (r3 - 0.5) * 0.1 + Wc * (1 - q) * 0.6; // wind lifts the outer locks off the skull earlier
        for (let j = 0; j <= NS; j++) { const a = lerp(a0, a1, j / NS); skull.push(rot([H.cx + ax * rf * cos(a), H.cy + H.ay * rf * sin(a)])); }
      }
      const pe = skull[NS], pp = skull[NS - 1], tan0 = Math.atan2(pe[1] - pp[1], pe[0] - pp[0]);
      const Lf = Math.max(0.4, (len - pe[1]) * (back ? 1 - 0.16 * q * q : 1 - 0.06 * q) * (0.9 + 0.18 * r3) * (wisp ? 0.7 + 0.3 * r : 1));
      const curl = (r4 - 0.5) * (back ? 0.5 : 0.4) - (back ? q * 0.12 : 0), blendS = Math.min(0.6, 0.32 / Lf);
      const rest = back
        ? (s) => HP - q * 0.06 * bell(s * Lf, 0.12, 0.16) - q * spr * 2.2 * bell(s * Lf, 0.5, 0.28) + q * 0.12 * sstep(0.35, 1, s) + (r - 0.5) * (0.035 + mess * 0.5) * sstep(0.1, 0.5, s) + curl * sstep(0.72, 1, s)
        : (s) => HP + 0.08 + (r - 0.5) * 0.06 + (o.backTilt || 0) + (r - 0.5) * mess * 0.5 * sstep(0.1, 0.5, s) + curl * sstep(0.75, 1, s);
      const cl = Math.min(nC - 1, Math.max(0, Math.floor((back ? (q + 1) / 2 : q) * nC + (r - 0.5) * 0.5))), cR = R1(cl + 3, seed + 9), cR2 = R1(cl + 3, seed + 10);
      const ph = cR * TAU + (r - 0.5) * 0.3, fq = 0.7 + 0.35 * cR2;
      const fan = ((back ? q * 0.14 : (0.45 - q) * 0.7) + (cR - 0.5) * (back ? 0.32 : 0.45) + (r3 - 0.5) * 0.07) * (wisp ? 1.6 : 1);
      const pts = skull.slice(), ds = Lf / K; let p = pe;
      for (let j = 0; j < K; j++) {
        const s = (j + 0.5) / K;
        let th = angLerp(tan0, rest(s), sstep(0, blendS, s)) + swing * sstep(0.0, 0.85, s);
        const tgt = wd + droop + fan * Wc + 0.35 * N2(cl * 1.7 + 3.1 + r * 0.15, t * 0.5 + s * 0.8) * Math.min(1.2, Wd);
        th = angLerp(th, tgt, clamp(Wd * (0.15 + 0.85 * Math.pow(s, 0.7)) * (wisp ? 1.15 : 1)) * 0.95);
        th += Wd * (0.24 + 0.08 * r) * Math.pow(s, 0.9) * sin(TAU * (s * 0.95 - t * fq) + ph) * (wisp ? 1.4 : 1);
        th += Wd * 0.06 * sin(TAU * (s * 2.6 - t * fq * 1.7) + ph * 2.0) * s;
        th += (0.03 + 0.025 * r) * sin(t * 1.05 + cl * 1.3 + r * 0.5) * s * (1 - Wc);
        p = [p[0] + cos(th) * ds, p[1] + sin(th) * ds]; pts.push(p);
      }
      const w0 = wisp ? 0.008 + 0.009 * r : (back ? (cap * 2.4 / n) * (0.75 + 0.7 * r2) : (0.065 + 0.055 * r2)) * (o.thick || 1) * (1 + 0.22 * Wc);
      const tap = 0.42 + 0.3 * r4, ex = 0.8 + 0.5 * r, ws = [];
      for (let j = 0; j <= NS; j++) ws.push(wisp ? w0 : w0 * (0.3 + 0.7 * sstep(0, 0.7, j / NS)));
      for (let j = 1; j <= K; j++) {
        const s = j / K;
        ws.push(wisp ? w0 * (1 - s) + 0.001 : w0 * (1 + 0.1 * sin(PI * s)) * (1 - 0.1 * Wc * sstep(0.3, 1, s)) * Math.pow(1 - sstep(tap, 1, s), ex) + 0.0015);
      }
      locks.push({ pts, ws, i, q, cl, wisp, depth: wisp ? 0.2 : (back ? 1 - Math.abs(q) : 0.3 + 0.7 * q) });
    }
    locks.sort((a, b) => a.depth - b.depth);
    return locks;
  }
  // a ribbon's outline appended to the current path (all ribbons share one fill = their union)
  function ribbonPath(c, pts, ws) {
    const n = pts.length, A = [], B = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const t = norm(sub(b, a)); const w = ws[i];
      A.push([p[0] + t[1] * w, p[1] - t[0] * w]); B.push([p[0] - t[1] * w, p[1] + t[0] * w]);
    }
    const tip = pts[n - 1], t0 = norm(sub(pts[0], pts[1]));
    spline(c, A.concat([[tip[0], tip[1], 1]], B.reverse(), [[pts[0][0] + t0[0] * ws[0] * 0.8, pts[0][1] + t0[1] * ws[0] * 0.8]]), true);
  }
  // sheen on black hair, for a light vector (lx,ly) in the hair's frame: a few strand lines grouped by clump
  // (never evenly spaced, fading at both ends) + the broken 天使の輪 band across the skull on the light side.
  function hairSheen(c, locks, o, hl) {
    const seed = o.seed || 7, back = (o.view || 'back') === 'back', NS = 7, lx = hl.lx, ly = hl.ly;
    c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = hl.col;
    for (const lk of locks) {
      if (lk.wisp) continue;
      const { pts, ws, i } = lk, n = pts.length;
      // light-facing side normal and how much this lock faces the light
      const tA = norm(sub(pts[Math.min(n - 1, NS + 4)], pts[NS])); let nx = -tA[1], ny = tA[0], f = nx * lx + ny * ly;
      if (f < 0) { nx = -nx; ny = -ny; f = -f; }
      const cw = R1(lk.cl, seed + 30);
      // (a) strand line
      if (R1(i, seed + 21) < 0.14 + 0.36 * cw && f > 0.2) {
        const sa = NS + Math.floor((0.05 + 0.3 * R1(i, seed + 22)) * (n - NS)), sb = Math.min(n - 2, sa + Math.floor((0.25 + 0.35 * R1(i, seed + 23)) * (n - NS)));
        if (sb > sa + 2) {
          const P = [], W = [];
          for (let j = sa; j <= sb; j++) { const e = sin(PI * (j - sa) / (sb - sa)); const off = ws[j] * (0.62 - 0.1 * e); P.push([pts[j][0] + nx * off, pts[j][1] + ny * off]); W.push(ws[j] * (0.035 + 0.075 * e) + 0.0025 * e); }
          c.globalAlpha = clamp(hl.a * 0.62 * (0.3 + 0.7 * f) * (0.5 + 0.5 * cw)); c.beginPath(); ribbonPath(c, P, W); c.fill();
        }
      }
      // (b) 天使の輪: a short dash on the skull part, brighter toward the light
      const mid = pts[Math.round(NS * 0.5)], rx = mid[0], ry = mid[1] + 0.2, rl = Math.hypot(rx, ry) || 1, fr = clamp((rx * lx + ry * ly) / rl * 0.9 + 0.2);
      if (fr > 0.2 && R1(i, seed + 26) < 0.75) {
        const j0 = Math.round(NS * (back ? 0.36 : 0.3) + (R1(i, seed + 24) - 0.5) * 2), j1 = j0 + 2 + (R1(i, seed + 25) < 0.5 ? 1 : 0);
        const P = [], W = [];
        for (let j = j0; j <= Math.min(NS, j1); j++) { const e = sin(PI * (j - j0 + 0.5) / (j1 - j0 + 1)); P.push(pts[j]); W.push(ws[j] * 0.26 * e + 0.0025); }
        if (P.length > 1) { c.globalAlpha = clamp(hl.a * (back ? 0.42 : 0.26) * fr); c.beginPath(); ribbonPath(c, P, W); c.fill(); }
      }
    }
    c.restore();
  }
  // draw hair at head centre hc (view 'back' | 'side'). o.hl = sheen {col, lx, ly, a} (from F.hl()) or none
  function drawHair(c, t, hc, o) {
    c.save(); c.translate(hc[0], hc[1]);
    const cap = o.cap || 0.47, back = (o.view || 'back') === 'back';
    if (o.capShape !== false) { // the skull under the locks: the same ellipse the meridians run on
      c.save(); c.rotate(o.tilt || 0);
      if (back) ell(c, HC.back.cx, HC.back.cy, cap * 0.99, HC.back.ay * 0.995); else ell(c, HC.side.cx, HC.side.cy, HC.side.ax * cap / 0.47, HC.side.ay);
      c.restore();
    }
    const locks = o._locks || hairLocks(t, o);
    c.beginPath(); for (const lk of locks) ribbonPath(c, lk.pts, lk.ws); c.fill();
    if (o.hl && o.hl.a > 0) hairSheen(c, locks, o, o.hl);
    c.restore();
  }
  // hair as its own layer: the inner rim traces the hair's edge where it lies over the dark back (so the long-hair
  // line stays readable on a silhouette), plus the sheen
  function hairLayers(F, t, hc, o, inner = 0.5) {
    o = Object.assign({}, o, { _locks: hairLocks(t, o), hl: o.hl === false ? null : F.hl(o.sheen) });
    F.layer({ inner }, (c) => drawHair(c, t, hc, o));
  }
  // a simple bust (head + neck + shoulders) under the hair, for standalone hair studies
  function bust(c, view) {
    if (view === 'side') {
      headProfile(c, false); seg(c, [-0.06, 0.3], [-0.12, 0.8], 0.17, 0.19);
      blob(c, [[-0.22, 0.7], [-0.37, 0.85], [-0.48, 1.15], [-0.5, 1.7], [-0.42, 2.3], [-0.22, 2.7], [0.12, 2.78], [0.32, 2.45], [0.4, 1.9], [0.44, 1.5], [0.36, 1.05], [0.2, 0.86], [0.05, 0.72]]);
    } else {
      ell(c, 0, 0, 0.42, 0.52); seg(c, [0, 0.3], [0, 0.82], 0.16, 0.17);
      blob(c, [[-0.17, 0.66], [-0.32, 0.82], [-0.55, 0.92], [-0.72, 1.04], [-0.8, 1.24], [-0.8, 1.6], [-0.74, 2.1], [-0.6, 2.55], [-0.3, 2.8], [0, 2.86],
        [0.3, 2.8], [0.6, 2.55], [0.74, 2.1], [0.8, 1.6], [0.8, 1.24], [0.72, 1.04], [0.55, 0.92], [0.32, 0.82], [0.17, 0.66]]);
    }
  }
  // PUBLIC: the heroine's long straight black hair. o.x,o.y = head centre; scale; view 'back'|'side';
  // len (head units, default 2.7 ≈ waist); wind 0..2; windDir; tilt; swing; seed; style (render with rim) or color (flat)
  L.hairLong = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const ho = Object.assign({ view: 'back' }, o);
    if (o.style) {
      figure(ctx, o, null, (F) => {
        if (o.bust) F.layer({}, (c) => { bust(c, ho.view); if (ho.view === 'side') { blob(c, GIRL_CAP_SIDE); girlBangsSide(c, tq, o.wind || 0, o.windDir); } });
        hairLayers(F, tq, [0, 0], ho);
      });
    } else {
      const s = (o.scale || 1) * U; ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.scale(o.flip ? -s : s, s);
      ctx.fillStyle = o.color || '#0c1019'; if (o.bust) bust(ctx, ho.view); drawHair(ctx, tq, [0, 0], ho); ctx.restore();
    }
  };

  /* ================================================================ specs */
  // all lengths in head units of the girl (1u = 92px at scale 1). Girl 7.2u tall, boy 7.8u.
  const GIRL = { hipY: 3.78, hipJ: 0.33, torso: 2.18, sh: 0.6, neckW: 0.15, waistH: 0.72, waist: 0.42, hip: 0.66, upArm: 1.15, foreArm: 0.98, hand: 0.72, armR: 0.125, thigh: 1.8, shin: 1.72, legR: 0.27, head: 1, neck: 0.7 };
  const BOY = { hipY: 4.08, hipJ: 0.36, torso: 2.42, sh: 0.8, neckW: 0.21, waistH: 0.8, waist: 0.56, hip: 0.6, upArm: 1.3, foreArm: 1.12, hand: 0.82, armR: 0.155, thigh: 1.95, shin: 1.88, legR: 0.3, head: 1.06, neck: 0.74, boy: true };

  /* ===================================================== hands & feet */
  // local frame: wrist at origin, fingers toward +x, thumb toward -y, palm toward +y. unit = girl hand length 0.78
  function handRelaxed(c, curl = 0.25) {
    const rot = (p) => { if (p[0] <= 0.34) return p; const a = curl * (p[0] - 0.34) * 2.4, dx = p[0] - 0.34, dy = p[1]; return [0.34 + dx * cos(a) - dy * sin(a), dx * sin(a) + dy * cos(a)]; };
    blob(c, [[0, -0.075], [0.14, -0.092], [0.34, -0.1], [0.5, -0.088], [0.63, -0.062], [0.72, -0.022], [0.735, 0.016], [0.69, 0.052], [0.56, 0.078], [0.4, 0.1], [0.2, 0.096], [0, 0.075]].map(rot));
    seg(c, [0.08, -0.05], [0.25, -0.115], 0.05, 0.036, 0.05, 0.4);
  }
  function handOpen(c, spread = 0.6, curl = 0.15) {
    blob(c, [[0, -0.11], [0.2, -0.15], [0.4, -0.14], [0.45, -0.03], [0.43, 0.1], [0.24, 0.14], [0, 0.11]]);
    const FG = [[-0.105, 0.33, 0.05], [-0.035, 0.37, 0.053], [0.035, 0.35, 0.05], [0.1, 0.28, 0.044]];
    FG.forEach(([y, l, w], i) => {
      let p = [0.4, y], ang = (i - 1.2) * 0.16 * spread;
      for (let j = 0; j < 3; j++) { const sl = l * [0.46, 0.31, 0.23][j]; const q = polar(p, ang, sl); seg(c, p, q, w * (1 - j * 0.1), w * (0.88 - j * 0.12)); p = q; ang += curl * (0.5 + j * 0.25); }
    });
    let p = [0.07, -0.09], ang = -0.7 - 0.3 * spread;
    for (let j = 0; j < 2; j++) { const q = polar(p, ang, [0.2, 0.16][j]); seg(c, p, q, 0.062, 0.05); p = q; ang += 0.35 + curl * 0.3; }
  }
  function handGrip(c) { // compact fist around a bar whose axis is perpendicular to the screen at x~0.36 (knuckles, thumb over)
    blob(c, [[0, -0.09], [0.15, -0.115], [0.3, -0.12], [0.41, -0.085], [0.46, -0.01], [0.43, 0.075], [0.33, 0.115], [0.17, 0.11], [0, 0.08]]);
    seg(c, [0.08, -0.08], [0.27, -0.135], 0.048, 0.04);
  }
  // hanging hand seen from behind (palm toward the thigh): a narrow blade, knuckles slightly wider, tips curled away
  function handBack(c) {
    blob(c, [[0, -0.05], [0.18, -0.062], [0.36, -0.066], [0.52, -0.058], [0.64, -0.04], [0.7, -0.012], [0.69, 0.02], [0.62, 0.042], [0.5, 0.06], [0.33, 0.07], [0.16, 0.064], [0, 0.05]]);
  }
  function hand(c, wrist, ang, size, kind, mirror, a, b) {
    local(c, wrist, ang, size / 0.78, mirror ? -1 : 1, (cc) => {
      if (kind === 'open') handOpen(cc, a === undefined ? 0.6 : a, b === undefined ? 0.15 : b);
      else if (kind === 'grip') handGrip(cc); else if (kind === 'back') handBack(cc); else handRelaxed(cc, a === undefined ? 0.25 : a);
    });
  }
  // shoes, side view. local: ankle at origin, toes toward +x, sole at y≈+0.28 (unit = head units)
  function shoeSide(c, kind) {
    if (kind === 'heel') blob(c, [[-0.12, -0.08], [-0.19, 0.05], [-0.18, 0.16, 1], [-0.12, 0.165], [-0.11, 0.285, 1], [-0.05, 0.285, 1], [-0.035, 0.2], [0.18, 0.205], [0.5, 0.26], [0.74, 0.28], [0.86, 0.255, 1], [0.79, 0.19], [0.5, 0.1], [0.22, 0.0], [0.06, -0.08]]);
    else if (kind === 'bare') blob(c, [[-0.12, -0.07], [-0.19, 0.1], [-0.15, 0.24], [0.2, 0.25], [0.66, 0.28], [0.8, 0.25], [0.75, 0.17], [0.45, 0.08], [0.15, -0.03], [0.04, -0.09]]);
    else if (kind === 'sneaker') blob(c, [[-0.13, -0.1], [-0.22, 0.06], [-0.22, 0.27, 1], [0.1, 0.3], [0.78, 0.3], [0.9, 0.24], [0.86, 0.1], [0.6, 0.0], [0.3, -0.04], [0.08, -0.12]]);
    else blob(c, [[-0.12, -0.06], [-0.2, 0.08], [-0.2, 0.27, 1], [0.1, 0.29], [0.7, 0.29], [0.86, 0.24], [0.83, 0.12], [0.58, 0.04], [0.3, -0.02], [0.08, -0.08]]);
  }
  function shoe(c, ankle, ang, size, kind) { local(c, ankle, ang, size, 1, (cc) => shoeSide(cc, kind)); }
  // shoe from behind (heel cup). lift raises the heel (foot plantarflexed)
  function shoeBack(c, ankle, w, kind, lift = 0) {
    const [x, y] = ankle; const h = 0.28 - lift * 0.1;
    blob(c, [[x - w * 0.75, y - 0.06], [x - w, y + 0.1], [x - w * 0.88, y + h * 0.9], [x, y + h], [x + w * 0.88, y + h * 0.9], [x + w, y + 0.1], [x + w * 0.75, y - 0.06]]);
    if (kind === 'heel') seg(c, [x, y + h * 0.8], [x, y + h + 0.11], 0.05, 0.035);
  }

  /* ================================================================ heads */
  // profile head facing +x; origin = head centre. girl / boy
  function headProfile(c, boy) {
    if (boy) blob(c, [[-0.04, -0.54], [0.22, -0.49], [0.37, -0.32], [0.41, -0.1], [0.405, -0.02], [0.475, 0.13, 1], [0.41, 0.19], [0.405, 0.27], [0.375, 0.34], [0.37, 0.42], [0.3, 0.47], [0.1, 0.45], [-0.06, 0.33], [-0.3, 0.2], [-0.45, -0.05], [-0.4, -0.33]]); // no lips: the face is never acted
    else blob(c, [[-0.04, -0.53], [0.22, -0.47], [0.36, -0.3], [0.395, -0.1], [0.385, -0.01], [0.465, 0.125, 1], [0.39, 0.175], [0.4, 0.23], [0.372, 0.262], [0.39, 0.295], [0.345, 0.34], [0.35, 0.395], [0.29, 0.44], [0.1, 0.42], [-0.04, 0.3], [-0.28, 0.2], [-0.44, -0.05], [-0.38, -0.33]]);
  }
  // boy's messy, slightly long hair from behind (head centre origin). The outline stays convex and left/right
  // symmetric (any one-sided notch reads as a face in profile); the tufts only hang down over the ears and nape.
  function boyHairBack(c, t, o) {
    const W = o.wind || 0, a = o.windDir || 0, wx = cos(a) * W, wy = sin(a) * W, sd = o.seed || 3;
    const tip = (i, x, y, k = 1, sh = 1) => { const n = N2(sd + i * 1.37, t * 1.5), m = N2(sd + 40 + i, t * 1.1); return [x + wx * 0.05 * k * (1 + 0.4 * n) + 0.01 * m, y + wy * 0.04 * k + Math.abs(wx) * 0.012 * k * n, sh]; };
    // the sides run convex all the way down to the nape line (a one-sided notch reads as a face); a cowlick at the
    // crown and soft bumps break the dome, pointed tufts only fall over the nape
    blob(c, [tip(0, 0.04, -0.69, 0.5), [0.16, -0.645], [0.31, -0.585], tip(1, 0.43, -0.49, 0.5, 0), [0.49, -0.35], tip(11, 0.525, -0.2, 0.5, 0), [0.515, -0.05],
      [0.5, 0.13], [0.458, 0.3], tip(3, 0.39, 0.43, 1.1), [0.3, 0.37], tip(4, 0.2, 0.5, 1.25), [0.1, 0.4], tip(5, 0.0, 0.535, 1.3), [-0.1, 0.4],
      tip(6, -0.2, 0.5, 1.25), [-0.3, 0.37], tip(7, -0.39, 0.43, 1.1), [-0.458, 0.3], [-0.5, 0.13], [-0.515, -0.05], tip(12, -0.525, -0.2, 0.5, 0),
      [-0.49, -0.35], tip(9, -0.43, -0.49, 0.5, 0), [-0.3, -0.59], tip(13, -0.17, -0.66, 0.6), [-0.06, -0.655]]);
  }
  // boy's hair in profile (facing +x, head centre origin): bangs hang over the brow and eyes (they also keep the
  // face unacted), volume on top, pointed tufts at the back and over the nape, a sideburn in front of the ear.
  function boyHairSide(c, t, wind, wd, seed, ht) {
    const W = wind || 0, a = wd === undefined ? PI : wd, wx = cos(a) * W, wy = sin(a) * W, sd = seed || 3, tl = ht || 0;
    // tips hang: when the head bows or tilts back, each tip turns back toward "down" by g (0..1) of the head rotation
    const G = { 0: 0.45, 1: 0.45, 2: 0.5, 3: 0.75, 4: 0.75, 5: 0.7 };
    const tf = (i, x, y, k = 1) => {
      const n = N2(sd + i * 1.7, t * 1.4), m = N2(sd + 30 + i * 0.9, t * 0.9), g = (G[i] || 0) * tl, cg = cos(-g), sg = sin(-g);
      const bx = x * 0.72, by = y * 0.72, dx = x - bx, dy = y - by; // pivot tufts around a point inside the head
      return [bx + dx * cg - dy * sg + wx * (0.06 + 0.03 * n) * k + 0.008 * m, by + dx * sg + dy * cg + wy * 0.05 * k + 0.02 * n * Math.min(1, W) * k, 1];
    };
    // soft volume swept back. The back of the skull stays one round curve (horizontal spikes there read as a nose and
    // mouth whenever the face itself is hidden, e.g. in the embrace); tips only at the bangs, sideburn and nape, plus a
    // single cowlick flicking up at the crown
    blob(c, [[0.16, -0.62], [0.34, -0.53], [0.45, -0.38], [0.475, -0.22], tf(0, 0.475, -0.01, 0.5), [0.43, -0.1], tf(1, 0.44, 0.05, 0.4), [0.39, -0.04],
      [0.28, -0.12], [0.17, -0.09], tf(2, 0.1, 0.19, 0.3), [0.03, 0.06], [-0.1, 0.1], [-0.15, 0.25], tf(3, -0.17, 0.47, 0.8), [-0.25, 0.36],
      tf(4, -0.33, 0.49, 1.0), [-0.4, 0.33], tf(5, -0.5, 0.42, 1.1), [-0.56, 0.17], [-0.62, -0.05], [-0.635, -0.26], [-0.6, -0.45],
      tf(7, -0.5, -0.66, 0.8), [-0.38, -0.66], [-0.18, -0.695], [0.02, -0.68]]);
  }
  // girl's fringe (profile), head centre origin
  function girlBangsSide(c, t, wind, wd) {
    const W = wind || 0, a = wd === undefined ? PI : wd; const wx = cos(a) * W;
    const b = (x, y, i, sh) => [x + wx * 0.08 * (1 + 0.4 * N2(i * 3.3, t * 1.4)), y - Math.abs(wx) * 0.04 * (1 + N2(i, t)), sh ? 1 : 0];
    blob(c, [[0.28, -0.44], b(0.41, -0.3, 0), b(0.45, -0.05, 1, 1), [0.385, -0.12], b(0.41, 0.0, 2, 1), [0.33, -0.08], [0.25, -0.02], [0.18, 0.06], [0.1, -0.2], [0.02, -0.42]]);
  }

  /* ======================================================== back-view bodies */
  // standing rig (ground origin). o: x (pelvis offset), weight -1..1 (which leg carries), lean, shrug, headTilt, headTurn
  function rigStandBack(sp, o = {}) {
    const w = o.weight || 0, aw = Math.abs(w);
    const P = [(o.x || 0) + 0.1 * w, -sp.hipY + 0.03 * aw + (o.bob || 0)];
    const pt = -0.075 * w + (o.pelvisTilt || 0);
    const pr = [cos(pt), sin(pt)];
    const hipL = [P[0] - pr[0] * sp.hipJ, P[1] - pr[1] * sp.hipJ], hipR = [P[0] + pr[0] * sp.hipJ, P[1] + pr[1] * sp.hipJ];
    const lam = (o.lean || 0) - 0.035 * w; const up = [sin(lam), -cos(lam)];
    const N = add(P, mul(up, sp.torso));
    const sa = lam + 0.06 * w + (o.shoulderTilt || 0); const sr = [cos(sa), sin(sa)];
    const shrugL = o.shrugL === undefined ? (o.shrug || 0) : o.shrugL, shrugR = o.shrugR === undefined ? (o.shrug || 0) : o.shrugR;
    const sc = add(N, mul(up, sp.boy ? -0.29 : -0.27));
    const SL = [sc[0] - sr[0] * sp.sh, sc[1] - sr[1] * sp.sh - shrugL], SR = [sc[0] + sr[0] * sp.sh, sc[1] + sr[1] * sp.sh - shrugR];
    const ht = (o.headTilt || 0) + lam * 0.6;
    const head = add(N, [sin(ht) * sp.neck + (o.headX || 0), -cos(ht) * sp.neck + (o.headY || 0)]);
    const fs = o.stance === undefined ? 0.25 : o.stance;
    // stride (walking away from camera): the unloaded foot peels off the ground, its knee bends and it reads higher
    const sl = 0.07 + 0.3 * (o.stride || 0), lL = w > 0 ? w : 0, lR = w < 0 ? -w : 0;
    const ankL = o.ankL || [hipL[0] - (w > 0 ? 0.02 : -0.02) - (fs - 0.25), -0.27 - sl * lL];
    const ankR = o.ankR || [hipR[0] + (w < 0 ? 0.02 : -0.02) + (fs - 0.25), -0.27 - sl * lR];
    const knL = add(mix2(hipL, ankL, 0.5), [0.04 + 0.07 * lL, 0.03 * lL - 0.12 * (o.stride || 0) * lL]);
    const knR = add(mix2(hipR, ankR, 0.5), [-0.04 - 0.07 * lR, 0.03 * lR - 0.12 * (o.stride || 0) * lR]);
    return { sp, P, pt, up, N, SL, SR, head, ht, hipL, hipR, knL, knR, ankL, ankR, liftL: w > 0 ? w : 0, liftR: w < 0 ? -w : 0 };
  }
  // seated rig (anchor = seat surface centre under this character at x). o: x, lean (sideways, rad), slump, headTilt
  function rigSitBack(sp, o = {}) {
    const P = [(o.x || 0), -0.24 * (sp.boy ? 1.08 : 1)];
    const lam = o.lean || 0; const up = [sin(lam), -cos(lam)];
    const tl = sp.torso * (1 - (o.slump || 0) * 0.08);
    const N = add(P, mul(up, tl));
    const sa = lam + (o.shoulderTilt || 0); const sr = [cos(sa), sin(sa)];
    const sc = add(N, mul(up, sp.boy ? -0.29 : -0.27));
    const SL = [sc[0] - sr[0] * sp.sh, sc[1] - sr[1] * sp.sh - (o.shrugL || 0)], SR = [sc[0] + sr[0] * sp.sh, sc[1] + sr[1] * sp.sh - (o.shrugR || 0)];
    const ht = (o.headTilt || 0) + lam * 0.5;
    const head = o.head || add(N, [sin(ht) * sp.neck, -cos(ht) * sp.neck + (o.headDrop || 0)]);
    const hipL = [P[0] - sp.hipJ, P[1]], hipR = [P[0] + sp.hipJ, P[1]];
    return { sp, P, up, N, SL, SR, head, ht, hipL, hipR, seated: true };
  }
  // torso from behind. outfit: 'blazer' | 'blouse' | 'shirt' (boy) | 'jacket' (boy)
  function torsoBack(c, R, outfit, t, wind, wd) {
    const sp = R.sp, up = R.up, Lt = len2(sub(R.N, R.P)), F = frame(R.P, up), k = Lt / sp.torso;
    const boy = !!sp.boy, rgt = [-up[1], up[0]], cap = sp.armR * 1.3;
    const W = wind || 0, wx = cos(wd || 0) * W;
    const side = (sg) => {
      const S = sg < 0 ? R.SL : R.SR; const d = sub(S, R.P);
      const sx = Math.abs(d[0] * rgt[0] + d[1] * rgt[1]), sh = d[0] * up[0] + d[1] * up[1], nw = sp.neckW;
      const fl = Math.max(0, wx * sg) * 0.07;
      // trapezius: neck base -> a sloped, slightly convex line -> the round deltoid that encloses the top of the arm
      // (the arm limb's cap must never stick out past it: that made the "coat hanger" shoulders)
      const nb = [nw, Lt + 0.1 * k], dt = [sx + 0.02, sh + cap * 1.12];
      const pts = [F(sg * nw * 0.92, Lt + 0.42 * k), F(sg * nb[0], nb[1]), F(sg * lerp(nb[0], dt[0], 0.4), lerp(nb[1], dt[1], 0.4) + 0.025),
        F(sg * lerp(nb[0], dt[0], 0.75), lerp(nb[1], dt[1], 0.75) + 0.02), F(sg * dt[0], dt[1]), F(sg * (sx + cap * 0.82), sh + cap * 0.62),
        F(sg * (sx + cap * 1.06), sh + cap * 0.02), F(sg * (sx + cap * 0.86), sh - 0.24), F(sg * (sx - cap * 0.85), sh - 0.42 * k), F(sg * (sp.waist + (sx - sp.waist) * (boy ? 0.45 : 0.3)), Lt - 1.0 * k)];
      if (outfit === 'blazer') pts.push(F(sg * (sp.waist + 0.035), sp.waistH * k), F(sg * (sp.hip * 0.95) + sg * fl, 0.06), [...F(sg * (sp.hip * 0.98) + sg * fl, -0.12), 1]);
      else if (outfit === 'shirt') pts.push(F(sg * (sp.waist + 0.05), sp.waistH * k), F(sg * (sp.waist + 0.09) + sg * fl, 0.04), [...F(sg * (sp.waist + 0.12) + sg * fl * 1.4, -0.14), 1]);
      else if (outfit === 'jacket') pts.push(F(sg * (sp.waist + 0.07), sp.waistH * k + 0.1), [...F(sg * (sp.waist + 0.04), 0.3), 1]);
      else pts.push(F(sg * sp.waist, sp.waistH * k), F(sg * sp.waist * 1.02, sp.waistH * k - 0.14));
      return pts;
    };
    const r = side(1), l = side(-1).reverse();
    const bottom = outfit === 'blazer' ? [F(0.06, -0.1), [...F(0, 0.1), 1], F(-0.06, -0.1)] : outfit === 'shirt' ? [F(0, -0.17 + wx * 0.02)] : outfit === 'jacket' ? [F(0, 0.27)] : [F(0, sp.waistH * k - 0.16)];
    blob(c, r.concat(bottom, l));
    if (boy && outfit !== 'jacket') seg(c, F(-0.2, Lt + 0.02), F(0.2, Lt + 0.02), 0.07, 0.07); // collar band
    if (outfit === 'jacket') blob(c, [F(-0.36, Lt - 0.02), F(-0.26, Lt + 0.2), F(0, Lt + 0.26), F(0.26, Lt + 0.2), F(0.36, Lt - 0.02), F(0, Lt - 0.08)]); // turned-up collar
    seg(c, R.N, add(R.head, [0, 0.22]), sp.neckW * 0.95, sp.neckW * 0.86);
  }
  function skirtBack(c, t, R, o = {}) {
    const sp = R.sp, F0 = frame(R.P, R.up); const Wc = F0(0, sp.waistH);
    const g = norm(mix2(R.up, [0, -1], 0.65)); const F = frame(Wc, g);
    const W = o.wind || 0, wd = o.windDir || 0, seed = o.seed || 3; const wx = cos(wd) * W, wy = sin(wd) * W;
    const len = o.len || 1.62, topW = sp.waist + 0.02, hipW = sp.hip + 0.06, hemW = o.hemW || 0.94, n = o.pleats || 13;
    const disp = (u, d) => {
      const lee = clamp(0.5 + 0.5 * Math.sign(wx || 1) * (u * 2 - 1));
      const n1 = N2(seed + u * 2.1, t * 1.7), n2 = N2(seed + 7 + u * 3.3, t * 2.6);
      return [wx * d * (0.1 + 0.32 * lee + 0.07 * n1) + 0.015 * W * d * n2, wy * d * 0.15 - Math.abs(wx) * d * (0.04 + 0.3 * lee * lee) * (0.75 + 0.35 * n2)];
    };
    const pts = [F(-topW, 0.02)];
    const hl = F(-hipW, -len * 0.36), dl = disp(0, 0.35); pts.push([hl[0] + dl[0], hl[1] + dl[1]]);
    for (let i = 0; i <= 2 * n; i++) {
      const u = i / (2 * n), x = lerp(-hemW, hemW, u), outer = i % 2 === 0;
      const yy = -len - 0.05 * sin(PI * u) + (outer ? 0 : 0.022);
      const p = F(x * (outer ? 1 : 0.99), yy), d = disp(u, 1);
      const wav = 0.03 * W * sin(TAU * (u * 1.6 - t * 1.9));
      pts.push([p[0] + d[0], p[1] + d[1] + wav, outer ? 1 : 0]);
    }
    const hr = F(hipW, -len * 0.36), dr = disp(1, 0.35); pts.push([hr[0] + dr[0], hr[1] + dr[1]]);
    pts.push(F(topW, 0.02));
    blob(c, pts);
  }
  // seated skirt on a bench, from behind
  function skirtSeatBack(c, t, R, o = {}) {
    const sp = R.sp, F0 = frame(R.P, R.up), wc = F0(0, sp.waistH), x = R.P[0];
    const n = 7, w = (o.w || 0.86), drop = o.drop === undefined ? 0.16 : o.drop;
    const pts = [F0(-sp.waist - 0.02, sp.waistH + 0.02), F0(-sp.hip - 0.06, 0.2), [x - w, -0.02]];
    for (let i = 0; i <= 2 * n; i++) { const u = i / (2 * n); pts.push([x + lerp(-w * 0.98, w * 0.98, u), drop * (0.6 + 0.4 * sin(PI * u)) + (i % 2 ? -0.04 : 0), i % 2 ? 0 : 1]); }
    pts.push([x + w, -0.02], F0(sp.hip + 0.06, 0.2), F0(sp.waist + 0.02, sp.waistH + 0.02));
    blob(c, pts); void wc;
  }
  function armSeg(c, S, E, Wr, sp, o = {}) {
    const r = sp.armR * (o.k || 1), sl = o.sleeve === undefined ? 1 : o.sleeve, sg = o.sg || (E[0] >= S[0] ? 1 : -1);
    limb(c, S, E, prof([[0, r * 1.3 * sl, r * 1.3 * sl], [0.13, r * 1.27 * sl, r * 1.08 * sl], [0.42, r * 1.0 * sl, r * 0.92 * sl], [0.86, r * 0.8 * sl, r * 0.78 * sl], [1, r * 0.76 * sl, r * 0.76 * sl]], sg));
    if (o.short) limb(c, E, Wr, prof([[0, r * 0.62, r * 0.62], [0.25, r * 0.7, r * 0.66], [1, r * 0.44, r * 0.42]], sg));
    else limb(c, E, Wr, prof([[0, r * 0.78 * sl, r * 0.78 * sl], [0.25, r * 0.86 * sl, r * 0.82 * sl], [0.83, r * 0.75 * sl, r * 0.73 * sl], [0.86, r * 0.5, r * 0.48], [1, r * 0.45, r * 0.44]], sg));
  }
  const LEG_THIGH = [[0, 0.3, 0.3], [0.22, 0.295, 0.27], [0.6, 0.245, 0.205], [0.9, 0.18, 0.162], [1, 0.168, 0.155]];
  const LEG_SHIN = [[0, 0.168, 0.155], [0.12, 0.172, 0.168], [0.27, 0.19, 0.194], [0.36, 0.184, 0.2], [0.62, 0.135, 0.136], [0.88, 0.092, 0.088], [1, 0.085, 0.082]];
  const TR_THIGH = [[0, 0.34, 0.3], [0.5, 0.29, 0.2], [1, 0.25, 0.18]]; // outer / inner: the inner edges leave a gap
  const TR_SHIN = [[0, 0.25, 0.18], [0.5, 0.235, 0.18], [1, 0.225, 0.19]];
  const scaleP = (P, k) => P.map(([f, a, b]) => [f, a * k, b * k]);
  function legBackSeg(c, H, K, A, sp, sg, trousers) {
    const k = sp.legR / 0.27;
    if (trousers) { limb(c, H, K, prof(scaleP(TR_THIGH, k), sg)); limb(c, K, A, prof(scaleP(TR_SHIN, k), sg)); return; }
    limb(c, H, K, prof(scaleP(LEG_THIGH, k), sg)); limb(c, K, A, prof(scaleP(LEG_SHIN, k), sg));
  }
  function legsStandBack(c, R, shoes, trousers) {
    const sp = R.sp;
    legBackSeg(c, R.hipL, R.knL, R.ankL, sp, -1, trousers); legBackSeg(c, R.hipR, R.knR, R.ankR, sp, 1, trousers);
    const sw = trousers ? 0.17 : 0.125;
    shoeBack(c, R.ankL, sw, shoes, R.liftL); shoeBack(c, R.ankR, sw, shoes, R.liftR);
    if (trousers) { // seat of the trousers
      const F = frame(R.P, R.up);
      blob(c, [F(-sp.waist - 0.02, sp.waistH), F(-sp.hip - 0.02, 0.1), F(-sp.hip + 0.06, -0.4), F(0, -0.22), F(sp.hip - 0.06, -0.4), F(sp.hip + 0.02, 0.1), F(sp.waist + 0.02, sp.waistH)]);
    }
  }

  /* ================================================================ props */
  function pianoBench(c, w) {
    // padded top (slight dome), apron, four turned legs (the far pair is shorter: depth)
    blob(c, [[-w + 0.1, -0.1], [0, -0.13], [w - 0.1, -0.1], [w + 0.03, -0.03], [w + 0.05, 0.12, 1], [w + 0.02, 0.3], [-w - 0.02, 0.3], [-w - 0.05, 0.12, 1], [-w - 0.03, -0.03]]);
    c.fillRect(-w + 0.04, 0.28, 2 * w - 0.08, 0.22);
    for (const sx of [-1, 1]) {
      limb(c, [sx * (w - 0.12), 0.45], [sx * (w - 0.1), 2.08], [[0, 0.085, 0.085], [0.12, 0.1, 0.1], [0.3, 0.065, 0.065], [0.85, 0.055, 0.055], [1, 0.05, 0.05]]);
      limb(c, [sx * (w - 0.42), 0.45], [sx * (w - 0.4), 1.9], [[0, 0.07, 0.07], [0.12, 0.08, 0.08], [0.3, 0.05, 0.05], [1, 0.042, 0.042]]);
    }
    c.fillRect(-w + 0.12, 1.2, 2 * w - 0.24, 0.07);
  }
  function parkBench(c, w, backrest) {
    // legs + frame
    for (const sx of [-1, 1]) {
      c.fillRect(sx * w - 0.08, -1.55, 0.16, 3.6); // back post + leg
      c.fillRect(sx * (w - 0.18) - 0.06, 0.05, 0.12, 1.85); // front leg (further away)
    }
    c.fillRect(-w - 0.05, 0.0, 2 * w + 0.1, 0.16); // seat edge
    c.fillRect(-w, 0.9, 2 * w, 0.08); // stretcher
    if (backrest !== false) for (const [y0, y1] of [[-0.42, -0.66], [-0.82, -1.06], [-1.22, -1.46]]) {
      c.beginPath(); c.roundRect(-w - 0.16, y1, 2 * w + 0.32, y0 - y1, 0.04); c.fill();
    }
  }
  function grassStrip(c, t, x0, x1, y, seed, wind) { // foreground tufts in front of a ground-seated figure: clumps, ragged ends
    const n = Math.round((x1 - x0) * 30);
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const r = R1(i, seed), u = (i + r * 0.8) / n, x = x0 + (x1 - x0) * u;
      const clump = 0.45 + 0.55 * (0.5 + 0.5 * N2(x * 1.6 + seed, 3.3));
      const edge = sstep(0, 0.25, u) * sstep(0, 0.25, 1 - u) * (0.55 + 0.45 * R1(i, seed + 7));
      const h = (0.06 + 0.36 * R1(i, seed + 1)) * clump * edge; if (h < 0.025) continue;
      const w = 0.018 + 0.018 * R1(i, seed + 2), b0 = y + 0.1 + 0.04 * R1(i, seed + 4);
      const sway = (wind || 0.3) * (0.06 + 0.05 * N2(i * 0.3, t * 1.2)) + (R1(i, seed + 3) - 0.5) * 0.18;
      c.moveTo(x - w, b0); c.quadraticCurveTo(x - w * 0.3 + sway * 0.5, y - h * 0.55, x + sway, y - h); c.quadraticCurveTo(x + w * 0.3 + sway * 0.4, y - h * 0.5, x + w, b0); c.closePath();
    }
    c.fill();
  }
  function railing(c, y, x0, x1, kind) {
    if (kind === 'bridge') {
      c.fillRect(x0, y - 0.1, x1 - x0, 0.2); c.fillRect(x0, y + 0.9, x1 - x0, 0.1); c.fillRect(x0, -0.35, x1 - x0, 0.35);
      for (let x = x0 + 0.2; x <= x1; x += 0.42) c.fillRect(x - 0.03, y, 0.06, -y);
      for (let x = x0 + 0.6; x <= x1; x += 2.6) c.fillRect(x - 0.1, y - 0.12, 0.2, -y + 0.12);
    } else {
      c.fillRect(x0, y - 0.07, x1 - x0, 0.14); c.fillRect(x0, y + 0.75, x1 - x0, 0.06);
      for (let x = x0 + 0.2; x <= x1; x += 0.9) c.fillRect(x - 0.035, y, 0.07, -y);
    }
  }

  /* =========================================================== figures */
  /* ----------------------------------------------------- girlAtRailing */
  // anchor: ground point between her feet. o.wind (default 1), windDir (0 = to the right), railY (rail height, local, default -4.3),
  // railing (true|false|'bridge'), hands 'rail'|'sides', cast (right arm in a sling), outfit 'blazer'|'blouse', hairLen
  L.girlAtRailing = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const W = o.wind === undefined ? 1.0 : o.wind, wd = o.windDir === undefined ? 0 : o.windDir;
    const sp = GIRL, seed = o.seed || 11, sgw = Math.sign(cos(wd)) || 1;
    const sway = 0.025 * N2(seed, tq * 0.35) + W * 0.012 * N2(seed + 3, tq * 1.2);
    const railY = o.railY === undefined ? -4.5 : o.railY;
    const R = rigStandBack(sp, { weight: o.weight === undefined ? 0.6 : o.weight, lean: sway + 0.02 * W * sgw, shrug: o.hands === 'sides' ? 0 : 0.03, headTilt: (o.headTilt || 0) + 0.04 * sgw * W });
    const cast = !!o.cast, handsOnRail = o.hands !== 'sides';
    const hairO = { view: 'back', len: o.hairLen || 2.75, wind: W * 1.1, windDir: wd + (o.windLift === undefined ? -0.1 * sgw : o.windLift), seed: seed + 5, tilt: R.ht * 0.6 };
    const skO = { wind: W, windDir: wd, seed };
    if (o.railing !== false) cachedFigure(ctx, o, 'rail|' + o.railing + '|' + railY, (F) => F.layer({ tone: 0.04 }, (c) => railing(c, railY, -4.8, 4.8, o.railing)));
    const castTone = o.castTone === undefined ? 0.62 : o.castTone, E = add(R.SR, [0.12, 0.98]);
    figure(ctx, o, null, (F) => {
      F.layer({}, (c) => {
        legsStandBack(c, R, 'loafer');
        skirtBack(c, tq, R, skO);
        torsoBack(c, R, o.outfit || 'blazer', tq, W, wd);
        const hand2 = (S, sg) => {
          if (handsOnRail) { // forearms go forward to the rail: elbows out, hands hidden in front of her
            const spread = o.handSpread === undefined ? 0.3 : o.handSpread;
            const hp = [R.P[0] + sg * spread, railY - 0.02];
            const E2 = add(S, [sg * 0.2, 0.98]);
            armSeg(c, S, E2, hp, sp, { sg });
            if (Math.abs(hp[0] - R.P[0]) > 0.5) ell(c, hp[0], hp[1] - 0.04, 0.11, 0.09);
          } else {
            const E2 = add(S, [sg * 0.15, 1.13]), Wr = add(E2, [sg * 0.03, 0.95]);
            armSeg(c, S, E2, Wr, sp); hand(c, Wr, HP + sg * 0.08, sp.hand, 'back', sg < 0);
          }
        };
        hand2(R.SL, -1);
        if (cast) limb(c, R.SR, E, prof([[0, sp.armR * 1.3, sp.armR * 1.3], [0.4, sp.armR * 1.12, sp.armR * 1.0], [1, sp.armR * 0.95, sp.armR * 0.95]], 1)); // upper arm, elbow bent forward
        else hand2(R.SR, 1);
      });
      if (cast) F.layer({ fill: F.tone(castTone, '#f4f7fa'), inner: 0.4 }, (c) => {
        // from behind only the elbow end of the white cast/pouch shows at her side, and the sling strap crossing the
        // upper back from that elbow to the far side of the neck (half under the hair)
        const n0 = add(R.N, [-0.08, 0.52]), n1 = add(R.N, [0.05, 0.46]);
        blob(c, [n0, add(mix2(n0, add(E, [-0.16, -0.18]), 0.55), [0.03, 0]), add(E, [-0.18, -0.08]), add(E, [-0.14, 0.12]), [...add(E, [0.13, 0.25]), 1], add(E, [0.2, 0.02]),
          add(E, [0.12, -0.2]), mix2(n1, add(E, [0.12, -0.2]), 0.5), n1]);
        c.save(); c.strokeStyle = mixCol(F.tone(castTone, '#f4f7fa'), '#000000', 0.22); c.lineWidth = 0.018; // two folds of the cloth
        c.beginPath(); c.moveTo(E[0] - 0.1, E[1] - 0.02); c.quadraticCurveTo(E[0] + 0.02, E[1] + 0.06, E[0] + 0.09, E[1] + 0.18);
        c.moveTo(E[0] - 0.02, E[1] - 0.14); c.quadraticCurveTo(E[0] + 0.08, E[1] - 0.04, E[0] + 0.15, E[1] + 0.02); c.stroke(); c.restore();
      });
      hairLayers(F, tq, R.head, hairO);
    });
  };

  /* ---------------------------------------------------- girlAtPianoBack */
  // anchor: bench top centre. o.intensity 0..1 (calm -> 〈雪あらし〉), o.bench (true), o.outfit 'blouse'|'blazer', o.wind (breeze)
  L.girlAtPianoBack = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const I = o.intensity === undefined ? 0.3 : o.intensity, sp = GIRL, seed = o.seed || 21;
    const turn = o.turn === undefined ? 0.35 : o.turn; // + : camera behind her right shoulder (we see her right arm reach)
    const ph = tq * (1.4 + I * 1.8);
    // performance: lateral sway following the hands, forward surges on accents, shoulders tense up
    const swayX = I * (0.2 * sin(ph * 0.7) + 0.08 * N2(seed, tq * 1.3)) + 0.015 * sin(tq * 0.8);
    const surge = Math.pow(Math.max(0, sin(ph * 0.45 + 1)), 2);
    const fwd = 0.08 + I * (0.12 + 0.2 * surge);
    const accent = I * Math.max(0, N2(seed + 7, tq * 2.2)) * 0.14;
    const lean = swayX * 0.38;
    const R = rigSitBack(sp, { x: swayX * 0.4, lean, slump: fwd * 1.6, headTilt: lean * 0.6 + I * 0.12 * sin(ph * 0.9) + turn * 0.08, shrugL: accent, shrugR: accent * 0.7, headDrop: fwd * 0.6 });
    // oblique view: far (left) shoulder tucks in, near (right) shoulder opens
    R.SL = add(R.SL, [0.13 * turn, -0.03 * turn]); R.SR = add(R.SR, [0.04 * turn, 0]);
    R.head = add(R.head, [0.07 * turn, 0]);
    const kY = -1.3;
    const hlx = R.P[0] - 0.3 - I * (0.32 + 0.38 * (0.5 + 0.5 * sin(ph * 0.9))) + 0.04 * sin(tq * 3.1);
    const hrx = R.P[0] + 0.32 + 0.38 * turn + I * (0.36 + 0.55 * (0.5 + 0.5 * sin(ph * 0.8 + 2.0))) + 0.05 * sin(tq * 2.7);
    const swing = -lean * 1.8 - I * 0.24 * cos(ph * 0.7);
    const hairO = { view: 'back', len: o.hairLen || 2.5, wind: (o.wind || 0.05) + I * 0.12 * surge, windDir: o.windDir === undefined ? (swing > 0 ? PI : 0) : o.windDir, seed: seed + 3, tilt: R.ht * 0.7, swing, spread: 0.1 };
    const bench = o.bench !== false;
    figure(ctx, o, null, (F) => {
      // calves under the bench go forward to the pedals = further away than the bench: thinner, hazier, feet higher
      F.layer({ tone: 0.06, toward: '#9aa6b8' }, (c) => {
        for (const sg of [-1, 1]) { const x = R.P[0] * 0.3 + sg * 0.2 + 0.05 * turn; limb(c, [x, 0.3], [x - sg * 0.02, 1.42], prof([[0, 0.12, 0.12], [0.3, 0.13, 0.135], [0.75, 0.075, 0.075], [1, 0.065, 0.065]], sg)); shoeBack(c, [x - sg * 0.02, 1.42], 0.09, 'loafer', 0.5); }
      });
      F.layer({}, (c) => {
        if (bench) pianoBench(c, 1.3);
        // far arm: hidden behind her back unless the hand travels far into the bass
        const eL = add(R.SL, [-0.16 - I * 0.12, 0.95]);
        armSeg(c, R.SL, eL, [hlx, kY], sp, { sg: -1 });
        if (hlx < R.P[0] - 0.7) ell(c, hlx - 0.06, kY - 0.02, 0.13, 0.08, 0.2);
        skirtSeatBack(c, tq, R, { w: 0.84 });
        torsoBack(c, R, o.outfit || 'blouse', tq, 0, 0);
      });
      hairLayers(F, tq, R.head, hairO);
      // near arm reaches forward-right to the treble (seen past her side in the oblique view)
      F.layer({ inner: 0.5 }, (c) => {
        const eR = add(R.SR, [0.24 + I * 0.14 + 0.12 * turn, 0.92]);
        armSeg(c, R.SR, eR, [hrx, kY], sp, { sg: 1 });
        if (hrx > R.P[0] + 0.62) { local(c, [hrx, kY], -0.2, sp.hand / 0.78 * 0.62, 1, (cc) => blob(cc, [[0, -0.08], [0.22, -0.11], [0.42, -0.07], [0.48, 0.02], [0.42, 0.1], [0.2, 0.1], [0, 0.08]])); }
      });
    });
  };

  /* ------------------------------------------------- coupleSittingBack */
  // anchor: seat centre between them (bench top or ground). o.seat 'bench'|'grass', o.lean 0..1 (her head on his shoulder),
  // o.earphones (shared wired earphones), o.wind, windDir. Girl sits on the left, boy on the right (flip to swap).
  L.coupleSittingBack = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const lean = o.lean === undefined ? 0 : o.lean, W = o.wind === undefined ? 0.2 : o.wind, wd = o.windDir === undefined ? 0 : o.windDir;
    const grass = o.seat === 'grass', seed = o.seed || 41;
    const br = 0.012 * sin(tq * 1.6), br2 = 0.012 * sin(tq * 1.4 + 1);
    const B = rigSitBack(BOY, { x: 0.74, lean: -0.02 * lean, headTilt: -0.12 * lean + 0.03 * N2(seed, tq * 0.3), shrugL: 0.03 * lean + br2 });
    const gl = lean * 0.2;
    const G0 = rigSitBack(GIRL, { x: -0.66 + 0.1 * lean, lean: gl, shrugR: br });
    // head rests on his left shoulder when leaning
    const restHead = add(B.SL, [-0.18, -0.46]);
    const headG = mix2(G0.head, restHead, sstep(0.0, 1.0, lean));
    const G = rigSitBack(GIRL, { x: -0.66 + 0.1 * lean, lean: gl, shrugR: br, head: headG, headTilt: 0 });
    const gTilt = gl + 0.55 * lean;
    const hairO = { view: 'back', len: 2.4, wind: W, windDir: wd, seed: seed + 2, tilt: gTilt * 0.85, swing: -gTilt * 0.6 };
    const boyHair = { wind: W, windDir: wd, seed: seed + 9 };
    // shared wired earphones: her right ear -> Y-split -> his left ear, single cord down to his lap
    let cable = null;
    if (o.earphones) { // the iconic V of a shared cord between the two heads; one cord runs on down the seam between them
      const er = add(G.head, [0.36 * cos(gTilt) - 0.08 * sin(gTilt), 0.1 + 0.36 * sin(gTilt)]), el = add(B.head, [-0.5 * cos(B.ht), 0.12 - 0.5 * sin(B.ht)]);
      const jx = lerp(er[0], el[0], 0.5) + 0.04, jy = Math.max(er[1], el[1]) + 0.62 + 0.25 * (1 - lean), sag = 0.02 * sin(tq * 1.3);
      cable = (c, part) => {
        c.lineCap = 'round'; c.beginPath();
        if (part === 'boy') { c.moveTo(el[0], el[1]); c.bezierCurveTo(el[0] - 0.03, el[1] + 0.3, jx + 0.05, jy - 0.3 - sag, jx, jy); c.stroke(); ell(c, el[0], el[1], 0.04, 0.05); return; }
        c.moveTo(er[0], er[1]); c.bezierCurveTo(er[0] + 0.03, er[1] + 0.3, jx - 0.06, jy - 0.28 + sag, jx, jy);
        c.moveTo(jx, jy); c.bezierCurveTo(jx + 0.02, jy + 0.45, jx + 0.06, jy + 0.9, jx + 0.04, jy + 1.35); c.stroke();
        ell(c, er[0], er[1], 0.04, 0.05); ell(c, jx, jy, 0.026, 0.05);
      };
    }
    figure(ctx, o, null, (F) => {
      // what shows under the seat is further away than the bench (feet in front of it): thinner, hazier, feet higher
      if (!grass) F.layer({ tone: 0.07, toward: '#9aa6b8' }, (c) => {
        for (const sg of [-1, 1]) {
          const xb = B.P[0] + sg * 0.27; limb(c, [xb, 0.15], [xb + sg * 0.04, 1.62], prof([[0, 0.15, 0.15], [0.35, 0.155, 0.16], [1, 0.12, 0.12]], sg)); shoeBack(c, [xb + sg * 0.04, 1.62], 0.14, 'loafer', 0.25);
          const xg = G.P[0] + sg * 0.17; limb(c, [xg, 0.15], [xg - sg * 0.02, 1.58], prof([[0, 0.12, 0.12], [0.3, 0.13, 0.135], [0.78, 0.075, 0.075], [1, 0.065, 0.065]], sg)); shoeBack(c, [xg - sg * 0.02, 1.58], 0.09, 'loafer', 0.35);
        }
      });
      // boy
      F.layer({}, (c) => {
        if (grass) { // right arm propped behind him
          const hp = [B.SR[0] + 0.5, -0.3]; const E = ik(B.SR, hp, BOY.upArm, BOY.foreArm * 0.92, -1);
          armSeg(c, B.SR, E, hp, BOY); hand(c, hp, 0.62, BOY.hand * 0.95, 'relaxed', true, 0.05);
        } else armSeg(c, B.SR, add(B.SR, [0.12, 1.1]), add(B.SR, [0.22, 1.9]), BOY);
        armSeg(c, B.SL, add(B.SL, [-0.06, 1.1]), add(B.SL, [0.12, 1.85]), BOY);
        blob(c, [add(B.P, [-0.66, 0.0]), add(B.P, [-0.6, -0.8]), add(B.P, [0.6, -0.8]), add(B.P, [0.66, 0.0]), add(B.P, [0.5, 0.2]), add(B.P, [-0.5, 0.2])]);
        torsoBack(c, B, o.boyOutfit || 'shirt', tq, W * 0.5, wd);
        c.save(); c.translate(B.head[0], B.head[1]); c.rotate(B.ht); c.scale(BOY.head, BOY.head); boyHairBack(c, tq, boyHair); c.restore();
      });
      const cordLit = (c, part) => { c.strokeStyle = c.fillStyle = PV.mix('#9aa3b5', F.rimCol, 0.55, 0.85); c.lineWidth = 0.02; cable(c, part); };
      if (cable) { F.layer({}, (c) => { c.lineWidth = 0.035; cable(c, 'boy'); }); F.raw((c) => cordLit(c, 'boy')); }
      // girl (inner rim separates her from his shoulder)
      F.layer({ inner: 0.55 }, (c) => {
        armSeg(c, G.SL, add(G.SL, [-0.1, 1.0]), add(G.SL, [0.15, 1.55]), GIRL);
        armSeg(c, G.SR, add(G.SR, [0.08, 1.0]), add(G.SR, [-0.1, 1.55]), GIRL);
        skirtSeatBack(c, tq, G, { w: 0.8, drop: grass ? 0.05 : 0.1 });
        torsoBack(c, G, o.girlOutfit || 'blazer', tq, 0, 0);
      });
      hairLayers(F, tq, G.head, hairO, 0.6);
      if (cable) { F.layer({}, (c) => { c.lineWidth = 0.035; cable(c, 'girl'); }); F.raw((c) => cordLit(c, 'girl')); } // behind the bench slats
      // the bench is between us and them: worn wood, a touch lighter, light catching the top edges of the slats
      if (grass) F.layer({ tone: 0.05 }, (c) => grassStrip(c, tq, -3.3, 3.3, 0.12, seed, W));
      else F.layer({ tone: 0.17, toward: '#8f7c6a', inner: 0.8 }, (c) => parkBench(c, 2.35, o.backrest));
    });
  };

  /* ---------------------------------------------------- coupleUmbrella */
  // anchor: ground centre between them. o.walk 0..1 (walking cycle), o.umbrella 'dark'|'clear', o.tilt (toward her, rad),
  // o.wind, o.drips (true). Girl left, boy right holding the umbrella with his left hand.
  L.coupleUmbrella = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const wk = o.walk === undefined ? 0.6 : o.walk, W = o.wind === undefined ? 0.15 : o.wind, wd = o.windDir === undefined ? 0 : o.windDir;
    const seed = o.seed || 51, cyc = tq * 1.7 * TAU * 0.5;
    const stepG = sin(cyc), stepB = sin(cyc * 0.94 + 0.6);
    const bobG = -Math.abs(cos(cyc)) * 0.05 * wk, bobB = -Math.abs(cos(cyc * 0.94 + 0.6)) * 0.05 * wk;
    const G = rigStandBack(GIRL, { x: -0.62, weight: stepG * 0.55 * wk + (1 - wk) * 0.3, stride: wk, bob: bobG, lean: 0.02, headTilt: 0.06 });
    const B = rigStandBack(BOY, { x: 0.68, weight: stepB * 0.55 * wk - (1 - wk) * 0.3, stride: wk, bob: bobB, lean: -0.025, headTilt: -0.05, shrugL: 0.1, stance: 0.31 });
    const tilt = o.tilt === undefined ? -0.2 : o.tilt;
    const hold = add(B.SL, [0.02, 0.62]); // his left hand in front of his chest (hidden by his back)
    const SH = 3.6, top = add(hold, [sin(tilt) * SH, -cos(tilt) * SH]); // ferrule: the canopy's rim clears his head
    const hairO = { view: 'back', len: 2.6, wind: W, windDir: wd, seed: seed + 4, tilt: G.ht * 0.5, swing: 0.03 * stepG * wk };
    const clear = o.umbrella === 'clear';
    // canopy seen from behind and a little BELOW (we are under it): the outer dome down to the near rim (upper arc of
    // the rim ellipse), and under it the lens of the inside of the canopy, closed by the far rim (lower arc, scalloped)
    const RW = 2.25, RH = 1.32, RE = 0.27, NR = 8;
    const rimPt = (al) => [cos(al) * RW, RH + sin(al) * RE];
    const dome = (x) => RH * (1 - Math.pow(Math.max(0, 1 - (x / RW) * (x / RW)), 0.62));
    const toW = (p) => [top[0] + p[0] * cos(tilt) - p[1] * sin(tilt), top[1] + p[0] * sin(tilt) + p[1] * cos(tilt)];
    const farEdge = () => { // scalloped lower edge, right tip -> left tip (far half: al 0..PI); tips slightly pointed
      const P = [];
      for (let i = 0; i <= NR; i++) {
        const al = PI * i / NR, tp = rimPt(al); P.push([tp[0] * 1.012, tp[1] + 0.025, 1]);
        if (i < NR) { const m = rimPt(PI * (i + 0.5) / NR); P.push([m[0] * 0.985, m[1] - 0.05]); }
      }
      return P;
    };
    const silhouette = (c) => {
      c.save(); c.translate(top[0], top[1]); c.rotate(tilt);
      const P = [];
      for (let i = 0; i <= 16; i++) { const x = -RW + 2 * RW * i / 16; P.push([x, dome(x)]); }
      P[0] = [-RW * 1.012, RH + 0.025, 1]; P[16] = [RW * 1.012, RH + 0.025, 1];
      c.beginPath(); spline(c, P.concat(farEdge().slice(1, -1)), true); c.fill();
      c.beginPath(); c.moveTo(-0.025, 0.02); c.lineTo(-0.012, -0.2); c.lineTo(0.012, -0.2); c.lineTo(0.025, 0.02); c.fill(); // ferrule
      c.restore();
    };
    const lens = (c) => { // the inside of the canopy: near rim (upper arc) -> far rim (scalloped lower arc)
      c.save(); c.translate(top[0], top[1]); c.rotate(tilt);
      const P = []; for (let i = 0; i <= 16; i++) P.push(rimPt(PI + PI * i / 16));
      P[0] = [-RW * 1.012, RH + 0.025, 1]; P[16] = [RW * 1.012, RH + 0.025, 1];
      c.beginPath(); spline(c, P.concat(farEdge().slice(1, -1)), true); c.fill();
      c.restore();
    };
    const ribsIn = (c) => { // ribs inside, from the runner on the shaft out to the far tips
      c.save(); c.translate(top[0], top[1]); c.rotate(tilt);
      for (let i = 1; i < NR; i++) { const tp = rimPt(PI * i / NR); c.beginPath(); c.moveTo(0, RH - RE * 0.55); c.quadraticCurveTo(tp[0] * 0.55, RH - RE * 0.2 + (tp[1] - RH) * 0.3, tp[0], tp[1]); c.stroke(); }
      c.restore();
    };
    const ribsOut = (c) => { // ribs on the outer surface, ferrule -> near tips
      c.save(); c.translate(top[0], top[1]); c.rotate(tilt);
      for (let i = 1; i < NR; i++) { const al = PI + PI * i / NR, tp = rimPt(al); c.beginPath(); c.moveTo(0, 0.02); c.quadraticCurveTo(tp[0] * 0.62, dome(tp[0] * 0.62) * 0.55 + (tp[1] - RH) * 0.4, tp[0], tp[1]); c.stroke(); }
      c.restore();
    };
    const shaft = (c, lw = 0.055) => { const a = toW([0, RH - RE * 0.55]); c.lineWidth = lw; c.beginPath(); c.moveTo(hold[0], hold[1] + 0.2); c.lineTo(a[0], a[1]); c.stroke(); };
    figure(ctx, o, null, (F) => {
      F.layer({}, (c) => {
        legsStandBack(c, B, 'loafer', true);
        torsoBack(c, B, 'blazer', tq, W * 0.4, wd);
        armSeg(c, B.SR, add(B.SR, [0.1, 1.2]), add(B.SR, [0.14, 2.25]), BOY); hand(c, add(B.SR, [0.14, 2.25]), HP - 0.05, BOY.hand, 'back', true);
        armSeg(c, B.SL, add(B.SL, [-0.2, 0.95]), hold, BOY);
        c.save(); c.translate(B.head[0], B.head[1]); c.rotate(B.ht); c.scale(BOY.head, BOY.head); boyHairBack(c, tq, { wind: W * 0.4, windDir: wd, seed: seed + 8 }); c.restore();
        shaft(c);
      });
      if (clear) F.raw((c) => { c.strokeStyle = PV.rgba('#ffffff', 0.5); shaft(c, 0.022); });
      F.layer({ inner: 0.5 }, (c) => {
        legsStandBack(c, G, 'loafer');
        skirtBack(c, tq, G, { wind: W * 0.5, windDir: wd, seed });
        torsoBack(c, G, 'blazer', tq, 0, 0);
        armSeg(c, G.SL, add(G.SL, [-0.08, 1.12]), add(G.SL, [-0.06, 2.05]), GIRL); hand(c, add(G.SL, [-0.06, 2.05]), HP + 0.05, GIRL.hand, 'back', false);
        // her right hand lightly pinching his sleeve
        const Er = add(G.SR, [0.18, 1.0]), Wr = add(B.SL, [-0.12, 1.75]);
        armSeg(c, G.SR, Er, Wr, GIRL); hand(c, Wr, 0.3, GIRL.hand * 0.85, 'grip', false);
      });
      hairLayers(F, tq, G.head, hairO, 0.6);
      if (!clear) {
        F.layer({ tone: 0.1, toward: o.rimColor || '#c9d2e0' }, silhouette); // outer surface catches a little light
        F.raw((c) => { // the underside is darker; ribs show faintly; the near rim edge is lit
          c.fillStyle = F.fill; lens(c);
          c.strokeStyle = F.tone(0.16, F.rimCol); c.lineWidth = 0.022; ribsIn(c); shaft(c);
          c.save(); c.translate(top[0], top[1]); c.rotate(tilt); c.strokeStyle = F.tone(0.45, F.rimCol); c.lineWidth = 0.028;
          c.beginPath(); for (let i = 0; i <= 24; i++) { const p = rimPt(PI + PI * i / 24); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); } c.stroke(); c.restore();
        });
      }
    });
    if (clear) { // translucent vinyl canopy drawn over the composite
      const sc = (o.scale || 1) * U; ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.scale(o.flip ? -sc : sc, sc);
      const ga = ctx.globalAlpha * (o.alpha === undefined ? 1 : o.alpha); ctx.globalAlpha = ga;
      ctx.fillStyle = PV.rgba('#e9f2fb', 0.12); silhouette(ctx);
      ctx.fillStyle = PV.rgba('#c9d6e6', 0.08); lens(ctx);
      ctx.strokeStyle = PV.rgba('#ffffff', 0.38); ctx.lineWidth = 0.02; ribsOut(ctx);
      ctx.strokeStyle = PV.rgba('#ffffff', 0.2); ctx.lineWidth = 0.016; ribsIn(ctx);
      ctx.save(); ctx.translate(top[0], top[1]); ctx.rotate(tilt); ctx.lineWidth = 0.026;
      for (const [a0, al] of [[PI, 0.6], [0, 0.32]]) { ctx.strokeStyle = PV.rgba('#ffffff', al); ctx.beginPath(); for (let i = 0; i <= 24; i++) { const p = rimPt(a0 + PI * i / 24); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); } ctx.stroke(); }
      ctx.fillStyle = PV.rgba('#ffffff', 0.5); // beads of rain on the vinyl
      for (let i = 0; i < 46; i++) { const u = R1(i, 77) * 2 - 1, v = R1(i, 78); const x = u * RW * 0.95, y = dome(x) + (RH - RE * 0.6 * Math.sqrt(1 - u * u) - dome(x)) * v; ctx.beginPath(); ctx.arc(x, y, 0.011 + 0.013 * R1(i, 79), 0, TAU); ctx.fill(); }
      ctx.restore(); ctx.restore();
    }
    if (o.drips !== false) { // water dropping from the rib tips
      const s = (o.scale || 1) * U; ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.scale(o.flip ? -s : s, s);
      ctx.globalAlpha *= (o.alpha === undefined ? 1 : o.alpha); ctx.fillStyle = PV.rgba(o.rimColor || '#dfe9ff', 0.7);
      for (let i = 0; i <= NR * 2; i++) {
        const al = PI * i / NR, tp = rimPt(al); if (i > NR && i < 2 * NR && R1(i, seed + 5) < 0.5) continue;
        const p = toW([tp[0] * 1.012, tp[1] + 0.05]);
        const per = 0.5 + 0.4 * R1(i, seed), k = ((t + R1(i, seed + 1) * per) % per) / per;
        ctx.beginPath(); ctx.ellipse(p[0], p[1] + k * k * 2.4, 0.022, 0.045 + k * 0.05, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  };

  /* ======================================================== side-view bodies */
  // profiles [f, A(front), B(back)] for limbs of a figure facing +x
  const S_THIGH = [[0, 0.34, 0.34], [0.3, 0.3, 0.26], [0.75, 0.205, 0.185], [1, 0.162, 0.158]];
  const S_SHIN = [[0, 0.162, 0.158], [0.22, 0.13, 0.198], [0.5, 0.108, 0.148], [0.85, 0.083, 0.085], [1, 0.078, 0.08]];
  const S_TTHIGH = [[0, 0.38, 0.38], [0.5, 0.31, 0.29], [1, 0.242, 0.236]];
  const S_TSHIN = [[0, 0.242, 0.236], [0.6, 0.226, 0.222], [1, 0.222, 0.22]];
  const S_UPARM = [[0, 0.155, 0.155], [0.2, 0.15, 0.128], [0.5, 0.122, 0.112], [1, 0.09, 0.088]];
  const S_FOREARM = [[0, 0.09, 0.088], [0.25, 0.1, 0.094], [0.82, 0.074, 0.07], [0.85, 0.058, 0.056], [1, 0.055, 0.054]];
  const S_FOREARM_BARE = [[0, 0.085, 0.083], [0.25, 0.092, 0.088], [1, 0.054, 0.052]];
  const GIRL_CAP_SIDE = [[0.33, -0.4], [0.2, -0.56], [-0.05, -0.62], [-0.32, -0.55], [-0.5, -0.33], [-0.55, -0.05], [-0.48, 0.22], [-0.36, 0.36], [-0.22, 0.18], [-0.05, 0.02], [0.12, -0.12], [0.22, -0.26]];

  // profile rig facing +x. o: P (hip joint), lean (+ forward), headTilt (+ chin down / - look up), neckLean, shrug, torsoK
  function rigSide(sp, o) {
    const P = o.P, lam = o.lean || 0, up = [sin(lam), -cos(lam)], Lt = sp.torso * (o.torsoK || 1);
    const F = frame(P, up);
    const N = F(0.0, Lt);
    const S = add(F(-0.04, Lt - 0.27), [0, -(o.shrug || 0)]);
    const nl = lam + (o.neckLean === undefined ? 0.14 : o.neckLean);
    const nt = add(N, [sin(nl) * sp.neck * 0.42, -cos(nl) * sp.neck * 0.42]);
    const ht = lam * 0.5 + (o.headTilt || 0);
    const head = o.head || add(nt, [sin(ht) * sp.neck * 0.5 + cos(ht) * 0.03, -cos(ht) * sp.neck * 0.5 + sin(ht) * 0.03]);
    return { sp, P, up, Lt, F, N, S, head, ht, nt: o.head ? mix2(N, o.head, 0.45) : nt, lam };
  }
  function torsoSide(c, R, outfit) {
    const sp = R.sp, F = R.F, Lt = R.Lt, k = Lt / sp.torso, boy = !!sp.boy, h = (v) => v * k;
    let pts;
    if (boy) pts = [F(-0.17, Lt + 0.16), F(-0.25, Lt - 0.05), F(-0.42, h(1.78)), F(-0.4, h(1.25)), F(-0.31, h(0.82)), F(-0.36, 0.36), F(-0.43, 0.02), F(-0.34, -0.32),
      F(0.2, -0.32), F(0.32, 0.08), F(0.33, h(0.52)), F(0.32, h(0.88)), F(0.37, h(1.32)), F(0.41, h(1.62)), F(0.35, h(1.98)), F(0.19, Lt - 0.04), F(0.16, Lt + 0.16)];
    else pts = [F(-0.15, Lt + 0.16), F(-0.22, Lt - 0.05), F(-0.35, h(1.74)), F(-0.33, h(1.25)), F(-0.25, h(0.8)), F(-0.33, 0.36), F(-0.43, 0.02), F(-0.34, -0.29),
      F(0.18, -0.28), F(0.3, 0.12), F(0.3, h(0.5)), F(0.27, h(0.85)), F(0.33, h(1.2)), F(0.44, h(1.47)), F(0.35, h(1.8)), F(0.18, Lt - 0.05), F(0.13, Lt + 0.16)];
    blob(c, pts);
    if (outfit === 'jacket') blob(c, [F(-0.47, 0.05, 1), F(-0.44, h(0.9)), F(-0.46, h(1.75)), F(-0.26, Lt + 0.06), F(-0.08, Lt + 0.22), F(0.24, Lt - 0.02), F(0.44, h(1.6)), F(0.4, h(0.9)), F(0.44, 0.08, 1), F(0, 0.0)]);
    else if (outfit === 'blazer') blob(c, [F(-0.42, -0.1, 1), F(-0.38, h(0.9)), F(-0.4, h(1.75)), F(-0.2, Lt + 0.03), F(0.22, Lt - 0.02), F(boy ? 0.42 : 0.46, h(1.5)), F(0.36, h(0.9)), F(0.4, -0.06, 1), F(0, -0.12)]);
    else if (outfit === 'shirt') blob(c, [F(-0.44, -0.12, 1), F(-0.4, h(0.85)), F(-0.42, h(1.7)), F(0.0, Lt), F(0.4, h(1.6)), F(0.38, h(0.85)), F(0.4, -0.1, 1), F(0, -0.16)]);
    seg(c, R.N, R.nt, boy ? 0.22 : 0.18, boy ? 0.2 : 0.16);
  }
  function headSide(c, t, R, o = {}) {
    const boy = !!R.sp.boy, sc = R.sp.head, W = o.wind || 0, wd = o.windDir === undefined ? PI : o.windDir;
    c.save(); c.translate(R.head[0], R.head[1]); c.rotate(R.ht); c.scale(sc, sc);
    headProfile(c, boy);
    if (boy) boyHairSide(c, t, W, wd - R.ht, o.seed || 3, R.ht);
    else { blob(c, GIRL_CAP_SIDE); girlBangsSide(c, t, W, wd - R.ht); }
    c.restore();
    if (!boy && o.hair !== false) drawHair(c, t, R.head, Object.assign({ view: 'side', len: o.hairLen || 2.7, wind: W, windDir: wd, tilt: R.ht, seed: o.seed || 5, count: 14, wisps: 4, capShape: false, hl: o.hl }, o.hairO || {}));
  }
  function armSide(c, S, E, Wr, sp, o = {}) {
    const k = sp.armR / 0.125 * (o.k || 1);
    limb(c, S, E, scaleP(S_UPARM, k)); limb(c, E, Wr, scaleP(o.bare ? S_FOREARM_BARE : S_FOREARM, k));
  }
  function legSide(c, H, K, A, sp, trousers) {
    const k = sp.legR / 0.27;
    if (trousers) { limb(c, H, K, scaleP(S_TTHIGH, k)); limb(c, K, A, scaleP(S_TSHIN, k)); }
    else { limb(c, H, K, scaleP(S_THIGH, k)); limb(c, K, A, scaleP(S_SHIN, k)); }
  }
  const dirDeg = (p, deg, len) => [p[0] + Math.sin(deg * PI / 180) * len, p[1] + Math.cos(deg * PI / 180) * len];
  // loose cloth (shirt tail, sleeve) streaming from the edge a->b in the wind direction, fluttering on 12fps
  function clothFlap(c, t, a, b, W, wd, seed) {
    const d = [cos(wd), sin(wd)], pp = [-d[1], d[0]], L0 = (0.16 + 0.2 * Math.min(1.5, W)) * len2(sub(a, b)) / 0.95;
    const f = (k, ph) => 0.06 * Math.min(1.5, W) * sin(t * 11 + ph + seed) + 0.03 * N2(seed + k, t * 3);
    const m = mix2(a, b, 0.5);
    blob(c, [a, add(add(a, mul(d, L0 * 0.55)), mul(pp, f(1, 0))), [...add(add(m, mul(d, L0)), mul(pp, f(2, 1.3))), 1], add(add(mix2(a, b, 0.78), mul(d, L0 * 0.62)), mul(pp, f(3, 2.1))),
      [...add(add(b, mul(d, L0 * 0.85)), mul(pp, f(4, 2.9))), 1], b]);
  }
  // the back of a loose shirt filling with wind (profile rig R): small at the shoulder blade, most at the loose hem
  function shirtBillow(c, t, R, W, wd, seed) {
    const d = [cos(wd), sin(wd)], k = Math.min(1.4, W), P = [];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6, base = R.F(lerp(-0.36, -0.45, u), lerp(1.25, -0.26, u));
      const amp = k * (0.015 + 0.22 * u * u) * (1 + 0.22 * sin(t * 10 + i * 1.3 + seed) + 0.12 * N2(seed + i, t * 2.5));
      P.push(add(base, mul(d, amp)));
    }
    P[6] = [P[6][0], P[6][1], 1];
    blob(c, [R.F(-0.2, 1.35)].concat(P, [R.F(-0.3, -0.22), R.F(-0.15, 0.6)]));
  }
  // pleated skirt in profile (standing / walking). waist from rig; legs: [kneeNear, kneeFar]
  function skirtSide(c, t, R, o = {}) {
    const F = R.F, sp = R.sp, W = o.wind || 0, wd = o.windDir === undefined ? PI : o.windDir, wx = cos(wd) * W;
    const len = o.len || 1.62, wh = sp.waistH;
    const fx = 0.36 + (o.frontPush || 0), bx = -0.5 + (o.backPush || 0);
    const pts = [F(0.22, wh + 0.02), F(0.3, wh - 0.5), F(fx + Math.max(0, wx) * 0.25, wh - len + 0.02 - Math.abs(wx) * 0.12)];
    const n = 8;
    for (let i = 1; i < n; i++) { const u = i / n; const p = F(lerp(fx, bx, u) + wx * 0.25 * (1 - Math.abs(u - 0.5)), wh - len - 0.04 * sin(PI * u) + (i % 2 ? 0.025 : 0) - Math.abs(wx) * 0.1 * (0.5 + 0.5 * N2(u * 3, t * 2))); pts.push([p[0], p[1], i % 2 ? 0 : 1]); }
    pts.push(F(bx + Math.min(0, wx) * 0.3, wh - len + 0.02 - Math.abs(wx) * 0.15), F(-0.4, wh - 0.55), F(-0.22, wh + 0.02));
    blob(c, pts);
  }
  // flowing dress skirt for running/leaping: hangs from the waist, pushed by the forward knee, trailing behind
  function dressSkirt(c, t, R, knees, o = {}) {
    const F = R.F, sp = R.sp, wh = sp.waistH, W = o.wind === undefined ? 1 : o.wind, len = o.len || 1.9;
    const kf = knees.reduce((a, b) => (b[0] > a[0] ? b : a)), kb = knees.reduce((a, b) => (b[0] < a[0] ? b : a));
    const WF = F(0.22, wh), WB = F(-0.21, wh), HB = F(-0.4, 0.02);
    const hemY = WF[1] + len;
    const FH = [Math.max(kf[0] + 0.24, WF[0] + 0.25), Math.min(hemY + 0.05, kf[1] + 0.25)];
    const BH = [Math.min(kb[0] - 0.2, WB[0] - 0.55 - 0.35 * W) + 0.06 * sin(t * 7.3), hemY - 0.25 * W + 0.1 * N2(3.1, t * 2.4)];
    const pts = [WF, F(0.3, wh - 0.45), [lerp(WF[0], FH[0], 0.6) + 0.1, lerp(WF[1], FH[1], 0.6)], [FH[0], FH[1], 1]];
    const n = 7;
    for (let i = 1; i < n; i++) {
      const u = i / n, b = mix2(FH, BH, u);
      pts.push([b[0], b[1] + 0.18 * sin(PI * u) + 0.07 * W * sin(TAU * (u * 1.5 - t * 2.6)), (i % 2) ? 0 : 0]);
    }
    pts.push([BH[0], BH[1], 1], [lerp(HB[0], BH[0], 0.45) - 0.08, lerp(HB[1], BH[1], 0.45)], HB, WB);
    blob(c, pts);
  }

  /* ------------------------------------------------------------ props (side) */
  // school chair seen from the side, facing +x; origin = seat top centre, floor at +2.0
  function schoolChair(c) {
    c.beginPath(); c.roundRect(-0.85, -0.02, 1.72, 0.12, 0.04); c.fill();
    seg(c, [-0.78, 0.08], [-0.82, 2.0], 0.045, 0.04); seg(c, [0.76, 0.08], [0.8, 2.0], 0.045, 0.04);
    seg(c, [-0.82, 0.1], [-0.92, -1.75], 0.045, 0.04); // back post
    c.beginPath(); c.roundRect(-1.0, -1.72, 0.2, 0.62, 0.05); c.fill(); // backrest board (edge-on)
    seg(c, [-0.8, 1.55], [0.8, 1.55], 0.03, 0.03);
  }
  // juice pack with straw; origin = pack centre
  function juicePack(c, strawAng) {
    c.beginPath(); c.roundRect(-0.13, -0.22, 0.26, 0.44, 0.03); c.fill();
    c.lineWidth = 0.035; c.beginPath(); c.moveTo(0.06, -0.21); const e = polar([0.06, -0.21], strawAng, 0.36); c.lineTo(e[0], e[1]); c.stroke();
  }
  // acoustic guitar outline, local: body centre at 0, neck toward +x. unit = head units (boy scale)
  function acousticGuitar(c, holes) {
    blob(c, [[-1.15, 0], [-1.08, 0.5], [-0.75, 0.86], [-0.3, 0.84], [0.05, 0.6], [0.32, 0.66], [0.62, 0.6], [0.86, 0.32], [0.92, 0.11], [0.92, -0.11], [0.86, -0.32], [0.62, -0.6], [0.32, -0.66], [0.05, -0.6], [-0.3, -0.84], [-0.75, -0.86], [-1.08, -0.5]]);
    c.beginPath(); c.moveTo(0.9, -0.11); c.lineTo(2.95, -0.085); c.lineTo(2.95, 0.085); c.lineTo(0.9, 0.11); c.closePath(); c.fill();
    blob(c, [[2.92, -0.1], [3.05, -0.17], [3.62, -0.16, 1], [3.66, 0], [3.62, 0.16, 1], [3.05, 0.17], [2.92, 0.1]]);
    for (let i = 0; i < 3; i++) for (const sg of [-1, 1]) ell(c, 3.15 + i * 0.17, sg * 0.21, 0.045, 0.035);
    if (holes) { c.save(); c.fillStyle = holes; ell(c, 0.42, 0, 0.21, 0.21); c.restore(); }
  }
  // Stratocaster outline (white strat), local: body centre at 0, neck toward +x
  function stratGuitar(c) {
    blob(c, [[-1.02, 0.02], [-0.92, 0.5], [-0.55, 0.74], [-0.15, 0.6], [0.12, 0.55], [0.4, 0.62], [0.6, 0.5, 1], [0.44, 0.3], [0.33, 0.12],
      [0.33, -0.12], [0.5, -0.28], [0.78, -0.5, 1], [0.55, -0.66], [0.12, -0.56], [-0.2, -0.62], [-0.6, -0.76], [-0.94, -0.5]]);
    c.beginPath(); c.moveTo(0.3, -0.1); c.lineTo(2.35, -0.08); c.lineTo(2.35, 0.08); c.lineTo(0.3, 0.1); c.closePath(); c.fill();
    blob(c, [[2.32, 0.09], [2.36, -0.1], [2.52, -0.22], [2.8, -0.24], [2.9, -0.15], [2.95, -0.02], [2.9, 0.06], [2.7, 0.07], [2.5, 0.1]]);
    for (let i = 0; i < 6; i++) ell(c, 2.45 + i * 0.08, -0.25, 0.025, 0.035);
  }
  // hospital bed in profile (head end at -x), origin = mattress top under her hips. back raised by `rise` (rad)
  function hospitalBed(c, rise) {
    const piv = [-0.55, 0.0];
    // frame + legs
    c.beginPath(); c.roundRect(-2.4, 0.35, 8.1, 0.32, 0.06); c.fill();
    for (const x of [-2.1, 5.3]) { seg(c, [x, 0.6], [x, 2.35], 0.06, 0.06); ell(c, x, 2.42, 0.13, 0.13); }
    // head & foot boards (tubular)
    c.lineWidth = 0.1; c.beginPath(); c.moveTo(-2.45, 0.5); c.lineTo(-2.45, -1.5); c.quadraticCurveTo(-2.45, -1.8, -2.15, -1.8); c.lineTo(-1.9, -1.8); c.stroke();
    c.beginPath(); c.moveTo(5.75, 0.5); c.lineTo(5.75, -0.75); c.quadraticCurveTo(5.75, -0.98, 5.5, -0.98); c.lineTo(5.0, -0.98); c.stroke();
    // side rail
    c.lineWidth = 0.06; c.beginPath(); c.moveTo(-1.8, -0.55); c.lineTo(1.0, -0.55); c.stroke();
    for (const x of [-1.6, -0.4, 0.8]) { c.beginPath(); c.moveTo(x, -0.55); c.lineTo(x, 0.4); c.stroke(); }
    // mattress (flat part) + raised back section
    c.beginPath(); c.roundRect(-0.6, -0.02, 6.1, 0.4, 0.12); c.fill();
    c.save(); c.translate(piv[0], piv[1] + 0.2); c.rotate(rise); c.beginPath(); c.roundRect(-3.3, -0.22, 3.35, 0.44, 0.14); c.fill(); c.restore();
  }

  /* ----------------------------------------------------------- girlRunning */
  // side view, facing right (flip to run left). anchor: ground under her. o.speed (cycles/s, default 1.45),
  // o.phase, o.outfit 'dress' (default, navy dress + low heels) | 'uniform', o.wind (extra head wind)
  const RUN_KEYS = [
    // thR, shR, ftR, thL, shL, ftL, uaR, faR, uaL, faL, dy, lean(deg)
    // arms swing against the legs: the back arm drives the elbow back with the forearm hanging (not pointing forward),
    // the front arm comes up in front of the chest
    [30, 12, -12, -24, -82, 40, -36, 16, 30, 116, 0.0, 9],
    [14, -22, 4, -6, -112, 45, -40, 8, 36, 122, 0.13, 11],
    [-8, -18, 22, 30, -58, 24, -8, 56, 10, 86, 0.05, 10],
    [-30, -52, 68, 52, 0, 6, 28, 110, -30, 22, -0.09, 8],
  ];
  function runPose(p) {
    const keys = []; for (const k of RUN_KEYS) keys.push(k);
    for (const k of RUN_KEYS) keys.push([k[3], k[4], k[5], k[0], k[1], k[2], k[8], k[9], k[6], k[7], k[10], k[11]]);
    const n = keys.length, x = ((p % 1) + 1) % 1 * n, i = Math.floor(x), f = x - i;
    const K = (j) => keys[((j % n) + n) % n];
    const a = K(i - 1), b = K(i), c2 = K(i + 1), d = K(i + 2);
    return b.map((_, j) => { const p0 = a[j], p1 = b[j], p2 = c2[j], p3 = d[j]; return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f); });
  }
  L.girlRunning = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const sp = GIRL, spd = o.speed === undefined ? 1.45 : o.speed, ph = tq * spd + (o.phase || 0);
    const k = runPose(ph);
    const dress = (o.outfit || 'dress') === 'dress';
    const P = [0, -sp.hipY + 0.18 + k[10]];
    const R = rigSide(sp, { P, lean: k[11] * PI / 180, headTilt: -0.06 + 0.03 * sin(ph * TAU * 2), neckLean: 0.1 });
    const hip = R.P;
    const leg = (th, sh, ft) => { const K2 = dirDeg(hip, th, sp.thigh * 0.98), A = dirDeg(K2, sh, sp.shin * 0.98); return { K: K2, A, ft: ft * PI / 180 }; };
    const LR = leg(k[0], k[1], k[2]), LL = leg(k[3], k[4], k[5]);
    const arm = (ua, fa) => { const E = dirDeg(R.S, ua, sp.upArm * 0.95), Wr = dirDeg(E, fa, sp.foreArm * 0.92); return { E, Wr }; };
    const AR = arm(k[6], k[7]), AL = arm(k[8], k[9]);
    const W = (o.wind === undefined ? 0.4 : o.wind) + spd * 0.55;
    const hairO = { hairLen: o.hairLen || 2.65, hairO: { mess: 0.15 } };
    const shoeK = dress ? 'heel' : 'loafer';
    figure(ctx, o, [-4.4, -8.2, 2.6, 0.7], (F) => {
      F.layer({ fill: F.tone(0.05) }, (c) => { // far limbs
        legSide(c, hip, LL.K, LL.A, sp); shoe(c, LL.A, LL.ft, 1, shoeK);
        armSide(c, R.S, AL.E, AL.Wr, sp, { bare: dress }); hand(c, AL.Wr, Math.atan2(AL.Wr[1] - AL.E[1], AL.Wr[0] - AL.E[0]), sp.hand * 0.74, 'grip', false);
      });
      F.layer({ inner: 0.35 }, (c) => {
        legSide(c, hip, LR.K, LR.A, sp); shoe(c, LR.A, LR.ft, 1, shoeK);
        torsoSide(c, R, dress ? 'dress' : 'blazer');
        dressSkirt(c, tq, R, [LR.K, LL.K], { wind: 1, len: dress ? 1.9 : 1.55 });
        headSide(c, tq, R, Object.assign({ wind: W, windDir: PI + 0.12, hl: F.hl(0.5) }, hairO));
        armSide(c, R.S, AR.E, AR.Wr, sp, { bare: dress }); hand(c, AR.Wr, Math.atan2(AR.Wr[1] - AR.E[1], AR.Wr[0] - AR.E[0]), sp.hand * 0.74, 'grip', false);
      });
    });
  };

  /* ----------------------------------------------------------- boyReaching */
  // side view facing right. anchor: ground under him. o.reach 0..1 (arm extension), o.outfit 'shirt'|'jacket'|'blazer', o.wind
  L.boyReaching = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const sp = BOY, rc = o.reach === undefined ? 1 : o.reach, W = o.wind === undefined ? 0.5 : o.wind, wd = o.windDir === undefined ? PI : o.windDir;
    const tremble = 0.6 * sin(tq * 9.0) * rc;
    const thF = 26 - 4 * rc, shF = 6, thB = -16 - 6 * rc, shB = -30 - 8 * rc;
    const hipY = -(sp.thigh * cos(thF * PI / 180) + sp.shin * cos(shF * PI / 180) + 0.27);
    const P = [0, hipY];
    const R = rigSide(sp, { P, lean: (0.1 + 0.16 * rc), headTilt: -0.1 - 0.12 * rc, neckLean: 0.25, shrug: 0.06 * rc });
    const KF = dirDeg(P, thF, sp.thigh), AF = dirDeg(KF, shF, sp.shin), KB = dirDeg(P, thB, sp.thigh), AB = dirDeg(KB, shB, sp.shin);
    const ua = lerp(25, 92, rc) + tremble, fa = lerp(70, 98, rc) + tremble;
    const E = dirDeg(R.S, ua, sp.upArm), Wr = dirDeg(E, fa, sp.foreArm);
    const Ef = dirDeg(R.S, -18 - 10 * rc, sp.upArm), Wf = dirDeg(Ef, 8, sp.foreArm);
    const out = o.outfit || 'shirt';
    figure(ctx, o, [-3.0, -8.6, 4.6, 0.7], (F) => {
      F.layer({ fill: F.tone(0.05) }, (c) => {
        legSide(c, P, KF, AF, sp, true); shoe(c, AF, -0.02, 1.08, 'loafer');
        armSide(c, R.S, Ef, Wf, sp); hand(c, Wf, HP - 0.15, sp.hand, 'relaxed', false, 0.4);
      });
      F.layer({ inner: 0.4 }, (c) => {
        legSide(c, P, KB, AB, sp, true); shoe(c, AB, 0.42, 1.08, 'loafer');
        blob(c, [R.F(-0.42, sp.waistH), R.F(-0.46, 0.05), R.F(-0.28, -0.36), R.F(0.24, -0.34), R.F(0.35, 0.1), R.F(0.34, sp.waistH)]);
        if (W > 0.25 && out !== 'jacket') shirtBillow(c, tq, R, W, wd, 9);
        torsoSide(c, R, out);
        headSide(c, tq, R, { wind: W, windDir: wd, seed: 9 });
        armSide(c, R.S, E, Wr, sp); hand(c, Wr, Math.atan2(Wr[1] - E[1], Wr[0] - E[0]) - 0.05, sp.hand * 1.05, 'open', true, 0.35 + 0.45 * rc, 0.12);
        if (W > 0.25) clothFlap(c, tq, mix2(R.S, E, 0.62), mix2(R.S, E, 0.92), W * 0.55, wd, 13); // the loose sleeve
      });
    });
  };

  /* ------------------------------------------------------------- boySeated */
  // side view on a school chair, facing right. anchor: seat top centre. o.pose 'juice' | 'guitar', o.chair (true)
  L.boySeated = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const sp = BOY, pose = o.pose || 'juice', W = o.wind === undefined ? 0.15 : o.wind;
    const br = 0.012 * sin(tq * 1.5);
    figure(ctx, o, [-2.6, -6.4, 4.6, 2.3], (F) => {
      if (pose === 'juice') {
        const P = [-0.3, -0.3];
        const R = rigSide(sp, { P, lean: -0.14 + br, headTilt: -0.32 + 0.04 * sin(tq * 0.7), neckLean: 0.02 });
        const KN = dirDeg(P, 84, sp.thigh), AN = dirDeg(KN, 22, sp.shin);
        const KFr = dirDeg(P, 76, sp.thigh * 0.97), AFr = dirDeg(KFr, -8, sp.shin);
        const mouth = add(R.head, [0.38 * cos(R.ht) - 0.28 * sin(R.ht), 0.38 * sin(R.ht) + 0.28 * cos(R.ht)]);
        const pk = add(mouth, [0.38, 0.42]);
        const Wr = add(pk, [-0.06, 0.24]), E = ik(R.S, Wr, sp.upArm, sp.foreArm, 1);
        F.layer({ fill: F.tone(0.06) }, (c) => {
          if (o.chair !== false) schoolChair(c);
          legSide(c, P, KFr, AFr, sp, true); shoe(c, AFr, 0, 1.08, 'loafer');
          const Ef = dirDeg(R.S, 6, sp.upArm), Wf = dirDeg(Ef, 40, sp.foreArm); armSide(c, R.S, Ef, Wf, sp); hand(c, Wf, 0.9, sp.hand, 'relaxed', false, 0.5);
        });
        F.layer({ inner: 0.4 }, (c) => {
          legSide(c, P, KN, AN, sp, true); shoe(c, AN, -0.06, 1.08, 'loafer');
          blob(c, [R.F(-0.42, sp.waistH), R.F(-0.46, 0.05), R.F(-0.32, -0.36), KN, R.F(0.35, 0.12), R.F(0.34, sp.waistH)]);
          torsoSide(c, R, o.outfit || 'shirt');
          headSide(c, tq, R, { wind: W, windDir: PI, seed: 4 });
          armSide(c, R.S, E, Wr, sp); hand(c, Wr, -HP - 0.35, sp.hand, 'grip', false);
          local(c, pk, -0.25, 1, 1, (cc) => juicePack(cc, PI + 0.85));
        });
      } else { // guitar on the lap, body turned to camera (anime cheat), neck forward-up
        const P = [-0.25, -0.3];
        const R = rigSide(sp, { P, lean: 0.2 + br, headTilt: 0.42 + 0.04 * sin(tq * 2.1), neckLean: 0.35 });
        const KN = dirDeg(P, 82, sp.thigh), AN = dirDeg(KN, 6, sp.shin), KFr = dirDeg(P, 86, sp.thigh * 0.97), AFr = dirDeg(KFr, -4, sp.shin);
        const gc = [0.62, -0.62], ga = -0.36; // guitar body centre / neck angle
        const gp = (x, y) => [gc[0] + x * cos(ga) - y * sin(ga), gc[1] + x * sin(ga) + y * cos(ga)];
        const strum = 0.08 * sin(tq * 9.5);
        const WrN = gp(0.42 + strum, 0.05), EN = add(gp(-0.35, -0.95), [0, 0.0]);
        const WrF = gp(2.1, 0.15), EF = ik(R.S, WrF, sp.upArm, sp.foreArm, -1);
        F.layer({ fill: F.tone(0.06) }, (c) => {
          if (o.chair !== false) schoolChair(c);
          legSide(c, P, KFr, AFr, sp, true); shoe(c, AFr, 0, 1.08, 'loafer');
          armSide(c, R.S, EF, WrF, sp);
        });
        F.layer({ inner: 0.3 }, (c) => {
          legSide(c, P, KN, AN, sp, true); shoe(c, AN, 0, 1.08, 'loafer');
          blob(c, [R.F(-0.42, sp.waistH), R.F(-0.46, 0.05), R.F(-0.32, -0.36), KN, R.F(0.35, 0.12), R.F(0.34, sp.waistH)]);
          torsoSide(c, R, o.outfit || 'shirt');
          headSide(c, tq, R, { wind: W, windDir: PI, seed: 4 });
        });
        F.layer({ tone: o.guitarTone === undefined ? 0.1 : o.guitarTone, toward: '#c9a77d', inner: 0.85 }, (c) => {
          local(c, gc, ga, 0.92, 1, (cc) => acousticGuitar(cc, o.soundhole !== false ? F.fill : null));
        });
        F.layer({ inner: 0.6 }, (c) => {
          hand(c, WrF, ga - HP - 0.2, sp.hand * 0.95, 'grip', true);
          armSide(c, R.S, EN, WrN, sp); hand(c, WrN, HP + 0.5, sp.hand, 'relaxed', false, 0.6);
        });
      }
    });
  };

  /* -------------------------------------------------------- guitaristKneel */
  // kneeling in a spotlight, looking up. facing right. anchor: floor under his knees.
  // o.hold 'raise' (right arm to the sky, guitar on strap) | 'lift' (guitar held up overhead) | 'chest' (hugs guitar)
  // o.guitarTone (lightness of the white Strat, default 0.22), o.light default -PI/2 (top spot)
  L.guitaristKneel = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const sp = BOY, hold = o.hold || 'raise', br = 0.02 * sin(tq * 1.2);
    const KN = [0.05, -0.22], KF = [0.25, -0.24];
    const P = [-0.18, -0.22 - sp.thigh * 0.97];
    // the back arches (torso lean) and the chin lifts, but the skull stays ON the neck: rotate the head drawing fully,
    // move its centre only part-way (a head swung behind the shoulders read as a broken neck)
    const R = rigSide(sp, { P, lean: -0.3 + br, headTilt: -0.78 + 0.05 * sin(tq * 0.8), neckLean: -0.36 });
    R.head = add(R.nt, [sin(R.ht * 0.35) * sp.neck * 0.52 + 0.04, -cos(R.ht * 0.35) * sp.neck * 0.52]);
    const AN = [KN[0] - sp.shin * 0.98, -0.2], AF = [KF[0] - sp.shin * 0.98, -0.21];
    const oo = Object.assign({ light: -HP }, o);
    const gt = o.guitarTone === undefined ? 0.32 : o.guitarTone;
    figure(ctx, oo, [-3.4, -10.6, 3.6, 0.6], (F) => {
      let gc, ga, WrN, EN, WrF, EF, handN = 'open', handF = 'grip';
      if (hold === 'lift') { // both arms raise the guitar overhead (hands within reach)
        WrN = add(R.S, [-0.35, -2.25]); WrF = add(R.S, [0.85, -2.1]);
        ga = Math.atan2(WrF[1] - WrN[1], WrF[0] - WrN[0]) - 0.05; gc = add(WrN, [-0.25 * cos(ga) + 0.35 * sin(ga), -0.25 * sin(ga) - 0.35 * cos(ga)]);
        EN = ik(R.S, WrN, sp.upArm, sp.foreArm, 1); EF = ik(R.S, WrF, sp.upArm, sp.foreArm, -1); handN = 'grip';
      } else if (hold === 'chest') {
        gc = add(R.F(0.48, 1.0), [0, 0]), ga = -1.32;
        WrN = add(R.F(0.42, 1.3), [0.05, 0]); WrF = add(R.F(0.5, 1.75), [0, 0]);
        EN = add(R.F(0.32, 0.5), [0.2, 0]); EF = add(R.F(0.36, 0.95), [0.1, 0]); handN = 'relaxed'; handF = 'relaxed';
      } else {
        gc = R.F(0.42, 0.25), ga = -0.95;
        const gp = (x, y) => [gc[0] + x * cos(ga) - y * sin(ga), gc[1] + x * sin(ga) + y * cos(ga)];
        WrF = gp(1.9, 0.12); EF = ik(R.S, WrF, sp.upArm, sp.foreArm, 1);
        WrN = add(R.S, [0.55 + 0.04 * sin(tq * 3), -2.35]); EN = add(R.S, [0.42, -1.25]);
      }
      F.layer({ fill: F.tone(0.06) }, (c) => {
        legSide(c, P, KF, AF, sp, true); local(c, AF, PI + 0.12, 1.06, -1, (cc) => shoeSide(cc, 'loafer'));
        armSide(c, R.S, EF, WrF, sp);
      });
      F.layer({ inner: 0.35 }, (c) => {
        legSide(c, P, KN, AN, sp, true); local(c, AN, PI + 0.1, 1.06, -1, (cc) => shoeSide(cc, 'loafer'));
        blob(c, [R.F(-0.42, sp.waistH), R.F(-0.46, 0.05), R.F(-0.32, -0.36), KN, R.F(0.35, 0.12), R.F(0.34, sp.waistH)]);
        torsoSide(c, R, o.outfit || 'shirt');
        headSide(c, tq, R, { wind: o.wind || 0.1, windDir: PI + 0.5, seed: 6 });
      });
      F.layer({ fill: F.tone(gt, '#7c8494'), inner: 0.9, grad: 0.35 }, (c) => {
        local(c, gc, ga, 1, 1, stratGuitar);
        if (hold === 'raise') { c.lineWidth = 0.07; c.beginPath(); const a = add(gc, [-0.9 * cos(ga), -0.9 * sin(ga)]); c.moveTo(a[0], a[1]); c.quadraticCurveTo(R.S[0] - 0.5, R.S[1] + 0.6, R.S[0] - 0.1, R.S[1] - 0.12); c.stroke(); }
      });
      F.layer({ inner: 0.6 }, (c) => {
        hand(c, WrF, Math.atan2(WrF[1] - EF[1], WrF[0] - EF[0]), sp.hand, handF, false, 0.4);
        armSide(c, R.S, EN, WrN, sp);
        hand(c, WrN, Math.atan2(WrN[1] - EN[1], WrN[0] - EN[0]), sp.hand * 1.05, handN, true, 0.75, 0.1);
      });
    });
  };

  /* --------------------------------------------------------------- embrace */
  // her head turned so the cheek rests on his chest: the back/side of the skull + hair only (the face is never shown)
  function headTurned(c, R) {
    c.save(); c.translate(R.head[0], R.head[1]); c.rotate(R.ht);
    ell(c, 0.0, 0.02, 0.44, 0.52);
    blob(c, [[0.34, -0.38], [0.1, -0.6], [-0.2, -0.61], [-0.46, -0.42], [-0.56, -0.08], [-0.5, 0.25], [-0.36, 0.42], [-0.1, 0.3], [0.18, 0.12], [0.38, -0.1]]);
    c.restore();
  }
  // girl (left, facing right) has thrown herself into the boy's chest (right, facing left).
  // anchor: ground between them. o.progress 0..1 (0 = moment of impact: she is in the air, knees bent back, hair still
  // flying forward, his arms just closing; 1 = settled: on tiptoe with one foot popped, his cheek on her hair)
  // o.outfit 'dress'|'uniform', o.boyOutfit 'jacket'|'shirt'|'blazer', o.wind
  L.embrace = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const pr = o.progress === undefined ? 1 : clamp(o.progress), e = PV.ease.outCubic(pr), ie = 1 - e;
    const sway = 0.014 * sin(tq * 1.1) * e, dress = (o.outfit || 'dress') === 'dress', W = o.wind === undefined ? 0.25 : o.wind;
    const bx = 0.64, lift = 0.4 * ie * (0.7 + 0.3 * sstep(0, 0.25, pr));
    // girl, facing +x, leaning into him; cheek on his chest, head under his chin
    const gP = [-0.36 - 0.06 * ie + sway, -GIRL.hipY + 0.06 - lift];
    const ghead = [-0.06 + 0.05 * ie + sway, -6.2 - lift * 0.85];
    const G = rigSide(GIRL, { P: gP, lean: 0.15 + 0.1 * ie + sway, headTilt: 0.32, head: ghead });
    // boy, built facing +x in his own frame, mirrored about bx; leans back at the impact, bows over her when settled
    const BP = [0, -BOY.hipY + 0.02];
    const B = rigSide(BOY, { P: BP, lean: 0.07 * e - 0.07 * ie - sway, headTilt: 0.5 * e + 0.12, head: [0.2 + 0.08 * ie - sway, -7.18 - 0.05 * ie] });
    const toW = (p) => [bx - p[0], p[1]];
    const SB = toW(B.S);
    // her legs: settled = near leg straight on tiptoe, far foot popped up behind; impact = both knees bent back in the air
    const gKN = dirDeg(gP, lerp(3, -16, ie), GIRL.thigh), gAN = dirDeg(gKN, lerp(-3, -100, ie), GIRL.shin);
    const gKF = dirDeg(gP, lerp(10, -30, ie), GIRL.thigh * 0.98), gAF = dirDeg(gKF, lerp(-112, -128, ie), GIRL.shin);
    const shoeK = dress ? 'heel' : 'loafer';
    // arms (world). his near arm: shoulder -> elbow at her side -> forearm across her back, hand on it (fingers past her back)
    const backX = gP[0] + sin(G.lam) * 1.45 - 0.3;
    // (one diagonal sweep from his shoulder over her near shoulder down her back: no V / loop shapes)
    const hE = mix2([0.3, -5.6], [-0.03, -5.6], e), hW = mix2([-0.12, -5.78], [backX + 0.1, -5.22], e);
    const hFar = mix2([0.0, -5.2], [backX + 0.14, -4.86], e);
    // her near arm: under his arm, across his torso, hand on his back (fingers past his back contour)
    const bBack = bx + 0.36, gE = mix2([0.36, -5.85], [0.45, -5.08], e), gW = mix2([0.85, -6.25], [bBack - 0.04, -5.3], e);
    const hairW = W + 0.85 * ie, hairDir = ie > 0.2 ? -2.25 : HP + 0.3; // at impact the hair floats up behind her
    figure(ctx, o, null, (F) => {
      F.layer({ fill: F.tone(0.05) }, (c) => { // far side: her far leg, his far hand at her lower back
        legSide(c, gP, gKF, gAF, GIRL); shoe(c, gAF, lerp(1.35, 1.6, ie), 1, shoeK);
        local(c, hFar, PI + 0.35, 1, 1, (cc) => seg(cc, [-0.6, 0], [0, 0], 0.075, 0.065));
        hand(c, hFar, PI + 0.5, BOY.hand * 0.9, 'relaxed', true, 0.35);
      });
      F.layer({}, (c) => { // the boy
        c.save(); c.translate(bx, 0); c.scale(-1, 1);
        const KN = dirDeg(BP, 8 - 3 * ie, BOY.thigh), AN = dirDeg(KN, 1, BOY.shin), KF2 = dirDeg(BP, -13 - 9 * ie, BOY.thigh), AF2 = dirDeg(KF2, -4, BOY.shin);
        legSide(c, BP, KF2, AF2, BOY, true); shoe(c, AF2, 0, 1.08, 'loafer'); legSide(c, BP, KN, AN, BOY, true); shoe(c, AN, 0, 1.08, 'loafer');
        blob(c, [B.F(-0.42, BOY.waistH), B.F(-0.46, 0.05), B.F(-0.28, -0.36), B.F(0.24, -0.34), B.F(0.35, 0.1), B.F(0.34, BOY.waistH)]);
        torsoSide(c, B, o.boyOutfit || 'jacket');
        headSide(c, tq, B, { wind: W, windDir: 0, seed: 12 });
        c.restore();
      });
      F.layer({ inner: 0.12 }, (c) => { // the girl
        legSide(c, gP, gKN, gAN, GIRL); shoe(c, gAN, lerp(1.0, 1.45, ie), 1, shoeK);
        torsoSide(c, G, dress ? 'dress' : 'blazer');
        if (dress) dressSkirt(c, tq, G, [gKN, gKF], { wind: 0.25 + 0.8 * ie, len: 1.85 }); else skirtSide(c, tq, G, { wind: 0.3 + ie });
        headTurned(c, G);
      });
      hairLayers(F, tq, G.head, { view: 'side', len: 2.6, wind: hairW, windDir: hairDir, tilt: G.ht, seed: 13, count: 14, wisps: 3, capShape: false, swing: 0.2 * ie * cos(tq * 5), backTilt: 0.05, sheen: 0.4 }, 0.3);
      // upper arms merge with the bodies (no inner line: a rimmed shoulder cap next to her head drew a "heart");
      // only the forearms that cross the partner's body get the separating line, ending in a hand on the other's back
      F.layer({}, (c) => { limb(c, SB, hE, scaleP(S_UPARM, BOY.armR / 0.125)); limb(c, G.S, gE, scaleP(S_UPARM, 1)); });
      F.layer({ inner: 0.6 }, (c) => { // his near forearm across her back, over her hair
        limb(c, hE, hW, scaleP(S_FOREARM, BOY.armR / 0.125)); hand(c, hW, lerp(-PI + 0.35, PI - 0.75, e), BOY.hand * 0.92, 'open', false, 0.32, 0.25);
      });
      F.layer({ inner: 0.6 }, (c) => { // her near forearm across his torso, hand on his back
        limb(c, gE, gW, scaleP(dress ? S_FOREARM_BARE : S_FOREARM, 1)); hand(c, gW, lerp(-0.5, -0.95, e), GIRL.hand * 0.9, 'open', true, 0.3, 0.25);
      });
    });
  };

  /* ------------------------------------------------------------- girlInBed */
  // hospital bed in profile, she sits up facing right but her head is turned away toward the window (face hidden).
  // right arm (near side) in a white cast resting on her lap. anchor: mattress top under her hips.
  // o.style default 'soft'; o.bed (true); o.castTone; o.sheetTone; o.headTurn 0..1 (1 = fully toward the window)
  L.girlInBed = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const oo = Object.assign({ style: 'soft', light: -0.4 }, o);
    const sp = GIRL, br = 0.012 * sin(tq * 1.3), W = o.wind === undefined ? 0.12 : o.wind;
    const P = [0, -0.28];
    const R = rigSide(sp, { P, lean: -0.3 + br, headTilt: 0.12, neckLean: 0.12 }); // leaning back on the raised backrest
    const turn = o.headTurn === undefined ? 1 : o.headTurn;
    const castTone = o.castTone === undefined ? 0.75 : o.castTone, sheetTone = o.sheetTone === undefined ? 0.45 : o.sheetTone;
    const bed = o.bed !== false, rise = 1.25;
    if (bed) cachedFigure(ctx, oo, 'bed' + rise, (F) => F.layer({ tone: sheetTone * 0.55, toward: '#dfe7ee' }, (c) => hospitalBed(c, rise)));
    const E = add(R.S, [0.2, 1.0]), Wr = add(E, [0.92, -0.14]); // forearm across her belly, in the sling
    figure(ctx, oo, null, (F) => {
      F.layer({}, (c) => {
        const Ef = dirDeg(R.S, 14, sp.upArm), Wf = dirDeg(Ef, 72, sp.foreArm); armSide(c, R.S, Ef, Wf, sp, { bare: true }); hand(c, Wf, 0.25, sp.hand, 'relaxed', false, 0.3);
        torsoSide(c, R, 'shirt');
        c.save(); c.translate(R.head[0], R.head[1]); c.rotate(R.ht); // the back of her head, turned toward the window
        ell(c, 0.02 + 0.06 * (1 - turn), 0, 0.44, 0.53);
        if (turn < 1) headProfile(c, false);
        c.restore();
        limb(c, R.S, E, scaleP(S_UPARM, 1)); // upper arm of the injured (near) side
      });
      // sling: one thin strap from the pouch's front end up across the chest to the back of the neck (under the hair)
      F.layer({ fill: F.tone(castTone * 0.78, '#e9eef2') }, (c) => {
        c.lineWidth = 0.055; c.beginPath(); c.moveTo(Wr[0] - 0.08, Wr[1] - 0.08); c.bezierCurveTo(Wr[0] - 0.3, Wr[1] - 0.4, R.N[0] + 0.24, R.N[1] + 0.42, R.N[0] + 0.04, R.N[1] - 0.12); c.stroke();
      });
      // the cast (forearm + palm), fingers free at the end, cradled in a white triangular pouch that sags under it
      F.layer({ fill: F.tone(castTone, '#f4f7fa'), inner: 0.5 }, (c) => {
        limb(c, E, Wr, [[0, 0.13, 0.13], [0.3, 0.145, 0.14], [0.9, 0.12, 0.115], [1, 0.11, 0.11]]);
      });
      F.layer({ fill: F.tone(castTone * 0.86, '#e6ecf1'), inner: 0.45 }, (c) => { // the pouch: below the cast, sagging, open at the hand
        blob(c, [add(E, [-0.14, 0.0]), add(mix2(E, Wr, 0.5), [0, 0.03]), add(Wr, [0.02, 0.0]), [...add(Wr, [0.05, 0.12]), 1], add(mix2(E, Wr, 0.45), [0.02, 0.27]), [...add(E, [-0.08, 0.2]), 1]]);
      });
      F.layer({ inner: 0.4 }, (c) => local(c, add(Wr, [0.05, 0.0]), 0.4, sp.hand / 0.78 * 0.62, 1, (cc) => blob(cc, [[0, -0.06], [0.2, -0.075], [0.38, -0.05], [0.47, 0.01], [0.42, 0.07], [0.22, 0.08], [0, 0.06]])));
      // long hair from the back of the turned head: falls over the near shoulder and down her back, hiding the face
      hairLayers(F, tq, R.head, { view: 'back', len: 2.25, wind: W, windDir: PI, tilt: R.ht + 0.12, seed: 23, count: 16, wisps: 3, spread: 0.04, sheen: 0.5 }, 0.45);
    });
    if (bed) cachedFigure(ctx, oo, 'blanket', (F) => F.layer({ tone: sheetTone, toward: '#e8eef3', inner: 0.35 }, (c) => {
      // from the turned-down fold at her waist over the knees and the toes to the end of the mattress, then down
      // over the foot end and the near side (a soft hem); folds only where the cloth hangs
      blob(c, [[0.05, -0.92], [0.5, -0.86], [1.05, -0.8], [1.5, -0.93], [1.86, -1.0], [2.26, -0.9], [2.9, -0.72], [3.4, -0.66], [3.72, -0.86], [3.9, -0.9], [4.12, -0.76],
        [4.6, -0.6], [5.2, -0.52], [5.52, -0.44], [5.63, -0.08], [5.6, 0.48], [5.46, 0.62, 1], [4.95, 0.55], [4.3, 0.64], [3.55, 0.56], [2.75, 0.65], [1.95, 0.57],
        [1.15, 0.64], [0.4, 0.57], [-0.1, 0.62, 1], [-0.16, 0.2], [-0.1, -0.42]]);
      c.save(); c.fillStyle = mixCol(F.fill, '#ffffff', 0.12); // the turned-down sheet at her waist
      blob(c, [[0.0, -0.96], [0.5, -0.9], [1.08, -0.83], [1.1, -0.72], [0.5, -0.76], [0.02, -0.82]]); c.restore();
      c.save(); c.lineCap = 'round';
      c.strokeStyle = mixCol(F.fill, '#ffffff', 0.18); c.lineWidth = 0.03; // the mattress edge under the cloth catches the light
      c.beginPath(); c.moveTo(0.2, -0.02); c.quadraticCurveTo(2.8, 0.03, 5.45, -0.04); c.stroke();
      c.strokeStyle = mixCol(F.fill, '#000000', 0.14); c.lineWidth = 0.025; // hanging folds
      for (const [x0, x1] of [[0.85, 0.75], [1.9, 2.0], [2.95, 2.85], [3.95, 4.05], [4.85, 4.8]]) { c.beginPath(); c.moveTo(x0, 0.08); c.quadraticCurveTo((x0 + x1) / 2 + 0.06, 0.32, x1, 0.56); c.stroke(); }
      c.restore();
    }));
  };
})();

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
  // filled ribbon along a polyline with per-point half-widths (pointy where w->0)
  function ribbon(c, pts, ws) {
    const n = pts.length; if (n < 2) return;
    const A = [], B = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const t = norm(sub(b, a)); const w = ws[i];
      A.push([p[0] + t[1] * w, p[1] - t[0] * w]); B.push([p[0] - t[1] * w, p[1] + t[0] * w]);
    }
    const tip = pts[n - 1]; const t0 = norm(sub(pts[0], pts[1]));
    const pts2 = A.concat([[tip[0], tip[1], 1]], B.reverse(), [[pts[0][0] + t0[0] * ws[0] * 0.8, pts[0][1] + t0[1] * ws[0] * 0.8]]);
    c.beginPath(); spline(c, pts2, true); c.fill();
  }
  // place a shape defined in a local frame (origin p, x-axis at angle a, scale k, mirror my)
  function local(c, p, a, k, my, fn) { c.save(); c.translate(p[0], p[1]); c.rotate(a); c.scale(k, k * (my || 1)); fn(c); c.restore(); }

  /* ======================================================== render pipeline */
  // Layers are painted flat into an accumulation buffer; light is then derived from the OUTER contour only
  // (thin crisp rim on the light-facing edges, a wide soft falloff and an outer halo computed at 1/4 res).
  const STYLES = {
    silhouette: { fill: '#0c1019', rim: '#ffe6c0', rimA: 1.0, rimW: 2.3, wideK: 4.5, wideA: 0.30, omni: 0.25, glow: 0.55, grad: 0.0 },
    soft: { fill: '#273042', rim: '#fff0da', rimA: 0.42, rimW: 1.6, wideK: 6, wideA: 0.16, omni: 0.15, glow: 0.18, grad: 0.3 },
  };
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

  // Begin a figure. bbox = [x0,y0,x1,y1] in local head-units around the anchor.
  function figure(ctx, o, bbox, paint) {
    const st = Object.assign({}, STYLES[o.style] || STYLES.silhouette);
    const s = (o.scale || 1) * U, fl = o.flip ? -1 : 1;
    const m = ctx.getTransform();
    const T0 = new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]).translate(o.x || 0, o.y || 0).scale(fl * s, s);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [bx, by] of [[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[0], bbox[3]], [bbox[2], bbox[3]]]) {
      const p = T0.transformPoint(new DOMPoint(bx, by)); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    const cw = ctx.canvas.width, ch = ctx.canvas.height, pad = 24;
    x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(cw, Math.ceil(x1 + pad)); y1 = Math.min(ch, Math.ceil(y1 + pad));
    if (x1 - x0 < 2 || y1 - y0 < 2) return;
    const bw = x1 - x0, bh = y1 - y0, sw = Math.ceil(bw / 4), sh = Math.ceil(bh / 4);
    const T = new DOMMatrix().translate(-x0, -y0).multiply(T0);
    const devS = Math.hypot(m.a, m.b) * s / U;
    const light = o.light === undefined ? -2.2 : o.light;
    const rimCol = o.rimColor || st.rim, rimK = (o.rim === undefined ? 1 : o.rim);
    const rimPx = clamp(st.rimW * Math.pow(devS, 0.6) * (o.rimWidth || 1), 1.1, 9);
    const dx = cos(light) * rimPx, dy = sin(light) * rimPx;
    const baseFill = o.fill || st.fill;
    const omni = (o.backlight === undefined ? st.omni : o.backlight);
    const A = buf('figA', bw, bh), M = buf('figM', bw, bh), Rb = buf('figR', bw, bh);
    const S = buf('figS', sw, sh), S2 = buf('figS2', sw, sh);
    A.ctx.clearRect(0, 0, bw, bh);
    const F = {
      T, s, flip: fl, light, devS, st, rimCol,
      fill: baseFill,
      tone(k, toward) { return k ? PV.mix(baseFill, toward || '#c9d2e0', k) : baseFill; },
      // one flat layer. opt {fill, tone, toward, inner (0..1 rim on this layer's own edges, for overlaps), grad}
      layer(opt, draw) {
        const c = M.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.filter = 'none';
        c.clearRect(0, 0, bw, bh);
        c.setTransform(T); const fc = opt.fill || (opt.tone ? F.tone(opt.tone, opt.toward) : baseFill);
        c.fillStyle = fc; c.strokeStyle = fc; c.lineCap = 'round'; c.lineJoin = 'round';
        draw(c, fc);
        c.setTransform(1, 0, 0, 1, 0, 0);
        const gk = (opt.grad === undefined ? st.grad : opt.grad);
        if (gk > 0) {
          const cx = bw / 2, cy = bh / 2, R = Math.hypot(bw, bh) / 2;
          const g = c.createLinearGradient(cx + cos(light) * R, cy + sin(light) * R, cx - cos(light) * R, cy - sin(light) * R);
          g.addColorStop(0, PV.rgba(rimCol, gk * 0.5)); g.addColorStop(0.5, PV.rgba(rimCol, gk * 0.1)); g.addColorStop(1, 'rgba(0,0,0,' + (gk * 0.3).toFixed(3) + ')');
          c.globalCompositeOperation = 'source-atop'; c.fillStyle = g; c.fillRect(0, 0, bw, bh);
        }
        const inner = (opt.inner || 0) * rimK;
        if (inner > 0) {
          rimInto(Rb.ctx, M.canvas, bw, bh, dx * 0.8, dy * 0.8, rimCol, 0);
          c.globalCompositeOperation = 'source-atop'; c.globalAlpha = clamp(inner * st.rimA); c.drawImage(Rb.canvas, 0, 0, bw, bh, 0, 0, bw, bh); c.globalAlpha = 1;
        }
        c.globalCompositeOperation = 'source-over';
        A.ctx.drawImage(M.canvas, 0, 0, bw, bh, 0, 0, bw, bh);
      },
      raw(draw) { const c = A.ctx; c.save(); c.setTransform(T); draw(c); c.restore(); },
    };
    paint(F);
    // ---- outer-contour light
    const a = A.ctx;
    if (rimK > 0) {
      // quarter-res: wide falloff + omni backlight
      const sc = S.ctx; sc.globalCompositeOperation = 'copy'; sc.drawImage(A.canvas, 0, 0, bw, bh, 0, 0, sw, sh); sc.globalCompositeOperation = 'source-over';
      const s2 = S2.ctx; rimInto(s2, S.canvas, sw, sh, dx * st.wideK / 4, dy * st.wideK / 4, rimCol, rimPx * 0.5);
      if (omni > 0) {
        s2.globalCompositeOperation = 'source-over'; s2.globalAlpha = 1;
        const tmp = buf('figS3', sw, sh).ctx; rimInto(tmp, S.canvas, sw, sh, 0, 0, rimCol, Math.max(1, rimPx * 0.6));
        s2.globalAlpha = clamp(omni); s2.drawImage(tmp.canvas, 0, 0, sw, sh, 0, 0, sw, sh); s2.globalAlpha = 1;
      }
      a.globalCompositeOperation = 'source-atop'; a.globalAlpha = clamp(st.wideA * rimK); a.imageSmoothingQuality = 'high';
      a.drawImage(S2.canvas, 0, 0, sw, sh, 0, 0, bw, bh);
      // full-res crisp rim (two offsets -> anti-aliased falloff)
      rimInto(Rb.ctx, A.canvas, bw, bh, dx, dy, rimCol, 0);
      a.globalAlpha = clamp(st.rimA * rimK); a.drawImage(Rb.canvas, 0, 0, bw, bh, 0, 0, bw, bh);
      a.globalAlpha = 1; a.globalCompositeOperation = 'source-over';
    }
    // composite to target
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.drawImage(A.canvas, 0, 0, bw, bh, x0, y0, bw, bh);
    const gl = (o.glow === undefined ? st.glow : o.glow) * rimK;
    if (gl > 0 && rimK > 0) {
      // halo: the rim, downsampled + blurred, screened over the result
      const sc = S.ctx; sc.globalCompositeOperation = 'copy'; sc.filter = 'blur(' + Math.max(0.8, rimPx * 0.8).toFixed(1) + 'px)';
      sc.drawImage(Rb.canvas, 0, 0, bw, bh, 0, 0, sw, sh); sc.filter = 'none'; sc.globalCompositeOperation = 'source-over';
      const ga = ctx.globalAlpha; ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = ga * clamp(gl);
      ctx.drawImage(S.canvas, 0, 0, sw, sh, x0, y0, bw, bh);
      ctx.globalAlpha = ga;
    }
    ctx.restore();
  }
  L.figureRender = figure; // exposed for other libs that want the same rim-light treatment

  /* ================================================================= hair */
  // Generates long-hair locks around a head centred at (0,0) (local head units).
  // o: view 'back'|'side', len, cap (half width), count, wisps, wind, windDir, gust, seed, swing (rad, lag offset),
  //    tilt (head rotation), spread, droop, t (quantised time), bodyX (fn y->x clamp for side view)
  function hairLocks(t, o) {
    const view = o.view || 'back', n = o.count || 26, seed = o.seed || 7;
    const len = o.len || 2.7, cap = o.cap || 0.47, wind = o.wind || 0, wd = o.windDir === undefined ? 0 : o.windDir;
    const gust = 0.78 + 0.22 * N2(seed * 0.1, t * 0.45) + 0.12 * N2(seed * 0.2 + 5, t * 1.7);
    const W = wind * gust; const tilt = o.tilt || 0, swing = o.swing || 0;
    const droop = (o.droop === undefined ? 0.32 : o.droop) * (cos(wd) >= 0 ? 1 : -1) / (1 + W * 0.6);
    const locks = [];
    const total = n + (o.wisps === undefined ? 7 : o.wisps);
    for (let i = 0; i < total; i++) {
      const wisp = i >= n; const r = R1(i, seed), r2 = R1(i, seed + 1), r3 = R1(i, seed + 2);
      let q = wisp ? (r * 2 - 1) : (n === 1 ? 0 : (i / (n - 1)) * 2 - 1);
      q = clamp(q + (r2 - 0.5) * 0.06, -1, 1);
      let root, a0, restFn, L0;
      if (view === 'back') {
        root = [q * cap * 0.86, -0.05 + 0.2 * q * q];
        L0 = len * (1 - 0.1 * q * q) * (0.93 + 0.12 * r3) * (wisp ? 0.85 + 0.2 * r : 1);
        const sp = o.spread === undefined ? 0.75 : o.spread;
        restFn = (s) => HP - q * sp * bell(s, 0.12, 0.16) + q * 0.08 * sstep(0.3, 1, s) + (r - 0.5) * 0.04;
      } else { // side profile, facing +x: roots from crown to nape along the back of the skull
        const k = wisp ? r : i / Math.max(1, n - 1);
        const ra = lerp(-1.45, 0.55, k); // angle on the skull ellipse (0 = back)
        root = [-cos(ra + 0) * cap * 0.92 * (ra < 0 ? 0.95 : 1), sin(ra) * 0.5 - 0.02];
        root = [-Math.cos(ra) * cap * 0.95, Math.sin(ra) * 0.52];
        L0 = len * (0.86 + 0.14 * k) * (0.94 + 0.1 * r3) * (wisp ? 0.9 : 1);
        const a00 = PI + ra + HP * 0.0; // tangent backward-down
        restFn = (s) => lerp(PI - 0.35 + k * 0.4, HP + 0.1 + (r - 0.5) * 0.06, sstep(0.0, 0.3, s));
        void a00;
      }
      const K = 16; const ds = L0 / K;
      // rotate root by tilt
      const ct = cos(tilt), stt = sin(tilt);
      let p = [root[0] * ct - root[1] * stt, root[0] * stt + root[1] * ct];
      const pts = [p]; const ws = [];
      const ph = r * TAU, fq = 1.0 + 0.5 * r2;
      const fan = ((view === 'back' ? q * 0.22 : (r - 0.5) * 0.3) + (r3 - 0.5) * 0.28) * (wisp ? 2.2 : 1);
      for (let k = 0; k < K; k++) {
        const s = (k + 0.5) / K;
        let th = restFn(s) + tilt * (1 - sstep(0, 0.6, s)) + swing * sstep(0.05, 0.9, s);
        let tgt = wd + droop + fan * Math.min(1, W) + 0.45 * N2(i * 0.37 + 3.1, t * 0.55 + s * 0.9) * Math.min(1.2, W);
        const infl = clamp(W * (0.18 + 0.82 * Math.pow(s, 0.75)) * (wisp ? 1.15 : 1)) * 0.94;
        th = angLerp(th, tgt, infl);
        th += W * (0.16 + 0.12 * r) * Math.pow(s, 1.05) * sin(TAU * (s * 1.25 - t * fq) + ph) * (wisp ? 1.6 : 1);
        th += (0.035 + 0.03 * r) * sin(t * 1.1 + i * 0.7) * s; // idle sway
        p = [p[0] + cos(th) * ds, p[1] + sin(th) * ds]; pts.push(p);
      }
      const w0 = wisp ? 0.012 + 0.012 * r : (cap * 2 / n) * (1.25 + 0.6 * r2) * (o.thick || 1);
      for (let k = 0; k <= K; k++) { const s = k / K; ws.push(w0 * Math.pow(1 - Math.pow(s, 1.5), 0.85) * (0.85 + 0.35 * sin(PI * Math.min(1, s * 1.3))) + (wisp ? 0 : 0.002)); }
      locks.push({ pts, ws, q, wisp, depth: wisp ? 2 : (view === 'back' ? 1 - Math.abs(q) : (1 - (i / n))) });
    }
    locks.sort((a, b) => a.depth - b.depth);
    return locks;
  }
  // draw hair (cap + locks) at head centre hc with rotation; in local units of the current transform
  function drawHair(c, t, hc, o) {
    c.save(); c.translate(hc[0], hc[1]);
    const cap = o.cap || 0.47;
    if (o.capShape !== false) {
      c.save(); c.rotate(o.tilt || 0);
      if ((o.view || 'back') === 'back') { ell(c, 0, -0.04, cap, 0.56); }
      else { ell(c, -0.05, -0.06, cap * 0.98, 0.56, -0.15); }
      c.restore();
    }
    for (const lk of hairLocks(t, o)) ribbon(c, lk.pts, lk.ws);
    c.restore();
  }
  // PUBLIC: long black hair (the heroine's). o.x,o.y = head centre; scale; view; len; wind; windDir; style...
  L.hairLong = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const ho = Object.assign({ view: 'back' }, o);
    if (o.style) {
      const L0 = (o.len || 2.7) + 0.6;
      figure(ctx, o, [-L0 - 0.6, -0.8, L0 + 0.6, L0 + 0.3], (F) => { F.layer({}, (c) => drawHair(c, tq, [0, 0], ho)); });
    } else {
      const s = (o.scale || 1) * U; ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.scale(o.flip ? -s : s, s);
      ctx.fillStyle = o.color || '#0c1019'; drawHair(ctx, tq, [0, 0], ho); ctx.restore();
    }
  };

  /* ================================================================ parts */
  // character specs (head units)
  const GIRL = { sh: 0.6, neckW: 0.16, waist: 0.44, hip: 0.64, torso: 2.2, upArm: 1.18, foreArm: 1.0, hand: 0.74, thigh: 1.78, shin: 1.75, armR: 0.13, legR: 0.27 };
  const BOY = { sh: 0.84, neckW: 0.22, waist: 0.56, hip: 0.6, torso: 2.45, upArm: 1.32, foreArm: 1.1, hand: 0.82, thigh: 1.95, shin: 1.92, armR: 0.16, legR: 0.3, k: 1.04 };

  // hands. local frame: wrist at origin, fingers toward +x, thumb toward -y (mirror with my=-1)
  function handMitt(c, curl = 0) {
    const f = 1 - curl * 0.45;
    blob(c, [[0, -0.12], [0.2, -0.14], [0.42, -0.14], [0.42 + 0.33 * f, -0.08 + curl * 0.12], [0.45 + 0.35 * f, 0.0 + curl * 0.16], [0.4 + 0.3 * f, 0.09 + curl * 0.1], [0.42, 0.13], [0.2, 0.13], [0, 0.11]]);
    seg(c, [0.1, -0.1], [0.33, -0.25 + curl * 0.08], 0.07, 0.045, 0.07, 0.4);
  }
  function handOpen(c, spread = 0.6, curl = 0.15) {
    blob(c, [[0, -0.12], [0.22, -0.16], [0.42, -0.13], [0.46, -0.02], [0.43, 0.1], [0.24, 0.14], [0, 0.11]]);
    const F = [[-0.11, 0.33, 0.055], [-0.035, 0.37, 0.058], [0.04, 0.35, 0.055], [0.105, 0.28, 0.048]];
    F.forEach(([y, l, w], i) => {
      const a = (i - 1.5) * 0.17 * spread; let p = [0.41, y]; let ang = a;
      for (let j = 0; j < 3; j++) { const sl = l * [0.45, 0.32, 0.23][j]; const q = polar(p, ang, sl); seg(c, p, q, w * (1 - j * 0.12), w * (0.9 - j * 0.12)); p = q; ang += curl * (0.45 + j * 0.2); }
    });
    let p = [0.08, -0.1], ang = -0.75 - 0.25 * spread;
    for (let j = 0; j < 2; j++) { const q = polar(p, ang, [0.2, 0.16][j]); seg(c, p, q, 0.065, 0.052); p = q; ang += 0.35 + curl * 0.3; }
  }
  function handGrip(c) { // fist around a bar/neck (bar axis along y at x~0.42)
    blob(c, [[0, -0.12], [0.22, -0.15], [0.4, -0.15], [0.56, -0.1], [0.6, 0.02], [0.55, 0.13], [0.36, 0.15], [0.18, 0.13], [0, 0.11]]);
    seg(c, [0.12, -0.12], [0.36, -0.2], 0.065, 0.05);
  }
  function hand(c, wrist, ang, size, kind, mirror, a, b) {
    local(c, wrist, ang, size / 0.78, mirror ? -1 : 1, (cc) => { if (kind === 'open') handOpen(cc, a, b); else if (kind === 'grip') handGrip(cc); else handMitt(cc, a || 0); });
  }
  // shoes, side view. local: ankle at origin, toes toward +x, ground at +0.27
  function shoeSide(c, kind) {
    if (kind === 'heel') {
      blob(c, [[-0.13, -0.08], [-0.2, 0.06], [-0.19, 0.16, 1], [-0.12, 0.17], [-0.11, 0.29, 1], [-0.05, 0.29, 1], [-0.04, 0.2], [0.18, 0.2], [0.5, 0.27], [0.74, 0.28], [0.85, 0.25, 1], [0.78, 0.19], [0.5, 0.1], [0.22, 0.0], [0.06, -0.08]]);
    } else if (kind === 'barefoot') {
      blob(c, [[-0.12, -0.07], [-0.19, 0.1], [-0.15, 0.24], [0.2, 0.25], [0.66, 0.28], [0.8, 0.25], [0.75, 0.17], [0.45, 0.08], [0.15, -0.03], [0.04, -0.09]]);
    } else {
      blob(c, [[-0.12, -0.06], [-0.2, 0.08], [-0.2, 0.26, 1], [0.1, 0.29], [0.7, 0.29], [0.86, 0.24], [0.83, 0.12], [0.58, 0.04], [0.3, -0.02], [0.08, -0.08]]);
    }
  }
  function shoe(c, ankle, ang, size, kind) { local(c, ankle, ang, size, 1, (cc) => shoeSide(cc, kind)); }
  // shoe seen from behind (heel cup). ankle point; w = half width
  function shoeBack(c, ankle, w, kind, lift = 0) {
    const [x, y] = ankle;
    blob(c, [[x - w * 0.8, y - 0.05], [x - w, y + 0.1], [x - w * 0.9, y + 0.24 - lift * 0.1], [x, y + 0.27 - lift * 0.08], [x + w * 0.9, y + 0.24 - lift * 0.1], [x + w, y + 0.1], [x + w * 0.8, y - 0.05]]);
    if (kind === 'heel') seg(c, [x, y + 0.2], [x, y + 0.3], 0.05, 0.035);
  }

  // ---- heads
  // girl/boy profile head, facing +x. local: head centre origin, units = head units
  function headProfile(c, boy) {
    if (boy) {
      blob(c, [[-0.04, -0.54], [0.22, -0.49], [0.37, -0.32], [0.41, -0.1], [0.40, -0.02], [0.49, 0.13, 1], [0.41, 0.18], [0.42, 0.235], [0.39, 0.265], [0.405, 0.3], [0.36, 0.35], [0.37, 0.42], [0.3, 0.47], [0.1, 0.45], [-0.06, 0.33], [-0.3, 0.2], [-0.45, -0.05], [-0.4, -0.33]]);
    } else {
      blob(c, [[-0.04, -0.53], [0.22, -0.47], [0.36, -0.3], [0.395, -0.1], [0.385, -0.01], [0.465, 0.125, 1], [0.39, 0.175], [0.4, 0.23], [0.372, 0.262], [0.39, 0.295], [0.345, 0.34], [0.35, 0.395], [0.29, 0.44], [0.1, 0.42], [-0.04, 0.3], [-0.28, 0.2], [-0.44, -0.05], [-0.38, -0.33]]);
    }
  }
  // boy's messy short hair, profile (facing +x). local head frame. wind displaces tufts.
  function boyHairSide(c, t, wind, wd, seed) {
    const W = wind || 0; const wx = cos(wd || PI) * W, wy = sin(wd || PI) * W;
    const tuft = (i, x, y) => { const n = N2(seed + i * 1.7, t * 1.3); return [x + wx * (0.06 + 0.05 * n) * (x < 0 ? 1.2 : 0.8), y + wy * 0.05 + 0.02 * n * W]; };
    blob(c, [tuft(0, 0.33, -0.36), [0.2, -0.55], tuft(1, -0.05, -0.64), tuft(2, -0.3, -0.58), tuft(3, -0.5, -0.42), tuft(4, -0.58, -0.22), tuft(5, -0.5, -0.08), tuft(6, -0.55, 0.08, 1), [-0.42, 0.1], tuft(7, -0.42, 0.24, 1), [-0.3, 0.2], [-0.18, 0.08], [-0.06, 0.05], [0.05, -0.08], [0.16, -0.12], tuft(8, 0.3, -0.06, 1), [0.3, -0.16], tuft(9, 0.43, -0.12, 1), [0.38, -0.24]]);
  }
  // girl's fringe + side lock, profile
  function girlBangsSide(c, t, wind, wd) {
    const W = wind || 0; const wx = cos(wd === undefined ? PI : wd) * W;
    const b = (x, y, i) => [x + wx * 0.07 * (1 + 0.4 * N2(i * 3.3, t * 1.4)), y - Math.abs(wx) * 0.03];
    blob(c, [[0.3, -0.42], b(0.42, -0.28, 0), b(0.44, -0.06, 1).concat(1), [0.38, -0.12], b(0.4, 0.0, 2).concat(1), [0.31, -0.1], [0.24, -0.03], [0.2, 0.05], [0.12, -0.2], [0.05, -0.4]]);
  }

  /* ---------------------------------------------------------- back torso */
  // back-view torso. P pelvis (hip-joint level), N neck base, SL/SR shoulder joints (screen left/right). sp spec, o {blazer, boy}
  function torsoBack(c, P, N, SL, SR, sp, o = {}) {
    const up = norm(sub(N, P)); const Lt = len2(sub(N, P)); const F = frame(P, up); const k = Lt / sp.torso;
    const wS = o.boy ? 1 : 1, wW = sp.waist, wH = sp.hip;
    const side = (sgn) => {
      const S = sgn < 0 ? SL : SR; const so = add(S, mul([-up[1], up[0]], sgn * 0.13));
      const tr = F(sgn * (sp.neckW + (sp.sh - sp.neckW) * 0.42), Lt - 0.02 * k);
      return [F(sgn * sp.neckW * 0.95, Lt + 0.42 * k), F(sgn * sp.neckW * 1.05, Lt + 0.06 * k), tr,
        add(S, mul(up, 0.11)), add(so, mul(up, -0.06)),
        F(sgn * (sp.sh * 0.98) * wS, Lt - 0.55 * k), F(sgn * (wW + (sp.sh - wW) * 0.35), Lt - 1.05 * k),
        F(sgn * wW, 0.62 * k * (sp.torso / 2.2)), F(sgn * (o.blazer ? wH * 0.98 : wH * 0.9), o.blazer ? 0.12 : 0.15), F(sgn * wH * (o.blazer ? 0.97 : 0.86), o.blazer ? -0.06 : -0.12)];
    };
    const r = side(1), l = side(-1).reverse();
    blob(c, r.concat([F(0, o.blazer ? -0.04 : -0.2)], l));
  }
  // pleated skirt, back view. top at waist centre Wc (local frame from up vector), hem y below
  function skirtBack(c, t, Wc, up, topW, hipW, hemW, hemL, o = {}) {
    const F = frame(Wc, up); const W = o.wind || 0, wd = o.windDir || 0; const seed = o.seed || 3;
    const wx = cos(wd) * W, wy = sin(wd) * W; const nP = 11;
    const pts = [F(-topW, 0), F(-hipW, -hemL * 0.38)];
    const disp = (u, d) => { const n = N2(seed + u * 2.3, t * 1.6), n2 = N2(seed + 9 + u * 3.1, t * 2.4); const lee = 0.5 + 0.5 * Math.sign(wx) * (u * 2 - 1);
      return [wx * d * (0.25 + 0.2 * lee + 0.08 * n), wy * d * 0.2 - Math.abs(wx) * d * (0.1 + 0.18 * lee) * (0.7 + 0.5 * n2) + 0.03 * n * W * d]; };
    const hem = [];
    for (let i = 0; i <= nP; i++) {
      const u = i / nP; const x = lerp(-hemW, hemW, u); const yy = -hemL - (i % 2 ? 0.0 : 0.05) - 0.06 * sin(PI * u) + 0.0;
      const d = disp(u, 1); hem.push([F(x, yy)[0] + d[0], F(x, yy)[1] + d[1], i % 2 ? 0 : 1]);
    }
    const sR = disp(1, 0.45), sL = disp(0, 0.45);
    const hL = F(-hipW, -hemL * 0.38), hR = F(hipW, -hemL * 0.38);
    blob(c, [F(-topW, 0.02), [hL[0] + sL[0], hL[1] + sL[1]]].concat(hem, [[hR[0] + sR[0], hR[1] + sR[1]], F(topW, 0.02)]));
    void pts;
  }

  /* ============================================================ figures */
  // ---------------------------------------------------------------- girl standing, back view
  // pose: {lean, hipShift, armL:{sh,el,wr,hand}, ...}. Ground origin, returns parts drawers.
  function girlBackStanding(F, t, o, pose) {
    const sp = GIRL; const W = o.wind || 0, wd = o.windDir === undefined ? 0 : o.windDir;
    const hs = pose.hipShift || 0; const lean = pose.lean || 0;
    const P = [hs, -3.78]; const up = norm([sin(lean), -cos(lean)]);
    const N = add(P, mul(up, sp.torso));
    const shrug = pose.shrug || 0;
    const SL = add(frame(P, up)(-sp.sh, sp.torso - 0.2), [0, -shrug]), SR = add(frame(P, up)(sp.sh, sp.torso - 0.2), [0, -shrug]);
    const head = add(N, add(mul(up, 0.72), [pose.headX || 0, pose.headY || 0]));
    const hipL = frame(P, up)(-0.34, 0), hipR = frame(P, up)(0.34, 0);
    const feet = pose.feet || [[-0.3, -0.27], [0.3, -0.27]];
    const legs = () => {
      for (const [hp, ft, sg] of [[hipL, feet[0], -1], [hipR, feet[1], 1]]) {
        const kn = ik(hp, ft, sp.thigh, sp.shin, sg < 0 ? -0.0001 : 0.0001);
        const knee = mix2(mix2(hp, ft, 0.5), kn, 0.3); knee[0] -= sg * 0.04;
        seg(F === null ? null : F._c, hp, knee, 0.3, 0.17, 0.27, 0.35, 0.3, 0.3);
      }
    };
    void legs;
    return { P, up, N, SL, SR, head, hipL, hipR, feet };
  }

  // the arm, generic: shoulder S, elbow E, wrist Wr; sizes from spec
  function arm(c, S, E, Wr, sp, outerSign, handKind, handAng, mirror, ha, hb) {
    const r = sp.armR;
    seg(c, S, E, r * 1.15, r * 0.82, r * 1.2, 0.3, r * 1.0, 0.4);
    seg(c, E, Wr, r * 0.85, r * 0.55, r * 1.0, 0.25, r * 0.9, 0.3);
    if (handKind !== 'none') hand(c, Wr, handAng === undefined ? Math.atan2(Wr[1] - E[1], Wr[0] - E[0]) : handAng, sp.hand, handKind || 'mitt', mirror, ha, hb);
  }
  function legBack(c, H, K, A, sp, sgn, cfg = {}) {
    const r = sp.legR;
    seg(c, H, K, r * 1.12, r * 0.64, r * (cfg.outer || 1.05), 0.3, r * 0.98, 0.35);
    // calf: inner side (toward body centre) bulges lower and more
    const inner = sgn < 0 ? 'A' : 'B';
    const bIn = r * 0.86, bOut = r * 0.8;
    // seg sides: A = left of travel. Travel downward (K->A): A side = screen +x (right)
    if (sgn < 0) seg(c, K, A, r * 0.64, r * 0.36, bIn, 0.28, bOut, 0.22); else seg(c, K, A, r * 0.64, r * 0.36, bOut, 0.22, bIn, 0.28);
    void inner;
  }
  function legSide(c, H, K, A, sp, cfg = {}) { // facing +x: front = side B for downward legs? computed by seg orientation
    const r = sp.legR; const thighFront = cfg.flipSides ? 'B' : 'A'; void thighFront;
    seg(c, H, K, r * 1.15, r * 0.66, r * 1.05, 0.3, r * 1.0, 0.25);
    seg(c, K, A, r * 0.66, r * 0.36, r * 0.7, 0.35, r * 0.86, 0.25);
  }

  /* ----------------------------------------------------- girlAtRailing */
  L.girlAtRailing = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const W = o.wind === undefined ? 1.0 : o.wind, wd = o.windDir === undefined ? 0 : o.windDir;
    const sp = GIRL; const seed = o.seed || 11;
    const sway = 0.02 * N2(seed, tq * 0.4) + W * 0.015 * N2(seed + 3, tq * 1.1);
    const P = [sway, -3.78]; const lean = 0.03 * W * Math.sign(cos(wd)) + sway * 0.3; const up = norm([sin(lean), -cos(lean)]);
    const FR = frame(P, up); const N = FR(0, sp.torso);
    const SL = FR(-sp.sh, sp.torso - 0.18), SR = FR(sp.sh, sp.torso - 0.18);
    const head = FR(0.02, sp.torso + 0.74);
    const hipL = FR(-0.33, 0), hipR = FR(0.33, 0);
    const ftL = [-0.3, -0.26], ftR = [0.32, -0.26];
    const knL = [-0.27, -2.02], knR = [0.29, -2.02];
    const railY = o.railY === undefined ? -3.95 : o.railY; // rail height (local)
    const hands = o.hands || 'rail';
    const cast = !!o.cast;
    const skirtO = { wind: W, windDir: wd, seed };
    const hairO = { view: 'back', len: o.hairLen || 2.75, wind: W * 1.15, windDir: wd + (o.windLift === undefined ? -0.12 : o.windLift), seed: seed + 5, count: 28, tilt: lean * 0.5 };
    const bb = [-4.2, -8.4, 4.2, 0.6];
    figure(ctx, o, bb, (F) => {
      // railing behind her (further from camera)
      if (o.railing !== false) F.layer({ rim: 0.8 }, (c) => {
        c.fillRect(-4.6, railY - 0.07, 9.2, 0.14);
        c.fillRect(-4.6, railY + 0.75, 9.2, 0.06);
        for (let x = -4.4; x <= 4.4; x += 0.9) c.fillRect(x - 0.035, railY, 0.07, -railY);
      });
      // arms + legs (behind torso)
      F.layer({ rim: 0.85 }, (c) => {
        legBack(c, hipL, knL, [ftL[0], ftL[1]], sp, -1); legBack(c, hipR, knR, [ftR[0], ftR[1]], sp, 1);
        shoeBack(c, ftL, 0.13, 'loafer'); shoeBack(c, ftR, 0.13, 'loafer');
        // arms: hands on the rail, slightly wider than shoulders
        const hL = [-1.05, railY - 0.06], hR = [1.05, railY - 0.06];
        const eL = ik(SL, hL, sp.upArm * 0.92, sp.foreArm * 0.9, -1), eR = ik(SR, hR, sp.upArm * 0.92, sp.foreArm * 0.9, 1);
        arm(c, SL, eL, hL, sp, -1, 'grip', PI * 0.5 + 0.3, true);
        if (cast) { // right arm in a sling: elbow bent, forearm in front of body (hidden), bulky cast at elbow
          const e = add(SR, [0.12, 1.05]); seg(c, SR, e, sp.armR * 1.15, sp.armR * 1.3, sp.armR * 1.25, 0.3); ell(c, e[0] - 0.05, e[1] + 0.02, 0.2, 0.17);
        } else arm(c, SR, eR, hR, sp, 1, 'grip', PI * 0.5 - 0.3, false);
      });
      // torso + skirt + neck
      F.layer({}, (c) => {
        torsoBack(c, P, N, SL, SR, sp, { blazer: o.outfit !== 'blouse' });
        const wc = FR(0, 0.78); skirtBack(c, tq, wc, up, 0.44, 0.68, 0.9, 1.95, skirtO);
        seg(c, N, add(head, [0, 0.2]), 0.15, 0.14);
        if (cast) { c.lineWidth = 0.05; c.beginPath(); c.moveTo(SR[0] - 0.42, SR[1] - 0.1); c.quadraticCurveTo(SR[0] + 0.1, SR[1] + 0.3, SR[0] + 0.18, SR[1] + 1.0); c.stroke(); }
      });
      // hair on top
      F.layer({ rim: 1.1 }, (c) => drawHair(c, tq, head, hairO));
    });
  };

  /* ---------------------------------------------------- girlAtPianoBack */
  // anchor: bench top centre (where she sits). o.intensity 0..1, o.turn (-1..1 oblique), o.bench (true)
  L.girlAtPianoBack = function (ctx, t, o = {}) {
    const tq = quant(t, o.fps === undefined ? 12 : o.fps);
    const I = o.intensity === undefined ? 0.3 : o.intensity; const sp = GIRL; const seed = o.seed || 21;
    const turn = o.turn === undefined ? 0.25 : o.turn;
    // performance motion
    const ph = tq * (1.6 + I * 1.4);
    const swayX = I * (0.16 * sin(ph * 0.7) + 0.07 * N2(seed, tq * 1.3)) + 0.02 * sin(tq * 0.8);
    const fwd = I * (0.5 + 0.5 * sin(ph * 0.45 + 1)) * 0.25 + 0.06; // forward lean (head lowers)
    const breathe = 0.015 * sin(tq * 1.7);
    const P = [swayX * 0.4, -0.26];
    const lean = swayX * 0.32; const up = norm([sin(lean), -cos(lean)]);
    const FR = frame(P, up); const tl = sp.torso * (1 - fwd * 0.12);
    const N = FR(0, tl + breathe);
    const accent = I * Math.max(0, N2(seed + 7, tq * 2.2)) * 0.12;
    const SL = FR(-sp.sh * (1 - turn * 0.12), tl - 0.17 + accent), SR = FR(sp.sh * (1 + turn * 0.05), tl - 0.17 + accent * 0.6);
    const headDrop = fwd * 0.9 + I * 0.05 * sin(ph * 1.3);
    const head = add(FR(turn * 0.08, tl + 0.72 - headDrop), [swayX * 0.25, 0]);
    // hands travel along the keyboard
    const kY = -1.42;
    const hlx = -0.45 - I * (0.35 + 0.35 * sin(ph * 0.9)) + 0.05 * sin(tq * 3.1), hrx = 0.5 + I * (0.4 + 0.45 * sin(ph * 0.8 + 2.0)) + 0.06 * sin(tq * 2.7);
    const swingHair = -lean * 1.4 - I * 0.25 * cos(ph * 0.7);
    const hairO = { view: 'back', len: o.hairLen || 2.45, wind: o.wind || 0.06, windDir: o.windDir || 0, seed: seed + 3, count: 26, tilt: lean * 0.8 + turn * 0.05, swing: swingHair, spread: 0.7 };
    const bench = o.bench !== false;
    const bb = [-3.6, -4.6, 3.6, 2.4];
    figure(ctx, o, bb, (F) => {
      // shins / feet seen under the bench + forearms toward keys (far)
      F.layer({ rim: 0.6 }, (c) => {
        seg(c, [-0.32, 0.25], [-0.42, 1.95], 0.18, 0.1, 0.2, 0.3); seg(c, [0.34, 0.25], [0.48, 1.9], 0.18, 0.1, 0.2, 0.3);
        ell(c, -0.44, 2.0, 0.13, 0.09); ell(c, 0.5, 1.96, 0.13, 0.09);
        const eL = add(SL, [-0.32 - I * 0.1, 1.0]), eR = add(SR, [0.32 + I * 0.1, 1.0]);
        seg(c, eL, [hlx, kY], 0.11, 0.075); seg(c, eR, [hrx, kY], 0.11, 0.075);
        hand(c, [hlx, kY], -HP - 0.3, 0.45, 'mitt', false, 0.6); hand(c, [hrx, kY], -HP + 0.3, 0.45, 'mitt', true, 0.6);
      });
      if (bench) F.layer({ rim: 0.7 }, (c) => {
        blob(c, [[-1.55, -0.02], [1.55, -0.02], [1.6, 0.06], [1.58, 0.26], [-1.58, 0.26], [-1.6, 0.06]]);
        seg(c, [-1.35, 0.2], [-1.4, 2.05], 0.08, 0.06); seg(c, [1.35, 0.2], [1.4, 2.05], 0.08, 0.06);
        seg(c, [-1.0, 0.2], [-0.95, 1.95], 0.06, 0.05); seg(c, [1.0, 0.2], [0.95, 1.95], 0.06, 0.05);
        c.fillRect(-1.38, 0.3, 2.76, 0.1);
      });
      // torso, upper arms, skirt
      F.layer({}, (c) => {
        const eL = add(SL, [-0.32 - I * 0.1, 1.0]), eR = add(SR, [0.32 + I * 0.1, 1.0]);
        seg(c, SL, eL, 0.15, 0.11, 0.16, 0.3); seg(c, SR, eR, 0.15, 0.11, 0.16, 0.3);
        torsoBack(c, P, N, SL, SR, sp, { blazer: o.outfit === 'blazer' });
        // seated skirt: spreads over the bench
        const F2 = frame(P, up);
        blob(c, [F2(-0.44, 0.8), F2(-0.72, 0.3), [-0.92 + P[0] * 0.5, 0.0], [-0.96, 0.16, 1], [0, 0.2], [0.96, 0.16, 1], [0.92 + P[0] * 0.5, 0.0], F2(0.72, 0.3), F2(0.44, 0.8)]);
        seg(c, N, add(head, [0, 0.25]), 0.15, 0.14);
      });
      F.layer({ rim: 1.1 }, (c) => drawHair(c, tq, head, hairO));
    });
  };
})();

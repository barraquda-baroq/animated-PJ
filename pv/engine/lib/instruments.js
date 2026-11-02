/* ============================================================================
 * Instruments & music-room art library — 『キミの右手のアイロニー』PV
 * Anime background-art style, Canvas2D only, fully deterministic.
 * Namespace PV.lib   (API reference: analysis/art_review/instruments_API.md)
 *
 *   grandPiano(ctx,o)      keysClose(ctx,t,o)  keyPos(o,i)  keyIndex('C4')
 *   acousticGuitar(ctx,o)  strat(ctx,o)        fretboard(ctx,t,o)  fretPos(o,s,f)
 *   amp(ctx,t,o)           sheetMusic(ctx,t,o)
 *   musicRoom(ctx,t,o)     windowCurtain(ctx,t,o)
 *   concertStage(ctx,t,o)  gymStage(ctx,t,o)
 * ========================================================================== */
(function () {
  'use strict';
  const PV = window.PV; const L = (PV.lib = PV.lib || {});
  const W = PV.W, H = PV.H, TAU = Math.PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const fract = x => x - Math.floor(x);

  /* ------------------------------------------------------------ vectors */
  const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vmul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vlen = a => Math.hypot(a[0], a[1], a[2]);
  const vnorm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const vlerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const reflect = (d, n) => { const k = 2 * vdot(d, n); return [d[0] - k * n[0], d[1] - k * n[1], d[2] - k * n[2]]; };
  const mirrorP = (p, n, d) => { const k = 2 * (vdot(p, n) - d); return [p[0] - k * n[0], p[1] - k * n[1], p[2] - k * n[2]]; };

  /* ------------------------------------------------------------ colour (rgb arrays, values may exceed 255 = HDR) */
  const hx = h => (Array.isArray(h) ? h : PV.hex2rgb(h));
  const tone = c => { const m = Math.max(c[0], c[1], c[2]); if (m <= 255) return c; const e = (m - 255) * 0.55; return [c[0] + e, c[1] + e, c[2] + e]; };
  const cs = (c, a) => {
    const d = tone(c); const r = Math.round(clamp(d[0], 0, 255)), g = Math.round(clamp(d[1], 0, 255)), b = Math.round(clamp(d[2], 0, 255));
    return a === undefined || a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a > 0 ? a.toFixed(4) : 0})`;
  };
  const cmix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const cmul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const cadd = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const cfilt = (a, b) => [a[0] * b[0] / 255, a[1] * b[1] / 255, a[2] * b[2] / 255];

  /* ------------------------------------------------------------ camera (pinhole, y up) */
  // mirror=true for left-handed worlds (x right, y up, z away from viewer)
  function makeCam(eye, target, focal, cx, cy, roll, near, mirror, up) {
    const f = vnorm(vsub(target, eye));
    let r = vcross(f, up || [0, 1, 0]); if (vlen(r) < 1e-6) r = [1, 0, 0]; r = vnorm(r);
    let u = vcross(r, f);
    if (mirror) r = vmul(r, -1);
    if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const r2 = vadd(vmul(r, c), vmul(u, s)); u = vsub(vmul(u, c), vmul(r, s)); r = r2; }
    const ex = eye[0], ey = eye[1], ez = eye[2];
    const cam = { eye, f, r, u, focal, cx, cy, near: near || 0.01 };
    cam.cs = p => { const dx = p[0] - ex, dy = p[1] - ey, dz = p[2] - ez; return [dx * r[0] + dy * r[1] + dz * r[2], dx * u[0] + dy * u[1] + dz * u[2], dx * f[0] + dy * f[1] + dz * f[2]]; };
    cam.p = p => { const q = cam.cs(p); const z = q[2] > cam.near ? q[2] : cam.near; return [cam.cx + focal * q[0] / z, cam.cy - focal * q[1] / z, q[2]]; };
    cam.depth = p => (p[0] - ex) * f[0] + (p[1] - ey) * f[1] + (p[2] - ez) * f[2];
    cam.facing = (P, n) => (ex - P[0]) * n[0] + (ey - P[1]) * n[1] + (ez - P[2]) * n[2] > 0;
    cam.scaleAt = p => { const z = cam.depth(p); return focal / Math.max(z, cam.near); };
    // polygon projection with near-plane clipping (Sutherland–Hodgman)
    cam.poly = pts => {
      const q = pts.map(cam.cs); const nr = cam.near; let list = q;
      if (!q.every(v => v[2] >= nr)) {
        list = [];
        for (let i = 0; i < q.length; i++) {
          const a = q[i], b = q[(i + 1) % q.length], ai = a[2] >= nr, bi = b[2] >= nr;
          if (ai) list.push(a);
          if (ai !== bi) { const t = (nr - a[2]) / (b[2] - a[2]); list.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, nr]); }
        }
        if (list.length < 3) return null;
      }
      return list.map(v => [cam.cx + focal * v[0] / v[2], cam.cy - focal * v[1] / v[2]]);
    };
    // polyline (open) projection with clipping
    cam.line = pts => {
      const out = []; let prev = null;
      for (const p of pts) {
        const v = cam.cs(p);
        if (prev) {
          const ai = prev[2] >= cam.near, bi = v[2] >= cam.near;
          if (ai !== bi) { const t = (cam.near - prev[2]) / (v[2] - prev[2]); const c = [prev[0] + (v[0] - prev[0]) * t, prev[1] + (v[1] - prev[1]) * t, cam.near]; out.push([cam.cx + focal * c[0] / c[2], cam.cy - focal * c[1] / c[2], c[2]]); }
        }
        if (v[2] >= cam.near) out.push([cam.cx + focal * v[0] / v[2], cam.cy - focal * v[1] / v[2], v[2]]);
        else if (out.length) out.push(null);
        prev = v;
      }
      return out;
    };
    return cam;
  }

  /* ------------------------------------------------------------ 2-D path helpers */
  function trace(ctx, pts) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
  function fillP(ctx, pts, style) { if (!pts || pts.length < 3) return; ctx.beginPath(); trace(ctx, pts); ctx.fillStyle = style; ctx.fill(); }
  function strokeL(ctx, pts, style, w) { if (!pts || pts.length < 2) return; ctx.beginPath(); let pen = false; for (const p of pts) { if (!p) { pen = false; continue; } if (!pen) { ctx.moveTo(p[0], p[1]); pen = true; } else ctx.lineTo(p[0], p[1]); } ctx.strokeStyle = style; ctx.lineWidth = w; ctx.stroke(); }
  // Catmull-Rom closed/open spline through points -> dense polyline
  function spline(pts, closed, seg = 8) {
    const out = []; const n = pts.length; const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < seg; k++) {
        const t = k / seg, t2 = t * t, t3 = t2 * t;
        out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  }
  function pathPts(ctx, pts, closed = true) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); if (closed) ctx.closePath(); }
  function bez(out, p0, p1, p2, p3, n, skip) {
    for (let i = skip ? 1 : 0; i <= n; i++) {
      const t = i / n, m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
      out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
    }
  }

  // offscreen scratch buffer that inherits the caller's transform
  function scratch(ctx, key) {
    const b = PV.buffer('instr:' + key); b.ctx.clearRect(0, 0, W, H); b.ctx.setTransform(ctx.getTransform()); return b;
  }
  function blit(ctx, b, alpha = 1, op = 'source-over', filter) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op; if (filter) ctx.filter = filter;
    ctx.drawImage(b.canvas, 0, 0); ctx.restore();
  }
  /* Rim light on an arbitrary silhouette: paints the edge band that faces the light.
   * sil: function(c) painting the silhouette in the caller's transform, OR an already-rendered screen-space canvas.
   * o: {dx,dy (px toward light), color, alpha, soft (px glow width), blur, op} */
  function rimLight(ctx, sil, o) {
    let A;
    if (typeof sil === 'function') { A = scratch(ctx, 'rimA'); sil(A.ctx); A = A.canvas; } else A = sil;
    const a0 = o.alpha === undefined ? 0.9 : o.alpha;
    const pad = Math.ceil((o.soft || 0) * 1.5 + Math.hypot(o.dx, o.dy) * 2 + 8);
    let bx = 0, by = 0, bw = W, bh = H;
    if (o.bbox) { bx = Math.max(0, Math.floor(o.bbox[0] - pad)); by = Math.max(0, Math.floor(o.bbox[1] - pad)); bw = Math.min(W, Math.ceil(o.bbox[2] + pad)) - bx; bh = Math.min(H, Math.ceil(o.bbox[3] + pad)) - by; if (bw <= 0 || bh <= 0) return; }
    const B = PV.buffer('instr:rimB', bw, bh);
    const pass = (dx, dy, alpha, blur) => {
      B.ctx.globalCompositeOperation = 'source-over'; B.ctx.clearRect(0, 0, bw, bh); B.ctx.drawImage(A, bx, by, bw, bh, 0, 0, bw, bh);
      B.ctx.globalCompositeOperation = 'destination-out'; B.ctx.drawImage(A, bx, by, bw, bh, -dx, -dy, bw, bh);
      B.ctx.globalCompositeOperation = 'source-in'; B.ctx.fillStyle = o.color || '#fff2d6'; B.ctx.fillRect(0, 0, bw, bh);
      B.ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = o.op || 'screen';
      if (blur > 1.5) {
        const hw = Math.ceil(bw / 2), hh = Math.ceil(bh / 2); const Hh = PV.buffer('instr:rimH', hw, hh); Hh.ctx.clearRect(0, 0, hw, hh); Hh.ctx.filter = `blur(${(blur / 2).toFixed(2)}px)`; Hh.ctx.drawImage(B.canvas, 0, 0, bw, bh, 0, 0, hw, hh); Hh.ctx.filter = 'none';
        ctx.drawImage(Hh.canvas, 0, 0, hw, hh, bx, by, bw, bh);
      } else ctx.drawImage(B.canvas, 0, 0, bw, bh, bx, by, bw, bh);
      ctx.restore();
    };
    pass(o.dx, o.dy, a0, o.blur || 0);
    if (o.soft) { const k = o.soft / Math.max(1e-3, Math.hypot(o.dx, o.dy)); pass(o.dx * k, o.dy * k, a0 * (o.softAlpha === undefined ? 0.22 : o.softAlpha), o.soft * 0.6); }
  }
  // render fn(c) as a flat silhouette (seams closed by a 1px dilation) into a screen-space buffer
  function silBuffer(ctx, key, fn) {
    const B = scratch(ctx, key); fn(B.ctx);
    B.ctx.setTransform(1, 0, 0, 1, 0, 0);
    const T = PV.buffer('instr:silTmp'); T.ctx.clearRect(0, 0, W, H); T.ctx.drawImage(B.canvas, 0, 0);
    for (const [dx, dy] of [[0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]]) B.ctx.drawImage(T.canvas, dx, dy);
    return B.canvas;
  }
  L._rimLight = rimLight; // shared with other libs if useful
  // dev profiling: PV._iprof = true -> console.log per-section timings (flushes the canvas at each mark)
  function profMarks(ctx, name) { if (!PV._iprof) return () => {}; const marks = [['start', performance.now()]]; return (k) => { ctx.getImageData(0, 0, 1, 1); marks.push([k, performance.now()]); if (k === 'end') console.log('PROFILE ' + name + ' ' + marks.slice(1).map((m, i) => m[0] + ':' + (m[1] - marks[i][1]).toFixed(1)).join(' | ')); }; }

  /* ======================================================================
   * Light environment for glossy reflections (rectangular windows / discs)
   * ====================================================================== */
  function makeWin(c, ax, ay, n, nx, ny, mull, col, k) {
    return { kind: 'rect', c, ax, ay, n: vnorm(n), ax2: vdot(ax, ax), ay2: vdot(ay, ay), nx, ny, mull, col, k };
  }
  function makeDisc(c, r, n, col, k) { return { kind: 'disc', c, r, n: vnorm(n), col, k }; }
  function envLook(env, P, R, noLights) {
    if (!noLights) for (const w of env.lights) {
      const den = vdot(R, w.n); if (den > -1e-4) continue;
      const t = vdot(vsub(w.c, P), w.n) / den; if (t <= 0) continue;
      const hit = vadd(P, vmul(R, t)); const d = vsub(hit, w.c);
      if (w.kind === 'disc') {
        const rr = vlen(d) / w.r; if (rr > 1.6) continue;
        const k = w.k * (rr < 1 ? 1 - 0.3 * rr * rr : Math.max(0, 1 - (rr - 1) / 0.6) * 0.25);
        return cmul(w.col, k);
      }
      const s = vdot(d, w.ax) / w.ax2, q = vdot(d, w.ay) / w.ay2;
      if (s < -1 || s > 1 || q < -1 || q > 1) continue;
      const us = (s + 1) * 0.5 * w.nx, uq = (q + 1) * 0.5 * w.ny;
      const fs = Math.min(fract(us), 1 - fract(us)), fq = Math.min(fract(uq), 1 - fract(uq));
      const m = w.mull; const inP = sstep(m * 0.4, m, fs) * sstep(m * 0.4, m, fq);
      const k = w.k * (0.72 + 0.28 * q) * inP + w.k * 0.035 * (1 - inP);
      return cmul(w.col, k);
    }
    const e = R[1];
    return e > 0 ? cmix(env.horizon, env.ceil, Math.min(1, e * 1.6)) : cmix(env.horizon, env.floor, Math.min(1, -e * 2.2));
  }
  // keep the part of a 3-D polygon on the side n·p >= d
  function clipPlane(pts, n, d) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]; const da = vdot(a, n) - d, db = vdot(b, n) - d;
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push(vlerp(a, b, t)); }
    }
    return out.length >= 3 ? out : null;
  }
  // planar mirror reflection of every light into a polygon (clip) — sharp window reflections on lacquer / keytops
  // composite a full-screen buffer through a cheap half-resolution blur
  function softBlit(ctx, b, alpha, op, blurPx) {
    const h = PV.buffer('instr:softHalf', W / 2, H / 2); h.ctx.clearRect(0, 0, W / 2, H / 2);
    h.ctx.filter = `blur(${Math.max(0.3, blurPx / 2).toFixed(2)}px)`; h.ctx.drawImage(b.canvas, 0, 0, W / 2, H / 2); h.ctx.filter = 'none';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op || 'source-over'; ctx.drawImage(h.canvas, 0, 0, W, H); ctx.restore();
  }
  // draw fn(c) at half resolution (same transform), blur it and composite at full size: cheap soft light/shadow layers
  function halfSoft(ctx, fn, blurPx, alpha, op) {
    const T0 = ctx.getTransform();
    const a = PV.buffer('instr:hsA', W / 2, H / 2); a.ctx.clearRect(0, 0, W / 2, H / 2); a.ctx.setTransform(T0.a * 0.5, T0.b * 0.5, T0.c * 0.5, T0.d * 0.5, T0.e * 0.5, T0.f * 0.5); fn(a.ctx); a.ctx.setTransform(1, 0, 0, 1, 0, 0);
    let src = a.canvas;
    if (blurPx > 0) { const b = PV.buffer('instr:hsB', W / 2, H / 2); b.ctx.clearRect(0, 0, W / 2, H / 2); b.ctx.filter = `blur(${(blurPx / 2).toFixed(2)}px)`; b.ctx.drawImage(a.canvas, 0, 0); b.ctx.filter = 'none'; src = b.canvas; }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op || 'source-over'; ctx.drawImage(src, 0, 0, W, H); ctx.restore();
  }
  // same as halfSoft at quarter resolution (very soft shadows / glows: 4x fewer pixels to blur), optional screen bbox
  function quarterSoft(ctx, fn, blurPx, alpha, op, bbox) {
    const T0 = ctx.getTransform(); const qw = W / 4, qh = H / 4;
    const a = PV.buffer('instr:qsA', qw, qh); a.ctx.clearRect(0, 0, qw, qh); a.ctx.setTransform(T0.a * 0.25, T0.b * 0.25, T0.c * 0.25, T0.d * 0.25, T0.e * 0.25, T0.f * 0.25); fn(a.ctx); a.ctx.setTransform(1, 0, 0, 1, 0, 0);
    let src = a.canvas;
    if (blurPx > 0) { const b = PV.buffer('instr:qsB', qw, qh); b.ctx.clearRect(0, 0, qw, qh); b.ctx.filter = `blur(${(blurPx / 4).toFixed(2)}px)`; b.ctx.drawImage(a.canvas, 0, 0); b.ctx.filter = 'none'; src = b.canvas; }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op || 'source-over';
    if (typeof bbox === 'function') bbox = bbox();
    if (bbox) { const x0 = Math.max(0, Math.floor(bbox[0] / 4)), y0 = Math.max(0, Math.floor(bbox[1] / 4)), x1 = Math.min(qw, Math.ceil(bbox[2] / 4)), y1 = Math.min(qh, Math.ceil(bbox[3] / 4)); if (x1 > x0 && y1 > y0) ctx.drawImage(src, x0, y0, x1 - x0, y1 - y0, x0 * 4, y0 * 4, (x1 - x0) * 4, (y1 - y0) * 4); }
    else ctx.drawImage(src, 0, 0, W, H);
    ctx.restore();
  }
  // luminous white-out (over-exposure): the brights bloom and bleed first, then the whole frame lifts to paper white.
  // (a flat 'screen' of white only turned the frame into grey fog)
  function whiteoutFx(ctx, w, col) {
    w = clamp(w); if (w <= 0) return;
    const qw = W / 6, qh = H / 6;
    const b = PV.buffer('instr:woSmall', qw, qh); b.ctx.clearRect(0, 0, qw, qh); b.ctx.filter = 'blur(3.4px)'; b.ctx.drawImage(ctx.canvas, 0, 0, qw, qh); b.ctx.filter = 'none';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(w * 1.6) * 0.85; ctx.drawImage(b.canvas, 0, 0, W, H);
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = Math.pow(w, 1.5); ctx.fillStyle = col || '#f8f8f6'; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  function mirrorLights(ctx, cam, env, n, d, clipPts, alpha, fres, soft) {
    if (!clipPts) return;
    if (soft) {
      ctx.save(); ctx.beginPath(); trace(ctx, clipPts); ctx.clip();
      halfSoft(ctx, c => mirrorLights(c, cam, env, n, d, clipPts, 1, fres, 0), soft, alpha);
      ctx.restore();
      return;
    }
    ctx.save(); ctx.beginPath(); trace(ctx, clipPts); ctx.clip();
    for (const w of env.lights) {
      if (w.noMirror) continue;
      if (w.kind === 'disc') {
        if (vdot(w.c, n) - d < 0) continue;
        const mc = mirrorP(w.c, n, d); const pc = cam.p(mc); if (pc[2] <= cam.near) continue;
        const rr = w.r * cam.scaleAt(mc);
        const g = ctx.createRadialGradient(pc[0], pc[1], 0, pc[0], pc[1], rr * 1.6);
        g.addColorStop(0, cs(cmul(w.col, Math.min(1.2, w.k * fres / 3)), alpha)); g.addColorStop(0.6, cs(w.col, alpha * 0.5)); g.addColorStop(1, cs(w.col, 0));
        ctx.fillStyle = g; ctx.fillRect(pc[0] - rr * 1.6, pc[1] - rr * 1.6, rr * 3.2, rr * 3.2);
        continue;
      }
      const m = w.mull;
      for (let i = 0; i < w.nx; i++) for (let j = 0; j < w.ny; j++) {
        const s0 = -1 + 2 * (i + m) / w.nx, s1 = -1 + 2 * (i + 1 - m) / w.nx, q0 = -1 + 2 * (j + m) / w.ny, q1 = -1 + 2 * (j + 1 - m) / w.ny;
        const corner = (s, q) => vadd(w.c, vadd(vmul(w.ax, s), vmul(w.ay, q)));
        const quad = clipPlane([corner(s0, q0), corner(s1, q0), corner(s1, q1), corner(s0, q1)], n, d + 1e-4);
        if (!quad) continue;
        const pts = cam.poly(quad.map(p => mirrorP(p, n, d)));
        if (!pts) continue;
        const k = w.k * fres * (0.75 + 0.25 * (q0 + q1) * 0.5);
        const top = cam.p(mirrorP(corner((s0 + s1) / 2, q1), n, d)), bot = cam.p(mirrorP(corner((s0 + s1) / 2, q0), n, d));
        let g;
        if (Math.hypot(top[0] - bot[0], top[1] - bot[1]) > 0.5) {
          g = ctx.createLinearGradient(top[0], top[1], bot[0], bot[1]);
          g.addColorStop(0, cs(cmul(w.col, k * 1.05), alpha)); g.addColorStop(1, cs(cmul(w.col, k * 0.7), alpha * 0.85));
        } else g = cs(cmul(w.col, k), alpha);
        fillP(ctx, pts, g);
      }
    }
    ctx.restore();
  }

  /* ======================================================================
   * GRAND PIANO — 3-D model in metres, painter-ordered faces, lacquer env reflections
   * ====================================================================== */
  const PN = { yb: 0.625, yt: 0.985, th: 0.024, yk: 0.725, xf: 0.30, rimT: 0.045, keyLen: 0.15 };
  const pianoGeoCache = {};
  function pianoGeo(Lp, Wd) {
    const key = Lp.toFixed(3) + '|' + Wd.toFixed(3); if (pianoGeoCache[key]) return pianoGeoCache[key];
    const S = (u, v) => [u * Lp, v * Wd];
    const P = [S(0, 0)];
    for (let i = 0; i <= 6; i++) P.push(S(0.30 * i / 6, 1));
    bez(P, S(0.30, 1), S(0.46, 1), S(0.53, 0.63), S(0.71, 0.475), 44, true);
    bez(P, S(0.71, 0.475), S(0.83, 0.37), S(0.935, 0.355), S(0.985, 0.25), 26, true);
    bez(P, S(0.985, 0.25), S(1.008, 0.2), S(1.0, 0.0), S(0.95, 0.0), 18, true);
    for (let i = 1; i <= 9; i++) P.push(S(0.95 * (1 - i / 10), 0));
    const n = P.length;
    let area = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const sg = area > 0 ? 1 : -1;
    const segN = [];
    for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; const dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; segN.push([sg * dz / l, 0, -sg * dx / l]); }
    const vN = P.map((_, i) => { const a = segN[(i - 1 + n) % n], b = segN[i]; return vnorm([a[0] + b[0], 0, a[2] + b[2]]); });
    const inner = P.map((p, i) => [p[0] - vN[i][0] * PN.rimT, p[1] - vN[i][2] * PN.rimT]);
    // main lid outline (x >= xf)
    const lidPts = [];
    for (let i = 1; i < n; i++) if (P[i][0] >= PN.xf - 1e-6) lidPts.push(P[i]);
    lidPts.unshift([PN.xf, Wd]); lidPts.push([PN.xf, 0]);
    // z extent helper of outline at x (treble boundary)
    const zAt = x => { let best = Wd; for (let i = 1; i < n - 10; i++) { const a = P[i], b = P[i + 1]; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) { const t = (x - a[0]) / (b[0] - a[0]); best = a[1] + (b[1] - a[1]) * t; } } return best; };
    const g = { Lp, Wd, P, segN, vN, inner, lidPts, zAt, cheekW: (Wd - 1.222) / 2 };
    pianoGeoCache[key] = g; return g;
  }
  // 88-key layout in white-key units from the left edge of A0
  const KEYS = (function () {
    const out = []; let wi = 0;
    for (let k = 0; k < 88; k++) {
      const n = 21 + k, pc = n % 12, black = [1, 3, 6, 8, 10].indexOf(pc) >= 0;
      const oct = Math.floor((n - 12) / 12), cIdx = -5 + 7 * oct;
      if (black) { const c = cIdx + (pc + 0.5) * 7 / 12; out.push({ k, n, pc, black: true, x0: c - 0.2915, x1: c + 0.2915, c }); }
      else { out.push({ k, n, pc, black: false, x0: wi, x1: wi + 1, c: wi + 0.5, wi }); wi++; }
    }
    return out;
  })();
  L.keyIndex = function (name) {
    const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(name).trim()); if (!m) return -1;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return (parseInt(m[3], 10) + 1) * 12 + base - 21;
  };

  function pianoEnv(o, tgt, fwdH, right) {
    const col = hx(o.lightColor || '#fff2da'), k = o.lightK === undefined ? 6 : o.lightK;
    const env = { lights: [], ceil: hx(o.envCeil || '#3b3836'), floor: hx(o.envFloor || '#241a12'), horizon: hx(o.envHorizon || '#2a2826') };
    if (o.env === 'stage') {
      env.ceil = [16, 16, 20]; env.floor = [22, 16, 11]; env.horizon = [12, 12, 16];
      for (let i = -1; i <= 1; i++) env.lights.push(makeDisc(vadd(tgt, vadd(vmul(fwdH, -7), vadd(vmul(right, i * 3.2), [0, 6.5, 0]))), 0.4, vadd(vmul(fwdH, 1), [0, -0.9, 0]), col, k * 1.6));
      env.lights.push(makeDisc(vadd(tgt, [0, 7, 0]), 0.7, [0, -1, 0], col, k * 1.2));
      env.lights.push(makeWin(vadd(tgt, vadd(vmul(fwdH, -9), [0, 1.2, 0])), vmul(right, 9), [0, 1.0, 0], fwdH, 1, 1, 0.0, [70, 60, 56], 0.6));
      return env;
    }
    const side = o.light === 'right' ? 1 : o.light === 'back' ? 0 : -1;
    // window wall behind the piano (mirrored in horizontal lacquer & keytops)
    const back = vadd(vadd(tgt, vmul(fwdH, 3.8)), [0, 1.95 - tgt[1], 0]);
    for (let i = -3; i <= 3; i++) env.lights.push(makeWin(vadd(back, vmul(right, i * 2.3 + side * 0.7)), vmul(right, 0.62), [0, 0.9, 0], vmul(fwdH, -1), 2, 3, 0.055, col, k));
    // window wall on the light side (crisp stripes on the curved rim)
    if (side) {
      const sw = vadd(vadd(tgt, vmul(right, side * 3.2)), [0, 1.95 - tgt[1], 0]);
      for (let i = -4; i <= 2; i++) env.lights.push(makeWin(vadd(sw, vmul(fwdH, i * 2.3 + 0.5)), vmul(fwdH, 0.62), [0, 0.9, 0], vmul(right, -side), 2, 3, 0.055, col, k * 0.95));
    }
    // broad dim glow of the sunlit room behind the camera (soft gradient on the near rim)
    const rb = vadd(vadd(tgt, vmul(fwdH, -6.5)), [0, 1.6 - tgt[1], 0]);
    env.lights.push(makeWin(rb, vmul(right, 7), [0, 1.3, 0], fwdH, 1, 1, 0.0, cmix(col, [190, 170, 150], 0.5), o.roomK === undefined ? 0.9 : o.roomK));
    return env;
  }

  /* -------- lacquer shading of a planar face */
  function lacquer(st, P, n, gloss = 1, noLights) {
    if (st.sil) return st.silCol;
    const vd = vnorm(vsub(P, st.eye)); const R = reflect(vd, n);
    const ci = Math.abs(vdot(vd, n)); const fr = 0.05 + 0.95 * Math.pow(1 - ci, 5);
    const e = envLook(st.env, P, R, noLights);
    const dif = Math.max(0, vdot(n, st.ldir)) * 0.06;
    return cadd(cadd(st.base, st.lcol, dif), e, fr * gloss);
  }
  // generic convex hexahedron (8 corners: 0-3 bottom ring, 4-7 top ring, same order). shade(n, P, faceIdx) -> colour/style
  const HEX_FACES = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  function drawHex(ctx, cam, C, shade, stroke) {
    const ctr = C.reduce((a, p) => vadd(a, p), [0, 0, 0]).map(v => v / 8);
    for (let fi = 0; fi < 6; fi++) {
      const f = HEX_FACES[fi]; const pts = f.map(i => C[i]);
      const fc = pts.reduce((a, p) => vadd(a, p), [0, 0, 0]).map(v => v / 4);
      let nrm = vnorm(vcross(vsub(pts[1], pts[0]), vsub(pts[3], pts[0])));
      if (vdot(nrm, vsub(fc, ctr)) < 0) nrm = vmul(nrm, -1);
      if (!cam.facing(fc, nrm)) continue;
      const pp = cam.poly(pts); if (!pp) continue;
      const sty = shade(nrm, fc, fi, pp);
      if (sty) { fillP(ctx, pp, sty); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.6; ctx.stroke(); } }
    }
  }
  const box = (x0, y0, z0, x1, y1, z1) => [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  // frustum from bottom square (cx,cz,hb at y0) to top square (ht at y1)
  const frustum = (cx, cz, y0, hb, y1, ht) => [[cx - hb, y0, cz - hb], [cx + hb, y0, cz - hb], [cx + hb, y0, cz + hb], [cx - hb, y0, cz + hb], [cx - ht, y1, cz - ht], [cx + ht, y1, cz - ht], [cx + ht, y1, cz + ht], [cx - ht, y1, cz + ht]];

  const PIANO_RES = {};
  function pianoKey(o) {
    const rc = o.roomCam ? o.roomCam.eye.concat(o.roomCam.f, o.roomCam.u, [o.roomCam.focal, o.roomCam.cx, o.roomCam.cy]).map(v => +v.toFixed(4)) : null;
    const env = o.roomEnv ? o.roomEnv.lights.map(l => +(l.k || 0).toFixed(2) + ':' + l.c.map(v => +v.toFixed(2)).join(',')).join(';') : null;
    return JSON.stringify(o, (k, v) => k === 'roomCam' ? rc : k === 'roomEnv' ? env : k === 'envObj' ? (v ? 'custom' : v) : (typeof v === 'number' ? +v.toFixed(4) : v));
  }
  L.grandPiano = function (ctx, o = {}) {
    if (o.cache) {
      // opt-in: the finished piano image is cached (identity space) and re-drawn under the current transform
      const key = pianoKey(o); let res = null;
      const cv = cachedLayer('piano', key, W, H, c => { res = L.grandPiano(c, Object.assign({}, o, { cache: false })); PIANO_RES[key] = res; }, 4);
      ctx.drawImage(cv, 0, 0);
      return res || PIANO_RES[key];
    }
    if (o.style === 'silhouette') {
      let res;
      const buf = silBuffer(ctx, 'pianoSil', c => { res = pianoDraw(c, o, true); });
      blit(ctx, { canvas: buf }, o.alpha === undefined ? 1 : o.alpha);
      if (o.rim !== false) {
        const rd = o.rimDir === undefined ? -2.3 : o.rimDir, rw = o.rimWidth || Math.max(2, (o.scale || 330) * 0.007);
        rimLight(ctx, buf, { bbox: res && res.bbox, dx: Math.cos(rd) * rw, dy: Math.sin(rd) * rw, color: o.rimColor || '#ffe9c4', alpha: o.rimAlpha === undefined ? 0.9 : o.rimAlpha, soft: rw * 3 });
      }
      // a few faint inner contour lines (rim top, lid edge, key line) so the flat shape still reads as a grand piano
      if (res && o.innerLines !== false) {
        const cam = res.cam, Lp = o.length || 2.0, Wd = o.width || (Lp > 2.4 ? 1.57 : 1.49), G = pianoGeo(Lp, Wd), yt = PN.yt;
        const ang = clamp(o.lidOpen === undefined ? 0.8 : o.lidOpen) * 0.6, ca = Math.cos(ang), sa = Math.sin(ang);
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = cs(hx(o.rimColor || '#ffe9c4'), o.innerAlpha === undefined ? 0.32 : o.innerAlpha); ctx.lineWidth = Math.max(1, (o.scale || 330) * 0.0035);
        ctx.beginPath();
        for (let i = 1; i < G.P.length; i++) { const a = G.P[i], b = G.P[(i + 1) % G.P.length]; const mid = [(a[0] + b[0]) / 2, yt, (a[1] + b[1]) / 2]; if (!cam.facing(mid, G.segN[i])) continue; const pa = cam.p([a[0], yt, a[1]]), pb = cam.p([b[0], yt, b[1]]); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); }
        if (ang > 0.01) { let first = true; for (const q of G.lidPts) { if (q[1] < Wd * 0.25) continue; const p = cam.p([q[0], yt + q[1] * sa, q[1] * ca]); if (first) { ctx.moveTo(p[0], p[1]); first = false; } else ctx.lineTo(p[0], p[1]); } }
        const k0 = cam.p([-PN.keyLen, PN.yk, G.cheekW]), k1 = cam.p([-PN.keyLen, PN.yk, Wd - G.cheekW]); ctx.moveTo(k0[0], k0[1]); ctx.lineTo(k1[0], k1[1]);
        ctx.stroke(); ctx.restore();
      }
      return res;
    }
    if (o.rimLit) {
      // lit piano + a back-light rim on the edges facing the light (window behind)
      const R = typeof o.rimLit === 'object' ? o.rimLit : {};
      const b = scratch(ctx, 'pianoLit'); const res = pianoDraw(b.ctx, o, false);
      blit(ctx, b, 1);
      const rd = R.dir === undefined ? -1.75 : R.dir, rw = R.width || Math.max(1.5, res.scale * 0.006);
      rimLight(ctx, b.canvas, { bbox: res.bbox, dx: Math.cos(rd) * rw, dy: Math.sin(rd) * rw, color: R.color || o.lightColor || '#fff1d6', alpha: R.alpha === undefined ? 0.85 : R.alpha, soft: rw * 4, softAlpha: 0.3 });
      return res;
    }
    return pianoDraw(ctx, o, false);
  };
  function pianoDraw(ctx, o, silMode) {
    const views = { side: [0.0, 0.15], threeQuarter: [-0.72, 0.2], front: [-Math.PI / 2, 0.055] };
    const vv = views[o.view] || views.side;
    const yaw = o.yaw !== undefined ? o.yaw : vv[0], pitch = o.pitch !== undefined ? o.pitch : vv[1];
    const Lp = o.length || 2.0, Wd = o.width || (Lp > 2.4 ? 1.57 : 1.49);
    const scale = o.scale || 330, dist = o.dist || (o.view === 'front' ? 4.2 : 8);
    const G = pianoGeo(Lp, Wd); const { P, segN, inner, cheekW } = G; const n = P.length;
    const anchor = [Lp * 0.42, 0, Wd * 0.5];
    const tgt = [Lp * 0.42, 0.62, Wd * 0.5];
    let cam, eye, fw, scale2 = scale;
    const ry = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
    let toLocalDir = v => v, toLocal = p => p;
    if (o.roomCam) {
      // place the piano inside an external scene camera: room point = at + Ry(rotY)(p - anchor)
      const RC = o.roomCam, th0 = o.rotY || 0, at = o.at || [0, 0];
      toLocal = p => vadd(ry(vsub(p, [at[0], 0, at[1]]), -th0), anchor); toLocalDir = v => ry(v, -th0);
      eye = toLocal(RC.eye); fw = toLocalDir(RC.f);
      cam = makeCam(eye, vadd(eye, fw), RC.focal, RC.cx, RC.cy, 0, 0.05, false, toLocalDir(RC.u));
      scale2 = cam.scaleAt(tgt);
    } else {
      fw = [-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
      eye = vsub(tgt, vmul(fw, dist));
      cam = makeCam(eye, tgt, scale * dist, 0, 0, o.roll || 0, 0.05);
      const a0 = cam.p(anchor);
      cam.cx = (o.x === undefined ? W * 0.5 : o.x) - a0[0]; cam.cy = (o.y === undefined ? H * 0.82 : o.y) - a0[1];
    }
    const fwdH = vnorm([fw[0], 0, fw[2]]), right = cam.r;
    const sil = silMode;
    const ldir = vnorm(o.lightDirRoom ? toLocalDir(o.lightDirRoom) : (o.lightDir || vadd(vadd(vmul(fwdH, 0.6), vmul(right, -0.7)), [0, 0.9, 0])));
    let env = o.envObj;
    if (!env && o.roomEnv) {
      const E = o.roomEnv;
      env = { ceil: E.ceil, floor: E.floor, horizon: E.horizon, lights: E.lights.map(w => { const m = w.kind === 'disc' ? makeDisc(toLocal(w.c), w.r, toLocalDir(w.n), w.col, w.k) : makeWin(toLocal(w.c), toLocalDir(w.ax), toLocalDir(w.ay), toLocalDir(w.n), w.nx, w.ny, w.mull, w.col, w.k); m.noMirror = w.noMirror; m.floorPatch = w.floorPatch; return m; }) };
    }
    const st = { sil, silCol: hx(o.color || '#0b0f1a'), base: hx(o.lacquer || '#0b0c11'), eye, ldir, lcol: hx(o.lightColor || '#fff2da'), env: env || pianoEnv(o, tgt, fwdH, right) };
    const yb = PN.yb, yt = PN.yt, th = PN.th, yk = PN.yk;
    const lidA = clamp(o.lidOpen === undefined ? 0.8 : o.lidOpen) * 0.6;
    const open = lidA > 0.01;
    const zc = Wd / 2;
    const out = { cam };

    ctx.save();
    ctx.lineJoin = 'round';
    /* ---------- floor shadow */
    if (!sil && o.shadow !== 0) {
      const sh = o.shadow === undefined ? 0.55 : o.shadow;
      const off = vmul(vnorm([-ldir[0], 0, -ldir[2]]), 0.25);
      const pts = cam.poly(P.map(p => [p[0] + off[0], 0, p[1] + off[2]]));
      if (pts) halfSoft(ctx, c => fillP(c, pts, 'rgb(8,6,10)'), Math.max(2, scale2 * 0.06), sh * 0.55, 'source-over');
    }
    /* ---------- legs, casters, lyre */
    const legPos = [[-0.085, cheekW * 0.5], [-0.085, Wd - cheekW * 0.5], [Lp * 0.835, Wd * 0.29]];
    const parts = [];
    for (const [lx, lz] of legPos) {
      parts.push({ d: cam.depth([lx, 0.3, lz]), draw: () => {
        if (!sil && o.shadow !== 0) { const c = cam.p([lx, 0, lz]); const rr = 0.09 * cam.scaleAt([lx, 0, lz]); const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], rr); g.addColorStop(0, 'rgba(5,4,8,0.55)'); g.addColorStop(1, 'rgba(5,4,8,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c[0], c[1], rr, rr * 0.4, 0, 0, TAU); ctx.fill(); }
        drawHex(ctx, cam, frustum(lx, lz, 0.075, 0.037, yb, 0.056), (nr, fc) => cs(lacquer(st, fc, nr, 0.8)));
        drawHex(ctx, cam, frustum(lx, lz, 0.0, 0.03, 0.075, 0.034), (nr, fc) => sil ? cs(st.silCol) : cs(cadd([92, 70, 30], [255, 220, 150], Math.max(0, vdot(nr, ldir)) * 0.5)));
      } });
    }
    parts.push({ d: cam.depth([0.2, 0.3, zc]), draw: () => {
      for (const s of [-1, 1]) drawHex(ctx, cam, box(0.19, 0.17, zc + s * 0.075 - 0.013, 0.215, yb, zc + s * 0.075 + 0.013), (nr, fc) => cs(lacquer(st, fc, nr, 0.7)));
      drawHex(ctx, cam, box(0.15, 0.07, zc - 0.17, 0.25, 0.17, zc + 0.17), (nr, fc) => cs(lacquer(st, fc, nr, nr[1] > 0.5 ? 0.3 : 0.8)));
      for (const pz of [-0.085, 0, 0.085]) drawHex(ctx, cam, box(0.02, 0.085, zc + pz - 0.02, 0.155, 0.105, zc + pz + 0.02), (nr, fc) => sil ? cs(st.silCol) : cs(cadd([120, 92, 40], [255, 225, 160], 0.25 + Math.max(0, vdot(nr, ldir)) * 0.55)));
    } });
    parts.sort((a, b) => b.d - a.d); parts.forEach(p => p.draw());

    /* ---------- case walls */
    const yTop = open ? yt : yt + th;
    const near = [], far = [];
    for (let i = 0; i < n; i++) {
      if (i === 0) continue; // front edge handled by keyboard group
      const a = P[i], b = P[(i + 1) % n]; const nr = segN[i];
      const mid = [(a[0] + b[0]) / 2, (yb + yTop) / 2, (a[1] + b[1]) / 2];
      (cam.facing(mid, nr) ? near : far).push(i);
    }
    // far inner walls + interior (only visible with the lid open)
    if (open && eye[1] > yt) {
      const ySb = yt - 0.13;
      for (const i of far) {
        const a = inner[i], b = inner[(i + 1) % n]; const nr = vmul(segN[i], -1);
        const pts = cam.poly([[a[0], ySb, a[1]], [b[0], ySb, b[1]], [b[0], yt, b[1]], [a[0], yt, a[1]]]);
        if (!pts) continue;
        let c = sil ? st.silCol : cadd(lacquer(st, [(a[0] + b[0]) / 2, yt - 0.06, (a[1] + b[1]) / 2], nr, 0.6), [40, 28, 16], 0.25);
        fillP(ctx, pts, cs(c)); if (!sil) { ctx.strokeStyle = cs(c); ctx.lineWidth = 1; ctx.stroke(); }
      }
      if (!sil) drawPianoInterior(ctx, cam, G, st, ySb);
      else { const top = cam.poly(P.map(p => [p[0], yt, p[1]])); if (top) fillP(ctx, top, cs(st.silCol)); } // silhouettes must not be see-through
    }
    // near outer walls
    near.sort((x, y) => cam.depth([(P[y][0] + P[(y + 1) % n][0]) / 2, yt, (P[y][1] + P[(y + 1) % n][1]) / 2]) - cam.depth([(P[x][0] + P[(x + 1) % n][0]) / 2, yt, (P[x][1] + P[(x + 1) % n][1]) / 2]));
    for (const i of near) {
      const a = P[i], b = P[(i + 1) % n]; const nr = segN[i];
      const q = cam.poly([[a[0], yb, a[1]], [b[0], yb, b[1]], [b[0], yTop, b[1]], [a[0], yTop, a[1]]]);
      if (!q) continue;
      // widen 0.6px to hide AA seams
      const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
      const qq = q.map(p => [p[0] + Math.sign(p[0] - cx) * 0.6, p[1]]);
      if (sil) { fillP(ctx, qq, cs(st.silCol)); continue; }
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      // stylised lacquer sheen: where the rim turns away from the eye the polished side brightens (Fresnel),
      // so the bentside reads as a curved black mirror instead of a flat box
      const vdn = Math.abs(vdot(vnorm(vsub([mx, (yb + yTop) / 2, mz], st.eye)), nr)); const sheen = Math.pow(1 - vdn, 2.2) * 0.55 * (o.sheen === undefined ? 1 : o.sheen);
      const shc = cmix(st.env.horizon, st.lcol, 0.35);
      const cTop = cadd(lacquer(st, [mx, yTop - 0.02, mz], nr), shc, sheen * 0.8), cMid = cadd(lacquer(st, [mx, (yb + yTop) / 2, mz], nr), shc, sheen), cBot = cadd(lacquer(st, [mx, yb + 0.02, mz], nr), shc, sheen * 0.6);
      const pT = cam.p([mx, yTop, mz]), pB = cam.p([mx, yb, mz]);
      const g = ctx.createLinearGradient(pT[0], pT[1], pB[0], pB[1]);
      g.addColorStop(0, cs(cadd(cTop, [30, 28, 26]))); g.addColorStop(0.08, cs(cTop)); g.addColorStop(0.5, cs(cMid)); g.addColorStop(0.92, cs(cmul(cBot, 0.8))); g.addColorStop(1, cs(cadd(cmul(cBot, 0.8), [40, 26, 14])));
      fillP(ctx, qq, g);
    }
    // top edge highlight & bottom moulding line along near walls
    if (!sil) {
      ctx.lineCap = 'round';
      for (const i of near) {
        const a = P[i], b = P[(i + 1) % n]; const nr = segN[i];
        const up = vnorm([nr[0], 1.1, nr[2]]); const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        const c = lacquer(st, [mx, yTop, mz], up, 1.2);
        const pa = cam.p([a[0], yTop, a[1]]), pb = cam.p([b[0], yTop, b[1]]);
        ctx.strokeStyle = cs(cadd(c, [20, 20, 20])); ctx.lineWidth = Math.max(1, scale2 * 0.006); ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
        const qa = cam.p([a[0], yb + 0.03, a[1]]), qb = cam.p([b[0], yb + 0.03, b[1]]);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(0.8, scale2 * 0.003); ctx.beginPath(); ctx.moveTo(qa[0], qa[1]); ctx.lineTo(qb[0], qb[1]); ctx.stroke();
      }
    }
    /* ---------- rim cap (lid open) */
    if (open && eye[1] > yt) {
      const ring = []; for (let i = 1; i < n; i++) ring.push([P[i][0], yt, P[i][1]]); ring.push([P[0][0], yt, P[0][1]]);
      const rin = []; for (let i = n - 1; i >= 1; i--) rin.push([inner[i][0], yt, inner[i][1]]); rin.push([inner[0][0], yt, inner[0][1]]);
      const ro = cam.poly(ring), ri = cam.poly(rin);
      if (ro && ri) {
        ctx.beginPath(); trace(ctx, ro); trace(ctx, ri); ctx.fillStyle = sil ? cs(st.silCol) : cs(lacquer(st, [Lp * 0.5, yt, zc], [0, 1, 0], 0.9)); ctx.fill('evenodd');
      }
    }
    /* ---------- lid */
    drawPianoLid(ctx, cam, G, st, lidA, o);
    /* ---------- keyboard group: cheeks, name board, keys, desk */
    drawPianoFront(ctx, cam, G, st, o, out);
    /* ---------- bench */
    if (o.bench) {
      const bx = -0.62, bz0 = zc - 0.38, bz1 = zc + 0.38;
      const legs = [[bx - 0.15, bz0 + 0.04], [bx + 0.15, bz0 + 0.04], [bx - 0.15, bz1 - 0.04], [bx + 0.15, bz1 - 0.04]].sort((p, q) => cam.depth([q[0], 0.2, q[1]]) - cam.depth([p[0], 0.2, p[1]]));
      if (!sil && o.shadow !== 0) { const c = cam.p([bx, 0, zc]); const rr = 0.42 * cam.scaleAt([bx, 0, zc]); const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], rr); g.addColorStop(0, 'rgba(6,5,8,0.4)'); g.addColorStop(1, 'rgba(6,5,8,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c[0], c[1], rr, rr * 0.35, 0, 0, TAU); ctx.fill(); }
      for (const [lx, lz] of legs) drawHex(ctx, cam, box(lx - 0.02, 0, lz - 0.02, lx + 0.02, 0.44, lz + 0.02), (nr, fc) => cs(lacquer(st, fc, nr, 0.8)));
      drawHex(ctx, cam, box(bx - 0.19, 0.405, bz0, bx + 0.19, 0.44, bz1), (nr, fc) => cs(lacquer(st, fc, nr, 0.9)));
      drawHex(ctx, cam, box(bx - 0.18, 0.44, bz0 + 0.01, bx + 0.18, 0.5, bz1 - 0.01), (nr, fc) => sil ? cs(st.silCol) : cs(cadd([16, 15, 17], lacquer(st, fc, nr, 0.35), 0.8)));
      out.bench = cam.p([bx, 0.5, zc]);
    }
    ctx.restore();
    out.keyboard = cam.p([-0.07, yk, zc]); out.desk = cam.p([0.17, yt + 0.2, zc]); out.lidTop = cam.p([Lp * 0.55, yt + Math.sin(lidA) * Wd * 0.8, Wd * 0.8 * Math.cos(lidA)]);
    out.floor = cam.p(anchor); out.scale = scale2;
    { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = p => { if (p[2] > cam.near) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } };
      const ca = Math.cos(lidA), sa = Math.sin(lidA);
      for (const q of P) { add(cam.p([q[0], 0, q[1]])); add(cam.p([q[0], yt + 0.03, q[1]])); add(cam.p([q[0], yt + q[1] * sa + 0.03, q[1] * ca])); }
      add(cam.p([-0.2, yt + 0.4, 0])); add(cam.p([-0.2, yt + 0.4, Wd])); add(cam.p([-0.85, 0, zc - 0.4])); add(cam.p([-0.85, 0, zc + 0.4]));
      out.bbox = [x0, y0, x1, y1]; }
    return out;
  }

  function drawPianoInterior(ctx, cam, G, st, ySb) {
    const { inner, Lp, Wd } = G; const n = inner.length; const yt = PN.yt;
    // soundboard
    const sb = inner.map(p => [Math.max(p[0], 0.06), ySb, p[1]]);
    const sbp = cam.poly(sb); if (!sbp) return;
    const c0 = cam.p([Lp * 0.2, ySb, Wd * 0.5]), c1 = cam.p([Lp * 0.9, ySb, Wd * 0.3]);
    let g = ctx.createLinearGradient(c0[0], c0[1], c1[0], c1[1]);
    g.addColorStop(0, cs([92, 64, 34])); g.addColorStop(1, cs([60, 40, 22])); fillP(ctx, sbp, g);
    // plate (gold harp) with openings
    const yP = yt - 0.075;
    const plate = inner.map(p => [Math.max(p[0], 0.055), yP, p[1]]).map((p, i) => { const q = inner[i]; const cx = Lp * 0.5, cz = Wd * 0.45; return [p[0] + (cx - p[0]) * 0.035, yP, p[2] + (cz - p[2]) * 0.06]; });
    const pp = cam.poly(plate);
    if (pp) {
      const a = cam.p([0.1, yP, Wd * 0.2]), b = cam.p([Lp * 0.8, yP, Wd * 0.6]);
      g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
      const lc = cfilt(st.lcol, [255, 255, 255]);
      g.addColorStop(0, cs(cfilt([214, 172, 86], cmix([170, 160, 150], lc, 0.6)))); g.addColorStop(0.45, cs([150, 112, 48])); g.addColorStop(1, cs([96, 70, 30]));
      fillP(ctx, pp, g);
      // openings
      ctx.save(); ctx.beginPath(); trace(ctx, pp); ctx.clip();
      const holes = [[0.42, 0.62, 0.2, 0.17], [0.62, 0.42, 0.14, 0.13], [0.36, 0.3, 0.12, 0.1], [0.78, 0.26, 0.09, 0.07]];
      for (const [hu, hv, hr, hr2] of holes) {
        const hc = [hu * Lp, yP, hv * Wd]; const pts = [];
        for (let k = 0; k < 24; k++) { const a2 = k / 24 * TAU; pts.push([hc[0] + Math.cos(a2) * hr * Lp * 0.5, yP, hc[2] + Math.sin(a2) * hr2 * Wd * 0.5]); }
        const hp = cam.poly(pts); if (hp) { fillP(ctx, hp, cs([70, 48, 26])); ctx.strokeStyle = cs([230, 196, 120], 0.5); ctx.lineWidth = 1; ctx.stroke(); }
      }
      ctx.restore();
    }
    // strings (fan from pin block to bentside / tail)
    const yS = yt - 0.055;
    const ns = 46;
    for (let i = 0; i < ns; i++) {
      const s = i / (ns - 1); // 0 bass .. 1 treble
      const z0 = lerp(0.2, Wd - 0.16, s);
      const xEnd = lerp(Lp * 0.93, PN.xf + 0.15, Math.pow(s, 0.85));
      let zEnd = Math.min(G.zAt(xEnd) - 0.07, lerp(Wd * 0.2, Wd - 0.2, s));
      const bass = s < 0.3;
      const a = cam.p([0.11, yS, z0]), b = cam.p([xEnd, yS, bass ? zEnd + 0.15 * (0.3 - s) : zEnd]);
      ctx.strokeStyle = bass ? 'rgba(196,132,74,0.7)' : 'rgba(225,222,214,0.55)'; ctx.lineWidth = bass ? 1.2 : 0.7;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // dampers
    for (let i = 0; i < 30; i++) {
      const z = lerp(0.22, Wd - 0.42, i / 29);
      const pts = cam.poly([[0.2, yS + 0.005, z - 0.012], [0.25, yS + 0.005, z - 0.012], [0.25, yS + 0.03, z + 0.012], [0.2, yS + 0.03, z + 0.012]]);
      fillP(ctx, pts, 'rgba(14,12,14,0.95)');
    }
  }

  function drawPianoLid(ctx, cam, G, st, ang, o) {
    const { lidPts, P, Wd, Lp } = G; const yt = PN.yt, th = PN.th; const sil = st.sil;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const rot = (x, y, z) => [x, yt + z * sa + (y - yt) * ca, z * ca - (y - yt) * sa];
    if (ang <= 0.01) {
      // closed lid: one slab over the whole outline (front flap seam line)
      const top = P.map(p => [p[0], yt + th, p[1]]);
      const tp = cam.poly(top); if (!tp) return;
      if (cam.eye[1] < yt + th) return;
      if (sil) { fillP(ctx, tp, cs(st.silCol)); return; }
      const nU = [0, 1, 0]; const c0 = lacquer(st, [Lp * 0.2, yt + th, Wd * 0.8], nU, 1, true), c1 = lacquer(st, [Lp * 0.8, yt + th, Wd * 0.2], nU, 1, true);
      const pa = cam.p([Lp * 0.5, yt + th, Wd]), pb = cam.p([Lp * 0.5, yt + th, 0]);
      const g = ctx.createLinearGradient(pa[0], pa[1], pb[0], pb[1]); g.addColorStop(0, cs(c0)); g.addColorStop(1, cs(c1));
      fillP(ctx, tp, g);
      const vd = vnorm(vsub([Lp * 0.5, yt + th, Wd * 0.5], st.eye)); const fr = 0.05 + 0.95 * Math.pow(1 - Math.abs(vd[1]), 5);
      mirrorLights(ctx, cam, st.env, nU, yt + th, tp, 0.72, Math.min(0.45, fr * 0.7));
      const s0 = cam.p([PN.xf, yt + th, 0]), s1 = cam.p([PN.xf, yt + th, Wd]);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
      return;
    }
    // open: the main lid rotated about the straight-side hinge; front flap folded on top
    const bot = lidPts.map(p => rot(p[0], yt, p[1])), topP = lidPts.map(p => rot(p[0], yt + th, p[1]));
    const nTop = vnorm([0, ca, -sa]); // outward normal of the upper surface
    const above = vdot(vsub(st.eye, topP[0]), nTop) > 0;
    const surf = above ? topP : bot;
    const sp = cam.poly(surf); if (!sp) return;
    // edge band (thickness) on faces toward camera
    const edges = [];
    for (let i = 0; i < lidPts.length - 1; i++) {
      const a = lidPts[i], b = lidPts[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1;
      let nr = [dz / l, 0, -dx / l]; const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if ((mid[0] - Lp * 0.5) * nr[0] + (mid[1] - Wd * 0.45) * nr[2] < 0) nr = vmul(nr, -1);
      const nrr = vnorm([nr[0], nr[2] * sa, nr[2] * ca]);
      const q = [rot(a[0], yt, a[1]), rot(b[0], yt, b[1]), rot(b[0], yt + th, b[1]), rot(a[0], yt + th, a[1])];
      const fc = vmul(vadd(vadd(q[0], q[1]), vadd(q[2], q[3])), 0.25);
      if (cam.facing(fc, nrr)) edges.push({ q, nrr, fc });
    }
    if (sil) { fillP(ctx, sp, cs(st.silCol)); for (const e of edges) fillP(ctx, cam.poly(e.q), cs(st.silCol)); }
    else {
      const nS = above ? nTop : vmul(nTop, -1);
      const pA = [Lp * 0.5, 0, 0], pB = [Lp * 0.5, 0, Wd * 0.75];
      const A = rot(pA[0], above ? yt + th : yt, pA[2]), B = rot(pB[0], above ? yt + th : yt, pB[2]);
      // seen almost edge-on (front views, or from behind the player) the Fresnel term would turn the black lid into a
      // pale plank against a bright room: keep it a dark blade, the edge highlight carries the shape
      const vd0 = vnorm(vsub(vmul(vadd(A, B), 0.5), st.eye)), edgeOn = Math.abs(vdot(vd0, nS)) < 0.14;
      const cA = lacquer(st, A, nS, edgeOn ? 0.3 : 1, true), cB = lacquer(st, B, nS, edgeOn ? 0.3 : 1, true);
      const sA = cam.p(A), sB = cam.p(B);
      const g = ctx.createLinearGradient(sA[0], sA[1], sB[0], sB[1]);
      g.addColorStop(0, cs(cA)); g.addColorStop(1, cs(above ? cB : cadd(cB, [18, 14, 10])));
      fillP(ctx, sp, g);
      const dPl = vdot(nS, above ? topP[0] : bot[0]);
      const vd = vnorm(vsub(vmul(vadd(A, B), 0.5), st.eye)); const fr = 0.05 + 0.95 * Math.pow(1 - Math.abs(vdot(vd, nS)), 5);
      const grazing = Math.abs(vdot(vd, nS)) < 0.14; // lid seen almost edge-on (front view): keep it a clean black blade
      if (grazing) { /* no mirrored windows: at this angle they shattered into grey shards */ }
      else if (above) mirrorLights(ctx, cam, st.env, nS, dPl, sp, 0.9, fr);
      else {
        // gold plate & strings mirrored in the lid underside
        const yP = yt - 0.075; const pl = G.inner.map(p => mirrorP([Math.max(p[0], 0.06), yP, p[1]], nS, dPl));
        const mp = o.lidGold === false ? null : cam.poly(pl);
        if (mp) {
          ctx.save(); ctx.beginPath(); trace(ctx, sp); ctx.clip();
          const h0 = cam.p(rot(Lp * 0.5, yt, 0.05)), h1 = cam.p(rot(Lp * 0.5, yt, Wd * 0.8));
          const gg = ctx.createLinearGradient(h0[0], h0[1], h1[0], h1[1]); gg.addColorStop(0, cs([150, 112, 50], 0.06)); gg.addColorStop(0.5, cs([186, 138, 62], 0.16 + fr * 0.25)); gg.addColorStop(1, cs([206, 156, 74], 0.24 + fr * 0.35));
          fillP(ctx, mp, gg);
          // the strings, mirrored: a fan of faint bright lines across the gold
          ctx.strokeStyle = cs([250, 236, 204], 0.12 + fr * 0.2); ctx.lineWidth = 0.8; ctx.beginPath();
          for (let i2 = 0; i2 < 26; i2++) { const s2 = i2 / 25; const z0 = lerp(0.2, Wd - 0.16, s2); const xE = lerp(Lp * 0.93, PN.xf + 0.15, Math.pow(s2, 0.85)); const zE = Math.min(G.zAt(xE) - 0.07, lerp(Wd * 0.2, Wd - 0.2, s2)); const a2 = cam.p(mirrorP([0.11, yt - 0.055, z0], nS, dPl)), b2 = cam.p(mirrorP([xE, yt - 0.055, zE], nS, dPl)); ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]); }
          ctx.stroke(); ctx.restore();
        }
        mirrorLights(ctx, cam, st.env, nS, dPl, sp, 0.5, fr * 0.6);
      }
      for (const e of edges) {
        const pts = cam.poly(e.q); if (!pts) continue;
        const c = lacquer(st, e.fc, e.nrr, 1.3, grazing);
        fillP(ctx, pts, cs(cadd(c, [26, 24, 22])));
      }
      // crisp highlight on the outer lid edge
      ctx.lineCap = 'round';
      for (const e of edges) {
        const a = cam.p(e.q[3]), b = cam.p(e.q[2]);
        ctx.strokeStyle = cs(cadd(lacquer(st, e.fc, vnorm(vadd(e.nrr, nTop)), 1.5), [60, 56, 50]), 0.9); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }
    // folded front flap lying on the lid's upper surface
    if (above) {
      const x0 = PN.xf, x1 = PN.xf * 2 - 0.01;
      const fl = [rot(x0, yt + th, 0.005), rot(x1, yt + th, 0.005), rot(x1, yt + th, Wd - 0.005), rot(x0, yt + th, Wd - 0.005)];
      const ft = fl.map(p => vadd(p, vmul(nTop, th)));
      const fp = cam.poly(ft);
      if (fp) fillP(ctx, fp, sil ? cs(st.silCol) : cs(lacquer(st, ft[0], nTop, 1.0)));
    }
    // prop stick
    const xs = Lp * 0.5, zr = G.zAt(xs);
    const foot = [xs, yt, zr - 0.06]; const tip = rot(xs, yt, zr - 0.16);
    const pf = cam.p(foot), pt = cam.p(tip); const w = Math.max(1.5, 0.026 * cam.scaleAt(foot));
    ctx.lineCap = 'butt'; ctx.strokeStyle = sil ? cs(st.silCol) : cs(lacquer(st, vlerp(foot, tip, 0.5), vnorm(vsub(st.eye, vlerp(foot, tip, 0.5))), 1)); ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(pf[0], pf[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke();
    if (!sil) { ctx.strokeStyle = 'rgba(255,240,220,0.22)'; ctx.lineWidth = Math.max(0.8, w * 0.25); ctx.beginPath(); ctx.moveTo(pf[0] - w * 0.25, pf[1]); ctx.lineTo(pt[0] - w * 0.25, pt[1]); ctx.stroke(); }
  }

  function drawPianoFront(ctx, cam, G, st, o, out) {
    const { Wd, cheekW } = G; const yb = PN.yb, yt = PN.yt, yk = PN.yk; const sil = st.sil;
    const kx0 = -PN.keyLen, zc = Wd / 2;
    const S = c => cs(c);
    const lq = (nr, fc, gl) => S(lacquer(st, fc, nr, gl === undefined ? 1 : gl));
    const cheekL = box(-0.172, yb, 0, 0.0, 0.80, cheekW), cheekR = box(-0.172, yb, Wd - cheekW, 0.0, 0.80, Wd);
    const leftFar = cam.depth([-0.1, 0.7, 0]) > cam.depth([-0.1, 0.7, Wd]);
    drawHex(ctx, cam, leftFar ? cheekL : cheekR, (nr, fc) => lq(nr, fc, nr[1] > 0.5 ? 0.45 : 1));
    // name board / case front above the keys (full width above the cheek blocks: the case front has no hole at the ends)
    const nb = cam.poly([[0, yk - 0.01, cheekW], [0, yk - 0.01, Wd - cheekW], [0, yt, Wd - cheekW], [0, yt, cheekW]]);
    if (cam.facing([0, 0.85, zc], [-1, 0, 0])) for (const [za, zb] of [[0, cheekW + 0.002], [Wd - cheekW - 0.002, Wd]]) { const q = cam.poly([[0, 0.795, za], [0, 0.795, zb], [0, yt, zb], [0, yt, za]]); if (q) fillP(ctx, q, sil ? S(st.silCol) : lq([-1, 0, 0], [0, 0.89, (za + zb) / 2])); }
    if (nb && cam.facing([0, 0.85, zc], [-1, 0, 0])) {
      fillP(ctx, nb, sil ? S(st.silCol) : lq([-1, 0, 0], [0, 0.82, zc]));
      if (!sil) {
        const a = cam.p([0, 0.862, cheekW]), b = cam.p([0, 0.862, Wd - cheekW]);
        ctx.strokeStyle = cs(cadd(lacquer(st, [0, 0.86, zc], vnorm([-1, 1, 0]), 1.4), [24, 24, 24])); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        const m = cam.p([0, 0.79, zc]); const s = cam.scaleAt([0, 0.79, zc]);
        if (s * 0.08 > 6) { ctx.fillStyle = 'rgba(200,160,80,0.75)'; ctx.fillRect(m[0] - s * 0.04, m[1] - s * 0.004, s * 0.08, s * 0.008); }
      }
    }
    // keybed: a solid block under the keys (in a silhouette nothing may show through it)
    if (sil) drawHex(ctx, cam, box(kx0 - 0.004, yb, cheekW - 0.002, 0.002, yk - 0.002, Wd - cheekW + 0.002), () => S(st.silCol));
    // keybed / key slip
    const ks = cam.poly([[kx0 - 0.004, yb + 0.005, cheekW], [kx0 - 0.004, yb + 0.005, Wd - cheekW], [kx0 - 0.004, yk - 0.02, Wd - cheekW], [kx0 - 0.004, yk - 0.02, cheekW]]);
    if (ks && cam.facing([kx0, 0.68, zc], [-1, 0, 0])) fillP(ctx, ks, sil ? S(st.silCol) : lq([-1, 0, 0], [kx0, 0.67, zc], 0.9));
    // keys
    const kw = 0.0235, z0 = cheekW;
    const white = KEYS.filter(k => !k.black), black = KEYS.filter(k => k.black);
    const sc = cam.scaleAt([-0.07, yk, zc]);
    const ivory = sil ? st.silCol : cmix([236, 230, 220], cfilt(st.lcol, [250, 246, 238]), 0.4);
    if (sc * kw > 2.2 || sil) {
      const wsorted = white.slice().sort((a, b) => cam.depth([-0.07, yk, z0 + b.c * kw]) - cam.depth([-0.07, yk, z0 + a.c * kw]));
      const front = cam.facing([kx0, yk - 0.01, zc], [-1, 0, 0]);
      for (const k of wsorted) {
        const za = z0 + k.x0 * kw + 0.0005, zb = z0 + k.x1 * kw - 0.0005;
        const top = cam.poly([[kx0, yk, za], [0, yk, za], [0, yk, zb], [kx0, yk, zb]]);
        if (top) {
          const a = cam.p([kx0, yk, (za + zb) / 2]), b = cam.p([0, yk, (za + zb) / 2]);
          const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, S(cmul(ivory, 1.0))); g.addColorStop(1, S(cmul(ivory, 0.62)));
          fillP(ctx, top, sil ? S(st.silCol) : g);
        }
        if (front) { const fr = cam.poly([[kx0, yk - 0.018, za], [kx0, yk - 0.018, zb], [kx0, yk, zb], [kx0, yk, za]]); fillP(ctx, fr, sil ? S(st.silCol) : S(cmul(ivory, 0.78))); }
      }
      const bsorted = black.slice().sort((a, b) => cam.depth([-0.04, yk, z0 + b.c * kw]) - cam.depth([-0.04, yk, z0 + a.c * kw]));
      for (const k of bsorted) {
        const za = z0 + k.x0 * kw, zb = z0 + k.x1 * kw, h = yk + 0.0127;
        drawHex(ctx, cam, [[-0.098, yk, za], [-0.098, yk, zb], [0, yk, zb], [0, yk, za], [-0.093, h, za + 0.002], [-0.093, h, zb - 0.002], [0, h, zb - 0.002], [0, h, za + 0.002]],
          (nr, fc) => sil ? S(st.silCol) : S(nr[1] > 0.5 ? cadd([20, 20, 24], lacquer(st, fc, nr, 1), 0.9) : [10, 10, 13]));
      }
    } else {
      // tiny: a single strip
      const top = cam.poly([[kx0, yk, cheekW], [0, yk, cheekW], [0, yk, Wd - cheekW], [kx0, yk, Wd - cheekW]]);
      fillP(ctx, top, S(cmul(ivory, 0.85)));
    }
    drawHex(ctx, cam, leftFar ? cheekR : cheekL, (nr, fc) => lq(nr, fc, nr[1] > 0.5 ? 0.45 : 1));
    // music desk + sheet
    if (o.desk !== false) {
      const ang = 0.24, hgt = 0.31, x0 = 0.12, y0 = yt + 0.012;
      const dz0 = zc - 0.43, dz1 = zc + 0.43;
      const up = [Math.sin(ang), Math.cos(ang), 0], nrm = [-Math.cos(ang), Math.sin(ang), 0], tk = 0.018;
      const c = (s, h, z) => [x0 + up[0] * h + nrm[0] * -s, y0 + up[1] * h + nrm[1] * -s, z];
      drawHex(ctx, cam, [c(0, 0, dz0), c(tk, 0, dz0), c(tk, 0, dz1), c(0, 0, dz1), c(0, hgt, dz0), c(tk, hgt, dz0), c(tk, hgt, dz1), c(0, hgt, dz1)], (nr, fc) => lq(nr, fc, 1));
      drawHex(ctx, cam, box(x0 - 0.045, y0 - 0.006, dz0, x0 + 0.004, y0 + 0.022, dz1), (nr, fc) => lq(nr, fc, nr[1] > 0.5 ? 0.35 : 0.9));
      if (o.sheet !== false && !sil && cam.facing(c(0, hgt / 2, zc), nrm)) {
        const off = 0.004; const sp = (s, h, z) => vadd(c(0, h, z), vmul(nrm, off));
        const pts = cam.poly([sp(0, 0.02, zc - 0.31), sp(0, 0.02, zc + 0.31), sp(0, 0.29, zc + 0.31), sp(0, 0.29, zc - 0.31)]);
        if (pts) {
          const pc = cfilt([246, 240, 226], cmix([200, 200, 200], st.lcol, 0.6));
          fillP(ctx, pts, S(pc));
          // faint staves
          ctx.save(); ctx.beginPath(); trace(ctx, pts); ctx.clip(); ctx.strokeStyle = 'rgba(60,50,40,0.28)'; ctx.lineWidth = 0.6;
          for (let r = 0; r < 8; r++) for (let l = 0; l < 5; l++) { const h = 0.26 - r * 0.03 - l * 0.004; for (const side of [-1, 1]) { const a = cam.p(sp(0, h, zc + side * 0.02)), b = cam.p(sp(0, h, zc + side * 0.29)); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
          const m0 = cam.p(sp(0, 0.02, zc)), m1 = cam.p(sp(0, 0.29, zc)); ctx.strokeStyle = 'rgba(80,60,40,0.35)'; ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]); ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  /* ======================================================================
   * KEYS CLOSE-UP — perspective keyboard in millimetres
   * world: x along keyboard (white units*23.5 from A0's left edge), y up (0 = white keytop), z depth (0 = key front, + toward fallboard)
   * ====================================================================== */
  const KW = 23.5, KLEN = 150, BLEN = 95, BH = 12.7, PIVOT = 270;
  function keysSetup(o, t) {
    const focus = o.focus === undefined ? 39 : o.focus; // key index (C4)
    const fk = KEYS[clamp(Math.round(focus), 0, 87)];
    const fx = fk.c * KW;
    const views = {
      along: { eye: [fx + 150, 88, -150], tgt: [fx - 110, 0, 88], fov: 48 },
      alongBass: { eye: [fx - 150, 88, -150], tgt: [fx + 110, 0, 88], fov: 48 },
      low: { eye: [fx + 105, 34, -120], tgt: [fx - 70, 2, 75], fov: 56 },
      side: { eye: [fx + 330, 62, 30], tgt: [fx - 120, -4, 70], fov: 48 },
      front: { eye: [fx + 10, 300, -330], tgt: [fx, 0, 70], fov: 46 },
      top: { eye: [fx, 520, 30], tgt: [fx, 0, 78], fov: 40 },
    };
    const v = Object.assign({}, views[o.view || 'along'] || views.along, o.cam || {});
    const fov = (o.fov || v.fov) * Math.PI / 180; const focal = (W / 2) / Math.tan(fov / 2) * (o.zoom || 1);
    const cam = makeCam(v.eye, v.tgt, focal, o.cx === undefined ? W / 2 : o.cx, o.cy === undefined ? H / 2 : o.cy, o.roll || 0, 4, true);
    const warp = o.warp || 0;
    const tt = t || o.t || 0;
    const xf = warp > 0 ? p => [p[0] + Math.sin(p[2] * 0.012 + tt * 0.9) * 10 * warp, p[1] + Math.sin(p[0] * 0.011 + tt * 1.3) * 22 * warp + Math.sin(p[0] * 0.031 - tt * 0.7) * 6 * warp, p[2] + Math.sin(p[0] * 0.007 + tt) * 30 * warp] : null;
    if (xf) { const cs0 = cam.cs; cam.cs = p => cs0(xf(p)); const d0 = cam.depth; cam.depth = p => d0(xf(p)); const pr = cam.p; cam.p = p => { const q = cam.cs(p); const z = Math.max(q[2], cam.near); return [cam.cx + focal * q[0] / z, cam.cy - focal * q[1] / z, q[2]]; }; }
    const dip = k => clamp((o.pressed && o.pressed[k]) || 0) * 10;
    return { cam, fx, focal, dip };
  }
  // y offset of a key at depth z when pressed (rotation about a far pivot)
  const keyDrop = (d, z) => -d * (1 - z / PIVOT);

  L.keyPos = function (o, index) {
    const { cam, dip } = keysSetup(o, o.t);
    const k = KEYS[clamp(index | 0, 0, 87)]; const d = dip(index);
    const z = k.black ? 112 : 38; const y = (k.black ? BH : 0) + keyDrop(d, z); const x = k.c * KW;
    const p = cam.p([x, y, z]); const pa = cam.p([x + 10, y, z]), pb = cam.p([x, y + keyDrop(d, z + 10) - keyDrop(d, z), z + 10]);
    const ax = pa[0] - p[0], ay = pa[1] - p[1], al = Math.hypot(ax, ay) || 1, bx = pb[0] - p[0], by = pb[1] - p[1], bl = Math.hypot(bx, by) || 1;
    const wL = cam.p([k.x0 * KW, y, z]), wR = cam.p([k.x1 * KW, y, z]);
    const front = cam.p([x, (k.black ? BH : 0) + keyDrop(d, k.black ? 55 : 0), k.black ? 55 : 0]);
    return { x: p[0], y: p[1], depth: p[2], w: Math.hypot(wR[0] - wL[0], wR[1] - wL[1]), ax: ax / al, ay: ay / al, bx: bx / bl, by: by / bl, scale: al / 10, black: k.black, press: d / 10, front: { x: front[0], y: front[1] }, note: k.n };
  };

  L.keysClose = function (ctx, t, o = {}) {
    const { cam, fx, focal, dip } = keysSetup(o, t); const PM = profMarks(ctx, 'keys');
    const light = o.light || {};
    const laz = light.az === undefined ? -0.9 : light.az, lel = light.el === undefined ? 0.55 : light.el;
    const ldir = vnorm([Math.sin(laz) * Math.cos(lel), Math.sin(lel), Math.cos(laz) * Math.cos(lel)]); // toward light
    const lcol = hx(light.color || '#fff1da'), lk = light.k === undefined ? 1 : light.k;
    const amb = hx(o.ambient || '#7d7a84');
    const ivory = hx(o.ivory || '#f4efe6');
    // window light source for mirror reflections (placed along ldir)
    const wc = vadd([fx, 0, 75], vmul(ldir, 2200)); const wn = vmul(ldir, -1);
    let wax = vnorm(vcross(wn, [0, 1, 0])); if (!isFinite(wax[0])) wax = [1, 0, 0];
    const way = vnorm(vcross(wax, wn));
    const env = { lights: [makeWin(wc, vmul(wax, light.winW || 560), vmul(way, light.winH || 520), wn, 2, 2, 0.05, lcol, 5 * lk)], ceil: [50, 48, 50], floor: [20, 16, 14], horizon: cmul(amb, 0.5) };
    if (o.extraLights) for (const e of o.extraLights) env.lights.push(e);
    const whiteout = o.whiteout || 0;
    const sil = o.style === 'silhouette';

    // visible key range (cheap cull): keys whose front centre projects near the screen
    const vis = [];
    for (const k of KEYS) {
      const x = k.c * KW; const d = cam.depth([x, 0, 70]);
      if (d < 5) { // behind the camera: allow keys that still reach into view
        const d2 = cam.depth([x, 0, KLEN]); if (d2 < 5) continue;
      }
      const p = cam.p([x, 0, 70]); const p2 = cam.p([x, 0, 0]);
      const m = 600; if ((p[0] < -m && p2[0] < -m) || (p[0] > W + m && p2[0] > W + m) || (p[1] < -m && p2[1] < -m) || (p[1] > H + m && p2[1] > H + m)) continue;
      vis.push(k);
    }
    const tgt = o.dof ? true : null;
    const paintKeys = (c, vis, dip, sub) => {
    c.save(); c.lineJoin = 'round';
    // key bed / gaps: dark plane under the keys + key slip + name board
    const mg = sub ? 0 : 40;
    const xs = vis.length ? Math.min(...vis.map(k => k.x0 * KW)) - mg : fx - 600, xe = vis.length ? Math.max(...vis.map(k => k.x1 * KW)) + mg : fx + 600;
    const bed = cam.poly([[xs, -14, -2], [xe, -14, -2], [xe, -14, KLEN + 4], [xs, -14, KLEN + 4]]); fillP(c, bed, '#060608');
    const slip = cam.poly([[xs, -15, -4], [xe, -15, -4], [xe, -60, -4], [xs, -60, -4]]);
    if (!sub && slip && cam.facing([fx, -30, -4], [0, 0, -1])) {
      const a = cam.p([fx, -15, -4]), b = cam.p([fx, -60, -4]); const g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
      g.addColorStop(0, cs(cadd([16, 16, 20], lcol, 0.08 * lk))); g.addColorStop(0.15, '#0b0b0e'); g.addColorStop(1, '#050507'); fillP(c, slip, sil ? '#000' : g);
    }
    PM('bed');
    // name board (fallboard) with reflection of the keys
    const zNB = KLEN + 3;
    const nbPts = sub ? null : cam.poly([[xs, -4, zNB], [xe, -4, zNB], [xe, 75, zNB], [xs, 75, zNB]]);
    if (nbPts) {
      const a = cam.p([fx, 75, zNB]), b = cam.p([fx, -4, zNB]); const g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
      g.addColorStop(0, '#08080b'); g.addColorStop(0.7, '#0e0e12'); g.addColorStop(1, '#141418'); fillP(c, nbPts, g);
      if (!sil) {
        c.save(); c.beginPath(); trace(c, nbPts); c.clip();
        const nM = [0, 0, -1], dM = -zNB; // plane z = zNB  (n·p = d with n=(0,0,-1))
        // the keys mirrored in the fallboard: two batched paths (whites, then blacks) instead of one fill per key
        const refl = [new Path2D(), new Path2D()];
        for (const k of vis) {
          const d = dip(k.k); const x0 = k.x0 * KW + (k.black ? 0 : 0.5), x1 = k.x1 * KW - (k.black ? 0 : 0.5);
          const zA = k.black ? 55 : 60, yy = k.black ? BH : 0;
          const pts = cam.poly([[x0, yy + keyDrop(d, zA), zA], [x1, yy + keyDrop(d, zA), zA], [x1, yy + keyDrop(d, KLEN), KLEN], [x0, yy + keyDrop(d, KLEN), KLEN]].map(p => mirrorP(p, nM, dM)));
          if (pts) { const P2 = refl[k.black ? 1 : 0]; P2.moveTo(pts[0][0], pts[0][1]); for (let q = 1; q < pts.length; q++) P2.lineTo(pts[q][0], pts[q][1]); P2.closePath(); }
        }
        c.fillStyle = cs(cmul(ivory, 0.2 + 0.1 * lk), 0.85); c.fill(refl[0]); c.fillStyle = 'rgba(0,0,0,0.9)'; c.fill(refl[1]);
        // soft fade & gloss of the name board
        const g2 = c.createLinearGradient(a[0], a[1], b[0], b[1]); g2.addColorStop(0, 'rgba(8,8,11,0.95)'); g2.addColorStop(0.55, 'rgba(8,8,11,0.25)'); g2.addColorStop(1, 'rgba(8,8,11,0)');
        c.fillStyle = g2; c.fillRect(-W, -H, W * 3, H * 3);
        mirrorLights(c, cam, env, nM, dM, nbPts, 0.35, 0.12);
        c.restore();
        // felt strip
        // (segmented so it follows the keys when the keyboard warps)
        const nSeg = o.warp > 0 ? Math.max(1, Math.ceil((xe - xs) / 60)) : 1;
        for (let q = 0; q < nSeg; q++) { const xa = lerp(xs, xe, q / nSeg), xb = lerp(xs, xe, (q + 1) / nSeg) + 0.5; fillP(c, cam.poly([[xa, -1.5, KLEN + 0.5], [xb, -1.5, KLEN + 0.5], [xb, 3, KLEN + 2.5], [xa, 3, KLEN + 2.5]]), cs(cadd([96, 18, 26], lcol, 0.05))); }
      }
    }
    PM('nameboard');
    // ---- white keys (lowest first, then far->near)
    const flatTops = [], flatBlackTops = [];
    const whites = vis.filter(k => !k.black).map(k => ({ k, d: dip(k.k), dep: cam.depth([k.c * KW, 0, 75]) }));
    whites.sort((a, b) => (b.d - a.d) || (b.dep - a.dep));
    const blackShadow = [];
    for (const { k, d } of whites) {
      const x0 = k.x0 * KW + 0.55, x1 = k.x1 * KW - 0.55;
      const yF = keyDrop(d, 0), yB = keyDrop(d, KLEN);
      // sides exposed by lower neighbours
      const nL = KEYS[k.k - 1 >= 0 ? k.k - 1 : k.k], nR = KEYS[k.k + 1 <= 87 ? k.k + 1 : k.k];
      const neighWhite = (dir) => { let j = k.k + dir; while (j >= 0 && j <= 87 && KEYS[j].black) j += dir; return j >= 0 && j <= 87 ? j : -1; };
      for (const [dir, xx] of [[-1, x0], [1, x1]]) {
        const j = neighWhite(dir); const dn = j >= 0 ? dip(j) : 10;
        if (dn > d + 0.05 || j < 0) {
          // exposed side: only down to the lower neighbour's top (below that the neighbour's own body hides it;
          // drawing deeper would paint over the pressed key's top — the old "translucent slab" bug)
          const yF2 = j < 0 ? yF - 16 : keyDrop(dn, 0) - 0.3, yB2 = j < 0 ? yB - 16 : keyDrop(dn, KLEN) - 0.3;
          const sp = cam.poly([[xx, yF, 0], [xx, yB, KLEN], [xx, yB2, KLEN], [xx, yF2, 0]]);
          if (sp && cam.facing([xx, yF - 5, 60], [dir, 0, 0])) {
            const a = cam.p([xx, yF, 30]), b = cam.p([xx, yF2, 30]); const g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
            g.addColorStop(0, cs(cmul(ivory, 0.66 + 0.25 * Math.max(0, ldir[0] * dir)))); g.addColorStop(1, cs(cmul(ivory, j < 0 ? 0.18 : 0.38)));
            fillP(c, sp, sil ? '#000' : g);
          }
        }
      }
      // front face
      const ff = cam.poly([[x0, yF, 0], [x1, yF, 0], [x1, yF - 12, 0], [x0, yF - 12, 0]]);
      if (ff && cam.facing([(x0 + x1) / 2, yF - 6, 0], [0, 0, -1])) {
        const fl = 0.5 + 0.35 * Math.max(0, -ldir[2]); const a = cam.p([x0, yF, 0]), b = cam.p([x0, yF - 12, 0]);
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 14) { const g = c.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, cs(cmul(ivory, fl + 0.15))); g.addColorStop(0.25, cs(cmul(ivory, fl))); g.addColorStop(1, cs(cmul(ivory, fl * 0.55))); fillP(c, ff, sil ? '#000' : g); }
        else fillP(c, ff, sil ? '#000' : cs(cmul(ivory, fl * 0.85))); // small on screen: flat
      }
      // top
      const tp = cam.poly([[x0, yF, 0], [x1, yF, 0], [x1, yB, KLEN], [x0, yB, KLEN]]);
      if (tp) {
        if (sil) { fillP(c, tp, '#000'); continue; }
        const a = cam.p([(x0 + x1) / 2, yF, 0]), b = cam.p([(x0 + x1) / 2, yB, KLEN]);
        const g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
        const dif = 0.55 + 0.45 * Math.max(0, ldir[1]);
        const base = cadd(cfilt(ivory, cmix(amb, lcol, dif * lk)), [0, 0, 0]);
        g.addColorStop(0, cs(cmul(base, 1.06))); g.addColorStop(0.35, cs(base)); g.addColorStop(0.85, cs(cmul(base, 0.86))); g.addColorStop(1, cs(cmul(base, 0.6)));
        fillP(c, tp, g);
        // glossy window reflection on the keytop plane (unpressed keys batched below)
        if (d > 0.05) {
          const nrm = vnorm([0, PIVOT, d]);
          const vd = vnorm(vsub([(x0 + x1) / 2, yF, 60], cam.eye)); const fr = 0.04 + 0.96 * Math.pow(1 - Math.abs(vdot(vd, nrm)), 5);
          mirrorLights(c, cam, env, nrm, vdot(nrm, [x0, yF, 0]), tp, 0.22, Math.min(0.5, fr * 1.6));
        } else flatTops.push(tp);
        // crisp highlight on the front edge
        const e0 = cam.p([x0 + 0.6, yF, 0.3]), e1 = cam.p([x1 - 0.6, yF, 0.3]);
        c.strokeStyle = cs(cadd(base, lcol, 0.35 * lk), 0.9); c.lineWidth = Math.max(0.8, 1.1 * cam.scaleAt([x0, yF, 0])); c.lineCap = 'round';
        c.beginPath(); c.moveTo(e0[0], e0[1]); c.lineTo(e1[0], e1[1]); c.stroke();
      }
    }
    PM('whites');
    if (!sil && flatTops.length) {
      const vd = vnorm(vsub([fx, 0, 60], cam.eye)); const fr = 0.04 + 0.96 * Math.pow(1 - Math.abs(vd[1]), 5);
      c.save(); c.beginPath(); for (const tp of flatTops) trace(c, tp); c.clip();
      mirrorLights(c, cam, env, [0, 1, 0], 0, [[-1e5, -1e5], [1e5, -1e5], [1e5, 1e5], [-1e5, 1e5]], 0.22, Math.min(0.5, fr * 1.6));
      c.restore();
    }
    PM('reflW');
    // ---- black-key shadows on white keytops (soft)
    if (!sil) {
      const lx = -ldir[0] / Math.max(0.15, ldir[1]), lz = -ldir[2] / Math.max(0.15, ldir[1]);
      const sc = cam.scaleAt([fx, 0, 75]); const sbb = [1e9, 1e9, -1e9, -1e9];
      quarterSoft(c, s => {
        s.fillStyle = '#000'; s.beginPath();
        for (const k of vis) {
          if (!k.black) continue; const d = dip(k.k);
          const x0 = k.x0 * KW, x1 = k.x1 * KW; const hh = BH - d * 0.6;
          const q1 = cam.poly([[x0, 0.2, 50], [x1, 0.2, 50], [x1, 0.2, KLEN], [x0, 0.2, KLEN]]);
          const q2 = cam.poly([[x0 + lx * hh, 0.2, 50 + lz * hh], [x1 + lx * hh, 0.2, 50 + lz * hh], [x1 + lx * hh, 0.2, KLEN + lz * hh], [x0 + lx * hh, 0.2, KLEN + lz * hh]]);
          const q3 = cam.poly([[x0, 0.2, 50], [x0 + lx * hh, 0.2, 50 + lz * hh], [x0 + lx * hh, 0.2, KLEN + lz * hh], [x0, 0.2, KLEN]]);
          const q4 = cam.poly([[x1, 0.2, 50], [x1 + lx * hh, 0.2, 50 + lz * hh], [x1 + lx * hh, 0.2, KLEN + lz * hh], [x1, 0.2, KLEN]]);
          for (const q of [q1, q2, q3, q4]) if (q) { trace(s, q); for (const p of q) { if (p[0] < sbb[0]) sbb[0] = p[0]; if (p[1] < sbb[1]) sbb[1] = p[1]; if (p[0] > sbb[2]) sbb[2] = p[0]; if (p[1] > sbb[3]) sbb[3] = p[1]; } }
        }
        s.fill('nonzero');
      }, Math.max(2, sc * 2.2), 0.32 * lk * (1 - 0.85 * clamp(o.warp || 0)), 'source-over', () => { /* black + alpha == multiply, but cheaper */ if (sbb[2] < sbb[0]) return [0, 0, 0, 0]; const T1 = c.getTransform(); const pr = [[sbb[0], sbb[1]], [sbb[2], sbb[1]], [sbb[2], sbb[3]], [sbb[0], sbb[3]]].map(p => [T1.a * p[0] + T1.c * p[1] + T1.e, T1.b * p[0] + T1.d * p[1] + T1.f]); const m = Math.max(8, sc * 6); return [Math.min(...pr.map(p => p[0])) - m, Math.min(...pr.map(p => p[1])) - m, Math.max(...pr.map(p => p[0])) + m, Math.max(...pr.map(p => p[1])) + m]; });
    }
    PM('shadows');
    // ---- black keys
    const blacks = vis.filter(k => k.black).map(k => ({ k, d: dip(k.k), dep: cam.depth([k.c * KW, 6, 100]) }));
    blacks.sort((a, b) => (b.d - a.d) || (b.dep - a.dep));
    for (const { k, d } of blacks) {
      const xc = k.c * KW, hb = 6.85, ht = 4.75;
      const y0f = keyDrop(d, 50), y0b = keyDrop(d, KLEN), y1f = BH + keyDrop(d, 56), y1b = BH + keyDrop(d, KLEN);
      const C = [[xc - hb, y0f - 2, 50], [xc + hb, y0f - 2, 50], [xc + hb, y0b - 2, KLEN], [xc - hb, y0b - 2, KLEN], [xc - ht, y1f, 56], [xc + ht, y1f, 56], [xc + ht, y1b, KLEN], [xc - ht, y1b, KLEN]];
      // gap outline (dark) around the base
      const base = cam.poly([[xc - hb - 0.8, 0.1, 49], [xc + hb + 0.8, 0.1, 49], [xc + hb + 0.8, 0.1, KLEN], [xc - hb - 0.8, 0.1, KLEN]]);
      fillP(c, base, 'rgba(8,8,10,0.85)');
      drawHex(c, cam, C, (nr, fc, fi, pp) => {
        if (sil) return '#000';
        if (fi === 1) { // top face: ebony black, a soft sheen toward the front (no flat grey mirror slab)
          const a = cam.p([xc, y1f, 56]), b = cam.p([xc, y1b, KLEN]); const g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
          const vd = vnorm(vsub([xc, y1f, 90], cam.eye)); const fr = Math.pow(1 - Math.abs(vd[1]), 4);
          const k0 = cadd([13, 13, 16], cmul(amb, 0.05)), sh = cadd(k0, cmix(amb, lcol, 0.7), (0.05 + 0.22 * fr) * lk);
          g.addColorStop(0, cs(sh)); g.addColorStop(0.45, cs(cmix(sh, k0, 0.6))); g.addColorStop(1, cs(cmul(k0, 0.75)));
          return g;
        }
        const lit = Math.max(0, vdot(nr, ldir));
        return cs(cadd([9, 9, 12], cmix(amb, lcol, 0.5), 0.04 + 0.1 * lit * lk));
      });
      if (!sil) {
        const topP = cam.poly([C[4], C[5], C[6], C[7]]);
        // the window, dimly mirrored in the polished top (kept faint: black keys read black)
        if (d > 0.05) {
          const nrm = vnorm([0, PIVOT, d]);
          const vd = vnorm(vsub([xc, y1f, 100], cam.eye)); const fr = 0.05 + 0.95 * Math.pow(1 - Math.abs(vdot(vd, nrm)), 5);
          mirrorLights(c, cam, env, nrm, vdot(nrm, C[4]), topP, 0.22, Math.min(0.3, fr));
        } else if (topP) flatBlackTops.push(topP);
        // rounded long edges: a crisp highlight on the light side, a dim one on the other
        for (const [a, b, side] of [[C[4], C[7], -1], [C[5], C[6], 1]]) {
          const lit = Math.max(0, side * ldir[0]);
          const pa = cam.p(vadd(a, [-side * 0.35, -0.2, 0])), pb = cam.p(vadd(b, [-side * 0.35, -0.2, 0]));
          const g = c.createLinearGradient(pa[0], pa[1], pb[0], pb[1]);
          const hc = cadd([34, 34, 40], lcol, (0.12 + 0.75 * lit) * lk);
          g.addColorStop(0, cs(hc, 0.95)); g.addColorStop(0.55, cs(hc, 0.55)); g.addColorStop(1, cs(hc, 0.15));
          c.strokeStyle = g; c.lineWidth = Math.max(0.7, (0.55 + 0.6 * lit) * cam.scaleAt(a));
          c.beginPath(); c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.stroke();
        }
        // front bevel catches the light
        const pa = cam.p(C[4]), pb = cam.p(C[5]); c.strokeStyle = cs(cadd([46, 46, 52], lcol, 0.4 * lk), 0.85); c.lineWidth = Math.max(0.7, 0.9 * cam.scaleAt(C[4]));
        c.beginPath(); c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.stroke();
      }
    }
    PM('blacks');
    if (!sil && flatBlackTops.length) {
      const vd = vnorm(vsub([fx, BH, 100], cam.eye)); const fr = 0.05 + 0.95 * Math.pow(1 - Math.abs(vd[1]), 5);
      c.save(); c.beginPath(); for (const tp of flatBlackTops) trace(c, tp); c.clip();
      mirrorLights(c, cam, env, [0, 1, 0], BH, [[-1e5, -1e5], [1e5, -1e5], [1e5, 1e5], [-1e5, 1e5]], 0.22, Math.min(0.3, fr));
      c.restore();
    }
    c.restore();
    };
    // static-camera cache: the keyboard with nothing pressed is painted once; each frame only the neighbourhood
    // of the pressed keys is repainted inside a clip (a played run costs ~1/3 of a full repaint)
    const dipAny = vis.some(k => dip(k.k) > 0.001);
    if (o.warp > 0 || o.cache === false || sil) paintKeys(ctx, vis, dip, false);
    else {
      const T0 = ctx.getTransform();
      const bkey = JSON.stringify([cam.eye, cam.f, cam.u, focal, cam.cx, cam.cy, light, o.ambient || '', o.ivory || '', (o.extraLights || []).length]);
      const base = cachedLayer('keysBase', bkey, W, H, (bc) => paintKeys(bc, vis, () => 0, false));
      ctx.drawImage(base, 0, 0);
      if (dipAny) {
        const pressed = vis.filter(k => dip(k.k) > 0.001).map(k => k.k).sort((a, b) => a - b);
        const groups = []; for (const k of pressed) { const g = groups[groups.length - 1]; if (g && k - g[1] <= 5) g[1] = k; else groups.push([k, k]); }
        // screen bbox of every visible key (to find every key that can overlap a repaint region, incl. nearer keys in front)
        const khull = new Map(); for (const k of vis) { const pts = []; for (const x of [k.x0 * KW, k.x1 * KW]) for (const y of [-16, BH + 1]) for (const z of [0, KLEN]) pts.push(cam.p([x, y, z])); khull.set(k.k, hull(pts)); }
        // separating-axis test for two convex screen polygons
        const sep = (A, B) => { for (const P2 of [A, B]) for (let q = 0; q < P2.length; q++) { const a = P2[q], b = P2[(q + 1) % P2.length]; const nx = a[1] - b[1], ny = b[0] - a[0]; let a0 = 1e18, a1 = -1e18, b0 = 1e18, b1 = -1e18; for (const p of A) { const d = p[0] * nx + p[1] * ny; if (d < a0) a0 = d; if (d > a1) a1 = d; } for (const p of B) { const d = p[0] * nx + p[1] * ny; if (d < b0) b0 = d; if (d > b1) b1 = d; } if (a1 < b0 || b1 < a0) return true; } return false; };
        for (const [k0, k1] of groups) {
          const inner = KEYS.slice(Math.max(0, k0 - 2), Math.min(87, k1 + 2) + 1);
          const xa = Math.min(...inner.map(k => k.x0 * KW)), xb = Math.max(...inner.map(k => k.x1 * KW));
          const corners = [[xa, 20, -1], [xb, 20, -1], [xb, 20, KLEN + 2.5], [xa, 20, KLEN + 2.5], [xa, -16, KLEN + 2.5], [xb, -16, KLEN + 2.5], [xb, -16, -1], [xa, -16, -1]];
          if (corners.some(p => cam.depth(p) < cam.near * 2)) { paintKeys(ctx, vis, dip, false); break; } // too close to the lens: full repaint
          const clipQ = hull(corners.map(p => cam.p(p)));
          const outer = vis.filter(k => (k.k >= k0 - 4 && k.k <= k1 + 4) || !sep(khull.get(k.k), clipQ));
          // paint the patch offscreen, then lay it in through the clip with ONE draw (clipping each fill separately
          // left a dark anti-aliasing seam along the patch border)
          const B = PV.buffer('instr:keysPatch'); const T1 = ctx.getTransform();
          const dq = clipQ.map(p => [T1.a * p[0] + T1.c * p[1] + T1.e, T1.b * p[0] + T1.d * p[1] + T1.f]);
          const bx0 = Math.max(0, Math.floor(Math.min(...dq.map(p => p[0]))) - 2), by0 = Math.max(0, Math.floor(Math.min(...dq.map(p => p[1]))) - 2), bx1 = Math.min(W, Math.ceil(Math.max(...dq.map(p => p[0]))) + 2), by1 = Math.min(H, Math.ceil(Math.max(...dq.map(p => p[1]))) + 2);
          if (bx1 <= bx0 || by1 <= by0) continue;
          B.ctx.clearRect(bx0, by0, bx1 - bx0, by1 - by0); B.ctx.save(); B.ctx.beginPath(); B.ctx.rect(bx0, by0, bx1 - bx0, by1 - by0); B.ctx.clip(); B.ctx.setTransform(T1);
          paintKeys(B.ctx, outer, dip, true); B.ctx.restore();
          ctx.save(); ctx.beginPath(); trace(ctx, clipQ); ctx.clip(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(B.canvas, bx0, by0, bx1 - bx0, by1 - by0, bx0, by0, bx1 - bx0, by1 - by0); ctx.restore();
        }
      }
      void T0;
    }
    PM('keys');
    if (whiteout > 0) whiteoutFx(ctx, whiteout);
    PM('reflB');
    if (tgt) {
      // depth of field: quarter-res blurred copy of the frame, masked away from the focus band, laid over the sharp keys
      const dof = typeof o.dof === 'object' ? o.dof : { amount: o.dof };
      const amt = dof.amount || 6, DS = 6, qw = W / DS, qh = H / DS;
      const small = PV.buffer('instr:keysSmall', qw, qh); small.ctx.clearRect(0, 0, qw, qh); small.ctx.filter = `blur(${(amt / DS).toFixed(2)}px)`; small.ctx.drawImage(ctx.canvas, 0, 0, qw, qh); small.ctx.filter = 'none';
      const fk = KEYS[clamp(Math.round(o.focus === undefined ? 39 : o.focus), 0, 87)];
      const span = (dof.range || 5) * KW;
      const T0 = ctx.getTransform(); const sp = p => { const q = T0.transformPoint({ x: p[0], y: p[1] }); return [q.x / DS, q.y / DS]; };
      const pa = sp(cam.p([fk.c * KW - span, 0, 60])), pb = sp(cam.p([fk.c * KW + span, 0, 60])), pf = sp(cam.p([fk.c * KW, 0, 60]));
      const fpos = clamp(Math.hypot(pf[0] - pa[0], pf[1] - pa[1]) / (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1), 0.05, 0.95);
      small.ctx.globalCompositeOperation = 'destination-in';
      const g = small.ctx.createLinearGradient(pa[0], pa[1], pb[0], pb[1]);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(fpos * 0.6, 'rgba(0,0,0,0)'); g.addColorStop(fpos + (1 - fpos) * 0.4, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
      small.ctx.fillStyle = g; small.ctx.fillRect(0, 0, qw, qh); small.ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(small.canvas, 0, 0, W, H); ctx.restore();
    }
    PM('end');
    return { cam };
  };

  /* ======================================================================
   * FRETBOARD CLOSE-UP — strings, frets, vibration, the snapping 1st string
   * world mm (right-handed): x along the neck from the nut (0) toward the body,
   * y across the neck toward the 1st string, z = board normal (out of the face)
   * ====================================================================== */
  const SCALE_LEN = 648;
  const fretX = n => SCALE_LEN - SCALE_LEN / Math.pow(2, n / 12);
  const GAUGE = [0.25, 0.33, 0.43, 0.66, 0.91, 1.17];
  const boardW = x => 42 + 14.5 * clamp(x / 470);
  const strSpan = x => 35 + 17.5 * clamp(x / SCALE_LEN, -0.05, 1.2);
  const strY = (i, x) => strSpan(x) / 2 - i * strSpan(x) / 5;
  const boardZ = y => -y * y / 482;
  const strZ = (i, x) => 1.25 + lerp(0.5, 2.7, clamp(x / SCALE_LEN, 0, 1.2)) + i * 0.07 + boardZ(strY(i, x));
  function fbSetup(o) {
    const ff = o.focus === undefined ? 12 : o.focus;
    const fx = (fretX(Math.max(0, ff - 1)) + fretX(ff)) / 2;
    const views = {
      player: { eye: [fx + 30, 60, 250], tgt: [fx + 4, 2, 0], up: [0, 1, 0], fov: 50 },
      audience: { eye: [fx - 30, -60, 250], tgt: [fx - 4, -2, 0], up: [0, -1, 0], fov: 50 },
      along: { eye: [fx + 175, 8, 46], tgt: [fx - 150, -2, 0], up: [0, 0, 1], fov: 56 },
      low: { eye: [fx + 95, 46, 20], tgt: [fx - 80, -6, 2], up: [0, 0, 1], fov: 62 },
      snap: { eye: [fx + 40, 70, 75], tgt: [fx - 12, 10, 0], up: [0, 0, 1], fov: 50 },
    };
    const v = Object.assign({}, views[o.view || 'along'] || views.along, o.cam || {});
    const fov = (o.fov || v.fov) * Math.PI / 180; const focal = (W / 2) / Math.tan(fov / 2) * (o.zoom || 1);
    const cam = makeCam(v.eye, v.tgt, focal, o.cx === undefined ? W / 2 : o.cx, o.cy === undefined ? H / 2 : o.cy, o.roll || 0, 3, false, v.up);
    return { cam, fx };
  }
  L.fretX = fretX;
  L.fretPos = function (o, s, fret) {
    const { cam } = fbSetup(o);
    const f = Math.max(1, fret | 0); const xa = fretX(f - 1), xb = fretX(f); const x = lerp(xa, xb, 0.72);
    const y = strY(s, x), z = strZ(s, x) - 0.6;
    const p = cam.p([x, y, z]), pa = cam.p([x + 10, y, z]), pb = cam.p([x, y - 10, z]);
    const ax = pa[0] - p[0], ay = pa[1] - p[1], al = Math.hypot(ax, ay) || 1, bx = pb[0] - p[0], by = pb[1] - p[1], bl = Math.hypot(bx, by) || 1;
    const q0 = cam.p([x, strY(0, x), z]), q5 = cam.p([x, strY(5, x), z]);
    return { x: p[0], y: p[1], depth: p[2], ax: ax / al, ay: ay / al, bx: bx / bl, by: by / bl, scale: al / 10, spacing: Math.hypot(q5[0] - q0[0], q5[1] - q0[1]) / 5 };
  };

  // screen-space ribbon along a projected polyline (pts: [x,y,depth]|null) with world width wmm
  function ribbon(ctx, cam, pts, wmm, style, minW = 0.5, offset = 0) {
    let seg = [];
    const flush = () => {
      if (seg.length < 2) { seg = []; return; }
      const L1 = [], R1 = [];
      for (let i = 0; i < seg.length; i++) {
        const a = seg[Math.max(0, i - 1)], b = seg[Math.min(seg.length - 1, i + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const w = Math.max(minW, wmm * cam.focal / Math.max(seg[i][2], cam.near)) / 2;
        const ox = -dy, oy = dx;
        L1.push([seg[i][0] + ox * (w + offset * w * 2), seg[i][1] + oy * (w + offset * w * 2)]);
        R1.push([seg[i][0] - ox * (w - offset * w * 2), seg[i][1] - oy * (w - offset * w * 2)]);
      }
      ctx.beginPath(); ctx.moveTo(L1[0][0], L1[0][1]); for (let i = 1; i < L1.length; i++) ctx.lineTo(L1[i][0], L1[i][1]);
      for (let i = R1.length - 1; i >= 0; i--) ctx.lineTo(R1[i][0], R1[i][1]); ctx.closePath(); ctx.fillStyle = style; ctx.fill();
      seg = [];
    };
    for (const p of pts) { if (!p) { flush(); continue; } seg.push(p); }
    flush();
  }
  function drawString(ctx, cam, pts3, i, o, alpha, lightSide, lite, wmul) {
    const pts = cam.line(pts3); const g = GAUGE[i] * (wmul || 1);
    const wound = i >= 3 && !lite;
    const base = wound ? (o.wood === 'rosewood' ? [182, 160, 128] : [176, 168, 154]) : [200, 202, 210];
    ctx.globalAlpha = alpha;
    ribbon(ctx, cam, pts, g, cs(cmul(base, (wmul || 1) > 1.5 ? 0.55 : 0.3)), 0.8);       // shadow side / outline
    if (!lite) ribbon(ctx, cam, pts, g * 0.72, cs(cmul(base, 0.82)), 0.55, lightSide * 0.1); // body
    ribbon(ctx, cam, pts, g * 0.26, cs([255, 253, 248]), 0.45, lightSide * 0.26);          // specular line
    if (wound) {
      // winding: diagonal ridges where the string is big enough on screen
      ctx.strokeStyle = cs(cmul(base, 0.32), 0.7);
      ctx.beginPath(); let lwSum = 0, lwN = 0;
      for (let k = 0; k < pts3.length - 1; k++) {
        const a = pts3[k], b = pts3[k + 1]; const len = vlen(vsub(b, a)); const step = g * 0.9; const n = Math.floor(len / step);
        const sc = cam.scaleAt(a); if (sc * g < 3.5 || n > 400) continue; lwSum += sc * g * 0.16; lwN++;
        const dir = vnorm(vsub(b, a)); const side = vnorm(vcross(dir, [0, 0, 1]));
        for (let j = 0; j < n; j++) {
          const c = vadd(a, vmul(dir, j * step)); const p1 = cam.p(vadd(c, vadd(vmul(side, g * 0.42), vmul(dir, g * 0.28)))), p2 = cam.p(vadd(c, vadd(vmul(side, -g * 0.42), vmul(dir, -g * 0.28))));
          if (p1[2] > cam.near && p2[2] > cam.near) { ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); }
        }
      }
      ctx.lineWidth = lwN ? Math.max(0.7, Math.min(2.4, lwSum / lwN)) : 0.8; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  L.fretboard = function (ctx, t, o = {}) {
    const { cam } = fbSetup(o); const PM = profMarks(ctx, 'fret');
    const wood = o.wood || 'maple';
    const light = o.light || {};
    const laz = light.az === undefined ? 2.4 : light.az, lel = light.el === undefined ? 0.75 : light.el;
    const ldir = vnorm([Math.cos(laz) * Math.cos(lel), Math.sin(laz) * Math.cos(lel), Math.sin(lel)]);
    const lcol = hx(light.color || '#fff0d8'), lk = light.k === undefined ? 1 : light.k;
    const amb = hx(o.ambient || '#4a4650');
    const X0 = -60, X1 = 640;
    const rnd = PV.rng(o.seed || 77);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const woodBase = wood === 'maple' ? [226, 186, 118] : [70, 42, 28];
    const lit = cmix(amb, lcol, 0.25 + 0.75 * Math.max(0, ldir[2]) * lk);
    const wcol = cfilt(woodBase, lit);
    const ckey = cam.eye.concat(cam.f, cam.u).map(v => v.toFixed(3)).join(',') + ',' + cam.focal.toFixed(1) + ',' + cam.cx.toFixed(1) + ',' + cam.cy.toFixed(1);
    const bkey = [ckey, wood, o.wear === undefined ? 1 : o.wear, laz.toFixed(3), lel.toFixed(3), light.color || '', lk.toFixed(2), o.ambient || '', o.seed || 77].join('|');
    const board = cachedLayer('fretBoard', bkey, W, H, (fbc) => {
      fbc.lineJoin = 'round'; fbc.lineCap = 'round';
    // neck sides (visible when looking from low angles)
    for (const sd of [-1, 1]) {
      const pts = []; for (let k = 0; k <= 24; k++) { const x = lerp(X0, X1, k / 24); pts.push([x, sd * boardW(Math.max(0, x)) / 2, boardZ(boardW(Math.max(0, x)) / 2)]); }
      const bot = pts.map(p => [p[0], p[1] + sd * 2.5, p[2] - 18]).reverse();
      const n = [0, sd, 0];
      if (!cam.facing([200, sd * 25, -5], n)) continue;
      const pp = cam.poly(pts.concat(bot)); if (!pp) continue;
      const a = cam.p([200, sd * 25, 0]), b = cam.p([200, sd * 27, -18]);
      const g = fbc.createLinearGradient(a[0], a[1], b[0], b[1]);
      const sl = 0.3 + 0.5 * Math.max(0, ldir[1] * sd);
      g.addColorStop(0, cs(cmul(wcol, sl + 0.25))); g.addColorStop(1, cs(cmul(wcol, sl * 0.4)));
      fillP(fbc, pp, g);
      // side dots
      for (const f of [3, 5, 7, 9, 12, 15, 17, 19, 21]) {
        const x = (fretX(f - 1) + fretX(f)) / 2; const c = cam.p([x, sd * (boardW(x) / 2 + 0.3), -2.5]); const r = 1.4 * cam.scaleAt([x, 0, 0]);
        if (c[2] > cam.near && r > 0.6) { fbc.fillStyle = 'rgba(18,14,12,0.85)'; fbc.beginPath(); fbc.arc(c[0], c[1], r, 0, TAU); fbc.fill(); }
      }
    }
    (()=>{})('sides');
    // board face (plus headstock face beyond the nut)
    const face = [];
    for (let k = 0; k <= 30; k++) { const x = lerp(-6, X1, k / 30); face.push([x, boardW(Math.max(0, x)) / 2, boardZ(boardW(Math.max(0, x)) / 2)]); }
    for (let k = 30; k >= 0; k--) { const x = lerp(-6, X1, k / 30); face.push([x, -boardW(Math.max(0, x)) / 2, boardZ(boardW(Math.max(0, x)) / 2)]); }
    const fp = cam.poly(face);
    if (fp) {
      const a = cam.p([300, 30, 0]), b = cam.p([300, -30, 0]);
      const g = fbc.createLinearGradient(a[0], a[1], b[0], b[1]);
      g.addColorStop(0, cs(cmul(wcol, 0.86))); g.addColorStop(0.5, cs(cmul(wcol, 1.04))); g.addColorStop(1, cs(cmul(wcol, 0.84)));
      fillP(fbc, fp, g);
      fbc.save(); fbc.beginPath(); trace(fbc, fp); fbc.clip();
      // grain
      // grain: three batched stroke classes (one path each) — cheap at any camera distance
      const nG = wood === 'maple' ? 46 : 90; const paths = [new Path2D(), new Path2D(), new Path2D()];
      for (let k = 0; k < nG; k++) {
        const y = (rnd() - 0.5) * 56; const x0 = X0 + rnd() * 200, x1 = x0 + 120 + rnd() * 520; const wob = rnd() * 6; const cls = Math.floor(rnd() * 3);
        const pts = []; for (let j = 0; j <= 10; j++) { const x = lerp(x0, x1, j / 10); pts.push([x, y + Math.sin(x * 0.01 + k) * wob * 0.3, boardZ(y) + 0.02]); }
        const lp = cam.line(pts); let pen = false; for (const q of lp) { if (!q) { pen = false; continue; } if (!pen) { paths[cls].moveTo(q[0], q[1]); pen = true; } else paths[cls].lineTo(q[0], q[1]); }
      }
      for (let c2 = 0; c2 < 3; c2++) { fbc.strokeStyle = wood === 'maple' ? cs([150, 96, 40], 0.1 + c2 * 0.06) : cs([20, 10, 6], 0.25 + c2 * 0.12); fbc.lineWidth = wood === 'maple' ? 0.7 + c2 * 0.6 : 0.6 + c2 * 0.4; fbc.stroke(paths[c2]); }
      (()=>{})('face+grain');
      // playing wear on old maple (lacquer worn through, greyish) — first positions, treble side
      if (wood === 'maple' && o.wear !== 0) {
        const wr = PV.rng(31);
        for (let k = 0; k < 26; k++) {
          const f = 1 + Math.floor(Math.pow(wr(), 1.4) * 9); const x = lerp(fretX(f - 1), fretX(f), 0.35 + wr() * 0.5);
          const si = Math.floor(wr() * 5); const y = strY(si, x) + (wr() - 0.5) * 6;
          const c = cam.p([x, y, boardZ(y)]); const r = (3 + wr() * 5) * cam.scaleAt([x, y, 0]); if (c[2] < cam.near || r < 0.5) continue;
          const g2 = fbc.createRadialGradient(c[0], c[1], 0, c[0], c[1], r); g2.addColorStop(0, cs([120, 98, 72], 0.38 * (o.wear || 1))); g2.addColorStop(1, cs([120, 98, 72], 0));
          fbc.save(); fbc.translate(c[0], c[1]); const ax = cam.p([x + 5, y, 0]); fbc.rotate(Math.atan2(ax[1] - c[1], ax[0] - c[0])); fbc.scale(1.6, 0.7); fbc.translate(-c[0], -c[1]);
          fbc.fillStyle = g2; fbc.beginPath(); fbc.arc(c[0], c[1], r, 0, TAU); fbc.fill(); fbc.restore();
        }
      }
      (()=>{})('wear');
      // lacquer sheen: mirrored soft window
      const wc = vadd([300, 0, 0], vmul(ldir, 1600)); const wn = vmul(ldir, -1); let wax = vnorm(vcross(wn, [0, 0, 1])); if (!isFinite(wax[0]) || vlen(wax) < 0.5) wax = [1, 0, 0]; const way = vnorm(vcross(wax, wn));
      const env = { lights: [makeWin(wc, vmul(wax, 520), vmul(way, 420), wn, 2, 2, 0.06, lcol, 3 * lk)], ceil: [40, 40, 40], floor: [10, 10, 10], horizon: [20, 20, 20] };
      const vd = vnorm(vsub([cam.eye[0] - 150, 0, 0], cam.eye)); const fr = 0.05 + 0.95 * Math.pow(1 - Math.abs(vd[2]), 5);
      mirrorLights(fbc, cam, env, [0, 0, 1], 0, fp, wood === 'maple' ? 0.2 : 0.14, Math.min(0.6, fr * 1.4));
      fbc.restore();
    }
    (()=>{})('sheen');
    // dots
    const dotsF = [3, 5, 7, 9, 15, 17, 19, 21];
    const dot = (x, y) => {
      const pts = []; for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; pts.push([x + Math.cos(a) * 3, y + Math.sin(a) * 3, boardZ(y) + 0.03]); }
      const pp = cam.poly(pts); if (!pp) return;
      fillP(fbc, pp, wood === 'maple' ? 'rgba(20,16,14,0.92)' : cs(cadd([226, 222, 214], lcol, 0.1)));
      if (wood !== 'maple') { fbc.save(); fbc.clip(); const c = cam.p([x - 1, y + 1, 0]); const g = fbc.createRadialGradient(c[0], c[1], 0, c[0], c[1], 6 * cam.scaleAt([x, y, 0])); g.addColorStop(0, 'rgba(255,240,250,0.6)'); g.addColorStop(1, 'rgba(180,200,230,0)'); fbc.fillStyle = g; fbc.fillRect(c[0] - 400, c[1] - 400, 800, 800); fbc.restore(); }
    };
    for (const f of dotsF) dot((fretX(f - 1) + fretX(f)) / 2, 0);
    { const x = (fretX(11) + fretX(12)) / 2; dot(x, 11); dot(x, -11); }
    // nut
    {
      const nw = boardW(0) / 2 + 0.5;
      drawHex(fbc, cam, [[-5, -nw, -0.5], [0, -nw, -0.5], [0, nw, -0.5], [-5, nw, -0.5], [-5, -nw, 3.4], [0, -nw, 3.4], [0, nw, 3.4], [-5, nw, 3.4]],
        (nr) => cs(cfilt([236, 226, 200], cmix(amb, lcol, 0.35 + 0.6 * Math.max(0, vdot(nr, ldir))))));
    }
    (()=>{})('dots+nut');
    // frets: shadow, body, crown highlight
    const sh = [-ldir[0] / Math.max(0.2, ldir[2]), -ldir[1] / Math.max(0.2, ldir[2])];
    for (let n = 21; n >= 1; n--) {
      const x = fretX(n); const hw = boardW(x) / 2 - 0.4;
      const seg = 10; const top = [], botA = [], shd = [];
      for (let k = 0; k <= seg; k++) { const y = lerp(-hw, hw, k / seg); top.push([x, y, boardZ(y) + 1.15]); }
      // shadow on board
      const sp = []; for (const p of top) sp.push([p[0] + sh[0] * 1.15, p[1] + sh[1] * 1.15, boardZ(p[1]) + 0.01]);
      const spp = []; for (let k = 0; k <= seg; k++) spp.push([x + sh[0] * 1.2 + Math.sign(sh[0] || 1) * 1.6, top[k][1], boardZ(top[k][1]) + 0.01]);
      const shp = cam.poly(sp.concat(spp.reverse()));
      fillP(fbc, shp, `rgba(30,18,8,${0.32})`);
      // grime line both sides
      for (const s2 of [-1.6, 1.6]) { const gl = cam.line(top.map(p => [p[0] + s2, p[1], boardZ(p[1]) + 0.02])); strokeL(fbc, gl, wood === 'maple' ? 'rgba(90,60,30,0.22)' : 'rgba(0,0,0,0.3)', Math.max(0.6, 0.9 * cam.scaleAt([x, 0, 0]))); }
      // fret wire: half-round crown (2.4 x 1.15 mm) shaded facet by facet from a small environment —
      // the bottom reflects the warm board, the top the room, a hard specular where it mirrors the light
      const fa = 1.2, fb = 1.15, K = 8, S2 = 8;
      const crown = (th, y) => [x + fa * Math.cos(th), y, boardZ(y) + 0.04 + fb * Math.sin(th)];
      const nrmAt = (th, y) => vnorm([fb * Math.cos(th), (2 * y / 482) * fa * Math.sin(th), fa * Math.sin(th)]);
      const metal = (th, y) => {
        const P3 = crown(th, y), nr = nrmAt(th, y); const vd = vnorm(vsub(P3, cam.eye)); const R = reflect(vd, nr);
        const spec = Math.pow(Math.max(0, vdot(R, ldir)), 48) * 2.4 * lk + Math.pow(Math.max(0, vdot(R, ldir)), 6) * 0.35 * lk;
        const envc = R[2] < 0 ? cmul(wcol, 0.62) : cmix(cmix(cmul(amb, 0.8), [150, 150, 158], 0.45), cmix(cmix(amb, lcol, 0.6), [236, 236, 242], 0.35), Math.min(1, R[2] * 1.5));
        const dif = Math.max(0, vdot(nr, ldir)) * 0.18;
        return cadd(cadd(cmul(cfilt(envc, [226, 226, 232]), 1.0), cmix(amb, lcol, 0.5), dif), lcol, spec);
      };
      for (let k = 0; k < K; k++) {
        const t0 = Math.PI * k / K, t1 = Math.PI * (k + 1) / K, tm = (t0 + t1) / 2;
        if (!cam.facing(crown(tm, 0), nrmAt(tm, 0))) continue;
        const A2 = [], B2 = []; for (let q = 0; q <= S2; q++) { const y = lerp(-hw, hw, q / S2); A2.push(crown(t0, y)); B2.push(crown(t1, y)); }
        const pp = cam.poly(A2.concat(B2.reverse())); if (!pp) continue;
        const pa = cam.p(crown(tm, -hw)), pm = cam.p(crown(tm, 0)), pb = cam.p(crown(tm, hw));
        const g = fbc.createLinearGradient(pa[0], pa[1], pb[0], pb[1]);
        g.addColorStop(0, cs(metal(tm, -hw))); g.addColorStop(0.5, cs(metal(tm, 0))); g.addColorStop(1, cs(metal(tm, hw)));
        void pm; fillP(fbc, pp, g);
      }
    }
    });
    ctx.drawImage(board, 0, 0);
    const sh = [-ldir[0] / Math.max(0.2, ldir[2]), -ldir[1] / Math.max(0.2, ldir[2])];
    PM('frets');
    // strings
    const vib = o.vibrate || [];
    const snap = o.snap; const snapS = snap ? (snap.string || 0) : -1;
    const pressF = o.press || {};
    const lightSide = Math.sign(ldir[1]) || 1;
    const order = [0, 1, 2, 3, 4, 5].sort((a, b) => cam.depth([300, strY(b, 300), 2]) - cam.depth([300, strY(a, 300), 2]));
    for (const i of order) {
      if (i === snapS && snap.p >= 0) continue;
      const pf = pressF[i]; const xa = pf ? fretX(pf) : 0;
      const A = (vib[i] || 0) * (1.6 - i * 0.05);
      const bq = snap ? clamp((snap.p + 1) / 0.92) : 0;
      const bend = (i === snapS && snap.p < 0) ? (snap.bend === undefined ? 8 : snap.bend) * (bq * bq * (3 - 2 * bq)) * (1 + 0.04 * Math.sin(t * 71) * bq * bq) : 0;
      const bx = snap ? fretX(snap.at || (o.focus || 12)) - 4 : 0;
      const mk = (phase) => {
        const pts = [];
        const N = 90;
        for (let k = 0; k <= N; k++) {
          const x = lerp(-4, X1, Math.pow(k / N, 1));
          let y = strY(i, x), z = strZ(i, x);
          if (pf && x < xa) z -= 1.1 * (x / xa); // fretted: pressed down toward the fret
          if (A > 0 && x > xa) y += A * Math.sin(Math.PI * clamp((x - xa) / (SCALE_LEN - xa))) * Math.cos(phase);
          if (bend) y -= bend * Math.pow(x < bx ? clamp(x / bx) : clamp((SCALE_LEN - x) / (SCALE_LEN - bx)), 5);
          pts.push([x, y, z]);
        }
        return pts;
      };
      // shadow on the board
      const shp = mk(t * 40 + i).map(p => [p[0] + sh[0] * (p[2] - boardZ(p[1])), p[1] + sh[1] * (p[2] - boardZ(p[1])), boardZ(p[1]) + 0.05]);
      ctx.globalAlpha = 0.28; ribbon(ctx, cam, cam.line(shp), GAUGE[i] * 1.6, 'rgb(25,14,6)', 0.6); ctx.globalAlpha = 1;
      if (A > 0.02) {
        const w = 2 * Math.PI * (82 * Math.pow(1.335, 5 - i));
        for (let k = 0; k < 2; k++) drawString(ctx, cam, mk(w * t + k * 3.1), i, o, 0.55, lightSide, true);
        // envelope haze
        const env1 = mk(0), env2 = mk(Math.PI);
        const e1 = cam.line(env1), e2 = cam.line(env2).reverse();
        const poly = e1.concat(e2).filter(Boolean);
        if (poly.length > 4) fillP(ctx, poly, cs([210, 210, 220], 0.1 * Math.min(1, A)));
      } else drawString(ctx, cam, mk(0), i, o, 1, lightSide);
    }
    // the snapping string
    if (snap && snap.p >= 0) drawSnap(ctx, cam, t, o, snap, lightSide, sh);
    ctx.restore();
    PM('end');
    return { cam };
  };

  function drawSnap(ctx, cam, t, o, snap, lightSide, sh) {
    const i = snap.string || 0, p = clamp(snap.p);
    const xb = fretX(snap.at || (o.focus || 12)) - 4;
    const ease = q => 1 - Math.pow(1 - clamp(q), 3);
    const half = (dir, q) => {
      // dir -1: nut-side half (anchor at the nut), +1: bridge-side half. The free end recoils a little,
      // lifts off the board toward the viewer, whips sideways and rolls into a tightening curl.
      const e = ease(q);
      const anchor = dir < 0 ? -4 : SCALE_LEN;
      const free = xb + dir * (dir < 0 ? 52 : 62) * e;
      const lift = 20 * Math.sin(Math.min(1, q * 2.4) * Math.PI * 0.5) * (1 - 0.4 * clamp((q - 0.45) * 1.8));
      const sway = (dir < 0 ? 1 : -1) * 10 * Math.sin(q * 10 + (dir < 0 ? 0.3 : 1.9)) * Math.exp(-q * 2.0);
      const bendRem = (snap.bend === undefined ? 8 : snap.bend) * (1 - e);
      const pts = []; const N = 90;
      for (let k = 0; k <= N; k++) {
        const s2 = k / N; const x = lerp(anchor, free, Math.pow(s2, 0.6));
        const wgt = sstep(0, 1, 1 - Math.abs(x - free) / 75);
        pts.push([x, strY(i, x) + sway * wgt - bendRem * wgt, strZ(i, x) + lift * wgt * wgt]);
      }
      // curl from the free end: spiral rolling back over itself
      let pt = pts[pts.length - 1].slice(); const turns = 1.3 + 1.9 * e; const L0 = 20 + 34 * e; const nC = 40;
      for (let k = 1; k <= nC; k++) {
        const u = k / nC; const ang = turns * Math.PI * u * u; const step = L0 / nC * (1 - 0.45 * u);
        pt = [pt[0] - dir * Math.cos(ang) * step, pt[1] + Math.sin(ang) * step * (dir < 0 ? 1 : -1) * 0.8, pt[2] + Math.sin(ang * 0.5 + 0.3) * step * 0.9];
        pts.push(pt.slice());
      }
      return pts;
    };
    // motion smear between the previous and the current pose, then glowing ghosts, then the two whipping ends
    // (drawn at an exaggerated gauge: the real 0.25 mm wire would vanish in the flash)
    const wv = snap.width === undefined ? 3 : snap.width;
    const lastQ = p, prevQ = Math.max(0, p - 0.07);
    if (p > 0.004) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const dir of [-1, 1]) {
        const a = cam.line(half(dir, lastQ)).filter(Boolean), b = cam.line(half(dir, prevQ)).filter(Boolean);
        if (a.length > 3 && b.length > 3) {
          const k0 = Math.floor(a.length * 0.45);
          const poly = a.slice(k0).concat(b.slice(Math.floor(b.length * 0.45)).reverse());
          const fa2 = 0.2 * (1 - clamp(p / 0.6));
          if (fa2 > 0.005) fillP(ctx, poly, `rgba(255,236,214,${fa2.toFixed(3)})`);
        }
      }
      ctx.restore();
    }
    for (const [dq, al] of [[0.09, 0.14], [0.05, 0.24], [0.022, 0.4], [0, 1]]) {
      const q = p - dq; if (q < 0) continue;
      for (const dir of [-1, 1]) {
        const pts3 = half(dir, q);
        if (al === 1) { // hot glow around the live wire
          const glowA = 0.55 * (1 - clamp(p / 0.9)) + 0.12;
          const lp = cam.line(pts3); const tip = pts3[pts3.length - 1]; const wpx = GAUGE[i] * wv * cam.scaleAt(tip);
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = glowA;
          strokeL(ctx, lp, 'rgba(255,206,160,0.22)', Math.max(4, wpx * 5));
          strokeL(ctx, lp, 'rgba(255,236,214,0.45)', Math.max(2, wpx * 2.2));
          ctx.restore();
        }
        drawString(ctx, cam, pts3, i, o, al, lightSide, al < 1, wv);
      }
    }
    // flash at the break point
    const bp = cam.p([xb, strY(i, xb), strZ(i, xb)]);
    const sc = cam.scaleAt([xb, 0, 0]);
    const f = Math.pow(clamp(1 - p / 0.22), 2);
    if (f > 0 && bp[2] > cam.near) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const R = 90 * sc * (0.6 + 0.4 * f);
      let g = ctx.createRadialGradient(bp[0], bp[1], 0, bp[0], bp[1], R);
      g.addColorStop(0, `rgba(255,252,240,${0.95 * f})`); g.addColorStop(0.12, `rgba(255,232,190,${0.6 * f})`); g.addColorStop(0.4, `rgba(255,190,150,${0.18 * f})`); g.addColorStop(1, 'rgba(255,170,120,0)');
      ctx.fillStyle = g; ctx.fillRect(bp[0] - R, bp[1] - R, R * 2, R * 2);
      // starburst: tapered needles of uneven length (not a uniform asterisk) + an anamorphic streak
      const rr = PV.rng(5150); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 14; k++) {
        const a = k / 14 * TAU + (rr() - 0.5) * 0.35 + 0.2; const len = (0.25 + Math.pow(rr(), 1.6) * 0.95) * 230 * sc * (0.5 + 0.5 * f); const w0 = (1.2 + rr() * 2.2) * sc * 0.18 * f;
        const ca = Math.cos(a), sa = Math.sin(a);
        const gx = ctx.createLinearGradient(bp[0], bp[1], bp[0] + ca * len, bp[1] + sa * len); gx.addColorStop(0, `rgba(255,248,232,${0.85 * f})`); gx.addColorStop(1, 'rgba(255,220,180,0)');
        ctx.fillStyle = gx; ctx.beginPath(); ctx.moveTo(bp[0] - sa * w0, bp[1] + ca * w0); ctx.lineTo(bp[0] + ca * len, bp[1] + sa * len); ctx.lineTo(bp[0] + sa * w0, bp[1] - ca * w0); ctx.closePath(); ctx.fill();
      }
      ctx.save(); ctx.translate(bp[0], bp[1]); ctx.scale(1, 0.035); g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.6); g.addColorStop(0, `rgba(255,240,226,${0.7 * f})`); g.addColorStop(1, 'rgba(255,200,170,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, W * 0.6, 0, TAU); ctx.fill(); ctx.restore();
      ctx.restore();
    }
    // sparks
    if (bp[2] > cam.near && p < 0.5) {
      const r = PV.rng(911); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
      for (let k = 0; k < 22; k++) {
        const a = r() * TAU, sp = (0.4 + r()) * 520 * sc / 20, life = 0.18 + r() * 0.3; const q = p / life; if (q >= 1) continue;
        const d = sp * 60 * (1 - Math.pow(1 - q, 2)) * 0.3; const x = bp[0] + Math.cos(a) * d, y = bp[1] + Math.sin(a) * d + q * q * 30 * sc / 10;
        const tl = Math.max(2, 18 * (1 - q) * sc / 6);
        ctx.strokeStyle = `rgba(255,${200 + r() * 55 | 0},${140 + r() * 80 | 0},${(1 - q) * 0.9})`; ctx.lineWidth = Math.max(0.8, 1.6 * (1 - q));
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * tl, y - Math.sin(a) * tl); ctx.stroke();
      }
      ctx.restore();
    }
    // speed lines (集中線)
    if (snap.lines !== false && p > 0.0 && p < 0.42) {
      const al = Math.sin(clamp(p / 0.42) * Math.PI) * 0.5;
      const r = PV.rng(73); ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let k = 0; k < 70; k++) {
        const a = r() * TAU, r0 = (0.3 + r() * 0.25) * W, r1 = r0 + (0.25 + r() * 0.6) * W; const w = 1.5 + r() * 3.5; const aa = al * (0.35 + r() * 0.5);
        const ca = Math.cos(a), sa = Math.sin(a);
        // tapered wedge: needle tip toward the impact point
        ctx.fillStyle = `rgba(255,250,240,${aa.toFixed(3)})`; ctx.beginPath();
        ctx.moveTo(bp[0] + ca * r0, bp[1] + sa * r0); ctx.lineTo(bp[0] + ca * r1 - sa * w, bp[1] + sa * r1 + ca * w); ctx.lineTo(bp[0] + ca * r1 + sa * w, bp[1] + sa * r1 - ca * w); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ======================================================================
   * CURTAIN — sheer white cloth, pleats + wind, back-lit translucency
   * map(u,v,w) -> world point; u 0..1 across panel, v 0..1 rail->hem, w = offset into room (m)
   * ====================================================================== */
  function curtainShape(o, t) {
    const folds = o.folds || 7, depth = o.depth === undefined ? 0.05 : o.depth, wind = o.wind || 0, seed = o.seed || 1;
    const ph = PV.rand1(seed, 3) * 10, side = o.windSide || 1;
    return function (u, v) {
      const gather = o.gather === undefined ? 0 : o.gather; // 0 even, -1/1 gathered to left/right
      const ug = gather ? Math.pow(u, gather > 0 ? 0.75 : 1.35) : u;
      const irr = 0.35 * PV.noise2(ug * 3.1 + seed, v * 0.6) + 0.12 * Math.sin(ug * 23 + ph * 2);
      // fold spacing & depth vary along the rail (a phase warp + per-fold amplitude), so the pleats stop reading as stripes
      const warpPh = 1.9 * PV.noise2(ug * 2.1 + seed * 3.3, 0.5 + v * 0.35), amp = 0.5 + 0.6 * Math.abs(PV.noise2(ug * 3.7 + 0.3, seed + 1.3 + v * 0.2));
      let w = depth * (0.55 + 0.45 * v * 0.6) * amp * Math.sin(ug * folds * Math.PI * 2 + ph + irr * 2.2 + warpPh);
      let dx = 0, dy = 0;
      if (wind > 0) {
        const gust = 0.55 + 0.45 * (0.5 + 0.5 * PV.noise2(seed * 7.1, t * 0.42));
        const g2 = wind * gust;
        const prof = Math.sin(Math.PI * (0.12 + 0.88 * u));
        const wave = Math.sin(v * 5.5 - t * 2.6 + u * 3 + ph);
        w += g2 * Math.pow(v, 1.25) * (0.45 * prof + 0.15) + g2 * 0.07 * wave * v;
        dx = side * g2 * Math.pow(v, 1.5) * (0.38 + 0.22 * Math.sin(t * 1.25 + u * 2.4 + ph)) * (0.45 + 0.55 * u) + g2 * 0.05 * Math.sin(v * 4 - t * 2.1 + u * 5 + ph) * v;
        dy = -g2 * v * v * (0.22 + 0.08 * Math.sin(t * 1.6 + ph));
      } else {
        w += 0.006 * Math.sin(t * 0.9 + u * 6 + ph) * v;
      }
      return [dx, dy, w];
    };
  }
  /* draw one curtain panel. o: {x0,x1 (panel extent, world, along rail), yTop, yHem, z0, axis:'x', folds, depth, wind, windSide,
   *  color, back (light behind 0..1 or fn(u)), front (front light 0..1), edge, seed, gather}  cam: projector */
  function drawCurtainPanel(ctx, cam, t, o) {
    const shape = curtainShapeOverride || curtainShape(o, t);
    const N = o.strips || 34, M = o.rows || 16;
    const col = hx(o.color || '#fbfaf6'), dark = hx(o.shade || '#9aa6bd');
    const width = Math.abs(o.x1 - o.x0);
    const toP = (u, v, d) => { const x = lerp(o.x0, o.x1, u) + d[0]; const y = lerp(o.yTop, o.yHem, v) + d[1] + (o.hemLift || 0) * v * v; return o.toWorld ? o.toWorld(x, y, o.z0 + d[2]) : [x, y, o.z0 + d[2]]; };
    // evaluate the cloth once on an (N+1) x (M+1) grid (the old code re-evaluated every column twice + every shading sample)
    const D = [], PW = [], SP = [];
    for (let i = 0; i <= N; i++) { const u = i / N, dc = [], pc = []; for (let j = 0; j <= M; j++) { const d = shape(u, j / M); dc.push(d); pc.push(toP(u, j / M, d)); } D.push(dc); PW.push(pc); SP.push(pc.map(p => cam.p(p))); }
    const slopeIJ = (i, j) => { const a = D[Math.max(0, i - 1)][j][2], b = D[Math.min(N, i + 1)][j][2]; return (b - a) / (((Math.min(N, i + 1) - Math.max(0, i - 1)) / N) * width); };
    const backL = typeof o.back === 'function' ? o.back : () => (o.back === undefined ? 0.8 : o.back);
    const frontL = o.front === undefined ? 0.5 : o.front;
    const shadeIJ = (i, j, sl) => {
      const s = sl === undefined ? slopeIJ(i, j) : sl; const dens = clamp(Math.abs(s) * 1.6); const u = i / N, v = j / M;
      const bk = backL(u, v, lerp(o.x0, o.x1, u)); const fold = 0.5 + 0.5 * Math.sin(Math.atan(s) * 1.8);
      const lum = bk * (1.0 - 0.62 * dens) + frontL * (0.2 + 0.6 * fold);
      return cmix(dark, col, clamp(lum * 0.9 + 0.05));
    };
    if (SP.some(c2 => c2.some(p => p[2] < cam.near))) { /* behind the camera: fall back to the clipped projector */ }
    const jT = Math.round(M * 0.05), jM = Math.round(M * 0.5), jB = Math.round(M * 0.95);
    for (let i = 0; i < N; i++) {
      const left = PW[i], right = PW[i + 1];
      let pts = null;
      if (left.every(p => cam.depth(p) > cam.near) && right.every(p => cam.depth(p) > cam.near)) {
        // screen-space polygon; the right edge is nudged 0.5 px outward to hide anti-aliasing seams between strips
        const L2 = SP[i], R2 = SP[i + 1]; pts = [];
        for (let j = 0; j <= M; j++) pts.push([L2[j][0], L2[j][1]]);
        for (let j = M; j >= 0; j--) { const dx = R2[j][0] - L2[j][0], dy = R2[j][1] - L2[j][1], l = Math.hypot(dx, dy) || 1; pts.push([R2[j][0] + dx / l * 0.5, R2[j][1] + dy / l * 0.5]); }
      } else pts = cam.poly(left.concat(right.slice().reverse()));
      if (!pts) continue;
      let g;
      if (o.smooth) {
        // narrow strips: a flat colour per strip (mean of its two edges) is visually identical to a per-strip
        // gradient and fills several times faster
        g = cs(cmix(shadeIJ(i, jM), shadeIJ(i + 1, jM), 0.5));
      } else {
        const pa = SP[i][0], pb = SP[i][M]; const sl = j2 => (D[i + 1][j2][2] - D[i][j2][2]) / (width / N);
        g = ctx.createLinearGradient(pa[0], pa[1], pb[0], pb[1]);
        g.addColorStop(0, cs(cmul(shadeIJ(i, jT, sl(jT)), 0.92))); g.addColorStop(0.5, cs(shadeIJ(i, jM, sl(jM)))); g.addColorStop(1, cs(shadeIJ(i, jB, sl(jB))));
      }
      fillP(ctx, pts, g);
    }
    if (o.smooth) {
      // vertical modelling: rail shadow at the top, soft fall-off at the hem
      const outline = []; for (let i = 0; i <= N; i++) outline.push(PW[i][0]); for (let i = N; i >= 0; i--) outline.push(PW[i][M]);
      const op = cam.poly(outline);
      if (op) { const a = cam.p(PW[N >> 1][0]), b = cam.p(PW[N >> 1][M]); const vg = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); vg.addColorStop(0, cs(dark, 0.45)); vg.addColorStop(0.12, cs(dark, 0.0)); vg.addColorStop(0.75, cs(dark, 0.0)); vg.addColorStop(1, cs(dark, 0.25)); fillP(ctx, op, vg); }
    }
    // hem & edge lines
    if (o.edge !== false) {
      const hem = [], ed0 = [], ed1 = [];
      for (let i = 0; i <= N; i++) hem.push(PW[i][M]);
      for (let j = 0; j <= M; j++) { ed0.push(PW[0][j]); ed1.push(PW[N][j]); }
      const lw = Math.max(0.8, 0.006 * cam.scaleAt(PW[N >> 1][Math.round(M * 0.8)]));
      strokeL(ctx, cam.line(hem), cs(cmul(dark, 0.85), 0.55), lw);
      strokeL(ctx, cam.line(o.edgeSide === 0 ? ed0 : ed1), cs(cmul(dark, 0.9), 0.35), lw * 0.8);
      // rail heading (gathered top band)
      const top = []; for (let i = 0; i <= N; i++) top.push(toP(i / N, 0.012, shape(i / N, 0.012)));
      strokeL(ctx, cam.line(top), cs(cmul(dark, 0.8), 0.5), lw * 1.6);
    }
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; for (const c2 of SP) for (const p of c2) { if (p[2] < cam.near) continue; if (p[0] < bx0) bx0 = p[0]; if (p[1] < by0) by0 = p[1]; if (p[0] > bx1) bx1 = p[0]; if (p[1] > by1) by1 = p[1]; }
    return [bx0, by0, bx1, by1];
  }
  L._curtainPanel = drawCurtainPanel;

  /* raindrops on glass (screen-space inside clip). o: {x,y,w,h,density,t,light} */
  function glassDrops(ctx, t, o) {
    const r = PV.rng(o.seed || 401); const n = Math.round((o.density === undefined ? 1 : o.density) * o.w * o.h / 2600);
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = o.x + r() * o.w, y0 = o.y + r() * o.h; const s = (0.6 + Math.pow(r(), 3) * 2.4) * (o.scale || 1);
      const runner = r() < 0.12; let y = y0;
      if ((o.only === 'static' && runner) || (o.only === 'runners' && !runner)) { r(); r(); r(); continue; }
      if (runner) {
        const sp = 40 + r() * 120, per = (o.h + 200) / sp, ph = r() * per; const k = ((t + ph) % per) / per; y = o.y - 60 + k * (o.h + 120);
        // trail
        const g = ctx.createLinearGradient(x, y - 120 * s, x, y); g.addColorStop(0, 'rgba(220,230,245,0)'); g.addColorStop(1, 'rgba(220,230,245,0.28)');
        ctx.strokeStyle = g; ctx.lineWidth = s * 1.3; ctx.beginPath(); ctx.moveTo(x + Math.sin(y * 0.05) * 2, y - 120 * s); ctx.lineTo(x, y); ctx.stroke();
      }
      const rr = s * (runner ? 3.2 : 2.2), sq = 1.02 + (runner ? 0.25 : 0.12 * (i % 3));
      // a drop is a tiny lens: the scene upside down — dark ground on top, bright sky in the lower half — plus one glint
      ctx.fillStyle = 'rgba(210,222,238,0.16)'; ctx.beginPath(); ctx.ellipse(x, y, rr, rr * sq, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(34,42,58,0.34)'; ctx.beginPath(); ctx.ellipse(x, y - rr * 0.12, rr * 0.92, rr * sq * 0.78, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(238,244,252,0.5)'; ctx.beginPath(); ctx.ellipse(x + rr * 0.05, y + rr * sq * 0.42, rr * 0.6, rr * 0.34, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(x - rr * 0.38, y - rr * 0.42, Math.max(0.5, rr * 0.16), Math.max(0.4, rr * 0.11), -0.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  L._glassDrops = glassDrops;

  /* ======================================================================
   * MUSIC ROOM — 3-D room in metres; x along room (0..14), y up, z from the window wall (0) into the room (..9)
   * ====================================================================== */
  const RM = { Lx: 14, Dz: 9, Hy: 3.0, sill: 0.86, wTop: 2.3, trTop: 2.8, wallT: 0.18 };
  const BAYS = [0, 1, 2, 3].map(k => [1.3 + k * 3.1, 1.3 + k * 3.1 + 2.5]);
  const ROOM_TIME = {
    noon: { lv: { win: 0.5, side: 0.72, back: 0.95, ceil: 0.62, floor: 0.7 }, sky: [[0, '#4f93df'], [0.5, '#8cc0ec'], [1, '#d6eaf7']], sun: [0.55, -0.56, 0.62], sunCol: '#fff1d4', wall: '#f3e2c9', wallDark: '#b49c84', floor: '#c9a77d', ceil: '#ece2d4', frame: '#c6c9cc', curtain: '#fcfbf7', curtainShade: '#a7b0c2', shaft: 0.2, patch: 0.6, tint: '#fff4de', tintAmt: 0.12, outside: 'spring' },
    rain: { lv: { win: 0.62, side: 0.72, back: 0.85, ceil: 0.6, floor: 0.66 }, sky: [[0, '#69768b'], [0.6, '#8e9aab'], [1, '#aeb8c4']], sun: null, sunCol: '#c9d4e2', wall: '#8a97ab', wallDark: '#4a5568', floor: '#6c6a6c', ceil: '#7c8796', frame: '#9aa3ae', curtain: '#cfd5df', curtainShade: '#5d6a80', shaft: 0, patch: 0, tint: '#9fb0c8', tintAmt: 0.18, outside: 'rain' },
    dusk: { lv: { win: 0.48, side: 0.68, back: 0.95, ceil: 0.55, floor: 0.66 }, sky: [[0, '#47457e'], [0.42, '#c9708c'], [0.72, '#f6a35c'], [1, '#ffd894']], sun: [-0.5, -0.2, 0.84], sunCol: '#ffb069', wall: '#e3b08e', wallDark: '#86566a', floor: '#a86c4c', ceil: '#a07478', frame: '#b29690', curtain: '#ffe0c8', curtainShade: '#9a6a7c', shaft: 0.24, patch: 0.65, tint: '#ffc690', tintAmt: 0.15, outside: 'dusk' },
  };
  function roomCam(o) {
    const view = o.view || 'windows'; let eye, tgt, fov;
    const cx = o.camX || 0, cy = o.camY || 0, cz = o.camZ || 0;
    if (view === 'room') { eye = [0.9 + cz, 1.32 + cy, 5.4 + cx]; tgt = [14, 1.2 + (o.lookY || 0) + cy * 0.5, 3.4 + cx * 0.85 + (o.lookX || 0)]; fov = 66; }
    else { eye = [7.4 + cx, 1.22 + cy, 8.4 + cz]; tgt = [7.4 + cx * 0.85 + (o.lookX || 0), 1.34 + (o.lookY || 0) + cy * 0.5, 0]; fov = 64; }
    if (o.cam) { eye = o.cam.eye || eye; tgt = o.cam.target || tgt; fov = o.cam.fov || fov; }
    const focal = (W / 2) / Math.tan(fov * Math.PI / 360) * (o.zoom || 1);
    return makeCam(eye, tgt, focal, W / 2, H / 2, o.roll || 0, 0.05);
  }
  // window light environment (room coords) for glossy objects placed in the room
  function roomEnv(P) {
    const lights = []; const col = hx(P.sunCol); const k = P.sun ? 6.5 : 2.6;
    for (const [x0, x1] of BAYS) {
      const xm = (x0 + x1) / 2, ym = (RM.sill + RM.wTop) / 2;
      lights.push(makeWin([xm, ym, -0.08], [(x1 - x0) / 2 - 0.03, 0, 0], [0, (RM.wTop - RM.sill) / 2, 0], [0, 0, 1], 2, 2, 0.04, cmix(col, hx(P.sky[1][1]), 0.25), k));
      lights.push(makeWin([xm, (RM.wTop + RM.trTop) / 2 + 0.04, -0.08], [(x1 - x0) / 2 - 0.03, 0, 0], [0, (RM.trTop - RM.wTop) / 2 - 0.06, 0], [0, 0, 1], 2, 1, 0.05, cmix(col, hx(P.sky[0][1]), 0.3), k * 0.9));
    }
    if (P.sun && P.patch > 0) {
      const sd = vnorm(P.sun); const toF = p => { const k = -p[1] / sd[1]; return [p[0] + sd[0] * k, 0.003, p[2] + sd[2] * k]; };
      const pc = cfilt(hx(P.sunCol), hx(P.floor));
      for (const [x0, x1] of BAYS) for (const [a, b] of [[x0 + 0.06, (x0 + x1) / 2 - 0.03], [(x0 + x1) / 2 + 0.03, x1 - 0.06]]) {
        const p00 = toF([a, RM.sill + 0.06, -0.06]), p10 = toF([b, RM.sill + 0.06, -0.06]), p01 = toF([a, RM.wTop - 0.04, -0.06]);
        const ax = vmul(vsub(p10, p00), 0.5), ay = vmul(vsub(p01, p00), 0.5); const c = vadd(p00, vadd(ax, ay));
        const w = makeWin(c, ax, ay, [0, 1, 0], 1, 1, 0.0, pc, 2.2 * P.patch); w.floorPatch = true; lights.push(w);
      }
    }
    const wall = hx(P.wall);
    // the room as seen in the lacquer: lit walls / ceiling / floor at roughly their painted values
    return { lights, ceil: cmul(hx(P.ceil), 0.62), floor: cmul(hx(P.floor), 0.55), horizon: cmul(wall, 0.72) };
  }
  // convex hull (2-D)
  function hull(pts) {
    const p = pts.filter(Boolean).slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  function pointInPoly(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) c = !c; } return c; }

  // small keyed layer cache (2 entries per slot) for static artwork that depends on camera/time
  const LCACHE = {};
  function cachedLayer(slot, key, w, h, draw, maxN = 2) {
    const e = LCACHE[slot] || (LCACHE[slot] = []);
    const hit = e.find(x => x.key === key); if (hit) return hit.canvas;
    const ent = e.length >= maxN ? e.shift() : { canvas: PV.makeCanvas(w, h).canvas };
    if (ent.canvas.width !== w || ent.canvas.height !== h) { ent.canvas.width = w; ent.canvas.height = h; }
    ent.key = key; const c = ent.canvas.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.clearRect(0, 0, w, h);
    draw(c); e.push(ent); return ent.canvas;
  }
  function drawCanvas(ctx, cv, alpha = 1, op) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; if (op) ctx.globalCompositeOperation = op; ctx.drawImage(cv, 0, 0, W, H); ctx.restore(); }
  L._cachedLayer = cachedLayer;

  // painterly tree crown (cherry / foliage) — used by the window views: a few big irregular clumps
  // (noise-deformed masses) in 3 values — shadow mass, mid clumps offset toward the light, lit caps —
  // plus sparse flecks, the way BG painters block distant trees (the old 320 small discs read as foam)
  function paintTree(c, x, y, R, pal, seed) {
    const r = PV.rng(seed);
    c.strokeStyle = cs(pal.trunk); c.lineCap = 'round';
    c.lineWidth = R * 0.09; c.beginPath(); c.moveTo(x, y + R * 1.6); c.quadraticCurveTo(x + R * 0.05, y + R * 0.6, x - R * 0.05, y); c.stroke();
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.2; c.lineWidth = R * 0.035; c.beginPath(); c.moveTo(x, y + R * 0.3); c.quadraticCurveTo(x + Math.cos(a) * R * 0.4, y + Math.sin(a) * R * 0.3, x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.55); c.stroke(); }
    const blob = (cx, cy, rr, sd, col) => { c.fillStyle = col; c.beginPath(); for (let i2 = 0; i2 <= 30; i2++) { const a = i2 / 30 * TAU; const nn = PV.noise2(Math.cos(a) * 1.4 + sd, Math.sin(a) * 1.4 + sd * 0.7); const rad = rr * (0.8 + 0.26 * nn + 0.05 * Math.sin(a * 9 + sd)); const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad * 0.82; if (i2) c.lineTo(px, py); else c.moveTo(px, py); } c.closePath(); c.fill(); };
    const clumps = []; for (let k = 0; k < 10; k++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.55; clumps.push([x + Math.cos(a) * d, y - R * 0.18 + Math.sin(a) * d * 0.62, R * (0.3 + r() * 0.2), r() * 50]); }
    clumps.sort((a, b) => a[1] - b[1]);
    for (const [cx, cy, rr, sd] of clumps) blob(cx + rr * 0.08, cy + rr * 0.1, rr * 1.06, sd, cs(pal.dark));
    for (const [cx, cy, rr, sd] of clumps) blob(cx - rr * 0.14, cy - rr * 0.16, rr * 0.8, sd + 3.1, cs(pal.mid));
    for (const [cx, cy, rr, sd] of clumps) if (cy < y + R * 0.1) blob(cx - rr * 0.3, cy - rr * 0.34, rr * 0.42, sd + 6.3, cs(pal.lit, 0.92));
    for (let k = 0; k < 46; k++) { const L0 = clumps[k % clumps.length]; const a = r() * TAU, d = (0.6 + r() * 0.5) * L0[2]; c.fillStyle = cs(r() < 0.6 ? pal.lit : pal.mid, 0.85); c.beginPath(); c.ellipse(L0[0] + Math.cos(a) * d, L0[1] + Math.sin(a) * d * 0.8, R * (0.015 + r() * 0.02), R * (0.01 + r() * 0.012), r() * 3, 0, TAU); c.fill(); }
  }
  function outsideScenery(c, P, shift) {
    const kind = P.outside; const dusk = kind === 'dusk', rain = kind === 'rain';
    // far school building across the courtyard
    const by = H * 0.62, bx = -320 + shift * 0.3;
    const wallC = dusk ? [214, 160, 140] : rain ? [128, 138, 150] : [244, 245, 242], winC = dusk ? [150, 104, 120] : rain ? [96, 108, 122] : [196, 216, 236];
    c.fillStyle = cs(wallC); c.fillRect(bx, by - 190, W * 0.9, 230);
    c.fillStyle = cs(cmul(wallC, 0.86)); c.fillRect(bx, by - 196, W * 0.9, 10); c.fillRect(bx, by - 128, W * 0.9, 5); c.fillRect(bx, by - 62, W * 0.9, 5);
    for (let r2 = 0; r2 < 3; r2++) for (let k = 0; k < 34; k++) { const x = bx + 24 + k * 50; c.fillStyle = cs(winC); c.fillRect(x, by - 178 + r2 * 64, 36, 40); c.fillStyle = cs(cmix(winC, [255, 255, 255], 0.35), 0.6); c.fillRect(x, by - 178 + r2 * 64, 36, 9); }
    const pal = dusk ? { trunk: [70, 44, 60], dark: [104, 62, 88], mid: [170, 104, 120], lit: [255, 188, 160] }
      : rain ? { trunk: [52, 58, 62], dark: [62, 76, 76], mid: [86, 100, 98], lit: [118, 130, 128] }
        : { trunk: [120, 96, 100], dark: [232, 184, 202], mid: [248, 214, 226], lit: [255, 248, 250] };
    const green = dusk ? { trunk: [60, 40, 50], dark: [82, 56, 70], mid: [120, 82, 92], lit: [210, 150, 120] } : rain ? pal : { trunk: [100, 92, 84], dark: [126, 164, 132], mid: [164, 198, 152], lit: [226, 242, 200] };
    const r = PV.rng(55);
    for (let k = 0; k < 15; k++) {
      const x = -400 + k * 190 + (r() - 0.5) * 70 + shift * 0.55, y = H * (0.6 + r() * 0.08), R = 120 + r() * 70;
      paintTree(c, x, y, R, (k % 4 === 1) ? green : pal, 300 + k);
    }
    // aerial haze + bloom-ish softening (cached once)
    const cw = c.canvas.width, ch = c.canvas.height; const T2 = PV.buffer('instr:outsideSoft', cw, ch); T2.ctx.clearRect(0, 0, cw, ch); T2.ctx.filter = `blur(${rain ? 5 : 1.6}px)`; T2.ctx.drawImage(c.canvas, 0, 0); T2.ctx.filter = 'none';
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cw, ch); c.drawImage(T2.canvas, 0, 0); c.restore();
    const hz = dusk ? [255, 206, 160] : rain ? [180, 190, 202] : [246, 250, 255];
    c.fillStyle = PV.linGrad(c, 0, H * 0.32, 0, H * 0.78, [[0, '#ffffff', 0], [1, '#ffffff', 0]]);
    const g = c.createLinearGradient(0, H * 0.3, 0, H * 0.8); g.addColorStop(0, cs(hz, 0)); g.addColorStop(1, cs(hz, rain ? 0.45 : 0.3)); c.fillStyle = g; c.fillRect(-400, 0, W + 800, H);
  }
  function paintOutside(ctx, t, P, o, shift) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H * 0.8, P.sky); ctx.fillRect(0, 0, W, H);
    const dusk = P.outside === 'dusk', rain = P.outside === 'rain';
    if (dusk && L.glow) L.glow(ctx, W * 0.18 + shift * 0.2, H * 0.48, 520, '#ffd6a0', 0.7);
    if (rain) { if (L.haze) { L.haze(ctx, t, { seed: 7, count: 9, y0: 30, y1: 380, alpha: 0.35, color: '#c3cad6', speed: 6 }); L.haze(ctx, t, { seed: 8, count: 7, y0: 0, y1: 260, alpha: 0.4, color: '#5f6a7c', speed: 4 }); } }
    else if (dusk) {
      if (L.cloudBand) { L.cloudBand(ctx, t, { kind: 'streak', x: 0, y: 70, w: W, h: 260, seed: 21, coverage: 0.42, light: Math.PI / 2, palette: 'sunset', alpha: 0.8, speed: 3 }); L.cloudBand(ctx, t, { kind: 'streak', x: 0, y: 300, w: W, h: 140, seed: 22, coverage: 0.35, light: Math.PI / 2, palette: 'sunset', alpha: 0.6, speed: 5 }); }
      if (L.clouds) L.clouds(ctx, t, { seed: 14, count: 4, y0: 200, y1: 360, minW: 180, maxW: 340, type: 'puff', speed: 4, alpha: 0.8, palette: 'sunset', light: -0.4, haze: 0.35 });
    } else if (L.clouds) L.clouds(ctx, t, { seed: 3, count: 6, y0: 20, y1: 300, minW: 380, maxW: 900, speed: 5, alpha: 0.95, palette: 'spring', light: 1.2, lightZ: 0.6, haze: 0.45 });
    const sc = cachedLayer('outside', P.outside, W + 600, H, c => { c.translate(300, 0); outsideScenery(c, P, 0); });
    ctx.drawImage(sc, -300 + clamp(shift, -300, 300), 0);
    if (rain && L.rain) L.rain(ctx, t, { seed: 5, count: 300, angle: 0.08, speed: 1700, len: 70, alpha: 0.32, color: '#e3eaf4' });
  }

  // simple 3-D furniture
  function shadeFlat(col, nr, st) { const d = Math.max(0, vdot(nr, st.toSun)); return cadd(cfilt(col, st.amb), cfilt(col, st.sun), d * st.sunK); }
  function drawChair(ctx, cam, x, z, yaw, st) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const T = (px, py, pz) => [x + px * c - pz * s, py, z + px * s + pz * c];
    const bx = (x0, y0, z0, x1, y1, z1) => box(x0, y0, z0, x1, y1, z1).map(p => T(p[0], p[1], p[2]));
    const parts = [];
    for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) parts.push([bx(lx - 0.012, 0, lz - 0.012, lx + 0.012, 0.42, lz + 0.012), st.metal]);
    for (const lz of [-0.17, 0.17]) parts.push([bx(-0.19, 0.42, lz - 0.012, -0.165, 0.86, lz + 0.012), st.metal]);
    parts.push([bx(-0.2, 0.42, -0.2, 0.2, 0.445, 0.2), st.wood]);
    parts.push([bx(-0.215, 0.62, -0.19, -0.19, 0.84, 0.19), st.wood]);
    parts.sort((a, b) => cam.depth(b[0][6]) - cam.depth(a[0][6]));
    for (const [C, col] of parts) drawHex(ctx, cam, C, (nr, fc, fi, pp) => faceGrad(ctx, pp, shadeFlat(col, nr, st), nr), 'rgba(58,40,30,0.32)');
  }
  // cel-ish face shading for furniture: tops flat and bright, undersides dark, vertical faces graded top->bottom
  function faceGrad(ctx, pp, col, nr) {
    if (nr[1] > 0.7) return cs(cmul(col, 1.08)); if (nr[1] < -0.7) return cs(cmul(col, 0.5));
    let y0 = 1e9, y1 = -1e9, x0 = 0; for (const p of pp) { if (p[1] < y0) { y0 = p[1]; x0 = p[0]; } if (p[1] > y1) y1 = p[1]; }
    if (y1 - y0 < 2) return cs(col);
    const g = ctx.createLinearGradient(x0, y0, x0, y1); g.addColorStop(0, cs(cmul(col, 1.04))); g.addColorStop(1, cs(cmul(col, 0.7))); return g;
  }
  function drawStand(ctx, cam, x, z, yaw, st) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const T = (px, py, pz) => [x + px * c - pz * s, py, z + px * s + pz * c];
    const col = st.black; ctx.lineCap = 'round';
    const lw = p => Math.max(0.8, 0.014 * cam.scaleAt(p));
    ctx.strokeStyle = cs(shadeFlat(col, [0, 1, 0], st));
    for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + yaw; const f = cam.p([x + Math.cos(a) * 0.28, 0, z + Math.sin(a) * 0.28]), h = cam.p(T(0, 0.42, 0)); ctx.lineWidth = lw(T(0, 0.2, 0)); ctx.beginPath(); ctx.moveTo(f[0], f[1]); ctx.lineTo(h[0], h[1]); ctx.stroke(); }
    const a = cam.p(T(0, 0.3, 0)), b = cam.p(T(0, 1.06, 0)); ctx.lineWidth = lw(T(0, 0.7, 0)) * 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    const tilt = 0.35; const dsk = [T(-0.02, 1.02, -0.25), T(-0.02, 1.02, 0.25), T(-0.02 + Math.sin(tilt) * 0.3, 1.02 + Math.cos(tilt) * 0.3, 0.25), T(-0.02 + Math.sin(tilt) * 0.3, 1.02 + Math.cos(tilt) * 0.3, -0.25)];
    const nr = vnorm(vcross(vsub(dsk[1], dsk[0]), vsub(dsk[3], dsk[0])));
    fillP(ctx, cam.poly(dsk), cs(shadeFlat(col, cam.facing(dsk[0], nr) ? nr : vmul(nr, -1), st)));
    // slots in the desk
    for (let k = 0; k < 6; k++) { const f0 = 0.12 + k * 0.14; const p0 = cam.p(vlerp(vlerp(dsk[0], dsk[3], f0), vlerp(dsk[1], dsk[2], f0), 0.12)), p1 = cam.p(vlerp(vlerp(dsk[0], dsk[3], f0), vlerp(dsk[1], dsk[2], f0), 0.88)); ctx.strokeStyle = cs(cmul(col, 0.4), 0.8); ctx.lineWidth = Math.max(0.6, lw(dsk[0]) * 0.5); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); }
    const lip = [T(-0.05, 1.0, -0.25), T(-0.05, 1.0, 0.25), T(-0.0, 1.05, 0.25), T(-0.0, 1.05, -0.25)]; fillP(ctx, cam.poly(lip), cs(cmul(shadeFlat(col, [0, 1, 0], st), 1.3)));
  }
  function furnitureList(o) {
    const mode = o.furniture || 'full'; const items = [];
    if (mode === 'none') return items;
    const rows = mode === 'sparse' ? [[3.1, 3.3], [12.6, 3.7]] : [[6.2, 3.4], [6.2, 4.6], [6.2, 5.8], [6.2, 7.0], [7.7, 4.0], [7.7, 5.2], [7.7, 6.4], [9.2, 3.4], [9.2, 4.6], [9.2, 5.8], [9.2, 7.0]];
    for (const [x, z] of rows) { items.push({ kind: 'chair', x, z, yaw: mode === 'sparse' ? (PV.rand1(x * 10 + z, 5) - 0.5) * 0.6 : 0 }); if (mode !== 'sparse') items.push({ kind: 'stand', x: x + 0.62, z, yaw: Math.PI }); }
    if (mode === 'sparse') items.push({ kind: 'stand', x: 3.7, z: 3.0, yaw: Math.PI * 0.85 }, { kind: 'stand', x: 12.0, z: 3.3, yaw: Math.PI * 1.1 });
    items.push({ kind: 'chair', x: 4.05, z: 1.05, yaw: 0.35 }); // the seat by the window pier (窓間壁)
    return items;
  }

  L.musicRoom = function (ctx, t, o = {}) {
    const time = ROOM_TIME[o.time] ? o.time : 'noon'; const P = ROOM_TIME[time];
    const cam = roomCam(o); const PM = profMarks(ctx, 'room');
    const sunDir = P.sun ? vnorm(P.sun) : null; const toSun = sunDir ? vmul(sunDir, -1) : vnorm([0, 0.6, -0.8]);
    const sunC = hx(P.sunCol), wallC = hx(P.wall), wallD = hx(P.wallDark), floorC = hx(P.floor), ceilC = hx(P.ceil), frameC = hx(P.frame);
    const ambC = cmix(wallD, wallC, 0.55);
    const st = { toSun, sun: sunC, sunK: P.sun ? 0.6 : 0.2, amb: cmul(ambC, 0.9), metal: [176, 180, 186], wood: [196, 158, 112], black: [36, 36, 42] };
    const open = o.open === undefined ? (time === 'rain' ? 0 : 1) : o.open;
    const wind = o.wind === undefined ? (time === 'rain' ? 0 : 0.5) : o.wind;
    const { Lx, Dz, Hy, sill, wTop, trTop, wallT } = RM;
    const T0 = ctx.getTransform();
    const tkey = [T0.a, T0.b, T0.c, T0.d, T0.e, T0.f].map(v => v.toFixed(3)).join(',');
    const ckey = cam.eye.concat(cam.f, cam.u).map(v => v.toFixed(4)).join(',') + ',' + cam.focal.toFixed(2);
    const skey = [time, ckey, open.toFixed(2), o.lightsOn ? 1 : 0, o.furniture || 'full'].join('|');
    const Q = (pts) => cam.poly(pts);
    const lg = (c, a, b, stops) => { const pa = cam.p(a), pb = cam.p(b); const g = c.createLinearGradient(pa[0], pa[1], pb[0], pb[1]); for (const [k, col, al] of stops) g.addColorStop(k, cs(col, al)); return g; };
    const panes = [];
    for (const [x0, x1] of BAYS) { const xm = (x0 + x1) / 2; panes.push([x0 + 0.06, xm - 0.03, sill + 0.06, wTop - 0.04], [xm + 0.03, x1 - 0.06, sill + 0.06, wTop - 0.04], [x0 + 0.06, xm - 0.03, wTop + 0.08, trTop - 0.05], [xm + 0.03, x1 - 0.06, wTop + 0.08, trTop - 0.05]); }
    const toFloor = p => { const k = -p[1] / sunDir[1]; return [p[0] + sunDir[0] * k, 0.002, p[2] + sunDir[2] * k]; };
    const items = furnitureList(o);
    // colour grade (soft-light tint) applied once, inside the cached layers, only where they have paint
    const gradeLayer = (c, holesToSkip) => {
      if (!P.tintAmt) return; c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      c.beginPath(); c.rect(0, 0, W, H); for (const h of holesToSkip || []) trace(c, h); c.clip('evenodd'); // layers live in camera space
      c.globalCompositeOperation = 'soft-light'; c.fillStyle = cs(hx(P.tint), P.tintAmt); c.fillRect(0, 0, W, H); c.restore();
    };

    ctx.save(); ctx.lineJoin = 'round';
    /* 1 ---- outside (per frame: sky, drifting clouds, rain; scenery cached) */
    const holes = []; for (const [x0, x1] of BAYS) { const q = Q([[x0, sill, -wallT], [x1, sill, -wallT], [x1, trTop, -wallT], [x0, trTop, -wallT]]); if (q) holes.push(q); }
    ctx.fillStyle = cs(cmul(wallD, 0.6)); ctx.fillRect(-W, -H, W * 3, H * 3);
    if (holes.length) { ctx.save(); ctx.beginPath(); for (const h of holes) trace(ctx, h); ctx.clip(); paintOutside(ctx, t, P, o, -(cam.eye[0] - 7.4) * 70); ctx.restore(); }
    PM('outside');

    /* 2 ---- static shell (cached): ceiling, walls, blackboard, window wall, floor, sun patches, frames, furniture shadows */
    const shell = cachedLayer('roomShell', skey, W, H, (c) => {
      c.lineJoin = 'round';
      // ceiling
      if (cam.facing([7, Hy, 4], [0, -1, 0])) {
        const cq = Q([[0, Hy, 0], [Lx, Hy, 0], [Lx, Hy, Dz], [0, Hy, Dz]]);
        fillP(c, cq, lg(c, [7, Hy, 0], [7, Hy, Dz], [[0, cmul(ceilC, P.lv.ceil * 0.74)], [0.3, cmul(cmix(ceilC, sunC, P.sun ? 0.16 : 0), P.lv.ceil * 0.9)], [0.66, cmul(ceilC, P.lv.ceil * 0.68)], [1, cmul(ceilC, P.lv.ceil * 0.5)]]));
        for (let x = 0; x <= Lx + 1e-6; x += 0.91) strokeL(c, cam.line([[x, Hy, 0], [x, Hy, Dz]]), cs(cmul(ceilC, P.lv.ceil * 0.72), 0.5), 1);
        for (let z = 0; z <= Dz + 1e-6; z += 0.91) strokeL(c, cam.line([[0, Hy, z], [Lx, Hy, z]]), cs(cmul(ceilC, P.lv.ceil * 0.72), 0.5), 1);
        for (const z of [2.6, 5.8]) for (let k = 0; k < 4; k++) {
          const x = 2.2 + k * 3.2;
          drawHex(c, cam, box(x - 0.62, Hy - 0.07, z - 0.09, x + 0.62, Hy, z + 0.09), (nr) => nr[1] < -0.5 ? (o.lightsOn ? '#fdfdf4' : cs(cmul(ceilC, P.lv.ceil * 1.1))) : cs(cmul(ceilC, P.lv.ceil * 0.85)));
        }
      }
      // side / back walls: perforated acoustic board above a wooden dado
      const perfWall = (pts, nrm) => {
        const ctr = vmul(vadd(pts[0], pts[2]), 0.5); if (!cam.facing(ctr, nrm)) return;
        const q = Q(pts); if (!q) return;
        const lvl = nrm[2] < -0.5 ? P.lv.back : P.lv.side;
        if (nrm[2] < -0.5) fillP(c, q, lg(c, [7, Hy, Dz], [7, 0, Dz], [[0, cmul(cmix(wallC, sunC, 0.15), lvl)], [1, cmul(cmix(wallC, wallD, 0.4), lvl)]]));
        else fillP(c, q, lg(c, [pts[0][0], 1.6, 0], [pts[0][0], 1.6, Dz], [[0, cmul(cadd(wallC, sunC, P.sun ? 0.12 : 0), lvl * 1.08)], [1, cmul(cmix(wallC, wallD, 0.45), lvl * 0.85)]]));
        const a0 = pts[0], a1 = pts[1];
        for (let k = 0; k <= 12; k++) { const p0 = vlerp(a0, a1, k / 12); strokeL(c, cam.line([[p0[0], 0.92, p0[2]], [p0[0], Hy, p0[2]]]), cs(wallD, 0.22), 1); }
        for (const yy of [1.6, 2.3]) strokeL(c, cam.line([[a0[0], yy, a0[2]], [a1[0], yy, a1[2]]]), cs(wallD, 0.16), 1);
        fillP(c, Q([[a0[0], 0, a0[2]], [a1[0], 0, a1[2]], [a1[0], 0.92, a1[2]], [a0[0], 0.92, a0[2]]]), cs(cmul(cmix(wallC, [160, 112, 74], 0.55), 0.78)));
        strokeL(c, cam.line([[a0[0], 0.92, a0[2]], [a1[0], 0.92, a1[2]]]), cs(cmul(wallD, 0.7), 0.8), 2);
      };
      perfWall([[0, 0, Dz], [0, 0, 0], [0, Hy, 0], [0, Hy, Dz]], [1, 0, 0]);
      perfWall([[Lx, 0, 0], [Lx, 0, Dz], [Lx, Hy, Dz], [Lx, Hy, 0]], [-1, 0, 0]);
      perfWall([[Lx, 0, Dz], [0, 0, Dz], [0, Hy, Dz], [Lx, Hy, Dz]], [0, 0, -1]);
      // blackboard wall (x = Lx)
      if (cam.facing([Lx, 1.5, 4.5], [-1, 0, 0])) {
        const bz0 = 2.0, bz1 = 7.0, by0 = 0.86, by1 = 2.06, X = Lx - 0.02;
        fillP(c, Q([[X, by0 - 0.04, bz0 - 0.05], [X, by0 - 0.04, bz1 + 0.05], [X, by1 + 0.05, bz1 + 0.05], [X, by1 + 0.05, bz0 - 0.05]]), cs(cmul(frameC, 0.85)));
        fillP(c, Q([[X - 0.005, by0, bz0], [X - 0.005, by0, bz1], [X - 0.005, by1, bz1], [X - 0.005, by1, bz0]]), lg(c, [X, by1, bz0], [X, by0, bz1], [[0, cmix([46, 80, 64], ambC, 0.12)], [1, cmix([32, 58, 48], ambC, 0.1)]]));
        // chalk dust smudges
        const sr = PV.rng(19); for (let k = 0; k < 6; k++) { const z = bz0 + 0.5 + sr() * 4, y = by0 + 0.2 + sr() * 0.8; const p = cam.p([X - 0.006, y, z]); const rr = (0.25 + sr() * 0.4) * cam.scaleAt([X, y, z]); const g = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr); g.addColorStop(0, 'rgba(220,230,220,0.08)'); g.addColorStop(1, 'rgba(220,230,220,0)'); c.fillStyle = g; c.fillRect(p[0] - rr, p[1] - rr, rr * 2, rr * 2); }
        for (let r = 0; r < 3; r++) for (let l = 0; l < 5; l++) { const y = by1 - 0.2 - r * 0.36 - l * 0.035; strokeL(c, cam.line([[X - 0.01, y, bz0 + 0.12], [X - 0.01, y, bz1 - 0.12]]), 'rgba(226,232,220,0.45)', 1); }
        const rr = PV.rng(17);
        for (let k = 0; k < 30; k++) { const z = bz0 + 0.4 + rr() * (bz1 - bz0 - 0.8), r = Math.floor(rr() * 3); const y = by1 - 0.2 - r * 0.36 - Math.floor(rr() * 9) * 0.0175; const p = cam.p([X - 0.01, y, z]); const sc = cam.scaleAt([X, y, z]); c.fillStyle = 'rgba(236,240,230,0.6)'; c.beginPath(); c.ellipse(p[0], p[1], 0.013 * sc, 0.009 * sc, -0.4, 0, TAU); c.fill(); c.strokeStyle = 'rgba(236,240,230,0.5)'; c.lineWidth = Math.max(0.6, 0.003 * sc); c.beginPath(); c.moveTo(p[0] + 0.012 * sc, p[1]); c.lineTo(p[0] + 0.012 * sc, p[1] - 0.06 * sc); c.stroke(); }
        fillP(c, Q([[X - 0.07, by0 - 0.06, bz0], [X - 0.07, by0 - 0.06, bz1], [X, by0 - 0.04, bz1], [X, by0 - 0.04, bz0]]), cs(frameC));
        for (let k = 0; k < 7; k++) {
          const z = bz0 + 0.25 + k * ((bz1 - bz0 - 0.5) / 6), y0 = 2.22, y1 = 2.62, hw = 0.15;
          fillP(c, Q([[X, y0, z - hw], [X, y0, z + hw], [X, y1, z + hw], [X, y1, z - hw]]), cs([110, 84, 56]));
          fillP(c, Q([[X - 0.005, y0 + 0.03, z - hw + 0.03], [X - 0.005, y0 + 0.03, z + hw - 0.03], [X - 0.005, y1 - 0.03, z + hw - 0.03], [X - 0.005, y1 - 0.03, z - hw + 0.03]]), cs(cmix([84, 76, 66], ambC, 0.25)));
          const p = cam.p([X - 0.01, y0 + 0.24, z]); const sc = cam.scaleAt([X, y0, z]);
          c.fillStyle = cs(cmix([150, 136, 120], ambC, 0.3), 0.75); c.beginPath(); c.ellipse(p[0], p[1], 0.05 * sc, 0.065 * sc, 0, 0, TAU); c.fill();
          c.beginPath(); c.ellipse(p[0], p[1] + 0.13 * sc, 0.1 * sc, 0.06 * sc, 0, Math.PI, TAU); c.fill();
        }
        const cc = cam.p([X - 0.01, 2.75, 4.5]), cr = 0.15 * cam.scaleAt([X, 2.75, 4.5]); const ax = cam.p([X - 0.01, 2.75, 4.65]);
        c.save(); c.translate(cc[0], cc[1]); c.scale(clamp(Math.abs(ax[0] - cc[0]) / Math.max(1, cr), 0.05, 1), 1);
        c.fillStyle = cs(cmix([242, 242, 238], ambC, 0.3)); c.beginPath(); c.arc(0, 0, cr, 0, TAU); c.fill(); c.strokeStyle = cs(cmul(frameC, 0.6)); c.lineWidth = cr * 0.12; c.stroke();
        c.strokeStyle = '#333'; c.lineWidth = cr * 0.08; c.beginPath(); c.moveTo(0, 0); c.lineTo(cr * 0.5, -cr * 0.2); c.moveTo(0, 0); c.lineTo(-cr * 0.1, -cr * 0.75); c.stroke(); c.restore();
      }
      // window wall (z=0) with openings + reveals
      if (cam.facing([7, 1.5, 0], [0, 0, 1])) {
        const outer = Q([[0, 0, 0], [Lx, 0, 0], [Lx, Hy, 0], [0, Hy, 0]]);
        c.beginPath(); trace(c, outer); for (const [x0, x1] of BAYS) { const h = Q([[x0, sill, 0], [x1, sill, 0], [x1, trTop, 0], [x0, trTop, 0]]); if (h) trace(c, h); }
        c.fillStyle = lg(c, [7, Hy, 0], [7, 0, 0], [[0, cmul(wallC, P.lv.win * 0.95)], [0.55, cmul(wallC, P.lv.win * 1.05)], [1, cmul(cmix(wallC, wallD, 0.4), P.lv.win * 0.9)]]);
        c.fill('evenodd');
        // piers (窓間壁): subtle vertical shading so they read as pillars
        for (let k = 0; k <= BAYS.length; k++) {
          const xa = k === 0 ? 0 : BAYS[k - 1][1], xb = k === BAYS.length ? Lx : BAYS[k][0];
          const q = Q([[xa, sill, 0.002], [xb, sill, 0.002], [xb, trTop, 0.002], [xa, trTop, 0.002]]); if (!q) continue;
          const pa = cam.p([xa, 1.6, 0]), pb = cam.p([xb, 1.6, 0]); const g = c.createLinearGradient(pa[0], pa[1], pb[0], pb[1]);
          const pc0 = cmul(wallC, P.lv.win * 0.9); g.addColorStop(0, cs(cadd(pc0, sunC, P.sun ? 0.28 : 0.05))); g.addColorStop(0.12, cs(pc0, 0)); g.addColorStop(0.88, cs(pc0, 0)); g.addColorStop(1, cs(cadd(pc0, sunC, P.sun ? 0.28 : 0.05)));
          fillP(c, q, g);
        }
        fillP(c, Q([[0, 0, 0.005], [Lx, 0, 0.005], [Lx, sill - 0.05, 0.005], [0, sill - 0.05, 0.005]]), lg(c, [7, sill, 0], [7, 0, 0], [[0, cmul(wallC, P.lv.win * 0.82)], [1, cmul(cmix(wallC, wallD, 0.5), P.lv.win * 0.7)]]));
        drawHex(c, cam, box(0, sill - 0.06, -0.02, Lx, sill - 0.02, 0.07), (nr) => cs(cadd(cmul(wallC, P.lv.win * 1.1), sunC, nr[1] > 0.5 && P.sun ? 0.45 : 0)));
        for (const [x0, x1] of BAYS) {
          const rv = [[[[x0, sill, 0], [x0, sill, -wallT], [x0, trTop, -wallT], [x0, trTop, 0]], [1, 0, 0]], [[[x1, sill, -wallT], [x1, sill, 0], [x1, trTop, 0], [x1, trTop, -wallT]], [-1, 0, 0]], [[[x0, sill, 0], [x1, sill, 0], [x1, sill, -wallT], [x0, sill, -wallT]], [0, 1, 0]], [[[x0, trTop, -wallT], [x1, trTop, -wallT], [x1, trTop, 0], [x0, trTop, 0]], [0, -1, 0]]];
          for (const [pts, nr] of rv) { if (!cam.facing(vmul(vadd(pts[0], pts[2]), 0.5), nr)) continue; const lit = sunDir ? Math.max(0, vdot(nr, toSun)) : 0.25; fillP(c, Q(pts), cs(cadd(cmul(wallC, P.lv.win * 1.05), sunC, lit * (P.sun ? 0.9 : 0.25)))); }
        }
      }
      // floor with planks and soft window reflections
      if (cam.facing([7, 0, 4], [0, 1, 0])) {
        const fq = Q([[0, 0, 0], [Lx, 0, 0], [Lx, 0, Dz], [0, 0, Dz]]);
        fillP(c, fq, lg(c, [7, 0, 0], [7, 0, Dz], [[0, cmul(cmix(floorC, sunC, P.sun ? 0.12 : 0), P.lv.floor * 1.05)], [0.5, cmul(floorC, P.lv.floor * 0.9)], [1, cmul(floorC, P.lv.floor * 0.72)]]));
        c.save(); c.beginPath(); trace(c, fq); c.clip();
        for (let z = 0.105; z < Dz; z += 0.105) strokeL(c, cam.line([[0, 0, z], [Lx, 0, z]]), cs(cmul(floorC, P.lv.floor * 0.55), 0.45), 1);
        const pr = PV.rng(9);
        c.strokeStyle = cs(cmul(floorC, P.lv.floor * 0.52), 0.4); c.lineWidth = 1; c.beginPath();
        for (let z = 0; z < Dz; z += 0.105) for (let x = pr() * 1.8; x < Lx; x += 1.8) { const a = cam.p([x, 0, z]), b = cam.p([x, 0, z + 0.105]); if (a[2] > 0.05 && b[2] > 0.05) { c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); } }
        c.stroke();
        const env = roomEnv(P);
        mirrorLights(c, cam, { lights: env.lights.filter(w => !w.floorPatch) }, [0, 1, 0], 0, fq, P.sun ? 0.42 : 0.45, 0.45, 9);
        c.restore();
      }
      // sun patches (pane-shaped) on the floor
      if (sunDir && P.patch > 0) {
        const polys = [];
        for (const [x0, x1, y0, y1] of panes) {
          let fl = [[x0, y0, -0.06], [x1, y0, -0.06], [x1, y1, -0.06], [x0, y1, -0.06]].map(toFloor);
          fl = clipPlane(fl, [0, 0, -1], -Dz); if (!fl) continue; fl = clipPlane(fl, [1, 0, 0], 0); if (!fl) continue; fl = clipPlane(fl, [-1, 0, 0], -Lx); if (!fl) continue;
          const q = Q(fl); if (q) polys.push(q);
        }
        const paint = (cc, col) => { cc.fillStyle = col; cc.beginPath(); for (const q of polys) trace(cc, q); cc.fill(); };
        c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = P.patch * 0.9; paint(c, cs(sunC)); c.globalCompositeOperation = 'screen'; c.globalAlpha = P.patch * 0.6; paint(c, cs(sunC)); c.restore();
        halfSoft(c, cc => paint(cc, cs(sunC)), 10, P.patch * 0.55, 'screen');
      }
      // contact shadows / ambient occlusion under the furniture (every time of day)
      if (items.length) halfSoft(c, sc2 => {
        for (const it of items) {
          const rr = it.kind === 'chair' ? 0.27 : 0.3; const pts = []; for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; pts.push(cam.p([it.x + Math.cos(a) * rr, 0, it.z + Math.sin(a) * rr])); }
          fillP(sc2, pts, '#000');
        }
      }, 4, P.sun ? 0.22 : 0.32, 'multiply');
      // corridor wall (z = Dz): two sliding doors with glass, a cork notice board with papers, transom windows
      if (cam.facing([7, 1.5, Dz], [0, 0, -1])) {
        const Z = Dz - 0.006, wl = P.lv.back, edge = cs(cmul(wallD, 0.75), 0.6);
        const quad = (x0, y0, x1, y1, z, col) => fillP(c, Q([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]), col);
        const lit = cmul(hx(P.sky[2] ? P.sky[2][1] : '#ffffff'), 0.85);
        for (const x0 of [0.9, 11.9]) {
          const x1 = x0 + 0.92; quad(x0 - 0.05, 0, x1 + 0.05, 1.95, Z + 0.002, cs(cmul(wallD, wl * 0.9)));
          quad(x0, 0, x1, 1.9, Z, lg(c, [x0, 1.9, Z], [x0, 0, Z], [[0, cmul(cmix([168, 132, 96], wallC, 0.2), wl)], [1, cmul(cmix([150, 112, 80], wallC, 0.2), wl * 0.82)]]));
          quad(x0 + 0.16, 1.02, x1 - 0.16, 1.66, Z - 0.002, cs(cmix(cmul(lit, wl), cmul(wallC, wl), 0.35)));
          quad(x0 + 0.16, 0.2, x1 - 0.16, 0.86, Z - 0.002, cs(cmul(cmix([150, 112, 80], wallC, 0.2), wl * 0.74)));
          strokeL(c, cam.line([[x0, 0, Z - 0.003], [x0, 1.9, Z - 0.003], [x1, 1.9, Z - 0.003], [x1, 0, Z - 0.003]]), edge, 1.2);
          strokeL(c, cam.line([[x0 + 0.08, 0.86, Z - 0.004], [x0 + 0.08, 1.02, Z - 0.004]]), cs(cmul(wallD, 0.6), 0.8), 2);
        }
        quad(3.9, 1.0, 9.6, 2.02, Z, cs(cmul([180, 136, 92], wl * 0.95)));
        strokeL(c, cam.line([[3.9, 1.0, Z - 0.003], [9.6, 1.0, Z - 0.003], [9.6, 2.02, Z - 0.003], [3.9, 2.02, Z - 0.003], [3.9, 1.0, Z - 0.003]]), cs(cmul([120, 90, 60], wl)), 2);
        const pr = PV.rng(23), pal = [[248, 246, 238], [252, 236, 214], [226, 238, 250], [250, 226, 230], [236, 246, 226]];
        for (let k = 0; k < 11; k++) { const w = 0.38 + pr() * 0.3, h = 0.42 + pr() * 0.3, x0 = 4.05 + k * 0.5 + (pr() - 0.5) * 0.1, y0 = 1.1 + pr() * (0.88 - h); const col = pal[Math.floor(pr() * pal.length)]; quad(x0, y0, Math.min(9.5, x0 + w), y0 + h, Z - 0.003, cs(cmul(col, wl * 0.97))); for (let l = 0; l < 4; l++) strokeL(c, cam.line([[x0 + 0.05, y0 + h - 0.1 - l * 0.07, Z - 0.004], [Math.min(9.45, x0 + w - 0.06), y0 + h - 0.1 - l * 0.07, Z - 0.004]]), cs([90, 90, 100], 0.25), 1); }
        for (let k = 0; k < 6; k++) { const x0 = 0.7 + k * 2.2; quad(x0, 2.18, x0 + 1.7, 2.72, Z, cs(cmix(cmul(lit, wl * 0.9), cmul(wallC, wl), 0.45))); strokeL(c, cam.line([[x0, 2.18, Z - 0.003], [x0 + 1.7, 2.18, Z - 0.003], [x0 + 1.7, 2.72, Z - 0.003], [x0, 2.72, Z - 0.003], [x0, 2.18, Z - 0.003]]), cs(cmul(frameC, wl * 0.85)), 1.5); strokeL(c, cam.line([[x0 + 0.85, 2.18, Z - 0.003], [x0 + 0.85, 2.72, Z - 0.003]]), cs(cmul(frameC, wl * 0.85)), 1.2); }
      }
      // window frames + glass sheen
      const frameDark = cmul(cmix(frameC, wallD, 0.45), P.sun ? 0.7 : 0.85), frameLit = cadd(frameC, sunC, P.sun ? 0.25 : 0.05);
      const bar = (x0, y0, x1, y1, z) => { const q = Q([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]); fillP(c, q, cs(frameDark)); const a = cam.p([x0, y1, z]), b = cam.p([x1, y1, z]); c.strokeStyle = cs(frameLit, 0.75); c.lineWidth = 1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); const a2 = cam.p([x0, y0, z]), b2 = cam.p([x0, y1, z]); c.strokeStyle = cs(frameLit, 0.4); c.beginPath(); c.moveTo(a2[0], a2[1]); c.lineTo(b2[0], b2[1]); c.stroke(); };
      for (const [x0, x1] of BAYS) {
        const xm = (x0 + x1) / 2, zg = -0.09, slide = open * 1.12;
        bar(x0, sill, x0 + 0.05, trTop, zg + 0.02); bar(x1 - 0.05, sill, x1, trTop, zg + 0.02); bar(x0, sill, x1, sill + 0.05, zg + 0.02); bar(x0, trTop - 0.05, x1, trTop, zg + 0.02);
        bar(x0, wTop, x1, wTop + 0.07, zg + 0.02); bar(xm - 0.02, wTop + 0.07, xm + 0.02, trTop, zg + 0.01);
        const sash = (a, b, z) => { bar(a, sill + 0.05, a + 0.045, wTop, z); bar(b - 0.045, sill + 0.05, b, wTop, z); bar(a, sill + 0.05, b, sill + 0.1, z); bar(a, wTop - 0.04, b, wTop, z); };
        sash(x0 + 0.05, xm + 0.03, zg); sash(xm - 0.03 - slide, x1 - 0.05 - slide, zg + 0.035);
        const gq = Q([[x0 + 0.05, sill + 0.05, zg], [x1 - 0.05 - (open > 0.5 ? (x1 - x0) * 0.47 : 0), sill + 0.05, zg], [x1 - 0.05 - (open > 0.5 ? (x1 - x0) * 0.47 : 0), wTop, zg], [x0 + 0.05, wTop, zg]]);
        if (gq) { c.save(); c.beginPath(); trace(c, gq); c.clip(); const a = cam.p([x0, wTop, zg]), b = cam.p([x1, sill, zg]); const g = c.createLinearGradient(a[0], a[1], b[0], b[1]); const k = time === 'rain' ? 0.12 : 0.07; g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.33, `rgba(255,255,255,${k})`); g.addColorStop(0.4, 'rgba(255,255,255,0)'); g.addColorStop(0.6, `rgba(255,255,255,${k * 0.7})`); g.addColorStop(0.65, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-W, -H, W * 3, H * 3); c.restore(); }
      }
      // furniture shadows on the floor
      if (sunDir && items.length) {
        halfSoft(c, sc2 => {
          sc2.fillStyle = '#000';
          for (const it of items) {
            const pts = it.kind === 'chair' ? [[-0.2, 0.44, -0.2], [0.2, 0.44, -0.2], [0.2, 0.44, 0.2], [-0.2, 0.44, 0.2], [-0.21, 0.84, -0.19], [-0.21, 0.84, 0.19], [-0.2, 0, -0.2], [0.2, 0, 0.2], [0.2, 0, -0.2], [-0.2, 0, 0.2]] : [[0, 1.05, -0.25], [0, 1.05, 0.25], [0.1, 1.33, 0.25], [0.1, 1.33, -0.25], [0, 0, 0]];
            const cc = Math.cos(it.yaw), ss = Math.sin(it.yaw);
            const hp = hull(pts.map(p => cam.p(toFloor([it.x + p[0] * cc - p[2] * ss, p[1], it.z + p[0] * ss + p[2] * cc])))); if (hp.length > 2) fillP(sc2, hp, '#000');
          }
        }, 5, 0.3, 'multiply');
      }
      gradeLayer(c, holes);
    });
    ctx.drawImage(shell, 0, 0); PM('shell');
    /* 3 ---- rain drops on glass */
    if (time === 'rain') for (const [x0, x1] of BAYS) {
      const gq = Q([[x0 + 0.05, sill + 0.05, -0.09], [x1 - 0.05, sill + 0.05, -0.09], [x1 - 0.05, wTop, -0.09], [x0 + 0.05, wTop, -0.09]]); if (!gq) continue;
      const bb = gq.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
      ctx.save(); ctx.beginPath(); trace(ctx, gq); ctx.clip(); glassDrops(ctx, t, { x: bb[0], y: bb[1], w: bb[2] - bb[0], h: bb[3] - bb[1], seed: 400 + Math.round(x0 * 10), scale: cam.scaleAt([(x0 + x1) / 2, 1.5, 0]) / 240, density: 0.7 }); ctx.restore();
    }
    /* 4 ---- curtains (dynamic, half resolution) */
    const curtains = [];
    for (let k = 0; k < BAYS.length; k++) {
      const [x0, x1] = BAYS[k]; const w0 = wind * (open > 0.05 ? 1 : 0);
      curtains.push({ x0: x0 - 0.3, x1: x0 + 0.4, gather: -1, wind: w0 * 0.5, windSide: 1, seed: 11 + k * 7, edgeSide: 1 });
      curtains.push({ x0: x1 - 0.52, x1: x1 + 0.26, gather: 1, wind: w0 * (k % 2 ? 1.0 : 0.82), windSide: -1, seed: 13 + k * 5, edgeSide: 0 });
    }
    {
      const hb = PV.buffer('instr:roomCurtainHalf', W / 2, H / 2); hb.ctx.setTransform(1, 0, 0, 1, 0, 0); hb.ctx.clearRect(0, 0, W / 2, H / 2);
      hb.ctx.setTransform(T0.a * 0.5, T0.b * 0.5, T0.c * 0.5, T0.d * 0.5, T0.e * 0.5, T0.f * 0.5);
      const inGlass = x => BAYS.some(([a, b]) => x > a + 0.06 && x < b - 0.06);
      const back = (u, v, x) => (inGlass(x) ? 1 : 0.42) * (P.sun ? 1 : 0.72);
      let bb = [1e9, 1e9, -1e9, -1e9];
      for (const cc of curtains) { const b = drawCurtainPanel(hb.ctx, cam, t, Object.assign({ yTop: 2.42, yHem: 0.6, z0: 0.12, folds: 5, depth: 0.055, color: P.curtain, shade: P.curtainShade, back, front: P.sun ? 0.25 : 0.4, strips: 13, rows: 9 }, cc)); bb = [Math.min(bb[0], b[0]), Math.min(bb[1], b[1]), Math.max(bb[2], b[2]), Math.max(bb[3], b[3])]; }
      PM('curtainPanels');
      // composite only the curtains' screen bbox (the whole half-res buffer upscaled cost ~10 ms)
      const cr = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[2], bb[3]], [bb[0], bb[3]]].map(p => [T0.a * p[0] + T0.c * p[1] + T0.e, T0.b * p[0] + T0.d * p[1] + T0.f]);
      const sx0 = Math.max(0, Math.floor(Math.min(...cr.map(p => p[0])) / 2) - 2), sy0 = Math.max(0, Math.floor(Math.min(...cr.map(p => p[1])) / 2) - 2);
      const sx1 = Math.min(W / 2, Math.ceil(Math.max(...cr.map(p => p[0])) / 2) + 2), sy1 = Math.min(H / 2, Math.ceil(Math.max(...cr.map(p => p[1])) / 2) + 2);
      if (sx1 > sx0 && sy1 > sy0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = o.curtainAlpha === undefined ? 0.9 : o.curtainAlpha; ctx.drawImage(hb.canvas, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0 * 2, sy0 * 2, (sx1 - sx0) * 2, (sy1 - sy0) * 2); ctx.restore(); }
    }
    strokeL(ctx, cam.line([[0.2, 2.46, 0.1], [Lx - 0.2, 2.46, 0.1]]), cs(cmul(frameC, 0.7)), Math.max(1.5, 0.022 * cam.scaleAt([7, 2.46, 0.1])));
    PM('curtains');
    /* 5 ---- furniture (cached layer) */
    if (items.length) {
      const furn = cachedLayer('roomFurniture', skey, W, H, (c) => {
        c.lineJoin = 'round';
        const its = items.slice().sort((a, b) => cam.depth([b.x, 0.5, b.z]) - cam.depth([a.x, 0.5, a.z]));
        for (const it of its) { if (it.kind === 'chair') drawChair(c, cam, it.x, it.z, it.yaw, st); else drawStand(c, cam, it.x, it.z, it.yaw, st); }
      });
      ctx.drawImage(furn, 0, 0);
    }
    PM('furniture');
    /* 6 ---- light shafts + dust (dynamic) */
    const shafts = [];
    if (sunDir && P.shaft > 0 && o.shaft !== 0) {
      for (const [x0, x1, y0, y1] of panes) {
        const win = [[x0, y0, -0.06], [x1, y0, -0.06], [x1, y1, -0.06], [x0, y1, -0.06]];
        const hp = hull(win.concat(win.map(toFloor)).map(p => cam.p(p)).filter(p => p[2] > 0.05));
        if (hp.length > 2) shafts.push({ hp, a: cam.p([(x0 + x1) / 2, (y0 + y1) / 2, -0.06]), b: cam.p(toFloor([(x0 + x1) / 2, (y0 + y1) / 2, -0.06])) });
      }
      // the blurred beam layer is static for a given camera: cache it at half resolution, flicker globally
      const shaftLayer = cachedLayer('roomShafts', skey, W / 2, H / 2, (cc) => {
        const hb = PV.buffer('instr:roomShaftHalf', W / 2, H / 2); const hc = hb.ctx; hc.setTransform(1, 0, 0, 1, 0, 0); hc.clearRect(0, 0, W / 2, H / 2); hc.setTransform(0.5, 0, 0, 0.5, 0, 0); hc.globalCompositeOperation = 'lighter';
        let i = 0;
        for (const s2 of shafts) {
          const g = hc.createLinearGradient(s2.a[0], s2.a[1], s2.b[0], s2.b[1]);
          const fl = 0.75 + 0.25 * PV.rand1(i++, 77);
          g.addColorStop(0, cs(sunC, 0.5 * fl)); g.addColorStop(0.5, cs(sunC, 0.2 * fl)); g.addColorStop(1, cs(sunC, 0.03));
          fillP(hc, s2.hp, g);
        }
        hc.globalCompositeOperation = 'source-over'; hc.setTransform(1, 0, 0, 1, 0, 0);
        cc.filter = 'blur(4px)'; cc.drawImage(hb.canvas, 0, 0); cc.filter = 'none';
      });
      const flick = 0.88 + 0.12 * PV.noise2(t * 0.35, 3.3);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = P.shaft * (o.shaft === undefined ? 1 : o.shaft) * flick; ctx.drawImage(shaftLayer, 0, 0, W, H); ctx.restore();
      if (L.dust && o.dust !== false) L.dust(ctx, t, { seed: 8, count: 110, x0: 0, y0: 0, x1: W, y1: H, size: 2.4, alpha: 0.8, color: P.sunCol, mask: (x, y) => { for (const s of shafts) if (pointInPoly(x, y, s.hp)) return 1; return 0; } });
    }
    PM('shafts+dust');
    /* 7 ---- grade: baked into the cached shell / furniture layers (gradeLayer) */
    ctx.restore(); PM('end');
    const env = roomEnv(P);
    return {
      cam, env, time, shafts,
      seat: cam.p([4.05, 0.45, 1.05]),
      project: p => cam.p(p),
      // option block for grandPiano: a piano standing at room point (x,z) rotated by yaw (rad)
      piano: (x = 8.9, z = 3.3, yaw = -0.35, extra = {}) => Object.assign({ roomCam: cam, at: [x, z], rotY: yaw, roomEnv: env, lightDirRoom: toSun, lightColor: P.sunCol, cache: true }, extra),
    };
  };

  /* ======================================================================
   * SHEET MUSIC — engraved page (grand staves, notes, dynamics) + dissolve
   * page units: width 1000, height 1414 (A4).  staff space = 9 units.
   * ====================================================================== */
  const SP = 9; // staff space (page units)
  function gClef(c, x, y) { // y = top staff line; drawn in page units
    const s = SP; const P0 = [[0.35, 3.0], [0.95, 2.55], [1.0, 3.35], [0.45, 3.95], [-0.35, 3.65], [-0.55, 2.85], [-0.1, 1.9], [0.55, 1.15], [0.88, 0.25], [0.78, -0.7], [0.42, -1.35], [0.1, -0.85], [0.05, 0.2], [0.25, 1.8], [0.48, 3.6], [0.55, 4.9], [0.3, 5.55], [-0.15, 5.5]];
    const pts = spline(P0.map(p => [x + p[0] * s, y + p[1] * s]), false, 6);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = s * 0.16; c.beginPath(); pathPts(c, pts, false); c.stroke();
    c.lineWidth = s * 0.3; c.beginPath(); pathPts(c, pts.slice(10, 34), false); c.stroke();
    c.beginPath(); c.arc(x - 0.12 * s, y + 5.15 * s, s * 0.32, 0, TAU); c.fill();
  }
  function fClef(c, x, y) {
    const s = SP; c.lineCap = 'round';
    c.beginPath(); c.arc(x + 0.1 * s, y + 1.0 * s, s * 0.36, 0, TAU); c.fill();
    const pts = spline([[0.0, 1.0], [0.2, 0.15], [1.0, -0.05], [1.65, 0.6], [1.55, 1.8], [0.9, 3.0], [0.0, 3.9]].map(p => [x + p[0] * s, y + p[1] * s]), false, 6);
    c.lineWidth = s * 0.2; c.beginPath(); pathPts(c, pts, false); c.stroke();
    c.lineWidth = s * 0.34; c.beginPath(); pathPts(c, pts.slice(10, 26), false); c.stroke();
    c.beginPath(); c.arc(x + 2.05 * s, y + 0.5 * s, s * 0.17, 0, TAU); c.arc(x + 2.05 * s, y + 1.5 * s, s * 0.17, 0, TAU); c.fill();
  }
  function noteHead(c, x, y, hollow) {
    c.save(); c.translate(x, y); c.rotate(-0.38);
    c.beginPath(); c.ellipse(0, 0, SP * 0.66, SP * 0.46, 0, 0, TAU);
    if (hollow) { c.lineWidth = SP * 0.16; c.stroke(); } else c.fill();
    c.restore();
  }
  function sharp(c, x, y) { const s = SP; c.lineWidth = s * 0.12; c.beginPath(); c.moveTo(x - 0.25 * s, y - 1.3 * s); c.lineTo(x - 0.25 * s, y + 1.4 * s); c.moveTo(x + 0.25 * s, y - 1.4 * s); c.lineTo(x + 0.25 * s, y + 1.3 * s); c.stroke(); c.lineWidth = s * 0.3; c.beginPath(); c.moveTo(x - 0.6 * s, y - 0.3 * s); c.lineTo(x + 0.6 * s, y - 0.55 * s); c.moveTo(x - 0.6 * s, y + 0.55 * s); c.lineTo(x + 0.6 * s, y + 0.3 * s); c.stroke(); }
  function flat(c, x, y) { const s = SP; c.lineWidth = s * 0.13; c.beginPath(); c.moveTo(x - 0.3 * s, y - 1.8 * s); c.lineTo(x - 0.3 * s, y + 0.5 * s); c.stroke(); c.beginPath(); c.moveTo(x - 0.3 * s, y + 0.5 * s); c.bezierCurveTo(x + 0.9 * s, y - 0.1 * s, x + 0.5 * s, y - 0.8 * s, x - 0.3 * s, y - 0.2 * s); c.lineWidth = s * 0.2; c.stroke(); }
  function quarterRest(c, x, y) { const s = SP; c.lineWidth = s * 0.22; c.lineJoin = 'miter'; c.beginPath(); c.moveTo(x - 0.2 * s, y - 1.5 * s); c.lineTo(x + 0.45 * s, y - 0.6 * s); c.lineTo(x - 0.25 * s, y + 0.2 * s); c.lineTo(x + 0.4 * s, y + 1.0 * s); c.quadraticCurveTo(x - 0.4 * s, y + 0.8 * s, x + 0.1 * s, y + 1.7 * s); c.stroke(); }
  const sheetCache = {};
  function buildSheet(seed) {
    if (sheetCache[seed]) return sheetCache[seed];
    const r = PV.rng(seed); const G = []; // glyphs: {k(kind), x, y, ...}
    const mL = 80, mR = 920, top0 = 190, sysH = 190;
    const systems = 6;
    for (let s = 0; s < systems; s++) {
      const yT = top0 + s * sysH, yB = yT + 9 * SP; // treble top line, bass top line
      G.push({ k: 'staff', x: mL, y: yT, w: mR - mL }); G.push({ k: 'staff', x: mL, y: yB, w: mR - mL });
      G.push({ k: 'brace', x: mL - 14, y: yT, h: yB + 4 * SP - yT });
      G.push({ k: 'bar', x: mL, y: yT, h: yB + 4 * SP - yT });
      G.push({ k: 'g', x: mL + 14, y: yT }); G.push({ k: 'f', x: mL + 12, y: yB });
      // key signature: B-flat minor (5 flats: B E A D G)
      const ks = [[0, 2], [1, 0.5], [2, 2.5], [3, 1], [4, 3]]; for (const [i, l] of ks) { G.push({ k: 'flat', x: mL + 52 + i * 11, y: yT + l * SP }); G.push({ k: 'flat', x: mL + 52 + i * 11, y: yB + (l + 1) * SP }); }
      if (s === 0) { G.push({ k: 'num', x: mL + 118, y: yT + 1 * SP, t: '4' }); G.push({ k: 'num', x: mL + 118, y: yT + 3 * SP, t: '4' }); G.push({ k: 'num', x: mL + 118, y: yB + 1 * SP, t: '4' }); G.push({ k: 'num', x: mL + 118, y: yB + 3 * SP, t: '4' }); }
      const x0 = mL + (s === 0 ? 136 : 112); const meas = 4; const mw = (mR - x0) / meas;
      for (let m = 0; m < meas; m++) {
        const mx = x0 + m * mw;
        G.push({ k: 'bar', x: mx + mw, y: yT, h: yB + 4 * SP - yT, dbl: s === systems - 1 && m === meas - 1 });
        // treble: tremolo chords / runs (Chasse-neige flavour)
        const pat = Math.floor(r() * 3);
        const beats = 8; const bw = (mw - 16) / beats;
        let prevStem = null;
        for (let b = 0; b < beats; b++) {
          const nx = mx + 10 + b * bw + bw * 0.3;
          const line = pat === 0 ? 3 + Math.round(Math.sin((b + m) * 0.9) * 2.5) : pat === 1 ? 6 - b * 0.5 - (b % 2) : 2 + (b % 3);
          const ny = yT + line * SP / 2 + SP * 0.0;
          const chord = r() < 0.45 ? 2 : r() < 0.3 ? 3 : 1;
          for (let q = 0; q < chord; q++) { const yy = ny - q * SP; G.push({ k: 'head', x: nx, y: yy }); if (yy < yT - SP * 0.4) G.push({ k: 'ledger', x: nx, y: Math.round((yy - yT) / SP) * SP + yT }); if (r() < 0.07) G.push({ k: 'sharp', x: nx - 15, y: yy }); }
          const stemTop = ny - (chord - 1) * SP - SP * 3.3;
          G.push({ k: 'stem', x: nx + SP * 0.6, y0: ny, y1: stemTop });
          if (b % 2 === 1 && prevStem) G.push({ k: 'beam', x0: prevStem[0], y0: prevStem[1], x1: nx + SP * 0.6, y1: stemTop, n: 2 });
          prevStem = [nx + SP * 0.6, stemTop];
          if (b % 2 === 1) prevStem = null;
        }
        // bass: broken octaves / half notes
        for (let b = 0; b < 4; b++) {
          const nx = mx + 14 + b * (mw - 16) / 4; const line = 4 + ((b + m + s) % 4); const ny = yB + line * SP / 2;
          const hollow = r() < 0.4;
          G.push({ k: 'head', x: nx, y: ny, hollow }); G.push({ k: 'head', x: nx, y: ny + SP * 3.5, hollow }); if (ny + SP * 3.5 > yB + 4.4 * SP) G.push({ k: 'ledger', x: nx, y: yB + 5 * SP });
          G.push({ k: 'stem', x: nx - SP * 0.6, y0: ny, y1: ny + SP * 3.5 + SP * 3 });
        }
        if (r() < 0.25) G.push({ k: 'rest', x: mx + mw - 22, y: yB + 2 * SP });
        // slur over the bar
        if (r() < 0.5) G.push({ k: 'slur', x0: mx + 12, x1: mx + mw - 12, y: yT - SP * 2.2 - r() * 10, h: 10 + r() * 8 });
      }
      // dynamics + hairpins
      const dyn = ['p', 'pp', 'mf', 'f', 'ff', 'sf'];
      G.push({ k: 'dyn', x: x0 + 10 + r() * 80, y: yT + 6.8 * SP, t: dyn[Math.floor(r() * dyn.length)] });
      if (r() < 0.8) { const hx0 = x0 + 160 + r() * 200; G.push({ k: 'hair', x0: hx0, x1: hx0 + 120 + r() * 120, y: yT + 6.6 * SP, cresc: r() < 0.6 }); }
      if (r() < 0.4) G.push({ k: 'text', x: x0 + 420 + r() * 200, y: yT + 6.9 * SP, t: r() < 0.5 ? 'cresc.' : 'dim.' });
      // fingering
      for (let k = 0; k < 4; k++) G.push({ k: 'fing', x: x0 + 30 + r() * (mR - x0 - 60), y: yT - SP * 1.4, t: String(1 + Math.floor(r() * 5)) });
    }
    G.push({ k: 'title', x: 500, y: 92, t: 'Études d’exécution transcendante' });
    G.push({ k: 'sub', x: 500, y: 130, t: 'No. 12  Chasse-neige' });
    G.push({ k: 'comp', x: 920, y: 160, t: 'F. Liszt' });
    G.push({ k: 'tempo', x: 80, y: 168, t: 'Andante con moto' });
    G.push({ k: 'pageno', x: 500, y: 1360, t: '— 87 —' });
    // per-glyph centres & release order (for dissolve)
    for (const g of G) {
      const cx = g.x !== undefined ? g.x + (g.w ? g.w / 2 : 0) : (g.x0 + g.x1) / 2, cy = g.y !== undefined ? g.y : (g.y0 + g.y1) / 2;
      g.cx = cx; g.cy = cy; g.rel = clamp(0.05 + (cy / 1414) * 0.35 + PV.rand1(Math.round(cx * 7 + cy * 13), 4) * 0.45 + (g.k === 'staff' ? 0.25 : 0), 0, 0.92);
      g.seed = PV.rand1(Math.round(cx * 3 + cy * 5), 9);
    }
    sheetCache[seed] = G; return G;
  }
  function drawGlyph(c, g, ink) {
    c.fillStyle = ink; c.strokeStyle = ink;
    switch (g.k) {
      case 'staff': c.lineWidth = 1.1; c.beginPath(); for (let l = 0; l < 5; l++) { c.moveTo(g.x, g.y + l * SP); c.lineTo(g.x + g.w, g.y + l * SP); } c.stroke(); break;
      case 'bar': c.lineWidth = 1.3; c.beginPath(); c.moveTo(g.x, g.y); c.lineTo(g.x, g.y + g.h); c.stroke(); if (g.dbl) { c.lineWidth = 4; c.beginPath(); c.moveTo(g.x + 5, g.y); c.lineTo(g.x + 5, g.y + g.h); c.stroke(); } break;
      case 'brace': { c.beginPath(); const x = g.x, y = g.y, h = g.h; c.moveTo(x + 6, y); c.bezierCurveTo(x - 6, y + h * 0.1, x + 4, y + h * 0.42, x - 6, y + h * 0.5); c.bezierCurveTo(x + 4, y + h * 0.58, x - 6, y + h * 0.9, x + 6, y + h); c.bezierCurveTo(x - 1, y + h * 0.9, x + 9, y + h * 0.58, x - 3, y + h * 0.5); c.bezierCurveTo(x + 9, y + h * 0.42, x - 1, y + h * 0.1, x + 6, y); c.fill(); break; }
      case 'g': gClef(c, g.x, g.y); break;
      case 'f': fClef(c, g.x, g.y); break;
      case 'flat': flat(c, g.x, g.y); break;
      case 'sharp': sharp(c, g.x, g.y); break;
      case 'head': noteHead(c, g.x, g.y, g.hollow); break;
      case 'ledger': c.lineWidth = 1.1; c.beginPath(); c.moveTo(g.x - SP * 1.0, g.y); c.lineTo(g.x + SP * 1.0, g.y); c.stroke(); break;
      case 'stem': c.lineWidth = 1.2; c.beginPath(); c.moveTo(g.x, g.y0); c.lineTo(g.x, g.y1); c.stroke(); break;
      case 'beam': for (let k = 0; k < g.n; k++) { c.beginPath(); const o2 = k * SP * 0.75; c.moveTo(g.x0 - 0.6, g.y0 + o2); c.lineTo(g.x1 + 0.6, g.y1 + o2); c.lineTo(g.x1 + 0.6, g.y1 + o2 + SP * 0.48); c.lineTo(g.x0 - 0.6, g.y0 + o2 + SP * 0.48); c.closePath(); c.fill(); } break;
      case 'rest': quarterRest(c, g.x, g.y); break;
      case 'slur': c.lineWidth = 1.4; c.beginPath(); c.moveTo(g.x0, g.y); c.quadraticCurveTo((g.x0 + g.x1) / 2, g.y - g.h, g.x1, g.y); c.quadraticCurveTo((g.x0 + g.x1) / 2, g.y - g.h - 2.5, g.x0, g.y); c.fill(); c.stroke(); break;
      case 'hair': c.lineWidth = 1.2; c.beginPath(); if (g.cresc) { c.moveTo(g.x1, g.y - 9); c.lineTo(g.x0, g.y); c.lineTo(g.x1, g.y + 9); } else { c.moveTo(g.x0, g.y - 9); c.lineTo(g.x1, g.y); c.lineTo(g.x0, g.y + 9); } c.stroke(); break;
      case 'dyn': c.font = `italic 700 ${SP * 3.1}px Cormorant, serif`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(g.t, g.x, g.y); break;
      case 'text': c.font = `italic 500 ${SP * 2.2}px Cormorant, serif`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(g.t, g.x, g.y); break;
      case 'fing': c.font = `600 ${SP * 1.4}px Cormorant, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(g.t, g.x, g.y); break;
      case 'num': c.font = `700 ${SP * 2.6}px Cormorant, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(g.t, g.x, g.y); break;
      case 'title': c.font = `500 34px Cormorant, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(g.t, g.x, g.y); break;
      case 'sub': c.font = `italic 500 26px Cormorant, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(g.t, g.x, g.y); break;
      case 'comp': c.font = `500 20px Cormorant, serif`; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(g.t, g.x, g.y); break;
      case 'tempo': c.font = `italic 700 20px Cormorant, serif`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(g.t, g.x, g.y); break;
      case 'pageno': c.font = `500 16px Cormorant, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(g.t, g.x, g.y); break;
    }
  }
  // cached ink layers of a page (high-res image) + the list of non-empty dissolve cells
  const SHEET_RES = 1.4, CELL = 22;
  const sheetInk = {};
  function sheetLayers(seed, inkHex) {
    const key = seed + '|' + inkHex; if (sheetInk[key]) return sheetInk[key];
    const G = buildSheet(seed);
    const mk = (fn) => { const c = PV.makeCanvas(Math.round(1000 * SHEET_RES), Math.round(1414 * SHEET_RES)); c.ctx.scale(SHEET_RES, SHEET_RES); fn(c.ctx); return c.canvas; };
    const isFixed = g => g.k === 'staff' || g.k === 'bar' || g.k === 'brace';
    const fixed = mk(c => { for (const g of G) if (isFixed(g)) drawGlyph(c, g, inkHex); });
    const notes = mk(c => { for (const g of G) if (!isFixed(g)) drawGlyph(c, g, inkHex); });
    const glow = mk(c => { for (const g of G) if (!isFixed(g)) drawGlyph(c, g, '#fff4dc'); });
    const gold = mk(c => { for (const g of G) if (!isFixed(g)) drawGlyph(c, g, '#d8a24a'); });
    const nx = Math.ceil(1000 / CELL), ny = Math.ceil(1414 / CELL);
    const data = notes.getContext('2d').getImageData(0, 0, notes.width, notes.height).data; const cw = notes.width;
    const cells = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x0 = Math.floor(i * CELL * SHEET_RES), y0 = Math.floor(j * CELL * SHEET_RES), x1 = Math.min(cw, Math.floor((i + 1) * CELL * SHEET_RES)), y1 = Math.min(notes.height, Math.floor((j + 1) * CELL * SHEET_RES));
      let ink = 0; for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) if (data[(y * cw + x) * 4 + 3] > 24) { ink++; if (ink > 2) break; }
      if (ink > 2) { const cx = (i + 0.5) * CELL, cy = (j + 0.5) * CELL; const rnd = PV.rand1(i * 131 + j * 977, 4); cells.push({ i, j, cx, cy, rel: clamp(0.05 + (cy / 1414) * 0.35 + rnd * 0.45, 0, 0.92) * 0.75, seed: PV.rand1(i * 37 + j * 101, 9) }); }
    }
    const glowSpr = PV.makeCanvas(64, 64); { const g = glowSpr.ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,246,222,0.9)'); g.addColorStop(0.35, 'rgba(255,240,210,0.35)'); g.addColorStop(1, 'rgba(255,240,210,0)'); glowSpr.ctx.fillStyle = g; glowSpr.ctx.fillRect(0, 0, 64, 64); }
    const shadow = PV.makeCanvas(Math.round(1240 * 0.25), Math.round(1654 * 0.25)); shadow.ctx.filter = 'blur(10px)'; shadow.ctx.fillStyle = '#0a0806'; shadow.ctx.fillRect(30, 30, 1000 * 0.25, 1414 * 0.25);
    return (sheetInk[key] = { fixed, notes, glow, gold, cells, glowSpr: glowSpr.canvas, shadow: shadow.canvas, baked: {} });
  }
  function sheetBaked(LY, paperHex, la) {
    const key = paperHex + '|' + la.toFixed(2); if (LY.baked[key]) return LY.baked[key];
    const c = PV.makeCanvas(Math.round(1000 * SHEET_RES), Math.round(1414 * SHEET_RES)); const x = c.ctx; x.scale(SHEET_RES, SHEET_RES);
    const pc = hx(paperHex);
    const g = x.createLinearGradient(500 + Math.cos(la) * 700, 707 + Math.sin(la) * 900, 500 - Math.cos(la) * 700, 707 - Math.sin(la) * 900); g.addColorStop(0, cs(cadd(pc, [8, 8, 8]))); g.addColorStop(1, cs(cmul(pc, 0.9)));
    x.fillStyle = g; x.fillRect(0, 0, 1000, 1414);
    const tex = PV.cached('instr:paperTex', 256, 256, (cc) => { const img = cc.createImageData(256, 256); const r = PV.rng(3); for (let i = 0; i < 256 * 256; i++) { const v = 238 + (PV.fbm2((i % 256) / 18, Math.floor(i / 256) / 18, 3) * 14) + (r() - 0.5) * 10; img.data[i * 4] = v; img.data[i * 4 + 1] = v - 2; img.data[i * 4 + 2] = v - 6; img.data[i * 4 + 3] = 255; } cc.putImageData(img, 0, 0); });
    x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.55; x.fillStyle = x.createPattern(tex, 'repeat'); x.fillRect(0, 0, 1000, 1414); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.drawImage(LY.fixed, 0, 0, 1000, 1414); x.drawImage(LY.notes, 0, 0, 1000, 1414);
    return (LY.baked[key] = c.canvas);
  }
  function sheetPaper(LY, paperHex, la) {
    const key = 'paper|' + paperHex + '|' + la.toFixed(2); if (LY.baked[key]) return LY.baked[key];
    const c = PV.makeCanvas(Math.round(1000 * SHEET_RES), Math.round(1414 * SHEET_RES)); const x = c.ctx; x.scale(SHEET_RES, SHEET_RES);
    const pc = hx(paperHex);
    const g = x.createLinearGradient(500 + Math.cos(la) * 700, 707 + Math.sin(la) * 900, 500 - Math.cos(la) * 700, 707 - Math.sin(la) * 900); g.addColorStop(0, cs(cadd(pc, [8, 8, 8]))); g.addColorStop(1, cs(cmul(pc, 0.9)));
    x.fillStyle = g; x.fillRect(0, 0, 1000, 1414);
    const tex = PV.cached('instr:paperTex', 256, 256, (cc) => { const img = cc.createImageData(256, 256); const r = PV.rng(3); for (let i = 0; i < 256 * 256; i++) { const v = 238 + (PV.fbm2((i % 256) / 18, Math.floor(i / 256) / 18, 3) * 14) + (r() - 0.5) * 10; img.data[i * 4] = v; img.data[i * 4 + 1] = v - 2; img.data[i * 4 + 2] = v - 6; img.data[i * 4 + 3] = 255; } cc.putImageData(img, 0, 0); });
    x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.55; x.fillStyle = x.createPattern(tex, 'repeat'); x.fillRect(0, 0, 1000, 1414); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    return (LY.baked[key] = c.canvas);
  }
  /* o: {x,y (centre), w (px width), rot, skewX, scaleY, dissolve 0..1, rise, seed, paper:'#hex', ink, light:{angle}, shadow} */
  L.sheetMusic = function (ctx, t, o = {}) {
    const inkHex = o.ink || '#24201c';
    const LY = sheetLayers(o.seed || 12, inkHex);
    const w = o.w || 640, k = w / 1000, cx = o.x === undefined ? W / 2 : o.x, cy = o.y === undefined ? H / 2 : o.y;
    const rot = o.rot || 0, sy = o.scaleY || 1, skx = o.skewX || 0;
    const dis = clamp(o.dissolve || 0);
    const paper = hx(o.paper || '#f4eee0'), white = hx('#f8f8f6');
    const M = new DOMMatrix().translate(cx, cy).rotate(rot * 180 / Math.PI).skewX(skx * 180 / Math.PI).scale(k, k * sy).translate(-500, -707);
    const tp = (x, y) => { const p = M.transformPoint({ x, y }); return [p.x, p.y]; };
    ctx.save();
    const corners = [tp(0, 0), tp(1000, 0), tp(1000, 1414), tp(0, 1414)];
    const la = o.light && o.light.angle !== undefined ? o.light.angle : -2.2;
    const sa = o.shadow === 0 ? 0 : (o.shadow === undefined ? 0.35 : o.shadow) * (1 - dis);
    if (sa > 0.01) { ctx.save(); ctx.transform(M.a, M.b, M.c, M.d, M.e, M.f); ctx.globalAlpha = sa; ctx.drawImage(LY.shadow, -120 + 10, -120 + 16, 1240, 1654); ctx.restore(); }
    if (dis <= 0) {
      ctx.save(); ctx.transform(M.a, M.b, M.c, M.d, M.e, M.f); ctx.drawImage(sheetBaked(LY, o.paper || '#f4eee0', la), 0, 0, 1000, 1414); ctx.restore(); ctx.restore();
      return { corners };
    }
    // paper: the baked (gradient + fibre texture) sheet without ink, whitened toward #f8f8f6 as the page empties
    ctx.save(); ctx.transform(M.a, M.b, M.c, M.d, M.e, M.f);
    // (dissolve path works on 0.75x page images: three full-page draws per frame at 1.4x cost ~20 ms)
    const LO = 0.75, lo = img => { const m = LY.lo || (LY.lo = new Map()); let c2 = m.get(img); if (!c2) { c2 = PV.makeCanvas(Math.round(1000 * LO), Math.round(1414 * LO)); c2.ctx.imageSmoothingQuality = 'high'; c2.ctx.drawImage(img, 0, 0, c2.canvas.width, c2.canvas.height); m.set(img, c2); } return c2.canvas; };
    ctx.drawImage(lo(sheetPaper(LY, o.paper || '#f4eee0', la)), 0, 0, 1000, 1414);
    const wh = sstep(0.1, 0.8, dis); if (wh > 0.003) { ctx.globalAlpha = wh; ctx.fillStyle = cs(white); ctx.fillRect(0, 0, 1000, 1414); ctx.globalAlpha = 1; }
    const fa = dis > 0.45 ? clamp(1 - (dis - 0.45) / 0.4) : 1;
    if (fa > 0.01) { ctx.globalAlpha = fa; ctx.drawImage(lo(LY.fixed), 0, 0, 1000, 1414); ctx.globalAlpha = 1; }
    const flying = []; const PM = profMarks(ctx, 'sheet');
    // remaining ink: a page-resolution buffer from which released cells are erased incrementally
    // (the old per-frame evenodd clip with hundreds of rects cost ~25 ms)
    const IB = LY.inkBuf || (LY.inkBuf = { c: PV.makeCanvas(Math.round(1000 * LO), Math.round(1414 * LO)), dis: -1 });
    if (dis < IB.dis || IB.dis < 0) { IB.c.ctx.globalCompositeOperation = 'copy'; IB.c.ctx.drawImage(lo(LY.notes), 0, 0); IB.c.ctx.globalCompositeOperation = 'source-over'; IB.dis = 0; }
    const cpx = CELL * LO;
    for (const c of LY.cells) {
      const q = (dis - c.rel) / 0.25; if (q <= 0) continue;
      if ((IB.dis - c.rel) / 0.25 <= 0) IB.c.ctx.clearRect(c.i * cpx - 0.5, c.j * cpx - 0.5, cpx + 1, cpx + 1);
      if (q < 1.6) flying.push([c, q]);
    }
    IB.dis = dis;
    ctx.drawImage(IB.c.canvas, 0, 0, 1000, 1414);
    ctx.restore();
    PM('page');
    // flying ink fragments: lift, drift, turn to light
    if (flying.length) {
      const base = ctx.getTransform(); const cs2 = CELL * SHEET_RES;
      for (const [c, q] of flying) {
        const e = PV.ease.inOutCubic(clamp(q / 1.6));
        const p0 = tp(c.cx, c.cy);
        const dx = (c.seed - 0.5) * 260 * e + Math.sin(q * 3 + c.seed * 20) * 18 * e, dy = -(140 + 380 * c.seed) * e * (o.rise || 1);
        // ink -> gold -> light: the fragment shrinks into a mote and gets BRIGHTER (additive) as it turns to light
        const sc = (1 + 0.3 * e) * (1 - 0.6 * sstep(0.45, 1, e)) * k;
        ctx.setTransform(base); ctx.translate(p0[0] + dx, p0[1] + dy); ctx.rotate((c.seed - 0.5) * 2.2 * e + rot); ctx.scale(sc, sc * sy);
        const sx0 = c.i * cs2, sy0 = c.j * cs2;
        if (e < 0.12) { ctx.globalAlpha = 1; ctx.drawImage(LY.notes, sx0, sy0, cs2, cs2, -CELL / 2, -CELL / 2, CELL, CELL); }
        else if (e < 0.4) { ctx.globalAlpha = 1; ctx.drawImage(LY.gold, sx0, sy0, cs2, cs2, -CELL / 2, -CELL / 2, CELL, CELL);
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = sstep(0.12, 0.4, e) * 0.8; ctx.drawImage(LY.glow, sx0, sy0, cs2, cs2, -CELL / 2, -CELL / 2, CELL, CELL); ctx.globalCompositeOperation = 'source-over'; }
        else {
          const al = Math.pow(clamp((1 - e) / 0.6), 0.8); if (al <= 0.02) continue;
          const tw = 0.75 + 0.25 * Math.sin(q * 14 + c.seed * 40);
          ctx.globalCompositeOperation = 'lighter';
          if (e < 0.62) { ctx.globalAlpha = 0.95 * al; ctx.drawImage(LY.glow, sx0, sy0, cs2, cs2, -CELL / 2, -CELL / 2, CELL, CELL); }
          if (e > 0.5 || (c.i + c.j) % 2 === 0) { ctx.globalAlpha = 0.75 * al * tw; ctx.drawImage(LY.glowSpr, -CELL * 1.1, -CELL * 1.1, CELL * 2.2, CELL * 2.2); }
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.setTransform(base); ctx.globalAlpha = 1;
    }
    PM('fragments(' + flying.length + ')'); PM('end');
    if (dis > 0.6) { ctx.save(); ctx.globalCompositeOperation = 'screen'; const c0 = tp(500, 707); const R = 900 * k; const gg = ctx.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], R); gg.addColorStop(0, `rgba(255,255,252,${0.5 * sstep(0.6, 1, dis)})`); gg.addColorStop(1, 'rgba(255,255,252,0)'); ctx.fillStyle = gg; ctx.fillRect(c0[0] - R, c0[1] - R, R * 2, R * 2); ctx.restore(); }
    ctx.restore();
    return { corners };
  };

  /* ======================================================================
   * CONCERT STAGE — competition hall (metres). stage floor y=0, x across, z: stage edge 0 -> upstage negative
   * ====================================================================== */
  function stageCam(o) {
    const v = o.view || 'audience'; let eye, tgt, fov;
    if (v === 'stage') { eye = [-3.2 + (o.camX || 0), 1.45, 3.2]; tgt = [0.6 + (o.camX || 0) * 0.5, 0.85, -3.3]; fov = 46; }
    else if (v === 'wide') { eye = [0.6 + (o.camX || 0), 2.6, 18]; tgt = [0.4 + (o.camX || 0) * 0.6, 1.4, -3]; fov = 46; }
    else { eye = [0.1 + (o.camX || 0), 1.05, 6.6]; tgt = [0.35 + (o.camX || 0) * 0.6, 0.95, -3.2]; fov = 40; }
    if (o.cam) { eye = o.cam.eye || eye; tgt = o.cam.target || tgt; fov = o.cam.fov || fov; }
    const focal = (W / 2) / Math.tan(fov * Math.PI / 360) * (o.zoom || 1);
    return makeCam(eye, tgt, focal, W / 2, H / 2, o.roll || 0, 0.05);
  }
  const STAGE_RES = {};
  L.concertStage = function (ctx, t, o = {}) {
    const cam = stageCam(o);
    const wo = clamp(o.whiteout || 0), spot = o.spot === undefined ? 1 : o.spot;
    const white = hx('#f8f8f6'), warm = hx(o.spotColor || '#fff1d8');
    const pianoAt = o.pianoAt || [0.35, -3.3];
    const Q = pts => cam.poly(pts);
    const ckey = cam.eye.concat(cam.f, cam.u).map(v => v.toFixed(4)).join(',') + ',' + cam.focal.toFixed(2);
    const floor = Q([[-9, 0, 0.2], [9, 0, 0.2], [9, 0, -9], [-9, 0, -9]]);
    const pc = cam.p([pianoAt[0], 0, pianoAt[1]]);
    const src = [pianoAt[0] - 0.4, 8.2, pianoAt[1] + 0.8];
    // 1. hall (cached)
    const hall = cachedLayer('stageHall', ckey + '|' + (o.spotColor || ''), W, H, (c) => {
      const lg = (a2, b2, stops) => { const pa = cam.p(a2), pb2 = cam.p(b2); const g = c.createLinearGradient(pa[0], pa[1], pb2[0], pb2[1]); for (const [k, col, al] of stops) g.addColorStop(k, cs(col, al)); return g; };
      c.lineJoin = 'round';
      c.fillStyle = PV.linGrad(c, 0, 0, 0, H, [[0, '#07080d'], [0.55, '#0e0f16'], [1, '#0a0a10']]); c.fillRect(0, 0, W, H);
      const back = Q([[-11, 0, -9], [11, 0, -9], [11, 9, -9], [-11, 9, -9]]);
      fillP(c, back, lg([0, 9, -9], [0, 0, -9], [[0, [7, 6, 8]], [0.6, [20, 14, 12]], [1, [30, 20, 15]]]));
      for (let k = -22; k <= 22; k++) { const x = k * 0.5; strokeL(c, cam.line([[x, 0, -8.98], [x, 7.5, -8.98]]), 'rgba(0,0,0,0.35)', 1); }
      for (const y of [2.4, 4.8]) strokeL(c, cam.line([[-11, y, -8.98], [11, y, -8.98]]), 'rgba(80,56,40,0.35)', 1.5);
      for (const sd of [-1, 1]) fillP(c, Q([[sd * 7.5, 0, 0.3], [sd * 9, 0, -9], [sd * 9, 9, -9], [sd * 7.5, 9, 0.3]]), lg([sd * 8, 6, -4], [sd * 8, 0, -4], [[0, [8, 7, 9]], [1, [30, 20, 15]]]));
      fillP(c, floor, lg([0, 0, -9], [0, 0, 0.2], [[0, [18, 12, 9]], [1, [34, 22, 15]]]));
      c.save(); c.beginPath(); trace(c, floor); c.clip();
      c.strokeStyle = 'rgba(10,6,4,0.35)'; c.lineWidth = 1; c.beginPath();
      for (let k = -60; k <= 60; k++) { const ln = cam.line([[k * 0.15, 0, 0.2], [k * 0.15, 0, -9]]).filter(Boolean); if (ln.length > 1) { c.moveTo(ln[0][0], ln[0][1]); c.lineTo(ln[ln.length - 1][0], ln[ln.length - 1][1]); } }
      c.stroke(); c.restore();
      fillP(c, Q([[-9, 0, 0.2], [9, 0, 0.2], [9, -1.1, 0.2], [-9, -1.1, 0.2]]), lg([0, 0, 0.2], [0, -1.1, 0.2], [[0, [40, 28, 20]], [0.1, [16, 12, 12]], [1, [8, 8, 10]]]));
      strokeL(c, cam.line([[-9, 0, 0.2], [9, 0, 0.2]]), cs(cadd([70, 50, 36], warm, 0.12), 0.9), 1.5);
      for (let k = -4; k <= 4; k++) { const p = cam.p([k * 1.9, 8.2, -1.5]); if (L.glow) L.glow(c, p[0], p[1], 26 + 10 * (k % 2 ? 0 : 1), '#ffe2b0', 0.6); c.fillStyle = 'rgba(255,246,226,0.9)'; c.beginPath(); c.arc(p[0], p[1], 2.2, 0, TAU); c.fill(); }
    });
    // 2. spot pool + beam (cached at half resolution, blurred)
    const pts = []; for (let k = 0; k < 24; k++) { const a2 = k / 24 * TAU; pts.push(cam.p([pianoAt[0] + Math.cos(a2) * 3.1, 0, pianoAt[1] + Math.sin(a2) * 2.2])); }
    const ps = cam.p(src); const beamHull = hull(pts.concat([ps]));
    const spotL = cachedLayer('stageSpot', ckey + '|' + (o.spotColor || ''), W / 2, H / 2, (c) => {
      const tmp = PV.buffer('instr:stageSpotTmp', W / 2, H / 2); const tc = tmp.ctx; tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, W / 2, H / 2); tc.setTransform(0.5, 0, 0, 0.5, 0, 0);
      tc.save(); tc.beginPath(); trace(tc, floor); tc.clip(); const prx = 3.3 * cam.scaleAt([pianoAt[0], 0, pianoAt[1]]);
      tc.translate(pc[0], pc[1]); tc.scale(1, 0.24); let g = tc.createRadialGradient(0, 0, 0, 0, 0, prx); g.addColorStop(0, cs(warm, 0.85)); g.addColorStop(0.45, cs(warm, 0.55)); g.addColorStop(0.75, cs(warm, 0.18)); g.addColorStop(1, cs(warm, 0));
      tc.fillStyle = g; tc.beginPath(); tc.arc(0, 0, prx, 0, TAU); tc.fill(); tc.restore();
      g = tc.createLinearGradient(ps[0], ps[1], pc[0], pc[1]); g.addColorStop(0, cs(warm, 0.5)); g.addColorStop(0.5, cs(warm, 0.2)); g.addColorStop(1, cs(warm, 0.1));
      tc.globalCompositeOperation = 'lighter'; fillP(tc, beamHull, g); tc.globalCompositeOperation = 'source-over'; tc.setTransform(1, 0, 0, 1, 0, 0);
      c.filter = 'blur(3px)'; c.drawImage(tmp.canvas, 0, 0); c.filter = 'none';
    });
    // 3. piano with its warm rim baked in (cached) + white-out rim layer
    const popts = Object.assign({ roomCam: cam, at: pianoAt, rotY: o.pianoYaw || 0, length: 2.75, lidOpen: o.lidOpen === undefined ? 1 : o.lidOpen, bench: o.bench !== false, env: 'stage', lightColor: o.spotColor || '#fff1d8', lightDirRoom: vnorm([-0.2, 1, 0.45]), shadow: 0.0 }, o.piano || {});
    const pkey = ckey + '|' + JSON.stringify([pianoAt, o.pianoYaw || 0, popts.lidOpen, popts.bench, o.spotColor || '', o.piano || {}]);
    let res = null;
    const raw = cachedLayer('stagePianoRaw', pkey, W, H, (c) => { res = pianoDraw(c, popts, false); STAGE_RES[pkey] = res; });
    res = res || STAGE_RES[pkey];
    const pianoL = cachedLayer('stagePiano', pkey, W, H, (c) => { c.drawImage(raw, 0, 0); rimLight(c, raw, { bbox: res.bbox, dx: 0, dy: -2, color: o.spotColor || '#fff1d8', alpha: 0.75, soft: 8, softAlpha: 0.25 }); });
    // ---- compose
    ctx.save(); ctx.lineJoin = 'round';
    ctx.drawImage(hall, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = spot; ctx.drawImage(spotL, 0, 0, W, H); ctx.restore();
    if (L.dust) L.dust(ctx, t, { seed: 61, count: 70, size: 2, alpha: 0.55 * spot * (1 - wo), color: '#fff3dc', mask: (x, y) => pointInPoly(x, y, beamHull) ? 1 : 0 });
    const fy = cam.p([pianoAt[0], 0, pianoAt[1] + 0.75])[1];
    ctx.save(); ctx.beginPath(); trace(ctx, floor); ctx.clip(); ctx.globalAlpha = 0.22 * (1 - wo); ctx.translate(0, fy * 2); ctx.scale(1, -1); ctx.drawImage(raw, 0, 0); ctx.restore();
    { const sc = cam.scaleAt([pianoAt[0], 0, pianoAt[1]]); const c0 = cam.p([pianoAt[0] + 0.2, 0, pianoAt[1]]); ctx.save(); ctx.translate(c0[0], c0[1]); ctx.scale(1, 0.18); const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.6 * sc); sg.addColorStop(0, 'rgba(4,3,5,0.6)'); sg.addColorStop(1, 'rgba(4,3,5,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 1.6 * sc, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.drawImage(pianoL, 0, 0);
    if (o.seats !== false && (o.view || 'audience') !== 'stage') {
      const seats = cachedLayer('stageSeats', ckey + '|' + (o.spotColor || ''), W, H, (c) => {
        const rows = [];
        for (let r = 0; r < 4; r++) { const z = 1.6 + r * 1.0, yb = -1.12 + r * 0.1; if (z > cam.eye[2] - 1.2) continue; for (let k = -11; k <= 11; k++) rows.push([k * 0.56 + (r % 2) * 0.28, yb, z]); }
        rows.sort((a2, b2) => cam.depth(b2) - cam.depth(a2));
        for (const [x, yb, z] of rows) {
          const sc = cam.scaleAt([x, yb, z]); if (sc <= 0) continue;
          const p = cam.p([x, yb + 0.95, z]); if (p[2] < 0.3) continue;
          const w = 0.5 * sc, h = 0.62 * sc; if (p[0] < -w || p[0] > W + w) continue;
          c.fillStyle = '#0a0a0f'; c.beginPath(); c.moveTo(p[0] - w / 2, p[1] + h); c.lineTo(p[0] - w / 2, p[1] + w * 0.28); c.quadraticCurveTo(p[0] - w / 2, p[1], p[0] - w * 0.2, p[1]); c.lineTo(p[0] + w * 0.2, p[1]); c.quadraticCurveTo(p[0] + w / 2, p[1], p[0] + w / 2, p[1] + w * 0.28); c.lineTo(p[0] + w / 2, p[1] + h); c.closePath(); c.fill();
          c.strokeStyle = cs(cmix([120, 60, 60], warm, 0.4), 0.35); c.lineWidth = Math.max(0.8, sc * 0.012); c.beginPath(); c.moveTo(p[0] - w * 0.38, p[1] + w * 0.05); c.quadraticCurveTo(p[0], p[1] - w * 0.02, p[0] + w * 0.38, p[1] + w * 0.05); c.stroke();
        }
      });
      ctx.save(); ctx.globalAlpha = 1; ctx.drawImage(seats, 0, 0); ctx.restore();
    }
    // white-out: the world dissolves into white; only the piano stays
    if (wo > 0) {
      ctx.fillStyle = cs(white, PV.ease.inOutCubic(clamp(wo / 0.85))); ctx.fillRect(-W, -H, W * 3, H * 3);
      const pw = sstep(0.15, 0.9, wo);
      const sc = cam.scaleAt([pianoAt[0], 0, pianoAt[1]]); const c0 = cam.p([pianoAt[0] + 0.2, 0, pianoAt[1]]);
      ctx.save(); ctx.translate(c0[0], c0[1]); ctx.scale(1, 0.16); const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 2.2 * sc); sg.addColorStop(0, `rgba(120,124,136,${0.35 * pw * (o.floatShadow === undefined ? 1 : o.floatShadow)})`); sg.addColorStop(1, 'rgba(120,124,136,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 2.2 * sc, 0, TAU); ctx.fill(); ctx.restore();
      // the same piano re-lit by the white world: its lacquer now mirrors white (bright edges, white lid sheen)
      const rawW = cachedLayer('stagePianoWhite', pkey, W, H, (c) => { pianoDraw(c, Object.assign({}, popts, { env: null, envObj: { lights: [], ceil: [244, 244, 242], floor: [232, 232, 230], horizon: [246, 246, 244] }, lightColor: '#ffffff', sheen: 1.4, lidGold: false }), false); });
      ctx.save(); ctx.globalAlpha = pw * (1 - sstep(0.55, 1, wo)); ctx.drawImage(raw, 0, 0); ctx.globalAlpha = pw * sstep(0.35, 1, wo); ctx.drawImage(rawW, 0, 0); ctx.restore();
      const wr = cachedLayer('stageWhiteRim', pkey, W, H, (c) => { rimLight(c, raw, { bbox: res.bbox, dx: 0, dy: -3, color: '#ffffff', alpha: 0.6, soft: 14, softAlpha: 0.5 }); rimLight(c, raw, { bbox: res.bbox, dx: 0, dy: 3, color: '#ffffff', alpha: 0.3, soft: 10, softAlpha: 0.4 }); });
      ctx.save(); ctx.globalAlpha = pw; ctx.globalCompositeOperation = 'screen'; ctx.drawImage(wr, 0, 0); ctx.restore();
    }
    ctx.restore();
    return { cam, piano: res, bench: res.bench, keyboard: res.keyboard, project: p => cam.p(p) };
  };

  /* ======================================================================
   * GYM STAGE — school-festival live in the gym (floor-level stage behind a rope)
   * world metres: x across, y up, z toward the camera (performance area around z=-2)
   * ====================================================================== */
  function gymCam(o) {
    const standing = o.crowd === 'standing';
    let eye = [0.3 + (o.camX || 0), standing ? 1.95 : 1.5, 7.2], tgt = [0.25 + (o.camX || 0) * 0.5, standing ? 0.95 : 0.85, -3.0], fov = 50;
    if (o.view === 'close') { eye = [-0.6 + (o.camX || 0), 1.3, 3.2]; tgt = [0.2, 1.25, -2.8]; fov = 50; }
    if (o.cam) { eye = o.cam.eye || eye; tgt = o.cam.target || tgt; fov = o.cam.fov || fov; }
    const focal = (W / 2) / Math.tan(fov * Math.PI / 360) * (o.zoom || 1);
    return makeCam(eye, tgt, focal, W / 2, H / 2, o.roll || 0, 0.05);
  }
  /* ---- gym stage props in 3-D (drawn through the gym camera, cached with the hall) ---- */
  // shade a surface normal with the stage rig: warm key from front-left, magenta fill from front-right, cyan/magenta back rims
  function rigShade(base, n, R) {
    let c = cfilt(base, R.amb);
    for (const l of R.lights) { const d = Math.max(0, vdot(n, l.dir)); if (d > 0) c = cadd(c, cfilt(base, l.col), d * l.k); }
    for (const l of R.rims) { const d = Math.max(0, vdot(n, l.dir)); if (d > 0) c = cadd(c, l.col, Math.pow(d, 3) * l.k); }
    return c;
  }
  function rigSpec(n, P, cam, R, pw) { const vd = vnorm(vsub(P, cam.eye)); const Rf = reflect(vd, n); let c = [0, 0, 0]; for (const l of R.lights.concat(R.rims)) { const s = Math.pow(Math.max(0, vdot(Rf, l.dir)), pw || 30); if (s > 0.002) c = cadd(c, l.col, s * (l.spec || 1.4)); } return c; }
  // a drum: shell cylinder (centre C, axis ax, radius r, depth dep) + the head facing the camera + chrome hoop + lugs
  function drum3(c, cam, C, ax, r, dep, o, R) {
    ax = vnorm(ax); const u = vnorm(vcross(ax, Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), v = vcross(ax, u);
    const A = vadd(C, vmul(ax, dep / 2)), B = vsub(C, vmul(ax, dep / 2)); const N = 30; const ra = [], rb = [];
    for (let k = 0; k < N; k++) { const a = k / N * TAU; const off = vadd(vmul(u, Math.cos(a) * r), vmul(v, Math.sin(a) * r)); ra.push(vadd(A, off)); rb.push(vadd(B, off)); }
    const pa = ra.map(cam.p), pb = rb.map(cam.p); if (pa.concat(pb).some(p => p[2] < cam.near)) return;
    const e = vsub(cam.eye, C); const ep = vsub(e, vmul(ax, vdot(e, ax))); const aV = Math.atan2(vdot(ep, v), vdot(ep, u));
    const nAt = a => vadd(vmul(u, Math.cos(a)), vmul(v, Math.sin(a)));
    const s0 = cam.p(vadd(C, vmul(nAt(aV - Math.PI / 2), r))), s1 = cam.p(vadd(C, vmul(nAt(aV + Math.PI / 2), r)));
    const g = c.createLinearGradient(s0[0], s0[1], s1[0], s1[1]);
    for (const tt of [0, 0.12, 0.3, 0.5, 0.7, 0.88, 1]) { const n = nAt(aV - Math.PI / 2 + Math.PI * tt); const P = vadd(C, vmul(n, r)); g.addColorStop(tt, cs(cadd(rigShade(o.shell, n, R), rigSpec(n, P, cam, R, 26), 0.55 * (o.gloss || 1)))); }
    fillP(c, hull(pa.concat(pb)), g);
    // sparkle-finish flecks on the visible half
    if (o.sparkle) { const rr = PV.rng(o.seed || 3); c.fillStyle = cs(cadd(o.shell, [120, 90, 90]), 0.5); for (let k = 0; k < 40; k++) { const a = aV + (rr() - 0.5) * 2.8, h = (rr() - 0.5) * dep * 0.9; const P = vadd(vadd(C, vmul(nAt(a), r * 1.002)), vmul(ax, h)); const p = cam.p(P); c.fillRect(p[0], p[1], 1.2, 1.2); } }
    // lugs on the visible half
    const sc = cam.scaleAt(C); const nL = o.lugs || 8;
    for (let k = 0; k < nL; k++) { const a = k / nL * TAU; if (Math.cos(a - aV) < 0.15) continue; const P = vadd(C, vmul(nAt(a), r * 1.03)); const p = cam.p(P); const n = nAt(a);
      c.fillStyle = cs(cadd(rigShade([150, 150, 158], n, R), rigSpec(n, P, cam, R, 18), 0.8)); c.fillRect(p[0] - 0.012 * sc, p[1] - Math.min(0.32, dep * 0.6) * sc * 0.5, 0.024 * sc, Math.min(0.32, dep * 0.6) * sc); }
    // visible head + hoop
    const head = vdot(ax, vsub(cam.eye, A)) > 0 ? { ring: pa, n: ax, P: A } : vdot(vmul(ax, -1), vsub(cam.eye, B)) > 0 ? { ring: pb, n: vmul(ax, -1), P: B } : null;
    if (head) {
      const hc = cadd(rigShade(o.head, head.n, R), rigSpec(head.n, head.P, cam, R, 8), 0.25);
      const ctr = cam.p(head.P); const gg = c.createRadialGradient(ctr[0] - r * sc * 0.25, ctr[1] - r * sc * 0.2, 0, ctr[0], ctr[1], r * sc * 1.1); gg.addColorStop(0, cs(cmul(hc, 1.08))); gg.addColorStop(1, cs(cmul(hc, 0.82)));
      fillP(c, head.ring, gg);
      if (o.port) { const ring = []; for (let k = 0; k < 20; k++) { const a = k / 20 * TAU; ring.push(cam.p(vadd(vadd(head.P, vmul(u, Math.cos(a) * r * 0.22 + r * 0.35)), vmul(v, Math.sin(a) * r * 0.22 - r * 0.32)))); } fillP(c, ring, cs(cmul(o.shell, 0.18))); }
      if (o.ring) { c.strokeStyle = cs(o.ring, 0.9); c.lineWidth = Math.max(1, r * sc * 0.05); c.beginPath(); trace(c, head.ring.map(p => [lerp(ctr[0], p[0], 0.78), lerp(ctr[1], p[1], 0.78)])); c.stroke(); }
      c.strokeStyle = cs(cadd(rigShade([170, 170, 178], head.n, R), [60, 60, 66])); c.lineWidth = Math.max(1.2, 0.022 * sc); c.beginPath(); trace(c, head.ring); c.stroke();
      c.strokeStyle = cs([255, 255, 255], 0.5); c.lineWidth = Math.max(0.8, 0.008 * sc); c.beginPath(); const k0 = Math.floor(((aV + Math.PI * 0.75) / TAU % 1 + 1) % 1 * N); for (let k = 0; k < 6; k++) { const p = head.ring[(k0 + k) % N]; if (k) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); } c.stroke();
    }
  }
  function cymbal3(c, cam, C, n, r, R, seed) {
    n = vnorm(n); const u = vnorm(vcross(n, Math.abs(n[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])), v = vcross(n, u); const N = 36;
    const ring = []; for (let k = 0; k < N; k++) { const a = k / N * TAU; const dome = 0; ring.push(cam.p(vadd(vadd(C, vmul(vadd(vmul(u, Math.cos(a)), vmul(v, Math.sin(a))), r)), vmul(n, dome)))); }
    if (ring.some(p => p[2] < cam.near)) return;
    const facing = vdot(n, vsub(cam.eye, C)) > 0 ? n : vmul(n, -1);
    const bronze = [196, 150, 64]; const base = cadd(rigShade(bronze, facing, R), rigSpec(facing, C, cam, R, 6), 0.35);
    const pc = cam.p(C); const sc = cam.scaleAt(C);
    const g = c.createRadialGradient(pc[0], pc[1], 0, pc[0], pc[1], r * sc); g.addColorStop(0, cs(cmul(base, 1.15))); g.addColorStop(0.25, cs(cmul(base, 0.85))); g.addColorStop(0.6, cs(base)); g.addColorStop(1, cs(cmul(base, 0.7)));
    fillP(c, ring, g);
    // lathe grooves + a bright specular streak across the disc
    c.save(); c.beginPath(); trace(c, ring); c.clip();
    for (let k = 1; k < 7; k++) { c.strokeStyle = cs(k % 2 ? [255, 236, 190] : [90, 60, 20], 0.18); c.lineWidth = 1; c.beginPath(); trace(c, ring.map(p => [lerp(pc[0], p[0], k / 7), lerp(pc[1], p[1], k / 7)])); c.stroke(); }
    const sp = rigSpec(facing, C, cam, R, 4); const sk = Math.min(1, (sp[0] + sp[1] + sp[2]) / 400 + 0.25);
    const a = PV.rand1(seed || 1, 3) * Math.PI; const sx = Math.cos(a) * r * sc, sy = Math.sin(a) * r * sc * 0.4;
    const sg = c.createLinearGradient(pc[0] - sy, pc[1] + sx, pc[0] + sy, pc[1] - sx); sg.addColorStop(0, 'rgba(255,250,230,0)'); sg.addColorStop(0.5, `rgba(255,250,230,${0.55 * sk})`); sg.addColorStop(1, 'rgba(255,250,230,0)');
    c.fillStyle = sg; c.fillRect(pc[0] - r * sc, pc[1] - r * sc, r * sc * 2, r * sc * 2); c.restore();
    c.strokeStyle = cs(cmul(base, 0.55)); c.lineWidth = Math.max(0.8, 0.006 * sc); c.beginPath(); trace(c, ring); c.stroke();
    c.fillStyle = cs(cmul(base, 1.2)); c.beginPath(); c.ellipse(pc[0], pc[1], r * sc * 0.16, r * sc * 0.16 * Math.max(0.2, Math.abs(vdot(facing, vnorm(vsub(cam.eye, C))))), 0, 0, TAU); c.fill();
  }
  function stand3(c, cam, base, top, R, legs = true) {
    const sc = cam.scaleAt(base); const metal = cadd(rigShade([120, 120, 130], [0, 0.4, 0.9], R), [20, 20, 24]);
    const seg = (a, b, w) => { const p = cam.p(a), q = cam.p(b); c.strokeStyle = cs(metal); c.lineWidth = Math.max(1, w * sc); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); c.strokeStyle = cs(cadd(metal, [90, 90, 96]), 0.7); c.lineWidth = Math.max(0.6, w * sc * 0.35); c.beginPath(); c.moveTo(p[0] - w * sc * 0.25, p[1]); c.lineTo(q[0] - w * sc * 0.25, q[1]); c.stroke(); };
    const hub = [base[0], base[1] + 0.32, base[2]];
    if (legs) for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + 0.5; seg([base[0] + Math.cos(a) * 0.26, base[1], base[2] + Math.sin(a) * 0.26], hub, 0.014); }
    seg(legs ? hub : base, top, 0.016);
  }
  function drumKit3(c, cam, kx, kz, R) {
    const shell = [120, 24, 38], head = [236, 232, 222];
    const items = [];
    const add = (P, fn) => items.push({ d: cam.depth(P), fn });
    // cymbals & stands (far ones first via depth sort)
    for (const [x, y, z, r, tx, tz, sd] of [[-0.62, 1.42, -0.08, 0.23, 0.35, 0.25, 11], [0.72, 1.28, -0.02, 0.27, -0.3, 0.2, 12], [0.32, 1.56, -0.42, 0.2, -0.15, 0.3, 13]]) {
      add([kx + x, y, kz + z - 0.3], () => { stand3(c, cam, [kx + x * 1.15, 0, kz + z - 0.15], [kx + x, y - 0.02, kz + z], R); cymbal3(c, cam, [kx + x, y, kz + z], [tx, 1, tz], r, R, sd); });
    }
    add([kx - 0.82, 0.9, kz - 0.32], () => { stand3(c, cam, [kx - 0.82, 0, kz - 0.32], [kx - 0.82, 0.95, kz - 0.32], R); cymbal3(c, cam, [kx - 0.82, 0.93, kz - 0.32], [0.05, 1, 0.1], 0.18, R, 21); cymbal3(c, cam, [kx - 0.82, 0.965, kz - 0.32], [0.05, 1, 0.1], 0.18, R, 22); });
    add([kx + 0.55, 0.3, kz - 0.28], () => { for (const [lx, lz] of [[0.2, 0.12], [-0.12, 0.2], [0.05, -0.2]]) stand3(c, cam, [kx + 0.55 + lx * 1.15, 0, kz - 0.28 + lz * 1.15], [kx + 0.55 + lx * 0.95, 0.35, kz - 0.28 + lz * 0.95], R, false); drum3(c, cam, [kx + 0.55, 0.46, kz - 0.28], [0, 1, 0.05], 0.2, 0.36, { shell, head, sparkle: true, seed: 5, lugs: 8 }, R); });
    add([kx - 0.5, 0.4, kz - 0.22], () => { stand3(c, cam, [kx - 0.5, 0, kz - 0.22], [kx - 0.5, 0.55, kz - 0.22], R); drum3(c, cam, [kx - 0.5, 0.62, kz - 0.22], [0.08, 1, 0.12], 0.18, 0.13, { shell: [178, 178, 186], head, gloss: 1.6, lugs: 10 }, R); });
    add([kx, 0.28, kz + 0.1], () => drum3(c, cam, [kx, 0.29, kz + 0.06], [0, 0, 1], 0.28, 0.4, { shell, head: [30, 28, 34], sparkle: true, seed: 7, lugs: 10, port: true, ring: [210, 190, 150] }, R));
    for (const [x, y, z, r, tilt, sd] of [[-0.17, 0.76, -0.06, 0.12, -0.18, 8], [0.18, 0.78, -0.06, 0.13, 0.18, 9]]) add([kx + x, y, kz + z + 0.2], () => drum3(c, cam, [kx + x, y, kz + z], [tilt, 0.85, -0.5], r, 0.22, { shell, head, sparkle: true, seed: sd, lugs: 6 }, R));
    items.sort((a, b) => b.d - a.d).forEach(it => it.fn());
  }
  // 61-key keyboard on an X-stand, in 3-D
  function keyboard3(c, cam, x, z, yaw, R) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw); const T = (px, py, pz) => [x + px * cy - pz * sy, py, z + px * sy + pz * cy];
    const sc = cam.scaleAt([x, 0.8, z]);
    const legs = [[-0.3, 0], [0.3, 0]]; c.lineCap = 'round';
    for (const [lx] of legs) for (const s2 of [-1, 1]) { const a = cam.p(T(lx, 0, s2 * 0.22)), b = cam.p(T(lx, 0.76, -s2 * 0.16)); c.strokeStyle = cs(rigShade([60, 60, 68], [0, 0.3, 1], R)); c.lineWidth = Math.max(1, 0.025 * sc); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    const bx = box(-0.5, 0.78, -0.17, 0.5, 0.86, 0.17).map(p => T(p[0], p[1], p[2]));
    drawHex(c, cam, bx, (nr, fc) => cs(cadd(rigShade([34, 34, 40], nr, R), rigSpec(nr, fc, cam, R, 30), 0.4)));
    const keys = cam.poly([T(-0.46, 0.862, 0.16), T(0.46, 0.862, 0.16), T(0.46, 0.862, 0.02), T(-0.46, 0.862, 0.02)]);
    if (keys) { fillP(c, keys, cs(rigShade([236, 232, 222], [0, 1, 0], R)));
      c.fillStyle = '#121216'; for (let k = 0; k < 61; k++) { const pc = k % 12; if ([1, 3, 6, 8, 10].indexOf(pc) < 0) continue; const f = (Math.floor(k / 12) * 7 + [0, 0.6, 1, 1.75, 2, 3, 3.55, 4, 4.65, 5, 5.7, 6][pc]) / 36; const q = cam.poly([T(-0.46 + f * 0.92, 0.866, 0.08), T(-0.45 + f * 0.92, 0.866, 0.08), T(-0.45 + f * 0.92, 0.866, 0.02), T(-0.46 + f * 0.92, 0.866, 0.02)]); if (q) fillP(c, q, '#141418'); } }
  }
  L.gymStage = function (ctx, t, o = {}) {
    const cam = gymCam(o);
    const beams = o.beams === undefined ? 1 : o.beams, flash = clamp(o.flash || 0);
    const cols = (o.colors || ['#ffbf6b', '#ff5fa8', '#5fd7ff']).map(hx);
    const Q = pts => cam.poly(pts);
    // stage rig used to shade the 3-D props: amber key from front-left, magenta from front-right, back rims
    const RIG = { amb: [46, 42, 58], lights: [{ dir: vnorm([-5.4, 1.8, 2.4]), col: cols[0], k: 0.95, spec: 1.6 }, { dir: vnorm([5.2, 1.8, 2.2]), col: cols[1], k: 0.6, spec: 1.2 }, { dir: vnorm([0.1, 0.5, 1]), col: [196, 192, 210], k: 0.28, spec: 0.5 }],
      rims: [{ dir: vnorm([-0.45, 0.7, -0.6]), col: cols[2], k: 0.9, spec: 1.2 }, { dir: vnorm([0.5, 0.7, -0.6]), col: cols[1], k: 0.7, spec: 1 }] };
    const T0 = ctx.getTransform();
    const ckey = cam.eye.concat(cam.f, cam.u).map(v => v.toFixed(4)).join(',') + ',' + cam.focal.toFixed(2);
    const lampOn = o.lamp === undefined ? 1 : o.lamp;
    const lamps = [[-5.2, 2.6, -1.0, 0], [5.4, 2.6, -1.2, 1], [-2.6, 9.4, -4.5, 2], [2.8, 9.4, -4.5, 0], [0, 9.6, -6, 1]];
    const hall = cachedLayer('gymHall', ckey + '|' + (o.banner || '') + '|' + lampOn.toFixed(2) + '|' + (o.colors || []).join(','), W, H, (c) => {
    c.lineJoin = 'round';
    c.fillStyle = '#141420'; c.fillRect(-W, -H, W * 3, H * 3);
    // far wall: raised proscenium stage with closed curtain, banner, blackout curtains on side walls
    const lg = (a, b, stops) => { const pa = cam.p(a), pb = cam.p(b); const g = c.createLinearGradient(pa[0], pa[1], pb[0], pb[1]); for (const [k, col, al] of stops) g.addColorStop(k, cs(col, al)); return g; };
    fillP(c, Q([[-16, 0, -12], [16, 0, -12], [16, 11, -12], [-16, 11, -12]]), lg([0, 11, -12], [0, 0, -12], [[0, [10, 10, 16]], [1, [26, 24, 34]]]));
    fillP(c, Q([[-7, 1.1, -11.9], [7, 1.1, -11.9], [7, 5.4, -11.9], [-7, 5.4, -11.9]]), lg([0, 5.4, -11.9], [0, 1.1, -11.9], [[0, [22, 7, 12]], [1, [44, 12, 20]]]));
    for (let k = -28; k <= 28; k++) { const x = k * 0.25; strokeL(c, cam.line([[x, 1.1, -11.85], [x + Math.sin(k) * 0.03, 5.4, -11.85]]), k % 2 ? 'rgba(0,0,0,0.35)' : 'rgba(150,50,70,0.18)', 1.2); }
    fillP(c, Q([[-7.4, 0, -11.6], [7.4, 0, -11.6], [7.4, 1.1, -11.6], [-7.4, 1.1, -11.6]]), cs([30, 26, 34]));
    fillP(c, Q([[-7.6, 5.4, -11.8], [7.6, 5.4, -11.8], [7.6, 6.9, -11.8], [-7.6, 6.9, -11.8]]), cs([22, 18, 26]));
    // festival banner + paper chain
    const bq = Q([[-3.6, 5.75, -11.7], [3.6, 5.75, -11.7], [3.6, 6.4, -11.7], [-3.6, 6.4, -11.7]]); fillP(c, bq, cs([168, 164, 156])); 
    if (bq) { const c0 = cam.p([0, 6.08, -11.7]); const sc = cam.scaleAt([0, 6.08, -11.7]); c.fillStyle = cs([40, 70, 140]); c.font = `700 ${Math.round(0.45 * sc)}px Shippori, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.banner || '文 化 祭', c0[0], c0[1]); }
    const chain = []; for (let k = 0; k <= 40; k++) { const x = -9 + k * 0.45; chain.push([x, 8.2 - Math.sin(k / 40 * Math.PI * 3) * 0.3 - 0.25, -11]); }
    const chp = cam.line(chain); for (let k = 0; k < chp.length; k++) { const p = chp[k]; if (!p) continue; c.fillStyle = cs(cols[k % 3], 0.5); c.beginPath(); c.arc(p[0], p[1], 3, 0, TAU); c.fill(); }
    for (const s of [-1, 1]) {
      fillP(c, Q([[s * 14, 0, 9], [s * 14, 0, -12], [s * 14, 11, -12], [s * 14, 11, 9]]), lg([s * 14, 11, -2], [s * 14, 0, -2], [[0, [12, 12, 18]], [1, [24, 22, 32]]]));
      for (let k = 0; k < 7; k++) { const z = -11 + k * 2.6; fillP(c, Q([[s * 13.95, 5.2, z], [s * 13.95, 5.2, z + 1.8], [s * 13.95, 8.4, z + 1.8], [s * 13.95, 8.4, z]]), cs([8, 8, 12])); }
    }
    // ceiling trusses
    for (let k = 0; k < 6; k++) { const z = -11 + k * 3.6; strokeL(c, cam.line([[-14, 10.5, z], [14, 10.5, z]]), 'rgba(40,40,52,0.9)', 2); strokeL(c, cam.line([[-14, 9.6, z], [14, 9.6, z]]), 'rgba(40,40,52,0.7)', 1.5); }
    // basketball hoop (folded up) silhouettes
    for (const s of [-1, 1]) { const p = cam.p([s * 9, 7.5, -10.5]); const sc = cam.scaleAt([s * 9, 7.5, -10.5]); c.fillStyle = 'rgba(30,30,40,0.9)'; c.fillRect(p[0] - 0.9 * sc, p[1] - 0.6 * sc, 1.8 * sc, 1.05 * sc); c.strokeStyle = 'rgba(180,80,60,0.5)'; c.lineWidth = 2; c.strokeRect(p[0] - 0.3 * sc, p[1], 0.6 * sc, 0.35 * sc); }
    // gym floor (wood) with court lines
    const fl = Q([[-14, 0, 9], [14, 0, 9], [14, 0, -12], [-14, 0, -12]]);
    fillP(c, fl, lg([0, 0, -12], [0, 0, 8], [[0, [40, 30, 26]], [1, [70, 52, 40]]]));
    c.save(); c.beginPath(); trace(c, fl); c.clip();
    for (let k = -40; k <= 40; k++) strokeL(c, cam.line([[k * 0.35, 0, 9], [k * 0.35, 0, -12]]), 'rgba(10,8,8,0.25)', 1);
    strokeL(c, cam.line([[-12, 0.001, -9], [12, 0.001, -9]]), 'rgba(220,200,120,0.35)', 2);
    strokeL(c, cam.line([[-12, 0.001, -9], [-12, 0.001, 9]]), 'rgba(220,200,120,0.35)', 2); strokeL(c, cam.line([[12, 0.001, -9], [12, 0.001, 9]]), 'rgba(220,200,120,0.35)', 2);
    { const arc = []; for (let k = 0; k <= 30; k++) { const a = k / 30 * Math.PI; arc.push([Math.cos(a) * 4.8, 0.001, -9 + Math.sin(a) * 4.8]); } strokeL(c, cam.line(arc), 'rgba(200,90,70,0.35)', 2); }
    c.restore();
    // makeshift backstage partitions: cloth panels in aluminium frames on T-feet (opaque, lit by the rig)
    for (let k = -3; k < 3; k++) {
      const x0 = k * 1.9 + 0.1, x1 = x0 + 1.8, zP = -6.2, sc2 = cam.scaleAt([x0 + 0.9, 1, zP]);
      const cloth = cmul(rigShade([92, 96, 114], [0, 0, 1], RIG), 0.62);
      fillP(c, Q([[x0 + 0.03, 0.12, zP], [x1 - 0.03, 0.12, zP], [x1 - 0.03, 1.87, zP], [x0 + 0.03, 1.87, zP]]), lg([0, 1.9, zP], [0, 0.1, zP], [[0, cmul(cloth, 1.05)], [0.6, cmul(cloth, 0.85)], [1, cmul(cloth, 0.62)]]));
      for (let q = 1; q < 9; q++) strokeL(c, cam.line([[lerp(x0, x1, q / 9), 0.14, zP + 0.002], [lerp(x0, x1, q / 9), 1.86, zP + 0.002]]), cs(cmul(cloth, 0.8), 0.25), 1);
      const fr = cmul(cadd(rigShade([168, 168, 178], [0, 0.3, 1], RIG), [24, 24, 28]), 0.7);
      strokeL(c, cam.line([[x0, 0.1, zP + 0.01], [x1, 0.1, zP + 0.01], [x1, 1.9, zP + 0.01], [x0, 1.9, zP + 0.01], [x0, 0.1, zP + 0.01]]), cs(fr), Math.max(1.5, 0.035 * sc2));
      strokeL(c, cam.line([[x0, 1.9, zP + 0.012], [x1, 1.9, zP + 0.012]]), cs(cadd(fr, [70, 70, 70]), 0.8), Math.max(1, 0.012 * sc2));
      for (const fxp of [x0 + 0.22, x1 - 0.22]) { strokeL(c, cam.line([[fxp, 0.02, zP - 0.24], [fxp, 0.02, zP + 0.24]]), cs(cmul(fr, 0.6)), Math.max(1.5, 0.04 * sc2)); strokeL(c, cam.line([[fxp, 0.02, zP], [fxp, 0.12, zP]]), cs(cmul(fr, 0.7)), Math.max(1.2, 0.03 * sc2)); }
    }

      // static equipment
      const t = 0;
    // equipment (2-D sprites placed in 3-D), far -> near
    const kit = [];
    kit.push({ z: -3.4, draw: () => { drumKit3(c, cam, 0.2, -3.4, RIG); } });
    kit.push({ z: -2.9, draw: () => { const p = cam.p([-2.7, 0, -2.9]); const sc = cam.scaleAt([-2.7, 0, -2.9]); L.amp(c, t, { x: p[0], y: p[1], h: 0.62 * sc, lamp: o.lamp === undefined ? 1 : o.lamp, ambient: 0.35, view: 'threeQuarter', angle: 0.35 }); } });
    kit.push({ z: -3.0, draw: () => { const p = cam.p([2.9, 0, -3.0]); const sc = cam.scaleAt([2.9, 0, -3.0]); L.amp(c, t, { x: p[0], y: p[1], h: 0.95 * sc, w: 0.62 * sc, lamp: 1, ambient: 0.3, view: 'threeQuarter', angle: -0.35, grille: 'black' }); } });
    kit.push({ z: -1.6, draw: () => { keyboard3(c, cam, 2.0, -1.6, -0.25, RIG); } });
    for (const [mx, mz] of [[-1.1, -0.9], [0.7, -1.0]]) kit.push({ z: mz, draw: () => { const a = cam.p([mx, 0, mz]), b = cam.p([mx, 1.55, mz]), sc = cam.scaleAt([mx, 0, mz]); c.strokeStyle = '#2a2a34'; c.lineWidth = Math.max(1, 0.02 * sc); c.beginPath(); c.moveTo(a[0] - 0.22 * sc, a[1]); c.lineTo(a[0], a[1] - 0.1 * sc); c.lineTo(a[0] + 0.22 * sc, a[1]); c.moveTo(a[0], a[1] - 0.1 * sc); c.lineTo(b[0], b[1]); c.stroke(); c.fillStyle = '#3a3a46'; c.beginPath(); c.ellipse(b[0], b[1] - 0.05 * sc, 0.03 * sc, 0.06 * sc, 0.3, 0, TAU); c.fill(); } });
    for (const [lx, ly, lz] of lamps.slice(0, 2)) kit.push({ z: lz, draw: () => { const a = cam.p([lx, 0, lz]), b = cam.p([lx, ly, lz]), sc = cam.scaleAt([lx, 0, lz]); c.strokeStyle = '#22222c'; c.lineWidth = Math.max(1, 0.025 * sc); c.beginPath(); c.moveTo(a[0] - 0.4 * sc, a[1]); c.lineTo(b[0], b[1] + 0.4 * sc); c.lineTo(a[0] + 0.4 * sc, a[1]); c.moveTo(b[0], b[1] + 0.4 * sc); c.lineTo(b[0], b[1]); c.stroke(); c.fillStyle = '#18181f'; c.fillRect(b[0] - 0.5 * sc, b[1] - 0.12 * sc, sc, 0.24 * sc); } });
    kit.sort((a, b) => a.z - b.z).forEach(k => k.draw());
    // rope barrier
    { const posts = []; for (let k = -6; k <= 6; k++) posts.push([k * 1.0, 0, 0.9]);
      for (const p0 of posts) { const sc2 = cam.scaleAt(p0); const a = cam.p(p0), b = cam.p([p0[0], 0.88, p0[2]]); const base = []; for (let q = 0; q < 16; q++) { const an = q / 16 * TAU; base.push(cam.p([p0[0] + Math.cos(an) * 0.16, 0.01, p0[2] + Math.sin(an) * 0.16])); } fillP(c, base, cs(cmul(rigShade([60, 60, 66], [0, 1, 0], RIG), 0.45)));
        const mt = rigShade([150, 150, 160], [0, 0.2, 1], RIG); c.lineCap = 'round'; c.strokeStyle = cs(mt); c.lineWidth = Math.max(1.5, 0.045 * sc2); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
        c.strokeStyle = cs(cadd(mt, [110, 110, 110]), 0.8); c.lineWidth = Math.max(0.8, 0.012 * sc2); c.beginPath(); c.moveTo(a[0] - 0.01 * sc2, a[1]); c.lineTo(b[0] - 0.01 * sc2, b[1]); c.stroke();
        c.fillStyle = cs(cadd(mt, [40, 40, 40])); c.beginPath(); c.arc(b[0], b[1], Math.max(1.5, 0.035 * sc2), 0, TAU); c.fill(); }
      const rope = []; for (let k = 0; k <= 120; k++) { const x = -6 + k * 0.1; const sag = Math.sin((x - Math.floor(x)) * Math.PI) * 0.12; rope.push([x, 0.82 - sag, 0.9]); } strokeL(c, cam.line(rope), 'rgba(180,40,50,0.85)', 2.5); }
    });
    ctx.save(); ctx.lineJoin = 'round';
    ctx.drawImage(hall, 0, 0);
    // haze (static: screen is order-independent, so it is baked into a cached layer and screened once)
    const hazeL = cachedLayer('gymHaze', String(beams.toFixed(2)), W, H, (c) => { c.fillStyle = PV.linGrad(c, 0, H * 0.2, 0, H * 0.8, [[0, '#3a2a50', 0.0], [0.6, '#3a2a50', 0.25 * beams], [1, '#3a2a50', 0]]); c.fillRect(0, 0, W, H); });
    // colored light pools on the floor (dynamic: they follow the sweeping lamps)
    const sweep = k => Math.sin(t * (0.5 + k * 0.17) + k * 2.1);
    const pools = lamps.map(([x, y, z, ci], k) => [x * 0.15 + sweep(k) * 1.4, -2.2 + sweep(k + 3) * 0.8, ci]);
    // beams through haze + their pools on the floor: one half-res additive buffer, one blur, one composite
    {
      const hb = PV.buffer('instr:gymBeams', W / 2, H / 2); const hc = hb.ctx; hc.setTransform(1, 0, 0, 1, 0, 0); hc.clearRect(0, 0, W / 2, H / 2); const T0 = ctx.getTransform(); hc.setTransform(T0.a * 0.5, T0.b * 0.5, T0.c * 0.5, T0.d * 0.5, T0.e * 0.5, T0.f * 0.5); hc.globalCompositeOperation = 'lighter';
      for (const [px, pz, ci] of pools) { const c0 = cam.p([px, 0, pz]); const R = 2.2 * cam.scaleAt([px, 0, pz]); hc.save(); hc.translate(c0[0], c0[1]); hc.scale(1, 0.3); const g = hc.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, cs(cols[ci], 0.62)); g.addColorStop(1, cs(cols[ci], 0)); hc.fillStyle = g; hc.beginPath(); hc.arc(0, 0, R, 0, TAU); hc.fill(); hc.restore(); }
      lamps.forEach(([lx, ly, lz, ci], k) => {
        const [px, pz] = pools[k]; const src = cam.p([lx, ly, lz]);
        const ring = []; for (let j = 0; j < 16; j++) { const a = j / 16 * TAU; ring.push(cam.p([px + Math.cos(a) * 1.4, 0, pz + Math.sin(a) * 1.4])); }
        const hp = hull(ring.concat([src])); const end = cam.p([px, 0, pz]);
        const g = hc.createLinearGradient(src[0], src[1], end[0], end[1]); g.addColorStop(0, cs(cols[ci], 0.55)); g.addColorStop(0.5, cs(cols[ci], 0.18)); g.addColorStop(1, cs(cols[ci], 0.05));
        fillP(hc, hp, g);
      });
      const hb2 = PV.buffer('instr:gymBeamsBlur', W / 2, H / 2); hb2.ctx.clearRect(0, 0, W / 2, H / 2); hb2.ctx.filter = 'blur(6px)'; hb2.ctx.drawImage(hb.canvas, 0, 0); hb2.ctx.filter = 'none';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.85 * beams; ctx.drawImage(hb2.canvas, 0, 0, W, H); ctx.restore();
      lamps.forEach(([lx, ly, lz, ci]) => { const p = cam.p([lx, ly, lz]); if (L.glow) { L.glow(ctx, p[0], p[1], 70, cs(cols[ci]).replace('rgb', 'rgb'), 0.9 * beams); } });
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.drawImage(hazeL, 0, 0); ctx.restore();
    // audience: silhouettes from behind, in depth layers (far rows paler with stage haze, near rows darkest),
    // shoulders / neck / head / hair readable, a few raised arms (fist, peace sign, phone with a lit screen)
    if (o.audience !== false) {
      const crowdL = cachedLayer('gymCrowd', ckey + '|' + (o.crowd || '') + '|' + (o.seed || 23) + '|' + (o.crowdCount || 0) + '|' + (o.hands === false ? 0 : 1) + '|' + (o.crowdGap === undefined ? 1 : o.crowdGap), W, H, (cc) => {
        const r = PV.rng(o.seed || 23); const heads = []; const sitting = o.crowd !== 'standing';
        const n = o.crowdCount || (sitting ? 30 : 34);
        for (let k = 0; k < n; k++) {
          const z = 0.9 + Math.pow(r(), 0.9) * (sitting ? 3.8 : 3.6); let x = (r() - 0.5) * (6.5 + (5 - z) * 1.2);
          const gap = o.crowdGap === undefined ? 1.0 : o.crowdGap; if (Math.abs(x) < gap && z < 4.6) x = Math.sign(x || 1) * (gap + Math.abs(x) * 0.6);
          heads.push([x, z, r(), r(), r(), r(), r()]);
        }
        heads.sort((a, b) => a[1] - b[1]);
        const bodies = PV.buffer('instr:gymCrowdBodies'); bodies.ctx.clearRect(0, 0, W, H); const bc = bodies.ctx;
        const phones = [];
        const zMin = Math.min(...heads.map(h => h[1])), zMax = Math.max(...heads.map(h => h[1]));
        for (const [x, z, h1, h2, h3, h4, h5] of heads) {
          const yH = (sitting ? 0.86 : 1.55) + (h1 - 0.5) * (sitting ? 0.1 : 0.18); const p = cam.p([x, yH, z]); const sc = cam.scaleAt([x, yH, z]); if (p[2] < 1.2) continue;
          const hr = 0.1 * sc; if (p[0] < -hr * 6 || p[0] > W + hr * 6) continue;
          const dz = clamp((z - zMin) / Math.max(0.01, zMax - zMin)); // 0 far .. 1 near
          const col = cs(cmix([40, 33, 52], [7, 7, 11], Math.pow(dz, 0.6)));
          const girl = h2 < 0.45, sh = (girl ? 0.95 : 1.05) + (h4 - 0.5) * 0.2, lean = (h1 - 0.5) * 0.3, sw = hr * 2.55 * sh;
          bc.save(); bc.translate(p[0], p[1]); bc.rotate(lean * 0.22); bc.fillStyle = col; bc.strokeStyle = col; bc.lineCap = 'round'; bc.lineJoin = 'round';
          // torso with sloped shoulders, neck, head
          bc.beginPath(); bc.moveTo(-sw * 1.0, H * 2); bc.lineTo(-sw * 1.02, hr * 2.75); bc.quadraticCurveTo(-sw * 1.05, hr * 2.22, -sw * 0.84, hr * 2.14); bc.lineTo(-hr * 1.1, hr * 1.98); bc.quadraticCurveTo(-hr * 0.62, hr * 1.9, -hr * 0.5, hr * 1.7);
          bc.lineTo(hr * 0.5, hr * 1.7); bc.quadraticCurveTo(hr * 0.62, hr * 1.9, hr * 1.1, hr * 1.98); bc.lineTo(sw * 0.84, hr * 2.14); bc.quadraticCurveTo(sw * 1.05, hr * 2.22, sw * 1.02, hr * 2.75); bc.lineTo(sw * 1.0, H * 2); bc.closePath(); bc.fill();
          bc.beginPath(); bc.moveTo(-hr * 0.38, hr * 0.55); bc.lineTo(-hr * 0.48, hr * 2.0); bc.lineTo(hr * 0.48, hr * 2.0); bc.lineTo(hr * 0.38, hr * 0.55); bc.fill();
          bc.beginPath(); bc.ellipse(0, 0, hr * 0.84, hr * 1.02, 0, 0, TAU); bc.fill();
          bc.beginPath(); bc.ellipse(-hr * 0.84, hr * 0.12, hr * 0.14, hr * 0.24, 0, 0, TAU); bc.ellipse(hr * 0.84, hr * 0.12, hr * 0.14, hr * 0.24, 0, 0, TAU); bc.fill();
          if (girl && h2 < 0.2) { // long straight hair
            bc.beginPath(); bc.moveTo(-hr * 0.88, -hr * 0.3); bc.bezierCurveTo(-hr * 0.98, hr * 0.9, -hr * 0.9, hr * 1.9, -hr * 1.0, hr * 3.1); bc.quadraticCurveTo(0, hr * 3.35, hr * 1.0, hr * 3.1); bc.bezierCurveTo(hr * 0.9, hr * 1.9, hr * 0.98, hr * 0.9, hr * 0.88, -hr * 0.3); bc.closePath(); bc.fill();
          } else if (girl && h2 < 0.32) { // ponytail
            bc.beginPath(); bc.ellipse(hr * 0.05, -hr * 0.62, hr * 0.42, hr * 0.32, 0.2, 0, TAU); bc.fill();
            bc.beginPath(); bc.moveTo(hr * 0.15, -hr * 0.4); bc.quadraticCurveTo(hr * 0.55, hr * 0.7, hr * 0.25, hr * 1.6); bc.lineTo(-hr * 0.1, hr * 1.5); bc.quadraticCurveTo(hr * 0.15, hr * 0.5, -hr * 0.15, -hr * 0.4); bc.fill();
          } else if (girl) { // bob
            bc.beginPath(); bc.ellipse(0, hr * 0.1, hr * 1.06, hr * 1.12, 0, Math.PI * 1.0, TAU); bc.lineTo(hr * 1.04, hr * 1.0); bc.quadraticCurveTo(0, hr * 1.25, -hr * 1.04, hr * 1.0); bc.closePath(); bc.fill();
          } else { // short boys' hair: a soft mass a little bigger than the skull, a few rounded tufts at the crown
            bc.beginPath(); bc.ellipse(0, -hr * 0.1, hr * 0.94, hr * 1.04, 0, 0, TAU); bc.fill();
            for (let q = 0; q < 4; q++) { const aa = -Math.PI * (0.22 + q * 0.19) + (h5 - 0.5) * 0.3; bc.beginPath(); bc.arc(Math.cos(aa) * hr * 0.86, Math.sin(aa) * hr * 0.98 - hr * 0.08, hr * (0.22 + 0.06 * ((q + Math.floor(h5 * 7)) % 3)), 0, TAU); bc.fill(); }
          }
          // a raised arm: shoulder -> elbow -> wrist, then a fist / peace sign / phone
          if (!sitting && o.hands !== false && h3 < 0.2 && dz > 0.15) {
            const sd = h5 < 0.5 ? -1 : 1, sx = sd * sw * 0.82, sy = hr * 2.5, ex = sd * (sw + hr * 0.7), ey = -hr * 0.6, wx = sd * (sw * 0.55 + hr * 0.3), wy = -hr * 3.4;
            bc.lineWidth = hr * 0.78; bc.beginPath(); bc.moveTo(sx, sy); bc.lineTo(ex, ey); bc.stroke();
            bc.lineWidth = hr * 0.6; bc.beginPath(); bc.moveTo(ex, ey); bc.lineTo(wx, wy); bc.stroke();
            const kind = h3 < 0.07 ? 'phone' : h3 < 0.14 ? 'peace' : 'fist';
            if (kind === 'fist') { bc.beginPath(); bc.ellipse(wx, wy - hr * 0.35, hr * 0.42, hr * 0.5, 0, 0, TAU); bc.fill(); }
            else if (kind === 'peace') { bc.beginPath(); bc.ellipse(wx, wy - hr * 0.25, hr * 0.38, hr * 0.42, 0, 0, TAU); bc.fill(); bc.lineWidth = hr * 0.2; bc.beginPath(); bc.moveTo(wx - hr * 0.12, wy - hr * 0.5); bc.lineTo(wx - hr * 0.42, wy - hr * 1.35); bc.moveTo(wx + hr * 0.1, wy - hr * 0.5); bc.lineTo(wx + hr * 0.3, wy - hr * 1.4); bc.stroke(); }
            else { bc.beginPath(); bc.ellipse(wx, wy - hr * 0.2, hr * 0.36, hr * 0.4, 0, 0, TAU); bc.fill(); bc.save(); bc.translate(wx, wy - hr * 0.9); bc.rotate(sd * 0.12); bc.fillRect(-hr * 0.42, -hr * 0.75, hr * 0.84, hr * 1.5); bc.restore(); const m = bc.getTransform(); const q = m.transformPoint({ x: wx, y: wy - hr * 0.9 }); phones.push([q.x, q.y, hr, sd * 0.12 + lean * 0.22]); }
          }
          bc.restore();
        }
        cc.drawImage(bodies.canvas, 0, 0);
        const bb = [0, 0, W, H];
        // thin coloured rims along the stage-facing silhouette edges
        rimLight(cc, bodies.canvas, { bbox: bb, dx: 0, dy: -2.2, color: cs(cols[1]), alpha: 0.55 * beams, soft: 6, softAlpha: 0.35 });
        rimLight(cc, bodies.canvas, { bbox: bb, dx: 2.2, dy: -0.6, color: cs(cols[0]), alpha: 0.4 * beams, soft: 5, softAlpha: 0.3 });
        rimLight(cc, bodies.canvas, { bbox: bb, dx: -2.2, dy: -0.6, color: cs(cols[2]), alpha: 0.4 * beams, soft: 5, softAlpha: 0.3 });
        // phone screens (seen from behind the crowd: the lit screens face the stage, we see a glow halo around the phone's edge)
        for (const [px, py, hr, rot] of phones) { cc.save(); cc.translate(px, py); cc.rotate(rot); cc.globalCompositeOperation = 'lighter'; const g = cc.createRadialGradient(0, -hr * 0.2, 0, 0, -hr * 0.2, hr * 2.4); g.addColorStop(0, 'rgba(190,220,255,0.35)'); g.addColorStop(1, 'rgba(190,220,255,0)'); cc.fillStyle = g; cc.fillRect(-hr * 2.4, -hr * 2.6, hr * 4.8, hr * 4.8); cc.strokeStyle = 'rgba(210,232,255,0.45)'; cc.lineWidth = Math.max(1, hr * 0.06); cc.beginPath(); cc.moveTo(-hr * 0.4, -hr * 0.74); cc.lineTo(hr * 0.4, -hr * 0.74); cc.lineTo(hr * 0.42, hr * 0.2); cc.stroke(); cc.restore(); }
      });
      ctx.drawImage(crowdL, 0, 0);
    }
    if (flash > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(255,236,206,${0.85 * flash})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    ctx.restore();
    return { cam, project: p => cam.p(p), performer: cam.p([-1.1, 0, -0.9]), keyboard: cam.p([2.0, 0.85, -1.6]), amp: cam.p([-2.7, 0.3, -2.9]) };
  };

  /* ======================================================================
   * 2-D CEL PROPS helpers
   * ====================================================================== */
  // fill the part of `path` not covered by the same path shifted by (dx,dy)  -> shadow / highlight bands
  function bandShade(c, path, dx, dy, style, blur) {
    c.save(); c.clip(path); const p2 = new Path2D(); p2.rect(-1e4, -1e4, 2e4, 2e4); p2.addPath(path, new DOMMatrix().translate(dx, dy));
    if (blur) c.filter = `blur(${blur}px)`; c.fillStyle = style; c.fill(p2, 'evenodd'); c.restore();
  }
  function splinePath(pts, closed = true, seg = 8) { const s = spline(pts, closed, seg); const p = new Path2D(); p.moveTo(s[0][0], s[0][1]); for (let i = 1; i < s.length; i++) p.lineTo(s[i][0], s[i][1]); if (closed) p.closePath(); return p; }
  const mirrorX = pts => pts.concat(pts.slice(1, -1).reverse().map(p => [-p[0], p[1]]));

  /* ======================================================================
   * AMP — small combo guitar amp with a red pilot (jewel) lamp
   * o: {x,y (bottom centre px), h (px), w, view:'front'|'threeQuarter', angle, lamp 0..1, ambient 0..1,
   *     knobs:[0..10]x5, grille:'tan'|'black', style:'lit'|'silhouette', rimColor}
   * ====================================================================== */
  L.amp = function (ctx, t, o = {}) {
    const h = o.h || 320, w = o.w || h * 1.12, x = o.x === undefined ? W / 2 : o.x, y = o.y === undefined ? H * 0.8 : o.y;
    const ang = o.view === 'front' ? 0 : (o.angle === undefined ? 0.35 : o.angle);
    const dep = h * 0.55, sx = Math.sin(ang) * dep * 0.62, ty = dep * 0.2 * (o.topView === undefined ? 1 : o.topView);
    const amb = clamp(o.ambient === undefined ? 1 : o.ambient, 0.03, 1.5);
    const lamp = clamp(o.lamp === undefined ? 1 : o.lamp);
    const fl = lamp > 0 ? 0.94 + 0.06 * PV.noise2(t * 3.1, 7.7) : 0;
    const sil = o.style === 'silhouette';
    const K = c => sil ? cs(hx(o.color || '#0b0f1a')) : cs(cmul(c, amb));
    ctx.save(); ctx.translate(x - w / 2 - sx / 2, y); ctx.lineJoin = 'round';
    const r = h * 0.035;
    // floor shadow
    if (!sil && o.shadow !== 0) { const g = ctx.createRadialGradient(w / 2 + sx / 2, 0, 0, w / 2 + sx / 2, 0, w * 0.7); g.addColorStop(0, `rgba(0,0,0,${0.45 * Math.min(1, amb + 0.3)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.save(); ctx.scale(1, 0.15); ctx.fillStyle = g; ctx.fillRect(-w * 0.3, -w * 0.8, w * 1.8, w * 1.6); ctx.restore(); }
    // side + top faces
    const side = new Path2D(); if (sx > 0) { side.moveTo(w, -h); side.lineTo(w + sx, -h - ty); side.lineTo(w + sx, -ty); side.lineTo(w, 0); side.closePath(); } else if (sx < 0) { side.moveTo(0, -h); side.lineTo(sx, -h - ty); side.lineTo(sx, -ty); side.lineTo(0, 0); side.closePath(); }
    ctx.fillStyle = K([26, 25, 28]); ctx.fill(side);
    const top = new Path2D(); top.moveTo(0, -h); top.lineTo(sx > 0 ? sx : sx, -h - ty); top.lineTo(w + (sx > 0 ? sx : sx), -h - ty); top.lineTo(w, -h); top.closePath();
    ctx.fillStyle = K([44, 42, 46]); ctx.fill(top);
    // handle on top
    { const hx0 = w / 2 + sx / 2, hy0 = -h - ty / 2, hw2 = w * 0.17; ctx.fillStyle = K([18, 16, 16]); ctx.beginPath(); ctx.moveTo(hx0 - hw2, hy0 + ty * 0.12); ctx.bezierCurveTo(hx0 - hw2 * 0.8, hy0 - h * 0.075, hx0 + hw2 * 0.8, hy0 - h * 0.075, hx0 + hw2, hy0 + ty * 0.12); ctx.lineTo(hx0 + hw2 * 0.86, hy0 + ty * 0.12); ctx.bezierCurveTo(hx0 + hw2 * 0.7, hy0 - h * 0.05, hx0 - hw2 * 0.7, hy0 - h * 0.05, hx0 - hw2 * 0.86, hy0 + ty * 0.12); ctx.closePath(); ctx.fill();
      if (!sil) { ctx.strokeStyle = K([92, 86, 80]); ctx.lineWidth = Math.max(1, h * 0.005); ctx.beginPath(); ctx.moveTo(hx0 - hw2 * 0.8, hy0 - h * 0.02); ctx.bezierCurveTo(hx0 - hw2 * 0.6, hy0 - h * 0.07, hx0 + hw2 * 0.6, hy0 - h * 0.07, hx0 + hw2 * 0.8, hy0 - h * 0.02); ctx.stroke(); for (const sd of [-1, 1]) { ctx.fillStyle = K([150, 150, 156]); ctx.fillRect(hx0 + sd * hw2 - h * 0.012, hy0 + ty * 0.05, h * 0.024, h * 0.02); } } }
    // front face
    const front = new Path2D(); front.roundRect ? front.roundRect(0, -h, w, h, r) : front.rect(0, -h, w, h);
    ctx.fillStyle = K([30, 29, 32]); ctx.fill(front);
    if (!sil) {
      // tolex texture
      const tex = PV.cached('instr:tolex', 128, 128, c => { const img = c.createImageData(128, 128); const rr = PV.rng(5); for (let i = 0; i < 128 * 128; i++) { const v = 128 + (rr() - 0.5) * 70 + PV.noise2((i % 128) / 4, Math.floor(i / 128) / 4) * 30; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; } c.putImageData(img, 0, 0); });
      ctx.save(); ctx.clip(front); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.25; ctx.fillStyle = ctx.createPattern(tex, 'repeat'); ctx.fillRect(0, -h, w, h); ctx.restore();
      // grille cloth
      const gx = w * 0.06, gy = -h * 0.76, gw = w * 0.88, gh = h * 0.7;
      const grille = new Path2D(); grille.roundRect ? grille.roundRect(gx, gy, gw, gh, r * 0.6) : grille.rect(gx, gy, gw, gh);
      const tan = o.grille !== 'black';
      ctx.fillStyle = K(tan ? [150, 128, 96] : [36, 34, 38]); ctx.fill(grille);
      ctx.save(); ctx.clip(grille);
      const wv = PV.cached('instr:weave' + (tan ? 't' : 'b'), 24, 24, c => { c.fillStyle = tan ? '#8a7454' : '#1c1b20'; c.fillRect(0, 0, 24, 24); c.strokeStyle = tan ? '#b39a72' : '#4a4a54'; c.lineWidth = 2; for (let k = -24; k < 48; k += 6) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 24, 24); c.stroke(); } c.strokeStyle = tan ? '#6a563c' : '#101014'; c.lineWidth = 1; for (let k = -24; k < 48; k += 6) { c.beginPath(); c.moveTo(k + 24, 0); c.lineTo(k, 24); c.stroke(); } });
      ctx.globalAlpha = 0.55 * Math.min(1, amb + 0.2); ctx.fillStyle = ctx.createPattern(wv, 'repeat'); ctx.fillRect(gx, gy, gw, gh); ctx.globalAlpha = 1;
      const sp = ctx.createRadialGradient(gx + gw / 2, gy + gh * 0.55, gh * 0.05, gx + gw / 2, gy + gh * 0.55, gh * 0.5); sp.addColorStop(0, 'rgba(0,0,0,0.25)'); sp.addColorStop(0.75, 'rgba(0,0,0,0.12)'); sp.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sp; ctx.fillRect(gx, gy, gw, gh);
      const vg = ctx.createLinearGradient(0, gy, 0, gy + gh); vg.addColorStop(0, `rgba(255,240,220,${0.12 * amb})`); vg.addColorStop(1, 'rgba(0,0,0,0.25)'); ctx.fillStyle = vg; ctx.fillRect(gx, gy, gw, gh);
      ctx.restore();
      // piping + logo badge
      ctx.strokeStyle = K([200, 190, 170]); ctx.lineWidth = Math.max(1, h * 0.006); ctx.beginPath(); ctx.moveTo(gx, gy - h * 0.012); ctx.lineTo(gx + gw, gy - h * 0.012); ctx.stroke();
      ctx.fillStyle = K([190, 186, 178]); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(gx + gw * 0.06, gy + gh * 0.07, gw * 0.2, gh * 0.07, gh * 0.03) : ctx.rect(gx + gw * 0.06, gy + gh * 0.07, gw * 0.2, gh * 0.07); ctx.fill();
      ctx.strokeStyle = K([60, 58, 56]); ctx.lineWidth = Math.max(0.8, h * 0.004); ctx.beginPath(); ctx.moveTo(gx + gw * 0.08, gy + gh * 0.105); ctx.bezierCurveTo(gx + gw * 0.12, gy + gh * 0.08, gx + gw * 0.16, gy + gh * 0.13, gx + gw * 0.24, gy + gh * 0.095); ctx.stroke();
      // control panel
      const py = -h * 0.95, ph = h * 0.15;
      ctx.fillStyle = K([58, 58, 64]); ctx.fillRect(w * 0.05, py, w * 0.9, ph);
      const pg = ctx.createLinearGradient(0, py, 0, py + ph); pg.addColorStop(0, `rgba(255,255,255,${0.18 * amb})`); pg.addColorStop(0.5, 'rgba(255,255,255,0)'); pg.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = pg; ctx.fillRect(w * 0.05, py, w * 0.9, ph);
      // jacks
      for (let k = 0; k < 2; k++) { const jx = w * (0.1 + k * 0.07), jy = py + ph * 0.55; ctx.fillStyle = K([150, 150, 156]); ctx.beginPath(); ctx.arc(jx, jy, h * 0.022, 0, TAU); ctx.fill(); ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.arc(jx, jy, h * 0.011, 0, TAU); ctx.fill(); }
      // knobs
      const kv = o.knobs || [6, 5, 5, 6, 3];
      for (let k = 0; k < kv.length; k++) {
        const kx = w * (0.3 + k * 0.105), ky = py + ph * 0.52, kr = h * 0.032;
        ctx.fillStyle = K([16, 16, 18]); ctx.beginPath(); ctx.arc(kx, ky + kr * 0.15, kr * 1.05, 0, TAU); ctx.fill();
        const kg = ctx.createRadialGradient(kx - kr * 0.3, ky - kr * 0.4, 0, kx, ky, kr); kg.addColorStop(0, cs(cmul([120, 120, 126], amb))); kg.addColorStop(1, cs(cmul([20, 20, 22], amb)));
        ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.fill();
        const a = -Math.PI * 1.25 + clamp(kv[k] / 10) * Math.PI * 1.5;
        ctx.strokeStyle = K([235, 232, 220]); ctx.lineWidth = Math.max(1, kr * 0.18); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(kx + Math.cos(a) * kr * 0.25, ky + Math.sin(a) * kr * 0.25); ctx.lineTo(kx + Math.cos(a) * kr * 0.9, ky + Math.sin(a) * kr * 0.9); ctx.stroke();
        ctx.fillStyle = K([200, 196, 186]); for (let m = 0; m <= 10; m += 2) { const b = -Math.PI * 1.25 + m / 10 * Math.PI * 1.5; ctx.fillRect(kx + Math.cos(b) * kr * 1.35 - 0.6, ky + Math.sin(b) * kr * 1.35 - 0.6, 1.2, 1.2); }
      }
      // corner protectors: rounded caps wrapping each corner (not floating discs), a dull glint on the rounded edge
      const cpS = h * 0.085, cpR = h * 0.03;
      for (const [cx2, cy2] of [[0, -h], [w, -h], [0, 0], [w, 0]]) {
        const sx2 = cx2 ? -1 : 1, sy2 = cy2 ? -1 : 1; const x0 = cx2 - (sx2 > 0 ? h * 0.012 : cpS - h * 0.012), y0 = cy2 - (sy2 > 0 ? h * 0.012 : cpS - h * 0.012);
        ctx.fillStyle = K([16, 16, 18]); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y0, cpS, cpS, cpR); else ctx.rect(x0, y0, cpS, cpS); ctx.fill();
        ctx.strokeStyle = K([96, 96, 104]); ctx.lineWidth = Math.max(0.8, h * 0.005); ctx.beginPath(); ctx.arc(cx2 + sx2 * (cpR - h * 0.012), cy2 + sy2 * (cpR - h * 0.012), cpR * 0.8, sy2 > 0 ? (sx2 > 0 ? Math.PI : Math.PI * 1.5) : (sx2 > 0 ? Math.PI * 0.5 : 0), (sy2 > 0 ? (sx2 > 0 ? Math.PI : Math.PI * 1.5) : (sx2 > 0 ? Math.PI * 0.5 : 0)) + Math.PI * 0.5); ctx.stroke();
        ctx.fillStyle = K([70, 70, 76]); ctx.beginPath(); ctx.arc(x0 + cpS / 2, y0 + cpS / 2, h * 0.007, 0, TAU); ctx.fill();
      }
      // edge light: the top-front edge and the far vertical edge catch the room light (rimColor), so the cabinet
      // separates from a dark background
      const rc = hx(o.rimColor || '#9fb0d8'), ra = o.rim === undefined ? 0.55 : o.rim;
      ctx.strokeStyle = cs(cadd(cmul([150, 146, 140], amb), rc, 0.25 * ra), 0.75); ctx.lineWidth = Math.max(1, h * 0.006); ctx.beginPath(); ctx.moveTo(r, -h); ctx.lineTo(w - r, -h); ctx.stroke();
      if (ra > 0) { ctx.strokeStyle = cs(rc, 0.35 * ra); ctx.lineWidth = Math.max(1, h * 0.008); ctx.beginPath(); if (sx > 0) { ctx.moveTo(w + sx, -h - ty); ctx.lineTo(w + sx, -ty); ctx.moveTo(sx, -h - ty); ctx.lineTo(w + sx, -h - ty); } else { ctx.moveTo(sx, -h - ty); ctx.lineTo(sx, -ty); ctx.moveTo(sx, -h - ty); ctx.lineTo(w + sx, -h - ty); } ctx.stroke(); }
    }
    // the jewel lamp
    const lx = w * 0.88, ly = -h * 0.95 + h * 0.15 * 0.52, lr = h * 0.026;
    ctx.fillStyle = sil ? cs(hx(o.color || '#0b0f1a')) : K([170, 170, 176]); ctx.beginPath(); ctx.arc(lx, ly, lr * 1.45, 0, TAU); ctx.fill();
    const on = lamp * fl;
    const jc = cmix([70, 8, 10], [255, 70, 50], on);
    ctx.fillStyle = cs(jc); ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TAU); ctx.fill();
    // facets
    ctx.strokeStyle = cs(cmix([30, 0, 0], [255, 150, 120], on), 0.8); ctx.lineWidth = Math.max(0.6, lr * 0.08);
    ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; ctx.moveTo(lx + Math.cos(a) * lr * 0.45, ly + Math.sin(a) * lr * 0.45); ctx.lineTo(lx + Math.cos(a) * lr * 0.95, ly + Math.sin(a) * lr * 0.95); } ctx.stroke();
    ctx.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * TAU; const px = lx + Math.cos(a) * lr * 0.45, py = ly + Math.sin(a) * lr * 0.45; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke();
    if (on > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      let g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr * 1.2); g.addColorStop(0, cs([255, 228, 214], on)); g.addColorStop(1, cs([255, 80, 60], 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, lr * 1.2, 0, TAU); ctx.fill();
      const R = h * (o.glow || 0.55); g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R); g.addColorStop(0, cs([255, 70, 50], 0.75 * on)); g.addColorStop(0.15, cs([255, 50, 40], 0.3 * on)); g.addColorStop(1, cs([255, 30, 30], 0)); ctx.fillStyle = g; ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
      // red spill on the panel
      if (!sil) { g = ctx.createRadialGradient(lx, ly, 0, lx, ly, h * 0.25); g.addColorStop(0, cs([255, 40, 30], 0.35 * on)); g.addColorStop(1, cs([255, 40, 30], 0)); ctx.fillStyle = g; ctx.fillRect(lx - h * 0.25, ly - h * 0.25, h * 0.5, h * 0.5); }
      ctx.restore();
    }
    ctx.fillStyle = `rgba(255,255,255,${0.75 - on * 0.3})`; ctx.beginPath(); ctx.arc(lx - lr * 0.35, ly - lr * 0.38, lr * 0.2, 0, TAU); ctx.fill();
    ctx.restore();
    return { lamp: { x: x - w / 2 - sx / 2 + lx, y: y + ly } };
  };

  /* ======================================================================
   * ACOUSTIC GUITAR (scarred heirloom) & STRATOCASTER (worn white, maple neck)
   * local mm, headstock up; drawn with ctx transform translate(x,y) rotate(rot) scale(px/mm)
   * ====================================================================== */
  function guitarFrame(ctx, o, def) {
    const s = o.scale || (o.len ? o.len / def.len : def.scale), x = o.x === undefined ? W / 2 : o.x, y = o.y === undefined ? H / 2 : o.y;
    ctx.translate(x, y); ctx.rotate(o.rot || 0); if (o.flip) ctx.scale(-1, 1); ctx.scale(s, s);
    return s;
  }
  const lightVec = o => { const a = o.light === undefined ? -2.25 : o.light; return [Math.cos(a), Math.sin(a)]; };

  function acousticBodyPath() {
    const y0 = -255; const prof = [[0, -2], [36, 0], [95, 6], [128, 24], [141, 55], [144, 88], [140, 124], [133, 160], [131, 192], [138, 232], [160, 290], [184, 348], [196, 398], [192, 440], [172, 474], [132, 496], [70, 506], [0, 508]];
    return mirrorX(prof.map(p => [p[0], y0 + p[1]]));
  }
  L.acousticGuitar = function (ctx, o = {}) {
    ctx.save(); const s = guitarFrame(ctx, o, { len: 1060, scale: 0.8 }); ctx.translate(0, 270);
    const sil = o.style === 'silhouette'; const SC = hx(o.color || '#0b0f1a');
    const [lx, ly] = lightVec(o); const amb = o.ambient === undefined ? 1 : o.ambient;
    const lw = Math.max(0.8, 1.6 / s); const line = cs(cmul([46, 26, 16], 1));
    const body = splinePath(acousticBodyPath(), true, 6);
    const tilt = o.tilt || 0;
    const neckPath = new Path2D(); neckPath.moveTo(-26, -250); neckPath.lineTo(-22, -613); neckPath.lineTo(22, -613); neckPath.lineTo(26, -250); neckPath.closePath();
    const headPts = [[-24, -612], [-30, -650], [-40, -700], [-44, -760], [-40, -796], [0, -790], [40, -796], [44, -760], [40, -700], [30, -650], [24, -612]];
    const head = new Path2D(); head.moveTo(headPts[0][0], headPts[0][1]); for (const p of headPts.slice(1)) head.lineTo(p[0], p[1]); head.closePath();
    if (sil) {
      ctx.fillStyle = cs(SC); if (tilt) { ctx.save(); ctx.translate(tilt * 40, 0); ctx.fill(body); ctx.restore(); } ctx.fill(body); ctx.fill(neckPath); ctx.fill(head);
      for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 56, -650 - k * 48, 13, 8, 0, 0, TAU); ctx.fill(); }
      ctx.restore(); return;
    }
    const A = c => cs(cmul(c, amb));
    // side (rim) when tilted
    if (tilt) { ctx.save(); ctx.translate(tilt * 42, 4); ctx.fillStyle = A([92, 44, 22]); ctx.fill(body); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(body); ctx.restore(); }
    // top: aged spruce (natural or sunburst)
    const burst = o.finish === 'sunburst';
    let g = ctx.createRadialGradient(-10, 40, 40, 0, 20, 300);
    if (burst) { g.addColorStop(0, A([236, 178, 84])); g.addColorStop(0.5, A([196, 112, 40])); g.addColorStop(0.8, A([96, 40, 18])); g.addColorStop(1, A([40, 16, 10])); }
    else { g.addColorStop(0, A([238, 198, 128])); g.addColorStop(0.6, A([222, 168, 92])); g.addColorStop(0.92, A([170, 104, 48])); g.addColorStop(1, A([120, 66, 30])); }
    ctx.fillStyle = g; ctx.fill(body);
    // spruce grain
    ctx.save(); ctx.clip(body); const gr = PV.rng(9);
    for (let k = 0; k < 90; k++) { const xx = -200 + k * 4.5 + gr() * 2; ctx.strokeStyle = cs(cmul([150, 96, 40], amb), 0.08 + gr() * 0.1); ctx.lineWidth = 0.6 + gr() * 0.8; ctx.beginPath(); ctx.moveTo(xx, -270); ctx.lineTo(xx + (gr() - 0.5) * 6, 260); ctx.stroke(); }
    ctx.restore();
    // cel shadow + gloss
    bandShade(ctx, body, lx * 16, ly * 16, cs(cmul([60, 26, 10], amb), 0.32));
    bandShade(ctx, body, -lx * 6, -ly * 6, cs([255, 236, 200], 0.35 * amb));
    // forearm wear on the bass side lower bout
    ctx.save(); ctx.clip(body); let wg = ctx.createRadialGradient(-150, 120, 5, -150, 120, 70); wg.addColorStop(0, A([214, 178, 128])); wg.addColorStop(1, cs([214, 178, 128], 0)); ctx.fillStyle = wg; ctx.globalAlpha = 0.55; ctx.fillRect(-260, 20, 200, 200); ctx.restore();
    // binding (with chips)
    ctx.strokeStyle = A([226, 214, 186]); ctx.lineWidth = 3.2; ctx.stroke(body);
    ctx.save(); ctx.setLineDash([2, 40, 4, 70, 3, 55]); ctx.strokeStyle = A([90, 56, 30]); ctx.lineWidth = 3.4; ctx.stroke(body); ctx.restore();
    ctx.strokeStyle = line; ctx.lineWidth = lw * 1.2; ctx.stroke(body);
    // soundhole + rosette
    const shY = -105;
    for (const [rr, col, wdt] of [[64, [26, 18, 14], 2.4], [60, [236, 226, 204], 2], [57, [26, 18, 14], 1.4], [54, [180, 140, 90], 1.2]]) { ctx.strokeStyle = A(col); ctx.lineWidth = wdt; ctx.beginPath(); ctx.arc(0, shY, rr, 0, TAU); ctx.stroke(); }
    ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = A([70, 40, 24]); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, shY, 61.8, 0, TAU); ctx.stroke(); ctx.restore();
    g = ctx.createRadialGradient(-8, shY - 10, 5, 0, shY, 50); g.addColorStop(0, A([52, 30, 18])); g.addColorStop(1, A([12, 7, 5])); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, shY, 50, 0, TAU); ctx.fill();
    ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(0, shY, 50, 0, TAU); ctx.stroke();
    // pickguard (tortoise teardrop) on the treble side
    const pgp = splinePath([[34, -78], [70, -60], [104, -40], [126, -8], [130, 30], [112, 58], [80, 64], [52, 44], [44, 10], [48, -30]], true, 8);
    ctx.save(); ctx.clip(pgp); ctx.fillStyle = A([92, 38, 18]); ctx.fillRect(20, -90, 130, 170); const tr = PV.rng(4);
    for (let k = 0; k < 40; k++) { ctx.fillStyle = cs(cmul(tr() < 0.5 ? [40, 14, 8] : [170, 90, 36], amb), 0.55); ctx.beginPath(); ctx.ellipse(30 + tr() * 110, -80 + tr() * 150, 4 + tr() * 12, 2 + tr() * 5, tr() * 3, 0, TAU); ctx.fill(); }
    ctx.restore(); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(pgp);
    // pick wear: bare wood scraped below the pickguard
    ctx.save(); ctx.clip(body); const pw = PV.rng(12);
    wg = ctx.createRadialGradient(92, 72, 4, 92, 72, 46); wg.addColorStop(0, A([206, 176, 132])); wg.addColorStop(1, cs([206, 176, 132], 0)); ctx.fillStyle = wg; ctx.globalAlpha = 0.85; ctx.fillRect(30, 20, 130, 110); ctx.globalAlpha = 1;
    for (let k = 0; k < 70; k++) { const a = -0.9 + (pw() - 0.5) * 0.5, cx2 = 60 + pw() * 70, cy2 = 40 + pw() * 60, L2 = 6 + pw() * 22; ctx.strokeStyle = cs(cmul(pw() < 0.6 ? [250, 232, 200] : [110, 70, 40], amb), 0.5); ctx.lineWidth = 0.5 + pw() * 0.6; ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(cx2 + Math.cos(a) * L2, cy2 + Math.sin(a) * L2); ctx.stroke(); }
    // scattered scratches & dings all over the top
    for (let k = 0; k < 120; k++) { const cx2 = (pw() - 0.5) * 360, cy2 = -240 + pw() * 470; const a = pw() * Math.PI, L2 = 4 + Math.pow(pw(), 2) * 40; ctx.strokeStyle = cs([255, 244, 220], (0.18 + pw() * 0.25) * amb); ctx.lineWidth = 0.5 + pw() * 0.5; ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.quadraticCurveTo(cx2 + Math.cos(a) * L2 * 0.5 + (pw() - 0.5) * 4, cy2 + Math.sin(a) * L2 * 0.5, cx2 + Math.cos(a) * L2, cy2 + Math.sin(a) * L2); ctx.stroke(); }
    for (let k = 0; k < 22; k++) { ctx.fillStyle = cs(cmul([70, 40, 20], amb), 0.6); ctx.beginPath(); ctx.ellipse((pw() - 0.5) * 340, -230 + pw() * 460, 1 + pw() * 2.5, 0.8 + pw() * 1.5, pw() * 3, 0, TAU); ctx.fill(); }
    // finish checking (fine lacquer cracks across the grain)
    ctx.strokeStyle = cs(cmul([110, 64, 30], amb), 0.22); ctx.lineWidth = 0.6;
    for (let k = 0; k < 40; k++) { const yy = -230 + pw() * 460, xx = (pw() - 0.5) * 300; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 10 + pw() * 30, yy + (pw() - 0.5) * 4); ctx.stroke(); }
    ctx.restore();
    // bridge
    const br = splinePath([[-80, 30], [-60, 24], [60, 24], [80, 30], [80, 52], [40, 56], [20, 66], [-20, 66], [-40, 56], [-80, 52]], true, 6);
    ctx.fillStyle = A([52, 28, 18]); ctx.fill(br); bandShade(ctx, br, lx * 4, ly * 4, 'rgba(0,0,0,0.35)'); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(br);
    ctx.fillStyle = A([236, 228, 206]); ctx.save(); ctx.translate(0, 34); ctx.rotate(-0.025); ctx.fillRect(-46, -2, 92, 4); ctx.restore();
    for (let k = 0; k < 6; k++) { const px = -26 + k * 10.4; ctx.fillStyle = A([238, 232, 216]); ctx.beginPath(); ctx.arc(px, 48, 3.4, 0, TAU); ctx.fill(); ctx.fillStyle = A([30, 24, 20]); ctx.beginPath(); ctx.arc(px, 48, 1.2, 0, TAU); ctx.fill(); }
    // neck + fretboard
    ctx.fillStyle = A([120, 62, 32]); ctx.fill(neckPath);
    const fb = new Path2D(); fb.moveTo(-25, -170); fb.lineTo(-21, -612); fb.lineTo(21, -612); fb.lineTo(25, -170); fb.closePath();
    ctx.fillStyle = A([46, 28, 20]); ctx.fill(fb); bandShade(ctx, fb, lx * 3, ly * 3, 'rgba(0,0,0,0.3)');
    const scl = 645, nutY = -612;
    for (let n = 1; n <= 20; n++) { const fy = nutY + fretX(n) * scl / SCALE_LEN; const hw = lerp(21, 25, (fy - nutY) / 442); ctx.strokeStyle = A([196, 192, 184]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-hw, fy); ctx.lineTo(hw, fy); ctx.stroke(); }
    for (const n of [3, 5, 7, 9, 15]) { const fy = nutY + (fretX(n - 1) + fretX(n)) / 2 * scl / SCALE_LEN; ctx.fillStyle = A([232, 226, 212]); ctx.beginPath(); ctx.arc(0, fy, 3, 0, TAU); ctx.fill(); }
    { const fy = nutY + (fretX(11) + fretX(12)) / 2 * scl / SCALE_LEN; ctx.fillStyle = A([232, 226, 212]); ctx.beginPath(); ctx.arc(-9, fy, 3, 0, TAU); ctx.arc(9, fy, 3, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(neckPath);
    // headstock
    ctx.fillStyle = A([28, 20, 16]); ctx.fill(head); bandShade(ctx, head, -lx * 3, -ly * 3, cs([255, 240, 220], 0.2 * amb)); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(head);
    ctx.fillStyle = A([236, 228, 206]); ctx.fillRect(-22, -616, 44, 5);
    const posts = []; for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) posts.push([sd * 26, -660 - k * 48, sd]);
    for (const [px, py, sd] of posts) {
      ctx.fillStyle = A([180, 176, 168]); ctx.beginPath(); ctx.ellipse(px + sd * 30, py, 12, 7, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = lw * 0.8; ctx.stroke();
      ctx.fillStyle = A([150, 146, 140]); ctx.fillRect(px + sd * 8, py - 3, sd * 14, 6);
      ctx.fillStyle = A([200, 196, 190]); ctx.beginPath(); ctx.arc(px, py, 4.5, 0, TAU); ctx.fill(); ctx.strokeStyle = line; ctx.stroke();
    }
    // strings
    const order = [[-26, -660], [-26, -708], [-26, -756], [26, -756], [26, -708], [26, -660]];
    for (let i = 0; i < 6; i++) {
      const bx = -26 + i * 10.4, nx2 = -17.5 + i * 7; const [px, py] = order[i];
      ctx.strokeStyle = i < 4 ? A([214, 176, 110]) : A([226, 226, 230]); ctx.lineWidth = Math.max(0.5, (1.5 - i * 0.17));
      ctx.beginPath(); ctx.moveTo(bx, 46); ctx.lineTo(nx2, nutY); ctx.lineTo(px, py); ctx.stroke();
    }
    ctx.restore();
  };

  // Strat-type body outline (mm; neck axis x=0, nut at y=0, bridge saddles y≈648). Long pointed bass horn reaching
  // the 13th fret, shorter treble horn, deep treble cutaway, broad rounded lower bout, gentle waist.
  // Strat-type body (mm; neck axis x=0, nut y=0, saddles y≈648; bass side = -x, where the tuners are).
  // Long pointed bass horn (tip at the 11th–12th fret), short rounder treble horn, open U cutaways,
  // narrow upper bout, gentle waist, broad round lower bout.
  // Strat-type body (mm; neck axis x=0, nut y=0, saddles y≈648; bass side = -x, where the tuners are).
  // 406 mm long x 322 mm wide: long pointed bass horn (tip near the 12th fret), short rounder treble horn,
  // open U cutaways, narrower upper bout, gentle waist, broad round lower bout.
  function stratBodyPts() {
    return [[-28.5, 423], [-33, 407], [-40, 391], [-49, 376], [-58, 362], [-67, 350], [-75, 340], [-83, 334], [-91, 332], [-98, 336], [-105, 344], [-113, 357], [-121, 375], [-129, 396], [-136, 420], [-140, 445], [-141, 470], [-139, 495], [-135, 518], [-133, 541], [-137, 566], [-146, 593], [-155, 620], [-160, 646], [-159, 673], [-150, 696], [-131, 717], [-100, 731], [-58, 738], [-10, 740], [38, 737], [82, 728], [117, 712], [143, 689], [157, 662], [161, 634], [156, 605], [146, 580], [137, 557], [133, 534], [134, 511], [136, 487], [134, 464], [128, 441], [119, 421], [109, 406], [99, 395], [89, 389], [80, 387], [71, 390], [62, 397], [54, 407], [46, 419], [39, 430], [33.5, 441], [29.5, 450]];
  }
  function stratGuardPts() {
    return [[-27, 420], [-38, 403], [-54, 387], [-74, 378], [-94, 384], [-110, 402], [-118, 427], [-120, 455], [-118, 486], [-112, 514], [-106, 539], [-104, 562], [-108, 587], [-102, 609], [-84, 621], [-58, 624], [-42, 622], [-40, 627], [40, 627], [52, 637], [66, 656], [84, 676], [100, 690], [114, 688], [126, 670], [138, 646], [143, 620], [136, 591], [124, 566], [116, 539], [114, 512], [113, 487], [106, 468], [92, 452], [74, 448], [58, 455], [44, 466], [34, 470], [0, 470]];
  }
  L.strat = function (ctx, o = {}) {
    ctx.save(); const s = guitarFrame(ctx, o, { len: 930, scale: 0.85 }); ctx.translate(0, -278);
    const sil = o.style === 'silhouette'; const SC = hx(o.color || '#0b0f1a');
    const [lx, ly] = lightVec(o); const amb = o.ambient === undefined ? 1 : o.ambient;
    const A = c => cs(cmul(c, amb));
    const lw = Math.max(0.8, 1.6 / s); const line = cs([58, 50, 44]);
    const body = splinePath(stratBodyPts(), true, 6);
    const headPts = [[-21, 0], [-23, -40], [-25, -100], [-26, -150], [-23, -174], [-12, -186], [6, -190], [26, -186], [44, -174], [55, -154], [56, -132], [48, -114], [34, -100], [25, -82], [21, -50], [21, 0]];
    const head = splinePath(headPts, true, 6);
    const neck = new Path2D(); neck.moveTo(-21, -2); neck.lineTo(-28.5, 470); neck.lineTo(28.5, 470); neck.lineTo(21, -2); neck.closePath();
    const tuners = [0, 1, 2, 3, 4, 5].map(k => [-12, -26 - k * 26]);
    if (sil) {
      ctx.fillStyle = cs(SC); ctx.fill(body); ctx.fill(neck); ctx.fill(head);
      for (const [px, py] of tuners) { ctx.beginPath(); ctx.ellipse(px - 30, py, 10, 6.5, 0, 0, TAU); ctx.fill(); ctx.fillRect(px - 30, py - 2.5, 20, 5); }
      ctx.lineWidth = 3; ctx.strokeStyle = cs(SC); ctx.beginPath(); ctx.moveTo(30, 664); ctx.quadraticCurveTo(70, 700, 82, 780); ctx.stroke();
      ctx.restore(); return;
    }
    // body: aged white with cel shading
    ctx.fillStyle = A([236, 230, 214]); ctx.fill(body);
    const dirt = ctx.createRadialGradient(-40, 560, 30, 0, 560, 260); dirt.addColorStop(0, 'rgba(0,0,0,0)'); dirt.addColorStop(1, cs([150, 132, 100], 0.25 * amb)); ctx.save(); ctx.clip(body); ctx.fillStyle = dirt; ctx.fillRect(-200, 300, 400, 460); ctx.restore();
    bandShade(ctx, body, lx * 14, ly * 14, cs(cmul([150, 140, 126], amb), 0.55));
    bandShade(ctx, body, lx * 5, ly * 5, cs(cmul([120, 110, 98], amb), 0.35));
    bandShade(ctx, body, -lx * 4, -ly * 4, cs([255, 252, 244], 0.85 * amb));
    // worn paint: edges, forearm contour, horn tip, below the bridge
    ctx.save(); ctx.clip(body); const wr = PV.rng(o.seed || 21);
    const wear = (cx2, cy2, rx, ry, rot) => {
      const pts = []; for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; const rr = 0.62 + 0.3 * (0.5 + 0.5 * PV.noise2(cx2 * 0.1 + Math.cos(a) * 1.3, cy2 * 0.1 + Math.sin(a) * 1.3)) + wr() * 0.18; pts.push([cx2 + Math.cos(a) * rx * rr, cy2 + Math.sin(a) * ry * rr]); }
      const pth = splinePath(pts.map(p => { const dx = p[0] - cx2, dy = p[1] - cy2; return [cx2 + dx * Math.cos(rot) - dy * Math.sin(rot), cy2 + dx * Math.sin(rot) + dy * Math.cos(rot)]; }), true, 4);
      ctx.fillStyle = A([212, 202, 170]); ctx.fill(pth);
      ctx.save(); ctx.translate(cx2, cy2); ctx.scale(0.84, 0.82); ctx.translate(-cx2, -cy2); ctx.fillStyle = A([176, 142, 100]); ctx.fill(pth);
      ctx.save(); ctx.clip(pth); ctx.strokeStyle = cs(cmul([140, 104, 66], amb), 0.5); ctx.lineWidth = 0.7; for (let k = -6; k <= 6; k++) { ctx.beginPath(); ctx.moveTo(cx2 + k * 5, cy2 - 80); ctx.lineTo(cx2 + k * 5 + 3, cy2 + 80); ctx.stroke(); } ctx.restore();
      ctx.strokeStyle = cs(cmul([120, 90, 58], amb), 0.6); ctx.lineWidth = 0.8; ctx.stroke(pth); ctx.restore();
      ctx.strokeStyle = cs(cmul([160, 150, 124], amb), 0.7); ctx.lineWidth = 0.9; ctx.stroke(pth);
    };
    wear(-150, 616, 18, 50, 0.1); wear(-58, 742, 30, 9, 0); wear(42, 744, 22, 7, 0); wear(154, 654, 9, 26, 0); wear(-128, 722, 16, 9, 0.6); wear(-132, 384, 8, 16, 0.4); wear(-92, 302, 10, 6, 0);
    for (let k = 0; k < 40; k++) { const P2 = stratBodyPts()[Math.floor(wr() * stratBodyPts().length)]; const cx2 = P2[0] * 0.97, cy2 = P2[1] + (P2[1] > 560 ? -4 : 3); ctx.fillStyle = A(wr() < 0.6 ? [176, 142, 100] : [212, 202, 170]); ctx.beginPath(); ctx.ellipse(cx2, cy2, 2 + wr() * 5, 1.5 + wr() * 3, wr() * 3, 0, TAU); ctx.fill(); }
    for (let k = 0; k < 50; k++) { const cx2 = (wr() - 0.5) * 280, cy2 = 360 + wr() * 360; const a = wr() * Math.PI, L2 = 3 + wr() * 14; ctx.strokeStyle = cs(cmul([150, 140, 120], amb), 0.35); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(cx2 + Math.cos(a) * L2, cy2 + Math.sin(a) * L2); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = line; ctx.lineWidth = lw * 1.2; ctx.stroke(body);
    // pickguard (3-ply mint/white)
    const pgp = splinePath(stratGuardPts(), true, 6);
    ctx.fillStyle = A([243, 241, 228]); ctx.fill(pgp);
    bandShade(ctx, pgp, lx * 3, ly * 3, cs(cmul([170, 166, 150], amb), 0.6));
    ctx.strokeStyle = cs(cmul([40, 40, 40], amb), 0.55); ctx.lineWidth = 1.6; ctx.stroke(pgp);
    ctx.save(); ctx.translate(0.7, 0.7); ctx.strokeStyle = cs([255, 255, 255], 0.6 * amb); ctx.lineWidth = 0.8; ctx.stroke(pgp); ctx.restore();
    for (const [sx2, sy2] of [[-44, 404], [-100, 398], [-112, 470], [-100, 562], [-80, 614], [10, 621], [70, 652], [112, 678], [134, 616], [112, 520], [92, 458]]) { ctx.fillStyle = A([180, 180, 184]); ctx.beginPath(); ctx.arc(sx2, sy2, 2.4, 0, TAU); ctx.fill(); ctx.strokeStyle = cs([60, 60, 60], 0.6); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(sx2 - 1.6, sy2); ctx.lineTo(sx2 + 1.6, sy2); ctx.stroke(); }
    // pickups
    const pu = (cy2, rot) => {
      ctx.save(); ctx.translate(0, cy2); ctx.rotate(rot);
      const p = new Path2D(); p.roundRect ? p.roundRect(-36, -9, 72, 18, 8) : p.rect(-36, -9, 72, 18);
      ctx.fillStyle = A([236, 234, 220]); ctx.fill(p); bandShade(ctx, p, lx * 2.5, ly * 2.5, cs(cmul([150, 146, 132], amb), 0.6)); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(p);
      for (let k = 0; k < 6; k++) { ctx.fillStyle = A([150, 150, 156]); ctx.beginPath(); ctx.arc(-26 + k * 10.4, 0, 2.2, 0, TAU); ctx.fill(); }
      ctx.restore();
    };
    pu(489, 0); pu(548, 0); pu(604, -0.15);
    // knobs + switch + jack
    for (const [kx, ky] of [[64, 627], [82, 655], [98, 680]]) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(kx + 2, ky + 2, 11, 0, TAU); ctx.fill(); const kg = ctx.createRadialGradient(kx - 4, ky - 4, 1, kx, ky, 11); kg.addColorStop(0, A([255, 254, 248])); kg.addColorStop(1, A([196, 194, 182])); ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, 11, 0, TAU); ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = lw * 0.8; ctx.stroke(); ctx.fillStyle = A([60, 60, 60]); ctx.font = '600 6px Cormorant, serif'; ctx.textAlign = 'center'; ctx.fillText('10', kx, ky - 4); }
    ctx.save(); ctx.translate(58, 584); ctx.rotate(-0.55); ctx.fillStyle = A([30, 30, 30]); ctx.fillRect(-12, -1.8, 24, 3.6); ctx.fillStyle = A([246, 244, 236]); ctx.beginPath(); ctx.ellipse(3, 0, 4.5, 3.2, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(133, 684); ctx.rotate(-0.95); ctx.fillStyle = A([170, 170, 176]); ctx.beginPath(); ctx.ellipse(0, 0, 16, 9, 0, 0, TAU); ctx.fill(); ctx.fillStyle = A([40, 40, 44]); ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.fill(); ctx.restore();
    // tremolo bridge + arm
    const bp = new Path2D(); bp.roundRect ? bp.roundRect(-37, 628, 74, 40, 3) : bp.rect(-37, 628, 74, 40);
    let mg = ctx.createLinearGradient(0, 628, 0, 668); mg.addColorStop(0, A([236, 236, 240])); mg.addColorStop(0.5, A([150, 150, 158])); mg.addColorStop(1, A([210, 210, 216])); ctx.fillStyle = mg; ctx.fill(bp); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(bp);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = A([120, 120, 128]); ctx.fillRect(-31 + k * 10.4, 642, 8, 14); ctx.fillStyle = A([235, 235, 240]); ctx.fillRect(-31 + k * 10.4, 642, 8, 3); ctx.fillStyle = A([80, 80, 88]); ctx.beginPath(); ctx.arc(-27 + k * 10.4, 633, 1.6, 0, TAU); ctx.fill(); }
    ctx.lineCap = 'round'; ctx.strokeStyle = A([200, 200, 206]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(32, 664); ctx.quadraticCurveTo(70, 700, 82, 780); ctx.stroke();
    ctx.fillStyle = A([246, 244, 236]); ctx.beginPath(); ctx.ellipse(82, 786, 3.4, 9, 0.15, 0, TAU); ctx.fill();
    // maple neck + headstock
    let ng = ctx.createLinearGradient(-28, 0, 28, 0); ng.addColorStop(0, A([210, 160, 90])); ng.addColorStop(0.5, A([236, 196, 128])); ng.addColorStop(1, A([212, 162, 92])); ctx.fillStyle = ng; ctx.fill(neck);
    ctx.save(); ctx.clip(neck); const nr = PV.rng(41); for (let k = 0; k < 18; k++) { const f = 1 + Math.floor(Math.pow(nr(), 1.3) * 8); const fy = (fretX(f - 1) + fretX(f)) / 2; ctx.fillStyle = cs(cmul([136, 112, 84], amb), 0.35); ctx.beginPath(); ctx.ellipse(-8 + nr() * 18, fy + (nr() - 0.5) * 10, 5 + nr() * 6, 3 + nr() * 3, 0, 0, TAU); ctx.fill(); } ctx.restore();
    for (let n = 1; n <= 21; n++) { const fy = fretX(n); const hw = lerp(21, 28, fy / 470); ctx.strokeStyle = A([170, 166, 160]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-hw, fy); ctx.lineTo(hw, fy); ctx.stroke(); }
    for (const n of [3, 5, 7, 9, 15, 17, 19, 21]) { const fy = (fretX(n - 1) + fretX(n)) / 2; ctx.fillStyle = A([28, 24, 22]); ctx.beginPath(); ctx.arc(0, fy, 2.8, 0, TAU); ctx.fill(); }
    { const fy = (fretX(11) + fretX(12)) / 2; ctx.fillStyle = A([28, 24, 22]); ctx.beginPath(); ctx.arc(-9, fy, 2.8, 0, TAU); ctx.arc(9, fy, 2.8, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(neck);
    ng = ctx.createLinearGradient(-30, -100, 50, -100); ng.addColorStop(0, A([214, 164, 94])); ng.addColorStop(0.5, A([238, 198, 130])); ng.addColorStop(1, A([210, 160, 90])); ctx.fillStyle = ng; ctx.fill(head);
    bandShade(ctx, head, lx * 4, ly * 4, cs(cmul([150, 100, 50], amb), 0.35)); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(head);
    ctx.fillStyle = A([238, 232, 210]); ctx.fillRect(-21, -4, 42, 5);
    for (const [px, py] of tuners) {
      ctx.fillStyle = A([200, 200, 206]); ctx.fillRect(px - 30, py - 2.5, 20, 5);
      const kg = ctx.createLinearGradient(px - 40, py - 6, px - 40, py + 6); kg.addColorStop(0, A([250, 250, 252])); kg.addColorStop(1, A([140, 140, 148])); ctx.fillStyle = kg; ctx.beginPath(); ctx.ellipse(px - 33, py, 9, 6, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = lw * 0.7; ctx.stroke();
      ctx.fillStyle = A([214, 214, 220]); ctx.beginPath(); ctx.arc(px, py, 4.2, 0, TAU); ctx.fill(); ctx.strokeStyle = line; ctx.stroke();
    }
    ctx.fillStyle = A([200, 200, 206]); ctx.beginPath(); ctx.arc(3, -58, 3.2, 0, TAU); ctx.fill();
    // strings: saddles -> nut -> tuner posts
    for (let i = 0; i < 6; i++) {
      const bx = -26 + i * 10.4, nx2 = -17.5 + i * 7; const [px, py] = tuners[i];
      ctx.strokeStyle = i < 3 ? A([206, 204, 196]) : A([232, 232, 236]); ctx.lineWidth = Math.max(0.5, 1.35 - i * 0.16);
      ctx.beginPath(); ctx.moveTo(bx + 2, 648); ctx.lineTo(nx2, -2);
      if (i >= 4) { ctx.lineTo(3 + (i - 4) * 2, -58); }
      ctx.lineTo(px + 3, py); ctx.stroke();
    }
    ctx.restore();
  };

  /* ======================================================================
   * WINDOW + CURTAIN close-up (frontal). o: {x,y,w,h (frame rect), time:'noon'|'rain'|'dusk', rain 0..1,
   *   wind 0..1, open 0..1, gap 0..1 (curtain split), grip:{side:'left'|'right', v, pull}}
   * ====================================================================== */
  L.windowCurtain = function (ctx, t, o = {}) {
    const time = ROOM_TIME[o.time] ? o.time : (o.rain ? 'rain' : 'noon'); const P = ROOM_TIME[time];
    const fx = o.x || 0, fy = o.y || 0, fw = o.w || W, fh = o.h || H;
    // window world: opening 1.9 x 1.6 m (sill 0) at z=0; camera straight on
    const ww = 1.9, wh = 1.62, D = 3.2;
    const focal = fw / (ww + 1.4) * D;
    const cam = makeCam([ww / 2 + (o.camX || 0), wh * 0.52 + (o.camY || 0), D], [ww / 2 + (o.camX || 0) * 0.6, wh * 0.52, 0], focal, fx + fw / 2, fy + fh / 2, o.roll || 0, 0.05);
    const Q = pts => cam.poly(pts);
    const wallC = hx(P.wall), wallD = hx(P.wallDark), frameC = hx(P.frame);
    const rain = o.rain === undefined ? (time === 'rain' ? 1 : 0) : o.rain;
    const open = o.open === undefined ? (time === 'rain' ? 0 : 0.6) : o.open;
    ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip(); const PM = profMarks(ctx, 'window');
    // outside
    const hole = Q([[0, 0, -0.18], [ww, 0, -0.18], [ww, wh, -0.18], [0, wh, -0.18]]);
    ctx.save(); ctx.beginPath(); trace(ctx, hole); ctx.clip(); ctx.translate(fx, fy); ctx.scale(fw / W, fh / H); paintOutside(ctx, t, P, o, -(o.camX || 0) * 200); ctx.restore();
    const wkey = [fx, fy, fw, fh, time, rain, open, o.camX || 0, o.camY || 0, o.roll || 0].map(v => typeof v === 'number' ? v.toFixed(3) : v).join('|');
    const frameL = cachedLayer('winFrame', wkey, W, H, (c) => {
      c.beginPath(); c.rect(fx, fy, fw, fh); c.clip();
    // wall with opening
    const wallLv = P.lv.win * 0.95;
    c.beginPath(); trace(c, Q([[-3, -2, 0], [ww + 3, -2, 0], [ww + 3, wh + 2, 0], [-3, wh + 2, 0]])); trace(c, Q([[0, 0, 0], [ww, 0, 0], [ww, wh, 0], [0, wh, 0]]));
    const wg = c.createLinearGradient(fx, fy, fx, fy + fh); wg.addColorStop(0, cs(cmul(wallC, wallLv * 0.9))); wg.addColorStop(1, cs(cmul(cmix(wallC, wallD, 0.4), wallLv * 0.85))); c.fillStyle = wg; c.fill('evenodd');
    // reveals
    for (const [pts, nr] of [[[[0, 0, 0], [0, 0, -0.18], [0, wh, -0.18], [0, wh, 0]], [1, 0, 0]], [[[ww, 0, -0.18], [ww, 0, 0], [ww, wh, 0], [ww, wh, -0.18]], [-1, 0, 0]], [[[0, 0, 0], [ww, 0, 0], [ww, 0, -0.18], [0, 0, -0.18]], [0, 1, 0]], [[[0, wh, -0.18], [ww, wh, -0.18], [ww, wh, 0], [0, wh, 0]], [0, -1, 0]]]) {
      if (!cam.facing(vmul(vadd(pts[0], pts[2]), 0.5), nr)) continue; fillP(c, Q(pts), cs(cadd(cmul(wallC, wallLv * 1.05), hx(P.sunCol), P.sun && nr[1] > 0 ? 0.5 : 0.08)));
    }
    // sashes
    const frameDark = cmul(cmix(frameC, wallD, 0.45), P.sun ? 0.72 : 0.85), frameLit = cadd(frameC, hx(P.sunCol), P.sun ? 0.25 : 0.05);
    const bar = (x0, y0, x1, y1, z) => { fillP(c, Q([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]), cs(frameDark)); strokeL(c, cam.line([[x0, y1, z], [x1, y1, z]]), cs(frameLit, 0.7), 1.2); strokeL(c, cam.line([[x0, y0, z], [x0, y1, z]]), cs(frameLit, 0.35), 1); };
    const zg = -0.09, xm = ww / 2, slide = open * (ww / 2 - 0.08);
    bar(0, 0, 0.05, wh, zg + 0.02); bar(ww - 0.05, 0, ww, wh, zg + 0.02); bar(0, 0, ww, 0.05, zg + 0.02); bar(0, wh - 0.05, ww, wh, zg + 0.02);
    const sash = (a, b, z) => { bar(a, 0.05, a + 0.045, wh - 0.05, z); bar(b - 0.045, 0.05, b, wh - 0.05, z); bar(a, 0.05, b, 0.1, z); bar(a, wh - 0.09, b, wh - 0.05, z); bar(a, wh * 0.55, b, wh * 0.55 + 0.03, z); };
    sash(0.05, xm + 0.03, zg); sash(xm - 0.03 - slide, ww - 0.05 - slide, zg + 0.035);
    // crescent lock
    { const p = cam.p([xm, wh * 0.5, zg + 0.04]); const sc = cam.scaleAt([xm, wh * 0.5, 0]); c.fillStyle = cs(cmul(frameC, 0.9)); c.beginPath(); c.arc(p[0], p[1], 0.03 * sc, Math.PI, TAU); c.fill(); }
    // glass: sheen + rain drops
    const glassR = Q([[0.05, 0.05, zg], [ww - 0.05 - (open > 0.5 ? ww * 0.45 : 0), 0.05, zg], [ww - 0.05 - (open > 0.5 ? ww * 0.45 : 0), wh - 0.05, zg], [0.05, wh - 0.05, zg]]);
    if (glassR) {
      c.save(); c.beginPath(); trace(c, glassR); c.clip();
      const a = cam.p([0, wh, zg]), b = cam.p([ww, 0, zg]); const g = c.createLinearGradient(a[0], a[1], b[0], b[1]); const k = rain ? 0.14 : 0.07;
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, `rgba(255,255,255,${k})`); g.addColorStop(0.36, 'rgba(255,255,255,0)'); g.addColorStop(0.58, `rgba(255,255,255,${k * 0.7})`); g.addColorStop(0.62, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(fx, fy, fw, fh);
      if (rain > 0) { const bb = glassR.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [1e9, 1e9, -1e9, -1e9]); glassDrops(c, 0, { only: 'static', x: bb[0], y: bb[1], w: bb[2] - bb[0], h: bb[3] - bb[1], seed: 77, scale: fw / 1100, density: 1.0 * rain }); }
      c.restore();
    }
    });
    PM('outside'); ctx.drawImage(frameL, 0, 0); PM('frame');
    // running drops (dynamic)
    if (rain > 0) {
      const glassR2 = Q([[0.05, 0.05, -0.09], [ww - 0.05 - (open > 0.5 ? ww * 0.45 : 0), 0.05, -0.09], [ww - 0.05 - (open > 0.5 ? ww * 0.45 : 0), wh - 0.05, -0.09], [0.05, wh - 0.05, -0.09]]);
      if (glassR2) { ctx.save(); ctx.beginPath(); trace(ctx, glassR2); ctx.clip(); const bb = glassR2.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [1e9, 1e9, -1e9, -1e9]); glassDrops(ctx, t, { only: 'runners', x: bb[0], y: bb[1], w: bb[2] - bb[0], h: bb[3] - bb[1], seed: 77, scale: fw / 1100, density: 1.0 * rain }); ctx.restore(); }
    }
    PM('runners');
    // curtains: two panels with an adjustable gap
    const gap = o.gap === undefined ? 0.28 : o.gap; const wind = o.wind === undefined ? (open > 0.05 ? 0.45 : 0) : o.wind;
    const wL = (ww + 0.5) * (1 - gap) / 2;
    const grip = o.grip;
    let gripPt = null;
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -0.3 : ww + 0.3 - wL, x1 = side < 0 ? -0.3 + wL : ww + 0.3;
      const gr = grip && ((grip.side === 'left') === (side < 0)) ? grip : null;
      const opts = { smooth: true, x0, x1, yTop: wh + 0.16, yHem: -0.3, z0: 0.14, folds: 5.2, depth: 0.04, color: P.curtain, shade: P.curtainShade, wind: wind * (side < 0 ? 0.7 : 1), windSide: -side, seed: side < 0 ? 5 : 8, strips: 110, rows: 14, front: P.sun ? 0.3 : 0.5, edgeSide: side < 0 ? 1 : 0,
        back: (u, v, x) => (x > 0.05 && x < ww - 0.05 && v < 0.82 ? 1 : 0.45) * (P.sun ? 1 : 0.62) };
      if (gr) {
        // the cloth is pulled toward the gripping hand: folds converge at the grip point
        const gv = gr.v === undefined ? 0.45 : gr.v, pull = gr.pull === undefined ? 0.6 : gr.pull; const ue = side < 0 ? 1 : 0;
        const base = curtainShape(opts, t);
        opts.toWorld = null;
        const shape0 = base;
        const span = x1 - x0, hgt = opts.yTop - opts.yHem;
        const custom = (u, v) => {
          const d = shape0(u, v);
          const wx = (u - ue) * span, wy = (v - gv) * hgt; const r = Math.hypot(wx, wy * 0.75);
          const f = Math.exp(-(r * r) / 0.22) * pull, f2 = Math.exp(-(r * r) / 0.9);
          d[0] += -wx * f * 0.9 - side * pull * 0.16 * f2;            // gathered toward the fist, the edge drawn into the gap
          d[1] += -wy * f * 0.62;
          const ang = Math.atan2(wy, wx);                              // tension folds radiating from the grip
          d[2] += pull * (0.1 * f2 * Math.sin(ang * 6 + r * 6) * Math.min(1, r * 3.5) + 0.08 * f);
          return d;
        };
        drawCurtainPanelCustom(ctx, cam, t, opts, custom);
        gripPt = cam.p([lerp(x0, x1, ue) - side * pull * 0.12, lerp(opts.yTop, opts.yHem, gv), opts.z0 + 0.06 * pull]);
      } else drawCurtainPanel(ctx, cam, t, opts);
    }
    strokeL(ctx, cam.line([[-0.6, wh + 0.2, 0.12], [ww + 0.6, wh + 0.2, 0.12]]), cs(cmul(frameC, 0.7)), Math.max(2, 0.025 * cam.scaleAt([1, wh, 0])));
    // room-side dimness
    PM('curtains');
    if (time === 'rain') { const vg = ctx.createRadialGradient(fx + fw / 2, fy + fh * 0.45, fh * 0.25, fx + fw / 2, fy + fh / 2, fh * 0.95); vg.addColorStop(0, 'rgba(20,26,40,0)'); vg.addColorStop(1, 'rgba(14,18,30,0.55)'); ctx.fillStyle = vg; ctx.fillRect(fx, fy, fw, fh); }
    ctx.restore(); PM('end');
    return { cam, grip: gripPt, sill: cam.p([ww / 2, 0, 0]), gapCenter: cam.p([ww / 2, wh * 0.5, 0.14]) };
  };
  // curtain panel with a caller-supplied shape(u,v)->[dx,dy,w]
  function drawCurtainPanelCustom(ctx, cam, t, o, shapeFn) {
    const saved = curtainShapeOverride; curtainShapeOverride = shapeFn; try { drawCurtainPanel(ctx, cam, t, o); } finally { curtainShapeOverride = saved; }
  }
  let curtainShapeOverride = null;

  /* --- export internals for the other sections of this file */
  const I = { softBlit, vadd, vsub, vmul, vdot, vcross, vnorm, vlen, vlerp, reflect, mirrorP, hx, cs, cmix, cmul, cadd, cfilt, tone, makeCam, trace, fillP, strokeL, spline, pathPts, bez, scratch, blit, rimLight, silBuffer, makeWin, makeDisc, envLook, mirrorLights, sstep, fract, KEYS, KW };
  L._instr = I;
})();

/* g04_festival_summer — C13 文化祭の爆音 / C14 一弦が切れる / C15 夏の臨海公園（写真）
 *   C13 40.5–43.5  dark gym, booing → 41.6 he looks at her and nods, winds up → 42.0 the D-major blast: the hall goes
 *                  white-hot behind the black audience and the two backs, settles into amber/magenta/cyan; a dolly in
 *   C14 43.5–46.5  his ring finger bends the 1st string → 43.75 it snaps → whip pull-back → kneeling to his amp in the
 *                  spotlight; a phone rises in the foreground (● REC) and takes the focus
 *   C15 46.5–49.5  the brightest day: the two at the sea fence → 48.2 the selfie preview, his thumb on the shutter →
 *                  49.0 the shutter: a white-bordered photo (handed to C16's dip to white)
 * Also exports PV.summerPhoto(ctx, w, h, layer) — the very same photo, reused by C19 ('bg' = all but him, 'him' = him only).
 * Cost: the heavy static parts are cached plates (hall, far sea/sky, fence, phone bodies, the photo); per frame only the
 * figures, the hands and the small moving things are painted.
 */
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, TAU = Math.PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp, sm = PV.smooth, N2 = PV.noise2, R1 = PV.rand1;
  const E = PV.ease;
  const q12 = (t) => Math.floor(t * 12 + 1e-6) / 12; // anime "on twos"

  /* ======================================================================= shared helpers */
  // Catmull-Rom closed path through pts ([x,y] or [x,y,1] = sharp corner)
  function spline(c, pts, closed) {
    const n = pts.length; if (n < 2) return;
    const P = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    c.moveTo(pts[0][0], pts[0][1]);
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const s1 = p1[2] ? 0 : 1 / 6, s2 = p2[2] ? 0 : 1 / 6;
      c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * s1, p1[1] + (p2[1] - p0[1]) * s1, p2[0] - (p3[0] - p1[0]) * s2, p2[1] - (p3[1] - p1[1]) * s2, p2[0], p2[1]);
    }
    if (closed) c.closePath();
  }
  function blob(c, pts) { c.beginPath(); spline(c, pts, true); c.fill(); }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(1e-4, rx), Math.max(1e-4, ry), rot || 0, 0, TAU); c.fill(); }
  // tapered capsule p0->p1 with end radii r0,r1 (bulge b at fraction f)
  function limb(c, p0, p1, r0, r1, bulge, f) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1e-6, ux = dx / l, uy = dy / l, nx = uy, ny = -ux;
    const b = bulge === undefined ? (r0 + r1) / 2 : bulge, ff = f === undefined ? 0.4 : f;
    const mx = p0[0] + dx * ff, my = p0[1] + dy * ff, ang = Math.atan2(uy, ux);
    c.beginPath();
    c.moveTo(p0[0] + nx * r0, p0[1] + ny * r0);
    c.quadraticCurveTo(mx + nx * b * 1.08, my + ny * b * 1.08, p1[0] + nx * r1, p1[1] + ny * r1);
    c.arc(p1[0], p1[1], Math.max(1e-4, r1), ang - Math.PI / 2, ang + Math.PI / 2, false);
    c.quadraticCurveTo(mx - nx * b * 1.08, my - ny * b * 1.08, p0[0] - nx * r0, p0[1] - ny * r0);
    c.arc(p0[0], p0[1], Math.max(1e-4, r0), ang + Math.PI / 2, ang + Math.PI * 1.5, false);
    c.closePath(); c.fill();
  }
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mix2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  // a colour ('#hex' or the figure library's 'rgba(r,g,b,a)') with a new alpha
  const withA = (col, a) => (col[0] === '#' ? PV.rgba(col, a) : col.replace(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)[^)]*\)/, `rgba($1,$2,$3,${a})`));

  // soft radial light (no state leaks)
  function light(ctx, x, y, r, col, a, mode) {
    if (a <= 0.003 || r <= 1) return;
    ctx.save(); ctx.globalCompositeOperation = mode || 'screen';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, PV.rgba(col, a)); g.addColorStop(0.18, PV.rgba(col, a * 0.55)); g.addColorStop(0.5, PV.rgba(col, a * 0.16)); g.addColorStop(1, PV.rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  // the same soft light from a cached sprite (cheap for many small lights)
  function glowSpr(col) {
    return PV.cached('g04:glowspr:' + col, 64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, PV.rgba(col, 1)); g.addColorStop(0.18, PV.rgba(col, 0.55)); g.addColorStop(0.5, PV.rgba(col, 0.16)); g.addColorStop(1, PV.rgba(col, 0)); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
  }
  function lightS(ctx, x, y, r, col, a) { if (a <= 0.003) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(glowSpr(col), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }
  // a cone of light from (x,y) toward angle `ang`, half-angle `ha`, length `len`; painted at 1/4 res and blurred.
  // box (optional) = the world rectangle the returned canvas covers ({x0,y0,w,h}; default the screen)
  function beamsLayer(key, list, blurPx, box) {
    const bx0 = box ? box.x0 : 0, by0 = box ? box.y0 : 0, q = 0.25, bw = Math.round((box ? box.w : W) * q), bh = Math.round((box ? box.h : H) * q);
    const b = PV.buffer('g04:beam:' + key, bw, bh), c = b.ctx; c.clearRect(0, 0, bw, bh);
    c.setTransform(q, 0, 0, q, -bx0 * q, -by0 * q); c.globalCompositeOperation = 'lighter';
    for (const B of list) {
      if (!(B.a > 0.003)) continue;
      const ex = B.x + Math.cos(B.ang) * B.len, ey = B.y + Math.sin(B.ang) * B.len;
      const g = c.createLinearGradient(B.x, B.y, ex, ey);
      g.addColorStop(0, PV.rgba(B.col, B.a)); g.addColorStop(0.25, PV.rgba(B.col, B.a * 0.62)); g.addColorStop(0.7, PV.rgba(B.col, B.a * 0.2)); g.addColorStop(1, PV.rgba(B.col, 0));
      c.fillStyle = g; c.beginPath(); c.moveTo(B.x + Math.cos(B.ang + Math.PI / 2) * (B.w0 || 6), B.y + Math.sin(B.ang + Math.PI / 2) * (B.w0 || 6));
      c.lineTo(B.x + Math.cos(B.ang + B.ha) * B.len, B.y + Math.sin(B.ang + B.ha) * B.len);
      c.lineTo(B.x + Math.cos(B.ang - B.ha) * B.len, B.y + Math.sin(B.ang - B.ha) * B.len);
      c.lineTo(B.x + Math.cos(B.ang - Math.PI / 2) * (B.w0 || 6), B.y + Math.sin(B.ang - Math.PI / 2) * (B.w0 || 6)); c.closePath(); c.fill();
      // brighter core
      c.fillStyle = g; c.globalAlpha = 0.6; c.beginPath(); c.moveTo(B.x, B.y);
      c.lineTo(B.x + Math.cos(B.ang + B.ha * 0.35) * B.len * 0.8, B.y + Math.sin(B.ang + B.ha * 0.35) * B.len * 0.8);
      c.lineTo(B.x + Math.cos(B.ang - B.ha * 0.35) * B.len * 0.8, B.y + Math.sin(B.ang - B.ha * 0.35) * B.len * 0.8); c.closePath(); c.fill(); c.globalAlpha = 1;
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over';
    const b2 = PV.buffer('g04:beamB:' + key, bw, bh); b2.ctx.clearRect(0, 0, bw, bh); b2.ctx.filter = `blur(${blurPx || 3}px)`; b2.ctx.drawImage(b.canvas, 0, 0); b2.ctx.filter = 'none';
    return b2.canvas;
  }
  // the same kind of beam painted straight at full res (no up-scaling pass): three nested cones fake the soft edge.
  // Cheap enough to animate per frame (a thin beam costs ~0.5 ms).
  function softBeams(c, list) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const B of list) {
      if (!(B.a > 0.003)) continue;
      const ex = B.x + Math.cos(B.ang) * B.len, ey = B.y + Math.sin(B.ang) * B.len, w0 = B.w0 || 6;
      for (const [hk, ak] of [[1, 0.3], [0.62, 0.32], [0.3, 0.38]]) {
        const a = B.a * ak, g = c.createLinearGradient(B.x, B.y, ex, ey);
        g.addColorStop(0, PV.rgba(B.col, a)); g.addColorStop(0.25, PV.rgba(B.col, a * 0.62)); g.addColorStop(0.7, PV.rgba(B.col, a * 0.2)); g.addColorStop(1, PV.rgba(B.col, 0));
        const h = B.ha * hk, w = w0 * hk;
        c.fillStyle = g; c.beginPath();
        c.moveTo(B.x + Math.cos(B.ang + Math.PI / 2) * w, B.y + Math.sin(B.ang + Math.PI / 2) * w);
        c.lineTo(B.x + Math.cos(B.ang + h) * B.len, B.y + Math.sin(B.ang + h) * B.len);
        c.lineTo(B.x + Math.cos(B.ang - h) * B.len, B.y + Math.sin(B.ang - h) * B.len);
        c.lineTo(B.x + Math.cos(B.ang - Math.PI / 2) * w, B.y + Math.sin(B.ang - Math.PI / 2) * w); c.closePath(); c.fill();
      }
    }
    c.restore();
  }
  // deterministic camera shake
  // dev profiler: PV._g04prof = true → per-section ms in PV._g04profOut (forces rasterisation at each mark)
  function profiler(ctx, keep) {
    if (!PV._g04prof) return () => {};
    let t0 = performance.now(); const out = keep && PV._g04profOut ? PV._g04profOut : (PV._g04profOut = {});
    return (name) => { ctx.getImageData(0, 0, 1, 1); const t1 = performance.now(); out[name] = (out[name] || 0) + (t1 - t0); t0 = t1; };
  }
  function shake(t, amp, freq, seed) { return { x: N2(t * freq, seed + 1.3) * amp, y: N2(seed + 7.7, t * freq) * amp, r: N2(t * freq * 0.7, seed + 3.1) * amp * 0.0009 }; }
  // per-shot bloom through the engine's own post pass (documented S.post control), merged with whatever the timeline sets
  function setBloom(S, bloom, halation) {
    if (!S) return;
    if (!S._g04post) S._g04post = Object.assign({}, S.post || {});
    S.post = Object.assign({}, S._g04post, { bloom, halation });
  }

  /* ======================================================================= C13 — the stage, seen from the audience */
  // Anime rework (faces): the reverse of the old angle. From the middle of the hall, a little above the heads of the people in
  // front, the two face us in front of the closed stage curtain: 彼 (left) with the white Strat, 先輩 (right — she stands on his
  // left) at the 61-key keyboard, his amp between them, a light tree behind each, PA speakers at the edges. Booing in the
  // dark: only the low work lights at the sides, the phone screens and the amp's red pilot lamp. 41.6 he turns to her and
  // nods, she nods back; he winds up; 42.0 the D-major blast: every lamp at once (the light trees and the ceiling pars behind
  // them, the gallery follow-spots behind us), white-hot for a few frames, then amber / magenta / cyan; the camera takes the
  // shock and pushes in; their hair flies.
  // Global time: lip-sync / blinks need the timeline's own seconds (the solo renderer shifts a shot to start at 0).
  const START = { C13: 40.5, C14: 43.5, C15: 46.5 };
  const absT = (S, id, t) => ((S && S.start > 0.01) ? S.start : START[id]) + t;
  const C13 = { nod: 1.1, blast: 1.5 };
  // the hall in perspective (m): the camera in the front row behind the rope (1.6 m, level); the figures are drawn
  // orthographic at their floor points
  const EYE = 360, FOC = 2700, CAMH = 1.6, D13 = 5.6;
  const yAt = (h, d) => EYE + FOC * (CAMH - h) / d, xAt = (X, d) => 960 + FOC * X / d;
  const AMB = '#ffbf6b', MAG = '#ff5fa8', CYA = '#5fd7ff', RED = '#ff3b30';
  const FLOOR13 = yAt(0, D13);
  const BOY13 = { x: xAt(-0.88, D13), y: FLOOR13, s: 0.244 * FOC / D13 };   // his head 24.4 cm, hers 23 cm (design 1-2)
  const GIRL13 = { x: xAt(0.9, D13), y: FLOOR13, s: 0.23 * FOC / D13 };
  const PADX = 48, PADY = 30, BGW13 = W + PADX * 2, BGH13 = H + PADY * 2;
  const STG_H = 1.1, CUR_D = 9.6, LIP_D = 8.8;          // the stage (1.1 m high): its front, the closed curtain on it
  const TREE_D = 8.0, TREE_H = 2.42;                    // two light trees on the floor (4 PAR cans on a T-bar each), facing us
  const TREES = [{ X: -2.1, cols: [CYA, AMB, MAG, CYA] }, { X: 2.1, cols: [MAG, AMB, CYA, MAG] }];
  const LAMPS13 = [];
  for (const Tr of TREES) for (let i = 0; i < 4; i++) LAMPS13.push({ x: xAt(Tr.X + (i - 1.5) * 0.27, TREE_D), y: yAt(TREE_H, TREE_D), r: 0.095 * FOC / TREE_D, col: Tr.cols[i], side: Math.sign(Tr.X), i });
  const AMP_D = 6.5, AMP_K = 0.5 * FOC / AMP_D / 176;   // the combo amp between them (c14Amp, 176 px = 0.5 m wide)
  const AMP13 = { x: xAt(0.03, AMP_D) - 88 * AMP_K, y: yAt(0, AMP_D) - 168 * AMP_K };
  const JEWEL13 = [AMP13.x + 18 * AMP_K, AMP13.y + 16 * AMP_K];
  const SPK13 = [{ X: -2.58, d: 7.6 }, { X: 2.58, d: 7.6 }];   // PA speakers on poles at the frame edges
  const CC13 = { cx: 960, cy: 420 };                          // the push-in centre (between the two faces)

  // ---- the stage plate (screen space + padding for the shake). mode 'dark' | 'lit' | 'burst'
  function c13Stage(mode) {
    return PV.cached('g04:c13stage2:' + mode, BGW13, BGH13, (c) => {
      c.translate(PADX, PADY);
      const lit = mode !== 'dark', hot = mode === 'burst';
      const yC = yAt(STG_H, CUR_D), yLip = yAt(STG_H, LIP_D), yBase = yAt(0, LIP_D);
      const X0 = -PADX, X1 = W + PADX;
      // 1 the closed curtain (緞帳): heavy wine-red folds, the fly tower above falls into black
      for (let x = X0; x < X1; x += 2) {
        const f = 0.5 + 0.5 * Math.sin(x * 0.03 + Math.sin(x * 0.0085) * 2.6), f2 = 0.5 + 0.5 * Math.sin(x * 0.093 + 1.3 + Math.sin(x * 0.02));
        const v = lit ? 30 + 44 * f + 9 * f2 : 10 + 15 * f + 3 * f2;
        c.fillStyle = `rgb(${Math.round(v * 1.5)},${Math.round(v * 0.34)},${Math.round(v * 0.45)})`;
        c.fillRect(x, -PADY, 2, yC + PADY + 1);
      }
      let g = c.createLinearGradient(0, -PADY, 0, yC);
      g.addColorStop(0, `rgba(4,2,5,${lit ? 0.5 : 0.8})`); g.addColorStop(0.5, `rgba(4,2,5,${lit ? 0.08 : 0.3})`); g.addColorStop(0.92, 'rgba(4,2,5,0)'); g.addColorStop(1, 'rgba(4,2,5,0.3)');
      c.fillStyle = g; c.fillRect(X0, -PADY, X1 - X0, yC + PADY);
      // the hem: a dull gold fringe on the stage floor
      c.fillStyle = lit ? '#6e4224' : '#22150d'; c.fillRect(X0, yC - 10, X1 - X0, 10);
      c.fillStyle = lit ? 'rgba(255,214,150,0.4)' : 'rgba(150,110,70,0.14)'; c.fillRect(X0, yC - 10, X1 - X0, 1.2);
      // 2 the stage floor strip, its lip; 3 the stage front with the chair-storage doors (ステージ下の収納); 4 the gym floor
      c.fillStyle = lit ? '#341d22' : '#0f0b0e'; c.fillRect(X0, yC, X1 - X0, yLip - yC);
      c.fillStyle = lit ? 'rgba(255,214,180,0.55)' : 'rgba(150,110,90,0.18)'; c.fillRect(X0, yLip - 2, X1 - X0, 2);
      g = c.createLinearGradient(0, yLip, 0, yBase); g.addColorStop(0, lit ? '#2a1a1f' : '#0d0a0d'); g.addColorStop(1, lit ? '#1f1418' : '#09080b');
      c.fillStyle = g; c.fillRect(X0, yLip, X1 - X0, yBase - yLip);
      const dw = 1.15 * FOC / LIP_D, dTop = yLip + 0.12 * FOC / LIP_D, dBot = yBase - 0.1 * FOC / LIP_D;
      for (let x = 960 - dw * 6; x < X1; x += dw) {
        c.fillStyle = lit ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.3)'; c.fillRect(x + 6, dTop, dw - 12, 3); c.fillRect(x + 6, dTop, 3, dBot - dTop);
        c.fillStyle = lit ? 'rgba(255,214,190,0.08)' : 'rgba(120,100,110,0.05)'; c.fillRect(x + 6, dBot - 2, dw - 12, 2); c.fillRect(x + dw - 9, dTop, 2, dBot - dTop);
        c.fillStyle = lit ? 'rgba(220,200,190,0.35)' : 'rgba(90,85,95,0.25)'; c.fillRect(x + dw / 2 - 18, dTop + (dBot - dTop) * 0.22, 36, 5);   // handle
      }
      g = c.createLinearGradient(0, yBase, 0, H + PADY); g.addColorStop(0, lit ? '#2c1b20' : '#100c10'); g.addColorStop(1, lit ? '#1e1317' : '#09080b');
      c.fillStyle = g; c.fillRect(X0, yBase, X1 - X0, H + PADY - yBase);
      // floor boards converging on the vanishing point; a painted court line across
      c.strokeStyle = lit ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.28)'; c.lineWidth = 1.2;
      for (let X = -7; X <= 7; X += 0.36) { c.beginPath(); c.moveTo(xAt(X, LIP_D), yBase); c.lineTo(xAt(X, 3.0), yAt(0, 3.0)); c.stroke(); }
      c.strokeStyle = lit ? 'rgba(255,236,200,0.3)' : 'rgba(170,160,150,0.09)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(X0, yAt(0, 7.1)); c.lineTo(X1, yAt(0, 7.1)); c.stroke();
      // cables snake from the amp to the speakers and the keyboard
      c.strokeStyle = lit ? '#120c10' : '#050407'; c.lineWidth = 4; c.lineCap = 'round';
      const ax = xAt(0.03, AMP_D), ay = yAt(0, AMP_D);
      c.beginPath(); c.moveTo(ax - 40, ay - 4); c.bezierCurveTo(ax - 260, ay - 30, xAt(-2.0, 7.4), yAt(0, 7.0), xAt(-2.6, 7.6), yAt(0, 7.6)); c.stroke();
      c.beginPath(); c.moveTo(ax + 40, ay - 4); c.bezierCurveTo(ax + 300, ay + 10, xAt(1.4, 6.0), yAt(0, 6.6), xAt(2.6, 7.6), yAt(0, 7.6)); c.stroke();
      // the low work lights at both sides (dark) / the colour washes and the follow-spot halos (lit)
      if (!lit) {
        for (const [x, y] of [[-80, yBase + 90], [W + 80, yBase + 90]]) { light(c, x, y, 820, '#ffad5e', 0.2); light(c, x, y, 280, '#ffcf96', 0.25); }
        for (const [x, y] of [[-40, yC - 90], [W + 40, yC - 90]]) light(c, x, y, 560, '#c86a3a', 0.13);
      } else {
        c.save(); c.beginPath(); c.rect(X0, -PADY, X1 - X0, yC); c.clip();
        c.globalCompositeOperation = 'screen';
        light(c, 960, -140, 950, AMB, 0.4);
        light(c, 250, 160, 680, CYA, 0.42); light(c, 1690, 150, 680, MAG, 0.46);
        // the follow-spots' spill behind each of them (a disc on the curtain behind the head and shoulders)
        for (const P of [BOY13, GIRL13]) { const hx = P.x + (P.x - 960) * 0.05, hy = yAt(1.62, CUR_D) - 30; light(c, hx, hy, 360, '#ffe2b8', 0.6); light(c, hx, hy, 160, '#fff2dc', 0.38); }
        c.restore();
        c.save(); c.globalCompositeOperation = 'screen';
        light(c, 960, yLip + 60, 760, '#ffb070', 0.2);
        // the varnish smears every lamp into long streaks toward us
        for (const L0 of LAMPS13) {
          c.save(); c.translate(L0.x + (L0.x - 960) * 0.22, yAt(0, TREE_D) + 40); c.scale(1, 4.2);
          const g2 = c.createRadialGradient(0, 0, 0, 0, 0, 62); g2.addColorStop(0, PV.rgba(L0.col, 0.3)); g2.addColorStop(0.5, PV.rgba(L0.col, 0.1)); g2.addColorStop(1, PV.rgba(L0.col, 0));
          c.fillStyle = g2; c.fillRect(-62, -12, 124, 74); c.restore();
        }
        c.restore();
      }
      // 5 the two light trees (tripod, pole, T-bar, four cans) — black against the curtain, the lamps lit or dark
      for (const Tr of TREES) {
        const x = xAt(Tr.X, TREE_D), yT = yAt(TREE_H, TREE_D), yF = yAt(0, TREE_D), u = FOC / TREE_D;
        c.strokeStyle = lit ? '#191317' : '#050407'; c.lineCap = 'round';
        c.lineWidth = 0.034 * u; c.beginPath(); c.moveTo(x, yT); c.lineTo(x, yF - 0.5 * u); c.stroke();
        c.lineWidth = 0.026 * u; c.beginPath(); c.moveTo(x, yF - 0.52 * u); c.lineTo(x - 0.42 * u, yF); c.moveTo(x, yF - 0.52 * u); c.lineTo(x + 0.42 * u, yF); c.moveTo(x, yF - 0.52 * u); c.lineTo(x + 0.06 * u, yF + 0.05 * u); c.stroke();
        c.lineWidth = 0.04 * u; c.beginPath(); c.moveTo(x - 0.58 * u, yT); c.lineTo(x + 0.58 * u, yT); c.stroke();
        if (lit) { c.strokeStyle = 'rgba(255,214,190,0.3)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 0.017 * u, yT + 4); c.lineTo(x + 0.017 * u, yF - 0.5 * u); c.stroke(); }
      }
      for (const L0 of LAMPS13) {
        const { x, y, r } = L0;
        c.fillStyle = lit ? '#1b1519' : '#070609'; c.beginPath(); c.roundRect(x - r * 1.08, y - r * 0.35, r * 2.16, r * 1.5, r * 0.3); c.fill();
        c.beginPath(); c.arc(x, y + r * 0.15, r * 1.02, 0, TAU); c.fill();
        if (!lit) { c.fillStyle = '#121016'; c.beginPath(); c.arc(x, y + r * 0.15, r * 0.82, 0, TAU); c.fill(); c.strokeStyle = 'rgba(160,150,170,0.16)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y + r * 0.15, r * 0.7, -2.6, -1.4); c.stroke(); }
        else {
          const g3 = c.createRadialGradient(x, y + r * 0.15, 0, x, y + r * 0.15, r * 0.86);
          g3.addColorStop(0, '#ffffff'); g3.addColorStop(0.45, hot ? '#ffffff' : PV.mix(L0.col, '#ffffff', 0.65)); g3.addColorStop(1, L0.col);
          c.fillStyle = g3; c.beginPath(); c.arc(x, y + r * 0.15, r * 0.84, 0, TAU); c.fill();
        }
      }
      // 6 lit: the beams baked in — the cans fan toward the players and us, the ceiling pars rake down from above the frame
      if (lit) {
        const list = [];
        for (const L0 of LAMPS13) { const tx = L0.side < 0 ? 700 + L0.i * 80 : 1220 - L0.i * 80; list.push({ x: L0.x, y: L0.y + L0.r * 0.15, ang: Math.atan2(700 - L0.y, tx - L0.x), ha: 0.21, len: 1000, col: L0.col, a: hot ? 0.5 : 0.22, w0: L0.r * 0.8 }); }
        for (const [x, ang, col, a] of [[330, 1.42, CYA, 0.28], [700, 1.62, AMB, 0.32], [1220, 1.52, AMB, 0.28], [1600, 1.74, MAG, 0.3]]) list.push({ x, y: -70, ang, ha: 0.12, len: 1150, col, a: hot ? 0.55 : a, w0: 40 });
        const beams = beamsLayer('c13bake' + mode, list, 6, { x0: -PADX, y0: -PADY, w: BGW13, h: BGH13 });
        c.save(); c.globalCompositeOperation = 'screen'; c.drawImage(beams, -PADX, -PADY, BGW13, BGH13);
        g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,190,200,0.0)'); g.addColorStop(0.3, 'rgba(255,190,200,0.08)'); g.addColorStop(0.6, 'rgba(255,200,180,0.12)'); g.addColorStop(1, 'rgba(255,190,200,0.03)');
        c.fillStyle = g; c.fillRect(X0, -PADY, X1 - X0, H + PADY * 2);
        for (const L0 of LAMPS13) { light(c, L0.x, L0.y, L0.r * 9, L0.col, hot ? 0.9 : 0.55); light(c, L0.x, L0.y, L0.r * 2.6, '#ffffff', hot ? 1 : 0.7); }
        c.restore();
      }
      // 7 the first instant: everything white-hot behind them
      if (hot) {
        c.save(); c.globalCompositeOperation = 'screen';
        g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,226,200,0.7)'); g.addColorStop(0.45, 'rgba(255,240,224,0.9)'); g.addColorStop(0.75, 'rgba(255,224,200,0.62)'); g.addColorStop(1, 'rgba(255,200,170,0.35)');
        c.fillStyle = g; c.fillRect(X0, -PADY, X1 - X0, H + PADY * 2);
        light(c, 960, 360, 1200, '#ffffff', 0.85);
        c.restore();
      }
    });
  }
  // PA speaker on a pole (seen from the front): a black box, horn on top, woofer below; the cone pumps with the music
  function c13Speaker(c, Sp, lit, kick, t) {
    const u = FOC / Sp.d, x = xAt(Sp.X, Sp.d), yT = yAt(2.16, Sp.d), yB = yAt(1.46, Sp.d), yF = yAt(0, Sp.d), w = 0.44 * u;
    const jx = kick * 2.4 * Math.sin(t * 97 + Sp.X), jy = kick * 1.6 * Math.cos(t * 83);
    c.save(); c.translate(jx, jy);
    c.strokeStyle = lit ? '#1c1519' : '#060508'; c.lineCap = 'round'; c.lineWidth = 0.035 * u;
    c.beginPath(); c.moveTo(x, yB); c.lineTo(x, yF - 0.6 * u); c.moveTo(x, yF - 0.6 * u); c.lineTo(x - 0.45 * u, yF); c.moveTo(x, yF - 0.6 * u); c.lineTo(x + 0.45 * u, yF); c.stroke();
    c.fillStyle = lit ? '#19141a' : '#08070a'; c.beginPath(); c.roundRect(x - w / 2, yT, w, yB - yT, 0.03 * u); c.fill();
    c.fillStyle = lit ? '#100c10' : '#040305'; c.fillRect(x - w * 0.42, yT + 0.05 * u, w * 0.84, 0.14 * u);   // horn
    const cy = yB - 0.2 * u, pump = 1 + 0.06 * kick * Math.sin(t * TAU * 11);
    c.fillStyle = lit ? '#2a2026' : '#0c0a0e'; c.beginPath(); c.arc(x, cy, 0.17 * u * pump, 0, TAU); c.fill();
    c.fillStyle = lit ? '#120d11' : '#050406'; c.beginPath(); c.arc(x, cy, 0.06 * u * pump, 0, TAU); c.fill();
    if (lit) { c.strokeStyle = `rgba(255,190,200,${0.25 + 0.35 * kick})`; c.lineWidth = 1.4; c.beginPath(); c.arc(x, cy, 0.17 * u * pump, -2.4, -0.7); c.stroke(); c.strokeStyle = 'rgba(255,214,190,0.4)'; c.beginPath(); c.moveTo(x - w / 2 + 2, yT + 2); c.lineTo(x + w / 2 - 2, yT + 2); c.stroke(); }
    c.fillStyle = '#4aa8ff'; c.beginPath(); c.arc(x - Math.sign(Sp.X) * w * 0.36, yB - 0.05 * u, 2.4, 0, TAU); c.fill();   // power LED (on the inner side)
    c.restore();
    lightS(c, x - Math.sign(Sp.X) * w * 0.36 + jx, yB - 0.05 * u + jy, 16, '#4aa8ff', 0.5);
  }

  // ---- the audience: we stand in the front row behind the rope; our neighbours' heads and shoulders frame the edges and
  //      a few phones are held up — all far out of focus (screen-space sprites, painted at 1/4 res and blurred)
  const CROWD13 = [
    { x: -40, y: 470, r: 190, k: 1, tilt: 0.1 }, { x: 150, y: 860, r: 150, k: 0, tilt: -0.08 }, { x: 1950, y: 500, r: 185, k: 3, tilt: -0.08 },
    { x: 1790, y: 900, r: 140, k: 2, tilt: 0.06, side: -1 }, { x: 420, y: 1130, r: 150, k: 4, tilt: 0.04, side: 1 }, { x: 1500, y: 1150, r: 150, k: 0, tilt: -0.05 },
  ];
  // phones held up (screen toward us): none in front of a face or an instrument
  const PHONES13 = [{ x: 262, y: 548, w: 66, h: 124, rot: -0.14, sd: 1, by: 0 }, { x: 1690, y: 610, w: 62, h: 116, rot: 0.12, sd: 2, by: 3 }, { x: 1830, y: 270, w: 40, h: 74, rot: -0.06, sd: 3, by: 2 }];
  function crowdShape(c, p) {
    const { x, y, r } = p, sw = r * 2.05, nk = y + r * 1.05;
    c.beginPath();
    c.moveTo(x - r * 0.42, nk); c.bezierCurveTo(x - r * 0.5, nk + r * 0.5, x - sw * 0.72, nk + r * 0.55, x - sw * 0.96, nk + r * 0.95);
    c.quadraticCurveTo(x - sw * 1.08, nk + r * 1.4, x - sw * 1.06, H + 400); c.lineTo(x + sw * 1.06, H + 400);
    c.quadraticCurveTo(x + sw * 1.08, nk + r * 1.4, x + sw * 0.96, nk + r * 0.95); c.bezierCurveTo(x + sw * 0.72, nk + r * 0.55, x + r * 0.5, nk + r * 0.5, x + r * 0.42, nk);
    c.closePath(); c.fill();
    c.beginPath(); c.ellipse(x, y, r * 0.86, r, p.tilt, 0, TAU); c.fill();
    if (p.k === 1) { c.beginPath(); c.moveTo(x - r * 0.9, y - r * 0.15); c.quadraticCurveTo(x - r * 1.12, y + r * 1.4, x - r * 0.86, y + r * 2.1); c.lineTo(x + r * 0.86, y + r * 2.1); c.quadraticCurveTo(x + r * 1.12, y + r * 1.4, x + r * 0.9, y - r * 0.15); c.closePath(); c.fill(); }
    else if (p.k === 2) { c.beginPath(); c.ellipse(x + (p.side || 1) * r * 0.2, y - r * 0.55, r * 0.36, r * 0.42, 0.3, 0, TAU); c.fill(); c.beginPath(); c.ellipse(x + (p.side || 1) * r * 0.25, y + r * 0.9, r * 0.22, r * 0.75, 0.1, 0, TAU); c.fill(); }
    else if (p.k === 3) { c.beginPath(); c.ellipse(x, y + r * 0.2, r * 1.06, r * 0.98, p.tilt, 0, TAU); c.fill(); }
    else if (p.k === 4) { c.beginPath(); c.ellipse(x + (p.side || 1) * r * 0.3, y - r * 0.62, r * 1.25, r * 0.28, 0, 0, TAU); c.fill(); }
  }
  function crowdArms(c) {
    c.lineCap = 'round';
    for (const P of PHONES13) {
      const base = CROWD13[P.by];
      const sx = base.x + Math.sign(P.x - base.x) * base.r * 1.1, sy = base.y + base.r * 1.6;
      c.lineWidth = P.w * 0.6; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(P.x + (P.x - base.x) * 0.1, P.y + P.h * 1.6, P.x, P.y + P.h * 0.45); c.stroke();
      c.lineWidth = P.w * 0.75; c.beginPath(); c.moveTo(P.x - P.w * 0.1, P.y + P.h * 0.62); c.lineTo(P.x, P.y + P.h * 0.25); c.stroke();   // the hand
    }
  }
  // the rope barrier between us and them: chrome posts, the red rope sagging, out of focus
  function ropeShape(c, lit) {
    const d = 3.3, top = yAt(0.95, d);
    const posts = [-1.9, 0.0, 1.9].map((X) => xAt(X, d));
    for (const x of posts) { c.fillStyle = lit ? '#6a5560' : '#17151c'; c.fillRect(x - 9, top, 18, H - top + 40); c.fillStyle = lit ? '#efe0da' : '#3a3846'; c.beginPath(); c.arc(x, top, 17, 0, TAU); c.fill(); }
    c.strokeStyle = lit ? '#c4283a' : '#3c1218'; c.lineWidth = 15; c.lineCap = 'round';
    for (let i = 0; i < posts.length - 1; i++) { const a = posts[i], b = posts[i + 1]; c.beginPath(); c.moveTo(a + 10, top + 8); c.quadraticCurveTo((a + b) / 2, top + 120, b - 10, top + 8); c.stroke(); }
    c.beginPath(); c.moveTo(-200, top + 50); c.quadraticCurveTo(posts[0] / 2 - 100, top + 110, posts[0] - 10, top + 8); c.stroke();
    c.beginPath(); c.moveTo(posts[2] + 10, top + 8); c.quadraticCurveTo((posts[2] + W) / 2 + 100, top + 110, W + 200, top + 50); c.stroke();
    if (lit) { c.strokeStyle = 'rgba(255,190,190,0.45)'; c.lineWidth = 4; for (let i = 0; i < posts.length - 1; i++) { const a = posts[i], b = posts[i + 1]; c.beginPath(); c.moveTo(a + 10, top + 3); c.quadraticCurveTo((a + b) / 2, top + 113, b - 10, top + 3); c.stroke(); } }
  }
  function c13Crowd(lit) {
    return PV.cached('g04:c13crowd2:' + (lit ? 'lit' : 'dark'), W, H, (c) => {
      const q = 0.25, sw = W * q, sh = H * q;
      // the rope (nearer the focus: a softer blur), then the neighbours (very near: a strong blur)
      const rp = PV.makeCanvas(sw, sh), rc = rp.ctx; rc.scale(q, q); ropeShape(rc, lit);
      c.filter = 'blur(4px)'; c.drawImage(rp.canvas, 0, 0, W, H); c.filter = 'none';
      const b = PV.makeCanvas(sw, sh), d = b.ctx; d.scale(q, q);
      const col = lit ? '#0b080c' : '#07060a';
      d.fillStyle = col; d.strokeStyle = col;
      for (const p of CROWD13) crowdShape(d, p); crowdArms(d);
      // the stage light ahead of them lays a rim along their heads and shoulders (lit: coloured; dark: a faint warm line)
      const rim = PV.makeCanvas(sw, sh), e = rim.ctx;
      e.drawImage(b.canvas, 0, 0); e.globalCompositeOperation = 'destination-out'; e.drawImage(b.canvas, 0, 2.6); e.drawImage(b.canvas, lit ? 1.4 : 0.7, 1.6); e.drawImage(b.canvas, lit ? -1.4 : -0.7, 1.6);
      e.globalCompositeOperation = 'source-in';
      const g = e.createLinearGradient(0, 0, sw, 0);
      if (lit) { g.addColorStop(0, '#9ce6ff'); g.addColorStop(0.3, '#ffd7a0'); g.addColorStop(0.5, '#fff0dc'); g.addColorStop(0.7, '#ffcf90'); g.addColorStop(1, '#ff8cc6'); }
      else { g.addColorStop(0, '#ffb070'); g.addColorStop(0.5, '#6a6278'); g.addColorStop(1, '#ffb070'); }
      e.fillStyle = g; e.fillRect(0, 0, sw, sh);
      c.filter = 'blur(12px)'; c.drawImage(b.canvas, 0, 0, W, H);
      c.filter = 'blur(6px)'; c.globalAlpha = lit ? 0.95 : 0.45; c.drawImage(rim.canvas, 0, 0, W, H); c.globalAlpha = 1; c.filter = 'none';
    });
  }
  // the phone screens: the stage on them, out of focus (a soft bright rectangle with a glow). Each phone is a cached blurred
  // sprite (a canvas filter on the full frame costs ~70 ms per draw); per frame only its brightness flickers
  function phoneSprite(P, lit) {
    const pad = 16, w = Math.ceil(P.w + pad * 2 + 8), h = Math.ceil(P.h + pad * 2 + 8);
    return PV.cached('g04:c13phone:' + P.sd + (lit ? 'L' : 'D'), w, h, (c) => {
      c.filter = 'blur(3px)'; c.translate(w / 2, h / 2);
      c.fillStyle = '#060508'; c.beginPath(); c.roundRect(-P.w / 2 - 4, -P.h / 2 - 4, P.w + 8, P.h + 8, 9); c.fill();
      const g = c.createLinearGradient(0, -P.h / 2, 0, P.h / 2);
      if (lit) { g.addColorStop(0, 'rgba(255,190,220,0.88)'); g.addColorStop(0.5, 'rgba(255,236,206,0.98)'); g.addColorStop(1, 'rgba(150,210,255,0.88)'); }
      else { g.addColorStop(0, 'rgba(170,190,230,0.75)'); g.addColorStop(0.6, 'rgba(214,228,255,0.86)'); g.addColorStop(1, 'rgba(120,140,190,0.75)'); }
      c.fillStyle = g; c.beginPath(); c.roundRect(-P.w / 2, -P.h / 2, P.w, P.h, 6); c.fill();
    });
  }
  function c13PhoneScreens(c, t, lit, burst) {
    for (const P of PHONES13) {
      const f = 0.82 + 0.18 * Math.sin(t * 2.4 + P.sd * 1.7), spr = phoneSprite(P, lit);
      c.save(); c.translate(P.x, P.y); c.rotate(P.rot); c.globalAlpha = 0.86 + 0.14 * f; c.drawImage(spr, -spr.width / 2, -spr.height / 2); c.restore();
      c.save(); c.globalCompositeOperation = 'screen'; lightS(c, P.x, P.y, P.w * 3.4, lit ? '#ffe6d0' : '#bcd6ff', (lit ? 0.3 : 0.24) * f + 0.4 * burst); c.restore();
    }
  }

  // ---- the two players (anime library). Local poses: the library's stand + Strat / keyboard with the acting this cut
  //      needs (the pick hand's wind-up and down-stroke; still hands before the blast, playing after it)
  function g04Poses() {
    const A = PV.anime, P = A && A.FIG_POSES;
    if (!P || P.g04_strat || !P.stand || !A.__body) return;
    const v3 = A.__body.v3;
    P.g04_strat = Object.assign({}, P.stand, {
      limbs(J, sp, prm, tq, o, OF) {
        const r = P.stand.limbs(J, sp, Object.assign({}, prm, { arms: 'strat' }), tq, o, OF);
        const k = prm.windup || 0, f = prm.follow || 0;
        if (k > 0.001 || f > 0.001) {
          // windmill: from the strings out to his right side and up beside his head (the elbow out, never a chicken wing)
          const W0 = r.arms.R.W, Wc = v3.add(J.SR, [-1.25, -0.5, 0.42]), W1 = v3.add(J.SR, [-0.62, -2.0, 0.28]);
          const a = (1 - k) * (1 - k), b = 2 * k * (1 - k), cc = k * k;
          let Wp = [a * W0[0] + b * Wc[0] + cc * W1[0], a * W0[1] + b * Wc[1] + cc * W1[1], a * W0[2] + b * Wc[2] + cc * W1[2]];
          if (f > 0) Wp = v3.add(Wp, [0.16 * f, 0.4 * f, 0.1 * f]);
          r.arms.R = { W: Wp, pole: [-1, 0.25 - 0.55 * k, -0.55], hand: k > 0.28 ? { kind: 'fist', f: [0, -1, 0.1], palm: [0.3, 0, -1], curl: 0.8 } : r.arms.R.hand };
        }
        return r;
      },
    });
    // C15: 先輩 leans back against the sea fence — the rail behind her waist, her left hand on it, the right hand holding the
    // brim of her hat in the wind (params.railH: the rail height in her head units; params.hatHand 0..1)
    P.g04_railback = Object.assign({}, P.stand, {
      body(sp, prm, tq, o, OF) {
        const b = P.stand.body(sp, prm, tq, o, OF);
        b.spine.bend -= 0.12; b.pelvis.pos = [b.pelvis.pos[0], b.pelvis.pos[1], b.pelvis.pos[2] + 0.06]; b.pelvis.pitch -= 0.05;
        return b;
      },
      limbs(J, sp, prm, tq, o, OF) {
        const r = P.stand.limbs(J, sp, Object.assign({}, prm, { arms: 'relax' }), tq, o, OF);
        const h = prm.railH ?? 4.8, hk = prm.hatHand ?? 1;
        r.arms.L = { W: [0.5, -h + 0.08, -0.34], pole: [1, 0.3, -0.5], hand: { f: [0.15, 0.25, -1], palm: [0, 1, 0.1], curl: 0.4 } };
        const top = v3.add(J.neckTop, [-0.44, -0.6, 0.28]);
        const rest = [-0.5, -h + 0.08, -0.34];
        r.arms.R = hk > 0.5 ? { W: top, pole: [-1, 0.3, -0.5], hand: { f: [0.3, -0.6, 0.5], palm: [0.3, 0.6, -0.7], curl: 0.4 } }
          : { W: rest, pole: [-1, 0.3, -0.5], hand: { f: [-0.15, 0.25, -1], palm: [0, 1, 0.1], curl: 0.4 } };
        return r;
      },
    });
    P.g04_keys = Object.assign({}, P.stand, {
      limbs(J, sp, prm, tq, o, OF) {
        const r = P.stand.limbs(J, sp, Object.assign({}, prm, { arms: 'keys' }), tq, o, OF);
        const pl = prm.play || 0;
        for (const s of ['L', 'R']) {
          const sg = s === 'L' ? 1 : -1, ph = tq * (7.3 + 1.9 * sg) + sg * 1.7;
          r.arms[s].W = [sg * (0.33 + pl * 0.15 * (0.5 + 0.5 * Math.sin(ph))), sp.hipY - 0.55 - pl * 0.09 * Math.max(0, Math.sin(ph * 1.7)), 0.95];
        }
        return r;
      },
    });
  }
  // the amp between them (c14Amp's combo, front 3/4), as a cached image: dark (work lights only) / lit
  function c13AmpImg(lit) {
    return PV.cached('g04:c13amp:' + (lit ? 'lit' : 'dark'), 260, 230, (c) => {
      c14Amp(c, 30, 52);
      if (!lit) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(6,5,9,0.62)'; c.fillRect(0, 0, 260, 230); }
    });
  }
  // acting, local seconds on twos: his look and nod, her answer, the wind-up, the down-stroke on the blast
  function c13Acting(tq) {
    const n = C13.nod, B = C13.blast;
    const hisTurn = sm(n - 0.06, n + 0.08, tq) * (1 - sm(B - 0.2, B - 0.06, tq));
    const hisNod = sm(n + 0.06, n + 0.16, tq) * (1 - sm(n + 0.18, n + 0.28, tq));
    const herTurn = sm(n - 0.02, n + 0.14, tq) * (1 - sm(B - 0.14, B, tq));
    const herNod = sm(n + 0.18, n + 0.26, tq) * (1 - sm(n + 0.28, n + 0.38, tq));
    let windup = E.inOutCubic(sm(n + 0.2, B - 0.05, tq)), follow = 0;
    const since = tq - B;
    if (since > -1e-6) { windup = since < 0.04 ? 0.32 : 0; follow = since < 0.04 ? 0.25 : 1 - sm(0.17, 0.45, since); }
    return { hisTurn, hisNod, herTurn, herNod, windup, follow };
  }
  function c13Players(ctx, t, T, tq, on, since, burst) {
    g04Poses();
    const A = PV.anime, act = c13Acting(tq), lightN = on ? 'golden' : 'lamp';   // the work lights → the follow-spots and the pars (warm, a strong warm rim)
    const buf = PV.buffer('g04:c13fig'), b = buf.ctx;
    b.clearRect(0, 0, W, H); b.setTransform(ctx.getTransform());
    const gust = on ? Math.exp(-since * 2.3) : 0;
    // 彼: cool and sharp at the booing hall; at 41.6 he looks at her (the whole iris, one clear light) and nods; the blast
    const hisLook = act.hisTurn > 0.5;
    const hisHead = on
      ? { expr: 'determined', eyes: { look: [0.05, 0.1] }, mouth: { open: 0.16, shape: 'e' }, brows: { furrow: 0.62 } }
      : hisLook ? { expr: 'determined', eyes: { look: [0.8, 0.05] } } : { expr: 'determined', eyes: { look: [0.12, 0.14], open: 1.0 }, brows: { furrow: 0.3 } };
    const him = A.figure(b, { who: 'boy', outfit: 'summer_uniform', pose: 'g04_strat', facing: 0.3, camPitch: 0.06, x: BOY13.x, y: BOY13.y, scale: BOY13.s, T,
      light: lightN, rimDir: on ? -1.62 : -2.85, wind: on ? 0.95 * gust + 0.18 : 0, windDir: -2.75,
      params: { arms: 'strat', weight: 0.35, windup: act.windup, follow: act.follow, neckYaw: 0.62 * act.hisTurn, nod: 0.26 * act.hisNod },
      head: Object.assign({ rim: 1 }, hisHead) });
    // 先輩: tense, eyes on her keys under the booing; she meets his eyes, the 力強い眼差し, and nods back; then she plays
    const herLook = act.herTurn > 0.5;
    const herHead = on
      ? { expr: 'focus', brows: { furrow: 0.42 }, eyes: { look: [-0.05, 0.25] } }
      : herLook ? { expr: 'determined', eyes: { look: [-0.8, -0.05] } } : { expr: 'neutral', brows: { furrow: 0.35, inner: 0.15 }, eyes: { look: [-0.1, 0.38], open: 0.9 } };
    A.figure(b, { who: 'senpai', outfit: 'summer_uniform', pose: 'g04_keys', facing: -0.42, camPitch: 0.06, x: GIRL13.x, y: GIRL13.y, scale: GIRL13.s, T,
      light: lightN, rimDir: on ? -1.62 : -0.3, wind: on ? 1.25 * gust + 0.32 : 0.05, windDir: -0.5,
      params: { arms: 'keys', weight: 0.2, play: on ? 1 : 0, neckYaw: -0.55 * act.herTurn, nod: 0.24 * act.herNod },
      head: Object.assign({ rim: 1 }, herHead) });
    // lights on: the side pars lay a coloured spill over them (cyan from his side, magenta from hers) — clipped to the figures
    // (painted over their box only: the screen-wide fill cost 7 ms)
    if (on) {
      const bx0 = 180, by0 = 60, bw = 1560, bh = H - 60;
      b.save(); b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-atop';
      const g = b.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, PV.rgba(CYA, 0.3)); g.addColorStop(0.36, PV.rgba(CYA, 0.0)); g.addColorStop(0.64, PV.rgba(MAG, 0.0)); g.addColorStop(1, PV.rgba(MAG, 0.32));
      b.fillStyle = g; b.fillRect(bx0, by0, bw, bh);
      // the first frames of the blast: the stage behind them goes white-hot before the follow-spots catch up — the two
      // stand dark against it (their rims burning), then their faces come up
      const dk = clamp((burst - 0.08) / 0.92);
      if (dk > 0.01) { b.fillStyle = `rgba(26,18,34,${0.82 * dk})`; b.fillRect(bx0, by0, bw, bh); }
      b.restore();
      if (dk > 0.01) { // the white-hot light behind them burns along their outlines (a band cut from the figures' own alpha, half res)
        const q = 0.5, rb = PV.buffer('g04:c13rimQ', W * q, H * q), rc = rb.ctx; rc.clearRect(0, 0, W * q, H * q);
        rc.drawImage(buf.canvas, 0, 0, W * q, H * q); rc.globalCompositeOperation = 'destination-out';
        rc.drawImage(buf.canvas, 0, 3.5, W * q, H * q); rc.drawImage(buf.canvas, 2.5, 2, W * q, H * q); rc.drawImage(buf.canvas, -2.5, 2, W * q, H * q);
        rc.globalCompositeOperation = 'source-in'; rc.fillStyle = '#fff3e4'; rc.fillRect(0, 0, W * q, H * q); rc.globalCompositeOperation = 'source-over';
        b.save(); b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = dk; b.drawImage(rb.canvas, 0, 0, W, H); b.restore();
      }
    }
    b.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(buf.canvas, 0, 0); ctx.restore();
    return { him, act };
  }

  PV.shot('C13', { draw(ctx, tIn, d, S) {
    const t = clamp(tIn, -0.2, d + 0.2), T = absT(S, 'C13', t), tq = PV.anime.onTwos(t);
    const B = C13.blast, on = t >= B, since = Math.max(0, t - B);
    const burst = on ? Math.exp(-since * 9) : 0, kick = on ? Math.exp(-since * 5) : 0;
    const PM = profiler(ctx);
    // ---------------- camera: locked off → the blast shakes it → a slow push in. Parallax: the stage moves less than the
    //                  two, the heads in front of us more
    const amp = on ? 17 * Math.exp(-since * 6) + 1.4 * Math.exp(-since * 1.4) : 0;
    const sh = on ? shake(t, amp, 16, 4) : { x: 0, y: 0, r: 0 };
    const pk = on ? E.outCubic(clamp(since / 1.5)) : 0;
    const camAt = (k, z) => ({ zoom: 1 + z, x: sh.x * k, y: sh.y * k, rot: sh.r * k, cx: CC13.cx, cy: CC13.cy });
    // ---------------- the stage: 9 m away a short dolly hardly magnifies it, so the plate only takes the shake (a plain blit
    //                  at an integer offset); the first instant of the blast is a white-hot overexposure painted over it
    const fx = Math.round(sh.x * 0.85), fy = Math.round(sh.y * 0.85);
    ctx.save(); ctx.translate(fx, fy);
    ctx.drawImage(c13Stage(on ? 'lit' : 'dark'), -PADX, -PADY);
    if (on) {
      if (burst > 0.02) {
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(255,226,200,${0.7 * burst})`); g.addColorStop(0.45, `rgba(255,240,224,${0.92 * burst})`); g.addColorStop(0.75, `rgba(255,224,200,${0.62 * burst})`); g.addColorStop(1, `rgba(255,200,170,${0.35 * burst})`);
        ctx.fillStyle = g; ctx.fillRect(-PADX, -PADY, BGW13, BGH13);
        lightS(ctx, 960, 360, 1200, '#ffffff', 0.85 * burst);
        for (const L0 of LAMPS13) lightS(ctx, L0.x, L0.y, L0.r * 7, '#ffffff', 0.8 * burst);
        ctx.restore();
      }
      // two ceiling pars sweep slowly over them; the cans breathe
      softBeams(ctx, [{ x: 600 + 130 * Math.sin(since * 0.9), y: -70, ang: 1.5 + 0.1 * Math.sin(since * 0.9 + 0.5), ha: 0.085, len: 1150, col: MAG, a: 0.2, w0: 30 },
        { x: 1330 - 130 * Math.sin(since * 0.8 + 1), y: -70, ang: 1.64 - 0.1 * Math.sin(since * 0.8 + 1.2), ha: 0.085, len: 1150, col: CYA, a: 0.18, w0: 30 }]);
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (const L0 of LAMPS13) lightS(ctx, L0.x, L0.y, L0.r * 5, L0.col, 0.22 + 0.1 * Math.sin(t * 7 + L0.i * 1.3 + L0.side));
      ctx.restore();
    } else { const wk = 0.05 * N2(t * 3, 9); ctx.save(); ctx.globalCompositeOperation = 'screen'; for (const x of [-40, W + 40]) lightS(ctx, x, yAt(0, LIP_D) + 20, 320, '#ffd59a', 0.16 + wk); ctx.restore(); }
    ctx.restore();
    PM('stage');
    // ---------------- the near layer: the PA speakers, the amp and its red pilot lamp, the two
    ctx.save(); PV.camera(ctx, camAt(1, 0.075 * pk + 0.02 * burst));
    for (const Sp of SPK13) c13Speaker(ctx, Sp, on, kick, t);
    const ax = on ? 3 * kick * Math.sin(since * 95) : 0, ay = on ? 2 * kick * Math.cos(since * 80) : 0;
    ctx.drawImage(c13AmpImg(on), AMP13.x - 30 * AMP_K + ax, AMP13.y - 52 * AMP_K + ay, 260 * AMP_K, 230 * AMP_K);
    const jx = JEWEL13[0] + ax, jy = JEWEL13[1] + ay;
    light(ctx, jx, jy, on ? 40 : 30, RED, 1.0); light(ctx, jx, jy, 120 + 110 * kick, RED, (on ? 0.4 : 0.3) + 0.3 * kick);
    ctx.fillStyle = '#ff2a20'; ctx.beginPath(); ctx.arc(jx, jy, 4.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd2c4'; ctx.beginPath(); ctx.arc(jx - 0.8, jy - 0.8, 1.8, 0, TAU); ctx.fill();
    PM('rig');
    const P = c13Players(ctx, t, T, tq, on, since, burst);
    PM('players');
    // the down-stroke smear (the twos frame of the blast): a warm crescent along the pick's arc
    if (on && tq - B < 0.04 && P.him) {
      const s0 = P.him.shoulders.R, hd = P.him.hands.R, rr = Math.hypot(hd[0] - s0[0], hd[1] - s0[1]) * 1.05, a1 = Math.atan2(hd[1] - s0[1], hd[0] - s0[0]);
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(s0[0], s0[1], rr * 0.55, s0[0], s0[1], rr * 1.12); g.addColorStop(0, 'rgba(255,225,190,0)'); g.addColorStop(0.72, 'rgba(255,232,200,0.6)'); g.addColorStop(1, 'rgba(255,225,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.arc(s0[0], s0[1], rr * 1.12, -1.9, a1); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // dust: drifting slowly in the work lights; it jumps off the amp and the floor at the blast
    L.dust(ctx, t, { seed: 13, count: on ? 80 : 30, x0: 0, x1: W, y0: 60, y1: 900, size: 2.4, alpha: on ? 0.55 : 0.22, drift: 40, vy: on ? -12 : -3, color: on ? '#ffe2c4' : '#d8c8b0' });
    if (on && since < 1.4) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 26; i++) {
        const a = -Math.PI / 2 + (R1(i, 5) - 0.5) * 2.2, v = 180 + 260 * R1(i, 6), tt = since;
        const px = jx - 60 + 240 * R1(i, 7) + Math.cos(a) * v * tt, py = jy + 20 + Math.sin(a) * v * tt + 300 * tt * tt;
        ctx.fillStyle = `rgba(255,220,190,${0.7 * (1 - tt / 1.4)})`; ctx.beginPath(); ctx.arc(px, py, 1.6 + 1.6 * R1(i, 8), 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    PM('near');
    // ---------------- the audience in front of us (the blast throws them back a little), their phones
    ctx.save(); PV.camera(ctx, camAt(1.25, 0.13 * pk + 0.035 * burst));
    const recoil = on ? 16 * Math.exp(-since * 3) : 0;
    ctx.translate(0, recoil);
    ctx.drawImage(c13Crowd(on), 0, 0);
    c13PhoneScreens(ctx, t, on, burst);
    ctx.restore();
    PM('crowd');
    // ---------------- lens: star streaks on the hottest cans, the blast's overexposure, bloom at its maximum
    if (on) {
      for (const L0 of LAMPS13) if (L0.i === 1 || L0.i === 2) starFlare(ctx, L0.x + sh.x * 0.85, L0.y + sh.y * 0.85, (L0.i === 1 ? 150 : 95) + 120 * burst, '#fff1d8', 0.5, since + L0.side);
    }
    if (burst > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(255,232,208,${0.12 * burst})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    setBloom(S, on ? 0.34 + 0.3 * Math.exp(-since * 3) : 0.26, on ? 0.42 : 0.3);
    PM('lens');
  } });
  // thin star streaks around a hot light
  function starFlare(ctx, x, y, len, col, a, t) {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(x, y); ctx.rotate(0.12 + 0.02 * Math.sin(t * 2));
    for (let k = 0; k < 6; k++) {
      ctx.rotate(Math.PI / 3); const l = len * (k % 2 ? 0.62 : 1);
      const g = ctx.createLinearGradient(0, 0, l, 0); g.addColorStop(0, PV.rgba(col, a)); g.addColorStop(1, PV.rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -1.6); ctx.lineTo(l, 0); ctx.lineTo(0, 1.6); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* ======================================================================= C14 — the string snaps */
  // 43.5–46.5. His left hand bends the 1st string at the 14th fret (ring finger, the middle finger pushing behind it),
  // t=0.25 (43.75) it snaps (slow motion; the released fingers slip toward the bass side) → 0.86–1.36 a whip pull-back
  // (the close-up rushes away under a zoom blur and the wide lands decelerating) → kneeling in the spotlight facing his
  // amp, face to the sky (原作「アンプに向かい合っている。両膝をついて、天を仰ぎながら」). 44.9 (t=1.4) a phone rises
  // in the foreground: ● REC, the focus pulls onto it (1.66–1.98) and holds there to the end.
  const C14 = { snap: 0.25, out0: 0.86, out1: 1.36, phone: 1.4, rack0: 1.66, rack1: 1.98 };
  const KNEEL = { x: 830, y: 876, s: 1.14 };
  // where the whip pull-back lands: the 14th fret of the kneeling figure's Strat, and its neck angle on screen
  const NECK_W = { x: 850, y: 290, ang: 0.08 };   // anime rework: the raised Strat's neck (14th fret), measured from the kneel_guitar pose
  const FB = { view: 'snap', focus: 14, wood: 'maple', wear: 1.0, light: { az: 2.25, el: 0.62, color: '#ffd9b4', k: 1.15 }, ambient: '#3a2a46' };
  const SPAN = (x) => 35 + 17.5 * clamp(x / 648);                 // string span (mm) at x, as the instruments library
  const XF = (f) => lerp(L.fretX(f - 1), L.fretX(f), 0.72);       // where a fingertip stops a string behind fret f

  function c14CloseBg() {
    return PV.cached('g04:c14closeBg', W, H, (c) => {
      const g = c.createRadialGradient(W * 0.64, H * 0.32, 40, W * 0.5, H * 0.5, W * 0.85);
      g.addColorStop(0, '#3c2440'); g.addColorStop(0.55, '#1c1424'); g.addColorStop(1, '#0b0910'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      // stage lights far behind, way out of focus
      c.globalCompositeOperation = 'screen';
      for (const [x, y, r, col] of [[1500, 170, 150, AMB], [1180, 90, 110, MAG], [1760, 420, 130, CYA], [300, 120, 120, MAG], [80, 380, 160, AMB], [1600, 760, 120, MAG], [640, 70, 90, CYA]]) { lightS(c, x, y, r, col, 0.32); lightS(c, x, y, r * 0.55, col, 0.22); }
    });
  }
  // ---- his fingertips (macro: only the tips lie on the focal plane, the fingers rise toward the lens out of focus).
  // A finger is a tapered tube on a quadratic spine from off-frame (wide, near the lens) to its tip on the string.
  function fingerTube(tip, ctrl, base, w0, w1) {
    const P = (u) => { const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u; return [a * base[0] + b * ctrl[0] + c * tip[0], a * base[1] + b * ctrl[1] + c * tip[1]]; };
    const D = (u) => { const dx = 2 * (1 - u) * (ctrl[0] - base[0]) + 2 * u * (tip[0] - ctrl[0]), dy = 2 * (1 - u) * (ctrl[1] - base[1]) + 2 * u * (tip[1] - ctrl[1]); const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    const Wd = (u) => (w0 + (w1 - w0) * Math.pow(u, 0.8)) * (1 + 0.045 * Math.sin(u * 7.5));
    const A = [], Bn = [], N = 18;
    for (let i = 0; i <= N; i++) { const u = i / N, p = P(u), d = D(u), w = Wd(u) / 2; A.push([p[0] - d[1] * w, p[1] + d[0] * w]); Bn.push([p[0] + d[1] * w, p[1] - d[0] * w]); }
    const path = new Path2D(); path.moveTo(A[0][0], A[0][1]); for (const p of A) path.lineTo(p[0], p[1]);
    const d1 = D(1), a1 = Math.atan2(d1[1], d1[0]); path.arc(tip[0], tip[1], w1 / 2, a1 + Math.PI / 2, a1 - Math.PI / 2, true);
    for (let i = Bn.length - 1; i >= 0; i--) path.lineTo(Bn[i][0], Bn[i][1]); path.closePath();
    return { path, P, D, Wd, A, Bn, tip, w1 };
  }
  const SKIN14 = { base: '#b57658', shade: '#5a2d42', rim: '#ffcd9c', line: '#2a1018', nail: '#cf9c86', nailHi: 'rgba(255,236,214,0.32)' };
  function paintFinger(c, F, Lv, skin) {
    const S = skin || SKIN14, a0 = c.globalAlpha;
    c.save(); c.clip(F.path);
    // 1 shadow (cel): the side away from the stage key light, then the lit body shifted toward the light
    c.fillStyle = S.shade; c.fill(F.path);
    c.save(); c.translate(Lv[0] * F.w1 * 0.36, Lv[1] * F.w1 * 0.36); c.fillStyle = S.base; c.fill(F.path); c.restore();
    // rim of the key light along the lit edge
    const lit = (F.Bn[8][0] - F.A[8][0]) * Lv[0] + (F.Bn[8][1] - F.A[8][1]) * Lv[1] > 0 ? F.Bn : F.A;
    c.strokeStyle = S.rim; c.lineWidth = 9; c.lineJoin = 'round'; c.beginPath(); c.moveTo(lit[0][0], lit[0][1]); for (const p of lit) c.lineTo(p[0], p[1]); c.stroke();
    // the joints: DIP and PIP creases across the back of the finger
    c.strokeStyle = S.line; c.lineCap = 'round'; c.lineWidth = 3; c.globalAlpha = a0 * 0.5;
    for (const u of [0.6, 0.645, 0.29, 0.33]) { const p = F.P(u), d = F.D(u), w = F.Wd(u) * 0.2; c.beginPath(); c.moveTo(p[0] - d[1] * w, p[1] + d[0] * w); c.quadraticCurveTo(p[0] + d[0] * 16, p[1] + d[1] * 16, p[0] + d[1] * w, p[1] - d[0] * w); c.stroke(); }
    c.globalAlpha = a0;
    // the nail: a short, flat plate along the end of the fingertip (his nails are kept short), lit on the key side
    const d = F.D(1), a = Math.atan2(d[1], d[0]), nl = F.w1 * 0.46, nw = F.w1 * 0.5, nc = [F.tip[0] - d[0] * F.w1 * 0.26, F.tip[1] - d[1] * F.w1 * 0.26];
    c.save(); c.translate(nc[0], nc[1]); c.rotate(a);
    const ng = c.createLinearGradient(0, -nw / 2, 0, nw / 2); ng.addColorStop(0, S.nail); ng.addColorStop(1, S.base); c.fillStyle = ng;
    c.beginPath(); c.roundRect(-nl / 2, -nw / 2, nl, nw, [nw * 0.16, nw * 0.42, nw * 0.42, nw * 0.16]); c.fill();
    c.strokeStyle = S.line; c.lineWidth = 1.8; c.globalAlpha = a0 * 0.5; c.stroke(); c.globalAlpha = a0;
    c.strokeStyle = S.nailHi; c.lineWidth = nw * 0.09; c.lineCap = 'round'; c.beginPath(); c.moveTo(-nl * 0.3, -nw * 0.26); c.lineTo(nl * 0.28, -nw * 0.3); c.stroke();
    c.restore();
    c.restore();
    c.strokeStyle = S.line; c.lineWidth = 2.6; c.stroke(F.path);
  }
  // the two fingers on the (bent) 1st string: ring at fret 14, middle behind it at fret 13. dmm = the bend (mm)
  function c14Fingers(c, o, dmm, slip, t, fs) {
    const fpk = L.fretPos(o, 0, 14), bx = L.fretX(14) - 4;
    const tipAt = (f) => { const x = XF(f), dm = dmm * Math.pow(clamp(x / bx), 5) + slip; return L.fretPos(o, dm / (SPAN(x) / 5), f); };
    const r = tipAt(14), m = tipAt(13);
    const b = [fpk.bx, fpk.by], a = [fpk.ax, fpk.ay];               // toward the bass strings / toward the body
    const tr = (n) => 1.2 * N2(t * 9 + n, 4.4);                      // a tiny tremble of effort
    const k = fs;
    const ring = fingerTube([r.x - b[0] * 22 * k + tr(1), r.y - b[1] * 22 * k + tr(2)], [r.x + (b[0] * 452 + a[0] * 10) * k, r.y + (b[1] * 452 + a[1] * 10) * k], [r.x + (b[0] * 914 + a[0] * 184) * k, r.y + (b[1] * 914 + a[1] * 184) * k], 450 * k, 238 * k);
    const mid = fingerTube([m.x - b[0] * 22 * k + tr(3), m.y - b[1] * 22 * k + tr(4)], [m.x + b[0] * 455 * k, m.y + b[1] * 455 * k], [m.x + (b[0] * 874 + a[0] * 45) * k, m.y + (b[1] * 874 + a[1] * 45) * k], 430 * k, 228 * k);
    const Lv = [0.68, -0.73];                                       // the stage key light, across the fingers
    // render the fingers flat into a buffer, then a macro depth of field: sharp only around the tips
    const x1 = Math.min(W, Math.max(r.x, m.x) + 220), y1 = Math.min(H, Math.max(r.y, m.y) + 220);
    const F = PV.buffer('g04:c14fing'), f = F.ctx; f.clearRect(0, 0, x1, y1);
    paintFinger(f, mid, Lv); paintFinger(f, ring, Lv);
    // quarter res: the soft contact shadow on the board, then the fingers out of focus over it — one up-scale for both
    const q = 0.25, qb = PV.buffer('g04:c14fingQ', Math.ceil(W * q), Math.ceil(H * q)), qc = qb.ctx; qc.clearRect(0, 0, Math.ceil(x1 * q) + 2, Math.ceil(y1 * q) + 2);
    qc.save(); qc.filter = 'blur(5px)'; qc.fillStyle = 'rgba(30,10,6,0.55)'; qc.scale(q, q); qc.translate(Lv[0] * 40, Lv[1] * 40 + 18); qc.fill(mid.path); qc.fill(ring.path); qc.restore();
    qc.filter = 'blur(6px)'; qc.drawImage(F.canvas, 0, 0, x1, y1, 0, 0, x1 * q, y1 * q); qc.filter = 'none';
    c.drawImage(qb.canvas, 0, 0, x1 * q, y1 * q, 0, 0, x1, y1);
    // the sharp fingers, only around the tips (the focal plane)
    f.globalCompositeOperation = 'destination-in';
    const cx = (r.x + m.x) / 2, cy = (r.y + m.y) / 2, g = f.createRadialGradient(cx, cy, 150 * k, cx, cy, 470 * k);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = g; f.fillRect(0, 0, x1, y1); f.globalCompositeOperation = 'source-over';
    c.drawImage(F.canvas, 0, 0, x1, y1, 0, 0, x1, y1);
    return { r, m };
  }
  function c14Close(t, zm, rollX) {
    zm = zm || 1; rollX = rollX || 0;
    const b = PV.buffer('g04:c14close'); const c = b.ctx;
    c.drawImage(c14CloseBg(), 0, 0);
    const S0 = C14.snap;
    // the bend tightens toward the snap; then slow motion: the ends whip, curl and glint
    const p = t < S0 ? -0.62 + 0.62 * E.inQuad(clamp(t / S0)) : t < C14.out0 ? 0.3 * E.outQuad(clamp((t - S0) / (C14.out0 - S0))) : 0.3 + 0.3 * (t - C14.out0);
    const v = t < S0 ? 0.3 : 0.55 * Math.exp(-(t - S0) * 0.8);
    const zoom = (1.18 + 0.08 * E.inQuad(clamp(t / S0)) + (t >= S0 ? 0.03 * Math.exp(-(t - S0) * 3) - 0.08 * E.outCubic(clamp((t - S0) / 0.9)) : 0)) * zm;
    const jolt = t >= S0 ? shake(t, 10 * Math.exp(-(t - S0) * 9), 22, 7) : shake(t, 1.8 * clamp(t / S0), 30, 3);
    // principal point chosen so the bend sits a little left of and below centre
    const o0 = Object.assign({}, FB, { zoom }); const f0 = L.fretPos(o0, 0, 14);
    const BEND = 10;
    const o = Object.assign({}, FB, { zoom, cx: W / 2 + (W * 0.46 - f0.x) + jolt.x, cy: H / 2 + (H * 0.56 - f0.y) + jolt.y, roll: jolt.r * 4 + rollX,
      vibrate: [0, 0.55 * v, 0.5 * v, 0.45 * v, 0.42 * v, 0.38 * v], snap: { string: 0, p, at: 14, bend: BEND, width: 3.4 } });
    L.fretboard(c, t, o);
    const fp = L.fretPos(o, 0, 14);
    const p10 = L.fretPos(o, 0, 10), p17 = L.fretPos(o, 0, 17);
    // the bend under his fingers (the library's own bend curve), and after the snap the released fingers slip on
    const bq = clamp((Math.min(p, 0) + 1) / 0.92), dmm = t < S0 ? BEND * bq * bq * (3 - 2 * bq) * (1 + 0.04 * Math.sin(t * 71) * bq * bq) : BEND;
    const slip = t < S0 ? 0 : 5.5 * E.outBack(clamp((t - S0) / 0.14));
    const FG = c14Fingers(c, o, dmm, slip, t, zoom / 1.18);
    // tension: a hot glint runs up the stretched 1st string toward the fingers, twice
    if (t < S0) {
      c.save(); c.globalCompositeOperation = 'screen';
      for (const ph of [0, 0.5]) { const u = ((t / S0) * 1.6 + ph) % 1; const gx = lerp(p17.x, FG.r.x, u), gy = lerp(p17.y, FG.r.y, u); lightS(c, gx, gy, 46, '#fff4e0', 0.55 * Math.sin(u * Math.PI)); }
      lightS(c, FG.r.x, FG.r.y, 90, '#ffd9b0', 0.2 + 0.3 * E.inQuad(clamp(t / S0)));
      c.restore();
    }
    // the instant of the snap: a hot flash at the break point (it lights the fingertips too)
    if (t >= S0 - 0.001) {
      const k = Math.exp(-(t - S0) * 7);
      c.save(); c.globalCompositeOperation = 'screen';
      lightS(c, fp.x, fp.y, 380 * (0.6 + 0.4 * k), '#fff1d6', 0.5 * k); lightS(c, fp.x, fp.y, 110, '#ffffff', 0.7 * k);
      c.restore();
    }
    return { canvas: b.canvas, fp, ang: Math.atan2(p10.y - p17.y, p10.x - p17.x) };
  }

  // ---- the wide shot from the audience: the closed stage curtain, one spotlight (baked: cone + pool), the amp he
  //      kneels to, and the front row out of focus along the bottom
  function c14Back() {
    return PV.cached('g04:c14back2', W, H, (c) => {
      let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a0810'); g.addColorStop(0.62, '#140f1a'); g.addColorStop(1, '#0b0a10'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      // closed stage curtain (緞帳) across the back, deep red-black folds
      const y0 = 70, y1 = 690;
      for (let x = 0; x < W; x += 3) {
        const f = 0.5 + 0.5 * Math.sin(x * 0.045 + Math.sin(x * 0.011) * 2.5), v = 16 + 18 * f;
        c.fillStyle = `rgb(${Math.round(v * 1.45)},${Math.round(v * 0.42)},${Math.round(v * 0.55)})`; c.fillRect(x, y0, 3, y1 - y0);
      }
      g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(8,6,10,0.8)'); g.addColorStop(0.5, 'rgba(8,6,10,0.2)'); g.addColorStop(1, 'rgba(8,6,10,0.65)'); c.fillStyle = g; c.fillRect(0, y0, W, y1 - y0);
      c.fillStyle = '#120c12'; c.fillRect(0, 0, W, y0); // proscenium
      // the stage front + the gym floor (court line), the performers' space
      c.fillStyle = '#0d0a10'; c.fillRect(0, y1, W, 34);
      g = c.createLinearGradient(0, y1 + 34, 0, H); g.addColorStop(0, '#1a1418'); g.addColorStop(1, '#0c0a0e'); c.fillStyle = g; c.fillRect(0, y1 + 34, W, H - y1 - 34);
      c.strokeStyle = 'rgba(160,130,120,0.12)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 812); c.lineTo(W, 796); c.stroke();
      // partitions (backstage) at the left, dim
      c.fillStyle = 'rgba(20,16,22,0.55)'; for (let k = 0; k < 3; k++) c.fillRect(20 + k * 150, 470, 140, 260);
      // the spotlight: one cone from above (amber white) and its pool on the floor
      const sx = KNEEL.x + 10, poolY = KNEEL.y + 6;
      const cone = beamsLayer('c14bake', [{ x: sx - 30, y: -60, ang: Math.PI / 2 + 0.02, ha: 0.24, len: 1050, col: '#ffe0b0', a: 0.4, w0: 40 }, { x: sx + 40, y: -60, ang: Math.PI / 2 - 0.05, ha: 0.12, len: 1000, col: AMB, a: 0.22, w0: 20 }], 5);
      c.save(); c.globalCompositeOperation = 'screen'; c.drawImage(cone, 0, 0, W, H);
      c.translate(sx, poolY); c.scale(1, 0.2); const pg = c.createRadialGradient(0, 0, 0, 0, 0, 380); pg.addColorStop(0, 'rgba(255,214,160,0.6)'); pg.addColorStop(0.5, 'rgba(255,190,120,0.22)'); pg.addColorStop(1, 'rgba(255,190,120,0)'); c.fillStyle = pg; c.fillRect(-380, -380, 760, 760);
      c.restore();
      // the amp he kneels to: a small combo seen three-quarter from its front (grille cloth, logo plate, chrome panel)
      c14Amp(c, 1118, 664);
    });
  }
  function c14Amp(c, x, y) {
    const w = 176, h = 168, sd = 30, sk = 16;     // front face w×h, the right side face (depth sd), top skew
    c.save(); c.translate(x, y);
    // side face (in shadow) and top (catches the spill)
    c.fillStyle = '#0a080c'; c.beginPath(); c.moveTo(w, 0); c.lineTo(w + sd, -sk); c.lineTo(w + sd, h - sk); c.lineTo(w, h); c.closePath(); c.fill();
    c.fillStyle = '#2a2026'; c.beginPath(); c.moveTo(0, 0); c.lineTo(sd, -sk); c.lineTo(w + sd, -sk); c.lineTo(w, 0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,214,170,0.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(1, 0); c.lineTo(sd, -sk + 1); c.lineTo(w + sd - 1, -sk + 1); c.stroke();
    c.strokeStyle = '#0a080c'; c.lineWidth = 5; c.beginPath(); c.moveTo(w * 0.32, -sk * 0.5); c.quadraticCurveTo(w * 0.55 + sd * 0.5, -sk - 18, w * 0.78 + sd * 0.5, -sk * 0.5); c.stroke(); // handle
    // the front: tolex frame, chrome control strip, grille cloth, logo plate
    c.fillStyle = '#141016'; c.fillRect(0, 0, w, h);
    const gg = c.createLinearGradient(0, 0, 0, 22); gg.addColorStop(0, '#d9ccc4'); gg.addColorStop(0.5, '#8d8288'); gg.addColorStop(1, '#4a4248'); c.fillStyle = gg; c.fillRect(8, 6, w - 16, 20);
    c.fillStyle = '#16121a'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(46 + k * 24, 16, 6.5, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(255,240,230,0.5)'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(44.5 + k * 24, 14, 1.8, 0, TAU); c.fill(); }
    const gr = c.createLinearGradient(0, 32, 0, h - 8); gr.addColorStop(0, '#3a2c2a'); gr.addColorStop(1, '#1c1517'); c.fillStyle = gr; c.fillRect(10, 32, w - 20, h - 42);
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
    for (let k = -h; k < w; k += 6) { c.beginPath(); c.moveTo(10 + Math.max(0, k), 32 + Math.max(0, -k)); c.lineTo(10 + Math.min(w - 20, k + h - 42), 32 + Math.min(h - 42, h - 42 - Math.max(0, k + h - 42 - (w - 20)))); c.stroke(); }
    c.fillStyle = 'rgba(220,206,196,0.85)'; c.beginPath(); c.roundRect(w * 0.36, h - 36, w * 0.28, 10, 2); c.fill();
    c.strokeStyle = 'rgba(255,214,170,0.5)'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
    c.restore();
  }
  // 彼 kneeling in the spotlight, the white Strat held up over his head, face to the light (eyes closed, mouth open: 恍惚)
  const KNEEL_S = 106;   // head px (anime library); the anchor is the floor under his knees
  function c14Kneel(c, t) {
    const T = START.C14 + t, tq = PV.anime.onTwos(t), o = PV._g04kneel || {};   // acting on twos: the cry at the landing relaxes into an open-mouthed breath
    return PV.anime.figure(c, { who: 'boy', outfit: 'summer_uniform', pose: 'kneel_guitar', facing: o.facing ?? 0.42, camPitch: o.pitch ?? -0.04, x: KNEEL.x, y: KNEEL.y, scale: KNEEL_S, T,
      light: 'spot', rimDir: -1.62, wind: 0.3, windDir: -2.2, params: { variant: 'raise' },
      head: { expr: 'closed', mouth: { open: lerp(0.66, 0.4, sm(1.2, 1.9, tq)), shape: 'a' }, brows: { inner: 0.32, furrow: 0.2 }, rim: 1 } });
  }
  const JEWEL14 = [1118 + 18, 664 + 16];   // the red pilot lamp on the amp's front panel (left end of the chrome strip)
  function c14Wide(t) {
    const b = PV.buffer('g04:c14wide'); const c = b.ctx;
    c.drawImage(c14Back(), 0, 0);
    // the red pilot lamp: a hard jewel and its glow (it is the one colour in the dark besides the spot)
    const pulse = 0.94 + 0.06 * Math.sin(t * 5.3);
    lightS(c, JEWEL14[0], JEWEL14[1], 34, RED, 0.95 * pulse); lightS(c, JEWEL14[0], JEWEL14[1], 120, RED, 0.24 * pulse);
    c.fillStyle = '#ff2a20'; c.beginPath(); c.arc(JEWEL14[0], JEWEL14[1], 5, 0, TAU); c.fill(); c.fillStyle = '#ffd6c8'; c.beginPath(); c.arc(JEWEL14[0] - 1, JEWEL14[1] - 1, 2, 0, TAU); c.fill();
    // dust in the beam
    const sx = KNEEL.x + 10, poolY = KNEEL.y + 6;
    L.dust(c, t, { seed: 21, count: 60, x0: sx - 260, x1: sx + 260, y0: 0, y1: poolY, size: 2.6, alpha: 0.6, drift: 30, vy: -8, color: '#ffe6c8', mask: (x, y) => clamp(1 - Math.abs(x - sx) / (90 + y * 0.28)) });
    // kneeling, face to the sky, the right hand raised
    c14Kneel(c, t);
    // the audience in front (heads and shoulders along the bottom, out of focus), rimmed by the spill
    c.drawImage(c14Crowd(), 0, 0);
    return b.canvas;
  }
  // after the focus has gone to the phone the stage is a soft blur: one still of it (t=2.0) serves the rest of the cut
  function c14WideStill() { return PV.cached('g04:c14wideStill', W, H, (c) => c.drawImage(c14Wide(2.0), 0, 0)); }
  function c14WideSoft() {
    return PV.cached('g04:c14wideSoft', W, H, (c) => {
      const q = PV.makeCanvas(W / 4, H / 4); q.ctx.filter = 'blur(2.6px)'; q.ctx.drawImage(c14WideStill(), 0, 0, W / 4, H / 4);
      c.imageSmoothingQuality = 'high'; c.drawImage(q.canvas, 0, 0, W, H);
    });
  }
  function c14Crowd() {
    return PV.cached('g04:c14crowd', W, H, (c) => {
      const r = PV.rng(77); const tmp = PV.makeCanvas(W, H), d = tmp.ctx;
      d.fillStyle = '#060508';
      for (let x = -60; x < W + 80; x += 120 + r() * 70) {
        const hr = 62 + r() * 24, hy = 1000 + r() * 60, sw = hr * 2.1;
        if (x > 1250 && x < 1700) continue; // leave room for the phone's arm
        d.beginPath(); d.ellipse(x, hy, hr * 0.85, hr, 0, 0, TAU); d.fill();
        d.beginPath(); d.moveTo(x - sw, H + 10); d.quadraticCurveTo(x - sw, hy + hr * 1.3, x - hr * 0.4, hy + hr * 0.9); d.lineTo(x + hr * 0.4, hy + hr * 0.9); d.quadraticCurveTo(x + sw, hy + hr * 1.3, x + sw, H + 10); d.closePath(); d.fill();
      }
      // a top rim from the spotlight spill, then blur the whole row (it is far out of focus)
      const rim = PV.makeCanvas(W, H), e = rim.ctx; e.drawImage(tmp.canvas, 0, 0); e.globalCompositeOperation = 'destination-out'; e.drawImage(tmp.canvas, 0, 6); e.globalCompositeOperation = 'source-in'; e.fillStyle = 'rgba(255,190,130,0.55)'; e.fillRect(0, 0, W, H);
      c.filter = 'blur(9px)'; c.drawImage(tmp.canvas, 0, 0); c.drawImage(rim.canvas, 0, 0); c.filter = 'none';
    });
  }
  // a zoom (radial) blur of a full-frame layer as it appears through a camera that scales by `zoom` and turns by `rot`
  // about the fixed screen point (cx,cy), built at quarter res in SCREEN space (so a 3.4x push is not up-scaled 14x):
  // k = streak length (0..~0.3). Returns a W/4 x H/4 canvas to draw at (0,0,W,H).
  function zoomBlur(src, key, cx, cy, zoom, rot, k) {
    const q = 0.25, w = W * q, h = H * q, b = PV.buffer('g04:zb:' + key, w, h), c = b.ctx; c.clearRect(0, 0, w, h);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const s = zoom * (1 + k * i / (n - 1)); c.globalAlpha = i ? 0.42 : 1;
      c.setTransform(q, 0, 0, q, 0, 0); c.translate(cx, cy); c.rotate(rot); c.scale(s, s); c.translate(-cx, -cy); c.drawImage(src, 0, 0);
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    return b.canvas;
  }

  // ---- the phone held up from the crowd (portrait, screen toward us): the body is painted once by the props library
  //      (empty screen) and re-used; only the screen (live view of the stage, ● REC, the timer) is painted per frame
  const PH14 = { s: 1.18 };
  function c14PhoneBody() {
    return PV.cached('g04:c14phoneBody', 520, 900, (c) => L.phone(c, 0, { x: 260, y: 450, s: PH14.s, rot: 0, screen: 'photo', ui: false, glow: 0, bright: 1, tone: 'night', light: -1.9, rimA: 0.6, shadow: false, held: true, drawPhoto: () => {} }));
  }
  function recScreen(c, w, h, t, wide) {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    // the live image: the spotlight scene, cropped around him (landscape sensor shown in a portrait screen), a hand-held drift
    const cw = 760, ch = cw * h / w, cx = KNEEL.x + 40 + 6 * Math.sin(t * 1.9), cy = KNEEL.y - 330 + 5 * Math.sin(t * 2.3 + 1);
    c.drawImage(wide, cx - cw / 2, cy - ch / 2, cw, ch, 0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, w, 56); c.fillRect(0, h - 92, w, 92);
    // ● REC + timer
    const blink = 0.8 + 0.2 * Math.cos(t * 6.3);
    c.fillStyle = `rgba(255,59,48,${blink})`; c.beginPath(); c.arc(30, 30, 11, 0, TAU); c.fill();
    c.fillStyle = '#ffffff'; c.font = '700 25px "DejaVu Sans", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('REC', 50, 31);
    const secs = 612 + Math.floor(t); c.font = '500 22px "DejaVu Sans", sans-serif'; c.textAlign = 'right';
    c.fillText('00:' + String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0'), w - 18, 31);
    // record (stop) button
    c.strokeStyle = 'rgba(255,255,255,0.92)'; c.lineWidth = 4; c.beginPath(); c.arc(w / 2, h - 46, 30, 0, TAU); c.stroke();
    c.fillStyle = '#ff3b30'; c.beginPath(); c.roundRect(w / 2 - 13, h - 59, 26, 26, 5); c.fill();
    // focus brackets on him
    c.strokeStyle = 'rgba(255,214,90,0.85)'; c.lineWidth = 2.5; const fx = w * 0.42, fy = h * 0.44, fs = 70;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.beginPath(); c.moveTo(fx + sx * fs, fy + sy * (fs - 16)); c.lineTo(fx + sx * fs, fy + sy * fs); c.lineTo(fx + sx * (fs - 16), fy + sy * fs); c.stroke(); }
    // glass sheen
    const sg = c.createLinearGradient(0, 0, w, h); sg.addColorStop(0, 'rgba(255,255,255,0.08)'); sg.addColorStop(0.35, 'rgba(255,255,255,0)'); sg.addColorStop(0.62, 'rgba(255,255,255,0.05)'); sg.addColorStop(0.7, 'rgba(255,255,255,0)');
    c.fillStyle = sg; c.fillRect(0, 0, w, h);
  }
  // the phone + the hand that holds it, painted into a phone-sized buffer (so it can be defocused cheaply)
  const PB14 = { w: 760, h: 1100, ox: 380, oy: 430 };   // buffer size, and where the phone centre sits in it
  function c14PhoneLayer(t, wide, rot) {
    const b = PV.buffer('g04:c14phone2', PB14.w, PB14.h), c = b.ctx; c.clearRect(0, 0, PB14.w, PB14.h);
    const s = PH14.s;
    c.save(); c.translate(PB14.ox, PB14.oy); c.rotate(rot);
    // the hand under it: the heel of the palm and the wrist below the phone, dark, a warm rim from the stage behind
    c.save(); c.scale(s, s);
    c.fillStyle = '#0b090d';
    c.beginPath(); c.moveTo(-120, 230); c.quadraticCurveTo(-138, 300, -112, 360); c.quadraticCurveTo(-80, 470, -70, 760); c.lineTo(130, 760); c.quadraticCurveTo(118, 470, 140, 352); c.quadraticCurveTo(160, 290, 128, 232); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,190,130,0.45)'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-124, 300); c.quadraticCurveTo(-82, 470, -72, 760); c.stroke();
    c.restore();
    c.drawImage(c14PhoneBody(), -260, -450);
    // screen (local units × s): x -136..136, y -260..264
    c.save(); c.scale(s, s); c.beginPath(); c.roundRect(-136, -260, 272, 524, 6); c.clip(); c.translate(-136, -260); recScreen(c, 272, 524, t, wide); c.restore();
    // fingertips curling round the right edge onto the bezel, the thumb tip on the left edge (dark, rimmed by the stage)
    c.save(); c.scale(s, s);
    const tipF = (x, y, len, wd, ang) => {
      c.save(); c.translate(x, y); c.rotate(ang);
      c.fillStyle = '#100c10'; c.beginPath(); c.moveTo(0, -wd / 2); c.lineTo(len - wd / 2, -wd / 2 * 0.9); c.arc(len - wd / 2, 0, wd / 2 * 0.9, -Math.PI / 2, Math.PI / 2); c.lineTo(0, wd / 2); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,196,140,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(4, -wd / 2 + 1.5); c.lineTo(len - wd / 2, -wd / 2 * 0.9 + 1.5); c.arc(len - wd / 2, 0, wd / 2 * 0.9 - 1.5, -Math.PI / 2, -0.2); c.stroke();
      c.restore();
    };
    for (const [y, k] of [[-40, 0.92], [24, 1.0], [88, 0.97], [148, 0.86]]) tipF(160, y, 30 * k + 10, 34 * k, Math.PI + 0.08);
    tipF(-163, 168, 40, 38, -0.32);
    c.restore();
    c.restore();
    return b.canvas;
  }

  PV.shot('C14', { draw(ctx, tIn, d, S) {
    const t = clamp(tIn, -0.2, d + 0.2);
    const PM = profiler(ctx);
    // ---------------- the whip pull-back: the close-up rushes away (accelerating, zoom-blurred) and the wide lands
    //                  (decelerating out of a 2.6x push on his fretting hand, the blur clearing, a little roll settling).
    //                  The hand-over is a 2-frame cross-fade at the peak of the blur, glued with a warm flash.
    const kOut = clamp((t - C14.out0) / (C14.out1 - C14.out0));
    const X0k = 0.22, X1k = 0.3, wideA = sm(X0k, X1k, kOut);
    if (wideA < 0.999) {
      const e = E.inQuad(clamp(kOut / X1k));
      const cl = c14Close(t, 1 - 0.6 * e, 0.16 * e);    // the fretboard's own camera pulls back (no frame edges)
      PM('close');
      if (e < 0.18) ctx.drawImage(cl.canvas, 0, 0);
      else ctx.drawImage(zoomBlur(cl.canvas, 'close', cl.fp.x, cl.fp.y, 1, 0, 0.34 * e), 0, 0, W, H);
      PM('closeComp');
    }
    if (wideA > 0.001) {
      const stillPhase = t >= C14.rack1;
      const e = E.outCubic(clamp((kOut - X0k) / (1 - X0k)));       // 0 at the hand-over → 1 landed
      const settle = 1 + 0.05 * (1 - E.outCubic(clamp((t - C14.out1) / 0.3)));
      const zw = kOut < 1 ? lerp(3.4, 1.05, e) : settle, rotW = kOut < 1 ? -0.2 * (1 - e) : 0;
      const rack = sm(C14.rack0, C14.rack1, t); // rack focus: the stage softens as the phone comes into focus
      const wide = stillPhase ? c14WideStill() : c14Wide(t);
      PM('wide');
      ctx.save(); ctx.globalAlpha = wideA;
      if (stillPhase) ctx.drawImage(c14WideSoft(), 0, 0);
      else if (kOut < 1 && e < 0.8) ctx.drawImage(zoomBlur(wide, 'wide', NECK_W.x, NECK_W.y, zw, rotW, 0.32 * (1 - e)), 0, 0, W, H);
      else {
        if (Math.abs(zw - 1) > 1e-3 || Math.abs(rotW) > 1e-4) { ctx.translate(NECK_W.x, NECK_W.y); ctx.rotate(rotW); ctx.scale(zw, zw); ctx.translate(-NECK_W.x, -NECK_W.y); }
        ctx.drawImage(wide, 0, 0);
        if (rack > 0.01) { ctx.globalAlpha = wideA * rack; ctx.drawImage(c14WideSoft(), 0, 0); }
      }
      ctx.restore();
      const fl = Math.sin(Math.PI * clamp((kOut - 0.18) / 0.16));
      if (fl > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(255,214,160,${0.22 * fl})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      PM('wideComp');
      // the phone rises into the foreground (44.9) and holds; ● REC. Out of focus while it rises, then the focus pulls in.
      if (t > C14.phone - 0.05) {
        const rise = E.outCubic(clamp((t - C14.phone) / 0.32));
        const px = 1450 - 20 * rise, py = lerp(1500, 690, rise) + 6 * Math.sin(t * 2.1), rot = -0.13 + 0.03 * Math.sin(t * 1.3);
        const layer = c14PhoneLayer(t, stillPhase ? c14WideStill() : wide, rot);
        const soft = 1 - rack;
        // the screen lights the air and the heads around it a little
        ctx.save(); ctx.globalCompositeOperation = 'screen'; lightS(ctx, px, py, 520, '#9fb8ff', 0.16 * rise); ctx.restore();
        const X0 = px - PB14.ox, Y0 = py - PB14.oy;
        if (soft < 0.98) ctx.drawImage(layer, X0, Y0);
        if (soft > 0.02) {
          const q = 0.25, bw = Math.ceil(PB14.w * q), bh = Math.ceil(PB14.h * q), qb = PV.buffer('g04:c14phoneQ', bw, bh);
          qb.ctx.clearRect(0, 0, bw, bh); qb.ctx.filter = `blur(${(7 * q * soft + 0.6).toFixed(2)}px)`; qb.ctx.drawImage(layer, 0, 0, bw, bh); qb.ctx.filter = 'none';
          ctx.save(); ctx.globalAlpha = Math.min(1, soft * 1.15); ctx.drawImage(qb.canvas, 0, 0, bw, bh, X0, Y0, PB14.w, PB14.h); ctx.restore();
        }
        PM('phone');
      }
    }
    setBloom(S, 0.5 + (t < C14.out1 ? 0.25 * Math.exp(-Math.max(0, t - C14.snap) * 2) : 0), 0.45);
  } });
  /* ======================================================================= C15 — the brightest day */
  // 46.5–49.5. The two at the seaside fence, backs to us, the sea dazzling under a high sun; a ferry slips under the
  // white bridge (horn 47.0). 48.2 dissolve: the selfie preview on his phone (his thumb over the shutter). 49.0 shutter:
  // the frame freezes into a white-bordered photograph (the photo C19 receives), then C16's dip to white takes it.
  const C15 = { horn: 0.5, dis0: 1.55, dis1: 1.86, focus: 1.96, shutter: 2.5 };
  const HZ15 = 566, SUN15 = { x: 1180, y: -170 };
  const RAIL15 = 1262 - 4.92 * 92 * 1.32; // top rail at her elbows: she leans on it
  const Z15 = 1.045, CX15 = 1100, CY15 = 520; // the lens (fixed); the camera only pans (parallax: far 26 px, near 78 px)

  // far land (aerial perspective) where the bridge lands
  function land15(c, x0, x1, hz, h, col, seed) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x0, hz + 1);
    for (let x = x0; x <= x1; x += 6) { const u = (x - x0) / (x1 - x0), env = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.1)), 0.6); c.lineTo(x, hz - h * env * (0.8 + 0.2 * N2(x * 0.02, seed)) - 2.5 * N2(x * 0.15, seed + 3) * env); }
    c.lineTo(x1, hz + 1); c.closePath(); c.fill();
  }
  // the summer sky + sea + bridge (world space). seaT = the moment of the sea's glitter
  function summerFar(c, t, o) {
    const hz = o.hz, sun = o.sun;
    L.skyDome(c, t, { preset: 'summer', horizon: hz, seed: 2, haze: 0.55, sun: { x: sun.x, y: sun.y, scale: 1.5, rays: 0.4, intensity: 1.1 } });
    L.cloudBand(c, t, { kind: 'cirrus', x: 0, y: 0, w: W, h: 250, seed: 7, coverage: 0.3, palette: 'summer', alpha: 0.38, speed: 2, light: -1.0 });
    // the towering cloud left of her (lit from the upper right), a far anvil on the right
    L.cumulonimbus(c, t, { x: o.cbX, base: hz + 8, w: 1060, h: 560, seed: 4, light: -0.85, lightZ: 0.32, fade: 0.32, drift: 1.4 });
    L.cumulonimbus(c, t, { x: o.cbX2, base: hz + 6, w: 620, h: 330, seed: 12, light: -0.9, lightZ: 0.35, haze: 0.3, fade: 0.45, drift: 1.0, anvil: 0.85, anvilDir: -1 });
    L.clouds(c, t, { seed: 31, count: 3, x0: 40, x1: 700, y0: 40, y1: 150, minW: 140, maxW: 240, type: 'puff', palette: 'summer', speed: 5, light: -0.9, lightZ: 0.4, haze: 0.1 });
    land15(c, -40, 260, hz, 30, '#aac3d9', 3); land15(c, 860, 1100, hz, 14, '#bdd1e2', 4);
    L.sea(c, o.seaT === undefined ? t : o.seaT, { horizonY: hz, palette: 'summer', sunX: sun.x, sunY: sun.y, road: 0.7, crests: 0.25 });
    // the white bridge, a little upstream (left)
    L.bridge(c, { x0: o.brX0, x1: o.brX1, y: hz - 10, towerH: o.brH, lw: o.brLw, cables: 11, haze: 0.05, hazeColor: '#e6f2fa', pierH: 12, span: o.brSpan, towers: o.towers, light: 'right' });
  }
  // the far layer through the lens, as three plates that differ only in the sea's glitter (cross-fading them is the
  // twinkle); the high sun's glare is baked in. Drawn per frame with an integer pan (a plain blit).
  function c15FarPlate(k) {
    return PV.cached('g04:c15far' + k, W, H, (c) => {
      c.save(); PV.camera(c, { zoom: Z15, cx: CX15, cy: CY15 });
      summerFar(c, 0, { hz: HZ15, sun: SUN15, cbX: 960, cbX2: 1700, brX0: -140, brX1: 820, brH: 196, brLw: 4.0, brSpan: 220, towers: [110, 520], seaT: 0.37 * k });
      c.restore();
      c.save(); c.globalCompositeOperation = 'screen'; lightS(c, CX15 + (SUN15.x - CX15) * Z15, 0, 760, '#fff6e0', 0.38); c.restore();
    });
  }
  // a small white ferry (moves slowly left), with the horn's puff of steam
  function ferry(c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = 'rgba(40,90,150,0.25)'; c.beginPath(); c.ellipse(4, 3, 64, 4, 0, 0, TAU); c.fill(); // shadow on the water
    c.fillStyle = '#f3f6f9'; c.beginPath(); c.moveTo(-58, -6); c.lineTo(52, -6); c.lineTo(62, -16); c.lineTo(60, 2); c.lineTo(-52, 2); c.closePath(); c.fill();
    c.fillStyle = '#2a5da8'; c.fillRect(-55, -2, 110, 2.5);
    c.fillStyle = '#e8edf2'; c.fillRect(-36, -18, 62, 12); c.fillRect(-22, -27, 34, 9);
    c.fillStyle = '#8fb3d6'; for (let k = 0; k < 7; k++) c.fillRect(-32 + k * 8, -15, 5, 4);
    c.fillStyle = '#d64a3a'; c.fillRect(-8, -36, 7, 9); // funnel
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(-58, -7, 110, 1.2);
    c.restore();
    // wake
    c.save(); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + 58 * s, y + 1); c.quadraticCurveTo(x + 110 * s, y + 4, x + 190 * s, y + 3); c.stroke(); c.restore();
    // horn (汽笛): a white puff from the funnel, rising and thinning
    const hp = t - C15.horn;
    if (hp > 0 && hp < 2.2) {
      c.save();
      for (let k = 0; k < 6; k++) {
        const a = hp - k * 0.08; if (a < 0) continue;
        const px = x + (-4.5 + 10 * a + 3 * k) * s, py = y + (-38 - 26 * a - 4 * k) * s, r = (3 + 9 * a + k) * s;
        c.fillStyle = `rgba(255,255,255,${(0.7 * Math.exp(-a * 1.3)).toFixed(3)})`; c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill();
      }
      c.restore();
    }
  }
  // seagulls gliding (a few, far): "M" strokes with a slow flap
  function gulls(c, t, list) {
    c.save(); c.strokeStyle = 'rgba(70,90,120,0.75)'; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const g of list) {
      const x = g.x + g.vx * t, y = g.y + 6 * Math.sin(t * 0.9 + g.ph), f = Math.sin(t * g.fr + g.ph), s = g.s;
      c.lineWidth = 2.2 * s; c.beginPath(); c.moveTo(x - 14 * s, y - 4 * s * f); c.quadraticCurveTo(x - 6 * s, y - 7 * s - 3 * s * f, x, y); c.quadraticCurveTo(x + 6 * s, y - 7 * s - 3 * s * f, x + 14 * s, y - 4 * s * f); c.stroke();
    }
    c.restore();
  }
  // the seaside fence: white-painted steel posts, a round top rail sunlit on top, slim balusters spaced so the sea
  // glitters through (backlit: darker faces, a bright top edge). Cached (world space, near layer).
  function fence15() {
    return PV.cached('g04:c15fence', W + 320, H, (c) => {
      c.translate(120, 0);
      const y = RAIL15, x0 = -120, x1 = W + 200;
      for (let x = x0; x < x1; x += 56) { const g = c.createLinearGradient(0, y, 0, H); g.addColorStop(0, '#9fb3c6'); g.addColorStop(1, '#7d93ab'); c.fillStyle = g; c.fillRect(x - 3, y + 14, 6, H - y); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x - 3, y + 14, 1.5, H - y); }
      c.fillStyle = '#7e95ad'; for (let x = x0 + 60; x < x1; x += 470) c.fillRect(x - 11, y - 4, 22, H - y);
      c.fillStyle = 'rgba(255,255,255,0.4)'; for (let x = x0 + 60; x < x1; x += 470) c.fillRect(x - 11, y - 4, 3, H - y);
      c.fillStyle = '#93a9bf'; c.fillRect(x0, y + 150, x1 - x0, 11);           // mid rail
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(x0, y + 150, x1 - x0, 2);
      const g = c.createLinearGradient(0, y - 12, 0, y + 16); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#d7e4ee'); g.addColorStop(0.7, '#8ea4ba'); g.addColorStop(1, '#6f86a0');
      c.fillStyle = g; c.fillRect(x0, y - 12, x1 - x0, 28);
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(x0, y - 11, x1 - x0, 2.5);
    });
  }
  // ---- 先輩's straw hat (wide brim, navy band and ribbon), drawn here instead of the head library's own (integration review H1:
  //      its brim shadow is a band across the eyes and nose with a lit forehead above it). The hat sits on the head through the
  //      head library's own projection (anime_head.js: pivot [0,-0.12,-0.08] H, pitch → yaw → roll, scale = head px), so it fits
  //      every view; the figure is given the same explicit head angles. h = {x, y: the neck point, s: head px, yaw, pitch, roll}.
  const HAT = { yb: -0.8, zc: -0.04, R: 0.92, Rc: 0.47, hc: 0.3, tilt: -0.22, droop: 0.1 };
  function hatView(h) {
    const ang = clamp(h.yaw || 0, -1, 1) * Math.PI / 2, p = h.pitch || 0, r = h.roll || 0;
    return { ca: Math.cos(ang), sa: Math.sin(ang), cp: Math.cos(p), sp: Math.sin(p), cr: Math.cos(r), sr: Math.sin(r), s: h.s, ox: h.x, oy: h.y };
  }
  function hatRot(V, p) { const x = p[0], y = p[1] + 0.12, z = p[2] + 0.08, y1 = y * V.cp - z * V.sp, z1 = y * V.sp + z * V.cp; return [x * V.ca + z1 * V.sa, y1, -x * V.sa + z1 * V.ca]; }
  function hatScr(V, q) { const X = q[0] * V.s, Y = q[1] * V.s; return [V.ox + X * V.cr - Y * V.sr, V.oy + X * V.sr + Y * V.cr]; }
  function hatRing(V, r, y, droop, n) {
    const P = [], Z = [];
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU, x = r * Math.sin(a), z = r * Math.cos(a), q = hatRot(V, [x, y + droop * (r / HAT.R) + z * Math.sin(HAT.tilt) * 0.6, HAT.zc + z]);
      P.push(hatScr(V, q)); Z.push(q[2]);
    }
    return { P, Z };
  }
  // the run of indices of a closed ring whose depth is in front of zc (the near arc), in order
  function nearRun(Z, zc) {
    const n = Z.length, inF = Z.map((z) => z > zc); let st = -1;
    for (let i = 0; i < n; i++) if (inF[i] && !inF[(i - 1 + n) % n]) { st = i; break; }
    if (st < 0) return inF[0] ? Z.map((_, i) => i) : [];
    const out = []; for (let k = 0; k < n && inF[(st + k) % n]; k++) out.push((st + k) % n);
    return out;
  }
  function hullPts(pts) {
    const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function polyPath(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
  // o: {light, rimDir (screen, toward the sun), wind, windDir, T}. shadowCtx: draw the brim's shadow (source-atop on a figure layer)
  function strawHat(c, h, o, shadowOnly) {
    const V = hatView(h), s = h.s, lw = PV.anime.inkW(s);
    const m = PV.anime.mat('hat', o.light || 'summer'), mb = PV.anime.mat('hatband', o.light || 'summer');
    const outer = hatRing(V, HAT.R, HAT.yb, HAT.droop, 56), inner = hatRing(V, HAT.Rc, HAT.yb, 0, 56);
    const cz = hatRot(V, [0, HAT.yb, HAT.zc])[2];
    const down = [-V.sr, V.cr];   // the head's own "down" on screen
    if (shadowOnly) {
      // the brim's shadow on the face and hair: from the brim's near edge down to just under the eyes (the sun is high)
      const run = nearRun(outer.Z, cz - 0.15); if (run.length < 3) return;
      const arc = run.map((i) => outer.P[i]), d = 0.36 * s;
      const pts = arc.concat(arc.slice().reverse().map((p) => [p[0] + down[0] * d, p[1] + down[1] * d]));
      c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(104,84,150,0.36)'; polyPath(c, pts); c.fill();
      c.fillStyle = 'rgba(112,92,156,0.12)'; c.translate(down[0] * d * 0.22, down[1] * d * 0.22); polyPath(c, pts); c.fill(); c.restore();
      return;
    }
    // is the top of the brim toward us, or its underside (the front edge is tilted up)?
    const nz = hatRot(V, [0, -1, -0.13])[2] - hatRot(V, [0, 0, 0])[2];
    const brimCol = nz > 0 ? m.base : PV.anime.mixHex(m.shade, m.base, 0.35), brimIn = nz > 0 ? m.hi : m.shade;
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    // ribbon tails (behind the crown), fluttering downwind on twos
    const tq = PV.anime.onTwos(o.T || 0), wd = o.windDir ?? Math.PI, wk = o.wind ?? 0.8;
    const back = hatRot(V, [0, HAT.yb - 0.05, HAT.zc - HAT.Rc]), bp = hatScr(V, back);
    for (const [len, ph, w0] of [[0.95, 0, 0.11], [0.78, 1.7, 0.09]]) {
      const pts = [];
      for (let i = 0; i <= 6; i++) { const u = i / 6, f = Math.sin(tq * 9 + ph + u * 3.2) * 0.12 * u * wk; pts.push([bp[0] + (Math.cos(wd) * u * len - Math.sin(wd) * f) * s, bp[1] + (Math.sin(wd) * u * len + 0.25 * u * u + Math.cos(wd) * f) * s * 0.9 + 0.04 * s]); }
      PV.anime.taper(c, pts, (u) => w0 * s * (1 - 0.65 * u), mb.base, true);
    }
    // the brim (all of it), then the crown, then the near half of the brim over the crown's foot
    polyPath(c, outer.P); c.fillStyle = brimCol; c.fill(); c.strokeStyle = m.line; c.lineWidth = lw; c.stroke();
    // straw weave rings on the visible face of the brim
    c.save(); polyPath(c, outer.P); c.clip(); c.strokeStyle = PV.anime.rgbaHex(m.line, 0.22); c.lineWidth = Math.max(0.6, lw * 0.35);
    for (const k of [0.66, 0.8, 0.92]) { const r = hatRing(V, HAT.R * k, HAT.yb, HAT.droop * k, 40); polyPath(c, r.P); c.stroke(); }
    c.restore();
    const rings = [[HAT.Rc, HAT.yb], [HAT.Rc * 0.96, HAT.yb - HAT.hc * 0.62], [HAT.Rc * 0.82, HAT.yb - HAT.hc * 0.9], [HAT.Rc * 0.5, HAT.yb - HAT.hc]];
    const crownPts = []; for (const [r, y] of rings) crownPts.push(...hatRing(V, r, y, 0, 28).P);
    const crown = hullPts(crownPts);
    polyPath(c, crown); c.fillStyle = m.base; c.fill();
    // cel shade on the crown, away from the sun
    const ld = o.rimDir ?? -1.6, lx = Math.cos(ld), ly = Math.sin(ld);
    c.save(); polyPath(c, crown); c.clip(); c.translate(lx * 0.16 * s, ly * 0.16 * s); polyPath(c, crown); c.rect(-1e4, -1e4, 2e4, 2e4); c.fillStyle = m.shade; c.fill('evenodd'); c.restore();
    // the navy band round the foot of the crown (its near half)
    const b0 = hatRing(V, HAT.Rc * 1.005, HAT.yb, 0, 40), b1 = hatRing(V, HAT.Rc * 0.995, HAT.yb - 0.1, 0, 40);
    const rb = nearRun(b0.Z, hatRot(V, [0, HAT.yb, HAT.zc])[2]);
    if (rb.length > 2) { const pts = rb.map((i) => b0.P[i]).concat(rb.slice().reverse().map((i) => b1.P[i])); polyPath(c, pts); c.fillStyle = mb.base; c.fill(); }
    polyPath(c, crown); c.strokeStyle = m.line; c.lineWidth = lw; c.stroke();
    const rn = nearRun(outer.Z, cz);
    if (rn.length > 2) {
      const ri = nearRun(inner.Z, cz), pts = rn.map((i) => outer.P[i]).concat(ri.slice().reverse().map((i) => inner.P[i]));
      polyPath(c, pts); c.fillStyle = brimCol; c.fill();
      c.save(); polyPath(c, pts); c.clip(); c.strokeStyle = PV.anime.rgbaHex(m.line, 0.22); c.lineWidth = Math.max(0.6, lw * 0.35);
      for (const k of [0.66, 0.8, 0.92]) { const r = hatRing(V, HAT.R * k, HAT.yb, HAT.droop * k, 40); polyPath(c, r.P); c.stroke(); }
      c.restore();
      c.beginPath(); c.moveTo(outer.P[rn[0]][0], outer.P[rn[0]][1]); for (const i of rn) c.lineTo(outer.P[i][0], outer.P[i][1]); c.strokeStyle = m.line; c.lineWidth = lw * 1.1; c.stroke();
    }
    // the sun behind: a hot rim along the far edge of the brim and the top of the crown
    const rim = PV.anime.rgbaHex('#fffbea', 0.9);
    c.save(); polyPath(c, crown); c.clip(); c.translate(-lx * 0.05 * s, -ly * 0.05 * s); polyPath(c, crown); c.rect(-1e4, -1e4, 2e4, 2e4); c.fillStyle = rim; c.fill('evenodd'); c.restore();
    c.save(); polyPath(c, outer.P); c.clip(); c.translate(-lx * 0.035 * s, -ly * 0.035 * s); polyPath(c, outer.P); c.rect(-1e4, -1e4, 2e4, 2e4); c.fillStyle = rim; c.fill('evenodd'); c.restore();
    c.restore();
  }

  // ---- the two at the fence (near layer, drawn in the camera's transform). Anime rework (faces): she leans back against the
  //      rail facing us, her hands on it behind her, and turns her face to him, laughing, eyes narrowed in the glare; he leans
  //      on it on his forearms looking out to sea and turns his head round to her (his profile). The high sun over the sea
  //      behind them rims the hat, the hair and the shoulders; the sea and the promenade fill the faces.
  const GIRL15 = { x: 1060, y: 1250, s: 122 }, BOY15 = { x: 1440, y: 1262, s: 122 * 1.06 };
  function c15Figures(ctx, t) {
    g04Poses();
    const A = PV.anime, T = START.C15 + t, tq = A.onTwos(t);
    const buf = PV.buffer('g04:c15fig'), b = buf.ctx; b.clearRect(0, 0, W, H); b.setTransform(ctx.getTransform());
    const laugh = 1 - sm(0.35, 1.2, tq);   // she has just laughed at something he said; the laugh settles into a smile
    A.figure(b, { who: 'boy', outfit: 'tee', pose: 'railing', facing: -2.72, camPitch: 0.04, x: BOY15.x, y: BOY15.y, scale: BOY15.s, T, light: 'summer', rimDir: -2.1, rimA: 0.85,
      wind: 0.75, windDir: 3.0, params: { variant: 'lean', railH: (BOY15.y - RAIL15) / BOY15.s, railZ: 0.78 },
      head: { expr: 'gentle', turn: 0.82, rim: 1.4, eyes: { look: [-0.6, 0.05] }, mouth: { open: 0.08 + 0.1 * laugh, shape: 'smile' } } });
    const hd = { yaw: 0.52 + 0.04 * Math.sin(tq * 1.9), pitch: 0.06 + 0.04 * laugh, roll: 0.07 + 0.05 * laugh };
    const her = A.figure(b, { who: 'senpai', outfit: 'summer', pose: 'g04_railback', facing: 0.3, camPitch: 0.04, x: GIRL15.x, y: GIRL15.y, scale: GIRL15.s, T, light: 'summer', rimDir: -1.36, rimA: 0.85,
      wind: 1.05, windDir: 3.0, noHat: true, params: { railH: (GIRL15.y - RAIL15) / GIRL15.s, weight: 0.3, hatHand: 0 },
      head: Object.assign({ expr: 'smile', rim: 1.4, eyes: { open: 0.84 + 0.1 * (1 - laugh) }, mouth: { open: 0.25 + 0.4 * laugh, shape: 'smile' }, blush: 0.3 }, hd) });
    // her straw hat on the head the library just drew: the brim's shadow over her face (on her pixels only), then the hat
    const hh = { x: her.head.neck[0], y: her.head.neck[1], s: her.head.size, yaw: hd.yaw, pitch: hd.pitch, roll: hd.roll };
    strawHat(b, hh, {}, true);
    strawHat(b, hh, { light: 'summer', rimDir: -1.36, wind: 1.0, windDir: Math.PI, T });
    b.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(buf.canvas, 0, 0); ctx.restore();
  }

  /* ---------------- the photograph (selfie): 4:3, design space 1440x1080. layer 'bg' | 'him' | 'all'
   * The sun stands just above the frame between their heads: two backlit silhouettes, faces in soft shadow (never
   * featured), hair edges and shoulders rimmed with warm light, her straw brim glowing where the sun comes through it.
   * Horizon behind their shoulders, the white bridge to her left. His face sits at ≈(0.655, 0.42) of the frame:
   * C19 lands its first tear there. */
  const PH = { W: 1440, H: 1080, hz: 640, her: { x: 568, y: 492 }, him: { x: 930, y: 456 }, s: 2.35, sunX: 742 };
  function photoFar() {
    return PV.cached('g04:photoFar3', PH.W, PH.H, (c) => {
      const hz = PH.hz;
      L.skyDome(c, 0, { preset: 'summer', horizon: hz, seed: 3, haze: 0.55, x1: PH.W, sun: { x: PH.sunX, y: -70, scale: 1.6, rays: 0.5, intensity: 1.15 } });
      L.cloudBand(c, 0, { kind: 'cirrus', x: 0, y: 0, w: PH.W, h: 220, seed: 9, coverage: 0.26, palette: 'summer', alpha: 0.32, speed: 0, light: -1.6 });
      L.cumulonimbus(c, 0, { x: 1230, base: hz + 10, w: 700, h: 430, seed: 4, light: -2.1, lightZ: -0.05, fade: 0.32 });
      land15(c, -30, 200, hz, 20, '#b4cadd', 6);
      L.sea(c, 0, { horizonY: hz, y1: PH.H, palette: 'summer', sunX: PH.sunX, sunY: -70, road: 0.9, crests: 0.18 });
      L.bridge(c, { x0: -80, x1: 380, y: hz - 8, towerH: 138, lw: 3.0, cables: 9, haze: 0.0, pierH: 8, span: 122, towers: [40, 262], light: 'right' });
    });
  }
  // a tapered hair lock along a polyline (ribbon), filled
  function lock(d, pts, w0, w1) {
    const n = pts.length, L1 = [], R1 = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const w = lerp(w0, w1, i / (n - 1)); L1.push([pts[i][0] - dy / l * w, pts[i][1] + dx / l * w]); R1.push([pts[i][0] + dy / l * w, pts[i][1] - dx / l * w]);
    }
    d.beginPath(); d.moveTo(L1[0][0], L1[0][1]);
    for (let i = 1; i < n; i++) d.quadraticCurveTo(L1[i - 1][0], L1[i - 1][1], (L1[i - 1][0] + L1[i][0]) / 2, (L1[i - 1][1] + L1[i][1]) / 2);
    d.lineTo(pts[n - 1][0], pts[n - 1][1]);
    for (let i = n - 1; i > 0; i--) d.quadraticCurveTo(R1[i][0], R1[i][1], (R1[i][0] + R1[i - 1][0]) / 2, (R1[i][1] + R1[i - 1][1]) / 2);
    d.lineTo(R1[0][0], R1[0][1]); d.closePath(); d.fill();
  }
  // faces in shadow: the skin tone darkened under the hair / brim, a little cool bounce from the sea at the jaw
  const HER_FACE = [[0.0, -0.42], [0.27, -0.35], [0.33, -0.1], [0.3, 0.13], [0.21, 0.31], [0.05, 0.44, 1], [-0.12, 0.36], [-0.25, 0.18], [-0.31, -0.07], [-0.27, -0.33]];
  const HIS_FACE = [[0.0, -0.44], [0.31, -0.36], [0.36, -0.08], [0.33, 0.15], [0.25, 0.33], [0.03, 0.48, 1], [-0.18, 0.4], [-0.3, 0.19], [-0.35, -0.07], [-0.31, -0.35]];
  function faceShade(d, path, top) {
    d.save(); d.beginPath(); spline(d, path, true); d.clip();
    const g = d.createLinearGradient(0, -0.45, 0, 0.48); g.addColorStop(0, `rgba(12,16,28,${top})`); g.addColorStop(0.55, 'rgba(12,16,28,0.08)'); g.addColorStop(1, 'rgba(150,176,220,0.2)');
    d.fillStyle = g; d.fillRect(-0.6, -0.6, 1.2, 1.2); d.restore();
  }
  function photoFigure(c, t, who) {
    const tq = q12(t), wv = Math.sin(tq * 3.3), wv2 = Math.sin(tq * 2.3 + 1);
    const isHim = who === 'him', P0 = isHim ? PH.him : PH.her;
    const base = { x: P0.x, y: P0.y, scale: PH.s, style: 'silhouette', rimColor: '#fff2d8', backlight: 0.6, glow: 0.85, rim: 1.8, light: -Math.PI / 2 + (isHim ? -0.25 : 0.2), fill: '#161b2a' };
    L.figureRender(c, base, null, (F) => {
      const skin = { tone: 0.19, toward: '#a8888e' }, white = { tone: 0.22, toward: '#c6d2ea', inner: 0.3 };
      const whiteCol = F.tone(0.22, '#c6d2ea'), foldCol = F.tone(0.08, '#c6d2ea');
      // clothes in shadow: a few soft folds, and the backlight wrapping onto the tops of the shoulders
      const cloth = (d, folds, shoulders) => {
        d.save(); d.globalCompositeOperation = 'source-atop'; d.lineCap = 'round';
        d.strokeStyle = withA(foldCol, 0.22); d.lineWidth = 0.09;
        for (const f of folds) { d.beginPath(); spline(d, f, false); d.stroke(); }
        for (const [x, y] of shoulders) { const g = d.createRadialGradient(x, y, 0.02, x, y, 0.5); g.addColorStop(0, 'rgba(255,236,206,0.32)'); g.addColorStop(1, 'rgba(255,236,206,0)'); d.fillStyle = g; d.beginPath(); d.arc(x, y, 0.5, 0, TAU); d.fill(); }
        d.restore(); void whiteCol;
      };
      if (!isHim) {
        const R = (d) => d.rotate(0.1);   // her head tilts toward him
        // long black hair behind her shoulders; a few locks lift toward him in the sea wind
        F.layer({ inner: 0.2 }, (d) => {
          R(d);
          blob(d, [[-0.4, -0.45], [-0.5, -0.05], [-0.56, 0.5], [-0.66, 1.2], [-0.72, 1.9], [-0.66, 2.8], [0.56, 2.8], [0.64, 1.8], [0.62, 1.0], [0.56, 0.4], [0.48, -0.05], [0.4, -0.45]]);
          lock(d, [[0.46, 0.05], [0.66, 0.26 + 0.02 * wv], [0.84, 0.5 + 0.03 * wv], [0.98 + 0.03 * wv2, 0.8]], 0.11, 0.01);
          lock(d, [[0.5, 0.45], [0.7, 0.68 + 0.02 * wv2], [0.86 + 0.03 * wv, 0.96]], 0.09, 0.01);
        });
        // bare shoulders and arms (in shadow), the white sleeveless one-piece (white in shadow)
        F.layer(skin, (d) => { R(d); blob(d, [[-0.14, 0.6], [-0.42, 0.76], [-0.72, 0.88], [-0.86, 1.08], [-0.92, 1.6], [-0.94, 2.8], [0.94, 2.8], [0.92, 1.6], [0.86, 1.08], [0.72, 0.88], [0.42, 0.76], [0.14, 0.6]]); });
        F.layer(white, (d) => { R(d); blob(d, [[-0.62, 2.8], [-0.66, 1.55], [-0.58, 1.02], [-0.46, 0.82, 1], [-0.32, 0.81, 1], [-0.26, 1.0], [0, 1.14], [0.26, 1.0], [0.32, 0.81, 1], [0.46, 0.82, 1], [0.58, 1.02], [0.66, 1.55], [0.62, 2.8]]); });
        F.raw((d) => { R(d); cloth(d, [[[-0.3, 1.3], [-0.34, 1.9], [-0.3, 2.6]], [[0.18, 1.35], [0.22, 2.0], [0.2, 2.6]], [[-0.05, 1.6], [0.0, 2.3]]], [[-0.52, 0.86], [0.52, 0.86]]); });
        // neck + face in shadow (no features)
        F.layer(skin, (d) => { R(d); d.beginPath(); d.moveTo(-0.11, 0.2); d.lineTo(0.11, 0.2); d.lineTo(0.13, 0.7); d.quadraticCurveTo(0, 0.78, -0.13, 0.7); d.closePath(); d.fill(); blob(d, HER_FACE); });
        F.raw((d) => { R(d); faceShade(d, HER_FACE, 0.82); });
        // the hair framing the face: side locks falling over the shoulders (the fringe is under the brim)
        F.layer({ inner: 0.12 }, (d) => {
          R(d);
          blob(d, [[-0.38, -0.46], [0.38, -0.46], [0.36, -0.2], [0.18, -0.16], [0.02, -0.19], [-0.16, -0.15], [-0.36, -0.2]]);
          lock(d, [[-0.3, -0.3], [-0.37, 0.1], [-0.4, 0.62], [-0.44, 1.08], [-0.4, 1.4]], 0.085, 0.014);
          lock(d, [[0.3, -0.3], [0.37, 0.08], [0.43 + 0.02 * wv, 0.52], [0.53 + 0.05 * wv, 0.9]], 0.075, 0.012);
        });
        // the wide-brimmed straw hat, seen a little from above: one brim over the top of her head (its front edge
        // crosses her brow), the crown and ribbon on it. The sun behind lights the straw; its edge glows through.
        F.layer({ fill: '#ddd1bf' }, (d) => { R(d); d.beginPath(); d.ellipse(0.03, -0.5, 1.0, 0.27, 0.04, 0, TAU); d.fill(); });
        F.raw((d) => {
          R(d); d.save(); d.globalCompositeOperation = 'source-atop';
          const g = d.createLinearGradient(0, -0.77, 0, -0.23); g.addColorStop(0, 'rgba(255,250,236,0.9)'); g.addColorStop(0.45, 'rgba(240,228,206,0.2)'); g.addColorStop(1, 'rgba(120,110,120,0.45)');
          d.fillStyle = g; d.beginPath(); d.ellipse(0.03, -0.5, 1.0, 0.27, 0.04, 0, TAU); d.fill();
          d.strokeStyle = 'rgba(160,140,130,0.35)'; d.lineWidth = 0.012;   // the straw's weave rings
          for (const k of [0.62, 0.78, 0.92]) { d.beginPath(); d.ellipse(0.03, -0.5, 1.0 * k, 0.27 * k, 0.04, 0, TAU); d.stroke(); }
          d.restore();
        });
        F.layer({ fill: '#b9b0ab' }, (d) => { R(d); d.beginPath(); d.moveTo(-0.39, -0.52); d.bezierCurveTo(-0.42, -1.0, 0.44, -1.02, 0.41, -0.52); d.quadraticCurveTo(0.01, -0.44, -0.39, -0.52); d.fill(); });
        F.layer({ fill: '#3c5888' }, (d) => { R(d); d.beginPath(); d.moveTo(-0.4, -0.53); d.quadraticCurveTo(0.01, -0.45, 0.42, -0.53); d.lineTo(0.41, -0.63); d.quadraticCurveTo(0.01, -0.56, -0.4, -0.63); d.closePath(); d.fill(); });
        F.raw((d) => {
          R(d); d.save(); d.globalCompositeOperation = 'source-atop';
          d.strokeStyle = 'rgba(255,248,232,0.9)'; d.lineWidth = 0.028; d.beginPath(); d.moveTo(-0.36, -0.72); d.bezierCurveTo(-0.3, -0.99, 0.32, -1.01, 0.38, -0.72); d.stroke();
          d.strokeStyle = 'rgba(255,240,210,0.85)'; d.lineWidth = 0.03; d.beginPath(); d.ellipse(0.03, -0.5, 0.99, 0.265, 0.04, Math.PI * 1.05, Math.PI * 1.95); d.stroke();
          d.restore();
        });
      } else {
        const R = (d) => d.rotate(-0.08);
        // his right arm reaching for the lens (lower right, foreshortened toward us)
        F.layer({ tone: 0.17, toward: '#a8888e', inner: 0.5 }, (d) => { R(d); blob(d, [[0.86, 1.04], [1.24, 1.12], [1.62, 1.5], [2.05, 2.1], [2.3, 2.7], [1.62, 2.75], [1.36, 2.2], [1.02, 1.62], [0.84, 1.4]]); });
        F.layer({ tone: 0.22, toward: '#c6d2ea', inner: 0.5 }, (d) => { R(d); blob(d, [[0.74, 0.92], [1.12, 0.98], [1.34, 1.28], [1.18, 1.56], [0.88, 1.44]]); }); // sleeve
        // T-shirt: shoulders, crew neck; his left shoulder in front of hers
        F.layer(white, (d) => { R(d); blob(d, [[-0.2, 0.7], [-0.5, 0.79], [-0.82, 0.9], [-0.98, 1.14], [-1.02, 1.7], [-1.0, 2.8], [0.92, 2.8], [0.94, 1.7], [0.9, 1.1], [0.66, 0.84], [0.2, 0.7], [0.12, 0.8], [0, 0.83], [-0.12, 0.8]]); });
        F.raw((d) => { R(d); cloth(d, [[[-0.55, 1.2], [-0.3, 1.5], [-0.05, 1.62]], [[0.5, 1.25], [0.25, 1.55], [0.1, 1.95]], [[-0.62, 2.0], [-0.6, 2.6]]], [[-0.62, 0.88], [0.62, 0.86]]); });
        F.layer({ tone: 0.1, toward: '#c6d2ea' }, (d) => { R(d); d.lineWidth = 0.05; d.strokeStyle = d.fillStyle; d.beginPath(); d.moveTo(-0.2, 0.71); d.quadraticCurveTo(0, 0.87, 0.2, 0.71); d.stroke(); });
        // neck, ears, face in shadow
        F.layer(skin, (d) => {
          R(d); d.beginPath(); d.moveTo(-0.14, 0.2); d.lineTo(0.14, 0.2); d.lineTo(0.16, 0.74); d.quadraticCurveTo(0, 0.82, -0.16, 0.74); d.closePath(); d.fill();
          for (const sg of [-1, 1]) ell(d, sg * 0.36, -0.02, 0.06, 0.11, sg * 0.15);
          blob(d, HIS_FACE);
        });
        F.raw((d) => { R(d); faceShade(d, HIS_FACE, 0.75); });
        // messy hair: uneven tufts (some lifting in the wind) and a heavy fringe down to the brows whose ragged edge
        // has many small points (no gaps that could read as eyes); tufts over the ears
        F.layer({}, (d) => {
          R(d); const w = 0.035 * wv;
          const fringe = [];
          for (let i = 0; i <= 10; i++) { const x = 0.36 - i * 0.072, y = -0.13 + (i % 2 ? 0.035 : -0.012) - 0.04 * Math.pow((x / 0.4), 2); fringe.push([x, y, i % 2 ? 1 : 0]); }
          blob(d, [[-0.43, 0.04], [-0.48, -0.26], [-0.5, -0.5], [-0.42, -0.68], [-0.52 + w, -0.78, 1], [-0.3, -0.81], [-0.15, -0.9], [0.0 + w, -1.0, 1], [0.09, -0.88], [0.28, -0.85], [0.46 + w, -0.88, 1],
            [0.46, -0.68], [0.53, -0.46], [0.51, -0.2], [0.47, 0.05, 1], [0.4, -0.08]].concat(fringe, [[-0.41, -0.08]]));
        });
      }
      // the lower body sinks into the frame's lower edge in shadow
      F.raw((d) => { d.save(); d.globalCompositeOperation = 'source-atop'; const g = d.createLinearGradient(0, 0.9, 0, 2.7); g.addColorStop(0, 'rgba(10,14,26,0)'); g.addColorStop(1, 'rgba(10,14,26,0.5)'); d.fillStyle = g; d.fillRect(-2.2, 0.9, 5.2, 1.9); d.restore(); });
    });
  }
  function drawPhoto(c, w, h, t, layer) {
    c.save(); c.scale(w / PH.W, h / PH.H);
    if (layer !== 'him') {
      c.drawImage(photoFar(), 0, 0);
      // the sun's halo between their heads (behind them)
      c.save(); c.globalCompositeOperation = 'screen';
      const g = c.createRadialGradient(PH.sunX, -20, 0, PH.sunX, -20, 820); g.addColorStop(0, 'rgba(255,251,236,0.95)'); g.addColorStop(0.22, 'rgba(255,242,214,0.42)'); g.addColorStop(1, 'rgba(255,240,210,0)');
      c.fillStyle = g; c.fillRect(0, 0, PH.W, PH.H); c.restore();
      photoFigure(c, t, 'her');
    }
    if (layer !== 'bg') photoFigure(c, t, 'him');
    if (layer !== 'him') {
      c.save(); c.globalCompositeOperation = 'screen';
      const g2 = c.createRadialGradient(PH.sunX, 0, 0, PH.sunX, 0, 300); g2.addColorStop(0, 'rgba(255,253,245,0.7)'); g2.addColorStop(1, 'rgba(255,253,245,0)'); c.fillStyle = g2; c.fillRect(PH.sunX - 300, -300, 600, 600);
      c.restore();
      // the sun's streak across the top of the frame (the library flare's ghosts would land on his face: none here)
      c.save(); c.globalCompositeOperation = 'screen';
      const sg = c.createLinearGradient(PH.sunX - 700, 0, PH.sunX + 700, 0); sg.addColorStop(0, 'rgba(255,242,214,0)'); sg.addColorStop(0.5, 'rgba(255,242,214,0.5)'); sg.addColorStop(1, 'rgba(255,242,214,0)');
      c.fillStyle = sg; c.translate(PH.sunX, 24); c.scale(1, 0.012); c.beginPath(); c.arc(0, 0, 700, 0, TAU); c.fill();
      c.restore();
      c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.18;
      for (const [f, r, col] of [[0.18, 40, '#ffd9a0'], [0.32, 22, '#bfe0ff'], [0.5, 60, '#ffe6c0']]) { const gx = PH.sunX - 620 * f, gy = 20 + 760 * f; const g = c.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, PV.rgba(col, 0.9)); g.addColorStop(0.8, PV.rgba(col, 0.5)); g.addColorStop(1, PV.rgba(col, 0)); c.fillStyle = g; c.beginPath(); c.arc(gx, gy, r, 0, TAU); c.fill(); }
      c.restore();
    }
    c.restore();
  }
  // the shared photo for C19: exactly the frame frozen by the shutter in C15
  PV.summerPhoto = function (c, w, h, layer) { drawPhoto(c, w, h, C15.shutter, layer === 'him' ? 'him' : 'bg'); };

  function c15Wide(ctx, t) {
    const pan = E.inOutCubic(clamp(t / 1.9));
    const farX = Math.round(-26 * pan), nearX = Math.round(-78 * pan);
    // the far plates: two of the three sea moments cross-fading = the glitter twinkles
    const ph = (Math.max(0, t) * 1.6) % 3, i0 = Math.floor(ph), fk = E.sine(ph - i0);
    ctx.drawImage(c15FarPlate(i0), farX, 0);
    if (fk > 0.01) { ctx.globalAlpha = fk; ctx.drawImage(c15FarPlate((i0 + 1) % 3), farX, 0); ctx.globalAlpha = 1; }
    ctx.save(); ctx.translate(farX, 0); PV.camera(ctx, { zoom: Z15, cx: CX15, cy: CY15 });
    ferry(ctx, 330 - 7 * t, HZ15 + 10, 1.0, t);
    gulls(ctx, t, [{ x: 470, y: 230, vx: -16, s: 1.7, fr: 3.0, ph: 0 }, { x: 590, y: 275, vx: -13, s: 1.3, fr: 3.4, ph: 1.4 }, { x: 860, y: 190, vx: -18, s: 1.1, fr: 3.8, ph: 2.6 }]);
    ctx.restore();
    ctx.save(); ctx.translate(nearX, 0); PV.camera(ctx, { zoom: Z15, cx: CX15, cy: CY15 });
    ctx.drawImage(fence15(), -120, 0);
    c15Figures(ctx, t);
    ctx.restore();
    L.flare(ctx, CX15 + (SUN15.x - CX15) * Z15 + farX, 20, 0.55, '#fff0c8');
  }
  const C15_HOLD = 1.72;
  function c15WideHold() { return PV.cached('g04:c15wideHold', W, H, (c) => c15Wide(c, C15_HOLD)); }
  // the phone shot: the bright, blurred park behind the phone (front-lit greens), the phone in landscape, his thumb
  function c15ParkBokeh() {
    // behind the phone: sky, the park's trees and the sunlit promenade, far out of focus (front-lit by the sun behind the two)
    return PV.cached('g04:parkBokeh3', W, H, (c) => {
      const q = 0.25, sw = W * q, sh = H * q; const b = PV.makeCanvas(sw, sh), d = b.ctx; d.scale(q, q);
      let g = d.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6eaee8'); g.addColorStop(0.3, '#bfe0f6'); g.addColorStop(0.38, '#7fb768'); g.addColorStop(0.62, '#4f8f45'); g.addColorStop(0.7, '#d9cdb0'); g.addColorStop(1, '#cfc2a4');
      d.fillStyle = g; d.fillRect(0, 0, W, H);
      const r = PV.rng(57);
      for (let k = 0; k < 46; k++) { const x = r() * W, y = 330 + r() * 360, rr = 50 + r() * 120; d.fillStyle = ['#5d9d4e', '#78b45c', '#3f7f3c', '#9ccc74', '#6aa652'][k % 5]; d.beginPath(); d.ellipse(x, y, rr * 1.3, rr, 0, 0, TAU); d.fill(); }
      for (let k = 0; k < 34; k++) { const x = r() * W, y = 320 + r() * 380, rr = 14 + r() * 40; d.fillStyle = 'rgba(255,250,210,0.85)'; d.beginPath(); d.arc(x, y, rr, 0, TAU); d.fill(); }
      d.fillStyle = 'rgba(60,70,50,0.25)'; d.fillRect(0, 700, W, 40);
      c.filter = 'blur(12px)'; c.drawImage(b.canvas, 0, 0, W, H); c.filter = 'none';
      L.bokeh(c, 0, { seed: 8, count: 30, rmin: 24, rmax: 70, x0: 0, x1: W, y0: 260, y1: 760, alpha: 0.45, colors: ['#fffbe0', '#f0ffd8', '#ffffff', '#fff1c8'] });
    });
  }
  function frozenPhoto() { return PV.cached('g04:frozenPhoto5', 960, 720, (c) => drawPhoto(c, 960, 720, C15.shutter, 'all')); }
  // landscape camera app inside the portrait screen (w,h are the landscape width/height of the screen)
  function cameraUI(c, w, h, t, freeze) {
    const pw = h * 4 / 3, px = (w - pw) / 2 - 18;
    c.fillStyle = '#05060a'; c.fillRect(0, 0, w, h);
    // the preview: the very frame the shutter will take, moving with his hand until it is taken
    c.save(); c.beginPath(); c.rect(px, 0, pw, h); c.clip();
    const dx = freeze ? 0 : 3.2 * Math.sin(t * 1.9) + 1.6 * N2(t * 2.2, 5), dy = freeze ? 0 : 2.6 * Math.sin(t * 2.3 + 1) + 1.2 * N2(5, t * 2.2), zz = freeze ? 1 : 1.03;
    c.drawImage(frozenPhoto(), px + dx - pw * (zz - 1) / 2, dy - h * (zz - 1) / 2, pw * zz, h * zz);
    c.restore();
    // right bar: shutter, thumbnail; mode label
    const bx = px + pw + (w - px - pw) / 2;
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 4; c.beginPath(); c.arc(bx, h / 2, 30, 0, TAU); c.stroke();
    const press = t > C15.shutter - 0.08 && t < C15.shutter + 0.12 ? 0.82 : 1;
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(bx, h / 2, 24 * press, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.75)'; c.font = '600 14px "IPAPGothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.save(); c.translate(bx, h / 2 + 64); c.fillStyle = '#ffd34d'; c.fillText('写真', 0, 0); c.restore();
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.roundRect(bx - 18, h - 70, 36, 36, 6); c.fill();
    // zoom pill
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(px + pw / 2, h - 34, 18, 0, TAU); c.fill(); c.fillStyle = '#ffd34d'; c.font = '600 13px "DejaVu Sans", sans-serif'; c.fillText('1×', px + pw / 2, h - 34);
    // tap-to-focus box on their faces
    const fk = t - C15.focus;
    if (fk > 0) {
      const fsz = lerp(150, 112, E.outCubic(clamp(fk / 0.25))), fa = fk < 0.6 ? 1 : Math.max(0.55, 1 - (fk - 0.6));
      const fx = px + pw * 0.51, fy = h * 0.46;
      c.strokeStyle = `rgba(255,211,77,${fa})`; c.lineWidth = 2.4; c.strokeRect(fx - fsz, fy - fsz * 0.62, fsz * 2, fsz * 1.24);
      c.fillStyle = `rgba(255,211,77,${fa})`; c.beginPath(); c.arc(fx + fsz + 18, fy, 7, 0, TAU); c.fill();
    }
    // glass sheen
    const sg = c.createLinearGradient(0, 0, w, h); sg.addColorStop(0, 'rgba(255,255,255,0.07)'); sg.addColorStop(0.4, 'rgba(255,255,255,0)'); sg.addColorStop(0.62, 'rgba(255,255,255,0.05)'); sg.addColorStop(0.7, 'rgba(255,255,255,0)');
    c.fillStyle = sg; c.fillRect(0, 0, w, h);
    return { px, pw, bx };
  }
  const PH15 = { s: 2.02 };
  function c15PhoneBody() {
    return PV.cached('g04:c15phoneBody', 760, 1440, (c) => L.phone(c, 0, { x: 380, y: 720, s: PH15.s, rot: 0, screen: 'photo', ui: false, glow: 0, bright: 1, tone: 'day', light: -0.9, rimA: 0.3, shadow: false, held: true, drawPhoto: () => {} }));
  }
  // his right thumb over the shutter button (seen from his side: the back of the thumb, the nail), daylight
  const SKIN15 = { base: '#e7b49b', shade: '#b0796c', rim: '#fff0dc', line: '#6b3f33', nail: '#f3cdbd', nailHi: 'rgba(255,255,255,0.5)' };
  function c15Thumb(c, tip, press) {
    const d = [-0.9, -0.42], T = [tip[0] + 44 * (1 - press) + 6, tip[1] + 52 * (1 - press) + 8];
    const F = fingerTube(T, [T[0] - d[0] * 170, T[1] - d[1] * 170 + 20], [T[0] - d[0] * 430 + 20, T[1] - d[1] * 430 + 90], 176, 98);
    c.save(); c.globalAlpha *= 0.22; c.fillStyle = '#20140e'; c.translate(12, 16); c.fill(F.path); c.restore();   // its shadow on the glass
    paintFinger(c, F, [-0.35, -0.94], SKIN15);
  }
  // the phone + UI (+ his thumb), its own layer at full res: (x,y) = phone centre on screen
  function c15Phone(c, t, x, y, rot, freeze) {
    const s = PH15.s, ts = freeze ? C15.shutter : t;
    c.save(); c.translate(x, y); c.rotate(rot);
    c.drawImage(c15PhoneBody(), -380, -720);
    c.save(); c.scale(s, s); c.beginPath(); c.roundRect(-136, -260, 272, 524, 6); c.clip(); c.translate(-136, -260);
    // the screen draws in portrait coordinates: turn so the camera app is landscape
    c.translate(272, 0); c.rotate(Math.PI / 2); const ui = cameraUI(c, 524, 272, ts, freeze);
    if (t >= C15.shutter && t < C15.shutter + 0.09) { c.fillStyle = `rgba(255,255,255,${0.7 * (1 - (t - C15.shutter) / 0.09)})`; c.fillRect(0, 0, 524, 272); }
    c.restore();
    // the thumb: from the phone's right end (screen right) onto the shutter button; it presses at 49.0
    const press = Math.max(0, 1 - Math.abs(t - C15.shutter + 0.02) / 0.08);
    const bxL = (ui.bx - 260) * s, byL = 0;                          // button centre, phone-local (landscape axes)
    c.rotate(Math.PI / 2);                                          // back to landscape-aligned local axes
    c15Thumb(c, [bxL, byL], press);
    c.restore();
  }
  // the moment the shutter is taken: the phone + park, softened, held still behind the print (one cached plate)
  function c15ShutterBack() {
    return PV.cached('g04:c15shutterBack', W, H, (c) => {
      const b = PV.makeCanvas(W, H), d = b.ctx;
      d.drawImage(c15ParkBokeh(), 0, 0);
      c15Phone(d, C15.shutter + 0.1, PHX15(C15.shutter), PHY15(C15.shutter), PHR15(C15.shutter), true);
      const q = PV.makeCanvas(W / 4, H / 4); q.ctx.filter = 'blur(3.5px)'; q.ctx.drawImage(b.canvas, 0, 0, W / 4, H / 4);
      c.imageSmoothingQuality = 'high'; c.drawImage(q.canvas, 0, 0, W, H);
      c.globalCompositeOperation = 'screen'; c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(0, 0, W, H);
    });
  }
  const PHX15 = (ts) => 968 + 6 * Math.sin(ts * 1.7) + 3 * N2(ts * 2, 1), PHY15 = (ts) => 540 + 5 * Math.sin(ts * 2.1 + 1) + 3 * N2(1, ts * 2), PHR15 = (ts) => -Math.PI / 2 - 0.035 + 0.006 * Math.sin(ts * 1.3);
  // the print's soft shadow (cached once, scaled to the print)
  function printShadow() {
    return PV.cached('g04:c15printShadow', 600, 470, (c) => { c.filter = 'blur(16px)'; c.fillStyle = 'rgba(30,40,60,0.32)'; c.fillRect(50, 50, 500, 370); });
  }

  PV.shot('C15', { draw(ctx, tIn, d, S) {
    const t = clamp(tIn, -0.2, d + 0.2);
    const PM = profiler(ctx);
    const dis = sm(C15.dis0, C15.dis1, t), shot = t >= C15.shutter;
    // the second half of the dissolve (the wide already more than half gone) holds the wide's frame at 47.7 + 0.2 s
    if (dis < 1) { if (dis > 0.45) ctx.drawImage(c15WideHold(), 0, 0); else c15Wide(ctx, t); }
    PM('wide');
    if (dis > 0) {
      const lift = shot ? E.outCubic(clamp((t - C15.shutter - 0.04) / 0.2)) : 0;
      ctx.save(); ctx.globalAlpha = dis;
      if (lift < 0.999 || !shot) {
        // the selfie preview on his phone, held up in front of them (landscape), the park blurred behind
        const ts = shot ? C15.shutter : Math.max(t, C15.dis0);
        ctx.drawImage(c15ParkBokeh(), 0, 0);
        c15Phone(ctx, t, PHX15(ts), PHY15(ts), PHR15(ts), shot);
      }
      if (lift > 0) { ctx.globalAlpha = dis * lift; ctx.drawImage(c15ShutterBack(), 0, 0); }
      ctx.restore();
      PM('phone');
      // 49.0: the shutter — the frame freezes and becomes a white-bordered photograph lifting toward us
      if (lift > 0) {
        const pw = lerp(900, 1360, lift), ph = pw * 0.75, cx = 960, cy = lerp(540, 520, lift), rt = -0.035 * lift, bd = lerp(4, 34, lift);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rt);
        const sw = pw + bd * 2, shh = ph + bd * 3.4;
        ctx.drawImage(printShadow(), -sw / 2 + 10 - sw * 0.1, -ph / 2 - bd + 16 - shh * 0.12, sw * 1.2, shh * 1.24);
        ctx.fillStyle = '#fbfaf6'; ctx.fillRect(-pw / 2 - bd, -ph / 2 - bd, pw + bd * 2, ph + bd * 2 + bd * 1.4);
        ctx.drawImage(frozenPhoto(), -pw / 2, -ph / 2, pw, ph);
        ctx.restore();
      }
    }
    if (shot && t < C15.shutter + 0.08) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    // the brightest day, but faces in the frame: a lower bloom keeps their thin eye lines (the photo / print phase blooms more)
    setBloom(S, dis < 0.5 ? 0.2 : 0.34, dis < 0.5 ? 0.18 : 0.26);
    PM('end');
  } });

  /* ---- DEV (temporary exploration; removed before delivery) */
  PV.shot('g04dev_a', { draw(ctx, t, d, S, env) {
    PV._g04dbgHat = true; PV.shots.C15.draw(ctx, 0.9, 3, {}, env); PV._g04dbgHat = false;
  } });
})();

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
  function profiler(ctx) {
    if (!PV._g04prof) return () => {};
    let t0 = performance.now(); const out = (PV._g04profOut = {});
    return (name) => { ctx.getImageData(0, 0, 1, 1); const t1 = performance.now(); out[name] = (out[name] || 0) + (t1 - t0); t0 = t1; };
  }
  function shake(t, amp, freq, seed) { return { x: N2(t * freq, seed + 1.3) * amp, y: N2(seed + 7.7, t * freq) * amp, r: N2(t * freq * 0.7, seed + 3.1) * amp * 0.0009 }; }

  /* ======================================================================= C13 — the gym */
  // camera behind the two at waist height (~0.95 m), looking out over the rope at the audience and the far wall.
  const C13 = { nod: 1.1, blast: 1.5 };
  const EYE = 600, FOC = 1100, CAMH = 0.95;
  const yAt = (h, d) => EYE - FOC * (h - CAMH) / d;
  const AMB = '#ffbf6b', MAG = '#ff5fa8', CYA = '#5fd7ff', RED = '#ff3b30';
  // where the gallery follow-spots hang (screen px): they are aimed at the performers, i.e. at us
  const SPOTS = [{ x: 205, y: 452, col: CYA }, { x: 905, y: 448, col: AMB }, { x: 1735, y: 450, col: MAG }];

  // the far wall: ceiling trusses, the clock, black-out curtains (slivers of daylight), the gallery, lower wall
  const PADX = 48, PADY = 30;
  function gymWall(lit) {
    return PV.cached('g04:gymWall5:' + (lit ? 'lit' : 'dark'), W + PADX * 2, H + PADY * 2, (c) => {
      c.scale((W + PADX * 2) / W, (H + PADY * 2) / H);
      const r = PV.rng(41);
      let g = c.createLinearGradient(0, 0, 0, H);
      if (lit) { g.addColorStop(0, '#120d18'); g.addColorStop(0.3, '#2a1c2c'); g.addColorStop(0.5, '#4a2e3a'); g.addColorStop(0.62, '#3a2430'); g.addColorStop(1, '#140f16'); }
      else { g.addColorStop(0, '#08080d'); g.addColorStop(0.3, '#10101a'); g.addColorStop(0.5, '#171724'); g.addColorStop(0.62, '#14141f'); g.addColorStop(1, '#0b0b11'); }
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // ceiling seen at a slant: truss chords crowd together toward the wall top (y≈236), lattice between, dark lamp cans
      const tc = lit ? '#0d0910' : '#050508';
      c.fillStyle = tc; c.strokeStyle = tc;
      const chords = [[-6, 30], [92, 22], [160, 15], [204, 10], [228, 7]];
      for (const [y, h] of chords) c.fillRect(0, y, W, h);
      for (let k = 0; k < chords.length - 1; k++) {
        const y0 = chords[k][0] + chords[k][1], y1 = chords[k + 1][0], step = 140 - k * 22;
        c.lineWidth = 6 - k; c.beginPath();
        for (let x = -step; x < W + step; x += step) { c.moveTo(x, y0); c.lineTo(x + step / 2, y1); c.lineTo(x + step, y0); }
        c.stroke();
      }
      for (let x = 160; x < W; x += 400) { c.beginPath(); c.ellipse(x, 124, 34, 13, 0, 0, TAU); c.fill(); }
      for (let x = 260; x < W; x += 300) { c.beginPath(); c.ellipse(x, 186, 20, 7, 0, 0, TAU); c.fill(); }
      if (lit) { c.fillStyle = 'rgba(255,190,150,0.14)'; for (let x = 160; x < W; x += 400) { c.beginPath(); c.ellipse(x, 120, 30, 5, 0, 0, TAU); c.fill(); } }
      // the upper wall band + the clock (体育館の時計)
      c.fillStyle = lit ? '#2c1f2a' : '#0e0e16'; c.fillRect(0, 236, W, 64);
      { const x = 960, y = 268, rr = 25;
        c.fillStyle = lit ? '#1c141b' : '#09090e'; c.beginPath(); c.arc(x, y, rr + 4, 0, TAU); c.fill();
        c.fillStyle = lit ? '#8f8488' : '#2a2a36'; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
        c.strokeStyle = lit ? '#2a2026' : '#121219'; c.lineWidth = 1.6;
        for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; c.beginPath(); c.moveTo(x + Math.cos(a) * rr * 0.78, y + Math.sin(a) * rr * 0.78); c.lineTo(x + Math.cos(a) * rr * 0.9, y + Math.sin(a) * rr * 0.9); c.stroke(); }
        c.lineWidth = 2.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(-2.2) * rr * 0.5, y + Math.sin(-2.2) * rr * 0.5); c.stroke();
        c.lineWidth = 1.9; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(0.45) * rr * 0.78, y + Math.sin(0.45) * rr * 0.78); c.stroke();
      }
      // black-out curtains in bays (heavy folds), slivers of daylight where they don't meet
      const cy0 = 300, cy1 = 446;
      for (let bay = 0; bay < 6; bay++) {
        const bx0 = bay * 320 + 22, bx1 = bx0 + 276;
        for (let x = bx0; x < bx1; x += 2) {
          const u = (x - bx0) / (bx1 - bx0), fold = 0.5 + 0.5 * Math.sin(x * 0.14 + bay * 2 + Math.sin(x * 0.031) * 2.2);
          const v = lit ? 22 + 34 * fold : 11 + 9 * fold;
          c.fillStyle = lit ? `rgb(${Math.round(v * 1.3 + 8)},${Math.round(v * 0.6)},${Math.round(v * 0.8)})` : `rgb(${Math.round(v * 0.92)},${Math.round(v * 0.86)},${Math.round(v * 1.1)})`;
          const sag = 5 * Math.sin(u * Math.PI);
          c.fillRect(x, cy0 + sag, 2, cy1 - cy0 - sag);
        }
        for (const sx of [bx0 + 3, bx0 + 130 + r() * 30, bx1 - 4]) {
          if (r() < 0.72) continue;
          const gg = c.createLinearGradient(0, cy0, 0, cy1); gg.addColorStop(0, `rgba(225,238,255,${lit ? 0.3 : 0.6})`); gg.addColorStop(0.75, `rgba(190,210,240,${lit ? 0.1 : 0.2})`); gg.addColorStop(1, 'rgba(190,210,240,0)');
          c.fillStyle = gg; c.fillRect(sx, cy0 + 3, 1.6 + r() * 1.4, (cy1 - cy0) * (0.55 + 0.45 * r()));
        }
      }
      c.fillStyle = lit ? '#231822' : '#0b0b11';
      for (let bay = 0; bay <= 6; bay++) c.fillRect(bay * 320 - 22, 236, 44, 250);
      // the gallery: railing + slab
      c.fillStyle = lit ? '#1c121a' : '#060609';
      c.fillRect(0, 446, W, 5); for (let x = 5; x < W; x += 12) c.fillRect(x, 449, 2.2, 34); c.fillRect(0, 482, W, 16);
      if (lit) { c.fillStyle = 'rgba(255,205,160,0.28)'; c.fillRect(0, 446, W, 1.4); }
      // lower wall (mostly behind the audience)
      g = c.createLinearGradient(0, 498, 0, 650);
      if (lit) { g.addColorStop(0, '#3a2830'); g.addColorStop(1, '#22161c'); } else { g.addColorStop(0, '#11101a'); g.addColorStop(1, '#0c0b11'); }
      c.fillStyle = g; c.fillRect(0, 498, W, 160);
      c.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = 516; y < 650; y += 18) c.fillRect(0, y, W, 1.2);
      // baked: the low work lights at both sides, and the hall haze at the eye line
      for (const [x, y] of [[40, 640], [1890, 640]]) { light(c, x, y, 560, '#ffad5e', lit ? 0.12 : 0.26); light(c, x, y, 120, '#ffd59a', lit ? 0.2 : 0.5); }
      g = c.createLinearGradient(0, 260, 0, 780);
      g.addColorStop(0, 'rgba(60,50,80,0)'); g.addColorStop(0.6, lit ? 'rgba(190,120,150,0.34)' : 'rgba(64,58,90,0.2)'); g.addColorStop(1, 'rgba(60,50,80,0)');
      c.fillStyle = g; c.fillRect(-60, 260, W + 120, 520);
      // the gallery spots' glow (behind the audience's heads: they are backlit by it)
      if (lit) { c.save(); c.globalCompositeOperation = 'screen'; for (const S0 of SPOTS) { light(c, S0.x, S0.y, 300, S0.col, 0.55); light(c, S0.x, S0.y, 64, '#ffffff', 0.95); } c.restore(); }
      // the floor in front of the rope (varnish: the spots smear down it as long streaks)
      const y0 = yAt(0, 4.4) + 2;
      g = c.createLinearGradient(0, y0, 0, H + 40); g.addColorStop(0, lit ? '#2c1c26' : '#100f17'); g.addColorStop(1, lit ? '#140d14' : '#07070b');
      c.fillStyle = g; c.fillRect(-60, y0, W + 120, H + 40 - y0);
      c.strokeStyle = lit ? 'rgba(255,200,150,0.2)' : 'rgba(130,120,150,0.08)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-60, y0 + 70); c.lineTo(W + 60, y0 + 62); c.stroke();
      c.beginPath(); c.moveTo(760, y0); c.lineTo(540, H + 40); c.stroke();
      if (lit) for (const S0 of SPOTS) {
        c.save(); c.globalCompositeOperation = 'screen'; c.translate(S0.x + (S0.x - 960) * 0.08, y0 + 40); c.scale(1, 4.2);
        const g2 = c.createRadialGradient(0, 0, 0, 0, 0, 90); g2.addColorStop(0, PV.rgba(S0.col, 0.34)); g2.addColorStop(0.45, PV.rgba(S0.col, 0.12)); g2.addColorStop(1, PV.rgba(S0.col, 0));
        c.fillStyle = g2; c.fillRect(-90, -10, 180, 100); c.restore();
      }
    });
  }
  function exitSigns(ctx) {
    for (const [x, y] of [[96, 518], [1830, 518]]) {
      ctx.fillStyle = '#0b2c1a'; ctx.fillRect(x - 27, y - 10, 54, 20);
      ctx.fillStyle = 'rgba(90,255,160,0.8)'; ctx.fillRect(x - 25, y - 8, 50, 16);
      ctx.fillStyle = 'rgba(235,255,245,0.9)'; ctx.beginPath(); ctx.arc(x - 9, y - 3, 2.2, 0, TAU); ctx.fill(); ctx.fillRect(x - 11, y - 0.5, 3.4, 6); ctx.fillRect(x + 5, y - 6, 8, 12);
      light(ctx, x, y, 64, '#5cff9a', 0.2);
    }
  }

  // the audience: one mass of heads and shoulders in depth rows (hazier when further), phones held up
  function crowdModel() {
    if (crowdModel.m) return crowdModel.m;
    const r = PV.rng(1307), rows = [];
    const depths = [22, 17, 13, 10, 7.8, 6.1];
    for (let k = 0; k < depths.length; k++) {
      const d = depths[k], people = [];
      const step = FOC * 0.5 / d;
      for (let x = -90 + r() * step; x < W + 90; x += step * (0.62 + r() * 0.62)) {
        const dd = d * (0.93 + r() * 0.14), hh = 1.5 + r() * 0.3;
        const hr = FOC * 0.105 / dd, hy = yAt(hh - 0.12, dd);
        const kr = r(), hk = kr < 0.36 ? 0 : kr < 0.6 ? 1 : kr < 0.74 ? 2 : kr < 0.9 ? 3 : 4; // short, long, ponytail, bob, cap
        const pr = r(), phone = pr < (k >= 3 ? 0.15 : 0.1) ? (r() < 0.5 ? 'raised' : 'chest') : null;
        people.push({ x: x + (r() - 0.5) * step * 0.3, hy, hr, sw: FOC * (0.2 + r() * 0.04) / dd, hk, tilt: (r() - 0.5) * 0.3, phone, side: r() < 0.5 ? -1 : 1, seed: r() * 100, floor: yAt(0, dd) });
      }
      rows.push({ d, people });
    }
    return (crowdModel.m = rows);
  }
  function drawPerson(c, p) {
    const { x, hy, hr, sw } = p, nk = hy + hr * 1.12, shy = hy + hr * 1.95;
    c.beginPath();
    c.moveTo(x - hr * 0.42, nk);
    c.bezierCurveTo(x - hr * 0.5, shy - hr * 0.45, x - sw * 0.7, shy - hr * 0.42, x - sw * 0.94, shy);    // trapezius → shoulder
    c.quadraticCurveTo(x - sw * 1.08, shy + hr * 0.35, x - sw * 1.04, shy + hr * 1.6);                   // deltoid → arm
    c.lineTo(x - sw * 0.98, p.floor + 4); c.lineTo(x + sw * 0.98, p.floor + 4); c.lineTo(x + sw * 1.04, shy + hr * 1.6);
    c.quadraticCurveTo(x + sw * 1.08, shy + hr * 0.35, x + sw * 0.94, shy);
    c.bezierCurveTo(x + sw * 0.7, shy - hr * 0.42, x + hr * 0.5, shy - hr * 0.45, x + hr * 0.42, nk);
    c.closePath(); c.fill();
    c.beginPath(); c.ellipse(x, hy, hr * 0.84, hr, p.tilt, 0, TAU); c.fill();
    if (p.hk === 1) { c.beginPath(); c.moveTo(x - hr * 0.9, hy - hr * 0.2); c.quadraticCurveTo(x - hr * 1.15, hy + hr * 1.6, x - hr * 0.9, hy + hr * 2.3); c.lineTo(x + hr * 0.9, hy + hr * 2.3); c.quadraticCurveTo(x + hr * 1.15, hy + hr * 1.6, x + hr * 0.9, hy - hr * 0.2); c.closePath(); c.fill(); }
    else if (p.hk === 2) { c.beginPath(); c.ellipse(x + p.side * hr * 0.75, hy - hr * 0.35, hr * 0.38, hr * 0.42, 0.5 * p.side, 0, TAU); c.fill(); }
    else if (p.hk === 3) { c.beginPath(); c.ellipse(x, hy + hr * 0.2, hr * 1.06, hr * 0.98, p.tilt, 0, TAU); c.fill(); }
    else if (p.hk === 4) { c.beginPath(); c.ellipse(x + p.side * hr * 0.3, hy - hr * 0.62, hr * 1.25, hr * 0.28, 0, 0, TAU); c.fill(); }
    if (p.phone === 'raised') {
      const s = p.side, ax = x + s * sw * 0.8, ay = shy + hr * 0.2, wx = x + s * sw * 0.45, wy = hy - hr * 2.6;
      c.lineCap = 'round'; c.lineWidth = hr * 0.62; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(ax + s * hr * 0.6, hy - hr * 0.4, wx, wy); c.stroke();
      c.fillRect(wx - hr * 0.36, wy - hr * 1.2, hr * 0.72, hr * 1.25);
      p.ph = [wx, wy - hr * 0.58, hr * 0.6, hr * 1.05];
    } else if (p.phone === 'chest') p.ph = [x + p.side * sw * 0.25, shy + hr * 0.9, hr * 0.6, hr * 1.05];
  }
  const CRY0 = 330, CRH = 500, GROUPS = [[0, 1, 2], [3, 4, 5]];
  function crowdRow(gi) {
    return PV.cached('g04:crowd3:' + gi, W, CRH, (c) => {
      const rows = crowdModel(), n = rows.length;
      c.translate(0, -CRY0);
      for (const k of GROUPS[gi]) { const far = 1 - k / (n - 1); c.fillStyle = PV.mix('#09090f', '#1c1a29', far * 0.85); c.strokeStyle = c.fillStyle; for (const p of rows[k].people) drawPerson(c, p); }
    });
  }
  // lit crowd = silhouette with the rim baked in (one draw per group when the lights are on)
  function crowdLit(gi) {
    return PV.cached('g04:crowdLit3:' + gi, W, CRH, (c) => { c.drawImage(crowdRow(gi), 0, 0); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.55 + 0.2 * gi; c.drawImage(crowdRim(gi), 0, 0); });
  }
  // the rim the spots draw on the crowd's heads and shoulders (they are backlit from the gallery)
  function crowdRim(gi) {
    return PV.cached('g04:crowdRim3:' + gi, W, CRH, (c) => {
      const s = crowdRow(gi), off = 2.6 + gi * 1.4;
      c.drawImage(s, 0, 0);
      c.globalCompositeOperation = 'destination-out'; c.drawImage(s, 0, off); c.drawImage(s, off * 0.6, off * 0.7); c.drawImage(s, -off * 0.6, off * 0.7);
      c.globalCompositeOperation = 'source-in';
      const g = c.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#9ce6ff'); g.addColorStop(0.24, '#bfe9ff'); g.addColorStop(0.38, '#ffd7a0'); g.addColorStop(0.58, '#ffcf90'); g.addColorStop(0.76, '#ffa6d2'); g.addColorStop(1, '#ff86c0');
      c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    });
  }
  // rope barrier (chrome posts, red rope) between the players and the front row
  function ropeBarrier(ctx, lit) {
    const d = 4.4, top = yAt(0.95, d), bot = yAt(0, d);
    const posts = [-40, 330, 700, 1070, 1440, 1810, 2180];
    for (let i = 0; i < posts.length; i++) {
      const x = posts[i];
      ctx.fillStyle = lit ? '#6a5560' : '#1a1a24'; ctx.fillRect(x - 4, top, 8, bot - top);
      ctx.fillStyle = lit ? '#e8d6d0' : '#3a3a48'; ctx.beginPath(); ctx.arc(x, top, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = lit ? '#3a2a32' : '#111118'; ctx.beginPath(); ctx.ellipse(x, bot, 30, 7, 0, 0, TAU); ctx.fill();
      if (lit) { ctx.fillStyle = 'rgba(255,240,230,0.85)'; ctx.fillRect(x - 2.5, top + 6, 1.6, (bot - top) * 0.8); }
      if (i < posts.length - 1) {
        const x1 = posts[i + 1]; ctx.strokeStyle = lit ? '#c4283a' : '#3a1418'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(x + 6, top + 4); ctx.quadraticCurveTo((x + x1) / 2, top + 46, x1 - 6, top + 4); ctx.stroke();
        if (lit) { ctx.strokeStyle = 'rgba(255,170,170,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 6, top + 2); ctx.quadraticCurveTo((x + x1) / 2, top + 43, x1 - 6, top + 2); ctx.stroke(); }
      }
    }
  }
  // small open-back combo amp seen from behind/above: tolex box, top control panel with the red jewel, glowing valves
  function ampBack(ctx, t, x, y, s, lit, kick) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const w = 240, h = 200, top = 34;
    // floor shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(0, 4, w * 0.62, 16, 0, 0, TAU); ctx.fill();
    // top surface (seen from above), chrome control strip on the rear edge, knobs, the red jewel
    ctx.fillStyle = lit ? '#2d2228' : '#121218'; ctx.beginPath(); ctx.moveTo(-w / 2, -h); ctx.lineTo(-w / 2 + 14, -h - top); ctx.lineTo(w / 2 + 14, -h - top); ctx.lineTo(w / 2, -h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = lit ? '#b9aab0' : '#3e3c48'; ctx.beginPath(); ctx.moveTo(-w / 2 + 6, -h - 4); ctx.lineTo(-w / 2 + 10, -h - 15); ctx.lineTo(w / 2 + 6, -h - 15); ctx.lineTo(w / 2 + 2, -h - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0a0a0e'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(-w / 2 + 34 + k * 28, -h - 9.5, 6.5, 3.6, 0, 0, TAU); ctx.fill(); }
    // handle
    ctx.strokeStyle = '#0a0a0e'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-36, -h - top + 12); ctx.quadraticCurveTo(7, -h - top - 12, 50, -h - top + 12); ctx.stroke();
    // the back: tolex frame, an open upper half (chassis + valves) and the speaker's magnet in the lower half
    ctx.fillStyle = lit ? '#1f171c' : '#0b0b10'; ctx.fillRect(-w / 2, -h, w, h);
    ctx.fillStyle = lit ? '#0e0a0d' : '#040406'; ctx.fillRect(-w / 2 + 14, -h + 22, w - 28, 62); ctx.fillRect(-w / 2 + 14, -h + 104, w - 28, 80);
    ctx.fillStyle = lit ? '#2a2026' : '#0f0f15'; ctx.fillRect(-w / 2 + 14, -h + 84, w - 28, 20);
    // valves: warm glow (brightens and wobbles with the blast)
    const gl = 0.75 + 0.25 * N2(t * 4, 3) + 0.6 * kick;
    for (let k = 0; k < 4; k++) {
      const vx = -w / 2 + 44 + k * 46, vy = -h + 56;
      ctx.fillStyle = `rgba(255,${150 + k * 6},70,${0.65 * Math.min(1, gl)})`; ctx.beginPath(); ctx.roundRect(vx - 7, vy - 20, 14, 30, 6); ctx.fill();
      ctx.fillStyle = `rgba(255,230,180,${0.8 * Math.min(1, gl)})`; ctx.fillRect(vx - 1.5, vy - 12, 3, 12);
    }
    // the speaker seen from behind: the back of the paper cone (it pumps with the chord), basket struts, magnet
    { const pump = 1 + 0.07 * kick * Math.sin(t * 2 * Math.PI * 11);
      ctx.save(); ctx.translate(0, -h + 144); ctx.scale(pump, pump);
      const cg = ctx.createRadialGradient(0, 0, 10, 0, 0, 74); cg.addColorStop(0, lit ? '#3a2c26' : '#141218'); cg.addColorStop(0.75, lit ? '#5a4432' : '#1c1a20'); cg.addColorStop(1, lit ? '#2a2026' : '#0e0e14');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(0, 0, 92, 40, 0, 0, TAU); ctx.fill();
      if (lit) { ctx.strokeStyle = `rgba(255,200,150,${0.18 + 0.3 * kick})`; ctx.lineWidth = 1.5; for (const k of [0.45, 0.7, 0.92]) { ctx.beginPath(); ctx.ellipse(0, 0, 92 * k, 40 * k, 0, 0, TAU); ctx.stroke(); } }
      ctx.restore(); }
    ctx.fillStyle = lit ? '#2c2329' : '#101016'; ctx.beginPath(); ctx.arc(0, -h + 144, 30, 0, TAU); ctx.fill();
    ctx.strokeStyle = lit ? '#2c2329' : '#101016'; ctx.lineWidth = 5; for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.6; ctx.beginPath(); ctx.moveTo(0, -h + 144); ctx.lineTo(Math.cos(a) * 70, -h + 144 + Math.sin(a) * 34); ctx.stroke(); }
    if (lit) { ctx.strokeStyle = 'rgba(255,200,170,0.4)'; ctx.lineWidth = 1.5; ctx.strokeRect(-w / 2 + 0.75, -h + 0.75, w - 1.5, h - 1.5); }
    ctx.restore();
    const jx = x + s * (w / 2 - 14), jy = y - s * (h + 9.5);
    return { jewel: [jx, jy], valves: [x, y - s * (h - 56)], w: w * s };
  }

  // the boy from behind, white Strat on.  o.turn (head toward her 0..1), o.nod (0..1), o.arm 0..1 (0 = the pick hand at
  // the strings, hidden in front of him; 1 = raised high with the pick). The arm swings on an arc like a windmill:
  // the elbow goes out to the side and up, the forearm passes through "pointing right" (never a folded chicken wing).
  // o.lit 0..1 = the stage lights are on (shirt catches coloured spill, a second magenta rim on his right contours)
  const STRAT = { body: [[-1.02, 0.02], [-0.92, 0.5], [-0.55, 0.74], [-0.15, 0.6], [0.12, 0.55], [0.4, 0.62], [0.6, 0.5, 1], [0.44, 0.3], [0.33, 0.12], [0.33, -0.12], [0.5, -0.28], [0.78, -0.5, 1], [0.55, -0.66], [0.12, -0.56], [-0.2, -0.62], [-0.6, -0.76], [-0.94, -0.5]],
    head: [[2.32, 0.09], [2.36, -0.1], [2.52, -0.22], [2.8, -0.24], [2.9, -0.15], [2.95, -0.02], [2.9, 0.06], [2.7, 0.07], [2.5, 0.1]] };
  const RARM = { u0: Math.atan2(1.14, 0.42), u1: Math.atan2(-0.6, 0.74), lu0: Math.hypot(0.42, 1.14), lu1: Math.hypot(0.74, 0.6),
    f0: Math.atan2(0.66, -0.64), f1: Math.atan2(-1.0, -0.24), lf0: Math.hypot(0.64, 0.66), lf1: Math.hypot(0.24, 1.0) };
  // points along the +normal edge of limb(p0,p1,r0,r1,bulge,f) (the same quadratic curve limb() fills), s0..s1
  function limbEdge(p0, p1, r0, r1, bulge, f, s0, s1, n) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1e-6, ux = dx / l, uy = dy / l, nx = uy, ny = -ux;
    const b = bulge === undefined ? (r0 + r1) / 2 : bulge, ff = f === undefined ? 0.4 : f;
    const A = [p0[0] + nx * r0, p0[1] + ny * r0], C = [p0[0] + dx * ff + nx * b * 1.08, p0[1] + dy * ff + ny * b * 1.08], Z = [p1[0] + nx * r1, p1[1] + ny * r1];
    const out = [];
    for (let i = 0; i <= n; i++) { const s = lerp(s0, s1, i / n), a = (1 - s) * (1 - s), m = 2 * (1 - s) * s, z = s * s; out.push([a * A[0] + m * C[0] + z * Z[0], a * A[1] + m * C[1] + z * Z[1]]); }
    return out;
  }
  function boyBackGuitar(ctx, t, o) {
    const tq = o.fps === 0 ? t : q12(t);
    const br = 0.016 * Math.sin(tq * 2.3), sway = 0.025 * N2(3.3, tq * 0.45);
    const P = [sway, -4.08];
    const Fr = (x, h) => [P[0] + x + 0.004 * h, P[1] - h];
    const SL = Fr(-0.8, 2.13 + br), SR = Fr(0.8, 2.13 + br), N = Fr(0, 2.42);
    const turn = clamp(o.turn || 0), nod = clamp(o.nod || 0), W0 = o.wind || 0, lit = clamp(o.lit || 0);
    const HC = [N[0] + 0.02 * turn, N[1] - 0.74 + 0.06 * nod];
    // the guitar (library proportions, mirrored so the tuner edge faces up), body centre gc, neck rising to the left
    const gc = Fr(0.04, 0.6), ga = Math.PI + 0.42 + 0.012 * Math.sin(tq * 1.7);
    const ca = Math.cos(ga), sa = Math.sin(ga);
    const G = (x, y) => [gc[0] + x * ca + y * sa, gc[1] + x * sa - y * ca];   // local → figure (y mirrored: -y = up)
    const LH = G(1.92, 0.0), EL = [SL[0] - 0.4, SL[1] + 1.18];
    // right arm by joint angles
    const k = clamp(o.arm || 0);
    const au = lerp(RARM.u0, RARM.u1, k), lu = lerp(RARM.lu0, RARM.lu1, k), af = lerp(RARM.f0, RARM.f1, k), lf = lerp(RARM.lf0, RARM.lf1, k);
    const ER = [SR[0] + Math.cos(au) * lu, SR[1] + Math.sin(au) * lu], WR = [ER[0] + Math.cos(af) * lf, ER[1] + Math.sin(af) * lf];
    const shirtT = o.shirt === undefined ? 0.07 : o.shirt, shirtTo = lit > 0 ? '#b8c4dc' : '#9aa6c4';
    const side = (sg) => {
      const fl = 0.03 * Math.min(1, W0) * Math.sin(tq * 9);
      return [Fr(sg * 0.193, 2.84), Fr(sg * 0.21, 2.52), Fr(sg * 0.454, 2.479), Fr(sg * 0.667, 2.416), Fr(sg * 0.82, 2.354 + br), Fr(sg * 0.964, 2.254 + br), Fr(sg * 1.012, 2.134 + br),
        Fr(sg * 0.972, 1.89), Fr(sg * 0.63, 1.71), Fr(sg * 0.668, 1.42), Fr(sg * 0.61, 0.8), Fr(sg * (0.65 + fl), 0.04), [...Fr(sg * (0.69 + fl * 1.4), -0.14), 1]];
    };
    const torsoPts = side(1).concat([Fr(0, -0.18)], side(-1).reverse());
    // a second (magenta) rim: a soft band and a hot core stroked ALONG a contour, kept inside the silhouette (source-atop)
    const rimStroke = (c, pts, a, w) => {
      c.save(); c.globalCompositeOperation = 'source-atop'; c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = PV.rgba('#ff5fa8', 0.38 * a); c.lineWidth = w * 2.4; c.beginPath(); spline(c, pts, false); c.stroke();
      c.strokeStyle = PV.rgba('#ffc2de', 0.85 * a); c.lineWidth = w * 0.9; c.beginPath(); spline(c, pts, false); c.stroke();
      c.restore();
    };
    L.figureRender(ctx, o, null, (F) => {
      const shirtCol = F.tone(shirtT, shirtTo), foldCol = F.tone(shirtT * 0.25, shirtTo);
      // the pick hand + forearm: in front of him at the strings (hidden by his back and the guitar), or swung up beside him
      F.layer({ tone: 0.03 }, (c) => {
        limb(c, ER, WR, 0.125, 0.085, 0.13, 0.5);
        if (k > 0.1) {
          const ha = af; c.save(); c.translate(WR[0], WR[1]); c.rotate(ha);
          blob(c, [[-0.02, -0.1], [0.12, -0.12], [0.24, -0.09], [0.28, 0.01], [0.23, 0.11], [0.08, 0.12], [-0.02, 0.09]]);
          c.beginPath(); c.moveTo(0.25, -0.03); c.lineTo(0.37, -0.07); c.lineTo(0.34, 0.05); c.closePath(); c.fill(); // the pick
          c.restore();
        } else ell(c, WR[0], WR[1], 0.14, 0.12);
      });
      // the white Strat: lower bout past his right hip, maple neck + headstock past his left side
      F.layer({ tone: o.gtone === undefined ? 0.3 : o.gtone, toward: '#e9e2cf', inner: 0.9 }, (c) => {
        blob(c, STRAT.body.map((p) => [...G(p[0], p[1]), p[2] || 0]));
        const a = G(0.3, -0.1), b = G(2.35, -0.08), cc = G(2.35, 0.08), d = G(0.3, 0.1);
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(cc[0], cc[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fill();
        blob(c, STRAT.head.map((p) => G(p[0], p[1])));
        for (let i = 0; i < 6; i++) { const p = G(2.45 + i * 0.08, -0.255); ell(c, p[0], p[1], 0.032, 0.026); }
      });
      // legs: school trousers, wide planted stance
      F.layer({}, (c) => {
        for (const sg of [-1, 1]) {
          const hip = Fr(sg * 0.36, 0), kn = [P[0] + sg * 0.6, -2.1], an = [P[0] + sg * 0.86, -0.3];
          limb(c, hip, kn, 0.34, 0.25, 0.33, 0.35); limb(c, kn, an, 0.25, 0.22, 0.25, 0.4);
        }
        blob(c, [Fr(-0.58, 0.82), Fr(-0.62, 0.1), Fr(-0.54, -0.4), Fr(0, -0.24), Fr(0.54, -0.4), Fr(0.62, 0.1), Fr(0.58, 0.82)]);
      });
      // torso: the white summer shirt from behind (trapezius → round deltoids → lats → slack untucked hem)
      F.layer({ fill: shirtCol, inner: 0.15 }, (c) => { blob(c, torsoPts); limb(c, Fr(-0.19, 2.44), Fr(0.19, 2.44), 0.07, 0.07); });
      // the cloth: the strap drags it into diagonal folds, a yoke seam, the spine, a crease where it bunches at the belt,
      // and (lights on) the tops of the shoulders catch the coloured spill from the ceiling pars
      F.raw((c) => {
        c.save(); c.globalCompositeOperation = 'source-atop'; c.lineCap = 'round';
        c.strokeStyle = withA(foldCol, 0.5);
        const fold = (pts, w) => { c.lineWidth = w * 1.35; c.beginPath(); spline(c, pts, false); c.stroke(); };
        fold([Fr(-0.5, 2.05), Fr(-0.18, 1.62), Fr(0.18, 1.18), Fr(0.42, 0.86)], 0.035);
        fold([Fr(-0.62, 1.66), Fr(-0.3, 1.3), Fr(0.05, 0.92)], 0.03);
        fold([Fr(0.06, 2.0), Fr(0.36, 1.62), Fr(0.6, 1.28)], 0.026);
        fold([Fr(-0.55, 0.42), Fr(-0.2, 0.36), Fr(0.12, 0.4), Fr(0.5, 0.33)], 0.03);
        fold([Fr(-0.36, 0.3), Fr(-0.4, 0.02)], 0.024); fold([Fr(0.3, 0.26), Fr(0.36, -0.04)], 0.024);
        c.strokeStyle = withA(foldCol, 0.45); fold([Fr(0, 2.36), Fr(0.01, 1.7), Fr(0.0, 1.1)], 0.04);   // spine valley
        fold([Fr(-0.78, 2.2), Fr(-0.3, 2.25), Fr(0.3, 2.25), Fr(0.78, 2.2)], 0.018);                       // yoke seam
        if (lit > 0) {
          for (const [sg, col] of [[-1, '#8fe4ff'], [1, '#ff8cc6']]) {
            const p = Fr(sg * 0.6, 2.42), g = c.createRadialGradient(p[0], p[1], 0.04, p[0], p[1], 0.55);
            g.addColorStop(0, PV.rgba(col, 0.42 * lit)); g.addColorStop(1, PV.rgba(col, 0)); c.fillStyle = g; c.beginPath(); c.arc(p[0], p[1], 0.55, 0, TAU); c.fill();
          }
        }
        c.restore();
      });
      // strap: from the top of his left shoulder across the back to the strap button at the right hip
      F.layer({ inner: 0.4 }, (c) => {
        const a = Fr(-0.46, 2.45), b = G(-1.0, 0.02), m = [(a[0] + b[0]) / 2 + 0.08, (a[1] + b[1]) / 2 - 0.06];
        const w = 0.07, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l * w, ny = dx / l * w;
        c.beginPath(); c.moveTo(a[0] + nx, a[1] + ny); c.quadraticCurveTo(m[0] + nx, m[1] + ny, b[0] + nx, b[1] + ny); c.lineTo(b[0] - nx, b[1] - ny); c.quadraticCurveTo(m[0] - nx, m[1] - ny, a[0] - nx, a[1] - ny); c.closePath(); c.fill();
      });
      // left arm up to the neck. The hand from behind: the heel of the hand and the thumb on the back of the neck,
      // the four knuckles curling over its top (bass) edge toward the fretboard
      F.layer({ tone: 0.04, inner: 0.45 }, (c) => {
        limb(c, SL, EL, 0.2, 0.125, 0.18, 0.35);
        limb(c, EL, G(1.84, 0.1), 0.125, 0.085, 0.13, 0.5);
        const q = (x, y) => G(1.92 + x, y);
        blob(c, [q(-0.17, 0.17), q(-0.19, 0.03), q(-0.13, -0.08), q(0.0, -0.1), q(0.12, -0.08), q(0.15, 0.05), q(0.07, 0.16), q(-0.06, 0.2)]);
        for (const [x, l] of [[-0.12, 0.1], [-0.04, 0.115], [0.04, 0.11], [0.115, 0.09]]) { const a = q(x, -0.06), b = q(x + 0.03, -0.08 - l); limb(c, a, b, 0.045, 0.036); }
        limb(c, q(-0.06, 0.13), q(0.17, 0.07), 0.05, 0.036);   // thumb along the back of the neck
      });
      // right upper arm (the forearm is drawn behind: in front of him / beside him)
      F.layer({ tone: 0.04, inner: 0.45 }, (c) => { limb(c, SR, ER, 0.2, 0.125, 0.18, 0.35); if (k > 0.3) ell(c, ER[0], ER[1], 0.125, 0.125); });
      // short sleeves of the white shirt over the upper arms, with a hem
      F.layer({ fill: shirtCol, inner: 0.25 }, (c) => {
        for (const [S, Eb] of [[SL, EL], [SR, ER]]) { const m = mix2(S, Eb, 0.5); limb(c, S, m, 0.24, 0.17, 0.22, 0.5); }
      });
      // lights on: the magenta spot on his right lays a second rim down the outer edge of his right sleeve and arm
      if (lit > 0 && k < 0.2) F.raw((c) => {
        const m = mix2(SR, ER, 0.5);
        rimStroke(c, limbEdge(SR, m, 0.24, 0.17, 0.22, 0.5, 0.05, 1, 6).concat(limbEdge(SR, ER, 0.2, 0.125, 0.18, 0.35, 0.55, 1, 5)), lit, 0.06);
      });
      F.raw((c) => {
        c.save(); c.globalCompositeOperation = 'source-atop'; c.strokeStyle = withA(foldCol, 0.7); c.lineCap = 'round'; c.lineWidth = 0.026;
        for (const [S, Eb] of [[SL, EL], [SR, ER]]) {
          const m = mix2(S, Eb, 0.47), dx = Eb[0] - S[0], dy = Eb[1] - S[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * 0.17, ny = dx / l * 0.17;
          c.beginPath(); c.moveTo(m[0] + nx, m[1] + ny); c.quadraticCurveTo(m[0] + dx / l * 0.03, m[1] + dy / l * 0.03, m[0] - nx, m[1] - ny); c.stroke();
        }
        c.restore();
      });
      // neck + head + messy hair. The turn is drawn as anime key poses: back → lost profile (cheek and jaw come round on
      // the left) → profile facing her (bangs over the eyes; the face is never acted)
      const headXf = (c) => { c.translate(HC[0], HC[1]); c.rotate(-0.3 * nod * (turn > 0.7 ? 1 : 0.4)); c.scale(1.04, 1.04); };
      F.layer({ tone: 0.02, inner: 0.3 }, (c) => {
        limb(c, N, [HC[0], HC[1] + 0.3], 0.2, 0.18);
        c.save(); headXf(c);
        const wx = -0.05 * W0, sd = 3;
        const tip = (i, x, y, kk = 1, sh = 1) => { const n = N2(sd + i * 1.37, tq * 1.5), m = N2(sd + 40 + i, tq * 1.1); return [x + wx * kk * (1 + 0.4 * n) + 0.01 * m, y - Math.abs(wx) * 0.25 * kk * Math.max(0, n), sh]; };
        if (turn < 0.72) {
          const kk = clamp(turn / 0.6), sx = 1 - 0.06 * kk, ox = 0.05 * kk;
          if (kk > 0.05) { // lost profile: cheek → jaw → chin edge peeks out past the hair on the left
            blob(c, [[-0.26, -0.12], [-0.4 - 0.05 * kk, 0.04], [-0.45 - 0.07 * kk, 0.18], [-0.42 - 0.06 * kk, 0.31], [-0.33 - 0.04 * kk, 0.42], [-0.2, 0.47], [-0.04, 0.43], [-0.1, 0.1]]);
          }
          ell(c, ox, 0.02, 0.44, 0.52);
          const hx = (x) => x * sx + ox;
          blob(c, [tip(0, hx(0.04), -0.69, 0.5), [hx(0.16), -0.645], [hx(0.31), -0.585], tip(1, hx(0.43), -0.49, 0.5, 0), [hx(0.49), -0.35], tip(11, hx(0.525), -0.2, 0.5, 0), [hx(0.515), -0.05],
            [hx(0.5), 0.13], [hx(0.458), 0.3], tip(3, hx(0.39), 0.43, 1.1), [hx(0.3), 0.37], tip(4, hx(0.2), 0.5, 1.25), [hx(0.1), 0.4], tip(5, hx(0.0), 0.535, 1.3), [hx(-0.1), 0.4],
            tip(6, hx(-0.2), 0.5, 1.25), [hx(-0.3), 0.37], tip(7, hx(-0.39), 0.43 - 0.06 * kk, 1.1), [hx(-0.458), 0.3 - 0.08 * kk], [hx(-0.5), 0.13 - 0.06 * kk], [hx(-0.515), -0.05], tip(12, hx(-0.525), -0.2, 0.5, 0),
            [hx(-0.49), -0.35], tip(9, hx(-0.43), -0.49, 0.5, 0), [hx(-0.3), -0.59], tip(13, hx(-0.17), -0.66, 0.6), [hx(-0.06), -0.655]]);
        } else {
          // profile facing left (the library's boy profile, mirrored) + side hair with the fringe over the brow
          const M = (p) => [-p[0], p[1], p[2] || 0];
          blob(c, [[-0.04, -0.54], [0.22, -0.49], [0.37, -0.32], [0.42, -0.1], [0.415, -0.02], [0.5, 0.13, 1], [0.42, 0.19], [0.41, 0.27], [0.38, 0.34], [0.38, 0.42], [0.3, 0.48], [0.1, 0.45], [-0.06, 0.33], [-0.3, 0.2], [-0.45, -0.05], [-0.4, -0.33]].map(M));
          const tf = (i, x, y, kk) => { const n = N2(sd + i * 1.7, tq * 1.4); return [x + 0.05 * kk * W0 * (1 + 0.4 * n), y - 0.02 * kk * W0 * Math.max(0, n), 1]; };
          blob(c, [[0.16, -0.62], [0.34, -0.53], [0.45, -0.38], [0.475, -0.22], tf(0, 0.475, -0.01, 0.5), [0.43, -0.1], tf(1, 0.44, 0.05, 0.4), [0.39, -0.04],
            [0.28, -0.12], [0.17, -0.09], tf(2, 0.1, 0.19, 0.3), [0.03, 0.06], [-0.1, 0.1], [-0.15, 0.25], tf(3, -0.17, 0.47, 0.8), [-0.25, 0.36],
            tf(4, -0.33, 0.49, 1.0), [-0.4, 0.33], tf(5, -0.5, 0.42, 1.1), [-0.56, 0.17], [-0.62, -0.05], [-0.635, -0.26], [-0.6, -0.45],
            tf(7, -0.5, -0.66, 0.8), [-0.38, -0.66], [-0.18, -0.695], [0.02, -0.68]].map(M));
        }
        c.restore();
      });
      // lights on: the magenta spot on his right lays a second rim along the right side of his hair
      if (lit > 0) F.raw((c) => { c.save(); headXf(c); rimStroke(c, [[0.36, -0.55], [0.49, -0.35], [0.525, -0.2], [0.515, -0.05], [0.5, 0.13], [0.458, 0.3], [0.39, 0.43]], lit, 0.06); c.restore(); });
    });
  }

  // 61-key keyboard on an X stand, from behind (nearly edge-on). (x,y) = her feet, s = her scale
  function keyboardBack(ctx, x, y, s, litK) {
    const u = 92 * s; ctx.save(); ctx.translate(x, y); ctx.scale(u, u);
    ctx.strokeStyle = PV.mix('#07070b', '#2e2128', litK); ctx.lineWidth = 0.085; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-1.25, -4.0); ctx.lineTo(1.2, 0.3); ctx.moveTo(1.25, -4.0); ctx.lineTo(-1.2, 0.3); ctx.stroke();
    ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(-1.55, -4.0); ctx.lineTo(1.55, -4.0); ctx.stroke();
    ctx.fillStyle = PV.mix('#09090e', '#1f161c', litK); ctx.beginPath(); ctx.roundRect(-2.28, -4.4, 4.56, 0.38, 0.06); ctx.fill();
    ctx.fillStyle = PV.mix('#13131b', '#4a3640', litK); ctx.fillRect(-2.25, -4.415, 4.5, 0.045);
    ctx.fillStyle = `rgba(255,225,190,${0.08 + 0.45 * litK})`; ctx.fillRect(-2.25, -4.43, 4.5, 0.016);
    ctx.fillStyle = '#ff6a3a'; ctx.beginPath(); ctx.arc(1.95, -4.22, 0.022, 0, TAU); ctx.fill();
    ctx.restore();
    light(ctx, x + 1.95 * u, y - 4.22 * u, 16, '#ff6a3a', 0.45);
  }

  // per-shot bloom through the engine's own post pass (documented S.post control), merged with whatever the timeline sets
  function setBloom(S, bloom, halation) {
    if (!S) return;
    if (!S._g04post) S._g04post = Object.assign({}, S.post || {});
    S.post = Object.assign({}, S._g04post, { bloom, halation });
  }

  // ---- the hall as cached flat plates. Pre-blast the camera is locked off, so the whole dark hall (wall, exit signs,
  //      audience, rope) is one screen-space plate. Lit, the hall is re-composed flat each frame (cheap blits: the
  //      recoiling audience, the two sweeping side beams, the phones) and goes through the shaking camera ONCE.
  const Z13 = 1.03, CAM13 = { cx: 960, cy: 470 }, BGW13 = W + PADX * 2, BGH13 = H + PADY * 2;
  function underCrowd(c) { const y0 = yAt(1.15, 6.6), y1 = yAt(0, 5.6); const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(9,9,15,0)'); g.addColorStop(0.25, '#09090f'); g.addColorStop(1, '#08080d'); c.fillStyle = g; c.fillRect(-60, y0, W + 120, y1 - y0); }
  function c13PhoneList() {
    if (!crowdModel.ph) { crowdRow(0); crowdRow(1); crowdModel.ph = []; crowdModel().forEach((row, k) => row.people.forEach((p) => { if (p.ph) crowdModel.ph.push([p, k >= 3 ? 1 : 0]); })); }
    return crowdModel.ph;
  }
  function c13Phones(c, t, offs) {
    c.save(); c.globalCompositeOperation = 'screen';
    for (const [p, gi] of c13PhoneList()) {
      const oy = offs[gi], [px, py, pw, ph] = p.ph, f = 0.78 + 0.22 * Math.sin(t * 2.6 + p.seed);
      c.fillStyle = `rgba(222,236,255,${0.9 * f})`; c.fillRect(px - pw / 2, py - ph / 2 + oy, pw, ph);
      lightS(c, px, py + oy, pw * 6, '#bcd6ff', 0.24 * f);
    }
    c.restore();
  }
  function c13DarkPlate() {
    return PV.cached('g04:c13dark', W, H, (c) => {
      PV.camera(c, { zoom: Z13, cx: CAM13.cx, cy: CAM13.cy });
      c.drawImage(gymWall(false), -PADX, -PADY);
      exitSigns(c); underCrowd(c);
      c.drawImage(crowdRow(0), 0, CRY0); c.drawImage(crowdRow(1), 0, CRY0);
      for (const S0 of SPOTS) { c.fillStyle = '#121218'; c.beginPath(); c.ellipse(S0.x, S0.y, 16, 11, 0, 0, TAU); c.fill(); }
      ropeBarrier(c, false);
    });
  }
  // lit wall + the gallery spots' cones and the ceiling pars baked in (they hold still; only the side beams sweep)
  function c13LitWall() {
    return PV.cached('g04:c13litwall', BGW13, BGH13, (c) => {
      c.drawImage(gymWall(true), 0, 0);
      const list = [];
      for (const S0 of SPOTS) list.push({ x: S0.x, y: S0.y, ang: Math.PI / 2 + (960 - S0.x) * -0.00018, ha: 0.62, len: 900, col: S0.col, a: 0.36, w0: 10 });
      list.push({ x: 640, y: -60, ang: 1.5, ha: 0.13, len: 640, col: AMB, a: 0.3, w0: 60 });
      list.push({ x: 1280, y: -60, ang: 1.64, ha: 0.13, len: 640, col: CYA, a: 0.28, w0: 60 });
      list.push({ x: 1600, y: -60, ang: 1.85, ha: 0.1, len: 700, col: MAG, a: 0.22, w0: 50 });
      list.push({ x: 300, y: -60, ang: 1.25, ha: 0.1, len: 700, col: AMB, a: 0.2, w0: 50 });
      const beams = beamsLayer('c13bake', list, 6, { x0: -PADX, y0: -PADY, w: BGW13, h: BGH13 });
      c.globalCompositeOperation = 'screen'; c.drawImage(beams, 0, 0, BGW13, BGH13); c.globalCompositeOperation = 'source-over';
      // the two side beams raking across the hall at head height (in the haze in front of the audience)
      c.translate(PADX, PADY);
      softBeams(c, [{ x: -60, y: 560, ang: -0.105, ha: 0.075, len: 1500, col: CYA, a: 0.4, w0: 8 }, { x: W + 60, y: 545, ang: Math.PI + 0.125, ha: 0.075, len: 1500, col: MAG, a: 0.38, w0: 8 }]);
    });
  }
  // the lit hall as ONE static plate: the audience holds its recoiled position (原作「観客が引いた」: it jumps back on the
  // blast frame, under the white-out and the shake) — only the two side beams sweep and the phones twinkle on top
  const REC13 = [-2.5, -5.5], BOY13 = { x: 1345, y: 1268, s: 1.44 };
  function c13LitPlate() {
    return PV.cached('g04:c13litplateS', BGW13, BGH13, (c) => {
      c.translate(PADX, PADY); PV.camera(c, { zoom: Z13, cx: CAM13.cx, cy: CAM13.cy });
      c.drawImage(c13LitWall(), -PADX, -PADY);
      exitSigns(c); underCrowd(c);
      for (let gi = 0; gi < GROUPS.length; gi++) c.drawImage(crowdLit(gi), 0, CRY0 + REC13[gi]);
      c.save(); c.globalCompositeOperation = 'screen'; for (const S0 of SPOTS) lightS(c, S0.x, S0.y, 46, '#ffffff', 0.7); c.restore();
      ropeBarrier(c, true);
    });
  }
  // the same hall in the first instant of the blast: every lamp at once, white-hot BEHIND the audience, so the crowd
  // (and the two players drawn over it) stand black against it
  function c13BurstPlate() {
    return PV.cached('g04:c13burstplateS', BGW13, BGH13, (c) => {
      c.translate(PADX, PADY); PV.camera(c, { zoom: Z13, cx: CAM13.cx, cy: CAM13.cy });
      c.drawImage(c13LitWall(), -PADX, -PADY);
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,214,186,0.55)'); g.addColorStop(0.42, 'rgba(255,238,218,0.96)'); g.addColorStop(0.62, 'rgba(255,228,204,0.88)'); g.addColorStop(1, 'rgba(255,200,170,0.5)');
      c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = g; c.fillRect(-PADX * 2, -PADY * 2, BGW13 * 1.1, BGH13 * 1.1);
      for (const S0 of SPOTS) light(c, S0.x, S0.y, 760, S0.col === AMB ? '#fff4e2' : S0.col === MAG ? '#ffe2f0' : '#e6fbff', 1.0);
      light(c, SPOTS[1].x, SPOTS[1].y, 1100, '#ffffff', 0.8); c.restore();
      exitSigns(c); underCrowd(c);
      for (let gi = 0; gi < GROUPS.length; gi++) { c.drawImage(crowdRow(gi), 0, CRY0 + REC13[gi]); c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.9; c.drawImage(crowdRim(gi), 0, CRY0 + REC13[gi]); c.restore(); }
      ropeBarrier(c, true);
    });
  }

  PV.shot('C13', { draw(ctx, tIn, d, S) {
    const t = clamp(tIn, -0.2, d + 0.2);
    const B = C13.blast, on = t >= B, since = Math.max(0, t - B);
    const burst = on ? Math.exp(-since * 9) : 0;                          // the first frames are white-hot
    const K = on ? 1 : 0;
    const PM = profiler(ctx);
    // ---------------- camera: locked off → the blast shakes it → slow push in
    const amp = on ? 17 * Math.exp(-since * 6) + 1.4 * Math.exp(-since * 1.4) : 0;
    const sh = on ? shake(t, amp, 16, 4) : { x: 0, y: 0, r: 0 };
    const push = on ? 1 + 0.07 * E.outCubic(clamp(since / 1.5)) + 0.025 * burst : 1;
    const cam = { zoom: Z13 * push, x: sh.x, y: sh.y, rot: sh.r, cx: CAM13.cx, cy: CAM13.cy };
    // the far hall: a dolly toward the stage hardly magnifies it (the players, 1-2 m away, loom; the audience 20 m away
    // does not), so the hall is a pre-zoomed plate that only takes the shake — a plain blit at an integer offset
    const camFar = { zoom: Z13, x: Math.round(sh.x), y: Math.round(sh.y), cx: CAM13.cx, cy: CAM13.cy };
    if (!on) {
      ctx.drawImage(c13DarkPlate(), 0, 0);
      ctx.save(); PV.camera(ctx, camFar);
      c13Phones(ctx, t, [0, 0]);
      const wk = 0.06 * N2(t * 3, 9); ctx.save(); ctx.globalCompositeOperation = 'screen'; for (const x of [40, 1890]) lightS(ctx, x, 640, 140, '#ffd59a', 0.25 + wk); ctx.restore();
      ctx.restore();
    } else {
      if (burst > 0.02) { // the white-out decays: the burst plate cross-fades into the lit plate
        const BG = PV.buffer('g04:c13bg', BGW13, BGH13), b = BG.ctx;
        b.drawImage(c13LitPlate(), 0, 0); b.globalAlpha = Math.min(1, burst * 1.15); b.drawImage(c13BurstPlate(), 0, 0); b.globalAlpha = 1;
        ctx.drawImage(BG.canvas, camFar.x - PADX, camFar.y - PADY);
      } else ctx.drawImage(c13LitPlate(), camFar.x - PADX, camFar.y - PADY);
      ctx.save(); PV.camera(ctx, camFar); c13Phones(ctx, t, REC13); ctx.restore();
    }
    ctx.save(); PV.camera(ctx, cam);   // the near layer: players, keyboard, amp, dust
    PM('hall');
    // ---------------- the players: her keyboard, the amp, then the two backs
    const gs = 1.3, gx = 600, gy = 1205;
    keyboardBack(ctx, gx, gy, gs, on ? K : 0);
    const kick = on ? Math.exp(-since * 5) : 0;
    const AJ = ampBack(ctx, t, 1712 + (on ? 3 * kick * Math.sin(since * 95) : 0), 1076 + (on ? 2 * kick * Math.cos(since * 80) : 0), 1.0, on, kick);
    // the red pilot lamp: a hard red jewel with a hot core, glowing (it stays lit through the whole cut)
    light(ctx, AJ.jewel[0], AJ.jewel[1], on ? 42 : 30, RED, 1.0); light(ctx, AJ.jewel[0], AJ.jewel[1], 130 + 120 * kick, RED, (on ? 0.42 : 0.3) + 0.3 * kick);
    ctx.fillStyle = '#ff2a20'; ctx.beginPath(); ctx.arc(AJ.jewel[0], AJ.jewel[1], 4.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd2c4'; ctx.beginPath(); ctx.arc(AJ.jewel[0] - 0.8, AJ.jewel[1] - 0.8, 1.7, 0, TAU); ctx.fill();
    light(ctx, AJ.valves[0], AJ.valves[1], 150, '#ff9a4a', 0.16 + 0.25 * kick);
    PM('kbd+amp');
    // her: at the keyboard; the blast throws her hair. A small tilt of the head answers his nod.
    const gust = on ? 0.95 + 0.9 * Math.exp(-since * 2.6) : 0.1 + 0.05 * Math.sin(t * 1.3);
    L.girlAtRailing(ctx, t, {
      x: gx, y: gy, scale: gs, railing: false, hands: 'rail', railY: -4.42, handSpread: 0.64, outfit: 'blouse',
      wind: gust, windDir: Math.PI - 0.15, windLift: -0.3, weight: 0.35, hairLen: 2.85, headTilt: 0.09 * sm(C13.nod + 0.16, C13.nod + 0.3, t) * (1 - sm(C13.blast - 0.05, C13.blast + 0.2, t)),
      light: on ? -1.75 : -2.7, rimColor: on ? '#ffc7e2' : '#ffb06a', rim: on ? 1.6 : 0.8, backlight: on ? 0.72 - 0.35 * burst : 0.16, glow: on ? 1.0 : 0.42,
    });
    PM('girl');
    // him: looks at her, nods (41.6), raises the pick hand, and slams the chord (42.0)
    const a0 = C13.nod;
    const turn = sm(a0 - 0.03, a0 + 0.1, t) * (1 - sm(a0 + 0.29, B - 0.02, t));
    const nod = sm(a0 + 0.1, a0 + 0.17, t) * (1 - sm(a0 + 0.2, a0 + 0.29, t));
    let arm = E.inOutCubic(sm(a0 + 0.14, B - 0.04, t));
    if (on) arm = 1 - E.inQuad(clamp((since + 0.042) / 0.085));    // the down-stroke: 2 frames, smeared
    boyBackGuitar(ctx, t, {
      x: BOY13.x, y: BOY13.y, scale: BOY13.s, turn, nod, arm, lit: on ? K : 0, wind: on ? 1.1 * Math.exp(-since * 2.2) + 0.2 : 0,
      fps: t > B - 0.25 && t < B + 0.25 ? 0 : 12, shirt: on ? 0.14 - 0.09 * burst : 0.07, gtone: on ? 0.36 - 0.12 * burst : 0.22,
      light: on ? -2.45 : -2.3, rimColor: on ? '#ffd9a8' : '#ffb06a', rim: on ? 1.5 : 0.85, backlight: on ? 0.55 - 0.3 * burst : 0.15, glow: on ? 0.75 : 0.42,
    });
    PM('boy');
    // the down-stroke smear (two frames)
    if (on && since < 0.09) {
      const u = 92 * BOY13.s, cx = BOY13.x + 0.8 * u, cy = BOY13.y - 6.2 * u;
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5 * (1 - since / 0.09);
      const g = ctx.createRadialGradient(cx, cy, 0.5 * u, cx, cy, 1.9 * u); g.addColorStop(0, 'rgba(255,225,190,0)'); g.addColorStop(0.75, 'rgba(255,225,190,0.55)'); g.addColorStop(1, 'rgba(255,225,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 1.9 * u, -1.25, 1.1); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // dust: drifting slowly; it jumps off the amp and the floor at the blast
    L.dust(ctx, t, { seed: 13, count: on ? 80 : 30, x0: 0, x1: W, y0: 120, y1: 960, size: 2.4, alpha: on ? 0.6 : 0.25, drift: 40, vy: on ? -12 : -3, color: on ? '#ffe2c4' : '#d8c8b0' });
    if (on && since < 1.4) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 26; i++) {
        const a = -Math.PI / 2 + (R1(i, 5) - 0.5) * 2.2, v = 180 + 260 * R1(i, 6), tt = since;
        const px = AJ.jewel[0] - 120 + 240 * R1(i, 7) + Math.cos(a) * v * tt, py = AJ.jewel[1] + 20 + Math.sin(a) * v * tt + 300 * tt * tt;
        ctx.fillStyle = `rgba(255,220,190,${0.7 * (1 - tt / 1.4)})`; ctx.beginPath(); ctx.arc(px, py, 1.6 + 1.6 * R1(i, 8), 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    PM('dust');
    // ---------------- lens: star flares from the spots, the blast's overexposure (over everything, lighter than the
    //                  burst behind them so the two stay dark shapes), bloom at its maximum
    if (on) {
      for (const S0 of SPOTS) L.flare(ctx, S0.x + sh.x, S0.y + sh.y, 0.42 * K, S0.col === AMB ? '#ffd29a' : S0.col === MAG ? '#ffa8d6' : '#aee8ff');
      starFlare(ctx, SPOTS[1].x + sh.x, SPOTS[1].y + sh.y, 220 * K + 120 * burst, '#fff1d8', 0.6 * K, since);
    }
    if (burst > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(255,232,208,${0.2 * burst})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    setBloom(S, on ? 0.5 + 0.45 * Math.exp(-since * 3) : 0.3, on ? 0.5 : 0.35);
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
  // the 14th fret of the kneeling figure's Strat (measured from the library pose) and its neck angle on screen
  const NECK_W = { x: 880, y: 570, ang: -0.97 };
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
    L.guitaristKneel(c, t, { x: KNEEL.x, y: KNEEL.y, scale: KNEEL.s, hold: 'raise', rimColor: '#ffc27a', light: -Math.PI / 2 + 0.12, backlight: 0.55, glow: 0.9, rim: 1.5, wind: 0.25 });
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
  const GIRL15 = { x: 1268, y: 1262, s: 1.32, wind: 1.15, windDir: Math.PI - 0.05, seed: 11, weight: 0.55 };
  const BOY15 = { x: 1915, y: 1300, s: 1.36 };
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
  // her wide-brimmed white hat with a ribbon (seen from behind), placed on the library girl's head
  function girlHeadPos(t, o) {
    // mirrors girlAtRailing's rig (sway, lean, head tilt) so the hat sits on her head
    const tq = q12(t), Wd = o.wind, sgw = Math.sign(Math.cos(o.windDir)) || 1, seed = o.seed || 11, w = o.weight;
    const sway = 0.025 * N2(seed, tq * 0.35) + Wd * 0.012 * N2(seed + 3, tq * 1.2);
    const lean = sway + 0.02 * Wd * sgw, lam = lean - 0.035 * w, ht = (o.headTilt || 0) + 0.04 * sgw * Wd + lam * 0.6;
    const P = [0.1 * w, -3.78 + 0.03 * Math.abs(w)], N = [P[0] + Math.sin(lam) * 2.18, P[1] - Math.cos(lam) * 2.18];
    return { x: N[0] + Math.sin(ht) * 0.7, y: N[1] - Math.cos(ht) * 0.7, ht };
  }
  function hatBack(c, hx, hy, u, ht, t, wind) {
    c.save(); c.translate(hx, hy); c.rotate(ht * 0.8); c.scale(u, u);
    // ribbon tails first (behind the crown), fluttering downwind (to the left)
    const fl = (k) => 0.05 * Math.sin(t * 9 + k) * wind;
    c.fillStyle = '#5d7fb2';
    for (const [dy, len, k] of [[-0.42, 0.95, 0], [-0.36, 0.78, 1.7]]) {
      c.beginPath(); c.moveTo(-0.22, dy - 0.04); c.quadraticCurveTo(-0.55, dy - 0.06 + fl(k), -0.22 - len, dy + 0.03 + fl(k + 1) * 2);
      c.lineTo(-0.2 - len, dy + 0.11 + fl(k + 1) * 2); c.quadraticCurveTo(-0.55, dy + 0.06 + fl(k), -0.2, dy + 0.06); c.closePath(); c.fill();
    }
    // brim (wide ellipse, the top face lit by the high sun, the far edge glowing)
    const bg = c.createLinearGradient(0, -0.62, 0, -0.32); bg.addColorStop(0, '#fffaf0'); bg.addColorStop(0.55, '#ece6da'); bg.addColorStop(1, '#a9b4c4');
    c.fillStyle = bg; c.beginPath(); c.ellipse(0.02, -0.44, 0.98, 0.17, 0.0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(120,135,160,0.55)'; c.beginPath(); c.ellipse(0.02, -0.41, 0.98, 0.13, 0, 0, Math.PI); c.fill(); // underside sliver
    // crown (back is in shadow: cool), lit rim on top
    const cg = c.createLinearGradient(0, -0.86, 0, -0.42); cg.addColorStop(0, '#f6f1e6'); cg.addColorStop(0.4, '#cfd3d8'); cg.addColorStop(1, '#a3afc0');
    c.fillStyle = cg; c.beginPath(); c.moveTo(-0.4, -0.45); c.bezierCurveTo(-0.43, -0.9, 0.45, -0.92, 0.42, -0.45); c.closePath(); c.fill();
    c.fillStyle = '#4f72a8'; c.beginPath(); c.moveTo(-0.41, -0.47); c.quadraticCurveTo(0.01, -0.42, 0.43, -0.47); c.lineTo(0.42, -0.56); c.quadraticCurveTo(0.01, -0.51, -0.42, -0.56); c.closePath(); c.fill(); // band
    c.strokeStyle = 'rgba(255,253,245,0.95)'; c.lineWidth = 0.025; c.beginPath(); c.moveTo(-0.38, -0.66); c.bezierCurveTo(-0.3, -0.9, 0.3, -0.92, 0.4, -0.64); c.stroke();
    c.strokeStyle = 'rgba(255,253,245,0.8)'; c.lineWidth = 0.02; c.beginPath(); c.ellipse(0.02, -0.44, 0.98, 0.17, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.restore();
  }
  // him at the right edge, from behind: T-shirt, elbows on the rail, his left forearm along it (toward her)
  function boyBackRail(ctx, t, o) {
    const tq = q12(t), br = 0.014 * Math.sin(tq * 2.0), W0 = o.wind || 0;
    const P = [0, -4.08], Fr = (x, h) => [P[0] + x, P[1] - h];
    const SL = Fr(-0.8, 2.08 + br), SR = Fr(0.8, 2.08 + br), N = Fr(0, 2.38);
    const HC = [N[0] - 0.04, N[1] - 0.72], EL = [SL[0] - 0.3, o.railY + 0.15], WL = [EL[0] - 0.95, o.railY - 0.02];
    L.figureRender(ctx, o, null, (F) => {
      F.layer({ tone: 0.05, inner: 0.4 }, (c) => { limb(c, SL, EL, 0.19, 0.13, 0.17, 0.35); limb(c, EL, WL, 0.13, 0.085, 0.12, 0.5); ell(c, WL[0] - 0.08, WL[1] + 0.02, 0.16, 0.1); });
      F.layer({ tone: o.shirt || 0.12, toward: '#9aa6c4', inner: 0.2 }, (c) => {
        const fl = 0.04 * Math.min(1, W0) * Math.sin(tq * 7);
        const side = (sg) => [Fr(sg * 0.193, 2.8), Fr(sg * 0.21, 2.48), Fr(sg * 0.454, 2.44), Fr(sg * 0.667, 2.37), Fr(sg * 0.84, 2.3 + br), Fr(sg * 1.0, 2.18 + br), Fr(sg * (1.05 + fl), 1.98 + br),
          Fr(sg * (1.02 + fl), 1.7), Fr(sg * 0.66, 1.62), Fr(sg * 0.68, 1.3), Fr(sg * 0.62, 0.7), [...Fr(sg * (0.66 + fl), -0.1), 1]];
        blob(c, side(1).concat([Fr(0, -0.14)], side(-1).reverse()));
      });
      F.layer({ tone: 0.02, inner: 0.3 }, (c) => {
        limb(c, N, [HC[0], HC[1] + 0.3], 0.2, 0.18);
        c.save(); c.translate(HC[0], HC[1]); c.rotate(-0.06); c.scale(1.1, 1.12);
        ell(c, 0, 0.02, 0.44, 0.52);
        const wx = -0.06 * W0, sd = 5;
        const tip = (i, x, y, kk = 1, sh = 1) => { const n = N2(sd + i * 1.37, tq * 1.5); return [x + wx * kk * (1 + 0.5 * n), y - Math.abs(wx) * 0.2 * kk * Math.max(0, n), sh]; };
        blob(c, [tip(0, 0.04, -0.69, 0.6), [0.16, -0.645], [0.31, -0.585], tip(1, 0.43, -0.49, 0.6, 0), [0.49, -0.35], tip(11, 0.525, -0.2, 0.6, 0), [0.515, -0.05],
          [0.5, 0.13], [0.458, 0.3], tip(3, 0.39, 0.43, 1.1), [0.3, 0.37], tip(4, 0.2, 0.5, 1.25), [0.1, 0.4], tip(5, 0.0, 0.535, 1.3), [-0.1, 0.4],
          tip(6, -0.2, 0.5, 1.25), [-0.3, 0.37], tip(7, -0.39, 0.43, 1.1), [-0.458, 0.3], [-0.5, 0.13], [-0.515, -0.05], tip(12, -0.525, -0.2, 0.6, 0),
          [-0.49, -0.35], tip(9, -0.43, -0.49, 0.6, 0), [-0.3, -0.59], tip(13, -0.17, -0.66, 0.7), [-0.06, -0.655]]);
        c.restore();
      });
    });
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
    const go = { x: GIRL15.x, y: GIRL15.y, scale: GIRL15.s, railing: false, hands: 'rail', railY: -4.92, handSpread: 0.2, outfit: 'blouse',
      wind: GIRL15.wind, windDir: GIRL15.windDir, windLift: -0.08, weight: GIRL15.weight, hairLen: 2.9, seed: GIRL15.seed,
      light: -1.32, rimColor: '#fff4dc', rim: 1.5, backlight: 0.6, glow: 0.95, fill: '#2b3448' };
    L.girlAtRailing(ctx, t, go);
    const hp = girlHeadPos(t, { wind: GIRL15.wind, windDir: GIRL15.windDir, seed: GIRL15.seed, weight: GIRL15.weight });
    const u = 92 * GIRL15.s; hatBack(ctx, GIRL15.x + hp.x * u, GIRL15.y + (hp.y + 0.07) * u, u, hp.ht, t, GIRL15.wind);
    boyBackRail(ctx, t, { x: BOY15.x, y: BOY15.y, scale: BOY15.s, railY: (RAIL15 - BOY15.y) / (92 * BOY15.s), light: -1.4, rimColor: '#fff4dc', rim: 1.5, backlight: 0.6, glow: 0.95, fill: '#262e40', wind: 0.9 });
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
    setBloom(S, 0.42, 0.3);
    PM('end');
  } });
})();

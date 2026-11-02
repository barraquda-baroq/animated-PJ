/* ============================================================================
 * g09_silent_days — ACT5「檻」 C33–C36
 *   C33 彼の部屋（沈黙の日々）：右側に、人一人分の隙間
 *   C34 テーブル（俯瞰）：耳栓 → 左手で書く名前と雫 → 爪切り『パチン』
 *   C35 夜のソファ：寄りかかる頭 → 傷をなぞる指 → 指が絡む
 *   C36 記憶（叔母）：扉の光を背に去る後ろ姿 → 扉が閉まる
 * ========================================================================== */
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib || {}, W = PV.W, H = PV.H, TAU = Math.PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp, smooth = PV.smooth, N2 = PV.noise2;
  const has = (k) => typeof L[k] === 'function';

  /* ------------------------------------------------------------------ util */
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function grain(c, x0, y0, w, h, n, seed, col, a, sz) { // static speckle texture for painted surfaces
    const r = PV.rng(seed); c.save(); c.fillStyle = col;
    for (let i = 0; i < n; i++) { c.globalAlpha = a * (0.3 + 0.7 * r()); const s = sz * (0.5 + r()); c.fillRect(x0 + r() * w, y0 + r() * h, s, s); }
    c.restore();
  }
  function spline(c, pts, closed) { // Catmull-Rom through pts (appends to the current path)
    const n = pts.length, P = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    if (closed) c.closePath();
  }
  const blobP = (c, pts) => { c.beginPath(); spline(c, pts, true); c.fill(); };
  const mirrorPts = (half) => half.concat(half.slice().reverse().map(p => [-p[0], p[1]]));

  /* ======================================================================
   * The room (C33 day / C35 night). Camera behind the sofa, looking at the window wall.
   * ==================================================================== */
  const ROOM = { floorY: 640, winX0: 470, winX1: 1450, winY0: 96, winY1: 640, vpX: 960, vpY: 300,
    cols: [470, 715, 960, 1205, 1450], rows: [96, 277, 458, 640] };

  // back wall, window (lace closed, the sash grid behind it), drapes, floor — painted once
  function paintRoom(c, night) {
    const R = ROOM;
    c.fillStyle = PV.linGrad(c, 0, 0, W, 0, night
      ? [[0, '#151311'], [0.5, '#1d1a17'], [0.82, '#2c241c'], [1, '#231d17']]
      : [[0, '#463e35'], [0.25, '#655a4c'], [0.5, '#76695a'], [0.75, '#685c4e'], [1, '#463e35']]);
    c.fillRect(0, 0, W, R.floorY);
    c.save(); c.globalAlpha = night ? 0.05 : 0.06; c.fillStyle = night ? '#000' : '#2e2b28';
    for (let x = 0; x < W; x += 38) c.fillRect(x, 0, 2, R.floorY);
    c.restore();
    grain(c, 0, 0, W, R.floorY, 5000, 7, night ? '#000' : '#2e2b28', 0.08, 2);
    c.fillStyle = PV.linGrad(c, 0, 0, 0, 300, [[0, night ? '#070605' : '#2e2b28', 0.6], [1, '#2e2b28', 0]]); c.fillRect(0, 0, W, 300);
    // skirting board
    c.fillStyle = night ? '#100e0c' : '#43392f'; c.fillRect(0, R.floorY - 14, W, 14);
    c.fillStyle = night ? '#221d18' : '#7a6c5b'; c.fillRect(0, R.floorY - 14, W, 2);

    const wx0 = R.winX0, wx1 = R.winX1, wy0 = R.winY0, wy1 = R.winY1;
    c.fillStyle = night
      ? PV.linGrad(c, 0, wy0, 0, wy1, [[0, '#1a2030'], [0.6, '#1f2533'], [1, '#262628']])
      : PV.linGrad(c, 0, wy0, 0, wy1, [[0, '#f4ecdc'], [0.55, '#e6dac4'], [1, '#cdbfa6']]);
    c.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    // the sash grid behind the lace: soft dark bars (the cage)
    const tmp = PV.makeCanvas(W, H), b = tmp.ctx; b.fillStyle = night ? 'rgba(6,8,12,0.92)' : 'rgba(80,70,58,0.8)';
    for (const x of R.cols) b.fillRect(x - 11, wy0, 22, wy1 - wy0);
    for (const y of R.rows) b.fillRect(wx0, y - 11, wx1 - wx0, 22);
    c.save(); c.filter = 'blur(5px)'; c.drawImage(tmp.canvas, 0, 0); c.restore();
    // lace curtain: vertical folds, translucent
    c.save(); c.beginPath(); c.rect(wx0 - 30, wy0 - 10, wx1 - wx0 + 60, wy1 - wy0 + 10); c.clip();
    const r = PV.rng(31), fold = night ? '#000000' : '#6f624f';
    for (let x = wx0 - 30; x < wx1 + 30; x += 18) {
      const w = 18 + r() * 26, a = 0.12 + 0.16 * r();
      const g = c.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, PV.rgba(fold, 0)); g.addColorStop(0.5, PV.rgba(fold, a)); g.addColorStop(1, PV.rgba(fold, 0));
      c.fillStyle = g; c.fillRect(x, wy0, w, wy1 - wy0);
      if (!night && r() < 0.5) { c.fillStyle = PV.rgba('#fbf8f1', 0.10 + 0.1 * r()); c.fillRect(x + w * 0.6, wy0, 3 + r() * 4, wy1 - wy0); }
    }
    c.fillStyle = PV.rgba(night ? '#3a4152' : '#f6f3ec', night ? 0.25 : 0.5); c.fillRect(wx0 - 30, wy1 - 34, wx1 - wx0 + 60, 3);
    c.globalAlpha = night ? 0.12 : 0.18; c.strokeStyle = night ? '#5a6274' : '#ffffff'; c.lineWidth = 1.2;
    for (let x = wx0 - 20; x < wx1 + 20; x += 22) { c.beginPath(); c.arc(x, wy1 - 52, 9, 0, Math.PI); c.stroke(); }
    c.restore();
    // curtain box
    c.fillStyle = night ? '#100e0c' : '#5a5650'; c.fillRect(wx0 - 34, wy0 - 30, wx1 - wx0 + 68, 30);
    c.fillStyle = night ? '#1c1814' : '#7a746c'; c.fillRect(wx0 - 34, wy0 - 30, wx1 - wx0 + 68, 4);
    // heavy drapes bunched at both sides
    const drape = (x0, x1, side) => {
      const n = 7; c.save();
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n, xa = lerp(x0, x1, u0), xb = lerp(x0, x1, u1);
        const g = c.createLinearGradient(xa, 0, xb, 0);
        const base = night ? ['#141210', '#221d18', '#0d0b09'] : ['#3d342b', '#5e5143', '#2f2821'];
        g.addColorStop(0, base[2]); g.addColorStop(0.45 + 0.1 * Math.sin(i), base[1]); g.addColorStop(1, base[0]);
        c.fillStyle = g; c.beginPath(); c.moveTo(xa, wy0 - 26); c.lineTo(xb, wy0 - 26);
        c.quadraticCurveTo(xb + side * 6, (wy0 + wy1) / 2, xb + side * 10 * Math.sin(i * 2.1), wy1 + 4); c.lineTo(xa + side * 10 * Math.sin(i * 2.1 + 1), wy1 + 4);
        c.quadraticCurveTo(xa + side * 6, (wy0 + wy1) / 2, xa, wy0 - 26); c.closePath(); c.fill();
      }
      c.restore();
    };
    drape(wx0 - 70, wx0 + 120, 1); drape(wx1 - 120, wx1 + 70, -1);
    // floor: wooden planks converging to the vanishing point
    const fy = R.floorY;
    c.fillStyle = PV.linGrad(c, 0, fy, 0, H, night ? [[0, '#14110e'], [1, '#0c0a08']] : [[0, '#5c5144'], [0.5, '#4a4137'], [1, '#342e27']]);
    c.fillRect(0, fy, W, H - fy);
    c.save(); c.strokeStyle = night ? 'rgba(0,0,0,0.35)' : 'rgba(36,33,30,0.35)'; c.lineWidth = 1.4;
    for (let k = -30; k <= 30; k++) {
      const xb = R.vpX + k * 78, dx = (xb - R.vpX) / (fy - R.vpY);
      c.beginPath(); c.moveTo(xb, fy); c.lineTo(xb + dx * (H - fy), H); c.stroke();
    }
    c.restore();
    grain(c, 0, fy, W, H - fy, 3000, 9, night ? '#000' : '#2e2b28', 0.1, 2);
  }

  // window light on the floor: a widening patch with the sash grid's soft shadows (the cage)
  function paintFloorLight(c) {
    const R = ROOM, fy = R.floorY, yEnd = 1080;
    const proj = (x, y) => R.vpX + (x - R.vpX) * (y - R.vpY) / (fy - R.vpY);
    const tmp = PV.makeCanvas(W, H), g = tmp.ctx;
    g.beginPath(); g.moveTo(R.winX0 + 10, fy); g.lineTo(R.winX1 - 10, fy); g.lineTo(proj(R.winX1 + 120, yEnd), yEnd); g.lineTo(proj(R.winX0 - 120, yEnd), yEnd); g.closePath();
    g.fillStyle = PV.linGrad(g, 0, fy, 0, yEnd, [[0, '#f1e6d2', 0.8], [0.3, '#e2d5be', 0.42], [0.65, '#dccfb8', 0.0]]); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.lineCap = 'butt'; g.strokeStyle = 'rgba(0,0,0,0.9)';
    for (const x of R.cols) {
      const k = (x - R.vpX) * 1.18;
      g.lineWidth = 16; g.beginPath(); g.moveTo(x, fy); g.lineTo(R.vpX + k * (yEnd - R.vpY) / (fy - R.vpY), yEnd); g.stroke();
    }
    for (const yy of [fy + 46, fy + 128, fy + 262]) { g.lineWidth = 10 + (yy - fy) * 0.08; g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    c.save(); c.filter = 'blur(3.5px)'; c.drawImage(tmp.canvas, 0, 0); c.restore();
  }

  // the sofa seen from behind (fabric back panel, arms lower)
  const SOFA = { x0: 360, x1: 1560, top: 778, armTop: 850, armW: 96 };
  function sofaPath(c, S, bot) {
    c.beginPath(); c.moveTo(S.x0, bot); c.lineTo(S.x0 - 4, S.top + 40); c.bezierCurveTo(S.x0 - 6, S.top + 8, S.x0 + 16, S.top - 6, S.x0 + 60, S.top - 8);
    c.bezierCurveTo(S.x0 + 300, S.top - 14, S.x1 - 300, S.top - 14, S.x1 - 60, S.top - 8);
    c.bezierCurveTo(S.x1 - 16, S.top - 6, S.x1 + 6, S.top + 8, S.x1 + 4, S.top + 40); c.lineTo(S.x1, bot); c.closePath();
  }
  function paintSofa(c, night) {
    const S = SOFA, bot = H + 20;
    const col = night ? { body: '#1f1b17', dark: '#100d0b', edge: '#6b5640', top: '#30281f' } : { body: '#3a3129', dark: '#1f1a16', edge: '#c2b29a', top: '#6d5f4e' };
    for (const [ax, sg] of [[S.x0 - S.armW + 26, -1], [S.x1 - 26, 1]]) {
      c.save(); rr(c, ax, S.armTop, S.armW, bot - S.armTop, 30); c.fillStyle = PV.linGrad(c, 0, S.armTop, 0, bot, [[0, col.body], [1, col.dark]]); c.fill();
      c.clip(); c.fillStyle = PV.linGrad(c, 0, S.armTop, 0, S.armTop + 46, [[0, col.edge, night ? 0.28 : 0.45], [1, col.edge, 0]]); c.fillRect(ax, S.armTop, S.armW, 46);
      c.fillStyle = PV.rgba('#000000', 0.25); c.fillRect(sg < 0 ? ax + S.armW - 18 : ax, S.armTop, 18, bot - S.armTop);
      c.restore();
    }
    c.save(); sofaPath(c, S, bot);
    c.fillStyle = PV.linGrad(c, 0, S.top, 0, bot, [[0, col.body], [0.3, col.body], [1, col.dark]]); c.fill();
    c.clip();
    for (let i = 0; i < 3; i++) {
      const xa = lerp(S.x0, S.x1, i / 3), xb = lerp(S.x0, S.x1, (i + 1) / 3);
      const g = c.createLinearGradient(xa, 0, xb, 0); g.addColorStop(0, 'rgba(0,0,0,0.16)'); g.addColorStop(0.5, 'rgba(255,255,255,0.025)'); g.addColorStop(1, 'rgba(0,0,0,0.16)');
      c.fillStyle = g; c.fillRect(xa, S.top, xb - xa, bot - S.top);
    }
    grain(c, S.x0, S.top - 20, S.x1 - S.x0, bot - S.top + 20, 9000, 13, night ? '#000' : '#1f1d1a', 0.2, 1.6);
    c.fillStyle = PV.linGrad(c, 0, S.top - 14, 0, S.top + 34, [[0, col.top, 1], [0.3, col.edge, night ? 0.32 : 0.7], [0.55, col.edge, night ? 0.08 : 0.18], [1, col.edge, 0]]);
    c.fillRect(S.x0 - 10, S.top - 16, S.x1 - S.x0 + 20, 52);
    c.strokeStyle = night ? 'rgba(0,0,0,0.55)' : 'rgba(30,28,25,0.6)'; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(S.x0, S.top + 44); c.bezierCurveTo(S.x0 + 400, S.top + 40, S.x1 - 400, S.top + 40, S.x1, S.top + 44); c.stroke();
    c.lineWidth = 1.4; c.globalAlpha = 0.45;
    for (const u of [1 / 3, 2 / 3]) { const x = lerp(S.x0, S.x1, u); c.beginPath(); c.moveTo(x, S.top + 48); c.quadraticCurveTo(x + 4, S.top + 140, x, bot); c.stroke(); }
    c.restore();
  }
  // things on the sofa that peek over the back: the big cushion (right end) and, by day, the folded blanket (left end)
  function paintSofaProps(c, night) {
    const S = SOFA;
    c.save(); c.translate(S.x1 - 92, S.top - 46); c.rotate(0.16);
    const cg = c.createLinearGradient(-90, -70, 90, 70);
    cg.addColorStop(0, night ? '#4a3a2c' : '#6a5d4e'); cg.addColorStop(0.6, night ? '#2a221b' : '#463c32'); cg.addColorStop(1, night ? '#171310' : '#2c251f');
    c.fillStyle = cg; c.beginPath();
    c.moveTo(-96, -50); c.quadraticCurveTo(0, -74, 96, -54); c.quadraticCurveTo(110, 0, 98, 70); c.lineTo(-98, 70); c.quadraticCurveTo(-112, 0, -96, -50); c.closePath(); c.fill();
    c.strokeStyle = night ? 'rgba(255,200,140,0.22)' : 'rgba(236,222,200,0.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-94, -50); c.quadraticCurveTo(0, -72, 94, -53); c.stroke();
    c.restore();
    if (!night) { // the throw she wraps herself in at night, folded over the back at the left end
      c.save(); c.translate(S.x0 + 170, S.top - 4);
      const bg = c.createLinearGradient(0, -24, 0, 120); bg.addColorStop(0, '#8a7a66'); bg.addColorStop(0.3, '#66584a'); bg.addColorStop(1, '#2e2720');
      c.fillStyle = bg; c.beginPath();
      c.moveTo(-132, 10); c.bezierCurveTo(-128, -20, 120, -24, 136, 6); c.bezierCurveTo(142, 40, 140, 80, 132, 112); c.lineTo(-126, 116); c.bezierCurveTo(-134, 80, -136, 40, -132, 10); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(232,220,200,0.32)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-128, 2); c.bezierCurveTo(-110, -16, 110, -20, 132, 0); c.stroke();
      c.strokeStyle = 'rgba(20,16,12,0.35)'; c.lineWidth = 1.6;
      for (let k = 0; k < 9; k++) { const x = -110 + k * 28; c.beginPath(); c.moveTo(x, 4); c.quadraticCurveTo(x + 5, 56, x + 1, 112); c.stroke(); } // knit ribs
      c.restore();
    }
  }
  // floor lamp beside the sofa's right end (off by day, the only light at night)
  const LAMP = { x: 1722, shadeY: 438, shadeH: 92, rTop: 54, rBot: 76, footY: 812 };
  function paintLamp(c, on) {
    const P = LAMP;
    c.save();
    c.strokeStyle = on ? '#2a231c' : '#3a3632'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(P.x, P.shadeY + P.shadeH - 4); c.lineTo(P.x, P.footY); c.stroke();
    c.fillStyle = on ? '#1b1712' : '#33302c'; c.beginPath(); c.ellipse(P.x, P.footY, 46, 9, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(P.x - P.rTop, P.shadeY); c.lineTo(P.x + P.rTop, P.shadeY); c.lineTo(P.x + P.rBot, P.shadeY + P.shadeH); c.lineTo(P.x - P.rBot, P.shadeY + P.shadeH); c.closePath();
    const g = c.createLinearGradient(P.x - P.rBot, 0, P.x + P.rBot, 0);
    if (on) { g.addColorStop(0, '#d39a5c'); g.addColorStop(0.5, '#f6d6a2'); g.addColorStop(1, '#c48a50'); }
    else { g.addColorStop(0, '#4f463c'); g.addColorStop(0.5, '#6e6254'); g.addColorStop(1, '#463e35'); }
    c.fillStyle = g; c.fill();
    if (on) { c.fillStyle = 'rgba(255,240,210,0.55)'; c.beginPath(); c.ellipse(P.x, P.shadeY + P.shadeH, P.rBot, 8, 0, 0, TAU); c.fill(); }
    c.restore();
  }

  // wall clock (face cached, hands per frame). Ticks with the sound: 123.8 + n s (global time).
  function drawClock(c, x, y, r, Tglobal, night) {
    const face = PV.cached('g09_clockface' + (night ? 'N' : 'D'), 2 * r + 20, 2 * r + 20, (g) => {
      const cx = r + 10, cy = r + 10;
      g.fillStyle = night ? '#191714' : '#3e3b37'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
      g.fillStyle = night ? '#3b3630' : '#cfc9bc'; g.beginPath(); g.arc(cx, cy, r - 6, 0, TAU); g.fill();
      g.strokeStyle = night ? '#1c1a17' : '#5e5951'; g.lineCap = 'round';
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, k = i % 3 ? 15 : 19; g.lineWidth = i % 3 ? 1.5 : 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 11), cy + Math.sin(a) * (r - 11)); g.lineTo(cx + Math.cos(a) * (r - k), cy + Math.sin(a) * (r - k)); g.stroke(); }
    });
    c.drawImage(face, x - r - 10, y - r - 10);
    const tick = Math.floor(Tglobal - 123.8 + 1e-6), sec = (night ? 41 : 7) + tick;
    const kick = clamp((Tglobal - 123.8 - tick) / 0.06);
    const sa = (sec - 1 + PV.ease.outBack(kick)) / 60 * TAU - Math.PI / 2;
    const hh = night ? 1 : 2, mm = night ? 12 : 37;
    const ha = (hh + mm / 60) / 12 * TAU - Math.PI / 2, ma = mm / 60 * TAU - Math.PI / 2;
    c.save(); c.lineCap = 'round'; c.strokeStyle = night ? '#120f0d' : '#3e3b37';
    c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ha) * r * 0.48, y + Math.sin(ha) * r * 0.48); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ma) * r * 0.72, y + Math.sin(ma) * r * 0.72); c.stroke();
    c.strokeStyle = night ? '#4a2a22' : '#6a4a40'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - Math.cos(sa) * r * 0.18, y - Math.sin(sa) * r * 0.18); c.lineTo(x + Math.cos(sa) * r * 0.8, y + Math.sin(sa) * r * 0.8); c.stroke();
    c.fillStyle = c.strokeStyle; c.beginPath(); c.arc(x, y, 2.6, 0, TAU); c.fill();
    c.restore();
  }

  /* ---------------------------------------------------- seated figures (back view)
   * Drawn here (not with coupleSittingBack) so the two of them can sit a person's width apart, she can lean on his
   * shoulder and wear a blanket. Same light pipeline as the library (PV.lib.figureRender); her hair is hairLong.
   * Local units: 1u = 92px * scale, (0,0) = the seat under the person, y down. Only the part above the sofa back
   * (y < -1.8u) is ever seen. */
  const BODY = {
    him: mirrorPts([[-0.84, 0.3], [-0.86, -0.6], [-0.93, -1.25], [-0.96, -1.75], [-0.95, -2.05], [-0.9, -2.27], [-0.76, -2.42], [-0.52, -2.5], [-0.3, -2.6], [-0.19, -2.74], [-0.18, -3.1]]),
    her: mirrorPts([[-0.66, 0.3], [-0.68, -0.6], [-0.74, -1.25], [-0.77, -1.7], [-0.75, -1.97], [-0.69, -2.12], [-0.55, -2.22], [-0.36, -2.28], [-0.2, -2.37], [-0.125, -2.55], [-0.12, -2.86]]),
  };
  const HEAD = { him: [0, -3.4, 1.06], her: [0, -3.08, 1] };
  function boyHair(c, t, sd) { // back of his head: soft dome, a cowlick, pointed tufts over the nape (after figures.js)
    const tip = (i, x, y) => [x + 0.012 * N2(sd + i * 1.37, t * 1.1), y + 0.01 * N2(sd + 40 + i, t * 0.9)];
    blobP(c, [tip(0, 0.04, -0.69), [0.15, -0.66], tip(14, 0.235, -0.672), [0.31, -0.592], tip(1, 0.43, -0.49), [0.49, -0.35], tip(11, 0.525, -0.2), [0.515, -0.05],
      [0.5, 0.13], [0.458, 0.3], tip(3, 0.39, 0.43), [0.3, 0.37], tip(4, 0.2, 0.5), [0.1, 0.4], tip(5, 0.0, 0.535), [-0.1, 0.4],
      tip(6, -0.2, 0.5), [-0.3, 0.37], tip(7, -0.39, 0.43), [-0.458, 0.3], [-0.5, 0.13], [-0.515, -0.05], tip(12, -0.525, -0.2),
      [-0.49, -0.35], tip(9, -0.43, -0.49), [-0.3, -0.59], tip(13, -0.17, -0.672), [-0.06, -0.655]]);
  }
  // o: x,y (seat under the person), scale, who 'him'|'her', lean (rad, upper body about the hip; <0 = toward screen
  //    left), head: [x,y,tilt] override (local units), blanket 0..1, breathe, + figure light options
  function seatedBack(ctx, t, o) {
    if (!has('figureRender')) return null;
    const him = o.who === 'him', sc = o.scale || 1, u = 92 * sc;
    const lean = o.lean || 0, hip = [0, -0.25];
    const br = (o.breathe === undefined ? 1 : o.breathe) * 0.012 * Math.sin(t * (him ? 1.45 : 1.25) + (him ? 0.4 : 1.9));
    const rot = (p) => { const dx = p[0] - hip[0], dy = p[1] - hip[1], c = Math.cos(lean), s = Math.sin(lean); return [hip[0] + dx * c - dy * s, hip[1] + dx * s + dy * c]; };
    const H0 = HEAD[him ? 'him' : 'her'];
    const neckTop = rot([0, H0[1] + 0.5]);
    const hd = o.headDrop || 0, ht = lean + (o.headTilt || 0);
    const head = o.head || [neckTop[0] + Math.sin(ht) * (0.5 - hd), neckTop[1] - Math.cos(ht) * (0.5 - hd) - br * 0.5, ht];
    const fo = { x: o.x, y: o.y, scale: sc, style: 'silhouette', fill: o.fill, light: o.light, rimColor: o.rimColor, rim: o.rim, backlight: o.backlight, glow: o.glow, alpha: o.alpha };
    L.figureRender(ctx, fo, null, (F) => {
      F.layer({}, (c) => {
        c.save(); c.translate(hip[0], hip[1]); c.rotate(lean); c.translate(-hip[0], -hip[1]);
        blobP(c, BODY[him ? 'him' : 'her'].map(p => [p[0] * (1 + (p[1] < -2 ? br : 0)), p[1] - (p[1] < -2.1 ? br * 0.6 : 0)]));
        c.restore();
        c.save(); c.translate(neckTop[0], neckTop[1]); c.rotate((head[2] + lean) * 0.5);
        c.beginPath(); c.ellipse(0, -0.15, him ? 0.19 : 0.12, 0.42, 0, 0, TAU); c.fill(); c.restore();
        if (him) { c.save(); c.translate(head[0], head[1]); c.rotate(head[2]); c.scale(H0[2], H0[2]); c.beginPath(); c.ellipse(0, 0, 0.47, 0.55, 0, 0, TAU); c.fill(); boyHair(c, t, o.seed || 3); c.restore(); }
      });
      if (him && o.detail !== false) F.raw((c) => { // the collar of his shirt and the arms hanging beside the torso (barely there)
        c.save(); c.translate(hip[0], hip[1]); c.rotate(lean); c.translate(-hip[0], -hip[1]);
        c.globalCompositeOperation = 'source-atop'; c.lineCap = 'round';
        c.strokeStyle = 'rgba(255,240,220,0.07)'; c.lineWidth = 0.13; c.beginPath(); c.moveTo(-0.24, -2.66); c.quadraticCurveTo(0, -2.5, 0.24, -2.66); c.stroke();
        c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 0.03; c.beginPath(); c.moveTo(-0.25, -2.6); c.quadraticCurveTo(0, -2.46, 0.25, -2.6); c.stroke();
        c.strokeStyle = 'rgba(0,0,0,0.2)';
        for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * 0.7, -2.24); c.quadraticCurveTo(sg * 0.6, -2.04, sg * 0.62, -1.72); c.stroke(); }
        c.restore();
      });
      if (o.blanket) { // a blanket wrapped round her shoulders: lighter wool, soft folds, collar bunched at the neck
        F.layer({ tone: 0.34 * o.blanket, toward: o.blanketTone || '#8a7258', inner: 0.65 }, (c) => {
          c.save(); c.translate(hip[0], hip[1]); c.rotate(lean); c.translate(-hip[0], -hip[1]);
          blobP(c, [[-0.95, 0.3], [-0.98, -0.8], [-0.97, -1.55], [-0.93, -1.95], [-0.84, -2.2], [-0.62, -2.38], [-0.36, -2.5], [-0.14, -2.58], [0.05, -2.6], [0.3, -2.52], [0.58, -2.4], [0.82, -2.22], [0.93, -1.95], [0.98, -1.55], [0.99, -0.8], [0.96, 0.3]]);
          c.restore();
        });
        F.raw((c) => {
          c.save(); c.translate(hip[0], hip[1]); c.rotate(lean); c.translate(-hip[0], -hip[1]);
          c.globalCompositeOperation = 'source-atop'; c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.035; c.lineCap = 'round';
          for (const [x0, y0, x1, y1] of [[-0.8, -2.15, -0.7, -1.5], [-0.55, -2.32, -0.42, -1.6], [-0.2, -2.5, -0.1, -1.7], [0.3, -2.45, 0.22, -1.65], [0.62, -2.3, 0.5, -1.6], [0.85, -2.05, 0.8, -1.5]]) { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + 0.06, (y0 + y1) / 2, x1, y1); c.stroke(); }
          c.strokeStyle = 'rgba(255,214,160,0.16)'; c.lineWidth = 0.025; // the wool's lit ridges beside the folds
          for (const [x0, y0, x1, y1] of [[-0.74, -2.18, -0.64, -1.5], [0.68, -2.27, 0.57, -1.6], [0.9, -2.0, 0.86, -1.5]]) { c.beginPath(); c.moveTo(x0 + 0.05, y0); c.quadraticCurveTo((x0 + x1) / 2 + 0.11, (y0 + y1) / 2, x1 + 0.05, y1); c.stroke(); }
          c.restore();
        });
      }
    });
    if (!him && has('hairLong')) {
      L.hairLong(ctx, t, { x: o.x + head[0] * u, y: o.y + head[1] * u, scale: sc, style: 'silhouette', fill: o.fill, light: o.light, rimColor: o.rimColor, rim: o.rim, backlight: o.backlight, glow: o.glow, alpha: o.alpha,
        view: 'back', len: o.hairLen || 2.45, wind: 0, tilt: head[2], swing: -head[2] * 0.5, spread: 0.06, seed: o.seed || 8, sheen: o.sheen });
    }
    return { head: [o.x + head[0] * u, o.y + head[1] * u] };
  }

  /* ======================================================================
   * The room seen from the FRONT of the sofa (anime layout, C33 day / C35 night).
   * Same orthographic camera as PV.anime.pair (yaw = facing, pitch = camPitch), so the sofa, the floor and the light
   * patches sit exactly under the figures. Room space = pair space in her head units: x right (his side), y down,
   * z toward the front of the sofa (the big window is in the front wall, behind the camera). Seat top y=0, floor y=1.55.
   * ==================================================================== */
  const RM = { FY: 1.55, BZ: -1.35, LX: -7.4, RX: 11, FZ: 6.0,
    // the big window in the front wall (a three-panel 掃き出し窓 with a transom light above): its grid is cast into the room = the cage
    win: { x0: -6.69, x1: 4.98, y0: -9.0, y1: 1.2, mull: [-2.8, 1.09], tran: [-7.9], bar: 0.2 },
    Ld: [0.3, 0.6, -1],   // the direction the window light travels (right, down, back toward the back wall)
    sofa: { ax: 3.5, sx: 2.95, armY: -1.0, backY: -1.95, backZ0: -1.28, backZ1: -0.88, seatY: -0.02, seatZ: 0.98, seatBZ: -0.55, baseZ: 1.0,
      cushTopY: -1.72, cushTopZ: -0.86, legY: 1.3 },
    table: { x: -4.45, z: -0.45, r: 0.8, y: -0.72 } };
  function g9proj(facing, pitch, X, Y, s) {
    const B = PV.anime.__body, M = B.mm(B.rot(0, pitch, 0), B.rot(facing, 0, 0));
    const f = (x, y, z) => { const v = B.mv(M, [x, y, z]); return [X + v[0] * s, Y + v[1] * s, v[2]]; };
    f.s = s; f.M = M; f.X = X; f.Y = Y;
    f.n = (n) => B.mv(M, n);   // a direction in screen space (x, y, toward the camera)
    return f;
  }
  const poly = (c, P, pts) => { c.beginPath(); pts.forEach((p, i) => { const q = P(p[0], p[1], p[2]); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); };
  const LDN = (() => { const d = RM.Ld, l = Math.hypot(d[0], d[1], d[2]); return [-d[0] / l, -d[1] / l, -d[2] / l]; })();   // toward the light
  const lambert = (n) => { const l = Math.hypot(n[0], n[1], n[2]) || 1; return Math.max(0, (n[0] * LDN[0] + n[1] * LDN[1] + n[2] * LDN[2]) / l); };
  // a soft quad: corners a,b,c,d (3D, in order round the face) with each edge bowed by a 3D offset at its middle
  function softQuad(c, P, Q, bows, n = 10) {
    c.beginPath(); let first = true;
    for (let e = 0; e < 4; e++) {
      const A = Q[e], B = Q[(e + 1) % 4], bw = (bows && bows[e]) || [0, 0, 0];
      for (let i = 0; i < n; i++) {
        const u = i / n, k = Math.sin(Math.PI * u);
        const q = P(A[0] + (B[0] - A[0]) * u + bw[0] * k, A[1] + (B[1] - A[1]) * u + bw[1] * k, A[2] + (B[2] - A[2]) * u + bw[2] * k);
        if (first) { c.moveTo(q[0], q[1]); first = false; } else c.lineTo(q[0], q[1]);
      }
    }
    c.closePath();
  }

  // walls + floor, ambient-lit (the window's direct light is painted by litPass)
  function paintFrontRoom(c, P, night) {
    const { FY, BZ, LX, RX } = RM, top = -16;
    poly(c, P, [[LX, top, BZ], [RX, top, BZ], [RX, FY, BZ], [LX, FY, BZ]]);
    const a = P(0, -6, BZ), b = P(0, FY, BZ);
    c.fillStyle = PV.linGrad(c, 0, a[1], 0, b[1], night ? [[0, '#0d0b0a'], [0.7, '#161310'], [1, '#12100d']] : [[0, '#3f3a35'], [0.5, '#4e4841'], [1, '#4a443e']]);
    c.fill();
    c.save(); c.clip();
    c.globalAlpha = 0.045; c.fillStyle = '#1e1b18';
    for (let x = -200; x < W + 200; x += 34) c.fillRect(x, 0, 2, H);   // faint vertical wallpaper stripes
    c.globalAlpha = 1; grain(c, 0, 0, W, H, 6000, 7, '#1e1b18', night ? 0.06 : 0.08, 2);
    c.restore();
    // skirting board
    poly(c, P, [[LX, FY - 0.42, BZ + 0.01], [RX, FY - 0.42, BZ + 0.01], [RX, FY, BZ + 0.01], [LX, FY, BZ + 0.01]]);
    c.fillStyle = night ? '#0c0a09' : '#342e28'; c.fill();
    poly(c, P, [[LX, FY - 0.42, BZ + 0.02], [RX, FY - 0.42, BZ + 0.02], [RX, FY - 0.37, BZ + 0.02], [LX, FY - 0.37, BZ + 0.02]]);
    c.fillStyle = night ? '#1a1612' : '#5a4f43'; c.fill();
    // left wall (in shade: the window light runs away from it)
    poly(c, P, [[LX, top, BZ], [LX, top, 14], [LX, FY, 14], [LX, FY, BZ]]);
    const lw0 = P(LX, 0, BZ), lw1 = P(LX, 0, 5);
    c.fillStyle = PV.linGrad(c, lw0[0], 0, lw1[0], 0, night ? [[0, '#0b0a09'], [1, '#050404']] : [[0, '#36322d'], [1, '#26231f']]); c.fill();
    const k0 = P(LX, top, BZ), k1 = P(LX, FY, BZ);
    c.strokeStyle = night ? 'rgba(0,0,0,0.6)' : 'rgba(20,18,15,0.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(k0[0], k0[1]); c.lineTo(k1[0], k1[1]); c.stroke();
    // floor: wooden planks running front-to-back
    poly(c, P, [[LX, FY, BZ], [RX, FY, BZ], [RX, FY, 16], [LX, FY, 16]]);
    const f0 = P(0, FY, BZ), f1 = P(0, FY, 8);
    c.fillStyle = PV.linGrad(c, 0, f0[1], 0, f1[1], night ? [[0, '#100d0a'], [1, '#080605']] : [[0, '#3b332b'], [1, '#342c25']]); c.fill();
    c.save(); c.clip();
    const r = PV.rng(19); c.lineWidth = 1.3;
    for (let x = LX; x < RX; x += 0.52) {
      const tone = (r() - 0.5) * 0.08;
      poly(c, P, [[x, FY, BZ], [x + 0.52, FY, BZ], [x + 0.52, FY, 16], [x, FY, 16]]);
      c.fillStyle = tone > 0 ? `rgba(255,236,210,${tone})` : `rgba(0,0,0,${-tone})`; c.fill();
      const p0 = P(x, FY, BZ), p1 = P(x, FY, 16);
      c.strokeStyle = night ? 'rgba(0,0,0,0.45)' : 'rgba(20,16,12,0.34)'; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
      let z = BZ + r() * 3;
      while (z < 16) { const q0 = P(x, FY, z), q1 = P(x + 0.52, FY, z); c.beginPath(); c.moveTo(q0[0], q0[1]); c.lineTo(q1[0], q1[1]); c.stroke(); z += 3.2 + r() * 2.4; }
    }
    grain(c, 0, 0, W, H, 3000, 9, '#000', 0.08, 2);
    c.restore();
  }

  /* --- the sofa: soft BG-art cushions. Each piece = a face list {Q (4 corners), bows, n (normal), mat}; drawn far to near. */
  function sofaPieces(night) {
    const S = RM.sofa, F = RM.FY, out = [];
    const add = (Q, n, bows, k, name) => out.push({ Q, n, bows, k: k ?? 1, name });
    const third = (2 * S.sx) / 3;
    // back panel top (the frame behind the back cushions) and its front strip above the cushions
    add([[-S.ax, S.backY, S.backZ0], [S.ax, S.backY, S.backZ0], [S.ax, S.backY, S.backZ1], [-S.ax, S.backY, S.backZ1]], [0, -1, 0], [[0, -0.03, 0], 0, [0, -0.03, 0], 0], 0.95, 'backTop');
    add([[-S.ax, S.backY, S.backZ1], [S.ax, S.backY, S.backZ1], [S.ax, 0.2, S.backZ1], [-S.ax, 0.2, S.backZ1]], [0, 0, 1], null, 0.7, 'backFront');
    // back cushions, leaning back, puffy
    for (let i = 0; i < 3; i++) {
      const x0 = -S.sx + i * third + 0.02, x1 = -S.sx + (i + 1) * third - 0.02;
      add([[x0, S.cushTopY, S.cushTopZ], [x1, S.cushTopY, S.cushTopZ], [x1, S.cushTopY + 0.02, S.backZ1 - 0.05], [x0, S.cushTopY + 0.02, S.backZ1 - 0.05]], [0, -1, 0.15], [[0, -0.1, 0], 0, [0, -0.06, 0], 0], 1, 'cushTop' + i);
      add([[x0, S.seatY + 0.06, S.seatBZ], [x1, S.seatY + 0.06, S.seatBZ], [x1, S.cushTopY, S.cushTopZ], [x0, S.cushTopY, S.cushTopZ]], [0, -0.16, 0.99],
        [[0, 0, 0.06], [0.06, 0, 0.05], [0, -0.1, 0.05], [-0.06, 0, 0.05]], 1, 'cush' + i);
    }
    // the far arm (her side): top, inner face, front
    add([[-S.ax, S.armY, S.backZ0], [-S.sx, S.armY, S.backZ0], [-S.sx, S.armY, S.baseZ + 0.04], [-S.ax, S.armY, S.baseZ + 0.04]], [0, -1, 0], [0, [0.03, -0.05, 0], 0, [-0.03, -0.05, 0]], 1, 'armLTop');
    add([[-S.sx, S.armY, S.backZ1], [-S.sx, S.armY, S.baseZ + 0.04], [-S.sx, 0.5, S.baseZ + 0.04], [-S.sx, 0.5, S.backZ1]], [1, 0, 0], [[0.03, -0.04, 0], 0, 0, 0], 0.85, 'armLIn');
    add([[-S.ax, S.armY, S.baseZ + 0.04], [-S.sx, S.armY, S.baseZ + 0.04], [-S.sx, S.legY, S.baseZ + 0.04], [-S.ax, S.legY, S.baseZ + 0.04]], [0, 0, 1], [[0, -0.07, 0], 0, 0, 0], 1, 'armLF');
    // seat cushions: top + rounded front
    for (let i = 0; i < 3; i++) {
      const x0 = -S.sx + i * third + 0.015, x1 = -S.sx + (i + 1) * third - 0.015;
      add([[x0, S.seatY + 0.07, S.seatBZ], [x1, S.seatY + 0.07, S.seatBZ], [x1, S.seatY, S.seatZ], [x0, S.seatY, S.seatZ]], [0, -1, 0.05], [0, [0.04, 0, 0], [0, -0.03, 0.04], [-0.04, 0, 0]], 1, 'seat' + i);
      add([[x0, S.seatY, S.seatZ], [x1, S.seatY, S.seatZ], [x1, 0.5, S.seatZ], [x0, 0.5, S.seatZ]], [0, 0, 1], [[0, -0.02, 0.05], [0.03, 0, 0.02], [0, 0.03, 0.03], [-0.03, 0, 0.02]], 1, 'seatF' + i);
    }
    // base (plinth) under the seat cushions
    add([[-S.sx, 0.5, S.baseZ], [S.sx, 0.5, S.baseZ], [S.sx, S.legY, S.baseZ], [-S.sx, S.legY, S.baseZ]], [0, 0, 1], null, 0.62, 'base');
    return out;
  }
  function sofaNearPieces() {
    const S = RM.sofa, out = [], add = (Q, n, bows, k, name) => out.push({ Q, n, bows, k: k ?? 1, name });
    add([[S.ax, S.backY, S.backZ0], [S.ax, S.backY, S.backZ1], [S.ax, S.armY, S.backZ1], [S.ax, S.armY, S.backZ0]], [1, 0, 0], null, 0.7, 'backREnd');
    add([[S.ax, S.armY, S.backZ0], [S.ax, S.armY, S.baseZ + 0.04], [S.ax, S.legY, S.baseZ + 0.04], [S.ax, S.legY, S.backZ0]], [1, 0, 0], [[0.03, -0.05, 0], 0, 0, 0], 0.7, 'armROut');
    add([[S.sx, S.armY, S.backZ0], [S.ax, S.armY, S.backZ0], [S.ax, S.armY, S.baseZ + 0.04], [S.sx, S.armY, S.baseZ + 0.04]], [0, -1, 0], [0, [0.03, -0.05, 0], 0, [-0.03, -0.05, 0]], 1, 'armRTop');
    add([[S.sx, S.armY, S.baseZ + 0.04], [S.ax, S.armY, S.baseZ + 0.04], [S.ax, S.legY, S.baseZ + 0.04], [S.sx, S.legY, S.baseZ + 0.04]], [0, 0, 1], [[0, -0.07, 0], 0, 0, 0], 1, 'armRF');
    return out;
  }
  const SOFA_COL = { day: { amb: [58, 51, 45], lit: [150, 134, 116] }, night: { amb: [26, 22, 19], lit: [110, 86, 62] } };
  // ambient painting of pieces: tone by orientation (no direct light), occlusion toward the bottom, fabric grain
  function paintPieces(c, P, pieces, night) {
    const col = night ? SOFA_COL.night : SOFA_COL.day;
    for (const f of pieces) {
      const nv = P.n(f.n); if (nv[2] < -0.02) continue;
      const k = (0.3 + 0.25 * Math.max(0, -f.n[1]) + 0.12 * Math.max(0, f.n[2])) * f.k;
      const rgb = col.amb.map((v, i) => Math.round(v + (col.lit[i] - v) * Math.min(1, k * 0.55)));
      softQuad(c, P, f.Q, f.bows); c.fillStyle = `rgb(${rgb.join(',')})`; c.fill();
      c.save(); softQuad(c, P, f.Q, f.bows); c.clip();
      if (Math.abs(f.n[1]) < 0.5) { const q0 = P(...f.Q[0]), q2 = P(...f.Q[2]);
        c.fillStyle = PV.linGrad(c, 0, Math.min(q0[1], q2[1]), 0, Math.max(q0[1], q2[1]), [[0, '#000', 0], [0.6, '#000', 0.05], [1, '#000', night ? 0.4 : 0.28]]); c.fillRect(0, 0, W, H); }
      else { const q0 = P(...f.Q[0]), q2 = P(...f.Q[2]);   // tops: darker toward the back
        c.fillStyle = PV.linGrad(c, 0, Math.min(q0[1], q2[1]), 0, Math.max(q0[1], q2[1]), [[0, '#000', night ? 0.25 : 0.16], [1, '#000', 0]]); c.fillRect(0, 0, W, H); }
      c.restore();
      // edge: a dark seam all round (the gap between pieces), thin
      softQuad(c, P, f.Q, f.bows); c.strokeStyle = night ? 'rgba(0,0,0,0.5)' : 'rgba(22,18,15,0.42)'; c.lineWidth = 1.6; c.stroke();
    }
  }
  // the window's direct light on a set of planar surfaces (cast through the window grid), painted as a soft brightening.
  // surf: {Q (3D polygon on the plane), n (normal), bows?}. occl: blobs [x,y,r] in screen px cut from the light (cast shadows).
  function litPass(c, P, surfs, o) {
    o = o || {};
    const Wn = RM.win, d = RM.Ld, b2 = Wn.bar / 2;
    const tb = PV.makeCanvas(W, H), g = tb.ctx;
    for (const sf of surfs) {
      const N = sf.n, dn = d[0] * N[0] + d[1] * N[1] + d[2] * N[2]; if (dn >= -1e-6) continue;   // faces away from the light
      const Q0 = sf.Q[0], P0 = sf.plane || Q0;
      const onPlane = (wx, wy) => { const t = ((P0[0] - wx) * N[0] + (P0[1] - wy) * N[1] + (P0[2] - RM.FZ) * N[2]) / dn; return P(wx + d[0] * t, wy + d[1] * t, RM.FZ + d[2] * t); };
      const quad = (x0, y0, x1, y1) => { const a = onPlane(x0, y0), b = onPlane(x1, y0), e = onPlane(x1, y1), f = onPlane(x0, y1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(e[0], e[1]); g.lineTo(f[0], f[1]); g.closePath(); };
      g.save();
      if (sf.bows) softQuad(g, P, sf.Q, sf.bows); else poly(g, P, sf.Q);
      g.clip();
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);   // nearer surfaces hide the light behind them
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(255,255,255,${(sf.k ?? 1) * lambert(N)})`; quad(Wn.x0, Wn.y0, Wn.x1, Wn.y1); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
      for (const m of Wn.mull) { quad(m - b2, Wn.y0, m + b2, Wn.y1); g.fill(); }
      for (const tr of Wn.tran) { quad(Wn.x0, tr - b2, Wn.x1, tr + b2); g.fill(); }
      g.restore();
    }
    // cast shadows of the people (soft) cut from the light
    if (o.occl) { g.save(); g.globalCompositeOperation = 'destination-out'; for (const [x, y, rx, ry, a] of o.occl) { const rg = g.createRadialGradient(x, y, 0, x, y, rx); rg.addColorStop(0, `rgba(0,0,0,${a ?? 0.85})`); rg.addColorStop(0.65, `rgba(0,0,0,${(a ?? 0.85) * 0.7})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(x, y); g.scale(1, (ry || rx) / rx); g.translate(-x, -y); g.fillStyle = rg; g.fillRect(x - rx, y - rx, 2 * rx, 2 * rx); g.restore(); } g.restore(); }
    // soft edges (overcast light through the lace), then brighten
    const sb = PV.makeCanvas(W, H); sb.ctx.filter = `blur(${o.blur ?? 5}px)`; sb.ctx.drawImage(tb.canvas, 0, 0); sb.ctx.filter = 'none';
    sb.ctx.globalCompositeOperation = 'source-in'; sb.ctx.fillStyle = o.color || '#fff4e6'; sb.ctx.fillRect(0, 0, W, H);
    c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = o.soft ?? 0.9; c.drawImage(sb.canvas, 0, 0);
    c.globalCompositeOperation = 'screen'; c.globalAlpha = o.screen ?? 0.32; c.drawImage(sb.canvas, 0, 0); c.restore();
    return sb.canvas;
  }
  const wallSurfs = () => [
    { Q: [[RM.LX, -16, RM.BZ], [RM.RX, -16, RM.BZ], [RM.RX, RM.FY, RM.BZ], [RM.LX, RM.FY, RM.BZ]], n: [0, 0, 1], k: 1 },
    { Q: [[RM.LX, RM.FY, RM.BZ], [RM.RX, RM.FY, RM.BZ], [RM.RX, RM.FY, 16], [RM.LX, RM.FY, 16]], n: [0, -1, 0], k: 1 },
  ];
  const piecesAsSurfs = (pieces) => pieces.map(f => ({ Q: f.Q, n: f.n, bows: f.bows, k: 0.95 }));

  // the side table at her end of the sofa, the small table lamp (on at night) and the little desk clock
  function paintTableLamp(c, P, on) {
    const T = RM.table, F = RM.FY;
    const ell = (cx, y, cz, r, fill, stroke) => { c.beginPath(); for (let i = 0; i <= 32; i++) { const a = i / 32 * TAU, q = P(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); } };
    // contact shadow, legs, top
    c.save(); const sh = P(T.x, F, T.z); c.translate(sh[0], sh[1]); c.scale(1, 0.25); c.fillStyle = PV.radGrad(c, 0, 0, 0, T.r * P.s * 1.1, [[0, '#000', on ? 0.4 : 0.35], [1, '#000', 0]]); c.fillRect(-300, -300, 600, 600); c.restore();
    c.save(); c.strokeStyle = on ? '#0e0b09' : '#2a241e'; c.lineWidth = 5; c.lineCap = 'round';
    for (const a of [0.6, 2.2, 3.9, 5.3]) { const p = P(T.x + Math.cos(a) * T.r * 0.75, T.y + 0.08, T.z + Math.sin(a) * T.r * 0.75), q = P(T.x + Math.cos(a) * T.r * 0.82, F, T.z + Math.sin(a) * T.r * 0.82); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); }
    c.restore();
    ell(T.x, T.y + 0.07, T.z, T.r, on ? '#120e0b' : '#2c2621');
    ell(T.x, T.y, T.z, T.r, on ? '#241b13' : '#4a4038', on ? 'rgba(255,190,120,0.25)' : 'rgba(210,196,176,0.3)');
    // the lamp: a small ceramic base, a drum shade
    const lx = T.x - 0.15, lz = T.z - 0.15, b0 = T.y, b1 = T.y - 0.75, s0 = T.y - 0.62, s1 = T.y - 1.55, rTop = 0.42, rBot = 0.55;
    ell(lx, b0 - 0.02, lz, 0.28, on ? '#2a1d12' : '#5a5048');
    const pb = P(lx, b0, lz), pt = P(lx, b1, lz);
    c.fillStyle = on ? '#3a2a1c' : '#6a5f55'; c.beginPath(); c.ellipse((pb[0] + pt[0]) / 2, (pb[1] + pt[1]) / 2, 0.22 * P.s, Math.abs(pb[1] - pt[1]) / 2, 0, 0, TAU); c.fill();
    const L0 = P(lx - rBot, s0, lz), R0 = P(lx + rBot, s0, lz), L1 = P(lx - rTop, s1, lz), R1 = P(lx + rTop, s1, lz);
    c.beginPath(); c.moveTo(L1[0], L1[1]); c.lineTo(R1[0], R1[1]); c.lineTo(R0[0], R0[1]); c.lineTo(L0[0], L0[1]); c.closePath();
    const sg = c.createLinearGradient(L0[0], 0, R0[0], 0);
    if (on) { sg.addColorStop(0, '#c88d52'); sg.addColorStop(0.45, '#fbe0ae'); sg.addColorStop(1, '#b97a42'); }
    else { sg.addColorStop(0, '#6c6157'); sg.addColorStop(0.45, '#8f8274'); sg.addColorStop(1, '#5d544b'); }
    c.fillStyle = sg; c.fill();
    if (on) { const m = P(lx, s0, lz); c.fillStyle = 'rgba(255,238,200,0.7)'; c.beginPath(); c.ellipse(m[0], m[1], rBot * P.s * 0.93, rBot * P.s * 0.2, 0, 0, TAU); c.fill(); }
    c.strokeStyle = on ? 'rgba(90,50,20,0.6)' : 'rgba(40,35,30,0.5)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(L1[0], L1[1]); c.lineTo(R1[0], R1[1]); c.lineTo(R0[0], R0[1]); c.lineTo(L0[0], L0[1]); c.closePath(); c.stroke();
  }
  // the desk clock face (static) + hands (per frame); ticks with the SFX: 124.0 + n s
  const CLK = { x: -4.0, y: -1.02, z: -0.05, r: 0.3 };
  function drawDeskClock(c, P, Tglobal, night) {
    const { x, y, z, r } = CLK, ex = P.n([1, 0, 0]), ey = P.n([0, 1, 0]);
    const o = P(x, y, z), s = P.s;
    const pt = (u, v) => [o[0] + (ex[0] * u + ey[0] * v) * s, o[1] + (ex[1] * u + ey[1] * v) * s];   // the face plane (facing +z)
    const ring = (rr) => { c.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, q = pt(Math.cos(a) * rr, Math.sin(a) * rr); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.closePath(); };
    // body (a little depth toward the back), feet
    c.save(); c.translate(-ex[0] * 0.0, 0);
    const bk = P(x, y, z - 0.22); c.fillStyle = night ? '#0e0b09' : '#2e2924'; c.beginPath(); c.ellipse(bk[0], bk[1], r * s * 0.95, r * s * 1.02, 0, 0, TAU); c.fill();
    ring(r); c.fillStyle = night ? '#1c1612' : '#4a443d'; c.fill();
    ring(r * 0.86); c.fillStyle = night ? '#4a3a2a' : '#d6d0c4'; c.fill();
    c.strokeStyle = night ? '#1c1612' : '#5e5951'; c.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, p = pt(Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74), q = pt(Math.cos(a) * r * (i % 3 ? 0.66 : 0.6), Math.sin(a) * r * (i % 3 ? 0.66 : 0.6)); c.lineWidth = i % 3 ? 1 : 2; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); }
    const tick = Math.floor(Tglobal - 124.0 + 1e-6), sec = (night ? 41 : 7) + tick, kick = clamp((Tglobal - 124.0 - tick) / 0.06);
    const sa = (sec - 1 + PV.ease.outBack(kick)) / 60 * TAU - Math.PI / 2;
    const hh = night ? 1 : 2, mm = night ? 12 : 37;
    const ha = (hh + mm / 60) / 12 * TAU - Math.PI / 2, ma = mm / 60 * TAU - Math.PI / 2;
    const hand = (a, len, w, col, back) => { const p = pt(-Math.cos(a) * r * (back || 0), -Math.sin(a) * r * (back || 0)), q = pt(Math.cos(a) * r * len, Math.sin(a) * r * len); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); };
    hand(ha, 0.42, 2.6, night ? '#120f0d' : '#2e2b27'); hand(ma, 0.64, 2, night ? '#120f0d' : '#2e2b27'); hand(sa, 0.72, 1, night ? '#5a2a1e' : '#7a3a2c', 0.16);
    c.restore();
  }

  /* ======================================================================
   * C33 彼の部屋（沈黙の日々） 6.5s — static, very slow push-in.  The camera is the one of C22 / C42 (front-oblique,
   * facing -0.42, camPitch 0.2): the change of their places (she on his left → on his RIGHT with a person's gap → back on his
   * left) reads in the same frame.  The window (in the front wall, behind the camera) throws its grid on the back wall,
   * the sofa and the floor: the cage.  She stares at nothing (empty eyes, no highlight), says V12 with barely moving
   * lips; he looks at the empty seat between them, tired; after her line his head sinks a little more.
   * ==================================================================== */
  const C33V = { facing: -0.42, pitch: 0.2, X: 960, Y: 690, s: 138, ax: -0.05, az: -0.12, gap: 2.6 };
  PV.shot('C33', { draw(ctx, t, d, S) {
    const tt = clamp(t, -0.5, d + 0.5), T = 123.5 + t, A = PV.anime;
    const P = g9proj(C33V.facing, C33V.pitch, C33V.X, C33V.Y, C33V.s);
    const sofaP = sofaPieces(false), nearP = sofaNearPieces();
    const room = PV.cached('g09_frontRoomD', W, H, (c) => {
      paintFrontRoom(c, P, false);
      paintPieces(c, P, sofaP, false);
      litPass(c, P, wallSurfs().concat(piecesAsSurfs(sofaP)), {});
      paintTableLamp(c, P, false);
    });
    const near = PV.cached('g09_frontNearD', W, H, (c) => { paintPieces(c, P, nearP, false); litPass(c, P, piecesAsSurfs(nearP), {}); });
    ctx.save();
    PV.camera(ctx, { zoom: 1 + 0.045 * PV.ease.inOut(clamp(tt / d)), cx: 960, cy: 600 });
    ctx.drawImage(room, 0, 0);
    drawDeskClock(ctx, P, T, false);
    const an = P(C33V.ax, 0, C33V.az);
    A.pair(ctx, { pose: 'sit_side', x: an[0], y: an[1], scale: C33V.s, T, light: 'room_gray', facing: C33V.facing, camPitch: C33V.pitch, keyDir: -2.58, rimDir: -2.58,
      params: { side: 'right', gap: C33V.gap, seat: 'sofa', sofa: false },
      senpai: { outfit: 'home', head: { expr: 'empty', mouth: { shape: 'flat', open: 0.55 * A.mouth(T, 'senpai').open } } },
      boy: { outfit: 'year2', costume: { shoes: 'slipper' }, head: { expr: 'neutral', undereye: 0.3, eyes: { open: 0.62, look: [-0.4, 0.5] } } } });
    ctx.drawImage(near, 0, 0);
    ctx.restore();
  } });

  PV.shot('C33_old', { draw(ctx, t, d, S) {
    const tt = clamp(t, -0.5, d + 0.5), T = 123.5 + tt;
    // the room with the window light (and its lattice) on the floor baked in; the light's breathing stays on the window
    const room = PV.cached('g09_roomD2', W, H, (c) => { paintRoom(c, false); paintLamp(c, false); c.globalAlpha = 0.82; paintFloorLight(c); c.globalAlpha = 1; });
    const sofa = PV.cached('g09_sofaD', W, H, (c) => { paintSofa(c, false); paintSofaProps(c, false); });
    const sky = 0.93 + 0.07 * Math.sin(tt * 0.55 + 0.6) + 0.02 * N2(tt * 0.4, 3.1); // overcast light breathing (a cloud passing)
    ctx.save();
    PV.camera(ctx, { zoom: 1 + 0.045 * PV.ease.inOut(clamp(tt / d)), cx: 960, cy: 600 });
    ctx.drawImage(room, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.18 * (sky - 0.8) / 0.2;
    ctx.fillStyle = '#f4efe6'; ctx.fillRect(ROOM.winX0, ROOM.winY0, ROOM.winX1 - ROOM.winX0, ROOM.winY1 - ROOM.winY0); ctx.restore();
    drawClock(ctx, 1668, 236, 44, T, false);
    // him on the left, her on his RIGHT, a person's width apart
    const fo = { scale: 1.36, light: -1.62, rimColor: '#efe3cf', rim: 0.85, backlight: 0.24, glow: 0.24, fill: '#1e1915' };
    // acting: as her flat voice starts (123.9) her head turns a hair toward him — not to look at him; after the line lands,
    // his head sinks a little further
    const herTilt = 0.03 - 0.06 * PV.ease.inOut(clamp((tt - 0.35) / 1.1));
    const hisDrop = 0.09 + 0.07 * PV.ease.inOut(clamp((tt - 4.9) / 1.3));
    seatedBack(ctx, tt, Object.assign({}, fo, { who: 'him', x: 690, y: 935, seed: 5, headDrop: hisDrop, headTilt: -0.05 - 0.02 * PV.ease.inOut(clamp((tt - 4.9) / 1.3)) }));
    seatedBack(ctx, tt, Object.assign({}, fo, { who: 'her', x: 1240, y: 935, seed: 8, headTilt: herTilt }));
    ctx.drawImage(sofa, 0, 620, W, H - 620, 0, 620, W, H - 620);
    // their shadows on the backrest top (the window is in front of them); the empty seat lets the light through
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    for (const [x, w] of [[690, 170], [1240, 130]]) { // soft elliptical shadow (no hard edges)
      ctx.save(); ctx.translate(x, SOFA.top + 4); ctx.scale(1, 0.22);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
      g.addColorStop(0, 'rgba(60,50,42,0.9)'); g.addColorStop(0.6, 'rgba(60,50,42,0.45)'); g.addColorStop(1, 'rgba(60,50,42,0)');
      ctx.fillStyle = g; ctx.fillRect(-w, -w, 2 * w, 2 * w); ctx.restore();
    }
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.translate(965, SOFA.top); ctx.scale(1, 0.3);
    const gg = ctx.createRadialGradient(0, 0, 4, 0, 0, 220); gg.addColorStop(0, PV.rgba('#e6d9c2', 0.26 * sky)); gg.addColorStop(1, PV.rgba('#e6d9c2', 0));
    ctx.fillStyle = gg; ctx.fillRect(-220, -220, 440, 440); ctx.restore();
    // dust hanging in the flat light, barely moving
    if (has('dust')) L.dust(ctx, tt, { seed: 33, count: 46, x0: 420, x1: 1500, y0: 120, y1: 760, size: 2.2, alpha: 0.32, drift: 18, vx: 1.2, vy: 0.6, color: '#f3e8d6',
      mask: (x, y) => clamp(1 - Math.abs(x - 960) / 620) * clamp((780 - y) / 120) });
    ctx.restore();
  } });

  /* ======================================================================
   * C35 夜のソファ 6.0s — the lamp, her head on his shoulder (the gap closes only while she sleeps)
   *   → slow push-in → refocusing dissolve to the hands on their laps: his hand holds hers palm to palm while his thumb
   *   strokes the scar on the back of it → 140.0 (t=5.0) the stroking stops, his fingers fold down between hers
   * ==================================================================== */
  const C35 = { boyX: 834, girlX: 1010, seatY: 935, sc: 1.36 };
  function paintLampGlow(c) { // the lamp's light on the wall: a warm pool, soft cones up and down out of the drum shade
    const P = LAMP, t2 = PV.makeCanvas(W, H), b = t2.ctx;
    let g = b.createRadialGradient(P.x, P.shadeY + 40, 20, P.x, P.shadeY + 40, 820);
    g.addColorStop(0, 'rgba(232,184,120,0.42)'); g.addColorStop(0.3, 'rgba(201,138,78,0.17)'); g.addColorStop(1, 'rgba(201,138,78,0)');
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    for (const [y0, y1, a, up] of [[P.shadeY - 360, P.shadeY, 0.2, true], [P.shadeY + P.shadeH, P.shadeY + P.shadeH + 420, 0.26, false]]) {
      const cg = b.createLinearGradient(0, up ? y1 : y0, 0, up ? y0 : y1); cg.addColorStop(0, PV.rgba('#f2c890', a)); cg.addColorStop(1, PV.rgba('#f2c890', 0));
      b.fillStyle = cg; b.beginPath();
      if (up) { b.moveTo(P.x - P.rTop, y1); b.lineTo(P.x + P.rTop, y1); b.lineTo(P.x + P.rTop + 170, y0); b.lineTo(P.x - P.rTop - 170, y0); }
      else { b.moveTo(P.x - P.rBot, y0); b.lineTo(P.x + P.rBot, y0); b.lineTo(P.x + P.rBot + 220, y1); b.lineTo(P.x - P.rBot - 220, y1); }
      b.closePath(); b.fill();
    }
    c.save(); c.globalCompositeOperation = 'screen'; c.filter = 'blur(22px)'; c.drawImage(t2.canvas, 0, 0); c.restore();
  }
  function c35Room(ctx, tt) {
    const room = PV.cached('g09_roomN', W, H, (c) => { paintRoom(c, true); paintLampGlow(c); paintLamp(c, true); });
    const sofa = PV.cached('g09_sofaN2', W, H, (c) => { paintSofa(c, true); paintSofaProps(c, true);
      // the back of the sofa faces away from the lamp: it sinks into the dark toward the left (keeps the eye on the two)
      c.globalCompositeOperation = 'source-atop';
      const sf = c.createLinearGradient(SOFA.x0 - 100, 0, LAMP.x, 0); sf.addColorStop(0, 'rgba(0,0,0,0.66)'); sf.addColorStop(0.55, 'rgba(0,0,0,0.5)'); sf.addColorStop(1, 'rgba(0,0,0,0.04)');
      c.fillStyle = sf; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; });
    ctx.drawImage(room, 0, 0);
    drawClock(ctx, 1668, 236, 44, 135 + tt, true);
    // faint cold city glow through the lace (the outside is still there)
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5;
    const wg = ctx.createLinearGradient(0, ROOM.winY1, 0, ROOM.winY0); const g0 = wg; g0.addColorStop(0, 'rgba(70,86,120,0.35)'); g0.addColorStop(1, 'rgba(70,86,120,0)');
    ctx.fillStyle = g0; ctx.fillRect(ROOM.winX0, ROOM.winY0, ROOM.winX1 - ROOM.winX0, ROOM.winY1 - ROOM.winY0); ctx.restore();
    // the two of them: she has slid against his shoulder, wrapped in the blanket
    const settle = PV.ease.inOut(clamp((tt - 0.15) / 0.85));                  // 135.15–136.0 blanket rustle: her head finds his shoulder
    const u = 92 * C35.sc;
    const fo = { scale: C35.sc, light: -0.22, rimColor: '#f3c992', rim: 1.0, backlight: 0.22, glow: 0.35, fill: '#120e0b' };
    const hisTilt = 0.1 * PV.ease.inOut(clamp((tt - 1.3) / 1.2));             // he leans his head toward her
    seatedBack(ctx, tt, Object.assign({}, fo, { who: 'him', x: C35.boyX, y: C35.seatY, seed: 5, headTilt: hisTilt, headDrop: 0.05, breathe: 0.8 }));
    // her head: from just nodding off (upright) to resting on his right shoulder
    const restHead = [(C35.boyX + 0.62 * u * 1.0 - C35.girlX) / u, -2.83, -0.82];
    const upHead = [-0.08, -3.02, -0.18];
    const head = [lerp(upHead[0], restHead[0], settle), lerp(upHead[1], restHead[1], settle) + 0.012 * Math.sin(tt * 1.1), lerp(upHead[2], restHead[2], settle)];
    seatedBack(ctx, tt, Object.assign({}, fo, { who: 'her', x: C35.girlX, y: C35.seatY, seed: 8, lean: lerp(-0.04, -0.15, settle), head, blanket: 0.75, blanketTone: '#a0744a', breathe: 0.6, sheen: 0.4, backlight: 0.12 }));
    ctx.drawImage(sofa, 0, 620, W, H - 620, 0, 620, W, H - 620);
    // lamp light grazing the sofa's right arm / cushion
    ctx.save(); ctx.globalCompositeOperation = 'screen'; let g = ctx.createRadialGradient(1700, 700, 10, 1700, 700, 520);
    g.addColorStop(0, 'rgba(232,184,120,0.2)'); g.addColorStop(1, 'rgba(232,184,120,0)'); ctx.fillStyle = g; ctx.fillRect(1180, 180, 740, 900); ctx.restore();
  }
  // L.handsInterlock, re-assembled here with one hook: her scars are re-stated (value contrast, see scarRidge) right
  // after her palm is drawn, so his thumb and fingers still pass OVER them.  Same geometry/params as the library.
  function interlock(ctx, o) {
    const HM = L._handMath, Vv = HM.V, add = HM.add, sub = HM.sub, M = HM.M;
    const tr3 = A => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
    const toLocal = (Mh, Th, mir, q) => { const v = M.ap(tr3(Mh), sub(q, Th)); return Vv(v.x * mir, v.y, v.z); };
    const model = L._handModel, solveFinger = L._handSolveFinger, solveThumb = L._handSolveThumb;
    const m = L._handMatOf(ctx), t = o.t || 0, sc = o.scale || 2.4, sq = o.squeeze == null ? 0.6 : o.squeeze;
    const Mv = L._handLookCam(o.az == null ? -0.3 : o.az, o.el == null ? -0.1 : o.el, 0);
    const fM = model('her'), bM = model('him'), mirF = 1, mirB = -1, va = o.vee == null ? 0.2 : o.vee;
    const MhF = M.mul(M.rz(va), M.cols(Vv(-1, 0, 0), Vv(0, -1, 0), Vv(0, 0, 1)));
    const MhB = M.mul(M.rz(-va), M.cols(Vv(1, 0, 0), Vv(0, -1, 0), Vv(0, 0, -1)));
    const toW = (Mh, Th, mir, p) => add(M.ap(Mh, Vv(p.x * mir, p.y, p.z)), Th);
    const zF = 15, zB = zF - 36 + 4 * sq;
    const ThF = sub(Vv(0, 0, zF), toW(MhF, Vv(0, 0, 0), mirF, fM.fingers[1].mcp));
    const ThB = sub(Vv(10.5, 4, zB), toW(MhB, Vv(0, 0, 0), mirB, bM.fingers[1].mcp));
    const wob = (i, k) => 0.025 * PV.noise2(t * 0.6 + i * 3.1, k * 1.7);
    const fX = fM.fingers.map(f => f.mcp.x), bPose = { F: [], T: null }, fPose = { F: [], T: null };
    const bSpl = [-0.16, -0.04, 0.08, 0.2], fSpl = [-0.2, -0.06, 0.08, 0.24];
    const tipY = o.tipY, tipZ = o.tipZ - 2 * sq;
    for (let i = 0; i < 4; i++) {
      const gx = i > 0 ? (fX[i - 1] + fX[i]) / 2 : fX[0] - (fX[1] - fX[0]) * 0.55;
      const tw = toW(MhF, ThF, mirF, Vv(gx, tipY[i] + 2 * PV.noise2(t * 0.4, i * 2.3), tipZ));
      const sb = solveFinger(bM.fingers[i], toLocal(MhB, ThB, mirB, tw), { splay: bSpl[i], a0: 1.0, b0: 1.5, aMin: 0.2, aMax: 1.6, bMin: 0.6, bMax: 2.1, dip: 0.6 });
      sb.flex = sb.flex.map((v, k) => v + wob(i + 9, k)); bPose.F.push(sb);
      const tw2 = toW(MhB, ThB, mirB, Vv(bM.fingers[i].mcp.x + (i < 3 ? 10 : 6), -72, 18));
      const sf = solveFinger(fM.fingers[i], toLocal(MhF, ThF, mirF, tw2), { splay: fSpl[i], a0: 0.8, b0: 1.5, aMin: 0.1, aMax: 1.6, bMin: 0.6, bMax: 2.1, dip: 0.6 });
      sf.flex = sf.flex.map((v, k) => v + wob(i, k)); fPose.F.push(sf);
    }
    // his thumb lies on the back of her hand along the scar; o.trace (-1..1) strokes it up and down the scar
    const trw = o.trace || 0;
    const thT = toW(MhF, ThF, mirF, Vv(-14 + 3 * trw, -46 + 14 * trw, 20));
    bPose.T = solveThumb(bM.thumb, toLocal(MhB, ThB, mirB, thT), { abd: 0.7, opp: 1.0, flex: [0.4, 0.3] });
    fPose.T = solveThumb(fM.thumb, toLocal(MhF, ThF, mirF, toW(MhB, ThB, mirB, Vv(-26, -58, 18))), { abd: 0.6, opp: 0.9, flex: [0.3, 0.3] });
    const look = Vv(4, 20, 0);
    const common = { scale: sc, x: o.x, y: o.y, rot: o.rot || 0, camera: Mv, focal: 1100, _m: m, light: o.light, t, arm: o.arm == null ? 330 : o.arm, keyColor: o.keyColor, fillColor: o.fillColor, tint: o.tint };
    const rigF = L.handRig(Object.assign({}, common, { side: 'R', kind: 'her', pose: fPose, handMatrix: MhF, handPos: sub(ThF, look), split: { 1: 1, 2: 1, 3: 1, 4: 1 }, surgicalScars: true, sleeve: o.herSleeve, sleeveAt: 34 }));
    const rigB = L.handRig(Object.assign({}, common, { side: 'L', kind: 'him', pose: bPose, handMatrix: MhB, handPos: sub(ThB, look), split: { 0: 2, 1: 1, 2: 1, 3: 1, 4: 1 }, thumbScar: true, sleeve: o.hisSleeve, sleeveAt: 44 }));
    rigB.o.depthFn = (it) => (it.kind === 'thumb' ? 200 + it.depth : null);
    L.handRender(ctx, [rigB, rigF], { pad: 30, after: (c, it) => { if (it.rig === rigF && it.kind === 'palm') herScars(c, rigF); } });
    return { her: rigF, him: rigB };
  }
  function paintLap(c) { // looking down over their shoulders at their laps: his dark trousers (left), the wool blanket over hers (right)
    c.fillStyle = PV.linGrad(c, 0, H, W, 0, [[0, '#0b0806'], [0.5, '#241910'], [1, '#43301e']]); c.fillRect(0, 0, W, H);
    const t2 = PV.makeCanvas(W, H), b = t2.ctx;
    // his thigh: a broad dark form from the bottom left, a dull sheen along its top
    b.fillStyle = PV.linGrad(b, 0, 1080, 700, 300, [[0, '#090706'], [0.7, '#15100c'], [1, '#1f1812']]);
    b.beginPath(); b.moveTo(-60, 1140); b.bezierCurveTo(-40, 700, 260, 380, 640, 300); b.bezierCurveTo(760, 280, 820, 360, 760, 470); b.bezierCurveTo(640, 700, 560, 900, 600, 1140); b.closePath(); b.fill();
    b.strokeStyle = 'rgba(255,190,120,0.05)'; b.lineWidth = 30; b.beginPath(); b.moveTo(120, 760); b.bezierCurveTo(260, 520, 460, 380, 680, 330); b.stroke();
    // the blanket over her lap: a dark wool mass from the bottom right up past the hands; only its folds catch the lamp
    const blanket = (g) => { g.beginPath(); g.moveTo(560, 1140); g.bezierCurveTo(520, 900, 600, 640, 700, 420); g.bezierCurveTo(780, 250, 980, 130, 1300, 90); g.bezierCurveTo(1600, 60, 1900, 80, 1990, 120); g.lineTo(1990, 1140); g.closePath(); };
    blanket(b); b.fillStyle = PV.linGrad(b, 700, 1080, 1700, 120, [[0, '#1b120b'], [0.5, '#2e2015'], [0.85, '#3f2c1b'], [1, '#33241a']]); b.fill();
    b.save(); blanket(b); b.clip();
    const folds = [[[640, 1100], [820, 760], [1000, 520], [1260, 240]], [[880, 1120], [1080, 820], [1300, 560], [1600, 260]], [[1160, 1140], [1380, 880], [1560, 640], [1880, 380]], [[1500, 1140], [1680, 960], [1820, 820], [2000, 700]]];
    for (const f of folds) for (const [dx, dy, col, w] of [[24, -12, 'rgba(255,190,120,0.075)', 46], [-26, 16, 'rgba(6,4,2,0.3)', 70]]) {
      b.strokeStyle = col; b.lineWidth = w; b.lineCap = 'round'; b.beginPath(); b.moveTo(f[0][0] + dx, f[0][1] + dy); b.bezierCurveTo(f[1][0] + dx, f[1][1] + dy, f[2][0] + dx, f[2][1] + dy, f[3][0] + dx, f[3][1] + dy); b.stroke();
    }
    b.restore();
    // the blanket's draped edge between their laps catches a thread of lamp light
    b.strokeStyle = 'rgba(255,196,130,0.16)'; b.lineWidth = 7; b.beginPath(); b.moveTo(566, 1100); b.bezierCurveTo(530, 900, 604, 640, 704, 424); b.bezierCurveTo(782, 256, 980, 136, 1300, 96); b.stroke();
    c.save(); c.filter = 'blur(12px)'; c.drawImage(t2.canvas, 0, 0); c.restore();
    grain(c, 0, 0, W, H, 12000, 21, '#000', 0.08, 3);
    // the lamp, far behind and above (beyond her knees), as soft discs + its warm wash
    c.save(); c.globalCompositeOperation = 'screen';
    const bk = PV.makeCanvas(W, H), bb = bk.ctx; bb.globalCompositeOperation = 'lighter';
    for (const [x, y, r, a] of [[1660, 120, 92, 0.13], [1800, 250, 62, 0.1], [1530, 60, 48, 0.09], [1880, 70, 40, 0.07]]) {
      const g = bb.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,200,130,${a})`); g.addColorStop(0.82, `rgba(255,206,140,${a * 1.2})`); g.addColorStop(1, 'rgba(255,210,150,0)');
      bb.fillStyle = g; bb.beginPath(); bb.arc(x, y, r, 0, TAU); bb.fill();
    }
    c.filter = 'blur(5px)'; c.drawImage(bk.canvas, 0, 0); c.filter = 'none';
    const g = c.createRadialGradient(1700, 80, 40, 1700, 80, 1300); g.addColorStop(0, 'rgba(240,186,118,0.3)'); g.addColorStop(0.5, 'rgba(240,186,118,0.06)'); g.addColorStop(1, 'rgba(240,186,118,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
    const v = c.createRadialGradient(1000, 520, 300, 1000, 520, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }
  function c35Hands(ctx, tt) {
    const bg = PV.cached('g09_c35lap', W, H, paintLap);
    ctx.drawImage(bg, 0, 0);
    if (!has('handRig')) return;
    // until 140.0 his hand only holds hers, palm to palm, fingers straight up behind her knuckles, while his thumb
    // strokes the scar on the back of her hand.  140.0 (t=5.0): the stroking stops, his fingers fold down between
    // hers onto her knuckles and the clasp tightens (原作4426「傷をなぞる動きを止めて、指を。互いの指を絡ませた。」)
    const lace = PV.ease.inOutCubic(clamp((tt - 5.0) / 0.5));
    const strokeT = Math.min(tt, 5.0 + 0.2 * PV.ease.outQuad(clamp((tt - 5.0) / 0.4)));
    const trace = Math.sin((strokeT - 2.6) * 2.2) * (1 - 0.6 * lace);           // the thumb runs back and forth along the scar
    const sq = 0.1 + 0.78 * lace + 0.025 * Math.sin(tt * 2.1) * lace;
    const press = 7 * lace;                                                     // the clasp sinks a little into her lap as he tightens
    const tY0 = [-104, -110, -108, -100], tY1 = [-84, -92, -91, -87];
    const ho = { x: 930, y: 470 + press, scale: 2.75, t: tt, rot: Math.PI + 0.2, vee: -0.3, el: 0.35, arm: 360,
      squeeze: sq, tipZ: lerp(-14, 21, lace), tipY: tY0.map((v, i) => lerp(v, tY1[i], lace)), trace, light: -0.45, keyColor: '#eaa868', fillColor: '#3a2a1e', tint: 0.72,
      herSleeve: '#6a5d50', hisSleeve: '#211a15' };
    // soft contact shadow on the wool (the lamp is up and to the right)
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.translate(860, 650 + press); ctx.rotate(-0.25); ctx.scale(1, 0.55);
    const sg = ctx.createRadialGradient(0, 0, 20, 0, 0, 420); sg.addColorStop(0, 'rgba(40,26,16,0.7)'); sg.addColorStop(1, 'rgba(40,26,16,0)');
    ctx.fillStyle = sg; ctx.fillRect(-420, -420, 840, 840); ctx.restore();
    interlock(ctx, ho);
    // lamp falloff across the hands: lit from the upper right, his side sinks into the dark
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    const fg = ctx.createLinearGradient(1500, 150, 450, 1000); fg.addColorStop(0, 'rgba(255,255,255,1)'); fg.addColorStop(0.5, 'rgba(228,208,188,1)'); fg.addColorStop(1, 'rgba(100,78,62,1)');
    ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(1320, 240, 30, 1320, 240, 760);
    g.addColorStop(0, 'rgba(255,206,150,0.14)'); g.addColorStop(1, 'rgba(255,206,150,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    if (has('dust')) L.dust(ctx, tt, { seed: 51, count: 26, x0: 900, x1: 1900, y0: 0, y1: 700, size: 2.4, alpha: 0.35, drift: 22, vx: -2, vy: 1.5, color: '#ffd9a8' });
  }
  PV.shot('C35', { draw(ctx, t, d) {
    const tt = clamp(t, -0.5, d + 0.5);
    const X0 = 2.35, X1 = 3.05, mixK = PV.ease.inOut(clamp((tt - X0) / (X1 - X0)));
    // stage 1: the backs, pushing in toward the place where she rests on him / stage 2: the hands (comes into focus
    // through the dissolve, keeps creeping in, a last small push as the fingers lace at 140.0)
    const p1 = PV.ease.inOutCubic(clamp(tt / X1)), q2 = clamp((tt - X0) / (d - X0));
    const st1 = (c) => { PV.camera(c, { zoom: 1.03 + 0.34 * p1, cx: lerp(990, 930, p1), cy: lerp(620, 700, p1) }); c35Room(c, tt); };
    const st2 = (c) => { PV.camera(c, { zoom: 1.0 + 0.07 * PV.ease.inOut(q2) + 0.012 * PV.ease.inOutCubic(clamp((tt - 5.0) / 0.9)), cx: 930, cy: 500 }); c35Hands(c, tt); };
    // the dissolve with a refocus: a stage that is being defocused is rendered at half resolution, blurred, mixed
    const half = (key, fn, blur, alpha) => {
      const a = PV.buffer(key + 'a', W / 2, H / 2), b = PV.buffer(key + 'b', W / 2, H / 2);
      a.ctx.clearRect(0, 0, W / 2, H / 2); a.ctx.save(); a.ctx.scale(0.5, 0.5); fn(a.ctx); a.ctx.restore();
      b.ctx.clearRect(0, 0, W / 2, H / 2); b.ctx.filter = 'blur(' + blur.toFixed(2) + 'px)'; b.ctx.drawImage(a.canvas, 0, 0); b.ctx.filter = 'none';
      ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(b.canvas, 0, 0, W, H); ctx.restore();
    };
    const full = (fn, alpha) => { ctx.save(); ctx.globalAlpha = alpha; fn(ctx); ctx.restore(); };
    if (mixK < 1) { const bl = mixK * 4.5; if (bl < 0.6) full(st1, 1); else half('g09_c35h1', st1, bl, 1); }
    if (mixK > 0) { const bl = (1 - mixK) * 4; if (bl < 0.1) full(st2, mixK); else half('g09_c35h2', st2, bl, mixK); }
  } });

  /* ======================================================================
   * C36 記憶（叔母） 3.5s — the dark room, the door's warm light, a woman's back walking out.
   *   The door closer swings the door shut; the strip of light thins and is gone at 144.0 (t=3.0, the door SFX).
   * ==================================================================== */
  const DOOR = { x0: 834, x1: 1086, y0: 196, y1: 846, vpX: 968, vpY: 470, f: 900 };
  // door leaf open angle (rad): ajar (~69°, a gap rather than a wide-open door) while she speaks and walks away; at
  // 2.15 (143.15, 「好きになりなさい」) the closer swings it home: it eases off, then lands with speed at t=3.0 = 144.00,
  // exactly on the door SFX thump (sfx_plan: door@144.0)
  const DOOR_SHUT = 3.0;
  const doorAng = (t) => { const k = clamp((t - 2.15) / (DOOR_SHUT - 2.15)); return 1.2 * (1 - k * k * (2 - k)); };
  function doorGap(t) { // projected free edge of the leaf (hinged on the left jamb, opening away from us)
    const D = DOOR, a = Math.max(0, doorAng(t)), w = D.x1 - D.x0;
    const z = Math.sin(a) * w, x = D.x0 + Math.cos(a) * w, k = D.f / (D.f + z);
    return { xt: D.vpX + (x - D.vpX) * k, yt: D.vpY + (D.y0 - D.vpY) * k, xb: D.vpX + (x - D.vpX) * k, yb: D.vpY + (D.y1 - D.vpY) * k, a };
  }
  function hallway(c) { // the bright corridor beyond the door (overexposed, warm), painted once
    const D = DOOR;
    c.fillStyle = PV.linGrad(c, 0, D.y0, 0, D.y1, [[0, '#ffe2b0'], [0.45, '#fff2d8'], [0.75, '#ffd9a0'], [1, '#e8b878']]); c.fillRect(D.x0 - 20, D.y0 - 20, D.x1 - D.x0 + 40, D.y1 - D.y0 + 40);
    // floor and wall lines receding to the vanishing point, softened by the glare
    c.save(); c.strokeStyle = 'rgba(176,122,70,0.35)'; c.lineWidth = 3; c.filter = 'blur(2px)';
    for (const [x, y] of [[D.x0, D.y1 - 120], [D.x1, D.y1 - 120], [D.x0, D.y0 + 60], [D.x1, D.y0 + 60]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(D.vpX + (x - D.vpX) * 0.18, D.vpY + (y - D.vpY) * 0.18); c.stroke(); }
    c.restore();
    // corridor floor: a warm, slightly darker plane from the threshold to the far end (so her feet stand on it)
    const fk = 0.3, fyFar = D.vpY + (D.y1 - D.vpY) * fk;
    c.fillStyle = PV.linGrad(c, 0, fyFar, 0, D.y1, [[0, '#f3cf98'], [0.35, '#e9b979'], [1, '#d99e5e']]);
    c.beginPath(); c.moveTo(D.x0 - 20, D.y1 + 20); c.lineTo(D.x1 + 20, D.y1 + 20); c.lineTo(D.vpX + (D.x1 - D.vpX) * fk, fyFar); c.lineTo(D.vpX + (D.x0 - D.vpX) * fk, fyFar); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,240,214,0.55)'; c.fillRect(D.vpX + (D.x0 - D.vpX) * fk, fyFar - 2, (D.x1 - D.x0) * fk, 3); // far skirting catching light
    const g = c.createRadialGradient(D.vpX, D.vpY - 60, 10, D.vpX, D.vpY - 60, 260); g.addColorStop(0, 'rgba(255,255,248,0.95)'); g.addColorStop(1, 'rgba(255,248,230,0)');
    c.fillStyle = g; c.fillRect(D.x0, D.y0, D.x1 - D.x0, D.y1 - D.y0);
  }
  // the aunt: an adult woman seen from behind — hair to the shoulders (a bob, clearly not her long hair), a belted
  // knee-length coat, a bag on the shoulder, low heels. u = 1 head (92px*scale), anchor = ground between her feet.
  // ph = walk phase (one cycle = two steps), walk 0..1
  function auntBack(ctx, t, o) {
    if (!has('figureRender')) return;
    const ph = o.ph || 0, walk = o.walk || 0, sw = Math.sin(ph * TAU), bob = -Math.abs(Math.cos(ph * TAU)) * 0.06 * walk, sway = 0.035 * sw * walk;
    L.figureRender(ctx, { x: o.x, y: o.y, scale: o.scale, style: 'silhouette', fill: '#0b0a0c', light: -Math.PI / 2, rimColor: '#ffdcaa', rim: 1.0, backlight: 0.42, glow: 0.6, alpha: o.alpha }, null, (F) => {
      F.layer({}, (c) => {
        // legs: shaped calves, low heels; the stepping leg lifts its heel and the foot shortens
        for (const sg of [-1, 1]) {
          const lift = Math.max(0, sg * sw) * walk, x = sg * 0.155, fy = -lift * 0.34;
          blobP(c, [[x - 0.14, -2.45], [x + 0.14, -2.45], [x + 0.13, -2.0], [x + 0.15, -1.55], [x + 0.11, -0.95], [x + 0.07, -0.42 + fy * 0.6], [x + 0.065, -0.2 + fy],
            [x - 0.065, -0.2 + fy], [x - 0.07, -0.42 + fy * 0.6], [x - 0.11, -0.95], [x - 0.15, -1.55], [x - 0.13, -2.0]]);
          c.beginPath(); c.moveTo(x - 0.09, -0.27 + fy); c.lineTo(x + 0.09, -0.27 + fy); c.lineTo(x + 0.08, 0.0 + fy * 0.9); c.lineTo(x - 0.08, 0.0 + fy * 0.9); c.closePath(); c.fill(); // shoe + heel, on the floor
        }
        c.save(); c.translate(sway, bob);
        // coat: shoulders, belted waist, a soft A-line to just below the knee; the hem swings with the stride
        const hs = 0.06 * sw * walk;
        blobP(c, [[-0.36, -6.06], [-0.66, -5.98], [-0.84, -5.84], [-0.9, -5.58], [-0.84, -5.1], [-0.72, -4.55], [-0.62, -4.32], [-0.64, -4.12], [-0.72, -3.4], [-0.8 + hs, -2.7], [-0.84 + hs, -2.34, 1],
          [-0.4 + hs, -2.26], [0, -2.24], [0.4 + hs, -2.26], [0.84 + hs, -2.34, 1], [0.8 + hs, -2.7], [0.72, -3.4], [0.64, -4.12], [0.62, -4.32], [0.72, -4.55], [0.84, -5.1], [0.9, -5.58], [0.84, -5.84], [0.66, -5.98], [0.36, -6.06]]);
        // sleeves hanging close, swinging a little against the legs; slender hands
        for (const sg of [-1, 1]) {
          const s2 = -sg * sw * 0.07 * walk;
          const P0 = [sg * 0.8, -5.66], P1 = [sg * 0.9 + s2 * 0.5, -4.7], P2 = [sg * 0.9 + s2, -3.82];
          blobP(c, [[P0[0] - 0.16, P0[1]], [P1[0] - 0.13, P1[1]], [P2[0] - 0.1, P2[1]], [P2[0] + 0.1, P2[1]], [P1[0] + 0.14, P1[1]], [P0[0] + 0.15, P0[1] - 0.08]]);
          blobP(c, [[P2[0] - 0.08, P2[1] - 0.02], [P2[0] + 0.08, P2[1] - 0.02], [P2[0] + 0.07, P2[1] + 0.3], [P2[0] + 0.02 * sg, P2[1] + 0.52], [P2[0] - 0.05, P2[1] + 0.3]]);
        }
        // shoulder bag (her right shoulder = screen right): strap + bag at the hip
        c.lineWidth = 0.055; c.beginPath(); c.moveTo(0.42, -6.02); c.quadraticCurveTo(0.98, -5.4, 1.08, -4.42); c.stroke();
        c.beginPath(); c.moveTo(0.92, -4.52); c.lineTo(1.34, -4.48); c.quadraticCurveTo(1.42, -4.47, 1.42, -4.36); c.lineTo(1.42, -3.86); c.quadraticCurveTo(1.41, -3.74, 1.3, -3.74); c.lineTo(0.98, -3.74); c.quadraticCurveTo(0.9, -3.75, 0.9, -3.86); c.lineTo(0.9, -4.42); c.closePath(); c.fill();
        // head + hair to the shoulders, ends turned in
        c.beginPath(); c.ellipse(0, -7.0, 0.42, 0.5, 0, 0, TAU); c.fill();
        blobP(c, [[0, -7.56], [0.34, -7.47], [0.52, -7.2], [0.56, -6.8], [0.57, -6.38], [0.62, -6.1], [0.5, -5.96], [0.3, -6.02], [0, -6.06], [-0.3, -6.02], [-0.5, -5.96], [-0.62, -6.1], [-0.57, -6.38], [-0.56, -6.8], [-0.52, -7.2], [-0.34, -7.47]]);
        c.restore();
      });
    });
  }
  PV.shot('C36', { draw(ctx, t, d) {
    const tt = clamp(t, -0.5, d + 0.5), D = DOOR;
    const hall = PV.cached('g09_hall2', W, H, (c) => hallway(c));
    const G = doorGap(tt), shut = tt >= DOOR_SHUT;
    // the opening still lit: polygon between the leaf's free edge and the right jamb
    const lit = (c) => { c.beginPath(); c.moveTo(Math.min(D.x1, G.xt), G.yt); c.lineTo(D.x1, D.y0); c.lineTo(D.x1, D.y1); c.lineTo(Math.min(D.x1, G.xb), G.yb); c.closePath(); };
    const openK = clamp((D.x1 - G.xt) / (D.x1 - D.x0)); // how much light still comes in (1 = fully open)
    // --- the dark room
    const room = PV.cached('g09_c36room', W, H, (c) => {
      c.fillStyle = '#070607'; c.fillRect(0, 0, W, H);
      c.fillStyle = PV.radGrad(c, D.vpX, 700, 50, 1100, [[0, '#2a2622'], [0.5, '#141012'], [1, '#070608']]); c.fillRect(0, 0, W, H);
      // jambs and lintel (the frame faces us, in the dark), with a step down to the entrance
      c.fillStyle = '#1a1614'; c.fillRect(D.x0 - 34, D.y0 - 34, 34, D.y1 - D.y0 + 34); c.fillRect(D.x1, D.y0 - 34, 34, D.y1 - D.y0 + 34); c.fillRect(D.x0 - 34, D.y0 - 34, D.x1 - D.x0 + 68, 34);
      c.fillStyle = PV.linGrad(c, 0, D.y1 + 30, 0, D.y1 + 70, [[0, '#000000', 0.0], [0.5, '#000000', 0.35], [1, '#000000', 0]]); c.fillRect(0, D.y1 + 30, W, 40);
      // memory: soft vignette (baked)
      const v = c.createRadialGradient(D.vpX, 560, 300, D.vpX, 560, 1150); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
    });
    ctx.drawImage(room, 0, 0);
    if (!shut) {
      // everything bright happens inside this region (the opening, its spill on the floor, the halo round them)
      const RX = 560, RY = 100, RW = 840, RH = H - RY;
      const walkT = clamp((tt - 0.7) / 2.3), dist = 0.12 + 0.62 * walkT + 0.12 * walkT * walkT; // a step past the threshold, then away
      const k = 1 / (1 + dist * 1.5), sc = 0.8 * k;
      const fx = D.vpX + 30 * k, fy = D.vpY + (D.y1 + 10 - D.vpY) * k;
      // --- the corridor seen through the opening (her shadows on its floor), the leaf, the spill on our floor
      const buf = PV.buffer('g09_c36light'); const b = buf.ctx; b.clearRect(RX, RY, RW, RH);
      b.save(); lit(b); b.clip(); b.drawImage(hall, RX, RY, RW, RH, RX, RY, RW, RH);
      b.fillStyle = 'rgba(74,44,22,0.5)'; // her shadow on the corridor floor, toward the door (soft: drawn twice, offset)
      for (const o of [0, 1]) { b.beginPath(); b.moveTo(fx - (16 + 6 * o) * k, fy); b.lineTo(fx + (16 + 6 * o) * k, fy); b.lineTo(D.vpX + 52 + 8 * o, D.y1 + 12); b.lineTo(D.vpX - 14 - 8 * o, D.y1 + 12); b.closePath(); b.fill(); }
      b.restore();
      if (G.a > 0.02) { // the leaf itself (dark slab, its inner face catching a little light at the edge)
        b.save(); b.fillStyle = '#0c0a09'; b.beginPath(); b.moveTo(D.x0, D.y0); b.lineTo(G.xt, G.yt); b.lineTo(G.xb, G.yb); b.lineTo(D.x0, D.y1); b.closePath(); b.fill();
        b.strokeStyle = 'rgba(255,214,150,0.55)'; b.lineWidth = 2.5; b.beginPath(); b.moveTo(G.xt, G.yt); b.lineTo(G.xb, G.yb); b.stroke(); b.restore();
      }
      b.save(); b.globalCompositeOperation = 'destination-over'; // light on the floor of the dark room: a widening spill, narrowing with the gap
      const fl = 0.55 * Math.pow(openK, 0.8), xa = Math.min(D.x1, G.xb), spill = (x) => D.vpX + (x - D.vpX) * 1.95;
      b.beginPath(); b.moveTo(xa, D.y1); b.lineTo(D.x1, D.y1); b.lineTo(spill(D.x1) + 40, H); b.lineTo(spill(xa) - 30, H); b.closePath();
      b.fillStyle = PV.linGrad(b, 0, D.y1, 0, H, [[0, '#ffcf8a', fl], [0.45, '#e8b878', fl * 0.4], [1, '#e8b878', fl * 0.08]]); b.fill();
      b.restore();
      b.save(); b.globalCompositeOperation = 'multiply'; b.globalAlpha = 0.8 * openK * (1 - clamp((tt - 2.1) / 0.6)); // her long shadow on the spill, pointing back at us
      b.fillStyle = 'rgb(40,28,20)';
      for (const o of [0, 1]) { b.beginPath(); b.moveTo(fx - (20 + 8 * o) * k, D.y1); b.lineTo(fx + (20 + 8 * o) * k, D.y1); b.lineTo(D.vpX + 110 + 14 * o - 200 * walkT, H); b.lineTo(D.vpX - 70 - 14 * o - 200 * walkT, H); b.closePath(); b.fill(); }
      b.restore();
      // --- glow / halation of the bright opening into the dark (memory), from the corridor without her
      const hb = PV.buffer('g09_c36halo', RW / 4, RH / 4); hb.ctx.clearRect(0, 0, RW / 4, RH / 4); hb.ctx.filter = 'blur(10px)'; hb.ctx.drawImage(buf.canvas, RX, RY, RW, RH, 0, 0, RW / 4, RH / 4); hb.ctx.filter = 'none';
      const hw = PV.buffer('g09_c36halo2', RW / 4, RH / 4); hw.ctx.clearRect(0, 0, RW / 4, RH / 4); hw.ctx.filter = 'sepia(1) saturate(3) hue-rotate(-20deg) blur(4px)'; hw.ctx.drawImage(hb.canvas, 0, 0); hw.ctx.filter = 'none';
      ctx.drawImage(buf.canvas, RX, RY, RW, RH, RX, RY, RW, RH);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.55; ctx.drawImage(hb.canvas, RX, RY, RW, RH);
      ctx.globalAlpha = 0.3; ctx.drawImage(hw.canvas, RX, RY, RW, RH); ctx.restore();
      // --- her: a crisp dark silhouette in the light (the leaf occludes her as it swings shut); a contact shadow.
      // Drawn after the halation so the glare only wraps her edges (her own rim/glow) instead of greying her out.
      ctx.save(); lit(ctx); ctx.clip();
      ctx.fillStyle = 'rgba(60,34,16,0.75)'; ctx.beginPath(); ctx.ellipse(fx, fy + 1, 30 * k, 5.5 * k, 0, 0, TAU); ctx.fill();
      auntBack(ctx, tt, { x: fx, y: fy, scale: sc, walk: smooth(0.7, 1.1, tt), ph: Math.max(0, tt - 0.7) * 0.9 });
      ctx.restore();
      // light shafts in the dusty air of the dark room, fanning down from the opening onto the floor (narrowing with it)
      if (has('godRays')) L.godRays(ctx, tt, { x: (Math.min(D.x1, G.xb) + D.x1) / 2, y: D.y1 - 140, angle: Math.PI / 2 + 0.1, spread: 0.8 * openK + 0.1, count: 6, length: 900, width: 110 * openK + 10, flare: 2.4, color: '#ffd9a0', alpha: 0.12 * openK, seed: 7, flicker: 0.4 });
      // the frame edges catch the light (thin lines at the jambs)
      ctx.save(); ctx.strokeStyle = PV.rgba('#ffd59a', 0.5 * openK); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(D.x1 + 1, D.y0); ctx.lineTo(D.x1 + 1, D.y1); ctx.moveTo(D.x0, D.y0 - 1); ctx.lineTo(D.x1, D.y0 - 1); ctx.stroke(); ctx.restore();
      if (has('dust')) L.dust(ctx, tt, { seed: 61, count: 40, x0: 700, x1: 1400, y0: 300, y1: 1080, size: 2.4, alpha: 0.55 * openK, drift: 30, vx: -3, vy: -2, color: '#ffe2b0',
        mask: (x, y) => clamp(1 - Math.abs(x - D.vpX) / (180 + Math.max(0, y - D.y1) * 0.9)) * (y > D.y0 ? 1 : 0) });
    } else {
      // the afterimage of the last thin line, fading in the dark (gone by 144.3, when the clock stops)
      const a = 0.5 * (1 - clamp((tt - DOOR_SHUT) / 0.3));
      if (a > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
        for (const [w, aa] of [[12, 0.18], [6, 0.4], [2.5, 1]]) { ctx.strokeStyle = PV.rgba('#ffcf8a', a * aa); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(D.x1 - 1, D.y0 + 10); ctx.lineTo(D.x1 - 1, D.y1 - 10); ctx.stroke(); }
        ctx.restore();
      }
    }
  } });

  /* ======================================================================
   * C34 テーブル（俯瞰） 5.0s — pan right over the table in flat overcast light:
   *   ① earplugs in their little case → ② her left hand writing her own name, shaking (pen 130.2–131.6),
   *   131.8 (t=1.8) a drop falls and the ink bleeds → ③ her limp, scarred right hand lying in his upturned left
   *   palm (his fingers curl round its edge), his right hand bringing the clipper along her index finger:
   *   134.0 (t=4.0)『パチン』(the SFX lands at 134.00) on a still frame: the pan settles at 3.9.  Her arm comes in from the bottom left, both of his from
   *   the right (he sits at her right here: the natural way to hold her right hand).  Everything is drawn in
   *   device space (the hand rigs are), panned by hand; the static part of ③ is rendered once and slid with the pan.
   * ==================================================================== */
  const C34 = { pan: 1480, worldW: 3420, FX: 2470, FY: 470 };   // FX,FY: her index fingertip (world)
  // the pan lingers on the page while the drop falls and the ink bleeds (≈1.45–2.25), then moves on to the hands
  // (monotone cubic Hermite through the keys; the click at 4.0 lands just after the pan settles)
  const C34KEYS = [[0, 0, 0], [1.45, 0.36, 0.14], [2.2, 0.465, 0.14], [3.9, 1, 0]];
  const c34Off = (t) => {
    t = clamp(t, 0, 3.9); let i = 0; while (i < C34KEYS.length - 2 && t > C34KEYS[i + 1][0]) i++;
    const [t0, p0, m0] = C34KEYS[i], [t1, p1, m1] = C34KEYS[i + 1], h = t1 - t0, u = (t - t0) / h, u2 = u * u, u3 = u2 * u;
    return C34.pan * ((2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * m1);
  };
  function paintTable(c) { // pale wood, top-down, one long board run; flat light from the window (upper left)
    const w = C34.worldW;
    c.fillStyle = PV.linGrad(c, 0, 0, 0, H, [[0, '#cdbda5'], [1, '#bba98f']]); c.fillRect(0, 0, w, H);
    const r = PV.rng(5);
    for (let k = 0; k < 9; k++) { // boards (horizontal), each with its own tone and grain
      const y0 = -40 + k * 140, tone = (r() - 0.5) * 0.08;
      c.fillStyle = tone > 0 ? `rgba(255,248,236,${tone})` : `rgba(80,62,40,${-tone})`; c.fillRect(0, y0, w, 140);
      c.strokeStyle = 'rgba(90,70,48,0.3)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, y0); c.lineTo(w, y0); c.stroke();
      c.strokeStyle = 'rgba(110,86,60,0.12)'; c.lineWidth = 1.2;
      for (let g = 0; g < 7; g++) { const yy = y0 + 12 + r() * 116, ph = r() * 50; c.beginPath(); for (let x = 0; x <= w; x += 40) { const y = yy + 5 * Math.sin(x * 0.004 + ph) + 2 * Math.sin(x * 0.017 + ph * 2); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
    }
    grain(c, 0, 0, w, H, 26000, 15, '#5a4630', 0.07, 2);
  }
  function pen(c, x, y, ang, len, w) { // tip at (x,y); the barrel runs back along ang
    c.save(); c.translate(x, y); c.rotate(ang);
    c.fillStyle = 'rgba(60,46,30,0.18)'; c.beginPath(); c.ellipse(len * 0.55 + 6, 12, len * 0.5, 7, 0, 0, TAU); c.fill(); // soft shadow on the paper
    c.fillStyle = '#c9c4ba'; c.beginPath(); c.moveTo(0, 0); c.lineTo(16, -w * 0.3); c.lineTo(16, w * 0.3); c.closePath(); c.fill();
    const g = c.createLinearGradient(0, -w / 2, 0, w / 2); g.addColorStop(0, '#5a5a66'); g.addColorStop(0.35, '#2c2c36'); g.addColorStop(1, '#17171e');
    c.fillStyle = g; c.beginPath(); c.moveTo(15, -w * 0.33); c.lineTo(len, -w / 2); c.quadraticCurveTo(len + 6, 0, len, w / 2); c.lineTo(15, w * 0.33); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.32)'; c.fillRect(20, -w * 0.3, len - 26, w * 0.16);
    c.fillStyle = '#9a9aa6'; c.fillRect(len * 0.62, -w / 2, 5, w);
    c.restore();
  }
  // a lever nail clipper seen from above (the camera a little off the vertical, so the raised lever parallaxes off
  // the body and a sliver of the body's side shows). (x,y) = the jaws' cutting edge, ang = direction from the jaws
  // toward the lever's finger pad, s = px per unit, press 0..1 (the lever pushed down -> the jaws bite)
  function nailClipper(c, x, y, ang, s, press) {
    press = press || 0;
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
    const up = -Math.sin(ang) < 0 ? 1 : -1; // which local y side faces the camera tilt (the bottom of the screen)
    // cast shadows on the paper: the body's short and dark, the raised lever's longer and softer
    // (soft gradient ellipses, not ctx.filter: a canvas filter here cost ~70ms a frame on the full-size buffer)
    const blob = (cx, cy, rx, ry, a) => { c.save(); c.translate(cx, cy); c.scale(1, ry / rx); const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(52,40,28,${a})`); g.addColorStop(0.55, `rgba(52,40,28,${a * 0.7})`); g.addColorStop(1, 'rgba(52,40,28,0)'); c.fillStyle = g; c.fillRect(-rx, -rx, 2 * rx, 2 * rx); c.restore(); };
    blob(18, 5 * up + 3, 22, 9, 0.24); blob(44, 5 * up + 3, 26, 9, 0.24); blob(50, 9 * up + 4, 32, 10, 0.12);
    const ln = '#34312c', lw = 0.7;
    // body (the two stacked jaw plates): rounded head at the jaws, a slight waist, rounded tail; its side face
    const body = (dy) => { c.beginPath(); c.moveTo(1.2, -6.6 + dy); c.quadraticCurveTo(14, -7.4 + dy, 28, -5.8 + dy); c.quadraticCurveTo(46, -5.4 + dy, 56, -6.4 + dy); c.quadraticCurveTo(62.5, -6.6 + dy, 62.5, dy);
      c.quadraticCurveTo(62.5, 6.6 + dy, 56, 6.4 + dy); c.quadraticCurveTo(46, 5.4 + dy, 28, 5.8 + dy); c.quadraticCurveTo(14, 7.4 + dy, 1.2, 6.6 + dy); c.quadraticCurveTo(-1.8, dy, 1.2, -6.6 + dy); c.closePath(); };
    body(2.6 * up); c.fillStyle = '#4a4742'; c.fill(); c.strokeStyle = ln; c.lineWidth = lw; c.stroke();
    let g = c.createLinearGradient(0, -7 * up, 0, 7 * up); g.addColorStop(0, '#e8e5de'); g.addColorStop(0.4, '#b2aea6'); g.addColorStop(0.75, '#86827b'); g.addColorStop(1, '#67635d');
    body(0); c.fillStyle = g; c.fill(); c.strokeStyle = ln; c.lineWidth = lw; c.stroke();
    // the jaws: a dark bite line just behind the edge, the edge's bright lip
    c.strokeStyle = 'rgba(30,27,24,0.95)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(3.0, -5.8); c.quadraticCurveTo(1.4 + 0.8 * press, 0, 3.0, 5.8); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0.8, -4.8); c.quadraticCurveTo(-0.6, 0, 0.8, 4.8); c.stroke();
    // the lever, raised above the body: pivots on the rivet near the jaws, arches back past the tail to a wider
    // finger pad.  Raised = drawn shifted toward the top of the screen; pressing brings it down onto the body.
    const lift = (1 - 0.75 * press), L0 = 7, L1 = 76 - 2 * press;
    const lever = () => { c.beginPath(); c.moveTo(L0, -3.9); c.quadraticCurveTo(30, -3.6, 52, -4.8); c.quadraticCurveTo(L1 - 7, -7.4, L1 - 2, -6.2); c.quadraticCurveTo(L1 + 3.5, 0, L1 - 2, 6.2);
      c.quadraticCurveTo(L1 - 7, 7.4, 52, 4.8); c.quadraticCurveTo(30, 3.6, L0, 3.9); c.arc(L0, 0, 3.9, Math.PI / 2, -Math.PI / 2); c.closePath(); };
    c.save(); c.fillStyle = 'rgba(28,24,20,0.3)'; c.translate(0.6, 1.4 * up * lift + 0.8); lever(); c.fill(); c.restore();   // its shadow on the body
    c.save(); c.translate(0, -2.4 * up * lift);
    g = c.createLinearGradient(0, -6 * up, 0, 6 * up); g.addColorStop(0, '#ffffff'); g.addColorStop(0.32, '#ebe8e1'); g.addColorStop(0.66, '#b9b5ad'); g.addColorStop(1, '#8e8a83');
    lever(); c.fillStyle = g; c.fill(); c.strokeStyle = ln; c.lineWidth = lw; c.stroke();
    if (press > 0) { c.fillStyle = PV.rgba('#2a2723', 0.2 * press); lever(); c.fill(); }
    c.fillStyle = 'rgba(70,66,60,0.3)'; c.beginPath(); c.ellipse(L1 - 10, 0.5 * up, 7, 3.6, 0, 0, TAU); c.fill();   // the pad's shallow dish
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 1.0; c.lineCap = 'round'; c.beginPath(); c.moveTo(13, -1.8 * up); c.quadraticCurveTo(36, -2.0 * up, 54, -2.8 * up); c.stroke();
    // the rivet head
    c.fillStyle = '#e2dfd8'; c.beginPath(); c.arc(L0, 0, 2.5, 0, TAU); c.fill(); c.strokeStyle = ln; c.lineWidth = 0.6; c.stroke();
    c.fillStyle = 'rgba(40,36,32,0.55)'; c.beginPath(); c.arc(L0 + 0.5, 0.5 * up, 1.0, 0, TAU); c.fill();
    c.restore();
    c.restore();
  }
  // a healed suture scar, re-stated with VALUE contrast (the library's pink reads as nothing under saturate(0.25)):
  // a fine shadowed ridge, a pale core and faint stitch marks.  pts3 = local 3D points on the hand's surface.
  function scarRidge(c, rig, pts3, o) {
    o = o || {}; const P = pts3.map(p => rig.P(p)); if (P.length < 2) return;
    const la = rig.o.light == null ? -2.3 : rig.o.light, w = (o.w || 1) * clamp(rig.unit * 1.15, 1.1, 3), lx = Math.cos(la), ly = Math.sin(la);
    const kc = rig.o.keyColor, core = kc ? L._handTint('#fff8f2', kc, 0.35) : '#fff6f0', dark = rig.o.fillColor ? L._handTint('#9a6a5c', rig.o.fillColor, 0.45) : '#9a6a5c';
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    const path = (dx, dy) => { c.beginPath(); c.moveTo(P[0].x + dx, P[0].y + dy); for (let i = 1; i < P.length; i++) c.lineTo(P[i].x + dx, P[i].y + dy); };
    c.globalAlpha = 0.5; c.strokeStyle = dark; c.lineWidth = w * 2.6; path(-lx * w * 0.7, -ly * w * 0.7); c.stroke();   // shadow side of the ridge
    c.globalAlpha = 0.95; c.strokeStyle = core; c.lineWidth = w * 1.15; path(lx * w * 0.25, ly * w * 0.25); c.stroke();   // the shiny raised core
    c.globalAlpha = 0.45; c.strokeStyle = dark; c.lineWidth = w * 0.55;
    let acc = 0, n = 0; const step = (o.step || 9) * rig.unit;
    for (let i = 0; i < P.length - 1; i++) { // stitch marks on alternating sides
      const A = P[i], B = P[i + 1], sl = Math.hypot(B.x - A.x, B.y - A.y); if (sl < 1e-3) continue; const ux = (B.x - A.x) / sl, uy = (B.y - A.y) / sl;
      while (acc < sl) { const x = A.x + ux * acc, y = A.y + uy * acc, sg = n % 2 ? 1 : -1, off = 1.6 * w, len = 2.6 * w;
        c.beginPath(); c.moveTo(x - uy * off * sg, y + ux * off * sg); c.lineTo(x - uy * (off + len) * sg + ux * w * 0.6, y + ux * (off + len) * sg + uy * w * 0.6); c.stroke(); acc += step; n++; }
      acc -= sl;
    }
    c.restore();
  }
  function herScars(c, rig) { // the library's dorsal scars (back of the hand toward the index/middle valley, across the wrist)
    const V3 = L._handMath.V, line = (a, b, z, bow, n) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n; out.push(V3(lerp(a[0], b[0], t) + Math.sin(t * Math.PI) * bow, lerp(a[1], b[1], t), z)); } return out; };
    scarRidge(c, rig, line([-2, -6], [-19, -80], 12.5, 4, 12), { w: 1, step: 8 });
    scarRidge(c, rig, line([-19, 8], [18, 6], 13.5, -3, 8), { w: 0.85, step: 8 });
  }
  const softShadow = (c, x, y, rx, ry, ang, a) => { c.save(); c.translate(x, y); c.rotate(ang); c.scale(1, ry / rx); const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(70,52,34,${a})`); g.addColorStop(0.6, `rgba(70,52,34,${a * 0.5})`); g.addColorStop(1, 'rgba(70,52,34,0)'); c.fillStyle = g; c.fillRect(-rx, -rx, 2 * rx, 2 * rx); c.restore(); };
  function rigAt(o, fn, tx, ty) { const p = L.handRig(Object.assign({}, o, { x: 0, y: 0 })); const q = fn(p); return L.handRig(Object.assign({}, o, { x: tx - q.x, y: ty - q.y })); }

  // ③ the static part (paper, his left hand, her hand, the scars), laid out with her index fingertip at (fx,fy)
  const CL = { S: 1.85, hr: 0.62, light: -2.3 };
  function clipStatic(c, fx, fy) {
    const S = CL.S, hr = CL.hr, cm = { t: 0, light: CL.light, keyColor: '#f6eee2', tint: 0.35 };
    const her = rigAt(Object.assign({}, cm, { side: 'R', kind: 'her', view: 'back', scale: S, rot: hr, pitch: 0.08, curl: [0.16, 0.2, 0.26, 0.32, 0.4], spread: 0.08,
      thumb: { abd: 0.32, opp: 0.25, flex: [0.12, 0.2] }, surgicalScars: true, sleeve: '#5f554b', sleeveAt: 22, arm: 400 }), (r) => r.tips[1], fx, fy);
    // his left hand, palm up under hers, crossing it: wrist down-right of hers, fingers curled up round her hand's radial edge
    const hw = her.wrist, ux = Math.sin(hr), uy = -Math.cos(hr), px = -uy, py = ux, along = 30, across = 36;
    // (a shade darker than hers: it lies in the shadow of her hand, which keeps the two hands apart in the grey grade)
    const hisL = L.handRig(Object.assign({}, cm, { side: 'L', kind: 'him', view: 'palm', scale: S, rot: hr - 1.15, x: hw.x + (ux * along + px * across) * S, y: hw.y + (uy * along + py * across) * S,
      curl: [0.3, 0.86, 0.9, 0.92, 0.94], spread: 0.03, sleeve: '#2e2721', sleeveAt: 30, arm: 460, thumb: { abd: 0.6, opp: 0.9, flex: [0.3, 0.4] }, keyColor: '#dcd0bf', tint: 0.5 }));
    // the folded kitchen paper under it all
    const tc = her.tips[2];
    const tis = PV.cached('g09_tissue3', 600, 480, (g) => {
      g.translate(300, 240); g.rotate(-0.1);
      g.fillStyle = 'rgba(70,52,34,0.16)'; g.filter = 'blur(9px)'; g.fillRect(-206, -150, 424, 320); g.filter = 'none';
      g.fillStyle = '#e9e2d4'; g.beginPath(); g.moveTo(-210, -160); g.lineTo(206, -166); g.lineTo(212, 158); g.lineTo(-204, 164); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(140,126,104,0.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(2, -164); g.lineTo(6, 160); g.stroke(); // fold crease
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(6, -164, 200, 324);
      grain(g, -210, -166, 420, 330, 2500, 31, '#a89a82', 0.14, 1.5);
    });
    c.drawImage(tis, tc.x - 300 + 40, tc.y - 240 + 40);
    softShadow(c, hw.x + 70, hw.y - 40, 300, 140, hr - Math.PI / 2, 0.2);
    hisL.o.depthFn = (q) => q.depth + (q.kind === 'thumb' ? 20000 : 0);
    her.o.depthFn = (q) => q.depth + 10000;
    her.o.dropShadow = { dx: 5 * S, dy: 7 * S, blur: 6 * S, alpha: 0.26, color: '#8a5a48' };
    L.handRender(c, [hisL, her], { after: (g, q) => { if (q.rig === her && q.kind === 'palm') herScars(g, her); } });
    return { her, hisL };
  }

  PV.shot('C34', { draw(ctx0, t, d) {
    // everything is drawn in device space into a buffer; the end of the pan eases into a slight push toward the fingertips
    const zb = PV.buffer('g09_c34z'), ctx = zb.ctx; ctx.clearRect(0, 0, W, H);
    const tt = clamp(t, -0.5, d + 0.5), off = c34Off(tt);
    // the click: a two-frame jolt of the whole frame
    const kick = tt > 4.0 ? Math.exp(-(tt - 4.0) * 16) : 0, jx = 2.2 * kick * Math.sin((tt - 4.0) * 95), jy = 1.6 * kick * Math.cos((tt - 4.0) * 80);
    const ox = Math.round(-off + jx), oy = Math.round(jy);
    const X = (wx) => wx + ox, Y = (wy) => wy + oy;
    // the table, with the window's lattice baked in as a very soft shadow (overcast): the cage again, barely there
    const table = PV.cached('g09_table_lat', C34.worldW, H, (c) => {
      c.drawImage(PV.cached('g09_table', C34.worldW, H, paintTable), 0, 0);
      const q = PV.makeCanvas(Math.ceil(C34.worldW / 4), Math.ceil(H / 4)), g = q.ctx;
      g.scale(0.25, 0.25); g.fillStyle = 'rgba(0,0,0,1)'; g.transform(1, 0, -0.32, 1, 0, 0);
      for (let x = -400; x < C34.worldW + 600; x += 300) g.fillRect(x, -100, 46, H + 200);
      for (let y = 40; y < H; y += 330) g.fillRect(-400, y, C34.worldW + 1200, 40);
      const q2 = PV.makeCanvas(q.canvas.width, q.canvas.height); q2.ctx.filter = 'blur(9px)'; q2.ctx.drawImage(q.canvas, 0, 0);
      c.globalAlpha = 0.1; c.drawImage(q2.canvas, 0, 0, C34.worldW, H); c.globalAlpha = 1;
    });
    ctx.drawImage(table, ox, oy);
    const vis = (x0, x1) => X(x1) > -60 && X(x0) < W + 60;
    const cm = { t: tt, light: CL.light, keyColor: '#f6eee2', tint: 0.35 };

    // ① earplugs in a small clear case
    if (vis(330, 760) && has('earplugs')) {
      softShadow(ctx, X(560), Y(470), 210, 90, -0.25, 0.18);
      L.earplugs(ctx, { x: X(540), y: Y(430), s: 1.55, rot: -0.25, case: true, tone: 'mute', light: -2.3 });
    }
    // ② the notebook: her left hand writes her name again (130.2–131.6), stops; 131.8 a drop falls on the page
    let nbTip = null;
    if (vis(780, 1900) && has('notebookName')) {
      const tnb = clamp(tt, 0.2, 1.6), spd = 6;
      nbTip = L.notebookName(ctx, tnb, { x: X(1330), y: Y(520), s: 1.0, rot: -0.07, k: 0.97, tone: 'mute', light: -2.3, lines: 9, perLine: 3, seed: 3,
        writeStart: 0.2 - 520 / spd, writeSpeed: spd, tears: tt >= 1.8 ? [{ at: tnb - (tt - 1.8), u: 0.66, v: 0.36 }] : [] }); // (its own falling drop is replaced below)
    }
    if (vis(780, 1900)) { // the tear, made legible in the muted grade.  Seen from above it does not slide down the
      // screen: it falls away from us, a big soft drop near the lens shrinking and sharpening onto the page (≈0.3 s),
      // its shadow closing in on it; then the splash, the wet spot and the ink bleeding out of the strokes.
      const NB = { x: 1330, y: 520, rot: -0.07, k: 0.97 }, lu = 0.66 * 380, lv = (-270 + 0.36 * 540) * NB.k;
      const tx = X(NB.x) + lu * Math.cos(NB.rot) - lv * Math.sin(NB.rot), ty = Y(NB.y) + lu * Math.sin(NB.rot) + lv * Math.cos(NB.rot);
      const age = tt - 1.8;
      if (age > -0.32 && age < 0) {
        const k = 1 + age / 0.32, e = Math.pow(k, 0.8), r = lerp(30, 7, e), dx = -(1 - e) * 34, dy = (1 - e) * 26; // from her face (lower left, near us)
        ctx.save();
        const sh = ctx.createRadialGradient(tx + 3 * (1 - k), ty + 4 * (1 - k), 0, tx + 3 * (1 - k), ty + 4 * (1 - k), 12 + 26 * (1 - k)); // its shadow
        sh.addColorStop(0, `rgba(60,48,36,${0.12 + 0.2 * k})`); sh.addColorStop(1, 'rgba(60,48,36,0)'); ctx.fillStyle = sh; ctx.fillRect(tx - 60, ty - 60, 120, 120);
        const x = tx + dx, y = ty + dy, soft = 1 - e;
        const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${0.95 - 0.35 * soft})`); g.addColorStop(0.45, `rgba(214,222,232,${0.55 - 0.25 * soft})`);
        g.addColorStop(0.8 - 0.3 * soft, `rgba(90,98,112,${0.55 - 0.3 * soft})`); g.addColorStop(1, 'rgba(90,98,112,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.08, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.9 * e})`; ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.38, Math.max(1.2, r * 0.18), 0, TAU); ctx.fill();
        ctx.restore();
      }
      if (age >= 0) {
        const R = 7 + 31 * (1 - Math.exp(-age * 2.4)), wet = Math.exp(-age * 1.1);
        ctx.save(); ctx.globalCompositeOperation = 'multiply';
        // the wet spot: the paper goes grey and translucent, darkest at its drying edge
        let g = ctx.createRadialGradient(tx, ty, 0, tx, ty, R);
        g.addColorStop(0, 'rgba(176,180,192,1)'); g.addColorStop(0.72, 'rgba(160,165,182,1)'); g.addColorStop(0.9, 'rgba(118,124,150,1)'); g.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(tx, ty, R, R * 0.93, 0.3, 0, TAU); ctx.fill();
        // ink bleeding out of the strokes the drop sits on: soft dark feathers growing outward
        const rr = PV.rng(77), grow = smooth(0.05, 1.2, age);
        for (let i = 0; i < 9; i++) {
          const a = rr() * TAU, d0 = R * (0.15 + 0.5 * rr()), len = (6 + 12 * rr()) * grow, w = 2.4 + 2.5 * rr();
          const x0 = tx + Math.cos(a) * d0, y0 = ty + Math.sin(a) * d0 * 0.93;
          const f = ctx.createRadialGradient(x0, y0, 0, x0, y0, w + len); f.addColorStop(0, 'rgba(70,76,104,0.75)'); f.addColorStop(1, 'rgba(255,255,255,1)');
          ctx.fillStyle = f; ctx.beginPath(); ctx.ellipse(x0 + Math.cos(a) * len * 0.4, y0 + Math.sin(a) * len * 0.4, w + len * 0.6, w, a, 0, TAU); ctx.fill();
        }
        ctx.restore();
        if (age < 0.3) { // the splash: a bright ring and a few tiny droplets thrown out
          const k = age / 0.3; ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`; ctx.lineWidth = 2.2 * (1 - k) + 0.6;
          ctx.beginPath(); ctx.ellipse(tx, ty, 7 + 42 * k, (7 + 42 * k) * 0.9, 0, 0, TAU); ctx.stroke();
          ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - k)})`; const rd = PV.rng(5);
          for (let i = 0; i < 6; i++) { const a = rd() * TAU, d = (14 + 30 * rd()) * PV.ease.outQuad(k); ctx.beginPath(); ctx.arc(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 1.8 * (1 - k) + 0.6, 0, TAU); ctx.fill(); }
          ctx.restore();
        }
        ctx.save(); ctx.fillStyle = `rgba(255,255,255,${0.65 * wet})`; ctx.beginPath(); ctx.ellipse(tx - R * 0.28, ty - R * 0.3, R * 0.22, R * 0.11, -0.5, 0, TAU); ctx.fill(); ctx.restore(); // wet sheen
      }
    }
    const writeHand = (c, tip, th) => {
      const ho = Object.assign({}, cm, { t: th, side: 'L', kind: 'her', view: 'back', scale: 1.5, rot: 0.45, yaw: -0.6, pitch: 0.35, curl: [0.3, 0.3, 0.42, 0.62, 0.72], spread: 0.12,
        thumb: { abd: 0.55, opp: 0.95, flex: [0.25, 0.35] }, sleeve: '#5f554b', sleeveAt: 28, arm: 330, tremble: th < 1.6 ? 0.6 : 0.25 * (1 - smooth(1.6, 2.0, th)), seed: 7 });
      const pr = L.handRig(Object.assign({}, ho, { x: 0, y: 0 }));
      const G = { x: (pr.tips[0].x + pr.tips[1].x) / 2, y: (pr.tips[0].y + pr.tips[1].y) / 2 };
      // the barrel leaves the pinch over the web and runs back along the thumb's base toward her shoulder
      const web = { x: lerp(pr.joints[0][0].x, pr.joints[0][1].x, 0.35), y: lerp(pr.joints[0][0].y, pr.joints[0][1].y, 0.35) };
      let dx = G.x - web.x, dy = G.y - web.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const tip0 = { x: G.x + dx * 30, y: G.y + dy * 30 };
      const sx = tip.x - tip0.x, sy = tip.y - tip0.y;
      const rig = L.handRig(Object.assign({}, ho, { x: sx, y: sy }));
      softShadow(c, tip.x - 140, tip.y + 120, 230, 120, -0.6, 0.16);
      // the pen rests in the web and is pinched by the thumb and index: draw it over the palm and the middle finger,
      // under the thumb and the index (it used to pass under the whole hand, i.e. through the palm)
      rig.o.depthFn = (q) => (q.kind === 'thumb' || (q.kind === 'finger' && q.fi === 1) ? q.depth + 5000 : null);
      let penDone = false; const drawPen = (g) => { penDone = true; pen(g, tip.x, tip.y, Math.atan2(-dy, -dx), 205, 15); }; // tilted toward her: foreshortened
      L.handRender(c, [rig], { before: (g, q) => { if (!penDone && (q.kind === 'thumb' || (q.kind === 'finger' && q.fi === 1))) drawPen(g); } });
      if (!penDone) drawPen(c);
    };
    if (nbTip && vis(1000, 1900)) {
      if (tt < 2.0) writeHand(ctx, nbTip, tt);
      else { // she has stopped: the same still hand every frame -> rendered once at a fixed layout, slid with the pan
        if (!writeHand.cache) { const B = 600, b = PV.makeCanvas(W, H); // cache x = world x - B (wide margin: nothing of the arm is clipped)
          const tip = L.notebookName(PV.makeCanvas(8, 8).ctx, 1.6, { x: 1330 - B, y: 520, s: 1.0, rot: -0.07, k: 0.97, tone: 'mute', light: -2.3, lines: 9, perLine: 3, seed: 3, writeStart: 0.2 - 520 / 6, writeSpeed: 6 });
          if (tip) writeHand(b.ctx, tip, 2.0); writeHand.cache = { canvas: b.canvas, B }; }
        ctx.drawImage(writeHand.cache.canvas, ox + writeHand.cache.B, oy);
      }
    }
    // ③ her limp scarred right hand lying in his left palm, his right hand with the clipper
    if (vis(1700, 3420) && has('handRig')) {
      const fx0 = C34.FX - C34.pan, fy0 = C34.FY; // the cluster laid out at the end of the pan (device px), then slid
      if (!clipStatic.cache) { // computed once (deterministic): the static hands at the end-of-pan layout
        const b = PV.makeCanvas(W, H); const r = clipStatic(b.ctx, fx0, fy0);
        clipStatic.cache = { canvas: b.canvas, her: r.her };
      }
      const CC = clipStatic.cache, sx = ox + C34.pan, sy = oy;   // device offset of the cached layout this frame
      ctx.drawImage(CC.canvas, 250, 100, 1600, 980, sx + 250, sy + 100, 1600, 980); // (the cluster lies inside this box)
      const her = CC.her, S = CL.S;
      const it0 = her.tips[1], dip0 = her.joints[1][2], fdir = Math.atan2(it0.y - dip0.y, it0.x - dip0.x);
      const it = { x: it0.x + sx, y: it0.y + sy };
      // the clipper comes in along her finger (2.5–3.7), settles, clicks at 4.0, then lifts away a little
      const appr = PV.ease.inOutCubic(clamp((tt - 2.5) / 1.2)), away = PV.ease.inOut(clamp((tt - 4.3) / 0.6));
      const press = smooth(3.86, 4.0, tt) * (1 - smooth(4.06, 4.3, tt));
      const back = 70 * (1 - appr) + 22 * away;
      const ca = fdir + 0.06 * (1 - appr);
      const jaw = { x: it.x - Math.cos(fdir) * 4 + Math.cos(ca) * back, y: it.y - Math.sin(fdir) * 4 + Math.sin(ca) * back };
      const cs = S * 1.02, pad = { x: jaw.x + Math.cos(ca) * (67 * cs), y: jaw.y + Math.sin(ca) * (67 * cs) - 2.4 * cs * (1 - 0.75 * press) };
      const hisR = rigAt(Object.assign({}, cm, { side: 'R', kind: 'him', view: 'back', scale: S, rot: ca + Math.PI * 1.5 + 1.32, pitch: 0.35,
        curl: [0.3 + 0.1 * press, 0.62, 0.7, 0.74, 0.78], spread: 0.05, sleeve: '#2e2721', sleeveAt: 30, arm: 720,
        thumb: { abd: 0.5, opp: 0.85, flex: [0.25 + 0.15 * press, 0.25 + 0.1 * press] } }), (r) => r.tips[0], pad.x, pad.y + 2 * press);
      softShadow(ctx, hisR.wrist.x - 40, hisR.wrist.y + 60, 260, 110, -0.2, 0.18);
      let clipDone = false;
      hisR.o.depthFn = (q) => q.depth + (q.kind === 'thumb' ? 40000 : 30000);
      L.handRender(ctx, [hisR], { before: (c, q) => { if (!clipDone && q.depth >= 35000) { clipDone = true; nailClipper(c, jaw.x, jaw.y, ca, cs, press); } } });
      if (!clipDone) nailClipper(ctx, jaw.x, jaw.y, ca, cs, press);
      // 『パチン』: a glint runs over the metal; the clipped crescent of nail hops onto the paper
      if (tt > 3.98 && tt < 4.3) {
        const k = clamp((tt - 3.98) / 0.32), a = Math.sin(k * Math.PI), gx = jaw.x + Math.cos(ca) * 30 * cs, gy = jaw.y + Math.sin(ca) * 30 * cs - 3 * cs;
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(255,255,250,${0.9 * a})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (const [l, an] of [[20, 0.6], [12, 0.6 + Math.PI / 2]]) { ctx.beginPath(); ctx.moveTo(gx - Math.cos(an) * l, gy - Math.sin(an) * l); ctx.lineTo(gx + Math.cos(an) * l, gy + Math.sin(an) * l); ctx.stroke(); }
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 24); g.addColorStop(0, `rgba(255,255,255,${0.65 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(gx - 24, gy - 24, 48, 48);
        ctx.restore();
      }
      if (tt > 4.0) {
        const k = PV.ease.outQuad(clamp((tt - 4.0) / 0.36)), hop = Math.sin(k * Math.PI) * 30;
        const nx = it.x + Math.cos(fdir - 1.0) * 60 * k, ny = it.y + Math.sin(fdir - 1.0) * 60 * k - hop; // off the thumb side, onto the paper
        ctx.save(); ctx.translate(nx, ny); ctx.rotate(fdir + k * 5);
        ctx.strokeStyle = 'rgba(90,72,56,0.35)'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 1.5, 7, -0.95 + Math.PI / 2, 0.95 + Math.PI / 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,250,244,1)'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(0, 0, 7, -0.95 + Math.PI / 2, 0.95 + Math.PI / 2); ctx.stroke(); ctx.restore();
      }
    }
    // flat overcast light from the window (upper left) and a soft falloff
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    const lg = ctx.createLinearGradient(0, 0, W, H); lg.addColorStop(0, 'rgba(255,250,240,0.55)'); lg.addColorStop(1, 'rgba(40,30,22,0.45)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); ctx.restore();
    const z = 1 + 0.075 * PV.ease.inOut(clamp((tt - 3.0) / 2.0)), zx = 1000, zy = 520;
    ctx0.save(); ctx0.setTransform(1, 0, 0, 1, 0, 0); ctx0.imageSmoothingQuality = 'medium';
    if (z <= 1.0001) ctx0.drawImage(zb.canvas, 0, 0); else ctx0.drawImage(zb.canvas, zx - zx / z, zy - zy / z, W / z, H / z, 0, 0, W, H);
    ctx0.restore();
  } });
})();

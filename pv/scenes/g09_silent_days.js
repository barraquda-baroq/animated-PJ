/* ============================================================================
 * g09_silent_days — ACT5「檻」 C33–C36   (characters: PV.anime — anime_head.js / anime_body.js)
 *   C33 彼の部屋（沈黙の日々）：the two on the sofa, front-oblique (the camera of C22 / C42), she on his RIGHT with a
 *       person's gap; the window grid thrown on the wall = the cage; her empty eyes, V12 flat; his tired face
 *   C34 テーブル（俯瞰）：耳栓 → 左手で書く名前と雫 → 爪切り『パチン』 (hands only, unchanged)
 *   C35 夜のソファ：her sleeping face on his shoulder by the table lamp, his face (V13 / V14) → 傷をなぞる指 → 指が絡む
 *   C36 記憶（叔母）：walking out into the doorway's light, a glance back over her shoulder (V15) → the door closes
 * ========================================================================== */
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib || {}, W = PV.W, H = PV.H, TAU = Math.PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp, smooth = PV.smooth, N2 = PV.noise2;
  const has = (k) => typeof L[k] === 'function';

  /* ------------------------------------------------------------------ util */
  function grain(c, x0, y0, w, h, n, seed, col, a, sz) { // static speckle texture for painted surfaces
    const r = PV.rng(seed); c.save(); c.fillStyle = col;
    for (let i = 0; i < n; i++) { c.globalAlpha = a * (0.3 + 0.7 * r()); const s = sz * (0.5 + r()); c.fillRect(x0 + r() * w, y0 + r() * h, s, s); }
    c.restore();
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
  function softQuad(c, P, Q, bows, n = 10, append = false) {
    if (!append) c.beginPath(); let first = true;
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
    // the sofa's occlusion shadow on the floor and its four short legs
    const S = RM.sofa, sh = PV.makeCanvas(W, H), g = sh.ctx;
    poly(g, P, [[-S.ax - 0.15, FY, S.backZ0 - 0.1], [S.ax + 0.15, FY, S.backZ0 - 0.1], [S.ax + 0.2, FY, S.baseZ + 0.3], [-S.ax - 0.2, FY, S.baseZ + 0.3]]);
    g.fillStyle = night ? 'rgba(0,0,0,0.85)' : 'rgba(18,14,11,0.7)'; g.fill();
    c.save(); c.filter = 'blur(9px)'; c.drawImage(sh.canvas, 0, 0); c.restore();
    for (const [x, z] of [[-S.ax + 0.12, S.baseZ - 0.12], [S.ax - 0.12, S.baseZ - 0.12], [-S.ax + 0.12, S.backZ0 + 0.12], [S.ax - 0.12, S.backZ0 + 0.12]]) {
      poly(c, P, [[x - 0.09, S.legY, z], [x + 0.09, S.legY, z], [x + 0.07, FY, z], [x - 0.07, FY, z]]); c.fillStyle = night ? '#060504' : '#1c1713'; c.fill();
    }
  }

  /* --- the sofa: soft BG-art cushions. Each piece = a face list {Q (4 corners), bows, n (normal), mat}; drawn far to near. */
  // camSide: +1 the camera is off his end (+x, C33), -1 off her end (-x, C35)
  function sofaPieces(night, camSide = 1) {
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
    // the far arm (the end away from the camera): top, inner face, front
    out.push(...armPieces(-camSide));
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
  // one arm of the sofa (sg = -1 her end, +1 his end): its top, inner face, outer face, front; the back panel's end face
  function armPieces(sg) {
    const S = RM.sofa, out = [], add = (Q, n, bows, k, name) => out.push({ Q, n, bows, k: k ?? 1, name });
    const xo = sg * S.ax, xi = sg * S.sx, fz = S.baseZ + 0.04;
    add([[xo, S.backY, S.backZ0], [xo, S.backY, S.backZ1], [xo, S.armY, S.backZ1], [xo, S.armY, S.backZ0]], [sg, 0, 0], null, 0.7, 'backEnd');
    add([[xo, S.armY, S.backZ0], [xo, S.armY, fz], [xo, S.legY, fz], [xo, S.legY, S.backZ0]], [sg, 0, 0], [[sg * 0.03, -0.05, 0], 0, 0, 0], 0.7, 'armOut');
    add([[xi, S.armY, S.backZ1], [xi, S.armY, fz], [xi, 0.5, fz], [xi, 0.5, S.backZ1]], [-sg, 0, 0], [[-sg * 0.03, -0.04, 0], 0, 0, 0], 0.85, 'armIn');
    add([[xi, S.armY, S.backZ0], [xo, S.armY, S.backZ0], [xo, S.armY, fz], [xi, S.armY, fz]], [0, -1, 0], [0, [sg * 0.03, -0.05, 0], 0, [-sg * 0.03, -0.05, 0]], 1, 'armTop');
    add([[xi, S.armY, fz], [xo, S.armY, fz], [xo, S.legY, fz], [xi, S.legY, fz]], [0, 0, 1], [[0, -0.07, 0], 0, 0, 0], 1, 'armF');
    return out;
  }
  function sofaNearPieces(camSide = 1) { return armPieces(camSide); }
  // the big cushion he bought (in her corner, leaning on the arm and the back) and, by day, the blanket folded over the
  // backrest at his end (at night she is wrapped in it).  Painted BG-style with the soft quads.
  function sofaProps(c, P, night, blanket) {
    const S = RM.sofa;
    const tone = (rgb, k) => `rgb(${rgb.map(v => Math.round(v * k)).join(',')})`;
    const cush = night ? [70, 52, 38] : [128, 112, 96];
    const x0 = -S.sx + 0.04, x1 = -S.sx + 0.62, zb = S.seatBZ + 0.02, zf = S.seatBZ + 0.44, yb = S.seatY + 0.04, yt = -1.42;
    // its right side (toward his end), its front (leaning back a little), its top
    softQuad(c, P, [[x1, yb, zf], [x1, yb, zb], [x1 + 0.03, yt, zb - 0.1], [x1 + 0.03, yt + 0.05, zf - 0.12]], [[0.06, 0, 0], [0.05, 0.05, 0], [0.04, -0.05, 0], [0.06, 0, 0.03]]);
    c.fillStyle = tone(cush, 0.78); c.fill();
    softQuad(c, P, [[x0, yb, zf], [x1, yb, zf], [x1 + 0.03, yt + 0.05, zf - 0.12], [x0, yt + 0.05, zf - 0.12]], [[0, 0.03, 0.08], [0.05, 0, 0.07], [0, -0.08, 0.04], [-0.04, 0, 0.06]]);
    c.fillStyle = PV.linGrad(c, 0, P(0, yt, zf)[1], 0, P(0, yb, zf)[1], [[0, tone(cush, 1.06)], [1, tone(cush, 0.82)]]); c.fill();
    c.strokeStyle = night ? 'rgba(0,0,0,0.5)' : 'rgba(30,24,20,0.45)'; c.lineWidth = 1.6; c.stroke();
    softQuad(c, P, [[x0, yt + 0.05, zf - 0.12], [x1 + 0.03, yt + 0.05, zf - 0.12], [x1 + 0.03, yt, zb - 0.1], [x0, yt, zb - 0.1]], [[0, -0.05, 0], 0, [0, -0.05, 0], 0]);
    c.fillStyle = tone(cush, night ? 1.0 : 1.12); c.fill();
    // a piped seam across its face
    const a = P(x0 + 0.05, (yt + yb) / 2, zf - 0.04), b = P(x1, (yt + yb) / 2 - 0.02, zf - 0.04);
    c.strokeStyle = night ? 'rgba(0,0,0,0.35)' : 'rgba(40,32,26,0.28)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 4, b[0], b[1]); c.stroke();
    if (!blanket) return;
    // the blanket folded over the backrest at his end: a soft band over the top and a short fall down the front, knit ribs
    const bx0 = 1.75, bx1 = 3.05, wool = night ? [80, 64, 50] : [150, 138, 122];
    softQuad(c, P, [[bx0, S.backY - 0.06, S.backZ0 - 0.04], [bx1, S.backY - 0.06, S.backZ0 - 0.04], [bx1, S.backY - 0.08, S.backZ1 + 0.04], [bx0, S.backY - 0.08, S.backZ1 + 0.04]], [[0, -0.05, 0], [0.04, 0, 0], [0, -0.06, 0], [-0.04, 0, 0]]);
    c.fillStyle = tone(wool, 1.08); c.fill();
    const hem = (u) => S.cushTopY + 0.32 + 0.06 * Math.sin(u * 9.0);
    c.beginPath(); { const q0 = P(bx0, S.backY - 0.08, S.backZ1 + 0.04); c.moveTo(q0[0], q0[1]); const q1 = P(bx1, S.backY - 0.08, S.backZ1 + 0.04); c.lineTo(q1[0], q1[1]);
      for (let i = 12; i >= 0; i--) { const u = i / 12, x = lerp(bx0, bx1, u), q = P(x, hem(u), S.cushTopZ + 0.06 - 0.1 * (hem(u) - S.cushTopY)); c.lineTo(q[0], q[1]); } c.closePath(); }
    const g0 = P(0, S.backY, S.backZ1)[1], g1 = P(0, hem(0.5), S.cushTopZ)[1];
    c.fillStyle = PV.linGrad(c, 0, g0, 0, g1, [[0, tone(wool, 1.0)], [1, tone(wool, 0.74)]]); c.fill();
    c.strokeStyle = night ? 'rgba(0,0,0,0.5)' : 'rgba(40,34,28,0.4)'; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = night ? 'rgba(0,0,0,0.3)' : 'rgba(60,50,40,0.22)'; c.lineWidth = 1.2;
    for (let i = 1; i < 9; i++) { const u = i / 9, x = lerp(bx0, bx1, u), q0 = P(x, S.backY - 0.07, S.backZ1 + 0.03), q1 = P(x, hem(u) - 0.02, S.cushTopZ + 0.05); c.beginPath(); c.moveTo(q0[0], q0[1]); c.lineTo(q1[0], q1[1]); c.stroke(); }
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
  const C33R = { x: 430, y: 70, w: 1130, h: 970 };   // device-space box the two of them stay inside (max push-in included)
  const C33V = { facing: -0.42, pitch: 0.2, X: 960, Y: 690, s: 138, ax: -0.05, az: -0.12, gap: 2.6 };
  // a cached prop layer (transparent outside the pieces) with the window light on it, the light kept inside the pieces
  function litPieces(P, pieces, night, LO) {
    const c0 = PV.makeCanvas(W, H), c = c0.ctx;
    paintPieces(c, P, pieces, night);
    const m = PV.makeCanvas(W, H); m.ctx.drawImage(c0.canvas, 0, 0);
    if (LO) litPass(c, P, piecesAsSurfs(pieces), LO);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(m.canvas, 0, 0); c.globalCompositeOperation = 'source-over';
    return c0.canvas;
  }
  // soft shadows of what is in the figure buffer, cast on the regions behind them (offset = the light's direction)
  function figureShadows(ctx, fb, regions, col, R) {
    const sw = Math.ceil(R.w / 4), sh = Math.ceil(R.h / 4);
    const sb = PV.buffer('g09_shadowS', sw, sh), sc = sb.ctx;
    sc.clearRect(0, 0, sw, sh); sc.drawImage(fb.canvas, R.x, R.y, R.w, R.h, 0, 0, sw, sh);
    sc.globalCompositeOperation = 'source-in'; sc.fillStyle = col; sc.fillRect(0, 0, sw, sh); sc.globalCompositeOperation = 'source-over';
    const sb2 = PV.buffer('g09_shadowS2', sw, sh); sb2.ctx.clearRect(0, 0, sw, sh); sb2.ctx.filter = 'blur(2.2px)'; sb2.ctx.drawImage(sb.canvas, 0, 0); sb2.ctx.filter = 'none';
    for (const Rg of regions) {
      ctx.save(); Rg.clip(ctx); ctx.clip();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = Rg.a;
      ctx.drawImage(sb2.canvas, 0, 0, sw, sh, R.x + Rg.dx, R.y + Rg.dy, R.w, R.h);
      ctx.restore();
    }
  }
  // the window's light on the two of them: a grey map (128 = no change) projected on their plane (z ~ 0.05): lit panes
  // lighter, the sash bars and the unlit margins darker; composited with soft-light inside their silhouettes only
  function peopleLightMap(P) {
    const c0 = PV.makeCanvas(W, H), g = c0.ctx, Wn = RM.win, d = RM.Ld, b2 = Wn.bar / 2, zp = 0.05;
    const on = (wx, wy) => { const t = (zp - RM.FZ) / d[2]; return P(wx + d[0] * t, wy + d[1] * t, zp); };
    const quad = (x0, y0, x1, y1) => { const a = on(x0, y0), b = on(x1, y0), e = on(x1, y1), f = on(x0, y1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(e[0], e[1]); g.lineTo(f[0], f[1]); g.closePath(); };
    g.fillStyle = 'rgb(112,112,112)'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgb(150,150,150)'; quad(Wn.x0, Wn.y0, Wn.x1, Wn.y1); g.fill();
    g.fillStyle = 'rgb(104,104,104)';
    for (const m of Wn.mull) { quad(m - b2, Wn.y0, m + b2, Wn.y1); g.fill(); }
    for (const tr of Wn.tran) { quad(Wn.x0, tr - b2, Wn.x1, tr + b2); g.fill(); }
    const c1 = PV.makeCanvas(W, H); c1.ctx.filter = 'blur(7px)'; c1.ctx.drawImage(c0.canvas, 0, 0); c1.ctx.filter = 'none';
    return c1.canvas;
  }
  PV.shot('C33', { draw(ctx, t, d, S) {
    const tt = clamp(t, -0.5, d + 0.5), T = 123.5 + t, A = PV.anime, tq = A.onTwos(T);
    const P = g9proj(C33V.facing, C33V.pitch, C33V.X, C33V.Y, C33V.s);
    const LO = { soft: 0.62, screen: 0.12, blur: 8, color: '#fff2e2' };
    const room = PV.cached('g09_frontRoomD5', W, H, (c) => { paintFrontRoom(c, P, false); litPass(c, P, wallSurfs(), LO); paintTableLamp(c, P, false);
      // soft contact shadows under their feet (her slippers at x -2.15/-1.75, his at 1.74/2.16; z ~1.4)
      for (const [x, z, r] of [[-2.15, 1.4, 0.3], [-1.75, 1.5, 0.3], [1.74, 1.45, 0.33], [2.16, 1.55, 0.33]]) {
        const q = P(x, RM.FY, z); c.save(); c.translate(q[0], q[1]); c.scale(1, 0.3); c.fillStyle = PV.radGrad(c, 0, 0, 0, r * P.s, [[0, '#120e0b', 0.55], [0.6, '#120e0b', 0.25], [1, '#120e0b', 0]]); c.fillRect(-r * P.s, -r * P.s, 2 * r * P.s, 2 * r * P.s); c.restore();
      } });
    const sofa = PV.cached('g09_frontSofaD4', W, H, (c) => { c.drawImage(litPieces(P, sofaPieces(false), false, LO), 0, 0); sofaProps(c, P, false, true); });
    const near = PV.cached('g09_frontNearD3', W, H, (c) => c.drawImage(litPieces(P, sofaNearPieces(), false, LO), 0, 0));
    const sky = 0.93 + 0.07 * Math.sin(tt * 0.55 + 0.6) + 0.02 * N2(tt * 0.4, 3.1);   // the overcast light breathing (a cloud passing)
    const cam = { zoom: 1 + 0.045 * PV.ease.inOut(clamp(tt / d)), cx: 960, cy: 600 }, z = cam.zoom;
    // --- acting (on twos).  She: from the first word (123.9) her head turns a hair toward him — not to look at him; her
    // empty eyes stay on nothing; her lips barely move (V12, the real envelope at ~half amplitude: 平坦な声).
    // He: looking down at the empty seat between them; his eyes lift toward her as she starts, sink back; after the line
    // (129.45) his head sinks a little further and his eyes close for a long moment.
    const herTurn = PV.ease.inOut(clamp((tq - 123.95) / 1.0)), sink = PV.ease.inOut(clamp((tq - 129.1) / 0.9));
    const lift = PV.smooth(124.0, 124.5, tq) * (1 - PV.smooth(125.6, 126.4, tq));
    const close = PV.smooth(129.35, 129.75, tq);
    const mo = A.mouth(T, 'senpai');
    const herHead = { expr: 'empty', rim: 0, eyes: { look: [-0.08, 0.22] }, mouth: { shape: 'flat', open: 0.68 * mo.open } };
    const hisHead = { expr: 'neutral', rim: 0, undereye: 0.32, brows: { inner: 0.12, outer: -0.15 },
      eyes: { open: lerp(0.6, 0.0, close) + 0.14 * lift, look: [lerp(-0.35, -0.6, lift), lerp(0.55, 0.15, lift)], sad: 0.3 } };
    if (close > 0.98) hisHead.eyes.closed = 'down';
    // the figures into a buffer (same camera transform)
    const R = C33R, fb = PV.buffer('g09_figs'), fc = fb.ctx; fc.setTransform(1, 0, 0, 1, 0, 0); fc.clearRect(R.x, R.y, R.w, R.h);
    fc.setTransform(1, 0, 0, 1, 0, 0); PV.camera(fc, cam);
    const an = P(C33V.ax, 0, C33V.az);
    A.pair(fc, { pose: 'sit_side', x: an[0], y: an[1], scale: C33V.s, T, light: 'room_gray', facing: C33V.facing, camPitch: C33V.pitch, keyDir: -2.58, rimDir: -2.58, rimA: 0,
      params: { side: 'right', gap: C33V.gap, seat: 'sofa', sofa: false },
      senpai: { outfit: 'home', costume: { legs: 'tights' }, params: { look: 0.05 + 0.13 * herTurn, nod: 0.1 }, head: herHead },
      boy: { outfit: 'year2', costume: { shoes: 'slipper' }, params: { look: -0.42, nod: 0.24 + 0.1 * sink, slump: 0.04, seatH: 1.55 / 1.06 }, head: hisHead } });
    fc.setTransform(1, 0, 0, 1, 0, 0);
    // --- compose: room → their shadows on the wall → sofa → their shadows on the cushions → them → the near arm
    ctx.save(); PV.camera(ctx, cam);
    ctx.drawImage(room, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * (sky - 0.86); ctx.fillStyle = '#3a3630'; ctx.fillRect(430, -50, W - 380, 470); ctx.restore();   // the light breathing on the lit wall
    drawDeskClock(ctx, P, T, false);
    figureShadows(ctx, fb, [{ clip: (c) => poly(c, P, [[RM.LX, -16, RM.BZ], [RM.RX, -16, RM.BZ], [RM.RX, RM.FY, RM.BZ], [RM.LX, RM.FY, RM.BZ]]), dx: 113 * z, dy: 71 * z, a: 0.5 * sky }], '#5a544e', R);
    ctx.drawImage(sofa, 420, 300, 1110, 680, 420, 300, 1110, 680);
    figureShadows(ctx, fb, [{ clip: (c) => { c.beginPath(); for (const f of sofaPieces(false)) if (/^cush\d|^cushTop|^backTop|^seat\d/.test(f.name)) softQuad(c, P, f.Q, f.bows, 10, true); }, dx: 50 * z, dy: 30 * z, a: 0.45 * sky }], '#5a544e', R);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fb.canvas, R.x, R.y, R.w, R.h, R.x, R.y, R.w, R.h); ctx.restore();
    // the window light on them (inside their silhouettes)
    const lmap = PV.cached('g09_c33peopleLight', W, H, (c) => c.drawImage(peopleLightMap(P), 0, 0));
    const lm = PV.buffer('g09_c33lm'), lc = lm.ctx; lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(R.x, R.y, R.w, R.h);
    lc.save(); lc.beginPath(); lc.rect(R.x, R.y, R.w, R.h); lc.clip(); PV.camera(lc, cam); lc.drawImage(lmap, 0, 0); lc.restore();
    lc.globalCompositeOperation = 'destination-in'; lc.drawImage(fb.canvas, R.x, R.y, R.w, R.h, R.x, R.y, R.w, R.h); lc.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.85 * (0.6 + 0.4 * sky); ctx.drawImage(lm.canvas, R.x, R.y, R.w, R.h, R.x, R.y, R.w, R.h); ctx.restore();
    ctx.drawImage(near, 1240, 450, 290, 520, 1240, 450, 290, 520);
    // dust hanging in the flat light, barely moving
    if (has('dust')) L.dust(ctx, tt, { seed: 33, count: 40, x0: 380, x1: 1700, y0: 60, y1: 760, size: 2.0, alpha: 0.26, drift: 18, vx: 1.2, vy: 0.6, color: '#f3e8d6' });
    ctx.restore();
  } });

  /* ======================================================================
   * C35 夜のソファ 6.0s — the lamp, her head on his shoulder (the gap closes only while she sleeps)
   *   → slow push-in → refocusing dissolve to the hands on their laps: his hand holds hers palm to palm while his thumb
   *   strokes the scar on the back of it → 140.0 (t=5.0) the stroking stops, his fingers fold down between hers
   * ==================================================================== */
  // the same room at night, seen from HER side of the sofa (facing +0.3, the guide's C35 camera): she has slid against him
  // while asleep (the gap is filled only now), wrapped in the blanket; the small table lamp beside her is the only light.
  const C35V = { facing: 0.12, pitch: 0.33, X: 1370, Y: 1200, s: 265, ax: -1.55, az: -0.1 };
  const C35_X0 = 3.3, C35_X1 = 4.0;   // the refocusing dissolve to the hands (after his 「嫌だ……」 137.94–138.4)
  function lampGlowFront(c, P) { // the lamp's warm pool on the wall and the sofa back, soft cones out of the drum shade
    const T0 = RM.table, lx = T0.x - 0.15, lz = T0.z - 0.15, sh = P(lx, T0.y - 1.1, lz), s = P.s;
    const t2 = PV.makeCanvas(W, H), b = t2.ctx;
    let g = b.createRadialGradient(sh[0], sh[1], 10, sh[0], sh[1], 6.2 * s);
    g.addColorStop(0, 'rgba(240,190,120,0.55)'); g.addColorStop(0.22, 'rgba(214,150,86,0.24)'); g.addColorStop(0.6, 'rgba(160,100,56,0.07)'); g.addColorStop(1, 'rgba(160,100,56,0)');
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    const top = P(lx, T0.y - 1.55, lz), bot = P(lx, T0.y - 0.62, lz), rT = 0.42 * s, rB = 0.55 * s;
    for (const [y0, y1, a, up, r0] of [[top[1] - 2.2 * s, top[1], 0.22, true, rT], [bot[1], bot[1] + 2.6 * s, 0.2, false, rB]]) {
      const cg = b.createLinearGradient(0, up ? y1 : y0, 0, up ? y0 : y1); cg.addColorStop(0, PV.rgba('#f2c890', a)); cg.addColorStop(1, PV.rgba('#f2c890', 0));
      b.fillStyle = cg; b.beginPath();
      if (up) { b.moveTo(top[0] - r0, y1); b.lineTo(top[0] + r0, y1); b.lineTo(top[0] + r0 + 0.9 * s, y0); b.lineTo(top[0] - r0 - 0.9 * s, y0); }
      else { b.moveTo(bot[0] - r0, y0); b.lineTo(bot[0] + r0, y0); b.lineTo(bot[0] + r0 + 1.1 * s, y1); b.lineTo(bot[0] - r0 - 1.1 * s, y1); }
      b.closePath(); b.fill();
    }
    c.save(); c.globalCompositeOperation = 'screen'; c.filter = 'blur(18px)'; c.drawImage(t2.canvas, 0, 0); c.restore();
  }
  function c35Room(ctx, tt, T) {
    const A = PV.anime, tq = A.onTwos(T);
    const P = g9proj(C35V.facing, C35V.pitch, C35V.X, C35V.Y, C35V.s);
    const room = PV.cached('g09_frontRoomN6', W, H, (c) => { paintFrontRoom(c, P, true); paintTableLamp(c, P, true);
      c.drawImage(litPieces(P, sofaPieces(true, -1), true, null), 0, 0); sofaProps(c, P, true, false); lampGlowFront(c, P);
      // the room falls into the dark away from the lamp (to the right)
      const lp = P(RM.table.x, -1.5, RM.table.z), fg = c.createRadialGradient(lp[0], lp[1], 2 * P.s, lp[0], lp[1], 9 * P.s);
      fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = fg; c.fillRect(0, 0, W, H); });
    const near = PV.cached('g09_frontNearN5', W, H, (c) => { c.drawImage(litPieces(P, sofaNearPieces(-1), true, null), 0, 0);
      const lp = P(RM.table.x, -1.5, RM.table.z); c.globalCompositeOperation = 'source-atop';
      const g = c.createRadialGradient(lp[0], lp[1], 0, lp[0], lp[1], 3.2 * P.s); g.addColorStop(0, 'rgba(255,190,120,0.35)'); g.addColorStop(1, 'rgba(255,190,120,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); });
    ctx.drawImage(room, 0, 0);
    drawDeskClock(ctx, P, T, true);
    // --- acting (on twos).  135.15–136.0 (the blanket rustles at 135.2): her head slides the last bit onto his shoulder.
    // 136.0 「はなして。」 her lips barely move, asleep. He looks down at her; at her whisper his brows knit; 137.94
    // 「嫌だ……」 he says it into her hair, and closes his eyes.
    const soft = tt > C35_X0;   // defocused in the dissolve: no rim light (invisible there, and it is the costly part)
    const settle = PV.ease.inOut(clamp((tq - 135.15) / 0.85));
    const hurt = PV.smooth(136.2, 136.9, tq), shut = PV.smooth(138.05, 138.45, tq);
    const herHead = { expr: 'sleep', rim: soft ? 0 : 1, undereye: 0.22, blush: 0.08, mouth: { shape: 'flat', open: 0.5 * A.mouth(T, 'senpai').open } };
    const hisHead = { expr: 'sad', rim: soft ? 0 : 1, talk: true, T, undereye: 0.28, brows: { inner: 0.35 + 0.45 * hurt, outer: -0.2, furrow: 0.35 * hurt },
      eyes: { open: lerp(0.62, 0.0, shut), look: [-0.55, 0.65], sad: 0.5 } };
    if (shut > 0.98) hisHead.eyes.closed = 'down';
    const an = P(C35V.ax, 0, C35V.az);
    PV.anime.pair(ctx, { pose: 'sit_side', x: an[0], y: an[1], scale: C35V.s, T, light: 'lamp', facing: C35V.facing, camPitch: C35V.pitch, keyDir: -2.95, rimDir: -2.95, rimA: soft ? 0 : undefined,
      params: { side: 'right', gap: 0, seat: 'sofa', sofa: false, lean: lerp(0.42, 0.6, settle), blanket: true },
      senpai: { outfit: 'home', costume: { legs: 'tights' }, params: { slump: lerp(0.55, 0.65, settle), nod: -0.22 }, head: herHead },
      boy: { outfit: 'year2', costume: { shoes: 'slipper' }, params: { look: -0.18, nod: -0.04, tilt: -0.08 * settle }, head: hisHead } });
    ctx.drawImage(near, 0, 0);
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
    const tt = clamp(t, -0.5, d + 0.5), T = 135.0 + t;
    const X0 = C35_X0, X1 = C35_X1, mixK = PV.ease.inOut(clamp((tt - X0) / (X1 - X0)));
    // stage 1: their two faces (her sleeping face on his shoulder, his face), a slow push-in; during the dissolve the camera
    // sinks toward their hands / stage 2: the hands (comes into focus through the dissolve, keeps creeping in, a last small
    // push as the fingers lace at 140.0)
    const p1 = PV.ease.inOut(clamp(tt / X0)), dr = PV.ease.inOut(clamp((tt - X0 + 0.15) / (X1 - X0 + 0.15))), q2 = clamp((tt - X0) / (d - X0));
    const st1 = (c) => { PV.camera(c, { zoom: 1.0 + 0.07 * p1 + 0.08 * dr, cx: 1000, cy: 330, y: -150 * dr }); c35Room(c, tt, T); };
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
  // The doorway seen from the dark room, a little closer than a wide shot so her face reads (door 205 cm = 858 px).
  // The door is hinged on the RIGHT jamb and opens away from us: as the closer swings it home, its free edge sweeps from
  // the right toward the left jamb — it covers her back first and her face (turned to her left, toward the left jamb) last.
  const DOOR = { x0: 794, x1: 1126, y0: 70, y1: 928, vpX: 960, vpY: 430, f: 1188 };
  const DOOR_PXCM = (DOOR.y1 - DOOR.y0) / 205;   // px per cm at the door plane
  // door leaf open angle (rad): ajar (~69°, a gap rather than a wide-open door) while she speaks and walks away; at
  // 2.15 (143.15, 「好きになりなさい」) the closer swings it home: it eases off, then lands with speed at t=3.0 = 144.00,
  // exactly on the door SFX thump (sfx_plan: door@144.0)
  const DOOR_SHUT = 3.0;
  const doorAng = (t) => { const k = clamp((t - 2.15) / (DOOR_SHUT - 2.15)); return 1.2 * (1 - k * k * (2 - k)); };
  const dproj = (x, y, z) => { const D = DOOR, k = D.f / (D.f + z); return [D.vpX + (x - D.vpX) * k, D.vpY + (y - D.vpY) * k, k]; };
  function doorGap(t) { // projected free edge of the leaf (hinged on the right jamb, opening away from us)
    const D = DOOR, a = Math.max(0, doorAng(t)), w = D.x1 - D.x0;
    const z = Math.sin(a) * w, x = D.x1 - Math.cos(a) * w, k = D.f / (D.f + z);
    return { xt: D.vpX + (x - D.vpX) * k, yt: D.vpY + (D.y0 - D.vpY) * k, xb: D.vpX + (x - D.vpX) * k, yb: D.vpY + (D.y1 - D.vpY) * k, a };
  }
  function hallway(c) { // the bright corridor beyond the door (overexposed, warm), painted once
    const D = DOOR;
    c.fillStyle = PV.linGrad(c, 0, D.y0, 0, D.y1, [[0, '#ffe2b0'], [0.45, '#fff2d8'], [0.75, '#ffd9a0'], [1, '#e8b878']]); c.fillRect(D.x0 - 20, D.y0 - 20, D.x1 - D.x0 + 40, D.y1 - D.y0 + 40);
    // floor and wall lines receding to the vanishing point, softened by the glare
    c.save(); c.strokeStyle = 'rgba(176,122,70,0.35)'; c.lineWidth = 3; c.filter = 'blur(2px)';
    for (const [x, y] of [[D.x0, D.y1 - 150], [D.x1, D.y1 - 150], [D.x0, D.y0 + 80], [D.x1, D.y0 + 80]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(D.vpX + (x - D.vpX) * 0.18, D.vpY + (y - D.vpY) * 0.18); c.stroke(); }
    c.restore();
    // corridor floor: a warm, slightly darker plane from the threshold to the far end (so her feet stand on it)
    const fk = 0.3, fyFar = D.vpY + (D.y1 - D.vpY) * fk;
    c.fillStyle = PV.linGrad(c, 0, fyFar, 0, D.y1, [[0, '#f3cf98'], [0.35, '#e9b979'], [1, '#d99e5e']]);
    c.beginPath(); c.moveTo(D.x0 - 20, D.y1 + 20); c.lineTo(D.x1 + 20, D.y1 + 20); c.lineTo(D.vpX + (D.x1 - D.vpX) * fk, fyFar); c.lineTo(D.vpX + (D.x0 - D.vpX) * fk, fyFar); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,240,214,0.55)'; c.fillRect(D.vpX + (D.x0 - D.vpX) * fk, fyFar - 2, (D.x1 - D.x0) * fk, 3); // far skirting catching light
    // the corridor's left wall a shade darker than the glare (her face reads against it)
    c.fillStyle = 'rgba(150,96,52,0.22)'; c.beginPath(); c.moveTo(D.x0 - 20, D.y0 - 20); c.lineTo(D.vpX + (D.x0 - D.vpX) * fk, D.vpY + (D.y0 - D.vpY) * fk); c.lineTo(D.vpX + (D.x0 - D.vpX) * fk, fyFar); c.lineTo(D.x0 - 20, D.y1 + 20); c.closePath(); c.fill();
    const g = c.createRadialGradient(D.vpX, D.vpY - 70, 10, D.vpX, D.vpY - 70, 340); g.addColorStop(0, 'rgba(255,255,248,0.95)'); g.addColorStop(1, 'rgba(255,248,230,0)');
    c.fillStyle = g; c.fillRect(D.x0, D.y0, D.x1 - D.x0, D.y1 - D.y0);
  }
  // the aunt's walk in the corridor: from just past the threshold to ~0.9 door-widths deep (clear of the door's swing),
  // slowing to a stop as she glances back.  Returns {z (px depth), x (door-plane px), ph (walk phase), st (stride 0..1)}
  const AUNT = { x: 868, z0: 30, z1: 300, tStop: 1.35 };
  function auntPath(t) {
    const u = clamp(t / AUNT.tStop);
    const pos = 1 - Math.pow(1 - u, 2.2);   // decelerating to a stop
    const st = Math.pow(1 - u, 1.4);        // the stride dies away as she stops
    const ph = 0.15 + 1.1 * pos;            // the walk phase advances with the distance (~two slow steps)
    return { z: lerp(AUNT.z0, AUNT.z1, pos), x: AUNT.x, ph, st };
  }
  const C36CAM = { zoom: 1.1, cx: 960, cy: 470 };   // static, a little closer than the old wide: her face reads
  PV.shot('C36', { draw(ctx, t, d, S) {
    S.post = Object.assign({}, S.post, { bloom: 0.22 });   // the bright doorway: keep the thin lines of her profile crisp
    const tt = clamp(t, -0.5, d + 0.5), D = DOOR, T = 141.0 + t, A = PV.anime, tq = A.onTwos(T), tl = tq - 141.0;
    ctx.save(); PV.camera(ctx, C36CAM);
    const hall = PV.cached('g09_hall3', W, H, (c) => hallway(c));
    const G = doorGap(tt), shut = tt >= DOOR_SHUT;
    // the opening still lit: polygon between the left jamb and the leaf's free edge
    const lit = (c) => { c.beginPath(); c.moveTo(D.x0, D.y0); c.lineTo(Math.max(D.x0, G.xt), G.yt); c.lineTo(Math.max(D.x0, G.xb), G.yb); c.lineTo(D.x0, D.y1); c.closePath(); };
    const openK = clamp((G.xt - D.x0) / (D.x1 - D.x0)); // how much light still comes in (1 = fully open)
    // --- the dark room
    const room = PV.cached('g09_c36room3', W, H, (c) => {
      c.fillStyle = '#070607'; c.fillRect(0, 0, W, H);
      c.fillStyle = PV.radGrad(c, D.vpX, 720, 50, 1150, [[0, '#2a2622'], [0.5, '#141012'], [1, '#070608']]); c.fillRect(0, 0, W, H);
      // jambs and lintel (the frame faces us, in the dark), with a step down to the entrance
      c.fillStyle = '#1a1614'; c.fillRect(D.x0 - 44, D.y0 - 44, 44, D.y1 - D.y0 + 44); c.fillRect(D.x1, D.y0 - 44, 44, D.y1 - D.y0 + 44); c.fillRect(D.x0 - 44, D.y0 - 44, D.x1 - D.x0 + 88, 44);
      c.fillStyle = PV.linGrad(c, 0, D.y1 + 34, 0, D.y1 + 84, [[0, '#000000', 0.0], [0.5, '#000000', 0.35], [1, '#000000', 0]]); c.fillRect(0, D.y1 + 34, W, 50);
      // memory: soft vignette (baked)
      const v = c.createRadialGradient(D.vpX, 600, 320, D.vpX, 600, 1200); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
    });
    ctx.drawImage(room, 0, 0);
    if (!shut) {
      // everything bright happens inside this region (the opening, its spill on the floor, the halo round them)
      const RX = 500, RY = 0, RW = 920, RH = H;
      const AP = auntPath(tl), fp = dproj(AP.x, D.y1, AP.z), k = fp[2];
      const fx = fp[0], fy = fp[1];
      // --- the corridor seen through the opening (her shadows on its floor), the leaf, the spill on our floor
      const buf = PV.buffer('g09_c36light'); const b = buf.ctx; b.clearRect(RX, RY, RW, RH);
      b.save(); lit(b); b.clip(); b.drawImage(hall, RX, RY, RW, RH, RX, RY, RW, RH);
      b.fillStyle = 'rgba(74,44,22,0.62)'; // her shadow on the corridor floor, toward the door (soft: drawn twice, offset)
      for (const o of [0, 1]) { b.beginPath(); b.moveTo(fx - (20 + 8 * o) * k, fy); b.lineTo(fx + (20 + 8 * o) * k, fy); b.lineTo(fx + 30 + 10 * o, D.y1 + 14); b.lineTo(fx - 50 - 10 * o, D.y1 + 14); b.closePath(); b.fill(); }
      b.restore();
      if (G.a > 0.02) { // the leaf itself (dark slab, its inner face catching a little light at the edge)
        b.save(); b.fillStyle = '#0c0a09'; b.beginPath(); b.moveTo(D.x1, D.y0); b.lineTo(G.xt, G.yt); b.lineTo(G.xb, G.yb); b.lineTo(D.x1, D.y1); b.closePath(); b.fill();
        b.strokeStyle = 'rgba(255,214,150,0.55)'; b.lineWidth = 2.5; b.beginPath(); b.moveTo(G.xt, G.yt); b.lineTo(G.xb, G.yb); b.stroke(); b.restore();
      }
      b.save(); b.globalCompositeOperation = 'destination-over'; // light on the floor of the dark room: a widening spill, narrowing with the gap
      const fl = 0.55 * Math.pow(openK, 0.8), xa = Math.max(D.x0, G.xb), spill = (x) => D.vpX + (x - D.vpX) * 1.95;
      b.beginPath(); b.moveTo(D.x0, D.y1); b.lineTo(xa, D.y1); b.lineTo(spill(xa) + 40, H); b.lineTo(spill(D.x0) - 30, H); b.closePath();
      b.fillStyle = PV.linGrad(b, 0, D.y1, 0, H, [[0, '#ffcf8a', fl], [0.45, '#e8b878', fl * 0.4], [1, '#e8b878', fl * 0.08]]); b.fill();
      b.restore();
      b.save(); b.globalCompositeOperation = 'multiply'; b.globalAlpha = 0.8 * openK * (1 - clamp((tt - 2.1) / 0.6)); // her long shadow on the spill, pointing back at us
      b.fillStyle = 'rgb(40,28,20)';
      for (const o of [0, 1]) { b.beginPath(); b.moveTo(fx - (22 + 8 * o) * k, D.y1); b.lineTo(fx + (22 + 8 * o) * k, D.y1); b.lineTo(fx + 120 + 14 * o - 160, H); b.lineTo(fx - 80 - 14 * o - 160, H); b.closePath(); b.fill(); }
      b.restore();
      // --- glow / halation of the bright opening into the dark (memory), from the corridor without her
      const hb = PV.buffer('g09_c36halo', RW / 4, RH / 4); hb.ctx.clearRect(0, 0, RW / 4, RH / 4); hb.ctx.filter = 'blur(10px)'; hb.ctx.drawImage(buf.canvas, RX, RY, RW, RH, 0, 0, RW / 4, RH / 4); hb.ctx.filter = 'none';
      const hw = PV.buffer('g09_c36halo2', RW / 4, RH / 4); hw.ctx.clearRect(0, 0, RW / 4, RH / 4); hw.ctx.filter = 'sepia(1) saturate(3) hue-rotate(-20deg) blur(4px)'; hw.ctx.drawImage(hb.canvas, 0, 0); hw.ctx.filter = 'none';
      ctx.drawImage(buf.canvas, RX, RY, RW, RH, RX, RY, RW, RH);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.55; ctx.drawImage(hb.canvas, RX, RY, RW, RH);
      ctx.globalAlpha = 0.3; ctx.drawImage(hw.canvas, RX, RY, RW, RH); ctx.restore();
      // --- her (PV.anime): walking out with her back to us, slowing; over 「ちゃんと、」 her head turns over her LEFT
      // shoulder (a small turn: the body stays turned away) so her left profile shows against the corridor's light;
      // eyes down as she says it, flat; at 「なりなさい」 her gaze lifts a little and softens.  The leaf occludes her as it
      // swings shut.  Backlit by the corridor (warm rim), her face in soft reflected light.  A contact shadow.
      const turn = PV.ease.inOut(clamp((tl - 0.45) / 0.85)), lift = PV.smooth(2.25, 2.7, tl);
      const mo = A.mouth(T, 'aunt');
      ctx.save(); lit(ctx); ctx.clip();
      // contact shadow: a soft dark pool under her feet (the corridor light comes from behind her, so it also stretches toward us)
      ctx.save(); ctx.translate(fx - 4 * k, fy + 3 * k); ctx.scale(1, 0.22); ctx.fillStyle = PV.radGrad(ctx, 0, 0, 0, 62 * k, [[0, '#3c2210', 0.85], [0.55, '#3c2210', 0.5], [1, '#3c2210', 0]]); ctx.fillRect(-62 * k, -62 * k, 124 * k, 124 * k); ctx.restore();
      A.figure(ctx, { who: 'aunt', outfit: 'coat', pose: 'walk', facing: -2.8 + 0.12 * turn, x: fx, y: fy, scale: (164 / 7.2) * DOOR_PXCM * k, T, light: 'window',
        rimDir: -0.75, rimColor: '#ffdcaa', keyDir: -0.75,
        params: { speed: 0, phase: AP.ph, stride: 0.4 * AP.st, neckYaw: 1.18 * turn, twist: 0.22 * turn, nod: 0.06 },
        head: { shade: 0.6, lightDir: -0.5, rimW: 1.4, brows: { inner: 0.08 * lift, outer: 0 },
          eyes: { open: lerp(0.62, 0.8, lift), look: [-0.4, lerp(0.55, 0.15, lift)] }, mouth: { shape: 'flat', open: 0.85 * mo.open } } });
      ctx.restore();
      // light shafts in the dusty air of the dark room, fanning down from the opening onto the floor (narrowing with it)
      if (has('godRays')) L.godRays(ctx, tt, { x: (D.x0 + Math.max(D.x0, G.xb)) / 2, y: D.y1 - 160, angle: Math.PI / 2 + 0.12, spread: 0.8 * openK + 0.1, count: 6, length: 900, width: 140 * openK + 10, flare: 2.4, color: '#ffd9a0', alpha: 0.12 * openK, seed: 7, flicker: 0.4 });
      // the frame edges catch the light (thin lines at the jambs)
      ctx.save(); ctx.strokeStyle = PV.rgba('#ffd59a', 0.5 * openK); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(D.x0 - 1, D.y0); ctx.lineTo(D.x0 - 1, D.y1); ctx.moveTo(D.x0, D.y0 - 1); ctx.lineTo(D.x1, D.y0 - 1); ctx.stroke(); ctx.restore();
      if (has('dust')) L.dust(ctx, tt, { seed: 61, count: 40, x0: 640, x1: 1340, y0: 220, y1: 1080, size: 2.4, alpha: 0.55 * openK, drift: 30, vx: -3, vy: -2, color: '#ffe2b0',
        mask: (x, y) => clamp(1 - Math.abs(x - (D.x0 + 120)) / (200 + Math.max(0, y - D.y1) * 0.9)) * (y > D.y0 ? 1 : 0) });
    } else {
      // the afterimage of the last thin line, fading in the dark (gone by 144.3, when the clock stops)
      const a = 0.5 * (1 - clamp((tt - DOOR_SHUT) / 0.3));
      if (a > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
        for (const [w, aa] of [[12, 0.18], [6, 0.4], [2.5, 1]]) { ctx.strokeStyle = PV.rgba('#ffcf8a', a * aa); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(D.x0 + 1, D.y0 + 10); ctx.lineTo(D.x0 + 1, D.y1 - 10); ctx.stroke(); }
        ctx.restore();
      }
    }
    ctx.restore();
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

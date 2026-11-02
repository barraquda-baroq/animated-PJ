// g07_hospital_storm — C25〜C28（病室の主観 → 閉じる世界 → 片手の〈別れの曲〉 → 嵐の白い大橋 → 欄干の振り向き）
//   C25 83.5–91.0  先輩の主観。ピントの合わない病室、窓際の逆光に立つ少年（陽炎のように揺れる輪郭）。
//                  87.25/88.0 の心電図に合わせて周囲から闇が閉じ（87.3–88.2）、完全な暗闇で声が反響する。
//   C26 91.0–96.0  完全な黒（縦書きモノローグ）→ 93.4 夕方の病室：シーツの上で鍵盤をなぞる左手、光の幻の鍵盤、
//                  画面の端に動かないギプスの右手。95.6 遠雷で光が翳り、95.8 指が止まる。
//   C27 96.0–98.5  96.0 の雷光が一瞬だけ白い大橋（C15 の写真と同じ構図）を浮かび上がらせる。停電した街、
//                  欄干の前の小さな人影（病衣・ギプスだけが点のように光る）。雨の三層パララックス。
//   C28 98.5–103.5 欄干の前の先輩、斜め後ろからのミディアム。98.7 雨が2コマで消えて世界が静止、ゆっくり振り向く
//                  （逆光で表情は見えない）。『分からないわよ！』で風と雨が戻り、102.7 背後に稲妻が落ちて白く飛ぶ。
// Deterministic: every frame is a pure function of t.
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, PI = Math.PI, TAU = PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp, sm = PV.smooth, N2 = PV.noise2, R1 = PV.rand1;
  const q12 = (t) => Math.floor(t * 12 + 1e-6) / 12;              // 2コマ打ち
  const ease = PV.ease;
  const lerpHex = (a, b, k) => { const A = PV.hex2rgb(a), B = PV.hex2rgb(b); return '#' + [0, 1, 2].map((i) => Math.round(lerp(A[i], B[i], k)).toString(16).padStart(2, '0')).join(''); };

  /* ======================================================================= shared helpers */
  function buf(key, w, h) { w = w || W; h = h || H; const b = PV.buffer('g07:' + key, w, h); b.ctx.clearRect(0, 0, w, h); return b; }
  // draw a full-frame canvas blurred (blur done at reduced resolution, then upscaled)
  function blurBlit(ctx, src, px, alpha, key, mode) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (mode) ctx.globalCompositeOperation = mode;
    if (px < 0.45) { ctx.drawImage(src, 0, 0); ctx.restore(); return; }
    const q = px > 9 ? 0.25 : 0.5, w = Math.round(W * q), h = Math.round(H * q);
    const b = PV.buffer('g07:bb' + (key || '') + q, w, h); b.ctx.clearRect(0, 0, w, h);
    b.ctx.filter = 'blur(' + (px * q).toFixed(2) + 'px)'; b.ctx.drawImage(src, 0, 0, w, h); b.ctx.filter = 'none';
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(b.canvas, 0, 0, W, H); ctx.restore();
  }
  // draw fn at reduced resolution q (keeping the ctx's current transform), optional blur at that resolution, then upscale
  function lowRes(ctx, key, q, fn, blurPx, alpha, mode) {
    const bw = Math.ceil(W * q), bh = Math.ceil(H * q), b = PV.buffer('g07:lr' + key, bw, bh), c = b.ctx;
    c.clearRect(0, 0, bw, bh);
    const m = ctx.getTransform(); c.setTransform(m.a * q, m.b * q, m.c * q, m.d * q, m.e * q, m.f * q);
    fn(c);
    c.setTransform(1, 0, 0, 1, 0, 0);
    let src = b.canvas;
    if (blurPx && blurPx * q > 0.3) {
      const b2 = PV.buffer('g07:lrb' + key, bw, bh); b2.ctx.clearRect(0, 0, bw, bh);
      b2.ctx.filter = 'blur(' + (blurPx * q).toFixed(2) + 'px)'; b2.ctx.drawImage(b.canvas, 0, 0); b2.ctx.filter = 'none'; src = b2.canvas;
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); if (alpha !== undefined) ctx.globalAlpha *= alpha; if (mode) ctx.globalCompositeOperation = mode;
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, W, H); ctx.restore();
  }
  // Catmull-Rom spline through pts (closed or open), appended to the current path
  function spline(c, pts, closed, move) {
    const n = pts.length; if (n < 2) return;
    const P = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    if (move !== false) c.moveTo(pts[0][0], pts[0][1]); else c.lineTo(pts[0][0], pts[0][1]);
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), s1 = p1[2] ? 0 : 1 / 6, s2 = p2[2] ? 0 : 1 / 6;
      c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * s1, p1[1] + (p2[1] - p0[1]) * s1, p2[0] - (p3[0] - p1[0]) * s2, p2[1] - (p3[1] - p1[1]) * s2, p2[0], p2[1]);
    }
    if (closed) c.closePath();
  }
  const blob = (c, pts) => { c.beginPath(); spline(c, pts, true); c.fill(); };
  // a tapered ribbon along a polyline (widths per point) appended to the current path
  function ribbon(c, pts, ws) {
    const n = pts.length, A = [], B = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1e-6; tx /= l; ty /= l;
      A.push([pts[i][0] + ty * ws[i], pts[i][1] - tx * ws[i]]); B.push([pts[i][0] - ty * ws[i], pts[i][1] + tx * ws[i]]);
    }
    const tip = pts[n - 1];
    spline(c, A.concat([[tip[0], tip[1], 1]], B.reverse()), true);
  }
  // tapered limb p0->p1 (half widths r0, r1)
  function limb(c, p0, p1, r0, r1) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1e-6, ux = dx / l, uy = dy / l, ang = Math.atan2(uy, ux);
    c.beginPath();
    c.moveTo(p0[0] + uy * r0, p0[1] - ux * r0); c.lineTo(p1[0] + uy * r1, p1[1] - ux * r1);
    c.arc(p1[0], p1[1], Math.max(1e-4, r1), ang - PI / 2, ang + PI / 2, false);
    c.lineTo(p0[0] - uy * r0, p0[1] + ux * r0);
    c.arc(p0[0], p0[1], Math.max(1e-4, r0), ang + PI / 2, ang + 1.5 * PI, false);
    c.closePath(); c.fill();
  }

  /* ======================================================================= C25 */
  // 83.5–91.0 (t 0–7.5). Her POV: the hospital room out of focus; the boy stands against the window light (no guitar).
  //  V06 83.85–86.9 (t 0.35–3.4): during『先輩……』her eyes find him for a moment (the focus breathes in), then lose him.
  //  87.25 / 88.0 (t 3.75 / 4.5): the two clear ECG beeps — the dark closes from the edges in two lurches, toward him
  //  (87.3–88.2, t 3.8–4.7). 88.35–90.8 V07 in complete darkness (only a dying after-image of the window).
  const C25 = { win: [150, 96, 1770, 866], pillar: [930, 992], foot: 868, boy: { x: 1236, y: 300, s: 1.36 } };
  function c25Room() {
    return PV.cached('g07:c25room', W, H, (c) => {
      const [wx0, wy0, wx1, wy1] = C25.win;
      // cold white wall
      const wg = c.createLinearGradient(0, 0, 0, H); wg.addColorStop(0, '#d9e2e8'); wg.addColorStop(0.5, '#e6edf1'); wg.addColorStop(1, '#dbe3e9');
      c.fillStyle = wg; c.fillRect(0, 0, W, H);
      // outside: the high autumn sky, the bay and the far white bridge (the C24 view, seen from the bed)
      c.save(); c.beginPath(); c.rect(wx0, wy0, wx1 - wx0, wy1 - wy0); c.clip();
      L.hospitalView(c, 0, { x: wx0, y: wy0, w: wx1 - wx0, h: wy1 - wy0, seed: 24, bridgeX: 0.3, wind: 0.6, alignY: 0.42, leafBlur: 2 });
      // over-exposed: the eye looks into the light
      c.globalCompositeOperation = 'screen'; c.fillStyle = 'rgba(236,244,250,0.42)'; c.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
      c.restore();
      // the pillar between the windows (in its own shade)
      const pg = c.createLinearGradient(C25.pillar[0], 0, C25.pillar[1], 0); pg.addColorStop(0, '#c7d2db'); pg.addColorStop(0.5, '#d6dfe6'); pg.addColorStop(1, '#c3ced8');
      c.fillStyle = pg; c.fillRect(C25.pillar[0], wy0, C25.pillar[1] - C25.pillar[0], wy1 - wy0);
      // aluminium frames and meeting rails
      const frame = (x0, x1) => {
        c.fillStyle = '#f4f7f9'; c.fillRect(x0, wy0, x1 - x0, 22); c.fillRect(x0, wy1 - 26, x1 - x0, 26); c.fillRect(x0, wy0, 20, wy1 - wy0); c.fillRect(x1 - 20, wy0, 20, wy1 - wy0);
        const mx = (x0 + x1) / 2; c.fillRect(mx - 13, wy0, 26, wy1 - wy0);
        c.fillStyle = 'rgba(118,138,158,0.42)'; c.fillRect(x0 + 20, wy0 + 22, x1 - x0 - 40, 3); c.fillRect(mx + 13, wy0 + 22, 3, wy1 - wy0 - 48);
      };
      frame(wx0, C25.pillar[0]); frame(C25.pillar[1], wx1);
      c.fillStyle = '#eef3f6'; c.fillRect(wx0 - 50, wy1, wx1 - wx0 + 100, 24);
      c.fillStyle = 'rgba(110,130,150,0.3)'; c.fillRect(wx0 - 50, wy1 + 24, wx1 - wx0 + 100, 10);
      c.fillStyle = '#dbe3e9'; c.fillRect(wx0 - 80, wy0 - 40, wx1 - wx0 + 160, 14);
    });
  }
  // sheer curtain (fixed edge x0, free edge x1); the free side breathes with the autumn wind
  function curtain(c, t, o) {
    const n = o.folds, dir = o.dir || 1, N = 16;
    const gust = o.billow * (0.55 + 0.45 * Math.sin(t * 0.8 + o.seed)) * (0.75 + 0.25 * N2(t * 0.35, o.seed));
    const xAt = (u, v) => lerp(o.x0, o.x1, u) + dir * (Math.sin(PI * Math.min(1, v * 1.08)) * gust * 110 * u + Math.sin(v * 5 + t * 1.5 + u * 3 + o.seed) * 8 * gust * (0.3 + u));
    const hemY = (u) => o.bot - gust * 50 * u * u;
    c.save();
    c.beginPath();
    for (let k = 0; k <= N; k++) { const v = k / N; c.lineTo(xAt(0, v), lerp(o.top, hemY(0), v)); }
    for (let k = 0; k <= 8; k++) { const u = k / 8; c.lineTo(xAt(u, 1), hemY(u)); }
    for (let k = N; k >= 0; k--) { const v = k / N; c.lineTo(xAt(1, v), lerp(o.top, hemY(1), v)); }
    c.closePath(); c.fillStyle = `rgba(248,251,253,${o.alpha})`; c.fill();
    for (let i = 0; i < n; i++) {
      const ua = i / n, ub = (i + 1) / n, um = (ua + ub) / 2, wv = Math.abs(o.x1 - o.x0) / n, mid = lerp(o.x0, o.x1, um);
      const g = c.createLinearGradient(mid - wv * 0.6, 0, mid + wv * 0.6, 0);
      const dk = 0.14 + 0.1 * Math.abs(Math.sin(i * 2.3 + 0.7)), lt = 0.3 + 0.2 * Math.abs(Math.sin(i * 1.7));
      g.addColorStop(0, `rgba(146,166,186,${dk})`); g.addColorStop(0.45, `rgba(255,255,255,${lt})`); g.addColorStop(1, `rgba(192,206,220,${dk * 0.6})`);
      c.fillStyle = g; c.beginPath();
      for (let k = 0; k <= N; k++) { const v = k / N; c.lineTo(xAt(ua, v), lerp(o.top, hemY(ua), v)); }
      for (let k = N; k >= 0; k--) { const v = k / N; c.lineTo(xAt(ub, v), lerp(o.top, hemY(ub), v)); }
      c.closePath(); c.fill();
    }
    c.restore();
  }
  // the blanket over her legs (foreground, in the shade of the backlight) + the bed's foot board
  function c25Bed() {
    return PV.cached('g07:c25bed4', W, H, (c) => {
      // the near things are in the shade of the backlight: a mid grey-blue (they read as "in front of her eyes" and they
      // hide him at the hips; when they were as pale as the window he looked like a torso dissolving into fog)
      const y0 = C25.foot;
      const g = c.createLinearGradient(0, y0 + 10, 0, H); g.addColorStop(0, '#a3b0bd'); g.addColorStop(0.35, '#8b98a7'); g.addColorStop(1, '#68778a');
      c.fillStyle = g; c.beginPath(); c.moveTo(-40, y0 + 60); c.bezierCurveTo(500, y0 + 4, 1400, y0 + 2, W + 40, y0 + 50); c.lineTo(W + 40, H); c.lineTo(-40, H); c.closePath(); c.fill();
      c.save(); c.clip();
      // two long ridges (her legs) running toward the window, lit on their window-side flank
      c.filter = 'blur(22px)';
      for (const [xa, xb, w] of [[760, 560, 260], [1000, 1150, 260]]) {
        c.fillStyle = 'rgba(214,224,233,0.55)'; c.beginPath(); c.moveTo(xa - 30, y0 + 20); c.quadraticCurveTo(lerp(xa, xb, 0.5) - 40, y0 + 130, xb - w * 0.2, H); c.lineTo(xb + w * 0.25, H); c.quadraticCurveTo(lerp(xa, xb, 0.5) + 20, y0 + 130, xa + 30, y0 + 20); c.fill();
        c.fillStyle = 'rgba(70,84,102,0.45)'; c.beginPath(); c.moveTo(xa + 34, y0 + 26); c.quadraticCurveTo(lerp(xa, xb, 0.5) + 60, y0 + 130, xb + w * 0.4, H); c.lineTo(xb + w * 0.9, H); c.quadraticCurveTo(lerp(xa, xb, 0.5) + 120, y0 + 130, xa + 90, y0 + 30); c.fill();
      }
      c.filter = 'none'; c.restore();
      // the foot board of the bed: a dark rail across the frame, its top edge catching the window
      c.fillStyle = '#76879a'; c.beginPath(); c.moveTo(-20, y0 - 12); c.lineTo(W + 20, y0 - 16); c.lineTo(W + 20, y0 + 30); c.lineTo(-20, y0 + 36); c.closePath(); c.fill();
      c.fillStyle = 'rgba(236,243,248,0.85)'; c.fillRect(-20, y0 - 16, W + 40, 7);
      // the IV drip stand beside the bed (the drip bag catches the window light)
      c.fillStyle = '#3c4754'; c.fillRect(292, -20, 50, H + 40);
      // its hooks curl up like a ram's horns (a flat cross-bar read as a grave cross once blurred)
      c.strokeStyle = '#3c4754'; c.lineWidth = 16; c.lineCap = 'round';
      for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(316, 96); c.bezierCurveTo(316 + sg * 60, 96, 316 + sg * 104, 84, 316 + sg * 98, 46); c.stroke(); }
      const bg = c.createLinearGradient(170, 0, 330, 0); bg.addColorStop(0, 'rgba(150,168,186,0.95)'); bg.addColorStop(0.6, 'rgba(232,240,246,0.97)'); bg.addColorStop(1, 'rgba(118,138,158,0.95)');
      c.fillStyle = bg; c.beginPath(); c.moveTo(186, 130); c.lineTo(316, 130); c.quadraticCurveTo(338, 290, 296, 430); c.lineTo(206, 430); c.quadraticCurveTo(166, 290, 186, 130); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(84,98,116,0.9)'; c.lineWidth = 10; c.beginPath(); c.moveTo(250, 430); c.lineTo(250, 500); c.quadraticCurveTo(262, 760, 420, 1000); c.stroke();
    });
  }
  // the boy, frontal, backlit (no guitar). Head units around his head centre; weight on his right leg (screen left),
  // shoulders tense and a little raised, head bowed toward her, hands clenched.
  function boyFront(c, t, o) {
    const br = o.breath, sh = 0.03 * br, tilt = o.tilt, lean = 0.035;
    const SLy = 1.12 - sh + lean, SRy = 1.09 - sh - lean * 0.4;             // screen-left shoulder (his right) a little lower
    // torso in a loose white shirt: trapezius slope, rounded deltoids, the waist narrower than the chest, the untucked hem
    blob(c, [[-0.17, 0.62], [-0.3, 0.8], [-0.62, 0.9 + lean * 0.5], [-0.9, SLy - 0.04], [-1.0, SLy + 0.12], [-0.98, SLy + 0.34], [-0.86, 1.62], [-0.8, 2.1], [-0.7, 2.6],
      [-0.68, 3.0], [-0.74, 3.35], [-0.82, 3.72], [-0.79, 3.8], [-0.74, 4.4], [-0.8, 5.6], [0, 5.7], [0.8, 5.6], [0.74, 4.4], [0.8, 3.82], [0.84, 3.74], [0.75, 3.35], [0.68, 3.0], [0.7, 2.6], [0.8, 2.1], [0.86, 1.62],
      [0.98, SRy + 0.34], [1.0, SRy + 0.12], [0.9, SRy - 0.04], [0.62, 0.88], [0.3, 0.8], [0.17, 0.62]]);
    // the shirt collar: only widens the base of the neck
    blob(c, [[-0.2, 0.66], [0, 0.84], [0.2, 0.66], [0.27, 0.8], [0, 0.96], [-0.27, 0.8]]);
    // arms hang a hand's width off the body; sleeves loose at the elbow, buttoned cuffs at the wrist; fists
    // arms closer to the body and not mirror images: his right (screen left) hangs straight, his left is bent a little,
    // the fist pulled in toward the thigh (a hand's width of light between arm and body read as a mannequin)
    const arm = (sg, Sy, k) => {
      const S = [sg * 0.93, Sy + 0.2], E = [sg * (1.03 + 0.05 * k), 2.36 - 0.05 * k], Wr = [sg * (0.99 - 0.08 * k), 3.42 - 0.14 * k];
      limb(c, S, E, 0.2, 0.165); limb(c, E, Wr, 0.165, 0.118);
      c.beginPath(); c.ellipse(E[0] + sg * 0.03, E[1] + 0.05, 0.19, 0.13, sg * 0.3, 0, TAU); c.fill();      // sleeve fold at the elbow
      c.beginPath(); c.ellipse(Wr[0], Wr[1] - 0.06, 0.135, 0.09, 0, 0, TAU); c.fill();                        // cuff
      c.save(); c.translate(Wr[0] + sg * 0.01, Wr[1] + 0.2); c.rotate(sg * (0.05 + 0.05 * k));
      blob(c, [[-0.095, -0.15], [0.095, -0.15], [0.125, -0.04], [0.118, 0.1], [0.07, 0.17], [-0.02, 0.19], [-0.1, 0.13], [-0.122, 0.0]]);   // clenched fist
      c.beginPath(); c.ellipse(-sg * 0.1, 0.0, 0.05, 0.09, sg * 0.4, 0, TAU); c.fill();                          // thumb over the fingers
      c.restore();
    };
    arm(-1, SLy, 0); arm(1, SRy, 1);
    // neck
    limb(c, [0, 0.3], [0, 0.8], 0.17, 0.21);
    blob(c, [[-0.2, 0.62], [-0.3, 0.74], [0, 0.66], [0.3, 0.74], [0.2, 0.62], [0, 0.4]]);   // trapezius into the collar
    // head, bowed a little, the face toward her (no features); slightly long messy hair over the ears and down the sides
    c.save(); c.translate(0.02, 0.04); c.rotate(tilt * 0.35 - 0.04); c.scale(1, 1 - tilt * 0.1);
    blob(c, [[-0.38, -0.1], [-0.37, 0.12], [-0.3, 0.32], [-0.17, 0.48], [0, 0.53], [0.17, 0.48], [0.3, 0.32], [0.37, 0.12], [0.38, -0.1], [0.3, -0.45], [0, -0.55], [-0.3, -0.45]]);
    const tf = (i, x, y) => [x + 0.014 * N2(i * 1.7, t * 1.3), y + 0.012 * N2(i * 2.3 + 5, t * 1.1), 1];
    blob(c, [[0, -0.66], [0.19, -0.64], [0.34, -0.55], tf(1, 0.45, -0.44), [0.465, -0.28], tf(2, 0.5, -0.1), [0.45, 0.06], [0.44, 0.22], tf(3, 0.43, 0.34), [0.37, 0.24], [0.37, 0.05],
      [0.3, -0.24], tf(8, 0.16, -0.16), [0.04, -0.27], tf(9, -0.1, -0.15), [-0.22, -0.26], [-0.37, 0.05], [-0.37, 0.24], tf(4, -0.43, 0.35), [-0.44, 0.22], [-0.45, 0.06], tf(5, -0.5, -0.1),
      [-0.465, -0.28], tf(6, -0.45, -0.44), [-0.34, -0.55], tf(7, -0.14, -0.73), [-0.06, -0.65]]);
    c.restore();
  }
  function c25Boy(ctx, t) {
    const B = C25.boy, tq = q12(t);
    const breath = 0.5 + 0.5 * Math.sin(tq * 4.2), tilt = 0.08 + 0.06 * sm(1.5, 3.2, tq);
    const shake = 0.8 * N2(tq * 9, 3.1);                     // he is trembling
    L.figureRender(ctx, { x: B.x + shake, y: B.y + 4 * breath, scale: B.s, style: 'silhouette', fill: '#1b2230', light: -PI / 2 - 0.25, rimColor: '#ffffff', rim: 1.7, backlight: 1.0, glow: 0.95 }, null, (F) => {
      F.layer({}, (c) => boyFront(c, tq, { breath, tilt }));
    });
  }
  // heat-haze: copy the layer in thin horizontal slices, each nudged by a rising shimmer
  function heatHaze(dst, src, t, amp, y0, y1, x0, x1, q) {
    q = q || 1; const st = 2, w = x1 - x0;
    for (let y = Math.max(0, y0); y < Math.min(H * q, y1); y += st) {
      const Y = y / q, d = amp * (0.55 * N2(Y * 0.009, t * 1.5 - Y * 0.0025) + 0.45 * Math.sin(Y * 0.04 + t * 6.0) * (0.55 + 0.45 * N2(Y * 0.004, t * 0.7)));
      dst.drawImage(src, x0, y, w, st, x0 + d, y, w, st);
    }
  }
  function c25Focus(t) {     // blur (px) on the boy; the window sits further and is always softer
    const base = 15 - 11.6 * sm(0.2, 1.15, t) + 10.5 * sm(1.75, 3.35, t) + 7 * sm(3.8, 4.7, t);
    const brth = 1.7 * Math.sin(t * 2.5 + 0.4) * (1 - 0.75 * sm(0.5, 1.2, t) * (1 - sm(1.7, 2.3, t)));
    return Math.max(1.2, base + brth);
  }
  PV.shot('C25', { draw(ctx, tIn, d) {
    const t = clamp(tIn, 0, d);
    const close = clamp(0.52 * sm(3.78, 4.0, t) + 0.1 * sm(3.95, 4.5, t) + 0.38 * sm(4.5, 4.72, t));   // two lurches (ECG)
    const dark = sm(4.55, 4.72, t);
    if (dark < 1) {
      const fb = c25Focus(t), bgB = fb + 7.5, fgB = fb + 15;
      // 1) the room behind him (window, light, curtains) — always far out of focus: built and blurred at 1/4 resolution
      (lowRes(ctx, 'c25bg', 0.25, (c) => {
        c.drawImage(c25Room(), 0, 0);
        curtain(c, t, { x0: 60, x1: 360, top: C25.win[1] - 40, bot: C25.foot + 20, folds: 9, billow: 1.0, dir: 1, seed: 1.3, alpha: 0.5 });
        curtain(c, t, { x0: 1860, x1: 1560, top: C25.win[1] - 40, bot: C25.foot + 20, folds: 8, billow: 0.35, dir: -1, seed: 4.1, alpha: 0.5 });
      }, bgB));
      // light wrapping round him from the window (over-exposure)
      L.glow(ctx, 560, 460, 900, '#ffffff', 0.32);
      L.glow(ctx, 1380, 430, 820, '#ffffff', 0.3);
      // 2) the boy, his outline shimmering like heat-haze (half resolution: he is never fully sharp)
      const hq = 0.5, B = buf('c25boy', W * hq, H * hq); B.ctx.setTransform(hq, 0, 0, hq, 0, 0); (c25Boy(B.ctx, t)); B.ctx.setTransform(1, 0, 0, 1, 0, 0);
      const Hz = buf('c25boyHz', W * hq, H * hq); (heatHaze(Hz.ctx, B.canvas, t, (7.5 + 0.2 * fb) * hq, 100 * hq, (C25.foot + 10) * hq, 840 * hq, 1640 * hq, hq));
      lowRes(ctx, 'c25boy', hq, (c) => { c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(Hz.canvas, 0, 0); }, fb);
      // the window light eats his edges a little (backlight halation)
      L.glow(ctx, C25.boy.x, C25.boy.y + 300, 520, '#f4f8fb', 0.16);
      // 3) the bed in front of her eyes (softest)
      lowRes(ctx, 'c25fg', 0.25, (c) => c.drawImage(c25Bed(), 0, 0), fgB);
    }
    // 4) the dark closes in from the edges, toward him (the "dark hole" the words come out of): an uneven, breathing edge
    if (close > 0) {
      const cx = C25.boy.x - 40, cy = C25.boy.y + 70, R0 = 1450, R = R0 * Math.pow(1 - close, 1.1);
      lowRes(ctx, 'c25dark', 0.25, (dc) => {
        dc.fillStyle = '#070b16'; dc.fillRect(0, 0, W, H);
        dc.globalCompositeOperation = 'destination-out';
        for (let k = 0; k < 6; k++) {
          const a = k * 1.047 + 0.6 * N2(k * 3.1, t * 0.8), off = R * (0.22 + 0.1 * N2(k, t * 1.1)), rr = R * (0.7 + 0.22 * N2(k * 2.2 + 7, t * 0.9));
          const hx = cx + Math.cos(a) * off * 1.25, hy = cy + Math.sin(a) * off * 0.8, soft = 90 + 0.5 * rr;
          dc.save(); dc.translate(hx, hy); dc.scale(1.3, 0.92);
          const g = dc.createRadialGradient(0, 0, Math.max(0, rr - soft * 0.6), 0, 0, rr + soft * 0.4);
          g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          dc.fillStyle = g; dc.fillRect(-rr - soft, -rr - soft, (rr + soft) * 2, (rr + soft) * 2); dc.restore();
        }
        dc.globalCompositeOperation = 'source-over';
      });
      // the light inside dims as the world closes
      ctx.fillStyle = `rgba(7,11,22,${(0.45 * sm(3.9, 4.7, t)).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
    }
    if (dark > 0) {
      ctx.save(); ctx.globalAlpha = dark; ctx.fillStyle = '#070b16'; ctx.fillRect(0, 0, W, H); ctx.restore();
      // a dying after-image of the window panes, centred where his face was
      const ai = 0.1 * sm(4.6, 4.75, t) * (1 - sm(4.9, 6.4, t));
      if (ai > 0.002) lowRes(ctx, 'c25ai', 0.25, (c) => c.drawImage(c25Room(), 0, 0), 26, ai, 'screen');
    }
  } });

  /* ======================================================================= C26 */
  // 91.0–96.0 (t 0–5.0). 91.0–93.4 complete black (the monologue lights up on the right).
  // 93.4 (t 2.4) the evening room fades in: on the white sheet her left hand plays the one-handed〈別れの曲〉(M14):
  //   93.6 B3 (index) / 94.711 G#3 (ring) / 95.267 A3 (middle) / 95.544 B3 (index) — the thumb rises for C#4 and
  //   at 95.8 (t 4.8) the fingers stop. Phantom keys of light bloom under the fingers and fade. The cast right hand
  //   lies still at the edge of the frame. 95.6 (t 4.6) far thunder: the evening light is darkened by a cloud.
  // E major five-finger position (the little finger rests on F#3, so the hand stays compact and rounded — on F3 it
  // splayed out into a claw)
  const C26 = { notes: [[2.6, 1, 1.0], [3.711, 3, 0.55], [4.267, 2, 0.28], [4.544, 1, 0.26]], stop: 4.8, fade: 2.4,
    keys: [{ b: 2 }, 1, 0, { b: -1 }, { b: -2 }] };   // thumb C#4, index B3, middle A3 (key 0), ring G#3, little F#3
  // the window beam on the bed: four panes of low evening sun (the mullion and transom cut it), long and slanted
  const C26B = { o: [210, 40], u: [1250, 520], v: [-420, 560] };    // origin, along-the-light axis, across axis (px)
  const beamPt = (a, b) => [C26B.o[0] + C26B.u[0] * a + C26B.v[0] * b, C26B.o[1] + C26B.u[1] * a + C26B.v[1] * b];
  function beamPath(c, a0, a1, b0, b1) { const p = [beamPt(a0, b0), beamPt(a1, b0), beamPt(a1, b1), beamPt(a0, b1)]; c.moveTo(p[0][0], p[0][1]); for (let k = 1; k < 4; k++) c.lineTo(p[k][0], p[k][1]); c.closePath(); }
  function c26Sheet() {
    return PV.cached('g07:c26sheet2', W, H, (c) => {
      // the white sheet in the dim evening room (cool shade)
      const g = c.createLinearGradient(0, 0, W * 0.7, H); g.addColorStop(0, '#8f9aa7'); g.addColorStop(0.55, '#7c8795'); g.addColorStop(1, '#5c6675');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // long soft folds
      // (broad, soft folds: thin dark ones read as scratches / motion streaks once the warm light goes)
      const r = PV.rng(2606);
      c.filter = 'blur(24px)';
      for (let i = 0; i < 12; i++) {
        const x0 = -200 + r() * 2200, y0 = -100 + r() * 1200, ang = 0.42 + (r() - 0.5) * 0.6, len = 600 + r() * 900, w = 26 + r() * 54;
        const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len, nx = -Math.sin(ang), ny = Math.cos(ang), bend = (r() - 0.5) * 240;
        c.fillStyle = 'rgba(52,60,78,0.22)';
        c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + dx / 2 + nx * bend, y0 + dy / 2 + ny * bend, x0 + dx, y0 + dy);
        c.lineTo(x0 + dx + nx * w, y0 + dy + ny * w); c.quadraticCurveTo(x0 + dx / 2 + nx * (bend + w * 1.6), y0 + dy / 2 + ny * (bend + w * 1.6), x0 + nx * w, y0 + ny * w); c.closePath(); c.fill();
        c.fillStyle = 'rgba(214,222,232,0.16)';
        c.beginPath(); c.moveTo(x0 - nx * w * 0.9, y0 - ny * w * 0.9); c.quadraticCurveTo(x0 + dx / 2 + nx * (bend - w), y0 + dy / 2 + ny * (bend - w), x0 + dx - nx * w * 0.9, y0 + dy - ny * w * 0.9);
        c.lineTo(x0 + dx, y0 + dy); c.quadraticCurveTo(x0 + dx / 2 + nx * bend, y0 + dy / 2 + ny * bend, x0, y0); c.closePath(); c.fill();
      }
      c.filter = 'none';
      const v = c.createRadialGradient(760, 460, 260, 760, 460, 1250); v.addColorStop(0, 'rgba(24,28,42,0)'); v.addColorStop(1, 'rgba(24,28,42,0.5)');
      c.fillStyle = v; c.fillRect(0, 0, W, H);
      c.globalAlpha = 0.045; c.strokeStyle = '#2d3440'; c.lineWidth = 1;
      for (let y = 0; y < H; y += 4) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke(); }
      c.globalAlpha = 1;
    });
  }
  function c26Beam() {   // warm light only (screened over the sheet; its strength is animated)
    return PV.cached('g07:c26beam', W, H, (c) => {
      c.filter = 'blur(11px)';
      c.fillStyle = 'rgba(255,176,96,0.9)';
      for (const [a0, a1] of [[0, 0.47], [0.53, 1]]) for (const [b0, b1] of [[0, 0.44], [0.5, 1]]) { c.beginPath(); beamPath(c, a0, a1, b0, b1); c.fill(); }
      c.filter = 'blur(70px)'; c.fillStyle = 'rgba(255,150,80,0.38)'; c.beginPath(); beamPath(c, -0.15, 1.15, -0.2, 1.2); c.fill();
      c.filter = 'none';
      // fold relief inside the light (the beam reveals the cloth)
      c.globalCompositeOperation = 'destination-out'; c.filter = 'blur(10px)';
      const r = PV.rng(2607);
      for (let i = 0; i < 9; i++) {
        const p = beamPt(r(), r()), ang = 0.42 + (r() - 0.5) * 0.5, len = 300 + r() * 500;
        c.strokeStyle = `rgba(0,0,0,${(0.25 + 0.25 * r()).toFixed(2)})`; c.lineWidth = 14 + 20 * r();
        c.beginPath(); c.moveTo(p[0] - Math.cos(ang) * len / 2, p[1] - Math.sin(ang) * len / 2); c.quadraticCurveTo(p[0] + 40, p[1] - 30, p[0] + Math.cos(ang) * len / 2, p[1] + Math.sin(ang) * len / 2); c.stroke();
      }
      c.filter = 'none'; c.globalCompositeOperation = 'source-over';
    });
  }
  // the curtain's soft shadow along the edge of the beam (painted once, slid by the breeze)
  function c26CurtainShade() {
    return PV.cached('g07:c26cshade', W, H, (c) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
      const p0 = beamPt(-0.3, 0.12), p1 = beamPt(1.4, 0.12), p2 = beamPt(1.4, -0.6), p3 = beamPt(-0.3, -0.6);
      c.filter = 'blur(40px)'; c.fillStyle = 'rgba(140,140,156,0.75)'; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.closePath(); c.fill(); c.filter = 'none';
    });
  }
  // her right forearm in the cast, lying still on the far side of the bed (top-right edge): painted once, soft (depth)
  function c26Cast() {
    return PV.cached('g07:c26cast4', W, H, (c) => {
      // it lies outside the window light, on the far side of the bed: a dim, cool, round plaster shell (not a flat white tube)
      const o = { x: 1470, y: 225, scale: 1.85, rot: PI / 2 + 2.75, t: 0, sling: false, tremble: 0, coverFingers: 0.22, arm: 380, castColor: '#a3acb9',
        curl: [0.3, 0.3, 0.34, 0.4, 0.46], spread: 0.08, pitch: 0.4, yaw: -0.2, light: -2.6, keyColor: '#aab3c1', fillColor: '#4f5868', tint: 0.8 };
      const sh = PV.makeCanvas(W, H);
      L.armCast(sh.ctx, Object.assign({}, o, { x: o.x + 18, y: o.y + 26, style: 'silhouette', color: '#2f3746' }));
      const A = PV.makeCanvas(W, H);
      A.ctx.filter = 'blur(14px)'; A.ctx.globalAlpha = 0.55; A.ctx.drawImage(sh.canvas, 0, 0); A.ctx.filter = 'none'; A.ctx.globalAlpha = 1;
      const Cc = PV.makeCanvas(W, H); L.armCast(Cc.ctx, o);
      const Mk = PV.makeCanvas(W, H); Mk.ctx.drawImage(Cc.canvas, 0, 0);          // its own alpha, to re-mask after the multiply
      // roundness: across the forearm, the window-side edge catches a little cool light, the far side turns into shade
      const ax = [0.903, -0.43], nx = [0.43, 0.903], m0 = [1560, 190];
      const g = Cc.ctx.createLinearGradient(m0[0] - nx[0] * 80, m0[1] - nx[1] * 80, m0[0] + nx[0] * 80, m0[1] + nx[1] * 80);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(226,231,238,1)'); g.addColorStop(0.75, 'rgba(150,160,176,1)'); g.addColorStop(1, 'rgba(112,122,140,1)');
      Cc.ctx.globalCompositeOperation = 'multiply'; Cc.ctx.fillStyle = g; Cc.ctx.fillRect(0, 0, W, H);
      // ...and it falls off into the dark toward the top-right edge of the frame
      const g2 = Cc.ctx.createLinearGradient(1300, 300, 1300 + ax[0] * 700, 300 + ax[1] * 700);
      g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(1, 'rgba(120,128,146,1)');
      Cc.ctx.fillStyle = g2; Cc.ctx.fillRect(0, 0, W, H);
      Cc.ctx.globalCompositeOperation = 'destination-in'; Cc.ctx.drawImage(Mk.canvas, 0, 0); Cc.ctx.globalCompositeOperation = 'source-over';
      A.ctx.drawImage(Cc.canvas, 0, 0);
      c.filter = 'blur(3.4px)'; c.drawImage(A.canvas, 0, 0); c.filter = 'none';
    });
  }
  // phantom keyboard of light in the hand's own camera (rig.Pkey): white keys rel. to A3 (= 0), black after w
  const isBlackRel = (w) => [0, 1, 3, 4, 5].indexOf((((w + 5) % 7) + 7) % 7) >= 0;
  function phantomKeys(ctx, rig, glowOf, amount) {
    if (amount <= 0.003) return;
    const K = L.handKeyGeom, V = L._handMath.V, P = (x, y, z) => rig.Pkey(V(x, y, z)), x0 = -K.w / 2;
    const poly = (q) => { ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); for (let k = 1; k < q.length; k++) ctx.lineTo(q[k].x, q[k].y); ctx.closePath(); };
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const glows = [];
    // white keys: thin lines of light for the gaps and the front edges, a breath of light on each top
    const wMin = -11, wMax = 9;
    for (let w = wMin; w <= wMax; w++) {
      const fall = Math.exp(-Math.pow((w + 0.4) / 4.6, 2)), g = glowOf('w' + w);
      const a = amount * (0.85 * fall + 0.9 * g); if (a < 0.006) continue;
      const xl = x0 + w * K.w + 0.8, xr = x0 + (w + 1) * K.w - 0.8, d = g * K.travel * 0.35, zb = -K.l * (0.6 + 0.4 * fall);
      const q = [P(xl, d, 0), P(xr, d, 0), P(xr, d, zb), P(xl, d, zb)];
      const gr = ctx.createLinearGradient(q[0].x, q[0].y, q[3].x, q[3].y);
      gr.addColorStop(0, `rgba(255,238,210,${(a * (0.2 + 0.55 * g)).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,238,210,0)');
      ctx.fillStyle = gr; poly(q); ctx.fill();
      const lg = ctx.createLinearGradient(q[0].x, q[0].y, q[3].x, q[3].y);
      lg.addColorStop(0, `rgba(255,248,232,${Math.min(1, a * 1.1).toFixed(3)})`); lg.addColorStop(0.7, `rgba(255,248,232,${Math.min(1, a * 0.4).toFixed(3)})`); lg.addColorStop(1, 'rgba(255,246,228,0)');
      ctx.strokeStyle = lg; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(q[3].x, q[3].y); ctx.lineTo(q[0].x, q[0].y); ctx.moveTo(q[1].x, q[1].y); ctx.lineTo(q[2].x, q[2].y); ctx.stroke();
      if (g > 0.02) { const m = P((xl + xr) / 2, d, -24); glows.push([m.x, m.y, g * amount]); }            // where the fingertip touches
    }
    // the keyboard's front edge: one line of light running under the fingertips
    {
      const pts = []; for (let w = wMin; w <= wMax + 1; w++) pts.push(P(x0 + w * K.w, 0, 0));
      const a0 = pts[0], a1 = pts[pts.length - 1], lg = ctx.createLinearGradient(a0.x, a0.y, a1.x, a1.y);
      for (let k = 0; k <= 10; k++) { const w = lerp(wMin, wMax + 1, k / 10), f = Math.exp(-Math.pow((w - 0.1) / 5.2, 2)); lg.addColorStop(k / 10, `rgba(255,246,226,${Math.min(1, amount * 0.9 * f).toFixed(3)})`); }
      ctx.strokeStyle = lg; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();
    }
    // black keys: slimmer blocks of light set back on the keyboard
    for (let w = -11; w <= 8; w++) {
      if (!isBlackRel(w)) continue;
      const fall = Math.exp(-Math.pow((w + 0.9) / 4.6, 2)), g = glowOf('b' + w);
      const a = amount * (0.7 * fall + 0.9 * g); if (a < 0.006) continue;
      const cx = x0 + (w + 1) * K.w, xl = cx - K.bw / 2, xr = cx + K.bw / 2, h = g * K.travel * 0.35, zb = -K.l + 2, zf = -K.l + K.bl;
      const q = [P(xl, h, zf), P(xr, h, zf), P(xr, h, zb), P(xl, h, zb)];
      ctx.fillStyle = `rgba(255,230,196,${(a * (0.18 + 0.5 * g)).toFixed(3)})`; poly(q); ctx.fill();
      ctx.strokeStyle = `rgba(255,242,220,${Math.min(1, a * 0.8).toFixed(3)})`; ctx.lineWidth = 1.5; poly(q); ctx.stroke();
      if (g > 0.02) { const m = P(cx, h, -K.l + K.bl - 18); glows.push([m.x, m.y, g * amount]); }
    }
    ctx.restore();
    for (const [x, y, g] of glows) { L.glow(ctx, x, y, 150, '#ffe9c8', 0.55 * g); L.glow(ctx, x, y, 46, '#fff6e6', 0.6 * g); }
  }
  function c26Press(t) {
    // finger presses from the notes; the thumb lifts for C#4 and freezes at the stop
    const tf = Math.min(t, C26.stop);
    const press = [0, 0, 0, 0, 0];
    for (const [s, f, dur] of C26.notes) {
      const u = (tf - s) / Math.max(0.35, dur * 1.25);
      press[f] = Math.max(press[f], L.handPressCurve(u));
    }
    // the thumb prepares C#4 (95.822): rises from 95.55 and stops in the air at 95.8
    press[0] = Math.min(press[0], -0.6 * sm(4.5, 4.78, tf));
    return press;
  }
  PV.shot('C26', { draw(ctx, tIn, d) {
    const t = clamp(tIn, 0, d);
    ctx.fillStyle = '#05070e'; ctx.fillRect(0, 0, W, H);
    if (t < C26.fade) return;
    const vis = sm(C26.fade, C26.fade + 0.95, t);
    const S = buf('c26'); const c = S.ctx;
    c.drawImage(c26Sheet(), 0, 0);
    // the low sun through the window (dimmed by the cloud at 95.6), its edge breathing with the curtain
    const cloud = sm(4.5, 4.95, t), sun = (1 - 0.85 * cloud) * (0.93 + 0.07 * Math.sin(t * 1.3));
    c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = sun; c.drawImage(c26Beam(), 0, 0); c.restore();
    const cu = 0.05 * Math.sin(t * 0.8) + 0.03 * N2(t * 0.5, 2);
    c.save(); c.globalCompositeOperation = 'multiply'; c.translate(C26B.v[0] * cu, C26B.v[1] * cu); c.drawImage(c26CurtainShade(), 0, 0); c.restore();
    c.drawImage(c26Cast(), 0, 0);
    // her left hand, rendered into its own layer first (its rig places the phantom keys under it)
    const press = c26Press(t);
    const stopK = sm(C26.stop - 0.02, C26.stop + 0.06, t);
    const glowOf = (key) => {
      let g = 0;
      for (const [s, f, dur] of C26.notes) {
        const k = C26.keys[f], kk = typeof k === 'object' ? 'b' + k.b : 'w' + k; if (kk !== key) continue;
        const u = Math.min(t, C26.stop + 0.3) - s; if (u < -0.06) continue;
        g = Math.max(g, sm(-0.06, 0.03, u) * Math.exp(-Math.max(0, u) / (0.3 + dur * 0.5)));
      }
      return g;
    };
    // the phantom keyboard surfaces with each note and sinks away again
    let keyAmt = 0.12 * sm(2.5, 2.8, t);
    for (const [s0, , dur] of C26.notes) { const u = Math.min(t, C26.stop + 0.3) - s0; if (u > -0.08) keyAmt = Math.max(keyAmt, sm(-0.08, 0.06, u) * (0.25 + 0.75 * Math.exp(-Math.max(0, u) / (0.45 + dur * 0.5)))); }
    keyAmt *= 1 - sm(C26.stop - 0.04, C26.stop + 0.16, t);           // the keys go out with the music
    // from above her wrist (the five fingers read on the keys; seen from the little-finger side they stacked into a claw)
    const CO = { x: 930, y: 640, scale: 3.05, az: -0.32, el: 0.9, camRoll: -0.45 };
    // (sun: the window is up-left, so her hand's shadow falls under it, toward us)
    const hand = { x: CO.x, y: CO.y, scale: CO.scale, t: Math.min(t, C26.stop), side: 'L', kind: 'her', az: CO.az, el: CO.el, camRoll: CO.camRoll, press, keys: C26.keys,
      drawKeys: false, shadow: true, shadowAlpha: 0.3, sun: { x: -0.25, y: -1, z: 0.6 }, light: -2.4, sleeve: '#b9c6d3', sleeveAt: 70, arm: 360, breath: 1 - stopK,
      wristY: -35, tilt: 0.24,   // a slightly raised, tilted wrist: the fingers arch down onto the keys instead of lying flat
      keyColor: lerpHex('#ffcf98', '#c9d0dc', cloud), fillColor: '#6f6c80', tint: 0.7 };
    const HB = buf('c26hand'); const rig = (L.handOnKeys(HB.ctx, hand));
    const KB = keyAmt > 0.003 ? buf('c26keys') : null;
    if (KB) {
      phantomKeys(KB.ctx, rig, glowOf, keyAmt);
      blurBlit(c, KB.canvas, 7, 0.9, 'c26kb', 'screen');           // the light the keys give off
      c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.72; c.drawImage(KB.canvas, 0, 0); c.restore();
    }
    c.drawImage(HB.canvas, 0, 0);
    // 95.6 far thunder: the cloud takes the low sun; the room goes cold. Just before it, a far flash flickers in the panes
    if (cloud > 0) { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = `rgba(150,160,182,${(0.35 * cloud).toFixed(3)})`; c.fillRect(0, 0, W, H); c.restore(); }
    const ff = 0.32 * L.flashCurve(t, [4.47], { decay: 0.2 });
    if (ff > 0.005) { c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = ff; c.filter = 'saturate(0) brightness(1.4)'; c.drawImage(c26Beam(), 0, 0); c.filter = 'none'; c.restore(); }
    // the room comes up out of black through a soft focus
    blurBlit(ctx, S.canvas, 9 * (1 - vis), vis, 'c26in');
    // ...but the first note's key of light is there before the room: it surfaces out of the black on 93.6
    if (KB && vis < 0.98) {
      const k = (1 - vis) * sm(2.52, 2.62, t);
      blurBlit(ctx, KB.canvas, 7, 0.9 * k, 'c26kb2', 'screen');
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.72 * k; ctx.drawImage(KB.canvas, 0, 0); ctx.restore();
    }
  } });

  /* ======================================================================= C27 */
  // 96.0–98.5 (t 0–2.5). Flash cut. The 96.0 lightning shows the white bridge for an instant (the C15 photo's framing),
  // a blacked-out city, and, very small at the railing, the long-haired figure in a hospital gown — only the white cast
  // glows like a point. Static wide; rain in three layers (parallax by depth).
  const C27 = { hz: 652, deck: 584, towers: [330, 790], fig: { x: 1262, y: 930, s: 0.3 }, railY: -4.9 };
  // the 96.0 strike holds (flickering) for ~0.3 s — long enough to be seen after the flash-cut — then dies fast
  function c27Main(t) { if (t < 0) return 0; if (t < 0.3) return 0.86 + 0.14 * Math.cos(t * 62); return Math.exp(-(t - 0.3) / 0.11); }
  function c27Flash(t) { return Math.max(c27Main(t), 0.3 * L.flashCurve(t, [1.52], { decay: 0.3 })); }
  function c27Static() {
    return PV.cached('g07:c27static', W, H, (c) => {
      // the blacked-out city on the far shore (no lit window anywhere)
      L.skyline(c, { seed: 2704, y: C27.hz, hMin: 14, hMax: 92, wMin: 18, wMax: 70, color: '#121a2b', haze: 0.3, hazeColor: '#232d45', x0: -20, x1: W + 20 });
      L.skyline(c, { seed: 2705, y: C27.hz + 6, hMin: 8, hMax: 46, wMin: 26, wMax: 90, color: '#0c111d', haze: 0.1, hazeColor: '#1a2338', x0: -20, x1: W + 20 });
    });
  }
  function c27Bridge(ctx, t, lit) {
    const o = { x0: -60, x1: W + 80, y: C27.deck, towerH: 300, lw: 5.2, cables: 12, pierH: C27.hz - C27.deck, span: 280, towers: C27.towers };
    L.bridge(ctx, Object.assign({}, o, { color: '#1a2336', shadow: '#0e1424' }));
    if (lit > 0.01) L.bridge(ctx, Object.assign({}, o, { color: '#e4eaf4', shadow: '#7184aa', rim: '#ffffff', rimAmt: Math.min(1, lit), light: 'right', alpha: Math.min(1, lit) }));   // (bridge sets its own globalAlpha)
  }
  // the railing in front of her, receding a little to the left; its wet top rail catches the flash
  const c27RailY = (x) => lerp(790, 812, x / W);
  function c27Railing(ctx, fl) {
    ctx.save();
    const top = (x) => c27RailY(x);
    ctx.fillStyle = '#0a0e18';
    ctx.beginPath(); ctx.moveTo(-10, top(-10) - 7); ctx.lineTo(W + 10, top(W + 10) - 8); ctx.lineTo(W + 10, top(W + 10) + 8); ctx.lineTo(-10, top(-10) + 7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, top(-10) + 66); ctx.lineTo(W + 10, top(W + 10) + 72); ctx.lineTo(W + 10, top(W + 10) + 77); ctx.lineTo(-10, top(-10) + 71); ctx.closePath(); ctx.fill();
    for (let x = -8; x < W + 10; x += lerp(24, 31, (x + 8) / W)) ctx.fillRect(x, top(x), lerp(2.6, 3.8, x / W), 132 + 6 * x / W);
    for (let x = 60; x < W; x += 300) ctx.fillRect(x - 6, top(x) - 10, 12, 148);
    ctx.fillStyle = `rgba(190,210,245,${(0.14 + 0.72 * fl).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(-10, top(-10) - 8); ctx.lineTo(W + 10, top(W + 10) - 9); ctx.lineTo(W + 10, top(W + 10) - 6.5); ctx.lineTo(-10, top(-10) - 5.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  PV.shot('C27', { draw(ctx, tIn, d) {
    const t = clamp(tIn, 0, d), fl = c27Flash(t), bolt = t < 0.32 ? 0.82 + 0.18 * Math.cos(t * 75) : Math.exp(-(t - 0.32) / 0.05);
    const lit = Math.pow(c27Main(t), 1.2) + 0.09 * L.flashCurve(t, [1.52], { decay: 0.3 });
    (lowRes(ctx, 'c27sky', 0.5, (c) => {
      L.skyDome(c, t, { preset: 'storm', horizon: C27.hz, seed: 27, haze: 0.7, hazeColor: '#2a3550', hazeH: 200 });
      L.stormClouds(c, t, { h: 700, seed: 27, flash: fl, flashX: 1480, flashY: 220, flashR: 1000, speed: 30 });
      // far rain veils hanging from the cells
      L.rainCurtain(c, t, { x0: -200, x1: W + 200, y0: 300, y1: C27.hz + 30, count: 7, seed: 27, alpha: 0.4 + 0.35 * fl, color: '#a9b8d6', speed: 1100, drift: 60, angle: 0.2 });
    }));
    if (bolt > 0.02) L.lightning(ctx, L.lightningPath(2712, 1560, -20, 1470, C27.hz - 4, 0.34, 8), Math.min(1, bolt * 1.3));
    ctx.drawImage(c27Static(), 0, 0);
    if (fl > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = fl * 0.35; ctx.fillStyle = '#9fb4d8'; ctx.fillRect(0, C27.hz - 120, W, 140); ctx.restore(); }
    c27Bridge(ctx, t, lit);
    // a veil of rain between us and the bridge (air)
    L.rainCurtain(ctx, t + 1.7, { x0: -200, x1: W + 200, y0: 180, y1: C27.hz + 20, count: 5, seed: 31, alpha: 0.18 + 0.3 * fl, color: '#9fb0d2', speed: 1200, drift: 80, angle: 0.22 });
    // the river is never shown: under the deck there is only night and rain-mist (lit from inside by the flash)
    const mg = ctx.createLinearGradient(0, C27.hz - 14, 0, 820);
    mg.addColorStop(0, 'rgba(22,30,50,0.55)'); mg.addColorStop(0.3, 'rgba(12,17,30,0.92)'); mg.addColorStop(1, 'rgba(8,11,20,1)');
    ctx.fillStyle = mg; ctx.fillRect(0, C27.hz - 14, W, 834 - C27.hz);
    L.rainCurtain(ctx, t + 3.1, { x0: -200, x1: W + 200, y0: C27.hz - 40, y1: 830, count: 6, seed: 29, alpha: 0.22 + 0.5 * fl, color: '#8ea0c4', speed: 1300, drift: 90, angle: 0.24 });
    if (fl > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; const sg = ctx.createLinearGradient(0, C27.hz, 0, 820); sg.addColorStop(0, `rgba(120,140,190,${(0.35 * fl).toFixed(3)})`); sg.addColorStop(1, 'rgba(120,140,190,0)'); ctx.fillStyle = sg; ctx.fillRect(0, C27.hz, W, 170); ctx.restore(); }
    L.rain(ctx, t, { seed: 2721, count: 900, angle: 0.22, speed: 1500, len: 34, width: 0.9, alpha: 0.12 + 0.3 * fl, color: '#b9c7e2', y0: 120, y1: 960 });
    // foreground: the railing, her, the wet walkway
    const F = C27.fig;
    c27Railing(ctx, fl);
    const wy = c27RailY(F.x) + 140, wg = ctx.createLinearGradient(0, wy - 10, 0, H); wg.addColorStop(0, '#0d1220'); wg.addColorStop(1, '#05080e');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(0, c27RailY(0) + 138); ctx.lineTo(W, c27RailY(W) + 146); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // wet walkway: the sky's flash and the cast's point of light are mirrored in it
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const sg = ctx.createLinearGradient(0, wy, 0, H); sg.addColorStop(0, `rgba(150,170,215,${(0.08 + 0.4 * fl).toFixed(3)})`); sg.addColorStop(1, 'rgba(150,170,215,0)'); ctx.fillStyle = sg; ctx.fillRect(0, wy - 6, W, H - wy + 6);
    ctx.restore();
    (L.girlAtRailing(ctx, t, { x: F.x, y: F.y, scale: F.s, wind: 1.6, windDir: 0.06, cast: true, castTone: 0.92, outfit: 'blouse', railing: false, railY: C27.railY,
      style: 'silhouette', light: -1.05, rimColor: '#cfe0ff', backlight: 0.25 + 0.7 * fl, glow: 0.4 + 0.4 * fl }));
    // the white cast: a point of light even in the dark (and its broken reflection on the wet walkway)
    const cx = F.x + 0.36 * 92 * F.s, cy = F.y - 4.62 * 92 * F.s;
    L.glow(ctx, cx, cy, 16, '#eef3f5', 0.6 + 0.3 * fl);
    L.glow(ctx, cx, cy, 4.5, '#ffffff', 0.95);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(220,230,245,0.16)';
    for (let k = 0; k < 6; k++) { const yy = F.y + 16 + k * 9, w = 3 + 2 * Math.sin(t * 9 + k * 1.7); ctx.fillRect(cx - w / 2 + 2 * Math.sin(t * 6 + k), yy, w, 4); }
    ctx.restore();
    L.splashes(ctx, t, { seed: 2731, y0: wy + 10, y1: H, count: 70, alpha: 0.32 + 0.4 * fl, color: '#cfdcf5' });
    L.splashes(ctx, t, { seed: 2732, y0: c27RailY(960) - 9, y1: c27RailY(960) - 7, count: 26, alpha: 0.28 + 0.4 * fl, color: '#cfdcf5' });
    // mid and near rain (near: big, fast, soft — the third parallax layer)
    L.rain(ctx, t, { seed: 2722, count: 420, angle: 0.25, speed: 2500, len: 92, width: 1.5, alpha: 0.18 + 0.45 * fl, color: '#c9d6f0' });
    lowRes(ctx, 'c27near', 0.25, (c) => L.rain(c, t, { seed: 2723, count: 60, angle: 0.28, speed: 3600, len: 300, width: 5, alpha: 0.22 + 0.45 * fl, color: '#d6e0f5' }), 0, 1, 'screen');
    if (fl > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(220,232,255,${(0.2 * fl).toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  } });

  /* ======================================================================= C28 */
  // 98.5–103.5 (t 0–5.0). Medium shot from a low angle behind her right shoulder at the bridge railing (only the storm
  // sky behind her: the river is never shown).
  //  t 0.2 (98.7) the rain vanishes in two frames, the wind dies: the world stands still (river + tinnitus only).
  //  t 0.7–2.25 she slowly turns her head toward us (backlit: no face). Silent sheet lightning far off rims her profile.
  //  t 2.0 『分からないわよ！』 the wind comes back with the first heavy drops; t 4.2 (102.7) a bolt falls behind her
  //  and the frame burns white; t 4.4 (102.9) the downpour returns.
  // gust = 『分からないわよ！』: the synthesized V08 (voice_out/V08.wav, placed at 99.0) bursts out at +1.45 s = 100.45
  const C28 = { ax: 846, ay: 1952, s: 2.5, railY: -5.0, rainStop: 0.2, turn0: 0.7, turn1: 2.1, gust: 2.0, strike: 4.2, rainBack: 4.4, light: -0.78 };
  function c28Wind(t) {     // {w: strength, dir}: storm → the hair drops (and swings once) → dead calm → gust → storm
    const st = C28.rainStop, u = t - st;
    let w = 1.5 * (1 - sm(st, st + 0.42, t)), dir = 0.06;
    if (u > 0.3 && t < C28.gust) { const osc = 0.22 * Math.exp(-(u - 0.3) / 0.45) * Math.sin((u - 0.3) * 6.5 + 1.2); if (Math.abs(osc) > w) { w = Math.abs(osc); dir = osc > 0 ? 0.06 : PI - 0.06; } }
    const g = 0.85 * sm(C28.gust, C28.gust + 0.4, t) + 0.3 * sm(3.3, 3.7, t) + 0.45 * sm(C28.strike, C28.strike + 0.25, t);
    if (g > w) { w = g; dir = PI - 0.14; }                  // 変わる風向き: the wind returns from the other side
    return { w, dir };
  }
  function c28Yaw(t) { return 1.72 * ease.inOutCubic(clamp((t - C28.turn0) / (C28.turn1 - C28.turn0))); }
  function c28Flash(t) {
    const far = 0.34 * L.flashCurve(t, [1.25], { decay: 0.5 }) + 0.46 * L.flashCurve(t, [1.98], { decay: 0.45 }) + 0.3 * L.flashCurve(t, [3.02], { decay: 0.4 });
    const main = L.flashCurve(t, [C28.strike], { decay: 0.6 });
    return { far: Math.min(1, far), main, fl: Math.min(1, far + main) };
  }
  // replica of the girlAtRailing standing rig (weight 0.6, hands on the rail): neck, right shoulder, the slung elbow and
  // the head, in the figure's local units — so the turning face and the sling's shading sit exactly on the library figure
  function c28Rig(t, o) {
    const tq = q12(t), Wd = o.wind, wd = o.windDir, seed = 11, sgw = Math.sign(Math.cos(wd)) || 1;
    const sway = 0.025 * N2(seed, tq * 0.35) + Wd * 0.012 * N2(seed + 3, tq * 1.2);
    const lam = sway + 0.02 * Wd * sgw - 0.035 * 0.6, up = [Math.sin(lam), -Math.cos(lam)];
    const P = [0.06, -3.78 + 0.018], N = [P[0] + up[0] * 2.18, P[1] + up[1] * 2.18];
    const sa = lam + 0.036, sc = [N[0] - up[0] * 0.27, N[1] - up[1] * 0.27];
    const SR = [sc[0] + Math.cos(sa) * 0.6, sc[1] + Math.sin(sa) * 0.6 - 0.03], E = [SR[0] + 0.12, SR[1] + 0.98];
    const ht = (o.headTilt || 0) + 0.04 * sgw * Wd + lam * 0.6;
    return { N, SR, E, ht, head: [N[0] + Math.sin(ht) * 0.7, N[1] - Math.cos(ht) * 0.7] };
  }
  function c28Head(t, o) {
    const R = c28Rig(t, o), u = 92 * o.scale;
    return { x: o.x + R.head[0] * u, y: o.y + R.head[1] * u, ht: R.ht };
  }
  // the library draws the sling (strap across her back + the pouch corner at the elbow) as one flat light cut-out; at this
  // size it read as a white paddle. Shade it like cloth, clipped to the very same outline: the edge toward the storm light
  // stays pale, the far edge and the pouch (under the arm) sink into shade, and two soft folds pull toward the neck.
  function c28SlingShade(ctx, t, fig, lit) {
    const R = c28Rig(t, fig), E = R.E, n0 = [R.N[0] - 0.08, R.N[1] + 0.52], n1 = [R.N[0] + 0.05, R.N[1] + 0.46];
    const mx = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], ad = (a, d) => [a[0] + d[0], a[1] + d[1]];
    const pts = [n0, ad(mx(n0, ad(E, [-0.16, -0.18]), 0.55), [0.03, 0]), ad(E, [-0.18, -0.08]), ad(E, [-0.14, 0.12]), [...ad(E, [0.13, 0.25]), 1], ad(E, [0.2, 0.02]),
      ad(E, [0.12, -0.2]), mx(n1, ad(E, [0.12, -0.2]), 0.5), n1];
    const u = 92 * fig.scale, dx = E[0] - n0[0], dy = E[1] - n0[1], dl = Math.hypot(dx, dy), nx = -dy / dl, ny = dx / dl, M = mx(n0, E, 0.55);
    ctx.save(); ctx.translate(fig.x, fig.y); ctx.scale(u, u);
    ctx.beginPath(); spline(ctx, pts, true); ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    const g = ctx.createLinearGradient(M[0] - nx * 0.22, M[1] - ny * 0.22, M[0] + nx * 0.2, M[1] + ny * 0.2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#e4e9f2'); g.addColorStop(1, '#6f7a92');
    ctx.fillStyle = g; ctx.fillRect(E[0] - 2, E[1] - 3, 4, 4.5);
    const g2 = ctx.createLinearGradient(n0[0], n0[1], E[0] + 0.12, E[1] + 0.22);
    g2.addColorStop(0, '#d9dfea'); g2.addColorStop(0.45, '#ffffff'); g2.addColorStop(0.78, '#c3cbd9'); g2.addColorStop(1, '#7d879d');
    ctx.fillStyle = g2; ctx.fillRect(E[0] - 2, E[1] - 3, 4, 4.5);
    // folds dragged toward the neck by the weight of the arm
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(96,106,128,0.85)'; ctx.lineWidth = 0.022;
    for (const [a, b, off] of [[0.3, 0.86, 0.05], [0.42, 0.95, -0.04]]) {
      const p0 = ad(mx(n0, E, a), [nx * off, ny * off]), p1 = ad(mx(n0, E, b), [nx * (off + 0.05), ny * (off + 0.05)]);
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo((p0[0] + p1[0]) / 2 + nx * 0.03, (p0[1] + p1[1]) / 2 + ny * 0.03, p1[0], p1[1]); ctx.stroke();
    }
    // a cold sheen along the lit edge when the sky flashes
    if (lit > 0.02) {
      ctx.globalCompositeOperation = 'screen'; const g3 = ctx.createLinearGradient(M[0] - nx * 0.2, M[1] - ny * 0.2, M[0] + nx * 0.05, M[1] + ny * 0.05);
      g3.addColorStop(0, `rgba(200,220,255,${(0.55 * lit).toFixed(3)})`); g3.addColorStop(1, 'rgba(200,220,255,0)'); ctx.fillStyle = g3; ctx.fillRect(E[0] - 2, E[1] - 3, 4, 4.5);
    }
    ctx.restore();
  }
  // the face turning out of the hair. Profile in head units at yaw = PI/2 (x toward the face; the library's back-view
  // hair cap reaches x≈0.47, so the face must stand clear of it); every x>0 is scaled by sin(yaw).
  const C28_PROFILE = [[-0.12, -0.5], [0.3, -0.52], [0.47, -0.4], [0.545, -0.24], [0.575, -0.1], [0.565, -0.03], [0.6, 0.04], [0.648, 0.112, 1], [0.585, 0.155],
    [0.592, 0.198], [0.572, 0.236], [0.583, 0.272], [0.548, 0.316], [0.556, 0.378], [0.5, 0.43], [0.4, 0.445], [0.34, 0.55], [0.32, 0.72], [0.3, 0.9], [-0.14, 0.9]];
  const C28_BANGS = [[0.22, -0.58], [0.45, -0.5], [0.585, -0.32], [0.612, -0.16], [0.6, -0.08, 1], [0.565, -0.15], [0.55, -0.1, 1], [0.52, -0.2], [0.42, -0.3], [0.2, -0.36]];
  function c28Face(ctx, t, o) {
    const yaw = o.yaw, sy = Math.sin(yaw), cy = Math.cos(yaw), k = sm(0.05, 0.35, sy);
    if (k <= 0.001) return;
    const X = (x) => (x > 0 ? x * sy : x);
    L.figureRender(ctx, { x: o.x, y: o.y, scale: o.scale, style: 'silhouette', light: o.light, rimColor: o.rimColor, rim: o.rim, backlight: o.backlight, glow: o.glow, alpha: k }, null, (F) => {
      F.layer({}, (c) => {
        c.save(); c.rotate(o.ht * 0.8 + 0.05 * sy);
        c.beginPath(); spline(c, C28_PROFILE.map(([x, y, kk]) => [X(x), y, kk]), true); c.fill();
        // lost profile: the cheek and jaw round out past the hair before the nose clears it
        c.beginPath(); c.ellipse(0.24 * sy + 0.1, 0.2, 0.06 + 0.22 * Math.abs(cy), 0.24, 0, 0, TAU); c.fill();
        c.beginPath(); spline(c, C28_BANGS.map(([x, y, kk]) => [X(x), y, kk]), true); c.fill();
        // the near side lock, falling past the cheek (it hides the face; the wind lifts it toward the face)
        const sw = o.windK * (0.16 + 0.07 * Math.sin(t * 9.3)), L0 = [0.4 * sy, -0.22];
        c.beginPath(); ribbon(c, [L0, [L0[0] + 0.04 + sw * 0.25, 0.18], [L0[0] + 0.02 + sw * 0.75, 0.6], [L0[0] - 0.02 + sw * 1.35, 1.0]], [0.075, 0.07, 0.05, 0.004]); c.fill();
        c.restore();
      });
    });
  }
  function c28Railing(ctx, fl) {
    // the bridge railing behind her (we look a little up at her): top rail receding to the left
    const yAt = (x) => lerp(752, 790, x / W);
    ctx.save();
    const g = ctx.createLinearGradient(0, 760, 0, H); g.addColorStop(0, '#0a0f1b'); g.addColorStop(1, '#05070d');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-10, yAt(-10) + 8); ctx.lineTo(W + 10, yAt(W + 10) + 8); ctx.lineTo(W + 10, H); ctx.lineTo(-10, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#04060b';
    ctx.beginPath(); ctx.moveTo(-10, yAt(-10) - 9); ctx.lineTo(W + 10, yAt(W + 10) - 12); ctx.lineTo(W + 10, yAt(W + 10) + 12); ctx.lineTo(-10, yAt(-10) + 9); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 44; k++) { const x = -20 + Math.pow(k / 44, 1.1) * (W + 60), y = yAt(x); ctx.fillRect(x, y, lerp(5, 9, x / W), H - y); }
    ctx.fillStyle = `rgba(190,212,250,${(0.14 + 0.75 * fl).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(-10, yAt(-10) - 9); ctx.lineTo(W + 10, yAt(W + 10) - 12); ctx.lineTo(W + 10, yAt(W + 10) - 9); ctx.lineTo(-10, yAt(-10) - 6.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function c28Cables(ctx, fl) {
    // the stay cables of the bridge rising over her, out of focus (painted once: body + a lit edge for the flashes)
    const paint = (lit) => (c) => {
      c.lineCap = 'round'; c.filter = 'blur(3px)';
      for (const [x0, x1, w] of [[1240, 1700, 10], [1400, 1830, 9], [1560, 1960, 8]]) {
        if (!lit) { c.strokeStyle = '#0c1220'; c.lineWidth = w; c.beginPath(); c.moveTo(x0, -40); c.lineTo(x1, 800); c.stroke(); }
        else { c.strokeStyle = 'rgb(170,195,240)'; c.lineWidth = w * 0.3; c.beginPath(); c.moveTo(x0 - w * 0.32, -40); c.lineTo(x1 - w * 0.32, 800); c.stroke(); }
      }
      c.filter = 'none';
    };
    ctx.drawImage(PV.cached('g07:c28cab0', W, H, paint(false)), 0, 0);
    ctx.save(); ctx.globalAlpha = Math.min(1, 0.08 + 0.6 * fl); ctx.drawImage(PV.cached('g07:c28cab1', W, H, paint(true)), 0, 0); ctx.restore();
  }
  function c28RainAlpha(t) {
    if (t < C28.rainStop) return 1;
    if (t < C28.rainStop + 1 / 24) return 0.5;      // the streaks vanish in two frames
    if (t < C28.rainStop + 2 / 24) return 0.18;
    return 0;
  }
  PV.shot('C28', { draw(ctx, tIn, d) {
    const t = clamp(tIn, 0, d), FL = c28Flash(t), fl = FL.fl;
    const still = sm(C28.rainStop, C28.rainStop + 0.25, t) * (1 - sm(C28.gust - 0.1, C28.gust + 0.5, t));
    // cloud time: the sky almost stops while the world stands still
    const ct = t - 0.95 * (Math.min(t, C28.gust) - Math.min(t, C28.rainStop)) * (t > C28.rainStop ? 1 : 0);
    const zoom = 1 + 0.065 * ease.inOutCubic(clamp(t / d)), sk = t > C28.strike ? L.shake(t, 9 * Math.exp(-(t - C28.strike) / 0.28), 14, 28) : { x: 0, y: 0, rot: 0 };
    ctx.save(); PV.camera(ctx, { zoom, cx: 880, cy: 470, x: sk.x, y: sk.y, rot: sk.rot });
    const bolt = L.flashCurve(t, [C28.strike], { decay: 0.32 });
    const ra = c28RainAlpha(t), back = sm(C28.rainBack - 0.05, C28.rainBack + 0.1, t), drops = sm(C28.gust, C28.gust + 0.7, t) * (1 - back);
    const rainK = Math.max(ra, back);
    (lowRes(ctx, 'c28sky', 0.5, (c) => {
      L.skyDome(c, ct, { preset: 'storm', horizon: 900, seed: 28, haze: 0.6, hazeColor: '#2a3550', hazeH: 300 });
      L.stormClouds(c, ct, { h: 860, seed: 28, flash: fl, flashX: FL.main > FL.far ? 1400 : 1520, flashY: 300, flashR: 1100, speed: 26, base: 0.82 });
      // rain veils in the distance (they stop with the rain)
      if (rainK > 0) L.rainCurtain(c, ct, { x0: -200, x1: W + 200, y0: 200, y1: 800, count: 7, seed: 28, alpha: (0.36 + 0.35 * fl) * rainK, color: '#a9b8d6', speed: 1100, drift: t < C28.gust ? 70 : -70, angle: t < C28.gust ? 0.22 : -0.22 });
      // mist hanging in the still air
      if (still > 0.01) { c.save(); c.globalAlpha = 0.35 * still; const mg = c.createLinearGradient(0, 520, 0, 800); mg.addColorStop(0, 'rgba(60,72,104,0)'); mg.addColorStop(1, 'rgba(60,72,104,0.8)'); c.fillStyle = mg; c.fillRect(0, 520, W, 280); c.restore(); }
    }));
    // the strike: after two frames of pure white the sky behind her keeps blazing for ~0.3 s — she, the rail and the
    // cables hang in front of it as black cut-outs with a thin cold rim, the bolt still burning — then the dark returns
    const us = t - C28.strike, hold = us >= 0 ? (us < 0.34 ? 1 : Math.exp(-(us - 0.34) / 0.2)) : 0;
    if (hold > 0.004) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const sg = ctx.createRadialGradient(1420, 420, 80, 1420, 420, 1500);
      sg.addColorStop(0, `rgba(244,247,255,${(0.97 * hold).toFixed(3)})`); sg.addColorStop(0.55, `rgba(214,226,252,${(0.9 * hold).toFixed(3)})`); sg.addColorStop(1, `rgba(170,188,230,${(0.82 * hold).toFixed(3)})`);
      ctx.fillStyle = sg; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore();
    }
    const boltPath = L.lightningPath(2812, 1520, -30, 1360, 790, 0.34, 8);
    if (bolt > 0.02) L.lightning(ctx, boltPath, Math.min(1, bolt * 1.3));
    if (hold > 0.05) {   // on the blazing sky the bolt needs its violet halo to read: draw it opaque over the white
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [w, col, a] of [[22, '120,128,214', 0.28], [9, '176,186,248', 0.6], [3.2, '255,255,255', 1]]) {
        ctx.strokeStyle = `rgba(${col},${(a * hold).toFixed(3)})`;
        for (const lvl of [1, 0.5]) { ctx.lineWidth = w * lvl; ctx.beginPath(); for (const [ax, ay, bx, by, sw] of boltPath) if (Math.abs(sw - lvl) < 0.01) { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); } ctx.stroke(); }
      }
      ctx.restore();
    }
    c28Cables(ctx, fl);
    c28Railing(ctx, fl);
    if (FL.far > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(150,175,225,${(0.1 * FL.far).toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }

    // her: the library figure (wet hair, the white sling), then the face turning out of the hair
    const wind = c28Wind(t), yaw = c28Yaw(q12(t)), shout = sm(C28.gust, C28.gust + 0.2, t) * (1 - 0.5 * sm(3.0, 3.5, t)) + 0.8 * sm(3.5, 3.62, t) * (1 - sm(4.0, 4.5, t));
    const jx = -6 * shout, jy = -5 * shout;                  // she strains toward him on the shout
    const headTilt = 0.1 * (yaw / 1.72) - 0.05 * shout;
    // far flashes wash light round her (backlight); the main strike keeps her a black cut-out with a hard bright rim
    const far = FL.far;
    const fig = { x: C28.ax + jx, y: C28.ay + jy, scale: C28.s, wind: wind.w, windDir: wind.dir, cast: true, outfit: 'blouse', railing: false, railY: C28.railY,
      headTilt, style: 'silhouette', light: C28.light, rimColor: hold > 0.3 ? '#eef4ff' : '#cfe0ff', backlight: 0.1 + 0.8 * far + 0.08 * hold, glow: 0.2 + 0.5 * far + 0.3 * hold,
      rim: 0.85 + 0.6 * far + 1.05 * hold, castTone: (0.46 + 0.3 * far) * (1 - 0.55 * hold), fps: 12 };   // in the blaze the cloth facing us is in shadow too
    (L.girlAtRailing(ctx, t, fig));
    c28SlingShade(ctx, t, fig, far);
    // the face turning out of the hair, drawn over it; the part that lies inside the hair cap is erased (no seam)
    const hd = c28Head(t, fig);
    if (Math.sin(yaw) > 0.05) {
      const m = ctx.getTransform(), u = 92 * C28.s, sxh = m.a * hd.x + m.c * hd.y + m.e, syh = m.b * hd.x + m.d * hd.y + m.f, us = u * m.a;
      const bx = Math.max(0, Math.floor(sxh - 0.7 * us)), by = Math.max(0, Math.floor(syh - 0.9 * us)), bw = Math.min(W - bx, Math.ceil(2.2 * us)), bh = Math.min(H - by, Math.ceil(2.4 * us));
      const FB = PV.buffer('g07:c28face', bw, bh), fc = FB.ctx; fc.clearRect(0, 0, bw, bh);
      const mm = new DOMMatrix([1, 0, 0, 1, -bx, -by]).multiply(m);
      fc.setTransform(mm);
      (c28Face(fc, t, { x: hd.x, y: hd.y, ht: hd.ht, scale: C28.s, yaw, light: C28.light, rimColor: '#cfe0ff', rim: fig.rim, backlight: fig.backlight, glow: fig.glow, windK: wind.w * (t > C28.gust ? 0 : 1) }));
      fc.save(); fc.setTransform(mm); fc.translate(hd.x, hd.y); fc.rotate(hd.ht * 0.6); fc.scale(u, u);
      fc.globalCompositeOperation = 'destination-out'; fc.filter = 'blur(1.5px)';
      fc.beginPath(); fc.ellipse(0, -0.02, 0.425, 0.53, 0, 0, TAU); fc.fill();
      fc.fillRect(-3, 0.25, 3 + 0.27, 3);
      fc.restore();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(FB.canvas, 0, 0, bw, bh, bx, by, bw, bh); ctx.restore();
    }
    // still air: drops fall from her hair tips and from the rail
    if (still > 0.01) {
      ctx.save(); ctx.fillStyle = `rgba(200,215,245,${(0.6 * still).toFixed(3)})`;
      for (let i = 0; i < 10; i++) {
        const per = 0.85 + 0.55 * R1(i, 2861), ph = R1(i, 2862) * per, u = ((t + ph) % per) / per;
        const onHair = i < 4, x0 = onHair ? hd.x + (-0.32 + 0.21 * i) * 92 * C28.s : 120 + 300 * (i - 4), y0 = onHair ? hd.y + 2.6 * 92 * C28.s : lerp(752, 790, (120 + 300 * (i - 4)) / W) + 8;
        if (u > 0.8) continue;
        const y = y0 + u * u * 600; ctx.beginPath(); ctx.ellipse(x0, y, 2.4, 4.5 + 7 * u, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    // rain: mid + near layers; sparse heavy drops with the gust; the downpour again at 102.9
    // (against the blazing sky the returning downpour reads as dark streaks: one layer, its colour follows the sky)
    const dk = hold * back, midA = lerp((0.26 + 0.45 * fl) * rainK * (1 - hold), 0.55 * back, dk), ang = t < C28.gust ? 1 : -1;
    if (midA > 0.005) L.rain(ctx, t, { seed: 2822, count: 520, angle: 0.24 * ang, speed: 2500, len: 96, width: 1.5 + 0.2 * dk, alpha: midA, color: lerpHex('#c9d6f0', '#1c2436', dk) });
    if (drops > 0.01) L.rain(ctx, t, { seed: 2824, count: Math.round(12 + 70 * drops), angle: -0.3, speed: 2100, len: 70, width: 2.2, alpha: 0.32 + 0.4 * fl, color: '#d6e0f5' });
    if (rainK > 0.01) lowRes(ctx, 'c28near', 0.25, (c) => L.rain(c, t, { seed: 2823, count: 64, angle: 0.28 * ang, speed: 3600, len: 320, width: 5.5, alpha: (0.26 + 0.5 * fl) * rainK, color: '#d6e0f5' }), 0, 1, 'screen');
    ctx.restore();
    // 102.7: for two frames the whole frame burns white, then (one soft frame) she is there as a black cut-out
    const white = us >= 0 ? (us < 2 / 24 ? 1 : Math.max(0, 1 - (us - 2 / 24) / (1.5 / 24)) * 0.4) : 0;
    if (white > 0.004) { ctx.save(); ctx.fillStyle = `rgba(242,247,255,${(0.97 * white).toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  } });
})();

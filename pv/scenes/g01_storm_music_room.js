/* g01_storm_music_room — 『キミの右手のアイロニー』本予告  C01〜C04
 *   C01 (0.0–3.0)  嵐の夜：ギプスから覗く右手、3コマの雷光、指先の雨粒が落ちる
 *   C02 (3.0–7.0)  四月の音楽室：高音側の斜め前から〈雪あらし〉を弾く先輩の顔（眉間に力、額の汗、揺れる髪）、霰、
 *                  見物人（アニメ調の生徒のボケ）が日ごとに消え、陰の席でジュースを咥える彼だけが残る
 *   C03 (7.0–9.0)  鍵盤の右手のアップ（C01と同じ画角）、ミスタッチ 7.6／8.4
 *   C04 (9.0–12.5) その日：澄んだ終止→霰が静止→肩で息をする先輩の3/4→ジュースを腿に置く→ピント送り→彼の三つの拍手で
 *                  霰が光の粒に→11.8 ピントが戻り、先輩がはっと目を見開く
 * Characters: PV.anime (anime_head.js / anime_body.js), placed in the music room under its 3-D camera (figPlace).
 * Deterministic: every frame is a pure function of t. Buffers repainted "on twos / threes" are keyed by the
 * quantised time they show (plate()), so frames rendered in any order give the same pixels.
 */
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib, A = PV.anime, W = PV.W, H = PV.H, TAU = Math.PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp, sm = PV.smooth, N2 = PV.noise2, R1 = PV.rand1;

  /* =================================================================== utils */
  const cutT = (t, d) => clamp(t, 0, d - 1e-4);
  const q12 = (t) => Math.floor(t * 12 + 1e-6) / 12;       // anime "on twos"
  const q8 = (t) => Math.floor(t * 8 + 1e-6) / 8;          // "on threes"
  // blur a full-frame canvas at reduced resolution and draw it (much cheaper than a full-res filter)
  function blurBlit(ctx, src, px, alpha) {
    if (alpha === undefined) alpha = 1;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha;
    if (px < 0.4) { ctx.drawImage(src, 0, 0); ctx.restore(); return; }
    // half resolution while the blur is small (line art must not turn blocky mid rack-focus), quarter once the blur hides it;
    // plain bilinear upscale ('high' costs ~12ms in software)
    const q = px > 5 ? 0.25 : 0.5, w = Math.round(W * q), h = Math.round(H * q);
    const b = PV.buffer('g01:blurq' + q, w, h); b.ctx.clearRect(0, 0, w, h);
    b.ctx.filter = 'blur(' + (px * q).toFixed(2) + 'px)'; b.ctx.drawImage(src, 0, 0, w, h); b.ctx.filter = 'none';
    ctx.imageSmoothingQuality = 'low'; ctx.drawImage(b.canvas, 0, 0, W, H); ctx.restore();
  }
  function layer(key) { const b = PV.buffer('g01:' + key); b.ctx.setTransform(1, 0, 0, 1, 0, 0); b.ctx.clearRect(0, 0, W, H); return b; }
  // a full-frame buffer repainted only when `stamp` changes (paint must be a pure function of the stamp). paint may
  // return the device-space box it painted into: only that box is blitted (plates are mostly empty)
  const STAMP = {}, BOX = {};
  function plate(key, stamp, paint) {
    const b = PV.buffer('g01:pl:' + key);
    if (STAMP[key] !== stamp) {
      STAMP[key] = stamp; const c = b.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
      c.clearRect(0, 0, W, H);       // always the whole plate: a stray halo pixel outside a box must never survive into another frame
      c.save(); const box = paint(c); c.restore();
      BOX[key] = box ? [Math.max(0, Math.floor(box[0])), Math.max(0, Math.floor(box[1])), Math.min(W, Math.ceil(box[2])), Math.min(H, Math.ceil(box[3]))] : [0, 0, W, H];
    }
    return { cv: b.canvas, box: BOX[key] };
  }
  // the device box of a local rect under the canvas' current transform
  function devBox(c, x0, y0, x1, y1) {
    const m = c.getTransform(), xs = [], ys = [];
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { xs.push(m.a * x + m.c * y + m.e); ys.push(m.b * x + m.d * y + m.f); }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  // draw a plate rendered at camera zoom z0 (about cx,cy) so that it shows camera zoom z
  function blitZ(ctx, P, z0, z, cx, cy, alpha) {
    const cv = P.cv || P, bx = P.box || [0, 0, W, H], w = bx[2] - bx[0], h = bx[3] - bx[1];
    if (w < 1 || h < 1) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); if (alpha !== undefined) ctx.globalAlpha = alpha;
    const k = z / z0; if (Math.abs(k - 1) > 1e-5) { ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); }
    ctx.drawImage(cv, bx[0], bx[1], w, h, bx[0], bx[1], w, h); ctx.restore();
  }

  /* ============================================================ sprites */
  // ice pellet of the "note hail": an irregular crystal, cold body, darker rim (reads on the bright window too), glint
  function spritePellet(blur) {
    return PV.cached('g01:pellet2:' + blur, 64, 64, (c) => {
      c.translate(32, 32); if (blur) c.filter = 'blur(' + blur + 'px)';
      const r = PV.rng(7), pts = []; const n = 7;
      for (let i = 0; i < n; i++) { const a = i / n * TAU + (r() - 0.5) * 0.5; const rr = 9 * (0.7 + 0.45 * r()) * (i % 2 ? 0.85 : 1.1); pts.push([Math.cos(a) * rr * 1.25, Math.sin(a) * rr * 0.85]); }
      const path = (k) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] * k, p[1] * k) : c.moveTo(p[0] * k, p[1] * k))); c.closePath(); };
      path(1.12); c.fillStyle = '#3f679d'; c.fill();                       // dark cold rim: reads on the bright window
      path(0.94); const g = c.createLinearGradient(-10, -10, 10, 10); g.addColorStop(0, '#f2f8ff'); g.addColorStop(0.45, '#bcd6f2'); g.addColorStop(1, '#7fa6d6'); c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(pts[5][0] * 0.7, pts[5][1] * 0.7); c.lineTo(pts[1][0] * 0.6, pts[1][1] * 0.6); c.stroke(); // facet
      c.fillStyle = 'rgba(255,255,255,1)'; c.beginPath(); c.ellipse(-3.5, -3.2, 3.4, 1.8, -0.6, 0, TAU); c.fill();
    });
  }
  function spritePelletR(blur, k) {
    return PV.cached('g01:pelletR:' + blur + ':' + k, 64, 64, (c) => { c.translate(32, 32); c.rotate(k * TAU / 12); c.drawImage(spritePellet(blur), -32, -32); });
  }
  function spriteDot(k) {   // the head of a far grain
    return PV.cached('g01:dot:' + k, 16, 16, (c) => {
      const r = [1.8, 2.6, 3.6][k]; c.fillStyle = '#eef5fd'; c.strokeStyle = 'rgba(79,120,180,0.7)'; c.lineWidth = 0.9;
      c.beginPath(); c.arc(8, 8, r, 0, TAU); c.fill(); c.stroke();
    });
  }
  // eighth / beamed notes in the same icy material
  function spriteNote(kind, blur) {
    return PV.cached('g01:note2:' + kind + ':' + blur, 72, 72, (c) => {
      c.translate(28, 48); if (blur) c.filter = 'blur(' + blur + 'px)';
      const glyph = (k) => {
        c.beginPath(); c.ellipse(0, 0, 8.4 * k, 6 * k, -0.45, 0, TAU); c.fill();
        c.fillRect(6.2 - 1.2 * (k - 1) * 4, -28 * k, 2.4 * k, 28 * k);
        if (kind === 1) { c.beginPath(); c.moveTo(8.4 * k, -28 * k); c.quadraticCurveTo(19 * k, -20 * k, 15 * k, -10 * k); c.quadraticCurveTo(16 * k, -18 * k, 8.4 * k, -21 * k); c.fill(); }
        if (kind === 2) { c.fillRect(6.2 * k, -28 * k, 18 * k, 4.8 * k); c.beginPath(); c.ellipse(20 * k, -2 * k, 8.4 * k, 6 * k, -0.45, 0, TAU); c.fill(); c.fillRect(22.2 * k, -28 * k, 2.4 * k, 26 * k); }
      };
      c.fillStyle = '#3f679d'; c.save(); c.lineWidth = 3.2; c.strokeStyle = '#3f679d'; c.lineJoin = 'round';
      c.beginPath(); c.ellipse(0, 0, 8.4, 6, -0.45, 0, TAU); c.stroke(); c.strokeRect(6.2, -28, 2.4, 28);
      if (kind === 1) { c.beginPath(); c.moveTo(8.4, -28); c.quadraticCurveTo(19, -20, 15, -10); c.quadraticCurveTo(16, -18, 8.4, -21); c.stroke(); }
      if (kind === 2) { c.strokeRect(6.2, -28, 18, 4.8); c.beginPath(); c.ellipse(20, -2, 8.4, 6, -0.45, 0, TAU); c.stroke(); c.strokeRect(22.2, -28, 2.4, 26); }
      c.restore();
      const g = c.createLinearGradient(-8, -28, 18, 6); g.addColorStop(0, '#f2f8ff'); g.addColorStop(0.55, '#bcd6f2'); g.addColorStop(1, '#86abd9');
      c.fillStyle = g; glyph(1);
      c.fillStyle = 'rgba(255,255,255,1)'; c.beginPath(); c.ellipse(-2.5, -2.2, 3, 1.4, -0.5, 0, TAU); c.fill();
    });
  }
  // motion streak (tail behind the particle, drawn along +x)
  function spriteStreak() {
    return PV.cached('g01:streak', 256, 16, (c) => {
      // cold blue: darker than the bright window, lighter than the silhouettes -> reads on both
      const g = c.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(214,232,252,0.95)'); g.addColorStop(0.12, 'rgba(160,192,230,0.75)'); g.addColorStop(0.5, 'rgba(150,184,224,0.3)'); g.addColorStop(1, 'rgba(150,184,224,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 8); c.lineTo(256, 6.2); c.lineTo(256, 9.8); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(3, 8, 3, 2.6, 0, 0, TAU); c.fill();
    });
  }
  // the same streak in a deeper cold blue with a bright core: reads on the high-key room (walls, curtains, floor)
  function spriteStreakBlue() {
    return PV.cached('g01:streakB', 256, 16, (c) => {
      const g = c.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(92,136,206,0.95)'); g.addColorStop(0.15, 'rgba(112,152,214,0.7)'); g.addColorStop(0.55, 'rgba(130,166,222,0.28)'); g.addColorStop(1, 'rgba(130,166,222,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 8); c.lineTo(256, 6.4); c.lineTo(256, 9.6); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(3, 8, 3, 2.8, 0, 0, TAU); c.fill();
      const g2 = c.createLinearGradient(0, 0, 160, 0); g2.addColorStop(0, 'rgba(240,248,255,0.95)'); g2.addColorStop(1, 'rgba(240,248,255,0)');
      c.fillStyle = g2; c.fillRect(0, 7.4, 160, 1.2);
    });
  }
  // a 4-point crystalline glint (the instant the hail stops in mid air)
  function spriteGlint() {
    return PV.cached('g01:glint', 64, 64, (c) => {
      c.translate(32, 32); c.globalCompositeOperation = 'lighter';
      for (const [a, l, w] of [[0, 30, 1.6], [Math.PI / 2, 30, 1.6], [Math.PI / 4, 14, 1.1], [-Math.PI / 4, 14, 1.1]]) {
        c.save(); c.rotate(a); const g = c.createLinearGradient(-l, 0, l, 0); g.addColorStop(0, 'rgba(220,236,255,0)'); g.addColorStop(0.5, 'rgba(240,248,255,0.95)'); g.addColorStop(1, 'rgba(220,236,255,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, l, w, 0, 0, TAU); c.fill(); c.restore();
      }
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 8); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(210,230,255,0)'); c.fillStyle = g; c.fillRect(-8, -8, 16, 16);
    });
  }
  // warm light mote (the hail "unravelled" by the applause)
  function spriteMote() {
    return PV.cached('g01:mote', 64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,253,244,1)'); g.addColorStop(0.1, 'rgba(255,243,212,0.95)'); g.addColorStop(0.32, 'rgba(255,218,160,0.38)'); g.addColorStop(1, 'rgba(255,200,130,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
  }
  // the hail at a mistouch: a broken grey splinter of ice -- straight torn edges, no barbs (it must read as noise,
  // as "frayed" sound, never as an insect)
  function spriteSplinter(k) {
    return PV.cached('g01:splinter2:' + k, 64, 64, (c) => {
      c.translate(32, 32); const r = PV.rng(51 + k * 13);
      // one long sliver with a torn, stepped tail
      const l1 = 16 + r() * 12, w1 = 1.6 + r() * 1.6, tail = -l1 - 4 - r() * 6;
      c.beginPath(); c.moveTo(l1, (r() - 0.5) * 1.2); c.lineTo(l1 * 0.2, -w1); c.lineTo(-l1 * 0.5, -w1 * 0.7); c.lineTo(-l1 * 0.62, -w1 * 0.1);
      c.lineTo(tail, -0.4); c.lineTo(-l1 * 0.7, w1 * 0.5); c.lineTo(-l1 * 0.2, w1 * 0.9); c.closePath();
      c.fillStyle = 'rgba(112,114,124,0.95)'; c.fill();
      c.strokeStyle = 'rgba(226,228,234,0.8)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-l1 * 0.6, -w1 * 0.35); c.lineTo(l1 * 0.75, -w1 * 0.25); c.stroke();
    });
  }
  // a gust of the blizzard: a long, soft, cold sheet with a few streaks of driven ice inside
  function spriteGust() {
    return PV.cached('g01:gust2', 512, 64, (c) => {
      const g = c.createRadialGradient(256, 32, 0, 256, 32, 256);
      g.addColorStop(0, 'rgba(150,186,232,0.75)'); g.addColorStop(0.45, 'rgba(170,200,240,0.35)'); g.addColorStop(1, 'rgba(180,208,244,0)');
      c.save(); c.translate(256, 32); c.scale(1, 0.12); c.translate(-256, -32); c.fillStyle = g; c.fillRect(0, -240, 512, 544); c.restore();
      const r = PV.rng(17); c.lineCap = 'round';
      for (let i = 0; i < 11; i++) {
        const y = 32 + (r() - 0.5) * 30, x0 = 40 + r() * 220, l = 90 + r() * 220;
        const gg = c.createLinearGradient(x0, 0, x0 + l, 0); gg.addColorStop(0, 'rgba(246,250,255,0)'); gg.addColorStop(0.3, 'rgba(246,250,255,0.9)'); gg.addColorStop(1, 'rgba(246,250,255,0)');
        c.strokeStyle = gg; c.lineWidth = 0.8 + r() * 1.4; c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + l, y + (r() - 0.5) * 3); c.stroke();
      }
    });
  }

  /* ======================================================= the note hail */
  // A blizzard of icy notes in a pseudo-3D space: particles are born near an emitter (the piano) at depth z0 ~1,
  // fly to the left and toward the lens (z shrinks: they grow and blur), with gusting turbulence.
  // o: seed, n, nf (fraction of notes), em {x,y,w,h} (emitter in screen px at depth 1), cx, cy (vanishing point),
  //    vx (px/s at depth 1), vz (approach /s), life [a,b], size, noteK, zFocus, dof, freezeAt, grey 0..1, jag 0..1,
  //    alpha, unravel(p,x,y)->0..1, moteAge(p,x,y)->sec, ambient (fraction spread over the whole frame), mode 'field'
  function hailSet(seed, n, nf) {
    if (nf === undefined) nf = 0.24;
    const key = seed + ':' + n + ':' + nf; hailSet.c = hailSet.c || {};
    if (hailSet.c[key]) return hailSet.c[key];
    const r = PV.rng(seed), ps = [];
    for (let i = 0; i < n; i++) ps.push({ i, u: r(), ex: r(), ey: r(), z0: r(), vk: r(), lk: r(), sz: 0.55 + 0.9 * r(), kind: r() < nf ? (r() < 0.6 ? 1 : 2) : 0, rot: r() * TAU, rs: (r() - 0.5) * 7, ph: r() * 100, tw: r(), amb: r() });
    return (hailSet.c[key] = ps);
  }
  function hailField(p, t, o) {   // steady flow across the frame (no birth/death): enters right, exits left
    const zr = o.zr || [0.6, 1.6], z = lerp(zr[0], zr[1], p.z0), sp = (o.vx || 900) * (0.7 + 0.6 * p.vk) / z;
    const span = W + 400, fall = o.fall === undefined ? 30 : o.fall;
    const gx = N2(p.ph, t * 0.8) * 50 / z, gy = N2(p.ph + 13, t * 0.7) * 70 / z + Math.sin(t * 3.1 + p.ph) * 18 / z;
    const x = W + 200 - ((((p.u * span + sp * t) % span) + span) % span) + gx;
    const yb = p.ey * (H + 160) - 80 + fall * t / z, y = ((yb % (H + 160)) + (H + 160)) % (H + 160) - 80 + gy;
    const vy = (fall + 70 * 0.7 * Math.cos(t * 0.7)) / z;
    return { x, y, z, vx: -sp, vy, fade: 1, a: 1 };
  }
  function hailState(p, t, o) {
    const amb = p.amb < (o.ambient === undefined ? 0.35 : o.ambient);
    const life = lerp(o.life ? o.life[0] : 1.4, o.life ? o.life[1] : 2.4, p.lk);
    const cyc = t / life + p.u, k = cyc - Math.floor(cyc), a = k * life, gen = Math.floor(cyc);
    const rx = R1(p.i, gen * 7 + 3), ry = R1(p.i, gen * 7 + 4);       // a new birth place every generation
    const em = o.em;
    let X, Y, z0;
    const za = o.zAmb || [1.1, 2.2], ze = o.z0 || [0.85, 1.4];
    if (amb) { X = lerp(o.ambX ? o.ambX[0] : -200, o.ambX ? o.ambX[1] : W + 600, rx); Y = lerp(-80, H + 80, ry); z0 = lerp(za[0], za[1], p.z0); }
    else { X = em.x + (rx - 0.5) * em.w; Y = em.y + (ry - 0.5) * em.h; z0 = lerp(ze[0], ze[1], p.z0); }
    const vx = (o.vx || 900) * (0.7 + 0.6 * p.vk), vz = (o.vz === undefined ? 0.35 : o.vz) * (0.6 + 0.8 * p.vk) * (amb ? 0.4 : 1);
    const fall = o.fall === undefined ? 50 : o.fall;
    const z = Math.max(0.2, z0 - vz * a);
    const gx = N2(p.ph, t * 0.8) * 60, gy = N2(p.ph + 13, t * 0.7) * 90 + Math.sin(t * 3.1 + p.ph) * 25;
    const cx = o.cx === undefined ? W / 2 : o.cx, cy = o.cy === undefined ? H / 2 : o.cy;
    const sx = cx + (X - vx * a + gx - cx) / z, sy = cy + (Y + fall * a + gy - cy) / z;
    const a2 = a + 0.03, z2 = Math.max(0.2, z0 - vz * a2);
    const sx2 = cx + (X - vx * a2 + gx - cx) / z2, sy2 = cy + (Y + fall * a2 + gy - cy) / z2;
    const fade = sm(0, 0.12, a) * (1 - sm(life - 0.25, life, a));
    return { x: sx, y: sy, z, vx: (sx2 - sx) / 0.03, vy: (sy2 - sy) / 0.03, fade, a };
  }
  function hail(ctx, t, o) {
    const ps = hailSet(o.seed || 5, o.n || 220, o.nf);
    const tf = o.freezeAt === undefined ? t : Math.min(t, o.freezeAt);
    const frozen = o.freezeAt !== undefined && t > o.freezeAt;
    const streak = o.blue ? spriteStreakBlue() : spriteStreak(), mote = spriteMote();
    const grey = o.grey || 0, jag = o.jag || 0, A = o.alpha === undefined ? 1 : o.alpha, fr = Math.floor(t * 24);
    const noteK = o.noteK || 1.3;
    const list = ps.map(p => ({ p, s: o.mode === 'field' ? hailField(p, tf, o) : hailState(p, tf, o) })).sort((a, b) => b.s.z - a.s.z);
    ctx.save();
    // per particle: one setTransform (base camera x translate x rotate) instead of save/translate/rotate/restore
    const m0 = ctx.getTransform();
    const xf = (x, y, ang) => { const c = Math.cos(ang), sn = Math.sin(ang); ctx.setTransform(m0.a * c + m0.c * sn, m0.b * c + m0.d * sn, -m0.a * sn + m0.c * c, -m0.b * sn + m0.d * c, m0.a * x + m0.c * y + m0.e, m0.b * x + m0.d * y + m0.f); };
    const base = () => ctx.setTransform(m0);
    // far, small grains are batched into a handful of paths (one drawImage each costs more than its pixels):
    // [size bucket][alpha bucket] -> flat coordinate lists
    const BA = [0.35, 0.65, 0.95], bat = o.batch ? { seg: [[[], [], []], [[], [], []]], dot: [[], [], []] } : null, motes = [];
    for (const { p, s } of list) {
      let x = s.x, y = s.y;
      if (x < -150 || x > W + 150 || y < -150 || y > H + 150) continue;
      const size = (o.size || 12) * p.sz / s.z;
      const dof = Math.abs(1 / s.z - 1 / (o.zFocus || 1)) * (o.dof === undefined ? 8 : o.dof);
      const bl = dof < 1.3 ? 0 : dof < 3.8 ? 3 : 7;
      if (frozen) { x += Math.sin(t * 1.3 + p.ph) * 1.5 / s.z; y += Math.cos(t * 1.1 + p.ph) * 2 / s.z; }
      if (jag > 0) { x += (R1(p.i, fr * 3 + 1) - 0.5) * 40 * jag / s.z; y += (R1(p.i, fr * 3 + 2) - 0.5) * 26 * jag / s.z; }
      const un = o.unravel ? o.unravel(p, x, y, s) : 0;
      const al = A * s.fade * (0.78 + 0.22 * clamp(1.4 - s.z)) * (0.85 + 0.15 * Math.sin(t * 9 + p.ph * 3)) * (1 - un);
      const dirA = Math.atan2(-s.vy, -s.vx);
      if (bat && !p.kind && size < o.batch && !frozen && grey === 0 && un === 0) {
        if (al > 0.04) {
          const sp = Math.hypot(s.vx, s.vy), len = Math.min(o.streakMax || 420, sp * (o.streak === undefined ? 0.06 : o.streak));
          const dx = Math.cos(dirA), dy = Math.sin(dirA), sb = size < o.batch * 0.55 ? 0 : 1, ab = al < 0.5 ? 0 : al < 0.8 ? 1 : 2;
          bat.seg[sb][ab].push(x, y, dx * len, dy * len);
          bat.dot[ab].push(x, y, size * 0.3);
        }
        continue;
      }
      if (!frozen && al > 0.02 && grey < 0.95) {
        const sp = Math.hypot(s.vx, s.vy), len = Math.min(o.streakMax || 420, sp * (o.streak === undefined ? 0.06 : o.streak));
        if (len > 6) {
          xf(x, y, dirA); ctx.globalAlpha = al * (o.streakA || 0.6) * (1 - grey);
          ctx.drawImage(streak, 0, -size * 0.22 - 0.8, len, size * 0.44 + 1.6);
        }
      }
      if (al > 0.02 && !(o.headOnly && size < o.headOnly && !p.kind && !frozen && grey === 0)) {
        const isGrey = grey > 0.5;
        const spr = isGrey ? spriteSplinter(p.i % 5) : p.kind ? spriteNote(p.kind, bl) : spritePellet(bl);
        const sz = size * (p.kind ? noteK : 1) * (isGrey ? 1.1 + 0.3 * jag : 1);
        // a splinter lies along its flight (torn by the wind), the others tumble (pellets: 12 pre-rotated steps)
        ctx.globalAlpha = al * (isGrey ? 0.92 : 1);
        if (!isGrey && !p.kind) {
          const st = ((Math.round((p.rot + tf * p.rs) / (TAU / 12)) % 12) + 12) % 12;
          base(); ctx.drawImage(spritePelletR(bl, st), x - sz, y - sz, sz * 2, sz * 2);
        } else {
          xf(x, y, isGrey ? dirA + (p.rot - Math.PI) * 0.25 : Math.sin(p.rot + tf * p.rs * 0.25) * 0.5);
          ctx.drawImage(spr, -sz, -sz, sz * 2, sz * 2);
        }
        if (grey > 0 && !isGrey) { xf(x, y, dirA); ctx.globalAlpha = al * grey * 1.8; ctx.drawImage(spriteSplinter(p.i % 5), -sz, -sz, sz * 2, sz * 2); }
      }
      if (frozen && o.glint && al > 0.05) { // the instant of the freeze: every grain catches the light once
        const gu = t - o.freezeAt - (p.tw * 0.12), gk = gu > 0 ? Math.exp(-gu * 7) * (1 - un) : 0;
        if (gk > 0.02) { const gs = size * 1.7; base(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = clamp(gk * o.glint); ctx.drawImage(spriteGlint(), x - gs, y - gs, gs * 2, gs * 2); ctx.globalCompositeOperation = 'source-over'; }
      }
      if (un > 0) { // warm mote: flares, then drifts up and fades (collected, drawn in one 'screen' pass below)
        const k = o.moteAge ? o.moteAge(p, x, y, s) : 0;          // seconds since conversion
        const flare = 0.65 + 1.4 * Math.exp(-k * 5);
        const rise = k * (12 + 26 * p.tw) / s.z, sway = Math.sin(k * 1.7 + p.ph) * 10 / s.z;
        const ms = size * (1.1 + 1.0 * Math.exp(-k * 4)) * (o.moteSize || 1);
        motes.push(x + sway - ms * 2, y - rise - ms * 4 * 0.5, ms * 4, clamp(A * un * Math.min(1.2, flare) * (0.7 + 0.3 * Math.sin(t * 5 + p.ph * 2)) * (1 - 0.5 * sm(1.4, 3.2, k))));
        if (k < 1.2) for (let j = 0; j < 2; j++) { // the pellet breaks into smaller grains
          const aa = p.ph + j * 2.4, dd = (6 + 26 * sm(0, 1.2, k)) / s.z, s2 = ms * 0.7;
          motes.push(x + Math.cos(aa) * dd - s2, y + Math.sin(aa) * dd - rise * 0.7 - s2, s2 * 2, clamp(A * un * (1 - k / 1.2) * 0.85));
        }
      }
    }
    if (motes.length) {
      base(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < motes.length; i += 4) { if (motes[i + 3] < 0.01) continue; ctx.globalAlpha = motes[i + 3]; ctx.drawImage(mote, motes[i], motes[i + 1], motes[i + 2], motes[i + 2]); }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (bat) {
      // a tapered streak in three strokes (bright head -> faint tail), then the grain itself as a small dot
      base(); ctx.lineCap = 'butt';
      const TAPER = [[0, 0.16, 0.75, 1], [0.15, 0.48, 0.42, 0.8], [0.47, 1, 0.16, 0.6]];
      const LW = [1.5, 2.4], col = o.blue ? ['#6e95d2', '#86a8dc', '#a3bde4'] : ['#cfe0f6', '#c0d4ee', '#b4cae8'];
      for (let sb = 0; sb < 2; sb++) for (let ab = 0; ab < 3; ab++) {
        const arr = bat.seg[sb][ab]; if (!arr.length) continue;
        for (let k = 0; k < 3; k++) {
          const [f0, f1, a, w] = TAPER[k]; ctx.globalAlpha = A * BA[ab] * a; ctx.strokeStyle = col[k]; ctx.lineWidth = LW[sb] * w;
          for (let i = 0; i < arr.length; i += 4) { ctx.beginPath(); ctx.moveTo(arr[i] + arr[i + 2] * f0, arr[i + 1] + arr[i + 3] * f0); ctx.lineTo(arr[i] + arr[i + 2] * f1, arr[i + 1] + arr[i + 3] * f1); ctx.stroke(); }
        }
      }
      for (let ab = 0; ab < 3; ab++) {
        const d = bat.dot[ab]; ctx.globalAlpha = A * BA[ab];
        for (let i = 0; i < d.length; i += 3) { const k = d[i + 2] < 2.2 ? 0 : d[i + 2] < 3.4 ? 1 : 2; ctx.drawImage(spriteDot(k), d[i] - 8, d[i + 1] - 8); }
      }
    }
    ctx.restore();
  }
  // gusts sweeping right -> left: what makes the hail read as a blizzard rather than drifting confetti
  function gusts(ctx, t, o) {
    const spr = spriteGust();
    ctx.save(); ctx.globalCompositeOperation = o.mode || 'source-over';
    for (let i = 0; i < o.n; i++) {
      const sp = (o.speed || 1500) * (0.8 + 0.5 * R1(i, 7)), span = W + 2200;
      const x = W + 1100 - ((((R1(i, 3) * span + sp * t) % span) + span) % span);
      const y = lerp(o.y0, o.y1, R1(i, 5)) + Math.sin(t * 1.7 + i * 2.1) * 36;
      const len = 900 + 700 * R1(i, 9), th = 50 + 80 * R1(i, 11);
      ctx.globalAlpha = o.alpha * (0.45 + 0.55 * R1(i, 13)) * (0.75 + 0.25 * Math.sin(t * 2.3 + i));
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.07 + 0.05 * Math.sin(t * 0.9 + i)); ctx.drawImage(spr, -len / 2, -th / 2, len, th); ctx.restore();
    }
    ctx.restore();
  }

  /* ===================================================== the music room set */
  // Anime rework (faces shown): the grand piano is turned so that she sits facing the blackboard end of the room, the windows
  // on her left. The camera still looks at the window wall (same back light, same room plates), but now sees her face 3/4
  // from the treble end (C02) / close (C04), with the window behind her. The boy's seat by the first pier stays at her back-left:
  // she cannot see him (C04: his claps come from behind her; C05 turns to him).
  // PIANO: room point of the piano's anchor and its rotY (instruments.js grandPiano), her bench in piano-local x.
  const PIANO = { at: [7.46, 4.77], yaw: -0.52, benchX: -0.5 };
  const pianoL2R = (p) => { const a = PIANO.yaw, c = Math.cos(a), s = Math.sin(a), x = p[0] - 0.84, z = p[2] - 0.745; return [PIANO.at[0] + x * c + z * s, p[1], PIANO.at[1] - x * s + z * c]; };
  const BENCH = pianoL2R([PIANO.benchX, 0.495, 0.745]);           // top centre of her bench: the keys are one of her heads above it
  const HER_DIR = [Math.cos(PIANO.yaw), -Math.sin(PIANO.yaw)];     // the room direction she faces (x, z)
  const KEY_Z = (-0.15 - PIANO.benchX) / 0.23 + 0.06;             // pose 'piano' keyZ: the key front edge in her head units
  const ppmAt = (R, w) => Math.abs(R.project([w[0], w[1], w[2]])[1] - R.project([w[0], w[1] + 1, w[2]])[1]);
  const BOY_SEAT = [4.25, 0.427, 0.85];     // his chair seat (1.75 of his heads), in front of the first pier (窓間壁), where the sun does not reach (原作311)
  const BOY_DIR = (() => { const dx = BENCH[0] - BOY_SEAT[0], dz = BENCH[2] - BOY_SEAT[2], l = Math.hypot(dx, dz); return [dx / l, dz / l]; })();   // he watches her
  const ROOM = {
    c02: { view: 'windows', time: 'noon', furniture: 'none', wind: 0.6, cam: { eye: [6.05, 1.3, 6.95], target: [6.6, 1.12, 0], fov: 56 }, shaft: 0.55, dust: false },
    c04: { view: 'windows', time: 'noon', furniture: 'none', wind: 0.5, cam: { eye: [6.76, 1.25, 6.66], target: [5.58, 0.88, 2.84], fov: 42 }, shaft: 0.5, dust: false },
  };
  const pianoOpts = (R, extra) => R.piano(PIANO.at[0], PIANO.at[1], PIANO.yaw, Object.assign({ lidOpen: 1, bench: false, rimLit: true, desk: false }, extra || {}));
  const ROOM_R = {};
  // the room's projection (and R.piano()) for a camera, without drawing anything every frame
  function roomR(k) {
    if (!ROOM_R[k]) { const b = PV.buffer('g01:roomprobe'); ROOM_R[k] = L.musicRoom(b.ctx, 0, ROOM[k]); }
    return ROOM_R[k];
  }
  // one frame of the room (curtains, clouds, shafts) for room-time rt, painted at camera zoom z0 about (cx,cy)
  function paintRoom(c, k, rt, z0, cx, cy) {
    c.save(); PV.camera(c, { zoom: z0, cx, cy }); const R = L.musicRoom(c, rt, ROOM[k]); c.restore();
    if (!ROOM_R[k]) ROOM_R[k] = R;
  }

  // aerial haze in the backlit room: lifts the far wall and the boy a little so the pianist reads in front
  function roomHaze(ctx, R, k) {
    const a = R.project([7, 2.6, 0.2]), b = R.project([7, 0, 1.2]);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createLinearGradient(0, a[1] - 200, 0, b[1] + 60);
    g.addColorStop(0, `rgba(255,244,226,${0.05 * k})`); g.addColorStop(0.55, `rgba(255,240,218,${0.15 * k})`); g.addColorStop(1, 'rgba(255,240,218,0)');
    ctx.fillStyle = g; ctx.fillRect(-200, a[1] - 200, W + 400, b[1] - a[1] + 260); ctx.restore();
  }
  // the same air between him and the camera, laid over a figure plate only (source-atop: it lifts his silhouette)
  function hazeOn(c, R, k) {
    const a = R.project([7, 2.6, 0.2]), b = R.project([7, 0, 1.2]);
    c.save(); c.globalCompositeOperation = 'source-atop';
    const g = c.createLinearGradient(0, a[1] - 200, 0, b[1] + 60);
    g.addColorStop(0, `rgba(255,244,226,${0.05 * k})`); g.addColorStop(0.55, `rgba(255,240,218,${0.15 * k})`); g.addColorStop(1, 'rgba(255,240,218,0)');
    c.fillStyle = g; c.fillRect(-200, a[1] - 200, W + 400, b[1] - a[1] + 260); c.restore();
  }
  // the pier behind the boy's seat gets no sun: the curtain bunched in front of it sinks into a cool, soft shade, and
  // so does his patch of floor by the wall (same treatment as C05, so the seat reads the same across the cut)
  function pierShade(ctx, R, k) {
    const a = R.project([3.7, 2.75, 0.06]), b = R.project([4.55, 0.0, 0.06]), s = R.project([BOY_SEAT[0], 0, BOY_SEAT[2]]);
    const x0 = a[0], x1 = b[0], w = x1 - x0, y0 = a[1], y1 = b[1], pxm = ppmAt(R, [BOY_SEAT[0], 0, BOY_SEAT[2]]);
    const mixc = (r, g, bb, f) => `rgb(${Math.round(255 - (255 - r) * f)},${Math.round(255 - (255 - g) * f)},${Math.round(255 - (255 - bb) * f)})`;
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    let g = ctx.createLinearGradient(x0 - w * 0.45, 0, x1 + w * 0.45, 0);
    g.addColorStop(0, mixc(255, 255, 255, k)); g.addColorStop(0.25, mixc(180, 178, 186, k)); g.addColorStop(0.62, mixc(168, 166, 176, k)); g.addColorStop(1, mixc(255, 255, 255, k));
    ctx.fillStyle = g; ctx.fillRect(x0 - w * 0.45, y0, w * 1.9, y1 - y0);
    // his patch of floor
    g = ctx.createRadialGradient(s[0], s[1], pxm * 0.1, s[0], s[1], pxm * 1.25);
    g.addColorStop(0, mixc(156, 148, 150, 0.9 * k)); g.addColorStop(1, 'rgb(255,255,255)');
    ctx.translate(s[0], s[1]); ctx.scale(1, 0.32); ctx.translate(-s[0], -s[1]);
    ctx.fillStyle = g; ctx.fillRect(s[0] - pxm * 1.3, s[1] - pxm * 1.3, pxm * 2.6, pxm * 2.6);
    ctx.restore();
  }

  // foreground spectators: anime-style students seen from behind (3/4 back, turned toward her), right at the lens. Each one is
  // drawn once with PV.anime.figure at its size in the frame into a cached canvas and pre-blurred (bokeh); per frame only a
  // slow bob on twos. sp: id, who, outfit, facing, s (head px), (x, y) = screen position of the neck point, hair, amb
  const SPEC_BLUR = 12;
  const specNeckY = (s) => Math.round(s * 1.3);
  function spectatorSprite(sp) {
    const s = sp.s, w = Math.round(s * 5.2), h = Math.round(s * 3.8), nx = w / 2, ny = specNeckY(s);
    return PV.cached('g01:aspec:' + sp.id, w, h, (c) => {
      const b = PV.makeCanvas(w, h), cc = b.ctx;
      const up = (sp.who === 'boy' ? 7.3 : 7.0) - 0.88;      // the neck point above the feet (head units)
      A.figure(cc, { who: sp.who, outfit: sp.outfit, pose: 'stand', facing: sp.facing, camPitch: 0.04, x: nx, y: ny + up * s, scale: s, T: 3.2 + sp.ph,
        light: 'window', rimDir: sp.rimDir === undefined ? -1.5 : sp.rimDir, amb: sp.amb === undefined ? 0.5 : sp.amb,
        params: { arms: 'relax', weight: sp.weight || 0 }, head: Object.assign({ hair: { still: true } }, sp.head || {}) });
      c.filter = 'blur(' + SPEC_BLUR + 'px)'; c.drawImage(b.canvas, 0, 0); c.filter = 'none';
    });
  }
  function spectators(ctx, t, list, push) {
    const tq = q12(t);
    for (const sp of list) {
      if (sp.a <= 0.01) continue;
      const spr = spectatorSprite(sp), k = 1 + push;
      const bob = Math.sin(tq * 0.9 + sp.ph) * 4 + N2(sp.ph, tq * 0.5) * 3;
      ctx.save(); ctx.globalAlpha = sp.a;
      ctx.translate(sp.x + (sp.x - 960) * push, sp.y + bob + (sp.y - 540) * push * 0.6); ctx.rotate(sp.rot || 0); ctx.scale(k, k);
      ctx.drawImage(spr, -spr.width / 2, -specNeckY(sp.s)); ctx.restore();
    }
  }

  // big out-of-focus curtain hanging at the right edge, in shade: frames the shot and gives the vertical monologue a
  // dark ground. Thin cloth: the window glows through its folds and along the edge. Painted once (pre-blurred).
  function curtainSprite() {
    const w = 640, h = H + 160;
    return PV.cached('g01:fgcurtain3', w, h, (c) => {
      const b = PV.makeCanvas(w, h), cc = b.ctx, x0 = 70;
      const edge = (y) => { const k = y / h; return x0 + Math.sin(y * 0.011) * 12 * k - k * 46 + 18 * k * k; };
      cc.fillStyle = 'rgba(33,28,36,0.97)'; cc.beginPath(); cc.moveTo(edge(0), 0);
      for (let y = 0; y <= h; y += 40) cc.lineTo(edge(y), y);
      cc.lineTo(w, h); cc.lineTo(w, 0); cc.closePath(); cc.fill();
      cc.globalCompositeOperation = 'source-atop';
      // deeper shade toward the frame edge
      let g = cc.createLinearGradient(x0, 0, w, 0); g.addColorStop(0, 'rgba(58,46,52,0.6)'); g.addColorStop(0.35, 'rgba(30,25,33,0)'); g.addColorStop(1, 'rgba(10,9,14,0.55)');
      cc.fillStyle = g; cc.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { // folds: the window glows faintly through the thin cloth between them
        const fx = x0 + 40 + i * 74 + (i % 3) * 11, fw = 22 + (i % 2) * 14, gg = cc.createLinearGradient(fx - fw, 0, fx + fw, 0);
        gg.addColorStop(0, 'rgba(255,226,196,0)'); gg.addColorStop(0.5, `rgba(255,224,190,${0.07 + 0.05 * ((i + 1) % 2)})`); gg.addColorStop(1, 'rgba(255,226,196,0)');
        cc.fillStyle = gg; cc.fillRect(fx - fw, 0, fw * 2, h);
        const sh = cc.createLinearGradient(fx + fw * 0.6, 0, fx + fw * 1.8, 0); sh.addColorStop(0, 'rgba(8,6,10,0)'); sh.addColorStop(0.5, 'rgba(8,6,10,0.28)'); sh.addColorStop(1, 'rgba(8,6,10,0)');
        cc.fillStyle = sh; cc.fillRect(fx + fw * 0.6, 0, fw * 1.2, h);
      }
      // the lit edge of the cloth: a narrow warm translucency, brightest high up where the window is behind it
      g = cc.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,232,200,0.75)'); g.addColorStop(0.55, 'rgba(255,226,190,0.5)'); g.addColorStop(1, 'rgba(255,220,180,0.25)');
      cc.save(); cc.beginPath(); for (let y = 0; y <= h; y += 40) cc.rect(edge(y) - 4, y, 34, 41); cc.clip(); cc.fillStyle = g; cc.fillRect(0, 0, w, h); cc.restore();
      c.filter = 'blur(9px)'; c.drawImage(b.canvas, 0, 0);
    });
  }
  function fgCurtain(ctx, t, x0, alpha) {
    const spr = curtainSprite(), sway = Math.sin(t * 0.8) * 0.018 + N2(3.3, t * 0.4) * 0.012;
    ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.setTransform(1, 0, sway, 1, x0 - 70 - sway * 80, -80);   // skew about the top: the hem swings
    ctx.drawImage(spr, 0, 0); ctx.restore();
  }

  // window light whose angle changes day by day (time-lapse): shafts in the air + long streaks across the floor.
  // Each day's light is painted once (it only changes at the day boundaries) and blended in with a slow flicker.
  function dayLightImg(R, day, camKey) {
    return PV.cached('g01:day:' + camKey + ':' + day, W / 2, H / 2, (c) => {
      const b = PV.makeCanvas(W, H), cc = b.ctx;
      const ang = [2.14, 1.95, 1.76, 1.6, 1.46][day], o = R.project([4.9, 2.55, -0.1]);
      L.godRays(cc, 0, { x: o[0], y: o[1], angle: ang, spread: 0.3, count: 8, length: 1800, width: 130, flare: 2.6, alpha: 0.2, color: '#fff1d4', seed: 12 + day, jitter: 760, flicker: 0 });
      cc.globalCompositeOperation = 'lighter';
      const sx = [-0.9, -0.4, 0.1, 0.55, 0.95][day];
      for (const [x0, x1] of [[1.3, 3.8], [4.4, 6.9], [7.5, 10.0], [10.6, 13.1]]) {
        const q = [[x0 + 0.1, 0, 0.3], [x1 - 0.1, 0, 0.3], [x1 - 0.1 + sx * 4.4, 0, 4.8], [x0 + 0.1 + sx * 4.4, 0, 4.8]].map(p => R.project(p));
        const g = cc.createLinearGradient(q[0][0], q[0][1], q[3][0], q[3][1]); g.addColorStop(0, 'rgba(255,236,200,0.5)'); g.addColorStop(0.7, 'rgba(255,236,200,0.16)'); g.addColorStop(1, 'rgba(255,236,200,0)');
        cc.fillStyle = g; cc.beginPath(); q.forEach((p, i) => (i ? cc.lineTo(p[0], p[1]) : cc.moveTo(p[0], p[1]))); cc.closePath(); cc.fill();
      }
      c.filter = 'blur(3px)'; c.drawImage(b.canvas, 0, 0, W / 2, H / 2);
    });
  }
  function dayLight(ctx, t, R, day, tr, camKey, flFix) {
    const fl = flFix === undefined ? 0.9 + 0.1 * N2(t * 0.6, 4.4) : flFix;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    if (tr < 1 && day > 0) { ctx.globalAlpha = (1 - tr) * fl; ctx.drawImage(dayLightImg(R, day - 1, camKey), 0, 0, W, H); }
    ctx.globalAlpha = (tr < 1 && day > 0 ? tr : 1) * fl; ctx.drawImage(dayLightImg(R, day, camKey), 0, 0, W, H);
    ctx.restore();
  }

  /* ====================================================== the characters (PV.anime) */
  const HEAD_M = { senpai: 0.23, boy: 0.244 };    // head height chin -> crown in metres (161 cm / 7.0 heads, 178 cm / 7.3)
  // a figure whose pose anchor is at room point p, facing the room direction fd [x, z], seen by the room camera of R: its screen
  // anchor, head size in px, facing relative to the line of sight (+ toward screen right) and the camera's pitch toward its chest
  function figPlace(R, p, fd, who, chestH) {
    const cam = R.cam, a = R.project(p), s = cam.scaleAt(p) * HEAD_M[who];
    let tx = cam.eye[0] - p[0], tz = cam.eye[2] - p[2]; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
    let rx = cam.r[0], rz = cam.r[2]; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    return { x: a[0], y: a[1], scale: s, facing: Math.atan2(fd[0] * rx + fd[1] * rz, fd[0] * tx + fd[1] * tz),
      camPitch: Math.atan2(cam.eye[1] - p[1] - (chestH || 0.45), tl) };
  }
  // 先輩 at the grand piano, seen by the room camera (her own bench; the keys are the scene's piano: keyH / keyZ match it).
  // o: intensity, play, hands, look, breathe, lean, tilt, neckYaw, rimDir, head (PV.anime.head options). Returns the figure info.
  function drawPianist(c, R, T, o) {
    const P = figPlace(R, BENCH, HER_DIR, 'senpai', 0.42);
    return A.figure(c, {
      who: 'senpai', outfit: 'uniform', pose: 'piano', facing: P.facing, camPitch: P.camPitch, x: P.x, y: P.y, scale: P.scale, T,
      light: 'window', rimDir: o.rimDir === undefined ? -1.25 : o.rimDir, rimA: o.rimA,
      params: { intensity: o.intensity, play: o.play === undefined ? 1 : o.play, hands: o.hands || 'keys', look: o.look || 'keys', breathe: o.breathe || 0,
        lean: o.lean || 0, tilt: o.tilt || 0, neckYaw: o.neckYaw || 0, keys: false, bench: true, benchH: 2.15, keyH: 1.0, keyZ: KEY_Z },
      head: o.head || {},
    });
  }
  // The scene's keyboard is in front of her lap and under her hands (the body library knows that only for its own keyboard).
  // After she is painted, the grand piano (a cached image) is painted again inside the projected keyboard: key tops, the front
  // of the keybed, the treble cheek block and the treble front leg -- minus her arms (a wide capsule from each shoulder to just
  // past each hand). c: her plate (room-camera space under the plate's zoom), info: PV.anime.figure's return, s: her head px
  function keysOver(c, R, info, s) {
    const Wd = 1.49, cw = (Wd - 1.222) / 2, P = (x, y, z) => R.project(pianoL2R([x, y, z]));
    const polys = [
      [P(-0.152, 0.74, cw), P(0.002, 0.74, cw), P(0.002, 0.74, Wd - cw), P(-0.152, 0.74, Wd - cw)],          // key tops (black keys included)
      [P(-0.158, 0.62, cw), P(-0.158, 0.745, cw), P(-0.158, 0.745, Wd - cw), P(-0.158, 0.62, Wd - cw)],      // front of the keybed
    ];
    const corners = (b) => { const o = []; for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) o.push(P(x, y, z)); return o; };
    for (const b of [[-0.176, 0.62, Wd - cw - 0.004, 0.003, 0.806, Wd + 0.004], [-0.142, 0, Wd - cw + 0.01, -0.028, 0.63, Wd - 0.008]]) polys.push(hull2(corners(b)));
    // device-space box of the keyboard: only that part of the buffer is cleared and composited
    const m = c.getTransform(), B = PV.buffer('g01:keysOver'), bc = B.ctx;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of polys) for (const p of q) { const X = m.a * p[0] + m.c * p[1] + m.e, Y = m.b * p[0] + m.d * p[1] + m.f; x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y); }
    x0 = Math.max(0, Math.floor(x0) - 2); y0 = Math.max(0, Math.floor(y0) - 2); x1 = Math.min(W, Math.ceil(x1) + 2); y1 = Math.min(H, Math.ceil(y1) + 2);
    if (x1 <= x0 || y1 <= y0) return;
    bc.setTransform(1, 0, 0, 1, 0, 0); bc.clearRect(x0, y0, x1 - x0, y1 - y0); bc.setTransform(m);
    bc.save(); bc.beginPath();
    for (let q of polys) { if (area2(q) < 0) q = q.slice().reverse(); q.forEach((p, i) => (i ? bc.lineTo(p[0], p[1]) : bc.moveTo(p[0], p[1]))); bc.closePath(); }
    bc.clip(); L.grandPiano(bc, pianoOpts(R)); bc.restore();
    bc.globalCompositeOperation = 'destination-out'; bc.lineCap = 'round'; bc.strokeStyle = '#000'; bc.lineWidth = s * 0.44;
    for (const k of ['L', 'R']) {
      const S0 = info.shoulders[k], Hh = info.hands[k];
      bc.beginPath(); bc.moveTo(S0[0], S0[1]); bc.lineTo(Hh[0] + (Hh[0] - S0[0]) * 0.22, Hh[1] + (Hh[1] - S0[1]) * 0.22); bc.stroke();
    }
    bc.globalCompositeOperation = 'source-over';
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(B.canvas, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); c.restore();
  }
  const area2 = (q) => { let a = 0; for (let i = 0; i < q.length; i++) { const p = q[i], r = q[(i + 1) % q.length]; a += p[0] * r[1] - r[0] * p[1]; } return a; };
  function hull2(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  // 彼 takes the straw from his mouth, stands the pack on his thigh and claps: one continuous action. The library's chair pose has
  // 'juice' (sip) and 'clap' as separate variants; this local pose blends their body and arm targets (prm.k 0 = juice, 1 = clap;
  // prm.hold = the pack still in his hand). It is put in PV.anime.FIG_POSES under a g01_ name only for the duration of the call.
  function lerpDeep(a, b, k) {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * k;
    if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => lerpDeep(v, b[i], k));
    if (a && b && typeof a === 'object' && typeof b === 'object') { const o = {}; for (const key in a) o[key] = key in b ? lerpDeep(a[key], b[key], k) : a[key]; for (const key in b) if (!(key in o)) o[key] = b[key]; return o; }
    return k < 0.5 ? a : b;
  }
  const G01_CLAP = 'g01_juiceClap';
  const juiceClapPose = {
    facing: '3q_left', anchor: 'top centre of the chair seat', armsFront: true,
    body(sp, prm, tq, o, OF) {
      const B = A.FIG_POSES.seated_chair;
      return lerpDeep(B.body(sp, Object.assign({}, prm, { variant: 'juice' }), tq, o, OF), B.body(sp, Object.assign({}, prm, { variant: 'clap' }), tq, o, OF), prm.k || 0);
    },
    limbs(J, sp, prm, tq, o, OF) {
      const B = A.FIG_POSES.seated_chair, k = prm.k || 0;
      const a = B.limbs(J, sp, Object.assign({}, prm, { variant: 'juice' }), tq, o, OF), b = B.limbs(J, sp, Object.assign({}, prm, { variant: 'clap' }), tq, o, OF);
      const arms = { L: lerpDeep(a.arms.L, b.arms.L, k), R: lerpDeep(a.arms.R, b.arms.R, k) };
      if (!prm.hold && arms.R.hand) delete arms.R.hand.kind;        // the hand lets go of the pack
      return { legs: a.legs, arms };
    },
    props(G, prm, tq, o) { A.FIG_POSES.seated_chair.props(G, Object.assign({}, prm, { variant: prm.hold ? 'juice' : 'idle' }), tq, o); },
  };
  function withPose(name, fn) {
    if (name !== G01_CLAP) return fn();
    const P = A.FIG_POSES, had = Object.prototype.hasOwnProperty.call(P, name), old = P[name];
    P[name] = juiceClapPose;
    try { return fn(); } finally { if (had) P[name] = old; else delete P[name]; }
  }
  // 彼 on a school chair by the pier, in its shade (window light with a deeper ambient and a soft rim; no head rim: he is small)
  function drawBoy(c, R, T, o) {
    const P = figPlace(R, BOY_SEAT, BOY_DIR, 'boy', 0.5), pose = o.pose || 'seated_chair';
    return withPose(pose, () => A.figure(c, {
      who: 'boy', outfit: 'uniform', pose, facing: P.facing, camPitch: P.camPitch, x: P.x, y: P.y, scale: P.scale, T,
      light: 'window', rimDir: o.rimDir === undefined ? -1.9 : o.rimDir, amb: o.amb, rimA: o.rimA,
      params: o.params || {}, head: Object.assign({ rim: 0 }, o.head || {}),
    }));
  }
  // the juice pack standing on his thigh once he has let go of it (the library draws it only in his hand): an orange carton with
  // two white bands and the straw, drawn in screen space at (x, y) = the pack centre, h = its height in px
  function juicePack(c, x, y, h, light, tilt) {
    const mB = A.mat('carton_band', light), mW = A.mat('carton', light), mS = A.mat('straw', light);
    const w = h * 0.6, dx = h * 0.2, dy = -h * 0.1, lw = Math.max(0.8, h * 0.035);
    c.save(); c.translate(x, y); c.rotate(tilt || 0); c.lineJoin = 'round';
    const quad = (pts, fill) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fillStyle = fill; c.fill(); };
    const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
    quad([[x1, y0], [x1 + dx, y0 + dy], [x1 + dx, y1 + dy], [x1, y1]], mB.shade);                 // side (away from the window)
    quad([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], mB.base);                                       // front
    for (const [a, b] of [[0.06, 0.3], [0.58, 0.78]]) {                                             // the white bands round the carton
      quad([[x0, y0 + h * a], [x1, y0 + h * a], [x1, y0 + h * b], [x0, y0 + h * b]], mW.base);
      quad([[x1, y0 + h * a], [x1 + dx, y0 + h * a + dy], [x1 + dx, y0 + h * b + dy], [x1, y0 + h * b]], mW.shade);
    }
    quad([[x0, y0], [x0 + dx, y0 + dy], [x1 + dx, y0 + dy], [x1, y0]], mB.hi);                     // top
    c.strokeStyle = mB.line; c.lineWidth = lw; c.beginPath();
    c.moveTo(x0, y1); c.lineTo(x0, y0); c.lineTo(x0 + dx, y0 + dy); c.lineTo(x1 + dx, y0 + dy); c.lineTo(x1 + dx, y1 + dy); c.lineTo(x1, y1); c.closePath(); c.moveTo(x1, y0); c.lineTo(x1, y1); c.moveTo(x0, y0); c.lineTo(x1, y0); c.stroke();
    c.strokeStyle = mS.line; c.lineWidth = lw * 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1 - w * 0.2, y0 + dy * 0.5); c.lineTo(x1 - w * 0.05, y0 - h * 0.42); c.stroke();
    c.strokeStyle = mS.base; c.lineWidth = lw * 1.3; c.stroke();
    c.restore();
  }
  // beads of sweat (張り詰めた演奏の顔：額に大粒の汗, design sheet 2-4), placed from the head's anchors: one at the near temple by
  // the hairline, one running down the near jaw line, a small one on the forehead between the bang tips. Never under the eye:
  // there a drop reads as a tear. Clear drops: a faint skin-shadow crescent, a bright rim and a glint. k = amount 0..1
  function sweat(c, Hd, k, t, light) {
    if (!Hd || !Hd.eyeL || k <= 0.01) return;
    const s = Hd.size, eL = Hd.eyeL, eR = Hd.eyeR, cr = Hd.crown, ch = Hd.chin, ns = Hd.nose, eaL = Hd.earL || eL;
    let ux = cr[0] - ch[0], uy = cr[1] - ch[1]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;      // head up
    let ox = eL[0] - eR[0], oy = eL[1] - eR[1]; const ol = Math.hypot(ox, oy) || 1; ox /= ol; oy /= ol;      // outward, the near side
    const mx = (eL[0] + eR[0]) / 2, my = (eL[1] + eR[1]) / 2;
    let fx = ns[0] - mx, fy = ns[1] - my; const fu = fx * ux + fy * uy; fx -= ux * fu; fy -= uy * fu;          // face forward (0 if frontal)
    const skin = A.mat('skin', A.faceLight ? A.faceLight(light) : light);
    const drop = (px, py, r, a, ang) => {
      c.save(); c.translate(px, py); c.rotate(ang || 0); c.globalAlpha = a;
      const shape = () => { c.beginPath(); c.moveTo(0, -r * 1.9); c.bezierCurveTo(r * 0.5, -r * 1.0, r * 0.95, -r * 0.2, r * 0.95, r * 0.3); c.arc(0, r * 0.3, r * 0.95, 0, Math.PI); c.bezierCurveTo(-r * 0.95, -r * 0.2, -r * 0.5, -r * 1.0, 0, -r * 1.9); c.closePath(); };
      shape(); c.fillStyle = A.rgbaHex ? A.rgbaHex(skin.shade, 0.55) : 'rgba(200,150,140,0.5)'; c.fill();
      c.save(); shape(); c.clip(); c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(-r * 0.25, -r * 0.35, r * 0.85, r * 1.5, 0, 0, TAU); c.fill(); c.restore();
      shape(); c.strokeStyle = skin.line; c.globalAlpha = a * 0.55; c.lineWidth = Math.max(0.5, r * 0.22); c.stroke();
      c.globalAlpha = a; c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(-r * 0.32, -r * 0.05, r * 0.24, r * 0.5, -0.25, 0, TAU); c.fill();
      c.beginPath(); c.arc(r * 0.35, r * 0.62, r * 0.16, 0, TAU); c.fill();
      c.restore();
    };
    const r = Math.max(1.0, s * 0.02), up = Math.atan2(ux, -uy);
    // near temple, just above the outer end of the near eye
    drop(eL[0] + ox * s * 0.1 + ux * s * 0.08, eL[1] + oy * s * 0.1 + uy * s * 0.08, r, k, up);
    // down the near jaw line toward the chin (on twos), replaced every ~2.2 s
    const u = (q12(t) * 0.45) % 1, jf = 0.36 - 0.2 * u, jx = ch[0] + (eaL[0] - ch[0]) * jf, jy = ch[1] + (eaL[1] - ch[1]) * jf;
    drop(jx + (ns[0] - jx) * 0.1, jy + (ns[1] - jy) * 0.1, r * 0.85, k * (1 - 0.6 * u * u), up);
    // a small one on the forehead, between the bang tips
    drop(ns[0] + ux * s * 0.3 - fx * 0.3 + ox * s * 0.03, ns[1] + uy * s * 0.3 - fy * 0.3 + oy * s * 0.03, r * 0.65, k * 0.8, up);
  }

  /* ============================================================== C01 */
  // Storm night (flash-forward). The right hand in its cast, in exactly the screen place / direction / size of the
  // playing hand of C03 (match cut: the hand that will be lost <-> the living hand).
  // cut-local: lightning frames 0.90 / 0.98 / 1.06 (= the frames 21 / 23 / 25 that contain those instants),
  // the drop falls at 2.55, white flash 2.85
  const C01 = { strikes: [21 / 24, 23 / 24, 25 / 24], drop: 2.55, final: 2.85 };
  function c03HandRef() {
    if (c03HandRef.v) return c03HandRef.v;
    const b = PV.buffer('g01:probe', 8, 8);
    const rig = L.handOnKeys(b.ctx, Object.assign({}, HANDKEYS, { t: 0, press: [0, 0, 0, 0, 0], alpha: 0, drawKeys: false, shadow: false }));
    return (c03HandRef.v = { wrist: { x: rig.wrist.x, y: rig.wrist.y }, mcp: { x: rig.joints[2][0].x, y: rig.joints[2][0].y }, unit: rig.unit });
  }
  // armCast options matched to the C03 hand (solved once: rotation, scale and wrist position)
  function castOpts() {
    if (castOpts.v) return castOpts.v;
    const ref = c03HandRef();
    const base = { side: 'R', kind: 'her', view: 'back', yaw: -0.85, pitch: 0.1, spread: 0.3, arm: 380, t: 0, tremble: 0, layerAll: 'front', surgicalScars: false,
      curl: [0.2, 0.28, 0.33, 0.38, 0.45], coverFingers: 0.2, sling: false };
    const dRef = Math.atan2(ref.mcp.y - ref.wrist.y, ref.mcp.x - ref.wrist.x), lRef = Math.hypot(ref.mcp.y - ref.wrist.y, ref.mcp.x - ref.wrist.x);
    let rot = Math.PI / 2 - 0.4, scale = 2.4;
    for (let it = 0; it < 6; it++) {
      const r = L.handRig(Object.assign({}, base, { x: ref.wrist.x, y: ref.wrist.y, rot, scale, _m: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }));
      const m = r.joints[2][0], d = Math.atan2(m.y - r.wrist.y, m.x - r.wrist.x), l = Math.hypot(m.y - r.wrist.y, m.x - r.wrist.x);
      rot += dRef - d; scale *= lRef / l;
    }
    // 1.2x about the knuckles: only the fingers peek out of the cast, so give them the C03 hand's reach
    const k = 1.2, x = ref.mcp.x + (ref.wrist.x - ref.mcp.x) * k, y = ref.mcp.y + (ref.wrist.y - ref.mcp.y) * k;
    return (castOpts.v = Object.assign({}, base, { x, y, rot, scale: scale * k }));
  }
  // the cast hand, painted once: lit by the lightning (cold white), sunk into indigo, and its cold rim
  function castLayers() {
    if (castLayers.v) return castLayers.v;
    const o = castOpts();
    const raw = PV.makeCanvas(W, H);
    // the bolt is to the upper right: the flash comes from there
    const rig = L.armCast(raw.ctx, Object.assign({}, o, { light: -1.15, keyColor: '#d6e2ff', fillColor: '#27324f', tint: 1.0, castColor: '#f0f4fb' }));
    // wet sheen: a few beads of rain on the cast and the knuckles (catch the flash)
    const c = raw.ctx; c.save(); c.globalCompositeOperation = 'source-atop';
    const r = PV.rng(5);
    for (let i = 0; i < 70; i++) {
      const k = r(), x = lerp(o.x - 520, o.x + 120, k) + (r() - 0.5) * 160, y = lerp(o.y + 330, o.y - 40, k) + (r() - 0.5) * 140, rr = 1.5 + r() * 4;
      c.fillStyle = 'rgba(40,52,80,0.35)'; c.beginPath(); c.ellipse(x + 1, y + 1.5, rr, rr * 1.1, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(x - rr * 0.3, y - rr * 0.3, rr * 0.35, rr * 0.28, 0, 0, TAU); c.fill();
    }
    c.restore();
    // lightning is cold: re-colour toward the flash blue, keeping the values (the skin must not stay peach)
    const lit = PV.makeCanvas(W, H), lc = lit.ctx;
    lc.drawImage(raw.canvas, 0, 0);
    lc.globalCompositeOperation = 'color'; lc.globalAlpha = 0.82; lc.fillStyle = '#9fb4d8'; lc.fillRect(0, 0, W, H);
    lc.globalAlpha = 1; lc.globalCompositeOperation = 'destination-in'; lc.drawImage(raw.canvas, 0, 0);
    // hard flash light: the side away from the bolt falls off into the storm blue
    lc.globalCompositeOperation = 'source-atop';
    const sg = lc.createLinearGradient(o.x + 260, o.y - 300, o.x - 520, o.y + 420); sg.addColorStop(0, 'rgba(26,35,56,0)'); sg.addColorStop(0.55, 'rgba(26,35,56,0.12)'); sg.addColorStop(1, 'rgba(26,35,56,0.5)');
    lc.fillStyle = sg; lc.fillRect(0, 0, W, H); lc.globalCompositeOperation = 'source-over';
    // dark version: the same shapes sunk into indigo
    const dark = PV.makeCanvas(W, H); dark.ctx.drawImage(lit.canvas, 0, 0); dark.ctx.globalCompositeOperation = 'source-atop'; dark.ctx.fillStyle = 'rgba(8,11,24,0.95)'; dark.ctx.fillRect(0, 0, W, H);
    // cold rim from the upper right (a far light across the river): alpha minus alpha shifted toward the light
    const rim = PV.makeCanvas(W, H), rc = rim.ctx, ang = -0.75, dx = Math.cos(ang) * 5, dy = Math.sin(ang) * 5;
    rc.drawImage(lit.canvas, 0, 0); rc.globalCompositeOperation = 'destination-out'; rc.drawImage(lit.canvas, -dx, -dy);
    rc.globalCompositeOperation = 'source-in'; rc.fillStyle = '#b9cbef'; rc.fillRect(0, 0, W, H);
    // keep the outline of the fingers (and the rolled end of the cast), let it die out along the forearm
    const tp = rig.tips[2], mg = rc.createRadialGradient(tp.x, tp.y, 30, tp.x, tp.y, 420);
    mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(0.45, 'rgba(0,0,0,0.8)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
    rc.globalCompositeOperation = 'destination-in'; rc.fillStyle = mg; rc.fillRect(0, 0, W, H);
    const rimSoft = PV.makeCanvas(W / 2, H / 2); rimSoft.ctx.filter = 'blur(5px)'; rimSoft.ctx.drawImage(rim.canvas, 0, 0, W / 2, H / 2);
    // the drop hangs from the lowest visible fingertip (the one that points down toward the river)
    let tip = rig.tips[1]; for (let i = 1; i <= 4; i++) if (rig.tips[i].y > tip.y) tip = rig.tips[i];
    return (castLayers.v = { lit: lit.canvas, dark: dark.canvas, rim: rim.canvas, rimSoft: rimSoft.canvas, tip: { x: tip.x, y: tip.y } });
  }
  function c01Flash(t) {
    // three single-frame strokes, with a short blue afterglow after the last one
    let f = 0;
    for (const s of C01.strikes) f = Math.max(f, Math.exp(-Math.pow((t - s) / 0.016, 2)));
    const after = t > C01.strikes[0] ? 0.28 * Math.exp(-(t - C01.strikes[2]) * 2.6) * (t > C01.strikes[2] ? 1 : 0.6) : 0;
    const fin = Math.max(0, sm(C01.final, C01.final + 0.1, t));
    return { f: Math.min(1, f), after, fin };
  }
  function stormBackdrop(ctx, t, k, after) {
    ctx.fillStyle = '#070b16'; ctx.fillRect(0, 0, W, H);
    const lv = Math.min(1, k + after);
    if (lv > 0.002) {
      // the storm sky behind, lit from inside by the bolt (upper right): it blazes there and sinks toward the cast,
      // so the lit cast stands out against dark cloud; the bridge's stay cables far out of focus; the deck below
      const sky = PV.cached('g01:c01sky3', W / 2, H / 2, (c) => {
        const g = c.createRadialGradient(800, 60, 6, 770, 110, 1000);
        g.addColorStop(0, '#f6f9ff'); g.addColorStop(0.1, '#d9e4f8'); g.addColorStop(0.3, '#8b9cc4'); g.addColorStop(0.58, '#34415f'); g.addColorStop(0.85, '#1a2338'); g.addColorStop(1, '#111829');
        c.fillStyle = g; c.fillRect(0, 0, W / 2, H / 2);
        const r = PV.rng(9); c.globalCompositeOperation = 'multiply';
        for (let i = 0; i < 30; i++) { const x = r() * W / 2, y = r() * H / 3.2, rr = 40 + r() * 130; const gg = c.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, 'rgba(60,72,108,0.6)'); gg.addColorStop(1, 'rgba(60,72,108,0)'); c.fillStyle = gg; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
        c.globalCompositeOperation = 'screen';
        for (let i = 0; i < 9; i++) { const x = 560 + r() * 380, y = r() * 220, rr = 30 + r() * 80; const gg = c.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, 'rgba(200,214,245,0.35)'); gg.addColorStop(1, 'rgba(200,214,245,0)'); c.fillStyle = gg; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
        c.globalCompositeOperation = 'source-over'; c.strokeStyle = 'rgba(16,22,40,0.5)'; c.lineCap = 'round';
        for (let i = 0; i < 6; i++) { c.lineWidth = 2.6 + i * 0.5; c.beginPath(); c.moveTo(W * 0.52 - i * 34, -10); c.lineTo(W * 0.04 + i * 100, H / 2 + 10); c.stroke(); }
        const dg = c.createLinearGradient(0, H / 2 - 70, 0, H / 2); dg.addColorStop(0, 'rgba(12,16,30,0)'); dg.addColorStop(0.35, 'rgba(12,16,30,0.75)'); dg.addColorStop(1, 'rgba(8,11,22,0.9)');
        c.fillStyle = dg; c.fillRect(0, H / 2 - 70, W / 2, 70);
        c.filter = 'blur(4px)'; c.drawImage(c.canvas, 0, 0); c.filter = 'none';
      });
      ctx.save(); ctx.globalAlpha = lv; ctx.drawImage(sky, 0, 0, W, H); ctx.restore();
      if (k > 0.05) L.lightning(ctx, L.lightningPath(31, 1460, -40, 1640, 720, 0.34, 7), k, '#e9f1ff');
    }
  }
  PV.shot('C01', { draw(ctx, tIn, d) {
    const t = cutT(tIn, d);
    const FL = c01Flash(t), k = Math.max(FL.f, FL.fin), CL = castLayers();
    const zoom = 1 + 0.02 * (t / d);
    stormBackdrop(ctx, t, k, FL.after);
    // rain: invisible in the dark, frozen white streaks in the flash
    L.rain(ctx, t, { seed: 13, count: 420, angle: 0.16, speed: 2600, len: 110, alpha: 0.05 + 0.5 * k + 0.12 * FL.after, color: '#cfe0ff', width: 1.6 });
    ctx.save(); PV.camera(ctx, { zoom, cx: CL.tip.x - 120, cy: CL.tip.y });
    // complete black with only the rain until the first stroke; afterwards the hand sinks into indigo
    const darkA = t < C01.strikes[0] - 0.02 ? 0 : 1;
    if (darkA > 0) ctx.drawImage(CL.dark, 0, 0);
    const litA = clamp(k + FL.after * 0.9);
    if (litA > 0.002) { ctx.save(); ctx.globalAlpha = litA; ctx.drawImage(CL.lit, 0, 0); ctx.restore(); }
    // the cold rim keeps only the outline of the fingers once the light has gone (none before the first stroke)
    const rimK = t < C01.strikes[0] ? 0 : 0.35 + 0.65 * sm(C01.strikes[2], C01.strikes[2] + 0.5, t);
    if (rimK > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = rimK * 0.9; ctx.drawImage(CL.rim, 0, 0); ctx.globalAlpha = rimK * 0.35; ctx.drawImage(CL.rimSoft, 0, 0, W, H); ctx.restore(); }
    // the drop on the fingertip: it swells and trembles, then falls at 2.55 (the first drop)
    const tip = CL.tip, hang = { x: tip.x + 2, y: tip.y + 4 };
    const grow = sm(0.3, 2.2, t), tremble = sm(1.6, 2.5, t), u = t - C01.drop;
    const dr = 9 + 6 * grow, wob = tremble * Math.sin(t * 38) * 1.8;
    let dx = hang.x + wob * 0.4, dy = hang.y + dr * 0.9, stretch = 1 + tremble * 0.12 + 0.08 * Math.sin(t * 38);
    if (u > 0) { dy += 0.5 * 4200 * u * u + 60 * u; stretch = 1.25 + Math.min(0.6, u * 4); }
    const vis = Math.max(rimK * 0.9, litA);
    if (vis > 0.01 && dy < H + 60) {
      ctx.save(); ctx.globalAlpha = vis;
      ctx.fillStyle = 'rgba(150,175,220,0.55)'; ctx.beginPath(); ctx.ellipse(dx, dy, dr * 0.82, dr * stretch * 0.95, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(200,220,255,0.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(dx, dy, dr * 0.82, dr * stretch * 0.95, 0, -0.6, 1.9); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(dx - dr * 0.28, dy - dr * 0.35, dr * 0.24, dr * 0.18, -0.5, 0, TAU); ctx.fill();
      L.glow(ctx, dx, dy, dr * 4, '#cfe0ff', 0.35 * vis, 'screen');
      if (u > 0) { // short motion streak above the falling drop (one frame of travel)
        const len = (4200 * u + 60) / 24, g = ctx.createLinearGradient(dx, dy - dr * stretch, dx, dy - dr * stretch - len);
        g.addColorStop(0, 'rgba(200,220,255,0.55)'); g.addColorStop(1, 'rgba(200,220,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = dr * 0.9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(dx, dy - dr * stretch * 0.6); ctx.lineTo(dx, dy - dr * stretch - len); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    // the lightning wash (kept light: a stronger wash flattens the lit cast against the sky)
    if (k > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(220,232,255,${0.12 * k})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (FL.fin > 0) { ctx.save(); ctx.fillStyle = `rgba(255,255,255,${0.85 * FL.fin})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  } });

  /* ============================================================== C02 */
  // the days go by: each change of the light takes one spectator away (cut-local seconds)
  const C02_DAYS = [0.95, 1.72, 2.48, 3.18];
  const c02Day = (t) => C02_DAYS.reduce((n, s) => n + (t >= s ? 1 : 0), 0);
  const C02_F = { x: 1000, y: 570 };       // push-in centre (on her face)
  const c02Zoom = (t, d) => 1 + 0.075 * PV.ease.inOut(clamp(t / d));
  const c02DayStart = (day) => (day ? C02_DAYS[day - 1] : 0);
  // each day's room is one held plate (clouds and curtains jump from day to day: time-lapse) with that day's light,
  // the pier's shade, the air and the piano baked in; painted at the zoom the push-in has reached when the day begins,
  // so it is only ever enlarged by <=3% afterwards
  function c02Room(day, d) {
    const z0 = c02Zoom(c02DayStart(day), d);
    return { z0, cv: PV.cached('g01:room:c02:' + day, W, H, (c) => {
      paintRoom(c, 'c02', c02DayStart(day) + day * 41.3, z0, C02_F.x, C02_F.y);
      const R = roomR('c02');
      c.save(); PV.camera(c, { zoom: z0, cx: C02_F.x, cy: C02_F.y });
      dayLight(c, 0, R, day, 1, 'c02', 0.95);
      pierShade(c, R, 1.45);
      roomHaze(c, R, 1);
      L.grandPiano(c, pianoOpts(R));
      c.restore();
    }) };
  }
  // the students who came to watch: seen from behind at the lens, turned toward her; they stop coming one by one
  const C02_SP = [
    { id: 0, who: 'boy', outfit: 'uniform', facing: 2.5, s: 148, x: 165, y: 920, ph: 1.2, amb: 0.56 },
    { id: 1, who: 'senpai', outfit: 'blazer', facing: -2.55, s: 138, x: 1335, y: 958, ph: 2.7, amb: 0.6, head: { hair: { style: 'updo', still: true } } },
    { id: 2, who: 'senpai', outfit: 'uniform', facing: 2.6, s: 152, x: 525, y: 972, ph: 4.1, rot: 0.04, amb: 0.56, head: { hair: { style: 'loose', still: true } } },
    { id: 3, who: 'boy', outfit: 'blazer', facing: 2.8, s: 146, x: 845, y: 992, ph: 5.6, amb: 0.6 },
  ];
  // 〈雪あらし〉 at full force: her hair lags behind the surge of her body into the keys (the piano pose's own sway, on twos)
  function c02HairWind(T, I) {
    const tq = A.onTwos(T), sg = (x) => { const ph = x * (1.2 + I * 1.6); return Math.pow(Math.max(0, Math.sin(ph * 0.45 + 1)), 2) * I; };
    const v = (sg(tq + 1 / 12) - sg(tq - 1 / 12)) * 6;
    return { wind: clamp(0.14 + Math.abs(v) * 0.45 + 0.07 * N2(7.7, tq * 3.1), 0, 0.6), windDir: v > 0 ? Math.PI - 0.5 : 0.4 };
  }
  PV.shot('C02', { draw(ctx, tIn, d, S) {
    const t = cutT(tIn, d), T0 = S ? S.start : 3.0;
    const zoom = c02Zoom(t, d), e = PV.ease.inOut(clamp(t / d));
    const day = c02Day(t), tr = day > 0 ? sm(0, 0.2, t - C02_DAYS[day - 1]) : 1;
    // ---- the room: today's plate (dissolving from yesterday's at a day change). All five are built on the first frame
    for (let k = 0; k <= C02_DAYS.length; k++) c02Room(k, d);
    const today = c02Room(day, d), R = roomR('c02');
    if (tr < 1 && day > 0) { const p = c02Room(day - 1, d); blitZ(ctx, p.cv, p.z0, zoom, C02_F.x, C02_F.y); }
    blitZ(ctx, today.cv, today.z0, zoom, C02_F.x, C02_F.y, tr < 1 && day > 0 ? tr : 1);
    // ---- the boy in the shade by the pier, juice at his lips, half-lidded: he is there every day (on twos, half a step out of
    // phase with her). One day he listens with his eyes closed.
    const qb = Math.floor(t * 12 - 0.5 + 1e-6) / 12 + 1 / 24, zb = c02Zoom(qb, d);
    blitZ(ctx, plate('c02boy', qb + ':' + day, (c) => {
      PV.camera(c, { zoom: zb, cx: C02_F.x, cy: C02_F.y });
      const P = figPlace(R, BOY_SEAT, BOY_DIR, 'boy', 0.5), s = P.scale;
      const sip = [1, 0.82, 1, 0.35, 0.58][day] - 0.04 * Math.sin(qb * 2.3 + day);   // the last day: the pack at his chest, his whole face
      drawBoy(c, R, T0 + qb, { amb: 0.6, rimA: 0.45, params: { variant: 'juice', sip }, head: day === 2 ? { expr: 'sleep' } : { expr: 'neutral', eyes: { look: [0.35, 0.1] } } });
      hazeOn(c, R, 0.6);
      return devBox(c, P.x - 3.2 * s, P.y - 5.4 * s, P.x + 3.2 * s, P.y + 2.4 * s);
    }), zb, zoom, C02_F.x, C02_F.y);
    // ---- 先輩 at the piano, 〈雪あらし〉 at full force: the tense, cold face (focus, knitted brows, lips pressed, eyes on the
    // keys, sweat on the forehead), hair swinging with the strokes (on twos; her pose jumps each day)
    const q = q12(t), zq = c02Zoom(q, d);
    blitZ(ctx, plate('c02girl', q + ':' + day, (c) => {
      PV.camera(c, { zoom: zq, cx: C02_F.x, cy: C02_F.y });
      const P = figPlace(R, BENCH, HER_DIR, 'senpai', 0.42), s = P.scale, Tq = T0 + q + day * 3.7;
      const info = drawPianist(c, R, Tq, { intensity: 0.95, rimDir: -1.15, head: { expr: 'focus', turn: -0.22, brows: { furrow: 0.8, inner: -0.5 }, eyes: { open: 0.74, look: [0.3, 0.62] }, mouth: { shape: 'flat', open: 0 }, hair: c02HairWind(Tq, 0.95) } });
      keysOver(c, R, info, s);
      sweat(c, info && info.head, 1, q, 'window');
      return devBox(c, P.x - 3.8 * s, P.y - 5.0 * s, P.x + 4.4 * s, P.y + 2.6 * s);
    }), zq, zoom, C02_F.x, C02_F.y);
    // a time-lapse exposure pulse at each day change
    for (const s of C02_DAYS) { const k = Math.exp(-Math.pow((t - s) / 0.05, 2)); if (k > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(255,242,220,${0.26 * k})`; ctx.fillRect(0, 0, W, H); ctx.restore(); } }
    // ---- the blizzard of notes, blown out of the open piano across the room toward the people watching (right -> left)
    const pp = R.project(pianoL2R([0.9, 1.15, 0.9]));
    const ex = C02_F.x + (pp[0] - C02_F.x) * zoom, ey = C02_F.y + (pp[1] - C02_F.y) * zoom;
    gusts(ctx, t, { n: 8, y0: 110, y1: 880, alpha: 0.34, speed: 1800 });
    hail(ctx, t, { seed: 21, n: 430, nf: 0.12, blue: true, em: { x: ex - 20, y: ey - 40, w: 680, h: 560 }, cx: ex - 80, cy: ey - 60, vx: 1050, vz: 0.62, life: [1.0, 1.7], size: 14, noteK: 1.7, zFocus: 0.9, dof: 5, fall: 46, ambient: 0.45, streak: 0.13, streakA: 1, streakMax: 340, batch: 20 });
    hail(ctx, t, { mode: 'field', seed: 23, n: 14, nf: 0, zr: [0.2, 0.32], vx: 900, size: 10, zFocus: 0.9, dof: 4, fall: 60, streak: 0.05, streakA: 0.45, alpha: 0.75 });  // grains right at the lens
    // ---- foreground: the students (they stop coming one by one) and the curtain in shade
    const sp = C02_SP.map((s, i) => Object.assign({}, s, { a: 1 - sm(C02_DAYS[i] - 0.04, C02_DAYS[i] + 0.32, t) }));
    spectators(ctx, t, sp, 0.25 * e);
    fgCurtain(ctx, t, 1472 + 24 * e);
  } });

  /* ============================================================== C03 */
  // The right hand on the keys, close-up -- the same framing as the cast hand of C01 (match cut).
  // cut-local: mistouches at 0.6 and 1.4 (fingers stuck 4 frames, the hail turns grey and splintered, 2-frame shake)
  // 7.6 s / 8.4 s fall inside frames 182 / 201 -> cut-local frames 14 / 33
  const C03 = { miss: [14 / 24 - 0.004, 33 / 24 - 0.004], stuck: 4 / 24, shake: 2 / 24 };
  // shared with C01 (match cut). Scale kept inside the hand library's range (the fingers lose their modelling above 4);
  // framed so the hand's reflection sits whole in the black fallboard, upper right
  const HANDKEYS = { x: 840, y: 625, scale: 3.85, az: 0.8, el: 0.52, wristY: -22, keyZ: -28, turn: 0.04 };
  function tremolo(u) { // one strike cycle (0..1): down, hold, release, lift
    u = u - Math.floor(u);
    if (u < 0.1) return lerp(-0.22, 1, PV.ease.outQuad(u / 0.1));
    if (u < 0.38) return 1;
    if (u < 0.58) return lerp(1, 0.1, PV.ease.inOut((u - 0.38) / 0.2));
    if (u < 0.86) return lerp(0.1, -0.25, PV.ease.inOut((u - 0.58) / 0.28));
    return lerp(-0.25, -0.22, (u - 0.86) / 0.14);
  }
  function c03Press(t) {
    const rate = 5.6;
    // fingers 1+3 against 2+4 (隣り合う鍵の連打), thumb accents every other beat
    return [
      tremolo(t * rate * 0.5 + 0.35) * 0.9,
      tremolo(t * rate), tremolo(t * rate + 0.5), tremolo(t * rate + 0.08), tremolo(t * rate + 0.56),
    ];
  }
  function c03Stuck(t) { for (const m of C03.miss) if (t >= m && t < m + C03.stuck) return m; return -1; }
  function keyboardLight(ctx, t, rig, k) {
    // window light lying across the white keys: pane-shaped stripes drifting with the curtain
    const P = (x, z) => rig.Pkey({ x, y: -0.3, z });
    const K = L.handKeyGeom, x0 = -K.w / 2 - 22 * K.w, x1 = -K.w / 2 + 23 * K.w;
    const q = [P(x0, 0), P(x1, 0), P(x1, -K.l), P(x0, -K.l)];
    ctx.save(); ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    const drift = -260 + t * 210 + Math.sin(t * 2.3) * 25;
    for (const [c0, w, a] of [[-150, 70, 0.62], [-20, 120, 0.5], [150, 55, 0.58], [330, 90, 0.45]]) {
      const xa = c0 + drift, a0 = P(xa - w, 0), a1 = P(xa + w, 0), b0 = P(xa - w + 60, -K.l), b1 = P(xa + w + 60, -K.l);
      const g = ctx.createLinearGradient(a0.x, a0.y, a1.x, a1.y);
      g.addColorStop(0, 'rgba(255,244,222,0)'); g.addColorStop(0.5, `rgba(255,244,222,${a * k})`); g.addColorStop(1, 'rgba(255,244,222,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(b0.x, b0.y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // The static set, painted once at full resolution: beyond the keyboard her lap in the navy pleated skirt and the
  // floor, far out of focus, window light from the left; the black lacquered fallboard with the keys' pale reflection
  const C03K = { lookAt: { x: 0, y: -22, z: 8 }, range: [-24, 22] };
  function c03Fallboard(Pw) {
    const K = L.handKeyGeom, zf = -K.l - 16, x0 = -K.w / 2, xl = x0 + C03K.range[0] * K.w - 6, xr = x0 + (C03K.range[1] + 1) * K.w + 6;
    const P = (x, y) => Pw({ x, y, z: zf });
    return { zf, q: [P(xl, 2), P(xr, 2), P(xr, -150), P(xl, -150)], band: [P(xl, -1), P(xr, -1), P(xr, -16), P(xl, -16)] };
  }
  const poly = (c, q) => { c.beginPath(); q.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); };
  function c03Set(Pw) {
    return PV.cached('g01:c03set', W, H, (c) => {
      const b = PV.makeCanvas(W / 2, H / 2), bc = b.ctx; bc.scale(0.5, 0.5);
      const g = bc.createLinearGradient(0, 120, 900, 1080);
      g.addColorStop(0, '#efe0c8'); g.addColorStop(0.35, '#b39a86'); g.addColorStop(0.6, '#3e4260'); g.addColorStop(1, '#1d2238');
      bc.fillStyle = g; bc.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) { // pleats of the skirt
        const x = 120 + i * 120, gg = bc.createLinearGradient(x - 60, 0, x + 60, 0);
        gg.addColorStop(0, 'rgba(20,24,44,0)'); gg.addColorStop(0.5, `rgba(${i % 2 ? 70 : 24},${i % 2 ? 78 : 28},${i % 2 ? 120 : 52},0.5)`); gg.addColorStop(1, 'rgba(20,24,44,0)');
        bc.fillStyle = gg; bc.beginPath(); bc.moveTo(x - 40, 640); bc.lineTo(x + 60, 640); bc.lineTo(x + 140 + i * 18, 1080); bc.lineTo(x - 60 + i * 18, 1080); bc.closePath(); bc.fill();
      }
      L.glow(bc, 120, 80, 1200, '#fff3dc', 0.9);
      L.bokeh(bc, 0, { seed: 3, count: 12, rmin: 50, rmax: 130, x0: 0, x1: 760, y0: 0, y1: 480, alpha: 0.22, colors: ['#fff3d9', '#ffe2b8', '#ffffff'] });
      // an opaque base first: the blur would leave the frame edges translucent (and the buffer under them would show)
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.filter = 'blur(4px)'; c.drawImage(b.canvas, 0, 0, W, H); c.filter = 'none';
      const F = c03Fallboard(Pw);
      const fg = c.createLinearGradient(F.q[0].x, F.q[0].y, F.q[3].x, F.q[3].y); fg.addColorStop(0, '#16131a'); fg.addColorStop(0.5, '#0c0b10'); fg.addColorStop(1, '#08080b');
      poly(c, F.q); c.fillStyle = fg; c.fill();
      c.save(); poly(c, F.q); c.clip();
      const g2 = c.createLinearGradient(F.band[0].x, F.band[0].y, F.band[3].x, F.band[3].y); g2.addColorStop(0, 'rgba(240,232,220,0.28)'); g2.addColorStop(1, 'rgba(240,232,220,0)');
      poly(c, F.band); c.fillStyle = g2; c.fill(); c.restore();
    });
  }
  // the hand mirrored in the fallboard: dim, soft, rendered at half resolution (it is blurred anyway)
  function c03Reflection(c, rig, alpha) {
    const F = c03Fallboard(rig.Pkey), lz = C03K.lookAt.z;
    const hb = PV.buffer('g01:c03refl', W / 4, H / 4); hb.ctx.setTransform(1, 0, 0, 1, 0, 0); hb.ctx.clearRect(0, 0, W / 4, H / 4);
    const refl = L.handRig(Object.assign({}, rig.o, { worldMap: (qq) => ({ x: qq.x, y: qq.y, z: 2 * (F.zf - lz) - qq.z }), shadow: false, _m: { a: 0.25, b: 0, c: 0, d: 0.25, e: 0, f: 0 } }));
    L.handRender(hb.ctx, [refl], { alpha: 1, blur: 0.3 * rig.unit });
    c.save(); poly(c, F.q); c.clip(); c.globalAlpha = alpha; c.drawImage(hb.canvas, 0, 0, W, H); c.restore();
  }
  function keySlip(ctx, rig) {
    // the black lacquered rail in front of the keys (catches a line of window light)
    const P = (x, y, z) => rig.Pkey({ x, y, z }), K = L.handKeyGeom, x0 = -K.w / 2 - 22 * K.w, x1 = -K.w / 2 + 23 * K.w;
    const top = [P(x0, 2, 3), P(x1, 2, 3), P(x1, 2, 14), P(x0, 2, 14)], front = [P(x0, 2, 14), P(x1, 2, 14), P(x1, 26, 14), P(x0, 26, 14)];
    const poly = (q, col) => { ctx.fillStyle = col; ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill(); };
    poly(front, '#0d0b10'); poly(top, '#1d1a22');
    ctx.strokeStyle = 'rgba(255,240,215,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(top[3].x, top[3].y); ctx.lineTo(top[2].x, top[2].y); ctx.stroke();
  }
  // the noise of a mistouch: a few torn, grey scan-lines across the frame (2 frames, then gone)
  function tearLines(ctx, t, k) {
    const fr = Math.floor(t * 24);
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i++) {
      const y = R1(i, fr * 5 + 1) * H, x = (R1(i, fr * 5 + 2) - 0.2) * W, l = 220 + R1(i, fr * 5 + 3) * 900, th = 1 + R1(i, fr * 5 + 4) * 3;
      ctx.globalAlpha = k * (0.18 + 0.25 * R1(i, fr * 5 + 5));
      ctx.fillStyle = i % 3 ? '#9a9ca6' : '#2a2c34'; ctx.fillRect(x, y, l, th);
    }
    ctx.restore();
  }
  PV.shot('C03', { draw(ctx, tIn, d) {
    const t = cutT(tIn, d);
    const stuck = c03Stuck(t);
    let press = c03Press(stuck >= 0 ? stuck : t);
    if (stuck >= 0) press = [-0.25, 1, 1, 0.85, -0.3];           // a smeared cluster: three fingers jammed down at once
    const wob = stuck >= 0 ? 0 : Math.sin(t * 5.6 * TAU * 0.5) * 0.03;
    const HO = Object.assign({}, HANDKEYS, { t, press, light: -2.45, sun: { x: -0.6, y: -1, z: 0.4 }, sleeve: '#f4f1ea', sleeveAt: 64, arm: 440, range: C03K.range,
      roll: -0.04 + wob, tremble: stuck >= 0 ? 0.6 : 0, keyColor: '#fff4e0', fillColor: '#d9b2a4', tint: 0.45, shadowAlpha: 0.3, detail: 0.55 });
    // the hand and its shadow first, in their own layer: its rig places the reflection and the pressed keys
    const hb = layer('c03hand'), rig = L.handOnKeys(hb.ctx, Object.assign({}, HO, { drawKeys: false }));
    const b = PV.buffer('g01:c03'), c = b.ctx;
    c.drawImage(c03Set(rig.Pkey), 0, 0);
    c03Reflection(c, rig, 0.22);
    // the keys (the ones under her fingers go down)
    const pressW = {}; [-2, -1, 0, 1, 2].forEach((k, i) => { if (press[i] > 0) pressW[k] = Math.max(pressW[k] || 0, press[i]); });
    L.handKeys(c, { az: HANDKEYS.az, el: HANDKEYS.el, x: HANDKEYS.x, y: HANDKEYS.y, scale: HANDKEYS.scale, lookAt: C03K.lookAt, x0: -L.handKeyGeom.w / 2, kMin: C03K.range[0], kMax: C03K.range[1], pressW, pressB: {} });
    keySlip(c, rig);
    keyboardLight(c, t, rig, 1);
    c.drawImage(hb.canvas, 0, 0);       // the hand's shadow blocks the window light; the hand on top
    // composite with the 2-frame shake at each mistouch
    let sx = 0, sy = 0;
    for (const m of C03.miss) if (t >= m && t < m + C03.shake) { const k = Math.floor((t - m) * 24); sx = (k ? -1 : 1) * 14; sy = (k ? 1 : -1) * 9; }
    ctx.save(); if (sx || sy) { ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(1.03, 1.03); ctx.translate(-W / 2, -H / 2); }   // overscan: no black edges
    ctx.drawImage(b.canvas, 0, 0); ctx.restore();
    // the note hail streams across the hand; at a mistouch it turns grey and splintered, like noise
    let grey = 0, jag = 0;
    for (const m of C03.miss) { const u = t - m; if (u >= 0 && u < 0.5) { grey = Math.max(grey, u < C03.stuck ? 1 : 1 - sm(C03.stuck, 0.45, u)); jag = Math.max(jag, u < C03.stuck ? 1 : 1 - sm(C03.stuck, 0.3, u)); } }
    ctx.save(); ctx.translate(sx * 1.4, sy * 1.4);
    hail(ctx, t, { mode: 'field', seed: 77, n: 140, nf: 0.16, zr: [0.35, 1.5], vx: 1250, size: 18, noteK: 1.5, zFocus: 0.95, dof: 4, fall: 40, streak: 0.07, streakA: 0.85, grey, jag, batch: 15 });
    ctx.restore();
    if (grey > 0) { ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${0.35 * grey})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (sx || sy) tearLines(ctx, t, 1);
  } });

  /* ============================================================== C04 */
  // cut-local timing (absolute − 9.0): final chord 0.6, silence 1.0–1.5, rack focus from 1.3, claps 1.6/2.1/2.6,
  // her start at 2.8 (eyes wide). The chord 9.6 s falls inside frame 230 -> cut-local frame 14 (0.583): the hail stops there.
  // The focus snaps back to her for her start (2.66 -> 2.82): her eyes must read when they open wide.
  const C04 = { chord: 14 / 24 - 0.004, focus0: 1.3, focus1: 1.66, back0: 2.66, back1: 2.82, claps: [1.6, 2.1, 2.6], jump: 2.8, wave: 2300 };
  const C04_F = { x: 960, y: 560 };
  // static camera (the rack focus is the move): every plate is painted at this zoom and blitted 1:1
  const C04_Z0 = 1.01, c04Drift = () => C04_Z0;
  // the boy: drinking -> the straw leaves his mouth when the music stops (sip 1 -> 0, the pack comes down to his knee) -> he lets
  // go of it (it stands on his thigh) -> both hands come up -> three small claps -> the hands sink a little. k blends the
  // library's 'juice' and 'clap' poses (see juiceClapPose)
  const C04_RELEASE = 1.22;
  function c04Boy(t) {
    const sip = 1 - sm(0.66, 1.18, t), hold = t < C04_RELEASE, rise = sm(1.28, 1.52, t), after = sm(2.78, 3.3, t);
    return { sip, hold, k: rise * (1 - 0.3 * after) };
  }
  // the room is one held plate: until the focus pull it sits 9px out of focus (curtain motion would not read there),
  // and from the final chord on the world is meant to stand still with the hail
  const c04RoomT = () => q8(C04.chord);
  // the piano does not move in C04: painted once at the plate zoom
  let C04_PIANO = null;
  function c04Piano(R) {
    if (!C04_PIANO) {
      const b = PV.makeCanvas(W, H), c = b.ctx; c.save(); PV.camera(c, { zoom: C04_Z0, cx: C04_F.x, cy: C04_F.y });
      const pr = L.grandPiano(c, pianoOpts(R));
      const bb = pr && pr.bbox ? devBox(c, pr.bbox[0] - 80, pr.bbox[1] - 80, pr.bbox[2] + 80, pr.bbox[3] + 140) : [0, 0, W, H]; c.restore();
      C04_PIANO = { cv: b.canvas, box: [Math.max(0, Math.floor(bb[0])), Math.max(0, Math.floor(bb[1])), Math.min(W, Math.ceil(bb[2])), Math.min(H, Math.ceil(bb[3]))] };
    }
    return C04_PIANO;
  }
  // where the pack stands on his thigh: his right hand at the moment he lets go of it (probe drawn once, off screen)
  let C04_PACK = null;
  function c04Pack(R, T0) {
    if (!C04_PACK) {
      const b = PV.buffer('g01:probe2', 64, 64);
      const info = drawBoy(b.ctx, R, T0 + C04_RELEASE, { pose: G01_CLAP, params: { k: 0, sip: 0, hold: true } });
      const P = figPlace(R, BOY_SEAT, BOY_DIR, 'boy', 0.5);
      C04_PACK = { x: info.hands.R[0] - P.scale * 0.16, y: info.hands.R[1] + P.scale * 0.04, h: P.scale * 0.34 };
    }
    return C04_PACK;
  }
  PV.shot('C04', { draw(ctx, tIn, d, S) {
    if (S) S.post = Object.assign({}, S.post, { bloom: 0.22 });     // a bright 3/4 face against the window: keep the thin eye lines
    const t = cutT(tIn, d), T0 = S ? S.start : 9.0;
    const blurAt = (x) => { const a = PV.ease.inOutCubic(sm(C04.focus0, C04.focus1, x)), b = PV.ease.inOutCubic(sm(C04.back0, C04.back1, x)); return { far: lerp(9, 0, a) + 6 * b, near: 12 * a * (1 - b) }; };
    const bF = blurAt(t), bFar = bF.far, bNear = bF.near;   // rack focus: her -> the boy -> her
    const drift = c04Drift(t), q = q12(t), dq = C04_Z0;
    // ---------- far layer: the room (light, the pier's shade and the air baked in), the boy, the far hail. A layer that is in
    // focus is painted straight into the frame (no full-frame copy); only a blurred one goes through its own buffer
    const farBuf = bFar >= 0.4, far = farBuf ? PV.buffer('g01:c04far') : null, fc = farBuf ? far.ctx : ctx;   // the room plate is opaque: no clear needed
    const rt = c04RoomT(t);
    blitZ(fc, plate('c04room', rt, (c) => {
      paintRoom(c, 'c04', rt + 165.2, C04_Z0, C04_F.x, C04_F.y);
      const RR = roomR('c04');
      c.save(); PV.camera(c, { zoom: C04_Z0, cx: C04_F.x, cy: C04_F.y });
      dayLight(c, 0, RR, 4, 1, 'c04', 0.95); pierShade(c, RR, 1.6); roomHaze(c, RR, 0.8);   // the curtain right behind him is close and bright: shade it harder
      c.restore();
    }), C04_Z0, drift, C04_F.x, C04_F.y);
    const R = roomR('c04');
    const pack = c04Pack(R, T0);
    // the boy, on twos (half a step out of phase with her, so that the two figures are never redrawn on the same frame):
    // sipping -> the pack on his thigh -> three small claps; his face opens up (素直な顔) as he claps
    const qb = Math.floor(t * 12 - 0.5 + 1e-6) / 12 + 1 / 24;
    const P = plate('c04boy', qb, (c) => {
      PV.camera(c, { zoom: dq, cx: C04_F.x, cy: C04_F.y });
      const q = qb, B = c04Boy(q), Pp = figPlace(R, BOY_SEAT, BOY_DIR, 'boy', 0.5), s = Pp.scale;
      const open = sm(1.3, 1.6, q);
      const head = open > 0.5 ? { expr: 'gentle', eyes: { open: 0.95, look: [0.45, 0.05] }, blush: 0.12 } : { expr: 'neutral', eyes: { look: [0.45, 0.05] } };
      // no rim while he is far out of focus (it cannot be seen there; it is the costly part of a backlit figure)
      const info = drawBoy(c, R, T0 + q, { pose: G01_CLAP, amb: 0.5, rimA: blurAt(q).far > 4 ? 0 : 0.55, params: { k: B.k, sip: B.sip, hold: B.hold, claps: C04.claps.map(x => T0 + x) }, head });
      if (!B.hold) juicePack(c, pack.x, pack.y, pack.h, 'window', 0.04);
      hazeOn(c, R, 0.6);
      const m = c.getTransform(), hx = (info.hands.L[0] + info.hands.R[0]) / 2, hy = (info.hands.L[1] + info.hands.R[1]) / 2;
      STAMP.c04hands = { x: m.a * hx + m.c * hy + m.e, y: m.b * hx + m.d * hy + m.f };
      return devBox(c, Pp.x - 3.2 * s, Pp.y - 5.6 * s, Pp.x + 3.2 * s, Pp.y + 2.4 * s);
    });
    blitZ(fc, P, dq, drift, C04_F.x, C04_F.y);
    // where his hands are on screen (the plate was painted at zoom dq; it is shown at zoom `drift`)
    const hq = STAMP.c04hands, kz = drift / dq;
    const hands = { x: C04_F.x + (hq.x - C04_F.x) * kz, y: C04_F.y + (hq.y - C04_F.y) * kz };
    const unravel = (p, x, y) => { const k = Math.min(2, Math.floor(p.tw * 3)), tc = C04.claps[k] + Math.hypot(x - hands.x, y - hands.y) / C04.wave; return sm(tc, tc + 0.12, t); };
    const moteAge = (p, x, y) => { const k = Math.min(2, Math.floor(p.tw * 3)); return Math.max(0, t - C04.claps[k] - Math.hypot(x - hands.x, y - hands.y) / C04.wave); };
    const HAIL_FAR = { glint: 0.9, mode: 'field', seed: 44, n: 260, zr: [1.0, 1.9], vx: 820, size: 26, zFocus: 1.4, dof: 1.5, fall: 25, streak: 0.06, streakA: 0.8, freezeAt: C04.chord, unravel, moteAge, batch: 22 };
    const HAIL_MID = { glint: 0.9, mode: 'field', seed: 45, n: 34, zr: [0.62, 0.85], vx: 820, size: 18, zFocus: 0.72, dof: 1.5, fall: 25, streak: 0.06, streakA: 0.75, freezeAt: C04.chord, unravel, moteAge };
    const HAIL_BEHIND = { glint: 0.9, mode: 'field', seed: 47, n: 110, zr: [0.8, 1.05], vx: 820, size: 21, zFocus: 0.9, dof: 1.5, fall: 25, streak: 0.06, streakA: 0.8, freezeAt: C04.chord, unravel, moteAge };
    const HAIL_LENS = { mode: 'field', seed: 46, n: 22, zr: [0.22, 0.4], vx: 820, size: 14, zFocus: 0.9, dof: 3, fall: 25, streak: 0.05, streakA: 0.5, freezeAt: C04.chord, unravel, moteAge, moteSize: 0.7 };
    hail(fc, t, HAIL_FAR);
    if (farBuf) blurBlit(ctx, far.canvas, bFar);
    // ---------- near layer: the piano and her (straight into the frame while she is in focus)
    const nearBuf = bNear >= 0.4, near = nearBuf ? layer('c04near') : null, nc = nearBuf ? near.ctx : ctx;
    blitZ(nc, c04Piano(R), C04_Z0, drift, C04_F.x, C04_F.y);
    hail(nc, t, HAIL_BEHIND);            // the hail around the piano, just behind her
    // she plays the last passage cleanly, the final chord at 0.6 (her hands stay on the keys), then breathes with her shoulders,
    // head bowed, lips parted; 2.8 a small start: the head comes up, the eyes open wide (surprise, weakened)
    const playing = (x) => 1 - sm(C04.chord - 0.06, C04.chord + 0.02, x);
    const breath = sm(C04.chord, C04.chord + 0.25, q) * (0.55 + 0.45 * Math.exp(-(q - C04.chord) * 0.5));
    const st = q >= C04.jump - 0.01 ? 1 : 0;      // はっと: the first drawing after 11.8 s (frame 284) already has the eyes wide
    const girl = plate('c04girl', q, (c) => {
      PV.camera(c, { zoom: dq, cx: C04_F.x, cy: C04_F.y });
      const Pg = figPlace(R, BENCH, HER_DIR, 'senpai', 0.42), s = Pg.scale, pl = playing(q);
      const pant = breath * (0.5 + 0.5 * Math.sin(q * TAU / 0.9));
      // after the start the wide eyes soften and begin to well (C05 opens on her teary face)
      const soft = sm(3.1, 3.42, q);
      const head = st > 0.5
        ? { expr: 'surprise', eyes: { open: 1.12 - 0.1 * soft, wide: 0.12 * (1 - soft), look: [0.3, -0.18 + 0.06 * soft], tears: 0.3 * soft }, brows: { inner: 0.45 + 0.2 * soft, outer: 0.25 - 0.3 * soft, furrow: 0 }, mouth: { shape: 'o', open: 0.16 - 0.08 * soft }, blush: 0.1 + 0.12 * soft, turn: -0.06 }
        : pl > 0.5
          ? { expr: 'focus', eyes: { open: 0.78, look: [0.3, 0.6] }, brows: { furrow: 0.35, inner: -0.25 }, mouth: { shape: 'flat', open: 0 }, turn: -0.12 }
          : { expr: 'neutral', eyes: { open: 0.48, look: [0.25, 0.7] }, brows: { inner: 0.25, outer: -0.05, furrow: 0.1 }, mouth: { shape: 'a', open: 0.14 + 0.12 * pant }, turn: -0.12 };
      head.hair = { wind: 0.06 + 0.25 * pl + 0.22 * st * (1 - sm(C04.jump + 0.05, C04.jump + 0.5, q)), windDir: Math.PI - 0.6 };
      const soft4 = blurAt(q).near > 4;          // far out of focus (the boy's part): no rims
      if (soft4) head.rim = 0;
      const info = drawPianist(c, R, T0 + q, { intensity: 0.55 * pl, play: pl, breathe: breath, look: st > 0.5 ? 'ahead' : 'keys', lean: 0.1 * breath * (1 - st), rimDir: -1.2, rimA: soft4 ? 0 : 0.4, head });
      keysOver(c, R, info, s);
      sweat(c, info && info.head, 1, q, 'window');
      return devBox(c, Pg.x - 3.6 * s, Pg.y - 5.0 * s, Pg.x + 4.4 * s, Pg.y + 2.6 * s);
    });
    // the start (on twos, with her drawings): up at once, then settles with a small overshoot (applied to her plate about the bench)
    const jd = Math.round((q - C04.jump) * 12 + 0.5), jump = jd < 1 ? 0 : [0, 1, 0.5, 0.14, -0.07, 0][Math.min(5, jd)];
    const bp0 = R.project(BENCH), bpx = C04_F.x + (bp0[0] - C04_F.x) * drift, bpy = C04_F.y + (bp0[1] - C04_F.y) * drift, kz2 = drift / dq;
    nc.save(); nc.translate(bpx, bpy); nc.scale(1, 1 + 0.012 * jump); nc.translate(0, -18 * jump); nc.translate(-bpx, -bpy);
    nc.translate(C04_F.x, C04_F.y); nc.scale(kz2, kz2); nc.translate(-C04_F.x, -C04_F.y);
    { const gb = girl.box, gw = gb[2] - gb[0], gh = gb[3] - gb[1]; if (gw > 0 && gh > 0) nc.drawImage(girl.cv, gb[0], gb[1], gw, gh, gb[0], gb[1], gw, gh); }
    nc.restore();
    hail(nc, t, HAIL_MID);
    if (nearBuf) blurBlit(ctx, near.canvas, bNear);
    hail(ctx, t, HAIL_LENS);              // grains right in front of the lens: always out of focus
    // the final chord rings: a soft bloom that dies when the pedal is released (1.0)
    const ring = Math.exp(-Math.max(0, t - C04.chord) * 3.2) * sm(C04.chord - 0.02, C04.chord + 0.02, t);
    if (ring > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(232,242,255,${0.16 * ring})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    // each clap: a faint ring of warm light from his hands, and the room grows warmer
    let warm = 0;
    C04.claps.forEach((tc, i) => {
      const u = t - tc; if (u < 0) return; warm += sm(0, 0.5, u) / 3;
      const r = u * C04.wave, a = Math.exp(-u * 3.5);
      if (a > 0.12) {
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        const g = ctx.createRadialGradient(hands.x, hands.y, Math.max(0, r - 120), hands.x, hands.y, r + 40);
        g.addColorStop(0, 'rgba(255,226,170,0)'); g.addColorStop(0.75, `rgba(255,226,170,${0.13 * a})`); g.addColorStop(1, 'rgba(255,226,170,0)');
        const x0 = Math.max(0, hands.x - r - 40), y0 = Math.max(0, hands.y - r - 40), x1 = Math.min(W, hands.x + r + 40), y1 = Math.min(H, hands.y + r + 40);
        ctx.fillStyle = g; if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        L.glow(ctx, hands.x, hands.y, 90 + 40 * i, '#ffe6c0', 0.55 * Math.exp(-u * 6), 'screen');
        ctx.restore();
      }
    });
    if (warm > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(255,232,206,${0.55 * warm})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(255,200,140,${0.09 * warm})`; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  } });

})();

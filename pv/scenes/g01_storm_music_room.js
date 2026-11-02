/* g01_storm_music_room — 『キミの右手のアイロニー』本予告  C01〜C04
 *   C01 (0.0–3.0)  嵐の夜：ギプスから覗く右手、3コマの雷光、指先の雨粒が落ちる
 *   C02 (3.0–7.0)  四月の音楽室：〈雪あらし〉の霰、見物人が日ごとに消え、陰の席の少年だけが残る
 *   C03 (7.0–9.0)  鍵盤の右手のアップ（C01と同じ画角）、ミスタッチ 7.6／8.4
 *   C04 (9.0–12.5) その日：澄んだ終止→霰が静止→ジュースを置く→ピント送り→三つの拍手で霰が光の粒に
 * Deterministic: every frame is a pure function of t. Buffers repainted "on twos / threes" are keyed by the
 * quantised time they show (plate()), so frames rendered in any order give the same pixels.
 */
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, TAU = Math.PI * 2;
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
    // quarter resolution as soon as the blur hides it; plain bilinear upscale ('high' costs ~12ms in software)
    const q = px > 2.5 ? 0.25 : 0.5, w = Math.round(W * q), h = Math.round(H * q);
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
  const PIANO = { x: 6.75, z: 2.75, yaw: Math.PI / 2 - 0.3 };
  const benchW = (p) => [p.x - 1.46 * Math.cos(p.yaw), 0.5, p.z + 1.46 * Math.sin(p.yaw)];
  const ppmAt = (R, w) => Math.abs(R.project([w[0], w[1], w[2]])[1] - R.project([w[0], w[1] + 1, w[2]])[1]);
  const BOY_SEAT = [4.25, 0.45, 0.85];      // in front of the first pier (窓間壁), where the sun does not reach (原作311)
  const ROOM = {
    c02: { view: 'windows', time: 'noon', furniture: 'none', wind: 0.6, cam: { eye: [5.75, 1.5, 8.3], target: [6.2, 1.12, 0], fov: 58 }, shaft: 0.55, dust: false },
    c04: { view: 'windows', time: 'noon', furniture: 'none', wind: 0.5, cam: { eye: [5.45, 1.3, 6.1], target: [5.84, 1.02, 2.12], fov: 60 }, shaft: 0.5, dust: false },
  };
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

  // foreground spectators (out of focus head-and-shoulder silhouettes, backlit). Each is cached once, pre-blurred.
  function spectator(c, kind) {
    c.beginPath(); c.ellipse(0, 0, 1.0, 1.15, 0, 0, TAU); c.fill();
    if (kind === 0) { c.beginPath(); c.ellipse(0, 0.3, 1.34, 1.32, 0, 0, TAU); c.fill(); c.fillRect(-1.34, 0.3, 2.68, 1.1); }   // bob cut
    if (kind === 1) { c.beginPath(); c.ellipse(0.15, -0.45, 1.16, 0.95, 0.3, 0, TAU); c.fill(); }                                // short messy (boy)
    if (kind === 2) { c.beginPath(); c.ellipse(-1.05, 0.6, 0.42, 1.25, 0.45, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0, -0.2, 1.12, 1.1, 0, 0, TAU); c.fill(); } // ponytail
    if (kind === 3) { c.beginPath(); c.ellipse(0, -0.35, 1.12, 0.95, 0, 0, TAU); c.fill(); }
    c.fillRect(-0.42, 0.8, 0.84, 1.0);   // neck
    c.beginPath(); c.moveTo(-3.7, 5.5); c.bezierCurveTo(-3.5, 2.5, -1.7, 1.85, 0, 1.75); c.bezierCurveTo(1.7, 1.85, 3.5, 2.5, 3.7, 5.5); c.lineTo(3.7, 9); c.lineTo(-3.7, 9); c.closePath(); c.fill();
  }
  function spectatorSprite(kind, col, blur) {
    const S = 40, w = Math.round(9 * S), h = Math.round(12 * S);
    return PV.cached('g01:spec:' + kind + col + blur, w, h, (c) => {
      const b = PV.makeCanvas(w, h), cc = b.ctx;
      cc.translate(w / 2, 1.8 * S); cc.scale(S, S); cc.fillStyle = col; spectator(cc, kind);
      cc.globalCompositeOperation = 'source-atop';           // warm window rim across the top of the head and shoulders
      const g = cc.createLinearGradient(0, -1.3, 0, 2.6); g.addColorStop(0, 'rgba(255,228,186,0.62)'); g.addColorStop(0.25, 'rgba(255,228,186,0.14)'); g.addColorStop(0.5, 'rgba(255,228,186,0)');
      cc.fillStyle = g; cc.fillRect(-5, -3, 10, 13);
      c.filter = 'blur(' + blur + 'px)'; c.drawImage(b.canvas, 0, 0);
    });
  }
  function spectators(ctx, t, list, push) {
    for (const s of list) {
      if (s.a <= 0.01) continue;
      const spr = spectatorSprite(s.kind, s.col, 11), k = s.s / 40 * (1 + push);
      const bob = Math.sin(t * 0.9 + s.ph) * 4 + N2(s.ph, t * 0.5) * 3;
      ctx.save(); ctx.globalAlpha = s.a;
      ctx.translate(s.x + (s.x - 960) * push, s.y + bob + (s.y - 540) * push * 0.6); ctx.rotate(s.rot || 0); ctx.scale(k, k);
      ctx.drawImage(spr, -spr.width / 2, -1.8 * 40); ctx.restore();
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

  /* ====================================================== the pianist */
  // girlAtPianoBack is one flat silhouette, so her white blouse would read as black as her hair. She is drawn in
  // two passes: the figure with a blouse-white fill (shaded toward the waist; skirt, bench and legs sunk to navy),
  // then her long black hair on top with hairLong -- the same locks, at the head position girlAtPianoBack computes
  // (mirrored below from figures.js). A hash guard falls back to the plain silhouette if the library changes.
  const GIRL_SIG = 2736191307, GIRL_SP = { torso: 2.18, neck: 0.7 };
  let girlSigOK = null;
  function girlHair(t, o) {
    const tq = Math.floor(t * 12 + 1e-6) / 12;
    const I = o.intensity === undefined ? 0.3 : o.intensity, seed = o.seed || 21, turn = o.turn === undefined ? 0.35 : o.turn;
    const ph = tq * (1.4 + I * 1.8);
    const swayX = I * (0.2 * Math.sin(ph * 0.7) + 0.08 * N2(seed, tq * 1.3)) + 0.015 * Math.sin(tq * 0.8);
    const surge = Math.pow(Math.max(0, Math.sin(ph * 0.45 + 1)), 2);
    const fwd = 0.08 + I * (0.12 + 0.2 * surge), lean = swayX * 0.38;
    const P = [swayX * 0.4, -0.24], up = [Math.sin(lean), -Math.cos(lean)], tl = GIRL_SP.torso * (1 - fwd * 1.6 * 0.08);
    const N = [P[0] + up[0] * tl, P[1] + up[1] * tl];
    const ht = lean * 0.6 + I * 0.12 * Math.sin(ph * 0.9) + turn * 0.08 + lean * 0.5;
    const head = [N[0] + Math.sin(ht) * GIRL_SP.neck + 0.07 * turn, N[1] - Math.cos(ht) * GIRL_SP.neck + fwd * 0.6];
    const swing = -lean * 1.8 - I * 0.24 * Math.cos(ph * 0.7);
    return { head, hair: { view: 'back', len: o.hairLen || 2.5, wind: (o.wind || 0.05) + I * 0.12 * surge, windDir: o.windDir === undefined ? (swing > 0 ? Math.PI : 0) : o.windDir, seed: seed + 3, tilt: ht * 0.7, swing, spread: 0.1 } };
  }
  function pianoGirl(ctx, t, o) {
    if (girlSigOK === null) {
      girlSigOK = PV.hash(L.girlAtPianoBack.toString()) === GIRL_SIG && typeof L.hairLong === 'function';
      if (!girlSigOK) console.warn('g01: girlAtPianoBack changed; the pianist falls back to a plain silhouette');
    }
    const u = 92 * o.scale, box = devBox(ctx, o.x - 2.9 * u, o.y - 5.3 * u, o.x + 3.4 * u, o.y + 2.6 * u);
    if (!girlSigOK) { L.girlAtPianoBack(ctx, t, o); return box; }
    const m = ctx.getTransform();
    // device-space box around the figure (bench to the crown, the reaching arm), for a cheap clear / blit
    const pts = [[o.x - 2.9 * u, o.y - 5.3 * u], [o.x + 3.4 * u, o.y + 2.6 * u]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    const bx = Math.max(0, Math.floor(Math.min(pts[0][0], pts[1][0]))), by = Math.max(0, Math.floor(Math.min(pts[0][1], pts[1][1])));
    const bw = Math.min(W, Math.ceil(Math.max(pts[0][0], pts[1][0]))) - bx, bh = Math.min(H, Math.ceil(Math.max(pts[0][1], pts[1][1]))) - by;
    if (bw < 2 || bh < 2) return box;
    const b = PV.buffer('g01:girlbody'), c = b.ctx; c.clearRect(0, 0, W, H);
    c.setTransform(m);
    L.girlAtPianoBack(c, t, Object.assign({}, o, { fill: o.blouse || '#e2d8d6' }));
    c.globalCompositeOperation = 'source-atop';
    const y0 = o.y - 4.8 * u, y1 = o.y + 2.4 * u, f = (y) => clamp((y - y0) / (y1 - y0)), yw = o.y - 0.96 * u;
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(90,72,84,0)'); g.addColorStop(f(o.y - 2.8 * u), 'rgba(90,72,88,0.2)'); g.addColorStop(f(yw - 0.14 * u), 'rgba(70,60,84,0.46)');
    g.addColorStop(f(yw + 0.1 * u), 'rgba(24,28,48,0.93)'); g.addColorStop(f(o.y + 0.3 * u), 'rgba(16,19,32,0.95)'); g.addColorStop(1, 'rgba(10,12,20,0.97)');
    c.fillStyle = g; c.fillRect(o.x - 4 * u, y0, 8 * u, y1 - y0);
    c.globalCompositeOperation = 'source-over'; c.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(b.canvas, bx, by, bw, bh, bx, by, bw, bh); ctx.restore();
    const hp = girlHair(t, o);
    L.hairLong(ctx, t, Object.assign({}, hp.hair, { x: o.x + hp.head[0] * u, y: o.y + hp.head[1] * u, scale: o.scale, style: 'silhouette',
      light: o.light, rimColor: o.rimColor, rim: o.rim, backlight: o.backlight, glow: o.glow, fps: o.fps }));
    return box;
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

  /* ============================================== the clapping boy (side view) */
  // boySeated has only 'juice' / 'guitar' poses: this is the same boy (same proportions, hair and silhouette
  // pipeline via L.figureRender) who can take the juice from his mouth, set it on his thigh and clap.
  const BOY = { torso: 2.42, neck: 0.74, head: 1.06, upArm: 1.3, foreArm: 1.12, hand: 0.82, armR: 0.155, thigh: 1.95, shin: 1.88, legR: 0.3, waistH: 0.8 };
  const S_UPARM = [[0, 0.155, 0.155], [0.2, 0.15, 0.128], [0.5, 0.122, 0.112], [1, 0.09, 0.088]];
  const S_FOREARM = [[0, 0.09, 0.088], [0.25, 0.1, 0.094], [0.82, 0.074, 0.07], [0.85, 0.058, 0.056], [1, 0.055, 0.054]];
  const S_TTHIGH = [[0, 0.38, 0.38], [0.5, 0.31, 0.29], [1, 0.242, 0.236]];
  const S_TSHIN = [[0, 0.242, 0.236], [0.6, 0.226, 0.222], [1, 0.222, 0.22]];
  const v2 = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], mix: (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k] };
  function spline(c, pts, closed) {
    const n = pts.length; if (n < 2) return;
    const P = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    c.moveTo(pts[0][0], pts[0][1]);
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), s1 = p1[2] ? 0 : 1 / 6, s2 = p2[2] ? 0 : 1 / 6;
      c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * s1, p1[1] + (p2[1] - p0[1]) * s1, p2[0] - (p3[0] - p1[0]) * s2, p2[1] - (p3[1] - p1[1]) * s2, p2[0], p2[1]);
    }
    if (closed) c.closePath();
  }
  const blob = (c, pts) => { c.beginPath(); spline(c, pts, true); c.fill(); };
  function smoothPoly(c, P, move) {
    const n = P.length; if (move) c.moveTo(P[0][0], P[0][1]); else c.lineTo(P[0][0], P[0][1]);
    for (let i = 1; i < n - 1; i++) c.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
    c.lineTo(P[n - 1][0], P[n - 1][1]);
  }
  function limb(c, p0, p1, prof, n = 14) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1e-6, ux = dx / l, uy = dy / l, ax = uy, ay = -ux;
    const at = (f) => { for (let i = 0; i < prof.length - 1; i++) if (f <= prof[i + 1][0]) { const a = prof[i], b = prof[i + 1]; const k = clamp((f - a[0]) / ((b[0] - a[0]) || 1)); const e = k * k * (3 - 2 * k); return [lerp(a[1], b[1], e), lerp(a[2], b[2], e)]; } const z = prof[prof.length - 1]; return [z[1], z[2]]; };
    const A = [], B = [];
    for (let i = 0; i <= n; i++) { const f = i / n, w = at(f), px = p0[0] + dx * f, py = p0[1] + dy * f; A.push([px + ax * w[0], py + ay * w[0]]); B.push([px - ax * w[1], py - ay * w[1]]); }
    const ang = Math.atan2(uy, ux), w0 = at(0), w1 = at(1), r1 = (w1[0] + w1[1]) / 2, o1 = (w1[0] - w1[1]) / 2, r0 = (w0[0] + w0[1]) / 2, o0 = (w0[0] - w0[1]) / 2;
    c.beginPath(); smoothPoly(c, A, true);
    c.arc(p1[0] + ax * o1, p1[1] + ay * o1, Math.max(1e-4, r1), ang - Math.PI / 2, ang + Math.PI / 2, false);
    smoothPoly(c, B.reverse(), false);
    c.arc(p0[0] + ax * o0, p0[1] + ay * o0, Math.max(1e-4, r0), ang + Math.PI / 2, ang + 1.5 * Math.PI, false);
    c.closePath(); c.fill();
  }
  const scaleP = (P, k) => P.map(([f, a, b]) => [f, a * k, b * k]);
  const dirDeg = (p, deg, len) => [p[0] + Math.sin(deg * Math.PI / 180) * len, p[1] + Math.cos(deg * Math.PI / 180) * len];
  function local(c, p, a, k, fn) { c.save(); c.translate(p[0], p[1]); c.rotate(a); c.scale(k, k); fn(c); c.restore(); }
  function ik(a, cpt, l1, l2, bend) {
    const d = [cpt[0] - a[0], cpt[1] - a[1]]; let D = Math.hypot(d[0], d[1]); D = clamp(D, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
    const base = Math.atan2(d[1], d[0]), cosA = (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D), ang = base + bend * Math.acos(clamp(cosA, -1, 1));
    return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1];
  }
  function boyRig(lean, headTilt) {
    const P = [-0.3, -0.3], up = [Math.sin(lean), -Math.cos(lean)];
    const F = (x, h) => [P[0] - up[1] * x + up[0] * h, P[1] + up[0] * x + up[1] * h];
    const N = F(0, BOY.torso), S = F(-0.04, BOY.torso - 0.27), nl = lean + 0.14;
    const nt = [N[0] + Math.sin(nl) * BOY.neck * 0.42, N[1] - Math.cos(nl) * BOY.neck * 0.42];
    const ht = lean * 0.5 + headTilt;
    const head = [nt[0] + Math.sin(ht) * BOY.neck * 0.5 + Math.cos(ht) * 0.03, nt[1] - Math.cos(ht) * BOY.neck * 0.5 + Math.sin(ht) * 0.03];
    return { P, up, F, N, S, nt, ht, head, Lt: BOY.torso };
  }
  // a point given in head units of the profile (x forward, y down) -> rig units
  const headPt = (R, p) => { const c = Math.cos(R.ht), s = Math.sin(R.ht), k = BOY.head; return [R.head[0] + (p[0] * c - p[1] * s) * k, R.head[1] + (p[0] * s + p[1] * c) * k]; };
  function boyHead(c, t, R) {
    c.save(); c.translate(R.head[0], R.head[1]); c.rotate(R.ht); c.scale(BOY.head, BOY.head);
    // profile (no lips: the face is never acted)
    blob(c, [[-0.04, -0.54], [0.22, -0.49], [0.37, -0.32], [0.41, -0.1], [0.405, -0.02], [0.475, 0.13, 1], [0.41, 0.19], [0.405, 0.27], [0.375, 0.34], [0.37, 0.42], [0.3, 0.47], [0.1, 0.45], [-0.06, 0.33], [-0.3, 0.2], [-0.45, -0.05], [-0.4, -0.33]]);
    // slightly long, messy hair: bangs over the eyes, tufts at the nape
    const tl = R.ht, G = { 0: 0.45, 1: 0.45, 2: 0.5, 3: 0.75, 4: 0.75, 5: 0.7 };
    const tf = (i, x, y) => { const n = N2(3 + i * 1.7, t * 1.4), g = (G[i] || 0) * tl, cg = Math.cos(-g), sg = Math.sin(-g), bx = x * 0.72, by = y * 0.72, dx = x - bx, dy = y - by; return [bx + dx * cg - dy * sg - 0.01 * n, by + dx * sg + dy * cg + 0.006 * n, 1]; };
    blob(c, [[0.16, -0.62], [0.34, -0.53], [0.45, -0.38], [0.475, -0.22], tf(0, 0.475, -0.01), [0.43, -0.1], tf(1, 0.44, 0.05), [0.39, -0.04],
      [0.28, -0.12], [0.17, -0.09], tf(2, 0.1, 0.19), [0.03, 0.06], [-0.1, 0.1], [-0.15, 0.25], tf(3, -0.17, 0.47), [-0.25, 0.36],
      tf(4, -0.33, 0.49), [-0.4, 0.33], tf(5, -0.5, 0.42), [-0.56, 0.17], [-0.62, -0.05], [-0.635, -0.26], [-0.6, -0.45],
      tf(7, -0.5, -0.66), [-0.38, -0.66], [-0.18, -0.695], [0.02, -0.68]]);
    c.restore();
  }
  function boyTorso(c, R) {
    const F = R.F, Lt = R.Lt;
    blob(c, [F(-0.17, Lt + 0.16), F(-0.25, Lt - 0.05), F(-0.42, 1.78), F(-0.4, 1.25), F(-0.31, 0.82), F(-0.36, 0.36), F(-0.43, 0.02), F(-0.34, -0.32),
      F(0.2, -0.32), F(0.32, 0.08), F(0.33, 0.52), F(0.32, 0.88), F(0.37, 1.32), F(0.41, 1.62), F(0.35, 1.98), F(0.19, Lt - 0.04), F(0.16, Lt + 0.16)]);
    blob(c, [F(-0.44, -0.12, 1), F(-0.4, 0.85), F(-0.42, 1.7), F(0.0, Lt), F(0.4, 1.6), F(0.38, 0.85), F(0.4, -0.1, 1), F(0, -0.16)]);  // loose shirt
    const N = R.N, nt = R.nt; c.beginPath(); c.moveTo(N[0] - 0.2, N[1]); c.lineTo(nt[0] - 0.18, nt[1]); c.lineTo(nt[0] + 0.2, nt[1]); c.lineTo(N[0] + 0.22, N[1]); c.closePath(); c.fill();
  }
  function shoeSide(c) { blob(c, [[-0.12, -0.06], [-0.2, 0.08], [-0.2, 0.27, 1], [0.1, 0.29], [0.7, 0.29], [0.86, 0.24], [0.83, 0.12], [0.58, 0.04], [0.3, -0.02], [0.08, -0.08]]); }
  function schoolChair(c) {
    c.beginPath(); c.roundRect(-0.85, -0.02, 1.72, 0.12, 0.04); c.fill();
    const leg = (a, b) => limb(c, a, b, [[0, 0.045, 0.045], [1, 0.04, 0.04]], 3);
    leg([-0.78, 0.08], [-0.82, 2.0]); leg([0.76, 0.08], [0.8, 2.0]); leg([-0.82, 0.1], [-0.92, -1.75]);
    c.beginPath(); c.roundRect(-1.0, -1.72, 0.2, 0.62, 0.05); c.fill(); leg([-0.8, 1.55], [0.8, 1.55]);
  }
  // an open hand seen from the thumb side (fingers together, slightly cupped: the clapping hand)
  function handClap(c) {
    blob(c, [[0, -0.1], [0.18, -0.13], [0.36, -0.12], [0.55, -0.1], [0.7, -0.07], [0.78, -0.02], [0.77, 0.03], [0.62, 0.07], [0.42, 0.1], [0.2, 0.11], [0, 0.09]]);
    limb(c, [0.06, -0.06], [0.3, -0.16], [[0, 0.06, 0.06], [1, 0.042, 0.042]], 4);
  }
  // a hand closed round the juice pack (seen from the thumb side)
  function handGrip(c) {
    blob(c, [[-0.02, -0.1], [0.12, -0.14], [0.24, -0.12], [0.3, -0.04], [0.3, 0.06], [0.24, 0.12], [0.1, 0.13], [-0.02, 0.09]]);
    limb(c, [0.06, -0.08], [0.22, -0.2], [[0, 0.055, 0.055], [1, 0.04, 0.04]], 4);
  }
  // the 200ml pack: x/y = centre (rig units), a = tilt; the straw comes out of the top toward `to` (or straight up)
  function juicePack(c, x, y, a, to) {
    local(c, [x, y], a, 1, (cc) => { cc.beginPath(); cc.roundRect(-0.13, -0.22, 0.26, 0.44, 0.03); cc.fill(); });
    const top = [x + Math.sin(a) * 0.22 + Math.cos(a) * 0.06, y - Math.cos(a) * 0.22 + Math.sin(a) * 0.06];
    const end = to || [top[0] + Math.cos(a - 1.9) * 0.3, top[1] + Math.sin(a - 1.9) * 0.3];
    c.lineWidth = 0.035; c.beginPath(); c.moveTo(top[0], top[1]); c.lineTo(end[0], end[1]); c.stroke();
  }
  // o: x, y (seat top), scale, light, rimColor, backlight, glow, lean, headTilt,
  //    pose {sep 0..1 (hands apart), lift, rest 0..1 (hands on the lap), hold 0..1 (the pack in his near hand),
  //          pk 0..2 (where the held pack is: 0 at his mouth, 1 at his chest, 2 on his thigh)}
  // returns the clapping point in the canvas' device space (for the light that spreads from his hands)
  function boyClapping(ctx, t, o) {
    const cl = o.pose, lean = (o.lean === undefined ? 0.1 : o.lean) - 0.06 * clamp(1 - cl.pk) + 0.01 * Math.sin(t * 1.4);
    const R = boyRig(lean, (o.headTilt === undefined ? 0.08 : o.headTilt) - 0.1 * clamp(1 - cl.pk));   // chin up while he drinks
    const P = R.P, KN = dirDeg(P, 84, BOY.thigh), AN = dirDeg(KN, 18, BOY.shin), KF = dirDeg(P, 78, BOY.thigh * 0.97), AF = dirDeg(KF, -6, BOY.shin);
    // the pack: at his mouth (straw in), at his chest, then standing on his thigh
    const mouth = headPt(R, [0.43, 0.2]);
    const atMouth = [mouth[0] + 0.2, mouth[1] + 0.42], atChest = R.F(0.62, 1.45), onThigh = v2.add(v2.mix(P, KN, 0.62), [0, -0.52]);
    const pk = clamp(cl.pk, 0, 2), e1 = PV.ease.inOutCubic(clamp(pk)), e2 = PV.ease.inOutCubic(clamp(pk - 1));
    const packP = pk <= 1 ? v2.mix(atMouth, atChest, e1) : v2.mix(atChest, onThigh, e2);
    const packA = pk <= 1 ? lerp(-0.42, -0.1, e1) : lerp(-0.1, 0.05, e2);
    // clapping point in front of the chest; the hands rest on the lap before the applause
    const C = v2.mix(R.F(0.9, 1.5), v2.add(KN, [-0.55, -0.42]), cl.rest);
    const Wf = v2.add(C, [0.12 - 0.06 * cl.sep, -0.06 + 0.02 * cl.sep - cl.lift * 0.4]);
    const grip = [packP[0] - 0.12, packP[1] + 0.08];
    const Wn = v2.mix(v2.add(C, [-0.08 + 0.08 * cl.sep, 0.04 - 0.22 * cl.sep - cl.lift]), grip, cl.hold);
    const Sf = v2.add(R.S, [0.06, -0.02]);
    const Ef = ik(Sf, Wf, BOY.upArm, BOY.foreArm, 1), En = ik(R.S, Wn, BOY.upArm, BOY.foreArm, 1);
    const k = BOY.armR / 0.125;
    L.figureRender(ctx, o, null, (F) => {
      F.layer({ fill: F.tone(0.06) }, (c) => { // far side: chair, far leg, far arm
        schoolChair(c);
        limb(c, P, KF, scaleP(S_TTHIGH, 1)); limb(c, KF, AF, scaleP(S_TSHIN, 1)); local(c, AF, 0, 1.08, shoeSide);
        limb(c, Sf, Ef, scaleP(S_UPARM, k)); limb(c, Ef, Wf, scaleP(S_FOREARM, k));
        local(c, Wf, Math.atan2(Wf[1] - Ef[1], Wf[0] - Ef[0]) - 0.25 - cl.sep * 0.3, BOY.hand / 0.78, handClap);
      });
      F.layer({ inner: 0.35 }, (c) => { // near leg, body, head
        limb(c, P, KN, scaleP(S_TTHIGH, 1)); limb(c, KN, AN, scaleP(S_TSHIN, 1)); local(c, AN, -0.04, 1.08, shoeSide);
        blob(c, [R.F(-0.42, BOY.waistH), R.F(-0.46, 0.05), R.F(-0.32, -0.36), KN, R.F(0.35, 0.12), R.F(0.34, BOY.waistH)]);
        boyTorso(c, R); boyHead(c, t, R);
      });
      F.layer({ fill: F.tone(0.12, '#c9b48e'), inner: 0.5 }, (c) => { // the juice pack (a touch lighter than him)
        juicePack(c, packP[0], packP[1], packA, pk < 0.35 ? mouth : null);
      });
      F.layer({ inner: 0.6 }, (c) => { // near arm across the body
        limb(c, R.S, En, scaleP(S_UPARM, k)); limb(c, En, Wn, scaleP(S_FOREARM, k));
        const ha = Math.atan2(Wn[1] - En[1], Wn[0] - En[0]);
        if (cl.hold > 0.5) local(c, Wn, ha - 0.2, BOY.hand / 0.78, handGrip);
        else local(c, Wn, ha + 0.1 + cl.sep * 0.35, BOY.hand / 0.78, handClap);
      });
    });
    const m = ctx.getTransform(), u = 92 * (o.scale || 1), hx = o.x + C[0] * u, hy = o.y + (C[1] - 0.05) * u;
    return { x: m.a * hx + m.c * hy + m.e, y: m.b * hx + m.d * hy + m.f };
  }

  /* ============================================================== C02 */
  // the days go by: each change of the light takes one spectator away (cut-local seconds)
  const C02_DAYS = [0.95, 1.72, 2.48, 3.18];
  const c02Day = (t) => C02_DAYS.reduce((n, s) => n + (t >= s ? 1 : 0), 0);
  const C02_F = { x: 1040, y: 600 };       // push-in centre (on her)
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
      pierShade(c, R, 1);
      roomHaze(c, R, 1);
      L.grandPiano(c, R.piano(PIANO.x, PIANO.z, PIANO.yaw, { lidOpen: 1, bench: false, rimLit: true }));
      c.restore();
    }) };
  }
  const C02_SP = [
    { x: 95, y: 870, s: 38, kind: 0, col: '#2c2830', ph: 1.2 },
    { x: 1330, y: 925, s: 40, kind: 1, col: '#27232c', ph: 2.7 },
    { x: 455, y: 955, s: 45, kind: 2, col: '#231f28', ph: 4.1, rot: 0.05 },
    { x: 790, y: 995, s: 39, kind: 3, col: '#2b262f', ph: 5.6 },
  ];
  PV.shot('C02', { draw(ctx, tIn, d) {
    const t = cutT(tIn, d);
    const zoom = c02Zoom(t, d), e = PV.ease.inOut(clamp(t / d));
    const day = c02Day(t), tr = day > 0 ? sm(0, 0.2, t - C02_DAYS[day - 1]) : 1;
    // ---- the room: today's plate (dissolving from yesterday's at a day change). All five are built on the first frame
    for (let k = 0; k <= C02_DAYS.length; k++) c02Room(k, d);
    const today = c02Room(day, d), R = roomR('c02');
    if (tr < 1 && day > 0) { const p = c02Room(day - 1, d); blitZ(ctx, p.cv, p.z0, zoom, C02_F.x, C02_F.y); }
    blitZ(ctx, today.cv, today.z0, zoom, C02_F.x, C02_F.y, tr < 1 && day > 0 ? tr : 1);
    // ---- the boy in the shade by the pier: he is there every day (on twos, half a step out of phase with her)
    const qb = Math.floor(t * 12 - 0.5 + 1e-6) / 12 + 1 / 24, zb = c02Zoom(qb, d);
    blitZ(ctx, plate('c02boy', qb + ':' + day, (c) => {
      PV.camera(c, { zoom: zb, cx: C02_F.x, cy: C02_F.y });
      const bs = R.project(BOY_SEAT), sc = ppmAt(R, BOY_SEAT) / 417, u = 92 * sc;
      L.boySeated(c, (qb + day * 41.3) * 0.4, { x: bs[0], y: bs[1], scale: sc, pose: 'juice', chair: true, light: -1.45, rimColor: '#ffe6c2', rim: 0.85, backlight: 0.22, glow: 0.35 });
      hazeOn(c, R, 1);
      return devBox(c, bs[0] - 2.8 * u, bs[1] - 6.4 * u, bs[0] + 4.0 * u, bs[1] + 2.8 * u);
    }), zb, zoom, C02_F.x, C02_F.y);
    // ---- the pianist (white blouse, long black hair), 〈雪あらし〉 at full force (on twos; her pose jumps each day)
    const q = q12(t), zq = c02Zoom(q, d);
    blitZ(ctx, plate('c02girl', q + ':' + day, (c) => {
      PV.camera(c, { zoom: zq, cx: C02_F.x, cy: C02_F.y });
      const bw = benchW(PIANO), bp = R.project(bw), ppm = ppmAt(R, bw);
      return pianoGirl(c, q + day * 3.7, { x: bp[0], y: bp[1], scale: ppm / 418, intensity: 0.95, turn: 0.32, outfit: 'blouse', light: -1.3, rimColor: '#fff0d4', backlight: 0.42, glow: 0.55 });
    }), zq, zoom, C02_F.x, C02_F.y);
    // a time-lapse exposure pulse at each day change
    for (const s of C02_DAYS) { const k = Math.exp(-Math.pow((t - s) / 0.05, 2)); if (k > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(255,242,220,${0.26 * k})`; ctx.fillRect(0, 0, W, H); ctx.restore(); } }
    // ---- the blizzard of notes, blown from the piano across the room toward the people watching (right -> left)
    const pp = R.project([PIANO.x - 0.2, 1.05, PIANO.z]);
    const ex = C02_F.x + (pp[0] - C02_F.x) * zoom, ey = C02_F.y + (pp[1] - C02_F.y) * zoom;
    gusts(ctx, t, { n: 8, y0: 110, y1: 880, alpha: 0.34, speed: 1800 });
    hail(ctx, t, { seed: 21, n: 430, nf: 0.12, blue: true, em: { x: ex - 20, y: ey - 40, w: 680, h: 560 }, cx: ex - 80, cy: ey - 60, vx: 1050, vz: 0.62, life: [1.0, 1.7], size: 14, noteK: 1.7, zFocus: 0.9, dof: 5, fall: 46, ambient: 0.45, streak: 0.13, streakA: 1, streakMax: 340, batch: 20 });
    hail(ctx, t, { mode: 'field', seed: 23, n: 14, nf: 0, zr: [0.2, 0.32], vx: 900, size: 10, zFocus: 0.9, dof: 4, fall: 60, streak: 0.05, streakA: 0.45, alpha: 0.75 });  // grains right at the lens
    // ---- foreground: spectators (they leave one by one) and the curtain in shade
    const sp = C02_SP.map((s, i) => Object.assign({}, s, { a: 1 - sm(C02_DAYS[i] - 0.04, C02_DAYS[i] + 0.32, t) }));
    spectators(ctx, t, sp, 0.25 * e);
    fgCurtain(ctx, t, 1468 + 26 * e);
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
  // her back jumps at 2.8. The chord 9.6 s falls inside frame 230 -> cut-local frame 14 (0.583): the hail stops there
  const C04 = { chord: 14 / 24 - 0.004, focus0: 1.3, focus1: 1.66, claps: [1.6, 2.1, 2.6], jump: 2.8, wave: 2300 };
  const C04_F = { x: 760, y: 620 };
  // static camera (the rack focus is the move): every plate is painted at this zoom and blitted 1:1
  const C04_Z0 = 1.01, c04Drift = () => C04_Z0;
  // the boy: drinking -> the straw leaves his mouth when the music stops -> the pack goes onto his thigh in the
  // silence -> both hands up -> three small claps -> the hands sink a little
  function c04Pose(t) {
    const pk = 1.0 * sm(0.66, 0.98, t) + 1.0 * sm(1.02, 1.38, t);
    const hold = 1 - sm(1.36, 1.44, t);
    const rise = sm(1.4, 1.56, t);
    let sep = 1;
    for (const tc of C04.claps) { const u = t - tc; sep = Math.min(sep, u < 0 ? sm(0, 1, -u / 0.13) : sm(0, 1, u / 0.17)); }
    sep = lerp(0.6, sep, rise);
    const lift = (1 - sep) * 0.04 * rise;
    const after = sm(2.75, 3.3, t);       // after the third clap the hands sink a little
    return { pk, hold, sep: lerp(sep, 0.25, after), lift, rest: Math.max(1 - rise, after * 0.35) };
  }
  // the room is one held plate: until the focus pull it sits 9px out of focus (curtain motion would not read there),
  // and from the final chord on the world is meant to stand still with the hail
  const c04RoomT = () => q8(C04.chord);
  // the piano does not move in C04: painted once at the plate zoom
  let C04_PIANO = null;
  function c04Piano(R) {
    if (!C04_PIANO) {
      const b = PV.makeCanvas(W, H), c = b.ctx; c.save(); PV.camera(c, { zoom: C04_Z0, cx: C04_F.x, cy: C04_F.y });
      const pr = L.grandPiano(c, R.piano(PIANO.x, PIANO.z, PIANO.yaw, { lidOpen: 1, bench: false, rimLit: true }));
      const bb = pr && pr.bbox ? devBox(c, pr.bbox[0] - 80, pr.bbox[1] - 80, pr.bbox[2] + 80, pr.bbox[3] + 140) : [0, 0, W, H]; c.restore();
      C04_PIANO = { cv: b.canvas, box: [Math.max(0, Math.floor(bb[0])), Math.max(0, Math.floor(bb[1])), Math.min(W, Math.ceil(bb[2])), Math.min(H, Math.ceil(bb[3]))] };
    }
    return C04_PIANO;
  }
  PV.shot('C04', { draw(ctx, tIn, d) {
    const t = cutT(tIn, d);
    const fk = PV.ease.inOutCubic(sm(C04.focus0, C04.focus1, t));     // rack focus: her back -> the boy
    const bFar = lerp(9, 0, fk), bNear = lerp(0, 12, fk);
    const drift = c04Drift(t), q = q12(t), dq = C04_Z0;
    // ---------- far layer: the room (light, the pier's shade and the air baked in), the boy, the far hail
    const far = PV.buffer('g01:c04far'), fc = far.ctx;     // the room plate is opaque: no clear needed
    const rt = c04RoomT(t);
    blitZ(fc, plate('c04room', rt, (c) => {
      paintRoom(c, 'c04', rt + 165.2, C04_Z0, C04_F.x, C04_F.y);
      const RR = roomR('c04');
      c.save(); PV.camera(c, { zoom: C04_Z0, cx: C04_F.x, cy: C04_F.y });
      dayLight(c, 0, RR, 4, 1, 'c04', 0.95); pierShade(c, RR, 1.6); roomHaze(c, RR, 0.8);   // the curtain right behind him is close and bright: shade it harder
      c.restore();
    }), C04_Z0, drift, C04_F.x, C04_F.y);
    const R = roomR('c04');
    const P = plate('c04boy', q, (c) => {
      PV.camera(c, { zoom: dq, cx: C04_F.x, cy: C04_F.y });
      const bs = R.project(BOY_SEAT), sc = ppmAt(R, BOY_SEAT) / 417, u = 92 * sc;
      STAMP.c04hands = boyClapping(c, q, { x: bs[0], y: bs[1], scale: sc, pose: c04Pose(q), light: -1.45, rimColor: '#ffe6c2', rim: 0.85, backlight: 0.22, glow: 0.35, lean: 0.12, headTilt: 0.1 });
      hazeOn(c, R, 0.8);
      return devBox(c, bs[0] - 2.8 * u, bs[1] - 6.6 * u, bs[0] + 4.0 * u, bs[1] + 2.8 * u);
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
    // ---------- near layer: the piano and her back
    hail(fc, t, HAIL_FAR);
    const near = layer('c04near'), nc = near.ctx;
    blitZ(nc, c04Piano(R), C04_Z0, drift, C04_F.x, C04_F.y);
    hail(nc, t, HAIL_BEHIND);            // the hail around the piano, just behind her
    // she plays the last passage cleanly, the final chord at 0.6, then breathes with her shoulders; 2.8 a small start
    const bw = benchW(PIANO), bp0 = R.project(bw), ppm = ppmAt(R, bw);
    const playing = (x) => 1 - sm(C04.chord - 0.06, C04.chord + 0.02, x);
    const tq = Math.floor(t * 12) / 12;
    const breath = sm(C04.chord, C04.chord + 0.25, tq) * (0.55 + 0.45 * Math.exp(-(tq - C04.chord) * 0.5)) * (0.5 - 0.5 * Math.cos(TAU * (tq - C04.chord) / 0.82));
    // the start: up in 2 frames, then settles with a small overshoot
    const ju = t - C04.jump, jump = ju <= 0 ? 0 : ju < 0.084 ? sm(0, 0.084, ju) : Math.exp(-(ju - 0.084) * 6) * Math.cos((ju - 0.084) * 14);
    const gT = playing(q) > 0 ? q : C04.chord + 0.01, gI = 0.78 * playing(q);
    const girl = plate('c04girl', gT + ':' + gI.toFixed(4), (c) => {
      PV.camera(c, { zoom: dq, cx: C04_F.x, cy: C04_F.y });
      return pianoGirl(c, gT, { x: bp0[0], y: bp0[1], scale: ppm / 418, intensity: gI, turn: -0.35, outfit: 'blouse', light: -1.3, rimColor: '#fff0d4', backlight: 0.42, glow: 0.5 });
    });
    // breathing / the start: scale and lift about the bench (where she sits), applied to her plate
    const bpx = C04_F.x + (bp0[0] - C04_F.x) * drift, bpy = C04_F.y + (bp0[1] - C04_F.y) * drift, kz2 = drift / dq;
    nc.save(); nc.translate(bpx, bpy); nc.scale(1 + 0.004 * breath, 1 + 0.032 * breath + 0.035 * jump); nc.translate(0, -26 * jump); nc.translate(-bpx, -bpy);
    nc.translate(C04_F.x, C04_F.y); nc.scale(kz2, kz2); nc.translate(-C04_F.x, -C04_F.y);
    { const gb = girl.box, gw = gb[2] - gb[0], gh = gb[3] - gb[1]; if (gw > 0 && gh > 0) nc.drawImage(girl.cv, gb[0], gb[1], gw, gh, gb[0], gb[1], gw, gh); }
    nc.restore();
    hail(nc, t, HAIL_MID);
    // ---------- composite with the focus pull
    blurBlit(ctx, far.canvas, bFar);
    blurBlit(ctx, near.canvas, bNear);
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

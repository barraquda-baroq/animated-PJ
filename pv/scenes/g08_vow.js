/* g08_vow — 『キミの右手のアイロニー』本予告  ACT4 嵐の橋（後半）C29〜C32
 *   C29 (103.5–105.5)  濡れたアスファルトの上、上に開いた彼の左手の極端なアップ。掌に溜まる雨、雷光に光る弦のタコ。
 *                      鼓動（103.7／104.4）のあと、ゆっくり、強く握り込まれる（親指を掛けた拳。親指の付け根はボケ）。
 *   C30 (105.5–110.0)  白閃光と横転→雷光のストロボで静止画：仰向けの彼の視点で見上げる主塔／馬乗りの先輩（髪がレンズへ
 *                      垂れる逆光）／拳を振り上げ→スミア1コマ→ネガの衝撃1コマ／台詞の間に3段階で寄る／109.5 白く飛ぶ。
 *   C31 (110.0–116.5)  路面すれすれの横位置1カット：彼の胸に崩れた先輩、肩から路面へ流れる濡れ髪（顔は隠れる）、静止。
 *                      115.0 上体を起こし天を仰ぐ→カメラはゆっくり追って上へ（tilt＋pan）、115.82 背後に稲妻。
 *   C32 (116.5–123.5)  彼女の背後から：起き上がった彼が抱き寄せる（三角巾の白い帯・垂れた左腕・肩に埋めた彼の頭）、
 *                      雲間がわずかに明るむ→背中を掴む彼の右手へ寄る（白く力んだ指・寄った濡れ布・彼女の髪）→122.9 白で静止。
 * Pure functions of the cut-local time t. Layers held on twos (2-koma) are cached by their full input key and painted
 * with the camera of the quantised time, so the pixels never depend on the render order (see heldLayer).
 * Faces are never acted; no blade, no blood, no river, no right hand of his in C29 (storyboard §11).
 */
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, TAU = Math.PI * 2, PI = Math.PI, HP = Math.PI / 2;
  const clamp = PV.clamp, lerp = PV.lerp, sm = PV.smooth, N2 = PV.noise2, R1 = PV.rand1;
  const sin = Math.sin, cos = Math.cos;
  const E = PV.ease;
  // hex colour mix (the hand rig's keyColor/fillColor must be '#rrggbb')
  const mixHex = (a, b, k) => { const A = PV.hex2rgb(a), B = PV.hex2rgb(b), h = (v) => ('0' + Math.round(lerp(v[0], v[1], clamp(k))).toString(16)).slice(-2); return '#' + h([A[0], B[0]]) + h([A[1], B[1]]) + h([A[2], B[2]]); };

  /* ================================================================ utilities */
  const cutT = (t, d) => clamp(t, -0.02, d + 0.02);
  function buf(key, w, h) { const b = PV.buffer('g08:' + key, w || W, h || H); b.ctx.clearRect(0, 0, b.canvas.width, b.canvas.height); return b; }
  // lightning: fast attack, flicker (return strokes) and afterglow
  function strobe(t, s, decay) {
    const u = t - s; if (u < 0 || u > decay * 4) return 0;
    const p = Math.exp(-u / (decay * 0.22)) + 0.7 * Math.exp(-Math.max(0, u - 0.07) / (decay * 0.18)) * (u > 0.07 ? 1 : 0) + 0.45 * Math.exp(-Math.max(0, u - 0.17) / (decay * 0.3)) * (u > 0.17 ? 1 : 0);
    return Math.min(1, p);
  }
  const flashOf = (t, list) => list.reduce((m, [s, dec, a]) => Math.max(m, (a === undefined ? 1 : a) * strobe(t, s, dec)), 0);
  // heart beat "lub-dub" envelope at time b
  const beatEnv = (t, b) => Math.exp(-Math.pow((t - b) / 0.045, 2)) + 0.6 * Math.exp(-Math.pow((t - b - 0.17) / 0.04, 2));
  // Catmull-Rom closed/open spline through pts ([x,y] or [x,y,1] = sharp corner)
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
  // filled ribbon along a polyline with per-point half widths (hair locks, cloth folds)
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
  // tapered limb (two radii) as a capsule-like blob
  function limb(c, p0, p1, r0, r1) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1e-6, nx = -dy / l, ny = dx / l, a = Math.atan2(dy, dx);
    c.beginPath(); c.moveTo(p0[0] + nx * r0, p0[1] + ny * r0); c.lineTo(p1[0] + nx * r1, p1[1] + ny * r1);
    c.arc(p1[0], p1[1], r1, a + HP, a - HP, true); c.lineTo(p0[0] - nx * r0, p0[1] - ny * r0); c.arc(p0[0], p0[1], r0, a - HP, a + HP, true); c.closePath(); c.fill();
  }
  // a soft round sprite (cached per colour)
  function dotSprite(col) {
    return PV.cached('g08:dot:' + col, 64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, PV.rgba(col, 1)); g.addColorStop(0.35, PV.rgba(col, 0.55)); g.addColorStop(1, PV.rgba(col, 0)); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
  }
  function glint(ctx, x, y, r, a, ang) { // 4-point star glint (calluses, water, wet hair)
    if (a <= 0.01) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0); ctx.globalCompositeOperation = 'lighter';
    for (const [aa, l, w] of [[0, r * 2.6, r * 0.12], [HP, r * 1.7, r * 0.1]]) {
      ctx.save(); ctx.rotate(aa); const g = ctx.createLinearGradient(-l, 0, l, 0); g.addColorStop(0, 'rgba(220,234,255,0)'); g.addColorStop(0.5, `rgba(245,250,255,${(0.9 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(220,234,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, l, Math.max(0.6, w), 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = a; ctx.drawImage(dotSprite('#e9f1ff'), -r, -r, r * 2, r * 2); ctx.restore();
  }

  // A layer held on twos (2-koma): painted with the camera of the quantised time tq, then re-projected to the camera of
  // the current frame (screen = C + zoom·(p − f)). Deterministic: the paint never depends on the frames before it.
  // The layer is painted with a margin MG round the frame: figures.js reuses pooled buffers and, where a figure is
  // clipped by the canvas edge, its blurs sample stale pixels left by an earlier, larger figure. With the margin that
  // edge lies outside the visible frame, so the visible pixels never depend on what was rendered before.
  const MG = 96;
  function heldLayer(name, key, camQ, camNow, paint, q) {
    q = q || 1;
    const st = heldLayer.st[name] || (heldLayer.st[name] = { key: null, res: null }), m = Math.round(MG * q);
    const b = PV.buffer('g08:held:' + name + (q < 1 ? 'h' : ''), Math.round(W * q) + 2 * m, Math.round(H * q) + 2 * m);
    if (st.key !== key + '|' + q) { b.ctx.clearRect(0, 0, b.canvas.width, b.canvas.height); b.ctx.save(); b.ctx.translate(m, m); b.ctx.scale(q, q); st.res = paint(b.ctx); b.ctx.restore(); st.key = key + '|' + q; }
    const k = camNow.z / camQ.z, dx = camNow.z * (camQ.fx - camNow.fx), dy = camNow.z * (camQ.fy - camNow.fy);
    return { canvas: b.canvas, res: st.res, draw(ctx) {
      if (q === 1 && Math.abs(k - 1) < 1e-5 && Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) { ctx.drawImage(b.canvas, m, m, W, H, 0, 0, W, H); return; }
      ctx.save(); ctx.translate(960 + dx, 540 + dy); ctx.scale(k / q, k / q); ctx.translate(-960 * q - m, -540 * q - m); ctx.imageSmoothingQuality = 'low'; ctx.drawImage(b.canvas, 0, 0); ctx.restore();
    } };
  }
  heldLayer.st = {};
  // a cached full-frame vignette (radial: clear inside r0*H, colour rgb at alpha a at r1*H); blit with globalAlpha
  function vignette(key, r0, r1, rgb, a, cy) {
    return PV.cached('g08:vig:' + key, W, H, (c) => { const y = cy === undefined ? H / 2 : cy, g = c.createRadialGradient(W / 2, y, H * r0, W / 2, y, H * r1); g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},${a})`); c.fillStyle = g; c.fillRect(0, 0, W, H); });
  }

  /* ======================================================== rain (3D, per view) */
  // Rain seen along the view axis.  vp = vanishing point of the fall direction in screen space;
  // dir = +1 drops fall AWAY from the camera (looking down), -1 TOWARD it (looking up).
  // zMin/zMax select a depth slice (to interleave with the subject).  speed in depth units / s.
  function rainAxial(ctx, t, o) {
    const n = o.count || 200, vp = o.vp, dir = o.dir || 1, z0 = o.zNear || 0.9, z1 = o.zFar || 7, sp = o.speed || 9;
    const zMin = o.zMin === undefined ? z0 : o.zMin, zMax = o.zMax === undefined ? z1 : o.zMax, seed = o.seed || 1;
    const col = o.color || '200,215,240', A = o.alpha === undefined ? 0.5 : o.alpha, shut = o.shutter || 0.02;
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = R1(i, seed) * TAU, R = lerp(500, 2600, Math.pow(R1(i, seed + 1), 0.7)), per = (z1 - z0) / sp, ph = R1(i, seed + 2) * per;
      const k = ((((t + ph) % per) + per) % per) / per;
      const z = dir > 0 ? lerp(z0, z1, k) : lerp(z1, z0, k);
      if (z < zMin || z > zMax) continue;
      const zb = Math.max(z0 * 0.8, z - dir * sp * shut);
      const r1 = R / z, r2 = R / zb, ca = cos(a), sa = sin(a);
      const x1 = vp[0] + ca * r1, y1 = vp[1] + sa * r1, x2 = vp[0] + ca * r2, y2 = vp[1] + sa * r2;
      if ((x1 < -50 && x2 < -50) || (x1 > W + 50 && x2 > W + 50) || (y1 < -50 && y2 < -50) || (y1 > H + 50 && y2 > H + 50)) continue;
      const fog = clamp(1.25 - z / z1), wd = clamp(3.2 / z, 0.5, 6) * (o.width || 1);
      ctx.strokeStyle = `rgba(${col},${(A * fog * (z < 1.4 ? 0.35 : 1)).toFixed(3)})`; ctx.lineWidth = wd;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();
  }

  /* ====================================================================== C29 */
  // his LEFT hand, palm up, seen from above (his own eyes), an extreme close-up: rain pools in the palm, the string
  // calluses catch the lightning; after the 2nd heart beat it closes, slowly and hard, into a fist (thumb locked over).
  // Focus: the fingertips. The root of the thumb is never in focus (no blade, no blood, no right hand in frame).
  const C29 = { beats: [0.2, 0.9], flash: [[0.42, 0.34, 0.85], [1.38, 0.22, 0.25]], vp: [930, 1900] };
  // the fist pose of the library (thumb locked over index/middle by IK), sampled once
  function fistPose() {
    if (fistPose.v) return fistPose.v;
    const d = PV.buffer('g08:dummy', 8, 8);
    const rig = L.handFist(d.ctx, { side: 'L', kind: 'him', clench: 1, shake: 0, x: 4, y: 4, scale: 0.02 });
    return (fistPose.v = { F: rig.pose.F.map((f) => ({ flex: f.flex.slice(), splay: f.splay })), T: Object.assign({}, rig.pose.T, { flex: rig.pose.T.flex.slice() }) });
  }
  // the open hand: relaxed, a little cupped (holding the rain), fingers loosely apart
  const OPEN = { F: [[0.3, 0.36, 0.2], [0.27, 0.36, 0.2], [0.31, 0.4, 0.22], [0.38, 0.46, 0.26]], splay: [-0.11, -0.03, 0.065, 0.16], T: { abd: 0.66, opp: 0.38, flex: [0.16, 0.2] } };
  // clench progress: a hesitant first curl from 0.5, then (2nd heart beat, 0.9) the decision: a strong close
  function c29Clench(t) { return 0.14 * sm(0.5, 0.95, t) + 0.86 * E.inOut(clamp((t - 0.9) / 0.72)); }
  function c29Pose(u, t) {
    const FP = fistPose(), squeeze = sm(1.5, 1.9, t), trem = 0.015 + 0.05 * squeeze;
    const F = [];
    for (let i = 0; i < 4; i++) {
      const p = clamp((u - [0.05, 0.034, 0.017, 0][i]) / 0.95);   // the little finger leads, the index follows
      const fl = OPEN.F[i].map((v, j) => lerp(v, FP.F[i].flex[j] + squeeze * 0.05, E.inOut(clamp(p * [0.94, 1.06, 1.14][j]))) + trem * u * N2(t * 7.3 + i * 4.1, j * 2.3));
      F.push({ flex: fl, splay: lerp(OPEN.splay[i], FP.F[i].splay, E.inOut(p)) });
    }
    const pt = E.inOut(clamp((u - 0.42) / 0.58)), T = FP.T;   // the thumb locks over last
    return { F, T: { abd: lerp(OPEN.T.abd, T.abd, pt), opp: lerp(OPEN.T.opp, T.opp, pt), flex: [lerp(OPEN.T.flex[0], T.flex[0], pt) + trem * N2(t * 6.1, 31) * u, lerp(OPEN.T.flex[1], T.flex[1], pt)], twist: lerp(0, T.twist || 0, pt) } };
  }
  // the wet asphalt ~1 m below the hand (far out of focus), full res so it is blitted 1:1 (dark and lightning-lit versions)
  function c29Ground(lit) {
    return PV.cached('g08:c29ground3' + (lit ? 'L' : 'D'), W, H, (c) => {
      const w = W / 2, h = H / 2, r = PV.rng(291), b = PV.makeCanvas(w, h), g0 = b.ctx;
      let g = g0.createLinearGradient(0, 0, w * 0.5, h); g.addColorStop(0, lit ? '#34405e' : '#101827'); g.addColorStop(1, lit ? '#1f2840' : '#080c16');
      g0.fillStyle = g; g0.fillRect(0, 0, w, h);
      // the aggregate: fine grain + low mottling (reads as asphalt even when soft)
      for (let i = 0; i < 2600; i++) {
        const x = r() * w, y = r() * h, k = r(), s = 0.6 + r() * 1.6;
        g0.fillStyle = lit ? `rgba(${170 + 60 * k | 0},${184 + 50 * k | 0},${220 + 30 * k | 0},${(0.06 + 0.12 * r()).toFixed(3)})` : `rgba(${40 + 40 * k | 0},${50 + 44 * k | 0},${76 + 50 * k | 0},${(0.1 + 0.2 * r()).toFixed(3)})`;
        g0.fillRect(x, y, s, s);
      }
      for (let i = 0; i < 140; i++) {
        const x = r() * w, y = r() * h, rr = 10 + r() * 34;
        g0.fillStyle = lit ? `rgba(200,212,240,${(0.03 + 0.05 * r()).toFixed(3)})` : `rgba(6,9,18,${(0.12 + 0.18 * r()).toFixed(3)})`;
        g0.beginPath(); g0.ellipse(x, y, rr, rr * (0.5 + 0.4 * r()), r() * PI, 0, TAU); g0.fill();
      }
      // shallow puddles: they mirror the storm sky (smooth, a little brighter), small and few
      for (const [x, y, rr, asp, sd] of [[95, 80, 120, 0.42, 3], [830, 70, 110, 0.4, 7], [700, 455, 150, 0.38, 11]]) {
        const pts = []; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; const rad = rr * (0.6 + 0.4 * (0.5 + 0.5 * N2(sd + cos(a) * 1.3, sin(a) * 1.3))); pts.push([x + cos(a) * rad, y + sin(a) * rad * asp]); }
        g = g0.createLinearGradient(x - rr, y - rr * asp, x + rr, y + rr * asp);
        g.addColorStop(0, lit ? 'rgba(226,234,255,0.8)' : 'rgba(52,66,98,0.75)'); g.addColorStop(1, lit ? 'rgba(150,168,214,0.7)' : 'rgba(26,34,56,0.7)');
        g0.fillStyle = g; blob(g0, pts);
      }
      // a worn, wet lane line crossing far below (the unmistakable sign of a road)
      g0.save(); g0.translate(w * 0.8, h * 0.5); g0.rotate(-1.18);
      for (let k = -3; k <= 3; k++) { g0.fillStyle = lit ? 'rgba(236,240,252,0.8)' : 'rgba(120,132,160,0.5)'; g0.fillRect(k * 170 - 60, -11, 120, 22); }
      g0.restore();
      // his right knee on the asphalt (dark jeans), very close below the hand → a soft black mass bottom right
      g = g0.createRadialGradient(w * 1.06, h * 1.18, 10, w * 1.06, h * 1.18, h * 0.62); g.addColorStop(0, 'rgba(3,5,10,1)'); g.addColorStop(0.7, 'rgba(3,5,10,0.94)'); g.addColorStop(1, 'rgba(3,5,10,0)');
      g0.fillStyle = g; g0.fillRect(0, 0, w, h);
      c.filter = 'blur(12px)'; c.drawImage(b.canvas, -20, -20, W + 40, H + 40); c.filter = 'none';
      // wet glints of the aggregate, out of focus → bokeh discs with a brighter rim (drawn after the blur)
      for (let i = 0; i < 150; i++) {
        const x = r() * W, y = r() * H, rr = 4 + Math.pow(r(), 2) * 16, a = (lit ? 0.32 : 0.12) * (0.35 + 0.65 * r());
        if (x > W * 0.78 && y > H * 0.7) continue;   // not on the knee
        c.fillStyle = `rgba(196,212,246,${(a * 0.5).toFixed(3)})`; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
        c.strokeStyle = `rgba(220,232,255,${a.toFixed(3)})`; c.lineWidth = 1.2; c.stroke();
      }
    });
  }
  // splash rings far below (perpendicular to the view: circles), soft
  function c29Splashes(ctx, t, lv) {
    ctx.save(); ctx.lineWidth = 2.2;
    for (let i = 0; i < 44; i++) {
      const per = 0.35 + 0.4 * R1(i, 61), cyc = Math.floor((t + R1(i, 62) * per) / per), k = (((t + R1(i, 62) * per) % per) + per) % per / per;
      const x = R1(cyc * 44 + i, 63) * W, y = R1(cyc * 44 + i, 64) * H, rr = 4 + k * 22;
      ctx.strokeStyle = `rgba(200,214,242,${((0.22 + 0.3 * lv) * (1 - k)).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  PV.shot('C29', { draw(ctx, tIn, d) {
    const t = cutT(tIn, d);
    const fl = flashOf(t, C29.flash), beat = Math.max(beatEnv(t, C29.beats[0]), beatEnv(t, C29.beats[1]));
    const u = c29Clench(t);
    // camera: locked off; a slow breath of a dolly-in toward the hand and a jolt on each heart beat (the far ground
    // hardly moves under a dolly, so it is blitted 1:1)
    const push = 0.025 * E.inOut(clamp(t / d)) + 0.09 * E.inOut(clamp((t - 0.95) / 1.0)) + 0.016 * beat, cam = { zoom: 1 + push, cx: 930, cy: 620 };
    // 1) the ground far below (soft), lit by the flash; splashes; the rain beyond the hand falling away toward it
    ctx.drawImage(c29Ground(false), 0, 0);
    if (fl > 0.005) { ctx.save(); ctx.globalAlpha = clamp(fl); ctx.drawImage(c29Ground(true), 0, 0); ctx.restore(); }
    c29Splashes(ctx, t, fl);
    ctx.save(); PV.camera(ctx, cam);
    rainAxial(ctx, t, { vp: C29.vp, dir: 1, zMin: 2.0, count: 420, seed: 29, alpha: 0.3 + 0.5 * fl, speed: 8, zNear: 0.8, zFar: 7.5, color: '190,206,236' });
    ctx.restore();

    // 2) the hand, sharp, into its own layer (light follows the flash: night indigo → cold white)
    const hb = buf('c29hand'), hc = hb.ctx;
    hc.save(); PV.camera(hc, cam);
    const jit = 2.4 * sm(1.45, 1.8, t), tw = E.inOut(clamp((u - 0.12) / 0.88));   // the fist turns to show the locked thumb
    const key = mixHex('#8c9ec8', '#e8eeff', fl), fill = mixHex('#252e4a', '#6c7aa0', fl);
    const rig = L.hand(hc, { side: 'L', kind: 'him', view: 'palm', pitch: lerp(0.58, 0.2, tw), yaw: lerp(-0.08, -0.45, tw), x: lerp(760, 860, tw) + jit * N2(t * 31, 1), y: lerp(1125, 1120, tw) + jit * N2(t * 29, 2), rot: lerp(0.3, 0.22, tw), scale: lerp(5.85, 6.0, tw),
      pose: c29Pose(u, t), arm: 380, sleeve: '#221c1a', sleeveAt: 240, light: -2.0, keyColor: key, fillColor: fill, tint: lerp(0.95, 0.6, fl), calluses: true, thumbScar: false });
    hc.restore();
    // the palm's hollow (pool centre) and the focus point (the fingertips → the knuckles of the fist)
    const avg = (pts) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
    const mcp = avg([1, 2, 3, 4].map((i) => rig.joints[i][0])), palmC = { x: lerp(rig.wrist.x, mcp.x, 0.6), y: lerp(rig.wrist.y, mcp.y, 0.6) };
    const tips = [1, 2, 3, 4].map((i) => rig.tips[i]);
    const fingers = avg([1, 2, 3, 4].map((i) => rig.joints[i][2])), knuck = avg([1, 2, 3, 4].map((i) => rig.joints[i][1]));
    const fc = { x: lerp(fingers.x, knuck.x, sm(0.2, 0.8, u)), y: lerp(fingers.y, knuck.y, sm(0.2, 0.8, u)) };
    const palmW = Math.hypot(rig.joints[1][0].x - rig.joints[4][0].x, rig.joints[1][0].y - rig.joints[4][0].y);
    // 3) rain pooled in the palm: a thin cold lens with the lightning sky mirrored on it; ripples from the drops
    const pool = 1 - sm(0.08, 0.36, u);
    hc.save(); hc.globalCompositeOperation = 'source-atop';
    if (pool > 0.01) {
      // no hard boundary: a faint wet darkening that fades out, the lightning sky mirrored as soft sheens, a broken
      // meniscus glint on the far side, and ripples where the drops land
      const rx = palmW * 0.5 * (0.7 + 0.3 * pool), ry = rx * 0.62;
      hc.save(); hc.translate(palmC.x, palmC.y); hc.rotate(0.3);
      const shape = (k) => { const pts = []; for (let j = 0; j < 14; j++) { const a = j / 14 * TAU; const r = k * (0.86 + 0.14 * N2(3.1 + cos(a) * 1.4, sin(a) * 1.4)); pts.push([cos(a) * rx * r, sin(a) * ry * r]); } return pts; };
      hc.save(); hc.scale(1, ry / rx);
      let g = hc.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
      g.addColorStop(0, `rgba(30,42,78,${(0.16 * pool).toFixed(3)})`); g.addColorStop(0.7, `rgba(30,42,78,${(0.13 * pool).toFixed(3)})`); g.addColorStop(1, 'rgba(30,42,78,0)');
      hc.fillStyle = g; hc.beginPath(); hc.arc(0, 0, rx, 0, TAU); hc.fill(); hc.restore();
      hc.save(); hc.beginPath(); spline(hc, shape(0.95), true); hc.clip();
      g = hc.createLinearGradient(-rx, -ry, rx * 0.6, ry * 0.8);
      g.addColorStop(0.2, 'rgba(220,232,255,0)'); g.addColorStop(0.36, `rgba(220,232,255,${((0.1 + 0.55 * fl) * pool).toFixed(3)})`); g.addColorStop(0.44, `rgba(220,232,255,${((0.03 + 0.2 * fl) * pool).toFixed(3)})`); g.addColorStop(0.6, 'rgba(220,232,255,0)');
      hc.fillStyle = g; hc.fillRect(-rx, -ry, rx * 2, ry * 2); hc.restore();
      hc.lineCap = 'round';
      const sp = shape(0.93);
      for (const [j0, j1, a] of [[8, 11, 0.4], [11, 13, 0.25]]) { hc.strokeStyle = `rgba(236,242,255,${((a + 0.5 * fl) * pool).toFixed(3)})`; hc.lineWidth = 2.2; hc.beginPath(); spline(hc, sp.slice(j0, j1 + 1), false); hc.stroke(); }
      // ripples from drops landing in the pool
      for (let i = 0; i < 6; i++) {
        const per = 0.38 + 0.24 * R1(i, 71), cyc = Math.floor((t + R1(i, 72) * per) / per), k = (((t + R1(i, 72) * per) % per) + per) % per / per;
        const x = (R1(cyc * 6 + i, 73) - 0.5) * rx * 1.1, y = (R1(cyc * 6 + i, 74) - 0.5) * ry * 1.1, rr = 4 + k * rx * 0.4, a = (1 - k) * pool;
        hc.strokeStyle = `rgba(236,244,255,${(0.6 * a).toFixed(3)})`; hc.lineWidth = 2.2; hc.beginPath(); hc.ellipse(x, y, rr, rr * 0.6, 0, PI * 1.0, PI * 1.95); hc.stroke();
        hc.strokeStyle = `rgba(24,34,60,${(0.32 * a).toFixed(3)})`; hc.lineWidth = 2; hc.beginPath(); hc.ellipse(x, y + 2, rr, rr * 0.6, 0, PI * 0.1, PI * 0.9); hc.stroke();
        if (k < 0.16) { const kk = k / 0.16; hc.strokeStyle = `rgba(240,246,255,${(0.85 * (1 - kk) * pool).toFixed(3)})`; hc.lineWidth = 2;
          for (let m = 0; m < 6; m++) { const a2 = m / 6 * TAU + 0.3; hc.beginPath(); hc.moveTo(x + cos(a2) * 4, y + sin(a2) * 3); hc.lineTo(x + cos(a2) * (7 + 18 * kk), y + sin(a2) * (5 + 11 * kk) - 9 * kk); hc.stroke(); } }
      }
      hc.restore();
    }
    // wet skin: beads of rain along the fingers catching the light
    for (let i = 0; i < 22; i++) {
      const ci = 1 + (i % 4), ch = rig.joints[ci], s = R1(i, 81);
      const a = ch[Math.min(3, 1 + Math.floor(s * 3))], b = ch[Math.min(3, Math.floor(s * 3))], f = R1(i, 82);
      const x = lerp(a.x, b.x, f) + (R1(i, 83) - 0.5) * 18, y = lerp(a.y, b.y, f) + (R1(i, 84) - 0.5) * 18, rr = 2.4 + 3 * R1(i, 85);
      hc.strokeStyle = 'rgba(30,40,70,0.25)'; hc.lineWidth = 1.2; hc.beginPath(); hc.arc(x, y, rr, 0.2, PI - 0.2); hc.stroke();
      hc.fillStyle = `rgba(240,246,255,${(0.32 + 0.6 * fl).toFixed(3)})`; hc.beginPath(); hc.ellipse(x - rr * 0.3, y - rr * 0.35, rr * 0.42, rr * 0.3, -0.6, 0, TAU); hc.fill();
    }
    // raindrops hitting the hand: tiny crowns that flash white and vanish
    for (let i = 0; i < 7; i++) {
      const per = 0.3 + 0.2 * R1(i, 95), k = (((t + R1(i, 96) * per) % per) + per) % per / per, cyc = Math.floor((t + R1(i, 96) * per) / per);
      if (k > 0.45) continue;
      const ci = Math.floor(R1(cyc * 7 + i, 97) * 5), jn = rig.joints[ci][1 + Math.floor(R1(cyc * 7 + i, 98) * 2)];
      const x = jn.x + (R1(cyc * 7 + i, 99) - 0.5) * 40, y = jn.y + (R1(cyc * 7 + i, 100) - 0.5) * 40, kk = k / 0.45;
      hc.strokeStyle = `rgba(236,244,255,${(0.7 * (1 - kk)).toFixed(3)})`; hc.lineWidth = 2;
      hc.beginPath(); hc.ellipse(x, y, 4 + kk * 22, (4 + kk * 22) * 0.6, 0, 0, TAU); hc.stroke();
    }
    hc.restore();
    // the string calluses are paler skin, but under this cold light they must not glow warm-yellow: a cool wash on the pads
    hc.save(); hc.globalCompositeOperation = 'source-atop'; hc.fillStyle = `rgba(150,168,212,${(0.3 * (1 - u)).toFixed(3)})`;
    for (let i = 1; i <= 4; i++) { const p = rig.tips[i], qj = rig.joints[i][2], cx = lerp(p.x, qj.x, 0.32), cy = lerp(p.y, qj.y, 0.32), r = 0.3 * Math.hypot(p.x - qj.x, p.y - qj.y); hc.beginPath(); hc.arc(cx, cy, r, 0, TAU); hc.fill(); }
    hc.restore();
    // 4) depth of field: sharp at the fingertips / knuckles, soft toward the root of the thumb and the wrist (bottom
    //    left). A linear feather: the sharp layer is erased past the band (gradient only over the band), the blurred
    //    quarter-res copy is masked the opposite way at quarter res, so nothing full-frame is gradient-filled.
    const th = 2.3 - 0.2 * u, d0 = lerp(520, 210, sm(0.1, 0.7, u)), d1 = d0 + 240, ox = fc.x, oy = fc.y;   // th: direction focus → thumb root
    const q0 = buf('c29q0', W / 4, H / 4), q = buf('c29q', W / 4, H / 4);
    q0.ctx.drawImage(hb.canvas, 0, 0, W / 4, H / 4);
    q.ctx.filter = 'blur(1.7px)'; q.ctx.drawImage(q0.canvas, 0, 0); q.ctx.filter = 'none';
    { const c = q.ctx; c.save(); c.globalCompositeOperation = 'destination-in'; c.scale(0.25, 0.25); c.translate(ox, oy); c.rotate(th);
      const g = c.createLinearGradient(d0 - 30, 0, d0 + 110, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = g; c.fillRect(-3000, -3000, 6000, 6000); c.restore(); }
    { const c = hc; c.save(); c.globalCompositeOperation = 'destination-out'; c.translate(ox, oy); c.rotate(th);
      const g = c.createLinearGradient(d0, 0, d1, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = g; c.fillRect(d0, -2400, d1 - d0, 4800);
      c.fillStyle = '#000'; c.fillRect(d1 - 1, -2400, 3000, 4800); c.restore(); }
    ctx.save(); ctx.imageSmoothingQuality = 'low';
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(th); ctx.beginPath(); ctx.rect(d0 - 30, -2400, 3000, 4800); ctx.restore(); ctx.clip();
    ctx.drawImage(q.canvas, 0, 0, W, H); ctx.restore();
    ctx.drawImage(hb.canvas, 0, 0);
    // the calluses catch the lightning
    if (fl > 0.02) tips.forEach((p, i) => { const qj = rig.joints[i + 1][2]; glint(ctx, lerp(p.x, qj.x, 0.3), lerp(p.y, qj.y, 0.3), 20 + (i === 1 ? 6 : 0), fl * (1 - 0.8 * u) * (0.75 + 0.25 * R1(i, 9)), -0.5 + 0.3 * i); });
    // water squeezed out of the fist: it runs off both sides of the hand and drops away toward the ground
    if (u > 0.3) {
      ctx.save(); ctx.lineCap = 'round';
      const sides = [rig.joints[4][0], rig.joints[1][0]], side2 = [rig.joints[4][1], rig.joints[1][1]];
      // rivulets: water pressed out between the fingers runs down the outer sides of the fist
      const rv = sm(1.05, 1.35, t) * (1 - sm(1.85, 2.0, t) * 0.5);
      for (let sd = 0; sd < 2; sd++) for (let j = 0; j < 2; j++) {
        const a0 = sides[sd], a1 = side2[sd], out = sd ? -1 : 1, x0 = lerp(a0.x, a1.x, 0.5 + 0.25 * j) + out * 14, y0 = lerp(a0.y, a1.y, 0.5 + 0.25 * j);
        const len = (120 + 90 * j) * clamp((t - 1.05 - 0.08 * j) / 0.35), wob = 6 * sin(t * 9 + j * 2 + sd);
        if (len <= 2) continue;
        ctx.strokeStyle = `rgba(200,216,246,${(0.5 * rv).toFixed(3)})`; ctx.lineWidth = 3.2 - j;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + out * (10 + wob), y0 + len * 0.5, x0 + out * (6 + wob * 0.5), y0 + len); ctx.stroke();
        ctx.fillStyle = `rgba(236,244,255,${(0.7 * rv).toFixed(3)})`; ctx.beginPath(); ctx.arc(x0 + out * (6 + wob * 0.5), y0 + len, 3.4, 0, TAU); ctx.fill();
      }
      for (let i = 0; i < 12; i++) {
        const st = 1.12 + 0.065 * i + 0.04 * R1(i, 91), uu = t - st; if (uu < 0) continue;
        const sd = i % 2, a0 = sides[sd], a1 = side2[sd], out = sd ? -1 : 1;
        const sx = lerp(a0.x, a1.x, 0.4) + out * (24 + 16 * R1(i, 92)), sy = lerp(a0.y, a1.y, 0.4) + 20 * R1(i, 93);
        const fall = (w) => [sx + out * 30 * w, sy + 1500 * w * w + 60 * w, 1 / (1 + 2.4 * w)];
        const [x, y, k] = fall(uu), [x2, y2] = fall(Math.max(0, uu - 0.03)); if (y > H + 40) continue;
        const rr = 8 * k;
        ctx.strokeStyle = `rgba(196,212,242,${(0.55 * k + 0.25 * fl).toFixed(3)})`; ctx.lineWidth = rr * 1.3; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = `rgba(236,244,255,${(0.7 * k).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, rr * 0.7, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    // 5) rain between the eye and the hand (near, soft and large)
    ctx.save(); PV.camera(ctx, cam);
    rainAxial(ctx, t, { vp: C29.vp, dir: 1, zMax: 2.0, count: 160, seed: 30, alpha: 0.28 + 0.4 * fl, speed: 8, zNear: 0.8, zFar: 7.5, width: 1.4, color: '200,214,240' });
    ctx.restore();
    // 6) light: the flash wash, a heart-beat throb at the edges
    if (fl > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(200,216,250,${(0.12 * fl).toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = clamp(0.62 + 0.38 * beat); ctx.drawImage(vignette('c29', 0.36, 1.0, '4,6,14', 0.72), 0, 0); ctx.restore();
  } });

  /* ====================================================================== C30 */
  // 105.5 the impact (white flash, the world rolls over) → stills switched by lightning strobes, from HIS eyes
  // (on his back): the storm sky / her backlit silhouette astride him, fist raised / the strike (smear, impact
  // frame) / three ever closer stills while she screams / 109.5 the lightning whites out the frame.
  const C30 = {
    land: 0.36,
    strobes: [[0.4, 0.3, 1], [0.6, 0.2, 1], [0.7, 0.16, 0.75], [1.92, 0.34, 0.8], [3.12, 0.32, 0.85], [4.0, 0.42, 1]],
    hit: 0.745,
  };
  // the storm sky straight overhead: domain-warped cloud masses (dark), and the same masses lit from inside
  function overheadSky(lit) {
    return PV.cached('g08:ovsky2' + (lit ? 'L' : 'D'), 480, 270, (c) => {
      const w = 480, h = 270, img = c.createImageData(w, h), D = img.data;
      const dens = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const nx = x / h, ny = y / h, wx = 0.35 * PV.fbm2(nx * 1.2 + 9.1, ny * 1.2 + 2.3, 2);
        dens[y * w + x] = sm(-0.25, 0.45, PV.fbm2(nx * 2.1 + wx, ny * 2.1 - wx, 5));
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, d = dens[i], dx = dens[Math.min(w * h - 1, i + 3)] - dens[Math.max(0, i - 3)], dy = dens[Math.min(w * h - 1, i + 3 * w)] - dens[Math.max(0, i - 3 * w)];
        const edge = clamp(Math.hypot(dx, dy) * 2.2), thin = 1 - d, i4 = i * 4;
        let col;
        if (lit) { const v = clamp(0.25 + 0.75 * Math.pow(thin, 0.8) + 0.35 * edge); col = [lerp(52, 238, v), lerp(64, 243, v), lerp(98, 255, v)]; }
        else { const v = clamp(0.15 + 0.55 * thin + 0.25 * edge); col = [lerp(6, 40, v), lerp(9, 50, v), lerp(18, 78, v)]; }
        D[i4] = col[0]; D[i4 + 1] = col[1]; D[i4 + 2] = col[2]; D[i4 + 3] = 255;
      }
      c.putImageData(img, 0, 0);
      const tmp = PV.makeCanvas(w, h); tmp.ctx.drawImage(c.canvas, 0, 0); c.filter = 'blur(1.2px)'; c.drawImage(tmp.canvas, 0, 0); c.filter = 'none';
    });
  }
  // the bridge seen from the deck, looking straight up: the tower converging into the sky and its stay cables
  function towerFromBelow(ctx, o) {
    const top = o.top, fl = o.fl || 0;
    ctx.save(); ctx.lineCap = 'round';
    const nC = o.n || 13;
    for (let i = 0; i < nC; i++) {
      const f = i / (nC - 1), a0 = [top[0] + (o.base[0] - top[0]) * (0.02 + 0.16 * f), top[1] + (o.base[1] - top[1]) * (0.02 + 0.16 * f)];
      const ang = lerp(o.fan[0], o.fan[1], f), L2 = 2600, a1 = [a0[0] + cos(ang) * L2, a0[1] + sin(ang) * L2];
      ctx.strokeStyle = '#05080f'; ctx.lineWidth = lerp(3, 9, f); ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
      if (fl > 0.02) { ctx.strokeStyle = `rgba(207,220,255,${(0.55 * fl).toFixed(3)})`; ctx.lineWidth = lerp(1, 2.2, f); ctx.beginPath(); ctx.moveTo(a0[0] - 2, a0[1] - 2); ctx.lineTo(a1[0] - 2, a1[1] - 2); ctx.stroke(); }
    }
    const b = o.base, wb = o.wb, wt = o.wt, dx = top[0] - b[0], dy = top[1] - b[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
    ctx.fillStyle = '#04070d'; ctx.beginPath(); ctx.moveTo(b[0] + nx * wb, b[1] + ny * wb); ctx.lineTo(top[0] + nx * wt, top[1] + ny * wt); ctx.lineTo(top[0] - nx * wt, top[1] - ny * wt); ctx.lineTo(b[0] - nx * wb, b[1] - ny * wb); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(207,220,255,${(0.25 + 0.6 * fl).toFixed(3)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(b[0] + nx * wb, b[1] + ny * wb); ctx.lineTo(top[0] + nx * wt, top[1] + ny * wt); ctx.stroke();
    // the red aviation beacon on the tower head (black-out: battery powered, the only light)
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5 + 0.4 * sin(o.t * 2.4); ctx.drawImage(dotSprite('#ff5a4a'), top[0] - 26, top[1] - 26, 52, 52); ctx.globalAlpha = 1;
    ctx.restore();
  }
  // his view straight up from the deck (sky, tower, cables), painted once per light state into a full-frame cache:
  // the stills only blit it (dark, then the lit version on top with the flash strength)
  const SKM = 90;   // margin of the sky caches (the stills crop them 1:1 at different offsets)
  function c30SkyCache(kind, lit) {
    return PV.cached('g08:c30sky:' + kind + (lit ? 'L' : 'D'), W + 2 * SKM, H + 2 * SKM, (c) => {
      const fl = lit ? 1 : 0; c.translate(SKM, SKM);
      c.drawImage(overheadSky(lit), -60, -40, W + 120, H + 80);
      if (kind === 'sky') {
        if (lit) { c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.55; c.drawImage(dotSprite('#cfe0ff'), 820 - 560, 300 - 560, 1120, 1120); c.restore(); }
        towerFromBelow(c, { top: [1430, 150], base: [2050, 1250], wb: 120, wt: 26, fan: [2.2, 3.6], fl, t: 0 });
      } else {
        if (lit) { c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.6; c.drawImage(dotSprite('#d6e4ff'), 960 - 640, 230 - 560, 1280, 1120); c.restore(); }
        c.save(); c.globalAlpha = 0.45; towerFromBelow(c, { top: [2150, -120], base: [2650, 1300], wb: 140, wt: 30, fan: [2.75, 3.15], fl: fl * 0.5, t: 0, n: 6 }); c.restore();
      }
    });
  }
  /* HER, astride him, seen from below (his eyes): face down toward the lens, the long wet hair hanging toward him.
   * Gravity points at the camera, so every lock radiates from the zenith vanishing point (above her head) and grows
   * as it nears the lens. Units: head units around her head centre. o.arm: 'raised' | 0..1 (strike) | 'rest'. */
  const VPY = -2.3;   // the zenith vanishing point, in her head units (above her head)
  // her hair from below: on each side a curtain that hugs the head, frames the face (covering the cheeks) and widens
  // toward the lens, splitting at its lower edge into wet pointed clumps; behind it a few clumps fall past the far side
  // of the shoulders; thin strays escape. Everything radiates from the zenith VP (it is all hanging toward him).
  function c30Hair(t, o) {
    const sw = (o.sway || 0) * 0.03, side = [], back = [], strays = [];
    for (const s of [-1, 1]) {
      const ph = t * 1.6 + (s > 0 ? 1.1 : 0), wb = sw * sin(ph);
      const outer = [[s * 0.1, -0.64], [s * 0.36, -0.55], [s * 0.5, -0.3], [s * 0.54, 0.08], [s * 0.6, 0.6], [s * 0.74 + wb * 0.5, 1.25], [s * 0.88 + wb, 1.95]];
      const tips = [];
      for (let j = 0; j < 5; j++) {
        const r = R1(j + (s > 0 ? 10 : 0), 571), r2 = R1(j + (s > 0 ? 10 : 0), 572);
        const x = s * (0.86 - 0.12 * j) + wb * (1 - 0.15 * j), y = 2.0 + 0.55 * r - 0.08 * j;
        tips.push([x, y, 1]); tips.push([s * (0.8 - 0.12 * j - 0.02) + wb * 0.8, 1.55 + 0.25 * r2]);
      }
      tips.pop();
      const inner = [[s * 0.33, 1.45], [s * 0.3, 0.92], [s * 0.31, 0.56], [s * 0.36, 0.2], [s * 0.36, -0.14], [s * 0.3, -0.38], [s * 0.1, -0.47]];
      side.push({ s, pts: outer.concat(tips, inner) });
      for (let j = 0; j < 3; j++) {   // behind: past the far side of the shoulders
        const r = R1(j + (s > 0 ? 20 : 0), 573), x0 = s * (0.4 + 0.05 * j), y0 = -0.25 + 0.2 * j, m = 1.6 + 0.5 * r;
        const tip = [x0 * m + s * (0.35 + 0.15 * j), VPY + (y0 - VPY) * m];
        back.push({ s, pts: [[x0, y0], [lerp(x0, tip[0], 0.5) + s * 0.1, lerp(y0, tip[1], 0.5)], tip], ws: [0.12, 0.13 + 0.04 * r, 0.004] });
      }
      for (let j = 0; j < 3; j++) {   // strays crossing the curtain edge
        const r = R1(j + (s > 0 ? 30 : 0), 574), x0 = s * (0.44 + 0.04 * j), y0 = -0.2 + 0.25 * j, m = 1.5 + 0.6 * r;
        strays.push({ s, p0: [x0, y0], p2: [x0 * m + s * 0.25 * r + wb, VPY + (y0 - VPY) * m], c: s * (0.1 + 0.1 * r) });
      }
    }
    return { side, back, strays };
  }
  function herArm2(k) {   // left arm (screen right): 0 raised beside her head → 1 the fist on his chest (near the lens)
    const e = E.inCubic(clamp(k));
    return { Sh: [1.06, 1.12], El: [lerp(1.55, 1.36, e), lerp(0.4, 2.3, e)], Wr: [lerp(1.32, 1.08, e), lerp(-0.4, 3.3, e)], fr: lerp(0.19, 0.5, e) };
  }
  function herFromBelow(ctx, t, o) {
    const br = o.breath || 0, fl = o.flash || 0;
    const HR = c30Hair(t, { sway: o.sway === undefined ? 1 : o.sway });
    const shY = 1.08 - 0.07 * br;                                  // her shoulders heave
    const k = o.arm === 'raised' ? 0 : o.arm === 'rest' ? 1 : clamp(o.arm);
    const A = herArm2(k);
    const face = [[0, -0.42], [0.3, -0.36], [0.37, -0.12], [0.35, 0.12], [0.27, 0.3], [0.14, 0.44], [0, 0.52], [-0.14, 0.44], [-0.27, 0.3], [-0.35, 0.12], [-0.37, -0.12], [-0.3, -0.36]];
    L.figureRender(ctx, o, null, (F) => {
      // 1) the back of her head (a smooth dome; we look at it from below) and the hair falling past her far shoulders
      F.layer({}, (c) => {
        c.beginPath(); c.ellipse(0, -0.08, 0.5, 0.58, 0, 0, TAU); c.fill();
        c.beginPath(); for (const b of HR.back) ribbon(c, b.pts, b.ws); c.fill();
      });
      // 2) shoulders and chest (the wet hospital gown), foreshortened toward her hips at the bottom of the frame
      F.layer({ fill: F.tone(0.14, '#5c6c94'), inner: 0.45 }, (c) => {
        blob(c, [[-0.16, 0.62], [-0.42, shY - 0.2], [-0.86, shY - 0.1], [-1.14, shY + 0.04], [-1.27, shY + 0.32], [-1.22, 1.9], [-1.06, 3.1], [-1.0, 4.6, 1],
                 [1.0, 4.6, 1], [1.06, 3.1], [1.22, 1.9], [1.27, shY + 0.32], [1.14, shY + 0.04], [0.86, shY - 0.1], [0.42, shY - 0.2], [0.16, 0.62]]);
      });
      // 3) the neck (the throat, from below) and her face, turned down to him: in shadow, lighter than the hair
      F.layer({ fill: F.tone(0.18, '#7080a8') }, (c) => { limb(c, [0, 0.4], [0, 0.95], 0.13, 0.16); blob(c, face); });
      F.raw((c) => { // the wet deck below mirrors the storm light: a faint cool underlight on the chin and throat (no features)
        c.save(); c.globalCompositeOperation = 'source-atop';
        const g = c.createRadialGradient(0, 0.62, 0.05, 0, 0.45, 0.55); g.addColorStop(0, PV.rgba('#9fb2de', 0.16 + 0.22 * fl)); g.addColorStop(1, PV.rgba('#9fb2de', 0));
        c.fillStyle = g; c.fillRect(-0.6, -0.1, 1.2, 1.2);
        const g2 = c.createLinearGradient(-0.4, 0, 0.25, 0); g2.addColorStop(0, 'rgba(4,6,12,0.32)'); g2.addColorStop(1, 'rgba(4,6,12,0)');
        c.fillStyle = g2; c.fillRect(-0.45, -0.5, 0.7, 1.5); c.restore();
      });
      // 4) the fringe: wet pointed clumps over her forehead and eyes
      F.layer({ inner: 0.35 }, (c) => {
        c.beginPath();
        for (let q = 0; q < 6; q++) {
          const x = -0.31 + 0.62 * q / 5 + 0.03 * (R1(q, 531) - 0.5), y0 = -0.46 + 0.12 * Math.pow(Math.abs(x) / 0.36, 2);
          const len = 0.3 + 0.16 * R1(q, 532) - 0.06 * Math.abs(x), dx = x * 0.14 + 0.012 * sin(t * 1.6 + q);
          ribbon(c, [[x * 0.95, y0], [x + dx * 0.5, y0 + len * 0.55], [x + dx, y0 + len]], [0.085, 0.06, 0.004]);
        }
        ribbon(c, [[-0.24, -0.12], [-0.27, 0.12], [-0.2, 0.36], [-0.13, 0.5]], [0.022, 0.018, 0.012, 0.003]);   // wet strands stuck to her cheeks
        ribbon(c, [[0.2, -0.16], [0.25, 0.06], [0.22, 0.3]], [0.018, 0.014, 0.003]);
        c.fill();
      });
      // 5) the white cast in its sling across her chest (her right forearm, elbow at her right side = screen left)
      if (o.cast !== false) F.raw((c) => {
        c.save(); c.lineCap = 'round';
        const El = [-1.08, 1.66], Wr = [0.12, 1.46];
        c.fillStyle = PV.mix('#202838', '#56627e', 0.3 + 0.7 * fl);            // the sling pouch under the cast
        c.beginPath(); c.moveTo(El[0] - 0.12, El[1] - 0.05); c.quadraticCurveTo(-0.45, 2.12, Wr[0] + 0.22, Wr[1] + 0.22); c.lineTo(Wr[0] + 0.12, Wr[1] + 0.05); c.quadraticCurveTo(-0.45, 1.86, El[0], El[1] - 0.12); c.closePath(); c.fill();
        const g = c.createLinearGradient(0, 1.32, 0, 1.86); g.addColorStop(0, PV.mix('#b1bcd4', '#f2f6ff', fl)); g.addColorStop(0.5, PV.mix('#7a87a2', '#d2dcf0', fl)); g.addColorStop(1, PV.mix('#2a3348', '#7c89a4', fl));
        c.fillStyle = g; c.beginPath();                               // a tapered plaster cylinder, rounded at the elbow
        const dx = Wr[0] - El[0], dy = Wr[1] - El[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l, r0 = 0.2, r1 = 0.14;
        c.moveTo(El[0] + nx * r0, El[1] + ny * r0); c.lineTo(Wr[0] + nx * r1, Wr[1] + ny * r1); c.lineTo(Wr[0] - nx * r1, Wr[1] - ny * r1); c.lineTo(El[0] - nx * r0, El[1] - ny * r0);
        c.arc(El[0], El[1], r0, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false); c.closePath(); c.fill();
        c.strokeStyle = PV.rgba('#2a3348', 0.35); c.lineWidth = 0.012;   // wraps of the bandage
        for (const f of [0.3, 0.55, 0.78]) { const x = lerp(El[0], Wr[0], f), y = lerp(El[1], Wr[1], f), rr = lerp(r0, r1, f); c.beginPath(); c.moveTo(x + nx * rr, y + ny * rr); c.quadraticCurveTo(x + 0.04, y, x - nx * rr, y - ny * rr); c.stroke(); }
        c.fillStyle = PV.mix('#141a28', '#39445e', fl);               // her fingers peeking out of the cast
        for (let q = 0; q < 4; q++) { c.beginPath(); c.ellipse(Wr[0] + 0.1 + 0.02 * q, Wr[1] - 0.09 + 0.06 * q, 0.06, 0.028, 0.2, 0, TAU); c.fill(); }
        c.strokeStyle = PV.mix('#384360', '#a3b0cc', fl); c.lineWidth = 0.035;   // the strap from the pouch up round her neck
        c.beginPath(); c.moveTo(Wr[0] + 0.05, Wr[1] - 0.05); c.quadraticCurveTo(0.3, 1.0, 0.13, 0.82); c.stroke();
        c.restore();
      });
      // 6) her left arm and fist (screen right): raised, striking, or resting on his chest (near the lens: big)
      if (o.arm !== 'hidden') F.layer({ fill: F.tone(0.12, '#5c6c94'), inner: 0.7 }, (c) => {
        limb(c, A.Sh, A.El, 0.2, 0.15); limb(c, A.El, A.Wr, 0.15, 0.12 + 0.12 * k);
        const fx = A.Wr[0] - 0.02, fy = A.Wr[1] + A.fr * 0.45 * (k > 0.5 ? 1 : -1);
        c.beginPath(); c.ellipse(fx, fy, A.fr, A.fr * 1.08, -0.25, 0, TAU); c.fill();
        for (let q = 0; q < 4; q++) { const a = (k > 0.5 ? 1.0 : -2.5) + q * 0.42; c.beginPath(); c.arc(fx + cos(a) * A.fr * 0.82, fy + sin(a) * A.fr * 0.86, A.fr * 0.3, 0, TAU); c.fill(); }
      });
      // 7) the near curtains framing her face, hanging in front of her shoulders toward the lens; stray strands
      F.layer({ inner: 0.55 }, (c) => {
        c.beginPath(); for (const sd of HR.side) spline(c, sd.pts, true); c.fill();
        c.lineWidth = 0.014; c.beginPath(); for (const st of HR.strays) { c.moveTo(st.p0[0], st.p0[1]); c.quadraticCurveTo(lerp(st.p0[0], st.p2[0], 0.5) + st.c, lerp(st.p0[1], st.p2[1], 0.5), st.p2[0], st.p2[1]); } c.stroke();
      });
      // 8) wet sheen: long broken highlights along the flow of the curtains (catch the flash)
      F.raw((c) => {
        c.save(); c.globalCompositeOperation = 'source-atop'; c.lineCap = 'round'; c.lineWidth = 0.012;
        for (const sd of HR.side) for (let q = 0; q < 4; q++) {
          const s = sd.s, x0 = s * (0.4 + 0.05 * q), a = (0.12 + 0.4 * fl) * (0.6 + 0.4 * R1(q + (s > 0 ? 5 : 0), 581));
          c.strokeStyle = PV.rgba('#dfe9ff', a); c.beginPath(); c.moveTo(x0, -0.1 + 0.15 * q); c.quadraticCurveTo(s * (0.5 + 0.08 * q), 0.6, s * (0.55 + 0.1 * q), 1.2 + 0.2 * q); c.stroke();
        }
        c.restore();
      });
    });
    return { locks: HR.side.map((sd) => ({ tip: sd.pts[7 + 2 * Math.floor(R1(sd.s > 0 ? 1 : 2, 591) * 3)], s: sd.s, id: sd.s })).concat(HR.side.map((sd) => ({ tip: sd.pts[11], s: sd.s, id: sd.s * 2 }))), A, k };
  }
  // drops falling from the tips of her hair (and her chin) toward his face: they come at the camera (grow, fly outward)
  function c30Drips(ctx, t, o, locks) {
    const u = 92 * o.scale, vx = o.x, vy = o.y + VPY * u;
    ctx.save(); ctx.lineCap = 'round';
    const srcs = locks.map((lk) => lk.tip);
    srcs.forEach((tp, i) => {
      const per = 0.7 + 0.6 * R1(i, 522), k = (((t + R1(i, 523) * per) % per) + per) % per / per;
      const x0 = o.x + tp[0] * u, y0 = o.y + tp[1] * u;
      if (k < 0.35) { const r = 2.5 + 5 * (k / 0.35); ctx.fillStyle = `rgba(190,206,236,${(0.45 + 0.4 * (o.flash || 0)).toFixed(3)})`; ctx.beginPath(); ctx.arc(x0, y0 + r * 0.6, r, 0, TAU); ctx.fill(); return; }
      const kk = (k - 0.35) / 0.65, z = 1 / (1 - 0.8 * kk * kk), z2 = 1 / (1 - 0.8 * Math.max(0, kk - 0.07) ** 2);
      const dx = (x0 - vx) * z + vx, dy = (y0 - vy) * z + vy, dx2 = (x0 - vx) * z2 + vx, dy2 = (y0 - vy) * z2 + vy;
      ctx.strokeStyle = `rgba(200,214,240,${(0.32 + 0.4 * (o.flash || 0)).toFixed(3)})`; ctx.lineWidth = 4 * z; ctx.beginPath(); ctx.moveTo(dx2, dy2); ctx.lineTo(dx, dy); ctx.stroke();
    });
    ctx.restore();
  }
  // which strobe still is on screen
  function c30Frame(t) {
    if (t < C30.land) return 'tumble';
    if (t < 0.6) return 'sky';
    if (t < 0.7) return 'raised';
    if (t < C30.hit) return 'smear';
    if (t < C30.hit + 0.085) return 'impact';
    if (t < 1.92) return 'D1';
    if (t < 3.12) return 'D2';
    if (t < 4.0) return 'D3';
    return 'E';
  }
  const c30FigCache = { key: null, res: null };
  const C30F = { raised: [1.0, 420, 420], D1: [1.0, 420, 420], smear: [1.0, 420, 420], impact: [1.0, 420, 420], D2: [1.26, 420, 440, [-60, 30]], D3: [1.55, 420, 470, [50, 60]], E: [1.8, 420, 520, [-20, 80]] };
  PV.shot('C30', { draw(ctx, tIn, d) {
    const t = cutT(tIn, d), fr = c30Frame(t);
    const fl = flashOf(t, C30.strobes);
    // impact shakes: landing on his back, the fist on his chest
    const shk = (t0, a, dk) => (t > t0 ? a * Math.exp(-(t - t0) / dk) : 0);
    const amp = shk(C30.land, 34, 0.09) + shk(C30.hit, 30, 0.07);
    const sx = amp * N2(t * 40, 3), sy = amp * N2(5, t * 40);
    ctx.save(); ctx.translate(sx, sy);
    if (fr === 'tumble') {
      // the world rolls over: a pre-blurred view of the deck and the sky spun with an accumulation blur (no moiré)
      const k = clamp(t / C30.land), ek = E.outCubic(k), rot = (1 - ek) * 2.6, zoom = lerp(1.6, 1.05, ek);
      const src = PV.cached('g08:c30tumbleSrc', W / 4, H / 4, (c) => {
        c.drawImage(c30SkyCache('sky', false), SKM, SKM, W, H, 0, 0, W / 4, H / 4);
        const g = c.createLinearGradient(0, H / 8, 0, H / 4); g.addColorStop(0, 'rgba(4,6,12,0)'); g.addColorStop(0.35, 'rgba(6,9,16,0.95)'); g.addColorStop(1, 'rgba(10,14,24,1)');
        c.fillStyle = g; c.fillRect(0, 0, W / 4, H / 4);
        c.fillStyle = 'rgba(190,200,225,0.55)'; for (let i = -2; i < 6; i++) c.fillRect(60 + i * 70, H / 4 - 30, 34, 5);   // lane marks
        const tmp = PV.makeCanvas(W / 4, H / 4); tmp.ctx.filter = 'blur(3px)'; tmp.ctx.drawImage(c.canvas, 0, 0); c.clearRect(0, 0, W / 4, H / 4); c.drawImage(tmp.canvas, 0, 0);
      });
      const om = 2.6 * 3 * Math.pow(1 - k, 2) / C30.land / 24;     // rad per frame
      const acc = buf('c30acc', W / 4, H / 4), ac = acc.ctx; ac.fillStyle = '#0b1020'; ac.fillRect(0, 0, W / 4, H / 4);
      for (let i = 0; i < 7; i++) { ac.save(); ac.globalAlpha = i === 0 ? 1 : 0.32; ac.translate(W / 8, H / 8); ac.rotate(rot + om * i / 6); ac.scale(zoom * 1.5, zoom * 1.5); ac.translate(-W / 8, -H / 8); ac.drawImage(src, 0, 0); ac.restore(); }
      ctx.imageSmoothingQuality = 'low'; ctx.drawImage(acc.canvas, 0, 0, W, H);
    } else if (fr === 'sky') {
      const z = 1 + 0.02 * (t - C30.land);
      ctx.save(); PV.camera(ctx, { zoom: z });
      ctx.drawImage(c30SkyCache('sky', false), -SKM, -SKM);
      if (fl > 0.01) { ctx.globalAlpha = clamp(fl); ctx.drawImage(c30SkyCache('sky', true), -SKM, -SKM); ctx.globalAlpha = 1; }
      if (fl > 0.05) L.lightning(ctx, L.lightningPath(3001, 120, 220, 1500, 520, 0.4, 8), clamp(fl * 1.1), '#e9f1ff');
      ctx.restore();
      rainAxial(ctx, t, { vp: [860, 360], dir: -1, count: 220, seed: 301, alpha: 0.3 + 0.5 * fl, speed: 7, zNear: 0.8, zFar: 7, color: '200,214,240' });
    } else {
      // her, astride him, against the storm sky. Each strobe is a new, closer still; she pants between them.
      const fz = C30F[fr], tt = Math.floor(t * 12) / 12;          // her figure moves on twos (2-koma)
      const breath = 0.5 + 0.5 * sin(tt * 8.2) * (0.6 + 0.4 * N2(tt * 1.3, 7));
      const head = [960, fz[1] - 10 * breath], sc = 2.0;
      const cam = { zoom: fz[0], cx: 960, cy: fz[2] };
      // the sky: each strobe still is its own framing → a different 1:1 crop of the cached sky (no scaled blit)
      const amb = Math.max(fl, 0.14), off = fz[3] || [0, 0];
      ctx.drawImage(c30SkyCache('her', false), off[0] - SKM, off[1] - SKM);
      ctx.globalAlpha = clamp(amb); ctx.drawImage(c30SkyCache('her', true), off[0] - SKM, off[1] - SKM); ctx.globalAlpha = 1;
      ctx.save(); PV.camera(ctx, cam);
      if (fl > 0.25 && (fr === 'D1' || fr === 'D3' || fr === 'raised')) L.lightning(ctx, L.lightningPath(fr === 'D3' ? 3013 : 3011, 1700, 80, 260, 320, 0.42, 8), clamp(fl), '#e9f1ff');
      rainAxial(ctx, t, { vp: [960, head[1] + VPY * 92 * sc], dir: -1, zMin: 2.2, count: 260, seed: 302, alpha: 0.3 + 0.5 * fl, speed: 7, zNear: 0.8, zFar: 7, color: '200,214,240' });
      let arm = 'rest';
      if (fr === 'raised') arm = 'raised'; else if (fr === 'smear') arm = 0.8;
      const fo = { x: head[0], y: head[1], scale: sc, light: -HP, rimColor: '#dfe9ff', rim: fr === 'E' ? 1.8 : 1.2, backlight: clamp(0.4 + 0.6 * fl + (fr === 'E' ? 0.25 : 0)), glow: 0.5 + 0.5 * fl, fill: '#0a0e18', breath, flash: fl, arm, sway: 1, fps: 12 };
      if (fr === 'smear') {
        // ONE smear frame: the fist already half-way down (big, near the lens), its trail stretched back up to where it
        // was raised, plus speed lines along the path
        const u = 92 * sc, a0 = herArm2(0), a1 = herArm2(0.8), P0 = [head[0] + a0.Wr[0] * u, head[1] + (a0.Wr[1] - 0.1) * u], P1 = [head[0] + a1.Wr[0] * u, head[1] + (a1.Wr[1] + 0.2) * u];
        const dx = P1[0] - P0[0], dy = P1[1] - P0[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l, w0 = 0.06 * u, w1 = 0.42 * u;
        const g = ctx.createLinearGradient(P0[0], P0[1], P1[0], P1[1]); g.addColorStop(0, 'rgba(10,14,24,0)'); g.addColorStop(0.55, 'rgba(10,14,24,0.7)'); g.addColorStop(1, 'rgba(10,14,24,0.96)');
        ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(P0[0] + nx * w0, P0[1] + ny * w0); ctx.quadraticCurveTo((P0[0] + P1[0]) / 2 + nx * w1 * 1.1 + 0.25 * u, (P0[1] + P1[1]) / 2 + ny * w1, P1[0] + nx * w1, P1[1] + ny * w1);
        ctx.lineTo(P1[0] - nx * w1, P1[1] - ny * w1); ctx.quadraticCurveTo((P0[0] + P1[0]) / 2 - nx * w1 * 0.6 + 0.25 * u, (P0[1] + P1[1]) / 2 - ny * w1 * 0.6, P0[0] - nx * w0, P0[1] - ny * w0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(223,233,255,0.5)'; ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) { const f = (i + 0.5) / 9, o2 = (f - 0.5) * 2 * w1 * 1.3, x = P0[0] + dx * 0.15 + nx * o2 + 0.25 * u * sin(PI * 0.5), y = P0[1] + dy * 0.15 + ny * o2, L2 = l * (0.45 + 0.4 * R1(i, 541));
          ctx.lineWidth = 2 + 3 * R1(i, 542); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx / l * L2, y + dy / l * L2); ctx.stroke(); }
        ctx.restore();
      }
      // the figure layer is cached by its full input key (time on twos, flash in 1/20 steps): any render order gives
      // the same pixels, a sequential render redraws it only every other frame
      fo.flash = Math.round(fl * 20) / 20; fo.backlight = clamp(0.4 + 0.6 * fo.flash + (fr === 'E' ? 0.25 : 0)); fo.glow = 0.5 + 0.5 * fo.flash;
      const key = fr + '|' + tt.toFixed(4) + '|' + fo.flash + '|' + arm, fb = PV.buffer('g08:c30fig', W + 2 * MG, H + 2 * MG);
      let res = c30FigCache.key === key ? c30FigCache.res : null;
      if (!res) { fb.ctx.clearRect(0, 0, W + 2 * MG, H + 2 * MG); fb.ctx.save(); fb.ctx.translate(MG, MG); PV.camera(fb.ctx, cam); res = herFromBelow(fb.ctx, tt, fo); fb.ctx.restore(); c30FigCache.key = key; c30FigCache.res = res; }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(sx, sy); ctx.drawImage(fb.canvas, MG, MG, W, H, 0, 0, W, H); ctx.restore();
      c30Drips(ctx, t, { x: head[0], y: head[1], scale: sc, flash: fl }, res.locks);
      ctx.restore();
      // rain between them (near, toward the lens)
      rainAxial(ctx, t, { vp: [960, (head[1] + VPY * 92 * sc - fz[2]) * fz[0] + fz[2]], dir: -1, zMax: 2.2, count: 150, seed: 303, alpha: 0.4 + 0.4 * fl, speed: 7, zNear: 0.8, zFar: 7, width: 1.5, color: '206,218,242' });
      if (fr === 'impact') {
        // the impact frame: two frames of a stark negative — white world, her black silhouette, speed lines to the hit
        ctx.save(); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#e8eeff'; ctx.fillRect(0, 0, W, H); ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore();
        const hx = 1080, hy = 1150; ctx.save(); ctx.strokeStyle = 'rgba(10,12,20,0.75)'; ctx.lineCap = 'round';
        for (let i = 0; i < 40; i++) { const a = R1(i, 551) * TAU, r0 = 260 + 300 * R1(i, 552), r1 = r0 + 500 + 900 * R1(i, 553); ctx.lineWidth = 2 + 6 * R1(i, 554); ctx.beginPath(); ctx.moveTo(hx + cos(a) * r0, hy + sin(a) * r0); ctx.lineTo(hx + cos(a) * r1, hy + sin(a) * r1); ctx.stroke(); }
        ctx.restore();
      }
    }
    ctx.restore();
    // light: flash wash; the white-out of the scream (109.5)
    if (fl > 0.01 && fr !== 'impact') { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(206,220,255,${(0.18 * fl).toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    const wo = t >= 4.0 ? Math.exp(-(t - 4.0) / 0.14) : 0;
    if (wo > 0.01) { ctx.fillStyle = `rgba(245,248,255,${clamp(wo).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    if (fr !== 'impact') ctx.drawImage(vignette('c30', 0.3, 1.0, '3,5,10', 0.55), 0, 0);
  } });

  /* ====================================================================== C31 */
  // One low side view, the camera almost on the wet deck. He lies on his back (head to the right); she has
  // collapsed onto his chest, motionless (原作「被さる身体はピクリともしない」), her face hidden, her long wet hair
  // poured over his shoulder onto the road. The rain falls slowly. 115.0 she raises her upper body and throws her
  // head back to the sky; the camera follows her up (slow tilt + pan). 115.82 the lightning behind her.
  // World units: head units (u px at zoom 1), origin = the road under his hips, x toward his head.
  const C31 = { flash: [[0.0, 0.5, 0.3], [2.9, 0.4, 0.22], [5.82, 0.45, 1], [6.3, 0.3, 0.5]], u: 184, hip: [0.35, -1.06] };
  const C31BM = [180, 290];   // backdrop cache margins (the camera pans left/up across it)
  function c31Cam(t) {
    const k = E.inOutCubic(clamp((t - 5.05) / 1.35));     // static while she lies on him (storyboard: static → slow tilt up)
    return { fx: lerp(2.6, 0.45, k), fy: lerp(-1.3, -2.75, k), z: lerp(1.3, 1.1, k), k };
  }
  // the storm behind them (sky, clouds lit from inside, the bridge tower, the far railing on the horizon), painted
  // once per light state into a margin-padded cache; the far backdrop follows the camera with parallax, unscaled
  function c31Backdrop(lit) {
    return PV.cached('g08:c31bd' + (lit ? 'L' : 'D'), W + 200, H + 310, (c) => {
      const fl = lit ? 1 : 0, hz = C31BM[1] + 786;
      c.save(); c.translate(C31BM[0] - 140, 0);
      L.skyDome(c, 0, { preset: 'storm', horizon: hz, seed: 31, haze: 0.65, hazeColor: '#3a4868', hazeH: 320, x0: -200, x1: W + 400 });
      c.save(); c.scale(1.12, 1.12); L.stormClouds(c, 0, { y: 0, h: hz / 1.12 + 40, seed: 31, flash: fl, flashX: 950, flashY: 300, flashR: 900, speed: 0 }); c.restore();
      L.skyline(c, { seed: 33, y: hz - 22, hMin: 8, hMax: 46, wMin: 30, wMax: 110, color: '#0c1220', gap: 2, x0: -200, x1: W + 400 });
      L.bridge(c, { x0: -500, x1: W + 600, y: hz - 20, towerH: 900, lw: 8, night: true, t: 0, cables: 12, pierH: 0, span: 980, flash: fl, lamps: 0, uplight: 0.04, color: '#141b2e', shadow: '#0a0f1c', rim: '#cfdcff', rimAmt: 0.25 + 0.75 * fl, towers: [1720] });
      c.fillStyle = '#070b14'; c.fillRect(-300, hz - 70, W + 900, 8); c.fillRect(-300, hz - 28, W + 900, 7);   // the far railing
      for (let x = -300; x < W + 600; x += 58) c.fillRect(x, hz - 70, 7, 52);
      c.fillStyle = `rgba(200,214,245,${(0.16 + 0.5 * fl).toFixed(3)})`; c.fillRect(-300, hz - 70, W + 900, 2);
      c.fillStyle = '#080c16'; c.fillRect(-300, hz - 18, W + 900, 400);                                         // the deck beyond them
      if (lit) { c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.55; c.drawImage(dotSprite('#cfe0ff'), 1060 - 700, 330 - 620, 1400, 1240); }
      c.restore();
    });
  }
  // her pose: rise of the spine, the head thrown back, sobbing shoulders
  function c31HerPose(t) {
    return { R: E.inOutCubic(clamp((t - 5.0) / 1.15)), tilt: E.inOutCubic(clamp((t - 5.4) / 0.95)), sob: t > 5.9 ? Math.max(0, sin((t - 5.9) * 9.5)) * sm(5.9, 6.2, t) : 0 };
  }
  // both bodies in one figure pass (one silhouette, inner rims where she lies over him). o: figure options in px;
  // pz: pose. Returns world points for drips (hair tips).
  function c31Pair(ctx, t, o, pz) {
    const { R, tilt, sob } = pz, br = o.breath || 0;
    const H0 = C31.hip, phi = lerp(-0.25, -HP - 0.06, R) - 0.03 * sob, uS = [cos(phi), sin(phi)], nS = [-uS[1], uS[0]];
    const P = (a, n) => [H0[0] + uS[0] * a + nS[0] * n, H0[1] + uS[1] * a + nS[1] * n];
    const Lt = 2.0 + 0.03 * sob;
    const hAng = phi + lerp(0.95, -0.62, tilt) + 0.05 * sob, dH = [cos(hAng), sin(hAng)], nH = [-dH[1], dH[0]];
    const nb = P(Lt - 0.04, 0.04), hc = [nb[0] + dH[0] * 0.6, nb[1] + dH[1] * 0.6];
    const H2 = (a, b) => [hc[0] + dH[0] * a + nH[0] * b, hc[1] + dH[1] * a + nH[1] * b];
    const tips = [];
    L.figureRender(ctx, o, null, (F) => {
      // HIM on his back, head on the road to the right (face up, never acted), knees a little up, his near arm on the road
      F.layer({ fill: F.tone(0.04) }, (c) => {
        const ch = -1.12 - 0.025 * br;
        blob(c, [[-0.55, 0.0, 1], [-0.62, -0.52], [-0.3, -0.86], [0.4, -0.96], [1.2, -0.98], [1.9, ch + 0.04], [2.5, ch], [2.95, -1.02], [3.25, -0.82], [3.35, -0.55], [3.4, 0.0, 1]]);
        limb(c, [-0.4, -0.42], [-1.9, -0.56], 0.42, 0.27); limb(c, [-1.9, -0.56], [-3.3, -0.16], 0.26, 0.17);   // thigh, shin (knee a little up)
        blob(c, [[-3.5, 0.0, 1], [-3.48, -0.26], [-3.2, -0.3], [-2.9, -0.12], [-2.95, 0.0, 1]]);                    // shoe
        limb(c, [3.2, -0.62], [3.62, -0.6], 0.2, 0.18);                                                         // neck
        // head: the back of the skull on the road, the face turned up (brow, nose, chin as a soft line only)
        blob(c, [[3.55, -0.05], [3.5, -0.42], [3.58, -0.72], [3.68, -0.82], [3.76, -0.86], [3.84, -0.92], [3.9, -0.94], [3.97, -0.9], [4.08, -0.9], [4.22, -0.86], [4.38, -0.74], [4.48, -0.5], [4.44, -0.2], [4.24, 0.0]]);
        blob(c, [[4.28, -0.78], [4.5, -0.66], [4.66, -0.48], [4.78, -0.26], [4.84, -0.06], [4.6, -0.01], [4.36, -0.02], [4.3, -0.4]]);   // his hair spread on the road
        limb(c, [3.0, -0.72], [1.95, -0.24], 0.19, 0.15); limb(c, [1.95, -0.24], [0.95, -0.1], 0.15, 0.11);           // near arm on the road
        c.beginPath(); c.ellipse(0.78, -0.1, 0.17, 0.09, 0.1, 0, TAU); c.fill();
      });
      F.raw((c) => { // wet leather catches the storm light in thin streaks along his chest and sleeve
        const fl = o.flash || 0; c.save(); c.globalCompositeOperation = 'source-atop'; c.lineCap = 'round';
        c.strokeStyle = PV.rgba('#cfdcff', 0.14 + 0.4 * fl); c.lineWidth = 0.018;
        c.beginPath(); spline(c, [[0.6, -0.9], [1.4, -0.96], [2.3, -1.05]], false); c.stroke();
        c.beginPath(); spline(c, [[2.7, -0.72], [2.2, -0.42], [1.5, -0.22]], false); c.stroke();
        c.restore();
      });
      // HER far arm (hangs on the far side; seen once she sits up), then her body
      if (R > 0.05) F.layer({ fill: F.tone(0.08, '#5c6c94'), alpha: R }, (c) => { c.save(); c.globalAlpha = clamp(R * 1.5); limb(c, P(Lt - 0.12, -0.1), P(Lt - 1.05, -0.02), 0.13, 0.1); limb(c, P(Lt - 1.05, -0.02), P(Lt - 1.75, 0.2), 0.1, 0.08); c.restore(); });
      F.layer({ fill: F.tone(0.13, '#5c6c94'), inner: 0.5 }, (c) => {
        limb(c, [H0[0] - 0.05, H0[1] + 0.05], [-0.28, -0.14], 0.36, 0.2); limb(c, [-0.28, -0.14], [-1.45, -0.09], 0.19, 0.1);   // near thigh, knee on the road, shin
        // torso: the wet hospital gown, back (−n) and front (+n) contours from the hips to the shoulders
        const prof = [[-0.12, -0.38, 0.34], [0.45, -0.3, 0.27], [0.95, -0.29, 0.29], [1.35, -0.35, 0.37], [1.62, -0.36, 0.33], [1.85, -0.3, 0.22], [Lt - 0.02, -0.2, 0.14], [Lt + 0.08, -0.1, 0.1]];
        const pts = []; prof.forEach(([a, b]) => pts.push(P(a, b))); for (let i = prof.length - 1; i >= 0; i--) pts.push(P(prof[i][0], prof[i][2]));
        blob(c, pts);
        limb(c, nb, H2(-0.2, 0.05), 0.12, 0.12);                          // neck
        // head in profile (no mouth): buried by his neck at first, then thrown back to the sky
        blob(c, [H2(0.5, 0.0), H2(0.44, 0.27), H2(0.3, 0.39), H2(0.2, 0.41, 1), H2(0.14, 0.44), H2(0.03, 0.55, 1), H2(-0.05, 0.45), H2(-0.1, 0.47), H2(-0.16, 0.45), H2(-0.21, 0.47), H2(-0.29, 0.42), H2(-0.37, 0.3), H2(-0.42, 0.14), H2(-0.38, -0.04), H2(-0.3, -0.3), H2(-0.05, -0.46), H2(0.25, -0.42), H2(0.45, -0.24)]);
      });
      // her near arm: the cast in its sling across her belly (white), the upper arm down her side
      F.layer({ fill: F.tone(0.16, '#5c6c94'), inner: 0.6 * sm(0.2, 0.7, R) }, (c) => { limb(c, P(Lt - 0.12, -0.04), P(Lt - 0.95, 0.12), 0.17, 0.12); });
      F.raw((c) => {
        const fl = o.flash || 0, El = P(Lt - 0.98, 0.14), Wr = P(Lt - 0.86, 0.58); if (R < 0.12) return; c.save(); c.globalAlpha = sm(0.12, 0.55, R); c.lineCap = 'round';
        c.fillStyle = PV.mix('#232b40', '#5a6684', fl);                   // the sling pouch, sagging under the cast
        blob(c, [[El[0] - 0.02, El[1] + 0.02], P(Lt - 1.1, 0.34), [Wr[0] + 0.02, Wr[1] + 0.03, 1], P(Lt - 0.74, 0.34), P(Lt - 0.84, 0.12)]);
        const g = c.createLinearGradient(El[0], El[1] - 0.2, El[0], El[1] + 0.25); g.addColorStop(0, PV.mix('#b8c4dc', '#f2f6ff', fl)); g.addColorStop(1, PV.mix('#3a4560', '#8c99b6', fl));
        c.strokeStyle = g; c.lineWidth = 0.26; c.beginPath(); c.moveTo(El[0], El[1]); c.lineTo(Wr[0], Wr[1]); c.stroke();
        c.strokeStyle = PV.rgba('#2a3348', 0.35); c.lineWidth = 0.012;   // bandage wraps
        for (const f of [0.35, 0.65]) { const x = lerp(El[0], Wr[0], f), y = lerp(El[1], Wr[1], f); c.beginPath(); c.moveTo(x - uS[0] * 0.12, y - uS[1] * 0.12); c.lineTo(x + uS[0] * 0.12, y + uS[1] * 0.12); c.stroke(); }
        c.strokeStyle = PV.mix('#3c4762', '#9aa8c6', fl); c.lineWidth = 0.04;   // the strap up to her neck
        const nk = P(Lt - 0.02, 0.12), m = P(Lt - 0.5, 0.45); c.beginPath(); c.moveTo(Wr[0], Wr[1]); c.quadraticCurveTo(m[0], m[1], nk[0], nk[1]); c.stroke();
        c.restore();
      });
      // her wet hair. Collapsed: from her head it pours over his shoulder to the road and spreads on the wet asphalt
      // toward the lens. Risen: it hangs heavy down her back. (point-wise blend between the two drapes)
      const hairPaths = [];
      F.layer({ inner: 0.55 }, (c) => {
        c.beginPath(); c.ellipse(H2(0.1, -0.16)[0], H2(0.1, -0.16)[1], 0.5, 0.36, hAng, 0, TAU);   // the hair over the back of the skull (the profile stays clear)
        const n = 15, hx = hc[0];
        for (let i = 0; i < n; i++) {
          const f = i / (n - 1), r = R1(i, 311), r2 = R1(i, 312), sw = 0.025 * sin(t * 1.4 + i) * R;
          const root = H2(lerp(0.4, -0.3, f), lerp(-0.34, -0.06, f));
          // collapsed: over the crown and his shoulder, down to the road, then spread out on the wet asphalt
          const sx = hx + 0.1 + (f - 0.5) * 1.1, rd = [sx + 0.3 * (r - 0.5), -0.03];
          const lyA = [lerp(root[0], sx, 0.35) + 0.1, root[1] + 0.1], lyB = [sx + 0.08, lerp(root[1], 0, 0.55)], lyC = rd, lyD = [rd[0] + (f - 0.5) * 0.9 + 0.2 * (r - 0.5), 0.12 + 0.36 * r2];
          // risen: heavy, down her back
          const bx = root[0] - 0.08 - 0.12 * r;
          const upA = [bx - 0.03, root[1] + 0.45], upB = [bx - 0.07 - 0.05 * r, root[1] + 0.95], upC = [bx - 0.1 - 0.08 * r + sw, root[1] + 1.4 + 0.2 * r2], upD = [bx - 0.12 - 0.1 * r + sw, root[1] + 1.8 + 0.35 * r2];
          const k = E.inOut(clamp(R * 1.1 - 0.05 * f));
          const L3 = (a, b) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
          const ctrl = [root, L3(lyA, upA), L3(lyB, upB), L3(lyC, upC), L3(lyD, upD)];
          const pts = [], ws = [], w0 = 0.09 + 0.07 * r2;
          for (let j = 0; j <= 12; j++) {   // Catmull-Rom through the control points
            const q = j / 12 * 4, s0 = Math.min(3, Math.floor(q)), u = q - s0, p0 = ctrl[Math.max(0, s0 - 1)], p1 = ctrl[s0], p2 = ctrl[s0 + 1], p3 = ctrl[Math.min(4, s0 + 2)];
            const cr = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u * u + (-a + 3 * b - 3 * cc + d) * u * u * u);
            pts.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
            const qq = j / 12; ws.push(w0 * (0.85 + 0.7 * qq * (1 - k)) * Math.pow(1 - sm(0.74, 1, qq), 0.7) + 0.004);
          }
          ribbon(c, pts, ws); hairPaths.push({ pts, ws, i });
          if (r > 0.45) tips.push({ p: pts[12], lie: 1 - k, i });
        }
        c.fill();
      });
      F.raw((c) => { // wet sheen along some locks
        const fl = o.flash || 0; c.save(); c.globalCompositeOperation = 'source-atop'; c.strokeStyle = PV.rgba('#dfe9ff', 0.14 + 0.5 * fl); c.lineCap = 'round'; c.lineWidth = 0.014;
        for (const hp of hairPaths) { if (R1(hp.i, 318) < 0.55) continue; c.beginPath(); for (let j = 2; j < 9; j++) { const q = hp.pts[j]; if (j === 2) c.moveTo(q[0] + hp.ws[j] * 0.3, q[1]); else c.lineTo(q[0] + hp.ws[j] * 0.3, q[1]); } c.stroke(); }
        c.restore();
      });
    });
    return { tips, head: hc };
  }
  // slow rain: fat drops falling slowly (the world holding its breath), with glints in the flash
  function slowRain(ctx, t, o) {
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < o.count; i++) {
      const z = 0.4 + 0.6 * R1(i, o.seed), sp = o.speed * (0.6 + 0.4 * z), per = (H + 200) / sp, k = (((t + R1(i, o.seed + 1) * per) % per) + per) % per / per;
      const x = R1(i, o.seed + 2) * (W + 100) - 50 + 30 * k, y = -100 + k * (H + 200), len = (18 + 30 * z) * o.len;
      ctx.strokeStyle = `rgba(206,220,246,${((o.alpha + 0.4 * o.flash) * z).toFixed(3)})`; ctx.lineWidth = 1 + 1.4 * z;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 0.03 * len, y - len); ctx.stroke();
      if (z > 0.85) { ctx.fillStyle = `rgba(240,246,255,${(0.35 + 0.6 * o.flash).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + 1.2 * z, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  PV.shot('C31', { draw(ctx, tIn, d) {
    const t = cutT(tIn, d);
    const fl = flashOf(t, C31.flash), cm = c31Cam(t), u = C31.u * cm.z;
    const toS = (p) => [960 + (p[0] - cm.fx) * u, 540 + (p[1] - cm.fy) * u];
    // 1) the storm backdrop (far: parallax, unscaled 1:1 blits), its lit version with the flash
    const bx = (cm.fx - 2.6) * C31.u * 0.35, by = (cm.fy + 1.3) * C31.u * 1.1 * 0.85;
    ctx.drawImage(c31Backdrop(false), -C31BM[0] - bx, -C31BM[1] - by);
    if (fl > 0.01) { ctx.save(); ctx.globalAlpha = clamp(fl); ctx.drawImage(c31Backdrop(true), -C31BM[0] - bx, -C31BM[1] - by); ctx.restore(); }
    if (fl > 0.3) { const ox = -C31BM[0] - bx + 40, oy = -C31BM[1] - by; L.lightning(ctx, L.lightningPath(3101, ox + 1330, oy + 140, ox + 1200, oy + 980, 0.36, 7), clamp((fl - 0.3) / 0.7), '#e9f1ff'); }
    // 2) the two of them (one figure pass), held on twos; motionless while she lies on him
    const pz = c31HerPose(t), tq = Math.floor(t * 12) / 12, breath = t < 5 ? 0.5 + 0.5 * sin(tq * 2.6) : 0.5;
    // held on twos: painted with the pose, flash and camera of the quantised time, re-projected on the in-between frame
    const cQ = c31Cam(tq), flQ = Math.round(flashOf(tq, C31.flash) * 20) / 20, uQ = C31.u * cQ.z;
    const toCam = (c) => ({ z: c.z * C31.u, fx: c.fx, fy: c.fy });
    const held = heldLayer('c31pair', (tq < 5 ? 'lie|' + flQ : tq.toFixed(4)), toCam(cQ), toCam(cm), (c) => {
      const pzq = tq < 5 ? { R: 0, tilt: 0, sob: 0 } : c31HerPose(tq);
      const o = { x: 960 - cQ.fx * uQ, y: 540 - cQ.fy * uQ, scale: C31.u / 92 * cQ.z, light: -HP - 0.35 + 0.95 * pzq.R, rimColor: '#dfe9ff', rim: 1.25 + 0.6 * flQ, backlight: clamp(0.18 + 0.55 * flQ), glow: 0.25 + 0.45 * flQ, fill: '#0a0e18', fps: 0, flash: flQ, breath: 0 };
      return c31Pair(c, tq < 5 ? 0 : tq, o, pzq);
    });
    const res = held.res, fb = held; held.draw(ctx);
    // 3) the wet road mirrors everything above it (darker, broken by ripples)
    const roadY = Math.round(toS([0, 0])[1]);
    if (roadY < H) {
      const h = H - roadY, src = Math.max(0, roadY - h), cp = buf('c31cp', W, Math.max(2, roadY - src));
      cp.ctx.drawImage(ctx.canvas, 0, src, W, roadY - src, 0, 0, W, roadY - src);
      ctx.save(); ctx.fillStyle = '#05070d'; ctx.fillRect(0, roadY, W, h);
      const nb = 14;
      for (let b = 0; b < nb; b++) {
        const y0 = roadY + h * b / nb, hh = h / nb + 1, sy = (roadY - src) - (y0 - roadY) - hh; if (sy + hh < 0) break;
        ctx.globalAlpha = 0.55 * (1 - 0.5 * b / nb); ctx.save(); ctx.translate(14 * N2(b * 0.7, t * 0.6), y0 + hh); ctx.scale(1, -1); ctx.drawImage(cp.canvas, 0, Math.max(0, sy), W, hh, 0, 0, W, hh); ctx.restore();
      }
      ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, roadY, W, H - roadY); ctx.clip(); held.draw(ctx); ctx.restore();
    }
    // 4) drops gathering at the points of her hair and falling to the road (ripples); slow rain; splashes
    ctx.save(); ctx.lineCap = 'round';
    res.tips.forEach((tp, i) => {
      const p = toS(tp.p), per = 1.3 + R1(i, 371), k = (((t + R1(i, 372) * per) % per) + per) % per / per;
      const ground = tp.lie > 0.5 ? p[1] + 4 : roadY;
      if (k < 0.5) { const rr = 2.5 + 3.5 * k / 0.5; ctx.fillStyle = `rgba(206,220,250,${(0.5 + 0.4 * fl).toFixed(3)})`; ctx.beginPath(); ctx.arc(p[0], p[1] + rr, rr, 0, TAU); ctx.fill(); return; }
      const kk = (k - 0.5) / 0.5;
      if (tp.lie > 0.5 || kk > 0.45) { const k3 = tp.lie > 0.5 ? kk : (kk - 0.45) / 0.55; ctx.strokeStyle = `rgba(220,232,255,${(0.55 * (1 - k3)).toFixed(3)})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(p[0], Math.min(ground, H + 50), 6 + 46 * k3, (6 + 46 * k3) * 0.22, 0, 0, TAU); ctx.stroke(); }
      else { const yy = lerp(p[1], roadY, kk / 0.45); ctx.strokeStyle = 'rgba(206,220,250,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p[0], yy - 14); ctx.lineTo(p[0], yy); ctx.stroke(); }
    });
    ctx.restore();
    if (roadY < H) L.splashes(ctx, t * 0.5, { y0: roadY + 8, y1: H, count: 34, alpha: 0.3 + 0.4 * fl, color: '#dbe6ff', seed: 377 });
    slowRain(ctx, t, { count: 110, seed: 316, speed: 460, len: 1, alpha: 0.2, flash: fl });
    if (fl > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(206,220,255,${(0.14 * fl).toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    ctx.drawImage(vignette('c31', 0.3, 1.05, '3,5,10', 0.5, H * 0.45), 0, 0);
  } });

  /* ====================================================================== C32 */
  // 116.7 he sits up and pulls her in. From behind her: two backlit silhouettes on the white bridge — her back with
  // the white sling band across it (as at the railing in C28), her left arm hanging limp over his arm (されるがまま),
  // his bowed head over her right shoulder, his arms round her. As the music turns to D major a pale light opens in
  // the clouds behind them. From the second half of the line the camera pushes in to HIS RIGHT HAND on her back —
  // the fingers dug into the wet gown, the ends of the fingers blanched white (原作4198). 122.9 the lightning's white
  // freezes the frame (123.3 the sound is cut; hard cut to C33).
  const C32 = { pull: 0.2, push: [3.35, 6.2], freeze: 6.4, flash: [[0.24, 0.42, 1], [2.55, 0.36, 0.55], [4.7, 0.3, 0.35]], sc: 2.6, waist: [900, 860] };
  const c32Embrace = (t) => E.outCubic(clamp((t - C32.pull) / 0.65));
  const c32Grip = (t) => 0.3 * c32Embrace(t) + 0.7 * sm(1.0, 6.2, t);
  // the storm and the white bridge behind them, painted once per light state (blitted 1:1 in the two-shot)
  function c32Backdrop(lit) {
    return PV.cached('g08:c32bd' + (lit ? 'L' : 'D'), W, H, (c) => {
      const fl = lit ? 1 : 0;
      L.skyDome(c, 0, { preset: 'storm', horizon: 690, seed: 32, haze: 0.6, hazeColor: '#3a4868', hazeH: 260, x0: -200, x1: W + 200 });
      L.stormClouds(c, 0, { y: -60, h: 760, seed: 32, flash: Math.max(fl, 0.25), flashX: 900, flashY: 220, flashR: 900, speed: 0 });
      c.save(); c.globalCompositeOperation = 'screen';
      c.globalAlpha = 0.45 + 0.4 * fl; c.drawImage(dotSprite('#9fb4e0'), 300, -420, 1300, 1150);
      c.globalAlpha = 0.2 + 0.6 * fl; c.drawImage(dotSprite('#e9f1ff'), 560, -120, 760, 640);
      c.restore();
      L.skyline(c, { seed: 35, y: 690, hMin: 8, hMax: 50, wMin: 30, wMax: 110, color: '#0c1220', gap: 2 });
      L.bridge(c, { x0: -500, x1: 2600, y: 708, towerH: 900, lw: 8, night: true, t: 0, cables: 12, pierH: 0, span: 900, flash: Math.max(fl, 0.35), lamps: 0, uplight: 0.06, color: '#18203a', shadow: '#0a0f1c', rim: '#dfe8ff', rimAmt: 0.45 + 0.55 * fl, towers: [1560] });
      c.fillStyle = '#070b14'; c.fillRect(-200, 648, W + 400, 8); c.fillRect(-200, 694, W + 400, 7);   // the far railing
      for (let x = -200; x < W + 200; x += 62) c.fillRect(x, 648, 7, 56);
      c.fillStyle = `rgba(200,214,245,${(0.18 + 0.5 * fl).toFixed(3)})`; c.fillRect(-200, 648, W + 400, 2);
      const g = c.createLinearGradient(0, 702, 0, H); g.addColorStop(0, '#0b101c'); g.addColorStop(1, '#05080e');   // the wet deck
      c.fillStyle = g; c.fillRect(-200, 702, W + 400, H);
      c.fillStyle = `rgba(170,190,235,${(0.08 + 0.25 * fl).toFixed(3)})`; c.fillRect(-200, 704, W + 400, 3);
    });
  }
  // the two of them. Units: head units, origin = her waist. e = embrace 0..1. Returns his right-hand anchor & forearm.
  function c32Geo(t, e, sob) {
    const G = {};
    G.her = { sh: -1.6 + 0.03 * sob, head: [lerp(0.02, -0.1, e), lerp(-2.62, -2.5, e) + 0.03 * sob], hTilt: lerp(0.05, -0.16, e) };
    G.him = { dy: lerp(1.6, 0, E.outCubic(e)), head: [lerp(0.12, 0.5, e), lerp(-0.2, -2.08, E.outCubic(e))], hTilt: lerp(-0.2, 0.35, e) };
    const up = G.him.dy;                                         // his arms come up with him as he sits up
    G.rH = [lerp(-0.7, -0.24, e), lerp(-0.98, -0.98, e) + up];   // his right hand on her back (her left shoulder blade)
    G.rEl = [lerp(-1.15, -1.1, e), lerp(-0.74, -0.74, e) + up];
    G.lH = [lerp(0.7, 0.34, e), lerp(-1.22, -1.22, e) + up];     // his left hand (her right shoulder blade, under her hair)
    G.lEl = [lerp(1.12, 1.05, e), lerp(-0.82, -0.82, e) + up];
    return G;
  }
  function c32Pair(ctx, t, o, G, sob) {
    const hr = G.her, hm = G.him, fl = o.flash || 0, tq = Math.floor(t * 12) / 12, pk = o.pk || 0;
    L.figureRender(ctx, o, null, (F) => {
      // HIM (behind her, facing us): shoulders wider than hers, the bowed head over her right shoulder (messy hair)
      F.layer({ fill: F.tone(0.03) }, (c) => {
        const y = hm.dy;
        blob(c, [[-1.0, 0.7 + y], [-1.08, -1.0 + y], [-1.0, -1.42 + y], [-0.7, -1.62 + y], [0.0, -1.66 + y], [0.72, -1.64 + y], [1.04, -1.46 + y], [1.12, -1.0 + y], [1.05, 0.7 + y]]);
        limb(c, [-0.98, -1.35 + y], G.rEl, 0.22, 0.18); limb(c, [1.03, -1.35 + y], G.lEl, 0.22, 0.18);   // upper arms
        c.save(); c.translate(hm.head[0], hm.head[1]); c.rotate(hm.hTilt);
        blob(c, [[0.0, -0.52], [0.26, -0.5], [0.44, -0.36], [0.53, -0.14], [0.6, 0.0, 1], [0.5, 0.06], [0.48, 0.24], [0.34, 0.4], [0.1, 0.46], [-0.16, 0.42], [-0.38, 0.3], [-0.5, 0.12], [-0.6, 0.02, 1], [-0.52, -0.14], [-0.42, -0.36], [-0.24, -0.5]]);
        for (let q = 0; q < 6; q++) { const a = -2.6 + q * 0.42, r0 = [0.46 * cos(a), 0.48 * sin(a)], dir = a + 0.35 * (R1(q, 381) - 0.3); ribbon(c, [r0, [r0[0] + 0.1 * cos(dir), r0[1] + 0.1 * sin(dir)], [r0[0] + 0.17 * cos(dir + 0.25), r0[1] + 0.17 * sin(dir + 0.25)]], [0.07, 0.045, 0.004]); }
        c.fill();
        c.restore();
      });
      // HER back: the wet hospital gown, narrow shoulders, waist; her head tilted onto his shoulder
      F.layer({ fill: F.tone(0.12, '#5c6c94'), inner: 0.45 }, (c) => {
        const s = hr.sh;
        blob(c, [[-0.6, 0.7], [-0.5, 0.15], [-0.47, -0.45], [-0.6, -1.1], [-0.74, s + 0.12], [-0.6, s - 0.06], [-0.2, s - 0.16], [-0.12, -1.92],
                 [0.14, -1.92], [0.22, s - 0.16], [0.62, s - 0.06], [0.76, s + 0.12], [0.62, -1.1], [0.49, -0.45], [0.52, 0.15], [0.62, 0.7]]);
        c.save(); c.translate(hr.head[0], hr.head[1]); c.rotate(hr.hTilt); c.beginPath(); c.ellipse(0, 0, 0.44, 0.52, 0, 0, TAU); c.fill(); c.restore();
      });
      // his forearms across her back and his left hand (far, under her hair); the right hand is the hand rig
      F.layer({ fill: F.tone(0.04), inner: 0.6 }, (c) => {
        limb(c, G.rEl, [G.rH[0] - 0.42, G.rH[1] + 0.08], 0.18, 0.13);
        limb(c, G.lEl, [G.lH[0] + 0.3, G.lH[1] + 0.05], 0.18, 0.13);
        c.beginPath(); c.ellipse(G.lH[0] + 0.05, G.lH[1], 0.2, 0.12, -0.25, 0, TAU); c.fill();
      });
      // the white sling band across her back (from under her hair to her right elbow) and the cast's elbow peeking out
      F.raw((c) => {
        c.save(); c.lineCap = 'round';
        c.strokeStyle = PV.mix('#5a6684', '#d8e2f6', 0.25 + 0.75 * fl); c.lineWidth = 0.075;
        c.beginPath(); c.moveTo(0.02, -1.86); c.quadraticCurveTo(0.34, -1.38, 0.62, -0.86); c.stroke();
        const g = c.createLinearGradient(0.5, -1.0, 0.82, -0.6); g.addColorStop(0, PV.mix('#8e9bb8', '#eef3ff', fl)); g.addColorStop(1, PV.mix('#3a4560', '#8c99b6', fl));
        c.fillStyle = g; c.beginPath(); c.moveTo(0.52, -1.02); c.quadraticCurveTo(0.74, -0.96, 0.8, -0.74); c.lineTo(0.86, -0.56); c.quadraticCurveTo(0.7, -0.66, 0.56, -0.7); c.quadraticCurveTo(0.5, -0.86, 0.52, -1.02); c.fill();
        c.restore();
      });
      // her left arm, hanging limp over his arm (されるがまま): shoulder, elbow, the open hand, fingers down
      F.layer({ fill: F.tone(0.22, '#6878a4'), inner: 1.0 }, (c) => {
        const sh = [-0.66, hr.sh + 0.1], el = [-1.0, -0.5], wr = [-1.1, 0.36 + 0.02 * sob];
        limb(c, sh, el, 0.15, 0.115); limb(c, el, wr, 0.11, 0.08);
        blob(c, [[wr[0] - 0.07, wr[1] - 0.02], [wr[0] + 0.07, wr[1]], [wr[0] + 0.07, wr[1] + 0.2], [wr[0] + 0.03, wr[1] + 0.34], [wr[0] - 0.04, wr[1] + 0.3], [wr[0] - 0.08, wr[1] + 0.16]]);
      });
      F.raw((c) => { // the limp arm catches the storm light along its outer edge (されるがまま垂れた左腕)
        c.save(); c.globalCompositeOperation = 'source-atop'; c.lineCap = 'round'; c.strokeStyle = PV.rgba('#dfe9ff', 0.32 + 0.4 * fl); c.lineWidth = 0.022;
        const sh = [-0.66, hr.sh + 0.1], el = [-1.0, -0.5], wr = [-1.1, 0.36 + 0.02 * sob];
        c.beginPath(); c.moveTo(sh[0] - 0.13, sh[1] + 0.08); c.quadraticCurveTo(el[0] - 0.13, el[1], el[0] - 0.11, el[1] + 0.1); c.quadraticCurveTo(wr[0] - 0.1, (el[1] + wr[1]) / 2, wr[0] - 0.08, wr[1] + 0.14); c.stroke();
        c.restore();
      });
      // her long wet hair down her back, clumped; following the head tilt
      F.layer({ inner: 0.55 * (1 - 0.75 * pk) }, (c) => {
        c.beginPath();
        const n = 15, ca = cos(hr.hTilt), sa = sin(hr.hTilt);
        for (let i = 0; i < n; i++) {
          const f = i / (n - 1), r = R1(i, 321), r2 = R1(i, 322);
          const lx = (f - 0.5) * 0.8, ly = -0.28 + 0.24 * Math.abs(f - 0.5);
          const root = [hr.head[0] + lx * ca - ly * sa, hr.head[1] + lx * sa + ly * ca];
          const tip = [root[0] * 0.45 + (f - 0.5) * 0.62 + 0.1 * (r - 0.5) + 0.06, -0.05 + 0.42 * r2 - 0.25 * Math.abs(f - 0.5)];
          const mid = [lerp(root[0], tip[0], 0.45) + (f - 0.5) * 0.18, lerp(root[1], tip[1], 0.45)], sw = 0.012 * sin(tq * 1.7 + i);
          const pts = [], ws = [], m = 12, w0 = 0.055 + 0.045 * r2;
          for (let j = 0; j <= m; j++) { const q = j / m, iq = 1 - q; pts.push([iq * iq * root[0] + 2 * iq * q * mid[0] + q * q * tip[0] + sw * q, iq * iq * root[1] + 2 * iq * q * mid[1] + q * q * tip[1]]); ws.push(w0 * (1.0 + 0.45 * q) * Math.pow(1 - sm(0.72, 1, q), 0.75) + 0.004); }
          ribbon(c, pts, ws);
        }
        c.ellipse(hr.head[0], hr.head[1] - 0.04, 0.46, 0.5, hr.hTilt, PI, TAU); c.fill();
      });
      F.raw((c) => { // wet sheen on her hair
        c.save(); c.globalCompositeOperation = 'source-atop'; c.lineCap = 'round'; c.strokeStyle = PV.rgba('#dfe9ff', (0.1 + 0.32 * fl) * (1 - 0.8 * pk)); c.lineWidth = 0.011;
        for (let i = 0; i < 6; i++) { const x = hr.head[0] + (R1(i, 331) - 0.5) * 0.6; c.beginPath(); c.moveTo(x, hr.head[1] + 0.25); c.quadraticCurveTo(x + 0.04, -1.4, x * 0.55 + 0.05, -0.75 - 0.3 * R1(i, 332)); c.stroke(); }
        c.restore();
      });
    });
  }
  PV.shot('C32', { draw(ctx, tIn, d) {
    const tRaw = cutT(tIn, d), t = Math.min(tRaw, C32.freeze);       // 122.9: the frame freezes in the lightning
    const fl = flashOf(t, C32.flash), e = c32Embrace(t), grip = c32Grip(t);
    const sob = Math.max(0, sin(t * 7.3)) * (0.5 + 0.5 * N2(t * 0.9, 2)) * sm(0.6, 1.2, t);
    const u = 92 * C32.sc, wst = C32.waist, G = c32Geo(t, e, sob);
    const handW = [wst[0] + G.rH[0] * u, wst[1] + G.rH[1] * u];   // world anchor of his right hand
    const c32Cam = (tt) => { const ee = c32Embrace(tt), GG = c32Geo(tt, ee, 0), hw = [wst[0] + GG.rH[0] * u, wst[1] + GG.rH[1] * u], p = E.inOutCubic(clamp((tt - C32.push[0]) / (C32.push[1] - C32.push[0])));
      return { z: lerp(1.0 + 0.012 * tt, 4.0, Math.pow(p, 1.5)), fx: lerp(960, hw[0] + 30, p), fy: lerp(540, hw[1] + 10, p), pk: p }; };
    const cN = c32Cam(t), pk = cN.pk, zoom = cN.z;
    const cam = { zoom, cx: cN.fx, cy: cN.fy, x: 960 - cN.fx, y: 540 - cN.fy };
    // 1) the storm and the white bridge; a pale light opens behind their heads as the music turns to D major.
    //    (the far backdrop ignores the slow creep-in of the two-shot: 1:1 until the real push starts — parallax)
    const bz = 1 + Math.max(0, zoom - (1 + 0.012 * t)), bcam = { zoom: bz, cx: cN.fx, cy: cN.fy, x: 960 - cN.fx, y: 540 - cN.fy };
    ctx.save(); if (bz > 1.0001) PV.camera(ctx, bcam);
    ctx.drawImage(c32Backdrop(false), 0, 0);
    if (fl > 0.01) { ctx.globalAlpha = clamp(fl); ctx.drawImage(c32Backdrop(true), 0, 0); ctx.globalAlpha = 1; }
    ctx.restore(); ctx.save(); PV.camera(ctx, cam);
    const hope = sm(0.6, 5.5, t);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.18 + 0.32 * hope; ctx.drawImage(dotSprite('#cfdcf6'), 520, -260, 900, 760); ctx.restore();
    if (fl > 0.35) L.lightning(ctx, L.lightningPath(3201, 1480, 40, 1380, 640, 0.36, 7), clamp((fl - 0.35) / 0.65), '#e9f1ff');
    // 2) the two of them (one silhouette pass)
    // (held on twos: painted with the pose, flash and camera of the quantised time, re-projected on the in-between frame)
    const tq = Math.min(Math.floor(t * 12) / 12, C32.freeze), cQ = c32Cam(tq), flQ = flashOf(tq, C32.flash), eQ = c32Embrace(tq);
    const sobQ = Math.max(0, sin(tq * 7.3)) * (0.5 + 0.5 * N2(tq * 0.9, 2)) * sm(0.6, 1.2, tq), hopeQ = sm(0.6, 5.5, tq);
    const pair = heldLayer('c32pair', tq.toFixed(4), cQ, cN, (c) => {
      c.save(); PV.camera(c, { zoom: cQ.z, cx: cQ.fx, cy: cQ.fy, x: 960 - cQ.fx, y: 540 - cQ.fy });
      c32Pair(c, tq, { x: wst[0], y: wst[1], scale: C32.sc, light: -HP + 0.15, rimColor: '#e4ecff', rim: 1.3 + 0.5 * flQ, backlight: clamp(0.18 + 0.5 * flQ + 0.15 * hopeQ), glow: 0.3 + 0.4 * flQ, fill: '#090c15', fps: 0, flash: flQ, pk: cQ.pk }, c32Geo(tq, eQ, sobQ), sobQ);
      c.restore();
    }, cQ.z > 1.6 ? 0.5 : 1);   // close in, her back and hair are only the backdrop of the hand: half resolution
    ctx.restore(); pair.draw(ctx); ctx.save(); PV.camera(ctx, cam);
    // 3) his right hand on her back, the back of the hand toward us, the fingers clawed into the wet cloth. In the wide
    //    shot it is as dark as the silhouettes; the push-in reveals it (the knuckles and the bent finger ends white).
    const GQ = c32Geo(tq, eQ, sobQ), hx = wst[0] + GQ.rH[0] * u, hy = wst[1] + GQ.rH[1] * u, gripQ = c32Grip(tq), cl = 0.3 + 0.7 * gripQ, trem = 0.025 * gripQ;
    const pose = { F: [0, 1, 2, 3].map((i) => ({ flex: [0.3 + 0.27 * cl + 0.03 * i + trem * N2(tq * 6 + i, 1), 0.62 + 0.68 * cl + trem * N2(tq * 6 + i, 2), 0.4 + 0.36 * cl], splay: [-0.08, -0.02, 0.04, 0.1][i] })), T: { abd: 0.55, opp: 0.25, flex: [0.25, 0.35], twist: 0 } };
    const hb = buf('c32hand'), hcx = hb.ctx;
    hcx.save(); PV.camera(hcx, cam);
    const key = mixHex('#6a77a0', '#c4d0ee', fl), fill = mixHex('#181e32', '#3a4466', fl);
    const rig = L.hand(hcx, { side: 'R', kind: 'him', view: 'back', pitch: 0.3, yaw: -0.15, x: hx - 0.6 * u, y: hy + 0.12 * u, rot: HP - 0.22, scale: 1.05, pose, arm: 52, sleeve: '#0c0a09', sleeveAt: 30, light: -1.9, keyColor: key, fillColor: fill, tint: 1.0, calluses: false });
    hcx.restore();
    const ends = [];
    hcx.save(); hcx.globalCompositeOperation = 'source-atop';
    const hxs = rig.joints.flat().map((q) => q.x).concat([rig.wrist.x]), hys = rig.joints.flat().map((q) => q.y).concat([rig.wrist.y]), hpad = 260 * zoom;
    const hb0 = [Math.max(0, Math.min(...hxs) - hpad), Math.max(0, Math.min(...hys) - hpad), Math.min(W, Math.max(...hxs) + hpad), Math.min(H, Math.max(...hys) + hpad)];
    hcx.fillStyle = `rgba(7,10,18,${(lerp(0.8, 0.3, sm(0.12, 0.8, pk)) * (1 - 0.45 * fl)).toFixed(3)})`; hcx.fillRect(hb0[0], hb0[1], hb0[2] - hb0[0], hb0[3] - hb0[1]);   // dark in the two-shot
    if (e < 0.35) { hcx.globalCompositeOperation = 'destination-in'; hcx.fillStyle = `rgba(0,0,0,${sm(0.05, 0.35, e).toFixed(3)})`; hcx.fillRect(0, 0, W, H); hcx.globalCompositeOperation = 'source-atop'; }
    // the strain blanches him: pale on the knuckles and on the bent ends of the fingers, elongated along each segment
    const blanch = (p0, p1, al, wd) => {
      const cx = (p0.x + p1.x) / 2, cy = (p0.y + p1.y) / 2, l = Math.max(4, Math.hypot(p1.x - p0.x, p1.y - p0.y) * 0.62), r = Math.max(3, wd * 0.34);
      hcx.save(); hcx.translate(cx, cy); hcx.rotate(Math.atan2(p1.y - p0.y, p1.x - p0.x)); hcx.scale(1, r / l);
      const g = hcx.createRadialGradient(0, 0, 0, 0, 0, l); g.addColorStop(0, `rgba(226,232,246,${al.toFixed(3)})`); g.addColorStop(1, 'rgba(226,232,246,0)');
      hcx.fillStyle = g; hcx.beginPath(); hcx.arc(0, 0, l, 0, TAU); hcx.fill(); hcx.restore();
    };
    const gw = (0.1 + 0.9 * grip) * sm(0.1, 0.7, pk);
    for (let i = 1; i <= 4; i++) {
      const J = rig.joints[i], wd = Math.hypot(J[1].x - J[0].x, J[1].y - J[0].y) * 0.55;
      const a = Math.atan2(J[1].y - J[0].y, J[1].x - J[0].x);
      ends.push({ p: J[1], a, w: wd, base: J[0] });                    // curled: the PIP knuckle is the visible end; the rest is in the cloth
      blanch({ x: lerp(J[0].x, J[1].x, 0.5), y: lerp(J[0].y, J[1].y, 0.5) }, J[1], 0.85 * gw, wd);   // the bent finger end, white with strain
      blanch(J[0], J[1], 0.22 * gw, wd);
      blanch({ x: J[0].x - 2, y: J[0].y - 2 }, { x: J[0].x + 2, y: J[0].y + 2 }, 0.5 * gw, wd * 1.4);   // the knuckle
    }
    for (let i = 0; i < 9; i++) {   // rain beads on the back of the hand and the knuckles
      const J = rig.joints[1 + (i % 4)], f = R1(i, 371), b0 = rig.wrist, x = lerp(b0.x, J[0].x, 0.35 + 0.6 * f) + (R1(i, 372) - 0.5) * 30 * zoom, y = lerp(b0.y, J[0].y, 0.35 + 0.6 * f) + (R1(i, 373) - 0.5) * 30 * zoom, r = (1.6 + 1.8 * R1(i, 374)) * zoom;
      hcx.fillStyle = 'rgba(190,206,236,0.16)'; hcx.beginPath(); hcx.arc(x, y, r, 0, TAU); hcx.fill();
      hcx.strokeStyle = 'rgba(10,12,22,0.3)'; hcx.lineWidth = Math.max(0.8, r * 0.18); hcx.beginPath(); hcx.arc(x, y, r * 0.92, 0.3, PI - 0.3); hcx.stroke();
      hcx.fillStyle = `rgba(240,245,255,${(0.65 + 0.3 * fl).toFixed(3)})`; hcx.beginPath(); hcx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.4, r * 0.28, -0.6, 0, TAU); hcx.fill();
    }
    hcx.restore();
    // a crisp backlight rim on the hand's upper edges (the lightning behind them), only inside the hand's bounds
    { const xs = rig.joints.flat().map((q) => q.x).concat([rig.wrist.x]), ys = rig.joints.flat().map((q) => q.y).concat([rig.wrist.y]);
      const pad = 40 * zoom, x0 = Math.max(0, Math.floor(Math.min(...xs) - pad)), y0 = Math.max(0, Math.floor(Math.min(...ys) - pad)), x1 = Math.min(W, Math.ceil(Math.max(...xs) + pad)), y1 = Math.min(H, Math.ceil(Math.max(...ys) + pad));
      if (x1 - x0 > 4 && y1 - y0 > 4) { const rb = PV.buffer('g08:c32rim', x1 - x0, y1 - y0), rc = rb.ctx, dd = Math.max(1.5, 1.8 * zoom);
        rc.clearRect(0, 0, x1 - x0, y1 - y0); rc.drawImage(hb.canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
        rc.globalCompositeOperation = 'destination-out'; rc.drawImage(hb.canvas, x0, y0, x1 - x0, y1 - y0, 0.4 * dd, dd, x1 - x0, y1 - y0);
        rc.globalCompositeOperation = 'source-in'; rc.fillStyle = '#dfe8ff'; rc.fillRect(0, 0, x1 - x0, y1 - y0); rc.globalCompositeOperation = 'source-over';
        hcx.save(); hcx.globalCompositeOperation = 'source-atop'; hcx.globalAlpha = 0.55 + 0.45 * fl; hcx.drawImage(rb.canvas, x0, y0); hcx.restore(); } }
    ctx.restore();
    // the wet gown gathered by the grip: short ridges between the knuckles and a few long soft creases pulled toward
    // the hand, drawn at quarter res and blurred (fabric, not lines); only once we are close enough to see them
    if (pk > 0.1) {
      const fq = buf('c32fold', W / 4, H / 4), fc = fq.ctx, sz = u * zoom;
      const gc = { x: ends.reduce((s2, q) => s2 + q.p.x, 0) / 4, y: ends.reduce((s2, q) => s2 + q.p.y, 0) / 4 };
      const a0 = Math.atan2(ends.reduce((s2, q) => s2 + sin(q.a), 0), ends.reduce((s2, q) => s2 + cos(q.a), 0)), nx = -sin(a0), ny = cos(a0);
      const crease = (x0, y0, x1, y1, bend, w, crest) => {   // a fold = a soft sheen on its crest, fading out along it
        const mx = (x0 + x1) / 2 + nx * bend, my = (y0 + y1) / 2 + ny * bend, g = fc.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, `rgba(168,186,226,${crest.toFixed(3)})`); g.addColorStop(0.5, `rgba(168,186,226,${(crest * 0.6).toFixed(3)})`); g.addColorStop(1, 'rgba(168,186,226,0)');
        fc.strokeStyle = g; fc.lineWidth = w * 0.55; fc.beginPath(); fc.moveTo(x0, y0); fc.quadraticCurveTo(mx, my, x1, y1); fc.stroke();
      };
      fc.save(); fc.scale(0.25, 0.25); fc.lineCap = 'round';
      const cr = 0.3 + 0.45 * fl;
      for (let i = 0; i < 5; i++) {   // gathered between / beside the curled fingers, pulled in toward the grip
        const pA = i === 0 ? { x: ends[0].p.x - nx * ends[0].w * 1.2, y: ends[0].p.y - ny * ends[0].w * 1.2 } : i === 4 ? { x: ends[3].p.x + nx * ends[3].w * 1.2, y: ends[3].p.y + ny * ends[3].w * 1.2 } : { x: (ends[i - 1].p.x + ends[i].p.x) / 2, y: (ends[i - 1].p.y + ends[i].p.y) / 2 };
        const L2 = sz * (0.13 + 0.08 * R1(i, 361)), sp = (i - 2) * 0.25;
        crease(pA.x + cos(a0) * sz * 0.01, pA.y + sin(a0) * sz * 0.01, pA.x + cos(a0 + sp) * L2, pA.y + sin(a0 + sp) * L2, sz * 0.03 * (R1(i, 362) - 0.5), sz * 0.03, cr);
      }
      for (let k = 0; k < 2; k++) {   // two long creases pulled toward the grip, curving away
        const ak = a0 + [-0.55, 0.55][k], L2 = sz * (0.42 + 0.2 * R1(k, 363)), x0 = gc.x + cos(ak) * sz * 0.26, y0 = gc.y + sin(ak) * sz * 0.26;
        crease(x0, y0, x0 + cos(ak) * L2, y0 + sin(ak) * L2, sz * 0.1 * (k ? 1 : -1), sz * 0.04, cr * 0.55);
      }
      fc.restore();
      fc.save(); fc.scale(0.25, 0.25);
      ends.forEach((q) => { const w = q.w * 1.25, cx = q.p.x + cos(q.a) * w * 0.35, cy = q.p.y + sin(q.a) * w * 0.35; fc.fillStyle = 'rgba(1,2,6,0.55)'; fc.beginPath(); fc.ellipse(cx, cy, w * 0.75, w * 0.62, q.a, 0, TAU); fc.fill(); });
      fc.restore();
      const fq2 = buf('c32fold2', W / 4, H / 4); fq2.ctx.filter = 'blur(1.1px)'; fq2.ctx.drawImage(fq.canvas, 0, 0); fq2.ctx.filter = 'none';
      { const R0 = sz * 1.0, x0 = clamp(Math.floor((gc.x - R0) / 4), 0, W / 4), y0 = clamp(Math.floor((gc.y - R0) / 4), 0, H / 4), x1 = clamp(Math.ceil((gc.x + R0) / 4), 0, W / 4), y1 = clamp(Math.ceil((gc.y + R0) / 4), 0, H / 4);
        if (x1 - x0 > 1 && y1 - y0 > 1) { ctx.save(); ctx.globalAlpha = sm(0.1, 0.45, pk) * (0.4 + 0.6 * grip); ctx.imageSmoothingQuality = 'low'; ctx.drawImage(fq2.canvas, x0, y0, x1 - x0, y1 - y0, x0 * 4, y0 * 4, (x1 - x0) * 4, (y1 - y0) * 4); ctx.restore(); } }
    }
    ctx.drawImage(hb.canvas, 0, 0);
    // a few of her wet hair strands lying across his knuckles (only close enough to see): short tapered wavy locks
    if (pk > 0.2) {
      const a = sm(0.2, 0.6, pk), sz = u * zoom;
      ctx.save(); ctx.fillStyle = `rgba(5,7,13,${(0.92 * a).toFixed(3)})`;
      const locks = [];
      for (let i = 0; i < 3; i++) {
        const k = ends[1 + i].p, pts = [];
        for (let j = 0; j <= 6; j++) { const q = j / 6; pts.push([k.x + sz * (0.2 - 0.42 * q) + sz * 0.025 * sin(q * 7 + i * 2.1), k.y + sz * (-0.2 + 0.36 * q + 0.04 * i) + sz * 0.012 * cos(q * 5 + i)]); }
        const ws = pts.map((_, j) => { const q = j / 6; return sz * (0.0035 + 0.006 * Math.sin(PI * q)) * (i === 1 ? 1.3 : 1); });
        ctx.beginPath(); ribbon(ctx, pts, ws); ctx.fill(); locks.push(pts);
      }
      ctx.strokeStyle = `rgba(214,226,252,${((0.2 + 0.4 * fl) * a).toFixed(3)})`; ctx.lineWidth = Math.max(1, sz * 0.0025); ctx.lineCap = 'round';
      locks.forEach((pts) => { ctx.beginPath(); spline(ctx, pts.slice(1, 5).map((p) => [p[0] - sz * 0.003, p[1] - sz * 0.002]), false); ctx.stroke(); });
      ctx.restore();
    }
    // 4) rain (screen space), the flash, the vignette
    L.rain(ctx, t, { seed: 32, count: 240, angle: 0.12, speed: 2300, len: 90, alpha: 0.18 + 0.35 * fl, color: '#c9d6f0' });
    if (fl > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(206,220,255,${(0.14 * fl).toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    ctx.drawImage(vignette('c32', 0.32, 1.05, '3,5,10', 0.5), 0, 0);
    // 122.9: the lightning's white — the frame stops (a faint image of the hand remains until the hard cut)
    if (tRaw >= C32.freeze - 0.04) {
      const k = clamp((tRaw - (C32.freeze - 0.04)) / 0.06);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(233,241,255,${(0.82 * k).toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore();
      ctx.fillStyle = `rgba(250,252,255,${(0.3 * k).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
    }
  } });


})();

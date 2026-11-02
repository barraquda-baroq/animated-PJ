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
  /* ============================================ anime characters (PV.anime): shared helpers for C30–C32 */
  // Faces and hair are the library's (PV.anime.head: eyes, tears, lip-sync, wet hair); the bodies in these three close,
  // unusual views (from below, lying on the road, the embrace) are painted here in the same style: one ink line behind
  // the fill (outer half shows), base, one cel shade = the shape minus itself shifted toward the light, a crisp rim band
  // on the light side. Colours always from PV.anime.mat(material, light). Clothes, cast and hands follow the design
  // sheet (storm: 先輩 the wet pale-blue gown, white cast and sling; 彼 the soaked white school shirt).
  const AN = PV.anime;
  const T0 = { C29: 103.5, C30: 105.5, C31: 110.0, C32: 116.5 };
  // the film's clock inside a cut (lip-sync and blinks need global seconds; --solo shifts S.start to 0)
  const absT = (S, id, t) => ((S && S.start > 0.01) ? S.start : T0[id]) + t;
  // a light between two PV.anime.LIGHT entries (k in 1/10 steps so PV.anime.mat's cache stays small)
  const _ml = {};
  function mixLight(a, b, k) {
    k = Math.round(clamp(k) * 10) / 10;
    if (k <= 0) return a; if (k >= 1) return b;
    const key = a + b + k; if (_ml[key]) return _ml[key];
    const A0 = AN.LIGHT[a], B0 = AN.LIGHT[b];
    return (_ml[key] = { light: AN.mixHex(A0.light, B0.light, k), shadow: AN.mixHex(A0.shadow, B0.shadow, k), amb: lerp(A0.amb, B0.amb, k), rim: AN.mixHex(A0.rim, B0.rim, k),
      rimA: lerp(A0.rimA, B0.rimA, k), sat: lerp(A0.sat, B0.sat, k), dark: lerp(A0.dark, B0.dark, k) });
  }
  const P2 = () => new Path2D();
  const BIG = (() => { const p = new Path2D(); p.rect(-2e4, -2e4, 4e4, 4e4); return p; })();
  // one cel-painted part. o: lw (ink px), lv ([x,y] unit vector toward the key light), shade (px), rim (px), rimCol,
  // rimA, fill/shadeCol overrides, noInk
  function celPart(ctx, path, m, o) {
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.lw > 0 && !o.noInk) { ctx.lineWidth = 2 * o.lw; ctx.strokeStyle = o.line || m.line; ctx.stroke(path); }
    ctx.fillStyle = o.fill || m.base; ctx.fill(path);
    if (o.shade || o.rim) {
      ctx.save(); ctx.clip(path);
      if (o.shade) { const p = new Path2D(BIG); p.addPath(path, new DOMMatrix([1, 0, 0, 1, o.lv[0] * o.shade, o.lv[1] * o.shade])); ctx.fillStyle = o.shadeCol || m.shade; ctx.fill(p, 'evenodd'); }
      if (o.rim) { const p = new Path2D(BIG); p.addPath(path, new DOMMatrix([1, 0, 0, 1, -o.lv[0] * o.rim, -o.lv[1] * o.rim])); ctx.globalAlpha = o.rimA ?? 1; ctx.fillStyle = o.rimCol || m.hi; ctx.fill(p, 'evenodd'); }
      ctx.restore();
    }
    ctx.restore();
  }
  const pathOf = (pts, closed) => { const p = new Path2D(); spline(p, pts, closed !== false); return p; };
  const ribbonPath = (pts, ws) => { const p = new Path2D(); ribbon(p, pts, ws); return p; };
  // a tapered ink stroke along a polyline (screen px): w(u) = width at u
  function inkLine(ctx, pts, w, col) { AN.taper(ctx, pts, w, col, pts.length >= 3); }
  // wet hair clump in the library's hair colours: base, a cel shade along one side, thin ink, long broken wet glints
  function wetClump(ctx, pts, ws, HM, o) {
    const p = ribbonPath(pts, ws);
    celPart(ctx, p, HM, { lw: o.lw, lv: o.lv, shade: o.shade, rim: o.rim, rimCol: o.rimCol, rimA: o.rimA, fill: o.fill, shadeCol: o.shadeCol });
    if (o.glint > 0.02) {
      ctx.save(); ctx.clip(p); ctx.lineCap = 'round'; ctx.strokeStyle = o.glintCol || HM.hi;
      const n = pts.length;
      for (let g = 0; g < 2; g++) {
        const a0 = Math.floor(n * (0.15 + 0.22 * g)), a1 = Math.min(n - 2, a0 + Math.floor(n * 0.3)), off = (g ? -0.35 : 0.3);
        ctx.globalAlpha = o.glint * (g ? 0.6 : 1); ctx.lineWidth = Math.max(0.8, o.lw * 0.8);
        ctx.beginPath();
        for (let i = a0; i <= a1; i++) { const q = pts[i], q2 = pts[Math.min(n - 1, i + 1)], dx = q2[0] - q[0], dy = q2[1] - q[1], l = Math.hypot(dx, dy) || 1, w = ws[i] * off; if (i === a0) ctx.moveTo(q[0] - dy / l * w, q[1] + dx / l * w); else ctx.lineTo(q[0] - dy / l * w, q[1] + dx / l * w); }
        ctx.stroke();
      }
      ctx.restore();
    }
    return p;
  }

  /* ====================================================================== C30 her */
  // HER, astride him, from below (his eyes): her face turned down to him — a frontal face seen a little from below
  // (pitch +), crying and shouting V09; the long wet hair hangs toward the lens on both sides of the face (every lock
  // radiates from a vanishing point above her head and widens as it nears the lens), the shoulders hunched over him in
  // the wet gown, the white cast in its sling across her belly, the left fist: raised / striking / pressed on his chest.
  // World px = the D1 framing; the stills zoom in with the camera. N = neck point, S = head size (chin→crown).
  const C30H = { N: [960, 590], S: 340 };
  // the wet hair hanging toward the lens: on each side 7 clumps rooted round the side of the head (temple → below the
  // ear). Gravity points at the lens, so they hang down the frame and fan out a little (the lower roots more), WIDEN
  // toward the lens (perspective) and end in sharp wet points. [rootT, length, max half-width, angle from vertical, bend]
  const C30CL = [[0.0, 1.75, 0.06, 0.07, 0.5], [0.14, 2.05, 0.095, 0.1, -0.4], [0.3, 1.6, 0.075, 0.15, 0.6], [0.46, 2.15, 0.115, 0.2, -0.3],
    [0.63, 1.8, 0.085, 0.27, 0.45], [0.8, 2.0, 0.105, 0.34, -0.5], [1.0, 1.55, 0.07, 0.42, 0.35]];
  function c30HairGeo(tq, sw) {
    const [nx, ny] = C30H.N, S = C30H.S, vp = [nx, ny - 1.55 * S], groups = [], strays = [], back = [];
    for (const s of [-1, 1]) {
      const g = [];
      C30CL.forEach(([rt, len, wm, th, bend], j) => {
        const r = R1(j + (s > 0 ? 10 : 0), 801), r2 = R1(j + (s > 0 ? 10 : 0), 802);
        // exit point on the head outline (temple → below the ear); the clump starts a little inside it (hidden by the
        // face and the cap, which are painted over it) so no clump end shows
        const ex = [nx + s * S * (0.42 + 0.035 * Math.sin(rt * PI) + 0.01 * r), ny - S * (0.72 - 0.5 * rt)], hc = [nx, ny - 0.45 * S];
        const il = Math.hypot(hc[0] - ex[0], hc[1] - ex[1]) || 1, root = [ex[0] + (hc[0] - ex[0]) / il * 0.09 * S, ex[1] + (hc[1] - ex[1]) / il * 0.09 * S];
        const L = S * len * (0.92 + 0.16 * r), wob = sw * 0.018 * sin(tq * 1.7 + j * 1.3 + (s > 0 ? 2 : 0));
        const a = HP - s * (th + 0.04 * (r - 0.5)) + wob, d = [cos(a) * L, sin(a) * L], pn = [-sin(a), cos(a)];
        const bn = S * 0.04 * bend * (0.7 + 0.6 * r2), pts = [], ws = [], m = 16, w0 = S * 0.04, w1 = S * wm * (0.85 + 0.3 * r2);
        for (let i = 0; i <= m; i++) {
          const u = i / m, b = Math.sin(PI * u) * bn - 0.25 * bn * Math.sin(TAU * u);
          pts.push([root[0] + d[0] * u + pn[0] * b, root[1] + d[1] * u + pn[1] * b]);
          ws.push(lerp(w0, w1, Math.pow(u, 0.75)) * Math.pow(1 - sm(0.7, 1, u), 0.85) + 0.5);
        }
        g.push({ s, j, pts, ws, tip: pts[m], r, len });
      });
      groups.push(g.reverse());   // outer (lower) clumps first, the ones beside the face on top
      for (let j = 0; j < 4; j++) {   // behind: clumps that fall past the far side of the shoulders (darker)
        const r = R1(j + (s > 0 ? 20 : 0), 803), root = [nx + s * S * (0.36 + 0.03 * j), ny - S * (0.66 - 0.12 * j)];
        const L = S * (1.2 + 0.3 * r), a = HP - s * (0.5 + 0.1 * j), pts = [], ws = [];
        for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([root[0] + cos(a) * L * u, root[1] + sin(a) * L * u]); ws.push(S * (0.04 + 0.06 * u) * Math.pow(1 - sm(0.7, 1, u), 0.8) + 0.5); }
        back.push({ s, pts, ws, tip: pts[10] });
      }
      for (let j = 0; j < 3; j++) {   // thin wet strands escaping across the curtain edge
        const r = R1(j + (s > 0 ? 30 : 0), 804), root = [nx + s * S * (0.44 + 0.02 * j), ny - S * (0.66 - 0.2 * j)];
        const L = S * (0.9 + 0.6 * r), a = HP - s * (0.02 + 0.2 * r), pts = [];
        for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([root[0] + cos(a) * L * u + s * S * 0.02 * sin(u * 5 + j), root[1] + sin(a) * L * u]); }
        strays.push({ s, pts });
      }
    }
    return { groups, back, strays, vp };
  }
  // paint one curtain group: silhouette ink behind the whole group, then each clump (base + the cel shade on the side
  // toward the face + the sky's rim on the outer edge + wet glints), thin lines between overlapping clumps
  function c30Curtain(ctx, g, HM, o) {
    const paths = g.map((c) => ribbonPath(c.pts, c.ws));
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = HM.line; ctx.lineWidth = 2 * o.lw; for (const p of paths) ctx.stroke(p); ctx.restore();
    g.forEach((c, i) => {
      const lv = [c.s * 0.55, -0.83];
      wetClump(ctx, c.pts, c.ws, HM, { lw: 0, lv, shade: o.S * 0.045, rim: o.S * 0.012, rimCol: o.rimCol, rimA: o.rimA, glint: o.glint * (0.6 + 0.4 * c.r), glintCol: o.glintCol });
      if (i > 0) { ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = HM.line; ctx.lineWidth = o.lw * 0.55; ctx.globalAlpha = 0.85; ctx.stroke(paths[i]); ctx.restore(); }
    });
  }
  // her left arm: 0 raised beside her head → 1 down on his chest (the fist below the frame, near the lens). World px.
  function c30Arm(k, br) {
    const [nx, ny] = C30H.N, S = C30H.S, e = E.inCubic(clamp(k));
    const sh = [nx + 0.6 * S, ny + 0.36 * S - 0.04 * S * br];
    const el = [nx + lerp(1.08, 0.9, e) * S, ny + lerp(-0.12, 0.98, e) * S];
    const wr = [nx + lerp(0.98, 1.02, e) * S, ny + lerp(-0.78, 1.8, e) * S];
    return { sh, el, wr, wUp: lerp(0.13, 0.14, e) * S, wEl: lerp(0.1, 0.12, e) * S, wWr: lerp(0.075, 0.14, e) * S, fs: lerp(1.25, 2.1, e), k: e };
  }
  // a capsule (two radii) as a Path2D
  function capsulePath(p0, p1, r0, r1) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1e-6, nx = -dy / l, ny = dx / l, a = Math.atan2(dy, dx), p = new Path2D();
    p.moveTo(p0[0] + nx * r0, p0[1] + ny * r0); p.lineTo(p1[0] + nx * r1, p1[1] + ny * r1);
    p.arc(p1[0], p1[1], r1, a + HP, a - HP, true); p.lineTo(p0[0] - nx * r0, p0[1] - ny * r0); p.arc(p0[0], p0[1], r0, a - HP, a + HP, true); p.closePath(); return p;
  }
  // the figure, in the current ctx (camera already applied). o: tq (on twos), T (global, on twos), fl (flash, quantised),
  // arm ('raised' | 0..1 | 'rest'), br (breath 0..1), face {expr, eyes, brows, mouth, roll, yaw}
  function c30Her(ctx, o) {
    const [nx, ny0] = C30H.N, S = C30H.S, br = o.br, fl = o.fl;
    const ny = ny0 - 0.035 * S * br;                                            // the shoulders heave (the head goes with them)
    const Lt = mixLight('storm', 'lightning', 0.15 + 0.75 * fl), FL = AN.faceLight(Lt);
    const lv = [0, -1], lw = AN.inkW(S) * 1.05;
    const gown = AN.mat('gown', AN.faceLight(Lt, 0.5), { wet: 1 }), skin = AN.mat('skin', FL), HM = AN.mat('hair_senpai', Lt, { wet: 1 });
    const rimCol = Lt.rim || '#dfe8ff', rimA = 0.55 + 0.45 * fl;
    const HG = c30HairGeo(o.tq, 1);
    const hairDark = { base: AN.mixHex(HM.shade, HM.deep, 0.4), shade: HM.deep, hi: HM.shade, line: HM.line };
    const glintCol = AN.mixHex(HM.hi, '#ffffff', 0.35), glint = 0.22 + 0.5 * fl;
    // 1) the hair that falls past the far side of her shoulders
    for (const b of HG.back) wetClump(ctx, b.pts, b.ws, hairDark, { lw: lw * 0.7, lv, shade: S * 0.03, rim: S * 0.01, rimCol, rimA: rimA * 0.5, glint: glint * 0.5, glintCol: HM.hi });
    // 2) the neck (the head's own neck, foreshortened from below), then the gown: hunched shoulders and the chest that
    //    recedes toward his belly at the bottom of the frame
    const ho = { who: 'senpai', x: nx, y: ny, size: S, yaw: o.face.yaw || 0, pitch: 0.12, roll: o.face.roll || 0, light: Lt, rimDir: -HP, lightDir: -HP, shade: 0.07,
      rim: 1.15, T: o.T, seed: 3, hair: { style: 'wet', still: true }, expr: o.face.expr, eyes: o.face.eyes, brows: o.face.brows, mouth: o.face.mouth, blush: o.face.blush, talk: o.face.talk };
    AN.head(ctx, Object.assign({}, ho, { layer: 'neck', neckLen: 0.42, neckFade: true, neckFlare: false }));
    const sh = 0.04 * S * br, tz = [
      [nx - 0.13 * S, ny + 0.14 * S], [nx - 0.38 * S, ny + 0.22 * S - sh], [nx - 0.62 * S, ny + 0.33 * S - sh], [nx - 0.76 * S, ny + 0.46 * S - sh], [nx - 0.8 * S, ny + 0.68 * S],
      [nx - 0.72 * S, ny + 1.2 * S], [nx - 0.64 * S, ny + 2.2 * S, 1], [nx + 0.64 * S, ny + 2.2 * S, 1], [nx + 0.72 * S, ny + 1.2 * S], [nx + 0.8 * S, ny + 0.68 * S],
      [nx + 0.76 * S, ny + 0.46 * S - sh], [nx + 0.62 * S, ny + 0.33 * S - sh], [nx + 0.38 * S, ny + 0.22 * S - sh], [nx + 0.13 * S, ny + 0.14 * S], [nx, ny + 0.3 * S]];
    const torso = pathOf(tz);
    celPart(ctx, torso, gown, { lw, lv, shade: S * 0.11, rim: S * 0.022, rimCol, rimA });
    // the open pajama collar (two flaps meeting in a V) and the placket
    ctx.save(); ctx.clip(torso);
    const flapL = pathOf([[nx - 0.15 * S, ny + 0.14 * S], [nx - 0.36 * S, ny + 0.24 * S - sh], [nx - 0.3 * S, ny + 0.5 * S], [nx - 0.02 * S, ny + 0.66 * S, 1], [nx - 0.05 * S, ny + 0.4 * S]]);
    const flapR = pathOf([[nx + 0.15 * S, ny + 0.14 * S], [nx + 0.36 * S, ny + 0.24 * S - sh], [nx + 0.3 * S, ny + 0.5 * S], [nx + 0.02 * S, ny + 0.66 * S, 1], [nx + 0.05 * S, ny + 0.4 * S]]);
    const vne = pathOf([[nx - 0.15 * S, ny + 0.15 * S], [nx, ny + 0.62 * S, 1], [nx + 0.15 * S, ny + 0.15 * S]]);
    celPart(ctx, vne, skin, { lw: lw * 0.6, lv, shade: S * 0.06, shadeCol: skin.shade });
    celPart(ctx, flapL, gown, { lw: lw * 0.6, lv, shade: S * 0.03, rim: S * 0.01, rimCol, rimA: rimA * 0.7 });
    celPart(ctx, flapR, gown, { lw: lw * 0.6, lv, shade: S * 0.03, rim: S * 0.01, rimCol, rimA: rimA * 0.7 });
    inkLine(ctx, [[nx + 0.02 * S, ny + 0.66 * S], [nx + 0.03 * S, ny + 1.3 * S], [nx + 0.04 * S, ny + 2.2 * S]], (u) => lw * 0.55 * (1 - 0.6 * u), gown.line);
    ctx.fillStyle = gown.shade; for (const yy of [0.95, 1.5]) { ctx.beginPath(); ctx.arc(nx + 0.08 * S, ny + yy * S, S * 0.018, 0, TAU); ctx.fill(); }
    for (const s of [-1, 1]) inkLine(ctx, [[nx + s * 0.55 * S, ny + 0.4 * S], [nx + s * 0.45 * S, ny + 0.75 * S], [nx + s * 0.38 * S, ny + 1.05 * S]], (u) => lw * 0.45 * Math.sin(PI * u), gown.line);
    // 3) the right forearm in the white cast, carried by the sling across her belly (hands.js armCast; the straps run up
    //    under the collar: clipped to the gown)
    L.armCast(ctx, { x: nx + 0.2 * S, y: ny + 1.0 * S - 0.02 * S * br, rot: HP + 0.1, scale: S * 0.0033, arm: 200, kind: 'her', t: o.tq, tremble: 0.4, sling: true, yaw: -0.25, pitch: 0.4,
      keyColor: FL.light, fillColor: AN.mixHex(FL.shadow, FL.light, 0.45), tint: 0.9, slingColor: AN.mixHex('#7f8fb6', '#cad6f0', fl), castColor: AN.mixHex('#a9b5d2', '#f4f6fc', fl) });
    ctx.restore();
    // 4) her left arm and fist
    const k = o.arm === 'raised' ? 0 : o.arm === 'rest' ? 1 : clamp(o.arm), A2 = c30Arm(k, br);
    const up = capsulePath(A2.sh, A2.el, A2.wUp, A2.wEl), fore = capsulePath(A2.el, A2.wr, A2.wEl * 0.95, A2.wWr);
    const fistDraw = () => {
      if (o.arm === 'rest') return;   // down on his chest: the fist is below the frame (behind the hair, near the lens)
      const dx = A2.wr[0] - A2.el[0], dy = A2.wr[1] - A2.el[1], ang = Math.atan2(dy, dx) + HP;
      L.handFist(ctx, { side: 'L', kind: 'her', x: A2.wr[0], y: A2.wr[1], scale: S * 0.0036 * A2.fs, rot: ang, view: 'palm', yaw: 0.45, pitch: -0.15, clench: 1, shake: 0.8, t: o.tq, arm: 12,
        keyColor: FL.light, fillColor: AN.mixHex(FL.shadow, FL.light, 0.45), tint: 0.9, blur: o.arm === 'raised' ? 0 : 3 });
    };
    const armDraw = () => { const parts = A2.k < 0.5 ? [fore, up] : [up, fore]; for (const pp of parts) celPart(ctx, pp, gown, { lw, lv, shade: S * 0.05, rim: S * 0.02, rimCol, rimA }); fistDraw(); };
    if (A2.k < 0.5) armDraw();
    if (A2.k >= 0.5) armDraw();
    // 5) the curtains toward the lens: they come out from behind the head and hang in front of her shoulders, framing
    //    the face
    for (const g of HG.groups) c30Curtain(ctx, g, HM, { lw: lw * 0.9, S, rimCol, rimA, glint, glintCol });
    for (const st of HG.strays) inkLine(ctx, st.pts, (u) => Math.max(0.6, lw * 0.9 * (1 - u)), HM.base);
    // 6) the head (face, cap, bangs, the wet locks pasted to the cheeks)
    const anchors = AN.head(ctx, Object.assign({}, ho, { layer: 'front' }));
    const tips = []; for (const g of HG.groups) for (const c of g) if (c.r > 0.3) tips.push(c.tip);
    return { anchors, tips, vp: HG.vp, A2 };
  }
  // drops falling from the tips of her hair (and tears from her chin) toward his face: they come at the lens (grow, fly out)
  function c30Drips(ctx, t, tips, vp, fl, chin) {
    ctx.save(); ctx.lineCap = 'round';
    const srcs = tips.concat(chin ? [chin, chin] : []);
    srcs.forEach((tp, i) => {
      const isTear = chin && i >= tips.length, per = isTear ? 0.55 + 0.2 * (i - tips.length) : 0.7 + 0.6 * R1(i, 522), k = (((t + R1(i, 523) * per) % per) + per) % per / per;
      const x0 = tp[0], y0 = tp[1];
      if (k < 0.35) { const r = (isTear ? 3 : 2.5) + 5 * (k / 0.35); ctx.fillStyle = `rgba(214,226,250,${(0.5 + 0.4 * fl).toFixed(3)})`; ctx.beginPath(); ctx.arc(x0, y0 + r * 0.6, r, 0, TAU); ctx.fill(); return; }
      const kk = (k - 0.35) / 0.65, z = 1 / (1 - 0.8 * kk * kk), z2 = 1 / (1 - 0.8 * Math.max(0, kk - 0.07) ** 2);
      const dx = (x0 - vp[0]) * z + vp[0], dy = (y0 - vp[1]) * z + vp[1], dx2 = (x0 - vp[0]) * z2 + vp[0], dy2 = (y0 - vp[1]) * z2 + vp[1];
      ctx.strokeStyle = `rgba(214,226,250,${((isTear ? 0.55 : 0.32) + 0.4 * fl).toFixed(3)})`; ctx.lineWidth = (isTear ? 5 : 4) * z; ctx.beginPath(); ctx.moveTo(dx2, dy2); ctx.lineTo(dx, dy); ctx.stroke();
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
  // per still: camera [zoom, cy, rot], the sky crop, and the acting (the feeling changes from still to still)
  const C30F = {
    raised: { cam: [1.0, 450, 0], off: [0, 0] }, smear: { cam: [1.0, 450, 0], off: [0, 0] }, impact: { cam: [1.0, 450, 0], off: [0, 0] },
    D1: { cam: [1.0, 450, 0], off: [0, 0] }, D2: { cam: [1.3, 455, 0.035], off: [-60, 30] }, D3: { cam: [1.62, 462, -0.04], off: [50, 60] }, E: { cam: [1.9, 470, 0.02], off: [-20, 80] },
  };
  function c30Face(fr, t) {
    // raised / the strike: teeth clenched in fury and grief; D1–D2: the crying shout (V09, lip-sync); the line breaks off
    // at 108.5 → D3 she sobs, eyes squeezed; E: the scream's tail in the lightning
    if (fr === 'raised' || fr === 'smear' || fr === 'impact') return { expr: 'shout', eyes: { tears: 0.9, look: [0, 0.15] }, brows: { furrow: 1 }, mouth: { shape: 'shout', open: 0.75 }, yaw: 0.04, roll: -0.05 };
    if (fr === 'D1') return { expr: 'shout', eyes: { tears: 1, look: [0, 0.18] }, brows: { furrow: 1 }, mouth: { shape: 'shout', open: 0.18 }, talk: true, yaw: -0.03, roll: 0.03 };
    if (fr === 'D2') return { expr: 'shout', eyes: { tears: 1, look: [0, 0.2], open: 0.85 }, brows: { furrow: 1 }, mouth: { shape: 'shout', open: 0.22 }, talk: true, yaw: 0.05, roll: -0.06 };
    if (fr === 'D3') return { expr: 'teary', eyes: { tears: 1, open: 0.9, sad: 0.75, squeeze: 0.12, look: [0, 0.22] }, brows: { inner: 1, outer: -0.45, furrow: 0.9 }, mouth: { shape: 'shout', open: 0.45 + 0.25 * Math.max(0, sin(t * 11)), tremble: 0.7 }, blush: 0.55, yaw: -0.04, roll: 0.07 };
    return { expr: 'cry', eyes: { tears: 1, open: 0.1, squeeze: 1, sad: 1 }, brows: { inner: 1, outer: -0.5, furrow: 1 }, mouth: { shape: 'shout', open: 1, tremble: 0.4 }, blush: 0.6, yaw: 0.02, roll: -0.03 };
  }
  const c30FigCache = { key: null, res: null };
  PV.shot('C30', { draw(ctx, tIn, d, S) {
    const t = cutT(tIn, d), fr = c30Frame(t);
    const fl = flashOf(t, C30.strobes);
    // impact shakes: landing on his back, the fist on his chest
    const shk = (t0, a, dk) => (t > t0 ? a * Math.exp(-(t - t0) / dk) : 0);
    const amp = shk(C30.land, 34, 0.09) + shk(C30.hit, 30, 0.07);
    const sx = amp * N2(t * 40, 3), sy = amp * N2(5, t * 40);
    // her face is a close-up in a dark frame lit by strobes: less bloom so the thin lines of the eyes stay crisp
    S.post = Object.assign({}, S.post, { bloom: fr === 'tumble' || fr === 'sky' ? 0.28 : 0.17 });
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
      // her, astride him, against the storm sky. Each strobe is a new, closer still; she pants and shouts between them.
      const F = C30F[fr], tq = AN.onTwos(t), Tq = absT(S, 'C30', tq);   // her figure moves on twos (2-koma)
      const br = 0.5 + 0.5 * sin(tq * 8.2) * (0.6 + 0.4 * N2(tq * 1.3, 7));
      const cam = { zoom: F.cam[0], cx: 960, cy: F.cam[1], rot: F.cam[2] };
      // the sky: each strobe still is its own framing → a different 1:1 crop of the cached sky (no scaled blit)
      const amb = Math.max(fl, 0.14), off = F.off;
      ctx.drawImage(c30SkyCache('her', false), off[0] - SKM, off[1] - SKM);
      ctx.globalAlpha = clamp(amb); ctx.drawImage(c30SkyCache('her', true), off[0] - SKM, off[1] - SKM); ctx.globalAlpha = 1;
      ctx.save(); PV.camera(ctx, cam);
      if (fl > 0.25 && (fr === 'D1' || fr === 'D3' || fr === 'raised')) L.lightning(ctx, L.lightningPath(fr === 'D3' ? 3013 : 3011, 1700, 80, 260, 320, 0.42, 8), clamp(fl), '#e9f1ff');
      const vpS = [960, C30H.N[1] - 1.35 * C30H.S];
      rainAxial(ctx, t, { vp: vpS, dir: -1, zMin: 2.2, count: 260, seed: 302, alpha: 0.3 + 0.5 * fl, speed: 7, zNear: 0.8, zFar: 7, color: '200,214,240' });
      ctx.restore();
      let arm = 'rest';
      if (fr === 'raised') arm = 'raised'; else if (fr === 'smear') arm = 0.8;
      const flQ = Math.round(fl * 10) / 10, face = c30Face(fr, tq);
      // the figure layer is cached by its full input key (time on twos, flash in 1/10 steps): any render order gives the
      // same pixels; a sequential render repaints it only every other frame
      const key = fr + '|' + tq.toFixed(4) + '|' + flQ + '|' + arm, fb = PV.buffer('g08:c30fig', W + 2 * MG, H + 2 * MG);
      let res = c30FigCache.key === key ? c30FigCache.res : null;
      if (!res) {
        fb.ctx.clearRect(0, 0, W + 2 * MG, H + 2 * MG); fb.ctx.save(); fb.ctx.translate(MG, MG); PV.camera(fb.ctx, cam);
        res = c30Her(fb.ctx, { tq, T: Tq, fl: flQ, arm, br, face });
        res.m = fb.ctx.getTransform(); fb.ctx.restore(); c30FigCache.key = key; c30FigCache.res = res;
      }
      if (fr === 'smear') {
        // ONE smear frame: the fist already half-way down (big, near the lens), its trail stretched back up to where it
        // was raised, plus speed lines along the path
        ctx.save(); PV.camera(ctx, cam);
        const a0 = c30Arm(0, br), a1 = c30Arm(0.8, br), P0 = a0.wr, P1 = a1.wr, u = C30H.S;
        const dx = P1[0] - P0[0], dy = P1[1] - P0[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l, w0 = 0.06 * u, w1 = 0.36 * u;
        const g = ctx.createLinearGradient(P0[0], P0[1], P1[0], P1[1]); g.addColorStop(0, 'rgba(14,18,30,0)'); g.addColorStop(0.55, 'rgba(14,18,30,0.6)'); g.addColorStop(1, 'rgba(14,18,30,0.9)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(P0[0] + nx * w0, P0[1] + ny * w0); ctx.quadraticCurveTo((P0[0] + P1[0]) / 2 + nx * w1 * 1.1 + 0.2 * u, (P0[1] + P1[1]) / 2 + ny * w1, P1[0] + nx * w1, P1[1] + ny * w1);
        ctx.lineTo(P1[0] - nx * w1, P1[1] - ny * w1); ctx.quadraticCurveTo((P0[0] + P1[0]) / 2 - nx * w1 * 0.6 + 0.2 * u, (P0[1] + P1[1]) / 2 - ny * w1 * 0.6, P0[0] - nx * w0, P0[1] - ny * w0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(223,233,255,0.5)'; ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) { const f = (i + 0.5) / 9, o2 = (f - 0.5) * 2 * w1 * 1.3, x = P0[0] + dx * 0.15 + nx * o2, y = P0[1] + dy * 0.15 + ny * o2, L2 = l * (0.45 + 0.4 * R1(i, 541));
          ctx.lineWidth = 2 + 3 * R1(i, 542); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx / l * L2, y + dy / l * L2); ctx.stroke(); }
        ctx.restore();
      }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(sx, sy); ctx.drawImage(fb.canvas, MG, MG, W, H, 0, 0, W, H); ctx.restore();
      // drops from her hair tips and tears from her chin, falling toward his face
      { ctx.save(); PV.camera(ctx, cam); const ch = res.anchors && res.anchors.chin; c30Drips(ctx, t, res.tips, res.vp, fl, null); ctx.restore(); }
      // rain between them (near, toward the lens)
      rainAxial(ctx, t, { vp: [960 + (vpS[0] - 960) * F.cam[0], (vpS[1] - F.cam[1]) * F.cam[0] + F.cam[1]], dir: -1, zMax: 2.2, count: 150, seed: 303, alpha: 0.36 + 0.4 * fl, speed: 7, zNear: 0.8, zFar: 7, width: 1.5, color: '206,218,242' });
      if (fr === 'impact') {
        // the impact frame: two frames of a stark negative — white world, her dark figure, speed lines to the hit
        ctx.save(); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#e8eeff'; ctx.fillRect(0, 0, W, H); ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore();
        const hx = 1350, hy = 1150; ctx.save(); ctx.strokeStyle = 'rgba(10,12,20,0.75)'; ctx.lineCap = 'round';
        for (let i = 0; i < 40; i++) { const a = R1(i, 551) * TAU, r0 = 300 + 300 * R1(i, 552), r1 = r0 + 500 + 900 * R1(i, 553); ctx.lineWidth = 2 + 6 * R1(i, 554); ctx.beginPath(); ctx.moveTo(hx + cos(a) * r0, hy + sin(a) * r0); ctx.lineTo(hx + cos(a) * r1, hy + sin(a) * r1); ctx.stroke(); }
        ctx.restore();
      }
    }
    ctx.restore();
    // light: flash wash; the white-out of the scream (109.5)
    if (fl > 0.01 && fr !== 'impact') { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(206,220,255,${(0.14 * fl).toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    const wo = t >= 4.0 ? Math.exp(-(t - 4.0) / 0.14) : 0;
    if (wo > 0.01) { ctx.fillStyle = `rgba(245,248,255,${clamp(wo).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    if (fr !== 'impact') ctx.drawImage(vignette('c30', 0.3, 1.0, '3,5,10', 0.55), 0, 0);
  } });

  /* ====================================================================== C31 */
  // At road level, close on their heads: he lies on his back (head to the right), his face turned up and a little toward
  // us, the wet bangs pasted to his forehead — he says V10 to her (lip-sync). She has collapsed over his chest; her
  // head has dropped onto the wet road beside his neck, her face toward us through the wet strands, tears running,
  // eyes dull (原作「隣にある荒い息。色がない先輩の顔」「被さる身体はピクリともしない」). As his line lands her eyes fill
  // and close; 115.0 she raises her upper body and cries up at the sky — the camera follows her up and out (slow tilt +
  // pan + pull back), 115.82 the lightning behind her. World = px of the static framing (the road contact line at
  // C31W.road); the camera maps world → screen as C + z·(p − f).
  const C31 = { flash: [[0.0, 0.5, 0.3], [2.9, 0.4, 0.22], [5.82, 0.45, 1], [6.3, 0.3, 0.5]] };
  const C31W = { road: 930, Sb: 360, Nb: [1218, 768], Sh: 330, hipLie: [-60, 640], hipUp: [-70, 705], Ls: 720 };
  const C31BM = [180, 290];   // backdrop cache margins (the camera pans left/up across it)
  function c31Cam(t) {
    const k = E.inOutCubic(clamp((t - 5.05) / 1.35));     // static while she lies on him (storyboard: static → slow tilt up)
    return { fx: lerp(1010, 40, k), fy: lerp(690, -120, k), z: lerp(1.22, 1.0, k), k };
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
  // her pose: R = rise of the spine (115.0), tilt = the head thrown back, sob = the shoulders heaving as she cries
  function c31HerPose(t) {
    return { R: E.inOutCubic(clamp((t - 5.0) / 1.15)), tilt: E.inOutCubic(clamp((t - 5.4) / 0.95)), sob: t > 5.9 ? Math.max(0, sin((t - 5.9) * 9.5)) * sm(5.9, 6.2, t) : 0 };
  }
  // acting, by the line (V10 110.4–115.1: 「自分のために生きられないなら」110.45–112.0 /「……」/「俺のために生き」112.65–113.3 /
  // 「てよ」114.2–114.75). t = cut time on twos.
  function c31Acting(t, pz) {
    // him: first the sky (the late thunder 110.1), then his eyes go to her and stay; resolve hardens on 「俺のために」
    const toHer = sm(0.25, 0.75, t), resolve = sm(2.5, 3.0, t);
    const him = { expr: 'determined', eyes: { open: lerp(1.05, 1.0, toHer), look: [lerp(0.05, -0.5, toHer), lerp(-0.45, 0.35, toHer)], tears: 0.35 + 0.25 * sm(3.5, 4.6, t), hlK: 1.15 },
      brows: { inner: lerp(0.45, -0.2, resolve), outer: 0.1, furrow: lerp(0.35, 0.6, resolve) }, talk: true, blush: 0.12 };
    // her: dull, wet, motionless → 114.3 the words reach her: the eyes widen and fill, the lips shake → 114.8 they close,
    // the sob breaks → 115.0 she rises crying aloud (the voice is lost in the rain)
    const hear = sm(4.25, 4.6, t), close = sm(4.75, 5.0, t), up = pz.R;
    let her;
    if (up < 0.05 && close < 0.5) her = { expr: 'teary', eyes: { open: lerp(0.72, 0.98, hear), tears: 1, shine: lerp(0.3, 0.85, hear), dull: lerp(0.65, 0.1, hear), sad: lerp(0.3, 0.7, hear), look: [0.25, 0.1] },
      brows: { inner: lerp(0.25, 1, hear), outer: -0.2, furrow: lerp(0.1, 0.6, hear) }, mouth: { shape: 'frown', open: lerp(0.18, 0.3, hear), tremble: hear * 0.8 }, blush: 0.15, noBlink: true };
    else her = { expr: 'cry', eyes: { tears: 1, open: lerp(0.2, 0.08, up), squeeze: 1, sad: 1 }, brows: { inner: 1, outer: -0.5, furrow: 1 },
      mouth: { shape: 'shout', open: lerp(0.45, 0.85, up) + 0.12 * pz.sob, tremble: 0.6 }, blush: 0.55 };
    return { him, her };
  }
  // both of them in world px. o: tq, T (global, on twos), fl (flash, quantised), pz (her pose). Returns drip sources.
  function c31Pair(ctx, o) {
    const { R, tilt, sob } = o.pz, fl = o.fl, W31 = C31W, road = W31.road;
    const Lt = mixLight('storm', 'lightning', 0.12 + 0.75 * fl), FL = AN.faceLight(Lt), lv = [0, -1];
    const rimCol = Lt.rim || '#dfe8ff', rimA = 0.6 + 0.4 * fl;
    const skin = AN.mat('skin', FL), cloth = Lt;   // clothes stay in the storm's dark (only the faces are lifted)
    const shirtM = AN.mat('shirt', cloth, { wet: 1 }), gownM = AN.mat('gown', cloth, { wet: 1 }), HMh = AN.mat('hair_senpai', Lt, { wet: 1 }), HMb = AN.mat('hair_boy', Lt, { wet: 1 });
    const shirt = { base: AN.mixHex(AN.mixHex(shirtM.base, skin.base, 0.3), shirtM.shade, 0.35), shade: AN.mixHex(shirtM.shade, shirtM.deep, 0.45), deep: shirtM.deep, hi: shirtM.hi, line: shirtM.line };
    const gown = { base: AN.mixHex(gownM.base, gownM.shade, 0.45), shade: AN.mixHex(gownM.shade, gownM.deep, 0.55), deep: gownM.deep, hi: gownM.hi, line: gownM.line };
    const act = c31Acting(o.tq, o.pz);
    const Sb = W31.Sb, Sh = W31.Sh, Nb = W31.Nb, lwB = AN.inkW(Sb) * 1.05, lwH = AN.inkW(Sh) * 1.05;
    const br = 0.5 + 0.5 * sin(o.tq * 2.6);                   // his chest rises and falls under her
    // ---- HIM, on his back (dark in the storm, the sky's rim along his chest): his neck runs into the open collar; the
    //      near shoulder rounds down to the road; the chest goes on under her to the left
    const neckP = capsulePath([Nb[0] + 0.04 * Sb, Nb[1] + 0.01 * Sb], [Nb[0] - 0.3 * Sb, Nb[1] + 0.05 * Sb], 0.115 * Sb, 0.13 * Sb);
    celPart(ctx, neckP, skin, { lw: lwB * 0.8, lv, shade: Sb * 0.07, shadeCol: skin.shade });
    const body = pathOf([[Nb[0] - 0.2 * Sb, Nb[1] - 0.16 * Sb], [Nb[0] - 0.42 * Sb, Nb[1] - 0.36 * Sb - 0.02 * Sb * br], [Nb[0] - 0.95 * Sb, Nb[1] - 0.47 * Sb - 0.03 * Sb * br], [Nb[0] - 1.8 * Sb, Nb[1] - 0.45 * Sb],
      [-2600, Nb[1] - 0.38 * Sb, 1], [-2600, road + 4, 1], [Nb[0] - 0.55 * Sb, road + 4], [Nb[0] - 0.3 * Sb, road - 0.07 * Sb], [Nb[0] - 0.2 * Sb, Nb[1] + 0.2 * Sb], [Nb[0] - 0.24 * Sb, Nb[1] + 0.06 * Sb]]);
    celPart(ctx, body, shirt, { lw: lwB, lv, shade: Sb * 0.16, rim: Sb * 0.02, rimCol, rimA });
    ctx.save(); ctx.clip(body);
    // the open collar (two points lying on his chest and toward the road) and wet folds pulled across the chest
    const col1 = pathOf([[Nb[0] - 0.2 * Sb, Nb[1] - 0.14 * Sb], [Nb[0] - 0.36 * Sb, Nb[1] - 0.3 * Sb], [Nb[0] - 0.6 * Sb, Nb[1] - 0.2 * Sb, 1], [Nb[0] - 0.34 * Sb, Nb[1] - 0.1 * Sb]]);
    const col2 = pathOf([[Nb[0] - 0.22 * Sb, Nb[1] + 0.16 * Sb], [Nb[0] - 0.36 * Sb, Nb[1] + 0.3 * Sb], [Nb[0] - 0.62 * Sb, Nb[1] + 0.22 * Sb, 1], [Nb[0] - 0.36 * Sb, Nb[1] + 0.1 * Sb]]);
    celPart(ctx, col1, shirt, { lw: lwB * 0.6, lv, shade: Sb * 0.03, rim: Sb * 0.012, rimCol, rimA: rimA * 0.8 });
    celPart(ctx, col2, shirt, { lw: lwB * 0.6, lv, shade: Sb * 0.05 });
    for (let i = 0; i < 3; i++) { const x0 = Nb[0] - (0.8 + 0.34 * i) * Sb; inkLine(ctx, [[x0, Nb[1] - 0.42 * Sb], [x0 - 0.1 * Sb, Nb[1] - 0.12 * Sb], [x0 - 0.06 * Sb, Nb[1] + 0.22 * Sb]], (u) => lwB * 0.45 * Math.sin(PI * u), shirtM.line); }
    ctx.restore();
    // his head: lying, crown to the right, face up and turned a little toward us; wet bangs pasted to the forehead
    const himHead = { who: 'boy', x: Nb[0], y: Nb[1], size: Sb, yaw: -0.5, pitch: 0, roll: HP + 0.04, light: Lt, rimDir: -HP, lightDir: -HP, shade: 0.08, rim: 1.1, T: o.T, seed: 7,
      hair: { style: 'wet', still: true, wind: 1.6, windDir: 0.35 }, expr: act.him.expr, eyes: act.him.eyes, brows: act.him.brows, mouth: act.him.mouth, blush: act.him.blush, talk: act.him.talk };   // lying on his back: gravity pulls the wet bangs back off his eyes, toward the crown
    AN.head(ctx, himHead);
    // ---- HER: the spine from the hips over his chest; lying: the head dropped onto the road beside his neck
    const hip = [lerp(W31.hipLie[0], W31.hipUp[0], R), lerp(W31.hipLie[1], W31.hipUp[1], R)];
    const phiLie = 0.13, phiUp = -HP + 0.14, phi = lerp(phiLie, phiUp, R) + 0.03 * sob, u = [cos(phi), sin(phi)], nrm = [-u[1], u[0]];
    const Ls = W31.Ls * (1 + 0.01 * sob), nb = [hip[0] + u[0] * Ls, hip[1] + u[1] * Ls];
    const phiN = phi + lerp(0.14, -0.05, R) - 0.25 * tilt, uN = [cos(phiN), sin(phiN)];
    const Nh = [nb[0] + uN[0] * 0.34 * Sh, nb[1] + uN[1] * 0.34 * Sh];
    const P = (a, b) => [hip[0] + u[0] * a + nrm[0] * b, hip[1] + u[1] * a + nrm[1] * b];   // a along the spine, b to her front (+, toward his body when lying)
    // her torso (the wet gown): back contour (−nrm) and front (+nrm) from the hips to the shoulders
    const prof = [[0, -0.34, 0.3], [0.2, -0.3, 0.24], [0.4, -0.28, 0.25], [0.6, -0.29, 0.36], [0.74, -0.3, 0.37], [0.86, -0.28, 0.27], [0.95, -0.22, 0.17], [1.0, -0.12, 0.11]];
    const tp = []; prof.forEach(([a, bb]) => tp.push(P(a * Ls, bb * Sh))); for (let i = prof.length - 1; i >= 0; i--) tp.push(P(prof[i][0] * Ls, prof[i][2] * Sh));
    const torso = pathOf(tp);
    // her near (right) thigh, knee on the road beside him, once she is up
    if (R > 0.05) { const kn = [hip[0] + 0.85 * Sh, road - 0.05 * Sh], th = capsulePath(P(0.02 * Ls, 0.1 * Sh), kn, 0.3 * Sh, 0.2 * Sh); ctx.save(); ctx.globalAlpha = sm(0.05, 0.4, R); celPart(ctx, th, gown, { lw: lwH, lv, shade: Sh * 0.08, rim: Sh * 0.02, rimCol, rimA }); ctx.restore(); }
    celPart(ctx, torso, gown, { lw: lwH, lv: [lerp(0.15, -0.55, R), lerp(-1, -0.8, R)], shade: Sh * 0.12, rim: Sh * 0.026, rimCol, rimA });
    ctx.save(); ctx.clip(torso);   // the wet gown clings: a few folds pulled toward the shoulder, the side seam
    for (let i = 0; i < 3; i++) inkLine(ctx, [P((0.48 + 0.14 * i) * Ls, -0.2 * Sh), P((0.56 + 0.14 * i) * Ls, 0.02 * Sh), P((0.6 + 0.15 * i) * Ls, 0.2 * Sh)], (q) => lwH * 0.5 * Math.sin(PI * q), gown.line);
    inkLine(ctx, [P(0.1 * Ls, 0.05 * Sh), P(0.5 * Ls, 0.03 * Sh), P(0.86 * Ls, 0.06 * Sh)], (q) => lwH * 0.4 * Math.sin(PI * q), gown.line);
    ctx.restore();
    // the neck
    const neckH = capsulePath(nb, Nh, 0.11 * Sh, 0.095 * Sh);
    celPart(ctx, neckH, skin, { lw: lwH * 0.8, lv, shade: Sh * 0.05, shadeCol: skin.shade });
    // her head: the library head (face, wet bangs, the locks that hang across her face; the long curtain falls toward
    // the road — clipped at the road line, it does not go through it)
    const herHead = { who: 'senpai', x: Nh[0], y: Nh[1], size: Sh, yaw: lerp(-0.05, 0.62, sm(0, 1, R)), pitch: 0.45 * tilt, roll: phiN + HP - 0.2 * tilt, light: Lt, rimDir: -HP, lightDir: -HP, shade: 0.08, rim: 1.15, T: o.T, seed: 3,
      hair: { style: 'wet', still: true }, expr: act.her.expr, eyes: act.her.eyes, brows: act.her.brows, mouth: act.her.mouth, blush: act.her.blush, noBlink: act.her.noBlink };
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, -4000, 9000, road + 4 + 4000); ctx.clip();
    AN.headBack(ctx, herHead);
    ctx.restore();
    // her near (right) arm: lying, the upper arm down her side to the road; up, the upper arm hangs at her side and the
    // forearm in the white cast is carried by the sling across her belly — from this side we see the elbow end of the
    // cast, the sling pouch under it and the strap going up across her chest to the far shoulder
    const lvB = [lerp(0, -0.5, R), lerp(-1, -0.85, R)];   // up: the lightning sky is behind her (rim on her back)
    const sh = P(0.9 * Ls, 0.06 * Sh), el = R < 0.5 ? [sh[0] + 0.12 * Sh, road - 0.12 * Sh] : P(0.6 * Ls, 0.1 * Sh);
    if (R > 0.35) {
      const a = sm(0.35, 0.7, R), cc = P(0.58 * Ls, 0.3 * Sh), cr = 0.15 * Sh;
      ctx.save(); ctx.globalAlpha = a;
      const strap = ribbonPath([P(0.6 * Ls, 0.36 * Sh), P(0.78 * Ls, 0.28 * Sh), P(0.97 * Ls, 0.02 * Sh)], [0.03 * Sh, 0.032 * Sh, 0.03 * Sh]);
      const sl = { base: AN.mixHex('#55618a', '#c6d2ee', fl), shade: AN.mixHex('#323b58', '#8592b6', fl), line: '#262c40', hi: '#dfe8ff' };
      celPart(ctx, strap, sl, { lw: lwH * 0.6, lv: lvB, shade: Sh * 0.015 });
      const pouch = pathOf([[cc[0] - cr * 1.25, cc[1] - cr * 0.2], [cc[0] - cr * 0.9, cc[1] + cr * 1.15], [cc[0] + cr * 1.1, cc[1] + cr * 1.05], [cc[0] + cr * 1.3, cc[1] - cr * 0.1, 1], [cc[0], cc[1] + cr * 0.4]]);
      const castEnd = pathOf([[cc[0] - cr, cc[1] - cr * 0.85], [cc[0] + cr * 0.95, cc[1] - cr * 0.9], [cc[0] + cr * 1.1, cc[1] + cr * 0.7], [cc[0] - cr * 0.9, cc[1] + cr * 0.75]]);
      celPart(ctx, castEnd, { base: AN.mixHex('#aab6d2', '#f4f6fc', fl), shade: AN.mixHex('#707ca0', '#c4cde4', fl), line: '#46506c', hi: '#ffffff' }, { lw: lwH * 0.8, lv: lvB, shade: Sh * 0.06, rim: Sh * 0.02, rimCol, rimA });
      celPart(ctx, pouch, sl, { lw: lwH * 0.7, lv: lvB, shade: Sh * 0.05 });
      ctx.restore();
    }
    celPart(ctx, capsulePath(sh, el, 0.125 * Sh, 0.1 * Sh), gown, { lw: lwH, lv: lvB, shade: Sh * 0.05, rim: Sh * 0.018, rimCol, rimA });
    const anc = AN.head(ctx, Object.assign({}, herHead, { layer: 'front' }));
    // wet strands spread on the road toward the lens (lying), and drip sources
    const tips = [];
    if (R < 0.6) {
      ctx.save(); ctx.globalAlpha = 1 - sm(0.2, 0.6, R);
      for (let i = 0; i < 7; i++) {
        const r = R1(i, 311), x0 = Nh[0] + (0.05 + 0.13 * i) * Sh, len = (0.25 + 0.3 * r) * Sh, pts = [];
        for (let j = 0; j <= 6; j++) { const q = j / 6; pts.push([x0 + (i - 3) * 0.04 * Sh * q, road + 2 + q * len * 0.35 + 0.02 * Sh * sin(q * 4 + i)]); }
        AN.taper(ctx, pts, (q) => Math.max(0.8, Sh * 0.022 * (1 - q) * (0.6 + 0.6 * r)), HMh.base, true);
        if (r > 0.4) tips.push({ p: pts[6], lie: 1 });
      }
      ctx.restore();
    }
    if (R > 0.3) for (let i = 0; i < 4; i++) tips.push({ p: [Nh[0] - (0.35 + 0.08 * i) * Sh, Nh[1] + (1.3 + 0.25 * R1(i, 331)) * Sh], lie: 0 });
    tips.push({ p: [Nb[0] + 0.55 * Sb, road - 0.02 * Sb], lie: 1 });   // his hair on the road
    return { tips, chin: anc.chin };
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
  PV.shot('C31', { draw(ctx, tIn, d, S) {
    const t = cutT(tIn, d);
    const fl = flashOf(t, C31.flash), cm = c31Cam(t);
    const toS = (p) => [960 + (p[0] - cm.fx) * cm.z, 540 + (p[1] - cm.fy) * cm.z];
    S.post = Object.assign({}, S.post, { bloom: 0.2 });   // two faces close up in a dark frame: keep the eye lines crisp
    // 1) the storm backdrop (far: parallax, unscaled 1:1 blits), its lit version with the flash
    const bx = clamp((cm.fx - 1010) * 0.18, -178, 18), by = clamp((cm.fy - 690) * 0.33, -288, 18);
    ctx.drawImage(c31Backdrop(false), -C31BM[0] - bx, -C31BM[1] - by);
    if (fl > 0.01) { ctx.save(); ctx.globalAlpha = clamp(fl); ctx.drawImage(c31Backdrop(true), -C31BM[0] - bx, -C31BM[1] - by); ctx.restore(); }
    if (fl > 0.3) { const ox = -C31BM[0] - bx + 40, oy = -C31BM[1] - by; L.lightning(ctx, L.lightningPath(3101, ox + 1330, oy + 140, ox + 1200, oy + 980, 0.36, 7), clamp((fl - 0.3) / 0.7), '#e9f1ff'); }
    // 2) the two of them, held on twos (acting, lip-sync and blinks move on twos): painted with the pose, flash and camera
    //    of the quantised time, re-projected to the camera of the in-between frame
    const tq = AN.onTwos(t), Tq = absT(S, 'C31', tq), cQ = c31Cam(tq), flQ = Math.round(flashOf(tq, C31.flash) * 10) / 10;
    const held = heldLayer('c31pair', tq.toFixed(4) + '|' + flQ, cQ, cm, (c) => {
      c.save(); c.translate(960, 540); c.scale(cQ.z, cQ.z); c.translate(-cQ.fx, -cQ.fy);
      const r = c31Pair(c, { tq, T: Tq, fl: flQ, pz: c31HerPose(tq) });
      c.restore(); return r;
    });
    const res = held.res; held.draw(ctx);
    // 3) the wet road mirrors everything above it (darker, broken by ripples)
    const roadY = Math.round(toS([0, C31W.road])[1]);
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
      if (k < 0.5) { const rr = (2.5 + 3.5 * k / 0.5) * cm.z; ctx.fillStyle = `rgba(206,220,250,${(0.5 + 0.4 * fl).toFixed(3)})`; ctx.beginPath(); ctx.arc(p[0], p[1] + rr, rr, 0, TAU); ctx.fill(); return; }
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
  // 116.7 he sits up and pulls her in. Seen from behind her left shoulder: her face in front, turned to us on his
  // shoulder — the wide wet eyes of someone being held (されるがまま) — and his determined face over her right shoulder,
  // saying V11 (lip-sync), the eyes wet; the white sling strap at the back of her neck, her left arm hanging limp over
  // his arm. As the music turns to D major a pale light opens in the clouds behind them. From 「先輩の右手になるよ」 the
  // camera pushes in to HIS RIGHT HAND on her back — the fingers dug into the wet gown, the ends of the fingers blanched
  // white (原作4198). 122.9 the lightning's white freezes the frame (123.3 the sound is cut; hard cut to C33).
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
  // The embrace, from behind her left shoulder (world px = the two-shot framing). Her head in front, on his right
  // shoulder, the face turned to us (3/4 left): wide wet eyes, されるがまま; his determined face over her right shoulder
  // (3/4 right), V11 lip-sync, wet eyes. His right arm comes round under her limp left arm and his right hand grips her
  // back (the push-in target); his left arm holds her lower back. e = the pull (he sits up and draws her in).
  const C32L = { her: { N: [742, 572], S: 300 }, him: { N: [1196, 548], S: 318 }, wrist: [646, 806], rot: HP - 0.2, hs: 1.14 };
  function c32Acting(t) {
    // V11 117.0–121.4: 「全部は無理だけど」117.1–118.1 /「……」/「俺が」118.7–119.1 /「……」/「先輩の右手になるよ」119.75–121.2
    const e = c32Embrace(t), land = sm(3.25, 3.9, t), cry = sm(4.4, 5.2, t);
    const him = { expr: 'determined', eyes: { tears: 0.55 + 0.3 * land, look: [0.25, 0.1], open: 1.05 - 0.6 * (1 - sm(0.1, 0.5, t)) }, brows: { inner: lerp(0.35, -0.3, sm(1.2, 2.2, t)), outer: 0.15, furrow: 0.55 }, talk: true, blush: 0.15 };
    const her = { expr: 'surprise', eyes: { open: lerp(0.9, 1.15, sm(0.2, 0.6, t)) - 0.3 * cry, wide: lerp(0.4, 0.9, sm(0.2, 0.6, t)) * (1 - 0.6 * cry), tears: lerp(0.55, 1, land), sad: 0.4 * land, look: [-0.15, 0.05] },
      brows: { inner: lerp(0.6, 1, land), outer: lerp(0.4, -0.3, land), furrow: 0.5 * land }, mouth: { shape: land > 0.5 ? 'frown' : 'o', open: lerp(0.28, 0.22, land), tremble: 0.7 * land }, blush: 0.3 + 0.2 * land, noBlink: true };
    return { him, her, e };
  }
  function c32Pair(ctx, o) {
    const t = o.tq, fl = o.fl, sob = o.sob, A = c32Acting(t), e = A.e, eo = E.outCubic(e);
    const Lt = mixLight('storm', 'lightning', 0.15 + 0.55 * fl + 0.12 * o.hope), FL = AN.faceLight(Lt);
    const lv = [0.15, -0.99], rimCol = Lt.rim || '#e4ecff', rimA = 0.6 + 0.4 * fl;
    const skin = AN.mat('skin', FL), shirtM = AN.mat('shirt', Lt, { wet: 1 }), gownM = AN.mat('gown', Lt, { wet: 1 });
    const shirt = { base: AN.mixHex(AN.mixHex(shirtM.base, skin.base, 0.25), shirtM.shade, 0.3), shade: AN.mixHex(shirtM.shade, shirtM.deep, 0.45), deep: shirtM.deep, hi: shirtM.hi, line: shirtM.line };
    const gown = { base: AN.mixHex(gownM.base, gownM.shade, 0.4), shade: AN.mixHex(gownM.shade, gownM.deep, 0.5), deep: gownM.deep, hi: gownM.hi, line: gownM.line };
    const Hh = C32L.her, Hm = C32L.him, Sh = Hh.S, Sm = Hm.S, lwH = AN.inkW(Sh) * 1.05, lwM = AN.inkW(Sm) * 1.05;
    // the pull: he comes up from below; her head drops onto his shoulder; the shoulders heave as she sobs
    const mdy = (1 - eo) * 0.95 * Sm, hdy = (1 - eo) * -0.12 * Sh + 0.012 * Sh * sob;
    const Nm = [Hm.N[0] + (1 - eo) * 0.1 * Sm, Hm.N[1] + mdy], Nh = [Hh.N[0], Hh.N[1] + hdy];
    // ---- HIM (behind her): the soaked white shirt, open collar, his left shoulder beyond hers
    const torsoM = pathOf([[Nm[0] - 0.14 * Sm, Nm[1] + 0.2 * Sm], [Nm[0] - 0.75 * Sm, Nm[1] + 0.4 * Sm], [Nm[0] - 0.85 * Sm, Nm[1] + 2.2 * Sm, 1], [Nm[0] + 0.78 * Sm, Nm[1] + 2.2 * Sm, 1],
      [Nm[0] + 0.72 * Sm, Nm[1] + 0.62 * Sm], [Nm[0] + 0.6 * Sm, Nm[1] + 0.36 * Sm], [Nm[0] + 0.14 * Sm, Nm[1] + 0.2 * Sm]]);
    const ho = { who: 'boy', x: Nm[0], y: Nm[1], size: Sm, yaw: 0.5, pitch: -0.04, roll: 0.08, light: Lt, rimDir: -HP + 0.2, lightDir: -HP + 0.2, shade: 0.08, rim: 1.1, T: o.T, seed: 7,
      hair: { style: 'wet', still: true }, expr: A.him.expr, eyes: A.him.eyes, brows: A.him.brows, mouth: A.him.mouth, blush: A.him.blush, talk: A.him.talk };
    AN.headBack(ctx, ho);
    AN.head(ctx, Object.assign({}, ho, { layer: 'neck', neckLen: 0.5, neckFade: true, neckFlare: true }));
    celPart(ctx, torsoM, shirt, { lw: lwM, lv, shade: Sm * 0.12, rim: Sm * 0.02, rimCol, rimA });
    ctx.save(); ctx.clip(torsoM);
    celPart(ctx, pathOf([[Nm[0] + 0.02 * Sm, Nm[1] + 0.16 * Sm], [Nm[0] + 0.3 * Sm, Nm[1] + 0.26 * Sm], [Nm[0] + 0.22 * Sm, Nm[1] + 0.52 * Sm, 1], [Nm[0] + 0.08 * Sm, Nm[1] + 0.36 * Sm]]), shirt, { lw: lwM * 0.6, lv, shade: Sm * 0.03, rim: Sm * 0.012, rimCol, rimA });
    for (let i = 0; i < 3; i++) inkLine(ctx, [[Nm[0] + (0.2 + 0.14 * i) * Sm, Nm[1] + 0.7 * Sm], [Nm[0] + (0.1 + 0.16 * i) * Sm, Nm[1] + 1.0 * Sm], [Nm[0] + (0.12 + 0.16 * i) * Sm, Nm[1] + 1.4 * Sm]], (q) => lwM * 0.45 * Math.sin(PI * q), shirt.line);
    ctx.restore();
    AN.head(ctx, Object.assign({}, ho, { layer: 'front' }));
    // ---- HER (in front): her back in the wet gown, seen from behind her left shoulder
    const torsoH = pathOf([[Nh[0] - 0.1 * Sh, Nh[1] + 0.16 * Sh], [Nh[0] - 0.46 * Sh, Nh[1] + 0.26 * Sh], [Nh[0] - 0.66 * Sh, Nh[1] + 0.44 * Sh], [Nh[0] - 0.66 * Sh, Nh[1] + 1.2 * Sh], [Nh[0] - 0.6 * Sh, Nh[1] + 2.3 * Sh, 1],
      [Nh[0] + 0.56 * Sh, Nh[1] + 2.3 * Sh, 1], [Nh[0] + 0.64 * Sh, Nh[1] + 1.05 * Sh], [Nh[0] + 0.6 * Sh, Nh[1] + 0.42 * Sh], [Nh[0] + 0.4 * Sh, Nh[1] + 0.24 * Sh], [Nh[0] + 0.1 * Sh, Nh[1] + 0.16 * Sh]]);
    const hoH = { who: 'senpai', x: Nh[0], y: Nh[1], size: Sh, yaw: -0.58, pitch: 0.02, roll: lerp(0.04, -0.16, eo), light: Lt, rimDir: -HP + 0.2, lightDir: -HP + 0.2, shade: 0.08, rim: 1.15, T: o.T, seed: 3,
      hair: { style: 'wet', still: true }, expr: A.her.expr, eyes: A.her.eyes, brows: A.her.brows, mouth: A.her.mouth, blush: A.her.blush, noBlink: A.her.noBlink };
    AN.head(ctx, Object.assign({}, hoH, { layer: 'neck', neckLen: 0.45, neckFade: true, neckFlare: true }));
    celPart(ctx, torsoH, gown, { lw: lwH, lv, shade: Sh * 0.12, rim: Sh * 0.024, rimCol, rimA });
    ctx.save(); ctx.clip(torsoH);   // the shoulder blades and the spine under the clinging wet cloth
    inkLine(ctx, [[Nh[0] - 0.04 * Sh, Nh[1] + 0.4 * Sh], [Nh[0] - 0.02 * Sh, Nh[1] + 1.2 * Sh], [Nh[0] + 0.02 * Sh, Nh[1] + 2.2 * Sh]], (q) => lwH * 0.5 * Math.sin(PI * q), gown.line);
    for (const s of [-1, 1]) inkLine(ctx, [[Nh[0] + s * 0.42 * Sh, Nh[1] + 0.55 * Sh], [Nh[0] + s * 0.3 * Sh, Nh[1] + 0.85 * Sh], [Nh[0] + s * 0.14 * Sh, Nh[1] + 0.95 * Sh]], (q) => lwH * 0.45 * Math.sin(PI * q), gown.line);
    ctx.restore();
    // his left arm round her right side: the hand on her lower back (the far hand: simple, in shadow)
    if (eo > 0.05) {
      ctx.save(); ctx.globalAlpha = sm(0.05, 0.4, eo);
      const sh2 = [Nm[0] + 0.62 * Sm, Nm[1] + 0.6 * Sm], el2 = [Nm[0] + 0.5 * Sm, Nm[1] + 1.5 * Sm], wr2 = [Hh.N[0] + 0.32 * Sh, Hh.N[1] + 1.62 * Sh];
      celPart(ctx, capsulePath(sh2, el2, 0.14 * Sm, 0.12 * Sm), shirt, { lw: lwM, lv, shade: Sm * 0.05, rim: Sm * 0.015, rimCol, rimA });
      celPart(ctx, capsulePath(el2, wr2, 0.12 * Sm, 0.1 * Sm), shirt, { lw: lwM, lv, shade: Sm * 0.05, rim: Sm * 0.015, rimCol, rimA });
      L.hand(ctx, { side: 'L', kind: 'him', view: 'back', pitch: 0.25, yaw: 0.1, x: wr2[0] + 0.04 * Sm, y: wr2[1], rot: -HP - 0.12, scale: Sm * 0.0034, curl: [0.3, 0.4, 0.45, 0.5, 0.55], spread: 0.2, arm: 10,
        keyColor: FL.light, fillColor: AN.mixHex(FL.shadow, FL.light, 0.4), tint: 0.9 });
      ctx.restore();
    }
    // her long wet hair down her back (the library's curtain, painted over her back)
    AN.headBack(ctx, hoH);
    // the white sling strap across the base of her neck (as at the railing in C28)
    const strap = ribbonPath([[Nh[0] - 0.32 * Sh, Nh[1] + 0.3 * Sh], [Nh[0] - 0.05 * Sh, Nh[1] + 0.26 * Sh], [Nh[0] + 0.3 * Sh, Nh[1] + 0.28 * Sh], [Nh[0] + 0.52 * Sh, Nh[1] + 0.4 * Sh]], [0.035 * Sh, 0.035 * Sh, 0.035 * Sh, 0.03 * Sh]);
    celPart(ctx, strap, { base: AN.mixHex('#8c99bb', '#e6edfb', fl), shade: AN.mixHex('#56628a', '#b0bcd8', fl), line: '#3a4360', hi: '#ffffff' }, { lw: lwH * 0.6, lv, shade: Sh * 0.015 });
    // his right arm comes round under her limp left arm: the forearm (wet sleeve) across her back to the wrist
    const wr = C32L.wrist, fa0 = [Nh[0] - 0.74 * Sh, Nh[1] + 0.98 * Sh];
    if (eo > 0.05) { ctx.save(); ctx.globalAlpha = sm(0.05, 0.4, eo); celPart(ctx, capsulePath(fa0, [wr[0] - 0.02 * Sh, wr[1] + 0.02 * Sh], 0.12 * Sm, 0.105 * Sm), shirt, { lw: lwM, lv, shade: Sm * 0.05, rim: Sm * 0.016, rimCol, rimA }); ctx.restore(); }
    // her left arm hanging limp (されるがまま): over his arm at her side
    const sh = [Nh[0] - 0.6 * Sh, Nh[1] + 0.42 * Sh], el = [Nh[0] - 0.74 * Sh, Nh[1] + 1.22 * Sh + 0.01 * Sh * sob], wr3 = [Nh[0] - 0.72 * Sh, Nh[1] + 2.0 * Sh];
    celPart(ctx, capsulePath(sh, el, 0.125 * Sh, 0.1 * Sh), gown, { lw: lwH, lv, shade: Sh * 0.05, rim: Sh * 0.018, rimCol, rimA });
    celPart(ctx, capsulePath(el, wr3, 0.1 * Sh, 0.085 * Sh), gown, { lw: lwH, lv, shade: Sh * 0.05, rim: Sh * 0.018, rimCol, rimA });
    // her face (front layer) last: she is nearest
    AN.head(ctx, Object.assign({}, hoH, { layer: 'front' }));
  }
  PV.shot('C32', { draw(ctx, tIn, d, S) {
    const tRaw = cutT(tIn, d), t = Math.min(tRaw, C32.freeze);       // 122.9: the frame freezes in the lightning
    S.post = Object.assign({}, S.post, { bloom: 0.2 });   // two faces close in a dark frame: keep the thin eye lines
    const fl = flashOf(t, C32.flash), e = c32Embrace(t), grip = c32Grip(t);
    const sob = Math.max(0, sin(t * 7.3)) * (0.5 + 0.5 * N2(t * 0.9, 2)) * sm(0.6, 1.2, t);
    const u = 92 * C32.sc, WR = C32L.wrist, hw = [WR[0] + 0.52 * 195 * C32L.hs, WR[1] - 0.1 * 195 * C32L.hs];   // the push target: his knuckles
    const c32Cam = (tt) => { const p = E.inOutCubic(clamp((tt - C32.push[0]) / (C32.push[1] - C32.push[0])));
      return { z: lerp(1.0 + 0.012 * tt, 4.0, Math.pow(p, 1.5)), fx: lerp(960, hw[0], p), fy: lerp(540, hw[1], p), pk: p }; };
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
    const flQ10 = Math.round(flQ * 10) / 10, Tq = absT(S, 'C32', tq);
    const pair = heldLayer('c32pair', tq.toFixed(4) + '|' + flQ10, cQ, cN, (c) => {
      c.save(); PV.camera(c, { zoom: cQ.z, cx: cQ.fx, cy: cQ.fy, x: 960 - cQ.fx, y: 540 - cQ.fy });
      c32Pair(c, { tq, T: Tq, fl: flQ10, sob: sobQ, hope: hopeQ });
      c.restore();
    }, cQ.z > 1.6 ? 0.5 : 1);   // close in, her back and hair are only the backdrop of the hand: half resolution
    ctx.restore(); pair.draw(ctx); ctx.save(); PV.camera(ctx, cam);
    // 3) his right hand on her back, the back of the hand toward us, the fingers clawed into the wet cloth. In the wide
    //    shot it is as dark as the silhouettes; the push-in reveals it (the knuckles and the bent finger ends white).
    const gripQ = c32Grip(tq), cl = 0.3 + 0.7 * gripQ, trem = 0.025 * gripQ;
    const pose = { F: [0, 1, 2, 3].map((i) => ({ flex: [0.3 + 0.27 * cl + 0.03 * i + trem * N2(tq * 6 + i, 1), 0.62 + 0.68 * cl + trem * N2(tq * 6 + i, 2), 0.4 + 0.36 * cl], splay: [-0.08, -0.02, 0.04, 0.1][i] })), T: { abd: 0.55, opp: 0.25, flex: [0.25, 0.35], twist: 0 } };
    const hb = buf('c32hand'), hcx = hb.ctx;
    hcx.save(); PV.camera(hcx, cam);
    const FLh = AN.faceLight(mixLight('storm', 'lightning', 0.15 + 0.55 * flQ10)), key = FLh.light, fill = AN.mixHex(FLh.shadow, FLh.light, 0.4);
    const sleeveC = AN.mixHex(AN.mat('shirt', mixLight('storm', 'lightning', 0.15 + 0.55 * flQ10), { wet: 1 }).base, '#1c2234', 0.35);
    const rig = L.hand(hcx, { side: 'R', kind: 'him', view: 'back', pitch: 0.3, yaw: -0.15, x: WR[0], y: WR[1] + 3 * sobQ, rot: C32L.rot, scale: C32L.hs, pose, arm: 46, sleeve: sleeveC, sleeveAt: 26, light: -1.9, keyColor: key, fillColor: fill, tint: 0.95, calluses: false });
    hcx.restore();
    const ends = [];
    hcx.save(); hcx.globalCompositeOperation = 'source-atop';
    const hxs = rig.joints.flat().map((q) => q.x).concat([rig.wrist.x]), hys = rig.joints.flat().map((q) => q.y).concat([rig.wrist.y]), hpad = 260 * zoom;
    const hb0 = [Math.max(0, Math.min(...hxs) - hpad), Math.max(0, Math.min(...hys) - hpad), Math.min(W, Math.max(...hxs) + hpad), Math.min(H, Math.max(...hys) + hpad)];
    hcx.fillStyle = `rgba(7,10,18,${(lerp(0.3, 0.12, sm(0.12, 0.8, pk)) * (1 - 0.45 * fl)).toFixed(3)})`; hcx.fillRect(hb0[0], hb0[1], hb0[2] - hb0[0], hb0[3] - hb0[1]);   // a little dim in the two-shot (the storm)
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

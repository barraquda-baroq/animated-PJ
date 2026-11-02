// g06_promise_accident — C20〜C24（約束の夜 → 事故の朝 → 病室）
//   C20 夜の臨海公園：駆けてくる先輩、64.75秒に胸へ飛び込む（暖色の光の爆発とレンズの光の帯）→ 回り込み
//   C21 並んで座る二人の手元（逆光の夜の肌、夜景の光が指を縁取る）：『ねえ……』の二音に合わせて指が動き、深く絡まる
//   C22 芝生に並んで座る二人の後ろ姿（先輩は左）。74.0秒に頭が肩へ
//   C23 秋の朝・冷たい逆光。白いブラウスの肩紐を握る右手（C01・C03と同じ位置と大きさ、白い袖）。頭の中の旋律を
//       小指→人差し指で弾き、F#5へ伸びた小指は下りない。77.7秒にフロントガラスの反射、78.2秒に白く焼ける
//   C24 純白（デジタル無音・周辺減光なし）→ 80.5秒に白い天井の陰影へ解像 → 窓（C02の音楽室の構図、ピアノだけがない）
//       → 82.3秒からティルトダウンしてシーツの上のギプスの右腕へ
// 描画速度：重い静的部分は一度だけ描いてキャッシュ、柔らかい光とぼけは低解像度で一回だけ合成、C20〜C23 は全入力を
// 1/12秒に量子化して「2コマ打ち」で同じ絵を2フレーム使う（onTwos）。
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, PI = Math.PI, TAU = PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp, sm = PV.smooth;
  const q12 = (t) => Math.floor(t * 12 + 1e-6) / 12;              // 2コマ打ち
  const hash = (i, s) => PV.rand1(i, s);

  /* ======================================================================= shared helpers */
  // subject + rim light from its own alpha: rim = mask − (mask shifted away from the light).
  // drawFn(c) draws the subject into an identity-transform buffer and may return a value; o.under(ctx, ret) is
  // called before the subject is composited (things that must sit under it but depend on its rig).
  // box: [x0,y0,x1,y1] or a function(ret) -> box evaluated after drawing (keeps every pass inside the subject's bounds)
  // The rim is computed at half resolution (the light edge is soft anyway; full-res mask passes cost ~25ms) and added
  // with one 'lighter' upscale; o.alpha above 1 brightens it by a second, cheaper glow pass instead of a second copy.
  function rimPass(ctx, box, drawFn, o) {
    const A = PV.buffer('g06:rimA');
    if (typeof box !== 'function') A.ctx.clearRect(Math.max(0, box[0] - 2), Math.max(0, box[1] - 2), box[2] - box[0] + 4, box[3] - box[1] + 4); else A.ctx.clearRect(0, 0, W, H);
    const ret = drawFn(A.ctx);
    const bx = typeof box === 'function' ? box(ret) : box;
    const pad = 4 + (o.width || 0);
    const x0 = Math.max(0, Math.floor(bx[0] - pad)), y0 = Math.max(0, Math.floor(bx[1] - pad));
    const x1 = Math.min(W, Math.ceil(bx[2] + pad)), y1 = Math.min(H, Math.ceil(bx[3] + pad));
    const w = x1 - x0, h = y1 - y0;
    if (o.under) o.under(ctx, ret, A);
    if (w <= 2 || h <= 2) return ret;
    const q = 0.5, B = PV.buffer('g06:rimB', W * q, H * q), bc = B.ctx;
    const qx0 = x0 * q, qy0 = y0 * q, qw = w * q, qh = h * q;
    // one rim per light direction (o.dirs: [{angle, width, color, alpha}]; default: o.angle / o.width / o.color)
    const dirs = o.dirs || [{ angle: o.angle, width: o.width, width2: o.width2, color: o.color }];
    bc.clearRect(qx0 - 2, qy0 - 2, qw + 4, qh + 4);
    for (let i = 0; i < dirs.length; i++) {
      const D = dirs[i], T = i === 0 ? B : PV.buffer('g06:rimT', W * q, H * q), tc = T.ctx;
      if (i > 0) tc.clearRect(qx0 - 2, qy0 - 2, qw + 4, qh + 4);
      tc.drawImage(A.canvas, x0, y0, w, h, qx0, qy0, qw, qh);
      tc.globalCompositeOperation = 'destination-out';
      const dx = -Math.cos(D.angle) * D.width * q, dy = -Math.sin(D.angle) * D.width * q;
      tc.drawImage(A.canvas, x0, y0, w, h, qx0 + dx, qy0 + dy, qw, qh);
      if (D.width2) { const d2 = D.width2; tc.drawImage(A.canvas, x0, y0, w, h, qx0 - dx * d2, qy0 - dy * d2, qw, qh); }   // thin counter-rim
      tc.globalCompositeOperation = 'source-in'; tc.fillStyle = D.color || o.color; tc.fillRect(qx0 - 2, qy0 - 2, qw + 4, qh + 4);
      tc.globalCompositeOperation = 'source-over';
      if (i > 0) { bc.save(); bc.globalCompositeOperation = 'lighter'; bc.globalAlpha = D.alpha == null ? 1 : D.alpha; bc.drawImage(T.canvas, qx0 - 2, qy0 - 2, qw + 4, qh + 4, qx0 - 2, qy0 - 2, qw + 4, qh + 4); bc.restore(); }
    }
    // optional modulation of the rim by where the light actually is (e.g. the bright band of lights behind)
    if (o.rimMask) { bc.save(); bc.globalCompositeOperation = 'destination-in'; bc.setTransform(q, 0, 0, q, 0, 0); o.rimMask(bc, x0, y0, x1, y1); bc.restore(); }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(A.canvas, x0, y0, w, h, x0, y0, w, h);
    if (o.over) o.over(ctx, ret);
    ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    ctx.globalAlpha = Math.min(1, o.alpha); ctx.drawImage(B.canvas, qx0, qy0, qw, qh, x0, y0, w, h);
    const gk = (o.glow || 0) + Math.max(0, o.alpha - 1) * 0.8;
    if (gk > 0) {   // glow at quarter resolution, with a margin so the blur is never cut by the box
      const g = 0.25, m = Math.ceil((o.glowPx || 12) * 3);
      const gx0 = Math.max(0, x0 - m), gy0 = Math.max(0, y0 - m), gx1 = Math.min(W, x1 + m), gy1 = Math.min(H, y1 + m), ww = gx1 - gx0, hh = gy1 - gy0;
      const G = PV.buffer('g06:rimG', Math.ceil(W * g) + 4, Math.ceil(H * g) + 4);
      G.ctx.clearRect(0, 0, ww * g + 4, hh * g + 4); G.ctx.filter = `blur(${((o.glowPx || 12) * g).toFixed(2)}px)`;
      G.ctx.drawImage(B.canvas, qx0, qy0, qw, qh, (x0 - gx0) * g, (y0 - gy0) * g, w * g, h * g); G.ctx.filter = 'none';
      ctx.globalAlpha = Math.min(1, Math.min(1, o.alpha) * gk); ctx.drawImage(G.canvas, 0, 0, ww * g, hh * g, gx0, gy0, ww, hh);
    }
    ctx.restore();
    return ret;
  }
  // bounding box of hand rigs (device px): palm hull, joints, tips and the forearm's far end
  function rigsBox(rigs, padArm) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const ext = (p, r) => { x0 = Math.min(x0, p.x - r); y0 = Math.min(y0, p.y - r); x1 = Math.max(x1, p.x + r); y1 = Math.max(y1, p.y + r); };
    const V = L._handMath.V;
    for (const rig of rigs) {
      if (!rig) continue;
      const u = rig.unit || 1;
      for (const j of rig.joints) for (const p of j) ext(p, 14 * u);
      ext(rig.wrist, 30 * u);
      const armL = rig.o.arm == null ? 320 : rig.o.arm;
      for (let k = 0; k <= 4; k++) ext(rig.P(V(0, armL * k / 4, 0)), (padArm || 30) * u);
    }
    return [x0, y0, x1, y1];
  }
  // cheap depth-of-field: draw fn into a reduced buffer, blur there, upscale.
  // rect [x0,y0,x1,y1] (device px) limits the drawing, the blur and the composite to where the layer actually is
  // (a full-screen bilinear upscale costs ~6ms, a 'high'-quality one ~17ms: keep it 'low' and small).
  // mode: composite operation for the upscale ('source-over' by default; 'screen'/'lighter' for light passes).
  function softLayer(ctx, blurPx, fn, key, alpha, q, rect, mode) {
    q = q || 0.25;
    const CW = ctx.canvas.width, CH = ctx.canvas.height;           // the target may be a wider world buffer
    const bw = Math.round(CW * q), bh = Math.round(CH * q);
    const R = rect || [0, 0, CW, CH], m = blurPx > 0.3 ? Math.ceil(blurPx * 2.5) : 2;
    const lx0 = Math.max(0, Math.floor((R[0] - m) * q)), ly0 = Math.max(0, Math.floor((R[1] - m) * q));
    const lx1 = Math.min(bw, Math.ceil((R[2] + m) * q)), ly1 = Math.min(bh, Math.ceil((R[3] + m) * q));
    if (lx1 <= lx0 || ly1 <= ly0) return;
    const b = PV.buffer('g06:soft:' + key, bw, bh), c = b.ctx, T = ctx.getTransform();
    c.clearRect(lx0, ly0, lx1 - lx0, ly1 - ly0);
    c.save(); c.beginPath(); c.rect(lx0, ly0, lx1 - lx0, ly1 - ly0); c.clip();
    c.setTransform(T.a * q, T.b * q, T.c * q, T.d * q, T.e * q, T.f * q); fn(c); c.restore();
    let src = b;
    if (blurPx > 0.3) {
      src = PV.buffer('g06:soft2:' + key, bw, bh);
      src.ctx.clearRect(lx0, ly0, lx1 - lx0, ly1 - ly0); src.ctx.filter = `blur(${(blurPx * q).toFixed(2)}px)`;
      src.ctx.drawImage(b.canvas, lx0, ly0, lx1 - lx0, ly1 - ly0, lx0, ly0, lx1 - lx0, ly1 - ly0); src.ctx.filter = 'none';
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); if (alpha != null) ctx.globalAlpha *= alpha;
    if (mode) ctx.globalCompositeOperation = mode;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(src.canvas, R[0] * q, R[1] * q, (R[2] - R[0]) * q, (R[3] - R[1]) * q, R[0], R[1], R[2] - R[0], R[3] - R[1]);
    ctx.restore();
  }
  // big soft lights (glows) painted at quarter resolution and composited once (a 1100px L.glow costs ~8ms at full res)
  function lightPass(ctx, fn, key, rect, mode) { softLayer(ctx, 0, fn, 'light:' + key, 1, 0.25, rect, mode || 'screen'); }
  // pixel-snapped blit of a cached layer (a fractional offset makes the copy resample: ~7ms instead of ~0.7ms)
  const blit = (ctx, img, x, y) => ctx.drawImage(img, Math.round(x), Math.round(y));
  // On twos (2コマ打ち): when every input of a shot is quantised to 1/12 s, both frames of a pair are the same picture —
  // keep the layer and blit it for the second one (the film grain still changes per frame in post). Deterministic:
  // the cache is keyed by shot and quantised time, and a miss simply draws.
  function onTwos(ctx, key, tq, fn) {
    const C = PV.buffer('g06:twos:' + key);
    if (onTwos[key] === tq) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'copy'; ctx.drawImage(C.canvas, 0, 0); ctx.restore(); return; }
    onTwos[key] = null;
    ctx.save(); fn(); ctx.restore();
    C.ctx.globalCompositeOperation = 'copy'; C.ctx.drawImage(ctx.canvas, 0, 0); C.ctx.globalCompositeOperation = 'source-over';
    onTwos[key] = tq;
  }
  // per-frame post settings for this shot (read by PV.post right after draw; a pure function of t, so deterministic)
  function postFor(S, o) { if (S) S.post = Object.assign({}, S.post0 || (S.post0 = Object.assign({}, S.post || {})), o); }

  /* ----------------------------------------------------------------- the night bay (C20 / C22) */
  // sky, opposite shore (city + ferris wheel), the lit white bridge — painted once and pre-blurred (it sits far out of
  // focus); the water with every light reflected is redrawn each frame (its ripples carry the life of the shot).
  // Navy night (#0e1530–#1d2b55) warmed along the shore by the city: amber / white / pale pink lights.
  const bayCache = {};
  function bayStatic(key, o, blurPx) {
    if (bayCache[key]) return bayCache[key];
    const sharp = PV.makeCanvas(W, H), c = sharp.ctx, t = 0, hz = o.hz;
    L.skyDome(c, t, { stops: [[0, '#070b1f'], [0.4, '#0e1636'], [0.7, '#1b2553'], [0.88, '#2f3360'], [1, '#56465c']], horizon: hz, seed: 63, haze: 0.45, hazeColor: '#5e4c5a' });
    L.stars(c, t, { seed: 64, count: 120, yMax: hz * 0.6, alpha: 0.5 });
    L.cloudBand(c, t, { kind: 'streak', x: 0, y: Math.max(0, hz - 520), w: W, h: 300, seed: 65, coverage: 0.32, palette: 'night', light: PI / 2, alpha: 0.32, speed: 3, gain: 2 });
    // the city's warm breath above the shore
    for (let x = -120; x < W + 240; x += 200) L.glow(c, x + 60 * hash(x, 3), hz - 14, 260 + 110 * hash(x, 4), '#ff9a4c', 0.11 + 0.07 * hash(x, 5), 'lighter');
    L.glow(c, W * 0.5, hz + 10, 1300, '#ff9a4c', 0.08, 'lighter');
    const far = L.skyline(c, { seed: 66, y: hz, hMin: 24, hMax: 120, wMin: 20, wMax: 70, color: '#272c58', lit: 0.32, win: [2, 3, 5, 6], glow: 0.5, haze: 0.3, hazeColor: '#463e62', t });
    const fw = L.ferrisWheel(c, t, { x: o.wheelX, y: hz - o.wheelR - 22, r: o.wheelR, night: true, legH: 20, haze: 0.22, pattern: 'warm', speed: 0.012 });
    const near = L.skyline(c, { seed: 67, x0: o.cityX0, x1: o.cityX1, y: hz + 3, hMin: 40, hMax: o.cityH || 230, wMin: 34, wMax: 110, color: '#161b38', lit: 0.42, glow: 0.8, skyGlow: '#8a5c5c', windowColors: ['#ffd9a0', '#fff1d6', '#ffe2b0', '#ffd7e0', '#ffc27a'], t });
    const br = L.bridge(c, { x0: o.bridgeX0, x1: o.bridgeX1, y: hz - o.deck, towerH: o.towerH, lw: o.lw || 4.2, night: true, t, cables: 11, pierH: o.deck, span: o.span || 250, towers: o.towers, uplight: 0.34, lamps: o.lamps || 16 });
    if (o.paint) o.paint(c, hz);
    const soft = PV.makeCanvas(W, H), sc = o.scale || 1;
    soft.ctx.filter = `blur(${blurPx}px)`;
    if (sc !== 1) { soft.ctx.translate(o.scaleCx, o.scaleCy); soft.ctx.scale(sc, sc); soft.ctx.translate(-o.scaleCx, -o.scaleCy); }
    soft.ctx.drawImage(sharp.canvas, 0, 0, W, hz + 8, 0, 0, W, hz + 8); soft.ctx.filter = 'none';
    // the far lights as one static, slightly drifting bokeh layer is drawn per shot (they twinkle); return the lights
    // for the water's reflections, mapped through the same pre-scale
    soft.canvas.getContext('2d').getImageData(0, 0, 1, 1);   // rasterise now (not on first use mid-shot)
    // (o.scale pre-scales only the image; the water is drawn under the same scale by the caller, from the raw lights)
    return (bayCache[key] = { img: soft.canvas, lights: far.concat(near, br, fw), hz });
  }
  // the water, every light reflected — redrawn per frame at half resolution inside its band only
  // (rect: the band in device px of the target, which may carry a transform)
  function bayWater(ctx, t, B, y1, key, rect) {
    softLayer(ctx, 0, (c) => L.nightWater(c, t, { horizonY: B.hz + 3, y1, lights: B.lights, seed: 63, glow: 0.55 }), key + 'w', 1, 0.5, rect);
  }

  // night lawn, painted once: soft mottling + grass tufts in perspective, tips lit by the bay and the lamps
  function nightLawn(ctx, t, o) {
    const y0 = o.y0;
    const M = 260;   // horizontal margin so camera moves never reveal the edge
    const img = PV.cached('g06:lawn:' + o.key, W + 2 * M, H, (c) => {
      c.translate(M, 0);
      const X0 = -M, WW = W + 2 * M;   // paint from -M to W+M
      const g = c.createLinearGradient(0, y0, 0, H);
      g.addColorStop(0, '#1c2744'); g.addColorStop(0.12, '#142036'); g.addColorStop(0.55, '#0c1426'); g.addColorStop(1, '#070b16');
      c.fillStyle = g; c.fillRect(X0, y0, WW, H - y0);
      const r = PV.rng(o.seed || 2020);
      // very soft unevenness (no hard patches)
      for (let i = 0; i < 46; i++) {
        const z = r(), y = y0 + z * (H - y0), x = X0 + r() * WW, rw = lerp(160, 700, z), rh = rw * lerp(0.06, 0.16, z);
        const gr = c.createRadialGradient(x, y, 0, x, y, rw); gr.addColorStop(0, r() < 0.5 ? 'rgba(46,62,104,0.12)' : 'rgba(0,2,8,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.save(); c.translate(x, y); c.scale(1, rh / rw); c.translate(-x, -y); c.fillStyle = gr; c.fillRect(x - rw, y - rw, rw * 2, rw * 2); c.restore();
      }
      // dense short blades: the texture of a lawn (length and width grow toward the camera)
      for (let i = 0; i < 19000; i++) {
        const z = Math.pow(r(), 1.5), y = y0 + 2 + z * (H - y0 + 10), x = X0 + r() * WW;
        const len = lerp(2.2, 17, z) * (0.6 + 0.8 * r()), a = (r() - 0.5) * 0.55, rr = r();
        c.strokeStyle = rr < 0.62 ? `rgba(${5 + 9 * r() | 0},${10 + 12 * r() | 0},${20 + 14 * r() | 0},0.75)`
          : rr < 0.95 ? `rgba(${34 + 18 * r() | 0},${48 + 20 * r() | 0},${78 + 26 * r() | 0},${(0.35 + 0.3 * (1 - z)).toFixed(2)})`
          : (r() < 0.7 ? `rgba(255,212,150,${(0.12 + 0.28 * (1 - z)).toFixed(2)})` : `rgba(214,198,255,${(0.12 + 0.22 * (1 - z)).toFixed(2)})`);
        c.lineWidth = lerp(0.7, 2.2, z);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len); c.stroke();
      }
      // the far edge catches the glow of the bay
      const e = c.createLinearGradient(0, y0 - 4, 0, y0 + 50); e.addColorStop(0, 'rgba(150,130,190,0)'); e.addColorStop(0.25, 'rgba(150,130,190,0.28)'); e.addColorStop(1, 'rgba(150,130,190,0)');
      c.fillStyle = e; c.fillRect(X0, y0 - 4, WW, 54);
    });
    ctx.drawImage(img, -M, 0);
  }
  // big foreground grass blades (draw inside softLayer for out-of-focus foreground)
  function foreBlades(ctx, t, o) {
    const r = PV.rng(o.seed || 7);
    ctx.save();
    for (let i = 0; i < (o.count || 40); i++) {
      const x = lerp(o.x0, o.x1, r()), y = o.y + r() * 60, len = lerp(o.lmin || 60, o.lmax || 170, r()), w = lerp(o.wmin || 8, o.wmax || 20, r());
      const sway = Math.sin(t * (0.9 + r()) + i) * 0.08 + 0.08 * PV.noise2(i * 0.3, t * 0.5) + (o.lean || 0.12) * (r() - 0.3);
      const tx = x + Math.sin(sway) * len, ty = y - Math.cos(sway) * len, bend = (r() - 0.5) * 0.4 * len;
      ctx.fillStyle = o.color || '#05080f';
      ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x + (tx - x) * 0.4 + bend - w * 0.25, y - len * 0.55, tx, ty); ctx.quadraticCurveTo(x + (tx - x) * 0.4 + bend + w * 0.25, y - len * 0.55, x + w / 2, y); ctx.fill();
      if (o.rim && r() < 0.6) { ctx.strokeStyle = o.rim; ctx.globalAlpha = 0.25 + 0.45 * r(); ctx.lineWidth = Math.max(1.2, w * 0.18); ctx.beginPath(); ctx.moveTo(x + w * 0.2, y - len * 0.3); ctx.quadraticCurveTo(x + (tx - x) * 0.4 + bend, y - len * 0.55, tx, ty); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    ctx.restore();
  }
  // park lamp post: dark pole + glowing lantern
  function lampPost(ctx, t, x, yTop, yBase, s) {
    ctx.save();
    ctx.fillStyle = '#060912'; ctx.fillRect(x - 5 * s, yTop + 30 * s, 10 * s, yBase - yTop - 30 * s);
    ctx.fillRect(x - 14 * s, yBase - 10 * s, 28 * s, 10 * s);
    ctx.beginPath(); ctx.moveTo(x - 20 * s, yTop + 4 * s); ctx.lineTo(x + 20 * s, yTop + 4 * s); ctx.lineTo(x + 12 * s, yTop + 34 * s); ctx.lineTo(x - 12 * s, yTop + 34 * s); ctx.closePath(); ctx.fill();
    const fl = 0.96 + 0.04 * Math.sin(t * 7.3 + x);
    ctx.fillStyle = '#ffe6b8'; ctx.fillRect(x - 11 * s, yTop + 9 * s, 22 * s, 20 * s);
    L.glow(ctx, x, yTop + 18 * s, 120 * s, '#ffd08a', 0.75 * fl);
    L.glow(ctx, x, yTop + 18 * s, 380 * s, '#ffbf6b', 0.2 * fl);
    ctx.restore();
  }

  /* ======================================================================= C20 */
  // 63.0–66.5 (t: 0–3.5). Static wide: she runs in from the left, the heels quickening (63.2–64.7); at 64.75 (t=1.75)
  // she leaps into his chest and the two shadows become one (M11's climax, 64.8): a warm burst behind them, a streak
  // across the lens, the camera feels the impact; then it slowly orbits (far right, near left) and pushes in.
  // The world behind the pair is flattened at zoom 1 into a wide buffer and drawn once through the camera.
  const C20 = { s: 0.95, gy: 925, boyX: 1250, tHit: 1.75, cam: { cx: 1150, cy: 620 },
    bay: { hz: 560, wheelX: 330, wheelR: 112, cityX0: -40, cityX1: 1250, bridgeX0: 1290, bridgeX1: 2500, deck: 30, towerH: 215, towers: [1540, 2100], span: 240, scale: 1.045, scaleCx: 960, scaleCy: 560 } };
  const C20M = 260;   // horizontal margin of the cached ground layer
  function c20Ground() {   // the lawn, the two park lamps and their warm light — painted once
    return PV.cached('g06:c20ground', W + 2 * C20M, H, (c) => {
      c.translate(C20M, 0);
      nightLawn(c, 0, { y0: 730, key: 'c20b', seed: 2020 });
      lampPost(c, 0, 1835, 330, 762, 1.05);
      lampPost(c, 0, 120, 400, 744, 0.85);
      L.glow(c, 1760, 860, 420, '#ffbf6b', 0.14);
      L.glow(c, 150, 830, 300, '#ffbf6b', 0.09);
    });
  }
  function c20Near() {     // out-of-focus grass blades and lights in the foreground corners — painted once
    return PV.cached('g06:c20near', W + 320, H, (c) => {
      const A = PV.makeCanvas(W + 320, H), a = A.ctx; a.translate(160, 0);
      foreBlades(a, 0, { seed: 21, count: 36, x0: -80, x1: 560, y: 1100, lmin: 110, lmax: 260, wmin: 14, wmax: 30, rim: '#ffcf96' });
      foreBlades(a, 0, { seed: 23, count: 30, x0: 1480, x1: 2000, y: 1100, lmin: 90, lmax: 220, wmin: 14, wmax: 30, rim: '#ffcf96' });
      c.filter = 'blur(14px)'; c.drawImage(A.canvas, 0, 0); c.filter = 'none';
      c.translate(160, 0);
      L.bokeh(c, 0, { seed: 2001, count: 7, rmin: 80, rmax: 150, x0: -80, x1: 700, y0: 990, y1: 1160, alpha: 0.26, mode: 'lighter', colors: ['#c8701c', '#c2456e', '#d0a246'] });
      L.bokeh(c, 0, { seed: 2002, count: 5, rmin: 70, rmax: 130, x0: 1500, x1: 2000, y0: 1000, y1: 1160, alpha: 0.22, mode: 'lighter', colors: ['#d0a246', '#c8701c', '#c2456e'] });
    });
  }
  PV.shot('C20', { draw(ctx, t, d) { const tq0 = q12(clamp(t, 0, d)); onTwos(ctx, 'C20', tq0, () => drawC20(ctx, tq0, d)); } });
  function drawC20(ctx, t, d) {
    const tc = t, tq = t;   // on twos: every input below is the quantised time
    const { s, gy, boyX, tHit } = C20, u = 92 * s;
    const orb = PV.ease.inOut(clamp((tc - 1.95) / (d - 1.95)));
    const hit = tq >= tHit - 1e-6;
    // warmth: a burst at the impact (M11's climax), then a held glow
    const burst = hit ? Math.exp(-Math.pow((tc - (tHit + 0.1)) / 0.34, 2)) : 0, hug = 0.45 * sm(tHit, tHit + 0.6, tc) + 0.55 * burst;
    const bump = hit ? 0.013 * Math.exp(-(tc - tHit) / 0.16) : 0;            // the impact, felt in the camera
    const zoom = 1 + 0.012 * sm(0, tHit, tc) + 0.07 * orb + bump, camX = -60 * orb;
    // ---- the world behind them, each layer with its own parallax, at zoom 1
    const WB = PV.buffer('g06:c20world', W + 160, H), w = WB.ctx;
    const B = bayStatic('c20bay', C20.bay, 3.2), bx = Math.round(46 * orb);
    w.fillStyle = '#070b1f'; w.fillRect(0, 0, W + 160, H);
    w.save(); w.imageSmoothingEnabled = false; w.drawImage(B.img, bx, 0); w.restore();
    w.save(); w.translate(bx, 0); w.translate(960, 560); w.scale(1.045, 1.045); w.translate(-960, -560);
    bayWater(w, tq, B, 730, 'c20', [0, 552, W + 160, 744]);
    w.restore();
    w.save(); w.translate(bx, 0);
    L.bokeh(w, t, { seed: 2003, count: 34, rmin: 14, rmax: 46, x0: -40, x1: W + 40, y0: 380, y1: 600, alpha: 0.3 + 0.15 * hug, mode: 'lighter', colors: ['#d98a2e', '#e8b25a', '#fff1d6', '#d2607e', '#d98a2e'], vx: 0 });
    w.restore();
    // promenade edge + railing silhouette
    w.save(); w.translate(Math.round(22 * orb), 0);
    w.fillStyle = '#0b1020'; w.fillRect(-100, 716, W + 360, 16);
    w.fillStyle = 'rgba(200,170,190,0.25)'; w.fillRect(-100, 716, W + 360, 2);
    w.fillStyle = '#070a14'; w.fillRect(-100, 662, W + 360, 5);
    for (let x = -60; x < W + 280; x += 128) w.fillRect(x, 662, 5, 56);
    w.fillStyle = 'rgba(255,210,150,0.2)'; w.fillRect(-100, 662, W + 360, 1.5);
    w.restore();
    w.save(); w.imageSmoothingEnabled = false; w.drawImage(c20Ground(), -C20M, 0); w.restore();
    ctx.save();
    PV.camera(ctx, { zoom, cx: C20.cam.cx, cy: C20.cam.cy, x: camX });
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(WB.canvas, 0, 0);
    // the light behind the pair swells as she lands in his arms
    if (hug > 0.004) lightPass(ctx, (c) => {
      L.glow(c, 1170, 560, 680, '#ffe2b8', 0.34 * hug);
      if (burst > 0.01) { L.glow(c, 1190, 520, 1150, '#ffd2a0', 0.26 * burst); L.glow(c, 1190, 540, 330, '#fff1d6', 0.45 * burst); }
    }, 'c20warm', [0, 0, W, H]);
    ctx.save(); ctx.fillStyle = 'rgba(2,4,10,0.55)';
    ctx.beginPath(); ctx.ellipse(hit ? boyX - 0.64 * u : boyX, gy + 6, 74, 11, 0, 0, TAU); ctx.fill(); ctx.restore();
    const fig = { scale: s, light: -0.4, rimColor: '#ffdcae', backlight: 0.17 + 0.16 * hug, glow: 0.5 + 0.3 * burst };
    if (!hit) {
      // she runs in from the left: cycles accelerate (heels quicken), ground speed matched to the stride (~6u per cycle);
      // he has turned to her, a step forward, his arm opening as she comes (the night wind in his shirt)
      const cyc = (x) => 1.2 * x + 0.13 * x * x, tEnd = tHit - 1 / 12;
      const gx = (boyX - 2.6 * u) - 6.0 * u * (cyc(tEnd) - cyc(Math.min(tq, tEnd)));
      L.boyReaching(ctx, tq, Object.assign({}, fig, { x: boyX, y: gy, flip: true, reach: 0.04 + 0.76 * sm(0.55, 1.6, tq), wind: 0.6, outfit: 'shirt' }));
      ctx.save(); ctx.fillStyle = 'rgba(2,4,10,0.5)'; ctx.beginPath(); ctx.ellipse(gx, gy + 6, 55, 9, 0, 0, TAU); ctx.fill(); ctx.restore();
      L.girlRunning(ctx, tq, Object.assign({}, fig, { x: gx, y: gy, speed: 0, phase: cyc(tq) + 0.15, wind: 1.25, outfit: 'dress' }));
    } else {
      L.embrace(ctx, tq, Object.assign({}, fig, { x: boyX - 0.64 * u, y: gy, progress: clamp((tq - tHit) / 1.6), outfit: 'dress', boyOutfit: 'shirt', wind: 0.3 }));
    }
    ctx.restore();
    // the impact: a soft warm streak across the lens through the two of them (at her head on his chest)
    if (burst > 0.02) {
      const X = (1190 - C20.cam.cx) * zoom + C20.cam.cx + camX, Y = (430 - C20.cam.cy) * zoom + C20.cam.cy;
      lightPass(ctx, (c) => {
        for (const [hh, a, col] of [[120, 0.22, '255,200,140'], [26, 0.6, '255,236,206']]) {
          const g = c.createLinearGradient(X - 1200, 0, X + 1200, 0); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${(a * burst).toFixed(3)})`); g.addColorStop(1, `rgba(${col},0)`);
          c.fillStyle = g; c.beginPath(); c.ellipse(X, Y, 1200, hh / 2, 0, 0, TAU); c.fill();
        }
        L.glow(c, X, Y, 140, '#fff4e0', 0.55 * burst);
      }, 'c20streak', [0, Math.max(0, Math.floor(Y - 160)), W, Math.min(H, Math.ceil(Y + 160))]);
    }
    // near: out-of-focus grass and light (slides left during the orbit)
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(c20Near(), Math.round(-110 * orb) - 160, 0); ctx.restore();
  }

  /* ======================================================================= C21 */
  // her right hand (front, back of the hand toward us) and his left hand (behind, palm toward us).
  // A re-built handsInterlock with a progress k: 0 = the hands meet side by side (his hand to the little-finger side,
  // palms just touching), 1 = slid together, fingers interlaced and closed.
  function interlockK(ctx, o) {
    const HM = L._handMath, V = HM.V, add = HM.add, sub = HM.sub, M = HM.M;
    const model = L._handModel, solveFinger = L._handSolveFinger, solveThumb = L._handSolveThumb, lookCam = L._handLookCam, matOf = L._handMatOf;
    const tr3 = A => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
    const toLocal = (Mh, Th, mir, q) => { const v = M.ap(tr3(Mh), sub(q, Th)); return V(v.x * mir, v.y, v.z); };
    const k = clamp(o.k), kS = sm(0, 0.6, k), kC = sm(0.35, 1, k);
    const m = matOf(ctx), t = o.t || 0, sc = o.scale || 3, sq = o.squeeze == null ? 0.5 : o.squeeze;
    const Mv = lookCam(o.az == null ? -0.3 : o.az, o.el == null ? -0.1 : o.el, 0);
    const fM = model('her'), bM = model('him');
    const va = o.vee == null ? 0.2 : o.vee;
    const MhF = M.mul(M.rz(va), M.cols(V(-1, 0, 0), V(0, -1, 0), V(0, 0, 1)));
    const MhB = M.mul(M.rz(-va - 0.25 * (1 - kS)), M.cols(V(1, 0, 0), V(0, -1, 0), V(0, 0, -1)));
    const toW = (Mh, Th, mir, p) => add(M.ap(Mh, V(p.x * mir, p.y, p.z)), Th);
    const zF = 15, zB = lerp(zF - 40, zF - 36 + 4 * sq, kC);
    const ThF = sub(V(0, 0, zF), toW(MhF, V(0, 0, 0), 1, fM.fingers[1].mcp));
    const dx = lerp(o.dx0 == null ? -46 : o.dx0, 10.5, kS), dy = lerp(o.dy0 == null ? 14 : o.dy0, 4, kS);
    const ThB = sub(V(dx, dy, zB), toW(MhB, V(0, 0, 0), -1, bM.fingers[1].mcp));
    const wob = (i, j) => 0.025 * PV.noise2(t * 0.6 + i * 3.1, j * 1.7);
    const fX = fM.fingers.map(f => f.mcp.x);
    const bF = [], fF = [];
    const bSpl = [-0.16, -0.04, 0.08, 0.2], fSpl = [-0.2, -0.06, 0.08, 0.24];
    const tipY = [-80, -88, -87, -83], tipZ = 17 - 2 * sq;
    for (let i = 0; i < 4; i++) {
      const gx = i > 0 ? (fX[i - 1] + fX[i]) / 2 : fX[0] - (fX[1] - fX[0]) * 0.55;
      const tw = toW(MhF, ThF, 1, V(gx, tipY[i] + 2 * PV.noise2(t * 0.4, i * 2.3), tipZ));
      const post = solveFinger(bM.fingers[i], toLocal(MhB, ThB, -1, tw), { splay: bSpl[i], a0: 1.0, b0: 1.5, aMin: 0.2, aMax: 1.6, bMin: 0.6, bMax: 2.1, dip: 0.6 });
      const pre = { flex: [0.22 + 0.04 * i, 0.32 + 0.03 * i, 0.16], splay: bM.fingers[i].splay * 0.8 + [-0.04, -0.01, 0.02, 0.05][i] };
      bF.push({ flex: post.flex.map((v, j) => lerp(pre.flex[j], v, kC) + wob(i + 9, j)), splay: lerp(pre.splay, post.splay, kS) });
      const tw2 = toW(MhB, ThB, -1, V(bM.fingers[i].mcp.x + (i < 3 ? 10 : 6), -72, 18));
      const postF = solveFinger(fM.fingers[i], toLocal(MhF, ThF, 1, tw2), { splay: fSpl[i], a0: 0.8, b0: 1.5, aMin: 0.1, aMax: 1.6, bMin: 0.6, bMax: 2.1, dip: 0.6 });
      const preF = { flex: [0.14 + 0.03 * i, 0.22 + 0.02 * i, 0.1], splay: fM.fingers[i].splay };
      // her fingers open (the gaps open for him) while the hands slide together, then close around his hand
      const open = Math.sin(PI * clamp((k - 0.05) / 0.75)) * [-0.1, -0.03, 0.04, 0.11][i];
      fF.push({ flex: postF.flex.map((v, j) => lerp(preF.flex[j], v, kC) + wob(i, j)), splay: lerp(preF.splay, postF.splay, kC) + open });
    }
    const trw = Math.sin((o.trace || 0) * PI * 2);
    const thT = toW(MhF, ThF, 1, V(-20 + 5 * trw, -50 + 9 * trw, 20));
    const bTpost = solveThumb(bM.thumb, toLocal(MhB, ThB, -1, thT), { abd: 0.7, opp: 1.0, flex: [0.4, 0.3] });
    const fTpost = solveThumb(fM.thumb, toLocal(MhF, ThF, 1, toW(MhB, ThB, -1, V(-26, -58, 18))), { abd: 0.6, opp: 0.9, flex: [0.3, 0.3] });
    const lt = (a, b, x) => ({ abd: lerp(a.abd, b.abd, x), opp: lerp(a.opp, b.opp, x), flex: [lerp(a.flex[0], b.flex[0], x), lerp(a.flex[1], b.flex[1], x)], twist: 0 });
    const bT = lt({ abd: 0.5, opp: 0.35, flex: [0.18, 0.15] }, bTpost, kC), fT = lt({ abd: 0.45, opp: 0.4, flex: [0.15, 0.15] }, fTpost, kC);
    const look = V(4, 20, 0);
    const common = { scale: sc, x: o.x, y: o.y, rot: o.rot || 0, camera: Mv, focal: 1100, _m: m, style: o.style, light: o.light, t,
      arm: o.arm == null ? 330 : o.arm, rimColor: o.rimColor, dark: o.dark, rimWidth: o.rimWidth, keyColor: o.keyColor, fillColor: o.fillColor, tint: o.tint, sss: o.sss, bounce: o.bounce };
    const rigF = L.handRig(Object.assign({}, common, { side: 'R', kind: 'her', pose: { F: fF, T: fT }, handMatrix: MhF, handPos: sub(ThF, look), split: { 1: 1, 2: 1, 3: 1, 4: 1 }, sleeve: o.herSleeve, sleeveAt: o.sleeveAt || 80 }));
    const rigB = L.handRig(Object.assign({}, common, { side: 'L', kind: 'him', pose: { F: bF, T: bT }, handMatrix: MhB, handPos: sub(ThB, look), split: { 0: 2, 1: 1, 2: 1, 3: 1, 4: 1 }, sleeve: o.hisSleeve, sleeveAt: o.sleeveAt || 80 },
      o.his || {}));
    if (kC > 0.5) rigB.o.depthFn = (it) => (it.kind === 'thumb' ? 200 + it.depth : null);
    L.handRender(ctx, [rigB, rigF], { alpha: o.alpha, glow: o.glow, pad: 30 });
    return { her: rigF, him: rigB };
  }

  // the bay lights far behind, the lawn's far part (soft) — painted once (the far lights drift a little with the dolly)
  function c21Back() {
    return PV.cached('g06:c21back', W + 160, H, (c) => {
      c.translate(80, 0);
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a1026'); g.addColorStop(0.34, '#161f48'); g.addColorStop(0.52, '#262b55'); g.addColorStop(0.56, '#141b3a'); g.addColorStop(1, '#070b16');
      c.fillStyle = g; c.fillRect(-80, 0, W + 160, H);
      L.glow(c, 960, 520, 1100, '#ffb35c', 0.16, 'lighter');
      L.bokeh(c, 0, { seed: 2102, count: 10, rmin: 150, rmax: 280, x0: -240, x1: W + 240, y0: 180, y1: 640, alpha: 0.11, mode: 'lighter', colors: ['#ffbf6b', '#ffd7e0', '#fff1d6', '#ffbf6b'] });
      L.bokeh(c, 0, { seed: 2101, count: 22, rmin: 60, rmax: 160, x0: -160, x1: W + 160, y0: 330, y1: 560, alpha: 0.34, mode: 'lighter', colors: ['#c8701c', '#d0a246', '#c2456e', '#d0a246', '#c8701c'] });
      L.bokeh(c, 0, { seed: 2103, count: 40, rmin: 16, rmax: 38, x0: -120, x1: W + 120, y0: 500, y1: 580, alpha: 0.44, mode: 'lighter', colors: ['#ffd38a', '#fff1d6', '#ffd7e0', '#ffd38a'] });
      // the lawn receding to the water: a soft layer of tufts, blurred once
      const lw = PV.makeCanvas(W + 160, H), lc = lw.ctx; lc.translate(80, 0);
      const gg = lc.createLinearGradient(0, 600, 0, H); gg.addColorStop(0, '#1f2a4c'); gg.addColorStop(0.07, '#141d38'); gg.addColorStop(0.45, '#0b1124'); gg.addColorStop(1, '#070a14');
      lc.fillStyle = gg; lc.fillRect(-80, 600, W + 160, 600);
      foreBlades(lc, 0, { seed: 31, count: 360, x0: -140, x1: W + 140, y: 618, lmin: 7, lmax: 20, wmin: 2.5, wmax: 5, rim: '#ffcf96', color: '#0c1324', lean: 0.3 });
      foreBlades(lc, 0, { seed: 32, count: 250, x0: -140, x1: W + 140, y: 668, lmin: 18, lmax: 44, wmin: 4, wmax: 8, rim: '#ffcf96', color: '#0a101e', lean: 0.3 });
      foreBlades(lc, 0, { seed: 33, count: 170, x0: -140, x1: W + 140, y: 760, lmin: 40, lmax: 90, wmin: 6, wmax: 12, rim: '#d9a874', color: '#080d1a', lean: 0.3 });
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'blur(3px)'; c.drawImage(lw.canvas, 0, 0); c.filter = 'none'; c.restore();
    });
  }
  // 66.5–70.0 (t: 0–3.5). 67.25 (0.75) piano A4『ね』, 68.0 (1.5) F#5『え』 = the fingers interlace, 68.75–70.0 the guitar answers『ん？』
  PV.shot('C21', { draw(ctx, t, d) { const tq0 = q12(clamp(t, 0, d)); onTwos(ctx, 'C21', tq0, () => drawC21(ctx, tq0, d)); } });
  function drawC21(ctx, t, d) {
    const tc = t, tq = t;   // on twos: every input below is the quantised time
    const push = PV.ease.inOut(tc / d);
    const ne1 = Math.exp(-Math.pow((tc - 0.78) / 0.2, 2)), ne2 = Math.exp(-Math.pow((tc - 1.55) / 0.3, 2));
    const k = 0.05 * sm(0, 0.7, tq) + 0.5 * sm(0.75, 1.32, tq) + 0.45 * sm(1.32, 1.68, tq);
    const squeeze = 0.4 + 0.2 * sm(2.25, 3.3, tq);
    const trace = 0.4 * sm(2.3, 3.5, tq);
    // background: the bay lights beyond the lawn, far out of focus (we are low, behind the two, looking at the sea)
    ctx.save(); ctx.imageSmoothingEnabled = false; blit(ctx, c21Back(), -80 - 6 * tc, 0); ctx.restore();
    // the two notes of 『ねえ』 brighten the lights (the piano is her voice)
    const lift = 0.3 * ne2 + 0.12 * ne1;
    if (lift > 0.01) lightPass(ctx, (c) => { L.glow(c, 960, 520, 1000, '#ffbf6b', 0.5 * lift); L.glow(c, 960, 560, 420, '#fff1d6', 0.6 * lift); }, 'c21lift', [0, 0, W, H]);
    // hands: her right hand (left, back of the hand to us); his left hand, open, at her right — then it slides
    // behind hers and the fingers lace. The night shades the skin; the lights of the bay behind draw the rim.
    ctx.save(); PV.camera(ctx, { zoom: 1 + 0.07 * push, cx: 960, cy: 600 });
    const hx = 930, hy = 500 + 70 * sm(1.2, 2.2, tq);         // once laced, the hands settle into the grass
    rimPass(ctx, (r) => rigsBox([r.her, r.him], 30), (c) => { c.setTransform(ctx.getTransform()); const r = interlockK(c, { x: hx, y: hy, scale: 3.3, t: tq, k, squeeze, trace, rot: 0.06, az: -0.3, el: -0.12, arm: 420, vee: -0.22, dx0: 112, dy0: 16,
      keyColor: '#625a7c', fillColor: '#16132b', tint: 0.97, herSleeve: '#1c2541', hisSleeve: '#9aa3bd', sleeveAt: 110, his: { sleeveAt: 300 }, light: -1.5 }); c.setTransform(1, 0, 0, 1, 0, 0); return r; },
      { dirs: [{ angle: PI + 0.25, width: 5.5, color: '#ffc27a' }, { angle: -0.25, width: 4.5, color: '#ffc9c0', alpha: 0.8 }],
        // the lights are a band behind the knuckles and fingers: the rim is strongest there, fading up the forearms
        rimMask: (c, x0, y0, x1, y1) => { const g = c.createLinearGradient(0, 80, 0, 760); g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.45, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0.85)'); c.fillStyle = g; c.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8); },
        alpha: Math.min(1, 0.9 + 0.5 * ne2 + 0.2 * ne1), glow: 0.3 * ne2, glowPx: 12 });
    // grass in front of the fingers where the hands rest (in focus)
    foreBlades(ctx, tq, { seed: 35, count: 220, x0: -40, x1: W + 40, y: 690, lmin: 24, lmax: 86, wmin: 4, wmax: 10, rim: '#ffcf96', color: '#090d1a', lean: 0.35 });
    foreBlades(ctx, tq, { seed: 36, count: 80, x0: -40, x1: W + 40, y: 712, lmin: 70, lmax: 160, wmin: 5, wmax: 12, rim: '#ffd9a8', color: '#070b16', lean: 0.5 });
    ctx.restore();
    // the forearms recede into the dark above: keep the eye on the hands
    const tg = ctx.createLinearGradient(0, 0, 0, 380); tg.addColorStop(0, 'rgba(6,9,24,0.62)'); tg.addColorStop(1, 'rgba(6,9,24,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 380);
    // near: big defocused grass + a few out-of-focus lights low in the frame (where the subtitle sits: dark) — static
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(c21Near(), 0, 0); ctx.restore();
  }
  function c21Near() {
    return PV.cached('g06:c21near', W, H, (c) => {
      const A = PV.makeCanvas(W, H), a = A.ctx;
      a.fillStyle = 'rgba(4,7,14,0.5)'; a.fillRect(0, 800, W, 400);
      foreBlades(a, 0, { seed: 41, count: 64, x0: -100, x1: W + 100, y: 1130, lmin: 140, lmax: 330, wmin: 18, wmax: 40, color: '#05080f', rim: '#b0804e', lean: 0.3 });
      c.filter = 'blur(16px)'; c.drawImage(A.canvas, 0, 0); c.filter = 'none';
      c.fillStyle = 'rgba(4,7,14,0.25)'; c.fillRect(0, 860, W, 220);
      L.bokeh(c, 0, { seed: 2104, count: 6, rmin: 70, rmax: 130, x0: -60, x1: 520, y0: 940, y1: 1150, alpha: 0.18, mode: 'lighter', colors: ['#c8701c', '#c2456e'] });
      L.bokeh(c, 0, { seed: 2105, count: 5, rmin: 70, rmax: 130, x0: 1450, x1: 1980, y0: 940, y1: 1150, alpha: 0.16, mode: 'lighter', colors: ['#d0a246', '#c8701c'] });
    });
  }

  /* ======================================================================= C22 */
  // 70.0–75.5 (t: 0–5.5). Their backs (she on his left), the bay, the lit white bridge and its lights on the water.
  // 70.4 『コンクールが終わったらさ……また、セッションしようね』, 74.0 (t=4.0) her head comes to rest on his shoulder.
  // Slow push-in. The world behind them is flattened at zoom 1 and drawn once through the camera.
  const C22 = { cam: { cx: 920, cy: 500 },
    bay: { hz: 470, wheelX: 250, wheelR: 98, cityX0: -40, cityX1: 980, cityH: 210, bridgeX0: 930, bridgeX1: 2150, deck: 34, towerH: 230, towers: [1240, 1800], span: 250, lw: 4.6, lamps: 18,
      paint: (c) => L.glow(c, 920, 470, 600, '#ffe2b8', 0.11) } };   // the shore's warm light behind them (baked)
  function c22Near() {      // big out-of-focus blades across the bottom — painted once
    return PV.cached('g06:c22near', W, H, (c) => {
      const A = PV.makeCanvas(W, H), a = A.ctx;
      foreBlades(a, 0, { seed: 22, count: 44, x0: -80, x1: W + 80, y: 1110, lmin: 70, lmax: 180, wmin: 12, wmax: 26, rim: '#ffcf96' });
      c.filter = 'blur(12px)'; c.drawImage(A.canvas, 0, 0); c.filter = 'none';
    });
  }
  PV.shot('C22', { draw(ctx, t, d) { const tq0 = q12(clamp(t, 0, d)); onTwos(ctx, 'C22', tq0, () => drawC22(ctx, tq0, d)); } });
  function drawC22(ctx, t, d) {
    const tc = t, tq = t;   // on twos: every input below is the quantised time
    const push = PV.ease.inOut(tc / d);
    const lean = PV.ease.inOut(clamp((tc - 4.0) / 1.2));
    // ---- the world behind them at zoom 1
    const WB = PV.buffer('g06:c22world'), w = WB.ctx;
    const B = bayStatic('c22bay', C22.bay, 2.6);
    w.fillStyle = '#121a3c'; w.fillRect(0, 0, W, H);          // (the buffer is reused: start every frame from a clean base)
    w.save(); w.imageSmoothingEnabled = false; w.drawImage(B.img, 0, 0); w.restore();
    bayWater(w, tq, B, 770, 'c22', [0, 466, W, 774]);
    L.bokeh(w, tq, { seed: 2203, count: 30, rmin: 12, rmax: 40, x0: -40, x1: W + 40, y0: 300, y1: 500, alpha: 0.3, mode: 'lighter', colors: ['#e8a24a', '#fff1d6', '#e88aa0', '#ffbf6b'] });
    // the lawn's edge and railing below the couple, the lawn
    w.fillStyle = '#080c18'; w.fillRect(0, 758, W, 14); w.fillStyle = 'rgba(214,180,190,0.22)'; w.fillRect(0, 758, W, 2);
    nightLawn(w, tq, { y0: 770, key: 'c22b', seed: 2022 });
    // the warm light of the shore behind them grows a little as she leans on him
    if (lean > 0.01) lightPass(w, (c) => L.glow(c, 920, 470, 600, '#ffe2b8', 0.1 * lean), 'c22warm', [300, 0, 1540, 1080]);
    ctx.save();
    PV.camera(ctx, { zoom: 1 + 0.1 * push, cx: C22.cam.cx, cy: C22.cam.cy });
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(WB.canvas, 0, 0);
    // the couple from behind: she sits on his left (her dress and cardigan, his summer shirt)
    L.coupleSittingBack(ctx, tq, { x: 925, y: 965, scale: 1.42, seat: 'grass', lean, girlOutfit: 'blazer', boyOutfit: 'shirt', wind: 0.35, windDir: -0.2,
      light: -PI / 2 - 0.3, rimColor: '#ffe6c4', backlight: 0.28, glow: 0.55 });
    // the lawn in front of where they sit (the figure's own tufts catch the rim light too brightly: bury them in dark grass)
    ctx.save(); const gg = ctx.createLinearGradient(0, 958, 0, 1040); gg.addColorStop(0, 'rgba(9,12,24,0)'); gg.addColorStop(0.4, 'rgba(9,12,24,0.92)'); gg.addColorStop(1, 'rgba(6,9,18,1)');
    ctx.fillStyle = gg; ctx.fillRect(-100, 958, W + 200, 240); ctx.restore();
    foreBlades(ctx, tq, { seed: 2221, count: 300, x0: 380, x1: 1480, y: 1012, lmin: 36, lmax: 92, wmin: 4, wmax: 9, color: '#070a15', rim: '#8a6a4c', lean: 0.25 });
    foreBlades(ctx, tq, { seed: 2222, count: 140, x0: 300, x1: 1560, y: 1050, lmin: 44, lmax: 120, wmin: 6, wmax: 12, color: '#05080f', rim: '#6d5440', lean: 0.3 });
    ctx.restore();
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(c22Near(), 0, 0); ctx.restore();
  }

  /* ======================================================================= C23 */
  // 75.5–78.5 (t: 0–3.0). An autumn morning; the low sun is behind her: cold backlight. Her right hand holds the bag
  // strap across her white blouse — the same screen position, size and white sleeve as the hand on the keys (C03) and
  // the cast (C01) — and the fingers play the theme in her head (M12, ♩=80), a descending line, little finger to index:
  // F#5 (t 0) · E5 (1.125) · D5 (1.5) · A4『ね』(2.25 = 77.75); then the little finger rises for F#5, which never comes.
  // 77.7 (2.2) a windshield reflection swells from the right, 78.2 (2.7) the frame burns white.
  // Palette: cold blue-white #cfe3f5 / #f4f1ea, skin, the red ribbon #b33a3a, flare white.
  const C23 = {
    edge: (c) => { c.moveTo(1330, -40); c.bezierCurveTo(1480, 70, 1720, 260, 1960, 600); },   // her left shoulder / side
    sun: [1770, 30],
  };
  // street trees passing between her and the low sun (near layer of the street): canopy centres at time t
  const c23Trees = (t) => { const out = []; for (let k = 0; k < 4; k++) out.push(2150 - (((t * 430 + k * 820 + 260) % 3280) + 3280) % 3280); return out; };
  function c23SunVis(t) {   // 1 = the sun clear of the trees, lower while a canopy crosses it (the light flickers as she walks)
    let cov = 0; for (const x of c23Trees(t)) cov = Math.max(cov, Math.exp(-Math.pow((x - C23.sun[0]) / 190, 2)));
    return 1 - 0.42 * cov;
  }
  function c23Street(c, t) {
    // what shows past her shoulder: the street toward the low sun, blown out — sky, hazy houses, ginkgo canopies
    // lit from behind (they glow), a trunk now and then (blurred and clipped by the caller)
    const g = c.createLinearGradient(1300, 0, 1920, 560); g.addColorStop(0, '#e4eef8'); g.addColorStop(0.5, '#f1f6fb'); g.addColorStop(1, '#fbfdff');
    c.fillStyle = g; c.fillRect(1180, -60, 820, 760);
    const p1 = ((t * 70) % 1200 + 1200) % 1200;
    for (let i = 0; i < 9; i++) {
      const bx = 1180 + ((i * 170 - p1) % 1200 + 1200) % 1200, bh = 90 + 130 * hash(i, 5), bw = 120 + 90 * hash(i, 6);
      c.fillStyle = i % 3 ? '#d3dfeb' : '#dbe5f0'; c.fillRect(bx, 520 - bh, bw, bh + 400);
    }
    for (const x of c23Trees(t)) {
      c.fillStyle = '#7d8693'; c.fillRect(x - 15, 150, 30, 700);
      for (let j = 0; j < 8; j++) {
        const a = j / 8 * TAU + 0.4, rx = 120 + 40 * hash(j, 9), ry = 90 + 30 * hash(j, 10);
        c.fillStyle = ['#f6e6a4', '#efd889', '#fbf1cc', '#f3df98'][j % 4];
        c.beginPath(); c.ellipse(x + Math.cos(a) * 120, 120 + Math.sin(a) * 85, rx, ry, 0, 0, TAU); c.fill();
      }
    }
  }
  // the white blouse behind the strap, in the shade of her own body (lit by the cold sky; brighter toward her lit
  // side where the low sun wraps round): broad soft folds, the strap's pressure wrinkles, the placket and its buttons,
  // the collar points. Painted once, lightly pre-blurred (the fabric sits a little behind the hand's focus plane).
  let blouseImg = null;
  function blouseBG() {
    if (blouseImg) return blouseImg;
    const A = PV.makeCanvas(W, H + 80), c = A.ctx; c.translate(0, 40);
    const bg = c.createLinearGradient(80, 1100, 1700, -60); bg.addColorStop(0, '#93a5bd'); bg.addColorStop(0.35, '#adbdd1'); bg.addColorStop(0.68, '#cbd6e4'); bg.addColorStop(1, '#eaf0f7');
    c.fillStyle = bg; c.fillRect(-20, -40, W + 40, H + 80);
    // the strap's line on the chest (the 2D path it takes on screen — painted into the cache only as pressure wrinkles)
    const sy = (x) => 0.448 * x + 135;           // ≈ the strap's centre line on screen (its edges at ±62)
    const band = (pts, w, col) => {             // a soft fold: a tapered band along a curve
      c.save(); c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
      for (let k = 0; k < 3; k++) { c.globalAlpha = [0.35, 0.5, 0.8][k]; c.lineWidth = w * [1, 0.6, 0.3][k]; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]); c.stroke(); }
      c.restore();
    };
    // broad folds hanging from under the strap toward the lower left (gravity + the pull of the bag)
    for (let i = 0; i < 4; i++) {
      const x0 = 380 + i * 330 + 50 * hash(i, 3), y0 = sy(x0) + 60;
      band([[x0, y0], [x0 - 60, y0 + 180], [x0 - 200, y0 + 380], [x0 - 330, 1160]], 70 + 30 * hash(i, 4), i % 2 ? 'rgba(236,242,250,0.22)' : 'rgba(78,96,128,0.16)');
    }
    // above the strap, folds run up toward her shoulder
    for (let i = 0; i < 3; i++) {
      const x0 = 640 + i * 300 + 40 * hash(i, 7), y0 = sy(x0) - 60;
      band([[x0, y0], [x0 + 70, y0 - 120], [x0 + 150, y0 - 260], [x0 + 260, -60]], 60 + 20 * hash(i, 8), i % 2 ? 'rgba(78,96,128,0.14)' : 'rgba(240,245,252,0.24)');
    }
    // pressure wrinkles where the strap presses the fabric (short curved shadows along both edges)
    for (let i = 0; i < 9; i++) {
      const x = 120 + i * 205 + 40 * hash(i, 11), y = sy(x), side = i % 2 ? 1 : -1, l = 60 + 50 * hash(i, 12);
      c.save(); c.strokeStyle = 'rgba(70,88,120,0.26)'; c.lineWidth = 10; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y + side * 64); c.quadraticCurveTo(x - 14 * side, y + side * (64 + l * 0.5), x - 42 * side, y + side * (64 + l)); c.stroke();
      c.strokeStyle = 'rgba(244,248,253,0.3)'; c.lineWidth = 6; c.beginPath(); c.moveTo(x + 16, y + side * 66); c.quadraticCurveTo(x + 2 * side + 16, y + side * (66 + l * 0.45), x - 26 * side + 16, y + side * (66 + l * 0.9)); c.stroke();
      c.restore();
    }
    // placket (a raised band down the centre front) with its buttons
    c.save(); c.translate(1218, -40); c.rotate(0.07);
    c.fillStyle = 'rgba(250,252,255,0.3)'; c.fillRect(-28, 0, 56, 1250);
    c.fillStyle = 'rgba(70,86,116,0.45)'; c.fillRect(26, 0, 4, 1250); c.fillStyle = 'rgba(70,86,116,0.3)'; c.fillRect(-31, 0, 3, 1250);
    for (let k = 0; k < 5; k++) {
      const y = 230 + k * 260;
      c.fillStyle = 'rgba(60,74,100,0.35)'; c.beginPath(); c.arc(3, y + 4, 14, 0, TAU); c.fill();
      c.fillStyle = '#eef2f7'; c.beginPath(); c.arc(0, y, 13, 0, TAU); c.fill(); c.strokeStyle = 'rgba(80,94,120,0.75)'; c.lineWidth = 2.2; c.stroke();
      c.fillStyle = 'rgba(80,94,120,0.6)'; for (const [bx, by] of [[-4, -3], [4, -3], [-4, 4], [4, 4]]) { c.beginPath(); c.arc(bx, y + by, 1.7, 0, TAU); c.fill(); }
    }
    c.restore();
    // the collar points (top centre) and their soft shadow on the front
    c.fillStyle = 'rgba(60,76,106,0.32)'; c.beginPath(); c.moveTo(1120, 60); c.lineTo(1160, 160); c.lineTo(1218, 92); c.lineTo(1278, 162); c.lineTo(1320, 60); c.closePath(); c.fill();
    c.fillStyle = '#e6ecf3'; c.strokeStyle = 'rgba(80,96,124,0.7)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(1050, -40); c.lineTo(1146, 132); c.lineTo(1214, 44); c.lineTo(1206, -40); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(1384, -40); c.lineTo(1290, 136); c.lineTo(1222, 44); c.lineTo(1230, -40); c.closePath(); c.fill(); c.stroke();
    // her lit side: the backlight glows through the fabric near her silhouette (top right)
    const rg = c.createRadialGradient(1900, 40, 0, 1900, 40, 980); rg.addColorStop(0, 'rgba(246,250,254,0.9)'); rg.addColorStop(0.45, 'rgba(236,243,250,0.4)'); rg.addColorStop(1, 'rgba(236,243,250,0)');
    c.fillStyle = rg; c.fillRect(800, -40, W - 800, 1100);
    const B = PV.makeCanvas(W, H + 80); B.ctx.filter = 'blur(5px)'; B.ctx.drawImage(A.canvas, 0, 0); B.ctx.filter = 'none';
    const C = PV.makeCanvas(W, H + 80); C.ctx.fillStyle = '#adbdd1'; C.ctx.fillRect(0, 0, W, H + 80); C.ctx.drawImage(B.canvas, 0, 0);
    return (blouseImg = C.canvas);
  }
  PV.shot('C23', { draw(ctx, t, d, S) {
    const tq0 = q12(clamp(t, 0, d));
    postFor(S, { vignette: 0.45 * (1 - sm(2.47, 2.72, tq0)) });   // the burn is pure white to the corners (C24 opens on it)
    onTwos(ctx, 'C23', tq0, () => drawC23(ctx, tq0, d));
  } });
  function drawC23(ctx, t, d) {
    const tc = t, tq = t;   // on twos: every input below is the quantised time
    const flareK = sm(2.2, 2.7, tc), white = sm(2.47, 2.72, tc);
    const freeze = sm(2.3, 2.55, tc);                      // the walk stops dead
    const ph = tc * 1.9 * TAU;                             // ~1.9 steps per second
    const bob = Math.sin(ph) * 6 * (1 - freeze), swing = Math.sin(ph * 0.5) * (1 - freeze);
    const sv = c23SunVis(tq);                              // the sun flickers behind the passing street trees
    // ---- the blouse (her own shade) + the over-bright street past her shoulder, sliding by
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(blouseBG(), 0, Math.round(-40 + bob * 0.5)); ctx.restore();
    ctx.save(); ctx.beginPath(); C23.edge(ctx); ctx.lineTo(1960, -40); ctx.closePath(); ctx.clip();
    softLayer(ctx, 24, (c) => c23Street(c, tq), 'c23street', 1, 0.25, [1300, 0, W, 640]);
    ctx.restore();
    // ---- the low sun: glare beyond her shoulder, the light wrapping round her silhouette, faint shafts into the frame
    lightPass(ctx, (c) => {
      L.glow(c, C23.sun[0], C23.sun[1], 560, '#ffffff', 0.9 * sv);
      L.glow(c, C23.sun[0], C23.sun[1], 1500, '#dceaf8', 0.18 + 0.08 * sv);
      c.save(); c.lineCap = 'round'; c.strokeStyle = `rgba(255,255,255,${(0.75 * sv).toFixed(3)})`; c.lineWidth = 26; c.beginPath(); C23.edge(c); c.stroke(); c.restore();
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const a = 2.38 + (i - 2) * 0.12 + 0.02 * Math.sin(tq * 0.7 + i), w = 0.05 + 0.03 * hash(i, 41), L1 = 2300;
        c.fillStyle = `rgba(232,242,255,${(0.045 * sv * (0.6 + 0.4 * hash(i, 42))).toFixed(3)})`;
        c.beginPath(); c.moveTo(C23.sun[0], C23.sun[1]); c.lineTo(C23.sun[0] + Math.cos(a - w) * L1, C23.sun[1] + Math.sin(a - w) * L1); c.lineTo(C23.sun[0] + Math.cos(a + w) * L1, C23.sun[1] + Math.sin(a + w) * L1); c.closePath(); c.fill();
      }
      c.restore();
    }, 'c23sun', [560, 0, W, 760]);
    // ---- the hand on the strap (in focus): same rig and camera as the hand on the keys (C03)
    const notes = [[0.0, 4], [1.125, 3], [1.5, 2], [2.25, 1]];
    const press = [0, -0.12, -0.08, -0.1, -0.15];
    let accent = 0;
    for (const [nt, f] of notes) {
      const u = (tq - nt);
      const lift = sm(-0.46, -0.2, u) * (1 - sm(-0.1, -0.01, u));          // the finger rises …
      const hit = sm(-0.04, 0.03, u) * (1 - sm(0.16, 0.34, u));            // … and taps (staccato)
      press[f] += -3.1 * lift + 0.8 * hit;
      accent += hit * (1 - sm(0.05, 0.3, u));
    }
    press[4] = Math.min(press[4], -2.4 * sm(2.3, 2.55, tq));   // the little finger rises for F#5 … which never lands
    const hx = 900, hy = 520 + bob;
    const base = { x: hx, y: hy, scale: 3.35, t: tc, az: 0.78, el: 0.5, press, keys: [-2, -1, 0, 1, 2 + 1.1 * sm(2.3, 2.55, tq)], drawKeys: false, fallboard: false, shadow: false,
      sleeve: '#cdd6e3', sleeveAt: 66, arm: 330, rot: 0.03 * swing, keyColor: '#e4ebf6', fillColor: '#8e9bb9', tint: 0.5, light: -0.7, wristY: -29 + 1.5 * swing + 2.5 * accent };
    // the blouse cuff (a band in the hand's own 3D space, with a button on the outer side)
    const drawCuff = (c, rig) => {
      const V = L._handMath.V, pts = [];
      for (const yy of [54, 70]) for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; const q = rig.P(V(Math.cos(a) * 29.5, yy, Math.sin(a) * 22 - 3)); pts.push([q.x, q.y]); }
      pts.sort((p1, p2) => p1[0] - p2[0] || p1[1] - p2[1]);
      const cr = (o, a2, b2) => (a2[0] - o[0]) * (b2[1] - o[1]) - (a2[1] - o[1]) * (b2[0] - o[0]);
      const lo = [], up = []; for (const q of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
      for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
      const hl = lo.slice(0, -1).concat(up.slice(0, -1));
      c.save(); c.beginPath(); hl.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath();
      c.fillStyle = '#dde4ee'; c.fill(); c.lineWidth = 1.8; c.strokeStyle = '#76839c'; c.stroke();
      c.clip(); const e0 = rig.P(V(-28, 60, 10)), e1 = rig.P(V(28, 60, 10)); const g2 = c.createLinearGradient(e0.x, e0.y, e1.x, e1.y);
      g2.addColorStop(0, 'rgba(120,138,170,0.5)'); g2.addColorStop(0.6, 'rgba(255,255,255,0)'); g2.addColorStop(1, 'rgba(255,255,255,0.45)'); c.fillStyle = g2; c.fillRect(0, 0, W, H);
      const s0 = rig.P(V(-29, 70, 4)), s1 = rig.P(V(29, 70, 4)); c.strokeStyle = 'rgba(96,110,138,0.6)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(s0.x, s0.y); c.lineTo(s1.x, s1.y); c.stroke();
      const bt = rig.P(V(24, 62, 14)); c.fillStyle = '#f3f6fa'; c.beginPath(); c.arc(bt.x, bt.y, 6.5 * rig.unit, 0, TAU); c.fill(); c.strokeStyle = 'rgba(90,104,130,0.7)'; c.lineWidth = 1.3; c.stroke();
      c.restore();
    };
    rimPass(ctx, (rig) => rigsBox([rig], 34), (c) => { const rig = L.handOnKeys(c, base); drawCuff(c, rig); return rig; }, {
      under: (cx, rig, A) => {
        // the strap: a leather band across her chest from the right shoulder, in the hand's own 3D space
        const P = rig.Pkey;
        const z0 = 26, z1 = -40, x0 = -600, x1 = 600;
        const q = [P({ x: x0, y: 0, z: z0 }), P({ x: x1, y: 0, z: z0 }), P({ x: x1, y: 0, z: z1 }), P({ x: x0, y: 0, z: z1 })];
        const sd = [P({ x: x0, y: 5, z: z0 + 3 }), P({ x: x1, y: 5, z: z0 + 3 })];
        cx.save();
        // its soft occlusion shadow on the blouse along the near edge (no blur: a gradient band)
        { const a0 = sd[0], a1 = sd[1], wd = 44, dl = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1;
          let nx = -(a1.y - a0.y) / dl, ny = (a1.x - a0.x) / dl; if (ny < 0) { nx = -nx; ny = -ny; }
          const gsh = cx.createLinearGradient(a0.x - nx * 4, a0.y - ny * 4, a0.x + nx * wd, a0.y + ny * wd);
          gsh.addColorStop(0, 'rgba(52,64,92,0.5)'); gsh.addColorStop(1, 'rgba(52,64,92,0)');
          cx.fillStyle = gsh; cx.beginPath(); cx.moveTo(a0.x - nx * 4, a0.y - ny * 4); cx.lineTo(a1.x - nx * 4, a1.y - ny * 4); cx.lineTo(a1.x + nx * wd, a1.y + ny * wd); cx.lineTo(a0.x + nx * wd, a0.y + ny * wd); cx.closePath(); cx.fill(); }
        // thickness (near side face), the top face, stitching, the lit far edge
        cx.fillStyle = '#26170f'; cx.beginPath(); cx.moveTo(q[0].x, q[0].y); cx.lineTo(q[1].x, q[1].y); cx.lineTo(sd[1].x, sd[1].y); cx.lineTo(sd[0].x, sd[0].y); cx.closePath(); cx.fill();
        const sg = cx.createLinearGradient(q[0].x, q[0].y, q[3].x, q[3].y); sg.addColorStop(0, '#5a3a2a'); sg.addColorStop(0.55, '#6b4634'); sg.addColorStop(1, '#7c5442');
        cx.fillStyle = sg; cx.beginPath(); q.forEach((p, i) => (i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y))); cx.closePath(); cx.fill();
        cx.setLineDash([9, 7]); cx.strokeStyle = 'rgba(232,212,182,0.5)'; cx.lineWidth = 1.6;
        for (const zz of [z0 - 6, z1 + 6]) { const a = P({ x: x0, y: 0, z: zz }), b = P({ x: x1, y: 0, z: zz }); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); }
        cx.setLineDash([]);
        { const a = P({ x: x0, y: 0, z: z1 }), b = P({ x: x1, y: 0, z: z1 }); cx.strokeStyle = `rgba(246,250,255,${(0.55 + 0.35 * sv).toFixed(3)})`; cx.lineWidth = 2.6; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); }
        const s0 = P({ x: x0, y: 0, z: -14 }), s1 = P({ x: x1, y: 0, z: -14 });
        cx.strokeStyle = 'rgba(214,226,246,0.13)'; cx.lineWidth = 12; cx.beginPath(); cx.moveTo(s0.x, s0.y); cx.lineTo(s1.x, s1.y); cx.stroke();
        cx.restore();
        // the hand's soft contact shadow on the strap and the blouse (diffuse: she is in her own shade) — the subject's
        // own silhouette, blurred at quarter resolution and nudged down-left, away from the light
        const g = 0.25, bb = rigsBox([rig], 40), sx0 = Math.max(0, bb[0] - 40), sy0 = Math.max(0, bb[1] - 30), sx1 = Math.min(W, bb[2] + 40), sy1 = Math.min(H, bb[3] + 60);
        const sh = PV.buffer('g06:c23sh', W * g, H * g), sc = sh.ctx; sc.clearRect(sx0 * g - 4, sy0 * g - 4, (sx1 - sx0) * g + 8, (sy1 - sy0) * g + 8);
        sc.filter = 'blur(3.5px)'; sc.drawImage(A.canvas, sx0, sy0, sx1 - sx0, sy1 - sy0, (sx0 - 12) * g, (sy0 + 20) * g, (sx1 - sx0) * g, (sy1 - sy0) * g); sc.filter = 'none';
        sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#1e2840'; sc.fillRect(sx0 * g - 4, sy0 * g - 4, (sx1 - sx0) * g + 8, (sy1 - sy0) * g + 8); sc.globalCompositeOperation = 'source-over';
        cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalAlpha = 0.34; cx.imageSmoothingQuality = 'low';
        cx.drawImage(sh.canvas, sx0 * g, sy0 * g, (sx1 - sx0) * g, (sy1 - sy0) * g, sx0, sy0, sx1 - sx0, sy1 - sy0); cx.restore();
      },
      angle: -0.8, width: 3.6, width2: 0.4, color: '#f4f8ff', alpha: 0.6 + 0.45 * sv + 1.4 * flareK, glow: 0, glowPx: 10 });
    // ---- edges of frame: the red ribbon under the collar (top) and locks of her black hair (top left), out of focus,
    //      swaying with the walk, their edges lit by the low sun
    softLayer(ctx, 7, (c) => {
      c.save(); c.translate(0, bob * 0.8);
      c.fillStyle = '#8e2a2c'; c.beginPath(); c.ellipse(1218, 6, 48, 30, 0.08, 0, TAU); c.fill();
      for (const [x, ln, a0, wd, ph0] of [[1196, 262, 0.24, 52, 0.4], [1242, 232, -0.14, 48, 1.3]]) {
        const a = a0 + swing * 0.1 + 0.05 * Math.sin(ph + ph0);
        c.save(); c.translate(x, 16); c.rotate(a);
        c.fillStyle = '#b33a3a'; c.beginPath(); c.moveTo(-wd * 0.35, 0); c.lineTo(wd * 0.35, 0); c.lineTo(wd * 0.5, ln); c.lineTo(0, ln - 30); c.lineTo(-wd * 0.5, ln + 4); c.closePath(); c.fill();
        c.fillStyle = 'rgba(104,22,28,0.55)'; c.beginPath(); c.moveTo(-wd * 0.35, 0); c.lineTo(-wd * 0.08, 0); c.lineTo(-wd * 0.16, ln - 14); c.lineTo(-wd * 0.5, ln + 4); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,190,178,0.55)'; c.beginPath(); c.moveTo(wd * 0.2, 0); c.lineTo(wd * 0.35, 0); c.lineTo(wd * 0.5, ln); c.lineTo(wd * 0.36, ln - 8); c.closePath(); c.fill();
        c.restore();
      }
      c.restore();
    }, 'c23ribbon', 1, 0.25, [1060, 0, 1400, 330]);
    softLayer(ctx, 7, (c) => {
      c.save(); c.translate(0, bob * 0.8);
      for (let i = 0; i < 4; i++) {
        const x0 = -40 + i * 78 + 30 * hash(i, 7), ln = 330 + 210 * hash(i, 8), w0 = 104 - i * 14;
        const sw = Math.sin(ph * 0.5 + i * 0.6) * 26 + swing * (20 + i * 4);
        const P2 = []; for (let k = 0; k <= 14; k++) { const u = k / 14; P2.push([x0 + 130 * u - 70 * u * u + sw * u * u * 1.8 + 14 * Math.sin(u * 5 + i), -60 + ln * u]); }
        const L1 = [], L2 = [];
        for (let k = 0; k < P2.length; k++) { const q0 = P2[Math.max(0, k - 1)], q1 = P2[Math.min(P2.length - 1, k + 1)]; let tx = q1[0] - q0[0], ty = q1[1] - q0[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; const w = w0 * Math.pow(1 - k / 14, 0.65) / 2; L1.push([P2[k][0] - ty * w, P2[k][1] + tx * w]); L2.push([P2[k][0] + ty * w, P2[k][1] - tx * w]); }
        const hg = c.createLinearGradient(0, -60, 0, -60 + ln); hg.addColorStop(0, 'rgba(10,12,19,1)'); hg.addColorStop(0.75, 'rgba(10,12,19,0.95)'); hg.addColorStop(1, 'rgba(10,12,19,0.2)');
        c.fillStyle = hg; c.beginPath(); L1.forEach((q, k) => (k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); for (let k = L2.length - 1; k >= 0; k--) c.lineTo(L2[k][0], L2[k][1]); c.closePath(); c.fill();
        c.lineCap = 'round';
        for (let j = 0; j < 5; j++) {
          const f = (j + 0.5) / 5; c.strokeStyle = `rgba(160,180,215,${0.12 + 0.08 * hash(i * 5 + j, 3)})`; c.lineWidth = 1.6; c.beginPath();
          for (let k = 0; k <= 12; k++) { const a1 = L1[k], a2 = L2[k]; const x = lerp(a1[0], a2[0], f), y = lerp(a1[1], a2[1], f); k ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
        }
        c.strokeStyle = `rgba(226,238,255,${(0.35 + 0.3 * sv).toFixed(3)})`; c.lineWidth = 3; c.beginPath(); L2.slice(0, 13).forEach((q, k) => (k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
      }
      c.restore();
    }, 'c23hair', 1, 0.25, [0, 0, 520, 640]);
    // ---- the windshield reflection from the right → white
    if (flareK > 0) {
      const fx = W + 70 - 300 * flareK, fy = 470;
      lightPass(ctx, (c) => { L.glow(c, fx, fy, 260 + 2200 * flareK, '#ffffff', 0.35 + 0.65 * flareK); L.glow(c, fx, fy, 180 + 500 * flareK, '#ffffff', 0.6 * flareK); }, 'c23flare', [0, 0, W, H]);
      // the glint itself: a hard white core with a short star, swelling in from the right edge
      L.glow(ctx, fx, fy, 70 + 260 * flareK, '#ffffff', Math.min(1, 0.5 + 1.2 * flareK));
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(fx, fy);
      for (const [a, ln, wd] of [[0, 900, 7], [PI / 2, 260, 5], [0.55, 220, 3], [-0.55, 220, 3]]) {
        ctx.save(); ctx.rotate(a); const gr = ctx.createLinearGradient(-ln * (0.4 + flareK), 0, ln * (0.4 + flareK), 0);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${Math.min(1, 0.3 + flareK).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(-ln * (0.4 + flareK), -wd * (0.5 + flareK), 2 * ln * (0.4 + flareK), wd * (1 + 2 * flareK)); ctx.restore();
      }
      ctx.restore();
      L.flare(ctx, fx, fy, 0.5 + 2.4 * flareK, '#f4f8ff');
      ctx.fillStyle = `rgba(255,255,255,${white.toFixed(3)})`; ctx.fillRect(0, 0, W, H);
    }
  }

  /* ======================================================================= C24 */
  // 78.5–83.5 (t: 0–5.0). 78.5–80.5 pure white (digital silence; no vignette, nothing in it).
  // 80.5 (t=2.0) with the first ECG beep the white resolves into the shading of a white ceiling (原作3641「白い天井」)
  // and the gaze drifts down to the window: the high autumn sky, mackerel clouds, the white bridge far out on the bay
  // (the C15 bridge), sheer curtains breathing in the autumn wind — the music room's two windows and pillar (C02), but
  // no piano. 82.3 (t=3.8) tilt down to her right arm in a cast, motionless on the white blanket (her own view).
  // The cold white: no light particles anywhere; shadows a cold grey-blue (#cfe0ea → #8d9aa6). Grade saturate(0.4).
  const RW = { win: [250, 350, 1670, 1070], pillar: [930, 990], bedTop: 1290, H: 2000, TOP: 440 };
  // the gaze: resolve on the ceiling (2.0–2.4), drift down to the window (2.4–3.4), hold, tilt down to the arm (3.8–4.65)
  const c24CamY = (t) => -400 * (1 - PV.ease.sine(clamp((t - 2.4) / 1.0))) + 840 * PV.ease.inOutCubic(clamp((t - 3.8) / 0.85));
  function roomShell() {
    return PV.cached('g06:c24shell2', W, RW.H + RW.TOP, (c) => {
      c.translate(0, RW.TOP);
      const [wx0, wy0, wx1, wy1] = RW.win, edge = wy0 - 40, top = -RW.TOP;
      // ceiling: cold, darker away from the window, tiles in perspective toward the window wall
      const cg = c.createLinearGradient(0, top, 0, edge); cg.addColorStop(0, '#a7b5c3'); cg.addColorStop(0.5, '#cdd7e0'); cg.addColorStop(1, '#ebf0f4');
      c.fillStyle = cg; c.fillRect(0, top, W, edge - top);
      const vpx = 960, vpy = 900;
      c.strokeStyle = 'rgba(128,146,166,0.32)'; c.lineWidth = 1.6;
      for (let i = -16; i <= 16; i++) { const xe = vpx + i * 118, xt = vpx + (xe - vpx) * (vpy - top) / (vpy - edge); c.beginPath(); c.moveTo(xe, edge); c.lineTo(xt, top); c.stroke(); }
      for (let j = 0; j < 9; j++) { const f = 1 - Math.pow(0.7, j + 1), y = edge - (edge - top) * f * 1.02; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      // a recessed light panel (off), an air vent, a smoke detector: the plain fixtures of a ward
      c.fillStyle = 'rgba(232,238,243,0.95)'; c.strokeStyle = 'rgba(118,136,156,0.55)'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(660, 120); c.lineTo(1260, 120); c.lineTo(1330, -40); c.lineTo(590, -40); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(118,136,156,0.3)'; c.lineWidth = 1.4; for (let k = 1; k < 4; k++) { const f = k / 4; c.beginPath(); c.moveTo(lerp(590, 660, 1 - f) + (1330 - 590) * 0, lerp(-40, 120, f)); c.lineTo(lerp(1330, 1260, f), lerp(-40, 120, f)); c.stroke(); }
      c.fillStyle = 'rgba(214,223,231,0.95)'; c.strokeStyle = 'rgba(110,128,150,0.5)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(1460, -250); c.lineTo(1700, -250); c.lineTo(1740, -330); c.lineTo(1430, -330); c.closePath(); c.fill(); c.stroke();
      for (let k = 1; k < 6; k++) { c.beginPath(); c.moveTo(lerp(1430, 1460, k / 6) + 300 * 0, lerp(-330, -250, k / 6)); c.lineTo(lerp(1740, 1700, k / 6), lerp(-330, -250, k / 6)); c.stroke(); }
      c.fillStyle = '#eef2f5'; c.beginPath(); c.ellipse(420, -150, 34, 13, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(110,128,150,0.55)'; c.stroke();
      // the bed-curtain rail (an L along the ceiling) — the bed curtain hangs from it at the left edge
      c.strokeStyle = 'rgba(140,156,174,0.75)'; c.lineWidth = 6; c.beginPath(); c.moveTo(-20, 180); c.lineTo(236, 170); c.lineTo(-220, -290); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-20, 176); c.lineTo(232, 166); c.stroke();
      // the ceiling meets the window wall
      c.fillStyle = 'rgba(126,144,164,0.4)'; c.fillRect(0, edge - 3, W, 5);
      // window wall (openings left transparent), darker toward the floor
      const wg = c.createLinearGradient(0, edge, 0, RW.bedTop); wg.addColorStop(0, '#e2e9ee'); wg.addColorStop(1, '#ccd6de');
      c.fillStyle = wg; c.beginPath(); c.rect(0, edge, W, RW.bedTop - edge + 300);
      c.rect(wx0, wy0, RW.pillar[0] - wx0, wy1 - wy0); c.rect(RW.pillar[1], wy0, wx1 - RW.pillar[1], wy1 - wy0); c.fill('evenodd');
      // the pillar between the windows, in the light's shade (the music room's 窓間壁)
      const pg = c.createLinearGradient(RW.pillar[0], 0, RW.pillar[1], 0); pg.addColorStop(0, '#b4c1cd'); pg.addColorStop(0.5, '#c8d3dc'); pg.addColorStop(1, '#aebbc8');
      c.fillStyle = pg; c.fillRect(RW.pillar[0], wy0, RW.pillar[1] - RW.pillar[0], wy1 - wy0);
      // window reveals in shadow (depth), aluminium frames, sashes, meeting rails
      const frame = (x0, x1) => {
        c.fillStyle = 'rgba(141,154,166,0.55)'; c.fillRect(x0, wy0, x1 - x0, 14); c.fillRect(x0, wy0, 12, wy1 - wy0); c.fillRect(x1 - 12, wy0, 12, wy1 - wy0);
        c.fillStyle = '#f3f6f8'; c.fillRect(x0 + 8, wy0 + 10, x1 - x0 - 16, 16); c.fillRect(x0 + 8, wy1 - 28, x1 - x0 - 16, 28); c.fillRect(x0 + 8, wy0 + 10, 16, wy1 - wy0 - 10); c.fillRect(x1 - 24, wy0 + 10, 16, wy1 - wy0 - 10);
        const mx = (x0 + x1) / 2; c.fillRect(mx - 12, wy0 + 10, 24, wy1 - wy0 - 10);
        c.fillStyle = 'rgba(110,126,146,0.55)'; c.fillRect(x0 + 24, wy0 + 26, x1 - x0 - 48, 3); c.fillRect(mx + 12, wy0 + 26, 3, wy1 - wy0 - 54); c.fillRect(x0 + 24, wy0 + 26, 3, wy1 - wy0 - 54);
        c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(mx - 12, wy0 + 10, 3, wy1 - wy0 - 10);
        c.fillStyle = '#c6d0d9'; c.fillRect(mx - 4, wy0 + 330, 8, 44);   // the sash lock
      };
      frame(wx0, RW.pillar[0]); frame(RW.pillar[1], wx1);
      // the sill and its shadow
      c.fillStyle = '#eef2f5'; c.fillRect(wx0 - 40, wy1, wx1 - wx0 + 80, 26);
      c.fillStyle = 'rgba(126,142,160,0.5)'; c.fillRect(wx0 - 40, wy1 + 26, wx1 - wx0 + 80, 12);
      const sg2 = c.createLinearGradient(0, wy1 + 38, 0, wy1 + 150); sg2.addColorStop(0, 'rgba(126,142,160,0.3)'); sg2.addColorStop(1, 'rgba(126,142,160,0)'); c.fillStyle = sg2; c.fillRect(wx0 - 40, wy1 + 38, wx1 - wx0 + 80, 112);
      // curtain rail above the window
      c.fillStyle = '#d2dbe2'; c.fillRect(wx0 - 70, wy0 - 34, wx1 - wx0 + 140, 12); c.fillStyle = 'rgba(126,142,160,0.45)'; c.fillRect(wx0 - 70, wy0 - 22, wx1 - wx0 + 140, 4);
    });
  }
  // the blanket over her (her own view: from her chest toward the window), with the foot board beyond — painted once
  function bedLayer() {
    return PV.cached('g06:c24bed2', W, RW.H + RW.TOP, (c) => {
      c.translate(0, RW.TOP);
      const y0 = RW.bedTop;
      c.fillStyle = '#c5d0da'; c.fillRect(380, y0 - 72, 1160, 62); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(380, y0 - 72, 1160, 6);
      c.fillStyle = 'rgba(110,128,148,0.4)'; c.fillRect(380, y0 - 16, 1160, 8);
      const g = c.createLinearGradient(0, y0 - 20, 0, RW.H); g.addColorStop(0, '#e6ecf1'); g.addColorStop(0.25, '#eef2f5'); g.addColorStop(0.7, '#dbe3ea'); g.addColorStop(1, '#c6d1db');
      c.fillStyle = g; c.beginPath(); c.moveTo(-40, y0 + 110); c.bezierCurveTo(300, y0 - 34, 1600, y0 - 44, W + 40, y0 + 100); c.lineTo(W + 40, RW.H); c.lineTo(-40, RW.H); c.closePath(); c.fill();
      c.save(); c.clip();
      // her legs make two long soft ridges toward the window: shadow on the far-from-window flank
      const ridge = (x0, x1, w0, w1, a) => {
        for (let k = 0; k < 2; k++) {
          const off = k ? 1 : -1, col = k ? 'rgba(255,255,255,0.55)' : `rgba(124,144,166,${a})`;
          c.fillStyle = col; c.beginPath();
          c.moveTo(x0 + off * w0 * 0.15, y0 + 20); c.quadraticCurveTo(lerp(x0, x1, 0.45) + off * w1 * 0.25, y0 + 420, x1 + off * w1 * 0.35, RW.H);
          c.lineTo(x1 + off * w1 * 0.9, RW.H); c.quadraticCurveTo(lerp(x0, x1, 0.45) + off * w1 * 0.7, y0 + 420, x0 + off * w0 * 0.5, y0 + 20); c.closePath();
          c.filter = 'blur(24px)'; c.fill(); c.filter = 'none';
        }
      };
      ridge(830, 560, 70, 330, 0.36); ridge(1010, 1160, 70, 330, 0.34);
      // long soft folds, and the dip where the blanket sags between the legs
      c.strokeStyle = 'rgba(124,144,166,0.3)'; c.lineWidth = 20; c.filter = 'blur(11px)';
      for (const [xa, xb] of [[230, 20], [420, 290], [1480, 1740], [1600, 1910], [930, 880]]) { c.beginPath(); c.moveTo(xa, y0 + 120); c.quadraticCurveTo((xa + xb) / 2 + 40, y0 + 420, xb, RW.H); c.stroke(); }
      c.filter = 'none'; c.restore();
      const lg = c.createLinearGradient(0, y0 - 40, 0, y0 + 240); lg.addColorStop(0, 'rgba(255,255,255,0.7)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = lg; c.fillRect(0, y0 - 40, W, 280);
    });
  }
  // her right arm in the cast, lying on the blanket (no sling: she is lying down) — motionless, so painted once,
  // with its soft shadow and the dent it makes in the blanket
  const CAST = { x: 905, y: 1500, scale: 2.85, rot: -0.92, t: 0, sling: false, tremble: 0, coverFingers: 0.03, arm: 340,
    curl: [0.3, 0.36, 0.46, 0.55, 0.64], spread: 0.12, pitch: 0.2, yaw: -0.18 };
  function castLayer() {
    return PV.cached('g06:c24cast', W, RW.H + RW.TOP, (c) => {
      c.translate(0, RW.TOP);
      const sh = PV.makeCanvas(W, RW.H + RW.TOP), s = sh.ctx; s.translate(0, RW.TOP);
      L.armCast(s, Object.assign({}, CAST, { x: CAST.x - 10, y: CAST.y + 46, style: 'silhouette', color: '#4f647c' }));
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'blur(18px)'; c.globalAlpha = 0.5; c.drawImage(sh.canvas, 0, 0); c.filter = 'blur(5px)'; c.globalAlpha = 0.35; c.drawImage(sh.canvas, -4, -14); c.filter = 'none'; c.restore();
      const A = PV.makeCanvas(W, RW.H + RW.TOP), a = A.ctx; a.translate(0, RW.TOP);
      L.armCast(a, Object.assign({}, CAST, { castColor: '#edf0f4', light: -1.75, keyColor: '#f1f5fa', fillColor: '#93a3b9', tint: 0.6 }));
      // a plaster tube lit from the window (ahead): bright on its upper side, a cold core shadow below
      const dx = Math.sin(CAST.rot), dy = -Math.cos(CAST.rot), nx = -dy, ny = dx, hw = 120;   // n points toward the window side
      const g = a.createLinearGradient(CAST.x - nx * hw, CAST.y - ny * hw, CAST.x + nx * hw, CAST.y + ny * hw);
      g.addColorStop(0, 'rgba(104,122,146,0.42)'); g.addColorStop(0.3, 'rgba(104,122,146,0.3)'); g.addColorStop(0.55, 'rgba(104,122,146,0.06)'); g.addColorStop(0.8, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.35)');
      a.save(); a.globalCompositeOperation = 'source-atop'; a.fillStyle = g; a.fillRect(0, -RW.TOP, W, RW.H + RW.TOP); a.restore();
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(A.canvas, 0, 0); c.restore();
    });
  }
  // the view out of the window (sky, clouds, bay, branches) changes on twos: rendered into a buffer in room space,
  // keyed by the quantised time (same inputs → same pixels, so reuse is deterministic)
  function windowView(t) {
    const tq = q12(t), b = PV.buffer('g06:c24view', W / 2, H / 2);
    if (windowView.k === tq) return b.canvas;
    windowView.k = tq;
    const [wx0, wy0, wx1, wy1] = RW.win, c = b.ctx;
    c.clearRect(0, 0, W / 2, H / 2); c.save(); c.scale(0.5, 0.5); c.translate(0, -wy0 + 4);
    L.hospitalView(c, tq, { x: wx0, y: wy0, w: wx1 - wx0, h: wy1 - wy0, seed: 24, bridge: false, mackerel: 0.24, wind: 0.8, alignY: 0.2 });
    // the white bridge (the C15 bridge, far out on the bay), clear in the left window
    c.save(); c.beginPath(); c.rect(wx0, wy0, wx1 - wx0, wy1 - wy0); c.clip();
    const hz = wy0 + (wy1 - wy0 - H * 0.7396) * 0.2 + H * 0.78 * 0.7396;
    L.bridge(c, { x0: 120, x1: 1180, y: hz - 4, towerH: 150, lw: 2.8, cables: 10, towers: [470, 830], span: 175, haze: 0.08, hazeColor: '#e3edf5', shadow: '#a7b8d4', pierH: 18 });
    c.restore();
    c.restore();
    return b.canvas;
  }
  // sheer white curtain: fixed edge x0 (gathered at the wall), free edge x1; the free side billows with the autumn wind
  function curtain(c, t, o) {
    const n = o.folds, dir = o.dir || 1;
    const gust = o.billow * (0.55 + 0.45 * Math.sin(t * 0.8 + o.seed)) * (0.75 + 0.25 * PV.noise2(t * 0.35, o.seed));
    const xAt = (u, v) => lerp(o.x0, o.x1, u) + dir * (Math.sin(PI * Math.min(1, v * 1.08)) * gust * 120 * u + Math.sin(v * 5 + t * 1.5 + u * 3 + o.seed) * 9 * gust * (0.3 + u));
    const hemY = (u) => o.bot - gust * 56 * u * u;
    const N = 18;
    c.save();
    c.beginPath();
    for (let k = 0; k <= N; k++) { const v = k / N; c.lineTo(xAt(0, v), lerp(o.top, hemY(0), v)); }
    for (let k = 0; k <= 8; k++) { const u = k / 8; c.lineTo(xAt(u, 1), hemY(u)); }
    for (let k = N; k >= 0; k--) { const v = k / N; c.lineTo(xAt(1, v), lerp(o.top, hemY(1), v)); }
    c.closePath(); c.fillStyle = `rgba(248,250,252,${o.alpha || 0.4})`; c.fill();
    for (let i = 0; i < n; i++) {
      const ua = i / n, ub = (i + 1) / n, um = (ua + ub) / 2;
      const L1 = [], R1 = [];
      for (let k = 0; k <= N; k++) { const v = k / N; L1.push([xAt(ua, v), lerp(o.top, hemY(ua), v)]); R1.push([xAt(ub, v), lerp(o.top, hemY(ub), v)]); }
      const mid = (lerp(o.x0, o.x1, um) + xAt(um, 0.6)) / 2, wv = Math.abs(o.x1 - o.x0) / n;
      const g = c.createLinearGradient(mid - wv * 0.6, 0, mid + wv * 0.6, 0);
      const dk = 0.2 + 0.14 * Math.abs(Math.sin(i * 2.3 + 0.7)), lt = 0.3 + 0.22 * Math.abs(Math.sin(i * 1.7));
      g.addColorStop(0, `rgba(128,148,170,${dk})`); g.addColorStop(0.45, `rgba(255,255,255,${lt})`); g.addColorStop(1, `rgba(184,198,214,${dk * 0.6})`);
      c.fillStyle = g; c.beginPath(); L1.forEach((q, k) => (k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); for (let k = R1.length - 1; k >= 0; k--) c.lineTo(R1[k][0], R1[k][1]); c.closePath(); c.fill();
    }
    c.strokeStyle = 'rgba(150,168,188,0.55)'; c.lineWidth = 2; c.beginPath();
    for (let k = 0; k <= 8; k++) { const u = k / 8; const x = xAt(u, 1), y = hemY(u); k ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    c.restore();
  }
  // the room as seen with the camera at camY (room space → screen: y − camY); only what is on screen is drawn
  function hospitalRoom(c, t, camY) {
    const cy = Math.round(camY), [wx0, wy0, wx1, wy1] = RW.win;
    const vis = (y0, y1) => y1 > cy && y0 < cy + H;
    // outside the window (behind everything)
    if (vis(wy0, wy1)) { c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low'; c.drawImage(windowView(t), 0, 0, W / 2, (wy1 - wy0 + 8) / 2, 0, wy0 - 4 - cy, W, wy1 - wy0 + 8); c.restore(); }
    // the room shell (ceiling, wall, frames): blit only the visible band
    const sy0 = Math.max(0, cy + RW.TOP), sh = Math.min(H, RW.H + RW.TOP - sy0);
    if (sh > 0) c.drawImage(roomShell(), 0, sy0, W, sh, 0, sy0 - RW.TOP - cy, W, sh);
    c.save(); c.translate(0, -cy);
    // the curtains: the left window is open a little, its curtain breathes in; the bed curtain gathered at the left edge
    if (vis(wy0 - 40, wy1 + 160)) {
      curtain(c, t, { x0: wx0 - 70, x1: wx0 + 250, top: wy0 - 28, bot: wy1 + 150, folds: 9, billow: 1.0, dir: 1, seed: 1.3, alpha: 0.42 });
      curtain(c, t, { x0: wx1 + 70, x1: wx1 - 200, top: wy0 - 28, bot: wy1 + 150, folds: 8, billow: 0.3, dir: -1, seed: 4.1, alpha: 0.42 });
    }
    curtain(c, t, { x0: -60, x1: 150, top: 172, bot: RW.H, folds: 6, billow: 0.06, dir: 1, seed: 7.7, alpha: 0.55 });
    c.restore();
    if (vis(RW.bedTop - 80, RW.H)) {
      const by0 = Math.max(0, cy + RW.TOP), bh = Math.min(H, RW.H + RW.TOP - by0);
      c.drawImage(bedLayer(), 0, by0, W, bh, 0, by0 - RW.TOP - cy, W, bh);
      if (vis(1150, RW.H)) c.drawImage(castLayer(), 0, by0, W, bh, 0, by0 - RW.TOP - cy, W, bh);
    }
  }
  function c24Warm() {
    const b = PV.buffer('g06:c24warm', 4, 4);
    for (const img of [roomShell(), bedLayer(), castLayer()]) b.ctx.drawImage(img, 0, 0, 4, 4);
    // run the reveal and the tilt once off-screen so every buffer is allocated and rasterised before it is needed
    const sc = PV.buffer('g06:c24scratch'); drawC24(sc.ctx, 2.5); drawC24(sc.ctx, 4.3);
    sc.ctx.getImageData(0, 0, 1, 1); windowView.k = null;
  }
  function drawC24(ctx, tc) {
    const reveal = sm(2.0, 3.1, tc), focus = sm(2.05, 3.0, tc);
    const camY = c24CamY(tc);
    // window light blooming into the room (cold, soft), painted at quarter resolution
    const room = (c) => {
      hospitalRoom(c, tc, camY);
      softLayer(c, 0, (cc) => { cc.translate(0, -camY); L.glow(cc, 620, 700, 860, '#ffffff', 0.26); L.glow(cc, 1320, 700, 800, '#ffffff', 0.22); }, 'c24glow', 1, 0.25, [0, 0, W, H], 'screen');
    };
    if (focus >= 0.999) { room(ctx); }
    else {
      const B = PV.buffer('g06:c24scene'); B.ctx.fillStyle = '#ffffff'; B.ctx.fillRect(0, 0, W, H); room(B.ctx);
      softLayer(ctx, 26 * (1 - focus) + 2, (c) => c.drawImage(B.canvas, 0, 0), 'c24blur', 1);
      ctx.save(); ctx.globalAlpha = focus; ctx.drawImage(B.canvas, 0, 0); ctx.restore();
    }
    if (reveal < 1) { ctx.fillStyle = `rgba(255,255,255,${(1 - Math.pow(reveal, 0.8)).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  }
  PV.shot('C24', { draw(ctx, t, d, S) {
    const tc = clamp(t, 0, d);
    // pure white to the corners while it is white; a light, cold post once the room is there (no warm halation)
    postFor(S, { vignette: 0.3 * sm(2.0, 3.1, tc), halation: 0, bloom: 0.18 });
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    if (tc < 2.0) { if (tc < 0.05) c24Warm(); return; }   // 78.5–80.5: pure white, nothing (the room is prepared on the first frame)
    drawC24(ctx, tc);
  } });
})();

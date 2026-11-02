// g11_finale_title — C41〜C44（音が戻る春の街 → 夕暮れの臨海公園 → 二つの手 → タイトル）
//   C41 163.5–167.0 春の街：彼の右腕（袖）にしがみつく先輩の左手。背景はパララックスで右→左へ流れる。
//       葉擦れ 0.1／電車 0.75／子供の声 1.5／店先のBGM 2.25 に、その音源から「音の粒子」が舞い込み、
//       そこから色が戻る（彩度 0.7→1.0）。握りしめた手は、音を受け入れるにつれて少しずつほどける。
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, PI = Math.PI, TAU = PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp, sm = PV.smooth;
  const hash = (i, s) => PV.rand1(i, s);
  const gauss = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  // a note's light: sharp attack at t0, exponential decay
  const attack = (x, t0, dec) => (x < t0 ? Math.exp(-((x - t0) * (x - t0)) / 0.0008) : Math.exp(-(x - t0) / dec));

  /* ======================================================================= shared helpers */
  // paint fn at low resolution (q) and draw it back upscaled = soft, out-of-focus layer.  extra: small blur at low res.
  // rect [x,y,w,h] (screen px) limits the layer to a region (cheaper)
  function softLayer(ctx, key, q, extra, fn, alpha, rect) {
    const R = rect || [0, 0, W, H];
    const w = Math.ceil(R[2] * q), h = Math.ceil(R[3] * q);
    const A = PV.buffer('g11:soft:' + key, w, h), c = A.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'medium'; c.setTransform(q, 0, 0, q, -R[0] * q, -R[1] * q);
    fn(c);
    c.setTransform(1, 0, 0, 1, 0, 0);
    let src = A.canvas;
    if (extra > 0.05) {
      const B = PV.buffer('g11:soft2:' + key, w, h); B.ctx.clearRect(0, 0, w, h); B.ctx.filter = `blur(${extra.toFixed(2)}px)`; B.ctx.drawImage(A.canvas, 0, 0); B.ctx.filter = 'none'; src = B.canvas;
    }
    // bilinear upscale ('high' costs ~3x on a full-screen layer; the layer is pre-blurred anyway)
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(src, 0, 0, w, h, R[0], R[1], R[2], R[3]); ctx.restore();
  }
  // a soft dot sprite (cached per colour)
  const dotCache = {};
  function dot(col) {
    if (dotCache[col]) return dotCache[col];
    const c = PV.makeCanvas(64, 64), g = c.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, PV.rgba(col, 1)); g.addColorStop(0.18, PV.rgba(col, 0.85)); g.addColorStop(0.45, PV.rgba(col, 0.28)); g.addColorStop(1, PV.rgba(col, 0));
    c.ctx.fillStyle = g; c.ctx.fillRect(0, 0, 64, 64); return (dotCache[col] = c.canvas);
  }
  function spark(ctx, x, y, r, col, a) { if (a <= 0.003 || r <= 0.2) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(dot(col), x - r, y - r, r * 2, r * 2); }
  function hole(c, x, y, r, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  // tapered polyline fill (brush stroke) through pts [{x,y}], widths w0 -> w1
  function taper(c, pts, w0, w1) {
    if (pts.length < 2) return;
    const lft = [], rgt = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const w = lerp(w0, w1, i / (pts.length - 1)) / 2;
      lft.push([pts[i].x + nx * w, pts[i].y + ny * w]); rgt.push([pts[i].x - nx * w, pts[i].y - ny * w]);
    }
    c.beginPath(); c.moveTo(lft[0][0], lft[0][1]); for (const p of lft) c.lineTo(p[0], p[1]); for (let i = rgt.length - 1; i >= 0; i--) c.lineTo(rgt[i][0], rgt[i][1]); c.closePath(); c.fill();
  }

  /* ======================================================================= C41 */
  // 163.5–167.0 (t 0–3.5).  SFX: leaves 0.1, train 0.75, children 1.5, shop BGM 2.25 (all on the theme's beat).
  // Low camera tracking beside the two (walking to screen-right): sky + wires, a train on the viaduct, street trees,
  // shops and children across the street stream right → left behind the linked arms (focus on the hands).
  const C41 = { street: 948, deck: 600, vSky: 10, vFar: 36, vRail: 150, vKids: 150, vMid: 470, vNear: 1700, trainV: -2700, trainT0: 0.3 };
  let profCtx = null;   // profiling hook: active only when window.__g11prof is an array (dev)
  function prof(label) { if (window.__g11prof) { if (profCtx) profCtx.getImageData(0, 0, 1, 1); window.__g11prof.push([label, performance.now()]); } }
  // ---- sky (static, painted once, wider than the screen)
  function c41Sky() {
    return PV.cached('g11:c41sky4', 2300, 760, (c, w, h) => {
      const A = PV.makeCanvas(w, h), a = A.ctx;
      const g = a.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a8ad3'); g.addColorStop(0.45, '#82b9ea'); g.addColorStop(0.8, '#bfdff5'); g.addColorStop(1, '#e2f1fa');
      a.fillStyle = g; a.fillRect(0, 0, w, h);
      L.cloudBand(a, 0, { kind: 'cirrus', x: 0, y: 10, w, h: 260, seed: 4105, coverage: 0.34, palette: 'spring', light: -2.6, alpha: 0.5, speed: 0 });
      L.clouds(a, 0, { seed: 4107, count: 5, x0: 0, x1: w, y0: 90, y1: 330, minW: 420, maxW: 820, palette: 'spring', speed: 0, light: -2.5, lightZ: 0.4, aspect: [0.32, 0.46], horizon: h });
      L.clouds(a, 0, { seed: 4108, count: 6, x0: 0, x1: w, y0: 380, y1: 560, minW: 170, maxW: 340, palette: 'spring', speed: 0, type: 'puff', haze: 0.3, horizon: h });
      c.fillStyle = g; c.fillRect(0, 0, w, h); c.filter = 'blur(7px)'; c.drawImage(A.canvas, 0, 0); c.filter = 'none';
    });
  }
  // far town behind the viaduct (hazy), painted once
  function c41Far() {
    return PV.cached('g11:c41far3', 2500, 300, (c, w, h) => {
      let x = -30;
      for (let i = 0; x < w; i++) {
        const bw = 60 + 140 * hash(i, 1), bh = 60 + 210 * Math.pow(hash(i, 2), 1.7);
        c.fillStyle = PV.mix('#bcd2e8', '#a7bfda', hash(i, 3)); c.fillRect(x, h - bh, bw, bh);
        c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(x, h - bh, bw * 0.16, bh);
        c.fillStyle = 'rgba(120,150,190,0.25)';
        for (let yy = h - bh + 12; yy < h - 8; yy += 18) for (let xx = x + 8; xx < x + bw - 10; xx += 15) if (hash(i * 131 + xx * 7 + yy, 5) > 0.4) c.fillRect(xx, yy, 7, 7);
        x += bw + 4 + 20 * hash(i, 4);
      }
    });
  }
  // a street tree (fresh green, lit from the upper left), painted once per seed: 720 x 1000, trunk base at the bottom
  function c41Tree(seed) {
    return PV.cached('g11:c41tree3' + seed, 720, 1000, (c, w, h) => {
      const r = PV.rng(seed);
      c.fillStyle = '#5a493e'; c.beginPath(); c.moveTo(w / 2 - 22, h); c.lineTo(w / 2 - 12, 470); c.lineTo(w / 2 + 12, 470); c.lineTo(w / 2 + 24, h); c.fill();
      c.fillStyle = 'rgba(255,240,210,0.35)'; c.fillRect(w / 2 - 20, 470, 9, h - 470);
      c.strokeStyle = '#5a493e'; c.lineCap = 'round';
      for (let k = 0; k < 5; k++) { c.lineWidth = 13 - k * 1.5; c.beginPath(); c.moveTo(w / 2, 560 - k * 40); c.quadraticCurveTo(w / 2 + (k % 2 ? 1 : -1) * 90, 420 - k * 40, w / 2 + (k % 2 ? 1 : -1) * (150 + 30 * r()), 330 - k * 30); c.stroke(); }
      const blobs = [];
      for (let k = 0; k < 64; k++) { const a = r() * TAU, rr = Math.pow(r(), 0.75); blobs.push([w / 2 + Math.cos(a) * 270 * rr, 330 + Math.sin(a) * 220 * rr, 50 + 44 * r()]); }
      blobs.sort((a, b) => a[1] - b[1]);
      for (const [x, y, rad] of blobs) {
        c.fillStyle = '#3f8a52'; c.beginPath(); c.ellipse(x, y, rad, rad * 0.86, 0, 0, TAU); c.fill();
        c.fillStyle = '#7cc466'; c.beginPath(); c.ellipse(x - rad * 0.22, y - rad * 0.24, rad * 0.78, rad * 0.66, 0, 0, TAU); c.fill();
        c.fillStyle = '#c6ef8a'; c.beginPath(); c.ellipse(x - rad * 0.42, y - rad * 0.42, rad * 0.36, rad * 0.3, 0, 0, TAU); c.fill();
      }
      for (let k = 0; k < 10; k++) { const a = r() * TAU; c.fillStyle = 'rgba(225,245,255,0.7)'; c.beginPath(); c.arc(w / 2 + Math.cos(a) * 250, 330 + Math.sin(a) * 200, 5 + 8 * r(), 0, TAU); c.fill(); }
    });
  }
  // low shop building across the street, 600 x 400 (roof at the top, pavement at the bottom)
  function c41Shop(kind, seed) {
    return PV.cached('g11:c41shop3' + kind + seed, 600, 400, (c, w, h) => {
      const r = PV.rng(seed);
      const fac = { cafe: '#efe0c8', flower: '#f3eee2', bakery: '#f2d6b6', house: '#e2d3c0' }[kind];
      c.fillStyle = '#8c7d72'; c.fillRect(-4, 0, w + 8, 14);                                // roof edge
      c.fillStyle = fac; c.fillRect(0, 14, w, h - 14);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(0, 14, w * 0.07, h);
      c.fillStyle = 'rgba(90,70,60,0.16)'; c.fillRect(w * 0.86, 14, w * 0.14, h);
      for (let k = 0; k < 3; k++) { c.fillStyle = '#7d9cc0'; c.fillRect(46 + k * 180, 40, 120, 80); c.fillStyle = 'rgba(225,242,255,0.75)'; c.fillRect(46 + k * 180, 40, 120, 24); }
      if (kind === 'house') { c.fillStyle = '#b9ab9c'; c.fillRect(60, 200, 160, h - 200); c.fillStyle = '#7d9cc0'; c.fillRect(300, 200, 220, 120); return; }
      c.fillStyle = '#5b4a40'; c.fillRect(18, 220, w - 36, h - 220);
      const gi = c.createLinearGradient(0, 240, 0, h); gi.addColorStop(0, '#ffe6b8'); gi.addColorStop(1, '#f5b06e'); c.fillStyle = gi; c.fillRect(34, 238, w - 68, h - 238);
      c.fillStyle = 'rgba(255,255,255,0.45)'; for (let k = 0; k < 4; k++) c.fillRect(64 + k * 132, 252, 26, h - 270);
      const aw = { cafe: ['#2f7a5c', '#f6efe2'], flower: ['#f08aa6', '#ffffff'], bakery: ['#d9744a', '#fff3e0'] }[kind];
      const n = 9;
      for (let k = 0; k < n; k++) { c.fillStyle = aw[k % 2]; c.beginPath(); c.moveTo(k * w / n - 6, 150); c.lineTo((k + 1) * w / n - 6, 150); c.lineTo((k + 1) * w / n + 8, 218); c.lineTo(k * w / n + 8, 218); c.closePath(); c.fill(); }
      for (let k = 0; k < n; k++) { c.fillStyle = aw[k % 2]; c.beginPath(); c.arc((k + 0.5) * w / n + 8, 218, w / n / 2, 0, PI); c.fill(); }
      c.fillStyle = '#ffffff'; c.fillRect(w * 0.3, 128, w * 0.4, 22); c.fillStyle = aw[0]; c.fillRect(w * 0.33, 134, w * 0.34, 10);
      if (kind === 'flower') for (let k = 0; k < 24; k++) { c.fillStyle = ['#ff7f9a', '#ffd35a', '#ffffff', '#b98aff', '#ff6f5f', '#ffb0c8'][k % 6]; c.beginPath(); c.arc(30 + (k % 12) * 47 + 8 * r(), h - 70 + Math.floor(k / 12) * 40 - 14 * r(), 20 + 7 * r(), 0, TAU); c.fill(); }
      if (kind !== 'flower') for (let k = 0; k < 5; k++) { c.fillStyle = 'rgba(255,248,230,0.95)'; c.beginPath(); c.arc(80 + k * 110, 262, 12, 0, TAU); c.fill(); }
    });
  }
  // the street strip across the road (world x, scrolled by vMid)
  const C41_STRIP = (() => {
    const out = []; let x = -500;
    const seq = ['tree', 'house', 'pole', 'tree', 'cafe', 'tree', 'pole', 'house', 'flower', 'tree', 'pole', 'bakery', 'tree', 'house', 'pole', 'tree'];
    for (let i = 0; i < 48; i++) { const k = seq[i % seq.length]; const w = k === 'tree' ? 300 : k === 'pole' ? 60 : 600; out.push({ k, x, w, i }); x += w + (k === 'pole' ? 150 : k === 'tree' ? -30 : 40); }
    return out;
  })();
  // shift the strip so that the flower shop is centre-left of the frame at t = 2.25 (its music)
  (function () { const fl = C41_STRIP.find(b => b.k === 'flower'); C41.shift = (fl.x + fl.w / 2 - C41.vMid * 2.25) - 560; })();
  function c41Train(c, t) {
    const y = C41.deck - 132, car = 520, n = 5, head = 1900 + C41.trainV * (t - C41.trainT0);
    const vx = -((C41.vRail * t) % 640);
    c.fillStyle = '#c8cfd8'; c.fillRect(-100, C41.deck - 14, W + 200, 30); c.fillStyle = '#aeb7c3'; c.fillRect(-100, C41.deck + 16, W + 200, 14);
    for (let k = -1; k < 5; k++) { const px = vx + k * 640; c.fillStyle = '#b8c0cb'; c.fillRect(px, C41.deck + 28, 50, 300); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(px, C41.deck + 28, 10, 300); }
    for (let gk = 3; gk >= 0; gk--) {     // motion-smeared: ghost copies trailing behind
      c.globalAlpha = gk === 0 ? 1 : 0.22;
      for (let k = 0; k < n; k++) {
        const x0 = head + k * car + gk * 40; if (x0 > W + 60 || x0 + car < -60) continue;
        c.fillStyle = '#f3f5f7'; c.fillRect(x0, y, car - 10, 118);
        c.fillStyle = '#dde2e9'; c.fillRect(x0, y + 98, car - 10, 20);
        c.fillStyle = '#2f9a62'; c.fillRect(x0, y + 82, car - 10, 12);
        c.fillStyle = '#23365a'; for (let j = 0; j < 5; j++) c.fillRect(x0 + 30 + j * 96, y + 22, 66, 44);
        c.fillStyle = 'rgba(205,232,255,0.75)'; for (let j = 0; j < 5; j++) c.fillRect(x0 + 30 + j * 96, y + 22, 66, 13);
        if (k === 0) { c.fillStyle = '#f3f5f7'; c.beginPath(); c.moveTo(x0 + 2, y); c.lineTo(x0 - 26, y + 34); c.lineTo(x0 - 30, y + 118); c.lineTo(x0 + 2, y + 118); c.fill(); c.fillStyle = '#23365a'; c.beginPath(); c.moveTo(x0, y + 18); c.lineTo(x0 - 22, y + 40); c.lineTo(x0 - 22, y + 66); c.lineTo(x0, y + 66); c.fill(); }
      }
    }
    c.globalAlpha = 1;
    return { x0: head, x1: head + n * car, y: y + 60 };
  }
  // children on the far pavement (yellow caps, school bags, a red balloon)
  function c41Kids(c, t) {
    const out = [], by = C41.street - 4;
    for (let k = 0; k < 3; k++) {
      const x = 560 + k * 52 - C41.vKids * (t - 1.5) + 6 * Math.sin(t * 8 + k), hop = Math.abs(Math.sin(t * 8.5 + k * 1.3)) * 6, y = by - hop;
      c.fillStyle = ['#e65a5a', '#4a78d0', '#f0a030'][k]; c.fillRect(x - 12, y - 60, 24, 30);
      c.fillStyle = '#4e4440'; c.fillRect(x - 9, y - 30, 7, 30); c.fillRect(x + 2, y - 30, 7, 30);
      c.fillStyle = '#f2c9a8'; c.beginPath(); c.arc(x, y - 71, 11, 0, TAU); c.fill();
      c.fillStyle = '#ffd33a'; c.beginPath(); c.arc(x, y - 75, 12, PI, TAU); c.fill(); c.fillRect(x - 15, y - 76, 30, 4);
      out.push({ x, y: y - 50 });
    }
    const k2 = out[2], bx = k2.x + 34, byy = k2.y - 120 + 7 * Math.sin(t * 2.2);
    c.strokeStyle = 'rgba(90,90,90,0.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(k2.x + 8, k2.y - 4); c.lineTo(bx, byy + 28); c.stroke();
    c.fillStyle = '#ff5d70'; c.beginPath(); c.ellipse(bx, byy, 22, 27, 0.1, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.ellipse(bx - 8, byy - 9, 5, 8, 0.4, 0, TAU); c.fill();
    return out;
  }
  function c41Wires(c, poles) {
    c.strokeStyle = 'rgba(58,64,82,0.85)'; c.lineCap = 'round';
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i], b = poles[i + 1];
      for (let k = 0; k < 4; k++) { const ya = 120 + k * 22, sag = 66 + k * 10; c.lineWidth = k === 0 ? 4 : 3; c.beginPath(); c.moveTo(a, ya); c.quadraticCurveTo((a + b) / 2, ya + sag * 2, b, ya); c.stroke(); }
    }
  }
  // near leaves sweeping past the lens at the very start
  function c41Leaves(c, t, x0, y0) {
    c.strokeStyle = '#4a6436'; c.lineWidth = 22; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 900, y0 - 260); c.quadraticCurveTo(x0 - 300, y0 - 40, x0 + 260, y0 + 60); c.stroke();
    for (let j = 0; j < 22; j++) {
      const u = hash(j, 31), px = lerp(x0 - 820, x0 + 260, u) + 18 * Math.sin(t * 6 + j), py = lerp(y0 - 230, y0 + 60, u) + (hash(j, 32) - 0.5) * 260 + 12 * Math.cos(t * 5 + j);
      c.save(); c.translate(px, py); c.rotate(-0.4 + 1.6 * hash(j, 33) + 0.5 * Math.sin(t * 4 + j));
      c.fillStyle = j % 3 ? '#86cc5e' : '#d2f39a'; c.beginPath(); c.ellipse(0, 0, 90, 38, 0, 0, TAU); c.fill(); c.restore();
    }
  }

  // his right arm (sleeve): a tapered tube along a polyline axis, cel shaded.  Returns its edges + an outline path.
  // k = saturation (the colour comes back with the sound)
  function sleeveTube(ctx, axis, r0, r1, k) {
    const n = axis.length, lft = [], rgt = [];
    for (let i = 0; i < n; i++) {
      const a = axis[Math.max(0, i - 1)], b = axis[Math.min(n - 1, i + 1)];
      let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const u = i / (n - 1), r = lerp(r0, r1, u) * (1 + 0.035 * Math.sin(u * 9 + 1.3));
      lft.push({ x: axis[i].x + nx * r, y: axis[i].y + ny * r }); rgt.push({ x: axis[i].x - nx * r, y: axis[i].y - ny * r });
    }
    const path = (c) => {
      c.beginPath(); c.moveTo(lft[0].x, lft[0].y);
      for (let i = 1; i < n; i++) { const p = lft[i - 1], q = lft[i]; c.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2); }
      c.lineTo(lft[n - 1].x, lft[n - 1].y); c.lineTo(rgt[n - 1].x, rgt[n - 1].y);
      for (let i = n - 2; i >= 0; i--) { const p = rgt[i + 1], q = rgt[i]; c.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2); }
      c.lineTo(rgt[0].x, rgt[0].y); c.closePath();
    };
    const C = (hex) => dsat(hex, k);
    ctx.save(); ctx.lineJoin = 'round';
    ctx.strokeStyle = C('#1b2440'); ctx.lineWidth = 5; path(ctx); ctx.stroke();
    path(ctx); ctx.fillStyle = C('#3b5183'); ctx.fill();
    ctx.save(); path(ctx); ctx.clip();
    ctx.translate(-34, -10); path(ctx); ctx.fillStyle = C('#5672a8'); ctx.fill(); ctx.translate(34, 10);          // lit side (sun upper left)
    ctx.globalAlpha = 0.5; ctx.fillStyle = C('#9ab7e2');
    taper(ctx, lft.map((p, i) => ({ x: p.x + (rgt[i].x - p.x) * 0.12, y: p.y + (rgt[i].y - p.y) * 0.12 })), r0 * 0.2, r1 * 0.1);
    ctx.globalAlpha = 0.5; ctx.fillStyle = C('#25345c');
    taper(ctx, rgt.map((p, i) => ({ x: p.x + (lft[i].x - p.x) * 0.22, y: p.y + (lft[i].y - p.y) * 0.22 })), r0 * 0.34, r1 * 0.34);
    // the sleeve's seam, running along the far third
    ctx.globalAlpha = 0.35; ctx.fillStyle = C('#202c50');
    taper(ctx, rgt.map((p, i) => ({ x: p.x + (lft[i].x - p.x) * 0.38, y: p.y + (lft[i].y - p.y) * 0.38 })), 2.2, 2.2);
    ctx.globalAlpha = 1; ctx.restore(); ctx.restore();
    return { lft, rgt, path };
  }
  // the cloth pulled into her fist: soft tension folds fanning out from the grip along the sleeve (toward the shoulder
  // and toward the elbow) — a dark crease with a lit lip, strongest while she grips hardest.  Drawn inside the sleeve.
  const C41_FOLDS = [   // [side −1 above / +1 below the fist, spread at the far end (−1..1 across the sleeve), length, bow, strength]
    [-1, -0.78, 300, 0.22, 0.75], [-1, -0.35, 410, 0.12, 1], [-1, 0.12, 380, -0.06, 0.85], [-1, 0.55, 300, -0.18, 0.7], [-1, 0.86, 200, -0.25, 0.45],
    [1, -0.7, 250, -0.2, 0.6], [1, -0.2, 330, 0.08, 0.75], [1, 0.32, 300, 0.16, 0.65], [1, 0.75, 210, 0.24, 0.45]];
  function gripFolds(ctx, sl, top, bot, ax, R, k, sat) {
    const nx = -ax.y, ny = ax.x;                       // across the arm (toward its near / left edge = negative)
    ctx.save(); sl.path(ctx); ctx.clip(); ctx.lineCap = 'round';
    for (const [side, spread, len, bow, str] of C41_FOLDS) {
      const s = side < 0 ? top : bot, a = str * k; if (a < 0.03) continue;
      const p0 = { x: s.x + nx * spread * 26, y: s.y + ny * spread * 26 };
      const p2 = { x: s.x + ax.x * side * len + nx * spread * R * 0.95, y: s.y + ax.y * side * len + ny * spread * R * 0.95 };
      const mx = (p0.x + p2.x) / 2, my = (p0.y + p2.y) / 2, ex = p2.x - p0.x, ey = p2.y - p0.y;
      const p1 = { x: mx - ey * bow, y: my + ex * bow };
      const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push({ x: (1 - u) * (1 - u) * p0.x + 2 * u * (1 - u) * p1.x + u * u * p2.x, y: (1 - u) * (1 - u) * p0.y + 2 * u * (1 - u) * p1.y + u * u * p2.y }); }
      ctx.fillStyle = PV.rgba(dsatHex('#162040', sat), 0.16 * a); taper(ctx, pts, 30 * a + 6, 2);                      // the soft trough
      ctx.fillStyle = PV.rgba(dsatHex('#141c3a', sat), 0.42 * a); taper(ctx, pts, 7 * a + 2, 0.6);                    // the crease
      ctx.fillStyle = PV.rgba(dsatHex('#a9c3ee', sat), 0.38 * a); taper(ctx, pts.map(q => ({ x: q.x - 7, y: q.y - 6 })), 6 * a + 1.5, 0.5);   // lit lip
    }
    ctx.restore();
  }
  // her long black hair streaming in from the left edge on the spring breeze (she walks just off frame; it is
  // close to the lens, so it is soft).  Three locks, each a fan of strands sharing one travelling wave, a cool sheen
  // on the upper strands and a few flyaway wisps at the tips.
  const C41_LOCKS = [
    { y0: 612, len: 640, drop: 60, w: 96, ph: 0.0, amp: 30, n: 8, seed: 1 },
    { y0: 676, len: 790, drop: 120, w: 110, ph: 0.9, amp: 40, n: 9, seed: 2 },
    { y0: 748, len: 570, drop: 160, w: 84, ph: 1.8, amp: 28, n: 7, seed: 3 }];
  function c41Hair(c, tc, bob) {
    // the breeze drops for a moment as the flower shop's music comes in (2.25): the hair settles and uncovers it
    const gust = 0.93 + 0.07 * Math.sin(tc * 1.7) - 0.3 * gauss(tc, 2.35, 0.38);
    for (const L0 of C41_LOCKS) {
      const strands = [];
      for (let j = 0; j < L0.n; j++) {
        const s = j / (L0.n - 1) - 0.5, len = L0.len * gust * (0.78 + 0.3 * hash(j, 300 + L0.seed)), ph = tc * 3.1 + L0.ph + 0.5 * hash(j, 310 + L0.seed);
        const pts = [];
        for (let i = 0; i <= 20; i++) {
          const u = i / 20, spreadOut = 1 + 1.6 * u * u;
          pts.push({ x: -90 + u * len, y: L0.y0 + bob * 0.6 + s * L0.w * 0.5 * spreadOut + u * u * L0.drop + Math.sin(ph - u * 5.2) * L0.amp * Math.pow(u, 1.2) });
        }
        strands.push({ pts, s, w: (L0.w / L0.n) * 2.6 });
      }
      for (const st of strands) { c.fillStyle = '#15131c'; taper(c, st.pts, st.w, 1.2); }
      // sheen: a cool band of sky reflected on the upper strands, a third of the way out
      for (const st of strands) {
        if (st.s > 0.1) continue;
        c.fillStyle = 'rgba(132,140,178,0.55)'; taper(c, st.pts.slice(4, 10).map(q => ({ x: q.x, y: q.y - st.w * 0.18 })), st.w * 0.32, 0.6);
      }
      // flyaway wisps
      for (let j = 0; j < 3; j++) {
        const st = strands[Math.floor(hash(j, 330 + L0.seed) * strands.length)], ph = tc * 4.2 + j * 2.1;
        const tail = st.pts.slice(12).map((q, i) => ({ x: q.x + i * 9, y: q.y + Math.sin(ph + i * 0.9) * (4 + i * 2.5) - i * 2 }));
        c.fillStyle = '#1b1824'; taper(c, tail, 3, 0.6);
      }
    }
  }
  // greyed colour (the world comes back to colour): k = saturation 0..1
  function dsatHex(hex, k) { if (k >= 0.999) return hex; const [r, g, b] = PV.hex2rgb(hex), y = 0.299 * r + 0.587 * g + 0.114 * b; const m = (v) => Math.round(y + (v - y) * k); return '#' + [m(r), m(g), m(b)].map(v => v.toString(16).padStart(2, '0')).join(''); }
  const dsat = (hex, k) => dsatHex(hex, k);
  // low-res copies of the static background art: drawn 1:1 inside the quarter-res background layer (cheap)
  const QBG = 0.25;
  function lowArt(key, src) { return PV.cached('g11:q:' + key, Math.ceil(src.width * QBG), Math.ceil(src.height * QBG), (c, w, h) => { c.imageSmoothingQuality = 'high'; c.drawImage(src, 0, 0, w, h); }); }
  // the world's saturation mask (1/8 res): grey = desaturate, holes = colour already back
  function satMask(amount, holes) {
    const q = 0.125, w = W * q, h = H * q, M = PV.buffer('g11:desat', w, h), c = M.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    c.fillStyle = `rgba(128,128,128,${Math.min(1, amount).toFixed(3)})`; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-out'; c.setTransform(q, 0, 0, q, 0, 0); holes(c); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over';
    return M.canvas;
  }

  PV.shot('C41', { draw(ctx, t, d) {
    const tc = clamp(t, -0.3, d + 0.7);
    profCtx = ctx; prof('start');
    const walk = tc * 1.85 * TAU;                         // ~1.85 steps per second
    const bob = Math.sin(walk) * 8, bob2 = Math.sin(walk + 0.7) * 5;
    // flinches (leaves 0.1, train 0.75, kids 1.5) then she slowly lets the sound in
    const flinch = 0.55 * gauss(tc, 0.18, 0.08) + 1.0 * gauss(tc, 0.84, 0.1) + 0.3 * gauss(tc, 1.58, 0.1);
    const relax = sm(1.7, 3.1, tc);
    const satG = lerp(0.7, 1.0, sm(0.1, 2.4, tc));
    const stripX = (b) => b.x - C41.vMid * tc - C41.shift;
    const grip = { x: 1275, y: 560 + bob };

    // ---------------- background (soft, quarter res): sky, wires, viaduct + train, far town, shops, trees, kids,
    // sunlight — and the colour coming back into it from each sound
    let train = null, kids = [], sources = null;
    const poles = [];
    softLayer(ctx, 'c41bg', QBG, 1.4, (c) => {
      c.save(); c.translate(0, bob2 * 0.5);
      c.drawImage(lowArt('sky', c41Sky()), -150 - C41.vSky * tc, -40, 2300, 760);
      const far = lowArt('far', c41Far());
      c.drawImage(far, -250 - C41.vFar * tc, C41.deck - 270, 2500, 300);
      // under the viaduct: hazy far buildings down to the street (nothing may stay transparent)
      const ub = c.createLinearGradient(0, C41.deck, 0, C41.street); ub.addColorStop(0, '#9fb3c9'); ub.addColorStop(0.5, '#c2cfdc'); ub.addColorStop(1, '#d8d6cf');
      c.fillStyle = ub; c.fillRect(-60, C41.deck - 10, W + 120, C41.street - C41.deck + 20);
      c.drawImage(far, -900 - C41.vFar * 1.6 * tc, C41.street - 300, 2500, 300);
      train = c41Train(c, tc);
      const g = c.createLinearGradient(0, C41.street, 0, H); g.addColorStop(0, '#cdc4b8'); g.addColorStop(1, '#e2d9cc'); c.fillStyle = g; c.fillRect(-60, C41.street - 6, W + 120, H - C41.street + 60);
      // shops first, then the trees/poles standing on the far kerb in front of them
      for (const b of C41_STRIP) { if (b.k === 'tree' || b.k === 'pole') continue; const x = stripX(b); if (x > W + 80 || x + b.w < -80) continue; c.drawImage(lowArt('shop' + b.k + b.i, c41Shop(b.k, 4130 + b.i)), x, C41.street - 400, 600, 400); }
      kids = c41Kids(c, tc);
      for (const b of C41_STRIP) {
        const x = stripX(b);
        if (b.k === 'pole') { if (x < -900 || x > W + 900) continue; poles.push(x + 30); if (x > W + 80 || x < -80) continue; c.fillStyle = '#6a656c'; c.fillRect(x + 18, 80, 26, C41.street - 80); c.fillStyle = '#58545a'; c.fillRect(x - 40, 120, 142, 12); c.fillRect(x - 24, 166, 110, 10); continue; }
        if (b.k === 'tree') { if (x > W + 300 || x + b.w < -300) continue; c.drawImage(lowArt('tree' + (b.i % 3), c41Tree(4120 + (b.i % 3))), x - 210, C41.street - 1000, 720, 1000); }
      }
      c41Wires(c, poles);
      // kerb + sunlit road in front
      c.fillStyle = '#efe8dc'; c.fillRect(-60, C41.street - 2, W + 120, 10);
      // sunlight from the upper left (painted soft at low res)
      const sg = c.createRadialGradient(160, -80, 0, 160, -80, 1200); sg.addColorStop(0, 'rgba(255,248,226,0.85)'); sg.addColorStop(0.3, 'rgba(255,244,214,0.35)'); sg.addColorStop(1, 'rgba(255,244,214,0)');
      c.fillStyle = sg; c.fillRect(-60, -60, 1500, 1200);
      c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) {
        const a = 0.55 + 0.12 * k + 0.03 * Math.sin(tc * 0.7 + k), al = 0.06 + 0.04 * hash(k, 8);
        const rg = c.createLinearGradient(80, -140, 80 + Math.cos(a) * 1900, -140 + Math.sin(a) * 1900); rg.addColorStop(0, `rgba(255,246,220,${al})`); rg.addColorStop(1, 'rgba(255,246,220,0)');
        c.fillStyle = rg; c.beginPath(); c.moveTo(80, -140); c.lineTo(80 + Math.cos(a - 0.03) * 2000, -140 + Math.sin(a - 0.03) * 2000); c.lineTo(80 + Math.cos(a + 0.03) * 2000, -140 + Math.sin(a + 0.03) * 2000); c.closePath(); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      c.restore();
      // where the sounds come from (this frame)
      sources = [
        { t0: 0.1, x: 340, y: 110, cols: ['#d8f59a', '#a8e070', '#fff6dd'], n: 26 },
        { t0: 0.75, x: train ? clamp(train.x0 + 260, 120, 980) : 560, y: train ? train.y : C41.deck - 70, cols: ['#e8f2ff', '#a9d4ff', '#ffffff'], n: 30 },
        { t0: 1.5, x: kids.length ? kids[1].x : 640, y: kids.length ? kids[1].y : C41.street - 50, cols: ['#ffd35a', '#ff9fb2', '#ffffff'], n: 26 },
        { t0: 2.25, x: 560, y: C41.street - 150, cols: ['#ffcf8a', '#f7b6c8', '#fff3dc'], n: 30 },
      ];
      // colour returns: global ramp + local blooms where the sounds came from and around her hand
      if (1 - satG > 0.003) {
        const M = satMask(1 - satG, (m) => {
          for (const S of sources) { const k = sm(S.t0, S.t0 + 0.9, tc); if (k > 0) hole(m, S.x, S.y, 300 + 760 * k, 0.95 * k); }
          hole(m, grip.x, grip.y, 300 + 420 * sm(0, 2, tc), 0.6);
        });
        c.globalCompositeOperation = 'saturation'; c.drawImage(M, 0, 0, W, H); c.globalCompositeOperation = 'source-over';
      }
    });
    prof('bg');

    // ---------------- his side at the right edge (dark jacket; the monologue sits on it). The arm hangs along it.
    ctx.save(); ctx.translate(0, bob * 0.8);
    const edge = (c) => { c.moveTo(1540, -60); c.bezierCurveTo(1480, 300, 1470, 700, 1520, 1140); };
    const tg = ctx.createLinearGradient(1460, 0, W, 0); tg.addColorStop(0, dsat('#33466e', satG)); tg.addColorStop(0.22, dsat('#25355a', satG)); tg.addColorStop(1, dsat('#19223e', satG));
    ctx.fillStyle = tg; ctx.beginPath(); edge(ctx); ctx.lineTo(W + 60, 1140); ctx.lineTo(W + 60, -60); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.beginPath(); edge(ctx); ctx.lineTo(W + 60, 1140); ctx.lineTo(W + 60, -60); ctx.closePath(); ctx.clip();
    ctx.fillStyle = 'rgba(10,14,30,0.28)'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(1700 + k * 55, 260 + k * 190, 20, 280, 0.06, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(120,145,195,0.18)'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(1655 + k * 70, 420 + k * 160, 10, 240, 0.06, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.restore();
    prof('torso');

    // ---------------- his right arm (sharp) + her left hand clutching the sleeve
    const ay = bob;
    const axis = [{ x: 1430, y: -220 + ay }, { x: 1360, y: 150 + ay }, { x: 1290, y: 470 + ay }, { x: 1225, y: 770 + ay }, { x: 1160, y: 1200 + ay }];
    const ax = (() => { const dx = axis[3].x - axis[1].x, dy = axis[3].y - axis[1].y, l = Math.hypot(dx, dy); return { x: dx / l, y: dy / l }; })();
    const sl = sleeveTube(ctx, axis, 150, 134, satG);
    // her left hand laid across his forearm, long fingers clutching the cloth (tips wrap round the far edge)
    const tight = clamp(0.8 + 0.2 * flinch - 0.3 * relax, 0, 1);
    const curl = [0.22 + 0.1 * tight, 0.26 + 0.26 * tight, 0.3 + 0.28 * tight, 0.36 + 0.26 * tight, 0.44 + 0.24 * tight];
    const ho = { x: 1005, y: 800 + ay * 0.9 + 6 * flinch, scale: 2.45, side: 'L', kind: 'her', view: 'back', rot: 0.86, yaw: 0.25, pitch: 0.05,
      curl, spread: 0.13 - 0.04 * tight, t: tc, tremble: clamp(0.2 + 0.7 * flinch - 0.2 * relax, 0, 1), seed: 41, arm: 300, sleeve: '#f6c3cf', sleeveAt: 60,
      light: -2.35, keyColor: '#fff6dd', fillColor: '#d79aa6', tint: 0.45 };
    const rig = L.handRig(Object.assign({}, ho, { _m: ctx.getTransform() }));
    const pull = clamp(0.55 + 0.45 * tight, 0, 1);
    // (the fist's knuckle line runs from the little finger, up the arm, to the index finger and the thumb, down it)
    gripFolds(ctx, sl, rig.joints[4][0], rig.joints[0][2], ax, 140, pull, satG);
    // the fist pressed into the cloth: a soft contact shadow along the fingers (light from the upper left), inside the sleeve
    ctx.save(); sl.path(ctx); ctx.clip();
    for (let i = 0; i <= 4; i++) for (let j = 0; j < 3; j++) {
      const p = rig.joints[i][j], cx = p.x + 12, cy = p.y + 14, rr = 50;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, PV.rgba(dsatHex('#0e1430', satG), 0.18 + 0.12 * tight)); g.addColorStop(1, 'rgba(14,20,48,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    ctx.restore();

    // fingertips that pass the far edge of his arm are behind it: clip the hand to the near side of that edge
    ctx.save(); ctx.beginPath(); ctx.moveTo(-200, -200);
    for (const q of sl.rgt) ctx.lineTo(q.x - 6, q.y);
    ctx.lineTo(-200, H + 300); ctx.closePath(); ctx.clip();
    L.hand(ctx, ho);
    ctx.restore();
    prof('hands');

    // ---------------- sound: a ring + a stream of light motes from each source (their colour comes back with them)
    // (accumulated at half resolution, added once)
    const q = 0.5, PB = PV.buffer('g11:c41parts', W * q, H * q), pc = PB.ctx;
    pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, W * q, H * q); pc.setTransform(q, 0, 0, q, 0, 0); pc.globalCompositeOperation = 'lighter';
    let anyP = false;
    for (let si = 0; si < sources.length; si++) {
      const S = sources[si], ra = tc - S.t0;
      const flash = attack(tc, S.t0, 0.45);                       // the sound lights up where it comes from
      if (flash > 0.01) { spark(pc, S.x, S.y, 300, S.cols[0], 0.4 * flash); spark(pc, S.x, S.y, 90, '#ffffff', 0.35 * flash); anyP = true; }
      if (ra > 0 && ra < 1.3) {   // the sound itself: two soft rings opening out
        for (let k = 0; k < 2; k++) {
          const u = clamp((ra - k * 0.18) / 1.1, 0, 1); if (u <= 0) continue;
          const rr = 30 + 520 * PV.ease.outCubic(u);
          for (const [lw, aa] of [[22, 0.12], [7, 0.32], [2.5, 0.6]]) { pc.globalAlpha = aa * (1 - u) * (1 - u); pc.strokeStyle = S.cols[k]; pc.lineWidth = lw * (1.2 - 0.6 * u); pc.beginPath(); pc.ellipse(S.x, S.y, rr, rr * 0.7, 0, 0, TAU); pc.stroke(); anyP = true; }
        }
      }
      for (let i = 0; i < S.n; i++) {
        const age = tc - S.t0 - 0.16 * hash(i, si + 70); if (age < 0) continue;
        const life = 1.3 + 1.0 * hash(i, si + 71); if (age > life + 0.8) continue;
        const u = clamp(age / life, 0, 1), e = PV.ease.outCubic(u);
        const tx = grip.x - 380 + 560 * (hash(i, si + 72) - 0.5), ty = grip.y - 120 + 480 * (hash(i, si + 73) - 0.5);
        const sx0 = S.x + 140 * (hash(i, si + 74) - 0.5), sy0 = S.y + 140 * (hash(i, si + 75) - 0.5);
        const bend = 260 * (hash(i, si + 77) - 0.5);
        const x = lerp(sx0, tx, e) + Math.sin(e * PI) * bend + 26 * Math.sin(age * 2.6 + i), y = lerp(sy0, ty, e) - 180 * u * u - Math.sin(e * PI) * bend * 0.4;
        const a = sm(0, 0.12, age) * (1 - sm(life * 0.75, life + 0.8, age)) * (0.7 + 0.3 * Math.sin(age * 9 + i));
        const r = (7 + 12 * hash(i, si + 76)) * (1.3 - 0.45 * u);
        const col = S.cols[i % 3];
        spark(pc, x, y, r * 5.2, col, a * 0.7);
        spark(pc, x, y, r * 1.3, '#ffffff', a * 0.95);
        // every fifth mote passes close to the lens: a big soft disc of the same colour
        if (i % 5 === 0) { const nx = W / 2 + (x - W / 2) * 1.6, ny = H / 2 + (y - H / 2) * 1.6; spark(pc, nx, ny, r * 11, col, a * 0.22); }
        anyP = true;
      }
    }
    pc.globalAlpha = 1; pc.globalCompositeOperation = 'source-over'; pc.setTransform(1, 0, 0, 1, 0, 0);
    if (anyP) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.imageSmoothingEnabled = true; ctx.drawImage(PB.canvas, 0, 0, W * q, H * q, 0, 0, W, H); ctx.restore(); }
    L.dust(ctx, tc, { seed: 4111, count: 70, alpha: 0.28 + 0.4 * sm(0.5, 2.5, tc), color: '#fff3d0', size: 3.2, vx: 40, vy: -14 });
    prof('particles');

    // ---------------- her long black hair streaming into the frame from the left edge (soft: close to the lens)
    softLayer(ctx, 'c41hair', 0.5, 2.4, (c) => c41Hair(c, tc, bob), 1, [0, 440, 880, 640]);
    // spring petals on the breeze from behind them (to the right): crisp small ones + a few big soft ones near the lens
    L.petals(ctx, tc, { seed: 4141, count: 22, size: 11, fall: 70, wind: 210, color: '#ffd9e4', alpha: 0.85 });
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let k = 0; k < 5; k++) {
      const px = ((-300 + 520 * tc + k * 470) % 2300 + 2300) % 2300 - 200, py = 120 + 760 * hash(k, 61) + 60 * Math.sin(tc * 1.6 + k);
      ctx.save(); ctx.translate(px, py); ctx.rotate(k + tc * 1.2); ctx.scale(1, 0.55 + 0.35 * Math.sin(tc * 2 + k));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60); g.addColorStop(0, 'rgba(255,214,226,0.55)'); g.addColorStop(0.6, 'rgba(255,205,220,0.3)'); g.addColorStop(1, 'rgba(255,205,220,0)');
      ctx.fillStyle = g; ctx.fillRect(-60, -60, 120, 120); ctx.restore();
    }
    ctx.restore();
    // ---------------- near leaves (just in front of the lens) at the very start: 葉擦れ
    if (tc < 0.95) softLayer(ctx, 'c41near', 0.125, 0.9, (c) => c41Leaves(c, tc, 760 - C41.vNear * tc, 70), 0.97, [0, 0, 1600, 640]);
    prof('near');
    const wash = 0.45 * (1 - sm(0, 0.9, tc));
    if (wash > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = PV.rgba('#fff6dd', wash); ctx.fillRect(0, 0, W, H); ctx.restore(); }
    prof('end');
  } });

  /* ======================================================================= C42 */
  // 167.0–170.0 (t 0–3.0).  Golden backlight at the seaside park: the white bridge of C15 / C24 / C27 glowing gold,
  // the two sitting on the grass from behind — she is on his LEFT again (as on the promise night, C22).
  // M21: 167.6 (0.6) every instrument drops out for one breath → 167.75 (0.75) piano A4『ね』 (left, her side)
  // → 168.5 (1.5) F#5『え』, the second note stolen by the accident, finally sounds → 169.25 (2.25) the guitar answers
  // (right, his side,『何？』).  Visual: the light breathes with each note on its own side; she leans in a little.
  function c42Land(ctx, x0, x1, hz, h, col, seed) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, hz + 1);
    for (let x = x0; x <= x1; x += 6) { const u = (x - x0) / (x1 - x0), env = Math.pow(Math.sin(PI * Math.min(1, u * 1.15)), 0.6); ctx.lineTo(x, hz - h * env * (0.8 + 0.2 * PV.noise2(x * 0.02, seed)) - 2.5 * PV.noise2(x * 0.15, seed + 3) * env); }
    ctx.lineTo(x1, hz + 1); ctx.closePath(); ctx.fill();
  }
  // backlit lawn: dark blades with golden rims, painted once per seed/width, swayed by shifting two layers
  function c42Lawn(seed) {
    return PV.cached('g11:c42lawn3' + seed, 2200, 420, (c, w, h) => {
      const g = c.createLinearGradient(0, 40, 0, h); g.addColorStop(0, '#3a2a2e'); g.addColorStop(0.25, '#241a22'); g.addColorStop(1, '#140f16');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 10) c.lineTo(x, 46 + 10 * PV.noise2(x * 0.004, seed) + 4 * PV.noise2(x * 0.03, seed + 2)); c.lineTo(w, h); c.closePath(); c.fill();
      const r = PV.rng(seed);
      for (let i = 0; i < 2600; i++) {
        const x = r() * w, d = Math.pow(r(), 1.6), base = 50 + d * (h - 46);                 // more blades near the crest (far)
        const near = base / h, len = (8 + 40 * r()) * (0.35 + near), lean = (r() - 0.35) * 0.5, bw = 0.8 + 2.6 * near * r() + 0.6;
        const tx = x + lean * len, ty = base - len;
        c.fillStyle = PV.mix('#21171d', '#36262b', r()); c.beginPath(); c.moveTo(x - bw, base); c.quadraticCurveTo(x + lean * len * 0.3, base - len * 0.6, tx, ty); c.quadraticCurveTo(x + lean * len * 0.3 + bw * 0.4, base - len * 0.5, x + bw, base); c.closePath(); c.fill();
        if (r() < 0.6) { c.strokeStyle = PV.rgba(r() < 0.5 ? '#ffd394' : '#ffb470', (0.3 + 0.5 * r()) * (1.15 - near * 0.6)); c.lineWidth = 0.6 + near; c.beginPath(); c.moveTo(x + bw * 0.6, base - len * 0.25); c.quadraticCurveTo(x + lean * len * 0.3 + bw, base - len * 0.6, tx, ty); c.stroke(); }
      }
      // the rim of light along the lawn's crest (backlight through the blades)
      const cg = c.createLinearGradient(0, 30, 0, 110); cg.addColorStop(0, 'rgba(255,206,140,0)'); cg.addColorStop(0.45, 'rgba(255,206,140,0.35)'); cg.addColorStop(1, 'rgba(255,206,140,0)');
      c.globalCompositeOperation = 'source-atop'; c.fillStyle = cg; c.fillRect(0, 30, w, 80); c.globalCompositeOperation = 'source-over';
    });
  }
  // a star glint with a soft halo (sun sparkle on the water)
  function glint(ctx, x, y, s, a, col) {
    if (a <= 0.004) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(x, y);
    spark(ctx, 0, 0, 60 * s, col || '#ffd9a0', 0.55 * a);
    ctx.globalAlpha = Math.min(1, a);
    for (const [ang, len, wd] of [[0, 150, 3], [PI / 2, 70, 2.2], [PI / 4, 34, 1.4], [-PI / 4, 34, 1.4]]) {
      ctx.save(); ctx.rotate(ang); const g = ctx.createLinearGradient(-len * s, 0, len * s, 0);
      g.addColorStop(0, 'rgba(255,240,210,0)'); g.addColorStop(0.5, 'rgba(255,250,236,0.95)'); g.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = g; ctx.fillRect(-len * s, -wd * s / 2, len * s * 2, wd * s); ctx.restore();
    }
    spark(ctx, 0, 0, 9 * s, '#ffffff', a);
    ctx.restore();
  }
  // cached layers redrawn at 12 fps (2-koma): key -> buffer.  Drawn back every frame under the camera.
  const layerKeys = {};
  function layer12(name, key, paint) {
    const B = PV.buffer('g11:L12:' + name);
    if (layerKeys[name] !== key) { B.ctx.setTransform(1, 0, 0, 1, 0, 0); B.ctx.clearRect(0, 0, W, H); paint(B.ctx); B.ctx.setTransform(1, 0, 0, 1, 0, 0); layerKeys[name] = key; }
    return B.canvas;
  }
  const C42 = { hz: 606, sx: 1300, sy: 552 };
  function c42Plate(c, tq) {
    const { hz, sx, sy } = C42;
    L.sunset(c, tq, { horizon: hz, sunX: sx, sunY: sy, seed: 4201, rays: false });
    L.godRays(c, tq, { x: sx, y: sy, angle: -PI / 2, spread: 2.6, count: 10, length: 1500, width: 90, flare: 4, alpha: 0.06, color: '#ffd7a0', seed: 4204, jitter: 30 });
    L.sea(c, tq, { horizonY: hz, palette: 'sunset', sunX: sx, sunY: sy, road: 1.0, sparkles: 420,
      stops: [[0, '#ffe0a0'], [0.035, '#f4b588'], [0.2, '#a87a88'], [0.55, '#574878'], [1, '#2a284e']] });
    // golden air: warm the whole plate (the sunset presets lean violet) + haze around the sun
    c.save(); c.globalCompositeOperation = 'soft-light';
    const wg = c.createLinearGradient(0, 0, 0, H); wg.addColorStop(0, 'rgba(255,170,90,0.35)'); wg.addColorStop(0.5, 'rgba(255,190,110,0.85)'); wg.addColorStop(0.62, 'rgba(255,200,120,0.9)'); wg.addColorStop(1, 'rgba(255,160,90,0.6)');
    c.fillStyle = wg; c.fillRect(0, 0, W, H);
    // …and a second, stronger pass: gold, not violet (the zenith turns to dusky rose, the sea to peach-gold)
    const wg2 = c.createLinearGradient(0, 0, 0, H); wg2.addColorStop(0, 'rgba(255,150,60,0.75)'); wg2.addColorStop(0.55, 'rgba(255,180,90,0.6)'); wg2.addColorStop(1, 'rgba(255,150,80,0.4)');
    c.fillStyle = wg2; c.fillRect(0, 0, W, H); c.restore();
    // the same framing of the white bridge as C15's summer photo (towers x 110 / 520, deck end 820), now in gold
    c42Land(c, 700, 1080, hz, 26, '#9a6a72', 4201);
    L.bridge(c, { x0: -140, x1: 820, y: hz - 12, towerH: 196, lw: 4.0, cables: 11, color: '#fff0dc', shadow: '#c0939a', pierH: 14, span: 220, towers: [110, 520],
      light: 'right', rim: '#ffd59a', rimAmt: 0.9, haze: 0.2, hazeColor: '#ffcf9e' });
    L.glow(c, sx, sy + 10, 760, '#ffcf8a', 0.32);
  }
  PV.shot('C42', { draw(ctx, t, d) {
    const tc = clamp(t, -0.7, d + 0.3);
    profCtx = ctx; prof('start');
    const push = PV.ease.inOut(clamp((tc + 0.6) / (d + 0.6), 0, 1));
    const { hz, sx, sy } = C42;
    const n1 = attack(tc, 0.75, 0.35), n2 = attack(tc, 1.5, 0.6), n3 = attack(tc, 2.25, 0.45);   // ね / え / 何？
    const k2 = Math.floor(tc * 12 + 0.5 + 1e-6);   // staggered 12 fps ticks
    const plate = PV.cached('g11:c42plate3', W, H, (c) => c42Plate(c, 1.5));       // static painting (the water shimmer is added live)
    prof('plate');
    const fig = layer12('c42fig', k2, (c) => {
      const tq = k2 / 12, lean = 0.2 * PV.ease.inOut(clamp((tq - 1.5) / 0.85, 0, 1)), hz2 = gauss(tq, 0.62, 0.12), m2 = attack(tq, 1.5, 0.6);
      c.drawImage(c42Lawn(4202), -140 - 6 * Math.sin(tq * 0.9), 772);
      L.coupleSittingBack(c, tq, { x: 880, y: 1004, scale: 1.34, seat: 'grass', lean, girlOutfit: 'blouse', boyOutfit: 'shirt', fps: 0,
        wind: 0.42 - 0.25 * hz2, windDir: Math.PI - 0.15, light: -0.36, rimColor: '#ffc982', backlight: 0.3 + 0.1 * m2, glow: 0.9, rim: 1.15 });
    });
    prof('figs');
    ctx.save(); PV.camera(ctx, { zoom: 1.0 + 0.075 * push, cx: 880, cy: 640 });
    ctx.drawImage(plate, 0, 0);
    // live shimmer on the sun's road (the plate itself is still)
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 90; i++) {
      const y = hz + 4 + Math.pow(hash(i, 4231), 1.7) * 200, spread = 18 + (y - hz) * 1.6, x = sx + (hash(i, 4232) - 0.5) * 2 * spread;
      const tw = Math.max(0, Math.sin(tc * (4 + 5 * hash(i, 4233)) + i * 1.7)); if (tw < 0.05) continue;
      ctx.globalAlpha = tw * 0.7; ctx.drawImage(dot('#fff0c8'), x - 7 - (y - hz) * 0.05, y - 1.5, 14 + (y - hz) * 0.1, 3);
    }
    ctx.restore();
    // the notes on the water, each on its own side: ね (piano, left: her side), え, 何？ (guitar, right: his side)
    glint(ctx, 560, 700, 0.8 + 0.4 * n1, 0.2 + 0.9 * n1);
    glint(ctx, 470, 652, 1.15 + 0.5 * n2, 0.2 + 1.0 * n2);
    glint(ctx, 1330, 712, 0.9 + 0.4 * n3, 0.2 + 0.9 * n3, '#ffe6c0');
    ctx.drawImage(fig, 0, 380, W, H - 380, 0, 380, W, H - 380);      // (the figures and the lawn live below y 380)
    ctx.restore();
    prof('comp');
    // light in the air: dust + a few petals, slow; the light breathes with the notes on its own side
    L.dust(ctx, tc, { seed: 4211, count: 90, alpha: 0.55, color: '#ffe2b0', size: 3.4, vx: -8, vy: -10, drift: 40 });
    L.petals(ctx, tc, { seed: 4212, count: 9, size: 10, fall: 26, wind: -40, color: '#ffd8c0', alpha: 0.7 });
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    spark(ctx, 600, 560, 520, '#ffcf8a', 0.1 + 0.22 * n2 + 0.1 * n1);
    spark(ctx, 1200, 560, 460, '#ffe1b8', 0.12 * n3);
    // anamorphic streak through the sun
    const sg = ctx.createLinearGradient(sx - 1000, 0, sx + 1000, 0); sg.addColorStop(0, 'rgba(255,214,150,0)'); sg.addColorStop(0.5, `rgba(255,232,190,${0.32 + 0.1 * n2})`); sg.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx - 1000, sy - 3, 2000, 6);
    ctx.restore();
    prof('fx');
  } });

  /* ======================================================================= C43 */
  // 170.0–174.5 (t 0–4.5).  Extreme close-up, golden backlight, looking down at the grass between them.
  // 0.15『左手、見せて』: his left hand is offered palm up (string calluses, the healed scar at the thumb's root).
  // 0.6–2.1 her LEFT index finger traces the thumb scar, tenderly (out and back).  ~2.15 a breath of light, and
  // their hands are joined: his left + her right (faint suture scars on the back), fingers laced; from 3.4 his
  // thumb strokes her scar.  Her right fingers never move by themselves.  Copy (172.3–) sits in the top third.
  const HM = L._handMath;
  // surface point on a finger segment (same parametrisation as hands.js): s along (0..1), phi around (0 = dorsal)
  function segSurf(ch, j, s2, phi, rs) {
    const { add, mul, cross, norm } = HM;
    const a = ch.P[j], f = ch.F[j], d = ch.D[j], side = norm(cross(f, d));
    const r = lerp(ch.rad[j], ch.rad[j + 1], s2) * (rs || 1);
    const c = add(a, mul(f, s2 * ch.len[j]));
    const n = add(mul(d, Math.cos(phi)), mul(side, Math.sin(phi)));
    return add(c, mul(n, r));
  }
  // his thumb scar as screen points (u 0..1 along it)
  const thumbScarPt = (rig, u) => rig.P(segSurf(rig.chains[0], 1, 0.06 + 0.2 * u, Math.PI - 1.15 + 2.6 * u, 1.03));
  function thumbScarPts(rig) { const out = []; for (let i = 0; i <= 12; i++) out.push(thumbScarPt(rig, i / 12)); return out; }
  // her dorsal suture scars (right hand, back): the same lines as hands.js scarsPalm (dorsal set) + the two fingers
  function herScarPolys(rig) {
    const { V } = HM, polys = [];
    const line = (a, b, z, bow, steps) => { const pts = []; for (let i = 0; i <= steps; i++) { const u = i / steps; pts.push(rig.P(V(a[0] + (b[0] - a[0]) * u + Math.sin(u * PI) * bow, a[1] + (b[1] - a[1]) * u, z))); } return pts; };
    polys.push(line([-2, -6], [-19, -80], 12.5, 4, 10));
    polys.push(line([-19, 8], [18, 6], 13.5, -3, 8));
    const armLen = rig.o.arm == null ? 320 : rig.o.arm;
    if (armLen > 60) polys.push(line([-5, 24], [3, Math.min(armLen, 300)], 18, 6, 16));
    for (const i of [1, 2]) { const ch = rig.chains[i], pts = []; for (let k = 0; k <= 6; k++) { const u = 0.08 + 0.8 * k / 6; pts.push(rig.P(segSurf(ch, 0, u, 0.25 * Math.sin(u * 3), 1.02))); } polys.push(pts); }
    return polys;
  }
  // place a rig so that point fn(rig) lands on (tx, ty)
  function rigAtPoint(o, m, tx, ty, fn) {
    const probe = L.handRig(Object.assign({}, o, { x: 0, y: 0, _m: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }));
    const q = fn(probe);
    return L.handRig(Object.assign({}, o, { x: tx - q.x, y: ty - q.y, _m: m }));
  }
  const padPt = (rig, i) => L._handPadPoint(rig, i, 1.2);
  // rim light from the subject's own alpha, toward the light (screen angle), plus a soft glow; limited to box
  // rim light from the subject's own alpha (toward the light) + a soft glow, ADDED INTO the subject's own buffer
  // (one composite later).  Computed at half / quarter resolution; fade = [y0, y1, min]: vertical falloff
  function rimLight(ctx, src, box, ang, width, col, alpha, glowA, fade) {
    const q = 0.5, x0 = Math.max(0, Math.floor(box[0])), y0 = Math.max(0, Math.floor(box[1])), x1 = Math.min(W, Math.ceil(box[2])), y1 = Math.min(H, Math.ceil(box[3]));
    const w = x1 - x0, h = y1 - y0; if (w < 4 || h < 4) return;
    const bw = Math.ceil(w * q), bh = Math.ceil(h * q);
    const B = PV.buffer('g11:rimB', W * q, H * q), c = B.ctx;
    c.clearRect(0, 0, W * q, H * q);            // whole buffer: edge sampling must never see an older, larger box
    c.drawImage(src, x0, y0, w, h, 0, 0, w * q, h * q);
    c.globalCompositeOperation = 'destination-out';
    c.drawImage(src, x0, y0, w, h, -Math.cos(ang) * width * q, -Math.sin(ang) * width * q, w * q, h * q);
    c.globalCompositeOperation = 'source-in'; c.fillStyle = col; c.fillRect(0, 0, bw + 2, bh + 2);
    if (fade) {
      c.globalCompositeOperation = 'destination-in';
      const fg = c.createLinearGradient(0, (fade[0] - y0) * q, 0, (fade[1] - y0) * q); fg.addColorStop(0, '#000'); fg.addColorStop(1, `rgba(0,0,0,${fade[2]})`);
      c.fillStyle = fg; c.fillRect(0, 0, bw + 2, bh + 2);
    }
    c.globalCompositeOperation = 'source-over';
    let G = null; const g = 0.25;
    if (glowA > 0) { G = PV.buffer('g11:rimG', W * g + 16, H * g + 16); G.ctx.clearRect(0, 0, W * g + 16, H * g + 16); G.ctx.filter = 'blur(3px)'; G.ctx.drawImage(B.canvas, 0, 0, w * q, h * q, 4, 4, w * g, h * g); G.ctx.filter = 'none'; }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(B.canvas, 0, 0, w * q, h * q, x0, y0, w, h);
    if (G) { ctx.globalAlpha = glowA; ctx.drawImage(G.canvas, 0, 0, w * g + 8, h * g + 8, x0 - 4 / g, y0 - 4 / g, w + 8 / g, h + 8 / g); }
    ctx.restore();
  }
  function rigsBox(rigs, pad) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const add = (p) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); };
    for (const r of rigs) {
      for (const ch of r.joints) for (const p of ch) add(p); for (const p of (r.tips || [])) if (p) add(p); add(r.wrist);
      const arm = r.o.arm == null ? 320 : r.o.arm; for (const ax of [-40, 40]) add(r.P(HM.V(ax, arm, 0)));    // the forearm (+ its width)
    }
    return [x0 - pad, y0 - pad, x1 + pad, H + 20];
  }
  // the grass between them, far out of focus (painted once): dark warm ground, gold glints toward the sun
  function c43Ground() {
    return PV.cached('g11:c43ground3', W + 120, H + 120, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a201b'); g.addColorStop(0.3, '#3d2f25'); g.addColorStop(0.62, '#5b4330'); g.addColorStop(1, '#3a2a22');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      // warm light scattering around where the hands rest
      const hg = c.createRadialGradient(w * 0.52, h * 0.66, 40, w * 0.52, h * 0.66, 820); hg.addColorStop(0, 'rgba(214,150,84,0.75)'); hg.addColorStop(0.45, 'rgba(170,112,64,0.35)'); hg.addColorStop(1, 'rgba(120,80,50,0)');
      c.fillStyle = hg; c.fillRect(0, 0, w, h);
      const r = PV.rng(4301);
      c.filter = 'blur(16px)';
      for (let i = 0; i < 90; i++) { const x = r() * w, y = 160 + r() * (h - 160); c.fillStyle = PV.mix('#6a5232', '#241a14', r(), 0.55); c.beginPath(); c.ellipse(x, y, 50 + 120 * r(), 10 + 26 * r(), -0.5 + 0.5 * r(), 0, TAU); c.fill(); }
      for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h * 0.5; c.strokeStyle = PV.rgba('#e8b070', 0.25 + 0.3 * r()); c.lineWidth = 6 + 8 * r(); c.beginPath(); c.moveTo(x, y + 60); c.quadraticCurveTo(x + 20, y + 20, x + 30 * (r() - 0.3), y - 40); c.stroke(); }
      // her skirt (left) and his trousers (right) at the bottom corners
      c.fillStyle = '#1b2030'; c.beginPath(); c.ellipse(-80, h + 60, 520, 330, 0.2, 0, TAU); c.fill();
      c.fillStyle = '#262529'; c.beginPath(); c.ellipse(w + 100, h + 80, 560, 360, -0.25, 0, TAU); c.fill();
      c.filter = 'none';
      // keep the copy's band calm and dark
      const cb = c.createLinearGradient(0, 120, 0, 460); cb.addColorStop(0, 'rgba(26,20,17,0)'); cb.addColorStop(0.45, 'rgba(26,20,17,0.42)'); cb.addColorStop(1, 'rgba(26,20,17,0)');
      c.fillStyle = cb; c.fillRect(0, 120, w, 340);
      c.save(); c.translate(60, 60); L.bokeh(c, 0, { seed: 4302, count: 26, rmin: 30, rmax: 90, x0: -50, x1: W + 50, y0: -40, y1: 420, alpha: 0.24, colors: ['#ffcf8a', '#ffe2b0', '#e8a86a'] }); c.restore();
    });
  }
  // two-phase hand rigs at time tc (scene coordinates; m = ctx transform)
  function c43Touch(tc, m) {
    const offer = sm(0.0, 0.7, tc), twitch = gauss(tc, 1.25, 0.12);
    const hisO = { side: 'L', kind: 'him', view: 'palm', pitch: -0.18, yaw: 0.06, scale: 3.05, rot: -0.3, t: tc, tremble: 0.05, seed: 2,
      curl: [0.16 + 0.1 * (1 - offer), 0.1 + 0.25 * (1 - offer) + 0.06 * twitch, 0.1 + 0.25 * (1 - offer) + 0.08 * twitch, 0.14 + 0.25 * (1 - offer) + 0.05 * twitch, 0.2 + 0.2 * (1 - offer)],
      spread: 0.32, calluses: true, thumbScar: true, arm: 340, x: 1150, y: 940 + 40 * (1 - offer), sleeve: '#2c2c32', sleeveAt: 250,
      light: -1.35, keyColor: '#ffd8a0', fillColor: '#7a4a64', tint: 0.55 };
    const his = L.handRig(Object.assign({}, hisO, { _m: m }));
    // her fingertip: approaches 0.2–0.6, traces the scar 0.6–2.1 (out and back), lifts a little after
    const u = 0.5 - 0.5 * Math.cos(TAU * clamp((tc - 0.6) / 1.5, 0, 1));
    const lift = 1 - sm(0.2, 0.62, tc) + 0.6 * sm(2.05, 2.4, tc);
    const tgt = thumbScarPt(his, 0.08 + 0.84 * u);
    const herO = { side: 'L', kind: 'her', view: 'back', pitch: 0.28, yaw: -0.12, scale: 2.95, rot: 1.1 + 0.05 * Math.sin(tc * 1.3), t: tc, tremble: 0.15, seed: 5,
      curl: [0.3, 0.1 + 0.05 * Math.sin(tc * 3), 0.34, 0.44, 0.54], spread: 0.08, arm: 360, sleeve: '#f1dfc8', sleeveAt: 90,
      light: -1.35, keyColor: '#ffd8a0', fillColor: '#7a4a64', tint: 0.55 };
    const her = rigAtPoint(herO, m, tgt.x - 60 * lift, tgt.y + 40 * lift, (r) => padPt(r, 1));
    const h = 8 + 50 * lift;
    her.o.dropShadow = { dx: -Math.cos(-1.35) * h * her.unit, dy: -Math.sin(-1.35) * h * her.unit, blur: (2 + 6 * lift) * her.unit, alpha: 0.32 - 0.1 * lift, color: '#4a2a26' };
    her.o.depthFn = it => it.depth + 1000;
    return { his, her, tgt, u };
  }

  // hands + their rim light, in scene space, re-posed at 12 fps (2-koma); the camera moves them every frame.
  // tq = C43-local time (C44 continues with 4.5 + t).  Returns the buffers, their bounding box + the scar geometry.
  const handLayer = { key: null, data: null, box: null };
  function c43HandLayers(tq) {
    const key = Math.round(tq * 12);
    if (handLayer.key === key) return handLayer.data;
    const tk = key / 12, ident = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const HB = PV.buffer('g11:c43hands'), hc = HB.ctx;
    hc.clearRect(0, 0, W, H);            // (whole canvas: the result must not depend on which pose was cached before)
    const swap = sm(1.92, 2.38, tk);
    let rigsA = null, lock = null;
    if (swap < 1) { rigsA = c43Touch(tk, ident); hc.globalAlpha = 1 - swap; L.handRender(hc, [rigsA.his, rigsA.her], { pad: 40 }); hc.globalAlpha = 1; }
    if (swap > 0) {
      const tr = 0.5 * clamp((tk - 3.4) / 1.1, 0, 1.4);
      hc.globalAlpha = swap;
      // vee 0.2: his thumb comes over the radial edge of her hand from his own hand (reads as one hand, not a stray thumb)
      lock = L.handsInterlock(hc, { x: 960, y: 610, scale: 3.5, t: tk, rot: PI - 0.25, az: -0.3, el: -0.1, vee: 0.2, arm: 360, squeeze: 0.5 + 0.08 * Math.sin(tk * 1.1),
        trace: tr, light: -1.35, keyColor: '#ffd8a0', fillColor: '#7a4a64', tint: 0.55, herSleeve: '#f1dfc8', hisSleeve: '#2c2c32' });
      hc.globalAlpha = 1;
    }
    const bx = rigsBox((rigsA ? [rigsA.his, rigsA.her] : []).concat(lock ? [lock.her, lock.him] : []), 70);
    const box = [Math.max(0, Math.floor(bx[0])), Math.max(0, Math.floor(bx[1])), Math.min(W, Math.ceil(bx[2])), H];
    // toward the camera the forearms leave the warm light (and the subtitle line stays legible)
    hc.save(); hc.globalCompositeOperation = 'source-atop';
    const sg = hc.createLinearGradient(0, 700, 0, H); sg.addColorStop(0, 'rgba(46,24,30,0)'); sg.addColorStop(0.55, 'rgba(46,24,30,0.32)'); sg.addColorStop(1, 'rgba(46,24,30,0.6)');
    hc.fillStyle = sg; hc.fillRect(box[0], 700, box[2] - box[0], H - 700); hc.restore();
    // the rim fades out down the forearms (no long laser-straight edge lines)
    rimLight(hc, HB.canvas, box, -1.35, 6, '#ffe2a8', 0.7, 0.8, [560, 980, 0.1]);
    handLayer.key = key; handLayer.box = box;
    // glowing scars (C44's threads come loose from them): her dorsal scar, wrist, forearm (the finger scars sit
    // under his fingers) and his thumb scar
    handLayer.data = { hands: HB.canvas, swap, box, tgt: rigsA ? rigsA.tgt : null,
      scars: lock ? herScarPolys(lock.her).slice(0, 3).concat([thumbScarPts(lock.him)]) : null };
    return handLayer.data;
  }
  // draw the cached hand layer (hands + their light) under a camera, only its box (+ the glow margin)
  function drawHandLayers(ctx, HL, cam) {
    const b = HL.box, x0 = Math.max(0, b[0] - 20), y0 = Math.max(0, b[1] - 20), w = Math.min(W, b[2] + 20) - x0, h = H - y0;
    ctx.save(); PV.camera(ctx, cam); ctx.drawImage(HL.hands, x0, y0, w, h, x0, y0, w, h); ctx.restore();
  }
  // C43's last pose (key 54 = C43's last frame), kept in its own canvas for C44's crane
  let c44HandsData = null;
  function c44Hands() {
    if (c44HandsData) return c44HandsData;
    const HL = c43HandLayers(4.5), C = PV.makeCanvas(W, H); C.ctx.drawImage(HL.hands, 0, 0);
    return (c44HandsData = { hands: C.canvas, box: HL.box.slice(), scars: HL.scars });
  }
  // PV.camera as a point transform
  const camPt = (p, o) => ({ x: (p.x - o.cx) * o.zoom + o.cx + o.x, y: (p.y - o.cy) * o.zoom + o.cy + o.y });
  // the scars waking up as soft gold lines (no white core: they must read as light in the skin, not scratches);
  // a bead of light runs along each one
  function drawScarGlow(ctx, polys, cam, k, t) {
    if (!polys || k <= 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    polys.forEach((pts0, pi) => {
      const pts = pts0.map(p => camPt(p, cam));
      const path = () => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const q of pts) ctx.lineTo(q.x, q.y); };
      const br = 0.85 + 0.15 * Math.sin(t * 3.1 + pi * 1.7);
      for (const [lw, a, col] of [[18, 0.06, '#ff9a48'], [8, 0.12, '#ffb866'], [3.2, 0.24, '#ffd59a'], [1.3, 0.3, '#fff0d2']]) {
        ctx.globalAlpha = a * k * br; ctx.strokeStyle = col; ctx.lineWidth = lw; path(); ctx.stroke();
      }
      const u = ((t * 0.5 + pi * 0.31) % 1), f = u * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), e = f - i;
      const q = { x: lerp(pts[i].x, pts[i + 1].x, e), y: lerp(pts[i].y, pts[i + 1].y, e) }, fade = Math.sin(u * PI);
      spark(ctx, q.x, q.y, 24, '#ffcf8a', 0.45 * k * fade); spark(ctx, q.x, q.y, 5, '#fff6e6', 0.6 * k * fade);
    });
    ctx.restore();
  }
  // the ground's slow drift, whole pixels (a plain blit; the plate is out of focus).  Shared with C44's world.
  const c43GroundOff = (drift) => ({ x: Math.round(-60 - 12 * drift), y: Math.round(-60 - 6 * drift) });
  const c43Sun = (ctx, a) => {   // sunlight spilling in from the far side (top right), kept off the copy's line
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = a;
    const lg = ctx.createRadialGradient(W + 40, -60, 0, W + 40, -60, 1000); lg.addColorStop(0, 'rgba(255,205,135,0.62)'); lg.addColorStop(0.5, 'rgba(255,200,130,0.18)'); lg.addColorStop(1, 'rgba(255,200,130,0)'); ctx.fillStyle = lg; ctx.fillRect(W - 1000, 0, 1000, 1000);
    ctx.restore();
  };

  PV.shot('C43', { draw(ctx, t, d) {
    const tc = clamp(t, -0.3, d + 0.3);
    profCtx = ctx; prof('start');
    const drift = PV.ease.inOut(clamp(tc / d, 0, 1));
    const cam = { zoom: 1.0 + 0.02 * drift, x: -12 * drift, y: -6 * drift, cx: 960, cy: 700 };
    const bloom = gauss(tc, 2.15, 0.16);
    // ---- ground (static plate; the camera drifts) + the sun from the far side
    const go = c43GroundOff(drift); ctx.drawImage(c43Ground(), go.x, go.y);
    c43Sun(ctx, 1);
    prof('ground');
    // ---- hands (12 fps pose) + rim light
    const HL = c43HandLayers(tc);
    drawHandLayers(ctx, HL, cam);
    prof('hands');
    // ---- the touch point glows softly while she traces; later the scars start to glow (→ C44's threads)
    if (HL.tgt && HL.swap < 1) {
      const k = sm(0.55, 0.75, tc) * (1 - sm(2.0, 2.3, tc)) * (1 - HL.swap), q = camPt(HL.tgt, cam);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; spark(ctx, q.x, q.y, 70, '#ffd9a0', 0.45 * k); spark(ctx, q.x, q.y, 14, '#fff6e6', 0.8 * k); ctx.restore();
    }
    drawScarGlow(ctx, HL.scars, cam, sm(3.7, 4.5, tc) * HL.swap, tc);
    // ---- the breath of light between the two moments
    if (bloom > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = PV.rgba('#ffe6b8', 0.26 * bloom); ctx.fillRect(0, 0, W, H); ctx.restore(); L.glow(ctx, 960, 640, 900, '#fff0d0', 0.42 * bloom); }
    L.dust(ctx, tc, { seed: 4311, count: 60, alpha: 0.5, color: '#ffe2b0', size: 3, vx: -6, vy: -8, drift: 30 });
    prof('fx');
  } });

  /* ======================================================================= C44 */
  // 174.5–180.0 (t 0–5.5).  From the laced hands, crane up over the backlit lawn and the sea into the evening sky.
  // The golden lines along the two scars come loose and rise as threads of light; 174.75–177.0 (t 0.25–2.5) they
  // write 右手 one stroke at a time (右 5 + 手 4 = 9 strokes × 0.25 s), her thread (piano) and his (guitar) taking
  // turns — the stroke order is the session.  177.0 (t 2.5) the DOM title lands exactly on the written 右手
  // (titles.js .migite: ZenOld 900 188px, measured box x 509.8 y 391.5, baseline +176) and the light hands over to
  // it; 177.35 the guitar's アイロニー.  Then the sky stays, one painting, until the silence (179.6).
  // The crane is one tall painting (sky → sea → C42's backlit lawn → C43's grass) scrolled with a smootherstep;
  // motion blur = pre-blurred (vertical box) half-res copies of that painting, mixed by the camera speed.
  const C44 = { hz: 930, sunX: 1300, base: 391.5 + 176, x0: 509.8, x1: 509.8 + 188 + 3.76, font: '900 188px ZenOld', DIST: 1600, CR: 2.2, Y0: 700 };
  const craneAt = (t) => { const u = clamp(t / C44.CR, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
  // stroke centre lines, glyph units (0..188, origin = top-left of the glyph's 188px cell), width = brush (units)
  const STROKES = [
    { g: 0, w: 30, who: 0, pts: [[92, 22], [86, 42], [81, 60], [76, 74], [68, 88], [58, 104], [44, 120], [28, 135], [8, 150]] },     // 右 ノ
    { g: 0, w: 17, who: 1, pts: [[9, 63], [60, 63], [120, 63], [160, 62], [168, 57], [171, 52]] },                                  // 右 一
    { g: 0, w: 30, who: 0, pts: [[62, 104], [62, 140], [62, 187]] },                                                                // 口 丨
    { g: 0, w: 30, who: 1, pts: [[66, 110], [110, 110], [146, 109], [150, 105], [149, 118], [148, 150], [148, 186]] },               // 口 𠃍
    { g: 0, w: 17, who: 0, pts: [[70, 171], [105, 171], [140, 171]] },                                                              // 口 一
    { g: 1, w: 26, who: 1, pts: [[150, 28], [130, 31], [104, 37], [80, 43], [54, 46], [22, 48]] },                                  // 手 ノ
    { g: 1, w: 17, who: 0, pts: [[19, 77], [90, 77], [150, 77], [160, 70], [157, 63]] },                                            // 手 一
    { g: 1, w: 17, who: 1, pts: [[10, 118], [90, 118], [165, 118], [172, 110], [169, 104]] },                                       // 手 一
    { g: 1, w: 30, who: 0, pts: [[92, 46], [92, 100], [92, 152], [89, 168], [80, 178], [66, 173], [52, 163]] },                     // 手 亅
  ];
  const strokeT0 = (k) => 0.25 + 0.25 * k;
  // resample strokes in screen space (cumulative length for partial drawing)
  const STROKE_S = STROKES.map((st) => {
    const gx = st.g === 0 ? C44.x0 : C44.x1, gy = 391.5;
    const raw = st.pts.map(([x, y]) => ({ x: gx + x, y: gy + y }));
    // Catmull-Rom → dense polyline
    const pts = [];
    for (let i = 0; i < raw.length - 1; i++) {
      const p0 = raw[Math.max(0, i - 1)], p1 = raw[i], p2 = raw[i + 1], p3 = raw[Math.min(raw.length - 1, i + 2)];
      for (let k = 0; k < 8; k++) { const u = k / 8, u2 = u * u, u3 = u2 * u;
        pts.push({ x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
                   y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3) }); }
    }
    pts.push(raw[raw.length - 1]);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, cum, len: cum[cum.length - 1], w: st.w, who: st.who };
  });
  function strokeAt(S, f) {          // point at fraction f of the stroke
    const L0 = clamp(f, 0, 1) * S.len; let i = 1; while (i < S.cum.length - 1 && S.cum[i] < L0) i++;
    const a = S.pts[i - 1], b = S.pts[i], seg = (S.cum[i] - S.cum[i - 1]) || 1, u = clamp((L0 - S.cum[i - 1]) / seg, 0, 1);
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
  }
  function strokePath(c, S, f) {
    const L0 = clamp(f, 0, 1) * S.len; if (L0 <= 0.5) return false;
    c.beginPath(); c.moveTo(S.pts[0].x, S.pts[0].y);
    for (let i = 1; i < S.pts.length; i++) { if (S.cum[i] >= L0) { const e = strokeAt(S, f); c.lineTo(e.x, e.y); break; } c.lineTo(S.pts[i].x, S.pts[i].y); }
    return true;
  }
  // stroke progress: brush accelerates in and lifts off (each 0.25 s, the last 0.03 s holds)
  const strokeF = (k, t) => PV.ease.inOutCubic(clamp((t - strokeT0(k)) / 0.22, 0, 1));
  // the glyph pair as white pixels, in a crop box (screen coords)
  const GB = { x: 490, y: 372, w: 420, h: 240 };
  function glyphMask() {
    return PV.cached('g11:c44glyph', GB.w, GB.h, (c) => {
      c.font = C44.font; c.textBaseline = 'alphabetic'; c.fillStyle = '#fff';
      c.fillText('右', C44.x0 - GB.x, C44.base - GB.y); c.fillText('手', C44.x1 - GB.x, C44.base - GB.y);
    });
  }
  // the written part of 右手 (gold), with an optional overall brightness k
  function writtenGlyph(ctx, t, alpha, flash) {
    if (alpha <= 0.003) return;
    const M = PV.buffer('g11:c44mask', GB.w, GB.h), c = M.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, GB.w, GB.h); c.translate(-GB.x, -GB.y);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#fff';
    let any = false;
    STROKE_S.forEach((S, k) => { const f = strokeF(k, t); if (f > 0 && strokePath(c, S, f)) { c.lineWidth = S.w; c.stroke(); any = true; } });
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (!any) return;
    c.globalCompositeOperation = 'destination-in'; c.drawImage(glyphMask(), 0, 0);
    c.globalCompositeOperation = 'source-in';
    const g = c.createLinearGradient(0, 0, 0, GB.h); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.45, PV.mix('#ffe2a8', '#ffffff', flash)); g.addColorStop(1, PV.mix('#ffc878', '#fff4dc', flash));
    c.fillStyle = g; c.fillRect(0, 0, GB.w, GB.h); c.globalCompositeOperation = 'source-over';
    // glow (quarter res) + the sharp light
    const q = 0.25, G = PV.buffer('g11:c44glow', Math.ceil(GB.w * q) + 8, Math.ceil(GB.h * q) + 8);
    G.ctx.clearRect(0, 0, G.canvas.width, G.canvas.height); G.ctx.filter = 'blur(2.5px)'; G.ctx.drawImage(M.canvas, 4, 4, GB.w * q, GB.h * q); G.ctx.filter = 'none';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, alpha * (0.85 + 0.6 * flash)); ctx.drawImage(G.canvas, 0, 0, G.canvas.width, G.canvas.height, GB.x - 4 / q, GB.y - 4 / q, G.canvas.width / q, G.canvas.height / q);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha; ctx.drawImage(M.canvas, GB.x, GB.y);
    ctx.restore();
  }
  // the evening sky after the crane (static painting, cached): world y −700 … 1340, horizon at y = hz.
  // The final framing (world 0 … 1080) is the title card; the sea continues below it for the crane.
  function c44Sky() {
    return PV.cached('g11:c44sky4', W, H + 700 + 260, (c, w, h) => {
      const off = 700;     // the painting extends 700 px above the final frame (seen during the crane)
      const hz = C44.hz + off;
      const g = c.createLinearGradient(0, 0, 0, hz);
      g.addColorStop(0, '#15152a'); g.addColorStop(0.32, '#1f1e36'); g.addColorStop(0.55, '#2d2847'); g.addColorStop(0.7, '#4a3858'); g.addColorStop(0.8, '#7a5068');
      g.addColorStop(0.88, '#c07862'); g.addColorStop(0.95, '#f2b277'); g.addColorStop(1, '#ffe2a8');
      c.fillStyle = g; c.fillRect(0, 0, w, hz + 2);
      // high cirrus catching the last pink light, low streaks lit from below
      L.cloudBand(c, 0, { kind: 'streak', palette: 'sunsetHigh', light: Math.PI / 2 + 0.2, x: 0, y: off + 380, w, h: 300, coverage: 0.36, scaleX: 760, scaleY: 50, seed: 4401, speed: 0, alpha: 0.55, gain: 1.6, base: 0.45, thick: 0.25 });
      L.cloudBand(c, 0, { kind: 'streak', palette: 'dusk', light: Math.PI / 2, x: 0, y: off + 700, w, h: 200, coverage: 0.4, scaleX: 900, scaleY: 30, seed: 4402, speed: 0, alpha: 0.75, gain: 2, base: 0.45 });
      // stars in the deep part (and the first star)
      const r = PV.rng(4403);
      for (let i = 0; i < 90; i++) { const x = r() * w, y = r() * (off + 420), a = 0.15 + 0.5 * r() * (1 - y / (off + 420)); c.fillStyle = `rgba(255,248,235,${a.toFixed(3)})`; c.beginPath(); c.arc(x, y, 0.6 + 1.1 * r(), 0, TAU); c.fill(); }
      // the sun just under the horizon: a broad golden glow
      const sg = c.createRadialGradient(C44.sunX, hz + 30, 10, C44.sunX, hz + 30, 900); sg.addColorStop(0, 'rgba(255,236,190,0.95)'); sg.addColorStop(0.12, 'rgba(255,206,140,0.7)'); sg.addColorStop(0.4, 'rgba(240,150,100,0.25)'); sg.addColorStop(1, 'rgba(200,110,100,0)');
      c.fillStyle = sg; c.fillRect(0, hz - 900, w, 900 + 2);
      // one more band of thin streaks low over the sea, lit gold from below
      L.cloudBand(c, 0, { kind: 'streak', palette: 'sunsetHigh', light: Math.PI / 2, x: 0, y: off + 780, w, h: 120, coverage: 0.34, scaleX: 1000, scaleY: 22, seed: 4406, speed: 0, alpha: 0.6, gain: 2, base: 0.45 });
      // sea below the horizon (absolute stops: the title framing is unchanged), darker and warmer toward the shore
      const sea = c.createLinearGradient(0, hz, 0, hz + 150); sea.addColorStop(0, '#e8b08a'); sea.addColorStop(0.06, '#8a5e72'); sea.addColorStop(0.35, '#3a3150'); sea.addColorStop(1, '#22213a');
      c.fillStyle = sea; c.fillRect(0, hz, w, 152);
      const sea2 = c.createLinearGradient(0, hz + 150, 0, h); sea2.addColorStop(0, '#22213a'); sea2.addColorStop(1, '#2e2236'); c.fillStyle = sea2; c.fillRect(0, hz + 150, w, h - hz - 150);
      // the sun's road on the water (soft, painted once) + its glitter widening toward the shore
      const rd = c.createRadialGradient(C44.sunX, hz, 4, C44.sunX, hz, 520); rd.addColorStop(0, 'rgba(255,214,150,0.55)'); rd.addColorStop(1, 'rgba(255,214,150,0)');
      c.save(); c.beginPath(); c.rect(0, hz, w, h - hz); c.clip(); c.translate(C44.sunX, hz); c.scale(1, 0.28); c.translate(-C44.sunX, -hz); c.fillStyle = rd; c.fillRect(C44.sunX - 520, hz - 520, 1040, 1040); c.restore();
      // below the title framing (seen only during the crane) the sun's road comes toward the shore: a widening
      // column of gold with horizontal glints
      const rr = PV.rng(4407);
      // the water reflects the sky in long soft ripples (keeps the sea from reading as a flat band)
      c.save(); c.beginPath(); c.rect(0, hz + 2, w, h - hz); c.clip();
      for (let i = 0; i < 340; i++) {
        const y = hz + 3 + Math.pow(rr(), 1.25) * (h - hz - 4), dpt = y - hz, x = rr() * w, ln = (60 + 220 * rr()) * (0.5 + dpt / 260);
        c.globalAlpha = (0.05 + 0.1 * rr()) * (dpt < 150 ? 0.6 : 1); c.fillStyle = rr() < 0.6 ? '#8a6478' : '#c08a7a';
        c.fillRect(x - ln / 2, y, ln, 1 + dpt / 140);
      }
      c.restore();
      // the sun's road comes toward the shore: a widening column of gold with horizontal glints — gentle within the
      // title framing (the credits sit there), full below it (seen only during the crane)
      c.save(); c.globalCompositeOperation = 'screen';
      for (let y = hz + 2; y < h; y += 4) {
        const dpt = y - hz, wd = 70 + dpt * 1.1, a = lerp(0.09, 0.3, sm(140, 230, dpt)) * (1 - 0.35 * Math.max(0, dpt - 230) / (h - hz - 230));
        const rg2 = c.createLinearGradient(C44.sunX - wd, 0, C44.sunX + wd, 0); rg2.addColorStop(0, 'rgba(255,190,120,0)'); rg2.addColorStop(0.5, `rgba(255,206,140,${a.toFixed(3)})`); rg2.addColorStop(1, 'rgba(255,190,120,0)');
        c.fillStyle = rg2; c.fillRect(C44.sunX - wd, y, wd * 2, 4);
      }
      for (let i = 0; i < 560; i++) {
        const y = hz + 4 + Math.pow(rr(), 0.8) * (h - hz - 10), dpt = y - hz, wd = 70 + dpt * 1.1, x = C44.sunX + (rr() - 0.5) * 2 * wd * Math.pow(rr(), 0.7);
        const a = (0.25 + 0.6 * rr()) * (1 - Math.abs(x - C44.sunX) / (wd + 1)) * lerp(0.35, 1, sm(140, 230, dpt)); if (a <= 0.02) continue;
        c.globalAlpha = a; const ln = 8 + 24 * rr() * (0.5 + dpt / 300);
        c.drawImage(dot(rr() < 0.5 ? '#ffe2b0' : '#ffd08a'), x - ln / 2, y - 1.5, ln, 3);
      }
      c.restore();
      // the white bridge far away on the left, a dark silhouette now with a gold edge; it lands on a low headland
      L.bridge(c, { x0: -120, x1: 760, y: hz - 8, towerH: 118, lw: 2.4, cables: 9, color: '#3a2f48', shadow: '#2a2238', pierH: 8, span: 150, towers: [150, 520], light: 'right', rim: '#ffcf8a', rimAmt: 0.75 });
      c42Land(c, 690, 1010, hz, 20, '#2f263e', 4405);
      c.fillStyle = 'rgba(255,214,150,0.55)'; c.fillRect(0, hz - 1, w, 2);
    });
  }
  // the whole crane as one tall painting: world y −700 (top) … DIST + H + 80.  World y Y ↦ canvas row Y + Y0.
  // C44 at t = 0 shows world [DIST, DIST + H] = exactly C43's last frame (its grass, same offset).
  function c44World() {
    return PV.cached('g11:c44world', W, C44.Y0 + C44.DIST + H + 80, (c, w, h) => {
      const Y = (wy) => wy + C44.Y0;
      c.fillStyle = '#2a201b'; c.fillRect(0, 0, w, h);
      c.drawImage(c44Sky(), 0, 0);
      const go = c43GroundOff(1); c.drawImage(c43Ground(), go.x, Y(C44.DIST) + go.y);
      // the backlit lawn between the sea and the grass by their hands (C42's lawn: dark blades, gold rims),
      // fading into the near, out-of-focus grass above world DIST (so C43's frame stays untouched)
      const LB = PV.makeCanvas(w, 640), lc = LB.ctx;
      lc.filter = 'blur(2.5px)'; lc.drawImage(c42Lawn(4202), -140, 0, 2200, 546); lc.filter = 'none';     // crest at ≈ 60, a little soft
      // the body of the lawn warms toward the near grass (C43's brown), so the move reads as one ground
      lc.globalCompositeOperation = 'source-atop';
      const hz2 = lc.createLinearGradient(0, 70, 0, 470); hz2.addColorStop(0, 'rgba(70,46,40,0.12)'); hz2.addColorStop(0.3, 'rgba(62,44,36,0.55)'); hz2.addColorStop(0.65, 'rgba(50,37,30,0.88)'); hz2.addColorStop(1, 'rgba(42,32,27,1)');
      lc.fillStyle = hz2; lc.fillRect(0, 70, w, 570);
      lc.globalCompositeOperation = 'destination-in';
      const fg = lc.createLinearGradient(0, 400, 0, 470); fg.addColorStop(0, '#000'); fg.addColorStop(1, 'rgba(0,0,0,0)'); lc.fillStyle = fg; lc.fillRect(0, 0, w, 640);
      c.drawImage(LB.canvas, 0, Y(C44.DIST - 470));
      // the low sun's light grazing the lawn's crest
      c.save(); c.globalCompositeOperation = 'screen';
      const cy = Y(C44.DIST - 410), cg = c.createLinearGradient(0, cy - 40, 0, cy + 60); cg.addColorStop(0, 'rgba(255,190,120,0)'); cg.addColorStop(0.5, 'rgba(255,196,128,0.3)'); cg.addColorStop(1, 'rgba(255,190,120,0)');
      c.fillStyle = cg; c.fillRect(0, cy - 40, w, 100); c.restore();
    });
  }
  // vertical box-blurred half-res copies of the world (motion blur), built once
  function c44WorldBlur(level) {
    const Lb = level === 1 ? 12 : 30;            // half-res px  (= 24 / 60 px at full res)
    const hw = W / 2, hh = Math.ceil(c44World().height / 2);
    return PV.cached('g11:c44worldB' + level, hw, hh, (c) => {
      const src = PV.cached('g11:c44worldH', hw, hh, (c2) => { c2.imageSmoothingQuality = 'high'; c2.drawImage(c44World(), 0, 0, hw, hh); });
      for (let k = 0; k <= Lb; k++) { c.globalAlpha = 1 / (k + 1); c.drawImage(src, 0, k - Lb / 2); }
      c.globalAlpha = 1;
    });
  }
  // a glowing thread from a (base) to b (tip): brighter toward the pen, swaying, light flowing up
  function thread(ctx, a, b, t, seed, col, alpha) {
    if (alpha <= 0.003) return;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const s1 = 160 * PV.noise2(t * 0.7, seed) + 60 * Math.sin(t * 2.1 + seed), s2 = 120 * PV.noise2(t * 0.9 + 4, seed + 2);
    const c1 = { x: a.x + dx * 0.33 + nx * s1, y: a.y + dy * 0.33 + ny * s1 }, c2 = { x: a.x + dx * 0.7 + nx * s2, y: a.y + dy * 0.7 + ny * s2 };
    const path = () => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y); };
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y); g.addColorStop(0, PV.rgba(col, 0.15)); g.addColorStop(0.55, PV.rgba(col, 0.55)); g.addColorStop(1, PV.rgba(col, 1));
    ctx.strokeStyle = g;
    for (const [lw, aa] of [[34, 0.05], [14, 0.12], [5, 0.34]]) { ctx.globalAlpha = aa * alpha; ctx.lineWidth = lw; path(); ctx.stroke(); }
    const g2 = ctx.createLinearGradient(a.x, a.y, b.x, b.y); g2.addColorStop(0, 'rgba(255,248,236,0.12)'); g2.addColorStop(0.6, 'rgba(255,248,236,0.55)'); g2.addColorStop(1, 'rgba(255,250,240,1)');
    ctx.strokeStyle = g2; ctx.globalAlpha = 0.9 * alpha; ctx.lineWidth = 1.7; path(); ctx.stroke();
    // light flowing up the thread
    for (let i = 0; i < 12; i++) {
      const u = ((t * 1.1 + i / 12 + seed * 0.13) % 1), v = 1 - u;
      const x = v * v * v * a.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * b.x, y = v * v * v * a.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * b.y;
      const k = Math.sin(u * PI) * (0.4 + 0.6 * u);
      spark(ctx, x, y, 11, col, 0.75 * alpha * k); spark(ctx, x, y, 2.6, '#ffffff', 0.85 * alpha * k);
    }
    ctx.restore();
  }
  // where each thread's tip is at time t (her = strokes 0,2,4,6,8; his = 1,3,5,7)
  function tipOf(who, t, base) {
    const ks = STROKES.map((s2, k) => k).filter(k => STROKES[k].who === who);
    const first = ks[0], last = ks[ks.length - 1];
    if (t < strokeT0(first)) {   // rising from the scar to the start of its first stroke
      const st = STROKE_S[first].pts[0], u = PV.ease.inOutCubic(clamp(t / strokeT0(first), 0, 1));
      return { x: lerp(base.x, st.x, u) + Math.sin(u * PI) * (who ? 140 : -140), y: lerp(base.y, st.y, u), writing: false };
    }
    for (let i = 0; i < ks.length; i++) {
      const k = ks[i], t0 = strokeT0(k);
      if (t >= t0 && t < t0 + 0.25) return Object.assign(strokeAt(STROKE_S[k], strokeF(k, t)), { writing: t < t0 + 0.22 });
      const nk = ks[i + 1];
      if (nk !== undefined && t >= t0 + 0.25 && t < strokeT0(nk)) {       // gliding to the next stroke while the other plays
        const e = strokeAt(STROKE_S[k], 1), st = STROKE_S[nk].pts[0], u = PV.ease.inOutCubic(clamp((t - t0 - 0.25) / (strokeT0(nk) - t0 - 0.25), 0, 1));
        return { x: lerp(e.x, st.x, u), y: lerp(e.y, st.y, u) - Math.sin(u * PI) * 40, writing: false };
      }
    }
    const e = strokeAt(STROKE_S[last], 1); return { x: e.x, y: e.y, writing: false };
  }

  PV.shot('C44', { draw(ctx, t, d) {
    const tc = clamp(t, -0.3, d + 0.3);
    profCtx = ctx; prof('start');
    const crane = craneAt(tc);
    const vel = (craneAt(tc + 1 / 48) - craneAt(tc - 1 / 48)) * C44.DIST;   // px per frame
    const blurLen = Math.abs(vel) * 0.5;                                     // 180° shutter
    const chord = gauss(tc, 2.52, 0.14), strum = gauss(tc, 2.87, 0.12);
    // ---------------- the world (grass → lawn → sea → horizon → sky) rising as one, motion-blurred by its speed
    const dY = C44.DIST * (1 - crane), sy = dY + C44.Y0;
    const a1 = clamp((blurLen - 3) / 12, 0, 1), a2 = clamp((blurLen - 24) / 24, 0, 1);
    ctx.save(); ctx.imageSmoothingEnabled = true;
    if (a1 < 1) ctx.drawImage(c44World(), 0, sy, W, H, 0, 0, W, H);
    if (a1 > 0) { ctx.globalAlpha = a1; ctx.drawImage(c44WorldBlur(1), 0, sy / 2, W / 2, H / 2, 0, 0, W, H); }
    if (a2 > 0) { ctx.globalAlpha = a2; ctx.drawImage(c44WorldBlur(2), 0, sy / 2, W / 2, H / 2, 0, 0, W, H); }
    ctx.restore();
    const hzS = C44.hz - dY;
    if (crane < 0.5) c43Sun(ctx, 1 - sm(0.0, 0.5, crane));     // the same light as C43's last frame, leaving with the ground
    // warm haze of the low sun over the horizon
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    spark(ctx, C44.sunX, hzS + 20, 760, '#ffcf8a', (0.3 + 0.12 * chord) * sm(0.3, 0.8, crane));
    ctx.restore();
    // sea glitter under the sun: soft elongated glints (final framing only)
    if (crane > 0.7) {
      const a = sm(0.7, 1, crane);
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 40; i++) {
        const y = hzS + 5 + Math.pow(hash(i, 4452), 1.8) * 120, spread = 24 + (y - hzS) * 2.0;
        const x = C44.sunX + (hash(i, 4451) - 0.5) * 2 * spread, tw = 0.5 + 0.5 * Math.sin(tc * (3 + 4 * hash(i, 4453)) + i);
        ctx.globalAlpha = a * tw * 0.45; ctx.drawImage(dot('#ffe6b8'), x - 10 - (y - hzS) * 0.06, y - 2, 20 + (y - hzS) * 0.12, 4);
      }
      ctx.restore();
    }
    prof('sky');
    // ---------------- the laced hands leave the frame downward with their grass (scars glowing)
    const nearY = C44.DIST * crane;
    let scarBase = null;
    if (nearY < 700) {
      // the hands keep C43's last pose (key 54 = C43's last frame): the crane carries them out of frame
      const HL = c44Hands();
      const cam = { zoom: 1.02 - 0.04 * crane, x: -12, y: -6 + nearY, cx: 960, cy: 700 };
      if (blurLen > 4) {           // motion blur: two copies spread along the move (equal weights)
        const o = Math.min(blurLen, 40) * 0.5;
        drawHandLayers(ctx, HL, Object.assign({}, cam, { y: cam.y - o * 0.5 }));
        ctx.save(); ctx.globalAlpha = 0.5; drawHandLayers(ctx, HL, Object.assign({}, cam, { y: cam.y + o * 0.5 })); ctx.restore();
      } else drawHandLayers(ctx, HL, cam);
      drawScarGlow(ctx, HL.scars, cam, 1 - sm(0.2, 0.6, tc), 4.5 + tc);
      if (HL.scars) { const a = HL.scars[0], b = HL.scars[HL.scars.length - 1]; scarBase = { her: camPt(a[Math.floor(a.length / 2)], cam), him: camPt(b[Math.floor(b.length / 2)], cam) }; }
    }
    prof('hands');
    // thread bases: on the scars while visible, then from below the frame
    const herB = scarBase ? scarBase.her : { x: 900, y: H + 80 }, hisB = scarBase ? scarBase.him : { x: 1010, y: H + 80 };
    const bH = { x: lerp(herB.x, 880, sm(0.4, 1.2, tc)), y: Math.max(herB.y, lerp(herB.y, H + 120, sm(0.4, 1.2, tc))) };
    const bM = { x: lerp(hisB.x, 1040, sm(0.4, 1.2, tc)), y: Math.max(hisB.y, lerp(hisB.y, H + 120, sm(0.4, 1.2, tc))) };
    // ---------------- the threads and the writing
    const herTip = tipOf(0, tc, bH), hisTip = tipOf(1, tc, bM);
    const release = sm(2.48, 3.1, tc), born = sm(0, 0.15, tc);    // the threads come loose from the scars … and let go after the chord
    thread(ctx, bH, herTip, tc, 1, '#ffcf8a', (1 - release) * born);
    thread(ctx, bM, hisTip, tc, 2, '#fff0d0', (1 - release) * born);
    // the canvas glyph: written light → bright on the chord → hands over to the DOM title
    const handover = sm(2.5, 3.15, tc);
    writtenGlyph(ctx, tc, 1 - 0.92 * handover, chord);
    // pen tips: bright sparks; a little flash at each stroke's attack (one note each)
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const [tip, col] of [[herTip, '#ffd9a0'], [hisTip, '#fff2dc']]) {
      const a = (tip.writing ? 1 : 0.6) * (1 - release) * born;
      spark(ctx, tip.x, tip.y, 46, col, 0.55 * a); spark(ctx, tip.x, tip.y, 12, '#ffffff', 0.95 * a);
    }
    for (let k = 0; k < 9; k++) { const at = gauss(tc, strokeT0(k) + 0.02, 0.05) * (0.8 + 0.05 * k); if (at > 0.02) { const p0 = STROKE_S[k].pts[0]; spark(ctx, p0.x, p0.y, 90, STROKE_S[k].who ? '#fff0d0' : '#ffcf8a', 0.5 * at); } }   // each note a little louder (vel 54 + 3k)
    ctx.restore();
    prof('write');
    // ---------------- 177.0 the chord: the light swells behind the title; 177.35 the guitar's shimmer over アイロニー
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    spark(ctx, 700, 485, 520, '#ffd9a0', 0.42 * chord + 0.18 * handover * (1 - sm(3.2, 5.2, tc)));
    if (strum > 0.02) { const sx2 = lerp(960, 1700, sm(2.8, 3.25, tc)); const sg2 = ctx.createLinearGradient(sx2 - 220, 0, sx2 + 220, 0); sg2.addColorStop(0, 'rgba(255,236,200,0)'); sg2.addColorStop(0.5, `rgba(255,240,210,${(0.3 * strum).toFixed(3)})`); sg2.addColorStop(1, 'rgba(255,236,200,0)'); ctx.fillStyle = sg2; ctx.fillRect(sx2 - 220, 430, 440, 170); }
    ctx.restore();
    if (crane < 0.6) L.dust(ctx, 4.5 + tc, { seed: 4311, count: 60, alpha: 0.5 * (1 - sm(0.1, 0.6, crane)), color: '#ffe2b0', size: 3, vx: -6, vy: -8, drift: 30 });
    // the chord's sound: one soft ring opening from 右手 (the rings of C41 — sound returning — closed here)
    const rr = tc - 2.5;
    if (rr > 0 && rr < 1.8) {
      const u = rr / 1.8, R = 120 + 1100 * PV.ease.outCubic(u);
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (const [lw, aa] of [[90, 0.045], [36, 0.06]]) { ctx.globalAlpha = aa * (1 - u) * (1 - u) * sm(0, 0.08, rr); ctx.strokeStyle = '#ffdcae'; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(702, 485, R, R * 0.62, 0, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
    // celesta (177.0 + 0.12 k): four little stars twinkle around the title
    [[612, 372], [930, 352], [1270, 404], [1588, 430]].forEach(([x, y], k) => glint(ctx, x, y, 0.55, 0.9 * gauss(tc, 2.52 + k * 0.12, 0.07), '#fff2dc'));
    // drifting motes of light: released from the threads after the chord, rising slowly; still at the silence
    const rel = sm(2.45, 2.9, tc);
    if (rel > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 46; i++) {
        const age = tc - 2.5 - 0.3 * hash(i, 4461); if (age < 0) continue;
        const sx0 = lerp(560, 1600, hash(i, 4462)), sy0 = lerp(430, 640, hash(i, 4463));
        const x = sx0 + (hash(i, 4464) - 0.5) * 220 * (1 - Math.exp(-age * 0.8)) + 14 * Math.sin(age * 1.3 + i), y = sy0 - 70 * age - 30 * (1 - Math.exp(-age * 2));
        const a = sm(0, 0.3, age) * (1 - sm(1.6, 3.0, age)) * (0.6 + 0.4 * Math.sin(age * 4 + i));
        spark(ctx, x, y, 9 + 9 * hash(i, 4465), i % 2 ? '#ffcf8a' : '#fff0d0', 0.6 * a);
      }
      ctx.restore();
    }
    prof('fx');
  } });

})();

/* =============================================================================
 * atmos.js — 背景美術ライブラリ (anime background art & atmospherics)
 * 『キミの右手のアイロニー』PV.   Namespace: PV.lib (L).   Deterministic in (t, seed).
 *
 * Look target: theatrical-anime background painting — light and air.
 *   clouds : cauliflower billows, warm-white lit tops, blue-violet shadows, crevice
 *            occlusion, bounce light on the base, silver rim when backlit.
 *   sky    : zenith→horizon gradients, horizon haze, sun corona + halo, moon.
 *   sea    : painted perspective ripples, glitter road, night reflections.
 * Heavy static art is painted per-pixel ONCE and memoised (PV.cached); per-frame
 * work is drawImage + a few hundred small strokes.
 * Full API reference: analysis/art_review/bg_API.md
 * ========================================================================== */
(function () {
  'use strict';
  const PV = window.PV; const L = (PV.lib = PV.lib || {});
  const W = PV.W, H = PV.H, TAU = Math.PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp, sstep = PV.smooth, N2 = PV.noise2, N3 = PV.noise3;
  const PAD = 60; // transparent margin around cloud sprites (legacy layout contract of L.clouds)
  const def = (v, d) => (v === undefined || v === null ? d : v);

  /* ================================================================== utils */
  const RGBC = {};
  const rgb = (h) => RGBC[h] || (RGBC[h] = PV.hex2rgb(h));
  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const hexOf = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mixHex = (a, b, k) => hexOf(mix3(rgb(a), rgb(b), k));
  const tone = (h, k) => (k >= 0 ? mixHex(h, '#ffffff', k) : mixHex(h, '#000000', -k));
  const rgbaS = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const okey = (o) => PV.hash(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)) || '').toString(36);
  const fbm3 = PV.fbm3;

  // separable box blur (passes=2 ≈ gaussian) on a Float32Array
  function blurF(src, w, h, r, passes) {
    r = Math.max(1, Math.round(r)); passes = passes || 2;
    const tmp = new Float32Array(w * h); let cur = src;
    const cnt = (i, n) => Math.min(n - 1, i + r) - Math.max(0, i - r) + 1; // edge-normalised window
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < h; y++) {
        const o = y * w; let acc = 0;
        for (let x = 0; x <= r && x < w; x++) acc += cur[o + x];
        for (let x = 0; x < w; x++) {
          tmp[o + x] = acc / cnt(x, w);
          const xo = x - r; if (xo >= 0) acc -= cur[o + xo];
          const xi = x + r + 1; if (xi < w) acc += cur[o + xi];
        }
      }
      const out = cur === src ? new Float32Array(w * h) : cur;
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let y = 0; y <= r && y < h; y++) acc += tmp[y * w + x];
        for (let y = 0; y < h; y++) {
          out[y * w + x] = acc / cnt(y, h);
          const yo = y - r; if (yo >= 0) acc -= tmp[yo * w + x];
          const yi = y + r + 1; if (yi < h) acc += tmp[yi * w + x];
        }
      }
      cur = out;
    }
    return cur;
  }

  // cached soft dot sprites (64px) — much cheaper than a gradient per particle
  function dotSprite(hex, kind) {
    return PV.cached('atm:dot:' + hex + ':' + (kind || 's'), 64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); const k = rgb(hex);
      if (kind === 'disc') { g.addColorStop(0, rgbaS(k, 0.78)); g.addColorStop(0.7, rgbaS(k, 0.86)); g.addColorStop(0.86, rgbaS(k, 1)); g.addColorStop(0.94, rgbaS(k, 0.5)); g.addColorStop(1, rgbaS(k, 0)); }
      else if (kind === 'hard') { g.addColorStop(0, rgbaS(k, 1)); g.addColorStop(0.5, rgbaS(k, 0.95)); g.addColorStop(0.75, rgbaS(k, 0.35)); g.addColorStop(1, rgbaS(k, 0)); }
      else { g.addColorStop(0, rgbaS(k, 1)); g.addColorStop(0.15, rgbaS(k, 0.62)); g.addColorStop(0.42, rgbaS(k, 0.2)); g.addColorStop(1, rgbaS(k, 0)); }
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
  }
  function drawDot(ctx, spr, x, y, r) { ctx.drawImage(spr, x - r, y - r, r * 2, r * 2); }
  // small LRU of full-frame paintings whose parameters may animate (sky, hospital view): bounded memory,
  // repaint only when the parameters change.
  const LRU = new Map();
  function lruCanvas(key, w, h, paint) {
    const e = LRU.get(key); if (e) { LRU.delete(key); LRU.set(key, e); return e; }
    let cv = null;
    if (LRU.size >= 14) { const k0 = LRU.keys().next().value, old = LRU.get(k0); LRU.delete(k0); if (old.width === w && old.height === h) cv = old; }
    if (!cv) cv = PV.makeCanvas(w, h).canvas;
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.clearRect(0, 0, w, h);
    paint(c, w, h); LRU.set(key, cv); return cv;
  }
  // bounded cache: keeps at most n entries (oldest evicted) — for caches whose keys may follow animated params
  function bounded(n) { const m = new Map(); return { get: (k) => m.get(k), set: (k, v) => { if (m.size >= n) m.delete(m.keys().next().value); m.set(k, v); return v; } }; }
  const qcol = (h) => { const c = rgb(h); return hexOf(c.map((v) => Math.round(v / 20) * 20)); }; // quantised colour (cache keys)
  // blur a low-res buffer into a second low-res buffer (cheap) and return it
  function blurLow(src, key, px) {
    const b = PV.buffer(key, src.width, src.height); b.ctx.clearRect(0, 0, src.width, src.height);
    b.ctx.filter = `blur(${px}px)`; b.ctx.drawImage(src, 0, 0); b.ctx.filter = 'none'; return b.canvas;
  }

  /* ==================================================================== sky */
  // legacy: plain vertical gradient over the whole frame. stops: [[pos,'#hex'],...] top->bottom
  L.sky = function (ctx, stops, y0 = 0, y1 = H) {
    ctx.fillStyle = PV.linGrad(ctx, 0, y0, 0, y1, stops); ctx.fillRect(0, 0, W, H);
  };

  // sky presets: gradient from the top of the frame (0) to the horizon (1)
  const SKY = {
    spring: [[0, '#2f72cf'], [0.3, '#4f93e0'], [0.6, '#86bdee'], [0.84, '#c4e1f7'], [1, '#e9f2f3']],
    summer: [[0, '#0f42b0'], [0.26, '#1f62d2'], [0.55, '#4793e6'], [0.8, '#97cbf4'], [0.94, '#d2eafa'], [1, '#edf6fa']],
    autumn: [[0, '#1a4bb2'], [0.3, '#326fcd'], [0.62, '#6fa8e5'], [0.86, '#b6d7f2'], [1, '#e3eef3']],
    sunset: [[0, '#1c2868'], [0.24, '#36468f'], [0.46, '#7466a6'], [0.63, '#c9859f'], [0.78, '#f2a27c'], [0.91, '#ffc983'], [1, '#ffe6b0']],
    dusk: [[0, '#0e1536'], [0.35, '#262f69'], [0.65, '#67518f'], [0.85, '#c47f8f'], [1, '#efb98f']],
    dawn: [[0, '#16234f'], [0.35, '#3b4d8c'], [0.65, '#978db6'], [0.85, '#eeb6a6'], [1, '#ffe0bd']],
    night: [[0, '#050916'], [0.4, '#0b1330'], [0.75, '#172450'], [1, '#2a3a6a']],
    city: [[0, '#060a1c'], [0.38, '#0d1534'], [0.68, '#1b2553'], [0.88, '#383768'], [1, '#5d4769']],
    storm: [[0, '#060a14'], [0.45, '#10182b'], [0.8, '#1d2740'], [1, '#2c3650']],
    overcast: [[0, '#8a8d93'], [0.55, '#a6a7aa'], [1, '#c3c0bb']],
  };
  const SKYX = {
    spring: { haze: '#f3f4ec', hazeA: 0.55, sun: '#fffaf0', glow: '#fff0cf' },
    summer: { haze: '#f0f7fb', hazeA: 0.5, sun: '#ffffff', glow: '#fff6e2' },
    autumn: { haze: '#edf2f2', hazeA: 0.45, sun: '#fffaf0', glow: '#ffefd2' },
    sunset: { haze: '#ffd79c', hazeA: 0.55, sun: '#fff4d6', glow: '#ffae6e' },
    dusk: { haze: '#efb58e', hazeA: 0.4, sun: '#ffe3bb', glow: '#ff9d7a' },
    dawn: { haze: '#ffe5c6', hazeA: 0.55, sun: '#fff6e2', glow: '#ffc19c' },
    night: { haze: '#2e3c6d', hazeA: 0.4, sun: '#eef2ff', glow: '#9fb3e6' },
    city: { haze: '#6b4f72', hazeA: 0.42, sun: '#eef2ff', glow: '#9fb3e6' },
    storm: { haze: '#2b3550', hazeA: 0.3, sun: '#dfe8ff', glow: '#8090b5' },
    overcast: { haze: '#cfccc6', hazeA: 0.5, sun: '#ffffff', glow: '#ffffff' },
  };
  L.SKY = SKY;

  // very low frequency "breathing" of the sky colour (painted, not CG-perfect)
  function skyTexture(ctx, x, y, w, h, seed, amt) {
    if (amt <= 0 || h <= 0) return;
    const tex = PV.cached('atm:skytex:' + seed, 160, 90, (c) => {
      const img = c.createImageData(160, 90);
      for (let j = 0; j < 90; j++) for (let i = 0; i < 160; i++) {
        const v = 128 + PV.fbm2(i / 38 + seed * 3.1, j / 30, 3) * 120; const k = (j * 160 + i) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    });
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.16 * amt;
    ctx.drawImage(tex, x, y, w, h); ctx.restore();
  }

  /* L.skyDome(ctx, t, o) — painted sky.
   * o: preset ('spring'|'summer'|'autumn'|'sunset'|'dusk'|'dawn'|'night'|'city'|'storm'|'overcast'),
   *    stops (custom, 0=top..1=horizon), top, horizon (y), x0,x1,y1 (fill rect),
   *    sun {x,y,scale,intensity,rays,halo,color,glow}, haze (0..1), hazeColor, hazeH, texture(bool), seed */
  L.skyDome = function (ctx, t, o = {}) {
    if (o.cache === false) { paintSky(ctx, t, o); return; }
    const x0 = def(o.x0, 0), x1 = def(o.x1, W), top = def(o.top, 0), y1 = def(o.y1, H);
    const cv = lruCanvas('sky:' + okey(Object.assign({}, o, { t: 0 })), W, H, (c) => paintSky(c, 0, o));
    ctx.drawImage(cv, x0, top, x1 - x0, y1 - top, x0, top, x1 - x0, y1 - top);
  };
  function paintSky(ctx, t, o) {
    const preset = o.preset || 'spring'; const X = SKYX[preset] || SKYX.spring;
    const top = def(o.top, 0), hz = def(o.horizon, H * 0.7);
    const x0 = def(o.x0, 0), x1 = def(o.x1, W), y1 = def(o.y1, H);
    ctx.save();
    ctx.fillStyle = PV.linGrad(ctx, 0, top, 0, hz, o.stops || SKY[preset] || SKY.spring);
    ctx.fillRect(x0, top, x1 - x0, y1 - top);
    if (o.texture !== false) skyTexture(ctx, x0, top, x1 - x0, hz - top, def(o.seed, 1), def(o.textureAmt, 1));
    const hA = def(o.haze, X.hazeA);
    if (hA > 0) {
      const hh = def(o.hazeH, (hz - top) * 0.34); const hc = rgb(o.hazeColor || X.haze);
      const g = ctx.createLinearGradient(0, hz - hh, 0, hz + 1);
      g.addColorStop(0, rgbaS(hc, 0)); g.addColorStop(0.55, rgbaS(hc, hA * 0.32)); g.addColorStop(0.85, rgbaS(hc, hA * 0.7)); g.addColorStop(1, rgbaS(hc, hA));
      ctx.fillStyle = g; ctx.fillRect(x0, hz - hh, x1 - x0, hh + 1);
      if (y1 > hz + 1) { ctx.fillStyle = rgbaS(hc, hA); ctx.fillRect(x0, hz + 1, x1 - x0, y1 - hz - 1); }
    }
    if (o.sun) L.sun(ctx, o.sun.x, o.sun.y, Object.assign({ color: X.sun, glow: X.glow, t }, o.sun));
    ctx.restore();
  };

  /* L.sun(ctx, x, y, o) — sun with scattering glow, corona, halo ring (光輪) and soft starburst.
   * o: scale(1), intensity(1), color, glow, halo(true), haloR(320), rays(0.55), t (rays rotate slowly), disc(true) */
  L.sun = function (ctx, x, y, o = {}) {
    const k = def(o.scale, 1), I = def(o.intensity, 1), t = def(o.t, 0);
    const core = rgb(o.color || '#fffaf0'), glow = rgb(o.glow || '#fff0d0');
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    let R = 1150 * k, g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, rgbaS(glow, 0.5 * I)); g.addColorStop(0.12, rgbaS(glow, 0.3 * I)); g.addColorStop(0.35, rgbaS(glow, 0.1 * I)); g.addColorStop(1, rgbaS(glow, 0));
    ctx.fillStyle = g; ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
    R = 260 * k; g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, rgbaS(core, 0.95 * I)); g.addColorStop(0.16, rgbaS(core, 0.7 * I)); g.addColorStop(0.45, rgbaS(glow, 0.22 * I)); g.addColorStop(1, rgbaS(glow, 0));
    ctx.fillStyle = g; ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
    if (o.halo !== false) {
      const hr = def(o.haloR, 330) * k, a = 0.075 * I * def(o.haloAmt, 1);
      g = ctx.createRadialGradient(x, y, hr * 0.8, x, y, hr * 1.12);
      g.addColorStop(0, 'rgba(160,190,255,0)'); g.addColorStop(0.42, `rgba(170,200,255,${a * 0.6})`); g.addColorStop(0.55, `rgba(255,255,250,${a})`);
      g.addColorStop(0.68, `rgba(255,214,170,${a * 0.8})`); g.addColorStop(1, 'rgba(255,190,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, hr * 1.12, 0, TAU); ctx.fill();
    }
    const ray = def(o.rays, 0.55);
    if (ray > 0) {
      const n = 14, r = PV.rng(def(o.seed, 3));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + r() * 0.3 + t * 0.025, len = (380 + 700 * r()) * k, wd = (2 + 5 * r()) * k;
        const al = ray * I * (0.06 + 0.12 * r()) * (0.75 + 0.25 * Math.sin(t * 0.7 + i * 2.3));
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, nx = -Math.sin(a) * wd, ny = Math.cos(a) * wd;
        const gg = ctx.createLinearGradient(x, y, ex, ey); gg.addColorStop(0, rgbaS(core, al)); gg.addColorStop(1, rgbaS(core, 0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(x + nx, y + ny); ctx.lineTo(ex, ey); ctx.lineTo(x - nx, y - ny); ctx.closePath(); ctx.fill();
      }
    }
    if (o.disc !== false) {
      R = 44 * k; g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, rgbaS([255, 255, 255], I)); g.addColorStop(0.55, rgbaS(core, I)); g.addColorStop(1, rgbaS(core, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  /* L.moon(ctx, o) — 月（三日月 by default）.
   * o: x,y,r(44), phase (lit fraction 0..1; 0.18 = crescent, 0.5 = half), tilt (rad: direction the
   *    lit limb faces, 0 = right), color, glow, intensity, earthshine (0.05: the dark disc barely shows), halo (0..1), texture(true) */
  L.moon = function (ctx, o = {}) {
    const x = def(o.x, 1440), y = def(o.y, 230), r = def(o.r, 44);
    const ph = clamp(def(o.phase, 0.18), 0.03, 1), tilt = def(o.tilt, -0.55), I = def(o.intensity, 1);
    const col = rgb(o.color || '#fff3d4'), gl = rgb(o.glow || '#c9d7ff');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    let g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 11);
    const ga = I * (0.18 + 0.3 * ph);
    g.addColorStop(0, rgbaS(gl, ga)); g.addColorStop(0.12, rgbaS(gl, ga * 0.5)); g.addColorStop(0.4, rgbaS(gl, ga * 0.14)); g.addColorStop(1, rgbaS(gl, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r * 11, y - r * 11, r * 22, r * 22);
    if (def(o.halo, 0) > 0) {
      const hr = r * 4.6, a = 0.05 * o.halo * I; g = ctx.createRadialGradient(x, y, hr * 0.82, x, y, hr * 1.1);
      g.addColorStop(0, 'rgba(180,200,255,0)'); g.addColorStop(0.5, `rgba(220,230,255,${a})`); g.addColorStop(0.7, `rgba(255,225,200,${a * 0.6})`); g.addColorStop(1, 'rgba(255,220,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, hr * 1.1, 0, TAU); ctx.fill();
    }
    ctx.translate(x, y); ctx.rotate(tilt);
    const es = def(o.earthshine, 0.05);
    if (es > 0) { ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgbaS(mix3(gl, [30, 38, 70], 0.6), es * I); ctx.beginPath(); ctx.arc(0, 0, r * 0.97, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    const ex = r * (1 - 2 * ph);
    const path = () => { ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false); ctx.ellipse(0, 0, Math.max(0.01, Math.abs(ex)), r, 0, Math.PI / 2, -Math.PI / 2, ex > 0); ctx.closePath(); };
    ctx.save(); ctx.shadowColor = rgbaS(gl, 0.9 * I); ctx.shadowBlur = r * 0.7;
    path(); g = ctx.createLinearGradient(r, 0, ex, 0);
    g.addColorStop(0, rgbaS([255, 253, 245], I)); g.addColorStop(0.6, rgbaS(col, I)); g.addColorStop(1, rgbaS(mix3(col, [190, 170, 150], 0.35), I * 0.85));
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
    if (o.texture !== false) {
      ctx.save(); path(); ctx.clip(); const rr = PV.rng(17);
      for (let i = 0; i < 9; i++) { const a = rr() * TAU, d = r * 0.7 * Math.sqrt(rr()), s = r * (0.12 + 0.22 * rr()); ctx.fillStyle = `rgba(150,140,150,${0.1 + 0.08 * rr()})`; ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, s, s * (0.6 + 0.4 * rr()), rr() * 3, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
  };

  /* ================================================================ clouds */
  // palettes: hi (sun-struck cap) / lit / mid / shadow (blue-violet) / deep (crevice) / bounce (reflected
  // light on the underside) / rim (silver lining) / haze (atmospheric colour toward the horizon)
  // Painted-BG values: sun-struck tops near-white & faintly warm, shadow planes a clean sky-reflecting
  // blue (style guide: 白〜#a9bde0), crevices deeper ultramarine — never grey-lavender mud.
  const CLOUD_PAL = {
    day: { hi: '#fffefa', lit: '#f2f5fa', mid: '#e3eaf6', shadow: '#a9bce2', deep: '#8299cf', bounce: '#c6d6f0', rim: '#ffffff', haze: '#d9e7f5', sky: '#8fbcec' },
    spring: { hi: '#fffdf7', lit: '#f4f5f8', mid: '#e6ebf6', shadow: '#adbee2', deep: '#8a9dd1', bounce: '#cddcf1', rim: '#fffdf4', haze: '#dce9f4', sky: '#93c0ec' },
    summer: { hi: '#fffefa', lit: '#f1f5fb', mid: '#e0e9f8', shadow: '#9cb4e4', deep: '#6f8ad2', bounce: '#bad1f5', rim: '#fffcf0', haze: '#d2e6f7', sky: '#5d9be6' },
    sunsetHigh: { hi: '#ffd9a8', lit: '#f8aa86', mid: '#d97c8f', shadow: '#7f5b94', deep: '#4b3f7e', bounce: '#ff9c78', rim: '#ffe2b2', haze: '#c98aa0', sky: '#8a6aa8' },
    autumn: { hi: '#fffefa', lit: '#f1f4f9', mid: '#e0e7f4', shadow: '#a5b6dd', deep: '#7d91c6', bounce: '#c2d3ee', rim: '#ffffff', haze: '#dae6f1', sky: '#7fb0e6' },
    sunset: { hi: '#fff4d6', lit: '#ffcf8c', mid: '#f0a083', shadow: '#9a6e9d', deep: '#5d4a88', bounce: '#ffa07c', rim: '#ffeab6', haze: '#f0a98f', sky: '#c486a0' },
    dusk: { hi: '#ffe2ca', lit: '#f5ac9b', mid: '#ba89a7', shadow: '#6b5a8c', deep: '#3d3967', bounce: '#e3919a', rim: '#ffd9b9', haze: '#a68aa8', sky: '#6a5a8e' },
    storm: { hi: '#9ba7c0', lit: '#7884a1', mid: '#525e7c', shadow: '#2d3652', deep: '#161c2f', bounce: '#3a4562', rim: '#b9c6e2', haze: '#283149', sky: '#1d2740' },
    night: { hi: '#d3dcf2', lit: '#a1aed3', mid: '#66739f', shadow: '#37406c', deep: '#1f264d', bounce: '#3d4775', rim: '#eaf0ff', haze: '#1d2b55', sky: '#18224a' },
    overcast: { hi: '#ecebe7', lit: '#dcd9d4', mid: '#bdbab5', shadow: '#918d88', deep: '#6f6c69', bounce: '#aaa6a1', rim: '#f4f2ee', haze: '#b3afa9', sky: '#a9a8a6' },
  };
  L.CLOUD_PAL = CLOUD_PAL;
  const lum = (h) => { const c = rgb(h); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; };
  function cloudPalette(o) {
    const p = Object.assign({}, CLOUD_PAL[o.palette] || (o.type === 'storm' ? CLOUD_PAL.storm : CLOUD_PAL.day));
    // legacy colours {lit,mid,shadow,rim}: derive the extra tones FROM the given colours so a dark
    // (storm) set stays dark — the highlight is only a little above `lit`, the rim near `lit`.
    if (o.lit) { const lk = lum(o.lit); p.lit = o.lit; if (!o.hi) p.hi = tone(o.lit, lk > 0.85 ? 0.45 : lk > 0.6 ? 0.25 : 0.1); if (!o.rim && lk < 0.7) p.rim = tone(o.lit, 0.28); if (lk < 0.6) p.sky = tone(o.shadow || o.lit, -0.2); }
    if (o.mid) p.mid = o.mid;
    if (o.shadow) { p.shadow = o.shadow; if (!o.deep) p.deep = tone(o.shadow, -0.32); if (!o.bounce) p.bounce = mixHex(o.shadow, p.mid, 0.4); }
    for (const k of ['hi', 'deep', 'bounce', 'rim', 'sky']) if (typeof o[k] === 'string') p[k] = o[k];
    if (typeof o.hazeColor === 'string') p.haze = o.hazeColor;
    return p;
  }

  // shape grammars. towers: towers per aspect unit; tall: tower height range; tw: tower width factor;
  // levels: fractal billow levels; ratio: child/parent radius; kids: children per parent
  // paint/th1/th2/bw/air: painted ramp (see paintCloud) — strength, shade|half and half|light borders,
  // border half-width (brush softness), shade-side silhouette translucency
  const CTYPE = {
    cumulus: { towers: 1.05, tall: [0.48, 0.86], tw: 0.62, levels: 3, ratio: [0.34, 0.5], kids: [7, 5, 4, 3], soft: 0.026, macro: 0.55, sharp: 0.42, paint: 1, th1: 0.43, th2: 0.53, bw: 0.016, air: 0.35 },
    tower: { towers: 0.85, tall: [0.4, 0.78], tw: 0.5, levels: 4, ratio: [0.34, 0.48], kids: [7, 5, 4, 3], soft: 0.016, macro: 0.68, sharp: 0.46, body: 0.42, paint: 1, th1: 0.44, th2: 0.53, bw: 0.014, air: 0.3, ao: 0.22, cast: 0.36 },
    puff: { towers: 1.4, tall: [0.6, 1], tw: 0.75, levels: 3, ratio: [0.38, 0.54], kids: [6, 4, 3, 3], soft: 0.035, macro: 0.5, sharp: 0.36, paint: 0.9, th1: 0.42, th2: 0.53, bw: 0.022, air: 0.4 },
    flat: { towers: 2.1, tall: [0.55, 1], tw: 0.8, levels: 2, ratio: [0.38, 0.52], kids: [6, 4, 3, 3], soft: 0.045, macro: 0.46, sharp: 0.3, paint: 0.8, th1: 0.42, th2: 0.54, bw: 0.028, air: 0.45 },
    storm: { towers: 1.25, tall: [0.55, 1], tw: 0.75, levels: 3, ratio: [0.4, 0.56], kids: [6, 4, 3, 3], soft: 0.05, macro: 0.62, sharp: 0.12, ragged: 0.8, paint: 0.35, th1: 0.4, th2: 0.55, bw: 0.05, air: 0.5 },
  };

  // fractal "cauliflower" sphere cluster with a flat base at y = h, fitted into w × h
  function cloudSpheres(o, w, h) {
    const T = CTYPE[o.type] || CTYPE.cumulus; const R = PV.rng(((def(o.seed, 1) * 7919) + 17) >>> 0);
    const S = []; const base = h; let spread = 0.65; const push = (x, y, z, r, l) => { S.push({ x, y, z, r, l, sp: spread, f: 0 }); };
    let nT = Math.round((w / h) * T.towers * (0.85 + 0.3 * R())); nT = Math.max(T.body ? 3 : 1, Math.min(7, nT));
    if (T.body) { // massive mound under the turrets (cumulonimbus): irregular, billowed all over
      spread = 0.9; const rows = 6;
      for (let j = 0; j < rows; j++) {
        const u = j / (rows - 1), yb = base - h * T.body * u * 0.9 - h * 0.05;
        const hw = w * 0.5 * (0.96 - 0.5 * Math.pow(u, 1.2)), n = Math.max(2, Math.ceil((2 * hw) / (h * 0.105)));
        for (let i = 0; i < n; i++) { const rad = h * lerp(0.13, 0.09, u) * (0.65 + 0.7 * R()); push(w / 2 - hw + (i + 0.5) * ((2 * hw) / n) + (R() - 0.5) * rad * 0.9, yb + (R() - 0.5) * rad * 1.1, (R() - 0.3) * rad * 0.7, rad, 0); }
      }
      spread = 0.65;
    }
    const dom = Math.floor(R() * nT);
    for (let k = 0; k < nT; k++) {
      const u = nT === 1 ? 0.5 : k / (nT - 1);
      const cx = w * (0.17 + 0.66 * u) + (R() - 0.5) * (w / nT) * 0.3, mid = 1 - Math.abs(u - 0.5) * 2;
      let th = h * lerp(T.tall[0], T.tall[1], R()) * (0.7 + 0.3 * mid); if (k === dom) th = h * (0.96 + 0.04 * R());
      const tw = Math.min((w / nT) * T.tw, th * 0.6) * (0.85 + 0.3 * R());
      const R0 = tw, R1 = tw * 0.6, top = base - th, ph = R() * 10;
      let y = base - R0 * 0.45, i = 0;
      while (i < 60) {
        const uu = clamp((base - y) / th), rad = lerp(R0, R1, uu);
        if (y - rad <= top + R1 * 0.25) break;
        const x = cx + Math.sin(i * 1.3 + ph) * rad * 0.16 + (R() - 0.5) * rad * 0.22;
        push(x, y, (R() - 0.5) * rad * 0.35, rad, 0);
        if (R() < 0.8) { const sd = R() < 0.5 ? -1 : 1; push(x + sd * rad * (0.5 + 0.3 * R()), y + rad * (R() - 0.2) * 0.35, (R() - 0.5) * rad * 0.3, rad * (0.45 + 0.22 * R()), 0); }
        y -= rad * (0.5 + 0.16 * R()); i++;
      }
      const capR = R1 * (0.62 + 0.12 * R()), nc = 3 + Math.floor(R() * 2); // summit = cluster of billows, never one ball
      for (let q = 0; q < nc; q++) { const u2 = nc === 1 ? 0 : q / (nc - 1) - 0.5; push(cx + u2 * capR * 1.5 + (R() - 0.5) * capR * 0.3, top + capR * (1 + Math.abs(u2) * 0.7) + (R() - 0.5) * capR * 0.2, (R() - 0.5) * capR * 0.3, capR * (0.85 + 0.3 * R() - Math.abs(u2) * 0.25), 0); }
    }
    spread = 0.55;
    const rb0 = Math.min(h * 0.19, w * 0.085), nb = Math.max(2, Math.ceil(w / (rb0 * 1.25)));
    for (let i = 0; i <= nb; i++) {
      const u = i / nb, end = Math.min(u, 1 - u) * 2, rb = rb0 * (0.55 + 0.45 * Math.sqrt(end)) * (0.85 + 0.3 * R());
      push(w * (0.03 + 0.94 * u) + (R() - 0.5) * rb * 0.4, base - rb * 0.5, (R() - 0.5) * rb * 0.3, rb, 0);
    }
    // fractal billows. Fine levels hug the silhouette (low tilt toward the viewer) so lit faces stay calm
    // and the cauliflower texture concentrates on the outline, as in painted backgrounds.
    const cx0 = w / 2, minR = def(o.minBillow, 1.7), lv = def(o.levels, T.levels); let parents = S.slice();
    for (let lvl = 1; lvl <= lv; lvl++) {
      const next = []; const kids = T.kids[Math.min(T.kids.length - 1, lvl - 1)];
      const tiltMax = lvl === 1 ? 0.95 : lvl === 2 ? (T.body ? 0.8 : 0.66) : 0.48;
      for (const p of parents) {
        const n = Math.max(1, Math.round((kids + R() * 2.5) * (lvl > 1 ? 1 - p.f * 0.75 : 1)));
        for (let j = 0; j < n; j++) {
          const out = clamp((p.x - cx0) / (w * 0.5), -1, 1) * 0.5;
          const th = -Math.PI / 2 + (R() - 0.5) * Math.PI * 2 * p.sp + out;
          const ph = Math.asin(R()) * tiltMax; const cp = Math.cos(ph);
          const dx = Math.cos(th) * cp, dy = Math.sin(th) * cp, dz = Math.sin(ph);
          const cr = p.r * lerp(T.ratio[0], T.ratio[1], R()); if (cr < minR) continue;
          const dist = p.r - cr * (0.22 + 0.22 * R());
          const c = { x: p.x + dx * dist, y: p.y + dy * dist, z: p.z + dz * dist, r: cr, l: lvl, sp: Math.min(0.7, p.sp), f: Math.min(1, dz * 1.2 + p.f * 0.4) };
          if (c.y + cr * 0.15 > base) continue;
          next.push(c);
        }
      }
      for (const c of next) S.push(c); parents = next;
    }
    let minX = 1e9, maxX = -1e9, minY = 1e9;
    for (const s of S) { if (s.x - s.r < minX) minX = s.x - s.r; if (s.x + s.r > maxX) maxX = s.x + s.r; if (s.y - s.r < minY) minY = s.y - s.r; }
    const sc = Math.min(w / (maxX - minX), h / (base - minY)), mx = (minX + maxX) / 2;
    for (const s of S) { s.x = (s.x - mx) * sc + w / 2; s.y = base - (base - s.y) * sc; s.r *= sc; s.z *= sc; }
    return S;
  }

  // per-pixel painter: soft union of billow spheres → height/normal field → painted shading
  function paintCloud(c, CW, CH, S, o, w, h) {
    const T = CTYPE[o.type] || CTYPE.cumulus; const pal = cloudPalette(o); const N = CW * CH;
    const WT = new Float32Array(N), NX = new Float32Array(N), NY = new Float32Array(N), NZ = new Float32Array(N), COV = new Float32Array(N);
    let zMax = -1e9, zMin = 1e9; for (const s of S) { if (s.z + s.r > zMax) zMax = s.z + s.r; if (s.z - s.r < zMin) zMin = s.z - s.r; }
    const soft = Math.max(0.6, def(o.soft, T.soft) * h), k = Math.min(1 / soft, 70 / Math.max(1, zMax - zMin));
    const baseC = PAD + h;
    for (const s of S) {
      const cx = s.x + PAD, cy = s.y + PAD, r = s.r, r2 = r * r, ro = r + 0.5, ro2 = ro * ro, ir = 1 / r;
      const y0 = Math.max(0, Math.floor(cy - ro)), y1 = Math.min(CH - 1, Math.ceil(cy + ro), o.ceiling ? CH - 1 : Math.ceil(baseC) + 1);
      for (let y = y0; y <= y1; y++) {
        const dy = y + 0.5 - cy, dy2 = dy * dy; if (dy2 >= ro2) continue;
        const span = Math.sqrt(ro2 - dy2);
        const xa = Math.max(0, Math.floor(cx - span)), xb = Math.min(CW - 1, Math.ceil(cx + span));
        let idx = y * CW + xa;
        for (let x = xa; x <= xb; x++, idx++) {
          const dx = x + 0.5 - cx, d2 = dx * dx + dy2; if (d2 >= ro2) continue;
          const d = Math.sqrt(d2); let cov = r + 0.5 - d; if (cov > 1) cov = 1;
          const zz = d2 < r2 ? Math.sqrt(r2 - d2) : 0;
          const wg = Math.exp((s.z + zz - zMax) * k) * cov;
          WT[idx] += wg; NX[idx] += wg * dx * ir; NY[idx] += wg * dy * ir; NZ[idx] += wg * zz * ir;
          if (cov > COV[idx]) COV[idx] = cov;
        }
      }
    }
    const Z = new Float32Array(N); const zr = zMax - zMin;
    for (let i = 0; i < N; i++) { const wt = WT[i]; Z[i] = wt > 0 ? Math.max(0, Math.log(wt) / k + zr) * COV[i] : 0; }
    const Zm = blurF(Z, CW, CH, h * 0.06), Za = blurF(Z, CW, CH, Math.max(1.5, h * 0.022)), Cb = blurF(COV, CW, CH, Math.max(1, h * 0.01), 1);
    const la = def(o.light, -2.2), le = clamp(def(o.lightZ, 0.5), -0.95, 0.95), cxy = Math.sqrt(1 - le * le);
    const Lx = Math.cos(la) * cxy, Ly = Math.sin(la) * cxy, Lz = le, l2x = Math.cos(la), l2y = Math.sin(la), back = le < 0 ? -le : 0;
    // wide coverage blur = "thickness": a backlit cloud glows only where it is thin (its silhouette)
    const Cw = back > 0.04 ? blurF(COV, CW, CH, Math.max(2, h * 0.055), 2) : null;
    // directional self-shadow: march toward the light over the height field → crisp shade under billows
    const castK = def(o.cast, def(T.cast, 0.45)); let SH = null;
    if (castK > 0) {
      SH = new Float32Array(N); const steps = 8, sl = Math.max(1.5, h * 0.0105), sx = l2x * sl, sy = l2y * sl, rise = sl * (Lz / Math.max(0.2, cxy)), soft2 = 1 / Math.max(1, h * 0.034);
      for (let y = 1; y < CH - 1; y++) for (let x = 1; x < CW - 1; x++) {
        const i = y * CW + x; if (COV[i] <= 0.002) continue; const z0 = Z[i]; let occ = 0;
        for (let k = 1; k <= steps; k++) {
          const xs = Math.round(x + sx * k), ys = Math.round(y + sy * k); if (xs < 0 || ys < 0 || xs >= CW || ys >= CH) break;
          const dz = Z[ys * CW + xs] - (z0 + rise * k); if (dz > 0) { const v = dz * soft2; if (v > occ) occ = v; }
        }
        SH[i] = occ > 1 ? 1 : occ;
      }
      SH = blurF(SH, CW, CH, Math.max(1, h * 0.007), 2);
    }
    const img = c.createImageData(CW, CH), D = img.data;
    const cHi = rgb(pal.hi), cLit = rgb(pal.lit), cMid = rgb(pal.mid), cSh = rgb(pal.shadow), cDp = rgb(pal.deep), cBn = rgb(pal.bounce), cRim = rgb(pal.rim), cHz = rgb(pal.haze), cSky = rgb(pal.sky || pal.haze);
    const macroW = def(o.macro, lerp(T.macro, 0.97, clamp(back * 2.5))), sharp = def(o.sharp, T.sharp), bounceK = def(o.bounceAmt, 0.32), rimK = def(o.rimAmt, 0.35 + 0.65 * back);
    const hazeAll = def(o.haze, 0), fade = def(o.fade, 0), fadeA = def(o.fadeAlpha, fade > 0 ? 0.55 : 0), ragged = def(o.ragged, T.ragged || 0);
    const ceil = !!o.ceiling, aoK = 1 / Math.max(1, h * 0.03), baseDark = ceil ? 0 : def(o.baseDark, 0.3) * (1 - back * 0.6), sOff = def(o.seed, 1) * 3.17;
    const lift = def(o.lift, 0), aoAmt = def(o.ao, def(T.ao, 0.3));
    // painted ramp (anime BG): three flat-ish tone planes — shade | half | light — separated by narrow,
    // brush-wobbled borders. Each billow's shadow side becomes a crisp crescent, crevices become scallop
    // lines, the lit faces stay calm. paint 0 = the old smooth "3D" ramp.
    const paint = clamp(def(o.paint, T.paint)), th1 = def(o.th1, T.th1), th2 = def(o.th2, T.th2), bw0 = def(o.edgeSoft, T.bw), air = def(o.air, T.air);
    const wob = new Float32Array(CW); for (let x = 0; x < CW; x++) wob[x] = N2(x * 0.018, sOff) * h * 0.012 + N2(x * 0.07, sOff + 5) * h * 0.004;
    const bs = 300 / Math.max(120, h); // brush texture scale follows the sprite size (same look at any size)
    for (let y = 1; y < CH - 1; y++) {
      const v = clamp((y - PAD) / h), vb = sstep(0.32, 1, v), vf = fade > 0 ? sstep(1 - fade, 1, v) : 0, vt = ceil ? v * 0.08 - 0.04 : (1 - v) * 0.07;
      for (let x = 1; x < CW - 1; x++) {
        const i = y * CW + x; const cov = COV[i]; if (cov <= 0.002) continue;
        let nx = NX[i], ny = NY[i], nz = NZ[i]; let nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        const gx = (Zm[i + 1] - Zm[i - 1]) * 0.5, gy = (Zm[i + CW] - Zm[i - CW]) * 0.5;
        let mx = -gx, my = -gy; nl = Math.sqrt(mx * mx + my * my + 1); mx /= nl; my /= nl; const mz = 1 / nl;
        let bx = nx + (mx - nx) * macroW, by = ny + (my - ny) * macroW, bz = nz + (mz - nz) * macroW;
        nl = Math.sqrt(bx * bx + by * by + bz * bz) || 1; bx /= nl; by /= nl; bz /= nl;
        let dl = (bx * Lx + by * Ly + bz * Lz) * 0.5;
        if (Cw) { const inn = clamp(Cw[i] * 1.7 - 0.7); dl = dl * (1 - inn * 0.9) - inn * 0.12 * back; } // backlight only gets through the thin rim
        let s = dl + 0.5 + lift + vt;
        const ao = clamp((Za[i] - Z[i]) * aoK);
        s -= ao * aoAmt + baseDark * vb + (SH ? SH[i] * castK : 0);
        // brush: a slow isotropic wobble moves the tone borders; a fine grain keeps them from looking ruled
        const br = N2(x * 0.021 * bs + sOff, y * 0.021 * bs), br2 = N2(x * 0.09 * bs + 3.3 + sOff, y * 0.09 * bs);
        s += br * 0.042 + br2 * 0.01;
        let R_, G_, B_;
        // smooth ramp (legacy look / storm softness)
        const s0 = s + ((s < 0.38 ? 0 : s > 0.6 ? 1 : sstep(0.38, 0.6, s)) - s) * sharp;
        let a0, a1, kk;
        if (s0 < 0.28) { a0 = cDp; a1 = cSh; kk = s0 / 0.28; } else if (s0 < 0.47) { a0 = cSh; a1 = cMid; kk = (s0 - 0.28) / 0.19; } else if (s0 < 0.64) { a0 = cMid; a1 = cLit; kk = (s0 - 0.47) / 0.17; } else { a0 = cLit; a1 = cHi; kk = (s0 - 0.64) / 0.22; }
        if (kk < 0) kk = 0; else if (kk > 1) kk = 1;
        R_ = a0[0] + (a1[0] - a0[0]) * kk; G_ = a0[1] + (a1[1] - a0[1]) * kk; B_ = a0[2] + (a1[2] - a0[2]) * kk;
        let lightP = s0 > 0.55 ? 1 : 0;
        if (paint > 0) {
          const bw = bw0 * (0.5 + 0.5 * (br2 + 1));
          let k1 = (s - th1 + bw) / (2 * bw); k1 = k1 <= 0 ? 0 : k1 >= 1 ? 1 : k1 * k1 * (3 - 2 * k1);
          let k2 = (s - th2 + bw) / (2 * bw); k2 = k2 <= 0 ? 0 : k2 >= 1 ? 1 : k2 * k2 * (3 - 2 * k2);
          let ks = (s - th1 + 0.36) / 0.36; ks = ks <= 0 ? 0 : ks >= 1 ? 1 : Math.sqrt(ks); // shade plane: deep crevices → shadow
          let kl = (s - th2) / 0.26; kl = kl <= 0 ? 0 : kl >= 1 ? 1 : kl;                    // light plane: lit → sun-struck
          const sR = cDp[0] + (cSh[0] - cDp[0]) * ks, sG = cDp[1] + (cSh[1] - cDp[1]) * ks, sB = cDp[2] + (cSh[2] - cDp[2]) * ks;
          const hR = sR + (cMid[0] - sR) * k1, hG = sG + (cMid[1] - sG) * k1, hB = sB + (cMid[2] - sB) * k1;
          const lR = cLit[0] + (cHi[0] - cLit[0]) * kl, lG = cLit[1] + (cHi[1] - cLit[1]) * kl, lB = cLit[2] + (cHi[2] - cLit[2]) * kl;
          const pR = hR + (lR - hR) * k2, pG = hG + (lG - hG) * k2, pB = hB + (lB - hB) * k2;
          R_ += (pR - R_) * paint; G_ += (pG - G_) * paint; B_ += (pB - B_) * paint; lightP = k2;
        }
        const bn = (by > 0 ? by : 0) * (1 - lightP) * bounceK * (0.4 + 0.6 * vb);
        if (bn > 0) { R_ += (cBn[0] - R_) * bn; G_ += (cBn[1] - G_) * bn; B_ += (cBn[2] - B_) * bn; }
        const e = 1 - Cb[i]; const edge = e > 0 ? (e * 2.2 > 1 ? 1 : e * 2.2) : 0;
        let a = cov;
        if (edge > 0) {
          const fc = nx * l2x + ny * l2y; const rim = edge * (fc > 0 ? fc : 0) * rimK;
          if (rim > 0) { R_ += (cRim[0] - R_) * rim; G_ += (cRim[1] - G_) * rim; B_ += (cRim[2] - B_) * rim; }
          // shade-side silhouette takes on the sky colour and thins out: the cloud breathes into the air
          const ea = edge * (1 - lightP) * air * (fc < 0 ? 0.6 - 0.4 * fc : 0.6);
          if (ea > 0) { R_ += (cSky[0] - R_) * ea * 0.55; G_ += (cSky[1] - G_) * ea * 0.55; B_ += (cSky[2] - B_) * ea * 0.55; a *= 1 - ea * 0.45; }
        }
        const hz = hazeAll + (1 - hazeAll) * vf * 0.85;
        if (hz > 0) { R_ += (cHz[0] - R_) * hz; G_ += (cHz[1] - G_) * hz; B_ += (cHz[2] - B_) * hz; }
        if (!ceil) { const be = baseC + wob[x] - (y + 0.5); a *= be + 0.5 > 1 ? 1 : be + 0.5 < 0 ? 0 : be + 0.5; }
        if (ragged > 0) { const ee = clamp((1 - Cb[i]) * 1.5 + vb * 0.4); if (ee > 0) { const nn = N2(x * 0.05 + sOff, y * 0.07) * 0.5 + 0.5; a *= 1 - ee * clamp(nn * 1.5 - 0.25) * ragged; } }
        if (fadeA > 0) a *= 1 - fadeA * vf;
        const j = i * 4; D[j] = R_; D[j + 1] = G_; D[j + 2] = B_; D[j + 3] = a * 255;
      }
    }
    c.putImageData(img, 0, 0);
  }

  /* L.cloudSprite(key, o) → cached canvas (w+120)×(h+120); cloud base at y = 60+h.
   * o: w,h,seed, type ('cumulus'|'tower'|'puff'|'flat'|'storm'), palette (see L.CLOUD_PAL) or colours
   *    lit/mid/shadow/rim/hi/deep/bounce/haze, light (2D angle toward the light, -PI/2 = above),
   *    lightZ (+ = lit from the front, - = backlit), haze (0..1), fade (bottom fraction fading into
   *    haze — use for clouds standing on the horizon), levels, soft, sharp, macro, ragged */
  L.cloudSprite = function (key, o = {}) {
    const w = Math.round(o.w || 600), h = Math.round(o.h || 260);
    return PV.cached('cloud:' + key + ':' + okey(o), w + PAD * 2, h + PAD * 2, (c, CW, CH) => {
      paintCloud(c, CW, CH, cloudSpheres(o, w, h), o, w, h);
    });
  };

  /* L.clouds(ctx, t, o) — drifting field of cloud sprites (smallest drawn first).
   * legacy o: seed,count,y0,y1 (sprite top range),minW,maxW,speed,alpha,colors{lit,mid,shadow,rim},scale
   * new o: type, palette, light, lightZ, sun {x,y} (lights each cloud from the sun; clouds near the sun
   *        become backlit), horizon (y; adds haze to low clouds), haze, aspect [min,max] */
  L.clouds = function (ctx, t, o = {}) {
    const seed = def(o.seed, 7), r = PV.rng(seed), n = def(o.count, 6), asp = o.aspect || (o.type === 'tower' ? [0.7, 1] : [0.32, 0.5]);
    const items = [];
    for (let i = 0; i < n; i++) {
      const w = lerp(def(o.minW, 300), def(o.maxW, 900), r()), h = w * lerp(asp[0], asp[1], r());
      items.push({ i, w, h, y: lerp(def(o.y0, 80), def(o.y1, 500), r()), xr: r(), vr: 0.6 + 0.8 * r(), ar: 0.94 + 0.06 * r() });
    }
    items.sort((a, b) => a.w - b.w);
    const s = def(o.scale, 1), sp = def(o.speed, 6), ranged = o.x0 !== undefined || o.x1 !== undefined;
    for (const c of items) {
      let haze = def(o.haze, 0);
      if (o.horizon !== undefined) { const gap = o.horizon - (c.y + (PAD + c.h) * s); haze = clamp(haze + def(o.hazeK, 0.5) * Math.pow(clamp(1 - gap / (o.horizon * 0.75)), 2)); }
      // legacy wrap (identical to the original library, so old compositions keep their layout):
      // each cloud loops over W + w + 200 and is visible ~90% of the time.  With x0/x1: loop inside that range.
      const span = ranged ? Math.max(1, def(o.x1, W) - def(o.x0, 0)) : W + c.w + 200;
      const off = ranged ? def(o.x0, 0) - (c.w * s) / 2 : -c.w - 100;
      let x = (((c.xr * span + t * sp * c.vr) % span) + span) % span + off;
      let light = o.light, lightZ = o.lightZ;
      if (o.sun) {
        const x0 = (((c.xr * span) % span) + span) % span + off;
        const ccx = x0 + (PAD + c.w / 2) * s, ccy = c.y + (PAD + c.h * 0.5) * s;
        light = Math.round(Math.atan2(o.sun.y - ccy, o.sun.x - ccx) * 5) / 5;
        const dd = Math.hypot(o.sun.x - ccx, o.sun.y - ccy) / (c.w * s);
        if (o.lightZ === undefined) lightZ = dd < 0.7 ? -0.5 : dd < 1.3 ? 0.1 : 0.42;
      }
      const so = Object.assign({ w: c.w, h: c.h, seed: seed * 100 + c.i, type: o.type, palette: o.palette, light, lightZ, haze: Math.round(haze * 20) / 20 }, o.colors || {});
      const spr = L.cloudSprite('f' + seed + '-' + c.i, so);
      ctx.globalAlpha = def(o.alpha, 1) * c.ar;
      ctx.drawImage(spr, x, c.y, spr.width * s, spr.height * s);
    }
    ctx.globalAlpha = 1;
  };

  // anvil (かなとこ雲) of a mature cumulonimbus: a flat fibrous shelf spreading downwind from the summit,
  // sun-struck on top, shaded blue underneath, frayed into cirrus at its far end.
  function anvilSprite(o, aw, ah, dir, pal) {
    return PV.cached('anvil:' + okey({ aw, ah, dir, s: o.seed, p: pal }), aw, ah, (c) => {
      const img = c.createImageData(aw, ah), P = img.data, sd = def(o.seed, 3) * 2.3;
      const cHi = rgb(pal.hi), cLit = rgb(pal.lit), cMid = rgb(pal.mid), cSh = rgb(pal.shadow), cSky = rgb(pal.sky || pal.haze);
      for (let x = 0; x < aw; x++) {
        let u = x / aw; if (dir < 0) u = 1 - u;
        const neck = Math.exp(-Math.pow((u - 0.18) / 0.09, 2)), prof = sstep(0.0, 0.22, u) * (1 - sstep(0.4, 1, u) * 0.85);
        const top = 0.26 + 0.05 * N2(u * 4 + sd, 0.5) - 0.1 * prof - 0.05 * neck, bot = top + prof * (0.42 + 0.08 * N2(u * 6, sd)) + neck * 0.42 + 0.04;
        for (let y = 0; y < ah; y++) {
          const v = y / ah; if (v < top - 0.06 || v > bot + 0.06) continue;
          const fib = N2(u * 2.2 + sd, v * 12) * 0.5 + 0.5, n2 = N2(u * 11 + 7, v * 7 + sd) * 0.5 + 0.5;
          let d = sstep(top - 0.05, top + 0.03, v + (n2 - 0.5) * 0.05) * (1 - sstep(bot - 0.06, bot + 0.05, v + (fib - 0.5) * 0.06));
          d *= (0.55 + 0.45 * sstep(0.2, 0.7, fib * (1 - u * 0.5) + (1 - u) * 0.4)) * (1 - sstep(0.8, 0.99, v)); if (d <= 0.01) continue;
          const k = clamp((v - top) / Math.max(0.02, bot - top)), lt = 1 - sstep(0.15, 0.75, k + (n2 - 0.5) * 0.2);
          let col = mix3(cSh, cMid, sstep(0.3, 0.42, lt)); col = mix3(col, mix3(cLit, cHi, lt), sstep(0.52, 0.6, lt));
          col = mix3(col, cSky, sstep(0.55, 1, u) * 0.35);
          const k4 = (y * aw + x) * 4; P[k4] = col[0]; P[k4 + 1] = col[1]; P[k4 + 2] = col[2]; P[k4 + 3] = d * 255 * (1 - sstep(0.7, 1, u) * 0.6);
        }
      }
      c.putImageData(img, 0, 0);
    });
  }
  const cbTop = {};
  /* L.cumulonimbus(ctx, t, o) — 入道雲: a towering cloud standing on the horizon.
   * o: x (centre), base (y of the cloud base / horizon), w(1100), h(760), seed, palette('summer'), colors,
   *    light(-2.3), lightZ(0.5), haze(0), fade(0.3: base dissolving into the horizon haze), drift(px/s), scale, alpha,
   *    anvil (0..1: flat anvil top spreading downwind — a mature, threatening thunderhead), anvilDir (1 = right) */
  L.cumulonimbus = function (ctx, t, o = {}) {
    const w = def(o.w, 1100), h = def(o.h, 760), s = def(o.scale, 1);
    const so = Object.assign({ type: def(o.type, 'tower'), w, h, seed: def(o.seed, 3), palette: o.palette || 'summer', light: def(o.light, -2.3), lightZ: def(o.lightZ, 0.5), haze: def(o.haze, 0), fade: def(o.fade, 0.3), levels: o.levels }, o.colors || {});
    const spr = L.cloudSprite('cb', so);
    const x = def(o.x, W * 0.6) + def(o.drift, 0) * t, base = def(o.base, H * 0.55), sx = x - (spr.width * s) / 2, sy = base - (h + PAD) * s;
    ctx.save(); ctx.globalAlpha = def(o.alpha, 1);
    ctx.drawImage(spr, sx, sy, spr.width * s, spr.height * s);
    const an = def(o.anvil, 0);
    if (an > 0) {
      const k = okey(so); let tp = cbTop[k];
      if (!tp) { // locate the summit once: first opaque rows of the sprite
        const c2 = spr.getContext('2d'), rows = c2.getImageData(0, 0, spr.width, Math.min(spr.height, PAD + Math.round(h * 0.25))).data; let found = -1, sum = 0, n = 0;
        for (let yy = 0; yy * spr.width * 4 < rows.length && n < 40; yy++) for (let xx = 0; xx < spr.width; xx++) if (rows[(yy * spr.width + xx) * 4 + 3] > 140) { if (found < 0) found = yy; sum += xx; n++; }
        tp = cbTop[k] = { x: n ? sum / n : spr.width / 2, y: found < 0 ? PAD : found };
      }
      const dir = def(o.anvilDir, 1), aw = Math.round(w * (0.8 + 0.72 * an)), ah = Math.round(h * (0.22 + 0.12 * an)), pal = cloudPalette(so);
      const asp = anvilSprite(so, aw, ah, dir, pal), ax = sx + tp.x * s - (dir > 0 ? aw * 0.18 : aw * 0.82) * s, ay = sy + tp.y * s - ah * 0.34 * s;
      ctx.drawImage(asp, ax, ay, aw * s, ah * s);
    }
    ctx.restore();
  };

  /* ---- noise-band clouds: streaks / cirrus / decks / mackerel (うろこ雲) */
  function bandSprite(o) {
    const w = Math.round(def(o.w, W)), h = Math.round(def(o.h, 360)), res = def(o.res, 0.5);
    const sw = Math.max(8, Math.round(w * res)), sh = Math.max(8, Math.round(h * res));
    return PV.cached('band:' + okey(o), sw, sh, (c) => {
      const kind = o.kind || 'streak', seed = def(o.seed, 1) * 7.31, pal = cloudPalette(Object.assign({}, o, { palette: o.palette || 'day' }));
      const cir = kind === 'cirrus', cov = def(o.coverage, 0.5), soft = def(o.softness, cir ? 0.45 : 0.3);
      const sx = def(o.scaleX, cir ? 820 : kind === 'deck' ? 520 : 600) * res, sy = def(o.scaleY, cir ? 70 : kind === 'deck' ? 150 : 75) * res;
      const Rr = Math.max(1, sw / sx) / TAU; const D = new Float32Array(sw * sh);
      const env0 = def(o.envTop, kind === 'deck' ? 0 : 0.3), env1 = def(o.envBottom, kind === 'deck' ? 0.55 : 0.3);
      for (let y = 0; y < sh; y++) {
        const v = y / (sh - 1), env = (env0 > 0 ? sstep(0, env0, v) : 1) * (env1 > 0 ? 1 - sstep(1 - env1, 1, v) : 1);
        for (let x = 0; x < sw; x++) {
          if (env <= 0) { D[y * sw + x] = 0; continue; }
          const an = (x / sw) * TAU, px = Math.cos(an) * Rr, pz = Math.sin(an) * Rr, py = y / sy;
          let d;
          if (cir) { // brushed wisps (巻雲): soft elongated patches combed into fine fibres, meandering
            const bend = N3(px * 0.6 + seed, py * 0.12, pz * 0.6) * 1.5 + N3(px * 1.8, py * 0.35 + seed * 2, pz * 1.8) * 0.35;
            const yy = py + bend;
            const body = fbm3(px * 0.95 + 7, yy * 0.55 + seed, pz * 0.95, 3) * 0.5 + 0.5;
            const patch = sstep(1 - cov - 0.06, 1 - cov + 0.24, body);
            if (patch <= 0.001) { D[y * sw + x] = 0; continue; }
            const f1 = 1 - Math.abs(N3(px * 2.4, yy * 5.5 + seed, pz * 2.4)), f2 = 1 - Math.abs(N3(px * 4.6 + 3, yy * 10.5 + seed * 1.7, pz * 4.6));
            const fib = 0.6 * f1 * f1 + 0.4 * f2 * f2 * f2;
            D[y * sw + x] = clamp(patch * (0.28 + 0.72 * fib) * (0.75 + 0.25 * patch)) * env; continue;
          } else {
            const wq = N3(px * 1.3 + seed, py * 0.7, pz * 1.3) * 0.5;
            d = fbm3(px + wq, py + seed + wq * 0.5, pz, 5) * 0.5 + 0.5;
          }
          D[y * sw + x] = clamp((d - (1 - cov)) / soft) * env;
        }
      }
      const la = def(o.light, -Math.PI / 2), st = Math.max(1, Math.round(4 * res + 1)), ox = Math.round(Math.cos(la) * st), oy = Math.round(Math.sin(la) * st);
      const img = c.createImageData(sw, sh), P = img.data, alpha = def(o.alphaK, 1), thick = def(o.thick, cir ? 0.1 : 0.4), gain = def(o.gain, 1.5), b0 = def(o.base, 0.6);
      const cHi = rgb(pal.hi), cLit = rgb(pal.lit), cMid = rgb(pal.mid), cSh = rgb(pal.shadow), cDp = rgb(pal.deep);
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
        const i = y * sw + x, d = D[i]; if (d <= 0.003) continue;
        const xx = (x + ox + sw) % sw, yy = Math.max(0, Math.min(sh - 1, y + oy));
        const toward = D[yy * sw + xx];
        let s = clamp(b0 + (d - toward) * gain - d * thick + N2(x * 0.05, y * 0.05 + seed) * 0.04);
        let a0, a1, kk;
        if (s < 0.3) { a0 = cDp; a1 = cSh; kk = s / 0.3; } else if (s < 0.5) { a0 = cSh; a1 = cMid; kk = (s - 0.3) / 0.2; } else if (s < 0.7) { a0 = cMid; a1 = cLit; kk = (s - 0.5) / 0.2; } else { a0 = cLit; a1 = cHi; kk = (s - 0.7) / 0.3; }
        const j = i * 4; P[j] = a0[0] + (a1[0] - a0[0]) * kk; P[j + 1] = a0[1] + (a1[1] - a0[1]) * kk; P[j + 2] = a0[2] + (a1[2] - a0[2]) * kk;
        P[j + 3] = Math.pow(d, cir ? 1.1 : 0.8) * 255 * alpha;
      }
      c.putImageData(img, 0, 0);
    });
  }
  function mackerelSprite(o, phase) {
    const w = Math.round(def(o.w, W)), h = Math.round(def(o.h, 520)), res = def(o.res, 0.7);
    const sw = Math.round(w * res), sh = Math.round(h * res);
    return PV.cached('mack2:' + okey(o) + ':' + (phase || 0), sw, sh, (c) => {
      // うろこ雲/ひつじ雲: rows of small rounded cloudlets in perspective. Each cloudlet is a tiny painted
      // cumulus — sunlit cap, a crisp blue-grey underside — with a lumpy rim; rows wave and merge.
      const pal = cloudPalette(Object.assign({}, o, { palette: o.palette || 'autumn' })), seed = def(o.seed, 1);
      const cell = def(o.cell, 26) * res, persp = def(o.perspective, 0.78), cov = def(o.coverage, 0.55), ph = (phase || 0) * 0.35;
      const la = def(o.light, -2.5), l2x = Math.cos(la), l2y = Math.sin(la), Lx = l2x * 0.62, Ly = l2y * 0.62, Lz = 0.78;
      const img = c.createImageData(sw, sh), P = img.data, aK = def(o.alphaK, 0.92);
      const cHi = rgb(pal.hi), cLit = rgb(pal.lit), cMid = rgb(pal.mid), cSh = rgb(pal.shadow), cSky = rgb(pal.sky || pal.haze);
      const hs = (i, j, s) => PV.rand1((i * 7919 + j * 104729 + s * 31) | 0, seed);
      for (let y = 0; y < sh; y++) {
        const v = y / sh, dep = 1 / (1 - persp * v), py0 = ((-Math.log(1 - persp * v) / persp) * sh) / cell;
        const fadeV = sstep(0, 0.08, v) * (1 - sstep(0.8, 1, v) * 0.85), far = sstep(0.45, 1, v); // far rows: smaller, softer, hazier
        for (let x = 0; x < sw; x++) {
          const px0 = ((x - sw / 2) * dep) / (cell * 1.5);
          const m = PV.fbm2(px0 * 0.045 + seed * 1.7 + ph * 0.2, py0 * 0.08 + px0 * 0.02, 3) * 0.5 + 0.5;
          const band = 0.5 + 0.5 * Math.sin(py0 * 0.6 + px0 * 0.1 + N2(px0 * 0.04, py0 * 0.04 + seed) * 2.6);
          const mask = sstep(1 - cov - 0.14, 1 - cov + 0.14, m * 0.78 + band * 0.27) * fadeV;
          if (mask <= 0.002) continue;
          const px = px0 + N2(px0 * 0.11 + 40, py0 * 0.11 + ph) * 0.8 + 500, py = py0 + N2(px0 * 0.11, py0 * 0.11 + seed + ph) * 0.6 + Math.sin(px0 * 0.16 + seed) * 0.28;
          const ix = Math.floor(px), iy = Math.floor(py); let best = 0, bx = 0, by = 0, bz = 1;
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
            const cx = ix + i, cy = iy + j, ofs = cy & 1 ? 0.5 : 0;
            const fx = cx + ofs + 0.5 + (hs(cx, cy, 1) - 0.5) * 0.7, fy = cy + 0.5 + (hs(cx, cy, 2) - 0.5) * 0.5;
            const rad = (0.24 + 0.34 * hs(cx, cy, 3) * hs(cx, cy, 7)) * (0.55 + 0.6 * mask), asp = 1.2 + 0.6 * hs(cx, cy, 4);
            const dx = (px - fx) / asp, dy = py - fy, d = Math.sqrt(dx * dx + dy * dy); if (d >= rad * 1.12) continue;
            const an = Math.atan2(dy, dx), lump = 1 + 0.08 * Math.sin(an * 5 + hs(cx, cy, 5) * 9) + 0.035 * Math.sin(an * 9 + hs(cx, cy, 6) * 9);
            const r2 = rad * lump; if (d >= r2) continue;
            const q = d / r2, edgeW = 0.2 + 0.22 * far, dens = clamp((1 - q) / edgeW);
            if (dens > best) { best = dens; const nx = dx / r2, ny = dy / r2; bx = nx; by = ny; bz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)); }
          }
          if (best <= 0) continue;
          let s = bx * Lx + by * Ly + bz * Lz;                       // light on the little dome
          s = s * 0.5 + 0.5 - (by > 0 ? by * 0.32 : 0) + N2(x * 0.05, y * 0.05) * 0.04;
          const k1 = sstep(0.46, 0.52, s), k2 = sstep(0.6, 0.66, s);
          let R_ = cSh[0] + (cMid[0] - cSh[0]) * k1, G_ = cSh[1] + (cMid[1] - cSh[1]) * k1, B_ = cSh[2] + (cMid[2] - cSh[2]) * k1;
          const kl = clamp((s - 0.62) / 0.25), lR = cLit[0] + (cHi[0] - cLit[0]) * kl, lG = cLit[1] + (cHi[1] - cLit[1]) * kl, lB = cLit[2] + (cHi[2] - cLit[2]) * kl;
          R_ += (lR - R_) * k2; G_ += (lG - G_) * k2; B_ += (lB - B_) * k2;
          const hz = far * 0.55 + (1 - best) * 0.25;                 // distance + soft rim fade into the sky colour
          R_ += (cSky[0] - R_) * hz * 0.5; G_ += (cSky[1] - G_) * hz * 0.5; B_ += (cSky[2] - B_) * hz * 0.5;
          const k4 = (y * sw + x) * 4; P[k4] = R_; P[k4 + 1] = G_; P[k4 + 2] = B_;
          P[k4 + 3] = Math.min(1, best * 1.15) * Math.min(1, mask * 1.6) * (1 - far * 0.35) * 255 * aK;
        }
      }
      c.putImageData(img, 0, 0);
    });
  }
  /* L.cloudBand(ctx, t, o) — noise-painted cloud band drawn into the rect (x,y,w,h), drifting & tiling in x.
   * o.kind: 'streak' (stratocumulus/altostratus streaks), 'cirrus' (brushed filaments), 'deck' (overcast
   *   layer, dense at the top), 'mackerel' (うろこ雲 in perspective; static, slow translate)
   * o: seed, coverage(0..1), softness, scaleX, scaleY (feature size px), palette/colours, light (angle toward
   *   the light: -PI/2 above, PI/2 below = sunset under-lighting), gain, thick, res(0.5), speed(px/s), alpha, mode */
  L.cloudBand = function (ctx, t, o = {}) {
    const x = def(o.x, 0), y = def(o.y, 0), w = def(o.w, W), h = def(o.h, 360), sp = def(o.speed, 4);
    ctx.save(); ctx.globalAlpha = def(o.alpha, 1); if (o.mode) ctx.globalCompositeOperation = o.mode;
    if (o.kind === 'mackerel') {
      const mo = Object.assign({}, o, { w: w + 160, x: 0, y: 0, alpha: 1, speed: 0, morph: 0, mode: 0 }), dx = x - 80 + ((((sp * t) % 80) + 80) % 80);
      const spr = mackerelSprite(mo, 0), mph = def(o.morph, 0);
      if (mph > 0) { // slow evolution: cross-fade between two slightly different states of the same field
        const u = 0.5 - 0.5 * Math.cos(t * mph * 0.25), spr2 = mackerelSprite(mo, 1);
        ctx.globalAlpha = def(o.alpha, 1) * (1 - u * 0.5); ctx.drawImage(spr, dx, y, w + 160, h);
        ctx.globalAlpha = def(o.alpha, 1) * u; ctx.drawImage(spr2, dx, y, w + 160, h);
      } else ctx.drawImage(spr, dx, y, w + 160, h);
    } else {
      const spr = bandSprite(o); const off = (((sp * t) % w) + w) % w;
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.drawImage(spr, x + off - w, y, w, h); ctx.drawImage(spr, x + off, y, w, h);
    }
    ctx.restore();
  };

  /* ---- storm deck (嵐の暗雲): a far, hazy noise ceiling + rows of heavy hanging cloud masses.
   * The hanging rows are painted with the same sphere-union cloud painter as the cumulus, upside down: a
   * solid top, cauliflower lumps bulging downward, lit from below by the faint horizon glow — so the
   * storm has mass instead of smoke.  Every row tiles horizontally (wrap-painted) and drifts at its own
   * speed (parallax).  A lightning-lit variant of each layer is cross-faded in around the flash point. */
  const stormCache = {}; let stormKeys = [];
  function stormDeck(o) {
    const h = Math.round(def(o.h, 640)), res = def(o.res, 0.5), sw = Math.round(W * res), sh = Math.round(h * res);
    const key = okey({ h, res, seed: o.seed, colors: o.colors, base: o.base, cells: o.cells });
    if (stormCache[key]) return stormCache[key];
    const seed = def(o.seed, 1) * 3.71, Rr = W / 560 / TAU, baseF = def(o.base, 0.78);
    const C = Object.assign({ top: '#0a0e1c', dark: '#141a2e', mid: '#273150', light: '#3c4769', edge: '#6e7ca6', haze: '#323d5c', fl: '#eef3ff', flMid: '#97a9d4', flDark: '#3a4670' }, o.colors || {});
    // far ceiling: low-contrast noise deck with a ragged base, hazy (it sits behind the hanging rows)
    const D = new Float32Array(sw * sh), BL = new Float32Array(sw);
    for (let x = 0; x < sw; x++) { const an = (x / sw) * TAU; BL[x] = baseF + fbm3(Math.cos(an) * Rr * 2.2, Math.sin(an) * Rr * 2.2, seed + 9, 3) * 0.16; }
    for (let y = 0; y < sh; y++) {
      const v = y / sh, Y = (y / res) / 260;
      for (let x = 0; x < sw; x++) {
        const an = (x / sw) * TAU, px = Math.cos(an) * Rr, pz = Math.sin(an) * Rr;
        const n = fbm3(px * 0.8, Y * 0.8 + seed, pz * 0.8, 4) * 0.5 + 0.5, bl = BL[x], env = 1 - sstep(bl - 0.12, bl + 0.04, v);
        D[y * sw + x] = clamp((0.45 + n * 0.9 - v * 0.15) * env + (1 - sstep(0, bl * 0.6, v)) * 0.4);
      }
    }
    const DB = blurF(D, sw, sh, Math.max(2, 5 * res));
    const mkBack = (lit) => {
      const cv = PV.makeCanvas(sw, sh), c = cv.ctx, img = c.createImageData(sw, sh), P = img.data;
      const cT = rgb(C.top), cD = rgb(C.dark), cM = rgb(lit ? C.flDark : C.mid), cE = rgb(lit ? C.flMid : mixHex(C.mid, C.haze, 0.5)), st = Math.max(3, Math.round(16 * res));
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
        const i = y * sw + x, d = D[i]; if (d <= 0.004) continue;
        const under = clamp((DB[i] - DB[Math.min(sh - 1, y + st) * sw + x]) * 3.5), v = y / sh;
        let col = lit ? mix3(cM, cD, clamp(d * 0.6)) : mix3(mix3(cD, cT, clamp(1 - v * 1.4)), cM, clamp(v * 1.2 - 0.25) * 0.6 + (DB[i] - d) * 0.8);
        col = mix3(col, cE, under * 0.6);
        const k4 = i * 4; P[k4] = col[0]; P[k4 + 1] = col[1]; P[k4 + 2] = col[2]; P[k4 + 3] = clamp(d * 1.8) * 255;
      }
      c.putImageData(img, 0, 0); return cv.canvas;
    };
    // storm cells: heavy dark cumulus masses standing in the band under the ceiling, painted by the cloud
    // painter (real cauliflower relief) in a night-storm palette, each with a lightning-lit twin sprite of
    // identical geometry for the flash cross-fade.
    const R = PV.rng((def(o.seed, 1) * 4241 + 7) >>> 0), nM = def(o.cells, 4), cells = [];
    const darkP = { hi: mixHex(C.light, C.edge, 0.3), lit: mixHex(C.light, C.mid, 0.35), mid: C.mid, shadow: mixHex(C.mid, C.dark, 0.55), deep: C.top, bounce: C.mid, rim: mixHex(C.edge, C.light, 0.3), sky: C.dark, haze: C.haze };
    const litP = { hi: C.fl, lit: mixHex(C.fl, C.flMid, 0.3), mid: C.flMid, shadow: mixHex(C.flMid, C.flDark, 0.55), deep: C.flDark, bounce: C.flMid, rim: '#ffffff', sky: C.flDark, haze: C.flMid };
    for (let i = 0; i < nM; i++) {
      const cw = (520 + 520 * R()) * (h / 640), ch = cw * (0.42 + 0.2 * R()), base = h * baseF * (0.86 + 0.14 * R()), cr = 0.6; // painted at 60% (soft night masses)
      const so = { w: cw * cr, h: ch * cr, seed: def(o.seed, 1) * 31 + i, type: 'cumulus', light: -Math.PI / 2 - 0.3 + 0.6 * R(), lightZ: 0.12, haze: 0.12 * (1 - i / nM), baseDark: 0.5, fade: 0.3, fadeAlpha: 0.45, air: 0.45, ragged: 0.3 };
      cells.push({ x: ((i + 0.5 * R()) / nM) * W, base, cw, ch, cr, dark: L.cloudSprite('stormcell', Object.assign({}, so, darkP)), lit: L.cloudSprite('stormcellL', Object.assign({}, so, litP, { lightZ: 0.6 })) });
    }
    // low scud: ragged fragments under the deck (fast)
    const scud = (() => {
      const cv = PV.makeCanvas(sw, sh), c = cv.ctx, img = c.createImageData(sw, sh), P = img.data, cS = rgb(C.dark), cE = rgb(C.mid);
      for (let y = 0; y < sh; y++) {
        const v = y / sh, env = sstep(0.5 * baseF / 0.78, 0.72 * baseF / 0.78, v) * (1 - sstep(0.9, 1, v));
        if (env <= 0) continue;
        for (let x = 0; x < sw; x++) {
          const an = (x / sw) * TAU, px = Math.cos(an) * Rr * 1.6, pz = Math.sin(an) * Rr * 1.6;
          const nn = fbm3(px, (y / res) / 60 + seed * 2, pz, 4) * 0.5 + 0.5;
          const d = clamp((nn - 0.58) / 0.16) * env; if (d <= 0) continue;
          const k4 = (y * sw + x) * 4, col = mix3(cE, cS, clamp(d * 1.3));
          P[k4] = col[0]; P[k4 + 1] = col[1]; P[k4 + 2] = col[2]; P[k4 + 3] = d * 200;
        }
      }
      c.putImageData(img, 0, 0); return cv.canvas;
    })();
    const oh = Math.min(sh, Math.ceil(sh * baseF * 0.62) + 2), backD = mkBack(false), backL = mkBack(true);
    const ov = (src) => { const cv = PV.makeCanvas(sw, oh), c = cv.ctx; c.drawImage(src, 0, 0); c.globalCompositeOperation = 'destination-in'; const g = c.createLinearGradient(0, 0, 0, oh); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, sw, oh); return cv.canvas; };
    const sy0 = Math.floor(sh * 0.45 * baseF / 0.78), scudC = PV.makeCanvas(sw, sh - sy0); scudC.ctx.drawImage(scud, 0, -sy0); // only the band where scud exists
    stormKeys.push(key); if (stormKeys.length > 4) delete stormCache[stormKeys.shift()];
    return (stormCache[key] = { back: backD, backLit: backL, over: ov(backD), overLit: ov(backL), oh, cells, scud: scudC.canvas, scudY: sy0, sw, sh, h, res });
  }
  /* L.stormClouds(ctx, t, o) — heavy storm sky (嵐の暗雲): a far hazy ceiling + a band of dark storm cells
   * with real cauliflower relief, drifting with parallax; lightning lights them from inside.
   * o: y(0), h(640: deck height), base (0..1: where the cells' bases sit, 0.78), cells (4), seed,
   *    speed(14 px/s: cells; the ceiling drifts at 35%), scud(true: low fast fragments),
   *    flash (0..1 lightning illumination), flashX, flashY, flashR(760),
   *    colors{top,dark,mid,light,edge,haze,fl,flMid,flDark}, alpha */
  L.stormClouds = function (ctx, t, o = {}) {
    const S = stormDeck(o), y = def(o.y, 0), h = S.h, sp = def(o.speed, 14), A = def(o.alpha, 1), fl = clamp(def(o.flash, 0)), q = S.res;
    const wrap = (v) => ((v % W) + W) % W, offB = wrap(sp * 0.35 * t);
    const cellPos = (c) => { const x = wrap(c.x + sp * t) - c.cw / 2; return [x, x - W]; };
    const drawCells = (g, k, key) => { // k = 1 → screen, k = q → the flash buffer (deck-local)
      for (const c of S.cells) for (const x of cellPos(c)) {
        const spr = c[key], sw2 = spr.width / c.cr, sh2 = spr.height / c.cr, px = x - PAD / c.cr, py = c.base - c.ch - PAD / c.cr; // deck-local
        if (px > W || px + sw2 < 0) continue;
        g.drawImage(spr, px * k, (k === 1 ? y : 0) + py * k, sw2 * k, sh2 * k);
      }
    };
    ctx.save(); ctx.globalAlpha = A;
    ctx.drawImage(S.back, offB - W, y, W, h); ctx.drawImage(S.back, offB, y, W, h);
    drawCells(ctx, 1, 'dark');
    ctx.drawImage(S.over, offB - W, y, W, S.oh / q); ctx.drawImage(S.over, offB, y, W, S.oh / q);
    if (fl > 0.002) {
      const b = PV.buffer('atm:stormflash', S.sw, S.sh), bc = b.ctx; bc.clearRect(0, 0, S.sw, S.sh);
      bc.drawImage(S.backLit, (offB - W) * q, 0, S.sw, S.sh); bc.drawImage(S.backLit, offB * q, 0, S.sw, S.sh);
      drawCells(bc, q, 'lit');
      bc.drawImage(S.overLit, (offB - W) * q, 0, S.sw, S.oh); bc.drawImage(S.overLit, offB * q, 0, S.sw, S.oh);
      const fx = def(o.flashX, W / 2) * q, fy = (def(o.flashY, h * 0.4) - y) * q, fr = def(o.flashR, 760) * q;
      bc.globalCompositeOperation = 'destination-in';
      const g = bc.createRadialGradient(fx, fy, 0, fx, fy, fr); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
      bc.fillStyle = g; bc.fillRect(0, 0, S.sw, S.sh); bc.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = A * fl; ctx.drawImage(b.canvas, 0, y, W, h);
    }
    if (o.scud !== false) {
      const off2 = wrap(sp * 2.2 * t); ctx.globalAlpha = A * (0.85 - 0.4 * fl);
      const sy = y + S.scudY / q, shh = S.scud.height / q; ctx.drawImage(S.scud, off2 - W, sy, W, shh); ctx.drawImage(S.scud, off2, sy, W, shh);
    }
    ctx.restore();
  };

  // thin streaky haze bands (legacy signature). o: seed,count,y0,y1,speed,color,alpha,mode
  L.haze = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 3), col = o.color || '#ffffff';
    const spr = PV.cached('atm:haze:' + col, 256, 64, (c) => {
      c.translate(128, 32); c.scale(1, 0.25); const g = c.createRadialGradient(0, 0, 0, 0, 0, 128); const k = rgb(col);
      g.addColorStop(0, rgbaS(k, 1)); g.addColorStop(0.4, rgbaS(k, 0.55)); g.addColorStop(1, rgbaS(k, 0)); c.fillStyle = g; c.fillRect(-128, -128, 256, 256);
    });
    ctx.save(); ctx.globalCompositeOperation = o.mode || 'screen';
    for (let i = 0; i < (o.count || 7); i++) {
      const y = lerp(def(o.y0, 100), def(o.y1, 450), r()), w = lerp(400, 1400, r()), h = lerp(8, 40, r());
      const x = (((r() * (W + w) + t * def(o.speed, 4)) % (W + w)) + (W + w)) % (W + w) - w;
      ctx.globalAlpha = def(o.alpha, 0.25) * (0.5 + r() * 0.5); ctx.drawImage(spr, x, y - h * 1.6, w, h * 3.2);
    }
    ctx.restore();
  };

  /* ========================================================= light & glow */
  L.glow = function (ctx, x, y, r, color = '#fff6e0', a = 0.8, mode = 'screen') {
    ctx.save(); ctx.globalCompositeOperation = mode;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, PV.rgba(color, a)); g.addColorStop(0.25, PV.rgba(color, a * 0.45)); g.addColorStop(1, PV.rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  };
  /* L.godRays(ctx, t, o) — soft light shafts (painted at 1/4 res → naturally soft edges).
   * o: x,y (origin),angle (rad, ray direction),spread,count,length,width,flare,color,alpha,seed,jitter,flicker,mode */
  L.godRays = function (ctx, t, o) {
    const q = 0.25, b = PV.buffer('atm:rays', W * q, H * q), c = b.ctx; c.clearRect(0, 0, W * q, H * q);
    c.setTransform(q, 0, 0, q, 0, 0); c.globalCompositeOperation = 'lighter';
    const r = PV.rng(o.seed || 5), col = rgb(o.color || '#fff4d6');
    for (let i = 0; i < (o.count || 7); i++) {
      const a = o.angle + (r() - 0.5) * (o.spread || 0.5);
      const len = (o.length || 1400) * (0.7 + 0.5 * r()), w0 = (o.width || 120) * (0.4 + r()), w1 = w0 * (o.flare || 2.4);
      const flick = 0.65 + 0.35 * (0.5 + 0.5 * N2(i * 3.1, t * (o.flicker || 0.25)));
      const al = (o.alpha || 0.22) * flick * (0.5 + 0.5 * r());
      const jr = (r() - 0.5) * (o.jitter || 200), ox = o.x + Math.cos(a + Math.PI / 2) * jr, oy = o.y + Math.sin(a + Math.PI / 2) * jr;
      const ex = ox + Math.cos(a) * len, ey = oy + Math.sin(a) * len, nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
      const g = c.createLinearGradient(ox, oy, ex, ey); g.addColorStop(0, rgbaS(col, al)); g.addColorStop(0.35, rgbaS(col, al * 0.7)); g.addColorStop(1, rgbaS(col, 0));
      c.fillStyle = g; c.beginPath();
      c.moveTo(ox + (nx * w0) / 2, oy + (ny * w0) / 2); c.lineTo(ex + (nx * w1) / 2, ey + (ny * w1) / 2); c.lineTo(ex - (nx * w1) / 2, ey - (ny * w1) / 2); c.lineTo(ox - (nx * w0) / 2, oy - (ny * w0) / 2); c.closePath(); c.fill();
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over';
    const soft = blurLow(b.canvas, 'atm:rays2', def(o.blur, 2.5));
    ctx.save(); ctx.globalCompositeOperation = o.mode || 'screen'; ctx.drawImage(soft, 0, 0, W, H); ctx.restore();
  };
  // floating dust motes / pollen in light. o: seed,count,x0,y0,x1,y1,color,size,alpha,drift,vx,vy,mask(x,y)->0..1
  L.dust = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 11); const spr = dotSprite(o.color || '#fff5df');
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const x0 = o.x0 || 0, y0 = o.y0 || 0, x1 = o.x1 || W, y1 = o.y1 || H;
    for (let i = 0; i < (o.count || 80); i++) {
      const bx = lerp(x0, x1, r()), by = lerp(y0, y1, r()), ph = r() * 100, sz = (o.size || 3) * (0.3 + r() * 1.2), tws = 1 + r() * 2;
      const x = bx + N2(ph, t * 0.08) * (o.drift || 60) + t * def(o.vx, 4), y = by + N2(ph + 50, t * 0.08) * (o.drift || 60) + t * def(o.vy, -3);
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * tws + ph));
      const a = (o.alpha || 0.7) * tw * (o.mask ? o.mask(x, y) : 1); if (a < 0.01) continue;
      ctx.globalAlpha = Math.min(1, a); drawDot(ctx, spr, x, y, sz * 2.4);
    }
    ctx.restore();
  };
  // soft bokeh discs with a brighter rim. o: seed,count,colors[],rmin,rmax,x0,y0,x1,y1,alpha,wobble,vx,mode
  L.bokeh = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 21); ctx.save(); ctx.globalCompositeOperation = o.mode || 'screen';
    const cols = o.colors || ['#ffd9a0', '#ffb98a', '#fff2d0'];
    for (let i = 0; i < (o.count || 40); i++) {
      const x = lerp(def(o.x0, 0), def(o.x1, W), r()) + Math.sin(t * 0.3 + i) * def(o.wobble, 6) + t * (o.vx || 0);
      const y = lerp(def(o.y0, 0), def(o.y1, H), r()) + Math.cos(t * 0.27 + i * 1.3) * def(o.wobble, 6);
      const rad = lerp(o.rmin || 10, o.rmax || 50, r()), col = cols[Math.floor(r() * cols.length)];
      const a = (o.alpha || 0.35) * (0.4 + 0.6 * r()) * (0.75 + 0.25 * Math.sin(t * 0.8 + i * 2.1));
      ctx.globalAlpha = Math.min(1, a); drawDot(ctx, dotSprite(col, 'disc'), x, y, rad);
    }
    ctx.restore();
  };
  // lens flare along the line from (x,y) through screen centre
  L.flare = function (ctx, x, y, k = 1, color = '#ffe6b8') {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    L.glow(ctx, x, y, 260 * k, color, 0.5 * k);
    const c = rgb(color);
    let g = ctx.createLinearGradient(x - 1000 * k, y, x + 1000 * k, y); g.addColorStop(0, rgbaS(c, 0)); g.addColorStop(0.5, rgbaS(c, 0.32 * k)); g.addColorStop(1, rgbaS(c, 0));
    ctx.fillStyle = g; ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.006); ctx.beginPath(); ctx.arc(0, 0, 1000 * k, 0, TAU); ctx.restore(); ctx.fill();
    const cx = W / 2, cy = H / 2;
    const ghosts = [[0.22, 18, '#ffd7a8', 'hard'], [0.4, 34, '#a9d4ff', 'disc'], [0.62, 64, '#ffcf9a', 'disc'], [0.85, 14, '#ffffff', 'hard'], [1.15, 46, '#c8a8ff', 'disc'], [1.4, 26, '#9affd8', 'disc'], [1.7, 110, '#ffd9a0', 'disc']];
    for (const [f, rad, col, kind] of ghosts) {
      const gx = x + (cx - x) * f * 2, gy = y + (cy - y) * f * 2;
      ctx.globalAlpha = 0.16 * k; drawDot(ctx, dotSprite(col, kind), gx, gy, rad * k);
    }
    ctx.globalAlpha = 0.14 * k; const rr = 330 * k, cx2 = x + (cx - x) * 2, cy2 = y + (cy - y) * 2;
    g = ctx.createRadialGradient(cx2, cy2, rr * 0.86, cx2, cy2, rr);
    g.addColorStop(0, 'rgba(120,170,255,0)'); g.addColorStop(0.4, 'rgba(140,200,255,0.6)'); g.addColorStop(0.6, 'rgba(255,240,200,0.6)'); g.addColorStop(0.8, 'rgba(255,170,140,0.5)'); g.addColorStop(1, 'rgba(255,150,130,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx2, cy2, rr, 0, TAU); ctx.fill();
    ctx.restore();
  };

  /* ================================================================ weather */
  // rain streaks. o: seed,count,angle(rad from vertical),speed(px/s),len,color,alpha,width,x0..y1
  L.rain = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 31); const ang = o.angle === undefined ? 0.18 : o.angle; const sp = o.speed || 2200;
    const vx = Math.sin(ang) * sp, vy = Math.cos(ang) * sp; const x0 = o.x0 || -200, x1 = o.x1 || W + 200, y0 = o.y0 || -100, y1 = o.y1 || H + 100;
    const col = rgb(o.color || '#cfe3ff'); ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < (o.count || 500); i++) {
      const depth = 0.35 + 0.65 * r(); const len = (o.len || 90) * depth; const off = r();
      const span = (y1 - y0) + len; const yy = ((off * span + t * vy * depth) % span) + y0 - len;
      const xx = lerp(x0, x1, r()) + (t * vx * depth) % (x1 - x0); const x = ((xx - x0) % (x1 - x0) + (x1 - x0)) % (x1 - x0) + x0;
      const a = (o.alpha || 0.35) * depth;
      const ex = x - Math.sin(ang) * len, ey = yy - Math.cos(ang) * len;
      ctx.strokeStyle = rgbaS(col, a * 0.45); ctx.lineWidth = (o.width || 1.6) * depth;
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = rgbaS(col, a); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(lerp(x, ex, 0.45), lerp(yy, ey, 0.45)); ctx.stroke();
    }
    ctx.restore();
  };
  /* L.rainCurtain(ctx, t, o) — 雨のカーテン: translucent veils of rain hanging under storm clouds.
   * o: x0,x1,y0,y1 (area), count (sheets, 5), seed, angle (0.12), speed (900 px/s), color, alpha (0.35), drift (px/s) */
  L.rainCurtain = function (ctx, t, o = {}) {
    const ang = def(o.angle, 0.12), col = o.color || '#c6d3ea';
    const sheet = PV.cached('atm:rainsheet:' + col + ':' + Math.round(ang * 100), 256, 1024, (c) => {
      const r = PV.rng(77), k = rgb(col); c.lineCap = 'round';
      for (let i = 0; i < 1100; i++) {
        const x = r() * 256, y = r() * 1024, len = 40 + 200 * r(), a = 0.06 + 0.34 * Math.pow(r(), 2), wd = 0.8 + 1.6 * r();
        c.strokeStyle = rgbaS(k, a); c.lineWidth = wd;
        for (const dy of [-1024, 0, 1024]) { c.beginPath(); c.moveTo(x, y + dy); c.lineTo(x - Math.sin(ang) * len, y + dy - Math.cos(ang) * len); c.stroke(); }
      }
      // soft vertical banding + soft sides (mask only varies with x → vertical scrolling keeps it valid)
      c.globalCompositeOperation = 'destination-in';
      const g = c.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.22, 'rgba(0,0,0,0.85)'); g.addColorStop(0.4, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.7)'); g.addColorStop(0.75, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, 256, 1024);
    });
    const x0 = def(o.x0, 0), x1 = def(o.x1, W), y0 = def(o.y0, 200), y1 = def(o.y1, H), hh = Math.max(8, y1 - y0);
    const q = 0.5, bw = Math.ceil(W * q), bh = Math.ceil(hh * q), b = PV.buffer('atm:curtain', bw, bh), bc = b.ctx; bc.clearRect(0, 0, bw, bh);
    const r = PV.rng(def(o.seed, 3)), n = def(o.count, 5), sp = def(o.speed, 900), span = x1 - x0;
    for (let i = 0; i < n; i++) {
      const sw = lerp(220, 640, r()), a = 0.5 + 0.5 * r(), ph = r() * 1024, xr = r(), dr = 0.5 + r();
      const xc = ((((xr * span + t * def(o.drift, 18) * dr) % (span + sw)) + (span + sw)) % (span + sw)) + x0 - sw / 2;
      const scale = (hh / 1024) * 1.15, oy = ((t * sp * 0.45 + ph) % 1024) * scale;
      bc.globalAlpha = a;
      for (let yy = oy - 1024 * scale; yy < hh; yy += 1024 * scale) bc.drawImage(sheet, (xc - sw / 2 - x0) * q + x0 * q, yy * q, sw * q, 1024 * scale * q);
    }
    bc.globalAlpha = 1; bc.globalCompositeOperation = 'destination-in';
    const g = bc.createLinearGradient(0, 0, 0, bh); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.2, 'rgba(0,0,0,1)'); g.addColorStop(0.78, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    bc.fillStyle = g; bc.fillRect(0, 0, bw, bh); bc.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalAlpha = def(o.alpha, 0.35); ctx.drawImage(b.canvas, 0, y0, W, hh); ctx.restore();
  };
  // rain splashes on water / ground: a tiny jet, then a thin expanding ring — sized by perspective (smaller
  // toward y0).  o: seed,count,x0,x1,y0,y1,color,alpha
  L.splashes = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 41), y0 = def(o.y0, H * 0.8), y1 = def(o.y1, H), col = rgb(o.color || '#dbe8ff'), A = def(o.alpha, 0.55);
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < (o.count || 60); i++) {
      const per = 0.35 + r() * 0.5, ph = r() * per, k = ((((t + ph) % per) + per) % per) / per;
      const x = lerp(def(o.x0, 0), def(o.x1, W), r()), zr = r(), y = lerp(y0, y1, zr), dep = 0.35 + 0.65 * zr, sz = (0.6 + r() * 0.8) * dep;
      const rad = (2 + k * 16) * sz, a = A * (1 - k) * (0.5 + 0.5 * dep);
      ctx.strokeStyle = rgbaS(col, a); ctx.lineWidth = Math.max(0.6, 1.3 * dep);
      ctx.beginPath(); ctx.ellipse(x, y, rad, rad * 0.22, 0, 0, TAU); ctx.stroke();
      if (k < 0.3) { const jh = (1 - k / 0.3) * 9 * sz; ctx.strokeStyle = rgbaS(col, A * (1 - k / 0.3)); ctx.beginPath(); ctx.moveTo(x, y - 1); ctx.lineTo(x, y - 1 - jh); ctx.stroke(); }
    }
    ctx.restore();
  };
  // branching lightning bolt geometry: [[ax,ay,bx,by,w],...]
  L.lightningPath = function (seed, x0, y0, x1, y1, rough = 0.32, depth = 7) {
    const r = PV.rng(seed); const segs = [];
    function sub(ax, ay, bx, by, d, w) {
      if (d === 0) { segs.push([ax, ay, bx, by, w]); return; }
      const mx = (ax + bx) / 2 + (r() - 0.5) * Math.hypot(bx - ax, by - ay) * rough, my = (ay + by) / 2 + (r() - 0.5) * Math.hypot(bx - ax, by - ay) * rough * 0.4;
      sub(ax, ay, mx, my, d - 1, w); sub(mx, my, bx, by, d - 1, w);
      if (d > 3 && r() < 0.35) { const bl = Math.hypot(bx - ax, by - ay) * (0.4 + r() * 0.6); const ang = Math.atan2(by - ay, bx - ax) + (r() - 0.5) * 1.6; sub(mx, my, mx + Math.cos(ang) * bl, my + Math.sin(ang) * bl, d - 2, w * 0.5); }
    }
    sub(x0, y0, x1, y1, depth, 1); return segs;
  };
  // draw a bolt with layered glow (no shadowBlur: fast). strength 0..1
  L.lightning = function (ctx, segs, strength = 1, color = '#e9f1ff') {
    if (strength <= 0) return;
    const q = 0.25, b = PV.buffer('atm:bolt', W * q, H * q), bc = b.ctx; bc.clearRect(0, 0, W * q, H * q);
    bc.setTransform(q, 0, 0, q, 0, 0); bc.lineCap = 'round'; bc.lineJoin = 'round'; bc.strokeStyle = PV.rgba('#9fbcff', 0.6 * strength);
    bc.beginPath(); for (const [ax, ay, bx, by, w] of segs) { if (w < 0.4) continue; bc.moveTo(ax, ay); bc.lineTo(bx, by); } bc.lineWidth = 30; bc.stroke();
    bc.setTransform(1, 0, 0, 1, 0, 0);
    const glow = blurLow(b.canvas, 'atm:bolt2', 5);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.drawImage(glow, 0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [wmul, a, col] of [[9, 0.16, '#a9c4ff'], [4, 0.45, color], [1.7, 1, '#ffffff']]) {
      ctx.strokeStyle = PV.rgba(col, a * strength);
      for (const lvl of [1, 0.5, 0.25]) {
        ctx.lineWidth = wmul * lvl; ctx.beginPath();
        for (const [ax, ay, bx, by, w] of segs) if (Math.abs(w - lvl) < 0.01 || (lvl === 0.25 && w < 0.3)) { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  /* L.flashCurve(t, strikes, o) → 0..1 lightning illumination with realistic return-stroke flicker.
   * strikes: array of strike start times (s).  o.decay (0.45 s) */
  L.flashCurve = function (t, strikes, o = {}) {
    let v = 0; const dec = def(o.decay, 0.45);
    for (const s of strikes || []) {
      const u = t - s; if (u < 0 || u > dec * 3) continue;
      const p = Math.exp(-u / (dec * 0.22)) + 0.75 * Math.exp(-Math.max(0, u - 0.09) / (dec * 0.18)) * (u > 0.09 ? 1 : 0) + 0.5 * Math.exp(-Math.max(0, u - 0.2) / (dec * 0.3)) * (u > 0.2 ? 1 : 0);
      v = Math.max(v, Math.min(1, p));
    }
    return v;
  };
  // sakura petals: notched tip, two-tone, tumbling. o: seed,count,color,size,wind,fall,alpha
  L.petals = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 51); const base = o.color || '#ffd6e3', deep = mixHex(base, '#e88aa8', 0.45);
    ctx.save();
    for (let i = 0; i < (o.count || 40); i++) {
      const sz = (o.size || 14) * (0.5 + r()); const sp = (o.fall || 60) * (0.6 + r() * 0.8); const wind = (o.wind || 80) * (0.5 + r());
      const spanY = H + 200, spanX = W + 400; const ph = r();
      const y = ((ph * spanY + t * sp) % spanY) - 100; const x = ((r() * spanX + t * wind + Math.sin(t * 1.3 + i) * 40) % spanX) - 200;
      const rot = t * (1 + r() * 2) + i, flip = Math.cos(t * (1.5 + r() * 2) + i * 0.7);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(flip, 1);
      const al = (o.alpha || 0.9) * (0.6 + 0.4 * Math.abs(flip));
      const g = ctx.createLinearGradient(0, -sz, 0, sz); g.addColorStop(0, PV.rgba(base, al)); g.addColorStop(1, PV.rgba(deep, al));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, sz);
      ctx.bezierCurveTo(-sz * 0.75, sz * 0.5, -sz * 0.85, -sz * 0.6, -sz * 0.22, -sz); ctx.lineTo(0, -sz * 0.78); ctx.lineTo(sz * 0.22, -sz);
      ctx.bezierCurveTo(sz * 0.85, -sz * 0.6, sz * 0.75, sz * 0.5, 0, sz); ctx.fill();
      ctx.fillStyle = PV.rgba('#ffffff', 0.22 * al); ctx.beginPath(); ctx.ellipse(-sz * 0.15, -sz * 0.2, sz * 0.16, sz * 0.42, 0.3, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };

  /* ============================================================ sea & water */
  const SEA_PAL = {
    summer: { stops: [[0, '#b9ddf3'], [0.025, '#7cbbe9'], [0.14, '#3c8cdb'], [0.5, '#1f69c4'], [1, '#11489a']], light: '#e8f7ff', dark: '#0c3a7a', glint: '#fffdf2', road: '#fff6dc', hl: 0.75, crest: 0.45 },
    spring: { stops: [[0, '#c3dcef'], [0.04, '#8dbde6'], [0.2, '#4e93d6'], [1, '#215ea8']], light: '#e9f4ff', dark: '#163f78', glint: '#fffaf0', road: '#fff4dc', hl: 0.7, crest: 0.35 },
    autumn: { stops: [[0, '#bcd5ea'], [0.04, '#86b2de'], [0.2, '#3f7cc6'], [1, '#1a4b8f']], light: '#e3eefa', dark: '#123766', glint: '#fff9ee', road: '#fff2da', hl: 0.7, crest: 0.35 },
    sunset: { stops: [[0, '#ffd59a'], [0.035, '#eaa88e'], [0.18, '#8c6c98'], [0.55, '#41447a'], [1, '#22264f']], light: '#ffd8a6', dark: '#191b40', glint: '#fff0c6', road: '#ffc982', hl: 0.8, crest: 0.12 },
    night: { stops: [[0, '#232850'], [0.05, '#131838'], [0.35, '#0a0f29'], [1, '#050817']], light: '#323c68', dark: '#03050f', glint: '#ffe1a8', road: '#fff0d0', hl: 0.35, crest: 0, lip: 0.45 },
    storm: { stops: [[0, '#3a4560'], [0.06, '#27304a'], [0.35, '#161d31'], [1, '#0a0e1a']], light: '#6c7996', dark: '#04070d', glint: '#dfe8ff', road: '#dfe8ff', hl: 0.22, crest: 0.6, lip: 0.7 },
  };
  L.SEA_PAL = SEA_PAL;
  const SEA_H = 600; // canonical painted height: the water is painted once and mapped onto any horizon/height
  function seaBase(o) {
    const sw = W + 64, sh = SEA_H, pal = SEA_PAL[o.palette] || SEA_PAL.summer;
    return PV.cached('sea2:' + okey({ st: o.stops, seed: o.seed, pal: o.palette, ch: o.chop }), sw, sh, (c) => {
      c.fillStyle = PV.linGrad(c, 0, 0, 0, sh, o.stops || pal.stops); c.fillRect(0, 0, sw, sh);
      const r = PV.rng(def(o.seed, 61) + 1), lt = rgb(pal.light), dk = rgb(pal.dark), chop = def(o.chop, 1);
      // broad wind patches (catspaws) — darker & lighter zones, flattened by perspective
      for (let i = 0; i < 46; i++) {
        const z = Math.pow(r(), 1.3), y = z * sh, rx = lerp(120, 900, z) * (0.5 + r()), ry = Math.max(2, rx * lerp(0.03, 0.12, z));
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); const col = r() < 0.55 ? dk : lt; const a = (0.05 + 0.08 * r()) * (0.4 + z);
        g.addColorStop(0, rgbaS(col, a)); g.addColorStop(1, rgbaS(col, 0));
        c.save(); c.translate(r() * sw, y); c.scale(rx, ry); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore();
      }
      // wave marks in perspective (painted, not noise): flat lenses of darker water — troughs — each
      // capped by a thin lighter lip catching the sky; grouped by a low-frequency "wind" mask into busy
      // and calm patches, loosely aligned in wave trains, crowding together toward the horizon.
      const nW = Math.round(2600 * chop), lipK = def(pal.lip, 1);
      for (let i = 0; i < nW; i++) {
        let z = Math.pow(r(), 1.6); const row = Math.round(z * 70) / 70; z = lerp(z, row, 0.5);
        const x = r() * sw, wind = PV.fbm2(x / 520 + 3.1, z * 6 + 1.7, 2) * 0.5 + 0.5;
        if (r() > sstep(0.25, 0.7, wind) * 0.85 + 0.15) continue;
        const y = 1 + z * (sh - 2), wd = lerp(6, 190, Math.pow(z, 1.15)) * (0.4 + r() * 0.9), ht = Math.max(0.5, wd * lerp(0.03, 0.065, z) * (0.7 + 0.6 * r()));
        const aD = (0.09 + 0.15 * r()) * (0.45 + 0.75 * z), aL = (0.1 + 0.2 * r()) * (0.6 + 0.4 * z) * lipK;
        c.fillStyle = rgbaS(dk, aD); c.beginPath(); c.ellipse(x, y, wd / 2, ht, 0, 0, TAU); c.fill();
        if (r() < 0.7) { c.fillStyle = rgbaS(lt, aL); c.beginPath(); c.ellipse(x - wd * 0.06 * (r() - 0.3), y - ht * 1.15, wd * (0.22 + 0.2 * r()), Math.max(0.4, ht * 0.42), 0, 0, TAU); c.fill(); }
      }
      // fine horizontal glints of sky light near the horizon (far water is a mirror of the sky)
      const n = Math.round(1400 * chop);
      for (let i = 0; i < n; i++) {
        const z = Math.pow(r(), 2.2) * 0.6, y = 1 + z * (sh - 2);
        const len = lerp(5, 90, z / 0.6) * (0.4 + r()), th = lerp(0.5, 2, z / 0.6) * (0.6 + 0.6 * r());
        const dark = r() < 0.45, col = dark ? dk : lt, a = dark ? 0.08 + 0.12 * r() : 0.1 + 0.2 * r();
        c.fillStyle = rgbaS(col, a); c.beginPath(); c.ellipse(r() * sw, y, len / 2, th / 2, 0, 0, TAU); c.fill();
      }
      // bright horizon line (sky reflection) — strength per palette (soft in storms, crisp in summer)
      const hl = def(o.horizonLine, pal.hl), hh = Math.max(3, sh * 0.03);
      const g = c.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, rgbaS(lt, hl)); g.addColorStop(1, rgbaS(lt, 0)); c.fillStyle = g; c.fillRect(0, 0, sw, hh);
    });
  }
  // glitter road layer: thousands of horizontal sun-glints in a perspective column (two variants that
  // twinkle against each other row by row).  Cached per (colour, width, variant).
  function roadSprite(col, wk, v) {
    const wq = Math.round(wk * 10) / 10, half = Math.min(1000, Math.ceil(330 * wq * 1.45)), rw = half * 2;
    return PV.cached('seaRoad:' + col + ':' + wq + ':' + v, rw, SEA_H, (c) => {
      const r = PV.rng(4242 + v * 977), k = rgb(col);
      for (let i = 0; i < 5200; i++) {
        const z = Math.pow(r(), 1.3), y = 1 + z * (SEA_H - 2), sp = lerp(14, 330, Math.pow(z, 0.9)) * wq;
        const gx = (r() + r() + r() - 1.5) * 1.35, a = Math.exp(-gx * gx * 1.15) * (0.25 + 0.75 * r());
        if (a < 0.05) continue;
        const len = lerp(2, 34, z) * (0.35 + r() * 0.9), th = lerp(0.6, 2.6, z) * (0.6 + 0.6 * r());
        c.fillStyle = rgbaS(k, Math.min(1, a)); c.beginPath(); c.ellipse(half + gx * sp, y, len / 2, th / 2, 0, 0, TAU); c.fill();
      }
    });
  }
  /* L.sea(ctx, t, o) — 海: perspective wave rows & ripples, shimmer, a dense twinkling glitter road toward
   * the sun, near whitecaps.  The water is painted once at a canonical height, so horizonY / y1 may
   * animate (camera tilt) without repainting.
   * legacy o: horizonY(560), y1(H), stops, seed, sparkle(true), sunX, sparkles(260: bright star glints),
   *           sparkleAlpha, sparkleColor
   * new o: palette ('summer'|'spring'|'autumn'|'sunset'|'night'|'storm'), sunY (lower sun = stronger,
   *        narrower road), road (0..1), roadWidth, shimmer (0..1), wobble (px), chop, swell (0..1),
   *        crests (0..1 whitecaps near the camera; palette default), horizonLine (0..1) */
  L.sea = function (ctx, t, o = {}) {
    const hy = def(o.horizonY, 560), y1 = def(o.y1, H), sh = y1 - hy; if (sh <= 2) return;
    const pal = SEA_PAL[o.palette] || SEA_PAL.summer, base = seaBase(o), SH = base.height;
    const sx = def(o.sunX, W * 0.6), wob = def(o.wobble, 1), strip = 3, rowOff = [];
    ctx.save();
    for (let y = 0; y < sh; y += strip) {
      const z = y / sh, amp = lerp(0.3, 6, z) * wob, off = (Math.sin(y * 0.11 + t * 1.3) * 0.6 + N2(y * 0.031, t * 0.45) * 0.8) * amp;
      rowOff.push(off);
      const s0 = z * SH, s1 = Math.min(SH, ((y + strip) / sh) * SH);
      ctx.drawImage(base, 0, s0, base.width, Math.max(0.5, s1 - s0), -32 + off, hy + y, base.width, strip);
    }
    const r = PV.rng(def(o.seed, 61)), lt = rgb(pal.light);
    const shim = def(o.shimmer, 1);
    if (shim > 0) {
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 420; i++) {
        const z = Math.pow(r(), 1.5), per = 1.4 + 2.2 * r(), ph = r() * per, xr = r(), lr = r();
        const u = ((((t + ph) % per) + per) % per) / per, life = Math.sin(u * Math.PI);
        const y = hy + 1 + z * (sh - 2) + u * lerp(1, 14, z), x = xr * (W + 200) - 100 + Math.sin(t * 0.4 + i) * 10;
        const len = lerp(4, 120, z) * (0.4 + lr), th = lerp(0.5, 3, z);
        const a = shim * life * life * (0.16 + 0.26 * (1 - z));
        if (a < 0.02) continue;
        ctx.fillStyle = rgbaS(lt, a); ctx.beginPath(); ctx.ellipse(x, y, len / 2, th / 2, 0, 0, TAU); ctx.fill();
      }
    }
    const road = def(o.road, 0.55), low = o.sunY !== undefined ? clamp((o.sunY - (hy - 520)) / 520) : 0.35, wk = def(o.roadWidth, 1) * (1.5 - low * 0.6);
    if (o.sparkle !== false && road > 0) {
      ctx.globalCompositeOperation = 'screen';
      const rc = rgb(o.sparkleColor || pal.road);
      // soft glow column
      for (let k = 0; k < 16; k++) {
        const z0 = k / 16, z1 = (k + 1) / 16, ya = hy + Math.pow(z0, 1.3) * sh, yb = hy + Math.pow(z1, 1.3) * sh, sp = lerp(16, 330, Math.pow((z0 + z1) / 2, 0.9)) * wk;
        const g = ctx.createLinearGradient(sx - sp, 0, sx + sp, 0); const a = road * (0.14 + 0.24 * low) * (1 - 0.5 * z0);
        g.addColorStop(0, rgbaS(rc, 0)); g.addColorStop(0.5, rgbaS(rc, a)); g.addColorStop(1, rgbaS(rc, 0));
        ctx.fillStyle = g; ctx.fillRect(sx - sp, ya, sp * 2, yb - ya + 1);
      }
      if (low > 0.5) { ctx.globalAlpha = road * (low - 0.5) * 2; ctx.drawImage(dotSprite(o.sparkleColor || pal.road), sx - 260, hy - 6, 520, 22); ctx.globalAlpha = 1; }
      // the glitter itself: two dash layers twinkling against each other, riding the same wave wobble
      const gcol = o.sparkleColor || pal.glint, A = roadSprite(gcol, wk, 0), B = roadSprite(gcol, wk, 1), half = A.width / 2;
      const ga = clamp(road * (1.05 + 0.45 * low)) * def(o.sparkleAlpha, 0.95);
      const rs = 4;
      for (let y = 0, k = 0; y < sh; y += rs, k++) {
        const z = y / sh, s0 = z * SH, s1 = Math.min(SH, ((y + rs) / sh) * SH), off = rowOff[Math.min(rowOff.length - 1, Math.floor(y / strip))] * 1.6;
        const ph = PV.rand1(k, 77) * TAU, fr = 3 + 5 * PV.rand1(k, 78), tw = 0.5 + 0.5 * Math.sin(t * fr + ph);
        ctx.globalAlpha = ga * (0.2 + 0.8 * tw); ctx.drawImage(A, 0, s0, A.width, Math.max(0.5, s1 - s0), sx - half + off, hy + y, A.width, rs);
        ctx.globalAlpha = ga * (0.2 + 0.8 * (1 - tw)); ctx.drawImage(B, 0, s0, B.width, Math.max(0.5, s1 - s0), sx - half - off, hy + y, B.width, rs);
      }
      ctx.globalAlpha = 1;
    }
    if (o.sparkle !== false) {
      // a few strong star glints (the brightest wave facets) — sparse, small, never a sticker pattern
      ctx.globalCompositeOperation = 'screen';
      const gc = rgb(o.sparkleColor || pal.glint), star = dotSprite(o.sparkleColor || pal.glint, 'hard'), sa = def(o.sparkleAlpha, 0.95);
      const n = Math.round(def(o.sparkles, 260) * (road > 0 ? 1 : 0.5));
      for (let i = 0; i < n; i++) {
        const k = r(); const y = hy + 1.5 + Math.pow(k, 1.35) * (sh - 2);
        const spread = lerp(14, 300, Math.pow(k, 0.9)) * wk; const gx = (r() + r() + r() - 1.5) * 1.3; const x = sx + gx * spread;
        const fr = 2.5 + r() * 6, ph = r() * 50, big = r();
        const tw = Math.max(0, Math.sin(t * fr + ph)); const a = Math.pow(tw, 4) * sa * Math.exp(-gx * gx * 1.4) * (0.6 + 0.4 * low);
        if (a < 0.06) continue; const s = (0.8 + 2 * k) * (0.6 + 0.8 * big);
        ctx.fillStyle = rgbaS(gc, a); ctx.fillRect(x - s * 2.2, y - s * 0.3, s * 4.4, Math.max(1.1, s * 0.6));
        if (a > 0.6 && big > 0.85) {
          ctx.globalAlpha = a * 0.6; drawDot(ctx, star, x, y, s * 2.2); ctx.globalAlpha = 1;
          ctx.fillStyle = rgbaS(gc, a * 0.5); ctx.fillRect(x - s * 4.5, y - 0.5, s * 9, 1); ctx.fillRect(x - 0.5, y - s * 2.4, 1, s * 4.8);
        }
      }
    }
    const crest = def(o.crests, pal.crest);
    if (crest > 0) { // whitecaps: little breaking crests near the camera — a bright curled lip, foam trailing behind
      ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round';
      const storm = o.palette === 'storm', rc = PV.rng(def(o.seed, 61) + 17), fc = storm ? [190, 202, 226] : [252, 254, 255];
      for (let i = 0, nC = Math.round(60 * crest); i < nC; i++) {
        const z = 0.3 + 0.7 * Math.pow(rc(), 0.6), per = 1.6 + 1.8 * rc(), ph = rc() * per, xr = rc(), sz = lerp(14, 90, z) * (0.5 + rc()), dir = rc() < 0.5 ? -1 : 1;
        const u = ((((t + ph) % per) + per) % per) / per, life = Math.sin(Math.min(1, u * 1.6) * Math.PI);
        const a = crest * life * 0.9; if (a < 0.04) continue;
        const y = hy + z * sh, x = ((xr * (W + 300) + t * 5 * z) % (W + 300)) - 150, th = lerp(1, 4.5, z) * (storm ? 0.7 : 1);
        if (storm) { ctx.fillStyle = rgbaS(fc, a * 0.7); for (let k = 0; k < 3; k++) ctx.fillRect(x - sz * (0.5 - 0.3 * k) + dir * k * 3, y + k * th * 1.2, sz * (0.5 - 0.12 * k), Math.max(0.7, th * 0.5)); continue; }
        ctx.strokeStyle = rgbaS(fc, a); ctx.lineWidth = th; ctx.beginPath(); ctx.moveTo(x - sz * 0.5, y + th * 0.3); ctx.quadraticCurveTo(x, y - th * 1.4, x + sz * 0.5 * dir, y - th * 0.2); ctx.stroke();
        ctx.fillStyle = rgbaS(fc, a * 0.45);
        for (let k = 0; k < 4; k++) { const fx = x - dir * sz * (0.1 + 0.25 * k) * (0.5 + u), fy = y + th * (0.8 + 0.5 * k); ctx.beginPath(); ctx.ellipse(fx, fy, sz * (0.18 - 0.03 * k) * (0.6 + u), th * 0.45, 0, 0, TAU); ctx.fill(); }
      }
    }
    if (def(o.swell, 0) > 0) {
      ctx.globalCompositeOperation = 'source-over';
      const dk = rgb(pal.dark);
      for (let j = 0; j < 6; j++) {
        const u = (((t * 0.06 + j / 6) % 1) + 1) % 1, y = hy + sh * lerp(0.35, 1.05, u * u), th = lerp(6, 40, u * u), a = o.swell * 0.16 * Math.sin(u * Math.PI);
        const g = ctx.createLinearGradient(0, y - th, 0, y + th); g.addColorStop(0, rgbaS(lt, 0)); g.addColorStop(0.45, rgbaS(lt, a * 0.6)); g.addColorStop(0.55, rgbaS(dk, a)); g.addColorStop(1, rgbaS(dk, 0));
        ctx.fillStyle = g; ctx.fillRect(0, y - th, W, th * 2);
      }
    }
    ctx.restore();
  };

  // one light's broken reflection column (cached by quantised colour/width/intensity/length)
  function reflSprite(col, lw, I, len, v) {
    col = qcol(col); // animated light colours (e.g. the Ferris wheel) must not mint a sprite per frame
    const wq = Math.max(2, Math.round(lw / 2) * 2), iq = Math.max(0.25, Math.round(I * 4) / 4), lq = Math.max(20, Math.round(len / 30) * 30);
    const sw = Math.ceil(wq * 5 + 30);
    return PV.cached('nwr2:' + col + ':' + wq + ':' + iq + ':' + lq + ':' + v, sw, lq, (c) => {
      const r = PV.rng(PV.hash(col) + wq * 31 + lq * 7 + v * 1009), k = rgb(col); c.globalCompositeOperation = 'lighter';
      for (let y = 0; y < lq; y += 1 + Math.floor(r() * 3)) {
        const z = y / lq; if (r() < 0.22 + z * 0.38) continue;
        const wd = wq * (0.45 + 1.1 * r()) * (1 + z * 1.1), a = iq * Math.pow(1 - z, 1.3) * (0.35 + 0.65 * r());
        c.fillStyle = rgbaS(k, a); c.fillRect(sw / 2 - wd / 2 + (r() - 0.5) * wq * (0.4 + z * 1.2), y, wd, 1 + r() * 1.6);
      }
    });
  }
  /* L.nightWater(ctx, t, o) — 夜の水面: dark water with the opposite shore's lights stretched into
   * wavering, broken vertical reflections.  Lights may move (pans/parallax): each is a cached column.
   * o: horizonY (shoreline y, 640), y1, lights [{x, w, c:'#hex', a}] (from L.skyline / L.bridge / L.ferrisWheel
   *    return values; generated from seed if absent), seed, len (0.85: reflection length as a fraction of
   *    the water height), wobble (1), stops, glow (0.5: soft city glow on the water), dx (shift all lights) */
  L.nightWater = function (ctx, t, o = {}) {
    const hy = def(o.horizonY, 640), y1 = def(o.y1, H), sh = Math.ceil(y1 - hy); if (sh <= 2) return;
    const pal = SEA_PAL.night, base = seaBase(Object.assign({ chop: 0.45 }, o, { palette: 'night' })), SH = base.height;
    let lights = o.lights;
    if (!lights) { const r = PV.rng(def(o.seed, 5)); lights = []; for (let i = 0; i < 60; i++) lights.push({ x: r() * W, w: 6 + 30 * r(), c: ['#ffd38a', '#fff1d6', '#ffb7c5', '#cfe0ff'][Math.floor(r() * 4)], a: 0.3 + 0.7 * r() }); }
    const len = def(o.len, 0.85) * sh, dx = def(o.dx, 0), lk = lights.length + ':' + sh + ':' + Math.round(dx * 2) + ':' + Math.round(len) + ':' + lights.reduce((a, L0) => a + L0.x * 1.3 + (L0.w || 8) * 7 + (L0.a || 1) * 11, 0).toFixed(1) + ':' + PV.hash(lights.map((L0) => qcol(L0.c || '#ffd38a')).join(''));
    const buf = PV.buffer('atm:nwr', W + 80, sh), bc = buf.ctx, same = buf.canvas._lk === lk; buf.canvas._lk = lk;
    if (!same) bc.clearRect(0, 0, W + 80, sh); bc.globalCompositeOperation = 'lighter';
    if (!same) lights.forEach((L0, i) => {
      const I = clamp(L0.a === undefined ? 1 : L0.a); if (I < 0.03) return;
      const lx = L0.x + dx; if (lx < -200 || lx > W + 200) return;
      const myLen = len * (0.35 + 0.65 * I) * (0.7 + 0.5 * PV.rand1(i, 5));
      const spr = reflSprite(L0.c || '#ffd38a', Math.max(2, L0.w || 8), I, myLen, i % 3);
      bc.drawImage(spr, 40 + lx - spr.width / 2, 0);
    });
    bc.globalCompositeOperation = 'source-over';
    ctx.save();
    for (let y = 0; y < sh; y += 3) { const z = y / sh, off = Math.sin(y * 0.09 + t * 0.9) * lerp(0.3, 3, z), s0 = z * SH, s1 = Math.min(SH, ((y + 3) / sh) * SH); ctx.drawImage(base, 0, s0, base.width, Math.max(0.5, s1 - s0), -32 + off, hy + y, base.width, 3); }
    const gA = def(o.glow, 0.5);
    if (gA > 0) { const g = ctx.createLinearGradient(0, hy, 0, hy + sh * 0.6); g.addColorStop(0, `rgba(120,96,140,${0.28 * gA})`); g.addColorStop(1, 'rgba(120,96,140,0)'); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, hy, W, sh * 0.6); }
    ctx.globalCompositeOperation = 'screen'; const wb = def(o.wobble, 1);
    for (let y = 0; y < sh; y += 2) {
      const z = y / sh, amp = lerp(1.2, 16, Math.pow(z, 0.75)) * wb;
      const off = (Math.sin(y * 0.23 + t * 2.1) * 0.55 + Math.sin(y * 0.071 - t * 1.3) * 0.35 + N2(y * 0.05, t * 0.7) * 0.6) * amp;
      ctx.globalAlpha = 0.8 + 0.2 * Math.sin(y * 0.7 + t * 3.3);
      ctx.drawImage(buf.canvas, 0, y, W + 80, 2, -40 + off, hy + y, W + 80, 2);
    }
    ctx.globalAlpha = 1;
    const r = PV.rng(def(o.seed, 5) + 9), lt = rgb(pal.light);
    for (let i = 0; i < 160; i++) {
      const z = Math.pow(r(), 1.2), per = 1.5 + 2 * r(), ph = r() * per, x = r() * W, len2 = lerp(8, 90, z) * (0.4 + r());
      const u = ((((t + ph) % per) + per) % per) / per, a = Math.sin(u * Math.PI) * 0.14 * (1 - z * 0.5); if (a < 0.02) continue;
      ctx.fillStyle = rgbaS(lt, a); ctx.fillRect(x, hy + 2 + z * (sh - 4), len2, lerp(0.6, 2, z));
    }
    ctx.restore();
  };

  /* L.bridge(ctx, o) — 白い大橋 (cable-stayed), side view.  Returns its lights [{x,w,c,a}] (for reflections).
   * legacy o: x0,x1 (deck ends), y (deck), towerH(160), color, lw(3), alpha, towers[x...], pierH(40), cables(9)
   * new o: night (lamps, tower uplights, red beacons), t (beacon blink), shadow (shadow-side colour),
   *        light ('left'|'right'), haze (0..1) + hazeColor, span (cable fan half-width), lamps (count),
   *        flash (0..1: lightning lights the bridge up), style ('H' two legs | 'I' single column) */
  L.bridge = function (ctx, o) {
    const x0 = o.x0, x1 = o.x1, y = o.y, th = o.towerH || 160, lw = o.lw || 3, night = !!o.night, t = def(o.t, 0);
    const hz = def(o.haze, 0), hzc = o.hazeColor || (night ? '#1d2b55' : '#dfeaf5');
    const hzm = (c) => (hz > 0 ? mixHex(c, hzc, hz) : c);
    const col = hzm(o.color || (night ? '#141b33' : '#f6f8fb')), shd = hzm(o.shadow || (night ? '#0c1124' : mixHex(o.color || '#f6f8fb', '#7d92bd', 0.5)));
    const lightL = o.light !== 'right', towers = o.towers || [x0 + (x1 - x0) * 0.3, x0 + (x1 - x0) * 0.7];
    const span = def(o.span, (x1 - x0) * 0.19), pierH = def(o.pierH, 40), nC = o.cables || 9, dk = lw * 3, style = o.style || (lw >= 2.5 ? 'H' : 'I');
    const fl = def(o.flash, 0), lights = [];
    ctx.save(); ctx.globalAlpha = def(o.alpha, 1);
    // approach piers
    const pw = lw * 1.6, step = Math.max(span * 0.55, lw * 30);
    ctx.fillStyle = shd;
    for (let x = x0 + step * 0.5; x < x1; x += step) { if (towers.some((tx) => Math.abs(tx - x) < span * 0.9)) continue; ctx.fillRect(x - pw / 2, y, pw, pierH * 0.8); }
    // deck girder
    let g = ctx.createLinearGradient(0, y - dk / 2, 0, y + dk / 2);
    g.addColorStop(0, night ? mixHex(col, '#5a6890', 0.35 + fl * 0.5) : tone(col, 0.5)); g.addColorStop(0.28, col); g.addColorStop(0.5, col); g.addColorStop(0.58, shd); g.addColorStop(1, night ? shd : tone(shd, -0.12));
    ctx.fillStyle = g; ctx.fillRect(x0, y - dk / 2, x1 - x0, dk);
    if (!night) { ctx.fillStyle = PV.rgba(tone(shd, -0.25), 0.55); ctx.fillRect(x0, y + dk / 2 - Math.max(0.6, lw * 0.3), x1 - x0, Math.max(0.6, lw * 0.3)); } // underside edge: separates the white deck from bright haze
    ctx.fillStyle = night ? 'rgba(160,180,230,0.25)' : PV.rgba(tone(col, 0.6), 0.9); ctx.fillRect(x0, y - dk / 2 - Math.max(0.6, lw * 0.25), x1 - x0, Math.max(0.6, lw * 0.25));
    // towers
    for (const tx of towers) {
      const top = y - th, bot = y + pierH, wb = lw * 3.5, wt = lw * 1.4;
      const leg = (side) => { // side -1/+1 leg (or full column when style I; 'Y' = inverted-Y: one column splitting above the deck)
        ctx.beginPath();
        if (style === 'I') { ctx.moveTo(tx - wb, bot); ctx.lineTo(tx - wt, top); ctx.lineTo(tx + wt, top); ctx.lineTo(tx + wb, bot); }
        else if (style === 'Y') { const o1 = side < 0 ? -1 : 1, sy = y - th * 0.38, sp2 = wb * 2.6; ctx.moveTo(tx, sy + th * 0.16); ctx.lineTo(tx + o1 * (sp2 - wb * 0.8), bot); ctx.lineTo(tx + o1 * sp2, bot); ctx.lineTo(tx + o1 * wb * 0.75, sy); ctx.lineTo(tx + o1 * wt, top); ctx.lineTo(tx, top - lw * 0.4); }
        else { const gap = lw * 0.55; const o1 = side < 0 ? -1 : 1; ctx.moveTo(tx + o1 * gap, bot); ctx.lineTo(tx + o1 * wb, bot); ctx.lineTo(tx + o1 * wt, top); ctx.lineTo(tx + o1 * gap * 0.4, top); }
        ctx.closePath();
      };
      g = ctx.createLinearGradient(tx - wb, 0, tx + wb, 0);
      const cl = lightL ? col : shd, cr = lightL ? shd : col;
      g.addColorStop(0, cl); g.addColorStop(0.47, cl); g.addColorStop(0.53, cr); g.addColorStop(1, cr);
      ctx.fillStyle = g; leg(-1); ctx.fill(); if (style !== 'I') { leg(1); ctx.fill(); }
      if (!night && style === 'H') { ctx.fillStyle = PV.rgba(tone(shd, -0.2), 0.6); ctx.fillRect(tx - lw * 0.45, top + th * 0.06, lw * 0.9, bot - top - th * 0.06); } // the slit between the two legs reads as a dark seam
      if (o.rim && def(o.rimAmt, 1) > 0) { // thin light edge (e.g. lightning flash behind)
        ctx.save(); ctx.globalAlpha = def(o.rimAmt, 1); ctx.strokeStyle = o.rim; ctx.lineWidth = Math.max(1, lw * 0.35);
        const sd = lightL ? -1 : 1; ctx.beginPath(); ctx.moveTo(tx + sd * wb, bot); ctx.lineTo(tx + sd * wt, top); ctx.lineTo(tx, top - lw * 0.5); ctx.stroke();
        ctx.fillStyle = o.rim; ctx.fillRect(x0, y - dk / 2 - lw * 0.4, x1 - x0, Math.max(1, lw * 0.35)); ctx.restore();
      }
      // crossbeams + cap
      ctx.fillStyle = shd; ctx.fillRect(tx - wb * 0.9, y + dk * 0.5, wb * 1.8, lw * 1.2); ctx.fillRect(tx - wt * 1.3, top + th * 0.08, wt * 2.6, lw * 0.9);
      ctx.fillStyle = col; ctx.fillRect(tx - wt * 1.15, top - lw * 0.6, wt * 2.3, lw * 0.9);
      // cables (fan / semi-harp)
      ctx.lineWidth = Math.max(0.55, lw * 0.25);
      ctx.strokeStyle = night ? PV.rgba('#9fb0dd', 0.22 + fl * 0.5) : PV.rgba(tone(col, 0.2), 0.85);
      ctx.beginPath();
      for (let k = 1; k <= nC; k++) {
        const f = k / nC, ty = top + th * (0.04 + 0.36 * (1 - f));
        ctx.moveTo(tx, ty); ctx.lineTo(tx - span * f, y - dk / 2); ctx.moveTo(tx, ty); ctx.lineTo(tx + span * f, y - dk / 2);
      }
      ctx.stroke();
      if (night) {
        // uplight wash on the tower
        const up = def(o.uplight, 0.26); g = ctx.createLinearGradient(0, y, 0, top); g.addColorStop(0, `rgba(230,236,255,${up})`); g.addColorStop(1, `rgba(230,236,255,${up * 0.1})`);
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; leg(-1); ctx.fill(); if (style !== 'I') { leg(1); ctx.fill(); } ctx.restore();
        // red aviation beacons (slow blink)
        const on = 0.55 + 0.45 * Math.sin(t * 2.4 + tx * 0.01);
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = on;
        drawDot(ctx, dotSprite('#ff5a4a'), tx, top - lw * 1.2, lw * 7); drawDot(ctx, dotSprite('#ffd0c8', 'hard'), tx, top - lw * 1.2, lw * 1.4);
        drawDot(ctx, dotSprite('#ff5a4a'), tx, top + th * 0.45, lw * 4);
        ctx.restore();
        lights.push({ x: tx, w: lw * 3, c: '#ff6a5a', a: 0.5 * on }, { x: tx, w: lw * 4, c: '#dfe6ff', a: 0.45 });
      }
    }
    // deck lamps
    if (night) {
      const n = def(o.lamps, Math.round((x1 - x0) / (lw * 16))), lc = o.lampColor || '#ffcf86', spr = dotSprite(lc), core = dotSprite('#fff4dc', 'hard');
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < n; i++) {
        const x = x0 + ((x1 - x0) * (i + 0.5)) / n, ly = y - dk / 2 - lw * 1.6;
        ctx.globalAlpha = 0.85; drawDot(ctx, spr, x, ly, lw * 5.5); ctx.globalAlpha = 1; drawDot(ctx, core, x, ly, lw * 0.9);
        if (i % 2 === 0) lights.push({ x, w: lw * 2.6, c: lc, a: 0.75 });
      }
      ctx.restore();
    }
    ctx.restore();
    return lights;
  };

  /* L.skyline(ctx, o) — city silhouette with lit windows (cached).  Returns lights [{x,w,c,a}] for reflections.
   * legacy o: seed, y (ground), hMin, hMax, color, windowColor, lit (0..1), x0, x1, wMin, wMax
   * new o: windowColors[], win:[w,h,gapX,gapY] (3,4,8,9), glow (0..1 soft light halo), rim (edge light colour),
   *        skyGlow (colour of the light-pollution glow behind), haze (0..1)+hazeColor, beacons (true), t (beacon
   *        blink), style ('city' | 'town': pitched-roof houses), carpet (0..1: the dense band of far street
   *        lights along the base; default = lit), crowns (true: lit tops on the tallest towers), gap
   * The painting is cached WITHOUT its y, so animating y (parallax / tilt) costs nothing. */
  const skyCache = new Map();
  L.skyline = function (ctx, o = {}) {
    const key = okey(Object.assign({}, o, { t: undefined, y: undefined }));
    let S = skyCache.get(key);
    if (!S) {
      const hMax = def(o.hMax, 220), yB = Math.ceil(hMax * 1.45 + 40), ch = yB + 4; // local ground line
      const cv = PV.makeCanvas(W, ch), c = cv.ctx;
      const r = PV.rng(o.seed || 71); let x = def(o.x0, -20); const x1 = def(o.x1, W + 20);
      const baseC = o.haze ? mixHex(o.color || '#1b2140', o.hazeColor || '#2e3c6d', o.haze) : o.color || '#1b2140';
      const wcols = o.windowColors || [o.windowColor || '#ffd78a', o.windowColor ? tone(o.windowColor, 0.35) : '#fff0cf', o.windowColor ? o.windowColor : '#d9e6ff'];
      const win = o.win || [3, 4, 8, 9], lights = [], beacons = [], lit = def(o.lit, 0);
      if (o.skyGlow) { const g = c.createLinearGradient(0, yB - hMax * 1.4, 0, yB); g.addColorStop(0, PV.rgba(o.skyGlow, 0)); g.addColorStop(1, PV.rgba(o.skyGlow, 0.35)); c.fillStyle = g; c.fillRect(0, yB - hMax * 1.4, W, hMax * 1.4); }
      const glowCv = PV.makeCanvas(W, ch), gc = glowCv.ctx;
      const town = o.style === 'town', rimC = o.rim ? rgb(o.rim) : null, lightC = mixHex(baseC, '#9aa6d6', 0.16), darkC = mixHex(baseC, '#000000', 0.18);
      while (x < x1) {
        const w = lerp(def(o.wMin, 30), def(o.wMax, 110), r()), h = lerp(def(o.hMin, 40), hMax, Math.pow(r(), 1.6));
        const bc = mixHex(baseC, r() < 0.5 ? '#000000' : '#5a6488', r() * 0.12);
        c.fillStyle = bc; c.fillRect(x, yB - h, w, h + 2);
        const kind = r(); let topY = yB - h;
        if (town && h < hMax * 0.75 && kind < 0.75) { // pitched roof house
          const rh = w * (0.22 + 0.16 * r()), ov = w * 0.06; c.beginPath(); c.moveTo(x - ov, yB - h + 1); c.lineTo(x + w * (0.35 + 0.3 * r()), yB - h - rh); c.lineTo(x + w + ov, yB - h + 1); c.closePath(); c.fill(); topY -= rh;
          if (r() < 0.4) c.fillRect(x + w * 0.7, yB - h - rh * 0.9, w * 0.08, rh * 0.6);
        } else if (!town && kind < 0.22 && h > hMax * 0.45) { // stepped setbacks
          let ww = w, xx = x, hh = h; for (let k = 0; k < 2; k++) { const nw = ww * (0.62 + 0.18 * r()), nh = h * (0.07 + 0.08 * r()); xx += (ww - nw) * (0.3 + 0.4 * r()); ww = nw; c.fillRect(xx, yB - hh - nh, ww, nh + 1); hh += nh; } topY = yB - hh;
        } else if (!town && kind < 0.3 && h > hMax * 0.5) { // slanted crown
          const sl = h * (0.08 + 0.1 * r()); c.beginPath(); c.moveTo(x, yB - h + 1); c.lineTo(x + w, yB - h + 1); c.lineTo(x + w, yB - h - sl * (r() < 0.5 ? 1 : 0.2)); c.lineTo(x, yB - h - sl * 0.6); c.closePath(); c.fill(); topY -= sl;
        } else if (kind < 0.42) { const w2 = w * (0.2 + 0.25 * r()); c.fillRect(x + (w - w2) * r(), yB - h - h * 0.05, w2, h * 0.05 + 1); }
        if (!town && h > hMax * 0.62 && r() < 0.55) { const ax = x + w * (0.3 + 0.4 * r()), ah = h * (0.08 + 0.12 * r()); c.fillRect(ax - 0.75, topY - ah, 1.5, ah); beacons.push([ax, topY - ah]); }
        // facade modelling: a lighter sky-facing edge and a darker side plane (no flat cardboard boxes)
        if (!town && w > 22) { c.fillStyle = PV.rgba(lightC, 0.5); c.fillRect(x, yB - h, Math.max(1, w * 0.05), h); c.fillStyle = PV.rgba(darkC, 0.55); c.fillRect(x + w * 0.72, yB - h, w * 0.28, h); }
        if (rimC) { c.fillStyle = rgbaS(rimC, 0.35); c.fillRect(x + w - 1.5, yB - h, 1.5, h); }
        if (lit) {
          const wc = wcols[Math.floor(r() * wcols.length)], wk = rgb(wc); let nl = 0, nt = 0;
          const mode = r(), office = mode < 0.42, sleepy = mode > 0.8, full = !town && mode > 0.74 && mode <= 0.8 && h > hMax * 0.5, litK = lit * (sleepy ? 0.35 : 1);
          let band = r() < litK ? 1 : 0;
          for (let wy = yB - h + win[1] + 3; wy < yB - win[1] - 2; wy += win[3]) {
            if (office) { if (r() < 0.3) band = r() < litK * 1.1 ? 1 : 0; } else r();
            for (let wx = x + 4; wx < x + w - win[0] - 3; wx += win[2]) {
              nt++;
              const q = r(), on = full ? q < 0.92 : office ? (band ? q < 0.9 : q < litK * 0.12) : q < litK * 0.75;
              const av = r(); if (!on) continue;
              nl++; const a = 0.5 + 0.5 * av, k2 = r() < 0.15 ? mix3(wk, [255, 255, 255], 0.5) : wk;
              c.fillStyle = rgbaS(k2, a); c.fillRect(wx, wy, win[0], win[1]); gc.fillStyle = rgbaS(k2, a); gc.fillRect(wx - 1, wy - 1, win[0] + 2, win[1] + 2);
            }
          }
          if (o.crowns !== false && !town && h > hMax * 0.8 && r() < 0.5) { // lit crown band on a tall tower
            const cc = rgb(r() < 0.5 ? '#fff2dc' : '#cfe0ff'), cy0 = yB - h + 3; c.fillStyle = rgbaS(cc, 0.8); c.fillRect(x + 2, cy0, w - 4, 2.5); gc.fillStyle = rgbaS(cc, 0.9); gc.fillRect(x, cy0 - 2, w, 7); nl += 6;
          }
          if (nt > 0 && nl / nt > 0.04) lights.push({ x: x + w / 2, w: w * 0.75, c: wc, a: clamp((nl / nt) * 1.6) * Math.min(1, h / hMax + 0.3) });
        }
        x += w + lerp(0, def(o.gap, 8), r());
      }
      if (lit) { // warm street-level light washing up the facades
        c.save(); c.globalCompositeOperation = 'source-atop'; const g = c.createLinearGradient(0, yB - hMax * 0.5, 0, yB);
        g.addColorStop(0, 'rgba(255,190,140,0)'); g.addColorStop(1, `rgba(255,190,140,${0.16 * Math.min(1, lit * 2)})`); c.fillStyle = g; c.fillRect(0, yB - hMax * 0.5, W, hMax * 0.5 + 4); c.restore();
        const carpet = def(o.carpet, Math.min(1, lit * 2));
        if (carpet > 0) { // the dense glitter of far street lights / low buildings along the base
          const n = Math.round(((x1 - def(o.x0, -20)) / W) * 520 * carpet), cs = ['#ffd38a', '#ffe8c2', '#ffb070', '#e8f0ff', '#fff6e6'];
          for (let i = 0; i < n; i++) {
            const lx = lerp(def(o.x0, -20), x1, r()), ly = yB - 1 - Math.pow(r(), 2.2) * hMax * 0.14, k = rgb(cs[Math.floor(r() * cs.length)]), a = 0.45 + 0.55 * r(), sz = 0.8 + 1.4 * Math.pow(r(), 3);
            c.fillStyle = rgbaS(k, a); c.fillRect(lx, ly, sz, sz); gc.fillStyle = rgbaS(k, a); gc.fillRect(lx - 1, ly - 1, sz + 2, sz + 2);
          }
          for (let i = 0; i < 8 * carpet; i++) lights.push({ x: lerp(def(o.x0, -20), x1, r()), w: 4 + 8 * r(), c: cs[Math.floor(r() * cs.length)], a: 0.18 + 0.2 * r() });
        }
      }
      if (o.glow) { c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = o.glow; c.filter = 'blur(7px)'; c.drawImage(glowCv.canvas, 0, 0); c.globalAlpha = o.glow * 0.6; c.filter = 'blur(22px)'; c.drawImage(glowCv.canvas, 0, 0); c.restore(); }
      S = { canvas: cv.canvas, top: -yB, lights, beacons, yB };
      if (skyCache.size >= 24) skyCache.delete(skyCache.keys().next().value);
      skyCache.set(key, S);
    }
    const oy = def(o.y, 0) - S.yB;
    ctx.drawImage(S.canvas, 0, oy);
    if (o.beacons !== false && S.beacons.length && o.lit) {
      const t = def(o.t, 0), spr = dotSprite('#ff5040'); ctx.save(); ctx.globalCompositeOperation = 'screen';
      S.beacons.forEach(([bx, by], i) => { const on = Math.pow(0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7), 3); ctx.globalAlpha = 0.25 + 0.75 * on; drawDot(ctx, spr, bx, by + oy, 9); });
      ctx.restore();
    }
    return S.lights;
  };

  /* L.ferrisWheel(ctx, t, o) — 観覧車 (the seaside park's landmark).  Day: a white steel silhouette;
   * night: illuminated rim, spokes and gondolas with a slowly travelling colour pattern.
   * Returns lights [{x,w,c,a}] for L.nightWater.
   * o: x, y (hub), r (radius 220), night (false), t, spokes (32), gondolas (32), color (structure),
   *    pattern ('rainbow'|'warm'|'cool'), speed (rad/s, 0.01), haze (0..1)+hazeColor, alpha, glow (0.8), legH */
  L.ferrisWheel = function (ctx, t, o = {}) {
    const cx = def(o.x, 1500), cy = def(o.y, 420), R = def(o.r, 220), night = !!o.night, nS = def(o.spokes, 32), nG = def(o.gondolas, 32);
    const rot = t * def(o.speed, 0.01), hz = def(o.haze, 0), hzc = o.hazeColor || (night ? '#1d2b55' : '#dfeaf5');
    const col = mixHex(o.color || (night ? '#1a1f3a' : '#f3f6fa'), hzc, hz), lw = Math.max(1, R / 110), lights = [];
    const pat = o.pattern || 'rainbow', hue = (u) => { // colour of the light at angle-fraction u (pattern travels slowly)
      const v = (((u + t * 0.03) % 1) + 1) % 1;
      if (pat === 'warm') return mix3([255, 214, 140], [255, 160, 120], 0.5 + 0.5 * Math.sin(v * TAU * 2));
      if (pat === 'cool') return mix3([200, 225, 255], [150, 190, 255], 0.5 + 0.5 * Math.sin(v * TAU * 2));
      const k = [[255, 120, 150], [255, 196, 110], [255, 246, 170], [140, 235, 190], [130, 196, 255], [196, 150, 255]], f = v * k.length, i0 = Math.floor(f) % k.length;
      return mix3(k[i0], k[(i0 + 1) % k.length], f - Math.floor(f));
    };
    ctx.save(); ctx.globalAlpha = def(o.alpha, 1); ctx.lineCap = 'round';
    // A-frame legs down to the ground
    const gy = cy + R + def(o.legH, R * 0.28);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = lw * 2.4;
    ctx.beginPath(); ctx.moveTo(cx - R * 0.42, gy); ctx.lineTo(cx, cy); ctx.lineTo(cx + R * 0.42, gy); ctx.stroke();
    ctx.lineWidth = lw * 1.2; ctx.beginPath(); ctx.moveTo(cx - R * 0.3, gy - R * 0.28); ctx.lineTo(cx + R * 0.3, gy - R * 0.28); ctx.stroke();
    ctx.fillRect(cx - R * 0.55, gy - lw * 3, R * 1.1, lw * 3); // boarding station
    // rims + spokes
    ctx.lineWidth = lw * 1.3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.arc(cx, cy, R * 0.93, 0, TAU); ctx.stroke();
    ctx.lineWidth = lw * 0.5; ctx.beginPath();
    for (let i = 0; i < nS; i++) { const a = rot + (i / nS) * TAU; ctx.moveTo(cx + Math.cos(a) * R * 0.08, cy + Math.sin(a) * R * 0.08); ctx.lineTo(cx + Math.cos(a) * R * 0.93, cy + Math.sin(a) * R * 0.93); }
    ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, R * 0.08, 0, TAU); ctx.fill();
    // gondolas hang from the rim (always upright)
    for (let i = 0; i < nG; i++) { const a = rot + ((i + 0.5) / nG) * TAU, gx = cx + Math.cos(a) * R, gyy = cy + Math.sin(a) * R; ctx.fillRect(gx - lw * 2.2, gyy + lw * 0.8, lw * 4.4, lw * 4.6); }
    if (night) {
      ctx.globalCompositeOperation = 'screen';
      const glowK = def(o.glow, 0.8), dot = dotSprite('#ffffff'), core = dotSprite('#ffffff', 'hard');
      // lit spokes (thin coloured lines) and the rim's chain of bulbs
      for (let i = 0; i < nS; i++) {
        const a = rot + (i / nS) * TAU, k = hue(i / nS);
        ctx.strokeStyle = rgbaS(k, 0.55); ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.1, cy + Math.sin(a) * R * 0.1); ctx.lineTo(cx + Math.cos(a) * R * 0.93, cy + Math.sin(a) * R * 0.93); ctx.stroke();
      }
      const nB = Math.round(R * 0.9);
      for (let i = 0; i < nB; i++) {
        const u = i / nB, a = rot + u * TAU, k = hue(u), bx = cx + Math.cos(a) * R, by = cy + Math.sin(a) * R;
        ctx.globalAlpha = 0.9; ctx.fillStyle = rgbaS(k, 1); ctx.fillRect(bx - lw * 0.6, by - lw * 0.6, lw * 1.2, lw * 1.2);
        if (i % 3 === 0) { ctx.globalAlpha = 0.18 * glowK; ctx.drawImage(dot, bx - lw * 7, by - lw * 7, lw * 14, lw * 14); }
      }
      for (let i = 0; i < nG; i++) { const a = rot + ((i + 0.5) / nG) * TAU, gx = cx + Math.cos(a) * R, gyy = cy + Math.sin(a) * R; ctx.globalAlpha = 0.7; ctx.fillStyle = 'rgb(255,236,200)'; ctx.fillRect(gx - lw * 1.6, gyy + lw * 1.6, lw * 3.2, lw * 2); }
      ctx.globalAlpha = 0.35 * glowK; ctx.drawImage(dotSprite(hexOf(hue(0.25))), cx - R * 1.25, cy - R * 1.25, R * 2.5, R * 2.5);
      ctx.globalAlpha = 1; drawDot(ctx, core, cx, cy, lw * 3);
      for (let i = 0; i < 9; i++) { const u = i / 9; lights.push({ x: cx + Math.cos(u * TAU) * R * 0.9, w: R * 0.12, c: hexOf(hue(u)), a: 0.55 }); }
    }
    ctx.restore();
    return lights;
  };
  // stars: varied magnitude, twinkle, a few with glints. o: seed,count,yMax,alpha,x0,x1,y0
  L.stars = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 81); ctx.save(); ctx.globalCompositeOperation = 'screen';
    const warm = dotSprite('#fff1dc', 'hard'), cool = dotSprite('#dfe8ff', 'hard');
    for (let i = 0; i < (o.count || 200); i++) {
      const x = lerp(def(o.x0, 0), def(o.x1, W), r()), y = lerp(def(o.y0, 0), o.yMax || H * 0.6, r()); const m = Math.pow(r(), 3), s = 0.5 + m * 2.5;
      const tw = 0.6 + 0.4 * Math.sin(t * (0.5 + r() * 2) + i), a = (o.alpha || 0.8) * tw * (0.3 + 0.7 * r()), spr = r() < 0.5 ? warm : cool;
      ctx.globalAlpha = Math.min(1, a); drawDot(ctx, spr, x, y, s * 1.6);
      if (m > 0.55) { ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - s * 4, y - 0.4, s * 8, 0.8); ctx.fillRect(x - 0.4, y - s * 4, 0.8, s * 8); }
    }
    ctx.restore();
  };

  /* ===================================================== foliage & komorebi */
  // a leaf (length 60 along +x, base at the origin) in its two tones + midrib; drawn at (-2,-24) in a 66×48 sprite
  function leafSprite(cc, shp) {
    return PV.cached('atm:leaf:' + cc[0] + ':' + cc[1] + ':' + shp, 66, 48, (c) => {
      const L0 = 60, wf = shp === 1 ? 0.62 : shp === 2 ? 1.28 : 1, Lt = L0 * (shp === 2 ? 0.9 : 1), a1 = L0 * 0.42 * wf, a2 = L0 * 0.36 * wf;
      c.translate(2, 24);
      c.fillStyle = cc[0]; c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(L0 * 0.22, -a1, L0 * 0.72, -a2, Lt, 0); c.bezierCurveTo(L0 * 0.72, a2, L0 * 0.22, a1, 0, 0); c.fill();
      c.fillStyle = cc[1]; c.beginPath(); c.moveTo(0, 0); c.lineTo(Lt, 0); c.bezierCurveTo(L0 * 0.72, a2, L0 * 0.22, a1, 0, 0); c.fill();
      c.strokeStyle = cc[2]; c.lineWidth = 2; c.beginPath(); c.moveTo(L0 * 0.04, 0); c.lineTo(Lt * 0.86, 0); c.stroke();
    });
  }
  const folCache = bounded(32);
  function folGeom(o) {
    const key = okey(o), hit = folCache.get(key); if (hit) return hit;
    const r = PV.rng(def(o.seed, 3)), segs = [], leaves = [], depth = def(o.depth, 5), dens = def(o.density, 1), lsz = def(o.leaf, 22);
    const cols = o.colors || ['#7fa04a', '#9bb556', '#c3c25a', '#e2c35a', '#d99a45', '#6f8a3e'];
    const shadeC = o.shadeColor || '#2a3a2c', backC = o.backColor || '#f6f2b0';
    const leafCols = cols.map((c) => { const out = []; for (let k = 0; k < 6; k++) { const lum = k / 5; const lc = mixHex(c, backC, lum * 0.5), dc = mixHex(lc, shadeC, 0.3); out.push([lc, dc, PV.rgba(mixHex(lc, backC, 0.45), 0.55)]); } return out; });
    const leaf = (id, u, side, a, sz) => leaves.push({ s: id, u, a, side, sz: lsz * sz, ci: Math.floor(r() * cols.length), ph: r() * TAU, lum: r() });
    // sympodial growth: each limb = 3 gently curving sub-segments; side shoots at joints; fork at the end
    function grow(parent, relA, len, wd, d) {
      const nSub = 3; let par = parent, w = wd;
      for (let k = 0; k < nSub; k++) {
        const w1 = w * (k === nSub - 1 ? 0.72 : 0.9), id = segs.length;
        segs.push({ p: par, a: k === 0 ? relA : (r() - 0.5) * 0.32, len: (len / nSub) * (0.85 + 0.3 * r()), wd: w, w1, d });
        if (d >= depth - 1) { const nl = Math.round((1.5 + r() * 2) * dens); for (let i = 0; i < nl; i++) leaf(id, (i + 0.5) / nl, i % 2 ? 1 : -1, (r() - 0.5) * 0.5, 0.65 + 0.5 * r()); }
        if (d < depth && k < nSub - 1 && r() < 0.5) grow(id, (r() < 0.5 ? -1 : 1) * (0.55 + 0.4 * r()), len * (0.45 + 0.2 * r()), w1 * 0.7, d + 1);
        par = id; w = w1;
      }
      if (d < depth) {
        grow(par, (r() - 0.5) * 0.45, len * (0.66 + 0.16 * r()), w * 0.9, d + 1);
        if (r() < 0.45) grow(par, (r() < 0.5 ? -1 : 1) * (0.45 + 0.35 * r()), len * (0.5 + 0.2 * r()), w * 0.68, d + 1);
      } else { const nc = Math.round((4 + r() * 4) * dens * def(o.cluster, 1)); for (let i = 0; i < nc; i++) leaf(par, 1, 0, (i / Math.max(1, nc - 1) - 0.5) * 2.4 + (r() - 0.5) * 0.4, 0.75 + 0.5 * r()); }
    }
    grow(-1, 0, def(o.length, 420), def(o.width, 14), 0);
    return folCache.set(key, { segs, leaves, leafCols, depth });
  }
  /* L.foliage(ctx, t, o) — a leafy branch that sways (枝と葉): tapered curved limbs, ovate two-tone leaves
   * in terminal clusters.  Used by hospitalView / komorebi showcases; fine for any foreground greenery.
   * o: x,y (root), angle (growth direction rad), length(420), width(14), depth(5), density(1), leaf(22 px),
   *    colors[], branchColor, back (0..1 backlit translucency), wind (1), seed, shade (0..1 darken toward
   *    shadeColor), blur(px) */
  L.foliage = function (ctx, t, o = {}) {
    const G = folGeom({ seed: o.seed, length: o.length, depth: o.depth, density: o.density, leaf: o.leaf, colors: o.colors, width: o.width, shadeColor: o.shadeColor, backColor: o.backColor, cluster: o.cluster });
    const wind = def(o.wind, 1), back = def(o.back, 0.5), shade = def(o.shade, 0), bcol = o.branchColor || '#4a3a30', droop = def(o.droop, 0.1);
    const P = new Array(G.segs.length);
    for (let i = 0; i < G.segs.length; i++) {
      const s = G.segs[i], par = s.p >= 0 ? P[s.p] : { x: def(o.x, 0), y: def(o.y, 0), a: def(o.angle, 0) };
      const sway = wind * (N2(i * 0.37, t * 0.45) * 0.035 + Math.sin(t * 1.25 + s.d * 0.9) * 0.012) * (0.3 + s.d * 0.3);
      let a = par.a + s.a + sway; a += droop * Math.cos(a) * (0.25 + s.d / G.depth);
      const x1 = par.x + Math.cos(a) * s.len, y1 = par.y + Math.sin(a) * s.len;
      P[i] = { x: x1, y: y1, a, x0: par.x, y0: par.y, a0: a };
    }
    const out = ctx; let bufC = null, fr = 1, bb = null;
    if (o.blur) { // soft focus: paint at reduced resolution, upscale once over the branch's bounding box (no filters)
      fr = o.blur > 2.4 ? 0.25 : 0.5; const m = ctx.getTransform(), mg = def(o.leaf, 22) * 1.6 + def(o.width, 14);
      let ax = 1e9, ay = 1e9, bx = -1e9, by = -1e9; for (const q of P) for (const [px, py] of [[q.x, q.y], [q.x0, q.y0]]) { const X = m.a * px + m.c * py + m.e, Y = m.b * px + m.d * py + m.f; ax = Math.min(ax, X); ay = Math.min(ay, Y); bx = Math.max(bx, X); by = Math.max(by, Y); }
      const sc2 = Math.hypot(m.a, m.b); ax = Math.max(0, Math.floor(ax - mg * sc2)); ay = Math.max(0, Math.floor(ay - mg * sc2)); bx = Math.min(W, Math.ceil(bx + mg * sc2)); by = Math.min(H, Math.ceil(by + mg * sc2));
      if (bx <= ax || by <= ay) return;
      bb = [ax, ay, bx - ax, by - ay]; bufC = PV.buffer('atm:fol' + fr, Math.ceil(W * fr), Math.ceil(H * fr));
      bufC.ctx.clearRect(ax * fr - 1, ay * fr - 1, bb[2] * fr + 2, bb[3] * fr + 2); bufC.ctx.setTransform(m.a * fr, m.b * fr, m.c * fr, m.d * fr, m.e * fr, m.f * fr); ctx = bufC.ctx;
    }
    ctx.save();
    ctx.fillStyle = shade > 0 ? mixHex(bcol, '#000000', shade * 0.5) : bcol;
    ctx.beginPath();
    for (let i = 0; i < G.segs.length; i++) { // tapered, slightly bent limbs as one path
      const s = G.segs[i], p = P[i], nx = -Math.sin(p.a0), ny = Math.cos(p.a0), w0 = s.wd / 2, w1 = s.w1 / 2;
      ctx.moveTo(p.x0 + nx * w0, p.y0 + ny * w0); ctx.lineTo(p.x + nx * w1, p.y + ny * w1); ctx.lineTo(p.x - nx * w1, p.y - ny * w1); ctx.lineTo(p.x0 - nx * w0, p.y0 - ny * w0); ctx.closePath();
    }
    ctx.fill(); ctx.beginPath();
    for (let i = 0; i < G.segs.length; i++) { const w1 = G.segs[i].w1 / 2, p = P[i]; if (w1 > 0.6) { ctx.moveTo(p.x + w1, p.y); ctx.arc(p.x, p.y, w1, 0, TAU); } }
    ctx.fill();
    // leaves: pre-rendered two-tone sprites (one per colour × light level × shape), blitted with a per-leaf
    // transform — overlapping vector leaves cost ~20 ms of raster per frame, sprites a few ms.
    const shd = shade > 0 ? shade : 0, B = ctx.getTransform();
    for (let li = 0; li < G.leaves.length; li++) {
      const lf = G.leaves[li], p = P[lf.s], x = lerp(p.x0, p.x, lf.u), y = lerp(p.y0, p.y, lf.u);
      const shp = Math.floor(PV.rand1(li, 7) * 3);
      const flut = wind * (Math.sin(t * 3.1 + lf.ph) * 0.12 + N2(lf.ph, t * 0.9) * 0.22);
      const a = p.a + (lf.side ? lf.side * (0.75 + lf.a * 0.5) : lf.a) + flut, L0 = lf.sz, sy = 0.8 + 0.2 * Math.cos(t * 2 + lf.ph);
      const lum = clamp(back * (0.3 + 0.7 * lf.lum) * (0.8 + 0.2 * Math.sin(t * 2.3 + lf.ph * 3)) - shd * 0.6), li2 = Math.round(lum * 5);
      const spr = leafSprite(G.leafCols[lf.ci][li2], shp), k = L0 / 60, ca = Math.cos(a) * k, sa = Math.sin(a) * k;
      const m0 = ca, m1 = sa, m2 = -sa * sy, m3 = ca * sy;
      ctx.setTransform(B.a * m0 + B.c * m1, B.b * m0 + B.d * m1, B.a * m2 + B.c * m3, B.b * m2 + B.d * m3, B.a * x + B.c * y + B.e, B.b * x + B.d * y + B.f);
      ctx.drawImage(spr, -2, -24);
    }
    ctx.setTransform(B);
    ctx.restore();
    if (bufC) { out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.drawImage(bufC.canvas, bb[0] * fr, bb[1] * fr, bb[2] * fr, bb[3] * fr, bb[0], bb[1], bb[2], bb[3]); out.restore(); }
  };

  /* L.canopy(ctx, t, o) — 木々の天蓋: a ceiling of leaves at the top of frame (looking up / courtyard framing).
   * Inner leaves are dark silhouettes, leaves near the sun glow translucent yellow-green, the sky and the sun
   * break through the gaps with flickering glints.
   * o: x0,x1 (extent), y0 (top), y1 (mean lower edge), rag (raggedness px, 160), density (1), leaf (26 px),
   *    sun {x,y} (backlight centre), sunR (700), glints (true), wind (1), seed,
   *    colors {dark, mid, lit, glow} */
  const canCache = bounded(6);
  L.canopy = function (ctx, t, o = {}) {
    const sun = o.sun || { x: W * 0.62, y: 40 }, sunR = def(o.sunR, 700), wind = def(o.wind, 1), lsz = def(o.leaf, 26);
    const key = okey({ s: o.seed, x0: o.x0, x1: o.x1, y0: o.y0, y1: o.y1, rag: o.rag, d: o.density, l: o.leaf, c: o.colors, sx: Math.round(sun.x / 8), sy: Math.round(sun.y / 8), sr: Math.round(sunR / 8) });
    let C = canCache.get(key);
    if (!C) {
      const r = PV.rng(def(o.seed, 7)), x0 = def(o.x0, -80), x1 = def(o.x1, W + 80), y0 = def(o.y0, -60), y1 = def(o.y1, 280), rag = def(o.rag, 160), dens = def(o.density, 1);
      const cols = Object.assign({ dark: '#22372a', mid: '#3f6436', lit: '#a9cf5e', glow: '#e6f59a' }, o.colors || {});
      const cl = [], n = Math.round((((x1 - x0) * (y1 - y0 + rag)) / (lsz * lsz * 7)) * dens);
      for (let i = 0; i < n; i++) {
        const x = lerp(x0, x1, r()), edge = y1 + PV.fbm2(x * 0.0045 + 3, 1.7, 3) * rag * 1.6, y = lerp(y0, edge, Math.pow(r(), 0.75)), lay = r();
        cl.push({ x, y, rad: lsz * (1.2 + r() * 1.5), layer: lay < 0.35 ? 0 : lay < 0.7 ? 1 : 2, sd: (r() * 1e6) | 0, ph: r() * TAU });
      }
      cl.sort((a, b) => a.layer - b.layer);
      const steps = (a, b) => { const out = []; for (let k = 0; k < 8; k++) { const c = mixHex(a, b, k / 7); out.push([c, mixHex(c, '#0c1810', 0.28), PV.rgba(mixHex(c, '#ffffff', 0.25), 0.45)]); } return out; };
      const back = steps(cols.dark, cols.mid), front = steps(cols.mid, cols.glow);
      // leaf-cluster templates per (layer, light level): painted once, reused & scaled by every cluster
      const R0 = lsz * 2, S0 = Math.ceil((R0 + lsz) * 2), NT = 8, LV = [1, 3, 4], tmpl = [[], [], []];
      for (let layer = 0; layer < 3; layer++) for (let lv = 0; lv < LV[layer]; lv++) for (let k = 0; k < NT; k++) {
        const near = LV[layer] > 1 ? lv / (LV[layer] - 1) : 0, q = PV.rng(layer * 1000 + lv * 100 + k + def(o.seed, 7) * 7);
        const cv = PV.makeCanvas(S0, S0), c = cv.ctx, nL = 9 + Math.floor(q() * 7);
        for (let j = 0; j < nL; j++) {
          const a0 = q() * TAU, d = Math.sqrt(q()) * R0, lum = q(), L0 = lsz * (0.7 + 0.6 * q()), ang = q() * TAU, shp = Math.floor(q() * 3), wf = shp === 1 ? 0.6 : shp === 2 ? 1.25 : 1;
          let lit, pal;
          if (layer === 0) { lit = 0.15 * lum; pal = back; } else if (layer === 1) { lit = 0.35 + 0.4 * lum + near * 0.3; pal = back; } else { lit = clamp(near * 0.85 + lum * 0.35 - 0.1); pal = front; }
          const cc = pal[Math.max(0, Math.min(7, Math.round(lit * 7)))];
          c.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), S0 / 2 + Math.cos(a0) * d, S0 / 2 + Math.sin(a0) * d * 0.8);
          const a1 = L0 * 0.42 * wf, a2 = L0 * 0.36 * wf;
          c.fillStyle = cc[0]; c.beginPath(); c.moveTo(-L0 / 2, 0); c.bezierCurveTo(-L0 * 0.28, -a1, L0 * 0.22, -a2, L0 / 2, 0); c.bezierCurveTo(L0 * 0.22, a2, -L0 * 0.28, a1, -L0 / 2, 0); c.fill();
          c.fillStyle = cc[1]; c.beginPath(); c.moveTo(-L0 / 2, 0); c.lineTo(L0 / 2, 0); c.bezierCurveTo(L0 * 0.22, a2, -L0 * 0.28, a1, -L0 / 2, 0); c.fill();
          if (layer > 0 && L0 > 14) { c.strokeStyle = cc[2]; c.lineWidth = Math.max(0.6, L0 * 0.035); c.beginPath(); c.moveTo(-L0 * 0.42, 0); c.lineTo(L0 * 0.4, 0); c.stroke(); }
        }
        tmpl[layer].push(cv.canvas);
      }
      for (const c of cl) { const near = clamp(1 - Math.hypot(c.x - sun.x, c.y - sun.y) / sunR), lv = Math.round(near * (LV[c.layer] - 1)); c.spr = tmpl[c.layer][lv * NT + (c.sd % NT)]; c.k = c.rad / R0; }
      // bake into sway sheets: 3 depth layers × 2 interleaved groups, each sways on its own (cheap, organic)
      let maxY = y0; for (const c of cl) maxY = Math.max(maxY, c.y + c.rad + lsz);
      const pad = 40, sx0 = x0 - pad, sy0 = Math.min(y0, -pad) - pad, sw = Math.ceil(x1 - x0 + pad * 2), shh = Math.ceil(maxY - sy0 + pad), sheets = [];
      for (let L0 = 0; L0 < 3; L0++) for (let g = 0; g < (L0 === 2 ? 2 : 1); g++) { // front leaves sway in two groups
        const cv = PV.makeCanvas(sw, shh), c = cv.ctx; c.translate(-sx0, -sy0);
        const inG = (q) => q.layer === L0 && (L0 < 2 || (q.sd & 1) === g);
        if (L0 < 2) { c.fillStyle = back[0][1]; c.beginPath(); for (const q of cl) if (inG(q)) { const k = L0 ? 0.4 : 0.62; c.moveTo(q.x + q.rad * k, q.y); c.ellipse(q.x, q.y, q.rad * k, q.rad * k * 0.8, 0, 0, TAU); } c.fill(); }
        for (const q of cl) if (inG(q)) { const sz = S0 * q.k; c.drawImage(q.spr, q.x - sz / 2, q.y - sz / 2, sz, sz); }
        sheets.push({ cv: cv.canvas, L: L0, g });
      }
      C = canCache.set(key, { cl, back, S0, sheets, sx0, sy0 });
    }
    ctx.save();
    for (const sh of C.sheets) {
      const ph = sh.L * 2.1 + sh.g * 4.3, amp = (0.5 + sh.L * 0.35) * wind, dx = (N2(ph, t * 0.4) * 7 + Math.sin(t * 1.1 + ph) * 3) * amp, dy = (N2(ph + 9, t * 0.35) * 2.5 + Math.sin(t * 0.9 + ph) * 1.2) * amp;
      ctx.drawImage(sh.cv, C.sx0 + dx, C.sy0 + dy);
    }
    if (o.glints !== false) { // the sun flickering through gaps
      const r = PV.rng(def(o.seed, 7) + 99), spr = dotSprite('#fffbe8', 'hard'), halo = dotSprite('#fff3c8');
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 16; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * sunR * 0.45, x = sun.x + Math.cos(a) * d, y = sun.y + Math.sin(a) * d * 0.6, ph = r() * 40, fr = 0.8 + r() * 1.8;
        const k = Math.pow(Math.max(0, Math.sin(t * fr + ph)), 3) * (1 - d / (sunR * 0.45)); if (k < 0.05) continue;
        const sz = 6 + 16 * r() * k;
        ctx.globalAlpha = k * 0.6; drawDot(ctx, halo, x, y, sz * 3); ctx.globalAlpha = k; drawDot(ctx, spr, x, y, sz * 0.5);
        ctx.fillStyle = `rgba(255,252,235,${0.5 * k})`; ctx.fillRect(x - sz * 2.2, y - 0.6, sz * 4.4, 1.2); ctx.fillRect(x - 0.6, y - sz * 1.4, 1.2, sz * 2.8);
      }
    }
    ctx.restore();
  };

  // tileable dapple pattern: clusters of crisp pinhole images of the sun (union of soft-edged discs)
  function fleckSprite(col) {
    return PV.cached('atm:fleck:' + col, 64, 64, (q) => { const k = rgb(col), g = q.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, rgbaS(k, 1)); g.addColorStop(0.76, rgbaS(k, 0.97)); g.addColorStop(0.9, rgbaS(k, 0.4)); g.addColorStop(1, rgbaS(k, 0)); q.fillStyle = g; q.fillRect(0, 0, 64, 64); });
  }
  function dappleTex(col, seed, dens) {
    // tileable sun-patch pattern, painted with crisp vector shapes (no soft sprites — soft dots read as
    // bokeh): irregular openings made of overlapping elliptical sun-images, ringed by small pinhole flecks.
    // Most of the tile stays in shade.
    return PV.cached('atm:dapple4:' + col + ':' + seed + ':' + dens, 512, 512, (c) => {
      const r = PV.rng(seed * 31 + 7), k = rgb(col);
      const wrap = (x, y, rad, fn) => { for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { const X = x + ox, Y = y + oy; if (X + rad < 0 || X - rad > 512 || Y + rad < 0 || Y - rad > 512) continue; fn(X, Y); } };
      const ell = (x, y, rx, ry, rot, a) => wrap(x, y, Math.max(rx, ry) + 1, (X, Y) => { c.globalAlpha = a; c.beginPath(); c.ellipse(X, Y, rx, ry, rot, 0, TAU); c.fill(); });
      c.fillStyle = rgbaS(k, 1);
      const nP = Math.round(4 + 9 * dens);
      for (let p = 0; p < nP; p++) {
        const cx = r() * 512, cy = r() * 512, big = 12 + 58 * Math.pow(r(), 1.7), nE = 2 + Math.floor(r() * 4);
        for (let e = 0; e < nE; e++) { const rx = big * (0.3 + 0.55 * r()), a = r() * TAU, d = big * 0.55 * Math.sqrt(r()); ell(cx + Math.cos(a) * d * 1.2, cy + Math.sin(a) * d, rx, rx * (0.45 + 0.5 * r()), r() * Math.PI, 1); }
        c.globalCompositeOperation = 'source-over'; c.fillStyle = rgbaS(k, 1);
        for (let q = 0, nf = 2 + Math.floor(r() * 7); q < nf; q++) { const a = r() * TAU, d = big * (0.9 + 1.5 * r()), fr = 2 + 6 * Math.pow(r(), 1.6); ell(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, fr, fr * (0.75 + 0.25 * r()), r() * 3, 0.75 + 0.25 * r()); }
      }
      c.globalAlpha = 1;
    });
  }
  /* L.komorebi(ctx, t, o) — 木漏れ日: cool canopy shade + a dappled pattern of warm, crisp sun-flecks (pinhole
   * images of the sun, clustered under canopy gaps) projected onto the ground in perspective, shimmering as
   * the leaves move, plus a few twinkling single flecks. Draw it OVER whatever it falls on.
   * o: x0,y0,x1,y1 (region), perspective (0 wall/top-down … 1 strong ground perspective; default 0.7),
   *    scale (1: pattern size), density (0.6: flecks per patch), coverage (0.6: share of the region under
   *    canopy gaps), color ('#ffdf9a'), strength (1), shade (0.82), shadeColor ('#7e88ab'),
   *    count (40 extra twinkling flecks), spot (24), wind (1), seed, flat (wall flecks' y/x ratio, 0.72) */
  const komoCache = bounded(6);
  L.komorebi = function (ctx, t, o = {}) {
    const x0 = def(o.x0, 0), y0 = def(o.y0, H * 0.55), x1 = def(o.x1, W), y1 = def(o.y1, H), pw = x1 - x0, ph = y1 - y0;
    const persp = def(o.perspective, 0.7), wind = def(o.wind, 1), str = def(o.strength, 1), base = def(o.spot, 24), shade = def(o.shade, 0.82), seed = def(o.seed, 9);
    const lc = o.color || '#ffdf9a', fleck = fleckSprite(lc), halo = dotSprite(lc);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, pw, ph); ctx.clip();
    if (shade > 0) {
      const sc = o.shadeColor || '#7e88ab';
      const sp = PV.cached('atm:komo-shade:' + sc + ':' + seed, 192, 108, (c) => {
        const img = c.createImageData(192, 108), k = rgb(sc);
        for (let j = 0; j < 108; j++) for (let i = 0; i < 192; i++) { const v = PV.fbm2(i / 30 + seed, j / 20, 3) * 0.5 + 0.5, q = (j * 192 + i) * 4, d = 0.75 + 0.25 * sstep(0.3, 0.75, v); img.data[q] = 255 + (k[0] - 255) * d; img.data[q + 1] = 255 + (k[1] - 255) * d; img.data[q + 2] = 255 + (k[2] - 255) * d; img.data[q + 3] = 255; }
        c.putImageData(img, 0, 0);
      });
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = shade;
      const dx = N2(1.3, t * 0.2) * 30 * wind; ctx.drawImage(sp, x0 - 40 + dx, y0 - 20, pw + 80, ph + 40);
      ctx.globalAlpha = 1;
    }
    // dapple pattern projected onto the ground ONCE (1-px rows → continuous perspective, crisp edges), cached;
    // per frame the projected sheet just slides (wind) → masked by canopy-gap patches → screened on
    const bw = Math.max(2, Math.ceil(pw)), bh = Math.max(2, Math.ceil(ph)), buf = PV.buffer('atm:komo', bw, bh), bc = buf.ctx; bc.clearRect(0, 0, bw, bh);
    const dq = Math.round(clamp(def(o.density, 0.6)) * 10) / 10, tex = dappleTex(lc, seed, dq), scl = def(o.scale, 1), flat = def(o.flat, 0.72), mg = 72;
    // projection cached per 64-px size bucket (an animated region does not repaint every frame), bounded
    const qw = Math.ceil(bw / 64) * 64, qh = Math.ceil(bh / 64) * 64;
    const proj = (ou, ov) => { const k = okey({ lc, seed, dq, qw, qh, persp, scl, flat, ou, ov }); let cv = komoCache.get(k);
      if (!cv) { cv = PV.makeCanvas(qw + mg * 2, qh + mg * 2).canvas; const c = cv.getContext('2d'), pat = c.createPattern(tex, 'repeat'); c.fillStyle = pat; let tv = ov;
        for (let y = 0; y < qh + mg * 2; y++) {
          const vm = clamp((y - mg + 0.5) / qh), sc = scl * (persp > 0 ? lerp(1 - persp * 0.7, 1, vm) : 1), fy = persp > 0 ? lerp(1 - persp * 0.78, 1 - persp * 0.42, vm) : flat;
          pat.setTransform(new DOMMatrix([sc, 0, 0, sc * fy, (qw + mg * 2) / 2 - (256 + ou) * sc, y - tv * sc * fy])); c.fillRect(0, y, qw + mg * 2, 1); tv += 1 / (sc * fy);
        }
        komoCache.set(k, cv); }
      return cv; };
    const layers = [[0, 0, str, 0.33], [173, 251, 0.14 * str * (0.55 + 0.45 * Math.sin(t * 1.7 + 1)), 0.52]];
    for (const [ou, ov, al, fq] of layers) {
      if (al <= 0.01) continue;
      const su = wind * (N2(ou * 0.01 + 3, t * fq) * 26 + Math.sin(t * 0.9 + ou) * 7), sv = wind * N2(ov * 0.01 + 7, t * fq) * 10;
      const pj = proj(ou, ov), sY = bh / qh; bc.globalAlpha = Math.min(1, al); // rows [mg, mg+qh] of the projection ↦ [0, bh]
      bc.drawImage(pj, -mg + (bw - qw) / 2 + clamp(su, -mg, mg) * 0.8, -mg * sY + clamp(sv, -mg, mg) * 0.6, pj.width, pj.height * sY);
    }
    bc.globalAlpha = 1;
    const cov = def(o.coverage, 0.6);
    if (cov < 0.99) {
      const mk = PV.cached('atm:komo-mask2:' + seed + ':' + Math.round(cov * 20), 128, 72, (c) => {
        const img = c.createImageData(128, 72);
        for (let j = 0; j < 72; j++) for (let i = 0; i < 128; i++) { const v = PV.fbm2(i / 22 + seed * 1.3, j / 14, 3) * 0.5 + 0.5, q = (j * 128 + i) * 4; img.data[q] = img.data[q + 1] = img.data[q + 2] = 0; img.data[q + 3] = 255 * sstep(1 - cov - 0.045, 1 - cov + 0.045, v); }
        c.putImageData(img, 0, 0);
      });
      bc.globalCompositeOperation = 'destination-in'; bc.drawImage(mk, -60 + N2(seed, t * 0.15) * 40 * wind, -30, bw + 120, bh + 60); bc.globalCompositeOperation = 'source-over';
    }
    ctx.globalCompositeOperation = 'screen'; ctx.drawImage(buf.canvas, 0, 0, bw, bh, x0, y0, bw, bh);
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.45 * Math.min(1, str); ctx.drawImage(buf.canvas, 0, 0, bw, bh, x0, y0, bw, bh); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'screen';
    const r = PV.rng(seed), n = def(o.count, 40);
    for (let i = 0; i < n; i++) {
      const u = r(), v = Math.pow(r(), 0.85), sz = r(), ar = r(), fl = r() * 50, k = r() * 9;
      const sway = wind * (N2(k, t * 0.32) * 0.02 + Math.sin(t * 0.9 + k) * 0.006);
      const flick = sstep(-0.2, 0.5, N2(fl, t * 1.3 * wind));
      const depth = lerp(1 - persp * 0.6, 1, v), rx = base * depth * (0.35 + sz * 0.8), ry = rx * (persp > 0 ? lerp(1 - persp * 0.78, 1 - persp * 0.42, v) : def(o.flat, 0.72)) * (0.8 + 0.35 * ar);
      const a = str * flick * (0.55 + 0.45 * ar); if (a < 0.02) continue;
      const X = x0 + (u + sway) * pw, Y = y0 + v * ph;
      ctx.globalAlpha = Math.min(1, a * 0.85); ctx.drawImage(fleck, X - rx, Y - ry, rx * 2, ry * 2);
    }
    ctx.restore();
  };

  /* L.hospitalView(ctx, t, o) — 病室の窓外: high autumn sky with mackerel clouds, the distant white bridge
   * over the bay, hazy town, and branches with yellowing leaves swaying close to the window.
   * Fills (and clips to) the rect x,y,w,h (default full frame) with "cover" fitting.
   * o: x,y,w,h, seed, branches(true), wind(1), leafBlur(px, default ≈1.2 — the near branch is slightly out of
   *    focus), alignX/alignY(0.5), bridge(true), bridgeX(0.36), mackerel (cloud coverage 0.4), morph (0) */
  L.hospitalView = function (ctx, t, o = {}) {
    const x = def(o.x, 0), y = def(o.y, 0), w = def(o.w, W), h = def(o.h, H), seed = def(o.seed, 5);
    const hz = H * 0.78;
    const far = PV.cached('hosp:far:' + okey({ seed, b: o.bridge, bx: o.bridgeX }), W, H, (c) => {
      L.skyDome(c, 0, { preset: 'autumn', horizon: hz, haze: 0.5, seed, sun: { x: -180, y: -120, scale: 1.3, rays: 0.25, halo: false } });
      L.cloudBand(c, 0, { kind: 'cirrus', x: 0, y: 40, w: W, h: 260, seed: seed + 2, coverage: 0.42, palette: 'autumn', light: -2.6, alpha: 0.55, speed: 0 });
      // distant hills & town in aerial perspective
      c.fillStyle = PV.linGrad(c, 0, hz - 70, 0, hz + 30, [[0, '#a9bfd8'], [1, '#c3d3e2']]);
      c.beginPath(); c.moveTo(0, hz + 10); for (let i = 0; i <= 48; i++) { const xx = (i / 48) * W; c.lineTo(xx, hz - 22 - 30 * (PV.fbm2(i * 0.11 + seed, 0.5, 3) * 0.5 + 0.5) - (i > 30 ? 0 : 18 * Math.sin(i * 0.12))); } c.lineTo(W, hz + 10); c.closePath(); c.fill();
      L.skyline(c, { seed: seed + 11, y: hz + 6, hMin: 10, hMax: 46, wMin: 14, wMax: 46, color: '#9fb4cc', gap: 4 });
      // the bay
      L.sea(c, 0, { horizonY: hz + 4, y1: H, palette: 'autumn', sunX: 300, sparkles: 140, shimmer: 0.5, road: 0.25 });
      if (o.bridge !== false) { const bx = def(o.bridgeX, 0.36) * W; L.bridge(c, { x0: bx - W * 0.3, x1: bx + W * 0.3, y: hz - 3, towerH: 108, lw: 2.1, cables: 9, haze: 0.18, hazeColor: '#e3edf5', pierH: 16, span: 150 }); }
      const g = c.createLinearGradient(0, hz - 120, 0, H); g.addColorStop(0, 'rgba(232,240,246,0)'); g.addColorStop(0.35, 'rgba(232,240,246,0.35)'); g.addColorStop(1, 'rgba(232,240,246,0.15)'); c.fillStyle = g; c.fillRect(0, hz - 120, W, H);
    });
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const sc = Math.max(w / W, h / H), ox = x + (w - W * sc) * def(o.alignX, 0.5), oy = y + (h - H * sc) * def(o.alignY, 0.5);
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
    ctx.drawImage(far, 0, 0);
    L.cloudBand(ctx, t, { kind: 'mackerel', x: 0, y: 60, w: W, h: 600, seed: seed + 1, coverage: def(o.mackerel, 0.38), cell: 22, perspective: 0.82, palette: 'autumn', light: -2.6, speed: 6, alphaK: 0.76, morph: def(o.morph, 0) });
    ctx.restore();
    if (o.branches !== false) {
      const k = Math.max(w, h) / 1400, wind = def(o.wind, 1);
      const lb = def(o.leafBlur, 1.2 * k), bc = '#5b4636';
      L.foliage(ctx, t, { x: x + w + 30 * k, y: y - 20 * k, angle: 2.5, length: 330 * k, width: 22 * k, depth: 5, leaf: 32 * k, density: 0.6, cluster: 0.5, droop: 0.05, seed: seed + 3, back: 0.6, wind, blur: lb, branchColor: bc, shadeColor: '#5d5a3a', colors: ['#d8b452', '#e6c862', '#c99a3f', '#a8a84c', '#e9d27a', '#8f9a43', '#c97f3b'] });
      L.foliage(ctx, t, { x: x + w * 0.66, y: y - 40 * k, angle: 1.9, length: 220 * k, width: 14 * k, depth: 4, leaf: 28 * k, density: 0.65, cluster: 0.5, droop: 0.06, seed: seed + 7, back: 0.65, wind: wind * 1.2, blur: lb, branchColor: bc, shadeColor: '#5d5a3a', colors: ['#e2c35a', '#d99a45', '#c3c25a', '#e9d27a', '#b9a24a'] });
    }
    ctx.restore();
  };

  /* L.sunset(ctx, t, o) — 夕焼け: complete sunset sky (gradient, low sun, under-lit streak clouds,
   * sunset-lit cumulus, crepuscular rays).
   * o: horizon (y, 0.66H), sunX, sunY, seed, preset ('sunset'|'dusk'), cumulus(true), rays(true) */
  L.sunset = function (ctx, t, o = {}) {
    const hz = def(o.horizon, H * 0.66), sx = def(o.sunX, W * 0.62), sy = def(o.sunY, hz - 50), seed = def(o.seed, 2);
    const pre = o.preset || 'sunset';
    L.skyDome(ctx, t, { preset: pre, horizon: hz, seed, haze: 0.5, sun: { x: sx, y: sy, scale: 1.15, rays: 0.35, halo: false, glow: '#ffb070', color: '#fff3d0', intensity: 0.95 } });
    L.cloudBand(ctx, t, { kind: 'streak', palette: 'sunsetHigh', light: Math.PI / 2 + (sx > W / 2 ? 0.25 : -0.25), x: 0, y: hz * 0.04, w: W, h: hz * 0.42, coverage: 0.42, scaleX: 700, scaleY: 60, seed: seed + 1, speed: 3, alpha: 0.95, gain: 1.8, base: 0.42, thick: 0.3 });
    if (o.cumulus !== false) L.clouds(ctx, t, { seed: seed + 5, count: 5, y0: hz * 0.36, y1: hz * 0.7, minW: 260, maxW: 680, palette: 'sunset', lightZ: -0.25, horizon: hz, hazeK: 0.3, speed: 4, sun: { x: sx, y: sy + 160 }, aspect: [0.3, 0.42] });
    L.cloudBand(ctx, t, { kind: 'streak', palette: 'dusk', light: Math.PI / 2, x: 0, y: hz * 0.72, w: W, h: hz * 0.26, coverage: 0.42, scaleX: 900, scaleY: 34, seed: seed + 2, speed: 5, alpha: 0.85, gain: 2, base: 0.45 });
    if (o.rays !== false) L.godRays(ctx, t, { x: sx, y: sy, angle: -Math.PI / 2, spread: 2.4, count: 12, length: 1500, width: 90, flare: 4, alpha: 0.07, color: '#ffd7a0', seed: seed + 3, jitter: 30 });
  };

  /* L.wires(ctx, o) — 電線と電柱 silhouettes (suburban Japan). o: poles [x...], y (pole top), h (pole length),
   * color, lines (4), sag (px), lw (3) */
  L.wires = function (ctx, o = {}) {
    const poles = o.poles || [300, 1500], y = def(o.y, 380), ph = def(o.h, 700), col = o.color || '#151a2c', lw = def(o.lw, 3), n = def(o.lines, 4), sag = def(o.sag, 60);
    ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col;
    for (const px of poles) { ctx.fillRect(px - lw * 2.4, y, lw * 4.8, ph); ctx.fillRect(px - lw * 22, y + lw * 6, lw * 44, lw * 2.2); ctx.fillRect(px - lw * 16, y + lw * 18, lw * 32, lw * 1.8); ctx.fillRect(px + lw * 3, y + lw * 24, lw * 7, lw * 9); }
    ctx.lineWidth = Math.max(1, lw * 0.5);
    const ext = [-400, ...poles, W + 400];
    for (let i = 0; i < n; i++) {
      const yy = y + lw * (6 + (i % 2) * 12) - lw, xo = (i - n / 2) * lw * 9;
      ctx.beginPath();
      for (let k = 0; k < ext.length - 1; k++) { const a = ext[k] + xo, b = ext[k + 1] + xo; ctx.moveTo(a, yy); ctx.quadraticCurveTo((a + b) / 2, yy + sag * (1 + i * 0.12) * 2, b, yy); }
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ========================================================= music particles */
  // a single note glyph path (eighth note) centred at 0,0 with size s
  L.noteShape = function (ctx, s, kind = 0) {
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.3, -0.45, 0, TAU); ctx.fill();
    ctx.fillRect(s * 0.3, -s * 1.5, s * 0.09, s * 1.5);
    if (kind === 1) { ctx.beginPath(); ctx.moveTo(s * 0.39, -s * 1.5); ctx.quadraticCurveTo(s * 0.95, -s * 1.05, s * 0.75, -s * 0.55); ctx.quadraticCurveTo(s * 0.8, -s * 1.0, s * 0.39, -s * 1.15); ctx.fill(); }
  };
  // swirling "snowstorm" of notes/ice. o: seed,count,cx,cy,radius,speed,color,alpha,size,streak,squash,fall,noteRatio
  L.noteStorm = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 91); const cx = o.cx || W / 2, cy = o.cy || H / 2;
    ctx.save();
    for (let i = 0; i < (o.count === undefined ? 260 : o.count); i++) {
      const rad = (o.radius || 900) * Math.sqrt(r()); const a0 = r() * TAU; const w = (o.speed || 0.9) * (0.4 + 0.9 * r()) * (300 / (rad + 150));
      const a = a0 + t * w; const z = 0.3 + 0.7 * r();
      const x = cx + Math.cos(a) * rad * (o.squash || 1.6) + N2(i, t * 0.3) * 40, y = cy + Math.sin(a) * rad * 0.6 + N2(i + 9, t * 0.3) * 40 + (o.fall || 0) * t;
      const isNote = r() < (o.noteRatio === undefined ? 0.35 : o.noteRatio); const s = (o.size || 16) * z;
      const al = (o.alpha || 0.85) * z;
      ctx.fillStyle = PV.rgba(o.color || '#eef6ff', al); ctx.strokeStyle = PV.rgba(o.color || '#eef6ff', al * 0.5);
      const tx = -Math.sin(a) * (o.squash || 1.6), ty = Math.cos(a) * 0.6; const sl = (o.streak || 22) * z * w * 3;
      ctx.lineWidth = Math.max(1, s * 0.12); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - tx * sl, y - ty * sl); ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.rotate(a * 0.2 + i);
      if (isNote) L.noteShape(ctx, s, i % 2); else { ctx.beginPath(); ctx.arc(0, 0, s * 0.18, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
  };

  /* ================================================================== misc */
  // flat colour fill helper with optional noise texture (paper / watercolor feel)
  L.paper = function (ctx, alpha = 0.06, seed = 5) {
    const tex = PV.cached('paper' + seed, 512, 512, (c) => {
      const img = c.createImageData(512, 512); const r = PV.rng(seed);
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) { const v = 128 + PV.fbm2(x / 60, y / 60, 4) * 80 + (r() - 0.5) * 30; const i = (y * 512 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      c.putImageData(img, 0, 0);
    });
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = alpha;
    for (let y = 0; y < H; y += 512) for (let x = 0; x < W; x += 512) ctx.drawImage(tex, x, y);
    ctx.restore();
  };
  // depth-of-field style blur of whatever is drawn by fn (draws into a temp buffer then back with blur)
  L.blurred = function (ctx, px, fn, key = 'blurTmp') {
    const b = PV.buffer(key); b.ctx.clearRect(0, 0, W, H); fn(b.ctx);
    ctx.save(); ctx.filter = `blur(${px}px)`; ctx.drawImage(b.canvas, 0, 0); ctx.restore();
  };
})();

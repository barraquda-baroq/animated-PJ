// dev-only showcase: full-frame finished backgrounds built from pv/engine/lib/atmos.js
//   dev_bg_1 春の青空と雲        dev_bg_2 夏の海・入道雲・白い大橋   dev_bg_3 夜の臨海公園（対岸の夜景と水面）
//   dev_bg_4 嵐の橋（雷光）      dev_bg_5 病室の窓外                dev_bg_6 中庭の木漏れ日
//   dev_bg_7 三日月の夜          dev_bg_8 夕焼けの海と橋
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;
  // low hazy land mass on the horizon (x0..x1, rising to height h) with a wooded, noisy top edge
  function land(ctx, x0, x1, hz, h, col, seed) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, hz + 1);
    for (let x = x0; x <= x1; x += 6) { const u = (x - x0) / (x1 - x0), env = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.6; ctx.lineTo(x, hz - h * env * (0.8 + 0.2 * PV.noise2(x * 0.02, seed)) - 2.5 * PV.noise2(x * 0.15, seed + 3) * env); }
    ctx.lineTo(x1, hz + 1); ctx.closePath(); ctx.fill();
  }

  /* 1 ─ 春の青空と雲 */
  PV.shot('dev_bg_1', { draw(ctx, t) {
    const hz = 940, sun = { x: 1590, y: 110 };
    L.skyDome(ctx, t, { preset: 'spring', horizon: hz, seed: 1, sun: { x: sun.x, y: sun.y, scale: 0.9, rays: 0.5 } });
    L.cloudBand(ctx, t, { kind: 'cirrus', x: 0, y: 30, w: W, h: 300, seed: 4, coverage: 0.4, palette: 'spring', light: -2.5, alpha: 0.45, speed: 3 });
    L.clouds(ctx, t, { seed: 23, count: 5, y0: 560, y1: 760, minW: 160, maxW: 360, palette: 'spring', horizon: hz, sun, speed: 4, type: 'puff' });
    L.clouds(ctx, t, { seed: 21, count: 4, y0: 170, y1: 520, minW: 520, maxW: 980, palette: 'spring', horizon: hz, sun, speed: 8 });
    L.skyline(ctx, { seed: 5, y: H + 4, hMin: 24, hMax: 110, wMin: 26, wMax: 80, color: '#a9c1dc', gap: 3 });
    L.skyline(ctx, { seed: 6, y: H + 4, hMin: 10, hMax: 60, wMin: 30, wMax: 90, color: '#93adcc', gap: 2 });
    const g = ctx.createLinearGradient(0, hz - 200, 0, H); g.addColorStop(0, 'rgba(236,243,246,0)'); g.addColorStop(1, 'rgba(236,243,246,0.25)'); ctx.fillStyle = g; ctx.fillRect(0, hz - 200, W, H);
    L.petals(ctx, t, { seed: 5, count: 22, size: 12, wind: 90 });
  } });

  /* 2 ─ 夏の海と入道雲と白い大橋 */
  PV.shot('dev_bg_2', { draw(ctx, t) {
    const hz = 650;
    L.skyDome(ctx, t, { preset: 'summer', horizon: hz, seed: 2, sun: { x: 240, y: -70, scale: 1.4, rays: 0.45 } });
    L.cloudBand(ctx, t, { kind: 'cirrus', x: 0, y: 10, w: W, h: 260, seed: 7, coverage: 0.33, palette: 'summer', alpha: 0.4, speed: 2, light: -2.8 });
    L.cumulonimbus(ctx, t, { x: 400, base: hz + 6, w: 640, h: 380, seed: 12, light: -2.6, lightZ: 0.35, haze: 0.28, fade: 0.45, drift: 1.2, anvil: 0.9 });
    L.cumulonimbus(ctx, t, { x: 1360, base: hz + 10, w: 1120, h: 600, seed: 4, light: -2.75, lightZ: 0.3, fade: 0.3, drift: 1.5 });
    L.clouds(ctx, t, { seed: 31, count: 3, x0: 760, x1: 1180, y0: 20, y1: 110, minW: 150, maxW: 260, type: 'puff', palette: 'summer', speed: 6, light: -2.6, lightZ: 0.4, haze: 0.1 });
    // far headlands where the bridge lands (aerial perspective)
    land(ctx, -20, 330, hz, 34, '#a9c2d8', 3); land(ctx, 880, 1260, hz, 16, '#bcd0e1', 4);
    L.sea(ctx, t, { horizonY: hz, palette: 'summer', sunX: 300, sunY: -70, road: 0.6 });
    L.bridge(ctx, { x0: 40, x1: 1080, y: hz - 10, towerH: 215, lw: 4.4, cables: 11, haze: 0.04, hazeColor: '#e6f2fa', pierH: 10, span: 215, towers: [330, 790] });
  } });

  /* 3 ─ 夜の臨海公園：対岸の夜景と水面 */
  PV.shot('dev_bg_3', { draw(ctx, t) {
    const hz = 610;
    L.skyDome(ctx, t, { preset: 'city', horizon: hz, seed: 3, haze: 0.5 });
    L.stars(ctx, t, { seed: 3, count: 120, yMax: hz * 0.6, alpha: 0.55 });
    L.cloudBand(ctx, t, { kind: 'streak', x: 0, y: 120, w: W, h: 300, seed: 9, coverage: 0.36, palette: 'night', light: Math.PI / 2, alpha: 0.35, speed: 4, gain: 2 });
    const far = L.skyline(ctx, { seed: 31, y: hz, hMin: 30, hMax: 130, wMin: 20, wMax: 70, color: '#2a2e58', lit: 0.3, win: [2, 3, 5, 6], glow: 0.5, haze: 0.25, hazeColor: '#3a3a6a', t });
    const fw = L.ferrisWheel(ctx, t, { x: 1330, y: hz - 185, r: 158, night: true, legH: 24, haze: 0.15 });
    const near = L.skyline(ctx, { seed: 32, x0: -20, x1: 1180, y: hz + 3, hMin: 40, hMax: 270, wMin: 34, wMax: 110, color: '#161b38', lit: 0.42, glow: 0.8, skyGlow: '#7a5a80', t });
    const br = L.bridge(ctx, { x0: 1440, x1: 2500, y: hz - 30, towerH: 230, lw: 4.2, night: true, t, cables: 11, pierH: 30, span: 260, towers: [1700, 2240] });
    L.nightWater(ctx, t, { horizonY: hz + 3, lights: far.concat(near, br, fw), seed: 3 });
    // seaside-park railing in the foreground
    ctx.fillStyle = '#070a16'; ctx.fillRect(0, 900, W, 14); ctx.fillRect(0, 960, W, 8);
    for (let x = 40; x < W; x += 210) ctx.fillRect(x, 900, 12, 180);
    ctx.fillStyle = 'rgba(160,170,220,0.25)'; ctx.fillRect(0, 900, W, 2);
    L.bokeh(ctx, t, { seed: 4, count: 9, rmin: 50, rmax: 110, x0: -60, x1: 700, y0: 900, y1: 1120, alpha: 0.38, mode: 'lighter', colors: ['#c8701c', '#c2456e', '#d0a246', '#5a86c8'] });
    L.bokeh(ctx, t, { seed: 9, count: 6, rmin: 40, rmax: 90, x0: 1500, x1: 1980, y0: 940, y1: 1120, alpha: 0.32, mode: 'lighter', colors: ['#d0a246', '#c8701c', '#8a6ad0'] });
  } });

  /* 4 ─ 嵐の橋（雷光で一瞬照らされる世界）*/
  PV.shot('dev_bg_4', { draw(ctx, t) {
    const hz = 720, strikes = [0.9, 4.0], fl = L.flashCurve(t, strikes);
    L.skyDome(ctx, t, { preset: 'storm', horizon: hz, seed: 4, haze: 0.75, hazeColor: '#4a5878', hazeH: 260 });
    L.stormClouds(ctx, t, { h: 760, seed: 4, flash: fl, flashX: 1220, flashY: 220, speed: 22 });
    const segs = L.lightningPath(91, 1240, 330, 1130, hz - 10, 0.36, 7);
    const bolt = Math.max(L.flashCurve(t, [strikes[0]], { decay: 0.25 }), L.flashCurve(t, [strikes[1]], { decay: 0.25 }));
    L.lightning(ctx, segs, bolt);
    L.rainCurtain(ctx, t, { x0: -200, x1: W + 200, y0: 380, y1: hz + 20, count: 7, seed: 4, alpha: 0.5 + 0.3 * fl, color: '#b9c7e2' });
    L.sea(ctx, t, { horizonY: hz, palette: 'storm', sparkle: false, shimmer: 0.6, wobble: 2.5, swell: 1, chop: 1.4 });
    L.bridge(ctx, { x0: -260, x1: 2200, y: hz - 60, towerH: 420, lw: 8, night: true, t, cables: 12, pierH: 80, span: 520, flash: fl, lamps: 0, uplight: 0.05, color: '#10172a', shadow: '#080c18', rim: '#cfdcff', rimAmt: fl });
    L.rain(ctx, t, { seed: 2, count: 700, angle: 0.25, speed: 2600, len: 120, alpha: 0.32 + 0.3 * fl, color: '#c9d6f0' });
    L.splashes(ctx, t, { y0: 940, y1: 1080, count: 50 });
    if (fl > 0) { ctx.fillStyle = `rgba(220,232,255,${0.28 * fl})`; ctx.fillRect(0, 0, W, H); }
  } });

  /* 5 ─ 病室の窓外（窓枠つきの使用例）*/
  PV.shot('dev_bg_5', { draw(ctx, t) {
    // room wall
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, W, 0, [[0, '#dfe7ec'], [0.5, '#eef3f5'], [1, '#d9e2e8']]); ctx.fillRect(0, 0, W, H);
    const wx = 250, wy = 80, ww = 1420, wh = 820;
    L.hospitalView(ctx, t, { x: wx, y: wy, w: ww, h: wh, seed: 5 });
    // window frame (aluminium, cold white) + mullion
    ctx.fillStyle = '#f4f7f8'; ctx.fillRect(wx - 26, wy - 26, ww + 52, 26); ctx.fillRect(wx - 26, wy + wh, ww + 52, 34); ctx.fillRect(wx - 26, wy, 26, wh); ctx.fillRect(wx + ww, wy, 26, wh);
    ctx.fillRect(wx + ww / 2 - 9, wy, 18, wh);
    ctx.fillStyle = 'rgba(120,140,160,0.35)'; ctx.fillRect(wx, wy, ww, 4); ctx.fillRect(wx + ww / 2 + 9, wy, 3, wh);
    ctx.fillStyle = '#cfd9e0'; ctx.fillRect(wx - 40, wy + wh + 34, ww + 80, 26);
    // sheer curtain gathered at the left: soft folds (thin vertical strokes modulated by a fold wave)
    for (let x = wx - 40; x < wx + 250; x += 2) {
      const u = (x - (wx - 40)) / 290, fold = 0.5 + 0.5 * Math.sin(x * 0.075 + Math.sin(t * 0.6) * 0.6), a = (1 - u) * 0.75 * (0.55 + 0.45 * fold);
      ctx.fillStyle = `rgba(${Math.round(232 + 23 * fold)},${Math.round(238 + 17 * fold)},${Math.round(243 + 12 * fold)},${a.toFixed(3)})`; ctx.fillRect(x, wy - 30, 2, wh + 60);
    }
    L.glow(ctx, wx + ww * 0.3, wy + 120, 900, '#ffffff', 0.25);
  } });

  /* 6 ─ 中庭の木漏れ日 */
  PV.shot('dev_bg_6', { draw(ctx, t) {
    const gy = 600;
    L.skyDome(ctx, t, { preset: 'spring', horizon: gy, seed: 6, haze: 0.4 });
    // school building across the courtyard
    ctx.fillStyle = PV.linGrad(ctx, 0, 150, 0, gy, [[0, '#efe6d4'], [1, '#e2d6c0']]); ctx.fillRect(0, 150, W, gy - 150);
    ctx.fillStyle = '#d4c6ae'; ctx.fillRect(0, 150, W, 10); ctx.fillRect(0, 372, W, 12);
    for (let f = 0; f < 2; f++) for (let i = 0; i < 11; i++) {
      const x = 40 + i * 176, y = 196 + f * 222, w = 128, h = 140;
      ctx.fillStyle = PV.linGrad(ctx, 0, y, 0, y + h, [[0, '#a9cdec'], [0.6, '#d6e8f4'], [1, '#bcd6ea']]); ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(x + 20, y); ctx.lineTo(x + 60, y); ctx.lineTo(x + 20, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + 30); ctx.fill();
      ctx.fillStyle = '#c9bba2'; ctx.fillRect(x - 4, y - 4, w + 8, 4); ctx.fillRect(x - 4, y + h, w + 8, 6); ctx.fillRect(x + w / 2 - 2, y, 4, h);
    }
    // ground (paving in perspective) + grass verge
    ctx.fillStyle = PV.linGrad(ctx, 0, gy, 0, H, [[0, '#cbbfa8'], [1, '#b6a68b']]); ctx.fillRect(0, gy, W, H - gy);
    ctx.strokeStyle = 'rgba(120,104,84,0.25)'; ctx.lineWidth = 2;
    for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 90, gy); ctx.lineTo(W / 2 + i * 340, H); ctx.stroke(); }
    for (let k = 1; k < 9; k++) { const y = gy + (H - gy) * Math.pow(k / 9, 1.8); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = '#7f9a4e'; ctx.fillRect(0, gy - 6, W, 14);
    // bench
    const bx = 760, by = 780;
    ctx.fillStyle = '#6b4a34'; ctx.fillRect(bx, by - 120, 420, 22); ctx.fillRect(bx, by - 84, 420, 18);
    ctx.fillStyle = '#8a6244'; ctx.fillRect(bx - 10, by - 30, 440, 26);
    ctx.fillStyle = '#3c3a3a'; ctx.fillRect(bx + 20, by - 120, 12, 150); ctx.fillRect(bx + 388, by - 120, 12, 150);
    ctx.fillStyle = 'rgba(40,30,30,0.28)'; ctx.beginPath(); ctx.ellipse(bx + 210, by + 40, 260, 22, 0, 0, Math.PI * 2); ctx.fill();
    // tree trunk at the left
    ctx.fillStyle = PV.linGrad(ctx, 160, 0, 300, 0, [[0, '#3e2f27'], [0.6, '#5b4536'], [1, '#3a2c25']]);
    ctx.beginPath(); ctx.moveTo(150, H); ctx.bezierCurveTo(190, 800, 170, 400, 210, 0); ctx.lineTo(300, 0); ctx.bezierCurveTo(270, 420, 300, 820, 330, H); ctx.fill();
    // dappled light over ground, bench and wall base
    L.komorebi(ctx, t, { x0: 0, y0: gy - 40, x1: W, y1: H, perspective: 0.75, count: 50, spot: 26, seed: 6, density: 0.7 });
    L.komorebi(ctx, t, { x0: 0, y0: 150, x1: W, y1: gy - 40, perspective: 0, count: 20, spot: 20, seed: 16, shade: 0.3, strength: 0.6, flat: 0.6, coverage: 0.35, density: 0.4, scale: 0.8 });
    // canopy overhead
    // canopy ceiling with the sun breaking through
    L.sun(ctx, 1240, 70, { scale: 0.7, rays: 0.6, halo: false, t });
    L.canopy(ctx, t, { y0: -60, y1: 190, rag: 150, density: 2.2, leaf: 24, seed: 6, sun: { x: 1240, y: 70 }, sunR: 760 });
    L.dust(ctx, t, { seed: 6, count: 70, x0: 300, x1: 1700, y0: 100, y1: 900, size: 3, alpha: 0.6 });
  } });

  /* 7 ─ 三日月の夜 */
  PV.shot('dev_bg_7', { draw(ctx, t) {
    const hz = 880;
    L.skyDome(ctx, t, { preset: 'night', horizon: hz, seed: 7, haze: 0.35, hazeColor: '#3a3f6e' });
    L.stars(ctx, t, { seed: 8, count: 260, yMax: hz * 0.85, alpha: 0.75 });
    L.moon(ctx, { x: 1400, y: 230, r: 60, phase: 0.2, tilt: -2.5, halo: 0.5 });
    L.cloudBand(ctx, t, { kind: 'streak', x: 0, y: 200, w: W, h: 340, seed: 17, coverage: 0.34, palette: 'night', light: -2.0, alpha: 0.7, speed: 6, gain: 2.6 });
    L.skyline(ctx, { seed: 71, y: H - 40, hMin: 50, hMax: 210, wMin: 40, wMax: 120, color: '#121733', lit: 0.16, win: [3, 4, 9, 10], glow: 0.6, skyGlow: '#4a4a7a', haze: 0.2, hazeColor: '#2a3160', t });
    L.skyline(ctx, { seed: 72, y: H + 2, hMin: 50, hMax: 120, wMin: 90, wMax: 170, color: '#080b18', lit: 0.1, win: [6, 7, 18, 20], glow: 0.7, style: 'town', windowColors: ['#ffcf86', '#ffe2b0'], t });
    L.wires(ctx, { poles: [1180, 1820], y: 470, h: 700, lw: 3.2, color: '#070a14', sag: 34 });
  } });

  /* 8 ─ 夕焼けの海と橋 */
  PV.shot('dev_bg_8', { draw(ctx, t) {
    const hz = 700, sx = 1240, sy = 640;
    L.sunset(ctx, t, { horizon: hz, sunX: sx, sunY: sy, seed: 8 });
    L.sea(ctx, t, { horizonY: hz, palette: 'sunset', sunX: sx, sunY: sy, road: 0.9, sparkles: 520 });
    land(ctx, 860, 1180, hz, 22, '#4a3654', 2);
    L.bridge(ctx, { x0: -140, x1: 1000, y: hz - 14, towerH: 220, lw: 3.8, cables: 11, color: '#3c2f4f', shadow: '#2a2140', pierH: 14, span: 240, towers: [180, 640], light: 'right', rim: '#ffb977', rimAmt: 0.7 });
  } });
})();

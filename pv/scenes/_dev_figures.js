// dev-only showcase scenes for the figures library (PV.lib figures) — see analysis/art_review/figures_API.md
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, PI = Math.PI;

  /* ---------- 1: overview of every figure function (neutral dusk gradient) */
  PV.shot('dev_figures_1', { draw(ctx, t) {
    L.sky(ctx, [[0, '#5b6a8c'], [0.55, '#c9a9a0'], [1, '#f1d7b8']]);
    L.glow(ctx, 360, 120, 900, '#fff1d6', 0.55);
    const lt = -2.3, rc = '#ffe7c4', y1 = 500, y2 = 1035;
    L.girlAtPianoBack(ctx, t, { x: 190, y: y1 - 120, scale: 0.55, intensity: 0.8, light: lt, rimColor: rc });
    L.boySeated(ctx, t, { x: 520, y: y1 - 85, scale: 0.5, pose: 'juice', light: lt, rimColor: rc });
    L.boySeated(ctx, t, { x: 830, y: y1 - 85, scale: 0.5, pose: 'guitar', light: lt, rimColor: rc });
    L.coupleSittingBack(ctx, t, { x: 1200, y: y1 - 110, scale: 0.5, lean: 1, earphones: true, light: lt, rimColor: rc });
    L.girlRunning(ctx, t, { x: 1640, y: y1, scale: 0.6, light: lt, rimColor: rc });
    L.embrace(ctx, t, { x: 170, y: y2, scale: 0.6, light: lt, rimColor: rc });
    L.guitaristKneel(ctx, t, { x: 520, y: y2, scale: 0.55, hold: 'raise', light: lt, rimColor: rc });
    L.girlAtRailing(ctx, t, { x: 860, y: y2, scale: 0.6, wind: 1.0, light: lt, rimColor: rc });
    L.boyReaching(ctx, t, { x: 1110, y: y2, scale: 0.58, reach: 1, light: lt, rimColor: rc });
    L.coupleUmbrella(ctx, t, { x: 1450, y: y2, scale: 0.55, light: lt, rimColor: rc });
    L.girlInBed(ctx, t, { x: 1680, y: y2 - 150, scale: 0.42, light: lt, style: 'silhouette', rimColor: rc });
  } });

  /* ---------- 2: spring music room, warm window backlight — pianist (intensity ramps up = 〈雪あらし〉) */
  function grandPiano(ctx, x, y, s) { // quick stand-in piano silhouette for the showcase (seen from behind the player)
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#120f14';
    ctx.beginPath(); ctx.moveTo(-160, -150); ctx.lineTo(560, -150); ctx.bezierCurveTo(760, -150, 820, -60, 830, 0); ctx.lineTo(-160, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-120, -150); ctx.lineTo(780, -330); ctx.lineTo(800, -300); ctx.lineTo(-80, -140); ctx.closePath(); ctx.fill();
    ctx.fillRect(-170, -20, 420, 40); ctx.fillRect(-150, 20, 26, 230); ctx.fillRect(700, -10, 30, 260); ctx.fillRect(330, -10, 26, 250);
    ctx.restore();
  }
  PV.shot('dev_figures_2', { draw(ctx, t) {
    L.sky(ctx, [[0, '#6a5246'], [0.6, '#b58d6c'], [1, '#5a4236']]);
    ctx.fillStyle = PV.linGrad(ctx, 0, 60, 0, 900, [[0, '#fffaf0'], [1, '#ffe7bf']]); ctx.fillRect(420, 40, 1160, 860);
    L.glow(ctx, 1000, 380, 1100, '#fff3dc', 0.85);
    ctx.fillStyle = '#7a5a48'; ctx.fillRect(990, 40, 26, 860); ctx.fillRect(420, 460, 1160, 22);
    L.godRays(ctx, t, { x: 1250, y: 80, angle: 2.15, spread: 0.5, count: 7, length: 1300, width: 180, alpha: 0.16 });
    ctx.fillStyle = '#c9a77d'; ctx.globalAlpha = 0.35; ctx.fillRect(0, 980, W, 100); ctx.globalAlpha = 1;
    grandPiano(ctx, 620, 720, 1.0);
    L.girlAtPianoBack(ctx, t, { x: 700, y: 810, scale: 1.25, intensity: PV.smooth(0.5, 4.5, t), light: -1.15, rimColor: '#fff0d4', backlight: 0.3 });
    L.dust(ctx, t, { count: 70, x0: 420, x1: 1580, y0: 60, y1: 900, color: '#fff3d6', size: 2.5 });
  } });

  /* ---------- 3: courtyard bench under a blue spring sky — shared earphones, she leans on him */
  PV.shot('dev_figures_3', { draw(ctx, t) {
    L.sky(ctx, [[0, '#4a8be0'], [0.55, '#8fc2f0'], [1, '#d9ecfa']]);
    L.clouds(ctx, t, { seed: 4, count: 6, y0: 120, y1: 520, minW: 420, maxW: 1000, speed: 6, colors: { lit: '#ffffff', mid: '#eef4fc', shadow: '#a9bde0', rim: '#ffffff' } });
    L.glow(ctx, 1520, 150, 760, '#fff8e8', 0.8);
    ctx.fillStyle = '#3f6b4a'; ctx.fillRect(0, 920, W, 160);
    L.coupleSittingBack(ctx, t, { x: 900, y: 690, scale: 1.25, lean: PV.smooth(1, 4, t), earphones: true, light: -0.75, rimColor: '#fffaf0', backlight: 0.25, wind: 0.35 });
    L.petals(ctx, t, { count: 26, size: 12, wind: 70 });
  } });

  /* ---------- 4: rain at dusk — two under one clear umbrella, walking away */
  PV.shot('dev_figures_4', { draw(ctx, t) {
    L.sky(ctx, [[0, '#28324a'], [0.6, '#56627c'], [1, '#2a3244']]);
    L.bokeh(ctx, t, { count: 40, x0: 0, x1: W, y0: 380, y1: 760, rmin: 12, rmax: 48, colors: ['#ffd38a', '#e8eeff', '#ffb98a'], alpha: 0.3 });
    ctx.fillStyle = '#1a2030'; ctx.fillRect(0, 860, W, 220);
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = PV.linGrad(ctx, 0, 860, 0, 1080, [[0, '#9aa7c0'], [1, '#1a2030']]); ctx.fillRect(0, 860, W, 220); ctx.restore();
    L.coupleUmbrella(ctx, t, { x: 960, y: 950, scale: 1.05, umbrella: 'clear', walk: 0.7, light: -1.9, rimColor: '#d6e2f6', backlight: 0.4 });
    L.rain(ctx, t, { count: 650, alpha: 0.32, angle: 0.08, speed: 2300 });
    L.splashes(ctx, t, { y0: 880, y1: 1080, count: 70 });
  } });

  /* ---------- 5: night seaside park — she runs in her concert dress, then throws herself into his arms */
  PV.shot('dev_figures_5', { draw(ctx, t) {
    L.sky(ctx, [[0, '#0e1530'], [0.62, '#1d2b55'], [0.75, '#2a3a66'], [1, '#0b1020']]);
    L.stars(ctx, t, { count: 120, yMax: 500, alpha: 0.5 });
    L.skyline(ctx, { seed: 3, y: 760, hMin: 20, hMax: 120, color: '#141c38', lit: 0.25, windowColor: '#ffd9a0' });
    L.bokeh(ctx, t, { count: 50, x0: 0, x1: W, y0: 640, y1: 780, rmin: 8, rmax: 34, colors: ['#ffd38a', '#ffffff', '#ffc2d6'], alpha: 0.45 });
    ctx.fillStyle = '#0a0f20'; ctx.fillRect(0, 840, W, 240);
    L.glow(ctx, 1500, 820, 500, '#ffd9a0', 0.35);
    L.girlRunning(ctx, t, { x: 520, y: 900, scale: 1.0, light: -0.25, rimColor: '#ffe2b8', backlight: 0.35 });
    L.embrace(ctx, t, { x: 1380, y: 900, scale: 1.0, progress: PV.smooth(0, 3, t), light: -0.35, rimColor: '#ffe2b8', backlight: 0.35 });
  } });

  /* ---------- 6: school festival gym stage — kneeling guitarist in the spotlight (raise / lift / chest) */
  PV.shot('dev_figures_6', { draw(ctx, t) {
    L.sky(ctx, [[0, '#141420'], [1, '#07070c']]);
    for (const [x, col] of [[330, '#ffbf6b'], [960, '#5fd7ff'], [1590, '#ff5fa8']]) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const g = ctx.createLinearGradient(x, 0, x, 1000); g.addColorStop(0, PV.rgba(col, 0.55)); g.addColorStop(1, PV.rgba(col, 0.12));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 40, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 300, 1000); ctx.lineTo(x - 300, 1000); ctx.fill(); ctx.restore();
      L.glow(ctx, x, 990, 320, col, 0.5);
    }
    L.dust(ctx, t, { count: 80, y1: 1000, color: '#ffe9c8', size: 2 });
    ctx.fillStyle = '#0c0c14'; ctx.fillRect(0, 1000, W, 80);
    L.guitaristKneel(ctx, t, { x: 330, y: 1000, scale: 0.92, hold: 'raise', rimColor: '#ffd9a0' });
    L.guitaristKneel(ctx, t, { x: 960, y: 1000, scale: 0.92, hold: 'lift', rimColor: '#c8f1ff' });
    L.guitaristKneel(ctx, t, { x: 1590, y: 1000, scale: 0.92, hold: 'chest', rimColor: '#ffc0dc' });
  } });

  /* ---------- 7: the storm on the bridge — she stands at the railing (cast), he reaches for her */
  PV.shot('dev_figures_7', { draw(ctx, t) {
    L.sky(ctx, [[0, '#070b16'], [0.7, '#1a2338'], [1, '#0d1220']]);
    L.clouds(ctx, t, { seed: 9, count: 6, y0: -80, y1: 260, minW: 700, maxW: 1400, speed: 30, alpha: 0.8, colors: { lit: '#4a5b80', mid: '#2e3a58', shadow: '#121a2c' } });
    const fl = Math.max(0, 1 - Math.abs(t - 2.0) * 5) + 0.6 * Math.max(0, 1 - Math.abs(t - 2.3) * 7);
    const segs = L.lightningPath(77, 1500, -20, 1380, 520, 0.35, 7);
    if (fl > 0) { ctx.fillStyle = PV.rgba('#dfe8ff', 0.35 * fl); ctx.fillRect(0, 0, W, H); L.lightning(ctx, segs, fl); }
    ctx.fillStyle = '#05080f'; ctx.fillRect(0, 1000, W, 80);
    L.boyReaching(ctx, t, { x: 470, y: 1000, scale: 1.0, reach: PV.smooth(0.5, 3.5, t), wind: 1.2, windDir: PI + 0.15, light: -1.0 - 0.5 * fl, rimColor: '#cfe0ff', backlight: 0.3 + 0.6 * fl });
    L.girlAtRailing(ctx, t, { x: 1350, y: 1000, scale: 1.02, wind: 1.6, windDir: PI - 0.1, cast: true, outfit: 'blouse', railing: 'bridge', railY: -4.9, light: -1.6, rimColor: '#cfe0ff', backlight: 0.3 + 0.6 * fl });
    L.rain(ctx, t, { count: 700, angle: -0.3, speed: 2600, len: 110, alpha: 0.4 });
  } });

  /* ---------- 8: hospital room — she sits up, face turned to the window (soft style) */
  PV.shot('dev_figures_8', { draw(ctx, t) {
    L.sky(ctx, [[0, '#eef3f5'], [1, '#d6e0e7']]);
    ctx.fillStyle = PV.linGrad(ctx, 0, 70, 0, 700, [[0, '#6fa8e2'], [1, '#cfe6f7']]); ctx.fillRect(700, 70, 1150, 630);
    L.clouds(ctx, t, { seed: 21, count: 3, y0: 160, y1: 360, minW: 300, maxW: 520, speed: 3, alpha: 0.9, colors: { lit: '#ffffff', mid: '#f3f7fb', shadow: '#bccbe0' } });
    L.bridge(ctx, { x0: 760, x1: 1800, y: 590, towerH: 130, color: '#f7f9fc', lw: 3 });
    L.glow(ctx, 1250, 380, 1000, '#ffffff', 0.5);
    ctx.fillStyle = '#c3cfd8'; ctx.fillRect(1265, 70, 18, 630); ctx.fillRect(700, 690, 1150, 26);
    L.girlInBed(ctx, t, { x: 760, y: 820, scale: 1.45, light: -0.45, rimColor: '#ffffff' });
  } });

  /* ---------- 9: music room by the window — boy with a juice pack / with his acoustic guitar */
  PV.shot('dev_figures_9', { draw(ctx, t) {
    L.sky(ctx, [[0, '#f6e6cf'], [1, '#e2c8a6']]);
    ctx.fillStyle = PV.linGrad(ctx, 0, 80, 0, 760, [[0, '#fff6df'], [1, '#ffe9c4']]); ctx.fillRect(140, 80, 760, 680); ctx.fillRect(1020, 80, 760, 680);
    L.glow(ctx, 520, 420, 700, '#fff3dc', 0.7); L.glow(ctx, 1400, 420, 700, '#fff3dc', 0.7);
    ctx.fillStyle = '#c9a77d'; ctx.fillRect(0, 920, W, 160);
    L.boySeated(ctx, t, { x: 470, y: 745, scale: 1.0, pose: 'juice', light: -0.6, rimColor: '#fff3dc' });
    L.boySeated(ctx, t, { x: 1300, y: 745, scale: 1.0, pose: 'guitar', light: -0.6, rimColor: '#fff3dc' });
  } });

  /* ---------- 10: hairLong studies — calm / breeze / gale (back and profile) */
  PV.shot('dev_figures_10', { draw(ctx, t) {
    L.sky(ctx, [[0, '#2c3a66'], [0.55, '#e39a7a'], [1, '#ffd9a8']]);
    L.glow(ctx, 960, 980, 900, '#ffe2b0', 0.8);
    const o = { scale: 1.6, style: 'silhouette', light: -PI / 2 - 0.5, rimColor: '#ffe6c0', backlight: 0.4, bust: true };
    L.hairLong(ctx, t, Object.assign({}, o, { x: 330, y: 330, wind: 0.0, view: 'back' }));
    L.hairLong(ctx, t, Object.assign({}, o, { x: 960, y: 330, wind: 0.7, windDir: 0.1, view: 'back' }));
    L.hairLong(ctx, t, Object.assign({}, o, { x: 1520, y: 330, wind: 1.5, windDir: PI - 0.15, view: 'side' }));
  } });
})();
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, PI = Math.PI;
  /* ---------- 11: API variants — grass seat, uniform runner (flipped), camera zoom/rotation, hands at sides, jacket */
  PV.shot('dev_figures_11', { draw(ctx, t) {
    L.sky(ctx, [[0, '#f2b07a'], [0.6, '#f7d9b0'], [1, '#9a8f8a']]);
    L.glow(ctx, 960, 560, 900, '#fff0d0', 0.7);
    ctx.fillStyle = '#5a6a4a'; ctx.fillRect(0, 880, W, 200);
    L.coupleSittingBack(ctx, t, { x: 330, y: 880, scale: 0.8, seat: 'grass', lean: 0.6, light: -1.4, rimColor: '#fff0d0' });
    L.girlRunning(ctx, t, { x: 900, y: 880, scale: 0.75, outfit: 'uniform', flip: true, light: -1.4, rimColor: '#fff0d0' });
    ctx.save(); PV.camera(ctx, { zoom: 1.25, rot: 0.06 * Math.sin(t), cx: 1350, cy: 600 });
    L.girlAtRailing(ctx, t, { x: 1300, y: 880, scale: 0.6, hands: 'sides', railing: false, wind: 0.5, light: -1.4, rimColor: '#fff0d0' });
    ctx.restore();
    L.boySeated(ctx, t, { x: 1700, y: 700, scale: 0.6, pose: 'juice', outfit: 'jacket', light: -1.4, rimColor: '#fff0d0' });
  } });
})();
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, PI = Math.PI;
  /* ---------- 12: close-up stress test (review) — embrace at scale 2.1 + the dark umbrella at 1.35 in the rain */
  PV.shot('dev_figures_12', { draw(ctx, t) {
    L.sky(ctx, [[0, '#0e1530'], [0.6, '#1d2b55'], [1, '#2a3a66']]);
    L.bokeh(ctx, t, { count: 34, x0: 0, x1: 980, y0: 520, y1: 900, rmin: 14, rmax: 46, colors: ['#ffd38a', '#ffffff', '#ffc2d6'], alpha: 0.4 });
    L.glow(ctx, 760, 700, 600, '#ffd9a0', 0.3);
    L.embrace(ctx, t, { x: 470, y: 1580, scale: 2.1, progress: PV.smooth(0, 3, t), light: -0.5, rimColor: '#ffe2b8', backlight: 0.35 });
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#28324a'], [0.7, '#56627c'], [1, '#2a3244']]); ctx.fillRect(980, 0, W - 980, H);
    L.coupleUmbrella(ctx, t, { x: 1450, y: 1130, scale: 1.35, umbrella: 'dark', walk: 0.8, light: -1.9, rimColor: '#d6e2f6', backlight: 0.4 });
    ctx.save(); ctx.beginPath(); ctx.rect(980, 0, W - 980, H); ctx.clip(); L.rain(ctx, t, { count: 420, alpha: 0.3, angle: 0.08, speed: 2300 }); ctx.restore();
  } });
})();

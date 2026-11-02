// dev-only showcase scenes for the figures library (PV.lib figures)
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;
  // simple backgrounds
  function warmWindow(ctx, t) {
    L.sky(ctx, [[0, '#3a3046'], [0.5, '#8a6a63'], [1, '#2a2230']]);
    // big bright window
    ctx.fillStyle = PV.linGrad(ctx, 0, 120, 0, 860, [[0, '#fff6df'], [1, '#ffe2b5']]); ctx.fillRect(560, 110, 820, 760);
    L.glow(ctx, 970, 480, 900, '#fff1d0', 0.8);
    ctx.fillStyle = '#4a3a3c'; ctx.fillRect(950, 110, 22, 760); ctx.fillRect(560, 470, 820, 18);
  }
  PV.shot('dev_figures_1', { draw(ctx, t) {
    warmWindow(ctx, t);
    L.girlAtPianoBack(ctx, t, { x: 560, y: 760, scale: 0.95, intensity: 0.2 + 0.8 * PV.smooth(1, 4, t), light: -1.2 });
    L.girlAtRailing(ctx, t, { x: 1380, y: 1010, scale: 1.1, wind: 1.2, windDir: 0.1, light: -2.0 });
  } });
})();

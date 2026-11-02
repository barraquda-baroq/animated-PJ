// g05_competition — C16–C19 (WIP exploration)
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;
  PV.shot('g05_test2', { draw(ctx, t, d, S) {
    const v = Math.floor(t);
    const cams = [[0.0, 0.55], [0.35, 0.5], [-0.35, 0.55], [0.6, 0.35], [0.15, 0.85], [-0.6, 0.4]];
    const [az, el] = cams[v % cams.length];
    ctx.fillStyle = '#2a1d16'; ctx.fillRect(0, 0, W, H);
    const hx = 2;
    const keys = [-2, -1, 0, 1, 2].map(k => k + hx);
    L.handOnKeys(ctx, { x: 960, y: 600, scale: 2.6, t, az, el, handX: hx, keys, press: [0, 1, 0, 0, 0], range: [-16, 16], lookAt: { x: 0, y: -22, z: 8 }, arm: 360, light: -2.3 });
    ctx.fillStyle = '#fff'; ctx.font = '40px sans-serif'; ctx.fillText(`az ${az} el ${el}`, 40, 60);
  } });
})();

// Dev sheet for the shared anime style kit: material tones under every lighting condition + ink strokes.
(function () {
  const PV = window.PV;
  PV.shot('dev_anime_core_1', {
    draw(ctx, t) {
      const A = PV.anime;
      ctx.fillStyle = '#8a8f99'; ctx.fillRect(0, 0, PV.W, PV.H);
      const mats = ['skin', 'hair_senpai', 'hair_boy', 'iris_senpai', 'blouse', 'ribbon', 'skirt', 'dress', 'shirt', 'jacket', 'onepiece', 'gown'];
      const lights = Object.keys(A.LIGHT);
      const cw = 100, ch = 62, x0 = 150, y0 = 40;
      ctx.font = '13px sans-serif'; ctx.textBaseline = 'middle';
      lights.forEach((L, j) => { ctx.fillStyle = '#fff'; ctx.fillText(L, 8, y0 + j * ch + ch / 2); });
      mats.forEach((mt, i) => {
        ctx.fillStyle = '#fff'; ctx.fillText(mt, x0 + i * (cw + 40) + 4, 22);
        lights.forEach((L, j) => {
          const m = A.mat(mt, L); const x = x0 + i * (cw + 40), y = y0 + j * ch;
          const tones = [m.base, m.shade, m.deep, m.hi, m.line];
          tones.forEach((c, k) => { ctx.fillStyle = c; ctx.fillRect(x + k * (cw / 5), y, cw / 5, ch - 8); });
          ctx.fillStyle = A.rgbaHex(m.rim, m.rimA); ctx.fillRect(x + cw, y, 10, ch - 8);
        });
      });
      // ink strokes
      for (let k = 0; k < 6; k++) {
        const pts = [[1500 + k * 60, 980], [1530 + k * 60, 900], [1520 + k * 60, 820], [1560 + k * 60, 760]];
        A.taper(ctx, pts, { w0: 0.3, mid: 1 + k, w1: 0.2 }, '#3a2420');
      }
    },
  });
})();

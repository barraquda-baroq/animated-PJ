// dev-only showcase for the anime body library (PV.anime.figure / pair) — see analysis/art_review/anime_body_API.md
(function () {
  const PV = window.PV, W = PV.W, H = PV.H, PI = Math.PI;
  const A = () => PV.anime;

  /* ---------- backdrops */
  function paper(ctx, top = '#f3efe8', bot = '#e2dccf') {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, top], [1, bot]]); ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,110,95,0.10)'; ctx.lineWidth = 1;
    for (let y = 60; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  function label(ctx, x, y, s, col = 'rgba(70,60,50,0.75)') { ctx.save(); ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.restore(); }
  function ground(ctx, y, col = 'rgba(90,80,70,0.25)') { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W - 60, y); ctx.stroke(); ctx.restore(); }

  /* ---------- 1/2: model sheets, uniform (front / 3q / side / back) */
  function sheet(ctx, t, who, outfit, sc, title) {
    paper(ctx); const gy = 1030; ground(ctx, gy);
    const views = [['front', 'front'], ['3q_right', '3/4'], ['right', 'side'], ['back', 'back']];
    views.forEach(([f, name], i) => {
      const x = 260 + i * 467;
      A().figure(ctx, { who, outfit, pose: 'stand', facing: f, x, y: gy, scale: sc, T: t, light: 'day', params: { weight: 0.4 } });
      label(ctx, x, 40, name);
    });
    label(ctx, W / 2, 1068, title);
  }
  PV.shot('dev_anime_body_1', { draw(ctx, t) { sheet(ctx, t, 'senpai', 'uniform', 138, '先輩 — uniform (白ブラウス・赤リボン・紺プリーツ)'); } });
  PV.shot('dev_anime_body_2', { draw(ctx, t) { sheet(ctx, t, 'boy', 'uniform', 135, '彼 — uniform (白シャツ袖まくり・緩めたネクタイ)'); } });
})();

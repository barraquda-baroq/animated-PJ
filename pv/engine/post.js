/* Post-processing on the final 1920x1080 canvas: bloom, tint, vignette,
 * film grain, letterbox. Per-shot controls (all optional) in the timeline:
 *   S.post = { bloom: 0..1, grain: 0..1, vignette: 0..1, tint: '#hex', tintAmt: 0..1,
 *              letterbox: true|false, fadeBlack: 0..1, fadeWhite: 0..1 }
 */
(function () {
  'use strict';
  const PV = window.PV;
  const W = PV.W, H = PV.H;

  // ---- grain tiles (deterministic)
  const GRAIN_N = 6, GS = 512;
  let grainTiles = null;
  function makeGrain() {
    grainTiles = [];
    for (let k = 0; k < GRAIN_N; k++) {
      const c = PV.makeCanvas(GS, GS); const img = c.ctx.createImageData(GS, GS); const r = PV.rng(9001 + k * 77);
      for (let i = 0; i < GS * GS; i++) {
        // roughly gaussian luminance noise around mid grey
        const v = 128 + ((r() + r() + r() - 1.5) * 90);
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
      }
      c.ctx.putImageData(img, 0, 0); grainTiles.push(c.canvas);
    }
  }

  PV.postDefaults = { bloom: 0.28, halation: 0.35, grain: 0.55, vignette: 0.45, tint: null, tintAmt: 0, letterbox: false };

  PV.post = function (ctx, T, frame, S) {
    const P = Object.assign({}, PV.postDefaults, (PV.timeline && PV.timeline.post) || {}, S.post || {});
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);

    // ---- bloom: threshold + all blurs at low res, accumulate glow layers at low res, ONE full-res screen pass
    if (P.bloom > 0) {
      const sm = PV.buffer('bloomSmall', 480, 270);
      sm.ctx.imageSmoothingQuality = 'low';
      sm.ctx.filter = 'brightness(0.78) contrast(2.6) saturate(1.15)';
      sm.ctx.drawImage(PV.out.canvas, 0, 0, 480, 270);
      sm.ctx.filter = 'none';
      const acc = PV.buffer('bloomAcc', 480, 270);
      acc.ctx.clearRect(0, 0, 480, 270);
      acc.ctx.globalCompositeOperation = 'lighter';
      acc.ctx.globalAlpha = P.bloom; acc.ctx.filter = 'blur(7px)'; acc.ctx.drawImage(sm.canvas, 0, 0);
      acc.ctx.globalAlpha = P.bloom * 0.6; acc.ctx.filter = 'blur(20px)'; acc.ctx.drawImage(sm.canvas, 0, 0);
      if (P.halation > 0) { acc.ctx.globalAlpha = P.bloom * P.halation; acc.ctx.filter = 'sepia(1) saturate(4) hue-rotate(-28deg) blur(10px)'; acc.ctx.drawImage(sm.canvas, 0, 0); }
      acc.ctx.filter = 'none'; acc.ctx.globalAlpha = 1; acc.ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
      ctx.globalCompositeOperation = 'screen'; ctx.drawImage(acc.canvas, 0, 0, W, H);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    // ---- tint (soft-light colour wash)
    if (P.tint && P.tintAmt > 0) {
      ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = P.tintAmt;
      ctx.fillStyle = P.tint; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    // ---- vignette
    if (P.vignette > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.75 * P.vignette})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // ---- grain
    if (P.grain > 0) {
      if (!grainTiles) makeGrain();
      const tile = grainTiles[frame % GRAIN_N];
      const ox = Math.floor(PV.rand1(frame, 11) * GS), oy = Math.floor(PV.rand1(frame, 23) * GS);
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.10 * P.grain;
      for (let y = -oy; y < H; y += GS) for (let x = -ox; x < W; x += GS) ctx.drawImage(tile, x, y);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    // ---- letterbox (2.39:1)
    if (P.letterbox) {
      const bh = Math.round((H - W / 2.39) / 2);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
    }
    if (P.fadeBlack) { ctx.fillStyle = `rgba(0,0,0,${P.fadeBlack})`; ctx.fillRect(0, 0, W, H); }
    if (P.fadeWhite) { ctx.fillStyle = `rgba(255,255,255,${P.fadeWhite})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  };
})();

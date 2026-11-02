// g01_storm_music_room — C01〜C04 (prototype)
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;

  PV.shot('g01_room', { draw(ctx, t) {
    const k = Math.min(3, Math.floor(t));
    const cfg = [
      { eye: [6.3, 1.3, 6.6], tgt: [6.1, 1.35, 0], px: 6.9, pz: 3.0, yaw: Math.PI / 2 + 0.35, turn: 0.35, flip: false },
      { eye: [6.3, 1.3, 6.6], tgt: [6.1, 1.35, 0], px: 6.9, pz: 3.0, yaw: Math.PI / 2 - 0.35, turn: -0.3, flip: false },
      { eye: [6.3, 1.3, 6.6], tgt: [6.1, 1.35, 0], px: 7.2, pz: 2.9, yaw: -1.25, turn: 0.35, flip: true },
      { eye: [6.0, 1.25, 7.2], tgt: [5.9, 1.3, 0], px: 7.0, pz: 3.2, yaw: Math.PI / 2 + 0.2, turn: 0.3, flip: false },
    ][k];
    const R = L.musicRoom(ctx, t, { view: 'windows', time: 'noon', furniture: 'sparse', wind: 0.5, cam: { eye: cfg.eye, target: cfg.tgt, fov: 60 } });
    const po = L.grandPiano(ctx, R.piano(cfg.px, cfg.pz, cfg.yaw, { lidOpen: 1, bench: false, rimLit: true }));
    // px per meter at bench: project two points 1m apart vertically
    const bz = cfg.pz;
    const a = R.project([cfg.px, 0, bz + 1.2]), b = R.project([cfg.px, 1, bz + 1.2]);
    const ppm = Math.abs(a[1] - b[1]);
    const benchP = R.project([cfg.px + Math.cos(cfg.yaw) * 0, 0.5, bz]);
    ctx.fillStyle = '#f00'; ctx.font = '30px sans-serif';
    ctx.fillText(`cfg ${k} kb ${po.keyboard.map(v => v.toFixed(0))} ppm ${ppm.toFixed(0)} seat ${R.seat.map(v => v.toFixed(0))}`, 40, 60);
    ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(po.keyboard[0], po.keyboard[1], 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#00f'; ctx.beginPath(); ctx.arc(R.seat[0], R.seat[1], 10, 0, 7); ctx.fill();
    // girl
    const kb = po.keyboard;
    L.girlAtPianoBack(ctx, t, { x: kb[0] + (cfg.flip ? 30 : -30), y: kb[1] + ppm * 0.42 * 1.0 + 40, scale: ppm / 419, intensity: 0.9, turn: cfg.turn, flip: cfg.flip, outfit: 'blouse', light: -1.35, rimColor: '#fff0d4', backlight: 0.35 });
    L.boySeated(ctx, t, { x: R.seat[0], y: R.seat[1], scale: Math.abs(R.project([4.05, 0, 1.05])[1] - R.project([4.05, 1, 1.05])[1]) / 417, pose: 'juice', chair: false, light: -1.2, rimColor: '#fff0d4', backlight: 0.3 });
  } });
})();

// Showcases for the instruments & music-room library (engine/lib/instruments.js).
// Each shot mirrors a real PV composition.  Render:  node render/still.cjs --dev dev_instruments_N --dur 6 --times 0,2,4 --sheet
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;

  // 1. 四月の音楽室 — the piano in the window light (back-lit, wind in the curtains, dust in the beams)
  PV.shot('dev_instruments_1', { draw(ctx, t) {
    // static 3-D camera (cached layers) + a slow 2-D push-in with PV.camera: cheap camera work
    ctx.save(); PV.camera(ctx, { zoom: 1 + t * 0.008, cx: 1250, cy: 640 });
    const R = L.musicRoom(ctx, t, { view: 'windows', time: 'noon', camX: -0.35, furniture: 'sparse', wind: 0.55 });
    L.grandPiano(ctx, R.piano(8.7, 3.25, -0.42, { lidOpen: 1, bench: true, rimLit: { alpha: 0.9 } }));
    ctx.restore();
  } });

  // 2. 鍵盤の極端なアップ — window light raking across the keys; a run of notes is played (keyPos marks where fingers go)
  PV.shot('dev_instruments_2', { draw(ctx, t) {
    ctx.fillStyle = '#0d0b0c'; ctx.fillRect(0, 0, W, H);
    const pressed = {}; const run = [39, 41, 43, 44, 46, 48, 51, 48, 46, 44];
    const k = Math.floor(t * 5) % run.length, ph = (t * 5) % 1; pressed[run[k]] = Math.sin(Math.min(1, ph * 1.6) * Math.PI) ; pressed[run[(k + 9) % run.length]] = 0.25 * (1 - ph);
    pressed[27] = 1; pressed[31] = 1; // a held left-hand chord
    const o = { view: 'along', focus: 43, pressed, light: { az: -0.75, el: 0.42, color: '#fff0d6', k: 1.15 }, dof: { amount: 7, range: 6 } };
    L.keysClose(ctx, t, o);
    // keyPos(): where a fingertip should land on the struck key (for the hands library) — faint guide ring
    const kp = L.keyPos(o, run[k]); ctx.strokeStyle = 'rgba(255,190,120,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(kp.x, kp.y, kp.w * 0.32, kp.w * 0.32 * 0.45, Math.atan2(kp.ay, kp.ax), 0, PV.TAU); ctx.stroke();
    if (t > 4.2) { const w = PV.smooth(4.2, 5.8, t); L.keysClose(ctx, t, Object.assign({}, o, { warp: w, whiteout: w * 0.8, dof: null })); }
  } });

  // 3. 第十四話 — 一弦が切れる (gym stage light, the other strings still ringing)
  PV.shot('dev_instruments_3', { draw(ctx, t) {
    const bg = ctx.createRadialGradient(W * 0.62, H * 0.35, 50, W * 0.5, H * 0.5, W * 0.8); bg.addColorStop(0, '#3a2440'); bg.addColorStop(1, '#0d0b14'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const p = t < 1.6 ? -1 + t / 1.6 : (t - 1.6) / 2.6; // bend builds up, then the 1st string snaps at t=1.6
    const v = t < 1.6 ? 0.25 : Math.max(0, 1 - (t - 1.6) * 0.3);
    const fo = { view: 'snap', focus: 14 };
    if (t < 1.6) { const fp = L.fretPos(fo, 0, 14); ctx.save(); ctx.globalAlpha = 0; ctx.restore(); }
    L.fretboard(ctx, t, { view: 'snap', focus: 14, wood: 'maple', vibrate: [0, 0.55 * v, 0.5 * v, 0.45 * v, 0.4 * v, 0.35 * v], snap: { string: 0, p, at: 14, bend: 6 },
      light: { az: 2.2, el: 0.65, color: '#ffd9e8', k: 1.1 }, ambient: '#3a2a4a' });
    if (t < 1.6) { const fp = L.fretPos(fo, 0, 14); ctx.strokeStyle = 'rgba(255,190,120,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fp.x, fp.y, fp.spacing * 0.45, 0, PV.TAU); ctx.stroke(); }
  } });

  // 4. 予選 — the hall, then the world turns white and only the piano remains
  PV.shot('dev_instruments_4', { draw(ctx, t) { ctx.save(); PV.camera(ctx, { zoom: 1.02 + t * 0.01, x: -t * 6 }); L.concertStage(ctx, t, { whiteout: PV.smoother(1.5, 4.5, t) }); ctx.restore(); } });

  // 5. 第一話 — 「楽譜が、一斉に、消えた」 the page on the music desk empties into white
  PV.shot('dev_instruments_5', { draw(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16120f'); g.addColorStop(1, '#0b0908'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    L.glow(ctx, W * 0.3, H * 0.15, 900, '#fff1d8', 0.25);
    L.sheetMusic(ctx, t, { x: W * 0.5, y: H * 0.54, w: 700, rot: -0.03, skewX: -0.04, scaleY: 0.92, dissolve: PV.smooth(1.0, 5.4, t), light: { angle: -2.4 } });
  } });

  // 6. music room, side view — noon / rain / dusk
  PV.shot('dev_instruments_6', { draw(ctx, t) {
    const time = t < 2 ? 'noon' : t < 4 ? 'rain' : 'dusk';
    const R = L.musicRoom(ctx, t, { view: 'room', time, furniture: 'full', camX: 0.2 });
    L.grandPiano(ctx, R.piano(11.7, 2.3, -2.25, { lidOpen: time === 'rain' ? 0 : 1, rimLit: time !== 'rain' }));
  } });

  // 7. 第九話 — rain; the curtain gripped at the gap where she stands
  PV.shot('dev_instruments_7', { draw(ctx, t) {
    L.windowCurtain(ctx, t, { time: 'rain', gap: 0.3, grip: { side: 'right', v: 0.46, pull: 0.55 + 0.05 * Math.sin(t * 7) } });
  } });

  // 8. 文化祭の体育館 — the floor-level makeshift stage (flash at t=3: the string breaks, the crowd roars)
  PV.shot('dev_instruments_8', { draw(ctx, t) { ctx.save(); PV.camera(ctx, { zoom: 1.03, x: 20 - t * 8 }); L.gymStage(ctx, t, { crowd: 'standing', flash: Math.max(0, 1 - Math.abs(t - 3) * 4) * 0.6 }); ctx.restore(); } });

  // 9. 第四話 — night room: the amp's red pilot lamp slowly goes out
  PV.shot('dev_instruments_9', { draw(ctx, t) {
    ctx.fillStyle = '#0b0d16'; ctx.fillRect(0, 0, W, H);
    const lamp = 1 - PV.smooth(1.5, 4.5, t);
    L.glow(ctx, W * 0.82, H * 0.2, 500, '#9fb4ff', 0.12);
    L.amp(ctx, t, { x: W * 0.42, y: H * 0.86, h: 620, lamp, ambient: 0.1 + 0.25 * lamp, angle: 0.45, knobs: [PV.lerp(6, 0, PV.smooth(0.2, 1.5, t)), 5, 5, 6, 3], glow: 0.9 });
    L.strat(ctx, { x: W * 0.8, y: H * 0.52, len: 980, rot: 0.2, ambient: 0.16 + 0.1 * lamp, light: -0.6 });
  } });

  // 10. model sheet — piano views & styles, guitars, amps
  PV.shot('dev_instruments_10', { draw(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3b3632'); g.addColorStop(1, '#221e1c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    L.grandPiano(ctx, { view: 'side', x: 330, y: 470, scale: 190, lidOpen: 1 });
    L.grandPiano(ctx, { view: 'threeQuarter', x: 830, y: 480, scale: 200, lidOpen: 0.7 });
    L.grandPiano(ctx, { view: 'front', x: 1300, y: 470, scale: 170, lidOpen: 1 });
    L.grandPiano(ctx, { view: 'threeQuarter', x: 1730, y: 470, scale: 170, lidOpen: 1, style: 'silhouette', rimDir: -2.0 });
    L.grandPiano(ctx, { view: 'side', x: 330, y: 1000, scale: 170, lidOpen: 0 });
    L.acousticGuitar(ctx, { x: 790, y: 790, len: 520, rot: -0.15 });
    L.strat(ctx, { x: 1050, y: 790, len: 500, rot: 0.12 });
    L.amp(ctx, t, { x: 1420, y: 1010, h: 230, lamp: 1 });
    L.strat(ctx, { x: 1760, y: 790, len: 480, rot: 0.3, style: 'silhouette' });
  } });
})();

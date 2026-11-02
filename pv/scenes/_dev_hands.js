// dev-only showcase scenes for the hands library (PV.lib.hand*, pv/engine/lib/hands.js)
//   dev_hands_1  rig sheet: views / sides / curls / styles
//   dev_hands_2  handOnKeys — right hand playing (music room, afternoon), reflection in the fallboard
//   dev_hands_3  handOnFrets — his left hand on the fretboard (live-house amber), thumb over the neck
//   dev_hands_4  handsTouch — 第五話「左手、見せて」 (approach → touch)
//   dev_hands_5  handsInterlock — final cut, scars, summer light
//   dev_hands_6  handsInterlock style:'rim' — raised against a backlit summer window
//   dev_hands_7  armCast — hospital, cast + sling, fingers out of the cast
//   dev_hands_8  gesture sheet: handOffer / handPress / handFist / handReach
//   dev_hands_9  handReach style:'rim' — a hand opening toward the window light
//   dev_hands_10 close-up detail check (scars, calluses, nails, creases)
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;
  const label = (ctx, s, x, y, col) => { ctx.save(); ctx.font = '22px sans-serif'; ctx.fillStyle = col || 'rgba(60,40,30,0.75)'; ctx.textAlign = 'center'; ctx.fillText(s, x, y); ctx.restore(); };
  const pressCurve = L.handPressCurve;   // lift → strike → hold → release

  /* 1) rig sheet */
  PV.shot('dev_hands_1', { draw(ctx, t) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#f4ece2'], [1, '#e6d8c8']]); ctx.fillRect(0, 0, W, H);
    const cw = W / 5;
    const H1 = (o) => (c, x, y) => L.hand(c, Object.assign({ x, y, scale: 1.45, t, arm: 30 }, o));
    const rows = [
      [['R back', H1({ side: 'R', view: 'back' })], ['R palm', H1({ side: 'R', view: 'palm' })], ['R side (thumb)', H1({ side: 'R', view: 'side', curl: [0.2, 0.18, 0.22, 0.26, 0.3] })],
       ['R curl 0.5', H1({ side: 'R', view: 'back', yaw: -0.4, curl: [0.3, 0.5, 0.55, 0.6, 0.65] })], ['handFist', (c, x, y) => L.handFist(c, { x, y: y - 10, scale: 1.55, t, arm: 30, view: 'palm', yaw: 0.45, pitch: -0.15 })]],
      [['L back (him)', H1({ side: 'L', view: 'back' })], ['L palm: calluses+scar', H1({ side: 'L', view: 'palm', spread: 0.5, thumbScar: true })], ['R back: surgicalScars', H1({ side: 'R', view: 'back', yaw: 0.25, surgicalScars: true, arm: 110 })],
       ['style: silhouette', H1({ side: 'R', view: 'palm', style: 'silhouette', color: '#1b1824', rimWidth: 1, light: -1.2, spread: 0.5 })], ['style: rim', H1({ side: 'L', view: 'back', style: 'rim', light: -0.9, spread: 0.45 })]],
    ];
    // backgrounds for the style cells
    ctx.fillStyle = PV.linGrad(ctx, 0, 540, 0, H, [[0, '#ffd9a0'], [1, '#ff9f73']]); ctx.fillRect(cw * 3, 540, cw, H - 540);
    ctx.fillStyle = PV.linGrad(ctx, 0, 540, 0, H, [[0, '#cfe6fb'], [1, '#fff7e6']]); ctx.fillRect(cw * 4, 540, cw, H - 540);
    L.glow(ctx, cw * 4.6, 640, 300, '#ffffff', 0.9);
    rows.forEach((row, r) => row.forEach(([name, fn], i) => {
      const x = cw * (i + 0.5), y = r === 0 ? 450 : 990;
      fn(ctx, x, y);
      label(ctx, name, x, r === 0 ? 40 : 580);
    }));
  } });

  /* 2) right hand on the keys — afternoon music room; the hand is mirrored in the black fallboard */
  PV.shot('dev_hands_2', { draw(ctx, t) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, W, H, [[0, '#f6e6cf'], [0.5, '#e9d2b2'], [1, '#c9a77d']]); ctx.fillRect(0, 0, W, H);
    L.bokeh(ctx, t, { seed: 3, count: 22, rmin: 30, rmax: 110, x0: 0, x1: 900, y0: 600, y1: 1080, alpha: 0.2, colors: ['#fff3d9', '#ffe2b8', '#ffffff'] });
    L.glow(ctx, 260, 980, 900, '#fff3dc', 0.6);
    const ph = (t * 1.25) % 5.2;
    const press = [0, 1, 2, 3, 4].map(i => pressCurve(ph - i * 0.85));
    L.handOnKeys(ctx, { x: 980, y: 560, scale: 3.2, t, press, light: -2.6, sun: { x: -0.6, y: -1, z: 0.45 }, sleeve: '#2b3252', sleeveAt: 70, arm: 300, range: [-14, 14], focal: 1200, keyColor: '#fff3dc', fillColor: '#e2b8a6', tint: 0.5 });
    L.godRays(ctx, t, { x: 120, y: 1160, angle: -0.9, spread: 0.3, count: 6, length: 1800, width: 170, alpha: 0.08 });
    L.dust(ctx, t, { seed: 4, count: 70, x0: 0, y0: 0, x1: 1920, y1: 1080, alpha: 0.5 });
  } });

  /* 3) his left hand on the fretboard — live-house amber; thumb hooked over the neck (Hendrix grip) */
  PV.shot('dev_hands_3', { draw(ctx, t) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#1d1a2a'], [0.6, '#3a2a35'], [1, '#5a3c34']]); ctx.fillRect(0, 0, W, H);
    L.bokeh(ctx, t, { seed: 8, count: 30, rmin: 25, rmax: 90, alpha: 0.28, colors: ['#ffbf6b', '#ff8fb8', '#ffe2a8'] });
    L.glow(ctx, 1500, 160, 900, '#ffcf8a', 0.5);
    // C-shape at the 5th position; the little finger hammers on (fret 8, string 3) and lets go
    const chord = [[5, 2], [6, 4], [7, 5], [8, 3]];
    const ham = PV.smooth(0.0, 0.12, (t * 0.9) % 2) * (1 - PV.smooth(1.0, 1.2, (t * 0.9) % 2));
    L.handOnFrets(ctx, { x: 980, y: 520, scale: 2.9, t, chord, press: [1, 1, 1, 1, ham], vibrato: { 3: 0.6 * PV.smooth(0.5, 1.2, t % 2) }, light: -0.6, fretFrom: 1, fretTo: 12, stringVib: 0.6, arm: 420,
      keyColor: '#ffc890', fillColor: '#6a4a78', tint: 0.75, sleeve: '#2c2420', sleeveAt: 320 });
    L.dust(ctx, t, { seed: 2, count: 40, alpha: 0.35, color: '#ffe7c4' });
  } });

  /* 4) 第五話「左手、見せて」 — after lunch in the April music room */
  PV.shot('dev_hands_4', { draw(ctx, t) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, W, H, [[0, '#fbf1e2'], [0.5, '#ead6bd'], [1, '#c9a882']]); ctx.fillRect(0, 0, W, H);
    L.blurred(ctx, 14, (c) => { c.fillStyle = 'rgba(70,74,110,0.45)'; c.beginPath(); c.ellipse(1650, 980, 520, 260, -0.3, 0, PV.TAU); c.fill(); c.fillStyle = 'rgba(190,150,110,0.5)'; c.fillRect(0, 900, 1920, 200); });
    L.glow(ctx, 260, 120, 900, '#fff6e2', 0.7);
    L.handsTouch(ctx, { x: 920, y: 520, scale: 2.7, approach: PV.smooth(0.3, 3.2, t), t, herSleeve: '#2b3252', his: { sleeve: '#f1f1ee', sleeveAt: 150 } });
    L.dust(ctx, t, { seed: 9, count: 70, alpha: 0.55 });
    L.godRays(ctx, t, { x: 100, y: -80, angle: 0.95, spread: 0.3, count: 5, length: 1600, width: 150, alpha: 0.1 });
  } });

  /* 5) final cut — her scarred right hand and his left hand, fingers interlaced, summer light */
  PV.shot('dev_hands_5', { draw(ctx, t) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#fff8e8'], [0.55, '#f3dfc0'], [1, '#d7b48c']]); ctx.fillRect(0, 0, W, H);
    L.glow(ctx, 1500, 160, 1100, '#fffaf0', 0.8);
    L.handsInterlock(ctx, { x: 900, y: 600, scale: 3.4, t, rot: -0.45, arm: 300, squeeze: 0.55 + 0.1 * Math.sin(t * 0.9), trace: PV.smooth(1, 5, t) * 0.5, light: -1.3 });
    L.dust(ctx, t, { seed: 12, count: 60, alpha: 0.5 });
  } });

  /* backlit summer window (shared by 6 and 9) */
  function windowBG(ctx, t) {
    L.sky(ctx, [[0, '#7fb6e8'], [0.55, '#cfe6fb'], [1, '#fff8ea']]);
    L.clouds(ctx, t, { seed: 5, count: 5, y0: 120, y1: 520, minW: 500, maxW: 1100, speed: 5, colors: { lit: '#ffffff', mid: '#f4f8ff', shadow: '#bccbe6', rim: '#ffffff' } });
    L.glow(ctx, 1180, 300, 1200, '#fffbef', 1.0);
    ctx.fillStyle = '#2b2a34';
    ctx.fillRect(0, 0, W, 46); ctx.fillRect(0, H - 120, W, 120); ctx.fillRect(0, 0, 60, H); ctx.fillRect(W - 60, 0, 60, H); ctx.fillRect(W / 2 - 14, 0, 28, H - 120); ctx.fillRect(0, 470, W, 22);
    for (let i = 0; i < 2; i++) {   // soft glowing curtains: translucent vertical folds
      const xa = i ? W - 360 : 0, xb = i ? W : 360;
      for (let k = 0; k < 9; k++) {
        const f = k / 8, x = PV.lerp(xa, xb, f) + 14 * Math.sin(t * 0.5 + k + i * 3), w = 64, a = 0.55 + 0.35 * Math.abs(Math.sin(k * 1.7));
        const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        g.addColorStop(0, 'rgba(255,250,240,0)'); g.addColorStop(0.5, `rgba(255,251,242,${a})`); g.addColorStop(1, 'rgba(236,230,222,0)');
        ctx.fillStyle = g; ctx.fillRect(x - w / 2, 0, w, H - 120);
      }
    }
  }

  /* 6) backlight: interlaced hands raised against the window (style:'rim') */
  PV.shot('dev_hands_6', { draw(ctx, t) {
    windowBG(ctx, t);
    L.godRays(ctx, t, { x: 1180, y: 220, angle: 1.9, spread: 1.1, count: 9, length: 1500, width: 160, alpha: 0.14 });
    L.handsInterlock(ctx, { x: 1000, y: 520, scale: 3.5, t, rot: Math.PI - 0.35 + 0.02 * Math.sin(t * 0.7), style: 'rim', light: -1.2, arm: 420, rimColor: '#fff4dc', glow: 0.9 });
    L.dust(ctx, t, { seed: 31, count: 90, alpha: 0.6 });
  } });

  /* 7) hospital — her right forearm in a cast and sling, fingers out of the cast */
  PV.shot('dev_hands_7', { draw(ctx, t) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#eef3f5'], [0.6, '#dfe8ee'], [1, '#c9d6e0']]); ctx.fillRect(0, 0, W, H);
    L.glow(ctx, 1650, 120, 900, '#ffffff', 0.8);
    L.blurred(ctx, 10, (c) => { c.fillStyle = 'rgba(176,196,214,0.55)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(300 + i * 480, 1000 + 30 * Math.sin(i), 420, 120, 0.1 * i, 0, PV.TAU); c.fill(); } });
    L.armCast(ctx, { x: 1300, y: 600, scale: 2.5, rot: Math.PI / 2 + 0.16, t, light: -1.1, keyColor: '#f4f8ff', fillColor: '#b9c7da', tint: 0.5 });
    L.dust(ctx, t, { seed: 21, count: 40, alpha: 0.35, color: '#ffffff' });
  } });

  /* 8) gesture sheet */
  PV.shot('dev_hands_8', { draw(ctx, t) {
    const panels = [
      ['handOffer — ハンカチ', ['#f6ead8', '#e4cfb3'], (c, x, y) => L.handOffer(c, { x: x + 170, y: y + 110, scale: 1.75, t, sleeve: '#2c3a5a' })],
      ['handPress — 雨の窓', ['#4a5568', '#8a97ab'], (c, x, y) => { L.handPress(c, { x, y: y + 220, scale: 1.55, t, light: -1.6, keyColor: '#c9d4e6', fillColor: '#7c89a6', tint: 0.8 }); L.rain(c, t, { seed: 4, count: 140, x0: x - 480, x1: x + 480, y0: y - 270, y1: y + 270, alpha: 0.3 }); }],
      ['handFist — 震える拳', ['#2a2d3e', '#4b4458'], (c, x, y) => L.handFist(c, { x: x + 10, y: y + 150, scale: 2.2, t, light: -2.2, keyColor: '#c9b8d8', fillColor: '#5a4a72', tint: 0.75, view: 'palm', yaw: 0.45, pitch: -0.15 })],
      ['handReach — 光へ', ['#fff7e6', '#f2d9b0'], (c, x, y) => L.handReach(c, { x: x - 40, y: y + 250, scale: 1.55, t })],
    ];
    panels.forEach(([name, g, fn], i) => {
      const x = 480 + (i % 2) * 960, y = 270 + Math.floor(i / 2) * 540;
      ctx.save(); ctx.beginPath(); ctx.rect(x - 478, y - 268, 956, 536); ctx.clip();
      ctx.fillStyle = PV.linGrad(ctx, 0, y - 270, 0, y + 270, [[0, g[0]], [1, g[1]]]); ctx.fillRect(x - 480, y - 270, 960, 540);
      fn(ctx, x, y);
      ctx.fillStyle = i === 1 || i === 2 ? 'rgba(255,255,255,0.75)' : 'rgba(60,40,30,0.7)'; ctx.font = '24px sans-serif'; ctx.fillText(name, x - 450, y - 230);
      ctx.restore();
    });
  } });

  /* 9) a single hand opening toward the window light (style:'rim'), seen from behind */
  PV.shot('dev_hands_9', { draw(ctx, t) {
    windowBG(ctx, t);
    L.godRays(ctx, t, { x: 1180, y: 220, angle: 2.2, spread: 0.9, count: 8, length: 1500, width: 150, alpha: 0.12 });
    L.handReach(ctx, { x: 820, y: 1160, scale: 3.4, t, style: 'rim', light: -0.95, open: PV.smooth(0, 4, t), rot: 0.22, rimColor: '#fff2d8' });
    L.dust(ctx, t, { seed: 33, count: 80, alpha: 0.6 });
  } });

  /* 10) close-up detail check */
  PV.shot('dev_hands_10', { draw(ctx, t) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#f4ece2'], [1, '#e6d8c8']]); ctx.fillRect(0, 0, W, H);
    L.hand(ctx, { x: 560, y: 1160, scale: 3.9, side: 'R', view: 'back', yaw: 0.18, pitch: 0.05, curl: [0.12, 0.1, 0.12, 0.16, 0.2], spread: 0.32, arm: 160, t, surgicalScars: true });
    L.hand(ctx, { x: 1420, y: 1180, scale: 3.9, side: 'L', view: 'palm', yaw: 0.2, curl: [0.1, 0.15, 0.18, 0.22, 0.28], spread: 0.35, arm: 140, t, thumbScar: true });
    label(ctx, '先輩の右手（縫合痕・短い爪）', 560, 60); label(ctx, '主人公の左手（弦のタコ・親指の傷）', 1420, 60);
  } });
})();

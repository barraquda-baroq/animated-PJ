// dev-only showcase scenes for the props library (pv/engine/lib/props.js)
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;
  function table(ctx, top, bot) { ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, top], [1, bot]]); ctx.fillRect(0, 0, W, H); }
  PV.shot('dev_props_1', { draw(ctx, t) {
    table(ctx, '#e9dcc8', '#cdb89a');
    L.bento(ctx, { x: 520, y: 330, s: 1.0, view: 'angle', tone: 'warm', light: -2.6 });
    L.bento(ctx, { x: 1420, y: 330, s: 1.0, view: 'top', tone: 'warm', light: -2.6 });
    L.bento(ctx, { x: 520, y: 830, s: 0.9, view: 'angle', burnt: true, tone: 'day', light: -2.6 });
    L.bento(ctx, { x: 1420, y: 830, s: 0.9, view: 'top', burnt: true, tone: 'day', light: -2.6 });
  } });
  PV.shot('dev_props_14', { draw(ctx, t) {
    table(ctx, '#e9dcc8', '#cdb89a');
    L.bento(ctx, { x: 960, y: 560, s: 2.0, view: 'angle', tone: 'warm', light: -2.6 });
  } });
})();
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;
  PV.shot('dev_props_2', { draw(ctx, t) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#b99a78'], [1, '#8a6a4c']]); ctx.fillRect(0, 0, W, H);
    L.packJuice(ctx, { x: 200, y: 470, s: 1, tone: 'day' });
    L.packJuice(ctx, { x: 420, y: 470, s: 0.8, tone: 'day', turn: -0.4, flavor: 'peach', dent: 1, strawLean: -0.3 });
    L.apple(ctx, { x: 640, y: 380, s: 1 });
    L.rabbitApple(ctx, { x: 920, y: 400, s: 0.9 });
    L.earplugs(ctx, { x: 1300, y: 380, s: 1.2 });
    L.key(ctx, { x: 1640, y: 360, s: 0.9 });
    L.handCream(ctx, { x: 470, y: 820, s: 1 });
    L.handCream(ctx, { x: 1240, y: 800, s: 0.9, open: true, giftBox: true, tube: false });
    L.key(ctx, { x: 1760, y: 760, s: 0.8, mode: 'hang', swing: 0.15 });
  } });
})();
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;
  const MSG = [{ text: '明日、キミの分もお弁当。作ってくるから。', me: false, time: '12:31' }, { text: 'マジで？', me: true, time: '12:32', read: true }, { text: 'あのさ……タコさんウインナー、入れてよね', me: true, time: '12:32', read: true }];
  PV.shot('dev_props_3', { draw(ctx, t) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#3b4258'], [1, '#1d2232']]); ctx.fillRect(0, 0, W, H);
    L.phone(ctx, t, { x: 170, y: 300, s: 0.75, screen: 'message', messages: MSG, name: '先輩', reveal: 0.9, typing: t > 3, notify: true });
    L.phone(ctx, t, { x: 430, y: 300, s: 0.75, screen: 'player', title: '放課後の音楽室', artist: 'ボイスメモ — 音楽室', duration: 30 });
    L.phone(ctx, t, { x: 690, y: 300, s: 0.75, screen: 'photo', caption: '8月14日', drawPhoto: (c, w, h) => { L.sky(c, [[0, '#3f8ee0'], [1, '#d8eefc']], 0, h * 0.55); c.fillStyle = '#2f7fd8'; c.fillRect(0, h * 0.55, w, h); L.bridge(c, { x0: -20, x1: w + 20, y: h * 0.53, towerH: 60, lw: 2 }); } });
    L.phone(ctx, t, { x: 950, y: 300, s: 0.75, screen: 'off', reflect: 0.8 });
    L.phone(ctx, t, { x: 1210, y: 300, s: 0.75, screen: 'call', name: '先輩', vibrate: true });
    L.phone(ctx, t, { x: 1470, y: 300, s: 0.75, screen: 'lock', notice: { app: 'メッセージ', title: '先輩', text: 'コンクールが終わったらさ……また、セッションしようね' } });
    L.phone(ctx, t, { x: 1730, y: 300, s: 0.75, back: true, notify: true });
    L.earphones(ctx, t, { a: { x: 110, y: 690, ang: 1.9 }, b: { x: 420, y: 700, ang: 1.25 }, split: { x: 270, y: 860 }, end: { x: 250, y: 1040 }, sag: 50, plug: false });
    L.earphones(ctx, t, { a: { x: 520, y: 700, ang: 1.6 }, b: { x: 640, y: 690, ang: 1.5 }, split: { x: 580, y: 900 }, end: { x: 590, y: 1000 }, color: 'white', bud: 1.6, sag: 20, plug: true });
    L.earphones(ctx, t, { mode: 'laid', x: 880, y: 905, s: 0.62, k: 0.55, rot: 0.1 });
    L.necklace(ctx, t, { mode: 'worn', a: { x: 1000, y: 620 }, b: { x: 1160, y: 620 }, drop: 100 });
    L.necklace(ctx, t, { mode: 'hang', a: { x: 1220, y: 620 }, len: 220, metal: 'gold' });
    L.necklace(ctx, t, { mode: 'laid', x: 1360, y: 960, r: 90 });
    L.handkerchief(ctx, t, { x: 1600, y: 600, size: 300, wind: 0.6 });
    L.handkerchief(ctx, t, { x: 1790, y: 930, mode: 'folded', size: 300, pattern: 'border', color: '#e9eef4', tone: 'night' });
  } });
})();
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;
  PV.shot('dev_props_4', { draw(ctx, t) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#5a6880'], [1, '#2e3648']]); ctx.fillRect(0, 0, W, H);
    L.umbrella(ctx, t, { x: 330, y: 150, r: 260, type: 'vinyl', tone: 'rain' });
    L.umbrella(ctx, t, { x: 330, y: 640, r: 230, type: 'navy', tone: 'rain', elev: 0.2, tilt: -0.12 });
    L.ecgMonitor(ctx, t, { x: 980, y: 300, s: 0.95, tone: 'cool' });
    L.ivDrip(ctx, t, { x: 1500, y: 80, tone: 'cool', poleLen: 960 });
    L.handkerchief(ctx, t, { x: 1760, y: 120, size: 300, wind: 0.6, tone: 'rain' });
    L.handkerchief(ctx, t, { x: 1000, y: 860, mode: 'folded', size: 320, pattern: 'border', color: '#e9eef4', tone: 'rain' });
  } });
})();
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;
  PV.shot('dev_props_5', { draw(ctx, t) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#a99a86'], [1, '#6e604e']]); ctx.fillRect(0, 0, W, H);
    L.notebookName(ctx, t, { x: 470, y: 300, s: 0.95, writeStart: 0, writeSpeed: 40, tearAt: 3.0, tearU: 0.5, tearV: 0.45 });
    L.courtyardBench(ctx, { x: 1400, y: 470, s: 0.8, t });
    L.fruitKnifeAndApple(ctx, { x: 300, y: 820, s: 0.85, tone: 'cool' });
    L.applePie(ctx, { x: 860, y: 820, s: 0.75 });
    L.appleCake(ctx, { x: 1490, y: 870, s: 0.8, tone: 'night' });
  } });
})();
// ---- PV-cut showcases: props placed in the actual lighting situations of the storyboard
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, TAU = Math.PI * 2;
  const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

  // wooden desk top in perspective (y0: far edge), warm grain
  function desk(c, y0, cols, seed) {
    c.save();
    c.fillStyle = PV.linGrad(c, 0, y0, 0, H, [[0, cols[0]], [0.45, cols[1]], [1, cols[2]]]); c.fillRect(0, y0, W, H - y0);
    const r = PV.rng(seed || 3); c.globalAlpha = 0.18; c.lineWidth = 1.4;
    for (let i = 0; i < 70; i++) {
      const yy = y0 + Math.pow(r(), 1.6) * (H - y0); const k = (yy - y0) / (H - y0);
      c.strokeStyle = r() > 0.5 ? '#5a3a1e' : '#fff0d0'; c.beginPath(); c.moveTo(-20, yy);
      for (let x = 0; x <= W + 40; x += 60) c.lineTo(x, yy + Math.sin(x * 0.004 + i) * (2 + 10 * k) + PV.noise2(x * 0.002, i) * 6 * k);
      c.stroke();
    }
    c.restore();
    c.fillStyle = PV.linGrad(c, 0, y0 - 2, 0, y0 + 26, [[0, '#ffffff', 0.35], [1, '#ffffff', 0]]); c.fillRect(0, y0 - 2, W, 28);
  }

  /* 6: 春の音楽室 — 机の上の弁当に窓の光 */
  PV.shot('dev_props_6', { draw(ctx, t) {
    // static plate (cached once): far room in soft focus, desk, window light & mullion shadows
    ctx.drawImage(PV.cached('dp6_plate', W, H, (ctx) => {
    L.blurred(ctx, 7, (c) => {
      R(c, 0, 0, W, 330, '#f3e2c8');
      c.fillStyle = PV.linGrad(c, 0, 0, 0, 300, [[0, '#9cc8ee'], [1, '#e9f3fb']]); c.fillRect(-20, -20, 640, 320);
      L.glow(c, 120, 60, 520, '#fff8e8', 0.9);
      c.fillStyle = 'rgba(255,190,210,0.55)'; const r = PV.rng(4); for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(r() * 600, 170 + r() * 140, 10 + r() * 30, 0, TAU); c.fill(); }
      R(c, 600, 0, 26, 330, '#e6d2b2'); R(c, 290, 0, 16, 300, '#efe3cf'); R(c, 0, 140, 620, 12, '#efe3cf');
      R(c, 900, 40, 520, 200, '#6b4a34'); R(c, 920, 60, 480, 160, '#3e2a1e'); // blackboard-ish cabinet
      c.fillStyle = PV.linGrad(c, 0, 250, 0, 330, [[0, '#f3e2c8', 0], [1, '#d9c3a2', 1]]); c.fillRect(0, 250, W, 80);
    });
    desk(ctx, 300, ['#d8b58a', '#c49b6c', '#8c6440'], 5);
    // window light falling across the desk (pane shapes with mullion shadows)
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.filter = 'blur(18px)';
    ctx.fillStyle = 'rgba(255,244,214,0.95)';
    ctx.beginPath(); ctx.moveTo(-100, 330); ctx.lineTo(1050, 300); ctx.lineTo(1500, 1080); ctx.lineTo(-100, 1080); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.filter = 'blur(10px)'; ctx.fillStyle = 'rgba(120,90,80,0.35)';
    ctx.beginPath(); ctx.moveTo(420, 300); ctx.lineTo(470, 300); ctx.lineTo(820, 1080); ctx.lineTo(740, 1080); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1050, 300); ctx.lineTo(1250, 300); ctx.lineTo(1920, 1000); ctx.lineTo(1920, 1080); ctx.lineTo(1500, 1080); ctx.closePath(); ctx.fill();
    ctx.restore();
    }), 0, 0);
    const lt = { tone: 'warm', light: -2.62 };
    L.bento(ctx, Object.assign({ x: 860, y: 640, s: 1.3, view: 'angle', lid: true, chopsticks: true }, lt));
    L.packJuice(ctx, Object.assign({ x: 1590, y: 820, s: 1.15, turn: 0.45 }, lt));
    L.godRays(ctx, t, { x: 120, y: -60, angle: 0.62, spread: 0.45, count: 8, length: 1700, width: 160, alpha: 0.14, color: '#fff2d2' });
    L.dust(ctx, t, { seed: 6, count: 70, x0: 0, y0: 100, x1: 1300, y1: 900, alpha: 0.55, size: 2.4 });
  } });

  /* 7: 病室 — 窓辺の心電図モニター、点滴、剥きかけのリンゴ */
  PV.shot('dev_props_7', { draw(ctx, t) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, W, 0, [[0, '#d9e2e8'], [0.55, '#eef3f5'], [1, '#e6edf1']]); ctx.fillRect(0, 0, W, H);
    // window
    const wx = 980, wy = 90, ww = 860, wh = 640;
    ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
    L.sky(ctx, [[0, '#4f8fd8'], [0.6, '#a9d2f2'], [1, '#e6f3fb']], wy, wy + wh * 0.82);
    L.clouds(ctx, t, { seed: 21, count: 4, y0: wy + 40, y1: wy + 260, minW: 260, maxW: 520, speed: 3, colors: { lit: '#ffffff', mid: '#f0f5fb', shadow: '#b6c6de' } });
    ctx.fillStyle = PV.linGrad(ctx, 0, wy + wh * 0.62, 0, wy + wh, [[0, '#7fb2dc'], [1, '#4f86c0']]); ctx.fillRect(wx, wy + wh * 0.62, ww, wh * 0.4);
    L.bridge(ctx, { x0: wx + 80, x1: wx + 760, y: wy + wh * 0.62, towerH: 120, color: '#f6f8fb', lw: 3.2, alpha: 0.9 });
    L.haze(ctx, t, { seed: 3, y0: wy + 300, y1: wy + 420, alpha: 0.3 });
    ctx.restore();
    // window frame
    ctx.strokeStyle = '#f7f9fa'; ctx.lineWidth = 22; ctx.strokeRect(wx, wy, ww, wh); ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,140,160,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(wx - 11, wy - 11, ww + 22, wh + 22);
    // sheer curtain on the right
    ctx.save(); const cr = PV.rng(9);
    for (let i = 0; i < 9; i++) { const x0 = 1700 + i * 26 + Math.sin(t * 0.8 + i) * 6; ctx.fillStyle = `rgba(255,255,255,${0.16 + 0.1 * (i % 2)})`; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.bezierCurveTo(x0 + 20, 300, x0 - 16 + Math.sin(t + i) * 10, 600, x0 + 8, 1080); ctx.lineTo(x0 + 40, 1080); ctx.bezierCurveTo(x0 + 30, 600, x0 + 50, 300, x0 + 34, 0); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // light from the window onto the wall/floor
    L.godRays(ctx, t, { x: 1400, y: 200, angle: 2.55, spread: 0.35, count: 6, length: 1500, width: 220, alpha: 0.1, color: '#f4fbff' });
    // overbed table
    ctx.fillStyle = PV.linGrad(ctx, 0, 800, 0, 1080, [[0, '#f4f6f6'], [1, '#c9d3d9']]); ctx.beginPath(); ctx.moveTo(980, 820); ctx.lineTo(1920, 790); ctx.lineTo(1920, 1080); ctx.lineTo(880, 1080); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(140,160,175,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(980, 820); ctx.lineTo(1920, 790); ctx.stroke();
    // bed sheet (bottom-left)
    ctx.fillStyle = PV.linGrad(ctx, 0, 860, 0, 1080, [[0, '#ffffff'], [1, '#cbd8e2']]); ctx.beginPath(); ctx.moveTo(0, 900); ctx.bezierCurveTo(300, 870, 600, 930, 860, 900); ctx.lineTo(880, 1080); ctx.lineTo(0, 1080); ctx.closePath(); ctx.fill();
    const lt = { tone: 'cool', light: -0.45 };
    L.ivDrip(ctx, t, Object.assign({ x: 860, y: 70, poleLen: 960, tubeTo: { dx: -300, dy: 860 }, rimA: 0.9 }, lt));
    L.ecgMonitor(ctx, t, Object.assign({ x: 400, y: 380, s: 0.9, mount: true, bpm: 64 }, lt));
    L.fruitKnifeAndApple(ctx, Object.assign({ x: 1380, y: 900, s: 1.05 }, lt));
    L.dust(ctx, t, { seed: 8, count: 40, x0: 900, y0: 100, x1: 1700, y1: 800, alpha: 0.35, size: 2, color: '#f4fbff' });
  } });

  /* 8: 雨の窓辺 — 耳栓とスマホ（通知ランプ） */
  PV.shot('dev_props_8', { draw(ctx, t) {
    // outside (blurred): wet grey city
    ctx.drawImage(PV.cached('dp8_city', W, H, (cc) => L.blurred(cc, 10, (c) => {
      c.fillStyle = PV.linGrad(c, 0, 0, 0, 700, [[0, '#6c7a90'], [1, '#9aa6b8']]); c.fillRect(0, 0, W, 760);
      L.skyline(c, { seed: 4, y: 640, hMin: 120, hMax: 420, color: '#4a5568', windowColor: '#f2dca8', lit: 0.12 });
      L.skyline(c, { seed: 9, y: 720, hMin: 60, hMax: 200, color: '#3a4456', windowColor: '#f6e2b0', lit: 0.18 });
    })), 0, 0);
    L.rain(ctx, t, { seed: 4, count: 320, angle: 0.08, speed: 1700, len: 70, alpha: 0.22, y1: 760 });
    // window frame & glass
    ctx.fillStyle = 'rgba(160,176,200,0.08)'; ctx.fillRect(0, 0, W, 760);
    L.rainOnGlass ? L.rainOnGlass(ctx, t, { seed: 3, count: 220, trickles: 14, tint: '#a9b8cc' }) : null;
    ctx.fillStyle = '#dfe5ec'; ctx.fillRect(0, 0, W, 26); ctx.fillRect(950, 0, 22, 760);
    // sill
    ctx.fillStyle = PV.linGrad(ctx, 0, 740, 0, 1080, [[0, '#8f9bb0'], [0.08, '#a9b4c6'], [1, '#4e5a70']]); ctx.beginPath(); ctx.moveTo(0, 760); ctx.lineTo(W, 740); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(220,230,245,0.55)'; ctx.fillRect(0, 752, W, 3);
    // window reflection on the sill (cool)
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = PV.linGrad(ctx, 0, 760, 0, 1000, [[0, '#a8b8d0', 0.35], [1, '#a8b8d0', 0]]); ctx.fillRect(0, 760, W, 260); ctx.restore();
    const lt = { tone: 'rain', light: -1.6, rimA: 0.6 };
    L.earplugs(ctx, Object.assign({ x: 720, y: 880, s: 1.35, rot: -0.1 }, lt));
    // phone lying flat on the sill (foreshortened), screen lit with a notification, LED blinking
    ctx.save(); ctx.translate(1220, 880); ctx.scale(1, 0.56); ctx.rotate(-0.32);
    L.phone(ctx, t, Object.assign({ x: 0, y: 0, s: 0.75, screen: 'lock', clock: '22:47', date: '11月14日 木曜日', notify: '#7fd4ff', notice: { app: '着信', title: '不在着信 (3)', text: 'メッセージ 5件', when: '1分前' } }, lt));
    ctx.restore();
    L.glow(ctx, 1220, 880, 420, '#bcd2ff', 0.3); L.glow(ctx, 1150, 800, 80, '#7fd4ff', 0.25 * Math.pow(Math.max(0, Math.sin(((t % 1.6) / 1.6) * Math.PI)), 2));
  } });

  /* 9: 中庭 — 青空、木漏れ日のベンチ、パックジュースとイヤホン */
  PV.shot('dev_props_9', { draw(ctx, t) {
    L.sky(ctx, [[0, '#5d9be0'], [0.6, '#9ccbf1'], [1, '#d8ecfa']], 0, 520);
    L.clouds(ctx, t, { seed: 5, count: 5, y0: 40, y1: 260, minW: 360, maxW: 760, speed: 5, colors: { lit: '#ffffff', mid: '#eef3fb', shadow: '#a9bde0', rim: '#ffffff' } });
    // school building
    ctx.fillStyle = '#ece6da'; ctx.fillRect(0, 230, W, 300); ctx.fillStyle = '#d6cebf'; ctx.fillRect(0, 230, W, 14);
    for (let i = 0; i < 12; i++) { ctx.fillStyle = '#9fb6cf'; ctx.fillRect(40 + i * 160, 280, 110, 70); ctx.fillRect(40 + i * 160, 390, 110, 70); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(40 + i * 160, 280, 110, 8); }
    // ground
    ctx.fillStyle = PV.linGrad(ctx, 0, 520, 0, H, [[0, '#d9d2c4'], [1, '#bdb3a2']]); ctx.fillRect(0, 520, W, H - 520);
    ctx.strokeStyle = 'rgba(150,140,120,0.35)'; ctx.lineWidth = 1.5; for (let i = 0; i < 14; i++) { const y = 540 + Math.pow(i / 14, 1.7) * 560; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // foliage shade on the ground: clustered leaf shadows with sunlit gaps
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; const r = PV.rng(11);
    for (let cl = 0; cl < 9; cl++) {
      const cx = r() * W, cy = 600 + r() * 480, sp = 120 + r() * 220;
      for (let i = 0; i < 46; i++) { const a = r() * TAU, d = Math.sqrt(r()) * sp; const x = cx + Math.cos(a) * d + PV.noise2(cl * 9 + i, t * 0.25) * 6, y = cy + Math.sin(a) * d * 0.42; const rad = 10 + r() * 26; ctx.fillStyle = 'rgba(96,104,138,0.30)'; ctx.beginPath(); ctx.ellipse(x, y, rad, rad * 0.45, r() * 0.6 - 0.3, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    const lt = { tone: 'day', light: -2.1 };
    L.courtyardBench(ctx, Object.assign({ x: 960, y: 900, s: 1.3, t }, lt));
    L.packJuice(ctx, Object.assign({ x: 700, y: 712, s: 0.62, turn: 0.5 }, lt));
    L.earphones(ctx, t, Object.assign({ mode: 'laid', x: 1080, y: 712, s: 0.4, k: 0.3, rot: -0.1 }, lt));
    // foreground leaves framing (out of focus)
    ctx.drawImage(PV.cached('dp9_leaves', W, H, (cc) => L.blurred(cc, 8, (c) => { c.fillStyle = '#2f4a2a'; const rr = PV.rng(3); for (let i = 0; i < 40; i++) { const x = rr() * 520 - 60, y = rr() * 260 - 60; c.beginPath(); c.ellipse(x, y, 40 + rr() * 50, 20 + rr() * 20, rr() * 3, 0, TAU); c.fill(); } }, 'props_leaves')), 0, 0);
    L.godRays(ctx, t, { x: 300, y: -40, angle: 1.1, spread: 0.4, count: 6, length: 1300, width: 120, alpha: 0.12 });
  } });

  /* 10: 夜の臨海公園 — リンゴのホールケーキ */
  PV.shot('dev_props_10', { draw(ctx, t) {
    L.sky(ctx, [[0, '#0b1230'], [0.6, '#1d2b55'], [1, '#33406e']], 0, 560);
    L.stars(ctx, t, { count: 120, yMax: 400, alpha: 0.6 });
    L.skyline(ctx, { seed: 12, y: 560, hMin: 30, hMax: 150, color: '#141c3a', windowColor: '#ffd590', lit: 0.25 });
    L.bridge(ctx, { x0: -100, x1: 1100, y: 548, towerH: 130, color: '#c9d2ea', lw: 2.4, alpha: 0.55 });
    ctx.fillStyle = PV.linGrad(ctx, 0, 560, 0, 760, [[0, '#1a2448'], [1, '#0d1430']]); ctx.fillRect(0, 560, W, 200);
    L.bokeh(ctx, t, { seed: 4, count: 60, x0: 0, y0: 470, x1: W, y1: 640, rmin: 8, rmax: 34, alpha: 0.5, colors: ['#ffd9a0', '#ffffff', '#ffb8c8', '#ffcf80'] });
    // reflections on the water
    ctx.save(); ctx.globalCompositeOperation = 'screen'; const r = PV.rng(7); for (let i = 0; i < 40; i++) { const x = r() * W; ctx.fillStyle = `rgba(255,214,150,${0.08 + r() * 0.12})`; ctx.fillRect(x, 570 + r() * 20, 2 + r() * 4, 60 + r() * 120); } ctx.restore();
    // lawn + the blazer spread as a sheet
    ctx.fillStyle = PV.linGrad(ctx, 0, 740, 0, H, [[0, '#18263a'], [1, '#0b1422']]); ctx.fillRect(0, 740, W, H - 740);
    ctx.fillStyle = '#1e2846'; ctx.beginPath(); ctx.moveTo(560, 900); ctx.bezierCurveTo(700, 800, 1300, 790, 1420, 860); ctx.bezierCurveTo(1500, 960, 1400, 1080, 1300, 1080); ctx.lineTo(520, 1080); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(140,160,220,0.25)'; ctx.lineWidth = 3; ctx.stroke();
    // key light: a park street lamp off-frame at the upper right (warm), fill: the cool night sky
    L.glow(ctx, 1880, 380, 700, '#ffcf8a', 0.22);
    L.appleCake(ctx, { x: 980, y: 930, s: 1.1, tone: { amb: '#7d7cb4', k: 0.55, sat: 0.9, hi: '#fff0d6', sh: '#0e1430', rim: '#ffc978', rimA: 0.95 }, light: -0.55 });
    L.glow(ctx, 1060, 800, 300, '#ffd9a8', 0.05);
  } });

  /* 11: 誕生日 — ピアノの蓋の上のハンドクリーム（黒い鏡面に映り込む） */
  PV.shot('dev_props_11', { draw(ctx, t) {
    ctx.drawImage(PV.cached('dp11_room', W, H, (cc) => L.blurred(cc, 9, (c) => { c.fillStyle = PV.linGrad(c, 0, 0, W, 0, [[0, '#fff1d8'], [1, '#d9b98e']]); c.fillRect(0, 0, W, 520); L.glow(c, 200, 120, 700, '#fffaf0', 0.9); c.fillStyle = '#8f6a48'; c.fillRect(1200, 60, 520, 380); c.fillStyle = '#5a3e2a'; c.fillRect(1230, 90, 460, 320); c.fillStyle = '#c9a77d'; c.fillRect(0, 430, W, 120); c.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 6; i++) c.fillRect(1260 + i * 70, 120, 40, 260); })), 0, 0);
    // black lacquer piano lid
    ctx.fillStyle = PV.linGrad(ctx, 0, 470, 0, H, [[0, '#2a2420'], [0.12, '#100c0b'], [1, '#050404']]); ctx.beginPath(); ctx.moveTo(0, 500); ctx.lineTo(W, 470); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = PV.linGrad(ctx, 0, 470, 0, 760, [[0, '#fff1d8', 0.35], [1, '#fff1d8', 0]]); ctx.fillRect(0, 470, W, 300); ctx.restore();
    const o = { x: 960, y: 800, s: 1.25, tone: 'warm', light: -2.7, rimA: 0.7, giftBox: true, tube: false };
    const tb = { x: 1010, y: 905, s: 1.25, tone: 'warm', light: -2.7, rimA: 0.7, tin: false, tubeAt: { x: 0, y: 0, rot: -0.1 } };
    // mirror images in the black lacquer, each about its own contact line (box base ≈ y+38·s, tube ≈ y+30·s)
    const mirror = (yl, fn) => { ctx.save(); ctx.translate(0, 2 * yl); ctx.scale(1, -1); ctx.globalAlpha = 0.26; fn(); ctx.restore(); };
    mirror(800 + 50, () => L.handCream(ctx, Object.assign({}, o, { shadow: false })));
    mirror(905 + 34, () => L.handCream(ctx, Object.assign({}, tb, { shadow: false })));
    ctx.fillStyle = PV.linGrad(ctx, 0, 850, 0, H, [[0, '#050404', 0.15], [1, '#050404', 0.8]]); ctx.fillRect(0, 850, W, H - 850);
    L.handCream(ctx, o); L.handCream(ctx, tb);
    L.dust(ctx, t, { seed: 3, count: 50, x0: 0, y0: 100, x1: 1400, y1: 800, alpha: 0.5, size: 2.2 });
    L.godRays(ctx, t, { x: 60, y: -80, angle: 0.75, spread: 0.4, count: 7, length: 1600, width: 150, alpha: 0.12 });
  } });

  /* 12: 沈黙の日々 — 左手で書き続ける名前、ノートに落ちる涙、テーブルの鍵 */
  PV.shot('dev_props_12', { draw(ctx, t) {
    ctx.drawImage(PV.cached('dp12_desk', W, H, (c) => desk(c, -10, ['#a49a8c', '#8d877f', '#5e5850'], 9)), 0, 0);
    L.glow(ctx, 1300, 160, 900, '#f2ece2', 0.35);
    L.notebookName(ctx, t, { x: 900, y: 560, s: 1.25, tone: 'mute', light: -1.0, writeStart: -40, writeSpeed: 9, perLine: 3, lines: 9, tearAt: 2.2, tearU: 0.4, tearV: 0.3, k: 0.8 });
    L.key(ctx, { x: 1620, y: 880, s: 1.1, tone: 'mute', light: -1.0, keyAng: 2.6, pickAng: 0.9 });
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = PV.radGrad(ctx, 1500, 120, 50, 1500, [[0, '#fff6e6', 0.6], [1, '#2a2622', 0.7]]); ctx.fillRect(0, 0, W, H); ctx.restore();
  } });
})();
// ---- perf probe: average draw time per prop (warm cache), printed on the frame
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;
  const MSG = [{ text: '明日、キミの分もお弁当。作ってくるから。', me: false }, { text: 'タコさんウインナー、入れてよね', me: true }];
  const tests = [
    ['bento', (c, t) => L.bento(c, { x: 600, y: 500, s: 1.3, tone: 'warm' })],
    ['bento burnt', (c, t) => L.bento(c, { x: 600, y: 500, s: 1.3, burnt: true })],
    ['packJuice', (c, t) => L.packJuice(c, { x: 600, y: 600 })],
    ['apple', (c, t) => L.apple(c, { x: 600, y: 500 })],
    ['rabbitApple', (c, t) => L.rabbitApple(c, { x: 600, y: 500 })],
    ['applePie', (c, t) => L.applePie(c, { x: 600, y: 500 })],
    ['appleCake', (c, t) => L.appleCake(c, { x: 600, y: 500 })],
    ['earplugs', (c, t) => L.earplugs(c, { x: 600, y: 500 })],
    ['key', (c, t) => L.key(c, { x: 600, y: 500 })],
    ['handCream', (c, t) => L.handCream(c, { x: 600, y: 500, giftBox: true })],
    ['fruitKnifeAndApple', (c, t) => L.fruitKnifeAndApple(c, { x: 600, y: 500 })],
    ['courtyardBench', (c, t) => L.courtyardBench(c, { x: 600, y: 700, t })],
    ['phone message', (c, t) => L.phone(c, t, { x: 600, y: 500, messages: MSG, notify: true, glow: 1 })],
    ['phone player', (c, t) => L.phone(c, t, { x: 600, y: 500, screen: 'player', duration: 20 })],
    ['phone off', (c, t) => L.phone(c, t, { x: 600, y: 500, screen: 'off' })],
    ['earphones', (c, t) => L.earphones(c, t, { end: { x: 900, y: 900 }, plug: true })],
    ['necklace worn', (c, t) => L.necklace(c, t, {})],
    ['handkerchief held', (c, t) => L.handkerchief(c, t, { x: 600, y: 300 })],
    ['handkerchief folded', (c, t) => L.handkerchief(c, t, { x: 600, y: 300, mode: 'folded' })],
    ['earphones laid', (c, t) => L.earphones(c, t, { mode: 'laid', x: 600, y: 500 })],
    ['phone lock', (c, t) => L.phone(c, t, { x: 600, y: 500, screen: 'lock', notice: { title: '先輩', text: 'また、セッションしようね' } })],
    ['umbrella vinyl', (c, t) => L.umbrella(c, t, { x: 600, y: 200 })],
    ['umbrella navy', (c, t) => L.umbrella(c, t, { x: 600, y: 200, type: 'navy' })],
    ['ecgMonitor', (c, t) => L.ecgMonitor(c, t, { x: 600, y: 500 })],
    ['ivDrip', (c, t) => L.ivDrip(c, t, { x: 600, y: 100 })],
    ['notebookName', (c, t) => L.notebookName(c, t, { x: 600, y: 500, writeStart: -20, writeSpeed: 9, tearAt: 0.5 })],
  ];
  PV.shot('dev_props_perf', { draw(ctx, t) {
    const b = PV.buffer('props_perf'); const res = [];
    for (const [name, fn] of tests) {
      const flush = () => b.ctx.getImageData(0, 0, 1, 1); // Canvas2D records lazily: force the raster work into the timing
      fn(b.ctx, t); flush(); // warm
      const N = 5; let ms = 0; for (let i = 0; i < N; i++) { b.ctx.clearRect(0, 0, W, H); flush(); const t0 = performance.now(); fn(b.ctx, t + i / 24); flush(); ms += (performance.now() - t0) / N; }
      res.push([name, ms]);
    }
    ctx.fillStyle = '#10141c'; ctx.fillRect(0, 0, W, H);
    ctx.font = '600 26px "Inter", sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('props.js — average draw time per call (warm cache, rasterised)', 60, 70);
    ctx.font = '500 24px "JetBrains Mono", monospace';
    res.forEach(([n, ms], i) => { const x = 60 + Math.floor(i / 14) * 900, y = 130 + (i % 14) * 64; ctx.fillStyle = ms > 40 ? '#ff7a7a' : ms > 20 ? '#ffd27a' : '#8affb0'; ctx.fillText(n.padEnd(22, ' ') + ms.toFixed(2) + ' ms', x, y); });
  } });
})();
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, TAU = Math.PI * 2;
  /* 13: 臨海公園の芝生 — 片手で作った「ちょっと失敗しちゃった」お弁当（白い橋と海） */
  PV.shot('dev_props_13', { draw(ctx, t) {
    L.sky(ctx, [[0, '#4f8fe0'], [0.7, '#a8d4f4'], [1, '#e8f4fc']], 0, 330);
    L.clouds(ctx, t, { seed: 14, count: 4, y0: 30, y1: 200, minW: 300, maxW: 620, speed: 4, colors: { lit: '#ffffff', mid: '#f1f6fd', shadow: '#a9bfe0', rim: '#ffffff' } });
    L.sea(ctx, t, { horizonY: 330, y1: 470, sunX: 1300, sparkles: 260 });
    L.bridge(ctx, { x0: 700, x1: 1900, y: 320, towerH: 90, color: '#f7f9fc', lw: 2.6 });
    // lawn + picnic cloth (static plate, cached)
    ctx.drawImage(PV.cached('dp13_lawn', W, H, (ctx) => {
    ctx.fillStyle = PV.linGrad(ctx, 0, 440, 0, H, [[0, '#8fbf5a'], [0.4, '#6fa346'], [1, '#4c7f30']]); ctx.beginPath(); ctx.moveTo(0, 470); ctx.bezierCurveTo(600, 440, 1300, 455, 1920, 450); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    const r = PV.rng(5); ctx.lineWidth = 2; for (let i = 0; i < 900; i++) { const x = r() * W, y = 470 + Math.pow(r(), 0.8) * 620; const l = 6 + (y - 470) / 40; ctx.strokeStyle = r() > 0.5 ? 'rgba(170,215,110,0.5)' : 'rgba(50,90,30,0.4)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 4, y - l); ctx.stroke(); }
    ctx.fillStyle = '#f2ece2'; ctx.beginPath(); ctx.moveTo(380, 560); ctx.lineTo(1560, 540); ctx.lineTo(1760, 1080); ctx.lineTo(200, 1080); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,150,200,0.45)'; ctx.lineWidth = 10; for (let i = 0; i < 7; i++) { const f = i / 6; ctx.beginPath(); ctx.moveTo(lerp(380, 200, 0) + (1560 - 380) * f, 560 - 20 * f); ctx.lineTo(200 + (1760 - 200) * f, 1080); ctx.stroke(); }
    }), 0, 0);
    const lt = { tone: 'day', light: -2.2, rimA: 0.35 };
    // the lid is slipped under the box (as people do on a picnic cloth): only its rim shows round the foot
    L.bento(ctx, Object.assign({ x: 940, y: 740, s: 1.2, view: 'angle', burnt: true, lid: true, lidX: 26, lidY: 30, lidRot: -7 }, lt));
    L.handkerchief(ctx, t, Object.assign({ x: 1500, y: 880, mode: 'folded', size: 320 }, lt));
    L.dust(ctx, t, { seed: 2, count: 30, alpha: 0.4, size: 2, color: '#ffffff' });
  } });
  function lerp(a, b, f) { return a + (b - a) * f; }
})();
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;
  PV.shot('dev_props_15', { draw(ctx, t) {
    ctx.fillStyle = '#e9dcc8'; ctx.fillRect(0, 0, W, H);
    L.bento(ctx, { x: 960, y: 560, s: 2.0, view: 'angle', burnt: true, tone: 'day', light: -2.4 });
  } });
})();

// Dev sheets for the anime head library (PV.anime.head / headBack / bust) — see analysis/art_review/anime_head_API.md
(function () {
  const PV = window.PV, W = PV.W, H = PV.H;
  function sheetBg(ctx, top = '#f1f2f5', bot = '#dde1e8') { ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, top], [1, bot]]); ctx.fillRect(0, 0, W, H); }
  function label(ctx, txt, x, y, col = '#5a6170', size = 20) { ctx.save(); ctx.font = `${size}px sans-serif`; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(txt, x, y); ctx.restore(); }
  const nopost = { bloom: 0.12, grain: 0.2, vignette: 0.12, halation: 0.2 };

  /* ---------- 1: turnaround 先輩 (yaw -1, -0.5, 0, 0.5, 1, back) */
  PV.shot('dev_anime_head_1', { draw(ctx, t, d, S, env) {
    sheetBg(ctx); const T = env.T;
    const views = [['yaw -1', { yaw: -1 }], ['yaw -0.5', { yaw: -0.5 }], ['yaw 0', { yaw: 0 }], ['yaw 0.5', { yaw: 0.5 }], ['yaw 1', { yaw: 1 }], ['back', { back: true }]];
    views.forEach(([lab, v], i) => {
      const x = 165 + i * 318, y = 470;
      PV.anime.head(ctx, Object.assign({ who: 'senpai', x, y, size: 300, T, neck: true, neckLen: 0.42, expr: 'neutral', seed: 3 + i }, v));
      label(ctx, lab, x, 60);
    });
  } });

  /* ---------- 2: turnaround 彼 */
  PV.shot('dev_anime_head_2', { draw(ctx, t, d, S, env) {
    sheetBg(ctx); const T = env.T;
    const views = [['yaw -1', { yaw: -1 }], ['yaw -0.5', { yaw: -0.5 }], ['yaw 0', { yaw: 0 }], ['yaw 0.5', { yaw: 0.5 }], ['yaw 1', { yaw: 1 }], ['back', { back: true }]];
    views.forEach(([lab, v], i) => {
      const x = 165 + i * 318, y = 560;
      PV.anime.head(ctx, Object.assign({ who: 'boy', x, y, size: 320, T, neck: true, neckLen: 0.42, expr: 'neutral', seed: 7 + i }, v));
      label(ctx, lab, x, 60);
    });
  } });

  /* ---------- 3 / 4: expression sheets */
  const EXPRS = ['neutral', 'smile', 'gentle', 'closed', 'teary', 'cry', 'shout', 'surprise', 'sad', 'empty', 'determined', 'pain', 'sleep', 'focus'];
  function exprSheet(ctx, T, who, yaw, size, y0) {
    sheetBg(ctx, '#f3f1ee', '#e2dfda');
    EXPRS.forEach((e, i) => {
      const col = i % 7, row = Math.floor(i / 7), cw = W / 7, ch = H / 2;
      const x = cw * col + cw / 2, y = ch * row + y0;
      ctx.save(); ctx.beginPath(); ctx.rect(cw * col + 2, ch * row + 2, cw - 4, ch - 4); ctx.clip();
      PV.anime.head(ctx, { who, x, y, size, yaw: yaw * (col % 2 ? -1 : 1), T, expr: e, neck: true, neckLen: 0.5, seed: 5 + i, talk: false });
      ctx.restore();
      ctx.fillStyle = 'rgba(245,244,240,0.85)'; ctx.fillRect(x - 70, ch * row + ch - 40, 140, 34);
      label(ctx, e, x, ch * row + ch - 16, '#3a404c', 22);
    });
  }
  PV.shot('dev_anime_head_3', { draw(ctx, t, d, S, env) { exprSheet(ctx, env.T, 'senpai', 0.18, 250, 300); } });
  PV.shot('dev_anime_head_4', { draw(ctx, t, d, S, env) { exprSheet(ctx, env.T, 'boy', 0.18, 262, 310); } });

  /* ---------- 5: lighting sheet (both characters) */
  const LIGHTS = [
    ['day', ['#cfe3f7', '#eef3f8'], -2.3], ['window', ['#fff6e6', '#d9c4a6'], -0.7], ['classroom', ['#efe6d6', '#cdbfa8'], -2.5], ['sunset', ['#f6b77a', '#6a4a6e'], -0.4],
    ['night', ['#1b2140', '#3a3560'], -2.6], ['storm', ['#1d2433', '#39445c'], -1.9], ['stage', ['#ffffff', '#e4e6ec'], -1.6], ['room_gray', ['#9a9a9c', '#6c6d72'], -2.2],
    ['lamp', ['#2c2228', '#6b4a32'], -0.5], ['summer', ['#5fa6ec', '#cfe8fb'], -2.0],
  ];
  PV.shot('dev_anime_head_5', { draw(ctx, t, d, S, env) {
    const T = env.T; const cw = W / 5, ch = H / 2;
    LIGHTS.forEach(([L, bg, rd], i) => {
      const col = i % 5, row = Math.floor(i / 5), x0 = cw * col, y0 = ch * row;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, cw, ch); ctx.clip();
      ctx.fillStyle = PV.linGrad(ctx, 0, y0, 0, y0 + ch, [[0, bg[0]], [1, bg[1]]]); ctx.fillRect(x0, y0, cw, ch);
      PV.anime.head(ctx, { who: 'senpai', x: x0 + cw * 0.3, y: y0 + 330, size: 200, yaw: 0.35, T, light: L, rimDir: rd, neck: true, neckLen: 0.6, expr: 'neutral' });
      PV.anime.head(ctx, { who: 'boy', x: x0 + cw * 0.72, y: y0 + 335, size: 205, yaw: -0.35, T, light: L, rimDir: rd, neck: true, neckLen: 0.6, expr: 'neutral' });
      ctx.restore();
      label(ctx, L, x0 + cw / 2, y0 + 34, i === 4 || i === 5 || i === 8 ? '#e8e8f0' : '#3a3f4a', 24);
    });
  } });

  /* ---------- 6: big close-up, 3/4, window backlight: blink, V01 lip-sync, wind, tears welling -> falling */
  PV.shot('dev_anime_head_6', { draw(ctx, t, d, S, env) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, W, 0, [[0, '#d7c3a6'], [0.55, '#fff7e8'], [1, '#fffdf8']]); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PV.radGrad(ctx, 1500, 260, 0, 900, [[0, '#ffffff', 0.9], [1, '#ffffff', 0]]); ctx.fillRect(0, 0, W, H);
    const tears = t < 2.5 ? 0.62 * PV.smooth(0.3, 2.3, t) : lerp(0.62, 1, PV.smooth(2.5, 3.6, t));
    PV.anime.head(ctx, { who: 'senpai', x: 860, y: 860, size: 600, yaw: 0.38, pitch: 0.04, roll: -0.04, T: 12.6 + t, talk: true, light: 'window', rimDir: -0.55,
      expr: 'teary', eyes: { tears, look: [0.45, 0.05] }, hair: { style: 'down', wind: 0.55, windDir: PI * 0.95 }, neck: true, neckLen: 0.5 });
  } });

  /* ---------- 7: hair styles + the aunt + small sizes */
  PV.shot('dev_anime_head_7', { draw(ctx, t, d, S, env) {
    sheetBg(ctx, '#eef0ee', '#d9ddd8'); const T = env.T;
    ['down', 'updo', 'loose', 'wet'].forEach((st, i) => {
      const x = 170 + i * 330;
      ctx.save(); ctx.beginPath(); ctx.rect(x - 165, 0, 330, 700); ctx.clip();
      PV.anime.head(ctx, { who: 'senpai', x, y: 420, size: 250, yaw: i % 2 ? -0.42 : 0.42, T, hair: { style: st }, neck: true, neckLen: 0.5, light: st === 'wet' ? 'storm' : 'day', rimDir: -2.0, expr: st === 'wet' ? 'cry' : 'neutral' });
      ctx.restore(); label(ctx, '先輩 ' + st, x, 690);
    });
    ctx.save(); ctx.beginPath(); ctx.rect(1330, 0, 590, 700); ctx.clip();
    PV.anime.head(ctx, { who: 'aunt', x: 1500, y: 420, size: 250, yaw: 0.3, T, expr: 'neutral', eyes: { open: 0.85 }, neck: true, neckLen: 0.5 });
    PV.anime.head(ctx, { who: 'aunt', x: 1790, y: 420, size: 250, yaw: 0.0, back: true, T, neck: true, neckLen: 0.5 });
    ctx.restore(); label(ctx, '叔母', 1640, 690);
    [40, 60, 90, 140].forEach((sz, i) => {
      const x = 120 + [0, 90, 220, 420][i], y = 1000 - sz * 0.25;
      PV.anime.head(ctx, { who: 'senpai', x, y, size: sz, yaw: 0.3, T, neck: true, neckLen: 0.5, expr: 'smile' });
      PV.anime.head(ctx, { who: 'boy', x: x + 820, y, size: sz, yaw: -0.3, T, neck: true, neckLen: 0.5 });
      label(ctx, sz + 'px', x, 1070, '#4a505c', 16); label(ctx, sz + 'px', x + 820, 1070, '#4a505c', 16);
    });
  } });

  /* ---------- 8: busts in every outfit */
  PV.shot('dev_anime_head_8', { draw(ctx, t, d, S, env) {
    sheetBg(ctx, '#eef1f4', '#d8dde4'); const T = env.T;
    const row1 = ['uniform', 'blazer', 'dress', 'dress_cardigan', 'summer', 'gown', 'home'];
    const row2 = [['boy', 'uniform'], ['boy', 'blazer'], ['boy', 'tee'], ['boy', 'jacket'], ['boy', 'wet'], ['aunt', 'coat']];
    const cw = W / 7;
    row1.forEach((of, i) => {
      const x = cw * i + cw / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(cw * i + 1, 0, cw - 2, 540); ctx.clip();
      PV.anime.bust(ctx, { who: 'senpai', outfit: of, x, y: 290, size: 150, yaw: i % 2 ? -0.3 : 0.3, T, expr: of === 'home' ? 'empty' : of === 'gown' ? 'sad' : 'neutral',
        hair: { style: of === 'dress' ? 'updo' : of === 'dress_cardigan' ? 'loose' : 'down' } });
      ctx.restore(); label(ctx, of, x, 528, '#3a404c', 19);
    });
    const cw2 = W / 6;
    row2.forEach(([who, of], i) => {
      const x = cw2 * i + cw2 / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(cw2 * i + 1, 541, cw2 - 2, 539); ctx.clip();
      PV.anime.bust(ctx, { who, outfit: of, x, y: 830, size: 155, yaw: i % 2 ? -0.3 : 0.3, T, light: of === 'wet' ? 'storm' : 'day', rimDir: -1.9, expr: of === 'wet' ? 'determined' : 'neutral' });
      ctx.restore(); label(ctx, (who === 'aunt' ? '叔母 ' : '彼 ') + of, x, 1068, '#3a404c', 19);
    });
  } });
  const PI = Math.PI, lerp = PV.lerp;
})();
(function () {
  const PV = window.PV;
  PV.shot('dev_anime_head_dbg', { draw(ctx, t, d, S, env) {
    ctx.fillStyle = '#eee'; ctx.fillRect(0, 0, PV.W, PV.H);
    const q = new URLSearchParams(location.search); const who = q.get('who') || 'boy';
    const v = q.get('lost') ? [{ back: true, yaw: -0.75 }, { back: true, yaw: -0.5 }, { back: true, yaw: 0.6 }] : [{ yaw: -1 }, { yaw: -0.5 }, { back: true }];
    v.forEach((vv, i) => { const o = Object.assign({ who, x: 330 + i * 620, y: 600, size: 380, T: 0 }, vv); PV.anime.head(ctx, Object.assign({ alpha: 0.5 }, o)); PV.anime._headDebug(ctx, o); });
  } });
})();
(function () { // perf probe: N heads of one kind
  const PV = window.PV;
  PV.shot('dev_anime_head_perf', { draw(ctx, t, d, S, env) {
    ctx.fillStyle = '#ddd'; ctx.fillRect(0, 0, PV.W, PV.H);
    const q = new URLSearchParams(location.search); const n = +(q.get('n') || 10), size = +(q.get('size') || 300), who = q.get('who') || 'senpai', light = q.get('light') || 'day';
    ctx.getImageData(0, 0, 1, 1); window.__rimMs = 0; window.__rimParts = []; window.__rimPre = []; const t0 = performance.now();
    for (let i = 0; i < n; i++) PV.anime.head(ctx, { who, x: 300 + (i % 5) * 330, y: 500 + Math.floor(i / 5) * 60, size, yaw: 0.3, T: env.T + i * 0.37, light, rimDir: -0.6, talk: true, neck: true, hair: { wind: 0.5 } });
    ctx.getImageData(0, 0, 1, 1); window.__headMs = (performance.now() - t0) / n; window.__rimPer = window.__rimMs / n;
    ctx.fillStyle = '#000'; ctx.font = '40px monospace'; ctx.fillText(`${who} size ${size} ${light}: ${window.__headMs.toFixed(2)} ms/head`, 40, 60);
  } });
})();
(function () { // dev zoom: big faces for eye / mouth design (senpai front + 3/4, boy front)
  const PV = window.PV;
  PV.shot('dev_anime_head_zoom', { draw(ctx, t, d, S, env) {
    ctx.fillStyle = '#f2f1ee'; ctx.fillRect(0, 0, PV.W, PV.H);
    const q = new URLSearchParams(location.search); const ex = q.get('expr') || 'neutral';
    PV.anime.head(ctx, { who: 'senpai', x: 360, y: 1150, size: 900, yaw: 0, T: env.T, expr: ex, neck: true });
    PV.anime.head(ctx, { who: 'senpai', x: 1000, y: 1150, size: 900, yaw: 0.45, T: env.T, expr: ex, neck: true });
    PV.anime.head(ctx, { who: 'boy', x: 1640, y: 1160, size: 900, yaw: -0.2, T: env.T, expr: ex, neck: true });
  } });
})();
(function () { // dev: strong wind in several views (C15 sea breeze, C20 run, C28 storm)
  const PV = window.PV;
  PV.shot('dev_anime_head_wind', { draw(ctx, t, d, S, env) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, PV.H, [[0, '#7fb6ea'], [1, '#d6ecfb']]); ctx.fillRect(0, 0, PV.W, PV.H);
    const views = [{ yaw: 0.3 }, { yaw: 1 }, { back: true, yaw: 0.4 }, { yaw: -0.6 }];
    views.forEach((v, i) => PV.anime.head(ctx, Object.assign({ who: 'senpai', x: 230 + i * 400, y: 330, size: 230, T: env.T, neck: true, neckLen: 0.5, light: 'summer', rimDir: -2.0,
      expr: 'smile', hair: { wind: 1.4, windDir: -0.15 } }, v)));
    PV.anime.head(ctx, { who: 'senpai', x: 1780, y: 330, size: 230, yaw: 0.6, T: env.T, neck: true, neckLen: 0.5, light: 'summer', expr: 'gentle', hat: true, hair: { wind: 1.0, windDir: 0 } });
    [{ yaw: 0.4 }, { yaw: -1 }, { back: true }].forEach((v, i) => PV.anime.head(ctx, Object.assign({ who: 'boy', x: 300 + i * 450, y: 850, size: 230, T: env.T, neck: true, neckLen: 0.5,
      light: 'storm', rimDir: -1.2, expr: 'determined', hair: { style: 'wet', wind: 1.2, windDir: 0.3 } }, v)));
    PV.anime.head(ctx, { who: 'senpai', x: 1560, y: 850, size: 230, yaw: -0.3, T: env.T, neck: true, neckLen: 0.5, light: 'storm', rimDir: -1.2, expr: 'shout', eyes: { tears: 1 }, talk: true, hair: { style: 'wet', wind: 0.9, windDir: 0.3 } });
  } });
})();
(function () { // 9: key story cuts with the presets they need (C05, C10, C17, C33, C39, C42)
  const PV = window.PV, W = PV.W, H = PV.H;
  const cell = (ctx, i, bg) => { const cw = W / 3, ch = H / 2, x0 = (i % 3) * cw, y0 = Math.floor(i / 3) * ch;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, cw, ch); ctx.clip(); ctx.fillStyle = PV.linGrad(ctx, 0, y0, 0, y0 + ch, [[0, bg[0]], [1, bg[1]]]); ctx.fillRect(x0, y0, cw, ch); return [x0, y0, cw, ch]; };
  const tag = (ctx, s, x, y, col) => { ctx.font = '22px sans-serif'; ctx.fillStyle = col; ctx.fillText(s, x + 16, y + 34); };
  PV.shot('dev_anime_head_9', { draw(ctx, t, d, S, env) {
    const T = env.T;
    let [x, y, w, h] = cell(ctx, 0, ['#fff4e0', '#cdb595']);   // C05: 3/4, welling, talking, window backlight
    PV.anime.bust(ctx, { who: 'senpai', outfit: 'uniform', x: x + w * 0.48, y: y + 330, size: 250, yaw: 0.45, T: 12.6 + (t % 3.5), talk: true, expr: 'teary', light: 'window', rimDir: -0.5, hair: { wind: 0.3, windDir: 3.0 } });
    ctx.restore(); tag(ctx, 'C05 teary + talk (V01), window', x, y, '#5a4a3a');
    [x, y, w, h] = cell(ctx, 1, ['#fff8ea', '#d9c09a']);       // C10: eyes closed, gentle smile, glowing hair
    PV.anime.bust(ctx, { who: 'senpai', outfit: 'uniform', x: x + w * 0.5, y: y + 320, size: 230, yaw: -0.55, pitch: -0.12, T, expr: 'closed', light: 'window', rimDir: -2.6, hair: { wind: 0.2, windDir: 3.1 } });
    ctx.restore(); tag(ctx, 'C10 closed, window rim', x, y, '#5a4a3a');
    [x, y, w, h] = cell(ctx, 2, ['#ffffff', '#e2e5ec']);       // C17: intense profile, a tear, updo, stage white
    PV.anime.bust(ctx, { who: 'senpai', outfit: 'dress', x: x + w * 0.42, y: y + 330, size: 260, yaw: 0.95, pitch: -0.08, T, expr: 'focus', eyes: { tears: 0.8 }, light: 'stage', rimDir: -1.2 });
    ctx.restore(); tag(ctx, 'C17 profile focus + tear, updo, stage', x, y, '#4a505c');
    [x, y, w, h] = cell(ctx, 3, ['#a3a3a6', '#77787d']);       // C33: empty eyes, flat
    PV.anime.bust(ctx, { who: 'senpai', outfit: 'home', x: x + w * 0.5, y: y + 300, size: 240, yaw: 0.15, T: 123.9 + (t % 4), talk: true, expr: 'empty', light: 'room_gray', rimDir: -2.0 });
    ctx.restore(); tag(ctx, 'C33 empty + flat talk (V12), room_gray', x, y, '#2f3036');
    [x, y, w, h] = cell(ctx, 4, ['#1c1a22', '#3b3036']);       // C39: him in profile in a dark room, crying
    PV.anime.bust(ctx, { who: 'boy', outfit: 'tee', x: x + w * 0.4, y: y + 330, size: 260, yaw: 0.9, pitch: -0.15, T: 154.3 + (t % 4), talk: true, expr: 'cry', eyes: { tears: 0.9 }, light: 'lamp', rimDir: -0.3 });
    ctx.restore(); tag(ctx, 'C39 cry + talk (V17), lamp', x, y, '#d8c8b8');
    [x, y, w, h] = cell(ctx, 5, ['#f2a35e', '#5d4060']);       // C42: from behind, she turns her head to him, smiling
    PV.anime.bust(ctx, { who: 'senpai', outfit: 'uniform', x: x + w * 0.42, y: y + 320, size: 240, back: true, yaw: -0.75, bodyYaw: 0, T, expr: 'smile', light: 'sunset', rimDir: -0.2, hair: { wind: 0.5, windDir: 3.0 } });
    ctx.restore(); tag(ctx, 'C42 back view, head turned (lost profile), sunset', x, y, '#3a2a2a');
  } });
})();

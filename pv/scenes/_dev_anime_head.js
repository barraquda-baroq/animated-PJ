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
      PV.anime.bust(ctx, { who: 'senpai', outfit: 'uniform', x: x0 + cw * 0.27, y: y0 + 300, size: 150, yaw: 0.35, T, light: L, rimDir: rd, expr: 'neutral' });
      PV.anime.bust(ctx, { who: 'boy', outfit: 'uniform', x: x0 + cw * 0.74, y: y0 + 305, size: 156, yaw: -0.35, T, light: L, rimDir: rd, expr: 'neutral' });
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
    const rim = q.get('rim') != null ? +q.get('rim') : 1;
    for (let i = 0; i < n; i++) PV.anime.head(ctx, { who, x: 300 + (i % 5) * 330, y: 500 + Math.floor(i / 5) * 60, size, yaw: 0.3, T: env.T + i * 0.37, light, rimDir: -0.6, rim, talk: true, neck: true, hair: { wind: 0.5 } });
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
(function () { // model sheet: front / 3/4 / strong 3/4 / profile for one character at 300-340 px (?who=senpai|boy|aunt&expr=)
  const PV = window.PV, W = PV.W, H = PV.H;
  PV.shot('dev_anime_head_model', { draw(ctx, t, d, S, env) {
    const q = new URLSearchParams(location.search); const who = q.get('who') || 'senpai', ex = q.get('expr') || 'neutral', light = q.get('light') || 'day';
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#f4f3f0'], [1, '#e4e2dd']]); ctx.fillRect(0, 0, W, H);
    const yaws = [0, 0.3, 0.55, 1.0], size = who === 'boy' ? 330 : 320;
    yaws.forEach((yaw, i) => {
      const cw = W / 4, x0 = i * cw;
      ctx.save(); ctx.beginPath(); ctx.rect(x0 + 1, 0, cw - 2, H); ctx.clip();
      PV.anime.head(ctx, { who, x: x0 + cw * 0.5 - yaw * 40, y: 560, size, yaw, T: env.T, expr: ex, neck: true, light, rimDir: -2.3, noBlink: true });
      ctx.restore();
      ctx.font = '22px sans-serif'; ctx.fillStyle = '#5a6170'; ctx.textAlign = 'center'; ctx.fillText(who + '  yaw ' + yaw, x0 + cw / 2, 1050);
    });
  } });
})();
(function () { // profiles at 520 px: 先輩 down / 先輩 updo (C17) / 彼 (C39)  (?expr=)
  const PV = window.PV, W = PV.W, H = PV.H;
  PV.shot('dev_anime_head_profile', { draw(ctx, t, d, S, env) {
    const q = new URLSearchParams(location.search); const ex = q.get('expr') || 'neutral';
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#f4f3f0'], [1, '#e4e2dd']]); ctx.fillRect(0, 0, W, H);
    [['senpai', {}], ['senpai', { style: 'updo' }], ['boy', {}]].forEach(([who, hair], i) => {
      ctx.save(); ctx.beginPath(); ctx.rect(i * 640 + 1, 0, 638, H); ctx.clip();
      PV.anime.head(ctx, { who, x: i * 640 + 300, y: 760, size: 520, yaw: 1, T: env.T, expr: ex, neck: true, hair, noBlink: true, rimDir: -2.3 });
      ctx.restore();
    });
  } });
})();
(function () { // cuts: key story cuts on one sheet with the presets they need (C05, C10, C17, C33, C39, C42) — was dev_anime_head_9
  const PV = window.PV, W = PV.W, H = PV.H;
  const cell = (ctx, i, bg) => { const cw = W / 3, ch = H / 2, x0 = (i % 3) * cw, y0 = Math.floor(i / 3) * ch;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, cw, ch); ctx.clip(); ctx.fillStyle = PV.linGrad(ctx, 0, y0, 0, y0 + ch, [[0, bg[0]], [1, bg[1]]]); ctx.fillRect(x0, y0, cw, ch); return [x0, y0, cw, ch]; };
  const tag = (ctx, s, x, y, col) => { ctx.font = '22px sans-serif'; ctx.fillStyle = col; ctx.fillText(s, x + 16, y + 34); };
  PV.shot('dev_anime_head_cuts', { draw(ctx, t, d, S, env) {
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
(function () { // 9: the real close-up moments of the trailer, one after another at full size, with their light and the film's own clock
  // C05 (12.5–16.4) 先輩 3/4, eyes welling, V01 "ねえ……どうして今日は拍手をくれたの", window backlight, him blurred by the window
  // C06 (16.4–19.9) 彼 3/4 bust, backlit by the curtained window, deadpan -> easy half-smile, V02
  // C16 (49.5–53.0) the white world: navy dress, low chignon, blank unfocused stare -> his cough at 51.4: head turns a little, the light returns
  // C28 (98.5–103.5) the storm bridge: she turns, wet hair stuck to the cheeks, tears streaming, shouting V08 (99.0), lightning at 102.7
  // C39 (154.0–161.0) 彼 in profile in the dark lamp-lit room, window light behind, crying, V17 (154.3)
  // C42 (167.0–170.0) sunset, golden backlight: she turns her head to him and smiles (silent "ねえ" at 167.7)
  // Reel time t runs through the cuts back to back (25.9 s); T = the film's global time inside the cut (lip-sync, blinks, tears).
  // ?cut=C28 plays only that cut from its start. Post (bloom / grain / vignette) = the film's defaults, judged as in the final picture.
  const PV = window.PV, W = PV.W, H = PV.H, L = PV.lib, PI = Math.PI;
  const lerp = PV.lerp, clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), ss = PV.smooth, tw = (T) => PV.anime.onTwos(T);
  function subtitle(ctx, txt, a = 1, col = '#f6f2ea', size = 44) {
    if (!txt || a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = `500 ${size}px Shippori, serif`; try { ctx.letterSpacing = (size * 0.08).toFixed(1) + 'px'; } catch (e) { /* older canvas */ }
    ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 14; ctx.fillStyle = col; ctx.fillText(txt, W / 2, H - 64 - 12);
    ctx.shadowBlur = 3; ctx.shadowOffsetY = 2; ctx.fillText(txt, W / 2, H - 64 - 12); ctx.restore();
  }
  function tag(ctx, s, T) { ctx.save(); ctx.font = '20px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4; ctx.fillText(s + '  T=' + T.toFixed(2), 24, 34); ctx.restore(); }
  // a soft out-of-focus copy of a drawing (background people): drawn at half resolution, blurred
  function bokehDraw(ctx, px, fn) {
    const B = PV.buffer('reelBokeh', W / 2, H / 2), b = B.ctx; b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W / 2, H / 2); b.setTransform(0.5, 0, 0, 0.5, 0, 0);
    fn(b); ctx.save(); ctx.filter = `blur(${px}px)`; ctx.drawImage(B.canvas, 0, 0, W / 2, H / 2, 0, 0, W, H); ctx.restore();
  }

  /* ---- C05: music room, afternoon, the window behind him (right) */
  function C05(ctx, T, tau) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, W, 0, [[0, '#6f5c4c'], [0.4, '#a88d70'], [0.62, '#e9d8bd'], [1, '#fbf1df']]); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PV.linGrad(ctx, 0, 70, 0, 820, [[0, '#fffdf7'], [0.55, '#fff6e6'], [1, '#ffe8c6']]); ctx.fillRect(1040, 70, 900, 760);   // window
    ctx.fillStyle = 'rgba(205,226,246,0.55)'; ctx.fillRect(1100, 110, 780, 300);                                                          // sky through the glass
    ctx.save(); ctx.filter = 'blur(10px)'; ctx.fillStyle = 'rgba(120,98,78,0.55)'; for (const x of [1040, 1480, 1920]) ctx.fillRect(x - 16, 60, 32, 780); ctx.fillRect(1030, 420, 900, 22); ctx.restore();
    ctx.fillStyle = PV.linGrad(ctx, 0, 820, 0, H, [[0, '#b39272'], [1, '#6e5644']]); ctx.fillRect(0, 820, W, H - 820);                  // floor
    L.glow(ctx, 1500, 360, 1000, '#fff3dc', 0.75);
    bokehDraw(ctx, 6, (b) => PV.anime.bust(b, { who: 'boy', outfit: 'uniform', x: 1500, y: 540, size: 118, yaw: -0.28, T, light: 'window', rimDir: -0.5, expr: 'neutral', seed: 9 }));
    L.dust(ctx, T, { count: 50, x0: 980, x1: 1920, y0: 40, y1: 900, size: 3, alpha: 0.55, seed: 7 });
    // her: 3/4 from her right (the parting side), looking up a little toward him, a small head tilt on "ねえ……"
    const tilt = -0.035 - 0.03 * ss(12.7, 13.4, T), tears = 0.36 + 0.2 * ss(12.6, 15.6, T);
    PV.anime.bust(ctx, { who: 'senpai', outfit: 'uniform', x: 820, y: 880, size: 560, yaw: 0.4, pitch: 0.05, roll: tilt, T, talk: true, expr: 'teary',
      eyes: { tears, look: [0.42, -0.22] }, light: 'window', rimDir: -0.42, lightDir: -0.3, shade: 0.12, hair: { wind: 0.25, windDir: PI * 0.97 } });
    subtitle(ctx, T >= 12.65 && T < 16.47 ? 'ねえ……どうして今日は拍手をくれたの' : '');
  }
  /* ---- C06: him, bust 3/4 from his left, backlit by the curtained window */
  function C06(ctx, T, tau) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, W, 0, [[0, '#4d4038'], [0.3, '#6b5a4c'], [0.48, '#d9cbb4'], [0.6, '#fbf4e6'], [1, '#fffdf8']]); ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 26; k++) { const x = 900 + k * 40 + 10 * Math.sin(k * 1.7 + tw(T) * 0.8); ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.12 * (0.5 + 0.5 * Math.sin(k * 2.3))})`; ctx.fillRect(x, 0, 22 + 10 * Math.sin(k), H); }
    L.glow(ctx, 1400, 300, 1100, '#fff7e6', 0.85);
    ctx.fillStyle = PV.linGrad(ctx, 0, 860, 0, H, [[0, 'rgba(90,72,58,0)'], [1, 'rgba(90,72,58,0.5)']]); ctx.fillRect(0, 860, W, H - 860);
    // deadpan (え？) -> the easy half-smile while he talks
    const k = ss(17.0, 17.6, T);
    PV.anime.bust(ctx, { who: 'boy', outfit: 'uniform', x: 900, y: 700, size: 430, yaw: -0.38, pitch: 0.02, roll: 0.02 * k, T, talk: true, expr: k > 0.5 ? 'gentle' : 'neutral',
      eyes: { look: [-0.2 + 0.1 * k, 0.02], open: lerp(1, 0.86, k) }, mouth: { asym: -0.7 * k }, light: 'window', rimDir: -0.35, lightDir: -0.25, shade: 0.08, hair: { wind: 0.15, windDir: PI } });
    subtitle(ctx, T >= 16.55 && T < 20.05 ? 'え？　だって、今のはミスなかったじゃん' : '');
  }
  /* ---- C16: the white world, blank stare -> his cough (51.4) */
  function C16(ctx, T, tau) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#ffffff'], [0.65, '#f3f4f7'], [1, '#e2e5ec']]); ctx.fillRect(0, 0, W, H);
    L.bokeh(ctx, T, { count: 12, colors: ['#ffffff', '#eef2ff'], rmin: 40, rmax: 110, alpha: 0.35, seed: 4, mode: 'source-over' });
    const back = ss(51.4, 51.9, T), breath = 0.012 * Math.sin(tw(T) * 2 * PI * 1.6) * (1 - back);
    PV.anime.bust(ctx, { who: 'senpai', outfit: 'dress', x: 960, y: 690 + breath * 400, size: 440, yaw: lerp(0.22, -0.05, back), pitch: lerp(-0.02, 0.02, back), T,
      expr: 'neutral', eyes: { shine: lerp(0.22, 1, back), dull: lerp(0.38, 0, back), hlK: lerp(0.8, 1.15, back), look: [lerp(0.42, -0.3, back), lerp(0.14, 0, back)], open: lerp(0.88, 1.05, back) }, mouth: { shape: 'flat', open: back > 0.5 ? 0 : 0.07 },
      blush: lerp(0.06, 0.32, ss(51.6, 52.4, T)), light: 'stage', rimDir: -1.4, hair: { style: 'updo' } });
  }
  /* ---- C28: the storm bridge: she turns, shouts; lightning at 102.7 */
  function C28(ctx, T, tau) {
    const fl = Math.max(0, 1 - Math.abs(T - 102.72) / 0.05) * 1 + (T > 102.7 && T < 102.95 ? 0.55 * (0.5 + 0.5 * Math.sin((T - 102.7) * 90)) : 0);
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#0b1020'], [0.55, '#18213a'], [1, '#0f1424']]); ctx.fillRect(0, 0, W, H);
    L.stormClouds(ctx, T, { y: -60, h: 700, speed: 16, flash: clamp(fl), flashX: 1450, flashY: 160, seed: 3 });
    ctx.fillStyle = 'rgba(20,26,44,0.9)'; ctx.fillRect(0, 860, W, 18); for (let x = 30; x < W; x += 120) ctx.fillRect(x, 860, 10, 220);   // railing
    const turn = ss(98.5, 99.05, T), light = fl > 0.4 ? 'lightning' : 'storm';
    PV.anime.bust(ctx, { who: 'senpai', outfit: 'gown', x: 930, y: 730, size: 480, yaw: lerp(0.85, 0.28, turn), pitch: lerp(-0.05, 0.03, turn), roll: lerp(0.04, -0.03, turn), T,
      talk: T > 98.95, expr: turn > 0.6 ? 'shout' : 'cry', eyes: { tears: 1 }, light, rimDir: -2.2, lightDir: -2.3, shade: 0.11, hair: { style: 'wet', wind: 0.8 + 0.4 * (1 - turn), windDir: 0.25 } });
    L.rain(ctx, T, { count: 520, angle: 0.24, alpha: 0.34, len: 120, seed: 9, speed: 2400 });
    if (fl > 0.02) { ctx.fillStyle = `rgba(235,242,255,${0.8 * clamp(fl)})`; ctx.fillRect(0, 0, W, H); }
    subtitle(ctx, T >= 99.05 && T < 103.3 ? 'この気持ちが……分からないわよ！　貴方には！' : '');
  }
  /* ---- C39: dark room, lamp on the right, the window light behind him; profile, crying, V17 */
  function C39(ctx, T, tau) {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, W, 0, [[0, '#1d2234'], [0.45, '#1a1820'], [1, '#2a2026']]); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PV.linGrad(ctx, 0, 80, 0, 760, [[0, '#2a3552'], [1, '#3b4466']]); ctx.fillRect(70, 80, 620, 680);                       // window (night)
    L.bokeh(ctx, T, { x0: 90, x1: 680, y0: 360, y1: 740, colors: ['#ffd59a', '#a9bdff', '#ffe9c0'], rmin: 6, rmax: 22, count: 40, alpha: 0.6, seed: 12 });
    ctx.fillStyle = '#121016'; ctx.fillRect(366, 70, 16, 700); ctx.fillRect(60, 410, 640, 14);
    L.glow(ctx, 420, 260, 520, '#cfd9ff', 0.32);
    L.glow(ctx, 1760, 760, 760, '#ffb46a', 0.42);
    // the lamp is the key (warm, front-right, low); the window is the rim (behind him, upper left)
    // the voice breaks on "……" (155.0, 158.4–159.4): the lips quiver
    const brk = Math.max(PV.window(T, 154.8, 155.0, 155.5, 155.7), PV.window(T, 158.3, 158.5, 159.3, 159.5));
    PV.anime.bust(ctx, { who: 'boy', outfit: 'tee', x: 940, y: 800, size: 540, yaw: 0.9, pitch: -0.2, T, talk: true, expr: 'cry', eyes: { tears: 0.85 }, mouth: { tremble: 0.35 + 0.65 * brk },
      light: 'lamp', rimDir: 0.1, rim: 1.2, lightDir: -2.6, faceLift: 0.4, shade: 0.5, hair: { wind: 0.05 } });
    subtitle(ctx, T >= 154.35 && T < 161.15 ? 'そんなの……先輩との、演奏が、楽しかったからに……決まってるだろ' : '');
  }
  /* ---- C42: sunset, golden backlight; both seated, she (screen-right) turns to him and smiles */
  function C42(ctx, T, tau) {
    L.sunset(ctx, T, { horizon: 720, sunX: 1160, sunY: 610 });
    ctx.fillStyle = PV.linGrad(ctx, 0, 820, 0, H, [[0, '#4a3134'], [1, '#2a1c22']]); ctx.fillRect(0, 820, W, H - 820);                    // grass bank
    const turn = ss(167.45, 167.95, T), lagT = ss(167.45, 167.95, T - 2.5 / 24), lag = turn - lagT;                                           // hair 2-3 drawings late
    PV.anime.bust(ctx, { who: 'boy', outfit: 'uniform', x: 470, y: 760, size: 400, yaw: 0.22, pitch: 0.02, T, expr: 'neutral', eyes: { look: [0.5, 0] }, light: 'sunset', rimDir: -0.3, lightDir: -0.15, shade: 0.64, rimW: 2, faceLift: 0.4 });
    PV.anime.bust(ctx, { who: 'senpai', outfit: 'summer', hat: false, x: 1270, y: 770, size: 380, yaw: lerp(0.18, -0.48, turn), pitch: 0.03, roll: lerp(0, 0.05, turn), T,
      expr: turn > 0.5 ? 'gentle' : 'neutral', eyes: { look: [lerp(0.15, -0.55, turn), 0], smile: 0.45 * ss(167.8, 168.3, T), open: lerp(1, 0.86, ss(167.8, 168.3, T)) },
      mouth: { shape: 'smile', open: 0.12 * ss(167.9, 168.4, T) }, blush: 0.2 + 0.25 * turn, light: 'sunset', rimDir: -2.85, lightDir: -2.98, shade: 0.64, rimW: 2, faceLift: 0.4,
      hair: { wind: 0.25 + 1.6 * Math.abs(lag), windDir: 0.1 } });
    subtitle(ctx, T >= 167.7 && T < 169.4 ? 'ねえ' : '', clamp((T - 167.7) / 0.18) * clamp((169.4 - T) / 0.3), '#f1e3c2');
  }
  const CUTS = [['C05', 12.5, 16.4, C05], ['C06', 16.4, 19.9, C06], ['C16', 49.5, 53.0, C16], ['C28', 98.5, 103.5, C28], ['C39', 154.0, 161.0, C39], ['C42', 167.0, 170.0, C42]];
  PV.dev9cuts = CUTS.map(([id, a, b], i) => ({ id, t0: a, t1: b, reel0: CUTS.slice(0, i).reduce((s, c) => s + c[2] - c[1], 0) }));
  PV.shot('dev_anime_head_9', { draw(ctx, t, d, S, env) {
    const q = new URLSearchParams(location.search), only = q.get('cut');
    let cut = null, T = 0;
    if (only) { cut = CUTS.find(c => c[0] === only) || CUTS[0]; T = cut[1] + t; }
    else { let acc = 0; for (const c of CUTS) { const len = c[2] - c[1]; if (t < acc + len || c === CUTS[CUTS.length - 1]) { cut = c; T = c[1] + (t - acc); break; } acc += len; } }
    T = Math.round(T * 24) / 24;                     // the film's frame grid
    ctx.save(); cut[3](ctx, T, T - cut[1]); ctx.restore();
    tag(ctx, cut[0], T);
  } });
})();
(function () { // raw variants (no bloom / grain / vignette) of the head sheets, for checking the drawn colours: dev_anime_head_<id>_raw
  const PV = window.PV;
  for (const id of Object.keys(PV.shots).filter(k => k.startsWith('dev_anime_head_') && !k.endsWith('_raw'))) {
    const base = PV.shots[id];
    PV.shot(id + '_raw', { draw(ctx, t, d, S, env) { S.post = { bloom: 0, halation: 0, grain: 0, vignette: 0 }; return base.draw(ctx, t, d, S, env); } });
  }
})();

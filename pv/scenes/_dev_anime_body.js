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
      label(ctx, x, 1060, name);
    });
    label(ctx, W / 2, 30, title);
  }
  PV.shot('dev_anime_body_1', { draw(ctx, t) { sheet(ctx, t, 'senpai', 'uniform', 134, '先輩 — uniform (白ブラウス・赤リボン・紺プリーツ)'); } });
  PV.shot('dev_anime_body_2', { draw(ctx, t) { sheet(ctx, t, 'boy', 'uniform', 128, '彼 — uniform (白シャツ袖まくり・緩めたネクタイ)'); } });

  /* ---------- 3/4: every outfit (3/4 front, one row each) */
  function row(ctx, t, list, sc, gy) {
    list.forEach(([who, outfit, f, name], i) => {
      const x = 170 + i * (1580 / Math.max(1, list.length - 1));
      A().figure(ctx, { who, outfit, pose: 'stand', facing: f, x, y: gy, scale: sc, T: t, light: 'day', params: { weight: i % 2 ? -0.4 : 0.4 } });
      label(ctx, x, gy + 32, name);
    });
  }
  PV.shot('dev_anime_body_3', { draw(ctx, t) {
    paper(ctx); ground(ctx, 1010);
    row(ctx, t, [['senpai', 'blazer', '3q_right', 'blazer'], ['senpai', 'dress', '3q_left', 'dress'], ['senpai', 'dress_cardigan', 'front', 'dress+cardigan'],
      ['senpai', 'summer', '3q_right', 'summer'], ['senpai', 'gown', 'front', 'gown + cast'], ['senpai', 'home', '3q_left', 'home']], 130, 1010);
    label(ctx, W / 2, 30, '先輩 — outfits');
  } });
  PV.shot('dev_anime_body_4', { draw(ctx, t) {
    paper(ctx); ground(ctx, 1010);
    row(ctx, t, [['boy', 'blazer', '3q_right', 'blazer'], ['boy', 'tee', 'front', 'tee + open shirt'], ['boy', 'jacket', '3q_left', 'leather jacket'],
      ['boy', 'wet', 'front', 'wet shirt'], ['aunt', 'coat', '3q_right', '叔母 coat']], 124, 1010);
    label(ctx, W / 2, 30, '彼 / 叔母 — outfits');
  } });

  /* ---------- 11-14: every outfit from the front / side / back */
  function outfitViews(ctx, t, list, sc) {
    paper(ctx); const gy = 1030; ground(ctx, gy);
    list.forEach(([who, outfit], j) => {
      ['front', 'right', 'back'].forEach((f, i) => {
        const x = 130 + j * 640 + i * 190;
        A().figure(ctx, { who, outfit, pose: 'stand', facing: f, x, y: gy, scale: sc * (who === 'boy' ? 0.97 : 1), T: t, light: 'day', params: { weight: 0.35 } });
      });
      label(ctx, 320 + j * 640, 1066, (who === 'senpai' ? '先輩' : who === 'boy' ? '彼' : '叔母') + ' — ' + outfit + '  (front / side / back)');
    });
  }
  PV.shot('dev_anime_body_11', { draw(ctx, t) { outfitViews(ctx, t, [['senpai', 'blazer'], ['senpai', 'dress'], ['senpai', 'dress_cardigan']], 128); } });
  PV.shot('dev_anime_body_12', { draw(ctx, t) { outfitViews(ctx, t, [['senpai', 'summer'], ['senpai', 'gown'], ['senpai', 'home']], 128); } });
  PV.shot('dev_anime_body_13', { draw(ctx, t) { outfitViews(ctx, t, [['boy', 'blazer'], ['boy', 'tee'], ['boy', 'jacket']], 126); } });
  PV.shot('dev_anime_body_15', { draw(ctx, t) { outfitViews(ctx, t, [['senpai', 'ending'], ['senpai', 'spring2'], ['boy', 'ending']], 126); } });
  PV.shot('dev_anime_body_14', { draw(ctx, t) { outfitViews(ctx, t, [['boy', 'wet'], ['aunt', 'coat'], ['boy', 'uniform']], 126); } });

  /* ---------- scene backdrops (simple gradients matching the shots) */
  const BACK = {
    window: (ctx) => { ctx.fillStyle = PV.linGrad(ctx, 0, 0, W, 0, [[0, '#6f5a4c'], [0.45, '#d9c3a8'], [0.75, '#fff6e6'], [1, '#fffaf2']]); ctx.fillRect(0, 0, W, H); ctx.fillStyle = PV.radGrad(ctx, 1650, 380, 50, 1100, [[0, '#ffffff', 0.85], [1, '#fff3dc', 0]]); ctx.fillRect(0, 0, W, H); ctx.fillStyle = 'rgba(120,90,60,0.25)'; ctx.fillRect(0, 900, W, 180); },
    stage: (ctx) => { ctx.fillStyle = PV.radGrad(ctx, W / 2, 420, 50, 1300, [[0, '#ffffff'], [1, '#d9dce4']]); ctx.fillRect(0, 0, W, H); },
    night: (ctx) => { ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#0d1430'], [0.6, '#232a55'], [1, '#141a33']]); ctx.fillRect(0, 0, W, H); for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,${200 + (i * 37) % 50},150,${0.25 + (i % 5) * 0.08})`; ctx.beginPath(); ctx.arc((i * 211) % W, 640 + (i * 53) % 90, 6 + (i % 4) * 5, 0, 2 * PI); ctx.fill(); } },
    storm: (ctx) => { ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#1b2236'], [1, '#2c3550']]); ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(200,215,240,0.25)'; ctx.lineWidth = 1.5; for (let i = 0; i < 160; i++) { const x = (i * 97) % W, y = (i * 131) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 40); ctx.stroke(); } },
    sunset: (ctx) => { ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#7a5a8c'], [0.45, '#f0a070'], [0.62, '#ffd58a'], [0.63, '#c98f62'], [1, '#4a3a3a']]); ctx.fillRect(0, 0, W, H); ctx.fillStyle = PV.radGrad(ctx, 1500, 640, 20, 600, [[0, '#fff4d0', 0.95], [1, '#ffb070', 0]]); ctx.fillRect(0, 0, W, H); },
    gray: (ctx) => { ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#8a8b90'], [1, '#5e5f66']]); ctx.fillRect(0, 0, W, H); ctx.fillStyle = 'rgba(235,235,240,0.35)'; ctx.fillRect(1200, 120, 520, 600); },
    summer: (ctx) => { ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, '#4a92e8'], [0.55, '#bfe0fb'], [0.56, '#3f8fd6'], [1, '#2a6fb5']]); ctx.fillRect(0, 0, W, H); },
    spot: (ctx) => { ctx.fillStyle = '#120e18'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = PV.radGrad(ctx, W / 2, 250, 30, 900, [[0, '#ffe6bd', 0.55], [1, '#ffe6bd', 0]]); ctx.fillRect(0, 0, W, H); },
  };

  /* ---------- 5: a) piano — the face-visible views of the revised plan: front-3/4 from her right (C02/C04/C10), right profile
     (C17, dress), front through the piano (C08), and the old 3/4 back for comparison. camPitch = the camera slightly above */
  PV.shot('dev_anime_body_5', { draw(ctx, t) {
    BACK.window(ctx);
    const K = { keysLeft: 1.7, keysRight: 1.7 };
    A().figure(ctx, { who: 'senpai', outfit: 'uniform', pose: 'piano', facing: 1.05, camPitch: 0.3, x: 330, y: 700, scale: 112, T: t, light: 'window', rimDir: -0.5, params: Object.assign({ intensity: 0.9 }, K), head: { expr: 'focus', brows: { furrow: 0.6 } } });
    A().figure(ctx, { who: 'senpai', outfit: 'dress', pose: 'piano', facing: 'right', camPitch: 0.08, x: 790, y: 700, scale: 112, T: t, light: 'stage', params: Object.assign({ intensity: 0.6 }, K), head: { expr: 'focus' } });
    A().figure(ctx, { who: 'senpai', outfit: 'uniform', pose: 'piano', facing: 'front', camPitch: 0.4, x: 1260, y: 700, scale: 112, T: t, light: 'window', rimDir: -0.5, params: Object.assign({ intensity: 0.35, look: 'keys' }, K), head: { expr: 'closed' } });
    A().figure(ctx, { who: 'senpai', outfit: 'uniform', pose: 'piano', facing: '3q_back_right', camPitch: 0.15, x: 1690, y: 700, scale: 100, T: t, light: 'window', rimDir: -0.4, params: Object.assign({ intensity: 0.3 }, K) });
    label(ctx, 330, 1060, '3/4 from the treble end (C02/C10)'); label(ctx, 790, 1060, 'right profile, dress (C17)'); label(ctx, 1260, 1060, 'front, camera above (C10)'); label(ctx, 1690, 1060, '3/4 back');
  } });
  /* ---------- 6: b) seated chair — 彼: juice (sip), clap, acoustic guitar */
  PV.shot('dev_anime_body_6', { draw(ctx, t) {
    BACK.window(ctx);
    A().figure(ctx, { who: 'boy', outfit: 'uniform', pose: 'seated_chair', facing: '3q_left', x: 360, y: 640, scale: 112, T: t, light: 'window', rimDir: -0.4, params: { variant: 'juice', sip: 0.5 + 0.5 * Math.sin(A().onTwos(t) * 1.2) }, head: { expr: 'neutral' } });
    A().figure(ctx, { who: 'boy', outfit: 'uniform', pose: 'seated_chair', facing: 'front', x: 960, y: 640, scale: 112, T: t, light: 'day', params: { variant: 'clap', claps: [0.6, 1.1, 1.6, 2.6, 3.1, 4.0, 4.5] }, head: { expr: 'smile' } });
    A().figure(ctx, { who: 'boy', outfit: 'uniform', pose: 'seated_chair', facing: '3q_left', x: 1560, y: 640, scale: 112, T: t, light: 'window', rimDir: -0.4, params: { variant: 'guitar' }, head: { expr: 'cry' } });
    label(ctx, 360, 1060, 'chair: juice'); label(ctx, 960, 1060, 'chair: clap'); label(ctx, 1560, 1060, 'chair: guitar');
  } });
  /* ---------- 7: c/h) stage: Strat standing (front), kneeling raise, kneeling down; the aunt looking back */
  PV.shot('dev_anime_body_7', { draw(ctx, t) {
    BACK.spot(ctx);
    A().figure(ctx, { who: 'boy', outfit: 'uniform', pose: 'stand', facing: '3q_left', x: 330, y: 1010, scale: 118, T: t, light: 'spot', rimDir: -1.6, params: { arms: 'strat', weight: 0.3 } });
    A().figure(ctx, { who: 'boy', outfit: 'uniform', pose: 'kneel_guitar', facing: '3q_left', x: 900, y: 1010, scale: 118, T: t, light: 'spot', rimDir: -1.6, params: { variant: 'raise' } });
    A().figure(ctx, { who: 'boy', outfit: 'uniform', pose: 'kneel_guitar', facing: 'right', x: 1350, y: 1010, scale: 118, T: t, light: 'spot', rimDir: -1.6, params: { variant: 'down' } });
    // C36: the aunt walks away toward the doorway light and glances back over her shoulder (face readable)
    A().figure(ctx, { who: 'aunt', outfit: 'coat', pose: 'walk', facing: -2.55, x: 1720, y: 1010, scale: 112, T: t, light: 'window', rimDir: -0.6, params: { neckYaw: 1.2, twist: 0.35 }, head: { expr: 'neutral', eyes: { open: 0.8, look: [-0.3, 0.1] } } });
    label(ctx, 330, 1060, 'stand + Strat'); label(ctx, 900, 1060, 'kneel: raise'); label(ctx, 1350, 1060, 'kneel: head down'); label(ctx, 1720, 1060, '叔母 walking, glancing back (C36)');
  } });
  /* ---------- 8: e/f) railing (summer lean + hat, storm hold + cast) and the run */
  PV.shot('dev_anime_body_8', { draw(ctx, t) {
    BACK.summer(ctx);
    // C15: at the railing seen from the side / front-oblique — her smiling profile under the hat brim, hair in the wind
    A().figure(ctx, { who: 'senpai', outfit: 'summer', pose: 'railing', facing: 'right', camPitch: 0.05, x: 300, y: 1010, scale: 112, T: t, light: 'summer', wind: 1.0, windDir: 3.0, params: { variant: 'lean', railing: true, railZ: 0.8 }, head: { expr: 'smile' } });
    A().figure(ctx, { who: 'senpai', outfit: 'summer', pose: 'railing', facing: 0.95, camPitch: 0.05, x: 740, y: 1010, scale: 112, T: t, light: 'summer', wind: 1.2, windDir: 3.0, params: { variant: 'hat', railing: true }, head: { expr: 'smile', eyes: { open: 0.75 } } });
    ctx.save(); ctx.beginPath(); ctx.rect(1000, 0, 920, H); ctx.clip(); BACK.storm(ctx); ctx.restore();
    // C27: the storm railing (cast + sling, wet hair) from the front-oblique so the face reads
    A().figure(ctx, { who: 'senpai', outfit: 'gown', pose: 'railing', facing: 'right', x: 1180, y: 1010, scale: 112, T: t, light: 'storm', wet: 1, params: { variant: 'hold', railing: true, railMat: 'steel', turn: -0.5 }, head: { expr: 'cry', hair: { style: 'wet' } } });
    // C20: running TOWARD the camera, smiling, half-fallen chignon, heels
    A().figure(ctx, { who: 'senpai', outfit: 'dress_cardigan', pose: 'run', facing: -0.25, camPitch: -0.04, x: 1650, y: 1010, scale: 112, T: t, light: 'night', rimDir: -2.6, params: { stride: 0.75 }, head: { expr: 'smile' } });
    label(ctx, 300, 1060, 'railing side (C15)'); label(ctx, 740, 1060, 'railing hat, front-oblique'); label(ctx, 1180, 1060, 'storm: hold + cast (C27)'); label(ctx, 1650, 1060, 'run toward camera (C20)');
  } });
  /* ---------- 9: d) sitting side by side, front-oblique (C42 sunset grass / C22 night lean / C33 grey sofa with a gap) */
  PV.shot('dev_anime_body_9', { draw(ctx, t) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 640, H); ctx.clip(); BACK.sunset(ctx); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(640, 0, 640, H); ctx.clip(); BACK.night(ctx); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(1280, 0, 640, H); ctx.clip(); BACK.gray(ctx); ctx.restore();
    const F = -0.42, CP = 0.2;   // the same camera for C22 / C33 / C42 (front-oblique, a little above)
    A().pair(ctx, { pose: 'sit_side', x: 330, y: 820, scale: 100, T: t, light: 'sunset', rimDir: -0.3, facing: F, camPitch: CP, params: { side: 'left', look: PV.smooth(1, 2.5, A().onTwos(t)) }, senpai: { outfit: 'summer', noHat: true, head: { expr: 'gentle' } }, boy: { outfit: 'uniform' } });
    A().pair(ctx, { pose: 'sit_side', x: 960, y: 820, scale: 100, T: t, light: 'night', rimDir: -2.6, facing: F, camPitch: CP, params: { side: 'left', lean: PV.smooth(1, 3, A().onTwos(t)) }, senpai: { outfit: 'dress_cardigan', head: { expr: 'closed' } }, boy: { outfit: 'uniform' } });
    A().pair(ctx, { pose: 'sit_side', x: 1600, y: 560, scale: 62, T: t, light: 'room_gray', facing: F, camPitch: CP, params: { side: 'right', gap: 1.0, seat: 'sofa' }, senpai: { outfit: 'home', head: { expr: 'empty' } }, boy: { outfit: 'tee' } });
    // C35: asleep on his shoulder under a blanket (same sofa, same camera)
    A().pair(ctx, { pose: 'sit_side', x: 1600, y: 960, scale: 62, T: t, light: 'room_gray', facing: 0.5, camPitch: CP, params: { side: 'right', gap: 0, seat: 'sofa', lean: 1, blanket: true }, senpai: { outfit: 'home', head: { expr: 'sleep' } }, boy: { outfit: 'tee', head: { expr: 'sad' } } });
    label(ctx, 330, 1060, 'C42 grass, she turns to him'); label(ctx, 960, 1060, 'C22 head on his shoulder'); label(ctx, 1600, 1060, 'C33 sofa gap / C35 blanket');
  } });
  /* ---------- 10: g/f/i) embrace in the rain, the leap, collapsed on the wet ground */
  PV.shot('dev_anime_body_10', { draw(ctx, t) {
    BACK.storm(ctx);
    const q = PV.devQuery || {};
    const f1 = q.f1 !== undefined ? +q.f1 : -0.75, f2 = q.f2 !== undefined ? +q.f2 : -0.45;
    A().pair(ctx, { pose: 'embrace', x: 280, y: 1000, scale: 104, T: t, light: 'storm', rimDir: -2.2, facing: f1, camPitch: 0.06, params: { progress: 1 }, senpai: { outfit: 'gown', wet: 1, head: { expr: 'surprise', hair: { style: 'wet' } } }, boy: { outfit: 'wet', head: { expr: 'determined' } } });
    A().pair(ctx, { pose: 'embrace', x: 760, y: 1000, scale: 104, T: t, light: 'storm', rimDir: -2.2, facing: f2, camPitch: 0.06, params: { progress: 1 }, senpai: { outfit: 'gown', wet: 1, head: { expr: 'surprise', hair: { style: 'wet' } } }, boy: { outfit: 'wet', head: { expr: 'determined' } } });
    ctx.save(); ctx.beginPath(); ctx.rect(1000, 0, 400, H); ctx.clip(); BACK.night(ctx); ctx.restore();
    A().pair(ctx, { pose: 'leap_embrace', x: 1200, y: 1000, scale: 96, T: t, light: 'night', rimDir: -2.6, facing: 'front', params: { progress: (A().onTwos(t) % 3) / 3 }, senpai: { outfit: 'dress_cardigan', head: { expr: 'smile' } }, boy: { outfit: 'uniform' } });
    A().pair(ctx, { pose: 'collapsed', x: 1620, y: 960, scale: 70, T: t, light: 'storm', rimDir: -2.2, facing: 'right', params: { rise: 0.15 }, senpai: { outfit: 'gown', wet: 1, head: { expr: 'cry' } }, boy: { outfit: 'wet' } });
    A().pair(ctx, { pose: 'collapsed', x: 1620, y: 640, scale: 70, T: t, light: 'storm', rimDir: -2.2, facing: 'right', params: { rise: 1 }, senpai: { outfit: 'gown', wet: 1, head: { expr: 'cry' } }, boy: { outfit: 'wet' } });
    label(ctx, 280, 1060, 'embrace ' + f1); label(ctx, 760, 1060, 'embrace ' + f2); label(ctx, 1200, 1060, 'leap'); label(ctx, 1620, 1060, 'collapsed: over / rising');
  } });
})();// perf probes: the same figure drawn N times (compare with N=0 to remove the post-processing cost)
(function () {
  const PV = window.PV;
  for (const [id, n, who, outfit, pose] of [['perf0', 0], ['perf10', 10, 'senpai', 'uniform', 'stand'], ['perf10b', 10, 'boy', 'uniform', 'stand'], ['perf10p', 10, 'senpai', 'uniform', 'piano'], ['perf10h', 10, 'senpai', 'uniform', 'stand_nohead']]) {
    PV.shot('dev_anime_body_' + id, { draw(ctx, t) {
      ctx.fillStyle = '#ddd'; ctx.fillRect(0, 0, PV.W, PV.H);
      for (let i = 0; i < n; i++) {
        const o = { who, outfit, pose: pose === 'stand_nohead' ? 'stand' : pose, facing: '3q_right', x: 150 + i * 170, y: 1000, scale: 120, T: t + i * 0.1 };
        if (pose === 'stand_nohead') { const h = PV.anime.head, hb = PV.anime.headBack; PV.anime.head = () => ({}); PV.anime.headBack = () => ({}); PV.anime.figure(ctx, o); PV.anime.head = h; PV.anime.headBack = hb; }
        else PV.anime.figure(ctx, o);
      }
    } });
  }
})();
(function () {
  const PV = window.PV;
  PV.shot('dev_anime_body_dbg', { draw(ctx, t) {
    ctx.fillStyle = '#556'; ctx.fillRect(0, 0, PV.W, PV.H);
    const q = PV.devQuery || {};
    PV.anime.pair(ctx, { pose: 'sit_side', x: 700, y: 900, scale: 190, T: 4, light: 'day', facing: '3q_left', params: { side: 'left', lean: 1 }, senpai: { outfit: q.outfit || 'dress_cardigan', head: { expr: 'closed' } }, boy: { outfit: 'jacket' } });
    PV.anime.figure(ctx, { who: 'senpai', outfit: 'dress_cardigan', pose: 'sit_ground', facing: '3q_left', x: 1500, y: 900, scale: 150, T: 4, params: { lean: 1, leanDir: -1, sofa: false, knees: 'up', arms: 'knees' } });
  } });
})();
// API checks: flip + alpha + a pair at alpha 0.6 (determinism is checked by rendering this twice)
(function () {
  const PV = window.PV;
  PV.shot('dev_anime_body_api', { draw(ctx, t) {
    ctx.fillStyle = '#cfd3da'; ctx.fillRect(0, 0, PV.W, PV.H);
    PV.anime.figure(ctx, { who: 'senpai', pose: 'stand', facing: '3q_right', x: 300, y: 1000, scale: 120, T: t });
    PV.anime.figure(ctx, { who: 'senpai', pose: 'stand', facing: '3q_right', x: 700, y: 1000, scale: 120, T: t, flip: true });
    PV.anime.figure(ctx, { who: 'boy', pose: 'stand', facing: 'front', x: 1100, y: 1000, scale: 116, T: t, alpha: 0.5 });
    PV.anime.pair(ctx, { pose: 'sit_side', x: 1600, y: 850, scale: 90, T: t, alpha: 0.6, params: { side: 'left', look: 1 } });
  } });
})();
// neck / shoulder check (debug): upper bodies in clipped cells, with and without the head
(function () {
  const PV = window.PV;
  function cell(ctx, i, j, fn) { const w = 320, h = 520, x0 = i * w, y0 = j * h + 20; ctx.save(); ctx.beginPath(); ctx.rect(x0 + 4, y0, w - 8, h - 8); ctx.clip(); ctx.fillStyle = (i + j) % 2 ? '#ece8e0' : '#e2ddd3'; ctx.fillRect(x0, y0, w, h); fn(x0 + w / 2, y0); ctx.restore(); }
  function fig(ctx, o, noHead) {
    if (!noHead) return PV.anime.figure(ctx, o);
    const h = PV.anime.head, hb = PV.anime.headBack; PV.anime.head = () => ({}); PV.anime.headBack = () => ({});
    try { PV.anime.figure(ctx, o); } finally { PV.anime.head = h; PV.anime.headBack = hb; }
  }
  PV.shot('dev_anime_body_neck', { draw(ctx, t) {
    ctx.fillStyle = '#d8d3c9'; ctx.fillRect(0, 0, PV.W, PV.H);
    const S = 150;
    const L = [
      ['senpai', 'dress', 'stand', 'right', {}, false], ['senpai', 'dress', 'piano', 'right', { intensity: 0.5 }, false], ['senpai', 'dress', 'piano', 'right', { intensity: 0.5 }, true],
      ['senpai', 'uniform', 'stand', '3q_right', { weight: 0.3 }, false], ['senpai', 'uniform', 'stand', 'back', { weight: 0.3 }, false], ['senpai', 'dress', 'stand', 'front', {}, false],
      ['boy', 'uniform', 'stand', 'right', {}, false], ['boy', 'uniform', 'stand', 'right', { nod: 0.35 }, false], ['boy', 'uniform', 'stand', 'back', {}, false],
      ['boy', 'uniform', 'stand', '3q_right', {}, false], ['boy', 'uniform', 'stand', 'right', {}, true], ['boy', 'uniform', 'stand', 'front', {}, false],
    ];
    L.forEach(([who, outfit, pose, f, prm, nh], k) => {
      const i = k % 6, j = Math.floor(k / 6);
      cell(ctx, i, j, (cx, y0) => {
        const top = pose === 'piano' ? 4.3 * S : (who === 'boy' ? 7.3 : 7.0) * S;
        fig(ctx, { who, outfit, pose, facing: f, x: cx, y: y0 + 40 + top, scale: S, T: 2, light: 'day', params: prm }, nh);
      });
    });
  } });
})();
// C20 leap staging check (debug): facing x progress
(function () {
  const PV = window.PV;
  PV.shot('dev_anime_body_leap', { draw(ctx, t) {
    ctx.fillStyle = '#1b2240'; ctx.fillRect(0, 0, PV.W, PV.H);
    const F = [-0.75, 1.2, 2.0], P = [0.1, 0.55, 1];
    F.forEach((f, i) => P.forEach((p, j) => {
      PV.anime.pair(ctx, { pose: 'leap_embrace', x: 330 + j * 640 - 120 + i * 40, y: 330 + i * 360, scale: 36, T: t, light: 'night', rimDir: -2.6, facing: f, params: { progress: p }, senpai: { outfit: 'dress_cardigan', head: { expr: 'smile' } }, boy: { outfit: 'uniform', head: { expr: 'surprise' } } });
      ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif'; ctx.fillText('f=' + f + ' p=' + p, 120 + j * 640, 40 + i * 360);
    }));
  } });
})();
// every lighting condition at wide-shot size (figure ~350 px tall): faces must stay readable, no black silhouettes
(function () {
  const PV = window.PV;
  const BG = { day: '#d9d4c8', window: '#e9dcc6', classroom: '#d8d2c2', sunset: '#d99060', dusk: '#6a5d8a', night: '#1c2340', storm: '#232b40', lightning: '#c8d0e6',
    stage: '#eef0f4', spot: '#16121c', room_gray: '#77787f', lamp: '#3a2e2a', hospital: '#dfe7ee', summer: '#9fcdf5', golden: '#e9c98e' };
  PV.shot('dev_anime_body_light', { draw(ctx, t) {
    const L = Object.keys(BG);
    L.forEach((name, i) => {
      const cx = (i % 8) * 240, cy = Math.floor(i / 8) * 540;
      ctx.fillStyle = BG[name]; ctx.fillRect(cx, cy, 240, 540);
      const back = /window|sunset|night|storm|spot|lamp|golden/.test(name);
      PV.anime.figure(ctx, { who: i % 2 ? 'boy' : 'senpai', outfit: 'uniform', pose: 'stand', facing: i % 2 ? '3q_left' : '3q_right', x: cx + 120, y: cy + 500, scale: i % 2 ? 48 : 50, T: t, light: name, rimDir: back ? -0.6 : undefined, params: { weight: 0.35 }, head: { expr: i % 3 ? 'neutral' : 'smile' } });
      ctx.fillStyle = /night|storm|spot|lamp|dusk/.test(name) ? '#ddd' : '#333'; ctx.font = '18px sans-serif'; ctx.fillText(name, cx + 10, cy + 26);
    });
  } });
})();
/* ================================================================ INTEGRATION SHEETS (model-sheet consistency: anime_head.js x anime_body.js)
 * dev_anime_body_lineup1..4 : 先輩 / 彼 (+ 叔母) side by side in every outfit, front + back, on one ground line with height marks
 *                            (her crown must reach his nose tip: design sheet 1-2), a head-unit ruler, neck attachment, colours.
 * dev_anime_body_shots1..6  : every pose in its shot lighting at the size it has in the film (wide: figure 250-450 px, medium:
 *                            700-1000 px, close: head 250-400 px). Each cell is a 1:1 crop of a real 1920x1080 frame.
 * dev_anime_body_pairs1..2  : the two-person poses (embrace in the rain, leap, sit_side lean / sit_back, collapsed) at medium size.
 * Everything time-varying is computed from PV.anime.onTwos(t) (scenes must do the same).                                       */
(function () {
  const PV = window.PV, W = PV.W, H = PV.H;
  const A = () => PV.anime;
  const BOY_K = 1.06, AUNT_K = (164 / 7.2) / (161 / 7.0);   // head sizes relative to hers (design sheet 1-1 / 1-2)
  const KW = { senpai: 1, boy: BOY_K, aunt: AUNT_K };
  function paper(ctx, top = '#f2eee6', bot = '#e3ddd1') {
    ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, top], [1, bot]]); ctx.fillRect(0, 0, W, H);
  }
  function txt(ctx, x, y, s, col = 'rgba(60,50,40,0.85)', size = 20, align = 'center') { ctx.save(); ctx.font = size + 'px sans-serif'; ctx.textAlign = align; ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.restore(); }
  function dash(ctx, x0, x1, y, col) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.restore(); }

  /* ---------- lineups: sets = [[title, [[who, outfit, extra], ...]], ...]; each set front then back */
  function lineup(ctx, t, sets, S, title) {
    paper(ctx); const gy = 1036;
    ctx.save(); ctx.strokeStyle = 'rgba(90,80,70,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(40, gy); ctx.lineTo(W - 40, gy); ctx.stroke(); ctx.restore();
    // head-unit ruler (her head = S): 0..8
    ctx.save(); ctx.strokeStyle = 'rgba(90,80,70,0.45)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) { const y = gy - i * S; ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(30, y); ctx.stroke(); txt(ctx, 36, y + 5, String(i), 'rgba(90,80,70,0.6)', 13, 'left'); }
    ctx.restore();
    const wOf = (who) => (who === 'boy' ? 2.05 : 1.85) * S * KW[who];
    const slots = []; for (const [lab, mem] of sets) for (const f of ['front', 'back']) slots.push({ lab, mem, f });
    const gap = 0.36 * S; let total = 0; for (const s of slots) for (const m of s.mem) total += wOf(m[0]); total += gap * (slots.length - 1);
    let x = (W - total) / 2 + 20;
    const tq = A().onTwos(t);
    for (const sl of slots) {
      const info = [];
      for (const [who, outfit, extra] of sl.mem) {
        const w = wOf(who); x += w / 2;
        const o = Object.assign({ who, outfit, pose: 'stand', facing: sl.f, x, y: gy, scale: S * KW[who], T: t, light: 'day', params: { weight: who === 'boy' ? -0.3 : 0.35 } }, extra || {});
        const r = A().figure(ctx, o); info.push({ who, x, r });
        txt(ctx, x, gy + 22, (sl.f === 'front' ? '' : '(back) ') + outfit, 'rgba(60,50,40,0.8)', 15);
        x += w / 2;
      }
      // height marks: her crown vs his nose tip (front only), the crown of every figure
      const sp = info.find(i => i.who === 'senpai'), by = info.find(i => i.who === 'boy');
      for (const i of info) if (i.r && i.r.head && i.r.head.crown) { const c = i.r.head.crown; ctx.fillStyle = 'rgba(200,60,60,0.8)'; ctx.fillRect(c[0] - 5, c[1] - 1, 10, 2); }
      if (sp && by && sp.r.head && by.r.head && sl.f === 'front') {
        const cy = sp.r.head.crown[1], ny = by.r.head.nose[1];
        dash(ctx, sp.x - 40, by.x + 40, cy, 'rgba(200,60,60,0.55)');
        ctx.fillStyle = 'rgba(40,110,200,0.9)'; ctx.fillRect(by.r.head.nose[0] - 7, ny - 1, 14, 2);
        txt(ctx, sp.x - 0.9 * S, cy - 8, 'crown−nose ' + (cy - ny).toFixed(0) + 'px', 'rgba(160,40,40,0.95)', 13, 'right');
      }
      x += gap;
    }
    void tq;
    txt(ctx, W / 2, 30, title, 'rgba(60,50,40,0.85)', 22);
  }
  PV.shot('dev_anime_body_lineup1', { draw(ctx, t) {
    lineup(ctx, t, [['school', [['senpai', 'uniform'], ['boy', 'uniform']]], ['blazer', [['senpai', 'blazer'], ['boy', 'blazer']]]], 108,
      'LINEUP 1 — school (C02–C12): uniform / blazer, front + back, one ground line. Red tick = crown, blue = his nose tip');
  } });
  PV.shot('dev_anime_body_lineup2', { draw(ctx, t) {
    lineup(ctx, t, [['sea', [['senpai', 'summer', { noHat: false }], ['boy', 'tee']]], ['competition day', [['senpai', 'dress'], ['boy', 'uniform']]]], 108,
      'LINEUP 2 — the sea (C15/C19: summer + tee) / the competition day (C16–C22: dress + uniform)');
  } });
  PV.shot('dev_anime_body_lineup3', { draw(ctx, t) {
    lineup(ctx, t, [['night park', [['senpai', 'dress_cardigan'], ['boy', 'uniform']]], ['storm', [['senpai', 'gown'], ['boy', 'wet']]]], 108,
      'LINEUP 3 — the night park (C20–C22: dress + cardigan) / the storm (C27–C32: gown + cast, wet shirt)');
  } });
  PV.shot('dev_anime_body_lineup4', { draw(ctx, t) {
    lineup(ctx, t, [['silent days', [['senpai', 'home'], ['boy', A().OUTFITS.boy.year2 ? 'year2' : 'tee']]], ['ending', [['senpai', 'ending'], ['boy', 'ending']]]], 108,
      'LINEUP 4 — the silent days (C33–C40: home + year2) / the ending (C42: ending + ending)');
  } });
  PV.shot('dev_anime_body_lineup6', { draw(ctx, t) {
    lineup(ctx, t, [['outdoors', [['senpai', 'out_brace'], ['boy', 'year2_black']]], ['festival', [['senpai', 'summer_uniform'], ['boy', 'summer_uniform']]]], 108,
      'LINEUP 6 — the silent days outdoors (out_brace + year2_black) / the festival (C13/C14: summer uniforms)');
  } });
  PV.shot('dev_anime_body_lineup5', { draw(ctx, t) {
    lineup(ctx, t, [['aunt', [['aunt', 'coat'], ['boy', 'uniform']]], ['spring', [['senpai', 'spring2'], ['boy', 'jacket']]]], 108,
      'LINEUP 5 — 叔母 (C36: coat; 164 cm next to 彼 178 cm) / year 2 spring (C41: spring2) + his night jacket');
  } });

  /* ---------- shot cells: each cell is a 1:1 crop of a real frame (sizes as in the film) */
  const BG = {
    window: (c, x, y, w, h) => { c.fillStyle = PV.linGrad(c, x, 0, x + w, 0, [[0, '#6f5a4c'], [0.5, '#d9c3a8'], [0.8, '#fff6e6'], [1, '#fffaf2']]); c.fillRect(x, y, w, h); c.fillStyle = PV.radGrad(c, x + w * 0.85, y + h * 0.3, 20, w * 0.8, [[0, '#ffffff', 0.8], [1, '#fff3dc', 0]]); c.fillRect(x, y, w, h); c.fillStyle = 'rgba(110,80,55,0.28)'; c.fillRect(x, y + h * 0.82, w, h * 0.18); },
    stage: (c, x, y, w, h) => { c.fillStyle = PV.radGrad(c, x + w / 2, y + h * 0.35, 30, w, [[0, '#ffffff'], [1, '#d6dae3']]); c.fillRect(x, y, w, h); },
    spot: (c, x, y, w, h) => { c.fillStyle = '#120e18'; c.fillRect(x, y, w, h); c.fillStyle = PV.radGrad(c, x + w / 2, y + h * 0.1, 20, h * 1.1, [[0, '#ffe6bd', 0.5], [1, '#ffe6bd', 0]]); c.fillRect(x, y, w, h); },
    storm: (c, x, y, w, h) => { c.fillStyle = PV.linGrad(c, 0, y, 0, y + h, [[0, '#1b2236'], [1, '#2c3550']]); c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(200,215,240,0.22)'; c.lineWidth = 1.5; for (let i = 0; i < 90; i++) { const xx = x + (i * 97) % w, yy = y + (i * 131) % h; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx - 8, yy + 40); c.stroke(); } },
    summer: (c, x, y, w, h) => { c.fillStyle = PV.linGrad(c, 0, y, 0, y + h, [[0, '#4a92e8'], [0.55, '#bfe0fb'], [0.56, '#3f8fd6'], [1, '#2a6fb5']]); c.fillRect(x, y, w, h); },
    night: (c, x, y, w, h) => { c.fillStyle = PV.linGrad(c, 0, y, 0, y + h, [[0, '#0d1430'], [0.6, '#232a55'], [1, '#141a33']]); c.fillRect(x, y, w, h); for (let i = 0; i < 26; i++) { c.fillStyle = `rgba(255,${200 + (i * 37) % 50},150,${0.22 + (i % 5) * 0.07})`; c.beginPath(); c.arc(x + (i * 211) % w, y + h * 0.55 + (i * 53) % 70, 5 + (i % 4) * 4, 0, 2 * Math.PI); c.fill(); } },
    sunset: (c, x, y, w, h) => { c.fillStyle = PV.linGrad(c, 0, y, 0, y + h, [[0, '#7a5a8c'], [0.45, '#f0a070'], [0.62, '#ffd58a'], [0.63, '#c98f62'], [1, '#4a3a3a']]); c.fillRect(x, y, w, h); c.fillStyle = PV.radGrad(c, x + w * 0.8, y + h * 0.6, 20, w * 0.6, [[0, '#fff4d0', 0.9], [1, '#ffb070', 0]]); c.fillRect(x, y, w, h); },
    gray: (c, x, y, w, h) => { c.fillStyle = PV.linGrad(c, 0, y, 0, y + h, [[0, '#8a8b90'], [1, '#5e5f66']]); c.fillRect(x, y, w, h); c.fillStyle = 'rgba(235,235,240,0.3)'; c.fillRect(x + w * 0.62, y + h * 0.1, w * 0.3, h * 0.55); },
    hospital: (c, x, y, w, h) => { c.fillStyle = PV.linGrad(c, x, 0, x + w, 0, [[0, '#cfd9e3'], [0.5, '#f4f8fc'], [1, '#d9e2ea']]); c.fillRect(x, y, w, h); c.fillStyle = PV.radGrad(c, x + w * 0.5, y + h * 0.35, 20, w * 0.6, [[0, '#ffffff', 0.95], [1, '#ffffff', 0]]); c.fillRect(x, y, w, h); },
    lamp: (c, x, y, w, h) => { c.fillStyle = PV.linGrad(c, x, 0, x + w, 0, [[0, '#2a2026'], [0.7, '#3a2e2a'], [1, '#6a4a32']]); c.fillRect(x, y, w, h); c.fillStyle = PV.radGrad(c, x + w * 0.95, y + h * 0.25, 10, w * 0.5, [[0, '#ffd9a8', 0.7], [1, '#ffd9a8', 0]]); c.fillRect(x, y, w, h); },
    doorway: (c, x, y, w, h) => { c.fillStyle = '#3b3230'; c.fillRect(x, y, w, h); c.fillStyle = PV.linGrad(c, x + w * 0.2, 0, x + w * 0.55, 0, [[0, '#ffe2b8'], [1, '#fff4e0']]); c.fillRect(x + w * 0.18, y + h * 0.05, w * 0.4, h * 0.8); c.fillStyle = 'rgba(80,60,50,0.4)'; c.fillRect(x, y + h * 0.85, w, h * 0.15); },
  };
  function cell(ctx, x, y, w, h, bg, lab, fn) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); BG[bg](ctx, x, y, w, h); fn(); ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.restore();
    ctx.save(); ctx.font = '17px sans-serif'; const tw = ctx.measureText(lab).width; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x + 6, y + 6, tw + 14, 26); ctx.fillStyle = '#fff'; ctx.fillText(lab, x + 13, y + 25); ctx.restore();
  }
  const F = (o) => A().figure(o.ctx, o);
  /* shots1: the wide shots (figures 250-450 px tall) */
  PV.shot('dev_anime_body_shots1', { draw(ctx, t) {
    const tq = A().onTwos(t);
    cell(ctx, 0, 0, 960, 540, 'window', 'C02/C04 wide: piano (treble end 3/4) + 彼 on a chair, juice (window)', () => {
      F({ ctx, who: 'boy', pose: 'seated_chair', facing: '3q_left', x: 790, y: 330, scale: 34, T: t, light: 'window', rimDir: -0.5, params: { variant: 'juice', sip: 0.5 + 0.5 * Math.sin(tq * 1.2) } });
      F({ ctx, who: 'senpai', pose: 'piano', facing: 1.05, camPitch: 0.3, x: 330, y: 330, scale: 58, T: t, light: 'window', rimDir: -0.5, params: { intensity: 0.9, keysLeft: 1.7, keysRight: 1.7 }, head: { expr: 'focus', brows: { furrow: 0.6 } } });
    });
    cell(ctx, 960, 0, 960, 540, 'window', 'C12 wide backlit: she stands by the piano, he cries with the acoustic', () => {
      F({ ctx, who: 'senpai', pose: 'stand', facing: '3q_left', x: 1260, y: 500, scale: 56, T: t, light: 'window', rimDir: -0.35, params: { weight: 0.3, arms: 'chest' }, head: { expr: 'surprise', eyes: { open: 0.9 } } });
      F({ ctx, who: 'boy', pose: 'seated_chair', facing: '3q_left', x: 1640, y: 420, scale: 56 * 1.06, T: t, light: 'window', rimDir: -0.35, params: { variant: 'guitar', headDown: 0.15 }, head: { expr: 'cry', talk: true, T: 36.8 + t } });
    });
    cell(ctx, 0, 540, 960, 540, 'spot', 'C13 stage from the audience: keyboard + Strat (spot)', () => {
      F({ ctx, who: 'senpai', outfit: 'summer_uniform', pose: 'stand', facing: '3q_right', x: 300, y: 1010, scale: 52, T: t, light: 'spot', rimDir: -1.6, params: { arms: 'keys', weight: 0.2 }, head: { expr: 'determined' } });
      F({ ctx, who: 'boy', outfit: 'summer_uniform', pose: 'stand', facing: '3q_left', x: 640, y: 1010, scale: 52 * 1.06, T: t, light: 'spot', rimDir: -1.6, params: { arms: 'strat', weight: 0.3 }, head: { expr: 'focus' } });
    });
    cell(ctx, 960, 540, 960, 540, 'storm', 'C27 storm bridge wide: at the railing (gown, cast, wet)', () => {
      F({ ctx, who: 'senpai', outfit: 'gown', pose: 'railing', facing: 'right', x: 1400, y: 1000, scale: 40, T: t, light: 'storm', rimDir: -2.2, wet: 1, params: { variant: 'hold', railing: true, railMat: 'steel', turn: -0.5 }, head: { expr: 'cry', hair: { style: 'wet' } } });
    });
  } });
  /* shots2: wide / medium-wide */
  PV.shot('dev_anime_body_shots2', { draw(ctx, t) {
    const tq = A().onTwos(t);
    cell(ctx, 0, 0, 960, 540, 'summer', 'C15 railing from the side: her profile under the hat, him beside (summer)', () => {
      F({ ctx, who: 'boy', outfit: 'tee', pose: 'railing', facing: 'right', x: 400, y: 545, scale: 48 * 1.06, T: t, light: 'summer', wind: 0.8, windDir: 3.0, params: { variant: 'lean', railing: true, railZ: 0.8 }, head: { expr: 'gentle', eyes: { look: [0.6, 0] } } });
      F({ ctx, who: 'senpai', outfit: 'summer', pose: 'railing', facing: 'right', x: 560, y: 560, scale: 50, T: t, light: 'summer', wind: 1.0, windDir: 3.0, params: { variant: 'lean', railing: true, railZ: 0.8 }, head: { expr: 'smile' } });
    });
    cell(ctx, 960, 0, 960, 540, 'night', 'C20 night park: running toward the camera (dress + cardigan)', () => {
      F({ ctx, who: 'boy', pose: 'stand', facing: 'left', x: 1800, y: 640, scale: 52 * 1.06, T: t, light: 'night', rimDir: -2.6, params: { weight: 0.2, arms: 'reach' }, head: { expr: 'surprise' } });
      F({ ctx, who: 'senpai', outfit: 'dress_cardigan', pose: 'run', facing: -0.25, camPitch: -0.04, x: 1450, y: 470, scale: 46, T: t, light: 'night', rimDir: -2.6, params: { stride: 0.75 }, head: { expr: 'smile' } });
    });
    cell(ctx, 0, 540, 960, 540, 'night', 'C22 grass, front-3/4: head on his shoulder (night)', () => {
      A().pair(ctx, { pose: 'sit_side', x: 480, y: 940, scale: 62, T: t, light: 'night', rimDir: -2.6, facing: -0.42, camPitch: 0.2, params: { side: 'left', lean: PV.smooth(1, 3, tq) }, senpai: { outfit: 'dress_cardigan', head: { expr: 'closed' } }, boy: { outfit: 'uniform', head: { expr: 'gentle' } } });
    });
    cell(ctx, 960, 540, 960, 540, 'gray', 'C33 sofa with a gap, same camera (room_gray): empty eyes', () => {
      A().pair(ctx, { pose: 'sit_side', x: 1440, y: 900, scale: 58, T: t, light: 'room_gray', facing: -0.42, camPitch: 0.2, params: { side: 'right', gap: 1.0, seat: 'sofa' }, senpai: { outfit: 'home', head: { expr: 'empty', talk: true, T: 123.9 + t } }, boy: { outfit: A().OUTFITS.boy.year2 ? 'year2' : 'tee', head: { expr: 'sad' } } });
    });
  } });
  /* shots3: wide / medium-wide */
  PV.shot('dev_anime_body_shots3', { draw(ctx, t) {
    const tq = A().onTwos(t);
    cell(ctx, 0, 0, 960, 540, 'sunset', 'C42 sunset grass, same camera: she turns to him ("ねえ")', () => {
      A().pair(ctx, { pose: 'sit_side', x: 480, y: 420, scale: 62, T: t, light: 'sunset', rimDir: -0.3, facing: -0.42, camPitch: 0.2, params: { side: 'left', look: PV.smooth(0.5, 1.5, tq) }, senpai: { outfit: 'ending', head: { expr: 'gentle' } }, boy: { outfit: 'ending', head: { expr: 'gentle' } } });
    });
    cell(ctx, 960, 0, 960, 540, 'gray', 'C35 asleep on his shoulder under the blanket (her side)', () => {
      A().pair(ctx, { pose: 'sit_side', x: 1440, y: 470, scale: 70, T: t, light: 'room_gray', facing: 0.3, camPitch: 0.2, params: { side: 'right', gap: 0, seat: 'sofa', lean: 1, blanket: true }, senpai: { outfit: 'home', head: { expr: 'sleep' } }, boy: { outfit: A().OUTFITS.boy.year2 ? 'year2' : 'tee', head: { expr: 'sad', talk: true, T: 137.9 + t } } });
    });
    cell(ctx, 0, 540, 960, 540, 'spot', 'C14 kneeling, the Strat held up, face to the light (spot)', () => {
      F({ ctx, who: 'boy', outfit: 'summer_uniform', pose: 'kneel_guitar', facing: '3q_left', x: 480, y: 1050, scale: 66, T: t, light: 'spot', rimDir: -1.6, params: { variant: 'raise' }, head: { expr: 'closed', mouth: { open: 0.5, shape: 'a' } } });
    });
    cell(ctx, 960, 540, 960, 540, 'storm', 'C31 on the wet ground (far): over him / rising', () => {
      A().pair(ctx, { pose: 'collapsed', x: 1250, y: 1000, scale: 54, T: t, light: 'storm', rimDir: -2.2, facing: 'right', params: { rise: 0.1 }, senpai: { outfit: 'gown', wet: 1, head: { expr: 'cry' } }, boy: { outfit: 'wet', head: { expr: 'pain' } } });
      A().pair(ctx, { pose: 'collapsed', x: 1650, y: 1000, scale: 54, T: t, light: 'storm', rimDir: -2.2, facing: 'right', params: { rise: 1 }, senpai: { outfit: 'gown', wet: 1, head: { expr: 'cry' } }, boy: { outfit: 'wet', head: { expr: 'determined' } } });
    });
  } });
  /* shots4: medium (seated figure ~700-800 px): C10 and C17 at the piano */
  PV.shot('dev_anime_body_shots4', { draw(ctx, t) {
    cell(ctx, 0, 0, 960, 1080, 'window', 'C10 medium: treble-end 3/4, eyes closed, gentle (window rim)', () => {
      F({ ctx, who: 'senpai', pose: 'piano', facing: 1.05, camPitch: 0.28, x: 430, y: 600, scale: 150, T: t, light: 'window', rimDir: -0.5, params: { intensity: 0.35, keysLeft: 1.2, keysRight: 1.4 }, head: { expr: 'closed' } });
    });
    cell(ctx, 960, 0, 960, 1080, 'stage', 'C17 medium: right profile, dress + chignon, focus (white stage)', () => {
      F({ ctx, who: 'senpai', outfit: 'dress', pose: 'piano', facing: 'right', camPitch: 0.06, x: 1330, y: 620, scale: 150, T: t, light: 'stage', params: { intensity: 0.75, keysLeft: 1.0, keysRight: 1.6 }, head: { expr: 'focus', brows: { furrow: 0.7 }, eyes: { tears: 0.75 } } });
    });
  } });
  /* shots5: medium standing (700-1000 px): C25 (him at the window, pained), C36 (the aunt glancing back), C04 clapping */
  PV.shot('dev_anime_body_shots5', { draw(ctx, t) {
    cell(ctx, 0, 0, 640, 1080, 'hospital', 'C25 medium: him at the window, pained', () => {
      F({ ctx, who: 'boy', pose: 'stand', facing: -0.25, x: 320, y: 1380, scale: 150, T: t, light: 'hospital', rimDir: -1.4, params: { weight: 0.3, armBend: 0.1 }, head: { expr: 'pain', talk: true, T: 83.8 + t, eyes: { look: [0, 0.1] } } });
    });
    cell(ctx, 640, 0, 640, 1080, 'doorway', 'C36: 叔母 walks out, glances back (doorway backlight)', () => {
      F({ ctx, who: 'aunt', outfit: 'coat', pose: 'walk', facing: -2.55, x: 960, y: 1030, scale: 122, T: t, light: 'window', rimDir: -0.6, params: { neckYaw: 1.2, twist: 0.35 }, head: { talk: true, T: 141.4 + t, eyes: { open: 0.8, look: [-0.3, 0.1] } } });
    });
    cell(ctx, 1280, 0, 640, 1080, 'window', 'C04/C06 medium: chair, clap / juice', () => {
      F({ ctx, who: 'boy', pose: 'seated_chair', facing: '3q_left', x: 1590, y: 560, scale: 118, T: t, light: 'window', rimDir: -0.4, params: { variant: 'clap', claps: [0.6, 1.1, 1.6, 2.6, 3.1, 4.0, 4.5] }, head: { expr: 'smile' } });
    });
  } });
  /* shots6: close-ups. Left column = the body library at close-up scale (figure, clipped); the head library's bust for comparison */
  PV.shot('dev_anime_body_shots6', { draw(ctx, t) {
    const tq = A().onTwos(t);
    cell(ctx, 0, 0, 640, 540, 'window', 'C05 close (figure): 3/4, teary, talking', () => {
      F({ ctx, who: 'senpai', pose: 'stand', facing: 0.55, x: 330, y: 1720, scale: 230, T: t, light: 'window', rimDir: -0.5, params: { weight: 0.2, tilt: 0.12 }, head: { expr: 'teary', talk: true, T: 12.6 + t, eyes: { tears: 0.5, look: [0.2, -0.15] } } });
    });
    cell(ctx, 640, 0, 640, 540, 'window', 'C05 close (head lib bust) for comparison', () => {
      A().bust(ctx, { who: 'senpai', outfit: 'uniform', x: 960, y: 330, size: 230, yaw: 0.45, roll: 0.06, light: 'window', rimDir: -0.5, T: 12.6 + t, expr: 'teary', talk: true, eyes: { tears: 0.5, look: [0.2, -0.15] } });
    });
    cell(ctx, 1280, 0, 640, 540, 'window', 'C06 close (figure): juice, half-smile, talking', () => {
      F({ ctx, who: 'boy', pose: 'seated_chair', facing: -0.6, x: 1600, y: 760, scale: 190, T: t, light: 'window', rimDir: -0.4, params: { variant: 'juice', sip: 0.6 }, head: { expr: 'gentle', talk: true, T: 16.5 + t } });
    });
    cell(ctx, 0, 540, 640, 540, 'stage', 'C16 close (figure): dress, chignon, blank stare', () => {
      F({ ctx, who: 'senpai', outfit: 'dress', pose: 'stand', facing: 0.3, x: 320, y: 2300, scale: 240, T: t, light: 'stage', params: { weight: 0.1 }, head: { expr: 'neutral', eyes: { shine: 0.35, look: [0.25, 0.1] } } });
    });
    cell(ctx, 640, 540, 640, 540, 'storm', 'C28 close (figure): turns, wet hair, shouting, cast', () => {
      F({ ctx, who: 'senpai', outfit: 'gown', pose: 'stand', facing: 0.35, x: 960, y: 2280, scale: 240, T: t, light: 'storm', rimDir: -2.2, wet: 1, params: { weight: 0.1 }, head: { expr: 'shout', talk: true, T: 99.0 + t, eyes: { tears: 1 }, hair: { style: 'wet' } } });
    });
    cell(ctx, 1280, 540, 640, 540, 'lamp', 'C39 close (figure): profile, crying, talking (lamp)', () => {
      F({ ctx, who: 'boy', outfit: A().OUTFITS.boy.year2 ? 'year2' : 'tee', pose: 'stand', facing: 'left', x: 1640, y: 2350, scale: 240, T: t, light: 'lamp', rimDir: -0.3, params: { weight: 0.1, nod: 0.3 }, head: { expr: 'cry', talk: true, T: 154.3 + t } });
    });
  } });
  /* pairs1: medium two-person poses — C32 embrace (both faces), C20 leap (landing), sit_back (back view reference) */
  PV.shot('dev_anime_body_pairs1', { draw(ctx, t) {
    const tq = A().onTwos(t);
    cell(ctx, 0, 0, 760, 1080, 'storm', 'C32 the embrace in the rain (two faces)', () => {
      A().pair(ctx, { pose: 'embrace', x: 380, y: 1070, scale: 118, T: t, light: 'storm', rimDir: -2.2, facing: -0.75, camPitch: 0.06, params: { progress: 1 }, senpai: { outfit: 'gown', wet: 1, head: { expr: 'surprise', eyes: { tears: 0.6 }, hair: { style: 'wet' } } }, boy: { outfit: 'wet', head: { expr: 'determined', talk: true, T: 117.0 + t } } });
    });
    cell(ctx, 760, 0, 640, 1080, 'night', 'C20 the leap (landing 0.25, camera side-on -1.2)', () => {
      A().pair(ctx, { pose: 'leap_embrace', x: 1080, y: 1050, scale: 104, T: t, light: 'night', rimDir: -2.6, facing: -1.2, params: { progress: 0.25 }, senpai: { outfit: 'dress_cardigan', head: { expr: 'smile' } }, boy: { outfit: 'uniform', head: { expr: 'surprise' } } });
    });
    cell(ctx, 1400, 0, 520, 1080, 'night', 'sit_back + lean (back view ref.)', () => {
      A().pair(ctx, { pose: 'sit_back', x: 1660, y: 900, scale: 84, T: t, light: 'night', rimDir: -2.6, camPitch: 0.15, params: { side: 'left', lean: 1 }, senpai: { outfit: 'dress_cardigan', head: { expr: 'closed' } }, boy: { outfit: 'uniform' } });
      A().pair(ctx, { pose: 'leap_embrace', x: 1660, y: 470, scale: 52, T: t, light: 'night', rimDir: -2.6, params: { progress: (tq % 3) / 3 }, senpai: { outfit: 'dress_cardigan', head: { expr: 'smile' } }, boy: { outfit: 'uniform', head: { expr: 'surprise' } } });
    });
  } });
  /* pairs2: medium C22 lean, C33 gap, C31 close-ish collapsed */
  PV.shot('dev_anime_body_pairs2', { draw(ctx, t) {
    const tq = A().onTwos(t);
    cell(ctx, 0, 0, 960, 540, 'night', 'C22 medium: lean 1 (head on his shoulder)', () => {
      A().pair(ctx, { pose: 'sit_side', x: 470, y: 500, scale: 118, T: t, light: 'night', rimDir: -2.6, facing: -0.42, camPitch: 0.2, params: { side: 'left', lean: 1 }, senpai: { outfit: 'dress_cardigan', head: { expr: 'closed' } }, boy: { outfit: 'uniform', head: { expr: 'gentle', eyes: { look: [0.4, 0.3] } } } });
    });
    cell(ctx, 960, 0, 960, 540, 'sunset', 'C42 medium: look 1 ("ねえ")', () => {
      A().pair(ctx, { pose: 'sit_side', x: 1430, y: 500, scale: 118, T: t, light: 'sunset', rimDir: -0.3, facing: -0.42, camPitch: 0.2, params: { side: 'left', look: 1 }, senpai: { outfit: 'ending', head: { expr: 'gentle' } }, boy: { outfit: 'ending', head: { expr: 'gentle' } } });
    });
    cell(ctx, 0, 540, 960, 540, 'storm', 'C31 medium: she is over him (rise 0.1)', () => {
      A().pair(ctx, { pose: 'collapsed', x: 480, y: 1040, scale: 110, T: t, light: 'storm', rimDir: -2.2, facing: 'right', params: { rise: 0.1 }, senpai: { outfit: 'gown', wet: 1, head: { expr: 'cry' } }, boy: { outfit: 'wet', head: { expr: 'pain', talk: true, T: 110.4 + t } } });
    });
    cell(ctx, 960, 540, 960, 540, 'gray', 'C33 medium: the gap (room_gray)', () => {
      A().pair(ctx, { pose: 'sit_side', x: 1440, y: 1000, scale: 118, T: t, light: 'room_gray', facing: -0.42, camPitch: 0.2, params: { side: 'right', gap: 1.0, seat: 'sofa' }, senpai: { outfit: 'home', head: { expr: 'empty', talk: true, T: 123.9 + t } }, boy: { outfit: A().OUTFITS.boy.year2 ? 'year2' : 'tee', head: { expr: 'sad' } } });
    });
    void tq;
  } });
})();
// debug: seated skirt / blanket close-up (front-3/4 from above, as C22/C42/C35)
(function () {
  const PV = window.PV;
  PV.shot('dev_anime_body_dbgsit', { draw(ctx, t) {
    ctx.fillStyle = '#c9c4ba'; ctx.fillRect(0, 0, PV.W, PV.H);
    PV.anime.figure(ctx, { who: 'senpai', outfit: 'ending', pose: 'sit_ground', facing: -0.42, camPitch: 0.2, x: 480, y: 900, scale: 200, T: 2, params: { knees: 'side', sideDir: -1, arms: 'lap', look: -0.6 } });
    PV.anime.figure(ctx, { who: 'senpai', outfit: 'dress_cardigan', pose: 'sit_ground', facing: -0.42, camPitch: 0.2, x: 1400, y: 900, scale: 200, T: 2, params: { knees: 'side', sideDir: 1, arms: 'lap' } });
  } });
})();
// perf probe for the integration changes: ?=  dev_anime_body_perfN (head neck) vs perfB (body neck) vs perfR (no rim light)
(function () {
  const PV = window.PV;
  const mk = (id, extra, pose) => PV.shot(id, { draw(ctx, t) {
    ctx.fillStyle = '#ddd'; ctx.fillRect(0, 0, PV.W, PV.H);
    for (let i = 0; i < 10; i++) PV.anime.figure(ctx, Object.assign({ who: i % 2 ? 'boy' : 'senpai', pose: pose || 'stand', facing: '3q_right', x: 150 + i * 170, y: 1000, scale: 120, T: t + i * 0.1, light: 'window', rimDir: -0.5 }, extra));
  } });
  mk('dev_anime_body_perfN', {});
  mk('dev_anime_body_perfB', { bodyNeck: true });
  mk('dev_anime_body_perfR', { light: 'day' });
  mk('dev_anime_body_perfP', { partRim: true });
  mk('dev_anime_body_perfX', { rimA: 0, head: { rim: 0 } });
  mk('dev_anime_body_perfH', { rimA: 0 });
})();

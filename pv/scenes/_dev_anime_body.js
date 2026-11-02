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

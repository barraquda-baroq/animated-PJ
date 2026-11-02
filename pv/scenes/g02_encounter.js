/* g02_encounter — ACT0 出会い〜ACT1 頭: C05 / C06 / C07 / C08 (characters: PV.anime — anime_head.js / anime_body.js)
 *   C05 先輩の顔のアップ（3/4、窓の逆光）。息を切らしたまま、瞳を潤ませて「ねえ……どうして今日は拍手をくれたの」
 *       （V01 口パク）。奥のボケの中、窓間壁の陰の彼が膝のパックを取り上げてストローをくわえる
 *   C06 彼のバスト（3/4、窓の逆光）。ストローから口を離し「え？　だって、今のはミスなかったじゃん」（V02 口パク）、
 *       きょとんとした顔から軽い半笑いへ→レースのカーテンが風をはらみ、開いたひだから差す光が肩をなでる
 *   C07 音符が金に変わって一斉に紙から剥がれ、光になって舞い上がる（五線だけが残って消える）→温かい白（周辺減光なし）
 *       →涙がスローで白鍵 A4 に落ち、鍵がわずかに沈んで光る→その一点から春の色が戻る
 *   C08 左右分割のセッション（左＝彼女の右手と鍵盤／右＝彼の左手と指板）。指使いは M4 の旋律どおり
 *       →継ぎ目がフレアに咲き、ピアノの先輩（左）とギターの彼（右）が顔を見合わせて笑う一枚の画（27.5〜28.0）へ
 * Event times are written in ABSOLUTE storyboard seconds and converted with the shot's real start, so the picture
 * stays locked to the sound even if the edit moves a cut (solo previews fall back to the storyboard start).
 */
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, TAU = Math.PI * 2, PI = Math.PI;
  const clamp = PV.clamp, lerp = PV.lerp, sm = PV.smooth, smr = PV.smoother;
  const SB_START = { C05: 12.5, C06: 16.4, C07: 19.9, C08: 22.0 };
  // absolute time of local t in shot S
  const absT = (S, id, t) => ((S && S.start > 0.01) ? S.start : SB_START[id]) + t;
  const bell = (x, c, w) => Math.exp(-((x - c) / w) * ((x - c) / w));
  // layers that animate "on twos" (12 fps, like the characters) are painted into a frame buffer once per 1/12 s;
  // the content depends only on the quantised time, so cached and fresh renders are identical (deterministic).
  const TWOS = {};
  function onTwos(key, t, phase, draw) {
    const q = Math.floor((t - phase) * 12 + 1e-6) / 12 + phase;
    const b = PV.buffer('g02:2s:' + key);
    if (TWOS[key] !== q) { TWOS[key] = q; b.ctx.clearRect(0, 0, W, H); draw(b.ctx, q); }
    return b.canvas;
  }
  // C04 (g01) stages the boy at screen-left looking right, her at screen-right. C05/C06 keep that screen direction:
  // they are composed un-mirrored and flipped as a whole (so every light direction inside stays self-consistent).
  // (drawn straight through a flipped transform: every layer inside is a drawImage / fill / sprite, so no extra
  // full-frame buffer and copy are needed)
  function mirrored(ctx, fn) {
    ctx.save(); ctx.setTransform(-1, 0, 0, 1, W, 0); fn(ctx); ctx.restore();
  }

  /* =====================================================================================================
   * Screen geography (C04 -> C05 -> C06): g01's C04 keeps the boy at screen-LEFT by the pier (deep) and her at the piano at
   * screen-RIGHT; C05 turns her to him, so here 先輩 is on the right looking LEFT and 彼 on the left looking RIGHT (as before
   * the rework). DIR = -1 = that geography: the room plates are painted mirrored (as they always were) and the characters
   * are placed at the mirrored spots — but drawn un-flipped, so her parting and his hair flow stay on their own sides.
   * DIR = +1 would give the design sheet's preferred sides (her right cheek, his left cheek) if C04 is ever restaged.
   * (C08's landing is its own picture: piano and 先輩 left, guitar and 彼 right, as the plan asks.)
   * ===================================================================================================== */
  const DIR = -1;
  const A = () => PV.anime;
  const sX = (x) => (DIR > 0 ? x : W - x);                 // a screen x in this geography
  const sAng = (a) => (DIR > 0 ? a : PI - a);              // a screen direction (rimDir / lightDir / windDir)
  function inDir(ctx, fn) { if (DIR > 0) return fn(ctx); return mirrored(ctx, fn); }
  // lips between the words: the line's own lip-sync while a syllable sounds; between syllables / in the pauses the lips
  // rest a little parted (先輩: "言葉を探す「……」で唇が少し開いたまま止まる"), closed for 彼
  function lips(T, who, rest) {
    const mo = A().mouth(T, who);
    return mo.open > 0 ? { talk: true } : { talk: false, mouth: { open: rest } };
  }

  /* =====================================================================================================
   * C05 — 先輩's close-up, 3/4, turned to him (the boy deep on the other side of the frame), the windows behind her
   *        (back-light: a soft rose shade on the face, a lit edge on the far cheek, the hair rimmed). Still out of breath
   *        after 〈雪あらし〉, eyes welling, she asks "ねえ……どうして今日は拍手をくれたの"
   *        (V01, lip-synced). Behind her, out of focus in the pier's shade, the boy picks his juice up off his knee and
   *        drinks (C06 opens on the straw leaving his lips). The band of light with its dust crosses between them.
   * ===================================================================================================== */
  const C05_CAM = { eye: [8.7, 1.3, 5.3], target: [4.25, 0.8, 1.65], fov: 54 };
  const C05_BOY = [4.95, 0.45, 0.9];        // seat (room metres): by the pier, where the sun does not reach
  // her: the neck point on screen, head size (px), body facing / head turn
  const C05_HER = { x: 600, y: 700, size: 500, facing: 0.62, turn: 0.08 };
  // her figure: seated at the piano (hands in her lap), turned to him; back-lit by the windows on his side of the room.
  // The light is the library's 'window' made a little softer (less ambient / exposure loss, a lavender shadow) so the close
  // face stays fair in its back-light shade instead of going tan; shade 0.6 toward the light = the backlit-close-up recipe
  // of the head API (face in shade, a lit sliver on the far cheek).
  const C05_LIGHT = Object.assign({}, PV.anime.LIGHT.window, { amb: 0.12, dark: 0.96, shadow: '#aaa6d4', sat: 0.8 });
  function c05HerArgs(T, p) {
    const base = { who: 'senpai', outfit: 'uniform', pose: 'piano', facing: C05_HER.facing * DIR, scale: C05_HER.size, T, light: C05_LIGHT,
      rimDir: sAng(-0.5), keyDir: sAng(-0.3), rimA: 0, wind: 0.2, windDir: sAng(PI * 0.98),     // body rim off: it zigzags along the collar
      params: { hands: 'lap', keys: false, bench: false, look: 'ahead', breathe: 0, tilt: 0.04, nod: 0.1 },
      head: { expr: 'teary', turn: C05_HER.turn * DIR, lightDir: sAng(-0.12), shade: 0.6, rimW: 1.4, faceLift: 1, blinkOffset: 0.54 } };
    const nk = probeNeck('c05her', base);            // place her by the neck point (the seated pose leans, so it is measured)
    const o = Object.assign({}, base, { x: sX(C05_HER.x) - nk[0], y: C05_HER.y - nk[1] });
    o.params = Object.assign({}, base.params, p); o.head = Object.assign({}, base.head);
    return o;
  }
  // the neck point of a figure relative to its anchor, measured once by a draw into a tiny scratch canvas
  const PROBES = {};
  function probeNeck(key, o) {
    if (PROBES[key]) return PROBES[key];
    const b = PV.makeCanvas(4, 4);
    const info = A().figure(b.ctx, Object.assign({}, o, { x: 0, y: 0, T: 0 }));
    const nk = (info.head && info.head.neck) || info.neck;
    return (PROBES[key] = [nk[0], nk[1]]);
  }
  // the boy far behind her: the juice on his knee -> up to his lips while she asks (global seconds)
  function c05Sip(T) { return Math.round(sm(13.45, 14.3, T) * 40) / 40; }
  // he is far and out of focus: his drawing changes only with the pack (cached by its position), drawn at the plate's base
  // camera and moved with the drift when blitted
  const C05_BOYQ = { key: null };
  // the out-of-focus room: painted sharp into a scratch buffer, then blurred at quarter resolution (edges clamped so the
  // blur does not darken the frame border)
  function blurPlate(src, px, div = 4) {
    const m = 6, hw = W / div, hh = H / div;
    const hb = PV.buffer('g02:blurHalf', hw + 2 * m, hh + 2 * m), hc = hb.ctx;
    hc.clearRect(0, 0, hw + 2 * m, hh + 2 * m);
    hc.drawImage(src, 0, 0, W, H, 0, 0, hw + 2 * m, hh + 2 * m);       // stretched copy under the margins
    hc.drawImage(src, 0, 0, W, H, m, m, hw, hh);
    const ob = PV.buffer('g02:blurOut', hw + 2 * m, hh + 2 * m), oc = ob.ctx;
    oc.clearRect(0, 0, hw + 2 * m, hh + 2 * m); oc.filter = `blur(${px}px)`; oc.drawImage(hb.canvas, 0, 0); oc.filter = 'none';
    return { canvas: ob.canvas, m, w: hw, h: hh };
  }
  PV.shot('C05', { draw(ctx, t, d, S) { drawC05(ctx, t, d, S); } });
  function drawC05(ctx, t, d, S) {
    const tt = clamp(t, -0.5, d + 0.5);
    const T = absT(S, 'C05', tt);
    S.post = Object.assign({}, S.post, { bloom: 0.18 });      // a bright close-up: keep the thin eye lines crisp
    // camera: static, a very slow drift (parallax: the close foreground travels ~3x the background)
    const drift = smr(-0.2, 4.4, tt);                        // 0..1 over the cut
    const bgX = 26 * drift * DIR, fgX = 78 * drift * DIR;    // (the old plate's un-mirrored drift)
    // the room, the pier's shade and the boy: one plate repainted on twos and thrown out of focus (she is the focus now)
    ctx.drawImage(onTwos('c05bg', tt, 0, (c, q) => {
      const dq = smr(-0.2, 4.4, q), bq = 26 * dq;
      const sb = PV.buffer('g02:c05sharp'), sc = sb.ctx; sc.clearRect(0, 0, W, H);
      inDir(sc, (c2) => {
        c2.save();
        PV.camera(c2, { zoom: 1.035 + 0.006 * dq, x: bq, cx: 1050, cy: 560 });
        const R = L.musicRoom(c2, q, { cam: C05_CAM, time: 'noon', furniture: 'none', wind: 0.35, shaft: 1.8 });
        // the pier's shade around his seat: a soft cool pocket (he sits where the sun does not reach)
        const p0 = R.project(C05_BOY), pH = R.project([C05_BOY[0], C05_BOY[1] + 1.0, C05_BOY[2]]);
        const pxm = p0[1] - pH[1];                               // px per metre at his depth
        c2.save(); c2.globalCompositeOperation = 'multiply';
        const pw = R.project([4.1, 2.6, 0.12]), pb = R.project([4.1, 0.0, 0.12]);
        const colW = pxm * 0.95;
        let g = c2.createLinearGradient(p0[0] - colW, 0, p0[0] + colW * 1.1, 0);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(196,180,170,1)'); g.addColorStop(0.62, 'rgba(184,168,160,1)'); g.addColorStop(1, 'rgba(255,255,255,1)');
        c2.fillStyle = g; c2.fillRect(p0[0] - colW, pw[1] - 40, colW * 2.1, pb[1] - pw[1] + 40);
        g = c2.createRadialGradient(p0[0] + pxm * 0.1, p0[1] + pxm * 0.15, pxm * 0.1, p0[0] + pxm * 0.1, p0[1] + pxm * 0.15, pxm * 1.1);
        g.addColorStop(0, 'rgba(150,132,128,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c2.save(); c2.translate(p0[0], p0[1]); c2.scale(1, 0.35); c2.translate(-p0[0], -p0[1]); c2.fillStyle = g; c2.fillRect(p0[0] - pxm * 1.3, p0[1] - pxm * 1.3, pxm * 2.6, pxm * 2.6); c2.restore();
        c2.restore();
        L.glow(c2, p0[0] + pxm * 0.25, p0[1] - pxm * 1.05, pxm * 1.5, '#fff1d8', 0.42);
        c2.restore();
        // the boy (seated by the pier, turned to her), drawn un-mirrored at his mirrored place (base camera, see C05_BOYQ)
        const Tq = absT(S, 'C05', q), sip = c05Sip(Tq), cz0 = 1.035;
        if (C05_BOYQ.key !== sip) {
          C05_BOYQ.key = sip;
          const bb = PV.buffer('g02:c05boy'), bc = bb.ctx; bc.clearRect(0, 0, W, H);
          const bxs = 1050 + (p0[0] - 1050) * cz0, bys = 560 + (p0[1] - 560) * cz0;
          A().figure(bc, { who: 'boy', outfit: 'uniform', pose: 'seated_chair', facing: -0.95 * DIR, x: sX(bxs), y: bys,
            scale: pxm * 0.244 * cz0, T: 13.0, light: 'window', rimDir: sAng(-1.35), rimA: 0.5, params: { variant: 'juice', sip, chair: true },
            head: { rim: 0, expr: 'neutral', noBlink: true, eyes: { look: [-0.4 * DIR, 0.05] } } });
        }
      });
      const k = (1.035 + 0.006 * dq) / 1.035, pvx = sX(1050);
      sc.save(); sc.translate(pvx + DIR * bq, 560); sc.scale(k, k); sc.translate(-pvx, -560); sc.drawImage(PV.buffer('g02:c05boy').canvas, 0, 0); sc.restore();
      const bp = blurPlate(sb.canvas, 1.7);
      c.drawImage(bp.canvas, bp.m, bp.m, bp.w, bp.h, 0, 0, W, H);
    }), 0, 0);
    // the band of light that crosses between them + dust riding in it
    const bx = sX(1000) + bgX * 1.6;                         // band centre at mid-height (between them)
    const slant = 0.36 * DIR;                                  // x shift per px of y (top leans toward the window)
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const bandA = 0.3 + 0.06 * Math.sin(T * 1.1) + 0.04 * Math.sin(T * 2.9 + 1);
    ctx.translate(bx, 540); ctx.transform(1, 0, -slant, 1, 0, 0);
    for (const [hw, a] of [[230, 0.55], [120, 0.7], [46, 0.55]]) {
      const gg = ctx.createLinearGradient(-hw, 0, hw, 0);
      gg.addColorStop(0, 'rgba(255,232,196,0)'); gg.addColorStop(0.5, `rgba(255,236,204,${(bandA * a).toFixed(3)})`); gg.addColorStop(1, 'rgba(255,232,196,0)');
      ctx.fillStyle = gg; ctx.fillRect(-hw, -600, hw * 2, 1200);
    }
    ctx.restore();
    L.dust(ctx, T, { seed: 51, count: 70, x0: bx - 470, x1: bx + 470, y0: 40, y1: 1000, size: 3.0, alpha: 0.95, color: '#fff3dc', drift: 46, vx: 7 * DIR, vy: -5,
      mask: (x, y) => clamp(1.15 - Math.abs((x - bx) + (y - 540) * slant) / 200) });
    L.dust(ctx, T, { seed: 52, count: 26, x0: bx - 470, x1: bx + 470, y0: 40, y1: 1000, size: 6.5, alpha: 0.45, color: '#fff1d6', drift: 60, vx: 9 * DIR, vy: -3,
      mask: (x, y) => clamp(1.1 - Math.abs((x - bx) + (y - 540) * slant) / 230) });
    // floor nearest the camera in the piano's shadow (also keeps the subtitle legible)
    const g = ctx.createLinearGradient(0, H * 0.74, 0, H);
    g.addColorStop(0, 'rgba(40,28,22,0)'); g.addColorStop(1, 'rgba(40,28,22,0.42)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.74, W, H * 0.26);

    // her: out of breath, slowly calming (the seated pose's heavy-breathing shoulders, fading over the line)
    const fig = onTwos('c05her', tt, 1 / 24, (c, q) => {
      const Tq = absT(S, 'C05', q);
      // the acting (global seconds; V01: "ねえ" 12.64–12.9, "……", "どうして今日は" 13.6–14.4, "拍手を" 14.85–15.5, "くれたの" 15.55–15.95)
      const nee = sm(12.6, 12.95, Tq) * (1 - 0.5 * sm(13.7, 14.4, Tq));          // "ねえ……": the small head tilt, chin in, eyes up (上目で窺う)
      const asks = sm(13.55, 14.3, Tq), last = sm(14.9, 15.8, Tq), after = sm(15.95, 16.3, Tq);
      const breathe = lerp(1, 0.12, sm(12.45, 15.2, Tq));                         // out of breath after 〈雪あらし〉, calming
      const tears = lerp(0.3, 0.48, sm(12.7, 15.9, Tq));                          // welling, never spilling (her tear falls in C07)
      const lp = lips(Tq, 'senpai', 0.1 + 0.08 * (1 - sm(12.5, 13.1, Tq)) - 0.04 * after);   // still catching her breath at the cut
      const o = c05HerArgs(Tq, { breathe, tilt: 0.04 + 0.07 * nee - 0.02 * last, nod: 0.1 + 0.05 * nee });
      o.head = Object.assign(o.head, {
        eyes: { tears, look: [0.42 * DIR, -0.18 - 0.1 * nee + 0.05 * last], open: 0.97 + 0.05 * asks - 0.06 * after },
        brows: { inner: 0.66 + 0.2 * asks + 0.08 * last, outer: -0.2, furrow: 0.15 + 0.15 * last },
        mouth: Object.assign({ tremble: 0.35 * last }, lp.mouth || {}), talk: lp.talk, blush: 0.36 + 0.1 * last, roll: 0.07 * nee * DIR });
      A().figure(c, o);
    });
    ctx.save(); ctx.translate(fgX, 0); ctx.drawImage(fig, 0, 0); ctx.restore();
    // the bottom of the frame falls into the piano's shade: the white blouse stays under the subtitle quietly
    const gb = ctx.createLinearGradient(0, 860, 0, H); gb.addColorStop(0, 'rgba(46,34,30,0)'); gb.addColorStop(1, 'rgba(46,34,30,0.34)');
    ctx.fillStyle = gb; ctx.fillRect(0, 860, W, H - 860);
    // a few big soft motes very near the lens (out of focus), the warm window flare (top right), lens haze
    L.bokeh(ctx, T, { seed: 7, count: 8, x0: Math.min(sX(1250), sX(1850)), x1: Math.max(sX(1250), sX(1850)), y0: 120, y1: 820, rmin: 12, rmax: 30, alpha: 0.2, colors: ['#fff1d6', '#ffe2b8'], wobble: 14 });
    L.glow(ctx, sX(1500) + bgX, 170, 700, '#fff3dc', 0.32);
  }

  /* =====================================================================================================
   * C06 — 彼's bust, 3/4, at the edge of the pier's shade, the curtained window behind him on the light side. The straw
   *        leaves his lips; "え？ だって、今のはミスなかったじゃん" (V02, lip-synced) from a blank, puzzled face into an easy
   *        half-smile — the curtain fills with wind (18.6) and a beam of sun strokes his shoulder.
   * ===================================================================================================== */
  const C06_PIER = 1440;                 // screen x where the window ends and the pier (shade) begins
  const C06_SILL = 742;                  // screen y of the window sill
  function c06Back() {                   // static back plate (window, curtain base, pier, sill), soft focus
    return PV.cached('g02:c06back', W, H, (c) => {
      // outside: blown-out spring sky (pale blue up high), the school's cherry trees as soft pink masses low down
      let g = c.createLinearGradient(0, 0, 0, C06_SILL);
      g.addColorStop(0, '#b9d8f2'); g.addColorStop(0.35, '#dcebf6'); g.addColorStop(0.62, '#f6f4ee'); g.addColorStop(1, '#fff3e2');
      c.fillStyle = g; c.fillRect(0, 0, C06_PIER, C06_SILL);
      const r = PV.rng(606);
      for (let i = 0; i < 34; i++) { const x = r() * C06_PIER, y = 430 + r() * 300, rr = 50 + r() * 140; const gg = c.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, `rgba(246,192,208,${0.2 + r() * 0.22})`); gg.addColorStop(1, 'rgba(246,192,208,0)'); c.fillStyle = gg; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
      for (let i = 0; i < 10; i++) { const x = r() * C06_PIER, y = 560 + r() * 160, rr = 60 + r() * 90; const gg = c.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, `rgba(176,206,150,${0.12 + r() * 0.1})`); gg.addColorStop(1, 'rgba(176,206,150,0)'); c.fillStyle = gg; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
      // the sun itself, high beyond the glass (behind the sheer): a hot spot
      g = c.createRadialGradient(470, 80, 0, 470, 80, 560); g.addColorStop(0, 'rgba(255,252,240,1)'); g.addColorStop(0.35, 'rgba(255,246,226,0.75)'); g.addColorStop(1, 'rgba(255,246,226,0)');
      c.fillStyle = g; c.fillRect(0, 0, C06_PIER, C06_SILL);
      // window frame (out of focus behind the sheer)
      c.fillStyle = 'rgba(168,160,150,0.5)'; c.fillRect(640, 0, 26, C06_SILL); c.fillRect(0, 300, C06_PIER, 18); c.fillRect(0, 0, 24, C06_SILL);
      c.fillStyle = 'rgba(150,140,130,0.7)'; c.fillRect(C06_PIER - 52, 0, 52, C06_SILL);
      // sill + wall below (the dado in shade)
      g = c.createLinearGradient(0, C06_SILL, 0, H); g.addColorStop(0, '#8d7766'); g.addColorStop(0.08, '#6e5c51'); g.addColorStop(1, '#3c312d');
      c.fillStyle = g; c.fillRect(0, C06_SILL, W, H - C06_SILL);
      c.fillStyle = '#f7e7cf'; c.fillRect(0, C06_SILL - 6, C06_PIER, 12);                // the sill's lit top edge
      // pier: a plain painted column, unlit, a little warm from the bounce of the floor
      g = c.createLinearGradient(C06_PIER, 0, W, 0); g.addColorStop(0, '#7a6658'); g.addColorStop(0.06, '#5a4a42'); g.addColorStop(0.5, '#4a3d38'); g.addColorStop(1, '#3a302d');
      c.fillStyle = g; c.fillRect(C06_PIER, 0, W - C06_PIER, C06_SILL + 4);
      g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(10,8,14,0.22)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.1)');
      c.fillStyle = g; c.fillRect(C06_PIER, 0, W - C06_PIER, H);
      // warm bounce from the sunlit floor licking up the dado and the foot of the pier
      g = c.createLinearGradient(0, H, 0, C06_SILL); g.addColorStop(0, 'rgba(201,167,125,0.28)'); g.addColorStop(1, 'rgba(201,167,125,0)');
      c.fillStyle = g; c.fillRect(0, C06_SILL, W, H - C06_SILL);
      if (L.paper) L.paper(c, 0.05, 31);
      // the reveal of the window (the pier's edge) catches the sun: a thin bright vertical line
      g = c.createLinearGradient(C06_PIER - 10, 0, C06_PIER + 14, 0); g.addColorStop(0, 'rgba(255,240,214,0)'); g.addColorStop(0.5, 'rgba(255,240,214,0.85)'); g.addColorStop(1, 'rgba(255,240,214,0)');
      c.fillStyle = g; c.fillRect(C06_PIER - 10, 0, 24, C06_SILL);
    });
  }
  // the sheer lace curtain over the window beside him (unmirrored x 320..1040 = screen 880..1600 after the flip), lit
  // from behind: the folds read as warm-white light and soft lavender shade, and where it hangs below the sill it
  // glows against the dark dado. `gust` 0..1 fills it with wind: the cloth bellies, its lower half sails up and out
  // toward the open window, the hem flutters, and the folds by his shoulder part to let the sun through.
  function c06Curtain(ctx, t, gust) {
    const xF = 320, xN = 1040, top = -40, NS = 52, NV = 16;      // xF: the free edge (u=0) .. xN: by his shoulder (u=1)
    const hem0 = C06_SILL + 135;
    const P = (u, v) => {
      const gv = Math.pow(v, 1.45);
      const flutter = Math.sin(t * 7.2 + u * 9 + v * 3) * 8 * gust * v;
      const x = lerp(xF, xN, u) + Math.sin(t * 0.7 + u * 5 + v * 2) * 5 * v
        - gust * 250 * gv * (0.3 + 0.7 * (1 - u)) - gust * 70 * gv * Math.sin(PI * u) + flutter;
      const y = lerp(top, hem0 + 10 * Math.sin(u * 17 + t * 1.3), v) - gust * 210 * v * v * (0.45 + 0.55 * (1 - u)) + 0.5 * flutter;
      return [x, y];
    };
    const fold = (u) => 0.5 + 0.5 * Math.sin(u * 9.5 * TAU * 0.5 + 0.4 + gust * 1.4 * Math.sin(t * 2.2 + u * 3) + 0.2 * Math.sin(t * 0.9 + u * 11));
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, C06_PIER - 2, H); ctx.clip();
    for (let i = 0; i < NS; i++) {
      const u0 = i / NS, u1 = (i + 1) / NS, um = (u0 + u1) / 2;
      ctx.beginPath();
      for (let j = 0; j <= NV; j++) { const q = P(u0, j / NV); if (j) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
      for (let j = NV; j >= 0; j--) { const q = P(u1 + 0.004, j / NV); ctx.lineTo(q[0], q[1]); }
      ctx.closePath();
      const f = fold(um), sh = Math.pow(1 - f, 1.6);
      const a0 = P(um, 0), a1 = P(um, 1);
      const sill = clamp((C06_SILL - a0[1]) / (a1[1] - a0[1]));
      const g = ctx.createLinearGradient(0, a0[1], 0, a1[1]);
      // against the sky: lit folds glow warm, shaded folds cool lavender; below the sill: the cloth glows on the dado
      const up = PV.mix('#fffaf0', '#b8b4c6', sh * 0.8), low = PV.mix('#fbf0e2', '#9a92a2', sh * 0.75);
      const aU = 0.34 + 0.4 * sh + 0.12 * gust, aL = 0.62 + 0.18 * f + 0.1 * gust;
      g.addColorStop(0, up.replace(/,[\d.]+\)$/, `,${(aU * 0.75).toFixed(3)})`));
      g.addColorStop(Math.max(0, sill - 0.015), up.replace(/,[\d.]+\)$/, `,${aU.toFixed(3)})`));
      g.addColorStop(Math.min(1, sill + 0.015), low.replace(/,[\d.]+\)$/, `,${aL.toFixed(3)})`));
      g.addColorStop(1, low.replace(/,[\d.]+\)$/, `,${(aL * 0.9).toFixed(3)})`));
      ctx.fillStyle = g; ctx.fill();
    }
    // the lace band along the hem: a brighter border with a scalloped edge
    ctx.lineJoin = 'round';
    ctx.beginPath(); for (let i = 0; i <= NS; i++) { const q = P(i / NS, 0.965); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    ctx.strokeStyle = 'rgba(255,250,240,0.5)'; ctx.lineWidth = 9; ctx.stroke();
    ctx.fillStyle = 'rgba(255,248,236,0.7)';
    for (let i = 0; i < 64; i++) { const q = P((i + 0.5) / 64, 1); ctx.beginPath(); ctx.arc(q[0], q[1] - 2, 6.5, 0, PI); ctx.fill(); }
    // the free edge catches the sun when it lifts (a bright selvedge)
    ctx.beginPath(); for (let j = 0; j <= NV; j++) { const q = P(0, j / NV); if (j) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    ctx.strokeStyle = `rgba(255,248,232,${(0.3 + 0.55 * gust).toFixed(3)})`; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
  function c06Rays() {
    return PV.cached('g02:c06rays', W, H, (c) => {
      L.godRays(c, 18.0, { x: 420, y: -120, angle: 1.0, spread: 0.32, count: 6, length: 1500, width: 120, flare: 2.2, alpha: 0.24, color: '#fff1d6', seed: 66, flicker: 0, mode: 'source-over' });
    });
  }
  // A local chair pose for the close juice shots (C05 far, C06 bust): the library's seated_chair 'juice' variant without
  // its own carton and hand (both are made for small figures: at a 350 px head the hand reads as a mitten and the carton as
  // stacked cubes). The scene draws the pack in his hand itself (juiceInHand). Registered only for the duration of a call.
  const SIP_POSE = 'g02_sip';
  const sipPose = {
    facing: '3q_left', anchor: 'top centre of the chair seat', armsFront: true,
    body(sp, prm, tq, o, OF) { return A().FIG_POSES.seated_chair.body(sp, Object.assign({}, prm, { variant: 'juice' }), tq, o, OF); },
    limbs(J, sp, prm, tq, o, OF) {
      const r = A().FIG_POSES.seated_chair.limbs(J, sp, Object.assign({}, prm, { variant: 'juice' }), tq, o, OF);
      if (prm.ownHand) r.arms.R.hand = { hidden: true };
      return r;
    },
    props(G, prm, tq, o) { if (prm.chair !== false) A().FIG_POSES.seated_chair.props(G, Object.assign({}, prm, { variant: 'idle' }), tq, o); },
  };
  function withSipPose(fn) {
    const P = A().FIG_POSES, had = Object.prototype.hasOwnProperty.call(P, SIP_POSE), old = P[SIP_POSE];
    P[SIP_POSE] = sipPose;
    try { return fn(); } finally { if (had) P[SIP_POSE] = old; else delete P[SIP_POSE]; }
  }
  // The 200 ml pack in his right hand at close range (anime shorthand: the hand behind the pack, four fingertips wrapping its
  // front edge, the thumb on the other edge), orange with two white bands like g01's pack on his thigh. o: wrist [x,y],
  // mouth [x,y], s (head px), k (0 = at his lips .. 1 = lowered), light, side (+1: fingers on the screen-left edge)
  function juiceInHand(c, o) {
    const s = o.s, h = 0.44 * s, w = h * 0.58, d = h * 0.24, k = clamp(o.k);
    const mB = A().mat('carton_band', o.light), mW = A().mat('carton', o.light), mS = A().mat('straw', o.light);
    const sk = A().mat('skin', A().faceLight(o.light));
    const lw = Math.max(1, A().inkW(s) * 0.62), sd = o.side || 1;
    // the pack stands on the hand: centre a little above the wrist, tilted toward his lips while he sips
    const tilt = lerp(-0.22 * sd, 0.06 * sd, k);
    const cx = o.wrist[0] + Math.sin(tilt) * 0.2 * s, cy = o.wrist[1] - Math.cos(tilt) * 0.2 * s;
    c.save(); c.translate(cx, cy); c.rotate(tilt); c.lineJoin = 'round'; c.lineCap = 'round';
    const quad = (pts, fill) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fillStyle = fill; c.fill(); };
    const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, dx = d * sd, dy = -d * 0.45;
    // back of the hand peeking out behind the pack (the palm side away from us)
    c.fillStyle = sk.shade; c.strokeStyle = sk.line; c.lineWidth = lw;
    c.beginPath(); c.ellipse(-sd * w * 0.32, h * 0.18, w * 0.5, h * 0.36, 0.12 * sd, 0, TAU); c.fill(); c.stroke();
    // the pack: side face, front face with its two white bands, the gable top, the straw
    const sx0 = sd > 0 ? x1 : x0;
    quad([[sx0, y0], [sx0 + dx, y0 + dy], [sx0 + dx, y1 + dy], [sx0, y1]], mB.shade);
    quad([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], mB.base);
    for (const [a, b] of [[0.07, 0.3], [0.6, 0.8]]) {
      quad([[x0, y0 + h * a], [x1, y0 + h * a], [x1, y0 + h * b], [x0, y0 + h * b]], mW.base);
      quad([[sx0, y0 + h * a], [sx0 + dx, y0 + h * a + dy], [sx0 + dx, y0 + h * b + dy], [sx0, y0 + h * b]], mW.shade);
    }
    quad([[x0, y0], [x0 + dx, y0 + dy], [x1 + dx, y0 + dy], [x1, y0]], mB.hi);
    c.strokeStyle = mB.line; c.lineWidth = lw; c.beginPath();
    c.moveTo(x0, y1); c.lineTo(x0, y0); c.lineTo(x0 + dx, y0 + dy); c.lineTo(x1 + dx, y0 + dy); c.lineTo(x1 + dx, y1 + dy); c.lineTo(x1, y1); c.closePath();
    c.moveTo(sx0, y0); c.lineTo(sx0, y1); c.moveTo(x0, y0); c.lineTo(x1, y0); c.stroke();
    c.restore();
    // the straw: from the top toward his lips (sipping) or standing up (lowered)
    const top = [cx + Math.sin(tilt) * h * 0.5 + Math.cos(tilt) * w * 0.18 * sd, cy - Math.cos(tilt) * h * 0.5 + Math.sin(tilt) * w * 0.18 * sd];
    const toMouth = Math.atan2(o.mouth[1] - top[1], o.mouth[0] - top[0]), up = -PI / 2 + tilt + 0.25 * sd;
    const ang = lerp(toMouth, up, sm(0.15, 0.6, k)), len = lerp(Math.hypot(o.mouth[0] - top[0], o.mouth[1] - top[1]) + 0.01 * s, 0.17 * s, sm(0.15, 0.6, k));
    const tip = [top[0] + Math.cos(ang) * len, top[1] + Math.sin(ang) * len];
    c.save(); c.lineCap = 'round';
    c.strokeStyle = mS.line; c.lineWidth = 0.034 * s + lw; c.beginPath(); c.moveTo(top[0], top[1]); c.lineTo(tip[0], tip[1]); c.stroke();
    c.strokeStyle = mS.base; c.lineWidth = 0.034 * s - lw * 0.4; c.stroke();
    c.restore();
    // fingers wrapping the front: four fingertips down one edge, the thumb on the other
    c.save(); c.translate(cx, cy); c.rotate(tilt);
    const fx = -sd * w * 0.5, tip4 = [[-0.16, 0.95], [0.02, 1.0], [0.2, 0.96], [0.37, 0.86]];
    for (let i = 0; i < 4; i++) {
      const [fy, fl] = tip4[i], yy = fy * h, ww = 0.075 * s * fl, hh = 0.05 * s * fl;
      c.beginPath(); c.ellipse(fx + sd * ww * 0.55, yy, ww, hh, 0.08 * sd, 0, TAU);
      c.fillStyle = sk.base; c.fill(); c.strokeStyle = sk.line; c.lineWidth = lw * 0.9; c.stroke();
      c.beginPath(); c.ellipse(fx + sd * ww * 0.95, yy - hh * 0.05, ww * 0.32, hh * 0.55, 0, 0, TAU); c.fillStyle = A().mixHex(sk.base, sk.hi, 0.5); c.fill();   // nail
    }
    // thumb along the far edge, its tip over the top band
    const tx = sd * w * 0.5;
    c.beginPath(); c.ellipse(tx - sd * 0.035 * s, -h * 0.05, 0.05 * s, 0.11 * s, -0.1 * sd, 0, TAU);
    c.fillStyle = sk.base; c.fill(); c.strokeStyle = sk.line; c.lineWidth = lw * 0.9; c.stroke();
    c.restore();
    return { top, tip };
  }
  // 彼 in C06: a bust, 3/4, seated by the pier (the window and its curtain behind him on the light side). Placed by the neck
  // point (measured), in the DIR=+1 frame: x is mirrored by sX(), the facing by DIR.
  const C06_BOY = { x: 1230, y: 640, size: 400, facing: -0.78 };
  function c06BoyArgs(T, p, h) {
    const base = { who: 'boy', outfit: 'uniform', pose: SIP_POSE, facing: C06_BOY.facing * DIR, scale: C06_BOY.size, T, light: C05_LIGHT,
      rimDir: sAng(-2.62), keyDir: sAng(PI + 0.25), rimA: 0, wind: 0.08, windDir: sAng(0),
      params: { sip: 1, chair: false, nod: 0.02, ownHand: true },
      head: { expr: 'neutral', lightDir: sAng(PI + 0.12), shade: 0.6, rimW: 1.4, faceLift: 1, blinkOffset: 1.85 } };
    const nk = withSipPose(() => probeNeck('c06boy', base));
    const o = Object.assign({}, base, { x: sX(C06_BOY.x) - nk[0], y: C06_BOY.y - nk[1] });
    o.params = Object.assign({}, base.params, p); o.head = Object.assign({}, base.head, h);
    return o;
  }
  PV.shot('C06', { draw(ctx, t, d, S) { drawC06(ctx, t, d, S); } });
  function drawC06(ctx, t, d, S) {
    const tt = clamp(t, -0.5, d + 0.5);
    const T = absT(S, 'C06', tt);
    S.post = Object.assign({}, S.post, { bloom: 0.18 });      // a bright close-up: keep the thin eye lines crisp
    const gust = sm(18.35, 18.75, T) * (1 - sm(19.0, 19.75, T));                  // curtain fills 18.6

    // background plate + the living curtain + sun through it (the room plates are mirrored with the geography)
    ctx.drawImage(onTwos('c06bg', tt, 1 / 24, (c, q) => {
      const Tq = absT(S, 'C06', q);
      const gq = sm(18.35, 18.75, Tq) * (1 - sm(19.0, 19.75, Tq));
      inDir(c, (c2) => {
        c2.drawImage(c06Back(), 0, 0);
        c06Curtain(c2, Tq, gq);
        L.glow(c2, 520, 110, 980, '#fff6e2', 0.55 + 0.25 * gq);
        c2.save(); c2.globalCompositeOperation = 'screen'; c2.globalAlpha = clamp((0.12 + 0.12 * gq) / 0.24 * (0.92 + 0.08 * Math.sin(Tq * 2.1))); c2.drawImage(c06Rays(), 0, 0); c2.restore();
      });
    }), 0, 0);

    // the boy, acting on twos (painted into a buffer, so the passing light can be clipped to him)
    // speech beats (V02, absolute): え？ 16.54–16.71 / だって 17.17–17.46 / 今のはミスなかった 17.88–18.33 / じゃん 18.6–19.0; gust 18.6
    let info = null;
    const figC = onTwos('c06fig', tt, 0, (c, q) => {
      const Tq = absT(S, 'C06', q);
      const lowerK = PV.ease.inOutCubic(clamp((Tq - (16.4 + 0.02)) / 0.42));       // the straw leaves his lips
      const eh = bell(Tq, 16.64, 0.16);                                              // "え？" — blank, brows up, chin up a little
      const nod = bell(Tq, 18.05, 0.3), jan = sm(18.6, 18.95, Tq) * (1 - sm(19.6, 19.9, Tq));
      const smile = sm(17.75, 18.45, Tq);                                            // the easy half-smile grows while he says it
      const gq = sm(18.35, 18.75, Tq) * (1 - sm(19.0, 19.75, Tq));
      const lp = lips(Tq, 'boy', 0);
      const o = c06BoyArgs(Tq, { sip: lerp(0.7, 0.34, lowerK), nod: 0.08 - 0.1 * eh + 0.07 * nod - 0.02 * jan, tilt: 0.03 * jan * DIR },
        { expr: smile > 0.5 ? 'gentle' : 'neutral', talk: lp.talk, mouth: Object.assign({ asym: -0.75 * smile }, lp.mouth || {}),
          eyes: { look: [0.3 * -DIR, -0.04 - 0.05 * eh], open: lerp(1, 0.84, smile) + 0.4 * eh },
          brows: { inner: 0.5 * eh + 0.1 * smile, outer: 0.45 * eh }, blush: 0.06 + 0.06 * smile, hair: { wind: 0.08 + 0.6 * gq, windDir: sAng(0) } });
      info = withSipPose(() => A().figure(c, o));
      if (info && info.head && info.head.mouth) juiceInHand(c, { wrist: info.hands.R, mouth: info.head.mouth, s: C06_BOY.size, k: lowerK, light: C05_LIGHT, side: DIR });
    });
    // joint positions on this frame's drawing (cheap: re-run only when the twos drawing changed)
    if (info) C06_INFO.v = info;
    const J = C06_INFO.v;
    const fb = PV.buffer('g02:c06fig'); fb.ctx.clearRect(0, 0, W, H); fb.ctx.drawImage(figC, 0, 0);
    // light strokes his shoulder as the curtain fills: a sunbeam slips through the opening folds and slides over
    // his shoulder (window side -> away). On the white shirt it is bright; in the air it is a faint shaft.
    const sweep = clamp((T - 18.48) / 0.9);
    const beam = sweep > 0 && sweep < 1 ? Math.pow(Math.sin(PI * sweep), 1.2) : 0;
    let beamFn = null, beamBox = null, beamLine = null;
    if (beam > 0 && J) {
      // over his near shoulder (the window-side one hides behind his chest in 3/4)
      const sL = J.shoulders.L, sR = J.shoulders.R, nearS = (sL[0] - sR[0]) * DIR > 0 ? sL : sR;
      const sx = nearS[0] + 0.04 * C06_BOY.size * DIR, sy = nearS[1] - 0.02 * C06_BOY.size;
      const bxp = sx + DIR * lerp(-150, 190, PV.ease.inOutCubic(sweep));            // where the beam crosses the shoulder line
      const ang = sAng(0.92);                                                         // beam direction (down, away from the window)
      beamLine = [bxp, sy + 10, ang];
      beamFn = (c, wHalf, aCore, col, fade) => {
        c.save(); c.translate(bxp, sy + 10); c.rotate(ang - PI / 2);
        const g = c.createLinearGradient(-wHalf, 0, wHalf, 0);
        g.addColorStop(0, PV.rgba(col, 0)); g.addColorStop(0.5, PV.rgba(col, aCore)); g.addColorStop(1, PV.rgba(col, 0));
        c.fillStyle = g; c.fillRect(-wHalf, -1400, wHalf * 2, 2800);
        if (fade) { // the shaft fades along its length away from the shoulder (cut by the curtain above, lost in the shade below)
          c.globalCompositeOperation = 'destination-out';
          const gl = c.createLinearGradient(0, -900, 0, 900);
          gl.addColorStop(0, 'rgba(0,0,0,1)'); gl.addColorStop(0.38, 'rgba(0,0,0,0)'); gl.addColorStop(0.58, 'rgba(0,0,0,0)'); gl.addColorStop(0.82, 'rgba(0,0,0,1)');
          c.fillStyle = gl; c.fillRect(-wHalf - 2, -900, wHalf * 2 + 4, 1800);
        }
        c.restore();
      };
      // the lit patch on his shirt: the beam, limited to the shoulder / upper arm, laid only on his figure
      const bx0 = Math.max(0, Math.floor(sx - 300)), by0 = Math.max(0, Math.floor(sy - 300)), bw = 620, bh = 620;
      const lb = PV.buffer('g02:c06light'); const lc = lb.ctx; lc.clearRect(bx0, by0, bw, bh);
      lc.save(); lc.beginPath(); lc.rect(bx0, by0, bw, bh); lc.clip();
      beamFn(lc, 95, 0.8 * beam, '#ffe9c8', false);
      lc.globalCompositeOperation = 'destination-in';
      const g = lc.createRadialGradient(sx + 15 * DIR, sy + 25, 60, sx + 15 * DIR, sy + 25, 270); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g; lc.fillRect(bx0, by0, bw, bh); lc.restore();
      const fc = fb.ctx; fc.save(); fc.globalCompositeOperation = 'source-atop'; fc.drawImage(lb.canvas, bx0, by0, bw, bh, bx0, by0, bw, bh); fc.restore();
      beamBox = [bx0, by0, bw, bh];
    }
    ctx.drawImage(fb.canvas, 0, 0);
    if (beamFn) {
      const bb = PV.buffer('g02:c06beam'); const ax0 = Math.max(0, beamBox[0] - 400), ay0 = 0, aw = Math.min(W - ax0, 1420), ah = H;
      bb.ctx.clearRect(ax0, ay0, aw, ah); bb.ctx.save(); bb.ctx.beginPath(); bb.ctx.rect(ax0, ay0, aw, ah); bb.ctx.clip();
      beamFn(bb.ctx, 120, 0.22 * beam, '#fff0d6', true); beamFn(bb.ctx, 40, 0.2 * beam, '#fff6e6', true); bb.ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.drawImage(bb.canvas, ax0, ay0, aw, ah, ax0, ay0, aw, ah); ctx.restore();
      // motes caught in the beam glitter against his shirt
      const [lx, ly, la] = beamLine, sa = Math.sin(la), ca = Math.cos(la);
      L.dust(ctx, T, { seed: 64, count: 150, x0: lx - 420, x1: lx + 420, y0: ly - 420, y1: ly + 420, size: 3.2, alpha: 0.95 * beam, color: '#fff6e4', drift: 30, vx: 18 * DIR, vy: 10,
        mask: (x, y) => clamp(1.2 - Math.abs((x - lx) * sa - (y - ly) * ca) / 85) * clamp(1.4 - Math.hypot(x - lx, y - ly) / 330) });
    }
    // dust in the window light; the gust stirs it toward him
    const wx0 = Math.min(sX(40), sX(1250)), wx1 = Math.max(sX(40), sX(1250));
    L.dust(ctx, T, { seed: 61, count: 90, x0: wx0, x1: wx1, y0: 30, y1: 900, size: 2.8, alpha: 0.85, color: '#fff2da', drift: 50, vx: (5 + 70 * gust) * DIR, vy: -4 - 10 * gust,
      mask: (x, y) => clamp(((DIR > 0 ? C06_PIER - 120 - x : x - (W - C06_PIER + 120))) / 160) * clamp((C06_SILL + 120 - y) / 200) });
    L.bokeh(ctx, T, { seed: 62, count: 10, x0: Math.min(sX(80), sX(1100)), x1: Math.max(sX(80), sX(1100)), y0: 120, y1: 760, rmin: 14, rmax: 34, alpha: 0.16, colors: ['#fff6e6', '#ffe8c8'], wobble: 16 });
    // the subtitle sits on the dark dado: keep the lowest band calm
    const g = ctx.createLinearGradient(0, H * 0.8, 0, H); g.addColorStop(0, 'rgba(20,14,12,0)'); g.addColorStop(1, 'rgba(20,14,12,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.8, W, H * 0.2);
  }
  const C06_INFO = { v: null };

  /* =====================================================================================================
   * C07 — 「頭の中を埋め尽くしていた楽譜が、一斉に、消えた。真っ白な世界。」
   *   19.9 the notes peel off the page all at once and rise as golden light → 20.4 warm white (the saving white:
   *   golden motes, no vignette) → a tear falls in slow motion → 21.25 it lands on A4 and the key dips (the tear
   *   plays the note), glints and splashes → the colour comes back from that point outward, into spring
   * ===================================================================================================== */
  const KX_A4 = 28.5 * 23.5;                 // A4 (the tear's note) — centre of the white key, mm along the keyboard
  const C07_KEYS = { focus: 48, cam: { eye: [KX_A4 + 6, 40, -120], tgt: [KX_A4, 0, 60], fov: 38 },
    light: { az: -0.85, el: 0.55, color: '#fff0d8', k: 1.25 }, ambient: '#b8a898', ivory: '#f7f1e6' };
  const C07_LAND = 21.25;
  // the engine's documented per-shot post control (S.post): the saving white must reach the corners, so the
  // vignette fades out while the frame is white and comes back with the colour
  function postOverride(S, over) {
    if (!S) return;
    if (!S._g02post) S._g02post = Object.assign({}, S.post || {});
    S.post = Object.assign({}, S._g02post, over);
  }
  function baseVignette(S) {
    const own = (S && S._g02post) || {}, tl = (PV.timeline && PV.timeline.post) || {};
    if (own.vignette !== undefined) return own.vignette;
    if (tl.vignette !== undefined) return tl.vignette;
    return PV.postDefaults && PV.postDefaults.vignette !== undefined ? PV.postDefaults.vignette : 0.45;
  }
  // the tear: a clear, almost round drop (drawn out a little while it falls). Against the white it reads by its
  // refraction — a cool soft rim, a bright core, the warm light gathered at its foot — and by the window it
  // mirrors as a tiny four-pane highlight
  function tearDrop(ctx, x, y, r, stretch, a) {
    if (a <= 0.003 || r <= 0.3) return;
    const rx = r / Math.sqrt(stretch), ry = r * stretch;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= Math.min(1, a);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    let g = ctx.createRadialGradient(-rx * 0.12, -ry * 0.18, r * 0.05, 0, 0, Math.max(rx, ry));
    g.addColorStop(0, 'rgba(255,255,255,0.6)'); g.addColorStop(0.55, 'rgba(228,236,246,0.45)'); g.addColorStop(0.84, 'rgba(160,176,202,0.62)'); g.addColorStop(1, 'rgba(104,120,148,0.92)');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    // the world seen through it, upside down: a dim band (the far, darker side) across the upper half
    g = ctx.createLinearGradient(0, -ry, 0, ry); g.addColorStop(0, 'rgba(126,112,104,0)'); g.addColorStop(0.3, 'rgba(126,112,104,0.26)'); g.addColorStop(0.52, 'rgba(126,112,104,0)');
    ctx.fillStyle = g; ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    // warm caustic at the foot
    g = ctx.createRadialGradient(rx * 0.1, ry * 0.58, 0, rx * 0.1, ry * 0.58, r * 0.62);
    g.addColorStop(0, 'rgba(255,238,200,0.95)'); g.addColorStop(1, 'rgba(255,236,196,0)');
    ctx.fillStyle = g; ctx.fillRect(-rx, 0, rx * 2, ry);
    ctx.restore();
    ctx.lineWidth = Math.max(0.8, r * 0.05);
    ctx.strokeStyle = 'rgba(92,108,138,0.55)'; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0.3, 2.7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.95, ry * 0.95, 0, 3.7, 5.1); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    if (r > 7) {   // the window it mirrors
      const pw = r * 0.13, ph = r * 0.17, gp = r * 0.035;
      ctx.save(); ctx.translate(-rx * 0.5, -ry * 0.52); ctx.rotate(-0.22);
      for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { ctx.beginPath(); ctx.roundRect(i * (pw + gp), j * (ph + gp), pw, ph, r * 0.03); ctx.fill(); }
      ctx.restore();
      ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.ellipse(rx * 0.42, ry * 0.5, r * 0.09, r * 0.05, -0.6, 0, TAU); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(-rx * 0.35, -ry * 0.35, r * 0.3, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // a 4-point glint with a soft halo
  function glint(ctx, x, y, r, a, rot0 = 0.3) {
    if (a <= 0.003) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot0);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.9); g.addColorStop(0, `rgba(255,236,190,${(0.85 * a).toFixed(3)})`); g.addColorStop(0.3, `rgba(255,214,150,${(0.35 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
    for (const [ang, len, wd] of [[0, 1, 0.04], [PI / 2, 0.8, 0.036], [PI / 4, 0.35, 0.028], [-PI / 4, 0.35, 0.028]]) {
      ctx.save(); ctx.rotate(ang);
      const sg = ctx.createLinearGradient(-r * len * 1.6, 0, r * len * 1.6, 0);
      sg.addColorStop(0, 'rgba(255,220,160,0)'); sg.addColorStop(0.5, `rgba(255,232,186,${a.toFixed(3)})`); sg.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, 0, r * len * 1.6, r * wd, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(0, 0, r * 0.06, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // golden motes (the "saving white" keeps its light particles)
  function moteSprite() {
    return PV.cached('g02:mote', 64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(232,178,96,1)'); g.addColorStop(0.35, 'rgba(242,198,128,0.46)'); g.addColorStop(1, 'rgba(250,220,170,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
  }
  function hotSprite() {   // a mote of light: white-hot core, gold halo (added with 'lighter')
    return PV.cached('g02:hot', 96, 96, (c) => {
      const g = c.createRadialGradient(48, 48, 0, 48, 48, 48);
      g.addColorStop(0, 'rgba(255,250,232,1)'); g.addColorStop(0.1, 'rgba(255,228,160,0.95)'); g.addColorStop(0.36, 'rgba(236,176,84,0.34)'); g.addColorStop(1, 'rgba(236,176,84,0)');
      c.fillStyle = g; c.fillRect(0, 0, 96, 96);
    });
  }
  function whiteMotes(ctx, T, a) {
    if (a <= 0.01) return;
    const r = PV.rng(707), spr = moteSprite();
    ctx.save();
    for (let i = 0; i < 90; i++) {
      const x0 = r() * W, y0 = r() * H, sp = 28 + r() * 70, sz = 2 + Math.pow(r(), 2) * 10, ph = r() * TAU, tws = 2 + r() * 3, star = r() < 0.18;
      const y = ((y0 - (T - 19.9) * sp) % (H + 60) + H + 60) % (H + 60) - 30, x = x0 + Math.sin(T * 0.8 + ph) * 18;
      const tw = 0.5 + 0.5 * Math.sin(T * tws + ph);
      ctx.globalAlpha = Math.min(1, 0.7 * a * tw); ctx.drawImage(spr, x - sz * 3, y - sz * 3, sz * 6, sz * 6);
      if (star && tw > 0.6) { ctx.globalAlpha = 1; glint(ctx, x, y, sz * 5, 0.5 * a * (tw - 0.6) / 0.4, 0.2 + i); }
    }
    ctx.restore();
  }
  // the notes turned to light: golden glitter born all over the page, rising and drawn into streaks as it speeds up.
  // Every random value is drawn up front, so a mote keeps its identity from frame to frame.
  function goldSprite() {   // a gold flake (source-over: reads as gold even on the cream paper)
    return PV.cached('g02:goldflake', 64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(250,214,140,1)'); g.addColorStop(0.3, 'rgba(222,160,70,0.85)'); g.addColorStop(0.62, 'rgba(214,150,62,0.25)'); g.addColorStop(1, 'rgba(214,150,62,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
  }
  function peelMotes(ctx, T, k) {
    if (k <= 0.01) return;
    const r = PV.rng(1990), spr = goldSprite(), hot = hotSprite();
    ctx.save();
    for (let i = 0; i < 200; i++) {
      const x0 = r() * W, y0 = 20 + r() * (H - 20), tb = 20.01 + 0.27 * Math.pow(r(), 1.25), sp = 160 + r() * 320, ph = r() * TAU, drift = (r() - 0.5) * 140, sz = 3 + r() * 6, tw = 9 + r() * 8;
      const a = T - tb; if (a <= 0) continue;
      const v = sp * (1 + 2.2 * a), y = y0 - sp * (a + 1.1 * a * a);
      if (y < -80) continue;
      const x = x0 + drift * a + Math.sin(a * 4 + ph) * 10 * Math.min(1, a * 3);
      const life = sm(0, 0.05, a) * (1 - sm(0.4, 0.8, a)), twk = 0.7 + 0.3 * Math.sin(T * tw + ph);
      const s = sz * (0.6 + 0.7 * sm(0, 0.2, a)), st = 1 + Math.min(2.2, v / 400);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, 0.9 * k * life);
      ctx.drawImage(spr, x - s * 2, y - s * 2 * st, s * 4, s * 4 * st);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, 0.7 * k * life * twk);
      ctx.drawImage(hot, x - s, y - s * st, s * 2, s * 2 * st);
    }
    ctx.restore();
  }
  // the page, painted once by the library and split (once, per pixel) into four layers — the paper without ink, the
  // notes as gold, the staff lines, the notes as ink — so the notes can turn to gold in place, lift off and fly
  // toward the lens as light while the empty staves stay behind and fade (「楽譜が、一斉に、消えた」)
  const C07_SHEET = { x: 1060, y: 1080, w: 2350, rot: -0.035, skewX: -0.05, scaleY: 0.9, dissolve: 0, seed: 9, light: { angle: -2.35 } };
  function c07PageLayers() {
    return PV.cached('g02:c07layers', W, H * 4, (c) => {
      const pg = PV.makeCanvas(W, H); pg.ctx.fillStyle = '#16110e'; pg.ctx.fillRect(0, 0, W, H); L.sheetMusic(pg.ctx, 0, C07_SHEET);
      const ink = PV.makeCanvas(W, H); ink.ctx.filter = 'grayscale(1) invert(1) brightness(1.6) contrast(4)'; ink.ctx.drawImage(pg.canvas, 0, 0); ink.ctx.filter = 'none';
      const P = pg.ctx.getImageData(0, 0, W, H).data, M = ink.ctx.getImageData(0, 0, W, H).data;
      // staff lines: level the page, keep long horizontal runs of ink, tilt back
      const lv = PV.makeCanvas(W, H); lv.ctx.translate(960, 540); lv.ctx.rotate(-C07_SHEET.rot); lv.ctx.translate(-960, -540); lv.ctx.drawImage(ink.canvas, 0, 0);
      const RD = lv.ctx.getImageData(0, 0, W, H).data, st = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < H; y++) {
        let x = 0;
        while (x < W) {
          if (RD[(y * W + x) * 4] < 60) { x++; continue; }
          let e = x, gap = 0; while (e < W && gap <= 3) { if (RD[(y * W + e) * 4] >= 60) gap = 0; else gap++; e++; }
          if (e - x > 190) for (let k = x; k < e; k++) { const i = (y * W + k) * 4; st[i] = st[i + 1] = st[i + 2] = 255; st[i + 3] = RD[i]; }
          x = e;
        }
      }
      const sl = PV.makeCanvas(W, H); sl.ctx.putImageData(new ImageData(st, W, H), 0, 0);
      const sb = PV.makeCanvas(W, H); sb.ctx.translate(960, 540); sb.ctx.rotate(C07_SHEET.rot); sb.ctx.translate(-960, -540); sb.ctx.filter = 'blur(0.6px)'; sb.ctx.drawImage(sl.canvas, 0, 0);
      const SD = sb.ctx.getImageData(0, 0, W, H).data;
      // the local paper colour under the ink (coarse grid of ink-free pixels, holes filled from the neighbours)
      const CS = 24, gw = Math.ceil(W / CS), gh = Math.ceil(H / CS), acc = new Float32Array(gw * gh * 4);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (M[i] > 20) continue; const g = ((y / CS | 0) * gw + (x / CS | 0)) * 4; acc[g] += P[i]; acc[g + 1] += P[i + 1]; acc[g + 2] += P[i + 2]; acc[g + 3]++; }
      const pc = new Float32Array(gw * gh * 3), ok = new Uint8Array(gw * gh);
      for (let k = 0; k < gw * gh; k++) if (acc[k * 4 + 3] > 8) { for (let j = 0; j < 3; j++) pc[k * 3 + j] = acc[k * 4 + j] / acc[k * 4 + 3]; ok[k] = 1; }
      for (let pass = 0; pass < 8; pass++) {
        for (let k = 0; k < gw * gh; k++) {
          if (ok[k]) continue;
          const gx = k % gw, gy = k / gw | 0; let n = 0; const s3 = [0, 0, 0];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = gx + dx, yy = gy + dy; if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue; const q = yy * gw + xx; if (ok[q] === 1) { n++; for (let j = 0; j < 3; j++) s3[j] += pc[q * 3 + j]; } }
          if (n) { for (let j = 0; j < 3; j++) pc[k * 3 + j] = s3[j] / n; ok[k] = 2; }
        }
        for (let k = 0; k < gw * gh; k++) if (ok[k] === 2) ok[k] = 1;
      }
      const out = c.createImageData(W, H * 4), O = out.data, F = W * H * 4;
      for (let y = 0; y < H; y++) {
        const fy = clamp((y + 0.5) / CS - 0.5, 0, gh - 1), y0 = fy | 0, y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0;
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4, m = M[i] / 255, s = Math.min(m, SD[i + 3] / 255 * 1.15), nm = Math.max(0, m - s);
          const fx = clamp((x + 0.5) / CS - 0.5, 0, gw - 1), x0 = fx | 0, x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0, k = Math.min(1, m * 1.35);
          for (let j = 0; j < 3; j++) {
            const a = pc[(y0 * gw + x0) * 3 + j] * (1 - tx) + pc[(y0 * gw + x1) * 3 + j] * tx, b = pc[(y1 * gw + x0) * 3 + j] * (1 - tx) + pc[(y1 * gw + x1) * 3 + j] * tx;
            O[i + j] = P[i + j] + (a * (1 - ty) + b * ty - P[i + j]) * k; O[i + 2 * F + j] = P[i + j]; O[i + 3 * F + j] = P[i + j];
          }
          O[i + 3] = 255;
          O[i + F] = 226; O[i + F + 1] = 166; O[i + F + 2] = 80; O[i + F + 3] = Math.min(255, nm * 310);
          O[i + 2 * F + 3] = Math.min(255, s * 300); O[i + 3 * F + 3] = Math.min(255, nm * 300);
        }
      }
      c.putImageData(out, 0, 0);
    });
  }
  function c07PageGlow() {
    return PV.cached('g02:c07glow', W, H, (c) => { c.filter = 'blur(9px)'; c.drawImage(c07PageLayers(), 0, H, W, H, 0, 0, W, H); c.filter = 'none'; });
  }
  // the macro keyboard, painted once (the push-in is a 2-D zoom of this plate); the key the tear plays is redrawn live
  function c07KeysPlate() {
    return PV.cached('g02:c07keys', W, H, (c) => {
      c.fillStyle = '#1b1512'; c.fillRect(0, 0, W, H);
      L.keysClose(c, 0, Object.assign({}, C07_KEYS, { pressed: {} }));
      c07Lacquer(c);
    });
  }
  // the black lacquer behind the keys mirrors the window: a warm band
  function c07Lacquer(c) {
    const g = c.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, 'rgba(255,222,186,0.42)'); g.addColorStop(0.55, 'rgba(255,210,170,0.18)'); g.addColorStop(1, 'rgba(255,214,170,0)');
    c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = g; c.fillRect(0, 0, W, 440); c.restore();
  }
  // spring, mirrored in the lacquer and the black keys: soft sky, blossom pink and sunlit white (screen-added, so it
  // only shows on the dark surfaces)
  function c07SpringMirror() {
    return PV.cached('g02:c07spring', W, 520, (c) => {
      const r = PV.rng(2207);
      let g = c.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, 'rgba(150,198,240,0.85)'); g.addColorStop(0.45, 'rgba(200,222,242,0.5)'); g.addColorStop(1, 'rgba(255,240,226,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, 520);
      for (let i = 0; i < 26; i++) {
        const x = r() * W, y = 60 + r() * 300, rr = 60 + r() * 150, pink = r() < 0.65;
        g = c.createRadialGradient(x, y, 0, x, y, rr);
        g.addColorStop(0, pink ? `rgba(247,198,208,${(0.35 + 0.3 * r()).toFixed(3)})` : `rgba(255,246,230,${(0.3 + 0.3 * r()).toFixed(3)})`); g.addColorStop(1, 'rgba(247,198,208,0)');
        c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      c.globalCompositeOperation = 'destination-in';
      g = c.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, 520);
    });
  }
  PV.shot('C07', { draw(ctx, t, d, S) {
    const tt = clamp(t, -0.3, d + 0.8);
    const T = absT(S, 'C07', tt);
    const whiteK = sm(20.18, 20.4, T);                                     // the page burns to warm white by 20.4
    const unravel = smr(21.3, 22.15, T);                                   // white -> spring colour
    postOverride(S, { vignette: baseVignette(S) * (1 - sm(20.2, 20.4, T) * (1 - smr(21.3, 22.2, T))) });
    // ---- A: the page — the notes turn to gold, peel off all at once and fly up as light (19.9 -> 20.4)
    if (T < 20.46) {
      const push = 1.02 + 0.05 * smr(19.85, 20.45, T);
      const LY = c07PageLayers(), GL = c07PageGlow();
      ctx.save(); PV.camera(ctx, { zoom: push, cx: 980, cy: 520, x: -16 * smr(19.85, 20.45, T) });
      ctx.fillStyle = '#16110e'; ctx.fillRect(-100, -100, W + 200, H + 200);
      ctx.drawImage(LY, 0, 0, W, H, 0, 0, W, H);                                           // the paper
      const staffA = 1 - sm(20.08, 20.33, T);                                                 // the empty staves stay, then fade
      if (staffA > 0.004) { ctx.globalAlpha = staffA; ctx.drawImage(LY, 0, 2 * H, W, H, 0, 0, W, H); }
      const turn = sm(19.98, 20.05, T);                                                      // ink -> gold, in place (after a beat of the plain page)
      if (turn < 1) { ctx.globalAlpha = 1 - turn; ctx.drawImage(LY, 0, 3 * H, W, H, 0, 0, W, H); }
      ctx.globalAlpha = 1;
      // the notes lift off in columns at slightly different speeds, flying toward the lens and melting into light
      const NC = 40, cw = W / NC;
      for (let i = 0; i < NC; i++) {
        const sp = 0.7 + 0.6 * (0.5 + 0.5 * PV.noise2(i * 0.18, 3.1)), dl = 0.06 * (0.5 + 0.5 * PV.noise2(i * 0.25, 7.7));
        const a = Math.max(0, T - 20.03 - dl), lift = 1200 * sp * Math.pow(a, 1.5), z = 1 + 2.1 * a * a;
        const al = turn * (1 - sm(0.16, 0.38, a)); if (al <= 0.01) continue;
        const x0 = i * cw;
        ctx.save(); ctx.translate(960, 540 - lift); ctx.scale(z, z); ctx.translate(-960, -540);
        const sharp = al * (1 - sm(0.1, 0.32, a));
        if (sharp > 0.01) { ctx.globalAlpha = sharp; ctx.drawImage(LY, x0, H, cw + 1, H, x0, 0, cw + 1, H); }
        ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = Math.min(1, al * (0.45 + 0.8 * sm(0.02, 0.22, a))); ctx.drawImage(GL, x0, 0, cw + 1, H, x0, 0, cw + 1, H);
        ctx.restore();
      }
      ctx.restore();
      // warm afternoon light on the paper; it swells with the reverse swell (20.0-20.4) until the page is all light
      const sw = sm(19.95, 20.4, T);
      ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,206,150,0.6)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      const pg = ctx.createLinearGradient(260, 60, 1800, 1080); pg.addColorStop(0, 'rgba(60,40,24,0)'); pg.addColorStop(0.6, `rgba(60,40,24,${(0.08 * (1 - sw)).toFixed(3)})`); pg.addColorStop(1, `rgba(60,40,24,${(0.36 * (1 - sw)).toFixed(3)})`);
      ctx.fillStyle = pg; ctx.fillRect(0, 0, W, H);
      L.glow(ctx, 360, 90, 1300, '#fff1d6', 0.38 + 0.6 * sw);
      // his line ("…ミスなかったじゃん") is still on screen for the first beats: the lower page lies in its own soft
      // shadow until the subtitle has faded, so the white type keeps its contrast
      const subA = 1 - sm(20.0, 20.27, T);
      if (subA > 0.01) { const sg = ctx.createLinearGradient(0, 840, 0, H); sg.addColorStop(0, 'rgba(58,40,26,0)'); sg.addColorStop(1, `rgba(58,40,26,${(0.42 * subA).toFixed(3)})`); ctx.fillStyle = sg; ctx.fillRect(0, 840, W, H - 840); }
      peelMotes(ctx, T, 1 - 0.5 * whiteK);
      if (whiteK > 0) { ctx.save(); ctx.fillStyle = `rgba(255,250,240,${whiteK.toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    }
    // ---- the white world; through it, a white key (macro); then the colour comes back
    if (T >= 20.3) {
      const keysA = sm(20.3, 20.42, T);
      const push = 1.0 + 0.045 * smr(20.3, 22.6, T);
      // the tear plays A4: the key gives a little under it and comes back
      const dip = 0.12 * sm(C07_LAND - 0.02, C07_LAND + 0.07, T) * (1 - sm(C07_LAND + 0.3, C07_LAND + 0.95, T));
      const KO = Object.assign({}, C07_KEYS, { pressed: dip > 0.002 ? { 48: dip } : {} });
      ctx.save(); ctx.globalAlpha = keysA;
      ctx.save(); PV.camera(ctx, { zoom: push, cx: 960, cy: 560 });
      if (dip > 0.002) { ctx.fillStyle = '#1b1512'; ctx.fillRect(-60, -60, W + 120, H + 120); L.keysClose(ctx, 0, KO); c07Lacquer(ctx); }
      else ctx.drawImage(c07KeysPlate(), 0, 0);
      if (unravel > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = keysA * Math.min(1, 1.25 * unravel); ctx.drawImage(c07SpringMirror(), 0, 0); ctx.restore(); }
      L.bokeh(ctx, T, { seed: 77, count: 22, x0: 0, x1: W, y0: 0, y1: 300, rmin: 22, rmax: 70, alpha: 0.46, colors: ['#ffd2e2', '#d6eafc', '#fff1dc', '#f9c4d6'], wobble: 8 });
      ctx.restore();
      ctx.restore();
      // the white veil (warm, luminous). When the tear lands, the colour comes back from that point outward.
      const kp = L.keyPos(KO, 48);
      const hitX = 960 + (kp.x - 960) * push, hitY = 560 + (kp.y - 560) * push + 26 * push;
      const veil0 = (T < 20.4 ? 1 : lerp(1, 0.84, sm(20.4, 21.0, T)));
      const open = smr(C07_LAND, 22.2, T);                                  // radius of the opened colour, 0..1
      if (veil0 > 0.002 && open < 1) {
        const rad = lerp(0, 2300, open), soft = 260 + 500 * open;
        const vb = PV.buffer('g02:c07veil'); const vc = vb.ctx; vc.clearRect(0, 0, W, H);
        const g = vc.createRadialGradient(W / 2, H * 0.48, 80, W / 2, H / 2, W * 0.72);
        g.addColorStop(0, `rgba(255,255,255,${veil0.toFixed(3)})`); g.addColorStop(1, `rgba(255,246,230,${veil0.toFixed(3)})`);
        vc.fillStyle = g; vc.fillRect(0, 0, W, H);
        if (open > 0) {
          vc.globalCompositeOperation = 'destination-out';
          const hg = vc.createRadialGradient(hitX, hitY, Math.max(0, rad - soft), hitX, hitY, rad + 1);
          hg.addColorStop(0, `rgba(0,0,0,${(0.65 + 0.35 * open).toFixed(3)})`); hg.addColorStop(1, 'rgba(0,0,0,0)');
          vc.fillStyle = hg; vc.save(); vc.translate(hitX, hitY); vc.scale(1, 0.8); vc.translate(-hitX, -hitY); vc.fillRect(-W, -H, W * 3, H * 4); vc.restore();
          // and the whole veil thins, so the far corners warm up in time too
          vc.fillStyle = `rgba(0,0,0,${Math.min(1, 1.1 * unravel).toFixed(3)})`; vc.fillRect(0, 0, W, H);
          vc.globalCompositeOperation = 'source-over';
        }
        ctx.drawImage(vb.canvas, 0, 0);
      }
      whiteMotes(ctx, T, (1 - 0.5 * unravel) * sm(20.32, 20.6, T));
      // ---- the tear (slow), landing on A4 at 21.25
      const fall = clamp((T - 20.5) / (C07_LAND - 20.5));
      if (T < C07_LAND) {
        if (fall > 0) {
          const yy = lerp(-120, hitY - 40, PV.ease.inQuad(fall));
          const sh = sm(0.45, 1, fall);    // its shadow sharpens as it comes down
          ctx.save(); ctx.globalAlpha = 0.28 * sh; ctx.fillStyle = '#8a7a6c'; ctx.beginPath(); ctx.ellipse(hitX + 8, hitY + 6, 34 * sh + 8, 9 * sh + 2, 0, 0, TAU); ctx.fill(); ctx.restore();
          tearDrop(ctx, hitX, yy, 34, 1.04 + 0.05 * fall, clamp(fall * 6));
          glint(ctx, hitX - 12, yy - 14, 30, 0.3 + 0.15 * Math.sin(T * 18));
        }
      } else {
        const u = T - C07_LAND;
        // the drop flattens into a bead on the key
        const bead = sm(0, 0.05, u);
        ctx.save(); ctx.translate(hitX, hitY);
        const bw = 44 + 18 * sm(0, 0.22, u), bh = 12 + 4 * sm(0, 0.22, u);
        const bg = ctx.createRadialGradient(-bw * 0.2, -bh * 0.3, 1, 0, 0, bw);
        bg.addColorStop(0, 'rgba(255,255,255,0.85)'); bg.addColorStop(0.6, 'rgba(206,218,230,0.32)'); bg.addColorStop(1, 'rgba(128,140,160,0.55)');
        ctx.globalAlpha = bead; ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0, bw, bh, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(118,132,156,0.45)'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.ellipse(-bw * 0.35, -bh * 0.38, bw * 0.2, bh * 0.22, -0.1, 0, TAU); ctx.fill();
        ctx.restore();
        // a crown of droplets leaps up and falls back — in slow motion
        const r2 = PV.rng(2125);
        for (let i = 0; i < 11; i++) {
          const ang = -PI / 2 + (r2() - 0.5) * 2.5, v0 = 260 + r2() * 300, sz = 4 + r2() * 6.5, ts = u * 0.42;
          const x = hitX + Math.cos(ang) * v0 * ts * 1.5, y = hitY - 6 + Math.sin(ang) * v0 * ts + 0.5 * 1500 * ts * ts;
          if (y > hitY + 2 || ts > 0.6) continue;
          tearDrop(ctx, x, y, sz, 1.05, 0.95 * (1 - sm(0.35, 0.6, ts)));
        }
        // the glint (A4 sounds) and a ring of light running out over the key
        glint(ctx, hitX - 6, hitY - 10, 190, bell(u, 0.05, 0.1) * 1.0 + 0.3 * bell(u, 0.28, 0.25));
        const ring = sm(0, 0.95, u);
        if (ring < 1) { ctx.save(); ctx.strokeStyle = `rgba(255,214,160,${(0.6 * (1 - ring)).toFixed(3)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(hitX, hitY, 40 + 520 * ring, 10 + 120 * ring, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
      }
      // spring arrives with the colour: a warm sun from the upper left, a soft rosy grade, a light leak
      if (unravel > 0) {
        L.glow(ctx, 180, 30, 900, '#fff0d4', 0.5 * unravel);
        ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,198,172,${(0.28 * unravel).toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore();
        if (L.lightLeak) L.lightLeak(ctx, T, { side: 'left', amount: 0.28 * unravel, color: '#ffb98a', seed: 12 });
      }
    }
    // the flash peak itself (20.4): a breath of pure white
    const fl = bell(T, 20.41, 0.05);
    if (fl > 0.01) { ctx.fillStyle = `rgba(255,255,255,${(0.95 * fl).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  } });


  /* =====================================================================================================
   * C08 — セッション: split screen. Left = her right hand on the keys, right = his left hand on the fretboard.
   *   Only the side that plays is in the window light. 22.0 guitar answers → 23.5 piano → 25.0/25.75/26.5 faster →
   *   27.25 unison run (both glow) → 27.57 the seam flowers into light → the two of them, back-lit, side by side → 28.0
   * ===================================================================================================== */
  const SEAM_X = 960;
  // the M4 score (audio/compose_pv.py m3_m4), ♩=80, local seconds from 22.0:
  //   guitar 22.0 D4 / 22.375 C#4 / 22.75 A3 — piano 23.5 F#5 / 23.875 E5 / 24.25 D5 (held) — guitar 25.0 A4 / 25.375 B4 —
  //   piano 25.75 C#5 / 26.125 E5 — guitar 26.5 D5 / 26.875 C#5 — both 27.25 F#4 G4 A4 C#5 (16ths) → 28.0 the same chord
  const C08_G_WIN = [[0, 1.5], [3.0, 3.75], [4.5, 5.25]], C08_P_WIN = [[1.5, 3.0], [3.75, 4.5]], C08_UNI = 5.25;
  // piano: [onset, finger (0 thumb .. 4 little), envelope length s] — the fingering follows the line (a falling line walks
  // down the hand: ring, middle, index; the run climbs thumb, index, middle, little)
  const C08_PN = [[1.5, 3, 0.42], [1.875, 2, 0.42], [2.25, 1, 0.95], [3.75, 0, 0.42], [4.125, 2, 0.42],
    [5.25, 0, 0.24], [5.4375, 1, 0.24], [5.625, 2, 0.24], [5.8125, 4, 0.3]];
  // guitar: the hand shape of each phrase ([fret, string] for index..little; string 1 = high E) and its notes
  // [onset, finger 1..4, fret, string]. The fingers sit across the G / D strings so each one arches over the
  // fretboard (on the top strings they lie flat and read as a pointing finger); the frets follow the line
  // (a half step = one fret, a whole step = two).
  const C08_GSEG = [
    { t: -9, shape: [[5, 3], [6, 3], [7, 3], [8, 3]] },     // 5th position: D4 = G 7 (ring), C#4 = G 6 (middle), A3 = D 7 (ring)
    { t: 2.75, shape: [[7, 3], [8, 3], [9, 3], [10, 3]] },  // slides up to the 7th: A4 (index) -> B4 (ring), a whole step
    { t: 4.2, shape: [[7, 3], [8, 3], [9, 3], [10, 3]] },   // D5 (little) -> C#5 (ring); then the run index, middle, little, ring
  ];
  const C08_GN = [[0, 3, 7, 3], [0.375, 2, 6, 3], [0.75, 3, 7, 4], [3.0, 1, 7, 3], [3.375, 3, 9, 3], [4.5, 4, 10, 3], [4.875, 3, 9, 3],
    [5.25, 1, 7, 3], [5.4375, 2, 8, 3], [5.625, 4, 10, 3], [5.8125, 3, 9, 2]];
  function litOf(t, wins, uni) {
    let v = t >= uni - 0.06 ? sm(uni - 0.06, uni + 0.08, t) : 0;
    for (const [a, b] of wins) v = Math.max(v, sm(a - 0.07, a + 0.09, t) * (1 - sm(b - 0.05, b + 0.1, t)));
    return v;
  }
  // time spent in the light so far (for the lit side's slow push-in)
  function litTime(t, wins, uni) { let s = 0; for (const [a, b] of wins) s += clamp(t - a, 0, b - a); return s + Math.max(0, t - uni); }
  function pianoPress(t) {
    const best = [null, null, null, null, null];
    for (const [on, f, len] of C08_PN) { const v = L.handPressCurve((t - on) / len); if (best[f] === null || Math.abs(v) > Math.abs(best[f])) best[f] = v; }
    return best.map((v) => (v !== null && Math.abs(v) > 0.02 ? v : -0.15));
  }
  function guitarState(t) {
    let k = 0; for (let i = 0; i < C08_GSEG.length; i++) if (t >= C08_GSEG[i].t) k = i;
    const seg = C08_GSEG[k], prev = C08_GSEG[Math.max(0, k - 1)], mv = sm(seg.t, seg.t + 0.22, t);   // the hand slides between positions
    const segEnd = k + 1 < C08_GSEG.length ? C08_GSEG[k + 1].t : 1e9;
    const chord = seg.shape.map((p, i) => [lerp(prev.shape[i][0], p[0], mv), lerp(prev.shape[i][1], p[1], mv)]);
    const press = [1, 0.92, 0.92, 0.92, 0.92];
    let last = -9;
    for (const [on, f, fr, st] of C08_GN) {
      if (on < seg.t || on >= segEnd) continue;                   // only this phrase's notes move this shape
      if (t >= on - 0.14) chord[f - 1] = [fr, st];
      const lift = sm(on - 0.26, on - 0.13, t) * (1 - sm(on - 0.07, on, t));   // the finger lifts and comes down on its note
      press[f] = Math.min(press[f], 0.92 - 0.82 * lift);
      if (t >= on) last = Math.max(last, on);
    }
    return { chord, press, vib: last > -9 ? Math.exp(-(t - last) * 3.2) : 0 };
  }
  // panel plates (static per panel): the light comes from the window at the upper left
  function c08PlateL() {
    return PV.cached('g02:c08plateL', SEAM_X, H, (c) => {
      const g = c.createLinearGradient(0, 0, SEAM_X, H); g.addColorStop(0, '#f7e8d2'); g.addColorStop(0.5, '#ead2b0'); g.addColorStop(1, '#cfae86');
      c.fillStyle = g; c.fillRect(0, 0, SEAM_X, H);
      const r = PV.rng(808);
      for (let i = 0; i < 16; i++) { const x = r() * SEAM_X, y = 640 + r() * 440, rr = 40 + r() * 110; const gg = c.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, `rgba(255,246,228,${0.18 + r() * 0.2})`); gg.addColorStop(1, 'rgba(255,246,228,0)'); c.fillStyle = gg; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    });
  }
  function c08PlateR() {
    return PV.cached('g02:c08plateR2', SEAM_X, H, (c) => {
      // the room beyond the neck, far out of focus: window light above, the curtain's soft folds
      const g = c.createLinearGradient(0, 0, SEAM_X, H); g.addColorStop(0, '#f6efe4'); g.addColorStop(0.6, '#e6d9c8'); g.addColorStop(1, '#c4b098');
      c.fillStyle = g; c.fillRect(0, 0, SEAM_X, H);
      c.filter = 'blur(26px)';
      for (let i = 0; i < 7; i++) { c.strokeStyle = `rgba(160,146,134,${0.16 + 0.06 * (i % 2)})`; c.lineWidth = 40 + i * 6; c.beginPath(); c.moveTo(80 + i * 120, -40); c.quadraticCurveTo(220 + i * 110, 520, 120 + i * 140, H + 40); c.stroke(); }
      // the guitar's upper bout, where the neck joins the body (lower left: the 12th fret is at that end of the neck);
      // it is nearer the lens than the fretboard, so it is soft
      c.filter = 'blur(12px)';
      c.save(); c.translate(-150, 905); c.rotate(-0.25);
      c.fillStyle = '#4e3220'; c.beginPath(); c.ellipse(0, 0, 330, 300, 0, 0, TAU); c.fill();
      const sg = c.createRadialGradient(-60, -150, 30, 0, 0, 340); sg.addColorStop(0, '#ecc283'); sg.addColorStop(0.7, '#cf9452'); sg.addColorStop(1, '#a86a32');
      c.fillStyle = sg; c.beginPath(); c.ellipse(0, -14, 316, 286, 0, 0, TAU); c.fill();
      c.strokeStyle = '#f2e6cc'; c.lineWidth = 8; c.beginPath(); c.ellipse(0, -14, 312, 282, 0, 0, TAU); c.stroke();
      c.restore();
      c.filter = 'none';
    });
  }
  // a panel = plate + playing hand, then the light state over it (every frame). The hand acts on twos while its side
  // plays; a resting hand holds still, so its panel is keyed on the (quantised) pose alone and is reused until the
  // pose changes (the panel is always a pure function of its key: deterministic in any frame order).
  const C08Q = { L: { key: null }, R: { key: null } };
  const rq = (v, s) => Math.round(v / s) * s;
  function c08Panel(side, t) {
    const ph = side === 'L' ? 0 : 1 / 24;                          // the two panels repaint on alternate frames
    const q = Math.floor((t - ph) * 12 + 1e-6) / 12 + ph;          // hands act on twos
    const wins = side === 'L' ? C08_P_WIN : C08_G_WIN;
    const resting = litOf(q, wins, C08_UNI) <= 0.02;
    const zoom = rq(1 + 0.016 * litTime(q, wins, C08_UNI), 0.0005);   // the lit side creeps closer
    let key, pose;
    if (side === 'L') {
      pose = { press: pianoPress(q).map((v) => rq(v, 0.02)) };
      key = 'L' + pose.press.join(',');
    } else {
      const gs = guitarState(q);
      pose = { chord: gs.chord.map((p) => [rq(p[0], 0.01), rq(p[1], 0.01)]), press: gs.press.map((v) => rq(v, 0.02)), vib: gs.vib > 0.03 ? rq(gs.vib, 0.05) : 0 };
      key = 'R' + JSON.stringify(pose.chord) + pose.press.join(',') + '|' + pose.vib;
    }
    const live = !resting || pose.vib > 0;                        // a playing hand breathes; a ringing string shimmers
    key += '|' + zoom.toFixed(4) + (live ? '|' + q.toFixed(3) : '');
    const b = PV.buffer('g02:c08' + side, SEAM_X, H);
    if (C08Q[side].key === key) return b.canvas;
    C08Q[side].key = key;
    const tt = live ? q : 0;
    const c = b.ctx; c.clearRect(0, 0, SEAM_X, H);
    c.drawImage(side === 'L' ? c08PlateL() : c08PlateR(), 0, 0);
    c.save();
    c.translate(SEAM_X / 2, H / 2); c.scale(zoom, zoom); c.translate(-SEAM_X / 2, -H / 2);
    let fx, fy;
    if (side === 'L') {
      L.handOnKeys(c, { x: 470, y: 600, scale: 3.3, t: tt, breath: live ? 1 : 0, press: pose.press, az: 0.8, el: 0.55, light: -2.4, arm: 700, range: [-14, 14],
        sleeve: '#f6f3ee', sleeveAt: 72, keyColor: '#fff0d8', fillColor: '#b98f7a', tint: 0.45 });
      fx = 500; fy = 600;
    } else {
      L.handOnFrets(c, { x: 480, y: 560, scale: 3.3, t: tt, chord: pose.chord, press: pose.press, az: -0.5, el: 0.42, light: -2.3, fretFrom: 1, fretTo: 12, arm: 700,
        stringVib: 0.9 * pose.vib, keyColor: '#fff0d8', fillColor: '#a98a86', tint: 0.45 });
      fx = 520; fy = 560;
    }
    c.restore();
    // depth of field: the hand sharp, the far keys / neck ends and the room soften away from it
    const hw = SEAM_X / 2, hh = H / 2;
    const db = PV.buffer('g02:c08dof', hw, hh), dc = db.ctx;
    dc.clearRect(0, 0, hw, hh); dc.filter = 'blur(3.5px)'; dc.drawImage(b.canvas, 0, 0, hw, hh); dc.filter = 'none';
    dc.globalCompositeOperation = 'destination-in';
    const g = dc.createRadialGradient(fx / 2, fy / 2, 85, fx / 2, fy / 2, 310); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    dc.fillStyle = g; dc.fillRect(0, 0, hw, hh); dc.globalCompositeOperation = 'source-over';
    c.drawImage(db.canvas, 0, 0, SEAM_X, H);
    return b.canvas;
  }
  // light over a panel: lit = window light pours in from the upper left (rays, dust); dark = the light has left
  function c08Light(ctx, x0, lit, T, seed) {
    ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, SEAM_X, H); ctx.clip();
    const dark = 1 - lit;
    if (dark > 0.002) {
      // the resting side sinks into a cool shade (against the warm window light of the side that plays)
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(98,98,116,${(0.8 * dark).toFixed(3)})`; ctx.fillRect(x0, 0, SEAM_X, H);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(18,20,32,${(0.24 * dark).toFixed(3)})`; ctx.fillRect(x0, 0, SEAM_X, H);
    }
    if (lit > 0.002) {
      ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(x0 + 60, -60, 40, x0 + 160, 80, 1250);
      g.addColorStop(0, `rgba(255,236,204,${(0.75 * lit).toFixed(3)})`); g.addColorStop(0.45, `rgba(255,226,186,${(0.26 * lit).toFixed(3)})`); g.addColorStop(1, 'rgba(255,226,186,0)');
      ctx.fillStyle = g; ctx.fillRect(x0, 0, SEAM_X, H);
      // shafts slanting down to the right (window above-left)
      for (let i = 0; i < 4; i++) {
        const bx = x0 + 120 + i * 230 + 30 * Math.sin(T * 0.4 + i * 2 + seed), a = lit * (0.12 + 0.05 * Math.sin(T * 1.3 + i * 1.7 + seed));
        ctx.save(); ctx.translate(bx, 0); ctx.transform(1, 0, 0.55, 1, 0, 0);
        const sg = ctx.createLinearGradient(-60, 0, 60, 0); sg.addColorStop(0, 'rgba(255,240,214,0)'); sg.addColorStop(0.5, `rgba(255,240,214,${a.toFixed(3)})`); sg.addColorStop(1, 'rgba(255,240,214,0)');
        ctx.fillStyle = sg; ctx.fillRect(-60 - 40 * i, 0, 120 + 80 * i, H); ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
      L.dust(ctx, T, { seed: 81 + seed, count: 46, x0, x1: x0 + SEAM_X, y0: 0, y1: H, size: 2.8, alpha: 0.9 * lit, color: '#fff3dc', drift: 46, vx: 6, vy: -5 });
    }
    ctx.restore();
  }
  // ---- the picture they land in: the music room against the window, her at the piano (left), him with the acoustic
  // (right) — they turn to each other and smile (彼: crescent eyes; 先輩: the full smile, a little of the upper teeth).
  // The room and the piano are painted once; the two of them act on twos over it; the camera pulls back a touch.
  const C08_WIDE_CAM = { camX: -0.8, camZ: -1.05, camY: -0.08, lookY: -0.08 };
  const C08_SEAT = { her: [5.62, 0.5, 4.62], him: [7.85, 0.45, 4.3] };
  const C08_PLACE = {};
  function c08WidePlate() {
    return PV.cached('g02:c08wide4', W, H, (c) => {
      const T = 27.75;
      const R = L.musicRoom(c, T, Object.assign({ view: 'windows', time: 'noon', furniture: 'none', wind: 0.6, shaft: 1.7 }, C08_WIDE_CAM));
      L.grandPiano(c, R.piano(5.75, 3.35, 1.32, { lidOpen: 1, bench: false, rimLit: { alpha: 1 } }));
      for (const k of ['her', 'him']) {
        const p = C08_SEAT[k], a = R.project(p), b = R.project([p[0], p[1] + 1, p[2]]);
        C08_PLACE[k] = { x: a[0], y: a[1], pxm: a[1] - b[1] };
      }
    });
  }
  // the two of them at global time T (on twos), each into its own frame-size buffer in the plate's coordinates (he repaints
  // on even frames, she on odd ones: one figure per frame)
  function c08Him(c, T) {
    c08WidePlate();
    const P = C08_PLACE, look = sm(27.5, 27.7, T), hisSmile = sm(27.58, 27.8, T);
    // 彼 on the chair at the right, the school acoustic on his thigh, turned to her; his laugh closes the eyes into crescents
    A().figure(c, { who: 'boy', outfit: 'uniform', pose: 'seated_chair', facing: -0.86, camPitch: 0.05, x: P.him.x, y: P.him.y, scale: P.him.pxm * 0.244, T, light: C05_LIGHT,
      rimDir: -1.75, params: { variant: 'guitar', headDown: -0.22 * look, strum: 0.4 },
      head: { expr: hisSmile > 0.5 ? 'smile' : 'gentle', turn: -0.12 * look, eyes: { look: [-0.6, 0.05] }, mouth: { shape: 'smile', open: 0.28 * hisSmile }, blush: 0.2 + 0.12 * hisSmile,
        lightDir: -1.3, shade: 0.07, faceLift: 1, rim: 0.8 } });
  }
  function c08Her(c, T) {
    c08WidePlate();
    const P = C08_PLACE, look = sm(27.5, 27.7, T), smile = sm(27.6, 27.86, T);
    // 先輩 at the piano (her back to us, facing the keys), her head turned over her right shoulder to him; the full smile
    A().figure(c, { who: 'senpai', outfit: 'uniform', pose: 'piano', facing: PI - 0.38, camPitch: 0.05, x: P.her.x, y: P.her.y, scale: P.her.pxm * 0.23, T, light: C05_LIGHT,
      rimDir: -1.35, params: { intensity: 0.3, keys: false, bench: true, look: 'ahead' },
      head: { expr: smile > 0.5 ? 'smile' : 'gentle', turn: -1.08 * lerp(0.7, 1, look), eyes: { look: [0.5, 0.05], smile: 0.55 * smile }, mouth: { shape: 'smile', open: 0.32 * smile }, blush: 0.25 + 0.15 * smile,
        lightDir: -1.6, shade: 0.07, faceLift: 1, rim: 0.8, hair: { wind: 0.3, windDir: PI * 0.95 } } });
  }
  function c08Wide(ctx, T, lt) {
    const k = clamp((lt - 5.45) / 0.6);
    const him = onTwos('c08him', T, 0, (c, q) => c08Him(c, q)), her = onTwos('c08her', T, 1 / 24, (c, q) => c08Her(c, q));
    ctx.save(); PV.camera(ctx, { zoom: 1.055 - 0.035 * PV.ease.outCubic(k), cx: 920, cy: 600 });
    ctx.drawImage(c08WidePlate(), 0, 0);
    ctx.drawImage(him, 0, 0); ctx.drawImage(her, 0, 0);
    ctx.restore();
    // the window light between them, dust turning in it
    L.glow(ctx, 1000, 330, 760, '#fff6e4', 0.42);
    L.dust(ctx, T, { seed: 88, count: 60, x0: 560, x1: 1500, y0: 120, y1: 900, size: 2.6, alpha: 0.8, color: '#fff3dc', drift: 40, vx: 5, vy: -4 });
  }
  PV.shot('C08', { draw(ctx, t, d, S) {
    const tt = clamp(t, -0.2, d + 0.3);
    const T = absT(S, 'C08', tt);
    const lt = T - 22.0;                                          // musical time (beats are written from 22.0)
    const litG = litOf(lt, C08_G_WIN, C08_UNI), litP = litOf(lt, C08_P_WIN, C08_UNI);
    const melt = sm(5.42, 5.64, lt);                              // the seam melts, the split gives way to the one picture
    const wideK = sm(5.5, 5.66, lt);
    if (wideK < 1) {
      // left panel (piano) — her side; right panel (guitar) — his side
      ctx.drawImage(c08Panel('L', lt), 0, 0);
      ctx.drawImage(c08Panel('R', lt), SEAM_X, 0);
      c08Light(ctx, 0, litP, T, 0);
      c08Light(ctx, SEAM_X, litG, T, 3);
    }
    if (wideK > 0) { ctx.save(); ctx.globalAlpha = wideK; c08Wide(ctx, T, lt); ctx.restore(); }
    // the seam: a thin thread of light; it brightens on each hand-over, swells on the unison, then flowers into a flare
    const hand = [1.5, 3.0, 3.75, 4.5, 5.25].reduce((m, x) => Math.max(m, bell(lt, x, 0.09)), 0);
    const swell = sm(5.0, 5.5, lt), bloom = bell(lt, 5.57, 0.085);
    const seamA = (0.5 + 0.5 * hand + 0.5 * swell) * (1 - wideK) + bloom;
    if (seamA > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const wv = 2 + 3 * hand + 10 * swell + 160 * bloom + 60 * melt;
      let g = ctx.createLinearGradient(SEAM_X - wv * 4, 0, SEAM_X + wv * 4, 0);
      g.addColorStop(0, 'rgba(255,236,200,0)'); g.addColorStop(0.5, `rgba(255,244,222,${Math.min(1, 0.85 * seamA).toFixed(3)})`); g.addColorStop(1, 'rgba(255,236,200,0)');
      ctx.fillStyle = g; ctx.fillRect(SEAM_X - wv * 4, 0, wv * 8, H);
      ctx.fillStyle = `rgba(255,252,244,${Math.min(1, seamA * (1 - melt)).toFixed(3)})`; ctx.fillRect(SEAM_X - 1.5, 0, 3, H);
      ctx.restore();
      if (bloom > 0.02) {
        L.flare(ctx, SEAM_X, 470, 1.25 * bloom, '#ffe6b8');
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        g = ctx.createRadialGradient(SEAM_X, 470, 0, SEAM_X, 470, 1100 * (0.4 + bloom));
        g.addColorStop(0, `rgba(255,240,210,${(0.9 * bloom).toFixed(3)})`); g.addColorStop(0.5, `rgba(255,222,170,${(0.45 * bloom).toFixed(3)})`); g.addColorStop(1, 'rgba(255,222,170,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
    }
  } });


})();

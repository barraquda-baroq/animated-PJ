/* g03_singing_piano — ACT1 セッションの日々: C09 / C10 / C11 / C12
 *   C09 (28.0–31.0) 真上からの手元：膝の上で差し出された彼の左手（弦の跡）。彼女の右手の人差し指がためらいながら近づき、
 *                    29.6 に指先の跡へ触れる。触れた点に淡い光、くすぐったそうに彼の指がわずかに動く。
 *                    ピント送り：彼女の指先 → 彼の指先（深度でぼけ分け）
 *   C10 (31.0–34.5) 窓辺のグランドピアノで旋律を歌う先輩の後ろ姿。金色に縁取られる髪、旋律に合わせて揺れる肩、
 *                    大きく膨らむカーテン、窓の外で舞い上がる花びら。C02 の冷たい〈霰〉を、暖色の柔らかい
 *                    音符の花びらに反転させてゆっくり漂わせる。背後から右へ回り込みつつ上昇（彼女の体の向き＋手前の層の視差）
 *   C11 (34.5–36.5) アコギのネックを支える彼の左手の極端なアップ（マクロの被写界深度）。34.9 に指が弦に食い込み、手が震える。
 *                    35.6 に涙の滴が画面の上から横切り、ティルトダウンで追うと陽だまりの床に 35.75 に落ちて
 *                    スローで小さく弾ける
 *   C12 (36.5–40.5) 窓の逆光の引き。ピアノの脇に立つ先輩（左）と、ギターを膝に俯く少年（右）が、俯いて向かい合う。
 *                    窓の向こうで枝が風に揺れ、光の帯の中を塵がゆっくり落ちる。ごく遅いプッシュイン
 * Event times are storyboard seconds converted with the real shot start (solo previews fall back to the
 * storyboard start), so the picture stays locked to the sound if the edit moves a cut.
 * Deterministic: every frame is a pure function of t (caches only memoise static artwork).
 */
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, TAU = Math.PI * 2, PI = Math.PI, HP = Math.PI / 2;
  const clamp = PV.clamp, lerp = PV.lerp, sm = PV.smooth, smr = PV.smoother, N2 = PV.noise2, R1 = PV.rand1;
  const SB = { C09: 28.0, C10: 31.0, C11: 34.5, C12: 36.5 };
  const localT = (S, id, t) => ((S && S.start > 0.01) ? S.start - SB[id] : 0) + t;
  const bell = (x, c, w) => Math.exp(-((x - c) / w) * ((x - c) / w));
  const ID = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

  /* ===================================================================== utils */
  // downscale a full-frame canvas to q (no filter), then blur it at that size (blurring while scaling is slow in Skia)
  function lowBlur(src, q, px, key) {
    const w = Math.round(W * q), h = Math.round(H * q);
    const a = PV.buffer('g03:lbA' + (key || '') + q, w, h); a.ctx.clearRect(0, 0, w, h); a.ctx.imageSmoothingQuality = 'medium'; a.ctx.drawImage(src, 0, 0, w, h);
    if (px * q < 0.25) return a.canvas;
    const b = PV.buffer('g03:lbB' + (key || '') + q, w, h); b.ctx.clearRect(0, 0, w, h); b.ctx.filter = 'blur(' + (px * q).toFixed(2) + 'px)'; b.ctx.drawImage(a.canvas, 0, 0); b.ctx.filter = 'none';
    return b.canvas;
  }
  // bounding box (device px) of a hand rig incl. its forearm/sleeve
  function rigBox(rig, pad) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const add = (p) => { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; };
    for (const j of rig.joints) for (const p of j) add(p);
    for (const p of rig.tips) add(p); add(rig.wrist);
    const V = L._handMath.V, arm = rig.o.arm == null ? 320 : rig.o.arm;
    add(rig.P(V(0, arm + 50, 0))); add(rig.P(V(-70, arm, 0))); add(rig.P(V(70, arm, 0))); add(rig.P(V(-70, 0, 0))); add(rig.P(V(70, 0, 0)));
    return [Math.max(0, Math.floor(x0 - pad)), Math.max(0, Math.floor(y0 - pad)), Math.min(W, Math.ceil(x1 + pad)), Math.min(H, Math.ceil(y1 + pad))];
  }
  // copy a region of a full-frame canvas onto ctx, optionally blurred (at low res), recoloured, offset, with a blend op
  function regionBlit(ctx, src, box, px, o) {
    o = o || {};
    const x0 = box[0], y0 = box[1], w = box[2] - box[0], h = box[3] - box[1]; if (w < 2 || h < 2) return;
    const dx = o.dx || 0, dy = o.dy || 0;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; if (o.op) ctx.globalCompositeOperation = o.op;
    if (px < 0.3 && !o.tint) { ctx.drawImage(src, x0, y0, w, h, x0 + dx, y0 + dy, w, h); ctx.restore(); return; }
    const q = px > 5 ? 0.25 : 0.5, pd = Math.ceil(px * 2.6) + 2, X0 = x0 - pd, Y0 = y0 - pd, Wd = w + 2 * pd, Hd = h + 2 * pd;
    const sw = Math.ceil(Wd * q), sh = Math.ceil(Hd * q);
    const a = PV.buffer('g03:rA', 1100, 660), b = PV.buffer('g03:rB', 1100, 660);
    a.ctx.clearRect(0, 0, sw + 2, sh + 2); a.ctx.imageSmoothingQuality = 'low'; a.ctx.drawImage(src, X0, Y0, Wd, Hd, 0, 0, sw, sh);
    b.ctx.clearRect(0, 0, sw + 2, sh + 2);
    if (px >= 0.3) b.ctx.filter = 'blur(' + (px * q).toFixed(2) + 'px)';
    b.ctx.drawImage(a.canvas, 0, 0, sw, sh, 0, 0, sw, sh); b.ctx.filter = 'none';
    if (o.tint) { b.ctx.globalCompositeOperation = 'source-in'; b.ctx.fillStyle = o.tint; b.ctx.fillRect(0, 0, sw + 2, sh + 2); b.ctx.globalCompositeOperation = 'source-over'; }
    ctx.imageSmoothingQuality = 'low'; ctx.drawImage(b.canvas, 0, 0, sw, sh, X0 + dx, Y0 + dy, Wd, Hd);
    ctx.restore();
  }
  function radial(c, x, y, r, stops) { const g = c.createRadialGradient(x, y, 0, x, y, r); for (const [k, col] of stops) g.addColorStop(k, col); return g; }
  function glowAt(ctx, x, y, r, col, a) { if (a <= 0.002) return; ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = radial(ctx, x, y, r, [[0, PV.rgba(col, a)], [0.3, PV.rgba(col, a * 0.42)], [1, PV.rgba(col, 0)]]); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); }
  // a soft warm mote sprite (light grain)
  function spriteMote() {
    return PV.cached('g03:mote', 64, 64, (c) => {
      c.fillStyle = radial(c, 32, 32, 32, [[0, 'rgba(255,253,244,1)'], [0.12, 'rgba(255,243,214,0.92)'], [0.34, 'rgba(255,220,168,0.34)'], [1, 'rgba(255,205,140,0)']]);
      c.fillRect(0, 0, 64, 64);
    });
  }
  /* ========================================================================== C09
   * Overhead, his left palm held up over his lap (a callus on every fingertip). Her right forefinger comes in from
   * above-left, stops a breath short of him, and touches the middle fingertip at 29.6 (= 1.6 local).
   * Depth: her hand is above his (closer to the lens) -> rack focus from her fingertip to his. */
  const C09 = { cx: 900, cy: 492, sc: 2.72, ang: -0.18, touch: 1.6, twitch: 1.82, stroke: [2.15, 2.95] };
  const HM = L._handMath;
  function rigAt(o, m, x, y, fn) {
    const probe = L.handRig(Object.assign({}, o, { x: 0, y: 0, _m: ID }));
    const q = fn(probe);
    return L.handRig(Object.assign({}, o, { x: x - q.x, y: y - q.y, _m: m }));
  }
  const tipPoint = (rig, i) => { const ch = rig.chains[i]; return rig.P(HM.sub(ch.P[3], HM.mul(ch.D[2], ch.rad[3] * 0.35))); };
  const padPoint = (rig, i) => L._handPadPoint(rig, i);
  const SKIN = { keyColor: '#fff2da', fillColor: '#e0b4a2', tint: 0.5, light: -2.3 };
  function c09HisOpts(t, k) {   // k: 0..1 the ticklish flinch
    return Object.assign({ side: 'L', kind: 'him', view: 'palm', pitch: -0.12, scale: C09.sc, rot: -0.42 + C09.ang + 0.012 * k,
      curl: [0.14 + 0.03 * k, 0.1 + 0.05 * k, 0.1 + 0.085 * k, 0.14 + 0.06 * k, 0.2 + 0.04 * k], spread: 0.3 - 0.025 * k, calluses: true, arm: 330, t, tremble: 0.08, seed: 2,
      sleeve: '#f3f0ea', sleeveAt: 150 }, SKIN);
  }
  function c09HerOpts(t, rot, tremble) {
    return Object.assign({ side: 'R', kind: 'her', view: 'back', pitch: 0.42, yaw: 0.12, scale: C09.sc * 1.04, rot, curl: [0.32, 0.06, 0.4, 0.56, 0.64], spread: 0.12, arm: 330, t, tremble, seed: 5,
      sleeve: '#f6f3ee', sleeveAt: 72 }, SKIN);
  }
  // how far her fingertip still is from his (1 = hovering, 0 = touching): approach, a held breath, the touch
  function c09Gap(u) {
    if (u < 0.55) return 1;
    if (u < 1.32) return lerp(1, 0.13, PV.ease.inOutCubic((u - 0.55) / 0.77));
    if (u < 1.44) return 0.13 - 0.02 * sm(1.32, 1.44, u);
    return lerp(0.11, 0, PV.ease.inOut(clamp((u - 1.44) / (C09.touch - 1.44))));
  }
  function c09Twitch(u) { return sm(C09.twitch, C09.twitch + 0.1, u) * (1 - sm(C09.twitch + 0.25, C09.twitch + 0.75, u)); }
  // the lap ~20 cm below the hands, far out of focus: his school trousers along the forearm (the top of the thigh
  // catching the window light, the crease toward his other knee in shade), her navy pleats at the lower left.
  // Kept warm and light (soft spring afternoon) so the skin and the white cuffs still read against it.
  function c09Plate() {
    return PV.cached('g03:c09plate:v5', W / 4, H / 4, (c) => {
      const q = 0.5, b = PV.makeCanvas(W * q, H * q), p = b.ctx; p.scale(q, q);
      const d = [Math.sin(-0.42 + C09.ang), -Math.cos(-0.42 + C09.ang)], r = [-d[1], d[0]];   // d: toward his knee, r: toward his right
      const O = [1105, 790];                                                                       // under his palm
      const P = (s, o) => [O[0] + d[0] * s + r[0] * o, O[1] + d[1] * s + r[1] * o];
      const stroke = (a, e, w, col, mid) => { p.strokeStyle = col; p.lineWidth = w; p.beginPath(); p.moveTo(a[0], a[1]); if (mid) p.quadraticCurveTo(mid[0], mid[1], e[0], e[1]); else p.lineTo(e[0], e[1]); p.stroke(); };
      p.lineCap = 'round';
      // base: lit from the window at the upper left, falling into a soft plum shade at the lower right
      p.fillStyle = PV.linGrad(p, 0, 0, W, H, [[0, '#f7e6cb'], [0.3, '#dcc2a2'], [0.6, '#9d8a84'], [1, '#4c4a58']]); p.fillRect(0, 0, W, H);
      // his other thigh beyond the crease (upper right): a step deeper in shade (charcoal school trousers)
      p.globalAlpha = 0.5; stroke(P(-1400, 640), P(900, 600), 520, '#6a6470'); p.globalAlpha = 1;
      // the crease between his knees
      stroke(P(-1500, 360), P(800, 340), 150, 'rgba(48,38,52,0.55)', P(-300, 390));
      // the top of the thigh under the hand catching the light (a long soft ridge), its far flank rolling into shade
      stroke(P(-1500, -60), P(560, -40), 330, 'rgba(226,206,186,0.55)', P(-400, -90));
      stroke(P(-1500, 200), P(560, 190), 160, 'rgba(92,74,84,0.35)', P(-400, 210));
      // big soft folds of the cloth at the knee and down the thigh
      stroke(P(420, -330), P(250, 340), 120, 'rgba(96,74,80,0.2)', P(470, 20)); stroke(P(-700, -300), P(-930, 330), 160, 'rgba(96,74,80,0.16)', P(-640, 40));
      // her navy pleats at the lower left (she sits close at his left)
      p.save(); p.beginPath(); { const A0 = P(-1500, -520), A1 = P(1200, -560), A2 = P(1200, -2000), A3 = P(-1500, -2000); p.moveTo(A0[0], A0[1]); p.quadraticCurveTo(...P(-200, -470), A1[0], A1[1]); p.lineTo(A2[0], A2[1]); p.lineTo(A3[0], A3[1]); p.closePath(); }
      p.fillStyle = '#525a7c'; p.fill(); p.clip();
      for (let i = 0; i < 9; i++) { const o = -560 - i * 120; stroke(P(-1500, o), P(1200, o - 40), 50, i % 2 ? 'rgba(130,140,180,0.45)' : 'rgba(30,34,62,0.45)'); }
      p.fillStyle = PV.linGrad(p, 0, 0, W, H, [[0, 'rgba(255,232,200,0.45)'], [0.5, 'rgba(255,232,200,0.1)'], [1, 'rgba(40,40,70,0.3)']]); p.fillRect(0, 0, W, H);
      p.restore();
      // the window light across the lap + a warm haze leaking in from the window side
      p.globalCompositeOperation = 'soft-light';
      p.fillStyle = PV.linGrad(p, 0, 0, W, H, [[0, 'rgba(255,228,184,0.9)'], [0.5, 'rgba(255,220,176,0.45)'], [1, 'rgba(90,64,90,0.35)']]); p.fillRect(0, 0, W, H);
      p.globalCompositeOperation = 'screen';
      p.fillStyle = radial(p, 160, 40, 1250, [[0, 'rgba(255,236,206,0.6)'], [0.45, 'rgba(255,226,186,0.2)'], [1, 'rgba(255,226,186,0)']]); p.fillRect(0, 0, W, H);
      p.globalCompositeOperation = 'source-over';
      c.filter = 'blur(6px)'; c.drawImage(b.canvas, 0, 0, W * q, H * q, -8, -8, W / 4 + 16, H / 4 + 16); c.filter = 'none';
    });
  }
  // moving window light: lace-curtain dapple drifting across the lap (soft-light, on the quarter-res background)
  function c09Dapple(c, u, a) {
    const spr = PV.cached('g03:c09dapple2', W / 4, H / 4, (cc) => {
      const r = PV.rng(919);
      for (let i = 0; i < 26; i++) {
        const x = r() * W / 4, y = r() * H / 4, rr = 16 + r() * 42;
        cc.fillStyle = radial(cc, x, y, rr, [[0, 'rgba(255,238,206,0.8)'], [1, 'rgba(255,238,206,0)']]); cc.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
    });
    c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = a;
    const dx = 50 * Math.sin(u * 0.33) + u * 26, dy = 26 * Math.sin(u * 0.27 + 1);
    c.drawImage(spr, (-140 + dx) / 4, (-90 + dy) / 4, (W + 280) / 4, (H + 180) / 4);
    c.restore();
  }
  PV.shot('C09', { draw(ctx, t, d, S) {
    const tt = clamp(t, -0.3, d + 0.3), u = localT(S, 'C09', tt);
    // camera: static overhead, creeping in toward the touch (and his calluses) as she reaches him
    const zoom = 1 + 0.065 * smr(0, 3.2, u), CX = C09.cx, CY = C09.cy;
    const m = { a: zoom, b: 0, c: 0, d: zoom, e: CX - CX * zoom, f: CY - CY * zoom };
    // ---- rigs: his palm (the ticklish flinch keeps the wrist where it is), her hand placed by its fingertip
    const tw = c09Twitch(u);
    const hisRest = rigAt(c09HisOpts(u, 0), m, CX, CY, (r) => padPoint(r, 2));
    const his = tw > 0.002 ? L.handRig(Object.assign({}, c09HisOpts(u, tw), { x: hisRest.o.x, y: hisRest.o.y, _m: m })) : hisRest;
    const p0 = padPoint(hisRest, 2), p1 = tw > 0.002 ? padPoint(his, 2) : p0;
    const pad = { x: lerp(p0.x, p1.x, 0.75), y: lerp(p0.y, p1.y, 0.75) };      // her fingertip follows his, a beat behind
    const g = c09Gap(u);
    const ha = 2.55 + C09.ang, dist = g * 118 * C09.sc * zoom;
    // after the touch: the fingertip strokes the callus a little toward his nail
    const strokeK = sm(C09.stroke[0], C09.stroke[1], u), fdir = [Math.sin(-0.42 + C09.ang), -Math.cos(-0.42 + C09.ang)];
    const lift = 4 * tw;
    const cx = pad.x - Math.sin(ha) * (dist + lift) + fdir[0] * 12 * strokeK, cy = pad.y + Math.cos(ha) * (dist + lift) + fdir[1] * 12 * strokeK;
    const her = rigAt(c09HerOpts(u, ha, 0.22 + 0.3 * (1 - g) * (u < C09.touch ? 1 : 0.35)), ID, cx, cy, (r) => tipPoint(r, 1));
    // ---- hands into their own layers (region-limited work only)
    const boxHis = rigBox(his, 40), boxHer = rigBox(her, 40);
    // (cleared whole: later passes read around her fingertip beyond the hand's box, which must not see an older frame)
    const A = PV.buffer('g03:c09his'); A.ctx.clearRect(0, 0, W, H); L.handRender(A.ctx, [his], { pad: 30 });
    const B = PV.buffer('g03:c09her'); B.ctx.clearRect(0, 0, W, H); L.handRender(B.ctx, [her], { pad: 30 });
    // ---- 1) the lap (out of focus), window dapple and the hands' shadows on the cloth, all at quarter resolution
    {
      const q = 0.25, w = W * q, h = H * q, S0 = PV.buffer('g03:c09bg', w, h), c = S0.ctx;
      c.drawImage(c09Plate(), 0, 0);
      c09Dapple(c, u, 0.5);
      const hh = 60 + 70 * g;   // her hand is higher: a wider, softer, fainter shadow
      const sh = PV.buffer('g03:c09shq', w, h), sc = sh.ctx;
      sc.clearRect(0, 0, w, h); sc.imageSmoothingQuality = 'low';
      sc.globalAlpha = 0.85; sc.drawImage(A.canvas, boxHis[0], boxHis[1], boxHis[2] - boxHis[0], boxHis[3] - boxHis[1], (boxHis[0] + 34) * q, (boxHis[1] + 44) * q, (boxHis[2] - boxHis[0]) * q, (boxHis[3] - boxHis[1]) * q);
      sc.globalAlpha = 0.62; sc.drawImage(B.canvas, boxHer[0], boxHer[1], boxHer[2] - boxHer[0], boxHer[3] - boxHer[1], (boxHer[0] + 0.67 * hh) * q, (boxHer[1] + 0.75 * hh) * q, (boxHer[2] - boxHer[0]) * q, (boxHer[3] - boxHer[1]) * q);
      sc.globalAlpha = 1;
      const sb = PV.buffer('g03:c09shb', w, h), sbc = sb.ctx;
      sbc.clearRect(0, 0, w, h); sbc.filter = 'blur(' + (7.5 + 2 * g).toFixed(2) + 'px)'; sbc.drawImage(sh.canvas, 0, 0); sbc.filter = 'none';
      sbc.globalCompositeOperation = 'source-in'; sbc.fillStyle = '#3a2228'; sbc.fillRect(0, 0, w, h); sbc.globalCompositeOperation = 'source-over';
      c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.5; c.drawImage(sb.canvas, 0, 0); c.restore();
      ctx.save(); PV.camera(ctx, { zoom, cx: CX, cy: CY }); ctx.imageSmoothingQuality = 'low'; ctx.drawImage(S0.canvas, -2, -2, W + 4, H + 4); ctx.restore();
    }
    // ---- 2) her soft shadow on his palm (it closes in as she comes down), then his hand with its focus pull
    {
      const h = 10 + 46 * g, dx = 0.666 * h * her.unit, dy = 0.746 * h * her.unit, bl = (2 + 5 * g) * her.unit;
      const ov = [Math.max(boxHer[0], boxHis[0] - dx - bl), Math.max(boxHer[1], boxHis[1] - dy - bl), Math.min(boxHer[2], boxHis[2] - dx + bl), Math.min(boxHer[3], boxHis[3] - dy + bl)];
      if (ov[2] - ov[0] > 4 && ov[3] - ov[1] > 4) regionBlit(A.ctx, B.canvas, ov, bl, { dx, dy, tint: '#9b5f50', alpha: 0.34 - 0.12 * g, op: 'source-atop' });
    }
    const bHis = 6 * (1 - sm(0.8, 1.45, u));
    if (bHis < 1.6) regionBlit(ctx, A.canvas, boxHis, 0);
    if (bHis > 0.15) regionBlit(ctx, A.canvas, boxHis, Math.max(1.6, bHis), { alpha: bHis < 1.6 ? bHis / 1.6 : 1 });
    // ---- 3) her hand: sharp at first; as the focus drops to his palm her hand (higher, rising toward her elbow)
    //         goes soft, all but the fingertip, which arrives in the focal plane as it touches
    {
      const bHer = 7 * sm(0.85, 1.5, u);
      if (bHer < 1.6) regionBlit(ctx, B.canvas, boxHer, 0);
      if (bHer > 0.15) {
        regionBlit(ctx, B.canvas, boxHer, Math.max(1.6, bHer), { alpha: bHer < 1.6 ? bHer / 1.6 : 1 });
        const tip = tipPoint(her, 1), k = Math.pow(1 - g, 1.5) * sm(0.15, 1.6, bHer);
        if (k > 0.01) {
          const R0 = 300, x0 = Math.round(tip.x - R0), y0 = Math.round(tip.y - R0), rb = PV.buffer('g03:c09tip', R0 * 2, R0 * 2), rc = rb.ctx;
          rc.clearRect(0, 0, R0 * 2, R0 * 2); rc.drawImage(B.canvas, x0, y0, R0 * 2, R0 * 2, 0, 0, R0 * 2, R0 * 2);
          rc.globalCompositeOperation = 'destination-in';
          rc.fillStyle = radial(rc, R0, R0, R0, [[0, `rgba(0,0,0,${k})`], [0.2, `rgba(0,0,0,${0.95 * k})`], [0.5, `rgba(0,0,0,${0.45 * k})`], [1, 'rgba(0,0,0,0)']]); rc.fillRect(0, 0, R0 * 2, R0 * 2);
          ctx.drawImage(rb.canvas, x0, y0);
        }
      }
    }
    // ---- 4) the touch: a faint warm light where they meet (blooms at 29.6, breathes, follows the stroke)
    {
      const tp = tipPoint(her, 1), k = sm(C09.touch - 0.05, C09.touch + 0.12, u) * (1 - 0.3 * sm(C09.touch + 0.5, 3.0, u));
      if (k > 0.002) {
        const pulse = 1 + 0.5 * Math.exp(-Math.pow((u - C09.touch - 0.06) / 0.14, 2)) + 0.07 * Math.sin(u * 3.1);
        glowAt(ctx, tp.x, tp.y, 170 * pulse, '#ffe9c8', 0.36 * k);
        glowAt(ctx, tp.x, tp.y, 46 * pulse, '#fff8ec', 0.4 * k);
        // a soft ring of light spreading out from the touch (once), like a held breath let go
        const ra = u - C09.touch;
        if (ra > 0 && ra < 1.1) {
          const rr = 30 + 250 * PV.ease.outCubic(clamp(ra / 1.1)), al = 0.22 * (1 - sm(0.05, 1.1, ra)) * sm(0, 0.08, ra);
          ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(tp.x, tp.y); ctx.scale(1, 0.82); ctx.rotate(-0.3);
          const rg = ctx.createRadialGradient(0, 0, rr * 0.45, 0, 0, rr); rg.addColorStop(0, 'rgba(255,240,214,0)'); rg.addColorStop(0.7, `rgba(255,242,220,${al.toFixed(3)})`); rg.addColorStop(1, 'rgba(255,240,214,0)');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill(); ctx.restore();
        }
        const mote = spriteMote(), rr = PV.rng(29);
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 9; i++) {
          const a = rr() * TAU, sp = 16 + rr() * 34, ph = rr() * 0.5, age = u - C09.touch - ph;
          if (age < 0) continue;
          const dd = sp * Math.sqrt(age), x = tp.x + Math.cos(a) * dd + N2(i, u) * 6, y = tp.y + Math.sin(a) * dd * 0.7 - age * 24;
          const s = (4 + rr() * 6) * (1 - sm(0.7, 1.4, age)); if (s < 0.5) continue;
          ctx.globalAlpha = clamp(0.75 * (1 - sm(0.3, 1.3, age))); ctx.drawImage(mote, x - s * 2, y - s * 2, s * 4, s * 4);
        }
        ctx.restore();
      }
    }
    // ---- 5) air: specks of dust in the beam between lens and hands, warm leak from the window side
    L.dust(ctx, u, { seed: 94, count: 46, size: 2.4, alpha: 0.5, drift: 40, vx: 9, vy: -4, color: '#fff3dc' });
  } });

  /* ===================================================================== the music-room set (PV.anime characters)
   * The grand piano stands where g01 put it for C02/C04 (anime rework): she sits facing the blackboard end of the room,
   * the windows behind her on her left, so the camera that looks at the window wall sees her face from the treble end.
   * PIANO: room point of the piano's anchor and its rotY (instruments.js grandPiano), her bench in piano-local x. */
  const PIANO = { at: [7.46, 4.77], yaw: -0.52, benchX: -0.5 };
  const pianoL2R = (p) => { const a = PIANO.yaw, c = Math.cos(a), s = Math.sin(a), x = p[0] - 0.84, z = p[2] - 0.745; return [PIANO.at[0] + x * c + z * s, p[1], PIANO.at[1] - x * s + z * c]; };
  const BENCH = pianoL2R([PIANO.benchX, 0.495, 0.745]);           // top centre of her bench: the keys are one of her heads above it
  const HER_DIR = [Math.cos(PIANO.yaw), -Math.sin(PIANO.yaw)];     // the room direction she faces at the keys (x, z)
  const HER_RT = [Math.sin(PIANO.yaw), Math.cos(PIANO.yaw)];       // her right (the treble end)
  const KEY_Z = (-0.15 - PIANO.benchX) / 0.23 + 0.06;             // pose 'piano' keyZ: the key front edge in her head units
  const HEAD_M = { senpai: 0.23, boy: 0.244 };                     // head height (chin -> crown) in metres: 161 cm / 7.0, 178 cm / 7.3
  const AN = () => PV.anime;
  const V3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  };
  // a pinhole camera with the conventions of instruments.js (r = f x up, u = r x f, screen y down): usable as grandPiano's
  // roomCam ({eye, f, u, focal, cx, cy}) and for placing the figures
  function mkCam(eye, tgt, fov) {
    const f = V3.norm(V3.sub(tgt, eye)), r = V3.norm(V3.cross(f, [0, 1, 0])), u = V3.cross(r, f);
    const focal = (W / 2) / Math.tan(fov * PI / 360), cam = { eye, f, r, u, focal, cx: W / 2, cy: H / 2, near: 0.05 };
    cam.cs = (p) => { const d = V3.sub(p, eye); return [V3.dot(d, r), V3.dot(d, u), V3.dot(d, f)]; };
    cam.p = (p) => { const q = cam.cs(p), z = Math.max(q[2], cam.near); return [cam.cx + focal * q[0] / z, cam.cy - focal * q[1] / z, q[2]]; };
    cam.scaleAt = (p) => focal / Math.max(cam.cs(p)[2], cam.near);
    return cam;
  }
  // a figure whose pose anchor is at room point p, facing the room direction fd [x, z], seen by camera cam: its screen
  // anchor, head size in px, facing relative to the line of sight (+ toward screen right), the camera's pitch toward its chest
  function figPlace(cam, p, fd, who, chestH) {
    const a = cam.p(p), s = cam.scaleAt(p) * HEAD_M[who];
    let tx = cam.eye[0] - p[0], tz = cam.eye[2] - p[2]; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
    let rx = cam.r[0], rz = cam.r[2]; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    return { x: a[0], y: a[1], scale: s, facing: Math.atan2(fd[0] * rx + fd[1] * rz, fd[0] * tx + fd[1] * tz),
      camPitch: Math.atan2(cam.eye[1] - p[1] - (chestH || 0.45), tl) };
  }
  // the 2-D affine [a, b, c, d, e, f] (setTransform order) that maps the three points s[i] onto d[i]
  function affine3(s, d) {
    const [x0, y0] = s[0], [x1, y1] = s[1], [x2, y2] = s[2], det = x0 * (y1 - y2) - y0 * (x1 - x2) + (x1 * y2 - x2 * y1);
    const solve = (v0, v1, v2) => [(v0 * (y1 - y2) - y0 * (v1 - v2) + (v1 * y2 - v2 * y1)) / det,
      (x0 * (v1 - v2) - v0 * (x1 - x2) + (x1 * v2 - x2 * v1)) / det,
      (x0 * (y1 * v2 - y2 * v1) - y0 * (x1 * v2 - x2 * v1) + v0 * (x1 * y2 - x2 * y1)) / det];
    const X = solve(d[0][0], d[1][0], d[2][0]), Y = solve(d[0][1], d[1][1], d[2][1]);
    return [X[0], Y[0], X[1], Y[1], X[2], Y[2]];
  }
  const area2 = (q) => { let a = 0; for (let i = 0; i < q.length; i++) { const p = q[i], r = q[(i + 1) % q.length]; a += p[0] * r[1] - r[0] * p[1]; } return a; };
  function hull2(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  // the scene's grand piano options under camera cam (R: a musicRoom result, for its window environment and sun). The library's
  // rimLit pass costs ~85 ms per new camera: the piano keeps its own lit lacquer edges instead (the camera moves every frame)
  const pianoOpts = (R, cam, extra) => Object.assign(R.piano(PIANO.at[0], PIANO.at[1], PIANO.yaw, { lidOpen: 1, bench: false, desk: false }), { roomCam: cam }, extra || {});
  // the piano under camera cam into a full-frame layer (re-used by keysOver), rimmed, painted onto ctx; returns grandPiano's result
  function drawPiano(ctx, R, cam) {
    const PB = PV.buffer('g03:piano'); PB.ctx.clearRect(0, 0, W, H);
    { // its soft shadow on the floor (the library's own shadow is a blurred full-frame pass): a projected ellipse under the case
      const c0 = cam.p(pianoL2R([0.95, 0, 0.72])), cx = cam.p(pianoL2R([1.95, 0, 0.72])), cz = cam.p(pianoL2R([0.95, 0, 1.6]));
      const ax = [cx[0] - c0[0], cx[1] - c0[1]], az = [cz[0] - c0[0], cz[1] - c0[1]];
      PB.ctx.save(); PB.ctx.setTransform(ax[0], ax[1], az[0], az[1], c0[0], c0[1]);
      PB.ctx.fillStyle = radial(PB.ctx, 0, 0, 1, [[0, 'rgba(24,14,10,0.42)'], [0.6, 'rgba(24,14,10,0.24)'], [1, 'rgba(24,14,10,0)']]);
      PB.ctx.beginPath(); PB.ctx.arc(0, 0, 1, 0, TAU); PB.ctx.fill(); PB.ctx.restore(); }
    const res = L.grandPiano(PB.ctx, pianoOpts(R, cam, { cache: false, shadow: 0 })) || {};
    PRF('pianoDraw', PB.ctx);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(PB.canvas, 0, 0); ctx.restore();
    PRF('pianoBlit', ctx);
    res.layer = PB.canvas;
    return res;
  }
  // 先輩 at the grand piano, seen by camera cam (her own bench; the keys are the scene's piano: keyH / keyZ match it)
  function drawPianist(c, cam, T, o) {
    const P = figPlace(cam, BENCH, HER_DIR, 'senpai', 0.42);
    return AN().figure(c, {
      who: 'senpai', outfit: 'uniform', pose: 'piano', facing: P.facing, camPitch: P.camPitch, x: P.x, y: P.y, scale: P.scale, T,
      light: o.light || 'window', rimDir: o.rimDir === undefined ? -2.0 : o.rimDir, rimA: o.rimA, rimColor: o.rimColor, amb: o.amb,
      params: { intensity: o.intensity, play: o.play === undefined ? 1 : o.play, hands: o.hands || 'keys', look: o.look || 'keys', breathe: o.breathe || 0,
        lean: o.lean || 0, tilt: o.tilt || 0, neckYaw: o.neckYaw || 0, keys: false, bench: true, benchH: 2.15, keyH: 1.0, keyZ: KEY_Z },
      head: o.head || {},
    });
  }
  // The scene's keyboard lies in front of her lap and under her hands (the body library only knows that for its own keys):
  // after she is painted, the piano (the same cached image) is painted again inside the projected keyboard -- key tops, the
  // front of the keybed, the treble cheek block and the treble front leg -- minus her arms (a capsule from each shoulder to just
  // past each hand). c: the layer she is painted in (identity transform), info: PV.anime.figure's return, s: her head px
  function keysOver(c, pianoLayer, cam, info, s) {
    const Wd = 1.49, cw = (Wd - 1.222) / 2, P = (x, y, z) => cam.p(pianoL2R([x, y, z]));
    const polys = [
      [P(-0.152, 0.74, cw), P(0.002, 0.74, cw), P(0.002, 0.74, Wd - cw), P(-0.152, 0.74, Wd - cw)],          // key tops (black keys included)
      [P(-0.158, 0.62, cw), P(-0.158, 0.745, cw), P(-0.158, 0.745, Wd - cw), P(-0.158, 0.62, Wd - cw)],      // front of the keybed
    ];
    const corners = (b) => { const o = []; for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) o.push(P(x, y, z)); return o; };
    for (const b of [[-0.176, 0.62, Wd - cw - 0.004, 0.003, 0.806, Wd + 0.004], [-0.142, 0, Wd - cw + 0.01, -0.028, 0.63, Wd - 0.008]]) polys.push(hull2(corners(b)));
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of polys) for (const p of q) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    x0 = Math.max(0, Math.floor(x0) - 2); y0 = Math.max(0, Math.floor(y0) - 2); x1 = Math.min(W, Math.ceil(x1) + 2); y1 = Math.min(H, Math.ceil(y1) + 2);
    if (x1 <= x0 || y1 <= y0) return;
    const B = PV.buffer('g03:keysOver'), bc = B.ctx;
    bc.clearRect(x0, y0, x1 - x0, y1 - y0);
    bc.save(); bc.beginPath();
    for (let q of polys) { if (area2(q) < 0) q = q.slice().reverse(); q.forEach((p, i) => (i ? bc.lineTo(p[0], p[1]) : bc.moveTo(p[0], p[1]))); bc.closePath(); }
    bc.clip(); bc.drawImage(pianoLayer, 0, 0); bc.restore();
    bc.globalCompositeOperation = 'destination-out'; bc.lineCap = 'round'; bc.strokeStyle = '#000'; bc.lineWidth = s * 0.44;
    for (const k of ['L', 'R']) {
      const S0 = info.shoulders[k], Hh = info.hands[k];
      bc.beginPath(); bc.moveTo(S0[0], S0[1]); bc.lineTo(Hh[0] + (Hh[0] - S0[0]) * 0.22, Hh[1] + (Hh[1] - S0[1]) * 0.22); bc.stroke();
    }
    bc.globalCompositeOperation = 'source-over';
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(B.canvas, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); c.restore();
  }

  /* ========================================================================== C10
   * The singing piano. The camera starts on her right (her profile at the keys, the windows behind her) and swings
   * round toward her front while it rises (orbit right + crane up): the profile opens into a 3/4 face. Eyes closed, a calm
   * smile, the hair rimmed gold by the window; she sways with the melody (piano MEL_A, rubato: 31.0 F#5 / 32.2 E5 / 32.54
   * D5 / 33.25 A4 / 34.0 C#5) and, at the end of the cut, slowly opens her eyes: the light comes on in them (design 2-5).
   * The piano and she are drawn with the real orbiting camera every frame; the room behind (curtains, sky, petals) is drawn
   * by a fixed camera and laid in with two affine warps (wall / floor) that agree on the wall's base line. */
  const C10_NOTES = [0.0, 1.2, 1.54, 2.25, 3.0];
  // dev timing (PV._g03prof = true): per-stage ms printed to the console
  let PRF_T = 0, PRF_L = [];
  function PRF(tag, c) { if (!PV._g03prof) return; if (c) c.getImageData(0, 0, 1, 1); const n = performance.now(); if (tag === 'start') { PRF_T = n; PRF_L = []; return; } PRF_L.push(tag + ' ' + (n - PRF_T).toFixed(0)); PRF_T = n; if (tag === 'end') console.error('g03 ' + PRF_L.join(' | ')); }
  const ppmAt = (R, w) => Math.abs(R.project([w[0], w[1], w[2]])[1] - R.project([w[0], w[1] + 1, w[2]])[1]);
  const BAYS = [0, 1, 2, 3].map(k => [1.3 + k * 3.1, 1.3 + k * 3.1 + 2.5]);
  function glassPath(ctx, R, inset) {
    const e = inset || 0;
    ctx.beginPath();
    for (const [x0, x1] of BAYS) for (const [y0, y1] of [[0.91, 2.3], [2.38, 2.75]]) {
      const q = [[x0 + 0.05 + e, y0, -0.09], [x1 - 0.05 - e, y0, -0.09], [x1 - 0.05 - e, y1, -0.09], [x0 + 0.05 + e, y1, -0.09]].map(p => R.project(p));
      if (q.some(p => !p || p[2] < 0.05)) continue;
      ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath();
    }
  }
  // warm "note petals": the same particle family as C02's ice hail (eighth notes, beamed pairs, pellets), turned
  // warm, soft and slow — they rise from the open piano and drift toward the window like petals
  function spriteWarmNote(kind, blur) {
    return PV.cached('g03:wnote:' + kind + ':' + blur, 80, 80, (c) => {
      c.translate(30, 52); if (blur) c.filter = 'blur(' + blur + 'px)';
      const glyph = () => {
        c.beginPath(); c.ellipse(0, 0, 8.4, 6, -0.45, 0, TAU); c.fill();
        c.fillRect(6.2, -28, 2.4, 28);
        if (kind === 1) { c.beginPath(); c.moveTo(8.4, -28); c.quadraticCurveTo(19, -20, 15, -10); c.quadraticCurveTo(16, -18, 8.4, -21); c.fill(); }
        if (kind === 2) { c.fillRect(6.2, -28, 18, 4.8); c.beginPath(); c.ellipse(20, -2, 8.4, 6, -0.45, 0, TAU); c.fill(); c.fillRect(22.2, -28, 2.4, 26); }
      };
      // warm amber rim (reads on the bright window) + cream-gold body + white glint
      c.save(); c.shadowColor = 'rgba(176,112,60,0.9)'; c.shadowBlur = 0; c.fillStyle = '#c4884e';
      c.translate(-1.2, 1.2); glyph(); c.translate(2.4, 0); glyph(); c.translate(-1.2, -2.4); glyph(); c.restore();
      const g = c.createLinearGradient(-8, -28, 18, 6); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.55, '#ffe6bd'); g.addColorStop(1, '#f6c98e');
      c.fillStyle = g; glyph();
      c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.ellipse(-2.5, -2.2, 3, 1.4, -0.5, 0, TAU); c.fill();
    });
  }
  function spritePetal(blur, tone) {
    return PV.cached('g03:petal:' + blur + ':' + tone, 64, 64, (c) => {
      c.translate(32, 32); if (blur) c.filter = 'blur(' + blur + 'px)';
      const sz = 15, base = tone ? '#ffe9d6' : '#ffd8e4', deep = tone ? '#f4bf9a' : '#ef9fb8';
      const g = c.createLinearGradient(0, -sz, 0, sz); g.addColorStop(0, base); g.addColorStop(1, deep);
      c.fillStyle = g; c.beginPath(); c.moveTo(0, sz);
      c.bezierCurveTo(-sz * 0.78, sz * 0.5, -sz * 0.86, -sz * 0.6, -sz * 0.22, -sz); c.lineTo(0, -sz * 0.76); c.lineTo(sz * 0.22, -sz);
      c.bezierCurveTo(sz * 0.86, -sz * 0.6, sz * 0.78, sz * 0.5, 0, sz); c.fill();
      c.strokeStyle = 'rgba(190,110,120,0.45)'; c.lineWidth = 1; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(-sz * 0.15, -sz * 0.18, sz * 0.17, sz * 0.42, 0.3, 0, TAU); c.fill();
    });
  }
  function warmSet(seed, n) {
    const key = seed + ':' + n; warmSet.c = warmSet.c || {};
    if (warmSet.c[key]) return warmSet.c[key];
    const r = PV.rng(seed), ps = [];
    for (let i = 0; i < n; i++) ps.push({ i, x: r(), y: r(), z: r(), kind: r() < 0.42 ? (r() < 0.55 ? 1 : (r() < 0.5 ? 2 : 0)) : 3, tone: r() < 0.3 ? 1 : 0, sz: 0.65 + 0.7 * r(), ph: r() * 100, rs: (r() - 0.5) * 1.6, fl: 0.6 + r() * 1.4, src: r() });
    return (warmSet.c[key] = ps);
  }
  // o: em {x,y,w,h} (where they are born: the open piano), par (camera parallax px for near particles), focusZ
  function warmNotes(ctx, u, o) {
    const ps = warmSet(o.seed || 3, o.n || 120), mote = spriteMote(), A = o.alpha === undefined ? 1 : o.alpha;
    const list = [];
    for (const p of ps) {
      const z = lerp(0.42, 1.9, p.z);           // depth (1 = her)
      const life = 5.5 + 3 * p.fl, age = ((u + p.ph) % life + life) % life, k = age / life;
      // born above the piano (or anywhere, for the ambient half), rising slowly, drifting toward the window light
      let x, y;
      if (p.src < 0.55) { x = o.em.x + (p.x - 0.5) * o.em.w; y = o.em.y + (p.y - 0.5) * o.em.h; }
      else { x = -150 + p.x * (W + 300); y = 80 + p.y * (H - 80); }
      if ((o.zMin !== undefined && z < o.zMin) || (o.zMax !== undefined && z >= o.zMax)) continue;
      x += (age * (18 + 22 * p.fl) + 46 * Math.sin(age * 0.6 + p.ph)) / z + o.par * (1 / z - 1);
      y += (-age * (26 + 18 * p.fl) + 22 * Math.sin(age * 0.9 + p.ph * 1.7)) / z + o.parY * (1 / z - 1);
      const fade = sm(0, 0.12, k) * (1 - sm(0.82, 1, k));
      list.push({ p, z, x, y, fade, age });
    }
    list.sort((a, b) => b.z - a.z);
    ctx.save();
    for (const { p, z, x, y, fade, age } of list) {
      if (x < -120 || x > W + 120 || y < -120 || y > H + 120 || fade < 0.02) continue;
      const dof = Math.abs(1 / z - 1 / (o.focusZ || 1)) * 5.5, bl = dof < 1.2 ? 0 : dof < 3.6 ? 3 : 7;
      const size = (o.size || 15) * p.sz / z;
      const a = A * fade * (0.8 + 0.2 * Math.sin(u * 2.2 + p.ph));
      // soft warm halo (only the nearer ones; the far ones are too small to need it)
      if (z < 1.25) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = clamp(a * 0.45); ctx.drawImage(mote, x - size * 1.8, y - size * 1.8, size * 3.6, size * 3.6); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = clamp(a);
      ctx.save(); ctx.translate(x, y);
      if (p.kind === 3) { // a petal: tumbling (flip) and turning
        ctx.rotate(p.ph + age * p.rs); ctx.scale(Math.cos(age * p.fl * 1.6 + p.ph), 1);
        const s = size * 1.05; ctx.drawImage(spritePetal(bl, p.tone), -s, -s, s * 2, s * 2);
      } else {
        ctx.rotate(0.35 * Math.sin(age * 0.8 + p.ph)); const s = size * 1.25;
        ctx.drawImage(spriteWarmNote(p.kind, bl), -s * 0.75, -s * 1.3, s * 2, s * 2);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  // the shaded sheer curtain hanging at the right edge, out of focus (frames the shot, carries the monologue)
  function c10CurtainSprite() {
    const w = 700, h = H + 200;
    return PV.cached('g03:c10curtain', w, h, (c) => {
      const b = PV.makeCanvas(w, h), cc = b.ctx, x0 = 110;
      const g = cc.createLinearGradient(x0 - 60, 0, w, 0);
      g.addColorStop(0, 'rgba(96,80,78,0)'); g.addColorStop(0.07, 'rgba(92,76,76,0.9)'); g.addColorStop(0.45, 'rgba(62,52,58,0.96)'); g.addColorStop(1, 'rgba(38,32,40,1)');
      cc.fillStyle = g; cc.beginPath(); cc.moveTo(x0, 0);
      for (let y = 0; y <= h; y += 40) { const k = y / h; cc.lineTo(x0 + Math.sin(y * 0.012) * 16 * k - k * 70 + 26 * k * k, y); }
      cc.lineTo(w, h); cc.lineTo(w, 0); cc.closePath(); cc.fill();
      cc.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 9; i++) { // the window glows through the thin cloth in the folds
        const fx = x0 + 26 + i * 68 + (i % 3) * 8, gg = cc.createLinearGradient(fx - 30, 0, fx + 30, 0);
        gg.addColorStop(0, 'rgba(255,236,210,0)'); gg.addColorStop(0.5, `rgba(255,226,190,${0.06 + 0.05 * (i % 2)})`); gg.addColorStop(1, 'rgba(255,236,210,0)');
        cc.fillStyle = gg; cc.fillRect(fx - 30, 0, 60, h);
      }
      const eg = cc.createLinearGradient(x0 - 50, 0, x0 + 140, 0); eg.addColorStop(0, 'rgba(255,226,180,0.9)'); eg.addColorStop(1, 'rgba(255,226,180,0)');
      cc.fillStyle = eg; cc.fillRect(x0 - 100, 0, 260, h);
      c.filter = 'blur(10px)'; c.drawImage(b.canvas, 0, 0);
    });
  }
  // the move (24 fps): k 0 -> 1, already under way at the cut and still easing at the next one
  const C10K = (u) => lerp(0.06, 1.0, PV.ease.sine(clamp((u + 0.7) / 4.9)));
  const C10_PIV = V3.add(BENCH, [0, 0.6, 0]);              // her chest: the pivot of the move
  // camera at move k: orbit angle b from her right side (b = 0: her profile) toward her front, a crane up and a slight push;
  // it aims a little ahead of her (toward the keys) so she sits left of centre with the open piano on the right
  function c10Cam(k) {
    const b = lerp(0.2, 0.62, k);
    const dir = [HER_RT[0] * Math.cos(b) + HER_DIR[0] * Math.sin(b), HER_RT[1] * Math.cos(b) + HER_DIR[1] * Math.sin(b)];
    const D = lerp(3.45, 3.05, k), y = lerp(1.3, 1.85, k);
    const eye = [C10_PIV[0] + dir[0] * D, y, C10_PIV[2] + dir[1] * D];
    const tgt = [C10_PIV[0] + HER_DIR[0] * 0.5, lerp(0.98, 1.06, k), C10_PIV[2] + HER_DIR[1] * 0.5];
    return mkCam(eye, tgt, 34);
  }
  // the fixed camera that paints the room: the middle of the move through a wider lens, so the warps never run out of picture
  const C10_ROOMCAM = (() => { const c = c10Cam(0.5); return { eye: c.eye, target: V3.add(c.eye, c.f), fov: 52 }; })();
  // the room (painted by R's fixed camera into src) laid into the frame of camera cam: the window wall and the floor each get
  // the affine that is exact at three of their points; both share two points of the wall's base line, so they meet seamlessly
  function c10Room(ctx, R, cam, src) {
    const xa = BENCH[0] - 1.8, xb = BENCH[0] + 2.6;
    const B0 = [xa, 0, 0], B1 = [xb, 0, 0], Wt = [(xa + xb) / 2, 2.4, 0], Fb = [BENCH[0] + 0.4, 0, BENCH[2] - 0.6];
    const S = (p) => R.project(p), D = (p) => cam.p(p);
    const Aw = affine3([S(B0), S(B1), S(Wt)], [D(B0), D(B1), D(Wt)]);
    const Af = affine3([S(B0), S(B1), S(Fb)], [D(B0), D(B1), D(Fb)]);
    const l0 = D([-3, 0, 0]), l1 = D([17, 0, 0]), yAt = (x) => l0[1] + (l1[1] - l0[1]) * (x - l0[0]) / ((l1[0] - l0[0]) || 1);
    const ya = yAt(-300), yb = yAt(W + 300);
    ctx.save(); ctx.beginPath(); ctx.moveTo(-300, -300); ctx.lineTo(W + 300, -300); ctx.lineTo(W + 300, yb + 1.5); ctx.lineTo(-300, ya + 1.5); ctx.closePath(); ctx.clip();
    ctx.setTransform(Aw[0], Aw[1], Aw[2], Aw[3], Aw[4], Aw[5]); ctx.imageSmoothingQuality = 'medium'; ctx.drawImage(src, 0, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.moveTo(-300, ya - 0.5); ctx.lineTo(W + 300, yb - 0.5); ctx.lineTo(W + 300, H + 300); ctx.lineTo(-300, H + 300); ctx.closePath(); ctx.clip();
    ctx.setTransform(Af[0], Af[1], Af[2], Af[3], Af[4], Af[5]); ctx.imageSmoothingQuality = 'medium'; ctx.drawImage(src, 0, 0); ctx.restore();
  }
  // her light: the window behind her, the spring sun from the upper left (the hair rimmed gold), the face softly filled
  let C10L = null;
  const C10_ROOM = { stamp: null, R: null };
  const c10Light = () => C10L || (C10L = Object.assign({}, AN().LIGHT.window, { amb: 0.18, rim: '#ffd890', rimA: 1.0, dark: 0.95, sat: 0.94, shadow: '#9a92c4' }));
  PV.shot('C10', { draw(ctx, t, d, S) {
    const tt = clamp(t, -0.3, d + 0.3), u = localT(S, 'C10', tt), T = SB.C10 + u, uq = AN().onTwos(u);
    if (S) S.post = Object.assign({}, S.post, { bloom: 0.2 });      // her face against the bright window: keep the thin eye lines crisp
    PRF('start');
    const k = C10K(u), cam = c10Cam(k);
    // her breath on the phrase (on twos): a lift into each note, the long notes (F#5, C#5) the most
    let env = 0; for (let i = 0; i < C10_NOTES.length; i++) env += (i === 0 || i === 4 ? 1 : 0.6) * Math.exp(-Math.pow((uq - C10_NOTES[i] - 0.2) / 0.38, 2));
    // ---- 1) the room under its fixed camera (curtains, sky, the petals outside the open windows, the warm afternoon wash),
    //         painted on twos into its own plate (a pure function of the drawing time), laid in by the warps every frame
    const rq = uq, gust = 1.0 + 0.85 * bell(rq, 0.9, 0.9) + 0.7 * bell(rq, 3.2, 0.8);
    const RB = PV.buffer('g03:c10room'), rc = RB.ctx;
    if (C10_ROOM.stamp !== rq || !C10_ROOM.R) {
      C10_ROOM.stamp = rq; rc.setTransform(1, 0, 0, 1, 0, 0); rc.clearRect(0, 0, W, H);
      C10_ROOM.R = L.musicRoom(rc, SB.C10 + rq, { view: 'windows', time: 'noon', furniture: 'none', wind: gust, cam: C10_ROOMCAM, shaft: 1.5, dust: false });
      rc.save(); glassPath(rc, C10_ROOM.R, 0); rc.clip();
      L.petals(rc, rq + 3, { seed: 61, count: 60, size: 9, fall: -110, wind: 70 + 60 * C10K(rq), alpha: 0.95, color: '#ffd6e4' });
      L.petals(rc, rq + 7, { seed: 62, count: 22, size: 15, fall: -170, wind: 110 + 70 * C10K(rq), alpha: 0.9, color: '#ffe1ea' });
      rc.restore();
      // the spring afternoon: a warm wash from the windows (upper left) over the room
      rc.save(); rc.globalCompositeOperation = 'soft-light';
      rc.fillStyle = PV.linGrad(rc, 0, 0, W * 0.8, H, [[0, 'rgba(255,226,176,0.32)'], [0.55, 'rgba(255,220,176,0.16)'], [1, 'rgba(255,214,170,0.05)']]); rc.fillRect(0, 0, W, H); rc.restore();
    }
    const R = C10_ROOM.R;
    PRF('room', rc);
    c10Room(ctx, R, cam, RB.canvas);
    PRF('warp', ctx);
    // ---- 2) the grand piano under the real camera
    const pr = drawPiano(ctx, R, cam);
    PRF('piano', ctx);
    const P = figPlace(cam, BENCH, HER_DIR, 'senpai', 0.42), s = P.scale;
    const head0 = cam.p(V3.add(BENCH, [0, 0.66, 0]));
    // ---- 3) warm note-petals rising out of the open piano: the ones behind her first
    const inside = cam.p(pianoL2R([0.75, 1.05, 0.7]));      // the open case: the notes are born over the strings
    const notesO = { seed: 7, n: 120, em: { x: inside[0], y: inside[1] - 0.6 * s, w: 3.8 * s, h: 1.8 * s }, par: -70 * k, parY: 30 * k, focusZ: 1.0, size: 27, alpha: 1 };
    warmNotes(ctx, u, Object.assign({ zMin: 1.0 }, notesO));
    PRF('notes', ctx);
    // ---- 4) her: eyes closed, the calm smile; at the end of the cut the eyes open slowly and the light comes on in them
    const open = sm(2.62, 3.16, uq), opened = open > 0.02;
    const sway = Math.sin(uq * 1.9) * 0.5 + 0.5 * N2(1.3, uq * 0.6);
    // the eyes open softly (the smile stays in the lower lids), looking down toward her hands; the highlights come on last
    const head = opened
      ? { expr: 'gentle', eyes: { open: 0.74 * open, closed: 'down', smile: 0.42, shine: sm(0.3, 1, open), hlK: 1.12, look: [0.42, 0.34] },
        mouth: { shape: 'smile', open: 0 }, brows: { inner: 0.35, outer: -0.05 }, noBlink: true, blush: 0.3 }
      : { expr: 'closed', eyes: { smile: 0.3 }, mouth: { shape: 'smile', open: 0.1 * Math.min(1, env) }, blush: 0.22 + 0.05 * env };
    Object.assign(head, { turn: -0.08 - 0.1 * k - 0.05 * env - 0.06 * open, rim: 1.15, rimW: 2.1, hair: { wind: 0.12 + 0.2 * (gust - 1), windDir: 0.15 } });
    // the window glow behind her head and shoulders: she reads against light (drawn under her)
    glowAt(ctx, head0[0] - 0.9 * s, head0[1] - 0.2 * s, 3.2 * s, '#fff0d4', 0.22 + 0.06 * env);
    const info = drawPianist(ctx, cam, T, { light: c10Light(), rimDir: -2.15, intensity: 0.32, look: 'ahead', lean: -0.02 * env, tilt: 0.05 * (sway - 0.5) + 0.04 * env, head });
    PRF('fig', ctx);
    keysOver(ctx, pr.layer, cam, info, s);
    PRF('keys', ctx);
    // the light comes on in her eyes: a small sparkle blooms on the near eye's highlight as it opens fully, then settles
    { const g = sm(3.0, 3.16, u) * (1 - 0.7 * sm(3.22, 3.48, u)), Hd = info && info.head;
      if (g > 0.01 && Hd && Hd.eyeL) {
        const r = Hd.size * 0.075 * (0.8 + 0.4 * g), x = Hd.eyeL[0] - 0.02 * Hd.size, y = Hd.eyeL[1] - 0.022 * Hd.size;
        glowAt(ctx, x, y, r * 2.2, '#fff6e2', 0.45 * g);
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.9 * g; ctx.fillStyle = '#fffaf0'; ctx.translate(x, y); ctx.rotate(0.3);
        ctx.beginPath(); // a four-pointed star: long thin arms, a bright core
        for (let i = 0; i < 8; i++) { const a = i * PI / 4, rr = i % 2 ? r * 0.13 : (i % 4 ? r * 0.62 : r); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.restore(); } }
    // ---- 5) the near layers: notes in front of her, the shaded curtain at the right edge, big petals at the lens
    warmNotes(ctx, u, Object.assign({ zMax: 1.0 }, notesO));
    const spr = c10CurtainSprite(), cs = Math.sin(u * 0.9) * 0.02 + N2(2.2, u * 0.5) * 0.012;
    ctx.drawImage(spr, Math.round(1450 - 60 * k + cs * 300), Math.round(-100 - 20 * k));
    const mote = spriteMote();
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const r1 = R1(i, 77), r2 = R1(i, 78), x = ((r1 * 2300 + u * 40 - 190 * k) % 2300 + 2300) % 2300 - 190, y = 120 + r2 * 760 - u * 18 - 60 * k + 30 * Math.sin(u * 0.7 + i);
      const sz = 46 + 40 * R1(i, 79);
      ctx.globalAlpha = 0.5; ctx.drawImage(spritePetal(7, i % 2), x - sz, y - sz, sz * 2, sz * 2);
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.25; ctx.drawImage(mote, x - sz * 1.4, y - sz * 1.4, sz * 2.8, sz * 2.8); ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    PRF('end', ctx);
  } });

  /* ========================================================================== C11
   * Extreme close-up of his left hand on the acoustic's neck. 34.9: the grip tightens (the fingers bite into the
   * strings, a fine tremor runs through the hand). 35.6: a drop falls through the frame; the camera whips down
   * after it to the sunlit floor, where it lands at 35.75 and splashes in slow motion. */
  const C11 = { grip: 0.4, drop: 1.02, land: 1.25, tilt: [1.1, 1.25] };
  // seen from the body side and a little above (the four fingers read as separate arches gripping the neck; from the
  // front at this size the curled ring/little fingers fold into lumps)
  const C11_HAND = { x: 820, y: 520, scale: 4.5, az: -0.72, el: 0.36, roll: -0.04 };
  const C11_TALL = 1700;   // virtual canvas: plate A (0..1080) .. transition .. plate B (C11_TALL..C11_TALL+1080)
  function c11PlateA() {
    return PV.cached('g03:c11A:v4', W, H, (c) => {
      const q = 0.5, b = PV.makeCanvas(W * q, H * q), p = b.ctx; p.scale(q, q);
      // behind the neck, far out of focus: his white shirt in the window light (top), his lap in shade (bottom left).
      // (the guitar body itself is drawn live, joined to the neck -- see c11Body)
      p.fillStyle = PV.linGrad(p, 0, 0, W * 0.6, H, [[0, '#f8eedd'], [0.5, '#eadbc6'], [1, '#c2ab93']]); p.fillRect(0, 0, W, H);
      const r = PV.rng(1101);
      for (let i = 0; i < 18; i++) { // soft folds of the shirt: irregular light / shade patches
        const x = r() * W * 0.9, y = r() * H * 0.75, rx = 120 + r() * 260, ry = 50 + r() * 120, rot = -0.6 + r() * 0.5, lt = r() < 0.5;
        p.save(); p.translate(x, y); p.rotate(rot); p.scale(1, ry / rx);
        p.fillStyle = radial(p, 0, 0, rx, [[0, lt ? 'rgba(255,250,240,0.55)' : 'rgba(150,130,118,0.32)'], [1, 'rgba(200,180,160,0)']]); p.fillRect(-rx, -rx, rx * 2, rx * 2); p.restore();
      }
      // lap: charcoal trousers sweeping across the lower left
      p.fillStyle = '#4c4650'; p.beginPath(); p.moveTo(-50, 760); p.bezierCurveTo(400, 690, 900, 800, 1250, 1130); p.lineTo(-50, 1130); p.closePath(); p.fill();
      p.fillStyle = PV.linGrad(p, 0, 700, 0, 1080, [[0, 'rgba(255,226,190,0.35)'], [1, 'rgba(255,226,190,0)']]); p.fill();
      // his shirt turns away from the window on the right and falls into shade (a darker field for the monologue)
      p.fillStyle = PV.linGrad(p, 1250, 0, W, 0, [[0, 'rgba(46,32,28,0)'], [0.35, 'rgba(46,32,28,0.3)'], [1, 'rgba(34,24,22,0.55)']]); p.fillRect(1250, 0, W - 1250, H);
      // the window light from the upper left
      p.globalCompositeOperation = 'screen';
      p.fillStyle = radial(p, 60, -40, 1300, [[0, 'rgba(255,238,206,0.75)'], [0.5, 'rgba(255,226,186,0.22)'], [1, 'rgba(255,226,186,0)']]); p.fillRect(0, 0, W, H);
      p.globalCompositeOperation = 'source-over';
      c.filter = 'blur(14px)'; c.drawImage(b.canvas, 0, 0, W * q, H * q, -20, -20, W + 40, H + 40); c.filter = 'none';
    });
  }
  // what the lens passes on the way down: the guitar's waist and lower bout, his knee, the chair (smeared anyway)
  function c11Transition() {
    return PV.cached('g03:c11T:v2', W, C11_TALL - H + 240, (c, w, h) => {
      c.fillStyle = PV.linGrad(c, 0, 0, 0, h, [[0, '#7a5f4e'], [0.3, '#5a3c26'], [0.55, '#3c3742'], [0.85, '#6e5038'], [1, '#a77b52']]); c.fillRect(0, 0, w, h);
      c.filter = 'blur(26px)';
      c.fillStyle = '#9a6634'; c.beginPath(); c.ellipse(1450, 160, 560, 230, -0.15, 0, TAU); c.fill();
      c.fillStyle = '#2e2a33'; c.beginPath(); c.ellipse(650, 360, 820, 180, 0.08, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,230,190,0.35)'; c.beginPath(); c.ellipse(500, 120, 420, 90, -0.1, 0, TAU); c.fill();
      c.filter = 'none';
    });
  }
  // the sunlit floor seen from above at an angle: warm planks, a window-pane-shaped patch of sun (陽だまり)
  const C11_IMPACT = [1180, 770];
  // the tear falls straight down (x fixed) past the neck, right of the hand where the dark fretboard shows it
  function c11DropY(u) { const kk = clamp((u - C11.drop) / (C11.land - C11.drop)); return lerp(-40, C11_TALL + C11_IMPACT[1], Math.pow(kk, 1.6)); }
  // the tilt bites at 35.6 and tracks the falling tear (it stays in the lower half of the frame) until it hits the floor
  function c11CamY(u) {
    if (u <= C11.tilt[0]) return 0;
    if (u >= C11.land) return C11_TALL;
    const ys = lerp(c11DropY(C11.tilt[0]), C11_IMPACT[1], (u - C11.tilt[0]) / (C11.land - C11.tilt[0]));
    return clamp((c11DropY(u) - ys) * sm(C11.tilt[0], C11.tilt[0] + 0.06, u), 0, C11_TALL);
  }
  function c11PlateB() {
    return PV.cached('g03:c11B:v3', W, H, (c) => {
      const vx = 980, vy = -2600, f0 = 0.0;
      const at = (x, y) => [lerp(vx, x, (y - vy) / (H + 60 - vy)), y];   // plank lines converge toward (vx, vy)
      c.fillStyle = '#9a6c44'; c.fillRect(0, 0, W, H);
      const r = PV.rng(311);
      for (let i = -12; i <= 13; i++) {
        const xa = 980 + i * 160, xb = xa + 160, tone = 0.86 + 0.24 * r();
        const p0 = at(xa, -20), p1 = at(xb, -20);
        c.fillStyle = `rgb(${Math.round(166 * tone)},${Math.round(118 * tone)},${Math.round(76 * tone)})`;
        c.beginPath(); c.moveTo(p0[0], -20); c.lineTo(p1[0], -20); c.lineTo(xb, H + 60); c.lineTo(xa, H + 60); c.closePath(); c.fill();
        for (let k = 0; k < 9; k++) { // grain: long wavy streaks and a knot now and then
          const f = (k + 0.3 + 0.4 * r()) / 9, x0 = lerp(xa, xb, f), q0 = at(x0, -20);
          c.strokeStyle = `rgba(${r() < 0.5 ? '92,58,32' : '196,150,104'},${0.1 + 0.12 * r()})`; c.lineWidth = 1 + r() * 2.2; c.beginPath();
          c.moveTo(q0[0], -20); c.bezierCurveTo(lerp(q0[0], x0, 0.33) + (r() - 0.5) * 20, H * 0.3, lerp(q0[0], x0, 0.66) + (r() - 0.5) * 20, H * 0.7, x0, H + 60); c.stroke();
        }
        c.strokeStyle = 'rgba(58,34,18,0.7)'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(p0[0], -20); c.lineTo(xa, H + 60); c.stroke();
        c.strokeStyle = 'rgba(232,196,150,0.25)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(p0[0] + 3, -20); c.lineTo(xa + 3, H + 60); c.stroke();
        if (r() < 0.45) { const yy = 120 + r() * 860, e0 = at(xa, yy), e1 = at(xb, yy); c.strokeStyle = 'rgba(58,34,18,0.6)'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(e0[0], yy); c.lineTo(e1[0], yy); c.stroke(); }
      }
      void f0;
      // the room's shade toward the edges
      c.fillStyle = radial(c, 980, 560, 1200, [[0, 'rgba(40,24,16,0)'], [0.55, 'rgba(40,24,16,0.22)'], [1, 'rgba(26,16,10,0.62)']]); c.fillRect(0, 0, W, H);
      // the patch of sun: the window's panes with the sash bars' shadows, soft-edged (penumbra)
      const pb = PV.makeCanvas(W, H), pc = pb.ctx;
      pc.fillStyle = '#fff0cc';
      pc.beginPath(); pc.moveTo(300, 40); pc.lineTo(1560, 150); pc.lineTo(1840, 1060); pc.lineTo(420, 1110); pc.closePath(); pc.fill();
      pc.globalCompositeOperation = 'destination-out'; pc.strokeStyle = '#000'; pc.lineCap = 'butt';
      pc.lineWidth = 46; pc.beginPath(); pc.moveTo(900, 90); pc.lineTo(1100, 1090); pc.stroke();
      pc.lineWidth = 30; pc.beginPath(); pc.moveTo(330, 540); pc.lineTo(1710, 610); pc.stroke();
      c.save(); c.filter = 'blur(9px)';
      c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.85; c.drawImage(pb.canvas, 0, 0);
      c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.16; c.drawImage(pb.canvas, 0, 0);
      c.restore();
      // macro depth of field (baked): sharp in a band through the point of impact, the far planks (top) and the
      // near ones (bottom) melting away
      { const sb = PV.makeCanvas(W / 4, H / 4), sbc = sb.ctx; sbc.filter = 'blur(3.5px)'; sbc.drawImage(c.canvas, -6, -6, W / 4 + 12, H / 4 + 12); sbc.filter = 'none';
        const mk = PV.makeCanvas(W, H), mc = mk.ctx; mc.drawImage(sb.canvas, 0, 0, W, H);
        mc.globalCompositeOperation = 'destination-in';
        mc.fillStyle = PV.linGrad(mc, 0, 0, 0, H, [[0, 'rgba(0,0,0,1)'], [0.3, 'rgba(0,0,0,0.75)'], [0.55, 'rgba(0,0,0,0)'], [0.82, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.85)']]); mc.fillRect(0, 0, W, H);
        c.drawImage(mk.canvas, 0, 0); }
      // the toe of his loafer at the lower left, near the lens (a soft dark shape with a sheen)
      c.filter = 'blur(22px)';
      c.fillStyle = 'rgba(30,24,30,0.9)'; c.beginPath(); c.ellipse(40, 1040, 250, 120, -0.55, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,236,206,0.3)'; c.beginPath(); c.ellipse(120, 960, 100, 22, -0.55, 0, TAU); c.fill();
      c.filter = 'none';
    });
  }
  function c11Grip(u) { return sm(C11.grip - 0.08, C11.grip + 0.08, u); }
  function drawC11Hand(c, u) {
    const g = c11Grip(u);
    // resting lightly on the strings while he listens, then the grip closes (the little finger comes down too)
    const press = [1, lerp(0.62, 1, g), lerp(0.55, 1, g), lerp(0.64, 1, g), lerp(0.2, 0.9, g)];
    const vib = g * (0.12 + 0.08 * N2(u * 3, 1.7));
    return L.handOnFrets(c, { x: C11_HAND.x, y: C11_HAND.y, scale: C11_HAND.scale, t: u, chord: [[5, 2], [6, 4], [7, 5], null], press,
      vibrato: { 1: vib, 2: vib * 0.8, 3: vib }, tremble: 0.12 + 0.7 * g, az: C11_HAND.az, el: C11_HAND.el, camRoll: C11_HAND.roll, light: -2.3, fretFrom: 1, fretTo: 19, arm: 900,
      keyColor: '#fff0d8', fillColor: '#a98a86', tint: 0.45 });
  }
  // the guitar body, joined to the neck at the 14th fret (neck-local units ~1.08/mm; x runs from the nut (0) toward the
  // body (negative), y across the neck (+ = treble side), z up from the fretboard). Drawn in device space from the
  // fretting rig's own projection, so it stays locked to the neck through the push-in. A worn sunburst top: amber in
  // the window light, burnt brown toward the edges (a dark field for the monologue), cream binding, the sound hole.
  const C11_BODY = (() => {
    const half = [[-6, 0], [0, 40], [8, 86], [25, 122], [55, 148], [95, 157], [140, 150], [185, 134], [225, 127], [265, 140], [310, 170], [360, 198], [410, 207], [455, 196], [495, 160], [525, 100], [540, 36], [543, 0]];
    const out = half.map(([s, w]) => [s, -w]).concat(half.slice(1, -1).reverse().map(([s, w]) => [s, w]));
    return { out, hole: [150, 0, 54] };
  })();
  // the headstock beyond the nut (x > 0), angled back ~14 deg, a dark rosewood face with six posts and the tuner
  // buttons on its sides; far from the lens, it melts into the out-of-focus field under the monologue
  function c11Headstock(c, rig) {
    const Pw = rig.Pneck, V = HM.V, zf = (x) => -4 - 0.11 * x;
    const hw = (x) => x < 14 ? lerp(24, 27, x / 14) : x < 46 ? lerp(27, 36, (x - 14) / 32) : x < 196 ? lerp(36, 42, (x - 46) / 150) : lerp(42, 30, (x - 196) / 14);
    const P = (x, y, dz) => Pw(V(x, y, zf(x) + (dz || 0)));
    const xs = []; for (let i = 0; i <= 14; i++) xs.push(lerp(2, 210, i / 14));
    const poly = (dz) => xs.map(x => P(x, -hw(x), dz)).concat(xs.slice().reverse().map(x => P(x, hw(x), dz)));
    const fill = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach((p, i) => { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); c.closePath(); c.fill(); };
    // the side tuner shafts and buttons (chrome, catching the window)
    const posts = [[62, -1], [108, -1], [154, -1], [62, 1], [108, 1], [154, 1]];
    for (const [x, s] of posts) {
      const a = P(x, s * hw(x), -9), b = P(x, s * (hw(x) + 24), -9), r = Math.max(2.5, 6 * b.k);
      c.strokeStyle = '#5e5850'; c.lineWidth = Math.max(2, 4 * a.k); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.fillStyle = '#8d877c'; c.beginPath(); c.ellipse(b.x, b.y, r * 1.5, r, Math.atan2(b.y - a.y, b.x - a.x) + HP, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,246,226,0.55)'; c.beginPath(); c.arc(b.x - r * 0.4, b.y - r * 0.4, r * 0.4, 0, TAU); c.fill();
    }
    fill(poly(-14), '#160d08');                            // the headstock's thickness
    fill(poly(0), '#2a1a12');                              // its face
    const f0 = P(10, -30), f1 = P(200, 30), g = c.createLinearGradient(f0.x, f0.y, f1.x, f1.y);
    g.addColorStop(0, 'rgba(255,232,196,0.22)'); g.addColorStop(0.5, 'rgba(255,232,196,0.05)'); g.addColorStop(1, 'rgba(255,232,196,0.14)');
    fill(poly(0.2), g);
    // strings from the nut to their posts
    const order = [[6, 0], [5, 1], [4, 2], [3, 5], [2, 4], [1, 3]];
    for (const [si, pi] of order) {
      const k = (6 - si) / 5, y0 = lerp(-20.5, 20.5, k), post = posts[pi], pa = P(0, y0, 1.5), pb = P(post[0], post[1] * 26, 1.5);
      c.strokeStyle = si >= 4 ? 'rgba(205,187,152,0.85)' : 'rgba(232,228,218,0.85)'; c.lineWidth = Math.max(1, (0.6 + 0.16 * si) * pa.k);
      c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke();
    }
    for (const [x, s] of posts) { const p = P(x, s * 26, 2); c.fillStyle = '#8f897e'; c.beginPath(); c.arc(p.x, p.y, Math.max(2, 3.6 * p.k), 0, TAU); c.fill(); }
  }
  function c11Body(c, rig) {
    const Pw = rig.Pneck, X0 = rig.fretX(14), V = HM.V, zt = -8;
    const P = (s, y, z) => Pw(V(X0 - s, y, z == null ? zt : z));
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c11Headstock(c, rig);
    // the side of the body (its depth) peeking below the top's treble edge, in shade
    c.fillStyle = '#24160f'; c.beginPath();
    C11_BODY.out.forEach(([s, y], i) => { const p = P(s, y, zt - 105); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); c.closePath(); c.fill();
    // the top
    const pts = C11_BODY.out.map(([s, y]) => P(s, y));
    const hc = P(150, 0), e0 = P(0, -150), e1 = P(470, 190);
    c.beginPath(); pts.forEach((p, i) => { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); c.closePath();
    const rr = Math.hypot(e1.x - hc.x, e1.y - hc.y);
    const g = c.createRadialGradient(hc.x - rr * 0.12, hc.y - rr * 0.1, rr * 0.05, hc.x, hc.y, rr * 1.05);
    g.addColorStop(0, '#e2a861'); g.addColorStop(0.38, '#c07a3c'); g.addColorStop(0.7, '#6e3f1f'); g.addColorStop(1, '#2c180d');
    c.fillStyle = g; c.fill();
    // window light raking across the top from the upper left (the sheen of the lacquer)
    c.save(); c.clip();
    const lg = c.createLinearGradient(e0.x, e0.y, e1.x, e1.y); lg.addColorStop(0, 'rgba(255,236,200,0.5)'); lg.addColorStop(0.35, 'rgba(255,230,190,0.12)'); lg.addColorStop(1, 'rgba(255,230,190,0)');
    c.globalCompositeOperation = 'screen'; c.fillStyle = lg; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    c.restore();
    // cream binding along the edge
    c.strokeStyle = 'rgba(244,226,192,0.85)'; c.lineWidth = Math.max(2, 3.2 * hc.k); c.beginPath(); pts.forEach((p, i) => { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); c.closePath(); c.stroke();
    // rosette rings and the sound hole
    const ring = (r, z) => { c.beginPath(); for (let i = 0; i <= 28; i++) { const a = i / 28 * TAU, p = P(150 + Math.cos(a) * r, Math.sin(a) * r, z); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); } c.closePath(); };
    ring(70); c.strokeStyle = 'rgba(40,24,14,0.75)'; c.lineWidth = Math.max(2, 2.6 * hc.k); c.stroke();
    ring(63); c.strokeStyle = 'rgba(236,214,170,0.8)'; c.lineWidth = Math.max(2, 4 * hc.k); c.stroke();
    ring(54); c.fillStyle = '#120a06'; c.fill();
    // the strings run on over the top to the bridge
    const xb = rig.fretX(19) - 4;
    for (let si = 1; si <= 6; si++) {
      const k = (6 - si) / 5, y0 = lerp(-27.6, 27.6, k), y1 = lerp(-31, 31, k);
      const a = Pw(V(xb, y0, 2.6)), b = P(400, y1, zt + 11);
      c.strokeStyle = si >= 4 ? 'rgba(205,187,152,0.9)' : 'rgba(232,228,218,0.9)'; c.lineWidth = Math.max(1, (0.6 + 0.16 * si) * a.k);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    c.restore();
  }
  // the tear: a small clear lens -- the bright window refracted in its upper half, the darker room in its lower half,
  // a crisp specular point and a caustic crescent; a faint streak trails it by its speed relative to the frame, and a
  // small four-point glint flickers as it falls through the window light
  function drawDrop(ctx, x, y, r, stretch, a, u) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
    const ry = r * (1 + 0.16 * Math.min(1, stretch / 4)), tail = r * stretch * 3.2;
    const g = ctx.createLinearGradient(0, -tail, 0, 0); g.addColorStop(0, 'rgba(255,248,232,0)'); g.addColorStop(1, 'rgba(255,248,232,0.5)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-r * 0.45, -ry * 0.2); ctx.lineTo(0, -tail); ctx.lineTo(r * 0.45, -ry * 0.2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, r, ry, 0, 0, TAU);
    const body = ctx.createLinearGradient(0, -ry, 0, ry);
    body.addColorStop(0, 'rgba(255,251,242,0.92)'); body.addColorStop(0.42, 'rgba(226,200,170,0.55)'); body.addColorStop(0.7, 'rgba(120,86,62,0.62)'); body.addColorStop(1, 'rgba(64,42,30,0.8)');
    ctx.fillStyle = body; ctx.fill();
    ctx.strokeStyle = 'rgba(52,34,24,0.75)'; ctx.lineWidth = Math.max(1.5, r * 0.13); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,206,0.95)'; ctx.lineWidth = Math.max(1.2, r * 0.15); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.74, ry * 0.74, 0, PI * 0.22, PI * 0.78); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-r * 0.33, -ry * 0.4, r * 0.27, r * 0.17, -0.6, 0, TAU); ctx.fill();
    ctx.restore();
    glowAt(ctx, x, y, r * 6, '#fff2d8', 0.5 * a);
    const tw = a * (0.55 + 0.45 * Math.abs(Math.sin((u || 0) * 37)));
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const [dx, dy, L0] of [[1, 0, r * 4.2], [0, 1, r * 3.2]]) {
      const lg = ctx.createLinearGradient(x - dx * L0, y - dy * L0, x + dx * L0, y + dy * L0);
      lg.addColorStop(0, 'rgba(255,248,228,0)'); lg.addColorStop(0.5, `rgba(255,252,240,${(0.85 * tw).toFixed(3)})`); lg.addColorStop(1, 'rgba(255,248,228,0)');
      ctx.strokeStyle = lg; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - r * 0.33 - dx * L0, y - r * 0.4 - dy * L0); ctx.lineTo(x - r * 0.33 + dx * L0, y - r * 0.4 + dy * L0); ctx.stroke();
    }
    ctx.restore();
  }
  // slow-motion splash on the planks (age in real seconds since impact; the cut runs it ~4x slower): the tear flattens,
  // throws up a thin translucent crown whose rim breaks into beads, a little jet rises from the centre, droplets arc
  // out glinting in the sun, and a dark wet mark is left in the grain
  function drawSplash(ctx, x, y, age) {
    const s = age / 4.2, K = 2.5;           // simulated seconds; K = size on screen
    if (s < 0) return;
    ctx.save();
    // wet mark (irregular, darker, with a sliver of sun on its far edge)
    const wr = (20 * (1 - Math.exp(-s * 34)) + 6) * K;
    const wetPath = (k) => { ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, rr = k * wr * (1 + 0.12 * Math.sin(a * 3 + 1.3) + 0.07 * Math.sin(a * 7 + 0.4)); const px = x + Math.cos(a) * rr * 1.32, py = y + Math.sin(a) * rr * 0.5; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath(); };
    ctx.fillStyle = 'rgba(110,66,30,0.12)'; wetPath(1.08); ctx.fill();
    ctx.fillStyle = 'rgba(100,60,28,0.18)'; wetPath(1.0); ctx.fill();
    ctx.fillStyle = 'rgba(255,236,200,0.1)'; wetPath(0.7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,244,220,0.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(x - wr * 0.1, y - wr * 0.06, wr * 1.1, wr * 0.38, 0.02, PI * 1.12, PI * 1.7); ctx.stroke();
    // a ripple running out through the thin film of water, catching the sun
    { const rk = clamp(s / 0.18), rr2 = wr * (1.05 + 1.6 * PV.ease.outCubic(rk)), ra = 0.55 * (1 - rk) * sm(0.0, 0.02, s);
      if (ra > 0.01) { ctx.strokeStyle = `rgba(255,248,226,${ra.toFixed(3)})`; ctx.lineWidth = 1.4 + 1.2 * (1 - rk); ctx.beginPath(); ctx.ellipse(x, y, rr2 * 1.32, rr2 * 0.5, 0, PI * 1.05, PI * 1.95); ctx.stroke();
        ctx.strokeStyle = `rgba(255,248,226,${(ra * 0.45).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(x, y, rr2 * 1.32, rr2 * 0.5, 0, PI * 0.1, PI * 0.9); ctx.stroke(); } }
    // crown: translucent sheet, back wall then front wall, scalloped rim with beads
    const ck = Math.min(1, s / 0.05), cd = 1 - sm(0.06, 0.15, s);
    if (cd > 0.01) {
      const cr = (8 + 24 * ck) * K, chh = 22 * K * Math.sin(Math.min(PI, (s + 0.01) / 0.15 * PI)) * cd, n = 28;
      const rimH = (a) => chh * (0.82 + 0.18 * Math.cos(a * 9 + 0.7));
      for (const front of [false, true]) {
        const a0 = front ? 0 : PI, a1 = front ? PI : TAU;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); ctx.lineTo(x + Math.cos(a) * cr * 1.32, y + Math.sin(a) * cr * 0.5); }
        for (let i = n; i >= 0; i--) { const a = lerp(a0, a1, i / n); ctx.lineTo(x + Math.cos(a) * cr * 1.42, y + Math.sin(a) * cr * 0.54 - rimH(a)); }
        ctx.closePath();
        // the back wall glows with the sun behind it; the front wall is a clear sheet (mostly its lit rim)
        const g = ctx.createLinearGradient(x, y, x, y - chh); g.addColorStop(0, `rgba(255,240,214,${(front ? 0.1 : 0.2) * cd})`); g.addColorStop(1, `rgba(255,252,240,${(front ? 0.36 : 0.62) * cd})`);
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = `rgba(255,252,242,${(front ? 0.75 : 0.95) * cd})`; ctx.lineWidth = front ? 1.8 : 2.4; ctx.beginPath();
        for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); const px = x + Math.cos(a) * cr * 1.42, py = y + Math.sin(a) * cr * 0.54 - rimH(a); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
        for (let i = 0; i < 9; i++) { // beads where the rim breaks up
          const a = lerp(a0, a1, (i + 0.5) / 9) + 0.1 * R1(i, front ? 3 : 4), lift = sm(0.03, 0.09, s) * 7 * K * (0.5 + R1(i, 5));
          const px = x + Math.cos(a) * cr * 1.46, py = y + Math.sin(a) * cr * 0.55 - rimH(a) - lift;
          ctx.fillStyle = `rgba(255,255,255,${0.95 * cd})`; ctx.beginPath(); ctx.arc(px, py, (1.2 + 0.8 * R1(i, 6)) * K, 0, TAU); ctx.fill();
        }
      }
    }
    // the little jet rising from the centre, its tip pinching off into a bead
    const jk = sm(0.04, 0.09, s) * (1 - sm(0.14, 0.2, s));
    if (jk > 0.01) {
      const jh = 30 * K * Math.sin(Math.min(PI, (s - 0.04) / 0.16 * PI));
      ctx.strokeStyle = `rgba(255,250,236,${0.7 * jk})`; ctx.lineWidth = 3 * K * 0.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x, y - jh * 0.75); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.95 * jk})`; ctx.beginPath(); ctx.arc(x, y - jh, 2.6 * K, 0, TAU); ctx.fill();
      glowAt(ctx, x, y - jh, 18 * K, '#fff6e6', 0.5 * jk);
    }
    // droplets thrown out in slow arcs, glinting in the sun
    const nd = 9;
    for (let i = 0; i < nd; i++) {
      const a = (i / nd) * TAU + R1(i, 3) * 0.6, v = (90 + 130 * R1(i, 4)) * K, vz = (170 + 210 * R1(i, 6)) * K;
      const T0 = 0.015 + 0.02 * R1(i, 8), q = s - T0; if (q < 0) continue;
      const hz = vz * q - 0.5 * 2400 * K * q * q; if (hz < 0 && q > 0.04) continue;
      const px = x + Math.cos(a) * v * q * 1.3, py = y + Math.sin(a) * v * q * 0.5 - Math.max(0, hz);
      const rr = (1.4 + 1.5 * R1(i, 9)) * K;
      ctx.fillStyle = 'rgba(255,250,240,0.95)'; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,1)'; ctx.beginPath(); ctx.arc(px - rr * 0.3, py - rr * 0.3, rr * 0.38, 0, TAU); ctx.fill();
      glowAt(ctx, px, py, rr * 7, '#fff3dc', 0.38);
    }
    ctx.restore();
    // a flash at the instant of impact, then a soft glint on the wet spot
    glowAt(ctx, x, y - 6, 190, '#fff6e6', 0.7 * Math.exp(-s * 50));
    glowAt(ctx, x - 12, y - 4, 30, '#ffffff', 0.3 * sm(0.05, 0.12, s));
  }
  // vertical motion smear of a full frame (the whip tilt): halve the height step by step (each step averages two rows,
  // so nothing aliases into stripes), then stretch the few remaining rows back over the frame
  function vSmear(ctx, src, amt) {
    if (amt <= 0.01) { ctx.drawImage(src, 0, 0); return; }
    const q = 0.25, w = W * q; let h = H * q;
    const steps = Math.round(lerp(1, 5, clamp(amt)));
    let b = PV.buffer('g03:vsm0', w, h); b.ctx.clearRect(0, 0, w, h); b.ctx.drawImage(src, 0, 0, w, h);
    for (let i = 0; i < steps; i++) {
      const nh = Math.max(4, Math.round(h / 2)), nb = PV.buffer('g03:vsm' + ((i + 1) % 2 + 1), w, H * q);
      nb.ctx.clearRect(0, 0, w, H * q); nb.ctx.drawImage(b.canvas, 0, 0, w, h, 0, 0, w, nh); b = nb; h = nh;
    }
    ctx.save(); ctx.drawImage(src, 0, 0);
    ctx.globalAlpha = clamp(amt * 1.5); ctx.imageSmoothingQuality = 'low'; ctx.drawImage(b.canvas, 0, 0, w, h, 0, 0, W, H); ctx.restore();
  }
  PV.shot('C11', { draw(ctx, t, d, S) {
    const tt = clamp(t, -0.3, d + 0.3), u = localT(S, 'C11', tt);
    // camera: static on the hand (a little push as the grip tightens), then a whip tilt down after the drop,
    // settling with a small overshoot on the floor
    const gripK = sm(C11.grip - 0.05, C11.grip + 0.5, u);
    const settle = u > C11.land ? 26 * Math.exp(-(u - C11.land) * 9) * Math.sin((u - C11.land) * 28) : 0;
    const camY = c11CamY(u) + settle;
    const speed = (c11CamY(u + 0.02) - c11CamY(u - 0.02)) / 0.04;   // px/s
    const zoomA = 1 + 0.05 * gripK + 0.008 * Math.sin(u * 1.3);
    const smearAmt = clamp((speed - 500) / 8000), direct = smearAmt <= 0.01;
    const v = direct ? null : PV.buffer('g03:c11v'), c = direct ? ctx : v.ctx;
    // plate A (+ the live hand) at y = -camY
    if (camY < H + 40) {
      c.save(); c.translate(0, -camY); c.drawImage(c11PlateA(), 0, 0); c.restore();
      // the hand and neck go into their own layer first, so the guitar body can be slid in behind the neck
      const HB = PV.buffer('g03:c11hand'), hc = HB.ctx;
      hc.clearRect(0, 0, W, H); hc.save(); hc.translate(0, -camY); PV.camera(hc, { zoom: zoomA, cx: C11_HAND.x, cy: C11_HAND.y });
      const rig = drawC11Hand(hc, u); hc.restore();
      // the grip: the skin over the knuckles pales as it stretches (only on the hand itself)
      const gk = c11Grip(u);
      if (gk > 0.01) {
        hc.save(); hc.globalCompositeOperation = 'source-atop';
        for (let i = 1; i <= 4; i++) {
          const j = rig.joints[i]; if (!j) continue;
          for (let n = 0; n < 2 && n < j.length; n++) {
            const r = (n ? 17 : 22) * C11_HAND.scale / 4.5, a = (n ? 0.22 : 0.16) * gk;
            hc.fillStyle = radial(hc, j[n].x, j[n].y, r, [[0, PV.rgba('#fff7ee', a)], [0.5, PV.rgba('#fff7ee', a * 0.45)], [1, 'rgba(255,247,238,0)']]); hc.fillRect(j[n].x - r, j[n].y - r, r * 2, r * 2);
          }
        }
        hc.restore();
      }
      c11Body(c, rig);
      c.drawImage(HB.canvas, 0, 0);
      // macro depth of field: sharp around the knuckles; the neck running away toward the head and the body melts.
      // (a low-res blurred copy of the frame with its centre cut out, laid back over the sharp frame)
      if (camY < 400 && smearAmt < 0.2) {   // (inside the whip the motion smear swamps it)
        const q = 0.25, bl = lowBlur(c.canvas, q, 12, 'c11'), bc = bl.getContext('2d');
        const fx = (C11_HAND.x + 130) * q, fy = (C11_HAND.y - camY) * q;
        bc.globalCompositeOperation = 'destination-out';
        bc.fillStyle = radial(bc, fx, fy, 640 * q, [[0, 'rgba(0,0,0,1)'], [0.42, 'rgba(0,0,0,0.96)'], [0.72, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]);
        bc.fillRect(0, 0, W * q, H * q); bc.globalCompositeOperation = 'source-over';
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingQuality = 'low'; c.drawImage(bl, 0, 0, W * q, H * q, 0, 0, W, H); c.restore();
      }
      c.save(); c.translate(0, -camY);
      L.dust(c, u, { seed: 41, count: 46, size: 2.6, alpha: 0.5, drift: 40, vx: 6, vy: -5, color: '#fff3dc' });
      c.restore();
    }
    if (camY > 20 && camY < C11_TALL + 40) { c.save(); c.translate(0, H - camY); c.drawImage(c11Transition(), 0, 0); c.restore(); }
    if (camY > C11_TALL - H - 40) {
      c.save(); c.translate(0, C11_TALL - camY);
      c.drawImage(c11PlateB(), 0, 0);
      c.restore();
    }
    // ---- composite (with a vertical smear during the whip)
    if (!direct) vSmear(ctx, v.canvas, smearAmt);
    // the tear (world y in the tall canvas): enters at the top of plate A, crosses the neck at 35.6, lands at 35.75.
    // The tilt follows it, so it stays crisp over the smeared room; its streak is its speed relative to the frame.
    const dropK = (u - C11.drop) / (C11.land - C11.drop);
    if (dropK > -0.05 && dropK < 1) {
      const vy = (c11DropY(u + 0.02) - c11DropY(u - 0.02)) / 0.04 - speed;
      drawDrop(ctx, C11_IMPACT[0], c11DropY(u) - camY, 17, clamp(Math.abs(vy) / 1400, 0.6, 5), 1, u);
    }
    // after landing: the shaft of sun the drop fell through, dust, and the slow splash (screen space, crisp)
    if (camY > C11_TALL - 200) {
      const oy = C11_TALL - camY;
      ctx.save(); ctx.translate(0, oy);
      L.godRays(ctx, u, { x: 300, y: -500, angle: 1.1, spread: 0.25, count: 5, length: 2200, width: 260, alpha: 0.1, color: '#fff1d4', seed: 7, jitter: 300 });
      L.dust(ctx, u, { seed: 44, count: 60, x0: 300, x1: 1700, y0: 0, y1: H, size: 2.8, alpha: 0.6, drift: 50, vx: 4, vy: -3, color: '#fff3dc' });
      ctx.restore();
      if (u >= C11.land) drawSplash(ctx, C11_IMPACT[0], C11_IMPACT[1] + oy, u - C11.land);
    }
    // a warm leak from the window side
    glowAt(ctx, -80, -60, 900, '#ffe8c6', 0.26);
  } });

  /* ========================================================================== C12
   * The two of them in the window light, from the side and a little in front (both faces 3/4, cheated toward the lens):
   * she stands by the piano (left), he sits on a chair with the school acoustic on his lap (right). The chime's last note
   * (36.5); he cries without a sound, head down, and says V04 「俺……先輩の音。好きだよ」 (36.80 / 37.88–38.88 / 39.59–40.05):
   * on 「好きだよ」 he lifts his eyes to her (design 3-4: the core line is said looking straight at her). She goes from the
   * startled face she came over with (原作866) to a soft, moved one. A branch sways beyond the glass, dust sinks through the
   * band of light; a very slow push-in. */
  const C12_CAM = { eye: [8.32, 1.28, 6.0], target: [8.32, 1.1, 2.5], fov: 40 };
  const C12_PIANO = { x: 6.95, z: 2.75, yaw: 1.18 };
  const C12_GIRL = [7.9, 0, 2.6], C12_BOY = [8.8, 0.427, 2.42];
  const C12_HER_DIR = (() => { const l = Math.hypot(1, 0.62); return [1 / l, 0.62 / l]; })();     // toward him, cheated toward the lens
  const C12_HIS_DIR = (() => { const l = Math.hypot(1, 0.66); return [-1 / l, 0.66 / l]; })();    // toward her, cheated toward the lens
  // anime "on twos": a figure layer repainted only when its stamp changes (paint is a pure function of the stamp)
  const TW = {};
  function twos(key, stamp, paint) {
    const b = PV.buffer('g03:2s:' + key);
    if (TW[key] !== stamp) { TW[key] = stamp; b.ctx.setTransform(1, 0, 0, 1, 0, 0); b.ctx.globalAlpha = 1; b.ctx.globalCompositeOperation = 'source-over'; b.ctx.clearRect(0, 0, W, H); paint(b.ctx); }
    return b.canvas;
  }
  const lerpObj = (a, b, k) => { const o = {}; for (const key of new Set(Object.keys(a).concat(Object.keys(b)))) { const x = a[key], y = b[key]; o[key] = (typeof x === 'number' && typeof y === 'number') ? x + (y - x) * k : (k < 0.5 ? (x === undefined ? y : x) : (y === undefined ? x : y)); } return o; };
  function lerpDeep(a, b, k) {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * k;
    if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => lerpDeep(v, b[i], k));
    if (a && b && typeof a === 'object' && typeof b === 'object') { const o = {}; for (const key in a) o[key] = key in b ? lerpDeep(a[key], b[key], k) : a[key]; for (const key in b) if (!(key in o)) o[key] = b[key]; return o; }
    return k < 0.5 ? a : b;
  }
  // her pose: the library's 'stand', the right hand rising from her side to her chest (prm.k 0..1) -- registered under a g03_
  // name in PV.anime.FIG_POSES only for the duration of the call
  const G03_CHEST = 'g03_standChest';
  const standChestPose = {
    facing: 'front', anchor: 'ground point between the feet',
    body(sp, prm, tq, o, OF) { return AN().FIG_POSES.stand.body(sp, prm, tq, o, OF); },
    props(G, prm, tq, o) { },
    limbs(J, sp, prm, tq, o, OF) {
      const B = AN().FIG_POSES.stand, k = prm.k || 0;
      const a = B.limbs(J, sp, Object.assign({}, prm, { arms: 'relax' }), tq, o, OF), b = B.limbs(J, sp, Object.assign({}, prm, { arms: 'chest' }), tq, o, OF);
      const R = lerpDeep(a.arms.R, b.arms.R, k); R.hand = Object.assign({}, R.hand, { curl: lerp(0.3, 0.42, k), spread: lerp(0.06, 0.03, k) });
      return { legs: a.legs, arms: { L: a.arms.L, R } };
    },
  };
  function withPose(name, def, fn) {
    const P = AN().FIG_POSES, had = Object.prototype.hasOwnProperty.call(P, name), old = P[name];
    P[name] = def;
    try { return fn(); } finally { if (had) P[name] = old; else delete P[name]; }
  }
  // her face (global time T, on twos): startled -> the surprise eases on 「先輩の音」 -> soft and moved, eyes welling, on 「好きだよ」
  function c12HerHead(T) {
    const E = AN().EXPR, s1 = sm(37.55, 38.3, T), s2 = sm(39.45, 40.1, T);
    const sur = { eyes: { open: 1.12, wide: 0.7, pupil: 0.78, look: [0.55, 0.32] }, brows: { inner: 0.75, outer: 0.55, furrow: 0 }, mouth: { shape: 'o', open: 0.22 }, blush: 0.12 };
    const ease = { eyes: { open: 1.0, wide: 0.15, pupil: 0.9, sad: 0.15, look: [0.55, 0.36] }, brows: { inner: 0.62, outer: 0.05, furrow: 0.12 }, mouth: { shape: 'o', open: 0.05 }, blush: 0.18 };
    const soft = { eyes: { open: 0.84, smile: 0.36, tears: 0.56, sad: 0.16, pupil: 1, look: [0.55, 0.3] }, brows: { inner: 0.58, outer: -0.1, furrow: 0 }, mouth: { shape: 'smile', open: 0 }, blush: 0.44 };
    const A1 = s1 < 1 ? { eyes: lerpObj(sur.eyes, ease.eyes, s1), brows: lerpObj(sur.brows, ease.brows, s1), mouth: lerpObj(sur.mouth, ease.mouth, s1), blush: lerp(sur.blush, ease.blush, s1) } : ease;
    const R = s2 > 0 ? { eyes: lerpObj(A1.eyes, soft.eyes, s2), brows: lerpObj(A1.brows, soft.brows, s2), mouth: s2 < 0.5 ? { shape: 'o', open: A1.mouth.open * (1 - 2 * s2) } : { shape: 'smile', open: 0 }, blush: lerp(A1.blush, soft.blush, s2) } : A1;
    void E;
    return Object.assign({ expr: s2 > 0.5 ? 'gentle' : 'surprise', noBlink: s1 < 0.6 }, R);
  }
  // his face (global time T): head down, tears streaming, the line said quietly (a small mouth from the real voice); he lifts
  // his eyes to her for 「好きだよ」
  function c12HisHead(T) {
    const up = sm(39.0, 39.5, T), mo = AN().mouth(T, 'boy');
    return {
      expr: 'sad', noBlink: true,
      eyes: { open: lerp(0.5, 0.88, up), tears: 0.95, sad: lerp(0.6, 0.28, up), look: [lerp(-0.25, -0.75, up), lerp(0.62, -0.3, up)] },
      brows: { inner: lerp(0.8, 0.6, up), outer: -0.22, furrow: lerp(0.35, 0.15, up) },
      mouth: { shape: 'frown', open: 0.42 * mo.open + 0.04 }, blush: 0.32,
    };
  }
  // a cherry branch just outside the bay behind them (fresh leaves, a few last blossoms), swaying in the wind; seen
  // where the glass is clear of the curtains (the transoms + the middle of the bay), soft (focus is on the room)
  function c12BranchSprite() {
    return PV.cached('g03:c12branch', 900, 560, (c) => {
      const r = PV.rng(1212);
      const twig = (x0, y0, ang, len, w, depth) => {
        let x = x0, y = y0, a = ang; const pts = [[x, y]];
        for (let i = 0; i < 6; i++) { a += (r() - 0.5) * 0.35 + 0.05; x += Math.cos(a) * len / 6; y += Math.sin(a) * len / 6; pts.push([x, y]); }
        c.strokeStyle = '#5a4638'; c.lineCap = 'round';
        for (let i = 1; i < pts.length; i++) { c.lineWidth = Math.max(1.2, w * (1 - i / pts.length)); c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
        for (let i = 2; i < pts.length; i++) { // leaf clusters along the twig, blossoms here and there
          const [px, py] = pts[i];
          for (let k = 0; k < 5; k++) {
            const lx = px + (r() - 0.5) * 46, ly = py + (r() - 0.3) * 34, rr = 7 + r() * 9, blossom = r() < 0.16;
            c.fillStyle = blossom ? (r() < 0.5 ? '#f6c9d6' : '#ffe2ea') : (r() < 0.5 ? '#8fbf63' : '#b3d77f');
            c.save(); c.translate(lx, ly); c.rotate(r() * TAU); c.beginPath(); c.ellipse(0, 0, rr, rr * (blossom ? 0.9 : 0.55), 0, 0, TAU); c.fill(); c.restore();
          }
          if (depth > 0 && r() < 0.5) twig(px, py, a + (r() < 0.5 ? -0.7 : 0.6), len * 0.45, w * 0.5, depth - 1);
        }
      };
      twig(880, 30, PI - 0.25, 760, 12, 2);
      twig(870, 90, PI + 0.12, 460, 7, 1);
    });
  }
  function c12BranchSoft() {
    return PV.cached('g03:c12branchSoft', 900, 560, (c) => { c.filter = 'blur(2.4px)'; c.drawImage(c12BranchSprite(), 0, 0); c.filter = 'none'; });
  }
  function c12Branch(ctx, R, u) {
    const [x0, x1] = BAYS[2];
    const regions = [[x0 + 0.6, x1 - 0.72, 0.92, 2.28], [x0 + 0.08, x1 - 0.08, 2.39, 2.74]];
    ctx.save();
    ctx.beginPath();
    for (const [a, b, y0, y1] of regions) { const q = [[a, y0, -0.09], [b, y0, -0.09], [b, y1, -0.09], [a, y1, -0.09]].map(p => R.project(p)); ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath(); }
    ctx.clip();
    // (the sprite was drawn for a wide lens: 0.8 at ~167 px/m at the branch -- scale it with the camera's magnification there)
    const bw = [x1 + 0.3, R.cam.scaleAt([x1, 2, -0.9]) > 300 ? 2.02 : 2.66, -0.9], base = R.project(bw), k = 0.8 * Math.min(1.5, R.cam.scaleAt(bw) / 167), sway = 0.045 * Math.sin(u * 1.25) + 0.03 * N2(u * 0.7, 3.3);
    ctx.translate(base[0], base[1]); ctx.rotate(sway); ctx.scale(k, k);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(c12BranchSoft(), -880, -30);
    ctx.restore();
  }
  // the static half of the set under the fixed 3D camera, memoised (a pure function of the camera): the piano cut to
  // its painted box, and the three sun shafts between them pre-rendered soft at quarter resolution (each its own
  // sprite so they can breathe independently)
  let c12G = null;
  function c12Geom(R) {
    if (c12G) return c12G;
    const pb = PV.makeCanvas(W, H);
    L.grandPiano(pb.ctx, R.piano(C12_PIANO.x, C12_PIANO.z, C12_PIANO.yaw, { lidOpen: 1, bench: true, rimLit: { alpha: 1 } }));
    const img = pb.ctx.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (img[(y * W + x) * 4 + 3] > 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    x0 = Math.max(0, x0 - 4); y0 = Math.max(0, y0 - 4); x1 = Math.min(W, x1 + 6); y1 = Math.min(H, y1 + 6);
    const pc = PV.makeCanvas(Math.max(2, x1 - x0), Math.max(2, y1 - y0)); pc.ctx.drawImage(pb.canvas, -x0, -y0);
    // shafts of sun between them: from the top of the window behind, along the sun (noon: [0.55, -0.56, 0.62]) down to the floor
    const sun = [0.55, -0.56, 0.62], xm = (C12_GIRL[0] + C12_BOY[0]) / 2, rays = [], rr = PV.rng(31);
    for (let i = 0; i < 3; i++) {
      const sx = xm - 0.95 + (i - 1) * 0.42 + (rr() - 0.5) * 0.2, top = [sx, 2.32, -0.05], kf = top[1] / -sun[1], bot = [top[0] + sun[0] * kf, 0, top[2] + sun[2] * kf];
      const a = R.project(top), e = R.project(bot), wa = (0.16 + 0.12 * rr()) * R.cam.scaleAt(top), we = wa * 2.4, al = 0.2 * (0.6 + 0.4 * rr());
      const ang = Math.atan2(e[1] - a[1], e[0] - a[0]), nx = Math.cos(ang + HP), ny = Math.sin(ang + HP);
      const pts = [[a[0] + nx * wa / 2, a[1] + ny * wa / 2], [e[0] + nx * we / 2, e[1] + ny * we / 2], [e[0] - nx * we / 2, e[1] - ny * we / 2], [a[0] - nx * wa / 2, a[1] - ny * wa / 2]];
      const bx0 = Math.min(...pts.map(p => p[0])) - 40, by0 = Math.min(...pts.map(p => p[1])) - 40, bx1 = Math.max(...pts.map(p => p[0])) + 40, by1 = Math.max(...pts.map(p => p[1])) + 40;
      const q = 0.25, sw = Math.ceil((bx1 - bx0) * q), sh = Math.ceil((by1 - by0) * q), sp = PV.makeCanvas(sw, sh), c = sp.ctx;
      c.filter = 'blur(3px)'; c.setTransform(q, 0, 0, q, -bx0 * q, -by0 * q);
      const g = c.createLinearGradient(a[0], a[1], e[0], e[1]); g.addColorStop(0, `rgba(255,242,214,${al})`); g.addColorStop(0.45, `rgba(255,242,214,${al * 0.7})`); g.addColorStop(1, 'rgba(255,242,214,0)');
      c.fillStyle = g; c.beginPath(); pts.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill();
      rays.push({ img: sp.canvas, x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
    }
    // the window glow behind them and the three shafts composed once into one quarter-resolution light layer (one screen pass)
    const mid = R.project([xm, 1.35, 2.2]), lb = PV.makeCanvas(W / 4, H / 4), lc = lb.ctx;
    lc.scale(0.25, 0.25);
    lc.fillStyle = radial(lc, mid[0] - 40, mid[1] - 120, 620, [[0, 'rgba(255,244,222,0.18)'], [0.3, 'rgba(255,244,222,0.076)'], [1, 'rgba(255,244,222,0)']]); lc.fillRect(0, 0, W, H);
    lc.globalCompositeOperation = 'lighter'; for (const r of rays) lc.drawImage(r.img, r.x, r.y, r.w, r.h);
    c12G = { piano: pc.canvas, px: x0, py: y0, rays, mid, light: lb.canvas };
    return c12G;
  }
  const C12_ROOM = { R: null };
  function c12Plate() {
    return PV.cached('g03:c12plate:v1', W, H, (c) => {
      C12_ROOM.R = L.musicRoom(c, SB.C12 + 1.5, { view: 'windows', time: 'noon', furniture: 'none', wind: 0.3, cam: C12_CAM, shaft: 1.6, dust: false });
      const G = c12Geom(C12_ROOM.R);
      c.drawImage(G.piano, G.px, G.py);
      // the same afternoon wash as C10
      c.save(); c.globalCompositeOperation = 'soft-light';
      c.fillStyle = PV.linGrad(c, 0, 0, W * 0.8, H, [[0, 'rgba(255,226,176,0.3)'], [0.55, 'rgba(255,220,176,0.15)'], [1, 'rgba(255,214,170,0.05)']]); c.fillRect(0, 0, W, H); c.restore();
    });
  }
  // 彼 on the school chair with the acoustic on his right thigh (his left hand still holding the neck), head down, crying; the
  // head comes up for 「好きだよ」. Painted at drawing time Tq (on twos, in step with his lip-sync), in the room camera's space
  function c12Him(c, R, Tq) {
    const P = figPlace(R.cam, C12_BOY, C12_HIS_DIR, 'boy', 0.45), up = sm(39.0, 39.5, Tq);
    return AN().figure(c, {
      who: 'boy', outfit: 'uniform', pose: 'seated_chair', facing: P.facing, camPitch: P.camPitch, x: P.x, y: P.y, scale: P.scale, T: Tq,
      light: c10Light(), rimDir: -2.05, params: { variant: 'guitar', strum: 0, headDown: lerp(0.3, -0.44, up), tilt: lerp(0.06, -0.02, up), neckYaw: lerp(0, -0.12, up) },
      head: Object.assign(c12HisHead(Tq), { turn: lerp(0.02, -0.16, up), rim: 1.0, rimW: 1.6, hair: { wind: 0.12, windDir: 0.2 } }),
    });
  }
  // 先輩 standing by the piano, her right hand coming to her chest as he speaks; painted at Tq (on twos, the other phase)
  function c12Her(c, R, Tq) {
    const P = figPlace(R.cam, C12_GIRL, C12_HER_DIR, 'senpai', 1.2), k = sm(39.3, 40.0, Tq);
    return withPose(G03_CHEST, standChestPose, () => AN().figure(c, {
      who: 'senpai', outfit: 'uniform', pose: G03_CHEST, facing: P.facing, camPitch: P.camPitch, x: P.x, y: P.y, scale: P.scale, T: Tq,
      light: c10Light(), rimDir: -2.05, params: { k, weight: 0.35, armBend: 0.25, nod: lerp(0.14, 0.08, sm(37.6, 38.6, Tq)), tilt: lerp(0.04, 0.1, k) },
      head: Object.assign(c12HerHead(Tq), { turn: -0.06, rim: 1.1, rimW: 1.9, hair: { wind: 0.16, windDir: 0.15 } }),
    }));
  }
  PV.shot('C12', { draw(ctx, t, d, S) {
    const tt = clamp(t, -0.3, d + 0.3), u = localT(S, 'C12', tt), T = SB.C12 + u;
    if (S) S.post = Object.assign({}, S.post, { bloom: 0.22 });     // two faces against the bright window: keep the eye lines crisp
    PRF('start');
    const zoom = 1.0 + 0.022 * smr(0, 4.0, u);
    // the room under its fixed camera, with the piano, painted once: the moment is still (原作873「無音」) -- only the branch
    // beyond the glass, the dust and the light move
    const RB = c12Plate(), R = C12_ROOM.R, G = c12Geom(R);
    PRF('room', ctx);
    ctx.save(); PV.camera(ctx, { zoom, cx: 960, cy: 560 });
    ctx.drawImage(RB, 0, 0);
    c12Branch(ctx, R, u);
    // behind them: the glow of the windows and the bands of light falling between them onto the floor (breathing)
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.8 + 0.2 * (0.5 + 0.5 * N2(3.1, u * 0.4)); ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(G.light, 0, 0, W, H); ctx.restore();
    // the two of them, each repainted on twos (he on the even frames with his voice, she on the odd ones)
    PRF('bg', ctx);
    const him = twos('c12him', AN().onTwos(T), (c) => c12Him(c, R, AN().onTwos(T)));
    PRF('him', PV.buffer('g03:2s:c12him').ctx);
    const herT = AN().onTwos(T - 1 / 24) + 1 / 24, her = twos('c12her', herT, (c) => c12Her(c, R, herT));
    PRF('her', PV.buffer('g03:2s:c12her').ctx);
    // (only their boxes: the layers are otherwise empty)
    const blit = (img, b) => { const x0 = Math.max(0, Math.floor(b[0])), y0 = Math.max(0, Math.floor(b[1])), x1 = Math.min(W, Math.ceil(b[2])), y1 = Math.min(H, Math.ceil(b[3])); if (x1 > x0 && y1 > y0) ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); };
    const pb = figPlace(R.cam, C12_BOY, C12_HIS_DIR, 'boy', 0.45), pg = figPlace(R.cam, C12_GIRL, C12_HER_DIR, 'senpai', 1.2);
    blit(him, [pb.x - 3.4 * pb.scale, pb.y - 5.2 * pb.scale, pb.x + 3.6 * pb.scale, pb.y + 3.2 * pb.scale]);
    blit(her, [pg.x - 2.8 * pg.scale, pg.y - 7.8 * pg.scale, pg.x + 2.8 * pg.scale, pg.y + 0.5 * pg.scale]);
    // dust sinking slowly through the light (in front of them)
    L.dust(ctx, u, { seed: 120, count: 64, x0: G.mid[0] - 520, x1: G.mid[0] + 520, y0: 100, y1: 960, size: 2.6, alpha: 0.72, drift: 24, vx: 2, vy: 9, color: '#fff3dc' });
    ctx.restore();
    // the lower edge settles into a warm shade (it also seats the subtitle)
    ctx.fillStyle = PV.linGrad(ctx, 0, 820, 0, H, [[0, 'rgba(46,32,24,0)'], [1, 'rgba(46,32,24,0.3)']]); ctx.fillRect(0, 820, W, H - 820);
    PRF('end', ctx);
  } });
})();

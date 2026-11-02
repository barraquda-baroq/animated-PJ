/* g05_competition — ACT2「予選」C16–C19 (49.5–63.0)
 *   C16 白い世界: 左肩越しの後ろ姿（夜会巻き・うなじ・濃紺のドレス）、鍵盤の上で凍りついた手。51.4 咳払い→艶のある黒い鍵盤蓋に
 *       最前列の小さな人影が映り、頭がわずかに左へ（頬にホールの琥珀＝原作3384『赤み』）、白(1→0.6)が温まる。腕を解き、52.4 の吸気で
 *       肩が上がる。static→slow push-in。
 *   C17 〈別れの曲〉: 一本のスポットライト、真後ろからの後ろ姿（同じドレス・同じ夜会巻き）、ゆっくり動く肩、天屋根を開けたグランド
 *       ピアノ。白が暖かい光へ。光芒と微粒子、ドリーイン。右側は縦書きモノローグのために暗く保つ。
 *   C18 〈木枯らし〉: 高音から駆け下りる右手（モーションブラー）＋枯葉の突風（右→左）。pan_left→static。57.2 記憶の声＝音楽室の窓光、
 *       59.4 最終和音で手が止まり、枯葉が散って光（燠）になる。
 *   C19 帰りの電車: 流れる街灯のボケ、彼女の手の中のスマホ。60.3「――おめでとう。」と夏の写真、61.6/62.25 涙が落ちて写真の彼が
 *       光の中ににじんで見えなくなる。
 * Shared (C16/C17): one 3-D figure (torso cross-sections, IK arms, a projected head with the chignon) seen through the hand rig's
 *   camera, so keys, hands, arms, body and piano always agree in perspective. LIT16 switches white-void / spotlight lighting.
 * The C15 photo: C19 uses PV.summerPhoto(ctx, w, h, layer) ('bg' | 'him') published by g04 (falls back to its own drawing).
 */
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, TAU = Math.PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp, sm = PV.smooth, smr = PV.smoother, N2 = PV.noise2;

  /* ================================================================== shared stage pieces */
  // dim warm hall behind the stage light (cached): back-wall panels far away, out of focus
  function hallBack(key) {
    return PV.cached('g05:hall:' + key, W, H, (c) => {
      let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0e0a08'); g.addColorStop(0.5, '#1d1410'); g.addColorStop(1, '#120c0a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      // reflector panels of the back wall: tall warm wood slabs, barely lit
      for (let i = 0; i < 16; i++) {
        const x = i * 128 - 40 + 30 * PV.rand1(i, 4), w = 118;
        g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(70,46,30,0.0)'); g.addColorStop(0.5, `rgba(${90 + 30 * PV.rand1(i, 5) | 0},60,38,${0.22 + 0.1 * PV.rand1(i, 6)})`); g.addColorStop(1, 'rgba(70,46,30,0.0)');
        c.fillStyle = g; c.fillRect(x, 80, w, 760);
      }
      // ceiling border lights (tiny warm points), soft
      for (let i = 0; i < 9; i++) { const x = 120 + i * 220; L.glow(c, x, 120 + 10 * Math.sin(i), 60, '#ffd9a0', 0.35); }
      c.filter = 'blur(6px)'; c.drawImage(c.canvas, 0, 0); c.filter = 'none';
    });
  }

  /* C17 is defined after C16 (it re-uses C16's 3-D figure with its own camera and a spotlight) */

  /* ================================================================== C16 予選・白い世界
   * 49.5–53.0 (3.5s, dip from white). A white world without outlines; only the black piano floats in it. Over her left
   * shoulder from behind: the hair up (chignon), the nape, the navy dress, her hands frozen above the keys.
   * 49.5–51.4 tinnitus only (a heartbeat pulse in the white, the fingers tremble). 51.4 a small cough from the front row,
   * a little left: his small figure appears in the black lacquer of the fallboard, her head turns slightly left (the cheek
   * catches the hall's amber = 原作3384 の『赤み』), the white warms. She lets the arms go and breathes with her shoulders
   * (inhale 52.4). Camera: static -> slow push-in from the cough.
   * Everything (keys, hands, arms, body, head, fallboard, reflection) is projected through ONE 3-D camera (the hand rig's
   * camera), so the arms come out of the shoulders, bend at the elbow and reach the keys in a consistent perspective.
   * World = the keyboard frame of PV.lib.handOnKeys: x -> treble (her right), y down, z -> toward her; ~0.93 mm per unit.
   */
  const C16 = { cough: 1.9, inhale: 2.9, rel0: 2.35, rel1: 3.25 };
  const V3 = (x, y, z) => ({ x, y, z });
  const va = (a, b) => V3(a.x + b.x, a.y + b.y, a.z + b.z), vs = (a, b) => V3(a.x - b.x, a.y - b.y, a.z - b.z), vm = (a, s) => V3(a.x * s, a.y * s, a.z * s);
  const vl = (a) => Math.hypot(a.x, a.y, a.z), vn = (a) => vm(a, 1 / (vl(a) || 1)), vd = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const vmix = (a, b, u) => V3(lerp(a.x, b.x, u), lerp(a.y, b.y, u), lerp(a.z, b.z, u));
  const CAM16 = { az: -0.78, el: 0.56, scale: 1.0, x: 860, y: 700, focal: 2000 };
  const LOOK16 = V3(0, -22, 8);            // handOnKeys' default look-at
  let CAMX = CAM16;                         // the camera the figure / piano are projected through (C16 or C17)
  let LIT16 = { mode: 'side' };             // 'side': the white void lights her near side; 'top': a spotlight from above (rim)
  function p16(p) {                         // world -> screen (identical to the hand rig's projection for an identity ctx)
    const C = CAMX; if (!C._mv) C._mv = L._handLookCam(C.az, C.el, 0);
    const M = C._mv, d = vs(p, LOOK16);
    const qx = M[0] * d.x + M[1] * d.y + M[2] * d.z, qy = M[3] * d.x + M[4] * d.y + M[5] * d.z, qz = M[6] * d.x + M[7] * d.y + M[8] * d.z;
    const k = C.focal / Math.max(C.focal * 0.25, C.focal - qz);
    return { x: C.x + C.scale * qx * k, y: C.y + C.scale * qy * k, k: k * C.scale };
  }
  function ik2(S, Wr, a, b, pole) {         // two-bone IK: elbow from shoulder S, wrist Wr, bone lengths, pole direction
    const d = vs(Wr, S), L0 = vl(d), c = Math.min(L0, a + b - 1e-3), u = vm(d, 1 / L0);
    const x = (a * a - b * b + c * c) / (2 * c), h = Math.sqrt(Math.max(0, a * a - x * x));
    return va(S, va(vm(u, x), vm(vn(vs(pole, vm(u, vd(pole, u)))), h)));
  }
  function hull2(pts) {
    const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y); if (p.length < 3) return p;
    const crs = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && crs(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && crs(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    lo.pop(); up.pop(); return lo.concat(up);
  }
  function smoothPath(pts) {                // closed Catmull-Rom path through hull points
    const p = new Path2D(), n = pts.length; if (n < 3) return p;
    const g = (i) => pts[(i + n) % n];
    p.moveTo(g(0).x, g(0).y);
    for (let i = 0; i < n; i++) { const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2); p.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y); }
    p.closePath(); return p;
  }
  const quad16 = (c, pts, fill) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } };
  const ALL = (c) => c.fillRect(-4000, -4000, 8000, 8000);
  // palette of the white world: deep navy dress, pale skin, black hair (the darkest things besides the piano)
  const P16_COLD = { dress: '#232d52', dressSh: '#141a33', dressHi: '#56648f', skin: '#f4e4d6', skinSh: '#d8b9a6', skinHi: '#fffaf4', line: '#9a7666', hair: '#1c1c23', hairHi: '#9aa0b4', hairSh: '#0c0c11', warm: '#ffbf86' };
  const P16_WARM = { dress: '#2c2c4c', dressSh: '#1a1830', dressHi: '#7a6c86', skin: '#f6dcc4', skinSh: '#d9ad92', skinHi: '#fff2de', line: '#9a6a56', hair: '#221d22', hairHi: '#b9a48c', hairSh: '#100c0e', warm: '#ffbf86' };
  const hex16 = (rgba) => { const m = rgba.match(/\d+/g); return '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join(''); };
  let P16 = P16_COLD;
  function palette16(k) { if (k <= 0.001) { P16 = P16_COLD; return; } const o = {}; for (const key in P16_COLD) o[key] = hex16(PV.mix(P16_COLD[key], P16_WARM[key], k)); P16 = o; }

  // ---- her body (world units). CX = her centre line, between the hands
  const CX16 = -70, UPPER = 290, FORE = 250, KW = 25.5;
  const HANDS16 = {
    L: { side: 'L', handX: -11, keys: [-9, -10, -11, -12, -13], wristY: -52, wristZ: 104, roll: 0.06 },
    R: { side: 'R', handX: 4, keys: [2, 3, 4, 5, 6], wristY: -44, wristZ: 104, roll: -0.04 },
  };
  function body16(s) {
    const lift = s.lift, drop = s.drop, lean = s.lean, sw = s.sway || 0, shY = -372 - lift + drop;
    const wx = (y) => CX16 + sw * clamp((240 - y) / 610);           // sway grows from the seat up to the shoulders
    return {
      shL: V3(wx(shY) - 168, shY + 4 + (s.tiltSh || 0), 342 + lean * 0.6), shR: V3(wx(shY) + 168, shY - (s.tiltSh || 0), 342 + lean * 0.6),
      neck: V3(wx(-414) + sw * 0.05, -414 - lift + drop * 0.5, 364 + lean * 0.7),
      head: V3(wx(-572) + 2 + sw * 0.15, -572 - lift + drop * 0.4, 336 + lean),
      secs: [[-424 - lift + drop * 0.5, 364 + lean * 0.7, 48, 44], [-400 - lift + drop * 0.8, 356 + lean * 0.68, 104, 56], [-374 - lift + drop, 348 + lean * 0.62, 158, 70], [-346 - lift + drop, 346 + lean * 0.6, 168, 80],
        [-280 - lift * 0.6 + drop * 0.6, 352 + lean * 0.5, 152, 92], [-190 - lift * 0.3, 360 + lean * 0.35, 140, 94], [-40, 392, 112, 80], [120, 438, 158, 102], [240, 462, 166, 108]]
        .map(([y, z, hw, hd]) => ({ x: wx(y), y, z, hw, hd })),
    };
  }
  const ring16 = (sc, n) => { const P = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; P.push(p16(V3(sc.x + Math.sin(a) * sc.hw, sc.y, sc.z + Math.cos(a) * sc.hd))); } return P; };
  // tapered capsule between two projected spheres
  function capsule16(c, A, ra, B, rb) {
    const a = p16(A), b = p16(B), r0 = ra * a.k, r1 = rb * b.k;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, ux = dx / d, uy = dy / d;
    const s = clamp((r0 - r1) / d, -0.99, 0.99), ct = Math.sqrt(1 - s * s), nx = -uy, ny = ux, ang = Math.atan2(ny, nx), sa = Math.asin(s);
    c.beginPath(); c.moveTo(a.x + (nx * ct - ux * s) * r0, a.y + (ny * ct - uy * s) * r0); c.lineTo(b.x + (nx * ct - ux * s) * r1, b.y + (ny * ct - uy * s) * r1);
    c.arc(b.x, b.y, r1, ang - sa, ang + Math.PI + sa, true); c.lineTo(a.x + (-nx * ct - ux * s) * r0, a.y + (-ny * ct - uy * s) * r0);
    c.arc(a.x, a.y, r0, ang + Math.PI + sa, ang - sa + TAU, true); c.closePath();
    return { a, b, r0, r1, nx, ny };
  }
  function torso16(c, body) {
    const secs = body.secs, rings = secs.map((s) => ring16(s, 28)), path = new Path2D(), top = LIT16.mode === 'top';
    for (let i = 0; i < rings.length - 1; i++) { const h = hull2(rings[i].concat(rings[i + 1])); h.forEach((q, j) => (j ? path.lineTo(q.x, q.y) : path.moveTo(q.x, q.y))); path.closePath(); }
    c.strokeStyle = top ? 'rgba(6,6,14,0.75)' : 'rgba(13,17,36,0.6)'; c.lineWidth = 3.4; c.lineJoin = 'round'; c.stroke(path);   // outer outline only: the fill covers the inner edges
    c.fillStyle = P16.dress; c.fill(path);
    const secAt = (y) => { for (let i = 0; i < secs.length - 1; i++) { const a = secs[i], b = secs[i + 1]; if (y >= a.y && y <= b.y) { const u = (y - a.y) / (b.y - a.y); return { x: lerp(a.x, b.x, u), y, z: lerp(a.z, b.z, u), hw: lerp(a.hw, b.hw, u), hd: lerp(a.hd, b.hd, u) }; } } return secs[secs.length - 1]; };
    const neckline = [];
    for (let i = -10; i <= 10; i++) { const u = i / 10, th = u * 1.25, y = lerp(-322, -396, Math.pow(Math.abs(u), 1.7)), sc = secAt(y); neckline.push(p16(V3(sc.x + Math.sin(th) * sc.hw * 0.98, y, sc.z + Math.cos(th) * sc.hd * 0.98))); }
    c.save(); c.clip(path);
    const sm1 = secs[5], lft = p16(V3(sm1.x - 170, -200, 360)), rgt = p16(V3(sm1.x + 170, -200, 360)), tp = p16(V3(secs[2].x, secs[2].y, secs[2].z)), bt = p16(V3(secs[8].x, secs[8].y, secs[8].z));
    let g;
    if (!top) {   // the near side lit by the white void, the far side sinks
      g = c.createLinearGradient(lft.x, lft.y, rgt.x, rgt.y);
      g.addColorStop(0, PV.rgba(P16.dressHi, 0.55)); g.addColorStop(0.18, PV.rgba(P16.dressHi, 0.12)); g.addColorStop(0.52, PV.rgba(P16.dressSh, 0)); g.addColorStop(0.6, PV.rgba(P16.dressSh, 0.7)); g.addColorStop(1, PV.rgba(P16.dressSh, 0.85));
      c.fillStyle = g; ALL(c);
      g = c.createLinearGradient(tp.x, tp.y, bt.x, bt.y); g.addColorStop(0, PV.rgba(P16.dressHi, 0.35)); g.addColorStop(0.25, 'rgba(0,0,0,0)'); g.addColorStop(0.75, PV.rgba(P16.dressSh, 0.25)); g.addColorStop(1, PV.rgba(P16.dressSh, 0.6));
      c.fillStyle = g; ALL(c);
    } else {      // one spotlight from above: satin sheen on the shoulder blades, the small of the back in shadow
      g = c.createLinearGradient(tp.x, tp.y, bt.x, bt.y); g.addColorStop(0, PV.rgba(P16.dressHi, 0.55)); g.addColorStop(0.16, PV.rgba(P16.dressHi, 0.14)); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, PV.rgba(P16.dressSh, 0.9));
      c.fillStyle = g; ALL(c);
      for (const sg of [-1, 1]) {   // shoulder blades
        const q = p16(V3(secs[4].x + sg * 70, -250, secs[4].z + secs[4].hd)), r = 110 * q.k;
        g = c.createRadialGradient(q.x, q.y - r * 0.3, 0, q.x, q.y, r); g.addColorStop(0, PV.rgba(P16.dressHi, 0.3)); g.addColorStop(1, PV.rgba(P16.dressHi, 0)); c.fillStyle = g; ALL(c);
      }
      g = c.createLinearGradient(lft.x, lft.y, rgt.x, rgt.y); g.addColorStop(0, PV.rgba(P16.dressSh, 0.5)); g.addColorStop(0.2, 'rgba(0,0,0,0)'); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, PV.rgba(P16.dressSh, 0.5));
      c.fillStyle = g; ALL(c);
    }
    // the open back above the scooped neckline
    const sk = new Path2D(); sk.moveTo(neckline[0].x, neckline[0].y - 2000); neckline.forEach((q) => sk.lineTo(q.x, q.y)); sk.lineTo(neckline[20].x, neckline[20].y - 2000); sk.closePath();
    c.fillStyle = P16.skin; c.fill(sk);
    c.save(); c.clip(sk);
    if (!top) { g = c.createLinearGradient(lft.x, lft.y, rgt.x, rgt.y); g.addColorStop(0, PV.rgba(P16.skinHi, 0.6)); g.addColorStop(0.5, PV.rgba(P16.skinSh, 0.1)); g.addColorStop(0.62, PV.rgba(P16.skinSh, 0.75)); g.addColorStop(1, PV.rgba(P16.skinSh, 0.9)); }
    else { const nq = p16(V3(secs[0].x, secs[0].y, secs[0].z)), lb = p16(V3(secs[4].x, -300, secs[4].z + secs[4].hd)); g = c.createLinearGradient(nq.x, nq.y, lb.x, lb.y); g.addColorStop(0, PV.rgba(P16.skinSh, 0.85)); g.addColorStop(0.35, PV.rgba(P16.skinHi, 0.25)); g.addColorStop(1, PV.rgba(P16.skinSh, 0.6)); }
    c.fillStyle = g; ALL(c);
    const s0 = secAt(-390), s1 = secAt(-300), sp0 = p16(V3(s0.x, -390, s0.z + s0.hd * 0.9)), sp1 = p16(V3(s1.x, -300, s1.z + s1.hd * 0.95));   // spine hollow
    c.strokeStyle = PV.rgba(P16.skinSh, 0.55); c.lineWidth = 6 * sp0.k; c.lineCap = 'round'; c.beginPath(); c.moveTo(sp0.x, sp0.y); c.lineTo(sp1.x, sp1.y); c.stroke();
    c.restore();
    c.strokeStyle = PV.rgba(P16.dressHi, 0.65); c.lineWidth = 2.2; c.beginPath(); neckline.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.stroke();
    const a0 = secAt(-322), a1 = secAt(100), z0 = p16(V3(a0.x, -322, a0.z + a0.hd)), z1 = p16(V3(a1.x, 100, a1.z + a1.hd));   // centre-back seam
    c.strokeStyle = PV.rgba(P16.dressSh, 0.5); c.lineWidth = 1.6; c.beginPath(); c.moveTo(z0.x, z0.y); c.lineTo(z1.x, z1.y); c.stroke();
    if (top) {    // the spot's rim along the tops of the shoulders (upper half of the shoulders' hull only)
      const hh = hull2(rings[0].concat(rings[1], rings[2], rings[3])), cyy = hh.reduce((a2, q) => a2 + q.y, 0) / hh.length;
      let i0 = 0; for (let i = 0; i < hh.length; i++) if (hh[i].x < hh[i0].x) i0 = i;
      const up = []; for (let j = 0; j < hh.length; j++) { const q = hh[(i0 + j) % hh.length]; if (q.y <= cyy + 6) up.push(q); }
      up.sort((a2, b2) => a2.x - b2.x);
      const rq0 = p16(V3(secs[0].x, secs[0].y - 20, secs[0].z)), rq1 = p16(V3(secs[4].x, secs[4].y, secs[4].z));
      g = c.createLinearGradient(rq0.x, rq0.y, rq1.x, rq1.y); g.addColorStop(0, PV.rgba(LIT16.rim, 0.6)); g.addColorStop(1, PV.rgba(LIT16.rim, 0));
      c.strokeStyle = g; c.lineWidth = 5; c.lineJoin = 'round'; c.beginPath(); up.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.stroke();
    }
    c.restore();
  }
  function upperArm16(c, S, E, side, far) {
    const A = va(S, V3(side === 'L' ? -10 : 10, 26, 0));
    const cap = capsule16(c, A, 44, E, 29);
    c.fillStyle = far ? P16.skinSh : P16.skin; c.fill();
    c.save(); c.clip();
    const g = c.createLinearGradient(cap.a.x + cap.nx * cap.r0, cap.a.y + cap.ny * cap.r0, cap.a.x - cap.nx * cap.r0, cap.a.y - cap.ny * cap.r0);
    g.addColorStop(0, PV.rgba(P16.skinHi, far ? 0.2 : 0.7)); g.addColorStop(0.45, PV.rgba(P16.skinHi, 0)); g.addColorStop(0.55, PV.rgba(P16.skinSh, 0.8)); g.addColorStop(1, PV.rgba(P16.skinSh, 0.95));
    c.fillStyle = g; ALL(c);
    c.restore();
    capsule16(c, A, 44, E, 29); c.strokeStyle = P16.line; c.lineWidth = 1.6; c.stroke();
    { const m0 = p16(vmix(A, E, 0.42)), m1 = p16(vmix(A, E, 0.86)), off = (far ? -1 : 1) * 0.35 * cap.r0;   // triceps / elbow crease
      c.strokeStyle = PV.rgba(P16.skinSh, 0.55); c.lineWidth = 1.2; c.beginPath(); c.moveTo(m0.x - cap.nx * off, m0.y - cap.ny * off); c.quadraticCurveTo((m0.x + m1.x) / 2 - cap.nx * off * 1.2, (m0.y + m1.y) / 2 - cap.ny * off * 1.2, m1.x - cap.nx * off * 0.6, m1.y - cap.ny * off * 0.6); c.stroke(); }
    if (LIT16.mode === 'top') { c.save(); c.clip(); c.strokeStyle = PV.rgba(LIT16.rim, far ? 0.25 : 0.5); c.lineWidth = 6; c.stroke(); c.restore(); }
    // a fitted cap sleeve over the shoulder
    capsule16(c, va(S, V3(side === 'L' ? -2 : 2, 10, 0)), 44, vmix(A, E, 0.22), 41); c.fillStyle = far ? P16.dressSh : P16.dress; c.fill();
    c.strokeStyle = 'rgba(13,17,36,0.45)'; c.lineWidth = 1.4; c.stroke();
    c.save(); c.clip(); const sq = p16(S); const g2 = c.createRadialGradient(sq.x - 30, sq.y - 30, 0, sq.x, sq.y, 90 * sq.k); g2.addColorStop(0, PV.rgba(P16.dressHi, far ? 0.2 : 0.6)); g2.addColorStop(1, PV.rgba(P16.dressHi, 0)); c.fillStyle = g2; ALL(c); c.restore();
  }
  function neck16(c, body) {
    const a = body.neck, b = vs(body.head, V3(0, -62, 8));
    capsule16(c, a, 45, b, 39); c.fillStyle = P16.skin; c.fill();
    c.save(); c.clip();
    const pb = p16(b), pa = p16(a); const g = c.createLinearGradient(pb.x, pb.y, pa.x, pa.y); g.addColorStop(0, PV.rgba(P16.skinSh, 0.95)); g.addColorStop(0.5, PV.rgba(P16.skinSh, 0.4)); g.addColorStop(1, PV.rgba(P16.skinSh, 0.15));
    c.fillStyle = g; ALL(c);
    if (LIT16.mode === 'top') { capsule16(c, a, 45, b, 39); c.strokeStyle = PV.rgba(LIT16.rim, 0.5); c.lineWidth = 5; c.stroke(); }
    c.restore();
  }
  // ---- the head with the updo, as projected 3-D pieces: face, hair cap, chignon, near ear; strands and the sheen are
  //      curves on the skull. pose {yaw (to her left +), pitch (down +), roll}. Head height ~ R world units.
  function head16(c, Hc, R, pose, t, warm) {
    const C = P16, cy = Math.cos(pose.yaw), sy = Math.sin(pose.yaw), cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch), cr = Math.cos(pose.roll), sr = Math.sin(pose.roll);
    const P = (x, y, z) => {
      const x1 = x * cr - y * sr, y1 = x * sr + y * cr, y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp, x3 = x1 * cy + z2 * sy, z3 = -x1 * sy + z2 * cy;
      return p16(V3(Hc.x + R * x3, Hc.y + R * y2, Hc.z + R * z3));
    };
    const k0 = P(0, 0, 0).k * R;           // px per head unit
    const ell = (cx, cy2, cz, rx, ry, rz, keep, nLat, nLon) => {
      const out = [];
      for (let i = 0; i <= nLat; i++) { const v = -Math.PI / 2 + Math.PI * i / nLat, cv = Math.cos(v), sv = Math.sin(v); for (let j = 0; j < nLon; j++) { const u = TAU * j / nLon, x = cx + rx * cv * Math.sin(u), y = cy2 + ry * sv, z = cz + rz * cv * Math.cos(u); if (!keep || keep(x, y, z)) out.push(P(x, y, z)); } }
      return out;
    };
    // hairline: hair where z (toward the back) lies beyond a line from the forehead to the front of the ear to the nape
    const hairZ = (y) => (y < -0.28 ? -0.42 : y < 0.0 ? lerp(-0.42, -0.17, (y + 0.28) / 0.28) : y < 0.16 ? lerp(-0.17, 0.08, y / 0.16) : lerp(0.08, 0.2, clamp((y - 0.16) / 0.2)));
    // face side (the cheek and the jaw)
    const faceP = smoothPath(hull2(ell(0, -0.05, 0.03, 0.37, 0.46, 0.49, (x, y, z) => z < 0.0, 12, 22).concat(ell(0, 0.16, -0.1, 0.28, 0.33, 0.32, (x, y, z) => z < 0.12, 8, 14))));
    c.fillStyle = C.skin; c.fill(faceP);
    c.save(); c.clip(faceP);
    {
      const a = P(-0.45, -0.05, -0.15), b = P(0.1, 0.1, 0.1);
      let g = c.createLinearGradient(a.x, a.y, b.x, b.y); g.addColorStop(0, PV.rgba(C.skinHi, 0.7)); g.addColorStop(0.45, PV.rgba(C.skinHi, 0)); g.addColorStop(1, PV.rgba(C.skinSh, 0.6)); c.fillStyle = g; ALL(c);
      const j0 = P(0, 0.3, 0), j1 = P(0, 0.52, -0.1); g = c.createLinearGradient(j0.x, j0.y, j1.x, j1.y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, PV.rgba(C.skinSh, 0.85)); c.fillStyle = g; ALL(c);
      if (warm > 0) { const q = P(-0.4, 0.05, -0.25); g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, 0.45 * k0); g.addColorStop(0, PV.rgba(C.warm, 0.6 * warm)); g.addColorStop(1, PV.rgba(C.warm, 0)); c.fillStyle = g; ALL(c); }
    }
    c.restore();
    c.strokeStyle = PV.rgba(C.line, 0.65); c.lineWidth = 1.4; c.stroke(faceP);
    // hair cap + chignon
    const capP = smoothPath(hull2(ell(0, -0.05, 0.03, 0.39, 0.485, 0.51, (x, y, z) => z > hairZ(y) && y < 0.37, 16, 30)));
    const bunC = [0, 0.06, 0.6], bunR = [0.19, 0.17, 0.15];
    const bunP = smoothPath(hull2(ell(bunC[0], bunC[1], bunC[2], bunR[0], bunR[1], bunR[2], null, 8, 16)));
    c.fillStyle = C.hair; c.fill(capP);
    c.save(); c.clip(capP);
    {
      const a = P(-0.1, -0.5, 0.0), b = P(0.15, 0.32, 0.35);
      let g = c.createLinearGradient(a.x, a.y, b.x, b.y); g.addColorStop(0, PV.rgba(C.hairHi, 0.26)); g.addColorStop(0.45, PV.rgba(C.hairHi, 0)); g.addColorStop(1, PV.rgba(C.hairSh, 0.8)); c.fillStyle = g; ALL(c);
      // 天使の輪: a soft band of light round the crown, cut by a few strand gaps
      const band = (v, u) => P(0.396 * Math.cos(v) * Math.sin(u), -0.05 + 0.486 * Math.sin(v), 0.03 + 0.512 * Math.cos(v) * Math.cos(u));
      const bp = new Path2D(), N = 20;
      for (let j = 0; j <= N; j++) { const q = band(-0.72, lerp(-2.0, 0.8, j / N)); if (j) bp.lineTo(q.x, q.y); else bp.moveTo(q.x, q.y); }
      for (let j = N; j >= 0; j--) { const q = band(-0.58, lerp(-2.0, 0.8, j / N)); bp.lineTo(q.x, q.y); }
      bp.closePath();
      c.fillStyle = PV.rgba(C.hairHi, 0.13); c.fill(bp); c.lineJoin = 'round'; c.strokeStyle = PV.rgba(C.hairHi, 0.07); c.lineWidth = Math.max(2, 0.03 * k0); c.stroke(bp);
      c.strokeStyle = PV.rgba(C.hairSh, 0.35); c.lineWidth = Math.max(0.8, 0.006 * k0);
      for (const uu of [-1.75, -1.1, -0.55, 0.15, 0.6]) { const a2 = band(-0.75, uu), b2 = band(-0.55, uu + 0.12); c.beginPath(); c.moveTo(a2.x, a2.y); c.lineTo(b2.x, b2.y); c.stroke(); }
      // strands combed back to the chignon (pushed onto the skull)
      const roots = [[-0.3, -0.32], [-0.34, -0.12], [-0.3, 0.06], [-0.12, -0.45], [0.12, -0.46], [0.3, -0.3], [0.33, -0.06], [0.22, 0.24], [-0.15, 0.27]];
      c.lineWidth = Math.max(0.8, 0.007 * k0);
      roots.forEach(([x0, y0], i) => {
        const A = [x0, y0, Math.max(hairZ(y0) + 0.03, -0.3)], B = [bunC[0], bunC[1], bunC[2] - 0.12];
        c.strokeStyle = PV.rgba(C.hairHi, 0.08 + 0.05 * (i % 3 === 0)); c.beginPath();
        for (let s = 0; s <= 10; s++) { const u = s / 10; let x = lerp(A[0], B[0], u), y = lerp(A[1], B[1], u), z = lerp(A[2], B[2], u); const rr = Math.hypot(x / 0.4, (y + 0.05) / 0.5, (z - 0.03) / 0.52) || 1; const q = P(x / rr, (y + 0.05) / rr - 0.05, (z - 0.03) / rr + 0.03); if (s) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); }
        c.stroke();
      });
      if (warm > 0) { const q = P(-0.4, -0.2, -0.2); const g2 = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, 0.5 * k0); g2.addColorStop(0, PV.rgba(C.warm, 0.5 * warm)); g2.addColorStop(1, PV.rgba(C.warm, 0)); c.fillStyle = g2; ALL(c); }
    }
    c.restore();
    c.strokeStyle = PV.rgba(C.hairSh, 0.6); c.lineWidth = 1.2; c.stroke(capP);
    c.fillStyle = C.hair; c.fill(bunP);
    c.save(); c.clip(bunP);
    {
      const q = P(bunC[0] - 0.05, bunC[1] - 0.11, bunC[2]), q2 = P(bunC[0], bunC[1] + 0.03, bunC[2]);
      const g = c.createRadialGradient(q.x, q.y, 0, q2.x, q2.y, 0.24 * k0); g.addColorStop(0, PV.rgba(C.hairHi, 0.38)); g.addColorStop(0.45, PV.rgba(C.hairHi, 0.08)); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, PV.rgba(C.hairSh, 0.6)); c.fillStyle = g; ALL(c);
      c.lineCap = 'round';
      for (let k = 0; k < 3; k++) {    // three soft wraps of the twist
        c.strokeStyle = PV.rgba(C.hairSh, 0.28); c.lineWidth = Math.max(0.8, 0.012 * k0); c.beginPath();
        for (let s2 = 0; s2 <= 10; s2++) { const u = s2 / 10, ang = -2.4 + k * 2.1 + u * 1.7, rr = 0.82 - 0.12 * k; const p2 = P(bunC[0] + bunR[0] * rr * Math.cos(ang), bunC[1] + bunR[1] * rr * Math.sin(ang), bunC[2] + bunR[2] * 0.55); if (s2) c.lineTo(p2.x, p2.y); else c.moveTo(p2.x, p2.y); }
        c.stroke();
        c.strokeStyle = PV.rgba(C.hairHi, 0.12); c.lineWidth = Math.max(0.6, 0.006 * k0); c.stroke();
      }
    }
    c.restore();
    c.strokeStyle = PV.rgba(C.hairSh, 0.6); c.lineWidth = 1.2; c.stroke(bunP);
    for (let i = 0; i < 3; i++) { const q = P(bunC[0] - 0.12 + i * 0.05, bunC[1] - 0.13 - i * 0.02, bunC[2] - 0.05); c.fillStyle = '#f6f2ea'; c.beginPath(); c.arc(q.x, q.y, Math.max(1.4, 0.016 * k0), 0, TAU); c.fill(); }   // pearl pins
    // the near (left) ear, oriented by the projected head axes
    {
      const e0 = P(-0.385, 0.04, 0.05), eUp = P(-0.385, -0.06, 0.05), eBk = P(-0.385, 0.04, 0.13);
      const ux = eUp.x - e0.x, uy = eUp.y - e0.y, hl = Math.hypot(ux, uy) || 1, bx = eBk.x - e0.x, by = eBk.y - e0.y;
      const hgt = hl * 1.05, wid = Math.max(0.25 * hgt, Math.hypot(bx, by) * 0.95), ang = Math.atan2(uy, ux) + Math.PI / 2;
      const flip = (bx * Math.cos(ang) + by * Math.sin(ang)) >= 0 ? 1 : -1;
      c.save(); c.translate(e0.x, e0.y); c.rotate(ang); c.scale(flip, 1);
      const ear = new Path2D(); ear.moveTo(-wid * 0.15, -hgt); ear.bezierCurveTo(wid * 0.9, -hgt * 1.05, wid * 1.0, -hgt * 0.1, wid * 0.55, hgt * 0.45); ear.bezierCurveTo(wid * 0.35, hgt * 0.95, -wid * 0.15, hgt * 1.05, -wid * 0.3, hgt * 0.7); ear.lineTo(-wid * 0.35, -hgt * 0.6); ear.closePath();
      c.fillStyle = C.skin; c.fill(ear);
      c.save(); c.clip(ear); const g = c.createLinearGradient(-wid * 0.4, 0, wid, 0); g.addColorStop(0, PV.rgba(C.skinSh, 0.7)); g.addColorStop(1, PV.rgba(C.skinHi, 0.5)); c.fillStyle = g; c.fillRect(-wid * 2, -hgt * 2, wid * 4, hgt * 4);
      if (warm > 0) { c.fillStyle = PV.rgba(C.warm, 0.42 * warm); c.fillRect(-wid * 2, -hgt * 2, wid * 4, hgt * 4); } c.restore();
      c.strokeStyle = PV.rgba(C.line, 0.7); c.lineWidth = 1.2; c.stroke(ear);
      c.strokeStyle = PV.rgba(C.skinSh, 0.9); c.lineWidth = Math.max(1, hgt * 0.07); c.lineCap = 'round';
      c.beginPath(); c.moveTo(wid * 0.05, -hgt * 0.65); c.bezierCurveTo(wid * 0.6, -hgt * 0.7, wid * 0.65, -hgt * 0.05, wid * 0.3, hgt * 0.4); c.stroke();
      c.fillStyle = '#f7f3ea'; c.beginPath(); c.arc(wid * 0.05, hgt * 0.78, Math.max(1.4, hgt * 0.09), 0, TAU); c.fill();   // pearl stud
      c.restore();
    }
    // loose strands (後れ毛) at the nape and the temple: they sway
    c.strokeStyle = C.hair; c.lineCap = 'round';
    for (const [x0, y0, z0, len, ph, cv] of [[-0.24, 0.24, 0.24, 0.24, 0.0, 1], [0.0, 0.33, 0.4, 0.2, 1.7, -1], [0.18, 0.3, 0.36, 0.17, 2.6, 1], [-0.36, -0.1, -0.2, 0.26, 3.4, -1]]) {
      const sw = 0.03 * Math.sin(t * 1.25 + ph);
      c.lineWidth = Math.max(0.8, 0.008 * k0); c.beginPath();
      for (let s = 0; s <= 6; s++) { const u = s / 6, q = P(x0 + cv * 0.035 * Math.sin(u * 3) + sw * u, y0 + len * u, z0 + 0.03 * u); if (s) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); }
      c.stroke();
    }
  }
  // ---- hands: the frozen rigs are solved once (forearm aimed at the IK elbow), then re-posed per frame
  const H16 = { init: false };
  function handOpt16(side, extra) {
    const hb = HANDS16[side];
    return Object.assign({ az: CAM16.az, el: CAM16.el, scale: CAM16.scale, x: CAM16.x, y: CAM16.y, focal: CAM16.focal, t: 0, side: hb.side, handX: hb.handX, keys: hb.keys, press: [-0.4, -0.4, -0.4, -0.4, -0.4],
      wristY: hb.wristY, wristZ: hb.wristZ, roll: hb.roll, drawKeys: false, shadow: false, reflection: false, light: -2.0, skin: P16.skin, shade: P16.skinSh, hi: P16.skinHi, line: P16.line }, extra || {});
  }
  function initHands16() {
    const body = body16({ lift: 0, drop: 0, lean: 0 }), scratch = PV.buffer('g05:c16scratch', 64, 64).ctx;
    for (const side of ['L', 'R']) {
      const S = side === 'L' ? body.shL : body.shR;
      let turn = side === 'L' ? -0.35 : 0.35, tilt = -0.1, rig = null;
      for (let it = 0; it < 3; it++) {
        rig = L.handOnKeys(scratch, handOpt16(side, { turn, tilt, arm: 200, alpha: 0 }));
        const Wr = va(rig.toWorld(V3(0, 0, 0)), LOOK16), E = ik2(S, Wr, UPPER, FORE, V3(side === 'L' ? -0.7 : 0.7, 0.55, 0.45)), e = vn(vs(E, Wr));
        turn = Math.atan2(e.x, e.z); tilt = Math.asin(clamp(e.y, -1, 1));
      }
      H16[side] = { o: rig.o, wrist: va(rig.toWorld(V3(0, 0, 0)), LOOK16) };
    }
    H16.relax = L.handRig({ kind: 'her', curl: [0.3, 0.34, 0.4, 0.46, 0.52], spread: 0.1 }).pose;
    H16.init = true;
  }
  const HM16 = () => L._handMath.M;
  function handMatrix16(turn, tilt, roll, mirror) { const M = HM16(); return M.mul(M.rz(-roll * mirror), M.mul(M.ry(turn), M.mul(M.rx(-tilt), M.cols(V3(1, 0, 0), V3(0, 0, 1), V3(0, -1, 0))))); }
  function arm16(side, body, t, rel, trem) {
    const H0 = H16[side], mir = side === 'L' ? -1 : 1, S = side === 'L' ? body.shL : body.shR;
    const lap = side === 'L' ? V3(CX16 - 105, 46, 262) : V3(CX16 + 45, 52, 250);   // the far hand settles in front of her (hidden by her back)
    const up = Math.sin(Math.PI * clamp(rel * 1.15)) * 40;            // the hands lift off before they fall to the lap
    let Wr = vmix(H0.wrist, lap, PV.ease.inOutCubic(rel)); Wr = V3(Wr.x + trem * 1.6 * N2(t * 7.3, mir * 3), Wr.y - up + trem * 1.6 * N2(mir * 5, t * 6.7), Wr.z);
    const pole = side === 'L' ? V3(-0.7, 0.55 + 0.3 * rel, 0.45) : V3(lerp(0.7, 0.25, rel), lerp(0.55, 1.0, rel), lerp(0.45, 0.6, rel));
    const E = ik2(S, Wr, UPPER, FORE, pole), e = vn(vs(E, Wr));
    return { Wr, E, S, turn: Math.atan2(e.x, e.z), tilt: Math.asin(clamp(e.y, -1, 1)), roll: lerp(HANDS16[side].roll, mir * 0.55, rel), fore: vl(vs(E, Wr)) };
  }
  function hand16(ctx, side, A, t, rel, trem) {
    const H0 = H16[side], mir = side === 'L' ? -1 : 1, m = ctx.getTransform(), u = PV.ease.inOut(clamp(rel * 1.3)), F0 = H0.o.pose, F1 = H16.relax;
    const pose = {
      F: F0.F.map((f, i) => ({ flex: f.flex.map((v, j) => lerp(v, F1.F[i].flex[j], u) + trem * 0.07 * N2(t * 6.1 + i * 3.3, j * 1.7)), splay: lerp(f.splay, F1.F[i].splay, u) + trem * 0.02 * N2(t * 4.3, i * 5.1) })),
      T: { abd: lerp(F0.T.abd, F1.T.abd, u), opp: lerp(F0.T.opp, F1.T.opp, u), flex: F0.T.flex.map((v, j) => lerp(v, F1.T.flex[j], u) + trem * 0.05 * N2(t * 5.2, 9 + j)), twist: lerp(F0.T.twist || 0, F1.T.twist || 0, u) },
    };
    const rig = L.handRig(Object.assign({}, H0.o, { pose, handMatrix: handMatrix16(A.turn, A.tilt, A.roll, mir), handPos: vs(A.Wr, LOOK16), arm: A.fore + 4, _m: { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f },
      skin: P16.skin, shade: P16.skinSh, hi: P16.skinHi, line: P16.line }));
    L.handRender(ctx, [rig], {});
  }
  // ---- the piano front (cached): fallboard, cheek block, key slip, the 88 keys -- one camera with the hands
  const X0_16 = -12.75 - 25 * KW - 6, X1_16 = -12.75 + 27 * KW + 6, ZF16 = -179;
  const fallboard16 = () => [p16(V3(X0_16, 2, ZF16)), p16(V3(X1_16, 2, ZF16)), p16(V3(X1_16, -160, ZF16 - 16)), p16(V3(X0_16, -160, ZF16 - 16))];
  function piano16() {
    return PV.cached('g05:c16piano', W, H, (c) => {
      const nb = fallboard16();
      let g = c.createLinearGradient(nb[3].x, nb[3].y, nb[0].x, nb[0].y); g.addColorStop(0, '#09080c'); g.addColorStop(0.7, '#121116'); g.addColorStop(1, '#1b191f');
      quad16(c, nb, g);
      c.save(); quad16(c, nb); c.clip();
      const b0 = [p16(V3(X0_16, -150, ZF16 - 15)), p16(V3(X1_16, -150, ZF16 - 15)), p16(V3(X1_16, -105, ZF16 - 12)), p16(V3(X0_16, -105, ZF16 - 12))];
      g = c.createLinearGradient(b0[0].x, b0[0].y, b0[3].x, b0[3].y); g.addColorStop(0, 'rgba(248,248,246,0.34)'); g.addColorStop(1, 'rgba(248,248,246,0)');   // the white mirrored in the lacquer
      quad16(c, b0, g);
      const e0 = p16(V3(X0_16, -158, ZF16 - 16)), e1 = p16(V3(X1_16, -158, ZF16 - 16));
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(e0.x, e0.y); c.lineTo(e1.x, e1.y); c.stroke();
      c.restore();
      quad16(c, [p16(V3(X0_16 - 70, -48, 22)), p16(V3(X0_16, -48, 22)), p16(V3(X0_16, -48, ZF16)), p16(V3(X0_16 - 70, -48, ZF16))], '#1d1c22');   // cheek block
      quad16(c, [p16(V3(X0_16 - 70, -48, 22)), p16(V3(X0_16 - 70, -48, ZF16)), p16(V3(X0_16 - 70, 64, ZF16)), p16(V3(X0_16 - 70, 64, 22))], '#0e0d12');
      quad16(c, [p16(V3(X0_16 - 70, 14, 26)), p16(V3(X1_16 + 70, 14, 26)), p16(V3(X1_16 + 70, 56, 26)), p16(V3(X0_16 - 70, 56, 26))], '#141318');     // key slip
      const ks0 = p16(V3(X0_16 - 70, 15, 26)), ks1 = p16(V3(X1_16 + 70, 15, 26)); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ks0.x, ks0.y); c.lineTo(ks1.x, ks1.y); c.stroke();
      L.handOnKeys(c, handOpt16('R', { drawKeys: true, alpha: 0, fallboard: false, range: [-25, 26] }));
      // the white eats the underside (the piano floats) and the far, treble end behind her shoulder
      c.globalCompositeOperation = 'destination-out';
      const lo = p16(V3(0, 56, 26)), lo2 = p16(V3(0, 180, 60));
      g = c.createLinearGradient(lo.x, lo.y, lo2.x, lo2.y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const fa = p16(V3(150, -60, -90)), fb = p16(V3(520, -60, -90));
      g = c.createLinearGradient(fa.x, fa.y, fb.x, fb.y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'source-over';
    });
  }
  // ---- the hall in the lacquer after the cough: the front rows in warm light and him, small, seated, a fist at his mouth
  const REFL16 = { x0: -600, x1: -250, bw: 360, bh: 168 };
  function reflection16() {
    return PV.cached('g05:c16refl', REFL16.bw, REFL16.bh, (c) => {
      const w = REFL16.bw, h = REFL16.bh, bx = w * 0.46, by = 100;
      let g = c.createRadialGradient(bx, by - 10, 6, bx, by, 150); g.addColorStop(0, 'rgba(255,206,140,0.75)'); g.addColorStop(0.45, 'rgba(214,150,92,0.38)'); g.addColorStop(1, 'rgba(120,80,50,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(24,16,14,0.8)';
      for (let i = -1; i < 7; i++) { const x = bx - 30 + (i - 2) * 64; if (Math.abs(x + 26 - bx) < 30) continue; c.beginPath(); c.roundRect(x, 112, 52, 64, [18, 18, 3, 3]); c.fill(); }   // seat backs
      c.save(); c.translate(bx, by); c.scale(2.0, 2.0);
      c.fillStyle = '#0e0a0b';
      c.beginPath(); c.moveTo(-30, 44); c.bezierCurveTo(-30, 10, -18, -2, 0, -2); c.bezierCurveTo(18, -2, 30, 10, 30, 44); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(2, -18, 12, 14, 0.1, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-12, -22); c.quadraticCurveTo(-14, -36, -2, -38); c.quadraticCurveTo(8, -42, 14, -32); c.lineTo(18, -26); c.lineTo(13, -27); c.lineTo(15, -18); c.lineTo(-13, -14); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(12, -8, 6, 7, 0.4, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,220,160,0.95)'; c.lineWidth = 1.4; c.lineCap = 'round';
      c.beginPath(); c.arc(2, -18, 13.2, -2.7, -0.8); c.stroke(); c.beginPath(); c.moveTo(-28, 30); c.bezierCurveTo(-27, 8, -16, 0, -2, -1); c.stroke();
      c.restore();
      c.globalCompositeOperation = 'destination-in';   // no frame: it lives inside the lacquer
      g = c.createRadialGradient(bx, by + 4, 30, bx, by + 4, 175); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(40,46,70,0.16)'; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'source-over';
      const tmp = PV.makeCanvas(w, h); tmp.ctx.drawImage(c.canvas, 0, 0); c.clearRect(0, 0, w, h);
      c.filter = 'blur(1.2px)'; c.drawImage(tmp.canvas, 0, 0); c.filter = 'none';
    });
  }
  function drawReflection16(ctx, ap) {
    if (ap <= 0.01) return;
    const P00 = p16(V3(REFL16.x0, -158, ZF16 - 16)), P10 = p16(V3(REFL16.x1, -158, ZF16 - 16)), P01 = p16(V3(REFL16.x0, -4, ZF16 - 1));
    ctx.save(); quad16(ctx, fallboard16()); ctx.clip();
    ctx.transform((P10.x - P00.x) / REFL16.bw, (P10.y - P00.y) / REFL16.bw, (P01.x - P00.x) / REFL16.bh, (P01.y - P00.y) / REFL16.bh, P00.x, P00.y);
    ctx.globalAlpha = ap; ctx.drawImage(reflection16(), 0, 0);
    ctx.globalAlpha = 0.5 * ap; ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-60, 58, REFL16.bw + 120, 4); ctx.fillRect(-60, 66, REFL16.bw + 120, 1.5);   // the lacquer's sheen over it
    ctx.restore();
  }
  // a few slow motes in the white (life, not snow)
  function motes16(ctx, t, a) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 14; i++) {
      const r = (k) => PV.rand1(i, 900 + k), x = (r(1) * W + 14 * t * (r(2) - 0.4) + 30 * Math.sin(t * 0.5 + i)) % W, y = r(3) * H - 10 * t * r(4);
      const rr = 6 + 16 * r(5); L.glow(ctx, x, y, rr, '#ffffff', 0.25 * a * (0.5 + 0.5 * Math.sin(t * 1.3 + i)));
    }
    ctx.restore();
  }
  // the void + the piano + the fog, baked once in a cold and a warm (the hall's amber has reached it) version
  function bg16(warm) {
    return PV.cached('g05:c16bg:' + (warm ? 'w' : 'c'), W, H, (c) => {
      c.fillStyle = '#f8f8f6'; c.fillRect(0, 0, W, H);
      if (warm) {
        let g = c.createRadialGradient(80, 380, 50, 80, 380, 1800); g.addColorStop(0, '#ffd9a0'); g.addColorStop(0.5, '#fbe7cf'); g.addColorStop(1, '#f6efe6');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      }
      c.drawImage(piano16(), 0, 0);
      const fogC = warm ? '246,236,222' : '248,248,246';
      let g = c.createLinearGradient(-260, 0, 260, 0); g.addColorStop(0, 'rgba(' + fogC + ',0.95)'); g.addColorStop(1, 'rgba(' + fogC + ',0)');
      c.fillStyle = g; c.fillRect(0, 0, 260, H);
      const ft = p16(V3(0, -160, ZF16 - 16)), ft2 = p16(V3(0, -330, ZF16 - 40));
      g = c.createLinearGradient(ft.x, ft.y, ft2.x, ft2.y); g.addColorStop(0, 'rgba(' + fogC + ',0)'); g.addColorStop(1, 'rgba(' + fogC + ',0.9)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      if (warm) { g = c.createRadialGradient(0, 420, 20, 0, 420, 900); g.addColorStop(0, 'rgba(255,191,107,0.32)'); g.addColorStop(1, 'rgba(255,191,107,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    });
  }
  // a veil of white over everything (the world without outlines), screen-blended with a per-frame strength
  function veil16() {
    return PV.cached('g05:c16veil', W, H, (c) => { const g = c.createRadialGradient(W * 0.55, H * 0.45, 200, W * 0.55, H * 0.45, 1250); g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g; c.fillRect(0, 0, W, H); });
  }
  PV.shot('C16', { draw(ctx, t, d) {
    const tt = clamp(t, -0.3, d + 0.3), cough = C16.cough;
    if (!H16.init) { initHands16(); bg16(true); reflection16(); }          // build every cache on the first frame (no hitch mid-cut)
    const k = sm(cough, cough + 1.3, tt);                                   // the white gives way to the hall's amber
    palette16(0.75 * k);
    const rel = sm(C16.rel0, C16.rel1, tt);                                  // she lets the arms go
    const breath = Math.sin(Math.PI * clamp((tt - C16.inhale + 0.15) / 1.0)) * sm(C16.inhale - 0.3, C16.inhale, tt);
    const body = body16({ lift: 14 * breath + 2 * Math.sin(tt * 2.1), drop: 10 * rel, lean: -8 * rel });
    const pulse = Math.pow(0.5 + 0.5 * Math.cos((tt - 0.35) * TAU * 0.72), 6) * (1 - k);   // heartbeat in the tinnitus
    ctx.save();
    const ph = p16(body.head), pr = p16(V3((REFL16.x0 + REFL16.x1) / 2, -80, ZF16));
    PV.camera(ctx, { zoom: 1 + 0.075 * PV.ease.inOut(sm(cough, d + 0.4, tt)), cx: lerp(pr.x, ph.x, 0.55), cy: lerp(pr.y, ph.y, 0.5) });
    ctx.drawImage(bg16(false), 0, 0);
    if (k > 0.002) { ctx.globalAlpha = k; ctx.drawImage(bg16(true), 0, 0); ctx.globalAlpha = 1; }
    drawReflection16(ctx, sm(cough - 0.05, cough + 0.3, tt));
    // her: far arm (behind the torso; its hand is hidden by her body, so only the limbs are drawn), torso, neck, near arm, head
    const trem = 1 - sm(cough, cough + 0.4, tt);
    const AL = arm16('L', body, tt, rel, trem), AR = arm16('R', body, tt, rel, trem);
    capsule16(ctx, AR.Wr, 26, AR.E, 30); ctx.fillStyle = P16.skinSh; ctx.fill(); ctx.strokeStyle = P16.line; ctx.lineWidth = 1.4; ctx.stroke();
    upperArm16(ctx, AR.S, AR.E, 'R', true);
    torso16(ctx, body);
    neck16(ctx, body);
    hand16(ctx, 'L', AL, tt, rel, trem); upperArm16(ctx, AL.S, AL.E, 'L', false);
    const turn = 0.36 * PV.ease.inOutCubic(sm(cough + 0.12, cough + 0.75, tt));
    head16(ctx, body.head, 240, { yaw: -0.12 + turn, pitch: 0.2 - 0.08 * turn, roll: -0.05 }, tt, k);
    ctx.restore();
    motes16(ctx, tt, 1 - 0.6 * k);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = clamp(0.42 * (1 - 0.5 * k) + 0.12 * pulse); ctx.drawImage(veil16(), 0, 0); ctx.restore();
  } });

  /* ================================================================== C17 〈別れの曲〉
   * 53.0–57.0 (4.0s). One spotlight; her back as she starts to play (the nape, the navy dress, the slowly moving
   * shoulders, 原作3406). As the music goes on, the white left over from C16 fills with the warm light of the hall.
   * Dust in the shaft. A very slow dolly-in from behind. Same 3-D figure as C16 (same dress, same chignon), seen from
   * straight behind and a little left; her arms go forward to the keys (elbows out, forearms hidden by her back).
   * Text: vertical monologue on the right 53.4–56.9 -> x ≈ 1480–1760 stays dark and calm (the piano's lid, the dim hall).
   */
  const CAM17 = { az: -0.1, el: 0.28, scale: 1.08, x: 900, y: 860, focal: 2800 };
  const P17 = { dress: '#1b2242', dressSh: '#090c1a', dressHi: '#5a6aa0', skin: '#e9c4aa', skinSh: '#8f6152', skinHi: '#ffe4c8', line: '#5e382e', hair: '#141017', hairHi: '#d3ab72', hairSh: '#050406', warm: '#ffd59a' };
  const HANDS17 = { L: { x: -11 * KW, y: -40, z: 100 }, R: { x: 3 * KW, y: -40, z: 100 } };
  function piano17() {
    return PV.cached('g05:c17piano', W, H, (c) => {
      // the open lid, hinged on the left (spine) and propped up to the right: its dark lacquer underside with a dim
      // golden mirror of the strings, a warm line where the spot catches its front edge
      const la = 0.66, cl = Math.cos(la), sl = Math.sin(la), spine = X0_16 - 70, rim = -290;
      const wAt = (z) => (z > -1300 ? 1490 : lerp(1490, 420, Math.pow((-1300 - z) / 1400, 1.4)));
      const lidPt = (xl, z) => p16(V3(spine + xl * cl, rim - xl * sl, z));
      const lid = []; for (let i = 0; i <= 14; i++) { const z = lerp(-300, -2700, i / 14); lid.push(lidPt(wAt(z), z)); }
      lid.push(lidPt(0, -2700)); lid.push(lidPt(0, -300));
      let g = c.createLinearGradient(lidPt(0, -300).x, lidPt(0, -300).y, lidPt(1490, -300).x, lidPt(1490, -300).y); g.addColorStop(0, '#0c0a0c'); g.addColorStop(0.6, '#17120f'); g.addColorStop(1, '#241a12');
      quad16(c, lid, g);
      c.save(); quad16(c, lid); c.clip();
      for (let i = 1; i < 26; i++) { const z = lerp(-420, -2500, i / 26), a0 = lidPt(60, z), a1 = lidPt(wAt(z) * 0.92, z); c.strokeStyle = 'rgba(214,170,96,' + (0.05 + 0.05 * (i % 3 === 0)).toFixed(3) + ')'; c.lineWidth = 1; c.beginPath(); c.moveTo(a0.x, a0.y); c.lineTo(a1.x, a1.y); c.stroke(); }
      c.restore();
      const fe0 = lidPt(0, -300), fe1 = lidPt(1490, -300); c.strokeStyle = 'rgba(255,213,154,0.55)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(fe0.x, fe0.y); c.lineTo(fe1.x, fe1.y); c.stroke();
      const ps0 = p16(V3(X1_16 + 40, rim, -1000)), ps1 = lidPt(1300, -1000); c.strokeStyle = '#0c0a0a'; c.lineWidth = 6; c.beginPath(); c.moveTo(ps0.x, ps0.y); c.lineTo(ps1.x, ps1.y); c.stroke();   // prop stick
      // the case: rim top and the front of the case behind the fallboard
      quad16(c, [p16(V3(spine, rim, -190)), p16(V3(X1_16 + 70, rim, -190)), p16(V3(X1_16 + 70, rim, -1300)), p16(V3(spine, rim, -2700))], '#0b0a0c');
      quad16(c, [p16(V3(spine, rim, -190)), p16(V3(X1_16 + 70, rim, -190)), p16(V3(X1_16 + 70, -150, -190)), p16(V3(spine, -150, -190))], '#100e10');
      const rl0 = p16(V3(spine, rim, -190)), rl1 = p16(V3(X1_16 + 70, rim, -190)); c.strokeStyle = 'rgba(255,213,154,0.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(rl0.x, rl0.y); c.lineTo(rl1.x, rl1.y); c.stroke();
      // fallboard (black lacquer with the spot's warm reflection)
      const nb = fallboard16();
      g = c.createLinearGradient(nb[3].x, nb[3].y, nb[0].x, nb[0].y); g.addColorStop(0, '#0a0809'); g.addColorStop(1, '#1d1612');
      quad16(c, nb, g);
      const e0 = p16(V3(X0_16, -158, ZF16 - 16)), e1 = p16(V3(X1_16, -158, ZF16 - 16));
      c.strokeStyle = 'rgba(255,213,154,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(e0.x, e0.y); c.lineTo(e1.x, e1.y); c.stroke();
      // the keys, the key slip, the cheek blocks
      L.handOnKeys(c, Object.assign(handOpt16('R'), { az: CAM17.az, el: CAM17.el, scale: CAM17.scale, x: CAM17.x, y: CAM17.y, focal: CAM17.focal, drawKeys: true, alpha: 0, fallboard: false, range: [-25, 26], keyColor: '#ffd59a', tint: 0.35 }));
      quad16(c, [p16(V3(X0_16 - 70, 14, 26)), p16(V3(X1_16 + 70, 14, 26)), p16(V3(X1_16 + 70, 70, 26)), p16(V3(X0_16 - 70, 70, 26))], '#0d0b0b');
      const ks0 = p16(V3(X0_16 - 70, 15, 26)), ks1 = p16(V3(X1_16 + 70, 15, 26)); c.strokeStyle = 'rgba(255,213,154,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ks0.x, ks0.y); c.lineTo(ks1.x, ks1.y); c.stroke();
    });
  }
  function bg17(warm) {
    return PV.cached('g05:c17bg:' + (warm ? 'w' : 'c'), W, H, (c) => {
      const keep = CAMX; CAMX = CAM17;
      try {
        const wk = warm ? 1 : 0;
        c.drawImage(hallBack('c17'), 0, 0);
        c.save(); c.globalCompositeOperation = 'screen';
        const g = c.createRadialGradient(860, 560, 40, 860, 600, 900); g.addColorStop(0, PV.rgba('#ffd59a', 0.5 * wk + 0.18)); g.addColorStop(0.5, PV.rgba('#c98a4a', 0.22 * wk + 0.05)); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
        L.godRays(c, 1.3, { x: 760, y: -120, angle: Math.PI / 2 + 0.06, spread: 0.3, count: 9, length: 1500, width: 150, flare: 3.2, color: '#ffe2b0', alpha: 0.1 + 0.06 * wk, seed: 17, jitter: 260, flicker: 0.4 });
        c.drawImage(piano17(), 0, 0);
      } finally { CAMX = keep; }
    });
  }
  PV.shot('C17', { draw(ctx, t, d) {
    const tt = clamp(t, -0.3, d + 0.3);
    const warmK = smr(0.0, 3.2, tt);                  // white world -> warm hall light
    const whiteK = 0.62 * (1 - smr(0.0, 2.6, tt));    // leftover of C16's white
    const keep = [CAMX, LIT16, P16];
    CAMX = CAM17; LIT16 = { mode: 'top', rim: '#ffd59a' }; P16 = P17;
    try {
      ctx.save();
      PV.camera(ctx, { zoom: 1.0 + 0.055 * PV.ease.inOut(clamp(tt / d)), cx: 860, cy: 430, x: 6 * Math.sin(tt * 0.5), y: 0 });
      // the hall, the spot cone, the light shafts, the piano and the calm column: baked cold (just out of the white) and warm
      ctx.drawImage(bg17(false), 0, 0);
      if (warmK > 0.002) { ctx.globalAlpha = warmK; ctx.drawImage(bg17(true), 0, 0); ctx.globalAlpha = 1; }
      // her, playing 〈別れの曲〉: slow phrase breathing, the shoulders and the head follow the line
      const ph = tt * 1.05, sw = Math.sin(ph * 1.15), sw2 = Math.sin(ph * 2.7);
      const body = body16({ lift: 6 * Math.sin(ph * 2.3), drop: 6, lean: -22 + 9 * Math.sin(ph * 0.8), sway: 16 * sw + 4 * sw2, tiltSh: 7 * Math.sin(ph * 1.15 - 0.6) });
      const arms = ['L', 'R'].map((side) => {
        const mir = side === 'L' ? -1 : 1, h = HANDS17[side], S = side === 'L' ? body.shL : body.shR;
        const Wr = V3(h.x + (side === 'L' ? -18 * Math.sin(ph * 0.9 + 1) : 26 * Math.sin(ph * 1.3)), h.y - 6 * Math.max(0, Math.sin(ph * 2.6 + mir)), h.z);
        const E = ik2(S, Wr, UPPER, FORE, V3(mir * 0.4, 0.85, 0.25));
        return { side, S, E, Wr };
      });
      for (const A of arms) {   // arms first: her back hides the forearms and the hands on the keys
        capsule16(ctx, A.Wr, 24, A.E, 30); ctx.fillStyle = P16.skinSh; ctx.fill(); ctx.strokeStyle = P16.line; ctx.lineWidth = 1.4; ctx.stroke();
        upperArm16(ctx, A.S, A.E, A.side, false);
      }
      torso16(ctx, body);
      neck16(ctx, body);
      head16(ctx, body.head, 240, { yaw: 0.04 * Math.sin(ph * 0.8), pitch: 0.36 + 0.05 * Math.sin(ph * 1.15), roll: -0.06 * Math.sin(ph * 1.15 - 0.4) }, tt, 0);
      L.dust(ctx, tt, { seed: 23, count: 70, x0: 380, x1: 1250, y0: 0, y1: 1000, size: 2.6, alpha: 0.55 + 0.25 * warmK, color: '#fff0d0', drift: 40, vx: -3, vy: 6 });
      ctx.restore();
      // the white world receding (screen space)
      if (whiteK > 0.002) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = whiteK; ctx.drawImage(veil16(), 0, 0); ctx.restore(); }
      // keep the monologue column calm
      ctx.save(); g = ctx.createLinearGradient(1340, 0, 1920, 0); g.addColorStop(0, 'rgba(10,7,5,0)'); g.addColorStop(0.42, PV.rgba('#0a0705', 0.32 + 0.35 * whiteK)); g.addColorStop(1, PV.rgba('#0a0705', 0.42 + 0.3 * whiteK));
      ctx.fillStyle = g; ctx.fillRect(1340, 0, 580, H); ctx.restore();
    } finally { CAMX = keep[0]; LIT16 = keep[1]; P16 = keep[2]; }
  } });

  /* ================================================================== C18 〈木枯らし〉
   * 57.0–60.0 (3.0s). The right hand runs down the keyboard from the treble (right) to the bass (left), motion blur;
   * dry leaves blow through right->left like a gust; the camera pans left with the hand, then holds. 57.2 his voice
   * comes back as a memory (a breath of the music-room window light). 59.4 the final chord: the hand stops, the leaves
   * scatter and turn into light.
   */
  const C18 = { chord: 2.4, voice: 0.2 };
  // leaf sprites (several shapes / colours), sharp and defocused
  function leafSprite(kind, blur) {
    return PV.cached('g05:leaf:' + kind + ':' + blur, 160, 160, (c) => {
      const cols = [['#c46a2b', '#e9a25a', '#7a3d18'], ['#8a4b22', '#c27a3c', '#4e2810'], ['#d4893a', '#ffd59a', '#8a4b22'], ['#a8552a', '#e08a4a', '#5e2c14']][kind % 4];
      c.translate(80, 80); if (blur) c.filter = 'blur(' + blur + 'px)';
      const sh = kind % 2 ? 0.42 : 0.34, len = 56;
      c.beginPath(); c.moveTo(0, -len);
      c.bezierCurveTo(len * sh * 1.3, -len * 0.55, len * sh * 1.1, len * 0.45, 0, len * 0.82);
      c.bezierCurveTo(-len * sh * 1.05, len * 0.42, -len * sh * 1.35, -len * 0.5, 0, -len); c.closePath();
      const g = c.createLinearGradient(-len * 0.4, -len, len * 0.4, len); g.addColorStop(0, cols[1]); g.addColorStop(0.5, cols[0]); g.addColorStop(1, cols[2]);
      c.fillStyle = g; c.fill();
      // serrated hint + midrib + veins
      c.strokeStyle = PV.rgba(cols[2], 0.7); c.lineWidth = 2; c.stroke();
      c.strokeStyle = PV.rgba('#ffe2b0', 0.55); c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, -len * 0.9); c.quadraticCurveTo(len * 0.05, 0, 0, len * 0.95); c.stroke();
      c.lineWidth = 1.2; c.strokeStyle = PV.rgba('#ffe2b0', 0.3);
      for (let k = -3; k <= 3; k++) { if (!k) continue; const y = k * len * 0.22; c.beginPath(); c.moveTo(0, y); c.lineTo(Math.sign(k) * len * 0.26, y - len * 0.18); c.moveTo(0, y); c.lineTo(-Math.sign(k) * len * 0.24, y - len * 0.16); c.stroke(); }
      // stem
      c.strokeStyle = cols[2]; c.lineWidth = 3; c.beginPath(); c.moveTo(0, len * 0.8); c.lineTo(2, len * 1.05); c.stroke();
    });
  }
  function leaves(ctx, t, o) {
    const n = o.count || 60, chord = o.chord, burstX = o.bx, burstY = o.by;
    const tm = Math.min(t, chord), after = Math.max(0, t - chord);
    for (let i = 0; i < n; i++) {
      const r = (k) => PV.rand1(i, k + 300);
      const depth = r(1);                                   // 0 far .. 1 near
      const near = depth > 0.86, far = depth < 0.3;
      const v = lerp(700, 2300, depth) * (0.8 + 0.4 * r(2));
      const span = W + 900, x0 = r(3) * span;
      let x = W + 300 - ((x0 + v * (tm + 0.6)) % span);
      let y = lerp(-80, H + 80, r(4)) + 90 * Math.sin(tm * (1.5 + r(5) * 2) + i) + (tm * lerp(60, 160, r(6)));
      const sz = near ? lerp(170, 290, r(7)) : far ? lerp(30, 55, r(7)) : lerp(60, 120, r(7));
      const spin = tm * lerp(4, 11, r(8)) * (r(9) < 0.5 ? -1 : 1) + r(10) * 6, flip = Math.cos(tm * lerp(5, 12, r(11)) + i);
      // after the chord: the gust stops, leaves scatter from the hand and burn into light
      let a = 1, glowK = 0;
      if (after > 0) {
        const dx = x - burstX, dy = y - burstY, dl = Math.hypot(dx, dy) || 1, push = 260 * (1 - Math.exp(-after * 3.2)) * lerp(0.4, 1.3, r(12));
        x += dx / dl * push - 120 * after; y += dy / dl * push - 90 * after * after;
        a = 1 - sm(0.05 + 0.25 * r(13), 0.35 + 0.3 * r(13), after); glowK = sm(0.05, 0.3, after) * (1 - 0.55 * sm(0.5, 1.1 + 0.3 * r(14), after));
        y -= 70 * after * (0.5 + r(16));   // the embers rise
      }
      if (x < -250 || x > W + 250 || y < -250 || y > H + 250) continue;
      const kind = Math.floor(r(15) * 4), blur = near ? 7 : far ? 2 : 0;
      const spr = leafSprite(kind, blur), s2 = sz / 120;
      const vel = after > 0 ? 0 : v;
      if (a > 0.01) {
        ctx.save(); ctx.globalAlpha = a * (far ? 0.55 : near ? 0.85 : 1) * (o.alpha || 1);
        // motion streak: two faint copies trailing to the right
        const steps = vel > 0 && near ? 2 : 1;
        for (let k = steps - 1; k >= 0; k--) {
          ctx.save(); ctx.globalAlpha *= k ? 0.22 / k : 1; ctx.translate(x + k * vel * 0.012, y); ctx.rotate(spin - k * 0.08); ctx.scale(s2 * Math.max(0.15, Math.abs(flip)), s2);
          ctx.drawImage(spr, -80, -80); ctx.restore();
        }
        ctx.restore();
      }
      if (glowK > 0.01) {
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        const fl2 = 0.75 + 0.25 * Math.sin(after * 9 + i * 1.7);
        L.glow(ctx, x, y, Math.min(140, sz * 0.75), '#ffd59a', 0.5 * glowK * fl2);
        ctx.fillStyle = PV.rgba('#fff4dc', 0.95 * glowK * fl2); ctx.beginPath(); ctx.arc(x, y, Math.max(1.8, Math.min(6, sz * 0.045)), 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
  }
  PV.shot('C18', { draw(ctx, t, d) {
    const tt = clamp(t, -0.3, d + 0.3), ch = C18.chord;
    // hand position along the keyboard (white keys): cut in mid-run, racing down, decelerating into the chord
    const run = (u) => 19 - 25 * (1 - Math.pow(1 - clamp(u / ch), 2.1));
    const look = (u) => 13 - 16 * (1 - Math.pow(1 - clamp(u / (ch + 0.12)), 2.0));   // the camera follows ~65%
    const hx = run(tt), vel = (run(tt) - run(tt - 1 / 24)) * 24, camK = look(tt), panV = (look(tt) - look(tt - 1 / 24)) * 24;
    const KX = 1000, KY = 600;
    const kr = Math.round(camK);
    const cam = { az: 0.55, el: 0.4, camRoll: -0.04, scale: 3.0, x: KX, y: KY, t: tt, range: [kr - 27, kr + 10], light: -2.1, sun: { x: -0.45, y: -1, z: 0.35 }, focal: 1250, lookAt: { x: camK * 25.5, y: -22, z: 8 },
      keyColor: '#ffd59a', tint: 0.3, reflection: false, shadowAlpha: 0.22 };
    // background: the dark hall beyond the piano with the warm spot spilling from above-left (cached)
    ctx.drawImage(PV.cached('g05:c18bg', W, H, (c) => { c.fillStyle = '#0d0a0c'; c.fillRect(0, 0, W, H); L.glow(c, 380, -160, 1500, '#ffd59a', 0.5); L.glow(c, 1650, 60, 800, '#c46a2b', 0.22); }), 0, 0);
    const keyPx = 25.5 * 3.0 * 0.62;                                  // ≈ screen px per white key near the hand
    // the keys, smeared by the pan (only the keys in view are built)
    const KB = PV.buffer('g05:c18keys'), kc = KB.ctx; kc.setTransform(1, 0, 0, 1, 0, 0); kc.clearRect(0, 50, W, 700);
    const kp = Math.round(hx);
    let press, keys;
    if (tt < ch - 0.03) { const ph = tt * 15; keys = [kp - 2, kp - 1, kp, kp + 1, kp + 2]; press = [0, 1, 2, 3, 4].map((f) => { const u = ((ph + (4 - f) * 0.2) % 1); return u < 0.45 ? Math.sin(u / 0.45 * Math.PI) : -0.3; }); }
    else { const hit = PV.ease.outCubic(sm(ch - 0.03, ch + 0.05, tt)); keys = [kp - 3, kp - 1, kp, kp + 1, kp + 3]; press = [hit, -0.25, hit, -0.2, hit]; }
    const hand = Object.assign({}, cam, { handX: hx, keys, press, arm: 290, tremble: 0.1, shadow: tt > ch - 0.2 });
    {
      const Mv = L._handLookCam(cam.az, cam.el, cam.camRoll), la = cam.lookAt;
      const P = (x, y, z) => { const dx = x - la.x, dy = y - la.y, dz = z - la.z; const qx = Mv[0] * dx + Mv[1] * dy + Mv[2] * dz, qy = Mv[3] * dx + Mv[4] * dy + Mv[5] * dz, qz = Mv[6] * dx + Mv[7] * dy + Mv[8] * dz; const k = cam.focal / Math.max(cam.focal * 0.25, cam.focal - qz); return { x: KX + cam.scale * qx * k, y: KY + cam.scale * qy * k }; };
      const xl = -12.75 + (kr - 27) * 25.5 - 6, xr = -12.75 + (kr + 11) * 25.5 + 6, zf = -179;
      const q = [P(xl, 2, zf), P(xr, 2, zf), P(xr, -150, zf), P(xl, -150, zf)];
      const g = kc.createLinearGradient(q[0].x, q[0].y, q[3].x, q[3].y); g.addColorStop(0, '#16131a'); g.addColorStop(0.5, '#0c0b10'); g.addColorStop(1, '#08080b');
      kc.fillStyle = g; kc.beginPath(); q.forEach((p2, i) => (i ? kc.lineTo(p2.x, p2.y) : kc.moveTo(p2.x, p2.y))); kc.closePath(); kc.fill();
      const pressW = {}; keys.forEach((k2, i) => { if (press[i] > 0 && typeof k2 === 'number') pressW[k2] = Math.max(pressW[k2] || 0, press[i]); });
      L.handKeys(kc, { az: cam.az, el: cam.el, roll: cam.camRoll, x: KX, y: KY, scale: cam.scale, focal: cam.focal, lookAt: la, x0: -12.75, kMin: kr - 27, kMax: kr + 10, pressW });
    }
    smearBlit(ctx, KB.canvas, -panV * keyPx / 24 * 1.8, 2, 0, 50, W, 700);
    // wind: long warm streaks rushing right -> left during the run
    const wind = (1 - sm(ch - 0.25, ch + 0.05, tt)) * sm(-0.2, 0.1, tt);
    if (wind > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
      for (let i = 0; i < 28; i++) {
        const r1 = PV.rand1(i, 501), r2 = PV.rand1(i, 502), y = lerp(40, 1040, r2), len = lerp(300, 1100, PV.rand1(i, 503)), v = lerp(2800, 4600, r1);
        const x = W + 600 - ((r1 * 3000 + v * (tt + 1)) % (W + 1600));
        const g = ctx.createLinearGradient(x, 0, x + len, 0); g.addColorStop(0, PV.rgba('#ffe2b0', 0.0)); g.addColorStop(0.25, PV.rgba('#ffe2b0', 0.24 * wind)); g.addColorStop(1, 'rgba(255,226,176,0)');
        ctx.strokeStyle = g; ctx.lineWidth = lerp(1, 4, PV.rand1(i, 504)); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len * 0.5, y - 18, x + len, y - 8); ctx.stroke();
      }
      ctx.restore();
    }
    // the right hand and arm, smeared by their speed relative to the camera
    const HB = PV.buffer('g05:c18hand'), hc = HB.ctx; hc.setTransform(1, 0, 0, 1, 0, 0); hc.clearRect(0, 330, W, H - 330);
    L.handOnKeys(hc, Object.assign({}, hand, { drawKeys: false }));

    smearBlit(ctx, HB.canvas, -(vel - panV) * keyPx / 24 * 3.0, 2, 0, 330, Math.min(W, Math.round(KX + (hx - camK) * keyPx + 300)), H - 330);
    // memory of his voice: a breath of the music room's window light from the left
    const mem = sm(C18.voice, C18.voice + 0.5, tt) * (1 - sm(1.4, 2.3, tt));
    if (mem > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = mem; ctx.drawImage(PV.cached('g05:c18mem', 1200, H, (c) => { const g = c.createRadialGradient(-150, 260, 50, -150, 300, 1300); g.addColorStop(0, PV.rgba('#fff3dc', 0.5)); g.addColorStop(0.5, PV.rgba('#ffe2b8', 0.16)); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 1200, H); }), 0, 0); ctx.restore(); }
    // the gust of leaves, then they scatter into light at the chord
    const handScreen = KX + (hx - camK) * keyPx;
    leaves(ctx, tt, { count: 66, chord: ch, bx: handScreen, by: KY - 60 });
    const fl = Math.max(0, 1 - Math.abs(tt - ch - 0.05) / 0.4);
    if (fl > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; L.glow(ctx, handScreen, KY - 60, 1000, '#ffd59a', 0.38 * fl); ctx.restore(); }
    L.dust(ctx, tt, { seed: 41, count: 40, size: 2.4, alpha: 0.45, color: '#ffe7c4', vx: -60 * (1 - sm(ch, ch + 0.4, tt)), vy: -4 });
  } });
  // draw a canvas with a directional smear (motion blur) of dx px (horizontal), n taps
  // (sx, sy, sw, sh): only this region of the source holds pixels -- blit just that much
  function smearBlit(ctx, cv, dx, n, sx = 0, sy = 0, sw = cv.width, sh = cv.height) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (Math.abs(dx) < 1.5) { ctx.drawImage(cv, sx, sy, sw, sh, sx, sy, sw, sh); ctx.restore(); return; }
    for (let i = n - 1; i >= 0; i--) { const f = i / (n - 1); ctx.globalAlpha = i === 0 ? 1 : (n === 2 ? 0.4 : 0.5 / n * (1 - f * 0.5) * 2); ctx.drawImage(cv, sx, sy, sw, sh, sx + dx * f, sy, sw, sh); }
    ctx.restore();
  }

  /* ================================================================== C19 帰りの電車
   * 60.0–63.0 (3.0s). Night train window, streaming street-light bokeh. Close on the phone. 60.3 the notification:
   * 「――おめでとう。」 and the summer photo (backlit two, horizon, white bridge) arrive. 61.6 one tear falls on the screen;
   * his outline in the photo blurs and disappears. Static, the train's tiny sway.
   */
  const C19 = { msg: 0.3, photo: 0.56, tear: 1.6, tear2: 2.25 };
  // ---- the summer photo of C15 (backlit two, horizon, white bridge). Layers: bg (sky/sea/bridge/her) and him.
  //      If another scene publishes PV.summerPhoto(ctx, w, h, layer) it is used instead, so both cuts match.
  function summerPhotoLayers() {
    const PW = 960, PH = 720;
    const make = (layer) => PV.cached('g05:summerPhoto:' + layer, PW, PH, (c) => {
      if (typeof PV.summerPhoto === 'function') { PV.summerPhoto(c, PW, PH, layer); return; }
      // paint the full photo at 1920x1080 with the background library, then crop 4:3 and scale down
      const big = PV.makeCanvas(1920, 1440), b = big.ctx, HZ = 760;
      if (layer !== 'him') {
        const g = b.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, '#3f86da'); g.addColorStop(0.55, '#7db7ee'); g.addColorStop(1, '#d6ecfb'); b.fillStyle = g; b.fillRect(0, 0, 1920, HZ + 2);
        if (L.cumulonimbus) L.cumulonimbus(b, 0, { x: 430, base: HZ + 30, w: 980, h: 640, palette: 'summer', light: -2.5, lightZ: -0.15, seed: 7 });
        if (L.clouds) L.clouds(b, 0, { seed: 12, count: 4, y0: 120, y1: 380, minW: 220, maxW: 420, type: 'puff', palette: 'summer', speed: 0 });
        if (L.sea) L.sea(b, 0, { horizonY: HZ, y1: 1440, palette: 'summer', sunX: 1010, sunY: 330, road: 0.85, sparkles: 1400 });
        else { b.fillStyle = '#2f7fd8'; b.fillRect(0, HZ, 1920, 1440 - HZ); }
        if (L.bridge) L.bridge(b, { x0: 1240, x1: 1980, y: HZ - 26, towerH: 120, lw: 2.6, color: '#f6f8fa', haze: 0.22, towers: [1430, 1790], light: 'left' });
        // the sun behind them: a hot backlight between their heads
        L.glow(b, 1010, 330, 900, '#fff8e6', 0.9); L.glow(b, 1010, 330, 260, '#ffffff', 1.0);
      }
      // the two, backlit, facing the lens (faces in shadow). She is on the left with the wide-brimmed hat.
      const fig = (who) => {
        const isHim = who === 'him';
        L.figureRender(b, { x: isHim ? 1190 : 770, y: 800, scale: 3.3, style: 'silhouette', light: -1.45, rimColor: '#fff4dc', backlight: 0.45, glow: 0.75, fill: isHim ? '#1d2232' : '#262b3c' }, null, (F) => {
          F.raw((c) => {
            const faceFill = (cx, cy, rx, ry, rot) => { // face in shadow, a little sea-bounce from below
              c.save(); c.translate(cx, cy); c.rotate(rot);
              c.fillStyle = '#1c2130'; c.beginPath(); c.moveTo(0, -ry); c.bezierCurveTo(rx * 1.1, -ry, rx * 1.05, ry * 0.35, rx * 0.55, ry * 0.8); c.quadraticCurveTo(0, ry * 1.12, -rx * 0.55, ry * 0.8); c.bezierCurveTo(-rx * 1.05, ry * 0.35, -rx * 1.1, -ry, 0, -ry); c.fill();
              const g = c.createLinearGradient(0, -ry, 0, ry); g.addColorStop(0, 'rgba(30,36,52,0)'); g.addColorStop(1, 'rgba(80,104,150,0.16)'); c.fillStyle = g; c.fill();
              c.restore();
            };
            if (!isHim) {
              // long hair streaming to the left in the sea wind
              c.fillStyle = '#11141e';
              c.beginPath(); c.moveTo(0.38, -0.92); c.bezierCurveTo(0.58, -0.3, 0.62, 0.5, 0.46, 1.5); c.lineTo(-0.62, 1.5); c.bezierCurveTo(-0.95, 0.7, -1.3, 0.1, -1.66, -0.22); c.bezierCurveTo(-1.1, -0.38, -0.64, -0.82, -0.4, -0.95); c.closePath(); c.fill();
              c.lineWidth = 0.045; c.strokeStyle = '#11141e'; c.lineCap = 'round';
              for (const [y0, k] of [[-0.62, 1], [-0.32, 0.82], [0.0, 0.92], [0.3, 0.7]]) { c.beginPath(); c.moveTo(-0.45, y0); c.quadraticCurveTo(-1.15, y0 - 0.22 * k, -1.85 * k, y0 - 0.08); c.stroke(); }
              // shoulders in a sleeveless white one-piece (backlit: blue-grey)
              c.fillStyle = '#2c3348'; c.beginPath(); c.moveTo(-0.95, 1.6); c.bezierCurveTo(-0.95, 0.75, -0.7, 0.5, -0.24, 0.42); c.lineTo(0.24, 0.42); c.bezierCurveTo(0.7, 0.5, 0.95, 0.75, 0.95, 1.6); c.closePath(); c.fill();
              c.fillStyle = '#3b4560'; c.beginPath(); c.moveTo(-0.52, 1.6); c.lineTo(-0.48, 0.62); c.quadraticCurveTo(0, 0.86, 0.48, 0.62); c.lineTo(0.52, 1.6); c.closePath(); c.fill();
              c.fillStyle = '#1e2232'; c.beginPath(); c.moveTo(-0.12, 0.05); c.lineTo(0.12, 0.05); c.lineTo(0.15, 0.5); c.quadraticCurveTo(0, 0.6, -0.15, 0.5); c.closePath(); c.fill();   // neck
              faceFill(0.02, -0.36, 0.3, 0.4, 0.1);
              // side hair framing the face
              c.fillStyle = '#11141e';
              c.beginPath(); c.moveTo(-0.33, -0.7); c.quadraticCurveTo(-0.42, -0.1, -0.3, 0.42); c.lineTo(-0.21, 0.3); c.quadraticCurveTo(-0.28, -0.2, -0.2, -0.64); c.closePath(); c.fill();
              c.beginPath(); c.moveTo(0.36, -0.7); c.quadraticCurveTo(0.45, -0.1, 0.36, 0.34); c.lineTo(0.27, 0.26); c.quadraticCurveTo(0.33, -0.2, 0.24, -0.64); c.closePath(); c.fill();
              // wide-brimmed straw hat, tipped toward him
              c.save(); c.translate(0.0, -0.72); c.rotate(0.1);
              c.fillStyle = '#ebe5d8'; c.beginPath(); c.ellipse(0, 0.05, 0.82, 0.16, 0, 0, TAU); c.fill();
              c.fillStyle = '#d9d1c1'; c.beginPath(); c.ellipse(0, 0.09, 0.78, 0.1, 0, 0, Math.PI); c.fill();
              c.fillStyle = '#ebe5d8'; c.beginPath(); c.moveTo(-0.36, 0.03); c.bezierCurveTo(-0.38, -0.4, 0.38, -0.4, 0.36, 0.03); c.closePath(); c.fill();
              c.fillStyle = '#8fa7cf'; c.beginPath(); c.moveTo(-0.37, -0.02); c.quadraticCurveTo(0, 0.04, 0.37, -0.02); c.lineTo(0.37, -0.1); c.quadraticCurveTo(0, -0.04, -0.37, -0.1); c.closePath(); c.fill();
              c.restore();
            } else {
              // him: the selfie arm reaching to the lens (lower right), T-shirt, messy hair, head tipped toward her
              c.fillStyle = '#1b2030'; c.beginPath(); c.moveTo(0.7, 0.6); c.quadraticCurveTo(1.3, 0.75, 1.75, 1.6); c.lineTo(1.2, 1.7); c.quadraticCurveTo(0.95, 1.05, 0.55, 0.95); c.closePath(); c.fill();
              c.beginPath(); c.moveTo(-1.15, 1.6); c.bezierCurveTo(-1.15, 0.7, -0.8, 0.45, -0.28, 0.38); c.lineTo(0.28, 0.38); c.bezierCurveTo(0.8, 0.45, 1.1, 0.7, 1.1, 1.6); c.closePath(); c.fill();
              c.fillStyle = '#262c3e'; c.beginPath(); c.moveTo(-0.2, 0.42); c.quadraticCurveTo(0, 0.6, 0.2, 0.42); c.lineTo(0.16, 0.4); c.quadraticCurveTo(0, 0.52, -0.16, 0.4); c.closePath(); c.fill();   // collar
              c.fillStyle = '#1d2131'; c.beginPath(); c.moveTo(-0.14, 0.0); c.lineTo(0.14, 0.0); c.lineTo(0.17, 0.44); c.quadraticCurveTo(0, 0.52, -0.17, 0.44); c.closePath(); c.fill();   // neck
              for (const sg of [-1, 1]) { c.fillStyle = '#1c2130'; c.beginPath(); c.ellipse(sg * 0.33, -0.3, 0.06, 0.11, sg * 0.2, 0, TAU); c.fill(); }   // ears
              faceFill(-0.02, -0.38, 0.31, 0.42, -0.08);
              c.fillStyle = '#0e111a'; c.beginPath();
              c.moveTo(-0.38, -0.22); c.quadraticCurveTo(-0.5, -0.64, -0.36, -0.82); c.quadraticCurveTo(-0.3, -1.0, -0.08, -0.98); c.quadraticCurveTo(0.02, -1.08, 0.17, -0.99); c.quadraticCurveTo(0.42, -0.96, 0.44, -0.72);
              c.quadraticCurveTo(0.54, -0.52, 0.41, -0.24); c.lineTo(0.35, -0.42); c.quadraticCurveTo(0.28, -0.63, 0.07, -0.62); c.lineTo(-0.01, -0.5); c.lineTo(-0.11, -0.64); c.quadraticCurveTo(-0.31, -0.62, -0.32, -0.42); c.closePath(); c.fill();
              c.beginPath(); c.moveTo(-0.3, -0.9); c.lineTo(-0.42, -0.98); c.lineTo(-0.36, -0.82); c.closePath(); c.fill();
            }
          });
        });
      };
      if (layer === 'her' || layer === 'bg') fig('her');
      if (layer === 'him') fig('him');
      // flare across the lens (bg layer only)
      if (layer === 'bg' && L.flare) L.flare(b, 1010, 330, 0.7, '#fff2d0');
      c.drawImage(big.canvas, 240, 180, 1440, 1080, 0, 0, PW, PH);
    });
    return { bg: make('bg'), him: make('him'), w: PW, h: PH };
  }
  // ---- the chat screen (drawn inside the phone's screen, local units: w=272, h=524)
  function sheen19(c, w, h) {   // glass sheen over the screen
    const gs = c.createLinearGradient(0, 0, w, h); gs.addColorStop(0, 'rgba(255,255,255,0.08)'); gs.addColorStop(0.3, 'rgba(255,255,255,0)'); gs.addColorStop(0.6, 'rgba(255,255,255,0)'); gs.addColorStop(0.66, 'rgba(255,255,255,0.05)'); gs.addColorStop(0.72, 'rgba(255,255,255,0)');
    c.fillStyle = gs; c.fillRect(0, 0, w, h);
  }
  // once every message is in, the chat is still: draw it from a cache and paint only the (wet) photo on top
  function chatScreenFast(c, t, w, h, st) {
    if (t < 0.9) { chatScreen(c, t, w, h, st); return; }
    const img = PV.cached('g05:c19chat', w * 3, h * 3, (cc) => { cc.scale(3, 3); chatScreen(cc, 0.95, w, h, { skipPhoto: true, drawPhotoInto() {} }); sheen19(cc, w, h); });
    c.drawImage(img, 0, 0, w, h);
    const ph = { x: 16, y: h - 44 - 12 - 150, w: 196, h: 147 };
    c.save(); c.beginPath(); c.roundRect(ph.x, ph.y, ph.w, ph.h, 12); c.clip(); st.drawPhotoInto(c, ph); c.restore();
    c.strokeStyle = 'rgba(0,0,0,0.08)'; c.lineWidth = 1; c.beginPath(); c.roundRect(ph.x, ph.y, ph.w, ph.h, 12); c.stroke();
  }
  function chatScreen(c, t, w, h, st) {
    const UIF = '"IPAPGothic", "IPAGothic", sans-serif';
    c.fillStyle = '#e9eef6'; c.fillRect(0, 0, w, h);
    // header
    c.fillStyle = '#f7f9fc'; c.fillRect(0, 0, w, 64);
    c.fillStyle = 'rgba(30,34,44,0.85)'; c.font = '600 12px ' + UIF; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText('19:52', 14, 13);
    c.strokeStyle = '#4a7bd0'; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(20, 34); c.lineTo(13, 41); c.lineTo(20, 48); c.stroke();
    // his avatar: a guitar pick
    c.fillStyle = '#cfd9ea'; c.beginPath(); c.arc(w / 2, 41, 14, 0, TAU); c.fill();
    c.fillStyle = '#5d7fb8'; c.beginPath(); c.moveTo(w / 2, 50); c.bezierCurveTo(w / 2 - 12, 38, w / 2 - 9, 31, w / 2, 32); c.bezierCurveTo(w / 2 + 9, 31, w / 2 + 12, 38, w / 2, 50); c.fill();
    c.fillStyle = '#d6dbe3'; c.fillRect(0, 63, w, 1);
    // new messages push the older ones up (chat scroll)
    const e1 = PV.ease.outCubic(clamp((t - C19.msg) / 0.26)), e2 = PV.ease.outCubic(clamp((t - C19.photo) / 0.26));
    const scrollOld = (1 - e1) * 50 + (1 - e2) * 162, scrollMsg = (1 - e2) * 162;
    c.save(); c.beginPath(); c.rect(0, 64, w, h - 64 - 52); c.clip();
    c.save(); c.translate(0, scrollOld);
    // day chip + the stamp he sent in the morning (he sent only a stamp before the competition)
    c.fillStyle = 'rgba(120,130,150,0.18)'; c.beginPath(); c.roundRect(w / 2 - 22, 76, 44, 16, 8); c.fill();
    c.fillStyle = '#6b7486'; c.font = '500 9px ' + UIF; c.textAlign = 'center'; c.fillText('今日', w / 2, 84.5);
    { // stamp: a smiling-less little music note with sparkles on a rounded card
      const x = 16, y = 100; c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(x, y, 70, 64, 14); c.fill(); c.strokeStyle = '#d9dee6'; c.lineWidth = 1; c.stroke();
      c.fillStyle = '#ffb347'; c.beginPath(); c.ellipse(x + 30, y + 44, 9, 7, -0.4, 0, TAU); c.fill(); c.fillRect(x + 37, y + 14, 3.4, 30);
      c.beginPath(); c.moveTo(x + 40, y + 14); c.quadraticCurveTo(x + 54, y + 20, x + 50, y + 32); c.quadraticCurveTo(x + 50, y + 22, x + 40, y + 22); c.fill();
      c.fillStyle = '#ffd86b'; for (const [sx, sy, r] of [[x + 16, y + 18, 4], [x + 57, y + 46, 3], [x + 22, y + 32, 2.2]]) { c.beginPath(); c.moveTo(sx, sy - r); c.lineTo(sx + r * 0.3, sy - r * 0.3); c.lineTo(sx + r, sy); c.lineTo(sx + r * 0.3, sy + r * 0.3); c.lineTo(sx, sy + r); c.lineTo(sx - r * 0.3, sy + r * 0.3); c.lineTo(sx - r, sy); c.lineTo(sx - r * 0.3, sy - r * 0.3); c.closePath(); c.fill(); }
      c.fillStyle = '#8a93a2'; c.font = '500 8px ' + UIF; c.textAlign = 'left'; c.fillText('7:12', x + 74, y + 60);
    }
    c.restore();
    // new messages: 「――おめでとう。」 and the photo (bottom-aligned above the input bar)
    const pop = (at) => { const a = clamp((t - at) / 0.28); return { a, s: 0.86 + 0.14 * PV.ease.outBack(a) }; };
    const inputY = h - 44;
    const ph = { x: 16, y: inputY - 12 - 150, w: 196, h: 147 };
    const mb = { x: 16, y: ph.y - 12 - 38, w: 132, h: 36 };
    const m1 = pop(C19.msg), m2 = pop(C19.photo);
    if (m1.a > 0) {
      c.save(); c.translate(0, scrollMsg); c.globalAlpha *= Math.min(1, m1.a * 1.6); c.translate(mb.x, mb.y + mb.h); c.scale(m1.s, m1.s); c.translate(-mb.x, -mb.y - mb.h);
      const bub = new Path2D(); bub.roundRect(mb.x, mb.y, mb.w, mb.h, 15); bub.moveTo(mb.x + 9, mb.y + mb.h - 11); bub.quadraticCurveTo(mb.x - 2, mb.y + mb.h, mb.x - 7, mb.y + mb.h + 1); bub.quadraticCurveTo(mb.x + 4, mb.y + mb.h + 2, mb.x + 17, mb.y + mb.h - 4);
      c.fillStyle = '#ffffff'; c.fill(bub); c.strokeStyle = '#d9dee6'; c.lineWidth = 1; c.stroke(bub);
      c.fillStyle = '#1f2633'; c.font = '500 14px ' + UIF; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('――おめでとう。', mb.x + 12, mb.y + mb.h / 2 + 0.5);
      c.fillStyle = '#8a93a2'; c.font = '500 8px ' + UIF; c.fillText('14:31', mb.x + mb.w + 6, mb.y + mb.h - 5);
      c.restore();
    }
    if (m2.a > 0) {
      c.save(); c.globalAlpha *= Math.min(1, m2.a * 1.6); c.translate(ph.x, ph.y + ph.h); c.scale(m2.s, m2.s); c.translate(-ph.x, -ph.y - ph.h);
      c.save(); c.beginPath(); c.roundRect(ph.x, ph.y, ph.w, ph.h, 12); c.clip();
      st.photoRect = ph; if (!st.skipPhoto) st.drawPhotoInto(c, ph);
      c.restore();
      c.strokeStyle = 'rgba(0,0,0,0.08)'; c.lineWidth = 1; c.beginPath(); c.roundRect(ph.x, ph.y, ph.w, ph.h, 12); c.stroke();
      c.fillStyle = '#8a93a2'; c.font = '500 8px ' + UIF; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('14:31', ph.x + ph.w + 6, ph.y + ph.h - 5);
      c.restore();
    }
    c.restore();
    // input bar
    c.fillStyle = '#f7f9fc'; c.fillRect(0, inputY - 8, w, h - inputY + 8);
    c.fillStyle = '#e9eef6'; c.beginPath(); c.roundRect(40, inputY, w - 80, 28, 14); c.fill();
    c.fillStyle = '#a3abb8'; c.font = '500 10px ' + UIF; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('メッセージを入力', 52, inputY + 14);
    c.fillStyle = '#4a7bd0'; c.beginPath(); c.moveTo(w - 30, inputY + 7); c.lineTo(w - 12, inputY + 14); c.lineTo(w - 30, inputY + 21); c.lineTo(w - 26, inputY + 14); c.closePath(); c.fill();
  }
  // bokeh sprites for the streaming street lights (one per colour; drawn scaled, so the loop costs a drawImage each)
  function bokeh19(col) {
    return PV.cached('g05:c19bokeh:' + col, 128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 63);
      g.addColorStop(0, PV.rgba(col, 0.9)); g.addColorStop(0.72, PV.rgba(col, 0.75)); g.addColorStop(0.9, PV.rgba(col, 1)); g.addColorStop(1, PV.rgba(col, 0));
      c.fillStyle = g; c.beginPath(); c.arc(64, 64, 63, 0, TAU); c.fill();
    });
  }
  // the static parts of the night window: gradient, interior edge at the bottom, the window post on the left (cached)
  function window19() {
    return PV.cached('g05:c19win', W, H, (c) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0e1530'); g.addColorStop(0.55, '#16224a'); g.addColorStop(1, '#1d2b55');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    });
  }
  function windowFront19() {
    return PV.cached('g05:c19winF', W, H, (c) => {
      c.fillStyle = 'rgba(6,9,20,0.85)'; c.fillRect(0, 820, W, 260);
      let g = c.createLinearGradient(0, 760, 0, 830); g.addColorStop(0, 'rgba(6,9,20,0)'); g.addColorStop(1, 'rgba(6,9,20,0.85)'); c.fillStyle = g; c.fillRect(0, 760, W, 70);
      // the window post and its rubber seal (left), catching a line of the street light
      g = c.createLinearGradient(0, 0, 230, 0); g.addColorStop(0, '#05070f'); g.addColorStop(0.7, '#0a0e1d'); g.addColorStop(1, 'rgba(10,14,29,0)'); c.fillStyle = g; c.fillRect(0, 0, 230, H);
      c.fillStyle = '#04060c'; c.fillRect(0, 0, 118, H);
      c.fillStyle = 'rgba(255,214,160,0.18)'; c.fillRect(118, 0, 2, 820);
      c.fillStyle = 'rgba(150,170,220,0.12)'; c.fillRect(126, 0, 6, 820);
      g = c.createLinearGradient(0, 0, 420, 0); g.addColorStop(0, 'rgba(5,8,18,0.5)'); g.addColorStop(1, 'rgba(5,8,18,0)'); c.fillStyle = g; c.fillRect(0, 0, 420, H);
      // the phone screen's light spilling on the dark carriage around it (the phone barely moves: static is fine)
      c.save(); c.translate(950, 262); c.rotate(-0.05); c.filter = 'blur(70px)'; c.fillStyle = 'rgba(190,210,255,0.16)'; c.beginPath(); c.roundRect(-136 * 2.55 - 60, -262 * 2.55 - 60, 272 * 2.55 + 120, 524 * 2.55 + 160, 90); c.fill(); c.restore();
    });
  }
  // her left hand cradling the phone: the thumb on the left edge (in front), two fingertips round the right edge (behind)
  function thumb19(c, x0, y0, x1, y1, r0, r1, rim) {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, a = Math.atan2(dy, dx);
    const P = new Path2D(); P.moveTo(x0 + nx * r0, y0 + ny * r0); P.lineTo(x1 + nx * r1, y1 + ny * r1); P.arc(x1, y1, r1, a + Math.PI / 2, a - Math.PI / 2, true); P.lineTo(x0 - nx * r0, y0 - ny * r0); P.closePath();
    c.fillStyle = '#4b4552'; c.fill(P);
    c.save(); c.clip(P);
    const g = c.createLinearGradient(x0 + nx * r0, y0 + ny * r0, x0 - nx * r0, y0 - ny * r0); g.addColorStop(0, PV.rgba(rim, 0.6)); g.addColorStop(0.3, 'rgba(150,140,160,0.18)'); g.addColorStop(1, 'rgba(16,14,24,0.6)');
    c.fillStyle = g; c.fillRect(Math.min(x0, x1) - 200, Math.min(y0, y1) - 200, Math.abs(dx) + 400, Math.abs(dy) + 400);
    // the nail near the tip
    c.translate(x1 - dx / l * r1 * 0.55, y1 - dy / l * r1 * 0.55); c.rotate(a);
    c.fillStyle = 'rgba(196,190,206,0.5)'; c.beginPath(); c.ellipse(0, 0, r1 * 0.75, r1 * 0.55, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, r1 * 0.75, r1 * 0.55, 0, -1.2, 0.4); c.stroke();
    c.restore();
    c.strokeStyle = 'rgba(28,18,22,0.8)'; c.lineWidth = 1.6; c.stroke(P);
  }
  PV.shot('C19', { draw(ctx, t, d) {
    const tt = clamp(t, -0.3, d + 0.3);
    // ---- the window: night city streaming past (defocused street lights)
    ctx.drawImage(window19(), 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 46; i++) {
      const r = (k) => PV.rand1(i, k + 700), depth = r(1), v = lerp(260, 1500, depth);
      const x = W + 300 - ((r(2) * (W + 600) + v * (tt + 2)) % (W + 600)), y = lerp(80, 760, r(3)) + 40 * Math.sin(i);
      const rad = lerp(18, 70, depth) * (0.7 + 0.6 * r(4)), col = ['#ffbf6b', '#ffd59a', '#e9f1ff', '#ffb0c0', '#ffbf6b'][Math.floor(r(5) * 5)];
      ctx.globalAlpha = lerp(0.18, 0.45, r(6)) * 0.9; const rx = rad * (1 + depth * 0.9);
      ctx.drawImage(bokeh19(col), x - rx, y - rad, rx * 2, rad * 2);   // motion-streaked (stretched) bokeh disc
    }
    ctx.restore();
    { const wf = windowFront19(); ctx.drawImage(wf, 0, 700, W, 380, 0, 700, W, 380); ctx.drawImage(wf, 0, 0, 440, 700, 0, 0, 440, 700); ctx.drawImage(wf, 440, 0, 1480, 700, 440, 0, 1480, 700); }
    // ---- the phone (close) in her hand, the train's small sway
    const sway = { x: 4 * Math.sin(tt * 3.1) + 2 * Math.sin(tt * 7.3), y: 3 * Math.sin(tt * 4.3 + 1) + 1.5 * N2(tt * 6, 3), r: 0.004 * Math.sin(tt * 2.7) };
    const P = summerPhotoLayers();
    const drops = [{ at: C19.tear, u: 0.655, v: 0.42 }, { at: C19.tear2, u: 0.6, v: 0.66 }];
    const st = {
      drawPhotoInto(c, R) {
        c.drawImage(P.bg, R.x, R.y, R.w, R.h);
        c.drawImage(P.him, R.x, R.y, R.w, R.h);
        const ag = tt - drops[0].at; if (ag < 0) return;
        // the wet patch: inside it the picture swims and softens, and he melts into the light (feathered edge, no frame)
        const S = 2, bw = Math.round(R.w * S), bh = Math.round(R.h * S), wet = sm(0, 1.15, ag);
        const B = PV.buffer('g05:c19wet', bw, bh), b = B.ctx, M = PV.buffer('g05:c19mask', bw, bh), m = M.ctx;
        b.clearRect(0, 0, bw, bh); m.clearRect(0, 0, bw, bh);
        const bl = (2 + 9 * wet) * S / 3;
        b.filter = 'blur(' + bl.toFixed(1) + 'px)'; b.drawImage(P.bg, -8, 3 + 7 * wet, bw + 16, bh + 14);
        b.globalAlpha = 1 - 0.72 * sm(0.12, 1, wet); b.filter = 'blur(' + (bl * 1.7).toFixed(1) + 'px)'; b.drawImage(P.him, -8, 4 + 10 * wet, bw + 16, bh + 14);
        b.globalAlpha = 1; b.filter = 'none';
        b.globalCompositeOperation = 'screen'; b.fillStyle = 'rgba(205,225,255,' + (0.22 + 0.2 * wet).toFixed(3) + ')'; b.fillRect(0, 0, bw, bh); b.globalCompositeOperation = 'source-over';   // the water catches the screen's light: he melts into it
        m.fillStyle = '#ffffff';
        for (const dp of drops) {
          const a2 = tt - dp.at; if (a2 < 0) continue;
          const w2 = sm(0, 1.15, a2), rr = (7 + 15 * PV.ease.outCubic(clamp(a2 / 0.25)) + 8 * clamp((a2 - 0.25) / 1.1)) * S * (dp === drops[0] ? 1 : 0.8);
          const run = 40 * S * PV.ease.inOut(clamp((a2 - 0.15) / 1.2)), cx = dp.u * bw, cy = dp.v * bh;
          m.filter = 'blur(' + ((4 + 8 * w2) * S / 3).toFixed(1) + 'px)'; m.beginPath();
          for (let k = 0; k <= 40; k++) { const an = k / 40 * TAU, rk = rr * (1.35 + 0.2 * Math.sin(an * 3 + dp.u * 9) + 0.12 * Math.sin(an * 5 + 2)), down = Math.max(0, Math.sin(an)) * run; const px = cx + Math.cos(an) * rk, py = cy + Math.sin(an) * rk * 0.92 + down; if (k) m.lineTo(px, py); else m.moveTo(px, py); }
          m.closePath(); m.fill(); m.filter = 'none';
        }
        b.globalCompositeOperation = 'destination-in'; b.drawImage(M.canvas, 0, 0); b.globalCompositeOperation = 'source-over';
        c.drawImage(B.canvas, R.x, R.y, R.w, R.h);
        // the drops themselves: small domes with a bright point, flattening as they spread
        for (const dp of drops) {
          const a2 = tt - dp.at; if (a2 < 0) continue;
          const hx = R.x + R.w * dp.u, hy = R.y + R.h * dp.v + 10 * PV.ease.inOut(clamp((a2 - 0.2) / 1.2));
          const br = (4.5 + 3.5 * PV.ease.outCubic(clamp(a2 / 0.2))) * (1 - 0.35 * sm(0.4, 1.4, a2)), bA = 1 - 0.6 * sm(0.5, 1.4, a2);
          c.save();
          const lg = c.createRadialGradient(hx - br * 0.25, hy - br * 0.3, br * 0.1, hx, hy, br); lg.addColorStop(0, 'rgba(255,255,255,0.22)'); lg.addColorStop(0.7, 'rgba(235,244,255,0.10)'); lg.addColorStop(0.9, PV.rgba('#9fb6d8', 0.16 * bA)); lg.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = lg; c.beginPath(); c.arc(hx, hy, br, 0, TAU); c.fill();
          c.fillStyle = PV.rgba('#ffffff', 0.95 * bA); c.beginPath(); c.ellipse(hx - br * 0.36, hy - br * 0.4, br * 0.22, br * 0.13, -0.6, 0, TAU); c.fill();
          c.fillStyle = PV.rgba('#ffffff', 0.45 * bA); c.beginPath(); c.arc(hx + br * 0.4, hy + br * 0.42, br * 0.12, 0, TAU); c.fill();   // the caustic on the far side
          const ring = clamp(a2 / 0.3); if (ring < 1) { c.strokeStyle = PV.rgba('#ffffff', 0.8 * (1 - ring)); c.lineWidth = 1.1; c.beginPath(); c.arc(hx, hy, br * (1 + 2.2 * ring), 0, TAU); c.stroke(); const fg = c.createRadialGradient(hx, hy, 0, hx, hy, br * 2.4); fg.addColorStop(0, PV.rgba('#ffffff', 0.55 * (1 - ring))); fg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = fg; c.beginPath(); c.arc(hx, hy, br * 2.4, 0, TAU); c.fill(); }   // the splash catches the light
          c.restore();
        }
      },
    };
    const PX = 950, PY = 262, PS = 2.55, ROT = -0.05;
    ctx.save(); ctx.translate(sway.x, sway.y); ctx.rotate(sway.r);
    // fingertips behind the phone's right edge (her left hand wraps round the back), lit by the street lights
    {
      ctx.save(); ctx.translate(PX, PY); ctx.rotate(ROT); ctx.scale(PS, PS);
      for (const [y0, r] of [[52, 15], [118, 14.5]]) { const g = ctx.createLinearGradient(150, 0, 176, 0); g.addColorStop(0, '#1d1a24'); g.addColorStop(0.7, '#3f3a48'); g.addColorStop(1, 'rgba(255,206,160,0.85)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(150, y0, 22, r, -0.15, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // the phone body is drawn once (library phone, empty screen) and re-used; only the screen is painted per frame
    {
      const body = PV.cached('g05:c19phone', 900, 1700, (c) => L.phone(c, 0, { x: 450, y: 850, s: PS, rot: 0, screen: 'photo', ui: false, glow: 0, bright: 1, tone: 'night', light: -0.6, shadow: false, drawPhoto: () => {} }));
      ctx.save(); ctx.translate(PX, PY); ctx.rotate(ROT);
      ctx.drawImage(body, -450, -850);
      ctx.scale(PS, PS); ctx.beginPath(); ctx.roundRect(-136, -260, 272, 524, 6); ctx.clip(); ctx.translate(-136, -260);
      chatScreenFast(ctx, tt, 272, 524, st);
      if (tt < 0.9) sheen19(ctx, 272, 524);   // (the cached chat already carries it)
      ctx.restore();
    }
    // her thumb on the left edge, in front of the phone
    {
      ctx.save(); ctx.translate(PX, PY); ctx.rotate(ROT); ctx.scale(PS, PS);
      thumb19(ctx, -205, 335, -147, 228, 25, 17, '#cfe0ff');
      ctx.restore();
    }
    // the falling tears: a bright streak from above just before each lands
    for (const dp of drops) {
      const fall = (tt - (dp.at - 0.14)) / 0.14;
      if (fall > 0 && fall < 1) {
        const lx = -136 + 16 + 196 * dp.u, ly = -260 + (524 - 44 - 12 - 150) + 147 * dp.v;
        const ca = Math.cos(ROT), sa = Math.sin(ROT), sxp = PX + (lx * ca - ly * sa) * PS, syp = PY + (lx * sa + ly * ca) * PS;
        const y0 = syp - 700 * (1 - fall);
        const tg = ctx.createLinearGradient(sxp, y0 - 120, sxp, y0); tg.addColorStop(0, 'rgba(220,235,255,0)'); tg.addColorStop(1, 'rgba(235,245,255,0.75)');
        ctx.strokeStyle = tg; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sxp, y0 - 120); ctx.lineTo(sxp, y0); ctx.stroke();
        ctx.fillStyle = 'rgba(240,248,255,0.9)'; ctx.beginPath(); ctx.ellipse(sxp, y0, 9, 12, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
    // passing platform light sweeping over the glass
    const sweep = ((tt + 0.6) % 1.45) / 1.45;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const sx0 = -600 + sweep * 3200, g = ctx.createLinearGradient(sx0, 0, sx0 + 400, 400); g.addColorStop(0, 'rgba(255,191,107,0)'); g.addColorStop(0.5, 'rgba(255,214,160,0.09)'); g.addColorStop(1, 'rgba(255,191,107,0)');
    const bx0 = Math.max(0, sx0 - H - 50), bx1 = Math.min(W, sx0 + 850); if (bx1 > bx0) { ctx.fillStyle = g; ctx.fillRect(bx0, 0, bx1 - bx0, H); } ctx.restore();
  } });

})();

/* g05_competition — ACT2「予選」C16–C19 (49.5–63.0)
 *   C16 白い世界: 客席の側（最前列やや左＝彼の席＝彼女の右）から見た先輩の寄り。輪郭のない白の中に、黒いグランドピアノ
 *       （手前の側板と、開いた大屋根）だけが浮かぶ。濃紺のドレス、首の付け根の低いシニヨン、白い顔。焦点の合わない瞳（光は
 *       小さく鈍く、両目が平行に鍵盤の方へ）、浅く速い息、肩の小さな震え。51.4 咳払い→瞳が先に、続いて頭がわずかに左（彼＝
 *       カメラの方）へ向き、瞬き一つで瞳に光が戻る（目が合う。原作3384「顔が、向いた。こっちを見た」）。頬に赤み、白い世界に
 *       ホールの琥珀が差す。腕を解き（51.85–52.75）、52.4 目を閉じて息を吸い、肩が上がる（原作3386）。static→slow push-in。
 *   C17 〈別れの曲〉: 同じ客席側から、一本のスポットライトの中で弾く先輩（3/4→横顔）。肩がゆったり動き（原作3406）、
 *       モノローグ（右の縦書き 53.4–56.9）の間に眉間に力が入り、瞳が潤み、瞬きで一筋だけ涙が頬を伝う（泣き顔にはせず、
 *       「力強い顔」原作3408 のまま）。白が暖かいホールの光へ、光芒と微粒子、ドリーイン。右側（縦書きの列）は大屋根の内側と
 *       暗いホールで静かに保つ。
 *   C18 〈木枯らし〉: 高音から駆け下りる右手（モーションブラー）＋枯葉の突風（右→左）。pan_left→static。57.2 記憶の声＝音楽室の窓光、
 *       59.4 最終和音で手が止まり、枯葉が散って光（燠）になる。
 *   C19 帰りの電車: 流れる街灯のボケ、彼女の手の中のスマホ。60.3「――おめでとう。」と夏の写真、61.6/62.25 涙が落ちて写真の彼が
 *       光の中ににじんで見えなくなる。
 * C16/C17: the pianist is a PV.anime figure (anime_body.js + anime_head.js). The grand piano is built in the SAME body space
 *   (head units; the bench seat = origin; y down; +x = her LEFT = the bass end; +z = toward the keyboard) and projected with the
 *   figure's own orthographic camera (facing, camPitch), so the case, the lid and her body always agree. Seen from the audience
 *   side, the case wall hides her hands (as in a real hall): the face, the shoulders and the upper arms act.
 *   Local helpers on the library's exports (the library files are not edited; new keys only, nothing existing is changed):
 *   - pose 'g05_piano' in PV.anime.FIG_POSES: the library's 'piano' + the arms released toward the lap (rel), shoulder lift
 *     for the breath (lift), a frozen tremble (trem), neckPitch / neckRoll;
 *   - who 'g05_senpai' in PV.anime.BODY_SPECS: 先輩 with the neck 0.07 H shorter (作画修正 for these two cuts: with the
 *     updo the whole nape shows and the library's neck read as a "giraffe" neck at 3/4 and in profile), + head.neckW 1.1–1.2;
 *   - oneTear(): ONE tear down the near cheek from the head's anchors (the library's streaming tears run from both eyes and,
 *     near the profile, the far eye's stream is drawn outside the face contour — reported).
 * The C15 photo: C19 uses PV.summerPhoto(ctx, w, h, layer) ('bg' | 'him') published by g04 (an anime-bust fallback otherwise);
 *   the tears land where HE is in that photo (the box of the 'him' layer), whatever its layout.
 */
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, TAU = Math.PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp, sm = PV.smooth, smr = PV.smoother, N2 = PV.noise2;
  const SB_START = { C16: 49.5, C17: 53.0, C18: 57.0, C19: 60.0 };
  // the film's global time of local t (lip-sync, blinks, on-twos); solo previews fall back to the storyboard start
  const absT = (S, id, t) => ((S && S.start > 0.01) ? S.start : SB_START[id]) + t;
  const tw = (T) => PV.anime.onTwos(T);
  const mixH = (a, b, k) => PV.anime.mixHex(a, b, clamp(k));

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

  /* ================================================================== the grand piano, in the pianist's body space
   * Same camera as PV.anime.figure: VM = Rx(camPitch)·Ry(facing); screen = anchor + scale·(VM·p).xy, depth = (VM·p).z
   * (+ toward the camera). Proportions of a 7-ft concert grand in her head units (1 H = 23 cm): keys 1.0 H over the seat,
   * the rim 1.22 H over the keys, 6.7 H wide, 10.7 H long; the lid hinged on the straight bass side, open on the full stick. */
  function gcam(th, ph, x, y, s) { return { th, ph, x, y, s, ct: Math.cos(th), st: Math.sin(th), cp: Math.cos(ph), sp: Math.sin(ph) }; }
  function gp(c, X, Y, Z) { const x1 = c.ct * X + c.st * Z, z1 = -c.st * X + c.ct * Z; return [c.x + c.s * x1, c.y + c.s * (c.cp * Y + c.sp * z1), -c.sp * Y + c.cp * z1]; }
  const GP = { rimY: -2.22, botY: -0.74, armY: -1.14, frontZ: 0.98, fallZ: 1.86, hinge: 3.35, lidA: 0.6, plateY: -1.84, lidT: 0.075, rimW: 0.1 };
  // top view of the case: from the treble end of the fallboard round the bentside and the tail, then the straight bass side
  const GP_OUT = (() => {
    const key = [[-3.35, 1.86], [-3.35, 2.9], [-3.27, 3.9], [-2.95, 4.9], [-2.38, 5.9], [-1.6, 6.9], [-0.76, 7.9], [0.04, 8.85], [0.8, 9.72], [1.55, 10.38], [2.4, 10.68], [3.05, 10.45], [3.35, 9.85]];
    const out = [], n = key.length, P = (i) => key[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < n - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < 5; k++) {
        const t = k / 5, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(key[n - 1].slice()); out.push([3.35, 1.86]);
    return out;
  })();
  // the same outline moved inward by the rim's thickness (the inner edge of the rim top)
  const GP_IN = GP_OUT.map((p, i, O) => {
    const n = O.length, a = O[(i - 1 + n) % n], b = O[(i + 1) % n];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    return [p[0] + tz * GP.rimW, p[1] - tx * GP.rimW];
  });
  // a point of the open lid above outline point (x, z); off > 0 moves toward the lid's top face
  function gLid(x, z, off = 0) { const d = GP.hinge - x, ca = Math.cos(GP.lidA), sa = Math.sin(GP.lidA); return [GP.hinge - d * ca + off * sa, GP.rimY - d * sa - off * ca, z]; }
  // the longest z of the case along x (for the strings reflected in the lid)
  function gTailZ(x) {
    let z = GP.fallZ; const O = GP_OUT;
    for (let i = 0; i < O.length - 1; i++) { const a = O[i], b = O[i + 1]; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) { const u = (x - a[0]) / (b[0] - a[0]); z = Math.max(z, lerp(a[1], b[1], u)); } }
    return z;
  }
  const faceCam = (c, nx, nz) => -c.st * nx + c.ct * nz;   // > 0: a vertical face with outward normal (nx, 0, nz) is seen
  function polyPath(c, pts) { const p = new Path2D(); pts.forEach((q, i) => { const s = gp(c, q[0], q[1], q[2]); i ? p.lineTo(s[0], s[1]) : p.moveTo(s[0], s[1]); }); p.closePath(); return p; }
  function segNormal(a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; }   // outward (the outline runs clockwise in the x-z plane)

  // inside the case (behind her): the plate and the strings at the bottom of the rim, the inner faces of the far rim, its top
  function pianoBack(ctx, c, pal) {
    const O = GP_OUT, I = GP_IN, n = O.length;
    ctx.save();
    const floor = polyPath(c, I.map(([x, z]) => [x, GP.plateY, z]));
    ctx.fillStyle = pal.inner; ctx.fill(floor);
    ctx.save(); ctx.clip(floor);
    // the cast-iron plate (a dim gold shape) and the strings running toward the tail
    const pl = polyPath(c, I.map(([x, z]) => [x * 0.86 + 0.25, GP.plateY - 0.01, GP.fallZ + (z - GP.fallZ) * 0.9 + 0.35]));
    ctx.fillStyle = pal.plate; ctx.fill(pl);
    ctx.lineWidth = Math.max(0.6, c.s * 0.004); ctx.strokeStyle = pal.strings;
    for (let k = 0; k < 26; k++) { const x = lerp(-3.05, 3.1, k / 25), z1 = gTailZ(x) - 0.25; if (z1 < GP.fallZ + 0.6) continue; const a = gp(c, x, GP.plateY - 0.02, GP.fallZ + 0.35), b = gp(c, x * 0.94 + 0.12, GP.plateY - 0.02, z1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    ctx.restore();
    // the inner faces of the rim that face the camera (the far side), and the top of the far rim
    for (let i = 0; i < n; i++) {
      const a = O[i], b = O[(i + 1) % n], ai = I[i], bi = I[(i + 1) % n], nn = segNormal(a, b);
      if (faceCam(c, nn[0], nn[1]) > 0) continue;
      ctx.fillStyle = pal.innerWall; ctx.fill(polyPath(c, [[ai[0], GP.rimY, ai[1]], [bi[0], GP.rimY, bi[1]], [bi[0], GP.plateY, bi[1]], [ai[0], GP.plateY, ai[1]]]));
    }
    for (let i = 0; i < n; i++) {
      const a = O[i], b = O[(i + 1) % n], ai = I[i], bi = I[(i + 1) % n], nn = segNormal(a, b);
      if (faceCam(c, nn[0], nn[1]) > 0) continue;
      const p = polyPath(c, [[a[0], GP.rimY, a[1]], [b[0], GP.rimY, b[1]], [bi[0], GP.rimY, bi[1]], [ai[0], GP.rimY, ai[1]]]);
      ctx.fillStyle = pal.top; ctx.fill(p); ctx.strokeStyle = pal.top; ctx.lineWidth = 0.8; ctx.stroke(p);
    }
    // the bass-side cheek block beside the keyboard (far)
    ctx.fillStyle = pal.side; ctx.fill(polyPath(c, [[2.66, GP.armY, GP.frontZ], [3.35, GP.armY, GP.frontZ], [3.35, GP.armY, GP.fallZ], [2.66, GP.armY, GP.fallZ]]));
    ctx.restore();
  }
  // the near side of the case (in front of her): the outer faces of the rim that face the camera as ONE lacquered shape (no
  // facets: one fill, a soft reflection of the room, one crisp highlight under the rounded top edge), the near rim's top band,
  // and the treble cheek block beside the keyboard
  function pianoFront(ctx, c, pal) {
    const O = GP_OUT, I = GP_IN, n = O.length, segs = [];
    for (let i = 0; i < n - 1; i++) { const a = O[i], b = O[i + 1], nn = segNormal(a, b); if (faceCam(c, nn[0], nn[1]) > 0.01) segs.push(i); }
    ctx.save();
    // the treble arm: the case side sweeps down from the rim to the key level in one S-curve toward the front of the keys
    const AZ = [], NA = 10; for (let k = 0; k <= NA; k++) AZ.push(lerp(GP.frontZ, GP.fallZ, k / NA));
    const armTopY = (z) => lerp(GP.armY, GP.rimY, PV.smoother(GP.frontZ + 0.22, GP.fallZ, z));
    const armSide = faceCam(c, -1, 0) > 0.01;
    const arm = armSide ? polyPath(c, AZ.map((z) => [-3.35, armTopY(z), z]).concat(AZ.slice().reverse().map((z) => [-3.35, GP.botY, z]))) : null;
    const armTop = polyPath(c, [[-3.35, GP.armY, GP.frontZ], [-2.66, GP.armY, GP.frontZ], [-2.66, GP.armY, GP.frontZ + 0.3], [-3.35, armTopY(GP.frontZ + 0.3), GP.frontZ + 0.3]]);
    // one silhouette for the visible wall run(s) + the arm
    const wall = new Path2D();
    for (const i of segs) { const a = O[i], b = O[i + 1]; wall.addPath(polyPath(c, [[a[0], GP.rimY, a[1]], [b[0], GP.rimY, b[1]], [b[0], GP.botY, b[1]], [a[0], GP.botY, a[1]]])); }
    if (arm) wall.addPath(arm);
    ctx.fillStyle = pal.side; ctx.fill(wall); ctx.fillStyle = pal.top; ctx.fill(armTop);
    // reflections: the room above mirrored in the upper part of the wall, darker toward the bottom; vertical sheen streaks
    ctx.save(); ctx.clip(wall);
    const t0 = gp(c, -3.3, GP.rimY, 3), b0 = gp(c, -3.3, GP.botY, 3);
    let g = ctx.createLinearGradient(t0[0], t0[1], b0[0], b0[1]);
    g.addColorStop(0, PV.rgba(pal.refl, pal.reflA)); g.addColorStop(0.35, PV.rgba(pal.refl, pal.reflA * 0.25)); g.addColorStop(1, PV.rgba(pal.refl, 0)); ctx.fillStyle = g; ctx.fillRect(-2000, -2000, 6000, 6000);
    for (const [zc, wq, aq] of pal.streaks) {   // soft vertical bands where the curve of the bentside turns to the light
      let k0 = 0; for (let i = 0; i < n; i++) if (Math.abs(O[i][1] - zc) < Math.abs(O[k0][1] - zc) && O[i][0] < 0) k0 = i;
      const p = O[k0], q0 = gp(c, p[0], GP.rimY, p[1] - wq), q1 = gp(c, p[0], GP.rimY, p[1] + wq);
      g = ctx.createLinearGradient(q0[0], q0[1], q1[0], q1[1]); g.addColorStop(0, PV.rgba(pal.refl, 0)); g.addColorStop(0.5, PV.rgba(pal.refl, aq)); g.addColorStop(1, PV.rgba(pal.refl, 0));
      ctx.fillStyle = g; ctx.fillRect(-2000, -2000, 6000, 6000);
    }
    ctx.restore();
    // the near rim's top band (a thin lit surface)
    for (const i of segs) {
      const a = O[i], b = O[i + 1], ai = I[i], bi = I[i + 1];
      const p = polyPath(c, [[a[0], GP.rimY, a[1]], [b[0], GP.rimY, b[1]], [bi[0], GP.rimY, bi[1]], [ai[0], GP.rimY, ai[1]]]);
      ctx.fillStyle = pal.top; ctx.fill(p); ctx.strokeStyle = pal.top; ctx.lineWidth = 0.8; ctx.stroke(p);
    }
    // the highlight under the rounded top edge: along the arm's sweep and on along the rim, and the ink of the top edge
    const run = (armSide ? AZ.map((z) => [-3.35, armTopY(z), z]) : []).concat(segs.length ? segs.map((i) => [O[i][0], GP.rimY, O[i][1]]).concat([[O[segs[segs.length - 1] + 1][0], GP.rimY, O[segs[segs.length - 1] + 1][1]]]) : []);
    const hl = (dy, w, col, a) => { ctx.strokeStyle = PV.rgba(col, a); ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); run.forEach(([x, y, z], k) => { const q = gp(c, x, y + dy, z); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); };
    if (run.length > 1) { hl(0.035, Math.max(1.2, c.s * 0.011), pal.edge, pal.edgeA); hl(0.0, Math.max(0.8, c.s * 0.004), pal.line, 0.9); }
    // ink round the arm's front edge
    if (arm) { const a = gp(c, -3.35, GP.armY, GP.frontZ), b = gp(c, -3.35, GP.botY, GP.frontZ); ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1, c.s * 0.006); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    ctx.restore();
  }
  // the open lid: its lacquered underside (the strings and the light mirrored in it), the edge of the board, the prop stick
  function pianoLid(ctx, c, pal) {
    const O = GP_OUT;
    ctx.save();
    const under = polyPath(c, O.map(([x, z]) => gLid(x, z)));
    ctx.fillStyle = pal.lid; ctx.fill(under);
    ctx.save(); ctx.clip(under);
    // the strings and the plate mirrored (lines along z), fading toward the free edge
    ctx.lineWidth = Math.max(0.7, c.s * 0.005);
    for (let k = 0; k < 24; k++) {
      const x = lerp(-3.0, 3.15, k / 23), z1 = gTailZ(x) - 0.3; if (z1 < GP.fallZ + 0.6) continue;
      const a = gp(c, ...gLid(x, GP.fallZ + 0.3)), b = gp(c, ...gLid(x, z1));
      ctx.strokeStyle = PV.rgba(pal.lidRefl, pal.lidReflA * (0.45 + 0.55 * (x + 3) / 6.2)); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // a broad soft sheen across the board (the light source mirrored)
    const s0 = gp(c, ...gLid(1.2, 3.0)), s1 = gp(c, ...gLid(-2.6, 6.5));
    const g = ctx.createLinearGradient(s0[0], s0[1], s1[0], s1[1]); g.addColorStop(0, PV.rgba(pal.lidSheen, 0)); g.addColorStop(0.5, PV.rgba(pal.lidSheen, pal.lidSheenA)); g.addColorStop(1, PV.rgba(pal.lidSheen, 0));
    ctx.fillStyle = g; ctx.fillRect(-2000, -2000, 6000, 6000);
    ctx.restore();
    // the thickness of the board along its free edge (bentside + tail), lit along its outer corner
    const free = O.filter((p) => p[0] < GP.hinge - 0.02);
    const band = new Path2D();
    for (let i = 0; i < free.length - 1; i++) {
      const a = free[i], b = free[i + 1];
      band.addPath(polyPath(c, [gLid(a[0], a[1]), gLid(b[0], b[1]), gLid(b[0], b[1], GP.lidT), gLid(a[0], a[1], GP.lidT)]));
    }
    ctx.fillStyle = pal.lidEdge; ctx.fill(band);
    ctx.strokeStyle = PV.rgba(pal.edge, pal.edgeA * 0.9); ctx.lineWidth = Math.max(1, c.s * 0.006); ctx.lineJoin = 'round'; ctx.beginPath();
    free.forEach(([x, z], k) => { const q = gp(c, ...gLid(x, z, GP.lidT * 0.5)); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
    // ink round the board
    ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1, c.s * 0.005); ctx.stroke(under);
    // the front edge of the lid catches a thin line of light
    { const a = gp(c, ...gLid(GP.hinge, GP.fallZ)), b = gp(c, ...gLid(-3.35, GP.fallZ)); ctx.strokeStyle = PV.rgba(pal.edge, pal.edgeA * (pal.lidFrontA ?? 0.7)); ctx.lineWidth = Math.max(1, c.s * 0.005); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    // the prop stick from the bentside rim up to the board
    { const r = gp(c, -0.55, GP.rimY, 8.1), l = gp(c, ...gLid(-0.7, 8.1)); const k = 0.82, top = [lerp(r[0], l[0], k), lerp(r[1], l[1], k)];
      ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(2, c.s * 0.034); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(r[0], r[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
      ctx.strokeStyle = PV.rgba(pal.edge, pal.edgeA * 0.6); ctx.lineWidth = Math.max(1, c.s * 0.008); ctx.beginPath(); ctx.moveTo(r[0] - c.s * 0.01, r[1]); ctx.lineTo(top[0] - c.s * 0.01, top[1]); ctx.stroke(); }
    ctx.restore();
  }

  /* ================================================================== the pianist: a local variant of the library's piano pose
   * params (besides the library's): rel 0..1 (the arms leave the keys and come down to the lap, with a small lift), lift
   * (shoulders up: the breath), trem 0..1 (frozen tremble of the arms / shoulders), neckPitch (absolute nod), keys/bench false */
  function ensurePose() {
    const SP = PV.anime && PV.anime.BODY_SPECS;
    if (SP && SP.senpai && !SP.g05_senpai) {   // 作画修正 for these cuts: the neck 0.07 H shorter (the updo shows the whole nape)
      const c = JSON.parse(JSON.stringify(SP.senpai)); c.neckLen = Math.max(0.2, c.neckLen - 0.07); SP.g05_senpai = c;
    }
    const P = PV.anime && PV.anime.FIG_POSES; if (!P || P.g05_piano || !P.piano) return;
    const base = P.piano;
    P.g05_piano = {
      facing: base.facing, anchor: base.anchor,
      body(sp, prm, tq, o, OF) {
        const B = base.body(sp, prm, tq, o, OF), lift = prm.lift || 0, tr = prm.trem || 0;
        B.shrugL = (B.shrugL || 0) + lift + tr * 0.004 * N2(tq * 7.1, 2.2); B.shrugR = (B.shrugR || 0) + lift + tr * 0.004 * N2(tq * 6.3, 5.4);
        if (prm.breathK !== undefined) B.breath = prm.breathK;
        B.neck = Object.assign({}, B.neck);
        if (prm.neckPitch !== undefined) B.neck.pitch = prm.neckPitch;
        if (prm.neckRoll !== undefined) B.neck.roll = (B.neck.roll || 0) + prm.neckRoll;
        B.spine = Object.assign({}, B.spine); B.spine.bend = (B.spine.bend || 0) + (prm.bendAdd || 0) - lift * 0.4;
        return B;
      },
      limbs(J, sp, prm, tq, o, OF) {
        const K = base.limbs(J, sp, Object.assign({}, prm, { hands: 'keys' }), tq, o, OF);
        const rel = prm.rel || 0, tr = prm.trem || 0;
        if (tr > 0) for (const s of ['L', 'R']) { const a = K.arms[s], m = s === 'L' ? 1 : -1; a.W = [a.W[0] + tr * 0.012 * N2(tq * 8.3, m * 3), a.W[1] + tr * 0.012 * N2(m * 5, tq * 7.7), a.W[2]]; }
        if (rel <= 0) return K;
        const Lp = base.limbs(J, sp, Object.assign({}, prm, { hands: 'lap' }), tq, o, OF), u = PV.ease.inOutCubic(clamp(rel)), up = Math.sin(Math.PI * clamp(rel * 1.15)) * 0.16;
        const mixV = (a, b) => (a && b ? a.map((v, j) => lerp(v, b[j], u)) : b || a);
        for (const s of ['L', 'R']) {
          const a = K.arms[s], b = Lp.arms[s], W = mixV(a.W, b.W);
          K.arms[s] = { W: [W[0], W[1] - up, W[2]], pole: mixV(a.pole, b.pole), hand: Object.assign({}, b.hand, { f: mixV(a.hand.f, b.hand.f), palm: mixV(a.hand.palm, b.hand.palm), curl: lerp(a.hand.curl ?? 0.5, b.hand.curl ?? 0.3, u), spread: lerp(a.hand.spread ?? 0.2, b.hand.spread ?? 0.1, u) }) };
        }
        return K;
      },
      props(G, prm, tq, o) { if (base.props) base.props(G, Object.assign({}, prm, { keys: false, bench: prm.bench ?? false }), tq, o); },
    };
  }

  /* ================================================================== C16 予選・白い世界
   * 49.5–53.0 (3.5 s, dip from white). The camera is his side of the hall (front row, a little left = her right side): her
   * face in 3/4 looking down at the keys, the black piano floating in the white (the near case wall across the bottom, the
   * open lid in the upper right). 49.5–51.4 tinnitus only: a slow heartbeat pulse in the white, the eyes unfocused (small dull
   * highlights, both eyes parallel off toward the keys), quick shallow breaths, a faint tremble. 51.4 the cough: the eyes move
   * first, then the head turns a little toward the camera (screen-left); one blink and the light is back in her eyes — she sees
   * him (eye contact with the lens). A blush, the hall's amber warms the white. 51.85–52.75 she lets the arms go; 52.4 she
   * closes her eyes and breathes in, the shoulders rise. Camera: static -> slow push-in from the cough.
   */
  const C16 = { cough: 51.4 };
  const CAM16 = { th: 0.72, ph: 0.19, x: 820, y: 1570, s: 430 };
  const PAL16 = {   // the black lacquer in the white world: it mirrors the white (no outlines in this world: the ink is soft)
    side: '#17161c', top: '#3a3a44', inner: '#121116', innerWall: '#1b1a20', plate: '#221e1b', strings: 'rgba(150,140,124,0.16)',
    lid: '#121116', lidEdge: '#2b2a32', lidRefl: '#d8dae2', lidReflA: 0.07, lidSheen: '#ffffff', lidSheenA: 0.08,
    refl: '#e9eaf0', reflA: 0.12, streaks: [[3.2, 0.5, 0.1], [6.2, 0.7, 0.08]], edge: '#ffffff', edgeA: 0.8, line: '#0b0a0e',
  };
  // her light: the white world ('stage'); after the cough the hall's amber reaches her (quantised so the colours are reused)
  function light16(k) {
    const q = Math.round(clamp(k) * 8) / 8; if (q <= 0) return 'stage';
    const st = PV.anime.LIGHT.stage;
    return { light: mixH(st.light, '#ffe7cc', q), shadow: mixH(st.shadow, '#c7a4b6', q), amb: 0, rim: mixH(st.rim, '#ffd7a0', q), rimA: lerp(st.rimA, 0.55, q), sat: lerp(st.sat, 1.0, q), dark: lerp(st.dark, 1.03, q) };
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
  // the white void (cold) and the same void after the hall's amber has reached it (warm), cached
  function bg16(warm) {
    return PV.cached('g05:c16bg2:' + (warm ? 'w' : 'c'), W, H, (c) => {
      let g = c.createRadialGradient(W * 0.42, H * 0.38, 120, W * 0.5, H * 0.45, 1300); g.addColorStop(0, '#fbfbf9'); g.addColorStop(0.6, '#f3f3f2'); g.addColorStop(1, '#e4e5e9');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      if (warm) {   // the amber of the hall comes from the audience side (the left, behind the camera)
        g = c.createRadialGradient(-120, 420, 60, -120, 420, 1900); g.addColorStop(0, 'rgba(255,196,128,0.85)'); g.addColorStop(0.45, 'rgba(252,222,186,0.55)'); g.addColorStop(1, 'rgba(246,236,226,0)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      }
    });
  }
  // a veil of white over everything (the world without outlines), screen-blended with a per-frame strength; clear round her face
  function veil16() {
    return PV.cached('g05:c16veil2', W, H, (c) => { const g = c.createRadialGradient(W * 0.44, H * 0.4, 160, W * 0.5, H * 0.45, 1250); g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(0.35, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g; c.fillRect(0, 0, W, H); });
  }
  // the bottom of the case dissolves in the white (the piano floats)
  function fog16(ctx, warm) {
    const col = warm > 0.01 ? mixH('#f6f6f4', '#f6ebde', warm) : '#f6f6f4';
    const g = ctx.createLinearGradient(0, 960, 0, 1100); g.addColorStop(0, PV.rgba(col, 0)); g.addColorStop(1, PV.rgba(col, 0.55));
    ctx.fillStyle = g; ctx.fillRect(-200, 940, W + 400, 300);
  }
  PV.shot('C16', { draw(ctx, t, d, S) {
    if (S) S.post = Object.assign({}, S.post, { bloom: 0.15 });   // bright close-up: keep the thin eye lines crisp
    ensurePose(); bg16(false); bg16(true); veil16();                    // build every cache on the first frame (no hitch mid-cut)
    const tt = clamp(t, -0.3, d + 0.3), T = absT(S, 'C16', tt), tq = tw(T), cough = C16.cough;
    const k = sm(cough, cough + 1.3, T);                                       // the white gives way to the hall's amber
    const cam = gcam(CAM16.th, CAM16.ph, CAM16.x, CAM16.y, CAM16.s);
    // ---- acting (global time; the figure's pose values on twos)
    const eyeK = sm(51.44, 51.58, tq);                                         // the eyes move first ...
    const headK = PV.ease.inOutCubic(sm(51.5, 51.96, tq));                     // ... then the head turns toward him (the lens)
    const bf = Math.floor((T - 51.625) * 24 + 1e-6);                           // one blink: the light comes back behind it
    const blinkO = bf < 0 || bf > 4 ? 1 : [0.55, 0.1, 0.0, 0.35, 0.8][bf];
    const lit = T >= 51.7 ? 1 : 0;
    const rel = sm(51.85, 52.75, tq);                                          // she lets the arms go
    const inh = sm(52.32, 52.86, tq);                                          // 52.4 the breath in: the shoulders rise
    const closeK = sm(52.42, 52.6, tq);                                        // ... with the eyes closed
    const frozen = 1 - sm(cough, cough + 0.5, tq);
    const shallow = frozen * (0.5 + 0.5 * Math.sin(tq * TAU / 0.8));           // quick shallow breaths while frozen
    const lookX = lerp(0.08, -0.42, eyeK) * (1 - closeK), lookY = lerp(0.06, -0.03, eyeK) + 0.35 * closeK;   // the gaze drops as the lids close
    const open = closeK > 0 ? lerp(1.0, 0, closeK) : (lit ? 1.04 : 0.98) * blinkO;
    const head = {
      expr: 'neutral', noBlink: true, neckW: 1.1, turn: -0.035 * headK + 0.04 * inh, roll: frozen * 0.006 * N2(tq * 11.3, 7.7),
      eyes: closeK > 0.5 ? { open: 0, closed: 'down', look: [0.1, 0.3] }
        : { open, look: [lookX, lookY], shine: lit ? 1 : 0.22, dull: lit ? 0 : 0.38, hlK: lit ? 1.12 : 0.78, wide: lit ? 0.12 * (1 - closeK) : 0 },
      brows: { inner: lerp(0.1, 0.34, sm(51.6, 51.9, tq)) - 0.18 * closeK, outer: lerp(-0.04, 0.06, sm(51.6, 51.9, tq)) },
      mouth: { shape: T < 51.62 && T > 51.43 ? 'o' : 'flat', open: frozen * 0.07 + (T > 51.43 && T < 51.62 ? 0.12 : 0) + 0.04 * inh },
      blush: lerp(0.03, 0.34, sm(51.75, 52.5, tq)),
      lightDir: -2.5, shade: 0.03 + 0.025 * k,
    };
    const fig = {
      who: 'g05_senpai', outfit: 'dress', pose: 'g05_piano', facing: cam.th, camPitch: cam.ph, x: cam.x, y: cam.y, scale: cam.s, T,
      light: light16(k), keyDir: -2.45, rimDir: -2.2,
      params: { intensity: 0, play: 0, look: 'keys', rel, trem: frozen * 0.8, lift: 0.08 - 0.05 * rel + 0.012 * shallow + 0.045 * inh,
        neckYaw: -0.08 * headK + 0.07 * inh, neckRoll: -0.02 * headK, neckPitch: lerp(0.02, -0.03, headK) + 0.1 * inh, bendAdd: -0.02 * inh },
      head,
    };
    ctx.save();
    const fc = gp(cam, 0, -2.75, 0.1);
    PV.camera(ctx, { zoom: 1 + 0.075 * PV.ease.inOut(sm(cough, cough + d, T)), cx: fc[0], cy: fc[1] });
    ctx.drawImage(bg16(false), 0, 0);
    if (k > 0.002) { ctx.globalAlpha = k; ctx.drawImage(bg16(true), 0, 0); ctx.globalAlpha = 1; }
    const pal = k > 0.01 ? Object.assign({}, PAL16, { refl: mixH(PAL16.refl, '#ffd9a8', k), lidSheen: mixH('#ffffff', '#ffcf94', k), lidSheenA: PAL16.lidSheenA + 0.06 * k, edge: mixH('#ffffff', '#ffe2b8', k) }) : PAL16;
    pianoBack(ctx, cam, pal);
    PV.anime.figure(ctx, fig);
    pianoFront(ctx, cam, pal);
    pianoLid(ctx, cam, pal);
    fog16(ctx, k);
    ctx.restore();
    motes16(ctx, tt, 1 - 0.6 * k);
    const pulse = Math.pow(0.5 + 0.5 * Math.cos((tt - 0.35) * TAU * 0.72), 6) * (1 - k);   // heartbeat in the tinnitus
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = clamp(0.3 * (1 - 0.55 * k) + 0.12 * pulse); ctx.drawImage(veil16(), 0, 0); ctx.restore();
  } });

  /* ================================================================== C17 〈別れの曲〉
   * 53.0–57.0 (4.0 s). One spotlight; from the same audience side, a little further back and more to her side: she plays,
   * the shoulders moving slowly (原作3406), the face in 3/4 turning toward the profile as she sinks into the music.
   * During the monologue (53.4–56.9, right) the brows knit, the eyes fill; a blink at 55.15 lets ONE tear run down her cheek
   * (no crying face: the strong face of 原作3408). The white left over from C16 fills with the warm light of the hall; dust
   * in the shaft; a slow dolly-in. The right side (the vertical monologue, x ≈ 1480–1760) stays dark and calm: the open
   * lid's underside and the dim hall.
   */
  const CAM17 = { th: 0.98, ph: 0.13, x: 610, y: 1195, s: 290 };
  const PAL17 = {
    side: '#141015', top: '#3a2c22', inner: '#100c0c', innerWall: '#1a1412', plate: '#4a3820', strings: 'rgba(214,170,96,0.28)',
    lid: '#0e0b0d', lidEdge: '#2a201a', lidRefl: '#d6aa60', lidReflA: 0.16, lidSheen: '#ffd59a', lidSheenA: 0.1,
    refl: '#ffd59a', reflA: 0.16, streaks: [[3.0, 0.45, 0.16], [6.0, 0.6, 0.12]], edge: '#ffd59a', edgeA: 0.85, line: '#060406', lidFrontA: 0.3,
  };
  // her light: LIGHT.spot, but the spot is in front of her and above (her face is lit, the rim from above), not behind her
  let SPOT17 = null;
  const spot17 = () => SPOT17 || (SPOT17 = Object.assign({}, PV.anime.LIGHT.spot, { light: '#fff0dc', shadow: '#7a5a6e', amb: 0.06, rimA: 0.7, sat: 1.0, dark: 1.0 }));
  function bg17(warm) {
    return PV.cached('g05:c17bg2:' + (warm ? 'w' : 'c'), W, H, (c) => {
      const wk = warm ? 1 : 0;
      c.drawImage(hallBack('c17'), 0, 0);
      c.save(); c.globalCompositeOperation = 'screen';
      const g = c.createRadialGradient(620, 430, 40, 640, 470, 900); g.addColorStop(0, PV.rgba('#ffd59a', 0.5 * wk + 0.18)); g.addColorStop(0.5, PV.rgba('#c98a4a', 0.22 * wk + 0.05)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
      L.godRays(c, 1.3, { x: 560, y: -160, angle: Math.PI / 2 + 0.05, spread: 0.3, count: 9, length: 1500, width: 150, flare: 3.2, color: '#ffe2b0', alpha: 0.1 + 0.06 * wk, seed: 17, jitter: 260, flicker: 0.4 });
    });
  }
  // ONE tear down her near cheek (design: 「力強い顔のまま頬に一筋だけ」). The library's streaming tears run from both eyes and, near
  // the profile, the far eye's stream is drawn outside the face contour (reported); so the eyes only well up (tears <= 0.5) and
  // this local stroke, built on the head's anchors, runs from the inner corner of the near eye down the cheek.
  function oneTear(ctx, hd, k, T, lightX) {
    if (!hd || !hd.eyeL || !hd.chin || !hd.crown || k <= 0.001) return;
    const s = hd.size, ux = hd.crown[0] - hd.chin[0], uy = hd.crown[1] - hd.chin[1], ul = Math.hypot(ux, uy) || 1;
    let dn = [-ux / ul * 0.45, -uy / ul * 0.45 + 0.55]; const dl = Math.hypot(dn[0], dn[1]) || 1; dn = [dn[0] / dl, dn[1] / dl];   // down the cheek: the face's down + gravity
    const rt = [-dn[1], dn[0]];                                                     // across it (toward screen right)
    const fwd = Math.sign((hd.nose ? hd.nose[0] : hd.eyeL[0] + 1) - hd.eyeL[0]) || 1;  // toward the nose = the inner corner
    const fa = clamp(hd.facing ?? 0.6), E = hd.eyeL, in0 = 0.018 * s * fa;     // toward the inner corner (less in profile)
    const x0 = E[0] + dn[0] * 0.05 * s + rt[0] * fwd * in0, y0 = E[1] + dn[1] * 0.05 * s + rt[1] * fwd * in0;
    const L = lerp(0.2, 0.3, fa) * s * clamp(k), pts = [];                      // to the jaw line (shorter on the narrow profile cheek)
    for (let i = 0; i <= 12; i++) { const u = i / 12, d = L * u, side = -fwd * 0.012 * s * Math.sin(u * Math.PI * 0.85) * clamp(k * 1.4); pts.push([x0 + dn[0] * d + rt[0] * side, y0 + dn[1] * d + rt[1] * side]); }
    const wv = (u) => s * (0.011 + 0.006 * (1 - PV.smooth(0, 0.3, u)) + 0.007 * PV.smooth(0.82, 1, u)) * PV.smooth(0, 0.08, u);
    const A = PV.anime, nx = rt[0] * (lightX >= 0 ? 1 : -1), ny = rt[1] * (lightX >= 0 ? 1 : -1);
    const off = (f) => pts.map((p, i) => { const u = i / 12, w = wv(u) * 0.5 * f; return [p[0] + nx * w, p[1] + ny * w]; });
    A.taper(ctx, pts, wv, 'rgba(255,246,236,0.42)', true);                            // the water film (the skin shows through)
    A.taper(ctx, off(-0.9), (u) => wv(u) * 0.16, 'rgba(120,70,60,0.22)', true);      // faint dark edge away from the light
    A.taper(ctx, off(0.6), (u) => wv(u) * 0.3 * PV.smooth(0.04, 0.14, u), 'rgba(255,255,255,0.95)', true);   // the bright edge
    const end = pts[pts.length - 1], r = 0.0085 * s;                                   // the bead at its tip and a glint
    ctx.fillStyle = 'rgba(255,250,244,0.5)'; ctx.beginPath(); ctx.ellipse(end[0], end[1] + r * 0.4, r, r * 1.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(end[0] - nx * r * 0.35, end[1] - r * 0.1, r * 0.34, 0, Math.PI * 2); ctx.fill();
    const g = pts[Math.floor(pts.length * 0.45)]; ctx.beginPath(); ctx.arc(g[0] + nx * 0.003 * s, g[1], 0.004 * s, 0, Math.PI * 2); ctx.fill();
  }
  PV.shot('C17', { draw(ctx, t, d, S) {
    if (S) S.post = Object.assign({}, S.post, { bloom: 0.22 });
    ensurePose(); bg17(false); bg17(true); veil16();
    const tt = clamp(t, -0.3, d + 0.3), T = absT(S, 'C17', tt), tq = tw(T);
    const warmK = smr(0.0, 3.2, tt);                  // white world -> warm hall light
    const whiteK = 0.62 * (1 - smr(0.0, 2.6, tt));    // leftover of C16's white
    const cam = gcam(CAM17.th, CAM17.ph, CAM17.x, CAM17.y, CAM17.s);
    // ---- acting
    const think = sm(53.6, 55.0, tq);                 // the thought of never seeing him again: brows knit, eyes fill
    const strong = sm(55.75, 56.35, tq);              // 「一転。一呼吸。力強い顔」: the head comes up, the eyes open
    const bf = Math.floor((T - 55.125) * 24 + 1e-6);  // the blink that lets the tear go
    const blinkO = bf < 0 || bf > 4 ? 1 : [0.5, 0.1, 0.0, 0.3, 0.75][bf];
    const tearK = sm(55.21, 55.8, tq);                // ... one tear runs down her cheek (on twos)
    const turnK = sm(54.0, 56.6, tq);                 // 3/4 -> toward the profile as she sinks into the music
    const head = {
      expr: 'focus', noBlink: true, neckW: 1.2,
      eyes: { open: lerp(0.64, 0.92, strong) * blinkO, focus: lerp(0.12, 0.8, strong), sad: 0.25 * think * (1 - strong), tears: 0.5 * sm(53.9, 55.0, tq) * (1 - 0.4 * tearK) * (1 - 0.6 * turnK), look: [lerp(0.0, 0.18, strong), lerp(0.45, 0.08, strong)], hlK: 1.05 },
      brows: { furrow: lerp(0.1, 0.8, think), inner: lerp(0.02, 0.15, think) - 0.42 * strong },
      mouth: { shape: 'flat', open: 0 }, blush: 0.12 + 0.1 * think,
      lightDir: -2.0, shade: 0.05,
    };
    const fig = {
      who: 'g05_senpai', outfit: 'dress', pose: 'g05_piano', facing: cam.th, camPitch: cam.ph, x: cam.x, y: cam.y, scale: cam.s, T,
      light: spot17(), keyDir: -1.95, rimDir: -1.7,
      params: { intensity: lerp(0.38, 0.72, strong), play: 1, look: 'keys', lift: 0.03, neckYaw: lerp(-0.3, 0.28, turnK), neckPitch: lerp(0.06, -0.04, strong) },
      head,
    };
    ctx.save();
    PV.camera(ctx, { zoom: 1.0 + 0.1 * PV.ease.inOut(clamp(tt / d)), cx: 700, cy: 420, x: 4 * Math.sin(tt * 0.5) });
    ctx.drawImage(bg17(false), 0, 0);
    if (warmK > 0.002) { ctx.globalAlpha = warmK; ctx.drawImage(bg17(true), 0, 0); ctx.globalAlpha = 1; }
    pianoBack(ctx, cam, PAL17);
    const F = PV.anime.figure(ctx, fig);
    oneTear(ctx, F && F.head, tearK, T, -1);
    pianoFront(ctx, cam, PAL17);
    pianoLid(ctx, cam, PAL17);
    L.dust(ctx, tt, { seed: 23, count: 70, x0: 300, x1: 1100, y0: 0, y1: 1000, size: 2.6, alpha: 0.55 + 0.25 * warmK, color: '#fff0d0', drift: 40, vx: -3, vy: 6 });
    ctx.restore();
    // the white world receding (screen space)
    if (whiteK > 0.002) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = whiteK; ctx.drawImage(veil16(), 0, 0); ctx.restore(); }
    // keep the monologue column calm
    ctx.save(); const g = ctx.createLinearGradient(1340, 0, 1920, 0); g.addColorStop(0, 'rgba(10,7,5,0)'); g.addColorStop(0.42, PV.rgba('#0a0705', 0.3 + 0.35 * whiteK)); g.addColorStop(1, PV.rgba('#0a0705', 0.42 + 0.3 * whiteK));
    ctx.fillStyle = g; ctx.fillRect(1340, 0, 580, H); ctx.restore();
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
   * 「――おめでとう。」 and the summer photo of C15 (g04's PV.summerPhoto) arrive. 61.6 one tear falls on the screen on his
   * face (62.25 a second on his chest); he blurs and melts into the light. Static, the train's tiny sway.
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
      // (fallback only — g04 publishes the real photo) the two smiling at the lens, anime busts: she stands on his left, so
      // facing the camera she is on the screen-right (design sheet 1-4), white one-piece + straw hat; he in the open blue shirt.
      // Backlit by the sun between their heads, the faces lit by the sea.
      const fig = (who) => {
        const isHim = who === 'him';
        PV.anime.bust(b, { who: isHim ? 'boy' : 'senpai', outfit: isHim ? 'tee' : 'summer', x: isHim ? 790 : 1180, y: 960, size: isHim ? 320 : 300,
          yaw: isHim ? 0.12 : -0.1, roll: isHim ? 0.06 : -0.07, T: 48.5, expr: 'smile', noBlink: true, light: 'summer', rimDir: -1.45, faceLift: 0.35,
          hair: { wind: isHim ? 0.35 : 0.9, windDir: Math.PI } });
      };
      if (layer === 'her' || layer === 'bg') fig('her');
      if (layer === 'him') fig('him');
      // flare across the lens (bg layer only)
      if (layer === 'bg' && L.flare) L.flare(b, 1010, 330, 0.7, '#fff2d0');
      c.drawImage(big.canvas, 240, 180, 1440, 1080, 0, 0, PW, PH);
    });
    const him = make('him');
    return { bg: make('bg'), him, w: PW, h: PH, at: himAt(him) };
  }
  // where he is in the photo (the tears must land on HIM whatever the layout of g04's photo): the box of the 'him' layer's
  // opaque pixels, read once; the first drop on his face, the second on his chest. Falls back to the old layout.
  let HIM_AT = null;
  function himAt(cv) {
    if (HIM_AT) return HIM_AT;
    let at = { u1: 0.655, v1: 0.42, u2: 0.6, v2: 0.66 };
    try {
      const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (d[(y * w + x) * 4 + 3] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 > x0 + 8 && y1 > y0 + 8) {
        // the head: the mean x of the opaque pixels in the top fifth of his box
        const yh = y0 + (y1 - y0) * 0.2; let sx = 0, n = 0;
        for (let y = y0; y < yh; y += 2) for (let x = x0; x <= x1; x += 2) if (d[(y * w + x) * 4 + 3] > 60) { sx += x; n++; }
        const hx = n ? sx / n : (x0 + x1) / 2, bh = y1 - y0;
        at = { u1: clamp(hx / w, 0.08, 0.92), v1: clamp((y0 + bh * 0.24) / h, 0.15, 0.85), u2: clamp((hx - 0.045 * w) / w, 0.08, 0.92), v2: clamp((y0 + bh * 0.5) / h, 0.2, 0.9) };
      }
    } catch (e) { /* tainted or empty: keep the default */ }
    return (HIM_AT = at);
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
    const drops = [{ at: C19.tear, u: P.at.u1, v: P.at.v1 }, { at: C19.tear2, u: P.at.u2, v: P.at.v2 }];
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

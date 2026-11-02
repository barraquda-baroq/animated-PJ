/* g02_encounter — ACT0 出会い〜ACT1 頭: C05 / C06 / C07 / C08
 *   C05 先輩の肩越し。日の当たる床を挟んで、窓間壁の陰に少年。「ねえ……どうして今日は拍手をくれたの」
 *   C06 窓の光を背負う少年。ストローから口を離し「え？　だって、今のはミスなかったじゃん」→カーテンが膨らみ光が肩をなでる
 *   C07 譜面の音符が一斉に剥がれ光になる→温かい白→涙が白鍵に落ちて光る→春の色へほどける
 *   C08 左右分割のセッション（左＝彼女の右手と鍵盤／右＝彼の左手と指板）→継ぎ目が光に溶け、並ぶ二人の一枚絵へ
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

  /* =====================================================================================================
   * C05 — over the shoulder: her blurred head & shoulder (left), the sunlit floor, the boy in the pier shade
   * ===================================================================================================== */
  const C05_CAM = { eye: [7.9, 1.3, 5.6], target: [4.75, 0.72, 1.3], fov: 50 };
  const C05_BOY = [4.9, 0.45, 1.08];        // seat (room metres): in the pier's floor shadow, in front of the pier
  // her head: rendered once, blurred (a big out-of-focus foreground), then only moved (breathing / parallax)
  function c05Girl() {
    return PV.cached('g02:c05girl', 1100, 1400, (c, w, h) => {
      const tmp = PV.makeCanvas(w, h);
      // canvas origin = screen (-360, -60)
      L.hairLong(tmp.ctx, 0.35, { x: 360 + 250, y: 60 + 360, scale: 3.55, view: 'back', bust: true, style: 'silhouette', len: 2.75,
        light: -0.42, rimColor: '#ffe3bc', rim: 1.3, backlight: 0.45, glow: 0.75, tilt: 0.07, fps: 0 });
      c.filter = 'blur(13px)'; c.drawImage(tmp.canvas, 0, 0); c.filter = 'none';
    });
  }
  PV.shot('C05', { draw(ctx, t, d, S) {
    const tt = clamp(t, -0.5, d + 0.5);
    const T = absT(S, 'C05', tt);
    // camera: static, a very slow drift to the right (parallax: foreground travels ~3x the background)
    const drift = smr(-0.2, 4.4, tt);                        // 0..1 over the cut
    const bgX = -26 * drift, fgX = -78 * drift;
    ctx.save();
    PV.camera(ctx, { zoom: 1.035 + 0.006 * drift, x: bgX, cx: 1050, cy: 560 });
    const R = L.musicRoom(ctx, tt, { cam: C05_CAM, time: 'noon', furniture: 'none', wind: 0.35, shaft: 1.25 });
    // the pier's shade around his seat: a soft cool pocket (he sits where the sun does not reach)
    const p0 = R.project(C05_BOY), pH = R.project([C05_BOY[0], C05_BOY[1] + 1.0, C05_BOY[2]]);
    const pxm = p0[1] - pH[1];                               // px per metre at his depth
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    let g = ctx.createRadialGradient(p0[0] + pxm * 0.05, p0[1] - pxm * 0.35, pxm * 0.15, p0[0], p0[1] - pxm * 0.2, pxm * 1.25);
    g.addColorStop(0, 'rgba(150,140,150,0.55)'); g.addColorStop(0.6, 'rgba(190,180,185,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(p0[0] - pxm * 1.6, p0[1] - pxm * 2.2, pxm * 3.2, pxm * 3.2);
    ctx.restore();
    // the boy (in focus): profile facing her (screen left), straw in his mouth, back-lit by the window
    const scale = pxm * 0.224 / 92;
    L.boySeated(ctx, tt, { x: p0[0], y: p0[1], scale, pose: 'juice', flip: true, light: -1.45, rimColor: '#ffe9c8', rim: 1.15, backlight: 0.55, glow: 0.7 });
    ctx.restore();

    // the band of light that crosses between them + dust riding in it
    ctx.save();
    const bx = 610 + bgX * 1.6;
    ctx.globalCompositeOperation = 'screen';
    const bandA = 0.24 + 0.05 * Math.sin(T * 1.3);
    const band = (x0, x1, a) => {
      const gg = ctx.createLinearGradient(x0, 0, x1, 0);
      gg.addColorStop(0, 'rgba(255,236,200,0)'); gg.addColorStop(0.5, `rgba(255,236,200,${a})`); gg.addColorStop(1, 'rgba(255,236,200,0)');
      return gg;
    };
    ctx.save(); ctx.translate(bx, 0); ctx.transform(1, 0, -0.42, 1, 0, 0);   // slanted shaft (top leans right)
    ctx.fillStyle = band(-140, 150, bandA); ctx.fillRect(-140, -50, 290, H + 100);
    ctx.fillStyle = band(-40, 60, bandA * 0.9); ctx.fillRect(-40, -50, 100, H + 100);
    ctx.restore();
    ctx.restore();
    L.dust(ctx, T, { seed: 51, count: 70, x0: bx - 380, x1: bx + 260, y0: 60, y1: 980, size: 2.6, alpha: 0.85, color: '#fff2da', drift: 40, vx: 6, vy: -4,
      mask: (x, y) => clamp(1 - Math.abs((x - bx) + (y - 540) * 0.42) / 210) });
    // a few big soft motes very near the lens (out of focus)
    L.bokeh(ctx, T, { seed: 7, count: 9, x0: 380, x1: 900, y0: 120, y1: 820, rmin: 10, rmax: 26, alpha: 0.22, colors: ['#fff1d6', '#ffe2b8'], wobble: 14 });

    // floor nearest the camera sits in the piano's shadow (also keeps the subtitle legible)
    g = ctx.createLinearGradient(0, H * 0.74, 0, H);
    g.addColorStop(0, 'rgba(40,28,22,0)'); g.addColorStop(1, 'rgba(40,28,22,0.42)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.74, W, H * 0.26);

    // her head & shoulder: huge, out of focus, breathing hard (hair rises and falls), slowly calming
    const calm = sm(0, d, tt);
    const br = Math.sin(TAU * lerp(0.95, 0.7, calm) * tt + 0.6);
    const amp = lerp(7, 3.2, calm);
    ctx.save();
    ctx.translate(250 + fgX, 360 + br * amp); ctx.scale(1 + 0.004 * br, 1 + 0.006 * br); ctx.translate(-250, -360);
    ctx.drawImage(c05Girl(), -360, -60);
    ctx.restore();
    // warm window flare (top right), lens haze
    L.glow(ctx, 1500 + bgX, 170, 700, '#fff3dc', 0.32);
  } });

})();

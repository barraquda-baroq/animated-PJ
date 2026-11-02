/* ============================================================================
 * g10_recording — ACT6「音が戻る」前半：録音 → 告白 → もう一度、再生
 *   C37 夜のテーブル（録音）            144.5–149.0  grade saturate(0.3)
 *   C38 スマホ（弦が切れ、再生が終わる） 149.0–154.0  grade saturate(0.3)
 *   C39 夜の部屋（彼の横顔、頬の光）    154.0–161.0  grade saturate(0.35)
 *   C40 再生ボタン（開花）              161.0–163.5  彩度はシーン内で 0.3→0.7
 * 作画は 2コマ打ち（手・人物の芝居は 12fps）、撮影（光・粒子・カメラ）は 24fps。
 * セル（手・袖・スマホ・人物）は held() のレイアウト空間レイヤーに描き、その絵のキー（12fps / 一部 8fps・静止）が
 * 変わった時だけ描き直す。カメラ・光・粒子は毎フレームその上に重ねる（描画順に依存しない決定論的な出力）。
 * 彼女の袖はニットの袖口が手首を覆う（knitSleeve）：長袖の上から右手首を掴む。
 * ========================================================================== */
(function () {
  'use strict';
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H, TAU = Math.PI * 2;
  const clamp = PV.clamp, lerp = PV.lerp, smooth = PV.smooth, ease = PV.ease;
  const N2 = PV.noise2;
  const q12 = (t) => Math.floor(t * 12 + 1e-6) / 12;              // 作画のタイミング（2コマ打ち）
  const UIF = '"IPAPGothic", "IPAGothic", sans-serif', NUMF = '"Inter", "DejaVu Sans", sans-serif';

  /* ------------------------------------------------------------ 3D camera over the table (cm) */
  // world: X right, Y away from the viewer along the table, Z up.  P(x,y,z) -> screen {x,y,k(px/cm),z(depth)}
  function makeCam(eye, target, f, cx, cy) {
    cx = cx == null ? W / 2 : cx; cy = cy == null ? H / 2 : cy;
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const fw = nrm(sub(target, eye)), rt = nrm(crs(fw, [0, 0, 1])), up = crs(rt, fw);
    const cam = { eye, fw, rt, up, f, cx, cy };
    cam.P = (x, y, z) => {
      const d = [x - eye[0], y - eye[1], (z || 0) - eye[2]]; const zc = Math.max(1e-3, dot(d, fw)); const k = f / zc;
      return { x: cx + dot(d, rt) * k, y: cy - dot(d, up) * k, k, z: zc };
    };
    cam.hit = (sx, sy, zp) => {
      const dx = sx - cx, dy = sy - cy;
      const dir = [fw[0] * f + rt[0] * dx - up[0] * dy, fw[1] * f + rt[1] * dx - up[1] * dy, fw[2] * f + rt[2] * dx - up[2] * dy];
      if (dir[2] > -1e-6) return null; const s = ((zp || 0) - eye[2]) / dir[2];
      return { x: eye[0] + dir[0] * s, y: eye[1] + dir[1] * s, depth: s * f };
    };
    return cam;
  }
  // affine frame on a horizontal plane z at (cx,cy) rotated by ang: local +u = right, +v = toward the viewer side
  // (local units of `unit` cm).  Returns the 6 numbers for ctx.transform.
  function planeFrame(cam, cx, cy, z, ang, unit) {
    const ca = Math.cos(ang), sa = Math.sin(ang), e = 1;
    const P0 = cam.P(cx, cy, z), Pu = cam.P(cx + ca * e, cy + sa * e, z), Pv = cam.P(cx + sa * e, cy - ca * e, z);
    return [(Pu.x - P0.x) * unit, (Pu.y - P0.y) * unit, (Pv.x - P0.x) * unit, (Pv.y - P0.y) * unit, P0.x, P0.y];
  }

  /* ------------------------------------------------------------ layers & cheap blurs */
  // paint at a fraction f of the resolution (for things that will be heavily defocused anyway), then composite
  // up with a blur (px at full resolution)
  function lowResBlur(ctx, key, f, blur, paint) {
    const sw = Math.round(W * f), sh = Math.round(H * f);
    const b = PV.buffer('g10:lr:' + key, sw, sh), c = b.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, sw, sh);
    const m = ctx.getTransform(); c.setTransform(m.a * f, m.b * f, m.c * f, m.d * f, m.e * f, m.f * f);
    paint(c);
    const b2 = PV.buffer('g10:lr2:' + key, sw, sh), c2 = b2.ctx;
    c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, sw, sh); c2.filter = `blur(${(blur * f).toFixed(2)}px)`; c2.drawImage(b.canvas, 0, 0); c2.filter = 'none';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingQuality = 'low'; ctx.drawImage(b2.canvas, 0, 0, sw, sh, 0, 0, W, H); ctx.restore();
  }

  // a soft round light sprite, drawn scaled (much cheaper than a gradient per mote)
  const glowSprite = (col) => PV.cached('g10:spr:' + col, 64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, PV.rgba(col, 1)); g.addColorStop(0.25, PV.rgba(col, 0.45)); g.addColorStop(1, PV.rgba(col, 0)); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
  function spriteGlow(ctx, x, y, r, col, a) { if (a <= 0.003) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); }
  // an out-of-focus highlight (a disc with a soft edge and a slightly brighter rim), drawn scaled with 'screen'
  const bokehSprite = (col) => PV.cached('g10:spr:bokeh:' + col, 96, 96, (c) => {
    const g = c.createRadialGradient(48, 48, 0, 48, 48, 46); g.addColorStop(0, PV.rgba(col, 0.55)); g.addColorStop(0.72, PV.rgba(col, 0.7)); g.addColorStop(0.86, PV.rgba(col, 1)); g.addColorStop(0.94, PV.rgba(col, 0.5)); g.addColorStop(1, PV.rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(48, 48, 46, 0, TAU); c.fill(); });
  function bokehDisc(ctx, x, y, r, col, a) { if (a <= 0.003) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(bokehSprite(col), x - r, y - r, r * 2, r * 2); }
  // a soft shadow: path(c) is filled in ctx's user space at quarter resolution, blurred, laid over ctx
  function softShadow(ctx, key, path, blur, alpha, col) {
    const b = PV.buffer('g10:ssh:' + key, 480, 270), c = b.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 480, 270);
    const m = ctx.getTransform(); c.setTransform(m.a / 4, m.b / 4, m.c / 4, m.d / 4, m.e / 4, m.f / 4);
    c.filter = `blur(${Math.max(0.4, blur / 4).toFixed(2)}px)`; c.fillStyle = col || '#000'; c.beginPath(); path(c); c.fill(); c.filter = 'none';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= alpha; ctx.imageSmoothingQuality = 'medium'; ctx.drawImage(b.canvas, 0, 0, 480, 270, 0, 0, W, H); ctx.restore();
  }
  // a soft ring sprite (light waves), drawn scaled
  const ringSprite = () => PV.cached('g10:spr:ring', 256, 256, (c) => { const g = c.createRadialGradient(128, 128, 96, 128, 128, 128); g.addColorStop(0, 'rgba(255,226,176,0)'); g.addColorStop(0.65, 'rgba(255,226,176,1)'); g.addColorStop(1, 'rgba(255,226,176,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); });

  // soft light gathered at quarter resolution and screened onto the frame in one pass.  paint(c) draws in ctx's
  // user space (the transform is set up for the small buffer).
  function lightPass(ctx, key, paint, alpha, reach) {
    const b = PV.buffer('g10:light:' + key, 480, 270), c = b.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, 480, 270);
    const m = ctx.getTransform(); c.setTransform(m.a / 4, m.b / 4, m.c / 4, m.d / 4, m.e / 4, m.f / 4);
    c.globalCompositeOperation = 'lighter'; paint(c, 0.25 * Math.hypot(m.a, m.b)); c.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; if (alpha != null) ctx.globalAlpha = alpha;
    ctx.imageSmoothingQuality = 'low';
    // reach = {x, y, r} in ctx user space: only that disc's bounding box is composited (the rest of the buffer is empty)
    if (reach) {
      const k = Math.hypot(m.a, m.b), cx = m.a * reach.x + m.c * reach.y + m.e, cy = m.b * reach.x + m.d * reach.y + m.f, r = reach.r * k;
      const x0 = Math.max(0, Math.floor((cx - r) / 4)), y0 = Math.max(0, Math.floor((cy - r) / 4)), x1 = Math.min(480, Math.ceil((cx + r) / 4)), y1 = Math.min(270, Math.ceil((cy + r) / 4));
      if (x1 > x0 && y1 > y0) ctx.drawImage(b.canvas, x0, y0, x1 - x0, y1 - y0, x0 * 4, y0 * 4, (x1 - x0) * 4, (y1 - y0) * 4);
    } else ctx.drawImage(b.canvas, 0, 0, 480, 270, 0, 0, W, H);
    ctx.restore();
  }

  // A full-frame layer painted in layout space (identity transform) and repainted only when its key changes: the
  // cels (hands, phone, figures) are drawn on twos (12 fps, key = the drawing's time) while the camera, the light and
  // the particles run at 24 fps over them.  The key must capture everything the paint depends on (deterministic).
  const HELD = {}, HELDBOX = {};
  function held(name, key, paint) {
    const b = PV.buffer('g10:held:' + name), c = b.ctx;
    if (HELD[name] !== key) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
      const ob = HELDBOX[name]; if (ob) c.clearRect(ob.x, ob.y, ob.w, ob.h); else c.clearRect(0, 0, W, H);
      const bx = paint(c); c.setTransform(1, 0, 0, 1, 0, 0); HELD[name] = key; HELDBOX[name] = bx && bx.w ? bx : null;
    }
    return { canvas: b.canvas, box: HELDBOX[name] };
  }
  // lay a held sub-layer into ctx (identity), only its painted box when known
  function layHeld(ctx, h) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (h.box) ctx.drawImage(h.canvas, h.box.x, h.box.y, h.box.w, h.box.h, h.box.x, h.box.y, h.box.w, h.box.h); else ctx.drawImage(h.canvas, 0, 0);
    ctx.restore();
  }
  // a colour with its saturation scaled toward its luminance (for light drawn over an already desaturated cel)
  const desat = (hex, s) => { const [r, g, b] = PV.hex2rgb(hex), y = 0.299 * r + 0.587 * g + 0.114 * b, f = (v) => Math.round(clamp(y + (v - y) * s, 0, 255)).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); };
  // scale the saturation of a region of a layer (in place) toward grey by (1 - s)
  function satRegion(c, s, box) { if (s >= 0.999) return; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'saturation'; c.globalAlpha = 1 - s; c.fillStyle = '#808080'; if (box) c.fillRect(box.x, box.y, box.w, box.h); else c.fillRect(0, 0, W, H); c.restore(); }
  const growBox = (b, p) => b ? { x: Math.max(0, b.x - p), y: Math.max(0, b.y - p), w: Math.min(W, b.x + b.w + p) - Math.max(0, b.x - p), h: Math.min(H, b.y + b.h + p) - Math.max(0, b.y - p) } : null;

  /* ------------------------------------------------------------ the table (per-pixel, cached per cut) */
  // walnut planks under a small desk lamp: lambert falloff in a shade cone, glossy varnish highlight,
  // the room beyond the far edge, and depth-of-field baked in (blur grows with distance from focus).
  function tableImage(key, cam, o) {
    const ext = o.extTop || 0, exl = o.extLeft || 0;   // extra margin above / left of the frame (for pans and tilts)
    return PV.cached(key, W + exl, H + ext, (out) => {
      const q = 0.5, w = Math.round((W + exl) * q), h = Math.round((H + ext) * q);
      const A = PV.makeCanvas(w, h), img = A.ctx.createImageData(w, h), D = img.data, depth = new Float32Array(w * h);
      const lin = (hex) => PV.hex2rgb(hex).map(v => Math.pow(v / 255, 2.2));
      const Lp = o.lamp, lampC = lin(o.lampColor || '#ffd8a0'), amb = lin(o.ambient || '#1c2030').map(v => v * (o.ambAmt == null ? 0.25 : o.ambAmt));
      const room = lin(o.room || '#100d0c');
      const dark = [0.022, 0.0125, 0.0075], mid = [0.06, 0.033, 0.019], lite = [0.12, 0.068, 0.038];
      const E = cam.eye, expo = o.exposure || 1.6, far = o.farEdge || 1e9, halfW = o.halfW || 1e9, ga = o.grain == null ? 1 : o.grain;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const sx = (px + 0.5) / q - exl, sy = (py + 0.5) / q - ext, i4 = (py * w + px) * 4;
          const hit = cam.hit(sx, sy, 0);
          let r, g, b;
          if (hit && hit.y < far && Math.abs(hit.x) < halfW) {
            const X = hit.x, Y = hit.y;
            depth[py * w + px] = hit.depth;
            // planks along Y (12.5cm): soft figure + long fine grain, each plank a slightly different tone
            const pl = Math.floor((X + 600) / 12.5), pu = ((X + 600) / 12.5) - pl;
            const fig = PV.fbm2(X * 0.07 + pl * 7.3, Y * 0.01 + pl * 3.1, 3);
            const streak = PV.noise2(X * 0.8 + pl * 13.7 + fig * 1.6, Y * 0.03 + pl * 1.7) * 0.6 + PV.noise2(X * 2.6 + pl * 5.1, Y * 0.08) * 0.4;
            const k = clamp(0.5 + ga * (0.16 * streak + 0.2 * fig) + 0.12 * (PV.rand1(pl, 3) - 0.5), 0, 1);
            const alb = k < 0.5 ? [lerp(dark[0], mid[0], k * 2), lerp(dark[1], mid[1], k * 2), lerp(dark[2], mid[2], k * 2)] : [lerp(mid[0], lite[0], k * 2 - 1), lerp(mid[1], lite[1], k * 2 - 1), lerp(mid[2], lite[2], k * 2 - 1)];
            const seam = Math.min(pu, 1 - pu) < 0.01 ? 0.45 : 1;
            // the lamp: inverse-square falloff inside the shade's cone
            const dx = Lp[0] - X, dy = Lp[1] - Y, dz = Lp[2], rr = Math.sqrt(dx * dx + dy * dy + dz * dz), cosN = dz / rr;
            const cone = smooth(o.coneOut || 0.3, o.coneIn || 0.8, cosN);
            const Ein = (o.power || 4000) * cosN * cone / (rr * rr);
            // varnish: a soft reflection of the lamp toward the eye
            const vx = E[0] - X, vy = E[1] - Y, vz = E[2], vl = Math.sqrt(vx * vx + vy * vy + vz * vz);
            const hx = dx / rr + vx / vl, hy = dy / rr + vy / vl, hz = dz / rr + vz / vl, hl = Math.sqrt(hx * hx + hy * hy + hz * hz);
            const nh = hz / hl, spec = (o.spec == null ? 0.1 : o.spec) * (Math.pow(nh, 60) + 0.12 * Math.pow(nh, 10)) * (0.4 + 0.6 * cone) * (0.9 + 0.25 * streak);
            r = alb[0] * seam * (lampC[0] * Ein + amb[0]) + spec * lampC[0];
            g = alb[1] * seam * (lampC[1] * Ein + amb[1]) + spec * lampC[1];
            b = alb[2] * seam * (lampC[2] * Ein + amb[2]) + spec * lampC[2];
            if (far - Y < 0.5) { const e = 0.05 * Ein + 0.004; r += e * lampC[0]; g += e * lampC[1]; b += e * lampC[2]; }
          } else {
            depth[py * w + px] = 400;
            const gl = o.roomGlow ? o.roomGlow(sx, sy) : 0;
            r = room[0] + gl * lampC[0]; g = room[1] + gl * lampC[1]; b = room[2] + gl * lampC[2];
          }
          r = 1 - Math.exp(-r * expo); g = 1 - Math.exp(-g * expo); b = 1 - Math.exp(-b * expo);
          D[i4] = 255 * Math.pow(r, 1 / 2.2); D[i4 + 1] = 255 * Math.pow(g, 1 / 2.2); D[i4 + 2] = 255 * Math.pow(b, 1 / 2.2); D[i4 + 3] = 255;
        }
      }
      A.ctx.putImageData(img, 0, 0);
      // depth of field: blend toward a blurred copy by |depth - focus|
      const Bc = PV.makeCanvas(w, h); Bc.ctx.filter = `blur(${o.dofBlur || 5}px)`; Bc.ctx.drawImage(A.canvas, 0, 0); Bc.ctx.filter = 'none';
      const bd = Bc.ctx.getImageData(0, 0, w, h).data, sd = A.ctx.getImageData(0, 0, w, h);
      const fz = o.focus || 60, rng = o.dofRange || 40;
      for (let i = 0; i < w * h; i++) {
        const m = clamp((Math.abs(depth[i] - fz) - (o.dofNear || 4)) / rng, 0, 1);
        for (let k = 0; k < 3; k++) sd.data[i * 4 + k] = lerp(sd.data[i * 4 + k], bd[i * 4 + k], m);
      }
      A.ctx.putImageData(sd, 0, 0);
      out.imageSmoothingQuality = 'high'; out.drawImage(A.canvas, 0, 0, W + exl, H + ext);
    });
  }
  // darkness map (alpha = 1 - light) at quarter resolution, in ctx's current user space; lights are holes:
  // [{x,y,rx,ry,a,core,rot}].  Laid 'source-atop' over a layer of hands so they fall off with the lamp light.
  function darkMap(ctx, key, base, col, lights) {
    const b = PV.buffer('g10:darkq:' + key, 480, 270), c = b.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 480, 270);
    c.fillStyle = PV.rgba(col, base); c.fillRect(0, 0, 480, 270);
    const m = ctx.getTransform(); c.setTransform(m.a / 4, m.b / 4, m.c / 4, m.d / 4, m.e / 4, m.f / 4);
    c.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      c.save(); c.translate(l.x, l.y); if (l.rot) c.rotate(l.rot); c.scale(1, l.ry / l.rx);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, l.rx);
      g.addColorStop(0, `rgba(0,0,0,${l.a})`); g.addColorStop(l.core || 0.35, `rgba(0,0,0,${l.a * 0.72})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(-l.rx, -l.rx, l.rx * 2, l.rx * 2); c.restore();
    }
    c.globalCompositeOperation = 'source-over'; c.setTransform(1, 0, 0, 1, 0, 0);
    return b.canvas;
  }
  // union of the device-space bounding boxes of rendered rigs (rig.items exist after handRender) and extra boxes
  function rigsBox(rigs, pad, extra) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const r of rigs) if (r && r.items) for (const it of r.items) { x0 = Math.min(x0, it.bb[0]); y0 = Math.min(y0, it.bb[1]); x1 = Math.max(x1, it.bb[2]); y1 = Math.max(y1, it.bb[3]); }
    if (extra) for (const e of extra) if (e) { x0 = Math.min(x0, e[0]); y0 = Math.min(y0, e[1]); x1 = Math.max(x1, e[2]); y1 = Math.max(y1, e[3]); }
    pad = pad || 24; x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(W, Math.ceil(x1 + pad)); y1 = Math.min(H, Math.ceil(y1 + pad));
    return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }
  // hands (and their knit sleeves) drawn together into one layer, darkened by the light map, composited (all
  // bbox-limited).  entries: rig | [rig, ro] | {rigs:[..], ro} | {rig, ro, sleeve, detail, blur}.  An entry with a
  // sleeve is drawn body → hand → detail → cuff lip ("into" view) or hand → sleeve over the wrist; an entry with
  // blur (px) is painted on its own and laid in defocused.  o.blur defocuses the whole layer.
  const LASTBOX = {};   // the region each scratch buffer last used (cleared instead of the whole frame)
  function clearUsed(c, name) { const lb = LASTBOX[name]; if (lb) c.clearRect(lb.x - 2, lb.y - 2, lb.w + 4, lb.h + 4); else c.clearRect(0, 0, W, H); }
  function handsLayer(ctx, key, entries, dark, o) {
    o = o || {};
    const b = PV.buffer('g10:hands:' + key), c = b.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); clearUsed(c, 'hands:' + key);
    const flat = [], extra = [];
    for (const e of entries) {
      if (!e) continue;
      if (e.rigs) { const rr = e.rigs.filter(Boolean); if (rr.length) { L.handRender(c, rr, e.ro || o.ro); flat.push(...rr); } }   // several rigs, one pass
      else if (Array.isArray(e)) { if (e[0]) { L.handRender(c, [e[0]], e[1] || o.ro); flat.push(e[0]); } }
      else if ('rig' in e) {
        if (!e.rig) continue;
        const sl = e.sleeve, blur = e.blur || 0;
        let tc = c, T = null;
        if (blur > 0.3) { T = PV.buffer('g10:hands:tmp'); tc = T.ctx; tc.setTransform(1, 0, 0, 1, 0, 0); clearUsed(tc, 'hands:tmp'); }
        if (sl && sl.into) sl.body(tc);
        L.handRender(tc, [e.rig], e.ro || o.ro);
        if (e.detail) e.detail(tc);
        if (sl) { if (sl.into) sl.lip(tc); else { sl.body(tc); sl.lip(tc); } }
        flat.push(e.rig); if (sl) extra.push(sl.box);
        if (T) {   // defocused: blurred at half resolution inside its box
          const bx = rigsBox([e.rig], 20 + blur * 3, sl ? [sl.box] : null); LASTBOX['hands:tmp'] = bx;
          if (bx) {
            const sw = Math.ceil(bx.w / 2), sh = Math.ceil(bx.h / 2), B2 = PV.buffer('g10:hands:half', W / 2 + 2, H / 2 + 2), c2 = B2.ctx;
            c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, sw + 2, sh + 2); c2.filter = `blur(${(blur / 2).toFixed(2)}px)`; c2.drawImage(T.canvas, bx.x, bx.y, bx.w, bx.h, 0, 0, sw, sh); c2.filter = 'none';
            c.save(); c.imageSmoothingQuality = 'medium'; c.drawImage(B2.canvas, 0, 0, sw, sh, bx.x, bx.y, bx.w, bx.h); c.restore();
          }
        }
      }
      else { L.handRender(c, [e], o.ro); flat.push(e); }
    }
    const box = rigsBox(flat, 30, extra); LASTBOX['hands:' + key] = box; if (!box) return null;
    if (dark) { c.save(); c.globalCompositeOperation = 'source-atop'; c.drawImage(dark, box.x / 4, box.y / 4, box.w / 4, box.h / 4, box.x, box.y, box.w, box.h); c.restore(); }
    if (o.blur > 0.3) {    // the whole layer out of focus: blur it at reduced resolution inside its box
      const f = o.blur < 4 ? 0.5 : 0.25, sw = Math.ceil(box.w * f), sh = Math.ceil(box.h * f);
      const B2 = PV.buffer('g10:hands:blur', Math.ceil(W * 0.5) + 2, Math.ceil(H * 0.5) + 2), c2 = B2.ctx;
      c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, sw + 2, sh + 2); c2.filter = `blur(${(o.blur * f).toFixed(2)}px)`; c2.drawImage(b.canvas, box.x, box.y, box.w, box.h, 0, 0, sw, sh); c2.filter = 'none';
      c.clearRect(box.x, box.y, box.w, box.h); c.save(); c.imageSmoothingQuality = 'medium'; c.drawImage(B2.canvas, 0, 0, sw, sh, box.x, box.y, box.w, box.h); c.restore();
    }
    return { canvas: b.canvas, box };
  }
  function blitBox(ctx, L0, alpha) {
    if (!L0) return; const { canvas, box } = L0;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.drawImage(canvas, box.x, box.y, box.w, box.h, box.x, box.y, box.w, box.h); ctx.restore();
  }
  // soft table shadows from rig geometry (palm hull + finger capsules + forearm), at quarter resolution and
  // limited to their bounding box.  casts: [{rig, dx, dy, blur, alpha}] (device px)
  function rigShadows(ctx, casts, lo) {
    // lo: very soft shadows are gathered at 1/8 resolution instead of 1/4
    const q = lo ? 8 : 4, BW = W / q, BH = H / q;
    const S = PV.buffer('g10:shq' + q, BW, BH), sc = S.ctx, T = PV.buffer('g10:shq2' + q, BW, BH), tc = T.ctx;
    let X0 = 1e9, Y0 = 1e9, X1 = -1e9, Y1 = -1e9;
    const boxes = [];
    for (const cs of casts) {
      const r = cs && cs.rig; if (!r) { boxes.push(null); continue; }
      const e = r.P({ x: 0, y: (cs.arm || r.o.arm || 320), z: 0 }), pts = [r.wrist, e].concat(...r.joints);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
      const pad = 40 * r.unit + cs.blur * 3;
      const bx = { x0: clamp(x0 - pad + cs.dx, 0, W), y0: clamp(y0 - pad + cs.dy, 0, H), x1: clamp(x1 + pad + cs.dx, 0, W), y1: clamp(y1 + pad + cs.dy, 0, H), e };
      boxes.push(bx); X0 = Math.min(X0, bx.x0); Y0 = Math.min(Y0, bx.y0); X1 = Math.max(X1, bx.x1); Y1 = Math.max(Y1, bx.y1);
    }
    if (X1 <= X0 || Y1 <= Y0) return;
    const qx = Math.floor(X0 / q), qy = Math.floor(Y0 / q), qw = Math.min(BW, Math.ceil(X1 / q) + 1) - qx, qh = Math.min(BH, Math.ceil(Y1 / q) + 1) - qy;
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, BW, BH);    // whole buffer: the upscale samples past the box edge
    casts.forEach((cs, k) => {
      const r = cs && cs.rig, bx = boxes[k]; if (!r || !bx) return;
      const cx = Math.floor(bx.x0 / q), cy = Math.floor(bx.y0 / q), cw = Math.ceil(bx.x1 / q) + 1 - cx, ch = Math.ceil(bx.y1 / q) + 1 - cy;
      tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(cx - 1, cy - 1, cw + 2, ch + 2);
      tc.setTransform(1 / q, 0, 0, 1 / q, cs.dx / q, cs.dy / q);
      tc.fillStyle = '#000'; tc.strokeStyle = '#000'; tc.lineCap = 'round'; tc.lineJoin = 'round';
      const u = r.unit, J = r.joints;
      tc.beginPath(); const pp = [r.wrist, J[0][1], J[1][0], J[2][0], J[3][0], J[4][0]];
      tc.moveTo(pp[0].x, pp[0].y); for (const p of pp) tc.lineTo(p.x, p.y); tc.closePath(); tc.fill();
      tc.lineWidth = 34 * u; tc.stroke();
      for (let i = 0; i < 5; i++) { const chn = r.chains[i]; tc.lineWidth = 2 * chn.rad[1] * u; tc.beginPath(); tc.moveTo(J[i][0].x, J[i][0].y); for (let j = 1; j < 4; j++) tc.lineTo(J[i][j].x, J[i][j].y); tc.stroke(); }
      tc.lineWidth = 46 * u; tc.beginPath(); tc.moveTo(r.wrist.x, r.wrist.y); tc.lineTo(bx.e.x, bx.e.y); tc.stroke();
      sc.save(); sc.beginPath(); sc.rect(qx, qy, qw, qh); sc.clip();
      sc.globalAlpha = cs.alpha; sc.filter = `blur(${Math.max(0.4, cs.blur / q).toFixed(2)}px)`;
      sc.drawImage(T.canvas, cx, cy, cw, ch, cx, cy, cw, ch); sc.restore();
    });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(S.canvas, qx, qy, qw, qh, qx * q, qy * q, qw * q, qh * q); ctx.restore();
  }

  /* ------------------------------------------------------------ the festival recording on the phone */
  const REC_LEN = 292;                      // 4:52 — the whole set, recorded from the audience
  const fmt = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  // amplitude (0..1) of the recording at second s: the D-major blast, the band, the flat keyboard trading
  // solos, the string snapping (LEN-0.96), boos, end.
  function recAmp(s) {
    if (s < 0 || s > REC_LEN) return 0;
    const n = 0.5 + 0.5 * N2(s * 6.1, 1.7), n2 = 0.5 + 0.5 * N2(s * 23.0, 4.2);
    const beat = Math.pow(Math.max(0, Math.cos(s * 1.6 * TAU)), 5);           // ♩=96
    let a;
    if (s < 0.04) a = s / 0.04;
    else if (s < 3.1) a = 0.42 + 0.55 * Math.exp(-s * 0.9) + 0.16 * beat + 0.08 * n;
    else if (s < REC_LEN - 1.25) a = 0.3 + 0.24 * n + 0.17 * beat + 0.05 * Math.sin(s * 0.7);
    else if (s < REC_LEN - 0.98) a = 0.36 + 0.2 * n2;
    else if (s < REC_LEN - 0.9) return 1.0;                                        // the string snaps
    else a = (0.16 + 0.34 * n2 * n) * (1 - smooth(REC_LEN - 0.3, REC_LEN, s));    // boos, ragged, the end
    return clamp(a * (0.82 + 0.3 * n2), 0, 0.92);
  }
  // the voice-memo player (screen-local px: w 272 x h 524). st: pos, playing, tap (s since tap|null),
  // ended, bloom (0..1 C40: the muffled sound opening up), light (0..1 extra screen brightness)
  function recorder(c, w, h, st, t) {
    const bloom = st.bloom || 0;
    const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#161c29'); bg.addColorStop(0.55, '#10141e'); bg.addColorStop(1, '#0b0e15');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.textBaseline = 'alphabetic';
    // status bar
    c.fillStyle = 'rgba(235,240,250,0.9)'; c.font = `600 13px ${NUMF}`; c.textAlign = 'left'; c.fillText(st.clock || '23:41', 16, 20);
    c.strokeStyle = c.fillStyle; c.lineWidth = 1.2; c.strokeRect(w - 38, 10, 20, 10); c.fillRect(w - 36, 12, 9, 6); c.fillRect(w - 16.5, 13, 2, 4);
    // header
    c.fillStyle = '#7d8ba6'; c.font = `500 13px ${UIF}`; c.fillText('‹ ボイスメモ', 12, 50);
    c.textAlign = 'right'; c.fillText('編集', w - 14, 50);
    // title
    c.textAlign = 'left'; c.fillStyle = '#f3f5f9'; c.font = `700 27px ${UIF}`; c.fillText('文化祭ライブ', 16, 98);
    c.fillStyle = '#8590a4'; c.font = `500 12px ${UIF}`; c.fillText('10月26日　体育館', 17, 121);
    c.fillStyle = '#8590a4'; c.font = `500 12px ${NUMF}`; c.textAlign = 'right'; c.fillText(fmt(REC_LEN), w - 16, 121);
    // waveform
    const wy = 222, wh = 64, pps = 70, gap = 4.6, bw = 2.5;
    c.save(); c.beginPath(); c.rect(0, 146, w, 160); c.clip();
    c.strokeStyle = 'rgba(120,135,160,0.22)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, wy); c.lineTo(w, wy); c.stroke();
    const pos = st.pos, x0 = w / 2;
    const i0 = Math.floor((pos - (x0 + 10) / pps) / (gap / pps)), i1 = Math.ceil((pos + (w - x0 + 10) / pps) / (gap / pps));
    for (let i = i0; i <= i1; i++) {
      const ts = i * gap / pps; if (ts < 0 || ts > REC_LEN) continue;
      const x = x0 + (ts - pos) * pps; if (x < -4 || x > w + 4) continue;
      let a = recAmp(ts) * (0.75 + 0.25 * PV.rand1(i, 7));
      if (bloom > 0) a = lerp(Math.pow(a, 1.5) * 0.55, a * 1.12, bloom);     // C40: the muffled sound opens up
      const snap = a >= 0.99;
      const bh = Math.max(1.5, a * wh * (snap ? 1.18 : 1));
      const played = ts <= pos;
      if (bloom > 0 && played) c.fillStyle = PV.mix('#cfd9ea', '#ffd79a', clamp(bloom * 1.2));
      else c.fillStyle = played ? (snap ? '#ffffff' : '#d6deeb') : 'rgba(110,122,146,0.55)';
      c.fillRect(x - bw / 2, wy - bh, bw, bh * 2);
      if (snap && played) { c.fillStyle = 'rgba(255,190,160,0.35)'; c.fillRect(x - bw * 1.8, wy - bh - 4, bw * 3.6, bh * 2 + 8); }
    }
    if (st.ended) { c.fillStyle = 'rgba(110,122,146,0.35)'; for (let x = x0 + 6; x < w; x += 6) c.fillRect(x, wy - 0.75, 3, 1.5); }
    c.restore();
    // playhead
    c.fillStyle = '#ff7a52'; c.fillRect(x0 - 1, 150, 2, 150);
    c.beginPath(); c.arc(x0, 150, 4, 0, TAU); c.fill(); c.beginPath(); c.arc(x0, 300, 4, 0, TAU); c.fill();
    // big time
    c.textAlign = 'center'; c.fillStyle = '#f3f5f9'; c.font = `300 40px ${NUMF}`;
    const ps = Math.max(0, pos); c.fillText(fmt(ps) + '.' + String(Math.floor((ps % 1) * 100)).padStart(2, '0'), w / 2, 352);
    // progress
    const by = 386, prog = clamp(ps / REC_LEN);
    c.fillStyle = 'rgba(200,210,228,0.22)'; c.fillRect(18, by, w - 36, 3);
    c.fillStyle = '#e6ebf3'; c.fillRect(18, by, (w - 36) * prog, 3); c.beginPath(); c.arc(18 + (w - 36) * prog, by + 1.5, 5.5, 0, TAU); c.fill();
    c.fillStyle = '#8590a4'; c.font = `500 11px ${NUMF}`; c.textAlign = 'left'; c.fillText(fmt(ps), 18, by + 20); c.textAlign = 'right'; c.fillText('-' + fmt(REC_LEN - ps), w - 18, by + 20);
    // controls: ↺15  ▶/‖  ↻15
    const cy = 466, cx = w / 2;
    c.strokeStyle = '#c9d2e2'; c.lineWidth = 2;
    for (const sg of [-1, 1]) {
      const x = cx + sg * 82; c.beginPath(); c.arc(x, cy, 15, sg < 0 ? -0.9 : Math.PI + 0.9, sg < 0 ? Math.PI * 1.55 : -Math.PI * 0.55 + Math.PI * 2, sg > 0); c.stroke();
      c.fillStyle = '#c9d2e2'; c.font = `600 10px ${NUMF}`; c.textAlign = 'center'; c.fillText('15', x, cy + 4);
    }
    const tap = st.tap;
    const pr = tap != null && tap >= 0 && tap < 0.18 ? 1 - 0.08 * Math.sin(Math.PI * tap / 0.18) : 1;   // the button dips
    c.fillStyle = '#f4f6fa'; c.beginPath(); c.arc(cx, cy, 31 * pr, 0, TAU); c.fill();
    c.fillStyle = '#121725';
    if (st.playing && !st.ended) { c.fillRect(cx - 9, cy - 11, 6, 22); c.fillRect(cx + 3, cy - 11, 6, 22); }
    else { c.beginPath(); c.moveTo(cx - 8, cy - 13); c.lineTo(cx + 13, cy); c.lineTo(cx - 8, cy + 13); c.closePath(); c.fill(); }
    // tap ripple
    if (tap != null && tap >= 0 && tap < 0.7) {
      const k = tap / 0.7;
      c.strokeStyle = `rgba(230,238,255,${0.55 * (1 - k)})`; c.lineWidth = 2.5 * (1 - k) + 0.5;
      c.beginPath(); c.arc(cx, cy, 31 + 40 * ease.outCubic(k), 0, TAU); c.stroke();
    }
    // home indicator
    c.fillStyle = 'rgba(230,235,245,0.55)'; c.beginPath(); c.roundRect(w / 2 - 52, h - 12, 104, 4, 2); c.fill();
    if (st.light) { c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = `rgba(255,236,200,${0.25 * st.light})`; c.fillRect(0, 0, w, h); c.restore(); }
  }
  // phone-screen local -> phone local (natural 300x620 units, origin = centre)
  const SCR = { x: -136, y: -260, w: 272, h: 524 };
  const PLAY = { u: 0, v: SCR.y + 466 };       // play-button centre in phone units
  const PH_UNIT = 7.2 / 300;                     // cm per phone unit

  // the recorder UI painted flat (axis aligned) at res px per phone unit, to be laid onto the phone as one image
  function recorderUI(key, st, t, res) {
    const w = Math.ceil(272 * res), h = Math.ceil(524 * res), b = PV.buffer('g10:ui:' + key, w, h), c = b.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h); c.setTransform(res, 0, 0, res, 0, 0); recorder(c, 272, 524, st, t); c.setTransform(1, 0, 0, 1, 0, 0);
    return b.canvas;
  }
  function drawPhone(ctx, t, frameM, st, o) {
    ctx.save(); ctx.transform(...frameM);
    const ui = o && o.uiRes ? recorderUI(o.uiKey || 'p', st, t, o.uiRes) : null;
    L.phone(ctx, t, Object.assign({ x: 0, y: 0, s: 1, screen: 'photo', ui: false, drawPhoto: ui ? (c, w, h) => { c.imageSmoothingQuality = 'medium'; c.drawImage(ui, 0, 0, w, h); } : (c, w, h) => recorder(c, w, h, st, t), shadow: false,
      tone: { amb: '#d9b48a', k: 0.42, sat: 0.85, hi: '#fff0d8', sh: '#14110f', rim: '#f0c690', rimA: 0.45 }, light: -2.3, res: 1.4 }, o || {}));
    ctx.restore();
  }

  /* ------------------------------------------------------------ hands helpers */
  const MAT_ID = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  // rig whose picked point (fn(rig) -> {x,y}) lands at user-space target
  function rigAt(ctx, o, target, pick) {
    const probe = L.handRig(Object.assign({}, o, { x: 0, y: 0, _m: MAT_ID }));
    const q = pick(probe);
    return L.handRig(Object.assign({}, o, { x: target.x - q.x, y: target.y - q.y, _m: L._handMatOf(ctx) }));
  }
  const padOf = (i) => (r) => L._handPadPoint(r, i);
  const wristOf = (r) => r.wrist;
  // lamp-lit skin
  const NIGHT_SKIN = { keyColor: '#ffd6a6', fillColor: '#4a4060', tint: 0.62 };
  // her soft knit cardigan (warm taupe, as in the silent days) and his dark sweatshirt
  const KNIT = { base: '#867666', shade: '#5f5247', hi: '#a5917b', line: '#382d26', bounce: '#6e5f52' };
  const SWEAT = { base: '#3a3431', shade: '#25211f', hi: '#5a514b', line: '#151210', bounce: '#2e2926' };

  /* ------------------------------------------------------------ knit sleeves (drawn here, not by the hand rig) */
  // A sleeve over a rig's forearm: cylindrical cel shading toward the light, a snug ribbed cuff whose edge is at y0
  // (rig-local units from the wrist; 0 covers the wrist bone), the body puffing out above it, soft folds.  When the
  // forearm runs away from the camera ("into": her arms across the table) the body goes BEHIND the hand and the front
  // half of the cuff (lip) over the wrist going in; otherwise the sleeve covers the wrist.  Build the rig with a short
  // bare arm (arm ≈ y0 + cuff/2) so the forearm ends inside the cuff.
  const V3 = (x, y, z) => ({ x, y, z });
  function hull2(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  function smoothPath(c, pts) { const n = pts.length; const mx = i => (pts[i % n][0] + pts[(i + 1) % n][0]) / 2, my = i => (pts[i % n][1] + pts[(i + 1) % n][1]) / 2; c.moveTo(mx(n - 1), my(n - 1)); for (let i = 0; i < n; i++) c.quadraticCurveTo(pts[i][0], pts[i][1], mx(i), my(i)); c.closePath(); }
  function knitSleeve(rig, o) {
    const P = rig.P, N = rig.N, kw = rig.m.kw, u = rig.unit, col = o.col || KNIT, seed = o.seed || 0;
    const y0 = o.y0, y1 = o.y1, cl = o.cuff || 24, fl = o.flare || 1.16, rib = o.rib == null ? 1 : o.rib;
    const rxC = (o.rx || 25) * kw, rzC = (o.rz || 18) * kw, pf = o.puff || 1.26, rxB = rxC * pf, rzB = rzC * pf;
    const ring = (y, rx, rz, n, wob, sd) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, ca = Math.cos(a), sa = Math.sin(a); const w = 1 + (wob || 0) * N2(ca * 1.3 + sd, sa * 1.3 + y * 0.03); const q = P(V3(ca * rx * w, y, sa * rz * w - 3)); q.f = N(V3(ca, 0, sa)).z; pts.push(q); } return pts; };
    const into = N(V3(0, 1, 0)).z < -0.05;
    const bodyPts = [];
    for (let k = 0; k <= 5; k++) { const v = k / 5, y = lerp(y0 + cl * 0.72, y1, v), sc = lerp(1, fl, v) * (k === 0 ? 0.93 : 1); bodyPts.push(...ring(y, rxB * sc, rzB * sc, 30, k === 0 ? 0.02 : 0.05, seed + k * 1.7)); }
    const bodyHull = hull2(bodyPts.map(q => [q.x, q.y]));
    const cuffA = ring(y0, rxC, rzC, 36, 0.012, seed), cuffB = ring(y0 + cl, rxC * 1.03, rzC * 1.03, 36, 0.012, seed);
    const cuffHull = hull2(cuffA.concat(cuffB).map(q => [q.x, q.y]));
    const A = P(V3(0, y0, -3)), B = P(V3(0, y1, -3));
    let ux = B.x - A.x, uy = B.y - A.y; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const Lx = Math.cos(o.light), Ly = Math.sin(o.light), sg = ((-uy) * Lx + ux * Ly) >= 0 ? 1 : -1, nx = -uy * sg, ny = ux * sg;
    let cS0 = 1e9, cS1 = -1e9; for (const p of cuffHull) { const sv = (p[0] - A.x) * nx + (p[1] - A.y) * ny; if (sv < cS0) cS0 = sv; if (sv > cS1) cS1 = sv; }
    const cyl = (c, hp) => {   // across the tube: lit edge → base → soft cel step → shade → bounce light
      let s0 = 1e9, s1 = -1e9; for (const p of hp) { const s = (p[0] - A.x) * nx + (p[1] - A.y) * ny; if (s < s0) s0 = s; if (s > s1) s1 = s; }
      if (hp !== bodyHull) { s0 = cS0; s1 = cS1; }
      const g = c.createLinearGradient(A.x + nx * s1, A.y + ny * s1, A.x + nx * s0, A.y + ny * s0);
      g.addColorStop(0, col.hi); g.addColorStop(0.2, col.base); g.addColorStop(0.5, col.base); g.addColorStop(0.62, col.shade); g.addColorStop(0.88, col.shade); g.addColorStop(1, col.bounce);
      return g;
    };
    const lw = Math.max(1.1, 1.5 * u);
    const front = (pts) => { const n = pts.length; let st = 0; while (st < n && pts[st].f > 0) st++; if (st === n) return pts; const run = []; for (let k = 1; k <= n; k++) { const q = pts[(st + k) % n]; if (q.f > 0) run.push(q); else if (run.length) break; } return run; };
    function ribs(c) {
      c.strokeStyle = col.line; c.lineWidth = Math.max(0.7, 0.9 * u);
      for (let i = 0; i < 30; i++) { const a = i / 30 * TAU, nz = N(V3(Math.cos(a), 0, Math.sin(a))).z; if (nz < 0.08) continue; const p0 = P(V3(Math.cos(a) * rxC, y0, Math.sin(a) * rzC - 3)), p1 = P(V3(Math.cos(a) * rxC * 1.03, y0 + cl, Math.sin(a) * rzC * 1.03 - 3)); c.globalAlpha = 0.15 * rib * smooth(0.08, 0.4, nz); c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke(); }
      c.globalAlpha = 1;
    }
    function body(c) {
      // one silhouette line round cuff + body together (stroked under both fills, so no seam ellipse shows inside)
      c.save(); c.strokeStyle = col.line; c.lineWidth = lw * 2; c.lineJoin = 'round'; c.globalAlpha = 0.85;
      c.beginPath(); smoothPath(c, cuffHull); c.stroke(); c.beginPath(); smoothPath(c, bodyHull); c.stroke(); c.restore();
      // the cuff, then the body puffing over its end
      c.save(); c.beginPath(); smoothPath(c, cuffHull); c.fillStyle = cyl(c, cuffHull); c.fill(); if (rib > 0) { c.clip(); ribs(c); } c.restore();
      c.save(); c.beginPath(); smoothPath(c, bodyHull); c.fillStyle = cyl(c, bodyHull); c.fill();
      c.clip(); c.lineCap = 'round';
      // soft folds: short creases round the visible side (a dark crease with a lit edge above it)
      const folds = o.folds || [[0.06, 0.45, 0.75, 9], [0.17, -0.55, 0.6, -8], [0.31, 0.15, 0.7, 10], [0.5, -0.35, 0.55, -9], [0.72, 0.55, 0.5, 8]];
      for (const [fu, ph, span, sk] of folds) {
        const yy = lerp(y0 + cl, y1, fu), sc = lerp(1, fl, fu) * 1.02, pts = [];
        for (let i = 0; i <= 8; i++) { const v = -1 + 2 * i / 8, a = Math.PI * 1.5 + ph + v * span, q = P(V3(Math.cos(a) * rxB * sc, yy + v * sk, Math.sin(a) * rzB * sc - 3)); q.f = N(V3(Math.cos(a), 0, Math.sin(a))).z; pts.push(q); }
        for (let i = 0; i < 8; i++) {
          const a = pts[i], bq = pts[i + 1], f = Math.min(a.f, bq.f); if (f < 0.05) continue; const w = Math.sin(Math.PI * (i + 0.5) / 8) * smooth(0.05, 0.35, f);
          c.globalAlpha = 0.42 * w; c.strokeStyle = col.line; c.lineWidth = 1.5 * u; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(bq.x, bq.y); c.stroke();
          c.globalAlpha = 0.3 * w; c.strokeStyle = col.hi; c.lineWidth = 1.3 * u; c.beginPath(); c.moveTo(a.x + Lx * 2.2 * u, a.y + Ly * 2.2 * u); c.lineTo(bq.x + Lx * 2.2 * u, bq.y + Ly * 2.2 * u); c.stroke();
        }
      }
      // where the body gathers onto the cuff: a soft seam on the visible side only
      const fbs = front(ring(y0 + cl * 0.72, rxB * 0.93, rzB * 0.93, 36, 0.02, seed)); c.globalAlpha = 0.3; c.strokeStyle = col.line; c.lineWidth = 1.6 * u;
      if (fbs.length > 2) { c.beginPath(); c.moveTo(fbs[0].x, fbs[0].y); for (const q of fbs) c.lineTo(q.x, q.y); c.stroke(); }
      c.restore();
    }
    function lip(c) {   // the front half of the ribbed cuff
      // (masked off the body, which puffs over the cuff's far end)
      const fa = front(cuffA), fb = front(cuffB); if (fa.length < 3 || fb.length < 3) return;
      const band = fa.map(q => [q.x, q.y]).concat(fb.slice().reverse().map(q => [q.x, q.y]));
      c.save(); c.beginPath(); c.rect(-W, -H, 3 * W, 3 * H); smoothPath(c, bodyHull); c.clip('evenodd');
      c.beginPath(); c.moveTo(band[0][0], band[0][1]); for (const p of band) c.lineTo(p[0], p[1]); c.closePath();
      c.fillStyle = cyl(c, band); c.fill(); c.clip();
      if (rib > 0) ribs(c);
      c.restore();
      c.save(); c.lineCap = 'round'; c.strokeStyle = col.line; c.lineWidth = lw * 1.1; c.globalAlpha = 0.8;   // the opening's edge
      c.beginPath(); c.moveTo(fa[0].x, fa[0].y); for (const q of fa) c.lineTo(q.x, q.y); c.stroke(); c.restore();
    }
    let x0 = 1e9, yy0 = 1e9, x1 = -1e9, yy1 = -1e9;
    for (const p of bodyHull.concat(cuffHull)) { x0 = Math.min(x0, p[0]); yy0 = Math.min(yy0, p[1]); x1 = Math.max(x1, p[0]); yy1 = Math.max(yy1, p[1]); }
    // device-space box (the hull points are in ctx user space; the layer shares ctx's transform)
    return { into, body, lip, box: [x0, yy0, x1, yy1] };
  }
  // the back of a hand gripping hard: extensor tendons fanning from the wrist toward the knuckles
  function gripTendons(c, rig, k, col) {
    if (k <= 0.01) return;
    const P = rig.P, m = rig.m, u = rig.unit;
    c.save(); c.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const mcp = m.fingers[i].mcp, x0 = mcp.x * 0.3, pts = [];
      for (let j = 0; j <= 5; j++) { const s = 0.35 + 0.55 * j / 5; pts.push(P(V3(lerp(x0, mcp.x, s), lerp(-6, mcp.y + 10, s), 8 + 5 * Math.sin(Math.PI * s)))); }
      const w = [0.8, 1, 0.85, 0.5][i];
      c.globalAlpha = 0.17 * k * w; c.strokeStyle = col.shade; c.lineWidth = 1.8 * u;
      c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (const q of pts) c.lineTo(q.x, q.y); c.stroke();
    }
    c.restore();
  }



  /* ============================================================ C37 夜のテーブル（録音） */
  // 3/4 view down onto the table from his side.  The small lamp stands on her side (just off the top edge);
  // the phone glows cool in the middle; her hands come from the far side into the lamp light.
  // 0.2 his finger taps play → 0.4 the muffled blast → 1.1 her left hand reaches for the phone →
  // 1.7 it freezes in the air → 3.3 it grips her own right wrist (over the long sleeve), trembling.
  const C37 = {
    cam: makeCam([1, -32, 47], [-4.5, 10, 0], 2250),
    lamp: [-15, 47, 31],
    phone: { x: 0, y: 2, ang: 0.15 },
  };
  C37.table = () => tableImage('g10:C37:table6', C37.cam, {
    extTop: 160, extLeft: 200, lamp: C37.lamp, power: 4200, exposure: 1.75, farEdge: 58, focus: 61, dofRange: 24, dofBlur: 5, spec: 0.1, coneOut: 0.3, coneIn: 0.86, grain: 0.8,
  });
  // world point of a phone-local point (phone units), on the glass
  function phonePt(ph, u, v, z) {
    const ca = Math.cos(ph.ang), sa = Math.sin(ph.ang), x = u * PH_UNIT, y = -v * PH_UNIT;
    return [ph.x + x * ca - y * sa, ph.y + x * sa + y * ca, z == null ? 0.85 : z];
  }
  const palmOf = (r) => ({ x: (r.wrist.x + r.joints[2][0].x) / 2, y: (r.wrist.y + r.joints[2][0].y) / 2 });

  // the table with the lamp's glow and the phone's resting spill baked in (layout space)
  C37.set = () => PV.cached('g10:C37:set2', W, H, (c) => {
    c.drawImage(C37.table(), -200, -160);
    const pc = C37.cam.P(C37.phone.x, C37.phone.y, 0), lampP = C37.cam.P(C37.lamp[0], C37.lamp[1] - 6, 0);
    c.save(); c.globalCompositeOperation = 'screen'; c.translate(pc.x, pc.y); c.rotate(-0.1); c.scale(1, 0.66);
    const g = c.createRadialGradient(0, 0, 60, 0, 0, 500); g.addColorStop(0, PV.rgba('#8fb3d9', 0.21)); g.addColorStop(0.4, PV.rgba('#6f8fc0', 0.075)); g.addColorStop(1, 'rgba(60,80,120,0)');
    c.fillStyle = g; c.fillRect(-500, -500, 1000, 1000); c.restore();
    L.glow(c, lampP.x + 60, -260, 900, '#ffcf8a', 0.24);
  });

  PV.shot('C37', {
    draw(ctx, t, d) {
      const tc = clamp(t, 0, d), hk = q12(tc), cam = C37.cam, ph = C37.phone;
      const tapT = 0.2, amp = tc >= 0.4 ? recAmp(tc - 0.4) : 0, ampK = hk >= 0.4 ? recAmp(hk - 0.4) : 0;
      const pc = cam.P(ph.x, ph.y, 0), lampP = cam.P(C37.lamp[0], C37.lamp[1] - 6, 0);
      const shake = smooth(3.3, 3.6, hk);                                     // the grip trembles
      const jx = shake * (2.4 * N2(hk * 9.1, 3.3) + 1.2 * N2(hk * 23, 1.1)), jy = shake * (1.8 * N2(4.4, hk * 10.3));
      // her right hand lies still until the grip: one cel, held; from the grip on it trembles (on twos)
      const R = held('C37R', hk < 3.3 ? 'still' : hk, (c) => {
        const rW = cam.P(-22, 16, 1.6);
        const herR = rigAt(c, Object.assign({ side: 'R', kind: 'her', view: 'back', pitch: -0.5, yaw: 0.12, rot: Math.PI - 0.72,
          scale: rW.k * 17.5 / 195, curl: [0.28, 0.3, 0.36, 0.4, 0.46], spread: 0.08, surgicalScars: true, arm: 2,
          t: hk < 3.3 ? 0 : hk, tremble: 0.12 + 0.45 * shake, seed: 3, light: -1.75 }, NIGHT_SKIN), { x: rW.x + jx, y: rW.y + jy }, wristOf);
        rigShadows(c, [{ rig: herR, dx: 3, dy: 12, blur: 7, alpha: 0.5, arm: 420 }]);
        const dk = darkMap(c, 'C37R', 0.74, '#0d0907', [{ x: lampP.x, y: lampP.y + 40, rx: 1250, ry: 880, a: 1, core: 0.3 }, { x: pc.x + 60, y: pc.y + 40, rx: 560, ry: 380, a: 0.62, core: 0.22, rot: -0.3 }]);
        const HL = handsLayer(c, 'C37R', [{ rig: herR, sleeve: knitSleeve(herR, { y0: 0, y1: 430, light: -1.75, seed: 3 }) }], dk);
        blitBox(c, HL);
        return growBox(HL && HL.box, 130);
      });
      // ---- the cels, on twos (layout space): the set, her right hand, the earplugs, the phone, his tapping finger, her left hand
      const cel = held('C37', hk, (c) => {
        c.drawImage(C37.set(), 0, 0);
        layHeld(c, R);
        // left hand: off-frame -> reach over the phone -> freeze in the air (+ a tiny recoil) -> back onto her right wrist, grip
        const reach = ease.outCubic(smooth(1.1, 1.7, hk)), recoil = Math.sin(Math.PI * smooth(1.7, 1.92, hk)) * (1 - smooth(1.92, 2.3, hk));
        const go = ease.inOutCubic(smooth(2.65, 3.3, hk)), squeeze = smooth(3.3, 3.7, hk);
        const A0 = [27, 50, 18], A1 = [8.5, 10.5, 11.5], A2 = [-20.2, 17.6, 4.0];
        let lw = [lerp(A0[0], A1[0], reach), lerp(A0[1], A1[1], reach), lerp(A0[2], A1[2], reach)];
        lw[1] += 1.4 * recoil; lw[2] += 0.7 * recoil;
        if (go > 0) { const lift = Math.sin(Math.PI * go) * 1.0; lw = [lerp(lw[0], A2[0], go), lerp(lw[1] - 3 * Math.sin(Math.PI * go), A2[1], go), lerp(lw[2], A2[2], go) + lift]; }
        const hes = smooth(1.75, 2.65, hk);                                     // hesitation: the fingers fold a little
        const lp = cam.P(lw[0], lw[1], lw[2]);
        const trem = (1 - go) * smooth(1.6, 1.8, hk) * 0.8 + shake * 0.9;
        const ljx = trem * 1.6 * N2(hk * 8.3, 9.2) + jx, ljy = trem * 1.4 * N2(7.1, hk * 9.7) + jy;
        const openC = [0.16 + 0.14 * hes, 0.1 + 0.2 * hes, 0.12 + 0.2 * hes, 0.16 + 0.22 * hes, 0.2 + 0.22 * hes];
        const gripC = [0.5 + 0.06 * squeeze, 0.64 + 0.08 * squeeze, 0.7 + 0.08 * squeeze, 0.74 + 0.08 * squeeze, 0.78 + 0.08 * squeeze];
        const herL = reach > 0.005 ? rigAt(c, Object.assign({ side: 'L', kind: 'her', view: 'back',
          pitch: lerp(-0.42, 0.28, go), yaw: lerp(0.1, 0.75, go), rot: lerp(Math.PI + 0.58, Math.PI + 1.25, go), scale: lp.k * 17.5 / 195,
          curl: openC.map((v, i) => lerp(v, gripC[i], go)), spread: lerp(0.32 - 0.18 * hes, 0.1, go),
          arm: 8, t: hk, tremble: 0.2 + trem, seed: 7, light: -1.75 }, NIGHT_SKIN),
          { x: lp.x + ljx, y: lp.y + ljy }, palmOf) : null;
        // his right hand, against the lamp: the index finger taps play (0.2), then withdraws out of frame
        const press = smooth(-0.25, 0.2, hk) * (1 - smooth(0.3, 0.6, hk));
        const lift = (1 - smooth(-0.25, 0.2, hk)) * 1.3 + smooth(0.3, 0.6, hk) * 1.2;
        const back = ease.inCubic(smooth(0.45, 1.2, hk));
        const btn = phonePt(ph, PLAY.u, PLAY.v, 0.85 + lift + 0.15 * (1 - press));
        const out = [30, -34, 10];
        const hp = [lerp(btn[0], out[0], back), lerp(btn[1], out[1], back), lerp(btn[2], out[2], back)];
        const hs = cam.P(hp[0], hp[1], hp[2]);
        const his = back < 0.999 ? rigAt(c, Object.assign({ side: 'R', kind: 'him', view: 'back', pitch: 0.55, yaw: -0.12, rot: -0.62,
          scale: hs.k * 18.5 / 195 / 1.07, curl: [0.5, 0.02 + 0.1 * back, 0.64, 0.7, 0.74], spread: 0.12, arm: 37,
          t: hk, tremble: 0.05, seed: 11, light: -1.75, style: 'rim', dark: '#2c2523', rimColor: '#ffd8a6', sss: '#c8704a', rimWidth: 0.8, bounce: '#3f4a66' }), { x: hs.x, y: hs.y }, padOf(1)) : null;
        // the earplugs; the phone (its screen on twos); the shadows of the hands above it
        { const ep = cam.P(17.5, 15.0); L.earplugs(c, { x: ep.x, y: ep.y, s: ep.k * 0.022, rot: -0.35, case: true, alpha: 0.7, tone: { amb: '#8f7458', k: 0.6, sat: 0.7, hi: '#d9c8b0', sh: '#0e0b09', rim: '#c9a070', rimA: 0.3 }, light: -1.9, accent: 0.2 }); }
        const st = { pos: Math.max(0, hk - 0.4), playing: hk >= tapT, tap: hk >= tapT ? hk - tapT : null, clock: '23:41' };
        drawPhone(c, hk, planeFrame(cam, ph.x, ph.y, 0.85, ph.ang, PH_UNIT), st, { uiRes: 1.1, uiKey: 'C37' });
        if (his || herL) rigShadows(c, [
          { rig: his, dx: lift * 3, dy: 8 + lift * 9, blur: 5 + lift * 3, alpha: 0.42, arm: 420 },
          { rig: herL, dx: lw[2] * 1.8, dy: 8 + lw[2] * 8.5, blur: 6 + lw[2] * 2.2, alpha: 0.55 - 0.016 * lw[2], arm: 440 },
        ]);
        if (his || herL) {
          // light: the lamp pool and the phone are holes in the darkness laid over the hands
          const dk = darkMap(c, 'C37', 0.74, '#0d0907', [
            { x: lampP.x, y: lampP.y + 40, rx: 1250, ry: 880, a: 1, core: 0.3 },
            { x: pc.x + 60, y: pc.y + 40, rx: 560, ry: 380, a: 0.62 + 0.1 * ampK, core: 0.22, rot: -0.3 },
          ]);
          const nearBlur = herL ? clamp((lw[2] - 4) / 9, 0, 1) * 2.4 : 0;           // the hovering hand is nearer the lens
          const sL = herL ? knitSleeve(herL, { y0: 6, y1: 470, light: -1.75, seed: 7 }) : null;
          const sH = his ? knitSleeve(his, { y0: 26, y1: 480, light: -1.75, col: SWEAT, seed: 11, rx: 27, rz: 20, rib: 0.6 }) : null;
          const HL = handsLayer(c, 'C37', [{ rig: his, sleeve: sH, ro: { glow: 0 } },
            { rig: herL, sleeve: sL, blur: nearBlur, detail: (cc) => gripTendons(cc, herL, go * (0.6 + 0.4 * squeeze), { shade: '#9a6a58', hi: '#ffe8d0' }) }], dk);
          blitBox(c, HL);
        }
      });
      // ---- camera (a slow breath; at the end the eye leans in on the grip), the cels, the light over them
      ctx.save();
      const toGrip = ease.inOutCubic(smooth(2.7, 4.5, tc)), gS = cam.P(-20, 17, 3);
      PV.camera(ctx, { zoom: 1 + 0.016 * ease.sine(tc / d) + 0.06 * toGrip, cx: lerp(960, gS.x, toGrip), cy: lerp(560, gS.y, toGrip) });
      ctx.imageSmoothingQuality = 'low'; ctx.drawImage(cel.canvas, 0, 0);
      ctx.globalCompositeOperation = 'screen';
      spriteGlow(ctx, pc.x, pc.y - 40, 420, '#9dbbe0', 0.06 + 0.07 * amp);           // the phone breathes with the sound
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      L.dust(ctx, t, { seed: 37, count: 40, x0: 200, y0: 0, x1: 1500, y1: 520, size: 2.4, alpha: 0.26, color: '#ffe2b8', drift: 40, vx: 3, vy: -2 });
      ctx.restore();
    },
  });

  /* ------------------------------------------------------------ phone as a texture on the table (true perspective) */
  const PH_TONE = { amb: '#d9b48a', k: 0.42, sat: 0.85, hi: '#fff0d8', sh: '#14110f', rim: '#f0c690', rimA: 0.45 };
  function phoneTexture(key, t, st, res, o) {
    const tw = Math.round(340 * res), th = Math.round(660 * res);
    const B = PV.buffer('g10:ptex:' + key, tw, th), c = B.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, tw, th);
    L.phone(c, t, Object.assign({ x: tw / 2, y: th / 2, s: res, screen: 'photo', ui: false, drawPhoto: (cc, w, h) => recorder(cc, w, h, st, t), shadow: false,
      tone: PH_TONE, light: -2.3, cacheScale: res }, o || {}));
    return { canvas: B.canvas, tw, th, wcm: 340 * PH_UNIT, hcm: 660 * PH_UNIT };
  }
  // map a texture lying flat (plane z) centred at (cx,cy), rotated ang, onto the screen with true perspective
  // (thin strips along its length, each an affine map of its source rows)
  function drawPlanar(ctx, cam, tex, cx, cy, z, ang, nv, nu) {
    // piecewise-affine texture mapping on a triangle mesh (exact at every vertex: no sawtooth on thin lines)
    const ca = Math.cos(ang), sa = Math.sin(ang), wcm = tex.wcm, hcm = tex.hcm, tw = tex.tw, th = tex.th;
    nv = nv || 24; nu = nu || 3;
    const P = (u, v) => { const x = (u - 0.5) * wcm, y = (0.5 - v) * hcm; return cam.P(cx + x * ca - y * sa, cy + x * sa + y * ca, z); };
    const G = []; for (let j = 0; j <= nv; j++) { const row = []; for (let i = 0; i <= nu; i++) row.push(P(i / nu, j / nv)); G.push(row); }
    const tri = (p0, p1, p2, s0, t0, s1, t1, s2, t2) => {
      const det = (s1 - s0) * (t2 - t0) - (s2 - s0) * (t1 - t0); if (Math.abs(det) < 1e-9) return;
      const a = ((p1.x - p0.x) * (t2 - t0) - (p2.x - p0.x) * (t1 - t0)) / det, b = ((p1.y - p0.y) * (t2 - t0) - (p2.y - p0.y) * (t1 - t0)) / det;
      const c = ((p2.x - p0.x) * (s1 - s0) - (p1.x - p0.x) * (s2 - s0)) / det, d = ((p2.y - p0.y) * (s1 - s0) - (p1.y - p0.y) * (s2 - s0)) / det;
      // clip to the triangle grown by ~1.8px: a neighbour is always fully opaque under each anti-aliased edge (no seams)
      const mx = (p0.x + p1.x + p2.x) / 3, my = (p0.y + p1.y + p2.y) / 3, g = (q) => { const dx = q.x - mx, dy = q.y - my, l = Math.hypot(dx, dy) || 1; return [q.x + dx / l * 1.8, q.y + dy / l * 1.8]; };
      const q0 = g(p0), q1 = g(p1), q2 = g(p2);
      const sx = Math.max(0, Math.floor(Math.min(s0, s1, s2)) - 2), sy = Math.max(0, Math.floor(Math.min(t0, t1, t2)) - 2);
      const sw = Math.min(tw, Math.ceil(Math.max(s0, s1, s2)) + 2) - sx, sh = Math.min(th, Math.ceil(Math.max(t0, t1, t2)) + 2) - sy;
      ctx.save(); ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.closePath(); ctx.clip();
      ctx.transform(a, b, c, d, p0.x - a * s0 - c * t0, p0.y - b * s0 - d * t0);
      ctx.drawImage(tex.canvas, sx, sy, sw, sh, sx, sy, sw, sh); ctx.restore();
    };
    ctx.save(); ctx.imageSmoothingQuality = 'high';
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const s0 = i / nu * tw, s1 = (i + 1) / nu * tw, t0 = j / nv * th, t1 = (j + 1) / nv * th;
      const A = G[j][i], B = G[j][i + 1], C = G[j + 1][i], D = G[j + 1][i + 1];
      tri(A, B, C, s0, t0, s1, t0, s0, t1); tri(B, D, C, s1, t0, s1, t1, s0, t1);
    }
    ctx.restore();
    return P;
  }
  // the phone's rounded outline on the table (world xy, cm); grow = extra phone units all round
  function phoneOutline(ph, grow) {
    const ca = Math.cos(ph.ang), sa = Math.sin(ph.ang), g = grow || 0, hw = 150 + g, hh = 310 + g, R = 42 + g, pts = [];
    const add = (u, v) => { const x = u * PH_UNIT, y = -v * PH_UNIT; pts.push([ph.x + x * ca - y * sa, ph.y + x * sa + y * ca]); };
    const corners = [[hw - R, -hh + R, -Math.PI / 2], [hw - R, hh - R, 0], [-hw + R, hh - R, Math.PI / 2], [-hw + R, -hh + R, Math.PI]];
    for (const [cx0, cy0, a0] of corners) for (let k = 0; k <= 8; k++) { const a = a0 + (k / 8) * Math.PI / 2; add(cx0 + Math.cos(a) * R, cy0 + Math.sin(a) * R); }
    return pts;
  }
  // the phone's side faces (thin dark metal band) between the glass (z1) and the table (z0)
  function phoneSides(ctx, cam, ph, z0, z1, col) {
    const pts = phoneOutline(ph, 0);
    ctx.save(); ctx.fillStyle = col || '#1d1e23'; ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const a = cam.P(p[0], p[1], z1), b = cam.P(q[0], q[1], z1), c = cam.P(q[0], q[1], z0), d = cam.P(p[0], p[1], z0);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    }
    ctx.fill(); ctx.restore();
  }
  // a world-space polygon on the table (for soft contact shadows / light pools)
  function worldPoly(ctx, cam, pts) { ctx.beginPath(); pts.forEach((p, i) => { const q = cam.P(p[0], p[1], p[2] || 0); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.closePath(); }

  /* ============================================================ C38 スマホ（弦が切れ、再生が終わる） */
  // Low across-the-table close-up of the phone.  0.24 the string snaps inside the recording (spike, a 2-frame
  // jolt) → boos → 1.2 the waveform runs out, ▶ returns → 1.6–2.8 focus pulls from the phone to her hands in the
  // background, still gripping her right wrist → 2.85「なんで……あるの」.
  const C38 = {
    cam: makeCam([6, -28, 19], [3, 12, 0], 2050),
    lamp: [-34, 50, 30],
    phone: { x: -1.2, y: 2, ang: -0.3 },
    focusPhone: 37, focusHands: 57,
  };
  const c38table = (k) => tableImage('g10:C38:tableX:' + k, C38.cam, {
    lamp: C38.lamp, power: 3600, exposure: 1.75, farEdge: 50, extTop: 130, focus: k === 'near' ? C38.focusPhone : C38.focusHands, dofRange: 16, dofNear: 2, dofBlur: 7,
    spec: 0.16, coneOut: 0.25, coneIn: 0.85, grain: 0.7, room: '#0c0a09',
    roomGlow: (sx, sy) => 0.05 * Math.exp(-Math.pow((sx - 240) / 700, 2) - Math.pow((sy + 60) / 260, 2)),
  });
  const lensBlur = (depth, focus, k) => k * Math.abs(depth - focus) / depth;

  PV.shot('C38', {
    draw(ctx, t, d) {
      const tc = clamp(t, 0, d), hk = q12(tc), cam = C38.cam, ph = C38.phone;
      c38table('near'); c38table('far');                                    // both focus states are baked on the cut's first frame
      // focus: phone (0–1.6) → her hands (2.8); the cels follow it on twos
      const rackOf = (u) => ease.inOutCubic(smooth(1.6, 2.8, u));
      const rackK = rackOf(hk), focusK = lerp(C38.focusPhone, C38.focusHands, rackK);
      const ended = hk >= 1.2, ampK = ended ? 0 : recAmp(Math.min(REC_LEN, REC_LEN - 1.2 + hk));
      const dimK = 1 - 0.14 * smooth(2.5, 4.5, hk);                       // the screen dims a little after the end
      const pc = cam.P(ph.x, ph.y, 0);
      const bFar = lensBlur(57, focusK, 26), bNear = lensBlur(36, focusK, 22);
      // her hands in the background, the left still gripping the right wrist and trembling.  While they are deep in the
      // blur (focus on the phone) the cel is held longer: the tremor is lost in the bokeh anyway.
      const hKey = bFar > 4 ? Math.floor(tc * 6 + 1e-6) / 6 : Math.floor(tc * 8 + 1e-6) / 8;      // on threes (8 fps) in focus
      const HND = held('C38H', hKey + '|' + bFar.toFixed(2), (c) => {
        const hq = hKey, dimH = 1 - 0.14 * smooth(2.5, 4.5, hq), ampH = hq >= 1.2 ? 0 : recAmp(REC_LEN - 1.2 + hq);   // (everything here follows the key)
        const jx = 2.0 * N2(hq * 9.1, 3.3) + 1.0 * N2(hq * 23, 1.1), jy = 1.5 * N2(4.4, hq * 10.3);
        const rW = cam.P(1.5, 28, 1.6);
        const herR = rigAt(c, Object.assign({ side: 'R', kind: 'her', view: 'back', pitch: -0.9, yaw: 0.2, rot: Math.PI - 0.62,
          scale: rW.k * 16.5 / 195, curl: [0.28, 0.3, 0.36, 0.4, 0.46], spread: 0.08, surgicalScars: true, arm: 2,
          t: hq, tremble: 0.5, seed: 3, light: -1.9 }, NIGHT_SKIN), { x: rW.x + jx, y: rW.y + jy }, wristOf);
        const gp = cam.P(2.8, 29.5, 4.2);
        const sq = 0.08 * (0.5 + 0.5 * Math.sin(hq * 2.3)) + 0.06 * smooth(2.8, 3.2, hq);
        const herL = rigAt(c, Object.assign({ side: 'L', kind: 'her', view: 'back', pitch: -0.1, yaw: 0.75, rot: Math.PI + 1.25,
          scale: gp.k * 16.5 / 195, curl: [0.5 + sq, 0.6 + sq, 0.66 + sq, 0.7 + sq, 0.74 + sq], spread: 0.1, arm: 8,
          t: hq, tremble: 0.9, seed: 7, light: -1.9 }, NIGHT_SKIN), { x: gp.x + jx * 1.2, y: gp.y + jy * 1.2 }, palmOf);
        const dk = darkMap(c, 'C38', 0.7, '#0b0807', [
          { x: pc.x + 240, y: pc.y - 330, rx: 760, ry: 420, a: 0.75 * dimH + 0.15 * ampH, core: 0.2, rot: -0.2 },
          { x: 120, y: -120, rx: 1100, ry: 700, a: 0.55, core: 0.3 },
        ]);
        rigShadows(c, [{ rig: herR, dx: 12, dy: 10, blur: 7 + bFar * 1.4, alpha: 0.55, arm: 420 }, { rig: herL, dx: 16, dy: 22, blur: 10 + bFar * 1.4, alpha: 0.4, arm: 440 }]);
        const sR = knitSleeve(herR, { y0: 0, y1: 440, light: -1.9, seed: 3 }), sL = knitSleeve(herL, { y0: 6, y1: 470, light: -1.9, seed: 7 });
        const HL = handsLayer(c, 'C38', [{ rig: herR, sleeve: sR },
          { rig: herL, sleeve: sL, detail: (cc) => gripTendons(cc, herL, 0.8, { shade: '#9a6a58', hi: '#ffe8d0' }) }], dk, { blur: bFar });
        blitBox(c, HL);
        return growBox(HL && HL.box, 170);
      });
      // the phone, mapped flat onto the table in true perspective: its sharp image changes only while the recording plays
      // (and as the screen dims); its defocus is a blur of that image
      const dimQ = Math.round(dimK * 50) / 50;
      const PS = held('C38Ps', (ended ? 'E' : hk) + '|' + dimQ, (c) => {
        const st = { pos: Math.min(REC_LEN, REC_LEN - 1.2 + hk), playing: !ended, ended, tap: null, clock: '23:46' };
        // contact shadow (lamp at the far left): one soft penumbra + a tight occlusion line under the edge
        softShadow(c, 'C38ph', (cc) => { const pts = phoneOutline(ph, 12).map(p => cam.P(p[0] + 0.4, p[1] - 0.32, 0)); cc.moveTo(pts[0].x, pts[0].y); for (const q of pts) cc.lineTo(q.x, q.y); cc.closePath(); }, 16, 0.42);
        c.fillStyle = 'rgba(0,0,0,0.3)'; worldPoly(c, cam, phoneOutline(ph, 2).map(p => [p[0] + 0.06, p[1] - 0.05, 0])); c.fill();
        phoneSides(c, cam, ph, 0.06, 0.85, '#202127');
        const tex = phoneTexture('C38', hk, st, 2, { bright: dimQ });
        drawPlanar(c, cam, tex, ph.x, ph.y, 0.85, ph.ang, 22, 3);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const p of phoneOutline(ph, 40)) for (const z of [0, 1]) { const q = cam.P(p[0] + 0.4, p[1] - 0.32, z); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
        return growBox({ x: Math.max(0, Math.floor(x0)), y: Math.max(0, Math.floor(y0)), w: Math.min(W, Math.ceil(x1)) - Math.max(0, Math.floor(x0)), h: Math.min(H, Math.ceil(y1)) - Math.max(0, Math.floor(y0)) }, 20);
      });
      // ---- the set: the table (two baked focus states, crossfaded with the rack), the phone's light, the phone.  It only
      // changes while the recording plays, while the focus moves, and as the screen dims.
      const set = held('C38S', rackK.toFixed(3) + '|' + dimQ + '|' + (ended ? 'E' : hk), (c) => {
        if (rackK < 0.995) c.drawImage(c38table('near'), 0, -130);
        if (rackK > 0.01) { c.globalAlpha = rackK; c.drawImage(c38table('far'), 0, -130); c.globalAlpha = 1; }
        c.save(); c.globalCompositeOperation = 'screen';
        c.translate(pc.x + 120, pc.y - 120); c.rotate(-0.35); c.scale(1, 0.42);
        const gk = (0.22 + 0.08 * ampK) * dimQ;
        const g = c.createRadialGradient(0, 0, 80, 0, 0, 900); g.addColorStop(0, PV.rgba('#8fb3d9', gk)); g.addColorStop(0.4, PV.rgba('#6f8fc0', gk * 0.35)); g.addColorStop(1, 'rgba(60,80,120,0)');
        c.fillStyle = g; c.fillRect(-900, -900, 1800, 1800); c.restore();
        const bx = PS.box;
        if (bNear < 0.7 || !bx) layHeld(c, PS);
        else {                                                 // defocused: blurred at reduced resolution inside its box
          const f = bNear < 4 ? 0.5 : bNear < 9 ? 0.25 : 0.125, sw = Math.ceil(bx.w * f), sh = Math.ceil(bx.h * f);
          const B = PV.buffer('g10:pblur', 980, 560), c2 = B.ctx; c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, sw + 2, sh + 2);
          c2.filter = `blur(${(bNear * f).toFixed(2)}px)`; c2.drawImage(PS.canvas, bx.x, bx.y, bx.w, bx.h, 0, 0, sw, sh); c2.filter = 'none';
          c.save(); c.imageSmoothingQuality = 'low'; c.drawImage(B.canvas, 0, 0, sw, sh, bx.x, bx.y, bx.w, bx.h); c.restore();
        }
        // the screen's own bloom
        const sc = cam.P(ph.x + 0.4, ph.y + 1.0, 1);
        c.globalCompositeOperation = 'screen'; spriteGlow(c, sc.x, sc.y, 420, '#a9c4e6', 0.1 * dimQ + 0.05 * ampK); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      });
      // ---- camera: the string snaps at 0.24 (a 2-frame jolt); with the focus the eye leans toward her hands
      const rack = rackOf(tc), jolt = tc > 0.24 && tc < 0.33 ? 1 : 0;
      ctx.save();
      PV.camera(ctx, { zoom: 1 + 0.012 * ease.sine(tc / d) + 0.04 * rack + 0.012 * jolt, cx: lerp(820, 1080, rack), cy: lerp(560, 260, rack), x: jolt * 4, y: jolt * -3 });
      ctx.imageSmoothingQuality = 'low'; ctx.drawImage(set.canvas, 0, 0);
      if (HND.box) ctx.drawImage(HND.canvas, HND.box.x, HND.box.y, HND.box.w, HND.box.h, HND.box.x, HND.box.y, HND.box.w, HND.box.h);
      // ---- out-of-focus highlights: the lamp glinting far behind (warm), a few motes near the lens (cool, grow as the
      // focus racks away from them), dust in the phone light
      ctx.globalCompositeOperation = 'screen';
      const BK = [[180, -60, 46, 0], [430, -95, 30, 1], [640, -40, 56, 0], [1520, -70, 38, 1], [1760, -20, 60, 0], [300, 20, 24, 1]];
      BK.forEach(([x, y, r, k], i) => bokehDisc(ctx, x + 6 * N2(i * 3.1, tc * 0.25), y + 4 * N2(tc * 0.2, i * 2.7), r * (1 - 0.25 * rack), k ? '#ffd9a0' : '#ffc27a', (0.13 + 0.04 * N2(i, tc * 0.6)) * (1 - 0.35 * rack)));
      const NB = [[1580, 930, 70], [140, 820, 90], [1820, 520, 56]];
      NB.forEach(([x, y, r], i) => bokehDisc(ctx, x + 10 * N2(i * 5.3, tc * 0.2), y + 8 * N2(tc * 0.25, i * 4.1), r * (0.7 + 0.5 * rack), '#a9c4e6', 0.025 + 0.04 * rack));
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      L.dust(ctx, t, { seed: 62, count: 30, x0: 300, y0: 200, x1: 1600, y1: 800, size: 2.2, alpha: 0.22, color: '#dfe8ff', drift: 30, vx: 2, vy: -3 });
      ctx.restore();
    },
  });

  /* ============================================================ C39 夜の部屋（彼の横顔） */
  // A close-up of his bowed profile (PV.anime, 彼, the silent days: a plain black long-sleeved T) against the window and
  // the streetlight behind it.  He says V17 (154.3–160.4) through tears: his lips follow the real take (head.talk), they
  // tremble where his voice breaks (the two "……"), the tears well, run down his cheek, and a drop falls from his jaw (≈158.8).
  // Light: a dark room; her desk lamp across the table (right) draws a warm line along his profile (the library's rim), the
  // streetlight behind him (upper left) a cool line along his hair, nape and shoulder (a second rim from the cel's silhouette).
  // 160.0: deep in the bokeh her shoulders give way and her left hand comes up over her face (PV.anime, 先輩, the grey knit).
  // The figures are cels on twos (held layers keyed by the drawing time); the camera, the light and the drop run at 24 fps.
  const C39 = { T0: 154.0 };            // the cut's start on the film's clock: lip-sync and blinks need global seconds (--solo shifts env.T)
  // background: window (night, streetlight), sheer curtain, the lamp behind her — painted once, lens-blurred
  const C39LAMP = { x: 1722, y: 612 };          // shade centre of her desk lamp (it stands on the table, base at y 792)
  const c39bg = () => PV.cached('g10:C39:bg4', W + 120, H + 80, (c) => {
    const A = PV.makeCanvas(W + 120, H + 80), a = A.ctx; a.translate(60, 40);
    // room
    a.fillStyle = PV.linGrad(a, 0, 0, W, 0, [[0, '#17140f'], [0.6, '#1c1915'], [1, '#15120f']]); a.fillRect(-60, -40, W + 120, H + 80);
    // a tall window behind him: night sky, the town below, the streetlight
    const wx0 = 0, wx1 = 1120, wy0 = -40, wy1 = 930;
    a.save(); a.beginPath(); a.rect(wx0, wy0, wx1 - wx0, wy1 - wy0); a.clip();
    a.fillStyle = PV.linGrad(a, 0, wy0, 0, wy1, [[0, '#131a2e'], [0.45, '#1f2b50'], [0.75, '#2c3a66'], [1, '#35416a']]); a.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    const r = PV.rng(3911);
    for (const [base, hmin, hmax, col, lit] of [[860, 80, 260, '#1a2240', 0.35], [930, 40, 150, '#10162c', 0.5]]) {
      let x = wx0 - 20;
      while (x < wx1) { const w = 60 + r() * 150, h = hmin + r() * (hmax - hmin); a.fillStyle = col; a.fillRect(x, base - h, w + 2, h + 80);
        for (let k = 0; k < 6; k++) if (r() < lit) { a.fillStyle = r() < 0.65 ? '#e8b878' : '#cfe0ff'; a.fillRect(x + 8 + r() * (w - 20), base - h + 12 + r() * (h - 24), 7, 9); }
        x += w + 4 + r() * 10; }
    }
    // the streetlight: post, arm, lamp
    a.fillStyle = '#0b0e19'; a.fillRect(466, 300, 10, 640); a.beginPath(); a.moveTo(471, 305); a.quadraticCurveTo(469, 248, 520, 236); a.lineTo(560, 238); a.lineTo(560, 246); a.lineTo(522, 246); a.quadraticCurveTo(482, 256, 481, 305); a.fill();
    L.glow(a, 548, 250, 620, '#dfe9ff', 0.5); L.glow(a, 548, 250, 170, '#ffffff', 0.8); L.glow(a, 548, 250, 60, '#ffffff', 1);
    a.restore();
    // sheer curtain (left), lit through by the streetlight
    for (let k = 0; k < 11; k++) {
      const cx = -20 + k * 28 + 8 * Math.sin(k * 1.7), w = 48, al = 0.07 + 0.07 * Math.abs(Math.sin(k * 2.3));
      a.fillStyle = PV.linGrad(a, cx - w / 2, 0, cx + w / 2, 0, [[0, '#cfe0ff', 0], [0.5, '#cfe0ff', al], [1, '#cfe0ff', 0]]); a.fillRect(cx - w / 2, -40, w, 980);
    }
    // frame, mullions, sill catching the street light
    a.fillStyle = '#0d0b09'; a.fillRect(wx1, wy0, 36, wy1 - wy0 + 30); a.fillRect(wx0 - 60, wy1, wx1 - wx0 + 96, 30);
    a.fillRect(548 - 11, wy0, 22, wy1 - wy0); a.fillRect(wx0, 330, wx1 - wx0, 18);
    a.fillStyle = 'rgba(170,190,230,0.2)'; a.fillRect(wx0 - 60, wy1, wx1 - wx0 + 96, 3);
    // her desk lamp on the table: the wall glows warm above and behind it
    const lx = C39LAMP.x, ly = C39LAMP.y;
    L.glow(a, lx - 40, ly - 60, 760, '#e8b878', 0.4); L.glow(a, lx - 10, ly - 30, 320, '#ffd9a0', 0.42);
    a.fillStyle = '#f4cf98'; a.beginPath(); a.moveTo(lx - 50, ly - 46); a.lineTo(lx + 50, ly - 46); a.lineTo(lx + 76, ly + 40); a.lineTo(lx - 76, ly + 40); a.closePath(); a.fill();
    a.fillStyle = 'rgba(255,240,210,0.9)'; a.beginPath(); a.ellipse(lx, ly + 40, 76, 9, 0, 0, TAU); a.fill();
    a.fillStyle = '#2a211a'; a.fillRect(lx - 6, ly + 44, 12, 790 - ly - 44); a.beginPath(); a.ellipse(lx, 792, 46, 8, 0, 0, TAU); a.fill();
    // the table between them (dark, a thin lamp-lit edge)
    a.fillStyle = PV.linGrad(a, 0, 790, 0, H + 40, [[0, '#231d17'], [1, '#100d0b']]); a.fillRect(1156, 790, W - 1100, H);
    a.fillStyle = 'rgba(232,184,120,0.22)'; a.fillRect(1156, 788, W - 1100, 3);
    { const g = a.createRadialGradient(C39LAMP.x, 800, 10, C39LAMP.x, 800, 420); g.addColorStop(0, 'rgba(255,214,150,0.32)'); g.addColorStop(1, 'rgba(255,214,150,0)'); a.save(); a.beginPath(); a.rect(1156, 789, W, 400); a.clip(); a.translate(0, 800); a.scale(1, 0.25); a.translate(0, -800); a.fillStyle = g; a.fillRect(1156, 380, W, 840); a.restore(); }
    c.filter = 'blur(9px)'; c.drawImage(A.canvas, 0, 0); c.filter = 'none';
    // window light falling into the room (baked: soft shafts from the streetlight)
    c.save(); c.translate(60, 40); c.globalCompositeOperation = 'screen';
    L.godRays(c, 0, { x: 560, y: 230, angle: 0.55, spread: 0.5, count: 6, length: 1500, width: 120, flare: 3.2, color: '#cfe0ff', alpha: 0.055, seed: 39, flicker: 0 });
    c.restore();
  });
  // his voice breaks (the two "……" of V17, local seconds) and the sobs that catch his breath
  const c39brk = (u) => Math.max(PV.window(u, 0.78, 0.95, 1.42, 1.6), PV.window(u, 4.42, 4.6, 5.28, 5.45));
  const c39hitch = (u) => Math.exp(-Math.pow((u - 1.35) / 0.18, 2)) + 1.4 * Math.exp(-Math.pow((u - 4.85) / 0.22, 2));
  // his acting at local time u (on twos): bowed, eyes down, the tears from welling to streaming; at the breaks the eyes
  // squeeze and the lips quiver; "決まってるだろ" he forces out with the eyes a little more open; after it he sinks lower
  function c39boyArgs(u) {
    const brk = c39brk(u), hitch = c39hitch(u);
    const firm = PV.window(u, 5.32, 5.5, 6.05, 6.35), sink = smooth(5.9, 6.9, u);
    const L = C39.light;
    return {
      who: 'boy', outfit: 'year2', costume: { top: 'tee_black' }, pose: 'stand', facing: Math.PI / 2, camPitch: 0.15,
      x: C39.boyX, y: C39.boyY - 5 * hitch, scale: C39.boyS, T: C39.T0 + u, light: 'lamp', rimDir: 0.15, keyDir: L.key,
      params: { weight: 0.15, bow: 0.3, nod: 0.6 + 0.06 * hitch - 0.1 * firm + 0.08 * sink },
      head: { yaw: C39.yaw, pitch: -0.34 - 0.07 * brk - 0.03 * hitch + 0.09 * firm - 0.1 * sink, expr: 'cry', talk: true, lightDir: L.key, shade: L.shade, rim: 1.1, faceLift: L.lift,
        eyes: { open: lerp(0.55, 0.32, brk) + 0.1 * firm - 0.15 * sink, squeeze: 0.3 + 0.45 * brk, sad: 0.65, tears: 0.45 + 0.47 * smooth(0.5, 4.3, u), look: [0.3, 0.6] },
        brows: { inner: 0.7 + 0.3 * brk, outer: -0.3, furrow: 0.55 + 0.3 * brk - 0.1 * firm },
        mouth: { shape: 'frown', open: 0, tremble: 0.25 + 0.6 * brk }, blush: 0.4 },
    };
  }
  C39.boyX = 526; C39.boyY = 2966; C39.boyS = 400;
  C39.light = { key: -2.55, shade: 0.5, lift: 0.32 };
  C39.yaw = 0.72;
  // a second, cool rim from the streetlight: the band of the layer's own silhouette on the light side (union minus the union
  // shifted away from the light), tinted, laid inside the figure (source-atop).  box = the region the cel covers.
  function silRim(c, box, dir, w, col, alpha, key, fall) {
    const B = PV.buffer('g10:silrim:' + key), b = B.ctx, dx = Math.cos(dir) * w, dy = Math.sin(dir) * w;
    b.save(); b.setTransform(1, 0, 0, 1, 0, 0); b.beginPath(); b.rect(box.x, box.y, box.w, box.h); b.clip();
    b.globalCompositeOperation = 'copy'; b.drawImage(c.canvas, 0, 0);
    b.globalCompositeOperation = 'destination-out'; b.drawImage(c.canvas, -dx, -dy);
    b.globalCompositeOperation = 'source-in'; b.fillStyle = col; b.fillRect(box.x, box.y, box.w, box.h);
    if (fall) {   // the light falls off away from its source (fall = {x, y, r0, r1, min})
      const g = b.createRadialGradient(fall.x, fall.y, fall.r0, fall.x, fall.y, fall.r1); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, `rgba(0,0,0,${fall.min})`);
      b.globalCompositeOperation = 'destination-in'; b.fillStyle = g; b.fillRect(box.x, box.y, box.w, box.h);
    }
    b.restore();
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = alpha;
    c.drawImage(B.canvas, box.x, box.y, box.w, box.h, box.x, box.y, box.w, box.h); c.restore();
  }

  // light inside his cel: the darkness of the room takes the body below the face (the lamp and the window reach the head),
  // and her lamp's warm bounce creeps onto the front of his face — a soft fill so the face reads in the window's shade
  function c39boyLight(c, box, hd) {
    const e = hd.eyeL, ch = hd.chin, n = hd.nose, fx = (e[0] + ch[0]) / 2, fy = (e[1] + ch[1]) / 2;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
    let g = c.createRadialGradient(fx, fy, 170, fx, fy, 760); g.addColorStop(0, 'rgba(9,10,17,0)'); g.addColorStop(1, 'rgba(9,10,17,0.62)');
    c.fillStyle = g; c.fillRect(box.x, box.y, box.w, box.h);
    const bx = n[0] + 40, by = n[1] - 10;
    g = c.createRadialGradient(bx, by, 0, bx, by, 230); g.addColorStop(0, 'rgba(255,206,150,0.2)'); g.addColorStop(0.55, 'rgba(255,206,150,0.08)'); g.addColorStop(1, 'rgba(255,206,150,0)');
    c.fillStyle = g; c.fillRect(bx - 230, by - 230, 460, 460);
    c.restore();
  }
  // where his tear stream ends on the jaw (the library draws the stream; the drop that falls from it is drawn here)
  const c39tearEnd = (hd) => [hd.chin[0] + 0.12 * (hd.eyeL[0] - hd.chin[0]) + 0.15 * (hd.mouth[0] - hd.chin[0]), hd.chin[1] + 0.12 * (hd.eyeL[1] - hd.chin[1]) + 0.15 * (hd.mouth[1] - hd.chin[1])];

  // her, across the table, seated, facing him (a 3/4 toward the camera's left), lit from behind by her lamp.  u = local time
  // on twos.  From 5.1 she holds it in (lips pressed, shoulders trembling); at 6.0 she gives way: she folds forward and her
  // left hand comes up over her face; then she sobs.
  function c39herArgs(u) {
    const brk = ease.outCubic(smooth(6.0, 6.45, u)), hold = smooth(5.1, 5.7, u) * (1 - smooth(6.0, 6.2, u));
    const sob = smooth(6.3, 6.6, u) * 0.5 * (1 + Math.sin(u * 13.5)) + hold * 0.5 * (1 + Math.sin(u * 21.0));
    const hu = ease.inOutCubic(smooth(6.02, 6.48, u));                       // the hand rises to her face
    const slump = 0.2 * brk + 0.02 * sob;
    // the wrist: on the table edge in front of her (gripping her right wrist, as in C37/C38) -> just below her eyes (the 'cover'
    // arm of the library: the wrist under the eye, the hand up over the brow); her eye comes forward and down as she folds
    const W0 = [0.02, -0.34, 0.72], W1 = [0.05, -2.64 + 1.0 * slump, 0.035 + 1.9 * slump];
    const WL = [lerp(W0[0], W1[0], hu), lerp(W0[1], W1[1], hu) - 0.2 * Math.sin(Math.PI * hu), lerp(W0[2], W1[2], hu) + 0.3 * Math.sin(Math.PI * hu)];
    const handL = hu < 0.5 ? { f: [-0.3, 0.2, 1], palm: [0, 1, 0], curl: 0.45 } : { f: [-0.5, -1, 0.1], palm: [0, 0, -1], curl: 0.25, spread: 0.2 };
    return {
      who: 'senpai', outfit: 'home', pose: 'sit_ground', facing: -0.72, camPitch: 0.04,
      x: C39.herX, y: C39.herY + 3 * sob, scale: C39.herS, T: C39.T0 + u, light: 'lamp', rimDir: 0.55, keyDir: 0.55,
      params: { sofa: true, knees: 'down', arms: 'lap', slump, nod: 0.1 + 0.25 * brk, tilt: 0.06 - 0.1 * brk, look: -0.25 * (1 - brk),
        armL: { W: WL, pole: [1, 0.6, -0.2], hand: handL } },
      head: { expr: brk > 0.3 ? 'cry' : 'teary', undereye: 0.3, lightDir: 0.6, shade: 0.5, faceLift: 0.5, rim: 1.0,
        eyes: brk > 0.3 ? { tears: 1 } : { tears: 0.55 + 0.2 * hold, open: 0.9 - 0.3 * hold, look: [-0.5, 0.1] },
        mouth: brk > 0.3 ? { shape: 'frown', open: 0.6 } : { shape: 'frown', open: 0.08 * (1 - hold), tremble: hold },
        brows: { inner: 0.7 + 0.3 * Math.max(hold, brk), outer: -0.25, furrow: 0.3 + 0.5 * Math.max(hold, brk) } },
    };
  }
  C39.herX = 1470; C39.herY = 900; C39.herS = 120;

  PV.shot('C39', {
    draw(ctx, t, d, S) {
      const tc = clamp(t, 0, d), tq = q12(tc);
      const push = ease.sine(tc / d);
      // ---- background (window, streetlight, her lamp), slower than the foreground (parallax)
      ctx.save();
      PV.camera(ctx, { zoom: 1 + 0.014 * push, cx: 820, cy: 430 });
      ctx.imageSmoothingQuality = 'low'; ctx.drawImage(c39bg(), -60, -40);
      // the streetlight breathes; a car passes far below (a pale sweep across the glass)
      ctx.globalCompositeOperation = 'screen'; spriteGlow(ctx, 548, 250, 380 + 10 * Math.sin(tc * 1.3), '#dfe9ff', 0.12 + 0.02 * N2(tc * 0.8, 2.2)); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      const car = smooth(1.2, 4.6, tc);
      if (car > 0 && car < 1) { ctx.save(); ctx.globalCompositeOperation = 'screen'; const cxp = lerp(-200, 1250, car); const g = ctx.createRadialGradient(cxp, 640, 0, cxp, 640, 260); g.addColorStop(0, `rgba(255,236,200,${0.1 * Math.sin(Math.PI * car)})`); g.addColorStop(1, 'rgba(255,236,200,0)'); ctx.fillStyle = g; ctx.fillRect(cxp - 260, 380, 520, 520); ctx.restore(); }
      // motes in the window light
      L.dust(ctx, t, { seed: 391, count: 50, x0: 380, y0: 120, x1: 1500, y1: 900, size: 2.0, alpha: 0.3, color: '#dfe9ff', drift: 50, vx: 4, vy: -2 });

      // ---- her, deep in the bokeh: still until she starts to hold it in (5.1), then on twos
      const HER = held('C39her', tq < 5.05 ? 'still' : tq, (c) => {
        lowResBlur(c, 'C39her', 0.5, 4, (cc) => {
          PV.anime.figure(cc, c39herArgs(tq < 5.05 ? 0 : tq));
          // the table top in front of her (it hides her below the chest), the lamp's pool on it, the lamp's foot
          cc.fillStyle = PV.linGrad(cc, 0, 790, 0, H + 40, [[0, '#231d17'], [1, '#100d0b']]); cc.fillRect(1156, 789, W, 400);
          cc.fillStyle = 'rgba(232,184,120,0.22)'; cc.fillRect(1156, 787, W, 3);
          { const g = cc.createRadialGradient(C39LAMP.x, 800, 10, C39LAMP.x, 800, 420); g.addColorStop(0, 'rgba(255,214,150,0.32)'); g.addColorStop(1, 'rgba(255,214,150,0)');
            cc.save(); cc.beginPath(); cc.rect(1156, 789, W, 400); cc.clip(); cc.translate(0, 800); cc.scale(1, 0.25); cc.translate(0, -800); cc.fillStyle = g; cc.fillRect(1156, 380, W, 840); cc.restore(); }
          cc.fillStyle = '#2a211a'; cc.beginPath(); cc.ellipse(C39LAMP.x, 792, 46, 8, 0, 0, TAU); cc.fill();
        });
        return { x: 1100, y: 200, w: W - 1100, h: H - 200 };
      });
      layHeld(ctx, HER);
      ctx.restore();

      // ---- him: the bowed profile on twos (layout space; the camera is applied when it is laid in)
      ctx.save();
      PV.camera(ctx, { zoom: 1 + 0.032 * push, cx: 860, cy: 470 });
      const HIM = held('C39him', tq, (c) => {
        C39.boyInfo = PV.anime.figure(c, c39boyArgs(tq));
        const box = { x: 0, y: 0, w: 1400, h: H };
        c39boyLight(c, box, C39.boyInfo.head);
        silRim(c, box, -2.3, 4, '#d4e0ff', 0.5, 'C39', { x: 548, y: 250, r0: 200, r1: 900, min: 0.1 });
        return box;
      });
      layHeld(ctx, HIM);
      // ---- the drop: it gathers at the end of the tear on his jaw and falls at the second break (≈158.8, 24 fps)
      const hd = C39.boyInfo && C39.boyInfo.head;
      if (hd) {
        const gather = smooth(3.9, 4.6, tc), fall = smooth(4.72, 5.3, tc), e = c39tearEnd(hd);
        const da = gather * (1 - smooth(0.75, 1, fall));
        if (da > 0.01) {
          const dx = e[0] - 3 * fall, dy = e[1] + 4 + 300 * fall * fall, r = 3.2 + 1.2 * gather;
          ctx.save(); ctx.globalCompositeOperation = 'screen';
          spriteGlow(ctx, dx, dy, 18, '#e6efff', 0.3 * da * (0.8 + 0.2 * Math.sin(tc * 9)));
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = `rgba(226,238,255,${0.75 * da})`; ctx.beginPath(); ctx.ellipse(dx, dy, r * 0.8, r * (fall > 0.02 ? 1.45 : 1.1), 0.2, 0, TAU); ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${0.95 * da})`; ctx.beginPath(); ctx.arc(dx - r * 0.25, dy - r * 0.3, r * 0.32, 0, TAU); ctx.fill();
          if (fall > 0.05 && fall < 0.85) { ctx.strokeStyle = `rgba(230,240,255,${0.3 * da})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(dx, dy - 34 * fall); ctx.lineTo(dx, dy - r); ctx.stroke(); }
          ctx.restore();
        }
      }
      ctx.restore();
    },
  });

  /* ============================================================ C40 再生ボタン（もう一度） */
  // Extreme close-up: her unsteady left index finger reaches the play button and presses it at 0.2.  From the press
  // the light opens out of the button and the colour starts coming back (saturation 0.3 → 0.7 inside the cut);
  // 0.4 the recording starts again, muffled; 0.8–2.3 the sound opens — the waveform swells and turns gold, motes of
  // light rise off the glass — and the white flash carries it into the spring street (C41).
  const C40 = { phone: { x: 0, y: 0, ang: 0.12 } };
  C40.btn = phonePt(C40.phone, PLAY.u, PLAY.v, 0.85);
  C40.up = phonePt(C40.phone, -10, PLAY.v - 150, 0.85);   // a point up the screen (toward the waveform)
  C40.cam = makeCam([C40.btn[0] + 1.5, C40.btn[1] - 7.5, 25], [C40.up[0], C40.up[1], 0], 2300);
  C40.set = () => PV.cached('g10:C40:set', W, H, (c) => {
    const cam = C40.cam, ph = C40.phone;
    c.drawImage(C40.table(), 0, 0);
    softShadow(c, 'C40ph', (cc) => { const pts = phoneOutline(ph, 14).map(p => cam.P(p[0] + 0.42, p[1] - 0.34, 0)); cc.moveTo(pts[0].x, pts[0].y); for (const q of pts) cc.lineTo(q.x, q.y); cc.closePath(); }, 22, 0.45);
    c.fillStyle = 'rgba(0,0,0,0.3)'; worldPoly(c, cam, phoneOutline(ph, 2).map(p => [p[0] + 0.06, p[1] - 0.05, 0])); c.fill();
    phoneSides(c, cam, ph, 0.06, 0.85, '#1d1e23');
  });
  C40.table = () => tableImage('g10:C40:table3', C40.cam, { lamp: [-26, 30, 34], power: 3400, exposure: 1.8, focus: 26, dofRange: 10, dofNear: 0.5, dofBlur: 7, spec: 0.1, coneOut: 0.25, coneIn: 0.85, grain: 0.35 });

  PV.shot('C40', {
    draw(ctx, t, d) {
      const tc = clamp(t, 0, d), hk = q12(tc), cam = C40.cam, ph = C40.phone;
      // the hand's drawings change one frame after the phone's (each frame repaints at most one cel)
      const hkH = Math.max(0, Math.floor((tc - 1 / 24) * 12 + 1e-6) / 12);
      const tapT = 0.2, pressed = tc >= tapT, pressedK = hk >= tapT;
      const open = smooth(0.8, 2.3, tc), openK = smooth(0.8, 2.3, hk);      // the sound (and the light) opening up
      // colour returns inside the cut: saturation 0.3 → 0.7 from the press (grade is not set on this shot); the cels carry it
      const satOf = (u) => lerp(0.3, 0.7, ease.inOutCubic(smooth(0.2, 2.5, u))), sat = satOf(tc);
      const bs = cam.P(C40.btn[0], C40.btn[1], C40.btn[2]);
      // ---- the cel on twos: the table, the phone (the recording restarts at 0.4), the press ripple on the glass, and her
      // left hand — index finger extended, the rest folded; trembling before the press, steadier after.  The hand is drawn
      // through a depth of field: sharp at the fingertip, soft toward the knuckles (nearer the lens).
      const CEL = held('C40', hk, (c) => {
        c.drawImage(C40.set(), 0, 0);
        const st = { pos: Math.max(0, hk - 0.4), playing: pressedK, tap: pressedK ? hk - tapT : null, clock: '23:49', bloom: openK, light: 0.35 * openK };
        drawPhone(c, hk, planeFrame(cam, ph.x, ph.y, 0.85, ph.ang, PH_UNIT), st, { cacheScale: 2.2, res: 1, uiRes: 2.2, uiKey: 'C40' });
        satRegion(c, satOf(hk), null);
        const tapK = pressedK ? hk - tapT : -1;
        if (pressedK && tapK < 0.9) {         // the press ripple stays on the glass
          c.save();
          const sc0 = cam.P(...phonePt(ph, SCR.x, SCR.y, 0.85)), sc1 = cam.P(...phonePt(ph, SCR.x + SCR.w, SCR.y, 0.85)), sc2 = cam.P(...phonePt(ph, SCR.x + SCR.w, SCR.y + SCR.h, 0.85)), sc3 = cam.P(...phonePt(ph, SCR.x, SCR.y + SCR.h, 0.85));
          c.beginPath(); c.moveTo(sc0.x, sc0.y); c.lineTo(sc1.x, sc1.y); c.lineTo(sc2.x, sc2.y); c.lineTo(sc3.x, sc3.y); c.closePath(); c.clip();
          const u = tapK / 0.9, rr = 70 + 380 * ease.outCubic(u); c.globalCompositeOperation = 'screen'; c.strokeStyle = `rgba(255,240,215,${0.45 * (1 - u)})`; c.lineWidth = 2 + 8 * (1 - u); c.beginPath(); c.ellipse(bs.x, bs.y, rr, rr * 0.9, -0.1, 0, TAU); c.stroke();
          c.restore();
        }
        const lift = pressedK ? 0.5 * smooth(0.32, 1.4, hk) + 0.9 * smooth(1.2, 2.4, hk) : 0;
        // the fingertip comes in from above-right, hesitating (a dip back at 0.08), then presses at 0.2
        const reach = ease.inOutCubic(smooth(-0.02, 0.2, hk)) - 0.12 * Math.sin(Math.PI * smooth(0.03, 0.14, hk));
        const trem = lerp(1.0, 0.25, smooth(0.25, 1.6, hk));
        const jx = trem * (7 * N2(hk * 8.7, 1.3) + 3 * N2(hk * 21, 4.1)), jy = trem * (5 * N2(2.2, hk * 9.3));
        const tip = cam.P(C40.btn[0] + (1 - reach) * 3.4, C40.btn[1] + (1 - reach) * 1.2, 0.85 + 0.35 + lift + (1 - reach) * 2.0);
        // her colours carry the cut's saturation (the phone under her is already desaturated)
        const sk = satOf(hk), dz = (h) => desat(h, sk);
        const key = PV.mix('#b89a80', '#ffe2b8', openK).replace(/rgba\((\d+),(\d+),(\d+),[^)]*\)/, (m, r, g, b) => '#' + [r, g, b].map(v => (+v).toString(16).padStart(2, '0')).join(''));
        const hand = rigAt(c, Object.assign({ side: 'L', kind: 'her', view: 'back', pitch: -0.5, yaw: -0.2, rot: Math.PI + 1.12,
          scale: tip.k * 17 / 195, curl: [0.62, 0.04 + 0.05 * trem, 0.95, 1.0, 1.0], spread: 0.06, thumb: { abd: 0.3, opp: 0.9, flex: [0.3, 0.5] }, arm: 60,
          t: hk, tremble: 0.6 * trem, seed: 17, light: -1.0, skin: dz('#f3d3bf'), shade: dz('#d9a38e'), hi: dz('#fff1e6'), line: dz('#6b3f33'), nail: dz('#fbe4dc'), nailLine: dz('#b07264'), blush: dz('#ef9a8a') },
          { keyColor: dz(key), fillColor: dz('#4a3e58'), tint: 0.75 }),
          { x: tip.x + jx, y: tip.y + jy }, padOf(1));
        rigShadows(c, [{ rig: hand, dx: 18 + lift * 26, dy: 16 + lift * 22, blur: 10 + lift * 10, alpha: 0.45 * (1 - 0.6 * openK), arm: 400 }], true);
        const slv = knitSleeve(hand, { y0: 50, y1: 520, light: -1.0, seed: 17, col: { base: dz('#8a7a6a'), shade: dz('#62554a'), hi: dz('#b09a82'), line: dz('#3a2f28'), bounce: dz('#715f52') } });
        const HL = handsLayer(c, 'C40', [{ rig: hand, sleeve: slv }], null);
        const pd = L._handPadPoint(hand, 1); C40.pad = { x: pd.x, y: pd.y };
        if (HL) {
          const px = pd.x, py = pd.y;
          const { canvas: hc, box } = HL, f = 0.25, sw = Math.ceil(box.w * f), sh = Math.ceil(box.h * f);
          const B = PV.buffer('g10:C40:dof', 490, 280), bc = B.ctx;
          bc.setTransform(1, 0, 0, 1, 0, 0); bc.clearRect(0, 0, sw + 4, sh + 4); bc.filter = 'blur(1.6px)'; bc.drawImage(hc, box.x, box.y, box.w, box.h, 0, 0, sw, sh); bc.filter = 'none';
          // far (sharp) part keeps a disc round the fingertip; the blurred copy fills the rest
          const g1 = bc.createRadialGradient((px - box.x) * f, (py - box.y) * f, 160 * f, (px - box.x) * f, (py - box.y) * f, 520 * f);
          g1.addColorStop(0, 'rgba(0,0,0,0)'); g1.addColorStop(1, 'rgba(0,0,0,1)');
          bc.globalCompositeOperation = 'destination-in'; bc.fillStyle = g1; bc.fillRect(0, 0, sw + 4, sh + 4); bc.globalCompositeOperation = 'source-over';
          // (1-m)·sharp + m·blurred, summed in premultiplied space ('lighter'): opaque where the hand is
          const hctx = hc.getContext('2d'); hctx.save(); hctx.setTransform(1, 0, 0, 1, 0, 0);
          const g2 = hctx.createRadialGradient(px, py, 160, px, py, 520); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)');
          hctx.globalCompositeOperation = 'destination-out'; hctx.fillStyle = g2; hctx.fillRect(box.x, box.y, box.w, box.h);
          hctx.globalCompositeOperation = 'lighter'; hctx.imageSmoothingQuality = 'medium'; hctx.drawImage(B.canvas, 0, 0, sw, sh, box.x, box.y, box.w, box.h); hctx.restore();
          blitBox(c, HL);
        }
      });
      // ---- camera: a slow push onto the button; the cel; the light opening out of the button over it
      ctx.save();
      const push = ease.inOutCubic(smooth(0.25, d, tc));
      PV.camera(ctx, { zoom: 1 + 0.07 * push, cx: bs.x, cy: bs.y });
      ctx.imageSmoothingQuality = 'low'; ctx.drawImage(CEL.canvas, 0, 0);
      // the phone's cool spill, then the light opening out of the button (one quarter-res pass, composited where it reaches)
      const tap = pressed ? tc - tapT : -1, flood = smooth(1.9, 2.55, tc);
      const sq = Math.round(sat * 20) / 20, warm = desat('#ffd9a0', sq), cool = desat('#5f7fae', sq), hot = desat('#fff3e0', sq), mote = desat('#ffe3b0', sq);
      let reachR = 900;
      if (pressed) { reachR = Math.max(reachR, 260 + 760 * open); for (let i = 0; i < 3; i++) { const ph0 = tc - 0.8 - i * 0.5; if (ph0 >= 0) reachR = Math.max(reachR, 120 + 1100 * ease.outCubic(clamp(ph0 / 1.5))); } if (flood > 0) reachR = Math.max(reachR, 900 + 1500 * flood); }
      lightPass(ctx, 'C40', (c) => {
        spriteGlow(c, bs.x, bs.y - 120, 900, cool, 0.22);
        if (pressed) {
          const k = smooth(0, 0.25, tap) * (0.55 + 0.45 * open);
          spriteGlow(c, bs.x, bs.y, 260 + 760 * open, warm, 0.32 * k + 0.3 * open);
          spriteGlow(c, bs.x, bs.y, 120 + 90 * open, hot, 0.45 * k);
          for (let i = 0; i < 3; i++) {
            const ph0 = tc - 0.8 - i * 0.5; if (ph0 < 0) continue; const u = clamp(ph0 / 1.5), rr = 120 + 1100 * ease.outCubic(u), al = Math.sin(Math.PI * u) * 0.2 * open;
            if (al > 0.004) { c.globalAlpha = al; c.drawImage(ringSprite(), bs.x - rr, bs.y - rr * 0.9, rr * 2, rr * 1.8); }
          }
          if (flood > 0) spriteGlow(c, bs.x, bs.y, 900 + 1500 * flood, '#fff1d6', 0.6 * flood);
        }
        c.globalAlpha = 1;
      }, null, { x: bs.x, y: bs.y - 60, r: reachR + 60 });
      // the screen light on the finger pad (warm, from below)
      const pad = C40.pad || bs;
      ctx.globalCompositeOperation = 'screen'; spriteGlow(ctx, pad.x, pad.y + 6, 150 + 90 * open, warm, (pressed ? 0.3 : 0.1) + 0.32 * open); ctx.globalAlpha = 1;
      // ---- motes of light rising off the glass as the sound opens (the particles that fill the street in C41)
      if (open > 0) {
        const r = PV.rng(4040);
        for (let i = 0; i < 70; i++) {
          const born = 0.8 + r() * 1.4, life = 1.2 + r() * 1.0, u = (tc - born) / life; if (u <= 0 || u >= 1) { r(); r(); r(); continue; }
          const ang = r() * TAU, sp = 240 + r() * 520, sz = 2 + r() * 5;
          const x = bs.x + Math.cos(ang) * sp * ease.outCubic(u) + 30 * N2(i, tc), y = bs.y + Math.sin(ang) * sp * 0.8 * ease.outCubic(u) - 160 * u;
          const a = Math.sin(Math.PI * u) * 0.8;
          spriteGlow(ctx, x, y, sz * 4, i % 3 ? mote : '#fff6e8', a * 0.75);
        }
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      // ---- the room warms as the sound opens
      if (open > 0.01) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.08 * open; ctx.fillStyle = desat('#ffe9c8', sq); ctx.fillRect(0, 0, W, H); ctx.restore(); }
    },
  });

})();

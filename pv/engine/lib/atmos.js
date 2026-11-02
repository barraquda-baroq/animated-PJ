/* Atmospherics & background-art helpers (anime background painting style).
 * All functions are deterministic in (time, seed).  Namespace: PV.lib
 */
(function () {
  'use strict';
  const PV = window.PV; const L = (PV.lib = PV.lib || {});
  const W = PV.W, H = PV.H, TAU = Math.PI * 2;

  /* ---------------------------------------------------------------- sky */
  // stops: [[pos,'#hex'],...] top->bottom
  L.sky = function (ctx, stops, y0 = 0, y1 = H) {
    ctx.fillStyle = PV.linGrad(ctx, 0, y0, 0, y1, stops); ctx.fillRect(0, 0, W, H);
  };

  /* -------------------------------------------------------------- clouds */
  // Builds one cumulus cloud sprite (cached).  opts: w,h,seed,lit,mid,shadow,rim,light (angle of light, rad; -PI/2 = from top)
  L.cloudSprite = function (key, o) {
    const w = o.w || 600, h = o.h || 260;
    return PV.cached('cloud:' + key, w + 120, h + 120, (c) => {
      const r = PV.rng(o.seed || 1); c.translate(60, 60);
      const lightA = o.light === undefined ? -2.2 : o.light; const lx = Math.cos(lightA), ly = Math.sin(lightA);
      // 2-4 heaps (towers) of billows standing on a flat base
      const heaps = 2 + Math.floor(r() * 3); const blobs = [];
      for (let k = 0; k < heaps; k++) {
        const cx = w * (0.18 + 0.64 * (heaps === 1 ? 0.5 : k / (heaps - 1))) + (r() - 0.5) * w * 0.12;
        const hh = h * (0.45 + 0.55 * r()) * (k === Math.floor(heaps / 2) ? 1.0 : 0.8);
        const hw = w * (0.22 + 0.14 * r());
        const n = 14 + Math.floor(r() * 10);
        for (let i = 0; i < n; i++) {
          const u = r(); const yy = h - u * hh; const spread = hw * (1 - 0.55 * u);
          const x = cx + (r() - 0.5) * 2 * spread * 0.8; const rad = (0.10 + 0.16 * r()) * h * (1 - 0.35 * u) * (o.puff || 1) + 6;
          blobs.push({ x, y: yy - rad * 0.2, rad });
        }
      }
      // base row
      for (let i = 0; i < 12; i++) { const x = w * (0.06 + 0.88 * i / 11) + (r() - 0.5) * 20; const rad = h * (0.12 + 0.08 * r()); blobs.push({ x, y: h - rad * 0.6, rad }); }
      const flatY = h * 0.985;
      c.save(); c.beginPath(); c.rect(-60, -60, w + 120, flatY + 60); c.clip();
      // 1) shadow silhouette
      c.fillStyle = o.shadow || '#9aa7c7';
      for (const b of blobs) { c.beginPath(); c.arc(b.x, b.y, b.rad, 0, TAU); c.fill(); }
      // 2) billows: back-to-front (lower first), each with a lit cap offset toward the light
      blobs.sort((a, b) => b.y - a.y);
      for (const b of blobs) {
        const k = 1 - PV.clamp((b.y) / h); // higher billows catch more light
        const capR = b.rad * 0.96, ox = b.x + lx * b.rad * 0.16, oy = b.y + ly * b.rad * 0.16;
        const g = c.createRadialGradient(b.x + lx * b.rad * 0.5, b.y + ly * b.rad * 0.5, b.rad * 0.05, ox, oy, capR);
        g.addColorStop(0, o.lit || '#ffffff'); g.addColorStop(0.45 + 0.2 * (1 - k), o.mid || '#e9eef8'); g.addColorStop(1, PV.rgba(o.mid || '#e9eef8', 0));
        c.fillStyle = g; c.beginPath(); c.arc(ox, oy, capR, 0, TAU); c.fill();
        // soft occlusion crescent on the shadow side to separate billows
        const g2 = c.createRadialGradient(b.x - lx * b.rad * 0.55, b.y - ly * b.rad * 0.55, b.rad * 0.2, b.x - lx * b.rad * 0.4, b.y - ly * b.rad * 0.4, b.rad * 0.9);
        g2.addColorStop(0, PV.rgba(o.shadow || '#9aa7c7', 0.35)); g2.addColorStop(1, PV.rgba(o.shadow || '#9aa7c7', 0));
        c.fillStyle = g2; c.beginPath(); c.arc(b.x, b.y, b.rad, 0, TAU); c.fill();
      }
      // 3) bottom shading band
      c.globalCompositeOperation = 'source-atop';
      const gb = c.createLinearGradient(0, h * 0.5, 0, flatY);
      gb.addColorStop(0, PV.rgba(o.shadow || '#9aa7c7', 0)); gb.addColorStop(1, PV.rgba(o.shadow || '#9aa7c7', 0.9));
      c.fillStyle = gb; c.fillRect(-60, -60, w + 120, h + 120);
      // 4) warm rim on the lit side
      if (o.rim) { const gr = c.createLinearGradient(lx * w * 0.5 + w / 2, ly * h + h / 2, w / 2, h / 2); gr.addColorStop(0, PV.rgba(o.rim, 0.5)); gr.addColorStop(0.5, PV.rgba(o.rim, 0)); c.fillStyle = gr; c.fillRect(-60, -60, w + 120, h + 120); }
      c.restore();
    });
  };
  // a drifting field of clouds. o: seed,count,y0,y1,minW,maxW,speed,alpha,colors{lit,mid,shadow,rim},scale
  L.clouds = function (ctx, t, o) {
    const r = PV.rng(o.seed || 7); const n = o.count || 6;
    for (let i = 0; i < n; i++) {
      const w = PV.lerp(o.minW || 300, o.maxW || 900, r()); const h = w * PV.lerp(0.32, 0.5, r());
      const spr = L.cloudSprite(`${o.seed}-${i}-${Math.round(w)}`, Object.assign({ w, h, seed: (o.seed || 7) * 100 + i }, o.colors || {}));
      const y = PV.lerp(o.y0 || 80, o.y1 || 500, r());
      const span = W + w + 200; const x = ((r() * span + t * (o.speed || 6) * (0.6 + 0.8 * r())) % span) - w - 100;
      ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * (0.75 + 0.25 * r());
      const s = o.scale || 1; ctx.drawImage(spr, x, y, spr.width * s, spr.height * s);
    }
    ctx.globalAlpha = 1;
  };
  // thin streaky cirrus / haze bands
  L.haze = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 3);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < (o.count || 7); i++) {
      const y = PV.lerp(o.y0 || 100, o.y1 || 450, r()), w = PV.lerp(400, 1400, r()), h = PV.lerp(8, 40, r());
      const x = ((r() * (W + w) + t * (o.speed || 4)) % (W + w)) - w;
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, PV.rgba(o.color || '#ffffff', 0)); g.addColorStop(0.5, PV.rgba(o.color || '#ffffff', (o.alpha || 0.25) * (0.5 + r() * 0.5))); g.addColorStop(1, PV.rgba(o.color || '#ffffff', 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + w / 2, y, w / 2, h, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  /* -------------------------------------------------------- light & glow */
  L.glow = function (ctx, x, y, r, color = '#fff6e0', a = 0.8, mode = 'screen') {
    ctx.save(); ctx.globalCompositeOperation = mode;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, PV.rgba(color, a)); g.addColorStop(0.25, PV.rgba(color, a * 0.45)); g.addColorStop(1, PV.rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  };
  // god rays / light shafts from a point (e.g. a window). o: x,y,angle (rad, direction of rays),spread,count,length,width,color,alpha,seed
  L.godRays = function (ctx, t, o) {
    const r = PV.rng(o.seed || 5); ctx.save(); ctx.globalCompositeOperation = o.mode || 'screen';
    for (let i = 0; i < (o.count || 7); i++) {
      const a = o.angle + (r() - 0.5) * (o.spread || 0.5);
      const len = (o.length || 1400) * (0.7 + 0.5 * r()); const w0 = (o.width || 120) * (0.4 + r()), w1 = w0 * (o.flare || 2.4);
      const flick = 0.65 + 0.35 * (0.5 + 0.5 * PV.noise2(i * 3.1, t * (o.flicker || 0.25)));
      const al = (o.alpha || 0.22) * flick * (0.5 + 0.5 * r());
      const ox = o.x + Math.cos(a + Math.PI / 2) * (r() - 0.5) * (o.jitter || 200), oy = o.y + Math.sin(a + Math.PI / 2) * (r() - 0.5) * (o.jitter || 200);
      const ex = ox + Math.cos(a) * len, ey = oy + Math.sin(a) * len; const nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
      const g = ctx.createLinearGradient(ox, oy, ex, ey); g.addColorStop(0, PV.rgba(o.color || '#fff4d6', al)); g.addColorStop(1, PV.rgba(o.color || '#fff4d6', 0));
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(ox + nx * w0 / 2, oy + ny * w0 / 2); ctx.lineTo(ex + nx * w1 / 2, ey + ny * w1 / 2); ctx.lineTo(ex - nx * w1 / 2, ey - ny * w1 / 2); ctx.lineTo(ox - nx * w0 / 2, oy - ny * w0 / 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };
  // floating dust motes / pollen in light. o: seed,count,x0,y0,x1,y1,color,size,alpha,drift
  L.dust = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 11); ctx.save(); ctx.globalCompositeOperation = 'screen';
    const x0 = o.x0 || 0, y0 = o.y0 || 0, x1 = o.x1 || W, y1 = o.y1 || H;
    for (let i = 0; i < (o.count || 80); i++) {
      const bx = PV.lerp(x0, x1, r()), by = PV.lerp(y0, y1, r()), ph = r() * 100, sz = (o.size || 3) * (0.3 + r() * 1.2);
      const x = bx + PV.noise2(ph, t * 0.08) * (o.drift || 60) + t * (o.vx || 4); const y = by + PV.noise2(ph + 50, t * 0.08) * (o.drift || 60) + t * (o.vy || -3);
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * (1 + r() * 2) + ph));
      const a = (o.alpha || 0.7) * tw * (o.mask ? o.mask(x, y) : 1); if (a < 0.01) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, sz * 2.2); g.addColorStop(0, PV.rgba(o.color || '#fff5df', a)); g.addColorStop(1, PV.rgba(o.color || '#fff5df', 0));
      ctx.fillStyle = g; ctx.fillRect(x - sz * 2.2, y - sz * 2.2, sz * 4.4, sz * 4.4);
    }
    ctx.restore();
  };
  // soft bokeh discs. o: seed,count,colors[],rmin,rmax,x0,y0,x1,y1,alpha,speed
  L.bokeh = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 21); ctx.save(); ctx.globalCompositeOperation = o.mode || 'screen';
    const cols = o.colors || ['#ffd9a0', '#ffb98a', '#fff2d0'];
    for (let i = 0; i < (o.count || 40); i++) {
      const x = PV.lerp(o.x0 || 0, o.x1 || W, r()) + Math.sin(t * 0.3 + i) * (o.wobble || 6) + t * (o.vx || 0);
      const y = PV.lerp(o.y0 || 0, o.y1 || H, r()) + Math.cos(t * 0.27 + i * 1.3) * (o.wobble || 6);
      const rad = PV.lerp(o.rmin || 10, o.rmax || 50, r()); const col = cols[Math.floor(r() * cols.length)];
      const a = (o.alpha || 0.35) * (0.4 + 0.6 * r()) * (0.75 + 0.25 * Math.sin(t * 0.8 + i * 2.1));
      const g = ctx.createRadialGradient(x, y, rad * 0.55, x, y, rad);
      g.addColorStop(0, PV.rgba(col, a * 0.75)); g.addColorStop(0.85, PV.rgba(col, a)); g.addColorStop(1, PV.rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };
  // lens flare along the line from (x,y) through screen centre
  L.flare = function (ctx, x, y, k = 1, color = '#ffe6b8') {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    L.glow(ctx, x, y, 260 * k, color, 0.55 * k);
    // anamorphic streak
    const g = ctx.createLinearGradient(x - 900 * k, y, x + 900 * k, y); g.addColorStop(0, PV.rgba(color, 0)); g.addColorStop(0.5, PV.rgba(color, 0.35 * k)); g.addColorStop(1, PV.rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - 900 * k, y - 3 * k, 1800 * k, 6 * k);
    const cx = W / 2, cy = H / 2; const ghosts = [[0.35, 26, '#9fd2ff'], [0.62, 60, '#ffcf9a'], [1.25, 40, '#c8a8ff'], [1.6, 90, '#9affd8']];
    for (const [f, rad, col] of ghosts) {
      const gx = x + (cx - x) * f * 2, gy = y + (cy - y) * f * 2;
      const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad * k); gg.addColorStop(0, PV.rgba(col, 0.10 * k)); gg.addColorStop(0.7, PV.rgba(col, 0.06 * k)); gg.addColorStop(1, PV.rgba(col, 0));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, rad * k, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  /* ---------------------------------------------------------- weather */
  // rain streaks. o: seed,count,angle(rad from vertical),speed(px/s),len,color,alpha,width,x0..y1, depth layers
  L.rain = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 31); const ang = o.angle === undefined ? 0.18 : o.angle; const sp = o.speed || 2200;
    const vx = Math.sin(ang) * sp, vy = Math.cos(ang) * sp; const x0 = o.x0 || -200, x1 = o.x1 || W + 200, y0 = o.y0 || -100, y1 = o.y1 || H + 100;
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < (o.count || 500); i++) {
      const depth = 0.35 + 0.65 * r(); const len = (o.len || 90) * depth; const off = r();
      const span = (y1 - y0) + len; const yy = ((off * span + t * vy * depth) % span) + y0 - len;
      const xx = PV.lerp(x0, x1, r()) + (t * vx * depth) % (x1 - x0); const x = ((xx - x0) % (x1 - x0) + (x1 - x0)) % (x1 - x0) + x0;
      const a = (o.alpha || 0.35) * depth;
      ctx.strokeStyle = PV.rgba(o.color || '#cfe3ff', a); ctx.lineWidth = (o.width || 1.6) * depth;
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x - Math.sin(ang) * len, yy - Math.cos(ang) * len); ctx.stroke();
    }
    ctx.restore();
  };
  // ground splashes (small arcs that pop). o: seed,count,y0,y1,color
  L.splashes = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 41); ctx.save(); ctx.strokeStyle = PV.rgba(o.color || '#dbe8ff', 0.5); ctx.lineWidth = 1.5;
    for (let i = 0; i < (o.count || 60); i++) {
      const per = 0.35 + r() * 0.5; const ph = r() * per; const k = ((t + ph) % per) / per;
      const x = PV.lerp(o.x0 || 0, o.x1 || W, r()), y = PV.lerp(o.y0 || H * 0.8, o.y1 || H, r());
      const rad = 4 + k * 22 * (0.5 + r()); ctx.globalAlpha = (1 - k) * 0.8;
      ctx.beginPath(); ctx.ellipse(x, y, rad, rad * 0.28, 0, Math.PI, TAU); ctx.stroke();
    }
    ctx.restore();
  };
  // branching lightning bolt (cached per seed). Draw with strength 0..1
  L.lightningPath = function (seed, x0, y0, x1, y1, rough = 0.32, depth = 7) {
    const r = PV.rng(seed); const segs = [];
    function sub(ax, ay, bx, by, d, w) {
      if (d === 0) { segs.push([ax, ay, bx, by, w]); return; }
      const mx = (ax + bx) / 2 + (r() - 0.5) * Math.hypot(bx - ax, by - ay) * rough, my = (ay + by) / 2 + (r() - 0.5) * Math.hypot(bx - ax, by - ay) * rough * 0.4;
      sub(ax, ay, mx, my, d - 1, w); sub(mx, my, bx, by, d - 1, w);
      if (d > 3 && r() < 0.35) { const bl = Math.hypot(bx - ax, by - ay) * (0.4 + r() * 0.6); const ang = Math.atan2(by - ay, bx - ax) + (r() - 0.5) * 1.6; sub(mx, my, mx + Math.cos(ang) * bl, my + Math.sin(ang) * bl, d - 2, w * 0.5); }
    }
    sub(x0, y0, x1, y1, depth, 1); return segs;
  };
  L.lightning = function (ctx, segs, strength = 1, color = '#e9f1ff') {
    if (strength <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [pass, wmul, a] of [[0, 14, 0.12], [1, 6, 0.3], [2, 2.2, 1]]) {
      ctx.strokeStyle = PV.rgba(color, a * strength); ctx.shadowColor = PV.rgba('#9fc0ff', 0.9 * strength); ctx.shadowBlur = pass === 0 ? 40 : 10;
      for (const [ax, ay, bx, by, w] of segs) { ctx.lineWidth = wmul * w; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
    }
    ctx.restore();
  };
  // sakura petals. o: seed,count,color,size,wind,fall,x0..y1
  L.petals = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 51); ctx.save();
    for (let i = 0; i < (o.count || 40); i++) {
      const sz = (o.size || 14) * (0.5 + r()); const sp = (o.fall || 60) * (0.6 + r() * 0.8); const wind = (o.wind || 80) * (0.5 + r());
      const spanY = H + 200, spanX = W + 400; const ph = r();
      const y = ((ph * spanY + t * sp) % spanY) - 100; const x = ((r() * spanX + t * wind + Math.sin(t * 1.3 + i) * 40) % spanX) - 200;
      const rot = t * (1 + r() * 2) + i, flip = Math.cos(t * (1.5 + r() * 2) + i * 0.7);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(flip, 1);
      ctx.fillStyle = PV.rgba(o.color || '#ffd6e3', (o.alpha || 0.9) * (0.6 + 0.4 * Math.abs(flip)));
      ctx.beginPath(); ctx.moveTo(0, -sz); ctx.bezierCurveTo(sz * 0.8, -sz * 0.7, sz * 0.7, sz * 0.6, 0, sz);
      ctx.bezierCurveTo(-sz * 0.7, sz * 0.6, -sz * 0.8, -sz * 0.7, 0, -sz); ctx.fill();
      ctx.fillStyle = PV.rgba('#ffffff', 0.25); ctx.beginPath(); ctx.ellipse(-sz * 0.15, -sz * 0.2, sz * 0.18, sz * 0.45, 0.3, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };

  /* ---------------------------------------------------------- sea & land */
  L.sea = function (ctx, t, o = {}) {
    const hy = o.horizonY || 560; const y1 = o.y1 || H;
    ctx.fillStyle = PV.linGrad(ctx, 0, hy, 0, y1, o.stops || [[0, '#b9d9ef'], [0.25, '#5fa3d6'], [1, '#1f5f9a']]); ctx.fillRect(0, hy, W, y1 - hy);
    // horizontal swell bands
    const r = PV.rng(o.seed || 61); ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    for (let i = 0; i < 60; i++) {
      const k = r(); const y = hy + Math.pow(k, 1.8) * (y1 - hy); const th = 1 + Math.pow(k, 2) * 10;
      const x = ((r() * W * 1.5 + t * (10 + 30 * k)) % (W * 1.5)) - W * 0.25; const w = 200 + 900 * k;
      ctx.fillStyle = PV.rgba(r() > 0.5 ? '#ffffff' : '#0b3b6b', 0.25); ctx.fillRect(x, y, w, th);
    }
    ctx.restore();
    // sparkles (sun glitter) concentrated around sx
    if (o.sparkle !== false) {
      const sx = o.sunX === undefined ? W * 0.6 : o.sunX; ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < (o.sparkles || 420); i++) {
        const k = r(); const y = hy + 2 + Math.pow(k, 1.5) * (y1 - hy);
        const spread = 60 + 520 * k; const x = sx + (r() - 0.5) * 2 * spread * (0.3 + r());
        const tw = Math.max(0, Math.sin(t * (3 + r() * 5) + r() * 50)); const a = Math.pow(tw, 6) * (o.sparkleAlpha || 0.95) * (1 - Math.abs(x - sx) / (spread * 1.3));
        if (a < 0.03) continue; const s = 1 + 3.5 * k;
        ctx.fillStyle = PV.rgba(o.sparkleColor || '#fffbe8', a); ctx.fillRect(x - s * 2, y - s * 0.35, s * 4, s * 0.7);
        if (a > 0.6) { ctx.fillRect(x - 0.6, y - s * 1.6, 1.2, s * 3.2); }
      }
      ctx.restore();
    }
  };
  // cable-stayed white bridge silhouette spanning [x0,x1] with deck at y, tower height th
  L.bridge = function (ctx, o) {
    const x0 = o.x0, x1 = o.x1, y = o.y, th = o.towerH || 160, col = o.color || '#f4f6fa', lw = o.lw || 3;
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    const towers = o.towers || [x0 + (x1 - x0) * 0.3, x0 + (x1 - x0) * 0.7];
    // deck
    ctx.fillRect(x0, y - lw * 1.4, x1 - x0, lw * 2.8);
    // piers
    for (const tx of towers) { ctx.fillRect(tx - lw * 1.5, y, lw * 3, (o.pierH || 40)); }
    // towers (A-frame approximated by tapered posts)
    for (const tx of towers) {
      ctx.beginPath(); ctx.moveTo(tx - lw * 3, y + 2); ctx.lineTo(tx - lw * 0.8, y - th); ctx.lineTo(tx + lw * 0.8, y - th); ctx.lineTo(tx + lw * 3, y + 2); ctx.closePath(); ctx.fill();
      // fan cables
      ctx.lineWidth = Math.max(0.6, lw * 0.28);
      const span = (x1 - x0) * 0.19;
      for (let k = 1; k <= (o.cables || 9); k++) {
        const f = k / (o.cables || 9); const ty = y - th * (0.55 + 0.42 * f);
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - span * f, y - lw); ctx.moveTo(tx, ty); ctx.lineTo(tx + span * f, y - lw); ctx.stroke();
      }
    }
    ctx.restore();
  };
  // city skyline with lit windows. o: seed,y (ground),hMin,hMax,color,windowColor,count,lit (0..1)
  L.skyline = function (ctx, o) {
    const r = PV.rng(o.seed || 71); ctx.save(); let x = o.x0 === undefined ? -20 : o.x0; const x1 = o.x1 || W + 20;
    while (x < x1) {
      const w = PV.lerp(o.wMin || 30, o.wMax || 110, r()), h = PV.lerp(o.hMin || 40, o.hMax || 220, Math.pow(r(), 1.6));
      ctx.fillStyle = o.color || '#1b2140'; ctx.fillRect(x, o.y - h, w, h + 2);
      if (o.lit) { for (let wy = o.y - h + 8; wy < o.y - 6; wy += 9) for (let wx = x + 5; wx < x + w - 5; wx += 8) { if (r() < o.lit) { ctx.fillStyle = PV.rgba(o.windowColor || '#ffd78a', 0.5 + 0.5 * r()); ctx.fillRect(wx, wy, 3, 4); } } }
      x += w + PV.lerp(0, 8, r());
    }
    ctx.restore();
  };
  // stars
  L.stars = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 81); ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < (o.count || 200); i++) {
      const x = r() * W, y = r() * (o.yMax || H * 0.6); const s = 0.5 + Math.pow(r(), 3) * 2.5; const tw = 0.6 + 0.4 * Math.sin(t * (0.5 + r() * 2) + i);
      ctx.fillStyle = PV.rgba('#ffffff', (o.alpha || 0.8) * tw * (0.3 + 0.7 * r())); ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  /* ---------------------------------------------------- music particles */
  // a single note glyph path (eighth note) centred at 0,0 with size s
  L.noteShape = function (ctx, s, kind = 0) {
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.3, -0.45, 0, TAU); ctx.fill();
    ctx.fillRect(s * 0.3, -s * 1.5, s * 0.09, s * 1.5);
    if (kind === 1) { ctx.beginPath(); ctx.moveTo(s * 0.39, -s * 1.5); ctx.quadraticCurveTo(s * 0.95, -s * 1.05, s * 0.75, -s * 0.55); ctx.quadraticCurveTo(s * 0.8, -s * 1.0, s * 0.39, -s * 1.15); ctx.fill(); }
  };
  // swirling "snowstorm" of notes/ice. o: seed,count,cx,cy,radius,speed,color,alpha,size,blur(streak)
  L.noteStorm = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 91); const cx = o.cx || W / 2, cy = o.cy || H / 2;
    ctx.save();
    for (let i = 0; i < (o.count || 260); i++) {
      const rad = (o.radius || 900) * Math.sqrt(r()); const a0 = r() * TAU; const w = (o.speed || 0.9) * (0.4 + 0.9 * r()) * (300 / (rad + 150));
      const a = a0 + t * w; const z = 0.3 + 0.7 * r();
      const x = cx + Math.cos(a) * rad * (o.squash || 1.6) + PV.noise2(i, t * 0.3) * 40, y = cy + Math.sin(a) * rad * 0.6 + PV.noise2(i + 9, t * 0.3) * 40 + (o.fall || 0) * t;
      const isNote = r() < (o.noteRatio === undefined ? 0.35 : o.noteRatio); const s = (o.size || 16) * z;
      const al = (o.alpha || 0.85) * z;
      ctx.fillStyle = PV.rgba(o.color || '#eef6ff', al); ctx.strokeStyle = PV.rgba(o.color || '#eef6ff', al * 0.5);
      // motion streak along tangent
      const tx = -Math.sin(a) * (o.squash || 1.6), ty = Math.cos(a) * 0.6; const sl = (o.streak || 22) * z * w * 3;
      ctx.lineWidth = Math.max(1, s * 0.12); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - tx * sl, y - ty * sl); ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.rotate(a * 0.2 + i);
      if (isNote) L.noteShape(ctx, s, i % 2); else { ctx.beginPath(); ctx.arc(0, 0, s * 0.18, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
  };

  /* ------------------------------------------------------------ misc */
  // flat colour fill helper with optional noise texture (paper / watercolor feel)
  L.paper = function (ctx, alpha = 0.06, seed = 5) {
    const tex = PV.cached('paper' + seed, 512, 512, (c) => {
      const img = c.createImageData(512, 512); const r = PV.rng(seed);
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) { const v = 128 + PV.fbm2(x / 60, y / 60, 4) * 80 + (r() - 0.5) * 30; const i = (y * 512 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      c.putImageData(img, 0, 0);
    });
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = alpha;
    for (let y = 0; y < H; y += 512) for (let x = 0; x < W; x += 512) ctx.drawImage(tex, x, y);
    ctx.restore();
  };
  // depth-of-field style blur of whatever is drawn by fn (draws into a temp buffer then back with blur)
  L.blurred = function (ctx, px, fn, key = 'blurTmp') {
    const b = PV.buffer(key); b.ctx.clearRect(0, 0, W, H); fn(b.ctx);
    ctx.save(); ctx.filter = `blur(${px}px)`; ctx.drawImage(b.canvas, 0, 0); ctx.restore();
  };
})();

/* Cinematic FX helpers: rain on glass, light leaks, the "white world", shake, focus pulls. */
(function () {
  'use strict';
  const PV = window.PV; const L = (PV.lib = PV.lib || {}); const W = PV.W, H = PV.H, TAU = Math.PI * 2;

  // Raindrops clinging to a window + trickles. Draw AFTER the (blurred) outside view.
  // o: seed, count, trickles, scale, alpha, tint (colour of what's behind, for refraction highlight)
  L.rainOnGlass = function (ctx, t, o = {}) {
    const r = PV.rng(o.seed || 101); const s = o.scale || 1; ctx.save();
    // static drops
    for (let i = 0; i < (o.count || 260); i++) {
      const x = r() * W, y = r() * H; const rad = (1.5 + Math.pow(r(), 3) * 9) * s; const life = r();
      const a = (o.alpha || 0.9) * (0.5 + 0.5 * Math.sin(t * 0.3 + i)) * 0.6 + 0.3;
      // dark rim (refraction)
      ctx.fillStyle = `rgba(10,16,30,${0.28 * a})`; ctx.beginPath(); ctx.ellipse(x, y + rad * 0.15, rad, rad * 1.08, 0, 0, TAU); ctx.fill();
      // body picks up the bright scene, upside down -> lighter bottom
      const g = ctx.createRadialGradient(x, y + rad * 0.35, rad * 0.1, x, y, rad);
      g.addColorStop(0, `rgba(255,255,255,${0.35 * a})`); g.addColorStop(0.7, PV.rgba(o.tint || '#9fb4d0', 0.25 * a)); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
      // specular
      ctx.fillStyle = `rgba(255,255,255,${0.75 * a})`; ctx.beginPath(); ctx.ellipse(x - rad * 0.35, y - rad * 0.4, rad * 0.22, rad * 0.14, -0.6, 0, TAU); ctx.fill();
    }
    // trickles: drops that slide down leaving a trail
    for (let i = 0; i < (o.trickles || 18); i++) {
      const x0 = r() * W, per = 3 + r() * 6, ph = r() * per; const k = ((t + ph) % per) / per;
      const speed = 0.4 + 0.6 * r(); const y = -40 + (H + 80) * Math.pow(k, 1.3) * speed * 1.6;
      const wob = Math.sin(y * 0.02 + i) * 6; const rad = (4 + r() * 5) * s;
      ctx.strokeStyle = `rgba(220,232,250,0.16)`; ctx.lineWidth = rad * 0.7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0 + Math.sin(i) * 3, Math.max(-40, y - 260 * speed)); ctx.quadraticCurveTo(x0 + wob, y - 80, x0 + wob, y); ctx.stroke();
      const g = ctx.createRadialGradient(x0 + wob, y + rad * 0.3, 0, x0 + wob, y, rad * 1.4);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x0 + wob, y, rad * 1.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  // warm light leak / overexposed memory edge. o: color, side ('left'|'right'|'top'), amount, seed
  L.lightLeak = function (ctx, t, o = {}) {
    const amt = o.amount === undefined ? 0.5 : o.amount; if (amt <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'screen';
    const r = PV.rng(o.seed || 7);
    for (let i = 0; i < 3; i++) {
      const side = o.side || 'left'; const ph = r() * 10;
      const x = side === 'left' ? -200 + 140 * Math.sin(t * 0.35 + ph) : side === 'right' ? W + 200 - 140 * Math.sin(t * 0.35 + ph) : W * (0.3 + 0.4 * r());
      const y = side === 'top' ? -150 : H * (0.2 + 0.6 * r()) + 120 * Math.sin(t * 0.25 + ph);
      const rad = 700 + 400 * r(); const col = [o.color || '#ff9f5a', '#ffd38a', '#ff6f6f'][i % 3];
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, PV.rgba(col, 0.55 * amt)); g.addColorStop(1, PV.rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  };

  // "真っ白な世界": everything dissolves to white except what draws after this. amount 0..1
  L.whiteWorld = function (ctx, amount, o = {}) {
    if (amount <= 0) return; ctx.save();
    ctx.fillStyle = PV.rgba(o.color || '#fbfaf7', Math.min(1, amount)); ctx.fillRect(0, 0, W, H);
    // faint grey horizon so the void has a floor
    if (o.horizon !== false) { const g = ctx.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, 'rgba(200,200,205,0)'); g.addColorStop(1, `rgba(190,190,198,${0.35 * amount})`); ctx.fillStyle = g; ctx.fillRect(0, H * 0.45, W, H * 0.55); }
    ctx.restore();
  };

  // camera shake offset (deterministic)
  L.shake = function (t, amp = 8, freq = 9, seed = 0) {
    return { x: PV.noise2(t * freq, seed + 1.3) * amp, y: PV.noise2(seed + 7.7, t * freq) * amp, rot: PV.noise2(t * freq * 0.7, seed + 3.1) * amp * 0.0008 };
  };

  // draw something with a focus blur that changes over time: fn(ctx) draws into a temp buffer
  L.focus = function (ctx, blurPx, fn, key = 'focusTmp') {
    if (blurPx < 0.3) { fn(ctx); return; }
    const b = PV.buffer(key); b.ctx.clearRect(0, 0, W, H); fn(b.ctx);
    ctx.save(); ctx.filter = `blur(${blurPx.toFixed(2)}px)`; ctx.drawImage(b.canvas, 0, 0); ctx.restore();
  };

  // soft horizontal light sweep across the frame (for title cards / transitions). p: 0..1 progress
  L.lightSweep = function (ctx, p, o = {}) {
    if (p <= 0 || p >= 1) return; ctx.save(); ctx.globalCompositeOperation = 'screen';
    const x = -600 + (W + 1200) * p; const g = ctx.createLinearGradient(x - 400, 0, x + 400, 0);
    g.addColorStop(0, 'rgba(255,240,210,0)'); g.addColorStop(0.5, PV.rgba(o.color || '#fff0d2', o.alpha || 0.45)); g.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  };

  // ink-like dark edges for flashback / memory
  L.memoryEdges = function (ctx, amount = 0.6, color = '#fff6e6') {
    ctx.save(); const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, PV.rgba(color, 0)); g.addColorStop(1, PV.rgba(color, amount)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  };

  // ECG-style thin line across the screen (for hospital transitions). beat phase from time
  L.ecgLine = function (ctx, t, o = {}) {
    const y0 = o.y || H / 2, amp = o.amp || 120, bpm = o.bpm || 70, col = o.color || '#7dffb0'; const per = 60 / bpm;
    ctx.save(); ctx.strokeStyle = PV.rgba(col, o.alpha || 0.9); ctx.lineWidth = o.width || 3; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.beginPath();
    const head = ((t * (o.speed || 520)) % (W + 200));
    for (let x = 0; x <= W; x += 3) {
      const tt = (x / (o.speed || 520)); const ph = ((tt % per) / per);
      let y = 0; if (ph > 0.42 && ph < 0.46) y = -amp * Math.sin((ph - 0.42) / 0.04 * Math.PI); else if (ph > 0.46 && ph < 0.5) y = amp * 0.35 * Math.sin((ph - 0.46) / 0.04 * Math.PI);
      else if (ph > 0.6 && ph < 0.7) y = -amp * 0.12 * Math.sin((ph - 0.6) / 0.1 * Math.PI);
      if (o.flat) y *= Math.max(0, 1 - o.flat);
      const fade = x < head ? 1 : 0.08; ctx.globalAlpha = fade;
      if (x === 0) ctx.moveTo(x, y0 + y); else ctx.lineTo(x, y0 + y);
    }
    ctx.stroke(); ctx.restore();
  };
})();

/* DOM typography layer (crisp Japanese text with real vertical writing).
 * Items come from PV.timeline.texts (absolute seconds):
 *  { type:'subtitle'|'monologue'|'copy'|'title'|'credit'|'html',
 *    text:'...', html:'...'(type html/title), start, end,
 *    style:'bottom'|'center'|'vertical_right'|'vertical_left'|'vertical_center'|'top_left',
 *    size, color, reveal (sec, per-character reveal span), x, y, weight, font, fadeIn, fadeOut, speaker }
 */
(function () {
  'use strict';
  const PV = window.PV;
  const css = `
  #text .t{position:absolute;white-space:pre;will-change:opacity,filter,transform}
  #text .sub{left:0;right:0;bottom:64px;text-align:center;font-family:'Shippori',serif;font-weight:500;font-size:44px;letter-spacing:.08em;color:#f6f2ea;
     text-shadow:0 0 14px rgba(0,0,0,.75),0 2px 3px rgba(0,0,0,.85),0 0 2px rgba(0,0,0,.9)}
  #text .sub .spk{font-size:30px;opacity:.75;margin-right:.6em;letter-spacing:.12em}
  #text .mono{font-family:'Shippori',serif;font-weight:500;font-size:52px;line-height:1.95;letter-spacing:.18em;color:#fffdf8;
     writing-mode:vertical-rl;text-orientation:mixed;text-shadow:0 0 18px rgba(0,0,0,.55),0 0 3px rgba(0,0,0,.6)}
  #text .copy{font-family:'Shippori',serif;font-weight:800;font-size:66px;letter-spacing:.24em;color:#fffdf8;text-align:center;
     text-shadow:0 0 24px rgba(0,0,0,.45),0 0 2px rgba(0,0,0,.5)}
  #text .copy.v{writing-mode:vertical-rl;text-orientation:mixed;line-height:2.0}
  #text .credit{font-family:'Shippori',serif;font-weight:500;font-size:26px;letter-spacing:.14em;color:#e9e4da;text-align:center;line-height:1.7}
  #text .ch{display:inline-block}
  `;
  const T = (PV.text = {});
  let items = [];

  function charSpans(el, text) {
    const spans = [];
    for (const ch of Array.from(text)) {
      if (ch === '\n') { el.appendChild(document.createElement('br')); continue; }
      const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; el.appendChild(s); spans.push(s);
    }
    return spans;
  }

  T.init = function () {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const root = document.getElementById('text'); root.innerHTML = '';
    items = [];
    const list = (PV.timeline && PV.timeline.texts) || [];
    for (const it of list) {
      const el = document.createElement('div'); el.classList.add('t');
      let spans = null;
      const style = it.style || 'bottom';
      if (it.type === 'subtitle') {
        el.classList.add('sub');
        el.textContent = it.text;
      } else if (it.type === 'monologue') {
        el.classList.add('mono'); spans = charSpans(el, it.text);
      } else if (it.type === 'copy') {
        el.classList.add('copy'); if (style.startsWith('vertical')) el.classList.add('v'); spans = charSpans(el, it.text);
      } else if (it.type === 'credit') {
        el.classList.add('credit'); el.innerHTML = it.html || it.text.replace(/\n/g, '<br>');
      } else { // title / html
        el.innerHTML = it.html || it.text;
      }
      if (it.size) el.style.fontSize = it.size + 'px';
      if (it.color) el.style.color = it.color;
      if (it.weight) el.style.fontWeight = it.weight;
      if (it.font) el.style.fontFamily = it.font;
      if (it.css) Object.assign(el.style, it.css);
      // placement
      if (it.type !== 'subtitle') {
        if (style === 'vertical_right') { el.style.right = (it.x !== undefined ? it.x : 210) + 'px'; el.style.top = (it.y !== undefined ? it.y : 150) + 'px'; }
        else if (style === 'vertical_left') { el.style.left = (it.x !== undefined ? it.x : 210) + 'px'; el.style.top = (it.y !== undefined ? it.y : 150) + 'px'; }
        else if (style === 'vertical_center') { el.style.left = '50%'; el.style.top = (it.y !== undefined ? it.y : 170) + 'px'; el.style.transform = 'translateX(-50%)'; }
        else if (style === 'top_left') { el.style.left = (it.x || 120) + 'px'; el.style.top = (it.y || 100) + 'px'; }
        else if (style === 'bottom') { el.style.left = '0'; el.style.right = '0'; el.style.bottom = (it.y !== undefined ? it.y : 90) + 'px'; el.style.textAlign = 'center'; }
        else if (style === 'free') { el.style.left = (it.x || 0) + 'px'; el.style.top = (it.y || 0) + 'px'; }
        else { // center
          el.style.left = '0'; el.style.right = '0'; el.style.top = '50%'; el.style.transform = 'translateY(-50%)'; el.style.textAlign = 'center';
          if (it.y !== undefined) { el.style.top = it.y + 'px'; el.style.transform = 'none'; }
        }
      }
      el.style.display = 'none';
      root.appendChild(el);
      items.push({ it, el, spans });
    }
  };

  T.update = function (time) {
    for (const o of items) {
      const it = o.it; const fi = it.fadeIn !== undefined ? it.fadeIn : (it.type === 'subtitle' ? 0.18 : 0.6);
      const fo = it.fadeOut !== undefined ? it.fadeOut : (it.type === 'subtitle' ? 0.22 : 0.7);
      if (time < it.start - 0.01 || time > it.end + 0.01) { if (o.el.style.display !== 'none') o.el.style.display = 'none'; continue; }
      o.el.style.display = '';
      const a = PV.smooth(it.start, it.start + fi, time) * (1 - PV.smooth(it.end - fo, it.end, time));
      o.el.style.opacity = a.toFixed(3);
      if (o.spans && it.reveal) {
        const n = o.spans.length, per = it.reveal / Math.max(1, n), cf = Math.max(0.25, per * 4);
        for (let k = 0; k < n; k++) {
          const s0 = it.start + k * per; const v = PV.smooth(s0, s0 + cf, time);
          o.spans[k].style.opacity = v.toFixed(3);
          o.spans[k].style.filter = v < 0.999 ? `blur(${((1 - v) * 6).toFixed(2)}px)` : 'none';
        }
      }
      if (it.type === 'copy' || it.type === 'title' || it.type === 'html') {
        const b = (1 - PV.smooth(it.start, it.start + fi * 1.4, time)) * 8 + PV.smooth(it.end - fo, it.end, time) * 6;
        o.el.style.filter = b > 0.01 ? `blur(${b.toFixed(2)}px)` : 'none';
        if (it.drift) { const p = (time - it.start) / Math.max(0.1, it.end - it.start); o.el.style.letterSpacing = (it.ls0 || 0.2) + p * it.drift + 'em'; }
      }
    }
  };
})();

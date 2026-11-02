/* Title logo & credit block styles (DOM).  Use in timeline texts as {type:'html', html: PV.titleHTML('light'|'dark'), style:'free', x:0, y:0} */
(function () {
  const PV = window.PV;
  const css = `
  .ttl{position:absolute;left:0;top:0;width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .ttl .row{display:flex;align-items:flex-end;justify-content:center;font-family:'Shippori',serif;line-height:1}
  .ttl .kimi{font-size:74px;font-weight:600;letter-spacing:.06em;margin-right:.08em;padding-bottom:22px}
  .ttl .migite{font-family:'ZenOld',serif;font-weight:900;font-size:188px;letter-spacing:.02em}
  .ttl .no{font-size:74px;font-weight:600;margin:0 .14em;padding-bottom:22px}
  .ttl .irony{font-size:124px;font-weight:800;letter-spacing:.07em;padding-bottom:6px}
  .ttl .rule{width:1180px;height:2px;margin:34px 0 22px 0}
  .ttl .en{font-family:'Cormorant',serif;font-style:italic;font-weight:500;font-size:42px;letter-spacing:.42em}
  .ttl.light{color:#17213b}
  .ttl.light .migite{background:linear-gradient(180deg,#22305a 0%,#121a33 70%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .ttl.light .rule{background:linear-gradient(90deg,rgba(176,140,74,0),rgba(176,140,74,.9) 20%,rgba(176,140,74,.9) 80%,rgba(176,140,74,0))}
  .ttl.light .en{color:#6d5a37}
  .ttl.dark{color:#fbf8f1;text-shadow:0 0 30px rgba(255,236,200,.45),0 0 2px rgba(0,0,0,.4)}
  .ttl.dark .rule{background:linear-gradient(90deg,rgba(255,228,170,0),rgba(255,228,170,.95) 20%,rgba(255,228,170,.95) 80%,rgba(255,228,170,0));box-shadow:0 0 14px rgba(255,220,160,.6)}
  .ttl.dark .en{color:#f1e3c2}
  .endcard{position:absolute;left:0;top:0;width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Shippori',serif;color:#f4efe6}
  .endcard .big{font-size:58px;font-weight:700;letter-spacing:.3em;margin-top:26px}
  .endcard .small{font-size:26px;letter-spacing:.2em;opacity:.85;margin-top:14px}
  .endcard .vv{font-size:19px;letter-spacing:.08em;opacity:.6;margin-top:46px;line-height:1.7;text-align:center}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  PV.titleHTML = function (mode = 'light') {
    return `<div class="ttl ${mode}"><div class="row"><span class="kimi">キミの</span><span class="migite">右手</span><span class="no">の</span><span class="irony">アイロニー</span></div><div class="rule"></div><div class="en">The Irony of Your Right Hand</div></div>`;
  };
})();

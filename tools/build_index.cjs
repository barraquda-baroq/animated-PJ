// Regenerates pv/index.html with every engine lib and scene script.
const fs = require('fs'), path = require('path');
const PV = path.join(__dirname, '..', 'pv');
const list = d => fs.existsSync(path.join(PV, d)) ? fs.readdirSync(path.join(PV, d)).filter(f => f.endsWith('.js')).sort().map(f => `${d}/${f}`) : [];
const libs = list('engine/lib'), scenes = list('scenes');
const fontFaces = [
  ['Shippori', 'ShipporiMincho-Regular.ttf', 400], ['Shippori', 'ShipporiMincho-Medium.ttf', 500], ['Shippori', 'ShipporiMincho-SemiBold.ttf', 600],
  ['Shippori', 'ShipporiMincho-Bold.ttf', 700], ['Shippori', 'ShipporiMincho-ExtraBold.ttf', 800],
  ['ZenOld', 'ZenOldMincho-Regular.ttf', 400], ['ZenOld', 'ZenOldMincho-Bold.ttf', 700], ['ZenOld', 'ZenOldMincho-Black.ttf', 900],
].map(([f, file, w]) => `@font-face{font-family:'${f}';src:url('fonts/${file}');font-weight:${w};font-display:block}`).join('\n');
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>PV</title>
<style>
${fontFaces}
@font-face{font-family:'Cormorant';src:url('fonts/CormorantGaramond.ttf');font-weight:300 700;font-display:block}
@font-face{font-family:'Cormorant';src:url('fonts/CormorantGaramond-Italic.ttf');font-style:italic;font-weight:300 700;font-display:block}
html,body{margin:0;padding:0;background:#000;overflow:hidden;width:1920px;height:1080px}
#stage{position:absolute;left:0;top:0;width:1920px;height:1080px}
#text{position:absolute;left:0;top:0;width:1920px;height:1080px;pointer-events:none;overflow:hidden}
</style></head><body>
<canvas id="stage" width="1920" height="1080"></canvas><div id="text"></div>
<script src="engine/core.js"></script>
<script src="engine/post.js"></script>
<script src="engine/text.js"></script>
${libs.map(f => `<script src="${f}"></script>`).join('\n')}
${scenes.map(f => `<script src="${f}"></script>`).join('\n')}
<script src="timeline.js"></script>
<script>
(function(){
  const q = new URLSearchParams(location.search);
  const TL = PV.timeline;
  if (q.get('solo')) {
    const id = q.get('solo'); const S = TL.shots.find(s => s.id === id);
    if (S) {
      const d = S.end - S.start;
      const shifted = Object.assign({}, S, { start: 0, end: d, transition_in: 'cut' });
      const texts = q.get('notext') ? [] : (TL.texts || []).filter(x => x.end > S.start && x.start < S.end).map(x => Object.assign({}, x, { start: x.start - S.start, end: x.end - S.start }));
      PV.timeline = Object.assign({}, TL, { shots: [shifted], texts });
    }
  } else if (q.get('dev')) {
    const d = parseFloat(q.get('dur') || '6');
    PV.timeline = Object.assign({}, TL, { shots: [{ id: q.get('dev'), renderer: q.get('dev'), start: 0, end: d, params: {} }], texts: [] });
  }
  PV.init(); PV.text.init();
  window.__ready = document.fonts.ready.then(() => Promise.all(Array.from(document.fonts).map(f => f.load().catch(()=>null)))).then(() => true);
})();
</script>
</body></html>`;
fs.writeFileSync(path.join(PV, 'index.html'), html);
console.log(`index.html: ${libs.length} libs, ${scenes.length} scenes`);

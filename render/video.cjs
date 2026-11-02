// Render the full timeline to JPEG frames with N parallel browser pages, then encode.
// Usage: node render/video.cjs --out /path/frames [--from 0 --to 180] [--workers 3] [--quality 92]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { start } = require('./server.cjs');
const args = process.argv.slice(2); const opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) { const k = args[i].slice(2); const v = (args[i + 1] && !args[i + 1].startsWith('--')) ? args[++i] : true; opt[k] = v; }
const FPS = 24;
(async () => {
  const out = opt.out || '/tmp/claude-0/frames'; fs.mkdirSync(out, { recursive: true });
  const workers = parseInt(opt.workers || '3'); const quality = parseInt(opt.quality || '93');
  const { srv, port } = await start();
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync'] });
  // figure out total duration from the page
  const probe = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await probe.goto(`http://127.0.0.1:${port}/index.html`); await probe.evaluate(() => window.__ready);
  const dur = await probe.evaluate(() => PV.timeline.duration || PV.timeline.shots[PV.timeline.shots.length - 1].end);
  await probe.close();
  const f0 = Math.round(parseFloat(opt.from || '0') * FPS), f1 = Math.round(parseFloat(opt.to || String(dur)) * FPS);
  const frames = []; for (let f = f0; f < f1; f++) if (opt.skipExisting ? !fs.existsSync(path.join(out, `f${String(f).padStart(5, '0')}.jpg`)) : true) frames.push(f);
  console.log(`rendering ${frames.length} frames (${f0}..${f1}) with ${workers} workers`);
  let next = 0, done = 0; const t0 = Date.now(); const errors = new Set();
  async function worker(w) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.add(e.message)); page.on('console', m => { if (m.type() === 'error') errors.add(m.text()); });
    await page.goto(`http://127.0.0.1:${port}/index.html`); await page.evaluate(() => window.__ready);
    const cdp = await page.context().newCDPSession(page);
    // interleaved assignment keeps workers busy on similar content (cache-friendly)
    while (true) {
      const i = next++; if (i >= frames.length) break; const f = frames[i];
      await page.evaluate(f => PV.renderFrame(f), f);
      const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
      fs.writeFileSync(path.join(out, `f${String(f).padStart(5, '0')}.jpg`), Buffer.from(r.data, 'base64'));
      done++;
      if (done % 120 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${frames.length}  ${(done / el).toFixed(1)} fps  eta ${((frames.length - done) / (done / el) / 60).toFixed(1)} min`); }
    }
    await page.close();
  }
  await Promise.all(Array.from({ length: workers }, (_, w) => worker(w)));
  await browser.close(); srv.close();
  if (errors.size) console.log('PAGE ERRORS:\n' + [...errors].slice(0, 20).join('\n'));
  console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
})().catch(e => { console.error(e); process.exit(1); });

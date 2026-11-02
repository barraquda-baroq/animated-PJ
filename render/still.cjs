// Render stills.  Usage:
//   node render/still.cjs --times 0,12.5,30 --out /tmp/x            (global timeline seconds)
//   node render/still.cjs --solo C05 --times 0,1,2.5 --out /tmp/x   (one shot, local seconds)
//   node render/still.cjs --dev myRenderer --dur 6 --times 0,3 --out /tmp/x
//   add --sheet to also write a contact sheet (sheet.jpg); --notext to hide text
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'); const { execFileSync } = require('child_process');
const { start } = require('./server.cjs');
const args = process.argv.slice(2); const opt = {};
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) { const k = args[i].slice(2); const v = (args[i + 1] && !args[i + 1].startsWith('--')) ? args[++i] : true; opt[k] = v; } }
(async () => {
  const out = opt.out || '/tmp/claude-0/stills'; fs.mkdirSync(out, { recursive: true });
  const times = String(opt.times || '0').split(',').map(Number);
  const { srv, port } = await start();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  let q = ''; if (opt.solo) q = `?solo=${opt.solo}`; else if (opt.dev) q = `?dev=${opt.dev}&dur=${opt.dur || 6}`;
  if (opt.notext) q += (q ? '&' : '?') + 'notext=1';
  await page.goto(`http://127.0.0.1:${port}/index.html${q}`); await page.evaluate(() => window.__ready);
  const files = [];
  for (const t of times) {
    const f = Math.round(t * 24);
    const t0 = Date.now(); await page.evaluate(f => PV.renderFrame(f), f); const dt = Date.now() - t0;
    const file = path.join(out, `${opt.solo || opt.dev || 'tl'}_${t.toFixed(2)}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 90 }); files.push(file);
    console.log(`${file}  (${dt} ms)`);
  }
  if (errors.length) console.log('PAGE ERRORS:\n' + [...new Set(errors)].join('\n'));
  await browser.close(); srv.close();
  if (opt.sheet && files.length > 1) {
    const cols = Math.min(3, files.length);
    execFileSync('bash', ['-c', `ffmpeg -loglevel error -y ${files.map(f => `-i "${f}"`).join(' ')} -filter_complex "${files.map((_, i) => `[${i}:v]scale=640:360[v${i}]`).join(';')};${files.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${files.length}:layout=${files.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join('|')}:fill=black" -frames:v 1 "${path.join(out, 'sheet.jpg')}"`]);
    console.log('sheet: ' + path.join(out, 'sheet.jpg'));
  }
})().catch(e => { console.error(e); process.exit(1); });

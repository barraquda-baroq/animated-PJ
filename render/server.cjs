// Minimal static server for the pv/ directory (avoids file:// font/CORS issues).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'pv');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css' };
function start(port = 0) {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(req.url.split('?')[0]); const p = path.join(ROOT, u === '/' ? 'index.html' : u);
      if (!p.startsWith(ROOT)) { rsp.writeHead(403); return rsp.end(); }
      fs.readFile(p, (e, data) => { if (e) { rsp.writeHead(404); return rsp.end('nf'); } rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); rsp.end(data); });
    });
    srv.listen(port, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}
module.exports = { start };

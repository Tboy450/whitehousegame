const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 5173);
const allowed = new Set(['index.html', 'style.css', 'game.js', 'game-core.js', 'game-art.js']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
http.createServer((request, response) => {
  let name;
  try { name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1) || 'index.html'; }
  catch { response.writeHead(400).end(); return; }
  const resolved = path.resolve(root, name);
  if (!resolved.startsWith(root + path.sep) || (!allowed.has(name) && !name.startsWith('assets/')) || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404).end('Not found'); return;
  }
  fs.stat(resolved, (error, stat) => {
    if (error || !stat.isFile()) { response.writeHead(404).end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(resolved)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
    if (request.method === 'HEAD') { response.end(); return; }
    fs.createReadStream(resolved).pipe(response);
  });
}).listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + port));

// Serve the website (_site/: the home page, and the browser version under /app/) on this computer only.
// It listens on the loopback address 127.0.0.1, so nothing else on the network can reach it.
//
//   npm run site              builds dist/ and _site/, then serves them at http://127.0.0.1:8080
//   node tools/serve_site.mjs [port]   serves the _site/ that's already built
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '_site');
const HOST = '127.0.0.1';
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.py': 'text/plain; charset=utf-8', '.zip': 'application/zip', '.tar': 'application/x-tar', '.whl': 'application/zip', '.data': 'application/octet-stream',
};

if (!existsSync(path.join(ROOT, 'index.html'))) {
  console.error('error: _site/ is missing. Run: npm run site (or node tools/build_desktop.mjs && node tools/build_site.mjs)');
  process.exit(1);
}

createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname); } catch { res.writeHead(400).end('Bad request'); return; }
  let file = path.join(ROOT, path.normalize(rel));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403).end('Forbidden'); return; }   // nothing outside _site/
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!rel.endsWith('/')) { res.writeHead(301, { location: rel + '/' }).end(); return; }   // /app -> /app/, so its relative links work
    file = path.join(file, 'index.html');
  }
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
}).listen(PORT, HOST, () => {
  console.log(`IntuaCode's website is running at http://${HOST}:${PORT}/ (the app is at /app/). Ctrl+C to stop.`);
});

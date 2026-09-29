// Assemble the files the desktop app ships with into dist/.
// Tauri runs this before `tauri build` / `tauri dev`.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// index.html is written without <html>/<head>; wrap it into a full document (as run.py does).
const body = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
writeFileSync(path.join(DIST, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
</head><body>
${body}
</body></html>
`);
for (const f of ['app.css', 'app.js', 'runner.js', 'lang', 'samples']) cpSync(path.join(ROOT, f), path.join(DIST, f), { recursive: true });

const optional = [
  ['pyodide', 'Python engine (run: python3 tools/fetch_pyodide.py)'],
  ['vendor', 'web reader parsers (run: npm install && npm run vendor)'],
];
for (const [dir, what] of optional) {
  if (existsSync(path.join(ROOT, dir))) cpSync(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true });
  else console.warn(`warning: ${dir}/ is missing, so the app will download the ${what.split(' (')[0]} from the internet on first use. ${what}`);
}
console.log('Desktop files ready in dist/');

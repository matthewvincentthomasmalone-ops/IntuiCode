// A big import (more than two files to read into sentences, or more than 40 KB of them) comes in as its code at once,
// and each of those files is turned into sentences in the background, in a worker (lang/convert_worker.js), so the
// window isn't held up: checked in Chrome, with the browser version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers/engine.mjs';
import { findChrome, openBrowser } from './helpers/browser.mjs';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const ORIGIN = 'http://intuacode.localhost';
function serveApp(req) {
  const url = new URL(req.url);
  if (url.origin !== ORIGIN) return { status: 404, body: '' };
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return { type: 'text/html', body: `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head><body>\n${readFileSync(path.join(ROOT, 'index.html'), 'utf8')}\n</body></html>\n` };
  }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT + path.sep) || !existsSync(file) || !statSync(file).isFile()) return { status: 404, body: '' };
  return { type: TYPES[path.extname(file)] || 'application/octet-stream', body: readFileSync(file) };
}
// four C++ files, each a class and its functions
const cpp = (n) => `class Counter${n} {
public:
    int count = 0;
    void add(int by) {
        count += by;
        if (count > 100) {
            count = 0;
        }
    }
    std::string name() const {
        return "counter ${n}";
    }
};

int total${n}(int a, int b) {
    int sum = 0;
    for (int i = a; i < b; i++) {
        sum += i;
    }
    return sum;
}
`;
// (six classes a file: enough to see the worker at it)
const many = (f) => '#include <iostream>\n#include <string>\n\n' + [0, 1, 2, 3, 4, 5].map(k => cpp(f * 10 + k)).join('\n');
const FILES = [['main.cpp', many(1) + '\nint main() {\n    Counter10 c;\n    c.add(total10(1, 4));\n    std::cout << c.count << std::endl;\n    return 0;\n}\n'], ['counter2.cpp', many(2)], ['counter3.cpp', many(3)], ['counter4.cpp', many(4)]];

test('import: a big import comes in as its code at once; its files turn into sentences in the background, in a worker', { skip: !findChrome() && 'no Chrome or Edge' }, async () => {
  const browser = await openBrowser();
  try {
    const tab = await browser.tab();
    await tab.open(ORIGIN + '/', { serve: serveApp });
    const until = async (cond, what, tries = 300) => { for (let i = 0; i < tries; i++) { if (await tab.run(`!!(${cond})`)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`waited for ${what}: ${await tab.run('document.getElementById("termLog").innerText.slice(-600)')}`); };
    await until('document.getElementById("ta") && document.getElementById("impFolder")', 'the app');
    await tab.run('(() => { const w = document.getElementById("welcomeModal"); if (!w.hidden) document.getElementById("welcomeLook").click(); return true; })()');
    const t0 = Date.now();
    await tab.run(`(() => {
      const files = ${JSON.stringify(FILES)}.map(([n, c]) => { const f = new File([c], n); Object.defineProperty(f, 'webkitRelativePath', { value: 'big/' + n }); return f; });
      const inp = document.getElementById('impFolder'); Object.defineProperty(inp, 'files', { value: files, configurable: true }); inp.dispatchEvent(new Event('change'));
      return true;
    })()`);
    await until('/Imported big/.test(document.getElementById("termLog").innerText)', 'the import');
    const took = Date.now() - t0;
    assert.ok(took < 8000, `in at once (${took} ms)`);
    // here as code, every line exactly as it was
    const kept = () => tab.run(`(() => { const p = JSON.parse(localStorage.getItem('intuicode.project.v1') || 'null'); return p ? p.sections.map(s => [s.path, s.text.split('\\n').filter(l => l.trim()).every(l => /^\\s*c\\+\\+:/.test(l))]) : null; })()`);
    assert.match(await tab.run('document.getElementById("termLog").innerText'), /4 files are here as code, and turning into sentences in the background/);
    // then sentences, file by file, the window free meanwhile
    await until('/✓ Turned 4 imported files into sentences/.test(document.getElementById("termLog").innerText)', 'the files to turn into sentences', 1200);
    await new Promise(r => setTimeout(r, 600));   // (kept 300 ms after the last change)
    const after = await kept();
    assert.ok(after && after.length === 4, JSON.stringify(after));
    for (const [p, code] of after) assert.equal(code, false, `${p} is sentences now`);
    // read in the worker, away from the page (the page says when it has to do it itself)
    assert.doesNotMatch(await tab.run('document.getElementById("termLog").innerText'), /The background reader couldn't start/);
    // and the code they make is the code that came in
    const made = await tab.run(`(() => { const t = document.getElementById('termLog').innerText; return /couldn't be read|may not come back exactly/.test(t) ? t.slice(-400) : ''; })()`);
    assert.equal(made, '', made);
    await tab.close();
  } finally { await browser.close(); }
});

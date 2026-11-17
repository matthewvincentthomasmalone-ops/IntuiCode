// A Vite app (React) run in the browser version, which can't start its dev server (lang/bundle.js): esbuild,
// as WebAssembly, builds its code into one module, and its packages load from esm.sh through an import map.
// The build is checked here in Node (esbuild-wasm's own runner); the page it makes is run in Chrome when there is
// one and esm.sh can be reached (its packages come from there), and skipped otherwise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/engine.mjs';
import { findChrome, openBrowser } from './helpers/browser.mjs';

const require = createRequire(path.join(ROOT, 'package.json'));
const esbuild = require('esbuild-wasm');
vm.runInThisContext(readFileSync(path.join(ROOT, 'lang/bundle.js'), 'utf8'), { filename: 'lang/bundle.js' });
const B = globalThis.IntuiBundle;
const walk = (dir, base = dir) => readdirSync(dir).flatMap(n => { const f = path.join(dir, n); return statSync(f).isDirectory() ? walk(f, base) : [[path.relative(base, f).replace(/\\/g, '/'), readFileSync(f, 'utf8')]]; });
const APP = Object.fromEntries(walk(path.join(ROOT, 'tests/fixtures/vite_app')));
const built = await B.viteApp(APP, esbuild);

test('bundle: a Vite app is built from its files, its packages from esm.sh at the versions package.json says', () => {
  assert.deepEqual(built.errors, []);
  assert.deepEqual(built.packages, ['clsx', 'react', 'react-dom/client', 'react/jsx-runtime']);
  const map = JSON.parse(built.html.match(/<script type="importmap">(.*?)<\/script>/)[1]).imports;
  assert.equal(map.react, 'https://esm.sh/react@^18.3.1');
  assert.equal(map['react-dom/client'], 'https://esm.sh/react-dom@^18.3.1/client?external=react');   // (one React for all)
  assert.equal(map.clsx, 'https://esm.sh/clsx@^2.1.1?external=react,react-dom');
  // the app's own files are in the page: "@/" found as src/, .env's VITE_ settings, the start script replaced
  const js = built.html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  assert.match(js, /Count: /);
  assert.match(js, /Counter from \.env/);
  assert.doesNotMatch(built.html, /src="\/src\/main\.tsx"/);
  // Tailwind runs in the page with the project's config; the CSS is given to it, @apply and all
  assert.match(built.html, /<script src="https:\/\/cdn\.tailwindcss\.com\/[\d.]+"><\/script>/);
  assert.match(built.html, /tailwind\.config=c/);
  assert.match(built.html, /<style type="text\/tailwindcss">[\s\S]*@apply rounded-lg p-4/);
});

test('bundle: what\'s missing is said, in the project\'s words', async () => {
  const no = (files) => B.viteApp(files, esbuild);
  assert.match((await no({})).errors[0], /no index\.html/);
  assert.match((await no({ 'index.html': '<p>hi</p>' })).errors[0], /no <script type="module"/);
  const r = await no({ ...APP, 'src/App.tsx': 'import { Gone } from "@/components/Gone";\nexport default () => <Gone />;\n' });
  assert.deepEqual(r.errors, ['src/App.tsx brings in "@/components/Gone", but there\'s no src/components/Gone in the project.']);
});

// (esm.sh is where the packages come from: without the internet, the page can't run)
const online = await fetch('https://esm.sh/react@18.3.1', { method: 'HEAD', signal: AbortSignal.timeout(8000) }).then(r => r.ok, () => false);
const why = !findChrome() ? 'no Chrome or Edge' : !online ? 'esm.sh can\'t be reached' : false;

test('bundle: the page runs in Chrome: React draws it, a click counts, Tailwind uses the project\'s colour', { skip: why }, async () => {
  const browser = await openBrowser();
  try {
    const tab = await browser.tab();
    const origin = 'http://vite-app.localhost';
    await tab.open(origin + '/', { serve: (req) => (new URL(req.url).origin === origin ? { type: 'text/html', body: built.html } : { pass: true }) });
    const wait = (test) => tab.run(`(async () => { for (let i = 0; i < 150; i++) { if (${test}) return true; await new Promise(r => setTimeout(r, 100)); } return false; })()`, { timeout: 20000 });
    assert.ok(await wait('document.getElementById("count")'), 'React drew the counter');
    assert.equal(await tab.run('document.getElementById("title").textContent'), 'Counter from .env');
    assert.equal(await tab.run('document.getElementById("count").textContent'), 'Count: 0');
    await tab.run('document.getElementById("count").click()');
    assert.ok(await wait('document.getElementById("count").textContent === "Count: 1"'), 'a click counts');
    // bg-primary is hsl(var(--primary)) in tailwind.config.ts, and --primary is red in index.css
    assert.ok(await wait('getComputedStyle(document.getElementById("count")).backgroundColor === "rgb(255, 0, 0)"'), 'Tailwind used the project\'s colour');
    assert.equal(await tab.run('getComputedStyle(document.querySelector("main")).padding'), '16px');   // (.card's @apply p-4)
    await tab.close();
  } finally { await browser.close(); }
});

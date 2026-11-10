// A Vite app (React, and Lovable's projects): found by its package.json, run by the desktop app on its own dev
// server, and opened in its own folder, where every file comes in as its exact lines and goes back the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/engine.mjs';

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['lang/languages.js', 'lang/project.js', 'lang/python.js', 'lang/web_write.js', 'lang/ts_write.js', 'lang/cpp_write.js', 'lang/unity.js'])
  vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const { IntuiProject: PRJ, IntuiUnity: U, IntuiLanguages: LANGS, IntuiWeb: WEB } = ctx;
const W = { LANG: ctx.IntuiLang.python, WEB, TS: ctx.IntuiTs, CPP: ctx.IntuiCpp };
const plain = (x) => JSON.parse(JSON.stringify(x));   // (objects made in the engine's sandbox)

const pkg = (j) => ({ sections: [{ id: 'p', path: 'package.json', lang: 'json', text: JSON.stringify(j) }] });

test('a Vite app is one whose package.json at the top has a dev script and Vite among its packages', () => {
  assert.deepEqual(plain(PRJ.devServerOf(pkg({ scripts: { dev: 'vite' }, devDependencies: { vite: '^5.4.1' } }))), { script: 'dev', tool: 'vite', path: 'package.json' });
  assert.deepEqual(plain(PRJ.devServerOf(pkg({ scripts: { dev: 'vite --port 8080' }, dependencies: { vite: '5.4.8', react: '18.3.1' } }))), { script: 'dev', tool: 'vite', path: 'package.json' });
  // not one: no dev script, another tool, a package.json that isn't JSON, or one in a folder
  assert.equal(PRJ.devServerOf(pkg({ scripts: { build: 'vite build' }, devDependencies: { vite: '5' } })), null);
  assert.equal(PRJ.devServerOf(pkg({ scripts: { dev: 'next dev' }, dependencies: { next: '14' } })), null);
  assert.equal(PRJ.devServerOf({ sections: [{ id: 'p', path: 'package.json', lang: 'json', text: '{ "scripts": ' }] }), null);
  assert.equal(PRJ.devServerOf({ sections: [{ id: 'p', path: 'web/package.json', lang: 'json', text: JSON.stringify({ scripts: { dev: 'vite' }, devDependencies: { vite: '5' } }) }] }), null);
  assert.equal(PRJ.devServerOf({ sections: [{ id: 'm', path: 'main.py', lang: 'python', text: '' }] }), null);
});

/* A Lovable-style Vite app's files. */
const VITE_APP = {
  'index.html': '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Shop</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n',
  'package.json': JSON.stringify({ name: 'shop', private: true, type: 'module', scripts: { dev: 'vite', build: 'vite build' }, dependencies: { react: '18.3.1', 'react-dom': '18.3.1' }, devDependencies: { vite: '5.4.8', tailwindcss: '3.4.13' } }, null, 2) + '\n',
  'vite.config.ts': "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nimport path from 'path';\n\nexport default defineConfig({\n  server: {\n    host: '::',\n    port: 8080,\n  },\n  plugins: [react()],\n  resolve: {\n    alias: {\n      '@': path.resolve(__dirname, './src'),\n    },\n  },\n});\n",
  'tailwind.config.js': "export default {\n  content: ['./index.html', './src/**/*.{ts,tsx}'],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n};\n",
  'src/index.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n',
  'src/main.tsx': "import { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')!).render(<App />);\n",
  'src/App.tsx': "import { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <main className=\"p-6\">\n      <h1 className=\"text-2xl font-bold\">Shop</h1>\n      <button onClick={() => setCount(count + 1)}>Added {count}</button>\n    </main>\n  );\n}\n",
};

test('a Vite app opened in its own folder: every file as its exact lines comes back as the same file, the page too', () => {
  const sections = Object.entries(VITE_APP).map(([p, code], i) => {
    const lang = LANGS.fromPath(p);
    const text = U.LANGS.includes(lang) ? U.toFile(lang, code.replace(/\n+$/, '').split('\n'), []) + '\n' : code;
    return { id: 's' + i, path: p, lang, text };
  });
  const p = PRJ.normalized({ version: 2, lang: 'python', name: 'shop', sections, active: 's0' });
  assert.ok(PRJ.devServerOf(p));
  const out = PRJ.compileAll(p, W);
  for (const s of p.sections) {
    const r = out.results[s.id];
    assert.equal((r ? r.text : s.text).replace(/\n+$/, ''), VITE_APP[s.path].replace(/\n+$/, ''), s.path);
  }
});

test('a whole page in exact lines is written as it is; exact lines inside a page still get the page around them', () => {
  const page = ['<!DOCTYPE html>', '<html>', '<head><title>Kept</title></head>', '', '<body><p>Hi</p></body>', '</html>'];
  const r = WEB.compileWebsite({ sections: [{ id: 'structure', file: 'structure', text: page.map(l => (l ? 'html: ' + l : '')).join('\n') + '\n' }] }).results.structure;
  assert.equal(r.text, page.join('\n') + '\n');
  assert.equal(r.title, 'Kept');
  assert.equal(r.errs, undefined);
  // (each line maps to its own code line; blank lines are just kept)
  assert.deepEqual(plain(r.info.map(i => i.py)), [[0], [1], [2], [], [4], [5], []]);
  // a part of a page, in exact lines: the page around it, as before
  const part = WEB.compileWebsite({ sections: [{ id: 'structure', file: 'structure', text: 'html: <p>Hi</p>\n' }] }).results.structure;
  assert.match(part.text, /^<!DOCTYPE html>\n<html lang="en">[\s\S]*<p>Hi<\/p>[\s\S]*<\/html>\n$/);
});

test('a page whose module script is one of the project\'s own (a bundled app) gets no style.css or script.js of IntuaCode\'s', () => {
  const files = [{ path: 'index.html', lang: 'html' }, { path: 'src/main.tsx', lang: 'tsx' }, { path: 'src/index.css', lang: 'css' }, { path: 'tailwind.config.js', lang: 'js' }];
  const sections = [
    { id: 'a', file: 'structure', path: 'index.html', text: 'add a block called root\nadd a script, of type module, from "/src/main.tsx"\n' },
    { id: 'b', file: 'styling', path: 'src/index.css', text: 'css: body { margin: 0; }\n' },
    { id: 'c', file: 'mechanics', path: 'tailwind.config.js', text: 'js: export default {};\n' },
  ];
  const html = WEB.compileWebsite({ files, sections }).results.a.text;
  assert.match(html, /<script type="module" src="\/src\/main\.tsx"><\/script>/);
  assert.doesNotMatch(html, /style\.css|script\.js/);
  // a plain website keeps them
  const site = WEB.compileWebsite({
    files: [{ path: 'index.html', lang: 'html' }, { path: 'style.css', lang: 'css' }, { path: 'script.js', lang: 'js' }],
    sections: [{ id: 'a', file: 'structure', path: 'index.html', text: 'add a heading saying "Hi"\n' }, { id: 'b', file: 'styling', path: 'style.css', text: 'style page: background white\n' }, { id: 'c', file: 'mechanics', path: 'script.js', text: 'js: console.log(1);\n' }],
  }).results.a.text;
  assert.match(site, /<link rel="stylesheet" href="style\.css">/);
  assert.match(site, /<script src="script\.js"><\/script>/);
});

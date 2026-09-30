// Loads the browser engine files (which attach to `window`) into Node for testing.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/* A Python 3 to run the reader with: python3 (Linux, macOS), or python / py (Windows, where
 * `python3` is often only the Microsoft Store's placeholder). */
export const PYTHON = ['python3', 'python', 'py'].find((p) => {
  try { return /Python 3/.test(execFileSync(p, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (_) { return false; }
}) || 'python3';

export function loadEngine() {
  const ctx = { console };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['lang/python.js', 'lang/web_write.js', 'lang/cpp_write.js', 'lang/blueprints.js']) {
    vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return { L: ctx.IntuiLang.python, BP: ctx.IntuiBlueprints, WEB: ctx.IntuiWeb, CPP: ctx.IntuiCpp };
}

/* Call the Python reader in bulk (one process per batch). */
function reader(cmd, payload) {
  const out = execFileSync(PYTHON, [path.join(ROOT, 'lang/python_reader.py'), cmd], {
    input: JSON.stringify(payload), maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out.toString());
}
export const toSentences = (sources) => reader('sentences-json', sources);
export const compareMany = (pairs) => reader('compare-json', pairs);

export function pyFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) { if (!['__pycache__', 'venv', '.venv'].includes(name)) out.push(...pyFiles(full)); }
    else if (name.endsWith('.py')) out.push(full);
  }
  return out;
}

/* Python -> sentences -> Python. Returns per-file exactness and how much reads as sentences. */
export function roundTrip(L, files) {
  const sources = files.map(f => readFileSync(f, 'utf8'));
  const sentences = toSentences(sources);
  const generated = sentences.map(text => L.compileProject({ sections: [{ id: 'main', file: 'main', text }] }).results.main);
  const checks = compareMany(sources.map((s, i) => [s, generated[i].text]));
  return files.map((f, i) => {
    const lines = sentences[i].split('\n').filter(l => l.trim() && !/^\s*note:/.test(l));
    const counted = lines.filter(l => !/^\s*python:\s*(import |from \S+ import )/.test(l));
    const raw = counted.filter(l => /^\s*python:/.test(l)).length;
    return {
      file: path.relative(ROOT, f),
      same: checks[i].same,
      errors: generated[i].info.flatMap((inf, n) => inf.errs.map(e => `line ${n + 1}: ${e}`)),
      lines: counted.length,
      words: counted.length - raw,
      sentences: sentences[i],
      differs: checks[i].differs,
    };
  });
}

/* The web reader (JS / HTML / CSS) with tree-sitter, for tests. */
export async function loadWebReader() {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  // the runtime with the fix for unknown HTML tags, as the app loads it
  vm.runInThisContext(readFileSync(path.join(ROOT, 'lang/ts_patch.js'), 'utf8'), { filename: 'lang/ts_patch.js' });
  const tsFile = require.resolve('web-tree-sitter');
  const m = { exports: {} };
  new Function('module', 'exports', 'require', '__dirname', '__filename', globalThis.IntuiTsPatch.patch(readFileSync(tsFile, 'utf8')))(m, m.exports, createRequire(tsFile), path.dirname(tsFile), tsFile);
  const TreeSitter = m.exports;
  vm.runInThisContext(readFileSync(path.join(ROOT, 'lang/web_read.js'), 'utf8'), { filename: 'lang/web_read.js' });
  const W = globalThis.IntuiWebReader;
  const grammars = path.join(ROOT, 'node_modules/tree-sitter-wasms/out');
  const runtime = path.join(ROOT, 'node_modules/web-tree-sitter');
  await W.init({ TreeSitter, locate: (f) => path.join(f === 'tree-sitter.wasm' ? runtime : grammars, f) });
  return W;
}

/* Code -> sentences for HTML, CSS, JS and C++ (needs the web reader's parsers). */
export async function loadConverter() {
  const W = await loadWebReader();
  await W.loadLangs(['cpp']);
  vm.runInThisContext(readFileSync(path.join(ROOT, 'lang/convert.js'), 'utf8'), { filename: 'lang/convert.js' });
  const { WEB, CPP, BP } = loadEngine();
  const C = globalThis.IntuiConvert;
  const env = (extra = {}) => ({ parse: W.parse, WEB, CPP, ...extra });
  return { C, W, WEB, CPP, BP, env, convert: (kind, src, extra) => C.toSentences(kind, src, env(extra)) };
}

/* The Python reader's project analysis, for mixed projects. */
export function pyProject(files) {
  const out = execFileSync(PYTHON, ['-c','import sys,json; sys.stdin.reconfigure(encoding="utf-8"); sys.path.insert(0, sys.argv[1]); import python_reader as r; print(json.dumps(r.analyze_project(json.load(sys.stdin))))', path.join(ROOT, 'lang')], {
    input: JSON.stringify(files), maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out.toString());
}

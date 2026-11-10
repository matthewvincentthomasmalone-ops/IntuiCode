// How much of real code reads as sentences, and does it round-trip exactly?
//   node tools/coverage.mjs <folder or file> [...]      (add --show to print the sentences)
// Python (.py) goes through the Python reader; TypeScript and React (.ts, .tsx, .jsx) through lang/convert.js.
// Imports aren't counted (as code or as "bring in" sentences), so the numbers stay comparable.
import path from 'node:path';
import { statSync, readdirSync, readFileSync } from 'node:fs';
import { loadEngine, loadConverter, roundTrip, pyFiles, ROOT } from '../tests/helpers/engine.mjs';

const args = process.argv.slice(2);
const show = args.includes('--show');
const targets = args.filter(a => a !== '--show');
if (!targets.length) { console.log('usage: node tools/coverage.mjs <folder|file> [...] [--show]'); process.exit(1); }
const SCRIPT = /\.(?:tsx?|jsx)$/;
const scripts = (dir) => readdirSync(dir).flatMap(n => { const f = path.join(dir, n); return statSync(f).isDirectory() ? (n === 'node_modules' ? [] : scripts(f)) : SCRIPT.test(n) ? [f] : []; });
const all = targets.map(t => path.resolve(t));
const py = all.flatMap(t => (statSync(t).isDirectory() ? pyFiles(t) : /\.pyw?$/.test(t) ? [t] : []));
const ts = all.flatMap(t => (statSync(t).isDirectory() ? scripts(t) : SCRIPT.test(t) ? [t] : []));

const results = [];
if (py.length) {
  const { L } = loadEngine();
  results.push(...roundTrip(L, py));
}
if (ts.length) {
  const { convert, TS } = await loadConverter();
  for (const f of ts) {
    const kind = f.endsWith('.tsx') ? 'tsx' : f.endsWith('.ts') ? 'ts' : 'js';
    const r = convert(kind, readFileSync(f, 'utf8'));
    const lines = r.ok ? r.text.split('\n').filter(l => l.trim() && !/^\s*note:/.test(l)) : [];
    const counted = lines.filter(l => !/^\s*(?:(?:ts|tsx|js):\s*import\s|bring in\s)/.test(l));
    const raw = counted.filter(l => /^\s*(?:ts|tsx|js):/.test(l)).length;
    const back = r.ok ? TS.compileTs({ id: 'x', file: 'typescript', text: r.text }, null, { lang: kind }) : null;
    const errors = back ? back.info.flatMap((inf, n) => inf.errs.map(e => `line ${n + 1}: ${e}`)) : [r.error];
    results.push({ file: path.relative(ROOT, f), same: !!(r.ok && r.exact), errors, lines: counted.length, words: counted.length - raw, sentences: r.text || '' });
  }
}

let words = 0, lines = 0, exact = 0;
console.log('file'.padEnd(52) + 'in words   exact');
for (const r of results) {
  words += r.words; lines += r.lines; exact += r.same && !r.errors.length ? 1 : 0;
  const pct = r.lines ? Math.round(100 * r.words / r.lines) : 100;
  console.log(r.file.replace(/\\/g, '/').padEnd(52) + `${String(pct).padStart(3)}% ${String(r.words).padStart(3)}/${String(r.lines).padEnd(4)} ${r.same && !r.errors.length ? 'yes' : 'NO'}`);
  if (show) console.log(r.sentences.replace(/^/gm, '    | '));
}
const total = lines ? Math.round(100 * words / lines) : 100;
console.log('-'.repeat(72));
console.log('TOTAL'.padEnd(52) + `${String(total).padStart(3)}% ${words}/${lines}   ${exact}/${results.length} exact`);
if (exact !== results.length) process.exitCode = 1;

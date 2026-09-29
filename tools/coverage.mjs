// How much of real Python reads as sentences, and does it round-trip exactly?
//   node tools/coverage.mjs <folder or .py file> [...]      (add --show to print the sentences)
import path from 'node:path';
import { statSync } from 'node:fs';
import { loadEngine, roundTrip, pyFiles } from '../tests/helpers/engine.mjs';

const args = process.argv.slice(2);
const show = args.includes('--show');
const targets = args.filter(a => a !== '--show');
if (!targets.length) { console.log('usage: node tools/coverage.mjs <folder|file.py> [...] [--show]'); process.exit(1); }
const files = targets.flatMap(t => statSync(t).isDirectory() ? pyFiles(path.resolve(t)) : [path.resolve(t)]);
const { L } = loadEngine();
const results = roundTrip(L, files);

let words = 0, lines = 0, exact = 0;
console.log('file'.padEnd(46) + 'in words   exact');
for (const r of results) {
  words += r.words; lines += r.lines; exact += r.same && !r.errors.length ? 1 : 0;
  const pct = r.lines ? Math.round(100 * r.words / r.lines) : 100;
  console.log(r.file.padEnd(46) + `${String(pct).padStart(3)}% ${String(r.words).padStart(3)}/${String(r.lines).padEnd(4)} ${r.same && !r.errors.length ? 'yes' : 'NO'}`);
  if (show) console.log(r.sentences.replace(/^/gm, '    | '));
}
const total = lines ? Math.round(100 * words / lines) : 100;
console.log('-'.repeat(66));
console.log('TOTAL'.padEnd(46) + `${String(total).padStart(3)}% ${words}/${lines}   ${exact}/${results.length} exact`);
if (exact !== results.length) process.exitCode = 1;

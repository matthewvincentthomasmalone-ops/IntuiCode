// Do the Python writer's value words mean what they say? Which have an example that runs?
//   node tools/meaning.mjs [folder or file …] [--mutate]
// Runs every example in tests/helpers/meaning_python.mjs with the local Python, then lists each rule in
// EXPR_RULES (lang/python.js) with its examples, or why it has none. Then reads the Python in the folders given
// (samples, tests/corpus and tests/heldout when none are) as sentences, and says which rules those sentences
// use and whether each has an example.
// --mutate: swaps each rule's code for another rule's, one at a time, and checks some example fails.
import path from 'node:path';
import { statSync, readFileSync } from 'node:fs';
import { loadEngine, toSentences, pyFiles, ROOT } from '../tests/helpers/engine.mjs';
import { runExamples, ruleCoverage, ruleLabel } from '../tests/helpers/meaning.mjs';
import { EXAMPLES, NOT_RUN } from '../tests/helpers/meaning_python.mjs';

const args = process.argv.slice(2);
const mutate = args.includes('--mutate');
const targets = args.filter(a => !a.startsWith('--'));
const { L } = loadEngine();

const results = runExamples(L, EXAMPLES);
const failed = results.filter(r => !r.ok);
const rows = ruleCoverage(L, results, NOT_RUN);
console.log('rule'.padEnd(64) + 'examples');
for (const row of rows) console.log(row.label.slice(0, 62).padEnd(64) + (row.examples.length ? String(row.examples.length) : `none: ${row.why || 'no example yet'}`));
const tested = rows.filter(r => r.examples.length).length;
console.log('-'.repeat(72));
console.log(`${results.length - failed.length}/${results.length} examples give what their words say`);
for (const f of failed) console.log(`  NO: "${f.ex.say}" ${f.why}`);
console.log(`${tested}/${rows.length} rules have an example that runs (${Math.round(100 * tested / rows.length)}%)`);

// The rules the reader's sentences use, on real code
const files = (targets.length ? targets : ['samples', 'tests/corpus', 'tests/heldout']).map(t => path.resolve(ROOT, t))
  .flatMap(t => (statSync(t).isDirectory() ? pyFiles(t) : [t]));
if (files.length) {
  const sentences = toSentences(files.map(f => readFileSync(f, 'utf8')));
  const inFiles = new Map();
  sentences.forEach((text, i) => {
    const used = L.rules.trace(() => L.compileProject({ sections: [{ id: 'main', file: 'main', text }] }));
    for (const r of used) inFiles.set(r, (inFiles.get(r) || 0) + 1);
  });
  const usedRows = rows.filter(r => inFiles.has(r.rule));
  const usedTested = usedRows.filter(r => r.examples.length);
  console.log(`${usedTested.length}/${usedRows.length} rules the sentences for ${files.length} Python files use have an example that runs`);
  for (const r of usedRows.filter(r => !r.examples.length)) console.log(`  none: ${r.label} (in ${inFiles.get(r.rule)} files)`);
}

if (mutate) {
  // a wrong rule, of the same shape as the right one: does some example notice?
  const R = L.rules.EXPR_RULES, missed = [];
  let tried = 0;
  const shape = (to) => [1, 2, 3].map(n => to.includes('$' + n)).join();
  for (const r of R) {
    if (typeof r.to !== 'string') continue;
    const was = r.to, other = R.find(o => typeof o.to === 'string' && o.to !== was && shape(o.to) === shape(was));
    if (!other) continue;
    tried++;
    r.to = other.to;
    try { if (runExamples(L, EXAMPLES).every(x => x.ok)) missed.push(`${ruleLabel(r)} (written as ${other.to.trim()})`); }
    finally { r.to = was; }
  }
  console.log(`mutations: ${tried - missed.length}/${tried} wrong rules caught by an example`);
  for (const m of missed) console.log(`  missed: ${m}`);
}
if (failed.length) process.exitCode = 1;

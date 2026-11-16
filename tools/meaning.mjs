// Do the Python writer's words mean what they say? Which have an example that runs?
//   node tools/meaning.mjs [folder or file …] [--mutate]
// Runs every example in tests/helpers/meaning_python.mjs with the local Python, then lists each value word
// (EXPR_RULES in lang/python.js) and each statement (its RULES) with its examples, or why it has none. Then reads
// the Python in the folders given (samples, tests/corpus and tests/heldout when none are) as sentences, and says
// which rules those sentences use and whether each has an example.
// --mutate: makes each rule do another's work, one at a time (a value word gets another's code, a statement
// another's with as many words to fill in), and checks some example fails.
import path from 'node:path';
import { statSync, readFileSync } from 'node:fs';
import { loadEngine, toSentences, pyFiles, ROOT } from '../tests/helpers/engine.mjs';
import { runExamples, ruleCoverage, ruleLabel, statementLabel, nameOf } from '../tests/helpers/meaning.mjs';
import { EXAMPLES, STATEMENTS, NOT_RUN } from '../tests/helpers/meaning_python.mjs';

const args = process.argv.slice(2);
const mutate = args.includes('--mutate');
const targets = args.filter(a => !a.startsWith('--'));
const { L } = loadEngine();
const ALL = [...EXAMPLES, ...STATEMENTS];

const results = runExamples(L, ALL);
const failed = results.filter(r => !r.ok);
const rows = ruleCoverage(L, results, NOT_RUN);
const KINDS = { value: 'value words', statement: 'statements' };
for (const [kind, title] of Object.entries(KINDS)) {
  console.log(`\n${title}`.padEnd(65) + 'examples');
  for (const row of rows.filter(r => r.kind === kind)) console.log(row.label.slice(0, 62).padEnd(64) + (row.examples.length ? String(row.examples.length) : `none: ${row.why || 'no example yet'}`));
}
console.log('-'.repeat(72));
console.log(`${results.length - failed.length}/${results.length} examples give what their words say`);
for (const f of failed) console.log(`  NO: "${nameOf(f.ex)}" ${f.why}`);
for (const [kind, title] of Object.entries(KINDS)) {
  const all = rows.filter(r => r.kind === kind), tested = all.filter(r => r.examples.length).length;
  console.log(`${tested}/${all.length} ${title} have an example that runs (${Math.round(100 * tested / all.length)}%)`);
}

// The rules the reader's sentences use, on real code
const files = (targets.length ? targets : ['samples', 'tests/corpus', 'tests/heldout']).map(t => path.resolve(ROOT, t))
  .flatMap(t => (statSync(t).isDirectory() ? pyFiles(t) : [t]));
if (files.length) {
  const sentences = toSentences(files.map(f => readFileSync(f, 'utf8')));
  const inFiles = new Map();
  for (const text of sentences) {
    const used = L.rules.trace(() => L.compileProject({ sections: [{ id: 'main', file: 'main', text }] }));
    for (const r of used) inFiles.set(r, (inFiles.get(r) || 0) + 1);
  }
  for (const [kind, title] of Object.entries(KINDS)) {
    const used = rows.filter(r => r.kind === kind && inFiles.has(r.rule));
    console.log(`${used.filter(r => r.examples.length).length}/${used.length} ${title} the sentences for ${files.length} Python files use have an example that runs`);
    for (const r of used.filter(r => !r.examples.length)) console.log(`  none: ${r.label} (in ${inFiles.get(r.rule)} files)`);
  }
}

if (mutate) {
  // a wrong rule, of the same shape as the right one: does some example notice?
  const caught = (examples) => runExamples(L, examples).some(x => !x.ok);
  const values = [], statements = [];
  let triedV = 0, triedS = 0;
  const shape = (to) => [1, 2, 3].map(n => to.includes('$' + n)).join();
  for (const r of L.rules.EXPR_RULES) {
    if (typeof r.to !== 'string') continue;
    const was = r.to, other = L.rules.EXPR_RULES.find(o => typeof o.to === 'string' && o.to !== was && shape(o.to) === shape(was));
    if (!other) continue;
    triedV++;
    r.to = other.to;
    try { if (!caught(ALL)) values.push(`${ruleLabel(r)} (written as ${other.to.trim()})`); }
    finally { r.to = was; }
  }
  const groups = (re) => new RegExp(re.source + '|').exec('').length - 1;
  const S = L.rules.STATEMENTS, before = results.slice(EXAMPLES.length).map(x => x.code), same = [];
  S.forEach((r, i) => {
    // the next statement with as many words to fill in, doing this one's work
    const other = S.slice(i + 1).concat(S.slice(0, i)).find(o => o.fn !== r.fn && groups(o.re) === groups(r.re));
    if (!other) return;
    triedS++;
    const was = r.fn;
    r.fn = other.fn;
    try {
      const now = runExamples(L, STATEMENTS);
      const said = `${statementLabel(r)} (doing "${statementLabel(other)}")`;
      // the other one writes the very same code from the words of this one's examples: two ways of saying it,
      // not a wrong rule (a rule with no example is a miss: nothing looked)
      const looked = rows.find(row => row.rule === r).examples.length > 0;
      if (now.every(x => x.ok)) (looked && now.every((x, k) => x.code === before[k]) ? same : statements).push(said);
    } finally { r.fn = was; }
  });
  triedS -= same.length;
  console.log(`mutations: ${triedV - values.length}/${triedV} wrong value words and ${triedS - statements.length}/${triedS} wrong statements caught by an example`);
  for (const m of values.concat(statements)) console.log(`  missed: ${m}`);
  for (const m of same) console.log(`  the same code, not counted: ${m}`);
}
if (failed.length) process.exitCode = 1;

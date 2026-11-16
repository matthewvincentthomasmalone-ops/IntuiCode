// Do the Python writer's words mean what they say? Which have an example that runs?
//   node tools/meaning.mjs [folder or file …] [--mutate]
// Runs every example in tests/helpers/meaning_python.mjs with the local Python, then lists each value word
// (EXPR_RULES in lang/python.js) and each statement (its RULES) with its examples, or why it has none. Then reads
// the Python in the folders given (samples, tests/corpus and tests/heldout when none are) as sentences, and says
// which rules those sentences use and whether each has an example.
// Then the JavaScript writer's Mechanics, run on a stand-in page (tests/helpers/page.mjs): its rules are written in
// place, so what's listed is its Index (the sentences and value words it offers), and the entries the reader's
// sentences use for tests/corpus_web's scripts.
// Then C++ programs and Arduino sketches, compiled and run (g++, or Visual Studio's cl on Windows; skipped with
// neither). Also counted by the Index, and the entries the sentences for tests/corpus_langs' .cpp and .ino use.
// Then, in a real browser (Chrome or Edge, without a window; skipped with neither): the JavaScript examples again,
// and the website's Structure and Styling, counted by the Index.
// Then TypeScript's own words: types by TypeScript's checker, components by React in the browser (needs the
// typescript, react and react-dom dev packages).
// --mutate: makes each rule do another's work, one at a time (a value word gets another's code, a statement
// another's with as many words to fill in; for JavaScript and C++, each word for comparisons and maths), and
// checks some example fails.
import path from 'node:path';
import { statSync, readFileSync, readdirSync } from 'node:fs';
import { loadEngine, loadConverter, toSentences, pyFiles, ROOT } from '../tests/helpers/engine.mjs';
import { runExamples, ruleCoverage, ruleLabel, statementLabel, nameOf } from '../tests/helpers/meaning.mjs';
import { EXAMPLES, STATEMENTS, NOT_RUN } from '../tests/helpers/meaning_python.mjs';
import { runJsExamples, indexCoverage, entryPattern, mutateWords, jsNameOf } from '../tests/helpers/meaning_web.mjs';
import { JS_VALUES, JS_STATEMENTS, NOT_RUN_JS } from '../tests/helpers/meaning_js.mjs';
import { findCompiler, runCppExamples, cppIndexCoverage, mutateCppWords, cppNameOf } from '../tests/helpers/meaning_cpp.mjs';
import { CPP_VALUES, CPP_STATEMENTS, CPP_SKETCHES, NOT_RUN_CPP } from '../tests/helpers/meaning_cpp_examples.mjs';
import { findChrome } from '../tests/helpers/browser.mjs';
import { runJsInBrowser, runSiteInBrowser, siteCoverage, siteNameOf, mutateContainers } from '../tests/helpers/meaning_browser.mjs';
import { HTML_STRUCTURE, HTML_STYLING, NOT_RUN_HTML } from '../tests/helpers/meaning_html.mjs';
import { missingPackages, runTsExamples, tsCoverage, tsNameOf, mutateTypeWords } from '../tests/helpers/meaning_ts.mjs';
import { TS_TYPES, TS_FILES, TS_REACT, TS_PACKS, NOT_RUN_TS } from '../tests/helpers/meaning_ts_examples.mjs';

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

/* ---- JavaScript (a website's Mechanics), on a stand-in page. Its rules are counted by its Index. ---- */
const { WEB } = loadEngine();
const JS_ALL = [...JS_VALUES, ...JS_STATEMENTS];
const jsResults = await runJsExamples(WEB, JS_ALL);
const jsFailed = jsResults.filter(r => !r.ok);
const entries = indexCoverage(WEB, jsResults, NOT_RUN_JS);
for (const [kind, title] of [['statement', 'JavaScript sentences (the Index, Mechanics)'], ['value', 'JavaScript value words (the Index, Mechanics)']]) {
  console.log(`\n${title}`.padEnd(65) + 'examples');
  for (const e of entries.filter(e => e.kind === kind)) console.log(e.label.slice(0, 62).padEnd(64) + (e.examples.length ? String(e.examples.length) : `none: ${e.why || 'no example yet'}`));
}
console.log('-'.repeat(72));
console.log(`${jsResults.length - jsFailed.length}/${jsResults.length} JavaScript examples do what their words say`);
for (const f of jsFailed) console.log(`  NO: "${jsNameOf(f.ex)}" ${f.why}`);
for (const [kind, title] of [['statement', 'Index sentences'], ['value', 'Index value words']]) {
  const all = entries.filter(e => e.kind === kind), tested = all.filter(e => e.examples.length).length;
  console.log(`${tested}/${all.length} JavaScript ${title} have an example that runs (${Math.round(100 * tested / all.length)}%)`);
}
// the Index entries the reader's sentences use, for the website corpus's scripts
const { convert } = await loadConverter();
const scripts = readdirSync(path.join(ROOT, 'tests/corpus_web')).filter(f => f.endsWith('.js')).map(f => path.join(ROOT, 'tests/corpus_web', f));
const said = scripts.flatMap(f => { const r = convert('js', readFileSync(f, 'utf8')); return r.ok ? r.text.split('\n') : []; });
const usedEntries = entries.filter(e => { const re = entryPattern(e); return said.some(l => (e.pattern ? re.test(l) : re.test(' ' + l.trim()))); });
console.log(`${usedEntries.filter(e => e.examples.length).length}/${usedEntries.length} Index entries the sentences for ${scripts.length} corpus scripts use have an example that runs`);
for (const e of usedEntries.filter(e => !e.examples.length)) console.log(`  none: ${e.label}`);
if (mutate) {
  const m = await mutateWords(WEB, JS_ALL);
  console.log(`mutations: ${m.tried - m.missed.length}/${m.tried} wrong JavaScript words (comparisons and maths) caught by an example`);
  for (const x of m.missed) console.log(`  missed: ${x}`);
}

/* ---- C++ programs and Arduino sketches, compiled and run. Counted by the Index too. ---- */
let cppFailed = [];
const cc = findCompiler();
if (!cc) console.log('\nC++: no compiler found (g++, or Visual Studio with C++), so its examples are skipped');
else {
  const { CPP } = loadEngine();
  const CPP_ALL = [...CPP_VALUES, ...CPP_STATEMENTS, ...CPP_SKETCHES];
  const cppResults = runCppExamples(CPP, CPP_ALL);
  cppFailed = cppResults.filter(r => !r.ok);
  const rows = cppIndexCoverage(CPP, cppResults, NOT_RUN_CPP);
  for (const where of ['program', 'sketch']) for (const [kind, title] of [['statement', 'sentences'], ['value', 'value words']]) {
    console.log(`\nC++ ${where} ${title} (the Index)`.padEnd(65) + 'examples');
    for (const e of rows.filter(e => e.where === where && e.kind === kind)) console.log(e.label.slice(where.length + 2, where.length + 64).padEnd(64) + (e.examples.length ? String(e.examples.length) : `none: ${e.why || 'no example yet'}`));
  }
  console.log('-'.repeat(72));
  console.log(`${cppResults.length - cppFailed.length}/${cppResults.length} C++ examples do what their words say (built with ${cc.name})`);
  for (const f of cppFailed) console.log(`  NO: "${cppNameOf(f.ex)}" ${f.why}`);
  for (const where of ['program', 'sketch']) for (const [kind, title] of [['statement', 'Index sentences'], ['value', 'Index value words']]) {
    const all = rows.filter(e => e.where === where && e.kind === kind), tested = all.filter(e => e.examples.length).length;
    console.log(`${tested}/${all.length} C++ ${where} ${title} have an example that runs (${Math.round(100 * tested / all.length)}%)`);
  }
  for (const [file, kind, where] of [['matrix.cpp', 'cpp', 'program'], ['thermostat.ino', 'arduino', 'sketch']]) {
    const r = convert(kind, readFileSync(path.join(ROOT, 'tests/corpus_langs', file), 'utf8'));
    const lines = r.ok ? r.text.split('\n') : [];
    const used = rows.filter(e => e.where === where && lines.some(l => { const re = entryPattern(e); return e.pattern ? re.test(l) : re.test(' ' + l.trim()); }));
    console.log(`${used.filter(e => e.examples.length).length}/${used.length} Index entries the sentences for tests/corpus_langs/${file} use have an example that runs`);
    for (const e of used.filter(e => !e.examples.length)) console.log(`  none: ${e.label}`);
  }
  if (mutate) {
    const m = mutateCppWords(CPP, CPP_ALL);
    console.log(`mutations: ${m.tried - m.missed.length}/${m.tried} wrong C++ words (comparisons and maths) caught by an example`);
    for (const x of m.missed) console.log(`  missed: ${x}`);
  }
}

/* ---- In a real browser: the JavaScript examples again, and Structure and Styling ---- */
let browserFailed = [];
if (!findChrome()) console.log('\nIn a browser: no Chrome or Edge found (set CHROME_PATH), so these are skipped');
else {
  const { WEB: W } = loadEngine();
  const js = await runJsInBrowser(W, JS_ALL);
  const site = await runSiteInBrowser(W, [...HTML_STRUCTURE, ...HTML_STYLING]);
  const rows = siteCoverage(W, site, NOT_RUN_HTML);
  for (const sec of ['structure', 'styling']) for (const [kind, title] of [['statement', 'sentences'], ['value', 'words']]) {
    console.log(`\n${sec === 'structure' ? 'Structure (HTML)' : 'Styling (CSS)'} ${title} (the Index)`.padEnd(65) + 'examples');
    for (const e of rows.filter(e => e.sec === sec && e.kind === kind)) console.log(e.label.slice(sec.length + 2, sec.length + 64).padEnd(64) + (e.examples.length ? String(e.examples.length) : `none: ${e.why || 'no example yet'}`));
  }
  console.log('-'.repeat(72));
  browserFailed = [...js, ...site].filter(r => !r.ok);
  console.log(`${js.filter(r => r.ok).length}/${js.length} JavaScript examples do what their words say in a real browser`);
  console.log(`${site.filter(r => r.ok).length}/${site.length} Structure and Styling examples do what their words say in a real browser`);
  for (const f of browserFailed) console.log(`  NO: "${f.ex.lines != null || f.ex.say ? jsNameOf(f.ex) : siteNameOf(f.ex)}" ${f.why}`);
  for (const sec of ['structure', 'styling']) for (const [kind, title] of [['statement', 'Index sentences'], ['value', 'Index words']]) {
    const all = rows.filter(e => e.sec === sec && e.kind === kind), tested = all.filter(e => e.examples.length).length;
    console.log(`${tested}/${all.length} ${sec === 'structure' ? 'Structure' : 'Styling'} ${title} have an example that runs (${Math.round(100 * tested / all.length)}%)`);
  }
  if (mutate) {
    const m = await mutateContainers(W, [...HTML_STRUCTURE, ...HTML_STYLING]);
    console.log(`mutations: ${m.tried - m.missed.length}/${m.tried} wrong words for elements (containers) caught by an example`);
    for (const x of m.missed) console.log(`  missed: ${x}`);
  }
}

/* ---- TypeScript's own words: types by TypeScript's checker, components by React in the browser ---- */
let tsFailed = [];
const noPackages = missingPackages();
if (noPackages) console.log(`\nTypeScript: ${noPackages}, so its examples are skipped`);
else {
  const { TS } = loadEngine();
  const TS_ALL = [...TS_TYPES, ...TS_FILES, ...TS_REACT, ...TS_PACKS];
  const res = await runTsExamples(TS, TS_ALL, { browser: !!findChrome() });
  tsFailed = res.filter(r => !r.ok);
  const rows = tsCoverage(TS, res, NOT_RUN_TS);
  for (const [kind, title] of [['statement', 'sentences'], ['value', 'words']]) {
    console.log(`\nTypeScript and React ${title} (the Index)`.padEnd(65) + 'examples');
    for (const e of rows.filter(e => e.kind === kind)) console.log(e.label.slice(0, 62).padEnd(64) + (e.examples.length ? String(e.examples.length) : `none: ${e.why || 'no example yet'}`));
  }
  console.log('-'.repeat(72));
  console.log(`${res.length - tsFailed.length}/${res.length} TypeScript examples check and run as their words say${findChrome() ? '' : ' (types only: no browser for React)'}`);
  for (const f of tsFailed) console.log(`  NO: "${tsNameOf(f.ex)}" ${f.why}`);
  for (const [kind, title] of [['statement', 'Index sentences'], ['value', 'Index words']]) {
    const all = rows.filter(e => e.kind === kind), tested = all.filter(e => e.examples.length).length;
    console.log(`${tested}/${all.length} TypeScript ${title} have an example that runs (${Math.round(100 * tested / all.length)}%)`);
  }
  if (mutate) {
    const m = mutateTypeWords(TS, TS_ALL);
    console.log(`mutations: ${m.tried - m.missed.length}/${m.tried} wrong words for types caught by the checker`);
    for (const x of m.missed) console.log(`  missed: ${x}`);
  }
}
if (failed.length || jsFailed.length || cppFailed.length || browserFailed.length || tsFailed.length) process.exitCode = 1;

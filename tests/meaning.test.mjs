// The round trip proves sentences rebuild the same code. It can't prove the words are true: a rule that said
// a - b as "a plus b", and read "a plus b" back as a - b, would pass it. These tests run an example of each of the
// Python writer's value words and statements on concrete values (tests/helpers/meaning_python.mjs), and of the
// JavaScript writer's Mechanics on a stand-in page (tests/helpers/meaning_js.mjs), and check the result is what
// the words say, worked out by hand. C++ programs and Arduino sketches are compiled and run for real
// (tests/helpers/meaning_cpp_examples.mjs). In a real browser (Chrome or Edge, without a window), the same
// JavaScript examples run again, and the website's Structure and Styling are checked by what the browser makes of
// them (tests/helpers/meaning_html.mjs). `npm run meaning` prints which rules have an example.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadEngine, ROOT } from './helpers/engine.mjs';
import { runExamples, ruleCoverage, ruleLabel, statementLabel, nameOf } from './helpers/meaning.mjs';
import { EXAMPLES, STATEMENTS, NOT_RUN } from './helpers/meaning_python.mjs';
import { runJsExamples, indexCoverage, jsNameOf } from './helpers/meaning_web.mjs';
import { JS_VALUES, JS_STATEMENTS, NOT_RUN_JS } from './helpers/meaning_js.mjs';
import { findCompiler, runCppExamples, cppIndexCoverage, mutateCppWords, cppNameOf } from './helpers/meaning_cpp.mjs';
import { CPP_VALUES, CPP_STATEMENTS, CPP_SKETCHES, NOT_RUN_CPP } from './helpers/meaning_cpp_examples.mjs';
import { findChrome } from './helpers/browser.mjs';
import { runJsInBrowser, runSiteInBrowser, siteCoverage, siteNameOf, mutateContainers } from './helpers/meaning_browser.mjs';
import { compileExample } from './helpers/meaning_web.mjs';
import { HTML_STRUCTURE, HTML_STYLING, NOT_RUN_HTML } from './helpers/meaning_html.mjs';

const { L, WEB, CPP } = loadEngine();
const ALL = [...EXAMPLES, ...STATEMENTS];
const results = runExamples(L, ALL);

test('meaning: every example gives what its words say', () => {
  const bad = results.filter(r => !r.ok).map(r => `"${nameOf(r.ex)}" ${r.why}\n    ${r.code.trim().replace(/\n+/g, '\n    ')}`);
  assert.deepEqual(bad, []);
});

test('meaning: every value word and statement has an example that runs, or says why not', () => {
  const rows = ruleCoverage(L, results, NOT_RUN);
  const missing = rows.filter(r => !r.examples.length && !r.why).map(r => r.label);
  assert.deepEqual(missing, [], 'these rules have no example: add one to tests/helpers/meaning_python.mjs');
  // the list of rules with none stays true: each names one rule, and that rule still has no example
  for (const [k, why] of Object.entries(NOT_RUN)) {
    const named = rows.filter(r => r.label.startsWith(k));
    assert.equal(named.length, 1, `NOT_RUN "${k}" names ${named.length} rules`);
    assert.equal(named[0].examples.length, 0, `"${k}" has an example now: take it out of NOT_RUN (${why})`);
  }
});

test('meaning: a wrong rule is caught, whatever the reader says', () => {
  // its own engine, so the others' rules stay right
  const { L: W } = loadEngine();
  const rule = (label) => W.rules.EXPR_RULES.find(r => ruleLabel(r).startsWith(label));
  const wrong = [['minus →', ' + '], ['is greater than or equal to →', ' > '], ['last item of x →', '$1[0]'], ['x contains y →', '$1 in $2']];
  for (const [label, to] of wrong) {
    const r = rule(label), was = r.to;
    r.to = to;
    try {
      const caught = runExamples(W, EXAMPLES).filter(x => !x.ok);
      assert.ok(caught.length, `"${label.replace(' →', '')}" written as ${to.trim()} passed every example`);
    } finally { r.to = was; }
  }
  // statements: one doing another's work, with the same words to fill in
  const statement = (label) => W.rules.STATEMENTS.find(r => statementLabel(r).startsWith(label));
  for (const [label, as] of [['increase x', 'decrease x'], ['repeat until', 'while x'], ['take x out of', 'take item x out of'], ['count down x from', 'for each x in'], ['otherwise if x', 'if x']]) {
    const r = statement(label), was = r.fn;
    r.fn = statement(as).fn;
    try {
      assert.ok(runExamples(W, STATEMENTS).some(x => !x.ok), `"${label}" doing what "${as}" does passed every example`);
    } finally { r.fn = was; }
  }
});

/* ------------------------------------------------------------------ the JavaScript writer (website Mechanics) */

const JS_ALL = [...JS_VALUES, ...JS_STATEMENTS];
const jsResults = await runJsExamples(WEB, JS_ALL);

test('meaning, JavaScript: every example does what its words say, on a stand-in page', () => {
  const bad = jsResults.filter(r => !r.ok).map(r => `"${jsNameOf(r.ex)}" ${r.why}\n    ${(r.code || '').trim().replace(/\n+/g, '\n    ')}`);
  assert.deepEqual(bad, []);
});

test('meaning, JavaScript: every Mechanics entry in the Index has an example that runs, or says why not', () => {
  const rows = indexCoverage(WEB, jsResults, NOT_RUN_JS);
  const missing = rows.filter(r => !r.examples.length && !r.why).map(r => r.label);
  assert.deepEqual(missing, [], 'these Index entries have no example: add one to tests/helpers/meaning_js.mjs');
  for (const [k, why] of Object.entries(NOT_RUN_JS)) {
    const named = rows.filter(r => r.label.startsWith(k));
    assert.equal(named.length, 1, `NOT_RUN_JS "${k}" names ${named.length} entries`);
    assert.equal(named[0].examples.length, 0, `"${k}" has an example now: take it out of NOT_RUN_JS (${why})`);
  }
});

test('meaning, JavaScript: a wrong word is caught', async () => {
  // its own engine, so the others' words stay right
  const { WEB: W } = loadEngine();
  const entry = (word) => W.JS_WORDS.find(([re]) => new RegExp(re.source, 'i').test(word));
  for (const [word, to] of [['minus', ' + '], ['is at least', ' > '], ['is not nothing', ' == null'], ['and', ' || ']]) {
    const e = entry(word), was = e[1];
    e[1] = to;
    try {
      assert.ok((await runJsExamples(W, JS_ALL)).some(r => !r.ok), `"${word}" written as ${to.trim()} passed every example`);
    } finally { e[1] = was; }
  }
});

/* ------------------------------------------------------------------ the C++ writer: programs and sketches */

// Compiled and run for real (g++, or Visual Studio's cl on Windows). With no compiler, these are skipped.
const CPP_ALL = [...CPP_VALUES, ...CPP_STATEMENTS, ...CPP_SKETCHES];
const cc = findCompiler();
const noCompiler = cc ? false : 'no C++ compiler (g++, or Visual Studio with C++)';
const cppResults = cc ? runCppExamples(CPP, CPP_ALL) : [];

test('meaning, C++: every program and sketch does what its words say, compiled and run', { skip: noCompiler }, () => {
  const bad = cppResults.filter(r => !r.ok).map(r => `"${cppNameOf(r.ex)}" ${r.why}\n    ${(r.code || '').trim().replace(/\n+/g, '\n    ')}`);
  assert.deepEqual(bad, []);
});

test('meaning, C++: every Index entry for programs and sketches has an example that runs, or says why not', { skip: noCompiler }, () => {
  const rows = cppIndexCoverage(CPP, cppResults, NOT_RUN_CPP);
  const missing = rows.filter(r => !r.examples.length && !r.why).map(r => r.label);
  assert.deepEqual(missing, [], 'these Index entries have no example: add one to tests/helpers/meaning_cpp_examples.mjs');
  for (const [k, why] of Object.entries(NOT_RUN_CPP)) {
    const named = rows.filter(r => r.label.startsWith(k));
    assert.equal(named.length, 1, `NOT_RUN_CPP "${k}" names ${named.length} entries`);
    assert.equal(named[0].examples.length, 0, `"${k}" has an example now: take it out of NOT_RUN_CPP (${why})`);
  }
});

test('meaning, C++: a wrong word is caught', { skip: noCompiler }, () => {
  // its own engine, so the others' words stay right; only the examples whose code changes are run again
  const { CPP: C } = loadEngine();
  const m = mutateCppWords(C, CPP_ALL, (re) => /is at least|minus|\\band/.test(re.source));
  assert.equal(m.tried, 3);
  assert.deepEqual(m.missed, []);
});

/* ------------------------------------------------------------------ in a real browser: JavaScript, HTML and CSS */

const noBrowser = findChrome() ? false : 'no Chrome or Edge (set CHROME_PATH)';
const HTML_ALL = [...HTML_STRUCTURE, ...HTML_STYLING];
const [browserJs, browserSite] = noBrowser ? [[], []] : [await runJsInBrowser(WEB, JS_ALL), await runSiteInBrowser(WEB, HTML_ALL)];

test('meaning, in a real browser: every JavaScript example does what its words say in Chrome', { skip: noBrowser }, () => {
  const bad = browserJs.filter(r => !r.ok).map(r => `"${jsNameOf(r.ex)}" ${r.why}`);
  assert.deepEqual(bad, []);
});

test('meaning, in a real browser: a wrong JavaScript word is caught there too', { skip: noBrowser }, async () => {
  const { WEB: W } = loadEngine();
  const e = W.JS_WORDS.find(([re]) => new RegExp(re.source, 'i').test('minus')), was = e[1];
  const before = JS_ALL.map(ex => compileExample(W, ex).code);
  e[1] = ' + ';
  try {
    const changed = JS_ALL.filter((ex, k) => compileExample(W, ex).code !== before[k]);
    assert.ok(changed.length && (await runJsInBrowser(W, changed)).some(r => !r.ok), '"minus" written as + passed every example in the browser');
  } finally { e[1] = was; }
});

test('meaning, HTML and CSS: every Structure and Styling example does what its words say in Chrome', { skip: noBrowser }, () => {
  const bad = browserSite.filter(r => !r.ok).map(r => `"${siteNameOf(r.ex)}" ${r.why}\n    ${(r.css || '').trim().replace(/\n+/g, '\n    ')}`);
  assert.deepEqual(bad, []);
});

test('meaning, HTML and CSS: every Structure and Styling entry in the Index has an example that runs, or says why not', { skip: noBrowser }, () => {
  const rows = siteCoverage(WEB, browserSite, NOT_RUN_HTML);
  assert.deepEqual(rows.filter(r => !r.examples.length && !r.why).map(r => r.label), [], 'these Index entries have no example: add one to tests/helpers/meaning_html.mjs');
  for (const [k, why] of Object.entries(NOT_RUN_HTML)) {
    const named = rows.filter(r => r.label.startsWith(k));
    assert.equal(named.length, 1, `NOT_RUN_HTML "${k}" names ${named.length} entries`);
    assert.equal(named[0].examples.length, 0, `"${k}" has an example now: take it out of NOT_RUN_HTML (${why})`);
  }
});

test('meaning, HTML: a wrong word for an element is caught', { skip: noBrowser }, async () => {
  const { WEB: W } = loadEngine();
  const m = await mutateContainers(W, HTML_ALL, (k) => k === 'navigation bar' || k === 'side panel');
  assert.equal(m.tried, 2);
  assert.deepEqual(m.missed, []);
});

/* ------------------------------------------------------------------ known wrong translations warn */

test('meaning: each known wrong translation in INTUICODE.md that its example shows warns on its line', () => {
  const doc = readFileSync(path.join(ROOT, 'INTUICODE.md'), 'utf8').replace(/\r\n/g, '\n');
  const known = doc.slice(doc.indexOf('## Known wrong translations'), doc.indexOf('## About the examples'));
  const compile = {
    python: (text) => L.compileProject({ sections: [{ id: 'main', file: 'main', text }] }).results.main,
    js: (text) => WEB.compileWebsite({ sections: [{ id: 'structure', file: 'structure', text: '' }, { id: 'styling', file: 'styling', text: '' }, { id: 'mechanics', file: 'mechanics', text }] }).results.mechanics,
  };
  let checked = 0;
  for (const part of known.split(/\n(?=### )/)) {
    // the rows still wrong: "| `what you write` … | what you get | …", after the table's header
    const rows = [...part.matchAll(/^\| `([^`]+)`[^|]*\| ([^|]+) \|/gm)].map(m => ({ write: m[1], get: m[2] }));
    for (const ex of part.matchAll(/```intuicode (\w+)\n([\s\S]*?)```/g)) {
      if (!compile[ex[1]]) continue;
      const lines = ex[2].split('\n'), r = compile[ex[1]](ex[2]);
      for (const row of rows) {
        const at = lines.findIndex(l => l.trim() === row.write);
        if (at < 0) continue;
        assert.ok(r.info[at].warns.length, `"${row.write}" (${ex[1]}) gives no warning on its line`);
        assert.match(row.get, /warning/, `the table says what "${row.write}" gives, but not that it warns`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 2, `only ${checked} rows were found in their examples`);
});

test('meaning: Python\'s is, written as Python, warns; is in words doesn\'t', () => {
  const warnsOf = (text) => L.compileProject({ sections: [{ id: 'main', file: 'main', text: 'python: a = [1]\npython: b = [1]\n' + text + '\n' }] }).results.main.info[2].warns;
  for (const line of ['same = a is b', 'diff = a is not b', 'flag = a is True'])
    assert.match(warnsOf(line).join(' '), /Python's own `is` checks for the very same object.*python: /, line);
  for (const line of ['set same to a is b', 'same = a is nothing', 'same = a is not nothing', 'more = a is more than b', 'inside = 1 is in a', 'even = 4 is even', 'same = "a is b"'])
    assert.deepEqual([...warnsOf(line)].filter(w => /very same object/.test(w)), [], line);
});

test('meaning: a fetch at the left edge of a page\'s script warns; one in a block or a module doesn\'t', () => {
  const warnsOf = (text, at) => [...WEB.compileWebsite({ sections: [{ id: 'structure', file: 'structure', text: '' }, { id: 'styling', file: 'styling', text: '' }, { id: 'mechanics', file: 'mechanics', text }] }).results.mechanics.info[at].warns].filter(w => /classic script/.test(w));
  assert.equal(warnsOf('fetch from "/api/items" and store in items\n', 0).length, 1);
  assert.equal(warnsOf('send 1 to "/api/items"\n', 0).length, 1);
  assert.deepEqual(warnsOf('when the page has loaded\n    fetch from "/api/items" and store in items\n', 1), []);
  assert.deepEqual(warnsOf('bring in total from "./maths.js"\nfetch from "/api/items" and store in items\n', 1), []);
});

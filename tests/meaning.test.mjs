// The round trip proves sentences rebuild the same code. It can't prove the words are true: a rule that said
// a - b as "a plus b", and read "a plus b" back as a - b, would pass it. These tests run an example of each of the
// Python writer's value words and statements on concrete values (tests/helpers/meaning_python.mjs), and of the
// JavaScript writer's Mechanics on a stand-in page (tests/helpers/meaning_js.mjs), and check the result is what
// the words say, worked out by hand. C++ programs and Arduino sketches are compiled and run for real
// (tests/helpers/meaning_cpp_examples.mjs). In a real browser (Chrome or Edge, without a window), the same
// JavaScript examples run again, and the website's Structure and Styling are checked by what the browser makes of
// them (tests/helpers/meaning_html.mjs). TypeScript's own words: types by TypeScript's checker, components by
// React in the browser (tests/helpers/meaning_ts_examples.mjs). `npm run meaning` prints which rules have an example.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadEngine, ROOT } from './helpers/engine.mjs';
import { runExamples, ruleCoverage, ruleLabel, statementLabel, nameOf } from './helpers/meaning.mjs';
import { EXAMPLES, STATEMENTS, NOT_RUN } from './helpers/meaning_python.mjs';
import { runJsExamples, indexCoverage, jsNameOf, jsRuleCoverage, mutateJsRules } from './helpers/meaning_web.mjs';
import { JS_VALUES, JS_STATEMENTS, NOT_RUN_JS, JS_RULES_NOT_RUN } from './helpers/meaning_js.mjs';
import { findCompiler, runCppExamples, runCppProjects, cppIndexCoverage, mutateCppWords, cppNameOf } from './helpers/meaning_cpp.mjs';
import { CPP_VALUES, CPP_STATEMENTS, CPP_SKETCHES, CPP_PROJECTS, NOT_RUN_CPP } from './helpers/meaning_cpp_examples.mjs';
import { findChrome } from './helpers/browser.mjs';
import { runJsInBrowser, runSiteInBrowser, siteCoverage, siteNameOf, mutateContainers } from './helpers/meaning_browser.mjs';
import { compileExample } from './helpers/meaning_web.mjs';
import { HTML_STRUCTURE, HTML_STYLING, NOT_RUN_HTML } from './helpers/meaning_html.mjs';
import { missingPackages, runTsExamples, tsCoverage, tsNameOf, mutateTypeWords } from './helpers/meaning_ts.mjs';
import { TS_TYPES, TS_FILES, TS_REACT, TS_PACKS, NOT_RUN_TS } from './helpers/meaning_ts_examples.mjs';

const { L, WEB, CPP, TS } = loadEngine();
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

test('meaning, JavaScript: every rule (value words, words, statements) has an example that runs, or says why not', () => {
  const rows = jsRuleCoverage(WEB, jsResults, JS_RULES_NOT_RUN);
  assert.deepEqual(rows.filter(r => !r.examples.length && !r.why).map(r => r.label), [], 'these rules have no example: add one to tests/helpers/meaning_js.mjs');
  for (const [k, why] of Object.entries(JS_RULES_NOT_RUN)) {
    const named = rows.filter(r => r.label === k);
    assert.equal(named.length, 1, `JS_RULES_NOT_RUN "${k}" names ${named.length} rules`);
    assert.equal(named[0].examples.length, 0, `"${k}" has an example now: take it out of JS_RULES_NOT_RUN (${why})`);
  }
});

test('meaning, JavaScript: a rule doing another\'s work is caught', async () => {
  const { WEB: W } = loadEngine();
  const m = await mutateJsRules(W, JS_ALL, (said) => ['length of x', 'x trimmed', 'when … is clicked', 'otherwise if …', 'for each … in …', 'set the … of … to …'].includes(said));
  assert.equal(m.tried, 6);
  assert.deepEqual(m.missed, []);
});

/* ------------------------------------------------------------------ the C++ writer: programs and sketches */

// Compiled and run for real (g++, or Visual Studio's cl on Windows). With no compiler, these are skipped.
const CPP_ALL = [...CPP_VALUES, ...CPP_STATEMENTS, ...CPP_SKETCHES];
const cc = findCompiler();
const noCompiler = cc ? false : 'no C++ compiler (g++, or Visual Studio with C++)';
const cppResults = cc ? runCppExamples(CPP, CPP_ALL) : [];
// programs of several files: headers and .cpp files, each from its own sentences, built together and run
const projectResults = cc ? runCppProjects(CPP, CPP_PROJECTS) : [];

test('meaning, C++: a program of several files (a header, its .cpp, main.cpp) builds and does what its words say', { skip: noCompiler }, () => {
  const bad = projectResults.filter(r => !r.ok).map(r => `${Object.keys(r.ex.files).join(' + ')}: ${r.why}`);
  assert.deepEqual(bad, []);
});

test('meaning, C++: every program and sketch does what its words say, compiled and run', { skip: noCompiler }, () => {
  const bad = cppResults.filter(r => !r.ok).map(r => `"${cppNameOf(r.ex)}" ${r.why}\n    ${(r.code || '').trim().replace(/\n+/g, '\n    ')}`);
  assert.deepEqual(bad, []);
});

test('meaning, C++: every Index entry for programs and sketches has an example that runs, or says why not', { skip: noCompiler }, () => {
  // (a project's sentences count for its Index entries too: "declare …" is said in a header)
  const rows = cppIndexCoverage(CPP, cppResults.concat(projectResults.map(r => ({ ...r, ex: { lines: Object.values(r.ex.files).join('\n') } }))), NOT_RUN_CPP);
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

/* ------------------------------------------------------------------ TypeScript's own words: types and React */

const noPackages = missingPackages() || false;   // (node:test skips on null too)
const TS_ALL = [...TS_TYPES, ...TS_FILES, ...TS_REACT, ...TS_PACKS];
const tsResults = noPackages ? [] : await runTsExamples(TS, TS_ALL, { browser: !noBrowser });

test('meaning, TypeScript: every example\'s types check as its words say, and its components do what they say in React', { skip: noPackages }, () => {
  const bad = tsResults.filter(r => !r.ok).map(r => `"${tsNameOf(r.ex)}" ${r.why}`);
  assert.deepEqual(bad, []);
});

test('meaning, TypeScript: every entry in its Index has an example that runs, or says why not', { skip: noPackages || noBrowser }, () => {
  const rows = tsCoverage(TS, tsResults, NOT_RUN_TS);
  assert.deepEqual(rows.filter(r => !r.examples.length && !r.why).map(r => r.label), [], 'these Index entries have no example: add one to tests/helpers/meaning_ts_examples.mjs');
  for (const [k, why] of Object.entries(NOT_RUN_TS)) {
    const named = rows.filter(r => r.label.startsWith(k));
    assert.equal(named.length, 1, `NOT_RUN_TS "${k}" names ${named.length} entries`);
    assert.equal(named[0].examples.length, 0, `"${k}" has an example now: take it out of NOT_RUN_TS (${why})`);
  }
});

test('meaning, TypeScript: a wrong word for a type is caught by the checker', { skip: noPackages }, () => {
  const { TS: T } = loadEngine();
  const m = mutateTypeWords(T, TS_ALL, (k) => k === 'a number' || k === 'text');
  assert.ok(m.tried >= 2);
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
  assert.ok(checked >= 1, `only ${checked} rows were found in their examples`);
});

test('meaning: Python\'s is, written as Python, warns; is in words doesn\'t', () => {
  const warnsOf = (text) => L.compileProject({ sections: [{ id: 'main', file: 'main', text: 'python: a = [1]\npython: b = [1]\n' + text + '\n' }] }).results.main.info[2].warns;
  for (const line of ['same = a is b', 'diff = a is not b', 'flag = a is True'])
    assert.match(warnsOf(line).join(' '), /Python's own `is` checks for the very same object.*python: /, line);
  for (const line of ['set same to a is b', 'same = a is nothing', 'same = a is not nothing', 'more = a is more than b', 'inside = 1 is in a', 'even = 4 is even', 'same = "a is b"'])
    assert.deepEqual([...warnsOf(line)].filter(w => /very same object/.test(w)), [], line);
});

test('meaning: script.js is a module when its code needs one (a wait at the left edge, bring in), and classic otherwise', () => {
  const site = (text) => WEB.compileWebsite({ sections: [{ id: 'structure', file: 'structure', text: 'add a heading "Hi"' }, { id: 'styling', file: 'styling', text: '' }, { id: 'mechanics', file: 'mechanics', text }] }).results;
  const tagOf = (text) => site(text).structure.text.match(/<script\b[^>]*>/)[0];
  for (const needs of ['fetch from "/api/items" and store in items', 'send 1 to "/api/items"', 'bring in total from "./maths.js"']) {
    assert.equal(tagOf(needs + '\n'), '<script type="module" src="script.js">', needs);
    assert.equal(site(needs + '\n').mechanics.info[0].warns.length, 0, needs);   // (the engine's array: its own realm)
    assert.match(WEB.previewDocument({ results: site(needs + '\n') }).html, /<script type="module">/, needs);
  }
  // (a classic script runs from a page opened straight from the disk; a module doesn't)
  for (const plain of ['when the page has loaded\n    fetch from "/api/items" and store in items', 'set n to 1', 'when the heading is clicked\n    show "hi"'])
    assert.equal(tagOf(plain + '\n'), '<script src="script.js">', plain);
});

// The round trip proves sentences rebuild the same code. It can't prove the words are true: a rule that said
// a - b as "a plus b", and read "a plus b" back as a - b, would pass it. These tests run an example of each of the
// Python writer's value words on concrete values (tests/helpers/meaning_python.mjs) and check the result is what
// the words say, worked out by hand. `npm run meaning` prints which rules have an example.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadEngine, ROOT } from './helpers/engine.mjs';
import { runExamples, ruleCoverage, ruleLabel } from './helpers/meaning.mjs';
import { EXAMPLES, NOT_RUN } from './helpers/meaning_python.mjs';

const { L, WEB } = loadEngine();
const results = runExamples(L, EXAMPLES);

test('meaning: every example gives what its words say', () => {
  const bad = results.filter(r => !r.ok).map(r => `"${r.ex.say}" ${r.why}\n    ${r.code.trim().replace(/\n+/g, '\n    ')}`);
  assert.deepEqual(bad, []);
});

test('meaning: every value word has an example that runs, or says why not', () => {
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
      const caught = runExamples(W, EXAMPLES).filter(x => !x.ok).map(x => x.ex.say);
      assert.ok(caught.length, `"${label.replace(' →', '')}" written as ${to.trim()} passed every example`);
    } finally { r.to = was; }
  }
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

// Close matches by meaning (lang/intent.js) and Predictive Mode for code (lang/complete.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/engine.mjs';

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['lang/web_write.js', 'lang/python.js', 'lang/cpp_write.js', 'lang/glossary_terms.js', 'lang/intent.js', 'lang/complete.js']) {
  vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const I = ctx.IntuiIntent, C = ctx.IntuiComplete, WEB = ctx.IntuiWeb, CPP = ctx.IntuiCpp;
const PY = ctx.IntuiLang.python || ctx.IntuiLang;
const STYLING = WEB.WORDS.styling.map(([p]) => ({ pattern: `style ‹name›: ${p}`, role: 'styling' })).concat({ pattern: 'style ‹name›: border ‹2› ‹navy›', role: 'styling' }, { pattern: 'style ‹name›: no border', role: 'styling' });
const top = (typed, templates, opts) => { const m = I.match(typed, templates, opts)[0]; return m ? [m.pattern, m.other] : null; };

test('a page sentence by meaning, not by how it starts', () => {
  const graph = top('add a data graph', WEB.TEMPLATES, { role: 'structure' });
  assert.match(graph[0], /^add a (?:chart|drawing)/);
  assert.equal(graph[1], null);
  assert.match(top('add a box', WEB.TEMPLATES, { role: 'structure' })[0], /^add a (?:box|section) called ‹name›$/);
  assert.equal(top('when the button is pressed', WEB.TEMPLATES, { role: 'mechanics' })[0], 'when ‹name› is clicked');
});

test('a border is styling: offered from the page, marked as going in Styling, and not as "no border"', () => {
  const border = top('add a border', WEB.TEMPLATES, { role: 'structure', extra: STYLING });
  assert.match(border[0], /border/);
  assert.doesNotMatch(border[0], /no border/);
  assert.equal(border[1], 'Styling');
  const inStyling = I.match('make the background blue', WEB.TEMPLATES, { role: 'styling', extra: STYLING })[0];
  assert.match(inStyling.pattern, /background/);
  assert.equal(inStyling.other, null);
});

test('Python and Arduino by meaning', () => {
  assert.equal(top('ask the user their name', PY.TEMPLATES, {})[0], 'ask "‹question›" and store in ‹name›');
  assert.equal(top('read the sensor', CPP.TEMPLATES, {})[0], 'read pin ‹2› and store in ‹pressed›');
  assert.match(top('blink the led', CPP.TEMPLATES, {})[0], /^turn pin|^make pin/);
});

test('nothing for nothing: little words alone, or words no sentence shares', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(I.match('the a an', WEB.TEMPLATES, {}))), []);
  assert.deepEqual(JSON.parse(JSON.stringify(I.match('quaternion eigenvalues', PY.TEMPLATES, {}))), []);
});

test('meanings: synonyms meet, quoted text and typed ‹slots› are left out', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(I.meanings('Show a GRAPH of "sales" in ‹area›'))), ['show', 'chart']);
  assert.ok(I.meanings('turn pin ‹13› on', true).includes('led'), 'a sentence\'s extra meanings count');
});

const done = (lang, before, file = '') => { const r = C.complete(lang, before, file, { glossary: ctx.IntuiGlossaryTerms }); return r ? r.label : null; };

test('code: each language\'s words, tags, attributes and properties', () => {
  assert.equal(done('html', '<butt'), 'button');
  assert.equal(done('html', '<button aria-exp'), 'aria-expanded');
  assert.equal(done('css', '  justify-c'), 'justify-content');
  assert.equal(done('js', 'document.getEl'), 'getElementById');
  assert.equal(done('python', 'for i in ran'), 'range');
  assert.equal(done('arduino', 'digitalW'), 'digitalWrite');
  assert.equal(done('cpp', 'std::vec'), 'std::vector');
  assert.equal(done('sql', 'SELECT * FR'), 'FROM');
  assert.equal(done('bash', 'gi'), 'git');
});

test('code: the file\'s own names first, and what follows them', () => {
  assert.equal(done('js', 'helpTo', 'const helpToggle = 1;\nhelpToggle.focus();'), 'helpToggle');
  const attr = C.complete('html', '<svg vie', '', {});
  assert.equal(attr.rest, 'wBox=""', 'an attribute comes with its ="" to fill in');
  assert.equal(C.complete('css', '  backgr', '', {}).rest, 'ound: ');
  assert.equal(C.complete('sql', 'sel', '', {}).rest, 'ect', 'typed in small letters, carried on in them');
});

test('code: not in comments, not in quoted text, not for one letter', () => {
  assert.equal(done('python', '# a comment pri'), null);
  assert.equal(done('python', 'x = "pri'), null);
  assert.equal(done('python', 'p'), null);
});

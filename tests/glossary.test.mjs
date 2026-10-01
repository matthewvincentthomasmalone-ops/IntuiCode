// The glossary (Ctrl+H, and "What's here" under a line of code): finding a language's terms in code, and the
// less obvious words in sentences; then the real terms file is checked for consistency and coverage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, loadEngine } from './helpers/engine.mjs';

const plain = (x) => JSON.parse(JSON.stringify(x));
function glossaryWith(terms) {
  const ctx = { console };
  ctx.window = ctx;
  vm.createContext(ctx);
  if (terms) ctx.IntuiGlossaryTerms = terms;
  else vm.runInContext(readFileSync(path.join(ROOT, 'lang/glossary_terms.js'), 'utf8'), ctx, { filename: 'lang/glossary_terms.js' });
  vm.runInContext(readFileSync(path.join(ROOT, 'lang/glossary.js'), 'utf8'), ctx, { filename: 'lang/glossary.js' });
  return ctx.IntuiGlossary;
}
const names = (list) => plain(list.map(e => e.t));

// a few terms of each kind, enough to test the finding
const G = glossaryWith({
  python: [{ t: 'print()', m: ['print'], k: 'function', s: 'Shows values.' }, { t: 'f-string', k: 'concept', s: 'Text with values in it.' }, { t: '+=', k: 'operator', s: 'Adds to a value.' }, { t: 'def', k: 'keyword', s: 'Defines a function.', see: ['return'] }, { t: 'return', k: 'keyword', s: 'Hands a value back.' }, { t: 'randint', m: ['randint', 'random.randint'], k: 'function', s: 'A random whole number.' }],
  cpp: [{ t: 'std::cout', m: ['std::cout', 'cout'], k: 'object', s: 'Standard output.' }, { t: '<<', k: 'operator', s: 'Sends to a stream.' }, { t: ';', k: 'punctuation', s: 'Ends a statement.' }, { t: 'int', k: 'type', s: 'A whole number.' }],
  arduino: [{ t: 'pinMode()', m: ['pinMode'], k: 'function', s: 'Sets a pin up.' }, { t: 'Serial.println()', m: ['Serial.println', 'println'], k: 'function', s: 'Sends a line.' }, { t: 'OUTPUT', k: 'constant', s: 'A pin that drives.' }],
  html: [{ t: '<button>', k: 'tag', s: 'A button.' }, { t: 'id=', k: 'attribute', s: 'A unique name.' }, { t: '<!DOCTYPE html>', k: 'declaration', s: 'Modern HTML.' }],
  css: [{ t: 'display:', k: 'property', s: 'How a box lays out.' }, { t: 'flex', k: 'value', s: 'A row or column.' }, { t: 'px', k: 'unit', s: 'Pixels.' }, { t: '.class selector', k: 'selector', s: 'Matches a class.' }, { t: '#id selector', k: 'selector', s: 'Matches an id.' }, { t: ':hover', k: 'selector', s: 'Under the pointer.' }, { t: 'rgba()', k: 'function', s: 'A colour with see-through.' }, { t: '--', k: 'concept', s: 'A custom property.' }],
  js: [{ t: 'addEventListener()', m: ['addEventListener'], k: 'method', s: 'Waits for an event.' }, { t: '=>', k: 'operator', s: 'An arrow function.' }, { t: 'const', k: 'keyword', s: 'A name that is not reassigned.' }, { t: 'template literal', k: 'concept', s: 'Text in backticks.' }],
  say: [{ t: 'hero', k: 'web word', s: 'The big first section.', packs: ['web'] }, { t: 'cta', k: 'web word', s: 'Call to action.', packs: ['web'] }, { t: 'store in', k: 'sentence word', s: 'Keeps a result.' }, { t: 'serial monitor', k: 'board word', s: 'Messages from the board.', packs: ['arduino'] }],
});

test('code: names, dotted names and their parts, operators; nothing inside quotes or comments', () => {
  assert.deepEqual(names(G.find('python', 'secret = random.randint(1, 10)  # print later\nprint(f"Hi {name}")\nscore += 1')), ['f-string', 'randint', 'print()', '+='], 'whole-text ideas (f-strings) first, then the tokens in order');
  assert.deepEqual(names(G.find('python', 'print("def return")')), ['print()'], 'words in text are not keywords');
  assert.deepEqual(names(G.find('cpp', 'int x = 1;\nstd::cout << x << std::endl;')), ['int', ';', 'std::cout', '<<']);
  assert.deepEqual(names(G.find('arduino', 'pinMode(LED, OUTPUT);\nSerial.println("on"); // int')), ['pinMode()', 'OUTPUT', ';', 'Serial.println()'], 'a sketch: Arduino terms, then C++');
  assert.deepEqual(names(G.find('js', 'const go = document.getElementById("go");\ngo.addEventListener("click", () => { out.textContent = `x`; });')), ['template literal', 'const', 'addEventListener()', '=>']);
});

test('HTML and CSS are read by their own parts', () => {
  assert.deepEqual(names(G.find('html', '<!DOCTYPE html>\n<button id="go" type="button">Go</button>')), ['<!DOCTYPE html>', '<button>', 'id=']);
  assert.deepEqual(names(G.find('css', '.card:hover {\n  display: flex;\n  background: rgba(0, 0, 0, 0.4);\n  padding: 12px;\n  color: var(--main);\n}\n#go { }')), ['.class selector', ':hover', 'display:', 'flex', 'rgba()', 'px', '--', '#id selector']);
});

test('sentences: only the listed words, whole words outside quotes, and only for their kind of project', () => {
  assert.deepEqual(names(G.find('say', 'add a section called hero\n    add a button called cta saying "the hero button"', { pack: 'web' })), ['hero', 'cta']);
  assert.deepEqual(names(G.find('say', 'add a section called hero', { pack: 'python' })), [], 'a web word in a Python project');
  assert.deepEqual(names(G.find('say', 'ask "Age? " and store in age')), ['store in']);
  assert.deepEqual(names(G.find('say', 'show "store in the heroes"', { pack: 'web' })), [], 'inside quotes, and parts of words, are not terms');
  assert.deepEqual(names(G.find('say', 'start the serial monitor at 9600', { pack: 'arduino' })), ['serial monitor']);
});

test('related terms, and looking one up', () => {
  assert.deepEqual(names(G.related(G.get('python', 'def'))), ['return']);
  assert.equal(G.get('arduino', 'std::cout').t, 'std::cout', 'a sketch can look up C++ terms');
  assert.ok(G.all('arduino').length > G.all('cpp').length);
});

/* ---------- the real terms ---------- */
const termsFile = path.join(ROOT, 'lang/glossary_terms.js');
test('the terms file: every entry complete, no clashes, every related term exists', { skip: !existsSync(termsFile) && 'lang/glossary_terms.js not written yet' }, () => {
  const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readFileSync(termsFile, 'utf8'), ctx);
  const T = ctx.IntuiGlossaryTerms;
  for (const lang of ['python', 'cpp', 'arduino', 'html', 'css', 'js', 'say']) {
    const list = T[lang];
    assert.ok(Array.isArray(list) && list.length >= 20, `${lang}: has terms`);
    const ts = new Set(), ms = new Map();
    for (const e of list) {
      for (const f of ['t', 'k', 's']) assert.ok(typeof e[f] === 'string' && e[f].trim(), `${lang} ${e.t}: has ${f}`);
      assert.ok(!ts.has(e.t), `${lang}: "${e.t}" once`); ts.add(e.t);
      for (const m of e.m || [e.t]) { const key = lang === 'say' ? m.toLowerCase() : m; assert.ok(!ms.has(key), `${lang}: "${m}" belongs to one term (${ms.get(key)} and ${e.t})`); ms.set(key, e.t); }
      assert.ok(!/\b(simply|just|easy|easily|obviously)\b|!/.test(e.s), `${lang} ${e.t}: plain, not patronising: ${e.s}`);
    }
    for (const e of list) for (const r of e.see || []) assert.ok(ts.has(r), `${lang} ${e.t}: related "${r}" exists`);
  }
});

test('the terms cover what the built-in projects actually write', { skip: !existsSync(termsFile) && 'lang/glossary_terms.js not written yet' }, () => {
  const GL = glossaryWith();
  const { L, WEB, CPP, BP } = loadEngine();
  const want = {
    python: ['print', 'input', 'int', 'def', 'return', 'while', 'if', 'for', 'import', 'random.randint', '+=', 'True'],
    arduino: ['pinMode', 'digitalWrite', 'delay', 'Serial.begin', 'Serial.println', 'void', 'setup', 'loop', 'HIGH', 'LOW', 'OUTPUT'],
    js: ['addEventListener', 'getElementById', 'const', 'textContent'],
    css: ['background:', 'color:', 'padding:', 'border-radius:'],
    html: ['<button>', '<h1>', 'id='],
  };
  const out = { python: '', arduino: '', js: '', css: '', html: '' };
  for (const src of BP.BUILT_IN) {
    const bp = BP.parse(src);
    if (bp.kind !== 'project') continue;
    const f = BP.fill(bp, {});
    const sections = Object.entries(f).map(([id, text]) => ({ id, file: id, text }));
    if (bp.layout === 'website') { const r = WEB.compileWebsite({ sections }).results; out.html += r.structure.text; out.css += r.styling.text; out.js += r.mechanics.text; }
    else if (bp.layout === 'arduino') out.arduino += CPP.compileCppProject({ kind: 'arduino', sections }).results.sketch.text;
    else if (bp.layout !== 'cpp') out.python += Object.values(L.compileProject({ sections }).results).map(r => r.text).join('\n');
  }
  for (const [lang, list] of Object.entries(want)) {
    const found = new Set(GL.find(lang, out[lang]).flatMap(e => [e.t, ...(e.m || [])]));
    const missing = list.filter(w => !found.has(w) && !found.has(w + '()') && !found.has(w.replace(/^.*\./, '')));
    assert.deepEqual(missing, [], `${lang}: these appear in the built-in projects and have entries`);
  }
});

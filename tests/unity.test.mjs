// Unity mode (lang/unity.js): code turned into sentences in place and back. A region nobody changed goes back
// exactly; a changed one is written in the context of the code around it, at its own indentation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadConverter, toSentences, ROOT } from './helpers/engine.mjs';

const { convert: convertWeb, WEB, CPP } = await loadConverter();
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['lang/languages.js', 'lang/project.js', 'lang/python.js', 'lang/unity.js']) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const U = ctx.IntuiUnity, W = { LANG: ctx.IntuiLang.python, WEB, CPP };
const plain = (x) => JSON.parse(JSON.stringify(x));
const convert = (kind, source) => (kind === 'python' ? { ok: true, exact: true, text: toSentences([source])[0] } : convertWeb(kind, source));

/* De-Regex lines from..to of code: the text with the sentences in place, and the region. */
async function deRegex(lang, code, from, to) {
  const lines = code.split('\n');
  const at = U.expand(lang, lines, from, to);
  const w = await U.toWords(lang, lines, at.from, at.to, convert);
  assert.ok(w.words, `${lang}: nothing came back (${w.reason})`);
  const out = lines.slice(0, at.from).concat(w.words, lines.slice(at.to + 1));
  return { lines: out, regions: [{ from: at.from, to: at.from + w.words.length - 1, original: w.original, words: w.words, base: w.base }], at, w };
}
const swap = (d, from, to) => { const lines = d.lines.map(l => (l.includes(from) ? l.replace(from, to) : l)); return lines; };

test('Unity: a selection grows to whole statements', () => {
  const py = ['def f(x):', '    if x:', '        a = 1', '    else:', '        a = 2', '    return a'];
  assert.deepEqual(plain(U.expand('python', py, 2, 2)), { from: 2, to: 2 });
  assert.deepEqual(plain(U.expand('python', py, 1, 1)), { from: 1, to: 4 }, 'an if takes its body and its else');
  assert.deepEqual(plain(U.expand('python', py, 3, 3)), { from: 1, to: 4 }, 'an else takes its if');
  assert.deepEqual(plain(U.expand('python', py, 2, 5)), { from: 1, to: 5 }, 'a deeper first line takes the block it is in');
  const js = ['function f() {', '  if (a) {', '    b();', '  } else {', '    c();', '  }', '}'];
  assert.deepEqual(plain(U.expand('js', js, 1, 1)), { from: 1, to: 5 });
  assert.deepEqual(plain(U.expand('js', js, 2, 3)), { from: 1, to: 5 });
  assert.deepEqual(plain(U.expand('js', ['let s = "{";', 'x();'], 0, 0)), { from: 0, to: 0 }, 'a brace in quotes is text');
  const html = ['<main>', '  <div>', '    <p>Hi</p>', '  </div>', '</main>'];
  assert.deepEqual(plain(U.expand('html', html, 1, 1)), { from: 1, to: 3 });
});

test('Unity: looking changes nothing (a region nobody changed goes back exactly)', async () => {
  const samples = {
    python: ['import math', '', 'def total(prices, tax=0.1):', '    s = 0', '    for p in prices:', '        s += p  # running', '    return s * (1 + tax)', ''].join('\n'),
    js: ['function f(n) {', '    let t = n * 2;', '    if (t > 3) {', '        console.log(t);', '    }', '    return t;', '}', ''].join('\n'),
    cpp: ['#include <iostream>', '', 'int main() {', '    int n = 3;', '    n += 2;', '    std::cout << n << std::endl;', '    return 0;', '}', ''].join('\n'),
    css: ['.card {', '  color: red;', '}', ''].join('\n'),
    html: ['<main>', '  <div id="box">', '    <p>Hi</p>', '  </div>', '</main>', ''].join('\n'),
  };
  const pick = { python: [4, 5], js: [2, 4], cpp: [4, 5], css: [0, 2], html: [1, 3] };
  for (const [lang, code] of Object.entries(samples)) {
    const d = await deRegex(lang, code, ...pick[lang]);
    assert.notDeepEqual(d.lines, code.split('\n'), `${lang}: became sentences`);
    const back = U.reRegex(lang, d.lines, d.regions, 0, W);
    assert.ok(back.ok);
    assert.equal(back.lines.join('\n'), code, `${lang}: exactly as it was`);
    assert.deepEqual(plain(back.regions), []);
  }
});

test('Unity: Python, changed in place, with the names around it known and what it needs added at the top', async () => {
  const code = ['def total(prices, tax=0.1):', '    s = 0', '    for p in prices:', '        s += p', '    return s * (1 + tax)', '', 'print(total([1, 2]))'].join('\n');
  const d = await deRegex('python', code, 2, 3);
  assert.deepEqual(d.lines.slice(2, 4), ['    for each p in prices', '        increase s by p']);
  const edited = swap(d, 'increase s by p', 'increase s by p plus random number from 1 to 6');
  const back = U.reRegex('python', edited, d.regions, 0, W);
  assert.ok(back.ok, JSON.stringify(back.problems));
  assert.equal(back.lines.join('\n'), ['import random', 'def total(prices, tax=0.1):', '    s = 0', '    for p in prices:', '        s += p + random.randint(1, 6)', '    return s * (1 + tax)', '', 'print(total([1, 2]))'].join('\n'));
  assert.deepEqual(plain(back.problems), [], 'prices and s are known from the code around it');
});

test('Unity: a region with an error stays as sentences and says why', async () => {
  const d = await deRegex('python', 'x = 1\ny = x + 1\n', 1, 1);
  const edited = d.lines.slice(); edited[1] = 'set y to the result of frobnicate with x';
  const back = U.reRegex('python', edited, d.regions, 0, W);
  assert.equal(back.ok, false);
  assert.ok(back.problems.some(p => p.line === 1 && p.errs.length));
  assert.equal(back.lines, edited);
});

test('Unity: C++ inside main, JavaScript in a file indented with 4 spaces, CSS, HTML and an Arduino loop', async () => {
  const cpp = await deRegex('cpp', ['#include <iostream>', '', 'int main() {', '    int n = 3;', '    n += 2;', '    std::cout << n << std::endl;', '    return 0;', '}'].join('\n'), 4, 4);
  assert.equal(cpp.lines[4], '    increase n by 2');
  const c2 = U.reRegex('cpp', swap(cpp, 'increase n by 2', 'increase n by 5'), cpp.regions, 0, W);
  assert.ok(c2.ok, JSON.stringify(c2.problems));
  assert.equal(c2.lines[4], '    n += 5;');

  const js = await deRegex('js', ['function f(n) {', '    let t = n * 2;', '    if (t > 3) {', '        console.log(t);', '    }', '    return t;', '}'].join('\n'), 2, 4);
  const j2 = U.reRegex('js', swap(js, 'show t', 'show t plus 1'), js.regions, 0, W);
  assert.ok(j2.ok, JSON.stringify(j2.problems));
  assert.deepEqual(j2.lines.slice(2, 5), ['    if (t > 3) {', '        console.log(t + 1);', '    }'], 'the file\'s 4-space indentation, not the writer\'s 2');

  const css = await deRegex('css', ['.card {', '  color: red;', '}', '', '.big {', '  font-size: 2em;', '}'].join('\n'), 0, 2);
  const s2 = U.reRegex('css', swap(css, 'red', 'blue'), css.regions, 0, W);
  assert.ok(s2.ok, JSON.stringify(s2.problems));
  assert.deepEqual(s2.lines.slice(0, 3), ['.card {', '  color: blue;', '}']);

  const html = await deRegex('html', ['<main>', '  <div id="box">', '    <p>Hi</p>', '  </div>', '</main>'].join('\n'), 1, 3);
  const h2 = U.reRegex('html', swap(html, '"Hi"', '"Hello"'), html.regions, 0, W);
  assert.ok(h2.ok, JSON.stringify(h2.problems));
  assert.deepEqual(h2.lines, ['<main>', '  <div id="box">', '    <p>Hello</p>', '  </div>', '</main>']);

  const ino = await deRegex('arduino', ['void setup() {', '  pinMode(13, OUTPUT);', '}', '', 'void loop() {', '  digitalWrite(13, HIGH);', '  delay(500);', '}'].join('\n'), 5, 6);
  assert.deepEqual(ino.lines.slice(5, 7), ['  turn pin 13 on', '  wait 500 milliseconds']);
  const a2 = U.reRegex('arduino', swap(ino, 'wait 500', 'wait 250'), ino.regions, 0, W);
  assert.ok(a2.ok, JSON.stringify(a2.problems));
  assert.deepEqual(a2.lines.slice(5, 7), ['  digitalWrite(13, HIGH);', '  delay(250);']);
});

/* Every region back to code, from the bottom up, as Re-Regex all does. */
function reRegexAll(lang, lines, regions) {
  for (let i = regions.length - 1; i >= 0; i--) {
    const back = U.reRegex(lang, lines, regions, i, W);
    assert.ok(back.ok, JSON.stringify(back.problems));
    ({ lines, regions } = back);
  }
  return lines;
}

test('Unity: De-Regex a selection with sentences in it: the code around them is translated, the green parts stay as they are', async () => {
  const code = 'x = 1\ny = x + 1\nz = y * 2';
  const d = await deRegex('python', code, 1, 1);
  const all = await U.deRegex('python', d.lines, d.regions, 0, 2, convert);
  assert.deepEqual(plain(all.lines), ['set x to 1', 'set y to x plus 1', 'set z to y times 2']);
  assert.deepEqual(plain(all.done.map(p => [p.from, p.to, p.absorbed])), [[0, 0, 0], [2, 2, 0]]);
  assert.deepEqual(plain(all.regions.map(r => [r.from, r.to])), [[0, 0], [1, 1], [2, 2]]);
  assert.deepEqual(plain(all.regions[1]), plain(d.regions[0]), 'the green part is as it was');
  assert.equal(reRegexAll('python', all.lines, all.regions).join('\n'), code, 'and all of it goes back exactly');

  const none = await U.deRegex('python', d.lines, d.regions, 1, 1, convert);
  assert.deepEqual(plain(none), { lines: d.lines, regions: plain(d.regions), done: [], failed: [], blocked: [] }, 'only sentences selected: nothing happens');
});

test('Unity: a statement that reaches into a green part takes it in if it is unchanged, and stays as code if it was changed', async () => {
  const code = 'total = 0\nfor i in range(3):\n    total += i\nprint(total)';
  const d = await deRegex('python', code, 2, 2);
  assert.equal(d.lines[2], '    increase total by i');
  const all = await U.deRegex('python', d.lines, d.regions, 0, 3, convert);
  assert.deepEqual(plain(all.lines), ['set total to 0', '', 'repeat 3 times counting with i', '    increase total by i', 'show total']);
  assert.deepEqual(plain(all.done.map(p => [p.from, p.to, p.absorbed])), [[0, 3, 1]], 'the parts touch, so they are one');
  assert.equal(reRegexAll('python', all.lines, all.regions).join('\n'), code);

  const edited = d.lines.slice(); edited[2] = '    increase total by i times 2';
  const kept = await U.deRegex('python', edited, d.regions, 0, 3, convert);
  assert.deepEqual(plain(kept.blocked), [{ from: 0, to: 2, changed: [{ from: 2, to: 2 }] }]);
  assert.deepEqual(plain(kept.lines), ['total = 0', 'for i in range(3):', '    increase total by i times 2', 'show total'], 'edited sentences are never rewritten');
  assert.deepEqual(plain(kept.regions.map(r => [r.from, r.to])), [[2, 2], [3, 3]]);
});

test('Unity: De-Regex around green parts in JavaScript braces and inside a C++ main', async () => {
  const js = 'function f(n) {\n  let t = n * 2;\n  return t;\n}\nf(1);';
  const j = await deRegex('js', js, 1, 1);
  const jAll = await U.deRegex('js', j.lines, j.regions, 0, 4, convert);
  assert.deepEqual(plain(jAll.done.map(p => [p.from, p.to, p.absorbed])), [[0, 4, 1]], 'the tool and its call are one part, with the green line in it');
  assert.equal(reRegexAll('js', jAll.lines, jAll.regions).join('\n'), js);

  const cpp = '#include <iostream>\n\nint main() {\n    int n = 3;\n    n += 2;\n    std::cout << n << std::endl;\n    return 0;\n}';
  const c = await deRegex('cpp', cpp, 4, 4);
  const cAll = await U.deRegex('cpp', c.lines, c.regions, 3, 5, convert);
  assert.deepEqual(plain(cAll.lines.slice(3, 6)), ['    set n to 3', '    increase n by 2', '    show n'], 'statements inside main are read as inside main');
  assert.equal(reRegexAll('cpp', cAll.lines, cAll.regions).join('\n'), cpp);
});

test('Unity: regions move with the text, and lines typed at a region\'s edge join it', () => {
  const r = [{ from: 2, to: 3, original: [], words: [], base: '' }];
  const before = ['a', 'b', 'w1', 'w2', 'c'];
  assert.deepEqual(plain(U.adjust(r, before, ['a', 'b', 'w1 more', 'w2', 'c'])), plain(r), 'typing inside');
  assert.deepEqual(plain(U.adjust(r, before, ['new', 'a', 'b', 'w1', 'w2', 'c']).map(x => [x.from, x.to])), [[3, 4]], 'a line above moves it');
  assert.deepEqual(plain(U.adjust(r, before, ['a', 'b', 'w1', 'w2', 'w3', 'c'], 0).map(x => [x.from, x.to])), [[2, 4]], 'Enter at its end, from inside');
  assert.deepEqual(plain(U.adjust(r, before, ['a', 'b', 'w1', 'w2', 'w3', 'c'], -1).map(x => [x.from, x.to])), [[2, 3]], 'a line added after it from outside stays outside');
  assert.deepEqual(plain(U.adjust(r, before, ['a', 'b', 'c'])), [], 'deleting it all removes it');
});

/* ---------- Unity on a project's own files ---------- */

test('Unity: a project file shows line for line, its exact lines as code and its sentences as regions', () => {
  const file = ['python: import math', 'python: def area(r):', '    give back math.pi times r times r', 'python: x = 2', '', 'show area(x)', 'Python: y = 3', '  raw: z = 4'].join('\n');
  const f = U.fromFile('python', file);
  assert.deepEqual(plain(f.lines), ['import math', 'def area(r):', '    give back math.pi times r times r', 'x = 2', '', 'show area(x)', 'y = 3', '  z = 4']);
  assert.deepEqual(plain(f.regions.map(r => [r.from, r.to, r.base, r.original])), [[2, 2, '    ', null], [5, 5, '', null]]);
  assert.equal(U.toFile('python', f.lines, f.regions), file.replace('Python: y', 'python: y').replace('raw: z', 'python: z'), 'back to the same file (prefixes written the usual way)');
  const blanks = U.fromFile('js', 'show "a"\n\n\nshow "b"\njs: let c = 1;');
  assert.deepEqual(plain(blanks.regions.map(r => [r.from, r.to])), [[0, 3]], 'blank lines between sentences stay in the region; none at its edges');
  assert.deepEqual(plain(U.fromFile('html', 'html: <main>\n  add a heading "Hi"\nhtml: </main>').lines), ['<main>', '  add a heading "Hi"', '</main>']);
});

test('Unity: a project file\'s sentences become code in place, and back to sentences in the file', () => {
  const file = ['python: def area(r):', '    give back math.pi times r times r', 'python: print(area(2))'].join('\n');
  const f = U.fromFile('python', file);
  const made = U.toCode('python', f.lines, f.regions, 0, W);
  assert.deepEqual(plain(made.problems), []);
  assert.deepEqual(plain(made.code), ['    return math.pi * r * r']);
  // the shell gives the region the code it makes, so one nobody changed goes back exactly, with what it needs
  const regions = [{ ...f.regions[0], original: made.code, needs: made.needs }];
  const back = U.reRegex('python', f.lines, regions, 0, W);
  assert.ok(back.ok);
  assert.equal(U.toFile('python', back.lines, back.regions), ['python: import math', 'python: def area(r):', '    python: return math.pi * r * r', 'python: print(area(2))'].join('\n'), 'its code, and the import the writer used to add for it');
  // without code yet (its sentences have a problem), it's written afresh, and stays as sentences while it can't be code
  const bad = U.fromFile('python', 'python: x = 1\nmake this a sentence nobody knows');
  const no = U.reRegex('python', bad.lines, bad.regions, 0, W);
  assert.equal(no.ok, false);
  assert.ok(no.problems.length);
  // the writer in the project's context, when the shell gives one
  let asked = 0;
  U.toCode('python', f.lines, f.regions, 0, { ...W, compile: () => { asked++; return null; } });
  assert.equal(asked, 1);
});

test('Unity: a statement around sentences without code is left alone (they can\'t be said again from code)', async () => {
  const f = U.fromFile('python', 'python: for i in range(3):\n    make this a sentence nobody knows');
  const d = await U.deRegex('python', f.lines, f.regions, 0, 0, convert);
  assert.deepEqual(plain(d.done), []);
  assert.deepEqual(plain(d.blocked), [{ from: 0, to: 1, changed: [{ from: 1, to: 1 }] }]);
});

test('Unity: a project\'s C++ file is the program\'s main, so its code is read as inside one', async () => {
  const f = U.fromFile('cpp', 'c++: int n = 3;\nincrease n by 2\nshow n');
  const d = await U.deRegex('cpp', f.lines, f.regions, 0, 0, convert, { body: true });
  assert.deepEqual(plain(d.lines), ['set n to 3', 'increase n by 2', 'show n']);
  assert.equal(U.toFile('cpp', d.lines, d.regions), 'set n to 3\nincrease n by 2\nshow n');
});

test('Unity: a project\'s C++ tool stays as sentences (its code goes above main, where exact lines can\'t)', () => {
  const f = U.fromFile('cpp', ['define add using whole number a, whole number b giving back whole number', '    give back a plus b', '', 'c++: int n = add(2, 3);', 'show n'].join('\n'));
  assert.deepEqual(plain(f.regions.map(r => [r.from, r.to])), [[0, 1], [4, 4]]);
  const split = U.fromFile('cpp', ['include <iostream>', '', 'set total to 0', 'count i from 1 to 3', '    increase total by i'].join('\n'));
  assert.deepEqual(plain(split.regions.map(r => [r.from, r.to])), [[0, 0], [2, 2], [3, 4]], 'one region per statement in C++');
  const tool = U.toCode('cpp', f.lines, f.regions, 0, W);
  assert.ok(tool.problems.some(p => p.errs.some(e => /above main/.test(e))), 'a tool stays as sentences');
  const body = U.toCode('cpp', f.lines, f.regions, 1, W);
  assert.deepEqual(plain(body.problems), []);
  assert.deepEqual(plain(body.code), ['std::cout << n << std::endl;'], 'a statement in main becomes code');
});

test('Unity: a sketch written as code keeps its own setup and loop, and its indentation', () => {
  const file = ['c++: int led = 13;', 'c++: void setup() {', '    c++: pinMode(led, OUTPUT);', 'c++: }', 'c++: void loop() {', '    c++: digitalWrite(led, HIGH);', 'c++: }'].join('\n');
  const out = CPP.compileCppProject({ kind: 'arduino', sections: [{ id: 'sketch', file: 'sketch', text: file }] }).results.sketch;
  assert.equal(out.text, 'int led = 13;\nvoid setup() {\n    pinMode(led, OUTPUT);\n}\nvoid loop() {\n    digitalWrite(led, HIGH);\n}\n');
});

test('Unity: sentences that write no code of their own stay as sentences (nothing disappears)', () => {
  const f = U.fromFile('cpp', ['include <iostream>', '', 'show "hi"'].join('\n'));
  const r = U.reRegex('cpp', f.lines, f.regions, 0, W);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some(p => p.errs.some(e => /no code of its own/.test(e))));
  assert.ok(U.reRegex('cpp', f.lines, f.regions, 1, W).ok, 'the statement after it still becomes code');
});

test('Unity: an imported JavaScript or CSS file (all exact lines) is written back exactly as it was', () => {
  const js = ['import {', '  chordFor,', '} from "./chords.js";', '', '', 'const page = `', '  <ul>', '\t<li>${chordFor("C")}</li>  ', '  </ul>`;', 'export function show() {', '    return page;', '}'].join('\n');
  const css = ['@media (max-width: 600px) {', '  .key {', '    color: red;', '  }', '}', '', '', '.pad { }  '].join('\n');
  for (const [lang, code, role] of [['js', js, 'mechanics'], ['css', css, 'styling']]) {
    const file = U.toFile(lang, code.split('\n'), []) + '\n';   // as importing makes it (importSection in app.js)
    const sections = ['structure', 'styling', 'mechanics'].map(id => ({ id, file: id, text: id === role ? file : '' }));
    assert.equal(WEB.compileWebsite({ sections }).results[role].text, code + '\n', lang);
  }
});

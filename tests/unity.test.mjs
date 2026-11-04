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

test('Unity: regions move with the text, and lines typed at a region\'s edge join it', () => {
  const r = [{ from: 2, to: 3, original: [], words: [], base: '' }];
  const before = ['a', 'b', 'w1', 'w2', 'c'];
  assert.deepEqual(plain(U.adjust(r, before, ['a', 'b', 'w1 more', 'w2', 'c'])), plain(r), 'typing inside');
  assert.deepEqual(plain(U.adjust(r, before, ['new', 'a', 'b', 'w1', 'w2', 'c']).map(x => [x.from, x.to])), [[3, 4]], 'a line above moves it');
  assert.deepEqual(plain(U.adjust(r, before, ['a', 'b', 'w1', 'w2', 'w3', 'c'], 0).map(x => [x.from, x.to])), [[2, 4]], 'Enter at its end, from inside');
  assert.deepEqual(plain(U.adjust(r, before, ['a', 'b', 'w1', 'w2', 'w3', 'c'], -1).map(x => [x.from, x.to])), [[2, 3]], 'a line added after it from outside stays outside');
  assert.deepEqual(plain(U.adjust(r, before, ['a', 'b', 'c'])), [], 'deleting it all removes it');
});

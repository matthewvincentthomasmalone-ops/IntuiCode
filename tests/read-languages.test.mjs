// Read mode for every language: detection (from the name, the first line, editor settings and the text
// itself) and analysis (sections, plain-English summaries, facts, warnings and steps).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadWebReader, ROOT } from './helpers/engine.mjs';

vm.runInThisContext(readFileSync(path.join(ROOT, 'lang/languages.js'), 'utf8'), { filename: 'lang/languages.js' });
const W = await loadWebReader();
vm.runInThisContext(readFileSync(path.join(ROOT, 'lang/code_read.js'), 'utf8'), { filename: 'lang/code_read.js' });
const R = globalThis.IntuiCodeReader;
const LANGS = globalThis.IntuiLanguages;

const DIR = path.join(ROOT, 'tests/corpus_langs');
const read = (f) => readFileSync(path.join(DIR, f), 'utf8');
const SAMPLES = readdirSync(DIR).filter(f => !statSync(path.join(DIR, f)).isDirectory());
const DETECT_DIR = path.join(DIR, 'detect');
const EXTRAS = readdirSync(DETECT_DIR);

// before any grammar beyond the web reader's own is loaded: a language without its grammar still gets an outline
const goSource = read('server.go');
const noGrammar = R.analyze('go', 'server.go', goSource);
const t0 = Date.now();
for (const l of LANGS.LANGUAGES) await R.load(l.id);
const loadMs = Date.now() - t0;

/* What each sample must read as: its language, and sections that must be there as [kind, name]. */
const EXPECT = {
  'inventory.py': ['python', [['class', 'Item'], ['tool', 'load_items'], ['tool', 'restock'], ['start', '__main__']]],
  'index.html': ['html', [['head', null], ['part', null]]],
  'theme.css': ['css', [['style', ':root'], ['media', 'header']]],
  'cart.js': ['js', [['tool', 'loadBasket'], ['tool', 'totals'], ['handler', null]]],
  'matrix.cpp': ['cpp', [['class', 'Matrix'], ['tool', 'multiply'], ['start', 'main']]],
  'thermostat.ino': ['arduino', [['tool', 'readTemperature'], ['start', 'setup'], ['start', 'loop']]],
  'api_client.ts': ['ts', [['class', 'BookingClient'], ['tool', 'overlaps']]],
  'TodoList.tsx': ['tsx', [['component', 'TodoItem'], ['component', 'TodoList']]],
  'Counter.vue': ['vue', [['part', null], ['script', null], ['style', null]]],
  'UserController.php': ['php', [['class', 'UserController'], ['tool', 'store'], ['tool', 'search'], ['tool', 'initials']]],
  'library.rb': ['ruby', [['class', 'Library'], ['class', 'Book'], ['class', 'Desk'], ['tool', 'lend'], ['tool', 'fines']]],
  'order.html.erb': ['erb', [['part', null], ['steps', null]]],
  'ring_buffer.c': ['c', [['type', 'RingBuffer'], ['tool', 'ring_new'], ['tool', 'ring_average'], ['start', 'main']]],
  'wordcount.rs': ['rust', [['type', 'WordCount'], ['type', 'Order'], ['tool', 'count_words'], ['tool', 'read_file'], ['start', 'main'], ['test', 'tests']]],
  'server.go': ['go', [['type', 'Note'], ['type', 'Store'], ['tool', 'Add'], ['tool', 'handleNotes'], ['start', 'main']]],
  'stats.zig': ['zig', [['class', 'Stats'], ['tool', 'mean'], ['tool', 'largest'], ['start', 'main'], ['test', '"mean of two samples"']]],
  'OrderService.cs': ['csharp', [['type', 'OrderState'], ['type', 'IPaymentGateway'], ['class', 'Order'], ['class', 'OrderService'], ['tool', 'PayAsync']]],
  'BankAccount.java': ['java', [['class', 'BankAccount'], ['tool', 'deposit'], ['tool', 'withdraw'], ['start', 'main'], ['class', 'InsufficientFundsException']]],
  'Weather.kt': ['kotlin', [['type', 'Reading'], ['class', 'Outlook'], ['type', 'WeatherSource'], ['tool', 'current'], ['tool', 'describe'], ['start', 'main']]],
  'ProfileView.swift': ['swift', [['type', 'Profile'], ['type', 'ProfileError'], ['type', 'ProfileStore'], ['class', 'ProfileModel'], ['tool', 'validate'], ['class', 'ProfileView']]],
  'NoteStore.m': ['objc', [['class', 'Note'], ['class', 'NoteStore'], ['tool', 'notesMatching:'], ['start', 'main']]],
  'counter_app.dart': ['dart', [['start', 'main'], ['class', 'CounterApp'], ['class', '_CounterPageState'], ['tool', 'build'], ['tool', '_increment']]],
  'Shapes.scala': ['scala', [['type', 'Shape'], ['class', 'Circle'], ['class', 'Shapes'], ['tool', 'describe'], ['start', 'main']]],
  'inventory.lua': ['lua', [['tool', 'new'], ['tool', 'add'], ['tool', 'save'], ['steps', null]]],
  'backup.sh': ['bash', [['about', null], ['settings', null], ['tool', 'log'], ['tool', 'prune'], ['steps', null]]],
  'job_queue.ex': ['elixir', [['class', 'Jobs.Queue'], ['tool', 'push'], ['tool', 'run_next'], ['tool', 'perform']]],
  'word-tools.el': ['elisp', [['about', null], ['imports', null], ['tool', 'word-tools-count'], ['class', 'word-tools-mode']]],
  'expr.ml': ['ocaml', [['type', 'expr'], ['tool', 'simplify'], ['tool', 'eval'], ['class', 'Env'], ['start', 'let ()']]],
  'Counter.elm': ['elm', [['type', 'Model'], ['type', 'Msg'], ['tool', 'update'], ['tool', 'view'], ['start', 'main']]],
  'Rating.res': ['rescript', [['type', 'rating'], ['type', 'action'], ['tool', 'reducer'], ['class', 'Star'], ['tool', 'make']]],
  'Auction.sol': ['solidity', [['class', 'Auction'], ['tool', 'bid'], ['tool', 'withdraw'], ['tool', 'onlySeller']]],
  'UnsafeQuery.ql': ['ql', [['about', null], ['class', 'SqlExecution'], ['tool', 'isRequestText'], ['start', 'query']]],
  'Crossing.tla': ['tlaplus', [['start', 'Init'], ['tool', 'Press'], ['tool', 'Next'], ['test', 'TypeOK'], ['test', 'Safe']]],
  'uart_regs.rdl': ['systemrdl', [['settings', 'is_interrupt'], ['type', 'status_reg'], ['type', 'control_reg'], ['class', 'uart']]],
  'shop_schema.sql': ['sql', [['type', 'customers'], ['type', 'orders'], ['data', 'products'], ['tool', 'order_total'], ['steps', 'orders']]],
  'settings.json': ['json', [['settings', null], ['data', 'scripts'], ['data', 'beds']]],
  'ci.yml': ['yaml', [['data', 'on'], ['data', 'jobs']]],
  'config.toml': ['toml', [['settings', null], ['data', 'station'], ['data', 'alerts']]],
  'sales.csv': ['csv', [['data', null]]],
  'NOTES.md': ['markdown', [['heading', 'Garden planner'], ['heading', 'Getting started'], ['heading', 'Frost dates']]],
  'meeting-notes.txt': ['text', [['heading', null], ['part', null]]],
};
// files with no telling name, ambiguous endings, or a name that isn't the language
const EXTRA = {
  'ring_buffer.h': 'c', 'polygon.h': 'cpp', 'Note.h': 'objc', 'run-tests': 'bash', 'manage': 'python',
  'export.txt': 'json', 'Gemfile': 'ruby', 'build.inc': 'python', 'greet.script': 'lua',
};
/* From the text alone, these can't be told apart, so detection gives the documented fallback:
 *   a header with only C declarations: C and C++ both accept it (read as C, a guess);
 *   an Arduino sketch is C++ with setup()/loop() and the Arduino functions: without them it reads as C or C++;
 *   TypeScript without any type annotations is plain JavaScript;
 *   JSX in a .js file and TSX without types are both JavaScript;
 *   a .txt that happens to have "Label: text" lines is still notes, not YAML. */
const CANT_TELL = [
  ['typedef struct Point Point;\nint point_distance(const Point *a, const Point *b);\n', 'c'],
  ['#include <vector>\nint twice(int x) {\n  return x * 2;\n}\n', 'cpp'],
  ['int ledPin = 13;\nint readLevel(int pin) {\n  return analogRead(pin) / 4;\n}\n', 'arduino'],
  ['export function add(a, b) {\n  return a + b;\n}\nconst total = add(1, 2);\nconsole.log(total);\n', 'js'],
  ['export function Hello({ name }) {\n  return <p className="hi">Hello {name}</p>;\n}\n', 'js'],
];

const allText = (a) => [a.overview, a.error, ...a.sections.flatMap(s => [s.title, s.headline, ...s.facts, ...s.warnings])].join('\n');
const ownWords = (s) => s.replace(/`[^`]*`/g, '').replace(/"[^"]*"/g, '').replace(/\([^)]*\)/g, '');

test('every language in lang/languages.js has a sample', () => {
  const covered = new Set(Object.values(EXPECT).map(e => e[0]));
  for (const l of LANGS.LANGUAGES) assert.ok(covered.has(l.id), `no sample for ${l.id}`);
  for (const f of SAMPLES) {
    assert.ok(EXPECT[f], `${f} is not listed in EXPECT`);
    const n = read(f).split('\n').length;
    assert.ok(n >= 30 && n <= 82, `${f} has ${n} lines (30–80 wanted)`);
  }
});

test('the web reader loads any grammar named in lang/languages.js, and the old keys still work', async () => {
  assert.equal(W.grammarOf('js'), 'javascript');
  assert.equal(W.grammarOf('cpp'), 'cpp');
  assert.equal(W.grammarOf('csharp'), 'c_sharp');
  assert.equal(W.grammarOf('erb'), 'embedded_template');
  assert.equal(W.grammarOf('c_sharp'), 'c_sharp');
  assert.equal(W.grammarOf('sql'), null);
  assert.equal(W.grammarOf('no-such-language'), null);
  await W.loadLangs(['no-such-language', 'sql']);          // ignored, as before
  for (const l of LANGS.LANGUAGES) {
    if (!l.grammar) continue;
    if (R.UNUSABLE[l.id]) { assert.deepEqual(R.needs(l.id), [], `${l.id} must not be loaded`); continue; }
    assert.ok(W.hasLang(l.id), `${l.id} did not load`);
    assert.doesNotThrow(() => W.parse(l.id, 'x\n'), l.id);
  }
  // Ruby, PHP, Bash, Vue and YAML need C library functions the runtime leaves out (lang/ts_patch.js adds them)
  for (const [id, src] of [['ruby', 'class A < B\n  def up?; X; end\nend\n'], ['php', '<?php echo "\\x41";'], ['bash', 'case "$1" in a) echo hi;; esac\n'], ['yaml', 'a:\n  - b: [1, 2]\n'], ['vue', '<template><p>{{ x }}</p></template>\n<script>export default {}</script>\n']])
    assert.equal(W.parse(id, src).hasError(), false, id);
  assert.ok(W.parse('js', 'const a = 1;').type === 'program');
  assert.ok(W.parse('arduino', 'void setup() {}').type === 'translation_unit');
});

test('detect: every sample from its name', () => {
  for (const f of SAMPLES) {
    const d = R.detect(f, read(f));
    assert.equal(d.lang, EXPECT[f][0], `${f}: ${d.why}`);
    assert.equal(d.confidence, 'certain', f);
    assert.ok(d.why && /\.$/.test(d.why), f);
  }
  for (const [f, lang] of Object.entries(EXTRA)) {
    const d = R.detect(f, readFileSync(path.join(DETECT_DIR, f), 'utf8'));
    assert.equal(d.lang, lang, `${f}: ${d.why}`);
    assert.ok(d.confidence !== 'guess' || /\.h$/.test(f), `${f} was only a guess: ${d.why}`);
  }
  assert.deepEqual(EXTRAS.sort(), Object.keys(EXTRA).sort());
});

test('detect: every sample from its text alone (pasted code, no name)', () => {
  for (const f of SAMPLES) {
    const d = R.detect('', read(f));
    assert.equal(d.lang, EXPECT[f][0], `${f}: ${d.why}`);
    if (!/^#!/.test(read(f))) assert.notEqual(d.confidence, 'certain', `${f}: the text alone is only certain when it says so itself (#!)`);
  }
  for (const [f, lang] of Object.entries(EXTRA)) assert.equal(R.detect('', readFileSync(path.join(DETECT_DIR, f), 'utf8')).lang, lang, f);
  for (const [src, lang] of CANT_TELL) assert.equal(R.detect('', src).lang, lang, src);
});

test('detect: first lines, editor settings, names and endings', () => {
  const cases = [
    ['deploy', '#!/usr/bin/env bash\necho hi\n', 'bash', 'certain'],
    ['tool', '#!/usr/bin/env -S deno run\nconsole.log(1)\n', 'ts', 'certain'],
    ['script', '#!/usr/bin/ruby -w\nputs 1\n', 'ruby', 'certain'],
    ['job', '#!/usr/bin/perl\nprint "hi";\n', 'text', 'likely'],
    ['rules.cfg', '# -*- mode: yaml -*-\na: 1\n', 'text', 'certain'],      // a known ending wins over an editor setting
    ['rules', '# -*- mode: yaml -*-\na: 1\n', 'yaml', 'certain'],
    ['x', 'let x = 1\n// vim: set filetype=rust:\n', 'rust', 'certain'],
    ['Rakefile', 'task :default\n', 'ruby', 'certain'],
    ['.bashrc', 'alias ll="ls -l"\n', 'bash', 'certain'],
    ['Cargo.lock', '[[package]]\nname = "a"\n', 'toml', 'certain'],
    ['Makefile', 'all:\n\tcc main.c\n', 'text', 'certain'],
    ['notes.TXT', 'Shopping: eggs, flour and milk for the weekend.\n', 'text', 'certain'],
    ['data.txt', '[{"a": 1}, {"a": 2}]', 'json', 'likely'],
    ['analysis.r', 'x <- c(1, 2)\n', 'text', 'certain'],
    ['feed.xml', '<?xml version="1.0"?><a/>', 'text', 'certain'],
    ['view.svelte', '<script>let a = 1;</script>', 'text', 'certain'],
    ['main.m', 'function y = f(x)\n  y = x * 2;\nend\n', 'text', 'likely'],   // MATLAB, not Objective-C
    ['app.ts', '<?xml version="1.0"?>\n<TS version="2.1"></TS>', 'text', 'likely'],
    ['src/main.rs', 'fn main() {}', 'rust', 'certain'],
    ['C:\\work\\Main.java', 'class Main {}', 'java', 'certain'],
    ['page.HTML', '<p>hi</p>', 'html', 'certain'],
    ['tsconfig.jsonc', '{ // comment\n "a": 1 }', 'json', 'certain'],
    ['', '', 'text', 'guess'],
    ['', '    \n  ', 'text', 'guess'],
  ];
  for (const [p, src, lang, conf] of cases) {
    const d = R.detect(p, src);
    assert.equal(d.lang, lang, `${p}: ${d.why}`);
    assert.equal(d.confidence, conf, `${p}: ${d.why}`);
  }
});

test('detect: short pasted snippets', () => {
  const cases = [
    ['def greet(name):\n    print(f"Hello {name}")\n', 'python'],
    ['func add(a int, b int) int {\n\treturn a + b\n}\n', 'go'],
    ['fn main() {\n    let mut v = Vec::new();\n    v.push(1);\n    println!("{:?}", v);\n}\n', 'rust'],
    ['SELECT name, email FROM users WHERE active = 1 ORDER BY name;', 'sql'],
    ['if [ -f "$1" ]; then\n  echo "found"\nfi\n', 'bash'],
    ['{"name": "x", "version": "1.0.0"}', 'json'],
    ['public class Hello {\n    public static void main(String[] args) {\n        System.out.println("Hi");\n    }\n}\n', 'java'],
    ['Console.WriteLine("Hello");\nvar list = new List<int>();\n', 'csharp'],
    ['<?php\necho "hi";\n', 'php'],
    ['local t = {}\nfor i, v in ipairs(t) do\n  print(v)\nend\n', 'lua'],
    ['defmodule Greeter do\n  def hello(name), do: "Hello " <> name\nend\n', 'elixir'],
    ['pragma solidity ^0.8.0;\ncontract A { uint256 x; }\n', 'solidity'],
    ['# Title\n\nSome text with a [link](https://example.org).\n\n- one\n- two\n', 'markdown'],
    ['name,age\nAda,36\nAlan,41\nGrace,85\n', 'csv'],
    ['.card {\n  padding: 1rem;\n  color: #333;\n}\n', 'css'],
    ['This is a short note to myself about the plan for tomorrow.\nCall the plumber before ten.\n', 'text'],
  ];
  for (const [src, lang] of cases) { const d = R.detect('', src); assert.equal(d.lang, lang, `${JSON.stringify(src.slice(0, 40))}: ${d.why}`); }
});

test('detect: fast, and it only looks at the start of a big file', () => {
  const big = read('wordcount.rs').repeat(400);          // about 1 MB
  let t = Date.now();
  const d = R.detect('', big);
  assert.equal(d.lang, 'rust');
  assert.ok(Date.now() - t < 500, `took ${Date.now() - t} ms`);
  t = Date.now();
  for (const f of SAMPLES) { R.detect('', read(f)); R.detect(f, read(f)); }
  assert.ok(Date.now() - t < 2000, `detecting every sample twice took ${Date.now() - t} ms`);
});

test('analyze: every sample reads, with the sections it should have', () => {
  for (const f of SAMPLES) {
    const [lang, want] = EXPECT[f];
    const src = read(f);
    const a = R.analyze(lang, f, src);
    assert.ok(a.ok, `${f}: ${a.error}`);
    assert.ok(a.overview.startsWith(f) || a.overview.includes(f), `${f}: overview ${a.overview}`);
    assert.equal(a.lines, src.split('\n').length, f);
    assert.ok(Array.isArray(a.imports) && Array.isArray(a.libs), f);
    for (const [kind, name] of want) {
      const hit = a.sections.find(s => s.kind === kind && (name == null || s.name === name || s.title.endsWith(': ' + name) || s.title === name));
      assert.ok(hit, `${f}: no ${kind} section ${name || ''}; got ${a.sections.map(s => `${s.kind}:${s.name || s.title}`).join(', ')}`);
    }
    let last = 0;
    a.sections.forEach((s, i) => {
      assert.equal(s.id, i, f);
      assert.ok(s.start >= 1 && s.end >= s.start && s.end <= a.lines, `${f}: ${s.title} ${s.start}-${s.end}`);
      for (const k of ['kind', 'title', 'headline']) assert.equal(typeof s[k], 'string', `${f}: ${k}`);
      for (const k of ['facts', 'warnings', 'steps']) assert.ok(Array.isArray(s[k]), `${f}: ${k}`);
      assert.ok(s.headline.length > 8, `${f}: ${s.title} has no headline`);
      if (a.reader === 'code') { assert.ok(s.start > last, `${f}: ${s.title} overlaps the section before it`); last = s.end; }
      assert.equal(typeof s.lang, 'string', f);
    });
  }
});

test('analyze: the existing readers answer for their languages; this one for the rest', () => {
  for (const id of ['python', 'html', 'css', 'js', 'ts', 'tsx', 'cpp', 'arduino']) assert.notEqual(R.readerFor(id), 'code', id);
  assert.equal(R.readerFor('python'), 'python');
  assert.equal(R.readerFor('cpp'), 'web');
  for (const id of ['rust', 'go', 'sql', 'markdown', 'dart', 'text']) assert.equal(R.readerFor(id), 'code', id);
  assert.deepEqual(R.needs('rust'), ['rust']);
  assert.deepEqual(R.needs('sql'), []);
  assert.deepEqual(R.needs('dart'), []);
  assert.ok(R.needs('vue').includes('vue'));
  const langs = R.languages();
  assert.equal(langs.length, LANGS.LANGUAGES.length);
  assert.deepEqual(langs.filter(l => l.sentences).map(l => l.id).sort(), ['arduino', 'cpp', 'css', 'html', 'js', 'python']);
  assert.ok(langs.every(l => /^(sentences|outline|basic)$/.test(l.depth)));
  assert.equal(R.analyze('cpp', 'matrix.cpp', read('matrix.cpp')).reader, 'web');
  assert.equal(R.analyze('python', 'inventory.py', read('inventory.py')).reader, 'code');   // tree-sitter's Python, when asked
  assert.ok(R.ready('rust') && R.ready('sql'));
});

test('analyze: a language whose grammar is not loaded still gets an outline', () => {
  assert.ok(noGrammar.ok);
  assert.match(noGrammar.overview, /rough outline/);
  assert.ok(noGrammar.sections.some(s => s.kind === 'start' && s.name === 'main'), noGrammar.sections.map(s => s.title).join(', '));
  assert.ok(noGrammar.sections.some(s => /Add|handleNotes/.test(s.title)));
});

const sec = (f, pred) => {
  const [lang] = EXPECT[f];
  const a = R.analyze(lang, f, read(f));
  const s = a.sections.find(typeof pred === 'string' ? (x => x.name === pred) : pred);
  assert.ok(s, `${f}: section ${pred} not found in ${a.sections.map(x => x.name || x.title).join(', ')}`);
  return { ...s, text: [s.headline, ...s.facts, ...s.warnings].join('\n'), steps: s.steps.join('\n') };
};

test('analyze: headlines say what each part is', () => {
  assert.equal(sec('wordcount.rs', 'count_words').headline, '`count_words` is a reusable tool that takes `text: &str` and gives back a `HashMap<String, usize>`.');
  assert.equal(sec('server.go', 'Add').headline, '`Add` is one of `Store`\'s tools. It takes `text string` and gives back a `(Note, error)`.');
  assert.match(sec('BankAccount.java', s => s.title === 'Making a BankAccount').headline, /^Runs when a new `BankAccount` is made, and takes `String owner`\.$/);
  assert.match(sec('Auction.sol', 'Auction').headline, /smart contract/);
  assert.match(sec('ProfileView.swift', 'ProfileView').headline, /SwiftUI view/);
  assert.match(sec('counter_app.dart', 'CounterApp').headline, /Flutter widget/);
  assert.match(sec('Weather.kt', 'Reading').headline, /data class/);
  assert.match(sec('OrderService.cs', 'OrderState').facts.join(' '), /It can be `Open`, `Paid`, `Shipped` or `Cancelled`\./);
  assert.match(sec('shop_schema.sql', 'orders').headline, /^Makes the table `orders` with 5 columns/);
  assert.match(sec('Crossing.tla', 'Press').headline, /changes `waiting` and keeps `cars` and `walk` the same/);
  assert.match(sec('uart_regs.rdl', 'uart').headline, /4 registers from `0x00` to `0x0C`/);
  assert.match(sec('Counter.elm', 'update').headline, /takes `Msg` and `Model` and gives back a `Model`/);
  assert.match(sec('NOTES.md', 'Frost dates').headline, /code example \(js\)/);
  assert.match(R.analyze('csv', 'sales.csv', read('sales.csv')).overview, /6 columns and 30 rows/);
  assert.match(R.analyze('yaml', 'ci.yml', read('ci.yml')).overview, /GitHub Actions workflow/);
  assert.match(R.analyze('json', 'settings.json', read('settings.json')).overview, /Node\.js package file/);
});

test('analyze: notes that matter in each language', () => {
  const rust = sec('wordcount.rs', 'read_file').text;
  assert.match(rust, /`Result`: either the answer \(`Ok`\) or an error \(`Err`\)/);
  assert.match(rust, /The `\?` after a call passes any error straight back/);
  assert.match(sec('wordcount.rs', 'count_words').text, /borrows `text` to read it \(`&`\)/);
  assert.match(sec('wordcount.rs', 'WordCount').text, /`#\[derive\]`: `Debug`, `Clone` and `PartialEq`/);
  const go = sec('server.go', 'Add').text;
  assert.match(go, /`error`: `nil` means it worked/);
  assert.match(go, /`s\.mu\.Unlock\(\)` \(`defer`\)/);
  assert.match(sec('server.go', 'main').text, /in the background with `go` \(a goroutine\)/);
  assert.match(sec('server.go', 'main').text, /channels/);
  const swift = sec('ProfileView.swift', 'validate').text;
  assert.match(swift, /`guard` checks a condition first/);
  assert.match(swift, /optional values/);
  assert.match(swift, /`throws`/);
  assert.match(sec('ProfileView.swift', 'ProfileModel').text, /`@Published`/);
  const kt = sec('Weather.kt', 'current').text;
  assert.match(kt, /`suspend` function/);
  assert.match(kt, /may give back `null`/);
  assert.match(sec('Weather.kt', 'outlook').text, /`!!`, which crashes/);
  assert.match(sec('OrderService.cs', 'PayAsync').text, /`async`/);
  assert.match(sec('OrderService.cs', 'Unpaid').text, /LINQ \(`Where` and `OrderBy`\)/);
  assert.match(sec('OrderService.cs', 'Order').text, /`State` can be read by anyone but changed only by `Order` itself \(`private set`\)/);
  assert.match(sec('BankAccount.java', 'withdraw').text, /\(`throws`\): `InsufficientFundsException`/);
  assert.match(sec('BankAccount.java', 'compareTo').text, /`@Override`/);
  assert.match(sec('inventory.lua', 'add').text, /called with `:`/);
  assert.match(sec('inventory.lua', 'save').text, /`local`: only this file can use it/);
  assert.match(R.analyze('lua', 'x.lua', 'function f()\n  total = 1\nend\n').sections[0].warnings.join(' '), /`total` isn't declared `local`/);
  assert.match(sec('backup.sh', s => s.kind === 'settings').text, /stop at the first command that fails \(`-e`\)/);
  assert.match(sec('backup.sh', 'prune').text, /Loops over what `ls` prints/);
  assert.match(R.analyze('bash', 'x.sh', '#!/bin/bash\nrm -rf $TARGET/build\n').sections.map(s => s.warnings.join(' ')).join(' '), /`\$TARGET` isn't in quotes/);
  assert.match(sec('UserController.php', 'store').text, /validate/);
  assert.match(R.analyze('php', 'q.php', '<?php\nfunction find($db, $id) {\n  return $db->query("SELECT * FROM users WHERE id = $id");\n}\n').sections.find(s => s.name === 'find').warnings.join(' '), /SQL injection/);
  assert.match(sec('library.rb', 'Book').text, /`title` and `author` can be read from outside \(`attr_reader`\)/);
  assert.match(sec('library.rb', 'lend').text, /`find`/);
  assert.match(sec('counter_app.dart', '_increment').text, /`setState`/);
  assert.match(sec('counter_app.dart', 'build').text, /`Scaffold`, `AppBar`/);
  const sol = sec('Auction.sol', 'bid').text;
  assert.match(sol, /`payable`/);
  assert.match(sol, /`BidPlaced`/);
  assert.match(sec('Auction.sol', 'end').text, /only runs if `onlySeller` allows it/);
  assert.match(R.analyze('solidity', 'a.sol', 'contract A {\n  mapping(address => uint) bal;\n  function out() external {\n    payable(msg.sender).call{value: bal[msg.sender]}("");\n    bal[msg.sender] = 0;\n  }\n}\n').sections.flatMap(s => s.warnings).join(' '), /re-entrancy/);
  assert.match(sec('ring_buffer.c', 'ring_push').text, /as a pointer \(the `\*`\)/);
  assert.match(sec('ring_buffer.c', 'ring_new').text, /reserves memory by hand/);
  assert.match(sec('ring_buffer.c', 'main').text, /`strcpy`, which can write past the end/);
  const ex = sec('job_queue.ex', 'run_next');
  assert.match(ex.text, /2 versions \(clauses\)/);
  assert.match(ex.steps, /when it is given %__MODULE__\{pending: \[\]\} = state/);
  assert.match(sec('job_queue.ex', 'push').text, /`is_map\(job\)` \(a guard\)/);
  assert.match(sec('word-tools.el', 'word-tools-count').text, /people can run it with `M-x`/);
  assert.match(sec('expr.ml', 'simplify').text, /calls itself \(recursion\)/);
  assert.match(sec('Rating.res', 'make').headline, /React component/);
  assert.match(sec('UnsafeQuery.ql', s => s.kind === 'about').text, /It finds: Building an SQL query/);
  assert.match(sec('stats.zig', 'add').text, /`!void` means it gives back nothing, or an error/);
  assert.match(sec('NoteStore.m', 'Note').text, /announces a class|`copy`/);
  assert.match(sec('inventory.py', 'restock').text, /`KeyError`|stop with an error/);
});

test('analyze: plain steps for function bodies', () => {
  const steps = (f, name) => sec(f, name).steps;
  assert.match(steps('wordcount.rs', 'count_words'), /for each word in text\.split_whitespace\(\)\n {4}set clean to .*\n {4}if clean\.is_empty\(\)\n {8}skip to the next round of the loop/);
  assert.match(steps('wordcount.rs', 'count_words'), /give back counts$/);
  assert.match(steps('server.go', 'Add'), /^if text is ""\n {4}give back Note\{\}, ErrEmpty\nrun s\.mu\.Lock\nwhen this tool finishes: s\.mu\.Unlock\(\)/);
  assert.match(steps('server.go', 'handleNotes'), /check r\.Method\n {4}when http\.MethodGet/);
  assert.match(steps('ring_buffer.c', 'ring_average'), /repeat rb->count times, counting with i/);
  assert.match(steps('ring_buffer.c', 'ring_push'), /set tail to \(rb->head plus rb->count\) mod rb->capacity/);
  assert.match(steps('ring_buffer.c', 'main'), /count i from 1 up to 12/);
  assert.match(steps('BankAccount.java', 'deposit'), /^if amount\.signum\(\) is at most 0\n {4}fail with new IllegalArgumentException/);
  assert.match(steps('BankAccount.java', 'main'), /try\n {4}run acc\.withdraw with new BigDecimal\("400"\)\nif it fails\n {4}show "Refused: " plus e\.getMessage\(\)/);
  assert.match(steps('inventory.lua', 'add'), /for each _, slot in ipairs\(self\.slots\)/);
  assert.match(steps('inventory.lua', 'save'), /run file:write/);
  assert.match(steps('backup.sh', 'check_space'), /if \$free is less than 1048576\n {4}run log with "Less than 1 GB free on \$DEST"\n {4}stop, reporting failure \(code 1\)/);
  assert.match(sec('backup.sh', s => s.kind === 'steps').steps, /if the folder \$SOURCE doesn't exist/);
  assert.match(steps('ProfileView.swift', 'validate'), /^make sure that !p\.name\.isEmpty; if not:\n {4}fail with ProfileError\.missingName\nif p\.email has a value \(called email\)/);
  assert.match(steps('Weather.kt', 'describe'), /check which case applies\n {4}when is Outlook\.Sunny: "Sunny"/);
  assert.match(steps('Shapes.scala', 'describe'), /when Circle\(r\) if r < 1: s"a small circle"/);
  assert.match(steps('stats.zig', 'mean'), /for each s in self\.samples\[0\.\.self\.len\]\n {4}increase total by s/);
  assert.match(steps('stats.zig', 'main'), /run stats\.add with r \(if it fails, pass the error back\)/);
  assert.match(steps('Auction.sol', 'end'), /make sure that block\.timestamp is at least endsAt; if not, refuse the whole call \(not finished yet\)\nmake sure that not ended;/);
  assert.match(steps('Auction.sol', 'bid'), /record the event BidPlaced/);
  assert.match(steps('library.rb', 'add'), /add book to the end of @books\ngive back self/);
  assert.match(steps('NoteStore.m', 'addNote:'), /send `addObject:` to self\.notes with note/);
  assert.match(steps('Counter.elm', 'update'), /check msg\n {4}when Increment: a copy of model with count = model\.count \+ model\.step/);
  assert.match(steps('expr.ml', 'to_string'), /check e\n {4}when Num n: sprintf "%g" n/);
  assert.match(steps('word-tools.el', 'word-tools-repeated'), /keeping the cursor where it is afterwards:\n {4}run goto-char/);
  assert.match(steps('OrderService.cs', 'PayAsync'), /set order to _orders\.FirstOrDefault\(o => o\.Id == orderId\)\nif order is nothing/);
  assert.match(steps('UserController.php', 'search'), /for each \$user in User::where/);
  const sql = R.analyze('sql', 'shop_schema.sql', read('shop_schema.sql'));
  assert.match(sql.sections.find(s => /^Query/.test(s.title)).facts.join(' '), /joins 3 tables/);
  for (const f of SAMPLES) for (const s of R.analyze(EXPECT[f][0], f, read(f)).sections) assert.ok(s.steps.length <= 16, `${f}: ${s.title} has ${s.steps.length} steps`);
});

test('analyze: warnings for things worth checking', () => {
  assert.match(sec('inventory.py', s => s.kind === 'start').warnings.join(' '), /Line 54 has a TODO note: read restock orders/);
  const long = 'fn big() {\n' + '    let x = 1;\n'.repeat(90) + '}\n';
  assert.match(R.analyze('rust', 'big.rs', long).sections[0].warnings.join(' '), /This is 92 lines long/);
  assert.match(R.analyze('go', 'k.go', 'package main\n\nconst apiKey = "sk_live_1234567890abcdef"\n').sections.flatMap(s => s.warnings).join(' '), /`apiKey` looks like a secret/);
  assert.match(R.analyze('yaml', 'c.yml', 'db:\n  password: hunter2hunter2\n  url: http://example.org/db\n').sections.flatMap(s => s.warnings).join(' '), /`db\.password` looks like a secret[\s\S]*not encrypted/);
  assert.match(R.analyze('sql', 'w.sql', 'UPDATE users SET admin = 1;\nDELETE FROM logs;\n').sections.flatMap(s => s.warnings).join(' '), /changes every row[\s\S]*removes every row/);
  assert.match(R.analyze('java', 'E.java', 'class E {\n  void f() {\n    try { g(); } catch (Exception e) { }\n  }\n}\n').sections.flatMap(s => s.warnings).join(' '), /does nothing with it/);
  assert.match(R.analyze('csv', 'x.csv', 'a,b,c\n1,2,3\n4,5\n6,7,8\n').sections.flatMap(s => s.warnings).join(' '), /1 row has a different number of values/);
});

test('SQL is split into statements carefully: quotes, comments, $$ bodies, BEGIN…END and DELIMITER', () => {
  const parts = R.splitSql([
    "INSERT INTO t (a) VALUES ('semi;colon'), ('it''s');",
    '-- a comment; with a semicolon',
    "SELECT \"odd;name\" FROM t /* also; here */ WHERE a = 'x';",
    'CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END; $$ LANGUAGE plpgsql;',
    'CREATE FUNCTION g() RETURNS int AS $body$ SELECT 2; $body$ LANGUAGE sql;',
    'CREATE TRIGGER tr AFTER INSERT ON t FOR EACH ROW BEGIN',
    '  UPDATE c SET n = n + 1;',
    '  INSERT INTO log VALUES (CASE WHEN 1 THEN 2 END);',
    'END;',
    'DELIMITER //',
    'CREATE PROCEDURE p() BEGIN SELECT 1; SELECT 2; END //',
    'DELIMITER ;',
    'SELECT 3',
  ].join('\n'));
  assert.equal(parts.length, 7, parts.map(p => p.text.slice(0, 30)).join(' | '));
  assert.match(parts[0].text, /'it''s'\)$/);
  assert.match(parts[1].text, /^SELECT "odd;name"/);
  assert.match(parts[2].text, /LANGUAGE plpgsql$/);
  assert.match(parts[4].text, /^CREATE TRIGGER[\s\S]*END$/);
  assert.match(parts[5].text, /^CREATE PROCEDURE[\s\S]*END$/);
  assert.equal(parts[6].text, 'SELECT 3');
  assert.equal(parts[4].start, 6);
  assert.equal(parts[4].end, 9);
  const a = R.analyze('sql', 'x.sql', "INSERT INTO t VALUES (1), (2), (3);\nINSERT INTO t VALUES (4);\nCREATE INDEX i ON t (a);\nCREATE TRIGGER tr AFTER INSERT OR DELETE ON t FOR EACH ROW BEGIN UPDATE c SET n = 1; END;\n");
  assert.equal(a.sections[0].headline, 'Adds 4 rows to `t`, in 2 `INSERT` statements.');
  assert.match(a.sections[2].headline, /Runs automatically after rows are added to or removed from `t`/);
});

test('nothing throws: empty, garbage, odd text and every language read as every other', () => {
  const junk = ['', '\n\n', '}{)(*&^%$#@!~`<>?/\\|;:\'",.[]{}\n\0\u0001 ))) ((( end end', 'ünïcødé — “quotes” 🙂\n\tтекст 中文 ' + '\u{1F600}'.repeat(3), 'x'.repeat(5000), '<%= %> {{ }} $$ /* -- (* '];
  const t = Date.now();
  LANGS.LANGUAGES.forEach((l, i) => {
    const others = [SAMPLES[i % SAMPLES.length], SAMPLES[(i * 7 + 3) % SAMPLES.length]];
    for (const src of junk.concat(others.map(read))) {
      let a;
      assert.doesNotThrow(() => { a = R.analyze(l.id, 'x', src); }, l.id);
      assert.equal(typeof a.ok, 'boolean', l.id);
      assert.equal(typeof a.overview, 'string', l.id);
      assert.ok(Array.isArray(a.sections), l.id);
      for (const s of a.sections) assert.ok(s.start >= 1 && s.end >= s.start, `${l.id}: ${s.title} ${s.start}-${s.end}`);
    }
    assert.doesNotThrow(() => { R.detect('x', junk[2]); R.detect('', junk[3]); R.detect(null, null); });
  });
  assert.equal(R.analyze('rust', 'e.rs', '').overview, 'e.rs is empty.');
  assert.equal(R.analyze('go', 'bad.go', '%%%% ((( }}}} ]]] package').ok, false);
  assert.ok(Date.now() - t < 15000, `took ${Date.now() - t} ms`);
});

test('the plain English is direct: no "simply", "just" or "easy", no exclamation marks, British spelling', () => {
  for (const f of SAMPLES) {
    const a = R.analyze(EXPECT[f][0], f, read(f));
    if (a.reader !== 'code') continue;
    const mine = ownWords(allText(a));
    assert.doesNotMatch(mine, /\b(simply|just|easy|easily|obviously|of course)\b/i, f);
    assert.doesNotMatch(mine, /!(\s|$)/, `${f}: an exclamation mark in: ${mine.match(/[^\n]*!(\s|$)[^\n]*/)}`);
    assert.doesNotMatch(mine, /\b(color|behavior|organize|organized|recognize|initialize|summarize|favorite|center)\b/i, f);
    for (const s of a.sections) assert.match(s.headline, /[.:)]$|`$/, `${f}: ${s.title}: "${s.headline}"`);
  }
});

test('the whole run stays fast', () => {
  assert.ok(loadMs < 20000, `loading every grammar took ${loadMs} ms`);
  const t = Date.now();
  for (const f of SAMPLES) R.analyze(EXPECT[f][0], f, read(f));
  assert.ok(Date.now() - t < 5000, `reading every sample took ${Date.now() - t} ms`);
});

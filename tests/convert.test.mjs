// Existing HTML, CSS, JavaScript, C++ and Arduino code -> sentences, checked exact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadConverter, ROOT } from './helpers/engine.mjs';

const { convert, W, WEB, CPP, BP, C, env } = await loadConverter();
const read = (p) => readFileSync(`${ROOT}/${p}`, 'utf8');
const hasGpp = spawnSync('g++', ['--version']).status === 0;

/* ids and classes on a page, as the app passes them to the Styling and Mechanics converters */
function pageNames(html) {
  const ids = {}, groups = new Set();
  const walk = (n) => {
    if (n.type === 'element' || n.type === 'script_element') {
      const st = n.namedChild(0);
      const tag = st.namedChild(0).text;
      for (const a of st.namedChildren.filter(x => x.type === 'attribute')) {
        const v = a.namedChild(1) ? a.namedChild(1).text.replace(/^"|"$/g, '') : '';
        if (a.namedChild(0).text === 'id') ids[v] = tag;
        if (a.namedChild(0).text === 'class') v.split(/\s+/).forEach(c => groups.add(c));
      }
    }
    for (const c of n.namedChildren) walk(c);
  };
  walk(W.parse('html', html));
  return { ids, groups: [...groups] };
}

const CASES = [
  // [file, kind, page it belongs to, pulled files, least share of lines that read as sentences]
  ['tests/corpus_web/landing.html', 'html', null, ['styles.css', 'app.js'], 0.8],
  ['tests/corpus_web/styles.css', 'css', 'tests/corpus_web/landing.html', null, 0.7],
  ['tests/corpus_web/app.js', 'js', 'tests/corpus_web/landing.html', null, 0.95],
  ['tests/corpus_web/scores.cpp', 'cpp', null, null, 0.95],
  ['tests/corpus_web/button_led.ino', 'arduino', null, null, 0.95],
  ['samples/taskboard/static/index.html', 'html', null, ['/static/style.css', '/static/app.js'], 0.6],
  ['samples/taskboard/static/style.css', 'css', 'samples/taskboard/static/index.html', null, 0.8],
  ['samples/taskboard/static/app.js', 'js', 'samples/taskboard/static/index.html', null, 0.5],
  ['samples/cpp/blink/blink.ino', 'arduino', null, null, 0.95],
  ['samples/cpp/inventory/main.cpp', 'cpp', null, null, 0.3],
  // held out: written after the converter, in other styles (classes, switch, templates, SVG, tables)
  ['tests/heldout_web/dashboard.html', 'html', null, ['dashboard.css'], 0.2],
  ['tests/heldout_web/dashboard.css', 'css', 'tests/heldout_web/dashboard.html', null, 0.3],
  ['tests/heldout_web/main.js', 'js', 'tests/heldout_web/dashboard.html', null, 0.25],
  ['tests/heldout_web/shapes.cpp', 'cpp', null, null, 0.3],
  ['tests/heldout_web/thermostat.ino', 'arduino', null, null, 0.8],
];

for (const [file, kind, page, pulled, least] of CASES) {
  test(`code -> sentences: ${file} comes back exactly`, () => {
    const extra = page ? pageNames(read(page)) : pulled ? { pulled } : {};
    const r = convert(kind, read(file), extra);
    assert.ok(r.ok, r.error);
    assert.equal(r.exact, true, `${file}: ${r.reason}\n${r.text}`);
    assert.ok(r.words / r.lines >= least, `${file}: only ${r.words}/${r.lines} lines read as sentences\n${r.text}`);
    // the sentences have no errors of their own
    const sec = { id: 'x', file: 'x', text: r.text };
    const res = kind === 'html' ? WEB.compileHtml(sec, { ids: {}, groups: {}, cssGroups: {}, addGroups: {} })
      : kind === 'css' || kind === 'js' ? WEB[kind === 'css' ? 'compileCss' : 'compileJs'](sec, { ids: Object.fromEntries(Object.entries(extra.ids || {}).map(([k, t]) => [k, { tag: t }])), groups: Object.fromEntries((extra.groups || []).map(g => [g, true])), cssGroups: {}, addGroups: {} })
        : CPP.compileCppProject({ kind: kind === 'arduino' ? 'arduino' : 'cpp', sections: [sec] }).results.x;
    assert.deepEqual(JSON.parse(JSON.stringify(res.info.flatMap(i => i.errs))), []);
  });
}

test('code -> sentences: the sentences read naturally', () => {
  const js = convert('js', read('tests/corpus_web/app.js'), pageNames(read('tests/corpus_web/landing.html'))).text;
  assert.match(js, /^when signup is sent\n    constant email is text of email$/m);   // const in the original, so a constant
  assert.match(js, /^    load "emails" from the browser and store in saved$/m);          // let in the original
  assert.match(js, /^    save saved in the browser as "emails"$/m);
  assert.match(js, /^if hour is less than 7 or hour is at least 15$/m);
  assert.match(js, /^    show "Batch \{i plus 1\} is in the oven"$/m);
  const cpp = convert('cpp', read('tests/corpus_web/scores.cpp')).text;
  assert.match(cpp, /^define class Student\n    field name: text\n    field score: whole number = 0$/m);
  assert.match(cpp, /^    when made using text name, whole number score\n        set self\.name to name$/m);
  assert.match(cpp, /^show ada\.name followed by " got " followed by ada\.grade\(\)$/m);
  assert.match(cpp, /^set decimal avg to average\(all\)$/m);
  const ino = convert('arduino', read('tests/corpus_web/button_led.ino')).text;
  assert.match(ino, /^when the board starts\n    make pin BUTTON an input with pull-up$/m);
  assert.match(ino, /^    if pin BUTTON is off$/m);
  const css = convert('css', read('tests/corpus_web/styles.css'), pageNames(read('tests/corpus_web/landing.html'))).text;
  assert.match(css, /^style group cta: background var\(--crust\), text colour white, no border, rounded corners 999, space inside 12 28, hand cursor$/m);
  assert.match(css, /^on screens narrower than 600px:\n    style group hero: space inside 40 16$/m);
  const html = convert('html', read('tests/corpus_web/landing.html'), { pulled: ['styles.css', 'app.js'] }).text;
  assert.match(html, /^    add a button called order saying "Order ahead" in group cta$/m);
  assert.match(html, /^        add a email box called email with hint "you@example.com"$/m);
});

test('code -> sentences: anything that can\'t be said stays exact code', () => {
  const r = convert('js', 'class A { #x = 1; get x() { return this.#x; } }\nconst a = new A();\nlabel: for (;;) { break label; }\n');
  assert.equal(r.exact, true);
  assert.match(r.text, /^js: class A/m);
  const c = convert('cpp', 'template <typename T> T twice(T v) { return v * 2; }\nint main() {\n  int n = twice(4);\n  std::cout << n << std::endl;\n  return 0;\n}\n');
  assert.equal(c.exact, true, c.reason);
  assert.match(c.text, /^above main: template <typename T>/m);
  assert.match(c.text, /^show n$/m);
});

test('code -> sentences: let and const, x++ and x += 1 each get their own sentence; one-line ifs count as the same', () => {
  const r = convert('js', 'const n = 2;\nlet c = 0;\nif (n > 1) c++;\nwhile (c < 5) c += 1;\n');
  assert.equal(r.exact, true, r.reason);
  assert.equal(r.kept, 0, r.text);
  assert.match(r.text, /^constant n is 2\nset c to 0\nif n is greater than 1\n    increase c\nwhile c is less than 5\n    increase c by 1$/m);
});

/* The checker itself: code that behaves differently must never count as the same. */
const same = (kind, a, b, extra = {}) => C.check(kind, a, b, env(extra)).same;
const page = (head, body, { open = '<html lang="en">', doctype = '<!DOCTYPE html>\n', charset = 'utf-8', viewport = 'width=device-width, initial-scale=1' } = {}) =>
  `${doctype}${open}\n<head>\n${charset ? `<meta charset="${charset}">\n` : ''}${viewport ? `<meta name="viewport" content="${viewport}">\n` : ''}<title>T</title>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
const DIFFERENT = [
  // JavaScript: for the text "5", x++ gives 6 but x += 1 gives "51"; const can't change; spaces in regexes, templates and strings are text
  ['js', 'x++;', 'x += 1;'],
  ['js', 'x--;', 'x -= 1;'],
  ['js', 'const x = 1;', 'let x = 1;'],
  ['js', 'for (const x of y) {}', 'for (let x of y) {}'],
  ['js', 'let r = /  +/g;', 'let r = / +/g;'],
  ['js', 'let t = `a  b`;', 'let t = `a b`;'],
  ['js', 'let s = "  ";', 'let s = " ";'],
  ['js', 'let v = (a?.b).c;', 'let v = a?.b.c;'],   // brackets end a ?. chain
  // C++: a class can give ++x, x++ and x += 1 different meanings; std:: only goes without `using namespace std`
  ['cpp', 'int main() { int x = 0; x++; }', 'int main() { int x = 0; x += 1; }'],
  ['cpp', 'int main() { int x = 0; ++x; }', 'int main() { int x = 0; x++; }'],
  ['cpp', '#include <iostream>\nint main() { cout << 1; }', '#include <iostream>\nint main() { std::cout << 1; }'],
  ['cpp', '#include <iostream>\nusing namespace std;\nint main() { cout << 1; }', '#include <iostream>\nint main() { std::cout << 1; }'],
  ['cpp', 'auto s = "a  b";', 'auto s = "a b";'],
  // CSS: numbers, colours and the text in quotes all count
  ['css', 'a { background: url("my  photo.jpg"); }', 'a { background: url("my photo.jpg"); }'],
  ['css', 'a { content: "  "; }', 'a { content: " "; }'],
  ['css', 'a { margin: -2px; }', 'a { margin: 5px; }'],
  ['css', 'a { color: #fff; }', 'a { color: #000; }'],
  // HTML: the doctype, the <html> tag, the <meta> settings and the order of styles and scripts in <head>
  ['html', page('', '<p>x</p>'), page('', '<p>x</p>', { doctype: '' })],
  ['html', page('', '<p>x</p>', { open: '<html lang="ar" dir="rtl">' }), page('', '<p>x</p>', { open: '<html lang="ar">' })],
  ['html', page('', '<p>x</p>', { open: '<html class="no-js">' }), page('', '<p>x</p>', { open: '<html>' })],
  ['html', page('', '<p>x</p>', { open: '<html>' }), page('', '<p>x</p>')],
  ['html', page('', '<p>x</p>', { viewport: 'width=1024' }), page('', '<p>x</p>')],
  ['html', page('', '<p>x</p>', { viewport: '' }), page('', '<p>x</p>')],
  ['html', page('', '<p>x</p>', { charset: 'iso-8859-1' }), page('', '<p>x</p>')],
  ['html', page('<link rel="stylesheet" href="own.css">\n<style>p { color: red; }</style>', '<p>x</p>'), page('<style>p { color: red; }</style>\n<link rel="stylesheet" href="style.css">', '<p>x</p>'), { pulled: ['own.css'] }],
  ['html', page('<script src="app.js" defer></script>', '<p>x</p>'), page('', '<p>x</p>\n<script src="script.js"></script>'), { pulled: ['app.js'] }],
  // HTML: spaces that show (inside <pre>, <textarea> and scripts; between inline things; a no-break space)
  ['html', page('', '<pre>  a</pre>'), page('', '<pre> a</pre>')],
  ['html', page('', '<textarea>a\n  b</textarea>'), page('', '<textarea>a\n b</textarea>')],
  ['html', page('', '<script>let t = `a\n  b`;</script>'), page('', '<script>let t = `a\n b`;</script>')],
  ['html', page('', '<nav><a>A</a><a>B</a></nav>'), page('', '<nav><a>A</a>\n <a>B</a></nav>')],
  ['html', page('', '<p><img src="a"><img src="b"></p>'), page('', '<p><img src="a">\n<img src="b"></p>')],
  ['html', page('', '<p>a <b>x</b></p>'), page('', '<p>a<b>x</b></p>')],
  ['html', page('', '<p>a&nbsp;b</p>'), page('', '<p>a b</p>')],
];
test('checker: code that behaves differently is reported as different', () => {
  for (const [kind, a, b, extra] of DIFFERENT) {
    assert.equal(same(kind, a, b, extra), false, `${kind} should differ:\n${a}\n---\n${b}`);
    assert.equal(same(kind, b, a, extra && extra.pulled ? { pulled: ['style.css', 'script.js', ...extra.pulled] } : extra), false, `${kind} should differ (the other way round):\n${b}\n---\n${a}`);
  }
});
test('checker: what still counts as the same really is the same', () => {
  const SAME = [
    ['js', 'x++;', '++x;'],
    ['js', 'if (a) b();', 'if (a) { b(); }'],
    ['js', 'let v = (a + b) * c;', 'let v = (a + b) * c;'],
    ['cpp', '#include <iostream>\nusing namespace std;\nint main() { cout << 1; }', '#include <iostream>\nusing namespace std;\nint main() { std::cout << 1; }'],
    ['cpp', 'int main() { int x = 1; return 0; }', 'int main() { int x = 1; }'],
    ['css', 'a  >  b { color: red; }', 'a > b { color: red; }'],
    ['html', page('', '<p>a   b</p>'), page('', '<p>a b</p>')],
    ['html', page('', '<p>  a b  </p>'), page('', '<p>a b</p>')],
    ['html', page('', '<ul><li>a</li><li>b</li></ul>'), page('', '<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>')],
    ['html', page('', '<p><img src="a">  <img src="b"></p>'), page('', '<p><img src="a">\n<img src="b"></p>')],
    ['html', page('', '<p>x</p>', { charset: 'UTF-8', viewport: 'width=device-width, initial-scale=1.0' }), page('', '<p>x</p>')],
  ];
  for (const [kind, a, b] of SAME) assert.equal(same(kind, a, b), true, `${kind} should be the same:\n${a}\n---\n${b}`);
});

test('code -> sentences: exact where the checker used to look away', () => {
  const exact = (kind, src, extra, re) => { const r = convert(kind, src, extra || {}); assert.equal(r.exact, true, `${r.reason}\n${r.text}`); if (re) assert.match(r.text, re); return r; };
  // a reply that changes later is kept with let; x++ and x += 1 say different things
  let r = exact('js', 'let data = await (await fetch("/api")).json();\ndata = data.items;\n', null, /^fetch from "\/api" and store in data\nset data to data\.items$/m);
  assert.equal(r.kept, 0, r.text);
  exact('js', 'let data = await (await fetch("/api")).json();\nconsole.log(data);\n', null, /^set data to await \(await fetch\("\/api"\)\)\.json\(\)$/m);
  r = exact('js', 'let n = 0;\nn++;\nn += 1;\n', null, /^increase n\nincrease n by 1$/m);
  assert.equal(r.kept, 0, r.text);
  exact('js', 'function f(a) {\n  a = a + 1;\n  return a;\n}\nfor (let x of [1, 2]) {\n  x = x * 2;\n}\n', null, /^    set a to a plus 1$/m);
  exact('cpp', 'int main() {\n    int x = 0;\n    x++;\n    ++x;\n}\n', null, /^increase x\nc\+\+: \+\+x;$/m);
  // the <html> tag, a page without a doctype or settings, styles in order, spaces in <pre> and scripts
  exact('html', page('', '<h1>Hi</h1>', { open: '<html lang="ar" dir="rtl">' }), null, /^page language is ar\nhtml attributes: dir="rtl"$/m);
  r = exact('html', '<html>\n<head>\n<title>Old</title>\n<link rel="stylesheet" href="s.css">\n<style>\n  p { color: red; }\n</style>\n</head>\n<body>\n  <section>\n    <pre>\n  one\n    two\n</pre>\n    <script>\n      let t = `a\n  b`;\n    </script>\n  </section>\n  <nav><a href="/a">A</a><a href="/b">B</a></nav>\n</body>\n</html>\n', { pulled: ['s.css'] },
    /^no doctype\nno page language\npage title is "Old"\nhead: <link rel="stylesheet" href="style.css">\nhead: <style>\nhead:   p \{ color: red; \}\nhead: <\/style>\nleave out the character set\nleave out the viewport setting$/m);
  assert.match(r.text, /^    html: <pre>\n    html:   one\n    html:     two\n    html: <\/pre>$/m);
  exact('html', page('<script src="app.js" defer></script>\n<link rel="stylesheet" href="s.css">', '<nav>\n  <a href="/"> Home </a>\n  <a href="/b">B</a>\n</nav>', { viewport: 'width=1024' }), { pulled: ['s.css', 'app.js'] },
    /^head: <meta name="viewport" content="width=1024">\nhead: <script src="script\.js" defer><\/script>\nadd a navigation bar\n    add a link to "\/" saying " Home "$/m);
  exact('html', page('<meta http-equiv="Content-Type" content="text/html; charset=utf-8">', '<p>x</p>'), null, /^page title is "T"\nhead: <meta http-equiv/m);
  // inline things with nothing between them stay on one line (a line break would show as a space)
  exact('html', page('', '<h1>Hi</h1>\n<img src="a.png" alt="A"><img src="b.png" alt="B">\n<section>\n  <b>x</b><i>y</i>\n</section>'), null,
    /^add a big heading "Hi"\nhtml: <img src="a\.png" alt="A"><img src="b\.png" alt="B">\nadd a section\n    html: <b>x<\/b><i>y<\/i>$/m);
});

test('code -> sentences: C++ main with inputs is reported, not guessed', () => {
  const r = convert('cpp', 'int main(int argc, char** argv) { return 0; }\n');
  assert.equal(r.ok, false);
  assert.match(r.error, /argc/);
});

/* Every blueprint's code, turned back into sentences, is checked exact. */
test('code -> sentences: code made from every blueprint comes back exactly', () => {
  for (const src of BP.BUILT_IN) {
    const bp = BP.parse(src);
    if (bp.kind === 'snippet' || !['website', 'cpp'].includes(bp.layout)) continue;
    const secs = BP.fill(bp, {});
    if (bp.layout === 'cpp') {
      const code = CPP.compileCppProject({ sections: [{ id: 'p', file: 'program', text: secs.program }] }).results.p.text;
      const r = convert('cpp', code);
      assert.equal(r.exact, true, `${bp.title}: ${r.reason}\n${code}\n${r.text}`);
      continue;
    }
    const site = WEB.compileWebsite({ sections: ['structure', 'styling', 'mechanics'].map(f => ({ id: f, file: f, text: secs[f] || '' })) });
    const html = site.results.structure.text;
    const names = pageNames(html);
    for (const [f, kind] of [['structure', 'html'], ['styling', 'css'], ['mechanics', 'js']]) {
      const r = convert(kind, site.results[f].text, kind === 'html' ? { pulled: ['style.css', 'script.js'] } : names);
      assert.equal(r.exact, true, `${bp.title} ${f}: ${r.reason}\n${site.results[f].text}\n${r.text}`);
    }
  }
});

/* New sentences: C++ classes and Arduino sketches make valid code. */
const ARDUINO_H = `#include <string>
#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2
#define LED_BUILTIN 13
#define A0 14
struct String { std::string s; String(const char* c = "") : s(c) {} String(int v) : s(std::to_string(v)) {} String(long v) : s(std::to_string(v)) {} String(unsigned long v) : s(std::to_string(v)) {} String(double v) : s(std::to_string(v)) {} String operator+(const String& o) const { return String((s + o.s).c_str()); } int length() const { return (int)s.size(); } int toInt() const { return std::stoi(s); } double toFloat() const { return std::stod(s); } };
struct SerialT { void begin(long) {} template <typename T> void print(T) {} template <typename T> void println(T) {} } Serial;
inline void pinMode(int, int) {} inline void digitalWrite(int, int) {} inline int digitalRead(int) { return 0; } inline int analogRead(int) { return 0; }
inline void analogWrite(int, int) {} inline void delay(unsigned long) {} inline unsigned long millis() { return 0; } inline long random(long a, long b) { return a; }
inline void tone(int, int, unsigned long = 0) {} inline void noTone(int) {}
`;
function compiles(source, arduino, label) {
  if (!hasGpp) return;
  // like the Arduino builder, declare every function first, so the order doesn't matter
  const protos = arduino ? [...source.matchAll(/^([A-Za-z_][\w:<>]*[\s*&]+)([A-Za-z_]\w*)\(([^)]*)\)\s*\{/gm)].map(m => `${m[1]}${m[2]}(${m[3]});`).join('\n') + '\n' : '';
  const input = arduino ? ARDUINO_H + protos + source + '\nint main() { setup(); loop(); }\n' : source;
  const r = spawnSync('g++', ['-std=c++20', '-fsyntax-only', '-x', 'c++', '-'], { input });
  assert.equal(r.status, 0, `${label}: g++ rejected it\n${r.stderr}\n${source}`);
}

test('C++ classes: fields, a constructor, tools, private parts and objects', () => {
  const r = CPP.compileCppProject({ sections: [{ id: 'p', file: 'program', text: [
    'define class Account',
    '    field owner: text',
    '    has decimal balance starting at 0',
    '    when made using text owner',
    '        set self.owner to owner',
    '    define deposit using decimal amount giving back nothing',
    '        increase balance by amount',
    '    the rest is private',
    '    field pin: whole number = 1234',
    'define class Savings based on Account',
    '    field rate: decimal = 0.02',
    'make a new Account with "Sam" and store in acc',
    'run acc.deposit with 25.5',
    'show acc.owner and acc.balance',
    'constant LIMIT is 100',
    'set decimal total to 0',
  ].join('\n') }] }).results.p;
  assert.deepEqual(JSON.parse(JSON.stringify(r.info.flatMap(i => i.errs))), []);
  assert.match(r.text, /class Account \{\npublic:\n    std::string owner;\n    double balance = 0;\n    Account\(std::string owner\) \{\n        this->owner = owner;\n    \}/);
  assert.match(r.text, /    void deposit\(double amount\) \{\n        balance \+= amount;\n    \}\nprivate:\n    int pin = 1234;\n\};/);
  assert.match(r.text, /class Savings : public Account \{/);
  assert.match(r.text, /    Account acc\("Sam"\);\n    acc\.deposit\(25\.5\);/);
  assert.match(r.text, /    const int LIMIT = 100;\n    double total = 0;/);
  compiles(r.text, false, 'classes');
});

test('Arduino: setup, loop, pins, time, sound and the serial monitor', () => {
  const r = CPP.compileCppProject({ kind: 'arduino', sections: [{ id: 's', file: 'sketch', text: [
    'constant LED is 13',
    'create list of numbers called notes with 262, 294, 330',
    'when the board starts',
    '    make pin LED an output',
    '    make pin 2 an input with pull-up',
    '    start the serial monitor at 9600',
    'over and over',
    '    turn pin LED on',
    '    wait 0.5 seconds',
    '    turn off the built-in light',
    '    if pin 2 is off',
    '        show "pressed at {time since start}"',
    '    for each n in notes',
    '        play a tone of n on pin 8 for 200 milliseconds',
    '    read analog pin A0 and store in level',
    '    set the brightness of pin 9 to level divided by 4',
    '    set dice to random number from 1 to 6',
    '    run blinkTimes with 3',
    'define blinkTimes using count',
    '    repeat count times',
    '        turn on the built-in light',
    '        wait 100 milliseconds',
  ].join('\n') }] }).results.s;
  assert.deepEqual(JSON.parse(JSON.stringify(r.info.flatMap(i => i.errs))), []);
  assert.match(r.text, /^const int LED = 13;\nint notes\[\] = \{262, 294, 330\};\nvoid setup\(\) \{\n    pinMode\(LED, OUTPUT\);\n    pinMode\(2, INPUT_PULLUP\);\n    Serial\.begin\(9600\);\n\}/);
  assert.match(r.text, /    digitalWrite\(LED, HIGH\);\n    delay\(500\);\n    digitalWrite\(LED_BUILTIN, LOW\);/);
  assert.match(r.text, /if \(digitalRead\(2\) == LOW\) \{\n        Serial\.println\(String\("pressed at "\) \+ millis\(\)\);/);
  assert.match(r.text, /int dice = random\(1, 7\);/);
  assert.match(r.text, /void blinkTimes\(int count\) \{/);
  assert.doesNotMatch(r.text, /int main/);
  compiles(r.text, true, 'arduino');
});

test('Arduino: steps at the left edge and asking for input are explained', () => {
  const r = CPP.compileCppProject({ kind: 'arduino', sections: [{ id: 's', file: 'sketch', text: 'turn pin 13 on\nwhen the board starts\n    ask "name?" and store in n' }] }).results.s;
  const errs = r.info.flatMap(i => i.errs).join(' ');
  assert.match(errs, /steps go inside "when the board starts"/);
  assert.match(errs, /no keyboard/);
  assert.match(r.text, /void loop\(\) \{\n\}/);   // an empty loop is added so the sketch still builds
});

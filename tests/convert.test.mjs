// Existing HTML, CSS, JavaScript, C++ and Arduino code -> sentences, checked exact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadConverter, ROOT } from './helpers/engine.mjs';

const { convert, W, WEB, CPP, BP } = await loadConverter();
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
  assert.match(js, /^when signup is sent\n    get the text of email and store in email$/m);
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

test('code -> sentences: let/const, x++ and one-line ifs count as the same', () => {
  const r = convert('js', 'const n = 2;\nlet c = 0;\nif (n > 1) c++;\nwhile (c < 5) c += 1;\n');
  assert.equal(r.exact, true, r.reason);
  assert.equal(r.kept, 0, r.text);
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

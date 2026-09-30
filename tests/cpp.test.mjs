import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { loadEngine, loadWebReader, ROOT } from './helpers/engine.mjs';

const { CPP, BP } = loadEngine();
const W = await loadWebReader();
const plain = (x) => JSON.parse(JSON.stringify(x));
const cpp = (text) => CPP.compileCppProject({ sections: [{ id: 'program', file: 'program', text }] }).results.program;
const hasGpp = spawnSync('g++', ['--version']).status === 0;

/* Valid C++: always parse with tree-sitter; compile with g++ too when it is installed (it is on GitHub). */
function assertValidCpp(source, label) {
  const a = W.analyzeCpp('check.cpp', source, { fileOf: () => null, localFns: new Set() });
  assert.ok(a.ok, `${label}: tree-sitter could not read the generated C++\n${source}`);
  if (hasGpp) {
    const r = spawnSync('g++', ['-std=c++20', '-fsyntax-only', '-Wall', '-x', 'c++', '-'], { input: source });
    assert.equal(r.status, 0, `${label}: g++ rejected the generated C++\n${r.stderr}\n${source}`);
  }
}

test('C++ and Arduino: each line with a ‹blank› has one problem', () => {
  const r = cpp('set gain to ‹a decimal, like 0.5›\nshow "Gain: {gain} ‹units›"\nnote: fill in the ‹blanks›\nset ‹name› to 3');
  assert.deepEqual(plain(r.info.map(i => i.errs)), [['Fill in the ‹a decimal, like 0.5› slot.'], ['Fill in the ‹units› slot.'], [], ['Fill in the ‹name› slot.']]);
  assert.match(r.text, /text\("Gain: ", gain, " ‹units›"\)/);
  const s = CPP.compileCppProject({ kind: 'arduino', sections: [{ id: 's', file: 'sketch', text: 'constant LED is 13\nwhen the board starts\n    make pin LED an output\nover and over\n    wait ‹how long› milliseconds' }] }).results.s;
  assert.deepEqual(plain(s.info.flatMap(i => i.errs)), ['Fill in the ‹how long› slot.']);
  assert.match(s.text, /delay\(_\);/);
});

test('C++: values get types, show and ask', () => {
  const r = cpp('set name to "Sam"\nset age to 30\nset height to 1.8\nset happy to yes\nask for a number "Guess: " and store in guess\nshow "Hi" and name and age');
  assert.deepEqual(plain(r.info.flatMap(i => i.errs)), []);
  assert.match(r.text, /std::string name = "Sam";/);
  assert.match(r.text, /int age = 30;/);
  assert.match(r.text, /double height = 1\.8;/);
  assert.match(r.text, /bool happy = true;/);
  assert.match(r.text, /int guess; std::cout << "Guess: ";\n\s+std::cin >> guess;/);
  assert.match(r.text, /std::cout << "Hi" << " " << name << " " << age << std::endl;/);
  assertValidCpp(r.text, 'values');
});

test('C++: tools go above main, loops and lists', () => {
  const r = cpp('define double_it using n\n    give back n times 2\ncreate list of numbers called scores with 3, 5, 8\nset total to 0\nfor each s in scores\n    increase total by s\ncount i from 1 to 3\n    show i\nrun double_it with total and store in d\nshow d');
  assert.deepEqual(plain(r.info.flatMap(i => i.errs)), []);
  assert.ok(r.text.indexOf('auto double_it(auto n)') < r.text.indexOf('int main()'));
  assert.match(r.text, /std::vector<int> scores = \{3, 5, 8\};/);
  assert.match(r.text, /for \(int i = 1; i <= 3; i\+\+\) \{/);
  assertValidCpp(r.text, 'tools');
});

test('C++: text with {values} and random numbers add their helpers', () => {
  const r = cpp('set n to random number from 1 to 6\nshow "You rolled {n}"');
  assert.match(r.text, /int random_number\(int low, int high\)/);
  assert.match(r.text, /text\("You rolled ", n\)/);
  assertValidCpp(r.text, 'helpers');
});

test('C++: {{ and }} are braces in text with values; increase gives ++; words in quotes never split a sentence', () => {
  const r = cpp('set n to 1\nshow "{{n}} is {n}"\nincrease n\nincrease n by 1\ncreate list of text called notes with "a"\nadd "walk to the shop" to notes');
  assert.deepEqual(plain(r.info.flatMap(i => i.errs)), []);
  assert.match(r.text, /text\("\{n\} is ", n\)/);
  assert.match(r.text, /n\+\+;\n\s+n \+= 1;/);
  assert.match(r.text, /notes\.push_back\("walk to the shop"\);/);
  assertValidCpp(r.text, 'braces');
});

test('C++: lists need a kind', () => {
  assert.ok(cpp('create list things').info.flatMap(i => i.errs).some(e => /needs to know what the list will hold/.test(e)));
});

test('C++ blueprints make valid C++', () => {
  for (const src of BP.BUILT_IN) {
    const bp = BP.parse(src);
    if (bp.layout !== 'cpp') continue;
    for (const f of bp.fields.filter(x => x.choices)) for (const v of f.choices) {
      const r = cpp(BP.fill(bp, { [f.name]: v }).program);
      assert.deepEqual(plain(r.info.flatMap(i => i.errs)), [], v);
      assertValidCpp(r.text, `${bp.title} (${v})`);
    }
  }
});

test('reader: C++ program, header links, memory and safety warnings', () => {
  const files = readdirSync(ROOT + '/samples/cpp/inventory').map(f => ({ name: 'inventory/' + f, source: readFileSync(ROOT + '/samples/cpp/inventory/' + f, 'utf8') }));
  const p = W.analyzeProject(files, null);
  const main = p.files.find(f => f.path === 'inventory/main.cpp');
  assert.equal(main.role, 'entry');
  assert.deepEqual(plain(main.imports), ['inventory/item.h']);
  const warn = main.analysis.sections.flatMap(s => s.warnings).join(' ');
  assert.match(warn, /memory leak/);
  assert.match(warn, /strcpy/);
  const item = p.files.find(f => f.path === 'inventory/item.cpp');
  assert.match(item.analysis.sections.flatMap(s => s.facts).join(' '), /read-only reference/);
});

test('reader: Arduino sketches read naturally', () => {
  const a = W.analyzeCpp('blink.ino', readFileSync(ROOT + '/samples/cpp/blink/blink.ino', 'utf8'), { fileOf: () => null, localFns: new Set() });
  const steps = a.sections.flatMap(s => s.steps).join('\n');
  assert.match(steps, /use pin LED_PIN as an output/);
  assert.match(steps, /turn LED_PIN on/);
  assert.match(steps, /wait 5000 milliseconds/);
  assert.match(a.sections.flatMap(s => s.warnings).join(' '), /millis\(\)/);
});

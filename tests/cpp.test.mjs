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

test('C++ and Arduino: "is even" and "is odd" test the remainder after dividing by 2', () => {
  const r = cpp('count i from 1 to 6\n    if i is even\n        show i\n    otherwise if i is odd\n        show "odd"\nset n to 3\nif n is not even\n    show n\nif n plus 1 is even\n    show "n plus 1 is even"\ncreate list of numbers called scores with 3, 5, 8\nif length of scores is odd and item 0 of scores is odd\n    show "odd"');
  assert.deepEqual(plain(r.info.flatMap(i => i.errs.concat(i.warns))), []);
  assert.match(r.text, /\n\s+if \(i % 2 == 0\) \{/);
  assert.match(r.text, /\} else if \(i % 2 != 0\) \{/);   // != 0, not == 1: in C++ -3 % 2 is -1
  assert.match(r.text, /if \(n % 2 != 0\) \{/);
  assert.match(r.text, /if \(\(n \+ 1\) % 2 == 0\) \{/);
  assert.match(r.text, /if \(scores\.size\(\) % 2 != 0 && scores\[0\] % 2 != 0\) \{/);
  assert.doesNotMatch(r.text, /[=!]= (?:even|odd)\b/);
  assertValidCpp(r.text, 'even and odd');
  const s = CPP.compileCppProject({ kind: 'arduino', sections: [{ id: 's', file: 'sketch', text: 'constant LED is 13\ncreate list of numbers called pins with 2, 3, 4\nwhen the board starts\n    make pin LED an output\nover and over\n    count i from 1 to 6\n        if i is even\n            turn pin LED on\n        if i is odd\n            turn pin LED off\n        wait 500 milliseconds\n    if length of pins is odd\n        wait 1 second' }] }).results.s;
  assert.deepEqual(plain(s.info.flatMap(i => i.errs.concat(i.warns))), []);
  assert.match(s.text, /if \(i % 2 == 0\) \{/);
  assert.match(s.text, /if \(i % 2 != 0\) \{/);
  assert.match(s.text, /if \(\(sizeof\(pins\) \/ sizeof\(pins\[0\]\)\) % 2 != 0\) \{/);
});

test('C++: a tool run inside a phrase keeps its brackets, so "length of" wraps the whole call', () => {
  const r = cpp('define f using a\n    give back a\ndefine g using a\n    give back a\ncreate list of text called words with "a", "bc"\nshow length of f(g(words))\nshow first item of f(g(words))\nshow item 1 of f(words)\nshow length of f(words)[1]\nshow f(g(1)) as text\nset n to random number from 1 to f(g(6))');
  assert.deepEqual(plain(r.info.flatMap(i => i.errs)), []);
  assert.match(r.text, /std::cout << f\(g\(words\)\)\.size\(\) << std::endl;/);
  assert.match(r.text, /std::cout << f\(g\(words\)\)\.front\(\) << std::endl;/);
  assert.match(r.text, /std::cout << f\(words\)\[1\] << std::endl;/);
  assert.match(r.text, /std::cout << f\(words\)\[1\]\.size\(\) << std::endl;/);
  assert.match(r.text, /std::cout << std::to_string\(f\(g\(1\)\)\) << std::endl;/);
  assert.match(r.text, /int n = random_number\(1, f\(g\(6\)\)\);/);
  assertValidCpp(r.text, 'calls inside phrases');
});

// brackets that would apply to the result of "length of x" (x.size() (…)): an error on that line, never silently wrong C++
for (const [sentences, re] of [
  ['create list of numbers called xs with 1\nshow length of xs (0)', /The brackets after "length of xs" don't belong to anything/],
  ['create list of numbers called xs with 1\nshow length of xs [0]', /write them right after it, with no space: `xs\[…\]`/],
  ['define f using a\n    give back a\nshow length of f(f(f(f(f(1)))))', /can't follow the brackets in "length of f\(f\(f\(f\(f\(1\)\)\)\)\)".*write this line as c\+\+:/],
  ['define f using a\n    give back a\nshow length of f(1', /can't follow the brackets/],
  ['define f using a\n    give back a\nset n to random number from 1 to f (6)', /The brackets after "random number from 1 to f" don't belong to anything. If they go with `f`/],
]) {
  test(`C++: explains loose brackets: ${sentences.split('\n').pop()}`, () => {
    const r = cpp(sentences);
    assert.ok(r.info.at(-1).errs.some(e => re.test(e)), plain(r.info.flatMap(i => i.errs)).join('\n'));
  });
}

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

// ---- from the 2026-11 audit: C++ sentences that gave code meaning something else, with nothing shown ----
test('C++: text joined with plus is text (never pointer arithmetic); a decimal given later makes a double', () => {
  const r = cpp('set score to 3\nshow "Score: " plus score\nset label to "Total: " plus score plus " points"\nset total to 0\nincrease total by 0.5\nshow total');
  assert.deepEqual(plain(r.info.flatMap(i => i.errs.concat(i.warns))), []);
  assert.match(r.text, /std::cout << std::string\("Score: "\) \+ std::to_string\(score\) << std::endl;/);
  assert.match(r.text, /std::string label = std::string\("Total: "\) \+ std::to_string\(score\) \+ " points";/);   // (a std::string plus quoted text is text)
  assert.match(r.text, /double total = 0;/);
  assertValidCpp(r.text, 'text and decimals');
  const s = CPP.compileCppProject({ kind: 'arduino', sections: [{ id: 's', file: 'sketch', text: 'set t to 20\nwhen the board starts\n    start the serial monitor at 9600\nover and over\n    show "Temp: " plus t' }] }).results.s;
  assert.match(s.text, /Serial\.println\(String\("Temp: "\) \+ t\);/);
});

test('C++: "not x is y", chains, "is A or B", = in a condition, a comparison shown, size minus 1 mean what they say', () => {
  const r = cpp('set x to 5\nset y to 2\nset answer to "y"\ncreate list of numbers called xs with 1\nif not x is y\n    show "differ"\nif 1 is less than x is less than 10\n    show "between"\nif answer is "yes" or "y"\n    show "going"\nif x = 5\n    show "five"\nshow x is 5\ncount i from 0 to length of xs minus 1\n    show i');
  assert.deepEqual(plain(r.info.flatMap(i => i.errs.concat(i.warns))), []);
  assert.match(r.text, /if \(!\(x == y\)\) \{/);
  assert.match(r.text, /if \(1 < x && x < 10\) \{/);
  assert.match(r.text, /if \(answer == "yes" \|\| answer == "y"\) \{/);
  assert.match(r.text, /if \(x == 5\) \{/);
  assert.match(r.text, /std::cout << \(x == 5\) << std::endl;/);
  assert.match(r.text, /i <= static_cast<int>\(xs\.size\(\)\) - 1/);
  assertValidCpp(r.text, 'two readings');
});

test('C++: count down with no name, in steps of, and text asked for after a number', () => {
  const r = cpp('count down from 3 to 1\n    show n\ncount i from 0 to 10 in steps of 5\n    show i\nask for a number "Age? " and store in age\nask "Name? " and store in name');
  assert.deepEqual(plain(r.info.flatMap(i => i.errs)), []);
  assert.match(r.text, /for \(int n = 3; n >= 1; n--\) \{/);
  assert.match(r.text, /for \(int i = 0; i <= 10; i \+= 5\) \{/);
  assert.match(r.text, /std::getline\(std::cin >> std::ws, name\);/);
  assertValidCpp(r.text, 'counting and asking');
  const b = cpp('create list of text called basket with "jam"\nadd "milk" and "eggs" to basket');
  assert.match(b.text, /basket\.push_back\("milk"\); basket\.push_back\("eggs"\);/);
});

for (const [sentences, re, warn] of [
  ['set n to 3\ncount i from n to 1\n    show i', /can't tell which way this counts/],
  ['set n to 5\nset r to random number from 1 to n plus 1', /Put brackets round the end you mean/],
  ['set price to 3\nset qty to 2\nshow price times qty as text', /could go with just `qty` or with all of it/],
  ['set colour to "red"\nif colour is not "red" or "blue"\n    show "x"', /could mean two things/],
  ['set x to nothing', /can't be set to nothing/],
  ['define stats using a, b\n    give back a and b', /could mean two values/],
  ['set half to 7 divided by 2', /7 \/ 2 is 3, not 3\.5/, true],
]) {
  test(`C++: explains a problem: ${sentences.split('\n').pop()}`, () => {
    const r = cpp(sentences);
    const said = plain(r.info.flatMap(i => (warn ? i.warns : i.errs)));
    assert.ok(said.some(e => re.test(e)), said.join('\n'));
  });
}

test('C++: a note above a tool stays above main; description, using nothing, multiply and divide', () => {
  const r = cpp('note: greets people\ndefine greet using nothing\n    description: says hi\n    show "hi"\nnote: start here\nrun greet\nset x to 2\nmultiply x by 3\ndivide x by 2\nshow x');
  assert.deepEqual(plain(r.info.flatMap(i => i.errs)), []);
  assert.match(r.text, /\/\/ greets people\n\/\*\*\n \* says hi\n \*\/\nauto greet\(\) \{/);
  assert.match(r.text, /int main\(\) \{\n    \/\/ start here\n    greet\(\);/);
  assert.match(r.text, /x \*= 3;\n    x \/= 2;/);
  assert.ok(r.info.some(i => i.warns.some(w => /keeps only the whole part/.test(w))), 'dividing a whole number warns');
  assertValidCpp(r.text, 'notes, description, multiply');
});

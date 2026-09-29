import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from './helpers/engine.mjs';

const { L } = loadEngine();

function py(sentences) {
  const r = L.compileProject({ sections: [{ id: 'main', file: 'main', text: sentences }] }).results.main;
  // JSON round-trip: arrays made inside the engine's sandbox don't deep-equal ordinary arrays
  return JSON.parse(JSON.stringify({ code: r.lines.filter(o => o.src >= 0).map(o => o.text).join('\n'), errors: r.info.flatMap(i => i.errs), warnings: r.info.flatMap(i => i.warns), header: r.lines.filter(o => o.src < 0).map(o => o.text) }));
}

const CASES = [
  ['set score to 0', 'score = 0'],
  ['set high score to 10', 'high_score = 10'],
  ['set API_KEY to "x"', 'API_KEY = "x"'],
  ['set total to 3 plus 4 times 2', 'total = 3 + 4 * 2'],
  ['set x to 1\nif x is at least 1 and x is not 5\n    show "ok"', 'x = 1\nif x >= 1 and x != 5:\n    print("ok")'],
  ['ask for a number "Age? " and store in age', 'age = int(input("Age? "))'],
  ['create list names with "Ana", "Bo"\nadd "Cy" to names', 'names = ["Ana", "Bo"]\nnames.append("Cy")'],
  ['set n to 1\nadd 5 to n', 'n = 1\nn += 5'],
  ['repeat 3 times\n    show "hi"', 'for _ in range(3):\n    print("hi")'],
  ['count i from 1 to 10\n    show i', 'for i in range(1, 11):\n    print(i)'],
  ['count down from 10 to 1\n    show n', 'for n in range(10, 0, -1):\n    print(n)'],
  ['set name to "Sam"\nshow "Hello {name}"', 'name = "Sam"\nprint(f"Hello {name}")'],
  ['define double using n\n    give back n times 2', 'def double(n):\n    return n * 2'],
  ['set words to "a b"\nshow length of item 0 of words', 'words = "a b"\nprint(len(words[0]))'],
  ['set guess to "5" as number', 'guess = int("5")'],
  ['print("raw", end="")', 'print("raw", end="")'],
  ['python: z = [i*i for i in range(3)]', 'z = [i*i for i in range(3)]'],
  ['please set score to 0', 'score = 0'],
  ['set age to 20\nif age is at least 18 then show "Welcome" and then show "!"', 'age = 20\nif age >= 18:\n    print("Welcome")\n    print("!")'],
  ['let\'s repeat 2 times: show "hi"', 'for _ in range(2):\n    print("hi")'],
  ['show "please just wait"', 'print("please just wait")'],
  ['set r to random number from 1 to 6', 'r = random.randint(1, 6)'],
];

for (const [sentences, expected] of CASES) {
  test(`translates: ${sentences.split('\n')[0]}`, () => {
    const out = py(sentences);
    assert.deepEqual(out.errors, []);
    assert.equal(out.code, expected);
  });
}

test('random adds its import', () => {
  assert.deepEqual(py('set r to random number from 1 to 6').header.filter(Boolean), ['import random']);
});

const ERRORS = [
  ['stop the loop', /only works inside a loop/],
  ['give back 3', /only works inside a tool/],
  ['frobnicate the thing', /don't recognise/],
  ['set if to 3', /Python's own words/],
  ['if x is 1', /Nothing is indented/],
  ['please', /only has filler/],
  ['    show "x"', /indented, but the line above/],
];
for (const [sentences, re] of ERRORS) {
  test(`explains a problem: ${sentences.trim()}`, () => {
    assert.ok(py(sentences).errors.some(e => re.test(e)), 'expected an error matching ' + re);
  });
}

test('unknown names are warnings with a suggestion', () => {
  const out = py('set score to 1\nshow scroe');
  assert.ok(out.warnings.some(w => /Did you mean `score`/.test(w)));
});

test('tools that change outside values get `global`', () => {
  assert.equal(py('set score to 0\ndefine bump\n    increase score by 1').code, 'score = 0\ndef bump():\n    global score\n    score += 1');
});

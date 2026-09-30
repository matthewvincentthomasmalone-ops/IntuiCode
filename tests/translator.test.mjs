import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { loadEngine, PYTHON } from './helpers/engine.mjs';

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
  ['please show "a    b"', 'print("a    b")'],
  ["check that 'a  b' is 'a  b'", "assert 'a  b' == 'a  b'"],
  ['set r to random number from 1 to 6', 'r = random.randint(1, 6)'],
  // words inside quotes never split a sentence
  ['create list tasks\nadd "Walk to the shop" to tasks\nremove "Walk to the shop" from tasks', 'tasks = []\ntasks.append("Walk to the shop")\ntasks.remove("Walk to the shop")'],
  ['create dictionary d\nset item "a of b" of d to 3', 'd = {}\nd["a of b"] = 3'],
  ['create dictionary prices\ndelete "apple" from prices\ndelete item "pear" of prices', 'prices = {}\ndel prices["apple"]\ndel prices["pear"]'],
  // {name} fills in a value; {{ and }} are braces
  ['set x to 1\nshow "{{x}} is {x}"\nshow "just {{braces}}"', 'x = 1\nprint(f"{{x}} is {x}")\nprint("just {braces}")'],
  // a block with only notes in it still gets a line Python accepts
  ['define todo\n    note: later', 'def todo():\n    # later\n    pass'],
  ['if yes\n    note: nothing yet\notherwise\n    show 2', 'if True:\n    # nothing yet\n    pass\nelse:\n    print(2)'],
  // descriptions (docstrings)
  ['define f\n    description: Does f.\n    description:\n    description: More.\n    description:\n    give back 1', 'def f():\n    """Does f.\n\n    More.\n    """\n    return 1'],
  // text in triple quotes over several python: lines keeps its spaces
  ['python: def f(item):\n    python: """Doc:\n    python:\n    python:         item: the thing\n    python:     """\n    python: return item', 'def f(item):\n    """Doc:\n\n        item: the thing\n    """\n    return item'],
  // a tool run inside a value: its brackets stay with its name, before "length of" and the like apply
  ['define all notes\n    give back ["a", "b"]\nshow "{length of all notes()}"', 'def all_notes():\n    return ["a", "b"]\nprint(f"{len(all_notes())}")'],
  ['define open database\n    give back 1\nset db to open database()', 'def open_database():\n    return 1\ndb = open_database()'],
  ['define all notes\n    give back ["a"]\nshow length of all notes ()\nshow first item of all notes()\nshow all notes() as text', 'def all_notes():\n    return ["a"]\nprint(len(all_notes()))\nprint(all_notes()[0])\nprint(str(all_notes()))'],
  ['define get name\n    give back " a "\nshow length of get name().strip()', 'def get_name():\n    return " a "\nprint(len(get_name().strip()))'],
  ['define notes using x\n    give back [x]\nset x to 1\nshow length of notes(sorted([x]))\nset y to max (x, 2)', 'def notes(x):\n    return [x]\nx = 1\nprint(len(notes(sorted([x]))))\ny = max(x, 2)'],
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

test('imports added for sentences go after the file\'s own description, which stays its docstring', () => {
  const r = L.compileProject({ sections: [{ id: 'main', file: 'main', text: 'description: Rolls a die.\nset r to random number from 1 to 6' }] }).results.main;
  assert.equal(r.text, '"""Rolls a die."""\nimport random\n\nr = random.randint(1, 6)\n');
});

const ERRORS = [
  ['stop the loop', /only works inside a loop/],
  ['give back 3', /only works inside a tool/],
  ['frobnicate the thing', /don't recognise/],
  ['set if to 3', /Python's own words/],
  ['if x is 1', /Nothing is indented/],
  ['please', /only has filler/],
  ['    show "x"', /indented, but the line above/],
  // brackets that would apply to the result of "length of x" (len(x) (…)): never silently wrong
  ['set x to [1]\nshow length of x (0)', /brackets after "length of x" don't belong to anything/],
  ['set x to [[1]]\nshow length of x [0]', /write them right after it, with no space: `x\[…\]`/],
  ['define f using a\n    give back [a]\nshow length of f(f(f(f(f(1)))))', /can't follow the brackets/],
  ['define f using a\n    give back [a]\nshow length of f(1', /can't follow the brackets/],
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

test('a tool run inside {…} in text runs the tool, not what "length of" gives back', () => {
  const r = L.compileProject({ sections: [{ id: 'main', file: 'main', text: 'define all notes\n    give back ["a", "b"]\nshow "{length of all notes()} notes"' }] }).results.main;
  assert.equal(execFileSync(PYTHON, ['-c', r.text], { encoding: 'utf8' }).trim(), '2 notes');
});

test('tools that change outside values get `global`', () => {
  assert.equal(py('set score to 0\ndefine bump\n    increase score by 1').code, 'score = 0\ndef bump():\n    global score\n    score += 1');
});

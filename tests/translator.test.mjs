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
  // a power binds tightest, as in maths (not a two-readings error): x minus x squared is x - x²
  ['set e to 1 minus t squared', 'e = 1 - t ** 2'],
  ['set e to (1 minus t) squared', 'e = (1 - t) ** 2'],
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
  // a field's kind is written as Python's type; Python types and other names stay as they are
  ['define class Point\n    field x: decimal\n    field y: decimal = 0\n    field z: float', 'class Point:\n    x: float\n    y: float = 0\n    z: float'],
  ['define class Item\n    field name: text\n    field count: whole number = 1\n    field done: yes/no = no\n    field tags: list of text\n    field scores: list[int]', 'class Item:\n    name: str\n    count: int = 1\n    done: bool = False\n    tags: list[str]\n    scores: list[int]'],
  ['python: from decimal import Decimal\ndefine class Price\n    field amount: Decimal', 'from decimal import Decimal\nclass Price:\n    amount: Decimal'],
  // a list taken out of a dictionary is still a list; a number taken out of one is still a number
  ['create dictionary room\nset item "items" of room to ["key"]\nset item "visits" of room to 0\nremove "key" from room["items"]\nadd "map" to room["items"]\nadd 1 to room["visits"]\nremove 1 from room["visits"]',
    'room = {}\nroom["items"] = ["key"]\nroom["visits"] = 0\nroom["items"].remove("key")\nroom["items"].append("map")\nroom["visits"] += 1\nroom["visits"] -= 1'],
  ['create dictionary totals\nset item "food" of totals to 0\ndefine spend using kind, amount, thing, bag\n    add amount to totals[kind]\n    remove thing from bag["things"]',
    'totals = {}\ntotals["food"] = 0\ndef spend(kind, amount, thing, bag):\n    totals[kind] += amount\n    bag["things"].remove(thing)'],
  // a tool kept in a dictionary, run by picking it out
  ['define look using what\n    show what\ncreate dictionary verbs\nset item "look" of verbs to look\nset verb to "look"\nrun verbs[verb] with "x"', 'def look(what):\n    print(what)\nverbs = {}\nverbs["look"] = look\nverb = "look"\nverbs[verb]("x")'],
  // text's own tools keep their dot next to the text
  ['create list here with "a", "b"\nshow "You see: " plus ", ".join(here) plus "."', 'here = ["a", "b"]\nprint("You see: " + ", ".join(here) + ".")'],
  // a tool with "for" in its name keeps its whole name
  ['define look for using what\n    give back what\nrun look for with "clues" and store in found\nrun look for with found', 'def look_for(what):\n    return what\nfound = look_for("clues")\nlook_for(found)'],
  // ---- from the 2026-11 audit: sentences that used to give code meaning something else, with no warning ----
  // "is A or B": the name is said again (`answer == "yes" or "y"` is always true)
  ['ask "Go on? " and store in answer\nif answer is "yes" or "y"\n    show "going"', 'answer = input("Go on? ")\nif answer == "yes" or answer == "y":\n    print("going")'],
  ['set x to 2\nif x is 1 or 2 or 3\n    show "small"', 'x = 2\nif x == 1 or x == 2 or x == 3:\n    print("small")'],
  // several things added or taken out at once
  ['create list basket\nadd "milk" and "eggs" to basket\nremove "milk" and "eggs" from basket', 'basket = []\nbasket.append("milk")\nbasket.append("eggs")\nbasket.remove("milk")\nbasket.remove("eggs")'],
  // "is even / odd / divisible by" after a sum is about the sum
  ['set n to 3\nif n plus 1 is even\n    show "even"\nif n minus 1 is divisible by 2\n    show "yes"\nif n is not odd\n    show "no"', 'n = 3\nif (n + 1) % 2 == 0:\n    print("even")\nif (n - 1) % 2 == 0:\n    print("yes")\nif n % 2 == 0:\n    print("no")'],
  // lists the translator can now see: from .split(), a python: line, a tool's result
  ['set words to "a b".split()\nadd "cat" to words', 'words = "a b".split()\nwords.append("cat")'],
  ['python: names = []\nadd "Bob" to names', 'names = []\nnames.append("Bob")'],
  ['define fresh list\n    give back []\nrun fresh list and store in items\nadd "x" to items', 'def fresh_list():\n    return []\nitems = fresh_list()\nitems.append("x")'],
  // each place keeps its own kinds: a tool's text called result, and Main's list called result
  ['define label using x\n    set result to "x"\n    give back result\ncreate list result\nadd "milk" to result', 'def label(x):\n    result = "x"\n    return result\nresult = []\nresult.append("milk")'],
  // a number joined to text is turned into text first
  ['set score to 3\nshow "Score: " followed by score', 'score = 3\nprint("Score: " + str(score))'],
  // "put … into" a value stores it; "store … as text in …" stores in the last name
  ['set count to 5\nput 0 into count\nset score to 5\nstore score as text in label', 'count = 5\ncount = 0\nscore = 5\nlabel = str(score)'],
  // numbers in words, "my", powers, a full stop, "for each … from … to"
  ['set x to twenty one\nset y to three hundred\nset my score to 2 to the power of 3\nshow my score\nset lives to 3.\nfor each k from 1 to 2\n    show k', 'x = 21\ny = 300\nscore = 2 ** 3\nprint(score)\nlives = 3\nfor k in range(1, 3):\n    print(k)'],
  // phrases inside phrases go first
  ['create list xs with 3, 1\nshow first item of sorted xs\nshow length of sorted xs\ncreate list grid with [1, 2], [3, 4]\nshow item 1 of item 0 of grid', 'xs = [3, 1]\nprint(sorted(xs)[0])\nprint(len(sorted(xs)))\ngrid = [[1, 2], [3, 4]]\nprint(grid[0][1])'],
  // "and" between tests is one test; "ask … in age as a number"; a keyword argument in a condition
  ['set a to 1\nset b to 2\nshow a is 1 and b is 2\nask "Age? " and store in age as a number\nif max([a, b], key=abs) is 2\n    show "two"', 'a = 1\nb = 2\nprint(a == 1 and b == 2)\nage = int(input("Age? "))\nif max([a, b], key=abs) == 2:\n    print("two")'],
  // a step worked out for counting down keeps its brackets; "count up" is said
  ['set s to 3\ncount down from 10 to 0 by s minus 1\n    show n\nset top to 3\ncount up i from 1 to top\n    show i', 's = 3\nfor n in range(10, -1, -(s - 1)):\n    print(n)\ntop = 3\nfor i in range(1, top + 1):\n    print(i)'],
  // a python: tool with an input that has a value to use when none is given
  ['python: def area(w, h=1):\n    python: return w * h\nrun area with 3', 'def area(w, h=1):\n    return w * h\narea(3)'],
  // a .name or [ right after text belongs to the text, inside the phrase (not len("a b").split())
  ['show length of "a b".split()\nshow count of \'a,b\'.split(",")\nshow length of "abc"[1:]', 'print(len("a b".split()))\nprint(len(\'a,b\'.split(",")))\nprint(len("abc"[1:]))'],
  ['show first item of "a b c".split()\nshow last item of "a b c".split()\nshow item 1 of "abc".upper()', 'print("a b c".split()[0])\nprint("a b c".split()[-1])\nprint("abc".upper()[1])'],
  // ... and text with {names}, .format and keys picked from a dictionary are as before
  ['set name to "Sam"\nshow "Hello {name}".upper()\nshow "x is {}".format(3)\nshow "abc"[0]\npython: d = {"k": 1}\nshow item "k" of d', 'name = "Sam"\nprint(f"Hello {name}".upper())\nprint("x is {}".format(3))\nprint("abc"[0])\nd = {"k": 1}\nprint(d["k"])'],
  // text before .format( stays exact: .format fills in the {…} (an f-string would fill {x} from the x outside first)
  ['set x to 3\nshow "{x}".format(x=5)\nshow "{{}} {}".format(1)\npython: d = {"x": 1}\nshow "{x}".format_map(d)', 'x = 3\nprint("{x}".format(x=5))\nprint("{{}} {}".format(1))\nd = {"x": 1}\nprint("{x}".format_map(d))'],
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
  // ---- two readings are an error, never a guess (2026-11 audit) ----
  ['set total to 10\nset count to 3\nshow total divided by count rounded to 2 places', /Put brackets round the part you mean: \(total divided by count\) rounded to 2 places/],
  ['set price to 3\nset qty to 2\nshow price times qty as text', /could go with just `qty` or with all of it/],
  ['set n to 5\nshow random number from 1 to n plus 1', /Put brackets round the end you mean/],
  ['set a to 0\nset a b to 1', /could be your name `a` followed by "b"/],
  ['set colour to "red"\nif colour is not "red" or "blue"\n    show "other"', /Say it in full: colour is not "red" or colour is not "blue"/],
  ['set name to "Bob"\nif name contains "a" and "b"\n    show "both"', /Say the whole test each time/],
  ['set x to 5\nif x is more than 1 or 2\n    show "?"', /could mean two things/],
  ['define stats using xs\n    set total to 1\n    set count to 2\n    give back total and count', /separate them with a comma: give back total, count/],
  ['set budget to 1,000', /Write numbers without commas: 1000, not 1,000/],
  ['set n to 3\ncount i from n to 1\n    show i', /can't tell which way this counts/],
  ['set no to 5', /a word sentences read as `False`/],
  ['set times to 2', /a word sentences read as `\*`/],
  ['python: rope = [1]\nset length of rope to 10\nshow length of rope', /could be the name `length_of_rope` or "length of" `rope`/],
  ['set x to 1\nif x is 1 then show 1 otherwise show 2', /"otherwise" starts a step of its own/],
  ['create list numbers with 1, 2\nfor each x in numbers from 1 to 2\n    show x', /This mixes two sentences/],
  ['set x to 20 1', /two numbers side by side/],
  ['define backup\n    show "b"\ntry to run backup', /don't recognise/],
  ['create list nums with 1\nadd 1 and 2 to total', /doesn't exist yet/],
  ['set n to 0\nadd 1 and 2 to n', /add one thing at a time/],
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

test('warnings where a sentence can\'t be checked: text compared with a number, a name only set in a tool, a name that hides a module', () => {
  assert.ok(py('ask "Age? " and store in age\nif age is 18\n    show "x"').warnings.some(w => /`age` holds text \(an answer from "ask" is always text\), so it is never equal to the number 18/.test(w)));
  assert.ok(py('define f\n    set temp to 1\nshow temp').warnings.some(w => /`temp` is only set inside the tool `f`/.test(w)));
  assert.ok(py('set time to 5').warnings.some(w => /`time` is also Python's `time` module/.test(w)));
  assert.ok(py('python: from shop import load\nset stock to load()\nset item to load()\nadd item to stock').warnings.some(w => /can't tell what `stock` or `item` hold/.test(w)));
  assert.ok(py('show point\ndefine class Point\n    pass').warnings.some(w => /`point` hasn't been set anywhere yet\. Did you mean `Point`\?/.test(w)), 'a class isn\'t found by another spelling');
});

test('an edit somewhere else doesn\'t change what another line means (each tool keeps its own kinds)', () => {
  const before = py('create list names\nadd "Ann" to names').code;
  const after = py('define shout using names\n    set names to names in capitals\n    give back names\ncreate list names\nadd "Ann" to names').code;
  assert.equal(after.split('\n').slice(-2).join('\n'), before);
});

test('setting a name in a tool: shared when it\'s set above the tool, the tool\'s own copy when it\'s only set below (Python\'s rule)', () => {
  const run = (text) => execFileSync(PYTHON, ['-c', py(text).code], { encoding: 'utf8' }).trim();
  assert.equal(run('set total to 100\ndefine reset\n    set total to 3\nrun reset\nshow total'), '3');
  assert.equal(run('define reset\n    set total to 3\nset total to 100\nrun reset\nshow total'), '100');
  assert.match(py('define reset\n    set total to 3\nset total to 100').code, /^def reset\(\):\n    total = 3/, 'no `global` for a name set only below');
  assert.equal(run('define bump\n    increase score by 1\nset score to 1\nrun bump\nshow score'), '2', 'changing in place means the one outside, wherever it is');
});

test('programs from these sentences do what they say', () => {
  const run = (text, input = '') => execFileSync(PYTHON, ['-c', py(text).code], { encoding: 'utf8', input }).replace(/\r/g, '').trim();
  assert.equal(run('ask "Go on? " and store in answer\nif answer is "yes" or "y"\n    show "going"\notherwise\n    show "stopped"', 'no\n'), 'Go on? stopped');
  assert.equal(run('set words to "a b".split()\nadd "cat" to words\nshow words'), "['a', 'b', 'cat']");
  assert.equal(run('set n to 3\nif n plus 1 is even\n    show "even"\notherwise\n    show "odd"'), 'even');
  assert.equal(run('create list basket\nadd "milk" and "eggs" to basket\nshow basket'), "['milk', 'eggs']");
  assert.equal(run('show length of "a b".split()\nshow first item of "a b c".split()'), '2\na');
  assert.equal(run('set x to 3\nshow "{x}".format(x=5)\nshow "{{}} {}".format(1)'), '5\n{} 1');
  assert.deepEqual(py('show "{x}".format_map({"x": 1})').warnings, [], 'a {name} that .format_map fills in is not a name to set');
});

test('a tool run inside {…} in text runs the tool, not what "length of" gives back', () => {
  const r = L.compileProject({ sections: [{ id: 'main', file: 'main', text: 'define all notes\n    give back ["a", "b"]\nshow "{length of all notes()} notes"' }] }).results.main;
  assert.equal(execFileSync(PYTHON, ['-c', r.text], { encoding: 'utf8' }).trim(), '2 notes');
});

test('a class whose fields are written with kinds (decimal, whole number, text, yes/no) runs', () => {
  const text = 'python: from dataclasses import dataclass\ndecorate with dataclass\ndefine class Account\n    field owner: text\n    field visits: whole number\n    field balance: decimal = 0\n    field open: yes/no = yes\nmake a new Account with "Sam", 2 and store in account\nshow account\nshow Account.__annotations__';
  const r = L.compileProject({ sections: [{ id: 'main', file: 'main', text }] }).results.main;
  assert.deepEqual(JSON.parse(JSON.stringify(r.info.flatMap(i => i.errs.concat(i.warns)))), []);
  // before Python 3.14, the class's annotations are worked out when it is defined: `decimal` there is a NameError
  assert.equal(execFileSync(PYTHON, ['-c', r.text], { encoding: 'utf8' }).replace(/\r/g, '').trim(),
    "Account(owner='Sam', visits=2, balance=0, open=True)\n{'owner': <class 'str'>, 'visits': <class 'int'>, 'balance': <class 'float'>, 'open': <class 'bool'>}");
});

test('tools that change outside values get `global`', () => {
  assert.equal(py('set score to 0\ndefine bump\n    increase score by 1').code, 'score = 0\ndef bump():\n    global score\n    score += 1');
});

test('`global` goes after a tool\'s description, so the description stays its docstring', () => {
  assert.equal(py('set score to 0\ndefine bump\n    description: Adds one.\n    increase score by 1').code, 'score = 0\ndef bump():\n    """Adds one."""\n    global score\n    score += 1');
  assert.equal(py('set score to 0\ndefine bump\n    description: Adds one.\n    description: Never below 0.\n\n    increase score by 1').code, 'score = 0\ndef bump():\n    """Adds one.\n    Never below 0."""\n    global score\n\n    score += 1');
  const r = L.compileProject({ sections: [{ id: 'main', file: 'main', text: 'set score to 0\ndefine bump\n    description: Adds one.\n    increase score by 1\nbump()\nprint(bump.__doc__, score)' }] }).results.main;
  assert.equal(execFileSync(PYTHON, ['-c', r.text], { encoding: 'utf8' }).trim(), 'Adds one. 1');
});

test('an object\'s own list (self.items = [] in a class) gets .append, and Python\'s own errors and kinds are known', () => {
  const r = py('define class Queue\n    define __init__ using self\n        set self.items to []\n    define push using self, item\n        add item to self.items\n        add 1 to self.count');
  assert.deepEqual(r.errors, []);
  assert.match(r.code, /self\.items\.append\(item\)\n        self\.count \+= 1/);
  const e = py('try\n    python: data = open("a.txt").read()\nif it fails with FileNotFoundError\n    set data to bytes(0)');
  assert.deepEqual([...e.errors, ...e.warnings], []);
  const b = py('set body to b""\nadd b"x" to body');
  assert.deepEqual([...b.errors, ...b.warnings], []);
  assert.match(b.code, /body \+= b"x"/);
});

test('names made on exact python: lines (a def\'s inputs, for, with … as, except … as) are known to the sentences under them', () => {
  const r = py('python: def total(prices, tax=0.1):\n    python: s = 0\n    for each p in prices\n        add p to s\n    python: return s * (1 + tax)\npython: for row in []:\n    show row');
  assert.deepEqual([...r.errors, ...r.warnings], []);
  assert.match(r.code, /        s \+= p\n/);
});

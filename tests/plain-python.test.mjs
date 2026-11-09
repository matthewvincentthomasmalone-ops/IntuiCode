// Python said in plain words: each form the reader writes (code -> sentences) comes back to exactly the same
// code (sentences -> code), and the writer reads each form, and the older ones, as it should.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine, toSentences, compareMany } from './helpers/engine.mjs';

const { L } = loadEngine();
const compile = (text) => L.compileProject({ sections: [{ id: 'main', file: 'main', text }] }).results.main;

/* [what, code, sentences it must be said with (each a whole line, indentation aside)] */
const READ = [
  ['imports', 'import os, sys\nimport tkinter as tk\nfrom flask import Blueprint, jsonify, request\nfrom math import *\nfrom . import views\nfrom .models import Task as T\n',
    ['bring in os and sys', 'bring in tkinter as tk', 'bring in Blueprint, jsonify and request from flask', 'bring in everything from math', 'bring in views from this package', 'bring in Task as T from .models']],
  ['a module imported twice is imported once', 'import os, random\nx = random.randint(1, 6)\n', ['bring in os and random', 'set x to random number from 1 to 6']],
  ['objects and results', 'from flask import Flask\nimport sqlite3\napp = Flask(__name__)\nconn = sqlite3.connect("x.db")\nconn.row_factory = sqlite3.Row\n',
    ['set app to a new Flask with __name__', 'set conn to the result of sqlite3.connect with "x.db"', 'set conn.row_factory to sqlite3.Row']],
  ['an object made and not kept', 'class App:\n    pass\nApp()\nApp(1, 2)\n', ['make a new App', 'make a new App with 1 and 2']],
  ['a dictionary lookup that may not be there', 'from flask import request\nimport os\nowner = request.args.get("owner", "")\npage = request.args.get("page")\nkey = os.environ.get("KEY", "dev")\n',
    ['set owner to item "owner" of request.args or "" if there isn\'t one', 'set page to item "page" of request.args if there is one', 'set key to item "KEY" of os.environ or "dev" if there isn\'t one']],
  ['get on something that isn\'t a dictionary is a call', 'import requests\nsession = requests.Session()\nr = session.get("https://example.com")\n', ['set r to the result of session.get with "https://example.com"']],
  ['the environment and files', 'import os\nsecret = os.getenv("SECRET", "dev")\nhome = os.getenv("HOME")\nif not os.path.exists("a.txt"):\n    print("missing")\nok = os.path.exists("b")\n',
    ['set secret to the environment variable "SECRET" or "dev" if there isn\'t one', 'set home to the environment variable "HOME"', 'if there is no file or folder at "a.txt"', 'set ok to there is a file or folder at "b"']],
  ['comprehensions', 'xs = [1, 2, 3]\nys = [x * 2 for x in xs if x > 1]\nzs = {x for x in xs}\nd = {x: x * x for x in xs}\ng = sum(x for x in xs)\nok = all(x > 0 for x in xs)\nsome = any(x > 2 for x in xs)\n',
    ['set ys to a list of x times 2 for each x in xs if x is more than 1', 'set zs to a set of x for each x in xs', 'set d to a dictionary of x: x times x for each x in xs',
      'set g to sum of (x for each x in xs)', 'set ok to x is more than 0 for every x in xs', 'set some to x is more than 2 for any x in xs']],
  ['text tools', 'name = " Sam "\nsep = ", "\nwords = ["a", "b"]\na = name.strip()\nb = name.split()\nc = name.split(",")\nd = sep.join(words)\ne = " ".join(words)\nf = name.replace("S", "P")\ng = name.lower()\nh = name.strip().upper()\n',
    ['set a to name trimmed', 'set b to name split into words', 'set c to name split at ","', 'set d to words joined by sep', 'set e to words joined by " "', 'set f to name with "S" replaced by "P"',
      'set g to name in lowercase', 'set h to (name trimmed) in capitals']],
  ['tests on text', 'w = "ab"\nif w.startswith("a") and not w.endswith("c"):\n    print(w.isalpha(), not w.isdigit(), w.isalnum())\n',
    // (tests shown together are separated by commas: "and" between tests is one yes/no test)
    ['if w starts with "a" and w doesn\'t end with "c"', 'show w is all letters, w is not all digits, w is all letters or digits']],
  ['tests shown together', 'a = 1\nprint(a > 1, a)\nprint(a, "and")\n', ['show a is more than 1, a', 'show a and "and"']],
  ['numbers and order', 'xs = [3, 1]\nn = 7\na = sorted(xs)\nb = sorted(xs, reverse=True)\nc = sorted(xs, key=abs)\nr = round(2.567, 2)\nq = round(n / 2)\nev = n % 2 == 0\nod = n % 2 == 1\nnd = n % 3 == 0\n',
    ['set a to sorted xs', 'set b to xs sorted biggest first', 'set c to xs sorted by abs', 'set r to 2.567 rounded to 2 places', 'set q to (n divided by 2) rounded',
      'set ev to n is even', 'set od to n is odd', 'set nd to n is divisible by 3']],
  ['JSON', 'import json\nwith open("d.json", "w", encoding="utf-8") as f:\n    json.dump({"a": 1}, f, indent=2)\nwith open("d.json") as f:\n    data = json.load(f)\ntext = json.dumps(data)\nback = json.loads(text)\n',
    ['open the file "d.json" for writing with encoding="utf-8" as f', 'save {"a": 1} as JSON in f with indent=2', 'set data to the JSON read from f', 'set text to data as JSON text', 'set back to text read as JSON']],
  ['Flask replies', 'from flask import Flask, jsonify, request\napp = Flask(__name__)\n@app.route("/t", methods=["POST"])\ndef t():\n    data = request.get_json()\n    return jsonify({"ok": True}), 201\n',
    ['set data to the JSON sent with the request', 'give back {"ok": yes} as a JSON reply, 201']],
  ['databases', 'import sqlite3\nconn = sqlite3.connect("x.db")\nconn.execute("CREATE TABLE t (a)")\nconn.execute("INSERT INTO t VALUES (?)", (5,))\nconn.execute("INSERT INTO t VALUES (?, ?)", (1, "b"))\nconn.commit()\n',
    ['run the SQL "CREATE TABLE t (a)" on conn', 'run the SQL "INSERT INTO t VALUES (?)" on conn with the value 5', 'run the SQL "INSERT INTO t VALUES (?, ?)" on conn with the values 1 and "b"', 'save the changes to conn']],
  ['list tools on anything', 'class Box:\n    def __init__(self):\n        self.items = []\n    def use(self, x):\n        self.items.append(x)\n        self.items.insert(0, x)\n        self.items.remove(x)\n        self.items.extend([x])\n        last = self.items.pop()\n        first = self.items.pop(0)\n        self.items.pop()\n        self.items.sort(key=len, reverse=True)\n        self.items.clear()\n        del self.items[0]\n',
    ['when a new Box is made', 'append x to self.items', 'insert x into self.items at position 0', 'take x out of self.items', 'add every item of [x] to self.items', 'set last to the last item taken out of self.items',
      'set first to item 0 taken out of self.items', 'take the last item out of self.items', 'sort self.items by len biggest first', 'empty self.items', 'delete item 0 of self.items']],
  ['a module\'s own tools aren\'t list tools', 'import os\nos.remove("x")\n', ['run os.remove with "x"']],
  ['sets', 'seen = set()\nseen.add(1)\n', ['set seen to an empty set', 'add 1 to the set seen']],
  ['setting up a new object', 'class Account:\n    def __init__(self, owner, balance=0):\n        self.owner = owner\n', ['define class Account', 'when a new Account is made with owner and balance=0']],
  ['window parts', 'import tkinter as tk\nroot = tk.Tk()\ntk.Button(root, text="Add", command=root.quit).pack()\ntk.Label(root, text="Hi").grid(row=0, column=1)\ntk.Entry(root, width=10).pack(padx=5)\n',
    ['set root to a new tk.Tk', 'add a tk.Button saying "Add" to root that runs root.quit', 'add a tk.Label saying "Hi" to root, put in the grid with row=0 and column=1', 'add a tk.Entry to root with width=10, packed with padx=5']],
  ['several values', 'def f(s):\n    a, b = s.split(",")\n    return a, b\nx, y = f("1,2")\n', ['set a, b to s split at ","', 'give back a, b', 'set x, y to the result of f with "1,2"']],
  ['items of a.b and fill-ins with more than a name', 'class C:\n    def __init__(self):\n        self.data = {}\n        self.data["k"] = 1\n        n = 2\n        print(f"{self.data} and {n + 1:>3}")\n',
    ['set item "k" of self.data to 1', 'show "{self.data} and {n plus 1:>3}"']],
  ['comparisons in and / or and in if … otherwise', 'n = 5\nok = n > 1 and n != 3\nlabel = "big" if n > 3 else "small"\nif not n == 2 or n < 0:\n    print(1)\n',
    ['set ok to n is more than 1 and n is not 3', 'set label to "big" if n is more than 3 otherwise "small"', 'if not n is 2 or n is less than 0']],
  ['"x is 1 or 2" stays code', 'n = 1\nif n == 1 or 2:\n    print(n)\n', ['python: if n == 1 or 2:']],
  ['waiting', 'import time\nd = 0.5\ntime.sleep(1)\ntime.sleep(d)\n', ['wait 1 second', 'wait d seconds']],
];

const sents = toSentences(READ.map(r => r[1]));
const made = sents.map(compile);
const checks = compareMany(READ.map((r, i) => [r[1], made[i].text]));
READ.forEach(([what, code, lines], i) => {
  test(`said in plain words, and back exactly: ${what}`, () => {
    const said = sents[i].split('\n').map(l => l.trim());
    for (const l of lines) assert.ok(said.includes(l), `"${l}" isn't one of the sentences:\n${sents[i]}`);
    assert.deepEqual(JSON.parse(JSON.stringify(made[i].info.flatMap(x => x.errs))), [], sents[i]);
    assert.ok(checks[i].same, `${JSON.stringify(checks[i])}\n${sents[i]}\n---\n${made[i].text}`);
  });
});

/* [sentences, the code they make] — written by hand, including the forms that were there before */
const WRITE = [
  ['bring in random\nbring in sqrt as root from math\nbring in everything from os.path', 'import random\nfrom math import sqrt as root\nfrom os.path import *'],
  // what was said before still works
  ['define double using n\n    give back n times 2\nrun double with 21 and store in answer\nimport json\nuse random', 'def double(n):\n    return n * 2\nanswer = double(21)\nimport json\nimport random'],
  ['define class P\n    do nothing\nmake a new P and store in p\nmake a new P', 'class P:\n    pass\np = P()\nP()'],
  ['set x to the result of len with "ab"\nset y to a new dict', 'x = len("ab")\ny = dict()'],
  // "append" is always .append, whatever the name holds
  ['set total to 0\nappend 5 to total\nadd 5 to total', 'total = 0\ntotal.append(5)\ntotal += 5'],
  ['create dictionary d\nset v to item "a" of d or 0 if there isn\'t one\nset w to item "a" of d if there is one\nset z to item "a" of d', 'd = {}\nv = d.get("a", 0)\nw = d.get("a")\nz = d["a"]'],
  ['set e to the environment variable "HOME"\nif there is a file or folder at "x"\n    show e', 'import os\n\ne = os.getenv("HOME")\nif os.path.exists("x"):\n    print(e)'],
  ['create list xs with 1, 2\nset ys to a list of x plus 1 for each x in xs\nset g to (x for each x in xs)\nset all big to x is more than 1 for every x in xs',
    'xs = [1, 2]\nys = [x + 1 for x in xs]\ng = (x for x in xs)\nall_big = all(x > 1 for x in xs)'],
  ['set s to " a b "\nset t to (s trimmed split into words) joined by "-"', 's = " a b "\nt = "-".join((s.strip().split()))'],
  ['define class Point\n    when a new Point is made with x, y=0\n        set self.x to x\nset p to a new Point with 1', 'class Point:\n    def __init__(self, x, y=0):\n        self.x = x\np = Point(1)'],
  ['set a, b to [1, 2]\nset a, b to (b, a)', 'a, b = [1, 2]\na, b = (b, a)'],
  ['set seen to an empty set\nadd 1 to the set seen', 'seen = set()\nseen.add(1)'],
  ['bring in tkinter as tk\nset root to a new tk.Tk\nadd a tk.Button saying "Go" to root that runs root.quit, packed with pady=5', 'import tkinter as tk\nroot = tk.Tk()\ntk.Button(root, text="Go", command=root.quit).pack(pady=5)'],
  ['bring in sqlite3\nset conn to the result of sqlite3.connect with "x.db"\nrun the SQL "DELETE FROM t WHERE id = ?" on conn with the value 3\nsave the changes to conn',
    'import sqlite3\nconn = sqlite3.connect("x.db")\nconn.execute("DELETE FROM t WHERE id = ?", (3,))\nconn.commit()'],
  ['open the file "o.txt" for writing as f\n    write "hi" into f\n    save [1] as JSON in f', 'import json\n\nwith open("o.txt", "w") as f:\n    f.write("hi")\n    json.dump([1], f)'],
];
for (const [said, code] of WRITE) {
  test(`the writer reads: ${said.split('\n').pop()}`, () => {
    const r = compile(said);
    assert.deepEqual(JSON.parse(JSON.stringify(r.info.flatMap(x => x.errs))), []);
    assert.equal(r.text.replace(/\n$/, ''), code);
  });
}

test('"when a new X is made" belongs in that class', () => {
  const errs = (t) => JSON.parse(JSON.stringify(compile(t).info.flatMap(x => x.errs)));
  assert.match(errs('when a new Point is made with x\n    set self.x to x').join(' '), /goes right inside "define class Point"/);
  assert.match(errs('define class Dot\n    when a new Point is made\n        do nothing').join(' '), /inside the class `Dot`/);
});

test('Python\'s own tools are found by their exact spelling (max is never MAX)', () => {
  const r = compile('set MAX to 10\nset ALL to 1\nset top to max(3, MAX)\nset ok to all([1])');
  assert.equal(r.text.replace(/\n$/, ''), 'MAX = 10\nALL = 1\ntop = max(3, MAX)\nok = all([1])');
});

test('a name after a dot is a name: ast.Not, obj.none', () => {
  const r = compile('python: import ast\npython: obj = ast\nset k to ast.Not\nset m to obj.none');
  assert.equal(r.text.replace(/\n$/, ''), 'import ast\nobj = ast\nk = ast.Not\nm = obj.none');
});

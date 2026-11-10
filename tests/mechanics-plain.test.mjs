// Mechanics (JavaScript) in plain words: values, the page, lists and text, the server, decisions, classes.
// Each form is checked both ways: the sentences write the code, and the code reads back as those sentences,
// exactly, with no js: lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConverter } from './helpers/engine.mjs';

const { convert, WEB, C, W } = await loadConverter();
const plain = (x) => JSON.parse(JSON.stringify(x));
const shared = (ids) => ({ ids: Object.fromEntries(Object.entries(ids).map(([k, t]) => [k, { tag: t }])), groups: {}, cssGroups: {}, addGroups: {} });
/* Sentences -> JavaScript, and their problems */
const js = (text, ids = {}) => { const r = WEB.compileJs({ id: 'x', file: 'x', text }, shared(ids)); return { text: r.text, errs: plain(r.info.flatMap(i => i.errs)) }; };
/* JavaScript -> sentences: exact, and every line a sentence */
function reads(code, said, ids = {}) {
  const r = convert('js', code, { ids });
  assert.equal(r.exact, true, `${r.reason}\n${r.text}`);
  assert.equal(r.text.replace(/\n$/, ''), said);
  assert.equal(r.kept, 0, r.text);
}
/* Both ways */
function both(said, code, ids = {}) {
  const w = js(said, ids);
  assert.deepEqual(w.errs, [], said);
  assert.equal(w.text, code);
  reads(code, said, ids);
}
const same = (a, b) => C.check('js', a, b, { parse: W.parse }).same;

test('mechanics: calls and new objects as values, records in words', () => {
  both('define totals using items\n    give back { count: length of items, sum: 0 }\nconstant t is the result of totals with [1, 2]\nconstant d is a new Date\nconstant m is a new Map with [[1, 2]]\nshow "Menu has", the result of totals with t, "items"\nshow (the result of totals with t, 2), t',
    'function totals(items) {\n  return { count: items.length, sum: 0 };\n}\nconst t = totals([1, 2]);\nconst d = new Date();\nconst m = new Map([[1, 2]]);\nconsole.log("Menu has", totals(t), "items");\nconsole.log(totals(t, 2), t);\n');
  // inside a sum the result goes in brackets
  both('define f using n\n    give back n\nset x to (the result of f with 2) plus 1', 'function f(n) {\n  return n;\n}\nlet x = f(2) + 1;\n');
  // a tool's inputs can have a value for when they are left out
  both('define addItem using items, quantity = 1\n    give back items', 'function addItem(items, quantity = 1) {\n  return items;\n}\n');
});

test('mechanics: "a if c otherwise b", null, nothing and an empty list', () => {
  both('set saved to the text saved in the browser as "k"\nset items to saved read as JSON if saved otherwise an empty list\nif saved is null\n    show "none"\nif items is not nothing\n    show items as JSON text',
    'let saved = localStorage.getItem("k");\nlet items = saved ? JSON.parse(saved) : [];\nif (saved === null) {\n  console.log("none");\n}\nif (items != null) {\n  console.log(JSON.stringify(items));\n}\n');
  both('set n to 3\nset size to "big" if n is greater than 2 otherwise "small" if n is greater than 1 otherwise "tiny"', 'let n = 3;\nlet size = n > 2 ? "big" : n > 1 ? "small" : "tiny";\n');
});

test('mechanics: elements found as the code runs, new ones, their text, value, HTML and groups', () => {
  both('constant list is the element called "basket"\nmake a new list item and store in li\nconstant tag is a new "dialog" element\nset the text of li to "Tea"\nset the groups of li to "item new"\nput li at the end of list\nset the HTML of list to ""\nconstant box is the element matching "input"\nset the value of box to ""\nset the page title to "Basket"\nwhen the element called "add" is clicked\n    tick the element called "gift"\nwhen the page is clicked, with the event as e\n    show e.target',
    'const list = document.getElementById("basket");\nconst li = document.createElement("li");\nconst tag = document.createElement("dialog");\nli.textContent = "Tea";\nli.className = "item new";\nlist.appendChild(li);\nlist.innerHTML = "";\nconst box = document.querySelector("input");\nbox.value = "";\ndocument.title = "Basket";\ndocument.getElementById("add").addEventListener("click", () => {\n  document.getElementById("gift").checked = true;\n});\ndocument.addEventListener("click", (e) => {\n  console.log(e.target);\n});\n');
  // single quotes read the same way (the check counts 'add' and "add" as the same text)
  reads("const list = document.getElementById('basket');\nlist.textContent = '';\ndocument.getElementById('add').addEventListener('click', () => {\n  list.textContent = 'x';\n});\n",
    "constant list is the element called 'basket'\nset the text of list to ''\nwhen the element called 'add' is clicked\n    set the text of list to 'x'");
  // a page element's own name still comes first
  both('set the HTML of menu to "<li>Rye</li>"\nset the groups of menu to "open"', 'document.getElementById("menu").innerHTML = "<li>Rye</li>";\ndocument.getElementById("menu").className = "open";\n', { menu: 'ul' });
});

test('mechanics: lists made from lists (.map, .filter, .find, .every, .some), joined, and their length', () => {
  both('set rows to [1, 2, 3]\nconstant doubled is a list of r times 2 for each r in rows\nconstant big is a list of r for each r in rows if r is greater than 1\nconstant labels is a list of "#{r}" for each r in rows if r is greater than 1\nconstant found is the first r in rows where r is 2\nconstant allBig is r is greater than 0 for every r in rows\nconstant anyThree is r is 3 for any r in rows\nconstant line is doubled joined by ", "\nconstant count is length of (a list of r for each r in rows if r is 1)',
    'let rows = [1, 2, 3];\nconst doubled = rows.map(r => r * 2);\nconst big = rows.filter(r => r > 1);\nconst labels = rows.filter(r => r > 1).map(r => `#${r}`);\nconst found = rows.find(r => r === 2);\nconst allBig = rows.every(r => r > 0);\nconst anyThree = rows.some(r => r === 3);\nconst line = doubled.join(", ");\nconst count = (rows.filter(r => r === 1)).length;\n');
  // (r) => … reads the same as r => …, and the items of a list by their place
  reads('const rows = [1, 2];\nconst t = rows.filter((r) => r > 1).length;\nconst a = rows[0];\nconst b = rows[rows.length - 1];\nconst c = rows[a + 1];\n',
    'constant rows is [1, 2]\nconstant t is length of (a list of r for each r in rows if r is greater than 1)\nconstant a is first item of rows\nconstant b is last item of rows\nconstant c is item (a plus 1) of rows');
});

test('mechanics: text and numbers: trimmed, split at, capitals, contains, decimal places, rounded, JSON', () => {
  both('set name to " Ada "\nconstant clean is name trimmed\nconstant parts is clean split at ","\nconstant loud is clean in capitals\nconstant price is 2.5\nconstant shown is price to 2 decimal places\nconstant low is price rounded down\nconstant near is (price times 3) rounded\nif clean contains "A"\n    show loud',
    'let name = " Ada ";\nconst clean = name.trim();\nconst parts = clean.split(",");\nconst loud = clean.toUpperCase();\nconst price = 2.5;\nconst shown = price.toFixed(2);\nconst low = Math.floor(price);\nconst near = Math.round(price * 3);\nif (clean.includes("A")) {\n  console.log(loud);\n}\n');
  both('define load\n    try\n        give back (the text saved in the browser as "k") read as JSON\n    if it fails as problem\n        show problem.message\n        give back an empty list\n    in any case\n        show "done"',
    'function load() {\n  try {\n    return JSON.parse(localStorage.getItem("k"));\n  } catch (problem) {\n    console.log(problem.message);\n    return [];\n  } finally {\n    console.log("done");\n  }\n}\n');
  // after a sum, the words could go with the last value or all of it: an error, never a guess
  assert.match(js('set a to 1\nset b to a plus a to 2 decimal places').errs[0], /could go with just `a` or with all of it/);
});

test('mechanics: the server\'s reply, its JSON, sending, and waiting for a call', () => {
  both('define load\n    constant reply is the reply from "/api/tasks"\n    constant tasks is the JSON read from reply\n    send { done: true } to "/api/tasks/1"\n    wait for navigator.clipboard.writeText with "copied"\n    give back tasks',
    'async function load() {\n  const reply = await fetch("/api/tasks");\n  const tasks = await reply.json();\n  await fetch("/api/tasks/1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) });\n  await navigator.clipboard.writeText("copied");\n  return tasks;\n}\n');
  // a comma after the last part changes nothing, so a fetch written over several lines is still "send"
  reads('const API = "/api";\nasync function add(title) {\n  await fetch(API, {\n    method: "POST",\n    headers: { "Content-Type": "application/json" },\n    body: JSON.stringify({ title }),\n  });\n}\n', 'constant API is "/api"\ndefine add using title\n    send { title } to API');
});

test('mechanics: "depending on" (switch) and "do this, then repeat while"', () => {
  both('set n to 2\ndepending on n\n    when it is 1 or 2\n        show "small"\n    when it is 3\n        show "three"\n        go on into the next case\n    otherwise\n        show "big"\ndo this, then repeat while n is greater than 0\n    decrease n',
    'let n = 2;\nswitch (n) {\n  case 1:\n  case 2:\n    console.log("small");\n    break;\n  case 3:\n    console.log("three");\n  default:\n    console.log("big");\n    break;\n}\ndo {\n  n--;\n} while (n > 0);\n');
  // a break that isn't a case's last step ends the case, not a loop: it stays code
  const r = convert('js', 'let n = 1;\nwhile (n < 3) {\n  switch (n) {\n    case 1:\n      if (n) break;\n      n++;\n      break;\n  }\n  n++;\n}\n');
  assert.equal(r.exact, true, r.reason);
  assert.match(r.text, /^        when it is 1\n            if n\n                js: break;\n            increase n$/m);
  assert.match(js('set n to 1\nwhile n is less than 3\n    depending on n\n        when it is 1\n            stop the loop').errs[0], /only ends the case/);
});

test('mechanics: classes and bringing in other files\' tools', () => {
  both('bring in fetchSales and saveSales from "./api.js"\ndefine class Store\n    when a new Store is made with key, size = 10\n        set this.key to key\n    define load\n        give back the result of fetchSales with this.key\nconstant store is a new Store with "sales"\ndefine class Shop based on Store',
    'import { fetchSales, saveSales } from "./api.js";\nclass Store {\n  constructor(key, size = 10) {\n    this.key = key;\n  }\n  load() {\n    return fetchSales(this.key);\n  }\n}\nconst store = new Store("sales");\nclass Shop extends Store {\n}\n');
  // only parts of a class go inside it
  assert.match(js('define class A\n    show 1').errs[0], /each part is "when a new … is made" or "define …"/);
  assert.match(js('when a new A is made\n    show 1').errs[0], /goes right inside "define class A"/);
});

test('templates: the new Mechanics templates, filled in with their own words, have no problems', () => {
  const NEW = /the result of|a new ‹Date›| if ‹test› otherwise|^depending on|^when it is|^do this|class|^bring in|a list of|the first ‹x›|for every|joined by|decimal places|read as JSON|element called|"‹li›" element|at the end of|the HTML of|the groups of|page title to|the reply from|^wait for ‹navigator|saved in the browser as/;
  const fill = (p) => p.replace(/‹([^›]*)›/g, '$1');
  let n = 0;
  for (const t of WEB.TEMPLATES.filter(t => t.sections.includes('mechanics') && NEW.test(t.pattern))) {
    let line = fill(t.pattern);
    if (/^when it is/.test(line)) line = `depending on 1\n    ${line}\n        show 1`;
    else if (/^when a new/.test(line)) line = `define class Store\n    ${line}\n        set this.key to key`;
    else if (/^depending on/.test(line)) line = `set value to 1\n${line}\n    otherwise\n        show 1`;
    else if (/^do this/.test(line)) line = `set test to yes\n${line}\n    show 1`;
    else if (/^wait for/.test(line)) line = `define go using text\n    ${line}`;
    const r = js(`${/^constant item\b/.test(line) ? '' : 'constant item is a new "li" element\n'}constant list is the element called "items"\nset price to 1\nset text to "[]"\n${line}`, { name: 'div' });
    assert.deepEqual(r.errs, [], `${t.pattern}\n${line}`);
    n++;
  }
  assert.ok(n >= 20, `only ${n} templates checked`);
});

test('checker: quotes, a last comma, (x) =>, and the break ending a switch change nothing; holes and other breaks do', () => {
  for (const [a, b] of [["f('a');", 'f("a");'], ['const o = { a: 1, };', 'const o = { a: 1 };'], ['f(a, b,);', 'f(a, b);'], ['let a = [1, 2,];', 'let a = [1, 2];'],
    ['xs.map((x) => x + 1);', 'xs.map(x => x + 1);'], ['switch (n) { case 1: f(); break; default: g(); break; }', 'switch (n) { case 1: f(); break; default: g(); }']]) {
    assert.equal(same(a, b), true, `${a}  ~  ${b}`);
    assert.equal(same(b, a), true, `${b}  ~  ${a}`);
  }
  for (const [a, b] of [["f('it\\'s');", 'f("it\'s");'], ['let a = [1, ,];', 'let a = [1,];'], ['let a = [,];', 'let a = [];'], ['f("a b");', "f('a  b');"],
    ['switch (n) { case 1: f(); break; default: g(); }', 'switch (n) { case 1: f(); default: g(); }'], ['xs.map((x, y) => x);', 'xs.map(x => x);']]) {
    assert.equal(same(a, b), false, `${a}  !~  ${b}`);
    assert.equal(same(b, a), false, `${b}  !~  ${a}`);
  }
});

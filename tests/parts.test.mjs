// Parts (lang/parts.js): every file split into parts, each Interface & Display, Backend & Mechanics,
// Setup & Settings or Data & Notes, for code and sentences alike.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/engine.mjs';

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'lang/parts.js'), 'utf8'), ctx, { filename: 'lang/parts.js' });
const P = ctx.IntuiParts;
const plain = (x) => JSON.parse(JSON.stringify(x));   // (arrays from the engine's context, as this one's)
const brief = (parts) => plain(parts.map(p => [p.from, p.to, p.type, p.title]));
const exact = (prefix, lines) => lines.map(l => (l ? prefix + l : '')).join('\n');

test('four types, in order, each with a name and what it is for', () => {
  assert.deepEqual(plain(P.TYPES.map(t => t.id)), ['display', 'mechanics', 'setup', 'data']);
  for (const t of P.TYPES) assert.ok(t.name && t.short && t.about);
  assert.equal(P.typeOf('nope').id, 'mechanics');
});

test('an Arduino sketch in sentences: settings, the start, and a loop that lights an LED', () => {
  const text = 'set led to LED_BUILTIN\nset blinks to 0\n\nwhen the board starts\n    make pin led an output\n    start the serial monitor at 9600\n\nover and over\n    turn pin led on\n    wait 500 milliseconds\n    turn pin led off\n    wait 500 milliseconds\n    increase blinks\n    show "Blinks so far: {blinks}"\n';
  const parts = P.split('arduino', text, 'sketch.ino');
  assert.deepEqual(brief(parts), [[0, 1, 'setup', 'Settings'], [3, 5, 'setup', 'when the board starts'], [7, 13, 'display', 'over and over']]);
  const loop = parts[2];
  assert.ok(P.involves(loop).has('mechanics'), 'the waits and the count are mechanics');
  assert.equal(loop.lines[1], 'display');   // turn pin led on
  assert.equal(loop.lines[2], 'mechanics'); // wait 500 milliseconds
});

test('imported JavaScript (all exact lines) is read as code, by its brackets', () => {
  const text = exact('js: ', ['const list = document.querySelector("#list");', 'let tasks = JSON.parse(localStorage.getItem("tasks") || "[]");', '', 'function save() {', '  localStorage.setItem("tasks", JSON.stringify(tasks));', '}', '', 'function render() {', '  list.innerHTML = "";', '  for (const t of tasks) {', '    const li = document.createElement("li");', '    li.textContent = t.title;', '    list.appendChild(li);', '  }', '}']);
  const parts = P.split('js', text, 'script.js');
  const byTitle = Object.fromEntries(parts.map(p => [p.title, p]));
  assert.equal(byTitle.save.type, 'mechanics');
  assert.deepEqual([byTitle.save.from, byTitle.save.to], [3, 5]);
  assert.equal(byTitle.render.type, 'display');
  assert.deepEqual([byTitle.render.from, byTitle.render.to], [7, 14]);
});

test('Python: imports and constants are setup, a tkinter window is display, a dice roll is mechanics', () => {
  const text = exact('python: ', ['import random', 'import tkinter as tk', '', 'WIDTH = 400', '', 'def roll(sides):', '    return random.randint(1, sides)', '', 'root = tk.Tk()', 'label = tk.Label(root)', 'label.pack()', 'root.mainloop()']);
  const parts = P.split('python', text, 'main.py');
  assert.deepEqual(brief(parts), [[0, 3, 'setup', 'Imports'], [5, 6, 'mechanics', 'roll'], [8, 11, 'display', 'root = tk.Tk() …']]);
});

test('CSS is all display; HTML is display apart from its head', () => {
  assert.ok(P.split('css', '.card {\n  color: red;\n}\n\n@media (max-width: 600px) {\n  .card { padding: 4px; }\n}\n').every(p => p.type === 'display'));
  const html = P.split('html', 'page title is "Tasks"\nadd a heading saying "Tasks"\nadd a box called list\n    add a paragraph saying "Nothing yet"\n');
  assert.equal(html.find(p => p.title === 'add a box called list').type, 'display');
  assert.equal(html.find(p => p.title.startsWith('add a heading')).type, 'display');
  assert.equal(html.find(p => p.title.startsWith('page title')).type, 'setup');
});

test('a React component that returns markup is display; a helper beside it is mechanics', () => {
  const parts = P.split('tsx', 'import React from "react";\n\nexport function Board({ cells }) {\n  return (\n    <div className="board">{cells.map(c => <Cell key={c.id} {...c} />)}</div>\n  );\n}\n\nexport function score(cells) {\n  return cells.filter(c => c.hit).length;\n}\n', 'src/Board.tsx');
  assert.deepEqual(plain(parts.map(p => [p.title, p.type])), [['import React from "react";', 'setup'], ['Board', 'display'], ['score', 'mechanics']]);
});

test('settings and notes files are one part each, of their own type', () => {
  assert.deepEqual(brief(P.split('json', '{\n  "name": "x"\n}\n', 'package.json')), [[0, 2, 'setup', 'package.json']]);
  assert.deepEqual(brief(P.split('markdown', '# Read me\n\nHow to run it.\n', 'README.md')), [[0, 2, 'data', 'Read me']]);
  assert.deepEqual(plain(P.split('csv', '\n\n')), []);
});

test('lineTypes: each line of the file, blank lines none', () => {
  const parts = P.split('python', 'set score to 0\n\nrepeat 3 times\n    add 1 to score\nshow "Score: {score}"\n');
  assert.deepEqual(plain(P.lineTypes(parts, 6)), ['setup', null, 'mechanics', 'mechanics', 'display', null]);
});

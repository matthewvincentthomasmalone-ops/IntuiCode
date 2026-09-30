// The project builder: the library reads cleanly, every question leads somewhere, every kit builds, walk steps
// compile with no problems and run, hallway steps only ask for their blanks, and horizon steps point the way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, statSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, PYTHON, loadEngine } from './helpers/engine.mjs';

const { L, WEB, CPP } = loadEngine();
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'lang/builder.js'), 'utf8'), ctx, { filename: 'lang/builder.js' });
const B = ctx.IntuiBuilder;
const lib = B.library;
const plain = (x) => JSON.parse(JSON.stringify(x));

const FILL_IN = /^Fill in the ‹[^›]*› slot\.$/;
const SLOT = /‹[^›]*›/g;
const SECTIONS = { script: ['main'], structured: ['settings', 'tools', 'main'], website: ['structure', 'styling', 'mechanics'], arduino: ['settings', 'start', 'loop'] };
// Steps that only work together with another step (their summaries say so).
const NEEDS = { 'saas/admin': ['server'] };
// What a person might type into each blank.
const FILLS = {
  '‹a cutoff frequency in Hz, like 1000›': '1000',
  '‹b1 is twice b0›': 'b0 * 2',
  '‹a1 is -2 times the cosine of w0: in Python, -2 * math.cos(w0)›': '-2 * math.cos(w0)',
  "‹this track's sample at position i, times its gain: tracks[t][i] * gains[t]›": 'tracks[t][i] * gains[t]',
  '‹the first item of chosen›': 'first item of chosen',
  '‹where it goes: the same position›': 'position',
  [`‹a line of HTML in quotes, like "<h1>My notes</h1><p>They're at <a href='/api/notes'>/api/notes</a></p>"›`]: `"<h1>My notes</h1><p>They're at <a href='/api/notes'>/api/notes</a></p>"`,
  "‹the notes turned into JSON, with Flask's jsonify: jsonify(notes)›": 'jsonify(notes)',
  '‹the status code that means "you sent something wrong": 400›': '400',
  '‹the key this page expects, as bytes: expected.encode()›': 'expected.encode()',
  '‹the status code for "forbidden": 403›': '403',
  '‹any of the three is missing: name is empty text or email is empty text or …›': 'name is empty text or email is empty text or message is empty text',
  '‹the name they typed›': 'name',
  '‹how long a reading must hold still, in milliseconds: 50 is usual›': '50',
  '‹what a pressed button reads, with the pull-up: HIGH or LOW›': 'LOW',
};

const kits = Object.values(lib.kits);
const comp = (id) => lib.components[id];
const idsWhere = (kit, keep) => kit.steps.filter(s => keep(s, comp(s.id))).map(s => s.id);
const build = (kitId, ids) => B.build(lib, kitId, ids, 'test-project', ['Test']);

function compile(project) {
  if (project.kind === 'website') return WEB.compileWebsite(project);
  if (project.kind === 'arduino') return CPP.compileCppProject(project);
  return L.compileProject(project);
}
/* Every error and warning, with where it is and the sentence behind it. */
function problems(project) {
  const res = compile(project).results;
  const errs = [], warns = [];
  for (const s of project.sections) {
    const lines = s.text.split('\n');
    res[s.id].info.forEach((inf, i) => {
      for (const e of inf.errs) errs.push({ msg: e, at: `${s.id} line ${i + 1}: ${lines[i]}` });
      for (const w of inf.warns) warns.push({ msg: w, at: `${s.id} line ${i + 1}: ${lines[i]}` });
    });
  }
  return { errs: plain(errs), warns: plain(warns) };
}
const describe = (list) => list.map(p => `${p.msg}  (${p.at})`);
/* The project with every blank answered. */
function filled(project) {
  for (const s of project.sections) for (const [k, v] of Object.entries(FILLS)) s.text = s.text.split(k).join(v);
  return project;
}
const tempDir = (name) => mkdtempSync(path.join(os.tmpdir(), `intuicode-${name}-`));
function runPython(dir, args, input = '') {
  const r = spawnSync(PYTHON, args, { cwd: dir, input, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  return { ...r, stdout: (r.stdout || '').replace(/\r\n/g, '\n') };   // Python on Windows ends lines with \r\n
}
function writePython(project, dir) {
  const res = compile(project).results;
  for (const s of project.sections) writeFileSync(path.join(dir, s.file + '.py'), res[s.id].text);
}

/* ------------------------------------------------------------------ */
/* The library                                                          */
/* ------------------------------------------------------------------ */

test('the library reads without problems', () => {
  assert.deepEqual(plain(lib.problems), []);
  assert.ok(lib.questions.start, 'the first question is "start"');
});

test('every question leads to a real question or kit, with real ticked steps, and every kit can be reached', () => {
  const seen = new Set(['start']), kitsReached = new Set(), queue = ['start'];
  while (queue.length) {
    const q = lib.questions[queue.shift()];
    assert.ok(q.ask, `question "${q.id}" asks something`);
    assert.ok(q.options.length >= 2, `question "${q.id}" has choices`);
    for (const o of q.options) {
      assert.ok(o.label && o.means, `an option of "${q.id}" has a label and a meaning`);
      assert.ok(!!o.kit !== !!o.next, `"${o.label}" leads to one question or one kit`);
      if (o.next) {
        assert.ok(lib.questions[o.next], `"${o.label}" leads to the question "${o.next}"`);
        if (!seen.has(o.next)) { seen.add(o.next); queue.push(o.next); }
      } else {
        const kit = lib.kits[o.kit];
        assert.ok(kit, `"${o.label}" leads to the kit "${o.kit}"`);
        kitsReached.add(o.kit);
        for (const id of o.ticked || []) assert.ok(kit.steps.some(s => s.id === id), `"${o.label}" ticks "${id}", a step of ${o.kit}`);
      }
    }
  }
  assert.deepEqual(Object.keys(lib.questions).filter(q => !seen.has(q)), [], 'questions no answer leads to');
  assert.deepEqual(kits.map(k => k.id).filter(k => !kitsReached.has(k)), [], 'kits no answer leads to');
});

test('every component is described honestly for its depth', () => {
  const used = new Set(kits.flatMap(k => k.steps.map(s => s.id)));
  for (const c of Object.values(lib.components)) {
    const where = `component "${c.id}"`;
    assert.match(c.id, /^[\w-]{1,40}$/, where);
    assert.ok(c.name && c.name.length <= 120, `${where} has a name`);
    assert.ok(c.summary.length > 80 && c.summary.length <= 3000, `${where} has a summary of its role`);
    assert.ok(c.learn, `${where} says what to learn`);
    assert.ok(used.has(c.id), `${where} is in a kit`);
    const text = Object.values(c.sections).flat().join('\n');
    if (c.depth === 'horizon') {
      assert.ok(c.usual, `${where} says what people usually use`);
      assert.deepEqual(Object.keys(c.sections), [], `${where} (horizon) has no sentences`);
    } else {
      assert.ok(text.trim(), `${where} (${c.depth}) has sentences`);
      assert.equal(!!text.match(SLOT), c.depth === 'hallway', `${where}: hallway steps have ‹blanks›, walk steps don't`);
    }
    for (const slot of text.match(SLOT) || []) assert.ok(slot in FILLS, `${where}: this test knows an answer for ${slot}`);
  }
});

/* ------------------------------------------------------------------ */
/* Every kit                                                            */
/* ------------------------------------------------------------------ */

for (const kit of kits) {
  const all = kit.steps.map(s => s.id);
  const ticked = idsWhere(kit, s => s.ticked);
  const walk = idsWhere(kit, (s, c) => c.depth === 'walk');
  const walkAndHallway = idsWhere(kit, (s, c) => c.depth !== 'horizon');

  test(`${kit.id}: always steps are walk steps, and every step's sentences fit the ${kit.layout} layout`, () => {
    assert.ok(SECTIONS[kit.layout], `layout ${kit.layout}`);
    assert.ok(kit.title && kit.about, 'a title and an about line');
    for (const s of kit.steps) {
      if (s.always) assert.equal(comp(s.id).depth, 'walk', `${s.id} is always in, so it must be walkable`);
      for (const sec of Object.keys(comp(s.id).sections)) assert.ok(SECTIONS[kit.layout].includes(sec), `${s.id} has "== ${sec}"`);
    }
  });

  test(`${kit.id}: builds with all its steps, and with its ticked steps (only blanks to fill in)`, () => {
    for (const ids of [all, ticked]) {
      const { errs, warns } = problems(build(kit.id, ids).project);
      assert.deepEqual(describe(errs.filter(e => !FILL_IN.test(e.msg))), []);
      assert.deepEqual(describe(warns), []);
    }
  });

  test(`${kit.id}: walk steps alone build with zero problems, and so do the always steps alone`, () => {
    for (const ids of [walk, []]) {
      const { errs, warns } = problems(build(kit.id, ids).project);
      assert.deepEqual(describe([...errs, ...warns]), []);
    }
  });

  test(`${kit.id}: hallway steps add only "Fill in the ‹…› slot." problems, and sensible answers leave none`, () => {
    const { project } = build(kit.id, walkAndHallway);
    const slots = project.sections.flatMap(s => s.text.match(SLOT) || []);
    const { errs, warns } = problems(project);
    assert.deepEqual(describe(errs.filter(e => !FILL_IN.test(e.msg))), []);
    assert.deepEqual(describe(warns), []);
    assert.equal(errs.length, slots.length, 'one "Fill in" for each blank');
    const after = problems(filled(project));
    assert.deepEqual(describe([...after.errs, ...after.warns]), []);
  });

  test(`${kit.id}: each optional step works on top of the always steps`, () => {
    for (const s of kit.steps.filter(s => !s.always)) {
      const ids = [s.id, ...(NEEDS[`${kit.id}/${s.id}`] || [])];
      const { errs, warns } = problems(build(kit.id, ids).project);
      assert.deepEqual(describe([...errs.filter(e => !FILL_IN.test(e.msg)), ...warns]), [], s.id);
    }
  });

  test(`${kit.id}: the plan numbers the steps in kit order, and every walk and hallway step's note is found`, () => {
    const { project, plan } = build(kit.id, all);
    assert.equal(plan.title, kit.title);
    assert.deepEqual(plain(plan.path), ['Test']);
    assert.deepEqual(plan.steps.map(s => s.id), all);
    assert.deepEqual(plan.steps.map(s => s.n), all.map((_, i) => i + 1));
    assert.deepEqual(plain(project.sections.map(s => s.file)), kit.layout === 'arduino' ? ['sketch'] : SECTIONS[kit.layout]);
    for (const step of plan.steps) {
      const found = project.sections.filter(s => B.stepLine(s.text, step) >= 0);
      if (step.depth === 'horizon') assert.equal(found.length, 0, `${step.id} (horizon) has no sentences`);
      else assert.ok(found.length > 0, `${step.id}: its "── Step ${step.n} ·" note`);
      assert.equal(step.summary, comp(step.id).summary);
    }
  });

  if (kit.layout === 'website') {
    test(`${kit.id}: the page's Mechanics is valid JavaScript`, () => {
      const js = compile(build(kit.id, all).project).results.mechanics.text;
      assert.doesNotThrow(() => new vm.Script(js), js);
    });

    test(`${kit.id}: with all steps, the ticked steps or any answer's steps, every #link finds its part of the page`, () => {
      const answers = Object.values(lib.questions).flatMap(q => q.options).filter(o => o.kit === kit.id && o.ticked);
      for (const ids of [all, ticked, ...answers.map(o => o.ticked)]) {
        const html = compile(build(kit.id, ids).project).results.structure.text;
        const names = new Set([...html.matchAll(/ id="([\w-]+)"/g)].map(m => m[1]));
        const missing = [...html.matchAll(/ href="#([\w-]+)"/g)].map(m => m[1]).filter(n => !names.has(n));
        assert.deepEqual(missing, [], `steps: ${ids.join(', ')}`);
      }
    });
  }
}

test('an Arduino kit with nothing but its always steps still makes a whole sketch', () => {
  const { project } = build('gadget', []);
  assert.match(project.sections[0].text, /\nover and over\n {4}note: /);
  const r = compile(project).results.sketch;
  assert.deepEqual(plain(r.info.flatMap(i => [...i.errs, ...i.warns])), []);
  assert.match(r.text, /void setup\(\) \{[\s\S]*void loop\(\) \{/);
});

/* ------------------------------------------------------------------ */
/* Running what the kits make                                            */
/* ------------------------------------------------------------------ */

test('the DAW project, with its blanks filled, runs with Python and writes output.wav', () => {
  const project = filled(build('daw', lib.kits.daw.steps.map(s => s.id)).project);
  const dir = tempDir('daw');
  try {
    writePython(project, dir);
    writeFileSync(path.join(dir, 'winsound.py'), 'SND_FILENAME = 0\ndef PlaySound(path, flags):\n    print("(would play " + path + ")")\n');
    const r = runPython(dir, ['main.py']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Peak -?\d+\.\d dB, RMS -?\d+\.\d dB/);
    assert.match(r.stdout, /Saved output\.wav: 88200 samples\./);
    assert.ok(existsSync(path.join(dir, 'output.wav')) && statSync(path.join(dir, 'output.wav')).size > 88200 * 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the terminal tool runs: it checks what is typed, adds, lists, reports, removes and saves', () => {
  const project = build('terminal', lib.kits.terminal.steps.map(s => s.id)).project;
  const dir = tempDir('terminal');
  try {
    writePython(project, dir);
    const typed = ['help', 'add', 'Coffee', '3.5', 'add', '', 'Tea', 'abc', '-1', '2', 'list', 'report', 'remove', '5', 'x', '1', 'bogus', 'quit', ''].join('\n');
    const r = runPython(dir, ['main.py'], typed);
    assert.equal(r.status, 0, r.stderr);
    for (const expected of ['Records loaded: 0.', '  add\n  list\n  remove\n  report\n  help\n  quit', 'Added Coffee: 3.50', 'Please type something.',
      "That isn't a number.", "Amounts can't be negative.", 'Added Tea: 2.00', '  1. Coffee                     3.50', 'Total:   5.50', 'Average: 2.75',
      'Biggest: Coffee (3.50)', 'Please type a number from 1 to 2.', 'Removed Coffee.', "There's no command 'bogus'.", 'Bye!']) {
      assert.ok(r.stdout.includes(expected), `expected ${JSON.stringify(expected)} in:\n${r.stdout}`);
    }
    assert.deepEqual(JSON.parse(readFileSync(path.join(dir, 'records.json'), 'utf8')), [{ name: 'Tea', amount: 2 }]);
    const again = runPython(dir, ['main.py'], 'list\nquit\n');
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /Records loaded: 1\.[\s\S]*  1\. Tea +2\.00/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Just enough of Flask to register the routes and call them, so the test needs nothing installed.
const FLASK_STAND_IN = `import json as _json
class _Request:
    def __init__(self): self._json, self.args = None, {}
    def get_json(self, silent=False): return self._json
request = _Request()
class _Response:
    def __init__(self, body): self.body = body
def jsonify(*args, **kw): return _Response(_json.dumps(args[0] if args else kw))
class Flask:
    def __init__(self, name): self.routes = {}
    def route(self, path, methods=("GET",)):
        def deco(fn):
            for m in methods: self.routes[(m, path)] = fn
            return fn
        return deco
    def run(self, **kw): print("(would serve on port", kw.get("port"), ")")
    def call(self, method, path, json=None, args=None):
        request._json, request.args = json, args or {}
        out, status = self.routes[(method, path)](), 200
        if isinstance(out, tuple): out, status = out
        return [status, out.body if isinstance(out, _Response) else out]
`;
const CALL_ROUTES = `import json, os
os.environ["ADMIN_KEY"] = "sesame"
import main
from tools import app
calls = [("GET", "/", None, None), ("POST", "/api/notes", {"text": "Buy milk"}, None), ("POST", "/api/notes", {"text": "  "}, None),
         ("POST", "/api/notes", {"text": "<b>hi</b>"}, None), ("GET", "/api/notes", None, None), ("GET", "/admin", None, {"key": "wrong"}),
         ("GET", "/admin", None, {"key": "sesame"})]
print(json.dumps([app.call(*c) for c in calls]))
`;

test('the online service: its walk steps run, and with Flask stood in, every route answers', () => {
  const kit = lib.kits.saas;
  const walkDir = tempDir('saas-walk');
  try {
    writePython(build('saas', idsWhere(kit, (s, c) => c.depth === 'walk')).project, walkDir);
    const r = runPython(walkDir, ['main.py']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /The database is ready: 0 notes in notes\.db\./);
    assert.ok(existsSync(path.join(walkDir, 'notes.db')));
  } finally { rmSync(walkDir, { recursive: true, force: true }); }

  const dir = tempDir('saas');
  try {
    writePython(filled(build('saas', kit.steps.map(s => s.id)).project), dir);
    writeFileSync(path.join(dir, 'flask.py'), FLASK_STAND_IN);
    writeFileSync(path.join(dir, 'call_routes.py'), CALL_ROUTES);
    const started = runPython(dir, ['main.py']);
    assert.equal(started.status, 0, started.stderr);
    assert.match(started.stdout, /\(would serve on port 5000 \)/);
    const r = runPython(dir, ['call_routes.py']);
    assert.equal(r.status, 0, r.stderr);
    const [home, added, empty, html, list, locked, admin] = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.equal(home[0], 200);
    assert.deepEqual([added[0], JSON.parse(added[1])], [201, { id: 1, text: 'Buy milk' }]);
    assert.deepEqual([empty[0], JSON.parse(empty[1])], [400, { error: "A note can't be empty." }]);
    assert.equal(html[0], 201);
    assert.deepEqual(JSON.parse(list[1]).map(n => n.text), ['<b>hi</b>', 'Buy milk']);
    assert.deepEqual(locked, [403, 'Not allowed.']);
    assert.equal(admin[0], 200);
    assert.match(admin[1], /2 notes so far[\s\S]*&lt;b&gt;hi&lt;\/b&gt;/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Runs the window app with tkinter replaced by a mock, so no window opens, then calls its tools.
const MOCK_TKINTER = `import ast, os, runpy, sys, tempfile
from unittest import mock
ast.parse(open("main.py", encoding="utf-8").read())
tk = mock.MagicMock()
sys.modules["tkinter"] = tk
ns = runpy.run_path("main.py", run_name="__main__")
assert tk.Tk.return_value.mainloop.called
path = os.path.join(tempfile.mkdtemp(), "list.txt")
tk.filedialog.asksaveasfilename.return_value = tk.filedialog.askopenfilename.return_value = path
tk.simpledialog.askstring.return_value = "  Call Alex  "
tk.Entry.return_value.get.return_value = " New item "
box = tk.Listbox.return_value
box.get.return_value = ["Buy milk", "Caf\\u00e9"]
box.curselection.return_value = (1,)
for name in ["add_item", "remove_selected", "edit_selected", "save_list", "open_list", "show_about"]:
    if name in ns: ns[name]()
print([list(c.args) for c in box.insert.call_args_list if not isinstance(c.args[0], mock.MagicMock)])
print(open(path, encoding="utf-8").read().splitlines())
`;

test('the window app compiles, and runs with tkinter stood in (no window opens)', () => {
  const dir = tempDir('window');
  try {
    writePython(filled(build('window', lib.kits.window.steps.map(s => s.id)).project), dir);
    const parsed = runPython(dir, ['-c', 'import ast; ast.parse(open("main.py", encoding="utf-8").read())']);
    assert.equal(parsed.status, 0, parsed.stderr);
    writeFileSync(path.join(dir, 'check.py'), MOCK_TKINTER);
    const r = runPython(dir, ['check.py']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\[\[1, 'Call Alex'\]\]/);   // edited in place, spaces trimmed
    assert.match(r.stdout, /\['Buy milk', 'Café'\]/);   // saved and read back as UTF-8
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/* arduino-cli, from the PATH or inside an installed Arduino IDE 2 (with the AVR boards installed). */
const ARDUINO_CLI = ['arduino-cli', path.join(process.env.LOCALAPPDATA || '', 'Programs/Arduino IDE/resources/app/lib/backend/resources/arduino-cli.exe')]
  .find(c => { try { return /arduino:avr/.test(spawnSync(c, ['core', 'list'], { encoding: 'utf8' }).stdout || ''); } catch (_) { return false; } });

test('the gadget sketch, with its blanks filled, compiles for an Arduino Uno with arduino-cli', { skip: !ARDUINO_CLI && 'arduino-cli with arduino:avr is not installed' }, () => {
  const dir = tempDir('gadget');
  try {
    const sketch = path.join(dir, 'gadget');
    const text = compile(filled(build('gadget', lib.kits.gadget.steps.map(s => s.id)).project)).results.sketch.text;
    mkdirSync(sketch);
    writeFileSync(path.join(sketch, 'gadget.ino'), text);
    const r = spawnSync(ARDUINO_CLI, ['compile', '--fqbn', 'arduino:avr:uno', sketch], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Sketch uses \d+ bytes/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

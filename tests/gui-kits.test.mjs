// The GUI estimate's other toolkits (lang/gui_kits.js): Qt (PySide and PyQt in Python, Widgets in C++), wxPython and
// Dear ImGui, read from their code into windows of parts, each against what the toolkit really did where that can be
// run here (tests/fixtures/gui: the apps, and the probes' reports of them: PySide6 in Windows 11's style, wxPython 4 on
// Windows), and the lines a drag or a corner rewrites. Then the probes themselves, run, when this computer has the
// toolkit (INTUICODE_PYTHON names a Python that has PySide6 or wxPython).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { PYTHON, ROOT } from './helpers/engine.mjs';

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['lang/gui.js', 'lang/gui_kits.js']) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const G = ctx.IntuiGui;
const plain = (x) => JSON.parse(JSON.stringify(x));
const FIX = path.join(ROOT, 'tests/fixtures/gui');
const app = (name) => [{ path: name, code: readFileSync(path.join(FIX, name), 'utf8') }];
const report = (name) => JSON.parse(readFileSync(path.join(FIX, name), 'utf8'));
const parts = (win) => Object.fromEntries(G.flat(win).map(({ node: n }) => [n.name || n.kind, [n.x, n.y, n.w, n.h, n.how]]));
const find = (win, name) => G.flat(win).find(x => x.node.name === name);
// a part as the probe measured it: [x, y, w, h], by the program's name for it
const measuredParts = (rep) => { const out = {}; const walk = (n) => { if (n.name) out[n.name] = [n.x, n.y, n.w, n.h]; (n.children || []).forEach(walk); }; walk(rep.windows[0].root); return out; };

test('gui kits: PySide, as Qt lays it out (box layouts: margins, spacing, what grows): the same as Qt measured it', () => {
  const files = app('qt_app.py'), est = G.estimate(files);
  assert.deepEqual(plain(est.toolkits), ['PySide/PyQt']);
  const w = est.windows[0];
  assert.deepEqual([w.title, w.w, w.h], ['Tasks', 360, 300]);
  const p = plain(parts(w));
  assert.deepEqual(p.entry, [11, 11, 251, 26, 'rules'], 'a line edit grows across its row (11 round the window)');
  assert.deepEqual(p.add, [268, 11, 81, 26, 'rules'], 'a button keeps its size');
  assert.deepEqual(p.tasks, [11, 43, 338, 246, 'rules'], 'the list takes the rest (6 between)');
  assert.deepEqual(p.status, [12, 270, 100, 30, 'exact'], 'move(12, 270): there, at Qt\'s 100 by 30 (in no layout)');
  // and Qt itself (PySide6, Windows 11's style) put each one exactly there
  const m = measuredParts(report('qt-layout.json'));
  for (const name of ['entry', 'add', 'tasks', 'status']) assert.deepEqual(p[name].slice(0, 4), m[name], name);
  // what makes, places and wires each
  assert.deepEqual(plain(find(w, 'add').node.src.map(s => [s.role, s.line + 1])), [['made', 13], ['does', 14], ['placed', 16]]);
  assert.equal(find(w, 'add').node.label, 'Add');
  assert.equal(find(w, 'add').node.type, 'QPushButton');
});

test('gui kits: PySide forms, group boxes and grids; a window sized by what it holds', () => {
  const w = G.estimate(app('qt_more.py')).windows[0], p = plain(parts(w)), m = measuredParts(report('qt-form-layout.json'));
  assert.deepEqual([w.w, w.h, w.root.how], [278, 440, 'sketch'], 'no resize(): what its layout asks for (Qt made it 278 by 440)');
  // the group box: its title, then its form's rows, 26 tall, 6 apart
  assert.deepEqual(p.box, [11, 11, 256, 128, 'rules']);
  assert.deepEqual([p.name[1], p.age[1], p.kind[1]], [38, 70, 102]);
  assert.deepEqual([m.name[1], m.age[1], m.kind[1]], [38, 70, 102], 'as Qt put them');
  // the grid: a column as wide as its widest; the slider and Cancel take the rest
  for (const name of ['agree', 'level', 'ok', 'cancel', 'bar', 'notes']) assert.deepEqual(p[name].slice(0, 4), m[name], name);
});

test('gui kits: Qt Widgets in C++: the same layout, setGeometry exact; a drag and a corner are new numbers', () => {
  const files = app('qt_app.cpp'), w = G.estimate(files).windows[0], p = plain(parts(w));
  assert.deepEqual([w.title, w.toolkit, w.w, w.h], ['Tasks', 'Qt', 360, 300]);
  assert.deepEqual(p.status, [12, 270, 60, 20, 'exact'], 'setGeometry(12, 270, 60, 20)');
  assert.deepEqual(p.tasks, [11, 43, 338, 246, 'rules']);
  assert.deepEqual(plain(find(w, 'add').node.src.map(s => s.role)), ['made', 'does', 'placed'], 'connect() wires it');
  const s = find(w, 'status');
  assert.equal(G.move(files, s.node, 10, 5, s.parent).text, '        status->setGeometry(22, 275, 60, 20);');
  assert.equal(G.resize(files, s.node, 80, 30).text, '        status->setGeometry(12, 270, 80, 30);');
  assert.equal(G.resize(files, w.root, 400, 320).text, '        resize(400, 320);');
  assert.match(G.move(files, find(w, 'tasks').node, 5, 5).why, /^Its layout places it/);
});

test('gui kits: PySide moves and corners: move() is its new place; a corner makes it setGeometry; a layout says why', () => {
  const files = app('qt_app.py'), w = G.estimate(files).windows[0], s = find(w, 'status');
  assert.deepEqual(plain(G.move(files, s.node, 10, 5, s.parent)), { path: 'qt_app.py', line: 20, text: '        self.status.move(22, 275)', x: 22, y: 275 });
  assert.equal(G.resize(files, s.node, 60, 26).text, '        self.status.setGeometry(12, 270, 60, 26)');
  assert.equal(G.resize(files, w.root, 400, 320).text, '        self.resize(400, 320)');
  assert.match(G.resize(files, find(w, 'entry').node, 300, 30).why, /^Its layout gives it the size it asks for/);
  assert.match(G.move(files, w.root, 5, 5).why, /^A window is moved by whoever opens it/);
});

test('gui kits: wxPython, as its sizers do it (proportion, EXPAND, borders): the same as wx measured it', () => {
  const files = app('wx_app.py'), est = G.estimate(files);
  assert.deepEqual(plain(est.toolkits), ['wxPython']);
  const w = est.windows[0], p = plain(parts(w)), m = measuredParts(report('wx-layout.json'));
  assert.deepEqual([w.title, w.w, w.h], ['Tasks', 360, 300], 'size=(376, 339): inside its title bar and borders');
  assert.deepEqual(p.panel, [0, 0, 360, 300, 'exact'], 'a frame\'s one panel fills it');
  for (const name of ['entry', 'add', 'tasks']) assert.deepEqual(p[name].slice(0, 4), m[name], name);
  assert.deepEqual(p.status.slice(0, 2), m.status.slice(0, 2), 'pos=(12, 270)');
  assert.equal(p.status[4], 'exact');
  // a drag: pos=; a corner: size=, added; the frame's size counts its title bar and borders; a sizer says why
  const s = find(w, 'status');
  assert.equal(G.move(files, s.node, 10, 5, s.parent).text, '        self.status = wx.StaticText(panel, label="0 tasks", pos=(22, 275))');
  assert.equal(G.resize(files, s.node, 60, 20).text, '        self.status = wx.StaticText(panel, label="0 tasks", pos=(12, 270), size=(60, 20))');
  assert.equal(G.resize(files, w.root, 400, 320).text, '        super().__init__(None, title="Tasks", size=(416, 359))');
  assert.match(G.move(files, find(w, 'tasks').node, 5, 5).why, /^Its sizer places it/);
  assert.deepEqual(plain(find(w, 'add').node.src.map(s => s.role)), ['made', 'does', 'placed'], 'Bind wires it');
});

test('gui kits: Dear ImGui: windows from Begin, items one below another (SameLine beside), SetCursorPos exact', () => {
  const files = app('im_app.cpp'), est = G.estimate(files);
  assert.deepEqual(plain(est.toolkits), ['Dear ImGui']);
  const [tools, log] = est.windows;
  assert.deepEqual([tools.title, tools.w, tools.h, tools.root.how], ['Tools', 300, 200, 'exact'], 'SetNextWindowSize(ImVec2(300, 200))');
  const p = plain(parts(tools));
  assert.deepEqual(p.Name, [8, 27, 28, 13, 'rules'], 'below the title bar, inside its padding');
  assert.deepEqual(p.Add, [8, 67, 29, 19, 'rules']);
  assert.deepEqual(p.Clear, [45, 67, 80, 19, 'rules'], 'SameLine: beside Add, 8 apart, at its ImVec2 width');
  assert.deepEqual(p.Ready, [10, 170, 35, 13, 'exact'], 'SetCursorPos(ImVec2(10, 170))');
  assert.equal(find(tools, 'Add').node.src.some(s => s.role === 'does'), true, 'if (ImGui::Button(…)): what it does');
  assert.deepEqual([log.title, log.root.how], ['Log', 'sketch'], 'no size: what it holds');
  // moves and corners
  const r = find(tools, 'Ready');
  assert.equal(G.move(files, r.node, 10, 5, r.parent).text, '    ImGui::SetCursorPos(ImVec2(20, 175));');
  assert.equal(G.resize(files, tools.root, 320, 210).text, '    ImGui::SetNextWindowSize(ImVec2(320, 210));');
  assert.equal(G.resize(files, find(tools, 'Add').node, 60, 24).text, '    if (ImGui::Button("Add", ImVec2(60, 24))) { /* add it */ }');
  assert.match(G.move(files, find(tools, 'Add').node, 5, 5).why, /^ImGui puts it below the one before it/);
  assert.match(G.move(files, log.root, 5, 5).why, /SetNextWindowPos/);
});

test('gui kits: a measurement of a Qt or wx app is drawn as measured, each part linked to its code', () => {
  for (const [file, rep] of [['qt_app.py', 'qt-layout.json'], ['wx_app.py', 'wx-layout.json']]) {
    const files = app(file), est = G.estimate(files), view = G.measured(report(rep), est), w = view.windows[0];
    const named = G.flat(w).filter(x => x.node.name && x.node.kind !== 'window');
    assert.ok(named.length >= 4, file);
    for (const { node } of named) if (['entry', 'add', 'tasks', 'status'].includes(node.name)) assert.ok(node.src.length && node.how === 'measured', `${file}: ${node.name}`);
  }
  // Qt's own insides (a list's viewport and scroll bars) aren't parts
  assert.equal(JSON.stringify(report('qt-layout.json')).includes('qt_scrollarea'), false);
});

test('gui kits: the probes are in the app, and say how to use them', () => {
  assert.match(G.QT_PY_PROBE, /QT_QPA_PLATFORM[\s\S]*class App\(Base\)/);
  assert.match(G.WX_PROBE, /def MainLoop/);
  assert.match(G.QT_PROBE, /inline void probeQtLayoutSoon\(/);
  assert.match(G.IMGUI_PROBE, /TestEngineHookItems = true[\s\S]*void ImGuiTestEngineHook_ItemAdd\(/);
});

// a Python with PySide6 (or wxPython) here: INTUICODE_PYTHON, or the usual one
const has = (mod) => { try { return spawnSync(PYTHON, ['-c', `import ${mod}`], { timeout: 30000 }).status === 0; } catch (e) { return false; } };
const runProbe = (probe, file) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'intuicode-probe-'));
  try {
    writeFileSync(path.join(dir, 'probe.py'), probe);
    writeFileSync(path.join(dir, file), readFileSync(path.join(FIX, file), 'utf8'));
    const r = spawnSync(PYTHON, ['-u', 'probe.py', file], { cwd: dir, encoding: 'utf8', timeout: 60000 });
    return { ...r, report: G.reportIn(r.stdout) };
  } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); }
};
test('gui kits: the PySide probe runs the app out of sight and says where Qt put each part, with a picture', { skip: !has('PySide6.QtWidgets') && 'no Python with PySide6 here' }, () => {
  const r = runProbe(G.QT_PY_PROBE, 'qt_app.py');
  assert.ok(r.report, `no report (${r.status}): ${r.stderr}`);
  const w = r.report.windows[0], m = measuredParts(r.report);
  assert.deepEqual([r.report.toolkit, w.title, w.w, w.h], ['PySide6', 'Tasks', 360, 300]);
  assert.deepEqual(m.status, [12, 270, 100, 30], 'where the code says, whatever the style');
  assert.ok(m.entry[1] === m.add[1] || Math.abs(m.entry[1] - m.add[1]) < 4, 'in one row');
  assert.ok(m.tasks[1] > m.entry[1] && m.tasks[2] === 338, 'the list below, the width less the margins');
  assert.ok(w.pictureData && w.pictureData.length > 100, 'a picture of it');
});
test('gui kits: the wxPython probe runs the app out of sight and says where wx put each part', { skip: !has('wx') && 'no Python with wxPython here' }, () => {
  const r = runProbe(G.WX_PROBE, 'wx_app.py');
  assert.ok(r.report, `no report (${r.status}): ${r.stderr}`);
  const m = measuredParts(r.report);
  assert.deepEqual([r.report.toolkit, r.report.windows[0].title], ['wxPython', 'Tasks']);
  assert.deepEqual([m.entry[0], m.entry[1], m.add[1], m.tasks[0]], [8, 8, 8, 8], 'the sizers\' borders, as the code says');
  assert.deepEqual(m.status.slice(0, 2), [12, 270]);
});

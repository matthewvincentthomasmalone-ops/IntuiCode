// The GUI estimate (lang/gui.js): an app's windows read from its code, for the Preview and Editor mode. tkinter (pack,
// grid and place followed) and JUCE (components, setBounds, the rectangle steps of resized()) are checked here in Node,
// against what each toolkit would do; then the Preview and Editor mode on a tkinter app in the real page, in Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/engine.mjs';
import { findChrome, openBrowser } from './helpers/browser.mjs';

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'lang/gui.js'), 'utf8'), ctx, { filename: 'lang/gui.js' });
const G = ctx.IntuiGui;
const plain = (x) => JSON.parse(JSON.stringify(x));
const parts = (win) => Object.fromEntries(G.flat(win).map(({ node: n }) => [n.name || n.kind, [n.x, n.y, n.w, n.h, n.how]]));
const find = (win, name) => G.flat(win).find(x => x.node.name === name);

const TK = `import tkinter as tk

PAD = 8

def add_task():
    tasks.insert(tk.END, entry.get())

window = tk.Tk()
window.title("Tasks")
window.geometry("360x300")

top = tk.Frame(window)
top.pack(side=tk.TOP, fill=tk.X, padx=PAD, pady=PAD)
entry = tk.Entry(top, width=30)
entry.grid(row=0, column=0, padx=4)
add = tk.Button(top, text="Add", command=add_task)
add.grid(row=0, column=1)
tasks = tk.Listbox(window, height=8)
tasks.pack(fill=tk.BOTH, expand=True, padx=PAD)
status = tk.Label(window, text="0 tasks")
status.place(x=12, y=270)
lost = tk.Button(window, text="Never shown")
window.mainloop()
`;

test('gui: numbers the code works out, and nothing guessed', () => {
  assert.equal(G.num('COLUMNS * CELL + 4', { COLUMNS: 20, CELL: 24 }), 484);
  assert.equal(G.num('7 // 2'), 3);
  assert.equal(G.num('juce::jlimit(24, 34, 40 - 5)'), 34);
  assert.equal(G.num('0.5f * 200'), 100);
  assert.equal(G.num('-(3 + 4) * 2'), -14);
  assert.equal(G.num('width + 1'), null, 'a name it doesn\'t know');
  assert.equal(G.num('state.load()'), null);
  assert.equal(G.num('"12"'), null);
});

test('gui: tkinter, as Tk lays it out: pack (sides, padding, fill, expand), grid (rows, columns, top left) and place', () => {
  const est = G.estimate([{ path: 'tk_app.py', code: TK }]);
  assert.deepEqual(plain(est.toolkits), ['tkinter']);
  assert.equal(est.windows.length, 1);
  const w = est.windows[0];
  assert.deepEqual([w.title, w.w, w.h], ['Tasks', 360, 300]);
  assert.deepEqual(plain(parts(w)), {
    window: [0, 0, 360, 300, 'exact'],
    top: [8, 8, 344, 26, 'rules'],           // fill=X, padx=pady=PAD
    entry: [12, 10, 216, 22, 'rules'],       // grid row 0 column 0, padx=4: from the frame's top left
    add: [232, 8, 39, 26, 'rules'],
    tasks: [8, 42, 344, 258, 'rules'],       // fill=BOTH, expand: the rest of the window
    status: [12, 270, 53, 20, 'exact'],      // place(x=12, y=270): the code says the numbers
  });
  assert.equal(find(w, 'add').node.label, 'Add');
  // what each part is made, placed and does in the code (0-based lines)
  assert.deepEqual(plain(find(w, 'add').node.src.map(s => [s.role, s.line])), [['made', 15], ['does', 15], ['placed', 16], ['does', 4]]);
  assert.match(est.notes[0], /^lost \(tk_app\.py, line 22\) is made but never placed \(no pack, grid or place\), so the window doesn't show it\.$/);
  // a widget set to what .pack() gives back is said too
  const chained = G.estimate([{ path: 'a.py', code: 'from tkinter import *\nroot = Tk()\nb = Button(root, text="Go").pack()\n' }]);
  assert.match(chained.notes[0], /^b is set to what pack\(\) gives back \(None\), not to the Button/);
  assert.deepEqual(plain(parts(chained.windows[0]))['Go'] || plain(G.flat(chained.windows[0])[1].node.label), 'Go');
});

test('gui: a drag of a tkinter part is its new numbers; a grid part moves by cell; pack says why', () => {
  const files = [{ path: 'tk_app.py', code: TK }];
  const w = G.estimate(files).windows[0];
  const at = (name) => find(w, name);
  assert.deepEqual(plain(G.move(files, at('status').node, 30, -10, at('status').parent)), { path: 'tk_app.py', line: 20, text: 'status.place(x=42, y=260)', x: 42, y: 260 });
  // add (row 0, column 1) dropped past the last column: a new column; on entry: taken
  assert.deepEqual(plain(G.move(files, at('add').node, 60, 0, at('add').parent)), { path: 'tk_app.py', line: 16, text: 'add.grid(row=0, column=2)', row: 0, column: 2 });
  assert.match(G.move(files, at('add').node, -120, 0, at('add').parent).why, /^Row 0, column 0 has entry in it already\.$/);
  assert.match(G.move(files, at('entry').node, 0, 40, at('entry').parent).text, /^entry\.grid\(row=1, column=0, padx=4\)$/, 'a new row');
  assert.match(G.move(files, at('tasks').node, 10, 10, at('tasks').parent).why, /^pack\(\) places things one after another \(side=top\), not at a position \(tk_app\.py, line 19\)/);
  assert.match(G.move(files, at('window').node, 10, 10, null).why, /^A window is moved by whoever opens it/);
  // a place() whose numbers are worked out isn't rewritten
  const worked = [{ path: 'b.py', code: 'import tkinter as tk\nM = 4\nw = tk.Tk()\nl = tk.Label(w, text="x")\nl.place(x=M * 2, y=10)\n' }];
  const lw = G.estimate(worked).windows[0], l = find(lw, 'l');
  assert.deepEqual([l.node.x, l.node.y, l.node.how], [8, 10, 'rules']);
  assert.match(G.move(worked, l.node, 5, 5, l.parent).why, /^place\(\) works its position out \(x=M \* 2, y=10\)/);
});

const JUCE_H = `#pragma once
#include <juce_gui_basics/juce_gui_basics.h>

class MeterStrip : public juce::Component {
public:
    MeterStrip();
    void resized() override;
private:
    juce::Slider level;
    juce::Label caption;
};

// The editor (it's the window the host opens)
class GainEditor final : public juce::AudioProcessorEditor {
public:
    GainEditor();
    void resized() override;
private:
    juce::Slider gain;
    juce::TextButton bypass { "Bypass" };
    juce::Label title, units;
    MeterStrip meter;
    juce::ComboBox mode;
    std::array<juce::ToggleButton, bandCount> bands;
};
`;
const JUCE_CPP = `#include "PluginEditor.h"
constexpr int bandCount = 4;

MeterStrip::MeterStrip() {
    level.setSliderStyle(juce::Slider::LinearVertical);
    addAndMakeVisible(level);
    addAndMakeVisible(caption);
}
void MeterStrip::resized() {
    auto area = getLocalBounds().reduced(4);
    caption.setBounds(area.removeFromBottom(20));
    level.setBounds(area);
}

GainEditor::GainEditor() : meter{}, mode{"mode"} {
    gain.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    addAndMakeVisible(gain);
    addAndMakeVisible(bypass);
    title.setText("Gain", juce::dontSendNotification);
    addAndMakeVisible(title);
    addAndMakeVisible(meter);
    addAndMakeVisible(mode);
    for (auto& b : bands) addAndMakeVisible(b);
    for (int i = 0; i < bandCount; ++i) addAndMakeVisible(bands[i]);
    bypass.onClick = [this] { repaint(); };
    setSize(400, 300);
}

void GainEditor::resized() {
    auto area = getLocalBounds();
    title.setBounds(area.removeFromTop(40).reduced(10, 8));
    if (meter.isVisible()) meter.setBounds(area.removeFromRight(80));
    gain.setBounds(20, 60, 120, 120);
    bypass.setBounds(area.removeFromBottom(40).withSizeKeepingCentre(100, 26));
    mode.setBounds(area.getX() + scaleFor(area.getWidth()), 200, 140, 24);
}
`;

test('gui: JUCE, from the classes: what each adds, setSize, setBounds and resized()\'s rectangle steps; the rest a sketch', () => {
  const files = [{ path: 'PluginEditor.h', code: JUCE_H }, { path: 'PluginEditor.cpp', code: JUCE_CPP }];
  const est = G.estimate(files);
  assert.deepEqual(plain(est.toolkits), ['JUCE']);
  assert.equal(est.windows.length, 1, 'the editor; MeterStrip is inside it');
  const w = est.windows[0];
  assert.deepEqual([w.title, w.w, w.h], ['GainEditor', 400, 300]);
  const p = plain(parts(w));
  assert.deepEqual(p.gain, [20, 60, 120, 120, 'exact']);
  assert.deepEqual(p.title, [10, 8, 380, 24, 'rules'], 'removeFromTop(40).reduced(10, 8)');
  assert.deepEqual(p.meter, [320, 40, 80, 260, 'rules'], 'removeFromRight(80), placed inside an if');
  assert.deepEqual(p.level, [324, 44, 72, 232, 'rules'], 'inside the meter: its own resized(), at its size');
  assert.deepEqual(p.caption, [324, 276, 72, 20, 'rules']);
  assert.deepEqual(p.bypass, [110, 267, 100, 26, 'rules'], 'removeFromBottom(40).withSizeKeepingCentre(100, 26)');
  assert.equal(p.mode[4], 'sketch', 'a number the program works out (scaleFor)');
  assert.equal(p.bands[4], 'sketch');
  assert.equal(find(w, 'bands').node.many, 4, 'std::array<…, bandCount>, bandCount a constexpr');
  assert.equal(p.units, undefined, 'declared, never added: not shown');
  assert.equal(find(w, 'bypass').node.label, 'Bypass');
  assert.equal(find(w, 'title').node.label, 'Gain');
  assert.equal(find(w, 'gain').node.kind, 'slider');
  assert.deepEqual(plain(find(w, 'bypass').node.src.map(s => [s.role, s.path, s.line])), [['made', 'PluginEditor.h', 19], ['shown', 'PluginEditor.cpp', 17], ['placed', 'PluginEditor.cpp', 33], ['does', 'PluginEditor.cpp', 24]]);
  assert.match(find(w, 'mode').node.why, /^Its place is worked out in resized\(\) from what the program knows when it runs \(PluginEditor\.cpp, line 35\)/);
  // a drag: only setBounds with its numbers written as numbers
  const g = find(w, 'gain');
  assert.deepEqual(plain(G.move(files, g.node, 15, -5, g.parent)), { path: 'PluginEditor.cpp', line: 32, text: '    gain.setBounds(35, 55, 120, 120);', x: 35, y: 55 });
  assert.match(G.move(files, find(w, 'title').node, 5, 5).why, /^Its position is worked out in the code \(PluginEditor\.cpp, line 31\): change the numbers there\.$/);
});

test('gui: JUCE written the way a big app is: namespaces, owned pointers, arrays of them, one-line members, comments', () => {
  const h = `namespace app::ui {
class Strip final : public juce::Component {
public:
    Strip();
private:
    juce::Slider fader;   // the channel's fader (it's tall)
};
class Page final : public juce::Component, private juce::Timer {
public:
    Page();
    void resized() override;
private:
    std::array<std::unique_ptr<Strip>, channelCount> strips;
    juce::Label heading, footer;
    juce::TextButton tabs[3];
};
class MainComponent final : public juce::Component {
public:
    MainComponent();
    void resized() override;
private:
    std::unique_ptr<app::ui::Page> page;
};
}`;
  const cpp = `constexpr int channelCount = 16;
namespace app::ui {
Strip::Strip() { addAndMakeVisible(fader); }
Page::Page() : heading{"Mixer"}, footer{} {
    // don't forget: it's all added here
    for (auto& s : strips) { s = std::make_unique<Strip>(); addAndMakeVisible(*s); }
    addAndMakeVisible(heading);
    addAndMakeVisible(footer);
    for (auto& t : tabs) addAndMakeVisible(t);
}
void Page::resized() { auto r = getLocalBounds(); heading.setBounds(r.removeFromTop(30)); }
MainComponent::MainComponent() { page = std::make_unique<Page>(); addAndMakeVisible(*page); setSize(1000, 600); }
void MainComponent::resized() { if (page) page->setBounds(getLocalBounds()); }
}`;
  const est = G.estimate([{ path: 'ui.h', code: h }, { path: 'ui.cpp', code: cpp }]);
  assert.deepEqual(plain(est.windows.map(w => w.title)), ['MainComponent']);
  const w = est.windows[0], p = plain(parts(w));
  assert.deepEqual(p.page, [0, 0, 1000, 600, 'rules'], 'if (page) page->setBounds(getLocalBounds())');
  assert.deepEqual(p.heading, [0, 0, 1000, 30, 'rules']);
  assert.equal(find(w, 'heading').node.label, 'Mixer');
  assert.equal(p.footer[4], 'sketch', 'one of two members declared on one line');
  assert.equal(find(w, 'page').node.type, 'Page');
  assert.deepEqual(plain(find(w, 'page').node.children.map(c => c.name)), ['strips', 'heading', 'footer', 'tabs'], 'a loop\'s name stands for what it goes through (for (auto& s : strips))');
  const strips = find(w, 'strips').node;
  assert.deepEqual([strips.many, strips.type, strips.children.map(c => c.name)[0]], [16, 'Strip', 'fader'], 'channelCount of them, each a Strip with its fader');
  assert.equal(find(w, 'tabs').node.many, 3);
});

/* ---------- the Preview and Editor mode on a tkinter app, in Chrome ---------- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const ORIGIN = 'http://intuacode.localhost';
function serveApp(req) {
  const url = new URL(req.url);
  if (url.origin !== ORIGIN) return { status: 404, body: '' };
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return { type: 'text/html', body: `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head><body>\n${readFileSync(path.join(ROOT, 'index.html'), 'utf8')}\n</body></html>\n` };
  }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT + path.sep) || !existsSync(file) || !statSync(file).isFile()) return { status: 404, body: '' };
  return { type: TYPES[path.extname(file)] || 'application/octet-stream', body: readFileSync(file) };
}

test('gui: in the page, an imported tkinter app shows its window in the Preview, and Editor mode moves a part in its code', { skip: !findChrome() && 'no Chrome or Edge' }, async () => {
  const browser = await openBrowser();
  try {
    const tab = await browser.tab();
    await tab.open(ORIGIN + '/', { serve: serveApp });
    await tab.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false });
    const until = async (cond, what) => { for (let i = 0; i < 150; i++) { if (await tab.run(`!!(${cond})`)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`waited for ${what}: ${await tab.run('document.getElementById("editBar").textContent')}`); };
    await until('document.getElementById("btnEditor") && document.getElementById("ta")', 'the app');
    await tab.run('(() => { const w = document.getElementById("welcomeModal"); if (!w.hidden) document.getElementById("welcomeLook").click(); return true; })()');
    // imported as a folder of one file
    await tab.run(`(() => {
      const f = new File([${JSON.stringify(TK)}], 'tk_app.py'); Object.defineProperty(f, 'webkitRelativePath', { value: 'tasks/tk_app.py' });
      const inp = document.getElementById('impFolder'); Object.defineProperty(inp, 'files', { value: [f], configurable: true }); inp.dispatchEvent(new Event('change'));
      return true;
    })()`);
    await until('/Imported tasks/.test(document.getElementById("termLog").innerText)', 'the import to finish');
    // opened, it shows its window's estimate in the Preview (as a website shows its page)
    await until('!document.getElementById("tabPreview").hidden && document.getElementById("tabPreview").getAttribute("aria-selected") === "true"', 'the Preview (a window is read from the code)');
    assert.equal(await tab.run('document.getElementById("btnEditor").hidden'), false);
    // where the page puts a part: the Preview's own question (the frame is sandboxed), by its place in the estimate
    const index = (name) => tab.run(`IntuiGui.flat(IntuiGui.estimate([{ path: 'tk_app.py', code: ${JSON.stringify(TK)} }]).windows[0]).findIndex(x => x.node.name === ${JSON.stringify(name)})`);
    const where = (line) => tab.run(`new Promise((ok, no) => {
      const f = (e) => { if (e.data && e.data.type === 'edit-at' && e.data.line === ${line}) { removeEventListener('message', f); ok(e.data); } };
      addEventListener('message', f); document.getElementById('preview').contentWindow.postMessage({ intuicodeWhere: ${line} }, '*');
      setTimeout(() => no(new Error('the page didn\\'t answer')), 5000);
    })`);
    const statusAt = await index('status'), tasksAt = await index('tasks');
    // (the estimate's page, not the page the Preview showed before: its window, the first part, is 360 × 300)
    await until('(document.getElementById("preview").getAttribute("srcdoc") || "").includes("An estimate of the app")', 'the estimate in the Preview');
    let win = null;
    // (Chrome without a window can leave a frame of its own process unsized after it's shown again: a window draws and
    // sizes it all the time; here the window's size is nudged until it has)
    for (let i = 0; i < 60 && !(win && win.w === 360 && win.h === 300); i++) {
      try { win = await where(0); } catch (e) { win = null; }
      if (win && win.w === 360) break;
      const fr = JSON.parse(await tab.run('JSON.stringify(document.getElementById("preview").getBoundingClientRect())'));
      await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } });
      await tab.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: fr.x + 20 + (i % 5), y: fr.y + 20, button: 'none', buttons: 0 });
      await new Promise(r => setTimeout(r, 250));
    }
    await tab.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false });
    assert.deepEqual([win && win.w, win && win.h], [360, 300], 'the window, at its geometry("360x300"): ' + JSON.stringify(win) + ' ' + await tab.run('JSON.stringify({ wrap: document.getElementById("previewWrap").hidden, sel: document.getElementById("tabPreview").getAttribute("aria-selected"), shut: document.getElementById("work").className, frame: document.getElementById("preview").getBoundingClientRect().toJSON(), log: document.getElementById("termLog").innerText.slice(-200) })'));
    const s0 = await where(statusAt), t0 = await where(tasksAt);
    assert.deepEqual([t0.w, t0.h], [344, 258], 'the list as Tk lays it out');
    assert.deepEqual([s0.x - t0.x, s0.y - t0.y], [4, 228], 'the label where place() puts it, in the same window');

    // Editor mode: the code and the estimate side by side
    await tab.run('document.getElementById("btnEditor").click()');
    assert.match(await tab.run('document.getElementById("editBar").textContent'), /^Drag a part of the window to move it\./);
    const frame = async () => JSON.parse(await tab.run('JSON.stringify(document.getElementById("preview").getBoundingClientRect())'));
    const mouse = (type, x, y, held) => tab.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' && !held ? 'none' : 'left', buttons: type === 'mousePressed' || held ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
    const drag = async (line, dx, dy) => {
      const f = await frame(), at = await where(line), x = f.x + at.x + at.w / 2, y = f.y + at.y + at.h / 2;
      await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } });
      await mouse('mouseMoved', x, y); await new Promise(r => setTimeout(r, 150));
      await mouse('mousePressed', x, y);
      for (let i = 1; i <= 8; i++) await mouse('mouseMoved', x + dx * i / 8, y + dy * i / 8, true);
      await tab.run('document.getElementById("editBar").dataset.was = document.getElementById("editBar").textContent');
      await mouse('mouseReleased', x + dx, y + dy);
      await until('document.getElementById("editBar").textContent !== document.getElementById("editBar").dataset.was', 'the move');
      return { bar: await tab.run('document.getElementById("editBar").textContent'), bad: await tab.run('document.getElementById("editBar").classList.contains("bad")') };
    };
    const code = () => tab.run('document.getElementById("uTa").value');
    // pointing at the list lights up its code: where it's placed, where it's made
    {
      const f = await frame(), at = await where(tasksAt);
      await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } });
      await mouse('mouseMoved', f.x + at.x + 40, f.y + at.y + 40); await new Promise(r => setTimeout(r, 150));
      await mouse('mouseMoved', f.x + at.x + 42, f.y + at.y + 41);
      await until('/^Pointing at/.test(document.getElementById("linkBar").textContent)', 'the list\'s code to light up');
      assert.match(await tab.run('document.getElementById("linkBar").textContent'), /^Pointing at <Listbox>#tasks\s*tk_app\.py lines 18–19/);
    }
    // the label (place): its new numbers are typed into its line; the estimate, read again, puts it there
    let m = await drag(statusAt, 30, -10);
    assert.equal(m.bad, false, m.bar);
    assert.match(m.bar, /^Moved status 30 right and 10 up, and the code puts it there\. Written in tk_app\.py line 21/);
    assert.equal((await code()).split('\n')[20], 'status.place(x=42, y=260)');
    // Ctrl+Z, in the code, takes it back
    await tab.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2, commands: ['undo'] });
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 });
    assert.equal((await code()).split('\n')[20], 'status.place(x=12, y=270)');
    // the list (pack) isn't at a position: it says why, and the code stays as it is
    const before = await code();
    m = await drag(tasksAt, 20, 20);
    assert.equal(m.bad, true);
    assert.match(m.bar, /^tasks: pack\(\) places things one after another/);
    assert.equal(await code(), before);
    await tab.close();
  } finally { await browser.close(); }
});

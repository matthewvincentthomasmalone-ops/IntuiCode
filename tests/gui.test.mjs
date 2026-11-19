// The GUI estimate (lang/gui.js): an app's windows read from its code, for the Preview and Editor mode. tkinter (pack,
// grid and place followed) and JUCE (components, setBounds, the rectangle steps of resized()) are checked here in Node,
// against what each toolkit would do; then the Preview and Editor mode on a tkinter app in the real page, in Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { PYTHON, ROOT } from './helpers/engine.mjs';
import { findChrome, openBrowser } from './helpers/browser.mjs';

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['lang/gui.js', 'lang/gui_kits.js']) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
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
    entry: [12, 12, 184, 19, 'rules'],       // grid row 0 column 0, padx=4: from the frame's top left
    add: [200, 8, 33, 26, 'rules'],          // (sizes: Tk's, as the probe measured them; tests/fixtures/tk-layout.json)
    tasks: [8, 42, 344, 258, 'rules'],       // fill=BOTH, expand: the rest of the window
    status: [12, 270, 42, 21, 'exact'],      // place(x=12, y=270): the code says the numbers
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

test('gui: a corner dragged is a size: place(width=, height=), setBounds\' size, a window\'s geometry or setSize; read back, it\'s that size', () => {
  const files = [{ path: 'tk_app.py', code: TK }], w = G.estimate(files).windows[0], f = (n) => find(w, n).node;
  const again = (r) => { const code = TK.split('\n'); code[r.line] = r.text; return G.estimate([{ path: 'tk_app.py', code: code.join('\n') }]).windows[0]; };
  let r = G.resize(files, f('status'), 60, 30);
  assert.deepEqual(plain(r), { path: 'tk_app.py', line: 20, text: 'status.place(x=12, y=270, width=60, height=30)', w: 60, h: 30 });
  assert.deepEqual(plain(parts(again(r)).status), [12, 270, 60, 30, 'exact'], 'read back, it\'s that size, where it was');
  r = G.resize([{ path: 'tk_app.py', code: TK.replace('status.place(x=12, y=270)', 'status.place(x=12, y=270, width=50, height=20)') }], { ...f('status'), w: 50, h: 20 }, 70, 24);
  assert.equal(r.text, 'status.place(x=12, y=270, width=70, height=24)', 'its own numbers changed');
  r = G.resize(files, w.root, 400, 320);
  assert.deepEqual([r.line, r.text], [9, 'window.geometry("400x320")']);
  assert.deepEqual([again(r).w, again(r).h], [400, 320]);
  assert.match(G.resize(files, f('tasks'), 300, 200).why, /^pack\(\) gives it the size it asks for \(tk_app\.py, line 19\)/);
  assert.match(G.resize(files, f('add'), 60, 30).why, /^grid\(\) gives it the size it asks for/);
  const rel = [{ path: 'tk_app.py', code: TK.replace('status.place(x=12, y=270)', 'status.place(x=12, y=270, relwidth=0.5)') }];
  assert.match(G.resize(rel, find(G.estimate(rel).windows[0], 'status').node, 60, 30).why, /^place\(\) sizes it from what it's in \(relwidth, relheight\)/);
  assert.equal(G.resize(files, f('status'), f('status').w, f('status').h).why, 'It wasn\'t resized.');
  // JUCE: setBounds' width and height; the editor's setSize; rectangle steps say why not
  const JF = [{ path: 'PluginEditor.h', code: JUCE_H }, { path: 'PluginEditor.cpp', code: JUCE_CPP }], jw = G.estimate(JF).windows[0];
  assert.deepEqual(plain(G.resize(JF, find(jw, 'gain').node, 150, 140)), { path: 'PluginEditor.cpp', line: 32, text: '    gain.setBounds(20, 60, 150, 140);', w: 150, h: 140 });
  assert.equal(G.resize(JF, jw.root, 500, 360).text, '    setSize(500, 360);');
  assert.match(G.resize(JF, find(jw, 'title').node, 200, 30).why, /^Its size is worked out in the code \(PluginEditor\.cpp, line 31\)/);
});

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

/* Driving the page in Chrome: waiting for it, asking the Preview where a part is (its frame is sandboxed: the Preview's
   own question, by the part's place in what it shows), and dragging in it. */
function drive(tab) {
  const until = async (cond, what, tries = 150) => { for (let i = 0; i < tries; i++) { if (await tab.run(`!!(${cond})`)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`waited for ${what}: ${await tab.run('document.getElementById("editBar").textContent')}`); };
  const where = (line) => tab.run(`new Promise((ok, no) => {
    const f = (e) => { if (e.data && e.data.type === 'edit-at' && e.data.line === ${line}) { removeEventListener('message', f); ok(e.data); } };
    addEventListener('message', f); document.getElementById('preview').contentWindow.postMessage({ intuicodeWhere: ${line} }, '*');
    setTimeout(() => no(new Error('the page didn\\'t answer')), 5000);
  })`);
  const frame = async () => JSON.parse(await tab.run('JSON.stringify(document.getElementById("preview").getBoundingClientRect())'));
  const mouse = (type, x, y, held, alt) => tab.send('Input.dispatchMouseEvent', { type, x, y, modifiers: alt ? 1 : 0, button: type === 'mouseMoved' && !held ? 'none' : 'left', buttons: type === 'mousePressed' || held ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
  // (Chrome without a window can leave a frame of its own process unsized after it's shown again: a window draws and
  // sizes it all the time; here the window's size is nudged until it has) -> the window as the page draws it
  const sized = async (w, h) => {
    let win = null;
    for (let i = 0; i < 60 && !(win && win.w === w && win.h === h); i++) {
      try { win = await where(0); } catch (e) { win = null; }
      if (win && win.w === w) break;
      const fr = await frame();
      await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } });
      await tab.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: fr.x + 20 + (i % 5), y: fr.y + 20, button: 'none', buttons: 0 });
      await new Promise(r => setTimeout(r, 250));
    }
    await tab.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false });
    return win;
  };
  // (asked just after the page is rebuilt, the old page may be the one asked: again, once the new one is up)
  const whereSoon = async (line) => { for (let i = 0; ; i++) { try { return await where(line); } catch (e) { if (i >= 4) throw e; await new Promise(r => setTimeout(r, 300)); } } };
  // (a drag waits for the page the Preview was last given to be the one up: pressed while it's rebuilt, nothing moves)
  const loaded = () => until('window.__icLoaded === document.getElementById("preview").getAttribute("srcdoc")', 'the Preview\'s page to load');
  const drag = async (line, dx, dy) => {
    await loaded();
    const f = await frame(), at = await whereSoon(line), x = f.x + at.x + at.w / 2, y = f.y + at.y + at.h / 2;
    await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } });
    await mouse('mouseMoved', x, y); await new Promise(r => setTimeout(r, 150));
    await mouse('mousePressed', x, y);
    for (let i = 1; i <= 8; i++) await mouse('mouseMoved', x + dx * i / 8, y + dy * i / 8, true);
    await tab.run('document.getElementById("editBar").dataset.was = document.getElementById("editBar").textContent');
    await mouse('mouseReleased', x + dx, y + dy);
    await until('document.getElementById("editBar").textContent !== document.getElementById("editBar").dataset.was', 'the move');
    return { bar: await tab.run('document.getElementById("editBar").textContent'), bad: await tab.run('document.getElementById("editBar").classList.contains("bad")') };
  };
  // the handle: onto the part (twice: the first move after a rebuild is how Chrome without a window finds it's there),
  // onto its bottom right corner, pressed, moved in steps, let go
  // (with Alt, the group it's in: a window whose corner a part fills)
  const resize = async (line, dw, dh, alt) => {
    await loaded();
    const f = await frame(), at = await whereSoon(line), x = f.x + at.x + at.w - 3, y = f.y + at.y + at.h - 3;
    await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } });
    await mouse('mouseMoved', f.x + at.x + at.w / 2, f.y + at.y + at.h / 2, false, alt); await new Promise(r => setTimeout(r, 150));
    await mouse('mouseMoved', f.x + at.x + at.w / 2 + 2, f.y + at.y + at.h / 2 + 1, false, alt); await new Promise(r => setTimeout(r, 100));
    await mouse('mouseMoved', x, y, false, alt); await new Promise(r => setTimeout(r, 100));
    await mouse('mousePressed', x, y, false, alt);
    for (let i = 1; i <= 8; i++) await mouse('mouseMoved', x + dw * i / 8, y + dh * i / 8, true, alt);
    await tab.run('document.getElementById("editBar").dataset.was = document.getElementById("editBar").textContent');
    await mouse('mouseReleased', x + dw, y + dh, false, alt);
    await until('document.getElementById("editBar").textContent !== document.getElementById("editBar").dataset.was', 'the size');
    return { at, bar: await tab.run('document.getElementById("editBar").textContent'), bad: await tab.run('document.getElementById("editBar").classList.contains("bad")') };
  };
  const code = () => tab.run('document.getElementById("uTa").value');
  // an app, imported as a folder of one file: it opens on its window's estimate in the Preview
  const importTk = async (code = TK, file = 'tk_app.py') => {
    await tab.run(`(() => { const f = document.getElementById('preview'); f.addEventListener('load', () => { window.__icLoaded = f.getAttribute('srcdoc'); }); return true; })()`);
    await tab.run('(() => { const w = document.getElementById("welcomeModal"); if (!w.hidden) document.getElementById("welcomeLook").click(); return true; })()');
    await tab.run(`(() => {
      const f = new File([${JSON.stringify(code)}], ${JSON.stringify(file)}); Object.defineProperty(f, 'webkitRelativePath', { value: 'tasks/' + ${JSON.stringify(file)} });
      const inp = document.getElementById('impFolder'); Object.defineProperty(inp, 'files', { value: [f], configurable: true }); inp.dispatchEvent(new Event('change'));
      return true;
    })()`);
    await until('/Imported tasks/.test(document.getElementById("termLog").innerText)', 'the import to finish');
    // opened, it shows its window's estimate in the Preview (as a website shows its page)
    await until('!document.getElementById("tabPreview").hidden && document.getElementById("tabPreview").getAttribute("aria-selected") === "true"', 'the Preview (a window is read from the code)');
    // (the estimate's page, not the page the Preview showed before)
    await until('(document.getElementById("preview").getAttribute("srcdoc") || "").includes("An estimate of the app")', 'the estimate in the Preview');
  };
  return { until, where, frame, mouse, sized, drag, resize, code, importTk };
}

test('gui: in the page, an imported tkinter app shows its window in the Preview, and Editor mode moves a part in its code', { skip: !findChrome() && 'no Chrome or Edge' }, async () => {
  const browser = await openBrowser();
  try {
    const tab = await browser.tab();
    await tab.open(ORIGIN + '/', { serve: serveApp });
    await tab.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false });
    const { until, where, frame, mouse, sized, drag, resize, code, importTk } = drive(tab);
    await until('document.getElementById("btnEditor") && document.getElementById("ta")', 'the app');
    await importTk();
    assert.equal(await tab.run('document.getElementById("btnEditor").hidden'), false);
    assert.equal(await tab.run('document.getElementById("btnMeasure").hidden'), true, 'measuring runs the app, which the desktop app does');
    const index = (name) => tab.run(`IntuiGui.flat(IntuiGui.estimate([{ path: 'tk_app.py', code: ${JSON.stringify(TK)} }]).windows[0]).findIndex(x => x.node.name === ${JSON.stringify(name)})`);
    const statusAt = await index('status'), tasksAt = await index('tasks');
    // its window, the first part, is 360 × 300
    const win = await sized(360, 300);
    assert.deepEqual([win && win.w, win && win.h], [360, 300], 'the window, at its geometry("360x300"): ' + JSON.stringify(win) + ' ' + await tab.run('JSON.stringify({ wrap: document.getElementById("previewWrap").hidden, sel: document.getElementById("tabPreview").getAttribute("aria-selected"), shut: document.getElementById("work").className, frame: document.getElementById("preview").getBoundingClientRect().toJSON(), log: document.getElementById("termLog").innerText.slice(-200) })'));
    const s0 = await where(statusAt), t0 = await where(tasksAt);
    assert.deepEqual([t0.w, t0.h], [344, 258], 'the list as Tk lays it out');
    assert.deepEqual([s0.x - t0.x, s0.y - t0.y], [4, 228], 'the label where place() puts it, in the same window');

    // Editor mode: the code and the estimate side by side
    await tab.run('document.getElementById("btnEditor").click()');
    assert.match(await tab.run('document.getElementById("editBar").textContent'), /^Drag a part of the window to move it, or its corner to resize it\./);
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
    await tab.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 });
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 });
    assert.equal((await code()).split('\n')[20], 'status.place(x=12, y=270)');
    await until('/id="status" title="[^"]*" style="left:12px;top:270px/.test(document.getElementById("preview").getAttribute("srcdoc") || "")', 'the label back in the estimate');
    // the list (pack) isn't at a position: it says why, and the code stays as it is
    const before = await code();
    m = await drag(tasksAt, 20, 20);
    assert.equal(m.bad, true);
    assert.match(m.bar, /^tasks: pack\(\) places things one after another/);
    assert.equal(await code(), before);
    // the label's corner: its size in its place() line, read back as that size
    const s1 = await where(statusAt);
    m = await resize(statusAt, 18, 9);
    assert.equal(m.bad, false, m.bar);
    assert.match(m.bar, new RegExp(`^Resized status to ${s1.w + 18} × ${s1.h + 9}, and the code makes it so\\. Written in tk_app\\.py line 21`));
    assert.equal((await code()).split('\n')[20], `status.place(x=12, y=270, width=${s1.w + 18}, height=${s1.h + 9})`);
    // the window's corner (the list fills it there: Alt, the group it's in, is the window): its geometry
    m = await resize(tasksAt, 40, 20, true);   // (from the list's corner, 8 inside the window's: the window grows by as much)
    assert.equal(m.bad, false, m.bar);
    assert.match(m.bar, /^Resized window to 400 × 320, and the code makes it so\./);
    assert.equal((await code()).split('\n')[9], 'window.geometry("400x320")');
    // the list (pack): its size is pack's, and it says so
    m = await resize(tasksAt, 20, 20);
    assert.equal(m.bad, true);
    assert.match(m.bar, /^tasks: pack\(\) gives it the size it asks for/);
    await tab.close();
  } finally { await browser.close(); }
});

/* ---------- Measure: the running app's own report (a probe's), drawn as the app is ---------- */
const QT_APP = readFileSync(path.join(ROOT, 'tests/fixtures/gui/qt_app.py'), 'utf8');
const QT_REPORT = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/gui/qt-layout.json'), 'utf8'));
// (a picture, as the Qt probe sends one: a pixel)
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// this file's app (TK), as the tkinter probe measured it (Tk 8.6, Windows)
const REPORT = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/tk-layout.json'), 'utf8'));

test('gui: a measurement puts each part where the running app put it, linked to its code; one the code places with numbers still moves', () => {
  const files = [{ path: 'tk_app.py', code: TK }], est = G.estimate(files), view = G.measured(REPORT, est);
  assert.equal(view.measured, true);
  const w = view.windows[0];
  assert.deepEqual([w.title, w.w, w.h, w.toolkit], ['Tasks', 360, 300, 'tkinter']);
  assert.deepEqual(plain(parts(w)), {
    window: [0, 0, 360, 300, 'measured'], top: [8, 8, 344, 26, 'measured'], entry: [12, 11, 184, 19, 'measured'],
    add: [200, 8, 33, 26, 'measured'], tasks: [8, 42, 344, 258, 'measured'], status: [12, 270, 41, 21, 'measured'] }, 'the one not shown (lost) isn\'t there');
  assert.deepEqual(plain(view.notes), ['lost (Button) is made but not shown in the running app.']);
  // the estimate's sizes come from this measurement: within a pixel of it
  for (const { node: e } of G.flat(est.windows[0])) {
    const m = find(w, e.name).node;
    assert.ok([0, 1, 2, 3].every(i => Math.abs([e.x, e.y, e.w, e.h][i] - [m.x, m.y, m.w, m.h][i]) <= 1), `${e.name}: estimated ${[e.x, e.y, e.w, e.h]}, measured ${[m.x, m.y, m.w, m.h]}`);
    // and each part is linked to its code, as the estimate links it (so its code lights up)
    assert.deepEqual(plain(m.src), plain(e.src), e.name);
  }
  // moved, a part is the code's part it stands for: place() with numbers, its new numbers
  const code = (n) => G.flat(est.windows[0]).find(x => x.node.id === n.eid), s = code(find(w, 'status').node);
  assert.equal(G.move(files, s.node, 30, -10, s.parent).text, 'status.place(x=42, y=260)');
  // pack: where it is was measured, how it got there is pack's (it says so, and nothing is written)
  const t = code(find(w, 'tasks').node);
  assert.match(G.move(files, t.node, 20, 20, t.parent).why, /^pack\(\) places things one after another/);
  assert.match(find(w, 'tasks').node.why, /laid out by rules/, 'in its tip');
  assert.equal(code(w.root).node.kind, 'window');
  // a part the code read here doesn't make: measured, and said so
  const more = JSON.parse(JSON.stringify(REPORT));
  more.windows[0].root.children.push({ type: 'Canvas', name: null, id: '.!canvas', text: '', x: 0, y: 0, w: 50, h: 50, shown: true, children: [] });
  const c = G.flat(G.measured(more, est).windows[0]).find(x => x.node.type === 'Canvas').node;
  assert.deepEqual([c.how, c.place, c.src.length], ['measured', 'none', 0]);
  assert.match(c.why, /doesn't say where it's made/);
  // the report, in what the probe printed (after whatever the program printed), and what isn't one
  assert.deepEqual(plain(G.reportIn('Loading…\n' + G.MARK + JSON.stringify(REPORT) + G.MARK + '\n')), REPORT);
  assert.equal(G.reportIn('Loading…\n'), null);
  assert.equal(G.reportIn(G.MARK + '{not json' + G.MARK), null);
  assert.equal(G.measured({ windows: [] }, est), null, 'not a report');
  assert.match(G.TK_PROBE, /INTUACODE-LAYOUT/);
  assert.match(G.JUCE_PROBE, /namespace intuacode[\s\S]*inline void probeLayoutSoon\(/);
});

test('gui: a JUCE app\'s report (IntuaCodeProbe.h): its classes matched to the code\'s parts, several made in a loop to the one that makes them', () => {
  const files = [{ path: 'PluginEditor.h', code: JUCE_H }, { path: 'PluginEditor.cpp', code: JUCE_CPP }], est = G.estimate(files);
  // as the probe writes it, its classes as the compiler names them; JUCE components have no names unless given one
  const part = (type, x, y, w, h, more = {}) => ({ type, name: '', id: '', text: '', x, y, w, h, shown: true, children: [], ...more });
  const report = { intuacode: 'layout', version: 1, toolkit: 'JUCE', made: '2026-11-19T10:00:00.000Z', windows: [{ title: 'Gain', w: 400, h: 300, picture: 'intuacode-layout-0.png',
    root: part('GainEditor', 0, 0, 400, 300, { children: [
      part('juce::Slider', 20, 60, 120, 120), part('juce::TextButton', 150, 267, 100, 26, { text: 'Bypass' }), part('juce::Label', 10, 8, 380, 24, { text: 'Gain' }),
      part('MeterStrip', 320, 40, 80, 260, { children: [part('juce::Slider', 324, 44, 72, 232), part('juce::Label', 324, 276, 72, 20)] }),
      part('juce::ComboBox', 8, 52, 140, 24),
      ...[0, 1, 2, 3].map(i => part('juce::ToggleButton', 156 + i * 56, 52, 52, 24, { text: `Band ${i + 1}` })),
    ] }) }] };
  const view = G.measured(report, est), w = view.windows[0], p = plain(parts(w));
  assert.deepEqual([w.title, w.w, w.h, w.picture, view.toolkits[0]], ['Gain', 400, 300, 'intuacode-layout-0.png', 'JUCE']);
  assert.deepEqual(p.gain, [20, 60, 120, 120, 'measured']);
  assert.deepEqual(p.bypass, [150, 267, 100, 26, 'measured'], 'where it really is (the estimate had 110)');
  assert.deepEqual(p.level, [324, 44, 72, 232, 'measured'], 'inside the meter');
  assert.equal(find(w, 'title').node.label, 'Gain');
  // the four band buttons: each where it is, each linked to the code that makes them
  const bands = G.flat(w).filter(x => x.node.name === 'bands').map(x => x.node);
  assert.deepEqual(plain(bands.map(b => [b.id, b.x, b.label])), [['bands', 156, 'Band 1'], ['bands-2', 212, 'Band 2'], ['bands-3', 268, 'Band 3'], ['bands-4', 324, 'Band 4']]);
  assert.ok(bands.every(b => b.src.length && b.src === bands[0].src));
  // moved, it's the code's part: setBounds with numbers moves; the rest says why not
  const code = (n) => G.flat(est.windows[0]).find(x => x.node.id === n.eid), g = code(find(w, 'gain').node);
  assert.deepEqual(plain(G.move(files, g.node, 15, -5, g.parent)), { path: 'PluginEditor.cpp', line: 32, text: '    gain.setBounds(35, 55, 120, 120);', x: 35, y: 55 });
  assert.match(G.move(files, code(find(w, 'mode').node).node, 5, 5).why, /^Its place is worked out in resized\(\)/);
  // a window is matched by its class when its title isn't the code's (a JUCE window's title is its name), whatever else
  // is on the screen before it
  const popup = { title: 'Tip', w: 120, h: 30, root: part('juce::TooltipWindow', 0, 0, 120, 30) };
  const two = G.measured({ ...report, windows: [popup, ...report.windows] }, est);
  assert.deepEqual(plain(two.windows.map(x => [x.title, x.root.src.length > 0])), [['Tip', false], ['Gain', true]]);
  assert.ok(find(two.windows[1], 'gain').node.src.length, 'its parts linked to their code');
  assert.match(G.JUCE_PROBE, /inline bool quitsAfterMeasuring\(\)/, 'a run only to be measured says so');
});

// a Python with Tk that can open a window here (CI's Linux tests have no screen)
const TK_UP = (() => { try { return spawnSync(PYTHON, ['-c', 'import tkinter; tkinter.Tk().destroy()'], { timeout: 20000 }).status === 0; } catch (e) { return false; } })();
test('gui: the tkinter probe runs the app out of sight and says where Tk put each part, by the program\'s own names', { skip: !TK_UP && 'no Python with Tk and a screen' }, () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'intuicode-probe-'));
  try {
    writeFileSync(path.join(dir, 'tk_app.py'), TK);
    writeFileSync(path.join(dir, 'probe_tk.py'), G.TK_PROBE);
    writeFileSync(path.join(dir, 'no_window.py'), 'print("no window here")\n');
    const run = (file) => spawnSync(PYTHON, ['-u', 'probe_tk.py', file], { cwd: dir, encoding: 'utf8', timeout: 40000 });
    const r = run('tk_app.py'), report = G.reportIn(r.stdout);
    assert.ok(report, `no report (${r.status}): ${r.stdout} ${r.stderr}`);
    assert.deepEqual(plain([report.intuacode, report.version, report.toolkit, report.windows.length]), ['layout', 1, 'tkinter', 1]);
    const w = report.windows[0], kids = Object.fromEntries(w.root.children.map(c => [c.name, c]));
    assert.deepEqual([w.title, w.w, w.h, w.root.name], ['Tasks', 360, 300, 'window']);
    assert.deepEqual(Object.keys(kids), ['top', 'tasks', 'status', 'lost']);
    assert.deepEqual(plain(kids.top.children.map(c => c.name)), ['entry', 'add']);
    // what the code settles, whatever the fonts: pack's padding and fill, place's numbers
    assert.deepEqual([kids.top.x, kids.top.y, kids.top.w], [8, 8, 344]);
    assert.deepEqual([kids.tasks.x, kids.tasks.w, kids.tasks.y + kids.tasks.h], [8, 344, 300]);
    assert.deepEqual([kids.status.x, kids.status.y, kids.status.text], [12, 270, '0 tasks']);
    assert.equal(kids.lost.shown, false);
    // drawn, every part is linked to its code
    const view = G.measured(report, G.estimate([{ path: 'tk_app.py', code: TK }]));
    for (const { node } of G.flat(view.windows[0])) assert.ok(node.src.length, `${node.name} is linked to its code`);
    // a program that opens no window says so
    const none = G.reportIn(run('no_window.py').stdout);
    assert.deepEqual([none.windows.length, none.note], [0, 'The program ended without opening a window (no mainloop).']);
    // one that hangs before its window shows, holding Python's lock, is ended all the same, saying where it was
    writeFileSync(path.join(dir, 'spin.py'), 'import tkinter as tk\nw = tk.Tk()\nn = 0\nwhile True:\n    n += 1\n');
    const t0 = Date.now(), spun = spawnSync(PYTHON, ['-u', 'probe_tk.py', 'spin.py'], { cwd: dir, encoding: 'utf8', timeout: 40000, env: { ...process.env, INTUACODE_PROBE_TIMEOUT: '2' } });
    assert.notEqual(spun.status, 0, spun.stderr);   // (ended: what it says counts, not its exit code, which Windows can make another)
    assert.ok(Date.now() - t0 < 15000, 'ended after its 2 seconds');
    assert.match(spun.stderr, /^Timeout \(0:00:02\)!/m);
    assert.match(spun.stderr, /File "spin\.py", line [45] in <module>/, 'in the loop: on whichever of its two lines it was');
  } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); }
});

/* The desktop app's page with a pretend desktop layer (tests/desktop-mock.html): Measure runs the probe there, and what
   it prints is the pretend run's (tests/e2e/run.mjs measures with the real one, and Python). */
function serveMock(req) {
  const url = new URL(req.url);
  if (url.origin === ORIGIN && url.pathname === '/index.html' && url.search === '?raw') return { type: 'text/html', body: readFileSync(path.join(ROOT, 'index.html'), 'utf8') };
  return serveApp(req);
}
test('gui: with the desktop layer, Measure runs the probe, and the Preview shows the app as measured, through a move, until the code changes', { skip: !findChrome() && 'no Chrome or Edge' }, async () => {
  const browser = await openBrowser();
  try {
    const tab = await browser.tab();
    await tab.open(ORIGIN + '/tests/desktop-mock.html', { serve: serveMock });
    await tab.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false });
    const { until, sized, drag, resize, code, importTk } = drive(tab);
    await until('document.getElementById("btnEditor") && document.getElementById("ta") && document.documentElement.classList.contains("desktop")', 'the app, as the desktop app');
    await importTk();
    await until('!document.getElementById("btnMeasure").hidden', 'Measure, beside the Preview');
    const page = () => tab.run('document.getElementById("preview").getAttribute("srcdoc") || ""');
    // a program the probe had to end (it didn't open its window in time): where it was, said
    await tab.run(`(() => { window.mock.capture = { code: 1, out: '', err: 'Timeout (0:00:25)!\\nThread 0x1 (most recent call first):\\n  File "C:\\\\Users\\\\me\\\\tasks\\\\tk_app.py", line 7 in load\\n  File "tk_app.py", line 20 in <module>\\n  File "<frozen runpy>", line 88 in _run_code\\n  File "/x/.intuicode/probe_tk.py", line 85 in <module>\\n' }; return true; })()`);
    await tab.run('(() => { document.getElementById("btnMeasure").click(); return true; })()');
    await until('/^The app didn\'t open its window/.test(document.getElementById("editBar").textContent)', 'what Measure says of a program it ended');
    assert.match(await tab.run('document.getElementById("editBar").textContent'), /^The app didn't open its window within 25 seconds, so it was ended; it was at tk_app\.py line 7\.Close$/);
    assert.equal(await tab.run('document.getElementById("editBar").classList.contains("bad")'), true);
    // what the probe prints, run: this app as Tk measured it (after what the program printed)
    await tab.run(`(() => { window.mock.capture = { code: 0, out: 'Loading tasks\\n' + ${JSON.stringify(G.MARK + JSON.stringify(REPORT) + G.MARK)} + '\\n', err: '', after: 3000 }; return true; })()`);
    // (what the bar says meanwhile: a run takes a while, as the real one does)
    await tab.run(`(() => { const b = document.getElementById('editBar'); window.__bar = []; new MutationObserver(() => window.__bar.push((b.hidden ? 'hidden: ' : '') + b.textContent.slice(0, 40))).observe(b, { attributes: true, childList: true, subtree: true, characterData: true }); return true; })()`);
    await tab.run('(() => { document.getElementById("btnMeasure").click(); return true; })()');
    await until('/^Measured in the running app/.test(document.getElementById("editBar").textContent)', 'the measurement', 100);
    const bars = JSON.parse(await tab.run('JSON.stringify(window.__bar)'));
    assert.match(bars[0], /^Running tk_app\.py for a moment/);
    assert.ok(!bars.some(b => b.startsWith('hidden')), 'the bar stays while it runs: ' + JSON.stringify(bars));
    assert.match(await tab.run('document.getElementById("editBar").textContent'), /^Measured in the running app at .+: 5 parts, each where the app really puts it\. It shows until the code changes\.Close$/);
    // how: the project's files and the probe (in IntuaCode's own folder there), then Python on the probe and the program
    const calls = JSON.parse(await tab.run('JSON.stringify(window.mock.calls.filter(c => c[0] === "run_capture" || c[0] === "write_text"))'));
    const ran = calls.find(c => c[0] === 'run_capture')[1];
    assert.deepEqual([ran.program, plain(ran.args)], ['python3', ['-u', ran.cwd + '/.intuicode/probe_tk.py', 'tk_app.py']]);
    assert.equal(calls.find(c => c[0] === 'write_text' && c[1].path === ran.cwd + '/.intuicode/probe_tk.py')[1].content, G.TK_PROBE);
    assert.match(calls.find(c => c[0] === 'write_text' && c[1].path === ran.cwd + '/tk_app.py')[1].content, /status\.place\(x=12, y=270\)/);
    // the Preview: the window as measured, each part where Tk put it (in its group), the one not shown not there
    await until('(document.getElementById("preview").getAttribute("srcdoc") || "").includes("Measured in the running app at")', 'the measured window in the Preview');
    assert.match(await page(), /id="status" title="[^"]*" style="left:12px;top:270px;width:41px;height:21px"/);
    assert.match(await page(), /id="entry" title="[^"]*" style="left:4px;top:3px;width:184px;height:19px"/, 'in its frame: 12 − 8, 11 − 8');
    assert.doesNotMatch(await page(), /id="lost"/);

    // Editor mode: the label, placed by numbers, moves in its code, and the measurement holds for the code it's moved to
    const at = (name) => tab.run(`IntuiGui.flat(IntuiGui.measured(${JSON.stringify(REPORT)}, IntuiGui.estimate([{ path: 'tk_app.py', code: ${JSON.stringify(TK)} }])).windows[0]).findIndex(x => x.node.name === ${JSON.stringify(name)})`);
    const statusAt = await at('status'), tasksAt = await at('tasks');
    await tab.run('document.getElementById("btnEditor").click()');
    const win = await sized(360, 300);
    assert.deepEqual([win && win.w, win && win.h], [360, 300], 'the measured window: ' + JSON.stringify(win));
    let m = await drag(statusAt, 30, -10);
    assert.equal(m.bad, false, m.bar);
    assert.match(m.bar, /^Moved status 30 right and 10 up, and the code puts it there\./);
    assert.equal((await code()).split('\n')[20], 'status.place(x=42, y=260)');
    await until('/id="status" title="[^"]*" style="left:42px;top:260px;width:41px;height:21px"/.test(document.getElementById("preview").getAttribute("srcdoc") || "")', 'the measured label, moved as far');
    assert.match(await page(), /Measured in the running app at/);
    // Ctrl+Z: the code it measured, as measured
    await tab.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 });
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 });
    assert.equal((await code()).split('\n')[20], 'status.place(x=12, y=270)');
    await until('/id="status" title="[^"]*" style="left:12px;top:270px;width:41px;height:21px"/.test(document.getElementById("preview").getAttribute("srcdoc") || "")', 'the label back where it was measured');
    assert.match(await page(), /Measured in the running app at/);
    // the list: where it is was measured, but pack lays it out (it says so, and nothing is written)
    const before = await code();
    m = await drag(tasksAt, 20, 20);
    assert.equal(m.bad, true);
    assert.match(m.bar, /^tasks: pack\(\) places things one after another/);
    assert.equal(await code(), before);
    // the label's corner, measured 41 × 21: its size in the code, and the measurement holds at that size
    m = await resize(statusAt, 18, 9);
    assert.equal(m.bad, false, m.bar);
    assert.match(m.bar, /^Resized status to 59 × 30, and the code makes it so\./);
    assert.equal((await code()).split('\n')[20], 'status.place(x=12, y=270, width=59, height=30)');
    await until('/id="status" title="[^"]*" style="left:12px;top:270px;width:59px;height:30px"/.test(document.getElementById("preview").getAttribute("srcdoc") || "")', 'the measured label, at its new size');
    assert.match(await page(), /Measured in the running app at/);
    // the code changes: the estimate again, saying the measurement is older than the code
    await tab.run(`(() => { const ta = document.getElementById('uTa'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); document.execCommand('insertText', false, 'print("done")\\n'); return true; })()`);
    await until('(document.getElementById("preview").getAttribute("srcdoc") || "").includes("is older than the code: Measure again")', 'the estimate, saying the measurement is older', 300);
    assert.match(await page(), /An estimate of the app's window, read from its code/);
    await tab.close();
  } finally { await browser.close(); }
});

test('gui: with the desktop layer, Measure on a PySide app runs the Qt probe, and draws the window with its picture', { skip: !findChrome() && 'no Chrome or Edge' }, async () => {
  const browser = await openBrowser();
  try {
    const tab = await browser.tab();
    await tab.open(ORIGIN + '/tests/desktop-mock.html', { serve: serveMock });
    await tab.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false });
    const { until, importTk } = drive(tab);
    await until('document.getElementById("btnEditor") && document.getElementById("ta") && document.documentElement.classList.contains("desktop")', 'the app, as the desktop app');
    await importTk(QT_APP, 'qt_app.py');
    await until('!document.getElementById("btnMeasure").hidden', 'Measure, beside the Preview');
    const rep = { ...QT_REPORT, windows: QT_REPORT.windows.map(w => ({ ...w, pictureData: PIXEL })) };
    await tab.run(`(() => { window.mock.capture = { code: 0, out: ${JSON.stringify(G.MARK + JSON.stringify(rep) + G.MARK)} + '\\n', err: '', after: 500 }; return true; })()`);
    await tab.run('(() => { document.getElementById("btnMeasure").click(); return true; })()');
    await until('/^Measured in the running app/.test(document.getElementById("editBar").textContent)', 'the measurement', 100);
    // the Qt probe, run with the program
    const ran = JSON.parse(await tab.run('JSON.stringify(window.mock.calls.filter(c => c[0] === "run_capture").pop()[1])'));
    assert.deepEqual(plain(ran.args), ['-u', ran.cwd + '/.intuicode/probe_qt.py', 'qt_app.py']);
    const wrote = JSON.parse(await tab.run('JSON.stringify(window.mock.calls.find(c => c[0] === "write_text" && /probe_qt\\.py$/.test(c[1].path))[1])'));
    assert.equal(wrote.content, G.QT_PY_PROBE);
    // drawn as measured, over its picture
    await until('(document.getElementById("preview").getAttribute("srcdoc") || "").includes("Measured in the running app at")', 'the measured window');
    const page = await tab.run('document.getElementById("preview").getAttribute("srcdoc")');
    assert.match(page, /\(PySide6\)/);
    assert.match(page, /background-image:url\(data:image\/png;base64,iVBOR/);
    assert.match(page, /id="status" title="[^"]*" style="left:12px;top:270px;width:100px;height:30px"/);
    await tab.close();
  } finally { await browser.close(); }
});

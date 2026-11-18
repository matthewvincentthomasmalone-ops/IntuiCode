// Customise (lang/look.js, Menu → Customise): IntuaCode's look laid out as very simple code. Only the seafoam values
// change; each is checked in plain words and used at once; the pink ones are fixed. The engine is checked here in Node,
// and the window itself in the real page, in Chrome when there is one (the browser version; tests/e2e/run.mjs drives
// it in the desktop app).
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
for (const f of ['lang/values.js', 'lang/look.js']) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const LOOK = ctx.IntuiLook;
const plain = (x) => JSON.parse(JSON.stringify(x));
const D = plain(LOOK.DEFAULTS);
const KEYS = plain(LOOK.SETTINGS.map(s => s.key));
const ok = (key, text, values = D, env) => { const r = LOOK.check(key, text, values, env); assert.ok(r.ok, `${key} = ${text}: ${r.problem}`); return r.value; };
const no = (key, text, values = D, env) => { const r = LOOK.check(key, text, values, env); assert.equal(r.ok, false, `${key} = ${text} should be refused`); return r.problem; };

test('look: a short list of settings, every default right as it is', () => {
  assert.deepEqual(KEYS, ['accent', 'text', 'font', 'barAt', 'sideOn', 'helpOn', 'editorFont', 'editorSize', 'background', 'highlight',
    'codeFont', 'codeSize', 'words', 'quotes', 'numbers', 'glow']);
  for (const s of LOOK.SETTINGS) assert.equal(ok(s.key, s.def), s.def, `${s.key}'s default`);
  assert.deepEqual(plain(LOOK.checked({})), D);
  assert.deepEqual(plain(LOOK.styleOf(D)), { vars: {}, classes: [] }, 'the defaults change nothing on the page');
});

test('look: the window reads as code: blocks of plain lines, the values seafoam (yours) or pink (fixed)', () => {
  const text = LOOK.text(D, { version: '0.8.0' });
  assert.match(text, /^-- IntuaCode's look, written as code\./);
  assert.ok(text.includes('IntuaCode {\n  Version = 0.8.0\n  Look = dark\n  Accent colour = #E8AABA  -- links and outlines\n'));
  assert.ok(text.includes('Editor {  -- Unity, and the sentences in Split Mode\n  Font style = "Atkinson Hyperlegible Mono"  -- fixed-width fonts only\n  Text size = 14.5  -- 12 to 20\n'));
  assert.ok(text.includes('Project side {\n  Sits on = left  -- left or right\n  Width = 256\n}'));
  assert.ok(text.includes('Terminal {\n  Sits at = bottom\n  Glow colour = #A9F3C7  -- the terminal, and the word Run\n  Prompt = "❯"\n}'));
  const lines = plain(LOOK.lines(D, {}));
  // every block opens and closes; every setting is on exactly one line, under its own block
  assert.equal(lines.filter(l => l.t === 'open').length, lines.filter(l => l.t === 'close').length);
  assert.deepEqual(lines.filter(l => l.t === 'set').map(l => l.key), KEYS);
  for (const l of lines.filter(l => l.t === 'set')) assert.equal(l.block, LOOK.SETTINGS.find(s => s.key === l.key).block);
  // the pink lines, each with why it's fixed
  const fixed = lines.filter(l => l.t === 'fixed');
  assert.deepEqual(fixed.map(l => `${l.block}: ${l.name} = ${l.value}`), ['IntuaCode: Version = …', 'IntuaCode: Look = dark', 'Menu bar: Buttons = Menu, Help, Run',
    'Project side: Width = 256', 'Editor: Sentence parts = green', 'Terminal: Sits at = bottom', 'Terminal: Prompt = "❯"']);
  for (const l of fixed) assert.ok(l.why && l.why.endsWith('.'), `${l.name} says why it's fixed`);
  // a value changed shows in the window as it was written
  assert.ok(LOOK.text({ ...D, accent: 'skyblue', editorSize: '17' }).includes('  Accent colour = skyblue  -- links and outlines\n'));
});

test('look: colours by code or by name, each checked where it goes, and said in words when it can\'t be used', () => {
  assert.equal(ok('accent', 'skyblue'), 'skyblue');
  assert.equal(ok('accent', '#87CEEB'), '#87CEEB');
  assert.equal(ok('accent', '#fc0'), '#fc0');
  assert.equal(LOOK.toHex('#fc0'), '#ffcc00');
  assert.equal(LOOK.toHex('Sky Blue'), '#87ceeb');
  assert.equal(LOOK.toHex('amber'), '#ffb000', 'a few names of IntuaCode\'s own');
  assert.equal(ok('glow', 'amber'), 'amber');
  assert.equal(no('accent', 'blurple'), '"blurple" isn\'t a colour IntuaCode knows. Write a code like #9FE2BF, or a name like skyblue.');
  assert.match(no('accent', ''), /^Write a colour/);
  assert.match(no('accent', '#12345'), /isn't a colour IntuaCode knows/);
  assert.match(no('accent', 'rgb(1, 2, 3)'), /isn't a colour IntuaCode knows/, 'codes and names only: nothing to slip CSS through');
  // readable where it goes: IntuaCode's look is dark
  assert.equal(no('accent', '#202020'), 'Too dark to see on IntuaCode\'s dark background. Try a lighter colour.');
  assert.equal(no('text', 'grey'), 'Too dark to read on IntuaCode\'s dark background. Try a lighter colour.');
  assert.equal(ok('text', 'wheat'), 'wheat');
  assert.equal(no('words', 'navy'), 'Too dark to read on the editor\'s background. Try a lighter colour.');
  assert.equal(no('highlight', '#111111'), 'Too dark: what you select wouldn\'t show on the background. Try a lighter colour.');
  assert.equal(no('glow', '#106020'), 'Too dark to read on the terminal\'s black screen. Try a lighter colour.');
  // the background must stay dark enough for everything on it, and says which would suffer
  assert.equal(no('background', 'white'), 'Too light: the notes (the grey comments) wouldn\'t be readable on it. IntuaCode\'s look is dark, so the background must be dark too.');
  assert.equal(ok('background', '#101828'), '#101828', 'a dark blue');
  assert.match(no('background', '#141414', { ...D, words: '#7c7c7c' }), /the words wouldn't be readable/, 'a dimmer words colour asks for a darker background');
  assert.equal(ok('words', '#7c7c7c'), '#7c7c7c');
  assert.match(no('words', '#7c7c7c', { ...D, background: '#141414' }), /Too dark to read on the editor/, 'readable on the usual background, not on that one');
});

test('look: fonts by name; the editors only take fixed-width ones; a font not on this computer is said', () => {
  const env = { fontInstalled: (n) => ['Consolas', 'Georgia', 'Arial'].includes(n), fixedWidth: (n) => n === 'Consolas' };
  assert.equal(ok('font', 'Georgia', D, env), 'Georgia');
  assert.equal(ok('font', '"Georgia"', D, env), 'Georgia', 'quotes are the window\'s, not the name\'s');
  assert.equal(ok('codeFont', 'Consolas', D, env), 'Consolas');
  assert.equal(ok('editorFont', 'IBM Plex Mono', D, { fontInstalled: () => false }), 'IBM Plex Mono', 'the fonts IntuaCode brings are always there');
  assert.equal(ok('codeFont', 'monospace', D, env), 'monospace');
  assert.equal(no('font', 'Comic Neue', D, env), '"Comic Neue" isn\'t a font on this computer.');
  assert.match(no('codeFont', 'Arial', D, env), /^"Arial" isn't fixed-width\. In the editor every letter must be as wide as the others/);
  assert.match(no('editorFont', 'Atkinson Hyperlegible Next', D, env), /isn't fixed-width/, 'IntuaCode\'s own menu font is not for the editor');
  assert.match(no('font', '', D, env), /^Write a font's name/);
  assert.match(no('font', 'Evil"; } body { x', D, env), /^A font's name is letters, numbers and spaces/);
  assert.equal(ok('font', 'Segoe UI'), 'Segoe UI', 'with nothing to ask, any well-formed name');
});

test('look: sizes in a range, and where three parts sit', () => {
  assert.equal(ok('editorSize', '16'), '16');
  assert.equal(ok('editorSize', '17.25px'), '17.3');
  assert.equal(no('editorSize', '40'), 'Text size goes from 12 to 20.');
  assert.equal(no('codeSize', '9'), 'Text size goes from 11 to 20.');
  assert.equal(no('editorSize', 'big'), 'Write a number, like 14.5.');
  assert.equal(ok('sideOn', ' Right '), 'right');
  assert.equal(ok('barAt', 'bottom'), 'bottom');
  assert.equal(no('sideOn', 'middle'), 'Sits on can be left or right.');
  assert.equal(no('barAt', 'left'), 'Sits at can be top or bottom.');
  assert.equal(no('helpOn', 'top'), 'Sits on can be right or left.');
  assert.match(LOOK.check('nope', 'x', D).problem, /no such setting/);
});

test('look: what\'s stored is only what changed, and is checked again when it\'s read back', () => {
  const mine = { ...D, accent: 'skyblue', sideOn: 'right', editorSize: '17' };
  assert.deepEqual(plain(LOOK.stored(mine)), { accent: 'skyblue', sideOn: 'right', editorSize: '17' });
  assert.deepEqual(plain(LOOK.checked(LOOK.stored(mine))), plain(mine));
  // anything not right now is left out, the rest kept
  const back = plain(LOOK.checked({ accent: 'blurple', sideOn: 'right', editorSize: '99', glow: 'amber', made: 'up', text: 5, font: 'x'.repeat(200) }));
  assert.deepEqual(plain(LOOK.stored(back)), { sideOn: 'right', glow: 'amber' });
  for (const junk of [null, 'text', [1, 2], 42]) assert.deepEqual(plain(LOOK.checked(junk)), D);
  // the background first, then the colours on it: a stored colour too dark for the stored background is left out
  assert.deepEqual(plain(LOOK.stored(LOOK.checked({ background: '#141414', words: '#7c7c7c' }))), { background: '#141414' });
  // a font no longer on the computer goes back to IntuaCode's own
  assert.deepEqual(plain(LOOK.stored(LOOK.checked({ codeFont: 'Gone Mono' }, { fontInstalled: () => false }))), {});
});

test('look: what each value changes on the page', () => {
  const s = plain(LOOK.styleOf({ ...D, accent: 'skyblue', editorSize: '18', highlight: 'gold', glow: 'amber', codeFont: 'Consolas', sideOn: 'right', barAt: 'bottom', helpOn: 'left' }));
  assert.deepEqual(s.classes, ['look-bar-bottom', 'look-side-right', 'look-help-left']);
  assert.equal(s.vars['--accent'], '#87ceeb');
  assert.equal(s.vars['--accent-ink'], '#1C0F13', 'a light accent keeps dark words on it');
  assert.equal(s.vars['--accent-soft'], 'rgba(135, 206, 235, 0.14)');
  assert.equal(s.vars['--say-size'], '18px');
  assert.equal(s.vars['--code-size'], '13.5px');
  assert.equal(s.vars['--lh'], '27px', 'the lines grow with the bigger of the two sizes');
  assert.equal(s.vars['--sel'], 'rgba(255, 215, 0, 0.24)');
  assert.equal(s.vars['--f-py'], '"Consolas", ui-monospace, Menlo, Consolas, monospace');
  assert.deepEqual([s.vars['--term-ink'], s.vars['--phosphor']], ['#ffb000', '#ffb000']);
  assert.ok(LOOK.contrast(s.vars['--term-dim'], '#040605') >= 4.5, 'the terminal\'s dim lines stay readable');
  for (const v of Object.keys(s.vars)) assert.ok(LOOK.VARS.includes(v), `${v} is in VARS (so it can be taken off again)`);
  assert.equal(LOOK.styleOf({ ...D, accent: '#3a6fd8' }).vars['--accent-ink'], '#FFFFFF', 'a dark accent gets white words');
});

test('look: seafoam and pink stay readable on any background the editor can have', () => {
  // the lightest grey the background check lets through, and the darkest there is
  let lightest = null;
  for (let g = 0; g < 256; g++) {
    const hex = '#' + g.toString(16).padStart(2, '0').repeat(3);
    if (LOOK.check('background', hex, D).ok) lightest = hex;
  }
  assert.ok(lightest, 'some grey is dark enough');
  for (const bg of ['#000000', D.background, lightest, '#101828']) {
    assert.ok(LOOK.contrast(LOOK.SEAFOAM, bg) >= 7, `seafoam on ${bg}: ${LOOK.contrast(LOOK.SEAFOAM, bg).toFixed(1)}`);
    assert.ok(LOOK.contrast(LOOK.PINK, bg) >= 7, `pink on ${bg}: ${LOOK.contrast(LOOK.PINK, bg).toFixed(1)}`);
  }
  // the window shows its values in the same colours, and seafoam is the app's own (the Predictive Mode button's)
  const css = readFileSync(path.join(ROOT, 'app.css'), 'utf8');
  assert.match(css, new RegExp(`\\.look-card \\{ --seafoam: ${LOOK.SEAFOAM}; --fixed-pink: ${LOOK.PINK};`));
  assert.match(css, new RegExp(`\\.btn\\.predict-btn \\{ --seafoam: ${LOOK.SEAFOAM};`));
});

test('look: the page has the window, and every variable and class the look sets is used by app.css', () => {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8'), css = readFileSync(path.join(ROOT, 'app.css'), 'utf8');
  assert.match(html, /<button type="button" role="menuitem" id="btnLook"[^>]*>Customise…<\/button>\s*<button type="button" role="menuitem" id="btnAbout"/, 'in the Menu, beside About');
  assert.ok(html.includes('<div class="modal" id="lookModal" hidden>'));
  assert.ok(html.indexOf('<script src="lang/look.js"></script>') > html.indexOf('<script src="lang/values.js"></script>'), 'after the colour names');
  assert.ok(html.indexOf('<script src="lang/look.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  for (const v of LOOK.VARS) assert.ok(css.includes(`var(${v}`), `app.css uses ${v}`);
  for (const c of LOOK.CLASSES) assert.ok(css.includes(`.${c} `), `app.css has .${c}`);
});

/* ---------- the window in the real page (the browser version), in Chrome ---------- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const ORIGIN = 'http://intuacode.localhost';
// as run.py does: index.html wrapped in a document, the other files as they are, nothing from the internet
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

test('look: the window in the page: a value is used as soon as it\'s right, a wrong one is said and not used, and it\'s all kept', { skip: !findChrome() && 'no Chrome or Edge' }, async () => {
  const browser = await openBrowser();
  try {
    const tab = await browser.tab();
    const open = async () => {
      await tab.open(ORIGIN + '/', { serve: serveApp });
      assert.ok(await tab.run('(async () => { for (let i = 0; i < 100; i++) { if (document.getElementById("btnLook") && document.getElementById("ta")) return true; await new Promise(r => setTimeout(r, 100)); } return false; })()'));
      await tab.run('(() => { const w = document.getElementById("welcomeModal"); if (!w.hidden) document.getElementById("welcomeLook").click(); })()');
    };
    const set = (key, value) => tab.run(`(() => { const i = document.querySelector('#lookCode [data-look="${key}"]'); i.focus(); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    const cssVar = (v) => tab.run(`getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(v)}).trim()`);
    await open();   // (a new browser profile: nothing stored yet)
    assert.equal(await tab.run('localStorage.getItem("intuicode.look.v1")'), null);

    // Menu → Customise: the look as code, the values in seafoam (inputs) and pink (fixed)
    await tab.run('document.getElementById("btnFile").click(); document.getElementById("btnLook").click()');
    const w = await tab.run(`(async () => {
      const m = document.getElementById('lookModal'), v = m.querySelector('.lk-v'), f = m.querySelector('.lk-fixed');
      const focused = document.activeElement === v;
      for (let i = 0; i < 50 && f.textContent === '…'; i++) await new Promise(r => setTimeout(r, 100));   // (the version is fetched)
      return { open: !m.hidden, inputs: m.querySelectorAll('.lk-v').length, fixed: m.querySelectorAll('.lk-fixed').length, seafoam: getComputedStyle(v).color, pink: getComputedStyle(f).color,
        focused, first: v.closest('.lk-l').textContent, version: f.textContent };
    })()`);
    assert.deepEqual([w.open, w.inputs, w.fixed, w.focused], [true, 16, 7, true]);
    assert.equal(w.seafoam, 'rgb(159, 226, 191)');
    assert.equal(w.pink, 'rgb(255, 159, 198)');
    assert.equal(w.first, '7  Accent colour =   -- links and outlines', 'a line: its number, its name, = and the value (the input)');
    assert.equal(w.version, JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version);

    // a value that's right is used at once; one that isn't is said under its line, and the look keeps what it had
    await set('accent', 'skyblue');
    assert.equal(await cssVar('--accent'), '#87ceeb');
    await set('editorSize', '40');
    assert.equal(await tab.run('document.querySelector("#lookCode .lk-err").textContent.trim()'), '-- ✗ Text size goes from 12 to 20. Still using 14.5.');
    assert.equal(await tab.run('getComputedStyle(document.querySelector(".u-view:not([hidden]) .u-ta, .panes:not([hidden]) #ta")).fontSize'), '14.5px');
    assert.equal(await tab.run('document.querySelector(\'#lookCode [data-look="editorSize"]\').getAttribute("aria-invalid")'), 'true');
    await set('editorSize', '17');
    assert.equal(await tab.run('document.querySelectorAll("#lookCode .lk-err").length'), 0, 'put right: the note goes');
    assert.equal(await tab.run('getComputedStyle(document.querySelector(".u-view:not([hidden]) .u-ta, .panes:not([hidden]) #ta")).fontSize'), '17px');
    assert.equal(await tab.run('getComputedStyle(document.querySelector(".u-view:not([hidden]) .u-ta, .panes:not([hidden]) #ta")).lineHeight'), '26px');
    await set('background', 'white');
    assert.match(await tab.run('document.querySelector("#lookCode .lk-err").textContent'), /Too light: the notes/);
    assert.equal(await cssVar('--field'), '#0A0B0D');
    await set('background', '#101828');
    // where things sit
    await set('sideOn', 'right');
    await set('barAt', 'bottom');
    const at = await tab.run(`(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { side: r('.side').left > r('#work').left, bar: r('.bar').top > r('.workspace').top }; })()`);
    assert.deepEqual(at, { side: true, bar: true });
    assert.equal(await tab.run('document.getElementById("lookNote").textContent'), '5 values changed from IntuaCode\'s own, kept for next time.');
    assert.deepEqual(JSON.parse(await tab.run('localStorage.getItem("intuicode.look.v1")')), { accent: 'skyblue', barAt: 'bottom', sideOn: 'right', editorSize: '17', background: '#101828' });
    // Esc closes it
    await tab.run('document.querySelector("#lookCode .lk-v").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
    assert.equal(await tab.run('document.getElementById("lookModal").hidden'), true);

    // next time: the same look, before the window is opened
    await open();
    assert.equal(await cssVar('--accent'), '#87ceeb');
    assert.equal(await cssVar('--field'), '#101828');
    assert.equal(await tab.run('document.documentElement.classList.contains("look-side-right") && document.documentElement.classList.contains("look-bar-bottom")'), true);
    assert.equal(await tab.run('getComputedStyle(document.querySelector(".u-view:not([hidden]) .u-ta, .panes:not([hidden]) #ta")).fontSize'), '17px');

    // back to the defaults: nothing of it left, not even a value still being typed
    await tab.run(`(() => {
      document.getElementById('btnFile').click(); document.getElementById('btnLook').click();
      const i = document.querySelector('#lookCode [data-look="accent"]');
      i.focus(); i.value = 'hotpink'; i.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('lookReset').click();
    })()`);
    assert.equal(await tab.run('localStorage.getItem("intuicode.look.v1")'), null);
    assert.equal(await tab.run('document.documentElement.getAttribute("style") || ""'), '');
    assert.equal(await tab.run('document.documentElement.className.includes("look-")'), false);
    assert.equal(await tab.run('document.querySelector(\'#lookCode [data-look="accent"]\').value'), '#E8AABA');
    await tab.close();
  } finally { await browser.close(); }
});

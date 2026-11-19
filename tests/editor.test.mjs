// Editor mode (the Editor button over the Preview): the code and the page side by side, filling the window, and anything
// on the page dragged roughly into place. A drag is written as a style sentence (lang/arrange.js), the page is rebuilt
// from the code, and the move is only said to be done when the rebuilt page shows the element where it was dropped.
// The sentences are checked here in Node, against the web writer; the mode itself in the real page, in Chrome when
// there is one (the browser version), with the browser's own pointer.
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
for (const f of ['lang/web_write.js', 'lang/arrange.js']) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const WEB = ctx.IntuiWeb, ARR = ctx.IntuiArrange;
const plain = (x) => JSON.parse(JSON.stringify(x));
const site = (structure, styling = '') => WEB.compileWebsite({ sections: [
  { id: 'structure', file: 'structure', text: structure }, { id: 'styling', file: 'styling', text: styling }, { id: 'mechanics', file: 'mechanics', text: '' }] }).results;

// the landing page every new project in the browser starts with (lang/blueprints.js, "Landing page")
const BAKERY = `page title is "Sunny Bakery"
add a header in group top
    add a big heading "Sunny Bakery"
    add a paragraph "Fresh bread every morning"
    add a button called cta saying "See the menu"
add a section called menu
    add a heading "Menu"
    add a list called items
        add a list item "Sourdough loaf"
        add a list item "Cinnamon bun"
        add a list item "Baguette"
add a footer
    add a paragraph "Made with IntuaCode"
`;
const BAKERY_STYLE = `shared colour brand is #d9822b
style the page: font Inter, space around 0, background #fffaf3, text colour #2b2118
style group top: background the colour brand, text colour white, space inside 48 24, centre the text
style cta: background white, text colour the colour brand, no border, rounded corners 999, space inside 12 24, text size 18, bold, hand cursor
when cta is hovered: background #ffe9d2
style menu: at most 640 wide, centred, space inside 24
on screens narrower than 600:
    style group top: space inside 24 16
`;

/* As the app does it: Styling with the move, checked by compiling it (no problems, and a rule for that element). */
function move(styling, name, drop, structure = BAKERY) {
  const off = ARR.offsets(drop);
  assert.equal(off.why, undefined, off.why);
  const w = ARR.withMove(styling, site(structure, styling).styling, name, off.props);
  const r = site(structure, w.text).styling;
  assert.deepEqual(plain(r.info[w.line].errs), [], w.text.split('\n')[w.line]);
  assert.equal(ARR.styleLine(w.text, r, name), w.line, 'the sentence written makes the rule for that element');
  return { ...w, css: r.text, said: w.text.split('\n')[w.line] };
}

test('editor: a drop becomes offsets, from where the page says the element is', () => {
  assert.deepEqual(plain(ARR.offsets({ dx: 40, dy: -12, position: 'static', left: null, top: null })), { props: { position: 'relative', left: 40, top: -12 } }, 'nudged from its place');
  assert.deepEqual(plain(ARR.offsets({ dx: 40, dy: -12, position: 'relative', left: 10, top: 5 })), { props: { position: 'relative', left: 50, top: -7 } }, 'from the offsets it has');
  assert.deepEqual(plain(ARR.offsets({ dx: 3.6, dy: 0, position: 'absolute', left: 120, top: 40 })), { props: { left: 124, top: 40 } }, 'absolute stays absolute (whole pixels)');
  assert.deepEqual(plain(ARR.offsets({ dx: -5, dy: 5, position: 'fixed', left: 0, top: 0 })), { props: { left: -5, top: 5 } });
  assert.match(ARR.offsets({ dx: 5, dy: 5, position: 'sticky', left: 0, top: 0 }).why, /sticks in place .* "top" in Styling/);
  assert.equal(ARR.offsets({ dx: 0, dy: 0, position: 'static' }).why, 'It wasn\'t moved.');
  assert.equal(ARR.moved(40, -12), '40 right and 12 up');
  assert.equal(ARR.moved(-3, 0), '3 left');
});

test('editor: a style sentence gets the offsets in place, as IntuaCode reads CSS back; the rest of it as written', () => {
  const p = { position: 'relative', left: 20, top: -10 };
  assert.equal(ARR.styleWith('style cta:', p), 'style cta: position: relative, left: 20px, top: -10px', 'a place made for it');
  assert.equal(ARR.styleWith('style cta: background white, left 5px, font "Inter, sans", top: 3px', p),
    'style cta: background white, left: 20px, font "Inter, sans", top: -10px, position: relative', 'its own offsets replaced where they are; quotes keep their commas');
  assert.equal(ARR.styleWith('style the big heading "a: b": position absolute, left 1px, left 2px', { left: 7, top: 8 }),
    'style the big heading "a: b": position absolute, left: 7px, top: 8px', 'a colon in quotes isn\'t the end of the name; a second left goes; its position is kept');
  assert.equal(ARR.styleWith('style cta: left border 2 red', { left: 1, top: 2 }), 'style cta: left border 2 red, left: 1px, top: 2px', '"left border" isn\'t an offset');
  assert.equal(ARR.said('cta'), 'cta');
  assert.equal(ARR.said('helpToggle'), 'helpToggle');
  assert.equal(ARR.said('a.b'), '"a.b"');
});

test('editor: the move goes in its own sentence after the element\'s look, and the next move changes that one', () => {
  const one = move(BAKERY_STYLE, 'cta', { dx: 40, dy: 16, position: 'static' });
  assert.equal(one.line, 4, 'straight after "style cta: background white, …"');
  assert.equal(one.said, 'style cta: position: relative, left: 40px, top: 16px');
  assert.equal(one.text.split('\n')[5], 'when cta is hovered: background #ffe9d2');
  assert.match(one.css, /#cta \{\n {2}background: white;[^}]*\}\n\n#cta \{\n {2}position: relative;\n {2}left: 40px;\n {2}top: 16px;\n\}/, 'later, so it counts');
  // the page now says it's relative, at 40, 16
  const two = move(one.text, 'cta', { dx: -10, dy: 4, position: 'relative', left: 40, top: 16 });
  assert.equal(two.line, 4);
  assert.equal(two.said, 'style cta: position: relative, left: 30px, top: 20px');
  assert.equal(two.text.split('\n').filter(l => /^style cta:/.test(l)).length, 2, 'no third sentence');
  // a place IntuaCode made (style menu:, empty) is filled in; an element with no style sentence gets one at the end
  const stub = move(BAKERY_STYLE.replace('style menu: at most 640 wide, centred, space inside 24', 'style menu:'), 'menu', { dx: 8, dy: 0, position: 'static' });
  assert.equal(stub.said, 'style menu: position: relative, left: 8px, top: 0px');
  assert.equal(stub.line, 5);
  const items = move(BAKERY_STYLE, 'items', { dx: 0, dy: 30, position: 'static' });
  assert.equal(items.line, 8, 'after the last line, outside "on screens narrower than 600:"');
  assert.equal(items.text, BAKERY_STYLE.replace(/\n$/, '\nstyle items: position: relative, left: 0px, top: 30px\n'));
  // a sentence in a block ("on screens narrower than 600:") isn't the one changed: a move is for every screen
  const narrow = move(BAKERY_STYLE.replace('    style group top: space inside 24 16', '    style cta: position: relative, left: 1px, top: 1px'), 'cta', { dx: 5, dy: 5, position: 'static' });
  assert.equal(narrow.line, 4);
});

test('editor: an element with no name is named in its sentence, the one way that makes the same page with only that id', () => {
  const before = site(BAKERY).structure.previewText, lines = BAKERY.split('\n');
  const name = (line, drop) => {
    const taken = (n) => !!site(BAKERY).structure && new RegExp(`(^|[^\\w-])${n}([^\\w-]|$)`, 'im').test(BAKERY_STYLE);
    const n = ARR.nameFor(drop, taken);
    for (const said of ARR.namings(lines[line], n)) {
      const r = site(lines.map((l, i) => (i === line ? said : l)).join('\n')).structure;
      if (!r.info[line].errs.length && ARR.namedOnly(before, r.previewText, n, line)) return said;
    }
    return null;
  };
  assert.equal(name(2, { tag: 'h1', text: 'Sunny Bakery' }), '    add a big heading called sunny-bakery "Sunny Bakery"');
  assert.equal(name(1, { tag: 'header', text: '' }), 'add a header called header in group top');
  assert.equal(name(11, { tag: 'footer', text: '' }), 'add a footer called footer');
  assert.equal(name(12, { tag: 'p', text: 'Made with IntuaCode' }), '    add a paragraph called made-with-intuacode "Made with IntuaCode"');
  assert.equal(name(8, { tag: 'li', text: 'Sourdough loaf' }), '        add a list item called sourdough-loaf "Sourdough loaf"');
  // a name already used is taken further (Styling says "menu"), and a word that isn't a name is made one
  assert.equal(ARR.nameFor({ tag: 'section', text: 'Menu' }, (n) => n === 'menu'), 'menu-2');
  assert.equal(ARR.nameFor({ tag: 'iframe', text: '' }, () => false), 'frame');
  assert.equal(ARR.nameFor({ tag: 'div', text: '42 things to do today' }, () => false), 'box', 'a name starts with a letter');
  // the ways it's tried: after the words that say what it is (last first), then as a setting before its groups
  assert.deepEqual(plain(ARR.namings('    add a button saying "Go, now" in group main', 'go')), [
    '    add a button saying called go "Go, now" in group main', '    add a button called go saying "Go, now" in group main',
    '    add a called go button saying "Go, now" in group main', '    add a button saying "Go, now", with id go in group main']);
  assert.deepEqual(plain(ARR.namings('  html: <div class="card">', 'card')), ['  html: <div id="card" class="card">'], 'an exact line: in its tag');
  // a candidate that changes anything else on the page isn't kept
  assert.equal(ARR.namedOnly('<p data-ic-line="3">Hi</p>', '<p id="x" data-ic-line="3">Hi</p>', 'x', 3), true);
  assert.equal(ARR.namedOnly('<p data-ic-line="3">Hi</p>', '<p id="x" data-ic-line="3">Hi there</p>', 'x', 3), false);
  assert.equal(ARR.namedOnly('<p data-ic-line="3">Hi</p>', '<p id="x" data-ic-line="4">Hi</p>', 'x', 3), false, 'another line\'s element');
});

test('editor: the page has the button, the bar and the line between the windows, and loads lang/arrange.js', () => {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<button type="button" class="btn small term-btn edit-btn" id="btnEditor" aria-pressed="false" hidden [^>]*>[\s\S]*?Editor<\/button>\s*<button type="button" class="btn small term-btn link-btn" id="btnLink"/, 'beside Project Link, over the Preview');
  assert.ok(html.includes('<div class="edit-bar" id="editBar" hidden aria-live="polite"></div>'));
  assert.ok(html.includes('<div class="edit-grip" id="editGrip" tabindex="0" role="separator" aria-orientation="vertical"'));
  assert.ok(html.indexOf('<script src="lang/arrange.js"></script>') > html.indexOf('<script src="lang/web_write.js"></script>'), 'after the web writer (its lists are split by it)');
  assert.ok(html.indexOf('<script src="lang/arrange.js"></script>') < html.indexOf('<script src="app.js"></script>'));
});

/* ---------- Editor mode in the real page (the browser version), in Chrome ---------- */
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

/* Driving the page in the tab: Chrome's own pointer and keys, and what the page and the project say. */
function driving(tab) {
  const until = async (cond, what) => {   // (asked from here, so nothing waits in the page meanwhile)
    for (let i = 0; i < 150; i++) { if (await tab.run(`!!(${cond})`)) return true; await new Promise(r => setTimeout(r, 100)); }
    throw new Error(`waited for ${what} (the bar says: ${await tab.run('document.getElementById("editBar").textContent')})`);
  };
  // where the page says the element from a Structure line is (the Preview's own question: the frame is sandboxed)
  const where = (line) => tab.run(`new Promise((ok, no) => {
    const f = (e) => { if (e.data && e.data.type === 'edit-at' && e.data.line === ${line}) { removeEventListener('message', f); ok(e.data); } };
    addEventListener('message', f);
    document.getElementById('preview').contentWindow.postMessage({ intuicodeWhere: ${line} }, '*');
    setTimeout(() => no(new Error('the page didn\\'t answer')), 5000);
  })`);
  const frame = async () => JSON.parse(await tab.run('JSON.stringify(document.getElementById("preview").getBoundingClientRect())'));
  const mouse = (type, x, y, held, alt) => tab.send('Input.dispatchMouseEvent', { type, x, y, modifiers: alt ? 1 : 0, button: type === 'mouseMoved' && !held ? 'none' : 'left', buttons: type === 'mousePressed' || held ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
  // the browser's own pointer: onto the element (its middle, or 40px in), pressed, moved in steps, let go
  const drag = async (line, dx, dy, alt) => {
    const f = await frame(), at = await where(line), x = f.x + at.x + Math.min(at.w / 2, 40), y = f.y + at.y + at.h / 2;   // (inside it: a rounded corner isn't)
    // (the page runs in a process of its own, and Chrome without a window hands it the pointer once it has drawn the
    // page as rebuilt, and has seen the pointer arrive over it: a window draws all the time, and a person points
    // before pressing. A test asks for a drawing, and points a moment first.)
    await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } });
    await mouse('mouseMoved', x, y, false, alt);
    await new Promise(r => setTimeout(r, 150));
    await mouse('mousePressed', x, y, false, alt);
    for (let i = 1; i <= 8; i++) await mouse('mouseMoved', x + dx * i / 8, y + dy * i / 8, true, alt);
    await tab.run('document.getElementById("editBar").dataset.was = document.getElementById("editBar").textContent');
    await mouse('mouseReleased', x + dx, y + dy, false, alt);
    // (checked on the rebuilt page, which answers once its fonts are in and it's laid out: Chrome without a window does
    // that for a frame of its own process when it draws it, and a window draws all the time, so here it's asked to while
    // waiting; a busy computer can take a while)
    const checked = '!/Checking the page|^Drag anything|checked yet/.test(document.getElementById("editBar").textContent) && document.getElementById("editBar").textContent !== document.getElementById("editBar").dataset.was';
    for (let i = 0; i < 100 && !(await tab.run(`!!(${checked})`)); i++) {
      await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } });
      await new Promise(r => setTimeout(r, 200));
    }
    await until(checked, 'the move to be checked');
    return { at, bar: await tab.run('document.getElementById("editBar").textContent'), bad: await tab.run('document.getElementById("editBar").classList.contains("bad")') };
  };
  // Ctrl+Z, as pressed (where the keys are: the code, after a move)
  const undo = async () => {
    await tab.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 });
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 });
  };
  // a file as the project keeps it (it's stored 300ms after a change)
  const file = async (p) => (await new Promise(r => setTimeout(r, 450))) || tab.run(`JSON.parse(localStorage.getItem("intuicode.project.v1")).sections.find(s => s.path === ${JSON.stringify(p)}).text`);
  const box = (sel) => tab.run(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); const r = e && e.getBoundingClientRect(); return r && r.width ? [Math.round(r.left), Math.round(r.width)] : null; })()`);
  const layout = async () => ({ side: await box('.side'), code: await box('#unityView'), page: await box('#term'), explain: await box('#explainWrap'), help: await box('#btnIndex') });
  return { until, where, frame, mouse, drag, undo, file, box, layout };
}

test('editor: in the page, the windows make room, a drag is written in Styling and checked on the rebuilt page, and it all comes back', { skip: !findChrome() && 'no Chrome or Edge' }, async () => {
  const browser = await openBrowser();
  try {
    const tab = await browser.tab();
    const size = () => tab.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false });
    const open = async () => {
      await tab.open(ORIGIN + '/', { serve: serveApp });
      await size();
      assert.ok(await tab.run('(async () => { for (let i = 0; i < 100; i++) { if (document.getElementById("btnEditor") && document.getElementById("ta")) return true; await new Promise(r => setTimeout(r, 100)); } return false; })()'));
      await tab.run('(() => { const w = document.getElementById("welcomeModal"); if (!w.hidden) document.getElementById("welcomeLook").click(); })()');
    };
    const { until, where, frame, mouse, drag, undo, file, box, layout } = driving(tab);

    await open();
    await until('!document.getElementById("previewWrap").hidden', 'the Preview');
    await where(4);   // (the page is up)
    assert.equal(await tab.run('document.getElementById("btnEditor").hidden'), false, 'a website: the button shows over the Preview');
    const before = await layout();
    assert.ok(before.side && before.explain && before.help);

    // (Project Link off: Editor mode lights up the code behind what's pointed at anyway)
    await tab.run('document.getElementById("btnLink").click()');
    assert.equal(await tab.run('document.getElementById("btnLink").getAttribute("aria-pressed")'), 'false');

    // Editor mode: the code and the page, side by side, half and half; the side, the help and the explanation away
    await tab.run('document.getElementById("btnEditor").click()');
    assert.equal(await tab.run('document.getElementById("btnEditor").getAttribute("aria-pressed")'), 'true');
    assert.deepEqual(await layout(), { side: null, code: [0, 700], page: [700, 700], explain: null, help: null });
    assert.match(await tab.run('document.getElementById("editBar").textContent'), /^Drag anything on the page to move it roughly into place\. Alt moves the box it's in\./);

    // pointing at the button lights up its code in pink: its style first (where a move goes), then its sentence
    {
      const f = await frame(), at = await where(4);
      await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } });
      await mouse('mouseMoved', f.x + at.x + at.w / 2, f.y + at.y + at.h / 2);
      await new Promise(r => setTimeout(r, 150));   // (and moved a little over it, as a pointer does)
      await mouse('mouseMoved', f.x + at.x + at.w / 2 + 2, f.y + at.y + at.h / 2 + 1);
      await until('!document.getElementById("linkBar").hidden && /^Pointing at/.test(document.getElementById("linkBar").textContent)', 'the button\'s code to light up');
      assert.match(await tab.run('document.getElementById("linkBar").textContent'), /^Pointing at <button>#cta\s*style\.css lines? 4[^·]*· index\.html line 5/);
      assert.ok(await tab.run('document.querySelectorAll(".u-hl .ul.lk").length') > 0, 'pink lines in the code');
    }

    // a drag: written as its own style sentence after the button's look, and the rebuilt page shows it there
    let m = await drag(4, 40, 16);
    assert.equal(m.bad, false, m.bar);
    assert.equal(m.bar, 'Moved cta 40 right and 16 down, and the page shows it there. Written in style.css line 5, ready to fine-tune (Ctrl+Z there takes it back).');
    let sty = (await file('style.css')).split('\n');
    assert.equal(sty[4], 'style cta: position: relative, left: 40px, top: 16px');
    assert.match(sty[3], /^style cta: background white,/);
    const now = await where(4);
    assert.deepEqual([now.x - m.at.x, now.y - m.at.y], [40, 16], 'the page puts it where it was dropped');
    assert.equal(await tab.run('document.querySelector(".u-view .pane-title").textContent.includes("style.css")'), true, 'Styling is open, at the line, to fine-tune');
    assert.equal(await tab.run('document.getElementById("linkBar").textContent.includes("handler ran")'), false, 'the drag isn\'t taken for the page\'s own handlers');
    // again: the same sentence changes, from where the page says it is now
    m = await drag(4, -10, 4);
    sty = (await file('style.css')).split('\n');
    assert.equal(sty[4], 'style cta: position: relative, left: 30px, top: 20px', m.bar);
    assert.equal(sty.filter(l => l.startsWith('style cta:')).length, 2);
    // Esc in the middle of a drag: it goes back, and nothing is written
    {
      const f = await frame(), at = await where(4), x = f.x + at.x + Math.min(at.w / 2, 40), y = f.y + at.y + at.h / 2, bar = await tab.run('document.getElementById("editBar").textContent');
      await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } });
      await mouse('mouseMoved', x, y);
      await new Promise(r => setTimeout(r, 150));
      await mouse('mousePressed', x, y);
      for (let i = 1; i <= 4; i++) await mouse('mouseMoved', x + i * 10, y, true);
      await tab.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await mouse('mouseReleased', x + 40, y);
      await new Promise(r => setTimeout(r, 800));
      assert.deepEqual([(await where(4)).x, (await where(4)).y], [at.x, at.y], 'back where it was');
      assert.equal(await tab.run('document.getElementById("editBar").textContent'), bar);
      assert.equal((await file('style.css')).split('\n')[4], 'style cta: position: relative, left: 30px, top: 20px');
      assert.equal(await tab.run('document.getElementById("app").classList.contains("edit-mode")'), true, 'and Editor mode stays on');
    }

    // no name: it's given one in its sentence (the same page, with only that id), then moved
    m = await drag(12, 24, -8);
    assert.equal(m.bar, 'Moved made-with-intuacode 24 right and 8 up, and the page shows it there. Written in style.css line 10, ready to fine-tune (Ctrl+Z there takes it back).');
    assert.equal((await file('index.html')).split('\n')[12], '    add a paragraph called made-with-intuacode "Made with IntuaCode"');
    assert.equal((await file('style.css')).split('\n')[9], 'style made-with-intuacode: position: relative, left: 24px, top: -8px');
    // Alt: the box it's in (the footer)
    m = await drag(12, 10, 0, true);
    assert.equal(m.bar, 'Moved footer 10 right, and the page shows it there. Written in style.css line 11, ready to fine-tune (Ctrl+Z there takes it back).');
    assert.equal((await file('index.html')).split('\n')[11], 'add a footer called footer');
    // the editor's own Undo (Ctrl+Z, in the code) takes the moves back, last first, and the page follows
    assert.equal(await tab.run('document.activeElement && document.activeElement.id'), 'uTa', 'after a move, the keys go to the code');
    const footerAt = await where(11);
    await undo();
    assert.deepEqual((await file('style.css')).split('\n').slice(9), ['style made-with-intuacode: position: relative, left: 24px, top: -8px', '']);
    await until(`!document.getElementById("previewWrap").hidden`, 'the Preview');
    await new Promise(r => setTimeout(r, 1500));   // (rebuilt a moment after the change, as after typing)
    assert.equal((await where(11)).x, footerAt.x - 10, 'the footer is back where it was');
    await undo();
    assert.deepEqual((await file('style.css')).split('\n').slice(8), ['    style group top: space inside 24 16', '']);
    assert.equal((await file('index.html')).split('\n')[12], '    add a paragraph called made-with-intuacode "Made with IntuaCode"', 'a name given stays: it changes nothing on the page');

    // full screen still works for either window, and the other comes back after
    await tab.run('document.querySelector("#unityView .max-btn").click()');
    assert.deepEqual(await layout(), { side: null, code: [0, 1400], page: null, explain: null, help: null });
    await tab.run('document.querySelector("#unityView .max-btn").click(); document.querySelector("#term .max-btn").click()');
    assert.deepEqual(await layout(), { side: null, code: null, page: [0, 1400], explain: null, help: null });
    await tab.run('document.querySelector("#term .max-btn").click()');
    assert.deepEqual(await layout(), { side: null, code: [0, 700], page: [700, 700], explain: null, help: null });
    // the line between them: dragged, the page is wider, and that's remembered
    const g = JSON.parse(await tab.run('JSON.stringify(document.getElementById("editGrip").getBoundingClientRect())'));
    await mouse('mouseMoved', g.x + 4, g.y + 300);
    await mouse('mousePressed', g.x + 4, g.y + 300);
    await mouse('mouseMoved', g.x - 96, g.y + 300, true);
    await mouse('mouseReleased', g.x - 96, g.y + 300);
    assert.deepEqual((await layout()).page, [600, 800]);
    assert.equal(JSON.parse(await tab.run('localStorage.getItem("intuicode.layout.v1")')).editCol, 800);
    await tab.run('document.getElementById("editGrip").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))');
    assert.deepEqual((await layout()).page, [700, 700], 'double-click: half and half');

    // Split Mode: the sentences above the code, the page beside them; a move is typed into the sentences, and undone
    await tab.run('document.getElementById("modeWrite").click()');
    assert.deepEqual([await box('.pane-say'), await box('.pane-py'), await box('#term')], [[0, 700], [0, 700], [700, 700]]);
    m = await drag(4, 0, 10);
    assert.equal((await file('style.css')).split('\n')[4], 'style cta: position: relative, left: 30px, top: 30px', m.bar);
    assert.equal(await tab.run('document.activeElement && document.activeElement.id'), 'ta');
    await undo();
    assert.equal((await file('style.css')).split('\n')[4], 'style cta: position: relative, left: 30px, top: 20px');

    // a move another style wins over (an exact line of CSS, typed at the end of Styling): written, but the rebuilt page
    // says where it really is, and that's what's said
    await tab.run(`(() => { const ta = document.getElementById('ta'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      document.execCommand('insertText', false, 'css: #cta { left: 0 !important; }\\n'); return true; })()`);
    await new Promise(r => setTimeout(r, 1500));   // (the page is rebuilt a moment after typing)
    m = await drag(4, 50, 0);
    assert.equal(m.bad, true, m.bar);
    assert.match(m.bar, /^The page puts cta at \d+, \d+, not where it was dropped \(\d+, \d+\): another style wins over the one written in style\.css line 5\./);
    await tab.run('document.getElementById("modeUnity").click()');

    // pressed again: everything as it was
    await tab.run('document.getElementById("btnEditor").click()');
    assert.deepEqual(await layout(), before);
    assert.equal(await tab.run('document.getElementById("editBar").hidden'), true);
    await tab.close();
  } finally { await browser.close(); }
});

/* The desktop app's page with a pretend desktop layer (tests/desktop-mock.html, as run.py serves it): the desktop code
   paths, in Chrome. There's no local address to pretend, so the preview shows one page, as the desktop app does when it
   can't open one (tests/e2e/run.mjs drives the real app, at its local address). */
function serveMock(req) {
  const url = new URL(req.url);
  if (url.origin === ORIGIN && url.pathname === '/index.html' && url.search === '?raw') return { type: 'text/html', body: readFileSync(path.join(ROOT, 'index.html'), 'utf8') };
  return serveApp(req);
}
test('editor: with the desktop layer (tests/desktop-mock.html), a move is written, checked on the page and undone', { skip: !findChrome() && 'no Chrome or Edge' }, async () => {
  const browser = await openBrowser();
  try {
    const tab = await browser.tab();
    await tab.open(ORIGIN + '/tests/desktop-mock.html', { serve: serveMock });
    await tab.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false });
    const { until, where, drag, undo, layout } = driving(tab);
    await until('document.getElementById("btnEditor") && document.getElementById("ta") && document.documentElement.classList.contains("desktop")', 'the app, as the desktop app');
    await tab.run('(() => { const w = document.getElementById("welcomeModal"); if (!w.hidden) document.getElementById("welcomeLook").click(); return true; })()');
    // the Landing page, from Project Templates
    await tab.run(`(async () => {
      document.getElementById('btnBlueprints').click();
      await new Promise(r => setTimeout(r, 200));
      [...document.querySelectorAll('#bpList *')].find(e => e.textContent.trim().startsWith('Landing page')).click();
      await new Promise(r => setTimeout(r, 200));
      [...document.querySelectorAll('#bpDetail button')].find(e => e.textContent.trim().startsWith('Build this project')).click();
      return true;
    })()`);
    await until('!document.getElementById("previewWrap").hidden && !document.getElementById("btnEditor").hidden', 'the Preview');
    await where(4);
    const before = await layout();
    await tab.run('document.getElementById("btnEditor").click()');
    assert.deepEqual(await layout(), { side: null, code: [0, 700], page: [700, 700], explain: null, help: null });
    const m = await drag(4, 30, 12);
    assert.equal(m.bar, 'Moved cta 30 right and 12 down, and the page shows it there. Written in style.css line 5, ready to fine-tune (Ctrl+Z there takes it back).');
    const line5 = () => tab.run('document.getElementById("uTa").value.split(String.fromCharCode(10))[4]');
    assert.equal(await line5(), 'style cta: position: relative, left: 30px, top: 12px');
    await undo();
    assert.equal(await line5(), 'when cta is hovered: background #ffe9d2');
    await tab.run('document.getElementById("btnEditor").click()');
    assert.deepEqual(await layout(), before);
    await tab.close();
  } finally { await browser.close(); }
});

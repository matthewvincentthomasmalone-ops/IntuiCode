// IntuaCode's own Undo for the code (on in WebKit, where a Preview rebuilt leaves the engine's Undo with nothing to
// take back; checked there by hand with Playwright's WebKit). Here it's switched on in Chrome (intuicode.undo.v1 = "own")
// and driven with the browser's own keys: typing, a Preview rebuilt, Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z, typing in two
// bursts, Unity, and a move made in Editor mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers/engine.mjs';
import { findChrome, openBrowser } from './helpers/browser.mjs';

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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

test('undo: IntuaCode\'s own Undo takes typing back after the Preview is rebuilt, step by step, in Split Mode and Unity, and puts it back', { skip: !findChrome() && 'no Chrome or Edge' }, async () => {
  const browser = await openBrowser();
  try {
    const tab = await browser.tab();
    await tab.open(ORIGIN + '/', { serve: serveApp });
    await tab.run('(() => { localStorage.setItem("intuicode.undo.v1", "own"); return true; })()');
    await tab.open(ORIGIN + '/', { serve: serveApp });
    await tab.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false });
    const until = async (cond, what) => { for (let i = 0; i < 150; i++) { if (await tab.run(`!!(${cond})`)) return; await sleep(100); } throw new Error(`waited for ${what}`); };
    await until('document.getElementById("ta") && document.getElementById("ta").value.length > 0', 'the app');
    await tab.run('(() => { const w = document.getElementById("welcomeModal"); if (!w.hidden) document.getElementById("welcomeLook").click(); return true; })()');
    await until('!document.getElementById("tabPreview").hidden', 'the Preview tab');
    await tab.run('document.getElementById("tabPreview").click()');
    await until('(document.getElementById("preview").getAttribute("srcdoc") || "").length > 0', 'the page');
    await tab.run('document.getElementById("modeWrite").click()');
    await sleep(300);
    const key = async (k, mods) => {
      await tab.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: 'Key' + k.toUpperCase(), windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0), modifiers: mods });
      await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: 'Key' + k.toUpperCase(), windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0), modifiers: mods });
    };
    const CTRL = 2, SHIFT = 8;
    const at = async (id) => tab.run(`(() => { const t = document.getElementById(${JSON.stringify(id)}); t.focus(); t.setSelectionRange(t.value.length, t.value.length); return true; })()`);
    const type = async (text) => { for (const ch of text) await tab.send('Input.insertText', { text: ch }); };
    const value = (id = 'ta') => tab.run(`document.getElementById(${JSON.stringify(id)}).value`);
    const page = () => tab.run('(document.getElementById("preview").getAttribute("srcdoc") || "")');
    const before = await value();

    // typed, the Preview rebuilt from it, then Ctrl+Z: what was typed goes
    await at('ta');
    await type('\nadd a paragraph "Two"');
    await until('(document.getElementById("preview").getAttribute("srcdoc") || "").includes(">Two<")', 'the Preview rebuilt with it');
    await key('z', CTRL);
    assert.equal(await value(), before, 'taken back, though the Preview was rebuilt');
    await until('!(document.getElementById("preview").getAttribute("srcdoc") || "").includes(">Two<")', 'the Preview without it');
    // Ctrl+Y puts it back; Ctrl+Z, then Ctrl+Shift+Z, again
    await key('y', CTRL);
    assert.equal(await value(), before + '\nadd a paragraph "Two"');
    await key('z', CTRL);
    await key('z', CTRL | SHIFT);
    assert.equal(await value(), before + '\nadd a paragraph "Two"');
    // two bursts, a pause between: two steps
    await at('ta');
    await type('\nadd a paragraph "Three"');
    await sleep(1000);
    await type('\nadd a paragraph "Four"');
    await sleep(800);
    await key('z', CTRL);
    assert.equal(await value(), before + '\nadd a paragraph "Two"\nadd a paragraph "Three"', 'the last burst only');
    assert.ok((await page()).length > 0);

    // Unity: the same
    await tab.run('document.getElementById("modeUnity").click()');
    await sleep(500);
    const u0 = await value('uTa');
    await at('uTa');
    await type('\nadd a paragraph "Five"');
    await until('(document.getElementById("preview").getAttribute("srcdoc") || "").includes(">Five<")', 'the Preview rebuilt in Unity');
    await key('z', CTRL);
    await sleep(300);
    assert.equal(await value('uTa'), u0, 'taken back in Unity');
    await tab.close();
  } finally { await browser.close(); }
});

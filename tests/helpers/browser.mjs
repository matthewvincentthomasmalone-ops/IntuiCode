// A real browser for the tests: Chrome (or Edge) without a window, driven through its DevTools protocol over
// Node's own WebSocket. Nothing to install: it uses the Chrome already on the computer (CHROME_PATH says which).
//
// Each page is served by the test, from an address of its own (http://ex-3.localhost/, which Chrome counts as secure, as https), so it has an origin of
// its own (its own localStorage) and every request it makes (the page, style.css, script.js, fetch, pictures,
// sounds) goes through Chrome's own network code and is answered here. Clicks, typing, keys and the pointer are
// Chrome's own input (trusted events, as from a person), alert/confirm/prompt are its own dialogs, answered here.
//
// What isn't the browser's own: the clock (timers and animation frames wait until the test moves it on, so each
// run is the same), Math.random (seeded), and the recording of what a page draws, plays and copies (its drawing,
// sound and clipboard calls are recorded, then done for real).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function findChrome() {
  if (process.env.CHROME_PATH) return existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  const at = (...p) => p.filter(Boolean).find(f => existsSync(f));
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files', pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', local = process.env.LOCALAPPDATA;
    return at(path.join(pf, 'Google/Chrome/Application/chrome.exe'), path.join(pf86, 'Google/Chrome/Application/chrome.exe'), local && path.join(local, 'Google/Chrome/Application/chrome.exe'),
      path.join(pf86, 'Microsoft/Edge/Application/msedge.exe'), path.join(pf, 'Microsoft/Edge/Application/msedge.exe')) || null;
  }
  if (process.platform === 'darwin') return at('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge') || null;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    const r = spawnSync('which', [name], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

function client(ws) {
  let n = 0;
  const waiting = new Map(), listeners = new Set();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); if (m.error) w.no(new Error(`${w.method}: ${m.error.message}`)); else w.yes(m.result); }
    else for (const f of listeners) f(m);
  });
  ws.addEventListener('close', () => { for (const w of waiting.values()) w.no(new Error('the browser closed')); waiting.clear(); });
  return {
    send(method, params = {}, sessionId) {
      const id = ++n;
      ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
      return new Promise((yes, no) => waiting.set(id, { yes, no, method }));
    },
    on(f) { listeners.add(f); return () => listeners.delete(f); },
  };
}

/* Starts the browser. -> { tab(), close() } */
export async function openBrowser() {
  const exe = findChrome();
  if (!exe) throw new Error('no Chrome or Edge found (set CHROME_PATH)');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'intuicode-chrome-'));
  const flags = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-extensions', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--metrics-recording-only',
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []), 'about:blank'];
  const proc = spawn(exe, flags, { stdio: ['ignore', 'ignore', 'pipe'] });
  const url = await new Promise((yes, no) => {
    let said = '';
    const t = setTimeout(() => no(new Error('the browser did not start: ' + said.slice(0, 400))), 30000);
    proc.stderr.on('data', (d) => { said += d; const m = said.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); yes(m[1]); } });
    proc.on('exit', () => { clearTimeout(t); no(new Error('the browser stopped: ' + said.slice(0, 400))); });
  });
  const ws = new WebSocket(url);
  await new Promise((yes, no) => { ws.addEventListener('open', yes, { once: true }); ws.addEventListener('error', () => no(new Error('could not reach the browser')), { once: true }); });
  const cdp = client(ws);
  const closed = new Promise(r => proc.on('exit', r));
  return {
    cdp,
    tab: () => openTab(cdp),
    async close() {
      try { await Promise.race([cdp.send('Browser.close'), new Promise(r => setTimeout(r, 3000))]); } catch (_) { /* gone already */ }
      await Promise.race([closed, new Promise(r => setTimeout(r, 5000))]);
      proc.kill();
      try { ws.close(); } catch (_) { /* closed */ }
      for (let i = 0; i < 10; i++) { try { rmSync(dir, { recursive: true, force: true }); break; } catch (_) { await new Promise(r => setTimeout(r, 300)); } }
    },
  };
}

/* The keys a test presses: what the browser needs to know of each. */
function keyInfo(key) {
  const named = { ' ': ['Space', 32, ' '], Enter: ['Enter', 13, '\r'], Escape: ['Escape', 27], Backspace: ['Backspace', 8], Tab: ['Tab', 9], Shift: ['ShiftLeft', 16],
    ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40] };
  if (named[key]) { const [code, vk, text] = named[key]; return { code, windowsVirtualKeyCode: vk, text }; }
  if (/^[a-z]$/i.test(key)) return { code: 'Key' + key.toUpperCase(), windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0), text: key };
  if (/^\d$/.test(key)) return { code: 'Digit' + key, windowsVirtualKeyCode: key.charCodeAt(0), text: key };
  return { code: key, windowsVirtualKeyCode: 0, text: key.length === 1 ? key : undefined };
}

/* A tab, for showing pages one after another. */
async function openTab(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (method, params) => cdp.send(method, params, sessionId);
  let serve = null, onDialog = null, loaded = null;
  const off = cdp.on(async (m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Fetch.requestPaused') {
      const p = m.params, r = (serve && serve(p.request, p.resourceType)) || { status: 404, body: '' };
      const body = Buffer.isBuffer(r.body) ? r.body : Buffer.from(String(r.body ?? ''));
      const headers = Object.entries({ 'Content-Type': r.type || 'text/plain', 'Access-Control-Allow-Origin': '*', ...(r.headers || {}) }).map(([name, value]) => ({ name, value }));
      s('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: r.status || 200, responseHeaders: headers, body: body.toString('base64') }).catch(() => {});
    } else if (m.method === 'Page.javascriptDialogOpening') {
      const a = onDialog ? onDialog(m.params) : { accept: true };
      s('Page.handleJavaScriptDialog', a).catch(() => {});
    } else if (m.method === 'Page.loadEventFired') { if (loaded) loaded(); }
    else if (m.method === 'Runtime.bindingCalled' && m.params.name === '__intuiAct') {
      const a = JSON.parse(m.params.payload);
      try {
        if (a.act === 'click') {
          await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x, y: a.y });
          for (let c = 1; c <= a.count; c++) {
            await s('Input.dispatchMouseEvent', { type: 'mousePressed', x: a.x, y: a.y, button: 'left', buttons: 1, clickCount: c });
            await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x: a.x, y: a.y, button: 'left', buttons: 0, clickCount: c });
          }
        } else if (a.act === 'mouse') {
          await s('Input.dispatchMouseEvent', { type: a.type, x: a.x, y: a.y, button: a.type === 'mouseMoved' ? (a.held ? 'left' : 'none') : 'left', buttons: a.type === 'mousePressed' || (a.type === 'mouseMoved' && a.held) ? 1 : 0, clickCount: a.type === 'mouseMoved' ? 0 : 1 });
        } else if (a.act === 'resize') {
          await s('Emulation.setDeviceMetricsOverride', { width: a.width, height: a.height || 768, deviceScaleFactor: 1, mobile: false });
        } else if (a.act === 'text') {
          await s('Input.insertText', { text: a.text });
        } else if (a.act === 'key') {
          const k = keyInfo(a.key);
          await s('Input.dispatchKeyEvent', { type: a.up ? 'keyUp' : k.text ? 'keyDown' : 'rawKeyDown', key: a.key, ...k, ...(a.up ? { text: undefined } : {}) });
        }
      } finally { s('Runtime.evaluate', { expression: `window.__intuiDone(${a.id})` }).catch(() => {}); }
    }
  });
  await s('Page.enable');
  await s('Runtime.enable');
  await s('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await s('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
  await s('Emulation.setFocusEmulationEnabled', { enabled: true });
  await s('Runtime.addBinding', { name: '__intuiAct' });
  return {
    send: s,
    /* Shows the page at url. serve(request, resourceType) answers each request: { status, type, body }. */
    async open(url, { serve: answer, dialog, harness } = {}) {
      serve = answer; onDialog = dialog;
      const origin = new URL(url).origin;
      await s('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
      await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1023, y: 767 });   // (the pointer away from the page)
      await cdp.send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
      const added = harness ? (await s('Page.addScriptToEvaluateOnNewDocument', { source: harness })).identifier : null;
      try {
        let done = false;
        const fired = new Promise(r => { loaded = () => { done = true; r(); }; });
        const nav = await s('Page.navigate', { url });
        if (nav.errorText) throw new Error(`the page didn't open: ${nav.errorText}`);
        // loaded: its load event, or (if a navigation it started got in the way) its document is complete
        const complete = (async () => {
          for (let i = 0; i < 300 && !done; i++) {
            await new Promise(r => setTimeout(r, 50));
            const r = await s('Runtime.evaluate', { expression: `location.origin === ${JSON.stringify(new URL(url).origin)} && document.readyState`, returnByValue: true }).catch(() => null);
            if (r && r.result && r.result.value === 'complete') return;
          }
          if (!done) throw new Error("the page didn't finish loading");
        })();
        await Promise.race([fired, complete]);
      } finally {
        loaded = null;
        if (added) await s('Page.removeScriptToEvaluateOnNewDocument', { identifier: added });
      }
    },
    /* Runs JavaScript in the page and gives back its value (promises are waited for). */
    async run(expression, { timeout = 20000 } = {}) {
      const r = await Promise.race([s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }), new Promise((_, no) => setTimeout(() => no(new Error(`it didn't finish in ${timeout / 1000} seconds`)), timeout))]);
      if (r.exceptionDetails) {
        const e = r.exceptionDetails.exception;
        const err = new Error((e && (e.description || e.value)) || r.exceptionDetails.text);
        err.name = (e && e.className) || 'Error';
        throw err;
      }
      return r.result.value;
    },
    async close() { off(); await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); },
  };
}

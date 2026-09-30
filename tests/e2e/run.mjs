// End-to-end tests of the real desktop app (not the browser page): starts the built
// IntuiCode binary through tauri-driver and drives its window with WebDriver.
//
//   1. Build a debug app:   npm run tauri -- build --debug --no-bundle
//   2. Install the driver:  cargo install tauri-driver --locked
//      (Linux also needs WebKitWebDriver: sudo apt install webkit2gtk-driver;
//       Windows needs msedgedriver, e.g. from `msedgedriver-tool`)
//   3. Run:                 node tests/e2e/run.mjs        (Linux without a screen: xvfb-run node …)
//
// Environment: INTUICODE_APP (path to the binary), EDGE_DRIVER (Windows: msedgedriver.exe).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WIN = process.platform === 'win32';
const APP = process.env.INTUICODE_APP || path.join(ROOT, 'src-tauri/target/debug', WIN ? 'intuicode.exe' : 'intuicode');
const PORT = 4444;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

if (!existsSync(APP)) { console.error(`The app isn't built yet: ${APP}\nBuild it with: npm run tauri -- build --debug --no-bundle`); process.exit(2); }

/* ---------- tauri-driver and a tiny WebDriver client ---------- */
const driverArgs = WIN && process.env.EDGE_DRIVER ? ['--native-driver', process.env.EDGE_DRIVER] : [];
const driver = spawn('tauri-driver', driverArgs, { stdio: ['ignore', 'inherit', 'inherit'] });
driver.on('error', (e) => { console.error('Could not start tauri-driver (cargo install tauri-driver --locked):', e.message); process.exit(2); });
async function portOpen() {
  for (let i = 0; i < 100; i++) {
    const ok = await new Promise(res => { const s = net.connect(PORT, '127.0.0.1', () => { s.end(); res(true); }); s.on('error', () => res(false)); });
    if (ok) return;
    await sleep(200);
  }
  throw new Error('tauri-driver did not start');
}
async function wd(method, url, body) {
  const r = await fetch(`http://127.0.0.1:${PORT}${url}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (j.value && j.value.error) throw new Error(`${j.value.error}: ${j.value.message}`);
  return j.value;
}
let session;
const js = (fn, ...args) => wd('POST', `/session/${session}/execute/sync`, { script: `return (${fn}).apply(null, arguments)`, args });
/* check: an async function run here (use inPage() for code that runs in the window) */
async function waitFor(what, check, timeout = 60000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeout) {
    try { last = await check(); if (last) return last; } catch (e) { last = e.message; }
    await sleep(400);
  }
  throw new Error(`Timed out waiting for ${what}. Terminal:\n${await terminal().catch(() => '?')}`);
}
const inPage = (fn) => () => js(fn);
const terminal = () => js(() => document.getElementById('termLog').innerText);
const clearTerminal = () => js(() => { document.getElementById('btnClear').click(); return true; });
const setSentences = (text) => js((t) => { const ta = document.getElementById('ta'); ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true })); return true; }, text);
const click = (id) => js((i) => { document.getElementById(i).click(); return true; }, id);
const clickText = (selector, text) => js((sel, t) => { const el = [...document.querySelectorAll(sel)].find(e => e.textContent.trim().startsWith(t)); if (!el) return false; el.click(); return true; }, selector, text);
const typeInTerminal = (text) => js((t) => { const i = document.getElementById('termIn'); i.value = t; document.getElementById('termForm').requestSubmit(); return true; }, text);
const logHas = (text) => () => js((t) => document.getElementById('termLog').innerText.includes(t), text);
async function blueprint(title) {
  await click('btnBlueprints');
  if (!(await clickText('#bpList *', title))) throw new Error(`No blueprint called ${title}`);
  await sleep(200);
  if (!(await clickText('#bpDetail button', 'Build this project'))) throw new Error('No "Build this project" button');
  await sleep(300);
}

/* ---------- the tests ---------- */
const results = [];
async function check(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push([true, name]); console.log(`✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`); }
  catch (e) { results.push([false, name]); console.log(`✗ ${name}\n  ${String(e.message).split('\n').join('\n  ')}`); }
}

try {
  await portOpen();
  session = (await wd('POST', '/session', { capabilities: { alwaysMatch: { 'tauri:options': { application: APP } } } })).sessionId;

  await check('the window opens as the desktop app', async () => {
    await waitFor('the page', inPage(() => document.readyState === 'complete' && !!document.getElementById('ta')));
    const r = await js(() => ({ tauri: !!(window.__TAURI__ && window.__TAURI__.core), desktop: document.documentElement.classList.contains('desktop'), save: !document.getElementById('btnSave').hidden }));
    if (!r.tauri || !r.desktop || !r.save) throw new Error(JSON.stringify(r));
  });

  await check('File → New project makes an empty project of the chosen kind', async () => {
    const r = await js(() => {
      document.getElementById('btnFile').click();
      document.getElementById('btnNew').click();
      document.querySelector('.new-kind[data-kind="structured"]').click();
      document.getElementById('newName').value = 'e2e new project';
      document.getElementById('newSave').checked = false;   // (a folder dialog can't be answered from here)
      document.getElementById('newGo').click();
      return { files: [...document.querySelectorAll('#tree .ti-file')].map(x => x.textContent), folder: document.getElementById('folderName').textContent, sentences: document.getElementById('ta').value };
    });
    if (r.files.join() !== 'settings.py,tools.py,main.py' || r.folder !== 'not saved yet' || r.sentences !== '') throw new Error(JSON.stringify(r));
  });

  let hasPython = false;
  await check('finds the computer\'s Python, C++ compiler and Git', async () => {
    await waitFor('the desktop setup message', logHas('Desktop app:'));
    const found = await js(() => window.__TAURI__.core.invoke('find_python').then(p => p));
    hasPython = !!found;
    const cpp = await js(() => window.__TAURI__.core.invoke('find_cpp'));
    console.log(`  Python: ${found ? found[1] : 'none'} · C++: ${cpp ? cpp.join(' / ') : 'none'}`);
    if (WIN && (!cpp || cpp[0] !== 'msvc')) throw new Error('On Windows, Visual Studio\'s compiler should be found first, got ' + JSON.stringify(cpp));
  });

  await check('runs a Python program with the real Python, typing input into it', async () => {
    await clearTerminal();
    await blueprint('Empty script');
    await setSentences('ask "What is your name? " and store in name\nshow "Hello, {name}!"');
    await click('btnRun');
    await waitFor('the question', logHas('What is your name?'), 60000);
    await typeInTerminal('Ada');
    await waitFor('the answer', logHas('Hello, Ada!'));
    await waitFor('the end of the run', logHas('Finished'));
    if (!hasPython) console.log('  (no Python on this computer: the built-in Python ran it)');
  });

  await check('a Python error points back to its sentence', async () => {
    await clearTerminal();
    await setSentences('set n to 0\nshow 10 divided by n');
    await click('btnRun');
    await waitFor('the error', logHas('Go to Main program, line 2'), 60000);
  });

  await check('the tutor points out a Python habit, and checks a line you write', async () => {
    await blueprint('Empty script');
    await setSentences('create list names with "Ann", "Bo"\nfor each name in names\n    show name');
    await click('btnTutor');
    await js(() => { const ta = document.getElementById('ta'); const p = ta.value.indexOf('for each') + 3; ta.focus(); ta.setSelectionRange(p, p); ta.dispatchEvent(new Event('click')); return true; });
    await waitFor('a tip balloon', () => js(() => !document.getElementById('tip').hidden && /In Python/.test(document.getElementById('tip').innerText)), 120000);
    const verdict = await js(() => {
      const tip = document.getElementById('tip');
      tip.querySelector('.btn.primary[data-act="close"]').click();
      document.querySelector('[data-tutor="turn"]').click();
      tip.querySelector('.tip-in').value = 'for name in names :';
      tip.querySelector('[data-act="check"]').click();
      const out = tip.querySelector('.tip-result').innerText;
      tip.querySelector('[data-act="close"]').click();
      document.getElementById('btnTutor').click();   // tutor off again for the tests after this one
      return out;
    });
    if (!/Exactly right/.test(verdict)) throw new Error(verdict);
  });

  await check('the project builder narrows a project down and lays out its steps', async () => {
    const r = await js(() => {
      const pick = (label) => { const b = [...document.querySelectorAll('#bldBody [data-opt]')].find(x => x.textContent.trim().startsWith(label)); if (!b) throw new Error('No option ' + label); b.click(); };
      document.getElementById('btnFile').click();
      document.getElementById('btnBuilder').click();
      pick('App'); pick('PC'); pick('Audio workstation');
      const mixer = document.querySelector('#bldBody [data-step="mixer"]'); if (!mixer.checked) mixer.click();
      document.getElementById('bldName').value = 'e2e studio';
      document.getElementById('bldGo').click();
      const steps = [...document.querySelectorAll('#plan .plan-step')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
      const blanks = [...document.querySelectorAll('#problems li')].filter(li => /Fill in the/.test(li.textContent)).length;
      document.querySelectorAll('#plan .plan-step')[3].click();
      const title = document.getElementById('stepTitle').textContent;
      document.getElementById('stepClose').click();
      return { steps, blanks, title, open: !document.getElementById('builderModal').hidden };
    });
    if (r.open || r.steps.length < 4 || !/^1\s*Sound in and out/.test(r.steps[0]) || !r.steps.some(s => /Mixer/.test(s) && /Hallway/i.test(s)) || r.blanks < 1 || !/^Step 4 of/.test(r.title)) throw new Error(JSON.stringify(r));
  });

  await check('runs a shell command with $', async () => {
    await clearTerminal();
    await typeInTerminal('$ echo shell-says-hi');
    await waitFor('the output', logHas('shell-says-hi'));
  });

  await check('reads and writes real files, only in allowed folders', async () => {
    const elsewhere = mkdtempSync(path.join(os.tmpdir(), 'intuicode-e2e-'));
    const r = await wd('POST', `/session/${session}/execute/async`, {
      script: `const [elsewhere, done] = arguments; const I = window.__TAURI__.core.invoke;
        (async () => {
          const dir = (await I('scratch_folder')) + '/e2e';
          await I('write_text', { path: dir + '/site/index.html', content: '<h1 id="t">Hi</h1>' });
          const back = await I('read_text', { path: dir + '/site/index.html' });
          const list = await I('read_folder', { path: dir + '/site' });
          const refused = async (cmd, args) => { try { await I(cmd, args); return false; } catch (e) { return true; } };
          return {
            back, names: list.map(f => f.name),
            refused: [
              await refused('write_text', { path: elsewhere + '/x.txt', content: 'x' }),
              await refused('read_text', { path: dir + '/../../x.txt' }),
              await refused('run_program', { id: 999, program: 'definitely-not-allowed', args: [], cwd: dir }),
            ],
          };
        })().then(done, (e) => done({ error: String(e) }));`,
      args: [elsewhere],
    });
    if (r.error || r.back !== '<h1 id="t">Hi</h1>' || !r.names.includes('site/index.html') || r.refused.includes(false)) throw new Error(JSON.stringify(r));
  });

  await check('the website preview runs in its own sandbox', async () => {
    await clearTerminal();
    await blueprint('To-do list page');
    // wait until the preview has settled on one page: a page that loads again under the test ends it
    let lastSrc = '', steady = 0;
    await waitFor('the preview to settle on its address', async () => {
      const src = await js(() => document.getElementById('preview').src);
      steady = /preview/.test(src) && src === lastSrc ? steady + 1 : 0;
      lastSrc = src;
      return steady >= 3;
    }, 30000);
    const frame = await wd('POST', `/session/${session}/element`, { using: 'css selector', value: '#preview' });
    await wd('POST', `/session/${session}/frame`, { id: frame });
    try {
      const inside = await waitFor('the page in the preview', () => js(() => document.body && document.body.innerText.trim() ? {
        parent: (() => { try { return typeof parent.__TAURI__; } catch (e) { return 'blocked'; } })(),
        storage: (() => { localStorage.setItem('e2e', 'kept'); return localStorage.getItem('e2e'); })(),
        tauriScripts: typeof window.__TAURI_INTERNALS__,
      } : null), 30000);
      if (inside.parent !== 'blocked' || inside.storage !== 'kept') throw new Error(JSON.stringify(inside));
      // On Windows, WebView2 runs Tauri's scripts in every frame, so the page may have Tauri's invoke.
      // What matters is that no command runs from it: its requests come from origin null, which Tauri
      // refuses, and the message route (forced by breaking fetch) only reaches the app from the window.
      const attempts = await wd('POST', `/session/${session}/execute/async`, {
        script: `const done = arguments[arguments.length - 1];
          const t = window.__TAURI_INTERNALS__;
          if (!t || typeof t.invoke !== 'function') return done({ invoke: 'none in this frame' });
          const attempt = () => Promise.race([
            t.invoke('find_git').then(() => 'IT RAN', (e) => 'refused: ' + String(e && e.message || e).slice(0, 80)),
            new Promise(r => setTimeout(() => r('no answer'), 4000)),
          ]);
          (async () => {
            const normal = await attempt();
            window.fetch = () => Promise.reject(new TypeError('no fetch here'));
            const messages = await attempt();
            return { normal, messages, webview: typeof (window.chrome && window.chrome.webview) };
          })().then(done, (e) => done({ error: String(e) }));`,
        args: [],
      });
      console.log(`  Tauri scripts in the preview: ${inside.tauriScripts} · commands: ${JSON.stringify(attempts)}`);
      if (JSON.stringify(attempts).includes('IT RAN') || attempts.error) throw new Error(JSON.stringify(attempts));
    } finally {
      await wd('POST', `/session/${session}/frame/parent`, {});
    }
  });

  await check('compiles and runs C++ with a class (Visual Studio on Windows, g++ elsewhere)', async () => {
    await clearTerminal();
    await blueprint('C++ bank account');
    await click('btnRun');
    await waitFor('the program\'s output', logHas('Sam has 75'), 180000);
    await waitFor('the refusal', logHas('That withdrawal was refused.'));
    const log = await terminal();
    console.log('  ' + (log.match(/▶ Compiling[^\n]*/) || [''])[0]);
  });

  await check('a C++ compiler error points back to its sentence', async () => {
    await clearTerminal();
    await setSentences('set total to 5\nc++: total = undefined_name;');
    await click('btnRun');
    await waitFor('the error', logHas('The compiler says'), 180000);
    await waitFor('the link', logHas('Go to Program, line 2'));
  });

  await check('an Arduino sketch is checked with arduino-cli (or explains how)', async () => {
    await clearTerminal();
    await blueprint('Arduino: blink a light');
    const cli = await js(() => window.__TAURI__.core.invoke('find_arduino'));
    await click('btnRun');
    if (!cli) { await waitFor('the explanation', logHas('arduino-cli')); console.log('  (arduino-cli is not installed here)'); return; }
    console.log('  ' + cli.join(' / '));
    await waitFor('the check', () => js(() => /The sketch builds|could not be checked|isn't installed yet/.test(document.getElementById('termLog').innerText)), 300000);
    if (!(await js(() => document.getElementById('termLog').innerText.includes('The sketch builds')))) throw new Error(await terminal());
  });

  await check('imported code opens as sentences, checked exact', async () => {
    await clearTerminal();
    await click('btnImport');
    await click('impExample');
    await waitFor('the example project', () => js(() => !!document.querySelector('#rdFiles .tree-item')), 180000);
    await waitFor('the page in the file list', () => js(() => { const b = [...document.querySelectorAll('#rdFiles .tree-item')].find(x => /index\.html/.test(x.textContent)); if (b) b.click(); return !!b; }));
    await waitFor('the button', () => js(() => !document.getElementById('btnToSentences').disabled), 120000);
    await click('btnToSentences');
    await waitFor('three checked files', () => js(() => (document.getElementById('termLog').innerText.match(/✓ static\/[\w.]+: checked/g) || []).length === 3), 60000);
  });
} catch (e) {
  results.push([false, 'setup']);
  console.log('✗ setup: ' + e.message);
} finally {
  if (session) await wd('DELETE', `/session/${session}`).catch(() => {});
  driver.kill();
}

const failed = results.filter(r => !r[0]);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);

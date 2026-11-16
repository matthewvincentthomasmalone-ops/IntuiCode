// The JavaScript writer's examples (tests/helpers/meaning_js.mjs), and the website's Structure and Styling
// examples (tests/helpers/meaning_html.mjs), in a real browser (tests/helpers/browser.mjs). The JavaScript ones are
// the same examples the stand-in page runs: here, each page is the website as built (its index.html, style.css and
// script.js, loaded by Chrome), and `then` clicks, types and presses keys with Chrome's own input.
import { openBrowser } from './browser.mjs';
import { makePage } from './page.mjs';
import { compileExample, jsNameOf } from './meaning_web.mjs';

/* What runs in each page before its own scripts: the `page` the examples use, a clock the test moves on, a seeded
   Math.random, and the recording of drawing, sound and the clipboard (each call is then done for real). */
const HARNESS = String.raw`(() => {
  if (window !== window.top) return;
  const realTimeout = window.setTimeout.bind(window), realNow = performance.now.bind(performance);
  const page = window.page = { logged: [], clipboard: [], notes: [], loaded: [], timers: [], frames: [], clock: 0, error: null, shown: [], requests: [], went: [] };
  addEventListener('error', (e) => { if (!page.error) page.error = e.error || new Error(e.message); });
  addEventListener('unhandledrejection', (e) => { if (!page.error) page.error = e.reason instanceof Error ? e.reason : new Error(String(e.reason)); });
  for (const k of ['log', 'error']) { const was = console[k].bind(console); console[k] = (...a) => { page.logged.push(a.map(String).join(' ')); was(...a); }; }
  // the clock: timers and frames wait until the test moves it on
  const later = (fn, ms, every, args) => { const t = { fn: typeof fn === 'function' ? () => fn(...args) : () => (0, eval)(String(fn)), at: page.clock + (Number(ms) || 0), every: every ? Math.max(1, Number(ms) || 0) : 0, id: page.timers.length + 1 }; page.timers.push(t); return t.id; };
  const stop = (id) => { const t = page.timers.find(x => x.id === id); if (t) t.gone = true; };
  window.setTimeout = (fn, ms, ...a) => later(fn, ms, false, a);
  window.setInterval = (fn, ms, ...a) => later(fn, ms, true, a);
  window.clearTimeout = stop; window.clearInterval = stop;
  window.requestAnimationFrame = (fn) => { page.frames.push(fn); return page.frames.length; };
  window.cancelAnimationFrame = () => {};
  performance.now = () => page.clock;
  Math.random = (() => { let s = 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  // drawing: each call recorded, with the colours as the page set them
  const P = CanvasRenderingContext2D.prototype;
  for (const prop of ['fillStyle', 'strokeStyle']) {
    const d = Object.getOwnPropertyDescriptor(P, prop);
    Object.defineProperty(P, prop, { get() { return d.get.call(this); }, set(v) { (this.__set ||= {})[prop] = v; d.set.call(this, v); }, configurable: true });
  }
  for (const f of ['clearRect', 'fillRect', 'strokeRect', 'beginPath', 'closePath', 'arc', 'fill', 'stroke', 'moveTo', 'lineTo', 'fillText', 'strokeText', 'drawImage', 'save', 'restore', 'translate', 'rotate', 'scale', 'rect', 'ellipse']) {
    const was = P[f];
    P[f] = function (...args) { const set = this.__set || {}; (this.calls ||= []).push({ call: f, args, fillStyle: set.fillStyle ?? this.fillStyle, strokeStyle: set.strokeStyle ?? this.strokeStyle, font: this.font, lineWidth: this.lineWidth }); return was.apply(this, args); };
  }
  Object.defineProperty(HTMLCanvasElement.prototype, 'pen', { get() { const c = this.getContext('2d'); c.calls ||= []; return c; }, configurable: true });
  // sound: each note recorded, then played
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    class Recorded extends AC {
      createOscillator() {
        const o = super.createOscillator(), start = o.start.bind(o), end = o.stop.bind(o);
        o.start = (at = 0) => { o.__from = Math.max(at, this.currentTime); return start(at); };   // a time already past means now, and the sound clock is already running
        o.stop = (at) => { page.notes.push({ frequency: o.frequency.value, from: o.__from ?? 0, to: at, type: o.type }); return end(at); };
        return o;
      }
    }
    window.AudioContext = Recorded; window.webkitAudioContext = Recorded;
  }
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { page.notes.push({ played: this.getAttribute('src') || this.src }); return play.call(this); };
  const img = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { get() { return img.get.call(this); }, set(v) { page.loaded.push(String(v)); img.set.call(this, v); }, configurable: true });
  if (navigator.clipboard) { const write = navigator.clipboard.writeText.bind(navigator.clipboard); navigator.clipboard.writeText = (t) => { page.clipboard.push(String(t)); return write(t); }; }
  // what a test does: through the browser's own input
  let n = 0;
  const waits = new Map();
  window.__intuiDone = (id) => { const w = waits.get(id); waits.delete(id); if (w) w(); };
  const act = (what) => new Promise((r) => { const id = ++n; waits.set(id, r); window.__intuiAct(JSON.stringify({ id, ...what })); });
  // waiting for what's waiting: a fetch, its JSON, and what waits on them. (It yields through a MessageChannel,
  // which a tab in the background doesn't slow down, as it does timers: for at least 25 ms, and until no fetch is
  // waiting for its answer.)
  let fetching = 0;
  const realFetch = window.fetch.bind(window);
  window.fetch = (...a) => { fetching++; return realFetch(...a).finally(() => { fetching--; }); };
  const yieldOnce = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  page.settle = async () => {
    const start = realNow();
    let quiet = 0;
    while (realNow() - start < 3000) { await yieldOnce(); quiet = fetching ? 0 : quiet + 1; if (quiet > 50 && realNow() - start >= 25) break; }
  };
  page.load = async () => {};
  page.el = (id) => { const e = document.getElementById(id); if (!e) throw new Error('the page has no element called ' + id); return e; };
  page.text = (id) => page.el(id).textContent;
  const at = (e, x, y) => { e.scrollIntoView({ block: 'center', inline: 'center' }); const r = e.getBoundingClientRect(); return x == null ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: r.left + x, y: r.top + y }; };
  page.click = async (id) => { await act({ act: 'click', count: 1, ...at(page.el(id)) }); await page.settle(); };
  page.dblclick = async (id) => { await act({ act: 'click', count: 2, ...at(page.el(id)) }); await page.settle(); };
  page.type = async (id, text) => { const e = page.el(id); e.focus(); if (e.select) e.select(); await act({ act: 'text', text: String(text) }); e.blur(); await page.settle(); };
  page.send = async (id) => { const f = page.el(id); f.requestSubmit(); await page.settle(); };
  page.key = async (key, where) => { if (where) page.el(where).focus(); else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); await act({ act: 'key', key }); await page.settle(); };
  page.keyUp = async (key) => { await act({ act: 'key', key, up: true }); await page.settle(); };
  let held = false;
  page.pointer = async (type, id, x, y) => {
    const how = { pointerdown: 'mousePressed', pointermove: 'mouseMoved', pointerup: 'mouseReleased' }[type];
    await act({ act: 'mouse', type: how, held, ...at(page.el(id), x, y) });
    held = how === 'mousePressed' ? true : how === 'mouseReleased' ? false : held;
    await page.settle();
  };
  page.choose = async (id, ...names) => { const dt = new DataTransfer(); for (const name of names) dt.items.add(new File([''], name)); const e = page.el(id); e.files = dt.files; e.dispatchEvent(new Event('change', { bubbles: true })); await page.settle(); };
  // for Structure and Styling: an element, its style as the browser works it out, the pointer over it, the window's width
  page.q = (sel) => { const e = document.querySelector(sel); if (!e) throw new Error('the page has no ' + sel); return e; };
  page.css = (sel, prop, pseudo) => getComputedStyle(page.q(sel), pseudo || null)[prop];
  page.hover = async (id) => { await act({ act: 'mouse', type: 'mouseMoved', ...at(page.el(id)) }); await page.settle(); };
  page.resize = async (width) => { await act({ act: 'resize', width }); await new Promise((r) => realTimeout(r, 50)); };
  page.tick = async (ms) => {
    const end = page.clock + ms;
    for (let guard = 0; guard < 10000; guard++) {
      const due = page.timers.filter(t => !t.gone && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      page.clock = due.at;
      if (due.every) due.at += due.every; else due.gone = true;
      try { await due.fn(); } catch (e) { if (!page.error) page.error = e; }
      await page.settle();
    }
    page.clock = end;
  };
  page.frame = async (count = 1) => { for (let i = 0; i < count; i++) { const fs = page.frames.splice(0); page.clock += 16; for (const f of fs) f(page.clock); await page.settle(); } };
  // a value as text, the same here and in Node: its type, then its JSON (with undefined, NaN and Infinity kept)
  window.__intuiValue = (v) => typeof v + ':' + JSON.stringify(v, (k, x) => (x === undefined ? '«undefined»' : typeof x === 'number' && !Number.isFinite(x) ? '«' + x + '»' : x));
})();`;
const valueText = (v) => typeof v + ':' + JSON.stringify(v, (k, x) => (x === undefined ? '«undefined»' : typeof x === 'number' && !Number.isFinite(x) ? '«' + x + '»' : x));

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
/* A tenth of a second of silence, as a WAV file. */
function silence() {
  const rate = 8000, n = rate / 10, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return b;
}
const WAV = silence();

/* Serves one website: its page, style and script, the replies its examples give, pictures and sounds. Records what
   it asks for (requests: fetch and the like; went: where it went). */
function server(origin, files, replies = {}) {
  const seen = { requests: [], went: [], pages: 0 };
  const local = (u) => { const x = new URL(u); return x.origin === origin ? x.pathname + x.search : u; };
  const answer = (request, kind) => {
    const url = request.url, where = new URL(url);
    if (kind === 'Document') {
      if (where.origin === origin && where.pathname === '/' && seen.pages++ === 0) return { type: 'text/html', body: files.html };
      seen.went.push(seen.pages > 1 && where.href === origin + '/' ? 'reload' : local(url));
      return { status: 204 };
    }
    if (where.origin === origin && where.pathname === '/style.css') return { type: 'text/css', body: files.css };
    if (where.origin === origin && where.pathname === '/script.js') return { type: 'text/javascript', body: files.js };
    if (kind === 'Fetch' || kind === 'XHR') {
      seen.requests.push({ url: local(url), method: request.method, body: request.postData });
      const key = Object.keys(replies).find(k => new URL(k, origin + '/').href === url);
      if (key === undefined) return { status: 404, type: 'application/json', body: 'null' };
      const said = replies[key];
      return { type: typeof said === 'string' ? 'text/plain' : 'application/json', body: typeof said === 'string' ? said : JSON.stringify(said) };
    }
    if (/\.(?:png|jpe?g|gif|webp)$/i.test(where.pathname)) return { type: 'image/png', body: PNG };
    if (/\.(?:wav|mp3|ogg)$/i.test(where.pathname)) return { type: 'audio/wav', body: WAV };
    return { status: 404 };
  };
  return { seen, answer };
}

/* Opens one website in the tab and runs `then`. -> { seen, raised } */
async function show(tab, k, files, ex) {
  const origin = `http://ex-${k}.localhost`;   // (a secure page, as on https: the clipboard is only there on one)
  const { seen, answer } = server(origin, files, ex.replies);
  const answers = [...(ex.answers || [])], shown = [];
  const dialog = (d) => {
    shown.push(d.message);
    if (d.type === 'prompt') { const a = answers.length ? answers.shift() : null; return a == null ? { accept: false } : { accept: true, promptText: String(a) }; }
    if (d.type === 'confirm') return { accept: answers.length ? !!answers.shift() : true };
    return { accept: true };
  };
  await tab.open(origin + '/', { serve: answer, dialog, harness: HARNESS });
  let raised = null;
  try {
    await tab.run('page.settle()');
    if (ex.then) await tab.run(`(async () => {\n${ex.then}\n})()`);
    await tab.run('page.settle()');
  } catch (e) { raised = e; }
  // what the browser saw, for the checks
  await tab.run(`page.shown = ${JSON.stringify(shown)}; page.requests = ${JSON.stringify(seen.requests)}; page.went = ${JSON.stringify(seen.went)}; 0`);
  if (!raised) {
    const e = await tab.run('page.error && { name: page.error.name || (page.error.constructor && page.error.constructor.name), message: String(page.error.message ?? page.error) }');
    if (e) raised = Object.assign(new Error(e.message), { name: e.name });
  }
  return { raised };
}

/* Runs one JavaScript example in the browser and checks it, as runOne does on the stand-in page. */
async function runJsOne(tab, k, ex, made) {
  const { raised } = await show(tab, k, { html: made.html, css: '', js: made.code }, ex);
  if (ex.raises) {
    return raised && (raised.name === ex.raises || String(raised.message).includes(ex.raises)) ? { ok: true } : { ok: false, why: `should stop with ${ex.raises}, but ${raised ? `stopped with ${raised.name}: ${raised.message}` : "didn't stop"}` };
  }
  if (raised) return { ok: false, why: `stopped with ${raised.name}: ${raised.message}` };
  if (ex.means !== undefined) {
    // what the words mean, worked out on a page of its own from the given lines only (as on the stand-in page)
    const own = makePage(made.html);
    own.ctx.page = own;
    if (ex.given) own.run(ex.given);
    const want = valueText(own.run(`(${ex.means})`));
    let got;
    try { got = await tab.run('__intuiValue(result)'); } catch (e) { return { ok: false, why: `has no result: ${e.message}` }; }
    if (got !== want) return { ok: false, why: `gave ${got}, but the words mean ${want}` };
  }
  if (ex.holds) {
    let ok;
    try { ok = await tab.run(`(${ex.holds})`); } catch (e) { return { ok: false, why: `${ex.holds}: ${e.message}` }; }
    if (!ok) return { ok: false, why: `${ex.holds} isn't true (shown: ${JSON.stringify(await tab.run('page.shown'))}, logged: ${JSON.stringify(await tab.run('page.logged'))})` };
  }
  return { ok: true };
}

/* Runs the JavaScript examples in a real browser. -> [{ ex, html, code, ok, why }] */
export function runJsInBrowser(WEB, examples) {
  return inTabs(examples, async (tab, k, ex) => {
    const made = compileExample(WEB, ex);
    if (made.errs.length) return { ex, ...made, ok: false, why: `doesn't translate: ${made.errs[0]}` };
    let r;
    try { r = await runJsOne(tab, k, ex, made); } catch (e) { r = { ok: false, why: `couldn't run in the browser: ${e.message}` }; }
    return { ex, ...made, ...r };
  });
}

/* Runs fn(tab, k, example) for each example, in a few tabs at once, and gives back the results in order. One the
   browser didn't answer in time (a busy computer) runs once more, in a new tab: one that hangs, hangs again. */
async function inTabs(examples, fn, count = 4) {
  const browser = await openBrowser();
  try {
    const out = new Array(examples.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(count, examples.length) }, async () => {
      let tab = await browser.tab();
      try {
        while (next < examples.length) {
          const k = next++;
          out[k] = await fn(tab, k, examples[k]);
          if (!out[k].ok && /didn't finish/.test(out[k].why || '')) {
            await tab.close();
            tab = await browser.tab();
            out[k] = await fn(tab, k, examples[k]);
          }
        }
      } finally { await tab.close(); }
    }));
    return out;
  } finally { await browser.close(); }
}

/* ---- Structure and Styling: the page and its style, checked in the browser ---- */

export function compileSite(WEB, ex) {
  const r = WEB.compileWebsite({ sections: [{ id: 'structure', file: 'structure', text: ex.page || '' }, { id: 'styling', file: 'styling', text: ex.style || '' }, { id: 'mechanics', file: 'mechanics', text: ex.mechanics || '' }] });
  return { html: r.results.structure.text, css: r.results.styling.text, code: r.results.mechanics.text, errs: [...r.results.structure.info, ...r.results.styling.info, ...r.results.mechanics.info].flatMap(i => i.errs) };
}
export const siteNameOf = (ex) => [ex.page, ex.style].filter(Boolean).join(' / ').replace(/\n\s*/g, ' / ');

/* Runs the Structure and Styling examples: each `holds` is checked in the page, as JavaScript (document,
   getComputedStyle, and `page`). -> [{ ex, html, css, ok, why }] */
export function runSiteInBrowser(WEB, examples) {
  return inTabs(examples, async (tab, k, ex) => {
      const made = compileSite(WEB, ex);
      if (made.errs.length) return { ex, ...made, ok: false, why: `doesn't translate: ${made.errs[0]}` };
      let r = { ok: true };
      try {
        const { raised } = await show(tab, 1000 + k, { html: made.html, css: made.css, js: made.code }, ex);
        if (raised) r = { ok: false, why: `stopped with ${raised.name}: ${raised.message}` };
        else for (const h of [].concat(ex.holds || [])) {
          let ok;
          try { ok = await tab.run(`(() => (${h}))()`); } catch (e) { r = { ok: false, why: `${h}: ${e.message}` }; break; }
          if (!ok) {
            const why = ex.why ? await tab.run(`(() => { try { return JSON.stringify(${ex.why}); } catch (e) { return e.message; } })()`) : '';
            r = { ok: false, why: `${h} isn't true${why ? ` (${why})` : ''}` };
            break;
          }
        }
      } catch (e) { r = { ok: false, why: `couldn't run in the browser: ${e.message}` }; }
      return { ex, ...made, ...r };
  });
}

export { jsNameOf };

/* ---- The Index for Structure and Styling: which of its entries an example says ---- */

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* A sentence's ‹slots› and a leading … are anything. A word's quoted text is any text and its numbers any number;
   the rest has to be there as it is. */
function sitePattern(e) {
  if (e.pattern) return new RegExp('^\\s*' + e.pattern.split(/‹[^›]*›|…/).map(escRe).join('.*?') + '\\s*$', 'i');
  let src = '';
  for (const m of e.words[0].matchAll(/"[^"]*"|\d+(?:\.\d+)?|\s+|[^\s"\d]+/g)) {
    const t = m[0];
    src += /^"/.test(t) ? '"[^"]*"' : /^\d/.test(t) ? '\\d+(?:\\.\\d+)?' : /^\s+$/.test(t) ? '\\s+' : escRe(t);
  }
  return new RegExp('(?:^|[\\s,:(])' + src + '(?=$|[\\s,;)])', 'i');
}

/* The writer's words for containers (CONTAINERS: "navigation bar" is <nav>) made wrong, one at a time: each gives
   the next different element. Only the examples whose page changes run again. -> { tried, missed: [word (as tag)] } */
export async function mutateContainers(WEB, examples, pick = () => true) {
  const C = WEB.CONTAINERS, keys = Object.keys(C), tags = [...new Set(Object.values(C))], missed = [];
  const before = examples.map(ex => compileSite(WEB, ex).html);
  let tried = 0;
  for (const k of keys) {
    if (!pick(k)) continue;
    const was = C[k], other = tags[(tags.indexOf(was) + 1) % tags.length];
    C[k] = other;
    try {
      const changed = examples.filter((ex, i) => compileSite(WEB, ex).html !== before[i]);
      if (!changed.length) continue;   // (no example says it: the coverage says so)
      tried++;
      if ((await runSiteInBrowser(WEB, changed)).every(r => r.ok)) missed.push(`${k} (written as <${other}>)`);
    } finally { C[k] = was; }
  }
  return { tried, missed };
}

/* The Structure and Styling entries of the Index, each with the examples (that pass) that say it. */
export function siteCoverage(WEB, results, notRun) {
  const entries = [];
  for (const sec of ['structure', 'styling']) {
    for (const t of [...WEB.TEMPLATES].filter(t => t.sections.includes(sec))) entries.push({ kind: 'statement', sec, label: `${sec}: ${t.pattern}`, pattern: t.pattern });
    for (const w of [...(WEB.WORDS[sec] || [])]) entries.push({ kind: 'value', sec, label: `${sec}: ${w[0]} → ${w[1]}`, words: [w[0], w[1]] });
  }
  for (const e of entries) {
    const re = sitePattern(e);
    e.examples = results.filter(r => r.ok).filter(r => String((e.sec === 'structure' ? r.ex.page : r.ex.style) || '').split('\n').some(l => re.test(l))).map(r => siteNameOf(r.ex));
    const k = Object.keys(notRun).find(k => e.label.startsWith(k));
    e.why = k ? notRun[k] : null;
  }
  return entries;
}

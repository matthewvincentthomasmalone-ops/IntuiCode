// A stand-in browser page for running a website's Mechanics in Node (tests/meaning.test.mjs). Not a browser:
// enough of one for the code IntuaCode writes to run, with everything it does to the world written down so a
// test can check it. The page's elements come from Structure's HTML. fetch answers from `replies` (and notes
// each request), timers and animation frames wait until the test moves the clock on (tick, frame), alert and
// friends note what they show, prompt and confirm take `answers`, a canvas pen and the sound note their calls.
import vm from 'node:vm';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, force) { const on = force ?? !this.set.has(c); if (on) this.set.add(c); else this.set.delete(c); return on; }
  contains(c) { return this.set.has(c); }
  get value() { return [...this.set].join(' '); }
  toString() { return this.value; }
}

/* Selectors: tag, #id, .group, and those joined (li.done), one inside another ("#list li"), several (", "). */
function matches(el, sel) {
  const parts = sel.trim().split(/\s+/);
  const one = (e, p) => {
    if (!e || !e.tagName) return false;
    for (const m of p.matchAll(/([#.]?)([\w-]+|\*)/g)) {
      if (m[1] === '#' && e.id !== m[2]) return false;
      if (m[1] === '.' && !e.classList.contains(m[2])) return false;
      if (!m[1] && m[2] !== '*' && e.tagName !== m[2].toUpperCase()) return false;
    }
    return true;
  };
  if (!one(el, parts[parts.length - 1])) return false;
  let at = el.parentNode;
  for (let i = parts.length - 2; i >= 0; i--) {
    while (at && !one(at, parts[i])) at = at.parentNode;
    if (!at) return false;
    at = at.parentNode;
  }
  return true;
}

class El {
  constructor(tag, attrs = {}, page) {
    this.tagName = tag.toUpperCase(); this.page = page; this.attrs = { ...attrs };
    this.children = []; this.parentNode = null; this.ownText = ''; this.listeners = {};
    this.style = {}; this.classList = new ClassList(this); this.dataset = {};
    if (attrs.class) attrs.class.split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
    this.value = attrs.value ?? ''; this.checked = 'checked' in attrs; this.hidden = 'hidden' in attrs;
    this.width = Number(attrs.width) || 300; this.height = Number(attrs.height) || 150; this.files = [];
  }
  get id() { return this.attrs.id || ''; }
  set id(v) { this.attrs.id = String(v); }
  get className() { return this.classList.value; }
  set className(v) { this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.ownText + this.children.map(c => c.textContent).join(''); }
  set textContent(v) { this.children = []; this.ownText = String(v); this.html = null; }
  get innerText() { return this.textContent; }
  set innerText(v) { this.textContent = v; }
  get innerHTML() { return this.html ?? this.textContent; }
  set innerHTML(v) { this.html = String(v); this.ownText = ''; this.children = []; parseInto(this, String(v), this.page); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { if (c.parentNode) c.remove(); c.parentNode = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach(c => this.appendChild(typeof c === 'string' ? Object.assign(new El('#text', {}, this.page), { ownText: c }) : c)); }
  prepend(c) { if (c.parentNode) c.remove(); c.parentNode = this; this.children.unshift(c); }
  remove() { if (this.parentNode) { const k = this.parentNode.children.indexOf(this); if (k >= 0) this.parentNode.children.splice(k, 1); this.parentNode = null; } }
  get firstChild() { return this.children[0] || null; }
  get lastChild() { return this.children[this.children.length - 1] || null; }
  get firstElementChild() { return this.firstChild; }
  all() { return this.children.filter(c => c.tagName !== '#TEXT').flatMap(c => [c, ...c.all()]); }
  querySelectorAll(sel) { return this.all().filter(e => sel.split(',').some(s => matches(e, s))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { let e = this; while (e && e.tagName && !matches(e, sel)) e = e.parentNode; return e && e.tagName ? e : null; }
  contains(e) { while (e) { if (e === this) return true; e = e.parentNode; } return false; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
  dispatchEvent(ev) {
    ev.target ||= this; ev.currentTarget = this;
    const out = (this.listeners[ev.type] || []).map(fn => fn.call(this, ev));
    if (ev.bubbles !== false && this.parentNode && !ev.stopped) out.push(this.parentNode.dispatchEvent(ev));
    return Promise.all(out);
  }
  click() { return this.dispatchEvent(this.page.event('click')); }
  focus() { this.page.focused = this; }
  blur() {}
  scrollIntoView() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height, right: this.width, bottom: this.height, x: 0, y: 0 }; }
  getContext() { return (this.pen ||= this.page.pen()); }
  showModal() { this.attrs.open = ''; }
  close() { delete this.attrs.open; }
}

/* HTML as the writers make it (well formed): elements, attributes and text. */
function parseInto(parent, html, page) {
  const stack = [parent];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/([\w-]+)\s*>|<([\w-]+)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)/gi)) {
    const top = stack[stack.length - 1];
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    if (m[2]) {
      const attrs = {};
      for (const a of m[3].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1]] = a[2] ?? a[3] ?? a[4] ?? '';
      const el = new El(m[2], attrs, page);
      top.appendChild(el);
      if (!VOID.has(m[2].toLowerCase()) && !m[0].endsWith('/>')) stack.push(el);
      continue;
    }
    if (m[4] && m[4].trim()) top.appendChild(Object.assign(new El('#text', {}, page), { ownText: m[4].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&') }));
  }
}

/* A page, and the context its script runs in. */
export function makePage(html = '', { replies = {}, answers = [] } = {}) {
  const page = { shown: [], logged: [], requests: [], timers: [], frames: [], clock: 0, notes: [], loaded: [], clipboard: [], went: [], answers: [...answers] };
  page.event = (type, more = {}) => ({ type, bubbles: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...more });
  page.pen = () => {
    const calls = [];
    const pen = { calls, fillStyle: '#000', strokeStyle: '#000', font: '10px sans-serif', lineWidth: 1, textAlign: 'start', canvas: null };
    for (const f of ['clearRect', 'fillRect', 'strokeRect', 'beginPath', 'closePath', 'arc', 'fill', 'stroke', 'moveTo', 'lineTo', 'fillText', 'strokeText', 'drawImage', 'save', 'restore', 'translate', 'rotate', 'scale', 'rect', 'ellipse'])
      pen[f] = (...args) => { calls.push({ call: f, args, fillStyle: pen.fillStyle, strokeStyle: pen.strokeStyle, font: pen.font, lineWidth: pen.lineWidth }); };
    pen.measureText = (t) => ({ width: String(t).length * 6 });
    return pen;
  };
  const doc = new El('#document', {}, page);
  const root = new El('html', {}, page);
  doc.appendChild(root);
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  const head = new El('head', {}, page), bodyEl = new El('body', {}, page);
  root.appendChild(head); root.appendChild(bodyEl);
  parseInto(bodyEl, body ? body[1] : html, page);
  const title = /<title>([\s\S]*?)<\/title>/i.exec(html);
  Object.assign(doc, {
    body: bodyEl, head, documentElement: root, title: title ? title[1] : '', readyState: 'loading',
    getElementById: (id) => doc.all().find(e => e.id === id) || null,
    createElement: (tag) => new El(tag, {}, page),
    createTextNode: (t) => Object.assign(new El('#text', {}, page), { ownText: String(t) }),
    get activeElement() { return page.focused || bodyEl; },
  });
  class Storage {
    constructor() { this.data = new Map(); }
    getItem(k) { return this.data.has(String(k)) ? this.data.get(String(k)) : null; }
    setItem(k, v) { this.data.set(String(k), String(v)); }
    removeItem(k) { this.data.delete(String(k)); }
    clear() { this.data.clear(); }
    get length() { return this.data.size; }
  }
  const later = (fn, ms, every) => { const t = { fn, at: page.clock + (Number(ms) || 0), every: every ? Math.max(1, Number(ms) || 0) : 0, id: page.timers.length + 1 }; page.timers.push(t); return t.id; };
  const stop = (id) => { const t = page.timers.find(x => x.id === id); if (t) t.gone = true; };
  class AudioContext {
    constructor() { this.currentTime = 0; this.destination = {}; page.sound = this; }
    createOscillator() { const o = { frequency: { value: 440, setValueAtTime(v) { this.value = v; } }, type: 'sine', connect() {}, start(at = 0) { o.from = at; }, stop(at) { o.to = at; page.notes.push({ frequency: o.frequency.value, from: o.from ?? 0, to: at, type: o.type }); } }; return o; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    resume() { return Promise.resolve(); }
  }
  class Image { constructor() { this.width = 32; this.height = 32; } set src(v) { this.url = v; page.loaded.push(v); setImmediate(() => this.onload && this.onload()); } get src() { return this.url; } }
  const reply = (url, opts) => {
    page.requests.push({ url: String(url), method: (opts && opts.method) || 'GET', body: opts && opts.body });
    const said = replies[url];
    return Promise.resolve({ ok: said !== undefined, status: said === undefined ? 404 : 200, json: async () => JSON.parse(JSON.stringify(said ?? null)), text: async () => (typeof said === 'string' ? said : JSON.stringify(said ?? null)) });
  };
  const ctx = {
    console: { log: (...a) => page.logged.push(a.map(String).join(' ')), error: (...a) => page.logged.push(a.map(String).join(' ')), warn() {}, info() {} },
    document: doc, localStorage: new Storage(), sessionStorage: new Storage(),
    alert: (m) => { page.shown.push(String(m)); }, confirm: (m) => { page.shown.push(String(m)); return page.answers.length ? !!page.answers.shift() : true; },
    prompt: (m) => { page.shown.push(String(m)); return page.answers.length ? String(page.answers.shift()) : null; },
    fetch: reply, setTimeout: (fn, ms) => later(fn, ms, false), setInterval: (fn, ms) => later(fn, ms, true), clearTimeout: stop, clearInterval: stop,
    requestAnimationFrame: (fn) => { page.frames.push(fn); return page.frames.length; }, cancelAnimationFrame() {},
    AudioContext, webkitAudioContext: AudioContext, Image, Audio: class { constructor(src) { this.src = src; } play() { page.notes.push({ played: this.src }); return Promise.resolve(); } pause() {} },
    navigator: { clipboard: { writeText: async (t) => { page.clipboard.push(String(t)); } }, userAgent: 'IntuaCode test page' },
    location: { set href(v) { page.went.push(String(v)); }, get href() { return page.went[page.went.length - 1] || 'http://localhost/'; }, reload() { page.went.push('reload'); } },
    performance: { now: () => page.clock }, Date, setImmediate, queueMicrotask,
    // (random, seeded, so a test gives the same numbers every time)
    Math: Object.assign(Object.create(Math), { random: (() => { let s = 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })() }),
    addEventListener: (type, fn) => { (page.windowListeners[type] ||= []).push(fn); }, removeEventListener() {},
    innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1,
  };
  page.windowListeners = {};
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  page.ctx = ctx; page.document = doc;
  page.run = (code, filename = 'script.js') => vm.runInContext(code, ctx, { filename, timeout: 2000 });
  // waiting for what's waiting: promises (a fetch, a reply's JSON) settle over a few turns
  page.settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); };
  const fire = async (target, ev) => { const out = target === 'window' ? Promise.all((page.windowListeners[ev.type] || []).map(fn => fn(ev))) : target.dispatchEvent(ev); await out.catch((e) => { page.error = e; }); await page.settle(); };
  page.load = async () => { doc.readyState = 'interactive'; await fire(doc, page.event('DOMContentLoaded', { bubbles: false })); doc.readyState = 'complete'; await fire('window', page.event('load')); };
  page.el = (id) => { const e = doc.getElementById(id); if (!e) throw new Error(`the page has no element called ${id}`); return e; };
  page.text = (id) => page.el(id).textContent;
  page.click = (id, more) => fire(page.el(id), page.event('click', more));
  page.dblclick = (id) => fire(page.el(id), page.event('dblclick'));
  page.type = async (id, text) => { const e = page.el(id); e.value = String(text); await fire(e, page.event('input')); await fire(e, page.event('change')); };
  page.send = (id) => fire(page.el(id), page.event('submit'));
  page.key = async (key, where) => { const ev = page.event('keydown', { key, code: key }); await fire(where ? page.el(where) : doc, ev); await fire('window', ev); return ev; };
  page.keyUp = async (key) => { const ev = page.event('keyup', { key, code: key }); await fire(doc, ev); await fire('window', ev); };
  page.pointer = (type, id, x, y) => fire(page.el(id), page.event(type, { offsetX: x, offsetY: y, clientX: x, clientY: y }));
  // moves the clock on: each timer that comes due runs (an "every" one, as many times as it comes due)
  page.tick = async (ms) => {
    const end = page.clock + ms;
    for (let guard = 0; guard < 10000; guard++) {
      const due = page.timers.filter(t => !t.gone && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      page.clock = due.at;
      if (due.every) due.at += due.every; else due.gone = true;
      try { await due.fn(); } catch (e) { page.error = e; }
      await page.settle();
    }
    page.clock = end;
  };
  page.frame = async (n = 1) => { for (let i = 0; i < n; i++) { const fs = page.frames.splice(0); page.clock += 16; for (const f of fs) f(page.clock); await page.settle(); } };
  return page;
}

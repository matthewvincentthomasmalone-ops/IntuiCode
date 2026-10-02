// The makers kit pack (lang/kits/makers.js): its pages run, its twists work, and its Python programs do what they say.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync, mkdtempSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { PYTHON, loadEngine, loadBuilder, kitAnswers } from './helpers/engine.mjs';

const { L, WEB } = loadEngine();
const B = loadBuilder();
const lib = B.library;
const ANSWERS = kitAnswers();
const MAKERS = ['flashcards', 'typing-test', 'password-maker', 'countdown', 'kitchen-converter', 'link-page', 'photo-booth', 'beat-grid', 'mood-playlist', 'weather-now', 'download-sorter', 'message-wall'];

/* A kit with all its steps, every blank answered. */
function project(kitId) {
  const p = B.build(lib, kitId, lib.kits[kitId].steps.map(s => s.id), 'test', []).project;
  for (const s of p.sections) for (const [k, v] of Object.entries(ANSWERS)) s.text = s.text.split(k).join(v);
  return p;
}

/* ------------------------------------------------------------------ */
/* Web kits: Mechanics run in a small stand-in for the page             */
/* ------------------------------------------------------------------ */

function element(tag, id, attrs = {}) {
  const on = {}, classes = new Set(String(attrs.class || '').split(/\s+/).filter(Boolean));
  const el = {
    tagName: tag.toUpperCase(), id, textContent: '', value: '', hidden: false, style: {}, children: [], files: [], src: '', paused: true,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c), toggle: (c, f) => { const v = f ?? !classes.has(c); v ? classes.add(c) : classes.delete(c); return v; } },
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); },
    addEventListener: (ev, fn) => (on[ev] = on[ev] || []).push(fn),
    append: (...k) => el.children.push(...k), replaceChildren: (...k) => { el.children = k; },
    getContext: () => new Proxy({}, { get: (t, p) => (p in t ? t[p] : () => ({ addColorStop() {} })), set: (t, p, v) => ((t[p] = v), true) }),
    dispatchEvent: (e) => { el.fire(e.type); return true; },
    async fire(ev) { if (el['on' + ev]) await el['on' + ev]({ target: el }); for (const fn of on[ev] || []) await fn({ preventDefault() {}, target: el }); },
  };
  return el;
}
async function runPage(kitId, { storage = {}, fetch } = {}) {
  const res = WEB.compileWebsite(project(kitId)).results;
  const els = {};
  for (const m of res.structure.text.matchAll(/<(\w+)([^>]*)\sid="([\w-]+)"([^>]*)>/g)) {
    const attrs = Object.fromEntries([...(m[2] + m[4]).matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
    els[m[3]] = element(m[1], m[3], attrs);
  }
  const all = Object.values(els), loaded = [], timers = [];
  const byClass = (q) => all.filter(el => q.startsWith('.') && el.classList.contains(q.slice(1)));
  const audioNode = () => new Proxy(function () {}, { get: (t, p) => (p === 'then' ? undefined : audioNode()), set: () => true, apply: () => audioNode() });
  const ctx = {
    document: { getElementById: (id) => els[id] || null, createElement: (t) => element(t, ''), addEventListener: (ev, fn) => ev === 'DOMContentLoaded' && loaded.push(fn),
      documentElement: element('html', ''), querySelectorAll: byClass, querySelector: (q) => byClass(q)[0] || null },
    localStorage: { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); } },
    setInterval: (fn) => timers.push(fn), setTimeout: (fn) => timers.push(fn), console: { log() {} }, alert() {},
    fetch: fetch || (async () => { throw new Error('offline'); }), navigator: { clipboard: { writeText: async () => {} } },
    AudioContext: class { constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; } resume() {} createGain() { return audioNode(); } createOscillator() { return audioNode(); }
      createBufferSource() { return audioNode(); } createBiquadFilter() { return audioNode(); } createBuffer() { return { getChannelData: () => new Float32Array(10) }; } },
    Audio: class { constructor() { this.src = ''; this.paused = true; } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } },
    Event: class { constructor(t) { this.type = t; } }, Math, Date, JSON, crypto: globalThis.crypto || webcrypto, matchMedia: () => ({ matches: false }), URL: { createObjectURL: (f) => 'blob:' + f.name },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(res.mechanics.text, ctx, { filename: `${kitId}/script.js` });
  for (const fn of loaded) await fn();
  return { els, storage, timers, ctx, tick: async () => { for (const fn of timers) await fn(); } };
}

for (const kitId of MAKERS.filter(k => lib.kits[k].layout === 'website')) {
  test(`${kitId}: the page runs: it loads, its timers tick, and every button and box can be used`, async () => {
    const page = await runPage(kitId);
    await page.tick();
    for (const el of Object.values(page.els)) {
      if (el.tagName === 'BUTTON') await el.fire('click');
      if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') { await el.fire('input'); await el.fire('change'); }
      if (el.tagName === 'FORM') await el.fire('submit');
    }
    await page.tick();
  });
}

test('flashcards: a right answer moves a card up a box and rests it; a wrong one sends it back to box 1', async () => {
  const { els, storage } = await runPage('flashcards');
  assert.equal(els.front.textContent, 'hola');
  await els.knew.fire('click');
  const deck = () => JSON.parse(storage.cards);
  assert.deepEqual([deck()[0].box, deck()[0].rest], [2, 1]);
  assert.equal(els.front.textContent, 'gracias');
  await els.missed.fire('click');
  assert.deepEqual([deck()[1].box, deck()[1].rest], [1, 0]);
});

test('typing test: words per minute, accuracy, and a best kept only when 90% is right', async () => {
  let now = 1_000_000;
  const page = await runPage('typing-test');
  page.ctx.Date = { now: () => now };
  const { els } = page;
  const text = els.passage.textContent;
  const typeIt = async (typed, ms = 150) => { for (let i = 1; i <= typed.length; i++) { now += ms; els.typed.value = typed.slice(0, i); await els.typed.fire('input'); } };
  await typeIt(text);
  // the clock starts at the first key, so the time covers one key fewer
  const wpm = Math.round(text.length / 5 / ((text.length - 1) * 0.15 / 60));
  assert.match(els.result.textContent, new RegExp(`^${wpm} words per minute, 100% right`));
  assert.equal(page.storage['best-wpm'], String(wpm));
  await els.again.fire('click');
  now += 1000;
  await typeIt(els.passage.textContent.replace(/[a-z]/g, 'x'), 50);   // three times as fast, but mostly wrong
  assert.match(els.result.textContent, /^\d+ words per minute, \d+% right/);
  assert.equal(page.storage['best-wpm'], String(wpm), 'a mostly wrong run is not a new best');
});

test('password maker: words from the list, picked securely, with the strength in bits', async () => {
  const { els } = await runPage('password-maker');
  const words = els.phrase.textContent.split('-');
  assert.equal(words.length, 6);
  assert.match(els.strength.textContent, /^Fair: 42 bits, one of 4,398,046,511,104 possible passphrases\.$/);
  els['word-count'].value = '8 words';
  await els['word-count'].fire('change');
  assert.match(els.strength.textContent, /^Strong: 56 bits, one of 72,057,594,037,927,936 /);
});

test('kitchen converter: a cup of flour and a cup of sugar weigh differently', async () => {
  const { els } = await runPage('kitchen-converter');
  Object.assign(els, {});
  els.direction.value = 'cups to grams';
  els['amount-box'].value = '1';
  els.ingredient.value = 'plain flour';
  await els.ingredient.fire('change');
  assert.equal(els['grams-result'].textContent, '1 cups of plain flour weigh about 125 g');
  els.ingredient.value = 'sugar';
  await els.ingredient.fire('change');
  assert.equal(els['grams-result'].textContent, '1 cups of sugar weigh about 200 g');
  els.scale.value = '°C to °F';
  els.degrees.value = '180';
  await els.degrees.fire('input');
  assert.equal(els['temperature-result'].textContent, '180 °C is 356 °F');
});

test('countdown: days to go, and a bar of how far along the wait is', async () => {
  const page = await runPage('countdown');
  const { els } = page;
  els['name-box'].value = 'Trip';
  els['date-box'].value = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  await els['new-event'].fire('submit');
  const row = els['event-list'].children[0];
  assert.match(row.textContent, /^Trip: \d+ days, \d+ hours to go$/);
  const track = row.children.find(c => c.className === 'track');
  assert.equal(track.children[0].style.width, '0%');
  const saved = JSON.parse(page.storage.events);
  saved[0].added -= 10 * 86400000;   // as if it had been added ten days ago
  const later = await runPage('countdown', { storage: { events: JSON.stringify(saved) } });
  const bar = later.els['event-list'].children[0].children.find(c => c.className === 'track').children[0];
  assert.ok(parseInt(bar.style.width) >= 48 && parseInt(bar.style.width) <= 52, bar.style.width);
});

test('weather now: what to wear comes from the forecast, and a failed request is explained', async () => {
  const answers = {
    geocoding: { results: [{ name: 'Lisbon', country: 'Portugal', latitude: 38.7, longitude: -9.1 }] },
    forecast: { current: { temperature_2m: 3, apparent_temperature: 1, weather_code: 63, wind_speed_10m: 45 },
      daily: { time: ['2026-10-01', '2026-10-02'], weather_code: [63, 0], temperature_2m_min: [1, 4], temperature_2m_max: [6, 9], precipitation_probability_max: [80, 10] } },
  };
  const fetch = async (url) => ({ json: async () => (/geocoding/.test(url) ? answers.geocoding : answers.forecast) });
  const { els } = await runPage('weather-now', { fetch });
  els['city-box'].value = 'Lisbon';
  await els.search.fire('submit');
  await new Promise(r => setTimeout(r, 10));
  assert.equal(els['place-name'].textContent, 'Lisbon, Portugal');
  assert.equal(els.conditions.textContent, 'Rain · feels like 1°C · wind 45 km/h');
  assert.equal(els['wear-advice'].textContent, 'Today: a warm coat, a hat and gloves; an umbrella or a waterproof; something windproof (and maybe not an umbrella).');
  assert.equal(els.days.children.length, 2);
  const offline = await runPage('weather-now');
  offline.els['city-box'].value = 'Lisbon';
  await offline.els.search.fire('submit');
  await new Promise(r => setTimeout(r, 10));
  assert.match(offline.els.status.textContent, /^Couldn't reach the weather service/);
});

test('mood playlist: with no files it says so; choosing a mood plays only that mood', async () => {
  const page = await runPage('mood-playlist');
  const { els } = page;
  assert.equal(els['now-title'].textContent, 'No songs yet');
  els['new-mood'].value = 'calm';
  els['song-files'].files = [{ name: 'Rain.mp3' }, { name: 'Sea.ogg' }];
  await els['song-files'].fire('change');
  els['new-mood'].value = 'energetic';
  els['song-files'].files = [{ name: 'Run.mp3' }];
  await els['song-files'].fire('change');
  assert.equal(els['song-list'].children.length, 3);
  els['mood-choice'].value = 'energetic';
  await els['mood-choice'].fire('change');
  assert.equal(els['now-title'].textContent, 'Run');
  els['mood-choice'].value = 'focus';
  await els['mood-choice'].fire('change');
  assert.equal(els['now-title'].textContent, 'No focus songs yet');
});

test('photo booth: a look is put on with a CSS filter and remembered', async () => {
  const page = await runPage('photo-booth');
  page.els['filter-2'].value = 'mono';
  await page.els['filter-2'].fire('change');
  assert.equal(page.els['photo-2'].className, 'photo mono');
  const again = await runPage('photo-booth', { storage: { ...page.storage } });
  assert.equal(again.els['photo-2'].className, 'photo mono');
  const css = WEB.compileWebsite(project('photo-booth')).results.styling.text;
  assert.match(css, /\.mono \{\n {2}filter: grayscale\(1\)/);
});

/* ------------------------------------------------------------------ */
/* Python kits                                                           */
/* ------------------------------------------------------------------ */

const tempDir = (name) => mkdtempSync(path.join(os.tmpdir(), `intuicode-${name}-`));
function writePython(p, dir) {
  const res = L.compileProject(p).results;
  for (const s of p.sections) writeFileSync(path.join(dir, s.file + '.py'), res[s.id].text);
}
function runPython(dir, args, input = '') {
  const r = spawnSync(PYTHON, args, { cwd: dir, input, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  return { ...r, stdout: (r.stdout || '').replace(/\r\n/g, '\n') };
}

test('download sorter: a dry run first, then a sort that never overwrites, logged, and undone', () => {
  const dir = tempDir('sorter');
  try {
    writePython(project('download-sorter'), dir);
    const settings = path.join(dir, 'settings.py');
    writeFileSync(settings, readFileSync(settings, 'utf8').replace('folder = Path.home() / "Downloads"', 'folder = Path(__file__).parent / "dl"'));
    const dl = path.join(dir, 'dl');
    mkdirSync(path.join(dl, 'Images'), { recursive: true });
    for (const f of ['photo.jpg', 'report.PDF', 'song.mp3', 'odd.xyz', '.hidden', 'film.part']) writeFileSync(path.join(dl, f), f);
    writeFileSync(path.join(dl, 'Images', 'photo.jpg'), 'older');
    const dry = runPython(dir, ['main.py'], 'no\n');
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /4 files to sort\. Nothing has moved yet[\s\S]*photo\.jpg {2}→ {2}Images[\s\S]*report\.PDF {2}→ {2}Documents[\s\S]*Nothing moved\./);
    assert.ok(existsSync(path.join(dl, 'photo.jpg')));
    const sorted = runPython(dir, ['main.py'], 'yes\n\n');
    assert.equal(sorted.status, 0, sorted.stderr);
    assert.match(sorted.stdout, /Moved photo\.jpg → Images\/photo \(2\)\.jpg/);
    assert.deepEqual(readdirSync(path.join(dl, 'Images')).sort(), ['photo (2).jpg', 'photo.jpg']);
    assert.equal(readFileSync(path.join(dl, 'sorted-log.csv'), 'utf8').trim().split('\n').length, 4);
    assert.ok(existsSync(path.join(dl, '.hidden')) && existsSync(path.join(dl, 'film.part')));
    const undone = runPython(dir, ['main.py'], 'undo\n');
    assert.equal(undone.status, 0, undone.stderr);
    assert.match(undone.stdout, /Undone\./);
    for (const f of ['photo.jpg', 'report.PDF', 'song.mp3', 'odd.xyz']) assert.ok(existsSync(path.join(dl, f)), f);
    assert.equal(readFileSync(path.join(dl, 'Images', 'photo.jpg'), 'utf8'), 'older');
    assert.ok(!existsSync(path.join(dl, 'sorted-log.csv')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Just enough of Flask to register the routes and call them, so the test needs nothing installed.
const FLASK_STAND_IN = `import json as _json
class _Request:
    def __init__(self): self._json, self.remote_addr = None, "127.0.0.1"
    def get_json(self, silent=False): return self._json
request = _Request()
class _Response:
    def __init__(self, body): self.body = body
def jsonify(*args, **kw): return _Response(_json.dumps(args[0] if args else kw))
class Flask:
    def __init__(self, name): self.routes = {}
    def route(self, path, methods=("GET",)):
        def deco(fn):
            for m in methods: self.routes[(m, path)] = fn
            return fn
        return deco
    def run(self, **kw): print("(would serve on port", kw.get("port"), ")")
    def call(self, method, path, json=None, addr="127.0.0.1"):
        request._json, request.remote_addr = json, addr
        out, status = self.routes[(method, path)](), 200
        if isinstance(out, tuple): out, status = out
        return [status, out.body if isinstance(out, _Response) else out]
`;
const CALL_WALL = `import json, time, main
from tools import app, open_database
calls = [app.call("GET", "/"), app.call("POST", "/api/messages", {"name": "Sam", "text": "  Hello  "}),
         app.call("POST", "/api/messages", {"name": "Sam", "text": "Again"}), app.call("POST", "/api/messages", {"text": " "}, "10.0.0.2"),
         app.call("POST", "/api/messages", {"text": "x" * 281}, "10.0.0.3")]
db = open_database()
with db:
    db.execute("INSERT INTO messages (name, text, created) VALUES (?, ?, ?)", ("Old", "yesterday", time.time() - 90000))
    db.execute("INSERT INTO messages (name, text, created) VALUES (?, ?, ?)", ("Mid", "this morning", time.time() - 43200))
calls.append(app.call("GET", "/api/messages"))
calls.append(db.execute("SELECT COUNT(*) FROM messages").fetchone()[0])
print(json.dumps(calls))
`;

test('message wall: the server serves the page, checks posts, slows floods, and messages fade and go after a day', () => {
  const dir = tempDir('wall');
  try {
    writePython(project('message-wall'), dir);
    writeFileSync(path.join(dir, 'flask.py'), FLASK_STAND_IN);
    writeFileSync(path.join(dir, 'call_wall.py'), CALL_WALL);
    const started = runPython(dir, ['main.py']);
    assert.equal(started.status, 0, started.stderr);
    assert.match(started.stdout, /The wall is ready: 0 messages in wall\.db\.[\s\S]*\(would serve on port 5000 \)/);
    const r = runPython(dir, ['call_wall.py']);
    assert.equal(r.status, 0, r.stderr);
    const [page, posted, flood, empty, long, list, rows] = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.equal(page[0], 200);
    assert.match(page[1], /^<!doctype html>[\s\S]*setInterval\(refresh, 3000\)/);
    assert.doesNotThrow(() => new vm.Script(page[1].split('<script>')[1].split('</script>')[0]));
    assert.equal(posted[0], 201);
    assert.deepEqual([flood[0], JSON.parse(flood[1]).error], [400, 'Slow down: one message every 10 seconds.']);
    assert.deepEqual([empty[0], JSON.parse(empty[1]).error], [400, "A message can't be empty."]);
    assert.equal(long[0], 400);
    const shown = JSON.parse(list[1]).map(m => [m.name, m.text, Math.round(m.fade * 10) / 10]);
    assert.deepEqual(shown, [['Mid', 'this morning', 0.5], ['Sam', 'Hello', 1]]);
    assert.equal(rows, 2, 'the day-old message is deleted');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// The everyday kit pack (lang/kits/everyday.js) at work: each website kit's page, with its blanks filled, runs
// in a small stand-in for a browser (a fake DOM, clock, storage and sound) and does what its steps say; the
// subscription checker runs with Python.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { PYTHON, loadEngine, loadBuilder, kitAnswers } from './helpers/engine.mjs';

const { L, WEB } = loadEngine();
const B = loadBuilder();
const lib = B.library;
const ANSWERS = kitAnswers();
const MIN = 60000, DAY = 86400000;

/* A kit's project, with the given steps (all of them unless said) and every blank answered. */
function project(kitId, ids) {
  const { project } = B.build(lib, kitId, ids || lib.kits[kitId].steps.map(s => s.id), 'test', []);
  for (const s of project.sections) for (const [k, v] of Object.entries(ANSWERS)) s.text = s.text.split(k).join(v);
  return project;
}

/* ------------------------------------------------------------------ */
/* A browser page, just enough of one                                  */
/* ------------------------------------------------------------------ */

class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, force) { const on = force === undefined ? !this.set.has(c) : !!force; if (on) this.set.add(c); else this.set.delete(c); return on; }
  contains(c) { return this.set.has(c); }
}
class El {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase(); this.id = attrs.id || ''; this.children = []; this.own = '';
    this.hidden = 'hidden' in attrs; this.classList = new ClassList(); this.style = {}; this.dataset = {};
    this.title = ''; this.value = attrs.value || ''; this.listeners = {}; this.onclick = null;
    (attrs.class || '').split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
  }
  get textContent() { return this.own + this.children.map(c => c.textContent).join(''); }
  set textContent(v) { this.own = String(v); this.children = []; }
  get lastElementChild() { return this.children[this.children.length - 1] || null; }
  get texts() { return this.children.map(c => c.textContent); }
  append(...cs) { this.children.push(...cs); }
  replaceChildren() { this.children = []; this.own = ''; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  dispatch(type) {
    const event = { type, target: this, preventDefault() {} };
    for (const fn of this.listeners[type] || []) fn(event);
    if (type === 'click' && this.onclick) this.onclick(event);
  }
  click() { this.dispatch('click'); }
  scrollIntoView() { this.scrolledTo = true; }
}
/* The generated HTML -> elements by id (the compiler writes it well-formed). */
function readPage(html) {
  const ids = {}, stack = [new El('body')];
  for (const m of html.slice(html.indexOf('<body')).matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi)) {
    if (m[4] != null) { if (m[4].trim()) stack[stack.length - 1].own += m[4].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); continue; }
    if (/^(body|script|html)$/i.test(m[2])) continue;
    if (m[1]) { stack.pop(); continue; }
    const attrs = Object.fromEntries([...m[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(a => [a[1], a[2] ?? '']));
    const el = new El(m[2], attrs);
    stack[stack.length - 1].append(el);
    if (el.id) ids[el.id] = el;
    if (!/^(img|input|hr|br|meta|link)$/i.test(m[2])) stack.push(el);
  }
  for (const el of Object.values(ids)) if (el.tagName === 'SELECT') el.value = el.children[0].textContent;
  return ids;
}
/* Runs a kit's page. The clock starts at 9:10 on Thursday 1 October 2026 unless told otherwise, and only
   moves when the test says; timers run as it passes. prompt and confirm answer from the lists given. */
function page(kitId, { ids, now = new Date(2026, 9, 1, 9, 10).getTime(), storage = {}, prompts = [], confirms = [] } = {}) {
  const res = WEB.compileWebsite(project(kitId, ids)).results;
  const els = readPage(res.structure.text);
  const clock = { now }, timers = [], store = new Map(Object.entries(storage));
  const log = { tones: 0, vibrations: [], wakeLocks: 0, prompts: [] };
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(clock.now); } static now() { return clock.now; } }
  class AudioContext {
    constructor() { this.currentTime = 0; this.destination = {}; }
    createOscillator() { return { frequency: { value: 0 }, connect: (n) => n, start: () => { log.tones++; }, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n }; }
  }
  const navigator = { vibrate: (p) => { log.vibrations.push(p); return true; }, wakeLock: { request: async () => { log.wakeLocks++; return {}; } } };
  const ctx = {
    Date: FakeDate, Math, JSON, Number, String, Object, Array, AudioContext, navigator, parseInt, console: { log() {} },
    document: { title: '', getElementById: (id) => els[id] || null, createElement: (tag) => new El(tag), addEventListener() {} },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    setInterval: (fn, ms) => timers.push({ fn, ms, next: clock.now + ms, every: true }),
    setTimeout: (fn, ms) => timers.push({ fn, ms, next: clock.now + ms, every: false }),
    prompt: (q, d) => { log.prompts.push([q, d]); return prompts.length ? prompts.shift() : null; },
    confirm: () => (confirms.length ? confirms.shift() : true),
    alert() {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(res.mechanics.text, ctx);
  const advance = (ms) => {
    const end = clock.now + ms;
    for (let due; (due = timers.filter(t => !t.done && t.next <= end).sort((a, b) => a.next - b.next)[0]);) {
      clock.now = due.next;
      if (due.every) due.next += due.ms; else due.done = true;
      due.fn();
    }
    clock.now = end;
  };
  const $ = (id) => els[id];
  return {
    $, clock, advance, store, log,
    saved: (key) => JSON.parse(store.get(key)),
    type: (id, v) => { els[id].value = v; },
    send: (id) => els[id].dispatch('submit'),
    click: (id) => els[id].click(),
    change: (id, v) => { els[id].value = v; els[id].dispatch('change'); },
    has: (el, group) => el.classList.contains(group),
  };
}

test('every everyday website kit builds a page whose Mechanics parses, with its walk steps alone and with all of them', () => {
  for (const kit of Object.values(lib.kits).filter(k => /^(fading-todos|tag-notes|focus-garden|day-planner|envelope-budget|fair-split|streaks|interval-coach|box-breathing)$/.test(k.id))) {
    const walk = kit.steps.filter(s => lib.components[s.id].depth === 'walk').map(s => s.id);
    for (const ids of [[], walk, null]) {
      const js = WEB.compileWebsite(project(kit.id, ids)).results.mechanics.text;
      assert.doesNotThrow(() => new vm.Script(js), `${kit.id}: ${js}`);
      assert.doesNotThrow(() => page(kit.id, { ids: ids || undefined }), kit.id);
    }
  }
});

/* ------------------------------------------------------------------ */
/* Productivity                                                         */
/* ------------------------------------------------------------------ */

test('Fading To-dos: adds, ticks, fades what is left alone, clears ticked tasks, and remembers', () => {
  const p = page('fading-todos');
  assert.equal(p.$('all-clear').hidden, false);
  p.type('task-box', '  Water the plants '); p.send('new-task');
  p.type('task-box', 'Call the bank'); p.send('new-task');
  p.type('task-box', '   '); p.send('new-task');
  assert.deepEqual(p.$('todos').texts, ['Water the plants', 'Call the bank']);
  assert.equal(p.$('all-clear').hidden, true);
  p.advance(3.5 * DAY);
  const [plants, bank] = p.$('todos').children;
  assert.equal(plants.style.opacity, 0.5, 'half a week of seven days: half faded');
  assert.equal(plants.title, 'Days untouched: 3');
  bank.click();
  assert.ok(p.has(p.$('todos').children[1], 'done'));
  p.$('todos').children[1].click();
  assert.equal(p.$('todos').children[1].style.opacity, 1, 'touched: fresh again');
  p.advance(30 * DAY);
  assert.equal(p.$('todos').children[0].style.opacity, 0.2, 'never fainter than 0.2');
  p.$('todos').children[0].click();
  p.click('clear-done');
  assert.deepEqual(p.$('todos').texts, ['Call the bank']);
  const again = page('fading-todos', { storage: Object.fromEntries(p.store), now: p.clock.now });
  assert.deepEqual(again.$('todos').texts, ['Call the bank']);
  assert.equal(again.$('todos').children[0].style.opacity, 0.2);
});

test('Tag Notes: newest first, a button for every #tag, filtering by tag, editing and deleting, remembered', () => {
  const p = page('tag-notes', { prompts: ['Buy oat milk #Errands', ''] });
  for (const text of ['Buy milk #errands', 'Plan the talk #work #Ideas\nslides first', 'Call Mum']) { p.type('note-box', text); p.send('new-note'); }
  assert.deepEqual(p.$('board').texts, ['Call Mum', 'Plan the talk #work #Ideas\nslides first', 'Buy milk #errands']);
  assert.deepEqual(p.$('filters').texts, ['#errands', '#ideas', '#work'], 'sorted, lowercase, no repeats');
  p.$('filters').children[2].click();
  assert.deepEqual(p.$('board').children.map(r => r.hidden), [true, false, true]);
  assert.ok(p.has(p.$('filters').children[2], 'chosen'));
  p.$('filters').children[2].click();
  assert.deepEqual(p.$('board').children.map(r => r.hidden), [false, false, false], 'clicked again: every note');
  p.$('board').children[2].click();
  assert.deepEqual(p.log.prompts[0], ['Change the note (empty it to delete it):', 'Buy milk #errands']);
  assert.equal(p.$('board').texts[2], 'Buy oat milk #Errands');
  p.$('board').children[0].click();
  assert.deepEqual(p.$('board').texts, ['Plan the talk #work #Ideas\nslides first', 'Buy oat milk #Errands']);
  assert.deepEqual(p.saved('tag-notes').map(n => n.text), ['Plan the talk #work #Ideas\nslides first', 'Buy oat milk #Errands']);
  assert.equal(p.$('no-notes').hidden, true);
});

test('Focus Garden: counts down from the clock, pauses, and every finished session grows the plant', () => {
  const p = page('focus-garden');
  assert.equal(p.$('clock').textContent, '25:00');
  p.click('start');
  assert.equal(p.$('start').textContent, 'Pause');
  p.advance(61000);
  assert.equal(p.$('clock').textContent, '23:59');
  p.click('start');
  assert.equal(p.$('start').textContent, 'Carry on');
  p.advance(10 * MIN);
  assert.equal(p.$('clock').textContent, '23:59', 'paused: no time passes');
  p.click('start');
  p.advance(24 * MIN);
  assert.equal(p.$('plant').textContent, '🌱');
  assert.equal(p.$('plant-name').textContent, 'A sprout · 1 sessions so far');
  assert.equal(p.$('status').textContent, 'Session done. Take a five-minute break.');
  assert.equal(p.$('clock').textContent, '25:00');
  assert.equal(p.log.tones, 3, 'the chime');
  assert.equal(p.log.vibrations.length, 1);
  for (let i = 0; i < 4; i++) { p.click('start'); p.advance(25 * MIN + 1000); }
  assert.equal(p.$('plant').textContent, '🌰', 'after the tree, a new seed');
  assert.equal(p.$('grown').textContent, '🌳');
  assert.equal(p.saved('focus-garden-sessions'), 5);
  assert.equal(page('focus-garden', { storage: Object.fromEntries(p.store) }).$('grown').textContent, '🌳');
});

test('Day Planner: half-hour blocks, plans by clicking, the current block highlighted, a saved plan per day', () => {
  const p = page('day-planner', { prompts: ['  Gym ', 'Standup'] });
  const rows = () => p.$('day').children;
  assert.equal(rows().length, 30, '7:00 to 21:30');
  assert.deepEqual([rows()[0].dataset.time, rows()[29].dataset.time], ['07:00', '21:30']);
  assert.match(p.$('date-line').textContent, /October/);
  assert.deepEqual(rows().map(r => p.has(r, 'now')).indexOf(true), 4, '9:10 is in the 9:00 block');
  assert.ok(p.has(rows()[3], 'past') && !p.has(rows()[4], 'past'));
  assert.ok(rows()[4].scrolledTo);
  rows()[4].click();
  assert.equal(rows()[4].textContent, 'Gym');
  assert.deepEqual(p.saved('planner-2026-10-1'), { '09:00': 'Gym' });
  p.advance(30 * MIN);
  assert.equal(rows().map(r => p.has(r, 'now')).indexOf(true), 5, 'the highlight moves on');
  rows()[6].click();
  p.click('clear-day');
  assert.deepEqual(rows().map(r => r.textContent).filter(Boolean), []);
  const tomorrow = page('day-planner', { storage: { 'planner-2026-10-1': '{"09:00":"Gym"}' }, now: new Date(2026, 9, 2, 8, 0).getTime() });
  assert.deepEqual(tomorrow.$('day').children.map(r => r.textContent).filter(Boolean), [], 'a new day starts empty');
});

/* ------------------------------------------------------------------ */
/* Money                                                                */
/* ------------------------------------------------------------------ */

test('Envelope Budget: spends from the chosen envelope, shows what is left, saves, and a new month refills', () => {
  const p = page('envelope-budget');
  assert.equal(p.$('cards').children.length, 5);
  assert.equal(p.$('total-left').textContent, '£1370.00');
  assert.equal(p.$('amount-box').step, 'any');
  p.$('cards').children[1].click();
  assert.ok(p.has(p.$('cards').children[1], 'chosen'));
  p.type('amount-box', '12.5'); p.send('spend-form');
  assert.equal(p.$('message').textContent, '£12.50 from Food: £287.50 left.');
  assert.equal(p.$('cards').children[1].dataset.left, '£287.50 left');
  assert.equal(p.$('cards').children[1].style.backgroundSize, `${287.5 / 300 * 100}% 100%`);
  p.type('amount-box', ''); p.send('spend-form');
  assert.equal(p.$('message').textContent, 'Type how much you spent, like 4.50.');
  p.$('cards').children[3].click();
  p.type('amount-box', '100'); p.send('spend-form');
  assert.equal(p.$('message').textContent, '£100.00 from Fun, which is now £20.00 over.');
  assert.ok(p.has(p.$('cards').children[3], 'over'));
  assert.equal(p.$('cards').children[3].dataset.left, '−£20.00 left');
  assert.equal(p.$('total-left').textContent, '£1257.50');
  assert.deepEqual(p.saved('envelopes').map(e => e.spent), [0, 12.5, 0, 100, 0]);
  const sameMonth = page('envelope-budget', { storage: Object.fromEntries(p.store) });
  assert.equal(sameMonth.$('total-left').textContent, '£1257.50');
  const november = page('envelope-budget', { storage: Object.fromEntries(p.store), now: new Date(2026, 10, 2).getTime() });
  assert.deepEqual(november.saved('envelopes').map(e => e.spent), [-750, -287.5, -90, 20, -150], 'what was left carries over');
  assert.equal(november.$('message').textContent, 'A new month: the envelopes are full again.');
});

test('Fair Split: people, expenses, where everyone stands, and few payments to settle up', () => {
  const p = page('fair-split', { confirms: [true, true] });
  for (const name of ['Ana', 'Ben', 'Cal', 'Ana', ' ']) { p.type('person-box', name); p.send('person-form'); }
  assert.deepEqual(p.$('crew').texts, ['Ana', 'Ben', 'Cal'], 'each name once');
  assert.ok(p.has(p.$('crew').children[0], 'payer'));
  p.type('what-box', 'Hotel'); p.type('cost-box', '90'); p.send('expense-form');
  p.$('crew').children[1].click();
  p.type('what-box', 'Dinner'); p.type('cost-box', '30.00'); p.send('expense-form');
  p.type('what-box', 'Taxi'); p.type('cost-box', ''); p.send('expense-form');
  assert.equal(p.$('payer-hint').textContent, 'Say what it was for, and how much.');
  assert.deepEqual(p.$('spends').texts, ['Hotel: £90.00, paid by Ana', 'Dinner: £30.00, paid by Ben']);
  assert.deepEqual(p.$('tally').texts, ['Ana is owed £50.00', 'Ben owes £10.00', 'Cal owes £40.00']);
  assert.ok(p.has(p.$('tally').children[0], 'owed') && p.has(p.$('tally').children[2], 'owes'));
  assert.deepEqual(p.$('payments').texts, ['Cal pays Ana £40.00', 'Ben pays Ana £10.00']);
  p.$('spends').children[1].click();
  assert.deepEqual(p.$('payments').texts, ['Ben pays Ana £30.00', 'Cal pays Ana £30.00']);
  assert.deepEqual(p.saved('split-people'), ['Ana', 'Ben', 'Cal']);
  const again = page('fair-split', { storage: Object.fromEntries(p.store) });
  assert.deepEqual(again.$('tally').texts, ['Ana is owed £60.00', 'Ben owes £30.00', 'Cal owes £30.00']);
  p.click('new-trip');
  assert.deepEqual([p.$('crew').texts, p.$('spends').texts, p.$('payments').texts], [[], [], ['Nobody owes anybody anything.']]);
});

test('Fair Split: a thirds split settles to the penny, in no more payments than people minus one', () => {
  const p = page('fair-split');
  for (const name of ['A', 'B', 'C', 'D']) { p.type('person-box', name); p.send('person-form'); }
  for (const [who, cost] of [[0, '10'], [1, '0.1'], [1, '0.2'], [2, '33.33']]) { p.$('crew').children[who].click(); p.type('what-box', 'x'); p.type('cost-box', cost); p.send('expense-form'); }
  const payments = p.$('payments').texts;
  assert.ok(payments.length <= 3, payments.join(' / '));
  const total = payments.reduce((sum, t) => sum + Number(t.match(/£([\d.]+)/)[1]), 0);
  assert.ok(Math.abs(total - 22.4225) < 0.02, `${total}`, 'what A, B and D owe: 43.63 shared four ways, less what they paid');
});

/* ------------------------------------------------------------------ */
/* Health                                                               */
/* ------------------------------------------------------------------ */

test('Streaks: four weeks from Monday, tap to mark, a streak that waits for today, a habit you can rename', () => {
  const p = page('streaks', { prompts: ['Walk 10,000 steps'] });
  const cells = () => p.$('grid').children;
  assert.equal(cells().length, 28);
  assert.deepEqual([cells()[0].textContent, cells()[24].textContent, cells()[27].textContent], ['7', '1', '4'], 'Monday 7 September to Sunday 4 October');
  assert.ok(p.has(cells()[24], 'today'));
  assert.deepEqual(cells().map(c => p.has(c, 'later')).filter(Boolean).length, 3);
  for (const i of [21, 22, 23]) cells()[i].click();
  assert.equal(p.$('streak-line').textContent, '🔥 3 days in a row', 'today not marked yet: the streak still counts');
  cells()[24].click();
  assert.equal(p.$('streak-line').textContent, '🔥 4 days in a row');
  cells()[22].click();
  assert.equal(p.$('streak-line').textContent, '🔥 2 days in a row', 'a gap ends it');
  assert.deepEqual(p.saved('streak-days').sort(), ['2026-10-1', '2026-9-28', '2026-9-30']);
  p.click('habit');
  assert.equal(p.$('habit').textContent, 'Walk 10,000 steps');
  const again = page('streaks', { storage: Object.fromEntries(p.store), now: new Date(2026, 9, 2, 7, 0).getTime() });
  assert.equal(again.$('habit').textContent, 'Walk 10,000 steps');
  assert.equal(again.$('streak-line').textContent, '🔥 2 days in a row', 'the next morning, still going');
});

test('Interval Coach: work and rest from the clock, a beep at each change, pips before it, your own lengths', () => {
  const p = page('interval-coach');
  assert.equal(p.$('round-line').textContent, '8 rounds: 40 s work, 20 s rest');
  p.click('go');
  assert.equal(p.log.wakeLocks, 1);
  assert.deepEqual([p.$('phase-name').textContent, p.$('clock').textContent, p.$('go').textContent], ['Work', '0:40', 'Pause']);
  assert.ok(p.has(p.$('app'), 'working'));
  assert.equal(p.log.tones, 1);
  p.advance(40000);
  assert.equal(p.log.tones, 5, 'three pips and the change');
  assert.deepEqual([p.$('phase-name').textContent, p.$('round-line').textContent], ['Rest', 'Round 1 of 8']);
  assert.ok(p.has(p.$('app'), 'resting') && !p.has(p.$('app'), 'working'));
  p.click('go');
  p.advance(5 * MIN);
  assert.equal(p.$('clock').textContent, '0:20', 'paused');
  p.click('go');
  p.advance(20000);
  assert.deepEqual([p.$('phase-name').textContent, p.$('round-line').textContent], ['Work', 'Round 2 of 8']);
  p.advance(7 * 40000 + 6 * 20000 + 500);
  assert.deepEqual([p.$('phase-name').textContent, p.$('go').textContent], ['Done. Well worked.', 'Start again'], 'no rest after the last round');
  p.click('reset');
  p.change('work-box', '30'); p.change('rest-box', 'abc'); p.change('rounds-box', '-2');
  assert.deepEqual(p.saved('interval-setup'), { work: 30, rest: 20, rounds: 1 });
  assert.equal(p.$('clock').textContent, '0:30');
  const again = page('interval-coach', { storage: Object.fromEntries(p.store) });
  assert.deepEqual([again.$('work-box').value, again.$('round-line').textContent], [30, '1 rounds: 30 s work, 20 s rest']);
});

test('Box Breathing: in, hold, out, hold with the circle, a buzz at each side, and a session that ends after a whole box', () => {
  const p = page('box-breathing');
  p.click('start');
  const now = () => [p.$('word').textContent, p.$('count').textContent, p.has(p.$('circle'), 'full')];
  assert.deepEqual(now(), ['Breathe in', '4', true]);
  p.advance(1000);
  assert.deepEqual(now(), ['Breathe in', '3', true]);
  p.advance(3000);
  assert.deepEqual(now(), ['Hold', '4', true]);
  p.advance(4000);
  assert.deepEqual(now(), ['Breathe out', '4', false]);
  p.advance(4000);
  assert.deepEqual(now(), ['Hold', '4', false]);
  assert.deepEqual(JSON.parse(JSON.stringify(p.log.vibrations)), [250, [60, 80, 60], 500, [60, 80, 60]]);
  p.advance(48000);
  assert.deepEqual(now(), ['Hold', '4', false], '1 minute is up, but mid-box: carry on');
  p.advance(4000);
  assert.deepEqual(now(), ['Well done: 4 boxes in 1 min.', '', false]);
  assert.equal(p.$('start').textContent, 'Start');
  const free = page('box-breathing');
  free.$('session-length').value = 'No limit';
  free.click('start');
  free.advance(10 * MIN);
  assert.equal(free.$('start').textContent, 'Stop');
});

/* ------------------------------------------------------------------ */
/* Subscription Check (Python)                                          */
/* ------------------------------------------------------------------ */

test('Subscription Check runs: examples, checked typing, totals, what renews this week, cancelling, and the file', () => {
  const res = L.compileProject(project('subscription-check')).results;
  const dir = mkdtempSync(path.join(os.tmpdir(), 'intuicode-subs-'));
  try {
    for (const f of ['settings', 'tools', 'main']) writeFileSync(path.join(dir, f + '.py'), res[f].text);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
    const run = (lines) => {
      const r = spawnSync(PYTHON, ['main.py'], { cwd: dir, input: lines.join('\n') + '\n', encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
      assert.equal(r.status, 0, r.stderr);
      return r.stdout.replace(/\r\n/g, '\n');
    };
    const out = run(['help', 'list', 'totals', 'soon', 'add', '', 'Gym', 'abc', '-5', '25', 'weekly', 'm', '31/10/2026', inDays(5),
      'add', 'Paper', '3', 'y', '2020-02-29', 'totals', 'soon', 'cancel', '9', '', 'cancel', '1', 'bogus', 'quit']);
    for (const expected of ['Subscriptions: 3.', '  add\n  list\n  totals\n  soon\n  cancel\n  help\n  quit',
      `  1. Music                   10.99 a month  renews ${inDays(3)}`, `  3. Cloud storage           99.00 a year   renews ${inDays(40)}`,
      'Each month: 27.23\nEach year:  326.76\nCosts the most: Music (10.99 a month)', '  Music                   10.99  in 3 days\nDue in the next 7 days: 10.99',
      'Please type a name.', "That isn't a price.", 'A price is more than 0.', 'Please type month or year.', 'Please write the date as year-month-day',
      `Added Gym: 25.00 a month, renewing ${inDays(5)}.`, 'Each month: 52.48\nEach year:  629.76\nCosts the most: Gym (25.00 a month)',
      '  Gym                     25.00  in 5 days\nDue in the next 7 days: 35.99', 'Please type a number from 1 to 5.', 'Removed Music. Remember to cancel it with the company too.',
      "There's no command 'bogus'.", 'Bye.']) {
      assert.ok(out.includes(expected), `expected ${JSON.stringify(expected)} in:\n${out}`);
    }
    const saved = JSON.parse(readFileSync(path.join(dir, 'subscriptions.json'), 'utf8'));
    assert.deepEqual(saved.map(s => s.name), ['Cloud storage', 'Films', 'Gym', 'Paper']);
    const paper = saved.find(s => s.name === 'Paper');
    const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    assert.equal(paper.day, 29, 'started on 29 February: due on the 29th');
    assert.match(paper.renews, new RegExp(`-02-${leap(+paper.renews.slice(0, 4)) ? 29 : 28}$`), 'yearly, on the 28th in years without a 29 February');
    assert.ok(paper.renews >= inDays(0) && paper.renews <= inDays(366));
    const again = run(['list', 'quit']);
    assert.match(again, /Subscriptions: 4\.[\s\S]*Gym +25\.00 a month  renews/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

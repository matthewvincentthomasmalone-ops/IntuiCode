// The games kit pack (lang/kits/games.js), played: each game's page runs in a small fake browser (elements by id,
// a canvas that records what's drawn, frames, timers, keys, taps, localStorage, Web Audio), and the checks make
// sure things move, collide, score and draw. The Lighthouse runs in Python with typed commands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { PYTHON, loadEngine, loadBuilder, kitAnswers } from './helpers/engine.mjs';

const { L, WEB } = loadEngine();
const B = loadBuilder();
const lib = B.library;
const ANSWERS = kitAnswers();
const WEB_GAMES = ['rooftop-runner', 'garden-keeper', 'paper-plane', 'melody-snake', 'colour-merge', 'word-of-the-day', 'memory-pairs', 'pixel-painter'];

/* ------------------------------------------------------------------ */
/* A fake browser page                                                  */
/* ------------------------------------------------------------------ */

function fakePage(html, js, { seed = 1, scale = 1, store = new Map() } = {}) {
  const drawn = [], notes = [], docListeners = {}, elements = {};
  const listen = (map, type, fn) => { (map[type] = map[type] || []).push(fn); };
  function makeContext(canvas) {
    const pen = { fillStyle: '#000', strokeStyle: '#000', font: '10px sans-serif', lineWidth: 1 };
    const rec = (op) => (...args) => drawn.push({ canvas: canvas.id, op, args, style: /stroke|lineTo|moveTo/.test(op) ? pen.strokeStyle : pen.fillStyle });
    for (const op of ['fillRect', 'clearRect', 'arc', 'fill', 'stroke', 'beginPath', 'moveTo', 'lineTo', 'fillText', 'closePath']) pen[op] = rec(op);
    return pen;
  }
  function makeElement(tag, id, attrs = {}) {
    const el = {
      tagName: tag.toUpperCase(), id, listeners: {}, textContent: attrs.text || '', value: '', hidden: false, href: attrs.href || '', download: '',
      addEventListener(type, fn) { listen(this.listeners, type, fn); },
      toDataURL: (type) => `data:${type || 'image/png'};base64,FAKE`,
    };
    if (tag === 'canvas') {
      el.width = +attrs.width; el.height = +attrs.height;
      el.clientWidth = el.width * scale;   // shown bigger or smaller than its own pixels, as on a phone
      const pen = makeContext(el);
      el.getContext = () => pen;
    }
    return el;
  }
  for (const m of html.matchAll(/<(\w+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*>([^<]*)/g)) {
    const attrs = Object.fromEntries([...m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(a => [a[1], a[2] ?? '']));
    if (attrs.id) elements[attrs.id] = makeElement(m[1], attrs.id, { ...attrs, text: m[3] });
  }
  // an event goes to its element, then bubbles up to the page
  function fire(el, type, ev) {
    const event = { type, target: el, preventDefault() {}, ...ev };
    for (const fn of (el && el.listeners[type]) || []) fn(event);
    for (const fn of docListeners[type] || []) fn(event);
  }
  let now = 0, frameQueue = [], timers = [], timerId = 0;
  const ctx = {
    console, Math: Object.create(Math),
    document: { getElementById: (id) => elements[id] || null, addEventListener: (type, fn) => listen(docListeners, type, fn) },
    requestAnimationFrame: (fn) => frameQueue.push(fn),
    setInterval: (fn, ms) => { timers.push({ id: ++timerId, fn, ms, at: now + ms, repeat: true }); return timerId; },
    setTimeout: (fn, ms) => { timers.push({ id: ++timerId, fn, ms, at: now + ms, repeat: false }); return timerId; },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    AudioContext: class { constructor() { this.currentTime = 0; this.destination = {}; } createOscillator() { const o = { frequency: { value: 0 }, connect() {}, start() { notes.push(o.frequency.value); }, stop() {} }; return o; } },
  };
  let s = seed;   // a seeded Math.random, so every run is the same
  ctx.Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(js, ctx, { filename: 'script.js' });
  function runTimers(until) {
    for (;;) {
      const due = timers.filter(t => t.at <= until).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      now = due.at;
      if (due.repeat) due.at += due.ms; else timers = timers.filter(t => t !== due);
      due.fn();
    }
    now = until;
  }
  const page = {
    elements, drawn, notes, store,
    /* a value from the page (lists and objects are copied out, so they compare like any other) */
    get: (code) => { const v = vm.runInContext(code, ctx); return v !== null && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; },
    run: (code) => (vm.runInContext(code, ctx), page),
    frames(n = 1) { for (let k = 0; k < n; k++) { drawn.length = 0; const q = frameQueue; frameQueue = []; for (const fn of q) fn(now); runTimers(now + 1000 / 60); } return page; },
    wait(ms) { runTimers(now + ms); return page; },
    keyDown: (key) => (fire(null, 'keydown', { key }), page),
    keyUp: (key) => (fire(null, 'keyup', { key }), page),
    press: (key) => page.keyDown(key).keyUp(key),
    pointer: (type, id, x, y) => (fire(elements[id], type, { offsetX: x, offsetY: y }), page),
    tap: (id, x, y) => page.pointer('pointerdown', id, x, y).pointer('pointerup', id, x, y),
    click: (id) => (fire(elements[id], 'click', {}), page),
    texts: () => drawn.filter(d => d.op === 'fillText').map(d => String(d.args[0])),
  };
  return page;
}

/* A kit built with some of its steps: "walk" (its walk steps), "all" (every step, blanks answered), or a list. */
function kitProject(kitId, which = 'all') {
  const kit = lib.kits[kitId];
  const ids = which === 'all' ? kit.steps.map(s => s.id) : which === 'walk' ? kit.steps.filter(s => lib.components[s.id].depth === 'walk').map(s => s.id) : which;
  const { project } = B.build(lib, kitId, ids, 'game', []);
  for (const s of project.sections) for (const [k, v] of Object.entries(ANSWERS)) s.text = s.text.split(k).join(v);
  return project;
}
function openKit(kitId, which, opts) {
  const r = WEB.compileWebsite(kitProject(kitId, which)).results;
  return fakePage(r.structure.text, r.mechanics.text, opts);
}

/* ------------------------------------------------------------------ */
/* Every web game runs                                                  */
/* ------------------------------------------------------------------ */

test('every web game in the pack runs for a few seconds of play, with its walk steps and with every step, and draws', () => {
  for (const kitId of WEB_GAMES) for (const which of ['walk', 'all']) {
    const p = openKit(kitId, which);
    for (const key of ['ArrowRight', ' ', 'ArrowUp', 'a', 'Enter', 'ArrowDown', 'r', 'ArrowLeft']) {
      p.frames(20).press(key);
      p.tap(kitId === 'paper-plane' || kitId === 'memory-pairs' || kitId === 'colour-merge' ? 'game' : Object.keys(p.elements).find(id => p.elements[id].getContext), 60, 60);
    }
    p.frames(30);
    assert.ok(p.drawn.length > 0, `${kitId} (${which}) draws every frame`);
  }
});

/* ------------------------------------------------------------------ */
/* Each game, played                                                    */
/* ------------------------------------------------------------------ */

test('Rooftop Runner: lands on roofs, jumps, collects lights, restarts after a fall; parallax and coyote time work', () => {
  const p = openKit('rooftop-runner', 'all');
  p.run('window.restarts = 0; const firstRestart = restart; restart = function () { window.restarts++; firstRestart(); };');
  p.frames(40);
  assert.equal(p.get('onRoof'), true);
  assert.equal(p.get('py'), 200 - 28, 'standing on the first roof');
  assert.ok(p.get('roofs[0].x') < 0, 'the roofs slide left');
  assert.ok(Math.abs(p.get('farShift') - 40 * 0.2 * 3) < 1, 'the far row moves at a fifth of the speed');
  // a held jump goes higher than a tapped one (the short hop)
  const highest = (holdFor) => {
    p.run('roofs = [makeRoof(-100, 2000, 200)]; py = 172; vy = 0; px = 90;'); p.frames(2); p.keyDown(' ');
    let top = 999;
    for (let i = 0; i < 60; i++) { if (i === holdFor) p.keyUp(' '); p.frames(1); top = Math.min(top, p.get('py')); }
    p.keyUp(' ');
    return top;
  };
  const held = highest(100), tapped = highest(1);
  assert.ok(held < tapped - 30, `held ${held}, tapped ${tapped}`);
  // coyote time: a jump a few frames after running off a ledge still works, but not without the Jump step
  const lateJump = (page) => {
    page.run('roofs = [makeRoof(-200, 297, 200)]; py = 172; vy = 0; px = 90;'); page.frames(1);
    for (let f = 0; page.get('onRoof') && f < 50; f++) page.frames(1);
    page.frames(2).press(' ');
    return page.get('vy');
  };
  assert.equal(lateJump(p), -10);
  assert.ok(lateJump(openKit('rooftop-runner', 'walk')) > 0, 'walk steps only: no coyote time');
  // lights
  p.run('roofs = [makeRoof(-100, 2000, 200)]; py = 172; vy = 0; score = 0; lights[0].x = px + 9 + speed; lights[0].y = py + 14;');
  p.frames(1);
  assert.equal(p.get('score'), 1);
  assert.deepEqual(p.texts(), ['Lights: 1']);
  assert.ok(p.drawn.some(d => d.op === 'fillRect' && d.style === '#ffd9a8'), 'the runner is drawn');
  // running without jumping ends in a restart
  p.run('restarts = 0; resetRoofs();'); p.frames(600);
  assert.ok(p.get('restarts') >= 1);
});

test('Garden Keeper: the gardener walks the grid and waters plants, plants wilt, slugs wander inside the garden, R restarts', () => {
  const p = openKit('garden-keeper', 'all');
  p.frames(1);
  assert.equal(p.drawn.filter(d => d.op === 'fillRect' && ['#8cbf6a', '#83b562'].includes(d.style)).length, 96, '12 by 8 lawn tiles');
  p.press('ArrowLeft').press('ArrowUp');
  assert.deepEqual([p.get('col'), p.get('row')], [0, 0], "can't walk off the garden");
  p.press('ArrowRight').press('ArrowDown');
  assert.deepEqual([p.get('col'), p.get('row')], [1, 1]);
  p.run('plants[0].water = 30; plants[1].water = 30').press(' ');
  assert.equal(p.get('plants[0].water'), 100, 'the plant at (2, 1) is next to (1, 1)');
  assert.equal(p.get('plants[1].water'), 30, 'the plant at (6, 2) is too far');
  p.run('slugs = []').wait(3000);
  assert.equal(p.elements.clock.textContent, '3 seconds');
  p.wait(40000);
  assert.equal(p.get('playing'), false);
  assert.match(p.elements.status.textContent, /^A plant wilted\. You kept the garden going for \d+ seconds\. Press R/);
  p.press('r');
  assert.equal(p.get('playing'), true);
  assert.equal(p.get('seconds'), 0);
  assert.equal(p.get('slugs.length'), 3);
  let outside = 0;
  for (let k = 0; k < 200; k++) {
    p.run('playing = true; col = 0; row = 0; for (const plant of plants) plant.water = 100').wait(500);
    outside += p.get('slugs.filter(s => s.col < 0 || s.col >= cols || s.row < 0 || s.row >= rows).length');
  }
  assert.equal(outside, 0, 'slugs never leave the garden');
  assert.notEqual(p.get('JSON.stringify(slugs)'), '[{"col":11,"row":7},{"col":11,"row":0},{"col":5,"row":7}]', 'slugs wander');
  p.run('slugs[0].col = col; slugs[0].row = row').frames(1);
  assert.equal(p.get('playing'), false);
  assert.match(p.elements.status.textContent, /^A slug got to you\./);
});

test('Paper Plane: a tap starts and lifts, the ground and walls crash, gaps score, the best is kept; the wind pushes and its streaks drift', () => {
  const store = new Map();
  const p = openKit('paper-plane', 'all', { store });
  p.frames(5);
  assert.equal(p.get('playing'), false);
  assert.ok(p.texts().includes('Tap to fly'));
  p.tap('game', 100, 100);
  assert.equal(p.get('playing'), true);
  assert.equal(p.get('vy'), -6.5);
  p.frames(200);
  assert.equal(p.get('playing'), false, 'no taps: down to the bottom, and a crash');
  // an autopilot that taps when below the middle of the next gap flies through many walls
  const fly = (page, frames) => {
    page.tap('game', 10, 10);
    for (let f = 0; f < frames && page.get('playing'); f++) {
      const aim = page.get('(() => { const w = walls.find(w => w.x + wallWidth > planeX - 25); return w.gapTop + gapSize / 2 + 20; })()');
      if (page.get('planeY') > aim && page.get('vy') > -2) page.tap('game', 50, 50);
      page.frames(1);
    }
    return page.get('score');
  };
  assert.ok(fly(openKit('paper-plane', 'walk'), 3000) >= 20, 'without wind');
  assert.ok(fly(p, 3000) >= 20, 'with the wind');
  assert.equal(Number(store.get('paper-plane-best')), p.get('best'));
  assert.ok(p.get('best') >= 20);
  // into a wall
  p.run('playing = true; planeY = 100; vy = 0; walls[0].x = planeX - 10; walls[0].gapTop = 400;').frames(1);
  assert.equal(p.get('playing'), false);
  // a down wind adds to gravity; streaks drift with where the wind is heading; the wind eases towards it
  p.tap('game', 1, 1);
  p.run('wind = 0.075; target = 0.075; streaks[0].y = 300;');
  const before = p.get('vy');
  p.frames(1);
  assert.ok(Math.abs(p.get('vy') - before - (0.3 + 0.075)) < 1e-9);
  assert.ok(Math.abs(p.get('streaks[0].y') - (300 + 0.075 * 60)) < 1e-9);
  p.run('wind = 0; target = 0.1').frames(60);
  assert.ok(p.get('wind') > 0.05 && p.get('wind') < 0.1, 'the wind catches up gradually');
  // a new page remembers the best
  assert.equal(openKit('paper-plane', 'all', { store }).get('best'), p.get('best'));
});

test('Melody Snake: arrows start and steer, no turning back into its neck, fruit grows it and plays the tune, walls and itself end it', () => {
  const p = openKit('melody-snake', 'all');
  p.frames(2);
  assert.ok(p.texts().includes('Press an arrow key to start'));
  p.press('ArrowUp');
  assert.equal(p.get('playing'), true);
  p.wait(100);
  assert.equal(p.get('JSON.stringify(snake[0])'), '{"col":8,"row":9}');
  p.press('ArrowRight').press('ArrowDown');   // two quick turns: down would be straight back
  assert.deepEqual([p.get('dx'), p.get('dy')], [1, 0]);
  p.wait(100);
  assert.equal(p.get('playing'), true);
  const eat = () => { p.run('fruit = makeCell(snake[0].col + dx, snake[0].row + dy)'); p.wait(100).frames(1); };
  for (let k = 0; k < 4; k++) eat();
  assert.equal(p.get('score'), 4);
  assert.equal(p.get('onSnake(fruit)'), false, 'new fruit is never under the snake');
  assert.deepEqual(p.notes.map(n => Math.round(n * 10) / 10), [329.6, 329.6, 349.2, 392], 'E, E, F, G: Ode to Joy');
  assert.equal(p.get('snake.length + grow'), 3 + 4 * 2, 'two cells longer per fruit (some of it still to grow)');
  p.run('snake = [makeCell(19, 5), makeCell(18, 5)]; dx = 1; dy = 0; movedDx = 1; movedDy = 0; grow = 0').wait(100);
  assert.equal(p.get('playing'), false, 'off the board');
  p.press('ArrowLeft').frames(1);
  assert.deepEqual([p.get('score'), p.get('snake.length'), p.get('place')], [0, 3, 0], 'a new game, and the tune from the start');
  p.run('snake = [makeCell(5,5), makeCell(5,6), makeCell(6,6), makeCell(6,5), makeCell(6,4)]; dx = 1; dy = 0; movedDx = 0; movedDy = -1; grow = 0').wait(100);
  assert.equal(p.get('playing'), false, 'into itself');
  p.press('ArrowLeft');
  p.run('snake = [makeCell(5,5), makeCell(5,6), makeCell(6,6), makeCell(6,5)]; dx = 1; dy = 0; movedDx = 0; movedDy = -1; grow = 0').wait(100);
  assert.equal(p.get('playing'), true, 'into the cell its tail is leaving is fine');
});

test('Colour Merge: tiles slide, lights that share nothing mix, white clears, each tile mixes once, swipes and keys both work', () => {
  const p = openKit('colour-merge', 'all');
  const board = () => p.get('cells.map(c => c.colour).join(" ")');
  const lay = (colours) => p.run(`[${colours}].forEach((c, k) => cells[k].colour = c); score = 0;`);
  const empty = Array(12).fill(0);
  assert.equal(p.get('cells.filter(c => c.colour).length'), 2, 'two tiles to start');
  lay([0, 0, 4, 2, ...empty]); p.press('ArrowLeft');
  assert.equal(p.get('cells[0].colour'), 6, 'red and green make yellow');
  assert.equal(p.get('score'), 6);
  assert.equal(p.get('cells.filter(c => c.colour).length'), 2, 'and a new tile appears');
  lay([4, 4, 0, 0, ...empty]); p.press('ArrowLeft');
  assert.equal(board(), '4 4 ' + Array(14).fill(0).join(' '), 'two reds share red: nothing moves, no new tile');
  lay([6, 1, 0, 0, ...empty]); p.press('ArrowLeft');
  assert.equal(p.get('cells[0].colour'), 0, 'yellow and blue make white, which clears');
  assert.equal(p.get('score'), 27);
  lay([4, 2, 1, 0, ...empty]); p.press('ArrowLeft');
  assert.deepEqual(p.get('cells.slice(0, 2).map(c => c.colour)'), [6, 1], 'a tile mixes once per slide');
  lay([4, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]); p.press('ArrowDown');
  assert.deepEqual([p.get('cells[12].colour'), p.get('cells[8].colour')], [3, 4], 'a column slides down: blue and green make cyan');
  lay([...Array(15).fill(0), 2]); p.pointer('pointerdown', 'game', 300, 300).pointer('pointerup', 'game', 120, 310);
  assert.equal(p.get('cells[12].colour'), 2, 'a swipe to the left');
  const before = board(); p.tap('game', 200, 200);
  assert.equal(board(), before, 'a tap is not a swipe');
  p.frames(1);
  assert.ok(p.texts().includes('Score 0') && p.texts().includes('G'), 'score and letters are drawn');
  p.click('again');
  assert.equal(p.get('cells.filter(c => c.colour).length'), 2);
  const w = openKit('colour-merge', 'walk');
  w.run('[4, 2, 0, 0].forEach((c, k) => cells[k].colour = c)'); w.press('ArrowRight');
  assert.deepEqual(w.get('cells.slice(0, 4).map(c => c.colour)'), [0, 0, 4, 2], 'walk steps only: tiles slide without mixing');
});

test('Word of the Day: one word a day, typing and Enter, colours with double letters, the end, and today\'s game kept with a streak', () => {
  const store = new Map();
  const p = openKit('word-of-the-day', 'all', { store });
  assert.equal(p.get('answer === words[day % words.length]'), true);
  p.run('answer = "APPLE"');
  const guess = (page, word) => { for (const ch of word) page.press(ch); page.press('Enter'); };
  guess(p, 'ab');
  assert.equal(p.elements.message.textContent, 'Not enough letters.');
  p.press('Backspace').press('Backspace').press('Shift').press('1').press('ArrowLeft');
  assert.equal(p.get('typed'), '');
  guess(p, 'paperx');
  assert.equal(p.get('guesses.join()'), 'PAPER', 'five letters at most');
  assert.deepEqual(p.get('judge("PAPER")'), ['near', 'near', 'right', 'near', 'no']);
  assert.deepEqual(p.get('judge("LLAMA")'), ['near', 'no', 'near', 'no', 'no'], 'each letter of the answer makes one yellow at most');
  p.frames(1);
  assert.deepEqual(p.drawn.filter(d => d.op === 'fillRect' && ['#538d4e', '#b59f3b'].includes(d.style)).map(d => d.style), ['#b59f3b', '#b59f3b', '#538d4e', '#b59f3b']);
  guess(p, 'apple');
  assert.equal(p.get('finished'), true);
  assert.equal(p.elements.message.textContent, 'Got it in 2. A new word tomorrow.');
  p.frames(1).press('z');
  assert.equal(p.get('typed'), '', 'no typing after the end');
  assert.equal(p.get('streak'), 1);
  assert.deepEqual(JSON.parse(store.get('word-of-the-day')).guesses, ['PAPER', 'APPLE']);
  const again = openKit('word-of-the-day', 'all', { store });
  assert.equal(again.get('guesses.join()'), 'PAPER,APPLE', 'opened again the same day');
  assert.equal(again.get('finished'), true);
  store.set('word-of-the-day', JSON.stringify({ day: 1, guesses: ['CRANE'], finished: false }));
  store.set('word-streak', '3');
  store.set('word-last-win', String(again.get('day') - 1));
  const tomorrow = openKit('word-of-the-day', 'all', { store });
  assert.equal(tomorrow.get('guesses.length'), 0, 'an old day\'s game is ignored');
  guess(tomorrow, tomorrow.get('answer')); tomorrow.frames(1);
  assert.equal(tomorrow.get('streak'), 4, 'solved yesterday too: the streak grows');
  const lost = openKit('word-of-the-day', 'all', { store: new Map() });
  lost.run('answer = "APPLE"');
  for (const w of ['crane', 'plant', 'bread', 'chair', 'light', 'river']) guess(lost, w);
  assert.equal(lost.elements.message.textContent, 'The word was APPLE. A new one tomorrow.');
});

test('Memory Pairs: taps (scaled on a small screen) turn cards, pairs match by number, a third tap waits, tricky words come first next game', () => {
  const store = new Map();
  const p = openKit('memory-pairs', 'all', { store, scale: 0.5 });
  const cards = () => p.get('cards.map(c => ({ pair: c.pair, up: c.up, done: c.done }))');
  const tapCard = (k) => p.tap('game', (p.get(`cardX(${k})`) + 50) * 0.5, (p.get(`cardY(${k})`) + 50) * 0.5);
  const start = cards();
  assert.equal(start.length, 12);
  assert.ok([0, 1, 2, 3, 4, 5].every(n => start.filter(c => c.pair === n).length === 2), 'six pairs, two cards each');
  const other = start.findIndex((c, k) => k > 0 && c.pair !== start[0].pair);
  const third = start.findIndex((c, k) => k !== 0 && k !== other);
  tapCard(0); tapCard(other); tapCard(third);
  assert.equal(p.get('moves'), 1);
  assert.equal(cards()[third].up, false, 'a third card waits');
  p.wait(1000);
  assert.ok(!cards()[0].up && !cards()[other].up, 'a mismatch turns back');
  assert.equal(JSON.parse(store.get('pairs-tricky')).length, 2, 'both words are tricky now');
  const byPair = {};
  cards().forEach((c, k) => (byPair[c.pair] = byPair[c.pair] || []).push(k));
  for (const [x, y] of Object.values(byPair)) { tapCard(x); tapCard(y); p.wait(1000); }
  assert.ok(cards().every(c => c.done));
  assert.equal(p.get('lastPair'), 'All six pairs in 7 moves.');
  assert.deepEqual(p.get('tricky'), [], 'matched words leave the tricky list');
  p.run('tricky = ["school", "moon"]').click('again');
  assert.deepEqual(p.get('dealt.slice(0, 2).map(d => d[0]).sort()'), ['moon', 'school'], 'tricky pairs are dealt first');
  tapCard(0); tapCard(1); p.click('again').wait(1000);
  assert.equal(p.get('cards.filter(c => c.up).length'), 0, 'New game while waiting: nothing left turned up, and no error');
  const w = openKit('memory-pairs', 'walk');
  const pairs = w.get('cards.map(c => c.pair)'), twin = pairs.indexOf(pairs[0], 1);
  w.tap('game', w.get('cardX(0)') + 50, w.get('cardY(0)') + 50).tap('game', w.get(`cardX(${twin})`) + 50, w.get(`cardY(${twin})`) + 50).wait(1000);
  assert.equal(w.get(`cards[0].done && cards[${twin}].done`), true);
  assert.match(w.get('lastPair'), /^\S+ means \S+$/, 'the match shows the word and its meaning');
});

test('Pixel Painter: click and drag paint (scaled), the palette, rubber and colour box choose, the picture is kept, and exported as a PNG', () => {
  const store = new Map();
  const p = openKit('pixel-painter', 'all', { store, scale: 1.5 });
  const at = (col, row) => [(col * 20 + 10) * 1.5, (row * 20 + 10) * 1.5];
  const colour = (col, row) => p.get(`squares[${row * 16 + col}].colour`);
  p.pointer('pointerdown', 'art', ...at(3, 2)).pointer('pointerup', 'art', ...at(3, 2));
  assert.deepEqual([colour(3, 2), colour(2, 2), colour(4, 2)], ['#1d3557', '', '']);
  p.pointer('pointerdown', 'art', ...at(0, 5));
  for (let c = 1; c <= 6; c++) p.pointer('pointermove', 'art', ...at(c, 5));
  p.pointer('pointerup', 'art', ...at(6, 5)).pointer('pointermove', 'art', ...at(9, 9));
  assert.ok([0, 1, 2, 3, 4, 5, 6].every(c => colour(c, 5) === '#1d3557'), 'a drag paints every square it passes');
  assert.equal(colour(9, 9), '', 'moving after lifting paints nothing');
  p.tap('art', (4 * 32 + 16) * 1.5, 340 * 1.5);
  assert.equal(p.get('brush'), '#e63946', 'the fifth swatch');
  p.frames(1);
  assert.ok(p.drawn.some(d => d.op === 'fillRect' && d.style === '#1d1d1f'), 'the chosen swatch is underlined');
  p.tap('art', ...at(8, 8));
  assert.equal(colour(8, 8), '#e63946');
  p.tap('art', (9 * 32 + 16) * 1.5, 340 * 1.5).tap('art', ...at(8, 8));
  assert.equal(colour(8, 8), '', 'the rubber');
  p.elements.picker.value = '#00ff88'; p.pointer('change', 'picker');
  assert.equal(p.get('brush'), '#00ff88', 'the colour box');
  p.wait(2100);
  assert.equal(JSON.parse(store.get('pixel-painter')).filter(Boolean).length, 8);
  assert.equal(openKit('pixel-painter', 'all', { store }).get('squares[2 * 16 + 3].colour'), '#1d3557', 'kept when the page opens again');
  p.drawn.length = 0; p.click('download');
  const blocks = p.drawn.filter(d => d.canvas === 'exporter' && d.op === 'fillRect');
  assert.deepEqual([p.elements.exporter.width, p.elements.exporter.height], [128, 128]);
  assert.equal(blocks.length, 8, 'only painted squares: empty ones stay see-through');
  assert.deepEqual(blocks[0].args, [24, 16, 8, 8]);
  assert.match(p.elements.download.href, /^data:image\/png/);
  assert.equal(p.elements.download.download, 'pixel-art.png');
  p.click('clear-all');
  assert.equal(p.get('squares.every(s => s.colour === "")'), true);
});

test('The Lighthouse: the story plays from the jetty to the lit lamp, saving and loading on the way; the walk steps explore', () => {
  const play = (which, runs) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'intuicode-lighthouse-'));
    try {
      const project = kitProject('lighthouse', which);
      const res = L.compileProject(project).results;
      for (const s of project.sections) writeFileSync(path.join(dir, s.file + '.py'), res[s.id].text);
      return runs.map(typed => {
        const r = spawnSync(PYTHON, ['main.py'], { cwd: dir, input: typed.join('\n') + '\n', encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
        assert.equal(r.status, 0, r.stderr);
        return r.stdout.replace(/\r\n/g, '\n');
      });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  const [first, second] = play('all', [
    ['help', 'n', 'read logbook', 'open tin', 'take key', 'get matches', 'x matches', 'i', 'n', 'unlock door', 'n', 'up', 'down', 's', 's', 'e', 'take oil can', 'save', 'quit'],
    ['load', 'i', 'w', 'n', 'n', 'u', 'light lamp', 'fill lamp', 'light lamp', 'look'],
  ]);
  for (const expected of ['The jetty', 'Spare key where the gulls', 'Under a heel of stale bread', 'Taken: key.', 'A box of matches', "You're carrying: matches, key.",
    'The door is locked.', 'The key turns', 'The lamp room', 'You can see: oil can.', 'Saved.', 'Thanks for playing.']) {
    assert.ok(first.includes(expected), `expected ${JSON.stringify(expected)} in:\n${first}`);
  }
  for (const expected of ['Loaded.', "You're carrying: matches, oil can, key.", 'The wick is dry', 'You fill the lamp', 'THE END', 'Thanks for playing.']) {
    assert.ok(second.includes(expected), `expected ${JSON.stringify(expected)} in:\n${second}`);
  }
  assert.ok(second.indexOf('THE END') > second.indexOf('You fill the lamp'), 'lit only after it has oil');
  assert.ok(!second.slice(second.indexOf('THE END')).includes('The lamp room'), 'the story ends there');
  const [walk] = play('walk', [['n', 'n', 'read logbook', 'take logbook', 'drop logbook', 'take lamp', 'quit']]);
  for (const expected of ["The keeper's cottage", 'The door is locked.', "I don't know how to 'read'", 'Taken: logbook.', 'Dropped: logbook.', "There's no lamp here."]) {
    assert.ok(walk.includes(expected), `expected ${JSON.stringify(expected)} in:\n${walk}`);
  }
});

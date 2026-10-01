// The learning modules, website versions (lang/kits/modules-web.js): every kit builds, plain and annotated, its
// JavaScript parses, the annotated build carries each teach: line as a note and the plain one leaves them out,
// every stage of each course compiles and runs, and each game is played in a small fake browser (elements by id,
// a canvas that records what's drawn, frames, timers, keys, taps, localStorage): the snake moves, turns, eats,
// grows and dies; shots hit invaders; the night sky is drawn before the game; the brothers fall, land, jump,
// scroll, collect, and bring the power back at the fuse box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadEngine, loadBuilder, kitAnswers } from './helpers/engine.mjs';

const { WEB } = loadEngine();
const B = loadBuilder();
const lib = B.library;
const ANSWERS = kitAnswers();
const plain = (x) => JSON.parse(JSON.stringify(x));

/* The modules in course order: [plain kit, annotated kit, module name]. */
const MODULES = [
  ['snake-web', 'snake-web-notes', '1 · Snake'],
  ['invaders-web', 'invaders-web-notes', '2 · Invaders'],
  ['nightsky-web', 'nightsky-web-notes', '3 · Invaders under a night sky'],
  ['brothers-web', 'brothers-web-notes', '4 · Jacques & Louis G.'],
];
const KITS = MODULES.flatMap(([a, b]) => [a, b]);

/* ------------------------------------------------------------------ */
/* A fake browser page                                                  */
/* ------------------------------------------------------------------ */

function fakePage(html, js, { seed = 1, scale = 1, store = new Map() } = {}) {
  const drawn = [], docListeners = {}, elements = {};
  const listen = (map, type, fn) => { (map[type] = map[type] || []).push(fn); };
  function makeContext(canvas) {
    const pen = { fillStyle: '#000', strokeStyle: '#000', font: '10px sans-serif', lineWidth: 1 };
    const rec = (op) => (...args) => drawn.push({ canvas: canvas.id, op, args, style: /stroke|lineTo|moveTo/.test(op) ? pen.strokeStyle : pen.fillStyle });
    for (const op of ['fillRect', 'clearRect', 'arc', 'fill', 'stroke', 'beginPath', 'moveTo', 'lineTo', 'fillText', 'closePath']) pen[op] = rec(op);
    return pen;
  }
  function makeElement(tag, id, attrs = {}) {
    const el = { tagName: tag.toUpperCase(), id, listeners: {}, textContent: attrs.text || '', value: '', hidden: false, addEventListener(type, fn) { listen(this.listeners, type, fn); } };
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
    elements, drawn, store,
    /* a value from the page (lists and objects are copied out, so they compare like any other) */
    get: (code) => { const v = vm.runInContext(code, ctx); return v !== null && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; },
    run: (code) => (vm.runInContext(code, ctx), page),
    frames(n = 1) { for (let k = 0; k < n; k++) { drawn.length = 0; const q = frameQueue; frameQueue = []; for (const fn of q) fn(now); runTimers(now + 1000 / 60); } return page; },
    keyDown: (key) => (fire(null, 'keydown', { key }), page),
    keyUp: (key) => (fire(null, 'keyup', { key }), page),
    press: (key) => page.keyDown(key).keyUp(key),
    pointer: (type, id, x, y) => (fire(elements[id], type, { offsetX: x, offsetY: y }), page),
    tap: (id, x, y) => page.pointer('pointerdown', id, x, y).pointer('pointerup', id, x, y),
    texts: () => drawn.filter(d => d.op === 'fillText').map(d => String(d.args[0])),
    fills: (style) => drawn.filter(d => d.op === 'fillRect' && (style == null || d.style === style)),
  };
  return page;
}

/* ------------------------------------------------------------------ */
/* Building the kits                                                    */
/* ------------------------------------------------------------------ */

/* A kit built with "walk" (its walk steps), "all" (every step, blanks answered) or a list of step ids. */
function kitProject(kitId, which = 'all', library = lib) {
  const kit = library.kits[kitId];
  const ids = which === 'all' ? kit.steps.map(s => s.id) : which === 'walk' ? kit.steps.filter(s => library.components[s.id].depth === 'walk').map(s => s.id) : which;
  const { project } = B.build(library, kitId, ids, 'game', []);
  for (const s of project.sections) for (const [k, v] of Object.entries(ANSWERS)) s.text = s.text.split(k).join(v);
  return project;
}
const compiled = (project) => WEB.compileWebsite(project).results;
function problemsOf(project) {
  const r = compiled(project);
  return plain(project.sections.flatMap(s => r[s.id].info.flatMap((inf, i) => [...inf.errs, ...inf.warns].map(e => `${s.id} line ${i + 1}: ${e} (${s.text.split('\n')[i].trim()})`))));
}
function openKit(kitId, which, opts) {
  const r = compiled(kitProject(kitId, which));
  return fakePage(r.structure.text, r.mechanics.text, opts);
}
/* The teach: lines of a kit's steps, with their indentation. */
const teachLines = (kit) => kit.steps.flatMap(s => Object.values(lib.components[s.id].sections).flat()).map(l => l.match(/^(\s*)teach\s*:\s?(.*)$/i)).filter(Boolean);

/* ------------------------------------------------------------------ */
/* The kits                                                             */
/* ------------------------------------------------------------------ */

test('each module has a plain and an annotated website kit, on the modules shelf, sharing the same steps', () => {
  for (const [plainId, notesId, module] of MODULES) {
    const a = lib.kits[plainId], b = lib.kits[notesId];
    assert.ok(a && b, `${plainId} and ${notesId}`);
    for (const k of [a, b]) {
      assert.deepEqual([k.shelf, k.platform, k.layout, k.module], ['modules', 'web', 'website', module], k.id);
      assert.ok(k.steps.every(s => s.id.startsWith('mweb-') || ['publish', 'installable'].includes(s.id)), `${k.id}: its own steps start with mweb-`);
    }
    assert.deepEqual([a.version, a.annotated, b.version, b.annotated], ['Website', false, 'Website · annotated', true]);
    assert.equal(b.title, a.title + ', annotated');
    assert.deepEqual(plain(a.steps), plain(b.steps), 'the same steps');
    const depths = a.steps.map(s => lib.components[s.id].depth);
    assert.equal(depths.filter(d => d === 'hallway').length, 1, `${plainId}: one "Your turn" step`);
    assert.ok(depths.lastIndexOf('walk') < depths.indexOf('hallway') && depths.indexOf('hallway') < depths.indexOf('horizon'), `${plainId}: walk steps, then Your turn, then what's next`);
    assert.match(lib.components[a.steps[depths.indexOf('hallway')].id].name, /^Your turn: /);
    assert.ok(a.steps.some(s => lib.components[s.id].name === 'Touch controls' && lib.components[s.id].depth === 'walk' && !s.always), `${plainId}: optional touch controls`);
    const q = Object.values(lib.questions).find(x => x.options.some(o => o.kit === plainId));
    assert.ok(q && q.options.some(o => o.kit === notesId), `${module}: both versions are offered together`);
  }
});

test('every kit builds with its walk steps and with all its steps (blanks answered): no problems, and the JavaScript parses', () => {
  for (const kitId of KITS) for (const which of ['walk', 'all']) {
    const project = kitProject(kitId, which);
    assert.deepEqual(problemsOf(project), [], `${kitId} (${which})`);
    const js = compiled(project).mechanics.text;
    assert.doesNotThrow(() => new vm.Script(js), `${kitId} (${which})`);
  }
});

test('an annotated build has every teach: line as a note, in place; a plain build leaves them all out', () => {
  for (const [plainId, notesId] of MODULES) {
    const teach = teachLines(lib.kits[notesId]);
    assert.ok(teach.length >= 20, `${notesId} teaches as it goes (${teach.length} teach lines)`);
    const notes = kitProject(notesId).sections.map(s => s.text).join('\n'), bare = kitProject(plainId).sections.map(s => s.text).join('\n');
    for (const [, indent, said] of teach) {
      assert.ok(notes.split('\n').includes(`${indent}note: ${said}`), `${notesId}: "${said}" as a note`);
      assert.ok(!bare.includes(said), `${plainId}: leaves out "${said}"`);
    }
    assert.doesNotMatch(notes + bare, /^\s*teach\s*:/m, 'no teach: line is left as it was');
    const js = compiled(kitProject(notesId)).mechanics.text;
    assert.ok(teach.some(([, , said]) => js.includes('// ' + said.replace(/[.:]$/, ''))), 'the notes are comments in the JavaScript');
    assert.equal(problemsOf(kitProject(plainId)).length + problemsOf(kitProject(notesId)).length, 0);
  }
});

test('the teach: lines read well: British spelling, no "simply", "just", "easy" or exclamation marks', () => {
  for (const [, notesId] of MODULES) for (const [, , said] of teachLines(lib.kits[notesId])) {
    assert.doesNotMatch(said, /\b(simply|just|easy|easily|obviously)\b|!(?!=)/i, said);
    assert.doesNotMatch(said, /\b(color|center|centered|gray|behavior|favorite)\b/i, said);
  }
});

test('every stage of each course plays: the walk steps, one more at a time, build with no problems and run', () => {
  for (const [plainId] of MODULES) {
    const walk = lib.kits[plainId].steps.filter(s => lib.components[s.id].depth === 'walk').map(s => s.id);
    for (let n = 1; n <= walk.length; n++) {
      const mine = B.libraryWith([`kit: stage\ntitle: Stage\nlayout: website\nshelf: modules\nsteps: ${walk.slice(0, n).map(id => id + '!').join(', ')}`]);
      const project = kitProject('stage', [], mine);
      assert.deepEqual(problemsOf(project), [], `${plainId}, up to ${walk[n - 1]}`);
      const r = compiled(project);
      const p = fakePage(r.structure.text, r.mechanics.text);
      for (const key of ['ArrowRight', ' ', 'ArrowUp', 's', 'Enter', 'ArrowLeft']) { p.keyDown(key).frames(15).keyUp(key); p.tap('game', 50, 50); }
      p.frames(60);
      assert.ok(p.drawn.length > 0, `${plainId}, up to ${walk[n - 1]}: draws`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* Module 1 · Snake                                                     */
/* ------------------------------------------------------------------ */

test('Snake: the snake moves on its own, turns (never back into its neck), eats, grows, dies at the walls and on itself, and restarts', () => {
  const store = new Map();
  const p = openKit('snake-web', 'all', { store });
  p.frames(1);
  assert.equal(p.drawn.filter(d => d.op === 'moveTo').length, 42, 'the grid: 21 lines each way');
  assert.equal(p.get('JSON.stringify(snake)'), '[{"col":10,"row":10},{"col":9,"row":10},{"col":8,"row":10}]');
  p.frames(7);
  assert.equal(p.get('snake[0].col'), 11, 'one step every 8 frames');
  p.frames(7);
  assert.equal(p.get('snake[0].col'), 11);
  p.frames(1);
  assert.equal(p.get('snake[0].col'), 12);
  p.press('ArrowUp').frames(8);
  assert.deepEqual([p.get('snake[0].col'), p.get('snake[0].row')], [12, 9], 'turned up');
  p.press('ArrowDown');
  assert.deepEqual([p.get('dx'), p.get('dy')], [0, -1], 'not back into its neck');
  p.press('ArrowLeft').press('ArrowDown');
  assert.deepEqual([p.get('dx'), p.get('dy')], [-1, 0], 'two quick turns: the second would reverse it, so it is ignored');
  p.frames(8);
  // eating: food in front of the head
  const eat = () => { p.run('food = makeSquare(snake[0].col + dx, snake[0].row + dy)'); p.frames(8); };
  eat();
  assert.equal(p.get('score'), 1);
  assert.equal(p.get('onSnake(food)'), false, 'new food is never under the snake');
  p.frames(8);
  assert.equal(p.get('snake.length'), 4, 'one square longer');
  eat(); eat();
  p.frames(8);
  assert.equal(p.get('snake.length'), 6);
  assert.ok(p.texts().includes('Score 3') && p.texts().includes('Best 3'));
  assert.equal(store.get('snake-best'), '3', 'the best is kept in the browser');
  // the wall
  p.run('snake = [makeSquare(19, 5), makeSquare(18, 5), makeSquare(17, 5)]; dx = 1; dy = 0; ticks = 0').frames(8);
  assert.equal(p.get('playing'), false, 'off the board');
  assert.ok(p.texts().includes('Game over'));
  const head = p.get('JSON.stringify(snake[0])');
  p.frames(30);
  assert.equal(p.get('JSON.stringify(snake[0])'), head, 'nothing moves after game over');
  p.press(' ');
  assert.deepEqual([p.get('playing'), p.get('score'), p.get('snake.length'), p.get('dx')], [true, 0, 3, 1], 'a clean restart');
  assert.equal(openKit('snake-web', 'all', { store }).get('best'), 3, 'the best is still there next time');
  // into itself, and into the square its tail is leaving (fine)
  p.run('snake = [makeSquare(5,5), makeSquare(5,6), makeSquare(6,6), makeSquare(6,5), makeSquare(6,4)]; dx = 1; dy = 0; grow = 0; ticks = 0').frames(8);
  assert.equal(p.get('playing'), false, 'into itself');
  p.press('Enter');
  p.run('snake = [makeSquare(5,5), makeSquare(5,6), makeSquare(6,6), makeSquare(6,5)]; dx = 1; dy = 0; grow = 0; ticks = 0').frames(8);
  assert.equal(p.get('playing'), true, 'into the square its tail is leaving');
});

test('Snake: touch buttons steer and a tap restarts; Your turn speeds it up as the score grows', () => {
  const p = openKit('snake-web', 'all');
  p.tap('pad-up', 5, 5);
  assert.deepEqual([p.get('dx'), p.get('dy')], [0, -1]);
  p.frames(8).tap('pad-left', 5, 5).frames(8).tap('pad-down', 5, 5);
  assert.deepEqual([p.get('dx'), p.get('dy')], [0, 1]);
  p.tap('pad-right', 5, 5);
  assert.deepEqual([p.get('dx'), p.get('dy')], [0, 1], 'right would be back into its neck');
  p.run('playing = false').frames(1);
  assert.ok(p.texts().includes('or tap the board'), 'the board says a tap starts again');
  p.tap('game', 100, 100);
  assert.equal(p.get('playing'), true);
  p.frames(1);
  assert.equal(p.get('moveEvery'), 8);
  p.run('score = 13').frames(1);
  assert.equal(p.get('moveEvery'), 5);
  p.run('score = 90').frames(1);
  assert.equal(p.get('moveEvery'), 3, 'never faster than the fastest');
  const w = openKit('snake-web', 'walk');
  w.run('score = 90').frames(1);
  assert.equal(w.get('moveEvery'), 8, 'walk steps only: the same pace all game');
});

/* ------------------------------------------------------------------ */
/* Module 2 · Invaders                                                  */
/* ------------------------------------------------------------------ */

test('Invaders: the cannon moves while a key is held, shots fly and hit, the swarm marches and turns, bombs cost lives, waves follow, Enter restarts', () => {
  const p = openKit('invaders-web', 'all');
  p.run('bombChance = 0').frames(1);
  assert.equal(p.get('invaders.length'), 40, 'five rows of eight');
  assert.equal(p.get('cannon.x'), 225, 'the cannon starts in the middle');
  p.keyDown('ArrowLeft').frames(10).keyUp('ArrowLeft');
  assert.equal(p.get('cannon.x'), 185, 'held: 4 pixels a frame');
  p.keyDown('ArrowLeft').frames(100).keyUp('ArrowLeft');
  assert.equal(p.get('cannon.x'), 0, 'stops at the edge');
  p.press('ArrowRight').frames(1);
  assert.equal(p.get('cannon.x'), 0, 'a press between frames is not a hold');
  // firing, and the reload
  p.press(' ').press(' ');
  assert.equal(p.get('shots.length'), 1, 'one shot, then a reload');
  p.frames(15).press(' ');
  assert.equal(p.get('shots.length'), 2);
  const y = p.get('shots[1].y');
  p.frames(1);
  assert.equal(p.get('shots[1].y'), y - 8, 'shots fly up');
  p.frames(60);
  assert.equal(p.get('shots.length'), 0, 'gone once off the top');
  // the march: a step every 30 frames, down and round at the edge
  p.run('marchTicks = 0');
  const x0 = p.get('invaders[0].x');
  p.frames(30);
  assert.equal(p.get('invaders[0].x'), x0 + 8);
  p.run('for (const v of invaders) v.x += 104; marchTicks = 0').frames(30);
  assert.equal(p.get('marchDir'), -1, 'turned round at the right edge');
  assert.equal(p.get('invaders[0].y'), 66, 'and stepped down');
  // a hit
  p.run('shots = [makeBox(invaders[39].x + 10, invaders[39].y + 16, 4, 10)]; reload = 0').frames(1);
  assert.equal(p.get('invaders.length'), 39);
  assert.equal(p.get('score'), 10, 'the bottom row is worth 10');
  assert.equal(p.get('bursts.length'), 1);
  p.frames(1);
  assert.equal(p.get('shots.length'), 0, 'the shot is used up');
  p.run('shots = [makeBox(invaders[0].x + 10, invaders[0].y + 20, 4, 10)]').frames(1);
  assert.equal(p.get('score'), 60, 'the top row is worth 50');
  assert.ok(p.texts().includes('Score 60'));
  // a wave cleared: the next one starts lower
  p.run('invaders = []').frames(1);
  assert.deepEqual([p.get('wave'), p.get('invaders.length'), p.get('invaders[0].y')], [2, 40, 62]);
  // bombs
  const bomb = 'bombs = [makeBox(cannon.x + 10, cannon.y - 4, 4, 10)]';
  p.run(bomb).frames(1);
  assert.deepEqual([p.get('lives'), p.get('bombs.length'), p.get('playing')], [2, 0, true], 'a bomb on the cannon costs a life');
  p.run(bomb).frames(1).run(bomb).frames(1);
  assert.equal(p.get('playing'), false, 'no lives left: game over');
  assert.ok(p.texts().includes('Game over'));
  const where = p.get('invaders[0].x');
  p.frames(60);
  assert.equal(p.get('invaders[0].x'), where, 'nothing moves after game over');
  p.press(' ');
  assert.equal(p.get('shots.length'), 0, 'no firing after game over');
  p.press('Enter');
  assert.deepEqual([p.get('playing'), p.get('lives'), p.get('score'), p.get('wave'), p.get('invaders.length'), p.get('cannon.x')], [true, 3, 0, 1, 40, 225], 'a clean restart');
  p.run('invaders[5].y = cannon.y - 10').frames(1);
  assert.equal(p.get('playing'), false, 'invaders down at the cannon win');
  // bombs do drop, at random
  p.press('Enter').run('bombChance = 0.02');
  let dropped = 0;
  for (let f = 0; f < 300; f++) { p.frames(1); dropped = Math.max(dropped, p.get('bombs.length')); }
  assert.ok(dropped >= 1, 'invaders drop bombs');
});

test('Invaders: a tap moves the cannon there (scaled on a small screen) and fires; Your turn speeds the swarm up as it shrinks', () => {
  const p = openKit('invaders-web', 'all', { scale: 0.5 });
  p.run('bombChance = 0').tap('game', 50, 300);
  assert.equal(p.get('shots.length'), 1, 'a tap fires');
  assert.equal(p.get('touchTarget'), 85, 'the tap is at 100 in the board\'s own pixels');
  p.frames(60);
  assert.equal(p.get('cannon.x'), 85);
  assert.equal(p.get('touchTarget'), null, 'arrived');
  p.run('playing = false').frames(1);
  assert.ok(p.texts().includes('or tap the board'));
  p.tap('game', 10, 10);
  assert.equal(p.get('playing'), true, 'a tap starts a new game');
  p.frames(1);
  assert.equal(p.get('marchEvery'), 30, 'a full block marches slowly');
  p.run('invaders = invaders.slice(0, 20)').frames(1);
  assert.equal(p.get('marchEvery'), 16);
  p.run('invaders = invaders.slice(0, 1)').frames(1);
  assert.equal(p.get('marchEvery'), 3, 'the last one races');
  const w = openKit('invaders-web', 'walk');
  w.run('invaders = invaders.slice(0, 1)').frames(1);
  assert.equal(w.get('marchEvery'), 30, 'walk steps only: the same pace');
});

/* ------------------------------------------------------------------ */
/* Module 3 · Invaders under a night sky                                */
/* ------------------------------------------------------------------ */

test('Night sky: the background is drawn first, back to front (sky, stars, moon, city), then the game on top; the stars drift at two speeds and twinkle', () => {
  const p = openKit('nightsky-web', 'all');
  p.run('bombChance = 0; shots = [makeBox(100, 200, 4, 10)]').frames(1);
  const first = (test) => p.drawn.findIndex(test);
  const fillOf = (style) => first(d => d.op === 'fillRect' && d.style === style);
  const order = {
    sky: fillOf('rgb(4, 6, 22)'),
    stars: first(d => d.op === 'fillRect' && /^rgba\(255, 255, 255, /.test(d.style)),
    moon: first(d => d.op === 'fill' && d.style === '#f4eedb'),
    city: fillOf('#0b0d1a'),
    cannon: first(d => d.op === 'fillRect' && d.style === '#2dd4bf' && d.args[2] === 30),
    shot: fillOf('#fef08a'),
    invaders: fillOf('#f472b6'),
    score: first(d => d.op === 'fillText'),
  };
  assert.ok(Object.values(order).every(i => i >= 0), JSON.stringify(order));
  const names = Object.keys(order);
  assert.deepEqual([...names].sort((a, b) => order[a] - order[b]), names, `drawn in this order: ${JSON.stringify(order)}`);
  assert.equal(p.fills().filter(d => /^rgb\(/.test(d.style)).length, 24, 'a sky of 24 bands');
  assert.equal(p.fills('rgb(46, 24, 72)').length, 1, 'down to violet at the horizon');
  const lowest = p.fills('rgb(46, 24, 72)')[0].args;
  assert.ok(lowest[1] + lowest[3] <= p.get('groundY'), 'the sky stops at the ground line');
  assert.equal(p.drawn.filter(d => d.op === 'fillRect' && /^rgba\(255, 255, 255, /.test(d.style)).length, 94, '70 far stars and 24 near ones');
  // parallax: near stars drift five times as fast as far ones
  const before = [p.get('farStars[0].x'), p.get('nearStars[0].x')];
  p.frames(10);
  const moved = [before[0] - p.get('farStars[0].x'), before[1] - p.get('nearStars[0].x')];
  assert.ok(Math.abs(moved[0] - 0.4) < 1e-6 && Math.abs(moved[1] - 2) < 1e-6, `far ${moved[0]}, near ${moved[1]}`);
  p.run('nearStars[0].x = 0.1').frames(1);
  assert.ok(p.get('nearStars[0].x') > 470, 'a star that drifts off the left comes back on the right');
  // twinkling: a star's brightness changes from frame to frame
  const glowOf = () => p.drawn.find(d => d.op === 'fillRect' && /^rgba\(255, 255, 255, /.test(d.style)).style;
  const glows = new Set();
  for (let f = 0; f < 30; f++) { p.frames(1); glows.add(glowOf()); }
  assert.ok(glows.size > 20, 'twinkles');
  // the city's windows stay put
  const windows = () => p.fills('rgba(253, 224, 140, 0.55)').map(d => d.args.join()).join(' ');
  const lit = windows();
  p.frames(5);
  assert.ok(lit.length > 0 && windows() === lit, 'the lit windows never flicker');
  // the game still plays on top
  const score = p.get('score');
  p.run('shots = [makeBox(invaders[0].x + 10, invaders[0].y + 16, 4, 10)]').frames(1);
  assert.equal(p.get('score'), score + 50, 'the game still plays on top');
});

test('Night sky: Your turn sends shooting stars now and then, behind the game, fading as they go', () => {
  const p = openKit('nightsky-web', 'all');
  p.run('bombChance = 0');
  let frames = 0;
  while (p.get('meteors.length') === 0 && frames < 3000) { p.frames(1); frames++; }
  assert.ok(frames < 3000, 'a shooting star comes along');
  const streak = () => p.drawn.find(d => d.op === 'moveTo' && /^rgba\(255, 255, 255, /.test(d.style));
  const start = [p.get('meteors[0].x'), p.get('meteors[0].y')];
  p.frames(1);
  assert.deepEqual([p.get('meteors[0].x') - start[0], p.get('meteors[0].y') - start[1]], [7, 3]);
  assert.ok(p.drawn.indexOf(streak()) < p.drawn.findIndex(d => d.style === '#2dd4bf' && d.args[2] === 30), 'behind the cannon');
  const bright = streak().style;
  p.frames(10);
  assert.notEqual(streak().style, bright, 'it fades');
  p.frames(40);
  assert.equal(p.get('meteors.filter(m => m.life <= 0).length'), 0, 'gone when its life runs out');
  const w = openKit('nightsky-web', 'walk');
  w.frames(3000);
  assert.equal(w.get('typeof meteors'), 'undefined', 'walk steps only: no shooting stars');
});

/* ------------------------------------------------------------------ */
/* Module 4 · Jacques & Louis G.                                        */
/* ------------------------------------------------------------------ */

/* Plays the level holding right: jumps from the ground at a pit's edge, before a wall, or just before a wire
   or a surge, and is the brother who(x) says. Returns whether the power came on, where it got to, and falls. */
function autopilot(p, who, frames = 3000) {
  p.keyDown('ArrowRight');
  let falls = 0, lastX = p.get('hero.x');
  for (let f = 0; f < frames && !p.get('powerOn'); f++) {
    const s = p.get('({ x: hero.x, y: hero.y, w: hero.w, h: hero.h, ground: hero.onGround, current, run: runSpeed })');
    if (s.x < lastX - 100) falls++;
    lastX = s.x;
    if (s.current !== who(s.x)) p.press('s');
    if (s.ground) {
      const feet = s.y + s.h, front = s.x + s.w;
      const pit = !p.get(`solidAt(${s.x + s.run + 1}, ${feet + 4}) || solidAt(${front + s.run - 1}, ${feet + 4})`);
      const wall = p.get(`solidAt(${front + 8}, ${feet - 2})`);
      const danger = p.get(`[...wires, ...surges].some(b => b.x > ${front - 4} && b.x < ${front + 26} && b.y < ${feet} && b.y + b.h > ${s.y})`);
      if (pit || wall || danger) p.press('ArrowUp');
    }
    p.frames(1);
  }
  p.keyUp('ArrowRight');
  return { powerOn: p.get('powerOn'), x: p.get('hero.x'), falls };
}

test('Jacques & Louis G.: gravity pulls, he lands on the ground, runs while a key is held, jumps from the ground only, and walls stop him', () => {
  const p = openKit('brothers-web', 'walk');
  p.frames(2);
  assert.deepEqual([p.get('hero.onGround'), p.get('hero.y'), p.get('hero.vy')], [true, 218, 0], 'standing on the ground at the start');
  p.run('hero.y = 100; hero.vy = 0').frames(1);
  assert.equal(p.get('hero.vy'), 0.5, 'gravity: the speed down grows by 0.5 a frame');
  p.frames(1);
  assert.equal(p.get('hero.vy'), 1);
  assert.equal(p.get('hero.y'), 101.5, 'and the speed moves him');
  p.frames(60);
  assert.deepEqual([p.get('hero.onGround'), p.get('hero.y'), p.get('hero.vy')], [true, 218, 0], 'landed');
  // running: held keys
  p.keyDown('ArrowRight').frames(10).keyUp('ArrowRight').frames(1);
  assert.ok(Math.abs(p.get('hero.x') - (52 + 24)) < 1e-9, '2.4 pixels a frame for Jacques');
  // jumping: from the ground only, an arc
  p.press('ArrowUp');
  assert.equal(p.get('hero.vy'), -10.5);
  let top = 999;
  for (let f = 0; f < 50; f++) { p.frames(1); top = Math.min(top, p.get('hero.y')); if (f === 5) p.press('ArrowUp'); }
  assert.equal(top, 218 - 105, 'Jacques rises 105 pixels');
  assert.equal(p.get('hero.y'), 218, 'and comes back down: a second press in the air did nothing');
  // a wall: the crate at column 14 (starting past the loose wire)
  p.run('hero.x = 290').keyDown('ArrowRight').frames(60).keyUp('ArrowRight');
  assert.equal(p.get('hero.x'), 14 * 24 - 16, 'stopped by the crate');
  // the level is read from text
  assert.deepEqual([p.get('rows'), p.get('cols'), p.get('tileAt(14, 8)'), p.get('tileAt(2, 9)'), p.get('tileAt(-1, 5)'), p.get('tileAt(50, 40)')], [12, 100, '#', 'P', '#', '.']);
  assert.equal(p.get('findAll("*").length'), 19);
});

test('Jacques & Louis G.: swapping brothers changes how they run and jump; the camera follows within the level; the street scrolls at half speed', () => {
  const p = openKit('brothers-web', 'walk');
  p.frames(2);
  const run = () => { const x = p.get('hero.x'); p.keyDown('ArrowRight').frames(5).keyUp('ArrowRight').frames(1); return p.get('hero.x') - x; };
  const rise = () => { p.press('ArrowUp'); let top = 999; for (let f = 0; f < 50; f++) { p.frames(1); top = Math.min(top, p.get('hero.y')); } return 218 - top; };
  assert.equal(p.texts()[0], 'Jacques');
  const [jacquesRuns, jacquesRises] = [run(), rise()];
  p.press('s').frames(1);
  assert.equal(p.texts()[0], 'Louis G.');
  const [louisRuns, louisRises] = [run(), rise()];
  assert.ok(louisRuns > jacquesRuns, `Louis G. runs faster (${louisRuns} > ${jacquesRuns})`);
  assert.ok(jacquesRises > louisRises + 30, `Jacques jumps higher (${jacquesRises} > ${louisRises})`);
  assert.ok(jacquesRises > 96 && louisRises < 72, 'Jacques can get up a wall four tiles high; Louis G. not even three');
  p.press('s');
  assert.equal(p.get('current'), 0, 'and back');
  // the camera: an offset that follows the hero, inside the level
  assert.equal(p.get('camX'), 0);
  const firstHouse = () => p.fills('#2a2340')[0].args[0];
  const house = firstHouse();
  p.run('hero.x = 1200; hero.y = 100').frames(60);
  const camX = p.get('camX');
  assert.ok(Math.abs(p.get('hero.x + hero.w / 2 - camX') - 160) < 3, 'the hero a third of the way across');
  const brick = p.fills('#7a3524').find(d => d.args[1] === 240).args[0];
  assert.equal(((brick + camX) % 24 + 24) % 24, 0, 'the tiles are drawn shifted left by camX');
  assert.equal((((house - firstHouse()) - camX * 0.5) % 110 + 110) % 110, 0, 'the houses move at half the speed');
  p.run('hero.x = 2380; hero.y = 100').frames(120);
  assert.equal(p.get('camX'), 2400 - 480, 'never past the end of the level');
  p.run('hero.x = 30; hero.y = 100').frames(120);
  assert.equal(p.get('camX'), 0, 'never before the start');
});

test('Jacques & Louis G.: sparks are collected, wires and surges send you back, a stomp shorts a surge, and the fuse box lights the street', () => {
  const p = openKit('brothers-web', 'walk');
  p.frames(2);
  const spark = p.get('sparks[0]');
  p.run(`hero.x = ${spark.x}; hero.y = ${spark.y - 6}; hero.vy = 0`).frames(1);
  assert.equal(p.get('sparkCount'), 1);
  assert.ok(p.texts().includes('Sparks 1 of 19'));
  p.frames(30);
  assert.equal(p.get('sparkCount'), 1, 'each spark counts once');
  // a loose wire
  p.run('hero.x = wires[0].x; hero.y = 218; hero.vy = 0').frames(1);
  assert.deepEqual([p.get('hero.x'), p.get('hero.flash') > 50], [52, true], 'zapped: back to the start, blinking');
  // the surges patrol their own floor and turn at walls and edges
  const first = p.get('surges.map(s => s.x)');
  const lowest = first.slice(), highest = first.slice();
  for (let f = 0; f < 3000; f++) {
    p.run('hero.x = 52; hero.y = 218; hero.vy = 0').frames(1);
    p.get('surges.map(s => s.x)').forEach((x, k) => { lowest[k] = Math.min(lowest[k], x); highest[k] = Math.max(highest[k], x); });
  }
  assert.deepEqual(lowest.map(x => Math.floor(x / 24)), [16, 46, 61, 76], 'each turns round at the wall on its left');
  assert.deepEqual(highest.map(x => Math.floor((x + 18) / 24)), [29, 55, 72, 99], 'and at the edge or the wall on its right');
  // a side touch sends you back; a stomp shorts it out and bounces
  p.run('hero.x = surges[1].x - 10; hero.y = 218; hero.vy = 0').frames(1);
  assert.equal(p.get('hero.x'), 52, 'touched from the side');
  p.run('hero.x = surges[1].x + 1; hero.y = surges[1].y - 26; hero.vy = 5').frames(1);
  assert.deepEqual([p.get('surges.length'), p.get('hero.vy')], [3, -6], 'stomped');
  // the fuse box
  p.frames(1);
  assert.ok(p.fills('#1f1a33').length > 0 && p.fills('#fcd34d').length === 0, 'the windows are dark');
  p.run('hero.x = fuse.x; hero.y = 218; hero.vy = 0').frames(2);
  assert.equal(p.get('powerOn'), true);
  assert.ok(p.fills('#fcd34d').length > 0 && p.fills('#1f1a33').length === 0, 'the windows are lit');
  assert.ok(p.drawn.some(d => d.op === 'fill' && d.style === 'rgba(253, 214, 120, 0.2)'), 'and the street lamps glow');
  assert.ok(p.drawn.findIndex(d => d.style === '#fcd34d') < p.drawn.findIndex(d => d.style === '#7a3524'), 'behind the level');
  assert.ok(p.texts().includes('Power restored'));
  p.press('Enter');
  assert.deepEqual([p.get('powerOn'), p.get('sparkCount'), p.get('sparks.filter(s => s.taken).length'), p.get('surges.length'), p.get('hero.x')], [false, 0, 0, 4, 52], 'a clean restart');
});

test('Jacques & Louis G.: the level can be finished, with Jacques for the wall and Louis G. for the wide pit; neither can do it alone', () => {
  const both = autopilot(openKit('brothers-web', 'walk'), (x) => (x > 46 * 24 ? 1 : 0));
  assert.deepEqual([both.powerOn, both.falls], [true, 0], JSON.stringify(both));
  const louis = autopilot(openKit('brothers-web', 'walk'), () => 1, 1500);
  assert.equal(louis.powerOn, false);
  assert.ok(louis.x < 44 * 24, 'Louis G. alone is stuck at the wall');
  const jacques = autopilot(openKit('brothers-web', 'walk'), () => 0, 1500);
  assert.equal(jacques.powerOn, false);
  assert.ok(jacques.falls >= 1, 'Jacques alone falls into the wide pit');
});

test('Jacques & Louis G.: touch buttons run while held, jump and swap; Your turn adds one jump in mid-air', () => {
  const p = openKit('brothers-web', 'all');
  p.frames(2);
  p.pointer('pointerdown', 'pad-right', 5, 5).frames(10);
  assert.ok(p.get('hero.x') > 52 + 20, 'runs while held');
  p.pointer('pointerup', 'pad-right', 5, 5).frames(1);
  const x = p.get('hero.x');
  p.frames(10);
  assert.equal(p.get('hero.x'), x, 'stops when the finger lifts');
  p.tap('pad-swap', 5, 5);
  assert.equal(p.get('current'), 1);
  p.tap('pad-jump', 5, 5);
  assert.equal(p.get('hero.vy'), -8.5);
  p.frames(60).tap('pad-swap', 5, 5);
  // the double jump
  p.press('ArrowUp');
  assert.equal(p.get('hero.vy'), -10.5, 'the first press is an ordinary jump');
  p.frames(10).press('ArrowUp');
  assert.equal(p.get('hero.vy'), -10.5 * 0.85, 'a second press in the air jumps again');
  p.frames(5);
  const vy = p.get('hero.vy');
  p.press('ArrowUp');
  assert.equal(p.get('hero.vy'), vy, 'but only once');
  p.frames(80).press('ArrowUp').frames(10).press('ArrowUp');
  assert.equal(p.get('hero.vy'), -10.5 * 0.85, 'landing gives it back');
  const w = openKit('brothers-web', 'walk');
  w.frames(2).press('ArrowUp').frames(10).press('ArrowUp');
  assert.ok(w.get('hero.vy') > -10, 'walk steps only: no double jump');
  p.run('powerOn = true').frames(1);
  assert.ok(p.texts().includes('or tap the game'));
  p.tap('game', 10, 10);
  assert.equal(p.get('powerOn'), false, 'a tap plays again once the power is back');
});

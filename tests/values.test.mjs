// Values (the sentence editor's "Drop down" mode): finding the numbers, colours and keyword values in a sentence,
// what each spot is and what's usual there, and nudging a value with − / +.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/engine.mjs';

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'lang/values.js'), 'utf8'), ctx, { filename: 'lang/values.js' });
const V = ctx.IntuiValues;
const plain = (x) => JSON.parse(JSON.stringify(x));
const texts = (line, lang) => plain(V.scan(line, lang).map(v => v.text));
const at = (line, lang, text, n = 0) => { const v = V.scan(line, lang).filter(x => x.text === text)[n]; assert.ok(v, `${text} in ${line}`); return v; };
const info = (lang, line, text, n) => V.explain(line, at(line, lang, text, n), lang);
const nudge = (lang, line, text, dir, n) => { const v = at(line, lang, text, n); return V.step(line, v, dir, V.explain(line, v, lang)); };

test('the example from the screenshot: text size, line height and a colour', () => {
  const line = 'style paragraph: text size 24, line-height: 1.1 #000000';
  const vs = V.scan(line, 'css');
  assert.deepEqual(plain(vs.map(v => [v.text, v.kind])), [['24', 'number'], ['1.1', 'number'], ['#000000', 'hex']]);
  for (const v of vs) assert.equal(line.slice(v.start, v.end), v.text);
  assert.equal(V.explain(line, vs[0], 'css').title, 'Text size');
  const lh = V.explain(line, vs[1], 'css');
  assert.equal(lh.title, 'Line height');
  assert.equal(lh.step, 0.1);
  assert.equal(lh.options[lh.current].text, '1.1');
  assert.ok(lh.options.some(o => o.text === '1.5' && /comfortable/.test(o.label)));
  assert.equal(V.step(line, vs[1], 1, lh), '1.2');
  assert.equal(V.step(line, vs[1], -1, lh), '1');
  const col = V.explain(line, vs[2], 'css');
  assert.equal(col.colour, true);
  assert.equal(col.step, 'colour');
  assert.ok(col.options.every(o => /^#[0-9a-f]{6}$/.test(o.text) && /^#[0-9a-f]{6}$/.test(o.swatch)));
  assert.equal(col.options[col.current].text, '#000000');
});

test('scan: positions, kinds, numbers and units', () => {
  const lines = [
    ['css', 'style card: padding 8 16, width 50%, transition: all 0.2s ease, at least 100vh tall, transform: rotate(90deg)'],
    ['js', 'draw a rectangle at -10, 20 sized 40 by 20 in "tomato" on game'],
    ['python', 'wait 500ms, then .5 and 1e3'],
    ['arduino', 'read analog pin A0 and store in level'],
  ];
  for (const [lang, line] of lines) for (const v of V.scan(line, lang)) assert.equal(line.slice(v.start, v.end), v.text, `${v.text} in ${line}`);
  const card = V.scan(lines[0][1], 'css');
  assert.deepEqual(plain(card.map(v => [v.text, v.kind])), [['8', 'number'], ['16', 'number'], ['50%', 'number'], ['0.2s', 'number'], ['ease', 'word'], ['100vh', 'number'], ['90deg', 'number']]);
  assert.deepEqual(plain(card.filter(v => v.kind === 'number').map(v => [v.num, v.unit])), [[8, ''], [16, ''], [50, '%'], [0.2, 's'], [100, 'vh'], [90, 'deg']]);
  assert.deepEqual(texts(lines[2][1], 'python'), ['500ms', '.5', '1e3']);
  assert.deepEqual(plain(V.scan(lines[3][1], 'arduino').map(v => [v.text, v.kind])), [['A0', 'word']], 'analog pins are values on a board');
  assert.deepEqual(texts('read pin A0', 'python'), [], 'but just a name elsewhere');
});

test('scan: quoted text is skipped, but a quoted colour is a value (inside the quotes)', () => {
  assert.deepEqual(texts('show "You have 3 lives and #fff"', 'python'), []);
  assert.deepEqual(texts('show "Score: {score + 10}" and 5', 'python'), ['5'], '{holes} in text are text');
  const line = 'draw a circle at 10, 20 with radius 5 in "gold" on game';
  const gold = at(line, 'js', 'gold');
  assert.equal(gold.kind, 'colour');
  assert.equal(line[gold.start - 1], '"');
  assert.equal(line[gold.end], '"');
  const sky = V.scan('fill game with "#87ceeb"', 'js');
  assert.deepEqual(plain(sky.map(v => [v.text, v.kind, v.start])), [['#87ceeb', 'hex', 16]]);
  assert.deepEqual(texts('set BACKGROUND to "#14181f"', 'python'), ['#14181f']);
  assert.deepEqual(texts('draw text "red" at 5, 6 size 16 in "white" on game', 'js'), ['5', '6', '16', 'white'], 'text that is shown is not a colour, even when it names one');
  assert.deepEqual(texts("set c to 'tomato' and 2", 'python'), ['tomato', '2']);
  assert.deepEqual(texts("say 'tomato' and 2", 'python'), ['2'], 'said aloud, it is text');
  assert.deepEqual(texts("if the player's score is 10", 'python'), ['10'], 'an apostrophe is not a quote');
  assert.deepEqual(texts('show "never closed 5', 'python'), [], 'text still being typed');
});

test('scan: slots, comments and notes, names with digits, versions', () => {
  assert.deepEqual(texts('set lives to ‹3›', 'python'), []);
  assert.deepEqual(texts('draw a rectangle at ‹x›, 20 sized ‹40› by 20 in "‹tomato›" on game', 'js'), ['20', '20']);
  for (const l of ['note: 20 squares across', '    comment: wait 5 seconds', 'teach: x goes up by 1', '# set x to 5', '// every 2 seconds', 'description: 5 milliseconds']) assert.deepEqual(texts(l, 'python'), [], l);
  assert.deepEqual(texts('set player2 to h1 plus x1 plus 3', 'python'), ['3']);
  assert.deepEqual(texts('use version 1.2.3 and 4', 'python'), ['4']);
  assert.deepEqual(texts('show 2nd and 3D and 4', 'python'), ['4']);
  assert.deepEqual(texts('html: <h1>Top</h1>', 'html'), []);
});

test('scan: a minus is a sign, or a subtraction', () => {
  assert.deepEqual(texts('draw a rectangle at -10, 5 sized 4 by 4 in "red" on game', 'js'), ['-10', '5', '4', '4', 'red']);
  assert.deepEqual(texts('style box: margin -4', 'css'), ['-4']);
  assert.deepEqual(texts('set y to x - 1', 'python'), ['1']);
  assert.deepEqual(texts('set y to x-1', 'python'), ['1']);
  assert.deepEqual(texts('set y to (a)-2 and 3-1', 'python'), ['2', '3', '1']);
  assert.deepEqual(texts('if light.x is less than -10', 'js'), ['-10']);
  assert.deepEqual(texts('set STEPS to {"Left": (-1, 0)}', 'python'), ['-1', '0']);
  assert.equal(at('at -10, 5', 'css', '-10').num, -10);
});

test('scan: code lines (python:, js:, css:, c++:) have values too; comments in them do not', () => {
  assert.deepEqual(texts('python: x = 5  # was 3', 'python'), ['5']);
  assert.deepEqual(texts('js: setTimeout(go, 1000); // 2000 was slow', 'js'), ['1000']);
  assert.deepEqual(texts('c++: delay(500);', 'arduino'), ['500']);
  const css = 'css: p { line-height: 1.1; color: navy; text-align: center }';
  assert.deepEqual(plain(V.scan(css, 'html').map(v => [v.text, v.kind])), [['1.1', 'number'], ['navy', 'colour'], ['center', 'word']]);
  assert.equal(info('html', css, '1.1').title, 'Line height');
  assert.deepEqual(texts('css: #add, .x2 { gap: 4px }', 'css'), ['4px'], 'a selector is not a value');
  assert.deepEqual(texts('style #add: background #fab', 'css'), ['#fab']);
});

test('scan: colour names count where a colour goes; keyword values for CSS properties with a known list', () => {
  assert.deepEqual(plain(V.scan('style the page: background navy, text colour white, border 2 tomato', 'css').map(v => [v.text, v.kind])), [['navy', 'colour'], ['white', 'colour'], ['2', 'number'], ['tomato', 'colour']]);
  assert.deepEqual(texts('style red: text-align: center, display flex, cursor pointer, font-weight: bold, border: 1px dashed gold', 'css'), ['center', 'flex', 'pointer', 'bold', '1px', 'dashed', 'gold']);
  assert.deepEqual(texts('style a: background the colour main, font-family: system-ui', 'css'), [], 'shared colour names and unlisted words are not values');
  assert.deepEqual(texts('set navy to 3', 'python'), ['3'], 'a name in Python is just a name');
  assert.deepEqual(texts('draw a rectangle at 1, 2 sized 3 by 4 in tomato on game', 'js'), ['1', '2', '3', '4', 'tomato']);
});

// [lang, line, value, title (string or pattern), step, the option marked current (or null for none)]
const SPOTS = [
  ['css', 'style p: font-size: 18px', '18px', 'Text size', 1, '18px'],
  ['css', 'style p: letter-spacing: 0.05em', '0.05em', 'Letter spacing', 0.01, '0.05em'],
  ['css', 'style p: font-weight: 700', '700', 'Boldness', 100, '700'],
  ['css', 'style card: padding 8 16', '16', 'Space inside (left and right)', 1, '16'],
  ['css', 'style card: space around 24', '24', 'Space around', 1, '24'],
  ['css', 'style card: rounded corners 999', '999', 'Rounded corners', 1, '999'],
  ['css', 'style card: border 2 #333333', '2', 'Border width', 1, '2'],
  ['css', 'style card: width 600', '600', 'Width', 1, '600'],
  ['css', 'style main: at most 800 wide', '800', 'Widest it gets', 1, '800'],
  ['css', 'style stage: at least 100vh tall', '100vh', 'Shortest it gets', 5, '100vh'],
  ['css', 'style row: gap 12', '12', 'Space between', 1, '12'],
  ['css', 'style x: 40% see-through', '40%', 'How see-through', 5, '40%'],
  ['css', 'style x: opacity: 0.5', '0.5', 'Opacity', 0.05, '0.5'],
  ['css', 'style card: shadow with 25% intensity', '25%', 'Shadow strength', 5, '25%'],
  ['css', 'style menu: z-index: 100', '100', 'Stacking order', 1, '100'],
  ['css', 'style cards: in a grid of 3 columns', '3', 'Columns in the grid', 1, '3'],
  ['css', 'style a: transition: all 0.2s ease', '0.2s', 'How long a change takes', 0.05, '0.2s'],
  ['css', 'style badge: at 10, 20', '20', 'Distance from the top', 1, '20'],
  ['css', 'on screens narrower than 768:', '768', 'Screen width', 1, '768'],
  ['css', 'style a: text-align: center', 'center', 'Text alignment', 'cycle', 'center'],
  ['css', 'style a: background navy', 'navy', 'Background colour', 'colour', 'navy'],
  ['html', 'add a drawing area called game 480 by 270', '480', 'Width of the drawing area', 1, '480'],
  ['html', 'add a drawing area called game 480 by 270', '270', 'Height of the drawing area', 1, '270'],
  ['js', 'draw a rectangle at 10, 20 sized 40 by 20 in "tomato" on game', '40', 'Width of the rectangle', 1, '40'],
  ['js', 'draw a circle at 10, 20 with radius 10 in "gold" on game', '10', 'Centre across (x)', 1, '10'],
  ['js', 'draw a circle at 10, 20 with radius 10 in "gold" on game', '20', 'Centre down (y)', 1, '20'],
  ['js', 'draw text "Hi" at 12, 26 size 24 in "white" on game', '24', 'Text size', 1, '24'],
  ['js', 'draw a rectangle at 10, 20 sized 40 by 20 in "tomato" on game', 'tomato', 'Colour to draw in', 'colour', 'tomato'],
  ['js', 'play a note of 440 for 0.2 seconds', '440', 'Pitch', 'cycle', '440'],
  ['js', 'play a note of 440 for 0.2 seconds', '0.2', 'Length of the note', 0.1, '0.2'],
  ['js', 'after 2 seconds', '2', 'Seconds before it runs', 1, '2'],
  ['js', 'every 100 milliseconds', '100', 'Milliseconds between runs', 50, '100'],
  ['js', 'set lives to 3', '3', 'Lives', 1, '3'],
  ['js', 'set score to 0', '0', 'Score', 1, '0'],
  ['js', 'set roll to random number from 1 to 6', '6', 'Biggest it can pick', 1, '6'],
  ['python', 'wait 0.5 seconds', '0.5', 'Seconds to wait', 0.1, '0.5'],
  ['python', 'repeat 10 times', '10', 'Times to repeat', 1, '10'],
  ['python', 'show total rounded to 2 places', '2', 'Decimal places', 1, '2'],
  ['python', 'set FONT to ("Helvetica", 14, "bold")', '14', 'Text size', 1, '14'],
  ['python', 'set canvas to tk.Canvas(window, width=400, height=300)', '400', 'Width of the canvas', 1, '400'],
  ['python', 'python: window.after(100, tick)', '100', 'Milliseconds before it runs', 50, '100'],
  ['python', 'set CELL to 24', '24', 'Size of each square', 1, '24'],
  ['python', 'set START_SPEED to 150', '150', /^Speed/, 10, '150'],
  ['python', 'show item 0 of names', '0', 'Position in the list', 1, '0'],
  ['arduino', 'make pin 13 an output', '13', 'Pin', 1, '13'],
  ['arduino', 'set the brightness of pin 9 to 128', '9', 'Pin (one that can dim)', 1, '9'],
  ['arduino', 'set the brightness of pin 9 to 128', '128', 'Brightness', 5, '128'],
  ['arduino', 'start the serial monitor at 9600', '9600', 'Serial speed', 'cycle', '9600'],
  ['arduino', 'wait 500 milliseconds', '500', 'Milliseconds to wait', 50, '500'],
  ['arduino', 'if reading of pin A0 is more than 512', '512', 'Analog reading', 10, '512'],
  ['arduino', 'read analog pin A0 and store in level', 'A0', 'Analog pin', 'cycle', 'A0'],
  ['arduino', 'c++: tone(8, 440, 200);', '200', 'Length of the note', 50, '200'],
  ['cpp', 'repeat 3 times', '3', 'Times to repeat', 1, '3'],
  ['cpp', 'c++: int scores[10];', '10', 'How many items it holds', 1, '10'],
];

test('explain: what each spot is, the usual choices, and the step', () => {
  for (const [lang, line, text, title, step, current] of SPOTS) {
    const e = info(lang, line, text);
    const where = `${text} in "${line}" (${lang})`;
    if (title instanceof RegExp) assert.match(e.title, title, where); else assert.equal(e.title, title, where);
    assert.ok(e.about && e.about.length > 20, where);
    assert.ok(e.options.length >= 4 && e.options.length <= 16, `${where}: ${e.options.length} options`);
    assert.equal(e.step, step, where);
    assert.equal(e.current >= 0 ? e.options[e.current].text : null, current, where);
    for (const o of e.options) assert.ok(typeof o.text === 'string' && typeof o.label === 'string', where);
  }
});

test('explain: the options keep the units people wrote, and fit back into the sentence', () => {
  assert.ok(info('css', 'style p: text size 24', '24').options.every(o => /^\d+$/.test(o.text)), 'a style sentence takes bare numbers as pixels');
  assert.ok(info('css', 'style p: text size 24px', '24px').options.every(o => /^\d+px$/.test(o.text)));
  assert.ok(info('css', 'style p: font-size: 1.5rem', '1.5rem').options.every(o => /rem$/.test(o.text)));
  assert.ok(info('css', 'css: p { letter-spacing: 2; }', '2').options.some(o => o.text === '1px'), 'written as CSS, a length needs a unit');
  assert.ok(info('css', 'style p: line-height: 1.5', '1.5').options.every(o => /^[\d.]+$/.test(o.text)), 'line height has no unit');
  assert.ok(info('css', 'style x: 40% see-through', '40%').options.every(o => /%$/.test(o.text)));
  // every option, put in the value's place, reads back as the same kind of value
  for (const [lang, line, text] of SPOTS) {
    const v = at(line, lang, text);
    for (const o of V.explain(line, v, lang).options) {
      const next = line.slice(0, v.start) + o.text + line.slice(v.end);
      const back = V.scan(next, lang).find(x => x.start === v.start);
      assert.ok(back && back.text === o.text, `option ${o.text} for ${text} in "${line}"`);
    }
  }
});

test('explain: lines from the kits that once read wrongly', () => {
  assert.deepEqual(texts('add a drawing area called photo-1 600 by 450 in group photo', 'html'), ['600', '450'], 'photo-1 is a name');
  assert.equal(info('html', 'add a drawing area called photo-1 600 by 450 in group photo', '450').title, 'Height of the drawing area');
  assert.equal(info('css', 'style avatar: background: linear-gradient(135deg, #f06595, #845ef7)', '135deg').title, 'Gradient direction');
  assert.equal(info('css', 'style the page: --paper: #131a12', '#131a12').title, 'Shared colour');
  assert.equal(info('python', 'set ticks to 0', '0').title, 'The starting value of ticks', 'a count of ticks is not a time');
  assert.equal(info('python', 'set TICK to 30', '30').title, 'Milliseconds between runs');
  assert.equal(info('python', 'count x from 0 to WIDTH by 20', '20').title, 'Counting in steps of');
  assert.equal(info('python', 'run canvas.create_line with 0, GROUND, WIDTH, GROUND, fill=GROUND_COLOUR, width=2, tags="ground"', '2').title, 'Line thickness');
  assert.equal(info('python', 'run canvas.create_oval with 322, 34, 406, 118, fill=HALO_COLOUR', '406').title, 'Right edge (x2)');
  assert.equal(info('python', 'set canvas to tk.Canvas(window, width=WIDTH, height=HEIGHT, highlightthickness=0)', '0').title, 'Border thickness');
  assert.equal(info('python', 'set CANNON_WIDTH to 36', '36').title, 'Width');
  assert.equal(info('css', 'style a: padding 32 16 40', '40').title, 'Space inside (bottom)');
});

test('explain: a value nothing is known about gets a spread, named after what it sets', () => {
  const e = info('python', 'set mystery to 7', '7');
  assert.equal(e.title, 'The starting value of mystery');
  assert.deepEqual(plain(e.options.map(o => o.text)), ['0', '1', '3.5', '7', '10', '14', '100']);
  assert.equal(e.options[e.current].text, '7');
  assert.equal(e.step, 1);
  const n = info('python', 'show 42', '42');
  assert.equal(n.title, 'A number');
  assert.equal(info('python', 'show 0.25', '0.25').step, 0.01);
  assert.match(info('python', 'if x is more than 20', '20').about, /compared/);
  assert.match(info('js', 'draw a rectangle at i times 48, 0 sized 4 by 4 in "red" on game', '48').about, /x position/);
});

test('explain: colours', () => {
  const hex = info('css', 'style a: text colour #1A2B3C', '#1A2B3C');
  assert.equal(hex.title, 'Text colour');
  assert.match(hex.about, /#000000 is black/);
  assert.ok(hex.options.every(o => o.text === o.text.toUpperCase()), 'hex options in the case it was written in');
  assert.equal(hex.current, -1);
  const named = info('js', 'fill game with "skyblue"', 'skyblue');
  assert.equal(named.title, 'Colour to fill with');
  assert.ok(named.options.every(o => /^[a-z]+$/.test(o.text) && /^#[0-9a-f]{6}$/.test(o.swatch)));
  assert.equal(named.options[named.current].text, 'skyblue');
  assert.ok(named.options.length >= 10 && named.options.length <= 16);
  assert.equal(info('python', 'run canvas.create_rectangle with 1, 2, 3, 4, fill="red"', 'red').title, 'Fill colour');
  assert.equal(info('css', 'style a: background #000', '#000').options[0].text, '#000000', 'a short code still finds black');
  assert.equal(info('css', 'style a: background #000', '#000').current, 0);
});

test('explain: plain, helpful words', () => {
  const lines = SPOTS.map(([lang, line, text]) => info(lang, line, text));
  lines.push(info('python', 'set mystery to 7', '7'), info('css', 'style a: background #ff0000', '#ff0000'), info('js', 'fill game with "navy"', 'navy'));
  for (const e of lines) {
    for (const s of [e.title, e.about, ...e.options.map(o => o.label)]) {
      assert.doesNotMatch(s, /!|\b(?:simply|just|easy|easily|great question)\b/i, s);
      assert.doesNotMatch(s, /[\u{1F300}-\u{1FAFF}]/u, s);
    }
    for (const o of e.options) assert.ok(!o.label.startsWith(o.text + ' '), `label repeats the value: ${o.text} ${o.label}`);
  }
});

test('step: numbers', () => {
  assert.equal(nudge('css', 'style p: text size 24', '24', 1), '25');
  assert.equal(nudge('css', 'style p: text size 24', '24', -1), '23');
  assert.equal(nudge('python', 'wait 0.5 seconds', '0.5', 1), '0.6');
  assert.equal(nudge('python', 'wait 0.7 seconds', '0.7', 1), '0.8', 'never 0.7999999999999999');
  assert.equal(nudge('css', 'style p: line-height: 1.25', '1.25', 1), '1.35');
  assert.equal(nudge('css', 'style p: line-height: 1.9', '1.9', 1), '2');
  assert.equal(nudge('css', 'style p: font-size: 18px', '18px', 1), '19px', 'the unit stays');
  assert.equal(nudge('css', 'style x: 40% see-through', '40%', -1), '35%');
  assert.equal(nudge('css', 'style a: transition: all 0.2s ease', '0.2s', 1), '0.25s');
  assert.equal(nudge('js', 'draw a rectangle at -10, 5 sized 4 by 4 in "red" on game', '-10', 1), '-9', 'the sign stays');
  assert.equal(nudge('js', 'draw a rectangle at 0, 5 sized 4 by 4 in "red" on game', '0', -1), '-1');
  assert.equal(nudge('python', 'show 0.25', '0.25', 1), '0.26');
  assert.equal(nudge('python', 'increase speed by 0.001', '0.001', 1), '0.002');
});

test('step: limits', () => {
  assert.equal(nudge('css', 'style x: opacity: 1', '1', 1), null, 'opacity tops out at 1');
  assert.equal(nudge('css', 'style x: opacity: 0.98', '0.98', 1), '1', 'clamped to the top');
  assert.equal(nudge('css', 'style x: opacity: 0', '0', -1), null);
  assert.equal(nudge('css', 'style p: font-weight: 900', '900', 1), null);
  assert.equal(nudge('css', 'style p: font-weight: 400', '400', 1), '500');
  assert.equal(nudge('arduino', 'set the brightness of pin 9 to 253', '253', 1), '255');
  assert.equal(nudge('css', 'style card: rounded corners 0', '0', -1), null, 'sizes stay at 0 or more');
  assert.equal(nudge('python', 'set y to x - 0', '0', -1), null, 'after a minus, it does not turn into x - -1');
  assert.equal(nudge('arduino', 'start the serial monitor at 9600', '9600', 1), '19200', 'serial speeds go to the next one');
  assert.equal(nudge('arduino', 'start the serial monitor at 115200', '115200', 1), null);
  assert.equal(nudge('js', 'play a note of 440 for 1 seconds', '440', 1), '494', 'notes go to the next note');
  assert.equal(nudge('js', 'play a note of 450 for 1 seconds', '450', -1), '440');
});

test('step: colours lighter and darker, in the same case; names become codes', () => {
  assert.equal(nudge('css', 'style a: background #000000', '#000000', 1), '#141414');
  assert.equal(nudge('css', 'style a: background #000000', '#000000', -1), null, 'black is as dark as it goes');
  assert.equal(nudge('css', 'style a: background #ffffff', '#ffffff', 1), null);
  assert.equal(nudge('css', 'style a: background #808080', '#808080', -1), '#6c6c6c');
  const up = V.step('style a: background #1A2B3C', at('style a: background #1A2B3C', 'css', '#1A2B3C'), 1);
  assert.match(up, /^#[0-9A-F]{6}$/, 'upper case stays upper case');
  assert.match(V.step('style a: background #1a2b3c', at('style a: background #1a2b3c', 'css', '#1a2b3c'), -1), /^#[0-9a-f]{6}$/);
  assert.equal(nudge('css', 'style a: background #fff', '#fff', -1), '#ebebeb', 'a short code becomes six digits');
  assert.equal(nudge('css', 'style a: background #00000080', '#00000080', 1), '#14141480', 'the see-through part stays');
  assert.equal(nudge('js', 'fill game with "navy"', 'navy', 1), '#0000a9');
  assert.equal(nudge('js', 'fill game with "white"', 'white', -1), '#ebebeb');
  assert.equal(nudge('js', 'fill game with "white"', 'white', 1), null);
});

test('step: words go round their list', () => {
  const line = 'style a: text-align: center';
  assert.equal(nudge('css', line, 'center', 1), 'right');
  assert.equal(nudge('css', line, 'center', -1), 'left');
  const v = at('style a: text-align: left', 'css', 'left');
  assert.equal(V.step('style a: text-align: left', v, -1), 'end', 'wraps round from the first to the last');
  const e = info('css', 'style a: text-align: centre', 'centre');
  assert.equal(e.current, -1);
  assert.equal(nudge('css', 'style a: text-align: centre', 'centre', 1), 'left');
  assert.equal(nudge('arduino', 'read analog pin A5 and store in x', 'A5', 1), 'A0');
});

test('toHex', () => {
  assert.equal(V.toHex('navy'), '#000080');
  assert.equal(V.toHex('Tomato'), '#ff6347');
  assert.equal(V.toHex('light grey'), '#d3d3d3');
  assert.equal(V.toHex('#ABC'), '#aabbcc');
  assert.equal(V.toHex('#11223344'), '#112233');
  assert.equal(V.toHex('transparent'), null);
  assert.equal(V.toHex('notacolour'), null);
  assert.equal(V.toHex('#12345'), null);
});

test('every line in the kits: values are where they say, and explaining and stepping never fail', () => {
  const dir = path.join(ROOT, 'lang/kits');
  const lines = readdirSync(dir).filter(f => f.endsWith('.js')).flatMap(f => readFileSync(path.join(dir, f), 'utf8').split('\n')).filter(l => /[\d#]/.test(l));
  let values = 0;
  for (const lang of ['python', 'css', 'js', 'html', 'arduino']) {
    for (const line of lines) {
      for (const v of V.scan(line, lang)) {
        values++;
        assert.equal(line.slice(v.start, v.end), v.text, line);
        const e = V.explain(line, v, lang);
        assert.ok(e.title && typeof e.about === 'string' && Array.isArray(e.options), line);
        assert.ok(e.current >= -1 && e.current < e.options.length, line);
        for (const dir of [-1, 1]) { const s = V.step(line, v, dir, e); assert.ok(s === null || (typeof s === 'string' && s && !/\de-|\d{7,}\.|\.\d{9,}/.test(s)), `${s} from ${v.text} in ${line}`); }
      }
    }
  }
  assert.ok(values > 1000, `${values} values`);
});

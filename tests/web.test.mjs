import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadEngine, loadWebReader, pyProject, ROOT } from './helpers/engine.mjs';

const { WEB, BP } = loadEngine();
const plain = (x) => JSON.parse(JSON.stringify(x));
const site = (structure, styling = '', mechanics = '') => WEB.compileWebsite({ sections: [
  { id: 'structure', file: 'structure', text: structure }, { id: 'styling', file: 'styling', text: styling }, { id: 'mechanics', file: 'mechanics', text: mechanics }] });
const problems = (res, id) => plain(res.results[id].info.flatMap(i => i.errs));

test('structure: names, groups, nesting and a complete page', () => {
  const r = site('page title is "Shop"\nadd a section called hero in group dark\n    add a big heading "Hello"\n    add a button called buy saying "Buy"');
  const html = r.results.structure.text;
  assert.deepEqual(problems(r, 'structure'), []);
  assert.match(html, /<title>Shop<\/title>/);
  assert.match(html, /<section id="hero" class="dark">\n\s+<h1>Hello<\/h1>\n\s+<button id="buy" type="button">Buy<\/button>\n\s+<\/section>/);
  assert.match(html, /name="viewport"/);
});

test('‹blanks›: one problem per line, text blanks stay visible, and the script still runs', () => {
  const r = site('add a big heading "‹your name›"\nadd a section called ‹name›\nnote: fill in the ‹blanks›',
    'style hero: background ‹a colour›',
    'set total to ‹a number›\nshow "{‹how many›} and {{braces}} ‹as text›"\nshow "done"');
  assert.deepEqual(plain(r.results.structure.info.map(i => i.errs)), [['Fill in the ‹your name› slot.'], ['Fill in the ‹name› slot.'], []]);
  assert.deepEqual(problems(r, 'styling'), ['Fill in the ‹a colour› slot.']);
  assert.deepEqual(problems(r, 'mechanics'), ['Fill in the ‹a number› slot.', 'Fill in the ‹how many› slot.', 'Fill in the ‹as text› slot.']);
  assert.match(r.results.structure.text, /<h1>‹your name›<\/h1>/);
  const js = r.results.mechanics.text;
  assert.match(js, /\$\{_\} and \{braces\} ‹as text›/);
  assert.doesNotThrow(() => new vm.Script(js), 'a blank must not break the rest of the script');
});

test('games: a frame loop, keys held and pressed, taps, drawing and a note, all as sentences', () => {
  const r = site('add a drawing area called game 480 by 270', '', [
    'keep track of the keys', 'set px to 40', 'set py to 200', 'set fall to 0',
    'when the key "space" is pressed', '    set fall to -9',
    'when the screen is tapped', '    set px to tap x',
    'every frame', '    if "left" is held', '        decrease px by 3',
    '    increase fall by 0.5', '    increase py by fall',
    '    clear game', '    fill game with "midnightblue"', '    draw a rectangle at px, py sized 20 by 20 in "tomato" on game',
    '    draw a circle at 400, 60 with radius 18 in gold on game', '    draw text "x: {px}" at 10, 24 size 18 in "white" on game',
    '    draw a line from 0, 220 to the width of game, 220 in "#5fd" on game', '    play a note of 440 for 0.05 seconds'].join('\n'));
  assert.deepEqual(problems(r, 'mechanics'), []);
  assert.deepEqual(plain(r.results.mechanics.info.flatMap(i => i.warns)), []);
  const js = r.results.mechanics.text;
  assert.doesNotThrow(() => new vm.Script(js));
  assert.match(js, /const keysDown = new Set\(\);/);
  assert.match(js, /if \(event\.key !== " "\) return;/, 'space is " "');
  assert.match(js, /px = event\.offsetX;/);
  assert.match(js, /requestAnimationFrame\(function frame\(\) \{[\s\S]*if \(keysDown\.has\("ArrowLeft"\)\)[\s\S]*requestAnimationFrame\(frame\);\n\}\);/);
  assert.match(js, /pen\.fillStyle = "gold";/, 'a bare colour word is a colour');
  assert.match(js, /pen\.lineTo\(document\.getElementById\("game"\)\.width, 220\);/);
  assert.match(js, /note\.frequency\.value = 440;/);
  assert.match(site('add a drawing area called game', '', 'if "left" is held\n    show 1').results.mechanics.info[0].errs.join(' '), /keep track of the keys/);
});

test('structure: a button inside a form sends the form', () => {
  assert.match(site('add a form called f\n    add a button called go saying "Go"').results.structure.text, /<button id="go" type="submit">/);
});

test('styling: the original examples (group, shadow, transparency, belongs to)', () => {
  const r = site('add a block called player', 'create group group 1: background #000000, shadow #000eee with 40% intensity, 20% see-through\nplayer belongs to group group 1');
  const css = r.results.styling.text;
  assert.match(css, /\.group-1 \{\n  background: #000000;\n  box-shadow: 0 4px 12px rgba\(0, 14, 238, 0\.4\);\n  opacity: 0\.8;\n\}/);
  assert.match(r.results.structure.text, /<div id="player" class="group-1">/);
});

test('styling: an invalid colour code is explained', () => {
  const r = site('add a block called box', 'style box: background #00015r');
  assert.ok(problems(r, 'styling').some(e => /isn't a colour code/.test(e)));
});

test('styling: see-through background only fades the background', () => {
  assert.match(site('add a block called b', 'style b: background #000000 40% see-through').results.styling.text, /background: rgba\(0, 0, 0, 0\.6\);/);
});

test('styling: screen sizes and hover', () => {
  const css = site('add a block called b', 'when b is hovered: bold\non screens narrower than 600:\n    style b: space inside 4').results.styling.text;
  assert.match(css, /#b:hover \{\n  font-weight: bold;\n\}/);
  assert.match(css, /@media \(max-width: 600px\) \{\n  #b \{\n    padding: 4px;/);
});

test('mechanics: events, page text, lists and the browser memory', () => {
  const r = site('add a text box called name\nadd a button called go saying "Go"\nadd a list called out\nadd a paragraph called msg "…"', '',
    'create list names\nwhen go is clicked\n    get the text of name and store in n\n    if n is empty text\n        set the text of msg to "Type a name"\n    otherwise\n        add n to names\n        add n to the list out\n        save names in the browser as "names"\n        set the text of msg to "{length of names} names"');
  assert.deepEqual(problems(r, 'mechanics'), []);
  const js = r.results.mechanics.text;
  assert.doesNotThrow(() => new vm.Script(js), 'generated JavaScript must be valid');
  assert.match(js, /document\.getElementById\("go"\)\.addEventListener\("click", \(\) => \{/);
  assert.match(js, /let n = document\.getElementById\("name"\)\.value;/);
  assert.match(js, /\} else \{/);
  assert.match(js, /`\$\{names\.length\} names`/);
});

test('mechanics: talking to a server makes the handler async', () => {
  const js = site('add a button called load saying "Load"', '', 'when load is clicked\n    fetch from "/api/items" and store in items\n    show items').results.mechanics.text;
  assert.match(js, /addEventListener\("click", async \(\) =>/);
  assert.doesNotThrow(() => new vm.Script(js));
});

test('mechanics: unknown element names are explained', () => {
  assert.ok(problems(site('', '', 'when nothing-here is clicked\n    show "x"'), 'mechanics').some(e => /Nothing in Structure is called/.test(e)));
});

test('every website blueprint makes valid JavaScript', () => {
  for (const src of BP.BUILT_IN) {
    const bp = BP.parse(src);
    if (bp.layout !== 'website') continue;
    for (const f of bp.fields.filter(x => x.choices)) for (const v of f.choices) {
      const filled = BP.fill(bp, { [f.name]: v });
      const js = site(filled.structure, filled.styling, filled.mechanics).results.mechanics.text;
      assert.doesNotThrow(() => new vm.Script(js), `${bp.title} (${v})`);
    }
  }
});

test('preview inlines styles and scripts', () => {
  const doc = WEB.previewDocument(site('add a button called a saying "A"', 'style a: bold', 'when a is clicked\n    show "hi"'), '/*helper*/');
  assert.match(doc.html, /<style>\n#a \{/);
  assert.match(doc.html, /\/\*helper\*\//);
  assert.match(doc.html, /data-ic-line="0"/);
});

test('preview keeps $&, $\' and $$ in the code as they are', () => {
  const r = site('add a paragraph called total "x"', 'css: p::after { content: "$& $\' $$"; }', 'set sum to 12\nset the text of total to "Total: ${sum}"\njs: const s = "$&$\'$$";');
  const js = r.results.mechanics.text;
  assert.match(js, /`Total: \$\$\{sum\}`/);   // a dollar sign, then the value
  const doc = WEB.previewDocument(r, '/*helper*/');
  assert.ok(doc.html.includes(`<script>\n${js}</script>`), doc.html);
  assert.ok(doc.html.includes('p::after { content: "$& $\' $$"; }'), doc.html);
  assert.equal(doc.html.split('\n')[doc.jsLine - 1], 'let sum = 12;');
  // a script placed in <head> with defer still runs after the page is read
  const d2 = WEB.previewDocument(site('head: <script src="script.js" defer></script>\nadd a paragraph "x"', '', 'show "hi"'), '');
  assert.ok(d2.html.indexOf('console.log("hi")') > d2.html.indexOf('<p>x</p>'), d2.html);
  assert.equal(d2.html.split('\n')[d2.jsLine - 1], 'console.log("hi");');
});

test('mechanics: increase gives ++, let or const as the code needs, words inside quotes never split a sentence', () => {
  const r = site('add a paragraph called out "x"', '', [
    'set n to 0', 'increase n', 'decrease n', 'increase n by 1',
    'fetch from "/api/items" and store in items', 'set items to items.rows',
    'fetch from "/api/user" and store in user',
    'for each item in items', '    set item to item.name',
    'for each row in items', '    show row',
    'define shout using word', '    set word to word in capitals', '    give back word',
    'send "a to b" to "/api/log"',
    'constant LIMIT is 3',
  ].join('\n'));
  const js = r.results.mechanics.text;
  assert.deepEqual(problems(r, 'mechanics'), []);
  assert.match(js, /^let n = 0;\nn\+\+;\nn--;\nn \+= 1;$/m);
  assert.match(js, /^let items = await \(await fetch\("\/api\/items"\)\)\.json\(\);\nitems = items\.rows;$/m);
  assert.match(js, /^const user = await \(await fetch\("\/api\/user"\)\)\.json\(\);$/m);
  assert.match(js, /^for \(let item of items\) \{\n  item = item\.name;$/m);
  assert.match(js, /^for \(const row of items\) \{$/m);
  assert.match(js, /^  word = word\.toUpperCase\(\);$/m);
  assert.match(js, /body: JSON\.stringify\("a to b"\)/);
  assert.doesNotThrow(() => new vm.Script(`(async () => {\n${js}\n})`));
  assert.ok(problems(site('', '', 'constant LIMIT is 3\nset LIMIT to 4'), 'mechanics').some(e => /is a constant/.test(e)));
});

test('text in quotes: {name} fills in a value, {{ and }} are braces', () => {
  const js = site('', '', 'set x to 1\nshow "{{x}} is {x}"\nshow "just {{braces}}"').results.mechanics.text;
  assert.match(js, /console\.log\(`\{x\} is \$\{x\}`\);/);
  assert.match(js, /console\.log\("just \{braces\}"\);/);
  assert.doesNotThrow(() => new vm.Script(js));
});

test('structure: the doctype, the <html> tag and the usual settings can be left out or replaced', () => {
  const html = site('no doctype\nno page language\nhtml attributes: dir="rtl" class="no-js"\nleave out the character set\nhead: <meta name="viewport" content="width=1024">\nhead: <link rel="stylesheet" href="style.css">\nhead: <style>\nhead:   p { color: red; }\nhead: </style>\nhtml: <pre>\nhtml:   two  spaces\nhtml: </pre>\nadd a paragraph "Say \\"hi\\" \\\\o/"\nhtml: <script src="script.js"></script>\nadd a paragraph "after"').results.structure.text;
  assert.match(html, /^<html dir="rtl" class="no-js">\n<head>\n  <title>My page<\/title>\n  <meta name="viewport" content="width=1024">\n  <link rel="stylesheet" href="style.css">\n  <style>\n  p \{ color: red; \}\n<\/style>\n<\/head>/);   // no doctype, charset or second viewport; styles in order
  assert.match(html, /\n  <pre>\n  two  spaces\n<\/pre>\n/);   // lines inside <pre> keep their own spaces
  assert.match(html, /<p>Say "hi" \\o\/<\/p>/);
  assert.match(html, /<script src="script\.js"><\/script>\n  <p>after<\/p>\n<\/body>/);   // Mechanics loads where the line says, once
  assert.equal(html.match(/script\.js/g).length, 1);
});

/* ---------- sentences the kit packs needed ---------- */

/* Just enough of a page to run Mechanics: elements by id, made elements, listeners, groups and timers. */
function fakeDom(ids) {
  const make = (tag, id = '') => {
    const groups = new Set(), on = {};
    const el = { tagName: tag.toUpperCase(), id, textContent: '', value: '', checked: false, hidden: false, style: {}, children: [], files: [],
      classList: { add: (...c) => c.forEach(g => groups.add(g)), remove: (...c) => c.forEach(g => groups.delete(g)), contains: (c) => groups.has(c) },
      append: (...k) => { el.children.push(...k); k.forEach(c => { c.parent = el; }); }, remove: () => { el.parent.children = el.parent.children.filter(c => c !== el); },
      addEventListener: (ev, fn) => (on[ev] = on[ev] || []).push(fn), fire: async (ev, extra = {}) => { for (const fn of on[ev] || []) await fn({ target: el, preventDefault() {}, ...extra }); } };
    return el;
  };
  const els = Object.fromEntries(ids.map(([tag, id]) => [id, make(tag, id)]));
  const page = make('html');
  const timers = [];
  const ctx = { console: { log() {} }, Math, JSON, Promise, Error,
    document: { getElementById: (id) => els[id] || null, createElement: (t) => make(t), addEventListener: page.addEventListener },
    setInterval: (fn, ms) => timers.push({ fn, ms, every: true }), setTimeout: (fn, ms) => timers.push({ fn, ms, every: false }),
    clearInterval: (n) => { timers[n - 1].stopped = true; }, clearTimeout: (n) => { timers[n - 1].stopped = true; } };
  ctx.window = ctx;
  vm.createContext(ctx);
  return { ctx, els, page, timers, run: (js) => vm.runInContext(js, ctx) };
}

test('structure: number box settings, a time box, a slider, file pickers and named checkboxes', () => {
  const r = site([
    'add a number box called amount with hint "4.50", allowing decimals, from 0 to 1000',
    'add a number box called rounds at least 1, in steps of 1',
    'add a text box called pin with a number keypad',
    'add a time box called wake',
    'add a slider called volume from 0 to 11',
    'add a file picker called photo for a picture',
    'add a file picker called songs for several sounds',
    'add a file picker called data for ".csv"',
    'add a checkbox called reminders saying "Remind me"'].join('\n'), '',
    'when reminders is changed\n    if reminders is ticked\n        untick reminders\n    otherwise\n        tick reminders\nwhen photo is changed\n    set picked to the file in photo\n    set all to the files in songs\n    show picked, all');
  const html = r.results.structure.text, js = r.results.mechanics.text;
  assert.deepEqual([...problems(r, 'structure'), ...problems(r, 'mechanics')], []);
  assert.match(html, /<input id="amount" type="number" placeholder="4\.50" step="any" min="0" max="1000">/);
  assert.match(html, /<input id="rounds" type="number" step="1" min="1">/);
  assert.match(html, /<input id="pin" type="text" inputmode="numeric">/);
  assert.match(html, /<input id="wake" type="time">/);
  assert.match(html, /<input id="volume" type="range" min="0" max="11">/);
  assert.match(html, /<input id="photo" type="file" accept="image\/\*">/);
  assert.match(html, /<input id="songs" type="file" accept="audio\/\*" multiple>/);
  assert.match(html, /<input id="data" type="file" accept="\.csv">/);
  assert.match(js, /if \(document\.getElementById\("reminders"\)\.checked\) \{\n    document\.getElementById\("reminders"\)\.checked = false;/, 'a named checkbox is usable in Mechanics');
  assert.match(js, /let picked = document\.getElementById\("photo"\)\.files\[0\];\n  let all = document\.getElementById\("songs"\)\.files;/);
  assert.match(problems(site('add a number box called n in steps of lots'), 'structure').join(' '), /isn't a number/);
  assert.match(problems(site('add a number box called n with sprinkles'), 'structure').join(' '), /I don't understand "with sprinkles"/);
});

test('styling: ::before and ::after, commas inside one value, currentColor and inherit, and "next" in a name', () => {
  const r = site('add a list called cards\nadd a button called go saying "Go"\nadd a button called next-card saying "Next"', [
    'before list items: content: attr(data-time), text colour the colour muted',
    'after go: content: " ✎"',
    'style #cards li::after: content: attr(data-left), font-weight: 400',
    'style a:hover: bold',
    'style go: transition: opacity 0.4s, transform 0.4s ease, bold, font-family: Georgia, serif',
    'style go: box-shadow: inset 0 0 0 1px red, 0 2px 4px black, border 2 currentColor, background inherit',
    'when headings is hovered: bold',
    'next card belongs to group primary'].join('\n'));
  const css = r.results.styling.text;
  assert.deepEqual(problems(r, 'styling'), []);
  assert.match(css, /^li::before \{\n  content: attr\(data-time\);\n  color: var\(--muted\);\n\}/m);
  assert.match(css, /^#go::after \{\n  content: " ✎";\n\}/m);
  assert.match(css, /^#cards li::after \{\n  content: attr\(data-left\);\n  font-weight: 400;\n\}/m, 'the first colon no longer ends the selector');
  assert.match(css, /^a:hover \{\n  font-weight: bold;\n\}/m);
  assert.match(css, /  transition: opacity 0\.4s, transform 0\.4s ease;\n  font-weight: bold;\n  font-family: Georgia, serif;/);
  assert.match(css, /  box-shadow: inset 0 0 0 1px red, 0 2px 4px black;\n  border: 2px solid currentColor;\n  background: inherit;/);
  assert.match(css, /^h1:hover, h2:hover, h3:hover \{/m, 'every selector in a list gets the hover');
  assert.match(r.results.structure.text, /<button id="next-card" class="primary" type="button">/, '"next" stays part of the name');
  assert.match(plain(site('add a button called go saying "Go"', 'after go: bold').results.styling.info[0].warns).join(' '), /without content/);
});

test('mechanics: one item of a list or a record, a field, nested items, and element names in set and run', () => {
  const r = site('add a block called meter-fill\nadd a list called todo-list\nadd a drawing area called game 100 by 100', '', [
    'create list grid with [0, 0], [0, 0]', 'set item 1 of item 0 of grid to 5', 'set last item of grid to [7]',
    'set plans to {}', 'set time to "07:30"', 'set item time of plans to "Gym"', 'set "08:00" of plans to "Work"', 'set colour of plans to "red"',
    'show item 1 of item 0 of grid, first item of last item of grid',
    'set meter-fill.style.width to "50%"', 'set the width of game to 200', 'run todo-list.classList.add with "busy"', 'set n to length of todo-list.children'].join('\n'));
  assert.deepEqual(problems(r, 'mechanics'), []);
  const js = r.results.mechanics.text;
  assert.match(js, /^grid\[0\]\[1\] = 5;\ngrid\[grid\.length - 1\] = \[7\];$/m);
  assert.match(js, /^plans\[time\] = "Gym";\nplans\["08:00"\] = "Work";\nplans\.colour = "red";$/m);
  assert.match(js, /console\.log\(grid\[0\]\[1\], grid\[grid\.length - 1\]\[0\]\);/);
  assert.match(js, /^document\.getElementById\("meter-fill"\)\.style\.width = "50%";\ndocument\.getElementById\("game"\)\.width = 200;\ndocument\.getElementById\("todo-list"\)\.classList\.add\("busy"\);$/m);
  assert.match(js, /let n = document\.getElementById\("todo-list"\)\.children\.length;/, 'a name with dashes is one value');
  const d = fakeDom([['div', 'meter-fill'], ['ul', 'todo-list'], ['canvas', 'game']]);
  d.run(js.replace(/console\.log\((.*)\);/, 'globalThis.shown = [$1];'));
  assert.deepEqual(plain(d.run('grid')), [[0, 5], [7]]);
  assert.deepEqual(plain(d.run('plans')), { '07:30': 'Gym', '08:00': 'Work', colour: 'red' });
});

test('mechanics: making elements, and reacting to them like elements from Structure', async () => {
  const r = site('add a list called todo-list', '', [
    'define addRow using label',
    '    description: Adds a row to the list, with a Remove button.',
    '    description: Clicking Remove takes the row away.',
    '    make a new list item saying label in todo-list in group row and store in row',
    '    make a new button saying "Remove" in row in group remove and store in button',
    '    when button is clicked',
    '        run row.remove',
    '    put row in group fresh',
    '    hide button',
    '    if row is in group fresh',
    '        reveal button',
    '    make a new text saying "!" in row',
    'run addRow with "Milk"', 'run addRow with "Bread"'].join('\n'));
  assert.deepEqual(problems(r, 'mechanics'), []);
  const js = r.results.mechanics.text;
  assert.match(js, /^\/\*\*\n \* Adds a row to the list, with a Remove button\.\n \* Clicking Remove takes the row away\.\n \*\/\nfunction addRow\(label\) \{/m, 'descriptions go above the function, as JSDoc');
  assert.match(js, /  const row = document\.createElement\("li"\);\n  row\.textContent = label;\n  row\.classList\.add\("row"\);\n  document\.getElementById\("todo-list"\)\.append\(row\);/);
  assert.match(js, /  button\.addEventListener\("click", \(\) => \{\n    row\.remove\(\);/);
  const d = fakeDom([['ul', 'todo-list']]);
  d.run(js);
  const list = d.els['todo-list'];
  assert.deepEqual(list.children.map(c => c.textContent), ['Milk', 'Bread']);
  const [milk] = list.children;
  assert.ok(milk.classList.contains('row') && milk.classList.contains('fresh'));
  assert.deepEqual(milk.children.map(c => [c.tagName, c.textContent, c.hidden]), [['BUTTON', 'Remove', false], ['SPAN', '!', false]]);
  await milk.children[0].fire('click');
  assert.deepEqual(list.children.map(c => c.textContent), ['Bread']);
  assert.match(problems(site('', '', 'make a new button called b saying "x"'), 'mechanics').join(' '), /named at the end, with "and store in/);
  // a name only ever set to a number or text doesn't hold an element, so these stay mistakes to point out
  assert.match(problems(site('', '', 'set score to 0\nhide score'), 'mechanics').join(' '), /Nothing in Structure is called `score`/);
  assert.match(problems(site('', '', 'set number of lives to 3'), 'mechanics').join(' '), /I don't recognise this sentence/);
  assert.match(plain(site('', '', 'make a new button saying "x"').results.mechanics.info[0].warns).join(' '), /isn't put anywhere/);
  assert.match(site('', '', 'make a new list called scores with 1, 2').results.mechanics.text, /let scores = \[1, 2\];/, 'a list of values, not a list on the page');
});

test('mechanics: a pointer released or moving, the screen released, a key let go', () => {
  const r = site('add a drawing area called game 100 by 100', '', 'when game is released\n    show tap x\nwhen the pointer moves over game\n    show tap y\nwhen the screen is released\n    show "up"\nwhen the key "space" is released\n    show "space up"');
  assert.deepEqual(problems(r, 'mechanics'), []);
  const js = r.results.mechanics.text;
  assert.match(js, /document\.getElementById\("game"\)\.addEventListener\("pointerup", \(event\) => \{\n  console\.log\(event\.offsetX\);/);
  assert.match(js, /document\.getElementById\("game"\)\.addEventListener\("pointermove", \(event\) => \{\n  console\.log\(event\.offsetY\);/);
  assert.match(js, /document\.addEventListener\("pointerup", \(event\) => \{/);
  assert.match(js, /document\.addEventListener\("keyup", \(event\) => \{\n  if \(event\.key !== " "\) return;/);
});

test('mechanics: timers by a name or a value, and stopping them', () => {
  const r = site('add a button called stop-it saying "Stop"', '', 'set gap to 2\nset ticker to nothing\nevery gap seconds as ticker\n    show "tick"\nafter 3 seconds as reminder\n    stop ticker\nevery second\n    show "s"\nwhen stop-it is clicked\n    stop reminder\n    stop repeating ticker');
  assert.deepEqual(problems(r, 'mechanics'), []);
  const js = r.results.mechanics.text;
  assert.match(js, /^ticker = setInterval\(\(\) => \{\n  console\.log\("tick"\);\n\}, gap \* 1000\);$/m);
  assert.match(js, /^let reminder = setTimeout\(\(\) => \{\n  clearInterval\(ticker\);\n\}, 3000\);$/m);
  assert.match(js, /^setInterval\(\(\) => \{\n  console\.log\("s"\);\n\}, 1000\);$/m);
  assert.match(js, /  clearTimeout\(reminder\);\n  clearInterval\(ticker\);/);
  const d = fakeDom([['button', 'stop-it']]);
  d.run(js);
  d.timers[1].fn();
  assert.ok(d.timers[0].stopped, 'the reminder stopped the repeat');
  assert.match(problems(site('', '', 'stop clock'), 'mechanics').join(' '), /There's no timer called `clock`\. Name one when it starts, like: every 2 seconds as clock/);
  assert.match(plain(site('add a button called go saying "Go"', '', 'when go is clicked\n    every 1 second as t\n        show 1').results.mechanics.info[1].warns).join(' '), /only lines inside it can stop it/);
});

test('mechanics: try, if it fails, in any case, and wait for', async () => {
  const r = site('add a button called copy saying "Copy"\nadd a paragraph called copied ""', '', [
    'when copy is clicked', '    try', '        wait for navigator.clipboard.writeText("x")', '        set the text of copied to "Copied."',
    '    if it fails as problem', '        set the text of copied to "Not copied: {problem.message}"', '    in any case', '        show "done"'].join('\n'));
  assert.deepEqual(problems(r, 'mechanics'), []);
  const js = r.results.mechanics.text;
  assert.match(js, /addEventListener\("click", async \(\) => \{\n  try \{\n    await navigator\.clipboard\.writeText\("x"\);\n    document\.getElementById\("copied"\)\.textContent = "Copied\.";\n  \} catch \(problem\) \{\n    document\.getElementById\("copied"\)\.textContent = `Not copied: \$\{problem\.message\}`;\n  \} finally \{\n    console\.log\("done"\);\n  \}\n\}\);/);
  for (const works of [true, false]) {
    const d = fakeDom([['button', 'copy'], ['p', 'copied']]);
    d.ctx.navigator = { clipboard: { writeText: async () => { if (!works) throw new Error('blocked'); } } };
    d.run(js);
    await d.els.copy.fire('click');
    assert.equal(d.els.copied.textContent, works ? 'Copied.' : 'Not copied: blocked');
  }
  // a tool that waits makes whatever runs it wait too
  const chain = site('add a button called go saying "Go"', '', 'define load\n    wait for fetch("/x")\ndefine reload\n    run load\nwhen go is clicked\n    run reload').results.mechanics.text;
  assert.match(chain, /async function load\(\) \{[\s\S]*async function reload\(\) \{\n  await load\(\);[\s\S]*addEventListener\("click", async \(\) => \{\n  await reload\(\);/);
  assert.match(problems(site('', '', 'wait for fetch("/x")'), 'mechanics').join(' '), /only works inside a block that runs later/);
  assert.match(problems(site('', '', 'if it fails\n    show 1'), 'mechanics').join(' '), /goes straight after the lines under a "try"/);
  assert.match(site('', '', 'define check using n\n    if n is less than 0\n        fail with "Negative"').results.mechanics.text, /throw new Error\("Negative"\);/);
});

test('mechanics: the translator bugs the kit packs ran into', () => {
  const r = site('add a drawing area called game 480 by 270\nadd a paragraph called status ""', '', [
    'create list tasks', 'if tasks.some(t => t.done) and not tasks.every((a) => a.done)', '    show 1',
    'set w to "b"', 'if w is in "abc" and w is not in "xyz"', '    show 2',
    'set t to 30', 'draw a rectangle at 0, 0 sized t divided by 2 by t divided by 3 in "red" on game',
    'set size to 20', 'draw text "Hi" at size, size size size in "white" on game',
    'set gap to 10', 'set y to random number from gap plus 1 to (height of game minus gap)', 'set z to (random number from -3 to 3) divided by 40',
    'set o to {status: 1, text: "x"}', 'set k to Object.keys(o)', 'set u to URL.createObjectURL(o)', 'show navigator.vibrate, crypto.randomUUID()'].join('\n'));
  assert.deepEqual(problems(r, 'mechanics'), []);
  assert.deepEqual(plain(r.results.mechanics.info.flatMap(i => i.warns)), [], 'object keys and browser names are not unset names');
  const js = r.results.mechanics.text;
  assert.match(js, /if \(tasks\.some\(t => t\.done\) && !tasks\.every\(\(a\) => a\.done\)\) \{/, '=> stays an arrow in a condition');
  assert.match(js, /if \("abc"\.includes\(w\) && !"xyz"\.includes\(w\)\) \{/);
  assert.match(js, /pen\.fillRect\(0, 0, t \/ 2, t \/ 3\);/, '"divided by" is never the "by" of "sized … by …"');
  assert.match(js, /pen\.font = `\$\{size\}px sans-serif`;\n  pen\.fillText\("Hi", size, size\);/, 'a value named size');
  assert.match(js, /let y = \(Math\.floor\(Math\.random\(\) \* \(\(document\.getElementById\("game"\)\.height - gap\) - \(gap \+ 1\) \+ 1\)\) \+ \(gap \+ 1\)\);/);
  assert.match(js, /let z = \(\(Math\.floor\(Math\.random\(\) \* \(3 - -3 \+ 1\)\) \+ -3\)\) \/ 40;/);
  assert.match(js, /let o = \{status: 1, text: "x" ?\};/, 'a key is not the element with that name');
  assert.match(site('', '', 'set o to { "a b": 1, "c": ["d"] }\nset e to o ? "y" : "n"').results.mechanics.text, /let o = \{ "a b": 1, "c": \["d"\] \};\nlet e = o \? "y" : "n";/, 'a quoted key keeps its colon close; a ? : choice keeps its spaces');
  assert.doesNotThrow(() => new vm.Script(js));
  const unclear = problems(site('add a drawing area called game 480 by 270', '', 'set gap to 1\nset y to random number from 0 to height of game minus gap'), 'mechanics');
  assert.match(unclear.join(' '), /could mean two things\. Put brackets round what you mean: random number from 0 to \(height of game minus gap\), or \(random number from 0 to height of game\) minus gap\./);
});

/* ---------- the web reader ---------- */

const W = await loadWebReader();
const manifest = JSON.parse(readFileSync(ROOT + '/samples/taskboard/files.json', 'utf8'));
const all = manifest.files.map(f => ({ name: 'taskboard/' + f, source: readFileSync(ROOT + '/samples/taskboard/' + f, 'utf8') }));
const py = pyProject(all.filter(f => !W.kindOfPath(f.name) || f.name.endsWith('.py')));
const web = W.analyzeProject(all.filter(f => W.kindOfPath(f.name) && !f.name.endsWith('.py')), py);
const file = (p) => web.files.find(f => f.path === 'taskboard/' + p);
const facts = (p) => file(p).analysis.sections.flatMap(s => s.facts).join(' | ');
const warns = (p) => file(p).analysis.sections.flatMap(s => s.warnings).join(' | ');

test('reader: a page links to its styles and script', () => {
  assert.deepEqual(plain(file('static/index.html').imports).sort(), ['taskboard/static/app.js', 'taskboard/static/style.css']);
});

test('reader: front-end requests are linked to the Flask routes that answer them', () => {
  const f = facts('static/app.js');
  assert.match(f, /GET `\/api\/tasks`, answered by \[\[taskboard\/routes\/tasks\.py#list_tasks\]\]/);
  assert.match(f, /POST `\/api\/tasks\/\{…\}\/done`, answered by \[\[taskboard\/routes\/tasks\.py#complete_task\]\]/);
  assert.ok(plain(web.edges).some(([a, b]) => a.endsWith('app.js') && b.endsWith('routes/tasks.py')));
});

test('reader: scripts are linked to the page elements they use', () => {
  assert.match(facts('static/app.js'), /`#task-list` in \[\[taskboard\/static\/index\.html\]\]/);
});

test('reader: styles are linked to the elements they style', () => {
  assert.match(facts('static/index.html'), /Styled by `#board` in \[\[taskboard\/static\/style\.css\]\]/);
});

test('reader: web problems are flagged', () => {
  assert.match(warns('static/app.js'), /innerHTML/);
  assert.match(warns('static/index.html'), /no description \(alt text\)/);
  assert.match(warns('static/index.html'), /viewport/);
  assert.match(warns('static/style.css'), /`\.old-card`, so this style may be left over/);
});

test('reader: colours are described in words', () => {
  assert.equal(W.colorName('#0f1115'), 'near-black');
  assert.equal(W.colorName('#ffffff'), 'white');
  assert.equal(W.colorName('rgba(0, 0, 0, 0.4)'), 'near-black, 60% see-through');
  assert.equal(W.colorName('#4f7cff'), 'blue');
});

test('reader: React components are recognised', () => {
  const a = W.analyzeJs('App.jsx', 'import { useState } from "react";\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return <button onClick={() => setCount(count + 1)}>{count}</button>;\n}\n', 'js', { path: 'App.jsx', xnames: {}, uses: [], fetches: [], htmlTargets: () => null, routeFor: () => null, hasServer: false, fileOf: () => null });
  const s = a.sections.find(x => x.kind === 'component');
  assert.ok(s, 'component section');
  assert.match(s.facts.join(' '), /remembers `\[count, setCount\]`|remembers `count`/);
});

test('pictures: loaded once, then drawn on a drawing area, at their size or scaled', () => {
  const r = site('add a drawing area called game 320 by 180', '',
    'load the picture "images/ship.png" as ship\nevery frame\n    clear game\n    draw ship at 10, 20 on game\n    draw ship at x, 20 sized 64 by 32 on game');
  assert.deepEqual(problems(r, 'mechanics'), []);
  const js = r.results.mechanics.text;
  assert.match(js, /^const ship = new Image\(\);\nship\.src = "images\/ship\.png";/);
  assert.match(js, /pen\.drawImage\(ship, 10, 20\);/);
  assert.match(js, /pen\.drawImage\(ship, x, 20, 64, 32\);/);
  // the shapes it shares words with still mean shapes
  const shapes = site('add a drawing area called game 320 by 180', '', 'draw a rectangle at 1, 2 sized 3 by 4 in "red" on game\ndraw text "Hi" at 5, 6 in "white" on game');
  assert.deepEqual(problems(shapes, 'mechanics'), []);
  assert.match(shapes.results.mechanics.text, /fillRect\(1, 2, 3, 4\)[\s\S]*fillText\("Hi", 5, 6\)/);
});

test('pictures: drawing one that was never loaded says how to load it', () => {
  const r = site('add a drawing area called game 320 by 180', '', 'draw rocket at 1, 2 on game');
  assert.deepEqual(problems(r, 'mechanics'), ['`rocket` isn\'t a picture yet. Load it first, near the top: load the picture "images/rocket.png" as rocket.']);
});

test('styles: a plain CSS property with one value too many is pointed out', () => {
  const warns = (styling) => plain(site('add a paragraph "Hi"', styling).results.styling.info.flatMap(i => i.warns));
  assert.deepEqual(warns('style paragraph: text size 24, line-height: 1.1 #000000'),
    ['`line-height` takes one value, and this has 2: `1.1 #000000`. `#000000` looks like a colour: give it its own style after a comma, like "line-height: 1.1, text colour #000000" (or "background #000000").']);
  assert.match(warns('style paragraph: font-weight 700 bold')[0], /If `bold` is another style, separate it with a comma\./);
  // shorthands and calculations take several values, and are left alone
  assert.deepEqual(warns('style paragraph: line-height: 1.5, margin: 0 auto, width: calc(100% - 20px), font-family: "A B", serif, padding 4 8'), []);
});

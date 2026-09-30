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

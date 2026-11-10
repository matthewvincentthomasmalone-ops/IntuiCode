// Websites as people naturally type them: things the languages can't take as written (google.com without
// https://, "royal blue", "50 percent", "1,000", "total price", curly quotes…) become the code they need, with a
// note saying what they became, or a problem that says the fix. Never code that looks fine and is broken.
// Where the readers are involved, both ways: the code reads back as sentences that write it exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadConverter } from './helpers/engine.mjs';

const { convert, WEB } = await loadConverter();
const plain = (x) => JSON.parse(JSON.stringify(x));
const shared = (ids = {}) => ({ ids: Object.fromEntries(Object.entries(ids).map(([k, t]) => [k, { tag: t }])), groups: {}, cssGroups: {}, addGroups: {} });
const all = (r, k) => plain(r.info.flatMap(i => i[k]));
/* Structure sentences -> what goes inside <body>, with the problems and notes */
function body(text) {
  const r = WEB.compileHtml({ id: 'x', file: 'x', text }, shared());
  const lines = r.text.split('\n');
  const a = lines.findIndex(l => /^<body\b/.test(l)), z = lines.lastIndexOf('</body>');
  return { html: lines.slice(a + 1, z).filter(l => l !== '  <script src="script.js"></script>').map(l => l.slice(2)).join('\n'), errs: all(r, 'errs'), warns: all(r, 'warns'), notes: all(r, 'notes') };
}
/* Styling sentences -> CSS, with the problems and notes */
function css(text, ids = {}) {
  const r = WEB.compileCss({ id: 'x', file: 'x', text }, shared(ids));
  return { text: r.text, errs: all(r, 'errs'), warns: all(r, 'warns'), notes: all(r, 'notes') };
}
/* The one declaration a style phrase makes ("width 50 percent" -> "width: 50%") */
const decl = (phrase) => { const r = css(`style group a: ${phrase}`); return { ...r, text: r.text.split('\n').slice(1, -2).map(l => l.trim()).join(' ') }; };
/* Mechanics sentences -> JavaScript, with the problems and notes */
function js(text, ids = {}) {
  const r = WEB.compileJs({ id: 'x', file: 'x', text }, shared(ids));
  return { text: r.text, errs: all(r, 'errs'), warns: all(r, 'warns'), notes: all(r, 'notes') };
}
const page = (b) => `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>T</title>\n</head>\n<body>\n${b}\n</body>\n</html>\n`;
/* Code -> sentences: exact, every line a sentence, and the lines given */
function reads(kind, src, want, extra = {}) {
  const r = convert(kind, kind === 'html' ? page(src) : src, extra);
  assert.equal(r.exact, true, `${r.reason}\n${r.text}`);
  const got = kind === 'html' ? r.text.replace(/^page language is en\npage title is "T"\n/, '') : r.text;
  assert.equal(got.replace(/\n$/, ''), want, got);
  assert.equal(r.kept, 0, r.text);
}

/* ------------------------------------------------------------------ */
/* Structure                                                           */
/* ------------------------------------------------------------------ */

test('structure: an address said the way people write it becomes one a link can use, with a note', () => {
  const link = (to) => body(`add a link to "${to}" saying "Go"`);
  for (const [to, href, why] of [
    ['google.com', 'https://google.com', /Without https:\/\/, the browser would look for a file called `google\.com`/],
    ['www.google.com', 'https://www.google.com', /https:\/\//],
    ['google.com/maps?q=1', 'https://google.com/maps?q=1', /https:\/\//],
    ['example.co.uk', 'https://example.co.uk', /https:\/\//],
    ['localhost:3000', 'http://localhost:3000', /Without http:\/\//],
    ['192.168.0.1', 'http://192.168.0.1', /http:\/\//],
    ['me@example.com', 'mailto:me@example.com', /mailto:/],
    ['+61 400 123 456', 'tel:+61400123456', /tel:/],
    ['0400 123 456', 'tel:0400123456', /tel:/],
    ['my page.html', 'my%20page.html', /%20/],
    ['#main display', '#main-display', /can't have spaces/],
  ]) {
    const b = link(to);
    assert.deepEqual(b.errs, [], to);
    assert.equal(b.html, `<a href="${href}">Go</a>`, to);
    assert.match(b.notes.join(' '), why, to);
  }
  // files, places on the page and addresses with their own start stay as they are, with no note
  for (const to of ['about.html', 'docs/guide.pdf', 'README.md', '/', '/shop', '#top', '?page=2', 'https://x.com', 'mailto:a@b.co', 'javascript:void(0)', '2024-01-01', 'index']) {
    const b = link(to);
    assert.equal(b.html, `<a href="${to}">Go</a>`, to);
    assert.deepEqual(b.notes, [], to);
  }
  // a picture's or a video's file with a space in its name, or on another site
  assert.equal(body('add a picture of "my cat.jpg" described as "A cat"').html, '<img src="my%20cat.jpg" alt="A cat">');
  assert.equal(body('add a picture of "www.example.com/cat.jpg" described as "A cat"').html, '<img src="https://www.example.com/cat.jpg" alt="A cat">');
  assert.equal(body('add a video of "my clip.mp4"').html, '<video src="my%20clip.mp4" controls></video>');
  assert.equal(body('add a picture of "images/cat.png" described as "A cat"').html, '<img src="images/cat.png" alt="A cat">');
  // "linking to" and "from" in the settings after a comma do the same
  assert.equal(body('add a section, linking to "google.com"').html, '<section href="https://google.com"></section>');
  // and the code reads back as it is: the address the sentence would change is said exactly
  reads('html', '<a href="google.com">Google</a>', 'add a link "Google", with href google.com');
  reads('html', '<a href="me@example.com">Mail</a>', 'add a link "Mail", with href me@example.com');
  reads('html', '<a href="https://google.com">Google</a>', 'add a link to "https://google.com" saying "Google"');
  reads('html', '<img src="my cat.jpg" alt="A cat">', 'add a picture, with src "my cat.jpg", described as "A cat"');
  reads('html', '<img src="my%20cat.jpg" alt="A cat">', 'add a picture of "my%20cat.jpg" described as "A cat"');
  reads('html', '<section href="google.com"></section>', 'add a section, with href google.com');
});

test('structure: an address without quotes is taken when it is clearly one; anything else says to quote it', () => {
  assert.deepEqual(body('add a link to google.com saying "Google"'), { html: '<a href="https://google.com">Google</a>', errs: [], warns: [], notes: [body('add a link to "google.com" saying "x"').notes[0]] });
  assert.equal(body('add a link called home to / saying "Home"').html, '<a id="home" href="/">Home</a>');
  assert.equal(body('add a link to google.com\n    add bold text "Google"').html, '<a href="https://google.com"><b>Google</b></a>');
  assert.match(body('add a link to the shop saying "Shop"').errs.join(' '), /Put the address in quotes, like: add a link to "about\.html" saying "Shop"/);
  // the text has to be in quotes too (before, it was left out without a word)
  assert.match(body('add a link to "x.html" saying Google').errs.join(' '), /Put the link text in quotes/);
  assert.match(body('add a link to google.com saying Google').errs.join(' '), /Put the link text in quotes/);
});

test('structure: a group in quotes, and one with spaces, is a group a page can use', () => {
  assert.deepEqual(body('add a block in group "main area"'), { html: '<div class="main-area"></div>', errs: [], warns: [], notes: ['A group can\'t have spaces in a page, so `main area` is `main-area`.', 'In group `main-area` (an HTML class), so styles for that group apply to it.'] });
  assert.equal(body('add a block in group main area').html, '<div class="main-area"></div>');
  assert.equal(body('add a block in groups "a b", c and "D"').html, '<div class="a-b c D"></div>', 'a quoted group with no spaces is kept exactly');
  assert.equal(body('add a paragraph "Hi" in group "main area"').html, '<p class="main-area">Hi</p>');
  assert.equal(body('add a paragraph "Join us in group chat"').html, '<p>Join us in group chat</p>', 'words in the text are text');
  assert.equal(body('add an article "x" in group "news item"').html, '<article class="news-item">x</article>', 'the general way too');
  assert.match(WEB.compileHtml({ id: 'x', file: 'x', text: 'the page is in group "dark mode"' }, shared()).text, /<body class="dark-mode">/);
});

test('curly quotes from phones, Macs and Word count as straight ones, in Structure', () => {
  const curly = 'Curly quotes are taken as straight ones ("), which code needs.';
  for (const [said, html] of [
    ['add a paragraph “Hello there”', '<p>Hello there</p>'],
    ['add a paragraph ‘Hello there’', '<p>Hello there</p>'],
    ['add a paragraph “It’s here”', '<p>It’s here</p>'],
    ['add a paragraph ‘It’s here’', '<p>It’s here</p>'],
    ['add a paragraph “He said "hi"”', '<p>He said "hi"</p>'],
    ['add a button called go saying “Go”', '<button id="go" type="button">Go</button>'],
    ['add a picture of “cat.jpg” described as “A cat”', '<img src="cat.jpg" alt="A cat">'],
    ['add a block, with tooltip “Hi”', '<div title="Hi"></div>'],
    ['“Just text”', 'Just text'],
  ]) {
    const b = body(said);
    assert.deepEqual(b.errs, [], said);
    assert.equal(b.html, html, said);
    assert.ok(b.notes.includes(curly), said);
  }
  // inside straight quotes, and in HTML copied exactly, they are text
  assert.deepEqual(body('add a paragraph "He said “hi”"'), { html: '<p>He said “hi”</p>', errs: [], warns: [], notes: [] });
  assert.equal(body('html: <p class=“x”>“Hello”</p>').html, '<p class=“x”>“Hello”</p>');
  assert.equal(body('add a paragraph "It’s here"').html, '<p>It’s here</p>');
  // a ‹blank› in curly quotes stays visible, as in straight ones
  assert.match(WEB.compileWebsite({ sections: [{ id: 'structure', file: 'structure', text: 'add a paragraph “‹your text›”' }] }).results.structure.text, /<p>‹your text›<\/p>/);
  // and HTML with curly quotes reads back exactly
  reads('html', '<p>“Hello” it’s ‘me’</p>', 'add a paragraph "“Hello” it’s ‘me’"');
  reads('html', '<div data-x="“a”"></div>', 'add a block, storing x "“a”"');
});

/* ------------------------------------------------------------------ */
/* Styling                                                             */
/* ------------------------------------------------------------------ */

test('styling: every colour CSS names, said with or without spaces', () => {
  for (const [said, value] of [['royal blue', 'royalblue'], ['forest green', 'forestgreen'], ['Dark Slate Gray', 'darkslategray'], ['dark grey', 'darkgray'], ['rebeccapurple', 'rebeccapurple'],
    ['papaya whip', 'papayawhip'], ['light goldenrod yellow', 'lightgoldenrodyellow'], ['medium-sea-green', 'mediumseagreen'], ['navy', 'navy']]) {
    const r = decl(`background ${said}`);
    assert.deepEqual(r.errs, [], said);
    assert.equal(r.text, `background: ${value};`, said);
    if (/[\s-]/.test(said)) assert.match(r.notes.join(' '), new RegExp(`CSS colour names are one word, so \`${said}\` is \`${value}\``), said);
  }
  // in every sentence that takes a colour
  assert.equal(css('make save royal blue', { save: 'button' }).text, '#save {\n  color: royalblue;\n}\n');
  assert.equal(css('make the big heading light blue').text, 'h1 {\n  color: lightblue;\n}\n');
  assert.equal(css('set save colour to forest green', { save: 'button' }).text, '#save {\n  color: forestgreen;\n}\n');
  assert.equal(css('give save a royal blue border', { save: 'button' }).text, '#save {\n  border: 1px solid royalblue;\n}\n');
  assert.equal(decl('shadow royal blue').text, 'box-shadow: 0 4px 12px royalblue;');
  // and colour names CSS has read back as they are
  reads('css', '.a {\n  color: royalblue;\n  background: papayawhip;\n}\n', 'style group a: text colour royalblue, background papayawhip', { groups: ['a'] });
});

test('styling: a shade and its colour is the shade; a colour CSS has no name for is a problem that names the nearest', () => {
  // "navy blue": navy is a shade of blue (the choice: say it is navy, with a note, rather than stop)
  const navy = decl('background navy blue');
  assert.deepEqual(navy.errs, []);
  assert.equal(navy.text, 'background: navy;');
  assert.match(navy.notes.join(' '), /CSS has no colour called `navyblue`, so this is `navy`, a shade of blue/);
  assert.equal(decl('text colour crimson red').text, 'color: crimson;');
  assert.equal(css('make save navy blue', { save: 'button' }).text, '#save {\n  color: navy;\n}\n');
  // between two colours, or a light or dark one CSS doesn't have: a problem, with the names it does have
  for (const [said, near] of [['red orange', 'orangered'], ['blue green', 'teal or lightseagreen'], ['light red', 'lightcoral or salmon'], ['lightred', 'lightcoral or salmon'], ['baby blue', 'lightblue or powderblue']]) {
    assert.match(decl(`background ${said}`).errs.join(' '), new RegExp(`I don't know the colour \`${said}\`\\. CSS has ${near}\\.`), said);
  }
  assert.match(decl('background blurple').errs.join(' '), /I don't know the colour `blurple`\. Use a name like navy/);
});

test('styling: a colour code without its #, and rgb without brackets', () => {
  for (const [said, value, why] of [['fff', '#fff', /A colour code starts with #, so `fff` is `#fff`/], ['FFCC00', '#ffcc00', /#ffcc00/], ['1a2b3c', '#1a2b3c', /#/],
    ['rgb 255 0 0', 'rgb(255, 0, 0)', /`rgb 255 0 0` is written `rgb\(255, 0, 0\)`/], ['rgb 255, 0, 0', 'rgb(255, 0, 0)', /rgb\(/], ['rgba 0, 0, 0, 0.5', 'rgba(0, 0, 0, 0.5)', /rgba\(/], ['hsl 200 50% 50%', 'hsl(200, 50%, 50%)', /hsl\(/]]) {
    const r = decl(`background ${said}`);
    assert.deepEqual(r.errs, [], said);
    assert.equal(r.text, `background: ${value};`, said);
    assert.match(r.notes.join(' '), why, said);
  }
  assert.equal(css('style group a: background rgba 0, 0, 0, 0.5, text colour white').text, '.a {\n  background: rgba(0, 0, 0, 0.5);\n  color: white;\n}\n');
  assert.equal(decl('border 2 solid rgb 0 0 0').text, 'border: 2px solid rgb(0, 0, 0);');
  // a word made of the letters a to f isn't taken for a code
  assert.match(decl('background bad').errs.join(' '), /I don't know the colour `bad`\. For a colour code, put # first: `#bad`\./);
});

test('styling: a unit said as a word is its CSS unit, wherever a size goes', () => {
  for (const [said, out] of [
    ['width 50 percent', 'width: 50%;'], ['width 50 per cent', 'width: 50%;'], ['width 50 %', 'width: 50%;'], ['height 100 vh', 'height: 100vh;'],
    ['text size 20 pixels', 'font-size: 20px;'], ['text size 20 px', 'font-size: 20px;'], ['text size 1 pixel', 'font-size: 1px;'], ['text size 2 em', 'font-size: 2em;'], ['text size 1.5 rem', 'font-size: 1.5rem;'], ['text size 12 points', 'font-size: 12pt;'],
    ['space inside 10 pixels', 'padding: 10px;'], ['space inside 10 pixels 20 pixels', 'padding: 10px 20px;'], ['space around 1 em auto', 'margin: 1em auto;'],
    ['rounded corners 8 pixels', 'border-radius: 8px;'], ['gap 1 rem', 'gap: 1rem;'], ['letter spacing 2 pixels', 'letter-spacing: 2px;'], ['line height 20 pixels', 'line-height: 20px;'],
    ['at most 600 pixels wide', 'max-width: 600px;'], ['at least 100 percent tall', 'min-height: 100%;'], ['border 2 pixels dashed red', 'border: 2px dashed red;'],
  ]) {
    const r = decl(said);
    assert.deepEqual(r.errs, [], said);
    assert.equal(r.text, out, said);
    assert.match(r.notes.join(' '), /is written `[^`]+` in CSS/, said);
  }
  assert.equal(css('set save width to 50 percent', { save: 'button' }).text, '#save {\n  width: 50%;\n}\n');
  assert.match(css('on screens narrower than 600 pixels:\n    style group a: hidden').text, /^@media \(max-width: 600px\) \{/);
  // what was already CSS stays as it was
  for (const [said, out] of [['width 50%', 'width: 50%;'], ['text size 20px', 'font-size: 20px;'], ['text size large', 'font-size: large;'], ['line height 1.5', 'line-height: 1.5;'], ['space around 0 auto', 'margin: 0 auto;'], ['width fit-content', 'width: fit-content;'], ['border 2 red', 'border: 2px solid red;']]) {
    const r = decl(said);
    assert.deepEqual(r.errs, [], said);
    assert.equal(r.text, out, said);
    assert.ok(!r.notes.some(n => /is written/.test(n)), said);
  }
  // a word CSS doesn't know is a problem, never a style the browser drops
  assert.match(decl('width 50 apples').errs.join(' '), /`apples` isn't a size CSS knows\. After a number, write px \(pixels\), % \(percent\), em or rem, like 50px\./);
  assert.match(decl('text size big').errs.join(' '), /`big` isn't a text size CSS knows\. Write a number \(20 is 20px\), or small, medium, large or x-large\./);
  assert.match(decl('width full').errs.join(' '), /`full` isn't a size CSS knows\. Write a number \(200 is 200px\), a share like 100% \(of what it's in\), or auto\./);
  // and sizes CSS has read back as they are
  reads('css', '.a {\n  width: 50%;\n  font-size: 1.5rem;\n  padding: 10px 2em;\n  height: 100vh;\n}\n', 'style group a: width 50%, text size 1.5rem, space inside 10 2em, height 100vh', { groups: ['a'] });
  reads('css', '.a {\n  font-size: big;\n}\n', 'style group a: font-size: big', { groups: ['a'] });
});

test('styling: a shared colour\'s name runs up to its colour', () => {
  for (const said of ['add a colour called main blue #4f7cff', 'add a colour called main blue as #4f7cff', 'add a colour main blue is #4f7cff', 'shared colour main blue is #4f7cff']) {
    const r = css(`${said}\nstyle group a: background the colour main blue, text colour the colour main-blue`);
    assert.deepEqual(r.errs, [], said);
    assert.equal(r.text, ':root {\n  --main-blue: #4f7cff;\n}\n\n.a {\n  background: var(--main-blue);\n  color: var(--main-blue);\n}\n', said);
  }
  // the colour is the longest it can be: "accent royal blue" is accent, coloured royal blue
  assert.equal(css('add a colour called accent royal blue').text, ':root {\n  --accent: royalblue;\n}\n');
  assert.equal(css('add a colour called main #4f7cff').text, ':root {\n  --main: #4f7cff;\n}\n');
  reads('css', ':root {\n  --main-blue: #4f7cff;\n}\n\n.a {\n  color: var(--main-blue);\n}\n', 'shared colour main-blue is #4f7cff\n\nstyle group a: text colour the colour main-blue', { groups: ['a'] });
});

test('curly quotes count as straight ones, in Styling', () => {
  assert.equal(decl('font “Open Sans”').text, 'font-family: "Open Sans", sans-serif;');
  assert.equal(css('before group a: content: “→”').text, '.a::before {\n  content: "→";\n}\n');
  assert.equal(css('style “Save”: bold', { save: 'button' }).text, '#save {\n  font-weight: bold;\n}\n');
  assert.equal(css('css: .x::before { content: “a” }').text, '.x::before { content: “a” }\n', 'CSS copied exactly stays exact');
});

/* ------------------------------------------------------------------ */
/* Mechanics                                                           */
/* ------------------------------------------------------------------ */

test('mechanics: JavaScript\'s own words, and words sentences read as values, can\'t be names', () => {
  for (const [said, word] of [['set class to 3', 'class'], ['set new to 3', 'new'], ['constant delete is 3', 'delete'], ['create a list called function', 'function'], ['ask "Name?" and store in default', 'default'],
    ['for each this in [1]\n    show 1', 'this'], ['repeat 3 times counting with new\n    show 1', 'new'], ['define return using x\n    give back x', 'return'], ['define f using class\n    give back 1', 'class'], ['set undefined to 1', 'undefined']]) {
    assert.ok(js(said).errs.includes(`"${word}" is one of JavaScript's own words, so it can't be a name. Try something like "my ${word}" or "${word} value".`), said);
  }
  assert.deepEqual(js('set yes to 3').errs, ['"yes" is a word sentences read as `true`, so as a name it would be read that way instead. Try something like "my yes" or "yes count".']);
  // the page's own names (window.top, document…) can't be made again at the top of a script, but can inside a block
  assert.deepEqual(js('set top to 0').errs, ['`top` is already a name in every web page, so a script can\'t make it again. Try something like "my top" or "top value".']);
  assert.deepEqual(js('when save is clicked\n    set top to 0', { save: 'button' }).errs, []);
  // the suggestions work
  assert.deepEqual(js('set my class to 3\nset top value to 1'), { text: 'let myClass = 3;\nlet topValue = 1;\n', errs: [], warns: [], notes: js('set my class to 3\nset top value to 1').notes });
  // a class's own tools (methods) can have these names, as JavaScript allows
  assert.deepEqual(js('define class Store\n    define delete using key\n        give back key').errs, []);
  // code that makes one is kept as code when it is read
  const r = convert('js', 'const top = 1;\nconsole.log(top);\n');
  assert.equal(r.exact, true, r.reason);
  assert.match(r.text, /^js: const top = 1;$/m);
});

test('mechanics: "1,000" is the number 1000; "1,500" where commas also separate values is asked about', () => {
  for (const [said, code] of [['set total to 1,000', 'let total = 1000;\n'], ['set total to 1,500', 'let total = 1500;\n'], ['set total to 1,000,000.50', 'let total = 1000000.50;\n'],
    ['show 1,000', 'console.log(1000);\n'], ['set xs to [1,000, 2,000]', 'let xs = [1000, 2000];\n'], ['create a list called xs with 1,000, 2,000', 'let xs = [1000, 2000];\n'],
    ['set total to 0\nif total is more than 12,500\n    show "big"', 'let total = 0;\nif (total > 12500) {\n  console.log("big");\n}\n'], ['every 1,000 seconds\n    show 1', 'setInterval(() => {\n  console.log(1);\n}, 1000000);\n']]) {
    const r = js(said);
    assert.deepEqual(r.errs, [], said);
    assert.equal(r.text, code, said);
    assert.match(r.notes.join(' '), /is written `\d+(?:\.\d+)?` in code: a comma there would split it in two/, said);
  }
  // one value, or two? a problem that says how to write each
  assert.deepEqual(js('show 1,500').errs, ['"1,500" could be one number (1500) or two (1, 500). Write 1500 for one, or put a space after the comma.']);
  assert.match(js('create a list called xs with 100,200,300').errs.join(' '), /could be one number \(100200300\) or several \(100, 200, 300\)\. Write 100200300 for one, or put a space after each comma\./);
  assert.match(js('draw a rectangle at 100,200 sized 20 by 20 in "red" on game', { game: 'canvas' }).errs.join(' '), /"100,200" could be one number/);
  // written as values already, or in text, it stays as it is
  const kept = js('show 1, 500\nset xs to [100,200,300]\nshow "1,000"');
  assert.deepEqual(kept.errs, []);
  assert.equal(kept.text, 'console.log(1, 500);\nlet xs = [100,200,300];\nconsole.log("1,000");\n');
  reads('js', 'let total = 1000;\nconsole.log("1,000");\n', 'set total to 1000\nshow "1,000"');
});

test('mechanics: money and percentages are numbers', () => {
  for (const [said, code, why] of [['$5', '5', /`\$5` is the number `5` in code\. Text like "\$5" shows it with its \$\./], ['$5.99', '5.99', /5\.99/], ['€5', '5', /€/], ['£5', '5', /£/], ['$1,500', '1500', /1500/],
    ['50%', '0.5', /`50%` is `0\.5` in code: a share of 1\./], ['12.5%', '0.125', /0\.125/], ['50% plus 1', '0.5 + 1', /0\.5/], ['15% of 200', '0.15 * 200', /`15%` of something is `0\.15` times it\./]]) {
    const r = js(`set x to ${said}`);
    assert.deepEqual(r.errs, [], said);
    assert.equal(r.text, `let x = ${code};\n`, said);
    assert.match(r.notes.join(' '), why, said);
  }
  // "mod" said with %, and text, stay as they are
  assert.equal(js('set x to 7 % 2\nset y to 7%2\nshow "$5 is 50%"').text, 'let x = 7 % 2;\nlet y = 7%2;\nconsole.log("$5 is 50%");\n');
  // × ÷ and − are * / and -
  assert.equal(js('set x to 6 × 2 ÷ 3 − 1').text, 'let x = 6 * 2 / 3 - 1;\n');
  // a number that isn't one is a problem, never code that can't run
  assert.match(js('set price to 5 dollars').errs.join(' '), /"5 dollars" isn't a value: in code, a number can't have a word after it\. Write 5, or put it in quotes for text: "5 dollars"\./);
  assert.match(js('set version to 1.5.2').errs.join(' '), /`1\.5\.2` isn't a number: a number has one decimal point\. For text, put it in quotes: "1\.5\.2"\./);
  reads('js', 'let rate = 0.5;\nlet x = 7 % 2;\n', 'set rate to 0.5\nset x to 7 mod 2');
});

test('mechanics: names of several words, or with dashes, are one camelCase name everywhere in the file', () => {
  const r = js('set total price to 5\nincrease total price by 1\nset high-score to 0\nif total price is more than high score\n    set high score to total price\nshow "Best: {high-score}, total {Total Price}"');
  assert.deepEqual(r.errs, []);
  assert.deepEqual(r.warns, []);
  assert.equal(r.text, 'let totalPrice = 5;\ntotalPrice += 1;\nlet highScore = 0;\nif (totalPrice > highScore) {\n  highScore = totalPrice;\n}\nconsole.log(`Best: ${highScore}, total ${totalPrice}`);\n');
  assert.ok(r.notes.includes('JavaScript names can\'t have spaces, so "total price" is written `totalPrice`.'));
  assert.ok(r.notes.includes('JavaScript names can\'t have dashes (a dash is a minus), so "high-score" is written `highScore`.'));
  // in every place a name is made: constant, list, store in, for each, a tool and its inputs, a timer; "the" left out
  const more = js('constant max speed is 10\ncreate a list called shopping list\nadd "milk" to shopping list\nask "Name?" and store in first name\nfor each high score in [1, 2]\n    show high score\ndefine add item using item name, how much = 1\n    show item name, how much\nrun add item with "x"\nset the score to max speed\nevery 2 seconds as my timer\n    show 1\nstop my timer');
  assert.deepEqual(more.errs, []);
  assert.equal(more.text, 'const maxSpeed = 10;\nlet shoppingList = [];\nshoppingList.push("milk");\nlet firstName = prompt("Name?");\nfor (const highScore of [1, 2]) {\n  console.log(highScore);\n}\nfunction addItem(itemName, howMuch = 1) {\n  console.log(itemName, howMuch);\n}\naddItem("x");\nlet score = maxSpeed;\nlet myTimer = setInterval(() => {\n  console.log(1);\n}, 2000);\nclearInterval(myTimer);\n');
  // words in text stay as they are, and phrases keep working beside a name that starts the same way
  assert.equal(js('set total price to 1\nshow "total price"').text, 'let totalPrice = 1;\nconsole.log("total price");\n');
  assert.equal(js('set new total to 1\nset d to a new Date\nset first name to "A"\nset xs to [1]\nset y to first item of xs').text, 'let newTotal = 1;\nlet d = new Date();\nlet firstName = "A";\nlet xs = [1];\nlet y = xs[0];\n');
  // names that can't be one say why, and what to write
  assert.deepEqual(js('set number of lives to 3').errs, ['"number of lives" can\'t be a name: sentences read "of" as part of a phrase. Say it in one word, like numberOfLives, or in other words.']);
  assert.deepEqual(js('set 2nd place to 5').errs, ['A name can\'t start with a number, so "2nd place" can\'t be one. Put a word before it, like "my 2nd place".']);
  assert.deepEqual(js('set 2nd to 5').errs, ['A name can\'t start with a number, so "2nd" can\'t be one. Put a word before it, like "my 2nd".']);
  assert.match(js('set random number to 5').errs.join(' '), /"random number" starts like the phrase "random number …", so it can't be a name/);
  assert.match(js('set main display to 1', { 'main-display': 'div' }).errs.join(' '), /"main display" is the name of an element in Structure, so a value can't have it too\. To change what it shows: set the text of main display to …/);
  // read back, a camelCase name is said as it is, and writes the same code
  reads('js', 'let totalPrice = 5;\ntotalPrice += 1;\n', 'set totalPrice to 5\nincrease totalPrice by 1');
});

test('curly quotes count as straight ones, in Mechanics', () => {
  const curly = 'Curly quotes are taken as straight ones ("), which code needs.';
  for (const [said, code] of [['show “Hi”', 'console.log("Hi");\n'], ['show ‘Hi’', 'console.log(\'Hi\');\n'], ['show “It’s here”', 'console.log("It’s here");\n'], ['set t to “a” if yes otherwise “b”', 'let t = true ? "a" : "b";\n'],
    ['set the text of out to “Done”', 'document.getElementById("out").textContent = "Done";\n']]) {
    const r = js(said, { out: 'p' });
    assert.deepEqual(r.errs, [], said);
    assert.equal(r.text, code, said);
    assert.ok(r.notes.includes(curly), said);
  }
  // inside straight quotes, in a regular expression, and in exact code, they are kept
  assert.equal(js('show "He said “hi”"\nset r to /[“”]/g\njs: console.log(“x”)').text, 'console.log("He said “hi”");\nlet r = /[“”]/g;\nconsole.log(“x”)\n');
  reads('js', 'console.log("“Hi”", \'it’s\');\nconst r = /[“”]/g;\n', 'show "“Hi”", \'it’s\'\nconstant r is /[“”]/g');
});

test('mechanics: a colour on a drawing area, and an address, are taken as Styling and Structure take them', () => {
  const draw = (c) => js(`fill game with ${c}`, { game: 'canvas' });
  assert.match(draw('royal blue').text, /pen\.fillStyle = "royalblue";/);
  assert.match(draw('fff').text, /pen\.fillStyle = "#fff";/);
  assert.match(draw('gold').text, /pen\.fillStyle = "gold";/);
  assert.match(draw('blurple').errs.join(' '), /I don't know the colour `blurple`/);
  // "go to" and a new link: google.com is https://google.com
  const go = js('go to "google.com"');
  assert.equal(go.text, 'window.location.href = "https://google.com";\n');
  assert.match(go.notes.join(' '), /Without https:\/\//);
  assert.equal(js('go to "about.html"').text, 'window.location.href = "about.html";\n');
  assert.match(js('make a new link to "me@example.com" saying "Mail" and store in a').text, /a\.href = "mailto:me@example\.com";/);
  // read back, an address "go to" would change is said exactly
  reads('js', 'window.location.href = "google.com";\n', 'set window.location.href to "google.com"');
  reads('js', 'window.location.href = "https://google.com";\n', 'go to "https://google.com"');
});

test('mechanics: a value that would be broken code is a problem that says what to write', () => {
  const errs = (said) => js(said).errs;
  // one value where the sentence takes one (ask and "show a message" take several, as prompt and alert do)
  assert.deepEqual(errs('set x to 5,5'), ['"5,5" is two values here, and this takes one. For a decimal, write 5.5; for a list, put it in square brackets: [5, 5].']);
  assert.deepEqual(errs('set x to 1, 2'), ['"1, 2" is two values here, and this takes one. For a list, put them in square brackets: [1, 2].']);
  assert.match(errs('define f\n    give back 1, 2').join(' '), /is two values here/);
  assert.deepEqual(js('ask "Name?", "Ann" and store in name\nshow a message "a", "b"\nset x to the result of Math.max with 1, 2\nset y to x, or 3 if that is nothing').errs, []);
  // a quote mark left open, or an apostrophe outside quotes
  assert.deepEqual(errs('set name to "Bob'), ['A piece of text is missing its closing quote mark (").']);
  assert.match(errs('show it\'s here').join(' '), /Put text in quotes, like "it's": in code, an apostrophe on its own starts a piece of text\./);
  // a size for a style, and a unit or a currency after the number
  assert.deepEqual(errs('set width to 50px'), ['`50px` isn\'t a number in code. A size for a style is text, "50px"; the number is 50 on its own.']);
  assert.deepEqual(js('set width to "50px"\nset n to 0x1f\nset m to 1e3').errs, []);
  assert.equal(js('set price to 5.00 €\nset rate to 10 percent').text, 'let price = 5.00;\nlet rate = 0.1;\n');
});

test('yes, no, true and nothing in any capitals', () => {
  assert.equal(js('set a to Yes\nset b to TRUE\nset c to No\nset d to False\nset e to Nothing').text, 'let a = true;\nlet b = true;\nlet c = false;\nlet d = false;\nlet e = null;\n');
});

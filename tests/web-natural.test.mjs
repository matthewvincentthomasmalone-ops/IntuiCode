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
  assert.match(decl('background bad').errs.join(' '), /I don't know the colour `bad`\. For a colour code, put # first: #bad\./);
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

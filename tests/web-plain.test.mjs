// Websites in plain words: attributes, any element, drawings (SVG), text with things in it, and the
// plainer CSS and JavaScript forms. Each is checked both ways: the sentence writes the code, and the code
// reads back as that sentence, exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConverter } from './helpers/engine.mjs';

const { convert, WEB, C, W } = await loadConverter();
const plain = (x) => JSON.parse(JSON.stringify(x));
const shared = () => ({ ids: {}, groups: {}, cssGroups: {}, addGroups: {} });
/* Structure sentences -> what goes inside <body> (the page's own script left out), and their problems */
function body(text) {
  const r = WEB.compileHtml({ id: 'x', file: 'x', text }, shared());
  const lines = r.text.split('\n');
  const a = lines.findIndex(l => /^<body\b/.test(l)), z = lines.lastIndexOf('</body>');
  return { html: lines.slice(a + 1, z).filter(l => l !== '  <script src="script.js"></script>').map(l => l.slice(2)).join('\n'), errs: plain(r.info.flatMap(i => i.errs)), notes: plain(r.info.flatMap(i => i.notes)) };
}
const page = (b) => `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>T</title>\n</head>\n<body>\n${b}\n</body>\n</html>\n`;
/* Code -> sentences: exact, every line a sentence, and the lines given */
function reads(kind, src, want, extra = {}) {
  const r = convert(kind, kind === 'html' ? page(src) : src, extra);
  assert.equal(r.exact, true, `${r.reason}\n${r.text}`);
  const got = kind === 'html' ? r.text.replace(/^page language is en\npage title is "T"\n/, '') : r.text;
  assert.equal(got.replace(/\n$/, ''), want, got);
  assert.equal(r.kept, 0, r.text);
  return r;
}
/* Both ways: the sentences write the HTML, and the HTML reads back as the sentences */
function both(sentences, html) {
  const b = body(sentences);
  assert.deepEqual(b.errs, [], b.errs.join('\n'));
  assert.equal(b.html, html);
  reads('html', html, sentences);
}

test('structure: screen-reader and other attributes in words, in the order they are written', () => {
  both('add a button called "helpToggle", starts collapsed, controls "helpPanel"\n    "Settings & playing guide"\n    add text "↗", hidden from screen readers',
    '<button id="helpToggle" type="button" aria-expanded="false" aria-controls="helpPanel">\n  Settings &amp; playing guide\n  <span aria-hidden="true">↗</span>\n</button>');
  both('add a section, labelled "Rubychord instrument" for screen readers in group stage', '<section class="stage" aria-label="Rubychord instrument"></section>');
  both('add a navigation bar, labelled by menu-title\n    add a link to "#play" saying "Play", marked as the current page', '<nav aria-labelledby="menu-title">\n  <a href="#play" aria-current="page">Play</a>\n</nav>');
  both('add a button saying "C", storing chord "C", disabled in group key', '<button class="key" type="button" data-chord="C" disabled>C</button>');
  both('add a paragraph called status "Saved", read out when it changes, with role status', '<p id="status" aria-live="polite" role="status">Saved</p>');
  both('add a link to "https://example.com" saying "Help", opening in a new tab, with tooltip "Opens the help"', '<a href="https://example.com" target="_blank" title="Opens the help">Help</a>');
  both('add a picture of "logo.png", sized 320 by 180, loaded lazily, with no description', '<img src="logo.png" width="320" height="180" loading="lazy">');
  both('add a slider called volume from 0 to 100, with value 80', '<input id="volume" type="range" min="0" max="100" value="80">');
  both('add an input called live, of type checkbox, ticked', '<input id="live" type="checkbox" checked>');
  both('add a button saying "Clear", running "clearDone()" when clicked', '<button type="button" onclick="clearDone()">Clear</button>');
  both('add a block called chart, with style "height: 300px", with translate no', '<div id="chart" style="height: 300px" translate="no"></div>');
  // a name in quotes is kept exactly (a plain one becomes an id the usual way)
  assert.match(body('add a block called "mainArea"').html, /^<div id="mainArea"><\/div>$/);
  assert.match(body('add a block called Main Area').html, /^<div id="main-area"><\/div>$/);
});

test('structure: any element, with text, and with other things in it', () => {
  both('add a figure\n    add a picture of "a.png" described as "A"\n    add a caption "The shop, from above."', '<figure>\n  <img src="a.png" alt="A">\n  <figcaption>The shop, from above.</figcaption>\n</figure>');
  both('add a collapsible section\n    add a summary "Shortcuts"\n    add a list\n        add a list item\n            add a key "1"\n            "to"\n            add a key "7"\n            "pick a chord"',
    '<details>\n  <summary>Shortcuts</summary>\n  <ul>\n    <li>\n      <kbd>1</kbd>\n      to\n      <kbd>7</kbd>\n      pick a chord\n    </li>\n  </ul>\n</details>');
  both('add a paragraph\n    "Hold a chord and"\n    add strong text "strum"\n    ".", with no space before it', '<p>\n  Hold a chord and\n  <strong>strum</strong>.\n</p>');
  both('add a table\n    add a table head\n        add a row\n            add a heading cell "Month"\n            add a heading cell "Total"', '<table>\n  <thead>\n    <tr>\n      <th>Month</th>\n      <th>Total</th>\n    </tr>\n  </thead>\n</table>');
  both('add a my-widget element, with size 3', '<my-widget size="3"></my-widget>');
  both('add a drop-down called region\n    add an option "North", with value n\n    add an option "South", with value s', '<select id="region">\n  <option value="n">North</option>\n  <option value="s">South</option>\n</select>');
  // an inline element with things in it stays on one line: a line break inside it would show as a space
  both('add a label\n    "From"\n    add a date box, sent as "from"', '<label>From <input type="date" name="from"></label>');
  both('add a link to "/" in group back\n    "Back to"\n    add bold text "the shop"', '<a class="back" href="/">Back to <b>the shop</b></a>');
});

test('structure: inline things with no space between them are glued, even when the tags are spread over lines', () => {
  const r = reads('html', '<p><a class="back" href="/"\n  >Back</a\n><button\n  id="go"\n  aria-expanded="false"\n>\n  Go\n</button></p>',
    'add a paragraph\n    add a link to "/" saying "Back" in group back\n    add a button called go saying "Go", starts collapsed, with no space before it');
  assert.match(body(r.text.replace(/^page.*\n/gm, '')).html, /<a class="back" href="\/">Back<\/a><button id="go"/);
  // something glued to code that can't be said stays code with it, on one line
  const k = convert('html', page('<p>Hi <b>x</b><script>let a = 1;</script></p>'));
  assert.equal(k.exact, true, k.reason);
  assert.match(k.text, /^    "Hi"\n    html: <b>x<\/b><script>let a = 1;<\/script>$/m);
});

test('structure: drawings (SVG) in words', () => {
  both([
    'add a drawing, drawn on a 1100 by 600 grid, hidden from screen readers in group body-art',
    '    add reusable parts',
    '        add a gradient called "bodyColour" from #873044 through #5b1426 at .4 to #350916 at 1, ending .7 across and 1 down',
    '        add a pattern called grain sized 4 by 4, with patternUnits userSpaceOnUse',
    '            add a circle at 1, 1 with radius .45, filled with #e9a2a0, with opacity .12',
    '    add a rectangle at 20, 20 sized 1060 by 560, with rounded corners 48, filled with the gradient "bodyColour"',
    '    add a set of shapes, outlined in #f3d9b1, outline 2 wide in group strings',
    '        add a line from 80, 200 to 1020, 200',
    '    add a path following "M 100 500 Q 550 420 1000 500", not filled, outlined in #d4a373',
    '    add an ellipse at 50, 50 with radii 20 and 10',
    '    add a polygon through "0,0 10,0 5,8", filled with the pattern grain',
    '    add text "RUBYCHORD" at 550, 560, with text-anchor middle',
  ].join('\n'), [
    '<svg class="body-art" viewBox="0 0 1100 600" aria-hidden="true">',
    '  <defs>',
    '    <linearGradient id="bodyColour" x2=".7" y2="1">',
    '      <stop stop-color="#873044" />',
    '      <stop offset=".4" stop-color="#5b1426" />',
    '      <stop offset="1" stop-color="#350916" />',
    '    </linearGradient>',
    '    <pattern id="grain" width="4" height="4" patternUnits="userSpaceOnUse">',
    '      <circle cx="1" cy="1" r=".45" fill="#e9a2a0" opacity=".12" />',
    '    </pattern>',
    '  </defs>',
    '  <rect x="20" y="20" width="1060" height="560" rx="48" fill="url(#bodyColour)" />',
    '  <g class="strings" stroke="#f3d9b1" stroke-width="2">',
    '    <line x1="80" y1="200" x2="1020" y2="200" />',
    '  </g>',
    '  <path d="M 100 500 Q 550 420 1000 500" fill="none" stroke="#d4a373" />',
    '  <ellipse cx="50" cy="50" rx="20" ry="10" />',
    '  <polygon points="0,0 10,0 5,8" fill="url(#grain)" />',
    '  <text x="550" y="560" text-anchor="middle">RUBYCHORD</text>',
    '</svg>',
  ].join('\n'));
  both('add a drawing sized 20 by 20\n    add a circle at 10, 10 with radius 8, filled with red', '<svg width="20" height="20">\n  <circle cx="10" cy="10" r="8" fill="red" />\n</svg>');
  // stops with more to them are said one by one
  reads('html', '<svg><linearGradient id="g"><stop offset="0" stop-color="red" stop-opacity=".5"/></linearGradient></svg>',
    'add a drawing\n    add a gradient called g\n        add a colour stop, with offset 0, with stop-color red, with stop-opacity .5');
  // shapes only make sense in a drawing
  assert.match(body('add a circle at 1, 1 with radius 2').errs[0], /inside a drawing: write "add a drawing/);
});

test('structure: natural words, and pointing to Styling for how things look', () => {
  assert.equal(body('add a box called amount').html, '<div id="amount"></div>');
  assert.equal(body('add a box called amount with hint "0"').html, '<input id="amount" placeholder="0">');   // with a box setting it is a box to type in
  assert.equal(body('add a text box called amount').html, '<input id="amount">');
  const chart = body('add a data graph called sales 600 by 300');
  assert.equal(chart.html, '<canvas id="sales" width="600" height="300"></canvas>');
  assert.ok(chart.notes.some(n => /chart is drawn on a drawing area/.test(n)));
  assert.match(body('add a border').errs[0], /Styling \(style\.css\), like: style ‹name›: border 2 solid navy/);
  assert.match(body('add a shadow').errs[0], /style ‹name›: shadow/);
  assert.match(body('add a title "Hi"').errs[0], /page title is "…"/);
  // a note goes where its indentation puts it
  assert.equal(body('add a section\n    add a heading "A"\nnote: after\nadd a block').html, '<section>\n  <h2>A</h2>\n</section>\n<!-- after -->\n<div></div>');
});

test('structure: the preview still marks every element with its sentence line', () => {
  const r = WEB.compileWebsite({ sections: [{ id: 'structure', file: 'structure', text: 'add a paragraph\n    "Hi"\n    add bold text "there"\nadd a drawing\n    add a circle at 1, 1 with radius 1' }, { id: 'styling', file: 'styling', text: '' }, { id: 'mechanics', file: 'mechanics', text: '' }] });
  const html = r.results.structure.previewText;
  assert.match(html, /<p data-ic-line="0">/);
  assert.match(html, /<b data-ic-line="2">there<\/b>/);
  assert.match(html, /<circle data-ic-line="4" cx="1"/);
});

test('checker: a character code IntuaCode does not know never counts as the same as its letters', () => {
  const same = (a, b) => C.check('html', page(a), page(b), { parse: W.parse, WEB }).same;
  assert.equal(same('<p>&nearr;</p>', '<p>&amp;nearr;</p>'), false);
  assert.equal(same('<p>&copy 2026</p>', '<p>&amp;copy 2026</p>'), false);
  assert.equal(same('<p title="&hearts;">x</p>', '<p title="&amp;hearts;">x</p>'), false);
  assert.equal(same('<p>&amp; &copy;</p>', '<p>&amp; ©</p>'), true);
  const r = convert('html', page('<p>Up &nearr;</p>'));
  assert.equal(r.exact, true, r.reason);
  assert.match(r.text, /^add a paragraph\n    html: Up &nearr;$/m);   // only the text stays as code
});

test('styling: borders and outlines take a width, a line style and a colour in any order', () => {
  const css = (t) => { const r = WEB.compileCss({ id: 'x', file: 'x', text: t }, shared()); return { text: r.text, errs: plain(r.info.flatMap(i => i.errs)) }; };
  const one = (phrase) => { const r = css(`style group card: ${phrase}`); assert.deepEqual(r.errs, [], phrase); return r.text.split('\n')[1].trim(); };
  assert.equal(one('border 2px dashed navy'), 'border: 2px dashed navy;');
  assert.equal(one('border dashed navy'), 'border: 1px dashed navy;');
  assert.equal(one('border 2px dotted #333'), 'border: 2px dotted #333;');
  assert.equal(one('border navy 3 double'), 'border: 3px double navy;');
  assert.equal(one('border red'), 'border: 1px solid red;');
  assert.equal(one('border 3'), 'border: 3px solid currentColor;');
  assert.equal(one('border none'), 'border: none;');
  assert.equal(one('outline 2 navy'), 'outline: 2px solid navy;');
  assert.equal(one('no outline'), 'outline: none;');
  assert.equal(one('bottom border 1 solid #ccc'), 'border-bottom: 1px solid #ccc;');
  assert.equal(one('border 1 solid rgba(0, 0, 0, 0.5)'), 'border: 1px solid rgba(0, 0, 0, 0.5);');
  // and they read back that way
  reads('css', '.a {\n  border: 2px dashed navy;\n  outline: 2px solid #4af;\n  border-bottom: 1px solid #333;\n}\n', 'style group a: border 2 dashed navy, outline 2 solid #4af, bottom border 1 solid #333', { groups: ['a'] });
});

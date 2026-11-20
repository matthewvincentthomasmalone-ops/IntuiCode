// Predictive Mode (lang/predict.js): the rest of a sentence from sentences written before, as a terminal predicts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/engine.mjs';

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'lang/predict.js'), 'utf8'), ctx, { filename: 'lang/predict.js' });
const P = ctx.IntuiPredict;
const plain = (x) => JSON.parse(JSON.stringify(x));

test('Predict: sentences written before that start with what is typed, most recent first, each once', () => {
  const lines = ['set speed to 5', '    set score to 0', 'show score', 'Set speed to 5', 'set speed to 10'];
  assert.deepEqual(plain(P.history('set s', lines)), ['set speed to 5', 'set score to 0', 'set speed to 10']);
  assert.deepEqual(plain(P.history('set sp', lines, 1)), ['set speed to 5']);
  assert.deepEqual(plain(P.history('SHOW', lines)), ['show score']);
});

test('Predict: what is typed already, notes, code lines and unfilled blanks are never offered', () => {
  const lines = ['show score', 'note: show the score', 'python: show = 1', 'show ‹value›', 'sh'];
  assert.deepEqual(plain(P.history('show score', lines)), []);
  assert.deepEqual(plain(P.history('show', lines)), ['show score']);
  assert.deepEqual(plain(P.history('', lines)), []);
  assert.deepEqual(plain(P.history('note', lines)), []);
  assert.deepEqual(plain(P.history('python', lines)), []);
});

test('Predict: the rest of a prediction carries on from what is typed, spaces and case included', () => {
  assert.equal(P.rest('set ', 'set speed to 5'), 'speed to 5');
  assert.equal(P.rest('Set sp', 'set speed to 5'), 'eed to 5');
  assert.equal(P.rest('set', 'set ‹name› to ‹value›'), ' ‹name› to ‹value›');
  assert.equal(P.rest('show', 'set speed to 5'), '');
  assert.equal(P.rest('set speed to 5', 'set speed to 5'), '');
  assert.equal(P.rest('', 'set speed to 5'), '');
});

test('Predict: the next word of a prediction, a blank counting as one word', () => {
  assert.equal(P.nextWord('speed to 5'), 'speed');
  assert.equal(P.nextWord(' to 5'), ' to');
  assert.equal(P.nextWord(' ‹name› to ‹value›'), ' ‹name›');
  assert.equal(P.nextWord('5'), '5');
});

test('Predict: lines entered are remembered at the front, once, and only whole sentences', () => {
  let h = [];
  h = P.remember(h, 'set speed to 5');
  h = P.remember(h, '    show speed');
  h = P.remember(h, 'Set speed to 5');
  h = P.remember(h, 'note: just a note');
  h = P.remember(h, '');
  assert.deepEqual(plain(h), ['Set speed to 5', 'show speed']);
  assert.equal(P.remember(['a b c', 'd e f', 'g h i'], 'j k l', 2).length, 2);
});

test('Predict: the rest of a sentence once its blanks so far are filled in', () => {
  const para = 'add a paragraph called ‹name› saying "‹text›"';
  assert.equal(P.after('add a paragraph called intro', para), ' saying "‹text›"');
  assert.equal(P.after('add a paragraph called "main description"', para), ' saying "‹text›"');
  assert.equal(P.after('add a paragraph called intro s', para), 'aying "‹text›"');
  assert.equal(P.after('turn pin 13', 'turn pin ‹13› on'), ' on');
  assert.equal(P.after('set score', 'set ‹name› to ‹value›'), ' to ‹value›');
});

test('Predict: nothing when it does not fit, or only a closing quote is left', () => {
  const para = 'add a paragraph called ‹name› saying "‹text›"';
  assert.equal(P.after('add a paragraph called intro saying "Hi"', para), '');
  assert.equal(P.after('add a paragraph called intro saying "Hi', para), '');
  assert.equal(P.after('add a big heading "x"', 'add a heading "‹text›"'), '');
  assert.equal(P.after('add a paragraph', para), '', 'before the first blank, the pattern itself is offered');
});

/* ---------- What comes next (the Help asks it; Predictive Mode guesses it first) ----------
 * Each step is checked against the writers: what it would write translates with no problems. */
import { loadEngine } from './helpers/engine.mjs';
const { L, WEB } = loadEngine();
const fill = (t) => t.replace(/‹([^›]*)›/g, '$1');
const web = (structure, mechanics = '') => WEB.compileWebsite({ sections: [
  { id: 'structure', file: 'structure', text: structure }, { id: 'styling', file: 'styling', text: '' }, { id: 'mechanics', file: 'mechanics', text: mechanics }] }).results;
const py = (text) => L.compileProject({ sections: [{ id: 'main', file: 'main', text }] }).results.main;
const codeAt = (r, i) => (r.info[i].py || []).map(k => r.lines[k].text).join('\n');
/* The steps for line i of a page's Structure, as the app asks for them. */
function htmlSteps(structure, i = 0, extra = {}) {
  const lines = structure.split('\n'), r = web(structure).structure, line = lines[i];
  return P.next({ lang: 'html', code: codeAt(r, i), line, indent: line.match(/^\s*/)[0], last: i === lines.length - 1,
    nextIndent: ((lines[i + 1] || '').match(/^\s*/) || [''])[0], ids: new Set(), has: {}, says: () => false, ...extra });
}
const errsOf = (r) => plain(r.info.flatMap(x => x.errs));
/* A step's Structure afterwards: the line replaced, or the step's lines under it. */
function applied(structure, i, s) {
  const lines = structure.split('\n');
  if (s.how === 'replace') lines.splice(i, 1, s.text);
  else if (s.how === 'after') lines.splice(i + 1, 0, ...s.text.split('\n'));
  return fill(lines.join('\n'));
}
const step = (steps, label) => steps.find(s => s.label === label);

test('Next: a link to another site offers to show the page inside yours, and to open it in a new tab', () => {
  const line = 'add a link to "https://example.com/news" saying "Today\'s news"';
  const steps = htmlSteps(line);
  const embed = step(steps, 'Embed it'), tab = step(steps, 'Open in a new tab');
  assert.equal(embed.text, 'add an embedded page, from "https://example.com/news", sized 600 by 400, with tooltip "Today\'s news"');
  const r = web(applied(line, 0, embed)).structure;
  assert.deepEqual(errsOf(r), []);
  assert.match(r.text, /<iframe src="https:\/\/example\.com\/news" width="600" height="400" title="Today's news"/);
  const r2 = web(applied(line, 0, tab)).structure;
  assert.deepEqual(errsOf(r2), []);
  assert.match(r2.text, /target="_blank"/);
  // a link opening in a new tab already isn't asked again; a link to a part of the page isn't a site
  assert.equal(step(htmlSteps(line + ', opening in a new tab'), 'Open in a new tab'), undefined);
  assert.deepEqual(plain(htmlSteps('add a link to "#menu" saying "Menu"')), []);
});

test('Next: a link to a video shows the video itself; a site that refuses to be shown is only linked', () => {
  const yt = htmlSteps('add a link to "https://www.youtube.com/watch?v=dQw4w9WgXcQ" saying "The song"');
  const show = step(yt, 'Show it on the page');
  assert.equal(show.text, 'add an embedded page, from "https://www.youtube.com/embed/dQw4w9WgXcQ", sized 560 by 315, with tooltip "The song"');
  assert.deepEqual(errsOf(web(show.text).structure), []);
  assert.equal(step(htmlSteps('add a link to "https://github.com/someone" saying "My code"'), 'Embed it'), undefined, 'GitHub refuses to be shown in another page');
});

test('Next: an embedded page that won\'t show says why, with the change that shows it', () => {
  // google.com refuses to be shown in another page (the writer gives "www.google.com" its https://): a link instead
  const g = htmlSteps('add an embedded page from "www.google.com"'), link = step(g, 'Make it a link');
  assert.equal(link.kind, 'tip');
  assert.match(link.ask, /google\.com doesn't let other pages show it/);
  const r = web(link.text).structure;
  assert.deepEqual(errsOf(r), []);
  assert.match(r.text, /<a href="https:\/\/www\.google\.com"/);
  // a YouTube video page: its embed address
  const yt = step(htmlSteps('add an embedded page from "https://youtu.be/dQw4w9WgXcQ", sized 560 by 315'), 'Use the embed address');
  assert.equal(yt.text, 'add an embedded page from "https://www.youtube.com/embed/dQw4w9WgXcQ", sized 560 by 315');
  assert.deepEqual(errsOf(web(yt.text).structure), []);
  // an embed address is left alone
  assert.equal(htmlSteps('add an embedded page from "https://www.youtube.com/embed/dQw4w9WgXcQ", sized 560 by 315, with tooltip "Song"').filter(s => s.kind === 'tip').length, 0);
});

test('Next: an embedded page with no size or tooltip offers them, and both translate', () => {
  const line = 'add an embedded page from "https://example.com"';
  const steps = htmlSteps(line);
  assert.ok(step(steps, 'Make it a link'), 'the advice for a site that may refuse, as a next step');
  for (const label of ['Size it 600 by 400', 'Add a tooltip']) {
    const r = web(applied(line, 0, step(steps, label))).structure;
    assert.deepEqual(errsOf(r), [], label);
  }
  assert.match(web(applied(line, 0, step(steps, 'Size it 600 by 400'))).structure.text, /width="600" height="400"/);
  assert.equal(step(htmlSteps(line + ', sized 600 by 400, with tooltip "News"'), 'Size it 600 by 400'), undefined);
});

test('Next: a picture is described, a text box gets a button, a list its first item, a heading words', () => {
  const pic = 'add a picture of "images/cake.png"', d = step(htmlSteps(pic), 'Add a description');
  const r = web(applied(pic, 0, d)).structure;
  assert.deepEqual(errsOf(r), []);
  assert.deepEqual(plain(r.info[0].warns), [], 'the screen-reader warning goes');
  const box = 'add a text box called email with hint "Your email"', b = step(htmlSteps(box), 'Add a button');
  assert.equal(b.text, 'add a button called go saying "Go"');
  assert.deepEqual(errsOf(web(applied(box, 0, b)).structure), []);
  assert.equal(step(htmlSteps(box, 0, { has: { button: true } }), 'Add a button'), undefined, 'a page with a button already');
  const list = 'add a section called menu\n    add a list called items', item = step(htmlSteps(list, 1), 'Add an item');
  assert.equal(item.text, '        add a list item "‹text›"');
  assert.deepEqual(errsOf(web(applied(list, 1, item)).structure), []);
  assert.equal(step(htmlSteps(list + '\n        add a list item "Bread"', 1), 'Add an item'), undefined, 'it has items');
  const h = 'add a heading "Menu"';
  assert.deepEqual(errsOf(web(applied(h, 0, step(htmlSteps(h), 'Add a paragraph'))).structure), []);
});

test('Next: a drawing area is drawn on every frame, in Mechanics', () => {
  const s = step(htmlSteps('add a drawing area called game 480 by 270'), 'Draw on it');
  assert.equal(s.how, 'file');
  assert.equal(s.role, 'mechanics');
  const r = web('add a drawing area called game 480 by 270', fill(s.text));
  assert.deepEqual(errsOf(r.mechanics), []);
  assert.equal(step(htmlSteps('add a drawing area called game 480 by 270', 0, { says: (role, w) => role === 'mechanics' && w === 'game' }), 'Draw on it'), undefined);
});

test('Next: in Python, an answer is shown back, a number checked, a list gone through, a forever loop waits', () => {
  const steps = (text, i = 0) => {
    const lines = text.split('\n'), r = py(text);
    return P.next({ lang: 'python', code: codeAt(r, i), line: lines[i], indent: lines[i].match(/^\s*/)[0], nextIndent: ((lines[i + 1] || '').match(/^\s*/) || [''])[0] });
  };
  const cases = [
    ['ask "What\'s your name?" and store in name', 'Show it', 'show "You said {name}"'],
    ['ask for a number "How old are you?" and store in age', 'Check it', 'if age is more than ‹10›\n    show "‹That\'s a lot!›"'],
    ['create list fruit with "apple", "pear"', 'Go through it', 'for each item in fruit\n    show item'],
    ['repeat forever', 'Add a wait', '    wait 1 seconds'],
  ];
  for (const [line, label, text] of cases) {
    const s = step(steps(line), label);
    assert.ok(s, `${line}: ${label}`);
    assert.equal(s.text, text);
    const all = fill(line + '\n' + s.text);
    assert.deepEqual(plain(py(all).info.flatMap(x => x.errs)), [], all);
  }
  assert.deepEqual(plain(steps('repeat forever\n    show "hi"')), [], 'the loop has something in it already');
  assert.deepEqual(plain(P.follows({ lang: 'python', code: 'name = input("Name? ")', line: 'ask "Name? " and store in name', indent: '' })), ['show "You said {name}"']);
});

test('Frame: http inside an https page, Google Maps, Vimeo and Spotify', () => {
  assert.equal(P.frame('http://example.com', { secure: true })[0].text, 'https://example.com');
  assert.equal(P.frame('http://example.com', { secure: false }).filter(s => s.label === 'Use https://').length, 0, 'the desktop app shows its pages over http://127.0.0.1');
  assert.match(P.frame('https://www.google.com/maps/place/Sydney')[0].ask, /Share, then Embed a map/);
  assert.equal(P.frame('https://www.google.com/maps/embed?pb=1').filter(s => s.kind === 'tip').length, 0);
  assert.equal(P.embedFor('https://vimeo.com/76979871'), 'https://player.vimeo.com/video/76979871');
  assert.equal(P.embedFor('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'), 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
  assert.deepEqual(plain(P.frame('map.html')), [], 'a page of the project');
  assert.deepEqual(plain(P.frame('pages/map.html')), []);
});

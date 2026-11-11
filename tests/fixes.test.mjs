// Fixes that work (lang/fixes.js): changes to a line with a problem, made from the line itself, each translated
// before it's offered. These run the real writers, the way the app's help strip and Problems do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadEngine, ROOT } from './helpers/engine.mjs';

const E = loadEngine();
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['lang/fixes.js', 'lang/intent.js']) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const FIX = ctx.IntuiFixes, INTENT = ctx.IntuiIntent;
const W = { LANG: { compileProject: E.L.compileProject }, WEB: E.WEB, CPP: E.CPP, TS: E.TS };
const wordsOf = (pats) => [...new Set(pats.flatMap(p => String(p).replace(/‹[^›]*›/g, ' ').toLowerCase().match(/[a-z][a-z'-]*/g) || []))];
const WEB_WORDS = wordsOf([...E.WEB.TEMPLATES.map(t => t.pattern), ...Object.values(E.WEB.WORDS).flat().map(w => (Array.isArray(w) ? w[0] : w))]);
const PY_WORDS = wordsOf(E.L.TEMPLATES.map(t => t.pattern));

/* The fixes for line li of file id, as the app works them out: the line's problems, the language's words, the
   project's names, the closest sentences, and a check that compiles the files with the fix in place. */
function fixesFor(sections, id, li) {
  const sec = sections.find(s => s.id === id), lines = sec.text.split('\n'), isWeb = sec.lang !== 'python';
  const out = E.PRJ.compileAll({ sections, start: sections[0].id }, W);
  const errs = out.results[id].info[li].errs;
  assert.ok(errs.length, `line ${li + 1} should have a problem to fix: ${lines[li]}`);
  const names = [...out.syms].map(([k, v]) => v.display || k).concat(out.web ? Object.keys(out.web.ids) : []);
  const templates = isWeb ? E.WEB.TEMPLATES : E.L.TEMPLATES;
  const patterns = INTENT.match(lines[li], templates, { limit: 6, role: isWeb ? sec.file : null }).filter(x => !x.other).map(x => x.pattern);
  const check = (t) => {
    const copy = lines.slice(), add = t.split('\n');
    copy.splice(li, 1, ...add);
    const r = E.PRJ.compileAll({ sections: sections.map(s => (s.id === id ? { ...s, text: copy.join('\n') } : s)), start: sections[0].id }, W).results[id];
    const infs = r.info.slice(li, li + add.length);
    return { errs: infs.flatMap(i => i.errs), warns: infs.flatMap(i => i.warns) };
  };
  const fixes = FIX.suggest(lines[li], { errs, words: isWeb ? WEB_WORDS : PY_WORDS, values: isWeb ? E.WEB.COLOURS : [], names, patterns, check, budget: 5000 });
  for (const f of fixes) assert.deepEqual(plain(check(f.text).errs), [], `a fix offered must translate with no problems: ${f.text}`);
  return JSON.parse(JSON.stringify(fixes));
}
const web = (structure, styling = '', mechanics = '') => [
  { id: 'structure', file: 'structure', lang: 'html', path: 'index.html', text: structure },
  { id: 'styling', file: 'styling', lang: 'css', path: 'style.css', text: styling },
  { id: 'mechanics', file: 'mechanics', lang: 'js', path: 'script.js', text: mechanics }];
const py = (text) => [{ id: 'main', file: 'main', lang: 'python', path: 'main.py', text }];
const BUY = 'add a button called buy saying "Buy"';
const first = (fixes) => fixes[0] && fixes[0].text;
const plain = (x) => JSON.parse(JSON.stringify(x));

test('Fixes: a word spelled the way the sentences spell it', () => {
  assert.equal(first(fixesFor(web('add a buton called buy'), 'structure', 0)), 'add a button called buy');
  assert.equal(first(fixesFor(web(BUY, 'style buy: backgrond red'), 'styling', 0)), 'style buy: background red');
  assert.equal(first(fixesFor(py('set score to 0\nsett score to 5'), 'main', 1)), 'set score to 5');
  assert.equal(first(fixesFor(py('set score to 0\nadd 1 too score'), 'main', 1)), 'add 1 to score');
  assert.equal(first(fixesFor(py('set score to 0\nif score is biger than 5:\n    show score'), 'main', 1)), 'if score is bigger than 5:');
  // a new name (after "called") is left as it is: only "buton" changes
  const f = fixesFor(web('add a buton called buy'), 'structure', 0);
  assert.ok(f.every(x => /called buy$/.test(x.text)), JSON.stringify(f));
});

test('Fixes: a name the project has, spelled as it is (a two-word name too)', () => {
  assert.equal(first(fixesFor(web(BUY, '', 'when buy is clicked:\n    hide buyy'), 'mechanics', 1)), '    hide buy');
  assert.equal(first(fixesFor(py('set high score to 0\nadd 1 to hihg score'), 'main', 1)), 'add 1 to high score');
});

test('Fixes: what the problem itself suggests, when it is near what was written', () => {
  const f = fixesFor(web(BUY, 'style buy: text colour whit'), 'styling', 0);
  assert.equal(first(f), 'style buy: text colour white');
  assert.match(f[0].why, /as the problem says/);
  assert.equal(first(fixesFor(web(BUY, 'style buy: background abc'), 'styling', 0)), 'style buy: background #abc');
  assert.equal(first(fixesFor(web(BUY, 'style buy: background nice colour #a9a9a9'), 'styling', 0)), 'style buy: background #a9a9a9');
  // a problem's example ("a CSS property like "letter-spacing 2px"") is never put in
  const g = fixesFor(web(BUY, 'style buy: backgrond red'), 'styling', 0);
  assert.ok(g.every(x => !/letter-spacing/.test(x.text)), JSON.stringify(g));
});

test('Fixes: two slips on one line are fixed together', () => {
  const f = fixesFor(web(BUY, 'style buy: background colur red, text colour whit'), 'styling', 0);
  assert.ok(f.some(x => x.text === 'style buy: background colour red, text colour white'), JSON.stringify(f));
});

test('Fixes: "when …, …" becomes the first part with the second inside it, on its own line', () => {
  assert.equal(first(fixesFor(web(BUY, '', 'when buy is clicked, show "hi"'), 'mechanics', 0)), 'when buy is clicked:\n    show "hi"');
  assert.equal(first(fixesFor(web(BUY, '', 'when buy is clickd, show "hi"'), 'mechanics', 0)), 'when buy is clicked:\n    show "hi"');
  assert.equal(first(fixesFor(py('set score to 0\nif score is more than 5, show score'), 'main', 1)), 'if score is more than 5:\n    show score');
});

test('Fixes: the closest sentence, with every value the line has, says what it puts in place of', () => {
  const f = fixesFor(py('make a list called items\nput 5 in items'), 'main', 1);
  assert.equal(first(f), 'add 5 to items');
  assert.match(f[0].why, /in place of "put" and "in"/);
});

test('Fixes: none when no small change works, rather than one that changes what the line says', () => {
  // the heading's colour belongs in Styling: dropping it would lose it, so no fix is offered (the problem says where it goes)
  assert.deepEqual(fixesFor(web('add a big heading "Hi" in colour red'), 'structure', 0), []);
  assert.deepEqual(fixesFor(py('set name to "Bo"\nsay hello to name'), 'main', 1), []);
});

test('Fixes: a fix shows what changed', () => {
  assert.deepEqual(plain(FIX.marks('style buy: backgrond red', 'style buy: background red')).filter(([, n]) => n).map(([s]) => s), ['background']);
  assert.deepEqual(plain(FIX.marks('put 5 in items', 'add 5 to items')).filter(([, n]) => n).map(([s]) => s), ['add', 'to']);
  assert.equal(FIX.marks('a b c', 'a b c').map(([s]) => s).join(''), 'a b c');
  assert.equal(FIX.dist('whit', 'white'), 1);
  assert.equal(FIX.dist('hihg', 'high'), 1);   // two letters swapped count as one
});

test('Fixes: the time and the number of tries are limited', () => {
  let calls = 0;
  const fixes = FIX.suggest('zzzz yyyy xxxx wwww', { check: () => { calls++; return { errs: ['no'] }; }, words: ['zzza', 'yyya', 'xxxa', 'wwwa'], tries: 5 });
  assert.deepEqual(JSON.parse(JSON.stringify(fixes)), []);
  assert.ok(calls <= 5, `tried ${calls} times`);
  let t = 0;
  FIX.suggest('zzzz yyyy', { check: () => ({ errs: ['no'] }), words: ['zzza', 'yyya'], budget: 10, now: () => (t += 20) });
});

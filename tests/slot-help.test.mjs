// The help for a ‹slot› in a sentence shape (lang/values.js blank), for every shape the writers know: every slot
// says what goes there, and every choice offered for it, put in its place, translates no worse than the example.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadEngine, ROOT } from './helpers/engine.mjs';

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'lang/values.js'), 'utf8'), ctx, { filename: 'lang/values.js' });
const V = ctx.IntuiValues;
const { L, WEB, CPP, TS } = loadEngine();
const INDEX = JSON.parse(readFileSync(path.join(ROOT, 'lang/intuicode_index.json'), 'utf8'));

function translate(lang, text) {
  if (lang === 'ts') return TS.compileTs({ id: 'x', file: 'typescript', text }, null, { lang });
  if (lang === 'python') return L.compileProject({ sections: [{ id: 'main', file: 'main', text }] }).results.main;
  if (lang === 'cpp' || lang === 'arduino') {
    const file = lang === 'arduino' ? 'sketch' : 'program';
    return CPP.compileCppProject({ kind: lang === 'arduino' ? 'arduino' : 'cpp', sections: [{ id: file, file, text }] }).results[file];
  }
  const file = { html: 'structure', css: 'styling', js: 'mechanics' }[lang];
  return WEB.compileWebsite({ sections: ['structure', 'styling', 'mechanics'].map(f => ({ id: f, file: f, text: f === file ? text : '' })) }).results[file];
}
const errsOf = (lang, text) => translate(lang, text).info.flatMap(inf => inf.errs);
const fill = (s) => s.replace(/‹([^›]*)›/g, '$1');
// a shape inside a drawing is checked inside one
const DRAWING = 'add a drawing sized 100 by 100, drawn on a 100 by 100 grid\n';
const placed = (lang, s, topic) => (lang === 'html' && topic === 'Drawings' && !/^add a drawing\b/.test(s) ? DRAWING + s.split('\n').map(l => '    ' + l).join('\n') : s);

const shapes = [];
for (const L0 of INDEX.languages) for (const s of L0.sentences || []) if (/‹/.test(s.say)) shapes.push({ lang: L0.id, say: s.say, topic: s.topic });

test('slot help: there are sentence shapes with slots in every language', () => {
  for (const lang of ['python', 'html', 'css', 'js', 'ts', 'cpp', 'arduino']) assert.ok(shapes.some(s => s.lang === lang), lang);
});

test('slot help: every slot in every sentence shape says what goes there', () => {
  const missing = [];
  for (const { lang, say } of shapes) {
    for (const line of say.split('\n')) for (const slot of new Set(line.match(/‹[^›]*›/g) || [])) {
      const b = V.blank(line, slot, lang);
      if (!b || !b.title || !b.about) missing.push(`${lang}: ${slot} in ${line}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('slot help: every choice offered for a slot translates no worse than the example', () => {
  const worse = [];
  for (const { lang, say, topic } of shapes) {
    const lines = say.split('\n');
    lines.forEach((line, li) => {
      for (const slot of new Set(line.match(/‹[^›]*›/g) || [])) {
        const b = V.blank(line, slot, lang);
        if (!b) continue;
        const base = errsOf(lang, placed(lang, fill(say), topic)).length;
        for (const o of b.options) {
          const mine = lines.map((l, k) => (k === li ? l.split(slot).join(o.text) : l)).join('\n');
          const got = errsOf(lang, placed(lang, fill(mine), topic));
          if (got.length > base) worse.push(`${lang}: ${slot} → ${o.text} in "${line}": ${got.join(' / ')}`);
        }
      }
    });
  }
  assert.deepEqual(worse, []);
});

test('slot help: a path\'s shape is explained in plain words, with shapes that fit the drawing\'s grid', () => {
  const line = 'add a path following "‹M 0 0 L 100 50›", not filled, outlined in ‹navy›';
  const b = V.blank(line, '‹M 0 0 L 100 50›', 'html');
  assert.equal(b.title, 'The shape the line follows');
  assert.match(b.about, /M x y/);
  assert.ok(b.options.some(o => o.label === 'a triangle'));
  const wide = V.blank(line, '‹M 0 0 L 100 50›', 'html', { grid: [200, 100] });
  assert.equal(wide.options.find(o => o.label === 'a triangle').text, 'M 20 90 L 100 10 L 180 90 Z');
  assert.match(wide.about, /200 across and 100 down/);
  const colour = V.blank(line, '‹navy›', 'html');
  assert.equal(colour.title, 'Outline colour');
  assert.ok(colour.colour && colour.options.length > 8 && colour.options.every(o => o.swatch));
});

test('slot help: numbers and colours are explained as Drop down explains them where they are', () => {
  assert.equal(V.blank('wait ‹number› seconds', '‹number›', 'python').title, 'Seconds to wait');
  assert.equal(V.blank('repeat ‹number› times', '‹number›', 'python').title, 'Times to repeat');
  assert.equal(V.blank('add a circle at ‹50›, ‹50› with radius ‹40›, filled with ‹gold›', '‹40›', 'html').title, 'Radius');
  assert.equal(V.blank('add a circle at ‹50›, ‹50› with radius ‹40›, filled with ‹gold›', '‹gold›', 'html').title, 'Fill colour');
  assert.equal(V.blank('add a drawing sized ‹200› by ‹100›, drawn on a ‹200› by ‹100› grid', '‹200›', 'html').title, 'Width on the page');
  assert.equal(V.blank('style ‹name›: background ‹colour›, text colour ‹colour›', '‹colour›', 'css').title, 'Background colour');
  // Drop down itself now knows a drawing's colours and positions in Structure
  const line = 'add a circle at 50, 50 with radius 40, filled with gold';
  const vs = V.scan(line, 'html');
  assert.deepEqual(JSON.parse(JSON.stringify(vs.map(v => v.text))), ['50', '50', '40', 'gold']);
  assert.equal(V.explain(line, vs[0], 'html').title, 'Centre across (x)');
});

test('slot help: names come from the project, and a name being made is the writer\'s to choose', () => {
  const have = { names: [{ name: 'score', kind: 'number' }, { name: 'greet', kind: 'function' }, { name: 'game', kind: 'element' }] };
  const value = V.blank('set ‹name› to ‹value›', '‹value›', 'python', have);
  assert.ok(value.options.some(o => o.text === 'score'));
  assert.ok(!value.options.some(o => o.text === 'greet'));   // a tool isn't a value
  assert.equal(V.blank('if ‹condition›', '‹condition›', 'python', have).options[0].text, 'score is more than 0');
  assert.deepEqual(JSON.parse(JSON.stringify(V.blank('when ‹game› is clicked', '‹game›', 'js', have).options.map(o => o.text))), ['game']);
  const made = V.blank('add a drawing area called ‹game› ‹480› by ‹270›', '‹game›', 'html', have);
  assert.equal(made.title, 'A name you choose');
  const pic = V.blank('add a picture of "‹file.jpg›" described as "‹what it shows›"', '‹file.jpg›', 'html', { files: ['pictures/rat.webp', 'notes.txt'] });
  assert.deepEqual(JSON.parse(JSON.stringify(pic.options.map(o => o.text))), ['pictures/rat.webp']);
});

test('slot help: a shape with an unfinished setting says which, not that it needs a drawing', () => {
  const inDrawing = (shape) => [...errsOf('html', DRAWING + '    ' + shape)];
  assert.deepEqual(inDrawing('add a path following "M 0 0 L 100 50", not filled, outlined in'), ['"outlined in" needs a colour after it: outlined in navy, or outlined in #1a2b3c.']);
  assert.deepEqual(inDrawing('add a circle at 5, 5 with radius 3, filled with'), ['"filled with" needs a colour after it: filled with navy, or filled with #1a2b3c.']);
  assert.match(inDrawing('add a circle at 5, 5 with radius 3, wobbly')[0], /I don't understand "wobbly" here/);
  assert.deepEqual(inDrawing('add a path following "M 0 0 L 100 50", not filled, outlined in navy'), []);
  // outside a drawing it still says to put it in one
  assert.match(errsOf('html', 'add a path following "M 0 0 L 100 50", outlined in')[0], /inside a drawing/);
});

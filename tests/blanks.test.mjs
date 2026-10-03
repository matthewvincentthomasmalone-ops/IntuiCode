// ‹Blanks› in hallway steps say clearly what goes there: a short label in the sentence, and a "blank:" line
// with what kind of thing it is, how to work it out, and an answer that works (which the kit tests fill in).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBuilder, loadEngine } from './helpers/engine.mjs';

const B = loadBuilder();
const { L, WEB, CPP } = loadEngine();
const lib = B.library;
const KINDS = ['a number', 'a calculation', 'a test (true or false)', 'text in quotes', 'a name', 'a list', 'a colour', 'a CSS value', 'a line of code'];
const sentenceSlots = (c) => [...new Set(Object.values(c.sections).flat()
  .filter(l => !/^\s*(?:note|comment|teach)\s*:/i.test(l))
  .flatMap(l => l.match(/‹[^›]*›/g) || []))];

test('blank: lines are read: label, kind, how to work it out, and an answer (which may hold |)', () => {
  const { blanks } = B.parseEntry('component: x\nname: X\ndepth: hallway\nsummary: s\nblank: ‹either one› | a test (true or false) | Join the two with or. | a || b\n== main\nif ‹either one›\n    show "yes"');
  assert.deepEqual(JSON.parse(JSON.stringify(blanks)), [{ slot: '‹either one›', kind: 'a test (true or false)', hint: 'Join the two with or.', example: 'a || b' }]);
});

test('a blank: line about a ‹blank› the step doesn\'t have, or with no answer, is a problem', () => {
  const head = 'component: x\nname: X\ndepth: hallway\nsummary: s\n';
  const problems = (blank) => [...B.describeEntry(`${head}${blank}\n== main\nset speed to ‹how fast it goes›`).problems];
  assert.deepEqual(problems('blank: ‹how fast it goes› | a number | Pixels a frame. | 4'), []);
  assert.match(problems('blank: ‹how far› | a number | Pixels. | 4')[0], /isn't in the sentences/);
  assert.match(problems('blank: ‹how fast it goes› | a number | Pixels a frame.')[0], /needs an answer that works/);
  assert.match(problems('blank: how fast | a number | x | 4')[0], /starts with the ‹blank›/);
});

test('every ‹blank› in the library says what goes there, clearly', () => {
  const issues = [];
  for (const c of Object.values(lib.components)) {
    if (c.depth !== 'hallway') continue;
    const said = new Map((c.blanks || []).map(b => [b.slot, b]));
    for (const slot of sentenceSlots(c)) {
      const b = said.get(slot), where = `${c.id} ${slot}`;
      if (!b) { issues.push(`${where}: no "blank:" line`); continue; }
      if (slot.length > 52) issues.push(`${where}: the label is long (${slot.length}); say what goes there in a few words`);
      if (/…|\.\.\./.test(slot)) issues.push(`${where}: the label trails off`);
      if (/:/.test(slot) || slot.includes(b.example)) issues.push(`${where}: the label gives the answer`);
      if (!KINDS.includes(b.kind)) issues.push(`${where}: kind "${b.kind}" isn't one of ${KINDS.join(', ')}`);
      if (b.hint.length < 20) issues.push(`${where}: "how to work it out" is missing or too short`);
      if (/!|\b(?:just|simply|easy|easily|obviously)\b/i.test(b.hint)) issues.push(`${where}: the hint talks down ("${b.hint}")`);
      if (!b.example) issues.push(`${where}: no answer`);
    }
  }
  assert.deepEqual(issues, []);
});

test('half a ‹blank› left behind (its words deleted, a mark kept) is left out of the code, and the line says to delete it', () => {
  const said = (info) => JSON.parse(JSON.stringify(info.map(i => [i.errs.length, i.warns.filter(w => /left over from a ‹blank›/.test(w)).length])));
  const py = L.compileProject({ sections: [{ id: 'main', file: 'main', text: 'set short hop to -4›\nset x to ‹ 2\nshow "a › in text"\nset y to ‹a number›' }] }).results.main;
  assert.deepEqual([...py.lines.map(l => l.text)], ['short_hop = -4', 'x = 2', 'print("a › in text")', 'y = _']);
  assert.deepEqual(said(py.info), [[0, 1], [0, 1], [0, 0], [1, 0]]);
  const web = WEB.compileWebsite({ sections: [{ id: 'structure', file: 'structure', text: 'add a paragraph "Hi ›"' }, { id: 'styling', file: 'styling', text: '' },
    { id: 'mechanics', file: 'mechanics', text: 'set shortHop to -4›\nset jumps to ‹how many jumps› plus 1›' }] }).results;
  assert.match(web.mechanics.text, /^let shortHop = -4;\nlet jumps = _ \+ 1;/);
  assert.deepEqual(said(web.mechanics.info), [[0, 1], [1, 0]]);   // a line with a ‹blank› to fill says that first
  assert.match(web.structure.text, /<p>Hi ›<\/p>/);
  const cpp = CPP.compileCppProject({ kind: 'cpp', sections: [{ id: 'program', file: 'program', text: 'set x to 4›' }] }).results.program;
  assert.match(cpp.text, /x = 4;/);
  assert.deepEqual(said(cpp.info), [[0, 1]]);
});

test('two steps never use the same ‹blank› to mean different things (the help finds a ‹blank› by its words)', () => {
  const seen = new Map(), clashes = [];
  for (const c of Object.values(lib.components)) for (const b of c.blanks || []) {
    const was = seen.get(b.slot);
    if (was && (was.example !== b.example || was.hint !== b.hint)) clashes.push(`${b.slot}: ${was.id} and ${c.id}`);
    else seen.set(b.slot, { ...b, id: c.id });
  }
  assert.deepEqual(clashes, []);
});

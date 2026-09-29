import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from './helpers/engine.mjs';

const { L, BP, WEB, CPP } = loadEngine();

for (const src of BP.BUILT_IN) {
  const bp = BP.parse(src);
  test(`blueprint parses: ${bp.title}`, () => assert.deepEqual([...bp.errors], []));
  const combos = [{}];
  for (const f of bp.fields.filter(f => f.choices)) {
    const next = [];
    for (const c of combos) for (const v of f.choices) next.push({ ...c, [f.name]: v });
    combos.splice(0, combos.length, ...next);
  }
  for (const values of combos) {
    test(`blueprint builds cleanly: ${bp.title} ${JSON.stringify(values)}`, () => {
      const filled = BP.fill(bp, values);
      const sections = bp.kind === 'snippet'
        ? [{ id: 'main', file: 'main', text: filled.here }]
        : bp.layout === 'cpp' ? [{ id: 'program', file: 'program', text: filled.program }]
        : Object.keys(filled).map(k => ({ id: k, file: k, text: filled[k] }));
      const res = bp.layout === 'website' ? WEB.compileWebsite({ sections }) : bp.layout === 'cpp' ? CPP.compileCppProject({ sections }) : L.compileProject({ sections });
      const problems = sections.flatMap(s => res.results[s.id].info.flatMap(i => i.errs.concat(i.warns)));
      assert.deepEqual(JSON.parse(JSON.stringify(problems)), []);
    });
  }
}

test('reserved blank names are rejected', () => {
  assert.ok(BP.parse('title: x\nkind: snippet\nstory:\n[end: 1]\n== here\nshow [end]\n').errors.length > 0);
});

test('blanks inside quotes go in without extra quotes', () => {
  const bp = BP.parse('title: x\nkind: snippet\nstory:\nSay [word: "hi"]\n== here\nshow "I say [word]"\nshow [word]\n');
  assert.equal(BP.fill(bp, {}).here, 'show "I say hi"\nshow "hi"\n');
});

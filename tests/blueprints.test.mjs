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
        : bp.layout === 'arduino' ? [{ id: 'sketch', file: 'sketch', text: filled.sketch }]
        : Object.keys(filled).map(k => ({ id: k, file: k, text: filled[k] }));
      const res = bp.layout === 'website' ? WEB.compileWebsite({ sections }) : bp.layout === 'cpp' ? CPP.compileCppProject({ sections }) : bp.layout === 'arduino' ? CPP.compileCppProject({ kind: 'arduino', sections }) : L.compileProject({ sections });
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

test('what people type in a blank stays exactly their text: quotes, backslashes and braces', () => {
  const typed = 'He said "hi" \\o/ {name}';
  const bp = BP.parse('title: x\nkind: snippet\nstory:\nSay [word: "hi"]\n== here\nset name to "Sam"\nshow "I say [word]"\nshow [word]\nshow "{name}: [word]"\n');
  const filled = BP.fill(bp, { word: typed }).here;
  assert.equal(filled, 'set name to "Sam"\nshow "I say He said \\"hi\\" \\\\o/ {{name}}"\nshow "He said \\"hi\\" \\\\o/ {{name}}"\nshow "{name}: He said \\"hi\\" \\\\o/ {{name}}"\n');
  const r = L.compileProject({ sections: [{ id: 'main', file: 'main', text: filled }] }).results.main;
  assert.deepEqual(JSON.parse(JSON.stringify(r.info.flatMap(i => i.errs))), []);
  assert.match(r.text, /^print\("I say He said \\"hi\\" \\\\o\/ \{name\}"\)\nprint\("He said \\"hi\\" \\\\o\/ \{name\}"\)\nprint\(f"\{name\}: He said \\"hi\\" \\\\o\/ \{\{name\}\}"\)$/m);
  // a website's Structure has no {values}: braces stay single there, and the page shows the text as typed
  const web = BP.parse('title: w\nkind: project\nlayout: website\nstory:\nA page for [name: "Shop"]\n== structure\npage title is [name]\nadd a big heading [name]\n== mechanics\nshow [name]\n');
  const f = BP.fill(web, { name: typed });
  const site = WEB.compileWebsite({ sections: ['structure', 'styling', 'mechanics'].map(s => ({ id: s, file: s, text: f[s] || '' })) });
  assert.match(site.results.structure.text, /<title>He said "hi" \\o\/ \{name\}<\/title>/);
  assert.match(site.results.structure.text, /<h1>He said "hi" \\o\/ \{name\}<\/h1>/);
  assert.match(site.results.mechanics.text, /console\.log\("He said \\"hi\\" \\\\o\/ \{name\}"\);/);
  const cpp = CPP.compileCppProject({ sections: [{ id: 'p', file: 'program', text: `show "${'x {{y}}'}"` }] }).results.p.text;
  assert.match(cpp, /std::cout << "x \{y\}" << std::endl;/);
});

// INTENT.md (lang/promises.js): promises in plain sentences, each checked against the project's real code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/engine.mjs';

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['lang/parts.js', 'lang/promises.js']) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const PR = ctx.IntuiPromises;
const plain = (x) => JSON.parse(JSON.stringify(x));

const file = (p, lang, code, extra = {}) => ({ path: p, lang, write: extra.write || 'code', text: extra.text != null ? extra.text : code, code, errs: extra.errs || [] });
const APP = [
  'import { useState } from "react";',
  '',
  'export default function App() {',
  '  const [n, setN] = useState(0);',
  '  return <button id="save" onClick={handleSave}>{n}</button>;',
  '}',
  '',
  'const handleSave = async () => {',
  '  await fetch("/api/save");',
  '};',
  '',
].join('\n');
const SUPA = 'import { createClient } from "@supabase/supabase-js";\nexport const supabase = createClient(URL, "service_role-key");\n';
const SQL = 'create table notes (id int);\nalter table notes enable row level security;\ncreate table public.secrets (id int);\n';
const FACTS = {
  files: [
    file('src/App.tsx', 'tsx', APP, { write: 'sentences' }),
    file('src/lib/supabase.ts', 'ts', SUPA, { write: 'sentences' }),
    file('supabase/migrations/1.sql', 'sql', SQL),
    file('README.md', 'markdown', 'Never put the service_role key in the app.\n', { write: 'text' }),
    file('INTENT.md', 'markdown', '- no file mentions "service_role"\n', { write: 'text' }),
  ],
};
const one = (line, facts = FACTS) => plain(PR.check('- ' + line, facts)[0]);

test('INTENT.md: bullets are promises, other lines are notes, and "## Step n" headings group them', () => {
  const r = plain(PR.parse([
    '# Intent',
    'What this project must keep doing.',
    '- no file mentions "service_role".',
    '* there’s a button called save',
    '```',
    '- not a promise: inside a fence',
    '```',
    '## Step 2 · Page basics',
    '- every ‹blank› is filled in',
    '## Notes',
    '- the sky is green',
    '- every blank is filled in',
  ].join('\n')));
  assert.deepEqual(r.steps, [{ n: 2, name: 'Page basics', li: 7 }]);
  assert.deepEqual(r.items.map(i => [i.li, i.text, i.step, i.p && i.p.kind]), [
    [2, 'no file mentions "service_role"', null, 'mentions'],
    [3, 'there\'s a button called save', null, 'thing'],
    [8, 'every ‹blank› is filled in', 2, 'blanks'],
    [10, 'the sky is green', null, null],
    [11, 'every blank is filled in', null, 'blanks'],
  ]);
  assert.match(r.items[3].error, /^Promises look like `src\/api\.ts mentions/);
  assert.match(r.items[4].error, /put it under a "## Step n" heading/);
  assert.ok(PR.isIntentPath('INTENT.md') && PR.isIntentPath('intent.md') && !PR.isIntentPath('docs/INTENT.md'));
});

test('mentions: searched in the code, never in INTENT.md itself or in notes', () => {
  const r = one('no file mentions "service_role"');
  assert.equal(r.ok, false);
  assert.deepEqual(r.where, [{ path: 'src/lib/supabase.ts', line: 1, space: 'code' }]);
  assert.match(r.why, /src\/lib\/supabase\.ts line 2/);
  assert.equal(one('no file mentions "eval("').ok, true);
  assert.equal(one('src/ doesn\'t mention "console.log"').ok, true);
  assert.equal(one('src/App.tsx mentions "/api/save"').ok, true);
  assert.equal(one('handleSave mentions "/api/save"').ok, true, 'a part by its name');
  assert.equal(one('App mentions "/api/save"').ok, false, 'only the part\'s own lines');
  assert.equal(one('src/Nope.tsx mentions "x"').ok, false);
  assert.match(one('src/Nope.tsx mentions "x"').why, /no file called/);
});

test('what the code defines, by name, in each language', () => {
  const names = (lang, code, p) => plain(PR.definitions(lang, code, p).map(d => [d.name, d.kind, d.from, d.to]));
  assert.deepEqual(names('python', 'import os\n\ndef save(x):\n    return x\n\nclass Shop:\n    def buy(self):\n        pass\n', 'main.py'),
    [['save', 'fn', 2, 3], ['Shop', 'class', 5, 7], ['buy', 'fn', 6, 7]]);
  assert.deepEqual(names('tsx', APP, 'src/App.tsx'), [['App', 'component', 2, 5], ['handleSave', 'fn', 7, 9], ['save', 'el', 4, 4]]);
  assert.deepEqual(names('cpp', '#include <iostream>\nint add(int a, int b) {\n  if (a) { return a; }\n  return a + b;\n}\nint main() {\n  return 0;\n}\n', 'main.cpp'),
    [['add', 'fn', 1, 4], ['main', 'fn', 5, 7]]);
  assert.deepEqual(names('css', '#save {\n  color: red;\n}\n.card, h1 { padding: 2px; }\n', 'style.css'),
    [['#save', 'rule', 0, 2], ['.card', 'rule', 3, 3], ['h1', 'rule', 3, 3]]);
  assert.deepEqual(names('sql', SQL, 'x.sql'), [['notes', 'table', 0, 0], ['secrets', 'table', 2, 2]]);
  assert.deepEqual(names('js', 'function go() {\n  const s = "}";\n  // }\n  return s;\n}\n', 'a.js'), [['go', 'fn', 0, 4]], 'braces in strings and comments don\'t count');
});

test('there is a … called …: the kind counts, and the closest name is offered', () => {
  assert.equal(one('there is a button called save').ok, true);
  assert.equal(one('there is a component called App').ok, true);
  assert.equal(one('there is a function called handleSave').ok, true);
  assert.equal(one('there is a table called secrets').ok, true);
  const page = { files: [file('index.html', 'html', '<ul id="items"><li>Bread</li></ul>\n<p id="intro">Hi</p>\n')] };
  assert.equal(one('there is a list called items', page).ok, true);
  assert.equal(one('there is a paragraph called intro', page).ok, true);
  assert.equal(one('there is a list called intro', page).ok, false);
  const wrongKind = one('there is a heading called save');
  assert.equal(wrongKind.ok, false);
  assert.match(wrongKind.why, /isn't a heading \(it's a <button>\)/);
  const typo = one('there is a function called handleSve');
  assert.equal(typo.ok, false);
  assert.match(typo.why, /closest is `handleSave`/);
  assert.equal(one('src/App.tsx exists').ok, true);
  assert.equal(one('there is a folder called supabase').ok, true);
  assert.match(one('there is a gizmo called x').why, /doesn't know "gizmo"/);
  assert.equal(one('there is a gizmo called x').ok, null);
});

test('has no problems: from the problems IntuaCode lists, by file; code it only reads can\'t be told', () => {
  const facts = { files: [file('main.py', 'python', 'x = 1\n', { write: 'sentences', text: 'set x to 1\nshow y\n', errs: [1] }), file('lib.rs', 'rust', 'fn main() {}\n')] };
  const r = one('main.py has no problems', facts);
  assert.equal(r.ok, false);
  assert.deepEqual(r.where, [{ path: 'main.py', line: 1, space: 'text' }]);
  assert.equal(one('nothing has problems', facts).ok, false);
  assert.equal(one('lib.rs has no problems', facts).ok, null);
  assert.equal(one('src/App.tsx has no problems').ok, true);
});

test('every table has row-level security: each create table needs its alter table … enable', () => {
  const r = one('every table has row-level security');
  assert.equal(r.ok, false);
  assert.match(r.why, /`secrets` has no row-level security/);
  assert.deepEqual(r.where, [{ path: 'supabase/migrations/1.sql', line: 2, space: 'code' }]);
  const fixed = { files: [file('a.sql', 'sql', SQL + 'alter table public.secrets enable row level security;\n')] };
  assert.equal(one('every table has row-level security', fixed).ok, true);
  assert.equal(one('every table has row-level security', { files: [] }).ok, null, 'no tables in the code: can\'t be told, not "kept"');
});

test('is mine: names one part (or file), whose code is given for the app to keep', () => {
  const r = one('handleSave in src/App.tsx is mine');
  assert.equal(r.ok, true);
  assert.deepEqual(r.mine, { path: 'src/App.tsx', name: 'handleSave', code: 'const handleSave = async () => {\n  await fetch("/api/save");\n};', from: 7, to: 9 });
  assert.equal(one('src/lib/supabase.ts is mine').mine.code, SUPA);
  const two = { files: [file('a.py', 'python', 'def save():\n    pass\n'), file('b.py', 'python', 'def save():\n    pass\n')] };
  assert.match(one('save is mine', two).why, /`save` is in `a.py` and `b.py`: say which/);
  assert.equal(one('save in b.py is mine', two).ok, true);
  assert.match(one('gone in src/App.tsx is mine').why, /no part called `gone`/);
  assert.match(plain(PR.parse('- src/ is mine').items[0]).error, /names one part or one file/);
});

test('steps: their sentences start at the "── Step n" note; IntuaCode adds checks by depth', () => {
  const text = [
    'note: ── Step 1 · Page basics (Walk) ──',
    'add a heading saying "Hi"',
    'note: ── Step 2 · The form (Hallway) ──',
    'add a button called ‹what it does›',
    'add a paragraph saying "x"',
  ].join('\n');
  const facts = { files: [file('index.html', 'html', '<h1>Hi</h1>\n', { write: 'sentences', text, errs: [3] }), file('INTENT.md', 'markdown', '', { write: 'text' })] };
  assert.deepEqual(plain(PR.stepRegions(text)), [{ n: 1, from: 0, to: 1 }, { n: 2, from: 2, to: 4 }]);
  const steps = [{ n: 1, depth: 'walk' }, { n: 2, depth: 'hallway' }, { n: 3, depth: 'horizon' }];
  const intent = '## Step 1\n- there is a heading called title\n## Step 3\n- index.html exists\n';
  const results = PR.check(intent, facts);
  const map = PR.stepChecks(steps, results, facts);
  const s1 = plain(map.get(1));
  assert.deepEqual(s1.checks.map(c => [c.text, c.auto, c.ok]), [['its sentences have no problems', true, true], ['there is a heading called title', false, false]]);
  assert.equal(s1.state, 'some');
  const s2 = plain(map.get(2));
  assert.deepEqual(s2.checks.map(c => [c.text, c.ok]), [['every ‹blank› is filled in', false], ['its sentences have no problems', false]]);
  assert.equal(s2.state, 'none');
  assert.equal(plain(map.get(3)).state, 'all', 'a horizon step has only its own checks');
});

test('outside every step: display and mechanics parts the plan doesn\'t cover', () => {
  const text = 'set x to 1\n\nnote: ── Step 1 · Start (Walk) ──\nshow "hi"\n';
  const facts = { files: [
    file('main.py', 'python', '', { write: 'sentences', text }),
    file('extra.py', 'python', 'def surprise():\n    print("added by an AI")\n'),
    file('notes.md', 'markdown', '# x\n', { write: 'text' }),
  ] };
  assert.deepEqual(plain(PR.outsideSteps(facts, [{ n: 1 }]).map(p => [p.path, p.title])), [['extra.py', 'surprise']]);
  assert.deepEqual(plain(PR.outsideSteps({ files: [file('a.py', 'python', 'print(1)\n')] }, [{ n: 1 }])), [], 'no step has a place yet: nothing to say');
});

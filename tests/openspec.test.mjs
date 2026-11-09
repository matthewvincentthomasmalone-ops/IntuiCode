// Hand to my AI (lang/openspec.js): the project map as an OpenSpec change, proposal.md, tasks.md and
// .openspec.yaml under openspec/changes/<name>/, and the .zip the browser offers them in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, PYTHON, loadBuilder } from './helpers/engine.mjs';

const ctx = { console, TextEncoder };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'lang/openspec.js'), 'utf8'), ctx, { filename: 'lang/openspec.js' });
const OS = ctx.IntuiOpenSpec;
const plain = (x) => JSON.parse(JSON.stringify(x));

const PLAN = {
  title: 'Personal website', path: ['Websites', 'Portfolio'],
  steps: [
    { id: 'page', n: 1, name: 'Page basics', depth: 'walk', summary: 'The foundation every other part sits on.', usual: '', check: 'The title shows in the browser tab.', done: true },
    { id: 'contact', n: 2, name: 'Contact form', depth: 'hallway', summary: 'A form for visitors to write to you', usual: 'Formspree or Netlify Forms', check: 'An empty box gets a message', done: false },
    { id: 'publish', n: 3, name: 'Putting it online', depth: 'horizon', summary: 'Copies the files to a server that is always on.', usual: '', check: '', done: false },
  ],
};
const INFO = { name: 'my-site', files: ['index.html', 'style.css', 'script.js'], date: '2026-11-09' };
const section = (md, name) => (md.split(/^## /m).find(s => s.startsWith(name + '\n')) || '').slice(name.length).trim();

test('the change is named in kebab-case, as OpenSpec wants', () => {
  assert.equal(OS.changeName('My Site!'), 'my-site');
  assert.equal(OS.changeName('  Café   Menu.py '), 'cafe-menu');
  assert.equal(OS.changeName('DAW -- v2'), 'daw-v2');
  assert.equal(OS.changeName('!!!'), 'my-project');
  assert.equal(OS.changeName(''), 'my-project');
  assert.ok(OS.changeName('x'.repeat(200)).length <= 60);
  assert.match(OS.changeName('A b c 1 2 3'), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test('progress: how many are done, and the first step still to do', () => {
  assert.deepEqual(plain(OS.progress(PLAN.steps)), { done: 1, total: 3, next: 2 });
  assert.deepEqual(plain(OS.progress(PLAN.steps.map(s => ({ ...s, done: true })))), { done: 3, total: 3, next: null });
  assert.deepEqual(plain(OS.progress([])), { done: 0, total: 0, next: null });
  assert.deepEqual(plain(OS.progress(undefined)), { done: 0, total: 0, next: null });
});

test('proposal.md: Why, What Changes and Impact, from the title, path and steps', () => {
  const md = OS.proposal(PLAN, INFO);
  assert.match(md, /^# Proposal: Personal website\n/);
  const why = section(md, 'Why');
  assert.ok(why.length >= 50 && why.length <= 1000, `Why is ${why.length} characters: openspec validate wants 50 to 1000`);
  assert.match(why, /^my-site: Personal website \(Websites › Portfolio\)\./);
  assert.match(why, /3 steps in build order, 1 done so far/);
  const what = section(md, 'What Changes').split('\n');
  assert.equal(what[0], '- **1. Page basics** (Walk: written and runs; done). The foundation every other part sits on.');
  assert.equal(what[1], '- **2. Contact form** (Hallway: laid out, with ‹blanks› to fill in). A form for visitors to write to you.');
  assert.equal(what[2], '  Usually made with: Formspree or Netlify Forms.');
  assert.equal(what[3], '- **3. Putting it online** (Horizon: not written yet). Copies the files to a server that is always on.');
  const impact = section(md, 'Impact');
  assert.match(impact, /^- Files: `index\.html`, `style\.css`, `script\.js`\.$/m);
  assert.match(impact, /`── Step n · Name`/);
  assert.match(impact, /Walk steps are written and run\. Hallway steps leave ‹blanks›.*Horizon steps aren't written yet/);
  assert.ok(md.indexOf('## Why') < md.indexOf('## What Changes') && md.indexOf('## What Changes') < md.indexOf('## Impact'));
});

test('proposal.md: only the depths the map has are explained; a map of horizons has no step comments', () => {
  const md = OS.proposal({ title: 'Phone app', path: [], steps: [{ n: 1, name: 'The app stores', depth: 'horizon', summary: 'Reviews take a day.', done: false }] }, { name: 'phone' });
  const impact = section(md, 'Impact');
  assert.doesNotMatch(impact, /Walk|Hallway|── Step/);
  assert.match(impact, /Horizon steps/);
  assert.match(impact, /- Files: none yet\./);
});

test('a short plan still gets a Why openspec accepts, and a long one is cut to fit', () => {
  const short = section(OS.proposal({ title: 'X', path: [], steps: [] }, {}), 'Why');
  assert.ok(short.length >= 50);
  const long = section(OS.proposal({ title: 'T', path: Array(8).fill('w'.repeat(80)), steps: [] }, { name: 'n'.repeat(80) }), 'Why');
  assert.ok(long.length <= 1000, `${long.length}`);
  assert.equal(section(OS.proposal({ title: 'X', path: [], steps: [] }, {}), 'What Changes'), '- No steps yet.');
});

test('tasks.md: numbered 1.1, 1.2… under one group, ticked steps as [x], each with its check line', () => {
  const md = OS.tasks(PLAN, INFO);
  const lines = md.split('\n');
  assert.equal(lines[0], '# Tasks');
  assert.ok(lines.includes('## 1. Build it, step by step'));
  const tasks = lines.filter(l => /^- \[[ x]\] /.test(l));
  assert.deepEqual(tasks, [
    '- [x] 1.1 Page basics (Walk). Check: The title shows in the browser tab.',
    '- [ ] 1.2 Contact form (Hallway). Check: An empty box gets a message.',
    '- [ ] 1.3 Putting it online (Horizon).',
  ]);
  // OpenSpec's own numbering check: every task id under "## 1." starts with 1., and none repeats
  const ids = tasks.map(l => l.match(/^- \[[ x]\] (\d+(?:\.\d+)+)/)[1]);
  assert.ok(ids.every(id => id.startsWith('1.')));
  assert.equal(new Set(ids).size, ids.length);
  assert.match(OS.tasks({ title: '', steps: [] }, { name: 'empty' }), /^- \[ \] 1\.1 Plan the steps\.$/m);
});

test('text from a step stays on its own line: it can\'t start a heading or a task', () => {
  const plan = { title: 'Site\n## Why', path: [], steps: [{ n: 1, name: 'Evil\n- [x] 9.9 done', depth: 'walk', summary: 'One.\n\n## Impact\nnone', check: 'ok\n## 2. More', done: false }] };
  const proposal = OS.proposal(plan, { name: 'x' }), tasks = OS.tasks(plan, { name: 'x' });
  assert.equal(proposal.match(/^## /gm).length, 3);
  assert.equal(tasks.match(/^## /gm).length, 1);
  assert.equal(tasks.match(/^- \[/gm).length, 1);
  assert.match(tasks, /^- \[ \] 1\.1 Evil - \[x\] 9\.9 done \(Walk\)\. Check: ok ## 2\. More\.$/m);
});

test('files: proposal.md, tasks.md and .openspec.yaml under openspec/changes/<name>/', () => {
  const files = plain(OS.files(PLAN, INFO));
  assert.deepEqual(files.map(f => f.path), ['openspec/changes/my-site/proposal.md', 'openspec/changes/my-site/tasks.md', 'openspec/changes/my-site/.openspec.yaml']);
  assert.equal(files[0].content, OS.proposal(PLAN, INFO));
  assert.equal(files[1].content, OS.tasks(PLAN, INFO));
  assert.equal(files[2].content, 'schema: spec-driven\ncreated: 2026-11-09\n');
  assert.match(plain(OS.files(PLAN, { name: 'x', date: 'soon' }))[2].content, /^created: \d{4}-\d{2}-\d{2}$/m);
  assert.equal(plain(OS.files(PLAN, {}))[0].path, 'openspec/changes/personal-website/proposal.md');
});

test('zip: a .zip any unzipper reads back, file for file', () => {
  assert.equal(OS.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
  const files = plain(OS.files(PLAN, INFO));
  const bytes = OS.zip(files, new Date(2026, 10, 9, 15, 30, 0));
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const dir = mkdtempSync(path.join(os.tmpdir(), 'intuicode-zip-'));
  try {
    const at = path.join(dir, 'plan.zip');
    writeFileSync(at, bytes);
    const read = 'import json,sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nprint(json.dumps([[i.filename,z.read(i).decode("utf-8"),list(i.date_time)] for i in z.infolist()]))';
    const got = JSON.parse(execFileSync(PYTHON, ['-c', read, at], { encoding: 'utf8' }));
    assert.deepEqual(got.map(g => [g[0], g[1]]), files.map(f => [f.path, f.content]));
    assert.deepEqual(got[0][2], [2026, 11, 9, 15, 30, 0]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the builder: every depth has a default check, and a kit\'s plan carries each step\'s check, not done', () => {
  const B = loadBuilder();
  for (const d of Object.values(B.DEPTHS)) assert.ok(d.check && !/\n/.test(d.check));
  const kit = B.library.kits.webpage;
  const { plan } = B.build(B.library, 'webpage', kit.steps.map(s => s.id), 'site', []);
  assert.ok(plan.steps.length > 5);
  for (const s of plan.steps) {
    assert.equal(s.done, false);
    assert.equal(typeof s.check, 'string');
  }
  assert.equal(plan.steps.find(s => s.id === 'page').check, 'The page\'s title shows in the browser tab, and the text uses the shared colours.');
  // the core kits' steps each have a check line of their own, one line and short enough to keep
  for (const id of ['daw', 'webpage', 'terminal', 'window', 'saas', 'gadget', 'phone']) {
    const k = B.library.kits[id];
    assert.ok(k, `no kit ${id}`);
    for (const s of k.steps) {
      const c = B.library.components[s.id];
      assert.ok(c.check, `${id}: ${s.id} has no check line`);
      assert.ok(c.check.length <= 300, `${s.id}: its check is ${c.check.length} characters`);
    }
  }
});

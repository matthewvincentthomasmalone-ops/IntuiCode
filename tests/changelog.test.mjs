// The change log (lang/changelog.js): what changed in the code, worked out from the code before and after.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/engine.mjs';

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['lang/parts.js', 'lang/promises.js', 'lang/changelog.js']) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const LOG = ctx.IntuiLog, PR = ctx.IntuiPromises;
const plain = (x) => JSON.parse(JSON.stringify(x));

test('diff: the lines taken out and put in, as blocks, with where each is', () => {
  assert.deepEqual(plain(LOG.diff('a\nb\nc\n', 'a\nb\nc')), [], 'the same lines (a last line break aside): nothing');
  assert.deepEqual(plain(LOG.diff('a\nb\nc', 'a\nB\nc')), [{ at: 1, to: 1, del: ['b'], add: ['B'] }]);
  assert.deepEqual(plain(LOG.diff('a\nc', 'a\nb\nc')), [{ at: 1, to: 1, del: [], add: ['b'] }]);
  assert.deepEqual(plain(LOG.diff('a\nb\nc\nd', 'b\nc\nd\ne')), [{ at: 0, to: 0, del: ['a'], add: [] }, { at: 4, to: 3, del: [], add: ['e'] }]);
  assert.deepEqual(plain(LOG.diff('', 'x\ny')), [{ at: 0, to: 0, del: [], add: ['x', 'y'] }]);
  // two changes apart stay two blocks, the lines between kept
  const two = plain(LOG.diff('1\n2\n3\n4\n5\n6', '1\nTWO\n3\n4\nFIVE\n6'));
  assert.deepEqual(two.map(k => [k.at, k.del, k.add]), [[1, ['2'], ['TWO']], [4, ['5'], ['FIVE']]]);
  // applying the blocks to a gives b, for a mixed case
  const a = 'x\na\nb\nc\nd\ne\nf'.split('\n'), b = 'a\nB\nc\nnew\nd\nf\ng'.split('\n');
  const out = [...a];
  for (const k of [...LOG.diff(a, b)].reverse()) out.splice(k.at, k.del.length, ...k.add);
  assert.deepEqual(out, b);
});

const APP = 'export default function App() {\n  return <button id="save">Save</button>;\n}\n\nconst handleSave = async () => {\n  await fetch("/api/save");\n};\n';
const langs = new Map([['src/App.tsx', 'tsx'], ['README.md', 'markdown'], ['main.py', 'python']]);
const entry = (before, after) => plain(LOG.entry({ before: new Map(Object.entries(before)), after: new Map(Object.entries(after)), langs, definitions: PR.definitions }));

test('entry: each file that changed, its counts, and the named parts the change falls in', () => {
  assert.equal(entry({ 'src/App.tsx': APP }, { 'src/App.tsx': APP }), null, 'no code changed: no entry');
  const e = entry({ 'src/App.tsx': APP, 'README.md': '# x\n' }, { 'src/App.tsx': APP.replace('/api/save', '/api/keep'), 'README.md': '# x\n' });
  assert.deepEqual(e.files.map(f => [f.path, f.status, f.added, f.removed, f.parts]), [['src/App.tsx', 'changed', 1, 1, ['handleSave']]]);
  assert.deepEqual(e.files[0].blocks, [{ at: 5, to: 5, del: ['  await fetch("/api/save");'], add: ['  await fetch("/api/keep");'] }]);
  const both = entry({ 'src/App.tsx': APP }, { 'src/App.tsx': APP.replace('Save</', 'Keep</').replace('/api/save', '/x') });
  assert.deepEqual(both.files[0].parts, ['App', 'handleSave']);
  const files = entry({ 'main.py': 'def go():\n    pass\n' }, { 'README.md': 'hi\n' });
  assert.deepEqual(files.files.map(f => [f.path, f.status, f.added, f.removed, f.parts]), [['README.md', 'added', 1, 0, []], ['main.py', 'removed', 0, 2, ['go']]]);
});

test('entry: a big change keeps its counts whole but only so many of its lines', () => {
  const big = Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n');
  const e = entry({ 'README.md': '' }, { 'README.md': big });
  const f = e.files[0];
  assert.equal(f.added, 500);
  assert.equal(f.blocks.reduce((n, k) => n + k.add.length, 0), 160);
  assert.equal(f.more, 340);
});

test('summary: who, what and where, in one sentence', () => {
  const e = entry({ 'src/App.tsx': APP }, { 'src/App.tsx': APP.replace('/api/save', '/api/keep') });
  assert.equal(LOG.summary({ ...e, origin: 'outside' }), 'Outside IntuaCode, someone changed handleSave in src/App.tsx (+1 −1).');
  assert.equal(LOG.summary({ ...e, origin: 'you' }), 'You changed handleSave in src/App.tsx (+1 −1).');
  const two = entry({ 'main.py': 'x = 1\n' }, { 'main.py': 'x = 2\n', 'README.md': 'a\nb\n' });
  assert.equal(LOG.summary({ ...two, origin: 'intuacode' }), 'IntuaCode added README.md (2 lines) and changed main.py (+1 −1).');
});

test('checked: a log read back keeps only entries of the right shape, cut to size', () => {
  const good = { id: 'x', at: '2026-11-17T10:00:00.000Z', origin: 'outside', what: 'Found', files: [{ path: 'a.py', status: 'changed', parts: ['go'], added: 1, removed: 0, blocks: [{ at: 0, to: 0, del: [], add: ['x'] }], mine: true }], promises: { broke: ['a.py exists'], mended: [] }, evidence: ['Your AI ticked step 2'] };
  const out = plain(LOG.checked([good, { ...good, origin: 'hacker' }, { ...good, at: 'yesterday' }, { ...good, files: [{ path: 'a', status: 'odd' }] }, null, 'x']));
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], good);
  assert.deepEqual(plain(LOG.checked({ not: 'a list' })), []);
  const lots = Array.from({ length: 400 }, (_, i) => ({ ...good, id: String(i) }));
  const kept = plain(LOG.checked(lots));
  assert.equal(kept.length, LOG.MAX_ENTRIES);
  assert.equal(kept[0].id, '100', 'the newest are kept');
});

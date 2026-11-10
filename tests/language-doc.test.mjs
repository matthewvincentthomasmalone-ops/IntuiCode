// INTUICODE.md, the language reference: its generated index is up to date, and every example in it translates
// with no errors to exactly the code shown under it (the rules are in its "About the examples" section).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadEngine, ROOT } from './helpers/engine.mjs';
import { outOfDate, FOLDERS } from '../tools/intuicode_index.mjs';

const { L, WEB, CPP, TS } = loadEngine();
const DOC = readFileSync(path.join(ROOT, 'INTUICODE.md'), 'utf8').replace(/\r\n/g, '\n');
const LANGS = ['python', 'js', 'ts', 'tsx', 'html', 'css', 'cpp', 'arduino'];

test('INTUICODE.md: the index and lang/intuicode_index.json are up to date (node tools/intuicode_index.mjs)', () => {
  assert.deepEqual(outOfDate(), []);
});

test('INTUICODE.md: the code files it names are the ones app.js writes', () => {
  const literal = readFileSync(path.join(ROOT, 'app.js'), 'utf8').match(/const FILE_NAME = \{([^}]*)\}/);
  assert.ok(literal, 'FILE_NAME not found in app.js');
  const names = Object.fromEntries([...literal[1].matchAll(/(\w+): '([^']+)'/g)].map(m => [m[1], m[2]]));
  for (const [id, [, file]] of Object.entries(FOLDERS)) if (id !== 'sketch') assert.equal(file, names[id], id);   // a sketch is named after its folder
});

test('INTUICODE.md: every link to a heading in it leads somewhere', () => {
  const prose = DOC.replace(/^```[^\n]*\n[\s\S]*?^```$/gm, '');
  const seen = new Map(), anchors = new Set();
  for (const [, h] of prose.matchAll(/^#{1,6} (.+)$/gm)) {   // GitHub's anchors: lower case, punctuation out, spaces to -, repeats numbered
    const base = h.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/ /g, '-');
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    anchors.add(n ? `${base}-${n}` : base);
  }
  const broken = [...prose.matchAll(/\]\(#([^)]+)\)/g)].map(m => m[1]).filter(a => !anchors.has(a));
  assert.deepEqual(broken, []);
});

/* Fenced blocks in document order, with the ## section each is in. */
function fencedBlocks(md) {
  const lines = md.split('\n'), blocks = [];
  let h2 = '';
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^## (.+)$/);
    if (h) { h2 = h[1]; continue; }
    const f = lines[i].match(/^```(.*)$/);
    if (!f) continue;
    const start = i, body = [];
    for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++) body.push(lines[i]);
    blocks.push({ info: f[1].trim(), text: body.join('\n'), start: start + 1, end: i + 1, h2 });
  }
  return blocks;
}

/* Each `intuicode <lang>` block with the block after it (its expected code), and the page it runs against. */
function examples(md) {
  const blocks = fencedBlocks(md), lines = md.split('\n'), out = [];
  let page = '', section = null;
  blocks.forEach((b, k) => {
    const m = b.info.match(/^intuicode\s+(\S+)$/);
    if (!m) return;
    if (b.h2 !== section) { section = b.h2; page = ''; }
    const lang = m[1], want = blocks[k + 1];
    const gap = want ? lines.slice(b.end, want.start - 1) : [];
    out.push({ lang, said: b.text, want: want && !/^intuicode\b/.test(want.info) && gap.every(l => !l.trim()) ? want.text : null, line: b.start, page });
    if (lang === 'html') page = b.text;
  });
  return out;
}

function translate(lang, text, page) {
  if (lang === 'ts' || lang === 'tsx') return TS.compileTs({ id: 'x', file: 'typescript', text }, null, { lang });
  if (lang === 'python') return L.compileProject({ sections: [{ id: 'main', file: 'main', text }] }).results.main;
  if (lang === 'cpp' || lang === 'arduino') {
    const file = lang === 'arduino' ? 'sketch' : 'program';
    return CPP.compileCppProject({ kind: lang === 'arduino' ? 'arduino' : 'cpp', sections: [{ id: file, file, text }] }).results[file];
  }
  const file = { html: 'structure', css: 'styling', js: 'mechanics' }[lang];
  const sections = ['structure', 'styling', 'mechanics'].map(f => ({ id: f, file: f, text: f === file ? text : f === 'structure' ? page : '' }));
  return WEB.compileWebsite({ sections }).results[file];
}

/* What goes inside <body>, without the page's own script tag, and with the body's indent taken off. */
function bodyOf(html) {
  const lines = html.replace(/\n$/, '').split('\n');
  let a = lines.findIndex(l => /^<body\b/.test(l)), z = lines.lastIndexOf('</body>');
  if (lines[z - 1] === '  <script src="script.js"></script>') z--;
  return lines.slice(a + 1, z).map(l => l.replace(/^ {2}/, '')).join('\n');
}

const found = examples(DOC);

test('INTUICODE.md has examples for every language, each followed by its code', () => {
  for (const lang of LANGS) assert.ok(found.some(e => e.lang === lang), `no intuicode ${lang} example`);
  for (const e of found) {
    assert.ok(LANGS.includes(e.lang), `line ${e.line}: "intuicode ${e.lang}" isn't one of ${LANGS.join(', ')}`);
    assert.ok(e.want != null, `line ${e.line}: the example must be followed (after blank lines only) by a fenced block of the code it becomes`);
  }
});

for (const e of found) {
  if (!LANGS.includes(e.lang) || e.want == null) continue;
  test(`INTUICODE.md line ${e.line}: the ${e.lang} example translates to the code shown`, () => {
    const r = translate(e.lang, e.said, e.page);
    const errors = r.info.flatMap((inf, i) => inf.errs.map(err => `line ${i + 1}: ${err}`));
    assert.deepEqual([...errors], [], `the example has errors:\n${errors.join('\n')}`);
    const code = r.text.replace(/\n$/, '');
    const got = e.lang === 'html' && !/^\s*<(?:!DOCTYPE|html)\b/i.test(e.want) ? bodyOf(code) : code;
    assert.equal(got, e.want);
  });
}

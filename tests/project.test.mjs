// A project as a tree of files: paths are safe, older projects load the same, each engine compiles its own
// files, and notes and data are shown without letting markup through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { loadEngine, PYTHON } from './helpers/engine.mjs';

const { L, WEB, CPP, PRJ, LANGS } = loadEngine();
const W = { LANG: L, WEB, CPP };
const plain = (x) => JSON.parse(JSON.stringify(x));   // (objects made in the engine's sandbox)
const KIND_FILES = { python: ['settings', 'tools', 'main'], website: ['structure', 'styling', 'mechanics'], cpp: ['program'], arduino: ['sketch'] };

test('paths IntuCode will write stay inside the project and out of its own folders', () => {
  for (const ok of ['main.py', 'docs/plan.md', 'dsp/gain.py', 'a b/notes.md', 'site/index.html', 'native/gain.rs', 'data/scores.csv', 'v1.2/notes.txt'])
    assert.equal(PRJ.pathProblem(ok, LANGS.fromPath(ok)), '', ok);
  for (const bad of ['../x.py', 'a/../../x.md', '/etc/passwd', 'C:/x.md', 'C:\\x.md', '.intuicode/project.json', 'images/a.png', '.hidden', 'a//b.md', 'a/', ' a.md', 'a.md ', 'a /b.md', '', 'a/b/c/d/e/f/g.md'])
    assert.notEqual(PRJ.pathProblem(bad), '', JSON.stringify(bad));
  assert.match(PRJ.pathProblem('2bad.py', 'python'), /Python names/);
  assert.match(PRJ.pathProblem('my file.py', 'python'), /Python names/);
  assert.equal(PRJ.pathProblem('lib/my_file.py', 'python'), '');
});

test('a project file from someone else can\'t name a path outside the project, or a language IntuCode doesn\'t know', () => {
  const file = (path, lang = 'markdown') => ({ version: 2, sections: [{ id: 'a', path, lang, text: '' }] });
  assert.ok(PRJ.checkedSections(file('notes.md'), KIND_FILES));
  assert.equal(PRJ.checkedSections(file('../notes.md'), KIND_FILES), null);
  assert.equal(PRJ.checkedSections(file('notes.md', 'klingon'), KIND_FILES), null);
  assert.equal(PRJ.checkedSections({ sections: [{ id: 'a b', path: 'x.md', lang: 'markdown' }] }, KIND_FILES), null);
  assert.equal(PRJ.checkedSections({ sections: Array.from({ length: 201 }, (_, i) => ({ id: 'f' + i, path: `f${i}.md`, lang: 'markdown' })) }, KIND_FILES), null);
  // the older form: files named by role, only the roles that kind of project had
  assert.ok(PRJ.checkedSections({ kind: 'website', sections: [{ id: 'structure', file: 'structure', text: '' }] }, KIND_FILES));
  assert.equal(PRJ.checkedSections({ kind: 'website', sections: [{ id: 'main', file: 'main', text: '' }] }, KIND_FILES), null);
});

test('projects saved before files had paths load as the same files, and compile the same', () => {
  const old = { kind: 'python', sections: [{ id: 'settings', file: 'settings', text: 'set speed to 3' }, { id: 'tools', file: 'tools', text: 'define double using n\n    give back n times 2' }, { id: 'main', file: 'main', text: 'show double(speed)' }], active: 'main' };
  const before = L.compileProject(plain(old)).results;
  const p = PRJ.normalized(plain(old));
  assert.deepEqual(plain(p.sections.map(s => [s.id, s.path, s.lang, s.file])), [['settings', 'settings.py', 'python', 'settings'], ['tools', 'tools.py', 'python', 'tools'], ['main', 'main.py', 'python', 'main']]);
  assert.equal(p.start, 'main');
  assert.equal(p.kind, 'python');
  const after = PRJ.compileAll(p, W).results;
  for (const id of ['settings', 'tools', 'main']) assert.equal(after[id].text, before[id].text, id);
  const site = PRJ.normalized({ kind: 'website', sections: [{ id: 'structure', file: 'structure', text: 'add a heading "Hi"' }, { id: 'styling', file: 'styling', text: '' }, { id: 'mechanics', file: 'mechanics', text: '' }] });
  assert.deepEqual(plain(site.sections.map(s => s.path)), ['index.html', 'style.css', 'script.js']);
  assert.equal(site.start, 'structure');
  assert.equal(site.kind, 'website');
  const sketch = PRJ.normalized({ kind: 'arduino', sections: [{ id: 'sketch', file: 'sketch', text: '' }] });
  assert.equal(sketch.sections[0].lang, 'arduino');
});

test('two files in one place, or two Python files with one module name, are refused', () => {
  const two = (a, b) => PRJ.normalized({ sections: [{ id: 'a', path: a, lang: LANGS.fromPath(a), text: '' }, { id: 'b', path: b, lang: LANGS.fromPath(b), text: '' }] });
  assert.equal(two('notes.md', 'Notes.md'), null);   // the same file on Windows and macOS
  assert.equal(two('docs', 'docs/a.md'), null);       // a file where a folder is
  assert.ok(two('a/x.md', 'b/x.md'));
});

test('a mixed project: each engine compiles its own files, Python files import the ones before them, the start file last', () => {
  const p = PRJ.normalized({
    sections: [
      { id: 'main', path: 'main.py', lang: 'python', text: 'show double(21)' },
      { id: 'h', path: 'dsp/maths.py', lang: 'python', text: 'define double using n\n    give back n times 2' },
      { id: 'page', path: 'index.html', lang: 'html', text: 'add a heading "Hello"' },
      { id: 'about', path: 'about.html', lang: 'html', text: 'add a heading "About"' },
      { id: 'notes', path: 'README.md', lang: 'markdown', text: '# Notes' },
      { id: 'rs', path: 'native/gain.rs', lang: 'rust', text: 'pub fn gain() {}' },
    ],
    start: 'main',
  });
  assert.equal(p.kind, 'python');
  const out = PRJ.compileAll(p, W);
  assert.match(out.results.main.text, /^from dsp\.maths import \*$/m, 'main sees dsp/maths.py');
  assert.doesNotMatch(out.results.h.text, /import/, 'dsp/maths.py doesn\'t import the start file');
  assert.match(out.results.page.text, /<h2>Hello<\/h2>/);
  assert.match(out.results.about.text, /<h2>About<\/h2>/, 'another page compiles against the main one');
  assert.equal(out.results.notes, undefined, 'notes aren\'t compiled');
  assert.equal(out.results.rs, undefined, 'code files aren\'t compiled');
  assert.equal(out.page.structure.id, 'page', 'index.html is the main page');
  assert.ok(out.pySyms.has('double'));
  const errs = Object.values(out.results).flatMap(r => r.info.flatMap(i => i.errs));
  assert.deepEqual(plain(errs), []);
  // and the Python runs, from the project's folder layout
  const dir = { 'main.py': out.results.main.text, 'dsp/maths.py': out.results.h.text };
  const prog = `import os, sys, tempfile\nd = tempfile.mkdtemp()\nfiles = ${JSON.stringify(dir)}\nfor k, v in files.items():\n    os.makedirs(os.path.dirname(os.path.join(d, k)) or d, exist_ok=True)\n    open(os.path.join(d, k), "w").write(v)\nsys.path.insert(0, d)\nos.chdir(d)\nexec(open("main.py").read())\n`;
  assert.equal(execFileSync(PYTHON, ['-c', prog], { encoding: 'utf8' }).trim(), '42');
});

test('C++ files compile together, so one file\'s tools are known in another', () => {
  const p = PRJ.normalized({ sections: [{ id: 'm', path: 'main.cpp', lang: 'cpp', text: 'show 1' }, { id: 'x', path: 'extra.cpp', lang: 'cpp', text: 'define five\n    give back 5' }], start: 'm' });
  assert.equal(p.kind, 'cpp');
  const out = PRJ.compileAll(p, W);
  assert.ok(out.results.m && out.results.x);
  assert.ok(out.syms.has('five'));
});

test('a project of notes only is a project of files, with nothing to compile', () => {
  const p = PRJ.normalized({ sections: [{ id: 'r', path: 'README.md', lang: 'markdown', text: '# Hi' }] });
  assert.equal(p.kind, 'files');
  assert.deepEqual(plain(PRJ.compileAll(p, W).results), {});
});

test('Markdown shows as a page, with no way for markup or scripts through', () => {
  const html = PRJ.mdToHtml('# Title\n\nSome **bold** and `code` and [a link](javascript:alert(1)) and ![pic](x.png)\n\n- [x] done\n- [ ] not yet\n\n| a | b |\n|---|---|\n| 1 | <i>2</i> |\n\n```\n<script>alert(1)</script>\n```\n<img src=x onerror=alert(1)>');
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<b>bold<\/b>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<span class="md-link" title="javascript:alert\(1">a link<\/span>/, 'a link shows its address, and is not a link');
  assert.match(html, /☑<\/span> done/);
  assert.match(html, /<td>&lt;i&gt;2&lt;\/i&gt;<\/td>/);
  assert.doesNotMatch(html, /<script|<img|<a\b|onerror="|href=/i);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal(PRJ.mdToHtml(''), '');
});

test('CSV cells with commas and quotes inside them', () => {
  assert.deepEqual(plain(PRJ.csvRows('name,score\nAna,3\n"Bo, Jr",5\n"say ""hi""",6')), [['name', 'score'], ['Ana', '3'], ['Bo, Jr', '5'], ['say "hi"', '6']]);
  assert.equal(PRJ.csvRows(Array.from({ length: 500 }, (_, i) => `r${i}`).join('\n'), 200).length, 200);
});

test('every language has a role, and only the sentence languages compile', () => {
  for (const l of LANGS.LANGUAGES) {
    const sec = { path: 'a.' + l.exts[0], lang: l.id };
    assert.equal(PRJ.isSentences(sec), l.write === 'sentences', l.id);
    assert.ok(PRJ.roleOf(sec), l.id);
  }
});

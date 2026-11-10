// The Lovable stack as phrase packs (Tailwind, shadcn/ui, react-router, TanStack Query, Supabase), each said in words
// and back exactly; then a Lovable-style project taken through Unity: every file translated in place, put back
// unchanged byte for byte, and edited in the context of its file with the code checked exact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadConverter, ROOT } from './helpers/engine.mjs';

const { convert, TS, CPP, C, env } = await loadConverter();
const plain = (x) => JSON.parse(JSON.stringify(x));
const write = (text, lang = 'tsx') => TS.compileTs({ id: 'x', file: 'typescript', text }, null, { lang });
const errs = (r) => plain(r.info.flatMap((inf, i) => inf.errs.map(e => `${i + 1}: ${e}`)));
const exact = (kind, src, re) => {
  const r = convert(kind, src);
  assert.equal(r.exact, true, `${r.reason}\n${r.text}`);
  if (re) assert.match(r.text, re);
  assert.deepEqual(errs(write(r.text, kind)), [], r.text);
  return r;
};

test('Tailwind: each class in words, in order, and back; a class with no words stays as written', () => {
  const w = TS.tailwindWords('flex items-center gap-2 p-4 text-sm font-semibold text-muted-foreground bg-white/50 rounded-lg shadow-md hover:underline md:grid-cols-2 data-[state=open]:bg-accent');
  assert.equal(w, 'flexible layout, items centred, gap 2, space inside 4, text size sm, semi-bold, text colour muted-foreground, background colour white/50, rounded corners lg, a shadow md, underlined on hover, 2 columns on medium screens and up, "data-[state=open]:bg-accent"');
  assert.equal(TS.tailwindClasses(w, []), 'flex items-center gap-2 p-4 text-sm font-semibold text-muted-foreground bg-white/50 rounded-lg shadow-md hover:underline md:grid-cols-2 data-[state=open]:bg-accent');
  // classes not one space apart are said as written; a style with no class is a problem, never a guess
  assert.equal(TS.tailwindWords('flex  gap-2'), null);
  assert.equal(TS.tailwindWords('card'), null);
  const e = [];
  assert.equal(TS.tailwindClasses('flexible layout, sparkly', e), null);
  assert.match(e[0], /I don't know "sparkly" as a style/);
  exact('tsx', 'const A = () => <div className="flex flex-col gap-4 hover:bg-accent sm:flex-row">x</div>;\n', /styled as flexible layout, items top to bottom, gap 4, background colour accent on hover, items side by side on small screens and up$/m);
});

test('shadcn/ui and react-router: a ghost Button, a Route for "/" showing an Index', () => {
  const r = write([
    'constant A is a component, showing:',
    '    together',
    '        a ghost Button saying "Close", with size "sm"',
    '        a Routes',
    '            a Route for "/" showing an Index',
    '        a Link to "/about" saying "About"',
  ].join('\n'));
  assert.deepEqual(errs(r), []);
  assert.match(r.text, /<Button variant="ghost" size="sm">Close<\/Button>/);
  assert.match(r.text, /<Route path="\/" element=\{<Index \/>\} \/>/);
  assert.match(r.text, /<Link to="\/about">About<\/Link>/);
  exact('tsx', 'const A = () => <Badge variant="outline">New</Badge>;\n', /^constant A is a component, showing: an outline Badge saying "New"$/m);
});

test('Supabase: queries said as what they ask the database', () => {
  const r = write([
    'define shared load',
    '    wait for every row of the "notes" table in supabase where "done" is false sorted by "created_at" from the end at most 20, and take data and error from it',
    '    if error',
    '        fail with error as it is',
    '    wait for adding note to the "notes" table in supabase giving back the result as a single row, and take data from it',
    '    wait for changing { done: true } in the "notes" table in supabase where "id" is id',
    '    wait for deleting from the "notes" table in supabase where "id" is not id',
    '    wait for the "id, title" of every row of the "notes" table in supabase as one row or none',
  ].join('\n'), 'ts');
  assert.deepEqual(errs(r), []);
  assert.equal(r.text, [
    'export async function load() {',
    '  const { data, error } = await supabase.from("notes").select("*").eq("done", false).order("created_at", { ascending: false }).limit(20);',
    '  if (error) {',
    '    throw error;',
    '  }',
    '  const { data } = await supabase.from("notes").insert(note).select().single();',
    '  await supabase.from("notes").update({ done: true }).eq("id", id);',
    '  await supabase.from("notes").delete().neq("id", id);',
    '  await supabase.from("notes").select("id, title").maybeSingle();',
    '}',
    '',
  ].join('\n'));
  exact('ts', 'async function f() {\n  const { data, error } = await supabase\n    .from("notes")\n    .select("*")\n    .order("created_at", { ascending: false });\n  if (error) throw error;\n  return data;\n}\n',
    /^    wait for every row of the "notes" table in supabase sorted by "created_at" from the end, and take data and error from it\n    if error, fail with error as it is$/m);
});

test('TanStack Query: the query, a change, and what to do when it works', () => {
  const r = write([
    'define shared useNotes',
    '    give back the query ["notes"] loaded by fetchNotes',
    'define shared useAdd',
    '    constant client is the result of useQueryClient',
    '    give back a change made by addNote',
    '        when it works',
    '            mark the query ["notes"] in client as out of date',
    '        when it fails, run console.error with "no"',
  ].join('\n'), 'ts');
  assert.deepEqual(errs(r), []);
  assert.equal(r.text, [
    'export function useNotes() {',
    '  return useQuery({ queryKey: ["notes"], queryFn: fetchNotes });',
    '}',
    'export function useAdd() {',
    '  const client = useQueryClient();',
    '  return useMutation({',
    '    mutationFn: addNote,',
    '    onSuccess: () => {',
    '      client.invalidateQueries({ queryKey: ["notes"] });',
    '    },',
    '    onError: () => console.error("no"),',
    '  });',
    '}',
    '',
  ].join('\n'));
  assert.match(errs(write('define f\n    give back a change made by g\n        show 1')).join(), /go "when it works" and "when it fails"/);
});

/* ---- layout: written back from its sentences, a file is the same file (git shows no change) ---- */
const back = (kind, src) => { const r = exact(kind, src); return { r, code: write(r.text, kind).text }; };

test('Layout: a Lovable-style file comes back byte for byte from its sentences', () => {
  const src = [
    'import { useState } from "react";',
    'import { useQuery } from "@tanstack/react-query";',
    'import { Button } from "@/components/ui/button";',
    'import { Input } from "@/components/ui/input";',
    'import { fetchNotes } from "@/lib/notes";',
    '',
    '// The notes page: a search box and the notes it finds.',
    'const Notes = () => {',
    '  const [query, setQuery] = useState("");',
    '  const { data: notes = [], isLoading } = useQuery({',
    '    queryKey: ["notes"],',
    '    queryFn: fetchNotes,',
    '  });',
    '  const shown = notes.filter((n) => n.title.includes(query));',
    '',
    '  if (isLoading) return <p className="p-6 text-muted-foreground">Loading…</p>;',
    '',
    '  return (',
    '    <div className="space-y-4 p-6">',
    '      <h1 className="text-2xl font-bold">',
    '        Notes',
    '      </h1>',
    '      <Input',
    '        placeholder="Search notes"',
    '        value={query}',
    '        onChange={(e) => setQuery(e.target.value)}',
    '      />',
    '      <ul>',
    '        {shown.map((note) => (',
    '          <li key={note.id}>',
    '            {note.title}',
    '          </li>',
    '        ))}',
    '      </ul>',
    '      <Button onClick={() => setQuery("")}>Clear</Button>',
    '    </div>',
    '  );',
    '};',
    '',
    'function Empty() {',
    '  return <p>Nothing here yet.</p>;',
    '}',
    '',
    'export default Notes;',
    '',
  ].join('\n');
  const { r, code } = back('tsx', src);
  assert.equal(code, src, r.text);
  assert.deepEqual(plain(r.layout), [], 'nothing to say about its layout');
  // how the sentences carry it: one line of sentences, one line of code
  for (const said of [
    /^    take data as notes \(or an empty list\) and isLoading from the query \["notes"\]\n        loaded by fetchNotes$/m,
    /^    if isLoading, show: a paragraph saying "Loading…", styled as space inside 6, text colour muted-foreground$/m,
    /^            a big heading, styled as text size 2xl, bold\n                "Notes"$/m,
    /^            an Input\n                with placeholder "Search notes"\n                with value \{query\}\n                when changed with e: change query to e\.target\.value$/m,
    /\n\ndefine component Empty\n    show: a paragraph saying "Nothing here yet\."$/m,
    /^note: The notes page: a search box and the notes it finds\.$/m,
  ]) assert.match(r.text, said);
  // the corpora: every file comes back as it was, or says where not (and the program is the same either way)
  const tsFiles = (dir) => readdirSync(dir).flatMap(n => { const f = path.join(dir, n); return statSync(f).isDirectory() ? tsFiles(f) : /\.tsx?$/.test(n) ? [f] : []; });
  let same = 0, all = 0;
  for (const dir of ['tests/corpus_react', 'tests/heldout_react']) {
    for (const f of tsFiles(path.join(ROOT, dir))) {
      const kind = f.endsWith('.tsx') ? 'tsx' : 'ts', text = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
      const got = back(kind, text);
      all++;
      if (!got.r.layout.length) { assert.equal(got.code, text, `${f}\n${got.r.text}`); same++; }
      else assert.notEqual(got.code, text, `${f}: says its layout differs, and it does`);
    }
  }
  assert.ok(same >= 15, `only ${same} of ${all} files come back byte for byte`);
});

test('Layout: what sentences can\'t say about the layout is said, with the lines and why', () => {
  const src = [
    'import {',
    '  Card,',
    '  CardContent,',
    '} from "@/components/ui/card";',
    'import { supabase } from "@/integrations/supabase/client";',
    '',
    'export async function load() {',
    '  const { data, error } = await supabase',
    '    .from("notes")',
    '    .select("*");',
    '  if (error) throw error;',
    '  return data;',
    '}',
    '',
  ].join('\n');
  const { r, code } = back('ts', src);
  assert.notEqual(code, src);
  // the code's lines (from, to), and the sentence lines that say them (said)
  assert.deepEqual(plain(r.layout), [
    { from: 1, to: 4, why: 'names brought in one per line', said: { from: 1, to: 1 } },
    { from: 8, to: 10, why: 'a value written over several lines', said: { from: 5, to: 5 } },
  ]);
  assert.match(r.text.split('\n')[4], /^    wait for every row of the "notes" table in supabase, and take data and error from it$/);
  // the rest is as it was: the blank line, the one-line if
  assert.match(code, /client";\n\nexport async function load\(\) \{$/m);
  assert.match(code, /^  if \(error\) throw error;$/m);
  // a one-line if: its step is the part after the comma that is a step, so a test can have commas of its own
  const w = write('define f using a, b\n    if the result of g with a, b, give back 1\n    give back 2', 'ts');
  assert.deepEqual(errs(w), []);
  assert.match(w.text, /^  if \(g\(a, b\)\) return 1;\n  return 2;$/m);
});

test('The app\'s start, a file for what it does, and the parts it takes', () => {
  exact('tsx', 'import "./index.css";\ncreateRoot(document.getElementById("root")!).render(<App />);\n', /^bring in "\.\/index\.css"\nshow an App in \(the element called "root" for sure\)$/m);
  exact('tsx', 'function A() {\n  const { data: notes = [], isLoading } = useNotes();\n  return <p>{notes.length}</p>;\n}\n', /^    take data as notes \(or an empty list\) and isLoading from the result of useNotes$/m);
  exact('ts', 'export function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n', /^define shared cn using inputs \(the rest, a list of ClassValue\)$/m);
});

/* ---- a Lovable-style project, through Unity, file by file ---- */
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['lang/languages.js', 'lang/project.js', 'lang/python.js', 'lang/web_write.js', 'lang/ts_write.js', 'lang/unity.js']) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const U = ctx.IntuiUnity, PRJ = ctx.IntuiProject, W = { WEB: ctx.IntuiWeb, TS: ctx.IntuiTs, CPP };
const filesIn = (dir) => readdirSync(dir).flatMap(n => { const f = path.join(dir, n); return statSync(f).isDirectory() ? filesIn(f) : [f]; });

test('A Lovable-style project: imported, translated in Unity, left alone, edited, and exact', async () => {
  const dir = path.join(ROOT, 'tests/corpus_react');
  let translated = 0;
  for (const f of filesIn(dir)) {
    const lang = ctx.IntuiLanguages.fromPath(f);
    if (lang !== 'ts' && lang !== 'tsx') continue;
    const code = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '');
    // imported as the app imports it: every line an exact line, which Unity shows as the code
    const text = U.toFile(lang, code.split('\n'), []) + '\n';
    const shown = U.fromFile(lang, text);
    assert.equal(shown.lines.join('\n'), code + '\n', `${f}: shown as its code`);
    // Translate to Plain Language Syntax on the whole file
    const d = await U.deRegex(lang, shown.lines, shown.regions, 0, shown.lines.length - 1, (k, s) => convert(k, s));
    assert.deepEqual(plain(d.failed), [], f);
    assert.ok(d.done.every(x => x.exact), `${f}: ${plain(d.done.filter(x => !x.exact))}`);
    // Original Code on every part nobody changed: exactly the file it was
    let lines = d.lines, regions = d.regions;
    while (regions.length) { const r = U.reRegex(lang, lines, regions, 0, W); assert.ok(r.ok, f); lines = r.lines; regions = r.regions; }
    assert.equal(lines.join('\n'), code + '\n', `${path.relative(dir, f)}: back exactly`);
    translated++;
  }
  assert.ok(translated >= 12, `only ${translated} files`);

  // an edit, in the file's context: the page's heading and a class in words
  const f = path.join(dir, 'src/pages/Index.tsx');
  const code = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const lines = code.split('\n');
  const at = U.expand('tsx', lines, lines.findIndex(l => l.includes('const Index')), lines.findIndex(l => l.includes('const Index')));
  const w = await U.toWords('tsx', lines, at.from, at.to, (k, s) => convert(k, s));
  assert.equal(w.exact, true, w.reason);
  const said = lines.slice(0, at.from).concat(w.words, lines.slice(at.to + 1));
  const regions = [{ from: at.from, to: at.from + w.words.length - 1, original: w.original, words: w.words, base: w.base }];
  const edited = said.map(l => l.replace('a big heading saying "Notes", styled as text size 2xl, bold', 'a big heading saying "My notes", styled as text size 3xl, bold'));
  assert.notDeepEqual(edited, said, 'the heading is in words');
  const back = U.reRegex('tsx', edited, regions, 0, W);
  assert.ok(back.ok, JSON.stringify(back.problems));
  const made = back.lines.join('\n');
  assert.match(made, /<h1 className="text-3xl font-bold">My notes<\/h1>/);
  assert.equal(C.check('tsx', code.replace('<h1 className="text-2xl font-bold">Notes</h1>', '<h1 className="text-3xl font-bold">My notes</h1>'), made, env()).same, true, made);
  // the rest of the file is untouched
  assert.equal(made.split('\n').slice(0, at.from).join('\n'), lines.slice(0, at.from).join('\n'));

  // and the project compiles its TypeScript files on their own (Split Mode's code)
  const sec = { id: 'a', path: 'src/pages/NotFound.tsx', lang: 'tsx', text: convert('tsx', readFileSync(path.join(dir, 'src/pages/NotFound.tsx'), 'utf8')).text };
  const out = PRJ.compileAll({ sections: [sec], start: 'a' }, W);
  assert.deepEqual(plain(out.results.a.info.flatMap(i => i.errs)), []);
  assert.equal(C.check('tsx', readFileSync(path.join(dir, 'src/pages/NotFound.tsx'), 'utf8'), out.results.a.text, env()).same, true);
});

test('A Lovable-style project in Unity: a file translated whole, then written from its sentences, is the same file', async () => {
  const dir = path.join(ROOT, 'tests/corpus_react');
  let same = 0;
  for (const f of filesIn(dir)) {
    const lang = ctx.IntuiLanguages.fromPath(f);
    if (lang !== 'ts' && lang !== 'tsx') continue;
    const code = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '');
    const shown = U.fromFile(lang, U.toFile(lang, code.split('\n'), []) + '\n');
    const d = await U.deRegex(lang, shown.lines, shown.regions, 0, shown.lines.length - 1, (k, s) => convert(k, s));
    // the project's file is now sentences (and exact lines): its code, as the project writes it (and a save writes it)
    const sec = { id: 'a', path: path.relative(dir, f).replace(/\\/g, '/'), lang, text: U.toFile(lang, d.lines, d.regions) };
    const out = PRJ.compileAll({ sections: [sec], start: 'a' }, W).results.a;
    assert.deepEqual(plain(out.info.flatMap(i => i.errs)), [], f);
    const laid = d.done.flatMap(p => plain(p.layout));
    // (where: lines of the translated text, the sentences that say that code)
    for (const x of laid) assert.ok(d.lines.slice(x.from, x.to + 1).every(l => l.trim()), `${f}: ${JSON.stringify(x)}`);
    if (/[\\/]lib[\\/]notes\.ts$/.test(f)) assert.match(d.lines[laid[0].from], /^    wait for every row of the "notes" table/);
    if (laid.length) assert.notEqual(out.text, code + '\n', `${f}: says its layout differs, and it does`);
    else { assert.equal(out.text, code + '\n', `${sec.path}: the same file`); same++; }
  }
  assert.ok(same >= 9, `only ${same} files the same`);

  // translated whole and one sentence changed: Original Code writes the file from its sentences, and only that line
  // of code changes (the diff a commit would show)
  const f = path.join(dir, 'src/hooks/use-notes.ts');
  const code = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n';
  const shown = U.fromFile('ts', U.toFile('ts', code.split('\n'), []));
  const d = await U.deRegex('ts', shown.lines, shown.regions, 0, shown.lines.length - 1, (k, s) => convert(k, s));
  assert.deepEqual(plain(d.done.flatMap(p => p.layout)), []);
  const at = d.lines.findIndex(l => /^    give back the query \["notes"\]$/.test(l));
  assert.ok(at > 0, d.lines.join('\n'));
  const edited = d.lines.map((l, n) => (n === at ? l.replace('["notes"]', '["all-notes"]') : l));
  const out = U.reRegex('ts', edited, d.regions, 0, W);
  assert.ok(out.ok, JSON.stringify(out.problems));
  assert.equal(out.lines.join('\n'), code.replace('queryKey: ["notes"],\n    queryFn: fetchNotes', 'queryKey: ["all-notes"],\n    queryFn: fetchNotes'));
});

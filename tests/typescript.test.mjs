// TypeScript as a sentence language (lang/ts_write.js, lang/ts_convert.js): the JavaScript sentences plus types,
// shapes, type names, the parts a file shares, and bring in. Every conversion is checked exact, types and all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadConverter, ROOT } from './helpers/engine.mjs';

const { convert, TS, WEB, CPP, C, env } = await loadConverter();
const ts = (text, lang = 'ts') => TS.compileTs({ id: 'x', file: 'typescript', text }, null, { lang });
const errs = (r) => JSON.parse(JSON.stringify(r.info.flatMap((inf, i) => inf.errs.map(e => `${i + 1}: ${e}`))));
const exact = (kind, src, re) => {
  const r = convert(kind, src);
  assert.ok(r.ok, r.error);
  assert.equal(r.exact, true, `${r.reason}\n${r.text}`);
  if (re) assert.match(r.text, re);
  assert.deepEqual(errs(ts(r.text, kind)), [], r.text);
  return r;
};

test('TypeScript: types where names are made', () => {
  const r = ts([
    'set total (a number) to 0',
    'constant label (text) is "Total"',
    'set user (a User or nothing) to nothing',
    'set tags (a list of text) to an empty list',
    'define add using a (a number), b (a number) = 1 giving back a number',
    '    give back a plus b',
    'define greet using name (text, if any)',
    '    show "Hi", name',
    'constant handle is a tool using e (a React.FormEvent)',
    '    show e',
    'constant double is a tool using n (a number) giving back n times 2',
  ].join('\n'));
  assert.deepEqual(errs(r), []);
  assert.equal(r.text, [
    'let total: number = 0;',
    'const label: string = "Total";',
    'let user: User | null = null;',
    'let tags: string[] = [];',
    'function add(a: number, b: number = 1): number {',
    '  return a + b;',
    '}',
    'function greet(name?: string) {',
    '  console.log("Hi", name);',
    '}',
    'const handle = (e: React.FormEvent) => {',
    '  console.log(e);',
    '};',
    'const double = (n: number) => n * 2;',
    '',
  ].join('\n'));
});

test('TypeScript: shapes, type names and the parts a file shares', () => {
  const r = ts([
    'bring in the types Note and Tag from "./types"',
    'define shared shape Item based on Base',
    '    read-only id is text',
    '    done is true or false, if any',
    '    onPick is a tool using id (text) giving back nothing',
    'define type Filter as "all", "open" or "done"',
    'define shared type Props as a shape',
    '    items is a list of Item',
    'define main f',
    '    give back 1',
    'shared constant size is 3',
    'share size and f',
  ].join('\n'));
  assert.deepEqual(errs(r), []);
  assert.equal(r.text, [
    'import type { Note, Tag } from "./types";',
    'export interface Item extends Base {',
    '  readonly id: string;',
    '  done?: boolean;',
    '  onPick: (id: string) => void;',
    '}',
    'type Filter = "all" | "open" | "done";',
    'export type Props = {',
    '  items: Item[];',
    '};',
    'export default function f() {',
    '  return 1;',
    '}',
    'export const size = 3;',
    'export { size, f };',
    '',
  ].join('\n'));
});

test('TypeScript: words for types, both ways', () => {
  const back = (w, pos) => TS.typeTs(w, pos, []);
  assert.equal(back('a number'), 'number');
  assert.equal(back('true or false'), 'boolean');
  assert.equal(back('text, a number or nothing'), 'string | number | null');
  assert.equal(back('true or false or undefined'), 'boolean | undefined');
  assert.equal(back('a list of Note or nothing'), 'Note[] | null');
  assert.equal(back('a Promise of nothing'), 'Promise<void>');
  assert.equal(back('nothing', 'ret'), 'void');
  assert.equal(back('nothing'), 'null');
  assert.equal(back('a Record of text and a number'), 'Record<string, number>');
  assert.equal(back('a React.ChangeEvent of an HTMLInputElement'), 'React.ChangeEvent<HTMLInputElement>');
  assert.equal(back('a tool using id (text), done (true or false) giving back nothing'), '(id: string, done: boolean) => void');
  assert.equal(back('"a" or "b"'), '"a" | "b"');
  // what isn't a type is a problem on the line, never a guess
  const e = [];
  assert.equal(TS.typeTs('a big list', 'arg', e), null);
  assert.equal(e.length, 1);
  assert.match(errs(ts('set x (a whatsit thing) to 1')).join(), /I don't know the type "a whatsit thing"/);
  assert.match(errs(ts('set x to 1\nset x (a number) to 2')).join(), /already exists here/);
  assert.match(errs(ts('define f using a (text, if any) = 1')).join(), /can't also be "if any"/);
  // a JavaScript file has no types
  assert.match(errs(TS.compileTs({ id: 'x', file: 'mechanics', text: 'define f using a (a number)' }, null, { lang: 'js' })).join(), /Types are TypeScript/);
});

test('TypeScript: code -> sentences, checked exact', () => {
  exact('ts', 'let total: number = 0;\nconst label: string = "x";\n', /^set total \(a number\) to 0\nconstant label \(text\) is "x"$/m);
  exact('ts', 'export interface Note {\n  readonly id: string;\n  title?: string;\n  tags: string[];\n  owner: User | null;\n}\n', /^define shared shape Note\n    read-only id is text\n    title is text, if any\n    tags is a list of text\n    owner is a User or nothing$/m);
  exact('ts', 'type Filter = "all" | "done";\nexport type P = { a: number };\n', /^define type Filter as "all" or "done"\ndefine shared type P as a shape\n    a is a number$/m);
  exact('ts', 'export function add(a: number, b?: number): number {\n  return a + (b ?? 0);\n}\n', /^define shared add using a \(a number\), b \(a number, if any\) giving back a number$/m);
  exact('ts', 'async function load(): Promise<void> {\n  await save();\n}\n', /^define load giving back a Promise of nothing$/m);
  exact('ts', 'const pick = (e: MouseEvent) => {\n  console.log(e);\n};\n', /^constant pick is a tool using e \(a MouseEvent\)$/m);
  exact('ts', 'const items = data as Note[];\n', /^constant items is data assumed to be a list of Note$/m);
  exact('ts', 'import type { A, B } from "./t";\nimport App, { b as c } from "./App";\nimport * as R from "r";\nimport "./x.css";\n', /^bring in the types A and B from "\.\/t"\nbring in App \(the main part\) and b as c from "\.\/App"\nbring in everything from "r" as R\nbring in "\.\/x\.css"$/m);
  exact('ts', 'export default App;\nexport { a, b };\n', /^share App as the main part\nshare a and b$/m);
  // the JavaScript sentences mean what they always did
  exact('ts', 'let n = 0;\nfor (const x of xs) {\n  n += x;\n}\n', /^set n to 0\nfor each x in xs\n    increase n by x$/m);
  exact('ts', "const s = 'hi';\nconst f = (x) => x * 2;\n", /^constant s is 'hi'\nconstant f is a tool using x giving back x times 2$/m);
});

test('TypeScript: what can\'t be said yet stays exact code, and says so', () => {
  const r = exact('ts', 'function id<T>(x: T): T {\n  return x;\n}\nenum Dir { Up, Down }\nlet v = x satisfies T;\n');
  assert.match(r.text, /^ts: function id<T>\(x: T\): T \{$/m);
  assert.match(r.text, /^ts: enum Dir \{ Up, Down \}$/m);
  // (a value with no words, like JavaScript's, is kept as its code inside the sentence, and checked like the rest)
  assert.match(r.text, /^set v to x satisfies T$/m);
  // x! (TypeScript: it is there, not null or undefined) is "x for sure"
  exact('ts', 'let v = el!;\nrender(document.getElementById("root")!);\n', /^set v to \(el for sure\)\nrun render with \(the element called "root" for sure\)$/m);
});

test('TypeScript: the corpus comes back exactly, with no problems in its sentences', () => {
  for (const f of ['tests/corpus_react/src/types/note.ts', 'tests/corpus_react/src/lib/utils.ts', 'tests/corpus_react/src/lib/notes.ts', 'tests/corpus_react/src/hooks/use-notes.ts', 'tests/corpus_react/src/integrations/supabase/client.ts']) {
    exact('ts', readFileSync(path.join(ROOT, f), 'utf8'));
  }
  const types = exact('ts', readFileSync(path.join(ROOT, 'tests/corpus_react/src/types/note.ts'), 'utf8'));
  assert.equal(types.kept, 0, types.text);
});

/* Unity on a TypeScript file: translate a part, leave it, or edit it, and the code is exact. */
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['lang/languages.js', 'lang/project.js', 'lang/python.js', 'lang/web_write.js', 'lang/ts_write.js', 'lang/unity.js']) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const U = ctx.IntuiUnity, W = { WEB: ctx.IntuiWeb, TS: ctx.IntuiTs, CPP };

test('Unity: a TypeScript file, translated in place and back', async () => {
  const code = ['import type { Note } from "./types";', '', 'export function count(notes: Note[]): number {', '  let n: number = 0;', '  for (const x of notes) {', '    if (x.done) {', '      n += 1;', '    }', '  }', '  return n;', '}', ''].join('\n');
  const lines = code.split('\n');
  const at = U.expand('ts', lines, 2, 2);
  assert.deepEqual({ ...at }, { from: 2, to: 10 });
  const w = await U.toWords('ts', lines, at.from, at.to, (k, s) => convert(k, s));
  assert.equal(w.exact, true, w.reason);
  assert.equal(w.words[0], 'define shared count using notes (a list of Note) giving back a number');
  const said = lines.slice(0, at.from).concat(w.words, lines.slice(at.to + 1));
  const regions = [{ from: at.from, to: at.from + w.words.length - 1, original: w.original, words: w.words, base: w.base }];
  // nobody changed it: exactly the code it was
  const same = U.reRegex('ts', said, regions, 0, W);
  assert.ok(same.ok);
  assert.equal(same.lines.join('\n'), code);
  // a change: written in the file's context, the types kept
  const edited = said.map(l => l.replace('increase n by 1', 'increase n by 2'));
  const back = U.reRegex('ts', edited, regions, 0, W);
  assert.ok(back.ok, JSON.stringify(back.problems));
  assert.equal(back.lines.join('\n'), code.replace('n += 1;', 'n += 2;'));
  // the file as Unity keeps it: exact lines are ts:
  assert.equal(U.toFile('ts', ['let a = 1;', 'set b to 2'], [{ from: 1, to: 1 }]), 'ts: let a = 1;\nset b to 2');
  assert.deepEqual(JSON.parse(JSON.stringify(U.fromFile('tsx', 'tsx: const a = 1;\nset b to 2').lines)), ['const a = 1;', 'set b to 2']);
});

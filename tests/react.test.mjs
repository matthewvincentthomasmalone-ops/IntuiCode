// React (.tsx, and JSX in JavaScript) as sentences: components, props, state, effects, references, and what a
// component shows (JSX), checked exact against the original's syntax tree, the way React reads JSX.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadConverter, ROOT } from './helpers/engine.mjs';

const { convert, TS, CPP, C, env } = await loadConverter();
const plain = (x) => JSON.parse(JSON.stringify(x));
const tsx = (text, lang = 'tsx') => TS.compileTs({ id: 'x', file: 'typescript', text }, null, { lang });
const errs = (r) => plain(r.info.flatMap((inf, i) => inf.errs.map(e => `${i + 1}: ${e}`)));
const exact = (kind, src, re) => {
  const r = convert(kind, src);
  assert.ok(r.ok, r.error);
  assert.equal(r.exact, true, `${r.reason}\n${r.text}`);
  if (re) assert.match(r.text, re);
  assert.deepEqual(errs(tsx(r.text, kind)), [], r.text);
  return r;
};

test('React: a component with props, state, an effect and what it shows', () => {
  const r = tsx([
    'define shared component Counter using label and start = 0 from CounterProps',
    '    keep count (a number), starting at start',
    '    whenever count changes',
    '        run console.log with count',
    '    show:',
    '        a block, styled "flex items-center gap-2"',
    '            a heading saying "{label}: {count}"',
    '            a button saying "Add one", when clicked: change count from c to c plus 1',
    '            only if count is more than 9',
    '                a paragraph saying "That\'s a lot."',
  ].join('\n'));
  assert.deepEqual(errs(r), []);
  assert.equal(r.text, [
    'export function Counter({ label, start = 0 }: CounterProps) {',
    '  const [count, setCount] = useState<number>(start);',
    '  useEffect(() => {',
    '    console.log(count);',
    '  }, [count]);',
    '  return (',
    '    <div className="flex items-center gap-2">',
    '      <h2>{label}: {count}</h2>',
    '      <button onClick={() => setCount((c) => c + 1)}>Add one</button>',
    '      {count > 9 && <p>That\'s a lot.</p>}',
    '    </div>',
    '  );',
    '}',
    '',
  ].join('\n'));
});

test('React: lists, either-or, references, clean-up, worked-out values and taken parts', () => {
  const r = tsx([
    'constant List is a component using items from ListProps',
    '    keep a reference box (to an HTMLDivElement), starting at nothing',
    '    keep open, starting at false, changed with setIsOpen',
    '    take toast from the result of useToast',
    '    constant done is a list of i for each i in items if i.done, worked out again whenever items changes',
    '    when List first appears',
    '        constant timer is the result of setInterval with tick, 1000',
    '        when List goes away, run clearInterval with timer',
    '    show:',
    '        together',
    '            for each item in done, counting with n',
    '                a list item saying {item.title}, keyed by item.id',
    '            if open',
    '                a Dialog, running setIsOpen when open changes',
    '            otherwise',
    '                nothing',
    '            note: the end',
  ].join('\n'));
  assert.deepEqual(errs(r), []);
  assert.equal(r.text, [
    'const List = ({ items }: ListProps) => {',
    '  const box = useRef<HTMLDivElement>(null);',
    '  const [open, setIsOpen] = useState(false);',
    '  const { toast } = useToast();',
    '  const done = useMemo(() => items.filter(i => i.done), [items]);',
    '  useEffect(() => {',
    '    const timer = setInterval(tick, 1000);',
    '    return () => clearInterval(timer);',
    '  }, []);',
    '  return (',
    '    <>',
    '      {done.map((item, n) => <li key={item.id}>{item.title}</li>)}',
    '      {open ? <Dialog onOpenChange={setIsOpen} /> : null}',
    '      {/* the end */}',
    '    </>',
    '  );',
    '};',
    '',
  ].join('\n'));
});

test('React: JSX keeps its spaces the way React reads them', () => {
  const r = tsx(['define component P', '    show:', '        a paragraph', '            "Hello "', '            bold text saying "you"', '            "!"', '            a space', '            {name}'].join('\n'));
  assert.deepEqual(errs(r), []);
  assert.match(r.text, /<p>Hello <b>you<\/b>!\{" "\}\{name\}<\/p>/);
  // characters JSX reads as something else are written as character references
  assert.match(tsx('define component P\n    show:\n        a paragraph saying "1 < 2 & {{x}}"').text, /<p>1 &lt; 2 &amp; &#123;x&#125;<\/p>/);
  // and the converter says them back exactly
  exact('tsx', 'const P = () => <p>Hello <b>you</b>! Tom &amp; Jerry{" "}<i>{name}</i></p>;\n');
  exact('tsx', 'const P = () => (\n  <p>\n    two words\n    on two lines\n  </p>\n);\n', /^    a paragraph saying "two words on two lines"$/m);
});

test('React: what isn\'t right is a problem on the line, never a guess', () => {
  assert.match(errs(tsx('define component A\n    show:\n        a whatsit')).join(), /I don't know "whatsit"/);
  assert.match(errs(tsx('define component A\n    show:\n        a button, when clicked: change nope to 1')).join(), /isn't a state kept here/);
  assert.match(errs(tsx('define component A\n    show:\n        together\n            if x\n                a Y')).join(), /needs an "otherwise"/);
  assert.match(errs(tsx('define component A\n    show:\n        a B\n        a C')).join(), /shows one thing/);
  assert.match(errs(tsx('define component A using {x}')).join(), /isn't a prop's name/);
  assert.match(errs(tsx('show:\n    a B')).join(), /goes inside a component/);
});

test('React: code -> sentences, checked exact', () => {
  exact('tsx', 'export function Card({ title, children }: CardProps) {\n  return (\n    <div className="card">\n      <h2>{title}</h2>\n      {children}\n    </div>\n  );\n}\n',
    /^define shared component Card using title and children from CardProps\n    show:\n        a block, styled "card"\n            a heading saying \{title\}\n            \{children\}$/m);
  exact('tsx', 'export default function App() {\n  const [n, setN] = useState(0);\n  return <button onClick={() => setN(n + 1)}>{n}</button>;\n}\n',
    /^define main component App\n    keep n, starting at 0\n    show:\n        a button saying \{n\}, when clicked: change n to n plus 1$/m);
  exact('tsx', 'const L = ({ notes }: P) => (\n  <ul>\n    {notes.map((note) => (\n      <li key={note.id} onClick={() => pick(note)}>{note.title}</li>\n    ))}\n  </ul>\n);\n',
    /^constant L is a component using notes from P, showing:\n    a list\n        for each note in notes\n            a list item saying \{note\.title\}, keyed by note\.id, when clicked: run pick with note$/m);
  exact('tsx', 'function A() {\n  useEffect(() => {\n    load();\n    return () => {\n      stop();\n    };\n  }, [id]);\n  return null;\n}\n', /^    whenever id changes\n        run load\n        when A goes away\n            run stop$/m);
  exact('tsx', 'const F = () => <Link to="/about" className="underline">About</Link>;\n', /^constant F is a component, showing:\n    a Link to "\/about" saying "About", styled as underlined$/m);
  exact('tsx', 'const F = () => <a href="/">Home</a>;\n', /^    a link to "\/" saying "Home"$/m);
  exact('tsx', 'const F = () => <Input value={v} onChange={(e) => setV(e.target.value)} {...rest} disabled />;\n', /^    an Input, with value \{v\}, when changed with e: run setV with e\.target\.value, with everything in rest, with disabled$/m);
});

test('React: what can\'t be said yet stays exact code inside the sentences', () => {
  const r = exact('tsx', 'function A() {\n  return (\n    <div>\n      <B render={(x) => {\n        return x;\n      }} />\n      <p>ok</p>\n    </div>\n  );\n}\n');
  assert.match(r.text, /^            tsx: <B render=\{\(x\) => \{$/m);
  assert.match(r.text, /^            a paragraph saying "ok"$/m);
});

/* The corpus: an app written the way Lovable writes them (React, TypeScript, Vite, Tailwind, shadcn/ui,
   react-router, TanStack Query, Supabase). Every file comes back exactly. */
const files = (dir) => readdirSync(dir).flatMap(n => { const f = path.join(dir, n); return statSync(f).isDirectory() ? files(f) : /\.tsx?$/.test(n) ? [f] : []; });
for (const [dir, least] of [['tests/corpus_react', 0.95], ['tests/heldout_react', 0.85]]) {
  test(`React: ${dir} comes back exactly, mostly in words`, () => {
    let words = 0, lines = 0;
    for (const f of files(path.join(ROOT, dir))) {
      const r = exact(f.endsWith('.tsx') ? 'tsx' : 'ts', readFileSync(f, 'utf8'));
      words += r.words; lines += r.lines;
    }
    assert.ok(words / lines >= least, `only ${words}/${lines} lines read as sentences`);
  });
}

test('JSX in JavaScript (.jsx, .js) is React too, with js: lines', () => {
  exact('js', 'export function Hello({ name }) {\n  const [n, setN] = useState(0);\n  return <p onClick={() => setN(n + 1)}>Hi {name}</p>;\n}\n', /^define shared component Hello using name\n    keep n, starting at 0\n    show:\n        a paragraph saying "Hi \{name\}", when clicked: change n to n plus 1$/m);
  // a JavaScript file has no types to give
  assert.match(errs(TS.compileTs({ id: 'x', file: 'mechanics', text: 'define component A using b from P' }, null, { lang: 'js' })).join(), /Types are TypeScript/);
});

/* The helpers know the new languages: the Tutor's habits, the glossary, completion and Parts. */
test('Tutor, glossary, completion and Parts know TypeScript and React', () => {
  const h = { console }; h.window = h; vm.createContext(h);
  for (const f of ['lang/tutor.js', 'lang/glossary_terms.js', 'lang/glossary.js', 'lang/complete.js', 'lang/parts.js']) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), h, { filename: f });
  const parse = env().parse;
  const form = readFileSync(path.join(ROOT, 'tests/corpus_react/src/components/NoteForm.tsx'), 'utf8');
  const cards = new Set(plain(h.IntuiTutor.tsStylePoints(parse, form, true, 'tsx').points.map(p => p.card)));
  for (const c of ['interface', 'optional', 'component', 'props', 'state', 'type-annotation', 'class-name', 'jsx-handler', 'export']) assert.ok(cards.has(c), `the Tutor finds ${c}: ${[...cards]}`);
  for (const c of cards) assert.ok(h.IntuiTutor.CARDS.tsx[c], `a card for ${c}`);
  assert.equal(h.IntuiTutor.tsCompare(parse, 'const [n, setN] = useState(0);', 'const [n,setN]=useState( 0 );', 'tsx').same, true);
  assert.equal(h.IntuiTutor.tsCompare(parse, 'let total: number = 0;', 'let total = 0;', 'ts').same, false);
  const terms = plain(h.IntuiGlossary.find('tsx', form).map(e => e.t));
  for (const t of ['useState()', 'className', 'interface']) assert.ok(terms.includes(t), `the glossary finds ${t}: ${terms}`);
  assert.ok(plain(h.IntuiGlossary.find('say', 'keep count, starting at 0\nshow:\n    a block, styled as gap 2', { pack: 'web' }).map(e => e.t)).includes('keep'));
  assert.equal(h.IntuiComplete.complete('tsx', 'const [a, b] = useSt', '', {}).label, 'useState');
  const parts = h.IntuiParts.split('tsx', 'define shape Note\n    id is text\n    title is text\n    done is true or false\n\ndefine component Card using title\n    show:\n        a heading saying {title}\n', 'Card.tsx');
  assert.deepEqual(plain(parts.map(p => p.type)), ['data', 'display']);
});

/* Unity on a .tsx file: a line of what a component shows grows to the whole "show:", and goes back exactly. */
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['lang/languages.js', 'lang/project.js', 'lang/python.js', 'lang/web_write.js', 'lang/ts_write.js', 'lang/unity.js']) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const U = ctx.IntuiUnity, W = { WEB: ctx.IntuiWeb, TS: ctx.IntuiTs, CPP };

test('Unity: a .tsx component, translated in place, edited and put back', async () => {
  const code = readFileSync(path.join(ROOT, 'tests/corpus_react/src/pages/NotFound.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const lines = code.split('\n');
  const h1 = lines.findIndex(l => l.includes('<h1'));
  const at = U.expand('tsx', lines, h1, h1);
  assert.ok(at.from < h1 && /return \($/.test(lines[at.from]), `grew to the return: ${plain(at)}`);
  const all = U.expand('tsx', lines, 3, 3);   // const NotFound = () => {
  const w = await U.toWords('tsx', lines, all.from, all.to, (k, s) => convert(k, s));
  assert.equal(w.exact, true, w.reason);
  const said = lines.slice(0, all.from).concat(w.words, lines.slice(all.to + 1));
  const regions = [{ from: all.from, to: all.from + w.words.length - 1, original: w.original, words: w.words, base: w.base }];
  const same = U.reRegex('tsx', said, regions, 0, W);
  assert.ok(same.ok);
  assert.equal(same.lines.join('\n'), code, 'nobody changed it: exactly as it was');
  const edited = said.map(l => l.replace('"Oops! Page not found"', '"Nothing here"'));
  const back = U.reRegex('tsx', edited, regions, 0, W);
  assert.ok(back.ok, JSON.stringify(back.problems));
  const made = back.lines.join('\n');
  assert.match(made, /<p className="text-xl text-gray-600 mb-4">Nothing here<\/p>/);
  assert.equal(convert('tsx', made).exact, true);
  assert.equal(C.check('tsx', code.replace('Oops! Page not found', 'Nothing here'), made, env()).same, true);
});

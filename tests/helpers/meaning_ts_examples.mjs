// What the TypeScript writer's own words mean (tests/helpers/meaning_ts.mjs). An example is a TypeScript file in
// sentences (a .tsx one with tsx: true), with:
//   given    lines of exact TypeScript first (ts: …)          files   other files it brings things in from: { './types': sentences }
//   accepts  TypeScript lines the checker must take after it   refuses lines it must refuse (the words say they're wrong)
//   holds    for a component: checks in the browser, as JavaScript (document, page.el, page.text, page.logged …)
//   then     what happens after React shows it (await page.click("add"), page.type(…), page.tick(ms))
//   component  the component React shows, when it isn't the file's main part   props  what it's given
//   rendersItself  the file shows its app itself (createRoot … render)
// Every example's code must also check clean. Index entries with no example are in NOT_RUN_TS, with why.

const NOTE = 'define shape Note\n    id is text\n    done is true or false';

export const TS_TYPES = [
  { lines: 'set total (a number) to 0', accepts: ['total = 5;', 'total = total + 0.5;'], refuses: ['total = "5";', 'total = null;'] },
  { lines: 'constant label (text) is "Total"', accepts: ['const s: string = label;'], refuses: ['const n: number = label;', 'label = "x";'] },
  { lines: 'set done (true or false) to no', accepts: ['done = true;'], refuses: ['done = 1;', 'done = "yes";'] },
  { lines: 'set x (anything) to 1', accepts: ['x = "a";', 'x.foo.bar;'] },
  { lines: 'set x (something unknown) to 1', accepts: ['x = "a";'], refuses: ['x.foo;', 'const n: number = x;'] },
  { lines: `${NOTE}\nset notes (a list of Note) to an empty list`, accepts: ['notes.push({ id: "a", done: false });'], refuses: ['notes.push({ id: "a" });', 'notes.push("a");', 'notes = [1];'] },
  { lines: 'set tags (a list of text) to an empty list', accepts: ['tags.push("a");'], refuses: ['tags.push(1);'] },
  { lines: 'set ns (a list of numbers) to an empty list', accepts: ['ns.push(1);'], refuses: ['ns.push("1");'] },
  { lines: 'define shape User\n    name is text\nset user (a User or nothing) to nothing', accepts: ['user = { name: "Ann" };', 'user = null;'], refuses: ['user = 5;', 'user = { name: 1 };', 'user = undefined;'] },   // (TypeScript narrows user to null right after = null, so only what can go in is checked)
  { lines: 'define type Filter as "all" or "done"\nset f (a Filter) to "all"', accepts: ['f = "done";'], refuses: ['f = "some";', 'f = "All";'] },
  { lines: 'define load giving back a Promise of nothing\n    wait for 1', accepts: ['const p: Promise<void> = load();'], refuses: ['const p: Promise<number> = load();', 'const v: void = load();'] },
  { lines: 'set counts (a Record of text and a number) to {}', accepts: ['counts["a"] = 1;'], refuses: ['counts["a"] = "1";', 'counts[1] = true;'] },
  { lines: 'set run (a tool using id (text) giving back nothing) to the result of makeRunner', given: 'declare function makeRunner(): any;', accepts: ['run("a");'], refuses: ['run(1);', 'run();'] },
  { lines: 'define greet using name (text, if any)\n    show "Hi", name', accepts: ['greet();', 'greet("Ann");'], refuses: ['greet(1);', 'greet("a", "b");'] },
  { lines: 'define add using a (a number), b (text, if any) giving back a number\n    give back a', accepts: ['const n: number = add(1);', 'add(1, "b");'], refuses: ['add("1");', 'const s: string = add(1);', 'add();'] },
  { lines: 'define total using inputs (the rest, a list of X) giving back a number\n    give back length of inputs', given: 'type X = number;', accepts: ['total();', 'total(1, 2, 3);'], refuses: ['total("a");'] },
  { lines: 'define shape Card\n    read-only id is text\n    title is text\n    note is text, if any', accepts: ['const c: Card = { id: "1", title: "a" };', 'const d: Card = { id: "1", title: "a", note: "n" };'], refuses: ['const c: Card = { id: "1" };', 'const c: Card = { id: "1", title: "a" }; c.id = "2";', 'const c: Card = { id: 1, title: "a" };'] },
  { lines: 'define shape Base\n    id is text\ndefine shape Named based on Base\n    name is text', accepts: ['const n: Named = { id: "1", name: "a" };', 'const b: Base = n0;'], given: 'declare const n0: { id: string; name: string };', refuses: ['const n: Named = { name: "a" };'] },
  { lines: 'define type Props as a shape\n    title is text\n    count is a number', accepts: ['const p: Props = { title: "a", count: 1 };'], refuses: ['const p: Props = { title: "a" };'] },
  { lines: `${NOTE}\nset data (something unknown) to {}\nset note to data assumed to be a Note`, accepts: ['const id: string = note.id;'] },
  { lines: 'set el to the result of document.getElementById with "x"\nset box to (el for sure)', accepts: ['box.textContent = "a";'], refuses: ['el.textContent = "a";'] },
  { lines: 'constant handle is a tool using e (a React.FormEvent)\n    run e.preventDefault', given: 'import type * as React from "react";', accepts: ['handle({} as React.FormEvent);'], refuses: ['handle("a");'] },
  { lines: 'constant double is a tool using n (a number) giving back n times 2', accepts: ['const m: number = double(2);'], refuses: ['double("2");'] },
];

/* ---- The parts a file shares, and bring in ---- */

export const TS_FILES = [
  { lines: 'bring in formatDate from "./dates"\nset s to the result of formatDate with "2026-11-16"', files: { './dates': 'define shared formatDate using iso (text)\n    give back iso' }, accepts: ['const t: string = s;'], refuses: ['formatDate(1);'] },
  { lines: 'bring in App (the main part) from "./App"\nset a to App', files: { './App': 'define main App giving back a number\n    give back 1' }, accepts: ['const n: number = a();'] },
  { lines: 'bring in the type Note from "./types"\nset n (a Note) to { id: "1", done: no }', files: { './types': `define shared shape Note\n    id is text\n    done is true or false` }, refuses: ['const m: Note = { id: 1, done: false };'] },
  { lines: 'bring in everything from "./maths" as M\nset n to the result of M.twice with 2', files: { './maths': 'define shared twice using n (a number) giving back a number\n    give back n times 2' }, accepts: ['const m: number = n;'] },
  { lines: 'bring in twice as double from "./maths"\nset n to the result of double with 2', files: { './maths': 'define shared twice using n (a number) giving back a number\n    give back n times 2' }, accepts: ['const m: number = n;'], refuses: ['twice(2);'] },
  { lines: 'bring in a and b from "./ab"\nset n to a plus b', files: { './ab': 'set a (a number) to 1\nset b (a number) to 2\nshare a and b' }, accepts: ['const m: number = n;'] },
  { lines: 'bring in Thing (the main part) from "./thing"\nset n to the result of Thing', files: { './thing': 'define Thing giving back a number\n    give back 1\nshare Thing as the main part' }, accepts: ['const m: number = n;'] },
  { lines: 'bring in LIMIT from "./limits"\nset n to LIMIT', files: { './limits': 'shared constant LIMIT (a number) is 10' }, accepts: ['const m: number = n;'], refuses: ['const s: string = n;'] },
];

/* ---- React components, in the browser ---- */

const R = 'bring in everything from "react" as React\nbring in useState, useEffect, useRef and useMemo from "react"';
const app = (body) => `${R}\ndefine main component App\n${body.split('\n').map(l => '    ' + l).join('\n')}`;

export const TS_REACT = [
  { tsx: true, lines: app('show:\n    a heading saying "Hi"'), holds: 'document.querySelector("#root h2").textContent === "Hi"' },
  { tsx: true, lines: app('keep count, starting at 0\nshow:\n    a block\n        a paragraph saying "Count {count}", with id "n"\n        a button saying "Add", with id "add", when clicked: change count to count plus 1'),
    then: 'await page.click("add"); await page.click("add");', holds: 'page.text("n") === "Count 2"' },
  { tsx: true, lines: app('keep count, starting at 0\nconstant bump is a tool\n    change count from c to c plus 1\n    change count from c to c plus 1\nshow:\n    a block\n        a paragraph saying "{count}", with id "n"\n        a button saying "Add", with id "add", running bump when clicked'),
    then: 'await page.click("add");', holds: 'page.text("n") === "2"' },   // (from its value at the time: both changes count)
  { tsx: true, lines: app('keep count, starting at 0\nconstant bump is a tool\n    change count to count plus 1\n    change count to count plus 1\nshow:\n    a block\n        a paragraph saying "{count}", with id "n"\n        a button saying "Add", with id "add", running bump when clicked'),
    then: 'await page.click("add");', holds: 'page.text("n") === "1"' },   // (both from the value when it was shown: React's meaning, and the words')
  { tsx: true, lines: app('keep open (true or false), starting at false\nshow:\n    a block\n        a button saying "Open", with id "b", when clicked: change open to true\n        only if open\n            a paragraph saying "Now open", with id "p"'),
    then: 'window.before = !!document.getElementById("p"); await page.click("b");', holds: ['before === false', 'page.text("p") === "Now open"'] },
  { tsx: true, lines: app('keep done (true or false), starting at true\nshow:\n    a block\n        if done\n            a paragraph saying "Done", with id "p"\n        otherwise\n            a paragraph saying "Not yet", with id "p"'), holds: 'page.text("p") === "Done"' },
  { tsx: true, lines: app('keep done (true or false), starting at false\nshow:\n    a block, with id "b"\n        if done\n            a paragraph saying "Done", with id "p"\n        otherwise\n            nothing'), holds: '!document.getElementById("p") && page.el("b").innerHTML === ""' },
  { tsx: true, lines: `${R}\nconstant Index is a component\n    keep n, starting at 3\n    show:\n        a paragraph saying "{n}", with id "p"\ndefine main component App\n    show:\n        an Index`, holds: 'page.text("p") === "3"' },
  { tsx: true, lines: app('constant notes is [{ id: 1, text: "a" }, { id: 2, text: "b" }, { id: 3, text: "c" }]\nshow:\n    a list\n        for each note in notes\n            a list item saying "{note.text}", keyed by note.id'), holds: '[...document.querySelectorAll("li")].map(l => l.textContent).join() === "a,b,c"' },
  { tsx: true, lines: app('constant notes is ["a", "b"]\nshow:\n    a list\n        for each note in notes, counting with i\n            a list item saying "{i}: {note}", keyed by i'), holds: '[...document.querySelectorAll("li")].map(l => l.textContent).join() === "0: a,1: b"' },
  { tsx: true, lines: app('show:\n    together\n        a heading saying "A"\n        a paragraph saying "B"'), holds: 'document.getElementById("root").innerHTML === "<h2>A</h2><p>B</p>"' },
  { tsx: true, lines: app('constant name is "Ann"\nshow:\n    a paragraph, with id "p"\n        "Hi"\n        a space\n        {name}'), holds: 'page.text("p") === "Hi Ann"' },
  { tsx: true, lines: app('keep title, starting at ""\nshow:\n    a block\n        an input, with id "t", with value {title}, when changed with e: change title to e.target.value\n        a paragraph saying "{title}", with id "p"'),
    then: 'await page.type("t", "Tea");', holds: 'page.text("p") === "Tea"' },
  { tsx: true, lines: app('keep count, starting at 0\nwhen App first appears\n    show "appeared"\nwhenever count changes\n    show "count is", count\nshow:\n    a button saying "Add", with id "add", when clicked: change count to count plus 1'),
    then: 'await page.click("add");', holds: 'JSON.stringify(page.logged.filter(l => !/^Warning/.test(l))) === JSON.stringify(["appeared", "count is 0", "count is 1"]) || JSON.stringify(page.logged) === JSON.stringify(["appeared", "count is 0", "count is 1"])' },
  { tsx: true, lines: `${R}\ndefine component Ticker\n    keep ticks, starting at 0\n    when Ticker first appears\n        every 1 second as timer\n            change ticks from t to t plus 1\n        when Ticker goes away\n            js: clearInterval(timer);\n    show:\n        a paragraph saying "{ticks}", with id "p"\ndefine main component App\n    keep on (true or false), starting at true\n    show:\n        a block\n            only if on\n                a Ticker\n            a button saying "Stop", with id "b", when clicked: change on to false`,
    then: 'await page.tick(3000); window.shown = page.text("p"); await page.click("b"); window.left = page.timers.filter(t => !t.gone).length;', holds: ['shown === "3"', 'left === 0'] },
  { tsx: true, lines: app('keep a reference box (to an HTMLDivElement), starting at nothing\nkeep seen, starting at ""\nwhen App first appears\n    change seen to box.current?.id ?? "none"\nshow:\n    a block\n        a block, with id "inner", with ref {box}\n        a paragraph saying "{seen}", with id "p"'), holds: 'page.text("p") === "inner"' },
  { tsx: true, lines: app('keep n, starting at 1\nconstant twice is n times 2, worked out again whenever n changes\nshow:\n    a block\n        a paragraph saying "{twice}", with id "p"\n        a button saying "+", with id "b", when clicked: change n to n plus 1'), then: 'await page.click("b");', holds: 'page.text("p") === "4"' },
  { tsx: true, given: 'type CardProps = { title: string; children?: React.ReactNode };', lines: `${R}\ndefine component Card using title and children from CardProps\n    show:\n        a section\n            a heading saying "{title}"\n            {children}\ndefine main component App\n    show:\n        a Card, with title "Hello"\n            a paragraph saying "inside"`,
    holds: 'document.querySelector("section h2").textContent === "Hello" && document.querySelector("section p").textContent === "inside"', refuses: ['const c = <Card />;'] },
  { tsx: true, lines: `${R}\nconstant Badge is a component, showing:\n    a block saying "new", with id "badge"\ndefine main component App\n    show:\n        a Badge`, holds: 'page.text("badge") === "new"' },
  { tsx: true, lines: app('constant props is { id: "x", title: "tip" }\nshow:\n    a block saying "hi", with everything in props'), holds: 'page.el("x").title === "tip"' },
  { tsx: true, lines: app('show:\n    a block saying "hi", with id "b", styled as flexible layout, items centred, gap 2'), holds: 'page.el("b").className === "flex items-center gap-2"' },
  { tsx: true, given: 'function Button(props: { variant?: string; children?: React.ReactNode; onClick?: () => void; id?: string }) { return <button id={props.id} data-variant={props.variant} onClick={props.onClick}>{props.children}</button>; }',
    lines: app('keep n, starting at 0\nconstant save is a tool\n    change n to n plus 1\nshow:\n    a block\n        a ghost Button saying "Save", with id "s", running save when clicked\n        a paragraph saying "{n}", with id "p"'), then: 'await page.click("s");', holds: ['page.el("s").dataset.variant === "ghost"', 'page.text("p") === "1"'] },
  { tsx: true, given: 'const useToast = () => ({ toast: (m: string) => console.log("toast: " + m) });', lines: app('take toast from the result of useToast\nwhen App first appears\n    run toast with "hi"\nshow:\n    nothing'), holds: 'page.logged.includes("toast: hi")' },
  { tsx: true, rendersItself: true, lines: `${R}\nbring in createRoot from "react-dom/client"\ndefine component Intro\n    show:\n        a paragraph saying "hello", with id "p"\nshow an Intro in (the element called "root" for sure)`, holds: 'page.text("p") === "hello"' },
];

/* ---- The packs (other libraries' sentences): checked by the code they write and by the checker, with
   stand-ins for the libraries (what each is asked is recorded) ---- */

const SUPA = 'type Query = { select(s: string): Query; order(c: string, o: { ascending: boolean }): Query; eq(c: string, v: unknown): Query; limit(n: number): Query; single(): Query; insert(v: unknown): Query; update(v: unknown): Query; delete(): Query };\ndeclare const supabase: { from(t: string): Query };';
export const TS_PACKS = [
  { lines: 'set q to every row of the "notes" table in supabase sorted by "created_at" from the end', given: SUPA, accepts: ['const r: Query = q;'], code: /supabase\.from\("notes"\)\.select\("\*"\)\.order\("created_at", \{ ascending: false \}\)/ },
  { lines: 'define fail using error (an Error)\n    fail with error as it is', accepts: ['fail(new Error("x"));'], refuses: ['fail("x");'] },
  { lines: 'define load giving back a Promise of nothing\n    wait for (the result of fetch with "/x"), and take ok and status from it', accepts: ['load();'] },
];

/* TanStack Query, run by the library itself in the browser (queryClient: the app is given a client, as its main
   file would give it). The notes are a list the example keeps, so what was loaded and changed can be checked. */
const RQ = `${R}\nbring in useQuery, useMutation and useQueryClient from "@tanstack/react-query"`;
const NOTES = 'const notes: string[] = ["a"];\nconst fetchNotes = async () => notes.join();\nconst addNote = async () => { notes.push("b"); };';
const useNotes = 'define useNotes\n    give back the query ["notes"] loaded by fetchNotes';
export const TS_QUERY = [
  { tsx: true, queryClient: true, given: NOTES, lines: `${RQ}\n${useNotes}\ndefine main component App\n    take data from the result of useNotes\n    show:\n        a paragraph saying "{data}", with id "p"`,
    then: 'await page.tick(10);', holds: 'page.text("p") === "a"', accepts: ['const q = useNotes(); const s: string | undefined = q.data;'], refuses: ['const n: number | undefined = useNotes().data;'] },
  { tsx: true, queryClient: true, given: NOTES, lines: `${RQ}\n${useNotes}\ndefine useAdd\n    constant queryClient is the result of useQueryClient\n    give back a change made by addNote\n        when it works\n            mark the query ["notes"] in queryClient as out of date\n` +
      'define main component App\n    take data from the result of useNotes\n    take mutate from the result of useAdd\n    constant add is a tool\n        run mutate\n    show:\n        a block\n            a paragraph saying "{data}", with id "p"\n            a button saying "add", with id "add", running add when clicked',
    then: 'await page.tick(10);\nawait page.click("add");\nawait page.tick(10);', holds: 'page.text("p") === "a,b"' },
  // (without "mark the query …", the list it shows is the one it loaded first)
  { tsx: true, queryClient: true, given: NOTES, lines: `${RQ}\n${useNotes}\ndefine useAdd\n    give back a change made by addNote\n        when it works, run console.log with "added"\n` +
      'define main component App\n    take data from the result of useNotes\n    take mutate from the result of useAdd\n    constant add is a tool\n        run mutate\n    show:\n        a block\n            a paragraph saying "{data}", with id "p"\n            a button saying "add", with id "add", running add when clicked',
    then: 'await page.tick(10);\nawait page.click("add");\nawait page.tick(10);', holds: ['page.text("p") === "a"', 'page.logged.includes("added")'] },
];

export const NOT_RUN_TS = {
  'a Route for': 'needs react-router, which the tests don\'t have',
  'when open changes → onOpenChange': 'a shadcn/ui dialog\'s event, which needs shadcn/ui',
};

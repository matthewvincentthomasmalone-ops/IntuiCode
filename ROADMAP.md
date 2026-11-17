# IntuaCode roadmap

IntuaCode translates between plain, structured sentences and real code, in both
directions, using rules rather than AI. This file records where it is going and why.

## Principles

- **Deterministic and verifiable.** The same input always gives the same output. Every
  summary points at real lines. Converting code to sentences is checked to rebuild
  exactly the same program.
- **Never silently change code.** Anything that can't be said in words stays as exact
  code (`python:` lines).
- **Stay connected to the real code.** The real language is always visible next to the
  sentences, so what people learn transfers.
- **Natural phrasing is never penalised.** Filler words are left out and shown faded.

## Steps

| # | Step | Status |
|---|------|--------|
| 1 | Foundation: tests, CI, a corpus and a sentence-coverage metric, architecture decisions | done |
| 2 | Grow Python sentences: dictionaries, files, errors, `with`, classes, method calls, library phrase packs, keep comments | done |
| 3 | The web set: HTML, CSS and JavaScript in Read and Write modes, website template with live preview, front end ↔ back end links | done (see below) |
| 4 | Desktop app (Tauri): real files, real Python, Git; installers for Windows, macOS and Linux built by GitHub | done |
| 5 | C++: Read mode first, then Write basics; compile with the local toolchain in the desktop app | done (first version) |
| 6 | Everything into sentences: HTML, CSS, JavaScript, C++ and Arduino → sentences with exactness checks; C++ classes; Arduino in Write mode; Visual Studio's compiler; tests of the real desktop app | done |
| 7 | Tutor and style tour (Python): tip balloons on a language's habits, "Your turn" lines checked exactly, notes that fade as you learn, and a style tour of any file | done (Python, C++ and Arduino; HTML, CSS and JavaScript next) |
| 8 | Project builder: questions that narrow a project down (App › PC › DAW…), components you tick, and a project map of ordered steps, each marked Walk, Hallway or Horizon | done (Python, website and Arduino kits, with hallway steps in each; the templates can be edited in the app) |
| 9 | A toolkit: projects as file trees in many languages (Markdown, data and 30+ languages as code beside the sentence languages), the Library of parts and kinds of project with Coding integration, steps added by hand to the project map, Read mode for every installed grammar, and a writer audit that refuses two-reading English instead of guessing | done (2026-11-04) |
| 10 | Unity mode: the project in one pane (the same files as Write, the Library included); select a region and **Translate to Plain Language Syntax** it into sentences in place (shown dark green), edit it, and **Original Code** puts it back into the code | done (first version: the six sentence languages) |
| 11 | Unity first, Split Mode beside it (Read mode folded in: imported code becomes the project's files); parts by type (Interface & Display, Backend & Mechanics, Setup & Settings, Data & Notes) and by language, with two buttons that show one side of the project; Project Link: the code behind what's in use in the preview, in pink; Predictive Mode in Unity and from the Library | done (first version) |
| 12 | React and TypeScript as sentence languages: `.ts`, `.tsx` (and React in `.jsx`/`.js`) translatable in Unity and editable in Split Mode, checked exact with types counted; components, state, effects and JSX in words; the Lovable stack (Tailwind, shadcn/ui, react-router, TanStack Query, Supabase) as phrase packs | done (first version, 2026-11-10) |
| 13 | Running React: a Vite app's folder opens in place, and Run starts its own dev server in the desktop Preview, with hot reload; other sites it contacts are listed | done (first version, 2026-11-10; desktop app only) |
| 14 | INTENT.md: what you meant, in plain sentences, checked against the code after every change (never stored as kept); parts marked as yours, flagged when changed outside IntuaCode, kept or put back; steps on the map that check themselves, and the parts no step covers; Hand to my AI asks the AI to keep it true | done (first version, 2026-11-16) |
| 15 | Words that mean what they say: an example of each Python value word runs on real values and must give what the words say; known wrong translations warn on their line; Unity shows each translated part's check (✓ exact) | done for Python's value words (2026-11-16), Python's statements and JavaScript's Mechanics (2026-11-17), C++ and Arduino (compiled and run), JavaScript in a real browser, and HTML and CSS (in Chrome) (2026-11-16), TypeScript's own words (types by its checker, components by React) (2026-11-17) |

The direction, since step 7: IntuaCode is for people who build ambitious things with help (often
AI's) and want to stay the author: to understand their project at any stage, change it themselves,
and learn to think in each language's style as they go. The tutor teaches that style; the project
builder is a horizon to aim for, and for the hardest parts, a hallway.

### Step 3 notes

- Read mode: JavaScript (with React and TypeScript), HTML and CSS are read with tree-sitter.
  Links: pages → their CSS and JS; scripts → page elements; CSS → elements; `fetch` → the
  Python (Flask/FastAPI, including Blueprint prefixes) or Express route that answers it.
- Write mode: website projects (Structure / Styling / Mechanics), live preview, Pick,
  console and error forwarding to the terminal.
- Converting existing JavaScript, HTML and CSS into sentences came in step 6.

### Step 5 notes

- Read: C++ programs, headers and Arduino sketches (sections, types, references, memory and
  safety warnings, Arduino steps in plain words, links from files to the headers they include).
- Write: the core sentences produce C++20 with worked-out types and small helpers for random
  numbers and text with values. The desktop app compiles with g++/clang++ and maps compiler
  errors back to sentences.
- C++ classes, Arduino in Write mode and converting existing C++ came in step 6.

### Step 6 notes

- `lang/convert.js` turns HTML, CSS, JavaScript, C++ and Arduino code into sentences. Each
  statement, element or rule is said in words where a sentence fits; the sentences are then
  translated back and the syntax trees compared with the original. Anything that comes back
  different is kept as exact code (`html:`, `css:`, `js:`, `c++:`, `above main:`, `head:`)
  and the check runs again, so the result is exact or says why not. Declarations try a more
  careful sentence with the type spelled out before falling back to code.
- Counted as the same, only where it can't change what the code does (since the 2026-09-30
  audit, which found `let`/`const` and `x++`/`x += 1` on this list although they behave
  differently):
  - JavaScript: `x++;` and `++x;` as whole statements, one-line bodies and braces, brackets
    that don't change the meaning, `'x'` and `"x"` when there is no quote or `\` inside (as
    Python's `ast` counts them), a comma after the last item (`[1, 2,]`; not a hole, `[1, ,]`),
    `(x) =>` and `x =>`, and a `break;` that ends a switch's last case.
  - C++: one-line bodies and braces, `std::` where `using namespace std` applies, main's final
    `return 0`, extra `#include`s, `main` moved to the end, a `break;` that ends a switch's last
    case (it jumps to where the switch ends anyway), and `++i` / `i++` as the step of a `for` that
    makes its own `int i` (nothing uses the value; on anything else, a class can make them differ).
  - HTML: attribute order, whitespace a browser doesn't show (every space counts in `<pre>`,
    `<textarea>`, scripts and styles, and between inline elements), a button's `type` outside
    a form, `<input>`'s default `type="text"`, and the page's own `style.css`/`script.js`
    tags when those files are empty. The doctype, all `<html>` attributes, the charset and
    viewport settings and the order of the head are compared.
  - CSS: spaces outside quotes. Numbers, colours and quoted text are compared.
  - Python: the syntax tree, docstrings included (they become `description:` sentences).
  - `tests/convert.test.mjs` lists pairs that must be reported as different, so a checker that
    looks away fails the tests.
- Test corpus (`tests/corpus_web/`): a landing page, its CSS and script, a C++ program with a
  class and an Arduino sketch: all exact; 83% of HTML lines, 73% of CSS lines and 100% of the
  JavaScript, C++ and Arduino lines read as sentences. Code made from every blueprint comes
  back exactly.
- C++: classes (fields, "when made" constructors, tools, private parts, "based on"), typed
  tools and values, constants, `include`, `use namespace std`, "followed by" for output.
- Arduino: setup/loop, pins, analog levels, waiting, tones, the serial monitor, fixed-size lists.
  The desktop app checks sketches with arduino-cli, uploads to a connected board and opens the
  serial monitor.
- Desktop: Visual Studio's `cl` (found with vswhere) on Windows; MSVC error messages map to
  sentences like g++'s. Tests drive the real app on Linux and Windows in GitHub Actions.

### Step 12 notes

- `lang/ts_write.js` is a dialect of the JavaScript writer (its `ext` hook); `lang/ts_convert.js` of the
  JavaScript reader. Every Mechanics sentence means the same in TypeScript. Exact lines are `ts:` and `tsx:`.
- Counted as the same, on top of JavaScript's: `(x) =>` and `x =>` for an input with no type, default or `?`;
  `;` and `,` between a shape's parts; JSX as React reads it (texts as JSX keeps them, character references
  read, `<X></X>` and `<X />`). Everything else counts: types, generics, `as`, `!`, `?`, `readonly`,
  `import type`, `export`, the order of props, `{" "}` against a space. The must-differ pairs in
  `tests/convert.test.mjs` cover each.
- Still exact code (said as code inside a sentence, or kept as `ts:`/`tsx:` lines): generic functions, enums,
  method and index signatures, a props type written inline (`{ children }: { children: ReactNode }`),
  `createContext<T>(…)`, `useCallback`, a `useMemo` or `useState` with a function, a handler with several steps
  written in place, an element as a prop's value (other than a Route's), `a?.b()` calls.
- Corpus (`tests/corpus_react/`, a Lovable-style notes app) and a held-out set (`tests/heldout_react/`, written after
  the rules): see the table below. `tests/react-packs.test.mjs` takes the corpus through Unity as a project: every
  file translated, put back byte for byte, and an edit written in its file's context and checked exact.
- Layout (2026-11-10): written back from its sentences, a file is the same file, not just the same program. One line
  of sentences is one line of code: blank lines (after a block's `}` too), `if error, fail with error as it is`
  (`if (error) throw error;`), `show: …` on one line (`return <p>…</p>;`), an element's text or settings on lines of
  their own, a query with `loaded by …` under it (`useQuery({` one part per line). Where the sentences can't say
  it, TypeScript is written as Prettier writes it (`(n) =>`, no brackets a value doesn't need). Byte for byte: 11 of
  13 corpus files and 4 of 8 held-out ones (1 of 21 before); the rest say which lines and why (`layout` in the
  converter's result, shown by Translate). `tests/react-packs.test.mjs` checks both.
- Layout, the shapes Lovable writes most (2026-11-10): `bring in from "…":` with a name a line under it (`import {`
  one name per line), `… with:` with a call's inputs or a record's parts (`title: "Saved"`) a line each under it
  (`… and:` for a record after other inputs: `fetch(url, {`), and a Supabase query with its parts after the table
  on lines under it (one call per line). Byte for byte: 13 of 13 corpus files and 6 of 8 held-out ones (19 of 21);
  left: text and an element sharing a line between tags (Dashboard, Login).

### Step 15 notes

- Until now the evidence was the round trip: sentences rebuild the same syntax tree. That proves nothing was
  dropped or added, but not that the words are true. A rule pair that said `a - b` as "a plus b" and read it
  back as `a - b` would pass.
- `tests/meaning.test.mjs` runs an example of each of the Python writer's value words (`EXPR_RULES`) with
  the local Python and checks the result against the value the words say, worked out by hand
  (`tests/helpers/meaning_python.mjs`, 119 examples). Every rule needs an example or a reason; a run with four
  rules made wrong on purpose checks the examples notice.
- Statements (2026-11-17): 90 more examples, each a few lines of sentences run as a program, checked for the
  values left in names, what's shown, and the error it stops with ("ask" gets set answers, "wait" is noted, not
  waited). 70 of 73 statements have one; the three without need Flask, FastAPI or a window. A loop that doesn't
  end fails its example instead of hanging the tests. Making statements do each other's work found one gap,
  closed with an example: "otherwise if" written as a plain "if" passed when only one condition was true.
- JavaScript (2026-11-17): 161 examples of a website's Mechanics, run in Node on a stand-in page
  (`tests/helpers/page.mjs`: elements, events, the browser's memory, `fetch` with set replies, timers moved on by
  hand, a canvas pen and sound that note their calls). The JavaScript writer's rules are written in place, so its
  Index is what's counted: 74 of 75 Mechanics sentences and all 52 value words have an example (the one without
  brings in another file). Making its words for comparisons and maths wrong one at a time: 20 of 20 caught, after
  three examples were added for edges the first set missed ("is at least" above the edge, "is not nothing", "is
  empty" after brackets).
- Known wrong translations now warn on their line where the writer can tell: Python's `is` written as Python,
  and a `fetch` or `send` at the left edge of a page's classic script. The test checks each row its example in
  `INTUICODE.md` shows.
- Unity: each part Translate makes keeps what the check found and shows it on the part (✓ exact, ≠ not exact,
  ✎ edited since) and in the help under it, not only in the terminal.
- C++ and Arduino: 207 examples compiled and run (g++, or Visual Studio's compiler), sketches on a stand-in
  board. Every program and sketch entry in the Index has one; 16 of 16 wrong words are caught. They found and
  fixed four writer bugs: "set b to n is even" made an int, `"42" as number` and `length of "abc"` didn't
  translate or build, and `"42" as number` on a board didn't build.
- In a sketch, a name `pin` (a field, `self.pin`, "set pin to 9") is a name again, not the pin phrase, when a
  word for maths or a comparison follows it, or a `.` comes before it. "give back pin times 2" was `return * 2`,
  and "self.pin is 9" was `this->== 9`. "set pin to 9" at the left edge was refused. "pin 13", "pin LED" and
  "turn pin pin on" are still pins (2026-11-17).
- In a real browser (Chrome or Edge, through its DevTools protocol, nothing installed): the 161 JavaScript
  examples again, with Chrome's own input, network and dialogs, and 81 Structure and Styling examples checked
  by what Chrome makes of them. Every Structure and Styling entry in the Index has one.
- TypeScript's own words: 58 examples. Types are checked by TypeScript's own checker, and components are run by
  React in Chrome. 34 of 38 Index sentences and 25 of 26 words have one; the 5 without need react-router,
  TanStack Query or shadcn/ui. 7 of 7 wrong type words are caught. The owner approved five development packages
  for this (2026-11-17): `typescript`, `react`, `react-dom`, `@types/react`, `@types/react-dom`. They're for the
  tests only and aren't shipped.
- JavaScript's rules are in tables (2026-11-17), as Python's are: 48 value words, 20 words for comparisons and
  maths, and 86 statements, each named. The code they write is the same as before. They're now counted one by one
  (all value words and words, and 84 of 86 statements, have an example), and 128 of 128 rules made to do another's
  work are caught. Counting by rule found 32 rules the Index doesn't list with no example; each has one now.
- Still not proven: other libraries' React sentences, other browsers, a real board, values beyond the
  examples', and rules combined in longer values or blocks. See
  [What the words mean](INTUICODE.md#what-the-words-mean).

## What could come next

- Running a React app in the browser version (it can't start a dev server): a bundler in the page, a new
  dependency and a decision for the owner.
- Translated React keeps its layout: today a multi-line call (`useQuery({ … })`) comes back on one line, and
  blank lines between components are dropped (the same program, checked exact, laid out differently).

- More of the web into words: forms with names, `hidden` elements, listeners on saved
  elements (`const form = …; form.addEventListener`), multi-file C++ projects with headers.
- Code signing, so Windows and macOS don't warn when installing.
- A proper grammar for sentences, if rule collisions keep appearing (see Known risks).

## The number we track

`npm run coverage` reports, for the corpus in `samples/` and `tests/corpus/` (and, for TypeScript and React,
`tests/corpus_react/` and `tests/heldout_react/`):

- **in words**: the share of statements (excluding imports) that read as sentences rather
  than `python:` lines;
- **exact**: files whose sentences rebuild exactly the same program. This must always be all of them.

`npm run meaning` reports a second number: how many of the Python writer's value words and statements, and of
the JavaScript writer's Index entries for Mechanics, have an example that runs and gives what the words say (and
how many of the rules the reader's sentences use for the corpus do).
`npm run meaning -- --mutate` also checks the examples notice each rule made wrong.

| Date | Rules with an example that runs | Used reading the corpus | Wrong rules caught |
|------|---------------------------------|-------------------------|--------------------|
| 2026-11-16 value words | 87/89 (the two without need Flask) | 44/46 | 80/82 |
| 2026-11-17 statements too (value words / statements) | 87/89 / 70/73 (the five without need Flask, FastAPI or a window) | 44/46 / 44/47 | 80/82 / 67/69 |
| 2026-11-17 JavaScript's Mechanics, by its Index (sentences / value words) | 74/75 / 52/52 (the one without brings in another file) | 19/19 (`tests/corpus_web`) | 20/20 of its words for comparisons and maths |

`tests/heldout/` holds programs written *after* the rules, to measure fairly. Once a
held-out file has been used to fix something, it counts as seen; add new unseen files
before each measurement.

| Date | Corpus in words | Exact | Held-out in words | Exact |
|------|-----------------|-------|-------------------|-------|
| 2026-09-29 baseline | 43% (130/304) | 18/18 | – | – |
| 2026-09-29 after step 2 | 98% (297/304) | 18/18 | 87% on first sight, one exactness bug found; 96% after fixes | 5/5 |
| 2026-09-30 after the audit (docstrings now count as statements) | 98% (306/313) | 18/18 | 96% (120/125) | 5/5 |
| 2026-11-10 TypeScript and React (`tests/corpus_react`, `tests/heldout_react`) | 99% (197/199) | 13/13 | 89% (219/247) on first sight; 89% (220/247) after one fix | 8/8 |
| 2026-11-10 React layout kept (lines said one part per line count too; the same 2 and 27 stay code) | 99% (213/215) | 13/13 | 89% (224/251) | 8/8 |
| 2026-11-10 more layouts: inputs, records, query parts a line each (names under `bring in from` not counted, as imports aren't; the same 2 and 27 stay code) | 99% (216/218) | 13/13 | 89% (227/254) | 8/8 |

The app has a safety net: if converting a file to sentences ever isn't exact, the
statements that differ are kept as `python:` lines automatically and the check runs again.

## Known risks (from the design audit)

1. **Rule collisions.** Regex rules interact as they grow. Mitigation: the test suite and
   round-trip corpus run on every push; move to a proper grammar if collisions keep appearing.
2. **Library long tail.** Real code is mostly library calls. Mitigation: phrase packs for the
   libraries AI tools use most, shared by Write and Read modes.
3. **Summaries say what, not why.** Rules can't infer business intent. Positioning:
   IntuaCode is the verifiable layer. Any AI features must be opt-in and labelled as guesses.
4. **The "new language" trap.** Sentences can become a dialect of their own. Mitigation:
   real code always visible; sentences can be faded out as people learn.
5. **Language differences.** HTML and CSS fit sentences well; JavaScript in practice means
   React/TypeScript (sentences since step 12); C++ is hardest and is scheduled last.
6. **Browser limits.** No real servers, packages or file system. Mitigation: the desktop app (step 4).
7. **Words that are wrong both ways.** A rule pair that says the wrong words and reads them back to the same
   code passes the round trip. Mitigation: examples that run (step 15), so far for Python's value words and statements and JavaScript's Mechanics.

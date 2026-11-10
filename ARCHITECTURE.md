# Architecture

## Engine and shell

The **engine** knows languages and has no user interface. The **shell** is the user
interface. The same engine is used by the web page, the tests (Node and Python), and
the desktop app.

| Engine file | Job |
|---|---|
| `lang/python.js` | Sentences → Python |
| `lang/python_reader.py` | Python → sections, summaries, sentences (checked exact) |
| `lang/web_write.js` | Sentences → HTML, CSS and JavaScript (website projects); the preview document |
| `lang/web_read.js` | JavaScript / React / TypeScript, HTML, CSS and C++ → sections, summaries, links; loads any tree-sitter grammar named in `lang/languages.js` |
| `lang/code_read.js` | Reading every other language: which language a file (or pasted code) is in, and sections, summaries, facts, warnings and steps for it |
| `lang/languages.js` | The languages a project's files can be in: names, file endings, grammars |
| `lang/project.js` | A project as a tree of files: paths checked, each engine compiling its own files (`compileAll`), Markdown, CSV and JSON shown as what they are |
| `lang/unity.js` | Unity mode: a project file shown line for line (exact lines as code, sentences as regions) and written back; a selection grown to whole statements, turned into sentences in place, and back into code in the context of the code around it (the rest given to the writer as exact lines) |
| `lang/cpp_write.js` | Sentences → C++ and Arduino sketches |
| `lang/convert.js` | HTML, CSS, JavaScript, TypeScript, React, C++ and Arduino → sentences, checked exact |
| `lang/ts_write.js` | Sentences → TypeScript and React, built on the JavaScript writer through its dialect hook; the phrase packs for Tailwind, shadcn/ui, react-router, TanStack Query and Supabase; the TypeScript Index content |
| `lang/ts_convert.js` | What TypeScript and React add to the JavaScript reader: types, shapes, components, state, effects, JSX; asked first for each value and statement |
| `lang/blueprints.js` | Blueprint format and filling blanks |
| `lang/tutor.js` | Style cards (a language's habits, and why) for Python and C++/Arduino, sentence cards (how to talk to the program), the C++ habit finder (on tree-sitter's parse), and how "Your turn" answers are checked |
| `lang/glossary.js` | Finds a language's terms in code (tokens, tags, properties) or the less obvious words in sentences, for Ctrl+H and the code side of the explain strip |
| `lang/glossary_terms.js` | The glossary itself: terms for Python, C++, Arduino, HTML, CSS, JavaScript and the sentences, as plain data |
| `lang/values.js` | Drop down: finds the values in a sentence (numbers, colour codes and names, CSS words), says what each spot is and what's usual there, and nudges them |
| `lang/builder.js` | Project builder: the question/kit/component library (plain text) and building a project with its step map |
| `lang/parts.js` | Parts: every file (code or sentences) split into parts, each Interface & Display, Backend & Mechanics, Setup & Settings or Data & Notes, by the words and calls its lines use; for the side Parts list, the two buttons at the top and the help |
| `lang/openspec.js` | Hand to my AI: the project map as an OpenSpec change (`proposal.md`, `tasks.md`, `.openspec.yaml` under `openspec/changes/<name>/`), the map's progress, and a stored `.zip` of the files for the browser |
| `lang/predict.js` | Predictive Mode: the rest of the sentence being typed, from sentences written before (the project's files and lines entered with Enter), as a terminal predicts a command |
| `lang/library.js` | The Library: kinds of project (the languages they use, open-source projects to learn from) and the parts they're made of, each in one or more languages, from the plain-text packs in `lang/library/`; Coding integration parts give both sides of a link between two languages |
| `lang/ts_patch.js` | Fixes to the tree-sitter runtime: C library functions some grammars' scanners need (HTML with SVG or custom elements, Ruby, PHP, Bash, Vue, YAML) |

Engine files must not touch the page (no `document`, no DOM). The shell (`app.js`,
`app.css`, `index.html`, `runner.js`) calls them. The desktop layer (`src-tauri/src/lib.rs`)
adds folders, programs and compilers, and serves the website preview's files at a local address.

## Decision: code is the source of truth

*Decided 2026-09-29.*

Files on disk hold real code. Sentences are an editable **view** of that code:

- opening a file builds its sentences from the code (the reader's `to_sentences`);
- editing a sentence rewrites the matching lines of code (the translator);
- if the code changes elsewhere (another editor, Git, a collaborator), the sentences are rebuilt;
- the sentences a person typed, including filler words, are kept as long as the code they
  produced hasn't changed underneath them.

This keeps IntuaCode compatible with Git, other editors and people who don't use it.
The web version stores projects in the browser; the desktop app works on real folders. Save in a browser
downloads the same layout as a `.zip` (written with `zip` in `lang/openspec.js`); opening a `.zip` or folder
that has `.intuicode/project.json` restores that project as it was saved, before the code readers are tried.

Backups are a second IndexedDB database (`intuicode-backups`): every 2 minutes, if the project changed, its
JSON (as `localStorage` holds it) goes in `copies` and a small record (time, name, file count, folder, the
picture hashes it uses) in `backups`, under the same key; the oldest beyond 15 are deleted. A project can be
megabytes, more than `localStorage` holds. Pictures a backup uses aren't pruned. In the desktop app the page
tells the Rust layer (`guard_close`) whether there are changes since the last Save; while there are, the
window's close is held and the page is asked (`ask-to-close`), and it closes the window itself
(`close_window`) after Save or Don't save. The guard is off until the page turns it on, so a page whose
script never got that far doesn't keep the window open. Under WebDriver (the end-to-end tests) it stays off.

Pictures live in the project's `images/` folder and are named in sentences by that path. The
project lists them (name, size and a SHA-256 of the content); the browser keeps the pictures
themselves in IndexedDB by that hash, so projects in `localStorage` stay small and the project
kept for "restore" shares them. Saving writes them into `images/` (the desktop's `write_bytes`);
opening a folder reads them back from there, so the files win, as the code does. The desktop app's
preview serves them at their paths; the browser's one-page preview can't reach files, so there each
`images/…` name in the page becomes the picture's data.

## Decision: a project is a tree of files, each in its own language

*Decided 2026-11-04.*

A project's files (`project.sections`) each have a `path` and a language id from `lang/languages.js`.
The language says how the file is written: in **sentences** (Python, HTML, CSS, JavaScript, TypeScript, C++,
Arduino), as **code** that IntuaCode reads to you, or as **text** (Markdown, CSV, JSON…), kept as
written. The engines still work by role (Python by module name; a website by structure, styling and
mechanics; C++ by program; Arduino by sketch), and the shell works a file's role out from its path and
language (`roleOf` in `app.js`). Each engine compiles its own files (`compileAll`): Python together with
the start file last, a website's main page together and its other pages, styles and scripts each
against it, C++ together, Arduino together. Projects saved before this keep their ids (`main`,
`structure`…) and compile exactly as they did; `normalized()` gives them paths and languages on load.

Paths are checked wherever they come from (`pathProblem`): relative, no `..`, nothing in `.intuicode/`
or `images/`, Python files named as Python modules, and never two files in one place (ignoring case, as
Windows and macOS do). The desktop layer refuses paths outside the project's folder as well.

## Decision: reading other languages

Python is read with Python's own parser (`ast`), which also powers the exact "same program"
check. Other languages (JavaScript, HTML, CSS, C++) are read with tree-sitter, which has
parsers for all of them and runs in browsers, Node and desktop apps. Each language has its
own reader and translator behind the same interface.

*Added 2026-11-04:* every other language in `lang/languages.js` is read by `lang/code_read.js`,
one engine driven by each language's settings (which parts are tools, types, imports, tests…),
giving the same section shape as the C++ reader. Sentences stay with Python, HTML, CSS,
JavaScript and C++. Four of the installed grammars can't be used with our runtime
(web-tree-sitter 0.20.8): Dart (built for a newer tree-sitter), Elm and CodeQL (older), and Lua
(its scanner can end the program on unfinished text, and its parses go wrong after other
grammars have run). Those, and SQL, Markdown, CSV and plain text, are read without a grammar.
Every parse gets a final newline, because several scanners misbehave without one.

## Decision: nothing untrusted runs in the desktop window

*Decided 2026-09-30, after the audit.*

The desktop window can run shell commands and write files, so code people open (a folder
from someone else, code an AI wrote) must never run in it, and a slip in the page's HTML
must not turn into a command:

- **The preview runs in an origin of its own** and talks to the editor only with `postMessage`
  (console lines, errors, Pick, Project Link, and its `localStorage`, which the editor keeps for
  it, per project). In the desktop app it is served from a local address, `http://127.0.0.1:<port>`
  (see "the preview serves the project's files"), and keeps that origin (`allow-same-origin`): it
  isn't the editor's, so the page can't reach the editor, and Tauri treats it as a remote site.
  On Windows, WebView2 runs Tauri's scripts in every frame (wry ignores "main frame only" there),
  so the page does see Tauri's `invoke`; commands from it are refused, because a remote origin
  has no permissions (none are granted to remote URLs), and messages only reach the app from the
  window itself. The desktop tests try both routes from inside the preview.
  Tauri treats its own schemes as the app (`is_local_url`), so a page must never get a real
  origin there: `preview://` (the one-page fallback) sandboxes its page with a
  `Content-Security-Policy: sandbox` header, whatever frame it's loaded in, and the editor does
  nothing when it finds itself in a frame (a page could load `http://tauri.localhost/` in one).
  In a browser the page goes in `srcdoc`, sandboxed without `allow-same-origin`.
- **The editor's Content-Security-Policy** (`src-tauri/tauri.conf.json`) allows scripts only
  from the app itself: no inline scripts, nothing from the internet. Python and the parsers
  are built into the app (`tools/build_desktop.mjs` refuses a release build without them).
- **Text from code goes into the page escaped.** File names, paths and anything read from
  `.intuicode/project.json` (which is checked first) are escaped; reader summaries go through
  `rich()`, which escapes and then adds links.
- **The desktop commands are limited** (`Access` in `lib.rs`): files only in folders picked in
  the app's own dialog, files and folders dropped on the window, and IntuaCode's folder for
  unsaved projects; programs only the Python and arduino-cli found on the computer (or the
  Python of a project's virtual environment), or ones built in those folders. Shell commands
  typed after `$` run in those folders. A drop is allowed from the window's own drop event in
  `lib.rs`; the page can send itself a pretend `tauri://drag-drop`, but that allows nothing.

## Decision: Unity mode keeps the code, and changes only what was changed

*Decided 2026-11-04.*

In Unity mode the text is code; a region is some of its lines said in sentences. A region nobody changed
goes back to its original code, byte for byte, without being translated (looking never changes code). A
changed region is compiled as part of the whole file, where every other line is an exact line
(`python:`, `js:`, `c++:`…), so the writer knows the names around it; only the region's own lines are
taken back. Exact lines teach the writers the names they make (a `def`'s inputs, `int n = 3;`,
`function f(a)`), which also helps any sentence file that mixes in exact code.

## Decision: Unity mode edits the project's own files

*Decided 2026-11-05.*

Unity is Split Mode's project in one pane, not a workspace of its own. It shows the open file line for line
(`fromFile` in `lang/unity.js`): an exact line (`python: …`) as its code, sentence lines as green regions. Every
change is written straight back (`toFile`: regions as they are, every other line as an exact line), so Split Mode,
Run, Problems and the Library work on the same text, and compiling happens in the project's context. The writer's
own wrapping (a C++ `main`, a page's head) is never shown, as in Split Mode. Regions read from sentences get the
code they make as their original; regions made in Unity keep the code they came from (kept per file in
`intuicode.unity.v2` while the file is still what Unity made), so looking still never changes code. In C++ a
file's exact lines go inside `main`, so a part whose code goes above it (a tool, a class, an include) stays as
sentences, and C++ regions are one statement each. The Arduino, JavaScript and CSS writers keep exact lines' own
indentation outside a sentence block (and the JavaScript and CSS ones the blank lines between them), so an imported
file compiles back to its own text. The Arduino writer doesn't add an empty `setup()` or `loop()` to a sketch
whose exact lines write one.

## Decision: two modes, Unity first; imported code is the project's own

*Decided 2026-11-09.*

IntuaCode has two modes on one project: **Unity** (one pane of real code, any part said in sentences in place,
where it opens) and **Split Mode** (sentences on the left, the code they make on the right; it was called Write
mode). The mode used last is remembered (`intuicode.mode.v1`). Read mode is gone: importing a file, a folder, a
`.zip` or the example makes them the project's files (`importProject` / `addFiles` in `app.js`), so both modes,
Run, Problems, Parts and the Library work on imported code as on any other. Python, CSS and JavaScript come in as
exact lines (Unity shows them as code, ready to translate); HTML, C++ and Arduino are converted to sentences,
because their writers wrap the file (a page's head, `main`, `setup` and `loop`); other languages, notes and data
come in as they are, and the code reader (`lang/code_read.js`) explains them in the help. Paths are made safe
(`pathProblem`), at most 200 files come in, and `.env` files never do. Both modes share the help under the pane,
the side (the tree, Parts, Problems), Predictive Mode and the Preview.

## Decision: parts, and the two sides of a project

*Decided 2026-11-09.*

`lang/parts.js` splits a file into parts: top-level runs of lines (by brackets for code, by indentation for
sentences and Python; a sentence file's exact lines are read as their code) and gives each a type by the words and
calls its lines use, the same lists for code and sentences, the first line counting double. Each line has its own
type too, so a part can *involve* another side (an Arduino loop that lights an LED is display with mechanics in
it). Notes, data and settings files are one part each. It's a reading, not a proof: good enough to find the code
that puts things on screen, which is where most people reading code an AI wrote start. Because it works line for
line on the file's own text, the same parts serve Unity and Split Mode. The buttons at the top filter the tree,
Parts and the Library and dim the rest of the code (`lineLooks` in `app.js`); they never hide lines of a file
being edited, so editing still works on the whole text.

## Decision: Project Link follows the Preview

*Decided 2026-11-09.*

Project Link works on the website preview IntuaCode runs itself, so it needs nothing added to the user's page. The
preview's helper script reports the element under the pointer, in focus, clicked or typed in (its sentence line,
`data-ic-line`, which the web writer already sets, and the CSS rules it matches), and wraps `addEventListener`
for the page's own input handlers so each one says, when it runs, which function it is (its text). The editor
maps those to the project's lines: the element's sentence and the ones under it, the style rules' sentences (by
selector, in the compiled CSS), the script lines that name the element, and the handler's lines (its text found
in the compiled script). Pointing never scrolls; a click or a handler brings the code into view. Predictive Mode
and Project Link take turns (turning one on turns the other off), so a running page can be clicked through without
predictions popping up.

*Added 2026-11-10:* on the desktop's local address every HTML page is served marked, so the helper also says which
page it's on (its path). Style rules are traced to their sheet by its address (an inlined sheet in the browser's
one page carries `data-ic-file`), and scripts are the page's `<script src>` files and what they import (read from
their code: `import … from`, `export … from`, `import()`), so an element is linked through a page's modules. An
error names its file and line, which map back to the sentence. Project Link only works on pages IntuaCode serves:
a site on its own domain has no marks, and the browser keeps other sites' pages apart from the editor.

## Decision: the preview serves the project's files (desktop)

*Decided 2026-11-10.*

The preview used to be one document (its HTML with the CSS and main script inlined), so a site of several files
didn't run: ES modules, a fetched JSON file, pictures and sounds by path. The desktop app now serves every file of
the project, from memory, at `http://127.0.0.1:<port>/` (a port the system picks, opened the first time), as any
static web server would:

- The page sends the files with `preview_site`, only those that changed (pictures as base64). Sentence files are
  served as the code they make; HTML pages marked, with IntuaCode's helper as their first script
  (`/.intuicode/preview.js`, a path no project file can have). The links to `style.css` and `script.js` that the
  web writer adds are left out of a page when the project has no such file.
- Paths: a query (`app.js?v=2`) isn't part of the path, `/` and `folder/` are `index.html`, a file not in the
  project is a plain `404 Not Found` (the editor says which, once per project, by folder). GET and HEAD only.
- The server notes what the page asked for since it last loaded, so an edit reloads the page only when it changed
  a file the page used (or one it asked for and didn't find). The helper's own file never calls for a reload.
- Only this computer can reach it (127.0.0.1). The Host must be the address itself (another site can't borrow it
  by DNS rebinding), and every answer has `Cross-Origin-Resource-Policy: same-origin`, so other sites in a browser
  can't load the files. Service workers aren't served (one would stay and answer for the next project).
- 127.0.0.1 is a secure context and the frame keeps that origin, with `allow="midi; serial; …"`, so Web MIDI and
  Web Serial are there when the window has them (WebView2 on Windows has both; WebKit on macOS and Linux has
  neither). **Open in your browser** opens the same address in the computer's own browser.
- If the address can't be opened, the preview falls back to the one page at `preview://`.

The browser version keeps the one page: every style sheet the page links that's the project's is inlined, and a
main script that's a module isn't run (its imports can't load); the preview says what didn't load. A service worker
could serve the files, but not to a sandboxed page: Chromium doesn't let one answer an opaque-origin document's
requests (tried 2026-11-10), and without the sandbox the page would share the editor's origin, its storage and
projects.

## Decision: the AI stays outside; the map is handed over as OpenSpec files

*Decided 2026-11-09.*

IntuaCode has no AI in it and gets none. People who build with an AI assistant get the project map in a format
those assistants already work from: an [OpenSpec](https://openspec.dev) change (`lang/openspec.js`, no DOM).
`proposal.md` has the sections `openspec validate` asks for (Why, 50 to 1000 characters; What Changes; Impact),
and `tasks.md` has one `## 1.` group with a `- [ ] 1.n` task per step, in build order, each with its check line;
ticked steps are `- [x]`. Text from a step is kept to one line, so a step's name or summary can't start a heading
or a task. The desktop app writes the files only inside the saved project's folder (`write_text` refuses anything
else), keeps an existing `.openspec.yaml` (its `created:` date), and says first when `proposal.md` or `tasks.md`
there differ from what it would write, since an AI may have ticked them. The browser offers a `.zip`, written
by `lang/openspec.js` itself (stored entries, CRC-32), so nothing is fetched or sent. No specs are written:
which requirements the steps add is the AI's (or the person's) next step in OpenSpec's own flow.

Ticks come back the other way (`ticksFrom`): opening a saved project's folder reads its
`openspec/changes/<name>/tasks.md`, and Hand to my AI offers the same before writing over it (in the browser,
from a `tasks.md` the person chooses). A task belongs to a step when its text starts with the step's name: the
longest name that fits, tasks in group 1 first, so an AI's own added tasks can't claim a step. If the AI reworded
the tasks but group 1 still has one per step, the task's number says which step. Only `- [x]` counts: a file can
tick a step, never untick one, so a tick made on the map after the export is never lost.

Each step's tick (`done`) and check line (`check`, one line, at most 300 characters) are kept in the plan with
the project, checked by `checkedProject` like the other fields. Kits give a step its check with `check:`; without
one, the step's depth has a default (`DEPTHS[depth].check` in `lang/builder.js`).

## Decision: TypeScript and React are the JavaScript sentences, plus their own

*Decided 2026-11-10.*

Most code people bring from an AI builder is React and TypeScript (Lovable's stack: React, TypeScript, Vite,
Tailwind, shadcn/ui, react-router, TanStack Query, Supabase). `.ts` and `.tsx` files are sentence languages, and so
is the React in `.jsx`/`.js`:

- **One writer, extended, not forked.** `compileJs` takes an optional dialect (`ext`: `plain`, `names`, `line`,
  `expr`). A dialect line can be written in full (a shape, what a component shows), or said as the Mechanics
  sentence it stands for and its code then changed (`set total (a number) to 0` is `set total to 0`, then
  `: number` goes in), so every Mechanics sentence means the same in all three. `lang/ts_write.js` is that
  dialect. With no dialect loaded, the JavaScript writer is exactly as before.
- **One reader, extended.** `jsConvert` takes a dialect too (grammar, exact-code prefix, and `lang/ts_convert.js`'s
  sayings, asked first for each value and statement; anything they leave is said the JavaScript way).
- **Exact lines are `ts:` and `tsx:`**, not `js:`: a typed line read back as JavaScript would lose its types, and
  Unity's and Parts' exact-line patterns are per language.
- **Types count.** The check uses the JavaScript rules plus three of TypeScript's own (`(x) =>` is `x =>` for an
  input with nothing of its own; `;` and `,` in a shape; JSX compared as React reads it). Every type, generic,
  `as`, `!`, `?`, `readonly`, `import type` and `export` stays in the tree; `tests/convert.test.mjs` has pairs for
  each that must be reported as different.
- **JSX is compared as React reads it**, not as tree-sitter splits it: tree-sitter drops the spaces round text,
  so an element's text is recomputed from the source between its children, with JSX's own rules (lines trimmed,
  joined by a space, character references read). The writer keeps text on one line where its edge spaces
  matter, and writes `&`, `<`, `>`, `{`, `}` as character references (tree-sitter's TSX can't read a bare `&`).
- **The fallback works on one element or text** inside what a component shows, so one prop with no words keeps
  only its element as `tsx:` lines.
- **Phrase packs** (Tailwind, shadcn/ui, react-router, TanStack Query, Supabase) are tables and patterns in
  `lang/ts_write.js`, used by both directions; one Tailwind class is one phrase and back, and a class with no
  words is said as written, in quotes.
- **What a component shows has its own small grammar**, read as an indented tree (an element per line, its
  settings after commas in order), not by Mechanics' line rules: so its words can't collide with them.
- **Running React** (a bundler in the page) is not part of this: the Preview shows websites. TSX would need
  transforming before it could run there, even at the desktop's local address (PR #32).

## Decision: translated TypeScript keeps its layout

*Decided 2026-11-10.*

A project's file is written back from its sentences, so any layout the sentences lose shows up as a change in
git, though the program is the same. The check compares syntax trees, so layout is a separate promise:

- **The sentences carry layout, by one rule: one line of sentences is one line of code.** Blank lines; an if with
  its step after a comma (`if error, fail with error as it is`); `show: …` on one line; an element's text or settings
  on lines of their own; `loaded by …` on the line under a query. Each is a form a person could type, read the same
  way by the writer; none is a hidden annotation.
- **Where sentences can't say it, TypeScript is written as Prettier writes it** (`(n) =>`, no brackets a value
  doesn't need), since that's how Lovable's code is formatted. JavaScript keeps its own style (`n =>`).
- **Never guessed, always said.** After the check, the converter writes the sentences back and compares lines
  (indentation by level, so a file indented by 4 or by tabs isn't all "different"). Where they differ, its result
  has `layout: [{ from, to, why }]`, and Translate in Unity says which lines and why. It's TypeScript and React only.
- **More shapes, the same way** (2026-11-10): what goes on over lines is said on lines under its sentence, a line
  each. `bring in from "…":` with the names under it; `… with:` with a call's inputs, or a record's parts
  (`name: value`), under it (`… and:` when the record follows other inputs); a Supabase query's parts after its table
  under it. The converter says them only for a statement's whole value laid out exactly so (inputs with no comma
  after the last, a record with one), by saying the sentence on one line and taking its end off onto the lines
  under; the writer joins them back and writes those values over lines. A record over lines is never "too long" a
  sentence, nor is a fetch said as "send". Website JavaScript keeps its own sentences (`send … to …`).
- **What isn't carried yet** (text and an element sharing a line between tags, a query split over lines with
  nothing after its table, a record over lines inside a longer sentence like `…, and take error from it`) would each
  need a sentence form of its own.

## Testing

- `python3 -m unittest discover -s tests`: reader tests
- `node --test tests/*.test.mjs`: translator, blueprints, and round-trips over the corpus
- `npm run coverage`: the sentence-coverage number (see ROADMAP.md)
- `tests/e2e/run.mjs`: drives the real desktop app (Linux and Windows)
- `cargo test --manifest-path src-tauri/Cargo.toml`: the desktop layer's own checks

GitHub Actions runs all of these on every push, and on pull requests.

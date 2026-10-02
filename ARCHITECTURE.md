# Architecture

## Engine and shell

The **engine** knows languages and has no user interface. The **shell** is the user
interface. The same engine is used by the web page, the tests (Node and Python), and
the desktop app.

| Engine file | Job |
|---|---|
| `lang/python.js` | Sentences → Python (Write mode) |
| `lang/python_reader.py` | Python → sections, summaries, sentences; project analysis (Read mode) |
| `lang/web_write.js` | Sentences → HTML, CSS and JavaScript (website projects); the preview document |
| `lang/web_read.js` | JavaScript / React / TypeScript, HTML, CSS and C++ → sections, summaries, links |
| `lang/cpp_write.js` | Sentences → C++ and Arduino sketches |
| `lang/convert.js` | HTML, CSS, JavaScript, C++ and Arduino → sentences, checked exact |
| `lang/blueprints.js` | Blueprint format and filling blanks |
| `lang/tutor.js` | Style cards (a language's habits, and why) for Python and C++/Arduino, sentence cards (how to talk to the program), the C++ habit finder (on tree-sitter's parse), and how "Your turn" answers are checked |
| `lang/glossary.js` | Finds a language's terms in code (tokens, tags, properties) or the less obvious words in sentences, for Ctrl+H and the code side of the explain strip |
| `lang/glossary_terms.js` | The glossary itself: terms for Python, C++, Arduino, HTML, CSS, JavaScript and the sentences, as plain data |
| `lang/values.js` | Drop down: finds the values in a sentence (numbers, colour codes and names, CSS words), says what each spot is and what's usual there, and nudges them |
| `lang/builder.js` | Project builder: the question/kit/component library (plain text) and building a project with its step map |
| `lang/ts_patch.js` | A fix to the tree-sitter runtime for pages with SVG or custom elements |

Engine files must not touch the page (no `document`, no DOM). The shell (`app.js`,
`app.css`, `index.html`, `runner.js`) calls them. The desktop layer (`src-tauri/src/lib.rs`)
adds folders, programs and compilers.

## Decision: code is the source of truth

*Decided 2026-09-29.*

Files on disk hold real code. Sentences are an editable **view** of that code:

- opening a file builds its sentences from the code (the reader's `to_sentences`);
- editing a sentence rewrites the matching lines of code (the translator);
- if the code changes elsewhere (another editor, Git, a collaborator), the sentences are rebuilt;
- the sentences a person typed, including filler words, are kept as long as the code they
  produced hasn't changed underneath them.

This keeps IntuCode compatible with Git, other editors and people who don't use it.
The web version stores projects in the browser; the desktop app works on real folders.

Pictures live in the project's `images/` folder and are named in sentences by that path. The
project lists them (name, size and a SHA-256 of the content); the browser keeps the pictures
themselves in IndexedDB by that hash, so projects in `localStorage` stay small and the project
kept for "restore" shares them. Saving writes them into `images/` (the desktop's `write_bytes`);
opening a folder reads them back from there, so the files win, as the code does. The preview
can't reach files, so each `images/…` name in the page becomes the picture's data.

## Decision: reading other languages

Python is read with Python's own parser (`ast`), which also powers the exact "same program"
check. Other languages (JavaScript, HTML, CSS, C++) are read with tree-sitter, which has
parsers for all of them and runs in browsers, Node and desktop apps. Each language has its
own reader and translator behind the same interface.

## Decision: nothing untrusted runs in the desktop window

*Decided 2026-09-30, after the audit.*

The desktop window can run shell commands and write files, so code people open (a folder
from someone else, code an AI wrote) must never run in it, and a slip in the page's HTML
must not turn into a command:

- **The preview is sandboxed** without `allow-same-origin`: the page runs in an origin of its
  own and talks to the editor only with `postMessage` (console lines, errors, Pick, and its
  `localStorage`, which the editor keeps for it). In the desktop app it is served from
  `preview://`, so it isn't covered by the editor's Content-Security-Policy. On Windows,
  WebView2 runs Tauri's scripts in every frame (wry ignores "main frame only" there), so the
  page does see Tauri's `invoke`; commands from it are still refused, because a sandboxed
  frame's requests carry origin `null` and messages only reach the app from the window itself.
  The desktop tests try both routes from inside the preview.
- **The editor's Content-Security-Policy** (`src-tauri/tauri.conf.json`) allows scripts only
  from the app itself: no inline scripts, nothing from the internet. Python and the parsers
  are built into the app (`tools/build_desktop.mjs` refuses a release build without them).
- **Text from code goes into the page escaped.** File names, paths and anything read from
  `.intuicode/project.json` (which is checked first) are escaped; reader summaries go through
  `rich()`, which escapes and then adds links.
- **The desktop commands are limited** (`Access` in `lib.rs`): files only in folders picked in
  the app's own dialog, files and folders dropped on the window, and IntuCode's folder for
  unsaved projects; programs only the Python and arduino-cli found on the computer (or the
  Python of a project's virtual environment), or ones built in those folders. Shell commands
  typed after `$` run in those folders. A drop is allowed from the window's own drop event in
  `lib.rs`; the page can send itself a pretend `tauri://drag-drop`, but that allows nothing.

## Testing

- `python3 -m unittest discover -s tests`: reader tests
- `node --test tests/*.test.mjs`: translator, blueprints, and round-trips over the corpus
- `npm run coverage`: the sentence-coverage number (see ROADMAP.md)
- `tests/e2e/run.mjs`: drives the real desktop app (Linux and Windows)
- `cargo test --manifest-path src-tauri/Cargo.toml`: the desktop layer's own checks

GitHub Actions runs all of these on every push, and on pull requests.

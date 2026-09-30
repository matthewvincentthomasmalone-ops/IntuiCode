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

This keeps IntuiCode compatible with Git, other editors and people who don't use it.
The web version stores projects in the browser; the desktop app works on real folders.

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
  `preview://`, so it isn't covered by the editor's Content-Security-Policy.
- **The editor's Content-Security-Policy** (`src-tauri/tauri.conf.json`) allows scripts only
  from the app itself: no inline scripts, nothing from the internet. Python and the parsers
  are built into the app (`tools/build_desktop.mjs` refuses a release build without them).
- **Text from code goes into the page escaped.** File names, paths and anything read from
  `.intuicode/project.json` (which is checked first) are escaped; reader summaries go through
  `rich()`, which escapes and then adds links.
- **The desktop commands are limited** (`Access` in `lib.rs`): files only in folders picked in
  the app's own dialog and IntuiCode's folder for unsaved projects; programs only the Python
  and arduino-cli found on the computer, or ones built in those folders. Shell commands typed
  after `$` run in those folders.

## Testing

- `python3 -m unittest discover -s tests`: reader tests
- `node --test tests/*.test.mjs`: translator, blueprints, and round-trips over the corpus
- `npm run coverage`: the sentence-coverage number (see ROADMAP.md)
- `tests/e2e/run.mjs`: drives the real desktop app (Linux and Windows)
- `cargo test --manifest-path src-tauri/Cargo.toml`: the desktop layer's own checks

GitHub Actions runs all of these on every push, and on pull requests.

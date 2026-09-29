# IntuiCode roadmap

IntuiCode translates between plain, structured sentences and real code, in both
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
- Counted as the same: `let`/`const`, `x++`/`x += 1`, one-line bodies/braces, `std::` with
  `using namespace std`, main's final `return 0`, attribute order and whitespace in HTML.
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

## What could come next

- More of the web into words: forms with names, `hidden` elements, listeners on saved
  elements (`const form = …; form.addEventListener`), multi-file C++ projects with headers.
- Code signing, so Windows and macOS don't warn when installing.
- A proper grammar for sentences, if rule collisions keep appearing (see Known risks).

## The number we track

`npm run coverage` reports, for the corpus in `samples/` and `tests/corpus/`:

- **in words**: the share of statements (excluding imports) that read as sentences rather
  than `python:` lines;
- **exact**: files whose sentences rebuild exactly the same program. This must always be all of them.

`tests/heldout/` holds programs written *after* the rules, to measure fairly. Once a
held-out file has been used to fix something, it counts as seen; add new unseen files
before each measurement.

| Date | Corpus in words | Exact | Held-out in words | Exact |
|------|-----------------|-------|-------------------|-------|
| 2026-09-29 baseline | 43% (130/304) | 18/18 | – | – |
| 2026-09-29 after step 2 | 98% (297/304) | 18/18 | 87% on first sight, one exactness bug found; 96% after fixes | 5/5 |

The app has a safety net: if converting a file to sentences ever isn't exact, the
statements that differ are kept as `python:` lines automatically and the check runs again.

## Known risks (from the design audit)

1. **Rule collisions.** Regex rules interact as they grow. Mitigation: the test suite and
   round-trip corpus run on every push; move to a proper grammar if collisions keep appearing.
2. **Library long tail.** Real code is mostly library calls. Mitigation: phrase packs for the
   libraries AI tools use most, shared by Write and Read modes.
3. **Summaries say what, not why.** Rules can't infer business intent. Positioning:
   IntuiCode is the verifiable layer. Any AI features must be opt-in and labelled as guesses.
4. **The "new language" trap.** Sentences can become a dialect of their own. Mitigation:
   real code always visible; sentences can be faded out as people learn.
5. **Language differences.** HTML and CSS fit sentences well; JavaScript in practice means
   React/TypeScript; C++ is hardest and is scheduled last.
6. **Browser limits.** No real servers, packages or file system. Mitigation: the desktop app (step 4).

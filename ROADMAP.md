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

### Step 3 notes

- Read mode: JavaScript (with React and TypeScript), HTML and CSS are read with tree-sitter.
  Links: pages → their CSS and JS; scripts → page elements; CSS → elements; `fetch` → the
  Python (Flask/FastAPI, including Blueprint prefixes) or Express route that answers it.
- Write mode: website projects (Structure / Styling / Mechanics), live preview, Pick,
  console and error forwarding to the terminal.
- Not yet: converting existing JavaScript, HTML or CSS **into** sentences (Read mode shows
  sentence-style steps, but "Open as sentences" is Python-only). That needs web round-trip
  checks like Python's before it can be trusted.

### Step 5 notes

- Read: C++ programs, headers and Arduino sketches (sections, types, references, memory and
  safety warnings, Arduino steps in plain words, links from files to the headers they include).
- Write: the core sentences produce C++20 with worked-out types and small helpers for random
  numbers and text with values. The desktop app compiles with g++/clang++ and maps compiler
  errors back to sentences.
- Not yet: C++ classes in sentences, Arduino projects in Write mode, converting existing C++
  into sentences.

## What could come next

- Converting existing JavaScript, HTML, CSS and C++ **into** sentences, with exactness checks
  like Python's.
- Arduino in Write mode (setup/loop sentences, upload to a board).
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

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
| 2 | Grow Python sentences: dictionaries, files, errors, `with`, classes, method calls, library phrase packs, keep comments | next |
| 3 | The web set: HTML, CSS and JavaScript in Read and Write modes, website template with live preview, front end ↔ back end links | |
| 4 | Desktop app (Tauri): real files, real Python, Git; installers for Windows, macOS and Linux built by GitHub | |
| 5 | C++: Read mode first, then Write basics; compile with the local toolchain in the desktop app | |

## The number we track

`npm run coverage` reports, for the corpus in `samples/` and `tests/corpus/`:

- **in words**: the share of statements (excluding imports) that read as sentences rather
  than `python:` lines;
- **exact**: files whose sentences rebuild exactly the same program. This must always be all of them.

| Date | In words | Exact |
|------|----------|-------|
| 2026-09-29 (baseline) | 43% (130/304) | 18/18 |

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

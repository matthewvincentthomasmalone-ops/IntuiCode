# Architecture

## Engine and shell

The **engine** knows languages and has no user interface. The **shell** is the user
interface. The same engine is used by the web page, the tests (Node and Python), and
the desktop app.

| Engine file | Job |
|---|---|
| `lang/python.js` | Sentences → Python (Write mode) |
| `lang/python_reader.py` | Python → sections, summaries, sentences; project analysis (Read mode) |
| `lang/blueprints.js` | Blueprint format and filling blanks |

Engine files must not touch the page (no `document`, no DOM). The shell (`app.js`,
`app.css`, `index.html`, `runner.js`) calls them.

## Decision: code is the source of truth

*Decided 2026-09-29.*

Files on disk hold real code. Sentences are an editable **view** of that code:

- opening a file builds its sentences from the code (the reader's `to_sentences`);
- editing a sentence rewrites the matching lines of code (the translator);
- if the code changes elsewhere (another editor, Git, a collaborator), the sentences are rebuilt;
- the sentences a person typed, including filler words, are kept as long as the code they
  produced hasn't changed underneath them.

This keeps IntuiCode compatible with Git, other editors and people who don't use it.
The web version still stores projects in the browser. The desktop app (step 4) switches
to real files.

## Decision: reading other languages

Python is read with Python's own parser (`ast`), which also powers the exact "same program"
check. Other languages (JavaScript, HTML, CSS, C++) will be read with tree-sitter, which
has parsers for all of them and runs in browsers, Node and desktop apps. Each language
gets its own reader and translator behind the same interface.

## Testing

- `python3 -m unittest discover -s tests`: reader tests
- `node --test tests/*.test.mjs`: translator, blueprints, and round-trips over the corpus
- `npm run coverage`: the sentence-coverage number (see ROADMAP.md)

GitHub Actions runs all of these on every push.

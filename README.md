# IntuiCode

Write Python by filling in ideas and sentences, and read existing Python in plain English.

IntuiCode is a rules-based translator, not an AI. Every sentence becomes a specific
line of Python, every summary points at real lines, and the same input always gives
the same result. The aim is to let intuition and plain language lead, while you stay
directly connected to every part of the code.

## Two directions

**Write: idea → sentences → Python**

1. **Blueprints** are short stories with blanks: *"The computer picks a number between
   [1] and [20]. The player gets [5] guesses. After a wrong guess the game [gives a hint ▾]."*
   Filling the blanks writes sentences into the project's folders. Choices switch whole
   parts on and off, so a blueprint is a skeleton rather than a fixed outcome.
2. **Sentences** such as `ask for a number "Your guess: " and store in guess` sit in folders
   named for their purpose (Settings, Tools, Main program). Each one shows the Python it
   became and *why*, for example why "add" became `.append()` for a list but `+=` for a number.
3. **Python** is generated live, and runs in the page with a real terminal.

Blueprints are plain text. You can edit any of them, save your own, or turn your
current project into a blueprint and put blanks where your projects usually differ.

**Read: existing code → sections → plain English**

Import Python, such as code an AI wrote for you, and IntuiCode will:

- split it into sections (toolkits, settings, tools, web routes, classes, main steps);
- summarise each section: what it takes, what it gives back, what it touches (files,
  internet, databases, secrets), and what it's for when it recognises a pattern
  (counting, adding up, building a list, searching, asking until valid);
- flag things worth checking: hard-coded secrets, SQL built from text, errors silently
  ignored, `debug=True`, `eval`, shell commands, TODOs, very long functions;
- summarise any lines you highlight;
- open the file as sentences, where it can, and check that the sentences rebuild
  exactly the same program.

## Run it

```
python3 run.py
```

Then open http://localhost:8000. Python runs inside the page (Pyodide). By default it is
loaded from a CDN. To work offline, or to publish as a hosted page, download it once:

```
python3 tools/fetch_pyodide.py
```

## How it is built

| File | What it does |
|---|---|
| `lang/python.js` | Sentences → Python: sentence rules, word swaps, symbol table, Index content |
| `lang/python_reader.py` | Python → sections, summaries and sentences, using Python's own `ast` parser |
| `lang/blueprints.js` | Blueprint format, built-in blueprints, filling blanks |
| `runner.js` | Runs Python in the page; handles `input()` by replaying answers; stops endless loops |
| `app.js`, `app.css`, `index.html` | The editor: folders, sentence editor, Python view, explain strip, Read mode, terminal, Index |
| `samples/` | Example code for Read mode |
| `run.py` | Small local server (adds the `<html>` wrapper that `index.html` leaves out) |

The reader can be used on its own: `python3 lang/python_reader.py some_file.py`

### Extending it

- **A new sentence:** add a `rule(regex, fn)` in `lang/python.js` (first match wins), then a
  matching entry in `TEMPLATES` so it appears in the phrase picker and the Index.
- **A new word inside sentences:** add to `EXPR_RULES` (for example `length of x` → `len(x)`).
- **A new blueprint:** write it in the app (Blueprints → Write or paste one), or add it to
  `BUILT_IN` in `lang/blueprints.js`. The format is described at the top of that file.
- **Reading more:** library descriptions live in `LIBRARIES`, safety checks in `Facts`,
  and pattern recognisers in `gists()` in `lang/python_reader.py`.
- **Another language:** a language pack exposes the same shape as `lang/python.js`
  (`compileProject`, `TEMPLATES`, `WORDS`, `GUIDE`, `OPENS_BLOCK`) on `window.IntuiLang`.

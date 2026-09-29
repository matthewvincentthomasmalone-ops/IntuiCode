# IntuiCode

Write Python and websites by filling in ideas and sentences, and read existing Python,
JavaScript, HTML and CSS in plain English.

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

**Websites** have three folders: **Structure** (HTML: what is on the page), **Styling** (CSS:
how it looks) and **Mechanics** (JavaScript: what it does). They share names, so
"add a button called save" in Structure can be styled with "style save: background navy,
rounded corners 8" and used with "when save is clicked". A live preview updates as you type;
**Pick from the page** puts an element's name into your sentence, and messages and errors from
the page appear in the terminal, linked back to the sentence that caused them.

Blueprints are plain text. You can edit any of them, save your own, or turn your
current project into a blueprint and put blanks where your projects usually differ.

**Read: existing code → sections → plain English**

Import a whole project (a folder, a `.zip`, or drag and drop) or a single file, such as
code an AI wrote for you. Python, JavaScript (including React and TypeScript), HTML and
CSS are all read. For a project, IntuiCode shows:

- what kind of app it looks like, and which file to start reading;
- a reading order, and a map of which files use which;
- a role for every file (starting point, web routes, data models, settings, helpers, tests);
- outside libraries, and any that `requirements.txt` forgets to list;
- a `.env` secrets file if one was included (its contents are never read);
- everything worth checking across all files, each linked to the exact place.

Summaries link across files and languages: "uses `get_db` from db.py", "the page's
script uses `#task-list` in index.html", "styled by `.card` in style.css", and
"`fetch('/api/tasks')` is answered by `list_tasks` in routes/tasks.py".
Inside each file, IntuiCode will:

- split it into sections (toolkits, settings, tools, web routes, classes, main steps);
- summarise each section: what it takes, what it gives back, what it touches (files,
  internet, databases, secrets), and what it's for when it recognises a pattern
  (counting, adding up, building a list, searching, asking until valid);
- flag things worth checking: hard-coded secrets, SQL built from text, errors silently
  ignored, `debug=True`, `eval`, shell commands, TODOs, very long functions;
- summarise any lines you highlight;
- open the file as sentences, where it can, and check that the sentences rebuild
  exactly the same program.

## Desktop app

The desktop app (built with [Tauri](https://tauri.app)) adds what a browser can't do:

- **Real folders.** Open folder / Save (Ctrl+S). Your code files are the project;
  the sentences are kept in `.intuicode/` beside them. If the Python on disk is changed in
  another editor, its sentences are rebuilt from the code. Folders that aren't IntuiCode
  projects open in Read mode.
- **Real Python.** Programs run with the Python installed on the computer, with live
  output, typed input and a Stop button, so web servers and packages work. Without Python
  installed, the built-in one is used.
- **Commands.** Type `$` and a command in the terminal to run it in the project folder:
  `$ git status`, `$ pip install flask`.

### Getting the installer

Installers are built by GitHub for Windows, macOS and Linux: go to
**Actions → Desktop app → Run workflow**, or push a tag like `v0.1.0`. When it finishes,
the files are on the repository's **Releases** page.

These builds aren't code-signed yet, so the first time you open the app:

- **Windows:** if SmartScreen says "Windows protected your PC", choose **More info → Run anyway**.
- **macOS:** right-click the app and choose **Open**, then **Open** again (or System Settings →
  Privacy & Security → **Open Anyway**).
- **Linux:** make the `.AppImage` executable (`chmod +x IntuiCode*.AppImage`) and run it, or
  install the `.deb` with `sudo apt install ./IntuiCode*.deb`.

### Building it yourself

You need [Rust](https://rustup.rs) and Node.js, plus on Linux:
`sudo apt install build-essential libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`.

```
npm install && npm run vendor && python3 tools/fetch_pyodide.py
npm run desktop:dev      # run it
npm run desktop:build    # make an installer for this computer
```

## Tests

```
npm install
npm test            # reader, translators, blueprints, web reader, exact round-trips
npm run coverage    # how much real code reads as sentences
```

## Run it

```
python3 run.py
```

Then open http://localhost:8000. Python runs inside the page (Pyodide) and the web reader
uses tree-sitter. By default both are loaded from a CDN. To work offline, or to publish as
a hosted page, download them once:

```
python3 tools/fetch_pyodide.py
npm install && npm run vendor
```

## How it is built

| File | What it does |
|---|---|
| `lang/python.js` | Sentences → Python: sentence rules, word swaps, symbol table, Index content |
| `lang/python_reader.py` | Python → sections, summaries and sentences, using Python's own `ast` parser |
| `lang/web_write.js` | Sentences → HTML, CSS and JavaScript (website projects), live preview document |
| `lang/web_read.js` | JavaScript / React / TypeScript, HTML and CSS → sections, summaries, cross-language links |
| `lang/blueprints.js` | Blueprint format, built-in blueprints, filling blanks |
| `runner.js` | Runs Python in the page; handles `input()` by replaying answers; stops endless loops |
| `app.js`, `app.css`, `index.html` | The editor: folders, sentence editor, Python view, explain strip, Read mode, terminal, Index |
| `samples/` | Example code for Read mode, including a small multi-file project (`samples/taskboard`) |
| `run.py` | Small local server (adds the `<html>` wrapper that `index.html` leaves out) |
| `src-tauri/` | The desktop app: folders, running programs, the native window (Rust) |
| `tools/build_desktop.mjs` | Gathers the app's files into `dist/` for the desktop build |
| `tests/desktop-mock.html` | Runs the app with a pretend desktop layer, to test desktop features in a browser |

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

# IntuiCode

Write Python, websites, C++ and Arduino sketches by filling in ideas and sentences, and read
existing Python, JavaScript, HTML, CSS and C++ in plain English, or turn it into sentences.

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

Blueprints live in the **Library**, on shelves by what you're making (Apps for a PC, Phone apps,
Websites, Online services, Gadgets, One idea at a time, Starting points), beside the project
builder's kits for the same kinds of project. A kit plans a whole project step by step; a blueprint
writes its sentences from a story with blanks. Each shelf can open the project builder right there.
Blueprints are plain text: you can edit any of them, save your own, or turn your current project into
a blueprint and put blanks where your projects usually differ (`shelf:` says where it sits).

**C++** projects use the same sentences. Types are worked out from values
(text → `std::string`, whole numbers → `int`) and every choice is explained; you can also name
them ("set decimal total to 0", "define area using decimal w, decimal h giving back decimal",
"constant LIMIT is 100"). Classes read like this:

```
define class Account
    field owner: text
    field balance: decimal = 0
    when made using text owner
        set self.owner to owner
    define deposit using decimal amount giving back nothing
        increase balance by amount
make a new Account with "Sam" and store in account
```

The desktop app compiles and runs C++ with the computer's compiler: **Visual Studio's** (the free
Build Tools are enough) on Windows, g++ or clang++ elsewhere. Compiler errors link back to the
sentence that caused them.

**Arduino** projects have one **Sketch** folder. Lines at the left edge are settings;
"when the board starts" runs once and "over and over" runs forever:

```
constant LED is 13
when the board starts
    make pin LED an output
    start the serial monitor at 9600
over and over
    turn pin LED on
    wait 500 milliseconds
    turn pin LED off
    wait 500 milliseconds
    show "blink"
```

In the desktop app, **Run** checks the sketch with arduino-cli (included in the Arduino IDE 2),
uploads it to a board plugged in by USB, and shows what the board sends in the terminal.

**Project builder: a map before you start**

File → **Project builder…** asks a few questions to narrow down what you're making (App › PC › Audio
workstation, a webpage, an online service, a gadget…), then lists the parts such a project usually
has, in the order you'd build them. Tick the ones you want and IntuiCode lays them out in your
folders as sentences, with a **Project map** beside the folders. Each step says how much is done
for you:

- **Walk**: written out in full, to read, run and change.
- **Hallway**: the structure is there and the key parts are named; you fill in the ‹blanks›, with
  notes to guide you (a DAW's EQ gives you the filter and leaves its transfer-function numbers to you).
- **Horizon**: what it is, what it's usually made with, and what to learn first. Too big to write
  for you, but now you know where it goes.

Click a step for its role in the project and a jump to its sentences; the explanation panel says
which step your cursor is in.

The questions, kits and steps are plain text, and **Change the questions and steps** (in the
builder) lets you read and edit every one of them. Edit a copy of a built-in step and yours
replaces it (delete yours to get the original back); or write your own step, a kit that lists it,
and an answer to a question that leads there. Each entry is checked as you type (a hallway step
needs ‹blanks›, a walk step none), and your entries are kept on your computer. The built-in library,
and the format, are in `lang/builder.js`.

**Tutor: think in the language's style**

Press **Tutor** in the menu bar. As you write, a tip balloon points out how the language likes things said,
the first time you use each habit (in Python: imports first, CAPITALS for settings, `self`, the `__main__`
guard, f-strings…), with the why behind it. Now and then it asks you to write one of your sentences
as real Python yourself, and checks the answer with the same exact comparison that proves round
trips: right or wrong, never a guess. Once you've written a habit right three times, its notes step
back, and **Write this line as Python** turns the sentence into the code you now know (checked to
make exactly the same program). In Read mode, **Style tour** walks through the habits of any Python
or C++ file, in reading order, so code an AI wrote for you becomes code you can read and take over.

The tutor speaks **C++ and Arduino** too: kinds before names (`int guesses = 0;`), `std::`, `const`,
the `;` and the braces, `cout <<`, references, classes with `public:` and `this->`, and on a board
`setup` and `loop`, `pinMode`, `INPUT_PULLUP` (pressed reads LOW), `millis()` instead of `delay`,
`unsigned long` for times. A C++ answer is right when C++ reads exactly the same tokens as the
expected line, however it is spaced.

Python's habits are found with Python's own parser (`style_points` in `lang/python_reader.py`),
C++'s with tree-sitter's (`cppStylePoints` in `lang/tutor.js`, where all the notes are too).

**Read: existing code → sections → plain English**

Import a whole project (a folder, a `.zip`, or drag and drop) or a single file, such as
code an AI wrote for you. Python, JavaScript (including React and TypeScript), HTML,
CSS and C++ (including Arduino sketches) are all read. For a project, IntuiCode shows:

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
- open the file as sentences, in any of these languages, and check that the sentences rebuild
  exactly the same code. Anything that can't be said in words stays as exact code on its own
  line (`python:`, `html:`, `css:`, `js:`, `c++:`), so nothing is lost or guessed. A web page
  comes with its own style sheet and script, as a website project.

## Desktop app

The desktop app (built with [Tauri](https://tauri.app)) adds what a browser can't do:

- **Real folders.** File → New project (Ctrl+N), Open folder (Ctrl+O) and Save (Ctrl+S). A new
  project can go straight into a folder you choose; IntuiCode won't save over another project's
  files. Your code files are the project;
  the sentences are kept in `.intuicode/` beside them. If the code on disk is changed in
  another editor, its sentences are rebuilt from it. A folder of Python, a web page, a C++
  program or an Arduino sketch that wasn't made with IntuiCode opens as sentences; anything
  else opens in Read mode.
- **Real Python.** Programs run with the Python installed on the computer, with live
  output, typed input and a Stop button, so web servers and packages work. Without Python
  installed, the built-in one is used.
- **C++.** Compiled with Visual Studio's `cl` on Windows (found automatically; install
  [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  with "Desktop development with C++" if you don't have it), or g++/clang++ on macOS and Linux.
- **Arduino.** Uses `arduino-cli`, found on the PATH or inside an installed Arduino IDE 2. The
  first time, install the board support: `$ arduino-cli core install arduino:avr`. Official
  boards are recognised on their USB port; for a board with a USB-serial chip (CH340, CP2102:
  many ESP32 and clone boards), type `board esp32` (or `uno`, `nano`, `mega`, or arduino-cli's
  full name for it) in the terminal once, and Run uploads to it.
- **Commands.** Type `$` and a command in the terminal to run it in the project folder:
  `$ git status`, `$ pip install flask`.

The window only works in folders you pick with its own Open/Save dialogs, and code you open is
never run in it: the website preview is sandboxed. See "nothing untrusted runs in the desktop
window" in [ARCHITECTURE.md](ARCHITECTURE.md).

### Getting the installer

Installers are built by GitHub for Windows, macOS and Linux: go to
**Actions → Desktop app → Run workflow**, or push a tag like `v0.1.0`. When it finishes,
the files are on the repository's **Releases** page.

To try a branch or pull request before it is released, open its **Desktop app tests** run:
under **Artifacts**, `IntuiCode-windows-exe` is the app as a single `intuicode.exe` that runs
without installing (`gh run download <run-id> -n IntuiCode-windows-exe` fetches it). It is a debug
build, so it starts a little slower than a released one.

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

The desktop app has its own tests, which open the real app window and drive it (Python with
typed input, shell commands, files and the folders allowed, the sandboxed preview, C++,
Arduino, code opened as sentences). GitHub runs them on Linux and on Windows (with Visual
Studio's compiler) for every push to `main` and every pull request
(**Actions → Desktop app tests**). To run them on Linux:

```
npm run tauri -- build --debug --no-bundle
cargo test --manifest-path src-tauri/Cargo.toml   # the desktop layer's own checks
cargo install tauri-driver --locked            # and: sudo apt install webkit2gtk-driver xvfb
xvfb-run node tests/e2e/run.mjs
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
| `lang/web_read.js` | JavaScript / React / TypeScript, HTML, CSS and C++ → sections, summaries, cross-language links |
| `lang/cpp_write.js` | Sentences → C++ and Arduino sketches |
| `lang/convert.js` | HTML, CSS, JavaScript, C++ and Arduino → sentences, checked exact against the original |
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
- **A new blueprint:** write it in the app (Library → Write or paste one), or add it to
  `BUILT_IN` in `lang/blueprints.js`. The format is described at the top of that file.
- **Reading more:** library descriptions live in `LIBRARIES`, safety checks in `Facts`,
  and pattern recognisers in `gists()` in `lang/python_reader.py`.
- **Another language:** a language pack exposes the same shape as `lang/python.js`
  (`compileProject`, `TEMPLATES`, `WORDS`, `GUIDE`, `OPENS_BLOCK`) on `window.IntuiLang`.

## License

IntuiCode is licensed under the [Apache License 2.0](LICENSE).

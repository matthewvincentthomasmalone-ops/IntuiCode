# IntuaCode

Write Python, websites, C++ and Arduino sketches by filling in ideas and sentences, and read
existing Python, JavaScript, HTML, CSS and C++ in plain English, or turn it into sentences.

IntuaCode is a rules-based translator, not an AI. Every sentence becomes a specific
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

Mechanics can make elements too, and they work like the ones in Structure:

```
for each task in tasks
    make a new list item saying task.text in todos and store in row
    when row is clicked
        run tick with task
when copy is clicked
    try
        wait for navigator.clipboard.writeText(passphrase)
        set the text of copied to "Copied."
    if it fails
        set the text of copied to "Select it and copy it yourself."
```

Everything you can start from is in **Project Templates**, by kind of project: Games, Productivity, Money,
Health & habits, Learning, Creative & media, Social & sharing, Tools & utilities, Websites, Online
services and Gadgets, then One idea at a time and Starting points. Each project says where it runs (PC,
Phone, Web or Board), and the chips at the top show only those. A **kit** plans a whole kind of project
step by step; a **blueprint** writes its sentences from a story with blanks. Blueprints are plain text:
you can edit any of them, save your own, or turn your current project into a blueprint and put blanks
where your projects usually differ (`shelf:` says which kind it is, `platform:` where it runs).

**Games** are sentences too. A drawing area in Structure, then in Mechanics:

```
keep track of the keys
every frame
    if "left" is held
        decrease player x by 4
    clear game
    draw a rectangle at player x, 200 sized 20 by 20 in "tomato" on game
    draw text "Score: {score}" at 10, 24 in "white" on game
when the screen is tapped
    play a note of 440 for 0.1 seconds
```

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

**Files and folders: one project, several languages**

A project is a tree of files. **+ File** and **+ Folder** (beside Project) add them; a file goes in a folder
when its name says so (`docs/plan.md`, `dsp/gain.py`). Each file has a language, from its ending or chosen
in the list, and the language decides how it's written:

| Language | You write | On the right |
|---|---|---|
| Python, HTML, CSS, JavaScript, C++, Arduino | sentences | the code they make |
| Rust, C#, Swift, Kotlin, Go, Lua, TypeScript… (30+) | the code itself | what it does, in plain words |
| Markdown, CSV, JSON, YAML, TOML, text | notes and data | Markdown as a page, CSV as a table, JSON's shape |

A file's **⋯** renames or moves it, changes its language (the text stays as it is), makes it the file
**Run starts** (marked *start*), or deletes it. A folder's **⋯** renames it (its files move with it) or
deletes it with what's in it. Run starts the start file in its own way: a page in the preview, Python
(from the project's folder, so `open("data/scores.csv")` works), C++ or a sketch; only problems in the
files that run stop it. Python files can use what the Python files before them define (the import is
added for you; the start file comes last), and a website's other pages, styles and scripts work with its
main page (`index.html`, `style.css`, `script.js`). **File → New project → Your own files** starts with
just a README.

**The Library: parts to add to a project**

**Library** (in the menu bar) is what goes *into* a project, where Project Templates is what you start
*from*. Two ways in:

- **Kinds of project** (web pages, phone apps and games, audio tools and DAWs, plug-ins, desktop apps,
  games, data and science, servers, boards and more): the languages each is usually written in and what
  each one does there, the frameworks people use, open-source projects worth reading (Ardour, Audacity,
  LMMS, Surge XT, Godot…, each with its licence and what to look at), the parts it's made of, and the
  Project Templates that fit.
- **Parts**, by what they do: Audio and DSP (gain in decibels, pan laws, filters, meters, compressors…),
  Music and MIDI, Interface, Shapes and colour, Games, Maths, Data, Files, Storage and databases,
  Networking, Security, Hardware, and **Coding integration**: ready-made code that joins two languages
  (Python calling C++, C++ in a web page with WebAssembly, a page talking to an Arduino, Rust from
  Python…), every side of the link at once.

A part comes in one or more languages; pick one and **Add to the project**. Sentences for a website, C++
or Arduino join the file of that language that's already there (they're one program); anything else gets
its own file (a Python one is a module the start file imports). A website part adds its page, styling and
script together. The Library is plain text in `lang/library/` (see its README), checked by the tests:
every sentence translates cleanly, and the audio and maths parts give the right numbers when they run.

**Plan a project: a map before you start**

**Plan** (in the menu bar, or from a kit in Project Templates) asks what you're making, by the same kinds as
Project Templates, then lists the steps that kind of project usually has, in the order you'd build them. Start from
the smallest that works, the usual, or everything; preview any step's sentences; and watch **Your plan**
fill in beside them before you name it and build. IntuaCode lays the steps out in your folders as
sentences, with a **Project map** beside the folders. Each step says how much is done for you:

- **Walk**: written out in full, to read, run and change.
- **Hallway**: the structure is there and the key parts are named; you fill in the ‹blanks›, with
  notes to guide you (a DAW's EQ gives you the filter and leaves its transfer-function numbers to you).
- **Horizon**: what it is, what it's usually made with, and what to learn first. Too big to write
  for you, but now you know where it goes.

Click a step for its role in the project and a jump to its sentences; the explanation panel says
which step your cursor is in. **+ Step** (beside Project map) adds a step of your own to any project: a
name, how far along it is, and what it's for. Its note goes at the cursor, so the map takes you there.

**Filling in a ‹blank›:** each one says what goes there in a few words (`set march wait to ‹ticks to wait
before the next step›`). With the cursor on it, the help under the windows says what kind of thing to write
(a number, a calculation, a test that's true or false…), how to work it out from the names the program
already has, and, behind **Show an example**, an answer that works, with **Put it in**. Tab selects the next
‹blank›; Problems lists the ones left, and clicking one selects it. Kit authors write these as `blank:` lines
(see `lang/kits/README.md`); the tests fill every ‹blank› with its answer and check the project works.

**Change this kit** (in planning, or from a kit in Project Templates) opens it as a form: its title, kind, where it
runs and what it's made of; its steps, which you can reorder, remove, mark as always included or ticked at
first, edit, add from any other kit, or write from scratch, with a Walk/Hallway/Horizon switch and its
sentences folder by folder. A check builds the kit as you go and says whether it works. A built-in kit is
changed as your copy, which replaces it (delete yours to get the original back), and a new kit appears in
planning under its kind as soon as it's saved. Everything underneath is plain text (**Edit as text**), kept
on your computer. The built-in templates and their format are in `lang/builder.js`, and more kits are in the
packs in `lang/kits/`.

**Full screen:** the corner button on the sentences, the code and the terminal makes that window fill the
work area; the same button, or Esc, brings the others back.

**More room:** **Hide help** (top right of the help under the windows) folds it into a slim bar, and the
chevron in the terminal's header folds the terminal down to that header. Drag the terminal's top edge to
make it taller or shorter (double-click it for the usual size). Run, and a program asking for input, bring
the terminal back; while it's folded, a dot on its tab says there's something new. IntuaCode remembers how
you left them.

**Drop down:** the **Drop down** button on the sentences puts a small box under every value: numbers (with
or without units), colour codes, colour names and CSS words like `center` or `bold`. **−** and **+** nudge it
(hold for more; for a colour they make it darker or lighter), and **▾** lists the values usually chosen in
that spot, each with what it means: line height says that 1.5 reads comfortably and headings sit tighter;
text size names 16 as the browser's usual size; a pin lists which pins can dim a light; a colour gets a
palette and a picker. Alt+↓ opens the list for the value at the cursor. What's usual where is plain data in
`lang/values.js`. (A plain CSS property given a value too many, like `line-height: 1.1 #000000`, is pointed
out with what was probably meant.)

**Images:** **File → Add an image…** (or **Add an image…** under the project's folders) adds a PNG, JPEG,
GIF, WebP or SVG to the project's `images/` folder, with a thumbnail. **Use** puts in a sentence that uses
it, for the folder you're in: `add a picture of "images/cat.png" described as "…"` (Structure),
`style page: background picture images/sky.jpg` (Styling), `load the picture "images/ship.png" as ship`
and then `draw ship at x, y on game` (Mechanics, for games), or `tk.PhotoImage(file="images/ship.png")`
(Python, in a tkinter window). The preview shows them straight away. Saving a project writes them into
`images/` beside the code; the browser keeps them for you until then.

**Two sides, and the help follows the one you're in**

Everything under the panes (the explanation, the tutor, the glossary) follows the side you're working
in, marked by the lamp on its title plate. In the **sentences**, it's about how things are said: the
shape a sentence follows (`while ‹condition›`, with your words in its parts), and how to talk to the
program (blocks, names, `store in`, quotes, `called`, groups, pins…). Click a line of the **code**, and
it's about the code: what each term in the line is, the names you made, and why it's written that way.
↑ and ↓ move through the code; Enter or a double-click goes to its sentence.

**Ctrl+H** explains the words in a selection, or in the section the cursor is in (the line and anything
indented under it). In the code, every term gets a definition, an example and related terms you can
follow. In the sentences only the words that aren't everyday English get one (`hero`, `cta`, `pull-up`,
`give back`…); where a section is all everyday words, it shows the shapes those sentences follow, and
others in the same family, instead. The terms are plain data in `lang/glossary_terms.js`; finding them is
`lang/glossary.js`.

**Tutor: think in the language's style**

Press **Tutor** in the menu bar. In the sentences, a balloon introduces each way of talking to the program
the first time you use it, and **✎ Say it yourself** covers a sentence and asks you to say its code in
words: any sentence that makes exactly the same program is right, so other ways of saying it count. In
the code, a balloon points out how the language likes things said the first time you meet each habit
(in Python: imports first, CAPITALS for settings, `self`, the `__main__` guard, f-strings…), with the why
behind it, and **✎ Write it yourself** covers the code and asks you to write it, checked with the same exact
comparison that proves round trips: right or wrong, never a guess. Once you've written a habit right three
times, its notes step back, and **Write this line as Python** turns the sentence into the code you now
know (checked to make exactly the same program). In Read mode, **Style tour** walks through the habits of
any Python or C++ file, in reading order, so code an AI wrote for you becomes code you can read and take over.

The tutor speaks **C++ and Arduino** too: kinds before names (`int guesses = 0;`), `std::`, `const`,
the `;` and the braces, `cout <<`, references, classes with `public:` and `this->`, and on a board
`setup` and `loop`, `pinMode`, `INPUT_PULLUP` (pressed reads LOW), `millis()` instead of `delay`,
`unsigned long` for times. A C++ answer is right when C++ reads exactly the same tokens as the
expected line, however it is spaced.

Python's habits are found with Python's own parser (`style_points` in `lang/python_reader.py`),
C++'s with tree-sitter's (`cppStylePoints` in `lang/tutor.js`, where all the notes are too).

**Unity: the project in one pane, any part of it in sentences**

**Unity** (beside Write and Read) is the same project as Write mode, in one pane instead of two: the file
picked in the project's tree (on the left, with Problems), its sentences in translucent dark green and its exact
lines (`python: …`, `c++: …`) as plain code. Parts added from the Library, new files and other projects show
up in it straight away, and Write mode always shows the same file. Select some code and press **Translate to Plain Language Syntax** (Ctrl+Shift+D, or the button that appears
over the selection): those lines turn into sentences right where they are, shown in translucent dark
green. The selection grows to whole statements (an `if` takes its `else`; a `{` takes its `}`), and it
can take in green parts (even Select all): they stay as they are, and only the code around them is
translated. Change
the sentences, and **Original Code** (Ctrl+Shift+B) turns them back into code in the same place:

- a part nobody changed comes back **exactly** as it was;
- a changed part is written in the context of the code around it, so the names and kinds there are
  known, and it comes back in the file's own indentation, with any `import` or `#include` it now needs
  added at the top;
- a part with a problem stays as sentences until it's fixed, and the strip under the pane says why
  (and shows the code it will write while you type).

What turns into code is the file's own code, so the code IntuaCode writes around a file (a C++ `main` and its
includes, a page's head) isn't shown, as in Write mode. A C++ file's tools, classes and includes stay as
sentences, because their code goes above `main`; each statement in it is its own green part. **Open a file…**
adds a code file from your computer to the project: Python, CSS and JavaScript come in as code, a whole C++
program, Arduino sketch or HTML page as sentences (IntuaCode writes its `main`, `setup` and `loop`, or head).
Notes and other files open as they are.

The code takes the top three quarters of the window, the terminal the rest; fold the terminal away and the
code takes its room too, or press the corner button for full screen (Esc comes back). **Copy the code** copies
the file's code, what Run uses. It's what IntuaCode does everywhere, a piece at a time: the symbols of a
language said as words, and back.

**Read: existing code → sections → plain English**

Import a whole project (a folder, a `.zip`, or drag and drop) or a single file, such as
code an AI wrote for you. Python, JavaScript (including React and TypeScript), HTML,
CSS and C++ (including Arduino sketches) are read in depth, and can be opened as sentences. Every
other language in the file list is read too: C, Rust, Go, Zig, C#, Java, Kotlin, Swift, Scala,
Objective-C, PHP, Ruby, Bash, Elixir, Lua, Dart, Elm, OCaml, Solidity, SQL, Vue, and data and notes
(JSON, YAML, TOML, CSV, Markdown), each split into its parts (tools, types, tests, starting points…)
and said in plain English (`lang/code_read.js`). The language comes from the file's name; pasted code
and files whose name doesn't say are **auto-detected** from their text (with the reason shown), and
**Read as** above the code picks another language for a file. For a project, IntuaCode shows:

- what kind of app it looks like, and which file to start reading;
- a reading order, and a map of which files use which;
- a role for every file (starting point, web routes, data models, settings, helpers, tests);
- outside libraries, and any that `requirements.txt` forgets to list;
- a `.env` secrets file if one was included (its contents are never read);
- everything worth checking across all files, each linked to the exact place.

Summaries link across files and languages: "uses `get_db` from db.py", "the page's
script uses `#task-list` in index.html", "styled by `.card` in style.css", and
"`fetch('/api/tasks')` is answered by `list_tasks` in routes/tasks.py".
Inside each file, IntuaCode will:

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
  project can go straight into a folder you choose; IntuaCode won't save over another project's
  files. Your code files are the project;
  the sentences are kept in `.intuicode/` beside them. If the code on disk is changed in
  another editor, its sentences are rebuilt from it. A folder of Python, a web page, a C++
  program or an Arduino sketch that wasn't made with IntuaCode opens as sentences; anything
  else opens in Read mode. Files, folders and `.zip` files dropped on the window open in Read mode.
- **Real Python.** Programs run with the Python installed on the computer, with live
  output, typed input and a Stop button, so web servers and packages work. Without Python
  installed, the built-in one is used. Stop, or closing IntuaCode, ends a program and anything it
  started. If the project folder has a virtual environment (`.venv` or `venv`), Run and `$`
  commands use its Python and pip. On Linux that is how packages are installed, because the
  system's Python keeps its packages for the system: type `$ python3 -m venv .venv`, then
  `$ pip install flask` (Ubuntu and Debian need `python3-venv` first, which the `.deb` brings).
- **C++.** Compiled with Visual Studio's `cl` on Windows (found automatically; install
  [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  with "Desktop development with C++" if you don't have it), or g++/clang++ on macOS and Linux.
- **Arduino.** Uses `arduino-cli`, found on the PATH or inside an installed Arduino IDE 2. On
  Linux it is also found in `~/bin` (where its install script puts it), `~/.local/bin`, the snap,
  or an Arduino IDE 2 unpacked from its `.zip` (in your home folder, `~/Downloads` or `/opt`) or
  installed from Flathub; the IDE's AppImage keeps its arduino-cli out of reach. Uploading on Linux
  needs your account in the `dialout` group (`uucp` on Arch), once:
  `$ sudo usermod -aG dialout $USER`, then log out and back in. The
  first time, install the board support: `$ arduino-cli core install arduino:avr`. Official
  boards are recognised on their USB port; for a board with a USB-serial chip (CH340, CP2102:
  many ESP32 and clone boards), type `board esp32` (or `uno`, `nano`, `mega`, or arduino-cli's
  full name for it) in the terminal once, and Run uploads to it.
- **Commands.** Type `$` and a command in the terminal to run it in the project folder:
  `$ git status`, `$ pip install flask`. On Linux, `$ sudo …` asks for your password in a window
  when the computer has a password helper (KDE's `ksshaskpass`, or `ssh-askpass`); without one,
  run sudo in your own terminal.

The window only works in folders you pick with its own Open/Save dialogs (or drop on it), and code you open is
never run in it: the website preview is sandboxed. See "nothing untrusted runs in the desktop
window" in [ARCHITECTURE.md](ARCHITECTURE.md).

### Getting the installer

Installers are built by GitHub for Windows, macOS and Linux: go to
**Actions → Desktop app → Run workflow**, or push a tag like `v0.1.0`. When it finishes,
the files are on the repository's **Releases** page.

To try a branch or pull request before it is released, open its **Desktop app tests** run:
under **Artifacts**, `IntuaCode-windows-exe` is the app as a single `intuicode.exe` that runs
without installing (`gh run download <run-id> -n IntuaCode-windows-exe` fetches it). It is a debug
build, so it starts a little slower than a released one.

These builds aren't code-signed yet, so the first time you open the app:

- **Windows:** if SmartScreen says "Windows protected your PC", choose **More info → Run anyway**.
- **macOS:** right-click the app and choose **Open**, then **Open** again (or System Settings →
  Privacy & Security → **Open Anyway**).
- **Linux:** install the `.deb` with `sudo apt install ./IntuaCode*.deb` (Ubuntu, Debian, Mint;
  it also brings Python's venv support and g++), or the `.rpm` with `sudo dnf install ./IntuaCode*.rpm`
  (Fedora). Or make the `.AppImage` executable (`chmod +x IntuaCode*.AppImage`) and run it.

### Building it yourself

You need [Rust](https://rustup.rs) and Node.js, plus on Linux:
`sudo apt install build-essential libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`.

```
npm install && npm run vendor && python3 tools/fetch_pyodide.py
npm run desktop:dev      # run it
npm run desktop:build    # make an installer for this computer
```

On Linux, `desktop:build` makes a `.deb`, an `.rpm` and an `.AppImage` in
`src-tauri/target/release/bundle/`. An AppImage runs on Linux versions as new as the one it was
built on, or newer, which is why the released one is built on Ubuntu 22.04.

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

The browser version is at **https://intuacode.com**. Every push to `main` publishes it
(`.github/workflows/pages.yml`, GitHub Pages), with Python and the parsers bundled.

To run it on your own computer:

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
| `lang/languages.js` | Every language a project's file can be in: its endings, its tree-sitter grammar, and whether it's written in sentences, as code or as text |
| `lang/project.js` | A project as a tree of files: paths checked, each engine compiling its own files, Markdown/CSV/JSON shown as what they are |
| `lang/library.js`, `lang/library/` | The Library: kinds of project and the parts they're made of, in plain-text packs |
| `runner.js` | Runs Python in the page; handles `input()` by replaying answers; stops endless loops |
| `app.js`, `app.css`, `index.html` | The editor: folders, sentence editor, Python view, explain strip, Read mode, terminal, Index |
| `samples/` | Example code for Read mode, including a small multi-file project (`samples/taskboard`) |
| `run.py` | Small local server (adds the `<html>` wrapper that `index.html` leaves out) |
| `src-tauri/` | The desktop app: folders, running programs, the native window (Rust) |
| `tools/build_desktop.mjs` | Gathers the app's files into `dist/` for the desktop build |
| `tests/desktop-mock.html` | Runs the app with a pretend desktop layer, to test desktop features in a browser |

The reader can be used on its own: `python3 lang/python_reader.py some_file.py`

### Extending it

The language itself (file format, grammar, precedence, context, known wrong translations, and an index of
every sentence pattern) is described in [INTUICODE.md](INTUICODE.md). Its examples are tests.

- **A new sentence:** add a `rule(regex, fn)` in `lang/python.js` (first match wins), then a
  matching entry in `TEMPLATES` so it appears in the phrase picker and the Index. After changing
  `TEMPLATES` or `WORDS` in any writer, run `node tools/intuicode_index.mjs` to update the index in
  `INTUICODE.md` and `lang/intuicode_index.json` (`npm test` fails until you do).
- **A new word inside sentences:** add to `EXPR_RULES` (for example `length of x` → `len(x)`).
- **A new blueprint:** write it in the app (Project Templates → Write or paste one), or add it to
  `BUILT_IN` in `lang/blueprints.js`. The format is described at the top of that file.
- **A new Library part or kind of project:** add an entry to a pack in `lang/library/` (the format is at the
  top of `lang/library.js`, the writing guide in `lang/library/README.md`). `tests/library.test.mjs` checks
  it translates cleanly and parses; add a number check if it computes something.
- **Reading more:** library descriptions live in `LIBRARIES`, safety checks in `Facts`,
  and pattern recognisers in `gists()` in `lang/python_reader.py`.
- **Another language:** a language pack exposes the same shape as `lang/python.js`
  (`compileProject`, `TEMPLATES`, `WORDS`, `GUIDE`, `OPENS_BLOCK`) on `window.IntuiLang`.

## License

IntuaCode is licensed under the [Apache License 2.0](LICENSE).

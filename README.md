# IntuaCode

Write Python, websites, React and TypeScript, C++ and Arduino sketches by filling in ideas and sentences, and
read existing Python, JavaScript, TypeScript, React, HTML, CSS and C++ in plain English, or turn it into sentences.

IntuaCode is a rules-based translator, not an AI. Every sentence becomes a specific
line of Python, every summary points at real lines, and the same input always gives
the same result. The aim is to let intuition and plain language lead, while you stay
directly connected to every part of the code.

**Get it:** the public website is offline while IntuaCode becomes a paid product. The installers for Windows, Linux
and macOS are on the repository's **Releases** page, each with its SHA-256, and `npm run site` runs the website and
the browser version on this computer only (http://127.0.0.1:8080; see "Run it"). [SECURITY.md](SECURITY.md) says what
IntuaCode does with your code (nothing leaves your computer), how to check a download, and how to report a problem.

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

Styling and Mechanics can point at a thing three ways:
- by its **name**, in any capitals;
- by the **text it shows**, in quotes. For example, `set "Welcome" colour to navy`: IntuaCode names it in the page for you.
- by its **kind**: `the big heading`, `every button`.

Styling also takes everyday sentences: `set save background to white`, `give save a red border`,
`make the big heading bold`, `add group card: rounded corners, shadow`, `add save to group card`,
`add a colour called main #4f7cff`.

When a named part is added in Structure, Styling gets `style save:` ready to fill in. A button or form also
gets `when save is clicked` (or `is sent`) in Mechanics. Predictive Mode in each file offers what the others
have: Styling and Mechanics offer Structure's parts, and Structure offers the names they use that it doesn't
have yet.

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

Everything you can start from is in **Project Templates** (in the Menu), by kind of project: Games, Productivity, Money,
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

**React and TypeScript**, the stack most AI builders write (Lovable, Cursor, Claude Code, Codex), are sentence
languages too. Import an app an AI wrote, select any part in Unity and translate it: a component reads as
`define component Card using title and children from CardProps`, its state as `keep count, starting at 0`, an
effect as `whenever query changes`, and what it shows as the Structure words (`a heading saying {title}`,
`a ghost Button saying "Save", running save when clicked`), Tailwind classes in words (`styled as flexible layout,
items centred, gap 2`), Supabase queries as what they ask (`every row of the "notes" table in supabase sorted by
"created_at" from the end`). Types count: a sentence that would lose one stays as exact code (`ts:`, `tsx:`). Every
translation is checked against the original's syntax tree, so the sentences rebuild exactly the same program, or
the part stays as code and says why.

**Running a React app (desktop app).** Open a Vite app's folder (Lovable's projects are Vite apps) with
**Menu → Open folder**. It opens in place: every file comes in as its exact lines, and saving writes back only
the files you change, keeping their line endings. **Run** starts the project's own `npm run dev` and shows it in
the Preview; each change is saved a moment later and the dev server shows it, keeping the page's state. Its
packages are the project's own (`$ npm install` once, with [Node.js](https://nodejs.org)). Other sites the app
contacts are allowed, and the terminal lists each one. The browser version reads, edits and checks React apps
but doesn't run them.

**Files and folders: one project, several languages**

A project is a tree of files. **Menu → New file** and **New folder** add them, and **Import** (beside Project)
brings in files or a whole folder; a file goes in a folder
when its name says so (`docs/plan.md`, `dsp/gain.py`). Each file has a language, from its ending or chosen
in the list, and the language decides how it's written:

| Language | You write | On the right |
|---|---|---|
| Python, HTML, CSS, JavaScript, TypeScript, React (`.tsx`, `.jsx`), C++, Arduino | sentences | the code they make |
| Rust, C#, Swift, Kotlin, Go, Lua, Vue… (30+) | the code itself | what it does, in plain words |
| Markdown, CSV, JSON, YAML, TOML, text | notes and data | Markdown as a page, CSV as a table, JSON's shape |

A file's **⋯** renames or moves it, changes its language (the text stays as it is), makes it the file
**Run starts** (marked *start*), or deletes it. A folder's **⋯** renames it (its files move with it) or
deletes it with what's in it. Run starts the start file in its own way: a page in the preview, Python
(from the project's folder, so `open("data/scores.csv")` works), C++ or a sketch; only problems in the
files that run stop it. Python files can use what the Python files before them define (the import is
added for you; the start file comes last), and a website's other pages, styles and scripts work with its
main page (`index.html`, `style.css`, `script.js`). **Menu → New project → Your own files** starts with
just a README.

**The Library: parts to add to a project**

**Library** (in the Menu) is what goes *into* a project, where Project Templates is what you start
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
name, how far along it is, what it's for, and how to check it's done. Its note goes at the cursor, so the map
takes you there.

**Ticking steps off.** Each step on the map has a checkbox and one line on how to check it's done (kits supply
their own; otherwise the step's depth says). The map counts them (**3 of 9 done**), the ticks are saved with the
project, and opening a project scrolls the map to the first step not done. A step's window lets you change its
check line.

**Hand to my AI.** For an AI assistant of your own to build from: **Hand to my AI** (under the map's count, or
in the File menu) writes the map as an [OpenSpec](https://openspec.dev) change. `proposal.md` says why, what each
step is for and which files it touches; `tasks.md` lists the steps as `- [ ] 1.1 …` tasks, each with its check,
ticked ones as `- [x]`. The desktop app writes them into the saved project's folder, at
`openspec/changes/<name>/`; the browser gives them as a `.zip` to unzip there. Nothing is sent anywhere: the AI
stays outside IntuaCode.

The tasks your AI ticks come back to the map. On the desktop, opening the project's folder takes the new ticks
from its `tasks.md` (the terminal says which), and Hand to my AI offers **Take its ticks** before writing over
them. In the browser, **Take ticks from a tasks.md…** reads one you choose. Only ticks come back: a task left
unticked there never unticks a step, and tasks the AI added of its own are left alone.

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

**Predictive Mode:** the black **Predictive Mode** button on the sentences turns predictions on and off. While
it's on, the sentence you're typing is predicted the way a terminal predicts a command: the rest of it shows
after the cursor in dim text, and a list under the line shows other guesses. Guesses come from sentences
you've written before (in the project's files, and every line you finish with Enter, newest first), then
the sentences IntuaCode knows (with their blanks), then the names in your program. **→** takes all of
the dim text, **Ctrl+→** one word, **↑ ↓** choose another, **Tab** or **Enter** use the one picked, and
**Esc** puts it away. Off, nothing pops up while you type. IntuaCode remembers whether it's on, and the
history of lines stays in this browser or app (`lang/predict.js`).

**Drop down:** the **Drop down** button on the sentences puts a small box under every value: numbers (with
or without units), colour codes, colour names and CSS words like `center` or `bold`. **−** and **+** nudge it
(hold for more; for a colour they make it darker or lighter), and **▾** lists the values usually chosen in
that spot, each with what it means: line height says that 1.5 reads comfortably and headings sit tighter;
text size names 16 as the browser's usual size; a pin lists which pins can dim a light; a colour gets a
palette and a picker. Alt+↓ opens the list for the value at the cursor. What's usual where is plain data in
`lang/values.js`. (A plain CSS property given a value too many, like `line-height: 1.1 #000000`, is pointed
out with what was probably meant.)

**Images:** **Menu → Add an image…** (or **Add an image…** under the project's folders) adds a PNG, JPEG,
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
know (checked to make exactly the same program).

The tutor speaks **C++ and Arduino** too: kinds before names (`int guesses = 0;`), `std::`, `const`,
the `;` and the braces, `cout <<`, references, classes with `public:` and `this->`, and on a board
`setup` and `loop`, `pinMode`, `INPUT_PULLUP` (pressed reads LOW), `millis()` instead of `delay`,
`unsigned long` for times. A C++ answer is right when C++ reads exactly the same tokens as the
expected line, however it is spaced.

Python's habits are found with Python's own parser (`style_points` in `lang/python_reader.py`),
C++'s with tree-sitter's (`cppStylePoints` in `lang/tutor.js`, where all the notes are too).

**Unity: the project in one pane, any part of it in sentences**

IntuaCode opens in **Unity** (Split Mode is the other mode, and the one used last is remembered). Unity
shows the file picked in the project's tree as real code, its sentences in translucent dark green and its exact
lines (`python: …`, `c++: …`) as plain code. Parts added from the Library, new files and imported code show
up in it straight away, and Split Mode always shows the same file. Select some code and press **Translate to
Plain Language Syntax** (Ctrl+Shift+D, or the button that appears over the selection): those lines turn into
sentences right where they are, in green. The selection grows to whole statements (an `if` takes its `else`;
a `{` takes its `}`), and it can take in green parts (even Select all): they stay as they are, and only the
code around them is translated. Change the sentences, and **Original Code** (Ctrl+Shift+B) turns them back into
code in the same place:

- a part nobody changed comes back **exactly** as it was;
- a changed part is written in the context of the code around it, so the names and kinds there are
  known, and it comes back in the file's own indentation, with any `import` or `#include` it now needs
  added at the top;
- a part with a problem stays as sentences until it's fixed, and the help says why (and shows the code
  it will write while you type).

Pressing **Original Code** (or **Original Code (all)**) turns Predictive Mode off, and the button becomes a
pressed **Revert**. Press it again to put the sentences, and Predictive Mode, back as they were. Edit the code
in between and the button goes back to Original Code.

**Split Mode's left pane is always sentences.** Code parts a file has in Unity are said in sentences when it's
shown there (a line no sentence can say stays as exact code, and the terminal says which). Back in Unity they
are code again: exactly as they were if nothing changed in Split Mode, or written from the sentences as edited.

The **help** under the pane is Split Mode's help: on a green line, the sentence and the code it makes, its
shape and its words; on a line of code, the terms in it and the part it belongs to. **Hide help** folds it
away. **Predictive Mode** works in green parts as it does in Split Mode: the rest of the sentence shows dim
after the cursor (→ takes it, Ctrl+→ one word). **Copy** copies the file's code, what Run uses.

What turns into code is the file's own code, so the code IntuaCode writes around a file (a C++ `main` and its
includes, a page's head) isn't shown, as in Split Mode. A C++ file's tools, classes and includes stay as
sentences, because their code goes above `main`; each statement in it is its own green part.

**Import: code from anywhere becomes the project's own files**

**Import** (beside Project, or **Menu → Import code…**) brings in a single file, pasted code, a whole folder, a
`.zip` or the example project, such as code an AI wrote for you. A folder, `.zip` or example becomes a new
project (the one before is kept: type `restore` to swap back); single files join the open project. Python,
CSS, JavaScript, TypeScript and React come in as their exact lines, ready to translate any part in Unity; HTML
pages, C++ programs and Arduino sketches are read into sentences (checked against the original), because
IntuaCode writes the page, `main` or `setup` and `loop` around them. Every other language (C, Rust, Go, C#,
Java, Kotlin, Swift, PHP, Ruby, Bash, Lua, Dart, SQL, Vue…), and data and notes (JSON, YAML, TOML, CSV,
Markdown), comes in as it is, and the help reads it to you part by part (`lang/code_read.js`). A `.env`
secrets file is never brought in. Pasted code and files whose name doesn't say are **auto-detected** from
their text, with the reason shown.

**Saving and Backups**

The open project is kept in the browser as you work. **Menu → Save** (Ctrl+S) in a browser downloads it as a
`.zip`, laid out as the desktop app saves a folder (the code files, your sentences in `.intuicode/`, pictures
in `images/`); Import → Open a `.zip` opens it again exactly as it was. Leaving the page with changes since the
last Save asks first. **Menu → Backups…** lists a copy of the project from every 2 minutes it changed, the last
15 (half an hour), kept in this browser (or the desktop app) for whichever project was open; Restore brings one
back, after keeping a copy of what's open now.

**Parts: the project by what each piece is for**

Every file is split into **parts** (a function, a page section, a style rule, a block of settings, a sentence
and the sentences under it), and each part has a type (`lang/parts.js`):

| Type | What it covers |
|---|---|
| **Interface & Display** | what people see and use: pages, screens, layout, styles, text, buttons, lights, sound |
| **Backend & Mechanics** | what works behind the scenes: logic, calculations, data, saving, timing, other programs |
| **Setup & Settings** | what gets things ready: imports, settings, pins, configuration and build files |
| **Data & Notes** | data files, content and notes |
| **Tests & Checks** | test files, test functions and benchmarks (a `tests/` folder, `test_x.py`, `x.test.js`, `XTests.cpp`, `TEST(…)`, `it("…")`) |

The side panel has two views. The seafoam button beside **Import** switches between them:

- **File View** shows the project's files and folders.
- **CodeParts** lists every part of every file. It can group them **by Type**, **by File** or **by
  Language** (each language with what it does in the project: "HTML: the page", "CSS: how it looks").
  **Find a part** searches names, files and the parts' own words. Click a part to open it. A long group
  lists 80 parts, then more on request.

Each file in the tree shows a dot for Interface and one for Mechanics if it has them. A C++ function is
named as `Class::method()`, even when its `{` is on the next line or it sits in a `namespace`. A test is
named by what it tests.

The buttons at the top (**Interface**, **Mechanics**, **Setup**, **Data** and **Tests**) show only that
kind of part:

- The side panel switches to CodeParts (and back when you press the button again) and lists only those
  parts, file by file.
- The main pane shows only them: each part with its own lines and line numbers, file by file, a page at a
  time.
- **Open** on a part, or **Edit whole files**, goes back to the editor. There the part's file is shown
  whole, everything else stepped back, and the lines of a shown part that do something else (the `delay`
  in a loop that lights an LED) half dimmed.
- The Library keeps only parts with that kind of code.

Most people reading code an AI wrote start with **Interface**: it's the part you can see change.

**Project Link: what you're using, in the code**

With a website open in the **Preview**, **Project Link** (on by default, beside Pick from the page) lights up the
code behind whatever you're using in the page, in light pink: pointing at an element marks its sentence and the
ones inside it, the style rules that match it and the script lines that name it; clicking or typing marks the
handler that answered. It shows in Unity's pane and in both panes of Split Mode, and on the files, folders and
parts in the side. A bar over the preview says what's in use and where its code is; click a file there to open
it. Pointing never scrolls; a click brings the code into view. Predictive Mode and Project Link take turns:
turning one on turns the other off, so clicking around a running page never brings up predictions.

Project Link works on pages IntuaCode serves in the Preview, not on a site running on its own domain: IntuaCode
marks each element of its pages with its sentence line, and a live site has none of those marks (and the browser
keeps other sites' pages apart).

**The Preview's address**

In the desktop app the Preview serves every file of the project at a local address, shown over the page
(`http://127.0.0.1:…`, only this computer can open it), as any web server would: a page loads its other scripts
and modules, JSON, pictures and sounds by path, and a file that isn't in the project gets "404 Not Found" (the
terminal says which). That address is a secure context, so Web MIDI and Web Serial work where the window has
them (Windows); **Open in your browser** opens the same page in your own browser. The browser version shows one
page, with its style sheets and main script inlined; a page that loads other files (a module, say) needs the
desktop app, and the Preview says what didn't load.

## Desktop app

The desktop app (built with [Tauri](https://tauri.app)) adds what a browser can't do:

- **Real folders.** Menu → New project (Ctrl+N), Open folder (Ctrl+O) and Save (Ctrl+S). A new
  project can go straight into a folder you choose; IntuaCode won't save over another project's
  files. Your code files are the project;
  the sentences are kept in `.intuicode/` beside them. If the code on disk is changed in
  another editor, its sentences are rebuilt from it. A folder of Python, a web page, a C++
  program or an Arduino sketch that wasn't made with IntuaCode opens as sentences; any other
  folder of code comes in as a new project, as Import does. Folders and `.zip` files dropped on the window
  come in as projects; single files join the open one. Closing the window with changes since the last
  Save asks whether to save them first (they're in Backups either way).
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
never run in it: the website preview runs at its own local address, apart from the editor, and can't use the
app's commands. See "nothing untrusted runs in the desktop window" in [ARCHITECTURE.md](ARCHITECTURE.md).

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

The website (the home page, with the browser version under `/app/`) runs on this computer only, on the loopback
address:

```
npm run site
```

Then open http://127.0.0.1:8080 (the app is at http://127.0.0.1:8080/app/). It builds the app (`dist/`) and the
site (`_site/`): `tools/build_site.mjs` puts the home page (`site/`) at the top, the app under `app/`, the newest
release's downloads and checksums in `downloads.json`, and `.well-known/security.txt`. `tools/serve_site.mjs`
serves it on 127.0.0.1 only, so nothing else on the network can reach it; `node tools/serve_site.mjs 9000` serves
an already-built `_site/` on another port.

The public website (GitHub Pages, `.github/workflows/pages.yml`) is offline while IntuaCode becomes a paid product;
that workflow only checks that the site builds. pages.yml says how to publish it again under the final domain.

Installers come from `.github/workflows/desktop.yml` (Actions → Desktop app → Run workflow on `main`): Windows,
Linux and macOS for the version in `src-tauri/tauri.conf.json`, attached to a GitHub Release with
`SHA256SUMS.txt` and a signed provenance attestation each.

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
| `lang/convert.js` | HTML, CSS, JavaScript, TypeScript, React, C++ and Arduino → sentences, checked exact against the original |
| `lang/ts_write.js` | Sentences → TypeScript and React (built on the JavaScript writer), and the Lovable-stack phrase packs (Tailwind, shadcn/ui, react-router, TanStack Query, Supabase) |
| `lang/ts_convert.js` | What TypeScript and React add to the JavaScript reader: types, shapes, components, state, effects, JSX |
| `lang/blueprints.js` | Blueprint format, built-in blueprints, filling blanks |
| `lang/languages.js` | Every language a project's file can be in: its endings, its tree-sitter grammar, and whether it's written in sentences, as code or as text |
| `lang/project.js` | A project as a tree of files: paths checked, each engine compiling its own files, Markdown/CSV/JSON shown as what they are |
| `lang/library.js`, `lang/library/` | The Library: kinds of project and the parts they're made of, in plain-text packs |
| `lang/openspec.js` | Hand to my AI: the project map as an OpenSpec change (`proposal.md`, `tasks.md`), and the `.zip` the browser offers |
| `runner.js` | Runs Python in the page; handles `input()` by replaying answers; stops endless loops |
| `app.js`, `app.css`, `index.html` | The editor: Unity and Split Mode, the project tree and its parts, the help, Project Link, terminal, Index |
| `samples/` | Example code to import, including a small multi-file project (`samples/taskboard`) |
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

IntuaCode is source-available under the [Business Source License 1.1](LICENSE):

- **Free** for individuals using it for their own personal, non-commercial purposes: learning, hobby projects, and
  reading, checking and changing code they own.
- **A commercial licence** is needed for everything else: use by or for a company, school or other organisation,
  paid work, building or running a product or business, and offering IntuaCode (or something made from it) to
  others as a service or bundle. Organisations may evaluate it free for 60 days.
- **Each version becomes Apache 2.0** four years after it's published. Versions 0.6.0 and earlier were published
  under Apache 2.0 and stay that way.

Bundled third-party parts (Pyodide, tree-sitter and its grammars, the fonts and, in the desktop app, its Rust
crates) keep their own licences: they're listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), made by
`node tools/third_party.mjs` (run it again when one of them changes). Every package carries both files: the
installers show the licence before installing, the app keeps both beside it, and **Menu → About and licence…**
shows them in the app.

Releases are built as **drafts**: private on GitHub until they're published by hand (Releases → Edit → Publish).

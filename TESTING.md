# Trying IntuaCode on another computer

A 15-minute hands-on check of the desktop app. Automated tests already drive the real app on
Linux and Windows (see **Actions → Desktop app tests**); this list is for what they can't judge:
how it feels, and your own machine.

## 1. Install

From the repository's **Releases** page, signed in to GitHub, take the newest `v0.x` release (releases are drafts, so
only the owner sees them; or `gh release download <tag>`):

- **Windows:** `IntuaCode_…_x64-setup.exe` (or the `.msi`). SmartScreen will warn because the app
  isn't signed yet: **More info → Run anyway**.
- **macOS:** the `.dmg`. First launch: right-click the app → **Open** → **Open**.
- **Linux:** the `.deb` (`sudo apt install ./IntuaCode*.deb`), the `.rpm` (`sudo dnf install ./IntuaCode*.rpm`),
  or the `.AppImage` (`chmod +x`, then run it).

Optional, for the C++ and Arduino checks:

- **Windows C++:** [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/),
  with the **Desktop development with C++** workload. (If Visual Studio with C++ is installed, that works too.)
- **Arduino:** the [Arduino IDE 2](https://www.arduino.cc/en/software) (IntuaCode uses the
  arduino-cli inside it). A board is optional.

## 2. Checklist

Tick each one. If something is off, note what you did and what the terminal said.

**Start**
- [ ] The window opens. The terminal says which Python it found ("Desktop app: programs run with Python 3.x…").

**New project**
- [ ] Menu → New project (or Ctrl+N): pick a kind, type a name, leave "Choose a folder for it now" ticked,
      Create, and choose an empty folder: the project's files appear there.
- [ ] Try again choosing a folder that already has a project: nothing is written, and the terminal says why.

**Saving, Backups and closing**
- [ ] With no folder yet, the header shows no folder name; after Save it shows the folder's name.
- [ ] Change a sentence and close the window: "Save before closing?". Cancel keeps it open; Save saves (asking for a
      folder the first time), then closes; Don't save closes. Without changes since the last Save it just closes.
- [ ] Work for a few minutes, then **Menu → Backups…**: copies 2 minutes apart, newest first, each with its project's
      name and file count. Restore one: it opens, and a copy of what was open is now at the top (Restore that to undo).
- [ ] In a browser: Ctrl+S downloads `<project>.zip`; Import → Open a .zip opens it as it was. Change something and
      reload: the browser asks before leaving.

**Planning and Project Templates**
- [ ] **Project Templates**: projects by kind (Games, Productivity, Money…), each tagged PC, Phone, Web or Board; the chips at the
      top show only those. A kit's **Choose its steps…** opens planning at that kit; **Plan one ›** at its kind.
- [ ] **Menu → New project → Plan it step by step** → Creative & media → Audio workstation: the stages at the top move on; **The smallest that
      works**, **The usual** and **Everything** change **Your plan**; **Preview its sentences** shows a step's sentences.
      Tick Mixer, Build my project: the Project map lists the steps in order, and Problems lists the hallway ‹blanks›.
- [ ] Click a step in the Project map: its window explains it, and "Go to its sentences in Tools" jumps there. Fill the
      blanks and Run: the terminal shows the peak and RMS levels, and `output.wav` plays.
- [ ] **Change this kit…**: move a step, untick Always, add a step from the templates (search "save"), write a new step;
      the check under the steps says whether the kit builds. Save: planning uses your version. Delete yours (in the
      list on the left): the original comes back.
- [ ] Build a game from Project Templates (Games): it plays in the preview with the keys or a tap.
- [ ] The corner button on the sentences, the code and the terminal: each fills the work area; Esc comes back.
- [ ] **Hide explanation**, then the terminal's chevron: the sentences and code grow. Drag the terminal's top edge; double-click
      it. Run brings the terminal back. Close and reopen the app: it's as you left it.

**Project map: ticks, and Hand to my AI** (in Unity, then again in Split Mode)
- [ ] Menu → Plan a project… → Websites → Showing my work → Build. The Project map shows each step with a checkbox and,
      under it, how to check it's done; above the steps, **0 of 9 done**.
- [ ] Tick steps 1 to 3: the count and the bar move on, each ticked step drops its check line, and the terminal names the
      next step. Untick one: it's back.
- [ ] Click step 6: its window has **How to check it's done**, with **Done** and the line itself. Change the line, press
      Esc: the map shows the new line. **Go to its sentences in Mechanics**: the cursor is on its `── Step 6 ·` note (in
      Unity too).
- [ ] **+ Step** with **Check it's done** filled in: the new step shows that line. Left empty: the depth's own line shows.
- [ ] Save, close the app, open the folder again: the same ticks, and the map is scrolled to the first step not done.
- [ ] **Hand to my AI** (under the map's count): tasks.md lists `- [x] 1.1 …` for ticked steps
      and `- [ ] …` for the rest, each with `Check: …`; proposal.md has Why, What Changes and Impact. **Copy** copies the
      file shown.
- [ ] Desktop, unsaved project: the button says **Save the project…** and saves first. Saved: **Write to the project
      folder** writes `openspec/changes/<name>/proposal.md`, `tasks.md` and `.openspec.yaml` next to the code.
- [ ] Tick a task in that `tasks.md` by hand (as your AI would), then Hand to my AI again: it names the step the file
      ticks and offers **Take its tick (step n)**. Take it: the step is ticked on the map, and the count moves on.
- [ ] Add a task of your own to that `tasks.md`, then Hand to my AI: it says tasks.md differs from the map, and the
      button says **Write over them**. `.openspec.yaml` keeps its first `created:` date.
- [ ] Tick another task in `tasks.md`, close the project and open the folder again: the terminal says it took that
      tick, and the map shows it.
- [ ] Browser: **Download .zip** gives `<name>-openspec.zip`; unzipped, it makes `openspec/changes/<name>/`. With
      OpenSpec installed, `openspec list` in that folder shows the change. Tick a task in the unzipped `tasks.md`, then
      **Take ticks from a tasks.md…** and choose it: that step is ticked on the map.
- [ ] A project with no map (Import → Try the example project): the Project map is only its title and **+ Step**, and
      Hand to my AI isn't offered (it's under the map's count once there are steps).

- [ ] Plan → Learning modules → 2 · Invaders → Python window, with "Your turn: faster as fewer remain" ticked. Click
      the problem "Fill in ‹ticks to wait before the next step›": the ‹blank› is selected and the help says what kind
      of thing goes there and how to work it out. **Show an example**, then **Put it in**: no problems left.

**Files, folders and the Library**
- [ ] **+ File** → `docs/plan.md`: a `docs/` folder appears with the file; the right side shows it as a page. Add
      `data/scores.csv` (a table on the right) and `notes.json` with a typo (the problem is named).
- [ ] A file's **⋯**: rename it, change its language, make it the start file (marked *start*), delete it.
- [ ] **+ Step** under Project map: name, depth and summary; the step appears in the map and as a note in the file.
- [ ] **Library** → Kinds of project → Audio tools and DAWs: its languages, open-source projects to learn from (with
      licences; **Copy address** copies), its parts, and **Start from the template** opens Project Templates.
- [ ] Library → Parts → Gain in decibels → Python → **Add to the project**: `gain.py` appears. In the start file,
      `show the result of gain from db with -6 rounded to 3 places` and Run: 0.501.
- [ ] Library → Little messages (toasts) → **Add all 3**: the page, styling and script are added; the preview shows it.
- [ ] Library → Coding integration → Python calling C++ with ctypes → **Add all 3 to the project**: `gain.cpp`,
      `build.sh` and `gain.py`. On the desktop with a compiler: run `$ sh build.sh` (or the Windows lines in it).
- [ ] Change a sentence so that code on an *untouched* line changes too (e.g. `set total to 0` above a tool, then
      move it below): the untouched line is flagged with **Keep the new code**.

**Unity mode**
- [ ] A fresh start (no saved mode) opens in **Unity**; the header reads Unity, Split Mode. Switch to Split Mode and reload:
      it opens in Split Mode. Back to Unity.
- [ ] **Unity**: the project's tree, its Parts and Problems are on the left, and the open file shows with its
      sentences in green. Click another file in the tree: it opens in Unity. Split Mode shows the same file.
- [ ] Under the pane is the help, as in Split Mode: on a green line, the sentence and the code it makes; on a code line,
      its terms and the part it's in. **Hide explanation** folds it away; Show explanation brings it back.
- [ ] In Unity, Library → a Python part → Add to the project: the new file opens in Unity, in green.
- [ ] **Import** (beside + File) → Choose files → a small `.py` file: it's added to the project as code. Select lines 4–6 (inside a `def`): a
      **Translate to Plain Language Syntax** button appears over the selection; press it. Those lines become sentences
      in dark green, in the same place.
- [ ] Put the cursor in the green part: the help says Original Code gives it back exactly. Press **Original Code**: the code is exactly as before.
- [ ] Translate one line, then Select all (Ctrl+A) and Translate again: the rest becomes sentences and the green part stays as it
      was. With only green lines selected, Translate to Plain Language Syntax is greyed out and Ctrl+Shift+D does nothing.
- [ ] Translate them again, change `show "Top roll!"` to `show "Top roll, {n}!"`: the help shows the f-string it will write.
      **Original Code** (Ctrl+Shift+B): `print(f"Top roll, {n}!")` at the same indentation.
- [ ] Write a sentence that doesn't exist in a green part and press Original Code: it stays green, the line number turns red, and the
      terminal says why. **Copy** refuses until it's fixed.
- [ ] **Predictive Mode** in Unity: in a green part, start a sentence the file already has: its rest shows dim; → takes it.
- [ ] The code reaches about three quarters of the way down, with the terminal under it. Fold the terminal away (its
      chevron): the code fills the room. The corner button: full screen, no side panel or terminal; Esc comes back.
- [ ] **Import** → a `.cpp` program: it comes in as sentences, one green part per statement. Original Code on the loop:
      its code, inside `main` in Split Mode's code. Original Code on `include <iostream>`: it stays green and says why.
- [ ] The Arduino sample: Original Code (all), then Split Mode: one `setup()` and one `loop()`. Select all, Translate: the
      sentences are back.

**Other languages**
- [ ] Import → paste some Rust (or Go, C#, Swift…) with the language on **Auto-detect**: it's added as `pasted.rs`,
      the terminal says why it's Rust, and in Unity the help says what each part does, in plain words.
- [ ] Import a folder with a `README.md`, a `package.json` and a `.sql` file: each is in the tree, `package.json` as Setup.

**Parts and the two sides**
- [ ] Parts (under Project) lists every part, **Type** first: Interface & Display, Backend & Mechanics, Setup & Settings,
      Data & Notes. **Language** lists them by language, each with what it does ("CSS: how it looks"). Click a part: it opens there.
- [ ] **Interface & Display** at the top: the tree keeps only files with that kind of code, Parts only those parts, and the
      rest of the code is dimmed in Unity and in both panes of Split Mode. In the Arduino blink sketch, `wait` lines are half dimmed.
      Press it again: everything shows. **Backend & Mechanics** does the same for the other side.
- [ ] With a side picked, open the **Library**: only parts with that kind of code are listed, each with its type chip.

**Project Link** (needs a website project)
- [ ] Import → Try the example project → open `static/index.html` → Preview. **Project Link** is on (its dot lit).
- [ ] Point at the form in the preview: its sentences turn light pink in Unity, `static/index.html` and `static/` turn pink in
      the tree, and its part in Parts. The bar over the preview says what's pointed at and where its code is.
- [ ] Click **Add task**: the submit handler's lines in `static/app.js` are named in the bar; click it there to open them in pink.
- [ ] Turn on **Predictive Mode**: Project Link turns off (the terminal says so). Turn Project Link on: Predictive Mode turns off.
- [ ] Browser version: import a site whose page loads a module (`<script type="module">`): the Preview shows **One page**
      and says the module isn't loaded here, and that the desktop app serves every file.

**Predictive Mode**
- [ ] With **Predictive Mode** off (its dot hollow), type `set` on a new line: nothing pops up.
- [ ] Turn it on (the dot lights): type `set `. The rest of a sentence already in the file shows in dim text after the
      cursor, and the list has it first ("written before"), then `set ‹name› to ‹value›`. **↓**: the dim text follows.
      **Ctrl+→** takes one word, **→** the rest. On a pattern, **→** fills it in and selects its first blank.
- [ ] Finish a new line with **Enter**, start the same words on another line: it's offered first. Reload: still on.

**Drop down and images**
- [ ] Build **To-do list page**, open Styling, press **Drop down**: every number, colour code and CSS word has − ▾ + under
      it. + on a text size goes up by one; hold it. ▾ on a line height lists 1 to 2 with what each is for; choose 1.5.
      ▾ on a colour: a palette and "Any colour". Ctrl+Z undoes each change. Alt+↓ opens the list at the cursor.
- [ ] Write `style paragraph: line-height: 1.1 #000000`: a warning says the colour needs its own style.
- [ ] **Menu → Add an image…**, pick a PNG: it's listed under Images with a thumbnail. In Structure, **Use** adds
      `add a picture of "images/….png" …`, and the preview shows it. Save to a folder: the folder has `images/`.
      Open that folder again: the picture is still there.
- [ ] A game in Mechanics: `load the picture "images/….png" as ship`, then `draw ship at 20, 20 on game` inside
      `every frame`: it's drawn in the preview.

**Tutor**
- [ ] Build **Number guessing game**, open **Help** and press **Tutor** (Help gets a dot), and click a sentence: the strip shows how it's said, and a balloon
      explains a way of talking to the program. **✎ Say it yourself** covers the sentence: another way of saying it
      that makes the same Python is "Right".
- [ ] Click a line of the Python: the lamp moves to that pane, the strip lists its terms and your names, and a balloon
      by the code explains a Python habit. **✎ Write it yourself** covers the code: a right line (spacing doesn't
      matter) says "Exactly right". After three, **Write this line as Python** appears.
- [ ] **Ctrl+H** on a line of code: a window with its terms, examples and related terms. On an everyday sentence: the
      shapes it follows. On a website sentence with `hero` or `cta`: those words, explained.
- [ ] Build **C++ guessing game** with Tutor on: click the code line `guesses += 1;`, **✎ Write it yourself**, write `guesses += 1;`:
      "Exactly right". `guesses++;` is "Not quite" (the same result, said differently).
- [ ] Build **Arduino: button and light**: the notes say "In Arduino C++" (pinMode, INPUT_PULLUP, …).

**Python (Split Mode)**
- [ ] Project Templates → **Number guessing game** → Build this project → Run. Type guesses in the terminal; the game answers.
- [ ] Change a sentence (e.g. the top number) and Run again: the change shows.
- [ ] Press **Save**, choose an empty folder. It now holds `main.py` (and `.intuicode/`). Open `main.py` in a text editor (Notepad, TextEdit, gedit, Kate): it is ordinary Python.
- [ ] Edit `main.py` in that editor (change a message), save it, then **Open folder** on that folder in IntuaCode: the sentence shows your change.
- [ ] Type `$ python --version` (Windows) or `$ python3 --version` in the terminal: it answers.
- [ ] Linux: in a saved project, type `$ python3 -m venv .venv`, then `$ pip install requests`. Add the
      sentence `python: import requests` and Run: the terminal says it runs with "the project's own Python (.venv)".
- [ ] Linux: type `$ sudo true`: a window asks for your password (or, without a password helper, the
      terminal says to use your own terminal).
- [ ] Run `$ python3 -m http.server 8765`, then close IntuaCode: http://localhost:8765 no longer answers.

**Website**
- [ ] Project Templates → **To-do list page** → Build. The preview shows the page; add a task.
- [ ] **Pick from the page**, then click the page's button: its name goes into your sentence.
- [ ] Over the page the Preview shows **Local** and its address, `http://127.0.0.1:…/index.html`.
- [ ] Import a folder with a site of several files (ES modules, a fetched `.json`), e.g. Rubychord-98-Web: the page runs,
      its modules and JSON load, and the terminal names the files it asked for that aren't in the project (404).
      Point at and click things: Project Link names the page, its style sheet and the module whose lines name them.
- [ ] Edit a Markdown file in that project: the page doesn't reload. Edit its style sheet: it does, with the change.
- [ ] **Open in your browser**: the same page opens in your own browser, at the same address.

**C++ (needs a compiler)**
- [ ] Project Templates → **C++ bank account (a class)** → Build → Run. On Windows the terminal says
      "Compiling main.cpp with Visual Studio …" and then shows "Sam has 75".
- [ ] Add a line `c++: oops;` and Run: the compiler's complaint links to that line.

**Arduino (needs the Arduino IDE)**
- [ ] Project Templates → **Arduino: blink a light** → Build → Run. The terminal says the sketch builds
      (the first time it may ask you to run `$ arduino-cli core install arduino:avr`: type it, then Run again).
- [ ] With a board plugged in by USB: Run uploads it; the light blinks and "Blinks so far" lines appear.
- [ ] A board with a USB-serial chip (many ESP32 boards): Run says there is a board it can't name.
      Type `board esp32`, then Run: it uploads. (Most ESP32 boards have no `LED_BUILTIN`: the
      compiler's complaint comes with a hint to use a pin number.)

**Importing and converting code**
- [ ] Import code → **Try the example project**: a new project of 16 files (the terminal counts them by language), the page,
      its styles and script under `static/`. `static/index.html` is in sentences, green in Unity.
- [ ] Open a folder of your own (a small website, a `.cpp` program or an Arduino sketch): it opens as sentences, with the ✓
      check or a clear reason. Any other folder of code comes in as a new, unsaved project.
- [ ] Drag a folder of code from your file manager onto the window: it comes in as a project.

### Only what applies

- [ ] In a new private window, open the app: it starts on the **Landing page** website (Structure, Styling, Mechanics),
      with the page in the Preview, not an Arduino sketch.
- [ ] At the top, **Interface**, **Mechanics** and **Setup** show; **Data** and **Tests** don't. Add a file
      `tests/test_page.js` with a `test(...)` in it: **Tests** appears, and shows only that file's parts.
- [ ] No **Problems** box while there are none. Type a sentence IntuaCode doesn't know: Problems appears with it,
      and goes again once it's fixed.
- [ ] The Menu has no Import code… or Hand to my AI…: **Import** is beside Project, Hand to my AI under the map's
      count. Images has no Add an image… of its own (the Menu has it).
- [ ] **Project Templates** lists Websites, Online services and Tools & utilities first; Games, Learning modules and
      Gadgets come after Social & sharing.

### One place for each

- [ ] The top right is **Menu**, **Help** and **Run**: no Tutor or Index buttons of their own.
- [ ] **Menu → New project**: **From a template ›** opens Project Templates; **Plan it step by step ›** opens planning;
      below them the empty kinds, **Website** first and chosen. The Menu has no Plan a project… of its own.
- [ ] **Help**: **Tutor** turns the Tutor on and off (Help shows a dot while it's on); in Split Mode, **Explain the
      words here** opens the words explained, as Ctrl+H does (Unity doesn't show it); below, the Index.
- [ ] Type a sentence IntuaCode doesn't know: its problem says to open the Index (in Help).

### The opening screen

- [ ] In a new private window: **Code you can read is code you control** opens over the Landing page, with
      **Bring in code** (opens Import, whose button says **Bring it in**), **Start something new** (opens New project)
      and **Look around first** (or Esc). Reload: it doesn't come back.
- [ ] The strip under the windows says **Hide explanation** / **Show explanation**, so it isn't mistaken for Help.

## 3. Things that are known not to work yet

- The installers aren't code-signed (hence the warnings on first launch).
- C++ projects with several files (headers) open for reading, but only single-file programs become sentences.
- There is no auto-update: install the next version over this one.

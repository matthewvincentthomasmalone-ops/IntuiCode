# Trying IntuCode on another computer

A 15-minute hands-on check of the desktop app. Automated tests already drive the real app on
Linux and Windows (see **Actions → Desktop app tests**); this list is for what they can't judge:
how it feels, and your own machine.

## 1. Install

From the repository's **Releases** page, take the newest `v0.x` pre-release:

- **Windows:** `IntuCode_…_x64-setup.exe` (or the `.msi`). SmartScreen will warn because the app
  isn't signed yet: **More info → Run anyway**.
- **macOS:** the `.dmg`. First launch: right-click the app → **Open** → **Open**.
- **Linux:** the `.deb` (`sudo apt install ./IntuCode*.deb`), the `.rpm` (`sudo dnf install ./IntuCode*.rpm`),
  or the `.AppImage` (`chmod +x`, then run it).

Optional, for the C++ and Arduino checks:

- **Windows C++:** [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/),
  with the **Desktop development with C++** workload. (If Visual Studio with C++ is installed, that works too.)
- **Arduino:** the [Arduino IDE 2](https://www.arduino.cc/en/software) (IntuCode uses the
  arduino-cli inside it). A board is optional.

## 2. Checklist

Tick each one. If something is off, note what you did and what the terminal said.

**Start**
- [ ] The window opens. The terminal says which Python it found ("Desktop app: programs run with Python 3.x…").

**New project**
- [ ] File → New project (or Ctrl+N): pick a kind, type a name, leave "Choose a folder for it now" ticked,
      Create, and choose an empty folder: the project's files appear there.
- [ ] Try again choosing a folder that already has a project: nothing is written, and the terminal says why.

**Planning and the Library**
- [ ] **Library**: projects by kind (Games, Productivity, Money…), each tagged PC, Phone, Web or Board; the chips at the
      top show only those. A kit's **Choose its steps…** opens planning at that kit; **Plan one ›** at its kind.
- [ ] **Plan** (menu bar) → Creative & media → Audio workstation: the stages at the top move on; **The smallest that
      works**, **The usual** and **Everything** change **Your plan**; **Preview its sentences** shows a step's sentences.
      Tick Mixer, Build my project: the Project map lists the steps in order, and Problems lists the hallway ‹blanks›.
- [ ] Click a step in the Project map: its window explains it, and "Go to its sentences in Tools" jumps there. Fill the
      blanks and Run: the terminal shows the peak and RMS levels, and `output.wav` plays.
- [ ] **Change this kit…**: move a step, untick Always, add a step from the library (search "save"), write a new step;
      the check under the steps says whether the kit builds. Save: planning uses your version. Delete yours (in the
      list on the left): the original comes back.
- [ ] Build a game from the Library (Games): it plays in the preview with the keys or a tap.
- [ ] The corner button on the sentences, the code and the terminal: each fills the work area; Esc comes back.
- [ ] **Hide help**, then the terminal's chevron: the sentences and code grow. Drag the terminal's top edge; double-click
      it. Run brings the terminal back. Close and reopen the app: it's as you left it.

**Drop down and images**
- [ ] Build **To-do list page**, open Styling, press **Drop down**: every number, colour code and CSS word has − ▾ + under
      it. + on a text size goes up by one; hold it. ▾ on a line height lists 1 to 2 with what each is for; choose 1.5.
      ▾ on a colour: a palette and "Any colour". Ctrl+Z undoes each change. Alt+↓ opens the list at the cursor.
- [ ] Write `style paragraph: line-height: 1.1 #000000`: a warning says the colour needs its own style.
- [ ] **File → Add an image…**, pick a PNG: it's listed under Images with a thumbnail. In Structure, **Use** adds
      `add a picture of "images/….png" …`, and the preview shows it. Save to a folder: the folder has `images/`.
      Open that folder again: the picture is still there.
- [ ] A game in Mechanics: `load the picture "images/….png" as ship`, then `draw ship at 20, 20 on game` inside
      `every frame`: it's drawn in the preview.

**Tutor**
- [ ] Build **Number guessing game**, press **Tutor**, and click a sentence: the strip shows how it's said, and a balloon
      explains a way of talking to the program. **✎ Say it yourself** covers the sentence: another way of saying it
      that makes the same Python is "Right".
- [ ] Click a line of the Python: the lamp moves to that pane, the strip lists its terms and your names, and a balloon
      by the code explains a Python habit. **✎ Write it yourself** covers the code: a right line (spacing doesn't
      matter) says "Exactly right". After three, **Write this line as Python** appears.
- [ ] **Ctrl+H** on a line of code: a window with its terms, examples and related terms. On an everyday sentence: the
      shapes it follows. On a website sentence with `hero` or `cta`: those words, explained.
- [ ] Read mode → Try the example project → `app.py` → **Style tour**: Next walks through the file's habits.
- [ ] Build **C++ guessing game** with Tutor on: click the code line `guesses += 1;`, **✎ Write it yourself**, write `guesses += 1;`:
      "Exactly right". `guesses++;` is "Not quite" (the same result, said differently).
- [ ] Build **Arduino: button and light**: the notes say "In Arduino C++" (pinMode, INPUT_PULLUP, …).
- [ ] Read mode → import `samples/cpp/blink/blink.ino` → **Style tour**: setup and loop, pinMode, delay…

**Python (Write mode)**
- [ ] Library → **Number guessing game** → Build this project → Run. Type guesses in the terminal; the game answers.
- [ ] Change a sentence (e.g. the top number) and Run again: the change shows.
- [ ] Press **Save**, choose an empty folder. It now holds `main.py` (and `.intuicode/`). Open `main.py` in a text editor (Notepad, TextEdit, gedit, Kate): it is ordinary Python.
- [ ] Edit `main.py` in that editor (change a message), save it, then **Open folder** on that folder in IntuCode: the sentence shows your change.
- [ ] Type `$ python --version` (Windows) or `$ python3 --version` in the terminal: it answers.
- [ ] Linux: in a saved project, type `$ python3 -m venv .venv`, then `$ pip install requests`. Add the
      sentence `python: import requests` and Run: the terminal says it runs with "the project's own Python (.venv)".
- [ ] Linux: type `$ sudo true`: a window asks for your password (or, without a password helper, the
      terminal says to use your own terminal).
- [ ] Run `$ python3 -m http.server 8765`, then close IntuCode: http://localhost:8765 no longer answers.

**Website**
- [ ] Library → **To-do list page** → Build. The preview shows the page; add a task.
- [ ] **Pick from the page**, then click the page's button: its name goes into your sentence.

**C++ (needs a compiler)**
- [ ] Library → **C++ bank account (a class)** → Build → Run. On Windows the terminal says
      "Compiling main.cpp with Visual Studio …" and then shows "Sam has 75".
- [ ] Add a line `c++: oops;` and Run: the compiler's complaint links to that line.

**Arduino (needs the Arduino IDE)**
- [ ] Library → **Arduino: blink a light** → Build → Run. The terminal says the sketch builds
      (the first time it may ask you to run `$ arduino-cli core install arduino:avr`: type it, then Run again).
- [ ] With a board plugged in by USB: Run uploads it; the light blinks and "Blinks so far" lines appear.
- [ ] A board with a USB-serial chip (many ESP32 boards): Run says there is a board it can't name.
      Type `board esp32`, then Run: it uploads. (Most ESP32 boards have no `LED_BUILTIN`: the
      compiler's complaint comes with a hint to use a pin number.)

**Reading and converting code**
- [ ] Import code → **Try the example project**. The overview and the file map appear.
- [ ] Click `static/index.html` → **Open as sentences**: three ✓ lines ("checked, the sentences make exactly the same code").
- [ ] Open a folder of your own (a small website, a `.cpp` program or an Arduino sketch): it opens as sentences,
      or in Read mode, with the ✓ check or a clear reason.
- [ ] Drag a folder of code from your file manager onto the window: it opens in Read mode.

## 3. Things that are known not to work yet

- The installers aren't code-signed (hence the warnings on first launch).
- C++ projects with several files (headers) open for reading, but only single-file programs become sentences.
- There is no auto-update: install the next version over this one.

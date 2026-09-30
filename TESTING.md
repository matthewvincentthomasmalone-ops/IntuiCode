# Trying IntuiCode on another computer

A 15-minute hands-on check of the desktop app. Automated tests already drive the real app on
Linux and Windows (see **Actions → Desktop app tests**); this list is for what they can't judge:
how it feels, and your own machine.

## 1. Install

From the repository's **Releases** page, take the newest `v0.x` pre-release:

- **Windows:** `IntuiCode_…_x64-setup.exe` (or the `.msi`). SmartScreen will warn because the app
  isn't signed yet: **More info → Run anyway**.
- **macOS:** the `.dmg`. First launch: right-click the app → **Open** → **Open**.
- **Linux:** the `.AppImage` (`chmod +x`, then run it) or the `.deb`.

Optional, for the C++ and Arduino checks:

- **Windows C++:** [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/),
  with the **Desktop development with C++** workload. (If Visual Studio with C++ is installed, that works too.)
- **Arduino:** the [Arduino IDE 2](https://www.arduino.cc/en/software) (IntuiCode uses the
  arduino-cli inside it). A board is optional.

## 2. Checklist

Tick each one. If something is off, note what you did and what the terminal said.

**Start**
- [ ] The window opens. The terminal says which Python it found ("Desktop app: programs run with Python 3.x…").

**New project**
- [ ] File → New project (or Ctrl+N): pick a kind, type a name, leave "Choose a folder for it now" ticked,
      Create, and choose an empty folder: the project's files appear there.
- [ ] Try again choosing a folder that already has a project: nothing is written, and the terminal says why.

**Project builder**
- [ ] File → Project builder… → App → PC → Audio workstation (DAW). Tick Mixer, Build my project: the Project map
      lists the steps in order, and Problems lists the hallway ‹blanks›.
- [ ] Click a step: its window explains it, and "Go to its sentences in Tools" jumps there. Fill the blanks and
      Run: the terminal shows the peak and RMS levels, and `output.wav` plays.
- [ ] In the builder, **Change the questions and steps** → the EQ step → Edit a copy, change its name, Save. Back to
      the questions → App → PC → DAW: the EQ row has your name. Delete yours: the original comes back.

**Tutor**
- [ ] Build **Number guessing game**, press **Tutor**, and click a line: a balloon explains a Python habit on it.
- [ ] Press **✎ Your turn** under the explanation and write the line in Python: a wrong answer says so; a right one
      (spacing doesn't matter) says "Exactly right". After three, **Write this line as Python** appears.
- [ ] Read mode → Try the example project → `app.py` → **Style tour**: Next walks through the file's habits.
- [ ] Build **C++ guessing game** with Tutor on: click `increase guesses by 1`, **✎ Your turn**, write `guesses += 1;`:
      "Exactly right". `guesses++;` is "Not quite" (the same result, said differently).
- [ ] Build **Arduino: button and light**: the notes say "In Arduino C++" (pinMode, INPUT_PULLUP, …).
- [ ] Read mode → import `samples/cpp/blink/blink.ino` → **Style tour**: setup and loop, pinMode, delay…

**Python (Write mode)**
- [ ] Blueprints → **Number guessing game** → Build this project → Run. Type guesses in the terminal; the game answers.
- [ ] Change a sentence (e.g. the top number) and Run again: the change shows.
- [ ] Press **Save**, choose an empty folder. It now holds `main.py` (and `.intuicode/`). Open `main.py` in Notepad: it is ordinary Python.
- [ ] Edit `main.py` in Notepad (change a message), save it, then **Open folder** on that folder in IntuiCode: the sentence shows your change.
- [ ] Type `$ python --version` (Windows) or `$ python3 --version` in the terminal: it answers.

**Website**
- [ ] Blueprints → **To-do list page** → Build. The preview shows the page; add a task.
- [ ] **Pick from the page**, then click the page's button: its name goes into your sentence.

**C++ (needs a compiler)**
- [ ] Blueprints → **C++ bank account (a class)** → Build → Run. On Windows the terminal says
      "Compiling main.cpp with Visual Studio …" and then shows "Sam has 75".
- [ ] Add a line `c++: oops;` and Run: the compiler's complaint links to that line.

**Arduino (needs the Arduino IDE)**
- [ ] Blueprints → **Arduino: blink a light** → Build → Run. The terminal says the sketch builds
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

## 3. Things that are known not to work yet

- The installers aren't code-signed (hence the warnings on first launch).
- C++ projects with several files (headers) open for reading, but only single-file programs become sentences.
- There is no auto-update: install the next version over this one.

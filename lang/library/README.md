# Library packs

The Library lists common things to add to a project (tools, features, shapes, details, functions) and the
kinds of project they go in. `lang/library.js` reads it; each file here adds entries in plain text:

```js
(window.IntuiLibraryPacks = window.IntuiLibraryPacks || []).push(
`type: …`,
`part: …`,
);
```

Add a new file as a `<script>` in `index.html`, before `lang/library.js` (the tests find every file here on
their own). `lang/languages.js` must load first: every language below is checked against it.

| File | What's in it |
|---|---|
| `types.js` | The kinds of project: websites, apps, games, audio, data, hardware |
| `audio.js` | Audio and DSP; music and MIDI |
| `interface.js` | Interface; shapes and colour |
| `games.js` | Games; maths and numbers |
| `data.js` | Data; files and system; storage and databases |
| `web.js` | Networking; security |
| `hardware.js` | Boards, pins and sensors |
| `integration.js` | Coding integration: two languages working together |

## A type: a kind of project

```
type: daw
title: Audio tools and DAWs
heading: Audio, music and video
platforms: pc
about: A digital audio workstation: tracks, a mixer, plug-ins, recording and editing on a timeline.
language: C++ | The audio engine and plug-in hosting: real-time audio needs speed and no pauses | JUCE, PortAudio
language: Python | Batch processing, analysis and prototypes of effects | NumPy, SciPy, soundfile
learn from: Ardour | C++ | GPL-2.0-or-later | https://github.com/Ardour/ardour | A full DAW: tracks, buses, automation
parts: gain-db, pan-law, biquad, compressor
templates: daw
```

- **id** (after `type:`): lower case, numbers and dashes.
- **heading**: types with the same heading are listed together ("Websites and online", "Audio, music and video"…).
- **platforms**: where it runs, any of `pc`, `phone`, `web`, `board`, separated by commas.
- **language:** one line per language: its name or id from `lang/languages.js` | what it does in this kind of
  project | the usual frameworks and libraries, separated by commas (optional).
- **learn from:** open-source projects worth reading: name | main language | licence (an SPDX id such as
  `MIT`, `GPL-3.0-or-later`) | web address | what to look at in it. At least two per type.
- **parts:** the Library parts this kind of project is usually made of. A part can also name its types itself
  (`types:` below); the type lists both.
- **templates:** optional: the ids of Project Templates (kits in `lang/builder.js` and `lang/kits/`) that fit.

## A part: one thing to add

```
part: gain-db
title: Gain in decibels
group: audio
types: daw, audio-plugin
about: Turn a level in decibels into the number samples are multiplied by, and back.
summary: Faders and meters speak decibels; code multiplies by a gain: gain = 10^(dB / 20).
learn: Powers of ten and logarithms.
source: Decibel (amplitude ratios) | https://en.wikipedia.org/wiki/Decibel | 20 × log10 for amplitude ratios
== python gain.py
define gain from db using db
    give back 10 ** (db divided by 20)
== cpp gain.cpp
include cmath

define gain_from_db using float db giving back float
    give back std::pow(10.0f, db / 20.0f)
```

- **group**: one of `audio`, `music`, `interface`, `graphics`, `games`, `maths`, `data`, `files`, `storage`,
  `networking`, `security`, `hardware`, `integration` (titles and order are `GROUPS` in `lang/library.js`).
- **summary**: one to three plain sentences: what it does and why it's done that way.
- **source:** where an idea or a formula came from: name | address (optional) | what was taken from it.
  One line per source.
- **`== language file`** starts a variant: a language id from `lang/languages.js`, then its file name
  (folders allowed: `static/script.js`). Everything up to the next `==` line is its text. The file's ending
  has to belong to the language (a C header may be `.h`).

What a variant holds depends on the language's `write` in `lang/languages.js`:

| write | Languages | The text is |
|---|---|---|
| `sentences` | Python, HTML, CSS, JavaScript, C++, Arduino | IntuaCode sentences, translated by that language's writer |
| `code` | Rust, C, C#, Swift, Kotlin, TypeScript, Lua, Go, PHP, SQL, Bash… | the exact code |
| `text` | JSON, YAML, TOML, Markdown, CSV, plain text | the file as it is |

The sentence dialects: Python is `lang/python.js` (a part is usually `define` tools, which go in Tools);
HTML, CSS and JavaScript are a website's Structure, Styling and Mechanics in `lang/web_write.js` (a part's
JavaScript can use the elements its HTML variant names); C++ and Arduino are `lang/cpp_write.js` (tools and
classes go above `main`; an Arduino sketch has its settings at the left edge, then "when the board starts" and
"over and over").

### Coding integration parts

A part in the `integration` group gives **both sides**: at least two files, in the languages being joined, and
when it needs one, the build step (`build.sh`, `Cargo.toml`). The file names show how they fit: `gain.py`
loads what `build.sh` makes from `gain.cpp`; `index.html` loads `dsp.js`, which Emscripten made from `dsp.cpp`.

## Writing guide

- **Prefer sentences.** That is the point of IntuaCode. Write `python:`, `js:`, `c++:`, `above main:` or
  `head:` lines only where no sentence exists yet, and keep the sentence for the parts people should read.
- **Plain, direct, never patronising.** No "simply", "just", "easy", no exclamation marks. British spelling
  ("colour", "behaviour"). Say what something does and why, in that order.
- **Be exact about facts.** Formulas come from published sources, credited with `source:`. Standards and
  products are named only as what they are (AES67, SMPTE ST 2110, Dante, NDI, Ember+…).
- **Licences.** IntuaCode is Apache-2.0. Never copy code from GPL, LGPL or AGPL projects (Ardour, Audacity,
  LMMS, Surge, OBS…) or from anything whose licence doesn't allow it: write original code from the published
  formula or the documented API. GPL projects can be listed under `learn from:` for reading.
- **Real-time audio.** C++ that runs in an audio callback must not allocate memory, lock, open files, print or
  wait. Say so in the summary or a note, and say why: the callback has a deadline every few milliseconds.
- **Names.** Pick names that aren't sentence words: `times`, `plus`, `length of`, `item … of`, `is`, `the`
  and `then` mean something in sentences. A tool called "length of vector" or a list called "times" won't
  work as expected.
- **The packs are JavaScript template literals.** A backtick is written `` \` ``, a backslash `\\`, and `${`
  is written `\${`. A Python `"\n"` is written `"\\n"`.
- **Checked by the tests** (`tests/library.test.mjs`): every entry parses, every sentence variant translates
  with no errors or warnings and its code parses, every code variant parses with its tree-sitter grammar, the
  SQL runs in SQLite, and the audio, maths and data parts give the right numbers in Python and JavaScript. A new
  part with numbers in it should add a check there.

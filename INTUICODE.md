# IntuaCode language reference

IntuaCode is a set of structured English sentences. Rules, not AI, translate them into Python
(`lang/python.js`), into HTML, CSS and JavaScript for websites (`lang/web_write.js`), and into C++ and
Arduino sketches (`lang/cpp_write.js`). Readers turn code back into sentences (`lang/python_reader.py`,
`lang/convert.js`) and check that the sentences rebuild exactly the same code.

This is the reference: the file format, the grammar each writer accepts, how values are read, what the
writers remember from line to line, and where that can still go wrong. The [index](#index) at the end is
generated from the writers' own data. Every fenced example marked `intuicode` is a test (see
[About the examples](#about-the-examples)).

**Is it airtight?** Not completely.

- **Code to sentences is checked.** The sentences are translated back and compared with the original;
  anything that differs stays as code, and IntuaCode says when the result still isn't exact.
- **Sentences to code is not checked against what you meant**, because only you know that. IntuaCode has
  far fewer words than the languages it writes, so it fills the gaps from context: what kind of value a name
  holds, which page element a name means. Missing words fail loudly ("I don't recognise this sentence").
  The risk is English with two readings, and context that can't be seen. Where the writer knows a sentence
  has two readings, it refuses it and says how to put it ([Two readings](#two-readings-refused-never-guessed-python));
  where the context it needs can't be seen, it warns. [Context](#context-what-the-writers-remember) says
  what it uses; [Known wrong translations](#known-wrong-translations) lists, with tests, what still comes
  out wrong. And in the app, if an edit somewhere changes the code of a line you didn't touch, that line
  is flagged until you've looked at it.

## Contents

1. [Files and folders](#files-and-folders)
2. [The sentence file format](#the-sentence-file-format)
3. [Grammar: Python](#grammar-python)
4. [Grammar: websites](#grammar-websites)
5. [Grammar: C++ and Arduino](#grammar-c-and-arduino)
6. [How a value is read: binding and precedence](#how-a-value-is-read-binding-and-precedence)
7. [Context: what the writers remember](#context-what-the-writers-remember)
8. [What IntuaCode has no words for](#what-intuacode-has-no-words-for)
9. [Guarantees and limits](#guarantees-and-limits)
10. [Known wrong translations](#known-wrong-translations)
11. [About the examples](#about-the-examples)
12. [Index](#index)

## Files and folders

A project is a tree of files (`lang/project.js`). Each file has a path and a language from
`lang/languages.js`, and the language says how it is written: in **sentences** (Python, HTML, CSS, JavaScript,
C++, Arduino: each sentence file becomes one code file of that name), as **code** that IntuaCode reads to you
(Rust, Go, C#, Swift… 30+), or as **text** kept as written (Markdown, CSV, JSON, YAML, TOML). A project can mix
them. Each writer compiles its own files: the Python files together, each seeing the ones before it and the
start file last; a website's main page with its styling and mechanics, and its other pages, styles and
scripts against it; the C++ files as one program; the Arduino files as one sketch.

The usual starting layouts, and the names their files get:

| Project | Files (shown as) | Code files | Writer | Reader |
|---|---|---|---|---|
| Python, one file | Main program | `main.py` | `lang/python.js` | `lang/python_reader.py` |
| Python, three folders | Settings, Tools, Main program | `settings.py`, `tools.py`, `main.py` | `lang/python.js` | `lang/python_reader.py` |
| Website | Structure, Styling, Mechanics | `index.html`, `style.css`, `script.js` | `lang/web_write.js` | `lang/convert.js` |
| C++ program | Program | `main.cpp` | `lang/cpp_write.js` | `lang/convert.js` |
| Arduino sketch | Sketch | `‹folder›.ino`, named after the project folder | `lang/cpp_write.js` | `lang/convert.js` |

- **The code files are the source of truth.** The sentences are kept in `.intuicode/project.json` beside
  them and rebuilt from the code when the code changes elsewhere (see `ARCHITECTURE.md`).
- **Python, three folders.** Settings holds shared starting values, Tools holds `define` blocks, Main
  program runs. A later file starts with `from settings import *` (and `from tools import *`) when the
  earlier file defines something; any other Python file (`dsp/gain.py`) is imported the same way, by its
  module name (`from dsp.gain import *`). Standard modules a sentence needs (`random`, `math`, `time`, `sys`) are
  imported at the top, after the file's description.
- **Website.** `index.html` gets the doctype, `<html lang="en">`, the character set and viewport,
  a title ("My page" unless one is given), `<link rel="stylesheet" href="style.css">` at the end of
  `<head>` and `<script src="script.js"></script>` at the end of `<body>`. The three folders share names:
  `called save` in Structure is `#save` in Styling and the element `save` in Mechanics.
- **C++.** `#include <iostream>` and `<string>` always, other includes and small helpers when a sentence
  needs them; tools and classes go above `int main()`, everything else inside it, then `return 0;`.
- **Arduino.** Lines at the left edge are settings (global values); `when the board starts` becomes
  `setup()` and `over and over` becomes `loop()`. A missing one is added empty.

## The sentence file format

### Text, lines and blocks

- A sentence file is UTF-8 text, one sentence per line. A `\r` at the end of a line is ignored.
- One sentence line becomes one line of code, or several when the sentence needs them: a Python line with
  several steps, a C++ `ask` (prompt, then read), a drawing sentence (a `{ … }` block), a listener.
- **Blocks.** A line that opens a block (`if`, loops, `define`, `try`, `when … is clicked`,
  `add a section`, `on screens narrower than …:`, `when the board starts` …) takes the lines indented under
  it. A block ends when the indentation goes back.
- **Indentation** is spaces, 4 per level by convention (the editor's Tab). The Python writer also reads a
  tab as 4 spaces; the web and C++ writers count spaces only. The code is indented 4 spaces per level in
  Python and C++, and 2 in HTML, CSS and JavaScript.
- **Python checks the blocks:** an opener with nothing under it, a line indented under a line that opens
  nothing, and a line that lines up with no line above are errors. A block holding only notes gets `pass`.
- Blank lines are kept in Python, JavaScript and C++, and dropped in HTML and CSS.
- A final `:` or `.` is dropped (in Python, not a `.` straight after a digit: `3.` stays a decimal).

### Kinds of line

| Kind | Written as | Python | HTML | CSS | JavaScript | C++, Arduino |
|---|---|---|---|---|---|---|
| Sentence | `show "hi"` | the rules below | | | | |
| Note | `note: text` or `comment: text` | `# text` (a `# text` line too) | `<!-- text -->` | `/* text */` | `// text` | `// text` |
| Description | `description: text` | a docstring, `"""text"""`; lines in a row make one text | not a sentence (error) | not a sentence (error) | a JSDoc comment; right under `define`, placed above the function | not a sentence (error) |
| Exact code | `python:`, `html:`, `css:`, `js:`, `c++:` … (next table) | copied | copied | copied | copied | copied |
| ‹Blank› | `set speed to ‹a number›` | error "Fill in the ‹…› slot.", `_` in its place, inside quotes too | the same error; `_` in its place, but a blank inside quotes stays as text | as HTML | as HTML | as HTML |

### Exact-code lines

What has no sentence can be written as code on a line of its own. The writer copies it and doesn't
check it; the language does, when the program runs or is compiled.

| Prefix | Writer | Where it goes |
|---|---|---|
| `python:`, `raw python:`, `raw:` | Python | as the line, at its indentation. Names it makes (`x = …`, `import`, `def`, `class`) become known; a line ending in `:` opens a block; text in triple quotes carries on over the next `python:` lines, copied exactly. |
| `html:`, `raw:` | Structure | at that place in `<body>`. Spaces inside `<pre>`, `<textarea>`, `<script>` and `<style>` are kept. |
| `head:`, `in the head:` | Structure | into `<head>`. A charset, viewport, `style.css` link or `script.js` tag there replaces the one IntuaCode writes. |
| `body attributes:`, `body has:` / `html attributes:` | Structure | onto `<body>` / `<html>` |
| `doctype:` | Structure | the first line of the page |
| `no doctype`, `no title`, `no page language`, `leave out the character set`, `leave out the viewport` | Structure | leaves that part out |
| `css:`, `raw:` | Styling | as a line, inside the current `on screens …` block if any |
| `js:`, `javascript:`, `raw:` | Mechanics | as a line. `let`, `const`, `var` and `function` names it makes become known. |
| `c++:`, `cpp:`, `raw:` | C++ | where it stands |
| `above main:`, `outside main:`, `at the top:` | C++ | above `main` (left edge only) |

```intuicode python
note: A shopping list
create list basket with "apples", "bread"
add "milk" to basket
for each item in basket
    show "-" and item
python: print(len(basket))
```

```python
# A shopping list
basket = ["apples", "bread"]
basket.append("milk")
for item in basket:
    print("-", item)
print(len(basket))
```

### Filler words

Natural phrasing is never penalised: filler is left out and a note says so. Words inside quotes never count.

| Writer | Left out at the start of a line | Left out anywhere | Left out at the end |
|---|---|---|---|
| Python | please, kindly, ok, okay, so, and, now, next, then, and then, also, just, simply, finally, first, firstly, after that, afterwards, I want to, I'd like to, I would like to, I need to, we need to, we want to, let's, let us, can you, could you, you should, go ahead and, make sure to, make sure you, try to, remember to, be sure to | please, kindly, just, simply, basically, really, actually, quickly | please, for me, thanks, thank you |
| HTML, CSS, JavaScript | please, now, next, then, and then, also, just, I want to, I'd like to, let's, let us, can you, go ahead and, make sure to | | |
| C++, Arduino | please, now, next, then, and then, also, just, I want to, I'd like to, let's, let us, go ahead and | | |

- Several start words in a row are all left out, with or without a comma (`ok, so please show x`).
- Python: a line that is only filler is an error. `next round`, `then`, `now`, `next` and `first` on their
  own are kept, and so is a line of Python like `x = 1`.
- A filler word can't be a name: in Python `set just to 1` loses its `just`.

### Several steps on one line (Python)

- `;`, `then`, `and then`, `after that` and `afterwards` (a comma before them is fine) split a line into
  steps. Each step becomes its own line of code.
- Steps after a block opener go inside the block: `if age is at least 18 then show "Welcome"`.
- `opener: step` puts the step inside the block when the part after the colon starts with a step word in
  lower case (show, set, ask, run, add, if, repeat …): `repeat 3 times: show "hi"`.
- One block per line: a second opener on the same line is an error.
- A final `then` or `do` is dropped (`if x is 1 then`).
- The web and C++ writers don't split lines: `then` is filler at the start of a line and nothing more.

```intuicode python
please ask for a number "Age? " and store in age then show age
if age is at least 18 then show "Welcome" and then show "Come in"
repeat 3 times: show "Hip hip hooray"; show "Done"
```

```python
age = int(input("Age? "))
print(age)
if age >= 18:
    print("Welcome")
    print("Come in")
for _ in range(3):
    print("Hip hip hooray")
    print("Done")
```

### Names

| Writer | A name is | Words with spaces | Case |
|---|---|---|---|
| Python | letters, digits, `_`, `-` and spaces, not starting with a digit | `high score` becomes `high_score` (lower case; spaces and `-` become `_`); later sentences can say `high score` | a one-word name keeps its case (`API_KEY`). A name is found by its exact spelling, else by a different-case spelling when there is only one. |
| HTML ids, CSS | `called` and one or two words | `main area` becomes `main-area` (lower case; anything other than a letter or digit becomes `-`) | lower case |
| JavaScript | one JavaScript name (letters, digits, `_`, `$`) | not for values; page elements are named as in HTML (`main area` or `main-area`) | as written |
| C++ | one C++ name | not allowed | as written |

- Python: `the`, `my`, `a`, `an` and `a new` at the start of a name are left out when it is set
  (`set the end to 5` sets `end`). Python's own words (`for`, `class` …) are an error; a built-in
  (`list`, `max` …) is a warning, because the name hides it.
- Groups: `in group card` gives an element the class `card`; `in groups card, wide` gives two.

```intuicode python
set high score to 10
set API_KEY to "abc"
set the end to 5
show high score plus the end
```

```python
high_score = 10
API_KEY = "abc"
end = 5
print(high_score + end)
```

### Quoted text and fill-ins

- Text goes in double quotes `"…"` or single quotes `'…'`. Sentence words inside quotes are never read
  as sentence words: `add "Walk to the shop" to tasks` splits at the second `to`.
- `{…}` inside double-quoted text fills in a value, and what is inside the braces is itself a value
  (`"{n plus 1}"`). `{{` and `}}` are braces.
- A fill-in becomes an f-string in Python, a template literal in JavaScript, the `text("Hi ", name)`
  helper in C++ and `String("Hi ") + name` on Arduino.
- Single-quoted text keeps `{…}` as it is. Python text with a prefix (`f"…"`, `r"…"`, `b"…"`) is kept
  exactly. In C++, single quotes are one character (`'a'`); text in them gets a warning. JavaScript text in
  backticks is kept as it is.

```intuicode python
set name to "Sam"
show "Hi {name}, {{these}} are braces"
show "{{only braces}}"
show 'single quotes keep {name}'
```

```python
name = "Sam"
print(f"Hi {name}, {{these}} are braces")
print("{only braces}")
print('single quotes keep {name}')
```

### Numbers and plain values

- A number is digits with an optional `-` and decimal part: `42`, `-2`, `0.5`. Other numeric code
  (`1e3`, `0x1f`) passes through as code.
- Python also reads number words when no name is spelt that way: zero to twelve, twenty, fifty, hundred;
  and `once`, `twice`, `thrice` after `repeat`. JavaScript and C++ don't.
- `yes` and `true`, `no` and `false`, `nothing` and `none` are the language's values (`True`, `true`,
  `None`, `null`; C++ has no word for `nothing`).
- In Styling a number without a unit is in pixels (`width 300` is `300px`), except 0.

```intuicode python
repeat three times
    show "x"
set half to 0.5
set below to -2
```

```python
for _ in range(3):
    print("x")
half = 0.5
below = -2
```

## Grammar: Python

### Notation

The grammar is EBNF-style and describes what the writers accept, in the order they try it.

- `"word"`: words as written (case doesn't matter); `a | b`: either; `[ x ]`: optional; `{ x }`: any
  number of times; `( … )`: grouping.
- Lower-case slots: `name` (a name, see [Names](#names)), `value` (an expression, see
  [How a value is read](#how-a-value-is-read-binding-and-precedence)), `cond` (a value used as a test;
  in Python and JavaScript a lone `=` there means "is equal to", in C++ it doesn't), `target` (something to store in), `items` (values split at `,` and
  `and`, outside quotes and brackets), `text` (quoted text), `code` (copied exactly).
- `(* → … *)` says what it becomes.

### Statements

The Python writer tries these in order and the first that fits wins. Exact-code, note and description
lines are checked first, before filler is removed and the line is split into steps.

```ebnf
(* Checked first *)
exact       = ( "python" | "raw python" | "raw" ) ":" code ;                        (* → code *)
note        = ( "note" | "comment" ) ":" text | "#" text ;                          (* → # text *)
description = "description" ":" text ;                                              (* → """text""" *)

(* Then: filler out, steps split (see "Several steps on one line") *)
line        = step { ( ";" | "then" | "and then" | "after that" | "afterwards" ) step }
            | opener ":" step ;

(* Program structure *)
use         = ( "use" | "import" ) [ "the" ] module [ "module" | "library" | "toolkit" ] ; (* → import module *)
                (* "use x" without "module" imports only random, math, time, sys, string, datetime; otherwise it runs x *)
main-guard  = ( "if" | "when" ) "this file is" ( "run" | "started" ) "directly" ;    (* → if __name__ == "__main__": *)
route       = "when" app ( "gets" | "receives" ) ( [ "a" | "an" | "any" ] [ "web" ] ( "request" | "requests" ) | methods )
              ( "at" | "on" | "for" ) text ;                                     (* → @app.route(text, methods=[…]) *)
route2      = "when" app "handles" method ( "at" | "on" | "for" ) text [ "with" items ] ; (* → @app.get(text, …) *)
decorate    = "decorate" [ "it" ] "with" value ;                                    (* → @value *)
class       = "define" [ "a" ] "class" Name [ "based on" items ] ;                  (* → class Name(items): *)
field       = "field" name ":" kind [ "=" value ] ;                                 (* → name: type = value *)
                (* kind: number, whole number, decimal, text, words, yes/no, character, list of …; else a Python type *)
global      = "use the shared" items ;                                              (* → global a, b *)
delete      = "delete" items ;               (* a line without "from" *)           (* → del a, b *)

(* Errors *)
try         = "try" ;                                                               (* → try: *)
except      = ( "if" | "when" ) ( "it" | "that" | "this" | "anything" | "something" ) "fails"
              [ "with" kinds ] [ "as" name ] ;                (* kinds split at , and or *) (* → except (A, B) as name: *)
try-else    = "if nothing failed" ;                                                 (* → else: *)
finally     = "finally" | "in any case" | "either way" | "whatever happens" ;       (* → finally: *)
reraise     = "fail again" ;                                                        (* → raise *)
raise       = ( "fail" | "stop" ) "with" [ "the" | "an" | "a" ] [ "error" ] Kind [ ":" items ] ; (* → raise Kind(items) *)
check       = "check that" cond ;                                                   (* → assert cond *)

(* Files and other things that need closing *)
open        = "open" [ "the" ] [ "file" ] value [ "for" ( "reading" | "writing" | "adding" | "appending" ) ] "as" name ;
                                                                          (* → with open(value[, "w" | "a"]) as name: *)
using       = [ "async" ] "using" value [ "as" name ] ;                             (* → [async] with value as name: *)

(* Tools *)
define      = ( "define" | ( "create" | "make" ) [ "a" ] [ "new" ] ( "tool" | "function" ) | "new tool" )
              [ "async" ] [ "called" | "named" ] name
              [ ( "using" | "with" | "that takes" | "taking" | "needing" | "given" ) ( "nothing" | params ) ] ;
                                                                          (* → [async] def name(params): *)
params      = param { ( "," | "and" ) param } ;
param       = name [ ":" type ] [ "=" value ] ;
return      = ( "give back" | "return" | "send back" | "answer with" | "hand back" ) [ value ] ; (* → return value *)

(* Decisions *)
elif        = ( "otherwise if" | "else if" | "elif" | "or else if" | "otherwise when" ) cond ;   (* → elif cond: *)
else        = "otherwise" | "else" | "or else" | "if not" ;                         (* → else: *)
if          = ( "if" | "when" ) cond ;                                              (* → if cond: *)

(* Loops *)
forever     = "repeat forever" | "forever" | "keep repeating" | "loop forever" | "keep going" | "repeat" ; (* → while True: *)
until       = ( "repeat until" | "keep going until" | "keep repeating until" | "until" | "do until" | "loop until" ) cond ;
                                                                          (* → while not cond: *)
while       = ( "while" | "repeat while" | "keep going while" | "keep repeating while" | "as long as" | "loop while" ) cond ;
                                                                          (* → while cond: *)
times-word  = ( "repeat" | "do this" | "do it" | "loop" ) ( "once" | "twice" | "thrice" ) ; (* → for _ in range(n): *)
times       = ( "repeat" | "do this" | "do it" | "loop" ) value ( "time" | "times" )
              [ ( "counting with" | "counting" | "using" | "with" | "as" ) name ] ;      (* → for name in range(value): *)
count       = ( "count" [ "down" | "up" ] | "for" ) [ name ] "from" value [ "down" ] "to" value
              [ ( "in steps of" | "by" | "step" | "stepping by" ) value ] ;
                (* includes the end; counts down when "down" is said or both ends are numbers and the first is bigger;
                   no name: n *)                                          (* → for name in range(a, b + 1[, step]): *)
for-each    = ( "for each" | "for every" | "go through each" | "go through every" | "with each" | "for" )
              name { "," name } ( "in" | "of" | "from" ) value ;                   (* → for name in value: *)
break       = "stop the loop" | "stop looping" | "stop repeating" | "stop loop" | "exit the loop"
            | "leave the loop" | "break" [ "out" ] [ "of the loop" ] ;              (* → break *)
continue    = "skip to" [ "the" ] "next" [ "one" | "round" | "item" ] | "skip the rest" | "next round" | "continue" ;
                                                                          (* → continue *)
pass        = "do nothing" | "nothing" | "pass" ;                                   (* → pass *)
exit        = "stop the program" | "end the program" | "quit" | "exit" [ "the program" ] ; (* → sys.exit() *)

(* Showing and asking *)
blank-line  = ( "show" | "print" | "say" | "display" ) ( "nothing" | "a blank line" | "an empty line" | "a new line" | "blank" ) ;
                                                                          (* → print() *)
show        = ( "show" | "print" | "display" | "say" | "write" | "output" ) items
              [ "on the same line" | "without a new line" | "and stay on this line" ] ;  (* → print(items[, end=" "]) *)
ask         = "ask" [ "for" | "the user for" | "them for" ] [ "a" | "an" ]
              [ "whole number" | "number" | "decimal" [ "number" ] | "text" | "word" | "answer" | "name" ] [ value ]
              [ "and" ] ( "store" | "save" | "keep" | "put" | "remember" ) [ "it" | "that" | "the answer" | "the reply" ]
              ( "in" | "as" | "into" ) name ;              (* → name = input(value); int(…) for a number, float(…) for a decimal *)
ask-only    = "ask" value ;                                            (* → input(value), with a warning *)

(* Lists and dictionaries *)
make-list   = ( "create" | "make" | "start" ) [ "a" | "an" ] [ "new" ] [ "empty" ] "list" [ "called" | "named" ] name
              [ ( "with" | "containing" | "holding" | "of" ) items ] ;               (* → name = [items] *)
make-dict   = ( "create" | "make" | "start" ) [ "a" | "an" ] [ "new" ] [ "empty" ]
              ( "dictionary" | "dict" | "lookup table" | "lookup" ) [ "called" | "named" ] name ; (* → name = {} *)
add         = ( "add" | "append" | "put" ) value ( "to" | "onto" | "into" ) [ "the end of" ] target ; (* by kind: see Context *)
remove      = ( "remove" | "delete" ) value "from" target ;                         (* by kind: see Context *)
subtract    = ( "subtract" | "take away" | "take" ) value "from" target ;          (* → target -= value *)
increase    = ( "increase" | "raise" | "increment" | "bump up" | "go up" ) target [ "by" value ] ;   (* → target += value (1) *)
decrease    = ( "decrease" | "lower" | "reduce" | "decrement" | "go down" ) target [ "by" value ] ;  (* → target -= value (1) *)
multiply    = "multiply" target "by" value ;                                        (* → target *= value *)
divide      = "divide" target "by" value ;                                          (* → target /= value *)
list-verb   = ( "sort" | "reverse" | "shuffle" | "empty" | "clear" ) target
              [ "backwards" | "in reverse" | "biggest first" | "largest first" | "highest first" | "descending" ] ;
                    (* → target.sort([reverse=True]), target.reverse(), random.shuffle(target), target.clear() *)

(* Time *)
wait        = ( "wait" | "pause" | "sleep" ) [ "for" ] value ( "second" | "seconds" | "sec" | "secs" | "s" ) ;
                                                       (* "s" only straight after a digit *)  (* → time.sleep(value) *)

(* Objects *)
new-object  = ( "make" | "create" ) [ "a" ] "new" Class [ ( "with" | "using" | "from" ) items ]
              "and" ( "store" | "keep" | "save" | "put" ) [ "it" ] ( "in" | "as" | "into" ) name ; (* → name = Class(items) *)

(* Storing *)
set         = ( "set" | "make" | "let" | "change" | "update" ) target
              ( "to be" | "to" | "be" | "equal to" | "equal" | "=" ) ( result-of | value ) ;  (* → target = value *)
remember    = ( "remember" | "store" | "save" | "keep" ) value ( "as" | "in" | "into" ) target ; (* → target = value *)
result-of   = [ "the" ] ( "result" | "answer" | "output" ) "of" name [ ( "with" | "using" | "on" ) items ] ; (* → name(items) *)
target      = name | name "." name { "." name }
            | [ "the" ] "item" value ( "of" | "in" ) value                          (* → value[key] *)
            | [ "the" ] ( "first" | "last" ) "item" ( "of" | "in" ) value ;         (* → value[0], value[-1] *)

(* Running tools *)
run         = ( "run" | "call" | "do" | "use" | "perform" ) [ "the" ] [ "tool" ] name
              [ ( "with" | "using" | "on" | "for" ) ( "nothing" | items ) ]
              [ "and" ( "store" | "save" | "keep" | "put" | "remember" ) [ "it" | "the result" | "the answer" | "what it gives back" ]
                ( "in" | "as" | "into" ) name ] ;                                   (* → [name =] tool(items) *)
                (* a tool whose name holds "with", "for" or "on" keeps its whole name *)

(* Already Python *)
assignment  = identifier ( "=" | "+=" | "-=" | "*=" | "/=" ) value ;                (* kept, names checked *)
call        = value ;                (* a line that reads as one call, like print("hi") or greet(name), is kept *)
```

Anything else is an error: "I don't recognise this sentence", with a guess at the sentence meant, and
`# ??? …` in the code.

## Grammar: websites

### Structure (HTML)

Any line can end with `in group g` or `in groups g, h` (classes). A container takes the lines indented
under it. The first sentence that fits wins, in this order.

```ebnf
title       = ( "set the page title to" | "page title is" | "the page is called" | "title" ) text ;  (* → <title> *)
language    = ( "page language is" | "the page is in" ) code ;                      (* → <html lang="…"> *)
heading     = "add" [ "a" | "an" ] [ "big" | "small" ] "heading" text [ "called" name ] ; (* → <h1>, <h2>, <h3> *)
paragraph   = "add" [ "a" ] "paragraph" [ ( "called" | "named" ) name ] text ;      (* → <p> *)
span        = "add text" text ;                                                     (* → <span> *)
button      = "add" [ "a" ] "button" [ "called" name ] ( "saying" | "that says" | "labelled" | "labeled" ) text ;
                                            (* → <button type="button">; type="submit" inside a form *)
link        = "add" [ "a" ] "link" [ "called" name ] "to" text ( "saying" | "showing" ) text ; (* → <a href> *)
picture     = "add" [ "a" ] ( "picture" | "image" | "photo" ) [ "called" name ] "of" text [ "described as" text ];
                                                                          (* → <img src alt> *)
box         = "add" [ "a" | "an" ] [ "big" ] [ "text" | "number" | "password" | "email" | "date" | "time" | "search" | "colour" ]
              ( "box" | "field" | "input" ) [ "called" name ] { box-setting } ;  (* → <input type>, "big" → <textarea> *)
box-setting = "with hint" text | "allowing decimals" | "in steps of" number | "from" number "to" number
            | "at least" number | "at most" number | "with a" ( "number" | "decimal" | "phone" | "email" | "search" | "url" ) "keypad" ;
slider      = "add" [ "a" ] "slider" [ "called" name ] { box-setting } ;           (* → <input type="range"> *)
file-picker = "add" [ "a" ] "file picker" [ "called" name ]
              [ "for" [ "a" | "an" | "any" | "one" ] [ "several" | "many" | "multiple" ] ( "pictures" | "sounds" | "videos" | "text files" | "files" | text ) ] ;
                                                                          (* → <input type="file" accept [multiple]> *)
checkbox    = "add" [ "a" ] ( "checkbox" | "tick box" ) [ "called" name ] [ "saying" text ] ; (* → <label><input type="checkbox"> text</label> *)
drop-down   = "add" [ "a" ] ( "drop-down" | "dropdown" | "drop-down list" | "menu of choices" ) [ "called" name ] "with" items ;
                                                                          (* → <select><option>… *)
list-item   = "add" [ "a" ] [ "list" ] "item" text ;                                (* → <li> *)
label       = "add" [ "a" ] "label" text [ "for" name ] ;                           (* → <label for> *)
video       = "add" [ "a" ] "video" [ "called" name ] "of" text ;                   (* → <video controls> *)
canvas      = "add" [ "a" ] ( "drawing area" | "canvas" ) [ "called" name ] [ number ( "by" | "x" ) number ] ; (* → <canvas> *)
rule        = "add" [ "a" ] "line" ;                                                (* → <hr> *)
container   = "add" [ "a" | "an" ] container-word [ "called" name ] ;               (* opens a block *)
container-word = "section" | "header" | "footer" | "navigation bar" | "navigation" | "nav" | "main area" | "main content"
            | "main" | "block" | "box" | "area" | "form" | "side panel" | "sidebar" | "article" | "card"
            | "numbered list" | "list" | "table" | "row" | "pop-up" | "dialog" ;
                (* → section, header, footer, nav, main, div, form, aside, article, div class="card", ol, ul, table, tr, dialog *)
```

Page-level lines (`head:`, `doctype:`, `no title` …) are in [Exact-code lines](#exact-code-lines).

### Styling (CSS)

```ebnf
media       = "on" ( "screens" | "phones" | "devices" ) ( "narrower" | "smaller" | "wider" | "bigger" ) "than" value [ ":" ] ;
                                            (* → @media (max-width: …) or (min-width: …); takes the indented lines *)
dark        = "in dark mode" [ ":" ] ;                                (* → @media (prefers-color-scheme: dark) *)
shared      = ( "shared" | "main" ) ( "colour" | "color" ) name "is" colour ;      (* → :root { --name: colour } *)
join-group  = name ( "belongs to" | "is in" | "joins" ) "group" name ;             (* adds the class to that element in Structure *)
group       = ( "create" | "make" ) [ "a" ] "group" name ":" styles ;             (* → .name { … } *)
state       = "when" what "is" ( "hovered" | "pointed at" | "clicked" | "focused" | "selected" ) ":" styles ;
                                                                          (* → :hover, :active, :focus, :checked *)
piece       = ( "before" | "after" | "at the start of" | "at the end of" ) what ":" styles ; (* → ::before, ::after *)
style       = ( "style" | "make" | "give" ) what ":" styles ;
styles      = style-phrase { ( "," | "and" ) style-phrase } ;
what        = selector-word | "group" name | [ "the" ] "element" name | "every" what | name | tag | css-selector ;
```

**What to style** is looked up in this order: the selector words (`buttons`, `headings`, `links`,
`the page`, `everything` …; listed in the [index](#css)), then a page element's name (`#id`), then a group
(`.class`), then an HTML tag name, then a list of tag names. Anything starting with `.`, `#`, `:`, `*` or
`[`, or containing `>`, `~` or `+`, is a CSS selector written directly. A name nothing has gets a warning
and `#name`.

**Style phrases**, tried in this order for each part between commas:

| Say | Becomes |
|---|---|
| `property: value` (any CSS property, `--custom` and `-webkit-…` too) | as written |
| `background C`, `background colour C`, `background C N% see-through` | `background: C` (an rgba colour when see-through) |
| `background picture URL` | `background-image: url(URL)`, `background-size: cover` |
| `text colour C`, `colour C`, `text C` | `color: C` |
| `text size N`, `font size N`, `size of text N` | `font-size` |
| `bold`, `italic`, `capitals` (`all capitals`, `uppercase`), each with an optional `text` | `font-weight`, `font-style`, `text-transform` |
| `font F` | `font-family: "F", sans-serif` |
| `space inside V…`, `padding V…`, `inner space V…` | `padding` |
| `space around V…`, `margin V…`, `outer space V…` | `margin` |
| `centred`, `centered`, `in the middle` | `margin-left: auto; margin-right: auto` |
| `centre the text`, `centred text` | `text-align: center` |
| `rounded corners [N]` | `border-radius` (8px) |
| `round`, `circle`, `circular` | `border-radius: 50%` |
| `no border`; `border [W] [C]` | `border: none`; `border: W solid C` (1px, currentColor) |
| `no shadow`; `[soft \| big \| strong] shadow [C] [with N% intensity]` | `box-shadow` |
| `N% see-through`, `N% transparent` | `opacity` |
| `hidden` | `display: none` |
| `width V`, `height V`, `at most V wide`, `at least V tall` | `width`, `height`, `max-width`, `min-height` |
| `in a row`, `side by side` / `in a column`, `stacked` / `in a grid of N columns` | flex row / flex column / grid |
| `gap V`, `space between V`; `spread out` | `gap`; `justify-content: space-between` |
| `hand cursor`, `clickable cursor`, `looks clickable` | `cursor: pointer` |
| `smooth`, `smooth changes`, `animated changes` | `transition: all 0.2s ease` |
| `no underline` | `text-decoration: none` |
| `stays in place`, `fixed` | `position: sticky; top: 0` |
| `at X, Y`, `placed at X, Y` | `position: absolute` with `left` and `top` (warning) |
| `property value` (a known CSS property, no colon) | as written |

**Colours** are names (`navy`, `tomato`, `light blue` …), codes (`#1a2b3c`), `rgb(…)`, `hsl(…)`, `var(…)`,
`the colour NAME` (a shared colour), `the text colour` (`currentColor`) and `inherit`. Anything else is an
error.

```intuicode html
add a section called main area in group dark
    add a button called save saying "Save"
```

```html
<section id="main-area" class="dark">
  <button id="save" type="button">Save</button>
</section>
```

```intuicode css
style main area: background navy
style group dark: text colour white
when save is hovered: background the colour accent
shared colour accent is #4f7cff
```

```css
:root {
  --accent: #4f7cff;
}

#main-area {
  background: navy;
}

.dark {
  color: white;
}

#save:hover {
  background: var(--accent);
}
```

### Mechanics (JavaScript)

`element` is a page element: one named in Structure, one made in Mechanics, or a Mechanics name that holds
one (see [Context](#website-context)). The first sentence that fits wins, in this order.

```ebnf
(* Checked first: js:, description: and note: lines (see "Kinds of line") *)

(* Things that happen *)
loaded      = "when" [ "the" ] "page" [ "has" ] ( "loaded" | "opens" | "starts" ) ;   (* → DOMContentLoaded listener *)
any-key     = "when" ( "a" | "any" ) "key is pressed" ;                             (* → keydown; event.key *)
one-key     = "when" [ "the" ] "key" text "is" ( "pressed" | "released" | "let go" ) ; (* → keydown / keyup for that key *)
screen      = "when" [ "the" ] ( "screen" | "page" | "mouse" | "pointer" | "finger" ) "is"
              ( "tapped" | "touched" | "released" | "let go" | "lifted" ) ;          (* → pointerdown / pointerup *)
moves       = "when" [ "the" ] ( "pointer" | "mouse" | "finger" ) ( "moves" | "is moved" )
              [ ( "over" | "on" | "across" | "in" | "inside" ) element ] ;           (* → pointermove *)
tapped      = "when" element "is" ( "tapped" | "touched" | "released" | "let go" | "lifted" ) ;
event       = "when" element "is" ( "clicked" | "pressed" | "changed" | "typed in" | "hovered" | "pointed at" | "sent" | "submitted" ) ;
                         (* → click, click, change, input, mouseenter, mouseenter, submit (+ preventDefault) *)
frame       = "every frame" ;                                                       (* → requestAnimationFrame loop *)
keys        = "keep track of" [ "the" ] "keys" ;                                    (* → keysDown, a Set *)
timer       = ( "every" | "after" ) [ value ] ( "second" | "seconds" ) [ "as" name ] ;  (* → setInterval / setTimeout *)
stop-timer  = "stop" [ "repeating" | "the repeat" | "the timer" ] name ;            (* → clearInterval / clearTimeout *)

(* The page *)
get-text    = "get the" ( "text" | "value" ) ( "of" | "in" | "from" ) element "and store" [ "it" ] "in" name ;
set-text    = "set the" ( "text" | "value" ) "of" element "to" value ;  (* → .value for boxes, .textContent otherwise *)
make-new    = ( "make" | "create" | "add" ) [ "a" | "an" ] "new" kind
              [ ( "saying" | "showing" | "that says" ) value ] [ "to" value ] [ "of" value [ "described as" value ] ]
              [ "in" ( "group" | "groups" ) names ] [ ( "in" | "into" ) element ] [ "and store" [ "it" ] "in" name ] ;
kind        = "button" | "list item" | "item" | "block" | "box" | "area" | "card" | "paragraph" | "text" | "link"
            | "picture" | "image" | "photo" | "heading" | "big heading" | "small heading" | "section" | "list"
            | "numbered list" | "label" | "option" | "row" | "cell" | "drawing area" | "canvas" ;
                (* "make a new list called scores [with …]" is a list of values: make-list, below *)
tick        = ( "tick" | "untick" ) element ;                                       (* → .checked = true / false *)
clear-area  = ( "clear" | "empty" ) [ "the drawing area" ] canvas ;                 (* → clearRect *)
fill        = "fill" canvas "with" colour ;
rectangle   = "draw" [ "a" | "an" ] ( "rectangle" | "box" | "square" | "block" ) "at" value "," value
              ( "sized" | "size" | "of size" ) value "by" value "in" colour "on" canvas ;
circle      = "draw" [ "a" ] ( "circle" | "dot" | "ball" ) "at" value "," value [ "with" [ "a" ] ] "radius" value "in" colour "on" canvas ;
draw-text   = "draw" [ "the" ] "text" value "at" value "," value [ [ "in" ] "size" value ] "in" colour "on" canvas ;
line        = "draw" [ "a" ] "line from" value "," value "to" value "," value "in" colour "on" canvas ;
load-picture = "load" [ "the" | "a" ] ( "picture" | "image" ) text ( "as" | "called" ) name ;  (* → new Image() *)
draw-picture = "draw" name "at" value "," value [ ( "sized" | "size" | "of size" ) value "by" value ] "on" canvas ;
note-sound  = "play" [ "a" ] "note" [ "of" ] value "for" value ( "second" | "seconds" ) ;  (* → an oscillator *)
clear       = ( "clear" | "empty" ) element ;                         (* → .value = "" for boxes, replaceChildren() otherwise *)
hide        = "hide" element | ( "reveal" | "unhide" | "show the element" ) element ; (* → .hidden = true / false *)
groups      = "put" element ( "in" | "into" ) "group" name | "take" element "out of group" name
            | ( "switch" | "toggle" ) "group" name "on" element ;                   (* → classList.add / remove / toggle *)
page-list   = "add" value "to the" [ "page" ] "list" element | "add" value "to" list-element ; (* → a new <li> *)
scroll      = "scroll to" element ;
message     = "show" [ "a" ] "message" value ;                                      (* → alert *)
go-to       = ( "go to" | "open the page" ) value ;                                 (* → window.location.href *)

(* The server and the browser's memory *)
fetch       = ( "fetch" | "get" | "load" ) [ "data" ] "from" value "and store" [ "it" ] "in" name ; (* → await fetch(…).json() *)
send        = "send" value "to" value [ "and store the reply in" name ] ;           (* → POST as JSON *)
save        = "save" value "in the browser as" value ;                              (* → localStorage.setItem *)
load        = "load" value "from the browser and store" [ "it" ] "in" name ;       (* → JSON.parse(localStorage.getItem …) *)
wait-for    = "wait for" value [ "and store" [ "it" | "the result" | "the answer" ] "in" name ] ; (* → await value *)
try         = "try" ;  except = ( "if" | "when" ) ( "it" | "that" | "this" | "anything" | "something" ) "fails" [ "as" name ] ;
finally     = "finally" | "in any case" | "either way" | "whatever happens" ;
fail        = "fail with" value ;                                                   (* → throw new Error(value) *)

(* Logic: the Python sentences, with JavaScript out *)
elif        = ( "otherwise if" | "else if" ) cond ;   else = "otherwise" | "else" ;   if = "if" cond ;
times       = "repeat" value ( "time" | "times" ) [ "counting with" name ] ;      (* → for (let i = 0; i < value; i++) *)
for-each    = "for each" name "in" value ;                                          (* → for (const name of value) *)
while       = ( "while" | "as long as" ) cond ;
define      = "define" name [ "using" params ] ;                                    (* → [async] function name(params) *)
return      = ( "give back" | "return" ) [ value ] ;
break       = "stop the loop" ;   continue = "skip to next" ;
make-list   = ( "create" | "make" ) [ "a" | "an" ] [ "new" ] [ "empty" ] "list" [ "called" ] name [ "with" items ] ;
add         = "add" value "to" name ;                                               (* → name.push(value) *)
increase    = ( "increase" | "decrease" ) target [ "by" value ] ;                   (* → +=, -=, ++, -- *)
ask         = "ask" value "and store" [ "it" ] "in" name ;                          (* → prompt *)
constant    = "constant" name ( "is" | "=" ) value ;                                (* → const *)
set-item    = ( "set" | "let" | "make" ) [ "the" ] ( ( "first" | "last" ) "item" | "item" value ) ( "of" | "in" ) value ( "to" | "be" ) value ;
set-path    = ( "set" | "let" | "make" ) path ( "to" | "be" ) value ;    (* a.b, a[i], meter-fill.style.width *)
set-field   = ( "set" | "let" | "make" ) [ "the" ] ( name | text ) "of" owner ( "to" | "be" ) value ;  (* → owner.name = value *)
set         = ( "set" | "let" | "make" ) name ( "to" | "be" ) value ;               (* → let name = value, or name = value *)
run         = "run" path [ "with" items ] [ "and store" [ "it" | "the result" ] "in" name ] ; (* → [await] path(items) *)
show        = "show" items ;                                                        (* → console.log(items) *)
```

In Mechanics, `items` split at commas only, except in `show`, which also splits at `and` before a word or
a quote.

```intuicode html
add a text box called name with hint "Your name"
add a paragraph called greeting ""
```

```html
<input id="name" placeholder="Your name">
<p id="greeting"></p>
```

```intuicode js
when name is typed in
    set the text of greeting to "Hi {text of name}"
```

```js
document.getElementById("name").addEventListener("input", () => {
  document.getElementById("greeting").textContent = `Hi ${document.getElementById("name").value}`;
});
```

## Grammar: C++ and Arduino

C++ and Arduino share one writer. Arduino adds the board sentences and changes some outputs (marked).
Types are worked out from values unless a sentence names them; see [Context](#c-and-arduino-context).

```ebnf
(* Checked first *)
above-main  = ( "above main" | "outside main" | "at the top" ) ":" code ;
exact       = ( "c++" | "cpp" | "raw" ) ":" code ;
note        = ( "note" | "comment" ) ":" text ;                                    (* → // text *)

(* Program set-up *)
include     = ( "include" | "use the library" ) ( "<" … ">" | text | header-name ) ;  (* → #include <…> *)
std         = "use namespace std" | "use the standard names" [ "directly" ] | "use std names directly" ; (* → using namespace std; *)

(* Classes: at the left edge, placed above main *)
class       = "define" [ "a" ] "class" Name [ "based on" Name ] ;                  (* → class Name : public Base { public: … }; *)
field       = "field" name ":" type [ ( "=" | "starting at" | "starting as" ) value ]
            | "has" [ "a" | "an" ] type name [ ( "starting at" | "starting as" | "=" ) value ] ;  (* → type name = value; *)
access      = ( "the rest is" | "from here on" ) ( "private" | "public" ) | ( "private" | "public" ) [ "part" | "parts" ] ;
made        = "when" ( "made" | "created" | "built" ) [ ( "using" | "with" ) params ] ; (* → the constructor; every input needs a type *)

(* Tools: at the left edge or in a class, placed above main *)
define      = "define" name [ "using" params ] [ "giving back" type ] ;            (* → type name(params) { … }, auto when unsaid *)
param       = [ type ] name ;
type        = "whole number" | "number" | "decimal" | "text" | "words" | "yes/no" | "character" | "nothing"
            | "list of" type | c++-type | class-name ;  (* → int, double, std::string (Arduino String), bool, char, void, std::vector<…> *)

(* Arduino: the two parts *)
setup       = "when the board" ( "starts" | "turns on" | "powers on" | "wakes up" ) | "at the start" | "setup" ;  (* → void setup() *)
loop        = "over and over" [ "again" ] | "again and again" | "repeat forever" | "forever" | "keep repeating" | "loop" ;
                                                       (* at the left edge → void loop() *)
(* At the left edge of a sketch, besides these two, define, define class, include and exact code, only set, constant,
   create list and make a new are allowed; anything else is an error. *)

(* Logic *)
return      = ( "give back" | "return" ) [ value ] ;
elif        = ( "otherwise if" | "else if" ) cond ;   else = "otherwise" | "else" ;   if = "if" cond ;
forever     = "repeat forever" | "forever" | "keep repeating" ;                    (* → while (true) *)
times       = "repeat" value ( "time" | "times" ) [ "counting with" name ] ;      (* → for (int i = 0; i < value; i++) *)
count       = "count" name "from" value "to" value ;      (* → for (int name = a; name <= b; name++); down when both are numbers and a > b *)
for-each    = "for each" name "in" value ;                                          (* → for (const auto& name : value) *)
while       = ( "while" | "as long as" ) cond ;
break       = "stop the loop" ;   continue = "skip to next" ;

(* Arduino: pins, time, sound *)
pin-mode    = ( "make" | "set" ) [ "pin" ] pin ( "a" | "an" | "as" [ "a" | "an" ] ) ( "output" | "input" ) [ "with" [ "a" ] "pull-up" ] ;
                                                                          (* → pinMode(pin, OUTPUT | INPUT | INPUT_PULLUP) *)
turn        = "turn" ( "on" | "off" ) pin | "turn" pin ( "on" | "off" ) | "set pin" pin "to" ( "high" | "low" | "on" | "off" ) ;
                                                                          (* → digitalWrite(pin, HIGH | LOW) *)
level       = ( "set the" ( "brightness" | "level" | "power" ) "of" | "dim" ) pin "to" value | "write" value "to pin" pin ;
                                                                          (* → analogWrite(pin, value) *)
read        = "read" [ "analog" ] [ "pin" ] pin "and store" [ "it" ] "in" name ;    (* → int name = digitalRead / analogRead(pin) *)
wait        = "wait" [ "for" ] value ( "millisecond" | "milliseconds" | "ms" | "second" | "seconds" | "sec" | "secs" ) ;
                                                                          (* → delay(ms) *)
serial      = "start" ( "the serial monitor" | "talking to the computer" ) [ "at" number ] ; (* → Serial.begin(9600) *)
tone        = "play" [ "a" ] ( "tone" | "note" | "sound" ) [ "of" ] value "on" [ "pin" ] pin [ "for" value ( "millisecond" | "milliseconds" ) ] ;
stop-tone   = "stop the" ( "tone" | "note" | "sound" ) "on" [ "pin" ] pin ;         (* → noTone(pin) *)
pin         = value | "the built-in light" | "the built-in led" ;                   (* → LED_BUILTIN *)

(* Showing and asking *)
show        = "show" ( value { "followed by" value } | items ) [ "on the same line" ] ;
                (* "and" or "," put a space between the pieces, "followed by" none
                   → std::cout << a << " " << b << std::endl;  Arduino: Serial.print / Serial.println *)
ask         = "ask" [ "for" [ "a" | "an" ] ( "whole number" | "number" | "decimal" ) ] value "and store" [ "it" ] "in" name ;
                (* → std::cout << value; then std::cin >> name or std::getline; an error on Arduino *)

(* Values *)
make-list   = ( "create" | "make" ) [ "a" | "an" ] [ "empty" ] "list"
              [ "of" ( "numbers" | "whole numbers" | "decimals" | "text" | "words" ) ] [ "called" ] name [ "with" items ] ;
                (* → std::vector<T> name = {…};  Arduino: T name[] = {…}, items required *)
add         = "add" value "to" name ;                    (* → push_back for a list, an error for an Arduino list, += otherwise *)
increase    = ( "increase" | "decrease" ) target [ "by" value ] ;                   (* → +=, -=, ++, -- *)
new-object  = "make" [ "a" ] "new" Class [ "with" items ] "and store" [ "it" ] "in" name ; (* → Class name(items); *)
run         = "run" path [ "with" items ] [ "and store" [ "it" | "the result" ] "in" name ] ; (* → [auto name =] path(items); *)
set-path    = ( "set" | "let" | "make" ) ( "self." name | path | name "[" … "]" ) ( "to" | "be" ) value ;  (* → this->name = value; *)
constant    = "constant" [ type ] name ( "is" | "=" ) value ;                       (* → const type name = value; *)
set-typed   = ( "set" | "let" ) type name ( "to" | "be" ) value ;                   (* → type name = value; *)
set         = ( "set" | "let" | "make" ) name ( "to" | "be" ) value ;               (* → type name = value; first time, else name = value; *)
stop        = "stop the program" ;                     (* → return 0; in main, std::exit(0) in a tool, while (true) {} on a board *)
```

```intuicode cpp
set name to "Sam"
set age to 30
set height to 1.8
create list of numbers called scores with 7, 9
add 10 to scores
show name and age
```

```cpp
#include <iostream>
#include <string>
#include <vector>

int main() {
    std::string name = "Sam";
    int age = 30;
    double height = 1.8;
    std::vector<int> scores = {7, 9};
    scores.push_back(10);
    std::cout << name << " " << age << std::endl;
    return 0;
}
```

```intuicode arduino
constant LED is 13
when the board starts
    make pin LED an output
    start the serial monitor at 9600
over and over
    turn pin LED on
    wait 500 milliseconds
    turn pin LED off
    wait 0.5 seconds
    show "blink"
```

```cpp
const int LED = 13;
void setup() {
    pinMode(LED, OUTPUT);
    Serial.begin(9600);
}
void loop() {
    digitalWrite(LED, HIGH);
    delay(500);
    digitalWrite(LED, LOW);
    delay(500);
    Serial.println("blink");
}
```

## How a value is read: binding and precedence

A value (the part after `set … to`, `if`, `show` …) is read in fixed stages. No stage builds a syntax
tree: each swaps words for code in place, so the order of the stages decides what binds to what, and the
target language's own precedence decides the rest.

### Python values

1. **Quoted text is set aside**, so nothing inside it is touched.
2. **Names with spaces** become their Python spelling (`high score` → `high_score`), longest first.
3. **`the`** is removed. In a condition a lone `=` becomes `==`. `wait for` becomes `await`.
4. **Phrases**, in the order of the table below. A phrase takes an **operand**: a quoted text, a number, a
   name or a bracketed group `( … )` / `[ … ]`, followed by any `.name`, `( … )` or `[ … ]`. A phrase can
   take another phrase's result as its operand only when that phrase comes earlier in the table
   (`length of item 0 of xs` works; `length of sorted xs` doesn't: write `length of (sorted xs)`).
5. **Operator words** become Python operators, then plain values (`yes`, `nothing` …).
6. **Names** are checked: known names, built-ins, modules (imported for you) and number words.
7. **Fill-ins** in quoted text are read the same way and become an f-string.

| # | Phrase | Becomes |
|---|---|---|
| 1 | `first item of X` (`one`, `thing`; `of`, `in`, `from`) / `last item of X` | `X[0]` / `X[-1]` |
| 2 | `item K of X` (`of`, `in`, `from`) | `X[K]` |
| 3 | `length of X`, `size of X`; `how many [items] [are] in X`, `number of items in X`, `count of X` | `len(X)` |
| 4 | `sum of X`, `total of X` | `sum(X)` |
| 5 | `biggest in X` (`largest`, `highest`, `maximum`, `max`; `of`, `in`) / `smallest in X` (`lowest`, `minimum`, `min`) | `max(X)` / `min(X)` |
| 6 | `square root of X` / `absolute [value] of X` | `math.sqrt(X)` (imports `math`) / `abs(X)` |
| 7 | `X rounded to N [decimal] places` / `X rounded` | `round(X, N)` / `round(X)` |
| 8 | `sorted X`, `X sorted` | `sorted(X)` |
| 9 | `X as [a] [whole] number` / `X as [a] decimal [number]` / `X as text` | `int(X)` / `float(X)` / `str(X)` |
| 10 | `X in capitals` (`capital letters`, `uppercase`, `upper case`) / `X in lowercase` (`lower case`, `small letters`) | `X.upper()` / `X.lower()` |
| 11 | `pairs of X` (`of`, `in`) | `X.items()` |
| 12 | `random [whole] number from A to B` (`from`/`between`, `to`/`and`) | `random.randint(A, B)` (imports `random`) |
| 13 | `random decimal`, `random fraction` / `random item from X` (`choice`, `one`, `pick`, `thing`; `from`, `of`, `in`) | `random.random()` / `random.choice(X)` |
| 14 | `X squared` / `X cubed` | `X ** 2` / `X ** 3` |
| 15 | `X is [exactly] divisible by Y` / `X is even` / `X is odd` | `X % Y == 0` / `X % 2 == 0` / `X % 2 == 1` |
| 16 | `X does not contain Y` (`doesn't`) / `X contains Y` | `Y not in X` / `Y in X` |
| 17 | `is not nothing` / `is nothing` (`none`) | `is not None` / `is None` |
| 18 | `is not in` (`inside`, `one of`) | `not in` |
| 19 | `is at least`, `is greater than or equal to` (`more`, `bigger`, `higher`, `larger`) | `>=` |
| 20 | `is at most`, `is less than or equal to` (`smaller`, `lower`, `fewer`) | `<=` |
| 21 | `is greater than` (`more`, `bigger`, `higher`, `larger`), `is over`, `is above` | `>` |
| 22 | `is less than` (`smaller`, `lower`, `fewer`), `is under`, `is below` | `<` |
| 23 | `is not`, `isn't`, `is not equal to`, `is not the same as`, `does not equal` | `!=` |
| 24 | `is in` (`inside`, `one of`) | `in` |
| 25 | `is`, `equals`, `is equal to`, `is the same as` | `==` |
| 26 | `plus`, `added to`, `joined with`, `joined to`, `followed by` / `minus`, `take away` | `+` / `-` |
| 27 | `times`, `multiplied by` / `divided by` / `mod`, `modulo`, `remainder after dividing by` | `*` / `/` / `%` |
| 28 | `to the power of` | `**` |
| 29 | `[an] empty list` / `[an] empty dictionary` / `empty text` | `[]` / `{}` / `""` |
| 30 | `yes`, `true` / `no`, `false` / `nothing`, `none` / `otherwise` | `True` / `False` / `None` / `else` |
| 31 | `and`, `or`, `not` | `and`, `or`, `not` |

After the swaps, Python's precedence groups the operators, tightest first: `**`; `*` `/` `%`; `+` `-`;
comparisons (`==` `!=` `<` `<=` `>` `>=` `in` `not in` `is` `is not`); `not`; `and`; `or`; `… if … else …`.

So: a phrase binds to the one operand next to it (`length of xs plus 1` is `len(xs) + 1`), and one that
follows its value (`as text`, `rounded` …) right after a sum is an error that asks for brackets
(`(n plus 1) as text`; see [Two readings](#two-readings-refused-never-guessed-python)); `is even`, `is odd`
and `is divisible by` take the whole sum before them; `times` binds tighter than `plus`; `not` covers the whole comparison after it; and
brackets group.

```intuicode python
create list xs with 4, 9
set n to 2
set a to n plus 1 times 2
set b to length of xs plus 1
set c to length of (xs plus [5])
set d to (n plus 1) as text
set e to n squared plus 1
set f to not n is 2 and n is even
set g to n is at least 1 or n is nothing
set h to 1 if n is 2 otherwise 0
set i to random number from 1 to length of xs
set j to xs contains 4
```

```python
import random

xs = [4, 9]
n = 2
a = n + 1 * 2
b = len(xs) + 1
c = len((xs + [5]))
d = str((n + 1))
e = n ** 2 + 1
f = not n == 2 and n % 2 == 0
g = n >= 1 or n is None
h = 1 if n == 2 else 0
i = random.randint(1, len(xs))
j = 4 in xs
```

### JavaScript values (Mechanics)

The same stages, with these phrases in this order. An operand is a quoted text, a number or a name
(a page element's name may have dashes), followed by any `.name`, `( … )` or `[ … ]`; a bracketed group is
not an operand, so `length of (a plus b)` isn't read.

| # | Phrase | Becomes |
|---|---|---|
| 1 | `[key] "K" is held`, `is held down`, `is down` | `keysDown.has("K")` (needs `keep track of the keys`) |
| 2 | `tap x`, `click x`, `pointer x` (and `y`) | `event.offsetX` / `event.offsetY` |
| 3 | `width of E`, `height of E`; `text of E` (page elements) | `….width`, `….height`; `….value` for a box, `….textContent` otherwise |
| 4 | `file in E` (`first file`; `in`, `of`, `from`, `picked in`), `files in E` | `….files[0]`, `….files` |
| 5 | `first item of X`, `last item of X`, `item K of X`, innermost first | `X[0]`, `X[X.length - 1]`, `X[K]` |
| 6 | `length of X`, `size of X`, `how many [items] in X` | `X.length` |
| 7 | `random [whole] number from A to B` | `(Math.floor(Math.random() * (B - A + 1)) + A)`; an error when B is followed by maths |
| 8 | `random item from X` (`of`, `in`) | `X[Math.floor(Math.random() * X.length)]` |
| 9 | `X as [a] number` / `X as text` | `Number(X)` / `String(X)` |
| 10 | `X in capitals`, `X in uppercase` / `X in lowercase` | `X.toUpperCase()` / `X.toLowerCase()` |
| 11 | `X is not ticked` (`checked`) / `X is ticked` | `!X.checked` / `X.checked` |
| 12 | `X is not in group G` / `X is in group G` | `!X.classList.contains("g")` / `X.classList.contains("g")` |
| 13 | `X contains Y` | `X.includes(Y)` |
| 14 | `X is not in Y` (`one of`) / `X is in Y` | `!Y.includes(X)` / `Y.includes(X)` |
| 15 | `[an] empty list` / `empty text` | `[]` / `""` |
| 16 | `is not nothing` / `is nothing` | `!= null` / `== null` |
| 17 | `is not`, `isn't`, `is not equal to`, `is not the same as` | `!==` |
| 18 | `is at least`, `is … than or equal to`; `is at most`, `is … than or equal to` | `>=`; `<=` |
| 19 | `is greater than` (`more`, `bigger`, `higher`), `is over`; `is less than` (`smaller`, `lower`, `fewer`), `is under` | `>`; `<` |
| 20 | `is empty` | `.length === 0` |
| 21 | `is`, `equals`, `is equal to`, `is the same as` | `===` |
| 22 | `plus`, `minus`, `times`, `divided by`, `mod` | `+`, `-`, `*`, `/`, `%` |
| 23 | `and`, `or`, `not` | `&&`, `\|\|`, `!` |
| 24 | `yes`, `true` / `no`, `false` / `nothing`, `none` | `true` / `false` / `null` |

JavaScript's precedence then applies, tightest first: `!` (on the operand right after it); `*` `/` `%`;
`+` `-`; `<` `<=` `>` `>=`; `===` `!==` `==` `!=`; `&&`; `||`. Unlike Python, `not` binds to one
operand: see [Known wrong translations](#javascript-writer).

```intuicode js
set n to 2
set a to n plus 1 times 2
set b to n is at least 1 and n is not 3
set c to random number from 1 to 6
```

```js
let n = 2;
let a = n + 1 * 2;
let b = n >= 1 && n !== 3;
let c = (Math.floor(Math.random() * (6 - 1 + 1)) + 1);
```

### C++ and Arduino values

An operand is a quoted text, a number or a name with any `.name`, `::name` or `->name`, followed by any
`( … )` or `[ … ]`. In order:

| # | Phrase | C++ | Arduino |
|---|---|---|---|
| 1 | `self.` | `this->` | `this->` |
| 2 | `the built-in light`, `pin P is on` (`off`, `high`, `low`), `reading of pin P` (`[analog] level`; `of`, `on`), `pin P`, `time since start` | | `LED_BUILTIN`, `digitalRead(P) == HIGH`, `analogRead(P)`, `P`, `millis()` |
| 3 | `first item of X` / `last item of X` | `X.front()` / `X.back()` | `X[0]` / `X[(sizeof(X) / sizeof(X[0])) - 1]` |
| 4 | `item K of X` | `X[K]` | `X[K]` |
| 5 | `length of X`, `size of X` | `X.size()` | `X.length()` for text, `(sizeof(X) / sizeof(X[0]))` for a list |
| 6 | `random number from A to B` | `random_number(A, B)` (a helper is added) | `random(A, B + 1)` |
| 7 | `X as number` / `X as decimal` / `X as text` | `std::stoi(X)` / `std::stod(X)` / `std::to_string(X)` | `X.toInt()` / `X.toFloat()` / `String(X)` |
| 8 | `X squared` | `(X * X)` | `(X * X)` |
| 9 | `[not] S is even`, `S is odd` (`is not`, `isn't`); a sum before it is checked whole | `(S) % 2 == 0`, `… != 0` | the same |
| 10 | `is not`, `isn't`; `is at least`; `is at most`; `is greater than`; `is less than`; `is`, `equals` | `!=`, `>=`, `<=`, `>`, `<`, `==` | the same |
| 11 | `plus`, `minus`, `times`, `divided by`, `mod`; `and`, `or`, `not` | `+`, `-`, `*`, `/`, `%`; `&&`, `\|\|`, `!` | the same |
| 12 | `yes`, `true` / `no`, `false` | `true` / `false` | the same |

C++'s precedence then applies: `!`; `*` `/` `%`; `+` `-`; `<<`; `<` `<=` `>` `>=`; `==` `!=`; `&&`;
`||`. `followed by` is not an operator: it only separates the pieces of a `show`.

```intuicode cpp
set n to 2
set a to n plus 1 times 2
set b to n plus 1 is even
```

```cpp
#include <iostream>
#include <string>

int main() {
    int n = 2;
    int a = n + 1 * 2;
    int b = (n + 1) % 2 == 0;
    return 0;
}
```

## Context: what the writers remember

IntuaCode has one word where a language has several (`add` is `.append()`, `+=` or `.push()`; a name is a
variable or a page element; `set` declares or assigns). The writers decide from what they have seen.

### Python context

**Two passes.** The writer reads every folder once to collect names, then again to write the code. So a
sentence can use a name set further down or in another folder. Warnings are given in the second pass only.

**The symbol table** keeps, for each name:

| Field | Holds |
|---|---|
| Python spelling | `high_score` |
| words | `high score`: names with spaces are found in later sentences by these words |
| kinds | number, text, list, dictionary, yes/no, tool, class, module, value (not known) or mixed, **for each place it is set**: each tool, and the top of each file |
| folder | Settings, Tools or Main program, where it was first set |
| top lines | the first line it is set on at the top of each file (decides `global`, below) |
| inputs | a tool's inputs, and how many have no default |
| items | what the items put into a dictionary or list hold (`set item "food" of totals to 0`) |
| gives back | for a tool: what its `give back` lines hold |

**How a name gets its kind.** Each place keeps its own: a name that is text in one tool and a list in
Main program is each of those where it is set, so an edit in one place never changes what a line means
in another. In one place, the first sentence that sets a name decides its kind; a later one fills in a
kind that wasn't known, and one with a different kind makes it **mixed** (can't tell). A name used in a
tool that doesn't set it has the kind it has at the top of the file.

| Sentence | Kind |
|---|---|
| `set x to 5`, `… to length of …`, `… to random number …`, arithmetic of numbers; `ask for a number`; `count`, `repeat … counting with` | number |
| `set x to "…"`, `… as text`, `… in capitals`; `ask "…"`; `for each letter in` some text | text |
| `create list`, `set x to [ … ]`, `set x to sorted …`, `… .split()`, `list(…)`, `.keys()` / `.values()` | list |
| `create dictionary`, `set x to {}`, `dict(…)` | dictionary |
| `set x to yes` | yes/no |
| `define` | tool |
| `define class`, a `python:` class | class |
| `use`, `import`, a `python:` import | module |
| `set x to y` (y known), a `python:` assignment (from its value's shape: `python: names = []` is a list) | y's kind |
| `run t … and store in`, `set x to t(…)` | what tool t gives back, when its `give back` lines all hold one kind |
| `make a new … and store in`, `open … as`, `using … as`, `if it fails … as`, `field`, `for each` over a list | value |

**Sentences that depend on what T is:**

| Sentence | T is a list | T is a number or text | T can't be seen (value, mixed) | T is a dictionary | T isn't set anywhere |
|---|---|---|---|---|---|
| `add V to T` | `T.append(V)` | `T += V` | `.append(V)` when V is text, a list, a dictionary or yes/no; `+= V` when V is a number; `+= V` and a warning when V can't be seen either, or T is mixed | error: give the key | error |
| `remove V from T` | `T.remove(V)`; `remove item N from T` is `T.pop(N)` | `T -= V` | `T -= V` | `del T[V]` | `T -= V`, and a warning |
| `sort T`, `reverse T`, `shuffle T`, `clear T` | as written | a warning | allowed | allowed | a warning |
| `for each x in T` | x is a value | x is text, letter by letter, when T is text | x is a value | x is each key | a warning |

- `add A and B to T` and `remove A and B from T` (plain values) add or take out each one, on two lines.
- `put V into T` is `T = V`, unless T is a list.
- **An item of something** (`add V to totals[kind]`, `add V to grid[r]`): its kind is that of the items put
  in it, when they were all one kind; otherwise it can't be seen, as above.
- **`run T with …`** is an error when T is a number, text, list, dictionary or yes/no, or isn't set
  anywhere; for a tool, when the number of inputs is wrong. A class, a module or a value (from a
  `python:` line or an import) is trusted.

**Other context:**

- **Folders.** Settings, then Tools, then Main program. A name set in a later folder and used in an
  earlier one is a warning. A tool that changes a Settings value gets a warning: it only changes its own
  file's copy.
- **`global`.** A tool that sets a name which is set at the left edge of the same file *above* the tool
  changes that one: `global` is added at the top of the tool. A name set at the left edge only *below* the
  tool (like the starting block at the end of a file) isn't shared: setting it makes the tool's own copy,
  Python's own rule, and a note says so. Changing a name in place (`increase`, `add … to`, `+=`) always
  means the one outside. `use the shared NAME` says it outright. Lines are compared, so the same file
  always gives the same code.
- **Imports** (`random`, `math`, `time`, `sys`) are added when a phrase or a sentence needs one.
- **`name ()`**: a tool's or class's name followed by a space and brackets is joined to them.

```intuicode python
create list basket
set total to 0
set receipt to "Bought:"
add "milk" to basket
add 3 to total
add " milk" to receipt
remove "milk" from basket
remove 1 from total
```

```python
basket = []
total = 0
receipt = "Bought:"
basket.append("milk")
total += 3
receipt += " milk"
basket.remove("milk")
total -= 1
```

```intuicode python
set count to 0
define bump
    increase count
```

```python
count = 0
def bump():
    global count
    count += 1
```

### Website context

**Shared names.** The writer compiles Structure, then Styling (which can add groups to Structure's
elements), then Structure again, then Mechanics. Structure's `called NAME` gives the id; groups give
classes. Two elements with the same name are an error.

**Mechanics' own names** are collected in a first pass from `set`, `constant`, `create list`,
`… and store in NAME`, `for each`, `define` (tools and their inputs), `make a new … and store in`,
`load the picture … as`, timers named with `as`, `if it fails as`, and `js:` lines.

| Question | How it is decided |
|---|---|
| Which element does a statement mean (`when save is clicked`, `hide save`, `set the text of save`)? | An element made in Mechanics, then one named in Structure, then a Mechanics name that can hold an element. A name only ever set to a number, text, yes/no, a list or a record can't. Otherwise an error. |
| What is a name in a value? | A Mechanics name first; then a page element (`document.getElementById("…")`); then a browser name (`fetch`, `Math` …); otherwise a warning. |
| `.value` or `.textContent`? | `.value` for a text box, big text box or drop-down; `.textContent` otherwise. |
| `let` or `const`? | `set` makes a `let` the first time in a block, then assigns. `constant` makes a `const`; changing one is an error. A made element, a fetched reply and a `for each` name are `const` unless a later line in the same block changes them. |
| `async` and `await`? | A `when`, `every`, `after` or `define` block is `async` when a line in it uses `fetch`, `send … to`, `wait for`, or runs a tool that does. Running such a tool inside a block adds `await`. |
| `(event)`? | Key and pointer events always have it. For `when … is clicked` and the other element events, only when the block mentions `event`, or the form is being sent. |
| `add V to L` | A new `<li>` when L is a list in Structure; `.push(V)` otherwise. |
| Drawing | `clear` and `fill` draw only on a drawing area; `draw ship …` needs `load the picture … as ship`. |

```intuicode js
set count to 0
constant LIMIT is 10
for each item in [1, 2]
    increase count by item
```

```js
let count = 0;
const LIMIT = 10;
for (const item of [1, 2]) {
  count += item;
}
```

### C++ and Arduino context

| Question | How it is decided |
|---|---|
| A name's type | From the first `set`: text → `std::string` (`String` on Arduino), a whole number → `int`, a decimal → `double`, yes/no → `bool`, a comparison → `bool`, `std::stoi` and `size()` → `int`, `millis()` → `unsigned long`, arithmetic of known numbers → `int` or `double`, a known name → its type; otherwise `auto`. A type word says it outright: `set decimal price to 3`. |
| Declare or assign? | The first `set` of a name in a block declares it (`int x = 1;`); later ones assign. As in C++, a name declared inside a block is gone after it. |
| `add V to L` | `L.push_back(V)` for a list; an error for an Arduino list (fixed size); `L += V` otherwise. |
| Tools and classes | Collected in a first pass, so `run` can use one defined further down. Running an unknown tool is an error; making an unknown class is a warning. |
| Arduino tools | Inputs without a type are `int`; the result is `int` when the block gives something back, `void` otherwise. |
| Includes and helpers | `<vector>`, `<random>` with `random_number`, `<sstream>` with `text(…)`, `<cstdlib>` for `std::exit`, when a sentence needs them. |
| Arduino checks | Steps at the left edge are an error; only one `setup` and one `loop`; `show` before `start the serial monitor` is a warning. |

### Unknown names, errors and warnings

| Situation | Python | JavaScript | C++ |
|---|---|---|---|
| A name not set anywhere, in a value | warning, with "Did you mean …?" | warning | warning |
| `run` a tool that doesn't exist | error | nothing said | error |
| `add` to a name that doesn't exist | error | `.push` | `+=` |
| A sentence that fits no rule | error, `# ???` line | error, `// ???` line | error, `// ???` line |

- **Errors** mean the line can't be translated as written, or would certainly be wrong. Problems lists
  them. They stop Run for Python, C++ and Arduino; a website's preview still updates, with a message that
  parts may be missing. The line still produces a placeholder or its best code, so the rest of the file
  can be read.
- **Warnings** mean the code was written but something looks off. Run goes ahead.
- **Notes** explain each choice (why `add` became `.append()`); they are never problems.

### Two readings: refused, never guessed (Python)

English often allows two readings where code allows one. Where the Python writer can't tell which was
meant, the line is an error that says how to put it, instead of picking one:

| You write | Why it's asked about | Say instead |
|---|---|---|
| `total divided by count rounded to 2 places` (also `as text`, `as number`, `as decimal`, `in capitals`, `sorted` after a sum; `squared` and `cubed` bind tightest, as in maths) | just `count`, or the whole sum? | `(total divided by count) rounded to 2 places` |
| `random number from 1 to n plus 1` | a number up to n, plus 1; or up to n plus 1? | `random number from 1 to (n plus 1)` |
| `colour is not "red" or "blue"` (and `is more than 1 or 2`…) | Python would test `"blue"` on its own | `colour is not "red" or colour is not "blue"` |
| `name contains "a" and "b"` | the same | `name contains "a" and name contains "b"` |
| `give back total and count` | two values, or "both are true"? | `give back total, count` |
| `set a b to 1` when there's a name `a` | the name `a` then "b", or "a" as in "set a counter to 1"? | `set a_b to 1`, or a name that doesn't start with "a" |
| `count i from n to 1` | up or down? only numbers written here say | `count down from n to 1` |
| `length of rope`, when both `length of rope` and `rope` are names | the name, or the phrase? | rename one (`rope length`) |
| `set budget to 1,000` | one number, or two (Python's 1 and 0)? | `1000` |
| `for each x in numbers from 1 to 2` | going through a list, or counting? | one or the other |

And some that read one way only are written that way: `answer is "yes" or "y"` says the name again
(`answer == "yes" or answer == "y"`, where Python's own `answer == "yes" or "y"` would always be true);
`n plus 1 is even` is about the sum; `add "milk" and "eggs" to basket` adds both.

```intuicode python
ask "Go on? " and store in answer
if answer is "yes" or "y"
    show "going"
set n to 3
set parity to n plus 1 is even
create list basket
add "milk" and "eggs" to basket
set average to (n times 2 divided by 4) rounded
```

```python
answer = input("Go on? ")
if answer == "yes" or answer == "y":
    print("going")
n = 3
parity = (n + 1) % 2 == 0
basket = []
basket.append("milk")
basket.append("eggs")
average = round((n * 2 / 4))
```

## What IntuaCode has no words for

The writers don't guess what an unknown sentence means. For each line, one of these happens:

1. **A rule fits.** The line becomes code. Inside its values, anything that isn't a sentence word passes
   through as code: `len(x)`, `x[0]`, `a % b`, `obj.method()` and Python calls all work as written. The
   names in it are still checked.
2. **No rule fits.** The line is an error and the code gets a `???` placeholder until the line is fixed
   or written as exact code.
3. **The line is exact code** (`python:`, `js:`, `css:`, `html:`, `c++:` …). It is copied unchecked.

Where the language needs something the sentence doesn't say, context fills it in: the kind of value
(Python, C++), which element a name means, `let` or `const`, `async`, a type, an import, a `global`, an
`#include`. [Context](#context-what-the-writers-remember) lists each decision.

Reading code works the other way round: a statement is said in words only when the sentence rebuilds
exactly the same code; anything else stays exact code. The Python reader also keeps as code any statement
that uses a name which is also a sentence word (`times`, `item`, `no`, `the` …) or a phrase the writer
would rewrite.

## Guarantees and limits

| | Reading: code → sentences | Writing: sentences → code |
|---|---|---|
| Same input, same output | yes | yes |
| Checked | yes: the sentences are translated back and the syntax trees compared with the original | no: the code isn't compared with anything, parsed, or run |
| When it can't | keeps the part as exact code and checks again; reports what still differs | an error on the line |

**Reading, Python** (`lang/python_reader.py`, used by `checkedSentences` in `app.js`): the original and
the code made from the sentences are parsed with Python's `ast` and their dumps compared. Comments don't
count; docstrings do. Each top-level statement that differs is kept as `python:` lines and the check runs
again, up to 4 rounds.

- The fallback works on whole top-level statements: one line inside a tool that can't be said keeps the
  whole tool as code.
- When the trees differ but no statement is missing (statements in another order), nothing is kept and
  the result is reported as not exact.
- When the Python made from the sentences doesn't parse, the check stops there: nothing is kept as code,
  and the result is reported as not exact.

**Reading, other languages** (`lang/convert.js`): the code is read with tree-sitter, said in sentences,
translated back with the writers, and the trees compared. Each statement, element or rule that differs,
and each sentence the writer reports an error on, is kept as exact code, up to 40 rounds. A few
differences are counted as the same because they can't change what the code does (attribute order, spaces
a browser ignores, braces round one-line bodies, `std::` under `using namespace std` …); `ROADMAP.md`,
step 6, lists them.

**So** sentences that came from code are exact, or reported as not exact: a mistake in a writer shows up
as a difference, and the part stays as code. A sentence written or edited by hand is the writing
direction, with the limits below.

**Writing** (`lang/python.js`, `lang/web_write.js`, `lang/cpp_write.js`):

- Rules are regular expressions tried in order; the first that fits wins. There is no grammar check
  beyond that, so phrases can collide (see `ROADMAP.md`, Known risks).
- Values are rewritten word by word, not parsed: a phrase can produce code that doesn't parse, and some of
  those come with only a warning, or none. The Python writer refuses the shapes known to have two readings
  ([Two readings](#two-readings-refused-never-guessed-python)); JavaScript and C++ have fewer such checks.
- Context is what the writer has seen: in Python, what each name holds in each place, what tools give back,
  the shape of a `python:` line's value; Structure's names; the sentence's own words. It doesn't know what a
  value is at run time, so where that decides the code and can't be seen, Python says so with a warning.
- Not every sentence exists in every writer. JavaScript has no `count`, `repeat forever`, `repeat until`,
  `when` as `if`, `wait … seconds`, `is even`, `is larger than`, `is above`, number words or names with
  spaces. C++ has no `description:`, names with spaces, `count down`, `in steps of`, `contains`, `is in`
  or `nothing`. These are errors or warnings, not silent.

## Known wrong translations

These translate with no error today but give the wrong code, or code that doesn't run. Each table's
examples are pinned by the example after it, which shows the writer's output as it is now: when one is
fixed, its test fails, and this section is updated. The last table is the reading direction.

### Python writer

Most of what was listed here was fixed on 2026-11-04 (see [Two readings](#two-readings-refused-never-guessed-python)
and [Python context](#python-context)). Still wrong:

| You write | You get | Why | Write instead |
|---|---|---|---|
| `same = a is b`, written as Python | `same = a == b` | in a line read as sentences, `is` compares values; Python's `is` checks for the very same object | `python: same = a is b` |

```intuicode python
python: a = [1]
python: b = [1]
same = a is b
```

```python
a = [1]
b = [1]
same = a == b
```

### JavaScript writer

| You write | You get | Why | Write instead |
|---|---|---|---|
Fixed on 2026-11-04: `add` on a number (`+=`), items and inputs split at "and", `not n is 5`
(`!(n === 5)`), `1 is less than x is less than 10` (two tests), `is an empty list` (`.length === 0`),
`answer is "yes" or "y"`, `last item of` a tool's result (runs it once), a name used after the block it was
made in (a warning), `if … then …` on one line (an error), tabs. Still wrong:

| You write | You get | Why | Write instead |
|---|---|---|---|
| `fetch from "/api/items" and store in items` at the left edge | `await` outside a function: the page's `script.js` (a classic script) doesn't run | only blocks are made `async`; a module script would allow it, and code read from one keeps it | put it under `when the page has loaded` |

```intuicode js
set n to 0
add 1 to n
create list xs with 1, 2 and 3
set flag to not n is 5
fetch from "/api/items" and store in items
```

```js
let n = 0;
n += 1;
let xs = [1, 2, 3];
let flag = !(n === 5);
const items = await (await fetch("/api/items")).json();
```

### HTML and CSS writer

Fixed on 2026-11-04: a name you gave an element now wins over a selector word (`style header:` with an
element called header is `#header`; `style every header:` is the tag), `border red` is a 1px red border, and
a text box is written with no `type` (text is the browser's default), so reading a page back no longer
counts `<input>` and `<input type="text">` as the same. Fixed on 2026-11-09: a `note:` at the left edge after a
container goes after the container (it used to go inside it), and `border` and `outline` take a line style
(`border 2 dashed navy`; it used to give `2px solid dashed navy`).

```intuicode html
add a section called header
    add a heading "Hello"
note: this note sits at the left edge
add a block called links
```

```html
<section id="header">
  <h2>Hello</h2>
</section>
<!-- this note sits at the left edge -->
<div id="links"></div>
```

```intuicode css
style header: background navy
style links: text colour red
style buttons: border red
style every header: border 2 blue
```

```css
#header {
  background: navy;
}

#links {
  color: red;
}

button {
  border: 1px solid red;
}

header {
  border: 2px solid blue;
}
```

### C++ and Arduino writer

Fixed on 2026-11-04: text joined with `plus` (it was pointer arithmetic: `"Score: " + n` printed part of the text), `not n is 5`, a comparison shown, `count down` with no name and `in steps of`, a name given a decimal later (now a `double` from the start), `if n = 5`, text asked for after a number, two comparisons in a row, `is "yes" or "y"`, and `size()` minus 1 on an empty list. Still to watch:

| You write | You get | Why | Write instead |
|---|---|---|---|
| `set half to 7 divided by 2` | `7 / 2`, which is 3, with a warning | whole numbers divide to a whole number in C++ | `7.0 divided by 2` |
| a name first set inside a block, used after it | doesn't build (the compiler says so) | C++ scoping | set it before the block |

```intuicode cpp
set score to 3
show "Score: " plus score
set flag to not score is 5
show score is 3
count down from 3 to 1
    show n
set d to 1
set d to 2.5
if score = 5
    show "five"
ask for a number "Age? " and store in age
ask "Name? " and store in name
```

```cpp
#include <iostream>
#include <string>

int main() {
    int score = 3;
    std::cout << std::string("Score: ") + std::to_string(score) << std::endl;
    bool flag = !(score == 5);
    std::cout << (score == 3) << std::endl;
    for (int n = 3; n >= 1; n--) {
        std::cout << n << std::endl;
    }
    double d = 1;
    d = 2.5;
    if (score == 5) {
        std::cout << "five" << std::endl;
    }
    int age; std::cout << "Age? ";
    std::cin >> age;
    std::string name; std::cout << "Name? ";
    std::getline(std::cin >> std::ws, name);
    return 0;
}
```

### Python reader

Nothing known today. (`x = n ** 3` used to give sentences the writer couldn't read; `to the power of` works now.)

## About the examples

`tests/language-doc.test.mjs` (part of `npm test`) translates every example in this file:

- An example is a fenced block tagged ` ```intuicode python `, `js`, `html`, `css`, `cpp` or `arduino`,
  followed by the next fenced block, which holds the expected code.
- It must translate with no errors to exactly that code. Warnings are allowed.
- **Python** is one Main program folder: the whole `main.py`, imports included.
- **HTML**: the expected block is what goes inside `<body>`, without the `script.js` line and with the
  body's own indent removed, unless it starts with `<!DOCTYPE` or `<html`: then it is the whole page.
- **CSS and JavaScript** use the page of the nearest `intuicode html` example above them in the same
  `##` section (an empty page if there is none) and are the whole `style.css` or `script.js`.
- **C++ and Arduino** are the whole file.

The same test checks that the index below is up to date.

## Index

<!-- index:start: generated by node tools/intuicode_index.mjs; do not edit by hand -->

This part is generated by `node tools/intuicode_index.mjs` from the data the writers export for the phrase picker
and the app's Index (`TEMPLATES`, `WORDS`, `GUIDE`, `TAG_WORDS`, `FILLER`, `keywords`). The same data is in
`lang/intuicode_index.json`. Don't edit it by hand: change the writer, then run the script. `npm test` fails while
it is out of date. The patterns here are the usual ways to say each thing; the grammar above lists every form,
synonyms included.

### Python

Settings → `settings.py`, Tools → `tools.py`, Main program → `main.py`. Writer: `lang/python.js`.

- **Settings:** Settings holds starting values the whole program shares: limits, names, lists of options. Only set values here. Nothing is shown or asked.
- **Tools:** Tools holds reusable actions. Each tool starts with "define" and does its work in the indented lines under it. Tools only run when Main program runs them.
- **Main program:** Main program is what actually happens when you press Run, step by step from the top.

#### Python sentences

| Topic | Say | Becomes | Folders | Note |
|---|---|---|---|---|
| **Values** | `set ‹name› to ‹value›` | `name = value` | Settings, Tools, Main program | Creates a name or changes what it holds. Names can have spaces: "high score" becomes high_score. |
|  | `increase ‹name› by ‹amount›` | `name += amount` | Tools, Main program | Leave off "by …" to go up by 1. |
|  | `decrease ‹name› by ‹amount›` | `name -= amount` | Tools, Main program | Leave off "by …" to go down by 1. |
|  | `multiply ‹name› by ‹amount›` | `name *= amount` | Tools, Main program |  |
|  | `divide ‹name› by ‹amount›` | `name /= amount` | Tools, Main program | Always leaves a decimal number. |
| **Show & ask** | `show ‹value›` | `print(value)` | Tools, Main program | Show several things on one line by joining them with "and". |
|  | `show "‹text› {‹name›}"` | `print(f"text {name}")` | Tools, Main program | Anything in {curly brackets} inside text is replaced by its current value. |
|  | `ask "‹question›" and store in ‹name›` | `name = input("question")` | Main program | The answer is always text. |
|  | `ask for a number "‹question›" and store in ‹name›` | `name = int(input("question"))` | Main program | Use this when you need to compare or do maths with the answer. |
|  | `ask for a decimal "‹question›" and store in ‹name›` | `name = float(input("question"))` | Main program | For answers like 2.5. |
| **Decisions** | `if ‹condition›` | `if condition:` | Tools, Main program | Indent the lines that should only happen when the condition is true. |
|  | `otherwise if ‹condition›` | `elif condition:` | Tools, Main program | Must sit right under an if block, at the same indentation. |
|  | `otherwise` | `else:` | Tools, Main program | Runs when nothing above it was true. |
| **Loops** | `repeat ‹number› times` | `for _ in range(number):` | Tools, Main program | Add "counting with i" to know which round you are on (starts at 0). |
|  | `count ‹i› from ‹start› to ‹end›` | `for i in range(start, end + 1):` | Tools, Main program | Includes the end number. Count backwards by going from a bigger number to a smaller one. |
|  | `for each ‹item› in ‹list›` | `for item in list:` | Tools, Main program | Works on lists, text (letter by letter) and dictionaries (key by key). |
|  | `while ‹condition›` | `while condition:` | Tools, Main program | Make sure something inside the loop can make the condition false. |
|  | `repeat until ‹condition›` | `while not condition:` | Tools, Main program |  |
|  | `repeat forever` | `while True:` | Tools, Main program | Pair it with "stop the loop". |
|  | `stop the loop` | `break` | Tools, Main program |  |
|  | `skip to next` | `continue` | Tools, Main program | Skips the rest of this round. |
| **Lists** | `create list ‹name› with ‹a, b, c›` | `name = [a, b, c]` | Settings, Tools, Main program | Leave off "with …" for an empty list. |
|  | `add ‹value› to ‹list›` | `list.append(value)` | Tools, Main program | On a number, "add" increases it instead. |
|  | `remove ‹value› from ‹list›` | `list.remove(value)` | Tools, Main program | Or "remove item 0 from list" to remove by position. |
|  | `sort ‹list›` | `list.sort()` | Tools, Main program | Add "biggest first" to reverse the order. |
|  | `shuffle ‹list›` | `random.shuffle(list)` | Tools, Main program |  |
| **Tools** | `define ‹name› using ‹inputs›` | `def name(inputs):` | Tools, Main program | Leave off "using …" if the tool needs no inputs. |
|  | `give back ‹value›` | `return value` | Tools | Only inside a define block. |
|  | `description: ‹what it does›` | `"""what it does"""` | Tools, Main program | The first line under define or define class: help text Python keeps (a docstring). Several lines in a row make one text. |
|  | `run ‹tool› with ‹inputs›` | `tool(inputs)` | Tools, Main program |  |
|  | `run ‹tool› with ‹inputs› and store in ‹name›` | `name = tool(inputs)` | Tools, Main program | Keeps what the tool gives back. |
| **Dictionaries** | `create dictionary ‹name›` | `name = {}` | Settings, Tools, Main program | Stores values under keys, like prices of items. |
|  | `set item ‹key› of ‹dictionary› to ‹value›` | `dictionary[key] = value` | Settings, Tools, Main program |  |
|  | `for each ‹key›, ‹value› in pairs of ‹dictionary›` | `for key, value in dictionary.items():` | Settings, Tools, Main program | Goes through every key together with its value. |
|  | `delete item ‹key› of ‹dictionary›` | `del dictionary[key]` | Settings, Tools, Main program |  |
| **Objects** | `define class ‹Name›` | `class Name:` | Tools, Main program | A blueprint for objects. Tools defined inside it take `self` first. |
|  | `define class ‹Name› based on ‹Parent›` | `class Name(Parent):` | Tools, Main program | Builds on another class and adds to it. |
|  | `set self.‹value› to ‹value›` | `self.value = value` | Tools, Main program | Inside a class: a value each object keeps for itself. |
|  | `make a new ‹Class› with ‹inputs› and store in ‹name›` | `name = Class(inputs)` | Tools, Main program | Creates an object from a class. |
|  | `run ‹object›.‹tool› with ‹inputs›` | `object.tool(inputs)` | Tools, Main program | Runs a tool that belongs to an object or module, e.g. run conn.commit. |
|  | `field ‹name›: ‹type›` | `name: type` | Tools, Main program | Inside a data class: a value every object has. The type can be whole number, decimal, text, yes/no or a Python type. |
| **Errors** | `try` | `try:` | Tools, Main program | Indent the lines that might fail under it. |
|  | `if it fails with ‹ErrorType› as ‹error›` | `except ErrorType as error:` | Tools, Main program | What to do when the lines under "try" fail. |
|  | `in any case` | `finally:` | Tools, Main program | Always runs afterwards, error or not. |
|  | `fail with ‹ErrorType›: ‹message›` | `raise ErrorType(message)` | Tools, Main program | Stops with an error that the caller can catch. |
|  | `check that ‹condition›` | `assert condition` | Tools, Main program | Stops with an error if the check is false. Used in tests. |
| **Files** | `open the file ‹path› as ‹f›` | `with open(path) as f:` | Tools, Main program | Reads the file. The file closes itself after the indented lines. |
|  | `open the file ‹path› for writing as ‹f›` | `with open(path, "w") as f:` | Tools, Main program | Replaces what was in the file. Use "for adding" to add to the end. |
|  | `using ‹something› as ‹name›` | `with something as name:` | Tools, Main program | Sets something up and tidies it away afterwards. |
| **Program** | `if this file is run directly` | `if __name__ == "__main__":` | Main program | The starting point of a program made of several files. |
|  | `when ‹app› gets ‹GET› at "‹/path›"` | `@app.route("/path", methods=["GET"])` | Tools, Main program | A Flask web route. Put "define …" on the next line. |
|  | `when ‹app› handles ‹GET› at "‹/path›"` | `@app.get("/path")` | Tools, Main program | A FastAPI (or Flask 2) web route. Put "define …" on the next line. |
|  | `decorate with ‹decorator›` | `@decorator` | Tools, Main program | Adds behaviour to the next tool or class. |
|  | `use the shared ‹name›` | `global name` | Tools | Inside a tool: change a value that lives outside it. |
| **Other** | `wait ‹number› seconds` | `time.sleep(number)` | Tools, Main program |  |
|  | `do nothing` | `pass` | Tools, Main program | A placeholder for a block you will fill in later. |
|  | `stop the program` | `sys.exit()` | Tools, Main program |  |
|  | `note: ‹text›` | `# text` | Settings, Tools, Main program | A note for people. Python ignores it. |
|  | `python: ‹code›` | `code` | Settings, Tools, Main program | Write Python directly. Copied exactly as written. |

#### Python words inside sentences

| Say | Becomes |
|---|---|
| `a is b` | `a == b` |
| `a is not b` | `a != b` |
| `a is more than b` | `a > b` |
| `a is less than b` | `a < b` |
| `a is at least b` | `a >= b` |
| `a is at most b` | `a <= b` |
| `a plus b` | `a + b` |
| `a minus b` | `a - b` |
| `a times b` | `a * b` |
| `a divided by b` | `a / b` |
| `a mod b` | `a % b` |
| `a to the power of b` | `a ** b` |
| `a squared` | `a ** 2` |
| `a is even` | `a % 2 == 0` |
| `a is divisible by b` | `a % b == 0` |
| `length of x` | `len(x)` |
| `sum of x` | `sum(x)` |
| `biggest in x` | `max(x)` |
| `smallest in x` | `min(x)` |
| `random number from 1 to 6` | `random.randint(1, 6)` |
| `random item from x` | `random.choice(x)` |
| `item 0 of x` | `x[0]` |
| `first item of x` | `x[0]` |
| `last item of x` | `x[-1]` |
| `x is in y` | `x in y` |
| `y contains x` | `x in y` |
| `x as number` | `int(x)` |
| `x as decimal` | `float(x)` |
| `x as text` | `str(x)` |
| `x rounded` | `round(x)` |
| `x rounded to 2 places` | `round(x, 2)` |
| `x in capitals` | `x.upper()` |
| `square root of x` | `math.sqrt(x)` |
| `yes / no` | `True / False` |
| `nothing` | `None` |
| `"Hi {name}"` | `f"Hi {name}"` |
| `x is nothing` | `x is None` |
| `a if check otherwise b` | `a if check else b` |
| `pairs of d` | `d.items()` |
| `wait for fetch(url)` | `await fetch(url)` |

#### Python examples (the Index's how-tos)

**Get a number from someone**

```
ask for a number "How old are you? " and store in age
```

**Do something several times**

```
repeat 3 times
    show "Hip hip hooray!"
```

**Keep going until something happens**

```
repeat forever
    ask "Password? " and store in guess
    if guess is "open sesame"
        stop the loop
```

**Make a reusable tool**

```
define double using n
    give back n times 2
```

**Write it naturally**

```
please ask for a number "Age? " and store in age then show age
if age is at least 18 then show "Welcome"
note: "please", "just" and "then" are fine. Filler is left out, and "then" splits steps.
```

**Use a tool and keep its answer**

```
run double with 21 and store in answer
```

**Keep a list of things**

```
create list basket with "apples", "bread"
add "milk" to basket
for each item in basket
    show "-" and item
```

#### Python filler words

- Left out at the start of a line: `please`, `kindly`, `ok`, `okay`, `so`, `and`, `now`, `next`, `then`, `and then`, `also`, `just`, `simply`, `finally`, `first`, `firstly`, `after that`, `afterwards`, `i want to`, `i'd like to`, `i would like to`, `i need to`, `we need to`, `we want to`, `let's`, `let us`, `can you`, `could you`, `you should`, `go ahead and`, `make sure to`, `make sure you`, `remember to`, `be sure to`.
- Left out anywhere outside quotes: `please`, `kindly`, `just`, `simply`, `basically`, `really`, `actually`, `quickly`.

Python's own words, which can't be names: `False`, `None`, `True`, `and`, `as`, `assert`, `async`, `await`, `break`, `class`, `continue`, `def`, `del`, `elif`, `else`, `except`, `finally`, `for`, `from`, `global`, `if`, `import`, `in`, `is`, `lambda`, `nonlocal`, `not`, `or`, `pass`, `raise`, `return`, `try`, `while`, `with`, `yield`.

### HTML

Structure → `index.html`. Writer: `lang/web_write.js`.

- **Structure:** Structure is what is on the page, top to bottom. Indent a line to put it inside the section, list or form above it.

#### HTML sentences

| Topic | Say | Becomes | Note |
|---|---|---|---|
| **Page** | `page title is "‹title›"` | `<title>…</title>` | Shown in the browser tab. |
| **Text** | `add a big heading "‹text›"` | `<h1>…</h1>` | One per page: the main title. |
|  | `add a heading "‹text›"` | `<h2>…</h2>` |  |
|  | `add a paragraph "‹text›"` | `<p>…</p>` |  |
| **Controls** | `add a button called ‹name› saying "‹text›"` | `<button id="name">…</button>` | The name is how Styling and Mechanics refer to it. |
|  | `add a text box called ‹name› with hint "‹hint›"` | `<input id="name" placeholder="…">` | Also: number box, password box, email box, big text box. |
|  | `add a drop-down called ‹name› with "‹a›", "‹b›"` | `<select><option>…` |  |
|  | `add a number box called ‹name› allowing decimals, from ‹0› to ‹100›` | `<input type="number" step="any" min="0" max="100">` | Also: in steps of 5, at least 1, at most 10, with a number keypad. A time box picks a time. |
|  | `add a checkbox called ‹name› saying "‹text›"` | `<input type="checkbox">` | Mechanics: "if ‹name› is ticked", "tick ‹name›", "untick ‹name›". |
|  | `add a slider called ‹name› from ‹0› to ‹100›` | `<input type="range">` | Its value is where it is set, as text. |
|  | `add a file picker called ‹name› for ‹pictures›` | `<input type="file" accept="image/*">` | Or for sounds, videos, text files, or "‹.csv›". "for several pictures" lets people pick more than one. Mechanics: "the file in ‹name›". |
| **Media** | `add a picture of "‹file.jpg›" described as "‹what it shows›"` | `<img src="…" alt="…">` | The description is read aloud by screen readers. |
|  | `add a drawing area called ‹game› ‹480› by ‹270›` | `<canvas id="game" width="480" height="270">` | Where a game or a picture is drawn, from Mechanics. |
|  | `add a link to "‹https://…›" saying "‹text›"` | `<a href="…">…</a>` |  |
| **Layout** | `add a section called ‹name›` | `<section id="name">` | Indent the things that belong inside it. Also: header, footer, navigation bar, main area, block, card, form, side panel. |
|  | `add a list called ‹name›` | `<ul id="name">` | Indent "add a list item "…"" under it. |
|  | `… in group ‹name›` | `class="name"` | Add to the end of any line to put it in a group (a CSS class). |

#### HTML words inside sentences

| Say | Becomes |
|---|---|
| `called save` | `id="save"` |
| `in group card` | `class="card"` |
| `big heading` | `<h1>` |
| `heading` | `<h2>` |
| `block` | `<div>` |
| `navigation bar` | `<nav>` |
| `main area` | `<main>` |
| `side panel` | `<aside>` |
| `picture` | `<img>` |
| `text box` | `<input>` |
| `big text box` | `<textarea>` |

### CSS

Styling → `style.css`. Writer: `lang/web_write.js`.

- **Styling:** Styling is how things look. Style an element by its name, a group, or every element of a kind.

#### CSS sentences

| Topic | Say | Becomes | Note |
|---|---|---|---|
| **Styles** | `style ‹name›: background ‹colour›, text colour ‹colour›` | `#name { background: …; color: … }` | Separate styles with commas. |
|  | `create group ‹name›: rounded corners ‹8›, shadow` | `.name { border-radius: 8px; box-shadow: … }` | A group is a CSS class. Reuse it on many elements. |
|  | `‹element› belongs to group ‹group›` | `class="group" in the HTML` | Adds the group to an element in Structure. |
|  | `when ‹name› is hovered: ‹styles›` | `#name:hover { … }` |  |
|  | `on screens narrower than ‹600›:` | `@media (max-width: 600px) {` | Indent styles under it for phones. |
|  | `shared colour ‹main› is ‹#4f7cff›` | `:root { --main: … }` | Then use "background the colour main". |
|  | `before ‹name›: content: "‹text›", ‹styles›` | `#name::before { content: … }` | A piece added at the start of the element, by CSS alone. "after ‹name›:" adds one at the end. content: attr(data-‹x›) shows a value Mechanics stored on the element. |

#### CSS words inside sentences

| Say | Becomes |
|---|---|
| `background navy` | `background: navy` |
| `background #000 40% see-through` | `background: rgba(0,0,0,0.6)` |
| `50% see-through` | `opacity: 0.5` |
| `text colour white` | `color: white` |
| `text size 20` | `font-size: 20px` |
| `space inside 12` | `padding: 12px` |
| `space around 8` | `margin: 8px` |
| `rounded corners 8` | `border-radius: 8px` |
| `shadow` | `box-shadow: …` |
| `in a row` | `display: flex` |
| `in a grid of 3 columns` | `display: grid` |
| `hand cursor` | `cursor: pointer` |
| `centred` | `margin: 0 auto` |
| `hidden` | `display: none` |

#### CSS: words for what to style

| Say | Selector |
|---|---|
| `buttons` | `button` |
| `button` | `button` |
| `headings` | `h1, h2, h3` |
| `heading` | `h1, h2, h3` |
| `big headings` | `h1` |
| `links` | `a` |
| `link` | `a` |
| `paragraphs` | `p` |
| `paragraph` | `p` |
| `pictures` | `img` |
| `images` | `img` |
| `text boxes` | `input, textarea` |
| `inputs` | `input` |
| `lists` | `ul, ol` |
| `list items` | `li` |
| `sections` | `section` |
| `the page` | `body` |
| `page` | `body` |
| `everything` | `*` |
| `header` | `header` |
| `footer` | `footer` |
| `navigation bar` | `nav` |
| `forms` | `form` |
| `labels` | `label` |

### JavaScript

Mechanics → `script.js`. Writer: `lang/web_write.js`.

- **Mechanics:** Mechanics is what the page does. Most of it starts with "when … is clicked" or "when the page has loaded".

#### JavaScript sentences

| Topic | Say | Becomes | Note |
|---|---|---|---|
| **Events** | `when ‹name› is clicked` | `name.addEventListener("click", …)` | Indent what should happen. |
|  | `when ‹form› is sent` | `form.addEventListener("submit", …)` | The page won't reload. |
|  | `when the page has loaded` | `DOMContentLoaded` |  |
|  | `every ‹2› seconds` | `setInterval(…, 2000)` | The time can be a name too: "every gap seconds". |
|  | `every ‹1› second as ‹ticker›` | `ticker = setInterval(…)` | Named, so "stop ‹ticker›" can stop it (clearInterval). Also "after 3 seconds as ‹reminder›". |
| **Errors** | `try` | `try { … }` | Indent the lines that might fail; then "if it fails" at the same indent, with what to do instead. |
|  | `if it fails` | `} catch { … }` | "if it fails as problem" keeps the error: problem.message says what went wrong. "in any case" runs either way. |
|  | `wait for ‹navigator.clipboard.writeText(text)›` | `await …` | Waits for something that finishes later. Add "and store in ‹name›" to keep what it gives back. |
| **Games** | `every frame` | `requestAnimationFrame(…)` | About 60 times a second: move things, then draw them. |
|  | `keep track of the keys` | `keysDown: a Set` | Once, near the top of Mechanics. Then "if "left" is held". |
|  | `if "‹left›" is held` | `if (keysDown.has("ArrowLeft"))` | left, right, up, down, space, or a letter. |
|  | `when the key "‹space›" is pressed` | `keydown, for one key` | Once per press. For holding a key down, use "is held" inside "every frame". |
|  | `when the screen is tapped` | `pointerdown` | A finger or a mouse. "tap x" and "tap y" say where. |
|  | `when ‹game› is released` | `pointerup` | A finger lifting or a mouse button let go over it. Also "when the screen is released", anywhere. |
|  | `when the pointer moves over ‹game›` | `pointermove` | Again and again as it moves; "tap x" and "tap y" say where it is now. |
| **Drawing** | `clear ‹game›` | `clearRect(…)` | Wipes a drawing area, ready for the next frame. |
|  | `fill ‹game› with "‹skyblue›"` | `fillRect(0, 0, …)` |  |
|  | `draw a rectangle at ‹x›, ‹y› sized ‹40› by ‹20› in "‹tomato›" on ‹game›` | `fillRect(x, y, 40, 20)` | x across from the left, y down from the top. |
|  | `draw a circle at ‹x›, ‹y› with radius ‹10› in "‹gold›" on ‹game›` | `arc(…) + fill()` |  |
|  | `draw text "‹Score: {score}›" at ‹10›, ‹24› in "‹white›" on ‹game›` | `fillText(…)` | Add "size 24" before "in" for bigger text. |
|  | `draw a line from ‹x1›, ‹y1› to ‹x2›, ‹y2› in "‹white›" on ‹game›` | `lineTo(…) + stroke()` |  |
|  | `load the picture "‹images/ship.png›" as ‹ship›` | `new Image()` | Once, near the top. Add the file first: File → Add an image. |
|  | `draw ‹ship› at ‹x›, ‹y› on ‹game›` | `drawImage(…)` | A loaded picture. Add "sized 64 by 64" before "on" to scale it. |
| **Sound** | `play a note of ‹440› for ‹0.2› seconds` | `an oscillator (Web Audio)` | 440 hertz is the note A; 880 is the A above. |
| **Page** | `get the text of ‹name› and store in ‹value›` | `let value = name.value` | Reads what was typed in a box. |
|  | `set the text of ‹name› to ‹value›` | `name.textContent = value` |  |
|  | `add ‹value› to the list ‹name›` | `createElement("li") …` | Adds a new item to a list on the page. |
|  | `hide ‹name›` | `name.hidden = true` | And "reveal ‹name›". |
|  | `put ‹name› in group ‹group›` | `classList.add("group")` | Also "take … out of group", "switch group … on …", and "if ‹name› is in group ‹group›". |
|  | `make a new ‹button› saying "‹text›" in ‹name› and store in ‹b›` | `document.createElement(…)` | Also a list item, block, paragraph, text, link to ‹address›, picture of ‹file›. Add "in group ‹g›"; then "when ‹b› is clicked", "hide ‹b›" and the like work on it. |
| **Server** | `fetch from "‹/api/items›" and store in ‹items›` | `await fetch(…).json()` |  |
|  | `send ‹value› to "‹/api/items›"` | `fetch(…, { method: "POST" … })` |  |
|  | `save ‹value› in the browser as "‹key›"` | `localStorage.setItem` | And "load "key" from the browser and store in …". |
| **Logic** | `set ‹name› to ‹value›` | `let name = value` | Same sentences as Python: if, otherwise, repeat, for each, define, give back, run… |
|  | `if ‹condition›` | `if (condition) {` |  |
|  | `for each ‹item› in ‹list›` | `for (const item of list) {` |  |
|  | `set item ‹i› of ‹list› to ‹value›` | `list[i] = value` | Also for records: "set item "‹key›" of ‹record› to …", or "set ‹field› of ‹record› to …" (record.field). |
|  | `define ‹name› using ‹inputs›` | `function name(inputs) {` | Its first lines can be "description: …", what the tool is for. |
|  | `multiply ‹name› by ‹amount›` | `name *= amount;` | Also "divide ‹name› by ‹amount›" (/=). |

#### JavaScript words inside sentences

| Say | Becomes |
|---|---|
| `a is b` | `a === b` |
| `a is not b` | `a !== b` |
| `a and b` | `a && b` |
| `not a` | `!a` |
| `length of x` | `x.length` |
| `item 0 of x` | `x[0]` |
| `random number from 1 to 6` | `Math.floor(Math.random()*6)+1` |
| `text of name` | `name.value / .textContent` |
| `"Hi {name}"` | `` `Hi ${name}` `` |
| `box is ticked` | `box.checked` |
| `card is in group done` | `card.classList.contains("done")` |
| `the file in picker` | `picker.files[0]` |
| `wait for x` | `await x` |

### C++

Program → `main.cpp`. Writer: `lang/cpp_write.js`.

- **Program:** The program runs from the top of main. Tools and classes you define are placed above it automatically.

#### C++ sentences

| Topic | Say | Becomes | Note |
|---|---|---|---|
| **Values** | `set ‹name› to ‹value›` | `int name = value;` | The kind (int, double, std::string, bool) is worked out from the value. |
|  | `constant ‹NAME› is ‹value›` | `const int NAME = value;` | A value that never changes. Say the kind too if you like: "constant decimal PI is 3.14". |
|  | `set ‹decimal› ‹name› to ‹value›` | `double name = value;` | Name the kind yourself: whole number, decimal, text, yes/no. |
|  | `increase ‹name› by ‹amount›` | `name += amount;` |  |
|  | `multiply ‹name› by ‹amount›` | `name *= amount;` | Also "divide ‹name› by ‹amount›" (/=). |
| **Show & ask** | `show ‹value›` | `std::cout << value << std::endl;` | Join several things with "and" (a space between) or "followed by" (no space). |
|  | `ask for a number "‹question›" and store in ‹name›` | `std::cin >> name;` | Or "ask … and store in …" for text. |
| **Decisions** | `if ‹condition›` | `if (condition) {` |  |
|  | `otherwise` | `} else {` |  |
| **Loops** | `repeat ‹number› times` | `for (int i = 0; i < number; i++) {` |  |
|  | `count ‹i› from ‹1› to ‹10›` | `for (int i = 1; i <= 10; i++) {` |  |
|  | `for each ‹item› in ‹list›` | `for (const auto& item : list) {` |  |
|  | `while ‹condition›` | `while (condition) {` |  |
|  | `repeat forever` | `while (true) {` | Pair with "stop the loop". |
| **Lists** | `create list of ‹numbers› called ‹name› with ‹1, 2, 3›` | `std::vector<int> name = {1, 2, 3};` | Also "list of text", "list of decimals". |
|  | `add ‹value› to ‹list›` | `list.push_back(value);` |  |
|  | `set item ‹0› of ‹list› to ‹value›` | `list[0] = value;` | Positions start at 0. Also "set the last item of ‹list› to ‹value›". |
| **Tools** | `define ‹name› using ‹inputs›` | `auto name(auto inputs) {` | Tools go above main automatically. |
|  | `define ‹name› using ‹decimal w›, ‹decimal h› giving back ‹decimal›` | `double name(double w, double h) {` | Name the kinds: whole number, decimal, text, yes/no, nothing. |
|  | `give back ‹value›` | `return value;` |  |
|  | `run ‹tool› with ‹inputs› and store in ‹name›` | `auto name = tool(inputs);` |  |
| **Classes** | `define class ‹Name›` | `class Name { public: … };` | A blueprint for objects. Indent its fields and tools under it. |
|  | `field ‹name›: ‹text›` | `std::string name;` | Inside a class. Also "has whole number count starting at 0". |
|  | `when made using ‹text name›` | `Name(std::string name) {` | Inside a class: runs when a new object is made. Use "set self.name to name". |
|  | `make a new ‹Class› with ‹inputs› and store in ‹name›` | `Class name(inputs);` | Creates an object from a class. |
| **Program** | `include ‹cmath›` | `#include <cmath>` | Brings in a library. |
|  | `above main: ‹C++ code›` | `code (outside main)` | C++ copied exactly, outside main. |
| **Other** | `c++: ‹code›` | `code` | Write C++ directly. |

#### C++ words inside sentences

| Say | Becomes |
|---|---|
| `a is b` | `a == b` |
| `a is not b` | `a != b` |
| `a and b` | `a && b` |
| `not a` | `!a` |
| `a is even` | `a % 2 == 0` |
| `a is odd` | `a % 2 != 0` |
| `length of x` | `x.size()` |
| `item 0 of x` | `x[0]` |
| `random number from 1 to 6` | `random_number(1, 6)` |
| `x as number` | `std::stoi(x)` |
| `x as text` | `std::to_string(x)` |
| `"Hi {name}"` | `text("Hi ", name)` |
| `self.name` | `this->name` |
| `a followed by b` | `a << b` |

### Arduino

Sketch → `‹folder›.ino`. Writer: `lang/cpp_write.js`.

- **Sketch:** Lines at the left edge are the sketch's settings (pins, starting values). "when the board starts" runs once; "over and over" runs forever.

#### Arduino sentences

| Topic | Say | Becomes | Note |
|---|---|---|---|
| **Values** | `set ‹name› to ‹value›` | `int name = value;` | The kind (int, double, std::string, bool) is worked out from the value. |
|  | `constant ‹NAME› is ‹value›` | `const int NAME = value;` | A value that never changes. Say the kind too if you like: "constant decimal PI is 3.14". |
|  | `set ‹decimal› ‹name› to ‹value›` | `double name = value;` | Name the kind yourself: whole number, decimal, text, yes/no. |
|  | `increase ‹name› by ‹amount›` | `name += amount;` |  |
|  | `multiply ‹name› by ‹amount›` | `name *= amount;` | Also "divide ‹name› by ‹amount›" (/=). |
| **Decisions** | `if ‹condition›` | `if (condition) {` |  |
|  | `otherwise` | `} else {` |  |
| **Loops** | `repeat ‹number› times` | `for (int i = 0; i < number; i++) {` |  |
|  | `count ‹i› from ‹1› to ‹10›` | `for (int i = 1; i <= 10; i++) {` |  |
|  | `for each ‹item› in ‹list›` | `for (const auto& item : list) {` |  |
|  | `while ‹condition›` | `while (condition) {` |  |
| **Lists** | `create list of ‹numbers› called ‹name› with ‹1, 2, 3›` | `std::vector<int> name = {1, 2, 3};` | Also "list of text", "list of decimals". |
|  | `set item ‹0› of ‹list› to ‹value›` | `list[0] = value;` | Positions start at 0. Also "set the last item of ‹list› to ‹value›". |
| **Tools** | `define ‹name› using ‹inputs›` | `auto name(auto inputs) {` | Tools go above main automatically. |
|  | `define ‹name› using ‹decimal w›, ‹decimal h› giving back ‹decimal›` | `double name(double w, double h) {` | Name the kinds: whole number, decimal, text, yes/no, nothing. |
|  | `give back ‹value›` | `return value;` |  |
|  | `run ‹tool› with ‹inputs› and store in ‹name›` | `auto name = tool(inputs);` |  |
| **Classes** | `define class ‹Name›` | `class Name { public: … };` | A blueprint for objects. Indent its fields and tools under it. |
|  | `field ‹name›: ‹text›` | `std::string name;` | Inside a class. Also "has whole number count starting at 0". |
|  | `when made using ‹text name›` | `Name(std::string name) {` | Inside a class: runs when a new object is made. Use "set self.name to name". |
|  | `make a new ‹Class› with ‹inputs› and store in ‹name›` | `Class name(inputs);` | Creates an object from a class. |
| **Program** | `include ‹cmath›` | `#include <cmath>` | Brings in a library. |
| **Other** | `c++: ‹code›` | `code` | Write C++ directly. |
| **Board** | `when the board starts` | `void setup() {` | Runs once, when the board powers on. |
|  | `over and over` | `void loop() {` | Runs again and again, forever. |
| **Pins** | `make pin ‹13› an output` | `pinMode(13, OUTPUT);` | Also "an input", "an input with pull-up". |
|  | `turn pin ‹13› on` | `digitalWrite(13, HIGH);` | And "turn pin 13 off". "the built-in light" is LED_BUILTIN. |
|  | `set the brightness of pin ‹9› to ‹128›` | `analogWrite(9, 128);` | 0 to 255, on pins marked ~. |
|  | `read pin ‹2› and store in ‹pressed›` | `int pressed = digitalRead(2);` | Or "read analog pin A0 …" for 0 to 1023. |
| **Time** | `wait ‹500› milliseconds` | `delay(500);` | Or "wait 2 seconds". |
|  | `wait ‹10› microseconds` | `delayMicroseconds(10);` | Millionths of a second, for timing a sensor's pulse. |
| **Serial** | `start the serial monitor at ‹9600›` | `Serial.begin(9600);` | Put it in "when the board starts". |
|  | `show ‹value›` | `Serial.println(value);` | Shows in the serial monitor. |
| **Sound** | `play a tone of ‹440› on pin ‹8› for ‹200› milliseconds` | `tone(8, 440, 200);` |  |

#### Arduino words inside sentences

| Say | Becomes |
|---|---|
| `pin 2 is on` | `digitalRead(2) == HIGH` |
| `reading of pin A0` | `analogRead(A0)` |
| `time since start` | `millis()` |
| `the built-in light` | `LED_BUILTIN` |
| `random number from 1 to 6` | `random(1, 7)` |
| `x as number` | `x.toInt()` |
| `x as text` | `String(x)` |
| `"Hi {name}"` | `String("Hi ") + name` |

<!-- index:end -->

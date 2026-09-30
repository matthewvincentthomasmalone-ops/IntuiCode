/* IntuiCode tutor: style cards, and how answers are checked.
 *
 * A style card explains one of a language's habits the way people who write it think: not just what a
 * line does, but why it is said that way. lang/python_reader.py (style_points) finds exactly where a file
 * uses each habit, with Python's own parser, so every card points at real lines.
 *
 * "Your turn" exercises: the person writes the real code for one of their sentences, and it is checked
 * with the reader's exact comparison (the same check that proves round trips), so the answer is right or
 * wrong, never a guess. probe() makes a single line something Python can read on its own.
 */
(function () {
  'use strict';

  const python = {
    imports: {
      title: 'Imports come first',
      say: 'A Python file starts by borrowing the tools it needs: the `import` lines go at the very top.',
      more: 'By habit they come in three groups, each separated by a blank line: Python\'s own tools (`os`, `sys`, `random`), then outside packages you installed (`requests`), then your own files. Anyone opening the file can see at a glance what it depends on.',
    },
    'from-import': {
      title: 'Borrow one tool, or the whole toolbox',
      say: '`from random import randint` borrows just one tool; `import random` brings the whole toolbox, used as `random.randint`.',
      more: 'Borrowing one tool keeps lines short: `randint(1, 6)`. Keeping the toolbox name shows where each tool came from: `random.randint(1, 6)`. Both are good Python, so choose whichever makes the line easier to read.',
    },
    'import-as': {
      title: 'A nickname for a toolbox',
      say: '`import numpy as np` gives a toolbox a short nickname.',
      more: 'Some nicknames are part of Python\'s culture: `np` for numpy, `pd` for pandas, `plt` for matplotlib\'s pyplot. Use the usual one, so everyone recognises it.',
    },
    constant: {
      title: 'CAPITALS mean "don\'t change me"',
      say: 'A name in capitals, like `MAX_GUESSES`, is a setting the rest of the program only reads.',
      more: 'Python won\'t stop you changing it: it\'s a promise between people, not a lock. Settings like these sit near the top of a file, after the imports, so they are easy to find and change in one place.',
    },
    'snake-case': {
      title: 'names_with_underscores',
      say: 'Python names are lower case, with underscores between the words: `guesses_left`, `fetch_system_status`.',
      more: 'The style is called snake_case. Classes are the exception: they use CapitalWords (`DataProcessor`). Following the habit makes your code look like everyone else\'s Python, so it reads without friction.',
    },
    def: {
      title: 'A function is a named tool',
      say: '`def` makes a tool: a name, the inputs it needs in brackets, then its steps, indented.',
      more: 'Name tools with verbs, after what they do: `fetch_status`, `add_task`, `ask_for_age`. A good tool does one job. If its name needs an "and", it probably wants to be two tools.',
    },
    return: {
      title: 'return hands something back',
      say: '`return` ends the tool and hands a value back to whoever used it.',
      more: 'A tool that returns a value can be used inside other lines: `total = add(2, 3)`. Printing inside a tool only shows a value; returning it lets the rest of the program use it.',
    },
    'default-args': {
      title: 'Inputs with a usual value',
      say: 'In `def greet(name="friend")`, if nobody gives a name, "friend" is used.',
      more: 'Inputs with a usual value go after the ones without. Never use a list or dictionary as the usual value (`items=[]`): it is made only once and shared by every use. Write `items=None` and make the list inside the tool.',
    },
    docstring: {
      title: 'Code that introduces itself',
      say: 'Text right under a `def`, a `class` or at the top of a file says what it is for.',
      more: 'It\'s called a docstring, and Python keeps it: `help(fetch_system_status)` shows it, and editors show it when you point at the name. Say what the thing does and why, in a sentence, rather than how.',
    },
    class: {
      title: 'A class is a noun',
      say: 'A class describes a kind of thing: the data it holds, and the tools that act on that data.',
      more: 'Name classes as nouns in CapitalWords: `Account`, `DataProcessor`. Each object made from a class carries its own data, and all of them share the class\'s tools (its methods).',
    },
    init: {
      title: '__init__ sets a new object up',
      say: '`__init__` runs when an object is made, and gives it its starting data.',
      more: 'The double underscores mark names that Python itself uses at special moments (people call them "dunder" methods). You never call `__init__` yourself: writing `Account("Sam")` calls it for you.',
    },
    self: {
      title: 'self means "this object"',
      say: 'Inside a class, `self.balance` is this particular object\'s balance.',
      more: 'Every method is given the object it was used on as its first input, named `self` by habit. That is how one class can serve many objects, each keeping its own data.',
    },
    private: {
      title: 'A leading underscore means "internal"',
      say: 'In `self._cache` or `_helper`, the underscore says "used inside; please don\'t touch it from outside".',
      more: 'Like capitals for settings, it\'s a promise, not a lock. It tells other programmers (and you, later) which parts are safe to rely on and which may change.',
    },
    'main-guard': {
      title: 'Only when this file is run',
      say: '`if __name__ == "__main__":` means "do this only when this file is the one being run".',
      more: 'When another file imports this one to borrow its tools, the steps under this line don\'t run. It\'s how a Python file can be both a toolbox and a program.',
    },
    'f-string': {
      title: 'Values dropped into text',
      say: 'In `f"Hi {name}"`, the `f` in front lets you put values straight into text, inside curly brackets.',
      more: 'Anything can go in the brackets: `f"{total:.2f}"` shows two decimal places, `f"{len(items)} items"` counts. It\'s the most readable way to build text in Python.',
    },
    'for-in': {
      title: 'Loop over things directly',
      say: '`for task in tasks:` hands you each item in turn; there is nothing to count.',
      more: 'Python programmers rarely count positions. Name the loop variable as the singular of the list (`task` in `tasks`) and the line reads almost like English.',
    },
    range: {
      title: 'range counts, and stops before the end',
      say: '`range(1, 11)` counts 1, 2, … 10: the end number itself is never reached.',
      more: 'Stopping before the end means `range(len(items))` gives exactly the positions of a list. With one number, `range(5)` counts 0 to 4. If you have a list to go through, loop over the list itself instead.',
    },
    enumerate: {
      title: 'Position and item together',
      say: '`for i, task in enumerate(tasks):` gives you the position and the item at once.',
      more: 'Reach for `enumerate` whenever you need the number as well: it\'s the Python way, rather than keeping your own counter.',
    },
    while: {
      title: 'Repeat while something is true',
      say: '`while guesses_left > 0:` repeats its steps for as long as the test stays true.',
      more: 'Something inside the loop must change the test, or it never ends. When you know how many times, or have a list to go through, `for` is usually clearer.',
    },
    if: {
      title: 'Decisions: if, elif, else',
      say: '`if` tests something; the lines indented under it run only when the test is true.',
      more: '`elif` ("else if") tests another case, and `else` catches everything left. Python counts empty things as false, so `if tasks:` means "if there are any tasks".',
    },
    indentation: {
      title: 'Indentation is the structure',
      say: 'The lines indented under a line that ends in `:` belong to it.',
      more: 'Many languages use { } brackets for this. Python uses the indentation itself, four spaces per level. That\'s what gives Python code its shape: you can see the structure at a glance.',
    },
    list: {
      title: 'Lists keep things in order',
      say: 'A list, `[...]`, holds items in order; `.append()` adds one to the end.',
      more: 'Lists grow and shrink as you go. Name them in the plural (`tasks`), so the loops that use them read well: `for task in tasks`.',
    },
    dict: {
      title: 'Dictionaries look things up by key',
      say: 'A dictionary, `{"apple": 3}`, stores values under keys, like words and their meanings.',
      more: '`prices["apple"]` finds a value; `prices.get("pear", 0)` gives 0 instead of an error when the key isn\'t there. Use one whenever you look things up by name.',
    },
    'with-open': {
      title: 'with tidies up for you',
      say: '`with open("notes.txt") as f:` opens a file and closes it again when the indented block ends.',
      more: 'Even if something goes wrong inside, the file is closed. `with` is Python\'s habit for anything that must be tidied up afterwards: files, connections, locks.',
    },
    try: {
      title: 'try, with a plan for a named problem',
      say: '`try:` runs risky steps; `except ValueError:` says what to do if that problem happens.',
      more: 'Name the problem you expect, and the code reads as a plan: try this; if it fails in this particular way, do that instead.',
    },
    'bare-except': {
      title: 'Name the problem you catch',
      say: '`except:` with no name catches every problem, even typing mistakes, and hides them.',
      more: 'The Python habit is to catch only what you expect: `except ValueError:`. If you really mean any problem, write `except Exception:` and at least show what went wrong.',
    },
    comprehension: {
      title: 'A list, built in one line',
      say: '`[p.name for p in players]` makes a new list from another one, in a single line.',
      more: 'Read it left to right: "the name, for each player in players". A test at the end keeps only some items: `[n for n in numbers if n > 0]`. When it no longer fits on a line comfortably, use an ordinary loop.',
    },
    'input-number': {
      title: 'input always gives text',
      say: 'In `int(input("Age? "))`, `input` hands back text and `int` turns it into a whole number.',
      more: 'If someone types letters, `int` fails with a ValueError. That\'s why asking for numbers is often wrapped in `try`.',
    },
    input: {
      title: 'Asking the person',
      say: '`input("Your name: ")` shows the question and waits for an answer, which always arrives as text.',
      more: 'Keep the answer in a well-named variable: `name = input("Your name: ")`.',
    },
    print: {
      title: 'print shows things',
      say: '`print(...)` shows values in the terminal, with spaces between them.',
      more: 'For text with values inside it, an f-string reads best: `print(f"Score: {score}")`.',
    },
    augmented: {
      title: 'Change a value where it is',
      say: '`score += 1` is short for `score = score + 1`.',
      more: 'There is one for each sum: `-=`, `*=`, `/=`. Python has no `++`: `+= 1` is how Python says it.',
    },
    global: {
      title: 'global reaches outside the tool',
      say: '`global count` lets a tool change a value that lives outside it.',
      more: 'Use it sparingly. Tools that take inputs and `return` results are easier to follow and to test than tools that change things far away.',
    },
    'is-none': {
      title: 'Check for "nothing" with is',
      say: '`if result is None:` checks for Python\'s one "no value".',
      more: 'By habit, `None` is compared with `is` and `is not`, never `==`.',
    },
    'in-check': {
      title: 'in asks "is it there?"',
      say: '`if "apple" in basket:` checks whether something is in a list, a piece of text or a dictionary.',
      more: 'It reads like English and works on most collections. For a dictionary, it checks the keys.',
    },
    break: {
      title: 'break leaves the loop',
      say: '`break` jumps straight out of the loop.',
      more: 'Handy when you\'ve found what you were looking for. `continue` skips ahead to the next round instead.',
    },
    decorator: {
      title: 'A decorator wraps a tool',
      say: 'A line like `@app.route("/")` above a `def` hands the tool to something that adds behaviour around it.',
      more: 'This one registers the tool as the answer to a web address. You\'ll meet `@property`, `@staticmethod` and test decorators too: each adds something to the tool below it.',
    },
    async: {
      title: 'async: waiting without freezing',
      say: '`async def` and `await` let a program wait for slow things, like the internet, while getting on with other work.',
      more: 'An async tool is used with `await`: `data = await fetch()`. It\'s how Python servers and bots look after many people at once.',
    },
    lambda: {
      title: 'A tiny tool without a name',
      say: '`lambda p: p.age` is a one-line tool, usually handed to another tool.',
      more: 'You\'ll see it in `sorted(people, key=lambda p: p.age)`. If it needs a name, or more than one line, write a `def` instead.',
    },
    'type-hints': {
      title: 'Hints about kinds of values',
      say: '`def area(width: float, height: float) -> float:` says what kinds of values go in and come out.',
      more: 'Python doesn\'t check them while running: they\'re for people, and for editors, which use them to warn about mistakes early.',
    },
    'star-args': {
      title: 'Any number of inputs',
      say: '`*args` gathers any extra inputs; `**kwargs` gathers extra named ones into a dictionary.',
      more: 'You\'ll mostly see them in tools that pass their inputs on to other tools.',
    },
  };

  /* One line of Python -> a program Python can read on its own, the same way for the expected line and the
   * answer: a block's first line gets a `pass` body, and lines that only make sense inside something get it. */
  function probe(line) {
    let t = String(line).trim();
    if (/^(elif|else)\b/.test(t)) t = 'if True:\n    pass\n' + t;
    else if (/^(except|finally)\b/.test(t)) t = 'try:\n    pass\n' + t;
    if (/:\s*(#.*)?$/.test(t)) t += '\n    pass';
    if (/^(return|yield|nonlocal)\b/.test(t)) return 'def _probe():\n    ' + t;
    if (/^(break|continue)\b/.test(t)) return 'while True:\n    ' + t;
    if (/\bawait\b/.test(t)) return 'async def _probe():\n' + t.split('\n').map(l => '    ' + l).join('\n');
    return t;
  }

  /* The one line of real code a sentence became, if it became exactly one (imports it needs don't count):
   * that is what a "Your turn" exercise asks for. */
  function exerciseLine(codeLines) {
    const lines = codeLines.map(l => l.trim()).filter(l => l && !/^(import|from\s+\S+\s+import)\b/.test(l) && !/^#/.test(l) && l !== 'pass');
    return lines.length === 1 ? lines[0] : null;
  }

  const FADE_AFTER = 3;   // right answers before a habit's notes shrink to "you know this"

  window.IntuiTutor = { CARDS: { python }, probe, exerciseLine, FADE_AFTER };
})();

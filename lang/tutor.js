/* IntuiCode tutor: style cards, and how answers are checked.
 *
 * A style card explains one of a language's habits the way people who write it think: not just what a
 * line does, but why it is said that way. Every card points at real lines: for Python,
 * lang/python_reader.py (style_points) finds them with Python's own parser; for C++ and Arduino,
 * cppStylePoints finds them in tree-sitter's reading of the code (the parser Read mode uses).
 *
 * "Your turn" exercises: the person writes the real code for one of their sentences, and it is checked
 * exactly, so the answer is right or wrong, never a guess. Python answers go through the reader's
 * comparison (the same check that proves round trips); probe() makes a single line something Python can
 * read on its own. C++ answers must read as the same tokens as the expected line (spacing is free).
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

  /* C++, and the Arduino sketches written in it */
  const cpp = {
    include: {
      title: 'Libraries come in with #include',
      say: '`#include <iostream>` brings in a library before the program uses it: angle brackets for C++\'s own, quotes for your own files (`#include "item.h"`).',
      more: 'Lines starting with # are read before the rest of the program; each one pastes in a library\'s descriptions. By habit they go at the very top: C++\'s own first, then outside libraries, then your own files.',
    },
    std: {
      title: 'std:: is the standard library\'s family name',
      say: '`std::cout`, `std::string` and `std::vector` all come from C++\'s standard library, whose names live in the `std` family (a namespace).',
      more: 'Namespaces stop names from clashing: your own `string` and the standard `std::string` can both exist. Writing `std::` every time is the usual habit; it says exactly where each tool comes from.',
    },
    'using-std': {
      title: '`using namespace std` is a shortcut with a cost',
      say: '`using namespace std;` lets you write `cout` instead of `std::cout`.',
      more: 'It\'s common in beginners\' code and fine in a small program, but in a bigger one it pulls hundreds of names into view and invites clashes. Most C++ programmers write `std::`, and never put this line in a header file.',
    },
    main: {
      title: 'Every program starts at main',
      say: '`int main()` is where the program begins; `return 0;` at the end tells the computer all went well.',
      more: 'The `int` in front says main gives back a whole number: 0 means success, anything else is an error code that scripts and other programs can check. A program has exactly one main.',
    },
    types: {
      title: 'Every value has a kind',
      say: 'In `int guesses = 0;`, `int` says what kind of value `guesses` holds: a whole number. It can\'t hold text later.',
      more: 'C++ checks kinds before the program runs, so mix-ups are caught early. The everyday kinds: `int` (whole numbers), `double` (decimals), `bool` (true or false), `char` (one letter) and `std::string` (text).',
    },
    auto: {
      title: 'auto: let the compiler work out the kind',
      say: 'In `auto ok = account.withdraw(100);`, the kind of `ok` is taken from the value on the right.',
      more: 'The kind is still fixed, just worked out for you. Use `auto` when the kind is obvious or long to write (loop variables over a list, say); write it out when naming it helps the reader.',
    },
    const: {
      title: 'const: a value that never changes',
      say: '`const int BUTTON = 2;` is a value the program only reads: changing it is an error the compiler catches.',
      more: 'Unlike a naming habit, `const` is enforced. C++ programmers use it generously: for settings, for pins, and for inputs a tool only looks at. Constants that are settings are usually written in CAPITALS.',
    },
    string: {
      title: 'Text is std::string',
      say: '`std::string owner` holds text. Join pieces with `+`, and ask its length with `.size()`.',
      more: 'Text in quotes on its own (`"Sam"`) is an older, simpler kind of text; `std::string` is the one that grows, compares with `==` and has tools of its own. Include `<string>` to use it.',
    },
    vector: {
      title: 'std::vector: a list that grows',
      say: '`std::vector<int> scores = {1, 2, 3};` is a list of whole numbers; `.push_back(x)` adds one to the end.',
      more: 'The kind in the angle brackets is what the list holds, and every item must be that kind. `scores[0]` is the first item and `scores.size()` counts them. It\'s the list C++ programmers reach for first.',
    },
    semicolon: {
      title: 'A ; ends each instruction',
      say: 'Every instruction ends with a semicolon, the way a sentence ends with a full stop.',
      more: 'C++ ignores line breaks: the `;` is what separates one instruction from the next, so a missing one is the most common first error. Lines that open a block with `{` don\'t take one, but a class\'s closing `};` does.',
    },
    braces: {
      title: 'Braces hold a block together',
      say: 'The lines between `{` and `}` belong together: the steps of a tool, a loop or an `if`.',
      more: 'In C++ the braces are the structure, and the indentation is for people. Indent anyway, four spaces per level, so the shape you see matches the shape the compiler sees.',
    },
    cout: {
      title: 'cout << sends things to the screen',
      say: 'In `std::cout << "Score: " << score << std::endl;`, each `<<` passes one more piece along to the screen.',
      more: 'Think of `<<` as arrows showing where the text flows. `std::endl` ends the line and sends it out straight away; `"\\n"` also ends the line, a little faster when you print many lines.',
    },
    cin: {
      title: 'cin >> reads what is typed',
      say: '`std::cin >> guess;` waits for the person to type, and stores it in `guess`, as `guess`\'s kind.',
      more: 'The arrows point the other way: from the keyboard into the variable. It reads up to the first space; for a whole line of text, use `std::getline(std::cin, line)`.',
    },
    if: {
      title: 'Conditions go in round brackets',
      say: '`if (guess == secret) { … }` tests what\'s in the brackets, and runs the block when it\'s true.',
      more: 'The brackets are required. `else if (…)` tests another case and `else` catches the rest. C++ counts 0 as false and any other number as true, which is why `if (count)` works.',
    },
    equals: {
      title: '== compares, = stores',
      say: '`guess == secret` asks "are they equal?"; a single `=` would store `secret` in `guess`.',
      more: 'Writing `=` in an `if` by mistake still compiles, and quietly changes the value; the compiler\'s warnings point it out. `!=` means "not equal".',
    },
    'and-or': {
      title: '&& and || join tests',
      say: '`&&` means "and", `||` means "or" and `!` means "not": `if (age >= 18 && hasTicket)`.',
      more: 'C++ stops as soon as it knows the answer: in `a && b`, if `a` is false, `b` isn\'t even checked. That\'s handy for guards like `if (i < size && items[i] > 0)`.',
    },
    'for-count': {
      title: 'The counting loop: start; test; step',
      say: '`for (int i = 0; i < 10; i++)` starts `i` at 0, runs while `i < 10`, and adds one each round.',
      more: 'The three parts, separated by semicolons, are the whole story of the loop. Counting from 0 and stopping before the size is the habit, because list positions start at 0.',
    },
    'range-for': {
      title: 'Go through a list directly',
      say: '`for (const auto& item : items)` hands you each item in turn; there is nothing to count.',
      more: '`const auto&` reads each item where it is, without copying it or letting it change: the usual way to look through a list. Leave out `const` if the loop needs to change the items.',
    },
    while: {
      title: 'Repeat while something is true',
      say: '`while (guesses > 0) { … }` repeats its block for as long as the test in the brackets stays true.',
      more: 'Something inside must change the test, or the loop never ends. `while (true)` with a `break` inside is the habit for "keep going until…".',
    },
    increment: {
      title: '++ adds one',
      say: '`blinks++` adds one to `blinks`; `--` takes one away.',
      more: 'It\'s where C++ gets its name: C, plus one. You\'ll see `i++` in counting loops everywhere. (`++i` adds one too; the difference only shows when the value is used in the same expression.)',
    },
    'compound-assign': {
      title: 'Change a value where it is',
      say: '`balance += amount;` is short for `balance = balance + amount;`.',
      more: 'There\'s one for each sum: `-=`, `*=`, `/=`. They say "change this" rather than "work out a new value", which is usually what you mean.',
    },
    function: {
      title: 'The kind comes first',
      say: 'In `double area(double w, double h)`, the kind a tool gives back comes before its name, and each input has its own kind.',
      more: 'A tool must be declared before it is used, which is why tools sit above main. Name them after what they do: `area`, `random_number`, `deposit`.',
    },
    void: {
      title: 'void: gives nothing back',
      say: '`void deposit(double amount)` does its job and hands nothing back.',
      more: 'Tools that change something (print, save, move) are often `void`. Tools that work something out return it instead, so the result can be used: `double total = sum(prices);`.',
    },
    return: {
      title: 'return hands something back',
      say: '`return balance;` ends the tool and hands the value back to whoever used it.',
      more: 'Its kind must match the kind written before the tool\'s name. In `main`, `return 0;` reports success to the computer.',
    },
    'const-ref': {
      title: 'const &: look without copying',
      say: 'An input written `const std::string& name` is read where it already is: not copied, and not changed.',
      more: 'Copying a long text or list every time a tool is used is slow. `&` means "the original itself", and `const` promises not to change it. For small values like `int` and `double`, a plain copy is simpler and just as fast.',
    },
    class: {
      title: 'A class bundles data with its tools',
      say: '`class Account { … };` describes a kind of thing: what it holds, and what it can do.',
      more: 'Name classes as nouns in CapitalWords. Note the `;` after the closing brace: forgetting it gives confusing errors a few lines later.',
    },
    access: {
      title: 'public: and private:',
      say: 'Everything after `public:` can be used from outside the class; everything after `private:` only by its own tools.',
      more: 'The habit is to keep the data private and offer public tools, so a balance can only change through `deposit` and `withdraw`, which can check the amounts. In a `class`, everything is private until you say otherwise.',
    },
    constructor: {
      title: 'The constructor has the class\'s name',
      say: '`Account(std::string owner, double balance)` runs when a new Account is made, and sets it up.',
      more: 'It has no return kind, not even `void`. Making an object calls it: `Account account("Sam", 50);`. A class can have several constructors with different inputs.',
    },
    this: {
      title: 'this-> means this object',
      say: 'Inside a class, `this->owner` is this particular object\'s owner, even when an input has the same name.',
      more: '`this` points to the object the tool was used on. You only need to write it when a name is ambiguous, as when an input called `owner` meets the field `owner`.',
    },
    'init-list': {
      title: 'Fields set before the body runs',
      say: 'In `Account(double b) : balance(b) { }`, the part after the colon sets the fields as the object is made.',
      more: 'It\'s the preferred way to set fields in a constructor: they start life with the right value instead of being set twice. For `const` fields and references it\'s the only way.',
    },
    object: {
      title: 'Making an object',
      say: '`Account account("Sam", 50);` makes a new Account called `account`, handing the values to its constructor.',
      more: 'The kind comes first, as with any variable. The object lives until the end of the block it was made in, then tidies itself up: no `new` needed.',
    },
    'method-call': {
      title: 'object.tool() uses one of its tools',
      say: '`account.deposit(25)` uses the deposit tool on this particular account.',
      more: 'The dot reaches inside an object: its fields (`account.balance`) and its tools (`account.deposit(…)`). Through a pointer, an arrow does the same: `ptr->deposit(25)`.',
    },
    template: {
      title: 'Templates: one tool for many kinds',
      say: '`template <typename T>` writes a tool once, for any kind of value `T`.',
      more: 'The compiler makes a separate version for each kind it is used with. `std::vector<int>` is a template in use: the list, made for `int`s.',
    },
    lambda: {
      title: 'A tiny tool without a name',
      say: '`[](int a) { return a * 2; }` is a tool written right where it is needed.',
      more: 'The square brackets say what it may use from around it. You\'ll see lambdas handed to other tools, as in `std::sort(v.begin(), v.end(), [](int a, int b) { return a > b; });`.',
    },
    pointer: {
      title: 'A pointer holds an address',
      say: '`int* p` holds where an int lives in memory, not the int itself.',
      more: '`*p` reaches the value, and `nullptr` means "points nowhere". Modern C++ uses them sparingly: references, `std::vector` and smart pointers cover most needs more safely.',
    },
    new: {
      title: 'new needs a matching delete',
      say: '`new` makes something that lives until you `delete` it yourself.',
      more: 'Forgetting the `delete` leaks memory. Modern C++ avoids a bare `new`: make objects directly (`Account a("Sam", 5);`) or use `std::make_unique`, which deletes for you.',
    },
    break: {
      title: 'break leaves the loop',
      say: '`break;` jumps straight out of the loop it is in.',
      more: 'Handy when you\'ve found what you were looking for, and the way out of a `while (true)` loop. `continue;` skips ahead to the next round instead.',
    },
    'setup-loop': {
      title: 'setup runs once, loop forever',
      say: '`void setup()` runs once when the board powers on; `void loop()` then runs again and again, thousands of times a second.',
      more: 'A sketch has no main: Arduino supplies one that calls setup, then loop forever. Get things ready in setup (pins, the serial monitor) and do the work in loop, a little each time round.',
    },
    'pin-mode': {
      title: 'Give each pin its job first',
      say: '`pinMode(LED, OUTPUT);` makes a pin an output, which switches things on and off; `INPUT` makes it one that reads.',
      more: 'Pins start as inputs. Giving each pin its job in setup, with named constants for the pin numbers, lets anyone read the wiring from the code.',
    },
    pullup: {
      title: 'INPUT_PULLUP: pressed reads LOW',
      say: '`pinMode(BUTTON, INPUT_PULLUP)` holds the pin HIGH until a button connects it to ground, so a pressed button reads `LOW`.',
      more: 'The board\'s built-in pull-up resistor saves wiring one yourself, and stops the pin "floating" between readings when nothing is connected. The price is thinking backwards: `LOW` means pressed.',
    },
    'digital-write': {
      title: 'HIGH is on, LOW is off',
      say: '`digitalWrite(LED, HIGH);` puts 5 volts (3.3 on some boards) on the pin; `LOW` puts 0.',
      more: 'A pin can light an LED (through a resistor) but can\'t power a motor: that needs a transistor or a driver board between the pin and the motor.',
    },
    'digital-read': {
      title: 'digitalRead: HIGH or LOW?',
      say: '`digitalRead(BUTTON)` reads a pin as `HIGH` or `LOW`.',
      more: 'Real buttons flicker for a few milliseconds as their contacts close ("bounce"), so a sketch that counts presses trusts a reading only once it has held still.',
    },
    'analog-read': {
      title: 'analogRead measures a voltage',
      say: '`analogRead(A0)` turns the voltage on an analog pin into a number from 0 to 1023.',
      more: 'On a 5-volt board each step is about 5 millivolts. `map(level, 0, 1023, 0, 100)` rescales the reading to something meaningful, like a percentage.',
    },
    'analog-write': {
      title: 'analogWrite: in-between power',
      say: '`analogWrite(9, 128);` sets a pin to about half power, on a scale from 0 to 255.',
      more: 'The pin really switches on and off very fast (PWM), and an LED or motor averages it out. It only works on the pins marked with ~.',
    },
    delay: {
      title: 'delay freezes the whole board',
      say: '`delay(500);` pauses everything for half a second: no buttons are read and nothing else happens.',
      more: 'Fine for a first blink. For a gadget that does several things at once, compare the clock instead: `if (millis() - lastBlink >= 500)`.',
    },
    millis: {
      title: 'Keep time without stopping',
      say: '`millis()` counts the milliseconds since the board started; comparing it lets loop do other work while it waits.',
      more: 'Write the test as `millis() - last >= interval`: that keeps working even when the count runs out, after 49 days, and starts again from 0.',
    },
    'unsigned-long': {
      title: 'unsigned long: big, never negative',
      say: '`unsigned long lastBlink = 0;` holds whole numbers from 0 to about 4 billion.',
      more: 'On an Arduino Uno an `int` only reaches 32,767: that\'s 32 seconds of milliseconds. Times from `millis()` always go in an `unsigned long`.',
    },
    serial: {
      title: 'The serial monitor is how the board talks back',
      say: '`Serial.begin(9600);` opens the line to your computer; `Serial.println(x)` sends a line along it.',
      more: 'The 9600 is the speed, and the serial monitor must be set to the same. It\'s the main way to see what a sketch is doing, and why it isn\'t doing what you expected.',
    },
    'arduino-string': {
      title: 'Arduino\'s String',
      say: '`String("Blinks: ") + blinks` builds text by joining pieces with `+`.',
      more: 'An Uno has only 2 KB of memory, and a String grows and shrinks inside it. For messages, printing the pieces one after another (`Serial.print("Blinks: "); Serial.println(blinks);`) uses no extra memory at all.',
    },
    tone: {
      title: 'tone plays a pitch',
      say: '`tone(8, 440, 200);` plays 440 hertz (the note A) on pin 8 for 200 milliseconds.',
      more: 'Given a length, the tone carries on by itself while the sketch continues. It needs a passive buzzer or a small speaker; an "active" buzzer only needs power.',
    },
    map: {
      title: 'map turns one range into another',
      say: '`map(level, 0, 1023, 0, 100)` turns a reading from 0–1023 into 0–100.',
      more: 'It works in whole numbers, so fractions are dropped. The ends needn\'t be in order: `map(x, 0, 1023, 100, 0)` turns the range upside down.',
    },
  };

  /* The habits in C++ code, found in tree-sitter's reading of it. parse(kind, source) is the reader's parser
   * (lang/web_read.js). Like Python's style_points: { ok, error, points: [{ card, line, end, name }] }, with
   * the first place each habit shows, or every place when every is true. */
  const ARDUINO_CALLS = { pinMode: 'pin-mode', digitalWrite: 'digital-write', digitalRead: 'digital-read', analogRead: 'analog-read', analogWrite: 'analog-write', delay: 'delay', millis: 'millis', tone: 'tone', map: 'map', String: 'arduino-string' };
  const kids = (n) => { const out = []; for (let i = 0; i < n.childCount; i++) out.push(n.child(i)); return out; };
  function cppStylePoints(parse, source, every = false) {
    let root;
    try { root = parse('cpp', String(source)); } catch (e) { return { ok: false, error: 'The C++ reader isn\'t ready.', points: [] }; }
    const points = [], seen = new Set();
    const add = (card, n, name = '') => {
      if (!every && seen.has(card)) return;
      seen.add(card);
      const e = n.endPosition, last = e.column === 0 && e.row > n.startPosition.row ? e.row : e.row + 1;   // (an #include ends at the start of the next line)
      points.push({ card, line: n.startPosition.row + 1, end: last, name });
    };
    const F = (n, f) => n.childForFieldName(f);
    const fnName = (fn) => { let d = F(fn, 'declarator'); while (d && F(d, 'declarator')) d = F(d, 'declarator'); return d ? d.text : ''; };
    const visit = (n, cls) => {
      const t = n.type;
      if (t === 'preproc_include') add('include', n, (F(n, 'path') || n).text);
      else if (t === 'using_declaration') { if (kids(n).some(c => c.type === 'namespace') && n.namedChildren.some(c => c.text === 'std')) add('using-std', n); }
      else if (t === 'qualified_identifier') { const s = F(n, 'scope'); if (s && s.text === 'std') add('std', n); }
      else if (t === 'function_definition') {
        const name = fnName(n), type = F(n, 'type');
        if (name === 'main') add('main', n, name);
        else if ((name === 'setup' || name === 'loop') && !cls) add('setup-loop', n, name);
        else if (cls && name === cls) add('constructor', n, name);
        else if (type && type.text === 'void') add('void', n, name);
        else if (type) add('function', n, name);
      }
      else if (t === 'declaration' || t === 'field_declaration') {
        const type = F(n, 'type');
        if (kids(n).some(c => c.type === 'type_qualifier' && c.text === 'const')) add('const', n);
        if (type) {
          if (type.type === 'placeholder_type_specifier') add('auto', n);
          else if (type.type === 'sized_type_specifier' && /unsigned\s+long/.test(type.text)) add('unsigned-long', n);
          else if (type.type === 'primitive_type' || type.type === 'sized_type_specifier') add('types', n);
          else if (/^std::string$/.test(type.text)) add('string', n);
          else if (/^std::vector\b/.test(type.text)) add('vector', n);
          else if (type.type === 'type_identifier' && t === 'declaration' && n.namedChildren.some(c => c.type === 'init_declarator' && F(c, 'value') && F(c, 'value').type === 'argument_list')) add('object', n, type.text);
        }
        if (n.descendantsOfType('pointer_declarator').length && !n.descendantsOfType('function_declarator').length) add('pointer', n);
      }
      else if (t === 'parameter_declaration') { if (kids(n).some(c => c.type === 'type_qualifier' && c.text === 'const') && F(n, 'declarator') && F(n, 'declarator').type === 'reference_declarator') add('const-ref', n); }
      else if (t === 'for_range_loop') add('range-for', n);
      else if (t === 'for_statement') add('for-count', n);
      else if (t === 'while_statement') add('while', n);
      else if (t === 'if_statement') { if (!n.parent || n.parent.type !== 'else_clause') add('if', n); }
      else if (t === 'binary_expression') {
        const op = (F(n, 'operator') || {}).type;
        const left = (x) => { while (x.type === 'binary_expression') x = F(x, 'left'); return x.text; };
        if (op === '==' || op === '!=') add('equals', n);
        else if (op === '&&' || op === '||') add('and-or', n);
        else if (op === '<<' && /^(?:std::)?cout$/.test(left(n)) && !(n.parent && n.parent.type === 'binary_expression')) add('cout', n);
        else if (op === '>>' && /^(?:std::)?cin$/.test(left(n)) && !(n.parent && n.parent.type === 'binary_expression')) add('cin', n);
      }
      else if (t === 'update_expression') add('increment', n);
      else if (t === 'assignment_expression') { if (/^[-+*/]=$/.test((F(n, 'operator') || {}).type || '')) add('compound-assign', n); }
      else if (t === 'return_statement') add('return', n);
      else if (t === 'class_specifier' || t === 'struct_specifier') { const name = (F(n, 'name') || {}).text || ''; if (F(n, 'body')) { add('class', n, name); cls = name; } }
      else if (t === 'access_specifier') add('access', n);
      else if (t === 'field_expression') { if ((F(n, 'argument') || {}).type === 'this') add('this', n); }
      else if (t === 'field_initializer_list') add('init-list', n);
      else if (t === 'call_expression') {
        const fn = F(n, 'function');
        if (fn && fn.type === 'identifier' && ARDUINO_CALLS[fn.text]) {
          add(ARDUINO_CALLS[fn.text], n, fn.text);
          if (fn.text === 'pinMode' && /\bINPUT_PULLUP\b/.test(n.text)) add('pullup', n);
        } else if (fn && fn.type === 'field_expression') {
          if ((F(fn, 'argument') || {}).text === 'Serial') add('serial', n);
          else if ((F(fn, 'argument') || {}).type !== 'this') add('method-call', n, (F(fn, 'field') || {}).text || '');
        }
      }
      else if (t === 'template_declaration') add('template', n);
      else if (t === 'lambda_expression') add('lambda', n);
      else if (t === 'new_expression') add('new', n);
      else if (t === 'break_statement') add('break', n);
      else if (t === 'compound_statement') add('braces', n);
      else if (t === 'expression_statement') add('semicolon', n);
      for (const c of kids(n)) visit(c, cls);
    };
    visit(root, '');
    return { ok: !root.hasError(), error: root.hasError() ? 'Some of this code could not be read, so the habits there may be missing.' : '', points };
  }

  /* One line of C++ -> something the reader can take on its own: an opened block is closed, "} else" gets an
   * if before it, and the line goes inside a tool unless it reads fine by itself (a tool's first line, a
   * setting at the top). The expected line decides, and the answer is wrapped the same way. */
  function cppProbes(line) {
    let t = String(line).trim();
    if (/^\}/.test(t)) t = 'if (1) {\n' + t;
    if (/\{\s*(?:\/\/.*)?$/.test(t)) t += '\n}';
    return [t, 'void _probe() {\n' + t + '\n}'];
  }
  /* The tokens C++ reads, in order, without comments or spacing: the same tokens make the same program. */
  const tokens = (n, out = []) => { if (!n.childCount) { if (n.type !== 'comment') out.push(n.type + ' ' + n.text); } else for (const c of kids(n)) tokens(c, out); return out; };
  function cppCompare(parse, expected, answer) {
    const probes = cppProbes(expected);
    const k = probes.findIndex(p => !parse('cpp', p).hasError());
    if (k < 0) return { same: false, error: 'The line can\'t be read on its own.' };
    const mine = parse('cpp', cppProbes(answer)[k]);
    if (mine.hasError()) return { same: false, error: 'C++ can\'t read that yet.' };
    return { same: tokens(parse('cpp', probes[k])).join('\n') === tokens(mine).join('\n') };
  }
  /* Two whole programs: exactly the same tokens? */
  const cppSameProgram = (parse, a, b) => tokens(parse('cpp', a)).join('\n') === tokens(parse('cpp', b)).join('\n');

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

  /* The one line of real code a sentence became, if it became exactly one (imports, #includes, comments
   * and closing braces don't count): that is what a "Your turn" exercise asks for. */
  function exerciseLine(codeLines) {
    const lines = codeLines.map(l => l.trim()).filter(l => l && !/^(import|from\s+\S+\s+import)\b/.test(l) && !/^(#|\/\/)/.test(l) && !/^\};?$/.test(l) && l !== 'pass');
    return lines.length === 1 ? lines[0] : null;
  }

  const FADE_AFTER = 3;   // right answers before a habit's notes shrink to "you know this"

  window.IntuiTutor = { CARDS: { python, cpp }, probe, exerciseLine, cppStylePoints, cppCompare, cppSameProgram, FADE_AFTER };
})();

// What the Python writer's words mean, on concrete values. A value example is translated as
// "set result to <say>", a statement example as its lines, after its given lines (as exact Python), and run.
// What it must give is what the words say, worked out by hand, not from the code. Values must be equal and of
// the same type (3 is not 3.0).
//   say     a value, in words
//   lines   statements, in words (one or more lines, indented as in a sentence file)
//   given   Python lines that set up the names (also run on their own to work out the expected values)
//   means   the value `say` means, as Python
//   names   names and the values the words leave in them, as Python
//   prints  what the words show, exactly (prompts from "ask" included)
//   input   the answers "ask" gets, in order
//   raises  the error the words stop with
//   holds   a check on the names, `result` (and `results`, every run's), `shown` and `slept` (what "wait" asked for)
//   runs    how many times to run it (random is seeded 0, 1, 2 …, so it's the same every time)
//   after   names whose value the words also change, and what to (as names)
// Rules with no example are in NOT_RUN, with why.

export const EXAMPLES = [
  // Looking things up
  { say: 'the first item of xs', given: 'xs = [4, 5, 6]', means: '4' },
  { say: 'the last item of xs', given: 'xs = [4, 5, 6]', means: '6' },
  { say: 'item "k" of d or 0 if there isn\'t one', given: 'd = {"j": 1}', means: '0' },
  { say: 'item "k" of d or 0 if there isn\'t one', given: 'd = {"k": 5}', means: '5' },
  { say: 'item "k" of d if there is one', given: 'd = {}', means: 'None' },
  { say: 'item "k" of d if there is one', given: 'd = {"k": 5}', means: '5' },
  { say: 'the last item taken out of xs', given: 'xs = [1, 2, 3]', means: '3', after: { xs: '[1, 2]' } },
  { say: 'item 0 taken out of xs', given: 'xs = [1, 2, 3]', means: '1', after: { xs: '[2, 3]' } },
  { say: 'the environment variable "INTUACODE_UNSET" or "off" if there isn\'t one', given: 'import os\nos.environ.pop("INTUACODE_UNSET", None)', means: '"off"' },
  { say: 'the environment variable "INTUACODE_SET" or "off" if there isn\'t one', given: 'import os\nos.environ["INTUACODE_SET"] = "on"', means: '"on"' },
  { say: 'the environment variable "INTUACODE_SET"', given: 'import os\nos.environ["INTUACODE_SET"] = "on"', means: '"on"' },
  { say: 'the environment variable "INTUACODE_UNSET"', given: 'import os\nos.environ.pop("INTUACODE_UNSET", None)', means: 'None' },
  { say: 'there is no file or folder at p', given: 'p = "no such folder/no such file.txt"', means: 'True' },
  { say: 'there is no file or folder at p', given: 'import os\np = os.getcwd()', means: 'False' },
  { say: 'there is a file or folder at p', given: 'import os\np = os.getcwd()', means: 'True' },
  { say: 'item 1 of xs', given: 'xs = [4, 5, 6]', means: '5' },
  { say: 'item "k" of d', given: 'd = {"k": 7}', means: '7' },
  // Functions written as words
  { say: 'the length of "abc"', means: '3' },
  { say: 'the size of xs', given: 'xs = [4, 5, 6]', means: '3' },
  { say: 'how many items are in xs', given: 'xs = [4, 5, 6]', means: '3' },
  { say: 'the number of items in xs', given: 'xs = []', means: '0' },
  { say: 'the sum of xs', given: 'xs = [1, 2, 3]', means: '6' },
  { say: 'the total of xs', given: 'xs = [1.5, 2]', means: '3.5' },
  { say: 'the biggest in xs', given: 'xs = [3, 9, 2]', means: '9' },
  { say: 'the smallest in xs', given: 'xs = [3, 9, 2]', means: '2' },
  { say: 'the square root of 16', means: '4.0' },
  { say: 'the absolute value of n', given: 'n = -5', means: '5' },
  { say: 'x rounded to 2 places', given: 'x = 3.14159', means: '3.14' },
  { say: 'x rounded', given: 'x = 2.6', means: '3' },
  // (an exact half goes to the even neighbour, as Python's round does, and the note says)
  { say: 'x rounded', given: 'x = 2.5', means: '2' },
  { say: 'x rounded', given: 'x = 3.5', means: '4' },
  { say: 'xs sorted by len biggest first', given: 'xs = ["bb", "a", "ccc"]', means: '["ccc", "bb", "a"]' },
  { say: 'xs sorted by len', given: 'xs = ["bb", "a", "ccc"]', means: '["a", "bb", "ccc"]' },
  { say: 'xs sorted biggest first', given: 'xs = [3, 1, 2]', means: '[3, 2, 1]' },
  { say: 'sorted xs', given: 'xs = [3, 1, 2]', means: '[1, 2, 3]', after: { xs: '[3, 1, 2]' } },
  { say: 'xs sorted', given: 'xs = [3, 1, 2]', means: '[1, 2, 3]', after: { xs: '[3, 1, 2]' } },
  // JSON
  { say: 'xs as JSON text', given: 'xs = [1, 2]', means: '"[1, 2]"' },
  { say: 't read as JSON', given: 't = \'{"a": 1}\'', means: '{"a": 1}' },
  { say: 'the JSON read from f', given: 'import io\nf = io.StringIO("[1, 2]")', means: '[1, 2]' },
  // Turning values into others
  { say: 't as number', given: 't = "42"', means: '42' },
  { say: 't as a whole number', given: 't = "-7"', means: '-7' },
  { say: 't as decimal', given: 't = "3.5"', means: '3.5' },
  { say: 'n as text', given: 'n = 5', means: '"5"' },
  { say: 't in capitals', given: 't = "hi"', means: '"HI"' },
  { say: 't in lowercase', given: 't = "Hi"', means: '"hi"' },
  // Text's own tools
  { say: 't trimmed', given: 't = "  hi  "', means: '"hi"' },
  { say: 't split into words', given: 't = "a  b c"', means: '["a", "b", "c"]' },
  { say: 't split at ","', given: 't = "a,b"', means: '["a", "b"]' },
  { say: 'words joined by "-"', given: 'words = ["a", "b"]', means: '"a-b"' },
  { say: 't with "a" replaced by "o"', given: 't = "banana"', means: '"bonono"' },
  { say: 't does not start with "x"', given: 't = "abc"', means: 'True' },
  { say: 't starts with "ab"', given: 't = "abc"', means: 'True' },
  { say: 't starts with "b"', given: 't = "abc"', means: 'False' },
  { say: 't doesn\'t end with "c"', given: 't = "abc"', means: 'False' },
  { say: 't ends with "bc"', given: 't = "abc"', means: 'True' },
  { say: 't is not all letters or digits', given: 't = "a b"', means: 'True' },
  { say: 't is all letters or digits', given: 't = "a1"', means: 'True' },
  { say: 't is not all letters', given: 't = "a1"', means: 'True' },
  { say: 't is all letters', given: 't = "abc"', means: 'True' },
  { say: 't is not all digits', given: 't = "12a"', means: 'True' },
  { say: 't is all digits', given: 't = "123"', means: 'True' },
  { say: 'pairs of d', given: 'd = {"a": 1}', holds: 'list(result) == [("a", 1)]' },
  // Randomness: every value in the range comes up, and nothing outside it
  { say: 'random number from 1 to 6', runs: 300, holds: 'set(results) == {1, 2, 3, 4, 5, 6}' },
  { say: 'random decimal', runs: 300, holds: 'all(type(r) is float and 0 <= r < 1 for r in results)' },
  { say: 'random item from xs', given: 'xs = ["a", "b", "c"]', runs: 100, holds: 'set(results) == {"a", "b", "c"}' },
  // Powers
  { say: 'n squared', given: 'n = 3', means: '9' },
  { say: 'n cubed', given: 'n = 2', means: '8' },
  { say: 'x minus x squared', given: 'x = 3', means: '-6' },
  // Comparisons that need both sides
  { say: '12 is divisible by 4', means: 'True' },
  { say: '12 is divisible by 5', means: 'False' },
  { say: 'n plus 1 is divisible by 3', given: 'n = 2', means: 'True' },
  { say: 'n is not even', given: 'n = 3', means: 'True' },
  { say: 'n is not odd', given: 'n = 4', means: 'True' },
  { say: 'n is even', given: 'n = 4', means: 'True' },
  { say: 'n plus 1 is even', given: 'n = 3', means: 'True' },
  { say: 'n is odd', given: 'n = 3', means: 'True' },
  { say: 'n is odd', given: 'n = -3', means: 'True' },
  { say: 'n is between 1 and 5', given: 'n = 5', means: 'True' },
  { say: 'n is between 1 and 5', given: 'n = 6', means: 'False' },
  { say: 'n is not between 1 and 5', given: 'n = 6', means: 'True' },
  { say: 'xs does not contain 4', given: 'xs = [1, 2]', means: 'True' },
  { say: 'xs contains 2', given: 'xs = [1, 2]', means: 'True' },
  { say: 't contains "an"', given: 't = "banana"', means: 'True' },
  // Comparisons
  { say: 'x is not nothing', given: 'x = 0', means: 'True' },
  { say: 'x is nothing', given: 'x = None', means: 'True' },
  { say: 'x is nothing', given: 'x = 0', means: 'False' },
  { say: 'n is not in xs', given: 'n = 2\nxs = [1, 3]', means: 'True' },
  { say: 'n is at least 5', given: 'n = 5', means: 'True' },
  { say: 'n is greater than or equal to 5', given: 'n = 4', means: 'False' },
  { say: 'n is at most 5', given: 'n = 5', means: 'True' },
  { say: 'n is more than 5', given: 'n = 5', means: 'False' },
  { say: 'n is over 5', given: 'n = 6', means: 'True' },
  { say: 'n is less than 5', given: 'n = 4', means: 'True' },
  { say: 'n is under 5', given: 'n = 5', means: 'False' },
  { say: 'n is not 4', given: 'n = 5', means: 'True' },
  { say: 'n isn\'t 5', given: 'n = 5', means: 'False' },
  { say: 'n is in xs', given: 'n = 2\nxs = [1, 2]', means: 'True' },
  { say: 'n is one of xs', given: 'n = 4\nxs = [1, 2]', means: 'False' },
  { say: '2 plus 2 is 4', means: 'True' },
  { say: 'n equals 3', given: 'n = 3', means: 'True' },
  // Maths
  { say: '2 plus 3', means: '5' },
  { say: '"a" followed by "b"', means: '"ab"' },
  { say: '7 minus 2', means: '5' },
  { say: '3 times 4', means: '12' },
  { say: '1 plus 2 times 3', means: '7' },
  { say: '7 divided by 2', means: '3.5' },
  { say: '7 mod 3', means: '1' },
  { say: '7 remainder after dividing by 2', means: '1' },
  { say: '2 to the power of 10', means: '1024' },
  // Plain values
  { say: 'an empty list', means: '[]' },
  { say: 'an empty dictionary', means: '{}' },
  { say: 'an empty set', means: 'set()' },
  { say: 'empty text', means: '""' },
  { say: 'yes', means: 'True' },
  { say: 'no', means: 'False' },
  { say: 'nothing', means: 'None' },
  { say: '1 if yes otherwise 2', means: '1' },
  { say: 'a if a is more than b otherwise b', given: 'a = 1\nb = 2', means: '2' },
  { say: 'yes and no', means: 'False' },
  { say: 'no or yes', means: 'True' },
  { say: 'not no', means: 'True' },
];

// A folder of its own for the examples that make files (the runner goes back to where it was after each)
const TEMP = 'import os, tempfile\nos.chdir(tempfile.mkdtemp())';
// A Flask app in words (its examples ask it through app.test_client(), as Flask's own tests do)
const FLASK = 'bring in Flask, jsonify and request from flask\nset app to a new Flask with __name__';

export const STATEMENTS = [
  // Exact code, notes and descriptions
  { lines: 'python: n = 2 + 3', names: { n: '5' } },
  { lines: 'n = 2 + 3', names: { n: '5' } },
  { lines: 'set n to 1\nnote: set n to 99', names: { n: '1' } },
  { lines: 'define one\n    description: Gives back 1.\n    give back 1', holds: 'one.__doc__ == "Gives back 1." and one() == 1' },
  // The program
  { lines: 'bring in sqrt from math\nset r to sqrt(16)', names: { r: '4.0' } },
  { lines: 'bring in math\nset r to math.floor(2.5)', names: { r: '2' } },
  { lines: 'use the math module\nset r to math.ceil(2.5)', names: { r: '3' } },
  { lines: 'if this file is run directly\n    show "main"', prints: 'main\n' },
  { lines: 'decorate with twice\ndefine two\n    give back 1\nset r to the result of two', given: 'twice = lambda f: (lambda: f() * 2)', names: { r: '2' } },
  { lines: 'set count to 0\ndefine bump\n    use the shared count\n    increase count by 1\nrun bump\nrun bump', names: { count: '2' } },
  // Values
  { lines: 'set n to 5', names: { n: '5' } },
  { lines: 'set high score to 10', names: { high_score: '10' } },
  { lines: 'remember 5 as n', names: { n: '5' } },
  { lines: 'set n to 7\nincrease n by 2', names: { n: '9' } },
  { lines: 'set n to 7\nincrease n', names: { n: '8' } },
  { lines: 'set n to 7\ndecrease n by 2', names: { n: '5' } },
  { lines: 'set n to 7\ndecrease n', names: { n: '6' } },
  { lines: 'set n to 7\nsubtract 3 from n', names: { n: '4' } },
  { lines: 'set n to 7\nmultiply n by 3', names: { n: '21' } },
  { lines: 'set n to 7\ndivide n by 2', names: { n: '3.5' } },
  { lines: 'set n to 7\nadd 5 to n', names: { n: '12' } },
  // Lists, sets and dictionaries
  { lines: 'create list xs with 1, 2 and 3', names: { xs: '[1, 2, 3]' } },
  { lines: 'create an empty list called xs', names: { xs: '[]' } },
  { lines: 'create dictionary prices', names: { prices: '{}' } },
  { lines: 'create dictionary d\nset item "a" of d to 1', names: { d: '{"a": 1}' } },
  { lines: 'add 4 to xs', given: 'xs = [1, 2, 3]', names: { xs: '[1, 2, 3, 4]' } },
  { lines: 'append 4 to xs', given: 'xs = [1, 2, 3]', names: { xs: '[1, 2, 3, 4]' } },
  { lines: 'add each item of ys to xs', given: 'xs = [1]\nys = [2, 3]', names: { xs: '[1, 2, 3]', ys: '[2, 3]' } },
  { lines: 'add 1 to the set s', given: 's = {2}', names: { s: '{1, 2}' } },
  { lines: 'insert 0 into xs at position 0', given: 'xs = [1, 2]', names: { xs: '[0, 1, 2]' } },
  { lines: 'take the last item out of xs', given: 'xs = [1, 2, 3]', names: { xs: '[1, 2]' } },
  { lines: 'take item 0 out of xs', given: 'xs = [1, 2, 3]', names: { xs: '[2, 3]' } },
  { lines: 'take 2 out of xs', given: 'xs = [1, 2, 3, 2]', names: { xs: '[1, 3, 2]' } },
  { lines: 'remove 2 from xs', given: 'xs = [1, 2, 3, 2]', names: { xs: '[1, 3, 2]' } },
  { lines: 'delete item "a" of d', given: 'd = {"a": 1, "b": 2}', names: { d: '{"b": 2}' } },
  { lines: 'sort xs', given: 'xs = [3, 1, 2]', names: { xs: '[1, 2, 3]' } },
  { lines: 'sort xs biggest first', given: 'xs = [3, 1, 2]', names: { xs: '[3, 2, 1]' } },
  { lines: 'sort xs by len', given: 'xs = ["bb", "a", "ccc"]', names: { xs: '["a", "bb", "ccc"]' } },
  { lines: 'sort xs by len biggest first', given: 'xs = ["bb", "a", "ccc"]', names: { xs: '["ccc", "bb", "a"]' } },
  { lines: 'reverse xs', given: 'xs = [1, 2, 3]', names: { xs: '[3, 2, 1]' } },
  { lines: 'empty xs', given: 'xs = [1, 2, 3]', names: { xs: '[]' } },
  { lines: 'shuffle xs', given: 'xs = [1, 2, 3, 4]', runs: 30, holds: 'sorted(xs) == [1, 2, 3, 4]' },
  // Objects
  { lines: 'define class Animal\n    when a new Animal is made with name\n        set self.name to name\n    define speak using self\n        give back "..."\ndefine class Dog based on Animal\n    define speak using self\n        give back self.name followed by " says woof"\nset d to a new Dog with "Rex"\nset r to the result of d.speak',
    names: { r: '"Rex says woof"' } },
  { lines: 'bring in dataclass from dataclasses\ndecorate with dataclass\ndefine class Point\n    field x: whole number\n    field y: whole number = 0\nset p to a new Point with 3', holds: 'p.x == 3 and p.y == 0' },
  { lines: 'make a new Fraction with 1 and 2 and store it in half', given: 'from fractions import Fraction', names: { half: 'Fraction(1, 2)' } },
  { lines: 'make a new Note', given: 'made = []\nNote = lambda: made.append("note")', names: { made: '["note"]' } },
  { lines: 'run double with 21 and store it in r', given: 'double = lambda n: n * 2', names: { r: '42' } },
  { lines: 'run made.append with 1', given: 'made = []', names: { made: '[1]' } },
  // Tools
  { lines: 'define add one using n\n    give back n plus 1\nset r to the result of add one with 41', names: { r: '42' } },
  { lines: 'define nothing back\n    give back\nset r to the result of nothing back', names: { r: 'None' } },
  // Decisions
  { lines: 'set n to 5\nif n is more than 10\n    set size to "big"\notherwise if n is more than 3\n    set size to "middle"\notherwise\n    set size to "small"', names: { size: '"middle"' } },
  { lines: 'set n to 1\nif n is more than 10\n    set size to "big"\notherwise if n is more than 3\n    set size to "middle"\notherwise\n    set size to "small"', names: { size: '"small"' } },
  // (both are true: only the first runs)
  { lines: 'set n to 20\nif n is more than 10\n    set size to "big"\notherwise if n is more than 3\n    set size to "middle"', names: { size: '"big"' } },
  { lines: 'set n to 1\nif n is 1\n    do nothing\nset m to 2', names: { n: '1', m: '2' } },
  // Loops: how many times, and with which values
  { lines: 'set n to 0\nrepeat 3 times\n    increase n', names: { n: '3' } },
  { lines: 'set n to 0\nrepeat twice\n    increase n', names: { n: '2' } },
  { lines: 'set seen to an empty list\nrepeat 3 times counting with i\n    add i to seen', names: { seen: '[0, 1, 2]' } },
  { lines: 'set seen to an empty list\ncount i from 1 to 5\n    add i to seen', names: { seen: '[1, 2, 3, 4, 5]' } },
  { lines: 'set seen to an empty list\ncount down i from 3 to 1\n    add i to seen', names: { seen: '[3, 2, 1]' } },
  { lines: 'set seen to an empty list\ncount i from 0 to 10 in steps of 5\n    add i to seen', names: { seen: '[0, 5, 10]' } },
  { lines: 'set total to 0\nfor each n in xs\n    increase total by n', given: 'xs = [1, 2, 3]', names: { total: '6' } },
  { lines: 'set seen to an empty list\nfor each n in xs\n    if n is even\n        skip to next\n    add n to seen', given: 'xs = [1, 2, 3, 4]', names: { seen: '[1, 3]' } },
  { lines: 'set n to 0\nrepeat forever\n    increase n\n    if n is 3\n        stop the loop', names: { n: '3' } },
  { lines: 'set n to 0\nrepeat until n is 4\n    increase n', names: { n: '4' } },
  { lines: 'set n to 4\nrepeat until n is 4\n    increase n', names: { n: '4' } },
  { lines: 'set n to 0\nwhile n is less than 4\n    increase n by 3', names: { n: '6' } },
  // Showing and asking
  { lines: 'show "hello"', prints: 'hello\n' },
  { lines: 'show "Score:" and 3', prints: 'Score: 3\n' },
  { lines: 'set name to "Ann"\nshow "Hi {name}"', prints: 'Hi Ann\n' },
  // (what's shown next carries on after a space, as between things joined with "and")
  { lines: 'show "a" on the same line\nshow "b"', prints: 'a b\n' },
  // (and "without ending the line" carries on straight after, with no space)
  { lines: 'show "a" without ending the line\nshow "b"', prints: 'ab\n' },
  { lines: 'show "a" without a new line\nshow "b"', prints: 'ab\n' },
  { lines: 'show a blank line', prints: '\n' },
  { lines: 'ask "Name? " and store in name', input: ['Bob'], names: { name: '"Bob"' }, prints: 'Name? ' },
  { lines: 'ask for a number "Age? " and store in age', input: ['42'], names: { age: '42' }, prints: 'Age? ' },
  { lines: 'ask for a decimal "Height? " and store in h', input: ['1.5'], names: { h: '1.5' }, prints: 'Height? ' },
  { lines: 'ask "Ready? "', input: ['yes'], prints: 'Ready? ' },
  // Errors
  { lines: 'set log to an empty list\ntry\n    fail with ValueError: "bad"\nif it fails with ValueError as e\n    add e as text to log\nif nothing failed\n    add "fine" to log\nin any case\n    add "done" to log', names: { log: '["bad", "done"]' } },
  { lines: 'set log to an empty list\ntry\n    add "ok" to log\nif it fails with ValueError as e\n    add e as text to log\nif nothing failed\n    add "fine" to log\nin any case\n    add "done" to log', names: { log: '["ok", "fine", "done"]' } },
  { lines: 'set log to an empty list\ntry\n    try\n        fail with KeyError: "k"\n    if it fails\n        add "inner" to log\n        fail again\nif it fails with KeyError\n    add "outer" to log', names: { log: '["inner", "outer"]' } },
  { lines: 'fail with ValueError: "bad"', raises: 'ValueError' },
  { lines: 'check that 1 plus 1 is 3', raises: 'AssertionError' },
  { lines: 'check that 1 plus 1 is 2\nset ok to yes', names: { ok: 'True' } },
  { lines: 'show "a"\nstop the program\nshow "b"', prints: 'a\n', raises: 'SystemExit' },
  // Files, JSON, SQL and context
  { lines: 'open the file "notes.txt" for writing as f\n    write "hi" into f\nopen the file "notes.txt" for adding as f\n    write "!" into f\nopen the file "notes.txt" as f\n    set t to the result of f.read', given: TEMP, names: { t: '"hi!"' } },
  { lines: 'open the file "d.json" for writing as f\n    save xs as JSON in f\nopen the file "d.json" as f\n    set back to the JSON read from f', given: TEMP + '\nxs = [1, 2]', names: { back: '[1, 2]' } },
  { lines: 'run the SQL "create table t (n integer)" on conn\nrun the SQL "insert into t values (?)" on conn with the values 5\nsave the changes to conn\npython: rows = conn.execute("select n from t").fetchall()', given: 'import sqlite3\nconn = sqlite3.connect(":memory:")', names: { rows: '[(5,)]' } },
  { lines: 'set log to an empty list\nusing contextlib.suppress(ZeroDivisionError)\n    set r to 1 divided by 0\n    add "not here" to log\nadd "after" to log', given: 'import contextlib', names: { log: '["after"]' } },
  { lines: 'set seen to an empty list\ndefine async work\n    async using lock\n        add 1 to seen\npython: asyncio.run(work())', given: 'import asyncio\nlock = asyncio.Lock()', names: { seen: '[1]' } },
  // Waiting (noted, not waited)
  { lines: 'wait 3 seconds', holds: 'slept == [3]' },
  { lines: 'wait 2 minutes', holds: 'slept == [120]' },
  { lines: 'wait 500 milliseconds', holds: 'slept == [0.5]' },
  // Web routes, on a stand-in Flask and FastAPI (tests/helpers/web_standin.py): each sends the app requests
  // through its test client, as Flask's and FastAPI's own do. A route only for GET turns a POST away (405).
  { lines: `${FLASK}\nwhen app gets GET at "/hi"\ndefine hi\n    give back {"n": 1} as a JSON reply`,
    holds: 'app.test_client().get("/hi").get_json() == {"n": 1} and app.test_client().get("/hi").is_json and app.test_client().post("/hi").status_code == 405 and app.test_client().get("/").status_code == 404' },
  { lines: `${FLASK}\nwhen app gets POST at "/add"\ndefine add\n    set data to the JSON sent with request\n    give back (item "n" of data plus 1) as a JSON reply`,
    holds: 'app.test_client().post("/add", json={"n": 4}).get_json() == 5 and app.test_client().get("/add").status_code == 405' },
  { lines: `${FLASK}\nwhen app gets GET and POST at "/both"\ndefine both\n    give back request.method`,
    holds: 'app.test_client().get("/both").text == "GET" and app.test_client().post("/both").text == "POST" and app.test_client().put("/both").status_code == 405' },
  { lines: `${FLASK}\nwhen app gets GET at "/double/<int:k>"\ndefine double using k\n    give back (k times 2) as text`,
    holds: 'app.test_client().get("/double/4").text == "8" and app.test_client().get("/double/x").status_code == 404' },
  // ("a request", with no kinds named: Flask answers GET there, and the note says so)
  { lines: `${FLASK}\nwhen app gets a request at "/page"\ndefine page\n    give back "hello"`, holds: 'app.test_client().get("/page").text == "hello"' },
  { lines: `${FLASK}\nwhen app handles GET at "/ping"\ndefine ping\n    give back "pong"`,
    holds: 'app.test_client().get("/ping").text == "pong" and app.test_client().post("/ping").status_code == 405' },
  { lines: 'bring in FastAPI from fastapi\nset app to a new FastAPI\nwhen app handles POST at "/items" with status_code=201\ndefine make_item using name\n    give back {"made": name}',
    given: 'from fastapi.testclient import TestClient', holds: 'TestClient(app).post("/items?name=pen").status_code == 201 and TestClient(app).post("/items?name=pen").json() == {"made": "pen"} and TestClient(app).get("/items").status_code == 405' },
];

// Rules with no example yet, keyed by the start of their name (as tools/meaning.mjs prints it), and why.
export const NOT_RUN = {
  'add a x saying y to z': 'a tkinter window part: needs a window to put it in',
};

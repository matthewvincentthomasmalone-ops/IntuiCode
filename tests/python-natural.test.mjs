// What people naturally type that Python can't take as written: each becomes Python in the form Python
// needs, with a note saying what it became, or a problem that says the fix. Never code that looks fine and isn't.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { loadEngine, PYTHON, toSentences, compareMany } from './helpers/engine.mjs';

const { L } = loadEngine();

function py(sentences) {
  const r = L.compileProject({ sections: [{ id: 'main', file: 'main', text: sentences }] }).results.main;
  // (JSON: arrays made inside the engine's sandbox don't deep-equal ordinary arrays)
  return JSON.parse(JSON.stringify({
    code: r.lines.filter(o => o.src >= 0).map(o => o.text).join('\n'), text: r.text,
    errors: r.info.flatMap(i => i.errs), warnings: r.info.flatMap(i => i.warns), notes: r.info.flatMap(i => i.notes),
  }));
}
const run = (text) => execFileSync(PYTHON, ['-c', text], { encoding: 'utf8' }).replace(/\r/g, '').trim();
/* Sentences that make this code, with no problems, and a note that matches. */
function becomes(sentences, code, note) {
  const out = py(sentences);
  assert.deepEqual([...out.errors, ...out.warnings], [], sentences);
  assert.equal(out.code, code, sentences);
  if (note) assert.ok(out.notes.some(n => note.test(n)), `no note matching ${note} in:\n${out.notes.join('\n')}`);
  return out;
}
/* Sentences that give a problem matching this. */
function problem(sentences, re) {
  const out = py(sentences);
  assert.ok(out.errors.some(e => re.test(e)), `expected an error matching ${re}, got:\n${out.errors.join('\n') || '(none)'}\n${out.code}`);
  return out;
}

test('a name set with a hyphen is that name wherever it is used', () => {
  becomes('set high-score to 0\nincrease high-score by 1\nshow high-score plus 1\nshow "Best: {high-score}"',
    'high_score = 0\nhigh_score += 1\nprint(high_score + 1)\nprint(f"Best: {high_score}")', /names can't contain -, so "high-score" is written `high_score`/);
  // set with spaces or _, said with a hyphen, and the other way round
  becomes('set high score to 0\nshow high-score', 'high_score = 0\nprint(high_score)');
  becomes('set high_score to 0\nshow high-score', 'high_score = 0\nprint(high_score)');
  becomes('set high-score to 0\nshow high score', 'high_score = 0\nprint(high_score)');
  // a hyphen between numbers, or between names that aren't one name, takes away
  becomes('set n to 5\nset m to n-1', 'n = 5\nm = n-1');
  becomes('set a to 5\nset b to 1\nshow a-b', 'a = 5\nb = 1\nprint(a-b)');
  // " - " between the words of a name is taking away, not the name
  becomes('set high score to 0\nset high to 5\nset score to 2\nshow high - score', 'high_score = 0\nhigh = 5\nscore = 2\nprint(high - score)');
  assert.equal(run(py('set high-score to 3\nincrease high-score by 1\nshow high-score').code), '4');
});

test('a hyphen between two names that are also one name is asked about', () => {
  problem('set high to 1\nset score to 2\nset high-score to 0\nshow high-score', /"high-score" could be the name `high_score` or `high` minus `score`\. Write high_score for the name, or "high minus score" to take away/);
});

test('a number written with thousands commas is that number', () => {
  becomes('set budget to 1,000', 'budget = 1000', /A comma in Python separates two values, so 1,000 is written 1000\./);
  becomes('set big to 12,345,678\nset cost to 1,000.50', 'big = 12345678\ncost = 1000.50');
  becomes('set total to 0\nif total is more than 1,000\n    show "big"', 'total = 0\nif total > 1000:\n    print("big")');
  becomes('show 1,000', 'print(1000)');
  // where commas separate items too, items separated by ", " make each group one number
  becomes('create list xs with 1,000, 2,000', 'xs = [1000, 2000]');
  becomes('set xs to [1,000, 2,000]\nset m to max(1,500, 2,500)', 'xs = [1000, 2000]\nm = max(1500, 2500)');
  // a comma that isn't between groups of three digits separates items, as before
  becomes('show 1, 2\ncreate list ys with 1, 2', 'print(1, 2)\nys = [1, 2]');
  // 1'000, as in Switzerland, is the number too
  becomes("set n to 1'000", 'n = 1000', /Python numbers can't have ' in them, so 1'000 is written 1000\./);
  // Python's own list in brackets, text, and python: lines stay as written
  becomes('set xs to [100,200]\nshow "1,000"\npython: t = 1,000', 'xs = [100,200]\nprint("1,000")\nt = 1,000');
  assert.equal(run(py('set n to 12,345\nshow n plus 1').code), '12346');
});

test('money is the number, without its sign', () => {
  becomes('set price to $5', 'price = 5', /Python numbers have no \$ sign, so \$5 is written 5\. Text like "\$5" shows the sign\./);
  becomes('set a to $5.50\nset b to €5\nset c to £5\nset d to 5€\nset e to -$5\nset f to $1,000', 'a = 5.50\nb = 5\nc = 5\nd = 5\ne = -5\nf = 1000');
  becomes('set price to 10\nif price is more than $5\n    show "dear"', 'price = 10\nif price > 5:\n    print("dear")');
  // inside quotes it's text, as written
  becomes('show "$5"', 'print("$5")');
});

test('a percentage is the decimal it means, exactly', () => {
  becomes('set rate to 50%', 'rate = 0.5', /50% is written 0\.5 \(50 divided by 100\)\./);
  becomes('set a to 12.5%\nset b to 1.1%\nset c to 100%\nset d to 7 percent\nset e to 250 per cent', 'a = 0.125\nb = 0.011\nc = 1\nd = 0.07\ne = 2.5');
  becomes('set total to 10\nset tip to 15% of total', 'total = 10\ntip = 0.15 * total', /"15% of" is written `0\.15 \*`/);
  becomes('set x to 50% plus 1', 'x = 0.5 + 1');
  // % before a value is Python's remainder, as before
  becomes('set n to 3\nset a to 7 % 2\nset b to 10 % n\nset c to 7%2', 'n = 3\na = 7 % 2\nb = 10 % n\nc = 7%2');
  // and in {…}, what follows a : is how Python shows the value
  becomes('set rate to 0.5\nshow "{rate:.1%} and {rate!r} and {rate:5%}"', 'rate = 0.5\nprint(f"{rate:.1%} and {rate!r} and {rate:5%}")');
  assert.equal(run(py('set total to 200\nset tip to 15% of total\nshow tip').code), '30.0');
});

test('a % after a name, with no value after it, says what to write', () => {
  problem('set n to 7\nset r to n%', /Python reads % as the remainder after dividing \(7 % 2 is 1\), so "n%" needs a value after it\. For n as a percentage, write n divided by 100\./);
});

test('money or a percentage shown on its own is shown as typed', () => {
  becomes('show $5\nshow 50%\nshow "Total:" and $1,000', 'print("$5")\nprint("50%")\nprint("Total:", "$1,000")', /50% is shown as the text "50%": as a number it would be 0\.5\./);
  becomes('show 15% of 200', 'print(0.15 * 200)');
});

test('curly quote marks used as quotes are straight ones', () => {
  becomes('show “Hello there”', 'print("Hello there")', /Quote marks like “ ” are written as straight ones \("\): Python only reads those\./);
  becomes('show «Bonjour»', 'print("Bonjour")', /Quote marks like « » are written as straight ones \("\)/);
  becomes('show ‘Sam’\nshow ’Sam’\nshow „Hallo“', "print('Sam')\nprint('Sam')\nprint(\"Hallo\")", /Quote marks like ‘ ’ are written as straight ones \('\)/);
  becomes('set name to “Sam”\nif name is “Sam”\n    show “Hi {name}”', 'name = "Sam"\nif name == "Sam":\n    print(f"Hi {name}")');
  becomes('create list xs with “a”, “b”\nshow "a" plus “b”', 'xs = ["a", "b"]\nprint("a" + "b")');
  // an apostrophe in a word stays, and so does anything in straight quotes
  becomes('show “It’s here”\nshow ‘It’s Sam’s’\nshow "It’s “here”"', 'print("It’s here")\nprint(\'It’s Sam’s\')\nprint("It’s “here”")');
  // a straight quote inside curly ones stays part of the text
  becomes('show “She said "hi"”\nshow ‘it\'s’', 'print("She said \\"hi\\"")\nprint(\'it\\\'s\')');
  // notes and python: lines are as written
  becomes('note: “curly” stays\npython: s = "‘a’"', '# “curly” stays\ns = "‘a’"');
  assert.equal(run(py('set name to ‘Sam’\nshow “Hi {name}”').code), 'Hi Sam');
});

test('text with the same quote marks inside it says how to write it', () => {
  const out = problem('show "She said "hi" to me"', /This text has quote marks inside it, so it ends early\. Write "She said 'hi' to me", or put a \\ before each one inside: "She said \\"hi\\" to me"\./);
  assert.deepEqual(out.warnings, [], 'the words that fell outside the text aren\'t reported as names');
  problem('show "She said "hi""', /Write "She said 'hi'"/);
  problem('set x to "a" plus "b "c" d"', /Write "b 'c' d"/);
  problem("show 'it's'", /This text has a ' inside it, so it ends early\. Write it in double quotes, "it's", or put a \\ before each ' inside: 'it\\'s'\./);
  // a text that's only missing its end says so, as before
  problem('show "a" and "b', /missing its closing quote mark \("\)/);
});

test('names can have letters beyond A–Z, as in Python 3', () => {
  becomes('set café to 1\nshow café\nincrease café by 1\nshow length of (café as text)\nshow café plus 1',
    'café = 1\nprint(café)\ncafé += 1\nprint(len((str(café))))\nprint(café + 1)');
  becomes('set π to 3.14\nshow π times 2\nset noël to 1\nshow noël', 'π = 3.14\nprint(π * 2)\nnoël = 1\nprint(noël)');   // (noël isn't "no" + ël)
  becomes('set prix café to 1\nshow prix café\nset Größe to 3\nshow "Größe: " plus größe', 'prix_café = 1\nprint(prix_café)\nGröße = 3\nprint("Größe: " + str(Größe))');
  becomes('for each é in [1, 2]\n    show é\nset café, thé to 1, 2\ndefine grüß using wer\n    show wer\nrun grüß with thé', 'for é in [1, 2]:\n    print(é)\ncafé, thé = 1, 2\ndef grüß(wer):\n    print(wer)\ngrüß(thé)');
  assert.match(py('show grüße').warnings.join(' '), /`grüße` hasn't been set anywhere yet/);
  assert.equal(run(py('set café to 2\nincrease café by 1\nshow café times 2').code), '6');
});

test('Python code with names beyond A–Z reads as sentences and comes back exactly', () => {
  const src = 'café = 1\nprint(café)\ncafé += 1\nprint(len(str(café)))\nπ = 3.14\nfor é in [1, 2]:\n    print(é * π)\n';
  const [said] = toSentences([src]);
  const r = L.compileProject({ sections: [{ id: 'main', file: 'main', text: said }] }).results.main;
  assert.deepEqual(JSON.parse(JSON.stringify(r.info.flatMap(i => i.errs))), [], said);
  assert.ok(compareMany([[src, r.text]])[0].same, `${said}\n---\n${r.text}`);
});

test('a name with a symbol in it says which one', () => {
  problem('set a★ to 1', /"a★" can't be a name, because ★ isn't a letter or a number\. Names use letters, numbers and spaces\./);
  problem('set 2nd place to 1', /"2nd place" can't be a name, because names can't start with a number\./);
  problem('set "x" to 1', /"x" can't be a name, because names aren't in quotes\. Write it without them: x\./);
});

test('a sign Python can\'t read outside quotes is a problem, never code that fails when it runs', () => {
  problem('set x to $price', /Python can't read \$ outside quotes\. If it's part of some text, put the text in quotes\./);
  problem('show the dogs’ bowl', /Python can't read ’ outside quotes/);
  problem('set x to 5…', /Python can't read … outside quotes/);
  problem('set x to 5​', /There's an invisible character here \(U\+200B\)/);
});

test('maths signs, fractions, minus and numbers in words are the Python they mean', () => {
  becomes('set a to 5 × 3\nset b to 10 ÷ 4\nset c to 5 − 3\nif a ≤ 5 or b ≥ 2 or c ≠ 1\n    show a', 'a = 5 * 3\nb = 10 / 4\nc = 5 - 3\nif a <= 5 or b >= 2 or c != 1:\n    print(a)', /× is written `\*` in Python\./);
  becomes('set a to ½\nset b to 1½\nset c to 2 ¾\nset d to ⅓\nset e to a times ⅓', 'a = 0.5\nb = 1.5\nc = 2.75\nd = 1 / 3\ne = a * (1 / 3)', /⅓ is written `1 \/ 3` \(it has no exact decimal\)\./);
  becomes('set a to minus 5\nset b to -5\nshow minus a\nshow max(minus 1, minus 2)\nset h to 1/2\nset k to 1e3', 'a = -5\nb = -5\nprint(-a)\nprint(max(-1, -2))\nh = 1/2\nk = 1e3');
  becomes('set a to TRUE\nset b to Yes\nset c to NO\nset d to False', 'a = True\nb = True\nc = False\nd = False');
});

test('a number with a 0 in front, a date, or a time of day says how to write it', () => {
  problem('set lives to 007', /Python can't read 007: a whole number can't start with 0\. Write 7, or put it in quotes \("007"\) to keep the zeros\./);
  problem('set d to 2024-12-25', /2024-12-25 looks like a date, which Python can't take as written \(it would work it out as a sum\)\. Put it in quotes, "2024-12-25", to keep it as text\./);
  problem('set d to 25/12/2024', /looks like a date/);
  problem('set t to 10:30', /10:30 looks like a time, which Python can't take as written\. Put it in quotes, "10:30", to keep it as text\./);
  // a 0 Python reads, a division, a slice and a dictionary are as before
  becomes('set a to 0\nset b to 00\nset c to 05.5\nset r to 16/9\nset xs to [1, 2]\nshow xs[1:2]\nset d to {1:20}', 'a = 0\nb = 00\nc = 05.5\nr = 16/9\nxs = [1, 2]\nprint(xs[1:2])\nd = {1:20}');
});

test('a wait in minutes, hours or milliseconds is worked out in seconds', () => {
  becomes('wait 5 minutes', 'time.sleep(5 * 60)', /`time\.sleep\(\)` counts in seconds, so 5 minutes is written `5 \* 60`\./);
  becomes('wait 1 minute\nwait 2 hours\nwait 500 milliseconds\nwait half a second\nwait a second\nwait 5 seconds', 'time.sleep(60)\ntime.sleep(2 * 60 * 60)\ntime.sleep(0.5)\ntime.sleep(0.5)\ntime.sleep(1)\ntime.sleep(5)');
  becomes('set d to 3\nwait d minutes\nwait d plus 1 minutes', 'd = 3\ntime.sleep(d * 60)\ntime.sleep((d + 1) * 60)');
});

test('a time where a number goes asks for the unit the program counts in', () => {
  const out = problem('set wait time to 5 minutes', /"5 minutes" isn't a value in Python\. Write a plain number in the unit it's counted in: for seconds, 5 times 60\./);
  assert.deepEqual(out.warnings, [], 'minutes isn\'t reported as a name too');
  problem('set delay to 2 seconds', /for seconds, just 2\./);
});

test('a ? ! or , ending the sentence is left out', () => {
  becomes('set x to 3\nif x is 5?\n    show x', 'x = 3\nif x == 5:\n    print(x)', /The \? at the end is left out: Python doesn't need it\./);
  becomes('show "Hi"!\nshow "Really?"', 'print("Hi")\nprint("Really?")');
  becomes('set x to 5,', 'x = 5', /The , at the end is left out \(in Python it would make the value a group of one\)\./);
});

test('names that are Python\'s own words or tools are still asked about', () => {
  problem('set class to 1', /"class" is one of Python's own words, so it can't be a name/);
  problem('set yes to 1', /"yes" is a word sentences read as `True`/);
  assert.match(py('set print to 1').warnings.join(' '), /`print` is already a built-in Python tool/);
});

test('a list sentence whose items have no spaces between them is asked about', () => {
  problem('create list xs with 1,000', /In a list, "1,000" could be one number \(1000\) or 2 items\. Write 1000 for the number, or put a space after each comma between items\./);
  problem('create list xs with 100,200,300', /could be one number \(100200300\) or 3 items/);
});

test('a decimal comma (1,5) is asked about: the decimal, or two values', () => {
  problem('set x to 1,5', /"1,5" could be the decimal 1\.5 or two values, 1 and 5\. Write 1\.5 for the decimal, or put a space after the comma for two values: 1, 5\./);
  problem('show 1,2', /could be the decimal 1\.2 or two values/);
  problem('show 1, 2,5', /"2,5" could be the decimal 2\.5/);
  becomes('set xs to [1,5]', 'xs = [1,5]');   // (Python's own list)
});

test('values side by side are a problem, and say to use quotes for text', () => {
  problem('show Hello world', /"Hello world" is two values side by side, which Python can't read\. If it's text, put it in quotes; otherwise join the values with a word like plus or times\./);
  problem('set a to 1\nset b to 2\nshow a b', /"a b" is two values side by side/);
  problem('set x to 5 apples', /"5 apples" is two values side by side/);
  problem('show "Score:" 5', /"Score:" 5 is two values side by side/);
  problem("set name to Sam's", /Python can't read ' outside quotes/);
  // text next to text is one text in Python, and Python's own words go between values
  becomes('show "a" "b"\nset n to 3\nshow n if n is more than 1 otherwise 0\nshow n is not None', 'print("a" "b")\nn = 3\nprint(n if n > 1 else 0)\nprint(n is not None)');
});

test('powers written 2^3 or x², and numbers in words, are the Python they mean', () => {
  becomes('set a to 2^3\nset b to a^2\nset c to 3²\nset d to a³', 'a = 2 ** 3\nb = a ** 2\nc = 3 ** 2\nd = a ** 3', /A power is written `\*\*` in Python, so 2\^3 is 2 \*\* 3\./);
  // a ^ between names is Python's own (it compares bits); between numbers, that's pointed out
  becomes('set a to 6\nset b to 3\nset x to a ^ b', 'a = 6\nb = 3\nx = a ^ b');
  assert.match(py('set x to 2 ^ 3').warnings.join(' '), /In Python \^ compares bits, so 2 \^ 3 is 1, not a power\. For a power, write 2 to the power of 3\./);
  becomes('set a to a hundred\nset b to 1.5 million\nset c to 2 billion\nset d to three hundred\nset e to 1.1 million', 'a = 100\nb = 1500000\nc = 2000000000\nd = 300\ne = 1100000');
  becomes('set a to 5 dollars\nset b to null\nset c to 5 – 3', 'a = 5\nb = None\nc = 5 - 3');
  problem('set v to 1.5.2', /1\.5\.2 isn't a number Python can read: it has more than one point\. If it's a version or other text, put it in quotes: "1\.5\.2"\./);
});

test('"is between" counts both ends', () => {
  becomes('set n to 3\nif n is between 1 and 5\n    show n\nif n is not between 1 and 5\n    show n\nif n plus 1 is between n minus 1 and n plus 2\n    show n',
    'n = 3\nif 1 <= n <= 5:\n    print(n)\nif not 1 <= n <= 5:\n    print(n)\nif n - 1 <= n + 1 <= n + 2:\n    print(n)', /`a <= n <= b` checks that n is between a and b, counting a and b themselves\./);
  assert.equal(run(py('set n to 5\nshow n is between 1 and 5, n is between 6 and 9').code), 'True False');
});

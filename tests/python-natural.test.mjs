// What people naturally type that Python can't take as written: each becomes Python in the form Python
// needs, with a note saying what it became, or a problem that says the fix. Never code that looks fine and isn't.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { loadEngine, PYTHON } from './helpers/engine.mjs';

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
  becomes('show 1, 2\nshow 1,2\ncreate list ys with 1, 2', 'print(1, 2)\nprint(1, 2)\nys = [1, 2]');
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

test('a list sentence whose items have no spaces between them is asked about', () => {
  problem('create list xs with 1,000', /In a list, "1,000" could be one number \(1000\) or 2 items\. Write 1000 for the number, or put a space after each comma between items\./);
  problem('create list xs with 100,200,300', /could be one number \(100200300\) or 3 items/);
});

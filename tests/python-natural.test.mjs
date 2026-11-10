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

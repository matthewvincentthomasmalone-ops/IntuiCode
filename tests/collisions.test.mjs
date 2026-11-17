// Rules that read the same sentence (tests/helpers/collisions.mjs): every pair has a reason the first is right
// (tests/helpers/collisions_known.mjs), or the test says which pair is new. ROADMAP.md, Known risks 1: move to a
// proper grammar if collisions keep appearing. A clash is a pair whose winner is wrong; none are, today.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConverter, loadEngine } from './helpers/engine.mjs';
import { pythonOverlaps, jsOverlaps } from './helpers/collisions.mjs';
import { KNOWN_PYTHON, KNOWN_JS, unexplained } from './helpers/collisions_known.mjs';

const { convert, WEB } = await loadConverter();
const { L } = loadEngine();

for (const [name, found, known, where] of [
  ['Python', pythonOverlaps(L), KNOWN_PYTHON, 'KNOWN_PYTHON'],
  ['JavaScript', jsOverlaps(WEB, convert), KNOWN_JS, 'KNOWN_JS'],
]) {
  test(`collisions, ${name}: every pair of rules that read the same sentence is one tried first on purpose`, () => {
    assert.ok(found.size > 0, 'the check found the sentences to try');
    const { newPairs, stale } = unexplained(found, known);
    assert.deepEqual(newPairs.map(p => `${p}: "${found.get(p)[0]}"`), [], `two rules read these sentences, and the first wins. If it should, add the pair to ${where} in tests/helpers/collisions_known.mjs with why; if not, the rules clash`);
    assert.deepEqual(stale, [], `no pair like these happens now: take them out of ${where}`);
  });
}

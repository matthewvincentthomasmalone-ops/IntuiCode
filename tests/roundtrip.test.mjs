import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadEngine, roundTrip, pyFiles, toSentences, compareMany, ROOT } from './helpers/engine.mjs';

const { L } = loadEngine();
const files = [...pyFiles(path.join(ROOT, 'samples')), ...pyFiles(path.join(ROOT, 'tests/corpus')), ...pyFiles(path.join(ROOT, 'tests/heldout'))];

for (const r of roundTrip(L, files)) {
  test(`sentences rebuild exactly the same program: ${r.file}`, () => {
    assert.deepEqual([...r.errors], [], 'the sentences should translate without errors');
    assert.ok(r.same, `differs at lines ${JSON.stringify(r.differs)}\n${r.sentences}`);
  });
}

/* Docstrings are help text Python keeps (__doc__, help(), docopt, doctests): they come back exactly. */
const DOCSTRINGS = [
  ['a class with only a docstring', 'class NotFound(Exception):\n    """Raised when a thing is missing."""\n', /^    description: Raised when a thing is missing\.$/m],
  ['a docstring over several lines', 'def total(prices):\n    """Add up the prices.\n\n    Items without a price count as 0.\n    """\n    return sum(prices)\n', /^    description: Add up the prices\.\n    description:\n    description: Items without a price count as 0\.\n    description:\n    give back sum of prices$/m],
  ['a module docstring', '"""Usage:\n    tool.py <file>\n"""\nimport sys\n', /^description: Usage:\ndescription:     tool\.py <file>\ndescription:$/m],
  ['a tool kept as python: lines, with a docstring', 'def f(item):\n    """Doc with Args:\n\n    Args:\n        item: the thing\n    """\n    return item\n', /^    python:         item: the thing$/m],
  ['a docstring the sentences can\'t hold', 'def g():\n    r"""Raw \\d and\ttab """\n    return 1\n', /^    python: 'Raw \\\\d and\\ttab '$/m],
  // "add … to …" / "remove … from …" with those words in the value: kept as python:
  ['a value that says "to" or "from"', 'import random\nnums = []\nnums.append(random.randint(1, 6))\nnums.remove(random.choice(nums))\nnames = []\nnames.append("Walk to the shop")\n', /^python: nums\.append\(random\.randint\(1, 6\)\)\npython: nums\.remove\(random\.choice\(nums\)\)$/m],
];
test('docstrings and tricky values come back exactly', () => {
  const sents = toSentences(DOCSTRINGS.map(d => d[1]));
  const gen = sents.map(t => L.compileProject({ sections: [{ id: 'main', file: 'main', text: t }] }).results.main);
  const checks = compareMany(DOCSTRINGS.map((d, i) => [d[1], gen[i].text]));
  DOCSTRINGS.forEach(([label, , re], i) => {
    assert.deepEqual(JSON.parse(JSON.stringify(gen[i].info.flatMap(x => x.errs))), [], label);
    assert.ok(checks[i].same, `${label}: ${JSON.stringify(checks[i])}\n${sents[i]}\n---\n${gen[i].text}`);
    assert.match(sents[i], re, label);
  });
  assert.match(sents[5], /^add "Walk to the shop" to names$/m);
});

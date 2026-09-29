import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadEngine, roundTrip, pyFiles, ROOT } from './helpers/engine.mjs';

const { L } = loadEngine();
const files = [...pyFiles(path.join(ROOT, 'samples')), ...pyFiles(path.join(ROOT, 'tests/corpus'))];

for (const r of roundTrip(L, files)) {
  test(`sentences rebuild exactly the same program: ${r.file}`, () => {
    assert.deepEqual([...r.errors], [], 'the sentences should translate without errors');
    assert.ok(r.same, `differs at lines ${JSON.stringify(r.differs)}\n${r.sentences}`);
  });
}

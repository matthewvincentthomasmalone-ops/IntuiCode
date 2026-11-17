// IntuaCode guesses nothing: every summary comes from a rule, and the app calls no AI model. Any AI feature added
// later must be opt-in and labelled as a guess (ROADMAP.md, Known risks 3), so this fails when code starts
// calling one, as a reminder to do that. (The readers' words for code that calls one, "calls an AI model", and the
// Library's examples of what a project might do, aren't calls.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers/engine.mjs';

const CALLS = /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.mistral\.ai|api\.cohere\.(?:ai|com)|from ['"](?:openai|@anthropic-ai\/sdk|@google\/generative-ai)['"]|require\(['"](?:openai|@anthropic-ai\/sdk)['"]\)|^\s*(?:import|from) (?:openai|anthropic)\b/m;

test('the app calls no AI model', () => {
  const files = execFileSync('git', ['ls-files', '*.js', '*.mjs', '*.ts', '*.tsx', '*.py', '*.rs', '*.html'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(f => f && !/^(?:tests|samples|lang\/library|lang\/kits|node_modules|dist)\//.test(f) && !/(?:^|\/)vendor\//.test(f));
  assert.ok(files.length > 20, 'the app\'s files were found');
  const calling = files.filter(f => CALLS.test(readFileSync(path.join(ROOT, f), 'utf8')));
  assert.deepEqual(calling, [], 'these call an AI model: make the feature opt-in, label what it gives as a guess, and update ROADMAP.md');
});

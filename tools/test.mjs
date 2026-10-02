// npm test: the Python reader's tests, then the translator, blueprint and round-trip tests (Node).
// Uses python3, or on Windows python / py (see PYTHON in tests/helpers/engine.mjs).
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PYTHON } from '../tests/helpers/engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' }).status;
// the files are listed here: Node before 21 (Ubuntu 24.04 has 18) doesn't expand tests/*.test.mjs itself
const nodeTests = readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.test.mjs')).sort().map(f => path.join('tests', f));
const failed = run(PYTHON, ['-m', 'unittest', 'discover', '-s', 'tests', '-v']) || run(process.execPath, ['--test', ...nodeTests]);
process.exit(failed ? 1 : 0);

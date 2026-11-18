// npm test: the Python reader's tests, then the translator, blueprint and round-trip tests (Node).
// Uses python3, or on Windows python / py (see PYTHON in tests/helpers/engine.mjs).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PYTHON } from '../tests/helpers/engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Every temp folder the tests make (Python's, Node's, Chrome's) goes in one of this run's, which goes when it
// ends: some tests' programs make their own and leave them, and over many runs they slowed the computer down.
const scratch = mkdtempSync(path.join(os.tmpdir(), 'intuicode-test-'));
const env = { ...process.env, TMPDIR: scratch, TEMP: scratch, TMP: scratch };
const run = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env }).status;
// the files are listed here: Node before 21 (Ubuntu 24.04 has 18) doesn't expand tests/*.test.mjs itself
const nodeTests = readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.test.mjs')).sort().map(f => path.join('tests', f));
const failed = run(PYTHON, ['-m', 'unittest', 'discover', '-s', 'tests', '-v']) || run(process.execPath, ['--test', ...nodeTests]);
try { rmSync(scratch, { recursive: true, force: true, maxRetries: 5 }); }
catch (e) { console.warn(`couldn't remove ${scratch}: ${e.message}`); }
process.exit(failed ? 1 : 0);

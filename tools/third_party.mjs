// Writes THIRD-PARTY-NOTICES.md: the parts made by others that ship inside IntuaCode, and their licences.
//   node tools/third_party.mjs
// Run it again when a bundled part changes (Pyodide, the tree-sitter parsers, the fonts, the Rust crates in
// src-tauri/Cargo.lock). It needs cargo, for the list of crates.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const out = [];
const line = (s = '') => out.push(s);

line('# Third-party notices');
line();
line('IntuaCode is licensed under the Business Source License 1.1 (see LICENSE). It ships with parts made by others,');
line('which keep their own licences. They are listed here, with where each comes from.');
line();

line('## In the app (web and desktop)');
line();
const py = existsSync(path.join(ROOT, 'pyodide/pyodide-lock.json')) ? json('pyodide/pyodide-lock.json').info.version : '(not fetched)';
const wts = json('node_modules/web-tree-sitter/package.json');
const tsw = json('node_modules/tree-sitter-wasms/package.json');
line('| Part | Version | Licence | Source |');
line('|---|---|---|---|');
line(`| Pyodide (Python in the page) | ${py} | MPL-2.0; includes CPython, under the Python Software Foundation License | https://github.com/pyodide/pyodide |`);
line(`| web-tree-sitter (the code reader's parser) | ${wts.version} | ${wts.license} | https://github.com/tree-sitter/tree-sitter |`);
line(`| tree-sitter-wasms (the parsers, built) | ${tsw.version} | ${tsw.license}; the grammars in it are MIT | https://github.com/Gregoor/tree-sitter-wasms |`);
line('| tree-sitter grammars: C++, CSS, HTML, JavaScript, TypeScript, TSX | as bundled | MIT | https://github.com/tree-sitter |');
for (const f of readdirSync(path.join(ROOT, 'fonts')).filter(f => /^OFL-.*\.txt$/.test(f))) {
  const name = f.replace(/^OFL-|\.txt$/g, '').replace(/-/g, ' ');
  line(`| ${name} (font) | as bundled | SIL Open Font License 1.1 (full text: fonts/${f}) | fonts/${f} |`);
}
line();

line('## In the desktop app (Rust crates)');
line();
line('The desktop app is built with Tauri. These crates are in its build (from src-tauri/Cargo.lock); each of Windows,');
line('macOS and Linux uses some of them. Each one\'s copyright holders are named in its own source, at the address given.');
line('Where a crate offers a choice of licences ("MIT OR Apache-2.0"), it may be used under either.');
line();
const meta = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--locked', '--manifest-path', path.join(ROOT, 'src-tauri', 'Cargo.toml')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const byId = new Map(meta.packages.map(p => [p.id, p]));
const own = meta.resolve.root;
const seen = new Set(), stack = [own];
const nodes = new Map(meta.resolve.nodes.map(n => [n.id, n]));
while (stack.length) {
  const id = stack.pop();
  if (seen.has(id)) continue;
  seen.add(id);
  for (const d of (nodes.get(id) || { deps: [] }).deps) if (d.dep_kinds.some(k => k.kind !== 'dev' && k.kind !== 'build')) stack.push(d.pkg);
}
seen.delete(own);
const crates = [...seen].map(id => byId.get(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const licences = new Map();
line('| Crate | Version | Licence | Source |');
line('|---|---|---|---|');
for (const c of crates) {
  const lic = c.license || (c.license_file ? `see ${c.license_file}` : 'not stated');
  for (const id of lic.split(/\s+(?:OR|AND|WITH)\s+|[()/]/).map(s => s.trim()).filter(s => /^[A-Za-z]/.test(s))) licences.set(id, (licences.get(id) || 0) + 1);
  line(`| ${c.name} | ${c.version} | ${lic} | ${c.repository || `https://crates.io/crates/${c.name}`} |`);
}
line();
line(`${crates.length} crates. Their licences: ${[...licences].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} (${n})`).join(', ')}.`);
line();

line('## Licence texts');
line();
line('The MIT licence, as used by web-tree-sitter (copyright (c) 2018-2024 Max Brunsfeld) and by many of the parts above:');
line();
line('```');
line(read('node_modules/web-tree-sitter/LICENSE').trim());
line('```');
line();
line('The Apache License 2.0, MPL-2.0 and the Python Software Foundation License are long: their full texts are at');
line('https://www.apache.org/licenses/LICENSE-2.0, https://www.mozilla.org/MPL/2.0/ and https://docs.python.org/3/license.html.');
line('The SIL Open Font License is in full beside each font, in fonts/.');
line();

writeFileSync(path.join(ROOT, 'THIRD-PARTY-NOTICES.md'), out.join('\n'));
console.log(`Wrote THIRD-PARTY-NOTICES.md: ${crates.length} crates, ${readdirSync(path.join(ROOT, 'fonts')).filter(f => /^OFL-/.test(f)).length} fonts.`);

// Copy the tree-sitter runtime and grammars from node_modules into vendor/tree-sitter,
// so the app can read code without the internet: JavaScript, HTML, CSS and C++, and every other
// language in lang/languages.js whose grammar the runtime can use (see UNUSABLE in lang/code_read.js).
//   npm install && npm run vendor
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(ROOT, 'vendor/tree-sitter');
mkdirSync(out, { recursive: true });
copyFileSync(path.join(ROOT, 'node_modules/web-tree-sitter/tree-sitter.wasm'), path.join(out, 'tree-sitter.wasm'));
// the runtime, with the fix for unknown HTML tags (see lang/ts_patch.js)
vm.runInThisContext(readFileSync(path.join(ROOT, 'lang/ts_patch.js'), 'utf8'));
writeFileSync(path.join(out, 'tree-sitter.js'), globalThis.IntuiTsPatch.patch(readFileSync(path.join(ROOT, 'node_modules/web-tree-sitter/tree-sitter.js'), 'utf8')));
for (const f of ['lang/languages.js', 'lang/code_read.js']) vm.runInThisContext(readFileSync(path.join(ROOT, f), 'utf8'));
const unusable = globalThis.IntuiCodeReader.UNUSABLE;
const grammars = new Set(['javascript', 'typescript', 'tsx', 'html', 'css', 'cpp']);
for (const l of globalThis.IntuiLanguages.LANGUAGES) if (l.grammar && !unusable[l.id]) grammars.add(l.grammar);
for (const g of grammars) {
  const f = `tree-sitter-${g}.wasm`;
  copyFileSync(path.join(ROOT, 'node_modules/tree-sitter-wasms/out', f), path.join(out, f));
}
console.log('Copied tree-sitter into', path.relative(ROOT, out));

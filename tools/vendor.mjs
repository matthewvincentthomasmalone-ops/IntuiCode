// Copy the tree-sitter runtime and grammars from node_modules into vendor/tree-sitter,
// so the app can read JavaScript, HTML, CSS and C++ without the internet.
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
for (const g of ['javascript', 'typescript', 'tsx', 'html', 'css', 'cpp']) {
  const f = `tree-sitter-${g}.wasm`;
  copyFileSync(path.join(ROOT, 'node_modules/tree-sitter-wasms/out', f), path.join(out, f));
}
console.log('Copied tree-sitter into', path.relative(ROOT, out));

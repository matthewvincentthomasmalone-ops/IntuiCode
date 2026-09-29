// Copy the tree-sitter runtime and grammars from node_modules into vendor/tree-sitter,
// so the app can read JavaScript, HTML, CSS and C++ without the internet.
//   npm install && npm run vendor
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(ROOT, 'vendor/tree-sitter');
mkdirSync(out, { recursive: true });
for (const f of ['tree-sitter.js', 'tree-sitter.wasm']) copyFileSync(path.join(ROOT, 'node_modules/web-tree-sitter', f), path.join(out, f));
for (const g of ['javascript', 'typescript', 'tsx', 'html', 'css', 'cpp']) {
  const f = `tree-sitter-${g}.wasm`;
  copyFileSync(path.join(ROOT, 'node_modules/tree-sitter-wasms/out', f), path.join(out, f));
}
console.log('Copied tree-sitter into', path.relative(ROOT, out));

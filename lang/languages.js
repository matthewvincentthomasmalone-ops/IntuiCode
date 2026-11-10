/* IntuaCode — the languages a project's files can be in.
 *
 * One list for the whole app: the file tree (every file has a language), Read mode (which grammar reads
 * it), the Library (which language a part's code is in) and the Index.
 *
 *   id        the name used everywhere in IntuaCode
 *   name      what people call it
 *   exts      file endings, the usual one first
 *   grammar   the tree-sitter grammar that reads it (tree-sitter-<grammar>.wasm), if there is one
 *   write     how a file in it is written:
 *               sentences  you write sentences and IntuaCode writes the code (and reads code back into sentences)
 *               code       you write the code itself, and IntuaCode reads it to you in plain words
 *               text       notes and data (Markdown, CSV…): written as they are
 *   comment   how a line becomes a note in that language
 *   family    where it's used, for grouping in lists
 */
(function (root) {
  'use strict';

  const L = (id, name, exts, grammar, write, comment, family) => ({ id, name, exts, grammar, write, comment, family });
  const LANGUAGES = [
    // written in sentences
    L('python', 'Python', ['py', 'pyw'], 'python', 'sentences', '#', 'scripting'),
    L('html', 'HTML', ['html', 'htm'], 'html', 'sentences', '<!--', 'web'),
    L('css', 'CSS', ['css'], 'css', 'sentences', '/*', 'web'),
    L('js', 'JavaScript', ['js', 'mjs', 'cjs', 'jsx'], 'javascript', 'sentences', '//', 'web'),
    L('cpp', 'C++', ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx', 'h'], 'cpp', 'sentences', '//', 'systems'),
    L('arduino', 'Arduino', ['ino'], 'cpp', 'sentences', '//', 'hardware'),
    L('ts', 'TypeScript', ['ts', 'mts', 'cts'], 'typescript', 'sentences', '//', 'web'),
    L('tsx', 'TypeScript with JSX (React)', ['tsx'], 'tsx', 'sentences', '//', 'web'),
    // written as code, read in plain words
    L('vue', 'Vue component', ['vue'], 'vue', 'code', '<!--', 'web'),
    L('php', 'PHP', ['php'], 'php', 'code', '//', 'web'),
    L('ruby', 'Ruby', ['rb', 'rake', 'gemspec'], 'ruby', 'code', '#', 'web'),
    L('erb', 'Embedded templates (ERB, EJS)', ['erb', 'ejs'], 'embedded_template', 'code', '<%#', 'web'),
    L('c', 'C', ['c'], 'c', 'code', '//', 'systems'),
    L('rust', 'Rust', ['rs'], 'rust', 'code', '//', 'systems'),
    L('go', 'Go', ['go'], 'go', 'code', '//', 'systems'),
    L('zig', 'Zig', ['zig'], 'zig', 'code', '//', 'systems'),
    L('csharp', 'C#', ['cs', 'csx'], 'c_sharp', 'code', '//', 'apps'),
    L('java', 'Java', ['java'], 'java', 'code', '//', 'apps'),
    L('kotlin', 'Kotlin', ['kt', 'kts'], 'kotlin', 'code', '//', 'apps'),
    L('swift', 'Swift', ['swift'], 'swift', 'code', '//', 'apps'),
    L('objc', 'Objective-C', ['m', 'mm'], 'objc', 'code', '//', 'apps'),
    L('dart', 'Dart (Flutter)', ['dart'], 'dart', 'code', '//', 'apps'),
    L('scala', 'Scala', ['scala', 'sc'], 'scala', 'code', '//', 'apps'),
    L('lua', 'Lua', ['lua'], 'lua', 'code', '--', 'scripting'),
    L('bash', 'Shell (Bash)', ['sh', 'bash', 'zsh'], 'bash', 'code', '#', 'scripting'),
    L('elixir', 'Elixir', ['ex', 'exs'], 'elixir', 'code', '#', 'scripting'),
    L('elisp', 'Emacs Lisp', ['el'], 'elisp', 'code', ';', 'scripting'),
    L('ocaml', 'OCaml', ['ml', 'mli'], 'ocaml', 'code', '(*', 'functional'),
    L('elm', 'Elm', ['elm'], 'elm', 'code', '--', 'functional'),
    L('rescript', 'ReScript', ['res', 'resi'], 'rescript', 'code', '//', 'functional'),
    L('solidity', 'Solidity', ['sol'], 'solidity', 'code', '//', 'other'),
    L('ql', 'CodeQL', ['ql', 'qll'], 'ql', 'code', '//', 'other'),
    L('tlaplus', 'TLA+', ['tla'], 'tlaplus', 'code', '\\*', 'other'),
    L('systemrdl', 'SystemRDL', ['rdl'], 'systemrdl', 'code', '//', 'hardware'),
    L('sql', 'SQL', ['sql'], null, 'code', '--', 'data'),
    // notes and data
    L('json', 'JSON', ['json'], 'json', 'text', null, 'data'),
    L('yaml', 'YAML', ['yaml', 'yml'], 'yaml', 'text', '#', 'data'),
    L('toml', 'TOML', ['toml'], 'toml', 'text', '#', 'data'),
    L('csv', 'CSV (a table)', ['csv'], null, 'text', null, 'data'),
    L('markdown', 'Markdown', ['md', 'markdown'], null, 'text', null, 'docs'),
    L('text', 'Plain text', ['txt'], null, 'text', null, 'docs'),
  ];
  const FAMILIES = { web: 'Web', systems: 'Systems and speed', apps: 'Apps (desktop and phone)', scripting: 'Scripting', hardware: 'Hardware', functional: 'Functional', data: 'Data and settings', docs: 'Notes and documents', other: 'Other' };

  const BY_ID = Object.fromEntries(LANGUAGES.map(l => [l.id, l]));
  const BY_EXT = {};
  for (const l of LANGUAGES) for (const e of l.exts) if (!BY_EXT[e]) BY_EXT[e] = l.id;   // the first claim wins: .h is C++

  /* The language a file name points to ('text' when nothing does). */
  function fromPath(path) {
    const ext = (String(path).match(/\.([A-Za-z0-9]+)$/) || [])[1];
    return (ext && BY_EXT[ext.toLowerCase()]) || 'text';
  }
  /* The usual file ending for a language. */
  const extOf = (id) => (BY_ID[id] ? BY_ID[id].exts[0] : 'txt');

  root.IntuiLanguages = { LANGUAGES, FAMILIES, byId: (id) => BY_ID[id] || null, fromPath, extOf };
})(typeof window !== 'undefined' ? window : globalThis);

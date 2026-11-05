/* IntuaCode — code reader: Read mode for every language in lang/languages.js.
 *
 * Python, HTML, CSS, JavaScript/TypeScript/React and C++/Arduino have their own readers (python_reader.py
 * and web_read.js), which also turn code into sentences. This reader covers the rest: for each file it
 * finds the parts (tools, classes and types, imports, settings, tests, starting points), says what each
 * one does in plain English, lists facts (loops, decisions, errors, calls to other tools in the file…)
 * and things worth checking, and gives plain steps for function bodies. Rules only, no AI.
 *
 *   detect(path, source)              -> { lang, confidence: 'certain' | 'likely' | 'guess', why }
 *   detectAndLoad(path, source)       the same, after loading the grammars that break a tie (async)
 *   readerFor(lang)                   'python' | 'web' | 'code': which reader the app should use
 *   needs(lang) / load(lang)          the grammar keys for IntuiWebReader.loadLangs / load them (async)
 *   analyze(lang, path, source)       -> { ok, error, overview, sections, lines, imports, libs },
 *                                        sections as in IntuiWebReader.analyzeCpp's result
 *   languages()                       every language, how deeply it is read, and why if without a grammar
 *
 *   const WR = await IntuiRunner.webReader();            // tree-sitter started (IntuiWebReader.init)
 *   const d = await IntuiCodeReader.detectAndLoad(path, source);
 *   const lang = picked || d.lang;                       // the person's choice wins
 *   if (IntuiCodeReader.readerFor(lang) === 'code') {
 *     await IntuiCodeReader.load(lang);
 *     const a = IntuiCodeReader.analyze(lang, path, source);
 *   }
 *
 * Grammars come from tree-sitter through IntuiWebReader (parse, loadLangs, hasLang); lang/languages.js
 * must be loaded first. Four of the installed grammars can't be used with this runtime (see UNUSABLE),
 * so those languages, and SQL, Markdown, CSV and plain text, are read without one. If a grammar isn't
 * loaded, analyze() still gives a rough outline. No DOM: works in the browser and in Node (for tests).
 */
(function (root) {
  'use strict';

  const LANGS = () => root.IntuiLanguages;
  const WR = () => root.IntuiWebReader;

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  const code = (s) => '`' + String(s).replace(/`/g, "'") + '`';
  function plainList(items, limit = 6) {
    items = [...items];
    if (!items.length) return '';
    const more = items.length - limit;
    items = items.slice(0, limit);
    const text = items.length === 1 ? items[0] : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
    return text + (more > 0 ? ` (and ${more} more)` : '');
  }
  const add = (list, item) => { if (item && !list.includes(item)) list.push(item); };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const flat = (s) => String(s).replace(/\s+/g, ' ').trim();
  const short = (s, n = 70) => { s = flat(s); return s.length > n ? s.slice(0, n - 3) + '…' : s; };
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
  const unquote = (s) => String(s).replace(/^(@|[rbuf]{0,2})?(["'`])([\s\S]*)\2$/, '$3');
  const SECRET = /(api_?key|secret|token|password|passwd|private_?key|access_?key|webhook)/i;

  // tree helpers (tree-sitter nodes)
  const field = (n, f) => (n ? n.childForFieldName(f) : null);
  const line = (n) => n.startPosition.row + 1;
  const endLine = (n) => { const e = n.endPosition; return e.column === 0 && e.row > n.startPosition.row ? e.row : e.row + 1; };
  const named = (n) => (n ? n.namedChildren : []);
  // the runtime makes a new object each time it hands out a node, so nodes are compared by id
  const same = (a, b) => !!a && !!b && a.id === b.id;
  const diff = (a, b) => !same(a, b);
  function* walk(node) {
    yield node;
    for (let i = 0; i < node.namedChildCount; i++) yield* walk(node.namedChild(i));
  }
  const isComment = (n) => /comment/.test(n.type);
  /* The keyword-like tokens of a node (its unnamed children), e.g. ['pub', 'fn'] or ['class']. */
  const tokens = (n) => { const out = []; for (let i = 0; i < n.childCount; i++) { const c = n.child(i); if (!c.isNamed()) out.push(c.type); } return out; };
  /* The text of a node's first line, up to its body. */
  const header = (n) => flat(n.text.split('\n')[0].replace(/\{.*$/, ''));

  /* ------------------------------------------------------------------ */
  /* Which reader, which grammar                                         */
  /* ------------------------------------------------------------------ */

  // languages with their own readers (and sentences): the app uses those; analyze() still answers for them
  const OWN_READER = { python: 'python', html: 'web', css: 'web', js: 'web', ts: 'web', tsx: 'web', cpp: 'web', arduino: 'web' };
  const SENTENCES = new Set(['python', 'html', 'css', 'js', 'cpp', 'arduino']);
  // installed grammars that can't be used with this tree-sitter runtime (web-tree-sitter 0.20.8), and why
  const UNUSABLE = {
    dart: 'it was built for a newer tree-sitter (language version 15; the runtime takes 13 and 14)',
    elm: 'it was built for an older tree-sitter (language version 12)',
    ql: 'it was built for an older tree-sitter (language version 10)',
    lua: 'its scanner stops the whole program on an unfinished [[ long string, and its parses go wrong after other grammars have run',
  };

  const nameOf = (lang) => { const l = LANGS() && LANGS().byId(lang); return l ? l.name.replace(/ \(.*\)$/, '') : lang; };
  function grammarKeys(lang) {
    const l = LANGS() && LANGS().byId(lang);
    if (!l || !l.grammar || UNUSABLE[lang]) return [];
    if (lang === 'vue') return ['vue', 'js', 'ts'];
    return [lang];
  }
  const hasGrammar = (lang) => { const w = WR(); return !!(w && w.hasLang && grammarKeys(lang).length && w.hasLang(lang)); };
  /* Several of these grammars' scanners misbehave when the text ends without a newline (ReScript loops for
   * ever on a comment at the very end; Lua's keeps a half-finished state for the next file), so every parse
   * gets one. Line numbers are unchanged. */
  const parseSafe = (lang, text) => WR().parse(lang, /\n$/.test(text) ? text : text + '\n');

  /* ------------------------------------------------------------------ */
  /* Detection                                                           */
  /* ------------------------------------------------------------------ */

  const CAP = 12000;     // detection looks at most at this much of the text
  // file names with no telling ending
  const NAMES = {
    gemfile: 'ruby', rakefile: 'ruby', podfile: 'ruby', vagrantfile: 'ruby', brewfile: 'ruby', guardfile: 'ruby', fastfile: 'ruby', appfile: 'ruby', 'config.ru': 'ruby',
    '.bashrc': 'bash', '.bash_profile': 'bash', '.bash_aliases': 'bash', '.bash_logout': 'bash', '.zshrc': 'bash', '.zprofile': 'bash', '.zshenv': 'bash', '.profile': 'bash', pkgbuild: 'bash', apkbuild: 'bash',
    'cargo.lock': 'toml', 'poetry.lock': 'toml', 'pipfile': 'toml', 'pdm.lock': 'toml', 'uv.lock': 'toml',
    '.babelrc': 'json', '.eslintrc': 'json', '.prettierrc': 'json', '.jshintrc': 'json', 'composer.lock': 'json', 'flake.lock': 'json', '.swcrc': 'json',
    '.clang-format': 'yaml', '.clang-tidy': 'yaml', '.yamllint': 'yaml',
    readme: 'markdown', changelog: 'markdown', contributing: 'markdown',
    makefile: 'text', gnumakefile: 'text', dockerfile: 'text', containerfile: 'text', jenkinsfile: 'text', justfile: 'text', procfile: 'text', license: 'text', licence: 'text', copying: 'text', authors: 'text',
    '.gitignore': 'text', '.gitattributes': 'text', '.dockerignore': 'text', '.editorconfig': 'text', '.env': 'text', '.npmrc': 'text', 'go.mod': 'text', 'go.sum': 'text', 'requirements.txt': 'text', 'cmakelists.txt': 'text',
  };
  // endings lang/languages.js doesn't list
  const EXTS = {
    jsonc: 'json', json5: 'json', geojson: 'json', webmanifest: 'json', ipynb: 'json', har: 'json', jsonl: 'json', ndjson: 'json',
    mdx: 'markdown', mkd: 'markdown', mdown: 'markdown', tsv: 'csv', tab: 'csv', psv: 'csv',
    ksh: 'bash', bats: 'bash', command: 'bash', ebuild: 'bash',
    ipp: 'cpp', tpp: 'cpp', inl: 'cpp', cu: 'cpp', cuh: 'cpp', 'c++': 'cpp', 'h++': 'cpp',
    sbt: 'scala', eex: 'erb', heex: 'erb', leex: 'erb', rhtml: 'erb', jbuilder: 'ruby', ru: 'ruby', thor: 'ruby', podspec: 'ruby',
    phtml: 'php', php3: 'php', php4: 'php', php5: 'php', php7: 'php', php8: 'php', phps: 'php', mll: 'ocaml', mly: 'ocaml', zon: 'zig',
    jsx: 'js', text: 'text', log: 'text',
  };
  // endings of languages IntuaCode can't read yet: shown as plain text, and the reason is given
  const NOT_YET = {
    pl: 'Perl', pm: 'Perl', r: 'R', jl: 'Julia', hs: 'Haskell', lhs: 'Haskell', fs: 'F#', fsx: 'F#', clj: 'Clojure', cljs: 'ClojureScript', groovy: 'Groovy', gradle: 'Gradle (Groovy)',
    ps1: 'PowerShell', psm1: 'PowerShell', bat: 'Windows batch', cmd: 'Windows batch', vb: 'Visual Basic', f90: 'Fortran', f: 'Fortran', pas: 'Pascal', asm: 'assembly', s: 'assembly',
    v: 'Verilog', sv: 'SystemVerilog', vhd: 'VHDL', vhdl: 'VHDL', nim: 'Nim', cr: 'Crystal', d: 'D', hx: 'Haxe', erl: 'Erlang', svelte: 'Svelte', astro: 'Astro',
    xml: 'XML', svg: 'SVG (XML)', plist: 'property list (XML)', xaml: 'XAML', ini: 'INI settings', cfg: 'settings', conf: 'settings', properties: 'Java properties', rst: 'reStructuredText', tex: 'LaTeX', proto: 'Protocol Buffers', graphql: 'GraphQL', gql: 'GraphQL', tf: 'Terraform', hcl: 'HCL', nix: 'Nix', cmake: 'CMake', mk: 'Makefile',
  };
  const SHEBANG = [
    [/^(ba|z|k|da|a)?sh$/, 'bash'], [/^python(\d(\.\d+)?)?$|^pypy\d?$/, 'python'], [/^node(js)?$|^bun$/, 'js'], [/^(deno|ts-node|tsx)$/, 'ts'], [/^ruby$|^jruby$/, 'ruby'],
    [/^php(\d)?$/, 'php'], [/^lua(jit|\d(\.\d)?)?$/, 'lua'], [/^elixir$/, 'elixir'], [/^swift$/, 'swift'], [/^(kotlin|kotlinc|kscript)$/, 'kotlin'], [/^scala(-cli)?$|^amm$/, 'scala'],
    [/^ocaml$|^utop$/, 'ocaml'], [/^emacs$/, 'elisp'], [/^dart$/, 'dart'], [/^(rust-script|cargo)$/, 'rust'], [/^zig$/, 'zig'], [/^go(run)?$/, 'go'],
    [/^perl\d?$/, 'Perl'], [/^Rscript$/, 'R'], [/^(fish)$/, 'fish'],
  ];
  // editor modes and file types (Emacs -*- mode: x -*-, Vim ft=x)
  const MODES = {
    python: 'python', py: 'python', ruby: 'ruby', rb: 'ruby', sh: 'bash', bash: 'bash', zsh: 'bash', 'shell-script': 'bash', shell: 'bash', c: 'c', 'c++': 'cpp', cpp: 'cpp', arduino: 'arduino',
    js: 'js', javascript: 'js', js2: 'js', typescript: 'ts', ts: 'ts', tsx: 'tsx', rust: 'rust', go: 'go', lua: 'lua', 'emacs-lisp': 'elisp', elisp: 'elisp', 'lisp-interaction': 'elisp', lisp: 'elisp',
    java: 'java', kotlin: 'kotlin', swift: 'swift', objc: 'objc', 'objective-c': 'objc', php: 'php', yaml: 'yaml', json: 'json', toml: 'toml', sql: 'sql', markdown: 'markdown', md: 'markdown', gfm: 'markdown',
    csharp: 'csharp', cs: 'csharp', scala: 'scala', dart: 'dart', elixir: 'elixir', ocaml: 'ocaml', tuareg: 'ocaml', caml: 'ocaml', elm: 'elm', solidity: 'solidity', zig: 'zig', html: 'html', css: 'css',
    vue: 'vue', erb: 'erb', eruby: 'erb', eelixir: 'erb', text: 'text', txt: 'text', conf: 'text', csv: 'csv', rescript: 'rescript', tla: 'tlaplus', tlaplus: 'tlaplus', ql: 'ql', systemrdl: 'systemrdl',
  };

  /* Clues in the text itself: [pattern, weight]. Patterns are tried once each (multiline). */
  const W = (re, w) => [re, w];
  // JSX: a closing tag or a self-closing element (generics like Result<T> have neither)
  const JSX = /<\/[A-Za-z][\w.]*>|<[A-Za-z][\w.]*(\s+[\w-]+=["{][^>\n]*)?\s*\/>/;
  const CLUES = {
    python: [W(/^\s*def \w+\(.*\)\s*(->\s*[^:]+)?:\s*$/m, 4), W(/^\s*(from [\w.]+ )?import [\w.]+( as \w+)?(, \w+)*\s*$/m, 2), W(/^\s*class \w+(\(.*\))?:\s*$/m, 4), W(/\bself\.\w+/, 2), W(/^if __name__ == ['"]__main__['"]:/m, 8),
      W(/^\s*(elif|except|finally)\b.*:\s*$/m, 4), W(/\bprint\(/, 1), W(/\b(None|True|False)\b/, 1), W(/^\s*@\w+(\.\w+)*(\(.*\))?\s*$/m, 1), W(/^\s*(for|while|if|with) .+:\s*$/m, 3), W(/"""|'''/, 2), W(/\bf"[^"]*\{/, 2), W(/^\s*#.*$/m, 0.5)],
    js: [W(/\b(const|let) \w+\s*=/, 2), W(/\bfunction\s*\w*\s*\(/, 2), W(/=>\s*[{(\w]/, 1.5), W(/\brequire\(['"][\w./@-]+['"]\)/, 4), W(/\bmodule\.exports\b/, 5), W(/\bconsole\.(log|error|warn)\(/, 3),
      W(/\bdocument\.(getElementById|querySelector|createElement|addEventListener)/, 4), W(/^\s*import .* from ['"][^'"]+['"];?\s*$/m, 2), W(/^\s*export (default |const |function |class )/m, 2), W(/===|!==/, 2), W(/\bundefined\b/, 1), W(/\.addEventListener\(/, 2)],
    ts: [W(/^\s*(export )?interface \w+(<[^>]*>)? (extends [\w<>, ]+ )?\{/m, 5), W(/^\s*(export )?type \w+(<[^>]*>)? = /m, 4), W(/:\s*(string|number|boolean|void|unknown|any|never)(\[\])?\b/, 4), W(/\b(private|public|readonly|protected) \w+\s*[:;(=]/, 2),
      W(/\bas (const|string|number|unknown)\b/, 3), W(/<[A-Z]\w*(\[\])?>\(/, 2), W(/\): Promise<|\): \w+(<[^>]+>)? \{/, 3), W(/^\s*import .* from ['"][^'"]+['"];?\s*$/m, 1), W(/\benum \w+ \{/, 1)],
    tsx: [W(JSX, 4), W(/return \(\s*\n?\s*</, 4), W(/\bclassName=/, 4), W(/\buse(State|Effect|Ref|Memo|Callback|Context)\b/, 3), W(/:\s*(string|number|boolean|React\.\w+)\b/, 2), W(/^\s*(export )?(interface|type) \w+/m, 2)],
    html: [W(/<!DOCTYPE html>/i, 10), W(/<html[\s>]/i, 6), W(/<(head|body|div|span|section|nav|footer|header|ul|li|p|a|img|table)[\s>]/i, 2), W(/<\/(div|p|li|a|span|section|body|html)>/i, 2), W(/<(meta|link) /i, 3)],
    css: [W(/^\s*[.#:]?[\w-][^{};=()\n]{0,80}\{\s*$/m, 2), W(/^\s*[\w-]+\s*:\s*[^;{}]+;\s*$/m, 2), W(/@media\s*\(|@import |@keyframes|@font-face/, 5), W(/:\s*(\d+(px|rem|em|%|vh|vw)|#[0-9a-f]{3,8});/i, 3), W(/^\s*:root\s*\{/m, 5),
      W(/^\s*(color|background(-color)?|margin|padding|display|font-(size|family|weight)|border(-radius)?|box-sizing|text-align|justify-content|align-items)\s*:\s*[^;]+;/m, 4)],
    cpp: [W(/^#include <(iostream|vector|string|map|memory|algorithm|cstdio|cstdlib|cmath|fstream|sstream|thread|array|unordered_map|set|chrono|functional|optional)>/m, 6), W(/\bstd::\w+/, 5), W(/\b(cout|cin|cerr)\s*(<<|>>)/, 5), W(/^\s*(class|struct) \w+(\s*:\s*(public|private|protected) \w+)?\s*\{/m, 2), W(/\btemplate\s*</, 5),
      W(/^\s*namespace \w+\s*\{|using namespace /m, 5), W(/^\s*(public|private|protected):\s*$/m, 4), W(/\bnullptr\b|\bauto\s+\w+\s*=/, 3), W(/::\w+\(/, 2), W(/\b(virtual|override|constexpr|noexcept)\b/, 3), W(/^#include ["<]/m, 1)],
    arduino: [W(/^\s*void setup\s*\(\s*\)/m, 6), W(/^\s*void loop\s*\(\s*\)/m, 6), W(/\b(pinMode|digitalWrite|digitalRead|analogRead|analogWrite)\(/, 5), W(/\bSerial\.(begin|print|println)\(/, 4), W(/\bdelay\(\d+\)/, 2), W(/\b(HIGH|LOW|OUTPUT|INPUT_PULLUP)\b/, 2)],
    c: [W(/^#include <(stdio|stdlib|string|stdint|stdbool|math|unistd|errno|time|ctype|assert|signal|pthread|fcntl)\.h>/m, 5), W(/\b(printf|fprintf|scanf|malloc|calloc|free|memcpy|strcpy|strlen|fopen)\(/, 3), W(/^\s*typedef (struct|enum|union)?/m, 3), W(/\w+->\w+/, 1), W(/^int main\s*\((void|int argc)/m, 3), W(/^\s*#define \w+/m, 1), W(/\bNULL\b/, 1), W(/^#include ["<]/m, 1),
      W(/^(?:static\s+|extern\s+|const\s+)*(?:void|int|char|long|short|float|double|unsigned|size_t|bool|struct\s+\w+|[A-Z]\w*)\s*\**\s*\w+\s*\([^()]*\)\s*;\s*$/m, 2)],
    objc: [W(/^\s*@(interface|implementation|protocol|end)\b/m, 8), W(/^#import [<"]/m, 5), W(/\bNS(String|Array|Dictionary|Object|Log|Integer|Number|MutableArray|Date|Error)\b/, 4), W(/@"[^"]*"/, 3), W(/^\s*[-+]\s*\([\w\s*<>]+\)\s*\w+/m, 5), W(/\[\w+ \w+(:[^\]]*)?\]/, 2), W(/@property\s*\(/, 5)],
    java: [W(/^\s*package [\w.]+;\s*$/m, 4), W(/^\s*import (static )?java(x)?\.[\w.*]+;/m, 6), W(/^\s*import [\w.]+(\.\*)?;\s*$/m, 1), W(/\bpublic (static )?(final )?(class|interface|enum|record) \w+/, 3), W(/public static void main\(String\[\] \w+\)/, 8), W(/\bSystem\.(out|err)\.print(ln|f)?\(/, 6),
      W(/@Override\b/, 3), W(/\bthrows \w+/, 2), W(/\bnew (ArrayList|HashMap|HashSet|StringBuilder)<?/, 3), W(/\b(private|public|protected) (final )?[\w<>\[\], ]+ \w+\s*[;=]/, 1)],
    csharp: [W(/^\s*using System(\.[\w.]+)?;/m, 7), W(/^\s*namespace [\w.]+\s*(\{|;)?\s*$/m, 3), W(/\bConsole\.(WriteLine|Write|ReadLine)\(/, 6), W(/\{ get; (private |init; )?(set; )?\}/, 6), W(/\basync Task(<[\w<>, ]+>)? \w+\(/, 5), W(/\bstatic void Main\(/, 5),
      W(/^\s*\[(Test|Fact|TestMethod|HttpGet|HttpPost|Serializable|ApiController|Route)[\](]/m, 4), W(/\bvar \w+ = new \w+/, 2), W(/\.(Where|Select|FirstOrDefault|OrderBy|ToList|Any)\(/, 2), W(/\bstring\[\] args\b/, 2), W(/\bpublic (sealed |static |abstract |partial )*(class|interface|record|struct) \w+/, 2)],
    kotlin: [W(/^\s*fun (<[^>]+> )?[\w.]+\(/m, 5), W(/^\s*(val|var) \w+(: [\w<>?, ]+)? = /m, 2), W(/^\s*data class \w+\(/m, 6), W(/^\s*import kotlinx?\./m, 7), W(/\bprintln\(/, 1), W(/\bsuspend fun\b/, 6), W(/\bwhen\s*(\([^)]*\))?\s*\{/, 3), W(/\w!!/, 3), W(/\?\.let\s*\{/, 4), W(/\bcompanion object\b/, 6), W(/^\s*package [\w.]+\s*$/m, 2), W(/:\s*(String|Int|Boolean|Double|Unit)\??\s*[,)=]/, 2), W(/\bobject \w+(\s*:\s*\w+\(\))?\s*\{/, 2)],
    scala: [W(/^\s*object \w+( extends \w+)?\s*\{/m, 4), W(/^\s*(case )?class \w+(\[[^\]]+\])?\([^)]*\)( extends \w+)?/m, 2), W(/^\s*def \w+(\[[^\]]+\])?(\(.*\))?(: [\w\[\], ]+)?\s*=/m, 5), W(/^\s*import scala\./m, 7), W(/^\s*trait \w+/m, 3), W(/\bmatch \{/, 4), W(/^\s*case .+ =>/m, 3),
      W(/\bval \w+(: [\w\[\]]+)? =/, 1), W(/\b(Seq|List|Option|Some|None|Array)\[/, 3), W(/\bextends App\b/, 6), W(/\bimplicit\b/, 3), W(/^\s*package [\w.]+\s*$/m, 1), W(/\bs"[^"]*\$/, 3)],
    swift: [W(/^\s*import (Foundation|UIKit|SwiftUI|Combine|XCTest|AppKit)\s*$/m, 8), W(/^\s*func \w+(<[^>]+>)?\(.*\)( (async|throws|rethrows))*( -> [\w\[\]?<>:, ]+)?\s*\{/m, 3), W(/\bguard (let|var) /, 6), W(/\bif let \w+ = /, 4), W(/^\s*(let|var) \w+(: [\w\[\]?<>]+)? = /m, 1),
      W(/@(State|Published|ObservedObject|Binding|main|MainActor|escaping)\b/, 5), W(/\bstruct \w+: (View|Codable|Identifiable|Equatable|Hashable)/, 6), W(/\bprint\(/, 0.5), W(/\\\(\w+/, 3), W(/\bprotocol \w+/, 2), W(/\bextension \w+/, 2)],
    dart: [W(/^\s*import 'package:[\w/]+\.dart';/m, 8), W(/^\s*void main\(\)( async)? \{/m, 3), W(/\bextends (StatelessWidget|StatefulWidget|State<\w+>)/, 8), W(/\bWidget build\(BuildContext \w+\)/, 8), W(/@override\b/, 4), W(/\bfinal \w+ \w+ = /, 2),
      W(/\brequired this\.\w+/, 6), W(/\bFuture<\w+>/, 2), W(/\bsetState\(/, 4), W(/^\s*import '[\w/.]+\.dart';/m, 6), W(/\$\{?\w+/, 0.5)],
    go: [W(/^package \w+\s*$/m, 5), W(/^import \(\s*$|^import "[\w./]+"\s*$/m, 4), W(/^func (\(\w+ \*?\w+\) )?\w+\(/m, 6), W(/:= /, 3), W(/\bfmt\.(Print|Sprint|Fprint|Errorf)/, 5), W(/\berr != nil\b/, 6), W(/\bgo func\(/, 4), W(/\bchan \w+|<-\s*\w+/, 2), W(/\bdefer \w+/, 2), W(/^type \w+ (struct|interface) \{/m, 5)],
    rust: [W(/^\s*(pub(\(crate\))? )?fn \w+(<[^>]+>)?\(/m, 5), W(/\blet mut \w+/, 5), W(/^\s*use (std|crate|super|self)::/m, 6), W(/^\s*impl(<[^>]+>)? [\w<>]+( for \w+)? \{/m, 5), W(/\b(println|format|vec|panic|assert_eq|write)!\(/, 5), W(/#\[derive\(/, 6), W(/&mut \w+|&self\b/, 4),
      W(/\b(Some|Ok|Err)\(/, 2), W(/\.unwrap\(\)/, 3), W(/->\s*(Result|Option|Self|Vec|String|bool|u\d+|i\d+|usize)\b/, 3), W(/^\s*(pub )?(struct|enum|trait|mod) \w+/m, 2), W(/\bmatch \w+[\w.()]* \{/, 2)],
    zig: [W(/@import\("std"\)/, 10), W(/^\s*(pub )?fn \w+\(.*\)\s*!?[\w\[\]*.?]+\s*\{/m, 3), W(/\bstd\.(debug|mem|testing|heap|fmt)\./, 5), W(/^test "[^"]*" \{/m, 6), W(/\b(comptime|errdefer|anytype|usize)\b/, 3), W(/\btry \w+/, 1), W(/@(intCast|floatFromInt|as|ptrCast|TypeOf)\(/, 5), W(/\bconst \w+ = struct \{/, 5)],
    php: [W(/^<\?php/, 12), W(/<\?php|\?>/, 5), W(/\$\w+\s*=/, 2), W(/\$this->\w+/, 5), W(/\becho\s/, 1), W(/^\s*namespace [\w\\]+;/m, 4), W(/^\s*use [\w\\]+;/m, 3), W(/\bfunction \w+\(.*\$\w+/, 4), W(/->\w+\(/, 1), W(/::\w+\(/, 1), W(/\barray\(/, 2)],
    ruby: [W(/^\s*def (self\.)?\w+[?!=]?(\(.*\))?\s*$/m, 4), W(/^\s*end\s*$/m, 2), W(/^\s*require(_relative)? ['"][\w./-]+['"]\s*$/m, 4), W(/\bputs\b/, 2), W(/^\s*class \w+( < [\w:]+)?\s*$/m, 4), W(/\battr_(reader|writer|accessor)\b/, 6), W(/\bdo \|\w+(, \w+)*\|/, 5), W(/\.each\b/, 1),
      W(/\belsif\b/, 4), W(/\bunless\b/, 2), W(/@\w+\s*=/, 1), W(/:\w+ =>/, 2), W(/^\s*module \w+\s*$/m, 3), W(/#\{[^}]+\}/, 1), W(/\.(nil|empty|any)\?/, 4), W(/^\s*source\s+['"]https:\/\/rubygems\.org/m, 6), W(/^\s*gem\s+['"][\w-]+['"]/m, 5)],
    erb: [W(/<%=?[\s\S]*?%>/, 8), W(/<% end %>/, 5), W(/<%= (link_to|render|form_with|image_tag)/, 4)],
    vue: [W(/^<template>/m, 6), W(/^<script( setup)?( lang="ts")?>/m, 3), W(/\bv-(if|for|model|bind|on|show)=/, 6), W(/\s@(click|submit|input|change)=/, 4), W(/export default \{[\s\S]*\b(data|props|methods|computed)\b/, 4), W(/<style scoped>/, 5), W(/\{\{[^}]+\}\}/, 1)],
    lua: [W(/^\s*local \w+(, \w+)* = /m, 4), W(/^\s*local function \w+/m, 6), W(/^\s*function [\w.:]+\(.*\)\s*$/m, 3), W(/\bthen\s*$/m, 2), W(/^\s*end\s*$/m, 1), W(/\belseif\b/, 3), W(/~=/, 4), W(/\bi?pairs\(/, 5), W(/\.\. ?["'\w]/, 1), W(/\brequire\(?["'][\w.]+["']\)?/, 2), W(/\bnil\b/, 1), W(/^\s*--/m, 1), W(/\bsetmetatable\(/, 6)],
    bash: [W(/^#!.*\b(ba|z|k)?sh\b/m, 10), W(/^\s*(if|while|until) \[\[? .*\]\]?; then/m, 5), W(/^\s*fi\s*$/m, 4), W(/^\s*done\s*$/m, 3), W(/^\s*esac\s*$/m, 4), W(/\$\{?\w+\}?/, 1), W(/\$\(.+\)/, 2), W(/^\s*(export|local|readonly|declare) \w+=?/m, 3), W(/^\s*set -[euxo]+/m, 5),
      W(/^\s*\w+\(\) \{\s*$/m, 4), W(/\becho\s+["$\w-]/, 2), W(/\s(&&|\|\|)\s|\|\s*(grep|awk|sed|xargs|cut|sort|head|tail|wc)\b/, 2), W(/\b(mkdir|chmod|rm|cp|mv|cd|grep|sed|awk|curl|tar|apt-get|brew) -?/, 1), W(/^\s*\w+=["$(\w]/m, 1)],
    elixir: [W(/^\s*defmodule [\w.]+ do\s*$/m, 10), W(/^\s*defp? \w+[?!]?(\(.*\))?( when .+)?,? do:?/m, 6), W(/\|>/, 3), W(/\bIO\.(puts|inspect)\b/, 4), W(/^\s*@(moduledoc|doc|spec|impl)\b/m, 5), W(/%\{|%\w+\{/, 2), W(/\{:(ok|error|noreply|reply),/, 4), W(/\bfn \w+ ->/, 3), W(/^\s*(use|alias|import|require) [A-Z][\w.]+/m, 2)],
    elisp: [W(/^\(defun [\w-]+ \(/m, 8), W(/^\((defvar|defcustom|defconst|defgroup|defmacro|defface) [\w-]+/m, 6), W(/\(setq /, 4), W(/^\(require '[\w-]+\)/m, 6), W(/^\(provide '[\w-]+\)/m, 6), W(/\(interactive( "[^"]*")?\)/, 6), W(/^;;;? /m, 2), W(/\(let\*? \(/, 3), W(/\(lambda \(/, 2)],
    ocaml: [W(/^\s*let rec \w+/m, 6), W(/^\s*let \(\) =/m, 6), W(/\bmatch .+ with\s*$/m, 5), W(/^\s*\| [A-Z]\w*( (of|\w+|\(.*\)))? ->/m, 3), W(/^\s*type \w+ =\s*$|^\s*type \w+ = \|/m, 4), W(/;;\s*$/m, 4), W(/\b(Printf\.printf|print_endline|List\.(map|iter|fold_left))\b/, 5), W(/^\s*open [A-Z]\w*\s*$/m, 3),
      W(/^\s*module \w+ = struct/m, 6), W(/\(\*[\s\S]*?\*\)/, 2), W(/\bfun \w+ ->/, 2), W(/\bin\s*$/m, 2), W(/ \+\. | \*\. /, 5)],
    elm: [W(/^module [\w.]+ exposing \(/m, 10), W(/^import [\w.]+( as \w+)?( exposing \(.*\))?\s*$/m, 3), W(/^type alias \w+ =/m, 6), W(/^\w+ : [\w\s()]+( -> [\w\s()]+)+\s*$/m, 5), W(/\bcase \w+ of\s*$/m, 4), W(/\bHtml\.\w+|\bBrowser\.\w+/, 3), W(/^\s*\{- |^-- /m, 1)],
    rescript: [W(/@react\.component/, 7), W(/\bReact\.(string|array|useState|useReducer)\b/, 5), W(/\bJs\.(log|log2|Array|String)\b/, 6), W(/\bBelt\.\w+/, 6), W(/^\s*let \w+ = \([^)]*\) =>/m, 4), W(/\bswitch \w+[\w.]* \{/, 3), W(/^\s*\| \w+(\(.*\))? => /m, 2), W(/->\w+\(|->Belt|->Js/, 4), W(/\boption<\w+>/, 4), W(/^\s*open \w+\s*$/m, 1)],
    solidity: [W(/^\s*pragma solidity\b/m, 12), W(/^\s*(abstract )?contract \w+( is [\w, ]+)?\s*\{/m, 8), W(/\bmsg\.(sender|value)\b/, 6), W(/\b(uint256|uint8|address|bytes32)\b/, 4), W(/\bmapping\(/, 6), W(/\bemit \w+\(/, 5), W(/\bfunction \w+\(.*\) (public|external|internal|private)/, 5), W(/SPDX-License-Identifier/, 2)],
    ql: [W(/^\s*import (cpp|java|python|javascript|csharp|go|ruby|swift|codeql\.\w+|semmle\.[\w.]+)\s*$/m, 6), W(/^\s*from [\w:]+ \w+(, [\w:]+ \w+)*\s*$/m, 4), W(/^\s*where\b/m, 3), W(/^\s*select [\w.]+,/m, 5), W(/^\s*(private )?predicate \w+\(/m, 7), W(/^\s*class \w+ extends [\w:]+ \{/m, 3), W(/\bexists\(/, 3), W(/\binstanceof\b/, 1), W(/@kind (problem|path-problem)/, 8), W(/DataFlow::/, 4)],
    tlaplus: [W(/^-{4,}\s*MODULE \w+\s*-{4,}/m, 15), W(/^EXTENDS \w+/m, 6), W(/^(VARIABLES?|CONSTANTS?) \w+/m, 5), W(/^\w+(\(.*\))? ==\s*/m, 3), W(/\/\\|\\\//, 3), W(/\bUNCHANGED\b/, 6), W(/^={4,}\s*$/m, 4), W(/\[\]\[\w+\]_\w+/, 6)],
    systemrdl: [W(/^\s*addrmap \w+ \{/m, 10), W(/^\s*(reg|regfile|field|mem|signal) (\w+ )?\{/m, 5), W(/\bsw\s*=\s*(rw|r|w|rw1|w1)\s*;/, 6), W(/\bhw\s*=\s*(rw|r|w|na)\s*;/, 6), W(/\]\s*=\s*\d+'?[dhb]?\w*;|\[\d+:\d+\]/, 2), W(/@\s*0x[0-9a-f]+;/i, 4), W(/^\s*property \w+ \{/m, 4)],
    sql: [W(/^\s*SELECT\b[\s\S]{0,400}?\bFROM\b/im, 5), W(/^\s*CREATE (OR REPLACE )?(TABLE|VIEW|INDEX|FUNCTION|PROCEDURE|TRIGGER|UNIQUE INDEX|DATABASE|SCHEMA)\b/im, 8), W(/^\s*INSERT INTO\b/im, 6), W(/^\s*UPDATE \w+ SET\b/im, 6), W(/^\s*DELETE FROM\b/im, 5), W(/^\s*(ALTER|DROP) TABLE\b/im, 6),
      W(/\b(PRIMARY KEY|FOREIGN KEY|NOT NULL|VARCHAR\(|INTEGER|REFERENCES)\b/i, 3), W(/\b(INNER |LEFT |RIGHT )?JOIN \w+ (\w+ )?ON\b/i, 3), W(/\bGROUP BY\b|\bORDER BY\b/i, 2), W(/^\s*--/m, 0.5)],
    json: [W(/^\s*[{[]/, 1), W(/^\s*"[\w$@.-]+"\s*:\s*/m, 3)],
    yaml: [W(/^---\s*$/m, 3), W(/^[\w-]+:(\s+[^\s{].*)?\s*$/m, 2), W(/^\s+[\w-]+:\s+\S/m, 1), W(/^\s*- [\w"'{[]/m, 2), W(/^\s*- [\w-]+:\s/m, 3), W(/^\s+[\w-]+: \|\s*$|: >-?\s*$/m, 3), W(/\$\{\{ [\w.]+ \}\}/, 4)],
    toml: [W(/^\[[\w.-]+\]\s*$/m, 5), W(/^\[\[[\w.-]+\]\]\s*$/m, 7), W(/^[\w-]+ = ("|\d|true|false|\[|\{)/m, 4), W(/^\s*#/m, 0.5)],
    markdown: [W(/^#{1,6} \S/m, 3), W(/^```\w*\s*$/m, 4), W(/\[[^\]]+\]\([^)\s]+\)/, 4), W(/^\s*[-*+] \S/m, 1), W(/^\s*\d+\. \S/m, 1), W(/\*\*[^*\n]+\*\*/, 3), W(/^\|.+\|\s*$/m, 2), W(/^(={3,}|-{3,})\s*$/m, 1), W(/^> \S/m, 2), W(/`[^`\n]+`/, 1)],
  };
  // a few patterns that rule a language out
  const AGAINST = {
    js: /^\s*(interface|type) \w+(<[^>]*>)? [={]|:\s*(string|number|boolean)\b(?![\w'"])/m, c: /\bstd::|^\s*class \w+|\btemplate\s*<|^\s*namespace \w+|@interface|#import/m, cpp: /@interface|@implementation|#import/m, java: /^\s*(fun|val|def|func) \w+|:=|\bConsole\.|using System/m,
    kotlin: /;\s*$|\bpublic static void\b|System\.out\./m, scala: /^\s*fun \w+|\bsuspend\b|;\s*$/m, swift: /^\s*fun \w+|\bval \w+|;\s*$/m, ruby: /[{};]\s*$|^\s*(fn|func|function|fun) \w+/m, lua: /[{};]\s*$|^\s*(def|fn|func|fun) \w+/m, ocaml: /[{}]\s*$|=>/m,
    elm: /;;|\blet rec\b|[{};]\s*$/m, python: /[{};]\s*$|^\s*(function|fn|func|fun|end)\b/m, bash: /^\s*(def|function \w+\s*\(|class|import|fn|func|fun|let|const|var)\b|;\s*$(?<!;;\s*$)/m, json: /^\s*(\/\/|#)|,\s*[}\]]/m,
    css: /\b(function|var|let|const|def|return|class)\b|=>|\(\)|;\s*\n\s*[a-z_]+\(/, toml: /^\s*- |:\s*$/m, yaml: /^\s*\[[\w.]+\]\s*$|[{;]\s*$/m, csv: /[{}();]\s*$/m, php: /^(?![\s\S]*<\?php)/,
  };

  const linesOf = (s) => s.split('\n');
  function headText(source) {
    let s = String(source || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    if (s.length > CAP) { s = s.slice(0, CAP); const nl = s.lastIndexOf('\n'); if (nl > CAP / 2) s = s.slice(0, nl); }
    return s;
  }
  function shebangOf(head) {
    const m = head.match(/^#!\s*(\S+)(?:\s+(?:-\S+\s+)*(\S+))?/);
    if (!m) return null;
    let prog = m[1].split('/').pop();
    if (prog === 'env' && m[2]) prog = m[2].split('/').pop();
    for (const [re, id] of SHEBANG) if (re.test(prog)) return { id, prog };
    return { id: null, prog };
  }
  function modelineOf(head) {
    const ls = linesOf(head);
    const zone = ls.slice(0, 3).concat(ls.slice(-5)).join('\n');
    let m = zone.match(/-\*-\s*(?:.*?\bmode:\s*([\w+-]+)|([\w+-]+)\s*-\*-)/i);
    let mode = m && (m[1] || m[2]);
    if (!mode) { m = zone.match(/\b(?:vi|vim|ex):.*?\b(?:ft|filetype|syntax)=([\w+-]+)/); mode = m && m[1]; }
    if (!mode) return null;
    return MODES[mode.toLowerCase()] ? { id: MODES[mode.toLowerCase()], mode } : null;
  }
  function looksLikeJson(head, whole) {
    const t = head.trim();
    if (!/^[[{]/.test(t)) return false;
    const text = String(whole).trim();
    if (text.length < 200000) { try { JSON.parse(text); return true; } catch (_) { /* maybe with comments, or cut short */ } }
    return /^\{\s*("[^"\n]+"\s*:|\})|^\[\s*(\{\s*"|"|-?\d|true|false|null|\]|\[)/.test(t) && !/^\s*[\w$]+\s*[=(]/m.test(t);
  }
  function csvShape(head) {
    const ls = linesOf(head).filter(l => l.trim()).slice(0, 40);
    if (ls.length < 3) return null;
    for (const d of [',', '\t', ';', '|']) {
      const counts = ls.map(l => splitCsvLine(l, d).length);
      if (counts[0] < 2) continue;
      const same = counts.filter(c => c === counts[0]).length;
      if (same >= ls.length * 0.9 && !/[{};]\s*$|^\s*(\/\/|#|--)/m.test(ls.slice(0, 10).join('\n'))) return d;
    }
    return null;
  }
  function prose(head) {
    const ls = linesOf(head).filter(l => l.trim());
    if (!ls.length) return false;
    const sentencey = ls.map(l => l.replace(/^\s*([-*•]|\d+[.)])\s+/, '').replace(/^[A-Z][\w ]{0,20}:\s+/, '')).filter(l => /^[\s"'(]*[A-Za-z0-9][^{};=<>]*[a-z][^{};=<>]*$/.test(l) && l.trim().split(/\s+/).length >= 3 && !/^\s*[\w-]+:\s*\S+\s*$/.test(l)).length;
    return sentencey / ls.length > 0.6;
  }
  /* The share of lines that have a shape (YAML keys, TOML pairs…). */
  const shapeShare = (head, re) => { const ls = linesOf(head).filter(l => l.trim()); return ls.length ? ls.filter(l => re.test(l)).length / ls.length : 0; };

  function scoreAll(head) {
    const out = [];
    for (const [id, clues] of Object.entries(CLUES)) {
      let score = 0;
      const hits = [];
      for (const [re, w] of clues) if (re.test(head)) { score += w; if (w >= 3) hits.push(re); }
      if (score && AGAINST[id] && AGAINST[id].test(head)) score *= 0.4;
      if (score) out.push({ id, score, hits: hits.length });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  /* Share of a parse that went wrong (ERROR and MISSING nodes), 0 to 1. */
  function errorShare(lang, text) {
    try {
      const rootNode = parseSafe(lang, text);
      if (!rootNode.hasError()) return 0;
      let bad = 0;
      const visit = (n) => {
        if (n.type === 'ERROR') { bad += n.endIndex - n.startIndex; return; }
        if (n.isMissing()) { bad += 5; return; }
        if (!n.hasError()) return;
        for (let i = 0; i < n.childCount; i++) visit(n.child(i));
      };
      visit(rootNode);
      return Math.min(1, bad / Math.max(1, text.length));
    } catch (_) { return null; }
  }

  const result = (lang, confidence, why) => ({ lang, confidence, why });
  const extOf = (path) => { const base = String(path || '').split(/[\\/]/).pop(); const m = base.match(/\.([^.]+)$/); return m && m[1] !== base.slice(1) ? m[1].toLowerCase() : (/^\.[^.]+$/.test(base) ? '' : ''); };
  const baseOf = (path) => String(path || '').split(/[\\/]/).pop();

  /* .h: C, C++ or Objective-C */
  function headerKind(head) {
    if (/^\s*@(interface|protocol|end)\b|^#import\b/m.test(head)) return result('objc', 'likely', 'The name ends in .h and it has Objective-C\'s @interface or #import.');
    if (/\bstd::|^\s*(class|namespace)\s+\w+[^;]*$|\btemplate\s*<|^\s*(public|private|protected):|\bconstexpr\b|\bvirtual\b|#include <(iostream|vector|string|memory|map|cstdint|cstddef|array)>/m.test(head))
      return result('cpp', 'likely', 'The name ends in .h and it uses C++ (classes, namespaces, templates or std::).');
    if (/^\s*(typedef|struct|enum|extern|#define|#include <\w+\.h>)/m.test(head) || /\w+\s+\**\w+\s*\([^)]*\)\s*;/.test(head))
      return result('c', 'likely', 'The name ends in .h and nothing in it is C++ or Objective-C, so it is read as C.');
    return result('cpp', 'guess', 'The name ends in .h, which C, C++ and Objective-C all use; nothing in it tells them apart, so it is read as C++.');
  }

  /* What the text alone says. */
  function byContent(head, whole, rawPath) {
    const t = head.trim();
    if (!t) return { res: result('text', 'guess', 'There is no text to go on.'), cands: [] };
    if (/^<\?php/.test(t)) return { res: result('php', 'likely', 'It starts with <?php.'), cands: [] };
    if (/^<\?xml/.test(t)) return { res: result('text', 'likely', 'It is XML, which IntuaCode shows as plain text.'), cands: [] };
    if (looksLikeJson(head, whole)) return { res: result('json', 'likely', 'It is a JSON ' + (t[0] === '[' ? 'list' : 'object') + '.'), cands: [] };
    if (/^<!DOCTYPE html|^<html[\s>]/i.test(t)) {
      if (/<%[=#-]?\s/.test(head)) return { res: result('erb', 'likely', 'It is a web page with <% %> template tags in it.'), cands: [] };
      return { res: result('html', 'likely', 'It starts like a web page (<!DOCTYPE html> or <html>).'), cands: [] };
    }
    if (/^<template[\s>]/m.test(head) && /^<(script|style)[\s>]/m.test(head)) return { res: result('vue', 'likely', 'It has <template> and <script> parts, like a Vue component.'), cands: [] };
    const delim = csvShape(head);
    const scores = scoreAll(head);
    if (delim && (!scores[0] || scores[0].score < 8)) return { res: result('csv', 'likely', `Every line has the same number of values separated by ${delim === '\t' ? 'tabs' : delim === ',' ? 'commas' : `"${delim}"`}.`), cands: [] };
    // TypeScript with JSX is TSX; JavaScript with JSX stays JavaScript
    const s = Object.fromEntries(scores.map(x => [x.id, x]));
    if (s.tsx && s.tsx.score >= 6 && JSX.test(head)) {
      if (s.ts && s.ts.score >= 4) { s.tsx.score += s.ts.score; } else if (s.js) { s.js.score += s.tsx.score; s.tsx.score = 0; }
    }
    if (s.ts && s.js) s.ts.score += s.ts.score >= 4 ? s.js.score * 0.6 : 0;
    if (s.arduino && s.arduino.score >= 6) s.arduino.score += (s.cpp ? s.cpp.score : 0) + (s.c ? s.c.score : 0);
    if (s.erb && s.html) s.erb.score += s.html.score;
    // data formats only count when most lines have their shape (notes often contain "Label: text")
    if (s.yaml) s.yaml.score *= Math.min(1, shapeShare(head, /^\s*(- )?[\w"'.\/-]+:(\s+[^\s].{0,60})?$|^\s*- \S.{0,60}$|^---\s*$|^\s*#|^\s*\.\.\.\s*$|^\s+\S/) * 1.2) ** 2;
    if (s.toml) s.toml.score *= Math.min(1, shapeShare(head, /^\s*\[\[?[\w."-]+\]\]?\s*$|^\s*[\w."-]+\s*=\s*\S|^\s*#|^\s+\S|^\s*[\]}]/) * 1.2) ** 2;
    if (prose(head)) for (const x of scores) if (/^(yaml|toml|markdown|csv)$/.test(x.id)) x.score *= 0.5;
    if (s.vue && s.html) s.vue.score += s.html.score * 0.5;
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];
    if (!best || best.score < 4) {
      if (prose(head)) return { res: result('text', 'likely', 'It reads like ordinary writing, not code.'), cands: [] };
      return { res: result('text', 'guess', 'Nothing in it points clearly to a language.'), cands: scores.slice(0, 3) };
    }
    if (best.id === 'markdown' && prose(head.replace(/^#{1,6} .*$/mg, '')) && best.score < 6) return { res: result('text', 'guess', 'It reads like ordinary writing, with a little Markdown.'), cands: [] };
    const close = scores.filter(x => x !== best && x.score >= best.score * 0.7).slice(0, 3);
    const conf = !close.length && best.score >= 8 ? 'likely' : 'guess';
    return { res: result(best.id, conf, `It looks like ${nameOf(best.id)}` + (rawPath ? '' : '') + '.'), cands: [best, ...close] };
  }

  /* Pick between close candidates by parsing with each loaded grammar: fewest errors wins. */
  function tieBreak(found, cands, head) {
    if (cands.length < 2) return found;
    const sample = head.length > 4000 ? head.slice(0, head.lastIndexOf('\n', 4000) + 1 || 4000) : head;
    const tried = [];
    for (const c of cands) {
      if (!hasGrammar(c.id)) continue;
      const e = errorShare(c.id, sample);
      if (e != null) tried.push({ id: c.id, e, score: c.score });
    }
    if (tried.length < 2) return found;
    tried.sort((a, b) => a.e - b.e || b.score - a.score);
    const win = tried[0];
    const mine = tried.find(x => x.id === found.lang);
    if (win.id === found.lang) {
      const worse = tried.slice(1).filter(x => x.e > win.e);
      return worse.length ? { ...found, why: found.why.replace(/\.$/, '') + `; it also reads with fewer problems as ${nameOf(win.id)} than as ${plainList(worse.map(x => nameOf(x.id)), 3).replace(/ and ([^,]*)$/, ' or $1')}.` } : found;
    }
    // only overrule the clues when the parse is clearly better
    if (!mine || win.e + 0.02 < mine.e)
      return result(win.id, 'guess', `It could be ${plainList(cands.map(c => nameOf(c.id)), 3).replace(/ and ([^,]*)$/, ' or $1')}; it reads with the fewest problems as ${nameOf(win.id)}.`);
    return found;
  }

  function rank(path, source) {
    const head = headText(source);
    const base = baseOf(path).toLowerCase();
    const ext = extOf(path);
    const L = LANGS();
    const shebang = shebangOf(head);
    const mode = modelineOf(head);
    // 1. file names
    if (NAMES[base]) {
      const id = NAMES[base];
      return { res: result(id, 'certain', `Files called ${baseOf(path)} are ${id === 'text' ? 'read as plain text' : nameOf(id)}.`), cands: [] };
    }
    // 2. endings
    if (ext) {
      if (ext === 'h') return { res: headerKind(head), cands: [{ id: 'c', score: 1 }, { id: 'cpp', score: 1 }, { id: 'objc', score: 1 }] };
      if (ext === 'm' && !/^\s*@(interface|implementation|end)\b|^#import\b|\[\w+ \w+/m.test(head) && /^\s*(function\b|%)|\bend\s*$/m.test(head))
        return { res: result('text', 'likely', 'The name ends in .m, but it looks like MATLAB, which IntuaCode can\'t read yet, rather than Objective-C.'), cands: [] };
      if (ext === 'ts' && /^\s*<\?xml|<TS version/.test(head)) return { res: result('text', 'likely', 'The name ends in .ts, but it is a Qt translation file (XML), not TypeScript.'), cands: [] };
      const known = L && L.LANGUAGES.find(l => l.exts.includes(ext));
      const id = known ? known.id : EXTS[ext];
      if (id && id !== 'text') {
        const conflict = shebang && shebang.id && shebang.id !== id && !(id === 'js' && shebang.id === 'ts');
        return { res: result(id, conflict ? 'likely' : 'certain', `The name ends in .${ext}` + (conflict ? `, though its first line asks for ${shebang.prog}.` : '.')), cands: [] };
      }
      if (NOT_YET[ext]) return { res: result('text', 'certain', `The name ends in .${ext} (${NOT_YET[ext]}), which IntuaCode can't read yet, so it is shown as plain text.`), cands: [] };
    }
    // 3. the first line (#!) and editor settings
    if (shebang) {
      if (shebang.id && L && L.byId(shebang.id)) return { res: result(shebang.id, 'certain', `Its first line runs it with ${shebang.prog}.`), cands: [] };
      return { res: result('text', 'likely', `Its first line runs it with ${shebang.prog}, which IntuaCode can't read yet.`), cands: [] };
    }
    if (mode) return { res: result(mode.id, 'certain', `It says so itself, in an editor setting (${mode.mode}).`), cands: [] };
    // 4. the text itself (no ending, an unknown one, or .txt)
    const c = byContent(head, source, path);
    if (ext === 'txt' || ext === 'text' || ext === 'log') {
      if (c.res.lang === 'text') return { res: result('text', 'certain', `The name ends in .${ext} and the text inside reads as plain text.`), cands: [] };
      // notes in .txt files often look a little like Markdown or YAML; only data (JSON, CSV) and clear code count
      const strong = c.res.confidence === 'likely' && !/^(markdown|yaml|toml)$/.test(c.res.lang);
      if (!strong) return { res: result('text', 'likely', `The name ends in .${ext}. The text might be ${nameOf(c.res.lang)}, but not clearly enough to read it as code.`), cands: [] };
      return { res: result(c.res.lang, 'likely', `The name ends in .${ext}, but the text inside is ${nameOf(c.res.lang)} (${c.res.why.replace(/\.$/, '').replace(/^It /, 'it ')}).`), cands: c.cands };
    }
    if (ext && ext !== 'txt') c.res = { ...c.res, why: `IntuaCode doesn't know the ending .${ext}. ` + c.res.why };
    return c;
  }

  /* detect(path, source) -> { lang, confidence: 'certain' | 'likely' | 'guess', why }.
   * Uses only grammars already loaded to break ties; detectAndLoad loads the ones it needs first. */
  function detect(path, source) {
    try {
      const { res, cands } = rank(path || '', source || '');
      if (res.confidence === 'certain' || !cands.length || !WR() || !WR().ready || !WR().ready()) return res;
      return tieBreak(res, cands.filter(x => x.id !== 'markdown'), headText(source));
    } catch (e) {
      return result('text', 'guess', 'The language could not be worked out: ' + e.message);
    }
  }
  async function detectAndLoad(path, source) {
    const { res, cands } = rank(path || '', source || '');
    if (res.confidence !== 'certain' && cands.length > 1 && WR() && WR().ready && WR().ready()) {
      for (const c of cands) for (const k of grammarKeys(c.id)) { try { await WR().loadLangs([k]); } catch (_) { /* that grammar is unavailable: detection uses the others */ } }
    }
    const d = detect(path, source);
    await load(d.lang);
    return d;
  }

  /* ------------------------------------------------------------------ */
  /* The generic reader: a tree-sitter parse plus a language's settings  */
  /* ------------------------------------------------------------------ */

  // shapes shared by most grammars; a language adds or removes node types in its settings
  const LOOP = /^(for|while|do|loop|repeat|until|foreach|for_in|for_of|for_range|for_generic|for_numeric|for_each|c_style_for|enhanced_for|repeat_while|do_while)(_statement|_expression|_loop|_modifier)?$|^for_range_loop$/;
  const DECIDE = /^(if|unless|guard|switch|match|when|case|select|cond|if_let|expression_switch|type_switch)(_statement|_expression|_modifier)?$|^(conditional_expression|ternary_expression|if_let_expression)$/;
  const CALL = /^(call|call_expression|method_invocation|invocation_expression|function_call|function_call_expression|member_call_expression|scoped_call_expression|nullsafe_member_call_expression|method_call|message_expression|macro_invocation|command|application_expression)$/;
  const BLOCKISH = /^(block|statement_block|compound_statement|body|do_group|statement_list|statements|function_body|block_body|body_statement|then|else|suite|do_block|consequence|declaration_list|class_body|template_body|contract_body|container_body|field_declaration_list|control_structure_body|switch_body|switch_block|expression_list|block_node|implementation_definition|enum_class_body|protocol_body|structure|chunk|program|constructor_body|interface_body|annotation_type_body|record_body|computed_property|getter|function_block|unsafe_block|async_block|block_expression|block_statement)$/;
  const IDENT = /^(identifier|type_identifier|simple_identifier|constant|name|word|symbol|value_name|module_name|type_constructor|property_identifier|field_identifier|value_identifier|constructor_name|alias|variable_name|bare_key|tag_name)$/;
  const VOID = /^(void|Unit|unit|\(\)|None|nil|Void|!void|undefined|never|noreturn)$/;
  const PRINT = /^(print|println|printf|puts|echo|printLn|print_endline|print_string|printfn|console\.(log|info)|fmt\.(Print|Println|Printf)|System\.out\.(println|print|printf)|Console\.(WriteLine|Write)|NSLog|io\.write|IO\.puts|IO\.inspect|std\.debug\.print|message|Printf\.printf|Js\.log\d?|Debug\.Log|log\.Print(ln|f)?|writeln|say|p|pp|dump|var_dump|print_r|printf|cout)$/;

  function identText(f) {
    if (!f) return null;
    if (IDENT.test(f.type)) return f.text;
    let id = null;
    for (const x of walk(f)) { if (/identifier$|^(name|constant|symbol|word|value_name)$/.test(x.type) && x.type !== 'type_identifier') { id = x; break; } }
    if (!id) for (const x of walk(f)) { if (IDENT.test(x.type)) { id = x; break; } }
    return id ? id.text : flat(f.text);
  }
  function defaultName(n) {
    const f = field(n, 'name') || field(n, 'declarator') || field(n, 'pattern');
    if (f) return identText(f);
    const id = named(n).find(c => IDENT.test(c.type));
    return id ? id.text : null;
  }
  function defaultParams(n) {
    let p = field(n, 'parameters') || field(n, 'params');
    if (!p) { const d = field(n, 'declarator'); if (d) for (const x of walk(d)) if (x.type === 'parameter_list') { p = x; break; } }
    if (!p) p = named(n).find(c => /^(parameters|parameter_list|formal_parameters|function_value_parameters|method_parameters|lambda_parameters|parameter_clause|function_parameters)$/.test(c.type));
    if (!p) {
      const direct = named(n).filter(c => /^(parameter|method_parameter|parameter_declaration)$/.test(c.type));
      return direct.map(c => flat(c.text).replace(/^:\s*/, ''));
    }
    return named(p).filter(c => !isComment(c)).map(c => flat(c.text));
  }
  function defaultReturns(n) {
    const r = field(n, 'return_type') || field(n, 'result') || field(n, 'returns');
    return r ? flat(r.text).replace(/^(->|:)\s*/, '') : '';
  }
  function calleeOf(n) {
    const f = field(n, 'function') || field(n, 'macro') || field(n, 'callee') || field(n, 'target');
    if (f) return flat(f.text);
    const args = field(n, 'arguments');
    if (args && args.startIndex > n.startIndex && (field(n, 'name') || field(n, 'method'))) return flat(n.text.slice(0, args.startIndex - n.startIndex));
    const m = field(n, 'method') || field(n, 'name');
    if (m) { const r = field(n, 'receiver') || field(n, 'object') || field(n, 'scope'); return flat((r ? r.text + '.' : '') + m.text); }
    const first = n.namedChild(0);
    return first ? flat(first.text) : '';
  }
  const lastPart = (s) => String(s).split(/\.|::|:|->|\?\./).pop().replace(/[!?]$/, '').replace(/^@/, '');
  function argsOf(n) {
    const a = field(n, 'arguments') || named(n).find(c => /^(arguments|argument_list|value_arguments|call_suffix|args)$/.test(c.type));
    if (!a && n.type === 'application_expression') return named(n).filter(c => diff(c, field(n, 'function'))).filter(c => !isComment(c));
    if (!a) return n.type === 'call_expression' ? named(n).slice(1).filter(c => !isComment(c) && !/lambda|block|type_arguments/.test(c.type)) : [];
    let list = named(a);
    if (list.length === 1 && /^(value_arguments|expression_list|argument_list)$/.test(list[0].type)) list = named(list[0]);
    return list.filter(c => !isComment(c) && !/lambda|block|annotated_lambda/.test(c.type));
  }

  /* Words for an expression: operators said in English, the rest kept short. */
  const OPS = { '==': 'is', '===': 'is', 'eq': 'is', '!=': 'is not', '!==': 'is not', '~=': 'is not', '/=': 'is not', '<>': 'is not', 'ne': 'is not', '>': 'is more than', '<': 'is less than', '>=': 'is at least', '<=': 'is at most',
    '&&': 'and', 'and': 'and', 'andalso': 'and', '||': 'or', 'or': 'or', 'orelse': 'or', '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by', '%': 'mod', '..': 'joined to', '++': 'followed by', '+.': 'plus', '*.': 'times', '-.': 'minus', '/.': 'divided by', '^': 'joined to', '<>!': 'joined to' };
  function words(n, lang) {
    if (!n) return '';
    const t = n.type;
    if (/^(parenthesized_expression|parenthesized|condition_clause|paren_expression|parenthesized_condition|expression|condition|equals_value_clause|arrow_expression_clause|call_argument|argument|value_argument)$/.test(t) && n.namedChildCount === 1) return words(n.namedChild(0), lang);
    if (/^(unary_expression|receive_expression)$/.test(t) && /^<-/.test(n.text)) return `a value from the channel ${short(n.text.replace(/^<-\s*/, ''), 40)}`;
    if (/binary|infix|comparison|boolean_operator|logical/.test(t) && n.namedChildCount >= 2) {
      let op = field(n, 'operator');
      op = op ? op.text : (() => { for (let i = 0; i < n.childCount; i++) { const c = n.child(i); if (!c.isNamed()) return c.type; } return ''; })();
      if (op === '.' && lang === 'php') op = '..';
      if (op === '<>' && lang === 'elixir') op = '<>!';
      if (op === '^' && lang !== 'ocaml') op = '';
      const w = OPS[op];
      const l = field(n, 'left') || n.namedChild(0), r = field(n, 'right') || n.namedChild(n.namedChildCount - 1);
      // keep the brackets around a calculation inside a calculation: (a + b) mod c
      const side = (x) => /^(parenthesized_expression|parenthesized)$/.test(x.type) && x.namedChildCount === 1 && /binary|infix/.test(x.namedChild(0).type) && !/^(and|or)$/.test(w) ? `(${words(x.namedChild(0), lang)})` : words(x, lang);
      if (w) return `${side(l)} ${w} ${side(r)}`;
    }
    if (/unary|not_operator|prefix_expression|negation/.test(t)) {
      const op = n.child(0) && !n.child(0).isNamed() ? n.child(0).type : '';
      if (op === '!' || op === 'not') return 'not ' + words(n.namedChild(0), lang);
    }
    if (/^await_expression$/.test(t)) return 'wait for ' + words(n.namedChild(0), lang);
    if (/^(true|True)$/.test(n.text) && n.namedChildCount === 0) return 'yes';
    if (/^(false|False)$/.test(n.text) && n.namedChildCount === 0) return 'no';
    if (/^(null|nil|None|nullptr|NULL|undefined|nothing)$/.test(n.text) && n.namedChildCount === 0) return 'nothing';
    const s = flat(n.text);
    let m = s.match(/^(.+?)\.(length|size\(\)|count\(\)|len\(\)|Length|Count)$/) || s.match(/^(?:len|count|length|strlen)\((.+)\)$/) || s.match(/^#(\w[\w.]*)$/);
    if (m && m[1].length < 50) return `the number of items in ${m[1]}`;
    return short(s);
  }

  /* Plain steps for a list of statements (function bodies, top-level code), like cppStepLines. */
  function stepLines(nodes, C, limit = 16) {
    const out = [];
    const pad = (d) => '    '.repeat(d);
    // in languages where a block's last value is its result, a bare value is what gets given back
    const VALUE = /^(identifier|simple_identifier|value_identifier|value_name|constant|integer|float|number|string|true|false|nil|none|tuple|list|array|map|record|struct_expression|template_string|constructor_path|field_expression|binary_expression|infix_expression|string_literal|integer_literal|line_string_literal|interpolated_string_expression|unit|variant|object|self|instance_variable|interpolated_string|call_expression|application_expression|symbol|jsx_element|jsx_self_closing_element|jsx_fragment|record_expression|list_expression|tuple_expression|constructor_expression)$/;
    const raw = (n, d) => out.push(pad(d) + (VALUE.test(n.type) && (C.explicitReturn === false || C.tail) && !(C.tail && C.tail(n) === false && C.explicitReturn !== false) ? 'give back ' + words(n, C.id) : `${C.short}: ` + short(n.text, 80)));
    const stmts = (b) => {
      if (!b) return [];
      if (BLOCKISH.test(b.type) || (C.blocks && C.blocks.test(b.type))) {
        const kids = named(b);
        if (kids.length === 1 && (BLOCKISH.test(kids[0].type) || (C.blocks && C.blocks.test(kids[0].type)))) return stmts(kids[0]);
        return kids;
      }
      return [b];
    };
    const block = (b, d) => { for (const s of stmts(b)) visit(s, d); };
    const say = (n) => words(n, C.id);
    const visit = (n, d) => {
      if (out.length > limit) return;
      let t = n.type;
      if (isComment(n)) { out.push(pad(d) + 'note: ' + short(n.text.replace(/^(\/\/+!?|#+|--+|;+|\/\*+|\(\*)\s?|\*+\/$|\*\)$/g, ''), 80)); return; }
      if (C.step) { const r = C.step(n, d, { out, pad, block, visit, say, stmts, raw }); if (r !== undefined) return; }
      if ((t === 'expression_statement' || t === 'statement' || t === 'expression' || t === 'labeled_statement' || t === 'block_expression') && n.namedChildCount === 1) { visit(n.namedChild(0), d); return; }
      if (t === 'try_expression' && n.namedChildCount === 1 && !/catch/.test(n.text)) { const before = out.length; visit(n.namedChild(0), d); if (out.length > before) out[before] += ' (if it fails, pass the error back)'; return; }
      if (BLOCKISH.test(t)) { block(n, d); return; }
      const jump = /^(control_transfer_statement|jump_expression)$/.test(t) ? (n.text.match(/^(throw|return|break|continue)/) || [])[1] : null;
      const kind = (jump && { throw: 'throw', return: 'return', break: 'break', continue: 'continue' }[jump]) || (C.kinds && C.kinds[t]) || (
        /^(if_statement|if_expression|if|unless|if_modifier|unless_modifier|guard_statement|if_let_expression)$/.test(t) ? 'if'
        : /^(return_statement|return_expression|return)$/.test(t) ? 'return'
        : /^(throw_statement|throw_expression|raise_statement|raise)$/.test(t) ? 'throw'
        : /^(try_statement|try_expression|begin|try_block|do_statement)$/.test(t) && /catch|rescue|except|finally|ensure/.test(n.text) ? 'try'
        : /^(break_statement|break_expression|break)$/.test(t) ? 'break'
        : /^(continue_statement|continue_expression|next|continue)$/.test(t) ? 'continue'
        : /^(defer_statement|defer|errdefer_statement)$/.test(t) ? 'defer'
        : /^(go_statement)$/.test(t) ? 'go'
        : /^(switch_statement|switch_expression|match_expression|match_statement|when_expression|case|case_statement|expression_switch_statement|type_switch_statement|select_statement)$/.test(t) ? 'switch'
        : LOOP.test(t) ? 'loop'
        : /^(let_declaration|lexical_declaration|variable_declaration|local_variable_declaration|short_var_declaration|var_declaration|const_declaration|property_declaration|local_declaration_statement|declaration|assignment|variable_assignment|assignment_statement|assignment_expression|augmented_assignment|augmented_assignment_expression|compound_assignment_expr|operator_assignment|val_definition|var_definition|let_binding|local_variable_declaration_statement|init_declarator|variable_definition_statement)$/.test(t) ? 'set'
        : /^(update_expression|inc_statement|dec_statement|postfix_expression|postfix_unary_expression|prefix_unary_expression)$/.test(t) && /\+\+|--/.test(n.text) ? 'bump'
        : CALL.test(t) ? 'call'
        : t === 'await_expression' ? 'await'
        : null);
      if (kind === 'if') {
        const cond = field(n, 'condition') || named(n).find(c => !isComment(c) && !BLOCKISH.test(c.type) && !/else|elif|elsif/.test(c.type));
        const word = /unless/.test(t) ? 'unless' : t === 'guard_statement' ? 'make sure that' : 'if';
        out.push(pad(d) + `${word} ${say(cond)}`);
        const then = field(n, 'consequence') || field(n, 'body') || named(n).find(c => diff(c, cond) && (BLOCKISH.test(c.type) || (C.blocks && C.blocks.test(c.type))));
        if (then) block(then, d + 1);
        else for (const b of named(n).filter(c => diff(c, cond) && !isComment(c) && !/^(else|elif|elsif|elseif|else_if)(_clause|_statement|_block)?$/.test(c.type) && diff(c, field(n, 'alternative')))) visit(b, d + 1);
        const alts = [field(n, 'alternative')].concat(named(n).filter(c => /^(else|elif|elsif|elseif|else_if)(_clause|_statement|_block)?$/.test(c.type))).filter(Boolean);
        const seen = new Set();
        for (const a of alts) {
          if (seen.has(a.id)) continue; seen.add(a.id);
          const inner = /^else(_clause)?$/.test(a.type) && a.namedChildCount === 1 ? a.namedChild(0) : null;
          if (/elif|elsif|elseif|else_if/.test(a.type) || (inner && /^(if_statement|if_expression|if)$/.test(inner.type)) || /^(if_statement|if_expression)$/.test(a.type)) {
            const ifn = inner && /^(if_statement|if_expression|if)$/.test(inner.type) ? inner : /^(if_statement|if_expression)$/.test(a.type) ? a : null;
            if (ifn) { out.push(pad(d) + 'otherwise…'); visit(ifn, d + 1); }
            else { const c2 = field(a, 'condition') || named(a)[0]; out.push(pad(d) + `otherwise, if ${say(c2)}`); block(field(a, 'consequence') || field(a, 'body') || named(a).find(c => diff(c, c2) && BLOCKISH.test(c.type)) || named(a)[1], d + 1); }
          } else {
            out.push(pad(d) + (t === 'guard_statement' ? 'if not' : 'otherwise'));
            const eb = inner || field(a, 'body') || named(a).find(c => BLOCKISH.test(c.type));
            if (!/else/.test(a.type) && !BLOCKISH.test(a.type)) visit(a, d + 1);
            else if (eb) block(eb, d + 1); else for (const c of named(a)) visit(c, d + 1);
          }
        }
        return;
      }
      if (kind === 'loop') {
        let body = field(n, 'body') || named(n).filter(c => BLOCKISH.test(c.type) || (C.blocks && C.blocks.test(c.type))).pop();
        const payload = childOf(n, /^payload$/);
        const left = field(n, 'left') || field(n, 'pattern') || field(n, 'variable') || field(n, 'item') || (t === 'enhanced_for_statement' ? field(n, 'name') : null) || payload;
        const right = field(n, 'right') || field(n, 'value') || field(n, 'collection') || field(n, 'iterable') || (payload ? named(n)[0] : null);
        const headText = flat(body && body.startIndex > n.startIndex ? n.text.slice(0, body.startIndex - n.startIndex) : header(n)).replace(/\s*(\{|do|:)\s*$/, '');
        const forIn = headText.match(/^for\s*\(?\s*(?:[A-Z]\w*\s*\*\s*|[A-Z]\w*\s+|(?:var|let|const|final|auto)\s+)?(\w+)\s+in\s+(.+?)\)?$/);
        const counting = headText.match(/^for\s*\(\s*(?:[\w:<>]+\s+)?(\w+)\s*=\s*([^;]+);\s*\1\s*(<=?|>=?)\s*([^;]+);\s*(\1\s*(\+\+|--|\+=\s*1|-=\s*1)|(\+\+|--)\1)\s*\)?$/);
        if (/while|until/.test(t) && !/do_while/.test(t) || (t === 'for_statement' && !left && !counting && field(n, 'condition') && !field(n, 'initializer'))) {
          const cond = field(n, 'condition') || named(n).find(c => diff(c, body) && !/assignment/.test(c.type));
          out.push(pad(d) + `${/until/.test(t) ? 'until' : 'while'} ${say(cond)}`);
        } else if (/do_while|repeat/.test(t) || (t === 'do_statement' && /while/.test(n.text))) {
          out.push(pad(d) + 'repeat, then check: ' + short(flat(n.text).replace(/^[\s\S]*\b(while|until)\b/, '$1'), 60));
        } else if (t === 'loop_expression') out.push(pad(d) + 'repeat forever (until something stops it)');
        else if (counting) {
          const [, v, from, op, to] = counting;
          const up = op[0] === '<';
          out.push(pad(d) + (up && op === '<' && from.trim() === '0' ? `repeat ${to.trim()} times, counting with ${v}` : `count ${v} from ${from.trim()} ${up ? 'up' : 'down'} to ${to.trim()}` + (op.length === 1 ? ' (not including it)' : '')));
        }
        else if (left && right && body && diff(left, right)) out.push(pad(d) + `for each ${flat(left.text).replace(/^\(|\)$|^\||\|$/g, '')} in ${say(right)}`);
        else if (forIn) out.push(pad(d) + `for each ${forIn[1]} in ${short(forIn[2], 50)}`);
        else if (/^foreach\s*\(([\s\S]+?)\s+as\s+([^)]+)\)/.test(flat(n.text))) { const m = flat(n.text).match(/^foreach\s*\(([\s\S]+?)\s+as\s+([^)]+)\)/); out.push(pad(d) + `for each ${m[2]} in ${short(m[1], 50)}`); }
        else if (t === 'for_numeric_statement') out.push(pad(d) + `count ${flat((field(n, 'name') || named(n)[0]).text)} from ${say(field(n, 'start') || named(n)[1])} to ${say(field(n, 'end') || named(n)[2])}`);
        else {
          const init = field(n, 'initializer'), cond = field(n, 'condition');
          const m = init && cond && flat(init.text).match(/^(?:\w+\s+)?(\w+)\s*(?::=|=)\s*0;?$/) && flat(cond.text).match(/^(\w+)\s*<\s*(.+?);?$/);
          out.push(pad(d) + (m ? `repeat ${m[2]} times, counting with ${m[1]}` : 'repeat: ' + short(headText, 60)));
        }
        if (!body) body = named(n).filter(c => /statement$|expression$/.test(c.type) && !/^(binary|assignment|update|parenthesized)/.test(c.type)).pop();
        if (body) block(body, d + 1);
        return;
      }
      if (kind === 'return') {
        const v = named(n).find(c => !isComment(c) && !/keyword$/.test(c.type));
        const rest = flat(n.text).replace(/^return\b\s*/, '').replace(/;$/, '');
        out.push(pad(d) + (v ? 'give back ' + say(v.type === 'expression_list' && v.namedChildCount === 1 ? v.namedChild(0) : v) : rest ? 'give back ' + (/^(null|nil|None)$/.test(rest) ? 'nothing' : short(rest)) : 'stop here'));
        return;
      }
      if (kind === 'throw') { const v = named(n).find(c => !/keyword$/.test(c.type)); out.push(pad(d) + 'fail with ' + (v ? say(v) : 'an error')); return; }
      if (kind === 'break') { out.push(pad(d) + 'stop the loop'); return; }
      if (kind === 'continue') { out.push(pad(d) + 'skip to the next round of the loop'); return; }
      if (kind === 'defer') { out.push(pad(d) + 'when this tool finishes: ' + short(n.text.replace(/^(err)?defer\s*/, ''), 60)); return; }
      if (kind === 'go') { out.push(pad(d) + 'start this in the background (a goroutine): ' + short(n.text.replace(/^go\s*/, ''), 60)); return; }
      if (t === 'send_statement') { out.push(pad(d) + `send ${say(field(n, 'value') || named(n)[1])} into the channel ${short(textOf(field(n, 'channel') || named(n)[0]), 40)}`); return; }
      if (/^<-\s*\w/.test(n.text) && /unary|receive/.test(t)) { out.push(pad(d) + `wait for ${say(n)}`); return; }
      if (kind === 'await') { out.push(pad(d) + say(n)); return; }
      if (kind === 'try') {
        out.push(pad(d) + 'try');
        const body = field(n, 'body') || named(n).find(c => BLOCKISH.test(c.type));
        if (body) block(body, d + 1);
        for (const c of named(n)) {
          if (/catch|rescue|except/.test(c.type)) { out.push(pad(d) + 'if it fails'); block(field(c, 'body') || named(c).filter(x => BLOCKISH.test(x.type)).pop() || c, d + 1); }
          else if (/finally|ensure/.test(c.type)) { out.push(pad(d) + 'in every case, afterwards'); block(field(c, 'body') || named(c).find(x => BLOCKISH.test(x.type)) || c, d + 1); }
        }
        return;
      }
      if (kind === 'switch') {
        const subj = field(n, 'value') || field(n, 'condition') || field(n, 'subject') || named(n).find(c => !BLOCKISH.test(c.type) && !/case|arm|entry|match|clause|when|section|group/.test(c.type));
        out.push(pad(d) + `check ${subj ? say(subj) : 'which case applies'}`);
        const arms = [];
        const findArms = (x) => { for (const c of named(x)) { if (BLOCKISH.test(c.type) || /(_block|_body|match_block)$/.test(c.type)) findArms(c); else if (/arm|case|entry|section|switch_match|when_clause|match_case|in_clause|expression_case|type_case|default|block_statement_group|communication_case|switch_rule|stab_clause/.test(c.type) && diff(c, subj)) arms.push(c); } };
        findArms(n);
        for (const a of arms.slice(0, 8)) {
          // the pattern is everything before the arm's arrow (=>, ->) or colon
          let sep = null;
          for (let i = 0; i < a.childCount; i++) { const c = a.child(i); if (!c.isNamed() && /^(=>|->|:)$/.test(c.type) && i > 0) { sep = c; break; } }
          const isDefault = /default|else/.test(a.type) || /^(default|else|_)\b/.test(flat(a.text)) || /^case\s+_\s*=>/.test(flat(a.text));
          const pat = isDefault ? null : sep ? null : field(a, 'pattern') || field(a, 'value') || named(a)[0];
          const patText = sep ? flat(a.text.slice(0, sep.startIndex - a.startIndex)).replace(/^(case|when|\|)\s+/, '') : pat ? flat(pat.text) : '';
          let rest = sep ? named(a).filter(c => c.startIndex >= sep.endIndex && !isComment(c)) : named(a).filter(c => diff(c, pat) && !isComment(c) && c.type !== 'else');
          if (rest.length === 1 && BLOCKISH.test(rest[0].type) && named(rest[0]).length === 1 && !/statement|declaration/.test(named(rest[0])[0].type)) rest = named(rest[0]);
          if (rest.length === 1 && rest[0].type === 'statements' && named(rest[0]).length === 1) rest = named(rest[0]);
          const label = isDefault ? 'otherwise' : `when ${patText ? short(patText, 40) : '…'}`;
          if (rest.length === 1 && !BLOCKISH.test(rest[0].type) && !/statement|declaration/.test(rest[0].type)) out.push(pad(d + 1) + `${label}: ${say(rest[0])}`);
          else { out.push(pad(d + 1) + label); for (const r of rest) visit(r, d + 2); }
        }
        if (arms.length > 8) out.push(pad(d + 1) + `(and ${arms.length - 8} more cases)`);
        return;
      }
      if (kind === 'set' || kind === 'bump') {
        if (kind === 'bump') { out.push(pad(d) + `${/\+\+/.test(n.text) ? 'increase' : 'decrease'} ${flat(n.text).replace(/\+\+|--|;/g, '')} by 1`); return; }
        // the declarators inside (int a = 1, b = 2; var x = …), looked for two levels down
        let decls = [];
        for (const c of named(n)) {
          if (/(variable_declarator|init_declarator|const_spec|var_spec)$/.test(c.type)) decls.push(c);
          else if (/^(variable_declaration|let_binding)$/.test(c.type) && c.type !== n.type) { const inner = named(c).filter(x => /(variable_declarator|init_declarator)$/.test(x.type)); decls.push(...(inner.length ? inner : field(c, 'value') || field(c, 'body') ? [c] : [])); }
        }
        if (!decls.length) decls = [n];
        for (const dn of decls) {
          let name = field(dn, 'left') || field(dn, 'name') || field(dn, 'pattern') || field(dn, 'declarator');
          let value = field(dn, 'right') || field(dn, 'value') || field(dn, 'init') || field(dn, 'body') || childOf(dn, /^equals_value_clause$/);
          if (value && value.type === 'equals_value_clause') value = named(value)[0];
          const kids = named(dn).filter(c => !isComment(c) && !/^(modifiers|binding_pattern_kind|value_binding_pattern|type_annotation|visibility_modifier|mutable_specifier|storage_class_specifier|type_qualifier|attribute)$/.test(c.type));
          if (!name) name = kids.length >= 2 ? kids[0] : kids.find(c => IDENT.test(c.type) || /variable_list|variable_declaration|^pattern$|assignable_expression|^lhs$/.test(c.type)) || kids[0];
          if (!value && kids.length >= 2 && diff(kids[kids.length - 1], name) && !/type/.test(kids[kids.length - 1].type)) value = kids[kids.length - 1];
          if (value && value.type === 'expression_list' && value.namedChildCount === 1) value = value.namedChild(0);
          const nm = name ? flat(name.text).replace(/^(let|var|val|const|local|mut)\s+/, '').replace(/:.*$/, '').replace(/^[*&]+\s*/, '').trim() : '?';
          let op = ''; for (let i = 0; i < dn.childCount; i++) { const c = dn.child(i); if (!c.isNamed() && /=$/.test(c.type)) { op = c.type; break; } }
          if (/^[-+*/]=$|^\.\.=$|^\|\|=$|^<<=$/.test(op) || dn.type === 'operator_assignment' && /\+=|-=/.test(dn.text)) {
            const o = op || (dn.text.match(/[-+]=/) || ['+='])[0];
            out.push(pad(d) + `${o === '+=' ? 'increase' : o === '-=' ? 'decrease' : 'change'} ${nm} by ${say(value)}`);
          } else if (value && /lambda|closure|arrow_function|function_expression|anonymous_function|^function$|^fn$/.test(value.type)) out.push(pad(d) + `define ${nm} (a small tool)`);
          else out.push(pad(d) + (value ? `set ${nm} to ${say(value)}` : `create ${nm}`));
        }
        return;
      }
      if (kind === 'call') {
        const fn = calleeOf(n);
        const tt = n.type === 'macro_invocation' && childOf(n, /^token_tree$/);
        const args = tt ? (flat(tt.text.slice(1, -1)) ? [short(tt.text.slice(1, -1), 60)] : []) : argsOf(n).map(say);
        const each = flat(n.text).match(/^(.+?)\.(each|forEach|foreach|for_each|each_with_index|each_pair|forEachIndexed|map|filter|select)\b/);
        const findBlock = (x, depth) => { for (const c of named(x)) { if (/^(block|do_block|lambda|lambda_literal|annotated_lambda|closure_expression|lambda_expression|arrow_function|function_expression|anonymous_function)$/.test(c.type)) return c; if (depth && /^(call_suffix|arguments|argument_list|value_arguments|value_argument)$/.test(c.type)) { const f = findBlock(c, depth - 1); if (f) return f; } } return null; };
        const blockNode = findBlock(n, 3);
        const inner = (b) => { let x = b; for (let i = 0; i < 4 && x; i++) { const body = field(x, 'body') || named(x).find(c => BLOCKISH.test(c.type)); if (body) return body; x = named(x).find(c => /lambda|block|closure/.test(c.type)); } return null; };
        if (each && /each|forEach|foreach|for_each/.test(each[2]) && blockNode) {
          const params = (flat(blockNode.text).match(/^\{?\s*\|([^|]+)\||^\{\s*\(?([\w, ]+?)\)?\s*->|^\(?([\w, ]+?)\)?\s*=>|^do\s*\|([^|]+)\|/) || []).slice(1).find(Boolean);
          out.push(pad(d) + `for each ${params ? params.trim() : 'item'} in ${short(each[1], 50)}`);
          const body = inner(blockNode);
          if (body) block(body, d + 1); else out.push(pad(d + 1) + say(blockNode));
          return;
        }
        if (PRINT.test(fn) || (C.print && C.print.test(fn))) { out.push(pad(d) + 'show ' + (args.length ? args.join(' and ') : 'an empty line')); return; }
        if (/^(raise|panic|error|abort|die|fail|throw|revert|user-error|signal)$/.test(fn.replace(/!$/, ''))) { out.push(pad(d) + 'fail with ' + (args.length ? args.join(', ') : 'an error')); return; }
        out.push(pad(d) + `run ${short(fn.replace(/\s*\{[\s\S]*$/, ''), 50)}` + (args.length ? ' with ' + args.join(', ') : ''));
        const body = blockNode && inner(blockNode);
        if (body && stmts(body).length && stmts(body).length <= 12) { out[out.length - 1] += ', which runs:'; block(body, d + 1); }
        return;
      }
      raw(n, d);
    };
    for (const n of nodes) visit(n, 0);
    return { steps: out.slice(0, limit), more: out.length > limit };
  }

  /* Facts found by walking some code: loops, decisions, calls, errors, effects. */
  const EFFECTS = [
    [/^(open|fopen|File\.(open|read|write|exists|ReadAllText|WriteAllText|readlines)|io\.open|os\.(Open|Create|ReadFile|WriteFile)|fs\.\w+|readFile\w*|writeFile\w*|read_to_string|ioutil\.\w+|file_get_contents|file_put_contents|fwrite|fread|Files\.\w+|NSFileManager|FileManager|with_open_file|find-file|insert-file-contents)$/, 'works with files'],
    [/^(fetch|urlopen|requests\.\w+|axios(\.\w+)?|httpx\.\w+|reqwest::\w+|http\.(Get|Post|Head|NewRequest|PostForm)|HttpClient|URLSession\.\w+|Net::HTTP\.\w+|HTTParty\.\w+|Faraday\.\w+|curl_exec|curl_init|Http\.(get|post|request)|dio\.\w+|url-retrieve\w*)$|\.(GetAsync|PostAsync|SendAsync|getForObject|dataTask|GetStringAsync)$/, 'talks to other computers over the network'],
    [/(^|\.)(query|execute|executemany|exec|prepare|QueryRow|Query|Exec|find|findOne|findMany|insert|insertOne|where|save|create|update|destroy|findOrFail|first|all)$/, 'reads or changes stored data'],
    [/^(sleep|time\.Sleep|Thread\.sleep|Task\.Delay|delay|usleep|os\.sleep|sleep-for|std\.time\.sleep|setTimeout)$/, 'waits'],
    [/random|^rand$|^rand\.|Random|arc4random|math\.random|SecureRandom/, 'uses random numbers'],
    [/^(exit|os\.Exit|process\.exit|System\.exit|Environment\.Exit|abort|die|kill-emacs|std\.process\.exit)$/, 'can stop the whole program'],
    [/^(log|logger|Logger|log\.\w+|logger\.\w+|Logger\.\w+|NSLog|console\.(error|warn)|warn|logging\.\w+|slog\.\w+|tracing::\w+|error!|warn!|info!|debug!)$/, 'writes to a log'],
    [/^(system|exec|spawn|popen|subprocess\.\w+|os\.system|Process\.Start|exec\.Command|Runtime\.getRuntime|shell_exec|passthru|proc_open|`|call-process|shell-command)/, 'runs other programs'],
  ];
  function facts(nodes, C, ctx, self) {
    const f = { loops: 0, decisions: 0, returns: 0, calls: [], effects: [], throws: [], catches: false, awaits: false, recursion: false, warnings: [], callees: [], lambdas: 0 };
    for (const top of nodes) for (const n of walk(top)) {
      const t = n.type;
      if ((C.loop && C.loop.test(t)) || (LOOP.test(t) && !(C.notLoop && C.notLoop.test(t)))) f.loops++;
      else if ((C.decide && C.decide.test(t)) || DECIDE.test(t)) f.decisions++;
      else if (/^(return_statement|return_expression|return)$/.test(t) && n.namedChildCount) f.returns++;
      else if (/^(throw_statement|throw_expression|raise_statement)$/.test(t)) add(f.throws, short((n.namedChild(0) || n).text.replace(/^new\s+/, '').replace(/\(.*$/s, ''), 40));
      else if (/catch_clause|rescue|except_clause|catch_block|catch_declaration/.test(t)) {
        f.catches = true;
        const body = field(n, 'body') || named(n).filter(c => BLOCKISH.test(c.type)).pop();
        if (body && named(body).filter(c => !isComment(c)).length === 0 && BLOCKISH.test(body.type)) add(f.warnings, 'Catches an error and does nothing with it, so problems can fail silently.');
      } else if (t === 'await_expression' || t === 'await') f.awaits = true;
      else if (/^(lambda|lambda_expression|closure_expression|arrow_function|anonymous_function|function_literal|block|do_block|lambda_literal|anonymous_function_creation_expression)$/.test(t)) f.lambdas++;
      else if (t === 'string' || /string_literal$|^interpreted_string_literal$|^raw_string_literal$/.test(t)) {
        if (/^["'`]?http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(unquote(n.text).replace(/^["']/, '')) || /^["']http:\/\/(?!localhost|127\.)/.test(n.text)) add(f.warnings, `Uses ${code(short(unquote(n.text), 60))}, which is not encrypted (http, not https).`);
      }
      if (CALL.test(t) || (C.call && C.call.test(t))) {
        const fn = calleeOf(n);
        if (!fn) continue;
        add(f.callees, fn);
        const simple = lastPart(fn);
        if (/^(raise|panic|panic!|error|throw|revert|fail|die|abort|signal|user-error)$/.test(simple) || /^(error|panic)!?$/.test(fn)) add(f.throws, short(fn + (argsOf(n)[0] ? ' ' + argsOf(n)[0].text : ''), 40));
        for (const [re, eff] of EFFECTS) if (re.test(fn) || re.test(simple)) { if (eff !== 'reads or changes stored data' || /^(db|database|cursor|conn|connection|session|pool|repo|repository|query|sql|knex|prisma|collection|\$?(user|order|model|product|customer)s?|User|Order|Model|Product|Customer)\b|(Repository|Model|Dao|DB)\b/.test(fn)) add(f.effects, eff); }
        if (PRINT.test(fn) || (C.print && C.print.test(fn))) add(f.effects, 'shows text');
        if (/^(eval|exec|Function|instance_eval|class_eval|eval-buffer|load-string|loadstring|dostring|evaluate)$/.test(simple) && !ctx.localFns.has(simple)) add(f.warnings, `Uses ${code(fn)}, which runs text as code. That is risky if the text comes from users.`);
        const isLocal = ctx.localFns.has(simple) && (fn === simple || /^(self|this|Self|super|@|it)\b/.test(fn) || (self && self.owner && fn.startsWith(self.owner + '.')) || (self && self.receiver && fn.startsWith(self.receiver + '.')) || ctx.ownerOf[simple] === fn.split(/\.|::|:/)[0]);
        if (self && simple === self.name && isLocal) f.recursion = true;
        else if (isLocal) add(f.calls, simple);
      }
      // secrets written into the code
      if (/assign|declarat|pair|property|binding|field|const|variable|let|short_var|init_declarator/.test(t)) {
        const kids = named(n);
        const nm = field(n, 'left') || field(n, 'name') || field(n, 'key') || field(n, 'pattern') || kids[0];
        let val = field(n, 'right') || field(n, 'value') || kids[kids.length - 1];
        if (val && /^(expression_list|equals_value_clause|literal_value)$/.test(val.type) && val.namedChildCount === 1) val = val.namedChild(0);
        if (nm && val && diff(nm, val) && nm.text.length < 60 && SECRET.test(nm.text) && /string/.test(val.type) && unquote(val.text).length >= 8 && !/[{$]/.test(val.text))
          add(f.warnings, `${code(short(nm.text, 40))} looks like a secret written straight into the code. Anyone who can see the code can read it; keep it in a setting outside the code instead.`);
      }
    }
    return f;
  }

  /* TODO / FIXME notes in a range of lines. */
  function notesIn(lines, start, end) {
    const out = [];
    for (let i = start - 1; i < end && i < lines.length; i++) {
      const m = lines[i] && lines[i].match(/(?:\/\/|#|--|;|\/\*|\*|\(\*|<!--|%)\s*(TODO|FIXME|HACK|XXX)\b:?\s*(.*?)(?:\*\/|\*\)|-->)?\s*$/);
      if (m) out.push(`Line ${i + 1} has a ${m[1]} note: ${m[2].trim() || '(no details)'}`);
    }
    return out;
  }
  /* The comment lines just above a line (doc comments included), as one sentence. */
  function commentAbove(lines, row, C) {
    const out = [];
    for (let i = row - 1; i >= 0; i--) {
      const t = lines[i].trim();
      if (C.commentLine.test(t) && !/^#!/.test(t)) out.unshift(t);
      else break;
    }
    return out.map(t => t.replace(C.commentStrip || /^(\/\/\/?!?|\/\*\*?|\*\/|\*|#+|--+|;+|\(\*+|\*+\))\s?/, '').replace(/\*\/$|\*\)$/, '').trim())
      .filter(x => x && !/^[-=*#~ ]+$/.test(x) && !/^@\w+/.test(x) && !/^SPDX-License/.test(x)).join(' ');
  }
  function startWithComments(lines, row, C, floor = 0) {
    let s = row;
    while (s > 1 && s - 1 > floor && C.commentLine.test(lines[s - 2].trim()) && !/^#!/.test(lines[s - 2].trim())) s--;
    return s;
  }

  /* ------------------------------------------------------------------ */
  /* Sections from a parse                                               */
  /* ------------------------------------------------------------------ */

  function classify(n, C, ctx, owner) {
    let d = C.types[n.type];
    if (typeof d === 'function') d = d(n, ctx, owner);
    if (typeof d === 'string') d = { k: d };
    return d ? { ...d } : null;
  }
  function collect(nodes, C, ctx, owner) {
    const items = [];
    let attrs = [];
    for (const n of nodes) {
      if (isComment(n) || n.type === 'ERROR' && !n.text.trim()) continue;
      const d = classify(n, C, ctx, owner) || { k: owner ? 'skip' : 'steps' };
      if (d.k === 'attr') { attrs.push(n); continue; }
      if (d.k === 'skip') { attrs = []; continue; }
      if (d.k === 'container') {
        if (d.name) add(ctx.packages, d.name);
        items.push(...collect(d.body ? named(d.body) : named(n).filter(c => diff(c, d.nameNode)), C, ctx, owner));
        attrs = [];
        continue;
      }
      if (!d.name && /^(fn|class|type|test|proto)$/.test(d.k)) d.name = (C.name || defaultName)(n, d) || (d.k === 'fn' ? 'function' : d.k === 'test' ? 'test' : 'type');
      const it = { d, node: n, attrs };
      if (C.adjust) C.adjust(it);
      // several clauses of one function in a row (Elixir) read as one
      const prev = items[items.length - 1];
      if (C.merge && d.k === 'fn' && prev && prev.d.k === 'fn' && prev.d.name === d.name) { prev.d.clauses = (prev.d.clauses || 1) + 1; (prev.clauseDs = prev.clauseDs || [{ d: prev.d, node: prev.node }]).push({ d, node: n }); prev.last = n; attrs = []; continue; }
      items.push(it);
      attrs = [];
    }
    return items;
  }
  const bodyOf = (n, d, C) => d.body || field(n, 'body') || named(n).filter(c => BLOCKISH.test(c.type) || (C.blocks && C.blocks.test(c.type))).pop() || null;
  function membersOf(item, C, ctx) {
    if (item.members) return item.members;
    const body = item.d.members !== undefined ? item.d.members : bodyOf(item.node, item.d, C);
    item.members = body ? collect(Array.isArray(body) ? body : named(body), C, ctx, item.d) : [];
    for (const m of item.members) m.owner = item.d;
    return item.members;
  }

  // "an int", "an Order", but "a uint256", "a Unit", "a UUID"
  const A = (w) => /^(un|[aeio])/i.test(w) && !/^(uni|use|usa|one)/i.test(w) ? 'an' : 'a';
  const TYPE_WORDS = {
    struct: (nm) => `${code(nm)} groups several values together into one thing.`,
    record: (nm) => `${code(nm)} holds a fixed set of values together (a record).`,
    'data class': (nm) => `${code(nm)} holds a fixed set of values together. As a \`data class\` it gets comparing, copying and printing for free.`,
    'case class': (nm) => `${code(nm)} holds a fixed set of values together. As a \`case class\` it gets comparing, copying and pattern matching for free.`,
    enum: (nm) => `${code(nm)} is a list of named choices: each value of it is exactly one of them.`,
    interface: (nm) => `${code(nm)} is an interface: a list of tools that other types promise to provide.`,
    protocol: (nm) => `${code(nm)} is a protocol: a list of tools and values that other types promise to provide.`,
    trait: (nm) => `${code(nm)} is a trait: a list of tools that other types promise to provide.`,
    alias: (nm, d) => `${code(nm)} is another name for ${d.target ? code(short(d.target, 60)) : 'another type'}.`,
    union: (nm) => `${code(nm)} can hold one of several kinds of value (a union).`,
    variant: (nm) => `${code(nm)} is a type whose values come in several named shapes.`,
    exception: (nm) => `${code(nm)} is a kind of error the code can raise.`,
    event: (nm) => `${code(nm)} is an event: a record the contract writes to the blockchain log, which apps outside can watch for.`,
    table: (nm) => `${code(nm)} is a table.`,
  };
  const CLASS_WORDS = {
    class: (nm) => `${code(nm)} is a class: a blueprint for making objects.`,
    'abstract class': (nm) => `${code(nm)} is an abstract class: a starting point for other classes, never made on its own.`,
    struct: (nm) => `${code(nm)} groups several values together and has its own tools.`,
    object: (nm) => `${code(nm)} is a single, shared object: there is only ever one of it.`,
    'companion object': (nm) => `The companion object holds what belongs to the class itself rather than to each object.`,
    module: (nm) => `${code(nm)} is a module: a named group of related tools and values.`,
    namespace: (nm) => `${code(nm)} is a namespace: a named group that keeps these names apart from others.`,
    impl: (nm, d) => d.trait ? `Makes ${code(nm)} follow the trait ${code(d.trait)}: it provides the tools that trait asks for.` : `The tools that belong to ${code(nm)}.`,
    extension: (nm) => `Adds tools to the existing type ${code(nm)}.`,
    contract: (nm) => `${code(nm)} is a smart contract: code and data that live on the blockchain at one address.`,
    library: (nm) => `${code(nm)} is a library: tools other contracts can use.`,
    actor: (nm) => `${code(nm)} is an actor: like a class, but only one task at a time can change its values.`,
    mode: (nm) => `${code(nm)} is an Emacs mode that can be switched on and off.`,
    view: (nm) => `${code(nm)} is a SwiftUI view: a piece of the screen, described by its \`body\`.`,
    widget: (nm) => `${code(nm)} is a Flutter widget: a piece of the screen.`,
    component: (nm) => `${code(nm)} is a component: a reusable piece of the page.`,
    addrmap: (nm) => `${code(nm)} is an address map: where each register sits in memory.`,
  };

  function analyzeTree(lang, path, source) {
    const C = CONFIG[lang];
    const rootNode = parseSafe(lang, source);
    const lines = source.split('\n');
    const ctx = { lang, path, lines, localFns: new Set(), ownerOf: {}, packages: [], imports: [], libs: [], C, source, notes: [] };
    if (C.prepare) C.prepare(rootNode, ctx);
    const items = collect(C.top ? C.top(rootNode, ctx) : named(rootNode), C, ctx, null);
    // the tools this file defines (for "Runs other tools")
    const register = (list, owner) => {
      for (const it of list) {
        if (it.d.k === 'fn') { ctx.localFns.add(lastPart(it.d.name)); if (owner) ctx.ownerOf[lastPart(it.d.name)] = owner.name; if (it.d.owner) ctx.ownerOf[lastPart(it.d.name)] = it.d.owner; }
        if (it.d.k === 'class' || it.d.k === 'type') register(membersOf(it, C, ctx), it.d);
      }
    };
    register(items, null);

    // a note at the top of the file
    const sections = [];
    let aboutEnd = 0;
    const firstItem = items[0];
    const firstRow = firstItem ? Math.min(line(firstItem.node), ...firstItem.attrs.map(line)) : lines.length + 1;
    {
      let i = 0;
      const shebang = /^#!/.test(lines[0] || '');
      if (shebang) i = 1;
      const block = [];
      let j = i;
      for (; j < firstRow - 1; j++) {
        const t = lines[j].trim();
        if (!t) { if (block.length) block.push(''); continue; }
        if (C.commentLine.test(t) || (C.commentBlock && C.commentBlock(lines, j))) block.push(t); else break;
      }
      while (block.length && !block[block.length - 1]) block.pop();
      const separated = j < firstRow - 1 || !lines[firstRow - 2] || !lines[firstRow - 2].trim() || (firstItem && /^(import|package)$/.test(firstItem.d.k));
      const text = commentAbove(block.filter(Boolean), block.filter(Boolean).length, C);
      if ((block.length && separated && text.split(/\s+/).length >= 4) || shebang) {
        aboutEnd = i + block.length;
        while (aboutEnd > 0 && !(lines[aboutEnd - 1] || '').trim()) aboutEnd--;
        const facts = [];
        if (shebang) facts.push(`Its first line says which program runs it: ${code(lines[0].trim())}.`);
        const noteLines = block.filter(Boolean).map(l => l.replace(C.commentStrip || /^(\/\/\/?!?|\/\*\*?|\*\/|\*|#+|--+|;+|\(\*+|\*+\))\s?/, '').replace(/\*\/$|\*\)$/, '').trim()).filter(x => x && !/^[-=*#~ ]+$/.test(x));
        const about = aboutText(noteLines);
        ctx.about = about;
        const rest = flat(noteLines.map(l => l.replace(/-\*-.*?-\*-/g, '').replace(/^[\w.-]+\.\w+\s+---\s+/, '')).filter(l => !/^[\w ]+:$/.test(l) && !/^SPDX-/.test(l)).join(' '));
        if (rest && rest.replace(/[.\s]/g, '') !== about.replace(/[.\s]/g, '')) facts.push('The note says: ' + short(rest, 300));
        sections.push({ kind: 'about', title: 'About this file', headline: about ? cap(about.replace(/[^.!?]$/, '$&.')) : 'How this file is run.', facts, warnings: notesIn(lines, 1, aboutEnd), steps: [], more: false, start: 1, end: Math.max(1, aboutEnd), name: null });
      }
    }

    const span = (it) => {
      const first = Math.min(line(it.node), ...it.attrs.map(line));
      return [startWithComments(lines, first, C, aboutEnd), endLine(it.last || it.node)];
    };
    const firstLine = (it) => Math.min(line(it.node), ...it.attrs.map(line));
    const libPhrase = (l) => { const k = C.libs && (C.libs[l] || C.libs[l.split(/[./:\\]/)[0]]); return k ? `${code(l)} (${k})` : code(l); };

    function fnSection(it, owner) {
      const n = it.node, d = it.d;
      const name = d.name;
      const params = (d.params || (C.params || defaultParams)(n, d)).filter(p => p && !/^(self|&self|&mut self|this|_|mut self)$/.test(p));
      const ret = d.ret != null ? d.ret : (C.returns || defaultReturns)(n, d);
      const body = d.body !== undefined ? d.body : bodyOf(n, d, C);
      const F = facts(body ? [body] : [n], C, ctx, { name, owner: owner && owner.name, receiver: d.receiver });
      const isTest = d.test || (C.isTest && C.isTest(n, d, it.attrs, owner));
      const isEntry = !isTest && (d.entry || (C.entry ? C.entry(n, d, owner, it.attrs) : (!owner && name === 'main')));
      const [start, end] = span(it);
      const note = d.doc || (C.doc && C.doc(n, d)) || commentAbove(lines, firstLine(it) - 1, C);
      const facts2 = [];
      let kind = isTest ? 'test' : isEntry ? 'start' : 'tool', title, headline;
      const pl = params.length ? 'takes ' + plainList(params.map(p => code(short(p, 50)))) : 'takes no inputs';
      const gives = ret && !VOID.test(ret.trim()) ? ` and gives back ${A(ret.replace(/^[^\w]*/, ''))} ${code(short(ret, 50))}` : '';
      const who = owner ? owner.name : d.owner;
      if (isTest) {
        title = `Test: ${name}`;
        headline = `${/^["']/.test(name) ? 'The test ' + name : code(name) + ' is a test that'} runs some of the code and checks the results are what they should be.`.replace('The test "', 'The test "');
      } else if (isEntry) {
        title = `Starting point: ${name}`;
        headline = d.entryText || C.entryText || 'Runs first when the program starts.';
        if (params.length) facts2.push(`It takes ${plainList(params.map(p => code(short(p, 50))))}` + (gives ? gives.replace(' and', ',') : '') + '.');
      } else if (d.word === 'constructor') {
        title = `Making ${A(who || 'thing')} ${who || 'object'}`;
        headline = `Runs when a new ${code(who || name)} is made` + (params.length ? `, and takes ${plainList(params.map(p => code(short(p, 50))))}.` : '.');
      } else {
        title = `${cap(d.word && !/^(method|function)$/.test(d.word) ? d.word : 'tool')}: ${who && !String(name).includes('.') ? who + '.' : ''}${name}`;
        const what = d.word === 'macro' ? 'a macro (code that writes code) that' : d.word === 'modifier' ? 'a modifier: a check other functions can put in front of themselves, that' : d.word === 'command' ? 'an Emacs command (people can run it by name) that' : who ? `one of ${code(who)}'s tools. It` : 'a reusable tool that';
        headline = `${code(name)} is ${what} ${pl}${gives}.`;
      }
      if (d.headline) headline = d.headline;
      if (d.title) title = `${d.title}${d.title === 'Starting point' ? '' : ': ' + name}`;
      if (note) facts2.unshift('The comment above it says: ' + short(note, 300));
      if (!isTest && !gives && !isEntry && d.word !== 'constructor') {
        if (ret && VOID.test(ret.trim()) || (!ret && C.explicitReturn !== false && !F.returns)) facts2.push('It doesn\'t give anything back; it does its work through what it changes or shows.');
        else if (!ret && F.returns) facts2.push('It gives back a result.');
      }
      if ((C.isAsync ? C.isAsync(n, d) : /^\s*(\w+\s+)*async\b/.test(header(n))) || F.awaits) facts2.push('It is `async`: it can wait (for the network or a file, say) without holding everything else up.');
      if (C.notes) C.notes(n, d, F, facts2, ctx, owner);
      if (F.effects.length) facts2.push('Along the way it ' + plainList(F.effects, 6) + '.');
      if (F.calls.length) facts2.push('Runs other tools: ' + plainList(F.calls.map(code), 6) + '.');
      if (F.recursion) facts2.push('It calls itself (recursion): each call works on a smaller part of the problem until it reaches a simple case.');
      if (F.loops || F.decisions) facts2.push('Contains ' + [F.loops ? plural(F.loops, 'loop') : '', F.decisions ? plural(F.decisions, 'decision') : ''].filter(Boolean).join(' and ') + '.');
      if (F.throws.length) facts2.push(`It can stop with an error: ${plainList(F.throws.map(x => code(x)), 3)}.`);
      if (F.catches) facts2.push('Handles errors instead of stopping.');
      const warnings = F.warnings.slice();
      if (C.warn) C.warn(n, d, F, warnings, ctx);
      if (end - start > 80) warnings.push(`This is ${end - start + 1} lines long. It may be doing several jobs that could be split up.`);
      warnings.push(...notesIn(lines, start, end));
      const stmtsOf = (b) => { if (!b) return []; if (BLOCKISH.test(b.type) || (C.blocks && C.blocks.test(b.type))) { const k = named(b); return k.length === 1 && (BLOCKISH.test(k[0].type) || (C.blocks && C.blocks.test(k[0].type))) ? stmtsOf(k[0]) : k; } return null; };
      const bodySteps = (cn, cd, cbody) => {
        const stmts = C.bodyStatements ? C.bodyStatements(cn, cd, cbody) : stmtsOf(cbody);
        if (stmts) {
          const s = stepLines(stmts, C);
          if (C.tail && stmts.length) {
            const last = stmts.filter(x => !isComment(x)).pop();
            if (last && C.tail(last) && s.steps.length && !s.more && /^\S/.test(s.steps[s.steps.length - 1])) s.steps[s.steps.length - 1] = 'give back ' + words(last, lang);
          }
          return s;
        }
        if (cbody) {
          let expr = cbody;
          while (/^(arrow_expression_clause|expression_body|function_body)$/.test(expr.type) && named(expr).length === 1) expr = named(expr)[0];
          const isCall = CALL.test(expr.type) || (C.call && C.call.test(expr.type));
          return /^(if|switch|match|case|when|cond)/.test(expr.type) || /match|switch|when|if/.test(expr.type) || (ret && VOID.test(ret.trim())) || (isCall && !ret) || C.kinds && C.kinds[expr.type] ? stepLines([expr], C) : { steps: ['give back ' + words(expr, lang)], more: false };
        }
        return { steps: [], more: false };
      };
      let st;
      if (it.clauseDs && it.clauseDs.length > 1) {
        const all = [];
        for (const c of it.clauseDs) {
          const ps = (c.d.params || (C.params || defaultParams)(c.node, c.d));
          all.push(`when it is given ${ps.length ? plainList(ps.map(p => short(p, 40))) : 'nothing'}` + (c.d.guard ? ` and ${short(c.d.guard, 40)}` : ''));
          const s = bodySteps(c.node, c.d, c.d.body !== undefined ? c.d.body : bodyOf(c.node, c.d, C));
          all.push(...s.steps.map(x => '    ' + x));
        }
        st = { steps: all.slice(0, 16), more: all.length > 16 };
      } else st = bodySteps(n, d, body);
      return { kind, title, headline, facts: facts2, warnings: warnings.slice(0, 6), steps: st.steps, more: st.more, start, end, name, owner: who || undefined };
    }

    function classSections(it, owner) {
      const n = it.node, d = it.d;
      const members = membersOf(it, C, ctx);
      const fns = members.filter(m => m.d.k === 'fn');
      const nested = members.filter(m => m.d.k === 'class' || m.d.k === 'type' || m.d.k === 'test');
      const fields = members.filter(m => m.d.k === 'var' || m.d.k === 'const');
      const [start, end] = span(it);
      const note = d.doc || (C.doc && C.doc(n, d)) || commentAbove(lines, firstLine(it) - 1, C);
      const name = d.name;
      const word = d.word || (d.k === 'type' ? 'struct' : 'class');
      const facts2 = [];
      const make = d.k === 'type' ? (TYPE_WORDS[word] || TYPE_WORDS.struct) : (CLASS_WORDS[word] || CLASS_WORDS.class);
      let headline = d.headline || make(name, d);
      if (!d.headline && d.k === 'type' && word === 'struct' && fns.length) headline = CLASS_WORDS.struct(name);
      if (note) facts2.push('The comment above it says: ' + short(note, 300));
      if (d.bases && d.bases.length) facts2.push(d.basesText || `It builds on ${plainList(d.bases.map(b => code(short(b, 50))))}.`);
      if (d.follows && d.follows.length) facts2.push(`It follows ${plainList(d.follows.map(b => code(short(b, 50))))}` + (d.k === 'class' ? ', so it has the tools ' + (d.follows.length > 1 ? 'those ask' : 'that asks') + ' for.' : '.'));
      const fieldNames = d.fields || fields.flatMap(m => m.d.names || [m.d.name || (C.name || defaultName)(m.node, m.d)]).filter(Boolean);
      if (d.variants && d.variants.length) facts2.push(`It can be ${plainList(d.variants.map(v => code(short(v, 50))), 10).replace(/ and ([^,]*)$/, ' or $1')}.`);
      if (fieldNames.length) facts2.push((word === 'module' || word === 'object' || word === 'contract' ? 'It keeps: ' : 'Each one keeps: ') + plainList(fieldNames.map(f => code(short(f, 50))), 10) + '.');
      const fnNames = fns.filter(m => m.d.word !== 'constructor').map(m => m.d.name).filter(x => x && !/^(init|constructor|__init__|initialize)$/.test(x));
      if (fnNames.length) facts2.push((/interface|protocol|trait/.test(word) ? 'Anything that follows it must have: ' : 'It can: ') + plainList([...new Set(fnNames)].map(code), 10) + '.');
      if (nested.length) facts2.push('Inside it: ' + plainList(nested.map(m => code(m.d.name)), 8) + '.');
      if (C.classNotes) C.classNotes(n, d, facts2, members, ctx);
      const warnings = [];
      const F = facts([n], C, ctx, { name });
      warnings.push(...F.warnings.filter(w => /secret|http, not https/.test(w)));
      const kind = d.kind || (d.k === 'type' && (!fns.length || /interface|trait|protocol/.test(word)) ? 'type' : 'class');
      const title = `${cap(d.title || word)}: ${name}`;
      const first = members.find(m => m.d.k === 'fn' || m.d.k === 'class' || m.d.k === 'type' || m.d.k === 'test');
      const split = first && (end - start + 1 > 20) && (fns.length + nested.length >= 2) && line(first.node) > line(n);
      if (!split) {
        // everything is in this one section, so its tools' warnings are too
        for (const w of F.warnings) add(warnings, w);
        if (C.warn) for (const m of fns) { const ws = []; C.warn(m.node, m.d, facts([m.node], C, ctx, { name: m.d.name }), ws, ctx); for (const w of ws) add(warnings, w); }
        warnings.push(...notesIn(lines, start, end));
        if (end - start > 300) warnings.push(`This is ${end - start + 1} lines long. It may be doing several jobs that could be split up.`);
        return [{ kind, title, headline, facts: facts2, warnings: warnings.slice(0, 6), steps: d.steps || [], more: false, start, end, name, owner: owner ? owner.name : undefined }];
      }
      const firstStart = span(first)[0];
      const out = [{ kind, title, headline, facts: facts2, warnings: warnings.concat(notesIn(lines, start, firstStart - 1)).slice(0, 6), steps: d.steps || [], more: false, start, end: Math.max(start, firstStart - 1), name, owner: owner ? owner.name : undefined }];
      out.push(...sectionsFor(members.filter(m => line(m.node) >= line(first.node)), d));
      return out;
    }

    function groupSection(kind, group, owner) {
      const nodes = group.map(g => g.node);
      const start = span(group[0])[0], end = endLine(nodes[nodes.length - 1]);
      const facts2 = [];
      let title, headline, steps = [], more = false;
      const warnings = [];
      if (kind === 'imports') {
        const srcs = [], pkgs = [];
        for (const g of group) {
          if (g.d.k === 'package') { add(pkgs, g.d.name || (C.name || defaultName)(g.node, g.d)); continue; }
          for (const s of (g.d.sources || (C.importOf ? C.importOf(g.node, g.d) : [flat(g.node.text)]))) add(srcs, s);
        }
        for (const s of srcs) { ctx.imports.push({ source: s, line: line(group[0].node) }); }
        title = srcs.length ? 'Toolkits used' : 'Package';
        headline = srcs.length ? `Brings in ${plural(srcs.length, 'toolkit or file', 'toolkits or files')}.` : `Says which package this file belongs to: ${plainList(pkgs.map(code))}.`;
        if (pkgs.length && srcs.length) facts2.push(`It belongs to the package ${plainList(pkgs.map(code))}.`);
        for (const s of srcs) {
          const local = C.isLocal ? C.isLocal(s) : /^\.{1,2}[\\/]|^\.\/|^["']\./.test(s);
          if (local) facts2.push(`${code(s)} (a file in this project)`);
          else { facts2.push(libPhrase(s)); add(ctx.libs, C.libName ? C.libName(s) : s); }
        }
        if (C.importNotes) C.importNotes(group, facts2, warnings, ctx);
      } else if (kind === 'settings') {
        const names = group.flatMap(g => g.d.names || [(C.name || defaultName)(g.node, g.d) || short(header(g.node), 30)]).filter(Boolean);
        const allConst = group.every(g => g.d.k === 'const');
        const proto = group.every(g => g.d.k === 'proto');
        title = proto ? 'Declarations' : owner ? `Settings in ${owner.name}` : 'Settings';
        headline = proto ? `Announces ${plural(names.length, 'tool')} written in full elsewhere: ${plainList(names.map(code), 8)}.`
          : names.length ? `Sets ${plural(names.length, allConst ? 'fixed value' : 'value')}: ${plainList(names.map(code), 8)}.` : 'Settings for how the file runs.';
        if (C.settingNotes) C.settingNotes(group, facts2, warnings, ctx);
        const F = facts(nodes, C, ctx, null);
        warnings.push(...F.warnings);
        if (F.effects.length && !allConst) facts2.push('Working them out, it ' + plainList(F.effects, 4) + '.');
      } else {
        title = owner ? `Other code in ${owner.name}` : 'Main steps';
        headline = `${plural(nodes.length, 'step')} that run${nodes.length === 1 ? 's' : ''} from top to bottom when ${C.scriptWord || 'the file runs'}.`;
        const F = facts(nodes, C, ctx, null);
        if (F.effects.length) facts2.push('Along the way it ' + plainList(F.effects, 6) + '.');
        if (F.calls.length) facts2.push('Runs the tools ' + plainList(F.calls.map(code), 6) + '.');
        if (F.loops || F.decisions) facts2.push('Contains ' + [F.loops ? plural(F.loops, 'loop') : '', F.decisions ? plural(F.decisions, 'decision') : ''].filter(Boolean).join(' and ') + '.');
        if (C.stepNotes) C.stepNotes(group, facts2, warnings, ctx);
        warnings.push(...F.warnings);
        const st = stepLines(nodes, C);
        steps = st.steps; more = st.more;
      }
      warnings.push(...notesIn(lines, start, end));
      return { kind: kind === 'settings' ? 'settings' : kind, title, headline, facts: facts2, warnings: [...new Set(warnings)].slice(0, 6), steps, more, start, end, name: null };
    }

    function sectionsFor(list, owner) {
      const out = [];
      let group = [], gkind = null;
      const flush = () => { if (group.length) out.push(groupSection(gkind, group, owner)); group = []; gkind = null; };
      for (const it of list) {
        const k = it.d.k;
        const g = k === 'import' || k === 'package' ? 'imports' : k === 'const' || k === 'var' || k === 'proto' ? 'settings' : k === 'steps' ? 'steps' : null;
        if (g) {
          if (g !== gkind || (g === 'settings' && group.length && (group[0].d.k === 'proto') !== (k === 'proto'))) flush();
          gkind = g; group.push(it); continue;
        }
        flush();
        if (k === 'fn') out.push(fnSection(it, owner));
        else if (k === 'class' || k === 'type') out.push(...classSections(it, owner));
        else if (k === 'test') out.push(C.testSection ? C.testSection(it, span(it), ctx) : fnSection({ ...it, d: { ...it.d, test: true } }, owner));
        else if (k === 'section' && it.d.make) out.push(it.d.make(span(it), ctx));
      }
      flush();
      return out;
    }

    sections.push(...sectionsFor(items, null));
    // parse problems
    let ok = true, error = '';
    if (rootNode.hasError()) {
      const bad = [];
      const visit = (x) => { if (x.type === 'ERROR' || x.isMissing()) { bad.push([line(x), endLine(x)]); return; } if (x.hasError()) for (let i = 0; i < x.childCount; i++) visit(x.child(i)); };
      visit(rootNode);
      const badLines = new Set();
      for (const [a, b] of bad) for (let i = a; i <= b; i++) badLines.add(i);
      const where = bad.slice(0, 4).map(([a, b]) => a === b ? `${a}` : `${a}–${b}`).join(', ');
      const written = lines.filter(l => l.trim()).length;
      if (badLines.size > written * 0.25) { ok = false; error = `Much of this file could not be read as ${nameOf(lang)} (around line${bad.length > 1 ? 's' : ''} ${where}). It may be another language, or use syntax the reader does not know yet.`; }
      else {
        const w = `Line${bad.length > 1 || bad[0][0] !== bad[0][1] ? 's' : ''} ${where} could not be read as ${nameOf(lang)}, so what is said about ${bad.length > 1 ? 'them' : 'it'} may be incomplete.`;
        if (sections[0]) sections[0].warnings.unshift(w); else error = w;
      }
    }
    if (C.fileNotes) C.fileNotes(rootNode, sections, ctx);
    return finish(lang, path, source, sections, ctx, { ok, error });
  }

  /* The first sentence of a file's note (given line by line), without the file name, separators and editor settings. */
  function aboutText(noteLines) {
    if (typeof noteLines === 'string') noteLines = [noteLines];
    let t = '';
    for (let i = 0; i < noteLines.length; i++) {
      const l = noteLines[i].replace(/-\*-.*?-\*-/g, '').replace(/^[\w.-]+\.\w+\s+---\s+/, '').trim();
      if (!l) continue;
      if (/^[\w ]+:$/.test(l) && t) break;            // a heading such as "Commentary:"
      if (/^[\w ]+:$/.test(l)) continue;
      t += (t ? ' ' : '') + l;
      if (/[.!?]$/.test(l)) break;
      const next = noteLines[i + 1] ? noteLines[i + 1].trim() : '';
      if (!next || /^[\w ]+:$/.test(next) || /^@\w/.test(next)) break;
    }
    t = flat(t);
    const m = t.match(/^(.+?[.!?])(\s|$)/);
    return short(m ? m[1] : t, 200);
  }

  /* Number the sections and write the overview. */
  function finish(lang, path, source, sections, ctx, extra) {
    const lines = source.split('\n');
    sections.forEach((s, i) => { s.id = i; s.lang = lang; if (!s.steps) s.steps = []; if (s.more === undefined) s.more = false; if (s.name === undefined) s.name = null; s.warnings = s.warnings || []; s.facts = s.facts || []; });
    const count = (k) => sections.filter(s => s.kind === k).length;
    const tools = count('tool'), classes = count('class'), types = count('type'), tests = count('test');
    const parts = [tools && plural(tools, 'tool'), classes && plural(classes, ctx.classWord || 'class', ctx.classWord ? ctx.classWord + 's' : 'classes'), types && plural(types, 'type'), tests && plural(tests, 'test')].filter(Boolean);
    const C = CONFIG[lang] || {};
    const what = ctx.what || (sections.some(s => s.kind === 'start') ? `${A(nameOf(lang))} ${nameOf(lang)} program` : C.fileWord ? C.fileWord : `${nameOf(lang)} code`);
    const libs = [...new Set(ctx.libs)];
    const libPhrase = (l) => { const k = C.libs && (C.libs[l] || C.libs[String(l).split(/[./:\\]/)[0]]); return k ? `${code(l)} (${k})` : code(l); };
    let overview = (ctx.about ? cap(ctx.about.replace(/[^.!?]$/, '$&.')) + ' ' : '') + `${path || 'This code'} is ${what}` + (parts.length ? `, with ${plainList(parts)}.` : '.');
    if (ctx.packages.length) overview += ` It belongs to ${plainList(ctx.packages.map(code))}.`;
    if (libs.length) overview += ' It uses ' + plainList(libs.map(libPhrase), 8) + '.';
    if (ctx.extraOverview) overview += ' ' + ctx.extraOverview;
    return { ok: extra.ok !== false, error: extra.error || '', overview, sections, lines: lines.length, imports: ctx.imports, libs, lang, reader: 'code' };
  }

  /* ------------------------------------------------------------------ */
  /* Each language's settings                                            */
  /* ------------------------------------------------------------------ */

  const SLASHES = /^(\/\/|\/\*|\*\s|\*$|\*\/)/;
  const HASH = /^#(?!\[|!|include|define|import|if|endif|else|pragma|undef)/;
  const DASHES = /^--/;
  const namesIn = (n, re) => { const out = []; if (!n) return out; for (const x of walk(n)) if (re.test(x.type)) out.push(x); return out; };
  const childOf = (n, re) => named(n).find(c => re.test(c.type)) || null;
  const childrenOf = (n, re) => named(n).filter(c => re.test(c.type));
  const textOf = (n) => (n ? flat(n.text) : '');
  const mods = (n) => { const m = childOf(n, /^modifiers?$/); return m ? m.text : ''; };
  const declNames = (n) => {
    let ds = namesIn(n, /^(variable_declarator|init_declarator|const_spec|var_spec|property_signature)$/).filter(x => diff(x, n));
    if (!ds.length) ds = namesIn(n, /^variable_declaration$/).filter(x => diff(x, n));
    if (ds.length) return ds.map(x => identText(field(x, 'name') || field(x, 'declarator') || named(x).find(c => IDENT.test(c.type) && c.type !== 'type_identifier') || named(x)[0]));
    const f = field(n, 'name') || field(n, 'left') || field(n, 'pattern') || field(n, 'declarator');
    return f ? [identText(f)] : [];
  };
  const upper = (s) => /^[A-Z][A-Z0-9_]*$/.test(s);
  /* Parameters in plain words: "takes `name`" lists them; this gives the extra notes some languages want. */
  function borrowNotes(params, facts2) {
    const mut = params.filter(p => /:\s*&mut\b/.test(p)).map(p => p.split(':')[0].trim());
    const ref = params.filter(p => /:\s*&(?!mut)/.test(p)).map(p => p.split(':')[0].trim());
    const moved = params.filter(p => /:\s*(String|Vec<|HashMap<|Box<|PathBuf|BTreeMap<|HashSet<)/.test(p)).map(p => p.split(':')[0].trim());
    if (ref.length) facts2.push(`It borrows ${plainList(ref.map(code))} to read ${ref.length > 1 ? 'them' : 'it'} (\`&\`): the caller keeps ${ref.length > 1 ? 'them' : 'it'} and can use ${ref.length > 1 ? 'them' : 'it'} again afterwards.`);
    if (mut.length) facts2.push(`It borrows ${plainList(mut.map(code))} so it can change ${mut.length > 1 ? 'them' : 'it'} (\`&mut\`); while it runs, nothing else can use ${mut.length > 1 ? 'them' : 'it'}.`);
    if (moved.length) facts2.push(`It takes ${plainList(moved.map(code))} over (ownership moves in), so the caller can't use ${moved.length > 1 ? 'them' : 'it'} afterwards.`);
  }
  const count = (text, re) => (String(text).match(re) || []).length;

  const LIBS = {
    rust: { std: 'Rust\'s standard library', serde: 'turns data into JSON and back', serde_json: 'reads and writes JSON', tokio: 'runs async code', reqwest: 'talks to web servers', clap: 'reads command-line options', anyhow: 'makes error handling simpler', thiserror: 'defines error types', rand: 'makes random numbers', regex: 'finds patterns in text', chrono: 'works with dates and times', log: 'writes log messages', actix_web: 'runs a web server', axum: 'runs a web server', sqlx: 'talks to databases', diesel: 'talks to databases', rayon: 'does work in parallel', crate: 'this crate (project)', super: 'the module above this one' },
    go: { fmt: 'formats and prints text', 'net/http': 'runs web servers and calls them', 'encoding/json': 'reads and writes JSON', sync: 'coordinates goroutines (locks)', errors: 'makes error values', log: 'writes log messages', os: 'works with the operating system (files, settings)', io: 'reads and writes streams of data', time: 'works with time', strings: 'works with text', strconv: 'turns text into numbers and back', context: 'carries deadlines and cancelling', 'database/sql': 'talks to SQL databases', testing: 'writes tests', bufio: 'reads input line by line', 'path/filepath': 'works with file paths', math: 'does maths', sort: 'sorts lists', 'github.com/gin-gonic/gin': 'runs a web server' },
    c: { 'stdio.h': 'reads and writes text and files', 'stdlib.h': 'memory, numbers and other helpers', 'string.h': 'works with text and memory', 'math.h': 'does maths', 'stdint.h': 'numbers of exact sizes', 'stdbool.h': 'true and false', 'time.h': 'works with time', 'ctype.h': 'checks kinds of characters', 'assert.h': 'checks that things are as expected', 'unistd.h': 'works with the operating system', 'pthread.h': 'runs threads', 'errno.h': 'error numbers', 'signal.h': 'handles signals', 'Foundation/Foundation.h': 'Apple\'s basic classes (text, lists, dates)', 'UIKit/UIKit.h': 'builds iPhone and iPad apps' },
    java: { 'java.util': 'lists, maps and other helpers', 'java.io': 'reads and writes files and streams', 'java.math': 'exact big numbers', 'java.time': 'works with dates and times', 'java.net': 'talks over the network', 'java.nio': 'fast file and data handling', 'java.util.concurrent': 'runs things at the same time', 'org.junit': 'tests code', 'org.springframework': 'the Spring framework (web apps)', 'javax.swing': 'desktop windows', 'android': 'Android apps' },
    csharp: { System: '.NET basics', 'System.Collections.Generic': 'lists and dictionaries', 'System.Linq': 'filters and sorts collections (LINQ)', 'System.Threading.Tasks': 'async work (tasks)', 'System.IO': 'reads and writes files', 'System.Net.Http': 'talks to web servers', 'System.Text.Json': 'reads and writes JSON', 'Microsoft.AspNetCore': 'web apps (ASP.NET)', 'Microsoft.EntityFrameworkCore': 'talks to databases', UnityEngine: 'the Unity game engine', Xunit: 'tests code', NUnit: 'tests code' },
    kotlin: { kotlinx: 'Kotlin\'s extra libraries', 'kotlinx.coroutines': 'runs async code with coroutines', 'kotlinx.serialization': 'reads and writes JSON', android: 'Android apps', androidx: 'Android apps', 'java.util': 'Java\'s helpers', org: 'a library', io: 'a library' },
    swift: { Foundation: 'Apple\'s basic types (text, dates, files, networking)', SwiftUI: 'builds screens from views', UIKit: 'builds iPhone and iPad apps', Combine: 'reacts to values that change over time', XCTest: 'tests code', AppKit: 'builds Mac apps', MapKit: 'shows maps', CoreData: 'stores data on the device' },
    php: { Illuminate: 'the Laravel framework', Symfony: 'the Symfony framework', App: 'this app', PDO: 'talks to databases', GuzzleHttp: 'talks to web servers', PHPUnit: 'tests code', Carbon: 'works with dates' },
    ruby: { json: 'reads and writes JSON', date: 'works with dates', time: 'works with time', csv: 'reads and writes CSV tables', 'net/http': 'talks to web servers', yaml: 'reads and writes YAML', fileutils: 'copies and moves files', set: 'collections without duplicates', rails: 'the Rails framework', sinatra: 'a small web framework', rspec: 'tests code', minitest: 'tests code', 'minitest/autorun': 'tests code', sqlite3: 'stores data in a database file', pg: 'talks to PostgreSQL', nokogiri: 'reads HTML and XML' },
    lua: { dkjson: 'reads and writes JSON', cjson: 'reads and writes JSON', socket: 'talks over the network', lfs: 'works with files and folders', love: 'the LÖVE game framework', luasql: 'talks to databases' },
    elixir: { GenServer: 'keeps state in a process and answers messages', Logger: 'writes log messages', Ecto: 'talks to databases', Phoenix: 'the Phoenix web framework', Plug: 'handles web requests', ExUnit: 'tests code', Supervisor: 'restarts processes that crash', Agent: 'keeps state in a process', Task: 'runs work in the background' },
    scala: { scala: 'Scala\'s standard library', 'scala.math': 'does maths', 'scala.collection': 'lists, maps and sets', 'scala.concurrent': 'runs async code (futures)', akka: 'actors and streams', cats: 'functional programming helpers', zio: 'async and effects', java: 'Java\'s libraries' },
    zig: { std: 'Zig\'s standard library', builtin: 'facts about the build' },
    ocaml: { Printf: 'formats and prints text', List: 'works with lists', String: 'works with text', Hashtbl: 'hash tables (dictionaries)', Array: 'works with arrays', Lwt: 'runs async code', Unix: 'works with the operating system' },
    rescript: { Belt: 'ReScript\'s standard helpers', Js: 'JavaScript helpers', React: 'builds user interfaces', ReactDOM: 'puts React components on the page' },
    solidity: { '@openzeppelin': 'well-tested contract building blocks (OpenZeppelin)', hardhat: 'a development tool for contracts' },
    objc: {}, bash: {}, elisp: { 'cl-lib': 'Common Lisp helpers', subr: 'basic helpers', seq: 'works with sequences', 'map': 'works with maps', json: 'reads and writes JSON', url: 'fetches web pages', org: 'Org mode' },
    python: { os: 'works with files and the operating system', sys: 'the running program (arguments, exit)', json: 'reads and writes JSON', csv: 'reads and writes CSV tables', re: 'finds patterns in text', math: 'does maths', random: 'makes random numbers', datetime: 'works with dates and times', dataclasses: 'makes simple data classes', requests: 'talks to web servers', flask: 'runs a web server', pandas: 'works with tables of data', numpy: 'does fast maths on arrays', pathlib: 'works with file paths', typing: 'type hints', collections: 'extra containers', itertools: 'loops over combinations', subprocess: 'runs other programs', sqlite3: 'stores data in a database file', argparse: 'reads command-line options', logging: 'writes log messages' },
  };

  const C_COMMON = {
    preproc_include: (n) => ({ k: 'import', sources: [textOf(field(n, 'path') || named(n)[0]).replace(/^[<"]|[>"]$/g, '')] }),
    preproc_def: (n) => ({ k: 'const', name: textOf(field(n, 'name')) }),
    preproc_function_def: (n) => ({ k: 'const', name: textOf(field(n, 'name')) + '()' }),
    preproc_ifdef: (n) => ({ k: 'container', nameNode: field(n, 'name') }),
    preproc_if: (n) => ({ k: 'container', nameNode: field(n, 'condition') }),
    preproc_else: (n) => ({ k: 'container' }),
    preproc_call: 'skip',
    function_definition: (n) => ({ k: 'fn' }),
    declaration: (n) => {
      if (namesIn(n, /^function_declarator$/).length && !/=/.test(n.text)) return { k: 'proto', names: declNames(n) };
      return { k: /\bconst\b|^\s*static\s+const/.test(n.text) ? 'const' : 'var', names: declNames(n) };
    },
    type_definition: (n) => {
      const ty = field(n, 'type');
      const nm = textOf(named(n).filter(c => diff(c, ty)).pop());
      if (ty && /^(struct|union|enum)_specifier$/.test(ty.type) && field(ty, 'body')) return { k: 'type', word: ty.type.replace('_specifier', ''), name: nm, body: field(ty, 'body'), variants: ty.type === 'enum_specifier' ? childrenOf(field(ty, 'body'), /^enumerator$/).map(e => textOf(field(e, 'name'))) : undefined };
      return { k: 'type', word: 'alias', name: nm, target: textOf(ty) };
    },
    struct_specifier: (n) => field(n, 'body') ? { k: 'type', word: 'struct', body: field(n, 'body') } : null,
    union_specifier: (n) => field(n, 'body') ? { k: 'type', word: 'union', body: field(n, 'body') } : null,
    enum_specifier: (n) => field(n, 'body') ? { k: 'type', word: 'enum', body: field(n, 'body'), variants: childrenOf(field(n, 'body'), /^enumerator$/).map(e => textOf(field(e, 'name'))) } : null,
    field_declaration: (n) => ({ k: 'var', names: declNames(n) }),
    enumerator: 'skip',
  };
  const cReturns = (n) => { const t = field(n, 'type'); if (!t) return ''; let s = textOf(t); let d = field(n, 'declarator'); while (d && d.type === 'pointer_declarator') { s += ' *'; d = field(d, 'declarator'); } return s; };
  function cNotes(n, d, F, facts2) {
    const params = defaultParams(n);
    const ptr = params.filter(p => /\*/.test(p)).map(p => (p.match(/(\w+)\s*(\[\])?$/) || [])[1]).filter(Boolean);
    if (ptr.length) facts2.push(`It takes ${plainList(ptr.map(code))} as ${ptr.length > 1 ? 'pointers' : 'a pointer'} (the \`*\`): the address of a value rather than a copy, so it can change the caller's value.`);
    const constPtr = params.filter(p => /^const\b.*\*/.test(p)).map(p => (p.match(/(\w+)$/) || [])[1]).filter(Boolean);
    if (constPtr.length) facts2.push(`${plainList(constPtr.map(code))} ${constPtr.length > 1 ? 'are' : 'is'} \`const\`: the tool only reads ${constPtr.length > 1 ? 'them' : 'it'}.`);
    const alloc = count(n.text, /\b(malloc|calloc|realloc)\s*\(/g), frees = count(n.text, /\bfree\s*\(/g);
    if (alloc) facts2.push(`It reserves memory by hand (\`malloc\`/\`calloc\`)${frees ? ' and frees it' : ''}. Memory reserved this way stays in use until something calls \`free\`.`);
    else if (frees) facts2.push('It gives memory back (`free`). After that, the pointer must not be used again.');
    if (/\bNULL\b/.test(n.text) && /==\s*NULL|!\w+\)/.test(n.text)) facts2.push('It checks for `NULL` (no memory or no value) before going on.');
  }
  function cWarn(n, d, F, warnings) {
    for (const fn of ['strcpy', 'strcat', 'sprintf', 'gets', 'vsprintf']) if (new RegExp(`\\b${fn}\\s*\\(`).test(n.text)) add(warnings, `Uses ${code(fn)}, which can write past the end of its memory (a buffer overflow). Safer: ${fn === 'gets' ? '`fgets`' : fn === 'sprintf' || fn === 'vsprintf' ? '`snprintf`' : '`strncpy` or `snprintf` with the buffer size'}.`);
    if (/\bscanf\s*\(\s*"[^"]*%s/.test(n.text)) add(warnings, '`scanf` with `%s` can read more text than its buffer holds. Give a width (`%15s`) or use `fgets`.');
    if (/\bsystem\s*\(/.test(n.text)) add(warnings, 'Uses `system()` to run a shell command. If any part comes from users, they could run their own commands.');
    if (/\bmalloc\s*\(/.test(n.text) && !/==\s*NULL|!\s*\w+\s*\)|if\s*\(\s*\w+\s*\)/.test(n.text)) add(warnings, 'Reserves memory with `malloc` without checking whether it worked (it gives back `NULL` when memory runs out).');
  }
  function cFileNotes(rootNode, sections, ctx) {
    const a = count(ctx.source, /\b(malloc|calloc)\s*\(/g), f = count(ctx.source, /\bfree\s*\(/g);
    if (a > f && sections.length) sections[0].warnings.push(`Reserves memory by hand ${plural(a, 'time')} but frees it only ${plural(f, 'time')}: a possible memory leak.`);
  }

  const CONFIG = {};

  CONFIG.c = {
    id: 'c', short: 'c', commentLine: SLASHES, libs: LIBS.c, types: { ...C_COMMON }, returns: cReturns, notes: cNotes, warn: cWarn, fileNotes: cFileNotes,
    isLocal: (s) => !/\.h$/.test(s) || /^[\w-]+\.h$/.test(s) && !LIBS.c[s] && !/^(std|sys|unistd|pthread|math|time|errno|signal|assert|ctype|fcntl|limits|float|stddef|stdarg|setjmp|locale|wchar|wctype|complex|inttypes|iso646|tgmath|uchar|threads|stdalign|stdatomic|stdnoreturn)/.test(s),
    entryText: 'Runs first when the program starts. The number it gives back tells the computer whether it worked (0 means yes).',
  };

  CONFIG.objc = {
    id: 'objc', short: 'objc', commentLine: SLASHES, libs: LIBS.c,
    types: {
      ...C_COMMON,
      class_interface: (n) => { const name = textOf(childOf(n, /^identifier$/)); return { k: 'class', word: 'interface', title: 'Interface', name, bases: field(n, 'superclass') ? [textOf(field(n, 'superclass'))] : [], members: named(n), headline: `${code(name)} announces a class: the values (properties) and tools other files can use. They are written in full in its \`@implementation\`.` }; },
      class_implementation: (n) => ({ k: 'class', word: 'class', name: textOf(childOf(n, /^identifier$/)), members: named(n).flatMap(c => c.type === 'implementation_definition' ? named(c) : [c]) }),
      protocol_declaration: (n) => ({ k: 'type', word: 'protocol', name: textOf(childOf(n, /^identifier$/)), members: named(n) }),
      category_interface: (n) => ({ k: 'class', word: 'extension', name: textOf(childOf(n, /^identifier$/)), members: named(n) }),
      category_implementation: (n) => ({ k: 'class', word: 'extension', name: textOf(childOf(n, /^identifier$/)), members: named(n).flatMap(c => c.type === 'implementation_definition' ? named(c) : [c]) }),
      implementation_definition: (n) => ({ k: 'container' }),
      method_definition: (n) => ({ k: 'fn', word: /^\s*\+/.test(n.text) ? 'class tool' : undefined }),
      method_declaration: (n) => ({ k: 'fn', body: null }),
      property_declaration: (n) => ({ k: 'var', names: namesIn(n, /^(identifier|field_identifier)$/).map(x => x.text).slice(-1) }),
    },
    name: (n, d) => {
      if (/^method_(definition|declaration)$/.test(n.type)) {
        const ids = named(n).filter(c => c.type === 'identifier').map(c => c.text);
        const hasParams = named(n).some(c => c.type === 'method_parameter');
        return hasParams ? ids.join(':') + ':' : ids[0];
      }
      return defaultName(n);
    },
    params: (n) => /^method_/.test(n.type) ? childrenOf(n, /^method_parameter$/).map(p => flat(p.text).replace(/^:\s*/, '')) : defaultParams(n),
    returns: (n) => /^method_/.test(n.type) ? textOf(childOf(n, /^method_type$/)).replace(/^\(|\)$/g, '') : cReturns(n),
    step: (n, d, h) => {
      if (n.type !== 'message_expression') return undefined;
      const recv = field(n, 'receiver');
      if (!recv) return undefined;
      const sel = [], args = [];
      const c = n.walk();
      if (c.gotoFirstChild()) do {
        const x = c.currentNode();
        if (!x.isNamed() || same(x, recv)) continue;
        if (c.currentFieldName() === 'method') sel.push(x.text); else args.push(short(x.text, 40));
      } while (c.gotoNextSibling());
      const selector = sel.length ? (args.length ? sel.map(s => s + ':').join('') : sel[0]) : '?';
      h.out.push(h.pad(d) + `send ${code(selector)} to ${short(recv.text, 40)}` + (args.length ? ` with ${args.join(', ')}` : ''));
      return true;
    },
    notes: (n, d, F, facts2) => {
      cNotes(n, d, F, facts2);
      if (/\[super init\]/.test(n.text)) facts2.push('It sets up the parts that come from the class it builds on first (`[super init]`).');
      if (/@autoreleasepool/.test(n.text)) facts2.push('Temporary objects made inside `@autoreleasepool` are freed when it ends.');
      if (/^\s*\+/.test(n.text)) facts2.push('It belongs to the class itself (`+`), not to each object.');
    },
    classNotes: (n, d, facts2) => {
      const copies = namesIn(n, /^property_declaration$/).filter(p => /\bcopy\b/.test(p.text)).map(p => (p.text.match(/\*?\s*(\w+)\s*;/) || [])[1]).filter(Boolean);
      if (copies.length) facts2.push(`${plainList(copies.map(code))} ${copies.length > 1 ? 'are' : 'is'} \`copy\`: the object keeps its own copy, so later changes made elsewhere don't affect it.`);
    },
    warn: cWarn, fileNotes: cFileNotes,
    entryText: 'Runs first when the program starts. The number it gives back tells the computer whether it worked (0 means yes).',
    isLocal: (s) => /^"|^[\w]+\.h$/.test(s) && !/\//.test(s),
  };

  CONFIG.rust = {
    id: 'rust', short: 'rust', commentLine: SLASHES, libs: LIBS.rust,
    types: {
      use_declaration: (n) => ({ k: 'import', sources: [flat(n.text).replace(/^(pub(\([^)]*\))?\s+)?use\s+/, '').replace(/;$/, '')] }),
      extern_crate_declaration: (n) => ({ k: 'import', sources: [textOf(field(n, 'name'))] }),
      mod_item: (n) => field(n, 'body') ? { k: 'class', word: 'module', body: field(n, 'body') } : { k: 'import', sources: [`${textOf(field(n, 'name'))}.rs`] },
      const_item: 'const', static_item: (n) => ({ k: /\bmut\b/.test(header(n)) ? 'var' : 'const' }),
      struct_item: (n) => ({ k: 'type', word: 'struct', body: field(n, 'body') }),
      union_item: (n) => ({ k: 'type', word: 'union', body: field(n, 'body') }),
      enum_item: (n) => ({ k: 'type', word: 'enum', variants: childrenOf(field(n, 'body'), /^enum_variant$/).map(v => textOf(field(v, 'name'))), members: [] }),
      type_item: (n) => ({ k: 'type', word: 'alias', target: textOf(field(n, 'type')) }),
      trait_item: (n) => ({ k: 'type', word: 'trait', body: field(n, 'body') }),
      impl_item: (n) => ({ k: 'class', word: 'impl', name: textOf(field(n, 'type')), trait: field(n, 'trait') ? textOf(field(n, 'trait')) : null, body: field(n, 'body') }),
      function_item: 'fn', function_signature_item: (n) => ({ k: 'fn', body: null }),
      macro_definition: (n) => ({ k: 'fn', word: 'macro', body: null }),
      field_declaration: (n) => ({ k: 'var', name: textOf(field(n, 'name')) + ': ' + textOf(field(n, 'type')) }),
      attribute_item: 'attr', inner_attribute_item: 'skip',
      associated_type: 'skip',
    },
    isTest: (n, d, attrs) => (attrs || []).some(a => /#\[(tokio::)?test\b/.test(a.text)),
    adjust: (it) => { if (it.d.word === 'module' && it.attrs.some(a => /cfg\(test\)/.test(a.text))) { it.d.title = 'Tests'; it.d.kind = 'test'; it.d.headline = `The tests for this file, in the module ${code(it.d.name || 'tests')}. They are only built when the tests run (\`#[cfg(test)]\`).`; } },
    tail: (last) => !/(_statement|_declaration|_item|^let_declaration|^macro_invocation|^if_expression|^match_expression|^for_expression|^while_expression|^loop_expression|^expression_statement)$/.test(last.type),
    notes: (n, d, F, facts2) => {
      const params = defaultParams(n);
      const self = params.find(p => /^&?(mut )?self$|^&'\w+ (mut )?self$/.test(p));
      if (self) facts2.push(/&mut/.test(self) ? 'It can change the value it belongs to (`&mut self`).' : /&/.test(self) ? 'It reads the value it belongs to without changing it (`&self`).' : 'It uses up the value it belongs to (`self`): that value can\'t be used afterwards.');
      borrowNotes(params, facts2);
      const ret = defaultReturns(n);
      if (/^Result\b/.test(ret)) facts2.push('It gives back a `Result`: either the answer (`Ok`) or an error (`Err`) that the caller has to deal with.');
      else if (/^Option\b/.test(ret)) facts2.push('It gives back an `Option`: a value (`Some`) or nothing (`None`).');
      const q = count(n.text, /\?(?=[;.)\s])/g);
      if (q) facts2.push(`The \`?\` after ${q > 1 ? 'some calls' : 'a call'} passes any error straight back to the caller.`);
    },
    warn: (n, d, F, warnings) => {
      if (/\bunsafe\s*\{/.test(n.text)) warnings.push('Has an `unsafe` block: inside it the compiler\'s memory-safety checks are switched off, so mistakes there can crash or corrupt memory.');
      const u = count(n.text, /\.(unwrap|expect)\(/g);
      if (u && d.name !== 'main' && !/#\[test\]/.test(n.text)) warnings.push(`Uses \`.unwrap()\` or \`.expect()\` ${plural(u, 'time')}: the program stops (panics) there if the value is missing or an error.`);
    },
    classNotes: (n, d, facts2, members, ctx) => {
      if (n.type === 'struct_item' || n.type === 'enum_item') {
        const derive = (n.previousNamedSibling && n.previousNamedSibling.type === 'attribute_item' ? n.previousNamedSibling.text : '').match(/derive\(([^)]*)\)/);
        if (derive) facts2.push(`It gets ready-made abilities from \`#[derive]\`: ${plainList(derive[1].split(',').map(s => code(s.trim())))}.`);
        if (/^\s*pub\b/.test(n.text)) facts2.push('It is `pub`: code outside this module can use it.');
      }
    },
    explicitReturn: true,
  };

  CONFIG.go = {
    id: 'go', short: 'go', commentLine: SLASHES, libs: LIBS.go,
    types: {
      package_clause: (n) => ({ k: 'package', name: textOf(named(n)[0]) }),
      import_declaration: (n) => ({ k: 'import', sources: namesIn(n, /^import_spec$/).map(s => unquote(textOf(field(s, 'path')))) }),
      function_declaration: 'fn',
      method_declaration: (n) => {
        const r = field(n, 'receiver');
        const p = r && namesIn(r, /^parameter_declaration$/)[0];
        const owner = p ? textOf(field(p, 'type')).replace(/^\*/, '') : '';
        return { k: 'fn', owner, receiver: p && field(p, 'name') ? textOf(field(p, 'name')) : '', word: 'method' };
      },
      type_declaration: (n) => {
        const spec = childOf(n, /^type_spec$/) || childOf(n, /^type_alias$/);
        if (!spec) return { k: 'steps' };
        const t = field(spec, 'type'), name = textOf(field(spec, 'name'));
        if (t && t.type === 'struct_type') return { k: 'type', word: 'struct', name, body: childOf(t, /field_declaration_list/) };
        if (t && t.type === 'interface_type') return { k: 'type', word: 'interface', name, body: t };
        return { k: 'type', word: 'alias', name, target: textOf(t) };
      },
      const_declaration: (n) => ({ k: 'const', names: namesIn(n, /^const_spec$/).map(s => textOf(field(s, 'name'))) }),
      var_declaration: (n) => ({ k: 'var', names: namesIn(n, /^var_spec$/).map(s => textOf(field(s, 'name'))) }),
      field_declaration: (n) => ({ k: 'var', names: [childrenOf(n, /field_identifier/).map(x => x.text).join(', ') + ' ' + textOf(field(n, 'type'))] }),
      method_spec: (n) => ({ k: 'fn', body: null }), method_elem: (n) => ({ k: 'fn', body: null }),
    },
    isTest: (n, d) => /^(Test|Benchmark|Example|Fuzz)([A-Z_]|$)/.test(d.name) && /\*testing\.[TBF]\b/.test(n.text),
    entryText: 'Runs first when the program starts (the `main` tool of the `main` package).',
    isLocal: (s) => /^\.\.?\//.test(s),
    notes: (n, d, F, facts2) => {
      const res = field(n, 'result');
      if (res && res.type === 'parameter_list') {
        const parts = named(res).map(x => flat(x.text));
        if (/\berror$/.test(parts[parts.length - 1])) facts2.push(`It gives back ${parts.length > 1 ? `${parts.length} values (${plainList(parts.map(code))}); the last is` : 'only'} an \`error\`: \`nil\` means it worked, so the caller should check it.`);
        else if (parts.length > 1) facts2.push(`It gives back ${parts.length} values: ${plainList(parts.map(code))}.`);
      } else if (res && /^error$/.test(res.text)) facts2.push('It gives back an `error`: `nil` means it worked.');
      const goes = count(n.text, /^\s*go\s+/mg);
      if (goes) facts2.push(`It starts ${goes > 1 ? 'work' : 'something'} in the background with \`go\` (a goroutine), so ${goes > 1 ? 'they run' : 'it runs'} at the same time as the rest.`);
      if (/<-|\bchan\b/.test(n.text)) facts2.push('It passes values through channels (`<-`), which is how goroutines hand work to each other.');
      const defers = namesIn(n, /^defer_statement$/).map(x => short(x.text.replace(/^defer\s+/, ''), 40));
      if (defers.length) facts2.push(`When it finishes, whatever happens, it runs ${plainList(defers.map(code))} (\`defer\`).`);
      const checks = count(n.text, /\berr != nil\b/g);
      if (checks) facts2.push(`It checks for errors ${plural(checks, 'time')} (\`if err != nil\`).`);
      if (/\.Lock\(\)/.test(n.text)) facts2.push('It locks a mutex, so only one goroutine at a time changes the shared values.');
      if (d.receiver) facts2.push(`Inside it, ${code(d.receiver)} is the ${code(d.owner)} it was called on` + (/\*/.test(textOf(field(n, 'receiver'))) ? ' (a pointer, so it can change it).' : ' (a copy).'));
    },
    warn: (n, d, F, warnings) => {
      const m = n.text.match(/\b\w+, _ :?= ([\w.]+)\(/);
      if (m) warnings.push(`Ignores the error from ${code(m[1])} (the \`_\`), so a failure there would go unnoticed.`);
    },
    classNotes: (n, d, facts2) => { if (/`json:"/.test(n.text)) facts2.push('Its fields have `json` tags: the names they use when turned into JSON.'); },
    explicitReturn: true,
  };

  const javaLike = (lang, extra) => ({
    id: lang, short: lang === 'csharp' ? 'c#' : lang, commentLine: SLASHES, libs: LIBS[lang],
    libName: (s) => s.replace(/\.\*$/, '').split('.').slice(0, s.startsWith('java.') || s.startsWith('javax.') ? 2 : 1).join('.'),
    ...extra,
  });

  CONFIG.java = javaLike('java', {
    types: {
      package_declaration: (n) => ({ k: 'package', name: flat(n.text).replace(/^package\s+|;$/g, '') }),
      import_declaration: (n) => ({ k: 'import', sources: [flat(n.text).replace(/^import\s+(static\s+)?|;$/g, '')] }),
      class_declaration: (n) => ({ k: 'class', word: /\babstract\b/.test(mods(n)) ? 'abstract class' : 'class', bases: field(n, 'superclass') ? [textOf(field(n, 'superclass')).replace(/^extends\s+/, '')] : [], follows: field(n, 'interfaces') ? textOf(field(n, 'interfaces')).replace(/^implements\s+/, '').split(/,\s*(?![^<]*>)/) : [] }),
      record_declaration: (n) => ({ k: 'type', word: 'record', fields: defaultParams(n) }),
      interface_declaration: (n) => ({ k: 'type', word: 'interface' }),
      enum_declaration: (n) => ({ k: 'type', word: 'enum', variants: namesIn(field(n, 'body'), /^enum_constant$/).map(c => textOf(field(c, 'name'))) }),
      annotation_type_declaration: (n) => ({ k: 'type', word: 'interface' }),
      method_declaration: 'fn',
      constructor_declaration: (n) => ({ k: 'fn', word: 'constructor' }),
      compact_constructor_declaration: (n) => ({ k: 'fn', word: 'constructor' }),
      field_declaration: (n) => ({ k: /\bfinal\b/.test(mods(n)) && /\bstatic\b/.test(mods(n)) ? 'const' : 'var', names: declNames(n) }),
      constant_declaration: (n) => ({ k: 'const', names: declNames(n) }),
      static_initializer: 'skip', enum_body_declarations: 'container',
    },
    returns: (n) => n.type === 'method_declaration' ? textOf(field(n, 'type')) : '',
    entry: (n, d) => d.name === 'main' && /\bstatic\b/.test(mods(n)),
    isTest: (n) => /@(Test|ParameterizedTest|RepeatedTest)\b/.test(mods(n)),
    notes: (n, d, F, facts2) => {
      const th = childOf(n, /^throws$/);
      if (th) facts2.push(`It may pass these errors on to whoever calls it (\`throws\`): ${plainList(named(th).map(x => code(x.text)))}.`);
      if (/@Override\b/.test(mods(n))) facts2.push('It replaces a tool of the same name from the class or interface it builds on (`@Override`).');
      if (/\bstatic\b/.test(mods(n)) && d.name !== 'main') facts2.push('It is `static`: it belongs to the class itself, not to each object.');
      if (/\bsynchronized\b/.test(mods(n))) facts2.push('It is `synchronized`: only one thread at a time can run it on the same object.');
      if (/\bprivate\b/.test(mods(n))) facts2.push('It is `private`: only this class can use it.');
    },
    warn: (n, d, F, warnings) => {
      if (/catch\s*\(\s*(final\s+)?(Exception|Throwable)\s+\w+\)/.test(n.text)) warnings.push('Catches every kind of error (`Exception`), which can hide problems nobody expected.');
      if (/\.printStackTrace\(\)/.test(n.text)) warnings.push('Prints the error (`printStackTrace`) and carries on, so the problem may go unnoticed.');
      if (/\bSystem\.exit\(/.test(n.text)) warnings.push('Uses `System.exit`, which stops the whole program at once.');
    },
    classNotes: (n, d, facts2) => {
      const priv = namesIn(field(n, 'body'), /^field_declaration$/).filter(f => /\bprivate\b/.test(mods(f)));
      if (priv.length) facts2.push('Its values are `private`: only its own tools can change them.' + (priv.some(f => /\bfinal\b/.test(mods(f))) ? ' Those marked `final` are set once and never changed.' : ''));
    },
    explicitReturn: true,
  });

  CONFIG.csharp = javaLike('csharp', {
    types: {
      using_directive: (n) => ({ k: 'import', sources: [flat(n.text).replace(/^(global\s+)?using\s+(static\s+)?|;$/g, '')] }),
      namespace_declaration: (n) => ({ k: 'container', name: textOf(field(n, 'name')), body: field(n, 'body') }),
      file_scoped_namespace_declaration: (n) => ({ k: 'package', name: textOf(field(n, 'name')) }),
      class_declaration: (n) => ({ k: 'class', word: /\babstract\b/.test(header(n)) ? 'abstract class' : 'class', ...csBases(n) }),
      struct_declaration: (n) => ({ k: 'type', word: 'struct', ...csBases(n) }),
      record_declaration: (n) => ({ k: 'type', word: 'record', fields: defaultParams(n) }),
      record_struct_declaration: (n) => ({ k: 'type', word: 'record', fields: defaultParams(n) }),
      interface_declaration: (n) => ({ k: 'type', word: 'interface' }),
      enum_declaration: (n) => ({ k: 'type', word: 'enum', variants: namesIn(field(n, 'body'), /^enum_member_declaration$/).map(c => textOf(field(c, 'name') || named(c)[0])), members: [] }),
      delegate_declaration: (n) => ({ k: 'type', word: 'alias', target: 'a tool with this shape (a delegate)' }),
      method_declaration: 'fn', local_function_statement: 'fn',
      constructor_declaration: (n) => ({ k: 'fn', word: 'constructor' }),
      destructor_declaration: (n) => ({ k: 'fn', word: 'clean-up' }),
      property_declaration: (n) => ({ k: 'var', names: [textOf(field(n, 'name'))] }),
      field_declaration: (n) => ({ k: /\bconst\b|\bstatic readonly\b/.test(header(n)) ? 'const' : 'var', names: declNames(n) }),
      event_field_declaration: (n) => ({ k: 'var', names: declNames(n) }),
      global_statement: 'steps', attribute_list: 'skip',
    },
    returns: (n) => n.type === 'method_declaration' || n.type === 'local_function_statement' ? textOf(field(n, 'returns') || field(n, 'type')) : '',
    entry: (n, d) => d.name === 'Main' && /\bstatic\b/.test(header(n)),
    isTest: (n) => /\[(Test|Fact|Theory|TestMethod|TestCase)\b/.test(n.text.split('\n').slice(0, 3).join('\n')),
    notes: (n, d, F, facts2) => {
      const linq = [...new Set((n.text.match(/\.(Where|Select|SelectMany|OrderBy|OrderByDescending|GroupBy|FirstOrDefault|First|Any|All|Sum|Count|Average|Max|Min|ToList|ToDictionary|Distinct|Take|Skip)\(/g) || []).map(x => x.slice(1, -1)))];
      if (linq.length) facts2.push(`It uses LINQ (${plainList(linq.map(code), 4)}) to filter, sort or total a collection in one expression.`);
      if (/=>/.test(header(n)) && !field(n, 'body')) facts2.push('It is written as a single expression (`=>`).');
      if (/\?\?\s*throw\b/.test(n.text)) facts2.push('It refuses a missing value straight away (`?? throw`).');
      if (/\basync\s+void\b/.test(header(n))) facts2.push('It is `async void`: nobody can wait for it or catch its errors. `async Task` is safer.');
      if (/\bstatic\b/.test(header(n)) && d.name !== 'Main') facts2.push('It is `static`: it belongs to the class itself, not to each object.');
    },
    warn: (n, d, F, warnings) => { if (/catch\s*(\(\s*Exception\b[^)]*\))?\s*\{/.test(n.text) && /catch\s*\{|catch\s*\(\s*Exception/.test(n.text)) warnings.push('Catches every kind of error (`Exception`), which can hide problems nobody expected.'); },
    classNotes: (n, d, facts2) => {
      const props = namesIn(field(n, 'body'), /^property_declaration$/);
      const auto = props.filter(p => /\{\s*get;/.test(p.text)).map(p => textOf(field(p, 'name')));
      const computed = props.filter(p => /=>/.test(p.text) && !/\{\s*get/.test(p.text)).map(p => textOf(field(p, 'name')));
      const privSet = props.filter(p => /private set;/.test(p.text)).map(p => textOf(field(p, 'name')));
      if (auto.length) facts2.push(`${plainList(auto.map(code))} ${auto.length > 1 ? 'are properties' : 'is a property'}: ${auto.length > 1 ? 'values' : 'a value'} with a built-in way to read (\`get\`) and change (\`set\`) ${auto.length > 1 ? 'them' : 'it'}.`);
      if (privSet.length) facts2.push(`${plainList(privSet.map(code))} can be read by anyone but changed only by ${code(d.name)} itself (\`private set\`).`);
      if (computed.length) facts2.push(`${plainList(computed.map(code))} ${computed.length > 1 ? 'are' : 'is'} worked out each time ${computed.length > 1 ? 'they are' : 'it is'} read (\`=>\`).`);
      const ro = namesIn(field(n, 'body'), /^field_declaration$/).filter(f => /\breadonly\b/.test(f.text)).flatMap(declNames);
      if (ro.length) facts2.push(`${plainList(ro.map(code))} ${ro.length > 1 ? 'are' : 'is'} \`readonly\`: set when the object is made and never changed.`);
    },
    explicitReturn: true,
  });
  function csBases(n) {
    const b = childOf(n, /^base_list$/);
    if (!b) return {};
    const all = named(b).map(x => flat(x.text));
    return { bases: all.filter(x => !/^I[A-Z]/.test(x)), follows: all.filter(x => /^I[A-Z]/.test(x)) };
  }

  CONFIG.kotlin = {
    id: 'kotlin', short: 'kotlin', commentLine: SLASHES, libs: LIBS.kotlin,
    libName: (s) => s.split('.').slice(0, s.startsWith('kotlinx.') ? 2 : 1).join('.'),
    types: {
      package_header: (n) => ({ k: 'package', name: textOf(named(n)[0]) }),
      import_list: (n) => ({ k: 'import', sources: childrenOf(n, /^import_header$/).map(h => flat(h.text).replace(/^import\s+/, '')) }),
      import_header: (n) => ({ k: 'import', sources: [flat(n.text).replace(/^import\s+/, '')] }),
      class_declaration: (n) => {
        const m = mods(n), tk = tokens(n);
        const name = textOf(childOf(n, /^type_identifier$/));
        const ctorParams = namesIn(childOf(n, /^primary_constructor$/), /^class_parameter$/);
        const fields = ctorParams.filter(p => /^\s*(\w+\s+)*(val|var)\b/.test(p.text)).map(p => flat(p.text).replace(/^(private|public|protected|internal|override|open)\s+/g, '').replace(/^(val|var)\s+/, ''));
        const deleg = childrenOf(n, /^delegation_specifier$/).map(x => flat(x.text).replace(/\(.*\)$/, ''));
        if (tk.includes('interface')) return { k: 'type', word: 'interface', name };
        if (/\benum\b/.test(m)) return { k: 'type', word: 'enum', name, variants: namesIn(n, /^enum_entry$/).map(e => textOf(childOf(e, /simple_identifier/))), members: [] };
        if (/\bdata\b/.test(m)) return { k: 'type', word: 'data class', name, fields, bases: deleg };
        return { k: 'class', word: /\babstract\b/.test(m) ? 'abstract class' : 'class', title: /\bsealed\b/.test(m) ? 'sealed class' : undefined, name, fields: fields.length ? fields : undefined, bases: deleg };
      },
      object_declaration: (n) => ({ k: 'class', word: 'object', name: textOf(childOf(n, /^type_identifier$/)), bases: childrenOf(n, /^delegation_specifier$/).map(x => flat(x.text).replace(/\(.*\)$/, '')) }),
      companion_object: (n) => ({ k: 'class', word: 'companion object', name: textOf(childOf(n, /^type_identifier$/)) || 'Companion' }),
      function_declaration: (n) => ({ k: 'fn', name: textOf(childOf(n, /^simple_identifier$/)) }),
      secondary_constructor: (n) => ({ k: 'fn', word: 'constructor', name: 'constructor' }),
      anonymous_initializer: 'skip',
      property_declaration: (n, ctx, owner) => {
        const name = textOf(childOf(n, /^(variable_declaration|multi_variable_declaration)$/)).split(':')[0].trim();
        const getter = childOf(n, /^getter$/);
        if (getter) return { k: 'fn', word: 'computed value', name, body: getter, headline: `${code(name)} is worked out each time it is read.` };
        return { k: /\bconst\b/.test(mods(n)) || (!owner && /\bval\b/.test(textOf(childOf(n, /binding_pattern_kind/)))) ? 'const' : 'var', names: [name] };
      },
      type_alias: (n) => ({ k: 'type', word: 'alias', name: textOf(childOf(n, /^type_identifier$/)), target: textOf(named(n).pop()) }),
    },
    params: (n) => n.type === 'function_declaration' ? childrenOf(childOf(n, /function_value_parameters/), /^parameter$/).map(p => flat(p.text)) : defaultParams(n),
    returns: (n) => {
      if (n.type !== 'function_declaration') return '';
      const kids = named(n); const i = kids.findIndex(c => c.type === 'function_value_parameters');
      const t = kids.slice(i + 1).find(c => /type$/.test(c.type));
      return t ? textOf(t) : '';
    },
    bodyStatements: (n, d, body) => {
      if (!body) return [];
      const kids = named(body);
      if (body.type === 'function_body' && kids.length === 1 && !/^(block|statements)$/.test(kids[0].type)) return null;
      const out = [];
      const flatten = (x) => { for (const c of named(x)) { if (/^(block|statements)$/.test(c.type)) flatten(c); else out.push(c); } };
      flatten(body);
      return out;
    },
    isTest: (n) => /@Test\b/.test(mods(n)),
    isAsync: (n) => /\bsuspend\b/.test(mods(n)),
    notes: (n, d, F, facts2) => {
      if (/\bsuspend\b/.test(mods(n))) facts2.push('It is a `suspend` function: it can pause (waiting for the network, say) without blocking, and must run inside a coroutine.');
      const ret = CONFIG.kotlin.returns(n);
      if (/\?$/.test(ret)) facts2.push(`It may give back \`null\` (the \`?\` in ${code(ret)}).`);
      if (/\?\.|\?:/.test(n.text)) facts2.push('It deals with values that might be missing: `?.` only goes on if there is a value, and `?:` gives a fallback.');
      if (/\bwhen\s*[({]/.test(n.text)) facts2.push('It uses `when` to pick one of several cases.');
      if (/\brunBlocking\b/.test(n.text)) facts2.push('It starts coroutines and waits for them to finish (`runBlocking`).');
      if (/\brepeat\(/.test(n.text)) facts2.push('It repeats a block a fixed number of times (`repeat`).');
      if (/\boverride\b/.test(mods(n))) facts2.push('It replaces a tool of the same name from what it builds on (`override`).');
    },
    warn: (n, d, F, warnings) => { if (/\w!!/.test(n.text)) warnings.push('Uses `!!`, which crashes the program if the value is null.'); },
    classNotes: (n, d, facts2) => { if (/\bsealed\b/.test(mods(n))) facts2.push('It is `sealed`: every kind of it is in this file, so a `when` can check them all.'); },
    explicitReturn: true,
    tail: () => false,
  };

  CONFIG.swift = {
    id: 'swift', short: 'swift', commentLine: SLASHES, libs: LIBS.swift,
    types: {
      import_declaration: (n) => ({ k: 'import', sources: [flat(n.text).replace(/^import\s+(\w+\s+)?/, '')] }),
      class_declaration: (n) => {
        const tk = tokens(n);
        const word = ['struct', 'class', 'enum', 'extension', 'actor'].find(w => tk.includes(w)) || 'class';
        const name = textOf(field(n, 'name') || childOf(n, /type_identifier|user_type/));
        const inh = childrenOf(n, /^inheritance_specifier$/).map(x => flat(x.text));
        if (word === 'enum') return { k: 'type', word: 'enum', name, follows: inh, variants: namesIn(n, /^enum_entry$/).flatMap(e => childrenOf(e, /simple_identifier/).map(x => x.text)) };
        if (inh.includes('View') && word === 'struct') return { k: 'class', word: 'view', name, follows: inh.filter(x => x !== 'View') };
        if (word === 'struct' && !namesIn(field(n, 'body'), /^function_declaration$/).length) return { k: 'type', word: 'struct', name, follows: inh };
        return { k: 'class', word: word === 'struct' ? 'struct' : word, name, bases: word === 'class' && inh[0] && !/able$|Protocol$|Delegate$/.test(inh[0]) ? [inh[0]] : [], follows: word === 'class' && inh[0] && !/able$|Protocol$|Delegate$/.test(inh[0]) ? inh.slice(1) : inh };
      },
      protocol_declaration: (n) => ({ k: 'type', word: 'protocol' }),
      function_declaration: 'fn', protocol_function_declaration: (n) => ({ k: 'fn', body: null }),
      init_declaration: (n) => ({ k: 'fn', word: 'constructor', name: 'init' }),
      deinit_declaration: (n) => ({ k: 'fn', word: 'clean-up', name: 'deinit' }),
      subscript_declaration: (n) => ({ k: 'fn', name: 'subscript' }),
      property_declaration: (n, ctx, owner) => {
        const name = textOf(field(n, 'name') || childOf(n, /^pattern$/));
        const computed = childOf(n, /^computed_property$/);
        if (computed) return { k: 'fn', word: 'computed value', name, body: computed, headline: name === 'body' && owner && owner.word === 'view' ? `${code('body')} describes what ${code(owner.name)} shows. SwiftUI reads it again whenever the data it uses changes.` : `${code(name)} is worked out each time it is read.` };
        return { k: /\blet\b/.test(textOf(childOf(n, /value_binding_pattern/))) && !owner ? 'const' : 'var', names: [name] };
      },
      protocol_property_declaration: (n) => ({ k: 'var', names: [textOf(childOf(n, /pattern/))] }),
      typealias_declaration: (n) => ({ k: 'type', word: 'alias', name: textOf(field(n, 'name') || childOf(n, /type_identifier/)), target: textOf(named(n).pop()) }),
      enum_entry: 'skip',
    },
    params: (n) => childrenOf(n, /^parameter$/).map(p => flat(p.text)),
    returns: (n) => { const h = flat(n.text.split('{')[0]); const m = h.match(/->\s*(.+)$/); return m ? m[1].trim() : ''; },
    notLoop: /^do_statement$/,
    step: (n, d, h) => {
      const t = n.type;
      const cond = (s) => flat(s).replace(/\b(let|var)\s+(\w+)\s*=\s*([^,]+)/g, '$3 has a value (called $2)').replace(/,\s*/g, ' and ');
      if (t === 'guard_statement') {
        const m = n.text.match(/^guard\s+([\s\S]*?)\s+else\s*\{/);
        h.out.push(h.pad(d) + `make sure that ${short(cond(m ? m[1] : ''), 60)}; if not:`);
        const st = childOf(n, /^statements$/);
        if (st) h.block(st, d + 1);
        return true;
      }
      if (t === 'if_statement') {
        const kids = named(n);
        const firstBody = kids.findIndex(c => c.type === 'statements');
        const head = n.text.slice(0, n.text.indexOf('{')).replace(/^if\s+/, '');
        h.out.push(h.pad(d) + `if ${short(cond(head), 70)}`);
        if (firstBody >= 0) h.block(kids[firstBody], d + 1);
        const rest = kids.slice(firstBody + 1).filter(c => c.type !== 'else');
        for (const r of rest) { if (r.type === 'if_statement') { h.out.push(h.pad(d) + 'otherwise…'); h.visit(r, d + 1); } else { h.out.push(h.pad(d) + 'otherwise'); h.block(r, d + 1); } }
        return true;
      }
      return undefined;
    },
    notes: (n, d, F, facts2) => {
      const h = flat(n.text.split('{')[0]);
      if (/\bthrows\b/.test(h)) facts2.push('It can fail with an error (`throws`), so callers use `try`.');
      if (/\bguard\b/.test(n.text)) facts2.push('`guard` checks a condition first and leaves early if it isn\'t met.');
      if (/\bif let\b|\bguard let\b|\?\?|\?\./.test(n.text)) facts2.push('It deals with optional values (ones that may be missing) using ' + plainList([/\bif let\b/.test(n.text) && '`if let`', /\bguard let\b/.test(n.text) && '`guard let`', /\?\?/.test(n.text) && '`??` (a fallback)', /\?\./.test(n.text) && '`?.`'].filter(Boolean)) + '.');
      if (/\bdo\s*\{[\s\S]*\bcatch\b/.test(n.text)) facts2.push('It tries something that can fail and handles the error (`do`/`catch`).');
      if (/\bmutating\b/.test(h)) facts2.push('It is `mutating`: it changes the value it belongs to.');
    },
    warn: (n, d, F, warnings) => {
      if (/\btry!/.test(n.text)) warnings.push('Uses `try!`, which crashes the app if the call fails.');
      if (/[\w)\]]!(?=[.\s),;\]])/.test(n.text.replace(/"(\\.|[^"\\])*"/g, '""').replace(/!=/g, ''))) warnings.push('Forces a value out of an optional with `!`; the app crashes if it is missing.');
    },
    classNotes: (n, d, facts2) => {
      const wrapped = namesIn(field(n, 'body'), /^property_declaration$/).map(p => [(p.text.match(/@(\w+)/) || [])[1], textOf(field(p, 'name') || childOf(p, /pattern/))]).filter(x => x[0]);
      const by = {};
      for (const [w, nm] of wrapped) (by[w] = by[w] || []).push(nm);
      const say = { Published: 'views watching this object redraw when they change', State: 'the view keeps them and redraws when they change', ObservedObject: 'the view redraws when that object announces a change', Binding: 'they are shared with the view that made this one', StateObject: 'the view makes it once and keeps it', Environment: 'they come from the surroundings the view is placed in', EnvironmentObject: 'it is handed down from a view further up' };
      for (const [w, list] of Object.entries(by)) facts2.push(`${plainList(list.map(code))} ${list.length > 1 ? 'are' : 'is'} \`@${w}\`` + (say[w] ? `: ${say[w]}.` : '.'));
      if (d.follows && d.follows.includes('Codable')) facts2.push('It is `Codable`: it can be turned into JSON (or another format) and back.');
    },
    explicitReturn: true,
  };

  CONFIG.php = {
    id: 'php', short: 'php', commentLine: SLASHES, libs: LIBS.php, libName: (s) => s.split('\\')[0],
    types: {
      php_tag: 'skip', text_interpolation: 'skip', text: 'skip',
      namespace_definition: (n) => field(n, 'body') ? { k: 'container', name: textOf(field(n, 'name')), body: field(n, 'body') } : { k: 'package', name: textOf(field(n, 'name')) },
      namespace_use_declaration: (n) => ({ k: 'import', sources: namesIn(n, /^namespace_use_clause$/).map(c => flat(c.text)) }),
      class_declaration: (n) => ({ k: 'class', word: /\babstract\b/.test(header(n)) ? 'abstract class' : 'class', bases: childrenOf(n, /^base_clause$/).flatMap(b => named(b).map(x => x.text)), follows: childrenOf(n, /^class_interface_clause$/).flatMap(b => named(b).map(x => x.text)) }),
      interface_declaration: (n) => ({ k: 'type', word: 'interface' }),
      trait_declaration: (n) => ({ k: 'type', word: 'trait' }),
      enum_declaration: (n) => ({ k: 'type', word: 'enum', variants: namesIn(n, /^enum_case$/).map(c => textOf(field(c, 'name'))) }),
      function_definition: 'fn',
      method_declaration: (n) => ({ k: 'fn', word: textOf(field(n, 'name')) === '__construct' ? 'constructor' : undefined }),
      property_declaration: (n) => ({ k: 'var', names: namesIn(n, /^variable_name$/).map(x => x.text) }),
      const_declaration: (n) => ({ k: 'const', names: namesIn(n, /^const_element$/).map(x => textOf(named(x)[0])) }),
      use_declaration: 'skip',
      expression_statement: (n) => /^(require|include)(_once)?\b/.test(n.text.trim()) ? { k: 'import', sources: [unquote(flat(n.text).replace(/^(require|include)(_once)?\s*\(?\s*|\s*\)?\s*;$/g, ''))] } : null,
    },
    isLocal: (s) => /\.php$|^\.|^__DIR__/.test(s),
    isTest: (n, d, attrs, owner) => /^test/.test(d.name) && owner && /TestCase/.test(owner.bases ? owner.bases.join(' ') : ''),
    notes: (n, d, F, facts2) => {
      const h = header(n);
      if (/\bstatic\b/.test(h)) facts2.push('It is `static`: it belongs to the class itself, not to each object.');
      if (/\bprivate\b/.test(h)) facts2.push('It is `private`: only this class can use it.');
      if (/->validate\(/.test(n.text)) facts2.push('It checks the incoming form data first (`validate`) and stops with an error message if it is wrong.');
      if (/Hash::make\(|password_hash\(/.test(n.text)) facts2.push('It scrambles the password before storing it, so the real password is never saved.');
      if (/\$_(GET|POST|REQUEST|COOKIE)\b/.test(n.text)) facts2.push('It reads what the browser sent directly (`$_GET`/`$_POST`).');
      if (/::findOrFail\(/.test(n.text)) facts2.push('If nothing is found it stops with a "not found" page (`findOrFail`).');
    },
    warn: (n, d, F, warnings) => {
      if (/\b(mysqli_query|mysql_query|->query|->exec|DB::(raw|select|statement)|whereRaw|selectRaw|orderByRaw)\s*\(\s*(["'][^"']*(\$\w|\{\$)|[^,)]*\.\s*\$)/.test(n.text)) warnings.push('Builds a database query by joining text with values. If any of it comes from users, this allows SQL injection; pass the values separately (bindings).');
      if (/\becho\b[^;]*\$_(GET|POST|REQUEST)/.test(n.text)) warnings.push('Shows text from the browser without escaping it, so someone could inject their own code (XSS). Use `htmlspecialchars`.');
      if (/\b(eval|exec|shell_exec|system|passthru)\s*\(/.test(n.text)) warnings.push('Runs text as code or as a shell command. That is risky if any of it comes from users.');
    },
    explicitReturn: true,
  };

  const rubyCall = (n) => {
    const m = textOf(field(n, 'method')), recv = field(n, 'receiver');
    const args = field(n, 'arguments');
    if (!recv && /^(require|require_relative|load|autoload)$/.test(m)) return { k: 'import', sources: [unquote(textOf(args && named(args)[0]))], local: m === 'require_relative' };
    if (!recv && /^(describe|context|feature|test|it|specify|scenario)$/.test(m) && field(n, 'block')) return { k: 'test', name: textOf(args && named(args)[0]) || m, body: field(n, 'block') };
    if (!recv && /^attr_(reader|writer|accessor)$/.test(m)) return { k: 'var', names: namesIn(args, /^simple_symbol$/).map(x => x.text.replace(/^:/, '')), attr: m };
    if (!recv && /^(include|extend|prepend)$/.test(m)) return { k: 'var', names: [], mixin: textOf(args) };
    if (!recv && /^(private|protected|public|module_function)$/.test(m)) return { k: 'skip' };
    return null;
  };
  CONFIG.ruby = {
    id: 'ruby', short: 'ruby', commentLine: HASH, libs: LIBS.ruby,
    types: {
      call: (n, ctx, owner) => rubyCall(n) || (owner ? { k: 'skip' } : null),
      identifier: (n, ctx, owner) => owner && /^(private|protected|public|module_function)$/.test(n.text) ? { k: 'skip' } : null,
      module: (n) => ({ k: 'class', word: 'module' }),
      class: (n) => ({ k: 'class', word: 'class', bases: field(n, 'superclass') ? [textOf(field(n, 'superclass')).replace(/^<\s*/, '')] : [] }),
      singleton_class: (n) => ({ k: 'class', word: 'class', name: 'self' }),
      method: (n, ctx, owner) => ({ k: 'fn', word: textOf(field(n, 'name')) === 'initialize' ? 'constructor' : undefined }),
      singleton_method: (n) => ({ k: 'fn', name: textOf(field(n, 'name')), static: true }),
      assignment: (n, ctx, owner) => field(n, 'left') && field(n, 'left').type === 'constant' ? { k: 'const', names: [textOf(field(n, 'left'))] } : owner ? { k: 'skip' } : null,
    },
    isLocal: (s) => /^\.|^[\w/]+_helper$/.test(s),
    isTest: (n, d, attrs, owner) => /^test_/.test(d.name) && owner && /Test\b|TestCase/.test((owner.bases || []).join(' ')),
    notes: (n, d, F, facts2) => {
      if (/\?$/.test(d.name)) facts2.push('Its name ends in `?`: it answers yes or no.');
      if (/!$/.test(d.name)) facts2.push('Its name ends in `!`: a warning that it changes the object itself, or fails loudly.');
      if (/\byield\b/.test(n.text)) facts2.push('It runs a block of code handed to it by the caller (`yield`).');
      const blocks = [...new Set((n.text.match(/\.(\w+[?!]?)\s*(\{\s*\||do\s*\|)/g) || []).map(x => x.replace(/^\.|\s*(\{\s*\||do\s*\|)$/g, '')))];
      if (blocks.length) facts2.push(`It hands small blocks of code to ${plainList(blocks.map(code), 4)} (the \`{ |x| … }\` parts), which run them for each item.`);
      if (n.type === 'singleton_method' || d.static) facts2.push('It belongs to the class or module itself (`self.`), not to each object.');
      if (/\bunless\b/.test(n.text)) facts2.push('`unless` means "if not".');
    },
    classNotes: (n, d, facts2, members) => {
      const attrs = members.filter(m => m.d.attr);
      const say = { attr_reader: 'can be read from outside', attr_writer: 'can be changed from outside', attr_accessor: 'can be read and changed from outside' };
      for (const a of attrs) if (a.d.names.length) facts2.push(`${plainList(a.d.names.map(code))} ${say[a.d.attr]} (\`${a.d.attr}\`).`);
      const mix = members.filter(m => m.d.mixin).map(m => m.d.mixin);
      if (mix.length) facts2.push(`It mixes in ${plainList(mix.map(code))}, gaining their tools.`);
      const ivars = [...new Set((n.text.match(/@\w+(?=\s*=[^=])/g) || []))];
      if (ivars.length && d.word === 'class' && !facts2.some(f => /^Each one keeps/.test(f))) facts2.push(`Each one keeps: ${plainList(ivars.map(code), 8)}.`);
    },
    tail: (last) => /^(identifier|self|instance_variable|constant|integer|float|string|array|hash|true|false|nil|binary|scope_resolution|element_reference|parenthesized_statements)$/.test(last.type),
    step: (n, d, h) => {
      if (n.type === 'binary' && /^\S[\s\S]*?\s<<\s/.test(n.text) && field(n, 'left')) { h.out.push(h.pad(d) + `add ${h.say(field(n, 'right'))} to the end of ${short(textOf(field(n, 'left')), 40)}`); return true; }
      return undefined;
    },
    explicitReturn: false,
    scriptWord: 'the script runs',
  };

  CONFIG.lua = {
    id: 'lua', short: 'lua', commentLine: DASHES, libs: LIBS.lua,
    types: {
      local_variable_declaration: (n) => {
        const v = childOf(n, /expression_list/), names = namesIn(childOf(n, /variable_list/), /^identifier$/).map(x => x.text);
        const val = v && named(v)[0];
        if (val && val.type === 'call' && /^require$/.test(calleeOf(val))) return { k: 'import', sources: [unquote(textOf(namesIn(val, /^string$/)[0]))] };
        if (val && /^function_definition$/.test(val.type)) return { k: 'fn', name: names[0], body: field(val, 'body'), params: defaultParams(val), local: true };
        if (!val || /^(number|string|true|false|nil|table)$/.test(val.type)) return { k: names.every(upper) ? 'const' : 'var', names };
        return null;
      },
      variable_assignment: (n) => {
        const v = childOf(n, /expression_list/), val = v && named(v)[0];
        const nm = textOf(childOf(n, /variable_list/));
        if (val && /^function_definition$/.test(val.type)) return { k: 'fn', name: nm, body: field(val, 'body'), params: defaultParams(val), owner: nm.includes('.') ? nm.split('.')[0] : undefined };
        if (/\.__index$/.test(nm)) return { k: 'skip' };
        return null;
      },
      function_definition_statement: (n) => {
        const nm = field(n, 'name');
        const full = textOf(nm);
        const parts = full.split(/[.:]/);
        return { k: 'fn', name: parts[parts.length - 1], owner: parts.length > 1 ? parts.slice(0, -1).join('.') : undefined, method: full.includes(':') };
      },
      local_function_definition_statement: (n) => ({ k: 'fn', local: true }),
      function_declaration: (n) => ({ k: 'fn' }),
    },
    isLocal: (s) => /^\./.test(s),
    print: /^(print|io\.write)$/,
    notes: (n, d, F, facts2, ctx) => {
      if (d.method) facts2.push(`It is called with \`:\` (as in \`${(d.owner || 'x').toLowerCase()}:${d.name}(…)\`), so it gets the table it belongs to as \`self\`.`);
      if (d.local) facts2.push('It is `local`: only this file can use it.');
      if (/\breturn\s+[^\n,]+,\s*\S/.test(n.text)) facts2.push('It can give back more than one value at once (for example a result and an error message).');
      if (/setmetatable\(/.test(n.text)) facts2.push('It makes a new table that shares ' + (d.owner ? code(d.owner) + '\'s' : 'its class\'s') + ' tools (`setmetatable`): this is how Lua does objects.');
      if (/\bassert\(/.test(n.text)) facts2.push('It stops with an error if something it needs fails (`assert`).');
      if (/\bpcall\(/.test(n.text)) facts2.push('It runs something that might fail and catches the error (`pcall`).');
      if (/\bi?pairs\(/.test(n.text)) facts2.push('It goes through a table with `' + (/\bipairs\(/.test(n.text) ? 'ipairs` (in order, by position)' : 'pairs` (every key, in no set order)') + '.');
    },
    warn: (n, d, F, warnings) => {
      const locals = new Set(defaultParams(n).concat(d.params || []).map(p => p.trim()).concat(['self', '_']));
      for (const x of walk(n)) {
        if (x.type === 'local_variable_declaration' || /^for_/.test(x.type)) for (const id of namesIn(childOf(x, /variable_list/) || x, /^identifier$/)) locals.add(id.text);
        if (x.type === 'parameter_list') for (const id of named(x)) locals.add(id.text);
      }
      const globals = [];
      for (const x of walk(n)) if (x.type === 'variable_assignment' && diff(x, n)) { const v = textOf(childOf(x, /variable_list/)); if (/^\w+$/.test(v) && !locals.has(v)) add(globals, v); }
      if (globals.length) warnings.push(`${plainList(globals.map(code))} ${globals.length > 1 ? 'aren\'t' : 'isn\'t'} declared \`local\`, so ${globals.length > 1 ? 'they are globals' : 'it is a global'} that any file can see and change. Add \`local\` if that isn't meant.`);
    },
    fileNotes: (rootNode, sections, ctx) => {
      const m = ctx.source.match(/^local (\w+) = \{\}\s*\n\s*\1\.__index = \1/m);
      if (m) ctx.extraOverview = `${code(m[1])} works like a class: a table of tools that new tables share (through \`__index\`).`;
    },
    explicitReturn: true,
    scriptWord: 'the script runs',
  };

  const BASH_TEST = (s) => {
    let t = flat(s).replace(/^\[\[?\s*|\s*\]\]?$/g, '');
    const not = /^!\s+/.test(t); t = t.replace(/^!\s+/, '');
    const v = (x) => x.replace(/^"|"$/g, '');
    let m;
    const neg = (pos, negw) => not ? negw : pos;
    if ((m = t.match(/^-d\s+(.+)$/))) return neg(`the folder ${v(m[1])} exists`, `the folder ${v(m[1])} doesn't exist`);
    if ((m = t.match(/^-[fe]\s+(.+)$/))) return neg(`the file ${v(m[1])} exists`, `the file ${v(m[1])} doesn't exist`);
    if ((m = t.match(/^-z\s+(.+)$/))) return neg(`${v(m[1])} is empty`, `${v(m[1])} isn't empty`);
    if ((m = t.match(/^-n\s+(.+)$/))) return neg(`${v(m[1])} isn't empty`, `${v(m[1])} is empty`);
    if ((m = t.match(/^-x\s+(.+)$/))) return neg(`${v(m[1])} can be run`, `${v(m[1])} can't be run`);
    if ((m = t.match(/^(.+?)\s+(-lt|-gt|-le|-ge|-eq|-ne|==|=|!=|<|>)\s+(.+)$/))) {
      const w = { '-lt': 'is less than', '-gt': 'is more than', '-le': 'is at most', '-ge': 'is at least', '-eq': 'is', '-ne': 'is not', '==': 'is', '=': 'is', '!=': 'is not', '<': 'comes before', '>': 'comes after' }[m[2]];
      return (not ? 'not: ' : '') + `${v(m[1])} ${w} ${v(m[3])}`;
    }
    return (not ? 'not ' : '') + short(t, 60);
  };
  CONFIG.bash = {
    id: 'bash', short: 'bash', commentLine: /^#(?!!)/, libs: {},
    types: {
      function_definition: (n) => ({ k: 'fn', params: [...new Set((n.text.match(/\$\{?([1-9@*#])\b|\$\{?([1-9])\}/g) || []).map(x => x.replace(/[{}]/g, '')))].sort() }),
      variable_assignment: (n) => ({ k: upper(textOf(field(n, 'name'))) ? 'const' : 'var', names: [textOf(field(n, 'name'))] }),
      declaration_command: (n) => ({ k: /^readonly/.test(n.text) ? 'const' : 'var', names: namesIn(n, /^variable_name$/).map(x => x.text) }),
      command: (n) => {
        const name = textOf(field(n, 'name'));
        if (/^(source|\.)$/.test(name)) return { k: 'import', sources: [textOf(named(n)[1])] };
        if (name === 'set' && /^set\s+[-+][euxo]/.test(n.text.trim())) return { k: 'const', names: [] };
        if (name === 'trap') return { k: 'const', names: [], trap: flat(n.text) };
        return null;
      },
    },
    print: /^(echo|printf|log)$/,
    isLocal: () => true,
    entryText: '',
    step: (n, d, h) => {
      const t = n.type;
      if (t === 'command') {
        const name = textOf(field(n, 'name'));
        const args = named(n).filter(c => diff(c, field(n, 'name')) && !/redirect/.test(c.type)).map(c => flat(c.text));
        if (name === 'echo' || name === 'printf') h.out.push(h.pad(d) + 'show ' + (args.join(' ') || 'an empty line'));
        else if (name === 'return' || name === 'exit') h.out.push(h.pad(d) + (args[0] && args[0] !== '0' ? `${name === 'exit' ? 'stop the script' : 'stop'}, reporting failure (code ${args[0]})` : `${name === 'exit' ? 'stop the script' : 'stop'}, reporting success`));
        else if (name === 'cd') h.out.push(h.pad(d) + `go into the folder ${args.join(' ')}`);
        else if (name === 'mkdir') h.out.push(h.pad(d) + `make the folder ${args.filter(a => !/^-/.test(a)).join(' ')}`);
        else if (name === 'rm') h.out.push(h.pad(d) + `delete ${args.filter(a => !/^-/.test(a)).join(' ')}`);
        else if (name === 'cp' || name === 'mv') h.out.push(h.pad(d) + `${name === 'cp' ? 'copy' : 'move'} ${args.filter(a => !/^-/.test(a)).join(' to ')}`);
        else h.out.push(h.pad(d) + `run ${name}` + (args.length ? ' with ' + short(args.join(' '), 60) : ''));
        return true;
      }
      if (t === 'pipeline') { const parts = named(n).map(c => textOf(field(c, 'name') || c).split(' ')[0]); h.out.push(h.pad(d) + `run ${plainList(parts.map(p => p))}, each passing its output to the next (a pipe): ${short(n.text, 50)}`.replace(/ and /, ' then ')); return true; }
      if (t === 'list') {
        const kids = named(n), op = /&&/.test(n.text.slice(kids[0].endIndex - n.startIndex, kids[1] ? kids[1].startIndex - n.startIndex : undefined)) ? '&&' : '||';
        h.visit(kids[0], d);
        h.out.push(h.pad(d) + (op === '&&' ? 'if that worked:' : 'if that failed:'));
        for (const k of kids.slice(1)) h.visit(k, d + 1);
        return true;
      }
      if (t === 'redirected_statement') { const b = field(n, 'body') || named(n)[0]; h.visit(b, d); const r = named(n).find(c => /redirect/.test(c.type)); if (r && h.out.length) h.out[h.out.length - 1] += /2>|>&2/.test(r.text) ? ' (to the error output)' : /\/dev\/null/.test(r.text) ? ' (throwing the output away)' : ` (output into ${short(r.text.replace(/^\d?>>?\s*/, ''), 30)})`; return true; }
      if (t === 'test_command') { h.out.push(h.pad(d) + 'check ' + BASH_TEST(n.text)); return true; }
      if (t === 'if_statement') {
        const cond = field(n, 'condition');
        h.out.push(h.pad(d) + 'if ' + (cond && cond.type === 'test_command' ? BASH_TEST(cond.text) : cond ? short(cond.text.replace(/;$/, ''), 60) + ' works' : '…'));
        for (const c of named(n)) {
          if (same(c, cond)) continue;
          if (c.type === 'elif_clause') { const c2 = field(c, 'condition') || named(c)[0]; h.out.push(h.pad(d) + 'otherwise, if ' + (c2.type === 'test_command' ? BASH_TEST(c2.text) : short(c2.text, 50))); for (const x of named(c).slice(1)) h.visit(x, d + 1); }
          else if (c.type === 'else_clause') { h.out.push(h.pad(d) + 'otherwise'); for (const x of named(c)) h.visit(x, d + 1); }
          else h.visit(c, d + 1);
        }
        return true;
      }
      if (t === 'case_statement') {
        h.out.push(h.pad(d) + 'check ' + textOf(field(n, 'value') || named(n)[0]));
        for (const c of childrenOf(n, /case_item/)) { const pat = field(c, 'value') || named(c)[0]; h.out.push(h.pad(d + 1) + (pat.text === '*' ? 'otherwise' : 'when ' + pat.text)); for (const x of named(c).filter(x => diff(x, pat))) h.visit(x, d + 2); }
        return true;
      }
      if (t === 'for_statement' && field(n, 'variable')) { h.out.push(h.pad(d) + `for each ${textOf(field(n, 'variable'))} in ${short(named(n).filter(c => diff(c, field(n, 'variable')) && diff(c, field(n, 'body'))).map(c => c.text).join(' '), 60)}`); h.block(field(n, 'body'), d + 1); return true; }
      if (t === 'declaration_command') { h.out.push(h.pad(d) + (/=/.test(n.text) ? `set ${flat(n.text).replace(/^(local|export|declare|readonly)\s+(-\w+\s+)?/, '').replace('=', ' to ')}` : `create ${flat(n.text).replace(/^(local|export|declare|readonly)\s+/, '')}`) + (/^export/.test(n.text) ? ' (shared with programs it runs)' : /^local/.test(n.text) ? ' (only inside this tool)' : '')); return true; }
      if (t === 'variable_assignment') { h.out.push(h.pad(d) + `set ${textOf(field(n, 'name'))} to ${short(textOf(field(n, 'value')), 60)}`); return true; }
      return undefined;
    },
    notes: (n, d, F, facts2) => {
      if (/\breturn [1-9]/.test(n.text)) facts2.push('It reports failure with a non-zero exit code (`return 1`); 0 means it worked.');
      if (/\|/.test(n.text.replace(/\|\|/g, ''))) facts2.push('It joins commands with pipes (`|`): each one\'s output feeds the next.');
      if (/>&2/.test(n.text)) facts2.push('It writes to the error output (`>&2`), so its messages don\'t mix with the real output.');
      if (/\$\(/.test(n.text)) facts2.push('It captures what a command prints with `$(…)`.');
      if (/^\s*local\b/m.test(n.text)) facts2.push('Its `local` variables only exist while it runs.');
      if (d.params && d.params.length) facts2.push(`It reads its inputs as ${plainList(d.params.map(code))} (the values given after its name).`);
    },
    warn: (n, d, F, warnings) => bashWarn(n, warnings),
    stepNotes: (group, facts2, warnings) => { for (const g of group) bashWarn(g.node, warnings); },
    settingNotes: (group, facts2) => {
      const set = group.map(g => g.node.text).find(t => /^set\s+[-+]/.test(t.trim()));
      if (set) {
        const flags = set.replace(/^set\s+/, '');
        const said = [];
        if (/-\w*e/.test(flags)) said.push('stop at the first command that fails (`-e`)');
        if (/-\w*u/.test(flags)) said.push('treat an unset variable as a mistake (`-u`)');
        if (/pipefail/.test(flags)) said.push('count a pipe as failed if any part of it fails (`pipefail`)');
        if (/-\w*x/.test(flags)) said.push('print each command before running it (`-x`)');
        if (said.length) facts2.push(`\`${flat(set)}\` makes the script ${plainList(said)}.`);
      }
      const defaults = group.filter(g => /\$\{\w+:-/.test(g.node.text)).map(g => textOf(field(g.node, 'name')));
      if (defaults.length) facts2.push(`${plainList(defaults.map(code))} ${defaults.length > 1 ? 'have' : 'has'} a default (\`\${…:-…}\`), used when nothing else is given.`);
      const subs = group.filter(g => /=\$\(/.test(g.node.text)).map(g => textOf(field(g.node, 'name')));
      if (subs.length) facts2.push(`${plainList(subs.map(code))} ${subs.length > 1 ? 'are' : 'is'} set from what a command prints (\`$(…)\`).`);
    },
    fileNotes: (rootNode, sections, ctx) => {
      const cmds = count(ctx.source, /^\s*[a-z]/mg);
      if (cmds > 8 && !/^\s*set\s+-\w*e/m.test(ctx.source) && sections[0]) sections[0].warnings.push('It doesn\'t use `set -e`, so it carries on after a command fails. Add `set -euo pipefail` near the top, or check each command.');
    },
    explicitReturn: false,
    scriptWord: 'the script runs',
    fileWord: 'a shell script',
  };
  function bashWarn(n, warnings) {
    const bare = [];
    for (const x of walk(n)) {
      const p = x.parent && x.parent.type === 'concatenation' ? x.parent.parent : x.parent;
      if ((x.type === 'simple_expansion' || x.type === 'expansion') && p && /^(command|for_statement)$/.test(p.type) && !/^\$[#?@*0-9]/.test(x.text) && !(p.type === 'command' && field(p, 'name') && /^(echo|printf|log|local|export)$/.test(field(p, 'name').text))) add(bare, x.text);
    }
    if (bare.length) add(warnings, `${plainList(bare.map(code), 4)} ${bare.length > 1 ? 'aren\'t' : 'isn\'t'} in quotes, so a value with spaces (or a \`*\`) would be split into several words. Write \`"${bare[0]}"\`.`);
    if (/for \w+ in \$\(ls\b/.test(n.text)) add(warnings, 'Loops over what `ls` prints, which breaks on file names with spaces. A pattern (`for f in "$DIR"/*.tar.gz`) is safer.');
    if (/\bcurl\b[^|\n]*\|\s*(sudo\s+)?(ba)?sh\b/.test(n.text)) add(warnings, 'Downloads a script and runs it straight away (`curl … | sh`), without a chance to check it.');
    if (/\beval\b/.test(n.text)) add(warnings, 'Uses `eval`, which runs text as commands. That is risky if the text comes from users or files.');
    if (/\brm -rf? +"?\$\{?\w+\}?"?\/?\*?(\s|$)/.test(n.text) && !/\$\{\w+:\?/.test(n.text)) add(warnings, 'Deletes a path made from a variable (`rm -rf "$X"`). If the variable were ever empty, it would delete the wrong thing; `${X:?}` stops the script instead.');
  }

  // Elixir: everything is a call, so the call's name decides what it is
  const exTarget = (n) => n.type === 'call' ? textOf(field(n, 'target')) : '';
  function exDef(n) {
    const args = childOf(n, /^arguments$/);
    let head = args && named(args)[0];
    let guard = null;
    if (head && head.type === 'binary_operator' && /\bwhen\b/.test(head.text)) { guard = field(head, 'right'); head = field(head, 'left'); }
    const name = head ? (head.type === 'call' ? textOf(field(head, 'target')) : head.text) : 'function';
    const params = head && head.type === 'call' ? named(childOf(head, /^arguments$/) || head).filter(c => diff(c, field(head, 'target'))).map(c => flat(c.text)) : [];
    const doBlock = childOf(n, /^do_block$/);
    const kw = args && named(args).find(c => c.type === 'keywords');
    const body = doBlock || (kw ? named(namesIn(kw, /^pair$/)[0] || kw).pop() : null);
    return { name, params, guard: guard ? flat(guard.text) : null, body };
  }
  CONFIG.elixir = {
    id: 'elixir', short: 'elixir', commentLine: HASH, libs: LIBS.elixir, libName: (s) => s.split(',')[0].split('.')[0],
    types: {
      call: (n, ctx, owner) => {
        const t = exTarget(n);
        if (t === 'defmodule' || t === 'defprotocol' || t === 'defimpl') return { k: 'class', word: 'module', name: textOf(childOf(n, /^arguments$/)), body: childOf(n, /^do_block$/) };
        if (/^(def|defp|defmacro|defmacrop|defguard|defdelegate)$/.test(t)) { const x = exDef(n); return { k: 'fn', word: /macro/.test(t) ? 'macro' : undefined, private: /p$/.test(t), ...x }; }
        if (/^(use|import|alias|require)$/.test(t)) return { k: 'import', sources: [textOf(childOf(n, /^arguments$/))], how: t };
        if (t === 'defstruct') return { k: 'var', names: namesIn(n, /^(keyword|atom)$/).map(x => x.text.replace(/:\s*$|^:/g, '')), struct: true };
        if (/^(test|describe)$/.test(t)) return { k: 'test', name: textOf(namesIn(n, /^string$/)[0]) || t, body: childOf(n, /^do_block$/) };
        return owner ? { k: 'skip' } : null;
      },
      unary_operator: (n) => {
        const c = field(n, 'operand'); const nm = c ? (c.type === 'call' ? textOf(field(c, 'target')) : c.text.split(/\s/)[0]) : '';
        if (/^(doc|moduledoc|impl|spec|typedoc|deprecated|tag|callback)$/.test(nm)) return { k: 'attr' };
        return { k: 'const', names: ['@' + nm] };
      },
    },
    top: (rootNode) => named(rootNode),
    doc: (n, d) => {
      let p = n.previousNamedSibling;
      while (p && (p.type === 'unary_operator' || isComment(p))) { const m = p.text.match(/^@(doc|moduledoc)\s+(?:~[sS])?("""([\s\S]*?)"""|"((?:\\.|[^"\\])*)")/); if (m) return flat(m[3] || m[4]); p = p.previousNamedSibling; }
      if (n.type === 'call' && exTarget(n) === 'defmodule') { const m = n.text.match(/@moduledoc\s+(?:~[sS])?("""([\s\S]*?)"""|"((?:\\.|[^"\\])*)")/); if (m) return flat(m[2] || m[3]); }
      return '';
    },
    merge: true,
    params: (n, d) => d.params || [],
    isLocal: () => false,
    bodyStatements: (n, d, body) => body && body.type === 'do_block' ? named(body) : null,
    step: (n, d, h) => {
      if (n.type === 'call') {
        const t = exTarget(n);
        if (/^(case|cond|with)$/.test(t)) { h.out.push(h.pad(d) + `check ${t === 'case' ? short(textOf(childOf(n, /^arguments$/)), 50) : 'which case applies'}`); for (const c of namesIn(childOf(n, /^do_block$/), /^stab_clause$/).slice(0, 6)) h.out.push(h.pad(d + 1) + `when ${short(textOf(field(c, 'left')), 40)}: ${short(textOf(field(c, 'right')), 50)}`); return true; }
        if (/^(if|unless)$/.test(t)) { h.out.push(h.pad(d) + `${t} ${short(textOf(childOf(n, /^arguments$/)), 50)}`); const b = childOf(n, /^do_block$/); if (b) for (const c of named(b)) { if (c.type === 'else_block') { h.out.push(h.pad(d) + 'otherwise'); for (const x of named(c)) h.visit(x, d + 1); } else h.visit(c, d + 1); } return true; }
        if (/^(raise|throw)$/.test(t)) { h.out.push(h.pad(d) + 'fail with ' + short(textOf(childOf(n, /^arguments$/)), 50)); return true; }
      }
      if (n.type === 'binary_operator' && /^\s*\|>/m.test(n.text)) { const steps = n.text.split(/\s*\|>\s*/).map(s => flat(s)); h.out.push(h.pad(d) + `take ${short(steps[0], 30)}, then pass it through ${plainList(steps.slice(1).map(s => short(s.replace(/\(.*$/s, ''), 30)))}`); return true; }
      if (n.type === 'binary_operator' && /^[^=]*[^=!<>]=[^=]/.test(n.text.split('\n')[0]) && field(n, 'left')) { h.out.push(h.pad(d) + `match ${short(textOf(field(n, 'left')), 40)} to ${h.say(field(n, 'right'))}`); return true; }
      if (n.type === 'tuple' || n.type === 'map' || n.type === 'list') { h.out.push(h.pad(d) + 'give back ' + short(n.text, 60)); return true; }
      return undefined;
    },
    notes: (n, d, F, facts2) => {
      if (d.clauses > 1) facts2.push(`It has ${d.clauses} versions (clauses); Elixir runs the first one whose pattern matches what it is given.`);
      if (d.guard) facts2.push(`It only applies when ${code(short(d.guard, 60))} (a guard).`);
      if (d.private) facts2.push('It is private (`defp`): only this module can use it.');
      if (/\|>/.test(n.text)) facts2.push('It passes values along a pipeline (`|>`): each step\'s result goes into the next.');
      if (/\{:(ok|error)\b/.test(n.text)) facts2.push('It answers with `{:ok, …}` or `{:error, …}` tuples, Elixir\'s usual way to say whether something worked.');
      if (/^handle_(call|cast|info)$|^init$/.test(d.name)) facts2.push(`It is a GenServer callback: it runs when ${d.name === 'init' ? 'the process starts' : `a message arrives (\`${d.name.replace('handle_', '')}\`)`}.`);
      if (/\bGenServer\.(call|cast)\(/.test(n.text)) facts2.push(`It sends a message to the queue's process (\`GenServer.${/GenServer\.call/.test(n.text) ? 'call`, and waits for the answer' : 'cast`, without waiting'}).`);
    },
    classNotes: (n, d, facts2, members) => {
      const uses = members.filter(m => m.d.k === 'import').map(m => `${m.d.how} ${m.d.sources[0]}`);
      if (uses.length) facts2.push('It ' + plainList(uses.map(code)) + '.');
      if (members.some(m => m.d.struct)) facts2.push('It defines a struct (`defstruct`): a map with a fixed set of keys, named after the module.');
    },
    explicitReturn: false,
  };

  // Emacs Lisp: forms are lists; the first word says what each one is
  const lispHead = (n) => {
    if (n.type === 'list') { const f = named(n)[0]; return f && f.type === 'symbol' ? f.text : ''; }
    if (n.type === 'special_form') return n.child(1) ? n.child(1).type : '';
    if (n.type === 'function_definition') return n.child(1) ? n.child(1).type : 'defun';
    return '';
  };
  const lispArgs = (n) => named(n).slice(n.type === 'list' ? 1 : 0);
  CONFIG.elisp = {
    id: 'elisp', short: 'elisp', commentLine: /^;/, commentStrip: /^;+\s?/, libs: LIBS.elisp,
    types: {
      function_definition: (n) => ({ k: 'fn', word: /^defmacro/.test(lispHead(n)) ? 'macro' : /\(interactive\b/.test(n.text) ? 'command' : undefined, name: textOf(field(n, 'name')), params: named(field(n, 'parameters')).map(x => x.text), body: n, doc: field(n, 'docstring') ? unquote(field(n, 'docstring').text) : '' }),
      special_form: (n) => {
        const h = lispHead(n);
        if (/^(defvar|defconst|defvar-local)$/.test(h)) return { k: h === 'defconst' ? 'const' : 'var', names: [textOf(named(n)[0])] };
        return null;
      },
      list: (n) => {
        const h = lispHead(n), a = lispArgs(n);
        if (h === 'require') return { k: 'import', sources: [textOf(a[0]).replace(/^'/, '')] };
        if (h === 'provide') return { k: 'skip' };
        if (/^(defcustom|defgroup|defface|defvar-keymap|defconst|defvar)$/.test(h)) return { k: h === 'defcustom' || h === 'defvar' ? 'var' : 'const', names: [textOf(a[0])], custom: h === 'defcustom' };
        if (/^(defun|defmacro|cl-defun|cl-defmacro|defsubst|cl-defmethod|cl-defgeneric)$/.test(h)) return { k: 'fn', name: textOf(a[0]), params: a[1] ? named(a[1]).map(x => x.text) : [], body: n, word: /macro/.test(h) ? 'macro' : /\(interactive\b/.test(n.text) ? 'command' : undefined };
        if (/^define-(minor|derived|globalized-minor)-mode$/.test(h)) return { k: 'class', word: 'mode', name: textOf(a[0]), members: [], doc: a.find(x => x.type === 'string') ? unquote(a.find(x => x.type === 'string').text) : '' };
        if (/^(cl-defstruct)$/.test(h)) return { k: 'type', word: 'struct', name: textOf(a[0]).replace(/^\(|\s.*$/g, ''), members: [] };
        if (h === 'ert-deftest') return { k: 'test', name: textOf(a[0]), body: n };
        return null;
      },
    },
    bodyStatements: (n) => {
      const kids = lispArgs(n);
      return kids.filter(c => diff(c, field(n, 'name')) && diff(c, field(n, 'parameters')) && diff(c, field(n, 'docstring')) && !(c.type === 'string' && c === kids.find(x => x.type === 'string')) && !/^\(interactive\b/.test(c.text) && !(c.type === 'symbol' && kids.indexOf(c) === 0) && !(c.type === 'list' && kids.indexOf(c) === 1 && n.type === 'list'));
    },
    step: (n, d, h) => {
      if (!/^(list|special_form)$/.test(n.type)) return undefined;
      const head = lispHead(n), a = lispArgs(n).filter(c => n.type === 'list' ? true : c);
      const s = (x) => x ? short(x.text, 50) : '';
      if (/^(let\*?)$/.test(head)) {
        const binds = a[0] && a[0].type === 'list' ? named(a[0]) : [];
        for (const b of binds) { const bb = named(b); h.out.push(h.pad(d) + (bb.length > 1 ? `set ${bb[0].text} to ${s(bb[1])}` : `create ${b.text}`)); }
        for (const x of a.slice(1)) h.visit(x, d);
        return true;
      }
      if (head === 'setq' || head === 'setf') { for (let i = 0; i + 1 < a.length; i += 2) h.out.push(h.pad(d) + `set ${a[i].text} to ${s(a[i + 1])}`); return true; }
      if (/^(if|when|unless)$/.test(head)) { h.out.push(h.pad(d) + `${head === 'unless' ? 'unless' : 'if'} ${s(a[0])}`); h.visit(a[1], d + 1); if (head === 'if' && a.length > 2) { h.out.push(h.pad(d) + 'otherwise'); for (const x of a.slice(2)) h.visit(x, d + 1); } else for (const x of a.slice(2)) h.visit(x, d + 1); return true; }
      if (/^(while|dolist|dotimes)$/.test(head)) { h.out.push(h.pad(d) + (head === 'while' ? `while ${s(a[0])}` : head === 'dolist' ? `for each ${a[0] ? (named(a[0])[0] || a[0]).text : 'item'} in ${a[0] && named(a[0])[1] ? s(named(a[0])[1]) : '…'}` : `repeat ${a[0] && named(a[0])[1] ? s(named(a[0])[1]) : ''} times`)); for (const x of a.slice(1)) h.visit(x, d + 1); return true; }
      if (/^(progn|save-excursion|save-restriction|with-current-buffer|save-match-data)$/.test(head)) { if (head !== 'progn') h.out.push(h.pad(d) + `${head === 'save-excursion' ? 'keeping the cursor where it is afterwards' : head}:`); for (const x of a.slice(head === 'with-current-buffer' ? 1 : 0)) h.visit(x, head === 'progn' ? d : d + 1); return true; }
      if (head === 'message') { h.out.push(h.pad(d) + 'show ' + a.map(x => short(x.text, 40)).join(' with ')); return true; }
      if (head === 'cond') { h.out.push(h.pad(d) + 'check which case applies'); for (const c of a.slice(0, 6)) h.out.push(h.pad(d + 1) + `when ${s(named(c)[0])}`); return true; }
      if (head === 'interactive') return true;
      h.out.push(h.pad(d) + `run ${head}` + (a.length ? ' with ' + a.map(x => short(x.text, 30)).join(', ') : ''));
      return true;
    },
    call: /^(list)$/,
    notes: (n, d, F, facts2) => {
      if (/\(interactive\b/.test(n.text)) facts2.push('It is a command: people can run it with `M-x` or a key, not only from other code.' + (/\(interactive "r"\)/.test(n.text) ? ' It works on the selected region (`"r"`).' : ''));
      if (/\(save-excursion\b/.test(n.text)) facts2.push('It puts the cursor back where it was afterwards (`save-excursion`).');
      if (/re-search-(forward|backward)|string-match/.test(n.text)) facts2.push('It searches the text with a regular expression.');
      if (/\(add-hook\b/.test(n.text)) facts2.push('It hooks into Emacs, so its code runs when something else happens (`add-hook`).');
    },
    settingNotes: (group, facts2) => { const c = group.filter(g => g.d.custom).flatMap(g => g.d.names); if (c.length) facts2.push(`${plainList(c.map(code))} can be changed by people in Emacs's settings (\`defcustom\`).`); },
    explicitReturn: false,
  };

  CONFIG.ocaml = {
    id: 'ocaml', short: 'ocaml', commentLine: /^\(\*|^\*/, commentStrip: /^\(\*+\s?|^\*+\s?/, libs: LIBS.ocaml,
    types: {
      open_module: (n) => ({ k: 'import', sources: [textOf(named(n)[0])] }),
      type_definition: (n) => {
        const b = childOf(n, /^type_binding$/);
        const body = field(b, 'body') || named(b).pop();
        const name = textOf(field(b, 'name'));
        if (body && body.type === 'variant_declaration') return { k: 'type', word: 'variant', name, variants: namesIn(body, /^constructor_declaration$/).map(c => textOf(childOf(c, /constructor_name/))), members: [] };
        if (body && body.type === 'record_declaration') return { k: 'type', word: 'record', name, fields: namesIn(body, /^field_declaration$/).map(f => flat(f.text)), members: [] };
        return { k: 'type', word: 'alias', name, target: textOf(body), members: [] };
      },
      exception_definition: (n) => ({ k: 'type', word: 'exception', name: textOf(namesIn(n, /constructor_name/)[0]), members: [] }),
      value_definition: (n) => {
        const b = childOf(n, /^let_binding$/);
        if (!b) return null;
        const pat = field(b, 'pattern');
        const body = field(b, 'body');
        const params = childrenOf(b, /^parameter$/).map(p => flat(p.text));
        if (pat && pat.type === 'unit') return { k: 'fn', entry: true, name: 'let ()', params: [], body, title: 'Starting point' };
        if (params.length || (body && /^(fun_expression|function_expression)$/.test(body.type))) return { k: 'fn', name: textOf(pat), params, body, rec: /^let\s+rec\b/.test(n.text) };
        return { k: 'const', names: [textOf(pat)] };
      },
      module_definition: (n) => { const b = childOf(n, /^module_binding$/); return { k: 'class', word: 'module', name: textOf(field(b, 'name') || childOf(b, /module_name/)), body: field(b, 'body') }; },
      external: (n) => ({ k: 'proto', names: [textOf(namesIn(n, /value_name/)[0])] }),
      value_specification: (n) => ({ k: 'proto', names: [textOf(namesIn(n, /value_name/)[0])] }),
    },
    blocks: /^(structure)$/,
    bodyStatements: () => null,
    kinds: { let_expression: 'ocaml-let', sequence_expression: 'ocaml-seq' },
    step: (n, d, h) => {
      if (n.type === 'let_expression') {
        for (const b of namesIn(childOf(n, /^value_definition$/), /^let_binding$/)) h.out.push(h.pad(d) + `set ${textOf(field(b, 'pattern'))} to ${h.say(field(b, 'body'))}`);
        const body = field(n, 'body') || named(n).filter(c => c.type !== 'value_definition').pop();
        if (body) h.visit(body, d);
        return true;
      }
      if (n.type === 'sequence_expression') { for (const c of named(n)) h.visit(c, d); return true; }
      return undefined;
    },
    entryText: 'Runs when the program starts (`let () = …`).',
    notes: (n, d, F, facts2) => {
      if (d.rec) facts2.push('It is `rec`: it is allowed to call itself.');
      if (/\btry\b[\s\S]*\bwith\b/.test(n.text)) facts2.push('It catches an exception and carries on (`try … with`).');
    },
    explicitReturn: false,
  };

  CONFIG.rescript = {
    id: 'rescript', short: 'rescript', commentLine: SLASHES, libs: LIBS.rescript,
    types: {
      open_statement: (n) => ({ k: 'import', sources: [flat(n.text).replace(/^open!?\s+/, '')] }),
      include_statement: (n) => ({ k: 'import', sources: [flat(n.text).replace(/^include\s+/, '')] }),
      type_declaration: (n) => {
        const b = childOf(n, /^type_binding$/);
        const name = textOf(field(b, 'name') || childOf(b, /type_identifier/));
        const body = named(b).filter(c => diff(c, field(b, 'name'))).pop();
        if (body && /variant/.test(body.type)) return { k: 'type', word: 'variant', name, variants: namesIn(body, /^variant_declaration$/).map(v => textOf(childOf(v, /variant_identifier/))), members: [] };
        if (body && /record/.test(body.type)) return { k: 'type', word: 'record', name, fields: namesIn(body, /^record_type_field$/).map(f => flat(f.text)), members: [] };
        return { k: 'type', word: 'alias', name, target: textOf(body), members: [] };
      },
      let_declaration: (n) => {
        const b = childOf(n, /^let_binding$/);
        const pat = field(b, 'pattern'), body = field(b, 'body');
        if (body && body.type === 'function') return { k: 'fn', name: textOf(pat), params: namesIn(field(body, 'parameters') || body, /^(parameter|labeled_parameter|value_identifier)$/).filter(p => same(p.parent, body) || p.parent.type === 'formal_parameters').map(p => flat(p.text)), body: field(body, 'body') };
        return { k: 'const', names: [textOf(pat)] };
      },
      module_declaration: (n) => { const b = childOf(n, /^module_binding$/); return { k: 'class', word: 'module', name: textOf(field(b, 'name') || childOf(b, /module_identifier/)), body: field(b, 'definition') || named(b).pop() }; },
      external_declaration: (n) => ({ k: 'proto', names: [textOf(namesIn(n, /value_identifier/)[0])] }),
      decorator: 'attr',
    },
    params: (n, d) => d.params || [],
    notes: (n, d, F, facts2) => {
      const jsx = [...new Set(namesIn(n, /^jsx_(opening|self_closing)_element$/).map(e => textOf(field(e, 'name') || named(e)[0])))];
      if (jsx.length) facts2.push(`It draws ${plainList(jsx.map(t => /^[A-Z]/.test(t) ? code(t) : code('<' + t + '>')), 8)}.`);
      const hooks = [...new Set((n.text.match(/React\.use\w+/g) || []))];
      if (hooks.length) facts2.push(`It keeps state with ${plainList(hooks.map(code))}.`);
      if (/->/.test(n.text)) facts2.push('It chains calls with `->` (the value on the left goes in first).');
      if (/\boption<|\bSome\(|\bNone\b/.test(n.text)) facts2.push('It deals with values that may be missing (`option`: `Some(x)` or `None`).');
    },
    adjust: (it) => { if (it.d.k === 'fn' && it.attrs.some(a => /@react\.component/.test(a.text))) { it.d.word = 'component'; it.d.headline = `${code(it.d.name)} is a React component: a reusable piece of the page` + (it.d.params.length ? `, set up with ${plainList(it.d.params.map(p => code(short(p, 40))))}.` : '.'); } },
    explicitReturn: false,
  };

  CONFIG.solidity = {
    id: 'solidity', short: 'solidity', commentLine: SLASHES, libs: LIBS.solidity, libName: (s) => s.replace(/^["']|["']$/g, '').split('/').slice(0, s.startsWith('@') || s.startsWith('"@') ? 2 : 1).join('/'),
    types: {
      pragma_directive: (n) => ({ k: 'const', names: [], pragma: flat(n.text).replace(/^pragma\s+|;$/g, '') }),
      import_directive: (n) => ({ k: 'import', sources: [unquote(textOf(field(n, 'source') || namesIn(n, /string/)[0]))] }),
      contract_declaration: (n) => ({ k: 'class', word: /^\s*abstract\b/.test(n.text) ? 'abstract class' : 'contract', bases: namesIn(n, /^inheritance_specifier$/).map(x => x.text) }),
      library_declaration: (n) => ({ k: 'class', word: 'library' }),
      interface_declaration: (n) => ({ k: 'type', word: 'interface' }),
      struct_declaration: (n) => ({ k: 'type', word: 'struct', fields: namesIn(n, /^struct_member$/).map(x => flat(x.text).replace(/;$/, '')), members: [] }),
      enum_declaration: (n) => ({ k: 'type', word: 'enum', variants: namesIn(n, /^enum_value$/).map(x => x.text), members: [] }),
      state_variable_declaration: (n) => ({ k: /\b(constant|immutable)\b/.test(n.text) ? 'const' : 'var', names: [textOf(field(n, 'name') || namesIn(n, /^identifier$/).pop())] }),
      function_definition: 'fn',
      constructor_definition: (n) => ({ k: 'fn', word: 'constructor', name: 'constructor' }),
      modifier_definition: (n) => ({ k: 'fn', word: 'modifier' }),
      fallback_receive_definition: (n) => ({ k: 'fn', name: /^\s*receive/.test(n.text) ? 'receive' : 'fallback', headline: /^\s*receive/.test(n.text) ? 'Runs when someone sends Ether to the contract without calling a function.' : 'Runs when someone calls a function the contract doesn\'t have.' }),
      event_definition: 'skip', error_declaration: 'skip', using_directive: 'skip',
      user_defined_type_definition: (n) => ({ k: 'type', word: 'alias', target: textOf(named(n).pop()) }),
    },
    isLocal: (s) => /^\.{1,2}\//.test(s),
    params: (n) => { const ps = childrenOf(n, /^parameter$/); return ps.length ? ps.map(p => flat(p.text)) : defaultParams(n); },
    returns: (n) => { const r = field(n, 'return_type') || childOf(n, /^return_type_definition$/); return r ? flat(r.text).replace(/^returns\s*\(?|\)$/g, '') : ''; },
    notes: (n, d, F, facts2) => {
      const h = flat(n.text.split('{')[0]);
      if (/\bexternal\b/.test(h)) facts2.push('Anyone can call it from outside the contract (`external`).');
      else if (/\bpublic\b/.test(h)) facts2.push('Anyone can call it, from outside or inside the contract (`public`).');
      else if (/\b(internal|private)\b/.test(h) && d.word !== 'modifier') facts2.push(`Only ${/private/.test(h) ? 'this contract' : 'this contract and ones built on it'} can call it.`);
      if (/\bpayable\b/.test(h)) facts2.push('It is `payable`: Ether can be sent along with the call.');
      if (/\b(view|pure)\b/.test(h)) facts2.push(`It only ${/pure/.test(h) ? 'works things out' : 'reads the blockchain'} (\`${/pure/.test(h) ? 'pure' : 'view'}\`), so calling it from outside costs no fees.`);
      const used = (h.replace(/^.*\)\s*/, '').match(/\b(only\w+|when\w+|nonReentrant|\w+Only)\b/g) || []);
      if (used.length) facts2.push(`It only runs if ${plainList(used.map(code))} allows it (a modifier).`);
      if (/\bmsg\.sender\b/.test(n.text)) facts2.push('It uses who is calling (`msg.sender`)' + (/\bmsg\.value\b/.test(n.text) ? ' and how much Ether they sent (`msg.value`).' : '.'));
      const ev = [...new Set((n.text.match(/\bemit\s+(\w+)/g) || []).map(x => x.replace(/^emit\s+/, '')))];
      if (ev.length) facts2.push(`It records ${plainList(ev.map(code))} in the blockchain's log (\`emit\`), which apps can watch for.`);
      const req = count(n.text, /\brequire\(/g) + count(n.text, /\brevert\b/g);
      if (req) facts2.push(`It refuses the whole call (\`require\`/\`revert\`) when a check fails ${plural(req, 'place', 'places').replace(/^1 place$/, 'in one place').replace(/^(\d+) places$/, 'in $1 places')}; nothing it changed is kept.`);
      if (/\bblock\.timestamp\b/.test(n.text)) facts2.push('It uses the block\'s time (`block.timestamp`), which miners can shift by a few seconds.');
      if (/_;/.test(n.text) && d.word === 'modifier') facts2.push('`_;` marks where the function it guards runs.');
    },
    warn: (n, d, F, warnings) => {
      if (/\btx\.origin\b/.test(n.text)) warnings.push('Uses `tx.origin` to check who is calling. Another contract can trick a user into a call that passes this check; use `msg.sender`.');
      const callAt = n.text.search(/\.call\{value:|\.call\.value\(|\.send\(|\.transfer\(/);
      if (callAt >= 0) {
        const after = n.text.slice(callAt).split('\n').slice(1).join('\n');
        if (/^\s*\w+(\[[^\]]+\])?\s*(=|\+=|-=)(?!=)/m.test(after)) warnings.push('Sends Ether before it has finished updating its own records. Another contract could call back in during the transfer (re-entrancy); update the records first.');
      }
      if (/\bselfdestruct\(/.test(n.text)) warnings.push('Uses `selfdestruct`, which removes the contract and sends away its Ether.');
    },
    classNotes: (n, d, facts2) => {
      const events = namesIn(n, /^event_definition$/).map(e => textOf(field(e, 'name') || childOf(e, /identifier/)));
      const errors = namesIn(n, /^error_declaration$/).map(e => textOf(field(e, 'name') || childOf(e, /identifier/)));
      const maps = namesIn(n, /^state_variable_declaration$/).filter(v => /\bmapping\s*\(/.test(v.text)).map(v => textOf(field(v, 'name') || namesIn(v, /^identifier$/).pop()));
      const pub = namesIn(n, /^state_variable_declaration$/).filter(v => /\bpublic\b/.test(v.text)).length;
      if (maps.length) facts2.push(`${plainList(maps.map(code))} ${maps.length > 1 ? 'are tables' : 'is a table'} (a \`mapping\`) from one value to another, such as an address to an amount.`);
      if (pub) facts2.push(`${plural(pub, 'value')} ${pub > 1 ? 'are' : 'is'} \`public\`: anyone can read ${pub > 1 ? 'them' : 'it'}.`);
      if (events.length) facts2.push(`Events it can record: ${plainList(events.map(code))}.`);
      if (errors.length) facts2.push(`Errors it can stop with: ${plainList(errors.map(code))}.`);
    },
    settingNotes: (group, facts2) => { const p = group.find(g => g.d.pragma && /solidity/.test(g.d.pragma)); if (p) facts2.push(`It needs a Solidity compiler of version ${code(p.d.pragma.replace(/^solidity\s*/, ''))}.`); },
    step: (n, d, h) => {
      const t = n.type;
      if (t === 'expression_statement' && n.namedChildCount === 1) return undefined;
      if (/call_expression/.test(t) && /^require$/.test(calleeOf(n))) { const a = argsOf(n); h.out.push(h.pad(d) + `make sure that ${h.say(a[0])}; if not, refuse the whole call` + (a[1] ? ` (${short(unquote(a[1].text), 40)})` : '')); return true; }
      if (t === 'revert_statement') { h.out.push(h.pad(d) + `refuse the whole call with ${short(n.text.replace(/^revert\s*|;$/g, ''), 50)}`); return true; }
      if (t === 'emit_statement') { h.out.push(h.pad(d) + `record the event ${short(n.text.replace(/^emit\s*|;$/g, ''), 50)}`); return true; }
      if (/^_;?$/.test(n.text.trim())) { h.out.push(h.pad(d) + 'run the function this modifier guards (`_`)'); return true; }
      if (t === 'variable_declaration_statement') { const v = named(n).pop(); const nm = namesIn(n, /^variable_declaration$/).map(x => textOf(field(x, 'name') || namesIn(x, /^identifier$/).pop())); h.out.push(h.pad(d) + (nm.length && v && !/variable_declaration/.test(v.type) ? `set ${nm.join(', ')} to ${h.say(v)}` : 'solidity: ' + short(n.text, 70))); return true; }
      return undefined;
    },
    explicitReturn: true,
    fileWord: 'Solidity code (smart contracts)',
  };

  CONFIG.zig = {
    id: 'zig', short: 'zig', commentLine: SLASHES, libs: LIBS.zig,
    types: {
      variable_declaration: (n, ctx, owner) => {
        const name = textOf(childOf(n, /^identifier$/));
        const val = named(n).filter(c => c.type !== 'identifier' && !/type$/.test(c.type) || /declaration$/.test(c.type)).pop();
        if (val && val.type === 'builtin_function' && /^@(import|cImport)/.test(val.text)) return { k: 'import', sources: [unquote(textOf(namesIn(val, /^string$/)[0]) || val.text)] };
        if (val && /^(struct|union|enum|opaque|error_set)_declaration$/.test(val.type)) {
          const word = val.type.replace('_declaration', '');
          const fns = childrenOf(val, /^function_declaration$/);
          return { k: fns.length ? 'class' : 'type', word: word === 'error_set' ? 'enum' : word, name, body: val, variants: word === 'enum' || word === 'error_set' ? namesIn(val, /^(container_field|identifier)$/).filter(x => x.parent === val).map(x => textOf(field(x, 'name') || x)) : undefined };
        }
        return { k: /^\s*(pub\s+)?const\b/.test(n.text) ? 'const' : 'var', names: [name] };
      },
      function_declaration: 'fn',
      test_declaration: (n) => ({ k: 'test', name: textOf(childOf(n, /^(string|identifier)$/)) || 'test', body: childOf(n, /^block$/) }),
      container_field: (n) => ({ k: 'var', names: [flat(n.text).replace(/,$/, '')] }),
      usingnamespace: 'skip', comptime_declaration: 'steps',
    },
    returns: (n) => textOf(field(n, 'type')),
    isLocal: (s) => /\.zig$/.test(s),
    notes: (n, d, F, facts2) => {
      const ret = textOf(field(n, 'type'));
      if (/^!/.test(ret) || /!\w/.test(ret)) facts2.push(`It can fail: \`${ret}\` means it gives back ${/void$/.test(ret) ? 'nothing' : code(ret.replace(/^.*!/, ''))}, or an error.`);
      if (/^\?/.test(ret)) facts2.push(`It may give back nothing (\`null\`): \`${ret}\` is an optional.`);
      if (/\btry\s/.test(n.text)) facts2.push('`try` passes any error straight back to the caller.');
      if (/\bcatch\b/.test(n.text)) facts2.push('It handles an error on the spot (`catch`).');
      const errs = [...new Set((n.text.match(/\berror\.\w+/g) || []))];
      if (errs.length) facts2.push(`It can stop with ${plainList(errs.map(code))}.`);
      if (/\bdefer\b|\berrdefer\b/.test(n.text)) facts2.push('It uses `defer` to clean up when it finishes, whatever happens.');
      if (/\bAllocator\b|\ballocator\b/.test(n.text)) facts2.push('It takes an allocator: the caller decides where its memory comes from.');
      const ps = defaultParams(n);
      const self = ps.find(p => /^self\b/.test(p));
      if (self) facts2.push(/\*/.test(self) ? 'It can change the value it belongs to (`self` is a pointer).' : 'It reads a copy of the value it belongs to (`self`).');
    },
    tail: () => false,
    explicitReturn: true,
  };

  CONFIG.scala = {
    id: 'scala', short: 'scala', commentLine: SLASHES, libs: LIBS.scala, libName: (s) => s.split('.').slice(0, s.startsWith('scala.') ? 2 : 1).join('.').replace(/\{.*$/, ''),
    types: {
      package_clause: (n) => ({ k: 'package', name: textOf(named(n)[0]) }),
      import_declaration: (n) => ({ k: 'import', sources: [flat(n.text).replace(/^import\s+/, '')] }),
      object_definition: (n) => ({ k: 'class', word: 'object', bases: field(n, 'extend') || childOf(n, /extends_clause/) ? [textOf(childOf(n, /extends_clause/)).replace(/^extends\s+/, '')] : [], app: /\bextends\s+App\b/.test(header(n)) }),
      class_definition: (n) => {
        const isCase = /\bcase\b/.test(textOf(childOf(n, /^modifiers$/)) + ' ' + header(n).split('class')[0]);
        const fields = namesIn(childOf(n, /^class_parameters$/), /^class_parameter$/).map(p => flat(p.text));
        const bases = childOf(n, /extends_clause/) ? [textOf(childOf(n, /extends_clause/)).replace(/^extends\s+/, '')] : [];
        const body = field(n, 'body') || childOf(n, /template_body/);
        if (isCase && !(body && namesIn(body, /^function_definition$/).length)) return { k: 'type', word: 'case class', fields, bases };
        return { k: 'class', word: isCase ? 'case class' : /\babstract\b/.test(header(n)) ? 'abstract class' : 'class', fields, bases };
      },
      trait_definition: (n) => ({ k: 'type', word: 'trait' }),
      function_definition: 'fn', function_declaration: (n) => ({ k: 'fn', body: null }),
      val_definition: (n) => ({ k: 'const', names: [textOf(field(n, 'pattern'))] }),
      var_definition: (n) => ({ k: 'var', names: [textOf(field(n, 'pattern'))] }),
      type_definition: (n) => ({ k: 'type', word: 'alias', target: textOf(field(n, 'type')) }),
      call_expression: (n, ctx, owner) => owner && /^require$/.test(calleeOf(n)) ? { k: 'skip' } : null,
    },
    entry: (n, d, owner) => d.name === 'main' && (!owner || owner.word === 'object'),
    notes: (n, d, F, facts2) => {
      if (/\bmatch\s*\{/.test(n.text)) facts2.push('It uses `match` to pick a case by the shape of a value (pattern matching).');
      const ret = defaultReturns(n);
      if (/^Option\[/.test(ret)) facts2.push('It may give back nothing: `Option` is `Some(value)` or `None`.');
      if (/\brequire\(/.test(n.text)) facts2.push('It refuses bad values straight away (`require`).');
      if (field(n, 'body') && !/^\{/.test(field(n, 'body').text.trim())) facts2.push('It is a single expression (after the `=`).');
    },
    classNotes: (n, d, facts2) => { if (/\brequire\(/.test(n.text)) facts2.push('It checks its values when one is made (`require`), and refuses bad ones.'); if (d.app) facts2.push('It `extends App`: its body runs when the program starts.'); },
    explicitReturn: false,
  };
  CLASS_WORDS['case class'] = (nm) => `${code(nm)} holds a fixed set of values and has its own tools. As a \`case class\` it gets comparing, copying and pattern matching for free.`;
  CLASS_WORDS['sealed class'] = CLASS_WORDS.class;

  // Python, through tree-sitter (the Python reader in the app is better; this answers if asked)
  CONFIG.python = {
    id: 'python', short: 'python', commentLine: HASH, libs: LIBS.python, libName: (s) => s.split('.')[0],
    types: {
      import_statement: (n) => ({ k: 'import', sources: namesIn(n, /^(dotted_name|aliased_import)$/).filter(x => same(x.parent, n)).map(x => textOf(field(x, 'name') || x)) }),
      import_from_statement: (n) => ({ k: 'import', sources: [textOf(field(n, 'module_name'))] }),
      future_import_statement: 'skip',
      function_definition: (n) => ({ k: 'fn', word: textOf(field(n, 'name')) === '__init__' ? 'constructor' : undefined }),
      class_definition: (n) => ({ k: 'class', bases: field(n, 'superclasses') ? named(field(n, 'superclasses')).map(x => x.text) : [] }),
      decorated_definition: (n, ctx, owner) => {
        const def = field(n, 'definition');
        const d = classify(def, CONFIG.python, ctx, owner) || {};
        const decos = childrenOf(n, /^decorator$/).map(x => x.text);
        if (decos.some(x => /^@dataclass/.test(x)) && def.type === 'class_definition') { d.k = 'type'; d.word = 'record'; }
        return { ...d, name: textOf(field(def, 'name')), params: defaultParams(def), body: field(def, 'body'), ret: defaultReturns(def), decorators: decos, defNode: def };
      },
      expression_statement: (n, ctx, owner) => {
        const a = named(n)[0];
        if (!owner && ctx.docId === n.id) return { k: 'skip' };
        if (a && a.type === 'assignment') { const l = textOf(field(a, 'left')); return { k: upper(l) ? 'const' : owner ? 'var' : 'var', names: [l + (field(a, 'type') ? ': ' + textOf(field(a, 'type')) : '')] }; }
        if (a && a.type === 'string' && owner) return { k: 'skip' };
        return owner ? { k: 'skip' } : null;
      },
      if_statement: (n) => /^if\s+__name__\s*==\s*['"]__main__['"]/.test(n.text) ? { k: 'fn', entry: true, name: '__main__', title: 'Starting point', body: field(n, 'consequence'), params: [] } : null,
    },
    doc: (n, d) => {
      const def = d.defNode || n;
      const b = field(def, 'body');
      const first = b && named(b)[0];
      if (first && first.type === 'expression_statement' && named(first)[0] && named(first)[0].type === 'string') return flat(unquote(named(first)[0].text).replace(/^"""|"""$|^'''|'''$/g, '').replace(/^"|"$/g, '')).split(/(?<=\.)\s/)[0];
      return '';
    },
    isTest: (n, d) => /^test_?/.test(d.name),
    prepare: (rootNode, ctx) => {
      const first = named(rootNode).find(c => !isComment(c));
      if (first && first.type === 'expression_statement' && named(first)[0] && named(first)[0].type === 'string') { ctx.docId = first.id; ctx.about = aboutText(unquote(named(first)[0].text).replace(/^"""|"""$|^'''|'''$|^"|"$/g, '').split('\n')); }
    },
    entryText: 'Runs when the file is started as a program (not when another file imports it).',
    isLocal: (s) => /^\./.test(s),
    print: /^print$/,
    explicitReturn: true,
  };

  /* ------------------------------------------------------------------ */
  /* Data files: JSON, YAML and TOML                                     */
  /* ------------------------------------------------------------------ */

  // a small model of a value: { t: 'obj', entries: [[key, V, startLine, endLine]] } | { t: 'list', items: [V] } | { t: 'str'|'num'|'bool'|'null'|'date', v }
  function jsonValue(n) {
    if (!n) return { t: 'null', v: null };
    if (n.type === 'object') return { t: 'obj', entries: childrenOf(n, /^pair$/).map(p => [unquote(textOf(field(p, 'key'))), jsonValue(field(p, 'value')), line(p), endLine(p)]) };
    if (n.type === 'array') return { t: 'list', items: named(n).filter(c => !isComment(c)).map(jsonValue) };
    if (n.type === 'string') return { t: 'str', v: unquote(n.text) };
    if (n.type === 'number') return { t: 'num', v: n.text };
    if (n.type === 'true' || n.type === 'false') return { t: 'bool', v: n.type === 'true' };
    return { t: 'null', v: null };
  }
  function yamlValue(n) {
    if (!n) return { t: 'null', v: null };
    if (/^(block_node|flow_node|document)$/.test(n.type)) { const k = named(n).filter(c => !isComment(c) && !/anchor|tag/.test(c.type)); return k.length ? yamlValue(k[k.length - 1]) : { t: 'null', v: null }; }
    if (/^(block_mapping|flow_mapping)$/.test(n.type)) return { t: 'obj', entries: childrenOf(n, /^(block_mapping_pair|flow_pair)$/).map(p => [textOf(field(p, 'key')).replace(/^["']|["']$/g, ''), yamlValue(field(p, 'value')), line(p), endLine(p)]) };
    if (/^(block_sequence|flow_sequence)$/.test(n.type)) return { t: 'list', items: named(n).filter(c => !isComment(c)).map(c => yamlValue(c.type === 'block_sequence_item' ? named(c).filter(x => !isComment(x))[0] : c)) };
    if (n.type === 'plain_scalar') { const s = named(n)[0]; const ty = s ? s.type : ''; return ty === 'integer_scalar' || ty === 'float_scalar' ? { t: 'num', v: n.text } : ty === 'boolean_scalar' ? { t: 'bool', v: /^(true|yes|on)$/i.test(n.text) } : ty === 'null_scalar' ? { t: 'null', v: null } : { t: 'str', v: n.text }; }
    if (/quote_scalar$/.test(n.type)) return { t: 'str', v: unquote(n.text) };
    if (n.type === 'block_scalar') return { t: 'str', v: n.text.replace(/^[|>][-+]?\s*\n?/, ''), block: true };
    if (n.type === 'alias') return { t: 'str', v: n.text, alias: true };
    return { t: 'str', v: n.text };
  }
  function tomlValue(n) {
    if (!n) return { t: 'null', v: null };
    if (n.type === 'array') return { t: 'list', items: named(n).filter(c => !isComment(c)).map(tomlValue) };
    if (n.type === 'inline_table') return { t: 'obj', entries: childrenOf(n, /^pair$/).map(p => [textOf(named(p)[0]), tomlValue(named(p)[1]), line(p), endLine(p)]) };
    if (n.type === 'string') return { t: 'str', v: unquote(n.text.replace(/^("""|''')|("""|''')$/g, '"')) };
    if (n.type === 'integer' || n.type === 'float') return { t: 'num', v: n.text };
    if (n.type === 'boolean') return { t: 'bool', v: n.text === 'true' };
    if (/date|time/.test(n.type)) return { t: 'date', v: n.text };
    return { t: 'str', v: n.text };
  }
  const isScalar = (v) => !/^(obj|list)$/.test(v.t);
  function scalarWords(v) {
    if (v.t === 'str') return v.block ? `a block of text (${plural(v.v.split('\n').filter(Boolean).length, 'line')})` : /^\$\{\{.*\}\}$/.test(v.v.trim()) ? `the value of ${code(v.v.trim())}` : `the text ${code(short(v.v, 60))}`;
    if (v.t === 'num') return `the number ${code(v.v)}`;
    if (v.t === 'bool') return v.v ? 'yes (`true`)' : 'no (`false`)';
    if (v.t === 'date') return `the date and time ${code(v.v)}`;
    return 'nothing (`null`)';
  }
  function describeValue(key, v) {
    const k = key == null ? 'It' : code(key);
    if (isScalar(v)) return `${k} is ${scalarWords(v)}.`;
    if (v.t === 'list') {
      if (!v.items.length) return `${k} is an empty list.`;
      if (v.items.every(isScalar)) return `${k} is a list of ${plural(v.items.length, 'value')}: ${plainList(v.items.map(i => code(short(String(i.v), 40))), 8)}.`;
      const objs = v.items.filter(i => i.t === 'obj');
      const keys = [...new Set(objs.flatMap(o => o.entries.map(e => e[0])))];
      return `${k} is a list of ${plural(v.items.length, 'item')}` + (keys.length ? `, each with ${plainList(keys.map(code), 8)}.` : '.');
    }
    const keys = v.entries.map(e => e[0]);
    return `${k} holds ${plural(keys.length, 'setting')}: ${plainList(keys.map(code), 8)}.`;
  }
  function valueFacts(v, depth = 0) {
    const out = [];
    if (v.t === 'obj') for (const [k, x] of v.entries.slice(0, 10)) out.push(isScalar(x) ? `${code(k)}: ${scalarWords(x)}.` : describeValue(k, x));
    else if (v.t === 'list') v.items.filter(i => i.t === 'obj').slice(0, 3).forEach((o, i) => out.push(`Item ${i + 1}: ` + o.entries.slice(0, 6).map(([k, x]) => `${code(k)} ${isScalar(x) ? code(short(String(x.v), 30)) : x.t === 'list' ? `(${plural(x.items.length, 'item')})` : `(${plural(x.entries.length, 'setting')})`}`).join(', ') + '.'));
    return out;
  }
  function dataWarnings(v, path = []) {
    const out = [];
    const visit = (x, p) => {
      if (x.t === 'obj') for (const [k, y] of x.entries) {
        if (y.t === 'str' && SECRET.test(k) && y.v.length >= 8 && !/^\$\{\{|^\$\{?\w+\}?$|^<.*>$|^(changeme|xxx+|your[-_ ])/i.test(y.v.trim())) add(out, `${code(p.concat(k).join('.'))} looks like a secret written straight into the file. Anyone who can read the file can use it; keep it somewhere private (an environment variable or a secrets store).`);
        visit(y, p.concat(k));
      } else if (x.t === 'list') x.items.forEach(i => visit(i, p));
      else if (x.t === 'str' && /^http:\/\/(?!localhost|127\.0\.0\.1)/.test(x.v)) add(out, `${code(short(x.v, 60))} is not encrypted (http, not https).`);
    };
    visit(v, path);
    return out;
  }
  /* What kind of file this is, from its keys. */
  function knownData(lang, path, root) {
    const base = baseOf(path).toLowerCase();
    const keys = root && root.t === 'obj' ? root.entries.map(e => e[0]) : [];
    const has = (...k) => k.every(x => keys.includes(x));
    if (base === 'package.json' || (lang === 'json' && has('name') && (keys.includes('scripts') || keys.includes('dependencies') || keys.includes('devDependencies')))) return 'a Node.js package file: the project\'s name, its commands (`scripts`) and the libraries it needs';
    if (/^tsconfig.*\.json$/.test(base) || has('compilerOptions')) return 'TypeScript\'s settings (how to check and build the code)';
    if (base === 'composer.json') return 'a PHP package file (Composer)';
    if (lang === 'yaml' && has('jobs') && (keys.includes('on') || keys.includes('true'))) return 'a GitHub Actions workflow: jobs that run automatically, for example when code is pushed';
    if (lang === 'yaml' && has('services') && (keys.includes('version') || /compose/.test(base))) return 'a Docker Compose file: the services (containers) to start together';
    if (has('apiVersion', 'kind')) return `a Kubernetes description of ${A(String((root.entries.find(e => e[0] === 'kind')[1] || {}).v))} \`${(root.entries.find(e => e[0] === 'kind')[1] || {}).v}\``;
    if (keys.includes('openapi') || keys.includes('swagger')) return 'an API description (OpenAPI): the web addresses a server answers and what they take';
    if (base === 'cargo.toml' || (lang === 'toml' && has('package') && (keys.includes('dependencies') || keys.includes('dependencies')))) return 'a Rust package file (Cargo): the crate\'s name and the crates it needs';
    if (base === 'pyproject.toml' || (lang === 'toml' && (keys.includes('project') || keys.includes('tool')) && keys.includes('build-system'))) return 'a Python project file: its name, what it needs and how it is built';
    if (lang === 'yaml' && has('stages') || /\.gitlab-ci\.yml$/.test(base)) return 'a GitLab CI file: jobs that run when code is pushed';
    return null;
  }
  function analyzeData(lang, path, source) {
    const lines = source.split('\n');
    const ctx = { lang, path, packages: [], libs: [], imports: [] };
    let root = null, ok = true, error = '', docs = null, tables = null;
    const tree = hasGrammar(lang) ? parseSafe(lang, source) : null;
    if (lang === 'json') {
      if (tree) { const top = named(tree).filter(c => !isComment(c)); root = top.length ? jsonValue(top[0]) : null; }
      else { try { root = fromJs(JSON.parse(source), lines); } catch (e) { ok = false; error = 'This isn\'t valid JSON: ' + e.message; } }
    } else if (lang === 'yaml') {
      if (tree) docs = childrenOf(tree, /^document$/).map(d => ({ v: yamlValue(d), start: line(d), end: endLine(d) }));
      else docs = [{ v: lexicalYaml(lines), start: 1, end: lines.length }];
      root = docs[0] ? docs[0].v : null;
    } else {
      if (tree) {
        const entries = [];
        tables = [];
        for (const c of named(tree)) {
          if (c.type === 'pair') entries.push([textOf(named(c)[0]), tomlValue(named(c)[1]), line(c), endLine(c)]);
          else if (c.type === 'table' || c.type === 'table_array_element') {
            const key = textOf(named(c)[0]);
            const v = { t: 'obj', entries: childrenOf(c, /^pair$/).map(p => [textOf(named(p)[0]), tomlValue(named(p)[1]), line(p), endLine(p)]) };
            tables.push({ key, v, array: c.type === 'table_array_element', start: line(c), end: endLine(c) });
          }
        }
        root = { t: 'obj', entries: entries.concat(tables.filter(t => !t.key.includes('.')).map(t => [t.key, t.v, t.start, t.end])) };
      } else root = lexicalToml(lines);
    }
    if (tree && tree.hasError()) { const bad = []; for (const x of walk(tree)) if (x.type === 'ERROR') bad.push(line(x)); if (bad.length) { if (bad.length > 3) { ok = false; error = `Parts of this file could not be read as ${nameOf(lang)} (around line ${bad.slice(0, 3).join(', ')}).`; } else error = ''; ctx.badLines = bad; } }
    const sections = [];
    const scalarGroup = [];
    const flush = () => {
      if (!scalarGroup.length) return;
      const names = scalarGroup.map(e => e[0]);
      sections.push({ kind: 'settings', title: 'Settings', headline: `Sets ${plural(names.length, 'value')}: ${plainList(names.map(code), 8)}.`, facts: scalarGroup.slice(0, 12).map(([k, v]) => `${code(k)}: ${scalarWords(v)}.`), warnings: dataWarnings({ t: 'obj', entries: scalarGroup }), steps: [], more: false, start: scalarGroup[0][2], end: scalarGroup[scalarGroup.length - 1][3], name: null });
      scalarGroup.length = 0;
    };
    const entrySection = (k, v, s, e, title) => {
      const facts2 = valueFacts(v);
      if (lang === 'yaml' && k === 'jobs' && v.t === 'obj') { facts2.length = 0; for (const [job, jv] of v.entries) facts2.push(workflowJob(job, jv)); }
      if (lang === 'yaml' && k === 'on') { facts2.unshift(`It runs ${plainList(v.t === 'obj' ? v.entries.map(([ev, x]) => ev === 'push' && x.t === 'obj' && x.entries.find(q => q[0] === 'branches') ? `when code is pushed to ${plainList(x.entries.find(q => q[0] === 'branches')[1].items ? x.entries.find(q => q[0] === 'branches')[1].items.map(i => code(i.v)) : [])}` : ev === 'push' ? 'when code is pushed' : ev === 'pull_request' ? 'for pull requests' : ev === 'schedule' ? 'on a timetable' : ev === 'workflow_dispatch' ? 'when someone starts it by hand' : code(ev)) : v.t === 'list' ? v.items.map(i => code(i.v)) : [code(String(v.v))])}.`); }
      if (/dependencies$/i.test(k) && v.t === 'obj') { facts2.length = 0; facts2.push(`${plural(v.entries.length, 'library', 'libraries')}: ${plainList(v.entries.map(([n, x]) => `${code(n)}${isScalar(x) ? ' ' + String(x.v) : ''}`), 12)}.`); for (const [n] of v.entries) add(ctx.libs, n); }
      if (k === 'scripts' && v.t === 'obj' && lang === 'json') { facts2.length = 0; for (const [n, x] of v.entries.slice(0, 10)) facts2.push(`\`npm run ${n}\` runs ${code(short(String(x.v), 60))}.`); }
      sections.push({ kind: 'data', title: title || k, headline: describeValue(k, v), facts: facts2, warnings: dataWarnings(v, [k]), steps: [], more: false, start: s, end: e, name: k });
    };
    if (lang === 'toml' && tables) {
      for (const [k, v, s, e] of root.entries.filter(x => !tables.some(t => t.key === x[0] && t.start === x[2]))) { if (isScalar(v)) scalarGroup.push([k, v, s, e]); else { flush(); entrySection(k, v, s, e); } }
      flush();
      const seen = {};
      for (const t of tables) {
        seen[t.key] = (seen[t.key] || 0) + 1;
        const total = tables.filter(x => x.key === t.key).length;
        const title = t.array ? `${t.key} (${seen[t.key]} of ${total})` : t.key;
        const headline = t.array ? `Entry ${seen[t.key]} of ${total} in the list ${code(t.key)}, with ${plainList(t.v.entries.map(e => code(e[0])), 8)}.` : `The table ${code(t.key)} holds ${plural(t.v.entries.length, 'setting')}: ${plainList(t.v.entries.map(e => code(e[0])), 8)}.`;
        sections.push({ kind: 'data', title, headline, facts: valueFacts(t.v), warnings: dataWarnings(t.v, [t.key]), steps: [], more: false, start: t.start, end: t.end, name: t.key });
      }
    } else if (lang === 'yaml' && docs && docs.length > 1) {
      docs.forEach((d, i) => {
        const v = d.v;
        sections.push({ kind: 'data', title: `Document ${i + 1}`, headline: v.t === 'obj' ? `Document ${i + 1} of ${docs.length} holds ${plural(v.entries.length, 'setting')}: ${plainList(v.entries.map(e => code(e[0])), 8)}.` : describeValue(null, v), facts: valueFacts(v), warnings: dataWarnings(v), steps: [], more: false, start: d.start, end: d.end, name: null });
      });
    } else if (root && root.t === 'obj') {
      for (const [k, v, s, e] of root.entries) { if (isScalar(v)) scalarGroup.push([k, v, s, e]); else { flush(); entrySection(k, v, s, e); } }
      flush();
    } else if (root) {
      sections.push({ kind: 'data', title: root.t === 'list' ? 'The list' : 'The value', headline: describeValue(null, root), facts: valueFacts(root), warnings: dataWarnings(root), steps: [], more: false, start: 1, end: lines.length, name: null });
    }
    if (ctx.badLines && sections[0] && ok) sections[0].warnings.unshift(`Line${ctx.badLines.length > 1 ? 's' : ''} ${ctx.badLines.join(', ')} could not be read as ${nameOf(lang)}.`);
    const kind = knownData(lang, path, root);
    const keys = root && root.t === 'obj' ? root.entries.length : 0;
    ctx.what = kind || `${A(nameOf(lang))} ${nameOf(lang)} file` + (root && root.t === 'obj' ? ` with ${plural(keys, 'top-level setting')}` : root && root.t === 'list' ? ` holding a list of ${plural(root.items.length, 'item')}` : '');
    const res = finish(lang, path, source, sections, ctx, { ok, error });
    res.overview = `${path || 'This file'} is ${ctx.what}.` + (ctx.libs.length ? ` It needs ${plainList(ctx.libs.map(code), 8)}.` : '');
    return res;
  }
  function workflowJob(job, v) {
    if (v.t !== 'obj') return `${code(job)}.`;
    const get = (k) => (v.entries.find(e => e[0] === k) || [])[1];
    const runs = get('runs-on'), steps = get('steps'), needs = get('needs'), strat = get('strategy');
    const stepNames = steps && steps.t === 'list' ? steps.items.map(s => s.t === 'obj' ? ((s.entries.find(e => e[0] === 'name') || s.entries.find(e => e[0] === 'uses') || s.entries.find(e => e[0] === 'run') || [])[1] || {}).v : s.v).filter(Boolean).map(x => short(String(x).replace(/@v\d+$/, ''), 30)) : [];
    const matrix = strat && strat.t === 'obj' && (strat.entries.find(e => e[0] === 'matrix') || [])[1];
    return `The job ${code(job)} runs on ${runs ? code(short(String(runs.v), 40)) : 'a machine GitHub provides'}` + (matrix && matrix.t === 'obj' ? ` (once for each of ${plainList(matrix.entries.flatMap(([, x]) => x.t === 'list' ? x.items.map(i => code(i.v)) : []), 6)})` : '') + (needs ? `, after ${code(isScalar(needs) ? needs.v : needs.items.map(i => i.v).join(', '))} has finished` : '') + (stepNames.length ? `, in ${plural(stepNames.length, 'step')}: ${plainList(stepNames, 8)}.` : '.');
  }
  // without a grammar: JSON from JSON.parse (lines found by searching for each key), YAML and TOML by lines
  function fromJs(x, lines) {
    if (Array.isArray(x)) return { t: 'list', items: x.map(i => fromJs(i)) };
    if (x && typeof x === 'object') {
      const entries = Object.entries(x).map(([k, v]) => [k, fromJs(v), 1, 1]);
      if (lines) { let at = 0; for (const e of entries) { const i = lines.findIndex((l, j) => j >= at && l.includes(JSON.stringify(e[0]) + ':') || j >= at && new RegExp(`^\\s*${JSON.stringify(e[0]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(l)); if (i >= 0) { e[2] = i + 1; at = i + 1; } } entries.forEach((e, i) => { e[3] = i + 1 < entries.length ? Math.max(e[2], entries[i + 1][2] - 1) : lines.length; }); }
      return { t: 'obj', entries };
    }
    return typeof x === 'string' ? { t: 'str', v: x } : typeof x === 'number' ? { t: 'num', v: String(x) } : typeof x === 'boolean' ? { t: 'bool', v: x } : { t: 'null', v: null };
  }
  const scalarOf = (s) => { s = s.trim().replace(/\s+#.*$/, ''); return /^-?\d+(\.\d+)?$/.test(s) ? { t: 'num', v: s } : /^(true|false|yes|no)$/i.test(s) ? { t: 'bool', v: /^(true|yes)$/i.test(s) } : /^(null|~|)$/.test(s) ? { t: 'null', v: null } : /^\[.*\]$/.test(s) ? { t: 'list', items: s.slice(1, -1).split(',').filter(x => x.trim()).map(scalarOf) } : { t: 'str', v: unquote(s) }; };
  function lexicalYaml(lines) {
    const entries = [];
    lines.forEach((l, i) => { const m = l.match(/^([\w"'.-][^:#]*):(\s+(.*))?$/); if (m) entries.push([m[1].replace(/^["']|["']$/g, ''), m[3] && m[3].trim() ? scalarOf(m[3]) : { t: 'obj', entries: [] }, i + 1, i + 1]); });
    entries.forEach((e, i) => { e[3] = i + 1 < entries.length ? entries[i + 1][2] - 1 : lines.length; if (e[1].t === 'obj') { const sub = lines.slice(e[2], e[3]).filter(l => /^\s+[\w-]+:/.test(l) && (l.match(/^\s*/)[0].length <= 4)); e[1].entries = sub.map(l => [l.trim().split(':')[0], scalarOf(l.split(':').slice(1).join(':')), 0, 0]); if (!sub.length && lines.slice(e[2], e[3]).some(l => /^\s*- /.test(l))) e[1] = { t: 'list', items: lines.slice(e[2], e[3]).filter(l => /^\s{0,4}- /.test(l)).map(l => scalarOf(l.replace(/^\s*- /, ''))) }; } });
    return { t: 'obj', entries };
  }
  function lexicalToml(lines) {
    const entries = [];
    let table = null;
    lines.forEach((l, i) => {
      const t = l.match(/^\s*\[\[?([^\]]+)\]\]?\s*$/);
      if (t) { table = [t[1].trim(), { t: 'obj', entries: [] }, i + 1, i + 1]; entries.push(table); return; }
      const m = l.match(/^\s*([\w."-]+)\s*=\s*(.*)$/);
      if (m) { const e = [m[1], scalarOf(m[2]), i + 1, i + 1]; if (table) { table[1].entries.push(e); table[3] = i + 1; } else entries.push(e); }
    });
    return { t: 'obj', entries };
  }

  /* ------------------------------------------------------------------ */
  /* SQL: split into statements (quotes, comments, $$ bodies, BEGIN…END) */
  /* ------------------------------------------------------------------ */

  function splitSql(source) {
    const out = [];
    let i = 0, start = 0, depth = 0, delim = ';', lineNo = 1, startLine = 1;
    const n = source.length;
    const words = [];      // the first words of the current statement
    let wordBuf = '';
    const flushWord = () => { if (wordBuf) { if (words.length < 6) words.push(wordBuf.toUpperCase()); const w = wordBuf.toUpperCase(); const block = /^CREATE$/.test(words[0] || '') && words.some(x => /^(TRIGGER|PROCEDURE|FUNCTION|EVENT)$/.test(x)) || /^(BEGIN|DO|DECLARE)$/.test(words[0] || '') && words.length === 1 && w !== 'TRANSACTION'; if (block) { if (w === 'BEGIN' || w === 'CASE') depth++; else if (w === 'END' && depth > 0) depth--; } wordBuf = ''; } };
    const push = (end) => {
      flushWord();
      let text = source.slice(start, end), skipped = 0;
      // comments before a statement belong to it as a note, not as its text
      for (let m; (m = text.match(/^\s*(--[^\n]*(\n|$)|\/\*[\s\S]*?\*\/|#[^\n]*(\n|$))/));) { skipped += count(m[0], /\n/g); text = text.slice(m[0].length); }
      if (text.trim()) { const lead = text.match(/^\s*/)[0]; const sl = startLine + skipped + count(lead, /\n/g); out.push({ text: text.trim(), start: sl, end: sl + count(text.trim(), /\n/g) }); }
      start = end + delim.length; startLine = lineNo; words.length = 0; depth = 0;
    };
    while (i < n) {
      const c = source[i], two = source.slice(i, i + 2);
      if (c === '\n') { lineNo++; flushWord(); i++; continue; }
      if (two === '--' || (c === '#' && /^\s*$/.test(source.slice(source.lastIndexOf('\n', i - 1) + 1, i)) && !/^#\w/.test(source.slice(i, i + 2)))) { const e = source.indexOf('\n', i); i = e < 0 ? n : e; flushWord(); continue; }
      if (two === '/*') { const e = source.indexOf('*/', i + 2); const stop = e < 0 ? n : e + 2; lineNo += count(source.slice(i, stop), /\n/g); i = stop; flushWord(); continue; }
      if (c === "'" || c === '"' || c === '`') {
        flushWord();
        let j = i + 1;
        while (j < n) { if (source[j] === '\\' && c !== '"' && c !== '`') { j += 2; continue; } if (source[j] === c) { if (source[j + 1] === c) { j += 2; continue; } break; } j++; }
        lineNo += count(source.slice(i, j), /\n/g); i = j + 1; continue;
      }
      if (c === '$') {
        const m = source.slice(i).match(/^\$([A-Za-z_]\w*)?\$/);
        if (m) { flushWord(); const e = source.indexOf(m[0], i + m[0].length); const stop = e < 0 ? n : e + m[0].length; lineNo += count(source.slice(i, stop), /\n/g); i = stop; continue; }
      }
      // DELIMITER // (MySQL scripts change what ends a statement)
      if ((c === 'D' || c === 'd') && !wordBuf && /^[ \t]*$/.test(source.slice(source.lastIndexOf('\n', i - 1) + 1, i))) {
        const m = source.slice(i, i + 40).match(/^DELIMITER[ \t]+(\S+)[^\n]*/i);
        if (m) { if (source.slice(start, i).trim()) push(i); delim = m[1]; i += m[0].length; start = i; startLine = lineNo; continue; }
      }
      if (/[A-Za-z_]/.test(c)) { wordBuf += c; i++; continue; }
      if (/\d/.test(c) && wordBuf) { wordBuf += c; i++; continue; }
      flushWord();
      if (source.startsWith(delim, i) && depth === 0) { push(i); i += delim.length; continue; }
      i++;
    }
    if (source.slice(start).trim()) push(n);
    return out;
  }
  const sqlName = (s) => s ? s.replace(/["`\[\]]/g, '') : s;
  function sqlStatement(text) {
    const t = flat(text.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''));
    let m;
    const facts2 = [], warnings = [];
    const cols = (s) => { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
    if ((m = t.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w."`\[\]]+)\s*\(([\s\S]*)\)/i))) {
      const name = sqlName(m[1]);
      const parts = cols(m[2]);
      const columns = parts.filter(p => !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX|KEY)\b/i.test(p));
      const names = columns.map(c => sqlName(c.split(/\s+/)[0]));
      const pk = columns.filter(c => /PRIMARY KEY/i.test(c)).map(c => sqlName(c.split(/\s+/)[0])).concat(parts.filter(p => /^PRIMARY KEY/i.test(p)).flatMap(p => (p.match(/\(([^)]*)\)/) || ['', ''])[1].split(',').map(x => sqlName(x.trim()))));
      const refs = columns.map(c => [sqlName(c.split(/\s+/)[0]), (c.match(/REFERENCES\s+([\w."`]+)/i) || [])[1]]).filter(x => x[1]).concat(parts.filter(p => /^(CONSTRAINT\s+\w+\s+)?FOREIGN KEY/i.test(p)).map(p => [(p.match(/FOREIGN KEY\s*\(([^)]*)\)/i) || [])[1], (p.match(/REFERENCES\s+([\w."`]+)/i) || [])[1]]));
      if (pk.length) facts2.push(`Each row is told apart by ${plainList(pk.map(code))} (the primary key).`);
      for (const [c, r] of refs) facts2.push(`${code(c)} points to a row in ${code(sqlName(r))}.`);
      const req = columns.filter(c => /NOT NULL/i.test(c) && !/PRIMARY KEY/i.test(c)).map(c => sqlName(c.split(/\s+/)[0]));
      if (req.length) facts2.push(`${plainList(req.map(code), 8)} must always have a value (\`NOT NULL\`).`);
      const uniq = columns.filter(c => /\bUNIQUE\b/i.test(c)).map(c => sqlName(c.split(/\s+/)[0]));
      if (uniq.length) facts2.push(`No two rows can share the same ${plainList(uniq.map(code))} (\`UNIQUE\`).`);
      const defs = columns.filter(c => /\bDEFAULT\b/i.test(c)).map(c => sqlName(c.split(/\s+/)[0]));
      if (defs.length) facts2.push(`${plainList(defs.map(code))} ${defs.length > 1 ? 'have' : 'has'} a default value when none is given.`);
      const checks = parts.filter(p => /\bCHECK\s*\(/i.test(p)).length;
      if (checks) facts2.push(`It refuses rows that fail ${plural(checks, 'check')} (\`CHECK\`).`);
      if (!pk.length) warnings.push('It has no primary key, so rows can\'t be told apart reliably.');
      return { kind: 'type', title: `Table: ${name}`, name, headline: `Makes the table ${code(name)} with ${plural(names.length, 'column')}: ${plainList(names.map(code), 10)}.`, facts: facts2, warnings, tables: [name] };
    }
    if ((m = t.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w."`]+)\s+AS\s+([\s\S]*)$/i))) {
      const inner = sqlStatement(m[2]);
      return { kind: 'type', title: `View: ${sqlName(m[1])}`, name: sqlName(m[1]), headline: `Saves a query under the name ${code(sqlName(m[1]))} (a view), so it can be read like a table. ${inner.headline}`, facts: inner.facts, warnings: inner.warnings };
    }
    if ((m = t.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([\w."`]+)?\s*ON\s+([\w."`]+)\s*(?:USING\s+\w+\s*)?\(([^)]*)\)/i)))
      return { kind: 'settings', title: `Index: ${sqlName(m[2] || m[3])}`, name: sqlName(m[2]), headline: `Adds an index on ${code(sqlName(m[3]))} (${plainList(m[4].split(',').map(x => code(sqlName(x.trim()))))}), so finding rows by ${m[4].split(',').length > 1 ? 'those columns' : 'that column'} is faster` + (m[1] ? ', and no two rows can share the same value.' : '.'), facts: [], warnings: [] };
    if ((m = t.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?(FUNCTION|PROCEDURE|TRIGGER)\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w."`]+)\s*(\(([^)]*)\))?/i))) {
      const kindW = m[1].toLowerCase();
      const ret = (t.match(/\bRETURNS\s+([\w() ,]+?)\s+(AS|LANGUAGE|BEGIN|\$)/i) || [])[1];
      const lang = (t.match(/\bLANGUAGE\s+(\w+)/i) || [])[1];
      if (kindW === 'trigger') { const when = t.match(/\b(BEFORE|AFTER|INSTEAD OF)\s+(INSERT|UPDATE|DELETE)(\s+OR\s+(INSERT|UPDATE|DELETE))*\s+ON\s+([\w."`]+)/i); return { kind: 'tool', title: `Trigger: ${sqlName(m[2])}`, name: sqlName(m[2]), headline: when ? `Runs automatically ${when[1].toLowerCase()} rows are ${when[0].match(/INSERT|UPDATE|DELETE/gi).map(x => ({ INSERT: 'added to', UPDATE: 'changed in', DELETE: 'removed from' }[x.toUpperCase()])).join(' or ')} ${code(sqlName(when[5]))}.` : `Runs automatically when the table changes (a trigger).`, facts: [], warnings: [] }; }
      const params = m[4] ? m[4].split(',').map(x => x.trim()).filter(Boolean) : [];
      return { kind: 'tool', title: `${cap(kindW)}: ${sqlName(m[2])}`, name: sqlName(m[2]), headline: `${code(sqlName(m[2]))} is a ${kindW} stored in the database that ${params.length ? 'takes ' + plainList(params.map(code)) : 'takes no inputs'}` + (ret ? ` and gives back ${A(ret)} ${code(ret.trim())}.` : '.'), facts: lang ? [`It is written in ${code(lang)}.`] : [], warnings: [] };
    }
    if ((m = t.match(/^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+([\w."`]+)\s*(\(([^)]*)\))?\s*(VALUES|SELECT)?/i))) {
      const rows = m[4] && /^VALUES$/i.test(m[4]) ? Math.max(1, count(t.slice(t.toUpperCase().indexOf('VALUES')), /\(\s*[^()]*?(\([^()]*\)[^()]*?)*\)/g)) : null;
      return { kind: 'data', title: `Add rows: ${sqlName(m[1])}`, name: sqlName(m[1]), rows: rows || 1, headline: `Adds ${rows ? plural(rows, 'row') : 'rows (from a query)'} to ${code(sqlName(m[1]))}` + (m[3] ? `, filling in ${plainList(m[3].split(',').map(x => code(sqlName(x.trim()))), 8)}.` : '.'), facts: [], warnings: [], insertInto: sqlName(m[1]) };
    }
    if ((m = t.match(/^UPDATE\s+([\w."`]+)(?:\s+\w+)?\s+SET\s+([\s\S]*?)(?:\s+WHERE\s+([\s\S]*?))?(?:\s+RETURNING[\s\S]*)?;?$/i))) {
      const sets = cols(m[2].replace(/\s+FROM\s+[\s\S]*$/i, '')).map(s => sqlName(s.split('=')[0].trim()));
      if (!m[3]) warnings.push('There is no `WHERE`, so it changes every row in the table.');
      return { kind: 'steps', title: `Change: ${sqlName(m[1])}`, name: sqlName(m[1]), headline: `Changes ${plainList(sets.map(code))} in ${code(sqlName(m[1]))}` + (m[3] ? `, only where ${code(short(m[3], 80))}.` : ', in every row.'), facts: [], warnings };
    }
    if ((m = t.match(/^DELETE\s+FROM\s+([\w."`]+)(?:\s+WHERE\s+([\s\S]*?))?;?$/i))) {
      if (!m[2]) warnings.push('There is no `WHERE`, so it removes every row in the table.');
      return { kind: 'steps', title: `Remove rows: ${sqlName(m[1])}`, name: sqlName(m[1]), headline: `Removes rows from ${code(sqlName(m[1]))}` + (m[2] ? ` where ${code(short(m[2], 80))}.` : ': all of them.'), facts: [], warnings };
    }
    if (/^(WITH\b[\s\S]*?\)\s*)?SELECT\b/i.test(t)) {
      const sel = t.replace(/^WITH\b[\s\S]*?\)\s*(?=SELECT)/i, '');
      const what = (sel.match(/^SELECT\s+(?:DISTINCT\s+)?([\s\S]*?)\s+FROM\s/i) || [])[1];
      const from = [...sel.matchAll(/\b(?:FROM|JOIN)\s+([\w."`]+)/gi)].map(x => sqlName(x[1]));
      const shown = what ? cols(what).map(c => { const a = c.match(/\s+AS\s+([\w"`]+)$/i) || c.match(/\s([\w"`]+)$/); return sqlName(a && !/\)$/.test(c.trim()) && !/^[\w.]+$/.test(c.trim()) ? a[1] : c.trim().split('.').pop()); }) : [];
      const where = (sel.match(/\bWHERE\s+([\s\S]*?)(?:\s+GROUP BY|\s+ORDER BY|\s+LIMIT|\s+HAVING|;|$)/i) || [])[1];
      const group = (sel.match(/\bGROUP BY\s+([\s\S]*?)(?:\s+ORDER BY|\s+LIMIT|\s+HAVING|;|$)/i) || [])[1];
      const order = (sel.match(/\bORDER BY\s+([\s\S]*?)(?:\s+LIMIT|;|$)/i) || [])[1];
      const limit = (sel.match(/\bLIMIT\s+(\d+)/i) || [])[1];
      if (count(sel, /\bJOIN\b/gi)) facts2.push(`It joins ${plural([...new Set(from)].length, 'table')}, matching rows ${plainList([...sel.matchAll(/\bON\s+([\w.]+\s*=\s*[\w.]+)/gi)].map(x => code(x[1])), 4) ? 'where ' + plainList([...sel.matchAll(/\bON\s+([\w.]+\s*=\s*[\w.]+)/gi)].map(x => code(x[1])), 4) : 'together'}.`);
      if (where) facts2.push(`Only rows where ${code(short(where, 80))}.`);
      if (group) facts2.push(`It adds up rows that share the same ${code(short(group, 40))} (\`GROUP BY\`).`);
      if (/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(what || '')) facts2.push(`It works out ${plainList([...new Set((what.match(/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/gi) || []).map(x => ({ COUNT: 'counts', SUM: 'totals', AVG: 'averages', MIN: 'smallest values', MAX: 'largest values' }[x.replace(/\s*\($/, '').toUpperCase()])))])}.`);
      if (order) facts2.push(`Sorted by ${code(short(order, 40))}` + (/\bDESC\b/i.test(order) ? ' (largest first).' : '.'));
      if (limit) facts2.push(`At most ${limit} rows.`);
      if (/^SELECT\s+\*/i.test(sel)) warnings.push('`SELECT *` reads every column; naming the columns needed is clearer and keeps working if the table changes.');
      return { kind: 'steps', title: `Query: ${plainList([...new Set(from)], 3) || 'values'}`, name: null, headline: from.length ? `Looks up ${shown.length && what.trim() !== '*' ? plainList(shown.map(code), 6) : 'every column'} from ${plainList([...new Set(from)].map(code), 4)}.` : `Works out ${short(what || t.replace(/^SELECT\s+/i, ''), 60)}.`, facts: facts2, warnings };
    }
    if ((m = t.match(/^DROP\s+(TABLE|VIEW|INDEX|FUNCTION|PROCEDURE|TRIGGER|DATABASE|SCHEMA)\s+(IF\s+EXISTS\s+)?([\w."`]+)/i))) {
      const w = m[1].toLowerCase();
      return { kind: 'steps', title: `Delete ${w}: ${sqlName(m[3])}`, name: sqlName(m[3]), headline: `Deletes the ${w} ${code(sqlName(m[3]))}` + (m[2] ? ' if it exists.' : '.'), facts: [], warnings: /TABLE|DATABASE|SCHEMA/i.test(m[1]) ? [`This removes the ${w} and everything in it, for good.`] : [] };
    }
    if ((m = t.match(/^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([\w."`]+)\s+([\s\S]*)$/i))) {
      const what = m[2].replace(/;$/, '');
      const said = /^ADD\s+(COLUMN\s+)?(\w+)/i.test(what) ? `adds the column ${code(what.match(/^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i)[1])}` : /^DROP\s+(COLUMN\s+)?(\w+)/i.test(what) ? `removes the column ${code(what.match(/^DROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?(\w+)/i)[1])}` : /^RENAME/i.test(what) ? 'renames something' : `changes it: ${code(short(what, 60))}`;
      return { kind: 'type', title: `Change table: ${sqlName(m[1])}`, name: sqlName(m[1]), headline: `Changes the table ${code(sqlName(m[1]))}: it ${said}.`, facts: [], warnings: /^DROP/i.test(what) ? ['Removing a column deletes its data for good.'] : [] };
    }
    if (/^(BEGIN|START TRANSACTION)\b/i.test(t)) return { kind: 'steps', title: 'Start a transaction', headline: 'Starts a transaction: the changes after it are kept together, all or nothing.', facts: [], warnings: [] };
    if (/^COMMIT\b/i.test(t)) return { kind: 'steps', title: 'Commit', headline: 'Keeps the changes made since the transaction started.', facts: [], warnings: [] };
    if (/^ROLLBACK\b/i.test(t)) return { kind: 'steps', title: 'Roll back', headline: 'Throws away the changes made since the transaction started.', facts: [], warnings: [] };
    if ((m = t.match(/^CREATE\s+(DATABASE|SCHEMA|TYPE|SEQUENCE|EXTENSION|DOMAIN)\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w."`]+)/i))) return { kind: 'type', title: `${cap(m[1].toLowerCase())}: ${sqlName(m[2])}`, name: sqlName(m[2]), headline: `Makes the ${m[1].toLowerCase()} ${code(sqlName(m[2]))}.`, facts: [], warnings: [] };
    if ((m = t.match(/^(GRANT|REVOKE)\s+([\s\S]+?)\s+ON\s+([\s\S]+?)\s+(TO|FROM)\s+([\s\S]+?);?$/i))) return { kind: 'settings', title: `${m[1] === 'GRANT' ? 'Allow' : 'Take away'}: ${short(m[5], 30)}`, headline: `${/^GRANT$/i.test(m[1]) ? 'Lets' : 'Stops'} ${code(m[5])} ${/^GRANT$/i.test(m[1]) ? '' : 'from '}${m[2].toLowerCase()} on ${code(m[3])}.`.replace('  ', ' '), facts: [], warnings: [] };
    if ((m = t.match(/^(USE|SET|PRAGMA)\s+([\s\S]+?);?$/i))) return { kind: 'settings', title: `${m[1].toUpperCase()} ${short(m[2], 30)}`, headline: /^USE$/i.test(m[1]) ? `Works in the database ${code(m[2])} from here on.` : `Changes a setting: ${code(short(m[2], 60))}.`, facts: [], warnings: [] };
    return { kind: 'steps', title: short(t.split(/\s+/).slice(0, 3).join(' '), 40), headline: `Runs ${code(short(t, 80))}.`, facts: [], warnings: [] };
  }
  function analyzeSql(path, source) {
    const lines = source.split('\n');
    const stmts = splitSql(source);
    const sections = [];
    const tables = [];
    for (const st of stmts) {
      const s = sqlStatement(st.text);
      let start = st.start;
      while (start > 1 && /^\s*(--|\/\*|\*)/.test(lines[start - 2]) && !/;\s*$/.test(lines[start - 2])) start--;
      const note = lines.slice(start - 1, st.start - 1).map(l => l.trim().replace(/^(--+|\/\*+|\*+\/?)\s?/, '').replace(/\*\/$/, '').trim()).filter(Boolean).join(' ');
      if (note) s.facts.unshift('The comment above it says: ' + short(note, 200));
      if (s.tables) tables.push(...s.tables);
      const prev = sections[sections.length - 1];
      if (s.insertInto && prev && prev.insertInto === s.insertInto && !note) {
        prev.rows += s.rows; prev.end = st.end; prev.statements++;
        prev.headline = `Adds ${plural(prev.rows, 'row')} to ${code(s.insertInto)}, in ${prev.statements} \`INSERT\` statements.`;
        continue;
      }
      sections.push({ kind: s.kind, title: s.title, headline: s.headline, facts: s.facts, warnings: s.warnings.concat(notesIn(lines, start, st.end)), steps: [], more: false, start, end: st.end, name: s.name || null, insertInto: s.insertInto, rows: s.rows, statements: 1 });
    }
    for (const s of sections) { delete s.insertInto; delete s.rows; delete s.statements; }
    const ctx = { packages: [], libs: [], imports: [], what: `SQL with ${plural(stmts.length, 'statement')}` + (tables.length ? `, making the table${tables.length > 1 ? 's' : ''} ${plainList(tables.map(code), 6)}` : '') };
    const res = finish('sql', path, source, sections, ctx, { ok: true });
    res.overview = `${path || 'This code'} is ${ctx.what}.`;
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Markdown, CSV and plain text                                        */
  /* ------------------------------------------------------------------ */

  function analyzeMarkdown(path, source) {
    const lines = source.split('\n');
    const heads = [];
    let fence = null;
    lines.forEach((l, i) => {
      const f = l.match(/^\s{0,3}(```+|~~~+)/);
      if (f) { fence = fence && l.trim().startsWith(fence) ? null : fence || f[1]; return; }
      if (fence) return;
      let m = l.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (m) heads.push({ level: m[1].length, text: m[2], line: i + 1 });
      else if (i > 0 && /^\s{0,3}(=+|-+)\s*$/.test(l) && lines[i - 1].trim() && !/^\s*[-*+>|#]/.test(lines[i - 1]) && !(heads.length && heads[heads.length - 1].line === i)) heads.push({ level: /=/.test(l) ? 1 : 2, text: lines[i - 1].trim(), line: i, setext: true });
    });
    const sections = [];
    const describe = (from, to) => {
      const body = lines.slice(from - 1, to);
      const facts2 = [];
      let paras = 0, inPara = false, inFence = false, codeLangs = [], listItems = 0, tableRows = 0, quotes = 0;
      for (const l of body) {
        const f = l.match(/^\s{0,3}(```+|~~~+)\s*([\w+-]*)/);
        if (f) { if (!inFence) { add(codeLangs, f[2] || 'code'); } inFence = !inFence; inPara = false; continue; }
        if (inFence) continue;
        if (/^\s*([-*+]|\d+[.)])\s+\S/.test(l)) { listItems++; inPara = false; continue; }
        if (/^\s*\|.*\|\s*$/.test(l)) { if (!/^\s*\|?\s*:?-+/.test(l)) tableRows++; inPara = false; continue; }
        if (/^\s*>/.test(l)) { quotes++; continue; }
        if (/^\s{0,3}#{1,6}\s/.test(l) || /^\s{0,3}(=+|-+)\s*$/.test(l)) { inPara = false; continue; }
        if (l.trim()) { if (!inPara) paras++; inPara = true; } else inPara = false;
      }
      const links = [...body.join('\n').matchAll(/(!?)\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g)];
      const bits = [paras && plural(paras, 'paragraph'), listItems && `a list of ${plural(listItems, 'item')}`, tableRows && `a table with ${plural(Math.max(0, tableRows - 1), 'row')}`, codeLangs.length && `${codeLangs.length > 1 ? plural(codeLangs.length, 'code example') : 'a code example'} (${plainList(codeLangs)})`, quotes && 'a quotation'].filter(Boolean);
      const pics = links.filter(l => l[1]).map(l => l[3]), hrefs = links.filter(l => !l[1]);
      if (hrefs.length) facts2.push(`Links to ${plainList(hrefs.map(l => `${code(short(l[3], 50))} ("${short(l[2], 30)}")`), 5)}.`);
      if (pics.length) facts2.push(`Shows ${plural(pics.length, 'picture')}: ${plainList(pics.map(p => code(short(p, 40))), 4)}.`);
      const firstText = body.find(l => l.trim() && !/^\s*(#|```|~~~|[-*+]\s|\d+\.\s|\||>|=+$|-+$)/.test(l));
      if (firstText) facts2.push('It starts: ' + short(firstText.trim(), 160));
      const warnings = [];
      for (const l of links.filter(x => !x[1] && /^http:\/\//.test(x[3]))) add(warnings, `${code(short(l[3], 60))} is not encrypted (http, not https).`);
      return { bits, facts: facts2, warnings: warnings.concat(notesIn(lines, from, to)) };
    };
    if (!heads.length || heads[0].line > 1) {
      const end = heads.length ? heads[0].line - 1 : lines.length;
      const d = describe(1, end);
      if (lines.slice(0, end).some(l => l.trim())) sections.push({ kind: 'about', title: 'Introduction', headline: d.bits.length ? cap(plainList(d.bits)) + ' before the first heading.' : 'Text before the first heading.', facts: d.facts, warnings: d.warnings, steps: [], more: false, start: 1, end, name: null });
    }
    heads.forEach((h, i) => {
      const end = i + 1 < heads.length ? heads[i + 1].line - 1 : lines.length;
      const d = describe(h.line + 1, end);
      const sub = heads.slice(i + 1).filter((x, j, arr) => x.level > h.level && heads.slice(i + 1, i + 1 + j).every(y => y.level > h.level));
      const plain = h.text.replace(/[*_`]/g, '');
      sections.push({ kind: 'heading', title: plain, headline: `${['', 'The main heading', 'A section', 'A smaller section', 'A sub-section', 'A sub-section', 'A sub-section'][h.level]}, ${code(short(plain, 60))}` + (d.bits.length ? `, with ${plainList(d.bits)}.` : sub.length ? '.' : ', with nothing under it yet.'), facts: d.facts.concat(sub.length && h.level < 3 ? [`Its parts: ${plainList(sub.map(s => code(short(s.text.replace(/[*_`]/g, ''), 40))), 8)}.`] : []), warnings: d.warnings, steps: [], more: false, start: h.line, end: Math.max(h.line, end), name: plain, level: h.level });
    });
    const title = heads.find(h => h.level === 1);
    const ctx = { packages: [], libs: [], imports: [], what: `a Markdown document` + (title ? ` called ${code(title.text.replace(/[*_`]/g, ''))}` : '') + (heads.length ? `, in ${plural(heads.length, 'part')}` : '') };
    const res = finish('markdown', path, source, sections, ctx, { ok: true });
    res.overview = `${path || 'This text'} is ${ctx.what}.`;
    return res;
  }

  function splitCsvLine(l, d) {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"' && !cur.trim()) q = true;
      else if (c === d) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }
  function csvRows(source, d) {
    const rows = [];
    let q = false, rowStart = 1, lineNo = 1;
    let i = 0;
    const text = source;
    let val = '';
    let row = [];
    for (; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { val += '"'; i++; } else q = false; } else { if (c === '\n') lineNo++; val += c; } continue; }
      if (c === '"' && !val.trim()) { q = true; continue; }
      if (c === d) { row.push(val); val = ''; continue; }
      if (c === '\n') { row.push(val.replace(/\r$/, '')); rows.push({ cells: row, line: rowStart }); row = []; val = ''; lineNo++; rowStart = lineNo; continue; }
      val += c;
    }
    if (val || row.length) { row.push(val); rows.push({ cells: row, line: rowStart }); }
    return rows.filter(r => r.cells.some(c => c.trim()));
  }
  function analyzeCsv(path, source) {
    const lines = source.split('\n');
    const d = csvShape(headText(source)) || (/\.tsv$/i.test(path) ? '\t' : ',');
    const rows = csvRows(source, d);
    const sections = [];
    if (!rows.length) return finish('csv', path, source, [], { packages: [], libs: [], imports: [], what: 'an empty table' }, { ok: true });
    const head = rows[0].cells.map(c => c.trim());
    const looksHeader = head.every(c => c && !/^-?\d+([.,]\d+)?$/.test(c)) && new Set(head).size === head.length;
    const cols = looksHeader ? head : head.map((_, i) => `column ${i + 1}`);
    const data = looksHeader ? rows.slice(1) : rows;
    const facts2 = [];
    cols.forEach((c, i) => {
      const vals = data.map(r => (r.cells[i] || '').trim());
      const filled = vals.filter(Boolean);
      const nums = filled.filter(v => /^-?\d+([.,]\d+)?$/.test(v)).map(v => parseFloat(v.replace(',', '.')));
      const dates = filled.filter(v => /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v));
      const distinct = [...new Set(filled)];
      let say;
      if (filled.length && nums.length === filled.length) { const min = Math.min(...nums), max = Math.max(...nums), tot = nums.reduce((a, b) => a + b, 0); say = `numbers from ${min} to ${max}` + (filled.length > 1 ? `, adding up to ${Math.round(tot * 100) / 100}` : ''); }
      else if (filled.length && dates.length === filled.length) { const s = [...filled].sort(); say = `dates from ${s[0]} to ${s[s.length - 1]}`; }
      else if (filled.length && distinct.length <= Math.min(8, Math.max(2, filled.length / 3))) say = `one of ${plural(distinct.length, 'value')}: ${plainList(distinct.map(x => code(short(x, 20))), 8).replace(/ and ([^,]*)$/, ' or $1')}`;
      else if (filled.length && distinct.every(x => /^(yes|no|true|false|y|n|0|1)$/i.test(x))) say = 'yes or no';
      else say = filled.length ? `text, such as ${plainList(distinct.slice(0, 3).map(x => code(short(x, 30))))}` : 'empty';
      const empty = vals.length - filled.length;
      facts2.push(`${code(c)}: ${say}` + (empty && filled.length ? ` (${empty} empty)` : '') + '.');
    });
    const warnings = [];
    const bad = data.filter(r => r.cells.length !== cols.length);
    if (bad.length) warnings.push(`${plural(bad.length, 'row')} ${bad.length > 1 ? 'have' : 'has'} a different number of values from the header (line${bad.length > 1 ? 's' : ''} ${bad.slice(0, 5).map(r => r.line).join(', ')}${bad.length > 5 ? '…' : ''}).`);
    const sep = d === '\t' ? 'tabs' : d === ',' ? 'commas' : `"${d}"`;
    if (looksHeader) sections.push({ kind: 'data', title: 'Columns', headline: `The first line names ${plural(cols.length, 'column')}: ${plainList(cols.map(code), 10)}.`, facts: [`Values are separated by ${sep}.`], warnings: [], steps: [], more: false, start: 1, end: rows[0].line, name: null });
    if (data.length) sections.push({ kind: 'data', title: 'Rows', headline: `${plural(data.length, 'row')} of data.`, facts: facts2, warnings, steps: [], more: false, start: data[0].line, end: lines.length - (lines[lines.length - 1] === '' ? 1 : 0), name: null });
    const res = finish('csv', path, source, sections, { packages: [], libs: [], imports: [] }, { ok: true });
    res.overview = `${path || 'This text'} is a table (CSV) with ${plural(cols.length, 'column')} and ${plural(data.length, 'row')}.`;
    return res;
  }

  function analyzeText(path, source) {
    const lines = source.split('\n');
    const sections = [];
    let i = 0;
    while (i < lines.length) {
      while (i < lines.length && !lines[i].trim()) i++;
      if (i >= lines.length) break;
      const start = i;
      while (i < lines.length && lines[i].trim()) i++;
      const block = lines.slice(start, i);
      const text = flat(block.join(' '));
      const isHead = block.length === 1 && text.length < 70 && !/[.!?,;:]$/.test(text) && !/^[-*•\d]/.test(text);
      const first = sections.length === 0;
      const sentence = (text.match(/^(.+?[.!?])(\s|$)/) || [null, text])[1];
      sections.push({ kind: isHead ? 'heading' : 'part', title: short(isHead ? text : sentence.replace(/[.!?]$/, ''), 50), headline: isHead ? `${first ? 'The title' : 'A heading'}: ${code(short(text, 70))}.` : short(sentence, 200).replace(/([^.!?…])$/, '$1.'), facts: block.length > 1 || text.length > sentence.length ? [`${plural(block.length, 'line')}, about ${plural(text.split(/\s+/).length, 'word')}.`] : [], warnings: notesIn(lines, start + 1, i), steps: [], more: false, start: start + 1, end: i, name: null });
    }
    const wordsN = source.split(/\s+/).filter(Boolean).length;
    const res = finish('text', path, source, sections, { packages: [], libs: [], imports: [] }, { ok: true });
    res.overview = `${path || 'This'} is plain text: ${plural(sections.filter(s => s.kind === 'part').length, 'paragraph')}, about ${plural(wordsN, 'word')}.`;
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Vue, ERB, TLA+ and SystemRDL: grammars with shapes of their own     */
  /* ------------------------------------------------------------------ */

  function analyzeVue(path, source) {
    const rootNode = parseSafe('vue', source);
    const lines = source.split('\n');
    const sections = [];
    const libs = [];
    const tmpl = childOf(rootNode, /^template_element$/);
    const script = childrenOf(rootNode, /^script_element$/);
    const style = childrenOf(rootNode, /^style_element$/);
    let methods = [], props = [], dataKeys = [], computed = [];
    for (const sc of script) {
      const raw = childOf(sc, /^raw_text$/);
      const startTag = textOf(childOf(sc, /^start_tag$/));
      const isTs = /lang=["']ts["']/.test(startTag), setup = /\bsetup\b/.test(startTag);
      const facts2 = [];
      const text = raw ? raw.text : '';
      const k = isTs ? 'ts' : 'js';
      let st = { steps: [], more: false };
      if (raw && WR().hasLang && WR().hasLang(k)) {
        const r = parseSafe(k, text);
        for (const n of walk(r)) {
          if (n.type === 'import_statement') { const s = unquote(textOf(field(n, 'source'))); if (!/^\./.test(s)) add(libs, s); }
          if (n.type === 'pair' && n.parent && n.parent.parent && n.parent.parent.type === 'export_statement' || n.type === 'pair' && n.parent && n.parent.type === 'object' && n.parent.parent && n.parent.parent.type === 'export_statement') {
            const key = textOf(field(n, 'key')), v = field(n, 'value');
            if (key === 'props' && v) props = v.type === 'object' ? childrenOf(v, /^pair$/).map(p => textOf(field(p, 'key'))) : named(v).map(x => unquote(x.text));
            if (key === 'methods' && v) methods = named(v).filter(x => /method_definition|pair/.test(x.type)).map(x => textOf(field(x, 'name') || field(x, 'key')));
            if (key === 'computed' && v) computed = named(v).filter(x => /method_definition|pair/.test(x.type)).map(x => textOf(field(x, 'name') || field(x, 'key')));
          }
          if (n.type === 'method_definition' && textOf(field(n, 'name')) === 'data') { const ret = namesIn(n, /^return_statement$/)[0]; const obj = ret && namesIn(ret, /^object$/)[0]; if (obj) dataKeys = named(obj).map(p => textOf(field(p, 'key') || p)); }
        }
        if (setup) {
          const top = named(r);
          const fns = top.filter(n => n.type === 'function_declaration' || (n.type === 'lexical_declaration' && /=>|function/.test(n.text))).map(n => n.type === 'function_declaration' ? textOf(field(n, 'name')) : textOf(field(named(n)[0], 'name')));
          const refs = top.filter(n => n.type === 'lexical_declaration' && /\b(ref|reactive|computed)\(/.test(n.text)).map(n => textOf(field(named(n)[0], 'name')));
          if (refs.length) facts2.push(`It keeps ${plainList(refs.map(code))}; the page updates when they change (\`ref\`/\`reactive\`).`);
          if (fns.length) facts2.push(`Its tools: ${plainList(fns.map(code), 8)}.`);
          const p = text.match(/defineProps\s*(<[^>]*>)?\(\s*(\[[^\]]*\]|\{[\s\S]*?\})/);
          if (p) props = (p[2].match(/['"]?(\w+)['"]?\s*[:,\]]/g) || []).map(x => x.replace(/['":,\]\s]/g, ''));
        }
      }
      if (props.length) facts2.push(`It is given ${plainList(props.map(code))} by the page that uses it (\`props\`).`);
      if (dataKeys.length) facts2.push(`It keeps ${plainList(dataKeys.map(code))}; the page updates when they change (\`data\`).`);
      if (computed.length) facts2.push(`${plainList(computed.map(code))} ${computed.length > 1 ? 'are' : 'is'} worked out from those values (\`computed\`).`);
      if (methods.length) facts2.push(`Its tools: ${plainList(methods.map(code), 8)}.`);
      if (libs.length) facts2.push(`It uses ${plainList(libs.map(code))}.`);
      sections.push({ kind: 'script', title: setup ? 'Script (setup)' : 'Script', headline: `The component's code${isTs ? ', in TypeScript' : ''}: what it keeps and what it does.`, facts: facts2, warnings: notesIn(lines, line(sc), endLine(sc)), steps: st.steps, more: false, start: line(sc), end: endLine(sc), name: null });
    }
    if (tmpl) {
      const els = namesIn(tmpl, /^(element|self_closing_tag)$/);
      const tags = els.map(e => textOf(namesIn(e, /^tag_name$/)[0]).toLowerCase());
      const comps = [...new Set(els.map(e => textOf(namesIn(e, /^tag_name$/)[0])).filter(t => /^[A-Z]|-/.test(t)))];
      const attrs = namesIn(tmpl, /^(directive_attribute|attribute)$/).map(a => a.text);
      const facts2 = [];
      const events = [...new Set(attrs.map(a => (a.match(/^(?:@|v-on:)([\w.-]+)="([^"]*)"/) || [])).filter(m => m[1]).map(m => `${m[1]} → ${code(m[2])}`))];
      if (events.length) facts2.push(`Reacts to: ${plainList(events, 6)}.`);
      const ifs = attrs.filter(a => /^v-(if|else-if|show)=/.test(a)).length, fors = attrs.filter(a => /^v-for=/.test(a)).map(a => a.replace(/^v-for=|"/g, ''));
      if (ifs) facts2.push(`${plural(ifs, 'part')} ${ifs > 1 ? 'are' : 'is'} only shown when a condition holds (\`v-if\`/\`v-show\`).`);
      for (const f of fors) facts2.push(`Repeats a part for each item: ${code(f)} (\`v-for\`).`);
      const shown = [...new Set(namesIn(tmpl, /^interpolation$/).map(x => flat(x.text).replace(/^\{\{\s*|\s*\}\}$/g, '')))];
      if (shown.length) facts2.push(`Shows the values ${plainList(shown.map(code), 8)} (\`{{ }}\`).`);
      if (comps.length) facts2.push(`Uses the components ${plainList(comps.map(code))}.`);
      const bits = ['button', 'input', 'a', 'img', 'form', 'li'].map(t => [t, tags.filter(x => x === t).length]).filter(x => x[1]).map(([t, n]) => plural(n, { button: 'button', input: 'input box', a: 'link', img: 'picture', form: 'form', li: 'list item' }[t]));
      sections.push({ kind: 'part', title: 'Template', headline: `What the component shows: ${plural(els.length, 'element')}` + (bits.length ? `, including ${plainList(bits)}.` : '.'), facts: facts2, warnings: namesIn(tmpl, /^element$/).some(e => /^<img\b/.test(e.text) && !/\balt=/.test(e.text)) ? ['A picture has no description (alt text), so screen readers can\'t describe it.'] : [], steps: [], more: false, start: line(tmpl), end: endLine(tmpl), name: null });
    }
    for (const s of style) {
      const sels = [...new Set((childOf(s, /^raw_text$/) ? childOf(s, /^raw_text$/).text : '').match(/[^{}]+(?=\{)/g) || [])].map(x => x.trim()).filter(Boolean);
      const scoped = /\bscoped\b/.test(textOf(childOf(s, /^start_tag$/)));
      sections.push({ kind: 'style', title: scoped ? 'Styles (scoped)' : 'Styles', headline: `${plural(sels.length, 'style rule')} for ${plainList(sels.map(code), 6)}.` + (scoped ? ' They are `scoped`: they only apply inside this component.' : ''), facts: [], warnings: [], steps: [], more: false, start: line(s), end: endLine(s), name: null });
    }
    sections.sort((a, b) => a.start - b.start);
    const res = finish('vue', path, source, sections, { packages: [], libs, imports: libs.map(s => ({ source: s })), what: 'a Vue component' }, { ok: !rootNode.hasError(), error: rootNode.hasError() ? 'Some of this file could not be read.' : '' });
    res.overview = `${path || 'This'} is a Vue component` + (props.length ? ` that is given ${plainList(props.map(code))}` : '') + '. ' + `It has ${plainList([tmpl && 'a template (what it shows)', script.length && 'a script (what it does)', style.length && 'styles'].filter(Boolean))}.`;
    return res;
  }

  function analyzeErb(path, source) {
    const rootNode = parseSafe('erb', source);
    const lines = source.split('\n');
    const sections = [];
    const parts = named(rootNode);
    let depth = 0, cur = null;
    const close = (endRow) => { if (cur) { cur.end = Math.max(cur.start, endRow); sections.push(cur); cur = null; } };
    const plainPart = (n) => { if (!cur) cur = { kind: 'part', title: 'Page content', headline: '', facts: [], warnings: [], steps: [], more: false, start: line(n), end: endLine(n), name: null, shows: [], tags: [] }; };
    for (const n of parts) {
      const codeText = n.type === 'content' ? '' : flat(textOf(childOf(n, /^code$/)));
      if (n.type === 'comment_directive') { if (cur) cur.steps.push('note: ' + short(n.text.replace(/^<%#\s*|\s*%>$/g, ''), 70)); continue; }
      const opens = /\b(do)(\s*\|[^|]*\|)?\s*$|^\s*(if|unless|case|while|until|for)\b/.test(codeText) && !/\bend\s*$/.test(codeText);
      const closes = /^end\b/.test(codeText);
      const mid = /^(else|elsif|when)\b/.test(codeText);
      if (depth === 0 && opens) {
        close(line(n) - 1);
        const each = codeText.match(/^(.+?)\.(each|each_with_index|map)\s+do\s*\|([^|]+)\|/);
        const cond = codeText.match(/^(if|unless)\s+(.+)$/);
        cur = { kind: 'steps', title: each ? `For each ${each[3].trim()}` : cond ? `${cond[1] === 'if' ? 'If' : 'Unless'} ${short(cond[2], 40)}` : short(codeText, 40), headline: each ? `Repeats this part of the page for each ${code(each[3].trim())} in ${code(each[1])}.` : cond ? `This part of the page is only shown ${cond[1] === 'if' ? 'if' : 'unless'} ${code(cond[2])}.` : `A block of Ruby: ${code(short(codeText, 60))}.`, facts: [], warnings: [], steps: [], more: false, start: line(n), end: endLine(n), name: null, shows: [], tags: [] };
        depth = 1;
        continue;
      }
      if (depth > 0) {
        if (opens) depth++;
        if (closes) depth--;
        if (mid && depth === 1) cur.steps.push(codeText.startsWith('else') ? 'otherwise' : 'when ' + codeText.replace(/^(elsif|when)\s+/, ''));
        if (n.type === 'output_directive') add(cur.shows, codeText);
        if (n.type === 'content') for (const t of n.text.match(/<([a-z][\w-]*)/g) || []) add(cur.tags, t.slice(1));
        if (depth === 0) { cur.end = endLine(n); sections.push(cur); cur = null; }
        continue;
      }
      if (n.type === 'content' && !n.text.trim()) continue;
      plainPart(n);
      cur.end = endLine(n);
      if (n.type === 'output_directive') add(cur.shows, codeText);
      if (n.type === 'directive') cur.steps.push('ruby: ' + short(codeText, 60));
      if (n.type === 'content') for (const t of n.text.match(/<([a-z][\w-]*)/g) || []) add(cur.tags, t.slice(1));
    }
    close(lines.length);
    for (const s of sections) {
      const renders = s.shows.filter(x => /^render\b/.test(x)), links = s.shows.filter(x => /^link_to\b|^button_to\b/.test(x));
      const vals = s.shows.filter(x => !/^(render|link_to|button_to|form_with|form_for|image_tag)\b/.test(x));
      if (vals.length) s.facts.push(`Shows ${plainList(vals.map(v => code(short(v, 50))), 6)} (\`<%= %>\`).`);
      if (renders.length) s.facts.push(`Puts in another template: ${plainList(renders.map(r => code(short(r.replace(/^render\s+(partial:\s*)?/, ''), 40))))}.`);
      if (links.length) s.facts.push(`Adds ${plural(links.length, 'link or button', 'links or buttons')}: ${plainList(links.map(l => code(short(l, 50))))}.`);
      if (s.tags.length) s.facts.push(`HTML used: ${plainList([...new Set(s.tags)].map(t => code('<' + t + '>')), 8)}.`);
      if (!s.headline) s.headline = `${s.shows.length ? 'Page content with values from the code' : 'Plain page content'}.`;
      if (s.shows.some(x => /\.html_safe\b|\braw\(/.test(x))) s.warnings.push('Shows a value without escaping it (`html_safe`/`raw`). If it can come from users, they could inject their own code (XSS).');
      if (s.kind === 'steps' && s.steps.includes('otherwise')) s.facts.unshift('It has an `else` part: something else is shown when that isn\'t so.');
      s.steps = s.kind === 'steps' ? s.steps.filter(x => x !== 'otherwise' && !/^when /.test(x)).slice(0, 16) : s.steps.slice(0, 16);
      delete s.shows; delete s.tags;
    }
    const res = finish('erb', path, source, sections, { packages: [], libs: [], imports: [], what: 'a page template (ERB): HTML with Ruby code in `<% %>` tags' }, { ok: !rootNode.hasError(), error: '' });
    res.overview = `${path || 'This'} is a page template (ERB): HTML with Ruby in \`<% %>\` tags. ${plural(namesIn(rootNode, /^output_directive$/).length, 'value')} ${namesIn(rootNode, /^output_directive$/).length === 1 ? 'is' : 'are'} put into the page.`;
    return res;
  }

  function analyzeTla(path, source) {
    const rootNode = parseSafe('tlaplus', source);
    const lines = source.split('\n');
    const mod = childOf(rootNode, /^module$/) || rootNode;
    const sections = [];
    const vars = [];
    let settings = null;
    const pushSetting = (n, what, names) => {
      if (settings && settings.end >= line(n) - 2) { settings.end = endLine(n); settings.names.push(...names); settings.facts.push(what); return; }
      settings = { kind: 'settings', title: 'Settings', facts: [what], warnings: [], steps: [], more: false, start: line(n), end: endLine(n), name: null, names: [...names] };
      sections.push(settings);
    };
    for (const n of named(mod)) {
      if (n.type === 'extends') { sections.push({ kind: 'imports', title: 'Modules used', headline: `Builds on ${plainList(named(n).map(x => code(x.text)))}.`, facts: named(n).map(x => code(x.text) + ({ Naturals: ' (whole numbers 0, 1, 2…)', Integers: ' (whole numbers)', Sequences: ' (lists)', FiniteSets: ' (counting sets)', TLC: ' (the model checker\'s helpers)', Reals: ' (real numbers)' }[x.text] || '')), warnings: [], steps: [], more: false, start: line(n), end: endLine(n), name: null }); settings = null; continue; }
      if (n.type === 'constant_declaration') { const names = namesIn(n, /^identifier$/).map(x => x.text); pushSetting(n, `${plainList(names.map(code))} ${names.length > 1 ? 'are constants' : 'is a constant'}: given a value when the model is checked.`, names); continue; }
      if (n.type === 'variable_declaration') { const names = namesIn(n, /^identifier$/).map(x => x.text); vars.push(...names); pushSetting(n, `${plainList(names.map(code))} ${names.length > 1 ? 'are the variables' : 'is the variable'}: together they are the state of the system.`, names); continue; }
      if (n.type === 'operator_definition' || n.type === 'function_definition') {
        settings = null;
        const name = textOf(field(n, 'name'));
        const def = field(n, 'definition') || named(n).pop();
        const text = def ? def.text : '';
        const primed = [...new Set((text.match(/\b(\w+)'/g) || []).map(x => x.slice(0, -1)))];
        const unchanged = [...new Set(((text.match(/UNCHANGED\s*(<<[^>]*>>|\w+)/g) || []).join(' ').replace(/UNCHANGED|<<|>>/g, '').split(/[\s,]+/).filter(Boolean)))];
        const conj = def && def.type === 'conj_list' ? childrenOf(def, /^conj_item$/).map(c => flat(c.text).replace(/^\/\\\s*/, '')) : null;
        const disj = def && def.type === 'disj_list' ? childrenOf(def, /^disj_item$/).map(c => flat(c.text).replace(/^\\\/\s*/, '')) : null;
        const steps = [];
        for (const c of conj || []) {
          let m;
          if ((m = c.match(/^(\w+)'\s*=\s*(.+)$/))) steps.push(`${m[1]} becomes ${m[2]}`);
          else if ((m = c.match(/^UNCHANGED\s*(.+)$/))) steps.push(`${m[1].replace(/<<|>>/g, '')} stay${/,/.test(m[1]) ? '' : 's'} the same`);
          else if ((m = c.match(/^(\w+)\s*\\in\s*(.+)$/)) && !primed.length) steps.push(`${m[1]} is one of ${m[2]}`);
          else if ((m = c.match(/^(\w+)\s*=\s*(.+)$/)) && name === 'Init') steps.push(`${m[1]} starts as ${m[2]}`);
          else steps.push(`only when ${c}`);
        }
        const facts2 = [];
        let kind = 'tool', title = `Definition: ${name}`, headline;
        const note = commentAbove(lines, line(n) - 1, { commentLine: /^\(\*|^\\\*/, commentStrip: /^\(\*+\s?|^\\\*+\s?/ });
        if (name === 'Init') { kind = 'start'; title = 'Start: Init'; headline = 'The starting state: the values the variables begin with.'; }
        else if (primed.length) { title = `Step: ${name}`; headline = `${code(name)} is one step the system can take` + (conj && conj.some(c => !/'/.test(c) && !/^UNCHANGED/.test(c)) ? ', when its conditions hold' : '') + `. It changes ${plainList(primed.map(code))}` + (unchanged.length ? ` and keeps ${plainList(unchanged.map(code))} the same.` : '.'); }
        else if (/\[\]\[/.test(text) || name === 'Spec') { title = `Specification: ${name}`; headline = `${code(name)} is the whole specification: start with ${code((text.match(/^(\w+)/) || [])[1] || 'Init')}, then take steps of ${code((text.match(/\[\]\[(\w+)\]/) || [])[1] || 'Next')} (or leave the variables as they are).`; }
        else if (disj && disj.length || /^\s*\w+\s*\\\/\s*\w+/.test(text)) { const opts = disj || text.split(/\s*\\\/\s*/).map(flat); title = `Choice: ${name}`; headline = `${code(name)} is any one of ${plainList(opts.map(o => code(short(o, 30))))}.`.replace(/ and ([^,]*)\.$/, ' or $1.'); }
        else if (/^(TypeOK|TypeInvariant|Inv\w*|Safe\w*|\w*Invariant|\w*OK)$/.test(name) || /\[\]/.test(text)) { kind = 'test'; title = `Check: ${name}`; headline = `${code(name)} is a condition that should always be true` + (conj ? `: ${plainList(conj.map(c => code(short(c, 40))), 4)}.` : `: ${code(short(text, 70))}.`); }
        else if (/^\{.*\}$|^<<.*>>$|^\d+$|^"/.test(flat(text))) { kind = 'settings'; title = `Value: ${name}`; headline = `${code(name)} is ${code(short(flat(text), 70))}.`; }
        else headline = `${code(name)} means ${code(short(flat(text), 70))}.`;
        if (note) facts2.push('The comment above it says: ' + note);
        sections.push({ kind, title, headline, facts: facts2, warnings: [], steps: steps.slice(0, 16), more: steps.length > 16, start: line(n), end: endLine(n), name });
        continue;
      }
      if (/theorem|assumption/.test(n.type)) { settings = null; sections.push({ kind: 'test', title: 'Theorem', headline: `A claim to be proved or checked: ${code(short(flat(n.text).replace(/^(THEOREM|ASSUME|ASSUMPTION)\s*/, ''), 70))}.`, facts: [/\[\]/.test(n.text) ? '`[]` means "always": at every step.' : ''].filter(Boolean), warnings: [], steps: [], more: false, start: line(n), end: endLine(n), name: null }); }
    }
    for (const s of sections) if (s.names) { s.headline = `Names ${plural(s.names.length, 'thing')} the specification uses: ${plainList(s.names.map(code))}.`; delete s.names; }
    const name = textOf(field(mod, 'name'));
    const about = namesIn(mod, /^(block_comment|comment)$/)[0];
    const res = finish('tlaplus', path, source, sections, { packages: [], libs: [], imports: [] }, { ok: !rootNode.hasError(), error: rootNode.hasError() ? 'Some of this file could not be read as TLA+.' : '' });
    res.overview = `${path || 'This'} is a TLA+ specification` + (name ? ` called ${code(name)}` : '') + `: a precise description of a system${vars.length ? ` whose state is ${plainList(vars.map(code))}` : ''}, which a model checker (TLC) can test.` + (about ? ' ' + short(flat(about.text.replace(/\(\*|\*\)/g, ' ')), 160) : '');
    return res;
  }

  function analyzeRdl(path, source) {
    const rootNode = parseSafe('systemrdl', source);
    const lines = source.split('\n');
    const sections = [];
    const access = (s) => ({ r: 'read-only', w: 'write-only', rw: 'read and write', wr: 'read and write', rw1: 'read and write once', w1: 'write once', na: 'no access' }[s] || s);
    const fieldWords = (txt) => {
      const nm = (txt.match(/\}\s*(\w+)\s*(\[[^\]]+\])?/) || [])[1];
      const bits = (txt.match(/\}\s*\w+\s*\[([^\]]+)\]/) || [])[1];
      const sw = (txt.match(/\bsw\s*=\s*(\w+)/) || [])[1], hw = (txt.match(/\bhw\s*=\s*(\w+)/) || [])[1];
      const reset = (txt.match(/\]\s*=\s*([^;]+);/) || [])[1];
      const desc = (txt.match(/\bdesc\s*=\s*"([^"]*)"/) || [])[1];
      const onwrite = (txt.match(/\bonwrite\s*=\s*(\w+)/) || [])[1];
      const bitText = bits ? (/:/.test(bits) ? (bits.split(':')[0].trim() === bits.split(':')[1].trim() ? `bit ${bits.split(':')[0].trim()}` : `bits ${bits.replace(/\s/g, '').replace(':', '–')}`) : `${bits} bits`) : '';
      return `${code(nm || 'field')}${bitText ? ` (${bitText})` : ''}: ${sw ? `software can ${access(sw).replace(/^read-only$/, 'only read it').replace(/^write-only$/, 'only write it').replace(/^read and write$/, 'read and write it')}` : ''}${hw ? `${sw ? ', ' : ''}hardware ${access(hw)}` : ''}${onwrite === 'woclr' ? '; writing 1 clears it' : onwrite ? `; on write: ${onwrite}` : ''}${reset != null ? `; starts at ${reset.trim()}` : ''}${desc ? `. ${desc}` : '.'}`;
    };
    for (const d of named(rootNode)) {
      if (isComment(d)) continue;
      const txt = d.text;
      let m;
      if ((m = txt.match(/^\s*property\s+(\w+)\s*\{([^}]*)\}/))) { sections.push({ kind: 'settings', title: `Property: ${m[1]}`, headline: `Defines a new property, ${code(m[1])}, that ${(m[2].match(/component\s*=\s*(\w+)/) || [])[1] ? (m[2].match(/component\s*=\s*(\w+)/)[1]) + 's' : 'parts'} can be given` + ((m[2].match(/type\s*=\s*(\w+)/) || [])[1] === 'boolean' ? ' (yes or no).' : '.'), facts: [], warnings: [], steps: [], more: false, start: line(d), end: endLine(d), name: m[1] }); continue; }
      if ((m = txt.match(/^\s*(addrmap|regfile|reg|field|mem|signal|enum)\s+(\w+)\s*\{/))) {
        const kindW = m[1], name = m[2];
        const title = (txt.match(/\bname\s*=\s*"([^"]*)"/) || [])[1];
        const desc = (txt.match(/^\s*\w+\s+\w+\s*\{[^{}]*?\bdesc\s*=\s*"([^"]*)"/) || [])[1];
        const facts2 = [];
        if (desc) facts2.push(desc);
        if (kindW === 'reg') {
          const fieldsT = txt.match(/field\s*\{[^}]*\}\s*\w+\s*(\[[^\]]+\])?\s*(=\s*[^;]+)?;/g) || [];
          for (const f of fieldsT) facts2.push(fieldWords(f));
          sections.push({ kind: 'type', title: `Register: ${name}`, headline: `${code(name)}${title ? ` ("${title}")` : ''} is a register with ${plural(fieldsT.length, 'field')}: ${plainList(fieldsT.map(f => code((f.match(/\}\s*(\w+)/) || [])[1])), 8)}.`, facts: facts2, warnings: [], steps: [], more: false, start: line(d), end: endLine(d), name });
        } else if (kindW === 'addrmap' || kindW === 'regfile') {
          const insts = [...txt.matchAll(/^\s*(\w+)\s+(\w+)\s*(\[[^\]]+\])?\s*@\s*(0x[0-9a-fA-F]+|\d+)\s*;/gm)];
          for (const i of insts) facts2.push(`${code(i[2])} (a ${code(i[1])}) at ${code(i[4])}.`);
          const width = (txt.match(/regwidth\s*=\s*(\d+)/) || [])[1];
          if (width) facts2.push(`Registers are ${width} bits wide unless they say otherwise.`);
          sections.push({ kind: 'class', title: `${kindW === 'addrmap' ? 'Address map' : 'Register file'}: ${name}`, headline: `${code(name)}${title ? ` ("${title}")` : ''} ${kindW === 'addrmap' ? 'is an address map: where each register sits in memory' : 'groups registers together'}` + (insts.length ? `, with ${plural(insts.length, 'register')} from ${code(insts[0][4])} to ${code(insts[insts.length - 1][4])}.` : '.'), facts: facts2, warnings: [], steps: [], more: false, start: line(d), end: endLine(d), name });
        } else sections.push({ kind: 'type', title: `${cap(kindW)}: ${name}`, headline: `${code(name)} is a ${kindW}${title ? ` ("${title}")` : ''}.`, facts: facts2, warnings: [], steps: [], more: false, start: line(d), end: endLine(d), name });
        continue;
      }
      sections.push({ kind: 'steps', title: short(header(d), 40), headline: `${code(short(header(d), 60))}.`, facts: [], warnings: [], steps: [], more: false, start: line(d), end: endLine(d), name: null });
    }
    const regs = sections.filter(s => s.title.startsWith('Register:')).length;
    const res = finish('systemrdl', path, source, sections, { packages: [], libs: [], imports: [] }, { ok: !rootNode.hasError(), error: rootNode.hasError() ? 'Some of this file could not be read as SystemRDL.' : '' });
    res.overview = `${path || 'This'} describes hardware registers (SystemRDL): ${plural(regs, 'register')}` + (sections.some(s => /^Address map/.test(s.title)) ? ' and where they sit in memory.' : '.');
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Reading without a grammar: Dart, Elm and CodeQL, and any language   */
  /* whose grammar hasn't been loaded                                    */
  /* ------------------------------------------------------------------ */

  /* Blank out comments and the insides of strings (newlines kept), so brackets can be counted. */
  function maskCode(src, lang) {
    const lineC = { elm: '--', lua: '--', sql: '--', tlaplus: '\\*', elisp: ';', ruby: '#', python: '#', bash: '#', elixir: '#', yaml: '#', toml: '#', ocaml: null }[lang];
    const lc = lineC === undefined ? '//' : lineC;
    const bc = { elm: ['{-', '-}'], ocaml: ['(*', '*)'], tlaplus: ['(*', '*)'], lua: ['--[[', ']]'], ruby: ['=begin', '=end'], python: null, bash: null, elixir: null, elisp: null }[lang];
    const block = bc === undefined ? ['/*', '*/'] : bc;
    const triple = /^(dart|python|kotlin|scala|swift|elixir|elm|groovy)$/.test(lang);
    const quotes = lang === 'elisp' || lang === 'elm' || lang === 'ocaml' || lang === 'rust' ? '"' : lang === 'js' || lang === 'ts' || lang === 'go' ? '"\'`' : '"\'';
    let out = '';
    const blank = (s) => s.replace(/[^\n]/g, ' ');
    let i = 0;
    while (i < src.length) {
      if (block && src.startsWith(block[0], i)) { const e = src.indexOf(block[1], i + block[0].length); const stop = e < 0 ? src.length : e + block[1].length; out += blank(src.slice(i, stop)); i = stop; continue; }
      if (lc && src.startsWith(lc, i)) { const e = src.indexOf('\n', i); const stop = e < 0 ? src.length : e; out += blank(src.slice(i, stop)); i = stop; continue; }
      if (triple && (src.startsWith('"""', i) || src.startsWith("'''", i))) { const q = src.slice(i, i + 3); const e = src.indexOf(q, i + 3); const stop = e < 0 ? src.length : e + 3; out += q + blank(src.slice(i + 3, stop - 3)) + q; i = stop; continue; }
      const c = src[i];
      if (quotes.includes(c)) {
        let j = i + 1;
        while (j < src.length && src[j] !== c && !(src[j] === '\n' && c !== '`')) { if (src[j] === '\\') j++; j++; }
        out += c + blank(src.slice(i + 1, j)) + (src[j] === c ? c : '');
        i = src[j] === c ? j + 1 : j;
        continue;
      }
      out += c; i++;
    }
    return out;
  }

  const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'else', 'do', 'try', 'new', 'throw', 'when', 'match', 'case', 'sizeof', 'typeof', 'await', 'yield', 'super', 'this', 'assert', 'print', 'foreach', 'using', 'lock', 'fixed', 'unless', 'until', 'elif', 'elsif', 'exists', 'forall', 'select', 'from', 'where', 'not', 'and', 'or', 'in', 'instanceof', 'func', 'fn', 'fun', 'function', 'def']);
  // lexical settings: def patterns are tried at the start of a line, at the nesting level being read
  const LEX = {
    dart: {
      mode: 'braces', comment: /^\s*(\/\/|\/\*|\*)/,
      defs: [
        { re: /^\s*import\s+['"]([^'"]+)['"]/, k: 'import' }, { re: /^\s*(export|part)\s+['"]([^'"]+)['"]/, k: 'import', g: 2 }, { re: /^\s*library\b/, k: 'package' },
        { re: /^\s*(?:(?:abstract|sealed|base|final|interface)\s+)*(?:mixin\s+)?class\s+(\w+)(?:<[^>{]*>)?(?:\s+extends\s+([\w<>, ?]+?))?(?:\s+with\s+([\w<>, ]+?))?(?:\s+implements\s+([\w<>, ]+?))?\s*\{/, k: 'class', word: 'class', bases: 2, follows: 4 },
        { re: /^\s*mixin\s+(\w+)/, k: 'class', word: 'class', title: 'mixin' }, { re: /^\s*enum\s+(\w+)/, k: 'type', word: 'enum' }, { re: /^\s*extension\s+(\w+)?\s*(?:<[^>]*>)?\s*on\s+([\w<>]+)/, k: 'class', word: 'extension', name: 2 },
        { re: /^\s*typedef\s+(\w+)/, k: 'type', word: 'alias' },
        { re: /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:static|external|late|const|final|covariant)\s+)*(?:const|final|var|late)\s+(?:[\w<>?,. ]+\s+)?(\w+)\s*(=|;)/, k: 'const' },
        { re: /^\s*(?:(?:static|late|covariant)\s+)*(?!return\b)([A-Z][\w<>?,. ]*|int|double|num|bool|String|void|dynamic)\s+(\w+)\s*(=[^=>]|;)/, k: 'var', g: 2 },
        { re: /^\s*(?:(?:static|external|factory|const)\s+)*(?:([\w<>?,\[\]. ]+?)\s+)?((?:get|set)\s+\w+|operator\s*\S+|[\w$]+(?:\.\w+)?)\s*(?:<[^>()]*>)?\s*(\(([^)]*(?:\)[^){]*)?)?\))?\s*(async\*?|sync\*)?\s*(\{|=>)/, k: 'fn', name: 2, ret: 1, params: 4 },
        { re: /^\s*(?:const\s+)?(\w+)(?:\.\w+)?\s*\(([\s\S]*?)\)\s*(?::[^{;]*)?[;{]/, k: 'fn', ctor: true, params: 2 },
      ],
      loops: /\b(for|while|do)\b/g, decisions: /\bif\b|\bswitch\b|\?\s*[^.?:]+:/g, awaits: /\bawait\b|\basync\b/, throws: /\bthrow\s+(\w+)/g, catches: /\bcatch\b|\bon\s+\w+\s+catch\b/,
      print: /\b(print|debugPrint)\(/,
    },
    ql: {
      mode: 'braces', comment: /^\s*(\/\/|\/\*|\*)/,
      defs: [
        { re: /^\s*import\s+([\w.:]+)/, k: 'import' },
        { re: /^\s*(?:(?:private|abstract|final|deprecated)\s+)*class\s+(\w+)\s+extends\s+([\w:, ]+?)\s*\{/, k: 'class', word: 'class', bases: 2 },
        { re: /^\s*(?:(?:private|cached|pragma\[[^\]]*\]|bindingset\[[^\]]*\]|override|deprecated)\s+)*predicate\s+(\w+)\s*\(([^)]*)\)/, k: 'fn', word: 'predicate', params: 2 },
        { re: /^\s*(?:(?:private|cached|override|deprecated)\s+)*([\w:]+)\s+(\w+)\s*\(([^)]*)\)\s*\{/, k: 'fn', name: 2, ret: 1, params: 3 },
        { re: /^\s*(\w+)\s*\(\s*\)\s*\{/, k: 'fn', ctor: true },
        { re: /^\s*module\s+(\w+)/, k: 'class', word: 'module' },
        { re: /^\s*from\b/, k: 'query' },
      ],
      loops: /\b(forall|forex)\b/g, decisions: /\b(if|exists|or|not)\b/g,
    },
    elm: {
      mode: 'layout', comment: /^\s*(--|\{-)/,
      defs: [
        { re: /^module\s+([\w.]+)\s+exposing\s*\((.*)\)/, k: 'package' }, { re: /^port\s+module\s+([\w.]+)/, k: 'package' },
        { re: /^import\s+([\w.]+)/, k: 'import' },
        { re: /^type\s+alias\s+(\w+)/, k: 'type', word: 'record' }, { re: /^type\s+(\w+)/, k: 'type', word: 'variant' },
        { re: /^port\s+(\w+)\s*:/, k: 'proto' },
        { re: /^(\w+)\s*:\s*(.+)$/, k: 'sig' },
        { re: /^(\w+)((?:\s+[\w_()]+)*)\s*=\s*(.*)$/, k: 'fn' },
      ],
      loops: /\bList\.(map|foldl|foldr|filter|indexedMap)\b/g, decisions: /\bif\b|\bcase\b/g,
    },
  };
  LEX.lua = {
    mode: 'end', comment: /^\s*--/,
    defs: [
      { re: /^\s*local\s+\w+\s*=\s*require\s*\(?\s*["']([^"']+)["']/, k: 'import' },
      { re: /^\s*require\s*\(?\s*["']([^"']+)["']/, k: 'import' },
      { re: /^\s*local\s+function\s+(\w+)\s*\(([^)]*)\)/, k: 'fn', params: 2, local: true },
      { re: /^\s*function\s+([\w.:]+)\s*\(([^)]*)\)/, k: 'fn', params: 2 },
      { re: /^\s*local\s+(\w+)\s*=\s*function\s*\(([^)]*)\)/, k: 'fn', params: 2, local: true },
      { re: /^\s*([\w.]+)\s*=\s*function\s*\(([^)]*)\)/, k: 'fn', params: 2 },
      { re: /^\s*[\w.]+\.__index\s*=/, k: 'skip' },
      { re: /^\s*local\s+([A-Z_][A-Z0-9_]*)\s*=\s*[-\d"'{]/, k: 'const' },
      { re: /^\s*local\s+(\w+)\s*=\s*(\{\s*\}|[-\d"']|true|false|nil)/, k: 'var' },
      { re: /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*[-\d"'{]/, k: 'const' },
    ],
    loops: /\b(for|while|repeat)\b/g, decisions: /\bif\b|\belseif\b/g, catches: /\bpcall\(|\bxpcall\(/, throws: /\berror\(\s*["']([^"']{1,40})/g,
    print: /\b(print|io\.write)\(/,
  };
  // a rough outline for languages whose grammar is missing (it isn't loaded, or failed to load)
  const LEX_FALLBACK = {
    braces: [
      { re: /^\s*(?:#include|import|using|use|package|require)\b\s*(.*?);?\s*$/, k: 'import' },
      { re: /^\s*(?:(?:public|private|protected|internal|abstract|final|sealed|open|data|static|export|default|pub(?:\([\w ]+\))?|partial)\s+)*(class|struct|interface|enum|trait|protocol|object|contract|impl|record|union|extension|namespace|library)\s+([A-Za-z_][\w.]*)/, k: 'class', word: 1, name: 2 },
      { re: /^\s*type\s+([A-Za-z_]\w*)\s+(struct|interface)\b/, k: 'class', word: 2, name: 1 },
      { re: /^\s*(?:(?:pub(?:\([\w ]+\))?|export|async|static|private|public|override|suspend|inline|unsafe|extern)\s+)*(?:fn|func|fun|function|def)\s+(?:\([^)]*\)\s*)?([A-Za-z_][\w.]*)\s*(?:<[^>]*>|\[[^\]]*\])?\s*\(([^)]*)\)/, k: 'fn', params: 2 },
      { re: /^\s*(?:[\w<>\[\]?*&:,.@'$ ]+?\s+)?\*?&?([A-Za-z_]\w*)\s*(?:<[^>()]*>)?\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)[^;{=]*?(\{|=>|=\s*\S)[^;]*$/, k: 'fn', params: 2 },
    ],
    end: [
      { re: /^\s*(?:require|require_relative|import|alias|use)\s+['"]?([\w./:-]+)/, k: 'import' },
      { re: /^\s*(class|module|defmodule)\s+([\w:.]+)/, k: 'class', word: 1, name: 2 },
      { re: /^\s*(?:local\s+)?(?:def|defp|function)\s+(?:self\.)?([\w.:?!]+)\s*\(?([^)]*)\)?/, k: 'fn', params: 2 },
    ],
    indent: [
      { re: /^\s*(?:from\s+\S+\s+)?import\s+(.+)$/, k: 'import' },
      { re: /^\s*class\s+(\w+)/, k: 'class', word: 'class' },
      { re: /^\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/, k: 'fn', params: 2 },
    ],
    layout: [
      { re: /^(?:open|import)\s+([\w.]+)/, k: 'import' },
      { re: /^(?:type|module)\s+(\w+)/, k: 'type', word: 'alias' },
      { re: /^let\s+(?:rec\s+)?(\w+)((?:\s+\w+)*)\s*=/, k: 'fn', params: 2 },
      { re: /^(\w+)(\([^)]*\))?\s*==/, k: 'fn' },
    ],
    parens: [
      { re: /^\(require\s+'([\w-]+)/, k: 'import' },
      { re: /^\((?:defun|defmacro|cl-defun)\s+([\w-]+)\s+\(([^)]*)\)/, k: 'fn', params: 2 },
      { re: /^\((?:defvar|defcustom|defconst)\s+([\w-]+)/, k: 'var' },
    ],
  };
  const FALLBACK_MODE = { ruby: 'end', lua: 'end', elixir: 'end', python: 'indent', ocaml: 'layout', rescript: 'braces', tlaplus: 'layout', elisp: 'parens', bash: 'braces' };

  function analyzeLexical(lang, path, source, why) {
    const L = LEX[lang] || { mode: FALLBACK_MODE[lang] || 'braces', defs: LEX_FALLBACK[FALLBACK_MODE[lang] || 'braces'], comment: /^\s*(\/\/|\/\*|\*|#|--|;)/, loops: /\b(for|while|loop|repeat|until|each)\b/g, decisions: /\b(if|switch|match|case|when|unless|elif|elsif)\b/g };
    const lines = source.split('\n');
    const masked = maskCode(source, lang).split('\n');
    const open = L.mode === 'parens' ? '(' : '{', shut = L.mode === 'parens' ? ')' : '}';
    // nesting depth at the start of each line
    const depth = [];
    let dd = 0;
    for (const m of masked) { depth.push(dd); for (const ch of m) { if (ch === open) dd++; else if (ch === shut) dd = Math.max(0, dd - 1); } }
    const indentOf = (i) => (lines[i].match(/^\s*/)[0].replace(/\t/g, '    ').length);
    const blankOrComment = (i) => !masked[i].trim();
    // where a definition starting on line i ends (0-based, inclusive)
    function extent(i, base, k) {
      if (L.mode === 'braces' || L.mode === 'parens') {
        let d = 0, seen = false;
        for (let j = i; j < lines.length; j++) {
          const m = masked[j];
          for (let c = 0; c < m.length; c++) {
            const ch = m[c];
            if (!seen && (ch === ';' || (L.mode !== 'parens' && /=>/.test(m.slice(c, c + 2)) && !m.slice(c).includes(open))) && d === 0) { if (ch === ';' || k !== 'class') { let e = j; while (e < lines.length && !/;\s*$/.test(masked[e]) && e < j + 40 && !(e > j && depth[e + 1] === undefined)) { if (/;\s*$/.test(masked[e])) break; e++; } return Math.min(e, lines.length - 1); } }
            if (ch === open) { d++; seen = true; }
            else if (ch === shut) { d--; if (seen && d <= 0) return j; }
          }
          if (!seen && j > i + 8) return i;
        }
        return lines.length - 1;
      }
      if (L.mode === 'layout') {
        let e = i;
        for (let j = i + 1; j < lines.length; j++) { if (blankOrComment(j)) continue; if (indentOf(j) <= base && !/^\s*[)\]}|,]/.test(lines[j])) break; e = j; }
        return e;
      }
      // indent / end: until the next line at the same or lower indentation that isn't blank (and, for 'end' languages, include the closing `end`)
      let e = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (blankOrComment(j)) continue;
        if (indentOf(j) <= base) { if (L.mode === 'end' && /^\s*end\b/.test(masked[j])) e = j; break; }
        e = j;
      }
      return e;
    }
    function scan(from, to, level, base) {
      const items = [];
      for (let i = from; i <= to; i++) {
        if (blankOrComment(i)) continue;
        if ((L.mode === 'braces' || L.mode === 'parens') && depth[i] !== level) continue;
        if ((L.mode === 'layout' || L.mode === 'indent' || L.mode === 'end') && indentOf(i) !== base) continue;
        const text = lines[i];
        let hit = null;
        for (const def of L.defs) {
          const m = text.match(def.re);
          if (!m) continue;
          const name = def.k === 'query' ? 'query' : m[def.name || def.g || 1];
          if (def.k === 'fn' && (!name || KEYWORDS.has(name) || /^\d/.test(name))) continue;
          if (def.ctor && !(level > 0 && items.owner && items.owner === name) && !(scan.owner && scan.owner === name)) continue;
          hit = { def, m, name };
          break;
        }
        if (!hit) { items.push({ k: 'steps', start: i, end: i }); continue; }
        let end = /^(import|package|sig|proto)$/.test(hit.def.k) ? i : extent(i, L.mode === 'braces' || L.mode === 'parens' ? level : base, hit.def.k);
        if (hit.def.k === 'query') end = to;
        if (/^(const|var)$/.test(hit.def.k) && L.mode === 'braces') { let e = i; while (e < to && !/;\s*$/.test(masked[e])) e++; end = e; }
        items.push({ k: hit.def.k, def: hit.def, m: hit.m, name: hit.name, start: i, end });
        i = Math.max(i, end);
      }
      return items;
    }
    const sections = [];
    const ctx = { packages: [], libs: [], imports: [] };
    const localNames = new Set();
    const allTop = scan(0, lines.length - 1, 0, 0);
    // local tools (for "Runs other tools")
    const collectNames = (items, ownerName) => { for (const it of items) { if (it.k === 'fn') localNames.add(String(it.name).replace(/^(get|set)\s+/, '')); if (it.k === 'class') { scan.owner = it.name; it.members = scan(it.start + 1, it.end - (L.mode === 'braces' ? 1 : 0), depth[it.start] + 1, indentOf(it.start) + 2); scan.owner = null; it.members.forEach(mm => { if (mm.k === 'fn' && !mm.def.ctor) localNames.add(String(mm.name).replace(/^(get|set)\s+/, '')); }); } } };
    collectNames(allTop);
    // Elm keeps a type signature on the line above each definition
    const sigs = {};
    if (L.mode === 'layout') for (const it of allTop) if (it.k === 'sig') sigs[it.name] = flat(it.m[2]);
    const bodyText = (it) => masked.slice(it.start, it.end + 1).join('\n');
    const startOf = (i) => { let s = i; while (s > 0 && L.comment.test(lines[s - 1]) && lines[s - 1].trim()) s--; return s; };
    const noteOf = (i) => commentAbove(lines, i, { commentLine: L.comment.source ? new RegExp(L.comment.source.replace(/^\^\\s\*/, '^')) : L.comment, commentStrip: /^(\/\/\/?|\/\*\*?|\*\/|\*|--|\{-\|?|;+|#+)\s?/ });
    function lexFacts(it, name) {
      const body = bodyText(it);
      const facts2 = [];
      const loops = count(body, L.loops || /\b(for|while)\b/g), decisions = count(body, L.decisions || /\bif\b/g);
      const calls = [...localNames].filter(n => n !== name && new RegExp(`(^|[^\\w.])${n.replace(/[$]/g, '\\$')}\\s*\\(`).test(body.split('\n').slice(1).join('\n') || ''));
      if (lang === 'elm') calls.push(...[...localNames].filter(n => n !== name && !calls.includes(n) && new RegExp(`(^|[^\\w.])${n}\\b`).test(body.split('\n').slice(1).join('\n'))));
      if (calls.length) facts2.push('Runs other tools: ' + plainList(calls.map(code), 6) + '.');
      if (new RegExp(`(^|[^\\w.])${String(name).replace(/[$]/g, '\\$')}\\s*[( ]`).test(body.split('\n').slice(1).join('\n'))) facts2.push('It calls itself (recursion).');
      if (loops || decisions) facts2.push('Contains ' + [loops ? plural(loops, 'loop') : '', decisions ? plural(decisions, 'decision') : ''].filter(Boolean).join(' and ') + '.');
      if (L.awaits && L.awaits.test(body.split('{')[0] + body)) { if (/\basync\b/.test(lines[it.start])) facts2.push('It is `async`: it can wait (for the network or a file, say) without holding everything else up.'); }
      const thr = L.throws ? [...new Set([...body.matchAll(L.throws)].map(x => x[1]))] : [];
      if (thr.length) facts2.push(`It can stop with an error: ${plainList(thr.map(code))}.`);
      if (L.catches && L.catches.test(body)) facts2.push('Handles errors instead of stopping.');
      if (L.print && L.print.test(body)) facts2.push('Along the way it shows text.');
      return facts2;
    }
    // a statement may run over several lines: join lines until the brackets balance
    function statements(from, to) {
      const out = [];
      let cur = null, depthB = 0;
      for (let j = from; j <= to; j++) {
        const mt = masked[j] || '';
        if (!mt.trim()) continue;
        if (!cur) cur = { text: lines[j].trim(), indent: lines[j].match(/^\s*/)[0].length, line: j };
        else cur.text += ' ' + lines[j].trim();
        for (const ch of mt) { if ('([{'.includes(ch)) depthB++; else if (')]}'.includes(ch)) depthB--; }
        if (depthB <= 0 || /\{\s*$/.test(mt)) { out.push(cur); cur = null; depthB = 0; }
      }
      if (cur) out.push(cur);
      return out;
    }
    const balancedCond = (t, kw) => {
      const i = t.indexOf('(', t.indexOf(kw));
      if (i < 0) return null;
      let dep = 0;
      for (let k = i; k < t.length; k++) { if (t[k] === '(') dep++; else if (t[k] === ')') { dep--; if (!dep) return [t.slice(i + 1, k), t.slice(k + 1).trim().replace(/^\{|\{$/g, '').trim()]; } }
      return null;
    };
    function lexSteps(it) {
      const out = [];
      const from = it.start + 1, to = it.end - (L.mode === 'braces' || (L.mode === 'end' && /^\s*end\b/.test(lines[it.end] || '')) ? 1 : 0);
      if (lang === 'elm') return elmSteps(from, to);
      const st = statements(from, to);
      const base = Math.min(...st.map(s => s.indent).concat([99]));
      for (const s of st) {
        if (out.length > 16) break;
        const t = s.text.replace(/;$/, '');
        if (/^[}\])]+[,;)]*$/.test(t) || /^(end|done|fi|esac)$/.test(t)) continue;
        const pad = '    '.repeat(Math.max(0, Math.round((s.indent - base) / 2)));
        let m;
        if (lang === 'lua') {
          const w = (x) => x.replace(/\s*~=\s*/g, ' is not ').replace(/\s*==\s*/g, ' is ').replace(/\s*>=\s*/g, ' is at least ').replace(/\s*<=\s*/g, ' is at most ').replace(/#([\w.]+)/g, 'the number of items in $1').replace(/\s*\.\.\s*/g, ' joined to ');
          if ((m = t.match(/^for\s+(.+?)\s+in\s+(.+?)\s+do$/))) { out.push(pad + `for each ${m[1]} in ${short(m[2], 50)}`); continue; }
          if ((m = t.match(/^for\s+(\w+)\s*=\s*([^,]+),\s*([^,]+?)(?:,\s*(.+?))?\s+do$/))) { out.push(pad + `count ${m[1]} from ${m[2].trim()} to ${m[3].trim()}` + (m[4] ? ` in steps of ${m[4].trim()}` : '')); continue; }
          if ((m = t.match(/^while\s+(.+?)\s+do$/))) { out.push(pad + `while ${short(w(m[1]), 60)}`); continue; }
          if ((m = t.match(/^(else)?if\s+(.+?)\s+then$/))) { out.push(pad + (m[1] ? 'otherwise, if ' : 'if ') + short(w(m[2]), 60)); continue; }
          if (t === 'repeat') { out.push(pad + 'repeat'); continue; }
          if ((m = t.match(/^until\s+(.+)$/))) { out.push(pad + `until ${short(w(m[1]), 60)}`); continue; }
          if ((m = t.match(/^local\s+([\w, ]+?)\s*=\s*(.+)$/))) { out.push(pad + `set ${m[1]} to ${short(w(m[2]), 60)}`); continue; }
          if ((m = t.match(/^return\s+(.+)$/))) { out.push(pad + `give back ${short(w(m[1]).replace(/\btrue\b/g, 'yes').replace(/\bfalse\b/g, 'no').replace(/\bnil\b/g, 'nothing'), 60)}`); continue; }
          if ((m = t.match(/^([\w.[\]]+)\s*=\s*(?!=)(.+)$/))) { out.push(pad + `set ${m[1]} to ${short(w(m[2]), 60)}`); continue; }
          if ((m = t.match(/^([\w.:]+)\s*\((.*)\)$/))) { out.push(pad + (/^(print|io\.write)$/.test(m[1]) ? 'show ' + short(w(m[2]), 60) : /^error$/.test(m[1]) ? 'fail with ' + short(m[2], 60) : `run ${m[1]}` + (m[2] ? ' with ' + short(m[2], 50) : ''))); continue; }
        }
        if (lang === 'ql') {
          if ((m = t.match(/^(not\s+)?exists\s*\(\s*([^|]+)\|\s*(.*)$/))) out.push(pad + `${m[1] ? 'there is no' : 'there is a'} ${m[2].trim()} where ${short(m[3].replace(/\s*(and|or)$/, ''), 60)}`);
          else if (/^[()]$/.test(t)) continue;
          else out.push(pad + (/^or\b/.test(t) ? '' : 'require ') + short(t.replace(/\s+(and|or)$/, ''), 70) + (/\bor$/.test(t) ? ', or' : ''));
          continue;
        }
        const ifc = /^(?:\}\s*)?(else\s+)?if\s*\(/.test(t) && balancedCond(t, 'if');
        if (ifc) {
          const tail = ifc[1].replace(/;$/, '').trim();
          const said = !tail || tail === '{' ? '' : /^return$/.test(tail) ? 'stop here' : /^return\s/.test(tail) ? 'give back ' + tail.slice(7) : tail;
          out.push(pad + (/^(\}\s*)?else\s+if/.test(t) ? 'otherwise, if ' : 'if ') + short(ifc[0], 60) + (said ? ': ' + short(said, 40) : ''));
        }
        else if ((m = t.match(/^(?:\}\s*)?(else\s+)?if\s+(.+?)\s*(\{|then)?$/))) out.push(pad + (m[1] ? 'otherwise, if ' : 'if ') + short(m[2], 60));
        else if (/^(\}\s*)?else\s*\{?$/.test(t)) out.push(pad + 'otherwise');
        else if ((m = t.match(/^for\s*\((?:final\s+|var\s+)?(\w+)\s+in\s+(.+?)\)\s*\{?$/))) out.push(pad + `for each ${m[1]} in ${short(m[2], 50)}`);
        else if ((m = t.match(/^(for|while)\s*\((.+)\)\s*\{?$/))) out.push(pad + (m[1] === 'while' ? 'while ' : 'repeat: ') + short(m[2], 60));
        else if ((m = t.match(/^return\b\s*(.*)$/))) out.push(pad + (m[1] ? 'give back ' + short(m[1], 60) : 'stop here'));
        else if ((m = t.match(/^throw\s+(.+)$/))) out.push(pad + 'fail with ' + short(m[1], 60));
        else if ((m = t.match(/^case\s+(.+?)\s+of$/))) out.push(pad + 'check ' + short(m[1], 60));
        else if ((m = t.match(/^(?:final|var|const|let|late)\s+(?:[\w<>?]+\s+)?(\w+)\s*=\s*(.+)$/))) out.push(pad + `set ${m[1]} to ${short(m[2], 60)}`);
        else if ((m = t.match(/^([\w.[\]]+)\s*([-+*/]?=)\s*(?!=)(.+)$/))) out.push(pad + (m[2] === '+=' ? `increase ${m[1]} by ${short(m[3], 50)}` : m[2] === '-=' ? `decrease ${m[1]} by ${short(m[3], 50)}` : `set ${m[1]} to ${short(m[3], 60)}`));
        else if ((m = t.match(/^([\w.]+)(\+\+|--)$/))) out.push(pad + `${m[2] === '++' ? 'increase' : 'decrease'} ${m[1]} by 1`);
        else if ((m = t.match(/^(await\s+)?([\w.]+)\((.*)\)$/))) out.push(pad + ((/^(print|debugPrint)$/.test(m[2]) ? 'show ' + short(m[3], 60) : `run ${m[2]}` + (m[3] ? ' with ' + short(m[3], 50) : ''))) + (m[1] ? ' (and wait for it)' : ''));
        else if ((m = t.match(/^(\S.*?)\s*->$/))) out.push(pad + `when ${short(m[1], 50)}`);
        else out.push(pad + `${lang}: ` + short(t, 70));
      }
      return { steps: out.slice(0, 16), more: out.length > 16 };
    }
    // Elm: a definition is one expression; say its case arms, or what it gives back
    function elmSteps(from, to) {
      const out = [];
      const body = [];
      for (let j = from; j <= to; j++) if ((masked[j] || '').trim()) body.push({ text: lines[j].trim(), indent: lines[j].match(/^\s*/)[0].length });
      const caseAt = body.findIndex(b => /^case\s+.+\s+of$/.test(b.text));
      if (caseAt >= 0) {
        out.push('check ' + body[caseAt].text.replace(/^case\s+|\s+of$/g, ''));
        const armIndent = body[caseAt + 1] ? body[caseAt + 1].indent : 0;
        for (let k = caseAt + 1; k < body.length; k++) {
          if (body[k].indent !== armIndent || !/->$/.test(body[k].text)) continue;
          const rest = [];
          for (let q = k + 1; q < body.length && body[q].indent > armIndent; q++) rest.push(body[q].text);
          out.push(`    when ${body[k].text.replace(/\s*->$/, '')}: ` + short(rest.join(' ').replace(/^\{\s*(\w+)\s*\|\s*(.*)\}$/, 'a copy of $1 with $2'), 60));
        }
      } else if (body.length) out.push('give back ' + short(body.map(b => b.text).join(' ').replace(/^\{\s*(\w+)\s*\|\s*(.*)\}$/, 'a copy of $1 with $2'), 70));
      return { steps: out.slice(0, 16), more: out.length > 16 };
    }
    function fnLex(it, owner) {
      let name = String(it.name).replace(/^(get|set)\s+/, '');
      const def = it.def;
      // Lua: function Inventory.new / Inventory:add belong to the table Inventory
      let method = false;
      if (lang === 'lua' && /[.:]\w+$/.test(name) && !owner) { const m = name.match(/^(.*)([.:])(\w+)$/); owner = { name: m[1] }; method = m[2] === ':'; name = m[3]; }
      const params = def.params && it.m[def.params] != null ? it.m[def.params].split(/,(?![^<({\[]*[>)}\]])/).map(s => flat(s).replace(/^\{|\}$/g, '')).filter(Boolean) : lang === 'elm' && it.m[2] ? it.m[2].trim().split(/\s+/).filter(Boolean) : [];
      let ret = def.ret && it.m[def.ret] ? flat(it.m[def.ret]).replace(/^(static|external|factory|const|final|override|@override)\s+/, '') : '';
      if (ret && /^(static|external|factory|const|final)$/.test(ret)) ret = '';
      const sig = sigs[name];
      const start = startOf(it.start), end = it.end;
      const facts2 = [];
      const note = noteOf(it.start);
      let kind = 'tool', title = `${owner ? 'Tool' : 'Tool'}: ${owner ? owner.name + '.' : ''}${name}`, headline;
      const isCtor = def.ctor || (owner && name === owner.name);
      const gives = ret && !VOID.test(ret) ? ` and gives back ${A(ret)} ${code(short(ret, 40))}` : '';
      const pl = params.length ? 'takes ' + plainList(params.map(p => code(short(p, 40)))) : 'takes no inputs';
      if (lang === 'elm' && sig) {
        const parts = sig.split(/\s*->\s*(?![^(]*\))/);
        const out = parts.pop();
        headline = name === 'main' ? null : `${code(name)} is a tool that ${parts.length ? 'takes ' + plainList(parts.map(p => code(p))) : 'takes no inputs'} and gives back ${A(out)} ${code(out)}.`;
        if (!parts.length && name !== 'main') { headline = `${code(name)} is a value of type ${code(out)}.`; kind = 'settings'; title = `Value: ${name}`; }
      }
      if (name === 'main' && !owner) { kind = 'start'; title = 'Starting point: main'; headline = lang === 'elm' ? 'Starts the app' + (/Browser\.(sandbox|element|document|application)/.test(bodyText(it)) ? `: \`Browser.${bodyText(it).match(/Browser\.(\w+)/)[1]}\` connects \`init\`, \`update\` and \`view\`.` : '.') : 'Runs first when the program starts.'; }
      else if (isCtor) { title = `Making ${A(owner ? owner.name : name)} ${owner ? owner.name : name}`; headline = `Runs when a new ${code(owner ? owner.name : name)} is made` + (params.length ? `, and takes ${plainList(params.map(p => code(short(p, 40))))}.` : '.'); }
      else if (def.word === 'predicate') { title = `Predicate: ${name}`; headline = `${code(name)} is a predicate: a test that holds for some values` + (params.length ? ` of ${plainList(params.map(p => code(p)))}.` : '.'); }
      else if (!headline) headline = `${code(name)} is ${owner ? `one of ${code(owner.name)}'s tools. It` : 'a reusable tool that'} ${pl}${gives}.`;
      if (note) facts2.push('The comment above it says: ' + short(note, 300));
      facts2.push(...lexFacts(it, name));
      const body = bodyText(it);
      if (lang === 'dart') {
        if (/@override/.test(lines[it.start - 1] || '') || /@override/.test(lines[it.start])) facts2.push('It replaces a tool from the class it builds on (`@override`).');
        if (name === 'build' && /BuildContext/.test(lines[it.start])) {
          const widgets = [...new Set((body.match(/\b([A-Z]\w+)(?=\s*\(|\.\w+\()/g) || []).filter(w => !/^(Theme|Colors|Icons|Duration|BuildContext|State|Future|EdgeInsets|TextStyle|MediaQuery|Navigator)$/.test(w)))];
          kind = 'tool'; headline = `${code('build')} describes what ${code(owner ? owner.name : 'this widget')} shows. Flutter runs it again whenever the widget needs redrawing.`;
          if (widgets.length) facts2.push(`It builds the screen from ${plainList(widgets.map(code), 10)}.`);
        }
        if (/\bsetState\(/.test(body)) facts2.push('It changes values with `setState`, which tells Flutter to redraw the widget.');
        if (/\bFuture<|\basync\b/.test(lines[it.start]) && !facts2.some(f => /async/.test(f))) facts2.push('It is `async`: it can wait (for the network or a file, say) without freezing the app.');
        if (/=>/.test(lines[it.start]) && !/\{\s*$/.test(lines[it.start])) facts2.push('It is written as a single expression (`=>`).');
        if (/\brequired\s+this\.\w+/.test(body) && isCtor) facts2.push(`${plainList((body.match(/required\s+this\.(\w+)/g) || []).map(x => code(x.replace(/required\s+this\./, ''))))} must be given when one is made (\`required\`).`);
        if (/\bconst\b/.test(lines[it.start]) && isCtor) facts2.push('It can be made once, when the app is built (`const`), which saves work when redrawing.');
      }
      if (lang === 'elm') {
        if (name === 'update') facts2.unshift('This is where the app changes: given a message (`Msg`) and the current `Model`, it works out the new `Model`.');
        if (name === 'view') facts2.unshift('It draws the page from the `Model`; Elm redraws it whenever the model changes.');
        if (name === 'init') facts2.unshift('The model the app starts with.');
        if (/\{\s*\w+\s*\|/.test(body)) facts2.push('It makes a copy of the model with some values changed (`{ model | … }`); Elm never changes values in place.');
        if (/\bCmd\.|\bCmd\s+Msg\b/.test(body + (sig || ''))) facts2.push('It can ask Elm to do something outside the app (a `Cmd`).');
        if (/\bcase\b[\s\S]*\bof\b/.test(body)) { const branches = (lines.slice(it.start, it.end + 1).join('\n').match(/^\s{8}(\w+)(?:\s+\w+)*\s*->/gm) || []).map(x => x.trim().replace(/\s*->$/, '')); if (branches.length) facts2.push(`It handles each case: ${plainList(branches.map(code), 8)}.`); }
      }
      if (lang === 'lua') {
        const bodyRaw = lines.slice(it.start, it.end + 1).join('\n');
        if (method) facts2.push(`It is called with \`:\` (as in \`${owner.name.toLowerCase()}:${name}(…)\`), so it gets the table it belongs to as \`self\`.`);
        if (def.local) facts2.push('It is `local`: only this file can use it.');
        if (/\breturn\s+[^\n,]+,\s*\S/.test(body)) facts2.push('It can give back more than one value at once (for example a result and an error message).');
        if (/\bsetmetatable\(/.test(body)) facts2.push(`It makes a new table that shares ${owner ? code(owner.name) + '\'s' : 'its class\'s'} tools (\`setmetatable\`): this is how Lua does objects.`);
        if (/\bassert\(/.test(body)) facts2.push('It stops with an error if something it needs fails (`assert`).');
        if (/\bi?pairs\(/.test(body)) facts2.push('It goes through a table with `' + (/\bipairs\(/.test(body) ? 'ipairs` (in order, by position)' : 'pairs` (every key, in no set order)') + '.');
        const locals = new Set(params.map(p => p.trim()).concat(['self', '_']));
        for (const m of bodyRaw.matchAll(/\blocal\s+([\w, ]+)/g)) for (const v of m[1].split(',')) locals.add(v.trim());
        for (const m of bodyRaw.matchAll(/\bfor\s+([\w, ]+?)\s+(in|=)/g)) for (const v of m[1].split(',')) locals.add(v.trim());
        const globals = [];
        masked.slice(it.start + 1, it.end + 1).forEach(l => { const m = l.match(/^\s*(\w+)\s*=[^=]/); if (m && !locals.has(m[1])) add(globals, m[1]); });
        if (globals.length) it.globals = globals;
      }
      if (lang === 'ql' && def.ctor) { title = `Conditions: ${name}`; headline = `What a value must be like to count as ${A(name)} ${code(name)} (the characteristic predicate).`; }
      const warnings = notesIn(lines, start + 1, end + 1);
      if (it.globals) warnings.push(`${plainList(it.globals.map(code))} ${it.globals.length > 1 ? 'aren\'t' : 'isn\'t'} declared \`local\`, so ${it.globals.length > 1 ? 'they are globals' : 'it is a global'} that any file can see and change. Add \`local\` if that isn't meant.`);
      if (end - start > 80) warnings.push(`This is ${end - start + 1} lines long. It may be doing several jobs that could be split up.`);
      const st = lexSteps(it);
      return { kind, title, headline, facts: facts2, warnings, steps: st.steps, more: st.more, start: start + 1, end: end + 1, name, owner: owner ? owner.name : undefined };
    }
    function classLex(it, owner) {
      const def = it.def, name = it.name;
      const word = typeof def.word === 'number' ? it.m[def.word] : def.word || 'class';
      const members = it.members || [];
      const fns = members.filter(m => m.k === 'fn');
      const fieldsL = members.filter(m => m.k === 'var' || m.k === 'const').map(m => m.name);
      const bases = def.bases && it.m[def.bases] ? it.m[def.bases].split(/,(?![^<]*>)/).map(flat) : [];
      const follows = def.follows && it.m[def.follows] ? it.m[def.follows].split(/,(?![^<]*>)/).map(flat) : [];
      const isType = def.k === 'type';
      const facts2 = [];
      let w = word;
      if (lang === 'dart' && bases.some(b => /^(StatelessWidget|StatefulWidget)$/.test(b))) w = 'widget';
      let headline = (isType ? (TYPE_WORDS[w] || TYPE_WORDS.struct) : (CLASS_WORDS[w] || CLASS_WORDS.class))(name, {});
      if (lang === 'ql' && w === 'class') headline = `${code(name)} is a class: the values of ${plainList(bases.map(code))} that also meet the conditions in it.`;
      const note = noteOf(it.start);
      if (note) facts2.push('The comment above it says: ' + short(note, 300));
      if (bases.length) facts2.push(`It builds on ${plainList(bases.map(code))}.`);
      if (follows.length) facts2.push(`It follows ${plainList(follows.map(code))}.`);
      if (lang === 'dart') {
        if (bases.includes('StatelessWidget')) facts2.push('It is a `StatelessWidget`: it has no changing values of its own and draws itself from what it is given.');
        if (bases.includes('StatefulWidget')) facts2.push('It is a `StatefulWidget`: its changing values live in a separate `State` class (made by `createState`).');
        const st = bases.find(b => /^State<\w+>$/.test(b));
        if (st) { headline = `${code(name)} holds the changing values of ${code(st.slice(6, -1))}, and redraws it when they change.`; }
      }
      if (lang === 'elm' && word === 'record') { const recs = (bodyText(it).match(/[{,]\s*(\w+)\s*:\s*([^,}\n]+)/g) || []).map(x => flat(x.replace(/^[{,]\s*/, ''))); if (recs.length) facts2.push(`Each one keeps: ${plainList(recs.map(code), 10)}.`); headline = `${code(name)} is a record type: a fixed set of named values.`; }
      if (lang === 'elm' && word === 'variant') { const vs = lines.slice(it.start, it.end + 1).join('\n').replace(/^type\s+\w+[^=]*=/, '').split(/\n?\s*\|\s*/).map(flat).filter(Boolean); if (vs.length) facts2.push(`It can be ${plainList(vs.map(v => code(v)), 10).replace(/ and ([^,]*)$/, ' or $1')}.`); headline = `${code(name)} is a type whose values come in several named shapes (a custom type).`; if (name === 'Msg') facts2.push('These are the messages the app reacts to: each one is something that can happen, such as a click.'); }
      if (lang === 'dart' && w === 'enum') { const vs = bodyText(it).replace(/^[^{]*\{/, '').replace(/\}[\s\S]*$/, '').split(/[,;]/).map(s => s.trim()).filter(s => /^\w+$/.test(s)); if (vs.length) facts2.push(`It can be ${plainList(vs.map(code)).replace(/ and ([^,]*)$/, ' or $1')}.`); }
      if (fieldsL.length) facts2.push(`Each one keeps: ${plainList(fieldsL.map(code), 10)}.`);
      if (fns.length) facts2.push(`It can: ${plainList([...new Set(fns.filter(f => !f.def.ctor && f.name !== name).map(f => code(String(f.name).replace(/^(get|set)\s+/, ''))))], 10)}.`);
      const start = startOf(it.start), end = it.end;
      const first = members.find(m => m.k === 'fn' || m.k === 'class');
      const kind = isType ? 'type' : 'class';
      const title = `${cap(def.title || w)}: ${name}`;
      const split = first && end - start > 20 && fns.length >= 2;
      const out = [{ kind, title, headline, facts: facts2, warnings: notesIn(lines, start + 1, split ? startOf(first.start) : end + 1), steps: [], more: false, start: start + 1, end: split ? Math.max(start + 1, startOf(first.start)) : end + 1, name, owner: owner ? owner.name : undefined }];
      if (split) for (const m of members) { if (m.start < first.start) continue; if (m.k === 'fn') out.push(fnLex(m, { name })); else if (m.k === 'class' || m.k === 'type') out.push(...classLex(m, { name })); }
      return out;
    }
    // build the sections in order, grouping imports, settings and loose lines
    let group = null;
    const flush = () => {
      if (!group) return;
      const g = group; group = null;
      const s = g.items[0].start, e = g.items[g.items.length - 1].end;
      if (g.k === 'imports') {
        const srcs = g.items.filter(x => x.k === 'import').map(x => x.name);
        const pkgs = g.items.filter(x => x.k === 'package').map(x => x.name);
        for (const src of srcs) { ctx.imports.push({ source: src, line: s + 1 }); if (!/^\.|^[\w/]+\.dart$/.test(src) || /^package:/.test(src)) add(ctx.libs, lang === 'dart' ? src.replace(/^package:([\w]+).*$/, '$1').replace(/^dart:/, 'dart:') : src); }
        if (pkgs.length) add(ctx.packages, pkgs[0]);
        sections.push({ kind: 'imports', title: srcs.length ? 'Toolkits used' : 'Module', headline: srcs.length ? `Brings in ${plural(srcs.length, 'toolkit or file', 'toolkits or files')}.` : `Names this module: ${plainList(pkgs.map(code))}.`, facts: (pkgs.length && srcs.length ? [`This module is ${code(pkgs[0])}` + (lang === 'elm' && g.items[0].m[2] ? `; other modules can use ${plainList(g.items[0].m[2].split(',').map(x => code(x.trim())), 8)}.` : '.')] : []).concat(srcs.map(x => code(x) + (lang === 'dart' && /^package:flutter\//.test(x) ? ' (Flutter, for building app screens)' : lang === 'dart' && /^dart:/.test(x) ? ' (Dart\'s own library)' : lang === 'ql' && /^(python|java|cpp|javascript|csharp|go|ruby|swift)$/.test(x) ? ` (CodeQL's library for ${x === 'cpp' ? 'C/C++' : cap(x)})` : ''))), warnings: [], steps: [], more: false, start: startOf(s) + 1, end: e + 1, name: null });
      } else if (g.k === 'settings') {
        const names = g.items.map(x => x.name).filter(Boolean);
        sections.push({ kind: 'settings', title: 'Settings', headline: `Sets ${plural(names.length, g.items.every(x => x.k === 'const') ? 'fixed value' : 'value')}: ${plainList(names.map(code), 8)}.`, facts: [], warnings: notesIn(lines, s + 1, e + 1), steps: [], more: false, start: startOf(s) + 1, end: e + 1, name: null });
      } else {
        const text = lines.slice(s, e + 1).filter(l => l.trim());
        if (!text.length) return;
        const st = LEX[lang] && lang !== 'elm' ? lexSteps({ start: s - 1, end: e + (L.mode === 'braces' ? 1 : 0) }) : { steps: text.slice(0, 16).map(l => `${lang}: ` + short(l.trim(), 70)), more: text.length > 16 };
        sections.push({ kind: 'steps', title: LEX[lang] ? 'Main steps' : 'Other code', headline: LEX[lang] ? `${plural(text.length, 'line')} that run from top to bottom when the file runs.` : `${plural(text.length, 'line')} outside any definition.`, facts: [], warnings: notesIn(lines, s + 1, e + 1), steps: st.steps, more: st.more, start: s + 1, end: e + 1, name: null });
      }
    };
    const addTo = (k, it) => { if (!group || group.k !== k) { flush(); group = { k, items: [] }; } group.items.push(it); };
    for (const it of allTop) {
      if (it.k === 'import' || it.k === 'package') addTo('imports', it);
      else if (it.k === 'const' || it.k === 'var' || it.k === 'proto') addTo('settings', it);
      else if (it.k === 'sig' || it.k === 'skip') continue;
      else if (it.k === 'steps') { if (group && group.k === 'imports' && L.mode === 'layout') continue; addTo('steps', it); }
      else if (it.k === 'query') {
        flush();
        const t = lines.slice(it.start, it.end + 1).join('\n');
        const from = (t.match(/\bfrom\s+([\s\S]*?)\bwhere\b/) || [])[1], sel = (t.match(/\bselect\s+([\s\S]*)$/) || [])[1];
        const vars = from ? from.split(',').map(x => flat(x)) : [];
        const conds = (t.match(/\bwhere\s+([\s\S]*?)\bselect\b/) || [])[1];
        const msg = sel && (sel.match(/"([^"]*)"/) || [])[1];
        sections.push({ kind: 'start', title: 'The query', headline: `Looks for ${plainList(vars.map(v => code(v.split(/\s+/).pop())))} (${plainList(vars.map(v => code(v)))}) that meet the conditions, and reports each one found` + (msg ? ` with the message "${msg}".` : '.'), facts: conds ? [`The conditions: ${plainList(conds.split(/\s+and\s+/).map(c => code(short(c, 60))), 6)}.`] : [], warnings: [], steps: [], more: false, start: startOf(it.start) + 1, end: it.end + 1, name: 'query' });
      }
      else { flush(); sections.push(...(it.k === 'fn' ? [fnLex(it, null)] : classLex(it, null))); }
    }
    flush();
    // QL metadata and Dart/Elm notes at the top
    if (lang === 'ql') {
      const meta = {}; for (const m of source.slice(0, 2000).matchAll(/@(name|description|kind|problem\.severity|id|precision|tags)\s+([^\n]*(?:\n\s*\*\s{3,}[^@\n][^\n]*)*)/g)) meta[m[1]] = flat(m[2].replace(/\n\s*\*\s*/g, ' '));
      if (Object.keys(meta).length) { const end = source.split('*/')[0].split('\n').length; sections.unshift({ kind: 'about', title: 'About this query', headline: meta.name ? `The query is called "${meta.name}".` : 'Information about the query.', facts: [meta.description && 'It finds: ' + meta.description, meta.kind && `It reports ${meta.kind === 'path-problem' ? 'problems with the path the data took' : 'problems'} (\`@kind ${meta.kind}\`).`, meta['problem.severity'] && `How serious: ${meta['problem.severity']}.`, meta.id && `Its id is ${code(meta.id)}.`].filter(Boolean), warnings: [], steps: [], more: false, start: 1, end, name: null }); ctx.about = meta.name; }
    }
    sections.sort((a, b) => a.start - b.start);
    // keep sections from overlapping where a guess went wrong
    for (let i = 1; i < sections.length; i++) if (sections[i].start <= sections[i - 1].end && sections[i].owner === undefined && sections[i - 1].owner === undefined) sections[i - 1].end = Math.max(sections[i - 1].start, sections[i].start - 1);
    if (lang === 'ql') ctx.what = sections.some(s => s.name === 'query') ? 'a CodeQL query' : 'CodeQL library code';
    if (lang === 'lua') { const m = source.match(/^local (\w+) = \{\}\s*\n\s*\1\.__index = \1/m); if (m) ctx.extraOverview = `${code(m[1])} works like a class: a table of tools that new tables share (through \`__index\`).`; }
    const res = finish(lang, path, source, sections, ctx, { ok: true });
    if (why) res.overview += ' ' + why;
    if (lang === 'elm' && sections.some(s => s.name === 'update') && sections.some(s => s.name === 'view')) res.overview = res.overview.replace(/\.( It uses|$)/, '. It follows the Elm Architecture: a `Model`, an `update` that changes it, and a `view` that draws it.$1');
    if (lang === 'dart' && /package:flutter\//.test(source)) res.overview = res.overview.replace(/ is (an? )?Dart( \(Flutter\))? (program|code)/, ' is a Flutter app').replace(/^(\S+) is Dart code/, '$1 is Flutter code');
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* The public API                                                      */
  /* ------------------------------------------------------------------ */

  /* The languages with their own readers, through IntuiWebReader (only used if analyze() is asked for them). */
  function viaWebReader(lang, path, source) {
    const W = WR();
    const p = path || ({ js: 'code.js', ts: 'code.ts', tsx: 'code.tsx', cpp: 'code.cpp', arduino: 'sketch.ino', html: 'page.html', css: 'styles.css' }[lang]);
    let a;
    if (lang === 'js' || lang === 'ts' || lang === 'tsx') a = W.analyzeJs(p, source, lang, { path: p, xnames: {}, uses: [], fetches: [], htmlTargets: () => null, routeFor: () => null, hasServer: false, fileOf: () => null });
    else if (lang === 'cpp' || lang === 'arduino') {
      const fns = new Set(); for (const m of source.matchAll(/^[\w:<>*&\s]+?\b(\w+)\s*\([^;{]*\)\s*(?:const\s*)?\{/gm)) fns.add(m[1]);
      a = W.analyzeCpp(p, source, { fileOf: () => null, localFns: fns });
    } else if (lang === 'html') a = W.analyzeHtml(p, source, { fileOf: () => null, scriptsFor: () => [], stylesFor: () => [] });
    else a = W.analyzeCss(p, source, { htmlMatches: () => [], hasHtml: false, scriptMentions: () => false });
    const out = { ok: a.ok, error: a.error || '', overview: path ? a.overview : a.overview.replace(p, 'This code'), sections: a.sections, lines: a.lines, imports: a.imports || (a.includes || []).map(i => ({ source: i.name })) || [], libs: a.libs || [], lang, reader: 'web' };
    return out;
  }

  /* Which reader the app should use for a language: 'python' (python_reader.py), 'web' (IntuiWebReader) or 'code' (this one). */
  const readerFor = (lang) => OWN_READER[lang] || 'code';
  /* The grammar keys to load with IntuiWebReader.loadLangs before analyze() (none for languages read without one). */
  const needs = (lang) => grammarKeys(lang);
  async function load(lang) {
    const w = WR();
    if (!w || !w.ready || !w.ready()) return false;
    let ok = true;
    for (const k of needs(lang)) { try { await w.loadLangs([k]); } catch (_) { ok = false; } }
    return ok && needs(lang).every(k => w.hasLang(k));
  }
  /* How deeply each language is read. */
  function languages() {
    return (LANGS() ? LANGS().LANGUAGES : []).map(l => ({
      id: l.id, name: l.name, family: l.family,
      reader: readerFor(l.id),
      sentences: SENTENCES.has(l.id),
      grammar: !!l.grammar && !UNUSABLE[l.id],
      // outline: sections, summaries, facts and steps from a full parse; basic: the same from a lighter reading
      depth: SENTENCES.has(l.id) ? 'sentences' : ['dart', 'elm', 'ql', 'lua', 'text', 'vue', 'erb', 'elisp', 'ocaml', 'rescript', 'tlaplus', 'systemrdl'].includes(l.id) ? 'basic' : 'outline',
      readWithout: UNUSABLE[l.id] || null,
    }));
  }

  function empty(lang, path) {
    return { ok: true, error: '', overview: `${path || 'This file'} is empty.`, sections: [], lines: 1, imports: [], libs: [], lang, reader: 'code' };
  }

  /* analyze(lang, path, source) -> { ok, error, overview, sections, lines, imports, libs } (sections as in analyzeCpp). */
  function analyze(lang, path, source) {
    source = String(source == null ? '' : source).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    path = path || '';
    lang = lang || detect(path, source).lang;
    try {
      if (!source.trim()) return empty(lang, path);
      const W = WR();
      if (OWN_READER[lang] === 'web' && W && W.hasLang && W.hasLang(lang === 'arduino' ? 'cpp' : lang)) return viaWebReader(lang, path, source);
      if (lang === 'sql') return analyzeSql(path, source);
      if (lang === 'markdown') return analyzeMarkdown(path, source);
      if (lang === 'csv') return analyzeCsv(path, source);
      if (lang === 'text' || !(LANGS() && LANGS().byId(lang))) return analyzeText(path, source);
      if (lang === 'json' || lang === 'yaml' || lang === 'toml') return analyzeData(lang, path, source);
      if (LEX[lang]) return analyzeLexical(lang, path, source, '');
      if (hasGrammar(lang)) {
        if (lang === 'vue') return analyzeVue(path, source);
        if (lang === 'erb') return analyzeErb(path, source);
        if (lang === 'tlaplus') return analyzeTla(path, source);
        if (lang === 'systemrdl') return analyzeRdl(path, source);
        if (CONFIG[lang]) return analyzeTree(lang, path, source);
      }
      if (lang === 'vue' || lang === 'erb') return analyzeText(path, source);
      return analyzeLexical(lang, path, source, `(The ${nameOf(lang)} grammar isn't loaded, so this is a rough outline.)`);
    } catch (e) {
      try {
        const r = analyzeLexical(lang, path, source, '');
        r.error = 'The reader hit a problem (' + e.message + '), so this is a rough outline.';
        return r;
      } catch (_) {
        return { ok: false, error: 'The reader hit a problem: ' + e.message, overview: '', sections: [], lines: source.split('\n').length, imports: [], libs: [], lang, reader: 'code' };
      }
    }
  }

  const api = { detect, detectAndLoad, analyze, needs, load, readerFor, languages, ready: (lang) => !needs(lang).length || needs(lang).every(k => WR() && WR().hasLang && WR().hasLang(k)), splitSql, UNUSABLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntuiCodeReader = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* IntuaCode — a project's parts, and what each one is for.
 *
 * Every file is split into parts (a function, a page section, a style rule, a block of settings, a sentence and
 * the sentences under it) and each part is given a type:
 *
 *   display    Interface & Display   what people see and use: pages, screens, layout, styles, text, buttons, lights
 *   mechanics  Backend & Mechanics   what works behind the scenes: logic, calculations, data handling, saving, timing
 *   setup      Setup & Settings      what gets things ready: imports, settings, pins, configuration, build files
 *   data       Data & Notes          data files, content and notes, kept as written
 *   tests      Tests & Checks        test files, test functions and benchmarks
 *
 * It reads code in any language and IntuaCode's sentences alike (a sentence file's exact lines, python: …, are read
 * as their code), line for line, so a part's lines are the file's own lines in Unity and in Split Mode.
 *
 *   split(lang, text, path)   -> [{ from, to, type, title, lines: [type per line, null for blank lines] }]
 *   lineTypes(parts, count)   -> [type or null] for each line of the file
 *   involves(part)            -> Set of the types its lines have (a loop that lights an LED involves display)
 *   typeOf(id)                -> { id, name, short, about }
 *   TYPES                     -> the four types, in order
 *
 * It's a reading, by the words and calls a line uses, not a proof: good enough to find the parts that put
 * things on screen, and to show the rest as the machinery behind them. No page here (no DOM).
 */
(function (root) {
  'use strict';

  const TYPES = [
    { id: 'display', name: 'Interface & Display', short: 'Interface', about: 'What people see and use: pages, screens, layout, styles, text, buttons, lights and sound.' },
    { id: 'mechanics', name: 'Backend & Mechanics', short: 'Mechanics', about: 'What works behind the scenes: logic, calculations, data handling, saving, timing and talking to other programs.' },
    { id: 'setup', name: 'Setup & Settings', short: 'Setup', about: 'What gets things ready: imports, settings, pins, configuration and build files.' },
    { id: 'data', name: 'Data & Notes', short: 'Data', about: 'Data files, content and notes, kept as written.' },
    { id: 'tests', name: 'Tests & Checks', short: 'Tests', about: 'Code that checks the rest works: test files, test functions and benchmarks.' },
  ];
  const BY_ID = Object.fromEntries(TYPES.map(t => [t.id, t]));
  const typeOf = (id) => BY_ID[id] || BY_ID.mechanics;

  // what a file is when its lines say nothing either way
  const LANG_DEFAULT = {
    html: 'display', css: 'display', tsx: 'display', vue: 'display', erb: 'display', swift: 'display', dart: 'display',
    json: 'data', csv: 'data', markdown: 'data', text: 'data', sql: 'data',
    yaml: 'setup', toml: 'setup',
  };
  const CONFIG_FILE = /(^|\/)(package(-lock)?\.json|tsconfig[\w.-]*\.json|jsconfig\.json|\.?eslintrc[\w.]*|\.?prettierrc[\w.]*|vite\.config\.\w+|webpack\.config\.\w+|babel\.config\.\w+|next\.config\.\w+|tailwind\.config\.\w+|postcss\.config\.\w+|Cargo\.toml|pyproject\.toml|setup\.(py|cfg)|requirements[\w.-]*\.txt|Pipfile|Gemfile|go\.mod|platformio\.ini|Makefile|CMakeLists\.txt|Dockerfile|docker-compose\.ya?ml|[\w.-]*\.config\.[jt]s|settings\.py|config\.\w+)$/i;
  const DOC_FILE = /(^|\/)(readme|license|licence|changelog|contributing|notes?)(\.\w+)?$/i;
  // a file of tests: in a tests folder, or named as one (test_x.py, x_test.go, x.test.js, x.spec.ts, XTests.cpp, XBenchmark.cpp)
  const TEST_FILE = /(^|\/)(tests?|specs?|__tests__|testing|benchmarks?)\/|(^|\/)test_[^/]*$|_tests?\.\w+$|\.(test|spec)\.\w+$|[A-Za-z0-9](Tests?|Spec|Benchmark)\.\w+$/;
  // a test inside any file: def test_x, TEST(…), it("…"), describe("…"), test("…"), [Test], @Test
  const TEST_PART = /^\s*(?:(?:async\s+)?def\s+test_?\w*|(?:TEST|TEST_F|TEST_CASE|SECTION|BOOST_AUTO_TEST_CASE)\s*\(|(?:it|describe|test)\s*\(\s*['"`]|\[(?:Test|Fact)\]|@Test\b|func\s+Test\w*\(|#\[test\])/;

  // an exact line in a sentence file, read as its code (C++'s "above main:" and a page's "head:" too)
  const EXACT = /^([ \t]*)(?:raw python|python|html|css|js|javascript|c\+\+|cpp|raw|above main|(?:in the )?head)\s*:\s?(.*)$/i;

  /* The words and calls that say what a line is for. Each list is tried on code and on sentences alike. */
  const SIGNS = {
    display: [
      // the web page and what's on it
      /\b(document|window)\.(querySelector|getElementById|getElementsBy\w+|createElement|body|title)\b/, /\.(innerHTML|innerText|textContent|outerHTML|classList|style|className|src|alt|placeholder|hidden|disabled)\b/,
      /\.(appendChild|append|prepend|replaceChildren|insertAdjacentHTML|setAttribute|focus|scrollIntoView)\(/, /\baddEventListener\(\s*['"](click|input|change|submit|key\w*|mouse\w*|pointer\w*|touch\w*|focus|blur)/,
      /\b(alert|confirm|prompt)\(/, /\bgetContext\(|\bctx\.\w+|\b(fillRect|strokeRect|fillText|drawImage|arc|beginPath)\(/, /\brequestAnimationFrame\(/,
      // React and components
      /<\/?[A-Za-z][\w.-]*[\s>/]/, /\bclassName=|\bonClick=|\bonChange=|\bstyle=\{/, /\breturn\s*\(\s*<|\buse(State|Ref)\b/, /\bv-(if|for|model|on|bind)\b|\b@click\b/,
      // CSS words, in code or in sentences
      /^\s*[.#]?[\w-]+(\s*[,>+~]\s*[.#]?[\w-]+)*\s*(:[\w-]+(\([^)]*\))?)?\s*\{/, /\b(color|colour|background|border|margin|padding|font|width|height|display|flex|grid|align|justify|shadow|opacity|radius|rounded|bold|italic|underline|centre|center)\b/i,
      // Python on screen
      /\b(print|input)\(/, /\b(tk|tkinter|ttk|pygame|turtle|plt|st|curses|kivy|PyQt\d?|QtWidgets)\.\w+/, /\b(Label|Button|Entry|Canvas|Frame|Toplevel|Text|Scale|Checkbutton|Radiobutton|messagebox)\(/,
      /\.(pack|grid|place|mainloop|config|configure|blit|flip|render|show|imshow|plot|bind)\(/, /\brender_template\(|\bflash\(/,
      // boards and programs: screens, lights, sound, the serial monitor, the console
      /\bSerial\d?\.(print|println|write|printf)\(/, /\b(lcd|display|oled|tft|u8g2|matrix|strip|pixels|leds)\.\w+\(/, /\b(tone|noTone)\(/, /\bdigitalWrite\(\s*\w*(led|LED|light|lamp|buzzer)\w*/,
      /\bstd::(cout|cerr)\b|\bcout\s*<<|\bprintf\(|\bputs\(|\bconsole\.(log|info|warn|error|table)\(/, /\bfmt\.Print|\bprintln!\(|\bSystem\.out\.print|\bConsole\.Write|\bprint\(/,
      // sentences
      /^\s*(show|print|say|display|ask|draw|paint|fill|write on|put on the screen)\b/i, /\b(heading|paragraph|button|picture|image|photo|link|label|text box|input box|list item|menu|page|screen|window|dialog|title bar|sprite|icon|emoji)\b/i,
      /\b(click(ed|s)?|press(ed|es)?|tap(ped)?|typed|hover(ed)?|scroll(ed)?)\b/i, /\bturn (pin \w+|the \w+ light|\w*led\w*) (on|off)\b/i, /\b(beep|sound|tone|play|music)\b/i,
      /^\s*add (a|an|the) (heading|box|button|picture|image|paragraph|link|list|input|text|row|column|card|menu|form|table)\b/i, /^\s*make (it|the \w+|everything|\w+) (look|bigger|smaller|bold|red|blue|green|centred|centered|rounded|hidden|visible)\b/i,
      /\b(style|styles|theme|layout|colour|color|font|shadow|rounded corners)\b/i,
    ],
    mechanics: [
      /\b(fetch|axios|XMLHttpRequest|WebSocket|EventSource)\b/, /\b(localStorage|sessionStorage|indexedDB)\b/, /\bJSON\.(parse|stringify)\b|\bjson\.(loads?|dumps?)\(/,
      /\bMath\.\w+|\bmath\.\w+|\b(random|randint|choice|shuffle|uniform)\(|\brandom\b/i, /\b(sort|sorted|filter|map|reduce|find|some|every|includes|indexOf|push|pop|splice|slice|append|extend|split|join|replace)\(/,
      /^\s*(for|while|do|switch|match|try|catch|except|finally|foreach)\b/, /^\s*(if|elif|else if|else)\b/, /\bgive back\b/i, /\b(async|await|Promise|then|resolve|reject)\b/,
      /\b(setTimeout|setInterval|clearInterval|millis|micros|delay|sleep|time\.time|datetime|Date\.now|new Date)\b/, /\b(open|read|write|readlines|close)\(|\b(fs|path|os|sys|shutil|pathlib|subprocess)\.\w+/,
      /\b(requests|urllib|socket|http|express|app\.(get|post|put|delete|route)|router\.\w+|@app\.route|flask|django|sqlite3|cursor|execute|query|SELECT|INSERT|UPDATE|DELETE)\b/, /\b(analogRead|digitalRead|pulseIn|attachInterrupt|Wire\.\w+|SPI\.\w+)\b/,
      /\+=|-=|\*=|\/=|\+\+|--|%/, /\b(class|struct|enum|interface|impl|trait)\s+\w+/,
      // sentences
      /^\s*(repeat|for each|while|keep|loop|if|otherwise|else|when the timer|every \d+)\b/i, /\b(increase|decrease|add \S+ to|take \S+ (away )?from|times|divided by|plus|minus|work out|calculate|count|total|average|sort|shuffle|pick a random|random)\b/i,
      /\b(save|load|store|remember|fetch|download|upload|send|receive|wait \d+|wait for|seconds|milliseconds|timer)\b/i, /^\s*(define|give back|return|stop the loop|try|check)\b/i,
    ],
    setup: [
      /^\s*(import|from \S+ import|#include|#define|#pragma|require\(|using |use |package |extern crate|@import|@use)\b/, /^\s*(const|let|var|static|final)?\s*[A-Z][A-Z0-9_]{2,}\s*(:\s*\w+\s*)?=/,
      /\b(pinMode|Serial\d?\.begin|Wire\.begin|SPI\.begin|lcd\.begin|display\.begin|strip\.begin|randomSeed|WiFi\.begin)\(/, /^\s*void\s+setup\s*\(/, /\bif\s+__name__\s*==\s*['"]__main__['"]/,
      /^\s*<(!doctype|html|head|meta|link|title|base)\b/i, /^\s*<script[^>]*\bsrc=/i, /^\s*"(name|version|scripts|dependencies|devDependencies|main|type|private|license)"\s*:/,
      /\b(config|settings|options|environment|env)\b\s*[=:]/i, /^\s*(module\.)?exports\b|^\s*export\s+(default\s+)?\{/,
      // sentences
      /^\s*when the (board|program|page|app) starts\b/i, /^\s*(page title is|page language|no page language|head\s*:|leave out the (?:viewport|character set|doctype)|no doctype|no title)/i, /^\s*(start the serial monitor|make pin \w+ an? (input|output)|use the \w+ (library|toolkit)|include |load the \w+ (library|toolkit)|bring in)\b/i,
      /^\s*set [\w ]+ to (-?\d+(\.\d+)?|"[^"]*"|'[^']*'|true|false|yes|no|LED_BUILTIN|A\d|D\d+)\s*$/i,
    ],
    data: [
      /^\s*["'][^"']*["']\s*,?\s*$/, /^\s*-?\d+(\.\d+)?\s*,?\s*$/, /^\s*[{[]\s*$/, /^\s*["'][\w -]+["']\s*:\s*("[^"]*"|-?\d+(\.\d+)?|true|false|null)\s*,?\s*$/,
    ],
  };
  const WEIGHT = { display: 1, mechanics: 1, setup: 1.4, data: 0.6 };

  const blankLine = (s) => !String(s).trim();
  const indentOf = (s) => String(s).match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
  const isComment = (s) => /^\s*(\/\/|#(?!include|define|pragma|!)|\/\*|\*|<!--|--|;|note\s*:|comment\s*:|teach\s*:)/i.test(s);

  /* What each line says it's for: scores for each type (none for blank lines and notes). */
  function scoreLine(line) {
    const s = {};
    if (blankLine(line) || isComment(line)) return s;
    // bringing in a library is setup, whatever the library is for
    if (/^\s*(import\s|from\s+\S+\s+import\b|#include\b|(const|let|var)\s+[\w${}\s,]+=\s*require\(|using\s|use\s|package\s|@import\b)/.test(line)) return { setup: 5 };
    // so is a page's head: its title, language and links
    if (/^\s*(head\s*:|page title is|page language|no page language|leave out the (?:viewport|character set|doctype)|no doctype|no title|<(head|meta|link|title|base)\b)/i.test(line)) return { setup: 5 };
    for (const [type, list] of Object.entries(SIGNS)) {
      let n = 0;
      for (const re of list) if (re.test(line)) n++;
      if (n) s[type] = n * WEIGHT[type];
    }
    return s;
  }
  const best = (s, fallback) => {
    let top = null, val = 0;
    for (const t of ['setup', 'display', 'mechanics', 'data']) if ((s[t] || 0) > val) { top = t; val = s[t]; }
    return top || fallback;
  };

  /* A line's code: an exact line in a sentence file is read as its code; braces are counted outside quotes. */
  const codeOf = (line) => { const m = String(line).match(EXACT); return m ? m[1] + m[2] : String(line); };
  function braceDelta(line) {
    const s = String(line).replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '').replace(/\/\/.*$/, '');
    let d = 0;
    for (const ch of s) { if (ch === '{' || ch === '(' || ch === '[') d++; else if (ch === '}' || ch === ')' || ch === ']') d--; }
    return d;
  }
  const BRACES = new Set(['js', 'ts', 'tsx', 'css', 'cpp', 'arduino', 'c', 'java', 'kotlin', 'swift', 'csharp', 'go', 'rust', 'dart', 'scala', 'php', 'objc', 'zig', 'solidity', 'json']);

  /* The file's lines in top-level runs: an indented or bracketed block stays with the line that opens it. */
  function blocks(lang, lines, byIndent) {
    const out = [];
    let cur = null, depth = 0, wraps = 0;   // wraps: namespaces open around the parts (their braces don't count)
    let lead = -1, leadTo = -1;             // comments at the left edge: they belong to the part under them
    let raw = null;                         // a C++ raw string open over several lines: R"meta( … )meta"
    const useBraces = BRACES.has(lang) && !byIndent;
    // a line's brackets, outside raw strings (whose quotes and brackets are only text)
    const delta = (line) => {
      let s = String(line);
      if (raw != null) { const end = s.indexOf(')' + raw + '"'); if (end < 0) return 0; s = s.slice(end + raw.length + 2); raw = null; }
      s = s.replace(/\bR"([^(\s"\\]{0,16})\(([\s\S]*?)\)\1"/g, '""');
      const open = s.match(/\bR"([^(\s"\\]{0,16})\(/);
      if (open) { raw = open[1]; s = s.slice(0, open.index); }
      return braceDelta(s);
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (blankLine(line)) { if (cur && depth > 0) cur.to = i; continue; }
      if (useBraces && depth <= 0) {
        // namespace x { … } and extern "C" { … } hold parts rather than being one: their own lines aren't parts
        if (/^\s*(?:(?:inline\s+)?namespace\b[\w\s:]*|extern\s+"C"\s*)\{\s*(?:\/\/.*)?$/.test(line)) { wraps++; cur = null; continue; }
        if (/^\s*(?:inline\s+)?namespace\b[\w\s:]*$/.test(line)) {   // its "{" on the next line
          let k = i + 1;
          while (k < lines.length && blankLine(lines[k])) k++;
          if (k < lines.length && /^\s*\{\s*(?:\/\/.*)?$/.test(lines[k])) { wraps++; cur = null; i = k; continue; }
        }
        if (wraps && /^\s*\}\s*;?\s*(?:\/\/.*)?$/.test(line)) { wraps--; cur = null; continue; }
      }
      // a line at the left edge starts a part; so does a closing bracket's line ending one (in Python, "]" or ")").
      // In braces, a part's head can run on: a "{" on its own line, a constructor's ": member (x)" list, a
      // signature over several lines (one not yet ended by ";" or "}")
      const runsOn = useBraces && cur && /^\s*[{:,)]|^\s+\S/.test(line) && !/[;}]\s*(?:\/\/.*)?$/.test(lines[cur.to]);
      const top = useBraces ? depth <= 0 && !runsOn : indentOf(line) === 0 && !/^\s*[)\]}]/.test(line);
      if (top && isComment(line) && !/^\s*(note|comment|teach)\s*:/i.test(line)) { if (lead < 0) lead = i; leadTo = i; cur = null; continue; }
      if (top || !cur) { cur = { from: lead >= 0 ? lead : i, to: i }; out.push(cur); lead = -1; }
      else cur.to = i;
      if (useBraces) depth = Math.max(0, depth + delta(line));
    }
    if (lead >= 0) out.push({ from: lead, to: leadTo });   // comments at the very end: a part of their own
    return out;
  }

  const IMPORT_LINE = /^\s*(import\s|from\s+\S+\s+import\b|#include\b|(const|let|var)\s+[\w${}\s,]+=\s*require\(|using\s|use\s|@import\b|bring in\b)/;
  /* The line a part is named by: its first line of code, past comments, a #! line and #pragma once; a return
     type on a line of its own ("void" over "Mixer::paint (…)") goes with the line after it. */
  function headLine(own) {
    const real = own.filter(l => !blankLine(l) && !isComment(l) && !/^\s*(#!|#pragma\s+once\b|\[\[[\w:]+\]\]\s*$|template\s*<[^>]*>\s*$)/.test(l));
    if (!real.length) return own.find(l => !blankLine(l)) || '';
    if (real.length > 1 && /^\s*(?:(?:static|inline|virtual|constexpr|explicit|extern|friend|unsigned|signed|const)\s+)*[\w:<>*&]+[*&\s]*$/.test(real[0])) return real[0].trim() + ' ' + real[1].trim();
    return real[0];
  }
  /* A part's name: its first line, without the code's punctuation. */
  function titleOf(line) {
    let t = String(line).trim().replace(/^(?:\[\[[^\]]*\]\]\s*)+/, '');   // [[nodiscard]] and the like
    // a signature that runs onto the next lines: void Mixer::setKernels (std::span<const float> a,
    const sig = t.match(/^(?:[\w:<>,*&\s~]+?\s+)?[*&]*((?:[A-Za-z_]\w*::)*~?[A-Za-z_]\w*)\s*\([^;)]*$/);
    if (sig && !/^(if|for|while|switch|return|else|catch|sizeof)$/.test(sig[1].split('::').pop()) && /\s|::/.test(t.slice(0, t.indexOf('(')).trim())) return sig[1] + '()';
    const fn = t.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:(?:template\s*<[^>]*>\s*)?(?:def|function|fn|func|sub|procedure|class|struct|interface|enum(?:\s+class)?|trait|impl|module|namespace))\s+([\w$.:]+)/);
    if (fn) return fn[1];
    // C++ and the like: a function or method, Class::method or Class::Class (no return type), with what's after its name
    const cfn = t.match(/^(?:[\w:<>,*&\s~]+?\s+)?[*&]*((?:[A-Za-z_]\w*::)*~?[A-Za-z_]\w*)\s*\([^;]*\)\s*(?:const\s*)?(?:noexcept\s*)?(?:override\s*)?(?:final\s*)?(?::[^{]*)?(?:\{.*)?$/);
    if (cfn && !/^(if|for|while|switch|return|else|catch|sizeof|TEST\w*|it|describe|test)$/.test(cfn[1].split('::').pop())) return cfn[1] + '()';
    const named = t.match(/^\s*(?:it|describe|test|TEST_CASE|SECTION)\s*\(\s*(['"`])(.*?)\1/);   // it("adds"), TEST_CASE("fader", "[tags]")
    if (named) return `test: ${named[2]}`;
    const gtest = t.match(/^\s*(?:TEST|TEST_F|TEST_P)\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/);   // TEST(Suite, Name)
    if (gtest) return `test: ${gtest[1]}.${gtest[2]}`;
    const arrow = t.match(/^(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>/);
    if (arrow) return arrow[1];
    // a C++ declaration on one line: inline const juce::Colour ink{0xff2a1a10}; static constexpr int maxChannels = 16;
    const decl = t.match(/^(?:(?:inline|static|constexpr|const|extern|thread_local|mutable|volatile|unsigned|signed|long|short)\s+)*(?:[A-Za-z_][\w:]*(?:<[^;=]*>)?[*&\s]+)+([A-Za-z_]\w*)\s*(?:\[[^\]]*\]\s*)*(?:\{[^;]*\}\s*;|=[^;]*;|;)\s*(?:\/\/.*)?$/);
    if (decl && !/^(return|delete|throw|goto|case|using|typedef)$/.test(t.split(/\s+/)[0])) return decl[1];
    const tag = t.match(/^<([A-Za-z][\w.-]*)([^>]*)>?/);
    if (tag) { const id = tag[2].match(/\b(?:id|class|className)=["']([^"']+)/); return `<${tag[1]}>${id ? ' ' + id[1].split(' ')[0] : ''}`; }
    t = t.replace(/\s*[{:(]\s*$/, '').replace(/\s+/g, ' ');
    return t.length > 46 ? t.slice(0, 44).replace(/\s+\S*$/, '') + '…' : t;
  }

  /* A run of one-line parts of the same type (imports, settings, a script's top-level lines) is one part. */
  function merge(parts) {
    const out = [];
    for (const p of parts) {
      const last = out[out.length - 1];
      if (last && last.single && p.single && last.type === p.type && p.from - last.to <= 2) {
        last.lines = last.lines.concat(new Array(p.from - last.to - 1).fill(null), p.lines);
        last.to = p.to; last.count++; last.imports = last.imports || p.imports;
        continue;
      }
      out.push(p);
    }
    for (const p of out) {
      if (p.count < 2) continue;
      if (p.type === 'setup') p.title = p.imports || /^\s*(import|from|#include|require|using|use|include|bring in|load the)\b/i.test(p.first) ? 'Imports' : 'Settings';
      else if (p.type === 'data') p.title = 'Values';
      else p.title += ' …';
    }
    return out;
  }

  function split(lang, text, path) {
    const raw = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const sentenceFile = SENTENCE_LANGS.has(lang);
    // a sentence file's exact lines are read as their code; one that's nearly all exact lines (imported code) is
    // split by its brackets, like code, and one of sentences by its indentation
    const lines = sentenceFile ? raw.map(codeOf) : raw;
    const byIndent = sentenceFile && !looksLikeCode(raw);
    const testFile = !!path && TEST_FILE.test(path);
    let fallback = LANG_DEFAULT[lang] || 'mechanics';
    if (path && CONFIG_FILE.test(path)) fallback = 'setup';
    else if (path && DOC_FILE.test(path)) fallback = 'data';
    // notes, data and settings files are one part each
    if (['json', 'csv', 'markdown', 'text', 'yaml', 'toml'].includes(lang) || (path && CONFIG_FILE.test(path) && lang !== 'python')) {
      const last = lines.length - 1 - [...lines].reverse().findIndex(l => l.trim());
      if (last < 0 || last >= lines.length) return [];
      const first = lines.findIndex(l => l.trim());
      return [{ from: first, to: last, type: fallback, title: lang === 'markdown' ? (lines[first].replace(/^#+\s*/, '').trim() || 'Notes') : (path || 'Data').split('/').pop(), lines: lines.map((l, i) => (l.trim() && i >= first ? fallback : null)), single: false, count: 1 }];
    }
    const parts = blocks(lang, lines, byIndent).map(b => {
      const own = lines.slice(b.from, b.to + 1);
      const scores = own.map(scoreLine);
      const total = {};
      scores.forEach((s, i) => { for (const [t, v] of Object.entries(s)) total[t] = (total[t] || 0) + v * (i === 0 ? 2 : 1); });
      // a component that returns markup (React, Vue) is what's on screen, whatever it works out on the way
      if (/^(tsx|js|ts|vue)$/.test(lang) && own.some(l => /^\s*(return\s*\(?\s*)?<[A-Za-z]/.test(l))) total.display = (total.display || 0) + 4;
      // CSS and HTML are display through and through, apart from a page's head and its links
      let type = lang === 'css' ? 'display' : best(total, fallback);
      if (lang === 'html' && type !== 'setup') type = 'display';
      if (type === 'data' && own.length < 4) type = best({ ...total, data: 0 }, fallback);
      const lineTypes = own.map((l, i) => (blankLine(l) || isComment(l) ? null : lang === 'css' ? 'display' : best(scores[i], null) || type));
      // a test file is tests through and through; elsewhere, a test function is
      if (testFile || TEST_PART.test(own[0])) { type = 'tests'; lineTypes.forEach((t, i) => { if (t) lineTypes[i] = 'tests'; }); }
      return { from: b.from, to: b.to, type, title: titleOf(headLine(own)), first: own[0], imports: own.some(l => IMPORT_LINE.test(l)), lines: lineTypes, single: b.from === b.to, count: 1 };
    });
    return merge(parts).map(({ single, count, first, imports, ...p }) => p);
  }

  const SENTENCE_LANGS = new Set(['python', 'html', 'css', 'js', 'cpp', 'arduino']);
  /* A sentence file that is nearly all exact lines (imported code) is read as code. */
  function looksLikeCode(lines) {
    const filled = lines.filter(l => l.trim());
    return filled.length > 0 && filled.filter(l => EXACT.test(l)).length / filled.length > 0.6;
  }

  function lineTypes(parts, count) {
    const out = new Array(count).fill(null);
    for (const p of parts) p.lines.forEach((t, i) => { if (p.from + i < count) out[p.from + i] = t; });
    return out;
  }
  const involves = (part) => new Set(part.lines.filter(Boolean).concat(part.type));

  root.IntuiParts = { TYPES, typeOf, split, lineTypes, involves, scoreLine };
})(typeof window !== 'undefined' ? window : globalThis);

// Do the TypeScript writer's own words mean what they say? (lang/ts_write.js: types, shapes, the parts a file
// shares, React components.) Its Mechanics words are JavaScript's, run in tests/helpers/meaning_web.mjs; these are
// the rest, checked two ways:
//   - types, by TypeScript's own checker (the typescript package, with React's types): each example's code must
//     check clean, each line it `accepts` must check clean after it, and each line it `refuses` must be an error;
//   - components, by React itself in a real browser (tests/helpers/browser.mjs): the code is compiled by
//     TypeScript, React shows the main component, and `then` and `holds` work as for JavaScript's examples.
// Examples: tests/helpers/meaning_ts_examples.mjs. Needs typescript, react and react-dom (dev packages).
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './engine.mjs';
import { inTabs, show, sitePattern } from './meaning_browser.mjs';

const need = createRequire(path.join(ROOT, 'package.json'));
/* Whether the packages are there: null, or why not. */
export function missingPackages() {
  const gone = ['typescript', 'react', 'react-dom', '@types/react'].filter(p => !existsSync(path.join(ROOT, 'node_modules', p, 'package.json')));
  return gone.length ? `needs ${gone.join(', ')} (npm install)` : null;
}
let tsLib;
const typescript = () => (tsLib ||= need('typescript'));

/* The example's sentences, as one file: its given lines as exact TypeScript, then its lines. */
export const sentencesOf = (ex) => (ex.given ? ex.given.split('\n').map(l => `${ex.tsx ? 'tsx' : 'ts'}: ${l}`) : []).concat(ex.lines.split('\n')).join('\n') + '\n';
export const tsNameOf = (ex) => ex.lines.replace(/\n\s*/g, ' / ');
const ext = (ex) => (ex.tsx ? 'tsx' : 'ts');

/* Translates an example: its main file, and the other files it brings things in from. */
export function translateTs(TS, ex) {
  const one = (text) => TS.compileTs({ id: 'x', file: 'typescript', text }, null, { lang: ext(ex) });
  const main = one(sentencesOf(ex));
  const files = { main: main.text };
  const errs = main.info.flatMap(i => i.errs);
  for (const [name, text] of Object.entries(ex.files || {})) {
    const r = one(text + '\n');
    files[name.replace(/^\.\//, '')] = r.text;
    errs.push(...r.info.flatMap(i => i.errs.map(e => `${name}: ${e}`)));
  }
  return { files, errs };
}

/* ---- Types: TypeScript's own checker ---- */

const OPTIONS = () => {
  const ts = typescript();
  return { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], types: [], skipLibCheck: true, esModuleInterop: true, allowUmdGlobalAccess: true, noUnusedLocals: false };
};

/* Checks every example's types in one program. -> Map(example -> { ok, why }) */
export function checkTypes(TS, examples) {
  const ts = typescript();
  const files = new Map(), jobs = [];
  // (the files are where no file is, under the project, so 'react' is found in its node_modules)
  const at = (k, name) => path.join(ROOT, '.meaning-ts', `ex${k}`, name).replace(/\\/g, '/');
  examples.forEach((ex, k) => {
    const made = translateTs(TS, ex);
    if (made.errs.length) { jobs.push({ ex, why: `doesn't translate: ${made.errs[0]}` }); return; }
    const e = ext(ex), base = made.files.main + '\nexport {};\n';
    for (const [name, code] of Object.entries(made.files)) if (name !== 'main') files.set(at(k, `${name}.${e === 'tsx' && /</.test(code) ? 'tsx' : 'ts'}`), code + '\nexport {};\n');
    const job = { ex, checks: [{ file: at(k, `main.${e}`), from: Infinity }] };
    files.set(job.checks[0].file, base);
    for (const [j, line] of (ex.accepts || []).entries()) { const f = at(k, `accept${j}.${e}`); files.set(f, base + line + '\n'); job.checks.push({ file: f, line, from: Infinity }); }
    for (const [j, line] of (ex.refuses || []).entries()) { const f = at(k, `refuse${j}.${e}`); files.set(f, base + line + '\n'); job.checks.push({ file: f, line, from: base.length, refuse: true }); }
    jobs.push(job);
  });
  const host = ts.createCompilerHost(OPTIONS());
  const was = { getSourceFile: host.getSourceFile, fileExists: host.fileExists, readFile: host.readFile, directoryExists: host.directoryExists };
  const dirs = new Set([...files.keys()].flatMap(f => { const out = []; for (let d = path.posix.dirname(f); d.length > ROOT.length; d = path.posix.dirname(d)) out.push(d); return out; }));
  host.directoryExists = (d) => dirs.has(d.replace(/\\/g, '/')) || (was.directoryExists ? was.directoryExists(d) : ts.sys.directoryExists(d));
  host.getSourceFile = (f, lang, ...rest) => (files.has(f) ? ts.createSourceFile(f, files.get(f), lang, true) : was.getSourceFile(f, lang, ...rest));
  host.fileExists = (f) => files.has(f) || was.fileExists(f);
  host.readFile = (f) => (files.has(f) ? files.get(f) : was.readFile(f));
  const roots = [...files.keys()].filter(f => /\/(?:main|accept\d+|refuse\d+)\.tsx?$/.test(f));
  const program = ts.createProgram(roots, OPTIONS(), host);
  const said = (d) => ts.flattenDiagnosticMessageText(d.messageText, ' ');
  const out = new Map();
  for (const job of jobs) {
    if (job.why) { out.set(job.ex, { ok: false, why: job.why }); continue; }
    let r = { ok: true };
    for (const c of job.checks) {
      const sf = program.getSourceFile(c.file);
      const ds = [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)];
      if (c.refuse) { if (!ds.some(d => d.start >= c.from)) { r = { ok: false, why: `TypeScript accepts ${c.line}, but the words say it shouldn't` }; break; } }
      else if (ds.length) { r = { ok: false, why: `${c.line ? `TypeScript refuses ${c.line}` : "the code doesn't check"}: ${said(ds[0])}` }; break; }
    }
    out.set(job.ex, r);
  }
  return out;
}

/* ---- Components: React in a real browser ---- */

const PAGE = '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>React</title></head>\n<body>\n  <div id="root"></div>\n  <script src="/react.js"></script>\n  <script src="/react-dom.js"></script>\n  <script src="/script.js"></script>\n</body>\n</html>\n';
let umd;
const reactFiles = () => (umd ||= {
  '/react.js': { type: 'text/javascript', body: readFileSync(path.join(ROOT, 'node_modules/react/umd/react.development.js'), 'utf8') },
  '/react-dom.js': { type: 'text/javascript', body: readFileSync(path.join(ROOT, 'node_modules/react-dom/umd/react-dom.development.js'), 'utf8') },
});

/* The files compiled by TypeScript, as one script: each file a module (require finds react, react-dom and the
   example's other files), then React shows the main file's main component in #root, unless the file does. */
function scriptOf(made, ex) {
  const ts = typescript();
  const mods = Object.entries(made.files).map(([name, code]) => {
    const js = ts.transpileModule(code, { fileName: `${name}.tsx`, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    return `${JSON.stringify(name)}: function (require, module, exports) {\n${js}\n}`;
  });
  return `(() => {
  const sources = {\n${mods.join(',\n')}\n};
  const made = {};
  const require = (name) => {
    if (name === 'react') return window.React;
    if (name === 'react-dom' || name === 'react-dom/client') return window.ReactDOM;
    const key = name.replace(/^\\.\\//, '').replace(/\\.(?:tsx?|jsx?)$/, '');
    if (!sources[key]) throw new Error('nothing to bring in from ' + name);
    if (!made[key]) { const module = { exports: {} }; made[key] = module; sources[key](require, module, module.exports); }
    return made[key].exports;
  };
  const main = require('main');
  ${ex.rendersItself ? '' : `const App = main.default || main[${JSON.stringify(ex.component || '')}];
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App, ${ex.props ? JSON.stringify(ex.props) : '{}'}));`}
})();`;
}

/* Runs the examples that show something (`holds` or `then`) in the browser. -> Map(example -> { ok, why }) */
export async function runComponents(TS, examples) {
  const todo = examples.filter(ex => ex.holds || ex.then);
  const results = await inTabs(todo, async (tab, k, ex) => {
    const made = translateTs(TS, ex);
    if (made.errs.length) return { ok: false, why: `doesn't translate: ${made.errs[0]}` };
    try {
      const { raised } = await show(tab, 2000 + k, { html: PAGE, css: '', js: scriptOf(made, ex), more: reactFiles() }, ex);
      if (raised) return { ok: false, why: `stopped with ${raised.name}: ${raised.message}` };
      // React's own warnings (a list without keys, a state change it can't make) count as failing
      const warned = await tab.run('page.logged.filter(l => /^Warning:/.test(l))');
      if (warned.length) return { ok: false, why: `React warned: ${warned[0].slice(0, 200)}` };
      for (const h of [].concat(ex.holds || [])) {
        let ok;
        try { ok = await tab.run(`(() => (${h}))()`); } catch (e) { return { ok: false, why: `${h}: ${e.message}` }; }
        if (!ok) return { ok: false, why: `${h} isn't true (the page: ${JSON.stringify(await tab.run('document.getElementById("root").innerHTML'))}; logged: ${JSON.stringify(await tab.run('page.logged'))})` };
      }
      return { ok: true };
    } catch (e) { return { ok: false, why: `couldn't run in the browser: ${e.message}` }; }
  });
  return new Map(todo.map((ex, k) => [ex, results[k]]));
}

/* Both checks, for every example. -> [{ ex, ok, why }] */
export async function runTsExamples(TS, examples, { browser = true } = {}) {
  const types = checkTypes(TS, examples);
  const shown = browser ? await runComponents(TS, examples) : new Map();
  return examples.map(ex => {
    const t = types.get(ex), s = shown.get(ex);
    if (!t.ok) return { ex, ...t };
    if (s && !s.ok) return { ex, ...s };
    // (a pack's sentence: the call it writes, where the library itself isn't there to run)
    if (ex.code && !ex.code.test(translateTs(TS, ex).files.main)) return { ex, ok: false, why: `writes ${translateTs(TS, ex).files.main.trim()}, not ${ex.code}` };
    return { ex, ok: true };
  });
}

/* ---- The Index: which of its entries an example says ---- */

/* A sentence is matched as a whole line; one that is part of a line (a type, "for sure", a pack's value) anywhere
   in one. A word's note in brackets ("nothing (under if / otherwise)") isn't part of what's said. */
function tsPattern(e) {
  if (e.pattern && (e.group === 'Types' || e.group === 'Packs')) {
    const whole = sitePattern(e).source;   // ^\s*…\s*$
    return new RegExp('(?:^|[\\s(,])' + whole.slice(4, -4) + '(?=$|[\\s,);])', 'i');
  }
  // ("styled as …": anything after it)
  if (e.words && /…/.test(e.words[0])) return new RegExp('(?:^|[\\s,])' + e.words[0].split('…').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+'), 'i');
  return sitePattern(e.words ? { words: [e.words[0].replace(/\s*\((?:under|in) [^)]*\)$/, ''), e.words[1]] } : e);
}

export function tsCoverage(TS, results, notRun) {
  const entries = [...TS.TEMPLATES].map(t => ({ kind: 'statement', group: t.group, label: t.pattern, pattern: t.pattern }))
    .concat([...TS.WORDS].map(w => ({ kind: 'value', label: `${w[0]} → ${w[1]}`, words: [w[0], w[1]] })));
  for (const e of entries) {
    const re = tsPattern(e);
    e.examples = results.filter(r => r.ok).filter(r => [r.ex.lines, ...Object.values(r.ex.files || {})].join('\n').split('\n').some(l => re.test(l))).map(r => tsNameOf(r.ex));
    const k = Object.keys(notRun).find(k => e.label.startsWith(k));
    e.why = k ? notRun[k] : null;
  }
  return entries;
}

/* The writer's words for types (BASIC and LIST_OF: "a number" is number) made wrong, one at a time: each gives the
   next different type. Only the examples whose code changes are checked again, by the checker alone.
   -> { tried, missed: [words (written as …)] } */
export function mutateTypeWords(TS, examples, pick = () => true) {
  const missed = [];
  let tried = 0;
  const before = examples.map(ex => JSON.stringify(translateTs(TS, ex).files));
  for (const table of [TS.BASIC, TS.LIST_OF]) {
    const keys = Object.keys(table), types = [...new Set(Object.values(table))];
    for (const k of keys) {
      if (!pick(k)) continue;
      const was = table[k], other = types[(types.indexOf(was) + 1) % types.length];
      table[k] = other;
      try {
        const changed = examples.filter((ex, i) => JSON.stringify(translateTs(TS, ex).files) !== before[i]);
        if (!changed.length) continue;
        tried++;
        if ([...checkTypes(TS, changed).values()].every(r => r.ok)) missed.push(`${table === TS.BASIC ? '' : 'a list of '}${k} (written as ${other})`);
      } finally { table[k] = was; }
    }
  }
  return { tried, missed };
}

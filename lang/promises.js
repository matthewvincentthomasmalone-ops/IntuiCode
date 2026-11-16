/* IntuaCode — INTENT.md: what you mean the project to keep doing, checked against its code.
 *
 * The project's code says what it does. INTENT.md says what you meant: a list of promises, one per bullet, in
 * plain sentences. Each one is checked against the real code (the code files as they are on disk, not the
 * sentences), every time the project changes, and it's kept, not kept, or can't be checked. Nothing here is
 * stored as "done": like a route in a broadcast router, a promise's state is worked out from what's there, each
 * time, so it can never disagree with the code. Nothing here changes code either: a promise not kept is shown,
 * and what to do about it is yours.
 *
 *   # Intent
 *   - no file mentions "service_role"
 *   - every table has row-level security
 *   - handleSave in src/App.tsx is mine
 *
 *   ## Step 2 · Page basics
 *   - there is a button called save
 *   - index.html has no problems
 *
 * A bullet (- or *) is a promise; any other line is a note. Bullets under "## Step n" belong to that step of the
 * project map, and its checks are those plus the ones IntuaCode gives every step (its sentences have no problems;
 * a hallway step's ‹blanks› are filled in).
 *
 *   isIntentPath(path)              -> true for INTENT.md at the top of the project
 *   parse(text)                     -> { items: [{ li, text, step, p, error }], steps: [{ n, name, li }] }
 *   check(text, facts)              -> [{ li, text, step, ok, why, where, mine? }]   ok: true, false, or null (can't tell)
 *   stepChecks(steps, results, facts) -> Map(n -> { checks: [...], held, total, state })   state: all, some, none, or ''
 *   outsideSteps(facts, steps)      -> [{ path, from, to, title, type }]: parts no step covers (only once a step has a place)
 *   locate(facts, path, name)       -> { path, from, to, code } in the file's code, or { error }
 *   stepRegions(text)               -> [{ n, from, to }]: where each step's sentences are in a file
 *   definitions(lang, code, path)   -> [{ name, kind, from, to }]: what the code defines, by name
 *   TEMPLATES                       -> the promises IntuaCode knows, with an example each
 *
 * facts: { files: [{ path, lang, write: sentences|code|text, text, code, errs: [lines with problems, in text] }] }
 * A place ("where") is { path, line, space: 'code' or 'text' }: a line of the code on disk, or of the file's own text.
 * No page here (no DOM): the app and the tests both use it.
 */
(function (root) {
  'use strict';

  const PARTS = root.IntuiParts;

  const isIntentPath = (path) => /^intent\.md$/i.test(String(path || ''));

  const TEMPLATES = [
    { pattern: '‹file› mentions "‹text›"', example: 'src/api.ts mentions "/api/save"', about: 'The text is in that file\'s code (or a part\'s, or a folder\'s).' },
    { pattern: '‹file› doesn\'t mention "‹text›"', example: 'src/ doesn\'t mention "console.log"', about: 'The text is nowhere in it.' },
    { pattern: 'no file mentions "‹text›"', example: 'no file mentions "service_role"', about: 'The text is in no code or data file (notes, like Markdown, aren\'t searched).' },
    { pattern: '‹file› has no problems', example: 'index.html has no problems', about: 'Its sentences have no problems listed. "nothing has problems" means every file.' },
    { pattern: 'there is a ‹kind› called ‹name›', example: 'there is a button called save', about: 'Kinds: function, component, class, part, style rule, button, heading, link, input, picture, form, list, paragraph, section, header, footer, menu, element, table, file, folder, page.' },
    { pattern: '‹name› in ‹file› is mine', example: 'handleSave in src/App.tsx is mine', about: 'You wrote it: a change made to it outside IntuaCode (by an AI, another editor, Git) is shown until you keep it or put yours back. A whole file can be yours too.' },
    { pattern: 'every table has row-level security', example: 'every table has row-level security', about: 'Every create table in the project\'s .sql files has an alter table … enable row level security (Supabase).' },
    { pattern: 'every ‹blank› is filled in', example: 'every ‹blank› is filled in', about: 'Under a step: none of its sentences has a ‹blank› left.' },
    { pattern: 'its sentences have no problems', example: 'its sentences have no problems', about: 'Under a step: none of its sentences has a problem listed.' },
  ];

  /* ---------- Reading INTENT.md ---------- */

  const STEP_HEAD = /^\s{0,3}#{1,6}\s+step\s+(\d+)\b\s*(?:[·:.\-–—]+\s*)?(.*?)\s*#*\s*$/i;
  const HEAD = /^\s{0,3}#{1,6}\s/;
  const BULLET = /^\s*[-*+]\s+(?:\[[ xX]\]\s+)?(.*\S)\s*$/;
  const tidy = (t) => t.replace(/[“”]/g, '"').replace(/[‘’]/g, '\'').replace(/\s+/g, ' ').trim().replace(/[.;]$/, '');
  const bare = (t) => String(t).trim().replace(/^`([^`]*)`$/, '$1').trim();

  function parse(text) {
    const items = [], steps = [];
    let step = null, fence = null;
    String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach((l, li) => {
      const f = l.match(/^\s*(```|~~~)/);
      if (fence) { if (f && f[1] === fence) fence = null; return; }
      if (f) { fence = f[1]; return; }
      const h = l.match(STEP_HEAD);
      if (h) { step = +h[1]; steps.push({ n: step, name: h[2] || '', li }); return; }
      if (HEAD.test(l)) { step = null; return; }
      const b = l.match(BULLET);
      if (!b) return;
      const said = tidy(b[1]);
      const p = promiseOf(said);
      items.push({ li, text: said, step, p: p.error ? null : p, error: p.error || (step == null && p.stepOnly ? `"${said}" is about a step: put it under a "## Step n" heading.` : '') });
    });
    return { items, steps };
  }

  /* One promise, as IntuaCode reads it, or { error }. */
  function promiseOf(t) {
    let m;
    if (/^every table has row[- ]level security$/i.test(t)) return { kind: 'rls' };
    if (/^(?:every|each|all) (?:‹\s*)?blanks?(?:\s*›)?(?: (?:is|are))? filled in$/i.test(t)) return { kind: 'blanks', stepOnly: true };
    if (/^(?:its|the step's|this step's) sentences have no problems$/i.test(t)) return { kind: 'stepProblems', stepOnly: true };
    if ((m = t.match(/^(?:no file|nothing|no code)(?: in the project)? (?:mentions|contains|has|uses) "(.+)"$/i))) return { kind: 'mentions', where: { all: true }, text: m[1], neg: true };
    if ((m = t.match(/^(.+?) (?:doesn't|does not|never) (?:mention|contain|use)s? "(.+)"$/i))) return { kind: 'mentions', where: whereOf(m[1]), text: m[2], neg: true };
    if ((m = t.match(/^(.+?) (?:mentions|contains|uses) "(.+)"$/i))) return { kind: 'mentions', where: whereOf(m[1]), text: m[2], neg: false };
    if (/^(?:nothing has (?:any )?problems|(?:the (?:whole )?project|everything|every file) has no problems)$/i.test(t)) return { kind: 'noProblems', where: { all: true } };
    if ((m = t.match(/^(.+?) has no problems$/i))) return { kind: 'noProblems', where: whereOf(m[1]) };
    if ((m = t.match(/^there(?: is|'s) an? ([a-z][a-z ]*?) (?:called|named) (.+)$/i))) {
      const kind = KIND_WORD[m[1].toLowerCase()];
      if (!kind) return { error: `IntuaCode doesn't know "${m[1]}" as a kind of thing. It knows: ${KNOWN_KINDS}.` };
      return { kind: 'thing', what: kind, word: m[1].toLowerCase(), name: bare(m[2]) };
    }
    if ((m = t.match(/^(.+?) exists$/i))) return { kind: 'thing', what: 'any', word: '', name: bare(m[1]) };
    if ((m = t.match(/^(.+?) (?:is|are) (?:mine|my own)$/i))) {
      const where = whereOf(m[1]);
      if (where.all || where.folder) return { error: 'A promise that something is yours names one part or one file, like "save in main.py is mine".' };
      return { kind: 'mine', where };
    }
    return { error: `Promises look like ${TEMPLATES.slice(0, 6).map(x => '`' + x.example + '`').join(', ')}, and more: the help under INTENT.md lists them all.` };
  }

  /* Which code a promise is about: the whole project, a folder, a file, or a part (a name, maybe in a file). */
  function whereOf(w) {
    w = bare(w.replace(/^the code (?:of|in) /i, ''));
    if (/^(?:the (?:whole )?project|every file|any file|a file|some file|the code|everything)$/i.test(w)) return { all: true };
    const m = w.match(/^(.+?) in (.+)$/);
    if (m) return { name: bare(m[1]), path: bare(m[2]) };
    if (/\/$/.test(w)) return { folder: w };
    if (/\/|\.\w{1,10}$/.test(w)) return { path: w };
    return { name: w };
  }

  const KIND_WORD = {
    function: 'fn', tool: 'fn', method: 'fn', handler: 'fn', hook: 'fn',
    component: 'component', class: 'class', type: 'class', interface: 'class', part: 'part',
    'style rule': 'rule', style: 'rule', rule: 'rule',
    button: 'el:button', heading: 'el:heading', link: 'el:link', input: 'el:input', 'text box': 'el:input', picture: 'el:picture', image: 'el:picture',
    form: 'el:form', list: 'el:list', 'list item': 'el:item', paragraph: 'el:paragraph', section: 'el:section', header: 'el:header', footer: 'el:footer',
    menu: 'el:nav', navigation: 'el:nav', element: 'el:any', box: 'el:any', area: 'el:any',
    table: 'table', file: 'file', folder: 'folder', page: 'page',
  };
  const KNOWN_KINDS = 'function, component, class, part, style rule, button, heading, link, input, picture, form, list, list item, paragraph, section, header, footer, menu, element, table, file, folder, page';
  const TAGS = {
    button: /^(?:button|Button)$/, heading: /^(?:h[1-6]|Heading)$/, link: /^(?:a|Link|NavLink)$/, input: /^(?:input|textarea|select|Input|Textarea)$/,
    picture: /^(?:img|picture|Image)$/, form: /^(?:form|Form)$/, list: /^(?:ul|ol)$/, item: /^li$/, paragraph: /^p$/, section: /^(?:section|Section|div|article|main)$/,
    header: /^header$/, footer: /^footer$/, nav: /^(?:nav|Nav)$/, any: /./,
  };

  /* ---------- What the code defines ---------- */

  const CONTROL = /^(?:if|for|while|switch|catch|return|else|do|try|with|elif|except|sizeof|new|delete)$/;
  const DECLS = {
    python: [[/^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)/, 'fn'], [/^(\s*)class\s+([A-Za-z_]\w*)/, 'class']],
    js: [
      [/^(\s*)(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, 'fn'],
      [/^(\s*)(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/, 'fn'],
      [/^(\s*)(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:React\.)?(?:memo|forwardRef|useCallback)\s*\(/, 'fn'],
      [/^(\s*)(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, 'class'],
      [/^(\s*)(?:export\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)/, 'class'],
      [/^(\s+)(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{]+)?\{\s*$/, 'fn'],
    ],
    cpp: [
      [/^(\s*)(?:class|struct)\s+([A-Za-z_]\w*)\b(?![^;]*;\s*$)/, 'class'],
      [/^(\s*)(?:template\s*<[^>]*>\s*)?(?:[\w:<>,*&~]+\s+)+[*&]*([A-Za-z_~]\w*(?:::[A-Za-z_~]\w*)*)\s*\([^;]*\)\s*(?:const\s*)?(?:override\s*)?\{?\s*$/, 'fn'],
    ],
    other: [
      [/^(\s*)(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:fn|func|def|function|sub|proc|fun)\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/, 'fn'],
      [/^(\s*)(?:pub\s+)?(?:public\s+|private\s+)?(?:class|struct|enum|trait|interface|object|record)\s+([A-Za-z_]\w*)/, 'class'],
    ],
  };
  const FAMILY = { python: 'python', js: 'js', ts: 'js', tsx: 'js', jsx: 'js', cpp: 'cpp', c: 'cpp', arduino: 'cpp', csharp: 'other', java: 'cpp' };
  const familyOf = (lang) => FAMILY[lang] || 'other';

  /* Where a block that starts on line `at` ends: by indentation (Python), else by its braces (strings and comments
     skipped), else the line itself. */
  function blockEnd(lines, at, fam) {
    if (fam === 'python') {
      const ind = lines[at].match(/^\s*/)[0].length;
      let end = at;
      for (let i = at + 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        if (lines[i].match(/^\s*/)[0].length <= ind) break;
        end = i;
      }
      return end;
    }
    let depth = 0, opened = false, q = null, block = false;
    for (let i = at; i < lines.length; i++) {
      const l = lines[i];
      for (let k = 0; k < l.length; k++) {
        const c = l[k];
        if (block) { if (c === '*' && l[k + 1] === '/') { block = false; k++; } continue; }
        if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; }
        if (c === '/' && l[k + 1] === '/') break;
        if (c === '/' && l[k + 1] === '*') { block = true; k++; continue; }
        if (c === '"' || c === '\'' || c === '`') { q = c; continue; }
        if (c === '{') { depth++; opened = true; } else if (c === '}') { depth--; if (opened && depth <= 0) return i; }
      }
      if (q !== '`') q = null;   // (only template literals run on to the next line)
      if (!opened && /;\s*$/.test(l)) return i;   // an arrow function without braces, ending here
      if (!opened && i > at + 1) return at;
    }
    return opened ? lines.length - 1 : at;
  }

  const defsCache = new Map();
  function definitions(lang, code, path) {
    const key = lang + '\u0001' + path + '\u0001' + code;
    if (defsCache.has(key)) return defsCache.get(key);
    const lines = String(code || '').split('\n'), out = [];
    const fam = familyOf(lang);
    if (lang === 'css') {
      lines.forEach((l, i) => {
        const m = l.match(/^\s*([^{}@\s][^{}]*?)\s*\{/);
        if (m) for (const sel of m[1].split(',').map(s => s.trim()).filter(Boolean)) out.push({ name: sel, kind: 'rule', from: i, to: blockEnd(lines, i, 'js') });
      });
    } else if (lang === 'sql') {
      lines.forEach((l, i) => { const m = l.match(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/i); if (m) out.push({ name: tableName(m[1]), kind: 'table', from: i, to: i }); });
    } else if (lang !== 'markdown' && lang !== 'text' && lang !== 'json' && lang !== 'csv' && lang !== 'yaml' && lang !== 'toml') {
      const decls = DECLS[fam];
      lines.forEach((l, i) => {
        for (const [re, kind] of decls) {
          const m = l.match(re);
          if (!m || CONTROL.test(m[2])) continue;
          const isComponent = kind === 'fn' && fam === 'js' && /^[A-Z]/.test(m[2]) && /^(?:tsx|jsx|js)$/.test(lang);
          out.push({ name: m[2], kind: isComponent ? 'component' : kind, from: i, to: blockEnd(lines, i, fam) });
          break;
        }
      });
    }
    // elements with a name (id="…"), in HTML and JSX
    if (/^(?:html|tsx|jsx|js|vue|svelte|erb)$/.test(lang)) {
      lines.forEach((l, i) => {
        const re = /<([A-Za-z][\w.-]*)\b[^>]*?\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*["']([^"']+)["']\s*\})/g;
        let m;
        while ((m = re.exec(l))) out.push({ name: m[2] || m[3] || m[4], kind: 'el', tag: m[1], from: i, to: i });
      });
    }
    if (defsCache.size > 400) defsCache.clear();
    defsCache.set(key, out);
    return out;
  }
  const tableName = (t) => t.replace(/"/g, '').replace(/^public\./i, '').toLowerCase();

  /* ---------- Checking ---------- */

  const NOTES = new Set(['markdown', 'text']);
  const searchable = (f) => !isIntentPath(f.path) && !/^openspec\//i.test(f.path) && !NOTES.has(f.lang);
  const fileAt = (facts, path) => facts.files.find(f => f.path.toLowerCase() === String(path).toLowerCase());
  const inFolder = (f, folder) => f.path.toLowerCase().startsWith(folder.toLowerCase());
  const said = (s) => '`' + s + '`';

  /* A part of the code by name (in one file, or anywhere), as its lines. */
  function locate(facts, path, name) {
    let files = facts.files.filter(f => !isIntentPath(f.path));
    if (path) {
      const f = fileAt(facts, path);
      if (!f) return { error: `There's no file called ${said(path)}.` };
      if (!name) { const code = f.code || ''; return { path: f.path, from: 0, to: Math.max(0, code.split('\n').length - 1), code }; }
      files = [f];
    }
    const found = [];
    for (const f of files) for (const d of definitions(f.lang, f.code, f.path)) if (d.name === name || (d.kind === 'rule' && d.name === '#' + name)) found.push({ f, d });
    if (!found.length) {
      for (const f of files) for (const d of definitions(f.lang, f.code, f.path)) if (d.name.toLowerCase() === name.toLowerCase()) found.push({ f, d });
    }
    if (!found.length) {
      const near = closest(name, files.flatMap(f => definitions(f.lang, f.code, f.path).map(d => d.name)));
      return { error: `There's no part called ${said(name)}${path ? ` in ${said(path)}` : ''} now.${near ? ` The closest is ${said(near)}.` : ''}` };
    }
    const where = [...new Set(found.map(x => x.f.path))];
    if (where.length > 1) return { error: `${said(name)} is in ${where.map(said).join(' and ')}: say which, like "${name} in ${where[0]}".`, ambiguous: true };
    if (found.length > 1) return { error: `${said(where[0])} has ${found.length} parts called ${said(name)} (lines ${found.map(x => x.d.from + 1).join(', ')}): name the part around them instead, or the whole file.`, ambiguous: true };
    const { f, d } = found[0];
    const code = f.code.split('\n').slice(d.from, d.to + 1).join('\n');
    return { path: f.path, from: d.from, to: d.to, code };
  }

  function closest(word, names) {
    let best = null, bestD = Infinity;
    const w = word.toLowerCase();
    for (const n of new Set(names)) {
      const d = distance(w, n.toLowerCase());
      if (d < bestD) { bestD = d; best = n; }
    }
    return best && bestD <= Math.max(1, Math.floor(word.length / 3)) ? best : null;
  }
  function distance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0]; row[0] = i;
      for (let j = 1; j <= b.length; j++) { const t = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
    }
    return row[b.length];
  }

  /* The code a promise's "where" covers: [{ f, lines: [[from, to]] or null for the whole file }], or { error }. */
  function scope(facts, where) {
    if (where.all) return { list: facts.files.filter(searchable).map(f => ({ f, range: null })) };
    if (where.folder) {
      const list = facts.files.filter(f => searchable(f) && inFolder(f, where.folder)).map(f => ({ f, range: null }));
      return list.length ? { list } : { error: `There's no folder called ${said(where.folder)}, or nothing in it.` };
    }
    if (where.path && !where.name) {
      const f = fileAt(facts, where.path);
      if (!f) {
        const asFolder = facts.files.filter(x => searchable(x) && inFolder(x, where.path + '/'));
        if (asFolder.length) return { list: asFolder.map(x => ({ f: x, range: null })) };
        return { error: `There's no file called ${said(where.path)}.` };
      }
      return { list: [{ f, range: null }] };
    }
    const at = locate(facts, where.path, where.name);
    if (at.error) return at;
    return { list: [{ f: fileAt(facts, at.path), range: [at.from, at.to] }] };
  }

  function checkMentions(facts, p) {
    const sc = scope(facts, p.where);
    if (sc.error) return { ok: false, why: sc.error };
    const hits = [];
    for (const { f, range } of sc.list) {
      const lines = String(f.code || '').split('\n');
      const from = range ? range[0] : 0, to = range ? range[1] : lines.length - 1;
      for (let i = from; i <= to && hits.length < 20; i++) if (lines[i] != null && lines[i].includes(p.text)) hits.push({ path: f.path, line: i, space: 'code' });
    }
    const what = p.where.all ? 'the project' : p.where.name ? said(p.where.name) : said(p.where.path || p.where.folder);
    if (p.neg) {
      return hits.length
        ? { ok: false, why: `${said(p.text)} is in ${placeList(hits)}.`, where: hits.slice(0, 5) }
        : { ok: true, why: `${said(p.text)} is nowhere in ${what}${p.where.all ? '\'s code and data files' : ''}.` };
    }
    return hits.length
      ? { ok: true, why: `${said(p.text)} is in ${placeList(hits)}.`, where: hits.slice(0, 5) }
      : { ok: false, why: `${said(p.text)} isn't in ${what}.` };
  }
  const placeList = (hits) => {
    const shown = hits.slice(0, 3).map(h => `${h.path} line ${h.line + 1}`);
    return shown.join(', ') + (hits.length > 3 ? ` and ${hits.length - 3} more place${hits.length - 3 > 1 ? 's' : ''}` : '');
  };

  function checkProblems(facts, p) {
    if (p.where.name) return { ok: null, why: 'Problems are listed by file: say the file, like "main.py has no problems".' };
    const sc = scope(facts, p.where);
    if (sc.error) return { ok: false, why: sc.error };
    const checked = sc.list.filter(x => x.f.write === 'sentences');
    if (!checked.length) {
      const f = sc.list[0] && sc.list[0].f;
      return { ok: null, why: f ? `IntuaCode doesn't list problems for ${said(f.path)} (it's ${f.write === 'code' ? 'code IntuaCode reads, not writes' : 'notes or data'}).` : 'There are no files there.' };
    }
    const bad = [];
    for (const { f } of checked) for (const li of f.errs || []) bad.push({ path: f.path, line: li, space: 'text' });
    return bad.length
      ? { ok: false, why: `${bad.length} line${bad.length > 1 ? 's have' : ' has'} a problem: ${placeList(bad)}.`, where: bad.slice(0, 5) }
      : { ok: true, why: `No problems in ${checked.length === 1 ? said(checked[0].f.path) : `${checked.length} files`}.` };
  }

  function checkThing(facts, p) {
    const name = p.name;
    if (p.what === 'file' || p.what === 'page' || (p.what === 'any' && /\/|\.\w{1,10}$/.test(name))) {
      const f = fileAt(facts, name) || (p.what === 'page' ? facts.files.find(x => /^(?:html|tsx|jsx)$/.test(x.lang) && x.path.split('/').pop().replace(/\.\w+$/, '').toLowerCase() === name.toLowerCase()) : null);
      return f ? { ok: true, why: `${said(f.path)} is in the project.`, where: [{ path: f.path, line: 0, space: 'text' }] } : { ok: false, why: `There's no ${p.what === 'page' ? 'page' : 'file'} called ${said(name)}.` };
    }
    if (p.what === 'folder') {
      const dir = name.replace(/\/?$/, '/');
      const f = facts.files.find(x => inFolder(x, dir));
      return f ? { ok: true, why: `${said(dir)} has ${facts.files.filter(x => inFolder(x, dir)).length} file(s).` } : { ok: false, why: `There's no folder called ${said(dir)}.` };
    }
    const all = [];
    for (const f of facts.files) if (!isIntentPath(f.path)) for (const d of definitions(f.lang, f.code, f.path)) all.push({ f, d });
    const fits = ({ d }) => {
      if (p.what === 'any' || p.what === 'part') return true;
      if (p.what.startsWith('el:')) return d.kind === 'el' && TAGS[p.what.slice(3)].test(d.tag);
      if (p.what === 'fn') return d.kind === 'fn' || d.kind === 'component';
      if (p.what === 'rule') return d.kind === 'rule';
      return d.kind === p.what;
    };
    const sameName = ({ d }) => d.name === name || (d.kind === 'rule' && (d.name === '#' + name || d.name === '.' + name)) || (d.kind === 'table' && d.name === tableName(name));
    const hit = all.find(x => fits(x) && sameName(x)) || all.find(x => fits(x) && x.d.name.toLowerCase() === name.toLowerCase());
    const word = p.word || 'part';
    if (hit) return { ok: true, why: `${said(hit.d.name)} is in ${hit.f.path}, line ${hit.d.from + 1}.`, where: [{ path: hit.f.path, line: hit.d.from, space: 'code' }] };
    const other = all.find(sameName);
    if (other) return { ok: false, why: `${said(name)} is in ${other.f.path}, but it isn't a ${word}${other.d.kind === 'el' ? ` (it's a <${other.d.tag}>)` : ''}.`, where: [{ path: other.f.path, line: other.d.from, space: 'code' }] };
    const near = closest(name, all.filter(fits).map(x => x.d.name));
    return { ok: false, why: `There's no ${word} called ${said(name)}.${near ? ` The closest is ${said(near)}.` : ''}${p.what.startsWith('el:') ? ' (An element is found by its name, id="…", in HTML and JSX.)' : ''}` };
  }

  function checkRls(facts) {
    const sql = facts.files.filter(f => f.lang === 'sql' || /\.sql$/i.test(f.path));
    const tables = [], on = new Set();
    for (const f of sql) {
      const lines = String(f.code || '').split('\n');
      lines.forEach((l, i) => {
        let m;
        if ((m = l.match(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/i))) tables.push({ name: tableName(m[1]), path: f.path, line: i });
      });
      const all = lines.join('\n');
      const re = /\balter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?([\w."]+)\s+enable\s+row\s+level\s+security/gi;
      let m;
      while ((m = re.exec(all))) on.add(tableName(m[1]));
    }
    if (!tables.length) return { ok: null, why: 'There\'s no "create table" in the project\'s .sql files, so IntuaCode can\'t check this. (Tables made in Supabase\'s own dashboard aren\'t in the code.)' };
    const missing = tables.filter(t => !on.has(t.name));
    return missing.length
      ? { ok: false, why: `${missing.map(t => said(t.name)).join(', ')} ${missing.length > 1 ? 'have' : 'has'} no row-level security: anyone with the public key can read and change ${missing.length > 1 ? 'them' : 'it'}.`, where: missing.slice(0, 5).map(t => ({ path: t.path, line: t.line, space: 'code' })) }
      : { ok: true, why: `All ${tables.length} table${tables.length > 1 ? 's have' : ' has'} row-level security turned on.` };
  }

  /* ---------- Steps ---------- */

  const STEP_NOTE = /^\s*note:\s*── Step (\d+) · /;
  function stepRegions(text) {
    const lines = String(text || '').split('\n'), out = [];
    lines.forEach((l, i) => { const m = l.match(STEP_NOTE); if (m) { if (out.length) out[out.length - 1].to = i - 1; out.push({ n: +m[1], from: i, to: lines.length - 1 }); } });
    return out;
  }
  const regionsOf = (facts, n) => facts.files.flatMap(f => stepRegions(f.text).filter(r => r.n === n).map(r => ({ f, from: r.from, to: r.to })));

  function checkStepBlanks(facts, n) {
    const rs = regionsOf(facts, n);
    if (!rs.length) return { ok: null, why: 'This step has no sentences of its own yet (no "── Step" note), so there\'s nothing to look in.' };
    const left = [];
    for (const r of rs) String(r.f.text).split('\n').slice(r.from, r.to + 1).forEach((l, k) => { if (/‹[^›\n]*›/.test(l) && !/^\s*note:/.test(l)) left.push({ path: r.f.path, line: r.from + k, space: 'text' }); });
    return left.length
      ? { ok: false, why: `${left.length} ‹blank›${left.length > 1 ? 's are' : ' is'} still to fill in: ${placeList(left)}.`, where: left.slice(0, 5) }
      : { ok: true, why: 'Every ‹blank› in its sentences is filled in.' };
  }
  function checkStepProblems(facts, n) {
    const rs = regionsOf(facts, n);
    if (!rs.length) return { ok: null, why: 'This step has no sentences of its own yet (no "── Step" note), so there\'s nothing to check.' };
    const bad = [];
    for (const r of rs) for (const li of r.f.errs || []) if (li >= r.from && li <= r.to) bad.push({ path: r.f.path, line: li, space: 'text' });
    return bad.length
      ? { ok: false, why: `${bad.length} of its lines ${bad.length > 1 ? 'have' : 'has'} a problem: ${placeList(bad)}.`, where: bad.slice(0, 5) }
      : { ok: true, why: 'None of its sentences has a problem.' };
  }

  function checkOne(facts, item) {
    if (item.error) return { ok: null, why: item.error };
    const p = item.p;
    switch (p.kind) {
      case 'mentions': return checkMentions(facts, p);
      case 'noProblems': return checkProblems(facts, p);
      case 'thing': return checkThing(facts, p);
      case 'rls': return checkRls(facts);
      case 'blanks': return checkStepBlanks(facts, item.step);
      case 'stepProblems': return checkStepProblems(facts, item.step);
      case 'mine': {
        const ref = { path: p.where.path || '', name: p.where.name || '' };
        const at = locate(facts, p.where.path, p.where.name);
        if (at.error) return { ok: false, why: at.error, ref };
        return { ok: true, ref, why: `${p.where.name ? `${said(p.where.name)} (${at.path}, lines ${at.from + 1}–${at.to + 1})` : said(at.path)} is yours.`, where: [{ path: at.path, line: at.from, space: 'code' }], mine: { path: at.path, name: p.where.name || '', code: at.code, from: at.from, to: at.to } };
      }
    }
    return { ok: null, why: 'IntuaCode doesn\'t know how to check this.' };
  }

  function check(text, facts) {
    return parse(text).items.map(item => {
      const r = checkOne(facts, item);
      return { li: item.li, text: item.text, step: item.step, kind: item.p ? item.p.kind : null, ok: r.ok, why: r.why, where: r.where || [], mine: r.mine || null, ref: r.ref || null, error: !!item.error };
    });
  }

  /* Each step's checks: the ones IntuaCode gives every step that has sentences (no problems; for a hallway step,
     no ‹blanks› left), then the step's own from INTENT.md. state: 'all' when every check that can be told holds,
     'some', 'none', or '' when nothing can be told. */
  const AUTO = { walk: ['stepProblems'], hallway: ['blanks', 'stepProblems'], horizon: [] };
  function stepChecks(steps, results, facts) {
    const out = new Map();
    for (const s of steps || []) {
      const checks = [];
      const has = regionsOf(facts, s.n).length > 0;
      const own = (results || []).filter(r => r.step === s.n);
      if (has) {
        for (const kind of AUTO[s.depth] || AUTO.walk) {
          if (own.some(r => r.kind === kind)) continue;   // said in INTENT.md already
          const r = kind === 'blanks' ? checkStepBlanks(facts, s.n) : checkStepProblems(facts, s.n);
          checks.push({ text: kind === 'blanks' ? 'every ‹blank› is filled in' : 'its sentences have no problems', auto: true, ok: r.ok, why: r.why, where: r.where || [] });
        }
      }
      for (const r of own) checks.push({ text: r.text, auto: false, li: r.li, ok: r.ok, why: r.why, where: r.where });
      const told = checks.filter(c => c.ok !== null), held = told.filter(c => c.ok).length;
      out.set(s.n, { checks, held, total: told.length, state: !told.length ? '' : held === told.length ? 'all' : held ? 'some' : 'none' });
    }
    return out;
  }

  /* The parts of the project no step covers: once a step has a place in a file, what's outside every step is
     code the plan doesn't account for (an AI's additions, often). Setup, data and tests aren't counted. */
  const partsCache = new Map();
  function outsideSteps(facts, steps) {
    if (!PARTS || !steps || !steps.length) return [];
    const known = new Set(steps.map(s => s.n));
    const regions = new Map(facts.files.map(f => [f.path, stepRegions(f.text).filter(r => known.has(r.n))]));
    if (![...regions.values()].some(r => r.length)) return [];
    const out = [];
    for (const f of facts.files) {
      if (isIntentPath(f.path) || f.write === 'text' || /^openspec\//i.test(f.path)) continue;
      const rs = regions.get(f.path);
      const key = f.lang + '\u0001' + f.path + '\u0001' + f.text;
      let parts = partsCache.get(key);
      if (!parts) {
        try { parts = PARTS.split(f.lang, f.text, f.path); } catch (_) { parts = []; }
        if (partsCache.size > 400) partsCache.clear();
        partsCache.set(key, parts);
      }
      for (const p of parts) {
        if (p.type !== 'display' && p.type !== 'mechanics') continue;
        if (rs.some(r => p.from <= r.to && p.to >= r.from)) continue;
        out.push({ path: f.path, from: p.from, to: p.to, title: p.title, type: p.type });
      }
    }
    return out;
  }

  root.IntuiPromises = { TEMPLATES, isIntentPath, parse, check, stepChecks, outsideSteps, locate, stepRegions, definitions, closest };
})(typeof window !== 'undefined' ? window : globalThis);

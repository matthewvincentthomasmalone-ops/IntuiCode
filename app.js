/* IntuaCode — the app.
 *
 * Unity:       one pane of real code; any part said in sentences, in place
 * Split Mode:  sentences on the left, the code they make on the right (from a blueprint, a kit or your own)
 * Import:      code from a file, a folder or a .zip becomes the project's own files
 */
(function () {
  'use strict';

  const LANG = window.IntuiLang.python;
  const WEB = window.IntuiWeb;
  const CPP = window.IntuiCpp;
  const BP = window.IntuiBlueprints;
  const Runner = window.IntuiRunner;
  const $ = (id) => document.getElementById(id);
  const escHtml = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const withCode = (s) => escHtml(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* storage unavailable */ } },
  };

  /* ------------------------------------------------------------------ */
  /* Project folders                                                     */
  /* ------------------------------------------------------------------ */

  const SECTION_META = {
    settings: { title: 'Settings', purpose: 'Starting values the whole program shares', icon: 'M3 5h10M3 11h10M6 3v4M10 9v4' },
    tools: { title: 'Tools', purpose: 'Reusable actions you define once and run anywhere', icon: 'M9.5 2.5l4 4-7 7h-4v-4zM8 4l4 4' },
    main: { title: 'Main program', purpose: 'What happens, step by step, when you press Run', icon: 'M4 2.5v11l9-5.5z' },
  };
  SECTION_META.structure = { title: 'Structure', purpose: 'What is on the page (HTML)', icon: 'M2.5 3.5h11v9h-11zM2.5 6.5h11' };
  SECTION_META.styling = { title: 'Styling', purpose: 'How the page looks (CSS)', icon: 'M3 13l3-1 7-7-2-2-7 7zM10 4l2 2' };
  SECTION_META.mechanics = { title: 'Mechanics', purpose: 'What the page does (JavaScript)', icon: 'M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2M4.2 4.2l1.4 1.4M10.4 10.4l1.4 1.4M4.2 11.8l1.4-1.4M10.4 5.6l1.4-1.4' };
  SECTION_META.program = { title: 'Program', purpose: 'What the program does, from the top (C++)', icon: 'M5 3.5L2 8l3 4.5M11 3.5l3 4.5-3 4.5' };
  SECTION_META.sketch = { title: 'Sketch', purpose: 'What the board does: settings, then once at the start, then over and over (Arduino)', icon: 'M4 4.5h8v7H4zM6 2.5v2M10 2.5v2M6 11.5v2M10 11.5v2' };
  const LAYOUTS = { structured: ['settings', 'tools', 'main'], script: ['main'], website: ['structure', 'styling', 'mechanics'], cpp: ['program'], arduino: ['sketch'] };
  const FILE_NAME = { settings: 'settings.py', tools: 'tools.py', main: 'main.py', structure: 'index.html', styling: 'style.css', mechanics: 'script.js', program: 'main.cpp', sketch: 'sketch.ino' };
  const SEC_LANG = { structure: 'html', styling: 'css', mechanics: 'js', program: 'cpp', sketch: 'cpp' };
  const LANG_NAME = { python: 'Python', html: 'HTML', css: 'CSS', js: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript', cpp: 'C++' };
  const KIND_OF_LAYOUT = { website: 'website', cpp: 'cpp', arduino: 'arduino' };
  const isCpp = () => project.kind === 'cpp' || project.kind === 'arduino';

  /* ---------- Files: every file has a path and a language (see lang/project.js) ---------- */
  const LANGS = window.IntuiLanguages;
  const PRJ = window.IntuiProject;
  const { ENGINE, WEB_ROLE, isSentences, writeOf, roleOf, pathProblem } = PRJ;
  const ENGINE_NAME = { python: 'Python', website: 'Website', cpp: 'C++', arduino: 'Arduino' };
  const langName = (id) => (LANGS.byId(id) || { name: id }).name;
  // An Arduino sketch must be named after its folder (blink/blink.ino).
  const sketchName = () => (desk.folder ? baseName(desk.folder) : project.name || 'sketch');
  const fileName = (sec) => (sec.file === 'sketch' && sec.path === 'sketch.ino' ? sketchName() + '.ino' : sec.path);
  const secLang = (sec) => (sec.lang === 'arduino' ? 'cpp' : sec.lang);
  const startSec = () => project.sections.find(s => s.id === project.start) || project.sections[0];
  const webOn = () => project.sections.some(s => WEB_ROLE[s.lang]);
  /* What a file shows as its title: the sections IntuaCode always had keep their names; others show their path. */
  function metaOf(sec) {
    const m = SECTION_META[sec.file];
    if (m && (FILE_NAME[sec.file] === sec.path || (sec.file === 'sketch' && sec.lang === 'arduino'))) return m;
    const l = LANGS.byId(sec.lang) || { name: 'Text', write: 'text' };
    const what = isSentences(sec) ? `${l.name}, written in sentences` : l.write === 'code' ? `${l.name}: you write the code, IntuaCode reads it to you` : `${l.name}: notes or data, kept as written`;
    return { title: sec.path.split('/').pop(), purpose: what, icon: l.write === 'text' ? 'M4 2.5h6l2 2v9H4zM6 7h4M6 9.5h4' : 'M5 3.5L2 8l3 4.5M11 3.5l3 4.5-3 4.5' };
  }
  /* What the phrase picker, Index and auto-indent use for a folder. */
  const NO_PACK = { templates: [], opens: /(?!)/, words: [], howtos: [], filter: () => false, webOnly: true };
  // A Python file of your own takes the sentences Main program takes.
  const tplRole = (sec) => (sec.lang === 'python' && !['settings', 'tools', 'main'].includes(sec.file) ? 'main' : sec.file);
  function packFor(sec) {
    if (!isSentences(sec)) {
      const l = LANGS.byId(sec.lang) || { name: 'Text', write: 'text' };
      return { ...NO_PACK, guide: { name: l.name, purpose: l.write === 'code' ? `${l.name} files are written as code here: IntuaCode has no sentences for ${l.name} yet. The help reads it to you in plain words, part by part.` : `${l.name} files hold notes or data, kept exactly as written.`, section: metaOf(sec).purpose + '.', rules: [] } };
    }
    if (sec.lang === 'python' && tplRole(sec) !== sec.file) return { templates: LANG.TEMPLATES, opens: LANG.OPENS_BLOCK, words: LANG.WORDS, guide: { ...LANG.GUIDE, section: 'A Python file of your own. The Python files listed before it in the project can use what it defines (IntuaCode adds the import); the start file can use them all.' }, howtos: LANG.GUIDE.howtos, filter: (t) => t.sections.includes('main') };
    if (secLang(sec) === 'cpp') { const ino = sec.file === 'sketch'; return { templates: CPP.TEMPLATES, opens: CPP.OPENS_BLOCK, words: ino ? CPP.ARDUINO_WORDS : CPP.WORDS, guide: ino ? CPP.ARDUINO_GUIDE : CPP.GUIDE, howtos: [], filter: (t) => t.sections.includes(sec.file), webOnly: true }; }
    if (secLang(sec) === 'python') return { templates: LANG.TEMPLATES, opens: LANG.OPENS_BLOCK, words: LANG.WORDS, guide: { ...LANG.GUIDE, section: LANG.GUIDE.sections[sec.file] }, howtos: LANG.GUIDE.howtos, filter: (t) => t.sections.includes(sec.file) };
    const g = WEB.GUIDES[sec.file];
    return { templates: WEB.TEMPLATES, opens: WEB.OPENS_BLOCK, words: WEB.WORDS[sec.file] || [], guide: g, howtos: [], filter: (t) => t.sections.includes(sec.file), webOnly: true };
  }

  const slug = (s) => String(s).toLowerCase().replace(/\.py$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-program';

  function projectFromBlueprint(bp, values) {
    const filled = BP.fill(bp, values);
    const nameField = bp.fields.find(f => f.name === 'project name');
    return {
      version: 1, lang: 'python', kind: KIND_OF_LAYOUT[bp.layout] || 'python', name: slug(nameField ? (values[nameField.name] ?? nameField.value) : bp.title),
      sections: LAYOUTS[bp.layout].map(f => ({ id: f, file: f, text: filled[f] || '' })),
      active: 'main',
    };
  }

  /* A project read back from the browser or from a folder's .intuicode/project.json keeps only the
   * parts IntuaCode uses, checked, so a project file from someone else can't put markup into the
   * page or odd values into the commands IntuaCode runs. */
  const KIND_FILES = { python: ['settings', 'tools', 'main'], website: LAYOUTS.website, cpp: LAYOUTS.cpp, arduino: LAYOUTS.arduino };
  // pictures in a project's images/ folder: a plain file name with a picture's ending, nothing more
  const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
  const IMAGE_NAME = /^[A-Za-z0-9_][\w.-]{0,78}\.(?:png|jpe?g|gif|webp|svg)$/i;
  const IMAGE_MAX = 8e6;
  const BOARD_ID = /^[\w.-]+:[\w.-]+:[\w.-]+(?::[\w.=,-]+)?$/;   // arduino-cli's name for a kind of board, e.g. esp32:esp32:esp32
  function checkedProject(p) {
    const sections = PRJ.checkedSections(p, KIND_FILES);   // each file a safe path and a known language
    if (!sections) return null;
    const out = normalized({ version: 2, lang: 'python', kind: p.kind, name: typeof p.name === 'string' && p.name.trim() ? p.name.slice(0, 80) : 'my-program', sections, active: p.active, start: p.start });
    if (!out) return null;
    if (Array.isArray(p.folders)) out.folders = p.folders.filter(f => typeof f === 'string' && !pathProblem(f)).slice(0, 50);   // folders with nothing in them yet
    if (typeof p.board === 'string' && BOARD_ID.test(p.board)) out.board = p.board;
    // its pictures: names and sizes here; the pictures themselves are kept by content (see Images)
    if (Array.isArray(p.images)) {
      out.images = p.images.slice(0, 60).filter(im => im && typeof im.name === 'string' && IMAGE_NAME.test(im.name) && typeof im.key === 'string' && /^[0-9a-f]{16,64}$/.test(im.key))
        .map(im => ({ name: im.name, type: IMAGE_TYPES[im.name.split('.').pop().toLowerCase()], key: im.key, w: Math.max(0, +im.w || 0), h: Math.max(0, +im.h || 0), size: Math.max(0, +im.size || 0) }));
    }
    // the project builder's map: steps in order, each a name, a depth, plain-language notes, how to check
    // it's done (one line) and whether it's ticked
    if (p.plan && typeof p.plan === 'object' && Array.isArray(p.plan.steps)) {
      const str = (v, n = 3000) => (typeof v === 'string' ? v.slice(0, n) : '');
      out.plan = {
        title: str(p.plan.title, 120),
        path: Array.isArray(p.plan.path) ? p.plan.path.slice(0, 8).map(x => str(x, 80)) : [],
        steps: p.plan.steps.slice(0, 60).filter(s => s && /^[\w-]{1,40}$/.test(s.id) && Number.isInteger(s.n)).map(s => ({
          id: s.id, n: s.n, name: str(s.name, 120), depth: ['walk', 'hallway', 'horizon'].includes(s.depth) ? s.depth : 'horizon',
          summary: str(s.summary), usual: str(s.usual), learn: str(s.learn),
          check: str(s.check, 300).replace(/\s+/g, ' ').trim(), done: s.done === true,
        })),
      };
    }
    return out;
  }

  const normalized = PRJ.normalized;

  const PROJECT_KEY = 'intuicode.project.v1';
  const PREVIOUS_KEY = 'intuicode.previous.v1';
  function loadProject() {
    return checkedProject(store.get(PROJECT_KEY, null)) || normalized(projectFromBlueprint(BP.parse(BP.BUILT_IN[0]), {}));
  }
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set(PROJECT_KEY, project), 300);
  }

  let project = loadProject();
  let compiled = null;
  let runtimeMark = null;  // {sec, line, msg}
  let typingLine = -1;     // errors on the line being typed wait until the cursor leaves it
  let mode = store.get('intuicode.mode.v1', 'unity') === 'write' ? 'write' : 'unity';   // Unity, unless Split Mode was used last
  // Which side you're working in: the sentences ('say') or the code ('code', at line codeIdx of the code).
  // The explain strip, the tutor and Ctrl+H all follow it.
  let pane = 'say', codeIdx = -1;

  const activeSec = () => project.sections.find(s => s.id === project.active) || project.sections[project.sections.length - 1];

  /* Swap in another project. In the desktop app it is linked to `folder` (null: not saved anywhere
   * yet), so autosave can never write one project's files into another project's folder. */
  function replaceProject(next, message, folder = null) {
    activeSec().text = ta.value;
    takeBackup();   // the project going out, if it changed since its last backup
    if (desk.on) {
      if (desk.folder && desk.dirty) saveProject('quiet');   // finish saving the old project to its own folder
      clearTimeout(desk.saveTimer);
      desk.folder = folder;
      desk.dirty = !folder;
    }
    store.set(PREVIOUS_KEY, project);
    project = normalized(next);
    backups.due = true;
    setUnsaved(!(desk.on && folder));   // only a project opened from its folder is saved as it is
    planToNext = true;   // its map opens at the first step not done
    codeBase.clear();   // another project: what its lines make is learnt afresh
    runtimeMark = null;
    ta.value = activeSec().text;
    Runner.reset();
    setMode(mode === 'unity' ? 'unity' : 'write');
    openSection(project.active);
    $('work').classList.toggle('web', webOn());
    showBottom(project.kind === 'website' ? 'preview' : 'terminal');
    updateChip();
    if (webOn()) runWebsite(false);
    if (desk.on) showFolder();
    loadImages();
    if (message) tLine(message + ' (Your previous project is kept: type "restore" in the terminal to swap back.)', 't-sys');
  }

  /* ------------------------------------------------------------------ */
  /* Elements and metrics                                                */
  /* ------------------------------------------------------------------ */

  const ta = $('ta'), hl = $('hl'), gutterInner = $('gutterInner'), codewrap = $('codewrap');
  const bandCur = $('bandCur'), bandLink = $('bandLink'), ac = $('ac'), pycode = $('pycode');
  let LH = 22, PAD_T = 12, PAD_L = 14, CW = 8.7;

  function measure() {
    const cs = getComputedStyle(ta);
    LH = parseFloat(cs.lineHeight) || 22;
    PAD_T = parseFloat(cs.paddingTop) || 12;
    PAD_L = parseFloat(cs.paddingLeft) || 14;
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
    probe.textContent = 'x'.repeat(100);
    document.body.appendChild(probe);
    CW = probe.getBoundingClientRect().width / 100 || 8.7;
    probe.remove();
  }

  /* ------------------------------------------------------------------ */
  /* Compile + render (Split Mode)                                       */
  /* ------------------------------------------------------------------ */

  const webTriple = PRJ.webTriple;
  const compileAll = (p) => PRJ.compileAll(p, { LANG, WEB, CPP });
  /* The page the preview shows: the HTML file being edited, or the main page, with the main page's CSS
   * and JavaScript. */
  function previewPage() {
    const t = (compiled && compiled.page) || {}, act = activeSec();
    const html = act && act.file === 'structure' ? act : t.structure;
    return { html, styling: t.styling, mechanics: t.mechanics };
  }
  function compile() {
    try { compiled = compileAll(project); }
    catch (e) { console.error(e); return; }
    checkDrift();
    try { webStubs(); } catch (e) { console.error(e); }
  }

  /* ---------- Never silently change code ----------
   * Each sentence line's code is remembered from when the line was written. If it comes out different
   * while the line itself hasn't changed (an edit elsewhere changed what a name holds, or made a tool
   * share a value), the line gets a warning saying what it was, until it's edited or the new code is kept. */
  const codeBase = new Map();   // section id -> Map(line text + its count -> code)
  let lastEdit = null;          // { title, line }: the edit that might have caused it
  const DRIFT = /^Its code changed after an edit elsewhere/;
  function lineKeys(sec) {
    const seen = new Map();
    return sec.text.split('\n').map(l => { const t = l.trim(), n = (seen.get(t) || 0) + 1; seen.set(t, n); return t + '\u0001' + n; });
  }
  const lineCode = (r, i) => (r.info[i] ? r.info[i].py.map(k => r.lines[k].text.trim()).filter(Boolean).join('\n') : '');
  /* A Structure line's code without what Styling and Mechanics add to it on purpose: a name for something they
     point at by its text, a group they put it in. Those aren't changes to warn about. */
  function sansAdded(code) {
    const web = compiled && compiled.web;
    if (!web) return code;
    let c = code;
    for (const id of Object.values(web.addIds || {})) c = c.split(` id="${id}"`).join('');
    const groups = new Set(Object.values(web.addGroups || {}).flat());
    if (groups.size) c = c.replace(/ class="([^"]*)"/g, (m, v) => { const left = v.split(' ').filter(g => !groups.has(g)); return left.length ? ` class="${left.join(' ')}"` : ''; });
    return c;
  }
  function checkDrift() {
    for (const s of project.sections) {
      const r = compiled.results[s.id];
      if (!r || !isSentences(s)) continue;
      const base = codeBase.get(s.id) || codeBase.set(s.id, new Map()).get(s.id);
      const keys = lineKeys(s), live = new Set(keys);
      keys.forEach((key, i) => {
        if (!key.split('\u0001')[0] || !r.info[i]) return;
        const now = lineCode(r, i);
        if (!base.has(key)) { base.set(key, now); return; }
        const was = base.get(key);
        if (was === now || sansAdded(was) === sansAdded(now) || (s.id === project.active && i === typingLine)) return;
        r.info[i].drift = { key, was, now };
        r.info[i].warns.push(`Its code changed after an edit elsewhere${lastEdit ? ` (${lastEdit.title}, line ${lastEdit.line + 1})` : ''}, though this line didn't: it was \`${was.replace(/\n/g, ' ⏎ ') || '(nothing)'}\`. Check it still does what you mean, then keep the new code (in the help below), or change the line.`);
      });
      for (const k of [...base.keys()]) if (!live.has(k)) base.delete(k);   // lines that are gone, or were edited
    }
  }
  function keepNewCode(secId, line) {
    const r = secResult(secId), d = r && r.info[line] && r.info[line].drift;
    if (d) codeBase.get(secId).set(d.key, d.now);
    refreshAll();
  }
  const secResult = (id) => compiled && compiled.results[id];
  /* What a file holds on disk: the code its sentences make, or (code, notes, data) its text as written. */
  const codeOf = (sec) => (isSentences(sec) ? (secResult(sec.id) || { text: '' }).text : sec.text);
  const caretLine = () => ta.value.slice(0, ta.selectionStart).split('\n').length - 1;

  const STARTER = /^(if (?:it|that|this|anything|something) fails(?: with)?|if nothing failed|in any case|if this file is run directly|fail with|fail again|check that|open the file|async using|using|define class|define async|make a new|field|decorate with|use the shared|delete|try|otherwise if|else if|otherwise|else|if|when|repeat until|repeat while|repeat forever|repeat|keep going|while|as long as|count down|count|for each|for every|for|define|give back|return|show|print|say|display|ask for an? (?:whole number|number|decimal)|ask for|ask|set|make|let|change|update|create (?:an? )?(?:empty )?(?:list|dictionary)|create|increase|decrease|multiply|divide|add|remove|subtract|sort|reverse|shuffle|wait|run|call|stop the loop|stop the program|skip to next|do nothing|use|remember|forever)(?=\s|$)/i;
  const OPS = new Set(['is', 'not', 'and', 'or', 'than', 'plus', 'minus', 'times', 'divided', 'mod', 'equal', 'contains', 'squared', 'more', 'less', 'greater', 'least', 'most', 'at', 'even', 'odd', 'bigger', 'smaller', 'yes', 'no', 'nothing']);
  const CONN = new Set(['to', 'by', 'with', 'using', 'from', 'in', 'of', 'store', 'into', 'as', 'item', 'first', 'last', 'length', 'random', 'number', 'text', 'decimal', 'each', 'the', 'counting', 'down', 'sum', 'biggest', 'smallest', 'rounded', 'result', 'it', 'places', 'seconds']);
  const NO_NAMES = { all: new Set(), fn: new Set() };
  const FILLER = new Set(LANG.FILLER.words);
  const STEP_WORDS = new Set(LANG.FILLER.steps);

  const EXACT_LINE = /^(\s*)((?:raw python|python|html|head|css|js|javascript|c\+\+|cpp|above main|raw)\s*:\s?)(.*)$/i;
  function hlLine(line, mark, names) {
    names = names || NO_NAMES;
    if (/^\s*(?:note\s*:|comment\s*:|#)/i.test(line)) return `<span class="s-com">${escHtml(line)}</span>`;
    // a line kept as code (python: …, html: …, c++: …): coloured as that language, and the language's name, which
    // the file needs, drawn as a plain </> mark of the same width, so the code reads as code, not as a label
    const m = line.match(EXACT_LINE);
    let body;
    if (m) {
      const tag = m[2], lang = RAW_LANG[tag.replace(/\s*:\s?$/, '').toLowerCase()] || 'python';
      const mark = tag.length >= 3 ? '</>' + ' '.repeat(tag.length - 3) : ' '.repeat(tag.length);
      body = escHtml(m[1]) + `<span class="s-rawtag">${escHtml(mark)}</span><span class="s-raw">${lang === 'python' ? hlPy(m[3]) : hlCode(lang, m[3])}</span>`;
    }
    else {
      const ind = line.match(/^\s*/)[0];
      let rest = line.slice(ind.length);
      let head = '';
      const lead = rest.match(LANG.FILLER.lead);
      if (lead && lead[0].length < rest.length && !/^(?:next round|then|now|next|first)$/i.test(rest)) {
        head = `<span class="s-fill" title="Filler: fine to write, left out of the Python">${escHtml(lead[0])}</span>`;
        rest = rest.slice(lead[0].length);
      }
      const sm = rest.match(STARTER);
      if (sm) { head += `<span class="s-kw">${escHtml(sm[0])}</span>`; rest = rest.slice(sm[0].length); }
      const toks = rest.replace(/("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'(?=\s|$|,)|‹[^›]*›?|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*)/g, '\u0000$1\u0000').split('\u0000');
      body = escHtml(ind) + head + toks.map((t, i) => {
        if (!t) return '';
        if (i % 2 === 0) return escHtml(t);
        if (t[0] === '"' || t[0] === "'") return `<span class="s-str">${escHtml(t)}</span>`;
        if (t[0] === '‹') return `<span class="s-slot">${escHtml(t)}</span>`;
        if (/^\d/.test(t)) return `<span class="s-num">${t}</span>`;
        const low = t.toLowerCase();
        if (FILLER.has(low)) return `<span class="s-fill">${escHtml(t)}</span>`;
        if (STEP_WORDS.has(low)) return `<span class="s-step">${escHtml(t)}</span>`;
        if (names.fn.has(low)) return `<span class="s-fn">${escHtml(t)}</span>`;
        if (names.all.has(low)) return `<span class="s-var">${escHtml(t)}</span>`;
        if (OPS.has(low)) return `<span class="s-op">${escHtml(t)}</span>`;
        if (CONN.has(low)) return `<span class="s-conn">${escHtml(t)}</span>`;
        return escHtml(t);
      }).join('');
    }
    return mark ? `<span class="s-${mark}">${body}</span>` : body;
  }

  function nameSets() {
    const all = new Set(), fn = new Set();
    if (compiled) for (const s of compiled.syms.values()) {
      if (s.kind === 'module') continue;
      for (const w of s.display.split(/\s+/)) all.add(w);
      all.add(s.py.toLowerCase());
      if (s.kind === 'function') { fn.add(s.py.toLowerCase()); s.display.split(/\s+/).forEach(w => fn.add(w)); }
    }
    return { all, fn };
  }

  function lineMarks(sec) {
    const r = secResult(sec.id);
    const marks = [];
    if (r) r.info.forEach((inf, i) => { marks[i] = (sec.id === project.active && i === typingLine) ? '' : inf.errs.length ? 'err' : inf.warns.length ? 'warn' : ''; });
    if (runtimeMark && runtimeMark.sec === sec.id) marks[runtimeMark.line] = 'err';
    return marks;
  }

  function renderOverlay() {
    const sec = activeSec();
    const lines = ta.value.split('\n');
    const plain = !isSentences(sec);   // code, notes and data: coloured as what they are
    const marks = plain ? [] : lineMarks(sec);
    const names = plain ? null : nameSets();
    hl.innerHTML = lines.map((l, i) => (plain ? hlFileLine(sec, l) : hlLine(l, marks[i], names))).join('\n') + '\n ';
    const cur = caretLine();
    gutterInner.innerHTML = lines.map((_, i) => `<div class="gl${i === cur ? ' cur' : ''}${marks[i] ? ' ' + marks[i] : ''}">${i + 1}</div>`).join('');
    renderSayMarks();
    syncScroll();
  }

  function syncScroll() {
    hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft;
    gutterInner.style.transform = `translateY(${-ta.scrollTop}px)`;
    $('sayMarks').style.transform = `translateY(${-ta.scrollTop}px)`;
    placeBand(bandCur, caretLine());
    if (!bandLink.hidden) placeBand(bandLink, +bandLink.dataset.line);
    const mask = $('bandMask');
    if (!mask.hidden) placeBand(mask, +mask.dataset.line);
    placeTip();
    renderValues();
  }
  function placeBand(el, line) { el.style.top = (PAD_T + line * LH - ta.scrollTop) + 'px'; }

  const PY_TOKEN = /(#.*$)|([rRbBuUfF]{0,2}"(?:[^"\\]|\\.)*"|[rRbBuUfF]{0,2}'(?:[^'\\]|\\.)*')|\b(\d+(?:\.\d+)?)\b|\b(def|class|return|if|elif|else|for|while|in|not|and|or|break|continue|pass|import|from|as|global|True|False|None|is|lambda|del|try|except|finally|with|raise|async|await|yield)\b|\b(print|input|int|float|str|len|range|sum|max|min|abs|round|sorted|list|dict|open|isinstance|enumerate|zip)\b(?=\()|([A-Za-z_]\w*)(?=\()|(@[\w.]+)/g;
  function hlPy(text) {
    if (/^\s*# \?\?\? /.test(text)) return `<span class="p-bad">${escHtml(text)}</span>`;
    let out = '', last = 0, m;
    PY_TOKEN.lastIndex = 0;
    while ((m = PY_TOKEN.exec(text))) {
      if (!m[0].length) { PY_TOKEN.lastIndex++; continue; }
      out += escHtml(text.slice(last, m.index));
      const cls = m[1] ? 'p-com' : m[2] ? 'p-str' : m[3] ? 'p-num' : m[4] ? 'p-kw' : m[5] ? 'p-bi' : m[6] ? 'p-fn' : 'p-dec';
      out += `<span class="${cls}">${escHtml(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return out + escHtml(text.slice(last));
  }

  const WEB_TOKEN = {
    html: /(<!--[\s\S]*?-->)|("(?:[^"\\]|\\.)*")|(<\/?[a-zA-Z][\w-]*|\/?>)|\b([a-z-]+)(?==)/g,
    css: /(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#[0-9a-fA-F]{3,8}\b|-?\d+(?:\.\d+)?(?:px|em|rem|%|s|vh|vw)?)|([a-z-]+)(?=\s*:)|([.#]?[a-zA-Z][\w-]*(?=[^{}]*\{)|@media)/g,
    js: /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(\d+(?:\.\d+)?)\b|\b(const|let|var|function|return|if|else|for|of|in|while|await|async|new|true|false|null|undefined|break|continue|class|import|from|export|default|try|catch|throw|typeof)\b|([A-Za-z_$][\w$]*)(?=\()/g,
  };
  WEB_TOKEN.ts = WEB_TOKEN.tsx = WEB_TOKEN.js;
  WEB_TOKEN.cpp = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(\d+(?:\.\d+)?[fFuUlL]?)\b|\b(int|double|float|char|bool|void|auto|const|constexpr|static|struct|class|public|private|protected|virtual|return|if|else|for|while|do|switch|case|break|continue|new|delete|nullptr|true|false|using|namespace|template|typename|include|define|pragma|unsigned|long|short)\b|([A-Za-z_]\w*)(?=\()/g;
  const WEB_CLASS = { html: ['p-com', 'p-str', 'p-kw', 'p-bi'], css: ['p-com', 'p-str', 'p-num', 'p-bi', 'p-kw'], js: ['p-com', 'p-str', 'p-num', 'p-kw', 'p-fn'] };
  function hlCode(lang, text) {
    if (lang === 'python' || !WEB_TOKEN[lang]) return hlPy(text);
    const re = WEB_TOKEN[lang], cls = WEB_CLASS[lang] || WEB_CLASS.js;
    let out = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      if (!m[0].length) { re.lastIndex++; continue; }
      out += escHtml(text.slice(last, m.index));
      const k = m.slice(1).findIndex(Boolean);
      out += `<span class="${cls[k] || 'p-kw'}">${escHtml(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return out + escHtml(text.slice(last));
  }

  /* ---------- Code, notes and data files ----------
   * Written as they are. The editor colours them; the right-hand side shows what they are: a Markdown
   * page, a table, the shape of JSON, or what the code does in plain words (the code reader). */
  const OTHER_KW = new Set('if else elif elsif unless for foreach while loop do return fn func function def fun sub class struct enum union trait impl interface protocol module mod namespace package import use using require include export from let var val const mut static pub public private protected internal final override virtual abstract async await yield try catch except finally throw throws raise match switch case when default break continue goto new delete this self super true false null nil none None True False and or not in is as then end begin local where type typedef extends implements defer go chan select guard extension lambda'.split(' '));
  function hlOther(lang, line) {
    const l = LANGS.byId(lang) || {};
    if (lang === 'markdown') {
      if (/^\s*#{1,6}\s/.test(line)) return `<span class="p-kw">${escHtml(line)}</span>`;
      if (/^\s*(```|~~~)/.test(line)) return `<span class="p-com">${escHtml(line)}</span>`;
      return escHtml(line).replace(/(`[^`]+`)/g, '<span class="p-str">$1</span>').replace(/(\*\*[^*]+\*\*)/g, '<span class="p-fn">$1</span>').replace(/^(\s*(?:[-*+]|\d+\.)\s)/, '<span class="p-num">$1</span>');
    }
    if (lang === 'csv' || lang === 'text') return escHtml(line);
    const com = l.comment ? l.comment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
    const re = new RegExp(`${com ? `(${com}.*$)|` : '()'}("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`[^\`]*\`)|\\b(\\d+(?:\\.\\d+)?)\\b|\\b([A-Za-z_][\\w]*)\\b(?=\\s*[:=]\\s)|([A-Za-z_]\\w*)`, 'g');
    let out = '', last = 0, m;
    while ((m = re.exec(line))) {
      if (!m[0].length) { re.lastIndex++; continue; }
      out += escHtml(line.slice(last, m.index));
      const cls = m[1] ? 'p-com' : m[2] ? 'p-str' : m[3] ? 'p-num' : m[4] && /^(json|yaml|toml)$/.test(lang) ? 'p-bi' : OTHER_KW.has(m[0]) ? 'p-kw' : '';
      out += cls ? `<span class="${cls}">${escHtml(m[0])}</span>` : escHtml(m[0]);
      last = m.index + m[0].length;
    }
    return out + escHtml(line.slice(last));
  }
  const hlFileLine = (sec, line) => (WEB_TOKEN[sec.lang] || sec.lang === 'python' ? hlCode(sec.lang, line) : hlOther(sec.lang, line));

  const { mdToHtml, csvRows, jsonKind } = PRJ;   // notes and data, shown as what they are
  function jsonOutline(v, depth = 0) {
    if (depth > 2 || v === null || typeof v !== 'object') return '';
    const entries = Array.isArray(v) ? v.slice(0, 5).map((x, i) => [i, x]) : Object.entries(v).slice(0, 40);
    return `<ul>${entries.map(([k, x]) => `<li><code>${escHtml(String(k))}</code> ${escHtml(jsonKind(x))}${jsonOutline(x, depth + 1)}</li>`).join('')}${Array.isArray(v) && v.length > 5 ? `<li class="dim">… and ${v.length - 5} more</li>` : ''}</ul>`;
  }

  /* The code reader on a code file of the project (when it's loaded): its sections, for the side and the strip. */
  const fileReads = new Map();   // sec.id -> { text, analysis }
  function readOf(sec) {
    const got = fileReads.get(sec.id);
    if (got && got.text === sec.text) return got.analysis;
    if (got && got.pending) return null;
    fileReads.set(sec.id, { text: sec.text, pending: true });
    analyseFile(sec).then(a => { fileReads.set(sec.id, { text: sec.text, analysis: a }); if (activeSec() === sec) { renderPython(); renderExplain(); } }).catch(() => fileReads.set(sec.id, { text: sec.text, analysis: null }));
    return null;
  }
  async function analyseFile(sec) {
    const CR = window.IntuiCodeReader;
    if (!CR) return null;
    await Runner.webReader(() => {});   // (the grammars come through the web reader's tree-sitter)
    await CR.load(sec.lang);
    return CR.analyze(sec.lang, sec.path, sec.text);
  }
  function renderSide(sec) {
    const l = LANGS.byId(sec.lang) || { name: 'Text', write: 'text' };
    $('pyFile').textContent = fileName(sec);
    $('codeTitle').textContent = l.name;
    let body = '';
    if (sec.lang === 'markdown') { $('codeSub').textContent = 'How it reads, as a page.'; body = `<div class="md-page">${mdToHtml(sec.text) || '<p class="dim">Nothing written yet.</p>'}</div>`; }
    else if (sec.lang === 'csv') {
      const rows = csvRows(sec.text);
      $('codeSub').textContent = rows.length ? `A table: ${Math.max(0, rows.length - 1)}${rows.length >= 200 ? '+' : ''} rows under a header row.` : 'A table, one row per line, cells separated by commas.';
      body = rows.length ? `<table class="md-table"><thead><tr>${rows[0].map(c => `<th>${escHtml(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r.map(c => `<td>${escHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
    } else if (sec.lang === 'json') {
      try { const v = JSON.parse(sec.text || 'null'); $('codeSub').textContent = `Reads as JSON: ${jsonKind(v)}.`; body = `<div class="md-page">${jsonOutline(v) || `<p>${escHtml(jsonKind(v))}</p>`}</div>`; }
      catch (e) { $('codeSub').textContent = 'This isn\'t JSON yet.'; body = `<p class="sum-empty">${escHtml(e.message)}</p>`; }
    } else if (l.write === 'code') {
      $('codeSub').textContent = 'You write the code; this is what it does, in plain words.';
      const a = readOf(sec);
      body = a && a.sections ? `<div class="md-page">${a.overview ? `<p>${rich(a.overview)}</p>` : ''}${a.sections.map(s => `<div class="side-sec" data-line="${(s.start || 1) - 1}"><b>${escHtml(s.title)}</b> <span class="dim">lines ${s.start}–${s.end}</span><p>${rich(s.headline || '')}</p>${(s.facts || []).slice(0, 4).map(f => `<p class="dim">${rich(f)}</p>`).join('')}</div>`).join('')}</div>`
        : `<p class="sum-empty">${window.IntuiCodeReader || /^(ts|tsx)$/.test(sec.lang) ? 'Reading it…' : `IntuaCode keeps ${escHtml(l.name)} exactly as you write it.`}</p>`;
    } else { $('codeSub').textContent = 'Kept exactly as written.'; body = `<pre class="md-code">${escHtml(sec.text)}</pre>`; }
    pycode.innerHTML = `<div class="side-file">${body}</div>`;
  }
  /* The strip under the windows, for a code or notes file: where the cursor is, and (code) what that part does. */
  function renderExplainFile(sec) {
    const li = caretLine(), l = LANGS.byId(sec.lang) || { name: 'Text', write: 'text' };
    const a = l.write === 'code' ? readOf(sec) : null;
    const part = a && a.sections && a.sections.find(s => li + 1 >= s.start && li + 1 <= s.end);
    $('explain').innerHTML = `<p class="ex-guide">${withCode(metaOf(sec).purpose)}.${l.write === 'code' ? ' Changing its language (⋯ beside it in Project) keeps the text as it is.' : ''}</p>`
      + (part ? `<div class="ex-map"><div class="ex-cell"><span class="ex-lbl">Line ${li + 1} is in</span><div class="ex-say">${escHtml(part.title)}</div></div><div class="ex-cell"><span class="ex-lbl">What it does</span><div>${rich(part.headline || '')}</div></div></div>` : '');
  }

  function renderPython() {
    const sec = activeSec();
    if (!isSentences(sec)) return renderSide(sec);
    const r = secResult(sec.id);
    $('pyFile').textContent = fileName(sec);
    $('codeTitle').textContent = sec.file === 'sketch' ? 'Arduino C++' : LANG_NAME[secLang(sec)];
    $('codeSub').textContent = `Generated from your sentences. Read it here, change it there.`;
    if (!r) { pycode.innerHTML = ''; return; }
    const looks = lineLooks(sec, ta.value.split('\n').length), linked = linkedLines(sec.id);
    pycode.innerHTML = r.lines.map((o, i) => {
      const hasNote = o.note || (o.src >= 0 && r.info[o.src] && r.info[o.src].notes.length);
      const look = o.src >= 0 ? looks[o.src] : groupFilter ? 'ctx' : '';
      return `<div class="pl${o.src < 0 ? ' hdr' : ''}${hasNote ? ' note' : ''}${look ? ' ' + look : ''}${o.src >= 0 && linked.has(o.src) ? ' lk' : ''}" data-i="${i}" data-src="${o.src}"><span class="ln">${i + 1}</span><span class="pc">${hlCode(secLang(sec), o.text) || ' '}</span></div>`;
    }).join('');
    if (pane === 'code' && codeIdx >= 0) {   // the picked line stays picked as the code changes
      codeIdx = Math.min(codeIdx, r.lines.length - 1);
      const el = pycode.children[codeIdx];
      if (el) el.classList.add('picked');
    }
    linkPython();
  }

  function linkPython(scroll) {
    const r = secResult(activeSec().id);
    pycode.querySelectorAll('.pl.linked').forEach(el => el.classList.remove('linked'));
    if (!r) return;
    const inf = r.info[caretLine()];
    if (!inf) return;
    let first = null;
    for (const idx of inf.py) {
      const el = pycode.children[idx];
      if (el && r.lines[idx].text.trim()) { el.classList.add('linked'); first = first || el; }
    }
    if (first && scroll) {
      const top = first.offsetTop, h = pycode.clientHeight;
      if (top < pycode.scrollTop + 20 || top > pycode.scrollTop + h - 50) pycode.scrollTop = top - h / 3;
    }
  }

  /* The explain strip follows the side you're working in: in the sentences it's about how the sentence is
   * said (its shape, its words, how to talk to the program); in the code it's about the code (what each
   * term is, your names, why it's written that way). */
  function renderExplain() {
    if (mode === 'unity') return renderExplainUnity();
    if (!isSentences(activeSec())) return renderExplainFile(activeSec());
    if (pane === 'code' && mode === 'write' && codeIdx >= 0) return renderExplainCode();
    const sec = activeSec();
    const r = secResult(sec.id);
    const li = caretLine();
    const text = ta.value.split('\n')[li] || '';
    const box = $('explain');
    if (!r || !text.trim()) {
      box.innerHTML = `${planBanner(li)}<p class="ex-guide">${withCode(packFor(sec).guide.section || '')}</p>
        <div class="ex-hint"><span>Start from an idea: open <b>Project Templates</b>.</span><span><kbd>Tab</kbd> jumps to the next ‹blank›</span><span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs the program</span><span><kbd>Ctrl</kbd>+<kbd>H</kbd> explains the words in a line or a selection</span><span>Click a line of ${escHtml(tutorSays(sec))} on the right to learn about the code itself.</span></div>`;
      return;
    }
    const inf = r.info[li] || { py: [], notes: [], warns: [], errs: [] };
    const py = inf.py.map(i => r.lines[i].text).filter(t => t.trim()).join('\n');
    const items = [], fill = fillHtml(text);
    if (runtimeMark && runtimeMark.sec === sec.id && runtimeMark.line === li) items.push(`<li class="err">${withCode(runtimeMark.msg)}</li>`);
    if (li === typingLine && inf.errs.length) items.push('<li>Keep typing, or pick a suggestion. Problems on this line show once you move to another line.</li>');
    else inf.errs.forEach(e => { if (!(fill && /^Fill in the ‹[^›]*› slot\.$/.test(e))) items.push(`<li class="err">${withCode(e)}</li>`); });
    inf.warns.forEach(w => items.push(`<li class="warn">${withCode(w)}${DRIFT.test(w) ? ` <button type="button" class="btn small" data-keep-code="${li}">Keep the new code</button>` : ''}</li>`));
    const pyLines = inf.py.filter(i => r.lines[i].text.trim());
    const why = inf.notes.length && pyLines.length ? `<button type="button" class="linklike ex-why" data-pick="${pyLines[0]}">${inf.notes.length === 1 ? 'A note' : inf.notes.length + ' notes'} on the ${escHtml(tutorSays(sec))}: click its line on the right</button>` : '';
    box.innerHTML = `${planBanner(li)}${fill}<div class="ex-map">
        <div class="ex-cell"><span class="ex-lbl">You wrote · line ${li + 1}</span><div class="ex-say">${escHtml(text.trim())}</div></div>
        <div class="ex-arrow" aria-hidden="true">→</div>
        <div class="ex-cell"><span class="ex-lbl">${escHtml(tutorSays(sec))} · ${escHtml(fileName(sec))} ${pyLines.length ? 'line ' + pyLines.map(i => i + 1).join(', ') : ''}</span><div class="ex-py">${hlCode(secLang(sec), py.split('\n').map(l => l.trimStart()).join('\n'))}</div></div>
      </div>
      ${shapeHtml(sec, text)}
      ${items.length ? `<ul class="ex-notes">${items.join('')}</ul>` : ''}${inf.errs.some(e => UNKNOWN_LINE.test(e)) ? closeMatchesHtml(sec, text, li) : ''}${sayTutorHtml(sec, li)}
      <p class="ex-foot">${why}<span><kbd>Ctrl</kbd>+<kbd>H</kbd> the words here, explained</span></p>`;
  }
  /* A line the writer doesn't recognise: the known sentences closest to what it says, each one click away. */
  const UNKNOWN_LINE = /don't recognise|don't understand|isn't a sentence|no sentence/i;
  function closeMatchesHtml(sec, text, li, where = 'say') {
    const found = closeMatches(sec, text, 4);
    if (!found.length) return '';
    return `<div class="ex-close"><span class="ex-lbl">Closest sentences IntuaCode knows</span><ul>${found.map(x => {
      const role = x.other ? (x.t.role || (x.t.sections || [])[0]) : '';
      return `<li><button type="button" class="btn small" data-use-sentence="${escHtml(x.pattern)}" data-use-role="${escHtml(role || '')}" data-use-line="${li}" data-use-where="${where}">${x.other ? `Add to ${escHtml(x.other.replace(/ \(.*\)$/, ''))}` : 'Use'}</button><span class="ex-say">${escHtml(x.pattern).replace(/‹([^›]*)›/g, '<span class="s-slot">‹$1›</span>')}</span></li>`;
    }).join('')}</ul></div>`;
  }

  /* ‹Blanks›: what goes in one, from its step's "blank:" line in the templates (your own kits' too): what
   * kind of thing it is, how to work it out, and an example that works, shown only when asked for. */
  let blankIndex = null, blankLib = null;
  function blankInfo(slot) {
    const lib = bldLibrary();
    if (lib !== blankLib) {
      blankLib = lib; blankIndex = new Map();
      for (const c of Object.values(lib.components)) for (const b of c.blanks || []) if (b.slot) blankIndex.set(b.slot, b);
    }
    return blankIndex.get(slot) || null;
  }
  const KIND_GLOSS = {
    'a number': 'like 3, or 0.5',
    'a calculation': 'a value worked out from others with plus, minus, times and divided by, or + - * /',
    'a test (true or false)': 'something that is either true or false, like `lives is 0`; join tests with and / or',
    'text in quotes': 'words in quotes, like "Game over"',
    'a name': 'one of the names the program already has',
    'a list': 'several values kept together',
    'a colour': 'a name like navy, or a code like #1a2b3c',
    'a css value': 'what comes after a style\'s name, like 12px or bold',
    'a line of code': 'written in the language itself, as it will be in the code',
  };
  const shownExamples = new Set();
  function fillHtml(text) {
    if (/^\s*(?:note|comment|teach)\s*:/i.test(text)) return '';
    return [...new Set(text.match(/‹[^›]*›/g) || [])].map(slot => {
      const b = blankInfo(slot), gloss = b && KIND_GLOSS[b.kind.toLowerCase()];
      const ex = !b || !b.example ? '' : shownExamples.has(slot)
        ? `<p class="ex-fill-ex"><b>One answer that works:</b> <code>${escHtml(b.example)}</code><button type="button" class="btn small" data-put-ex="${escHtml(slot)}">Put it in</button></p>`
        : `<p class="ex-fill-ex"><button type="button" class="btn small" data-show-ex="${escHtml(slot)}">Show an example</button><span class="dim">Have a go first: it's there if you're stuck, or to check yours.</span></p>`;
      return `<div class="ex-fill"><span class="ex-lbl">Fill in · <span class="ex-slot">${escHtml(slot)}</span></span>`
        + (b && b.kind ? `<p><b>What goes here:</b> ${escHtml(b.kind)}${gloss ? ` <span class="dim">(${withCode(gloss)})</span>` : ''}.</p>` : '<p>Replace it with what it describes.</p>')
        + (b && b.hint ? `<p><b>How to work it out:</b> ${withCode(b.hint)}</p>` : '')
        + ex + '<p class="ex-fill-tip dim"><kbd>Tab</kbd> selects the next ‹blank›, and what you type replaces it, marks and all.</p></div>';
    }).join('');
  }
  /* In Problems: "Fill in ‹ticks to wait›: a calculation." when its step says what goes there. */
  function blankSaid(msg) {
    const m = msg.match(/^Fill in the (‹[^›]*›) slot\.$/), b = m && blankInfo(m[1]);
    return b && b.kind ? `Fill in ${m[1]}: ${b.kind}. Click for how to work it out.` : msg;
  }
  function putExample(slot) {
    const b = blankInfo(slot), li = caretLine(), text = ta.value.split('\n')[li] || '', at = text.indexOf(slot);
    if (!b || at < 0) return;
    const start = lineStartOf(li) + at;
    insertText(b.example, start, start + slot.length);
    typingLine = -1;
    afterCaretMove(true);
  }

  /* In the code: one line of it, what's in it, and where it came from. */
  function renderExplainCode() {
    const sec = activeSec(), r = secResult(sec.id), o = r && r.lines[codeIdx];
    if (!o) { setPane('say'); return renderExplain(); }
    const lang = secLang(sec), src = o.src, sentence = src >= 0 ? (ta.value.split('\n')[src] || '').trim() : '';
    const inf = src >= 0 && r.info[src] ? r.info[src] : { notes: [], warns: [], errs: [] };
    const items = [];
    inf.errs.forEach(e => items.push(`<li class="err">${withCode(e)}</li>`));
    inf.warns.forEach(w => items.push(`<li class="warn">${withCode(w)}${DRIFT.test(w) ? ` <button type="button" class="btn small" data-keep-code="${src}">Keep the new code</button>` : ''}</li>`));
    const notes = (o.note ? [o.note] : []).concat(inf.notes);
    $('explain').innerHTML = `${src >= 0 ? planBanner(src) : ''}<div class="ex-map">
        <div class="ex-cell"><span class="ex-lbl">${escHtml(tutorSays(sec))} · ${escHtml(fileName(sec))} line ${codeIdx + 1}</span><div class="ex-py">${hlCode(lang, o.text.trim()) || '<span class="dim">(an empty line)</span>'}</div></div>
        <div class="ex-arrow" aria-hidden="true">←</div>
        <div class="ex-cell"><span class="ex-lbl">${src >= 0 ? `From your sentence · <button type="button" class="linklike" data-go-say="${src}">line ${src + 1}</button>` : 'Added for you'}</span><div class="ex-say">${src >= 0 ? escHtml(sentence) : '<span class="dim">IntuaCode adds this so the program is complete: it has no sentence of its own.</span>'}</div></div>
      </div>
      ${partsHtml(sec, o.text)}
      ${notes.length ? `<div class="ex-why-box"><span class="ex-lbl">Why it's written this way</span><ul class="ex-notes">${notes.map(n => `<li>${withCode(n)}</li>`).join('')}</ul></div>` : ''}
      ${items.length ? `<ul class="ex-notes">${items.join('')}</ul>` : ''}${codeTutorHtml(sec, codeIdx)}
      <p class="ex-foot"><span><kbd>↑</kbd><kbd>↓</kbd> other lines · <kbd>Enter</kbd> its sentence</span><span><kbd>Ctrl</kbd>+<kbd>H</kbd> the terms here, explained</span></p>`;
  }

  /* What's in a line of code: its terms from the glossary, and the names you made. */
  const GLOSS = window.IntuiGlossary;
  const glossLang = (sec) => (sec.file === 'sketch' ? 'arduino' : secLang(sec));
  const firstSentence = (s) => (String(s).match(/^.*?[.!?](?=\s|$)/) || [s])[0];
  function yourNames(text) {
    const syms = compiled && compiled.syms;
    if (!syms || !syms.values) return [];
    const byPy = new Map();
    for (const v of syms.values()) if (v && v.py) byPy.set(v.py, v);
    const out = [];
    for (const m of String(text).replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '').matchAll(/[A-Za-z_][\w-]*/g)) {
      const v = byPy.get(m[0]);
      if (v && !out.includes(v)) out.push(v);
    }
    return out;
  }
  const NAME_KIND = { function: 'a tool you defined', class: 'a class you defined', element: 'a part of the page you named', group: 'a group (CSS class) you made', number: 'a number you set', text: 'text you set', list: 'a list you made', value: 'a value you set', dict: 'a dictionary you made' };
  function partsHtml(sec, text) {
    const terms = GLOSS ? GLOSS.find(glossLang(sec), text) : [];
    const names = yourNames(text).filter(v => !terms.some(e => (e.m || [e.t]).includes(v.py)));
    if (!terms.length && !names.length) return '';
    return `<div class="ex-parts"><span class="ex-lbl">What's here</span><ul>
      ${terms.slice(0, 8).map(e => `<li><button type="button" class="ex-term" data-term="${escHtml(e.t)}" title="More about ${escHtml(e.t)}">${escHtml(e.t)}</button><span>${withCode(firstSentence(e.s))}</span></li>`).join('')}
      ${names.slice(0, 6).map(v => `<li><code class="ex-name">${escHtml(v.py)}</code><span>Your name: ${escHtml(NAME_KIND[v.kind] || 'a name you made')}.</span></li>`).join('')}
    </ul></div>`;
  }

  /* The shape a sentence follows: the template it fits, with your words in its ‹parts›. Lines that fit none
   * get their words sorted into what IntuaCode knows and what you named. */
  const shapeCache = new Map();
  function shapesFor(sec) {
    const key = secLang(sec) + ':' + sec.file;
    if (shapeCache.has(key)) return shapeCache.get(key);
    const PK = packFor(sec);
    const list = PK.templates.filter(PK.filter).map(t => {
      const parts = t.pattern.split(/(‹[^›]*›|…)/);
      const slots = parts.filter(p => /^‹|^…$/.test(p));
      const re = new RegExp('^' + parts.map(p => (/^‹|^…$/.test(p) ? '(.+?)' : p.trim() ? p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') : p.replace(/\s+/g, '\\s*'))).join('') + '$', 'i');
      return { t, re, slots, lit: t.pattern.replace(/‹[^›]*›|…/g, '').replace(/\s+/g, '').length };
    }).sort((a, b) => b.lit - a.lit);
    shapeCache.set(key, list);
    return list;
  }
  function matchShape(sec, line) {
    let s = String(line).trim();
    const lead = s.match(LANG.FILLER.lead);
    if (lead && lead[0].length < s.length) s = s.slice(lead[0].length);
    for (const x of shapesFor(sec)) { const m = s.match(x.re); if (m && x.lit) return { ...x, values: m.slice(1) }; }
    return null;
  }
  function shapeHtml(sec, line) {
    if (/^\s*(?:note|comment)\s*:/i.test(line)) return '';
    const m = matchShape(sec, line);
    if (m) {
      const shape = escHtml(m.t.pattern).replace(/‹[^›]*›|…/g, (p) => `<span class="ex-slot">${p}</span>`);
      const filled = m.slots.map((p, i) => [p, m.values[i]]).filter(([p, v]) => v && p !== '…' && v.trim() !== p.slice(1, -1));
      return `<div class="ex-shape"><span class="ex-lbl">How it's said · ${escHtml(m.t.group)}</span><div class="ex-shape-row"><code class="ex-shape-pat">${shape}</code>${filled.length ? `<span class="ex-shape-fill">${filled.map(([p, v]) => `<span class="ex-slot">${escHtml(p)}</span> is <b>${escHtml(v.trim())}</b>`).join(' · ')}</span>` : ''}</div>${m.t.tip ? `<p class="ex-shape-tip">${withCode(m.t.tip)}</p>` : ''}</div>`;
    }
    // no template: sort the words
    const box = document.createElement('div');
    box.innerHTML = hlLine(line.trim(), '', nameSets());
    const roles = { known: [], names: [], values: [] };
    for (const el of box.querySelectorAll('span')) {
      const w = el.textContent.trim();
      if (!w) continue;
      if (/s-kw|s-op|s-conn/.test(el.className)) roles.known.push(w);
      else if (/s-var|s-fn/.test(el.className)) roles.names.push(w);
      else if (/s-str|s-num/.test(el.className)) roles.values.push(w);
    }
    const list = (a) => [...new Set(a)].slice(0, 8).map(w => `<code>${escHtml(w)}</code>`).join(' ');
    if (!roles.known.length && !roles.names.length) return '';
    return `<div class="ex-shape"><span class="ex-lbl">How it's said</span><div class="ex-shape-row ex-roles">${roles.known.length ? `<span>Words IntuaCode knows: ${list(roles.known)}</span>` : ''}${roles.names.length ? `<span>Your names: ${list(roles.names)}</span>` : ''}${roles.values.length ? `<span>Values: ${list(roles.values)}</span>` : ''}</div></div>`;
  }

  function iconSvg(path) {
    return `<svg class="ti-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  const FOLDER_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4.5v8h13v-7h-7l-1.5-1.5h-4.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

  /* How many problems ('errs') or warnings ('warns') a folder's sentences have; `waitForTyping`
   * leaves out the line being typed, whose problems show once the cursor leaves it. */
  function issues(s, kind, waitForTyping) {
    const r = secResult(s.id);
    return r ? r.info.reduce((n, inf, i) => n + (waitForTyping && s.id === project.active && i === typingLine ? 0 : inf[kind].length), 0) : 0;
  }

  /* The project's files, folder by folder (folders first, then files in the project's order). Each has a
   * ⋯ for its name, language and start, and folders one for their name. */
  const FOLDER_ICON = 'M2 4.5h4.5L8 6h6v7H2z';
  function projectFolders() {
    const set = new Set(project.folders || []);
    for (const s of project.sections) { const parts = s.path.split('/'); for (let i = 1; i < parts.length; i++) set.add(parts.slice(0, i).join('/')); }
    return set;
  }
  function renderTree() {
    $('treeRoot').innerHTML = `${FOLDER_SVG}${escHtml(project.name)}/`;
    const folders = projectFolders(), many = project.sections.length > 1, out = [];
    const shown = project.sections.filter(s => secInGroup(s, groupFilter) || s.id === project.active);
    const linkedFile = (s) => linkedLines(s.id).size > 0;
    const fileRow = (s, depth) => {
      const meta = metaOf(s);
      const types = PARTS ? [...secTypes(s)].filter(t => t === 'display' || t === 'mechanics').map(t => `<span class="pdot t-${t}" title="${escHtml(typeName(t))}"></span>`).join('') : '';
      const errs = issues(s, 'errs', true), warns = issues(s, 'warns', true);
      const badge = errs ? `<span class="ti-badge" title="${errs} problem${errs > 1 ? 's' : ''}">${errs}</span>` : warns ? `<span class="ti-badge warn" title="${warns} warning${warns > 1 ? 's' : ''}">${warns}</span>` : '';
      const start = many && s.id === project.start ? ' <span class="ti-start" title="Run starts here">start</span>' : '';
      return `<div class="tree-row" style="--depth:${depth}"><button type="button" class="tree-item${s.id === project.active ? ' active' : ''}${linkedFile(s) ? ' linked' : ''}" data-id="${escHtml(s.id)}" title="${escHtml(meta.purpose)}">${iconSvg(meta.icon)}<span class="ti-title">${escHtml(meta.title)}${start}</span>${types ? `<span class="ti-types">${types}</span>` : ''}${badge}<span class="ti-file">${escHtml(fileName(s))}${isSentences(s) ? '' : ' · ' + escHtml(langName(s.lang))}</span></button><button type="button" class="ti-more" data-file-menu="${escHtml(s.id)}" title="Name, language, start, delete" aria-label="${escHtml(fileName(s))}: name, language, start, delete">⋯</button></div>`;
    };
    const walk = (dir, depth) => {
      const prefix = dir ? dir + '/' : '';
      const subs = [...folders].filter(f => f.startsWith(prefix) && f !== dir && !f.slice(prefix.length).includes('/')).sort();
      for (const f of subs) {
        const inside = shown.filter(s => s.path.startsWith(f + '/'));
        if (groupFilter && !inside.length) continue;
        out.push(`<div class="tree-row folder${inside.some(linkedFile) ? ' linked' : ''}" style="--depth:${depth}"><span class="tree-folder">${iconSvg(FOLDER_ICON)}<span>${escHtml(f.slice(prefix.length))}/</span></span><button type="button" class="ti-more" data-folder-menu="${escHtml(f)}" title="Rename or delete this folder" aria-label="${escHtml(f)}/: rename or delete">⋯</button></div>`);
        walk(f, depth + 1);
      }
      for (const s of shown) if (s.path.startsWith(prefix) && !s.path.slice(prefix.length).includes('/')) out.push(fileRow(s, depth));
    };
    walk('', 0);
    $('tree').innerHTML = out.join('');
  }

  /* ------------------------------------------------------------------ */
  /* Parts: every file's code in parts (lang/parts.js), each one         */
  /* Interface & Display, Backend & Mechanics, Setup & Settings or Data  */
  /* & Notes. The two buttons at the top show one side of the project;   */
  /* Parts lists them all, by type or by language; Project Link marks    */
  /* the ones in use.                                                    */
  /* ------------------------------------------------------------------ */

  const PARTS = window.IntuiParts;
  const partsCache = new Map();   // sec.id -> { text, lang, parts }
  let groupFilter = null;         // 'display' | 'mechanics' | null: the side of the project shown
  const textOf = (sec) => (sec.id === project.active && mode === 'write' ? ta.value : sec.text);
  function partsOf(sec) {
    if (!PARTS || !sec) return [];
    const text = textOf(sec), got = partsCache.get(sec.id);
    if (got && got.text === text && got.lang === sec.lang && got.path === sec.path) return got.parts;
    let parts = [];
    try { parts = PARTS.split(sec.lang, text, sec.path); } catch (e) { console.error(e); }
    partsCache.set(sec.id, { text, lang: sec.lang, path: sec.path, parts });
    return parts;
  }
  const partAt = (sec, li) => partsOf(sec).find(p => li >= p.from && li <= p.to) || null;
  const typeName = (t) => (PARTS ? PARTS.typeOf(t).name : t);
  const typeChip = (t) => (PARTS ? `<span class="tchip t-${t}" title="${escHtml(PARTS.typeOf(t).about)}">${escHtml(PARTS.typeOf(t).short)}</span>` : '');
  const inGroup = (part, g) => !g || PARTS.involves(part).has(g);
  const secInGroup = (sec, g) => !g || partsOf(sec).some(p => inGroup(p, g));
  const secTypes = (sec) => { const set = new Set(); for (const p of partsOf(sec)) for (const t of PARTS.involves(p)) set.add(t); return set; };

  /* How each line looks while one side is shown: '' as usual, 'ctx' a line of a shown part that's about
     something else (the loop around the lines that light an LED), 'off' dimmed. */
  function lineLooks(sec, count) {
    const out = new Array(count).fill('');
    if (!groupFilter || !PARTS) return out;
    out.fill('off');
    for (const p of partsOf(sec)) {
      if (!inGroup(p, groupFilter)) continue;
      for (let i = p.from; i <= p.to && i < count; i++) { const t = p.lines[i - p.from]; out[i] = !t || t === groupFilter ? '' : 'ctx'; }
    }
    return out;
  }
  /* Runs of lines with the same look, as bands for a pane whose text is one block (Split Mode's sentences). */
  function bandsHtml(looks, linked, count) {
    let html = '', i = 0;
    while (i < count) {
      const cls = (looks[i] ? looks[i] : '') + (linked.has(i) ? ' lk' : '');
      let j = i + 1;
      while (j < count && ((looks[j] ? looks[j] : '') + (linked.has(j) ? ' lk' : '')) === cls) j++;
      if (cls.trim()) html += `<div class="mk ${cls.trim()}" style="top:${PAD_T + i * LH}px;height:${(j - i) * LH}px"></div>`;
      i = j;
    }
    return html;
  }
  function renderSayMarks() {
    const sec = activeSec(), n = ta.value.split('\n').length;
    $('sayMarks').innerHTML = bandsHtml(lineLooks(sec, n), linkedLines(sec.id), n);
    $('sayMarks').style.transform = `translateY(${-ta.scrollTop}px)`;
  }

  /* The buttons at the top show one kind of part only: the side panel lists only those (it switches to
     CodeParts, and back when the kind is put away if it switched itself), and the main pane shows only them,
     file by file (the parts view). "Edit whole files" (or a part's Open) goes back to the editor, the
     parts still marked there. */
  let sideAuto = false;    // the side panel switched to CodeParts by itself
  let pvWhole = false;     // a kind is picked, but the editor shows the whole file
  function setGroup(g) {
    groupFilter = groupFilter === g ? null : g;
    for (const b of document.querySelectorAll('.grp-btn')) b.setAttribute('aria-pressed', String(b.dataset.group === groupFilter));
    $('app').dataset.group = groupFilter || '';
    pvWhole = false;
    pvShown = PV_STEP;
    if (groupFilter && sideView() === 'files') { setSideView('parts', false); sideAuto = true; }
    else if (!groupFilter && sideAuto) { setSideView('files', false); sideAuto = false; }
    renderGroupViews();
    $('pvList').scrollTop = 0;
  }
  function renderGroupViews() {
    applyIsolate();
    renderTree(); renderParts(); renderPartsView();
    if (mode === 'unity') renderUnity(); else { renderOverlay(); renderPython(); }
    if (!$('libModal').hidden) renderLibList();
  }
  for (const b of document.querySelectorAll('.grp-btn')) b.addEventListener('click', () => setGroup(b.dataset.group));

  /* The side panel: the project's files (File View), or its code part by part (CodeParts). */
  let sideNow = null;   // the view this time, when it switched itself (the one picked is kept in layout)
  const sideView = () => sideNow || (layout.sideView === 'parts' ? 'parts' : 'files');
  function setSideView(v, keep = true) {
    sideNow = v;
    if (keep) { layout.sideView = v; store.set(LAYOUT_KEY, layout); }
    sideAuto = false;
    applySideView();
    if (v === 'parts') renderParts();
  }
  function applySideView() {
    const v = PARTS ? sideView() : 'files';
    $('writeSide').dataset.view = v;
    $('filesView').hidden = v !== 'files';
    $('partsWrap').hidden = v !== 'parts';
    $('sideTitle').textContent = v === 'parts' ? 'CodeParts' : 'Project';
    const b = $('btnSideView');
    b.hidden = !PARTS;
    b.textContent = v === 'parts' ? 'File View' : 'CodeParts';
    b.title = v === 'parts' ? 'Back to the project\'s files and folders' : 'The project\'s code, part by part: each function, page section, style rule, block of settings';
  }
  $('btnSideView').addEventListener('click', () => setSideView(sideView() === 'parts' ? 'files' : 'parts'));

  /* Is the main pane showing only the picked kind of part? */
  const isolated = () => !!(PARTS && groupFilter && !pvWhole);
  function applyIsolate() {
    const on = isolated();
    $('partsView').hidden = !on;
    $('work').classList.toggle('isolated', on);
    $('writeView').hidden = on || mode !== 'write';
    $('unityView').hidden = on || mode !== 'unity';
  }

  /* What each language does in a project, for Parts by language. */
  const LANG_ROLE = {
    html: 'the page: what\'s on it', css: 'how it looks', js: 'what it does when it\'s used', ts: 'what it does, with types', tsx: 'screens and components (React)',
    vue: 'screens and components (Vue)', python: 'the program', cpp: 'the program', arduino: 'the board\'s sketch', c: 'the program', json: 'data and settings',
    yaml: 'settings', toml: 'settings', csv: 'a table of data', markdown: 'notes', text: 'notes', sql: 'the database', php: 'the server\'s pages', ruby: 'the program',
  };
  const partsClosed = new Set();   // groups folded away in CodeParts
  const partsMore = new Map();     // group -> how many of its parts are listed (long groups grow on request)
  let partsQuery = '';
  /* The parts to show: only the picked kind (each part by its own type), and only those matching the search
     (its name, its file, or the words in its lines). */
  function shownParts() {
    const q = partsQuery.trim().toLowerCase(), out = [];
    for (const s of project.sections) {
      const file = s.path.toLowerCase();
      for (const p of partsOf(s)) {
        if (groupFilter && p.type !== groupFilter) continue;
        if (q && !p.title.toLowerCase().includes(q) && !file.includes(q) && !textOf(s).split('\n').slice(p.from, p.to + 1).join('\n').toLowerCase().includes(q)) continue;
        out.push({ s, p });
      }
    }
    return out;
  }
  function renderParts() {
    if (!PARTS) { $('partsWrap').hidden = true; return; }
    applySideView();
    if (sideView() !== 'parts') return;
    const box = $('parts');
    const by = ['type', 'file', 'lang'].includes(layout.partsBy) ? layout.partsBy : 'type';
    const grouping = by === 'type' && groupFilter ? 'file' : by;   // one kind picked: its parts file by file
    $('partsByType').setAttribute('aria-selected', String(by === 'type'));
    $('partsByFile').setAttribute('aria-selected', String(by === 'file'));
    $('partsByLang').setAttribute('aria-selected', String(by === 'lang'));
    const all = shownParts();
    $('partsCount').textContent = all.length || '';
    $('partsShowing').innerHTML = groupFilter
      ? `${typeChip(groupFilter)}<span>only</span>${pvWhole ? '<button type="button" class="link-like" id="partsOnly" title="Show only these in the main pane">show only these</button>' : ''}`
      : (partsQuery ? 'Found' : 'All parts');
    const here = activeSec(), li = mode === 'unity' ? uLineOf(uTa.selectionStart) : caretLine();
    const multi = project.sections.length > 1;
    const row = ({ s, p }, inFile) => {
      const linked = [...linkedLines(s.id)].some(n => n >= p.from && n <= p.to);
      const at = s.id === here.id && li >= p.from && li <= p.to;
      // listed under its file: just the line; otherwise its file and line go under its name, so the name has the room
      const two = !inFile && multi;
      const where = two ? `${escHtml(fileName(s).split('/').pop())}:${p.from + 1}` : `${p.from + 1}`;
      return `<li><button type="button" class="part-row${two ? ' two' : ''}${linked ? ' linked' : ''}${at ? ' here' : ''}" data-part-sec="${escHtml(s.id)}" data-part-line="${p.from}" title="${escHtml(p.title)} · ${escHtml(fileName(s))}, lines ${p.from + 1}–${p.to + 1} · ${escHtml(typeName(p.type))}">`
        + `<span class="pdot t-${p.type}" aria-hidden="true"></span><span class="pr-title">${escHtml(p.title)}</span><span class="pr-where">${where}</span></button></li>`;
    };
    const group = (key, head, rows, inFile) => {
      const n = partsMore.get(key) || 80, shown = rows.slice(0, n);
      return `<details class="pg" data-pg="${escHtml(key)}"${partsClosed.has(key) ? '' : ' open'}><summary>${head}<span class="count">${rows.length}</span></summary><ul class="part-list">${shown.map(x => row(x, inFile)).join('')}${rows.length > shown.length ? `<li><button type="button" class="pg-more" data-pg-more="${escHtml(key)}">Show ${Math.min(200, rows.length - shown.length)} more of ${rows.length - shown.length}</button></li>` : ''}</ul></details>`;
    };
    let html = '';
    if (grouping === 'type') {
      for (const t of PARTS.TYPES) {
        const rows = all.filter(x => x.p.type === t.id);
        if (rows.length) html += group('t:' + t.id, `${typeChip(t.id)}<span class="pg-name">${escHtml(t.name)}</span>`, rows);
      }
    } else if (grouping === 'file') {
      const files = new Map();
      for (const x of all) { if (!files.has(x.s.id)) files.set(x.s.id, []); files.get(x.s.id).push(x); }
      for (const [id, rows] of files) {
        const s = rows[0].s, dir = fileName(s).split('/').slice(0, -1).join('/');
        html += group('f:' + id, `<span class="pg-name">${escHtml(fileName(s).split('/').pop())}</span>${dir ? `<span class="pg-role">${escHtml(dir)}/</span>` : ''}`, rows, true);
      }
    } else {
      const langs = new Map();
      for (const x of all) { if (!langs.has(x.s.lang)) langs.set(x.s.lang, []); langs.get(x.s.lang).push(x); }
      for (const [l, rows] of [...langs].sort((a, b) => b[1].length - a[1].length)) {
        const role = LANG_ROLE[l] || ((LANGS.byId(l) || {}).write === 'text' ? 'notes and data' : 'code');
        html += group('l:' + l, `<span class="pg-name">${escHtml(langName(l))}</span><span class="pg-role">${escHtml(role)}</span>`, rows);
      }
    }
    box.innerHTML = html || `<p class="side-note">${partsQuery ? 'No part matches that.' : groupFilter ? `Nothing in this project is ${escHtml(typeName(groupFilter))} yet.` : 'No code yet.'}</p>`;
  }
  $('parts').addEventListener('toggle', (e) => {
    const d = e.target.closest && e.target.closest('details[data-pg]');
    if (d) { if (d.open) partsClosed.delete(d.dataset.pg); else partsClosed.add(d.dataset.pg); }
  }, true);
  $('parts').addEventListener('click', (e) => {
    const more = e.target.closest('[data-pg-more]');
    if (more) { const k = more.dataset.pgMore; partsMore.set(k, (partsMore.get(k) || 80) + 200); renderParts(); return; }
    const b = e.target.closest('[data-part-sec]');
    if (!b) return;
    if (isolated()) pvReveal(b.dataset.partSec, +b.dataset.partLine);
    else openSection(b.dataset.partSec, +b.dataset.partLine);
  });
  $('partsShowing').addEventListener('click', (e) => { if (e.target.id === 'partsOnly') { pvWhole = false; renderGroupViews(); } });
  for (const [id, by] of [['partsByType', 'type'], ['partsByFile', 'file'], ['partsByLang', 'lang']]) {
    $(id).addEventListener('click', () => { layout.partsBy = by; store.set(LAYOUT_KEY, layout); renderParts(); });
  }
  let partsFindTimer = 0;
  $('partsFind').addEventListener('input', () => {
    clearTimeout(partsFindTimer);
    partsFindTimer = setTimeout(() => { partsQuery = $('partsFind').value; partsMore.clear(); pvShown = PV_STEP; renderParts(); renderPartsView(); }, 150);
  });

  /* The parts view: only the picked kind of part, file by file, each with its own lines. A big project's
     parts come a page at a time. Open puts the editor on the part (the whole file, the part marked). */
  const PV_STEP = 60;
  let pvShown = PV_STEP;
  function renderPartsView() {
    if (!isolated()) return;
    const all = shownParts(), t = PARTS.typeOf(groupFilter);
    const files = new Set(all.map(x => x.s.id)).size;
    $('pvTitle').innerHTML = `${typeChip(groupFilter)}<span>${escHtml(t.name)}</span>`;
    $('pvSub').textContent = all.length ? `${all.length} part${all.length === 1 ? '' : 's'} in ${files} file${files === 1 ? '' : 's'}${partsQuery ? ', matching the search' : ''}` : '';
    if (!all.length) { $('pvList').innerHTML = `<p class="pv-none">${partsQuery ? 'No part of this kind matches the search.' : `Nothing in this project is ${escHtml(t.name)} yet.`}</p>`; return; }
    let html = '', lastSec = null;
    for (const { s, p } of all.slice(0, pvShown)) {
      if (s !== lastSec) { if (lastSec) html += '</section>'; html += `<section class="pv-file"><h3 class="pv-fname">${iconSvg(metaOf(s).icon)}<span>${escHtml(fileName(s))}</span><span class="pv-flang">${escHtml(langName(s.lang))}</span></h3>`; lastSec = s; }
      const lines = textOf(s).split('\n').slice(p.from, p.to + 1);
      const shown = lines.slice(0, 80);
      const hl = (l) => (isSentences(s) ? hlLine(l) : hlFileLine(s, l)) || '​';
      html += `<article class="pv-part" data-pv-sec="${escHtml(s.id)}" data-pv-line="${p.from}">`
        + `<header><span class="pdot t-${p.type}" aria-hidden="true"></span><b>${escHtml(p.title)}</b><span class="pv-lines">lines ${p.from + 1}–${p.to + 1}</span><button type="button" class="btn tiny" data-pv-open title="Edit it in the whole file">Open</button></header>`
        + `<div class="pv-code">${shown.map((l, i) => `<div class="pv-ln"><span class="pv-n">${p.from + i + 1}</span><span class="pv-t">${hl(l)}</span></div>`).join('')}${lines.length > shown.length ? `<div class="pv-ln pv-cut"><span class="pv-n"></span><span class="pv-t">… ${lines.length - shown.length} more lines: Open to see them all</span></div>` : ''}</div></article>`;
    }
    if (lastSec) html += '</section>';
    if (all.length > pvShown) html += `<button type="button" class="btn small pv-more" id="pvMore">Show ${Math.min(PV_STEP, all.length - pvShown)} more parts of ${all.length - pvShown}</button>`;
    $('pvList').innerHTML = html;
  }
  /* A part picked in the side panel: shown (and lit) in the parts view, listing more of them if it's further down. */
  function pvReveal(secId, line) {
    const all = shownParts(), at = all.findIndex(x => x.s.id === secId && x.p.from === line);
    if (at >= pvShown) { pvShown = at + 1 + PV_STEP; renderPartsView(); }
    const el = [...$('pvList').querySelectorAll('.pv-part')].find(a => a.dataset.pvSec === secId && +a.dataset.pvLine === line);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    el.classList.remove('lit'); void el.offsetWidth; el.classList.add('lit');
  }
  $('pvList').addEventListener('click', (e) => {
    if (e.target.id === 'pvMore') { pvShown += PV_STEP; renderPartsView(); return; }
    const art = e.target.closest('.pv-part');
    if (art && e.target.closest('[data-pv-open]')) { pvWhole = true; renderGroupViews(); openSection(art.dataset.pvSec, +art.dataset.pvLine); }
  });
  $('pvWhole').addEventListener('click', () => { pvWhole = true; renderGroupViews(); });

  /* ---------- Adding, renaming and removing files and folders ---------- */
  const fileDlg = { kind: 'file', id: null, folder: null, isNew: true, deleting: false, lang: 'python' };
  function langOptions(selected) {
    const fam = LANGS.FAMILIES, groups = {};
    for (const l of LANGS.LANGUAGES) (groups[l.write === 'sentences' ? 'sentences' : l.family] = groups[l.write === 'sentences' ? 'sentences' : l.family] || []).push(l);
    const label = (g) => (g === 'sentences' ? 'Written in sentences' : fam[g] + ' (written as code)');
    return Object.keys(groups).sort((a, b) => (b === 'sentences') - (a === 'sentences') || (a === 'docs' || a === 'data') - (b === 'docs' || b === 'data')).map(g => `<optgroup label="${escHtml(g === 'docs' || g === 'data' ? fam[g] : label(g))}">${groups[g].map(l => `<option value="${l.id}"${l.id === selected ? ' selected' : ''}>${escHtml(l.name)}</option>`).join('')}</optgroup>`).join('');
  }
  function fileHow(lang) {
    const l = LANGS.byId(lang) || { name: lang, write: 'text' };
    if (l.write === 'sentences') return `You write sentences; IntuaCode writes the ${l.name} and shows it on the right.` + (lang === 'arduino' ? ' A project has one sketch that Run puts on the board; more .ino files are more tabs of it.' : '');
    if (l.write === 'code') return `You write ${l.name} itself: IntuaCode has no sentences for it yet. It reads the code to you in plain words, in the help and in Split Mode's right-hand pane.`;
    return { markdown: 'Notes: headings (#), lists (-), **bold**, `code` and tables, shown as a page on the right.', csv: 'A table: one row per line, cells separated by commas. Python files in the project can open it.', json: 'Data (JSON): checked as you type, and its shape is shown on the right. Python files can open it.' }[lang] || `${l.name}, kept exactly as written.`;
  }
  function openFileDialog(opts) {
    activeSec().text = ta.value;
    Object.assign(fileDlg, { kind: 'file', id: null, folder: null, isNew: true, deleting: false }, opts);
    const sec = fileDlg.id && project.sections.find(s => s.id === fileDlg.id);
    const isFolder = fileDlg.kind === 'folder';
    // a new file goes in the folder of the file you're in
    const here = (activeSec().path.includes('/') ? activeSec().path.replace(/\/[^/]*$/, '/') : '');
    fileDlg.lang = sec ? sec.lang : opts.lang || 'markdown';
    $('fileTitle').textContent = isFolder ? (fileDlg.isNew ? 'New folder' : `Folder: ${fileDlg.folder}/`) : (sec ? `File: ${fileName(sec)}` : 'New file');
    $('fileLead').textContent = isFolder ? (fileDlg.isNew ? 'A folder to keep files together. Name it, then add files to it with Menu → New file (as "folder/name").' : 'Rename it (its files move with it), or delete it with everything in it.')
      : sec ? 'Rename or move it (folders are separated with /), change its language, or make it the file Run starts.' : 'Name it with its folder if it goes in one (notes/ideas.md). Its language follows its ending, or choose one.';
    $('filePath').value = isFolder ? (fileDlg.folder || '') : sec ? sec.path : here + 'notes.md';
    $('fileLangRow').hidden = isFolder;
    $('fileStartRow').hidden = isFolder;
    $('fileLang').innerHTML = langOptions(fileDlg.lang);
    $('fileStart').checked = !!sec && sec.id === project.start;
    $('fileGo').textContent = fileDlg.isNew ? 'Create' : 'Save';
    $('fileDelWrap').hidden = fileDlg.isNew;
    $('fileDelWrap').innerHTML = '<button type="button" class="btn ghost" id="fileDelete">Delete…</button>';
    $('fileProblem').textContent = '';
    showFileHow();
    $('fileModal').hidden = false;
    $('filePath').focus();
    const v = $('filePath').value, dot = v.lastIndexOf('.'), slash = v.lastIndexOf('/');
    $('filePath').setSelectionRange(slash + 1, isFolder || dot <= slash ? v.length : dot);   // the name, without its folder or ending
  }
  function showFileHow() {
    const sec = fileDlg.id && project.sections.find(s => s.id === fileDlg.id);
    if (fileDlg.kind === 'folder') { $('fileHow').textContent = ''; return; }
    let how = fileHow($('fileLang').value);
    if (sec && $('fileLang').value !== sec.lang) how += ' Its text stays as it is: ' + (isSentences(sec) && ENGINE[$('fileLang').value] ? 'sentences that fit the new language carry over, and Problems shows any that don\'t.' : 'change it to suit the new language.');
    if (sec && desk.on && desk.folder) how += ' In the project\'s folder, a renamed file is written under its new name, and the old one stays until you delete it there.';
    $('fileHow').textContent = how;
  }
  $('fileLang').addEventListener('change', () => {
    // the ending follows the language (a .md that becomes Python is .py)
    const v = $('filePath').value, ext = LANGS.extOf($('fileLang').value), m = v.match(/^(.*?)(\.[A-Za-z0-9]+)?$/);
    if (m && (!m[2] || LANGS.fromPath(v) !== 'text' || /\.txt$/i.test(v))) $('filePath').value = m[1] + '.' + ext;
    showFileHow();
  });
  $('filePath').addEventListener('input', () => {
    // …and the language follows the ending
    const v = $('filePath').value;
    if (fileDlg.kind === 'file' && /\.[A-Za-z0-9]+$/.test(v)) { const l = LANGS.fromPath(v); if ((l !== 'text' || /\.txt$/i.test(v)) && l !== $('fileLang').value) { $('fileLang').value = l; showFileHow(); } }
    $('fileProblem').textContent = '';
  });
  const newId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // What a new file starts with.
  const START_TEXT = { markdown: (p) => `# ${p.split('/').pop().replace(/\.[^.]*$/, '').replace(/[-_]+/g, ' ')}\n\n`, html: (p) => `page title is "${p.split('/').pop().replace(/\.[^.]*$/, '').replace(/["\\{}]/g, '')}"`, arduino: () => NEW_START.sketch() };
  /* Swap in a changed copy of the project, if it holds together (no two files in one place). '' or why not. */
  function changeProject(next, openId, message) {
    const before = new Map(project.sections.map(s => [s.id, s.path + '|' + s.lang]));
    const n = normalized(next);
    if (!n) return 'That would put two files in the same place, or give two Python files the same module name. Choose another name.';
    // a file renamed, moved or given another language makes other code on purpose: learn it afresh
    for (const s of n.sections) { const was = before.get(s.id); if (!was || was !== s.path + '|' + s.lang) codeBase.delete(s.id); }
    project = n;
    if (!project.sections.some(s => s.id === project.active)) project.active = project.start;
    fileReads.clear();
    if (openId) project.active = openId;
    ta.value = activeSec().text;
    runtimeMark = null;
    renderSectionHeader();
    refreshAll();
    updateChip();
    $('work').classList.toggle('web', webOn());
    $('tabPreview').hidden = !webOn();
    if (!webOn()) showBottom('terminal');
    save(); autosave();
    if (mode === 'unity') unityShow(); else splitPlain();
    if (message) tLine(message, 't-sys');
    return '';
  }
  function applyFileDialog() {
    const copy = JSON.parse(JSON.stringify(project));
    const path = $('filePath').value.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    const say = (msg) => { $('fileProblem').textContent = msg; };
    if (fileDlg.kind === 'folder') {
      const why = pathProblem(path);
      if (why) return say(why);
      const taken = (p) => copy.sections.some(s => s.path.toLowerCase() === p.toLowerCase());
      if (taken(path)) return say(`There's already a file called ${path}.`);
      if (fileDlg.isNew) {
        if (projectFolders().has(path)) return say(`There's already a folder called ${path}/.`);
        copy.folders = [...(copy.folders || []), path];
        const err = changeProject(copy, null, `Added the folder ${path}/. Add files to it with Menu → New file.`);
        return err ? say(err) : closeFileDialog();
      }
      const old = fileDlg.folder;
      for (const s of copy.sections) if (s.path.startsWith(old + '/')) { s.path = path + s.path.slice(old.length); const why2 = pathProblem(s.path, s.lang); if (why2) return say(`${s.path}: ${why2}`); }
      copy.folders = (copy.folders || []).map(f => (f === old || f.startsWith(old + '/') ? path + f.slice(old.length) : f));
      const err = changeProject(copy, null, `Renamed the folder ${old}/ to ${path}/.`);
      return err ? say(err) : closeFileDialog();
    }
    const lang = $('fileLang').value;
    const why = pathProblem(path, lang);
    if (why) return say(why);
    if (fileDlg.isNew) {
      const s = { id: newId(), path, lang, text: START_TEXT[lang] ? START_TEXT[lang](path) : '' };
      copy.sections.push(s);
      if ($('fileStart').checked) copy.start = s.id;
      const err = changeProject(copy, null, `Added ${path} (${langName(lang)}).`);
      if (err) return say(err);
      closeFileDialog();
      openSection(s.id);
      return;
    }
    const s = copy.sections.find(x => x.id === fileDlg.id);
    const was = s.path;
    s.path = path; s.lang = lang;
    if ($('fileStart').checked) copy.start = s.id;
    else if (copy.start === s.id) copy.start = null;   // another file becomes the start
    const err = changeProject(copy, null, was !== path ? `Renamed ${was} to ${path}.` : '');
    if (err) return say(err);
    closeFileDialog();
  }
  function deleteFromDialog() {
    const copy = JSON.parse(JSON.stringify(project));
    const isFolder = fileDlg.kind === 'folder';
    const gone = isFolder ? copy.sections.filter(s => s.path.startsWith(fileDlg.folder + '/')) : copy.sections.filter(s => s.id === fileDlg.id);
    if (gone.length === copy.sections.length) { $('fileProblem').textContent = 'A project needs at least one file, so this can\'t be deleted. Add another file first.'; return; }
    if (!fileDlg.deleting) {
      fileDlg.deleting = true;
      $('fileDelWrap').innerHTML = `<span class="file-del-ask">${isFolder ? `Delete ${escHtml(fileDlg.folder)}/ and the ${gone.length} file${gone.length === 1 ? '' : 's'} in it?` : `Delete ${escHtml(gone[0].path)}?`} It can't be undone.</span><button type="button" class="btn danger small" id="fileDeleteYes">Delete</button><button type="button" class="btn small" id="fileDeleteNo">Keep</button>`;
      return;
    }
    copy.sections = copy.sections.filter(s => !gone.includes(s));
    if (isFolder) copy.folders = (copy.folders || []).filter(f => f !== fileDlg.folder && !f.startsWith(fileDlg.folder + '/'));
    const err = changeProject(copy, null, `Deleted ${isFolder ? fileDlg.folder + '/' : gone[0].path}.` + (desk.on && desk.folder ? ' (In the project\'s folder, the file stays until you delete it there.)' : ''));
    if (err) { $('fileProblem').textContent = err; return; }
    closeFileDialog();
  }
  function closeFileDialog() { $('fileModal').hidden = true; }
  $('btnAddFile').addEventListener('click', () => openFileDialog({}));
  $('btnAddFolder').addEventListener('click', () => openFileDialog({ kind: 'folder' }));
  $('fileClose').addEventListener('click', closeFileDialog);
  $('fileGo').addEventListener('click', applyFileDialog);
  $('fileModal').addEventListener('click', (e) => {
    if (e.target.id === 'fileModal') return closeFileDialog();
    if (e.target.id === 'fileDelete' || e.target.id === 'fileDeleteYes') return deleteFromDialog();
    if (e.target.id === 'fileDeleteNo') { fileDlg.deleting = false; $('fileDelWrap').innerHTML = '<button type="button" class="btn ghost" id="fileDelete">Delete…</button>'; }
  });
  $('filePath').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyFileDialog(); } });
  $('fileLang').addEventListener('input', showFileHow);

  function renderProblems() {
    const items = [];
    let errCount = 0;
    for (const s of project.sections) {
      const r = secResult(s.id);
      if (!r) continue;
      r.info.forEach((inf, i) => {
        if (s.id === project.active && i === typingLine) return;
        inf.errs.forEach(e => { errCount++; items.push({ s, i, msg: e, kind: 'err' }); });
        inf.warns.forEach(w => items.push({ s, i, msg: w, kind: 'warn' }));
      });
    }
    const pc = $('probCount');
    pc.textContent = items.length ? String(items.length) : '';
    pc.className = 'count' + (errCount ? ' bad' : '');
    $('problems').innerHTML = items.length
      ? items.slice(0, 60).map(p => `<li class="${p.kind}"><button type="button" data-sec="${escHtml(p.s.id)}" data-line="${p.i}"><span class="dot"></span><span><span class="where">${metaOf(p.s).title} · line ${p.i + 1}</span>${withCode(blankSaid(p.msg))}</span></button></li>`).join('')
      : '<li class="none">No problems. Press Run to try it.</li>';
    return errCount;
  }

  function renderSectionHeader() {
    const sec = activeSec(), meta = metaOf(sec);
    $('secTitle').textContent = meta.title;
    $('secPurpose').textContent = meta.purpose;
    // what the left side holds: sentences, code, or notes and data (which have no values to drop down)
    const tag = document.querySelector('.pane-say .file-tag');
    if (tag) tag.textContent = isSentences(sec) ? 'sentences' : writeOf(sec) === 'code' ? 'code' : sec.lang === 'markdown' || sec.lang === 'text' ? 'notes' : 'data';
    $('btnDropDown').hidden = !isSentences(sec);
  }

  let compileTimer = null;
  function scheduleCompile() { clearTimeout(compileTimer); compileTimer = setTimeout(refreshAll, 140); }
  function refreshAll() {
    clearTimeout(compileTimer);
    compile();
    renderOverlay(); renderPython(); renderExplain(); renderTree(); renderParts(); renderPartsView(); renderPlan(); renderProblems();
    tutorSoon();
    schedulePreview();
  }

  function openSection(id, line) {
    activeSec().text = ta.value;
    hideTip();
    setPane('say');
    typingLine = -1;
    project.active = id;
    ta.value = activeSec().text;
    renderSectionHeader();
    closeAc();
    bandLink.hidden = true;
    refreshAll();
    if (mode === 'unity') unityShow(line);   // Unity shows the same file, in one pane
    else if (line != null) goToLine(line); else { ta.setSelectionRange(0, 0); ta.scrollTop = 0; syncScroll(); }
    if (mode === 'write') splitPlain();   // Split Mode's left pane is always sentences
    if (!$('index').hidden) renderIndex();
    save();
  }

  function goToLine(line) {
    const lines = ta.value.split('\n');
    let pos = 0;
    for (let i = 0; i < line && i < lines.length; i++) pos += lines[i].length + 1;
    const end = pos + (lines[line] || '').length;
    ta.focus();
    ta.setSelectionRange(end, end);
    ta.scrollTop = Math.max(0, line * LH - ta.clientHeight / 3);
    afterCaretMove(true);
  }

  function ensureCaretVisible() {
    const top = caretLine() * LH;
    if (top < ta.scrollTop) ta.scrollTop = top;
    else if (top + LH + PAD_T * 2 > ta.scrollTop + ta.clientHeight) ta.scrollTop = top + LH + PAD_T * 2 - ta.clientHeight;
  }

  function afterCaretMove(scrollPy) {
    if (pane !== 'say') setPane('say');
    ensureCaretVisible();
    syncScroll();
    const cur = caretLine();
    if (typingLine >= 0 && cur !== typingLine) { typingLine = -1; renderOverlay(); renderTree(); renderProblems(); schedulePreview(); }
    [...gutterInner.children].forEach((g, i) => g.classList.toggle('cur', i === cur));
    linkPython(scrollPy);
    renderExplain();
    tutorSoon(900);
  }

  /* ------------------------------------------------------------------ */
  /* Editing: blanks, indentation, phrase picker                         */
  /* ------------------------------------------------------------------ */

  function insertText(str, from, to) {
    ta.focus();
    if (from != null) ta.setSelectionRange(from, to);
    let ok = false;
    try { ok = document.execCommand('insertText', false, str); } catch (_) { ok = false; }
    if (!ok) ta.setRangeText(str, ta.selectionStart, ta.selectionEnd, 'end');
    onEdit();
  }

  function lineBounds(pos) {
    const v = ta.value;
    const start = v.lastIndexOf('\n', pos - 1) + 1;
    let end = v.indexOf('\n', pos); if (end < 0) end = v.length;
    return { start, end, text: v.slice(start, end) };
  }

  function selectNextSlot(fromLineStart) {
    const b = lineBounds(ta.selectionStart);
    const line = b.text;
    const rel = fromLineStart ? 0 : ta.selectionEnd - b.start;
    let i = line.indexOf('‹', rel);
    if (i < 0 && !fromLineStart) i = line.indexOf('‹');
    if (i < 0) return false;
    const j = line.indexOf('›', i);
    if (j < 0) return false;
    ta.setSelectionRange(b.start + i, b.start + j + 1);
    afterCaretMove();
    return true;
  }

  function indentLines(dir) {
    const v = ta.value;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const start = v.lastIndexOf('\n', s - 1) + 1;
    let end = v.indexOf('\n', e > s && v[e - 1] === '\n' ? e - 1 : e); if (end < 0) end = v.length;
    const block = v.slice(start, end);
    const changed = block.split('\n').map(l => dir > 0 ? '    ' + l : l.replace(/^ {1,4}/, '')).join('\n');
    if (changed === block) return;
    insertText(changed, start, end);
    if (e > s) ta.setSelectionRange(start, start + changed.length);
  }

  /* Predictive Mode (the button over the sentences): while it's on, the sentence being typed is predicted the
   * way a terminal predicts a command. The best guess shows after the cursor in dim text (the ghost), and
   * the list under the line shows the others: sentences written before (in this project's files, and lines
   * entered with Enter, most recent first), then the sentence patterns, then names. Off: no predictions. */
  const PRED = window.IntuiPredict;
  const PREDICT_KEY = 'intuicode.predict.v1';
  let predictMem = store.get(PREDICT_KEY, {});
  if (!predictMem || typeof predictMem !== 'object' || Array.isArray(predictMem)) predictMem = {};
  const predictOn = () => !!(PRED && layout.predict);
  let ghostRest = '';   // what the ghost would add, '' when none shows

  /* Sentences to predict from, for the file's language: the ones entered before, then the project's own. */
  function predictLines() {
    const sec = activeSec(), cur = caretLine(), out = (predictMem[sec.lang] || []).slice();
    for (const s of project.sections) {
      if (s.lang !== sec.lang) continue;
      (s.id === sec.id ? ta.value : s.text).split('\n').forEach((l, i) => { if (s.id !== sec.id || i !== cur) out.push(l); });
    }
    return out.concat(librarySentences(sec.lang));
  }
  /* The Library's sentences in a language, for predictions: what its parts say, line by line. */
  const libSentenceCache = new Map();
  function librarySentences(lang) {
    if (!window.IntuiLibrary) return [];
    if (!libSentenceCache.has(lang)) {
      const out = [];
      try { for (const p of window.IntuiLibrary.catalog().parts) for (const v of p.variants) if (v.lang === lang && (LANGS.byId(lang) || {}).write === 'sentences') out.push(...v.text.split('\n')); } catch (_) { /* the Library didn't load */ }
      libSentenceCache.set(lang, out);
    }
    return libSentenceCache.get(lang);
  }

  /* Sentences made from the page itself, for Predictive Mode in a website's files: Styling offers what
     Structure has (by name, by its text, its groups), Mechanics what can be clicked, typed in or changed,
     and Structure what Styling and Mechanics point at that it doesn't have yet. */
  function webSuggestions(sec) {
    const web = compiled && compiled.web;
    if (!web || !sec || !['structure', 'styling', 'mechanics'].includes(sec.file)) return [];
    const out = [], say = (id) => (/^[a-z][\w-]*$/i.test(id) ? id : `"${id}"`);
    const els = (web.elements || []).filter(e => e.id || (e.text && e.text.length <= 40 && !/["\n‹]/.test(e.text)));
    if (sec.file === 'styling') {
      for (const e of els) {
        const who = e.id ? say(e.id) : `"${e.text}"`;
        out.push(`set ${who} colour to ‹colour›`, `set ${who} background to ‹colour›`, `give ${who} a border`, `style ${who}: ‹styles›`);
      }
      for (const g of Object.keys({ ...web.groups, ...web.cssGroups })) out.push(`style group ${g}: ‹styles›`);
    } else if (sec.file === 'mechanics') {
      for (const e of els.filter(x => x.id)) {
        const n = say(e.id);
        if (e.tag === 'button') out.push(`when ${n} is clicked`);
        if (e.tag === 'form') out.push(`when ${n} is sent`);
        if (/^(?:input|textarea|select)$/.test(e.tag)) out.push(`when ${n} is changed`, `get the text of ${n} and store in ‹value›`);
        else out.push(`set the text of ${n} to ‹value›`);
        out.push(`hide ${n}`);
      }
    } else {
      for (const [id, from] of Object.entries(web.wanted || {})) out.push(from === 'click' ? `add a button called ${say(id)} saying "‹text›"` : `add a box called ${say(id)}`);
    }
    return out;
  }
  /* The page's own sentences that carry on what's typed, best first. */
  const webMatches = (sec, typed, n) => {
    const low = typed.trim().toLowerCase();
    return low.length < 2 ? [] : webSuggestions(sec).filter(s => s.toLowerCase().startsWith(low) && s.toLowerCase() !== low).slice(0, n);
  };

  /* A new named part in Structure gets a place in Styling ("style next:") and, when it does something, in
     Mechanics ("when next is clicked"), ready to fill in: once its line is finished. A place still empty goes
     again if the part is renamed or removed. Works while Structure is the open file. */
  let stubKey = null, stubSeen = new Set();
  const stubMade = new Map();   // name -> [[file, lines]] added, as they were added
  function webStubs() {
    const web = compiled && compiled.web, page = compiled && compiled.page;
    if (!web || !page || !page.structure || !page.styling) return;
    const ids = (web.elements || []).filter(e => e.id);
    if (stubKey !== page.structure.id) { stubKey = page.structure.id; stubSeen = new Set(ids.map(e => e.id)); stubMade.clear(); return; }   // what's there already isn't new
    if (activeSec().id !== page.structure.id) return;
    const info = (compiled.results[page.structure.id] || {}).info || [];
    const u = $('uTa');
    const typing = mode === 'unity' ? (document.activeElement === u ? u.value.slice(0, u.selectionStart).split('\n').length - 1 : -1) : typingLine;
    const auto = new Set(Object.values(web.addIds || {}));
    const edits = {}, textOf = (f) => (edits[f] ?? page[f].text);
    const add = (t, block) => { const s = t.replace(/\s+$/, ''); return (s ? s + '\n\n' : '') + block.join('\n') + '\n'; };
    const cut = (t, block) => {
      const ls = t.split('\n');
      for (let k = 0; k + block.length <= ls.length; k++) {
        if (!block.every((b, j) => ls[k + j].trimEnd() === b)) continue;
        const from = k > 0 && !ls[k - 1].trim() ? k - 1 : k;
        return ls.slice(0, from).concat(ls.slice(k + block.length)).join('\n');
      }
      return null;
    };
    const now = new Set(ids.map(e => e.id)), gone = [], added = [];
    for (const [id, made] of stubMade) {
      if (now.has(id)) continue;
      for (const [f, block] of made) { const t = page[f] && cut(textOf(f), block); if (t != null) edits[f] = t; }
      stubMade.delete(id); stubSeen.delete(id); gone.push(id);
    }
    for (const e of ids) {
      if (stubSeen.has(e.id) || e.line === typing || auto.has(e.id) || (info[e.line] && info[e.line].errs.length)) continue;
      stubSeen.add(e.id);
      const n = /^[a-z][\w-]*$/i.test(e.id) ? e.id : `"${e.id}"`;
      const esc = e.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const said = (t) => new RegExp(`(^|[^\\w-])${esc}([^\\w-]|$)`, 'im').test(t);
      const made = [];
      if (!said(textOf('styling'))) { const b = [`style ${n}:`]; edits.styling = add(textOf('styling'), b); made.push(['styling', b]); }
      const what = e.tag === 'button' ? 'clicked' : e.tag === 'form' ? 'sent' : null;
      if (what && page.mechanics && !said(textOf('mechanics'))) {
        const b = [`when ${n} is ${what}`, `    note: what happens when ${n} is ${what}`];
        edits.mechanics = add(textOf('mechanics'), b); made.push(['mechanics', b]);
      }
      if (made.length) { stubMade.set(e.id, made); added.push([n, made.map(([f]) => f)]); }
    }
    const changed = Object.keys(edits).filter(f => page[f] && edits[f] !== page[f].text);
    if (!changed.length) return;
    for (const f of changed) page[f].text = edits[f];
    if (added.length) tLine(`Added a place for ${added.map(([n]) => n).join(', ')} in ${[...new Set(added.flatMap(([, fs]) => fs))].map(f => ({ styling: 'Styling', mechanics: 'Mechanics' }[f])).join(' and ')}, ready to fill in.`, 't-sys');
    else if (gone.length) tLine(`Took out the empty place${gone.length === 1 ? '' : 's'} for ${gone.join(', ')} (no longer in Structure).`, 't-sys');
    save(); autosave(); scheduleCompile();
  }

  /* A line entered with Enter is remembered (whether Predictive Mode is on or not), as a terminal keeps its history. */
  function rememberLine(text) {
    if (!PRED || !isSentences(activeSec())) return;
    const lang = activeSec().lang, before = predictMem[lang] || [];
    const next = PRED.remember(before, text);
    if (next[0] === before[0] && next.length === before.length) return;
    predictMem[lang] = next;
    store.set(PREDICT_KEY, predictMem);
  }

  /* Sentences by meaning (lang/intent.js): what a line probably means when it doesn't start like a known
     sentence ("add a data graph", "add a border"), from the file's language pack and, for a website, the other
     files' sentences (a border is Styling). Each: { pattern, other: where it goes, or null }. */
  const INTENT = window.IntuiIntent, COMPLETE = window.IntuiComplete;
  const CLASSIC_ROLE = { structure: 'html', styling: 'css', mechanics: 'js' };
  function intentExtras(sec) {
    if (WEB_ROLE[sec.lang]) {
      return WEB.WORDS.styling.map(([p]) => ({ pattern: `style ‹name›: ${p}`, group: 'Styles', role: 'styling' }))
        .concat([{ pattern: 'style ‹name›: border ‹2› ‹navy›', group: 'Styles', role: 'styling' }, { pattern: 'style ‹name›: no border', group: 'Styles', role: 'styling' }]);
    }
    if (sec.lang === 'python') {
      return [{ pattern: 'set ‹roll› to a random number from ‹1› to ‹6›', group: 'Numbers', role: null }, { pattern: 'set ‹pick› to a random item from ‹list›', group: 'Lists', role: null },
        { pattern: 'set ‹total› to the length of ‹list›', group: 'Lists', role: null }, { pattern: 'set ‹biggest› to the biggest of ‹list›', group: 'Lists', role: null }];
    }
    return [];
  }
  function closeMatches(sec, typed, limit = 4) {
    if (!INTENT || !isSentences(sec)) return [];
    const pk = packFor(sec), role = WEB_ROLE[sec.lang] ? tplRole(sec) : null;
    const templates = pk.webOnly ? WEB.TEMPLATES : pk.templates.filter(t => !/^(?:python|c\+\+|above main|note|description)\s*:/.test(t.pattern));
    return INTENT.match(typed, templates, { role, extra: intentExtras(sec), limit });
  }
  /* The file a sentence from elsewhere goes in: a website's file for that role (index.html, style.css…). */
  function fileForRole(role) {
    const lang = CLASSIC_ROLE[role];
    return lang && (PRJ.webTriple(project.sections.filter(s => WEB_ROLE[s.lang]))[role] || project.sections.find(s => s.lang === lang));
  }
  /* Put a suggested sentence where it belongs: on this line (replacing it), or at the end of its own file. */
  function useSentence(pattern, role, li) {
    const target = role ? fileForRole(role) : null;
    if (role && !target) { tLine(`That sentence goes in a ${role} file, and this project has none. Add one with Menu → New file.`, 't-sys'); return; }
    if (target && target.id !== activeSec().id) {
      // the line typed here asked for it: it moves to its own file, so it goes from this one
      const here = ta.value.split('\n');
      if (li >= 0 && li < here.length) {
        here.splice(li, 1);
        ta.value = here.join('\n');
        onEdit();
      }
      openSection(target.id);
      const text = ta.value.replace(/\s+$/, '');
      ta.value = (text ? text + '\n' : '') + pattern + '\n';
      onEdit();
      const at = ta.value.length - pattern.length - 1;
      ta.focus(); ta.setSelectionRange(at, at);
      selectNextSlot(true);
      tLine(`Added to ${fileName(target)}: ${pattern.replace(/[‹›]/g, '')}. Fill in its ‹blanks›.`, 't-sys');
      return;
    }
    const start = lineStartOf(li), line = ta.value.split('\n')[li] || '', indent = line.match(/^\s*/)[0];
    insertText(indent + pattern, start, start + line.length);
    ta.setSelectionRange(start, start);
    selectNextSlot(true);
  }
  /* Code being typed: in a code file, or after an exact line's python: / html: / js: … The language and the line
     up to the cursor, as the code completer wants them. */
  const RAW_LANG = { python: 'python', 'raw python': 'python', html: 'html', head: 'html', css: 'css', js: 'js', javascript: 'js', 'c++': 'cpp', cpp: 'cpp', 'above main': 'cpp', raw: null };
  function codeContext(sec, lineBefore) {
    if (!COMPLETE) return null;
    const l = LANGS.byId(sec.lang) || {};
    if (!isSentences(sec)) return l.write === 'text' && !['json', 'yaml', 'toml', 'markdown', 'csv', 'sql'].includes(sec.lang) ? null : { lang: sec.lang, before: lineBefore };
    const m = lineBefore.match(/^\s*(raw python|python|html|head|css|js|javascript|c\+\+|cpp|above main|raw)\s*:\s?(.*)$/i);
    if (!m) return null;
    const lang = RAW_LANG[m[1].toLowerCase()] || secLang(sec);
    return { lang: sec.lang === 'arduino' && lang === 'cpp' ? 'arduino' : lang, before: m[2] };
  }
  let codeRest = '';   // the dim rest of the code word being typed (Split Mode), '' when none

  let acItems = [], acIndex = 0;
  function closeAc() { ac.hidden = true; acItems = []; updateGhost(); }

  function updateAc() {
    codeRest = '';
    if (!predictOn()) return closeAc();
    const pos = ta.selectionStart;
    if (pos !== ta.selectionEnd) return closeAc();
    const b = lineBounds(pos);
    const before = b.text.slice(0, pos - b.start);
    // code (a code file, or an exact line): the rest of the word, from the language and the file's own names
    const code = codeContext(activeSec(), before);
    if (code) {
      closeAc();
      if (!b.text.slice(pos - b.start).trim()) {
        const c = COMPLETE.complete(code.lang, code.before, ta.value, { glossary: window.IntuiGlossaryTerms });
        if (c) { codeRest = c.rest; updateGhost(); }
      }
      return;
    }
    let indent = before.match(/^\s*/)[0];
    const lead = before.slice(indent.length).match(LANG.FILLER.lead);
    if (lead) indent += lead[0];   // "please set…" still suggests "set ‹name› to ‹value›"
    const typed = before.slice(indent.length);
    if (!typed || /^(?:note|python|#)/i.test(typed)) return closeAc();
    if (!isSentences(activeSec())) return closeAc();   // code and notes files are written as they are
    const file = tplRole(activeSec());
    const lower = typed.toLowerCase();
    const whole = { from: b.start + indent.length, to: pos };
    let items = [];

    if (!/‹/.test(b.text)) {
      items = PRED.history(typed, predictLines(), 3).map(s => ({ kind: 'history', label: s, py: '', tag: 'written before', ...whole }));
      // the page's own parts: Styling offers what Structure has, Mechanics what can be clicked, and so on
      for (const s of webMatches(activeSec(), typed, 4)) {
        if (!items.some(it => it.label.toLowerCase() === s.toLowerCase())) items.push({ kind: /‹/.test(s) ? 'template' : 'history', label: s, py: '', tag: 'on this page', ...whole });
      }
      const pk = packFor(activeSec()), have = new Set(items.map(it => it.label.toLowerCase()));
      items = items.concat(pk.templates.filter(t => (!pk.webOnly || pk.filter(t)) && !have.has(t.pattern.toLowerCase()) && (() => {
        const lead = t.pattern.split('‹')[0].toLowerCase();
        return (lead.startsWith(lower) || (lower.startsWith(lead.trim()) && lower.length <= lead.length + 1 && lead.trim().length)) && t.pattern.toLowerCase() !== lower;
      })()).sort((a, b2) => (b2.sections.includes(file) - a.sections.includes(file)))
        .map(t => ({ kind: 'template', label: t.pattern, py: t.py, tag: t.group, t, ...whole }))).slice(0, 7);
      // a sentence with its blanks so far filled in: the rest of it ("add a paragraph called intro" -> saying "…")
      for (const t of pk.templates.slice().sort((a, b2) => (b2.sections.includes(file) - a.sections.includes(file)))) {
        if (items.length >= 7) break;
        const r = (!pk.webOnly || pk.filter(t)) && PRED.after(typed, t.pattern);
        if (r && !items.some(it => it.label.toLowerCase() === (typed + r).toLowerCase())) items.push({ kind: 'template', label: typed + r, py: t.py, tag: t.group, t, ...whole });
      }
      // by meaning: "add a data graph" -> the drawing area; "add a border" -> a style, in Styling
      if (items.length < 4 && (/\s/.test(typed.trim()) || typed.trim().length >= 5)) {
        const have2 = new Set(items.map(it => it.label.toLowerCase()));
        const lineEnd = b.start + b.text.length;
        for (const x of closeMatches(activeSec(), typed, 6)) {
          if (items.length >= 7 || have2.has(x.pattern.toLowerCase())) continue;
          items.push({ kind: 'meaning', label: x.pattern, py: x.t.py || '', tag: x.other ? `goes in ${x.other}` : 'close match', role: x.other ? (x.t.role || (x.t.sections || [])[0]) : null, from: b.start + indent.length, to: lineEnd, li: caretLine() });
        }
      }
    }

    if (!items.length && /\s/.test(typed) && compiled) {
      const words = typed.split(/\s+/);
      for (let k = Math.min(3, words.length - 1); k >= 1 && !items.length; k--) {
        const tail = words.slice(-k).join(' ').toLowerCase();
        if (!tail || /["'‹]/.test(tail)) continue;
        const seen = new Set(), from = pos - words.slice(-k).join(' ').length;
        for (const s of compiled.syms.values()) {
          if (s.kind === 'module' || seen.has(s.display)) continue;
          if (s.display.startsWith(tail) && s.display !== tail) {
            seen.add(s.display);
            items.push({ kind: 'name', label: s.display, py: s.kind === 'function' ? `${s.py}(${(s.params || []).join(', ')})` : s.py, tag: { number: 'number', text: 'text', list: 'list', dict: 'dictionary', function: 'tool', yesno: 'yes/no' }[s.kind] || 'name', from, to: pos });
          }
        }
      }
      items = items.slice(0, 7);
    }

    if (!items.length) return closeAc();
    acItems = items; acIndex = 0;
    ac.innerHTML = items.map((it, i) => `<div class="ac-item${i === 0 ? ' on' : ''}" role="option" data-i="${i}"><span class="ac-say">${escHtml(it.label).replace(/‹([^›]*)›/g, '<span class="s-slot">‹$1›</span>')}</span><span class="ac-kind">${escHtml(it.tag)}</span>${it.py ? `<span class="ac-py">${escHtml(it.py)}</span>` : ''}</div>`).join('')
      + '<div class="ac-foot"><kbd>→</kbd> takes the dim text · <kbd>Ctrl</kbd>+<kbd>→</kbd> one word · <kbd>Tab</kbd> or <kbd>Enter</kbd> to use · <kbd>↑</kbd><kbd>↓</kbd> to choose · <kbd>Esc</kbd> to close</div>';
    ac.hidden = false;
    const line = caretLine();
    const top = PAD_T + (line + 1) * LH - ta.scrollTop + 4;
    const left = Math.max(8, Math.min(PAD_L + before.length * CW - ta.scrollLeft - 12, codewrap.clientWidth - ac.offsetWidth - 8));
    const flip = top + ac.offsetHeight > codewrap.clientHeight - 8 && top - LH - ac.offsetHeight - 8 > 0;
    ac.style.top = (flip ? top - LH - ac.offsetHeight - 8 : top) + 'px';
    ac.style.left = left + 'px';
    updateGhost();
  }

  /* The dim rest of the chosen prediction, after the cursor, when the cursor is at the end of its line. */
  function updateGhost() {
    const g = $('ghost');
    const hide = () => { ghostRest = ''; if (g && !g.hidden) g.hidden = true; };
    if (g && predictOn() && codeRest && ac.hidden) {   // the rest of a code word
      const pos = ta.selectionStart, b = lineBounds(pos);
      ghostRest = codeRest;
      g.textContent = codeRest;
      g.classList.add('code-ghost');
      g.style.top = (PAD_T + caretLine() * LH - ta.scrollTop) + 'px';
      g.style.left = (PAD_L + (pos - b.start) * CW - ta.scrollLeft) + 'px';
      g.hidden = false;
      return;
    }
    if (g) g.classList.remove('code-ghost');
    if (!g || !predictOn() || ac.hidden || !acItems.length) return hide();
    const pos = ta.selectionStart, it = acItems[acIndex];
    if (pos !== ta.selectionEnd || !it || pos !== it.to) return hide();
    const b = lineBounds(pos);
    if (b.text.slice(pos - b.start).trim()) return hide();
    const r = PRED.rest(ta.value.slice(it.from, pos), it.label);
    if (!r) return hide();
    ghostRest = r;
    g.innerHTML = escHtml(r).replace(/‹([^›]*)›/g, '<span class="s-slot">‹$1›</span>');
    g.style.top = (PAD_T + caretLine() * LH - ta.scrollTop) + 'px';
    g.style.left = (PAD_L + (pos - b.start) * CW - ta.scrollLeft) + 'px';
    g.hidden = false;
  }
  /* Ctrl+→: the next word of the ghost only. */
  function acceptWord() {
    if (!ghostRest) return;
    insertText(PRED.nextWord(ghostRest));
    updateAc();
  }

  function applyPredict() {
    for (const b of [$('btnPredict'), $('uPredict')]) {
      b.hidden = !PRED;
      b.setAttribute('aria-pressed', String(predictOn()));
      b.title = b.title.replace(/ Off while Project Link is on\.$/, '') + (layout.link ? ' Off while Project Link is on.' : '');
    }
    if (!predictOn()) { closeAc(); if (UNITY) uUpdateGhost(); }
  }
  function setPredict(on) {
    if (on && layout.link) { setLink(false); tLine('Project Link is off while Predictive Mode is on. Turn it back on over the Preview.', 't-sys'); }
    layout.predict = on; store.set(LAYOUT_KEY, layout); applyPredict();
    if (mode === 'unity') { uTa.focus({ preventScroll: true }); uUpdateGhost(); }
    else { ta.focus({ preventScroll: true }); if (on) updateAc(); }
  }
  $('btnPredict').addEventListener('click', () => setPredict(!layout.predict));
  $('uPredict').addEventListener('click', () => setPredict(!layout.predict));

  function moveAc(d) {
    acIndex = (acIndex + d + acItems.length) % acItems.length;
    [...ac.querySelectorAll('.ac-item')].forEach((el, i) => el.classList.toggle('on', i === acIndex));
    ac.querySelectorAll('.ac-item')[acIndex].scrollIntoView({ block: 'nearest' });
    updateGhost();
  }

  function acceptAc(i = acIndex) {
    const it = acItems[i];
    if (!it) return;
    closeAc();
    if (it.kind === 'meaning') { useSentence(it.label, it.role, it.li); return; }
    insertText(it.label, it.from, it.to);
    if (it.kind === 'template') {
      const b = lineBounds(it.from);
      ta.setSelectionRange(b.start, b.start);
      selectNextSlot(true);
    }
    closeAc();
  }

  function onEdit() {
    runtimeMark = null;
    if (!tip.hidden) hideTip();
    closeDdMenu();
    autosave();
    typingLine = caretLine();
    activeSec().text = ta.value;
    lastEdit = { title: metaOf(activeSec()).title, line: typingLine };
    ensureCaretVisible();
    renderOverlay();
    scheduleCompile();
    save();
  }

  ta.addEventListener('input', () => { onEdit(); updateAc(); });
  ta.addEventListener('scroll', () => { closeDdMenu(); syncScroll(); if (!ac.hidden) updateAc(); placeTip(); });
  ta.addEventListener('click', (e) => {
    closeAc();
    // a click in a ‹blank› selects all of it, as Tab does, so what's typed replaces it, marks and all
    if (e.detail === 1 && ta.selectionStart === ta.selectionEnd) {
      const b = lineBounds(ta.selectionStart), col = ta.selectionStart - b.start;
      if (!/^\s*(?:note|comment|description|teach)\s*:/i.test(b.text)) {
        const open = b.text.lastIndexOf('‹', col - 1), close = b.text.indexOf('›', open);
        if (open >= 0 && close >= col && !b.text.slice(open + 1, col).includes('›')) ta.setSelectionRange(b.start + open, b.start + close + 1);
      }
    }
    afterCaretMove(true);
  });
  ta.addEventListener('keyup', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key) && ac.hidden) afterCaretMove(true);
  });
  ta.addEventListener('blur', () => setTimeout(closeAc, 150));

  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); return; }
    if (e.altKey && e.key === 'ArrowDown' && ddOn()) { if (openDdAtCaret()) { e.preventDefault(); return; } }
    if (codeRest && ghostRest && ac.hidden && (e.key === 'ArrowRight' || e.key === 'Tab') && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const rest = codeRest; codeRest = '';
      insertText(rest);
      const m = rest.match(/=""$/);   // an HTML attribute: the cursor between its quotes
      if (m) { const p = ta.selectionStart - 1; ta.setSelectionRange(p, p); }
      return;
    }
    if (codeRest && e.key === 'Escape') { e.preventDefault(); codeRest = ''; updateGhost(); return; }
    if (!ac.hidden) {
      if (ghostRest && e.key === 'ArrowRight' && !e.shiftKey && !e.altKey) { e.preventDefault(); return e.ctrlKey || e.metaKey ? acceptWord() : acceptAc(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); return moveAc(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); return moveAc(-1); }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); return acceptAc(); }
      if (e.key === 'Escape') { e.preventDefault(); return closeAc(); }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) return indentLines(-1);
      if (!ta.value.slice(ta.selectionStart, ta.selectionEnd).includes('\n')) {
        if (selectNextSlot(false)) return;
        return insertText('    ');
      }
      return indentLines(1);
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const b = lineBounds(ta.selectionStart);
      rememberLine(b.text);
      const before = b.text.slice(0, ta.selectionStart - b.start);
      let indent = before.match(/^\s*/)[0];
      if (packFor(activeSec()).opens.test(before) && before.trim()) indent += '    ';
      insertText('\n' + indent);
      afterCaretMove(true);
      return;
    }
    if (e.key === 'Backspace' && ta.selectionStart === ta.selectionEnd) {
      const b = lineBounds(ta.selectionStart);
      const before = b.text.slice(0, ta.selectionStart - b.start);
      if (before.length >= 4 && /^ +$/.test(before) && before.length % 4 === 0) {
        e.preventDefault();
        insertText('', ta.selectionStart - 4, ta.selectionStart);
      }
    }
  });

  ac.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.ac-item');
    if (item) { e.preventDefault(); acceptAc(+item.dataset.i); }
  });
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === ta) { afterCaretMove(false); updateGhost(); }
  });

  /* The two sides. Working in the sentences, everything below them is about how things are said; working in
   * the code (click a line of it), it's about the code. */
  function setPane(p) {
    if (pane === p) return;
    pane = p;
    document.querySelector('.pane-say').classList.toggle('focused', p === 'say');
    document.querySelector('.pane-py').classList.toggle('focused', p === 'code');
    if (p === 'say') { codeIdx = -1; pycode.querySelectorAll('.pl.picked').forEach(el => el.classList.remove('picked')); showLinkBand(); }
    if (!tip.hidden && tip.dataset.pane !== p && tip.dataset.kind !== 'exercise') hideTip();
  }
  /* The sentence line marked on the left: the one a picked line of code came from. */
  function showLinkBand(line) {
    if (line == null && pane === 'code' && codeIdx >= 0) { const r = secResult(activeSec().id); line = r && r.lines[codeIdx] ? r.lines[codeIdx].src : -1; }
    if (line == null || line < 0) { bandLink.hidden = true; return; }
    bandLink.hidden = false; bandLink.dataset.line = line;
    placeBand(bandLink, line);
  }
  function pickCode(i, scroll) {
    const r = secResult(activeSec().id);
    if (!r || i < 0 || i >= r.lines.length) return;
    setPane('code');
    codeIdx = i;
    pycode.querySelectorAll('.pl.picked').forEach(el => el.classList.remove('picked'));
    const el = pycode.children[i];
    if (el) { el.classList.add('picked'); if (scroll) el.scrollIntoView({ block: 'nearest' }); }
    if (document.activeElement !== pycode && !tip.contains(document.activeElement)) pycode.focus({ preventScroll: true });
    showLinkBand();
    renderExplain();
    if (el) el.scrollIntoView({ block: 'nearest' });   // (the strip below may have grown and narrowed the code)
    tutorSoon(900);
  }
  pycode.addEventListener('mouseover', (e) => {
    const pl = e.target.closest('.pl');
    showLinkBand(pl && +pl.dataset.src >= 0 ? +pl.dataset.src : undefined);
  });
  pycode.addEventListener('mouseleave', () => showLinkBand());
  pycode.addEventListener('click', (e) => {
    const pl = e.target.closest('.pl');
    if (pl) pickCode(+pl.dataset.i);
    const part = e.target.closest('.side-sec');   // a part of a code file, in its outline
    if (part) goToLine(+part.dataset.line);
  });
  pycode.addEventListener('dblclick', (e) => {
    const pl = e.target.closest('.pl');
    if (pl && +pl.dataset.src >= 0) goToLine(+pl.dataset.src);
  });
  pycode.addEventListener('focus', () => { if (pane !== 'code') { const first = pycode.querySelector('.pl.linked') || pycode.querySelector('.pl'); if (first) pickCode(+first.dataset.i); } });
  pycode.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); pickCode(Math.max(0, codeIdx + (e.key === 'ArrowDown' ? 1 : -1)), true); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = secResult(activeSec().id); const src = r && r.lines[codeIdx] ? r.lines[codeIdx].src : -1; if (src >= 0) goToLine(src); }
  });
  pycode.addEventListener('scroll', placeTip);
  ta.addEventListener('focus', () => { if (pane !== 'say') { setPane('say'); renderExplain(); } });

  $('tree').addEventListener('click', (e) => {
    const more = e.target.closest('.ti-more');
    if (more) return more.dataset.folderMenu ? openFileDialog({ kind: 'folder', folder: more.dataset.folderMenu, isNew: false }) : openFileDialog({ id: more.dataset.fileMenu, isNew: false });
    const b = e.target.closest('.tree-item');
    if (b) openSection(b.dataset.id);
  });
  $('problems').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-sec]');
    if (!b) return;
    const blank = /^Fill in ‹/.test(b.textContent.replace(/^.*?line \d+/, ''));
    if (blank) setDock('help', true);   // how to fill it in is in the help
    openSection(b.dataset.sec, +b.dataset.line);
    if (blank) selectNextSlot(true);   // selected: what's typed replaces it
  });

  async function copyText(text, btn, label) {
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; }
    catch (_) { btn.textContent = 'Copy blocked here'; }
    setTimeout(() => { btn.textContent = label; }, 1800);
  }
  $('btnCopy').addEventListener('click', () => { activeSec().text = ta.value; copyText(codeOf(activeSec()), $('btnCopy'), 'Copy'); });

  /* ------------------------------------------------------------------ */
  /* Tutor: how the language likes things said, and lines to write      */
  /* yourself. Habits are found with a real parser (Python's own, or     */
  /* tree-sitter's C++), and answers are checked exactly.                */
  /* ------------------------------------------------------------------ */

  const TUTOR = window.IntuiTutor;
  const TUTOR_KEY = 'intuicode.tutor.v1';
  const tutor = Object.assign({ on: false, seen: {}, practised: {} }, store.get(TUTOR_KEY, {}));
  const tutorRun = { reader: null, loading: null, cpp: null, cppLoading: null, styles: {}, timer: null, offered: new Set(), lastOffer: 0, exercise: null };
  const tip = $('tip');
  const saveTutor = () => store.set(TUTOR_KEY, { on: tutor.on, seen: tutor.seen, practised: tutor.practised });
  const known = (card) => (tutor.practised[card] || 0) >= TUTOR.FADE_AFTER;
  // Card ids: Python's are bare (as progress was saved before), other languages' carry their name ("cpp:if").
  const cardOf = (id) => { const [lang, card] = id.includes(':') ? id.split(':') : ['python', id]; return (TUTOR.CARDS[lang] || {})[card]; };
  const cardId = (lang, card) => (lang === 'python' ? card : lang + ':' + card);
  /* The language the tutor teaches in a folder, or null. */
  const tutorLang = (sec) => (TUTOR.CARDS[secLang(sec)] ? secLang(sec) : null);
  const tutorReady = (lang) => (lang === 'python' ? !!tutorRun.reader : lang === 'cpp' ? !!tutorRun.cpp : false);
  const tutorSays = (sec) => (sec.file === 'sketch' ? 'Arduino C++' : LANG_NAME[secLang(sec)]);
  const TOUR_LANGS = new Set(['python', 'cpp']);   // the languages the tutor's style cards cover
  const RAW_LINE = { python: /^\s*(?:raw python|python|raw|note|comment)\s*:|^\s*#/i, cpp: /^\s*(?:c\+\+|cpp|raw|above main|outside main|at the top|note|comment)\s*:|^\s*include\b/i };

  function loadTutorReader(lang = 'python') {
    if (lang === 'cpp') {
      if (tutorRun.cpp || tutorRun.cppLoading) return;
      tutorRun.cppLoading = Runner.webReader((s) => setStatus(s))
        .then(WR => WR.loadLangs(['cpp']).then(() => { tutorRun.cpp = WR.parse; renderExplain(); tutorSoon(300); }))
        .catch(() => { /* the reader couldn't load: the tutor goes without it */ })
        .finally(() => { tutorRun.cppLoading = null; });
      return;
    }
    if (tutorRun.reader || tutorRun.loading) return;
    tutorRun.loading = Runner.reader((s) => setStatus(s))
      .then(R => { tutorRun.reader = R; renderExplain(); tutorSoon(300); })
      .catch(() => { /* Python couldn't start: the terminal has said so */ })
      .finally(() => { tutorRun.loading = null; });
  }

  function setTutor(on) {
    tutor.on = on;
    saveTutor();
    $('btnTutor').setAttribute('aria-pressed', String(on));
    hideTip();
    if (on) {
      setDock('help', true);   // part of the tutor lives in the help strip
      tLine('Tutor is on. As you write, I\'ll point out how the language likes things said, and now and then ask you to write a line yourself. (It speaks Python, C++ and Arduino so far.)', 't-sys');
      loadTutorReader(tutorLang(activeSec()) || 'python');
      tutorSoon(600);
    }
    renderExplain();
  }
  $('btnTutor').addEventListener('click', () => setTutor(!tutor.on));

  /* The habits in a folder's code, per code line (worked out once per version of the code). */
  function tutorStyles(sec) {
    const r = secResult(sec.id), lang = tutorLang(sec);
    if (!r || !lang || !tutorReady(lang)) return null;
    const cached = tutorRun.styles[sec.id];
    if (cached && cached.text === r.text) return cached;
    const res = lang === 'cpp' ? TUTOR.cppStylePoints(tutorRun.cpp, r.text, true) : tutorRun.reader.stylePoints(r.text, true);
    const byLine = [];
    for (const p of res.points || []) (byLine[p.line - 1] = byLine[p.line - 1] || []).push(cardId(lang, p.card));
    return (tutorRun.styles[sec.id] = { text: r.text, byLine });
  }
  /* The habits shown by the code a sentence became. */
  function cardsForSentence(sec, li) {
    const st = tutorStyles(sec), r = secResult(sec.id);
    if (!st || !r || !r.info[li]) return [];
    return [...new Set(r.info[li].py.flatMap(i => st.byLine[i] || []))].filter(cardOf);
  }
  /* The habits on one line of the code. */
  function cardsForCode(sec, idx) {
    const st = tutorStyles(sec);
    return st ? [...new Set(st.byLine[idx] || [])].filter(cardOf) : [];
  }
  /* How a sentence talks to the program: its habits, for the sentence side. */
  const packOf = (sec) => (secLang(sec) === 'python' ? 'python' : sec.file === 'sketch' ? 'arduino' : secLang(sec) === 'cpp' ? 'cpp' : 'web');
  const sayCards = (sec, line) => TUTOR.sayPoints(line, { pack: packOf(sec), file: sec.file, opens: packFor(sec).opens, filler: LANG.FILLER.lead }).map(c => 'say:' + c).filter(cardOf);
  /* A sentence to say yourself: one that is a sentence (not exact code, a note or a blank) and makes code. */
  function sayExercise(sec, li) {
    const r = secResult(sec.id), inf = r && r.info[li], text = ta.value.split('\n')[li] || '';
    if (!inf || inf.errs.length || !text.trim() || /‹[^›]*›/.test(text) || /^\s*(?:note|comment|python|raw python|raw|c\+\+|cpp|html|css|js|head|above main|outside main|at the top)\s*:/i.test(text)) return null;
    const code = inf.py.map(i => r.lines[i].text).filter(t => t.trim());
    return code.length ? { code, sentence: text.trim() } : null;
  }
  /* Your sentence in place of the real one: does the whole project come out exactly the same? */
  function saysTheSame(sec, li, answer) {
    const copy = JSON.parse(JSON.stringify(project));
    const lines = ta.value.split('\n');
    lines[li] = lines[li].match(/^\s*/)[0] + answer.trim();
    copy.sections.find(s => s.id === sec.id).text = lines.join('\n');
    let other;
    try { other = compileAll(copy); } catch (e) { return { same: false, error: 'IntuaCode couldn\'t read that sentence.' }; }
    const mine = other.results[sec.id];
    if (!mine || !mine.info[li] || mine.info[li].errs.length) return { same: false, error: mine && mine.info[li] && mine.info[li].errs[0] };
    return { same: copy.sections.every(s => (other.results[s.id] || {}).text === (compiled.results[s.id] || {}).text) };
  }
  /* The one line of code a sentence became, if it's a sentence (not already code or a note). */
  function exerciseFor(sec, li) {
    const r = secResult(sec.id), lang = tutorLang(sec);
    if (!r || !r.info[li] || !lang || r.info[li].errs.length) return null;
    const text = sec.text.split('\n')[li] || '';
    if (!text.trim() || RAW_LINE[lang].test(text)) return null;
    return TUTOR.exerciseLine(r.info[li].py.map(i => r.lines[i].text));
  }

  /* The tutor's part of the explain strip on the code side: the language's habits on this line, and a line
   * to write yourself. (HTML, CSS and JavaScript have no habit notes yet: "What's here" does the teaching.) */
  function codeTutorHtml(sec, idx) {
    if (!tutor.on) return '';
    const lang = tutorLang(sec), r = secResult(sec.id), src = r && r.lines[idx] ? r.lines[idx].src : -1;
    if (!lang) return '';
    if (!tutorReady(lang)) { loadTutorReader(lang); return `<div class="ex-tutor"><span class="ex-lbl">Tutor</span> Getting ready…</div>`; }
    const cards = cardsForCode(sec, idx);
    const ex = src >= 0 ? exerciseFor(sec, src) : null;
    if (!cards.length && !ex) return '';
    const allKnown = cards.length && cards.every(known);
    const items = cards.map(c => (known(c)
      ? `<li class="known">✓ ${withCode(cardOf(c).title)} <span class="dim">· you know this one</span></li>`
      : `<li><b>${withCode(cardOf(c).title)}.</b> ${withCode(cardOf(c).say)}</li>`));
    const says = tutorSays(sec);
    const canWrite = lang !== 'cpp' || !/^\}|\{\s*$/.test(ex || '');   // (a c++: line can't open or close a block of sentences)
    const act = !ex ? '' : allKnown && canWrite ? `<button type="button" class="btn small" data-tutor="code" title="Replace the sentence with the line of ${escHtml(says)} it stands for">Write this line as ${escHtml(LANG_NAME[lang])}</button>`
      : `<button type="button" class="btn small" data-tutor="turn">✎ Write it yourself</button>`;
    return `<div class="ex-tutor"><div class="ex-tutor-h"><span class="ex-lbl">In ${escHtml(says)}</span>${act}</div>${items.length ? `<ul>${items.join('')}</ul>` : ''}</div>`;
  }
  /* …and on the sentence side: how this sentence talks to the program, and a sentence to say yourself. */
  function sayTutorHtml(sec, li) {
    if (!tutor.on) return '';
    const cards = sayCards(sec, ta.value.split('\n')[li] || '');
    const canSay = !!sayExercise(sec, li);
    if (!cards.length && !canSay) return '';
    const fresh = cards.filter(c => !tutor.seen[c]), seen = cards.filter(c => tutor.seen[c]);
    return `<div class="ex-tutor ex-tutor-say"><div class="ex-tutor-h"><span class="ex-lbl">Talking to the program</span>${canSay ? '<button type="button" class="btn small" data-tutor="say">✎ Say it yourself</button>' : ''}</div>
      ${fresh.length ? `<ul>${fresh.map(c => `<li><b>${withCode(cardOf(c).title)}.</b> ${withCode(cardOf(c).say)}</li>`).join('')}</ul>` : ''}
      ${seen.length ? `<p class="ex-tutor-seen">Also on this line: ${seen.map(c => `<button type="button" class="linklike" data-card="${c}">${withCode(cardOf(c).title)}</button>`).join(' · ')}</p>` : ''}</div>`;
  }
  $('explain').addEventListener('click', (e) => {
    const t = (sel) => e.target.closest(sel);
    let b;
    if ((b = t('[data-use-sentence]'))) {
      const { useSentence: pattern, useRole: role, useLine: line, useWhere: where } = b.dataset;
      if (where === 'unity' && !role) return uUseSentence(pattern, +line);
      if (where === 'unity') { uCommit(); setMode('write'); }
      return useSentence(pattern, role || null, +line);
    }
    if ((b = t('[data-plan]'))) return openStep(+b.dataset.plan);
    if ((b = t('[data-keep-code]'))) return keepNewCode(project.active, +b.dataset.keepCode);
    if ((b = t('[data-pick]'))) return pickCode(+b.dataset.pick, true);
    if ((b = t('[data-go-say]'))) return goToLine(+b.dataset.goSay);
    if ((b = t('[data-term]'))) return openGlossary(b.dataset.term);
    if ((b = t('[data-show-ex]'))) { shownExamples.add(b.dataset.showEx); return renderExplain(); }
    if ((b = t('[data-put-ex]'))) return putExample(b.dataset.putEx);
    if ((b = t('[data-card]'))) return showNote(pane === 'code' ? { pane: 'code', line: codeIdx } : { pane: 'say', line: caretLine() }, b.dataset.card);
    if (!(b = t('[data-tutor]'))) return;
    const r = secResult(activeSec().id);
    const src = pane === 'code' && codeIdx >= 0 && r ? r.lines[codeIdx].src : caretLine();
    if (b.dataset.tutor === 'turn') showExercise(src);
    else if (b.dataset.tutor === 'code') writeAsCode(src);
    else if (b.dataset.tutor === 'say') showSayExercise(caretLine());
  });

  /* Tip balloons, beside the line they're about: a line of the sentences, or a line of the code. */
  document.body.appendChild(tip);   // (fixed to the window, so it can sit by either pane)
  function unmask() {
    $('bandMask').hidden = true;
    pycode.querySelectorAll('.pl.masked').forEach(el => el.classList.remove('masked'));
  }
  function hideTip() { tip.hidden = true; tip.dataset.line = ''; tutorRun.exercise = null; unmask(); }
  function placeTip() {
    if (tip.hidden || tip.dataset.line === '' || mode !== 'write') return;
    const line = +tip.dataset.line;
    let top, bottom, left, box;
    if (tip.dataset.pane === 'code') {
      const el = pycode.children[line];
      if (!el) return;
      const r = el.getBoundingClientRect();
      box = pycode.getBoundingClientRect();
      top = r.top; bottom = r.bottom; left = box.left + 54;
    } else {
      const cw = codewrap.getBoundingClientRect();
      box = $('editor').getBoundingClientRect();
      top = cw.top + PAD_T + line * LH - ta.scrollTop; bottom = top + LH; left = cw.left + PAD_L;
    }
    const h = tip.offsetHeight;
    if (bottom < box.top || top > box.bottom) { tip.style.visibility = 'hidden'; return; }   // its line is scrolled out of sight
    tip.style.visibility = '';
    const flip = bottom + 8 + h > box.bottom - 6 && top - 8 - h > box.top;
    tip.classList.toggle('up', flip);
    tip.style.top = Math.round(flip ? top - 8 - h : bottom + 8) + 'px';
    tip.style.left = Math.round(Math.max(8, Math.min(left, window.innerWidth - tip.offsetWidth - 8))) + 'px';
  }
  function showTip(at, html, kind) {
    tip.innerHTML = html;
    tip.dataset.kind = kind;
    tip.dataset.pane = at.pane;
    tip.dataset.line = at.line;
    tip.hidden = false;
    placeTip();
  }
  function showNote(at, card) {
    const c = cardOf(card);
    if (!c) return;
    tutor.seen[card] = true;
    saveTutor();
    const where = card.startsWith('say:') ? 'In the sentences' : `In ${escHtml(tutorSays(activeSec()))}`;
    showTip(at, `<div class="tip-h"><span class="tip-badge" aria-hidden="true">i</span><span>${where}: ${withCode(c.title)}</span><button type="button" class="tip-x" data-act="close" aria-label="Close">×</button></div>
      <p>${withCode(c.say)}</p><p class="tip-more" hidden>${withCode(c.more)}</p>
      <div class="tip-actions"><button type="button" class="btn small" data-act="more">Why?</button><button type="button" class="btn small primary" data-act="close">Got it</button></div>`, 'note');
  }
  /* Write it yourself: the code a sentence became is covered up, and you write it. */
  function showExercise(li) {
    const sec = activeSec(), lang = tutorLang(sec), r = secResult(sec.id);
    const expected = exerciseFor(sec, li);
    if (!expected || !tutorReady(lang)) return false;
    const lines = r.info[li].py.filter(i => r.lines[i].text.trim());
    tutorRun.exercise = { kind: 'code', expected, lang, cards: cardsForSentence(sec, li) };
    showTip({ pane: 'code', line: lines[0] }, `<div class="tip-h"><span class="tip-badge" aria-hidden="true">✎</span><span>Your turn</span><button type="button" class="tip-x" data-act="close" aria-label="Close">×</button></div>
      <p>Write this sentence as one line of ${escHtml(tutorSays(sec))}:</p>
      <div class="tip-say">${escHtml((sec.text.split('\n')[li] || '').trim())}</div>
      <input class="tip-in" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Your line of ${escHtml(LANG_NAME[lang])}">
      <p class="tip-result" hidden></p>
      <div class="tip-actions"><button type="button" class="btn small" data-act="show">Show me</button><button type="button" class="btn small primary" data-act="check">Check</button></div>`, 'exercise');
    lines.forEach(i => pycode.children[i] && pycode.children[i].classList.add('masked'));
    tip.querySelector('.tip-in').focus();
    return true;
  }
  /* Say it yourself: the sentence is covered up, and you say the code in your own words. Any sentence that
   * makes exactly the same program is right, so other ways of saying it count. */
  function showSayExercise(li) {
    const sec = activeSec(), ex = sayExercise(sec, li);
    if (!ex) return false;
    tutorRun.exercise = { kind: 'say', li, sentence: ex.sentence };
    showTip({ pane: 'say', line: li }, `<div class="tip-h"><span class="tip-badge" aria-hidden="true">✎</span><span>Your turn</span><button type="button" class="tip-x" data-act="close" aria-label="Close">×</button></div>
      <p>Say this ${escHtml(tutorSays(sec))} as a sentence:</p>
      <div class="tip-say tip-code">${ex.code.map(l => hlCode(secLang(sec), l.trim())).join('<br>')}</div>
      <input class="tip-in tip-in-say" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Your sentence">
      <p class="tip-result" hidden></p>
      <div class="tip-actions"><button type="button" class="btn small" data-act="show">Show me</button><button type="button" class="btn small primary" data-act="check">Check</button></div>`, 'exercise');
    const m = $('bandMask');
    m.hidden = false; m.dataset.line = li; placeBand(m, li);
    tip.querySelector('.tip-in').focus();
    return true;
  }
  function checkExercise() {
    const ex = tutorRun.exercise, input = tip.querySelector('.tip-in'), out = tip.querySelector('.tip-result');
    if (!ex || !input.value.trim()) return;
    out.hidden = false;
    if (ex.kind === 'say') {
      const res = saysTheSame(activeSec(), ex.li, input.value);
      if (res.same) {
        out.className = 'tip-result ok';
        out.innerHTML = input.value.trim().replace(/\s+/g, ' ').toLowerCase() === ex.sentence.replace(/\s+/g, ' ').toLowerCase()
          ? '✓ Exactly right.'
          : `✓ Right: that makes exactly the same ${escHtml(tutorSays(activeSec()))}. The line says <code>${escHtml(ex.sentence)}</code>; both work.`;
      } else {
        out.className = 'tip-result no';
        out.innerHTML = res.error ? `Not yet: ${withCode(res.error)}` : 'Not quite: that makes different code. Try again, or press Show me.';
      }
      placeTip();
      return;
    }
    const cpp = ex.lang === 'cpp', name = LANG_NAME[ex.lang];
    const res = cpp ? TUTOR.cppCompare(tutorRun.cpp, ex.expected, input.value) : tutorRun.reader.compare(TUTOR.probe(ex.expected), TUTOR.probe(input.value));
    if (res.same) {
      const learned = [];
      for (const c of ex.cards) { const was = known(c); tutor.practised[c] = (tutor.practised[c] || 0) + 1; if (!was && known(c)) learned.push(cardOf(c).title); }
      saveTutor();
      out.className = 'tip-result ok';
      out.innerHTML = `✓ Exactly right: ${name} reads your line the same way.` + (learned.length ? ` You know this one now: ${learned.map(withCode).join(', ')}. Its notes will step back.` : '');
      renderExplain();
    } else {
      out.className = 'tip-result no';
      const why = !cpp && res.error && (res.error.match(/: (.*)\)\.$/) || [])[1];   // "…can't be read (line 1: invalid syntax)."
      out.innerHTML = res.error ? `${name} can't read that yet${why ? ` (${escHtml(why)})` : ''}. Check the brackets, the quotes and ${cpp ? 'the <code>;</code>' : 'any <code>:</code>'} at the end.`
        : `Not quite: ${name} reads your line differently. Try again, or press Show me.`;
    }
    placeTip();
  }
  const refocus = () => (tip.dataset.pane === 'code' ? pycode.focus() : ta.focus());
  tip.addEventListener('click', (e) => {
    const act = (e.target.closest('[data-act]') || {}).dataset;
    if (!act) return;
    if (act.act === 'close') { refocus(); hideTip(); }
    else if (act.act === 'more') { tip.querySelector('.tip-more').hidden = false; e.target.closest('[data-act]').remove(); placeTip(); }
    else if (act.act === 'check') checkExercise();
    else if (act.act === 'show') {
      const ex = tutorRun.exercise, out = tip.querySelector('.tip-result');
      out.hidden = false; out.className = 'tip-result';
      out.innerHTML = ex.kind === 'say' ? `The sentence is: <code class="tip-code">${escHtml(ex.sentence)}</code>` : `The line is: <code class="tip-code">${hlCode(ex.lang, ex.expected)}</code>`;
      placeTip();
    }
  });
  tip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('tip-in')) { e.preventDefault(); checkExercise(); }
    if (e.key === 'Escape') { e.stopPropagation(); refocus(); hideTip(); }
  });

  /* When writing pauses: a note for a habit met for the first time (a sentence habit in the sentences, the
   * language's own in the code), and in the code, now and then a line to write yourself. */
  function tutorSoon(delay = 1400) {
    clearTimeout(tutorRun.timer);
    if (tutor.on) tutorRun.timer = setTimeout(tutorCheck, delay);
  }
  function tutorCheck() {
    if (!tutor.on || mode !== 'write' || !tip.hidden || document.querySelector('.modal:not([hidden])') || !$('gloss').hidden || !isSentences(activeSec())) return;
    const sec = activeSec();
    if (pane === 'code' && codeIdx >= 0) {
      const lang = tutorLang(sec), r = secResult(sec.id);
      if (!lang || !r || !r.lines[codeIdx]) return;
      if (!tutorReady(lang)) return loadTutorReader(lang);
      const cards = cardsForCode(sec, codeIdx);
      const fresh = cards.find(c => !tutor.seen[c]);
      if (fresh) return showNote({ pane: 'code', line: codeIdx }, fresh);
      const src = r.lines[codeIdx].src, key = sec.id + ':' + (sec.text.split('\n')[src] || '').trim();
      if (src >= 0 && cards.some(c => !known(c)) && !tutorRun.offered.has(key) && Date.now() - tutorRun.lastOffer > 45000 && exerciseFor(sec, src)) {
        tutorRun.offered.add(key);
        tutorRun.lastOffer = Date.now();
        showExercise(src);
      }
      return;
    }
    const lines = ta.value.split('\n');
    let li = caretLine();
    if (!(lines[li] || '').trim() && li > 0) li -= 1;   // just pressed Enter: the line just written
    const fresh = sayCards(sec, lines[li] || '').find(c => !tutor.seen[c]);
    if (fresh) showNote({ pane: 'say', line: li }, fresh);
  }

  /* A known habit, written as the real line: the sentence becomes a python: (or c++:) line, checked to make
   * exactly the same program. */
  function writeAsCode(li) {
    const sec = activeSec(), lang = tutorLang(sec), code = exerciseFor(sec, li), before = secResult(sec.id) && secResult(sec.id).text;
    if (!code || !tutorReady(lang)) return;
    const lines = ta.value.split('\n'), original = lines[li];
    const start = lines.slice(0, li).reduce((n, l) => n + l.length + 1, 0);
    insertText(original.match(/^\s*/)[0] + (lang === 'cpp' ? 'c++: ' : 'python: ') + code, start, start + original.length);
    compile();
    const after = secResult(sec.id);
    const same = after && !after.info[li].errs.length && (lang === 'cpp' ? TUTOR.cppSameProgram(tutorRun.cpp, before, after.text) : tutorRun.reader.compare(before, after.text).same);
    if (!same) {   // (it would lose an import or #include the sentence brought in, or the end of a block): put the sentence back
      insertText(original, start, start + ta.value.split('\n')[li].length);
      tLine(`That line needs something the sentence brings along (${lang === 'cpp' ? 'an #include, or the end of its block' : 'an import'}, say), so it stays a sentence for now.`, 't-sys');
      compile();
      return;
    }
    tLine(`Line ${li + 1} is now written in ${LANG_NAME[lang]}, by you: ${code}`, 't-ok');
    refreshAll();
  }

  /* ------------------------------------------------------------------ */
  /* Full screen: the sentences, the code or the terminal fill the work  */
  /* area; the same button, or Esc, brings the others back.              */
  /* ------------------------------------------------------------------ */

  let maxed = '';
  function setMax(which) {
    maxed = maxed === which ? '' : which;
    if (maxed === 'term') setDock('term', true);
    const ws = document.querySelector('.workspace');
    ws.classList.remove('max-say', 'max-code', 'max-term', 'max-unity');
    if (maxed) ws.classList.add('max-' + maxed);
    document.querySelectorAll('.max-btn').forEach(b => {
      const on = b.dataset.max === maxed;
      b.setAttribute('aria-pressed', String(on));
      b.title = (on ? 'Back to all the windows' : 'Full screen: ' + b.getAttribute('aria-label').replace(/^Full screen: /, '')) + ' (Esc)';
    });
    measure(); syncScroll(); placeTip();
    if (maxed === 'term') termIn.focus(); else if (maxed === 'say') ta.focus(); else if (maxed === 'code') pycode.focus(); else if (maxed === 'unity') { $('uTa').focus(); uSync(); }
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('.max-btn'); if (b) setMax(b.dataset.max); });

  /* ------------------------------------------------------------------ */
  /* Room to work: the help strip and the terminal fold away, and the    */
  /* terminal's height can be dragged. Remembered for next time.         */
  /* ------------------------------------------------------------------ */

  const LAYOUT_KEY = 'intuicode.layout.v1';
  const layout = Object.assign({ help: true, term: true, termRow: 0, webRow: 0, unityRow: 0, dd: false, predict: false, partsBy: 'type', sideView: 'files' }, store.get(LAYOUT_KEY, {}));
  // Project Link and Predictive Mode take turns: predictions popping up while you click around a running page get in the way
  if (layout.link === undefined) layout.link = !layout.predict;
  if (layout.link && layout.predict) layout.predict = false;
  const ROW_PROP = { termRow: '--term-row', webRow: '--web-row', unityRow: '--unity-row' };   // the terminal's height in each layout
  function applyLayout() {
    const work = $('work'), hb = $('btnHelpDock'), tb = $('btnTermDock');
    $('explainWrap').classList.toggle('shut', !layout.help);
    hb.setAttribute('aria-expanded', String(layout.help));
    hb.querySelector('span').textContent = layout.help ? 'Hide help' : 'Show help';
    hb.title = layout.help ? 'Hide the help under the windows, for more room' : 'Show the help: what the line you\'re on says, and what it makes';
    work.classList.toggle('term-shut', !layout.term);
    tb.setAttribute('aria-expanded', String(layout.term));
    tb.title = layout.term ? 'Hide the terminal, for more room' : 'Show the terminal';
    tb.setAttribute('aria-label', tb.title);
    for (const [key, prop] of Object.entries(ROW_PROP)) {
      if (layout[key]) work.style.setProperty(prop, layout[key] + 'px'); else work.style.removeProperty(prop);
    }
    measure(); syncScroll(); placeTip();
  }
  function setDock(which, open) {
    if (which === 'term' && open) $('tabTerm').classList.remove('unread');
    if (layout[which] === open) return;
    layout[which] = open;
    store.set(LAYOUT_KEY, layout);
    applyLayout();
  }
  $('btnHelpDock').addEventListener('click', () => setDock('help', !layout.help));
  $('btnTermDock').addEventListener('click', () => setDock('term', !layout.term));

  const grip = $('termGrip');
  const rowKey = () => ($('work').classList.contains('web') ? 'webRow' : $('work').classList.contains('unity') ? 'unityRow' : 'termRow');
  function setTermHeight(h) {
    const r = $('work').getBoundingClientRect(), key = rowKey();
    layout[key] = Math.round(Math.min(Math.max(h, 90), Math.max(r.height - 170, 90)));
    $('work').style.setProperty(ROW_PROP[key], layout[key] + 'px');
    placeTip();
  }
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing');   // the preview frame mustn't swallow the drag
    const move = (ev) => setTermHeight($('work').getBoundingClientRect().bottom - ev.clientY);
    const up = () => {
      document.body.classList.remove('resizing');
      grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
      store.set(LAYOUT_KEY, layout); measure(); syncScroll();
    };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  });
  grip.addEventListener('dblclick', () => { layout[rowKey()] = 0; store.set(LAYOUT_KEY, layout); applyLayout(); });
  grip.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    setTermHeight($('term').getBoundingClientRect().height + (e.key === 'ArrowUp' ? 24 : -24));
    store.set(LAYOUT_KEY, layout);
  });

  /* ------------------------------------------------------------------ */
  /* Drop down: under every value in the sentences (a number, a colour,  */
  /* a CSS word) a small box. − and + nudge it; ▾ lists the values       */
  /* usually chosen in that spot, each said in plain words. The lines    */
  /* grow taller to make room, so nothing covers the text.               */
  /* ------------------------------------------------------------------ */

  const VALUES = window.IntuiValues;
  const ddLayer = $('ddLayer'), ddMenu = $('ddMenu');
  let ddVals = [], ddHold = null, ddOpen = null;
  const ddInfo = new Map();   // "lang|line|start" -> what the value is (cleared when it grows)
  const ddOn = () => !!(layout.dd && VALUES && mode === 'write' && isSentences(activeSec()));
  const lineStartOf = (line) => { const ls = ta.value.split('\n'); let p = 0; for (let i = 0; i < line && i < ls.length; i++) p += ls[i].length + 1; return p; };
  function infoOf(lang, text, v) {
    const k = `${lang}|${text}|${v.start}`;
    if (!ddInfo.has(k)) { if (ddInfo.size > 3000) ddInfo.clear(); try { ddInfo.set(k, VALUES.explain(text, v, lang)); } catch (e) { console.error(e); ddInfo.set(k, null); } }
    return ddInfo.get(k);
  }
  const stepWords = (info) => (info && info.step === 'colour' ? ['Darker', 'Lighter'] : info && info.step === 'cycle' ? ['The one before', 'The next one'] : ['Less', 'More']);

  function applyDropDown() {
    const on = !!layout.dd;
    $('btnDropDown').setAttribute('aria-pressed', String(on));
    $('editor').classList.toggle('dd', on);
    closeDdMenu();
    measure(); syncScroll();
  }
  function setDropDown(on) { layout.dd = on; store.set(LAYOUT_KEY, layout); applyDropDown(); ta.focus({ preventScroll: true }); }
  $('btnDropDown').addEventListener('click', () => setDropDown(!layout.dd));

  /* Text offsets in the highlighted copy of the sentences (its text is the same), for exact positions. */
  function hlRanges() {
    const nodes = [], walk = document.createTreeWalker(hl, NodeFilter.SHOW_TEXT);
    let pos = 0;
    for (let n; (n = walk.nextNode());) { nodes.push({ pos, n }); pos += n.data.length; }
    const find = (off, atEnd) => {
      let lo = 0, hi = nodes.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (nodes[mid].pos < off || (!atEnd && nodes[mid].pos === off)) lo = mid; else hi = mid - 1; }
      return nodes[lo];
    };
    return (from, to) => {
      if (!nodes.length) return null;
      const a = find(from, false), b = find(to, true), r = document.createRange();
      r.setStart(a.n, Math.min(from - a.pos, a.n.data.length)); r.setEnd(b.n, Math.min(to - b.pos, b.n.data.length));
      return r.getBoundingClientRect();
    };
  }

  /* The boxes, for the lines in view. */
  function renderValues() {
    if (!ddOn()) { if (ddLayer.firstChild) ddLayer.textContent = ''; ddVals = []; return; }
    const sec = activeSec(), lang = glossLang(sec), lines = ta.value.split('\n'), base = codewrap.getBoundingClientRect();
    const first = Math.max(0, Math.floor((ta.scrollTop - PAD_T) / LH) - 1), last = Math.min(lines.length - 1, Math.ceil((ta.scrollTop + ta.clientHeight) / LH) + 1);
    const mask = $('bandMask'), masked = mask.hidden ? -1 : +mask.dataset.line;   // never give away a tutor exercise
    const rectOf = hlRanges();
    const html = [];
    ddVals = [];
    let off = lineStartOf(first);
    for (let li = first; li <= last; li++) {
      const text = lines[li];
      if (li !== masked && /\d|#|[a-z]/i.test(text)) {
        let right = -Infinity;
        VALUES.scan(text, lang).forEach((v, idx) => {
          const r = rectOf(off + v.start, off + v.end);
          if (!r || !r.width) return;
          const info = infoOf(lang, text, v), k = ddVals.push({ line: li, idx }) - 1;
          const x = r.left - base.left, y = r.top - base.top;
          const can = !!(info && info.step != null), colour = info && info.colour && VALUES.toHex(v.text);
          const w = colour ? 54 : 45, left = Math.max(Math.max(x + r.width / 2 - w / 2, right + 3), 2);
          right = left + w;
          const [less, more] = stepWords(info), title = info ? info.title : 'A value';
          html.push(`<div class="dd-val" style="left:${(x - 2).toFixed(1)}px;top:${(y - 1).toFixed(1)}px;width:${(r.width + 4).toFixed(1)}px;height:${(r.height + 2).toFixed(1)}px"></div>`
            + `<div class="dd-ctl" data-k="${k}" style="left:${left.toFixed(1)}px;top:${(y + r.height + 1).toFixed(1)}px">`
            + (colour ? `<span class="dd-chip" style="background:${colour}"></span>` : '')
            + `<button type="button" tabindex="-1" class="dd-less" ${can ? '' : 'disabled '}title="${escHtml(less + ': ' + title)}" aria-label="${escHtml(less)}">−</button>`
            + `<button type="button" tabindex="-1" class="dd-open" title="${escHtml(title + ': the usual values')}" aria-label="${escHtml(title + ': the usual values')}"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
            + `<button type="button" tabindex="-1" class="dd-more" ${can ? '' : 'disabled '}title="${escHtml(more + ': ' + title)}" aria-label="${escHtml(more)}">+</button></div>`);
        });
      }
      off += text.length + 1;
    }
    ddLayer.innerHTML = html.join('');
    if (ddOpen) ddLayer.querySelectorAll('.dd-ctl').forEach(c => { const d = ddVals[+c.dataset.k]; c.classList.toggle('open', d.line === ddOpen.line && d.idx === ddOpen.idx); });
  }

  /* The value now at (line, idx), and the sentence it's in. */
  function valueAt(line, idx) {
    const text = ta.value.split('\n')[line];
    if (text == null) return null;
    const lang = glossLang(activeSec()), v = VALUES.scan(text, lang)[idx];
    return v ? { text, lang, v, info: infoOf(lang, text, v), at: lineStartOf(line) + v.start } : null;
  }
  /* Put a new value in, as typing would (Ctrl+Z takes it back). */
  function putValue(line, idx, next) {
    const cur = valueAt(line, idx);
    if (!cur || next == null || next === cur.v.text) return;
    insertText(String(next), cur.at, cur.at + cur.v.text.length);
    typingLine = -1;   // not mid-typing: say straight away if the new value is a problem
    afterCaretMove(true);
  }
  function nudge(line, idx, dir) {
    const cur = valueAt(line, idx);
    if (cur && cur.info && cur.info.step != null) putValue(line, idx, VALUES.step(cur.text, cur.v, dir, cur.info));
  }
  function holdStop() { clearTimeout(ddHold); ddHold = null; }
  ddLayer.addEventListener('mousedown', (e) => e.preventDefault());   // the sentences keep the keyboard
  ddLayer.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button'), c = b && b.closest('.dd-ctl');
    if (!b || b.disabled || !c) return;
    e.preventDefault();
    const { line, idx } = ddVals[+c.dataset.k];
    if (b.classList.contains('dd-open')) return ddOpen && ddOpen.line === line && ddOpen.idx === idx ? closeDdMenu() : openDdMenu(line, idx);
    closeDdMenu();
    const dir = b.classList.contains('dd-more') ? 1 : -1;
    nudge(line, idx, dir);
    holdStop();   // held down: again and again, until it's let go
    ddHold = setTimeout(function again() { nudge(line, idx, dir); ddHold = setTimeout(again, 70); }, 420);
  });
  document.addEventListener('pointerup', holdStop);
  document.addEventListener('pointercancel', holdStop);
  window.addEventListener('blur', holdStop);

  /* ▾: the usual values for this spot. */
  function openDdMenu(line, idx) {
    const cur = valueAt(line, idx);
    if (!cur || !cur.info) return closeDdMenu();
    const { v, info } = cur, opts = info.options || [];
    ddOpen = { line, idx, sel: info.current >= 0 ? info.current : 0, colour: !!info.colour, opts };
    const row = (o, i) => `<li role="option" id="ddo${i}" data-o="${i}" aria-selected="${i === ddOpen.sel}"${i === info.current ? ' class="now"' : ''}><span class="dd-v">${escHtml(o.text)}</span><span class="dd-l">${escHtml(o.label || '')}</span></li>`;
    const sw = (o, i) => `<button type="button" role="option" id="ddo${i}" class="dd-swatch" data-o="${i}" aria-selected="${i === ddOpen.sel}" style="background:${escHtml(o.swatch || VALUES.toHex(o.text) || o.text)}" title="${escHtml(o.text + (o.label ? ' · ' + o.label : ''))}" aria-label="${escHtml(o.text + (o.label ? ', ' + o.label : ''))}"></button>`;
    ddMenu.innerHTML = `<div class="dd-h"><b>${escHtml(info.title)}</b><code>${escHtml(v.text)}</code></div>
      ${info.about ? `<p class="dd-about">${withCode(info.about)}</p>` : ''}
      ${info.colour
        ? `<div class="dd-sw" role="listbox" aria-label="Colours">${opts.map(sw).join('')}</div><p class="dd-swname" id="ddSwName"></p>
           <label class="dd-any">Any colour: <input type="color" id="ddColour" value="${escHtml(VALUES.toHex(v.text) || '#000000')}"></label>`
        : `<ul class="dd-list" role="listbox" aria-label="${escHtml(info.title)}">${opts.map(row).join('')}</ul>`}
      <p class="dd-foot">${info.step != null ? '− and + nudge it. ' : ''}<kbd>↑</kbd> <kbd>↓</kbd> then <kbd>Enter</kbd> to choose, <kbd>Esc</kbd> to close.</p>`;
    ddMenu.hidden = false;
    markDd();
    // under the value (or above it, if there's no room below), kept on screen
    const r = hlRanges()(cur.at, cur.at + v.text.length), m = ddMenu.getBoundingClientRect();
    let top = r.bottom + 18;
    if (top + m.height > innerHeight - 8) top = Math.max(8, r.top - m.height - 6);
    ddMenu.style.left = Math.max(8, Math.min(r.left - 12, innerWidth - m.width - 8)) + 'px';
    ddMenu.style.top = top + 'px';
    ddMenu.focus({ preventScroll: true });
    renderValues();
  }
  function markDd() {
    ddMenu.querySelectorAll('[data-o]').forEach(el => el.setAttribute('aria-selected', String(+el.dataset.o === ddOpen.sel)));
    const el = $('ddo' + ddOpen.sel);
    if (el) { el.scrollIntoView({ block: 'nearest' }); ddMenu.setAttribute('aria-activedescendant', el.id); }
    const o = ddOpen.opts[ddOpen.sel], name = $('ddSwName');
    if (name) name.textContent = o ? o.text + (o.label ? ' · ' + o.label : '') : '';
  }
  function closeDdMenu(back) {
    if (ddMenu.hidden && !ddOpen) return;
    ddMenu.hidden = true; ddOpen = null;
    ddLayer.querySelectorAll('.dd-ctl.open').forEach(c => c.classList.remove('open'));
    if (back) ta.focus({ preventScroll: true });
  }
  function chooseDd(i) {
    const o = ddOpen && ddOpen.opts[i];
    if (!o) return;
    const { line, idx } = ddOpen;
    closeDdMenu(true);
    putValue(line, idx, o.text);
  }
  ddMenu.addEventListener('click', (e) => { const o = e.target.closest('[data-o]'); if (o) chooseDd(+o.dataset.o); });
  ddMenu.addEventListener('mouseover', (e) => { const o = e.target.closest('[data-o]'); if (o && ddOpen && +o.dataset.o !== ddOpen.sel) { ddOpen.sel = +o.dataset.o; markDd(); } });
  ddMenu.addEventListener('change', (e) => {
    if (e.target.id !== 'ddColour' || !ddOpen) return;
    const { line, idx } = ddOpen, cur = valueAt(line, idx), hex = e.target.value;
    closeDdMenu(true);
    putValue(line, idx, cur && /^#[0-9A-F]+$/.test(cur.v.text) ? hex.toUpperCase() : hex);
  });
  ddMenu.addEventListener('keydown', (e) => {
    if (!ddOpen) return;
    const n = ddOpen.opts.length, across = ddOpen.colour ? 8 : 1;
    const go = { ArrowDown: across, ArrowUp: -across, ArrowRight: ddOpen.colour ? 1 : 0, ArrowLeft: ddOpen.colour ? -1 : 0 }[e.key];
    if (go) { e.preventDefault(); ddOpen.sel = Math.min(n - 1, Math.max(0, ddOpen.sel + go)); markDd(); return; }
    if (e.key === 'Enter' && e.target.id !== 'ddColour') { e.preventDefault(); chooseDd(ddOpen.sel); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDdMenu(true); return; }
    if (e.key === 'Tab') closeDdMenu(true);
  });
  document.addEventListener('pointerdown', (e) => { if (!ddMenu.hidden && !ddMenu.contains(e.target) && !e.target.closest('.dd-ctl')) closeDdMenu(); });
  /* Alt+↓ in the sentences: the list for the value at the cursor (or the nearest on its line). */
  function openDdAtCaret() {
    const line = caretLine(), text = ta.value.split('\n')[line] || '', col = ta.selectionStart - lineStartOf(line);
    const vals = VALUES.scan(text, glossLang(activeSec()));
    if (!vals.length) return false;
    let idx = vals.findIndex(v => col >= v.start && col <= v.end);
    if (idx < 0) idx = vals.findIndex(v => v.start > col);
    if (idx < 0) idx = vals.length - 1;
    openDdMenu(line, idx);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Ctrl+H: the words in a selection (or the section the cursor is in),  */
  /* explained, for the side you're working in. In the code, its terms;  */
  /* in the sentences, only the words that aren't everyday English, and  */
  /* when there are none, the shapes those sentences follow instead.     */
  /* ------------------------------------------------------------------ */

  const gloss = $('gloss');
  const glossState = { lang: '', entries: [], view: null };
  /* A line, and if it opens a block, the lines indented under it. */
  function sectionAround(lines, li) {
    const ind = (l) => l.match(/^\s*/)[0].length;
    const base = ind(lines[li] || '');
    let end = li;
    while (end + 1 < lines.length && (!lines[end + 1].trim() || ind(lines[end + 1]) > base)) end++;
    while (end > li && !lines[end].trim()) end--;
    return lines.slice(li, end + 1).join('\n');
  }
  function openGlossary(term) {
    if (mode !== 'write') return;
    const sec = activeSec(), r = secResult(sec.id);
    const code = pane === 'code' && codeIdx >= 0 && r;
    let text;
    if (code) {
      const sel = window.getSelection();
      const picked = sel && !sel.isCollapsed && pycode.contains(sel.anchorNode) ? sel.toString() : '';
      text = picked.trim() ? picked : sectionAround(r.lines.map(o => o.text), codeIdx);
    } else {
      const picked = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      text = picked.trim() ? picked : sectionAround(ta.value.split('\n'), caretLine());
    }
    glossState.lang = code ? glossLang(sec) : 'say';
    glossState.side = code ? 'code' : 'say';
    glossState.text = text;
    glossState.entries = code ? GLOSS.find(glossState.lang, text) : GLOSS.find('say', text, { pack: packOf(sec) });
    if (term) {
      const e = GLOSS.get(glossState.lang, term) || GLOSS.get(glossLang(sec), term);
      if (e) glossState.entries = [e, ...glossState.entries.filter(x => x !== e)];
    }
    gloss.hidden = false;
    renderGlossary();
    placeGlossary();
    requestAnimationFrame(placeGlossary);
  }
  function closeGlossary() { gloss.hidden = true; (glossState.side === 'code' ? pycode : ta).focus(); }
  const glossEntry = (e) => `<article class="gl-entry" data-t="${escHtml(e.t)}">
      <h4><code>${escHtml(e.t)}</code><span class="gl-kind">${escHtml(e.k || '')}</span></h4>
      <p>${withCode(e.s)}</p>
      ${e.eg ? `<pre class="gl-eg">${e.lang === 'say' ? escHtml(e.eg) : hlCode(e.lang === 'arduino' ? 'cpp' : e.lang, e.eg)}</pre>` : ''}
      ${GLOSS.related(e).length ? `<p class="gl-see"><span class="dim">Related</span> ${GLOSS.related(e).map(x => `<button type="button" class="gl-chip" data-see="${escHtml(x.t)}" data-lang="${escHtml(x.lang)}">${escHtml(x.t)}</button>`).join('')}</p>` : ''}
    </article>`;
  /* The sentence shapes behind some sentences: the templates they fit, and others in the same family. */
  function shapesHtml(sec, text) {
    const PK = packFor(sec);
    const fits = [...new Set(text.split('\n').map(l => matchShape(sec, l)).filter(Boolean).map(m => m.t))];
    const groups = [...new Set(fits.map(t => t.group))];
    const pool = PK.templates.filter(PK.filter);
    const shown = groups.length ? groups : [...new Set(pool.map(t => t.group))].slice(0, 2);
    return shown.map(g => {
      const list = pool.filter(t => t.group === g);
      return `<section class="gl-shapes"><h4>${escHtml(g)}</h4><ul>${list.map(t => `<li class="${fits.includes(t) ? 'here' : ''}"><code class="gl-pat">${escHtml(t.pattern).replace(/‹[^›]*›|…/g, (p) => `<span class="ex-slot">${p}</span>`)}</code><code class="gl-py">${hlCode(secLang(sec), t.py)}</code>${t.tip ? `<span class="gl-tip">${withCode(t.tip)}</span>` : ''}</li>`).join('')}</ul></section>`;
    }).join('');
  }
  function renderGlossary(search) {
    const sec = activeSec(), side = glossState.side;
    const list = search != null
      ? GLOSS.all(glossState.lang).filter(e => (e.t + ' ' + (e.m || []).join(' ')).toLowerCase().includes(search.toLowerCase())).slice(0, 30)
      : glossState.entries;
    const title = side === 'code' ? `Terms · ${tutorSays(sec)}` : 'Words · Sentences';
    $('glossTitle').textContent = title;
    let body;
    if (search != null) body = list.length ? list.map(glossEntry).join('') : `<p class="gl-none">Nothing called "${escHtml(search)}" in the ${side === 'code' ? escHtml(tutorSays(sec)) : 'sentence'} glossary.</p>`;
    else if (side === 'code') body = list.length ? list.map(glossEntry).join('') : '<p class="gl-none">Nothing here needs defining: it\'s your own names and values. Look a term up above.</p>';
    else body = (list.length ? list.map(glossEntry).join('') + `<h3 class="gl-h">The shapes here</h3>` : `<p class="gl-lead">These are everyday words, so here are the shapes the sentences follow, with others in the same family. The marked ones are used here.</p>`) + shapesHtml(sec, glossState.text);
    $('glossBody').innerHTML = body;
    $('glossBody').scrollTop = 0;
  }
  /* Beside the side it's about, near the top. */
  function placeGlossary() {
    const host = (glossState.side === 'code' ? document.querySelector('.pane-py') : document.querySelector('.pane-say')).getBoundingClientRect();
    const w = gloss.offsetWidth || 460;
    const left = glossState.side === 'code' ? host.left - w - 10 : host.right + 10;
    gloss.style.left = Math.round(Math.max(8, Math.min(left, window.innerWidth - w - 8))) + 'px';
    gloss.style.top = Math.round(Math.max(56, host.top + 8)) + 'px';
  }
  gloss.addEventListener('click', (e) => {
    if (e.target.closest('#glossClose')) return closeGlossary();
    const chip = e.target.closest('[data-see]');
    if (chip) {
      const e2 = GLOSS.get(chip.dataset.lang, chip.dataset.see);
      if (!e2) return;
      $('glossSearch').value = '';
      const at = glossState.entries.indexOf(e2);
      if (at < 0) glossState.entries.splice(glossState.entries.indexOf(glossState.entries.find(x => x.t === chip.closest('.gl-entry').dataset.t)) + 1, 0, e2);
      renderGlossary();
      const el = [...$('glossBody').querySelectorAll('.gl-entry')].find(x => x.dataset.t === e2.t);
      if (el) { el.scrollIntoView({ block: 'nearest' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 900); }
    }
  });
  $('glossSearch').addEventListener('input', (e) => renderGlossary(e.target.value.trim() ? e.target.value.trim() : undefined));
  gloss.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeGlossary(); } });
  // the window can be moved by its title
  $('glossHead').addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = gloss.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = (m) => { gloss.style.left = Math.max(0, Math.min(m.clientX - dx, window.innerWidth - 60)) + 'px'; gloss.style.top = Math.max(0, Math.min(m.clientY - dy, window.innerHeight - 40)) + 'px'; };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });

  /* ------------------------------------------------------------------ */
  /* Terminal and running                                                */
  /* ------------------------------------------------------------------ */

  const termLog = $('termLog'), termIn = $('termIn'), termBody = $('termBody'), termPrompt = $('termPrompt');
  let session = null, asking = false;
  const history = []; let histPos = 0;

  function tWrite(text, cls) {
    if (!text) return;
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text;
    termLog.appendChild(span);
    termBody.scrollTop = termBody.scrollHeight;
    if (!layout.term) $('tabTerm').classList.add('unread');   // folded away: a dot says there's something new
  }
  function tLine(text, cls) {
    const last = termLog.lastChild;
    if (last && !/\n$/.test(last.textContent)) tWrite('\n');
    tWrite((cls === 't-err' || cls === 't-ok' || cls === 't-sys' ? text.replace(/`/g, '') : text) + '\n', cls);
  }
  function tLink(label, sec, line) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 't-link'; b.textContent = label;
    b.addEventListener('click', () => openSection(sec, line));
    termLog.appendChild(b); tWrite('\n');
  }
  /* A problem found while running: a link to its sentence, which is also marked in the editor
   * (`keepFirst`: only if nothing is marked yet, for a list of compiler errors). */
  function pointAt(secId, line, msg, keepFirst) {
    const sec = project.sections.find(s => s.id === secId);
    if (!sec) return;
    if (!keepFirst || !runtimeMark) runtimeMark = { sec: secId, line, msg };
    tLink(`  Go to ${metaOf(sec).title}, line ${line + 1}: ${(sec.text.split('\n')[line] || '').trim()}`, secId, line);
    if (secId === project.active) { renderOverlay(); renderExplain(); }
  }
  function setStatus(text, cls) { const el = $('pyStatus'); el.textContent = text; el.className = 'py-status' + (cls ? ' ' + cls : ''); }
  function setAsking(on) {
    asking = on;
    termPrompt.textContent = on ? 'answer ›' : '❯';
    termPrompt.classList.toggle('asking', on);
    termIn.classList.toggle('asking', on);
    termIn.placeholder = on ? 'type your answer and press Enter' : 'type help, run, or any sentence or Python to try it';
    if (on) { setDock('term', true); termIn.focus({ preventScroll: true }); }
  }

  async function ensurePython() {
    if (Runner.ready) return true;
    setStatus('Loading Python…');
    try {
      const v = await Runner.ensure((s) => setStatus(s));
      setStatus(desk.python ? `Python ${desk.python[1]} (this computer)` : `Python ${v} ready`, 'ready');
      return true;
    } catch (e) {
      setStatus('Python unavailable', 'bad');
      tLine(`Python couldn't start here (${e.message}). Writing sentences still works: copy the code and run it with Python on your computer.`, 't-err');
      return false;
    }
  }

  function friendly(type, msg) {
    if (type === 'NameError') { const m = msg.match(/name '(\w+)'/); return `Python doesn't know ${m ? '`' + m[1] + '`' : 'a name'} at this point. Set it before this line runs, or check the spelling.`; }
    if (type === 'UnboundLocalError') return 'A tool used a name before setting it inside the tool. Pass the value in as an input instead.';
    if (type === 'ModuleNotFoundError') {
      const m = msg.match(/'([\w.]+)'/), pkg = m ? m[1].split('.')[0] : '…';
      // the desktop app running the computer's own Python
      if (desk.on && desk.python) return `This program needs the ${m ? m[1] : ''} toolkit, which isn't installed for this Python. ${desk.linux && !desk.venv ? `On Linux, give the project a Python of its own first: type $ python3 -m venv .venv, then $ pip install ${pkg}. Run uses it after that.` : `Type $ pip install ${pkg} to install it.`}`;
      return `This program needs the ${m ? m[1] : ''} toolkit, which isn't available in the browser. Run it on your computer after installing it (pip install ${pkg}).`;
    }
    if (type === 'TypeError') {
      if (/concatenate str|for \+: '(int|float)' and 'str'|for \+: 'str' and '(int|float)'/.test(msg)) return 'Text and a number were joined with "plus". Show them separated by "and", or turn the number into text with "as text".';
      if (/not supported between instances of '(str|int|float)' and '(str|int|float)'/.test(msg)) return 'Text was compared with a number. Answers from ask are text: use "ask for a number" instead.';
      if (/positional argument|required positional/.test(msg)) return 'A tool was given the wrong number of inputs.';
      if (/not callable/.test(msg)) return 'Something that isn\'t a tool was run like a tool.';
      if (/not subscriptable/.test(msg)) return 'Asked for "item … of" something that isn\'t a list or dictionary.';
      if (/can't multiply sequence/.test(msg)) return 'Text was multiplied by text. One side needs to be a number: try "as number".';
    }
    if (type === 'ValueError' && /invalid literal for int|could not convert string to float/.test(msg)) return 'Text that isn\'t a number was turned into a number. For example, someone typed letters when a number was asked for.';
    if (type === 'ValueError' && /list.remove/.test(msg)) return 'Tried to remove something that isn\'t in the list. Check with "if … is in …" first.';
    if (type === 'ZeroDivisionError') return 'The program divided by zero, which has no answer.';
    if (type === 'IndexError') return 'The program asked for a position the list doesn\'t have. Positions start at 0, so a list of 3 items has positions 0, 1 and 2.';
    if (type === 'KeyError') return 'That key isn\'t in the dictionary yet. Set it first.';
    if (type === 'AttributeError' && /has no attribute '(append|remove|sort)'/.test(msg)) return 'A list action was used on something that isn\'t a list.';
    if (type === 'RecursionError') return 'A tool kept running itself and never stopped.';
    if (type === 'SyntaxError') return 'Python couldn\'t read this line. If it is raw Python, check brackets, colons and quotes.';
    return '';
  }

  function locate(file, pyLine) {
    const sec = project.sections.find(s => s.lang === 'python' && (s.path === file || s.path.split('/').pop() === file));
    if (!sec || !pyLine) return null;
    const o = secResult(sec.id) && secResult(sec.id).lines[pyLine - 1];
    if (!o) return { sec: sec.id, line: null };
    return { sec: sec.id, line: o.src >= 0 ? o.src : null };
  }

  async function run() {
    setDock('term', true);   // Run shows what happens, even when the terminal was folded away
    // Run starts the project's start file, in its own way: a page in the preview, a program, a sketch on a board
    const st = startSec();
    // only problems in the files that run stop a run (a half-written note or page doesn't stop the Python)
    const blocking = (langs) => { typingLine = -1; activeSec().text = ta.value; refreshAll(); closeAc(); renderProblems(); return project.sections.filter(s => langs.includes(s.lang)).reduce((n, s) => n + issues(s, 'errs'), 0); };
    if (WEB_ROLE[st.lang]) return runWebsite(true);
    if (!isSentences(st)) {
      tLine(`This project starts at ${st.path} (${langName(st.lang)}), which IntuaCode doesn't run. To run another file, open its ⋯ menu in the Project list and choose "Start here".` + (writeOf(st) === 'code' && desk.on ? ' Its own tools can run it from the terminal, after $.' : ''), 't-sys');
      return;
    }
    if (st.lang === 'cpp' || st.lang === 'arduino') {
      if (blocking([st.lang])) { tLine('Can\'t run yet: fix the problems first (see Problems on the left).', 't-err'); return; }
      if (st.lang === 'arduino') {
        if (desk.on && desk.arduino) return runDesktopArduino();
        tLine(desk.on
          ? (desk.linux
            ? 'To check a sketch and put it on a board, IntuaCode uses arduino-cli, which wasn\'t found. Install arduino-cli itself (its install script puts it in ~/bin), or unpack the Arduino IDE 2 .zip into your home folder (the IDE\'s AppImage keeps its arduino-cli inside, out of reach), then restart IntuaCode. Until then, copy the code on the right into the Arduino IDE.'
            : 'To check a sketch and put it on a board, IntuaCode uses arduino-cli, which wasn\'t found. Install the Arduino IDE 2 (it includes arduino-cli) or arduino-cli itself, then restart IntuaCode. Until then, copy the code on the right into the Arduino IDE.')
          : 'A sketch runs on an Arduino board, not in the browser. In the IntuaCode desktop app (with the Arduino IDE or arduino-cli installed), Run checks the sketch and uploads it to a board plugged in by USB. Or copy the code on the right into the Arduino IDE.', 't-sys');
        return;
      }
      if (desk.on && desk.cpp) return runDesktopCpp();
      tLine(desk.on ? (desk.linux ? 'No C++ compiler was found on this computer. Install g++: type $ sudo apt install g++ (Ubuntu, Debian, Mint), $ sudo dnf install gcc-c++ (Fedora) or $ sudo pacman -S gcc (Arch). Then restart IntuaCode.' : 'No C++ compiler was found on this computer. On Windows, install Visual Studio Build Tools (free, with "Desktop development with C++"); on a Mac, run xcode-select --install; on Linux, install g++. Then restart IntuaCode.') : 'C++ has to be compiled into a program before it runs, and a browser has no C++ compiler. Use the IntuaCode desktop app (on Windows it uses Visual Studio\'s compiler; elsewhere g++ or clang++), or copy main.cpp into your own C++ setup.', 't-sys');
      return;
    }
    const errs = blocking(['python']);
    if (errs) {
      tLine(`Can't run yet: ${errs} problem${errs > 1 ? 's' : ''} to fix first.`, 't-err');
      for (const s of project.sections.filter(x => x.lang === 'python')) {
        secResult(s.id).info.forEach((inf, i) => inf.errs.forEach(e => tLink(`${metaOf(s).title}, line ${i + 1}: ${e.replace(/`/g, '')}`, s.id, i)));
      }
      return;
    }
    if (desk.on && desk.python) return runDesktopPython();
    if (!(await ensurePython())) return;
    // the Python files, and the notes and data beside them (so the program can open data.csv)
    const files = {}, py = project.sections.filter(s => s.lang === 'python');
    for (const s of project.sections) if (s.lang === 'python' || writeOf(s) === 'text') files[s.path] = codeOf(s);
    Runner.writeFiles(files);
    tLine(`▶ Running ${project.name} (${st.path}${py.length > 1 ? ' + ' + py.filter(s => s !== st).map(s => s.path).join(', ') : ''})`, 't-sys');
    session = { answers: [], shown: 0, seed: Math.floor(Math.random() * 1e9), modules: py.map(s => s.file), start: st.path };
    step();
  }

  function step() {
    let r;
    try { r = Runner.run(session.answers, session.seed, session.modules, session.start); }
    catch (e) { tLine('The Python engine hit a problem: ' + e.message, 't-err'); setAsking(false); return; }
    tWrite(r.out.slice(session.shown));
    session.shown = r.out.length;
    if (r.status === 'input') { setAsking(true); return; }
    setAsking(false);
    session.done = true;
    if (r.status === 'done') tLine('✓ Finished. Values from the run are now available here: try typing a name.', 't-ok');
    else if (r.status === 'exit') tLine('■ The program stopped itself.', 't-sys');
    else if (r.status === 'toolong') tLine('■ Stopped after 2 million steps. This is usually a loop that never ends: check that the while condition can become false, or add "stop the loop".', 't-err');
    else if (r.status === 'error') {
      const where = locate(r.file, r.line);
      const f = friendly(r.type, r.msg);
      tLine(`✕ ${f || 'The program stopped with an error.'}`, 't-err');
      tLine(`  Python said: ${r.type}: ${r.msg}`, 't-sys');
      if (where && where.line != null) pointAt(where.sec, where.line, (f || 'The program stopped here.') + ` (Python said: ${r.type}: ${r.msg})`);
    }
  }

  /* ---------- Website preview ---------- */

  // Runs inside the preview: forwards console messages and errors, handles Pick, and stands in for
  // the browser's storage. The preview is sandboxed into an origin of its own, where localStorage
  // isn't available, so the page's saved values are kept by the editor (per project) and handed back
  // each time the preview is rebuilt.
  const PAGE_STORE_KEY = 'intuicode.pagestorage.v1';
  const previewHelper = () => `(() => {
    const send = (m) => parent.postMessage(Object.assign({ intuicode: true }, m), '*');
    const saved = ${JSON.stringify(store.get(PAGE_STORE_KEY, {})[project.name] || {}).replace(/</g, '\\u003c')};
    const storage = (data, changed) => {
      const has = (k) => Object.prototype.hasOwnProperty.call(data, k);
      return {
        getItem: (k) => (has(String(k)) ? data[String(k)] : null),
        setItem: (k, v) => { data[String(k)] = String(v); changed(); },
        removeItem: (k) => { delete data[String(k)]; changed(); },
        clear: () => { Object.keys(data).forEach(k => delete data[k]); changed(); },
        key: (i) => (i < Object.keys(data).length ? Object.keys(data)[i] : null),
        get length() { return Object.keys(data).length; },
      };
    };
    let usable = true;
    try { window.localStorage.getItem('x'); } catch (e) { usable = false; }
    if (!usable) {
      Object.defineProperty(window, 'localStorage', { value: storage(saved, () => send({ type: 'storage', data: saved })), configurable: true });
      Object.defineProperty(window, 'sessionStorage', { value: storage({}, () => {}), configurable: true });
    }
    const text = (a) => a.map(x => { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch (e) { return String(x); } }).join(' ');
    for (const level of ['log', 'info', 'warn', 'error']) { const orig = console[level]; console[level] = (...a) => { send({ type: 'log', level, text: text(a) }); orig.apply(console, a); }; }
    window.addEventListener('error', (e) => send({ type: 'error', text: e.message, line: e.lineno }));
    window.addEventListener('unhandledrejection', (e) => send({ type: 'error', text: String(e.reason && e.reason.message || e.reason) }));
    let picking = false, hover = null;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #e2b034;background:rgba(226,176,52,.15);z-index:2147483647;display:none;border-radius:3px';
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(box));
    window.addEventListener('message', (e) => { if (e.data && e.data.intuicodePick !== undefined) { picking = e.data.intuicodePick; box.style.display = 'none'; document.body.style.cursor = picking ? 'crosshair' : ''; } });
    document.addEventListener('mousemove', (e) => {
      if (!picking) return;
      const el = e.target.closest('[data-ic-line]'); hover = el;
      if (!el) { box.style.display = 'none'; return; }
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    }, true);
    document.addEventListener('click', (e) => {
      if (!picking) return;
      e.preventDefault(); e.stopPropagation();
      const el = e.target.closest('[data-ic-line]');
      send({ type: 'pick', id: el && el.id, tag: el && el.tagName.toLowerCase(), line: el ? +el.dataset.icLine : null, x: Math.round(e.pageX), y: Math.round(e.pageY), alt: e.altKey });
    }, true);
    // Project Link: what's being pointed at, focused, clicked or typed in, and which of the page's own
    // handlers answered, so the editor can light up the code behind it
    let linkOn = ${layout.link ? 'true' : 'false'}, lastLink = '';
    const rulesFor = (el) => {
      const out = [];
      const walk = (rules) => { for (const r of rules) { try { if (r.selectorText && el.matches(r.selectorText)) out.push(r.selectorText); else if (r.cssRules && r.cssRules.length) walk(r.cssRules); } catch (e) {} } };
      try { for (const sh of document.styleSheets) walk(sh.cssRules || []); } catch (e) {}
      return out.slice(0, 40);
    };
    const report = (target, ev) => {
      if (!linkOn || picking) return;
      const el = target && target.closest ? target.closest('[data-ic-line]') : null;
      const key = el ? el.dataset.icLine + '|' + (ev === 'hover' ? 'hover' : 'use') : '';
      if (ev === 'hover' && key === lastLink) return;
      lastLink = key;
      if (!el) { send({ type: 'link', none: true }); return; }
      send({ type: 'link', ev: ev, line: +el.dataset.icLine, tag: el.tagName.toLowerCase(), id: el.id || '', classes: Array.from(el.classList), sels: rulesFor(el) });
    };
    document.addEventListener('mouseover', (e) => report(e.target, 'hover'), true);
    document.addEventListener('focusin', (e) => report(e.target, 'focus'), true);
    document.addEventListener('pointerdown', (e) => report(e.target, 'click'), true);
    document.addEventListener('input', (e) => report(e.target, 'type'), true);
    document.documentElement.addEventListener('mouseleave', () => { if (linkOn && lastLink) { lastLink = ''; send({ type: 'link', none: true }); } });
    window.addEventListener('message', (e) => { if (e.data && e.data.intuicodeLink !== undefined) { linkOn = !!e.data.intuicodeLink; if (!linkOn) lastLink = ''; } });
    // the page's own handlers, from here on, say when they answer (and which one) while Project Link is on
    const USED = /^(click|dblclick|input|change|submit|keydown|keyup|keypress|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend)$/;
    const realAdd = EventTarget.prototype.addEventListener, realRemove = EventTarget.prototype.removeEventListener, wraps = new WeakMap();
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (typeof fn !== 'function' || !USED.test(type)) return realAdd.call(this, type, fn, opts);
      let w = wraps.get(fn);
      if (!w) {
        w = function (...args) { if (linkOn) { try { send({ type: 'link-run', ev: type, src: String(fn).slice(0, 4000) }); } catch (e) {} } return fn.apply(this, args); };
        wraps.set(fn, w);
      }
      return realAdd.call(this, type, w, opts);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, opts) { return realRemove.call(this, type, (fn && wraps.get(fn)) || fn, opts); };
  })();`;

  let previewInfo = null, picking = false, previewTimer = null;
  /* ---------- Project Link: the code behind what's in use in the preview, in pink ---------- */
  /* The page says what's being pointed at, focused, clicked or typed in (the element's sentence line, and the CSS
     rules that style it) and which of its handlers answered. That becomes lines of the project's files, as Unity
     and Split Mode show them: the element and what's inside it, its style rules, the script lines that name it,
     and the handler that ran. Those lines turn pink in the editor; their files, folders and parts in the side. */
  const NO_LINES = new Set();
  let link = { lines: new Map(), el: null, run: null };   // lines: sec.id -> Set of lines
  let previewCode = null;   // the page's script as one text, to find the handler that answered
  const linkedLines = (id) => link.lines.get(id) || NO_LINES;
  const escRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function setLink(on, quiet) {
    layout.link = on;
    if (on && layout.predict) {
      layout.predict = false; applyPredict();
      if (!quiet) tLine('Predictive Mode is off while Project Link is on, so clicking around the page doesn\'t bring up predictions.', 't-sys');
    }
    store.set(LAYOUT_KEY, layout);
    $('btnLink').setAttribute('aria-pressed', String(on));
    const w = $('preview').contentWindow;
    if (w) w.postMessage({ intuicodeLink: on }, '*');
    if (!on) clearLink();
  }
  $('btnLink').addEventListener('click', () => setLink(!layout.link));

  function clearLink() {
    if (!link.lines.size && !link.el && !link.run) return;
    link = { lines: new Map(), el: null, run: null };
    showLink(false);
  }
  /* A sentence and the lines indented under it: an element and what's inside it. */
  function blockFrom(text, line) {
    const lines = text.split('\n'), ind = (s) => s.match(/^\s*/)[0].length, base = ind(lines[line] || '');
    let end = line;
    while (end + 1 < lines.length && (!lines[end + 1].trim() || ind(lines[end + 1]) > base)) end++;
    while (end > line && !lines[end].trim()) end--;
    const out = new Set();
    for (let i = line; i <= end; i++) out.add(i);
    return out;
  }
  const normSel = (s) => s.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').trim();
  /* The sentence lines behind the style rules a page element matches. */
  function cssLinesFor(sec, sels) {
    const r = sec && secResult(sec.id), out = new Set();
    if (!r || !sels.length) return out;
    const want = new Set(sels.map(normSel));
    let inRule = false;
    for (const o of r.lines) {
      const t = o.text.trim(), one = t.match(/^([^{}]+)\{.*\}$/), open = t.match(/^([^{}]+)\{\s*$/);
      if (one) { if (want.has(normSel(one[1])) && o.src >= 0) out.add(o.src); continue; }
      if (open) inRule = want.has(normSel(open[1]));
      if (inRule && o.src >= 0) out.add(o.src);
      if (/^\}/.test(t)) inRule = false;
    }
    return out;
  }
  /* The sentence lines of the script that name an element (its id, or a class it has). */
  function jsLinesNaming(sec, el) {
    const r = sec && secResult(sec.id), out = new Set();
    const names = [el.id && '#' + el.id, el.id, ...el.classes.map(c => '.' + c)].filter(Boolean);
    if (!r || !names.length) return out;
    const re = new RegExp(`["'\`](?:${names.map(escRx).join('|')})["'\`]`);
    for (const o of r.lines) if (o.src >= 0 && re.test(o.text)) out.add(o.src);
    return out;
  }
  /* The sentence lines of the handler that answered, found by its own text in the page's script. */
  function jsLinesRan(sec, src) {
    const r = sec && secResult(sec.id), out = new Set();
    if (!r || !src) return out;
    if (!previewCode || previewCode.id !== sec.id || previewCode.r !== r) previewCode = { id: sec.id, r, text: r.lines.map(o => o.text).join('\n') };
    const at = previewCode.text.indexOf(src.slice(0, 200));
    if (at < 0) return out;
    const first = previewCode.text.slice(0, at).split('\n').length - 1, count = src.split('\n').length;
    for (let i = first; i < first + count && i < r.lines.length; i++) if (r.lines[i].src >= 0) out.add(r.lines[i].src);
    return out;
  }
  function onLink(d) {
    if (!layout.link || !previewInfo) return;
    const pg = previewInfo.page;
    if (d.type === 'link') {
      if (d.none || !link.el || link.el.line !== d.line) link.run = null;   // another element: the last handler's done
      link.el = d.none ? null : d;
    } else link.run = d;
    const lines = new Map();
    const add = (sec, set) => {
      if (!sec || !set.size) return;
      const cur = lines.get(sec.id) || new Set();
      for (const n of set) cur.add(n);
      lines.set(sec.id, cur);
    };
    const el = link.el;
    if (el && pg.html) add(pg.html, blockFrom(textOf(pg.html), el.line));
    if (el) add(pg.styling, cssLinesFor(pg.styling, el.sels || []));
    if (el && !link.run) add(pg.mechanics, jsLinesNaming(pg.mechanics, el));
    if (link.run) add(pg.mechanics, jsLinesRan(pg.mechanics, link.run.src));
    link.lines = lines;
    showLink(d.type === 'link-run' || (d.ev && d.ev !== 'hover'));
  }
  const lineList = (ls) => {
    const out = [];
    for (let i = 0; i < ls.length; i++) {
      let j = i;
      while (j + 1 < ls.length && ls[j + 1] === ls[j] + 1) j++;
      out.push(j > i ? `${ls[i] + 1}–${ls[j] + 1}` : `${ls[i] + 1}`);
      i = j;
    }
    return out.slice(0, 4).join(', ') + (out.length > 4 ? '…' : '');
  };
  const LINK_VERB = { hover: 'Pointing at', focus: 'In', click: 'Clicked', type: 'Typing in' };
  function showLink(scroll) {
    const bar = $('linkBar');
    if (!link.el && !link.run) bar.hidden = true;
    else {
      const el = link.el, what = el ? `<code>&lt;${escHtml(el.tag)}&gt;${el.id ? '#' + escHtml(el.id) : el.classes[0] ? '.' + escHtml(el.classes[0]) : ''}</code>` : 'the page';
      const where = [...link.lines].map(([id, set]) => {
        const s = project.sections.find(x => x.id === id), ls = [...set].sort((a, b) => a - b);
        return s ? `<button type="button" class="linklike" data-link-go="${escHtml(id)}" data-link-line="${ls[0]}">${escHtml(fileName(s))} <span class="dim">${ls.length > 1 ? 'lines' : 'line'} ${lineList(ls)}</span></button>` : '';
      }).filter(Boolean).join('<span class="dim"> · </span>');
      bar.innerHTML = `<span class="link-dot" aria-hidden="true"></span><span class="lb-what">${link.run ? `${escHtml(link.run.ev)} on ${what}: its handler ran` : `${LINK_VERB[el.ev] || 'At'} ${what}`}</span>${where ? `<span class="lb-where">${where}</span>` : '<span class="dim">no code of its own</span>'}`;
      bar.hidden = false;
    }
    renderTree(); renderParts();
    if (mode === 'unity') renderUnity(); else { renderSayMarks(); renderPython(); }
    if (scroll) scrollToLinked();
  }
  /* After a click or a handler, the open file's pink lines come into view (pointing alone never scrolls). */
  function scrollToLinked() {
    const ls = [...linkedLines(activeSec().id)].sort((a, b) => a - b);
    if (!ls.length) return;
    const box = mode === 'unity' ? uTa : ta, lh = mode === 'unity' ? (parseFloat(getComputedStyle(uTa).lineHeight) || 22) : LH;
    const top = ls[0] * lh, bottom = (ls[ls.length - 1] + 1) * lh;
    if (top < box.scrollTop || bottom > box.scrollTop + box.clientHeight) {
      box.scrollTop = Math.max(0, top - lh * 2);
      if (mode === 'unity') uSync(); else syncScroll();
    }
  }
  $('linkBar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-link-go]');
    if (b) openSection(b.dataset.linkGo, +b.dataset.linkLine);
  });

  function updateChip() {
    const chip = document.querySelector('.lang-chip');
    const engines = [...new Set(project.sections.map(s => ENGINE[s.lang]).filter(Boolean))].map(e => ENGINE_NAME[e]);
    chip.textContent = mode === 'unity' ? langName(activeSec().lang) : engines.length ? engines.join(' + ') : 'Files';
  }
  function showBottom(which) {
    const web = webOn();
    $('tabPreview').hidden = !web;
    const showPreview = web && which === 'preview';
    $('previewWrap').hidden = !showPreview;
    $('termBody').hidden = showPreview;
    $('tabPreview').setAttribute('aria-selected', String(showPreview));
    $('tabTerm').setAttribute('aria-selected', String(!showPreview));
    $('btnPick').hidden = !showPreview;
    $('btnLink').hidden = !showPreview;
    $('btnClear').hidden = showPreview;
    if (!showPreview) clearLink();
  }
  function runWebsite(announce) {
    if (!compiled) compile();
    const pg = previewPage(), res = (s) => (s ? secResult(s.id) : null);
    previewInfo = WEB.previewDocument({ results: { structure: res(pg.html), styling: res(pg.styling), mechanics: res(pg.mechanics) } }, previewHelper());
    previewInfo.page = pg;
    previewCode = null;
    showPreviewPage(withImages(previewInfo.html), announce);
    setPicking(false);
    if (announce) {
      showBottom('preview');
      const errs = project.sections.reduce((n, s) => n + issues(s, 'errs'), 0);
      tLine(`▶ Preview updated.${errs ? ` ${errs} sentence${errs > 1 ? 's have' : ' has'} a problem, so parts may be missing.` : ''}`, 't-sys');
    }
  }
  /* In the desktop app the page is served from its own address (preview://), because the editor's
   * Content-Security-Policy forbids inline scripts and a srcdoc page would inherit it. In a browser
   * it goes in srcdoc. Either way the sandbox keeps it in an origin of its own. */
  let previewSeq = 0, previewShown = null;
  async function showPreviewPage(html, reload) {
    // the same page again isn't reloaded (typing that doesn't change it, or a rebuild right after
    // opening a project), unless Run asks for a fresh start
    if (html === previewShown && !reload) return;
    previewShown = html;
    const frame = $('preview'), seq = ++previewSeq;
    if (desk.on && TAURI.core.convertFileSrc) {
      try {
        await invoke('set_preview', { html });
        if (seq === previewSeq) { frame.removeAttribute('srcdoc'); frame.src = TAURI.core.convertFileSrc(`page-${seq}.html`, 'preview'); }
        return;
      } catch (_) { /* no preview address: use srcdoc */ }
    }
    if (seq === previewSeq) frame.srcdoc = html;
  }
  /* The live preview follows the sentences, but not a line still being typed that doesn't work yet
   * (half a condition, a ‹blank› not filled in): it waits until the line works, or the cursor leaves it. */
  function schedulePreview() {
    if (!webOn() || $('previewWrap').hidden) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const r = secResult(project.active), inf = r && typingLine >= 0 && r.info[typingLine];
      if (inf && (inf.errs.length || (activeSec().file === 'mechanics' && !parses(r.text)))) return;
      runWebsite(false);
    }, 600);
  }
  /* Is it whole JavaScript? (Read, never run: a half-typed "set speed to -" isn't.) */
  function parses(js) {
    try { new Function(js); return true; } catch (e) { return !(e instanceof SyntaxError); }
  }
  function setPicking(on) {
    picking = on;
    $('btnPick').setAttribute('aria-pressed', String(on));
    $('btnPick').textContent = on ? 'Picking… (click the page)' : 'Pick from the page';
    const w = $('preview').contentWindow;
    if (w) w.postMessage({ intuicodePick: on }, '*');
  }
  $('tabTerm').addEventListener('click', () => { setDock('term', true); showBottom('terminal'); });
  $('tabPreview').addEventListener('click', () => { setDock('term', true); showBottom('preview'); runWebsite(false); });
  $('btnPick').addEventListener('click', () => setPicking(!picking));
  window.addEventListener('message', (e) => {
    if (e.source !== $('preview').contentWindow || !e.data || !e.data.intuicode) return;
    const d = e.data;
    if (d.type === 'storage') {
      const all = store.get(PAGE_STORE_KEY, {});
      if (d.data && typeof d.data === 'object' && JSON.stringify(d.data).length < 1_000_000) { all[project.name] = d.data; store.set(PAGE_STORE_KEY, all); }
      return;
    }
    if (d.type === 'link' || d.type === 'link-run') { onLink(d); return; }
    if (d.type === 'log') tLine(`page: ${d.text}`, d.level === 'error' ? 't-err' : d.level === 'warn' ? 't-sys' : undefined);
    else if (d.type === 'error') {
      let where = '';
      const mech = previewInfo && previewInfo.page.mechanics;
      const js = mech && secResult(mech.id);
      if (d.line && previewInfo && js) {
        const o = js.lines[d.line - previewInfo.jsLine];
        if (o && o.src >= 0) where = o.src;
      }
      // an unfilled ‹blank› runs as _ : say that, not "_ is not defined"
      if (/\b_ is not defined/.test(d.text) && mech && /‹[^›]*›/.test(where !== '' ? mech.text.split('\n')[where] || '' : mech.text)) {
        tLine(`■ The page stopped at a ‹blank› that isn't filled in yet${where !== '' ? '' : ': Problems on the left lists them'}. The help says what goes in it.`, 't-sys');
        if (where !== '') pointAt(mech.id, where, 'The page stops here until this ‹blank› is filled in.');
        return;
      }
      tLine(`✕ The page hit an error: ${d.text}`, 't-err');
      if (where !== '' && mech) pointAt(mech.id, where, `The page hit an error: ${d.text}`);
    } else if (d.type === 'pick') {
      setPicking(false);
      const sec = activeSec();
      if (d.alt) { insertText(`${d.x}, ${d.y}`); tLine(`Picked the position ${d.x}, ${d.y}. (Exact positions can break on other screen sizes; "in a row" or a grid adapt better.)`, 't-sys'); return; }
      if (d.id && sec.file !== 'structure') { insertText(d.id); tLine(`Picked ${d.id}.`, 't-sys'); return; }
      if (d.line != null && previewInfo && previewInfo.page.html) {
        openSection(previewInfo.page.html.id, d.line);
        tLine(d.id ? `Picked ${d.id}: here is where it is added.` : `Picked a <${d.tag}> with no name. To style it or use it in Mechanics, give it one: add "called …" to this sentence.`, 't-sys');
      }
    }
  });

  const HELP = [
    'Commands:',
    '  run      run the program (same as the Run button, or Ctrl+Enter)',
    '  clear    clear this terminal',
    '  files    list the project folders and the Python file each one makes',
    '  reset    forget values from earlier runs',
    '  restore  swap back to the project you had before the last blueprint or import',
    '  index    open the Index',
    '  board …  which board an Arduino sketch is for, e.g. board esp32 (when it can\'t be told from the USB port)',
    ...(window.__TAURI__ ? ['  $ …     run a command in the project folder, e.g. $ git status or $ pip install flask'] : []),
    'Anything else is tried right away. Type a sentence like',
    '  random number from 1 to 6',
    '  show length of "hello"',
    'or plain Python like  2 ** 10  and see the result.',
  ].join('\n');

  async function command(text) {
    const cmd = text.trim();
    if (!cmd) return;
    tLine(cmd, 't-cmd');
    const low = cmd.toLowerCase();
    if (low === 'help' || low === '?') return tLine(HELP, 't-help');
    if (low === 'clear' || low === 'cls') { termLog.textContent = ''; return; }
    if (low === 'run' || low === 'python main.py' || low === 'python3 main.py') return run();
    if (low === 'index') return openIndex();
    if (low === 'restore') {
      const prev = checkedProject(store.get(PREVIOUS_KEY, null));
      if (!prev) return tLine('There is no earlier project to restore.', 't-sys');
      // it isn't linked to the open folder (that holds the project being swapped out)
      return replaceProject(prev, `Restored "${prev.name}".` + (desk.on ? ' It isn\'t saved in a folder: press Save to keep it.' : ''));
    }
    if (low === 'files' || low === 'ls') {
      return tLine(project.name + '/\n' + project.sections.map(s => `  ${fileName(s).padEnd(13)} ${metaOf(s).title}: ${metaOf(s).purpose}${s.id === project.start ? ' (starts here)' : ''}`).join('\n'), 't-help');
    }
    if (low === 'reset') { Runner.reset(); return tLine('Forgot all values from earlier runs.', 't-sys'); }
    if (low === 'board' || low.startsWith('board ')) return chooseBoard(cmd.slice(5).trim());
    if (!compiled) compile();
    if (!project.sections.some(s => s.lang === 'python')) {   // the terminal's sentences are Python's
      if (project.kind === 'cpp') return tLine('In a C++ project, press Run to compile and run the program (desktop app).', 't-sys');
      if (project.kind === 'arduino') return tLine('In an Arduino project, press Run to check the sketch and upload it to a board (desktop app with arduino-cli). What the board shows appears here.', 't-sys');
      if (project.kind === 'website') return tLine('In a website project, the terminal shows messages from the page (from "show …" in Mechanics). Press Run to refresh the preview. Python sentences work in projects with a Python file.', 't-sys');
      return tLine('Sentences typed here are Python\'s. Add a Python file to this project (Menu → New file) to try them.', 't-sys');
    }
    const tr = LANG.translateOne(cmd, compiled.pySyms);
    if (tr.info.errs.length) return tLine(tr.info.errs.join('\n'), 't-err');
    if (tr.open) return tLine('Blocks (if, loops, define) need more than one line. Write them in a folder and press Run.', 't-err');
    if (tr.py.trim() !== cmd) tLine('→ ' + tr.py, 't-py');
    if (!(await ensurePython())) return;
    const r = Runner.repl(tr.imports.map(m => `import ${m}`).concat([tr.py]).join('\n'));
    if (r.out) tWrite(r.out.endsWith('\n') ? r.out : r.out + '\n');
    if (r.error) {
      const f = friendly(r.error.type, r.error.msg);
      tLine((f ? f + '\n  ' : '') + `Python said: ${r.error.type}: ${r.error.msg}`, 't-err');
    }
  }

  /* Which board a sketch is for. arduino-cli recognises official boards by their USB port, but not
   * boards that use a USB-serial chip (CH340, CP2102: many ESP32 and clone boards), so it can be named. */
  const BOARD_NAMES = { uno: 'arduino:avr:uno', nano: 'arduino:avr:nano', mega: 'arduino:avr:mega', leonardo: 'arduino:avr:leonardo', esp32: 'esp32:esp32:esp32' };
  function chooseBoard(name) {
    if (project.kind !== 'arduino') return tLine('Choosing a board is for Arduino projects.', 't-sys');
    const names = Object.keys(BOARD_NAMES).join(', ');
    if (!name) return tLine(`This sketch is for ${project.board || 'a board recognised on its USB port (or an Uno)'}. To choose, type board and one of: ${names}, or arduino-cli's full name for it (list them with $ arduino-cli board listall).`, 't-help');
    const fqbn = BOARD_NAMES[name.toLowerCase()] || name;
    if (!BOARD_ID.test(fqbn)) return tLine(`"${name}" isn't a board name IntuaCode knows. Use one of: ${names}, or arduino-cli's full name, like esp32:esp32:esp32-evb.`, 't-err');
    project.board = fqbn;
    save(); autosave();
    tLine(`This sketch is now for ${fqbn}. Press Run to check it and upload it.`, 't-sys');
  }

  $('termForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = termIn.value;
    termIn.value = '';
    if (desk.proc) {
      tWrite(val + '\n', 't-echo');
      invoke('write_stdin', { id: desk.proc.id, text: val + '\n' }).catch((e) => tLine(String(e), 't-err'));
      return;
    }
    // an answer the program asked for comes first, even one like "$5"
    if (asking && session && !session.done) {
      setAsking(false);
      tWrite(val + '\n', 't-echo');
      session.answers.push(val);
      session.shown += val.length + 1;
      step();
      return;
    }
    if (desk.on && val.trim().startsWith('$')) { history.push(val); histPos = history.length; runShell(val.trim().slice(1).trim()); return; }
    if (val.trim()) { history.push(val); histPos = history.length; }
    command(val);
  });
  termIn.addEventListener('keydown', (e) => {
    if (asking) return;
    if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); histPos = Math.max(0, histPos - 1); termIn.value = history[histPos]; }
    if (e.key === 'ArrowDown' && history.length) { e.preventDefault(); histPos = Math.min(history.length, histPos + 1); termIn.value = history[histPos] || ''; }
  });
  termBody.addEventListener('click', (e) => { if (e.target === termBody || e.target === termLog) termIn.focus(); });
  $('btnClear').addEventListener('click', () => { termLog.textContent = ''; });
  $('btnRun').addEventListener('click', run);

  /* ------------------------------------------------------------------ */
  /* Index                                                               */
  /* ------------------------------------------------------------------ */

  let indexAll = false;

  function renderIndex() {
    const q = $('indexSearch').value.trim().toLowerCase();
    const file = tplRole(activeSec());
    const PK = packFor(activeSec());
    const G = PK.guide;
    const match = (...parts) => !q || parts.join(' ').toLowerCase().includes(q);
    let html = '';
    $('indexTitle').textContent = `${G.name} · ${metaOf(activeSec()).title}`;
    if (!G.rules) G.rules = [];
    if (!q) {
      html += `<div class="ix"><h3>What ${G.name} is for</h3><p>${withCode(G.purpose)}</p>
        ${mode === 'write' ? `<h3>This folder</h3><p>${withCode(PK.guide.section || '')}</p>` : `<h3>Reading code</h3><p>Click a section to see what it does. Highlight any lines and press Summarise for just those. Summaries come from rules, not guesses: every sentence points at real lines.</p>`}
        <h3>${G.rules.length === 5 ? 'Five' : G.rules.length} rules that explain most of ${escHtml(G.name)}</h3><ol class="ix-rules">${G.rules.map((r, i) => `<li><span class="n">${i + 1}</span><div><b>${escHtml(r[0])}</b><span>${withCode(r[1])}</span></div></li>`).join('')}</ol></div>`;
    }
    const tpls = PK.templates.filter(t => (PK.webOnly ? (PK.filter(t) || (indexAll && t.sections.some(x => SEC_LANG[x]))) : (indexAll || q || t.sections.includes(file))) && match(t.pattern, t.py, t.tip, t.group));
    const groups = [...new Set(tpls.map(t => t.group))];
    html += `<div class="ix"><h3>Sentences${q ? '' : indexAll ? ' · all folders' : ' · for this folder'}${q ? '' : `<button type="button" class="ix-toggle" id="ixToggle">${indexAll ? 'Show this folder only' : 'Show all'}</button>`}</h3>`;
    html += groups.map(g => `<div class="ix-group">${escHtml(g)}</div>` + tpls.filter(t => t.group === g).map(t => {
      const i = PK.templates.indexOf(t);
      return `<div class="ix-item"><div class="ix-say">${escHtml(t.pattern).replace(/‹([^›]*)›/g, '<span class="s-slot">‹$1›</span>')}</div><button type="button" class="ix-insert" data-tpl="${i}">Insert</button><div class="ix-py">${escHtml(t.py)}</div>${t.tip ? `<div class="ix-tip">${withCode(t.tip)}</div>` : ''}</div>`;
    }).join('')).join('') || '<div class="ix-empty">No sentences match.</div>';
    html += '</div>';
    const words = PK.words.filter(w => match(w[0], w[1]));
    if (words.length) html += `<div class="ix"><h3>Words inside sentences</h3><table class="ix-words"><tbody>${words.map(w => `<tr><td>${escHtml(w[0])}</td><td>${escHtml(w[1])}</td></tr>`).join('')}</tbody></table></div>`;
    const hows = PK.howtos.filter(h => match(h[0], h[1]));
    if (hows.length) html += `<div class="ix"><h3>How to…</h3>${hows.map(h => `<div class="ix-how"><b>${escHtml(h[0])}<button type="button" class="ix-insert" data-how="${PK.howtos.indexOf(h)}">Insert</button></b><pre>${escHtml(h[1])}</pre></div>`).join('')}</div>`;
    $('indexBody').innerHTML = html;
  }

  function insertSnippet(snippet) {
    if (mode !== 'write') setMode('write');
    const pos = ta.selectionStart;
    const b = lineBounds(pos);
    const indent = b.text.match(/^\s*/)[0];
    const body = snippet.replace(/\n+$/, '').split('\n').map((l, i) => (i ? indent : '') + l).join('\n');
    if (!b.text.trim()) insertText(indent + body, b.start, b.end);
    else insertText('\n' + indent + body, b.end, b.end);
    const firstLineStart = b.text.trim() ? b.end + 1 : b.start;
    const endPos = ta.selectionStart;
    ta.setSelectionRange(firstLineStart, firstLineStart);
    if (!selectNextSlot(true)) ta.setSelectionRange(endPos, endPos);
    afterCaretMove(true);
  }

  $('indexBody').addEventListener('click', (e) => {
    if (e.target.id === 'ixToggle') { indexAll = !indexAll; renderIndex(); return; }
    const b = e.target.closest('.ix-insert');
    if (!b) return;
    if (b.dataset.tpl) insertSnippet(packFor(activeSec()).templates[+b.dataset.tpl].pattern);
    if (b.dataset.how) insertSnippet(packFor(activeSec()).howtos[+b.dataset.how][1]);
    if (matchMedia('(max-width: 900px)').matches) closeIndex();
  });
  $('indexSearch').addEventListener('input', renderIndex);
  function openIndex() { renderIndex(); $('index').hidden = false; $('btnIndex').setAttribute('aria-expanded', 'true'); }
  function closeIndex() { $('index').hidden = true; $('btnIndex').setAttribute('aria-expanded', 'false'); }
  $('btnIndex').addEventListener('click', () => ($('index').hidden ? openIndex() : closeIndex()));
  $('btnIndexClose').addEventListener('click', closeIndex);

  /* ------------------------------------------------------------------ */
  /* Blueprints                                                          */
  /* ------------------------------------------------------------------ */

  const MY_BP_KEY = 'intuicode.blueprints.v1';
  let myBlueprints = store.get(MY_BP_KEY, []);   // [{id, source}]
  let bpSel = null;          // {src: 'built'|'mine', i}
  let bpValues = {};
  let bpEditing = null;      // {text, mineIndex|null}

  const bpSource = (sel) => sel.src === 'built' ? BP.BUILT_IN[sel.i] : myBlueprints[sel.i].source;

  /* Project Templates: shelves by what you're making (the project builder's own questions), each holding the
   * builder's kits (a whole kind of project, planned step by step) and blueprints (a story with blanks). */
  const bpOn = (sel) => !!bpSel && bpSel.src === sel.src && (sel.src === 'kit' ? bpSel.id === sel.id : bpSel.i === sel.i);
  let bpPlatform = '';   // the templates' filter: '' (everything), or pc, phone, web, board
  const platTag = (p) => `<em class="bp-plat plat-${escHtml(p)}">${escHtml(BUILDER.PLATFORMS[p] || p)}</em>`;
  function renderBpList() {
    const lib = bldLibrary();
    const scroll = $('bpList').scrollTop;
    const built = BP.BUILT_IN.map((src, i) => ({ bp: BP.parse(src), sel: { src: 'built', i } }));
    const mine = myBlueprints.map((m, i) => ({ bp: BP.parse(m.source), sel: { src: 'mine', i } }));
    const fits = (platform) => !bpPlatform || platform === bpPlatform;
    const item = ({ bp, sel }) => `<button type="button" class="bp-item${bpOn(sel) ? ' on' : ''}" data-src="${sel.src}" data-i="${sel.i}"><b>${escHtml(bp.title || 'Untitled')}</b><span>${bp.kind === 'project' ? platTag(bp.platform) : ''}${escHtml(bp.about || '')}</span></button>`;
    const kitItem = (k) => {
      const depths = k.steps.map(s => lib.components[s.id]).filter(Boolean).map(c => c.depth);
      return `<button type="button" class="bp-item bp-kit${bpOn({ src: 'kit', id: k.id }) ? ' on' : ''}" data-src="kit" data-kit="${escHtml(k.id)}"><b>${escHtml(k.title)}</b><span>${platTag(k.platform)}<em class="bp-tag">Plan</em>${depths.length} steps: ${['walk', 'hallway', 'horizon'].map(d => [depths.filter(x => x === d).length, d]).filter(([n]) => n).map(([n, d]) => n + ' ' + d).join(', ')}</span></button>`;
    };
    const group = (label, list) => list.length ? `<div class="bp-group">${label}</div>` + list.map(item).join('') : '';
    const shelves = BUILDER.SHELVES.map(sh => {
      const kits = Object.values(lib.kits).filter(k => k.shelf === sh.id && fits(k.platform));
      const bps = built.filter(x => x.bp.kind === 'project' && x.bp.shelf === sh.id && fits(x.bp.platform));
      if (!kits.length && !bps.length) return '';
      const plan = sh.path && kits.length ? `<button type="button" class="bp-plan" data-shelf="${sh.id}" title="Plan a ${escHtml(sh.title.toLowerCase())} project, choosing its steps">Plan one ›</button>` : '';
      return `<div class="bp-group bp-shelf"><span>${escHtml(sh.title)}</span>${plan}</div>${kits.map(kitItem).join('')}${bps.map(item).join('')}`;
    }).join('');
    const myKitsOff = Object.values(lib.kits).filter(k => !BUILDER.SHELVES.some(sh => sh.id === k.shelf) && fits(k.platform));
    const chip = (p, label) => `<button type="button" class="bp-filter${bpPlatform === p ? ' on' : ''}" data-platform="${p}" aria-pressed="${bpPlatform === p}">${label}</button>`;
    $('bpList').innerHTML = `<div class="bp-filters" role="group" aria-label="Where it runs">${chip('', 'All')}${Object.entries(BUILDER.PLATFORMS).map(([p, label]) => chip(p, label)).join('')}</div>`
      + (shelves || '<p class="bp-none">Nothing here runs there yet.</p>')
      + (bpPlatform ? '' : group(`Add to ${metaOf(activeSec()).title}`, built.filter(x => x.bp.kind === 'snippet')))
      + `<div class="bp-group">Yours</div>`
      + myKitsOff.map(kitItem).join('')
      + (mine.length ? mine.map(item).join('') : myKitsOff.length ? '' : '<p class="bp-none">None yet. Edit a copy of any blueprint, or turn your current project into one.</p>')
      + `<div class="bp-mk"><button type="button" class="btn small" id="bpFromProject">Make one from this project</button><button type="button" class="btn small" id="bpPaste">Write or paste one</button></div>`;
    $('bpList').scrollTop = scroll;
  }

  /* A kit in Project Templates: its steps in build order, each with its depth, and a way into the builder. */
  function renderKitPage(box) {
    const lib = bldLibrary(), kit = lib.kits[bpSel.id];
    if (!kit) { box.innerHTML = '<p class="bp-none">This kit isn\'t in Project Templates any more.</p>'; return; }
    const shelf = BUILDER.SHELVES.find(sh => sh.id === kit.shelf);
    const steps = kit.steps.map(s => ({ s, c: lib.components[s.id] })).filter(x => x.c);
    const count = (d) => steps.filter(x => x.c.depth === d).length;
    box.innerHTML = `<div class="bp-kind">Project builder kit${shelf ? ' · ' + escHtml(shelf.title) : ''}</div>
      <h3 class="bp-title">${escHtml(kit.title)}</h3>
      <p class="bp-lead">${escHtml(kit.about)}</p>
      <p class="bld-legend">${['walk', 'hallway', 'horizon'].filter(count).map(d => `<span>${depthChip(d)} ${count(d)} ${count(d) === 1 ? 'step' : 'steps'}</span>`).join('')}</p>
      <div class="bp-actions"><button type="button" class="btn primary" id="bpPlan">Choose its steps…</button><button type="button" class="btn" id="bpKitEdit">Change this kit</button></div>
      <p class="bp-note">A kit is a whole kind of project, in the order you'd build it. You choose its steps, and each says how much is done for you: Walk is written in full, Hallway leaves ‹blanks› for you, Horizon points the way.</p>
      <ol class="bp-kit-steps">${steps.map(({ s, c }, i) => `<li><span class="bld-n">${i + 1}</span><span><span class="bld-name"><b>${escHtml(c.name)}</b> ${depthChip(c.depth)}${s.always ? ' <span class="dim">always part of it</span>' : s.ticked ? ' <span class="dim">ticked at first</span>' : ''}</span><span class="bld-sum">${withCode(c.summary)}</span></span></li>`).join('')}</ol>`;
  }

  function madlib(bp) {
    const fields = new Map(bp.fields.map(f => [f.name, f]));
    const shown = new Set();
    const input = (f) => {
      shown.add(f.name);
      const v = bpValues[f.name] ?? f.value;
      if (f.choices) return `<select class="blank" data-f="${escHtml(f.name)}" aria-label="${escHtml(f.name)}">${f.choices.map(c => `<option${c === v ? ' selected' : ''}>${escHtml(c)}</option>`).join('')}</select>`;
      return `<span class="blank-wrap${f.text ? ' is-text' : ''}"><input class="blank" data-f="${escHtml(f.name)}" value="${escHtml(v)}" size="${Math.max(3, String(v).length + 1)}" aria-label="${escHtml(f.name)}" spellcheck="false"><small>${escHtml(f.name)}</small></span>`;
    };
    const story = escHtml(bp.story).replace(/\[(?!if\b|end\b|not\b)([A-Za-z][\w ]*?)(?:\s*:\s*([^\]]*))?\]/g, (m, name) => {
      const f = fields.get(name.trim().toLowerCase());
      if (!f) return m;
      return shown.has(f.name) ? `<b class="blank-ref" data-ref="${escHtml(f.name)}">${escHtml(bpValues[f.name] ?? f.value)}</b>` : input(f);
    }).replace(/\n/g, '<br>');
    const extra = bp.fields.filter(f => !shown.has(f.name));
    return `<div class="madlib">${story}</div>` + (extra.length ? `<div class="bp-extra"><span class="ex-lbl">More blanks</span>${extra.map(f => `<label class="bp-extra-f">${escHtml(f.name)} ${input(f)}</label>`).join('')}</div>` : '');
  }

  function bpPreview(bp) {
    const filled = BP.fill(bp, bpValues);
    return Object.entries(filled).map(([sec, text]) => {
      const label = sec === 'here' ? `Goes into ${metaOf(activeSec()).title} at the cursor` : `${SECTION_META[sec].title} · ${FILE_NAME[sec] || sec + '.py'}`;
      return `<div class="bp-sec"><div class="ex-lbl">${label}</div><pre>${text.replace(/\n$/, '').split('\n').map(l => hlLine(l)).join('\n')}</pre></div>`;
    }).join('');
  }

  function renderBpDetail() {
    const box = $('bpDetail');
    if (bpEditing) {
      const parsed = BP.parse(bpEditing.text);
      box.innerHTML = `<div class="bp-edit">
        <label class="ex-lbl" for="bpSrc">Blueprint text</label>
        <textarea id="bpSrc" spellcheck="false">${escHtml(bpEditing.text)}</textarea>
        <div class="bp-errors" id="bpErrors">${parsed.errors.map(e => `<div>${escHtml(e)}</div>`).join('')}</div>
        <details class="bp-help"><summary>How blueprint text works</summary>
          <ul>
            <li><code>[name: default]</code> a blank with a starting value. <code>[name: a | b]</code> a choice. <code>[name: "text"]</code> a blank for words (quotes are added for you).</li>
            <li><code>[name]</code> uses a blank's value anywhere, including in the sentences.</li>
            <li><code>[if name = value]</code> … <code>[end]</code> includes lines only for that choice. <code>[if name]</code> means "not empty".</li>
            <li>Sections start with <code>== settings</code>, <code>== tools</code>, <code>== main</code>, or <code>== here</code> for a snippet.</li>
            <li><code>kind: project</code> or <code>kind: snippet</code>, and <code>layout: script</code> or <code>layout: structured</code>.</li>
          </ul>
        </details>
        <div class="bp-actions"><button type="button" class="btn primary" id="bpSave"${parsed.errors.length ? ' disabled' : ''}>Save to my blueprints</button><button type="button" class="btn" id="bpCancel">Cancel</button></div>
      </div>`;
      $('bpSrc').addEventListener('input', (e) => {
        bpEditing.text = e.target.value;
        const p = BP.parse(bpEditing.text);
        $('bpErrors').innerHTML = p.errors.map(x => `<div>${escHtml(x)}</div>`).join('');
        $('bpSave').disabled = !!p.errors.length;
      });
      return;
    }
    if (!bpSel) { box.innerHTML = '<p class="bp-none">Pick something on the left.</p>'; return; }
    if (bpSel.src === 'kit') return renderKitPage(box);
    const bp = BP.parse(bpSource(bpSel));
    const isProject = bp.kind === 'project';
    const where = 'Blueprint · ' + (isProject ? ({ structured: 'Settings, Tools and Main program', website: 'a website: Structure, Styling and Mechanics', cpp: 'C++, one Program file', arduino: 'Arduino, one Sketch for a board' }[bp.layout] || 'one Main program file') : `adds lines to ${metaOf(activeSec()).title}`);
    box.innerHTML = `<div class="bp-kind">${escHtml(where)}</div>
      <h3 class="bp-title">${escHtml(bp.title)}</h3>
      ${bp.errors.length ? `<div class="bp-errors">${bp.errors.map(e => `<div>${escHtml(e)}</div>`).join('')}</div>` : ''}
      ${madlib(bp)}
      <div class="bp-out"><div class="bp-out-h">What it will write</div><div id="bpPreview">${bpPreview(bp)}</div></div>
      <div class="bp-actions">
        <button type="button" class="btn primary" id="bpUse">${isProject ? 'Build this project' : 'Insert at the cursor'}</button>
        ${bpSel.src === 'mine' ? '<button type="button" class="btn" id="bpEdit">Edit</button><button type="button" class="btn ghost" id="bpDelete">Delete</button>' : '<button type="button" class="btn" id="bpCopyEdit">Edit a copy</button>'}
        <button type="button" class="btn ghost" id="bpCopyText">Copy as text</button>
      </div>
      ${isProject ? '<p class="bp-note">Building replaces the sentences in the editor. Type "restore" in the terminal to get the previous project back.</p>' : ''}`;
  }

  function openBlueprints() {
    bpEditing = null;
    if (!bpSel) { const k = Object.values(bldLibrary().kits).find(x => x.shelf === BUILDER.SHELVES[0].id); bpSel = k ? { src: 'kit', id: k.id } : { src: 'built', i: 0 }; }
    bpValues = {};
    renderBpList(); renderBpDetail();
    $('bpModal').hidden = false;
    const on = $('bpList').querySelector('.bp-item.on'); if (on) on.focus();
  }
  function closeBlueprints() { $('bpModal').hidden = true; }
  function saveMine() { store.set(MY_BP_KEY, myBlueprints); }

  $('btnBlueprints').addEventListener('click', openBlueprints);
  $('bpClose').addEventListener('click', closeBlueprints);
  $('bpModal').addEventListener('click', (e) => { if (e.target.id === 'bpModal') closeBlueprints(); });
  $('bpList').addEventListener('click', (e) => {
    const it = e.target.closest('.bp-item');
    if (it) { bpSel = it.dataset.src === 'kit' ? { src: 'kit', id: it.dataset.kit } : { src: it.dataset.src, i: +it.dataset.i }; bpValues = {}; bpEditing = null; renderBpList(); renderBpDetail(); return; }
    const pf = e.target.closest('[data-platform]');
    if (pf) { bpPlatform = pf.dataset.platform; renderBpList(); return; }
    const shelf = e.target.closest('[data-shelf]');
    if (shelf) { closeBlueprints(); openBuilderAt(BUILDER.SHELVES.find(sh => sh.id === shelf.dataset.shelf).path); return; }
    if (e.target.id === 'bpFromProject') {
      activeSec().text = ta.value;
      bpEditing = { text: BP.fromProject(project, 'My ' + project.name), mineIndex: null };
      renderBpDetail();
    }
    if (e.target.id === 'bpPaste') {
      bpEditing = { text: 'title: My blueprint\nkind: snippet\nabout: What it does, in one line.\nstory:\nSay [message: "hello"] [times: 3] times.\n== here\nrepeat [times] times\n    show [message]\n', mineIndex: null };
      renderBpDetail();
    }
  });
  $('bpDetail').addEventListener('input', (e) => {
    const f = e.target.closest('.blank');
    if (!f) return;
    bpValues[f.dataset.f] = f.value;
    if (f.tagName === 'INPUT') f.size = Math.max(3, f.value.length + 1);
    $('bpDetail').querySelectorAll(`.blank-ref[data-ref="${CSS.escape(f.dataset.f)}"]`).forEach(r => { r.textContent = f.value; });
    $('bpPreview').innerHTML = bpPreview(BP.parse(bpSource(bpSel)));
  });
  $('bpDetail').addEventListener('click', (e) => {
    const id = e.target.id;
    if (id === 'bpPlan') { closeBlueprints(); openBuilderAtKit(bpSel.id); return; }
    if (id === 'bpKitEdit') { closeBlueprints(); openKitEditorAt('kit', bpSel.id); return; }
    if (id === 'bpUse') {
      const bp = BP.parse(bpSource(bpSel));
      if (bp.errors.length) return;
      closeBlueprints();
      if (bp.kind === 'project') replaceProject(projectFromBlueprint(bp, bpValues), `Built "${bp.title}" from its blueprint. Press Run to try it.` + (desk.on ? ' Press Save to keep it as files.' : ''));
      else { insertSnippet(BP.fill(bp, bpValues).here); tLine(`Added "${bp.title}" to ${metaOf(activeSec()).title}.`, 't-sys'); }
    }
    if (id === 'bpCopyEdit') {
      const src = bpSource(bpSel).replace(/^title:\s*(.*)$/m, (m, t) => `title: ${t} (my version)`);
      bpEditing = { text: src, mineIndex: null }; renderBpDetail();
    }
    if (id === 'bpEdit') { bpEditing = { text: bpSource(bpSel), mineIndex: bpSel.i }; renderBpDetail(); }
    if (id === 'bpDelete') {
      if (e.target.dataset.confirm !== 'yes') { e.target.dataset.confirm = 'yes'; e.target.textContent = 'Click again to delete'; return; }
      myBlueprints.splice(bpSel.i, 1); saveMine(); bpSel = { src: 'built', i: 0 }; renderBpList(); renderBpDetail();
    }
    if (id === 'bpCopyText') copyText(bpSource(bpSel), e.target, 'Copy as text');
    if (id === 'bpCancel') { bpEditing = null; renderBpDetail(); }
    if (id === 'bpSave') {
      if (bpEditing.mineIndex != null) myBlueprints[bpEditing.mineIndex].source = bpEditing.text;
      else myBlueprints.push({ id: Date.now().toString(36), source: bpEditing.text });
      saveMine();
      bpSel = { src: 'mine', i: bpEditing.mineIndex != null ? bpEditing.mineIndex : myBlueprints.length - 1 };
      bpEditing = null; bpValues = {};
      renderBpList(); renderBpDetail();
    }
  });
  // selects fire "change" rather than "input" in some browsers
  $('bpDetail').addEventListener('change', (e) => {
    const f = e.target.closest('select.blank');
    if (!f) return;
    bpValues[f.dataset.f] = f.value;
    $('bpPreview').innerHTML = bpPreview(BP.parse(bpSource(bpSel)));
  });

  /* ------------------------------------------------------------------ */
  /* Library: kinds of project, and the parts to add to one              */
  /* ------------------------------------------------------------------ */
  /* Two ways in: by the kind of project (what it's written in, open-source projects to learn from, the parts
   * it's made of) or by what a part does (lang/library.js; its packs are plain text in lang/library/). A part
   * comes in one or more languages; adding it puts it in the project: sentences for a website, C++ or Arduino
   * join the file of that language that's already there (they're one program), anything else gets its own file
   * (a Python one is a module the others import). Coding integration parts add every side at once. */
  const LIB = window.IntuiLibrary;
  const libState = { view: 'types', sel: null, lang: null, q: '' };   // sel: { kind: 'type' | 'part', id }
  const libOn = (kind, id) => (libState.sel && libState.sel.kind === kind && libState.sel.id === id ? ' on' : '');
  const libPlat = (p) => `<em class="bp-plat plat-${escHtml(p)}">${escHtml(LIB.PLATFORMS[p] || p)}</em>`;
  const libLangTags = (p) => [...new Set(p.variants.map(v => v.name))].map(n => `<em class="bp-tag">${escHtml(n)}</em>`).join('');
  function libFits(e, q) {
    if (!q) return true;
    const hay = [e.title, e.about, e.summary, e.heading, e.learn, ...(e.variants || []).map(v => v.name), ...(e.languages || []).map(l => l.said + ' ' + l.uses.join(' '))].join(' ').toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  }
  /* What a Library part is for, read as the project's own code is (lang/parts.js): the type most of its
     variants' lines are, for the chip beside it and the side shown at the top. */
  const libTypeCache = new Map();
  function libPartType(p) {
    if (!PARTS) return null;
    if (!libTypeCache.has(p.id)) {
      const tally = {};
      for (const v of p.variants) for (const x of PARTS.split(v.lang, v.text, v.file)) tally[x.type] = (tally[x.type] || 0) + (x.to - x.from + 1);
      libTypeCache.set(p.id, Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([t]) => t)[0] || null);
    }
    return libTypeCache.get(p.id);
  }
  const libInGroup = (p) => !groupFilter || p.variants.some(v => PARTS.split(v.lang, v.text, v.file).some(x => PARTS.involves(x).has(groupFilter)));
  function renderLibList() {
    const c = LIB.catalog(), q = libState.q.trim().toLowerCase(), box = $('libList'), scroll = box.scrollTop;
    const typeItem = (t) => `<button type="button" class="bp-item${libOn('type', t.id)}" data-lib-type="${escHtml(t.id)}"><b>${escHtml(t.title)}</b><span>${t.platforms.map(libPlat).join('')}${escHtml(t.about)}</span></button>`;
    const partItem = (p) => `<button type="button" class="bp-item${libOn('part', p.id)}" data-lib-part="${escHtml(p.id)}"><b>${escHtml(p.title)}${libPartType(p) ? ' ' + typeChip(libPartType(p)) : ''}</b><span>${libLangTags(p)}${escHtml(p.about)}</span></button>`;
    const parts = c.parts.filter(libInGroup);
    const tab = (v, label) => `<button type="button" class="bp-filter${libState.view === v ? ' on' : ''}" data-lib-view="${v}" aria-pressed="${libState.view === v}">${label}</button>`;
    let body;
    if (q) {
      const ts = c.types.filter(t => libFits(t, q)), ps = parts.filter(p => libFits(p, q));
      body = (ts.length ? `<div class="bp-group">Kinds of project</div>${ts.map(typeItem).join('')}` : '')
        + (ps.length ? `<div class="bp-group">Parts</div>${ps.map(partItem).join('')}` : '')
        || '<p class="bp-none">Nothing matches. Try fewer words, or a language\'s name.</p>';
    } else if (libState.view === 'types') {
      body = c.headings.map(h => `<div class="bp-group">${escHtml(h)}</div>${c.types.filter(t => t.heading === h).map(typeItem).join('')}`).join('');
    } else {
      body = (groupFilter ? `<p class="bp-none lib-side">Showing the parts with ${escHtml(typeName(groupFilter))} code (the side picked at the top). Press it again for all of them.</p>` : '')
        + c.groups.map(g => { const ps = parts.filter(p => p.group === g.id); return ps.length ? `<div class="bp-group" title="${escHtml(g.about)}">${escHtml(g.title)}</div>${ps.map(partItem).join('')}` : ''; }).join('');
    }
    box.innerHTML = `<div class="bp-filters" role="group" aria-label="List by">${tab('types', 'Kinds of project')}${tab('parts', 'Parts')}</div>${body}`;
    box.scrollTop = scroll;
  }

  /* A part's text, coloured: sentences as sentences, code and data as what they are. */
  const libHl = (v) => v.text.split('\n').map(l => (v.write === 'sentences' ? hlLine(l) : hlFileLine({ lang: v.lang }, l))).join('\n');
  /* What a sentences variant writes, compiled on its own (as a file of a project of one). */
  function libCompiled(v) {
    const p = normalized({ name: 'library', sections: [{ id: 'lib', path: v.file, lang: v.lang, text: v.text }], start: 'lib', active: 'lib' });
    const r = p && compileAll(p).results[p.sections[0].id];
    return r ? { text: r.text, problems: r.info.reduce((n, i) => n + i.errs.length, 0) } : null;
  }
  /* Where a variant goes in a project: { sec } to add to a file that's there, or { path } for a new one. */
  function libPlace(v, p) {
    const same = p.sections.find(s => s.path.toLowerCase() === v.file.toLowerCase());
    if (same && same.lang === v.lang) return { sec: same };
    if (v.write === 'sentences' && v.lang !== 'python') {
      // one program: the main page's file of that kind, or the start (or first) C++ / Arduino file
      const join = WEB_ROLE[v.lang] ? PRJ.webTriple(p.sections.filter(s => WEB_ROLE[s.lang]))[WEB_ROLE[v.lang]]
        : p.sections.find(s => s.lang === v.lang && s.id === p.start) || p.sections.find(s => s.lang === v.lang);
      if (join) return { sec: join };
      // the first of a website's files: the names its page links to (index.html, style.css, script.js)
      // (in the part's own folder, if it has one: static/index.html links static/script.js)
      const classic = WEB_ROLE[v.lang] && v.file.replace(/[^/]*$/, '') + PRJ.CLASSIC_PATH[WEB_ROLE[v.lang]];
      if (classic && !p.sections.some(s => s.path.toLowerCase() === classic.toLowerCase())) return { path: classic };
    }
    const sep = v.lang === 'python' ? '_' : '-', m = v.file.match(/^(.*?)(\.[^./]+)?$/);
    for (let n = 1, path = v.file; n < 50; n++, path = `${m[1]}${sep}${n}${m[2] || ''}`) {
      if (!p.sections.some(s => s.path.toLowerCase() === path.toLowerCase()) && !pathProblem(path, v.lang)) return { path };
    }
    return null;
  }
  /* The line that marks where a part starts in a file it joins: a note in sentences, a comment in code. */
  function libBanner(v, title) {
    if (v.write === 'sentences') return `note: ── Library: ${title} ──`;
    const l = LANGS.byId(v.lang) || {};
    if (v.lang === 'markdown') return `## ${title}`;
    return l.comment ? `${l.comment} Library: ${title}` : '';
  }
  /* What "Add" adds: every side of a Coding integration part, a website part's HTML, CSS and JavaScript together
   * (one feature in three files), or the one language picked. */
  const libSides = (p, v) => (p.group === 'integration' ? p.variants : WEB_ROLE[v.lang] && v.write === 'sentences' ? p.variants.filter(x => WEB_ROLE[x.lang] && x.write === 'sentences') : [v]);
  function libWhere(v, p, title) {
    const at = libPlace(v, p);
    if (!at) return 'There\'s no free name for it here. Rename a file first.';
    const banner = libBanner(v, title);
    if (at.sec && banner && at.sec.text.includes(banner)) return `It's already in ${escHtml(fileName(at.sec))}: adding it again makes a second copy.`;
    return at.sec ? `Joins ${escHtml(fileName(at.sec))}${at.sec.text.trim() ? ', at the end' : ''}.` : `Adds ${escHtml(at.path)} (${escHtml(v.name)}${v.write === 'sentences' ? ', in sentences' : ''}).`;
  }
  function addFromLibrary(part, vs) {
    activeSec().text = ta.value;
    const copy = JSON.parse(JSON.stringify(project)), done = [];
    let open = null;
    for (const v of vs) {
      const at = libPlace(v, copy);
      if (!at) { tLine(`There's no free name for ${v.file} in this project. Rename a file, then add ${part.title} again.`, 't-err'); return; }
      const banner = libBanner(v, part.title);
      if (at.sec) {
        const s = at.sec, before = s.text.replace(/\s+$/, '');
        s.text = (before ? before + '\n\n' : '') + (banner && !(v.lang === 'markdown' && /^#/.test(v.text)) ? banner + '\n' : '') + v.text + '\n';
        done.push(`${fileName(s)} (added at the end)`);
        open = open || s.id;
      } else {
        const s = { id: newId(), path: at.path, lang: v.lang, text: v.text + '\n' };
        copy.sections.push(s);
        done.push(`${at.path} (new)`);
        open = open || s.id;
      }
    }
    const made = done.some(d => /\(new\)$/.test(d)) && vs.some(v => v.lang === 'python');
    codeBase.clear();   // a part added on purpose: the code it changes elsewhere (imports, ids) is meant
    const err = changeProject(copy, open, `Added ${part.title} from the Library: ${done.join(', ')}.` + (made ? ' The start file can use its tools (it imports every other Python file).' : ''));
    if (err) { tLine(err, 't-err'); return; }
    closeLibrary();
  }

  function renderLibType(box, t) {
    const c = LIB.catalog(), kits = bldLibrary().kits;
    const parts = t.parts.map(id => c.partById[id]).filter(Boolean);
    const byGroup = c.groups.map(g => [g, parts.filter(p => p.group === g.id)]).filter(([, ps]) => ps.length);
    const fits = t.templates.filter(k => kits[k]);
    box.innerHTML = `<div class="bp-kind">Kind of project · ${escHtml(t.heading)}</div>
      <h3 class="bp-title">${escHtml(t.title)}</h3>
      <p class="bp-lead">${t.platforms.map(libPlat).join('')} ${escHtml(t.about)}</p>
      ${fits.length ? `<div class="bp-actions">${fits.map(k => `<button type="button" class="btn${fits[0] === k ? ' primary' : ''}" data-lib-template="${escHtml(k)}">Start from the template: ${escHtml(kits[k].title)}</button>`).join('')}</div>` : ''}
      <div class="lib-sec"><div class="ex-lbl">Languages it's written in</div>
        <table class="lib-langs"><thead><tr><th>Language</th><th>What it does here</th><th>Usual frameworks and libraries</th></tr></thead><tbody>
        ${t.languages.map(l => `<tr><td><b>${escHtml(l.lang ? langName(l.lang) : l.said)}</b>${l.lang && (LANGS.byId(l.lang) || {}).write === 'sentences' ? ' <span class="dim">in sentences</span>' : ''}</td><td>${escHtml(l.why)}</td><td>${escHtml(l.uses.join(', ')) || '<span class="dim">none needed</span>'}</td></tr>`).join('')}
        </tbody></table></div>
      ${t.learnFrom.length ? `<div class="lib-sec"><div class="ex-lbl">Open-source projects to learn from</div><ul class="lib-learn">
        ${t.learnFrom.map(l => `<li><b>${escHtml(l.name)}</b> <span class="dim">${escHtml(l.lang ? langName(l.lang) : l.said)} · ${escHtml(l.licence)}</span><span>${escHtml(l.what)}</span><span class="lib-url"><code>${escHtml(l.url)}</code><button type="button" class="btn tiny" data-lib-copy="${escHtml(l.url)}">Copy address</button></span></li>`).join('')}
        </ul><p class="bp-note">Addresses are shown, not opened: IntuaCode never follows links from inside the editor. Copy one into your browser. Read a project's licence before using its code in yours.</p></div>` : ''}
      <div class="lib-sec"><div class="ex-lbl">Parts it's usually made of</div>
        ${byGroup.map(([g, ps]) => `<div class="lib-group"><span class="dim">${escHtml(g.title)}</span>${ps.map(p => `<button type="button" class="lib-chip" data-lib-part="${escHtml(p.id)}" title="${escHtml(p.about)}">${escHtml(p.title)}</button>`).join('')}</div>`).join('') || '<p class="bp-none">None listed yet.</p>'}
      </div>`;
  }
  function renderLibPart(box, p) {
    const c = LIB.catalog(), group = c.groups.find(g => g.id === p.group);
    const langs = new Set(project.sections.map(s => s.lang));
    let v = p.variants.find(x => x.lang === libState.lang && x.file === libState.file) || p.variants.find(x => x.lang === activeSec().lang) || p.variants.find(x => langs.has(x.lang)) || p.variants[0];
    libState.lang = v.lang; libState.file = v.file;
    const sides = libSides(p, v), both = sides.length > 1;
    const compiled = v.write === 'sentences' ? libCompiled(v) : null;
    box.innerHTML = `<div class="bp-kind">Part · ${escHtml(group ? group.title : p.group)}</div>
      <h3 class="bp-title">${escHtml(p.title)}</h3>
      <p class="bp-lead">${escHtml(p.about)}</p>
      <p>${withCode(p.summary)}</p>
      ${p.learn ? `<p class="bp-note"><b>Learn first:</b> ${withCode(p.learn)}</p>` : ''}
      <div class="lib-tabs" role="tablist" aria-label="Languages">${p.variants.map(x => `<button type="button" role="tab" class="lib-tab${x === v ? ' on' : ''}" aria-selected="${x === v}" data-lib-lang="${escHtml(x.lang)}" data-lib-file="${escHtml(x.file)}"><b>${escHtml(x.name)}</b> <span class="dim">${escHtml(x.file)}</span></button>`).join('')}</div>
      <div class="lib-code-h"><span class="ex-lbl">${v.write === 'sentences' ? `Sentences, written as ${escHtml(v.name)}` : v.write === 'code' ? `${escHtml(v.name)} code` : escHtml(v.name)}</span><button type="button" class="btn tiny" id="libCopyText">Copy</button></div>
      <pre class="lib-code">${libHl(v)}</pre>
      ${compiled ? `<details class="lib-made"><summary>The ${escHtml(v.name)} it writes${compiled.problems ? ` <span class="ti-badge">${compiled.problems}</span>` : ''}</summary><pre class="lib-code">${compiled.text.replace(/\n$/, '').split('\n').map(l => hlFileLine({ lang: secLang({ lang: v.lang }) }, l)).join('\n')}</pre></details>` : ''}
      <p class="lib-where">${both ? `${p.group === 'integration' ? 'Adds every side' : 'Adds its page, styling and script together'}: ${sides.map(x => libWhere(x, project, p.title)).join(' ')}` : libWhere(v, project, p.title)}</p>
      <div class="bp-actions"><button type="button" class="btn primary" id="libAdd">${both ? `Add all ${sides.length} to the project` : 'Add to the project'}</button>${both ? '<button type="button" class="btn" id="libAddOne">Add only this one</button>' : ''}</div>
      ${p.types.length ? `<div class="lib-sec"><div class="ex-lbl">Used in</div><div class="lib-group">${p.types.map(id => c.typeById[id]).map(t => `<button type="button" class="lib-chip" data-lib-type="${escHtml(t.id)}">${escHtml(t.title)}</button>`).join('')}</div></div>` : ''}
      ${p.sources.length ? `<div class="lib-sec"><div class="ex-lbl">Where it comes from</div><ul class="lib-learn">${p.sources.map(s => `<li><b>${escHtml(s.name)}</b><span>${escHtml(s.what)}</span>${s.url ? `<span class="lib-url"><code>${escHtml(s.url)}</code><button type="button" class="btn tiny" data-lib-copy="${escHtml(s.url)}">Copy address</button></span>` : ''}</li>`).join('')}</ul></div>` : ''}`;
  }
  function renderLibDetail() {
    const box = $('libDetail'), c = LIB.catalog(), sel = libState.sel;
    const e = sel && (sel.kind === 'type' ? c.typeById[sel.id] : c.partById[sel.id]);
    if (!e) { box.innerHTML = '<p class="bp-none">Pick a kind of project or a part on the left.</p>'; return; }
    if (sel.kind === 'type') renderLibType(box, e); else renderLibPart(box, e);
    box.scrollTop = 0;
  }
  function openLibrary() {
    activeSec().text = ta.value;
    const c = LIB.catalog();
    if (c.errors.length) console.warn('Library:', c.errors);
    if (!libState.sel && c.types.length) libState.sel = { kind: 'type', id: c.types[0].id };
    renderLibList(); renderLibDetail();
    $('libModal').hidden = false;
    $('libSearch').focus();
  }
  function closeLibrary() { $('libModal').hidden = true; }
  const libPick = (kind, id) => { libState.sel = { kind, id }; if (kind === 'part') { libState.lang = null; libState.file = null; } renderLibList(); renderLibDetail(); };

  $('btnLibrary').hidden = !LIB;
  if (LIB) {
    $('btnLibrary').addEventListener('click', openLibrary);
    $('libClose').addEventListener('click', closeLibrary);
    $('libModal').addEventListener('click', (e) => { if (e.target.id === 'libModal') closeLibrary(); });
    $('libSearch').addEventListener('input', (e) => { libState.q = e.target.value; renderLibList(); });
    $('libList').addEventListener('click', (e) => {
      const view = e.target.closest('[data-lib-view]');
      if (view) { libState.view = view.dataset.libView; libState.q = ''; $('libSearch').value = ''; renderLibList(); return; }
      const t = e.target.closest('[data-lib-type]'), p = e.target.closest('[data-lib-part]');
      if (t) libPick('type', t.dataset.libType);
      else if (p) libPick('part', p.dataset.libPart);
    });
    $('libDetail').addEventListener('click', (e) => {
      const t = e.target.closest('[data-lib-type]'), p = e.target.closest('[data-lib-part]'), tab = e.target.closest('[data-lib-lang]');
      if (t) { libPick('type', t.dataset.libType); return; }
      if (p) { libPick('part', p.dataset.libPart); return; }
      if (tab) { libState.lang = tab.dataset.libLang; libState.file = tab.dataset.libFile; renderLibDetail(); return; }
      const cp = e.target.closest('[data-lib-copy]');
      if (cp) { copyText(cp.dataset.libCopy, cp, 'Copy address'); return; }
      const kit = e.target.closest('[data-lib-template]');
      if (kit) { closeLibrary(); bpSel = { src: 'kit', id: kit.dataset.libTemplate }; openBlueprints(); return; }
      const part = libState.sel && libState.sel.kind === 'part' && LIB.part(libState.sel.id);
      if (!part) return;
      const v = part.variants.find(x => x.lang === libState.lang && x.file === libState.file) || part.variants[0];
      if (e.target.id === 'libCopyText') copyText(v.text, e.target, 'Copy');
      if (e.target.id === 'libAdd') addFromLibrary(part, libSides(part, v));
      if (e.target.id === 'libAddOne') addFromLibrary(part, [v]);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Unity mode: the project's file in one pane; any part in sentences  */
  /* ------------------------------------------------------------------ */
  /* Unity is Split Mode's project in one pane instead of two. It shows the file open in the project, line for
   * line (lang/unity.js fromFile): its exact lines (python: …) as code, its sentences in green. Translate to Plain
   * Language Syntax turns selected code into sentences right where it is; Original Code turns a green part back
   * into code: exactly as it was if nobody changed it, or written in the context of the code around it (and the
   * project's other files) if they did. Every change is the project's file at once (toFile), so Split Mode, Run,
   * Problems and the Library all see the same file. */
  const UNITY = window.IntuiUnity;
  const UNITY_OLD = 'intuicode.unity.v1';   // Unity's own scratch file, from before it worked on the project
  const UNITY_KEY = 'intuicode.unity.v2';   // per file: Unity's view of it, used while the file is still what it made
  // what the scratch file started with (one that holds anything else is kept in the project, once: uMoveOldScratch)
  const UNITY_SAMPLES = [
    'import random\n\ndef roll(sides):\n    n = random.randint(1, sides)\n    if n == sides:\n        print("Top roll!")\n    return n\n\ntotal = 0\nfor i in range(3):\n    total += roll(6)\nprint("Total:", total)\n',
    'function total(prices) {\n  let sum = 0;\n  for (const p of prices) {\n    sum += p;\n  }\n  return sum;\n}\n\nconsole.log(total([3, 4, 5]));\n',
    '<main>\n  <h1>Hello</h1>\n  <div id="box">\n    <p>Some words.</p>\n    <button id="go">Go</button>\n  </div>\n</main>\n',
    '.card {\n  color: #333333;\n  padding: 12px;\n}\n\n.card:hover {\n  color: red;\n}\n',
    '#include <iostream>\n\nint main() {\n    int count = 0;\n    for (int i = 1; i <= 5; i++) {\n        count += i;\n    }\n    std::cout << "Total: " << count << std::endl;\n    return 0;\n}\n',
    'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n',
  ];
  let uViews = store.get(UNITY_KEY, {});
  if (!uViews || typeof uViews !== 'object' || Array.isArray(uViews)) uViews = {};
  // the file Unity shows: id, lang (null for a file with no sentences: notes, data, other code), text, regions
  let unity = { id: null, lang: null, text: '', regions: [] };
  // what Original Code changed, while its button is a pressed Revert (see uOriginal)
  let uBack = null;   // { id, which: 'uRe' | 'uReAll', text, regions, predict, caret, scroll, after }
  const U_RE = { uRe: ['Original Code', $('uRe').title], uReAll: ['Original Code (all)', $('uReAll').title] };
  const uTa = $('uTa');
  let uBefore = [''], uCaret = -1, uProblems = [], uStripTimer = 0, uFrame = 0, uViewsTimer = 0;   // (uStripTimer: the help, a moment after the cursor stops)
  const uCan = (sec) => !!UNITY && !!sec && UNITY.LANGS.includes(sec.lang);
  const uSec = () => project.sections.find(s => s.id === unity.id);
  const uCodeLang = () => (unity.lang === 'arduino' ? 'cpp' : unity.lang);
  const uLines = () => uTa.value.split('\n');
  const uRegionAt = (n) => unity.regions.findIndex(r => n >= r.from && n <= r.to);
  const uLineOf = (pos) => uTa.value.slice(0, pos).split('\n').length - 1;
  const uPosOf = (line) => uLines().slice(0, line).reduce((n, l) => n + l.length + 1, 0);

  /* The writers, and the project to write in: a file's text compiled with the project's other files, so the
     names they make are known. */
  function uCompileIn(lang, text) {
    const sec = uSec();
    if (!sec || sec.lang !== lang) return null;
    try { return compileAll({ ...project, sections: project.sections.map(s => (s.id === sec.id ? { ...s, text } : s)) }).results[sec.id] || null; }
    catch (e) { console.error(e); return null; }
  }
  const uW = () => ({ LANG, WEB, CPP, compile: uCompileIn });

  /* Unity's view of a file, kept while the file is still what it made (so code turned into sentences here goes
     back exactly as it was); null if the file has changed since. */
  function uKept(sec) {
    const v = uViews[sec.id];
    if (!v || typeof v.text !== 'string' || !Array.isArray(v.regions)) return null;
    try {
      const lines = v.text.split('\n');
      const ok = v.regions.every(r => r && Number.isInteger(r.from) && Number.isInteger(r.to) && r.from >= 0 && r.to >= r.from && r.to < lines.length && Array.isArray(r.words) && typeof r.base === 'string' && (r.original === null || Array.isArray(r.original)));
      return ok && UNITY.toFile(sec.lang, lines, v.regions) === sec.text ? v : null;
    } catch (_) { return null; }
  }
  /* Unity's view of a file whose text changed since (in Split Mode, say): the parts that weren't touched keep
     their place, as code or as green parts; edited green parts keep their code to compare with; new sentences
     are green parts of their own, and exact lines are code. */
  function uViewFor(sec) {
    const kept = uKept(sec);
    if (kept) return { text: kept.text, regions: JSON.parse(JSON.stringify(kept.regions)) };
    const f = UNITY.fromFile(sec.lang, sec.text), v = uViews[sec.id];
    if (!v || typeof v.text !== 'string' || !Array.isArray(v.regions)) return { text: f.lines.join('\n'), regions: f.regions };
    try {
      const was = UNITY.toFile(sec.lang, v.text.split('\n'), v.regions).split('\n'), now = String(sec.text).replace(/\r\n?/g, '\n').split('\n');
      const regions = UNITY.adjust(JSON.parse(JSON.stringify(v.regions)), was, now, -1).filter(r => r.from >= 0 && r.to < now.length && r.to >= r.from);
      const inR = (n) => regions.some(r => n >= r.from && n <= r.to);
      // the rest as a file would be read (a kept part's lines stand in as code, so no new part runs across one)
      const rest = UNITY.fromFile(sec.lang, now.map((l, n) => (inR(n) ? UNITY.RAW[sec.lang] + '…' : l)).join('\n'));
      return { text: now.map((l, n) => (inR(n) ? l : f.lines[n])).join('\n'), regions: regions.concat(rest.regions).sort((a, b) => a.from - b.from) };
    } catch (e) { console.error(e); return { text: f.lines.join('\n'), regions: f.regions }; }
  }
  /* The project's open file, as Unity shows it. */
  function uLoad() {
    activeSec().text = ta.value;
    const sec = activeSec();
    if (!uCan(sec)) unity = { id: sec.id, lang: null, text: sec.text, regions: [] };
    else {
      const v = uViewFor(sec);
      unity = { id: sec.id, lang: sec.lang, text: v.text, regions: v.regions };
      uGiveCode();
    }
    uTa.value = unity.text;
    uBefore = unity.text.split('\n');
    uProblems = [];
  }
  /* Sentences from Split Mode (or the Library) come with no code of their own: each green part gets the code
     its sentences make now, so Original Code on one nobody changes gives exactly that. A part whose sentences
     can't be code yet gets none, and is written when they can. */
  function uGiveCode() {
    const lines = unity.text.split('\n');
    unity.regions.forEach((r, i) => {
      if (r.original || !UNITY.unchanged(r, lines)) return;
      try {
        const out = UNITY.toCode(unity.lang, lines, unity.regions, i, uW());
        if (!out.problems.some(p => p.errs.length)) { r.original = out.code; r.needs = out.needs; }
      } catch (e) { console.error(e); }
    });
  }
  /* Unity's text is the project's file: written back at every change, as Split Mode's typing is. */
  function uCommit() {
    const sec = uSec();
    if (!sec) return;
    unity.text = uTa.value;
    const text = unity.lang ? UNITY.toFile(unity.lang, unity.text.split('\n'), unity.regions) : unity.text;
    if (unity.lang) {
      uViews[sec.id] = { text: unity.text, regions: unity.regions };
      clearTimeout(uViewsTimer);
      uViewsTimer = setTimeout(() => {
        for (const id of Object.keys(uViews)) if (!project.sections.some(s => s.id === id)) delete uViews[id];
        store.set(UNITY_KEY, uViews);
      }, 300);
    }
    if (text === sec.text) return;
    sec.text = text;
    if (sec.id === project.active) ta.value = text;
    lastEdit = { title: metaOf(sec).title, line: uLineOf(uTa.selectionStart) };
    autosave(); save(); scheduleCompile();
  }
  function uSetText(text) { uTa.value = text; unity.text = text; uBefore = text.split('\n'); uCommit(); }
  /* Show the project's open file (after another file is opened, or the project changes). */
  function unityShow(line) {
    uLoad();
    if (uFromSplit()) { uTa.value = unity.text; uBefore = unity.text.split('\n'); uCommit(); }
    renderUnity();
    if (line != null) uGoTo(line);
  }
  function uGoTo(line) {
    const p = uPosOf(line) + (uLines()[line] || '').length;
    uTa.focus();
    uTa.setSelectionRange(p, p);
    const lh = parseFloat(getComputedStyle(uTa).lineHeight) || 22;
    uTa.scrollTop = Math.max(0, line * lh - 40);
    uTools();
  }

  /* Split Mode's left pane is always sentences. A file shown there with code parts (from Original Code in Unity,
     or typed as exact lines) has them said in sentences; Unity gets them back as code (uFromSplit): exactly as
     they were if nothing changed in Split Mode, or written from the sentences as they are now. Lines no
     sentence can say stay as exact code. */
  const splitBack = {};    // file id -> { before: Unity's view, after: its text once said in sentences }
  const splitTried = {};   // file id -> its text after the last try (so it isn't read again until it changes)
  const splitTold = {};    // file id -> what was said about lines that stay as code (said once)
  let splitBusy = false;
  async function splitPlain() {
    if (!UNITY || mode !== 'write' || splitBusy) return;
    const sec = activeSec();
    sec.text = ta.value;
    if (!uCan(sec) || splitTried[sec.id] === sec.text || !sec.text.split('\n').some(l => UNITY.EXACT[sec.lang].test(l))) return;
    const id = sec.id, fileText = sec.text;
    uLoad();
    const lines = unity.text.split('\n');
    if (!lines.some((l, n) => l.trim() && uRegionAt(n) < 0)) { splitTried[id] = fileText; return; }   // exact lines only inside green parts
    const before = { text: unity.text, regions: JSON.parse(JSON.stringify(unity.regions)) };
    splitBusy = true;
    ta.readOnly = true;
    const slow = setTimeout(() => tLine(`Saying the code in ${fileName(sec)} in sentences for Split Mode…`, 't-sys'), 600);
    let d = null;
    try {
      for (const r of unity.regions) r.was = true;   // the parts it had: the new ones are the code just said
      d = await UNITY.deRegex(unity.lang, lines, unity.regions, 0, lines.length - 1, uConvert, { body: unity.lang === 'cpp' });
    } catch (e) { console.error(e); }
    finally { clearTimeout(slow); splitBusy = false; ta.readOnly = false; for (const r of unity.regions) delete r.was; }
    const still = mode === 'write' && activeSec().id === id && activeSec().text === fileText && unity.id === id;
    if (d && still) {
      if (d.done.length) {
        const caret = ta.selectionStart, top = ta.scrollTop;
        unity.regions = d.regions.map(r => { const { was, ...x } = r; return was ? x : { ...x, auto: true }; });
        uSetText(d.lines.join('\n'));   // the file, and Split Mode's pane
        splitBack[id] = { before, after: unity.text };
        ta.setSelectionRange(Math.min(caret, ta.value.length), Math.min(caret, ta.value.length));
        refreshAll(); measure(); ta.scrollTop = top; syncScroll();
      }
      const span = (p) => (p.from === p.to ? `line ${p.from + 1}` : `lines ${p.from + 1}–${p.to + 1}`);
      const left = d.failed.map(f => `${span(f)} (${f.reason})`).concat(d.blocked.map(b => `${span(b)} (they hold sentences that can't be code yet)`));
      const told = left.join('; ');
      if (left.length && splitTold[id] !== told) tLine(`${fileName(sec)}: ${told} stay${left.length === 1 && !/^lines/.test(told) ? 's' : ''} as exact code in Split Mode.`, 't-err');
      splitTold[id] = told;
      splitTried[id] = activeSec().text;
    }
    if (mode === 'write' && activeSec().id !== id) splitPlain();   // another file was opened meanwhile
  }
  /* Back in Unity: what Split Mode said in sentences is code again. true if anything changed. */
  function uFromSplit() {
    if (!unity.lang) return false;
    const back = splitBack[unity.id];
    delete splitBack[unity.id];
    if (back && unity.text === back.after) {   // nothing changed in Split Mode: exactly as it was
      unity.text = back.before.text;
      unity.regions = JSON.parse(JSON.stringify(back.before.regions));
      return true;
    }
    if (!unity.regions.some(r => r.auto)) return false;
    let lines = unity.text.split('\n');
    for (let i = unity.regions.length - 1; i >= 0; i--) {
      if (!unity.regions[i].auto) continue;
      let r = null;
      try { r = UNITY.reRegex(unity.lang, lines, unity.regions, i, uW()); } catch (e) { console.error(e); }
      if (r && r.ok) { lines = r.lines; unity.regions = r.regions; }
      else delete unity.regions[i].auto;   // sentences that can't be code yet stay as sentences, with their problems
    }
    unity.text = lines.join('\n');
    return true;
  }

  /* Unity's text from before it worked on the project: if it held anything but its sample, it's kept in the
     project as a note (once), so nothing is lost. */
  function uMoveOldScratch() {
    const old = store.get(UNITY_OLD, null);
    if (!old) return;
    try { localStorage.removeItem(UNITY_OLD); } catch (_) { /* storage unavailable */ }
    if (typeof old.text !== 'string' || !old.text.trim() || UNITY_SAMPLES.includes(old.text)) return;
    let path = 'unity-notes.md';
    for (let n = 2; project.sections.some(s => s.path.toLowerCase() === path) && n < 50; n++) path = `unity-notes-${n}.md`;
    const fence = old.text.includes('```') ? '~~~' : '```';
    const lang = typeof old.lang === 'string' ? old.lang : '';
    const text = `# Unity notes\n\nWhat was in Unity before it worked on the project's files${lang ? ` (${langName(lang)})` : ''}. The parts that were green are the sentences.\n\n${fence}${LANGS.extOf(lang) || ''}\n${old.text.replace(/\n+$/, '')}\n${fence}\n`;
    const copy = JSON.parse(JSON.stringify(project));
    copy.sections.push({ id: newId(), path, lang: 'markdown', text });
    const err = changeProject(copy, null, `Unity now works on the project's files. What it held before is kept in ${path}.`);
    if (err) tLine(err, 't-err');
  }

  /* The readers, for Translate: Python's (checked exact, in the page's Python), and the web and C++ one. */
  async function uConvert(kind, source) {
    if (kind === 'python') {
      if (!(await ensurePython())) return { ok: false, reason: 'Python couldn\'t start in the page, so Python can\'t be read here' };
      const R = await Runner.reader((s) => setStatus(s));
      const out = checkedSentences(R, source);
      if (!out.ok) return { ok: false, reason: out.error };
      return { ok: true, text: out.text, exact: !!out.check.same, reason: out.check.same ? null : 'the check found code that comes back different, so it stays as exact code' };
    }
    const env = await convertEnv(), web = compiled && compiled.web, sec = uSec();
    // a website's Styling and Mechanics are read knowing the page's names, so "Quote" is said as Quote
    if (web && sec && (kind === 'js' || kind === 'css') && (sec.file === 'styling' || sec.file === 'mechanics')) {
      env.ids = Object.fromEntries(Object.entries(web.ids || {}).map(([k, v]) => [k, v.tag]));
      env.groups = Object.keys({ ...web.groups, ...web.cssGroups });
    }
    const r = window.IntuiConvert.toSentences(kind, source, env);
    return r.ok ? r : { ok: false, reason: r.error || r.reason };
  }

  function renderUnity() {
    if (!UNITY) return;
    const sec = uSec() || activeSec();
    if (uTa.value !== unity.text) uTa.value = unity.text;
    const lines = unity.text.split('\n'), code = uCodeLang();
    const bad = new Map(uProblems.map(p => [p.line, p.errs.length ? 'err' : 'warn']));
    const looks = lineLooks(sec, lines.length), linked = linkedLines(sec.id);
    let at = 0;
    const lineHtml = (l, words) => { const i = at++; return `<div class="ul${looks[i] ? ' ' + looks[i] : ''}${linked.has(i) ? ' lk' : ''}${words && EXACT_LINE.test(l) ? ' kept' : ''}">${(words ? hlLine(l) : unity.lang ? hlCode(code, l) : hlFileLine(sec, l)) || '​'}</div>`; };
    const sorted = unity.regions.slice().sort((a, b) => a.from - b.from);
    let html = '', n = 0;
    for (const r of sorted) {
      while (n < r.from) html += lineHtml(lines[n++], false);
      html += `<div class="u-region${UNITY.unchanged(r, lines) ? '' : ' changed'}">${lines.slice(r.from, r.to + 1).map(l => lineHtml(l, true)).join('')}</div>`;
      n = r.to + 1;
    }
    while (n < lines.length) html += lineHtml(lines[n++], false);
    $('uHl').innerHTML = html;
    $('uGutter').innerHTML = lines.map((_, i) => `<div class="gl${uRegionAt(i) >= 0 ? ' u-in' : ''}${bad.has(i) ? ' ' + bad.get(i) : ''}">${i + 1}</div>`).join('');
    $('uTitle').textContent = fileName(sec);
    $('uSub').textContent = unity.lang ? `${langName(sec.lang)}, in one pane. The green parts are sentences.` : `${langName(sec.lang)}, as it is: it has no sentences, so nothing here turns green.`;
    uSync(); uTools();
    if (mode === 'unity') updateChip();
  }
  function uSync() {
    $('uHl').scrollTop = uTa.scrollTop; $('uHl').scrollLeft = uTa.scrollLeft;
    $('uGutter').style.transform = `translateY(${-uTa.scrollTop}px)`;
    uFloatPos();
  }
  function uSelLines() {
    const a = uTa.selectionStart, b = uTa.selectionEnd;
    let to = uLineOf(b);
    if (b > a && uTa.value[b - 1] === '\n') to--;   // a selection that ends at the start of a line leaves that line out
    const from = uLineOf(a);
    return { from, to: Math.max(from, to) };
  }
  /* Is there code (outside the green parts) in the selection, or on the cursor's line? */
  function uHasCode() {
    if (!unity.lang) return false;
    const { from, to } = uSelLines(), lines = uLines();
    for (let n = from; n <= to; n++) if (uRegionAt(n) < 0 && lines[n].trim()) return true;
    return false;
  }
  function uTools() {
    const at = uRegionAt(uLineOf(uTa.selectionStart));
    uBackButtons();
    $('uDe').disabled = !uHasCode();
    $('uRe').disabled = at < 0 && uBack?.which !== 'uRe';
    $('uReAll').disabled = !unity.regions.length && uBack?.which !== 'uReAll';
    uFloatPos();
    clearTimeout(uStripTimer); uStripTimer = setTimeout(renderExplain, 120);
  }
  /* A Translate to Plain Language Syntax button just above a selection of code. */
  function uFloatPos() {
    const f = $('uFloat'), a = uTa.selectionStart, b = uTa.selectionEnd;
    const { from } = uSelLines();
    if (mode !== 'unity' || b <= a || !uHasCode() || (document.activeElement !== uTa && document.activeElement !== f)) { f.hidden = true; return; }
    const lh = parseFloat(getComputedStyle(uTa).lineHeight) || 22;
    f.style.top = Math.max(4, 12 + from * lh - uTa.scrollTop - lh - 2) + 'px';
    f.hidden = false;
  }
  /* The help under Unity's pane: Split Mode's help, for the line Unity's cursor is on. In a green part, the
     sentence you wrote and the code Original Code gives for it (with its problems, its shape and its words); on
     a line of code, what's in it and the part it belongs to; with nothing there, how Unity works. */
  function renderExplainUnity() {
    if (!UNITY || mode !== 'unity') return;
    const box = $('explain'), sec = uSec() || activeSec();
    const li = uLineOf(uTa.selectionStart), lines = uLines(), text = lines[li] || '', at = uRegionAt(li), code = uCodeLang();
    const part = partAt(sec, li), selected = uTa.selectionEnd > uTa.selectionStart;
    const partCell = part ? `<div class="ex-cell"><span class="ex-lbl">In the part · lines ${part.from + 1}–${part.to + 1}</span><div class="ex-part">${typeChip(part.type)} <b>${escHtml(part.title)}</b></div><div class="dim">${escHtml(PARTS.typeOf(part.type).about)}</div></div>` : '';
    if (at >= 0) {
      const r = unity.regions[at], items = [];
      let label, out = null;
      if (r.original && UNITY.unchanged(r, lines)) label = 'Original Code gives back, exactly';
      else {
        try { out = UNITY.toCode(unity.lang, lines, unity.regions, at, uW()); } catch (e) { items.push(`<li class="err">The writer hit a problem: ${escHtml(e.message)}</li>`); }
        if (out) {
          out.problems.forEach(p => { p.errs.forEach(e => items.push(`<li class="err">Line ${p.line + 1}: ${withCode(e)}</li>`)); p.warns.forEach(w => items.push(`<li class="warn">Line ${p.line + 1}: ${withCode(w)}</li>`)); });
          label = out.problems.some(p => p.errs.length) ? 'Can\'t go back to code yet' : 'Original Code will write';
        }
      }
      const codeLines = out ? (out.problems.some(p => p.errs.length) ? [] : out.code) : r.original || [];
      box.innerHTML = `<div class="ex-map">
          <div class="ex-cell"><span class="ex-lbl">You wrote · line ${li + 1}</span><div class="ex-say">${escHtml(text.trim()) || '<span class="dim">(an empty line)</span>'}</div></div>
          <div class="ex-arrow" aria-hidden="true">→</div>
          <div class="ex-cell"><span class="ex-lbl">${escHtml(label || 'Code')} · ${escHtml(langName(sec.lang))}</span><div class="ex-py">${codeLines.map(l => hlCode(code, l)).join('\n') || '<span class="dim">Nothing yet.</span>'}</div></div>
        </div>
        ${text.trim() ? shapeHtml(sec, text) : ''}
        ${items.length ? `<ul class="ex-notes">${items.slice(0, 5).join('')}</ul>` : ''}
        ${out && out.problems.some(p => p.line === li && p.errs.some(e => UNKNOWN_LINE.test(e))) ? closeMatchesHtml(sec, text, li, 'unity') : ''}
        ${out && out.needs.length ? `<p class="ex-guide">It adds at the top: ${out.needs.map(x => `<code>${escHtml(x)}</code>`).join(', ')}</p>` : ''}
        <p class="ex-foot"><span>Green part · lines ${r.from + 1}–${r.to + 1}${part ? ` · ${escHtml(PARTS.typeOf(part.type).name)}` : ''}</span><span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> Original Code</span></p>`;
      return;
    }
    if (!text.trim() && !selected) {
      box.innerHTML = `<p class="ex-guide">${withCode(metaOf(sec).purpose)}.</p>
        <div class="ex-hint">${unity.lang ? '<span>Select some code and press <b>Translate to Plain Language Syntax</b> (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>): it\'s said in sentences, right where it is, in green.</span><span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> turns a green part back into code</span>' : `<span>${escHtml(langName(sec.lang))} has no sentences in IntuaCode: change it here as it is, and the help reads it to you.</span>`}<span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs the program</span><span>Start from an idea: <b>Project Templates</b>, or add parts from the <b>Library</b>.</span><span><b>Interface</b>, <b>Mechanics</b>, <b>Setup</b>, <b>Data</b> and <b>Tests</b>, at the top, show only that kind of part.</span></div>`;
      return;
    }
    const a = !unity.lang && (LANGS.byId(sec.lang) || {}).write === 'code' ? readOf(sec) : null;
    const said = a && a.sections && a.sections.find(s => li + 1 >= s.start && li + 1 <= s.end);
    box.innerHTML = `<div class="ex-map">
        <div class="ex-cell"><span class="ex-lbl">${escHtml(langName(sec.lang))} · line ${li + 1}</span><div class="ex-py">${(unity.lang ? hlCode(code, text.trim()) : hlFileLine(sec, text.trim())) || '<span class="dim">(an empty line)</span>'}</div></div>
        ${partCell}
      </div>
      ${said ? `<p class="ex-guide"><b>${escHtml(said.title)}:</b> ${rich(said.headline || '')}</p>` : ''}
      ${unity.lang ? partsHtml(sec, text) : ''}
      <p class="ex-foot"><span>${unity.lang ? (selected ? 'Press <b>Translate to Plain Language Syntax</b> to say the selection in sentences' : 'Select code and press <b>Translate to Plain Language Syntax</b> to say it in sentences') : 'Kept exactly as written'}</span></p>`;
  }


  /* Predictive Mode in Unity: in a green part, the rest of the sentence being typed shows dim after the cursor
     (sentences written before, the project's own, the Library's, then the sentence patterns). → takes it all,
     Ctrl+→ one word, Esc puts it away. */
  let uGhostRest = '', uCharW = 0;
  function uPredictFor(typed, li) {
    const sec = uSec();
    if (!sec || !PRED) return '';
    const lines = (predictMem[sec.lang] || []).slice();
    for (const s of project.sections) {
      if (s.lang !== sec.lang) continue;
      s.text.split('\n').forEach((l, i) => { if (s.id !== sec.id || i !== li) lines.push(l); });
    }
    lines.push(...librarySentences(sec.lang));
    const h = PRED.history(typed, lines, 1)[0] || webMatches(sec, typed, 1)[0];
    if (h) return h;
    const low = typed.toLowerCase(), t = packFor(sec).templates.find(x => x.pattern.toLowerCase().startsWith(low) && x.pattern.toLowerCase() !== low);
    if (t) return t.pattern;
    for (const x of packFor(sec).templates) { const r = PRED.after(typed, x.pattern); if (r) return typed + r; }   // the rest, once its blanks are filled in
    return '';
  }
  function uUpdateGhost() {
    const g = $('uGhost');
    const hide = () => { uGhostRest = ''; if (!g.hidden) g.hidden = true; };
    if (!predictOn() || mode !== 'unity' || document.activeElement !== uTa) return hide();
    const a = uTa.selectionStart;
    if (a !== uTa.selectionEnd) return hide();
    const li = uLineOf(a), line = uLines()[li] || '';
    if (a - uPosOf(li) !== line.length) return hide();   // at the end of its line
    const sec = uSec() || activeSec();
    let rest = '';
    const inRegion = unity.lang && uRegionAt(li) >= 0;
    const raw = inRegion && codeContext(sec, line);   // an exact line in a green part: html: …, python: …
    if (inRegion && !raw) {
      const typed = line.trim();
      if (typed.length < 2) return hide();
      rest = PRED.rest(typed, uPredictFor(typed, li));
    } else if (COMPLETE) {
      // code: Unity shows a file's code lines as code, so the line is the code itself
      const lang = raw ? raw.lang : unity.lang ? (sec.lang === 'arduino' ? 'arduino' : unity.lang) : sec.lang;
      const c = COMPLETE.complete(lang, raw ? raw.before : line, uTa.value, { glossary: window.IntuiGlossaryTerms });
      rest = c ? c.rest : '';
    }
    if (!rest) return hide();
    const cs = getComputedStyle(uTa);
    if (!uCharW) {
      const probe = document.createElement('span');
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
      probe.textContent = 'x'.repeat(100);
      document.body.appendChild(probe); uCharW = probe.getBoundingClientRect().width / 100 || 8.4; probe.remove();
    }
    uGhostRest = rest;
    g.innerHTML = escHtml(rest).replace(/‹([^›]*)›/g, '<span class="s-slot">‹$1›</span>');
    g.style.font = `${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
    g.style.top = ((parseFloat(cs.paddingTop) || 12) + li * (parseFloat(cs.lineHeight) || 22) - uTa.scrollTop) + 'px';
    g.style.left = ((parseFloat(cs.paddingLeft) || 14) + line.replace(/\t/g, '    ').length * uCharW - uTa.scrollLeft) + 'px';
    g.hidden = false;
  }

  /* A close match, used in Unity: the line becomes that sentence (keeping its indentation), its first ‹blank› selected. */
  function uUseSentence(pattern, li) {
    const start = uPosOf(li), line = uLines()[li] || '', indent = line.match(/^\s*/)[0];
    uTa.focus();
    uTa.setSelectionRange(start, start + line.length);
    document.execCommand('insertText', false, indent + pattern);
    const at = uTa.value.indexOf('‹', start);
    const end = at >= 0 ? uTa.value.indexOf('›', at) : -1;
    if (at >= 0 && end > at && at < start + indent.length + pattern.length) uTa.setSelectionRange(at, end + 1);
    uTools();
  }

  /* The code in the selection into sentences. The green parts in it are sentences already and stay as they are,
     so a selection can take in everything. */
  async function uDeRegex() {
    if (!UNITY) return;
    if (!unity.lang) { tLine(`This file is ${langName((uSec() || activeSec()).lang)}, which has no sentences in IntuaCode, so it stays as it is.`, 't-sys'); return; }
    const lines = uLines(), sel = uSelLines(), id = unity.id;
    if (!uHasCode()) {   // all sentences already: nothing to do
      if (!unity.regions.some(r => r.from <= sel.to && r.to >= sel.from)) tLine('Select some code first: Translate to Plain Language Syntax turns it into sentences.', 't-sys');
      return;
    }
    $('uDe').disabled = true;
    let d;
    // a project's C++ file is its program's main (IntuaCode writes the main around it), so its code is read as inside one
    try { d = await UNITY.deRegex(unity.lang, lines, unity.regions, sel.from, sel.to, uConvert, { body: unity.lang === 'cpp' }); }
    catch (e) { tLine('That part couldn\'t be read: ' + e.message, 't-err'); uTools(); return; }
    if (unity.id !== id || uLines().join('\n') !== lines.join('\n')) { tLine('The code changed while it was being read. Try again.', 't-sys'); uTools(); return; }
    const span = (p) => (p.from === p.to ? `${p.from + 1}` : `${p.from + 1}–${p.to + 1}`);
    const lineWord = (ps) => (ps.length === 1 && ps[0].from === ps[0].to ? 'line ' : 'lines ') + ps.map(span).join(', ');
    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    for (const b of d.blocked) tLine(`${cap(lineWord([b]))} stay as code: they're one statement with sentences that have changed or can't be code yet (${lineWord(b.changed)}). Press Original Code on those first.`, 't-err');
    for (const f of d.failed) tLine(`${cap(lineWord([f]))} couldn't be said in sentences: ${f.reason}.`, 't-err');
    if (!d.done.length) { uTools(); return; }
    unity.regions = d.regions;
    uSetText(d.lines.join('\n'));
    uTa.focus();
    const first = unity.regions.find(r => r.from === d.done[0].from);
    const pos = uPosOf(d.done[0].from) + (first ? first.base.length : 0);
    uTa.setSelectionRange(pos, pos);
    uProblems = [];
    renderUnity();
    const grew = d.done.some(p => p.from < sel.from || p.to > sel.to), loose = d.done.find(p => !p.exact);
    tLine(`Translated ${lineWord(d.done)}: they're sentences now${grew ? ' (the selection grew to take in whole statements)' : ''}. Original Code puts code back.`
      + (loose ? ` Some of it stays as exact code: ${loose.reason}.` : ''), loose ? 't-err' : 't-sys');
  }
  function uReRegex(i, quiet) {
    const r = UNITY.reRegex(unity.lang, uLines(), unity.regions, i, uW());
    if (!r.ok) {
      uProblems = r.problems;
      renderUnity();
      const p = r.problems.find(x => x.errs.length);
      if (!quiet && p) tLine(`Line ${p.line + 1}: ${p.errs[0]}${/stays as sentences/.test(p.errs[0]) ? '' : ' It stays as sentences until that\'s fixed.'}`, 't-err');
      return false;
    }
    const caret = uTa.selectionStart;
    unity.regions = r.regions;
    uSetText(r.lines.join('\n'));
    uTa.setSelectionRange(Math.min(caret, uTa.value.length), Math.min(caret, uTa.value.length));
    uProblems = [];
    renderUnity();
    if (r.needs.length) tLine(`Added ${r.needs.map(x => '`' + x + '`').join(', ')} at the top: the new code needs ${r.needs.length === 1 ? 'it' : 'them'}.`, 't-sys');
    const warn = r.problems.flatMap(p => p.warns.map(w => `line ${p.line + 1}: ${w}`))[0];
    if (warn && !quiet) tLine('Back to code, with a warning on ' + warn, 't-sys');
    return true;
  }
  function uReRegexAll() {
    let ok = 0, left = 0;
    for (let i = unity.regions.length - 1; i >= 0; i--) { if (uReRegex(i, true)) ok++; else left++; }
    if (left) tLine(`${ok ? ok + ' back to code; ' : ''}${left} stay${left === 1 ? 's' : ''} as sentences until ${left === 1 ? 'its' : 'their'} problems are fixed (the red line numbers).`, 't-err');
    else if (ok) tLine('Every green part is code again.', 't-sys');
  }

  /* Original Code, and back. Pressing Original Code (or Original Code (all)) keeps what Unity had (the text,
     the green parts, Predictive Mode), turns Predictive Mode off, and makes that button a pressed Revert.
     Revert puts all of it back. Any change to the text since, and Revert is Original Code again. */
  function uBackButtons() {
    if (uBack && (uBack.id !== unity.id || uTa.value !== uBack.after)) uBack = null;
    for (const id of ['uRe', 'uReAll']) {
      const b = $(id), on = uBack?.which === id;
      b.textContent = on ? 'Revert' : U_RE[id][0];
      b.setAttribute('aria-pressed', String(on));
      b.title = on ? `Put the sentences, and Predictive Mode, back as they were before ${U_RE[id][0]}${id === 'uRe' ? ' (Ctrl+Shift+B)' : ''}` : U_RE[id][1];
    }
  }
  function uOriginal(which) {
    uBackButtons();
    if (uBack?.which === which) { uRevert(); return; }
    // pressed again on the other button: Revert still goes back to before the first press
    const snap = uBack || { id: unity.id, text: uTa.value, regions: JSON.parse(JSON.stringify(unity.regions)), predict: !!layout.predict, caret: uTa.selectionStart, scroll: uTa.scrollTop };
    const before = uTa.value;
    if (which === 'uRe') { const i = uRegionAt(uLineOf(uTa.selectionStart)); if (i >= 0) uReRegex(i); }
    else uReRegexAll();
    if (uTa.value === before) { uTools(); return; }   // nothing became code (each part has a problem)
    uBack = { ...snap, which, after: uTa.value };
    if (layout.predict) { layout.predict = false; store.set(LAYOUT_KEY, layout); applyPredict(); }
    uTools();
  }
  function uRevert() {
    const b = uBack;
    uBack = null;
    unity.regions = JSON.parse(JSON.stringify(b.regions));
    uSetText(b.text);
    uProblems = [];
    const c = Math.min(b.caret, uTa.value.length);
    uTa.setSelectionRange(c, c);
    uTa.scrollTop = b.scroll;
    if (b.predict !== !!layout.predict) setPredict(b.predict);
    renderUnity();
    uTa.focus({ preventScroll: true });
    tLine('Reverted: the sentences are back as they were.', 't-sys');
  }

  if (UNITY) {
    uTa.addEventListener('beforeinput', () => { uCaret = uRegionAt(uLineOf(uTa.selectionStart)); });
    uTa.addEventListener('input', () => {
      const now = uTa.value.split('\n');
      unity.regions = UNITY.adjust(unity.regions, uBefore, now, uCaret);
      uBefore = now;
      uProblems = [];
      uCommit();
      // drawn at most once a frame, however fast the typing (the regions above are already right); a timer,
      // not requestAnimationFrame, so it still draws when the window isn't in front
      if (!uFrame) uFrame = setTimeout(() => { uFrame = 0; renderUnity(); }, 16);
    });
    uTa.addEventListener('scroll', () => { uSync(); uUpdateGhost(); });
    for (const ev of ['select', 'click', 'keyup', 'focus']) uTa.addEventListener(ev, uTools);
    for (const ev of ['input', 'click', 'keyup', 'blur']) uTa.addEventListener(ev, () => setTimeout(uUpdateGhost, 0));
    uTa.addEventListener('blur', () => setTimeout(uFloatPos, 0));
    uTa.addEventListener('keydown', (e) => {
      if (uGhostRest && e.key === 'ArrowRight' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        document.execCommand('insertText', false, e.ctrlKey || e.metaKey ? PRED.nextWord(uGhostRest) : uGhostRest);
        return;
      }
      if (uGhostRest && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); uGhostRest = ''; $('uGhost').hidden = true; return; }
      if (e.key === 'Enter' && PRED && unity.lang && uRegionAt(uLineOf(uTa.selectionStart)) >= 0) {
        // a sentence entered is remembered, as a terminal keeps its history
        const line = (uLines()[uLineOf(uTa.selectionStart)] || '').trim(), lang = unity.lang;
        if (PRED.worth(line)) { predictMem[lang] = PRED.remember(predictMem[lang] || [], line); store.set(PREDICT_KEY, predictMem); }
      }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const unit = UNITY.unitOf(uLines()), at = uPosOf(uLineOf(uTa.selectionStart));
        if (e.shiftKey) { const cut = uTa.value.slice(at).match(/^(?:\t| {1,4})/); if (cut) { uTa.setSelectionRange(at, at + cut[0].length); document.execCommand('delete'); } }
        else document.execCommand('insertText', false, unity.regions.some(r => r.from <= uLineOf(uTa.selectionStart) && r.to >= uLineOf(uTa.selectionStart)) ? '    ' : unit);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (mode !== 'unity' || !e.ctrlKey || !e.shiftKey || e.altKey) return;
      if (e.key === 'D' || e.key === 'd') { e.preventDefault(); uDeRegex(); }
      if (e.key === 'B' || e.key === 'b') { e.preventDefault(); uOriginal('uRe'); }
    });
    $('uDe').addEventListener('click', uDeRegex);
    $('uFloat').addEventListener('mousedown', (e) => e.preventDefault());   // keeps the selection
    $('uFloat').addEventListener('click', uDeRegex);
    $('uRe').addEventListener('click', () => { uOriginal('uRe'); uTa.focus({ preventScroll: true }); });
    $('uReAll').addEventListener('click', () => uOriginal('uReAll'));
    $('uCopy').addEventListener('click', (e) => {
      const sec = uSec() || activeSec();
      uCommit();
      refreshAll();
      if (isSentences(sec) && issues(sec, 'errs')) { tLine(`${fileName(sec)} has problems (in Problems), so its code wasn't copied. Fix them first.`, 't-err'); return; }
      copyText(codeOf(sec), e.target, 'Copy the code');
    });
  } else $('modeUnity').hidden = true;

  /* ------------------------------------------------------------------ */
  /* Modes: Unity (one pane of code, any part in sentences, where       */
  /* IntuaCode opens) and Split Mode (sentences on the left, the code    */
  /* they make on the right). Both work on the same project's files.     */
  /* ------------------------------------------------------------------ */

  const MODE_KEY = 'intuicode.mode.v1';
  const SKIP_DIRS = new Set(['venv', '.venv', 'env', '.env', 'node_modules', '__pycache__', '.git', 'site-packages', 'build', 'dist', '.tox', '.mypy_cache', '.pytest_cache', '.idea', '.vscode']);
  const EXTRA_FILE = /(^|\/)(readme(\.\w+)?|requirements[\w.-]*\.txt|pyproject\.toml|pipfile|package\.json)$/i;
  const CODE_FILE = /\.(py|jsx?|mjs|cjs|tsx?|html?|css|cpp|cc|cxx|hpp|hh|h|ino)$/i;   // what the Python and web readers read
  /* The language a file's name says (the highlighter's and the converter's: an Arduino sketch is C++ to them). */
  const langOfPath = (p) => { const l = LANGS.fromPath(p); return l === 'arduino' ? 'cpp' : l; };
  let importTop = '';   // the folder an imported project came in, left off the paths it's shown with
  const shortPath = (p) => (importTop && p.startsWith(importTop + '/') ? p.slice(importTop.length + 1) : p);
  /* Reader text: `code` as code, and [[path]] / [[path#name]] as the name of that file or part. */
  const rich = (s) => withCode(s).replace(/\[\[([^\]#]+)(?:#([^\]]+))?\]\]/g, (m, path, name) => `<code>${name || shortPath(path)}</code>`);

  function setMode(next) {
    if (next === 'unity' && !UNITY) next = 'write';
    if (isolated()) pvWhole = true;   // Unity or Split Mode picked while only parts were shown: back to the editor
    if (maxed && next !== mode) setMax(maxed);   // full screen belongs to the mode it was opened in
    if (mode === 'write' && next === 'unity') activeSec().text = ta.value;
    mode = next;
    store.set(MODE_KEY, next);
    hideTip();
    closeAc();
    $('modeWrite').setAttribute('aria-selected', String(next === 'write'));
    $('modeUnity').setAttribute('aria-selected', String(next === 'unity'));
    $('unityView').hidden = next !== 'unity';
    $('writeView').hidden = next !== 'write';
    applyIsolate();
    $('writeSide').classList.toggle('in-unity', next === 'unity');
    $('work').classList.toggle('unity', next === 'unity');
    $('work').classList.toggle('web', webOn());
    renderImages();
    showBottom(project.kind === 'website' ? 'preview' : 'terminal');
    updateChip();
    if (next === 'unity') { uMoveOldScratch(); unityShow(); $('uTa').focus(); }
    else { ta.value = activeSec().text; refreshAll(); measure(); syncScroll(); splitPlain(); }
    if (!$('index').hidden) renderIndex();
  }
  $('modeWrite').addEventListener('click', () => setMode('write'));
  $('modeUnity').addEventListener('click', () => setMode('unity'));

  /* Python -> sentences, checked. Safety net: any statement that doesn't come back exactly is kept
   * as a python: line and the check runs again. */
  function checkedSentences(R, src) {
    let force = [], res, check;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = R.toSentences(src, force);
      if (!res.ok) return { ok: false, error: res.error };
      check = R.compare(src, LANG.compileProject({ sections: [{ id: 'main', file: 'main', text: res.text }] }).results.main.text);
      if (check.same || check.error || !check.differs.length) break;
      force = force.concat(check.differs.map(d => d[0]));
    }
    return { ok: true, text: res.text, check, kept: force.length };
  }

  /* HTML, CSS, JavaScript, C++ and Arduino code -> a Write-mode project, checked exact. */
  async function convertEnv() {
    const WR = await Runner.webReader((st) => setStatus(st));
    await WR.loadLangs(['html', 'css', 'js', 'cpp']);
    return { parse: WR.parse, WEB, CPP };
  }
  function reportConversion(parts) {
    for (const [label, r] of parts) {
      if (!r) continue;
      if (r.exact) tLine(`✓ ${label}: checked, the sentences make exactly the same code as the original. ${r.words} of ${r.lines} lines read as sentences${r.kept ? `; ${r.kept} stay as exact code` : ''}.`, 't-ok');
      else tLine(`${label}: ${r.reason} Check it before relying on it.`, 't-err');
    }
  }
  /* Returns { project, results: [[label, result]], exact } or null (with the reason shown). */
  async function codeToProject(file, files, name) {
    const C = window.IntuiConvert;
    const env = await convertEnv();
    const lang = langOfPath(file.name);
    if (lang === 'cpp') {
      const ino = /\.ino$/i.test(file.name);
      const r = C.toSentences(ino ? 'arduino' : 'cpp', file.source, env);
      if (!r.ok) { tLine(`${shortPath(file.name)} can't be turned into sentences: ${r.error}`, 't-err'); return null; }
      const sec = ino ? 'sketch' : 'program';
      const locals = [...r.text.matchAll(/^include "([^"]+)"/gm)].map(m => m[1]);
      if (locals.length) tLine(`Note: this program also uses ${locals.join(', ')} from its own folder. Those files aren't part of the sentences, so keep them next to ${ino ? 'the sketch' : 'main.cpp'} when you save.`, 't-sys');
      return { project: { version: 1, lang: 'python', kind: ino ? 'arduino' : 'cpp', name: slug(name || baseName(file.name).replace(/\.\w+$/, '')), sections: [{ id: sec, file: sec, text: r.text }], active: sec }, results: [[shortPath(file.name), r]], exact: r.exact };
    }
    // a web page with its own styles and script, or a lone style sheet or script
    const htmlFiles = files.filter(f => langOfPath(f.name) === 'html');
    let page = lang === 'html' ? file : null;
    if (!page) page = htmlFiles.find(h => { const i = C.pageInfo(env.parse, h.source); return i.styles.concat(i.scripts.map(x => x.src)).some(ref => C.resolveRef(h.name, ref, files.map(f => f.name)) === file.name); }) || null;
    const sections = { structure: '', styling: '', mechanics: '' };
    const results = [];
    if (page) {
      const w = C.website(page, files, env);
      if (!w.parts.structure.ok) { tLine(`${shortPath(page.name)} can't be turned into sentences: ${w.parts.structure.error}`, 't-err'); return null; }
      sections.structure = w.parts.structure.text;
      results.push([shortPath(page.name), w.parts.structure]);
      if (w.parts.styling) { sections.styling = w.parts.styling.text; results.push([w.cssFiles.map(shortPath).join(' + '), w.parts.styling]); }
      if (w.parts.mechanics) { sections.mechanics = w.parts.mechanics.text; results.push([shortPath(w.jsPath), w.parts.mechanics]); }
      for (const n of w.notes) tLine('Note: ' + n, 't-sys');
    } else {
      const r = C.toSentences(lang === 'css' ? 'css' : 'js', file.source, env);
      if (!r.ok) { tLine(`${shortPath(file.name)} can't be turned into sentences: ${r.error}`, 't-err'); return null; }
      sections[lang === 'css' ? 'styling' : 'mechanics'] = r.text;
      results.push([shortPath(file.name), r]);
    }
    const nm = name || (page ? (page.name.split('/').length > 1 ? page.name.split('/')[0] : baseName(page.name).replace(/\.\w+$/, '')) : baseName(file.name).replace(/\.\w+$/, ''));
    return { project: { version: 1, lang: 'python', kind: 'website', name: slug(nm), sections: ['structure', 'styling', 'mechanics'].map(f => ({ id: f, file: f, text: sections[f] })), active: page ? 'structure' : lang === 'css' ? 'styling' : 'mechanics' }, results, exact: results.every(([, r]) => r.exact) };
  }

  /* ---------- Import: paste, files, a folder, a .zip, or drag and drop ---------- */

  function keepPath(path) {
    const parts = path.replace(/\\/g, '/').split('/');
    if (parts.slice(0, -1).some(p => SKIP_DIRS.has(p) || p.endsWith('.egg-info'))) return null;
    const name = parts[parts.length - 1];
    if (name === '.env' || name.startsWith('.env.')) return 'secret';
    if (name.endsWith('.py')) return 'py';
    if (CODE_FILE.test(name)) return 'web';
    if (EXTRA_FILE.test(path)) return 'extra';
    if (LANGS.fromPath(name) !== 'text') return 'code';   // any other language IntuaCode knows
    return null;
  }

  async function filesToProject(list) {   // list of {path, file}
    const out = [];
    let skipped = 0;
    for (const { path, file } of list) {
      const kind = keepPath(path);
      if (!kind) { skipped++; continue; }
      if (kind === 'secret') { out.push({ name: path, source: '' }); continue; }
      if (file.size > 600000) { skipped++; continue; }
      out.push({ name: path, source: (await file.text()).replace(/\r\n?/g, '\n') });
      if (out.length >= 400) break;
    }
    return { files: out, skipped };
  }

  function openImport() { $('impModal').hidden = false; $('impNote').textContent = ''; $('impText').focus(); }
  // the languages IntuaCode knows, for pasted code and for choosing files
  $('impLang').innerHTML = '<option value="">Auto-detect</option>' + LANGS.LANGUAGES.filter(l => l.id !== 'text').map(l => `<option value="${l.id}">${escHtml(l.name)}</option>`).join('');
  $('impFiles').accept = [...new Set(LANGS.LANGUAGES.flatMap(l => l.exts))].map(e => '.' + e).concat('.pyw', 'text/plain').join(',');
  function closeImport() { $('impModal').hidden = true; $('impCard').classList.remove('dropping'); }
  $('btnImport').addEventListener('click', openImport);
  $('btnImport2').addEventListener('click', openImport);
  $('impClose').addEventListener('click', closeImport);
  $('impModal').addEventListener('click', (e) => { if (e.target.id === 'impModal') closeImport(); });

  /* ------------------------------------------------------------------ */
  /* File menu and New project                                           */
  /* ------------------------------------------------------------------ */

  function setFileMenu(open) {
    $('fileList').hidden = !open;
    $('btnFile').setAttribute('aria-expanded', String(open));
    if (open) { const first = [...$('fileList').querySelectorAll('[role="menuitem"]')].find(b => !b.hidden); if (first) first.focus(); }
  }
  $('btnFile').addEventListener('click', () => setFileMenu($('fileList').hidden));
  $('fileList').addEventListener('click', (e) => { if (e.target.closest('[role="menuitem"]')) setFileMenu(false); });
  document.addEventListener('click', (e) => { if (!$('fileList').hidden && !e.target.closest('#fileMenu')) setFileMenu(false); });
  $('fileList').addEventListener('keydown', (e) => {
    const items = [...$('fileList').querySelectorAll('[role="menuitem"]')].filter(b => !b.hidden);
    const at = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); }
    else if (e.key === 'Escape') { e.stopPropagation(); setFileMenu(false); $('btnFile').focus(); }
  });

  const NEW_KINDS = [
    { id: 'script', layout: 'script', title: 'Python', about: 'One file of steps: main.py' },
    { id: 'structured', layout: 'structured', title: 'Python in parts', about: 'Settings, Tools and a Main program' },
    { id: 'website', layout: 'website', title: 'Website', about: 'Structure, Styling and Mechanics (HTML, CSS, JavaScript) with a live preview' },
    { id: 'cpp', layout: 'cpp', title: 'C++ program', about: 'main.cpp, compiled on this computer (desktop app)' },
    { id: 'arduino', layout: 'arduino', title: 'Arduino sketch', about: 'For a board plugged in by USB (desktop app)' },
    { id: 'files', layout: 'files', title: 'Your own files', about: 'A README to start; add files in any language, notes and folders with Menu → New file' },
  ];
  // What a folder starts with: a website its title, a sketch its two parts. The rest start empty.
  const NEW_START = {
    structure: (name) => `page title is "${name.replace(/["\\{}]/g, '')}"`,
    sketch: () => 'when the board starts\n    note: runs once, when the board powers on\nover and over\n    note: runs again and again',
  };
  let newKind = 'script';
  function renderNewKinds() {
    $('newKinds').innerHTML = NEW_KINDS.map(k => `<button type="button" role="radio" class="new-kind" data-kind="${k.id}" aria-checked="${k.id === newKind}" tabindex="${k.id === newKind ? 0 : -1}"><b>${escHtml(k.title)}</b><span>${escHtml(k.about)}</span></button>`).join('');
  }
  function chooseNewKind(id) { newKind = id; renderNewKinds(); $('newKinds').querySelector(`[data-kind="${id}"]`).focus(); }
  function openNewProject() {
    setFileMenu(false);
    renderNewKinds();
    $('newSaveRow').hidden = !desk.on;
    $('newModal').hidden = false;
    $('newName').focus(); $('newName').select();
  }
  function closeNewProject() { $('newModal').hidden = true; }
  function createNewProject() {
    const k = NEW_KINDS.find(x => x.id === newKind);
    const name = $('newName').value.trim() || 'My project';
    const sections = k.layout === 'files'
      ? [{ id: 'readme', path: 'README.md', lang: 'markdown', text: `# ${name}\n\nWhat this project is for, and how its files fit together.\n` }]
      : LAYOUTS[k.layout].map(f => ({ id: f, file: f, text: NEW_START[f] ? NEW_START[f](name) : '' }));
    const next = { version: 2, lang: 'python', kind: KIND_OF_LAYOUT[k.layout] || 'python', name: slug(name), sections, active: k.layout === 'website' ? 'structure' : sections[sections.length - 1].id };
    const askFolder = desk.on && $('newSave').checked;
    closeNewProject();
    replaceProject(next, `New ${k.title} project "${name}".` + (desk.on && !askFolder ? ' Press Save to keep it as files.' : ''));
    ta.focus();
    if (askFolder) saveProject();   // asks where
  }
  $('btnNew').addEventListener('click', openNewProject);
  $('newClose').addEventListener('click', closeNewProject);
  $('newGo').addEventListener('click', createNewProject);
  $('newModal').addEventListener('click', (e) => { if (e.target.id === 'newModal') closeNewProject(); });
  $('newKinds').addEventListener('click', (e) => { const b = e.target.closest('.new-kind'); if (b) chooseNewKind(b.dataset.kind); });
  $('newKinds').addEventListener('keydown', (e) => {   // arrow keys move between the kinds, as in any radio group
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = NEW_KINDS.findIndex(k => k.id === newKind);
    chooseNewKind(NEW_KINDS[(i + step + NEW_KINDS.length) % NEW_KINDS.length].id);
  });
  $('newName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); createNewProject(); } });

  /* ------------------------------------------------------------------ */
  /* Project builder: questions -> a kit of components -> a project     */
  /* with a map of ordered steps (Walk, Hallway, Horizon)                */
  /* ------------------------------------------------------------------ */

  const BUILDER = window.IntuiBuilder;
  const bld = { trail: [], kit: null, ticked: new Set(), edit: null, preview: new Set() };   // trail: the options chosen so far; edit: the templates editor
  const depthChip = (d) => `<span class="depth d-${d}">${BUILDER.DEPTHS[d].label}</span>`;
  // Your own questions, kits and steps, as plain text. They come after the built-in ones, so one with the same id replaces it.
  const MY_KITS_KEY = 'intuicode.kits.v1';
  let myKits = store.get(MY_KITS_KEY, []);   // [{ id, source }]
  let bldLib = null;
  const bldLibrary = () => bldLib || (bldLib = BUILDER.libraryWith(myKits.map(m => m.source)));
  const saveKits = () => { store.set(MY_KITS_KEY, myKits); bldLib = null; };

  function openBuilder() {
    setFileMenu(false);
    closeNewProject();
    bld.trail = []; bld.kit = null; bld.edit = null; bld.preview = new Set();
    $('builderModal').hidden = false;
    renderBuilder();
  }
  function closeBuilder() { $('builderModal').hidden = true; }
  /* Open the builder part-way: with a shelf's answers already given, or at a kit with its usual steps ticked. */
  function openBuilderAt(labels) {
    openBuilder();
    const lib = bldLibrary(), chain = BUILDER.followLabels(lib, labels), last = chain[chain.length - 1];
    bld.trail = chain.map(o => ({ label: o.label, next: o.next }));
    if (last && last.kit) { const kit = lib.kits[last.kit]; bld.kit = last.kit; bld.ticked = new Set(last.ticked || (kit ? kit.steps.filter(s => s.ticked).map(s => s.id) : [])); }
    renderBuilder();
  }
  function openBuilderAtKit(id) {
    openBuilder();
    const lib = bldLibrary(), kit = lib.kits[id];
    bld.trail = (BUILDER.pathToKit(lib, id) || []).map(o => ({ label: o.label, next: o.next }));
    bld.kit = id;
    bld.ticked = new Set(kit ? kit.steps.filter(s => s.ticked).map(s => s.id) : []);
    renderBuilder();
  }
  /* Straight to one entry in the templates editor, in its form (yours if you've changed it, or a copy of the built-in one). */
  function openKitEditorAt(kind, id) {
    openBuilder();
    const { built, mine } = kitEntries();
    const e = mine.find(x => x.kind === kind && x.id === id) || built.find(x => x.kind === kind && x.id === id);
    bld.edit = { sel: e ? { src: e.src, i: e.i } : null, text: null, editing: null, form: null };
    if (e && kind !== 'question') { bld.edit.editing = { src: e.src, i: e.i }; bld.edit.form = formFrom(kitSource(e)); }
    renderBuilder();
  }

  /* The three stages of planning, always in view: what you're making, its steps, its name. */
  function renderStages(stage) {
    const names = ['What you\'re making', 'Its steps', 'Name it and build'];
    $('bldStages').innerHTML = names.map((n, i) => `<li class="${i + 1 < stage ? 'done' : i + 1 === stage ? 'now' : ''}"${i + 1 === stage ? ' aria-current="step"' : ''}><span class="bld-stage-n">${i + 1 < stage ? '✓' : i + 1}</span>${n}</li>`).join('');
  }
  function renderBuilder() {
    $('bldStages').hidden = !!bld.edit;
    if (bld.edit) return renderKitEditor();
    const lib = bldLibrary();
    renderStages(bld.kit ? 2 : 1);
    $('bldPath').innerHTML = [`<button type="button" class="bld-crumb" data-back="0">Start</button>`]
      .concat(bld.trail.map((t, i) => `<span class="bld-sep" aria-hidden="true">›</span><button type="button" class="bld-crumb" data-back="${i + 1}"${i === bld.trail.length - 1 ? ' aria-current="step"' : ''}>${escHtml(t.label)}</button>`)).join('')
      + '<button type="button" class="bld-crumb bld-edit-lib" id="bldEditLib">Change the kits and steps</button>';
    if (bld.kit) return renderKit(lib.kits[bld.kit]);
    const qid = bld.trail.length ? bld.trail[bld.trail.length - 1].next : 'start', q = lib.questions[qid];
    if (!q) { $('bldBody').innerHTML = `<p class="sum-empty">There's no question called "${escHtml(qid)}" in the templates. Go back, or add it with "Change the kits and steps".</p>`; return; }
    const tag = (o) => (o.kit && lib.kits[o.kit] ? platTag(lib.kits[o.kit].platform) : '');
    $('bldBody').innerHTML = `<h3 class="bld-ask">${escHtml(q.ask)}</h3>
      <div class="new-kinds bld-options">${q.options.map((o, i) => `<button type="button" class="new-kind" data-opt="${i}"><b>${escHtml(o.label)}</b><span>${tag(o)}${escHtml(o.means.replace(/^(PC|Phone|Web|Board) · /, ''))}</span></button>`).join('')}</div>
      <p class="bld-alt">Or <button type="button" class="linklike" id="bldToLibrary">browse every kit and blueprint in Project Templates</button>.</p>`;
    const first = $('bldBody').querySelector('.new-kind');
    if (first) first.focus();
  }

  const FOLDER_LABEL = { settings: 'Settings', tools: 'Tools', main: 'Main program', structure: 'Structure', styling: 'Styling', mechanics: 'Mechanics', start: 'when the board starts', loop: 'over and over' };
  const LAYOUT_LABEL = { script: 'Python, one file', structured: 'Python: Settings, Tools and Main program', website: 'A website: Structure, Styling and Mechanics', arduino: 'An Arduino sketch' };
  const LAYOUT_FOLDERS = { script: ['main'], structured: ['settings', 'tools', 'main'], website: ['structure', 'styling', 'mechanics'], arduino: ['settings', 'start', 'loop'] };
  /* A step's sentences, as they'll be written, folder by folder. */
  function stepPreview(c) {
    const parts = Object.entries(c.sections || {}).filter(([, ls]) => ls.some(l => l.trim()));
    if (!parts.length) return '<p class="dim bld-preview-none">No sentences: this step is a direction to aim for, explained in its summary.</p>';
    return parts.map(([f, ls]) => `<div class="bld-preview-f"><span class="ex-lbl">${escHtml(FOLDER_LABEL[f] || f)}</span><pre>${ls.join('\n').replace(/\n+$/, '').split('\n').map(l => hlLine(l)).join('\n')}</pre></div>`).join('');
  }
  function renderKit(kit) {
    const lib = bldLibrary();
    if (!kit) { $('bldBody').innerHTML = '<p class="sum-empty">This part of the templates isn\'t written yet. Go back and choose another path.</p>'; return; }
    const chosen = kit.steps.filter(s => lib.components[s.id] && (s.always || bld.ticked.has(s.id)));
    let n = 0;
    const rows = kit.steps.map(s => {
      const c = lib.components[s.id];
      if (!c) return '';
      const on = s.always || bld.ticked.has(s.id), open = bld.preview.has(s.id);
      return `<div class="bld-step${on ? ' on' : ''}">
        <label><input type="checkbox" data-step="${escHtml(s.id)}"${on ? ' checked' : ''}${s.always ? ' disabled' : ''}>
          <span class="bld-n">${on ? ++n : ''}</span>
          <span class="bld-main"><span class="bld-name"><b>${escHtml(c.name)}</b> ${depthChip(c.depth)}${s.always ? ' <span class="dim">always part of it</span>' : ''}</span>
          <span class="bld-sum">${withCode(c.summary)}</span></span></label>
        <div class="bld-step-tools">
          <button type="button" class="linklike" data-preview="${escHtml(s.id)}" aria-expanded="${open}">${open ? 'Hide its sentences' : c.depth === 'horizon' ? 'What it involves' : 'Preview its sentences'}</button>
          ${c.usual || c.learn ? `<details class="bld-more"><summary>Usually made with, learn first</summary>${c.usual ? `<p><b>Usually made with:</b> ${withCode(c.usual)}</p>` : ''}${c.learn ? `<p><b>Learn first:</b> ${withCode(c.learn)}</p>` : ''}</details>` : ''}
        </div>
        ${open ? `<div class="bld-preview">${stepPreview(c)}</div>` : ''}
      </div>`;
    }).join('');
    const scroll = $('bldBody').querySelector('.bld-steps') ? $('bldBody').querySelector('.bld-steps').scrollTop : 0;
    const name = $('bldName') ? $('bldName').value : kit.title;
    const count = (d) => chosen.filter(s => lib.components[s.id].depth === d).length;
    const preset = (id, label, title) => `<button type="button" class="bld-preset" data-preset="${id}" title="${escHtml(title)}">${label}</button>`;
    $('bldBody').innerHTML = `<div class="bld-kit">
      <div class="bld-kit-main">
        <div class="bld-kit-h"><h3>${escHtml(kit.title)} ${platTag(kit.platform)}</h3><p>${escHtml(kit.about)}</p></div>
        <div class="bld-presets" role="group" aria-label="Start from"><span class="dim">Start from</span>
          ${preset('min', 'The smallest that works', 'Only the steps it can\'t do without')}${preset('usual', 'The usual', 'The steps most projects like this have')}${preset('all', 'Everything', 'Every step, horizons included')}</div>
        <div class="bld-steps">${rows}</div>
      </div>
      <aside class="bld-plan" aria-label="Your plan">
        <h4>Your plan</h4>
        <ol class="bld-plan-list">${chosen.map(s => { const c = lib.components[s.id]; return `<li><span>${escHtml(c.name)}</span>${depthChip(c.depth)}</li>`; }).join('')}</ol>
        <p class="bld-plan-sum">${chosen.length} step${chosen.length === 1 ? '' : 's'}${['walk', 'hallway', 'horizon'].filter(count).map(d => ` · ${count(d)} ${d}`).join('')}</p>
        <ul class="bld-plan-key">${['walk', 'hallway', 'horizon'].map(d => `<li>${depthChip(d)} ${escHtml({ walk: 'written for you, ready to run', hallway: 'the shape is there; you fill in the ‹blanks›', horizon: 'what it is and what to learn: for later' }[d])}</li>`).join('')}</ul>
        <label class="bld-name-l" for="bldName">Name</label>
        <input id="bldName" value="${escHtml(name)}" spellcheck="false" autocomplete="off">
        <button type="button" class="btn primary bld-go" id="bldGo">Build my project</button>
        <p class="imp-note">The project you have now is kept: type "restore" in the terminal to swap back.</p>
        <button type="button" class="linklike bld-change" id="bldChange">Change this kit…</button>
      </aside>
    </div>`;
    $('bldBody').querySelector('.bld-steps').scrollTop = scroll;
  }

  function builderGo() {
    const kit = bldLibrary().kits[bld.kit];
    const name = ($('bldName').value || '').trim() || kit.title;
    const { project: next } = BUILDER.build(bldLibrary(), kit.id, [...bld.ticked], slug(name), bld.trail.map(t => t.label));
    closeBuilder();
    replaceProject(next, `Built "${name}" from its plan: ${next.plan.steps.length} steps, in the order you'd build them. The project map on the left explains each one.`);
    const blanks = project.sections.reduce((k, s) => k + (s.text.match(/‹[^›]*›/g) || []).length, 0);
    if (blanks) tLine(`Hallway steps have ${blanks} ‹blank${blanks === 1 ? '' : 's'}› for you to fill in: Problems on the left lists them.`, 't-sys');
  }

  $('bldClose').addEventListener('click', closeBuilder);
  $('builderModal').addEventListener('click', (e) => { if (e.target.id === 'builderModal') closeBuilder(); });
  $('bldPath').addEventListener('click', (e) => {
    if (e.target.id === 'bldEditLib') { bld.edit = { sel: null, text: null, editing: null, form: null }; return renderBuilder(); }
    if (e.target.id === 'bldEditDone') { const k = bld.edit && bld.edit.fromKit; bld.edit = null; if (k && bldLibrary().kits[k]) { bld.kit = k; } else { bld.trail = []; bld.kit = null; } return renderBuilder(); }
    const b = e.target.closest('[data-back]');
    if (!b) return;
    bld.trail = bld.trail.slice(0, +b.dataset.back); bld.kit = null;
    renderBuilder();
  });

  /* ------------------------------------------------------------------ */
  /* Changing the kits and steps: forms for kits and steps (plain text   */
  /* underneath, and "Edit as text" for anything the forms don't cover). */
  /* A built-in entry is changed as a copy: yours has the same id, so it */
  /* replaces the built-in one; delete yours to put it back.             */
  /* ------------------------------------------------------------------ */
  const ENTRY_GROUP = { kit: 'Kits', component: 'Steps', question: 'Questions' };
  const NEW_ENTRY = {
    component: 'component: my-step\nname: My step\ndepth: walk\nsummary: Its role in the whole project, in plain words.\nusual: What people usually make it with.\nlearn: What to learn first.\ncheck: How to check it\'s done, in one line.\n== main\nshow "Hello from my step"',
    kit: 'kit: my-kit\ntitle: My kind of project\nlayout: website\nshelf: tools\nplatform: web\nabout: One line shown above its list of steps.\nsteps: ',
    question: 'question: my-question\nask: What should it do?\noption: Something | What that means | kit my-kit',
  };
  const kitSource = (sel) => (sel.src === 'built' ? BUILDER.BUILT_IN[sel.i] : myKits[sel.i].source);
  function kitEntries() {
    const mine = myKits.map((m, i) => ({ ...BUILDER.describeEntry(m.source), src: 'mine', i }));
    const yours = new Set(mine.map(m => m.kind + ':' + m.id));
    const built = BUILDER.BUILT_IN.map((s, i) => ({ ...BUILDER.describeEntry(s), src: 'built', i })).map(b => ({ ...b, replaced: yours.has(b.kind + ':' + b.id) }));
    return { built, mine };
  }
  /* What all the templates say about an entry (a kit listing a step that isn't written yet, say), with this text in its place. */
  function kitLinkProblems(text, editing) {
    const d = BUILDER.describeEntry(text);
    if (!d.id) return [];
    return BUILDER.libraryWith(sourcesWith(text, editing)).problems.filter(p => p.includes(`"${d.id}"`));
  }
  /* Your entries, with this text saved in place of the one being edited (or added). */
  function sourcesWith(text, editing) {
    const sources = myKits.map(m => m.source);
    if (editing && editing.src === 'mine') sources[editing.i] = text; else sources.push(text);
    return sources;
  }
  const kitProblemsHtml = (own, link) => own.map(p => `<div>${escHtml(p)}</div>`).join('') + link.map(p => `<div class="kit-link">${escHtml(p)} (Fine while you write it; the builder skips it until then.)</div>`).join('');

  /* An entry's text as a form, and back. Head lines the form doesn't show are kept as they are. */
  function formFrom(text) {
    const { head, sections, blanks } = BUILDER.parseEntry(text);
    if (head.kit != null) return { kind: 'kit', id: head.kit, head, steps: (head.steps || '').split(',').map(x => x.trim()).filter(Boolean).map(x => ({ id: x.replace(/[!*]+$/, ''), always: /!$/.test(x), ticked: /[!*]$/.test(x) })) };
    if (head.component != null) return { kind: 'component', id: head.component, head, sections: Object.fromEntries(Object.entries(sections).map(([f, ls]) => [f, ls.join('\n')])), blanks: blanks.map(b => [b.slot, b.kind, b.hint, b.example].join(' | ')).join('\n') };
    return null;
  }
  const oneLine = (v) => String(v || '').replace(/\s*\n\s*/g, ' ').trim();
  function formText(f) {
    const lines = [`${f.kind}: ${f.id}`];
    const order = f.kind === 'kit' ? ['title', 'layout', 'shelf', 'platform', 'asks', 'about'] : ['name', 'depth', 'summary', 'usual', 'learn', 'check'];
    for (const k of order) if (oneLine(f.head[k])) lines.push(`${k}: ${oneLine(f.head[k])}`);
    for (const [k, v] of Object.entries(f.head)) if (k !== f.kind && k !== 'steps' && !order.includes(k) && oneLine(v)) lines.push(`${k}: ${oneLine(v)}`);
    if (f.kind === 'component') for (const l of String(f.blanks || '').split('\n')) if (l.trim()) lines.push('blank: ' + l.trim().replace(/^blank:\s*/i, ''));
    if (f.kind === 'kit') lines.push('steps: ' + f.steps.map(s => s.id + (s.always ? '!' : s.ticked ? '*' : '')).join(', '));
    else if (f.head.depth !== 'horizon') for (const [folder, t] of Object.entries(f.sections || {})) if (String(t).trim()) lines.push(`== ${folder}`, String(t).replace(/\s+$/, ''));
    return lines.join('\n');
  }
  /* Does the kit build? Its project, made with these entries saved, compiled: problems other than blanks to fill. */
  function buildCheck(sources, kitId, onlySteps) {
    const lib = BUILDER.libraryWith(sources), kit = lib.kits[kitId];
    if (!kit) return null;
    const ids = (onlySteps || kit.steps.map(s => s.id)).filter(id => lib.components[id]);
    let p, res;
    try {
      p = BUILDER.build(lib, kitId, ids, 'check', []).project;
      res = p.kind === 'website' ? WEB.compileWebsite(p) : p.kind === 'arduino' ? CPP.compileCppProject(p) : LANG.compileProject(p);
    } catch (e) { return { problems: ['It couldn\'t be put together: ' + e.message], blanks: 0, steps: ids.length }; }
    const problems = [];
    let blanks = 0;
    for (const s of p.sections) (res.results[s.id] ? res.results[s.id].info : []).forEach((inf, i) => inf.errs.forEach(e => (/^Fill in the ‹/.test(e) ? blanks++ : problems.push(`${FOLDER_LABEL[s.file] || s.file} · line ${i + 1}: ${e}`))));
    return { problems, blanks, steps: ids.length, missing: kit.steps.filter(s => !lib.components[s.id]).map(s => s.id) };
  }
  const checkHtml = (c, what) => (!c ? '' : c.problems.length
    ? `<div class="kf-check bad"><b>${escHtml(what)} has ${c.problems.length} problem${c.problems.length === 1 ? '' : 's'}:</b><ul>${c.problems.slice(0, 6).map(p => `<li>${withCode(p)}</li>`).join('')}</ul></div>`
    : `<div class="kf-check ok">✓ ${escHtml(what)} builds with no problems${c.blanks ? `, leaving ${c.blanks} ‹blank${c.blanks === 1 ? '' : 's'}› to fill in` : ''}.${c.missing && c.missing.length ? ` (Not written yet, so left out: ${c.missing.map(escHtml).join(', ')}.)` : ''}</div>`);

  function renderKitEditor() {
    const ed = bld.edit, { built, mine } = kitEntries();
    const listScroll = $('bldBody').querySelector('.kit-ed .bp-list') ? $('bldBody').querySelector('.kit-ed .bp-list').scrollTop : 0;
    $('bldPath').innerHTML = `<button type="button" class="bld-crumb" id="bldEditDone">← Back to ${ed.fromKit ? 'planning' : 'the questions'}</button><span class="bld-sep" aria-hidden="true">·</span><span class="dim">Kits and their steps. Your changes are kept on this computer.</span>`;
    const isOn = (e) => ed.sel && ed.sel.src === e.src && ed.sel.i === e.i;
    const item = (e) => `<button type="button" class="bp-item${isOn(e) ? ' on' : ''}" data-ent="${e.src}:${e.i}"><b>${escHtml(e.title || 'Untitled')}</b><span>${escHtml(e.id || '?')}${e.src === 'mine' ? ' · yours' : e.replaced ? ' · replaced by yours' : ''}${e.problems.length ? ' · needs fixing' : ''}</span></button>`;
    const group = (kind) => { const list = [...mine.filter(e => e.kind === kind), ...built.filter(e => e.kind === kind)]; return list.length ? `<details class="kit-group"${kind !== 'question' ? ' open' : ''}><summary class="bp-group">${ENTRY_GROUP[kind]} <span class="dim">${list.length}</span></summary>${list.map(item).join('')}</details>` : ''; };
    const unread = mine.filter(e => !e.kind);
    $('bldBody').innerHTML = `<div class="bp-layout kit-ed">
      <nav class="bp-list" aria-label="Kits and steps">
        <div class="bp-mk kit-new"><button type="button" class="btn small" data-new="kit">New kit</button><button type="button" class="btn small" data-new="component">New step</button><button type="button" class="btn small" data-new="question">New question</button></div>
        ${group('kit')}${group('component')}${group('question')}${unread.length ? '<div class="bp-group">Not readable yet</div>' + unread.map(item).join('') : ''}
      </nav>
      <div class="bp-detail" id="kitDetail"></div></div>`;
    $('bldBody').querySelector('.kit-ed .bp-list').scrollTop = listScroll;
    renderKitDetail();
  }

  function renderKitDetail() {
    const ed = bld.edit, box = $('kitDetail');
    if (ed.form && !ed.asText) return ed.form.kind === 'kit' ? renderKitForm(box) : renderStepForm(box);
    if (ed.text != null) {
      const d = BUILDER.describeEntry(ed.text);
      box.innerHTML = `<div class="bp-edit">
        <label class="ex-lbl" for="kitSrc">${ed.editing && ed.editing.src === 'mine' ? 'Your entry, as text' : ed.editing ? 'Your copy, as text (same id, so it replaces the built-in one; change the id on the first line to add a new one instead)' : 'Your new entry, as text'}</label>
        <textarea id="kitSrc" spellcheck="false">${escHtml(ed.text)}</textarea>
        <div class="bp-errors" id="kitErrors">${kitProblemsHtml(d.problems, kitLinkProblems(ed.text, ed.editing))}</div>
        <details class="bp-help"><summary>How the text works</summary>
          <ul>
            <li><code>kit: id</code>, <code>title:</code>, <code>layout:</code> <code>script</code>, <code>structured</code>, <code>website</code> or <code>arduino</code>, <code>shelf:</code> its kind (${BUILDER.SHELVES.filter(s => s.ask).map(s => `<code>${s.id}</code>`).join(', ')}), <code>platform:</code> pc, phone, web or board, <code>about:</code>, and <code>steps:</code> in build order: <code>!</code> after a step means always included, <code>*</code> ticked at first.</li>
            <li><code>component: id</code> (a step), <code>name:</code>, <code>depth:</code> <code>walk</code>, <code>hallway</code> or <code>horizon</code>, <code>summary:</code> its role, <code>usual:</code> what it's usually made with, <code>learn:</code> what to learn first, <code>check:</code> how to check it's done (one line), then its sentences under a folder: <code>== settings</code>, <code>== tools</code>, <code>== main</code> (Python); <code>== structure</code>, <code>== styling</code>, <code>== mechanics</code> (website); <code>== settings</code>, <code>== start</code>, <code>== loop</code> (Arduino).</li>
            <li>A hallway step has one <code>blank: ‹the blank› | what kind | how to work it out | an answer that works</code> per ‹blank›, before its folders. The ‹blank› says what goes there in a few words, never the answer; the help shows the rest when the cursor is on it, and the answer only when asked for.</li>
            <li><code>question: id</code>, <code>ask:</code>, then <code>option: label | what it means | where it leads</code>. The builder makes its own questions from the kinds; a question of your own is for a kit that asks something first (<code>asks: id</code> on the kit).</li>
          </ul>
        </details>
        <div class="bp-actions"><button type="button" class="btn primary" id="kitSave"${d.problems.length ? ' disabled' : ''}>Save</button><button type="button" class="btn" id="kitCancel">Cancel</button>${ed.form ? '<button type="button" class="btn ghost" id="kfForm">Back to the form</button>' : ''}</div>
      </div>`;
      $('kitSrc').addEventListener('input', (e) => {
        ed.text = e.target.value;
        const p = BUILDER.describeEntry(ed.text);
        $('kitErrors').innerHTML = kitProblemsHtml(p.problems, kitLinkProblems(ed.text, ed.editing));
        $('kitSave').disabled = !!p.problems.length;
      });
      return;
    }
    if (!ed.sel) {
      box.innerHTML = `<h3 class="bp-title">Make the planner yours</h3>
        <p>Every kind of project the planner knows is a <b>kit</b>: a title, its kind, where it runs, and its <b>steps</b> in build order. Each step has a depth (Walk, Hallway or Horizon), a summary, and the sentences it writes.</p>
        <p>Pick a kit on the left to change it: reorder its steps, add steps from any other kit, mark them always included or ticked at first, or write new ones. A built-in kit is changed as a copy that replaces it; deleting yours brings the original back. A new kit appears in the planner under its kind as soon as it's saved.</p>`;
      return;
    }
    const src = kitSource(ed.sel), d = BUILDER.describeEntry(src), mine = ed.sel.src === 'mine';
    const replaced = !mine && myKits.some(m => { const x = BUILDER.describeEntry(m.source); return x.kind === d.kind && x.id === d.id; });
    const overrides = mine && BUILDER.BUILT_IN.some(s => { const x = BUILDER.describeEntry(s); return x.kind === d.kind && x.id === d.id; });
    box.innerHTML = `<div class="bp-kind">${escHtml({ question: 'Question', kit: 'Kit', component: 'Step' }[d.kind] || 'Entry')} · ${escHtml(d.id || '?')}${mine ? ' · yours' : ' · built in'}</div>
      <h3 class="bp-title">${escHtml(d.title || 'Untitled')}</h3>
      ${d.problems.length || mine ? `<div class="bp-errors">${kitProblemsHtml(d.problems, mine ? kitLinkProblems(src, ed.sel) : [])}</div>` : ''}
      <pre class="kit-src">${escHtml(src)}</pre>
      <div class="bp-actions">
        ${mine ? `<button type="button" class="btn primary" id="kitEdit">Change it</button><button type="button" class="btn ghost" id="kitDelete">${overrides ? 'Delete mine (the built-in one comes back)' : 'Delete'}</button>`
          : replaced ? '<span class="bp-note">Yours replaces this one: it\'s listed as "yours".</span>' : '<button type="button" class="btn primary" id="kitCopyEdit">Change it (as your copy)</button>'}
        ${d.kind === 'kit' ? '<button type="button" class="btn" id="kitPlan">Plan with it</button>' : ''}
        <button type="button" class="btn ghost" id="kitCopyText">Copy as text</button>
      </div>`;
  }

  /* The kit form */
  function renderKitForm(box) {
    const ed = bld.edit, f = ed.form, lib = BUILDER.libraryWith(myKits.map(m => m.source));
    const opt = (v, label, cur) => `<option value="${escHtml(v)}"${v === cur ? ' selected' : ''}>${escHtml(label)}</option>`;
    const comp = (id) => (ed.newSteps && ed.newSteps[id]) || lib.components[id];
    const check = buildCheck(sourcesWith(formText(f), ed.editing).concat(Object.values(ed.newSteps || {}).map(c => c.text)), f.id);
    box.innerHTML = `<div class="kf">
      <div class="bp-kind">Kit · ${escHtml(f.id)}${ed.editing && ed.editing.src === 'built' ? ' · your copy replaces the built-in one when saved' : ed.editing ? ' · yours' : ' · new'}</div>
      <div class="kf-grid">
        <label class="kf-wide">Title<input data-f="title" value="${escHtml(f.head.title || '')}" spellcheck="false"></label>
        <label>Kind<select data-f="shelf">${BUILDER.SHELVES.filter(s => s.ask).map(s => opt(s.id, s.title, f.head.shelf)).join('')}</select></label>
        <label>Runs on<select data-f="platform">${Object.entries(BUILDER.PLATFORMS).map(([p, l]) => opt(p, l, f.head.platform || ({ website: 'web', arduino: 'board' }[f.head.layout] || 'pc'))).join('')}</select></label>
        <label>Made of<select data-f="layout">${Object.entries(LAYOUT_LABEL).map(([l, t]) => opt(l, t, f.head.layout || 'structured')).join('')}</select></label>
        <label class="kf-wide">About (one line, shown above its steps)<textarea data-f="about" rows="2">${escHtml(f.head.about || '')}</textarea></label>
      </div>
      <h4 class="kf-h">Steps, in the order you'd build them</h4>
      <ol class="kf-steps">${f.steps.map((s, i) => { const c = comp(s.id); return `<li data-i="${i}">
          <span class="bld-n">${i + 1}</span>
          <span class="kf-step-name">${c ? `<b>${escHtml(c.name)}</b> ${depthChip(c.depth)}` : `<b>${escHtml(s.id)}</b> <span class="kit-link">not written yet</span>`}<span class="dim kf-id">${escHtml(s.id)}</span></span>
          <label class="kf-tog" title="Always part of a project made from this kit"><input type="checkbox" data-tog="always"${s.always ? ' checked' : ''}> Always</label>
          <label class="kf-tog" title="Ticked when the planner opens"><input type="checkbox" data-tog="ticked"${s.ticked || s.always ? ' checked' : ''}${s.always ? ' disabled' : ''}> Ticked at first</label>
          <span class="kf-step-btns"><button type="button" class="btn small" data-move="-1" aria-label="Move up"${i ? '' : ' disabled'}>↑</button><button type="button" class="btn small" data-move="1" aria-label="Move down"${i < f.steps.length - 1 ? '' : ' disabled'}>↓</button><button type="button" class="btn small" data-edit-step="${escHtml(s.id)}">Edit</button><button type="button" class="btn small ghost" data-remove aria-label="Remove ${escHtml(c ? c.name : s.id)}">Remove</button></span>
        </li>`; }).join('') || '<li class="dim kf-empty">No steps yet: add one below.</li>'}</ol>
      <div class="kf-add"><button type="button" class="btn small" id="kfAdd" aria-expanded="${!!ed.picking}">+ Add a step from the templates</button><button type="button" class="btn small" id="kfNewStep">+ Write a new step</button></div>
      ${ed.picking ? pickerHtml(lib, f) : ''}
      ${checkHtml(check, 'The kit')}
      <div class="bp-actions"><button type="button" class="btn primary" id="kfSave">Save${ed.editing && ed.editing.src === 'built' ? ' as yours' : ''}</button><button type="button" class="btn" id="kfCancel">Cancel</button><button type="button" class="btn ghost" id="kfText">Edit as text</button></div>
    </div>`;
    if (ed.picking) { const s = $('kfPickSearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }
  /* Every step in the templates, by kit, to add to this one (those whose sentences fit how it's made first). */
  function pickerHtml(lib, f) {
    const q = (bld.edit.pickQuery || '').toLowerCase();
    const folders = new Set(LAYOUT_FOLDERS[f.head.layout || 'structured']);
    const fits = (c) => Object.keys(c.sections || {}).every(k => folders.has(k));
    const have = new Set(f.steps.map(s => s.id));
    const byKit = Object.values(lib.kits).map(k => ({ k, cs: k.steps.map(s => lib.components[s.id]).filter(c => c && !have.has(c.id) && fits(c) && (!q || (c.name + ' ' + c.summary + ' ' + k.title).toLowerCase().includes(q))) })).filter(x => x.cs.length);
    const seen = new Set();
    return `<div class="kf-picker"><input id="kfPickSearch" type="search" placeholder="Find a step: timer, save, score…" value="${escHtml(bld.edit.pickQuery || '')}" spellcheck="false" autocomplete="off">
      <div class="kf-pick-list">${byKit.map(({ k, cs }) => { const fresh = cs.filter(c => !seen.has(c.id) && seen.add(c.id)); return fresh.length ? `<div class="kf-pick-g">${escHtml(k.title)}</div>${fresh.map(c => `<button type="button" class="kf-pick" data-add="${escHtml(c.id)}"><b>${escHtml(c.name)}</b> ${depthChip(c.depth)}<span>${escHtml(firstSentence(c.summary))}</span></button>`).join('')}` : ''; }).join('') || '<p class="dim">No steps that fit how this kit is made match that.</p>'}</div>
      <p class="dim kf-pick-note">Only steps whose sentences fit ${escHtml(LAYOUT_LABEL[f.head.layout || 'structured'])} are listed.</p></div>`;
  }

  /* The step form: its name, depth, role, and its sentences, folder by folder. */
  function renderStepForm(box) {
    const ed = bld.edit, f = ed.form, lib = BUILDER.libraryWith(myKits.map(m => m.source));
    const ctx = ed.back && ed.back.kind === 'kit' ? ed.back : null;
    const layout = ctx ? ctx.head.layout || 'structured' : (Object.values(lib.kits).find(k => k.steps.some(s => s.id === f.id)) || {}).layout || 'structured';
    const folders = [...new Set(LAYOUT_FOLDERS[layout].concat(Object.keys(f.sections || {})))];
    const text = formText(f), d = BUILDER.describeEntry(text);
    let check = null;
    const kitId = ctx ? ctx.id : (Object.values(lib.kits).find(k => k.steps.some(s => s.id === f.id)) || {}).id;
    if (kitId && f.head.depth !== 'horizon') {
      const k = lib.kits[kitId] || { steps: [] };
      const always = (ctx ? ctx.steps : k.steps).filter(s => s.always).map(s => s.id);
      check = buildCheck(sourcesWith(text, ed.editing).concat(ctx ? [formText(ctx)] : []), kitId, [...new Set(always.concat(f.id))]);
    }
    box.innerHTML = `<div class="kf">
      <div class="bp-kind">Step · ${escHtml(f.id)}${ed.editing && ed.editing.src === 'built' ? ' · your copy replaces the built-in one when saved' : ed.editing ? ' · yours' : ' · new'}${ctx ? ` · in ${escHtml(ctx.head.title || ctx.id)}` : ''}</div>
      <div class="kf-grid">
        <label class="kf-wide">Name<input data-f="name" value="${escHtml(f.head.name || '')}" spellcheck="false"></label>
      </div>
      <div class="kf-depth" role="radiogroup" aria-label="Depth">${Object.keys(BUILDER.DEPTHS).map(dp => `<button type="button" role="radio" aria-checked="${f.head.depth === dp}" class="kf-depth-b${f.head.depth === dp ? ' on' : ''}" data-depth="${dp}">${depthChip(dp)}<span>${escHtml(BUILDER.DEPTHS[dp].means)}</span></button>`).join('')}</div>
      <div class="kf-grid">
        <label class="kf-wide">Its role in the whole project<textarea data-f="summary" rows="3">${escHtml(f.head.summary || '')}</textarea></label>
        <label class="kf-wide">Usually made with<input data-f="usual" value="${escHtml(f.head.usual || '')}"></label>
        <label class="kf-wide">Learn first<input data-f="learn" value="${escHtml(f.head.learn || '')}"></label>
        <label class="kf-wide">How to check it's done<input data-f="check" value="${escHtml(f.head.check || '')}" placeholder="${escHtml(BUILDER.DEPTHS[f.head.depth] ? BUILDER.DEPTHS[f.head.depth].check : '')}" maxlength="300"></label>
      </div>
      ${f.head.depth === 'horizon' ? '<p class="dim">A horizon step has no sentences: its summary, what it\'s usually made with and what to learn first are the step.</p>' : `<h4 class="kf-h">Its sentences${f.head.depth === 'hallway' ? ', with ‹blanks› for the parts to fill in' : ''}</h4>
      ${folders.map(fo => `<label class="kf-sec"><span class="ex-lbl">${escHtml(FOLDER_LABEL[fo] || fo)}</span><textarea data-sec="${fo}" rows="${Math.min(14, Math.max(3, String((f.sections || {})[fo] || '').split('\n').length + 1))}" spellcheck="false">${escHtml((f.sections || {})[fo] || '')}</textarea></label>`).join('')}
      ${f.head.depth === 'hallway' ? `<label class="kf-sec"><span class="ex-lbl">What goes in each ‹blank›: one line each</span><textarea data-blanks rows="${Math.min(10, Math.max(3, String(f.blanks || '').split('\n').length + 1))}" spellcheck="false" placeholder="‹ticks to wait› | a calculation | How to work it out, in words. | an answer that works">${escHtml(f.blanks || '')}</textarea><span class="dim">‹the blank, as in the sentences› | what kind of thing (a number, a calculation, a test (true or false), text in quotes, a name…) | how to work it out | an answer that works. The help shows these when the cursor is on the ‹blank›, the answer only when asked for.</span></label>` : ''}`}
      <div class="bp-errors" id="kfErrors">${kitProblemsHtml(d.problems, [])}</div>
      <div id="kfStepCheck">${check ? checkHtml(check, `${ctx ? ctx.head.title || ctx.id : lib.kits[kitId] ? lib.kits[kitId].title : 'Its kit'}, with this step,`) : ''}</div>
      <div class="bp-actions"><button type="button" class="btn primary" id="kfSave"${d.problems.length ? ' disabled' : ''}>Save${ctx ? ' and go back to the kit' : ed.editing && ed.editing.src === 'built' ? ' as yours' : ''}</button><button type="button" class="btn" id="kfCancel">${ctx ? 'Back to the kit' : 'Cancel'}</button><button type="button" class="btn ghost" id="kfText">Edit as text</button></div>
    </div>`;
  }

  /* Save the form (or the text) as yours: replace your copy, or add it (a copy of a built-in entry keeps its id, so it replaces it). */
  function saveEntry(text, editing) {
    if (editing && editing.src === 'mine') { myKits[editing.i].source = text; saveKits(); return { src: 'mine', i: editing.i }; }
    const d = BUILDER.describeEntry(text);
    const at = myKits.findIndex(m => { const x = BUILDER.describeEntry(m.source); return x.kind === d.kind && x.id === d.id; });
    if (at >= 0) { myKits[at].source = text; saveKits(); return { src: 'mine', i: at }; }
    myKits.push({ id: Date.now().toString(36), source: text });
    saveKits();
    return { src: 'mine', i: myKits.length - 1 };
  }
  const uniqueId = (base, taken) => { let id = base, n = 2; while (taken(id)) id = `${base}-${n++}`; return id; };

  $('bldBody').addEventListener('click', (e) => {
    if (!bld.edit) return;
    const ed = bld.edit, lib = () => BUILDER.libraryWith(myKits.map(m => m.source));
    const ent = e.target.closest('[data-ent]');
    if (ent) { const [src, i] = ent.dataset.ent.split(':'); ed.sel = { src, i: +i }; ed.text = null; ed.editing = null; ed.form = null; ed.back = null; ed.asText = false; return renderKitEditor(); }
    const nw = e.target.closest('[data-new]');
    if (nw) {
      ed.sel = null; ed.editing = null; ed.back = null; ed.asText = false;
      const taken = (id) => !!(lib().kits[id] || lib().components[id] || lib().questions[id]);
      const text = NEW_ENTRY[nw.dataset.new].replace(/^(\w+): my-(\w+)/, (m, k, w) => `${k}: ${uniqueId('my-' + w, taken)}`);
      ed.form = formFrom(text); ed.text = ed.form ? null : text;
      renderKitEditor();
      return;
    }
    const f = ed.form;
    // the kit form
    const row = e.target.closest('.kf-steps li[data-i]');
    if (f && f.kind === 'kit' && row) {
      const i = +row.dataset.i;
      const mv = e.target.closest('[data-move]');
      if (mv) { const j = i + +mv.dataset.move; if (j >= 0 && j < f.steps.length) { [f.steps[i], f.steps[j]] = [f.steps[j], f.steps[i]]; renderKitDetail(); } return; }
      if (e.target.closest('[data-remove]')) { f.steps.splice(i, 1); return renderKitDetail(); }
      const es = e.target.closest('[data-edit-step]');
      if (es) {
        const id = es.dataset.editStep, fresh = ed.newSteps && ed.newSteps[id];
        const { built, mine } = kitEntries();
        const entry = mine.find(x => x.kind === 'component' && x.id === id) || built.find(x => x.kind === 'component' && x.id === id);
        ed.back = { ...f, steps: f.steps.map(s => ({ ...s })), _editing: ed.editing, _sel: ed.sel };
        ed.editing = fresh ? null : entry ? { src: entry.src, i: entry.i } : null;
        ed.form = formFrom(fresh ? fresh.text : entry ? kitSource(entry) : NEW_ENTRY.component.replace('my-step', id));
        return renderKitDetail();
      }
    }
    const id = e.target.id;
    if (f && f.kind === 'kit' && id === 'kfAdd') { ed.picking = !ed.picking; ed.pickQuery = ''; return renderKitDetail(); }
    const add = e.target.closest('[data-add]');
    if (f && f.kind === 'kit' && add) { f.steps.push({ id: add.dataset.add, always: false, ticked: true }); ed.picking = false; return renderKitDetail(); }
    if (f && f.kind === 'kit' && id === 'kfNewStep') {
      const taken = (x) => !!(lib().components[x] || (ed.newSteps && ed.newSteps[x]));
      const sid = uniqueId(`${f.id}-step`, taken), folder = LAYOUT_FOLDERS[f.head.layout || 'structured'];
      ed.back = { ...f, steps: f.steps.map(s => ({ ...s })), _editing: ed.editing, _sel: ed.sel };
      ed.editing = null;
      ed.form = { kind: 'component', id: sid, isNew: true, head: { component: sid, name: 'A new step', depth: 'walk', summary: '', usual: '', learn: '' }, sections: { [folder[folder.length - 1]]: '' } };
      return renderKitDetail();
    }
    const dp = e.target.closest('[data-depth]');
    if (f && f.kind === 'component' && dp) { f.head.depth = dp.dataset.depth; return renderKitDetail(); }
    if (id === 'kfText') { ed.asText = true; ed.text = formText(f); return renderKitDetail(); }
    if (id === 'kfForm') { const back = formFrom(ed.text); if (back) { ed.form = back; ed.asText = false; ed.text = null; } return renderKitDetail(); }
    if (id === 'kfCancel') {
      if (f && f.kind === 'component' && ed.back) { const k = ed.back; ed.form = { ...k }; ed.editing = k._editing; ed.sel = k._sel; ed.back = null; return renderKitDetail(); }
      ed.form = null; ed.text = null; ed.editing = null; ed.asText = false;
      return renderKitEditor();
    }
    if (id === 'kfSave') {
      if (f.kind === 'component') {
        const text = formText(f);
        if (BUILDER.describeEntry(text).problems.length) return;
        if (ed.back) {   // back to the kit: a new step is kept with the kit until the kit is saved
          const k = ed.back;
          if (f.isNew) { ed.newSteps = { ...(ed.newSteps || {}), [f.id]: { text, name: f.head.name, depth: f.head.depth } }; if (!k.steps.some(s => s.id === f.id)) k.steps.push({ id: f.id, always: false, ticked: true }); }
          else saveEntry(text, ed.editing);
          ed.form = { ...k }; ed.editing = k._editing; ed.sel = k._sel; ed.back = null;
          return renderKitEditor();
        }
        ed.sel = saveEntry(text, ed.editing); ed.form = null; ed.editing = null;
        return renderKitEditor();
      }
      // the kit, and any new steps written for it
      for (const st of Object.values(ed.newSteps || {})) saveEntry(st.text, null);
      ed.newSteps = null;
      ed.sel = saveEntry(formText(f), ed.editing); ed.form = null; ed.editing = null; ed.picking = false;
      return renderKitEditor();
    }
    // the read-only view and the text editor
    if (id === 'kitCopyEdit' || id === 'kitEdit') {
      ed.editing = { ...ed.sel };
      const form = formFrom(kitSource(ed.sel));
      if (form) { ed.form = form; ed.asText = false; } else ed.text = kitSource(ed.sel);
      return renderKitDetail();
    }
    if (id === 'kitPlan') { const d = BUILDER.describeEntry(kitSource(ed.sel)); return openBuilderAtKit(d.id); }
    if (id === 'kitCancel') { ed.text = null; ed.asText = false; if (!ed.form) ed.editing = null; return ed.form ? renderKitDetail() : renderKitEditor(); }
    if (id === 'kitCopyText') copyText(kitSource(ed.sel), e.target, 'Copy as text');
    if (id === 'kitDelete') {
      if (e.target.dataset.confirm !== 'yes') { e.target.dataset.confirm = 'yes'; e.target.textContent = 'Click again to delete'; return; }
      myKits.splice(ed.sel.i, 1); saveKits(); ed.sel = null; renderKitEditor();
    }
    if (id === 'kitSave') {
      if (BUILDER.describeEntry(ed.text).problems.length) return;
      ed.sel = saveEntry(ed.text, ed.editing); ed.text = null; ed.editing = null; ed.form = null; ed.asText = false;
      renderKitEditor();
    }
  });
  // typing in the forms: fields update the form; the check runs again after a pause
  let kfTimer = null;
  $('bldBody').addEventListener('input', (e) => {
    const ed = bld.edit;
    if (!ed || !ed.form) return;
    if (e.target.id === 'kfPickSearch') { ed.pickQuery = e.target.value; return renderKitDetail(); }
    const fld = e.target.dataset.f, sec = e.target.dataset.sec, blanks = e.target.dataset.blanks != null;
    if (!fld && !sec && !blanks) return;
    if (blanks) ed.form.blanks = e.target.value;
    if (fld) ed.form.head[fld] = e.target.value;
    if (sec) ed.form.sections = { ...(ed.form.sections || {}), [sec]: e.target.value };
    clearTimeout(kfTimer);
    kfTimer = setTimeout(() => {   // re-check without redrawing the field being typed in
      if (ed.form.kind !== 'component') return;
      const p = BUILDER.describeEntry(formText(ed.form));
      if ($('kfErrors')) $('kfErrors').innerHTML = kitProblemsHtml(p.problems, []);
      if ($('kfSave')) $('kfSave').disabled = !!p.problems.length;
    }, 300);
  });
  $('bldBody').addEventListener('change', (e) => {
    const ed = bld.edit;
    if (ed && ed.form && ed.form.kind === 'kit') {
      if (e.target.dataset.f) { ed.form.head[e.target.dataset.f] = e.target.value; return renderKitDetail(); }
      const tog = e.target.dataset.tog, row = e.target.closest('li[data-i]');
      if (tog && row) { const s = ed.form.steps[+row.dataset.i]; s[tog] = e.target.checked; if (tog === 'always' && s.always) s.ticked = true; return renderKitDetail(); }
    }
    if (ed && ed.form && ed.form.kind === 'component' && (e.target.dataset.sec || e.target.dataset.f || e.target.dataset.blanks != null)) return renderKitDetail();   // the build check, once a field is left
  });

  // planning
  $('bldBody').addEventListener('click', (e) => {
    if (bld.edit) return;
    const opt = e.target.closest('[data-opt]');
    if (opt) {
      const lib = bldLibrary();
      const q = lib.questions[bld.trail.length ? bld.trail[bld.trail.length - 1].next : 'start'];
      const o = q.options[+opt.dataset.opt];
      bld.trail.push({ label: o.label, next: o.next });
      if (o.kit) {
        bld.kit = o.kit;
        const kit = lib.kits[o.kit];
        bld.ticked = new Set(o.ticked || (kit ? kit.steps.filter(s => s.ticked).map(s => s.id) : []));
      }
      return renderBuilder();
    }
    const pv = e.target.closest('[data-preview]');
    if (pv) { const id = pv.dataset.preview; if (bld.preview.has(id)) bld.preview.delete(id); else bld.preview.add(id); return renderKit(bldLibrary().kits[bld.kit]); }
    const pr = e.target.closest('[data-preset]');
    if (pr) {
      const kit = bldLibrary().kits[bld.kit];
      bld.ticked = new Set(pr.dataset.preset === 'all' ? kit.steps.map(s => s.id) : pr.dataset.preset === 'usual' ? kit.steps.filter(s => s.ticked).map(s => s.id) : []);
      return renderKit(kit);
    }
    if (e.target.id === 'bldGo') builderGo();
    if (e.target.id === 'bldChange') { const k = bld.kit; openKitEditorAt('kit', k); bld.edit.fromKit = k; renderBuilder(); }
    if (e.target.id === 'bldToLibrary') { closeBuilder(); openBlueprints(); }
  });
  $('bldBody').addEventListener('change', (e) => {
    if (bld.edit) return;
    const box = e.target.closest('[data-step]');
    if (!box) return;
    if (box.checked) bld.ticked.add(box.dataset.step); else bld.ticked.delete(box.dataset.step);
    renderKit(bldLibrary().kits[bld.kit]);
  });
  $('bldBody').addEventListener('focusin', (e) => { if (e.target.id === 'bldName' && !bld.edit) renderStages(3); });
  $('btnBuilder').addEventListener('click', openBuilder);
  $('newToBuilder').addEventListener('click', openBuilder);

  /* The project map: the plan's steps, in order, each with a tick and how to check it's done. Each opens a
   * window about its role in the whole. Ticks are saved with the project. */
  const OPENSPEC = window.IntuiOpenSpec;
  const stepCheck = (s) => s.check || BUILDER.DEPTHS[s.depth].check;
  let planToNext = true;   // the next time the map is drawn, scroll it to the first step not done (a project was opened)
  function renderPlan() {
    const plan = project.plan, steps = plan ? plan.steps : [];
    if (!steps.length) {
      $('planPath').textContent = '';
      $('planDone').hidden = true;
      $('plan').innerHTML = '<li class="plan-empty">No map yet. + Step adds a step of your own; Plan builds a project with one.</li>';
      planToNext = false;
      return;
    }
    const p = OPENSPEC.progress(steps);
    $('planPath').textContent = plan.path.join(' › ');
    $('planDone').hidden = false;
    $('planCount').textContent = `${p.done} of ${p.total} done`;
    $('planBar').style.width = Math.round(100 * p.done / p.total) + '%';
    $('plan').innerHTML = steps.map(s => `<li class="plan-item${s.done ? ' plan-ticked' : ''}${s.n === p.next ? ' plan-next' : ''}" data-step-n="${s.n}">
      <input type="checkbox" class="plan-tick" data-tick="${s.n}"${s.done ? ' checked' : ''} aria-label="Step ${s.n} done: ${escHtml(s.name)}" title="${s.done ? 'Done. Untick if it isn\'t any more.' : 'Tick when it\'s done: ' + escHtml(stepCheck(s))}">
      <button type="button" class="plan-step" data-plan="${s.n}" title="${escHtml(s.name)}: what it's for, how to check it's done"><span class="plan-n">${s.n}</span><span class="plan-name">${escHtml(s.name)}</span>${depthChip(s.depth)}</button>
      ${s.done ? '' : `<span class="plan-check" title="How to check it's done: ${escHtml(stepCheck(s))}">${escHtml(stepCheck(s))}</span>`}</li>`).join('');
    if (planToNext) {
      planToNext = false;
      const li = p.next != null && $('plan').querySelector(`[data-step-n="${p.next}"]`);
      $('plan').scrollTop = li ? Math.max(0, li.offsetTop - 4) : 0;   // (.plan is the offset parent: position: relative)
    }
  }
  function tickStep(n, done) {
    const s = project.plan && project.plan.steps.find(x => x.n === n);
    if (!s || s.done === done) return;
    s.done = done;
    const focused = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.tick;
    renderPlan(); save(); autosave();
    if (focused) { const box = $('plan').querySelector(`[data-tick="${n}"]`); if (box) box.focus(); }
    if (!$('stepModal').hidden) openStep(n);
    const p = OPENSPEC.progress(project.plan.steps);
    tLine(done ? `Step ${n}, "${s.name}", is done: ${p.done} of ${p.total}.${p.next != null ? ` Next: step ${p.next}.` : ' Every step is done.'}` : `Step ${n}, "${s.name}", is to do again.`, 't-sys');
  }
  $('plan').addEventListener('change', (e) => { const t = e.target.closest('[data-tick]'); if (t) tickStep(+t.dataset.tick, t.checked); });
  const stepText = (sec) => (sec.id === project.active ? ta.value : sec.text);
  /* The step the cursor is in: the last "── Step n ·" note at or above it, in this folder. */
  function planBanner(li) {
    const plan = project.plan;
    if (!plan) return '';
    const text = ta.value;
    let here = null;
    for (const s of plan.steps) { const at = BUILDER.stepLine(text, s); if (at >= 0 && at <= li && (!here || at > here.at)) here = { s, at }; }
    if (!here) return '';
    const s = here.s;
    return `<div class="ex-step"><span class="ex-lbl">Step ${s.n} of ${plan.steps.length}</span> <b>${escHtml(s.name)}</b> ${depthChip(s.depth)} <button type="button" class="linklike" data-plan="${s.n}">What it's for</button></div>`;
  }
  function openStep(n) {
    const plan = project.plan, step = plan && plan.steps.find(s => s.n === n);
    if (!step) return;
    const places = project.sections.map(sec => ({ sec, line: BUILDER.stepLine(stepText(sec), step) })).filter(p => p.line >= 0);
    $('stepTitle').textContent = `Step ${step.n} of ${plan.steps.length} · ${step.name}`;
    $('stepTitle').dataset.n = step.n;
    $('stepBody').innerHTML = `<p class="step-depth">${depthChip(step.depth)} ${withCode(BUILDER.DEPTHS[step.depth].means)}</p>
      <h4>Its role in the project</h4><p>${withCode(step.summary)}</p>
      ${step.usual ? `<h4>Usually made with</h4><p>${withCode(step.usual)}</p>` : ''}
      ${step.learn ? `<h4>Learn first</h4><p>${withCode(step.learn)}</p>` : ''}
      <h4>How to check it's done</h4>
      <div class="plan-check-edit"><label class="plan-done-tog"><input type="checkbox" data-step-done="${step.n}"${step.done ? ' checked' : ''}> Done</label><input data-step-check="${step.n}" value="${escHtml(step.check || '')}" placeholder="${escHtml(BUILDER.DEPTHS[step.depth].check)}" maxlength="300" spellcheck="true" aria-label="How to check it's done"></div>
      ${places.length ? `<div class="step-go">${places.map(p => `<button type="button" class="btn small primary" data-go-sec="${escHtml(p.sec.id)}" data-go-line="${p.line}">Go to its sentences in ${escHtml(metaOf(p.sec).title)}</button>`).join('')}</div>` : ''}
      <div class="bp-actions step-nav">
        <button type="button" class="btn small" data-step-to="${step.n - 1}"${step.n > 1 ? '' : ' disabled'}>← Step ${step.n - 1 || ''}</button>
        <button type="button" class="btn small" data-step-to="${step.n + 1}"${step.n < plan.steps.length ? '' : ' disabled'}>Step ${step.n < plan.steps.length ? step.n + 1 : ''} →</button>
      </div>`;
    $('stepModal').hidden = false;
  }
  function closeStep() { $('stepModal').hidden = true; renderPlan(); }

  /* A step of your own on the map. Its "── Step n ·" note goes at the cursor (in a file of sentences), so
   * the map can take you there, as it does for a kit's steps. */
  function openStepAdd() {
    activeSec().text = ta.value;
    const sec = activeSec();
    $('stepAddWhere').textContent = isSentences(sec) ? `Its note goes in ${fileName(sec)}, above line ${caretLine() + 1}.` : `${fileName(sec)} is ${langName(sec.lang)}, which can't hold a step's note, so this step won't link to a place.`;
    $('stepAddName').value = ''; $('stepAddSum').value = ''; $('stepAddCheck').value = ''; $('stepAddProblem').textContent = '';
    $('stepAddModal').hidden = false;
    $('stepAddName').focus();
  }
  function closeStepAdd() { $('stepAddModal').hidden = true; }
  function addStep() {
    const name = $('stepAddName').value.trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!name) { $('stepAddProblem').textContent = 'Give the step a name.'; return; }
    const depth = $('stepAddDepth').value;
    const plan = project.plan || (project.plan = { title: project.name, path: [], steps: [] });
    const n = plan.steps.reduce((m, s) => Math.max(m, s.n), 0) + 1;
    plan.steps.push({ id: 'mine-' + n + '-' + Math.random().toString(36).slice(2, 6), n, name, depth, summary: $('stepAddSum').value.trim().slice(0, 3000), usual: '', learn: '',
      check: $('stepAddCheck').value.replace(/\s+/g, ' ').trim().slice(0, 300), done: false });
    closeStepAdd();
    if (isSentences(activeSec())) {
      const b = lineBounds(ta.selectionStart), indent = b.text.match(/^\s*/)[0];
      insertText(`${indent}note: ── Step ${n} · ${name} (${BUILDER.DEPTHS[depth].label}) ──\n`, b.start, b.start);
    }
    renderPlan(); save(); autosave();
    tLine(`Added step ${n}, "${name}", to the project map.`, 't-sys');
  }
  $('btnAddStep').addEventListener('click', openStepAdd);
  $('stepAddClose').addEventListener('click', closeStepAdd);
  $('stepAddGo').addEventListener('click', addStep);
  $('stepAddModal').addEventListener('click', (e) => { if (e.target.id === 'stepAddModal') closeStepAdd(); });
  for (const id of ['stepAddName', 'stepAddSum', 'stepAddCheck']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } });
  $('plan').addEventListener('click', (e) => { const b = e.target.closest('[data-plan]'); if (b) openStep(+b.dataset.plan); });
  $('stepClose').addEventListener('click', closeStep);
  $('stepModal').addEventListener('click', (e) => {
    if (e.target.id === 'stepModal') return closeStep();
    const to = e.target.closest('[data-step-to]');
    if (to) return openStep(+to.dataset.stepTo);
    const go = e.target.closest('[data-go-sec]');
    if (go) {
      closeStep();
      if (mode !== 'unity') return openSection(go.dataset.goSec, +go.dataset.goLine);
      // Unity shows the file's code with its sentences in place: the step's note is found in that text
      const n = +$('stepTitle').dataset.n, step = project.plan && project.plan.steps.find(s => s.n === n);
      openSection(go.dataset.goSec);
      const at = step ? BUILDER.stepLine($('uTa').value, step) : -1;
      if (at >= 0) uGoTo(at);
    }
  });
  // a step's check line, as it's typed (kept even if the window is closed with Esc), and drawn on the map once left
  const checkInput = (e) => {
    const c = e.target.closest('[data-step-check]');
    const s = c && project.plan && project.plan.steps.find(x => x.n === +c.dataset.stepCheck);
    if (s) { s.check = c.value.replace(/\s+/g, ' ').trim().slice(0, 300); save(); autosave(); }
    return s;
  };
  $('stepModal').addEventListener('input', checkInput);
  $('stepModal').addEventListener('change', (e) => {
    const d = e.target.closest('[data-step-done]');
    if (d) return tickStep(+d.dataset.stepDone, d.checked);
    if (checkInput(e)) renderPlan();
  });

  /* Hand to my AI: the map as an OpenSpec change (lang/openspec.js), for an AI assistant of your own to work
   * from. The desktop app writes it into the saved project's folder, at openspec/changes/<name>/; the browser
   * offers it as a .zip to unzip there. The AI stays outside IntuaCode: it gets these files and nothing else. */
  const hand = { files: [], dir: '', show: 'tasks.md', taken: [], note: '', tasksText: '', newTicks: [] };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const stepList = (ns) => (ns.length === 1 ? `step ${ns[0]}` : `steps ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`);

  /* Ticks your AI made in a tasks.md come back to the map (lang/openspec.js finds which steps they're about).
   * Only ticks: a step ticked here stays ticked. -> what happened, in a sentence ('' when quiet and nothing did). */
  function takeTicks(text, from, quiet) {
    const plan = project.plan;
    if (!plan || !plan.steps.length) return '';
    const r = OPENSPEC.ticksFrom(text, plan.steps);
    let said;
    if (!r.tasks) said = `${from} has no tasks to read (lines like "- [x] 1.1 …").`;
    else if (!r.ticked.length) said = `${from} has no ticks the map doesn't have already.`;
    else {
      for (const n of r.ticked) plan.steps.find(s => s.n === n).done = true;
      planToNext = true;   // the map shows the next step still to do
      renderPlan(); save(); autosave();
      said = `Took ${r.ticked.length} tick${r.ticked.length > 1 ? 's' : ''} from ${from}: ${stepList(r.ticked)}. ${OPENSPEC.progress(plan.steps).done} of ${plan.steps.length} done; untick any that aren't.`;
    }
    if (r.tasks && r.unknown.length) said += ` No task there is about ${stepList(r.unknown)} (renamed, perhaps).`;
    if (quiet && !r.ticked.length) return '';
    tLine(said, r.tasks ? 't-sys' : 't-err');
    return said;
  }
  function handFiles() {
    const plan = project.plan;
    if (!plan || !plan.steps.length) return [];
    return OPENSPEC.files({ ...plan, steps: plan.steps.map(s => ({ ...s, check: stepCheck(s) })) }, { name: project.name, files: project.sections.map(fileName), date: today() });
  }
  async function openHand() {
    hand.files = handFiles();
    hand.dir = hand.files.length ? hand.files[0].path.replace(/[^/]+$/, '') : '';
    hand.taken = []; hand.note = ''; hand.tasksText = ''; hand.newTicks = [];
    $('handModal').hidden = false;
    renderHand();
    $(hand.files.length ? 'handGo' : 'handClose').focus();
    // in a saved project's folder: are these files there already, and changed since (ticked by the AI, say)?
    if (!desk.on || !desk.folder || !hand.files.length) return;
    const folder = desk.folder, taken = [];
    let tasksText = '';
    for (const f of hand.files.filter(x => /\.md$/.test(x.path))) {
      try {
        const there = (await invoke('read_text', { path: join(folder, f.path) })).replace(/\r\n?/g, '\n');
        if (there !== f.content) taken.push(f.path.split('/').pop());
        if (/\/tasks\.md$/.test(f.path)) tasksText = there;
      } catch (_) { /* not there yet */ }
    }
    if (desk.folder !== folder || $('handModal').hidden) return;
    hand.taken = taken;
    hand.tasksText = tasksText;
    hand.newTicks = tasksText && project.plan ? OPENSPEC.ticksFrom(tasksText, project.plan.steps).ticked : [];
    renderHand();
  }
  function closeHand() { $('handModal').hidden = true; }
  function renderHand() {
    const has = hand.files.length > 0, name = hand.dir.split('/').slice(-2, -1)[0] || '';
    for (const b of document.querySelectorAll('[data-hand-file]')) b.setAttribute('aria-selected', String(b.dataset.handFile === hand.show));
    const f = hand.files.find(x => x.path.endsWith('/' + hand.show));
    $('handPre').textContent = f ? f.content : 'No map yet. Menu → Plan a project… builds a project with one; + Step adds a step of your own.';
    $('handWhere').textContent = has ? hand.dir + hand.show : '';
    $('handCopy').disabled = !has;
    $('handAsk').hidden = !has;
    $('handAsk').innerHTML = has ? `Then ask your AI: <q>Read ${escHtml(hand.dir)}proposal.md, then work through tasks.md in order. Tick each task once its check passes.</q> With OpenSpec set up: <code>/opsx:apply ${escHtml(name)}</code>` : '';
    const go = $('handGo'), take = hand.newTicks.length;
    go.disabled = !has;
    $('handTake').hidden = !(desk.on && desk.folder && take);
    $('handTake').textContent = `Take its tick${take > 1 ? 's' : ''} (${stepList(hand.newTicks)})`;
    $('handTakeFile').hidden = desk.on || !has;
    if (!desk.on) {
      go.textContent = 'Download .zip';
      $('handNote').textContent = hand.note || (has ? `Unzip it in the project's own folder: it makes ${hand.dir}.` : '');
    } else if (!desk.folder) {
      go.textContent = 'Save the project…';
      $('handNote').textContent = has ? 'Save the project first: the files go in its folder, next to its code.' : '';
    } else {
      go.textContent = hand.taken.length ? 'Write over them' : 'Write to the project folder';
      const there = take ? `tasks.md there ticks ${stepList(hand.newTicks)}, which the map hasn't: take its ticks first, or writing replaces them.`
        : hand.taken.length ? `${hand.taken.join(' and ')} there ${hand.taken.length > 1 ? 'differ' : 'differs'} from the map now (your AI may have changed ${hand.taken.length > 1 ? 'them' : 'it'}): writing replaces ${hand.taken.length > 1 ? 'them' : 'it'}.` : '';
      $('handNote').textContent = (hand.note || `Writes ${hand.dir} in ${baseName(desk.folder)}.`) + (there ? ' ' + there : '');
    }
  }
  async function handGo() {
    if (!hand.files.length) return;
    if (!desk.on) {
      const name = hand.dir.split('/').slice(-2, -1)[0] + '-openspec.zip';
      offerDownload(name, OPENSPEC.zip(hand.files));
      hand.note = `Downloaded ${name}. Unzip it in the project's own folder: it makes ${hand.dir}.`;
      tLine(`Handed the map to your AI as ${name}: ${hand.dir}proposal.md and tasks.md.`, 't-sys');
      return renderHand();
    }
    if (!desk.folder) { await saveProject(); if (desk.folder) openHand(); return; }
    const folder = desk.folder;
    try {
      for (const f of hand.files) {
        // .openspec.yaml says when the change was made: one there already is kept
        if (/\/\.openspec\.yaml$/.test(f.path)) { try { await invoke('read_text', { path: join(folder, f.path) }); continue; } catch (_) { /* not there yet */ } }
        await invoke('write_text', { path: join(folder, f.path), content: f.content });
      }
      closeHand();
      tLine(`Handed the map to your AI: ${hand.dir}proposal.md and tasks.md are in ${folder}.`, 't-sys');
    } catch (e) { hand.note = 'Could not write the files: ' + e; renderHand(); }
  }
  $('btnHandAI').addEventListener('click', openHand);
  $('btnHandAI2').addEventListener('click', openHand);
  $('handClose').addEventListener('click', closeHand);
  $('handGo').addEventListener('click', handGo);
  $('handCopy').addEventListener('click', () => { const f = hand.files.find(x => x.path.endsWith('/' + hand.show)); if (f) copyText(f.content, $('handCopy'), 'Copy'); });
  // the folder's tasks.md (desktop), or one chosen from this computer (browser): its ticks come back to the map
  $('handTake').addEventListener('click', async () => {
    const said = takeTicks(hand.tasksText, hand.dir + 'tasks.md');
    await openHand();   // the files now say the same as the map
    hand.note = said; renderHand();
  });
  $('handTicksFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    let text;
    try { text = await f.text(); } catch (err) { hand.note = `${f.name} could not be read: ${err.message || err}`; return renderHand(); }
    const said = takeTicks(text, f.name);
    hand.files = handFiles();   // tasks.md, shown, ticks them too
    hand.note = said; renderHand();
  });
  $('handModal').addEventListener('click', (e) => {
    if (e.target.id === 'handModal') return closeHand();
    const t = e.target.closest('[data-hand-file]');
    if (t) { hand.show = t.dataset.handFile; renderHand(); }
  });

  async function loadExampleProject() {
    closeImport();
    try {
      const base = new URL('samples/taskboard/', document.baseURI).href;
      const manifest = await (await fetch(base + 'files.json')).json();
      const files = [];
      for (const f of manifest.files) files.push({ name: manifest.name + '/' + f, source: await (await fetch(base + f)).text() });
      importProject(files, 'The example is a small task-tracker web app of the kind an AI assistant might write.');
    } catch (e) {
      tLine('The example project could not be loaded: ' + e.message, 't-err');
    }
  }
  $('impExample').addEventListener('click', loadExampleProject);

  $('impFiles').addEventListener('change', async (e) => {
    const list = [...e.target.files].map(f => ({ path: f.name, file: f }));
    e.target.value = '';
    if (!list.length) return;
    const { files } = await filesToProject(list);
    closeImport();
    addFiles(files);
  });
  $('impFolder').addEventListener('change', async (e) => {
    const list = [...e.target.files].map(f => ({ path: f.webkitRelativePath || f.name, file: f }));
    e.target.value = '';
    if (!list.length) return;
    // one IntuaCode saved (an unzipped Save): as it was saved
    if (await openSaved(new Map(list.map(({ path, file }) => [path, async () => new Uint8Array(await file.arrayBuffer())])), list[0].path.split('/')[0])) return;
    const { files, skipped } = await filesToProject(list);
    importProject(files, skipped ? `Skipped ${skipped} files that aren't code or project notes (images, caches, virtual environments…).` : '');
  });
  $('impZip').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    $('impNote').textContent = 'Opening the .zip…';
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (await openSavedZip(bytes, f.name)) return;
      const R = await Runner.reader((s) => setStatus(s));
      importProject(R.readZip(bytes), '');
    } catch (err) { $('impNote').textContent = 'That .zip could not be opened: ' + err.message; }
  });

  // Drag and drop files or whole folders onto the dialog
  const card = $('impCard');
  card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('dropping'); });
  card.addEventListener('dragleave', (e) => { if (!card.contains(e.relatedTarget)) card.classList.remove('dropping'); });
  card.addEventListener('drop', async (e) => {
    e.preventDefault();
    card.classList.remove('dropping');
    const entries = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    const list = [];
    const walk = (entry, prefix) => new Promise((resolve) => {
      if (entry.isFile) entry.file(f => { list.push({ path: prefix + f.name, file: f }); resolve(); }, () => resolve());
      else if (entry.isDirectory) {
        if (SKIP_DIRS.has(entry.name)) return resolve();
        const reader = entry.createReader();
        const all = [];
        const more = () => reader.readEntries(async (batch) => {
          if (!batch.length) { for (const c of all) await walk(c, prefix + entry.name + '/'); resolve(); }
          else { all.push(...batch); more(); }
        }, () => resolve());
        more();
      } else resolve();
    });
    if (entries.length) for (const en of entries) await walk(en, '');
    else for (const f of e.dataTransfer.files) list.push({ path: f.name, file: f });
    if (!list.length) return;
    if (list.length === 1 && /\.zip$/i.test(list[0].path)) {
      const bytes = new Uint8Array(await list[0].file.arrayBuffer());
      if (await openSavedZip(bytes, list[0].path)) return;
      const R = await Runner.reader((s) => setStatus(s));
      return importProject(R.readZip(bytes), '');
    }
    if (entries.some(en => en.isDirectory) && await openSaved(new Map(list.map(({ path, file }) => [path, async () => new Uint8Array(await file.arrayBuffer())])), list[0].path.split('/')[0])) return;
    const { files, skipped } = await filesToProject(list);
    if (entries.some(en => en.isDirectory)) importProject(files, skipped ? `Skipped ${skipped} files that aren't code or project notes.` : '');
    else { closeImport(); addFiles(files); }
  });

  $('impGo').addEventListener('click', () => {
    const text = $('impText').value;
    if (!text.trim()) { $('impNote').textContent = 'Paste some code first, or choose files or a folder.'; return; }
    const source = text.replace(/\r\n?/g, '\n'), CR = window.IntuiCodeReader;
    let name = $('impName').value.trim() || 'pasted';
    // the language: the one chosen, else the name's ending, else what the text itself is
    const picked = $('impLang').value;
    const d = !picked && CR ? CR.detect(LANGS.fromPath(name) !== 'text' ? name : '', source) : null;
    const lang = picked || (d && d.lang !== 'text' ? d.lang : LANGS.fromPath(name) !== 'text' ? LANGS.fromPath(name) : 'python');
    if (LANGS.fromPath(name) !== lang && LANGS.byId(lang)) name = name.replace(/\.[A-Za-z0-9]+$/, '') + '.' + LANGS.extOf(lang);   // pasted → pasted.rs
    closeImport();
    $('impText').value = '';
    addFiles([{ name, source, ...(picked ? { lang: picked } : {}) }]);
    if (!picked && d) tLine(`Reading it as ${langName(lang)}: ${d.why} If that's wrong, change it with ⋯ beside the file in Project.`, 't-sys');
  });

  /* Imported code becomes the project's own files, in Unity and Split Mode alike. A folder, a .zip or the example
   * is a new project (the one before is kept for "restore"); single files join the open project.
   *   Python, CSS and JavaScript come in as their exact lines: Unity shows them as code, and Translate to Plain
   *   Language Syntax turns any part into sentences. HTML, C++ and Arduino are read into sentences, because
   *   IntuaCode writes the page, the main or setup and loop around them. Other languages, notes and data come in
   *   as they are, and the help reads them to you. */
  const IMPORT_MAX = 200;   // a project's files (lang/project.js)
  function importLang(f) {
    if (f.lang && LANGS.byId(f.lang)) return f.lang;
    const byName = LANGS.fromPath(f.name), CR = window.IntuiCodeReader;
    if (byName !== 'text' || !CR) return byName;
    const d = CR.detect(f.name, f.source);   // no ending, or .txt: what the text itself is
    return d && d.lang && d.confidence !== 'guess' && LANGS.byId(d.lang) ? d.lang : 'text';
  }
  /* A path the project can hold: folders and names IntuaCode writes (Python's as module names), at most six deep. */
  function importPath(path, lang, taken) {
    let parts = path.split('/').filter(Boolean).map(p => p.replace(/[^\w+ .-]+/g, '-').replace(/^[^A-Za-z0-9_]+/, '').replace(/\s+$/, '').slice(0, 60) || 'file');
    if (parts.length > 6) parts = parts.slice(0, 5).concat(parts.slice(5).join('-'));
    if (lang === 'python') parts = parts.map((p, i) => (i === parts.length - 1 ? p.replace(/\.pyw?$/i, '') : p).replace(/\W/g, '_').replace(/^(\d)/, '_$1') + (i === parts.length - 1 ? '.py' : ''));
    const base = parts.join('/'), m = base.match(/^(.*?)(\.[^./]+)?$/);
    const clash = (p) => { const low = p.toLowerCase(); return taken.has(low) || [...taken].some(t => t.startsWith(low + '/') || low.startsWith(t + '/')); };
    for (let n = 1, p = base; n < 50; n++, p = `${m[1]}${lang === 'python' ? '_' : '-'}${n}${m[2] || ''}`) {
      if (!clash(p) && !pathProblem(p, lang)) return p;
    }
    return null;
  }
  /* One imported file as a project file: { section, note }. */
  async function importSection(f, path, lang) {
    const code = f.source.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    const id = newId();
    if (!UNITY || !UNITY.LANGS.includes(lang)) return { section: { id, path, lang, text: code + '\n' } };
    if (lang === 'python' || lang === 'css' || lang === 'js') return { section: { id, path, lang, text: UNITY.toFile(lang, code.split('\n'), []) + '\n' } };
    let r;
    try { r = await uConvert(lang, code + '\n'); } catch (e) { r = { ok: false, reason: e.message }; }
    if (r.ok) return { section: { id, path, lang, text: r.text.replace(/\n+$/, '') + '\n' }, note: r.exact === false ? `${path} may not come back exactly: ${r.reason || 'check it'}.` : '' };
    // can't be said in sentences (a header file, say): kept exactly as it is, as code IntuaCode reads to you
    return { section: { id, path, lang: lang === 'html' ? 'text' : 'c', text: code + '\n' }, note: `${path} couldn't be read into sentences (${r.reason}), so it's kept exactly as it is.` };
  }
  async function importSections(files, taken) {
    const out = [], notes = [];
    let left = 0, secrets = 0;
    for (const f of files) {
      if (/(^|\/)\.env(\.|$)/.test(f.name)) { secrets++; continue; }   // never bring secrets into a project
      if (taken.size >= IMPORT_MAX) { left++; continue; }
      const lang = importLang(f), path = importPath(shortPath(f.name), lang, taken);
      if (!path) { left++; continue; }
      const got = await importSection(f, path, lang);
      taken.add(path.toLowerCase());
      out.push(got.section);
      if (got.note) notes.push(got.note);
    }
    if (secrets) notes.push(`Left out ${secrets} secrets file${secrets > 1 ? 's' : ''} (.env): passwords and keys stay out of projects.`);
    if (left) notes.push(`${left} file${left > 1 ? 's' : ''} didn't fit (a project holds ${IMPORT_MAX} files, with names IntuaCode can write).`);
    return { sections: out, notes };
  }
  function countLangs(sections) {
    const counts = {};
    for (const s of sections) { const l = langName(s.lang); counts[l] = (counts[l] || 0) + 1; }
    const parts = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([l, c]) => `${c} ${l}`);
    return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] || 'nothing';
  }
  /* A folder, a .zip or the example: a new project of its files. */
  async function importProject(files, note) {
    closeImport();
    if (!files.length) { tLine('No code files were found there.', 't-err'); return; }
    const tops = new Set(files.map(f => (f.name.includes('/') ? f.name.split('/')[0] : '')));
    importTop = tops.size === 1 && !tops.has('') ? [...tops][0] : '';
    tLine(`Importing ${files.length} file${files.length > 1 ? 's' : ''}…`, 't-sys');
    const { sections, notes } = await importSections(files, new Set());
    if (!sections.length) { tLine('No code files were found there.', 't-err'); return; }
    const name = slug(importTop || baseName(files[0].name).replace(/\.\w+$/, '')) || 'imported';
    const pick = (re) => sections.find(s => re.test(s.path));
    const first = pick(/^index\.html?$/i) || pick(/^main\.py$/i) || pick(/^app\.py$/i) || pick(/\.ino$/i) || pick(/^main\.cpp$/i)
      || pick(/^(src\/)?(main|index|app)\.\w+$/i) || sections.find(isSentences) || sections[0];
    replaceProject({ version: 2, lang: 'python', name, sections, active: first.id, start: first.id }, `Imported ${name}: ${countLangs(sections)}.${note ? ' ' + note : ''}`);
    for (const n of notes) tLine('Note: ' + n, 't-sys');
  }
  /* Single files: added to the open project, the first one opened. */
  async function addFiles(files) {
    closeImport();
    importTop = '';
    const { sections, notes } = await importSections(files, new Set(project.sections.map(s => s.path.toLowerCase())));
    if (!sections.length) { tLine(notes[0] || 'Nothing was added.', 't-err'); return; }
    const copy = JSON.parse(JSON.stringify(project));
    copy.sections.push(...sections);
    const err = changeProject(copy, sections[0].id, `Added ${sections.map(s => s.path).join(', ')} to the project.`);
    if (err) { tLine(err, 't-err'); return; }
    for (const n of notes) tLine('Note: ' + n, 't-sys');
  }

  /* ------------------------------------------------------------------ */
  /* Images: pictures in the project's images/ folder, which sentences    */
  /* name "images/ship.png". The browser keeps each one by its content in */
  /* IndexedDB, so projects stay small; a saved project has them as real */
  /* files too, and those win when the folder is opened again.           */
  /* ------------------------------------------------------------------ */

  const imageUrls = new Map();   // content key -> data: URL, for the thumbnails and the preview
  const imagesWritten = new Set();   // "folder|name|key": already in that folder's images/
  let imageDb = null;
  const images = () => project.images || (project.images = []);
  const usesImages = () => project.sections.some(s => s.lang === 'python' || WEB_ROLE[s.lang]);
  function idb(mode, act) {
    imageDb = imageDb || new Promise((res, rej) => {
      const rq = indexedDB.open('intuicode', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('images');
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    return imageDb.then(db => new Promise((res, rej) => {
      const tx = db.transaction('images', mode), rq = act(tx.objectStore('images'));
      tx.oncomplete = () => res(rq && rq.result);
      tx.onerror = () => rej(tx.error);
    }));
  }
  async function keyOf(bytes) {
    try { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join(''); }
    catch (_) {   // no crypto.subtle (a page that isn't served securely): a plain hash, plus the length
      let h = 0x811c9dc5;
      for (const b of bytes) h = Math.imul(h ^ b, 16777619) >>> 0;
      return h.toString(16).padStart(8, '0') + bytes.length.toString(16).padStart(8, '0');
    }
  }
  const toB64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const sizeOf = (url) => new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 0, h: 0 }); im.src = url; });
  const kb = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' kB');

  /* Keep a picture's bytes as `name` in the project, in place of one with the same name. */
  async function keepImage(name, bytes) {
    const type = IMAGE_TYPES[name.split('.').pop().toLowerCase()];
    const key = await keyOf(bytes), url = `data:${type};base64,${toB64(bytes)}`;
    imageUrls.set(key, url);
    await idb('readwrite', s => s.put(url, key)).catch(() => tLine('This browser won\'t keep pictures after the page is closed (its storage is off or full). They work until then.', 't-sys'));
    const { w, h } = await sizeOf(url);
    const list = images(), at = list.findIndex(im => im.name === name), entry = { name, type, key, w, h, size: bytes.length };
    if (at >= 0) list[at] = entry; else list.push(entry);
    return { entry, replaced: at >= 0 };
  }

  async function addImageFiles(files) {
    if (mode !== 'write') setMode('write');
    if (!usesImages()) { tLine('Pictures are for websites and Python projects: a C++ or Arduino program has no screen of its own to show them on.', 't-sys'); return; }
    const added = [];
    for (const f of files) {
      const name = f.name.replace(/[^\w.-]+/g, '-').replace(/^[-.]+/, '').slice(-80);
      if (!IMAGE_NAME.test(name)) { tLine(`${f.name} isn't a picture IntuaCode can use: PNG, JPEG, GIF, WebP or SVG.`, 't-err'); continue; }
      if (f.size > IMAGE_MAX) { tLine(`${f.name} is ${kb(f.size)}; pictures can be up to 8 MB. (A copy exported "for the web" is usually far smaller, and loads faster.)`, 't-err'); continue; }
      const { entry, replaced } = await keepImage(name, new Uint8Array(await f.arrayBuffer()));
      added.push(entry);
      tLine(`${replaced ? 'Replaced' : 'Added'} images/${name}${entry.w ? ` (${entry.w} × ${entry.h} pixels)` : ''}.`, 't-sys');
    }
    if (!added.length) return;
    imagesChanged();
    const say = imageSentence(added[0].name);
    if (say) tLine(`In ${metaOf(activeSec()).title} it's used like this: ${say}  (Use, beside it on the left, puts that in for you.)`, 't-sys');
    if (project.kind === 'python' && /\.(jpe?g|webp|svg)$/i.test(added[0].name)) tLine('tkinter shows PNG and GIF pictures. Save a copy as PNG to use this one in a window.', 't-sys');
  }
  function imagesChanged() { save(); autosave(); renderImages(); if (webOn()) runWebsite(false); }

  /* The sentence that uses a picture, for the folder you're in. */
  function imageSentence(name, sec = activeSec()) {
    const path = 'images/' + name, bare = name.replace(/\.\w+$/, '');
    const camel = bare.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^(?=\d)/, 'picture') || 'picture';
    if (sec.file === 'structure') return `add a picture of "${path}" described as "‹what it shows›"`;
    if (sec.file === 'styling') return `style page: background picture ${path}`;
    if (sec.file === 'mechanics') return `load the picture "${path}" as ${camel}`;
    if (secLang(sec) === 'python') return `set ${bare.replace(/[^A-Za-z0-9]+/g, '_').replace(/^(?=\d)/, 'picture_').toLowerCase()}_picture to tk.PhotoImage(file="${path}")`;
    return null;
  }

  function renderImages() {
    const on = usesImages() && mode === 'write';
    $('imgWrap').hidden = !on;
    $('btnAddImage').hidden = !usesImages();
    if (!on) return;
    const list = images();
    $('imgCount').textContent = list.length ? String(list.length) : '';
    $('imgList').innerHTML = list.map(im => {
      const url = imageUrls.get(im.key);
      return `<li class="img-item"><span class="img-thumb">${url ? `<img src="${url}" alt="">` : '<span title="Its file wasn\'t found: add it again">?</span>'}</span>`
        + `<span class="img-name" title="images/${escHtml(im.name)}">${escHtml(im.name)}<small>${im.w ? `${im.w} × ${im.h}` : ''}${im.size ? `${im.w ? ' · ' : ''}${kb(im.size)}` : ''}</small></span>`
        + `<button type="button" class="btn small img-use" data-use="${escHtml(im.name)}" title="Put a sentence that uses it after the line you're on">Use</button>`
        + `<button type="button" class="tip-x img-x" data-del="${escHtml(im.name)}" aria-label="Take ${escHtml(im.name)} out of the project" title="Take it out of the project">×</button></li>`;
    }).join('') || `<li class="none">Pictures you add go in images/, for sentences like ${project.kind === 'website' ? 'add a picture of "images/cat.png"' : 'tk.PhotoImage(file="images/cat.png")'}.</li>`;
  }
  $('imgList').addEventListener('click', (e) => {
    const use = e.target.closest('[data-use]'), del = e.target.closest('[data-del]');
    if (use) { const say = imageSentence(use.dataset.use); if (say) insertSnippet(say); else tLine('Pictures are used from Structure, Styling or Mechanics (websites), or from Python.', 't-sys'); }
    if (del) {
      project.images = images().filter(im => im.name !== del.dataset.del);
      imagesChanged();
      tLine(`Took images/${del.dataset.del} out of the project.${desk.folder ? ' Its file stays in the folder\'s images/.' : ''}`, 't-sys');
    }
  });
  $('btnAddImage').addEventListener('click', () => $('imgPick').click());
  $('btnAddImage2').addEventListener('click', () => $('imgPick').click());
  $('imgPick').addEventListener('change', async (e) => { const files = [...e.target.files]; e.target.value = ''; await addImageFiles(files); });

  /* The preview can't reach files, so each picture's name in the page becomes the picture itself. */
  function withImages(html) {
    for (const im of images()) {
      const url = imageUrls.get(im.key);
      if (!url) continue;
      const name = im.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(`(["'(=])(?:\\./)?images/${name}(?=["')\\s>])`, 'g'), (_, before) => before + url);
    }
    return html;
  }

  /* The pictures of the project now open, from the browser's store. */
  async function loadImages() {
    const want = images().filter(im => !imageUrls.has(im.key));
    for (const im of want) { try { const url = await idb('readonly', s => s.get(im.key)); if (url) imageUrls.set(im.key, url); } catch (_) { /* no store: shown as missing */ } }
    renderImages();
    if (want.some(im => imageUrls.has(im.key)) && webOn()) runWebsite(false);
  }
  /* Pictures neither the project, the previous one ("restore") nor a backup uses are let go. */
  async function pruneImages() {
    const keep = new Set([...images(), ...((store.get(PREVIOUS_KEY, null) || {}).images || [])].map(im => im && im.key));
    try { for (const b of await backupTx('readonly', s => s.getAll())) for (const k of b.images || []) keep.add(k); }
    catch (_) { return; }   // the backups can't be read: keep every picture
    try { for (const k of await idb('readonly', s => s.getAllKeys())) if (!keep.has(k)) await idb('readwrite', s => s.delete(k)); } catch (_) { /* nothing kept */ }
  }

  /* Desktop: the pictures go in the folder's images/ (each once, unless it changes)… */
  async function writeImages(folder) {
    for (const im of images()) {
      const tag = `${folder}|${im.name}|${im.key}`, url = imageUrls.get(im.key);
      if (imagesWritten.has(tag) || !url) continue;
      await invoke('write_bytes', { path: join(folder, 'images/' + im.name), data: url.slice(url.indexOf(',') + 1) });
      imagesWritten.add(tag);
    }
  }
  /* …and come back from there when it's opened: the files win, as the code does. */
  async function readImages(folder) {
    let names = [];
    try { names = await invoke('list_files', { path: join(folder, 'images') }); } catch (_) { names = []; }
    for (const im of [...images()]) {
      if (!names.includes(im.name)) { tLine(`images/${im.name} isn't in the folder any more, so sentences that use it show nothing. Add it again with Menu → Add an image.`, 't-err'); continue; }
      try {
        const { entry } = await keepImage(im.name, fromB64(await invoke('read_bytes', { path: join(folder, 'images/' + im.name) })));
        imagesWritten.add(`${folder}|${entry.name}|${entry.key}`);
      } catch (e) { tLine(`Could not read images/${im.name}: ${e}`, 't-err'); }
    }
    const extra = names.filter(n => IMAGE_NAME.test(n) && !images().some(im => im.name === n));
    if (extra.length) tLine(`images/ also has ${extra.join(', ')}, not part of the project yet. Menu → Add an image adds ${extra.length > 1 ? 'them' : 'it'}.`, 't-sys');
    renderImages();
    if (webOn()) runWebsite(false);
  }

  /* ------------------------------------------------------------------ */
  /* Desktop app (Tauri): real folders, real Python, shell commands      */
  /* ------------------------------------------------------------------ */

  const TAURI = window.__TAURI__;
  const desk = { on: !!(TAURI && TAURI.core), linux: /Linux/.test(navigator.userAgent), folder: null, python: null, venv: null, git: null, proc: null, nextId: 1, saveTimer: null, dirty: false, closeAsks: false };
  const invoke = (cmd, args) => TAURI.core.invoke(cmd, args);
  const baseName = (p) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop();
  const join = (a, b) => a.replace(/[\\/]+$/, '') + '/' + b;

  /* The app's own folder dialog: the desktop layer only lets the window use folders picked here. */
  async function pickFolder(title) {
    try { return await invoke('pick_folder', { title }); }
    catch (e) { tLine('The folder picker could not open: ' + e, 't-err'); return null; }
  }
  /* The project's folder in the header, only when it has one (• after it: changes not written there yet). */
  function showFolder() {
    const el = $('folderName');
    el.hidden = !(desk.on && desk.folder);
    el.textContent = desk.folder ? baseName(desk.folder) + '/' : '';
    el.title = desk.folder || '';
    el.classList.toggle('unsaved', desk.dirty);
    document.title = desk.folder ? `IntuaCode — ${baseName(desk.folder)}` : 'IntuaCode';
  }

  /* What saving writes: the code files are the real project; the project itself (your sentences) goes in
   * .intuicode/ next to them. [[path, text]], project.json last. */
  function savedFiles() {
    activeSec().text = ta.value;
    compile();
    return project.sections.map(s => [fileName(s), codeOf(s)]).concat([['.intuicode/project.json', JSON.stringify({ ...project, folder: undefined }, null, 2)]]);
  }

  /* Save (desktop): to the project's folder, chosen the first time. */
  async function saveProject(pick) {
    if (!desk.on) return;
    clearTimeout(desk.saveTimer);
    if (!desk.folder) {
      if (pick === 'quiet') return;   // autosave only writes to a folder that was chosen
      const f = await pickFolder('Choose a folder to save this project in');
      if (!f) return;
      // never write over another project's files
      const names = project.sections.map(s => (s.file === 'sketch' && s.path === 'sketch.ino' ? baseName(f) + '.ino' : fileName(s))).concat('.intuicode/project.json');
      const taken = [];
      for (const n of names) { try { await invoke('read_text', { path: join(f, n) }); taken.push(n); } catch (_) { /* not there: free */ } }
      if (taken.length) {
        tLine(`Nothing was saved: ${baseName(f)} already has ${taken.join(', ')}, and saving would write over ${taken.length > 1 ? 'them' : 'it'}. Choose an empty folder, or use Menu → Open folder to open that project.`, 't-err');
        return;
      }
      desk.folder = f;
    }
    // everything to write is taken now: another project may be opened while the files are written
    const folder = desk.folder, files = savedFiles(), names = files.slice(0, -1).map(f => f[0]);
    try {
      for (const [name, content] of files) await invoke('write_text', { path: join(folder, name), content });
      await writeImages(folder);
      if (desk.folder === folder) { desk.dirty = false; showFolder(); if (pick !== 'quiet') setUnsaved(false); }
      if (pick !== 'quiet') tLine(`Saved to ${folder}: ${names.join(', ')}${images().length ? `, ${images().length} picture${images().length > 1 ? 's' : ''} in images/` : ''} (and your sentences, in .intuicode/).`, 't-sys');
    } catch (e) { tLine('Could not save: ' + e, 't-err'); }
  }
  /* Every change: the project goes in the next backup and counts as not saved yet (Save, Ctrl+S); the desktop
   * app writes it to its folder, if it has one, a moment later. */
  function autosave() {
    backups.due = true;
    setUnsaved(true);
    if (!desk.on) return;
    desk.dirty = true;
    showFolder();
    if (!desk.folder) return;
    clearTimeout(desk.saveTimer);
    desk.saveTimer = setTimeout(() => saveProject('quiet'), 1500);
  }

  /* Save, Ctrl+S: the desktop app writes the project's folder; a browser downloads the project as a .zip. */
  function manualSave() { if (desk.on) saveProject(); else downloadProject(); }

  /* Changes since the last Save: leaving the page, or closing the desktop app's window, asks first. */
  let unsavedWork = false;
  function setUnsaved(on) {
    if (unsavedWork === on) return;
    unsavedWork = on;
    if (desk.on && desk.closeAsks) invoke('guard_close', { on }).catch(() => { /* the window closes without asking */ });
  }

  /* Hand the browser a file to keep (it goes in its downloads). */
  function offerDownload(name, bytes, type = 'application/zip') {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /* Save in a browser: a .zip laid out as the desktop app saves a folder (code files, your sentences in
   * .intuicode/, pictures in images/), inside a folder named after the project. Import code → Open a .zip
   * opens it again as it was. */
  function downloadProject() {
    const top = String(project.name || 'my-program').replace(/[\\/:*?"<>|\s]+/g, '-');
    const files = savedFiles().map(([path, content]) => ({ path: `${top}/${path}`, content }));
    for (const im of project.images || []) {
      const url = imageUrls.get(im.key);
      if (url) files.push({ path: `${top}/images/${im.name}`, bytes: fromB64(url.slice(url.indexOf(',') + 1)) });
    }
    try { offerDownload(top + '.zip', OPENSPEC.zip(files)); }
    catch (e) { tLine('Could not save: ' + (e.message || e), 't-err'); return; }
    setUnsaved(false);
    tLine(`Saved ${top}.zip to your downloads. Import code → Open a .zip opens it again.`, 't-sys');
  }

  /* A project IntuaCode saved (Save's .zip, or that .zip unzipped), opened as it was saved: sentences, folders,
   * map and pictures. files: path -> async () => its bytes. false if it isn't one. */
  async function openSaved(files, label) {
    const meta = [...files.keys()].find(p => /^([^/]+\/)?\.intuicode\/project\.json$/.test(p));
    if (!meta) return false;
    const top = meta.slice(0, -'.intuicode/project.json'.length);
    const bytes = async (p) => { try { const get = files.get(top + p); return get ? await get() : null; } catch (_) { return null; } };
    const text = async (p) => { const b = await bytes(p); return b ? new TextDecoder().decode(b).replace(/\r\n?/g, '\n') : null; };
    let saved;
    try { saved = checkedProject(JSON.parse(await text('.intuicode/project.json'))); } catch (_) { saved = null; }
    if (!saved) return false;
    closeImport();
    replaceProject(saved, `Opened ${label}.`);
    let pictures = 0;
    for (const im of [...images()]) {
      const b = await bytes('images/' + im.name);
      if (b) { try { await keepImage(im.name, b); pictures++; } catch (_) { /* shown as missing */ } }
    }
    if (pictures) { renderImages(); if (webOn()) runWebsite(false); }
    // code changed since it was saved: a file kept as code takes it; sentences stay as they were saved
    compile();
    const stale = [];
    let took = false;
    for (const s of project.sections) {
      const there = await text(fileName(s));
      if (there == null || there.trim() === codeOf(s).trim()) continue;
      if (isSentences(s)) stale.push(fileName(s)); else { s.text = there; took = true; }
    }
    if (took) { ta.value = activeSec().text; refreshAll(); if (mode === 'unity') unityShow(); else splitPlain(); save(); }
    if (stale.length) tLine(`${stale.join(', ')} ${stale.length > 1 ? 'were' : 'was'} changed after this was saved. The sentences are as they were saved, and make the code as it was then.`, 't-err');
    if (!desk.on) setUnsaved(false);   // the same as the .zip it came from
    return true;
  }
  /* A .zip: one Save made opens as it was saved; false for any other. */
  async function openSavedZip(bytes, label) {
    let list = null;
    try { list = OPENSPEC.unzip(bytes); } catch (_) { list = null; }
    return !!list && openSaved(new Map(list.map(f => [f.path, () => unzipped(f)])), label);
  }
  /* A file's bytes from unzip(): stored ones as they are, deflated ones inflated (null where the browser can't). */
  async function unzipped(f) {
    if (f.method === 0) return f.data;
    if (f.method !== 8 || typeof DecompressionStream === 'undefined' || f.size > 50e6) return null;
    return new Uint8Array(await new Response(new Blob([f.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  }

  /* ------------------------------------------------------------------ */
  /* Backups: every 2 minutes, a copy of the project if it changed; the  */
  /* last 15 are kept (30 minutes). One list for this browser or app,   */
  /* whichever project each copy is of. In IndexedDB, as a project can  */
  /* be megabytes (localStorage holds about 5 MB in all).               */
  /* ------------------------------------------------------------------ */

  const BACKUP_EVERY = 2 * 60 * 1000, BACKUP_KEEP = 15;
  const backups = { due: false, db: null, last: null, chain: Promise.resolve() };
  // backups: { id, time, name, files, folder, images: [picture keys] }; copies: the project's JSON, by the same id
  function backupTx(mode, act) {
    backups.db = backups.db || new Promise((res, rej) => {
      const rq = indexedDB.open('intuicode-backups', 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore('backups', { keyPath: 'id', autoIncrement: true }); rq.result.createObjectStore('copies'); };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    return backups.db.then(db => new Promise((res, rej) => {
      const tx = db.transaction(['backups', 'copies'], mode), rq = act(tx.objectStore('backups'), tx.objectStore('copies'));
      tx.oncomplete = () => res(rq && rq.result);
      tx.onerror = tx.onabort = () => rej(tx.error);
    }));
  }
  /* A copy of the project as it is now (as the browser keeps it), if it changed since the last one (force: even
   * if not). Never in the way: one that fails is tried again next time. -> a promise, done when it's kept. */
  function takeBackup(force) {
    if (!backups.due && !force) return backups.chain;
    let entry;
    try { entry = { time: Date.now(), name: project.name, files: project.sections.length, folder: desk.folder || null, images: (project.images || []).map(im => im.key), json: JSON.stringify(project) }; }
    catch (_) { return backups.chain; }
    backups.due = false;
    backups.chain = backups.chain.then(() => keepBackup(entry)).catch(() => { backups.due = true; });
    return backups.chain;
  }
  async function keepBackup({ json, ...meta }) {
    const ids = await backupTx('readonly', b => b.getAllKeys());
    if (backups.last == null && ids.length) backups.last = await backupTx('readonly', (b, c) => c.get(ids[ids.length - 1]));
    if (json === backups.last) return;   // the same as the newest copy
    await backupTx('readwrite', (b, c) => { const rq = b.add(meta); rq.onsuccess = () => c.put(json, rq.result); return rq; });
    backups.last = json;
    if (ids.length >= BACKUP_KEEP) {
      const old = IDBKeyRange.upperBound(ids[ids.length - BACKUP_KEEP]);
      await backupTx('readwrite', (b, c) => { b.delete(old); c.delete(old); });
    }
  }
  setInterval(() => takeBackup(), BACKUP_EVERY);

  const ago = (t) => {
    const min = Math.floor((Date.now() - t) / 60000), d = new Date(t);
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? `at ${hm}` : `on ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} at ${hm}`;
  };
  async function openBackups() {
    $('bkNote').textContent = '';
    $('bkList').innerHTML = '';
    $('bkModal').hidden = false;
    $('bkClose').focus();
    let list = null;
    try { list = await backupTx('readonly', b => b.getAll()); } catch (_) { list = null; }
    $('bkList').innerHTML = !list ? `<li class="bk-none">Backups can't be kept here: this ${desk.on ? 'app' : 'browser'}'s storage is off or full.</li>`
      : !list.length ? '<li class="bk-none">No copies yet. The first is kept 2 minutes after the project changes.</li>'
      : list.reverse().map(b => `<li class="bk-item"><span class="bk-when" title="${escHtml(new Date(b.time).toLocaleString())}">${ago(b.time)}</span>`
        + `<span class="bk-what"><b>${escHtml(b.name)}</b><small>${+b.files || 0} file${+b.files === 1 ? '' : 's'}</small></span>`
        + `<button type="button" class="btn small" data-restore="${+b.id}">Restore</button></li>`).join('');
  }
  function closeBackups() { $('bkModal').hidden = true; }
  /* Restoring keeps a copy of what's open first, so a restore can be undone from Backups too. */
  async function restoreBackup(id) {
    let meta = null, saved = null;
    try {
      meta = await backupTx('readonly', b => b.get(id));
      const json = await backupTx('readonly', (b, c) => c.get(id));
      saved = meta && json ? checkedProject(JSON.parse(json)) : null;
    } catch (_) { saved = null; }
    if (!saved) { $('bkNote').textContent = 'That copy could not be read.'; return; }
    activeSec().text = ta.value;
    await takeBackup(true);
    closeBackups();
    // in the desktop app, a copy made in the folder that's open goes back there; any other has no folder yet
    const here = desk.on && desk.folder && meta.folder === desk.folder ? desk.folder : null;
    replaceProject(saved, `Restored ${saved.name} as it was ${ago(meta.time)}.` + (desk.on && !here ? ' It isn\'t saved in a folder: press Save to keep it.' : ''), here);
    if (here) autosave();   // written to the folder, as any change is
    backups.due = false;   // it's a backup already
  }
  $('btnBackups').addEventListener('click', openBackups);
  $('bkClose').addEventListener('click', closeBackups);
  $('bkModal').addEventListener('click', (e) => {
    if (e.target.id === 'bkModal') return closeBackups();
    const r = e.target.closest('[data-restore]');
    if (r) restoreBackup(+r.dataset.restore);
  });

  /* Leaving: the latest changes go in Backups (as far as the page gets), and a browser asks first if there are
   * changes since the last Save (in its own words). */
  window.addEventListener('beforeunload', (e) => {
    takeBackup();
    if (desk.on || !unsavedWork) return;
    e.preventDefault();
    e.returnValue = '';
  });
  window.addEventListener('pagehide', () => takeBackup());

  /* Closing the desktop app's window with changes since the last Save: the desktop layer holds the close and
   * asks here (ask-to-close). Whatever the answer, the latest changes go in Backups first. */
  function askToClose() {
    if (!unsavedWork) return closeWindow();
    $('closeModal').hidden = false;
    $('closeSave').focus();
  }
  async function closeWindow() {
    $('closeModal').hidden = true;
    await Promise.race([takeBackup(), new Promise(r => setTimeout(r, 2000))]);
    try { await invoke('close_window'); } catch (e) { tLine('The window could not close: ' + e, 't-err'); }
  }
  const keepOpen = () => { $('closeModal').hidden = true; };
  $('closeSave').addEventListener('click', async () => {
    keepOpen();
    await saveProject();
    if (!unsavedWork) closeWindow();   // (no folder chosen, or it couldn't save: the window stays)
  });
  $('closeDiscard').addEventListener('click', closeWindow);
  $('closeCancel').addEventListener('click', keepOpen);
  $('closeModal').addEventListener('click', (e) => { if (e.target.id === 'closeModal') keepOpen(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('closeModal').hidden) { e.stopPropagation(); keepOpen(); }
    else if (!$('bkModal').hidden) { e.stopPropagation(); closeBackups(); }
  }, true);

  $('btnSave').hidden = false;
  if (!desk.on) $('btnSave').title = 'Download the project as a .zip (Import code opens it again)';
  $('btnSave').addEventListener('click', manualSave);

  /* Open a folder in Split Mode. Code on disk wins over saved sentences if they disagree. */
  async function openFolderWrite() {
    const folder = await pickFolder('Open a project folder');
    if (!folder) return;
    const read = async (name) => { try { return await invoke('read_text', { path: join(folder, name) }); } catch (_) { return null; } };
    const meta = await read('.intuicode/project.json');
    if (meta) {
      let saved;
      try { saved = checkedProject(JSON.parse(meta)); } catch (_) { saved = null; }
      if (saved) {
        replaceProject(saved, `Opened ${baseName(folder)}.`, folder);
        if (images().length) await readImages(folder);
        // ticks your AI made in Hand to my AI's tasks.md come back to the map
        const tasksMd = project.plan && project.plan.steps.length ? await read(`openspec/changes/${OPENSPEC.changeName(project.name)}/tasks.md`) : null;
        if (tasksMd) takeTicks(tasksMd, `openspec/changes/${OPENSPEC.changeName(project.name)}/tasks.md`, true);
        // did anyone change the code outside IntuaCode?
        compile();
        const changed = [];
        for (const s of project.sections) {
          const onDisk = await read(fileName(s));
          if (onDisk != null && onDisk.replace(/\r\n/g, '\n').trim() !== codeOf(s).trim()) changed.push([s, onDisk.replace(/\r\n/g, '\n')]);
        }
        for (const [s, onDisk] of changed) {
          if (!isSentences(s)) { s.text = onDisk; tLine(`${fileName(s)} was changed outside IntuaCode: it's shown as it is now.`, 't-sys'); continue; }
          if (secLang(s) !== 'python') {
            const res = await rebuildSection(folder, s, read);
            if (res && res.ok) { s.text = res.text; tLine(`${fileName(s)} was changed outside IntuaCode, so its sentences were rebuilt from the code.${res.exact ? ' ✓ Checked exact.' : ' ' + res.reason}`, res.exact ? 't-sys' : 't-err'); }
            else tLine(`${fileName(s)} was changed outside IntuaCode and couldn't be turned back into sentences${res && res.error ? ': ' + res.error : ''}. The sentences may be out of date: Unity shows its code as it was.`, 't-err');
            continue;
          }
          const res = await sentencesFor(onDisk);
          if (res) { s.text = res.text; tLine(`${fileName(s)} was changed outside IntuaCode, so its sentences were rebuilt from the code.${res.exact ? ' ✓ Checked exact.' : ''}`, 't-sys'); }
        }
        if (changed.length) { ta.value = activeSec().text; refreshAll(); if (mode === 'write') splitPlain(); }
        showFolder();
        return;
      }
    }
    const main = await read('main.py');
    if (main == null) {
      // web pages, C++ and Arduino sketches become sentences too
      const files = await invoke('read_folder', { path: folder });
      const top = baseName(folder);
      const at = (n) => files.find(f => f.name === `${top}/${n}`);
      const sketch = at(`${top}.ino`) || files.find(f => /\.ino$/i.test(f.name) && f.name.split('/').length === 2);
      const pick = sketch || at('main.cpp') || at('index.html') || files.find(f => /\.cpp$/i.test(f.name) && /\bint\s+main\s*\(/.test(f.source)) || files.find(f => /\.html?$/i.test(f.name));
      if (pick) {
        let out = null;
        try { out = await codeToProject(pick, files, top); } catch (e) { tLine('Could not turn this code into sentences: ' + e.message, 't-err'); }
        if (out) {
          // Only work in the folder itself when saving writes the same files back, unchanged.
          const same = out.exact && ((out.project.kind === 'arduino' && pick.name === `${top}/${top}.ino`) || (out.project.kind === 'cpp' && pick.name === `${top}/main.cpp`)
            || (out.project.kind === 'website' && pick.name === `${top}/index.html` && out.results.length === 1 + !!at('style.css') + !!at('script.js') && !files.some(f => /\.css$/i.test(f.name) && f.name !== `${top}/style.css`) && !files.some(f => /\.js$/i.test(f.name) && f.name !== `${top}/script.js`)));
          replaceProject(out.project, same ? `Opened ${top} and turned its code into sentences.` : `Opened ${top}'s code as sentences in a new, unsaved project (the folder itself is left as it is, because saving would lay it out differently). Press Save to keep it.`, same ? folder : null);
          reportConversion(out.results);
          return;
        }
      }
    }
    if (main != null) {
      const settings = await read('settings.py'), tools = await read('tools.py');
      const structured = settings != null && tools != null;
      const sections = [];
      for (const [file, src] of structured ? [['settings', settings], ['tools', tools], ['main', main]] : [['main', main]]) {
        const res = await sentencesFor(src);
        sections.push({ id: file, file, text: res ? res.text : src.split('\n').map(l => 'python: ' + l).join('\n') });
      }
      replaceProject({ version: 1, lang: 'python', kind: 'python', name: slug(baseName(folder)), sections, active: 'main' }, `Opened ${baseName(folder)} and turned its Python into sentences.`, folder);
      return;
    }
    const files = await invoke('read_folder', { path: folder });
    if (files.some(f => /\.(py|jsx?|tsx?|html?|css|cpp|cc|h|hpp|ino)$/i.test(f.name))) {
      tLine(`${baseName(folder)} isn't an IntuaCode project yet: its code comes in as a new, unsaved project (the folder is left as it is). Press Save to keep it.`, 't-sys');
      desk.readFolder = folder;
      return importProject(files, '');
    }
    desk.folder = folder;
    await saveProject('quiet');
    tLine(`${baseName(folder)} was empty, so the current project was saved into it.`, 't-sys');
  }

  /* Import a folder's code (the desktop app's own folder picker). */
  async function importFolder() {
    const folder = await pickFolder('Import a folder of code');
    if (!folder) return;
    closeImport();
    tLine(`Reading ${folder}…`, 't-sys');
    try {
      const files = await invoke('read_folder', { path: folder });
      desk.readFolder = folder;
      importProject(files, files.length >= 400 ? 'Only the first 400 files were read.' : '');
    } catch (e) { tLine('Could not read the folder: ' + e, 't-err'); }
  }

  /* Files and folders dropped on the window. The window takes a drop before the page sees it, so it
     arrives here as paths, which the desktop layer lets the window read (and only those). */
  async function openDropped(paths) {
    $('impCard').classList.remove('dropping');
    if (paths.length === 1 && /\.zip$/i.test(paths[0])) {
      closeImport();
      try {
        const bytes = fromB64(await invoke('read_bytes', { path: paths[0] }));
        if (await openSavedZip(bytes, baseName(paths[0]))) return;
        const R = await Runner.reader((s) => setStatus(s));
        importProject(R.readZip(bytes), '');
      } catch (e) { tLine('That .zip could not be opened: ' + (e.message || e), 't-err'); }
      return;
    }
    const files = [];
    let folders = 0, skipped = 0;
    for (const path of paths) {
      try {
        files.push(...await invoke('read_folder', { path }));
        folders++;
        desk.readFolder = path;
        continue;
      } catch (_) { /* not a folder: a file */ }
      const name = baseName(path), kind = keepPath(name);
      if (!kind) { skipped++; continue; }
      if (kind === 'secret') { files.push({ name, source: '' }); continue; }   // (secrets are never read)
      try { files.push({ name, source: (await invoke('read_text', { path })).replace(/\r\n?/g, '\n') }); } catch (_) { skipped++; }
    }
    closeImport();
    if (!files.length) { tLine(`Nothing to import there: IntuaCode takes code files, folders of them and .zip files.`, 't-err'); return; }
    const note = skipped ? `Skipped ${skipped} file${skipped > 1 ? 's' : ''} that ${skipped > 1 ? 'aren\'t' : 'isn\'t'} code.` : '';
    if (folders) importProject(files, note); else { addFiles(files); if (note) tLine(note, 't-sys'); }
  }

  /* A website, C++ or Arduino file changed on disk: its sentences again, from the code. */
  async function rebuildSection(folder, s, read) {
    try {
      const C = window.IntuiConvert;
      const env = await convertEnv();
      const src = await read(fileName(s));
      if (s.file === 'program' || s.file === 'sketch') return C.toSentences(s.file === 'sketch' ? 'arduino' : 'cpp', src, env);
      const page = (await read('index.html')) || '';
      if (s.file === 'structure') return C.toSentences('html', src, { ...env, pulled: ['style.css', 'script.js'] });
      const info = C.pageInfo(env.parse, page);
      return C.toSentences(s.file === 'styling' ? 'css' : 'js', src, { ...env, ids: info.ids, groups: info.groups });
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async function sentencesFor(src) {
    try {
      const out = checkedSentences(await Runner.reader((s) => setStatus(s)), src);
      return out.ok ? { text: out.text, exact: !!out.check.same } : null;
    } catch (e) { tLine('Could not read the Python: ' + e.message, 't-err'); return null; }
  }

  /* Running with the computer's own Python, and shell commands. */
  function setRunning(on, label) {
    $('btnStop').hidden = !on;
    termPrompt.textContent = on ? (label || 'input ›') : '❯';
    termPrompt.classList.toggle('asking', on);
    termIn.classList.toggle('asking', on);
    termIn.placeholder = on ? 'type input for the program and press Enter' : 'type help, run, $ a command, or any sentence or Python';
  }
  async function runDesktopPython() {
    const dir = desk.folder || await invoke('scratch_folder');
    try { for (const s of project.sections) await invoke('write_text', { path: join(dir, fileName(s)), content: codeOf(s) }); await writeImages(dir); }
    catch (e) { tLine('Could not write the program files: ' + e, 't-err'); return; }
    try { desk.venv = await invoke('find_venv', { cwd: dir }); } catch (_) { desk.venv = null; }
    const id = desk.nextId++;
    desk.proc = { id, kind: 'python', err: '' };
    const start = startSec().lang === 'python' ? startSec().path : 'main.py';
    tLine(`▶ Running ${start} with ${desk.venv ? `the project's own Python (${desk.venv})` : `Python ${desk.python[1]} (installed on this computer)`}${desk.folder ? '' : ', from a temporary folder: press Save to keep the project'}`, 't-sys');
    setRunning(true);
    termIn.focus({ preventScroll: true });
    try { await invoke('run_program', { id, program: desk.python[0], args: ['-u', start], cwd: dir }); }
    catch (e) { tLine(String(e), 't-err'); desk.proc = null; setRunning(false); }
  }
  async function runDesktopCpp() {
    const dir = desk.folder || await invoke('scratch_folder');
    const win = /Win/i.test(navigator.userAgent);
    // every C++ file (headers too), then the start file is compiled
    const main = startSec().lang === 'cpp' ? startSec() : project.sections.find(s => s.lang === 'cpp');
    try { for (const s of project.sections.filter(x => x.lang === 'cpp')) await invoke('write_text', { path: join(dir, s.path), content: codeOf(s) }); }
    catch (e) { tLine('Could not write the C++ files: ' + e, 't-err'); return; }
    // the built program goes in .intuicode/build, not among your files
    const exe = '.intuicode/build/intuicode-program' + (win ? '.exe' : '');
    try { await invoke('write_text', { path: join(dir, '.intuicode/build/.gitignore'), content: '*\n' }); } catch (_) { /* compiling says why */ }
    const id = desk.nextId++;
    desk.proc = { id, kind: 'compile', err: '', out: '', dir, exe, source: main.path, sec: main.id };
    const msvc = desk.cpp[0] === 'msvc';
    tLine(`▶ Compiling ${main.path} with ${msvc ? desk.cpp[1] : desk.cpp[0]}…${msvc ? ' (Visual Studio takes a few seconds to start.)' : ''}`, 't-sys');
    setRunning(true, 'compiling…');
    try { await invoke('compile_cpp', { id, source: main.path, output: exe, cwd: dir }); }
    catch (e) { tLine(String(e), 't-err'); desk.proc = null; setRunning(false); }
  }
  /* Compiler complaints that need a word about the board, not the code. */
  const COMPILER_HINTS = [
    [/'LED_BUILTIN' was not declared/, 'Not every board has a built-in light called LED_BUILTIN (most ESP32 boards don\'t). Use the pin number of a light on your board, like "set led to 2", or wire an LED to a pin and use that pin.'],
  ];
  /* Compiler messages -> the sentence they came from. g++/clang++: main.cpp:12:5: error: …   Visual Studio: main.cpp(12): error C2065: … */
  function compilerErrors(err, file = 'main.cpp', secId = 'program') {
    const res = secResult(secId);
    const sec = project.sections.find(x => x.id === secId);
    const f = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|[\\/\\s])${f}(?::(\\d+):\\d+:\\s*(?:fatal )?error:|\\((\\d+)(?:,\\d+)?\\)\\s*:\\s*(?:fatal )?error\\s*(?:C\\d+)?\\s*:)\\s*(.*)`, 'gm');
    let shown = 0;
    for (const m of err.matchAll(re)) {
      const n = +(m[1] || m[2]);
      const o = res && res.lines[n - 1];
      const line = o && o.src >= 0 ? o.src : null;
      tLine(`✕ The compiler says: ${m[3]}`, 't-err');
      const hint = COMPILER_HINTS.find(([re]) => re.test(m[3]));
      if (hint) tLine('  ' + hint[1], 't-sys');
      if (line != null && sec && sec.text.split('\n')[line].trim()) pointAt(secId, line, `The compiler says: ${m[3]}`, true);
      if (++shown >= 5) break;
    }
    if (!shown && /\S/.test(err)) tLine('The compiler\'s own words are above.', 't-sys');
  }

  /* Arduino: check the sketch with arduino-cli, upload it to a connected board, then show what it sends. */
  async function runDesktopArduino() {
    const capture = async (args) => { try { const [code, out, err] = await invoke('run_capture', { program: desk.arduino[0], args, cwd: null }); return { code, out, err }; } catch (e) { return { code: -1, out: '', err: String(e) }; } };
    let dir = desk.folder;
    if (!dir) dir = join(await invoke('scratch_folder'), slug(project.name) || 'sketch');
    const name = baseName(dir);
    // the sketch is named after its folder; other .ino files are more tabs of the same sketch
    const sk = startSec().lang === 'arduino' ? startSec() : project.sections.find(s => s.lang === 'arduino');
    try {
      await invoke('write_text', { path: join(dir, name + '.ino'), content: codeOf(sk) });
      for (const s of project.sections.filter(x => x.lang === 'arduino' && x !== sk)) await invoke('write_text', { path: join(dir, s.path), content: codeOf(s) });
    }
    catch (e) { tLine('Could not write the sketch: ' + e, 't-err'); return; }
    setRunning(true, 'checking…');
    tLine('Looking for a connected board…', 't-sys');
    const list = await capture(['board', 'list', '--format', 'json']);
    let port = null, fqbn = null, boardName = null, unnamed = null;
    try {
      const data = JSON.parse(list.out || '[]');
      const ports = Array.isArray(data) ? data : data.detected_ports || [];
      for (const p of ports) {
        const b = (p.matching_boards || p.boards || [])[0];
        const where = p.port || p;
        if (b && b.fqbn) { port = where.address; fqbn = b.fqbn; boardName = b.name; break; }
        // a USB device arduino-cli can't name: a board with a USB-serial chip (built-in serial ports have no USB id)
        if (!unnamed && where.protocol === 'serial' && where.properties && where.properties.vid) unnamed = where.address;
      }
    } catch (_) { /* no boards listed */ }
    if (!port && unnamed && project.board) { port = unnamed; fqbn = project.board; }
    fqbn = fqbn || project.board || 'arduino:avr:uno';
    if (port) tLine(`Found ${boardName || fqbn} on ${port}.`, 't-sys');
    else if (unnamed) tLine(`There is a board on ${unnamed}, but it doesn't say which kind it is (boards with a USB-serial chip, like many ESP32 boards, don't). Type board esp32 (or uno, nano, mega, or arduino-cli's full name for it) and press Run again to upload to it. For now the sketch is only checked, for ${fqbn}.`, 't-sys');
    else tLine(`No board is plugged in, so the sketch will only be checked (for ${project.board ? fqbn : 'an Arduino Uno'}). Plug one in by USB and press Run again to upload it.`, 't-sys');
    const id = desk.nextId++;
    desk.proc = { id, kind: 'ino-compile', err: '', out: '', dir, name, port, fqbn, sec: sk.id };
    tLine(`▶ Checking the sketch (arduino-cli compile, ${fqbn})…`, 't-sys');
    try { await invoke('run_program', { id, program: desk.arduino[0], args: ['compile', '--fqbn', fqbn, dir], cwd: dir }); }
    catch (e) { tLine(String(e), 't-err'); desk.proc = null; setRunning(false); }
  }
  function arduinoNext(p, code) {
    const all = p.err + '\n' + p.out;
    if (p.kind === 'ino-compile') {
      if (code !== 0) {
        if (/platform not installed|Platform '[^']+' not found|No platforms installed|unknown package/i.test(all)) {
          const core = p.fqbn.split(':').slice(0, 2).join(':');
          // Espressif's ESP32 boards come from their own list, not Arduino's
          const extra = core === 'esp32:esp32' ? ' --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json' : '';
          const cli = /\s/.test(desk.arduino[0]) ? `"${desk.arduino[0]}"` : desk.arduino[0];
          tLine(`The board support for ${core} isn't installed yet. Type this in the terminal (it downloads it once):`, 't-err');
          if (extra) tLine(`  $ ${cli} core update-index${extra}`, 't-help');
          tLine(`  $ ${cli} core install ${core}${extra}`, 't-help');
          return;
        }
        compilerErrors(all, p.name + '.ino', p.sec);
        tLine('■ The sketch could not be checked.', 't-sys');
        return;
      }
      tLine('✓ The sketch builds.', 't-ok');
      if (!p.port) return;
      const id = desk.nextId++;
      desk.proc = { ...p, id, kind: 'ino-upload', err: '', out: '' };
      tLine(`▶ Uploading to the board on ${p.port}…`, 't-sys');
      setRunning(true, 'uploading…');
      invoke('run_program', { id, program: desk.arduino[0], args: ['upload', '-p', p.port, '--fqbn', p.fqbn, p.dir], cwd: p.dir }).catch((e) => { tLine(String(e), 't-err'); desk.proc = null; setRunning(false); });
      return;
    }
    if (p.kind === 'ino-upload') {
      if (code !== 0) {
        tLine('■ The upload didn\'t work. Check the USB cable, close any other program using the board (like the Arduino IDE\'s serial monitor), and try again.', 't-err');
        // a board's port belongs to the dialout group (uucp on Arch), which new accounts aren't in
        if (desk.linux && /permission denied/i.test(all)) tLine(`On Linux, using ${p.port} needs permission, once: type $ sudo usermod -aG dialout $USER (on Arch Linux, uucp instead of dialout), then log out and back in.`, 't-sys');
        return;
      }
      tLine('✓ Uploaded: the sketch is running on the board.', 't-ok');
      const baud = (codeOf(project.sections.find(s => s.id === p.sec) || startSec()).match(/Serial\.begin\((\d+)\)/) || [])[1];
      if (!baud) return;
      const id = desk.nextId++;
      desk.proc = { ...p, id, kind: 'monitor', err: '', out: '' };
      tLine(`▶ Showing what the board sends (serial monitor at ${baud}). Press Stop to close it.`, 't-sys');
      setRunning(true, 'board ›');
      invoke('run_program', { id, program: desk.arduino[0], args: ['monitor', '-p', p.port, '--config', `baudrate=${baud}`], cwd: p.dir }).catch((e) => { tLine(String(e), 't-err'); desk.proc = null; setRunning(false); });
    }
  }

  async function runShell(command) {   // (while a program runs, what is typed goes to it instead)
    const dir = desk.folder || desk.readFolder || await invoke('scratch_folder');
    const id = desk.nextId++;
    desk.proc = { id, kind: 'shell', err: '' };
    tLine(`$ ${command}`, 't-cmd');
    setRunning(true, 'input ›');
    try { await invoke('run_shell', { id, command, cwd: dir }); }
    catch (e) { tLine(String(e), 't-err'); desk.proc = null; setRunning(false); }
  }
  function pythonTraceback(err) {
    const frames = [...err.matchAll(/File "([^"]+)", line (\d+)/g)].map(m => ({ file: baseName(m[1]), line: +m[2] })).filter(f => project.sections.some(s => fileName(s) === f.file));
    const last = err.trim().split('\n').pop() || '';
    const m = last.match(/^(\w+(?:Error|Exception|Exit|Interrupt)):?\s*(.*)$/);
    if (m && m[1] !== 'SystemExit') { const f = friendly(m[1], m[2]); if (f) tLine('✕ ' + f, 't-err'); }
    const fr = frames[frames.length - 1];
    const where = fr && locate(fr.file, fr.line);
    if (where && where.line != null) pointAt(where.sec, where.line, (m ? friendly(m[1], m[2]) || '' : '') + ` (Python said: ${last})`);
  }

  async function setupDesktop() {
    if (!desk.on) return;
    document.documentElement.classList.add('desktop');
    $('btnOpenFolder').hidden = false;
    $('btnSave').hidden = false;
    showFolder();
    $('btnOpenFolder').addEventListener('click', openFolderWrite);
    $('btnStop').addEventListener('click', () => { if (desk.proc) invoke('stop_program', { id: desk.proc.id }); });
    // closing the window with changes not saved asks here first (not while WebDriver drives the app, as its tests do)
    await TAURI.event.listen('ask-to-close', askToClose);
    desk.closeAsks = !navigator.webdriver;
    if (desk.closeAsks) invoke('guard_close', { on: unsavedWork }).catch(() => { /* the window closes without asking */ });
    // the import dialog's folder button uses the native picker
    $('impFolder').closest('label').addEventListener('click', (e) => { e.preventDefault(); importFolder(); });
    // drops on the window come as paths (the page's own drop events never fire)
    await TAURI.event.listen('tauri://drag-enter', () => { if (!$('impModal').hidden) $('impCard').classList.add('dropping'); });
    await TAURI.event.listen('tauri://drag-leave', () => $('impCard').classList.remove('dropping'));
    await TAURI.event.listen('tauri://drag-drop', (e) => openDropped((e.payload && e.payload.paths) || []));
    await TAURI.event.listen('proc-output', (e) => {
      const d = e.payload;
      if (!desk.proc || d.id !== desk.proc.id) return;
      if (d.stream === 'stderr') desk.proc.err += d.text;
      else desk.proc.out = (desk.proc.out || '') + d.text;
      // Visual Studio's cl names the file it compiles; that line isn't news
      const text = desk.proc.kind === 'compile' ? d.text.replace(/^main\.cpp\r?\n/m, '') : d.text;
      if (text) tWrite(text, d.stream === 'stderr' ? 't-err' : undefined);
    });
    await TAURI.event.listen('proc-exit', (e) => {
      const d = e.payload;
      if (!desk.proc || d.id !== desk.proc.id) return;
      const p = desk.proc;
      desk.proc = null;
      setRunning(false);
      if (p.kind === 'python' && d.code !== 0 && d.code != null) pythonTraceback(p.err);
      if (/^ino-/.test(p.kind)) return arduinoNext(p, d.code);
      if (p.kind === 'compile') {
        if (d.code === 0) {
          const id = desk.nextId++;
          desk.proc = { id, kind: 'cpp', err: '' };
          tLine('▶ Running the program', 't-sys');
          setRunning(true);
          invoke('run_program', { id, program: join(p.dir, p.exe), args: [], cwd: p.dir }).catch((e) => { tLine(String(e), 't-err'); desk.proc = null; setRunning(false); });
          return;
        }
        compilerErrors(p.err + '\n' + (p.out || ''), p.source, p.sec);
        tLine('■ The program could not be compiled.', 't-sys');
        return;
      }
      tLine(d.code === 0 ? '✓ Finished.' : d.code == null ? '■ Stopped.' : `■ Ended with exit code ${d.code}.`, d.code === 0 ? 't-ok' : 't-sys');
      if (p.kind === 'shell' && d.code) shellHints(p.err + '\n' + (p.out || ''));
    });
    try { desk.python = await invoke('find_python'); } catch (_) { desk.python = null; }
    try { desk.git = await invoke('find_git'); } catch (_) { desk.git = null; }
    try { desk.cpp = await invoke('find_cpp'); } catch (_) { desk.cpp = null; }
    try { desk.arduino = await invoke('find_arduino'); } catch (_) { desk.arduino = null; }
    if (desk.python) setStatus(`Python ${desk.python[1]} (this computer)`, 'ready');
    tLine(desk.python ? `Desktop app: programs run with Python ${desk.python[1]} installed on this computer. Type $ before a command to run it in the project folder${desk.git ? ' (for example $ git status)' : ''}.` : `Desktop app: Python isn't installed on this computer, so the built-in Python is used (it can't install extra packages). ${desk.linux ? 'Install Python with your system\'s package manager (for example: sudo apt install python3)' : 'Get Python from python.org'} to run programs like web servers.`, 't-sys');
  }

  /* After a command fails: what to do about the usual reasons on Linux (pip, venv, sudo). */
  function shellHints(all) {
    if (!desk.linux) return;
    const venvPackage = (all.match(/apt install (python3[\w.]*-venv)/) || [])[1];
    if (venvPackage) tLine(`Making one needs Python's venv support, which isn't installed yet. Type $ sudo apt install ${venvPackage}, then $ python3 -m venv .venv again.`, 't-sys');
    // (bash: "pip: command not found", zsh: "command not found: pip", fish: "Unknown command: pip")
    else if (/externally-managed-environment|No module named pip|pip3?: (command )?not found|(not found|Unknown command):? pip/.test(all)) tLine('This computer\'s Python keeps its packages for the system, so pip can\'t add any to it. Give the project a Python of its own (a virtual environment): type $ python3 -m venv .venv. After that, $ pip install … puts packages there, and Run uses it.', 't-sys');
    if (/sudo: a terminal is required/.test(all)) tLine('sudo asks for your password, and this terminal can\'t: this computer has no password window for it (such as ssh-askpass). Run that command in your system\'s terminal instead.', 't-sys');
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard + start                                                    */
  /* ------------------------------------------------------------------ */

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && document.activeElement !== ta) { e.preventDefault(); run(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); manualSave(); }
    // (a browser keeps Ctrl+N for a new window; the desktop app gets it)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); openNewProject(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o' && desk.on) { e.preventDefault(); $('btnOpenFolder').click(); }
    // Ctrl+H: the words here, explained (it toggles; a browser's history is a menu away)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'h' && mode === 'write') {
      e.preventDefault();
      if (!gloss.hidden && !gloss.contains(document.activeElement)) closeGlossary(); else openGlossary();
      return;
    }
    if (e.key === 'Escape') {
      if (!gloss.hidden) closeGlossary();
      else if (maxed && tip.hidden && !document.querySelector('.modal:not([hidden])') && ac.hidden) setMax(maxed);
      else if (!tip.hidden) hideTip();
      else if (!$('stepModal').hidden) closeStep();
      else if (!$('handModal').hidden) closeHand();
      else if (!$('fileModal').hidden) closeFileDialog();
      else if (!$('stepAddModal').hidden) closeStepAdd();
      else if (!$('builderModal').hidden) closeBuilder();
      else if (!$('newModal').hidden) closeNewProject();
      else if (!$('fileList').hidden) setFileMenu(false);
      else if (!$('bpModal').hidden) closeBlueprints();
      else if (!$('libModal').hidden) closeLibrary();
      else if (!$('impModal').hidden) closeImport();
      else if (!ac.hidden) closeAc();
      else if (!$('index').hidden) closeIndex();
    }
  });

  function start() {
    applyLayout();
    applyDropDown();
    applyPredict();
    $('btnLink').setAttribute('aria-pressed', String(!!layout.link));
    ta.value = activeSec().text;
    renderSectionHeader();
    refreshAll();
    setMode(mode);   // Unity, unless Split Mode was used last
    $('work').classList.toggle('web', webOn());
    showBottom(project.kind === 'website' ? 'preview' : 'terminal');
    updateChip();
    if (webOn()) runWebsite(false);
    loadImages().then(pruneImages);
    tLine('IntuaCode terminal. Press Run to run your program, or type help.', 't-sys');
    setupDesktop();
    $('btnTutor').setAttribute('aria-pressed', String(tutor.on));
    setTimeout(async () => {
      await ensurePython();
      if (tutor.on) loadTutorReader();
    }, 1200);
  }

  window.addEventListener('resize', () => { measure(); syncScroll(); placeTip(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); syncScroll(); });
  start();
})();

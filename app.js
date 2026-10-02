/* IntuCode — the app.
 *
 * Write mode:  blueprint (story with blanks) -> sentences in folders -> Python -> terminal
 * Read mode:   imported Python -> sections -> plain-English summaries and sentences
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
  // An Arduino sketch must be named after its folder (blink/blink.ino).
  const sketchName = () => (desk.folder ? baseName(desk.folder) : project.name || 'sketch');
  const fileName = (sec) => (sec.file === 'sketch' ? sketchName() + '.ino' : FILE_NAME[sec.file] || sec.file + '.py');
  const secLang = (sec) => SEC_LANG[sec.file] || 'python';
  /* What the phrase picker, Index and auto-indent use for a folder. */
  function packFor(sec) {
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
   * parts IntuCode uses, checked, so a project file from someone else can't put markup into the
   * page or odd values into the commands IntuCode runs. */
  const KIND_FILES = { python: ['settings', 'tools', 'main'], website: LAYOUTS.website, cpp: LAYOUTS.cpp, arduino: LAYOUTS.arduino };
  // pictures in a project's images/ folder: a plain file name with a picture's ending, nothing more
  const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
  const IMAGE_NAME = /^[A-Za-z0-9_][\w.-]{0,78}\.(?:png|jpe?g|gif|webp|svg)$/i;
  const IMAGE_MAX = 8e6;
  const BOARD_ID = /^[\w.-]+:[\w.-]+:[\w.-]+(?::[\w.=,-]+)?$/;   // arduino-cli's name for a kind of board, e.g. esp32:esp32:esp32
  function checkedProject(p) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.sections) || !p.sections.length) return null;
    const kind = KIND_FILES[p.kind] ? p.kind : 'python';
    const sections = p.sections.map(s => (s && KIND_FILES[kind].includes(s.file) && /^[\w-]{1,40}$/.test(s.id) ? { id: s.id, file: s.file, text: typeof s.text === 'string' ? s.text : '' } : null));
    if (sections.includes(null) || new Set(sections.map(s => s.id)).size !== sections.length || sections.length > KIND_FILES[kind].length) return null;
    const out = { version: 1, lang: 'python', kind, name: typeof p.name === 'string' && p.name.trim() ? p.name.slice(0, 80) : 'my-program', sections, active: sections.some(s => s.id === p.active) ? p.active : sections[sections.length - 1].id };
    if (typeof p.board === 'string' && BOARD_ID.test(p.board)) out.board = p.board;
    // its pictures: names and sizes here; the pictures themselves are kept by content (see Images)
    if (Array.isArray(p.images)) {
      out.images = p.images.slice(0, 60).filter(im => im && typeof im.name === 'string' && IMAGE_NAME.test(im.name) && typeof im.key === 'string' && /^[0-9a-f]{16,64}$/.test(im.key))
        .map(im => ({ name: im.name, type: IMAGE_TYPES[im.name.split('.').pop().toLowerCase()], key: im.key, w: Math.max(0, +im.w || 0), h: Math.max(0, +im.h || 0), size: Math.max(0, +im.size || 0) }));
    }
    // the project builder's map: steps in order, each a name, a depth and plain-language notes
    if (p.plan && typeof p.plan === 'object' && Array.isArray(p.plan.steps)) {
      const str = (v, n = 3000) => (typeof v === 'string' ? v.slice(0, n) : '');
      out.plan = {
        title: str(p.plan.title, 120),
        path: Array.isArray(p.plan.path) ? p.plan.path.slice(0, 8).map(x => str(x, 80)) : [],
        steps: p.plan.steps.slice(0, 60).filter(s => s && /^[\w-]{1,40}$/.test(s.id) && Number.isInteger(s.n)).map(s => ({
          id: s.id, n: s.n, name: str(s.name, 120), depth: ['walk', 'hallway', 'horizon'].includes(s.depth) ? s.depth : 'horizon',
          summary: str(s.summary), usual: str(s.usual), learn: str(s.learn),
        })),
      };
    }
    return out;
  }

  const PROJECT_KEY = 'intuicode.project.v1';
  const PREVIOUS_KEY = 'intuicode.previous.v1';
  function loadProject() {
    return checkedProject(store.get(PROJECT_KEY, null)) || projectFromBlueprint(BP.parse(BP.BUILT_IN[0]), {});
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
  let mode = 'write';
  // Which side you're working in: the sentences ('say') or the code ('code', at line codeIdx of the code).
  // The explain strip, the tutor and Ctrl+H all follow it.
  let pane = 'say', codeIdx = -1;

  const activeSec = () => project.sections.find(s => s.id === project.active) || project.sections[project.sections.length - 1];

  /* Swap in another project. In the desktop app it is linked to `folder` (null: not saved anywhere
   * yet), so autosave can never write one project's files into another project's folder. */
  function replaceProject(next, message, folder = null) {
    activeSec().text = ta.value;
    if (desk.on) {
      if (desk.folder && desk.dirty) saveProject('quiet');   // finish saving the old project to its own folder
      clearTimeout(desk.saveTimer);
      desk.folder = folder;
      desk.dirty = !folder;
    }
    store.set(PREVIOUS_KEY, project);
    project = next;
    runtimeMark = null;
    ta.value = activeSec().text;
    Runner.reset();
    setMode('write');
    openSection(project.active);
    $('work').classList.toggle('web', project.kind === 'website');
    showBottom(project.kind === 'website' ? 'preview' : 'terminal');
    updateChip();
    if (project.kind === 'website') runWebsite(false);
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
  /* Compile + render (Write mode)                                       */
  /* ------------------------------------------------------------------ */

  function compile() {
    try { compiled = project.kind === 'website' ? WEB.compileWebsite(project) : isCpp() ? CPP.compileCppProject(project) : LANG.compileProject(project); }
    catch (e) { console.error(e); }
  }
  const secResult = (id) => compiled && compiled.results[id];
  const caretLine = () => ta.value.slice(0, ta.selectionStart).split('\n').length - 1;

  const STARTER = /^(if (?:it|that|this|anything|something) fails(?: with)?|if nothing failed|in any case|if this file is run directly|fail with|fail again|check that|open the file|async using|using|define class|define async|make a new|field|decorate with|use the shared|delete|try|otherwise if|else if|otherwise|else|if|when|repeat until|repeat while|repeat forever|repeat|keep going|while|as long as|count down|count|for each|for every|for|define|give back|return|show|print|say|display|ask for an? (?:whole number|number|decimal)|ask for|ask|set|make|let|change|update|create (?:an? )?(?:empty )?(?:list|dictionary)|create|increase|decrease|multiply|divide|add|remove|subtract|sort|reverse|shuffle|wait|run|call|stop the loop|stop the program|skip to next|do nothing|use|remember|forever)(?=\s|$)/i;
  const OPS = new Set(['is', 'not', 'and', 'or', 'than', 'plus', 'minus', 'times', 'divided', 'mod', 'equal', 'contains', 'squared', 'more', 'less', 'greater', 'least', 'most', 'at', 'even', 'odd', 'bigger', 'smaller', 'yes', 'no', 'nothing']);
  const CONN = new Set(['to', 'by', 'with', 'using', 'from', 'in', 'of', 'store', 'into', 'as', 'item', 'first', 'last', 'length', 'random', 'number', 'text', 'decimal', 'each', 'the', 'counting', 'down', 'sum', 'biggest', 'smallest', 'rounded', 'result', 'it', 'places', 'seconds']);
  const NO_NAMES = { all: new Set(), fn: new Set() };
  const FILLER = new Set(LANG.FILLER.words);
  const STEP_WORDS = new Set(LANG.FILLER.steps);

  function hlLine(line, mark, names) {
    names = names || NO_NAMES;
    if (/^\s*(?:note\s*:|comment\s*:|#)/i.test(line)) return `<span class="s-com">${escHtml(line)}</span>`;
    const m = line.match(/^(\s*)((?:raw python|python|raw)\s*:)(.*)$/i);
    let body;
    if (m) body = escHtml(m[1]) + `<span class="s-kw">${escHtml(m[2])}</span><span class="s-raw">${hlPy(m[3])}</span>`;
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
    const marks = lineMarks(sec);
    const names = nameSets();
    hl.innerHTML = lines.map((l, i) => hlLine(l, marks[i], names)).join('\n') + '\n ';
    const cur = caretLine();
    gutterInner.innerHTML = lines.map((_, i) => `<div class="gl${i === cur ? ' cur' : ''}${marks[i] ? ' ' + marks[i] : ''}">${i + 1}</div>`).join('');
    syncScroll();
  }

  function syncScroll() {
    hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft;
    gutterInner.style.transform = `translateY(${-ta.scrollTop}px)`;
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

  function renderPython() {
    const sec = activeSec();
    const r = secResult(sec.id);
    $('pyFile').textContent = fileName(sec);
    $('codeTitle').textContent = sec.file === 'sketch' ? 'Arduino C++' : LANG_NAME[secLang(sec)];
    $('codeSub').textContent = `Generated from your sentences. Read it here, change it there.`;
    if (!r) { pycode.innerHTML = ''; return; }
    pycode.innerHTML = r.lines.map((o, i) => {
      const hasNote = o.note || (o.src >= 0 && r.info[o.src] && r.info[o.src].notes.length);
      return `<div class="pl${o.src < 0 ? ' hdr' : ''}${hasNote ? ' note' : ''}" data-i="${i}" data-src="${o.src}"><span class="ln">${i + 1}</span><span class="pc">${hlCode(secLang(sec), o.text) || ' '}</span></div>`;
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
    if (pane === 'code' && mode === 'write' && codeIdx >= 0) return renderExplainCode();
    const sec = activeSec();
    const r = secResult(sec.id);
    const li = caretLine();
    const text = ta.value.split('\n')[li] || '';
    const box = $('explain');
    if (!r || !text.trim()) {
      box.innerHTML = `${planBanner(li)}<p class="ex-guide">${withCode(packFor(sec).guide.section || '')}</p>
        <div class="ex-hint"><span>Start from an idea: open the <b>Library</b>.</span><span><kbd>Tab</kbd> jumps to the next ‹blank›</span><span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs the program</span><span><kbd>Ctrl</kbd>+<kbd>H</kbd> explains the words in a line or a selection</span><span>Click a line of ${escHtml(tutorSays(sec))} on the right to learn about the code itself.</span></div>`;
      return;
    }
    const inf = r.info[li] || { py: [], notes: [], warns: [], errs: [] };
    const py = inf.py.map(i => r.lines[i].text).filter(t => t.trim()).join('\n');
    const items = [], fill = fillHtml(text);
    if (runtimeMark && runtimeMark.sec === sec.id && runtimeMark.line === li) items.push(`<li class="err">${withCode(runtimeMark.msg)}</li>`);
    if (li === typingLine && inf.errs.length) items.push('<li>Keep typing, or pick a suggestion. Problems on this line show once you move to another line.</li>');
    else inf.errs.forEach(e => { if (!(fill && /^Fill in the ‹[^›]*› slot\.$/.test(e))) items.push(`<li class="err">${withCode(e)}</li>`); });
    inf.warns.forEach(w => items.push(`<li class="warn">${withCode(w)}</li>`));
    const pyLines = inf.py.filter(i => r.lines[i].text.trim());
    const why = inf.notes.length && pyLines.length ? `<button type="button" class="linklike ex-why" data-pick="${pyLines[0]}">${inf.notes.length === 1 ? 'A note' : inf.notes.length + ' notes'} on the ${escHtml(tutorSays(sec))}: click its line on the right</button>` : '';
    box.innerHTML = `${planBanner(li)}${fill}<div class="ex-map">
        <div class="ex-cell"><span class="ex-lbl">You wrote · line ${li + 1}</span><div class="ex-say">${escHtml(text.trim())}</div></div>
        <div class="ex-arrow" aria-hidden="true">→</div>
        <div class="ex-cell"><span class="ex-lbl">${escHtml(tutorSays(sec))} · ${escHtml(fileName(sec))} ${pyLines.length ? 'line ' + pyLines.map(i => i + 1).join(', ') : ''}</span><div class="ex-py">${hlCode(secLang(sec), py.split('\n').map(l => l.trimStart()).join('\n'))}</div></div>
      </div>
      ${shapeHtml(sec, text)}
      ${items.length ? `<ul class="ex-notes">${items.join('')}</ul>` : ''}${sayTutorHtml(sec, li)}
      <p class="ex-foot">${why}<span><kbd>Ctrl</kbd>+<kbd>H</kbd> the words here, explained</span></p>`;
  }

  /* ‹Blanks›: what goes in one, from its step's "blank:" line in the library (your own kits' too): what
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
    inf.warns.forEach(w => items.push(`<li class="warn">${withCode(w)}</li>`));
    const notes = (o.note ? [o.note] : []).concat(inf.notes);
    $('explain').innerHTML = `${src >= 0 ? planBanner(src) : ''}<div class="ex-map">
        <div class="ex-cell"><span class="ex-lbl">${escHtml(tutorSays(sec))} · ${escHtml(fileName(sec))} line ${codeIdx + 1}</span><div class="ex-py">${hlCode(lang, o.text.trim()) || '<span class="dim">(an empty line)</span>'}</div></div>
        <div class="ex-arrow" aria-hidden="true">←</div>
        <div class="ex-cell"><span class="ex-lbl">${src >= 0 ? `From your sentence · <button type="button" class="linklike" data-go-say="${src}">line ${src + 1}</button>` : 'Added for you'}</span><div class="ex-say">${src >= 0 ? escHtml(sentence) : '<span class="dim">IntuCode adds this so the program is complete: it has no sentence of its own.</span>'}</div></div>
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
   * get their words sorted into what IntuCode knows and what you named. */
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
    return `<div class="ex-shape"><span class="ex-lbl">How it's said</span><div class="ex-shape-row ex-roles">${roles.known.length ? `<span>Words IntuCode knows: ${list(roles.known)}</span>` : ''}${roles.names.length ? `<span>Your names: ${list(roles.names)}</span>` : ''}${roles.values.length ? `<span>Values: ${list(roles.values)}</span>` : ''}</div></div>`;
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

  function renderTree() {
    $('treeRoot').innerHTML = `${FOLDER_SVG}${escHtml(project.name)}/`;
    $('tree').innerHTML = project.sections.map(s => {
      const meta = SECTION_META[s.file];
      const errs = issues(s, 'errs', true), warns = issues(s, 'warns', true);
      const badge = errs ? `<span class="ti-badge" title="${errs} problem${errs > 1 ? 's' : ''}">${errs}</span>` : warns ? `<span class="ti-badge warn" title="${warns} warning${warns > 1 ? 's' : ''}">${warns}</span>` : '';
      return `<button type="button" class="tree-item${s.id === project.active ? ' active' : ''}" data-id="${escHtml(s.id)}" title="${escHtml(meta.purpose)}">${iconSvg(meta.icon)}<span class="ti-title">${meta.title}</span>${badge}<span class="ti-file">${escHtml(fileName(s))}</span></button>`;
    }).join('');
  }

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
      ? items.slice(0, 60).map(p => `<li class="${p.kind}"><button type="button" data-sec="${escHtml(p.s.id)}" data-line="${p.i}"><span class="dot"></span><span><span class="where">${SECTION_META[p.s.file].title} · line ${p.i + 1}</span>${withCode(blankSaid(p.msg))}</span></button></li>`).join('')
      : '<li class="none">No problems. Press Run to try it.</li>';
    return errCount;
  }

  function renderSectionHeader() {
    const meta = SECTION_META[activeSec().file];
    $('secTitle').textContent = meta.title;
    $('secPurpose').textContent = meta.purpose;
  }

  let compileTimer = null;
  function scheduleCompile() { clearTimeout(compileTimer); compileTimer = setTimeout(refreshAll, 140); }
  function refreshAll() {
    clearTimeout(compileTimer);
    compile();
    renderOverlay(); renderPython(); renderExplain(); renderTree(); renderPlan(); renderProblems();
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
    if (line != null) goToLine(line); else { ta.setSelectionRange(0, 0); ta.scrollTop = 0; syncScroll(); }
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
    if (typingLine >= 0 && cur !== typingLine) { typingLine = -1; renderOverlay(); renderTree(); renderProblems(); }
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

  let acItems = [], acIndex = 0, acRange = null;
  function closeAc() { ac.hidden = true; acItems = []; }

  function updateAc() {
    const pos = ta.selectionStart;
    if (pos !== ta.selectionEnd) return closeAc();
    const b = lineBounds(pos);
    const before = b.text.slice(0, pos - b.start);
    let indent = before.match(/^\s*/)[0];
    const lead = before.slice(indent.length).match(LANG.FILLER.lead);
    if (lead) indent += lead[0];   // "please set…" still suggests "set ‹name› to ‹value›"
    const typed = before.slice(indent.length);
    if (!typed || /^(?:note|python|#)/i.test(typed)) return closeAc();
    const file = activeSec().file;
    const lower = typed.toLowerCase();
    let items = [];

    if (!/‹/.test(b.text)) {
      const pk = packFor(activeSec());
      items = pk.templates.filter(t => (!pk.webOnly || pk.filter(t)) && (() => {
        const lead = t.pattern.split('‹')[0].toLowerCase();
        return (lead.startsWith(lower) || (lower.startsWith(lead.trim()) && lower.length <= lead.length + 1 && lead.trim().length)) && t.pattern.toLowerCase() !== lower;
      })()).sort((a, b2) => (b2.sections.includes(file) - a.sections.includes(file))).slice(0, 7)
        .map(t => ({ kind: 'template', label: t.pattern, py: t.py, tag: t.group, t }));
      if (items.length) acRange = { from: b.start + indent.length, to: pos };
    }

    if (!items.length && /\s/.test(typed) && compiled) {
      const words = typed.split(/\s+/);
      for (let k = Math.min(3, words.length - 1); k >= 1 && !items.length; k--) {
        const tail = words.slice(-k).join(' ').toLowerCase();
        if (!tail || /["'‹]/.test(tail)) continue;
        const seen = new Set();
        for (const s of compiled.syms.values()) {
          if (s.kind === 'module' || seen.has(s.display)) continue;
          if (s.display.startsWith(tail) && s.display !== tail) {
            seen.add(s.display);
            items.push({ kind: 'name', label: s.display, py: s.kind === 'function' ? `${s.py}(${(s.params || []).join(', ')})` : s.py, tag: { number: 'number', text: 'text', list: 'list', dict: 'dictionary', function: 'tool', yesno: 'yes/no' }[s.kind] || 'name' });
          }
        }
        if (items.length) acRange = { from: pos - words.slice(-k).join(' ').length, to: pos };
      }
      items = items.slice(0, 7);
    }

    if (!items.length) return closeAc();
    acItems = items; acIndex = 0;
    ac.innerHTML = items.map((it, i) => `<div class="ac-item${i === 0 ? ' on' : ''}" role="option" data-i="${i}"><span class="ac-say">${escHtml(it.label).replace(/‹([^›]*)›/g, '<span class="s-slot">‹$1›</span>')}</span><span class="ac-kind">${escHtml(it.tag)}</span><span class="ac-py">${escHtml(it.py)}</span></div>`).join('')
      + '<div class="ac-foot"><kbd>Tab</kbd> or <kbd>Enter</kbd> to use · <kbd>↑</kbd><kbd>↓</kbd> to choose · <kbd>Esc</kbd> to close</div>';
    ac.hidden = false;
    const line = caretLine();
    const top = PAD_T + (line + 1) * LH - ta.scrollTop + 4;
    const left = Math.max(8, Math.min(PAD_L + before.length * CW - ta.scrollLeft - 12, codewrap.clientWidth - ac.offsetWidth - 8));
    const flip = top + ac.offsetHeight > codewrap.clientHeight - 8 && top - LH - ac.offsetHeight - 8 > 0;
    ac.style.top = (flip ? top - LH - ac.offsetHeight - 8 : top) + 'px';
    ac.style.left = left + 'px';
  }

  function moveAc(d) {
    acIndex = (acIndex + d + acItems.length) % acItems.length;
    [...ac.querySelectorAll('.ac-item')].forEach((el, i) => el.classList.toggle('on', i === acIndex));
    ac.querySelectorAll('.ac-item')[acIndex].scrollIntoView({ block: 'nearest' });
  }

  function acceptAc(i = acIndex) {
    const it = acItems[i];
    if (!it) return;
    closeAc();
    insertText(it.label, acRange.from, acRange.to);
    if (it.kind === 'template') {
      const b = lineBounds(acRange.from);
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
    ensureCaretVisible();
    renderOverlay();
    scheduleCompile();
    save();
  }

  ta.addEventListener('input', () => { onEdit(); updateAc(); });
  ta.addEventListener('scroll', () => { closeDdMenu(); syncScroll(); if (!ac.hidden) updateAc(); placeTip(); });
  ta.addEventListener('click', () => { closeAc(); afterCaretMove(true); });
  ta.addEventListener('keyup', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key) && ac.hidden) afterCaretMove(true);
  });
  ta.addEventListener('blur', () => setTimeout(closeAc, 150));

  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); return; }
    if (e.altKey && e.key === 'ArrowDown' && ddOn()) { if (openDdAtCaret()) { e.preventDefault(); return; } }
    if (!ac.hidden) {
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
    if (document.activeElement === ta) afterCaretMove(false);
    if (mode === 'read') updateSummariseButton();
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

  $('tree').addEventListener('click', (e) => { const b = e.target.closest('.tree-item'); if (b) openSection(b.dataset.id); });
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
  $('btnCopy').addEventListener('click', () => { const r = secResult(activeSec().id); if (r) copyText(r.text, $('btnCopy'), 'Copy'); });

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
  const TOUR_LANGS = new Set(['python', 'cpp']);   // Read mode's Style tour
  const RAW_LINE = { python: /^\s*(?:raw python|python|raw|note|comment)\s*:|^\s*#/i, cpp: /^\s*(?:c\+\+|cpp|raw|above main|outside main|at the top|note|comment)\s*:|^\s*include\b/i };

  function loadTutorReader(lang = 'python') {
    if (lang === 'cpp') {
      if (tutorRun.cpp || tutorRun.cppLoading) return;
      tutorRun.cppLoading = Runner.webReader((s) => setStatus(s))
        .then(WR => WR.loadLangs(['cpp']).then(() => { tutorRun.cpp = WR.parse; renderExplain(); tutorSoon(300); }))
        .catch(() => { /* the reader couldn't load: Read mode says so */ })
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
    try { other = project.kind === 'website' ? WEB.compileWebsite(copy) : isCpp() ? CPP.compileCppProject(copy) : LANG.compileProject(copy); } catch (e) { return { same: false, error: 'IntuCode couldn\'t read that sentence.' }; }
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
    if ((b = t('[data-plan]'))) return openStep(+b.dataset.plan);
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
    if (!tutor.on || mode !== 'write' || !tip.hidden || document.querySelector('.modal:not([hidden])') || !$('gloss').hidden) return;
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
    ws.classList.remove('max-say', 'max-code', 'max-term');
    if (maxed) ws.classList.add('max-' + maxed);
    document.querySelectorAll('.max-btn').forEach(b => {
      const on = b.dataset.max === maxed;
      b.setAttribute('aria-pressed', String(on));
      b.title = (on ? 'Back to all the windows' : 'Full screen: ' + b.getAttribute('aria-label').replace(/^Full screen: /, '')) + ' (Esc)';
    });
    measure(); syncScroll(); placeTip();
    if (maxed === 'term') termIn.focus(); else if (maxed === 'say') ta.focus(); else if (maxed === 'code') pycode.focus();
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('.max-btn'); if (b) setMax(b.dataset.max); });

  /* ------------------------------------------------------------------ */
  /* Room to work: the help strip and the terminal fold away, and the    */
  /* terminal's height can be dragged. Remembered for next time.         */
  /* ------------------------------------------------------------------ */

  const LAYOUT_KEY = 'intuicode.layout.v1';
  const layout = Object.assign({ help: true, term: true, termRow: 0, webRow: 0, dd: false }, store.get(LAYOUT_KEY, {}));
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
    for (const [key, prop] of [['termRow', '--term-row'], ['webRow', '--web-row']]) {
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
  const rowKey = () => ($('work').classList.contains('web') ? 'webRow' : 'termRow');
  function setTermHeight(h) {
    const r = $('work').getBoundingClientRect(), key = rowKey();
    layout[key] = Math.round(Math.min(Math.max(h, 90), Math.max(r.height - 170, 90)));
    $('work').style.setProperty(key === 'webRow' ? '--web-row' : '--term-row', layout[key] + 'px');
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
  const ddOn = () => !!(layout.dd && VALUES && mode === 'write');
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
    b.addEventListener('click', () => { setMode('write'); openSection(sec, line); });
    termLog.appendChild(b); tWrite('\n');
  }
  /* A problem found while running: a link to its sentence, which is also marked in the editor
   * (`keepFirst`: only if nothing is marked yet, for a list of compiler errors). */
  function pointAt(secId, line, msg, keepFirst) {
    const sec = project.sections.find(s => s.id === secId);
    if (!sec) return;
    if (!keepFirst || !runtimeMark) runtimeMark = { sec: secId, line, msg };
    tLink(`  Go to ${SECTION_META[sec.file].title}, line ${line + 1}: ${(sec.text.split('\n')[line] || '').trim()}`, secId, line);
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
    const sec = project.sections.find(s => s.file + '.py' === file);
    if (!sec || !pyLine) return null;
    const o = secResult(sec.id) && secResult(sec.id).lines[pyLine - 1];
    if (!o) return { sec: sec.id, line: null };
    return { sec: sec.id, line: o.src >= 0 ? o.src : null };
  }

  async function run() {
    setDock('term', true);   // Run shows what happens, even when the terminal was folded away
    if (mode === 'read') { tLine('Run works on the program in Write mode. Use "Open as sentences" to bring imported code there.', 't-sys'); return; }
    if (project.kind === 'website') return runWebsite(true);
    if (isCpp()) {
      typingLine = -1; activeSec().text = ta.value; refreshAll();
      if (renderProblems()) { tLine('Can\'t run yet: fix the problems first (see Problems on the left).', 't-err'); return; }
      if (project.kind === 'arduino') {
        if (desk.on && desk.arduino) return runDesktopArduino();
        tLine(desk.on
          ? (desk.linux
            ? 'To check a sketch and put it on a board, IntuCode uses arduino-cli, which wasn\'t found. Install arduino-cli itself (its install script puts it in ~/bin), or unpack the Arduino IDE 2 .zip into your home folder (the IDE\'s AppImage keeps its arduino-cli inside, out of reach), then restart IntuCode. Until then, copy the code on the right into the Arduino IDE.'
            : 'To check a sketch and put it on a board, IntuCode uses arduino-cli, which wasn\'t found. Install the Arduino IDE 2 (it includes arduino-cli) or arduino-cli itself, then restart IntuCode. Until then, copy the code on the right into the Arduino IDE.')
          : 'A sketch runs on an Arduino board, not in the browser. In the IntuCode desktop app (with the Arduino IDE or arduino-cli installed), Run checks the sketch and uploads it to a board plugged in by USB. Or copy the code on the right into the Arduino IDE.', 't-sys');
        return;
      }
      if (desk.on && desk.cpp) return runDesktopCpp();
      tLine(desk.on ? (desk.linux ? 'No C++ compiler was found on this computer. Install g++: type $ sudo apt install g++ (Ubuntu, Debian, Mint), $ sudo dnf install gcc-c++ (Fedora) or $ sudo pacman -S gcc (Arch). Then restart IntuCode.' : 'No C++ compiler was found on this computer. On Windows, install Visual Studio Build Tools (free, with "Desktop development with C++"); on a Mac, run xcode-select --install; on Linux, install g++. Then restart IntuCode.') : 'C++ has to be compiled into a program before it runs, and a browser has no C++ compiler. Use the IntuCode desktop app (on Windows it uses Visual Studio\'s compiler; elsewhere g++ or clang++), or copy main.cpp into your own C++ setup.', 't-sys');
      return;
    }
    typingLine = -1;
    activeSec().text = ta.value;
    refreshAll();
    closeAc();
    const errs = renderProblems();
    if (errs) {
      tLine(`Can't run yet: ${errs} problem${errs > 1 ? 's' : ''} to fix first.`, 't-err');
      for (const s of project.sections) {
        secResult(s.id).info.forEach((inf, i) => inf.errs.forEach(e => tLink(`${SECTION_META[s.file].title}, line ${i + 1}: ${e.replace(/`/g, '')}`, s.id, i)));
      }
      return;
    }
    if (desk.on && desk.python) return runDesktopPython();
    if (!(await ensurePython())) return;
    const files = {};
    for (const s of project.sections) files[s.file + '.py'] = secResult(s.id).text;
    Runner.writeFiles(files);
    tLine(`▶ Running ${project.name} (main.py${project.sections.length > 1 ? ' + ' + project.sections.filter(s => s.file !== 'main').map(s => s.file + '.py').join(', ') : ''})`, 't-sys');
    session = { answers: [], shown: 0, seed: Math.floor(Math.random() * 1e9), modules: project.sections.map(s => s.file) };
    step();
  }

  function step() {
    let r;
    try { r = Runner.run(session.answers, session.seed, session.modules); }
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
  })();`;

  let previewInfo = null, picking = false, previewTimer = null;
  function updateChip() {
    const chip = document.querySelector('.lang-chip');
    chip.textContent = mode === 'read' ? 'Reading' : project.kind === 'website' ? 'Website' : project.kind === 'cpp' ? 'C++' : project.kind === 'arduino' ? 'Arduino' : 'Python';
  }
  function showBottom(which) {
    const web = project.kind === 'website';
    $('tabPreview').hidden = !web;
    const showPreview = web && which === 'preview';
    $('previewWrap').hidden = !showPreview;
    $('termBody').hidden = showPreview;
    $('tabPreview').setAttribute('aria-selected', String(showPreview));
    $('tabTerm').setAttribute('aria-selected', String(!showPreview));
    $('btnPick').hidden = !showPreview;
    $('btnClear').hidden = showPreview;
  }
  function runWebsite(announce) {
    if (!compiled) compile();
    previewInfo = WEB.previewDocument(compiled, previewHelper());
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
  function schedulePreview() {
    if (project.kind !== 'website' || $('previewWrap').hidden) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => runWebsite(false), 600);
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
    if (d.type === 'log') tLine(`page: ${d.text}`, d.level === 'error' ? 't-err' : d.level === 'warn' ? 't-sys' : undefined);
    else if (d.type === 'error') {
      let where = '';
      const js = secResult('mechanics');
      if (d.line && previewInfo && js) {
        const o = js.lines[d.line - previewInfo.jsLine];
        if (o && o.src >= 0) where = o.src;
      }
      tLine(`✕ The page hit an error: ${d.text}`, 't-err');
      if (where !== '') pointAt(project.sections.find(s => s.file === 'mechanics').id, where, `The page hit an error: ${d.text}`);
    } else if (d.type === 'pick') {
      setPicking(false);
      const sec = activeSec();
      if (d.alt) { insertText(`${d.x}, ${d.y}`); tLine(`Picked the position ${d.x}, ${d.y}. (Exact positions can break on other screen sizes; "in a row" or a grid adapt better.)`, 't-sys'); return; }
      if (d.id && sec.file !== 'structure') { insertText(d.id); tLine(`Picked ${d.id}.`, 't-sys'); return; }
      if (d.line != null) {
        openSection('structure', d.line);
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
      return tLine(project.name + '/\n' + project.sections.map(s => `  ${fileName(s).padEnd(13)} ${SECTION_META[s.file].title}: ${SECTION_META[s.file].purpose}`).join('\n'), 't-help');
    }
    if (low === 'reset') { Runner.reset(); return tLine('Forgot all values from earlier runs.', 't-sys'); }
    if (low === 'board' || low.startsWith('board ')) return chooseBoard(cmd.slice(5).trim());
    if (!compiled) compile();
    if (project.kind === 'cpp') return tLine('In a C++ project, press Run to compile and run the program (desktop app).', 't-sys');
    if (project.kind === 'arduino') return tLine('In an Arduino project, press Run to check the sketch and upload it to a board (desktop app with arduino-cli). What the board shows appears here.', 't-sys');
    if (project.kind === 'website') return tLine('In a website project, the terminal shows messages from the page (from "show …" in Mechanics). Press Run to refresh the preview. Python sentences work in Python projects.', 't-sys');
    const tr = LANG.translateOne(cmd, compiled.syms);
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
    if (!BOARD_ID.test(fqbn)) return tLine(`"${name}" isn't a board name IntuCode knows. Use one of: ${names}, or arduino-cli's full name, like esp32:esp32:esp32-evb.`, 't-err');
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
    const file = activeSec().file;
    const PK = packFor(activeSec());
    const G = PK.guide;
    const match = (...parts) => !q || parts.join(' ').toLowerCase().includes(q);
    let html = '';
    $('indexTitle').textContent = mode === 'read' ? `${G.name} · reading code` : `${G.name} · ${SECTION_META[file].title}`;
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

  /* The Library: shelves by what you're making (the project builder's own questions), each holding the
   * builder's kits (a whole kind of project, planned step by step) and blueprints (a story with blanks). */
  const bpOn = (sel) => !!bpSel && bpSel.src === sel.src && (sel.src === 'kit' ? bpSel.id === sel.id : bpSel.i === sel.i);
  let bpPlatform = '';   // the Library's filter: '' (everything), or pc, phone, web, board
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
      + (bpPlatform ? '' : group(`Add to ${SECTION_META[activeSec().file].title}`, built.filter(x => x.bp.kind === 'snippet')))
      + `<div class="bp-group">Yours</div>`
      + myKitsOff.map(kitItem).join('')
      + (mine.length ? mine.map(item).join('') : myKitsOff.length ? '' : '<p class="bp-none">None yet. Edit a copy of any blueprint, or turn your current project into one.</p>')
      + `<div class="bp-mk"><button type="button" class="btn small" id="bpFromProject">Make one from this project</button><button type="button" class="btn small" id="bpPaste">Write or paste one</button></div>`;
    $('bpList').scrollTop = scroll;
  }

  /* A kit in the Library: its steps in build order, each with its depth, and a way into the builder. */
  function renderKitPage(box) {
    const lib = bldLibrary(), kit = lib.kits[bpSel.id];
    if (!kit) { box.innerHTML = '<p class="bp-none">This kit isn\'t in the library any more.</p>'; return; }
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
      const label = sec === 'here' ? `Goes into ${SECTION_META[activeSec().file].title} at the cursor` : `${SECTION_META[sec].title} · ${FILE_NAME[sec] || sec + '.py'}`;
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
    const where = 'Blueprint · ' + (isProject ? ({ structured: 'Settings, Tools and Main program', website: 'a website: Structure, Styling and Mechanics', cpp: 'C++, one Program file', arduino: 'Arduino, one Sketch for a board' }[bp.layout] || 'one Main program file') : `adds lines to ${SECTION_META[activeSec().file].title}`);
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
      else { insertSnippet(BP.fill(bp, bpValues).here); tLine(`Added "${bp.title}" to ${SECTION_META[activeSec().file].title}.`, 't-sys'); }
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
  /* Read mode: import a file or a whole project, sections, summaries    */
  /* ------------------------------------------------------------------ */

  const READ_KEY = 'intuicode.read.v2';
  let reads = store.get(READ_KEY, { files: [], active: -1 });  // active: index into pyFiles(), or -1 for the project overview
  let proj = null;         // the reader's analysis of the whole project
  let readFocus = null;    // {type:'section', id} | {type:'range', summary}
  const KIND_LABEL = { about: 'About', imports: 'Toolkits', settings: 'Settings', steps: 'Steps', tool: 'Tool', route: 'Web route', class: 'Class', start: 'Start',
    component: 'Component', handler: 'Event', head: 'Page info', part: 'Part', script: 'Script', style: 'Style', media: 'Screens' };
  const ROLE_ORDER = ['entry', 'settings', 'models', 'helpers', 'routes', 'script', 'package', 'tests'];
  const SKIP_DIRS = new Set(['venv', '.venv', 'env', '.env', 'node_modules', '__pycache__', '.git', 'site-packages', 'build', 'dist', '.tox', '.mypy_cache', '.pytest_cache', '.idea', '.vscode']);
  const EXTRA_FILE = /(^|\/)(readme(\.\w+)?|requirements[\w.-]*\.txt|pyproject\.toml|pipfile|package\.json)$/i;
  const CODE_FILE = /\.(py|jsx?|mjs|cjs|tsx?|html?|css|cpp|cc|cxx|hpp|hh|h|ino)$/i;
  const langOfPath = (p) => /\.py$/i.test(p) ? 'python' : (window.IntuiWebReader.kindOfPath(p) || 'python');

  function saveReads() {
    try { localStorage.setItem(READ_KEY, JSON.stringify(reads)); }
    catch (_) { tLine('This project is too big to remember after a reload, but you can read it now.', 't-sys'); }
  }

  function setMode(next) {
    mode = next;
    hideTip();
    $('modeWrite').setAttribute('aria-selected', String(next === 'write'));
    $('modeRead').setAttribute('aria-selected', String(next === 'read'));
    $('writeView').hidden = next !== 'write';
    $('explainWrap').hidden = next !== 'write';
    $('writeSide').hidden = next !== 'write';
    $('readView').hidden = next !== 'read';
    $('readSide').hidden = next !== 'read';
    renderImages();
    $('work').classList.toggle('reading', next === 'read');
    $('work').classList.toggle('web', next === 'write' && project.kind === 'website');
    showBottom(next === 'write' && project.kind === 'website' ? 'preview' : 'terminal');
    $('tabPreview').hidden = !(next === 'write' && project.kind === 'website');
    updateChip();
    if (next === 'read') renderRead();
    else { measure(); syncScroll(); }
    if (!$('index').hidden) renderIndex();
  }
  $('modeWrite').addEventListener('click', () => setMode('write'));
  $('modeRead').addEventListener('click', () => setMode('read'));

  const pyFiles = () => reads.files.filter(f => CODE_FILE.test(f.name));   // every file that can be read
  const curFile = () => (reads.active >= 0 ? pyFiles()[reads.active] : null);
  const fileInfo = (path) => proj && proj.files.find(x => x.path === path);
  const curAnalysis = () => { const f = curFile(); const i = f && fileInfo(f.name); return i ? i.analysis : null; };
  const shortPath = (p) => (proj && proj.name && p.startsWith(proj.name + '/') ? p.slice(proj.name.length + 1) : p);

  /* [[path]] and [[path#name]] in reader text become links to that file. The text is already
   * escaped HTML, so the path is turned back into plain text before being escaped once for the link. */
  const unescHtml = (s) => s.replace(/&(amp|lt|gt|quot);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"' }[e]));
  function linkify(html) {
    return html.replace(/\[\[([^\]#]+)(?:#([^\]]+))?\]\]/g, (m, escPath, escName) => {
      const path = unescHtml(escPath), name = escName && unescHtml(escName);
      const label = name ? `<code>${escHtml(name)}</code> <span class="dim">(${escHtml(shortPath(path))})</span>` : `<code>${escHtml(shortPath(path))}</code>`;
      return `<button type="button" class="linklike" data-file="${escHtml(path)}"${name ? ` data-name="${escHtml(name)}"` : ''}>${label}</button>`;
    });
  }
  const rich = (s) => linkify(withCode(s));

  async function analyse() {
    if (!reads.files.length) { proj = null; return; }
    $('rdSum').innerHTML = '<p class="sum-empty">Reading the code… (the first time, this loads Python into the page)</p>';
    const pySide = reads.files.filter(f => !CODE_FILE.test(f.name) || /\.py$/i.test(f.name));
    const webSide = reads.files.filter(f => CODE_FILE.test(f.name) && !/\.py$/i.test(f.name));
    let py = null, web = null;
    try {
      if (pySide.some(f => /\.py$/i.test(f.name))) {
        if (!(await ensurePython())) { $('rdSum').innerHTML = '<p class="sum-empty">Python couldn\'t start, so the Python files can\'t be read here.</p>'; return; }
        const R = await Runner.reader((s) => setStatus(s));
        py = R.analyzeProject(pySide);
      }
      if (webSide.length) {
        const WR = await Runner.webReader((s) => setStatus(s));
        await WR.loadLangs([...new Set(webSide.map(f => WR.kindOfPath(f.name)).filter(Boolean))]);
        web = WR.analyzeProject(webSide, py);
        setStatus(Runner.ready ? $('pyStatus').textContent.replace(/^Loading.*/, 'Readers ready') : 'Web reader ready', 'ready');
      }
      proj = mergeProjects(py, web);
    } catch (e) {
      proj = null;
      $('rdSum').innerHTML = `<p class="sum-empty">The reader hit a problem: ${escHtml(e.message)}</p>`;
    }
  }

  /* One project view from the Python reader and the web reader. */
  function mergeProjects(py, web) {
    if (!web) return py;
    const files = (py ? py.files : []).concat(web.files);
    const seen = new Set();
    const edges = (py ? py.edges : []).concat(web.edges).filter(([a, b]) => { const k = a + '>' + b; if (seen.has(k) || a === b) return false; seen.add(k); return true; });
    for (const f of files) f.imports = [...new Set(f.imports)];
    for (const f of files) f.imported_by = [];
    for (const [a, b] of edges) { const t = files.find(x => x.path === b); if (t && !t.imported_by.includes(a)) t.imported_by.push(a); }
    // Python routes learn who calls them
    for (const [key, from] of Object.entries(web.calledBy || {})) {
      const [path, name] = key.split('#');
      const f = files.find(x => x.path === path);
      const sec = f && f.analysis.sections.find(x => x.name === name);
      if (sec) sec.facts.splice(1, 0, 'Called from the front end: ' + from.map(p => `[[${p}]]`).join(', ') + '.');
    }
    const pages = web.files.filter(f => f.role === 'page').sort((a, b) => (/index\.html?$/.test(b.path) - /index\.html?$/.test(a.path)) || a.path.length - b.path.length);
    let entries = py && py.entries.length ? py.entries.slice() : [];
    if (pages.length) entries.push(pages[0].path);
    for (const f of web.files) if ((f.role === 'entry' || f.role === 'sketch') && !entries.includes(f.path)) entries.push(f.path);
    if (!entries.length) { const f = web.files.find(x => /server|routes|components|script/.test(x.role)); if (f) entries = [f.path]; }
    const order = [], queue = [...entries], done = new Set();
    while (queue.length) { const p = queue.shift(); if (done.has(p)) continue; done.add(p); order.push(p); edges.filter(e => e[0] === p).forEach(e => queue.push(e[1])); }
    const ROLE_SORT = ['entry', 'sketch', 'page', 'server', 'routes', 'components', 'script', 'styles', 'settings', 'models', 'helpers', 'package', 'tests'];
    files.filter(f => !done.has(f.path)).sort((a, b) => ROLE_SORT.indexOf(a.role) - ROLE_SORT.indexOf(b.role) || a.path.localeCompare(b.path)).forEach(f => order.push(f.path));
    const count = (r) => web.files.filter(f => f.role === r).length;
    const scripts = web.files.filter(f => /script|components|helpers|settings/.test(f.role) && f.lang !== 'css' && f.lang !== 'html').length;
    const linked = web.fetches.filter(f => f.route).length;
    const name = py ? py.name : (() => { const firsts = new Set(files.map(f => f.path.split('/')[0])); return firsts.size === 1 && files.every(f => f.path.includes('/')) ? [...firsts][0] : 'this project'; })();
    const guess = web.files.some(f => f.role === 'sketch') ? 'an Arduino project' : web.files.some(f => f.lang === 'cpp') && !pages.length ? 'a C++ program' : web.files.some(f => f.role === 'components') ? 'a React app' : pages.length && (py || web.hasServer) ? 'a website with its own server' : pages.length ? 'a website' : web.hasServer ? 'a JavaScript web server' : 'a JavaScript project';
    let overview = py ? py.overview + ` It also has a front end: ${count('page')} web page${count('page') === 1 ? '' : 's'}, ${count('styles')} style file${count('styles') === 1 ? '' : 's'} and ${scripts} script${scripts === 1 ? '' : 's'}.`
      : `${name} looks like ${guess}. It has ${files.length} file${files.length === 1 ? '' : 's'}.` + (entries[0] ? ` Start reading at [[${entries[0]}]].` : '');
    if (linked) overview += ` The front end talks to the back end through ${linked} request${linked === 1 ? '' : 's'}, each linked to the route that answers it.`;
    const warnings = (py ? py.warnings : []).filter(w => !/There are no tests/.test(w) || !web.files.some(f => f.role === 'tests'));
    for (const ft of web.fetches) if (!ft.route && !ft.dynamic && web.hasServer) warnings.push(`[[${ft.from}]] asks the server for ${ft.method} ${'`' + ft.url + '`'}, but no route in this project answers it.`);
    const libs = (py ? py.libs : []).slice();
    for (const f of web.files) for (const l of f.libs || []) { let e = libs.find(x => x.name === l); if (!e) libs.push(e = { name: l, what: '', files: [], stdlib: false }); e.files.push(f.path); }
    const readmeFile = reads.files.find(f => /(^|\/)readme(\.\w+)?$/i.test(f.name));
    const readme = py && py.readme ? py.readme : readmeFile ? (readmeFile.source.split(/\n\s*\n/).map(p => p.trim()).find(p => p && !/^(#|!\[|<|```)/.test(p)) || '').replace(/[`*_]/g, '').slice(0, 300) : '';
    return { ok: true, name, overview, readme, entries, order, files, edges, libs, warnings, secrets: py ? py.secrets : [] };
  }

  function readTreeHtml() {
    const files = pyFiles();
    if (!files.length) return '<p class="side-note">Nothing imported yet.</p>';
    const multi = files.length > 1;
    let html = multi ? `<button type="button" class="tree-item${reads.active === -1 ? ' active' : ''}" data-i="-1">${FOLDER_SVG.replace('<svg', '<svg class="ti-icon"')}<span class="ti-title">Project overview</span><span class="ti-file">${escHtml(proj ? proj.name : 'project')}</span></button>` : '';
    let lastDir = null;
    const sorted = files.map((f, i) => ({ f, i, p: shortPath(f.name) })).sort((a, b) => a.p.split('/').length - b.p.split('/').length || a.p.localeCompare(b.p));
    for (const { f, i, p } of sorted) {
      const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '';
      if (dir !== lastDir && dir) html += `<div class="tree-dir">${escHtml(dir)}</div>`;
      lastDir = dir;
      const info = fileInfo(f.name);
      const role = info ? info.role : '';
      html += `<button type="button" class="tree-item file${i === reads.active ? ' active' : ''}${role === 'package' ? ' faint' : ''}${dir ? ' nested' : ''}" data-i="${i}"><span class="ti-title">${escHtml(p.split('/').pop())}</span>${info ? `<span class="role r-${role}">${escHtml(info.role_label)}</span>` : ''}</button>`;
    }
    const extras = reads.files.filter(f => !CODE_FILE.test(f.name));
    if (extras.length) html += `<div class="tree-dir">Also found</div>` + extras.map(f => `<div class="tree-extra">${escHtml(shortPath(f.name))}</div>`).join('');
    return html;
  }

  function renderRead() {
    const files = pyFiles();
    if (reads.active >= files.length) reads.active = files.length > 1 ? -1 : 0;
    if (files.length === 1 && reads.active === -1) reads.active = 0;
    $('rdFiles').innerHTML = readTreeHtml();
    const file = curFile();
    const a = curAnalysis();
    const overview = files.length > 1 && reads.active === -1;
    $('rdProject').hidden = !overview;
    $('rdBody').hidden = overview;
    $('rdOutlineWrap').hidden = !file;
    $('btnSummarise').disabled = !a || !a.ok;
    $('btnToSentences').disabled = !a || !a.ok;
    $('btnTour').disabled = !a || !file || !TOUR_LANGS.has(langOfPath(file.name)) || (langOfPath(file.name) === 'python' && !a.ok);
    if (!files.length) {
      $('rdName').textContent = 'No code imported yet';
      $('rdOverview').textContent = 'Import Python, such as a project an AI wrote for you, to see it split into sections and explained in plain English.';
      $('rdProject').hidden = true; $('rdBody').hidden = false;
      $('rdCode').innerHTML = '';
      $('rdSum').innerHTML = `<div class="sum-empty"><p>Nothing to read yet.</p><div class="bp-actions"><button type="button" class="btn primary" id="rdImport">Import code</button><button type="button" class="btn" id="rdExample">Try the example project</button></div></div>`;
      return;
    }
    if (overview) return renderProject();
    const info = fileInfo(file.name);
    $('rdName').textContent = shortPath(file.name);
    const fileLinks = (paths) => paths.map(p => `[[${escHtml(p)}]]`).join(', ');
    const links = info && (info.imported_by.length || info.imports.length) ? linkify(`<span class="rd-links">${info.imports.length ? ' Uses ' + fileLinks(info.imports) + '.' : ''}${info.imported_by.length ? ' Used by ' + fileLinks(info.imported_by) + '.' : ''}</span>`) : '';
    $('rdOverview').innerHTML = a ? (a.ok ? rich(a.overview) + links : `<span class="bad-text">This file can't be read as Python. ${escHtml(a.error)}</span>`) : 'Reading…';
    const secs = a && (a.ok || (a.sections && a.sections.length)) ? a.sections : [];
    const fileLang = langOfPath(file.name);
    const canSay = /^(python|html|css|js|cpp)$/.test(fileLang) && !/\.(h|hh|hpp|jsx|tsx?)$/i.test(file.name);
    $('btnToSentences').disabled = !a || !a.ok || !canSay;
    $('btnToSentences').title = canSay ? (fileLang === 'python' ? '' : 'Turn this file (and, for a web page, its own styles and script) into sentences in Write mode, checked against the original.') : /\.(h|hh|hpp)$/i.test(file.name) ? 'Header files describe code that lives in another file: open the .cpp file instead.' : 'TypeScript and React files can\'t be opened as sentences yet.';
    const startOf = new Map(secs.map(s => [s.start, s]));
    const secOfLine = (ln) => secs.find(s => ln >= s.start && ln <= s.end);
    $('rdCode').innerHTML = file.source.split('\n').map((l, i) => {
      const ln = i + 1;
      const s = secOfLine(ln);
      const head = startOf.get(ln);
      const label = head ? `<div class="rl-sec" data-sec="${head.id}"><span class="chip k-${head.kind}">${KIND_LABEL[head.kind]}</span>${escHtml(head.title)}${head.warnings.length ? `<span class="warn-dot" title="${head.warnings.length} thing${head.warnings.length > 1 ? 's' : ''} worth checking">!</span>` : ''}</div>` : '';
      return `${label}<div class="rl${s ? ' in-sec' : ''}${s && s.id % 2 ? ' alt' : ''}" data-line="${ln}" data-sec="${s ? s.id : ''}"><span class="ln">${ln}</span><span class="pc">${hlCode(fileLang, l) || ' '}</span></div>`;
    }).join('');
    $('rdOutline').innerHTML = secs.map(s => `<button type="button" class="ol-item" data-sec="${s.id}"><span class="chip k-${s.kind}">${KIND_LABEL[s.kind]}</span><span class="ol-t">${escHtml(s.title)}</span>${s.warnings.length ? '<span class="warn-dot">!</span>' : ''}<span class="ol-l">${s.start}–${s.end}</span></button>`).join('');
    renderFocus();
  }

  /* Project overview: what it is, where to start, how files connect, what to check. */
  function renderProject() {
    $('rdName').textContent = proj ? proj.name : 'Project';
    const langs = proj ? [...new Set(proj.files.map(f => LANG_NAME[langOfPath(f.path)]))] : [];
    $('rdOverview').textContent = proj ? `${proj.files.length} files · ${langs.join(', ')}` : 'Reading…';
    if (!proj) { $('rdProject').innerHTML = '<p class="sum-empty">Reading the project…</p>'; return; }
    const allWarn = proj.warnings.map(w => ({ w })).concat(proj.files.flatMap(f => (f.analysis.sections || []).flatMap(s => s.warnings.map(w => ({ w, f, s })))));
    const outside = proj.libs.filter(l => !l.stdlib);
    const inside = proj.libs.filter(l => l.stdlib);
    $('rdProject').innerHTML = `<div class="pj">
      <section class="pj-top">
        <p class="pj-lead">${rich(proj.overview)}</p>
        ${proj.readme ? `<blockquote class="pj-readme"><span class="ex-lbl">From the README</span>${escHtml(proj.readme)}</blockquote>` : ''}
        <h4>How the files connect</h4>
        <div class="pj-map" id="pjMap">${projectMap()}</div>
        <p class="pj-legend">Each arrow points from a file to a file it uses, so files further right are building blocks for the ones on their left. Hover a file to see its connections; click it to read it.</p>
      </section>
      <div class="pj-cols">
      <section>
        <h4>Reading order</h4>
        <ol class="pj-order">${proj.order.filter(p => fileInfo(p).role !== 'package').map(p => { const f = fileInfo(p); return `<li><button type="button" class="linklike" data-file="${escHtml(p)}"><code>${escHtml(shortPath(p))}</code></button> <span class="role r-${f.role}">${escHtml(f.role_label)}</span><div class="pj-sum">${rich(f.summary)}</div></li>`; }).join('')}</ol>
      </section>
      <section>
        ${allWarn.length ? `<div class="sum-warn"><h4>Worth checking (${allWarn.length})</h4><ul>${allWarn.map(x => `<li>${x.f ? `<button type="button" class="linklike" data-file="${escHtml(x.f.path)}" data-sec="${x.s.id}"><code>${escHtml(shortPath(x.f.path))}</code></button> ${escHtml(x.s.title)}: ` : ''}${rich(x.w)}</li>`).join('')}</ul></div>` : ''}
      </section>
      <section>
        <h4>Libraries</h4>
        <ul class="sum-facts">${outside.map(l => `<li><code>${escHtml(l.name)}</code>${l.what ? ' ' + escHtml(l.what) : ''} <span class="dim">· ${l.files.length} file${l.files.length > 1 ? 's' : ''}</span></li>`).join('') || '<li>No outside libraries.</li>'}
        ${inside.length ? `<li class="dim">Built into Python: ${inside.map(l => escHtml(l.name)).join(', ')}</li>` : ''}</ul>
      </section>
      </div>
    </div>`;
  }

  function projectMap() {
    const nodes = proj.files.filter(f => f.role !== 'package').map(f => f.path);
    if (nodes.length > 60) return '<p class="sum-empty">This project has too many files to draw. Use the reading order instead.</p>';
    const set = new Set(nodes);
    const edges = proj.edges.filter(([a, b]) => set.has(a) && set.has(b) && a !== b);
    const depth = Object.fromEntries(nodes.map(n => [n, 0]));
    for (let k = 0; k < nodes.length; k++) {
      let changed = false;
      for (const [a, b] of edges) if (depth[b] < depth[a] + 1 && depth[a] + 1 < nodes.length) { depth[b] = depth[a] + 1; changed = true; }
      if (!changed) break;
    }
    const cols = [];
    nodes.forEach(n => { (cols[depth[n]] = cols[depth[n]] || []).push(n); });
    cols.forEach(c => c.sort((a, b) => ROLE_ORDER.indexOf(fileInfo(a).role) - ROLE_ORDER.indexOf(fileInfo(b).role) || a.localeCompare(b)));
    const W = 176, H = 44, CW = 232, RH = 64, PAD = 16;
    const pos = {};
    cols.forEach((c, ci) => c.forEach((n, ri) => { pos[n] = { x: PAD + ci * CW, y: PAD + ri * RH }; }));
    const width = PAD * 2 + (cols.length - 1) * CW + W;
    const height = PAD * 2 + (Math.max(...cols.map(c => c.length)) - 1) * RH + H;
    const lines = edges.map(([a, b]) => {
      const p = pos[a], q = pos[b];
      let d;
      if (q.x > p.x) {
        const x1 = p.x + W, y1 = p.y + H / 2, x2 = q.x - 4, y2 = q.y + H / 2, mx = (x1 + x2) / 2;
        d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
      } else {
        const x1 = p.x + W / 2, y1 = p.y + H, x2 = q.x + W / 2, y2 = q.y + H + 4;
        d = `M${x1},${y1} C${x1},${y1 + 40} ${x2},${y2 + 40} ${x2},${y2}`;
      }
      return `<path class="pj-edge" data-a="${escHtml(a)}" data-b="${escHtml(b)}" d="${d}" marker-end="url(#pjArrow)"/>`;
    }).join('');
    const boxes = nodes.map(n => {
      const f = fileInfo(n), p = pos[n], sp = shortPath(n);
      const base = sp.split('/').pop(), dir = sp.includes('/') ? sp.slice(0, sp.lastIndexOf('/') + 1) : '';
      return `<g class="pj-node r-${f.role}" data-file="${escHtml(n)}" tabindex="0" role="button" aria-label="${escHtml(sp)}, ${escHtml(f.role_label)}">
        <rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="7"/>
        <text x="${p.x + 10}" y="${p.y + 18}" class="pj-name">${escHtml(dir)}<tspan class="pj-base">${escHtml(base.length > 22 ? base.slice(0, 21) + '…' : base)}</tspan></text>
        <text x="${p.x + 10}" y="${p.y + 34}" class="pj-role">${escHtml(f.role_label)}${f.analysis.sections && f.analysis.sections.some(s => s.warnings.length) ? ' · worth checking' : ''}</text>
      </g>`;
    }).join('');
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Map of how the files connect">
      <defs><marker id="pjArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="pj-arrowhead"/></marker></defs>
      ${lines}${boxes}</svg>`;
  }

  function openFile(path, name, secId) {
    const i = pyFiles().findIndex(f => f.name === path);
    if (i < 0) return;
    reads.active = i; readFocus = null; saveReads();
    renderRead();
    const a = curAnalysis();
    const sec = a && a.sections && (secId != null ? a.sections.find(s => s.id === +secId) : name ? a.sections.find(s => s.name === name) : null);
    if (sec) focusSection(sec.id, true);
  }

  $('rdProject').addEventListener('click', (e) => {
    const link = e.target.closest('[data-file]');
    if (link) openFile(link.dataset.file, link.dataset.name, link.dataset.sec);
  });
  $('rdProject').addEventListener('keydown', (e) => {
    const n = e.target.closest('.pj-node');
    if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openFile(n.dataset.file); }
  });
  $('rdProject').addEventListener('mouseover', (e) => {
    const n = e.target.closest('.pj-node');
    $('rdProject').querySelectorAll('.pj-edge.hot').forEach(x => x.classList.remove('hot'));
    $('rdProject').querySelectorAll('.pj-node.dim').forEach(x => x.classList.remove('dim'));
    if (!n) return;
    const f = n.dataset.file;
    const linked = new Set([f]);
    $('rdProject').querySelectorAll('.pj-edge').forEach(x => { if (x.dataset.a === f || x.dataset.b === f) { x.classList.add('hot'); linked.add(x.dataset.a); linked.add(x.dataset.b); } });
    $('rdProject').querySelectorAll('.pj-node').forEach(x => x.classList.toggle('dim', !linked.has(x.dataset.file)));
  });

  function markLines(start, end, cls) {
    $('rdCode').querySelectorAll('.rl.' + cls).forEach(el => el.classList.remove(cls));
    if (start == null) return null;
    let first = null;
    $('rdCode').querySelectorAll('.rl').forEach(el => {
      const ln = +el.dataset.line;
      if (ln >= start && ln <= end) { el.classList.add(cls); first = first || el; }
    });
    return first;
  }

  function summaryHtml(s, label) {
    const steps = s.steps && s.steps.length ? `<h4>Step by step, as sentences</h4><pre class="sum-steps">${s.steps.map(l => hlLine(l)).join('\n')}${s.more ? '\n<span class="s-com">…and more</span>' : ''}</pre>` : '';
    return `<div class="sum-kind">${escHtml(label)}</div>
      <h3>${escHtml(s.title)}</h3>
      <p class="sum-head">${rich(s.headline)}</p>
      ${s.facts.length ? `<ul class="sum-facts">${s.facts.map(f => `<li>${rich(f)}</li>`).join('')}</ul>` : ''}
      ${s.warnings.length ? `<div class="sum-warn"><h4>Worth checking</h4><ul>${s.warnings.map(w => `<li>${rich(w)}</li>`).join('')}</ul></div>` : ''}
      ${steps}`;
  }

  function renderFocus() {
    const a = curAnalysis();
    const box = $('rdSum');
    $('rdOutline').querySelectorAll('.ol-item').forEach(b => b.classList.toggle('on', !!readFocus && readFocus.type === 'section' && +b.dataset.sec === readFocus.id));
    if (!a || !a.ok) { markLines(null, null, 'focus'); box.innerHTML = a ? `<p class="sum-empty">${escHtml(a.error || '')}</p>` : ''; return; }
    if (readFocus && readFocus.type === 'tour') return renderTour(box);
    if (readFocus && readFocus.type === 'section') {
      const s = a.sections.find(x => x.id === readFocus.id);
      if (s) { markLines(s.start, s.end, 'focus'); box.innerHTML = summaryHtml(s, `${KIND_LABEL[s.kind]} · lines ${s.start}–${s.end}`); return; }
    }
    if (readFocus && readFocus.type === 'range') {
      const s = readFocus.summary;
      if (!s.ok) { markLines(null, null, 'focus'); box.innerHTML = `<div class="sum-kind">Your selection</div><p class="sum-head">${escHtml(s.error)}</p>`; return; }
      markLines(s.start, s.end, 'focus');
      box.innerHTML = summaryHtml(s, `Your selection · lines ${s.start}–${s.end}`);
      return;
    }
    markLines(null, null, 'focus');
    const warns = a.sections.flatMap(s => s.warnings.map(w => ({ s, w })));
    box.innerHTML = `<div class="sum-kind">Whole file</div><h3>${escHtml(shortPath(curFile().name))}</h3><p class="sum-head">${rich(a.overview)}</p>
      <p class="sum-tip">Click a section to see what it does, or highlight any lines and press <b>Summarise selection</b>.</p>
      <h4>Sections</h4><ul class="sum-facts">${a.sections.map(s => `<li><button type="button" class="linklike" data-sec="${s.id}">${escHtml(s.title)}</button>: ${rich(s.headline)}</li>`).join('')}</ul>
      ${warns.length ? `<div class="sum-warn"><h4>Worth checking in this file (${warns.length})</h4><ul>${warns.map(x => `<li><button type="button" class="linklike" data-sec="${x.s.id}">${escHtml(x.s.title)}</button>: ${rich(x.w)}</li>`).join('')}</ul></div>` : ''}`;
  }

  function focusSection(id, scroll) {
    readFocus = { type: 'section', id };
    renderFocus();
    if (scroll) {
      const el = $('rdCode').querySelector(`.rl-sec[data-sec="${id}"]`) || $('rdCode').querySelector(`.rl[data-sec="${id}"]`);
      if (el) $('rdCode').scrollTop = el.offsetTop - 8;
    }
  }

  function selectedLines() {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const code = $('rdCode');
    const lineOf = (node) => { const el = (node.nodeType === 1 ? node : node.parentElement); const rl = el && el.closest('.rl'); return rl && code.contains(rl) ? +rl.dataset.line : null; };
    let a = lineOf(sel.anchorNode), b = lineOf(sel.focusNode);
    if (a == null || b == null) return null;
    if (a > b) [a, b] = [b, a];
    return { start: a, end: b };
  }

  function updateSummariseButton() {
    const r = selectedLines();
    $('btnSummarise').textContent = r ? `Summarise lines ${r.start}–${r.end}` : 'Summarise selection';
  }

  $('btnSummarise').addEventListener('click', async () => {
    const r = selectedLines();
    if (!r) {
      $('rdSum').innerHTML = '<div class="sum-kind">Summarise</div><p class="sum-head">Highlight some lines in the code first (drag across them), then press Summarise.</p>';
      return;
    }
    const f = curFile();
    if (langOfPath(f.name) === 'python') {
      const R = await Runner.reader();
      readFocus = { type: 'range', summary: R.summarise(f.source, r.start, r.end, f.name) };
    } else {
      // web files: read the highlighted lines on their own
      const WR = await Runner.webReader();
      const text = f.source.split('\n').slice(r.start - 1, r.end).join('\n');
      const k = WR.kindOfPath(f.name);
      const a = k === 'html' ? WR.analyzeHtml(f.name, text, { fileOf: () => null, scriptsFor: () => [], stylesFor: () => [] })
        : k === 'css' ? WR.analyzeCss(f.name, text, { htmlMatches: () => [], hasHtml: false, scriptMentions: () => false })
        : WR.analyzeJs(f.name, text, k, { path: f.name, xnames: {}, uses: [], fetches: [], htmlTargets: () => null, routeFor: () => null, hasServer: false, fileOf: () => null });
      const secs = a.sections || [];
      readFocus = { type: 'range', summary: secs.length ? { ok: true, title: `Lines ${r.start}–${r.end}`, headline: secs.map(x => x.headline).join(' '), facts: [...new Set(secs.flatMap(x => x.facts))], warnings: [...new Set(secs.flatMap(x => x.warnings))], steps: secs.flatMap(x => x.steps).slice(0, 16), more: false, start: r.start, end: r.end } : { ok: false, error: 'Nothing complete was found in the highlighted lines.' } };
    }
    renderFocus();
  });

  $('rdCode').addEventListener('click', (e) => {
    if (!getSelection().isCollapsed) return;
    const head = e.target.closest('.rl-sec');
    const rl = e.target.closest('.rl');
    const id = head ? +head.dataset.sec : rl && rl.dataset.sec !== '' ? +rl.dataset.sec : null;
    if (id != null) focusSection(id, false);
  });
  $('rdOutline').addEventListener('click', (e) => { const b = e.target.closest('.ol-item'); if (b) focusSection(+b.dataset.sec, true); });
  const onReadLink = (e) => {
    const f = e.target.closest('[data-file]');
    if (f) { openFile(f.dataset.file, f.dataset.name, f.dataset.sec); return true; }
    const b = e.target.closest('.linklike[data-sec]');
    if (b) { focusSection(+b.dataset.sec, true); return true; }
    return false;
  };
  $('rdSum').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tour]');
    if (t) return tourStep(t.dataset.tour, t.dataset.file);
    if (onReadLink(e)) return;
    if (e.target.id === 'rdImport') openImport();
    if (e.target.id === 'rdExample') loadExampleProject();
  });

  /* Style tour: the habits a Python or C++ file shows, in reading order, each with why it's said that way. */
  const BLOCK_CARDS = new Set(['class', 'def', 'init', 'indentation', 'if', 'for-in', 'range', 'enumerate', 'while', 'with-open', 'try', 'main-guard', 'decorator', 'async', 'default-args', 'star-args', 'type-hints', 'snake-case', 'private',
    'cpp:class', 'cpp:function', 'cpp:void', 'cpp:constructor', 'cpp:main', 'cpp:setup-loop', 'cpp:if', 'cpp:for-count', 'cpp:range-for', 'cpp:while', 'cpp:template', 'cpp:braces', 'cpp:lambda']);
  async function startTour() {
    const file = curFile(), lang = file && langOfPath(file.name);
    if (!TOUR_LANGS.has(lang)) return;
    let res;
    if (lang === 'cpp') {
      const WR = await Runner.webReader((s) => setStatus(s));
      await WR.loadLangs(['cpp']);
      res = TUTOR.cppStylePoints(WR.parse, file.source, false);
      res.ok = true;   // (a part it couldn't read just has no stops)
    } else res = (await Runner.reader((s) => setStatus(s))).stylePoints(file.source, false);
    if (!res.ok) { $('rdSum').innerHTML = `<p class="sum-empty">${escHtml(res.error)}</p>`; return; }
    readFocus = { type: 'tour', file: file.name, lang, points: res.points.map(p => ({ ...p, card: cardId(lang, p.card) })).filter(p => cardOf(p.card)), i: 0 };
    renderFocus();
  }
  function renderTour(box) {
    const t = readFocus, p = t.points[t.i];
    if (!p) { markLines(null, null, 'focus'); box.innerHTML = '<p class="sum-empty">This file doesn\'t show any of the habits the tour knows yet.</p>'; return; }
    const c = cardOf(p.card), last = t.i === t.points.length - 1;
    const first = markLines(p.line, BLOCK_CARDS.has(p.card) ? p.line : p.end, 'focus');
    if (first) $('rdCode').scrollTop = first.offsetTop - $('rdCode').clientHeight / 3;
    const order = proj ? proj.order.filter(x => langOfPath(x) === t.lang) : [];
    const nextFile = last ? order[order.indexOf(t.file) + 1] : null;
    box.innerHTML = `<div class="sum-kind">Style tour · ${t.i + 1} of ${t.points.length}</div>
      <h3>${withCode(c.title)}</h3>
      <p class="sum-head">${withCode(c.say)}</p>
      <p class="tour-more">${withCode(c.more)}</p>
      <p class="dim">Line ${p.line}${p.name ? ` · <code>${escHtml(p.name)}</code>` : ''}</p>
      <div class="bp-actions">
        <button type="button" class="btn small" data-tour="prev"${t.i ? '' : ' disabled'}>← Previous</button>
        ${last ? '' : '<button type="button" class="btn small primary" data-tour="next">Next →</button>'}
        ${nextFile ? `<button type="button" class="btn small primary" data-tour="file" data-file="${escHtml(nextFile)}">Next file: ${escHtml(shortPath(nextFile))} →</button>` : ''}
      </div>
      ${last ? `<p class="sum-tip">That's the tour of this file.${nextFile ? ' The reading order continues with the next file.' : ''} Press <b>Open as sentences</b> to take the wheel.</p>` : ''}`;
  }
  function tourStep(dir, path) {
    if (dir === 'file') { openFile(path); startTour(); return; }
    readFocus.i = Math.max(0, Math.min(readFocus.points.length - 1, readFocus.i + (dir === 'next' ? 1 : -1)));
    renderFocus();
  }
  $('btnTour').addEventListener('click', startTour);
  $('rdOverview').addEventListener('click', onReadLink);
  $('rdFiles').addEventListener('click', (e) => {
    const b = e.target.closest('.tree-item');
    if (!b) return;
    reads.active = +b.dataset.i; readFocus = null; saveReads(); renderRead();
  });

  $('btnToSentences').addEventListener('click', async () => {
    const file = curFile();
    if (langOfPath(file.name) !== 'python') return codeAsSentences(file, pyFiles());
    const out = checkedSentences(await Runner.reader(), file.source);
    if (!out.ok) { tLine('This file can\'t be turned into sentences: ' + out.error, 't-err'); return; }
    const next = { version: 1, lang: 'python', name: slug(file.name.split('/').pop()), sections: [{ id: 'main', file: 'main', text: out.text }], active: 'main' };
    replaceProject(next, `Opened ${shortPath(file.name)} as sentences. Anything that can't be said in words stays as exact code.`);
    const { check, kept } = out;
    if (check.same) tLine('✓ Checked: these sentences make exactly the same program as the original file.' + (kept ? ` (${kept} part${kept > 1 ? 's were' : ' was'} kept as python: lines to stay exact.)` : ''), 't-ok');
    else tLine(`Note: the sentences differ from the original ${check.error ? '(' + check.error + ')' : 'at lines ' + check.differs.map(d => d[0] === d[1] ? d[0] : d[0] + '–' + d[1]).join(', ')}. Check those parts before relying on them.`, 't-err');
  });

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
  async function codeAsSentences(file, files) {
    let out;
    try { out = await codeToProject(file, files); }
    catch (e) { tLine('Could not turn this code into sentences: ' + e.message, 't-err'); return; }
    if (!out) return;
    replaceProject(out.project, `Opened ${shortPath(file.name)} as sentences. Anything that can't be said in words stays as exact code.`);
    reportConversion(out.results);
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
    const sections = LAYOUTS[k.layout].map(f => ({ id: f, file: f, text: NEW_START[f] ? NEW_START[f](name) : '' }));
    const next = { version: 1, lang: 'python', kind: KIND_OF_LAYOUT[k.layout] || 'python', name: slug(name), sections, active: k.layout === 'website' ? 'structure' : sections[sections.length - 1].id };
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
  const bld = { trail: [], kit: null, ticked: new Set(), edit: null, preview: new Set() };   // trail: the options chosen so far; edit: the library editor
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
  /* Straight to one entry in the library editor, in its form (yours if you've changed it, or a copy of the built-in one). */
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
    if (!q) { $('bldBody').innerHTML = `<p class="sum-empty">There's no question called "${escHtml(qid)}" in the library. Go back, or add it with "Change the kits and steps".</p>`; return; }
    const tag = (o) => (o.kit && lib.kits[o.kit] ? platTag(lib.kits[o.kit].platform) : '');
    $('bldBody').innerHTML = `<h3 class="bld-ask">${escHtml(q.ask)}</h3>
      <div class="new-kinds bld-options">${q.options.map((o, i) => `<button type="button" class="new-kind" data-opt="${i}"><b>${escHtml(o.label)}</b><span>${tag(o)}${escHtml(o.means.replace(/^(PC|Phone|Web|Board) · /, ''))}</span></button>`).join('')}</div>
      <p class="bld-alt">Or <button type="button" class="linklike" id="bldToLibrary">browse every kit and blueprint in the Library</button>.</p>`;
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
    if (!kit) { $('bldBody').innerHTML = '<p class="sum-empty">This part of the library isn\'t written yet. Go back and choose another path.</p>'; return; }
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
    component: 'component: my-step\nname: My step\ndepth: walk\nsummary: Its role in the whole project, in plain words.\nusual: What people usually make it with.\nlearn: What to learn first.\n== main\nshow "Hello from my step"',
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
  /* What the whole library says about an entry (a kit listing a step that isn't written yet, say), with this text in its place. */
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
    const order = f.kind === 'kit' ? ['title', 'layout', 'shelf', 'platform', 'asks', 'about'] : ['name', 'depth', 'summary', 'usual', 'learn'];
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
            <li><code>component: id</code> (a step), <code>name:</code>, <code>depth:</code> <code>walk</code>, <code>hallway</code> or <code>horizon</code>, <code>summary:</code> its role, <code>usual:</code> what it's usually made with, <code>learn:</code> what to learn first, then its sentences under a folder: <code>== settings</code>, <code>== tools</code>, <code>== main</code> (Python); <code>== structure</code>, <code>== styling</code>, <code>== mechanics</code> (website); <code>== settings</code>, <code>== start</code>, <code>== loop</code> (Arduino).</li>
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
      <div class="kf-add"><button type="button" class="btn small" id="kfAdd" aria-expanded="${!!ed.picking}">+ Add a step from the library</button><button type="button" class="btn small" id="kfNewStep">+ Write a new step</button></div>
      ${ed.picking ? pickerHtml(lib, f) : ''}
      ${checkHtml(check, 'The kit')}
      <div class="bp-actions"><button type="button" class="btn primary" id="kfSave">Save${ed.editing && ed.editing.src === 'built' ? ' as yours' : ''}</button><button type="button" class="btn" id="kfCancel">Cancel</button><button type="button" class="btn ghost" id="kfText">Edit as text</button></div>
    </div>`;
    if (ed.picking) { const s = $('kfPickSearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }
  /* Every step in the library, by kit, to add to this one (those whose sentences fit how it's made first). */
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
  $('btnPlan').addEventListener('click', openBuilder);
  $('newToBuilder').addEventListener('click', openBuilder);

  /* The project map: the plan's steps, in order. Each opens a window about its role in the whole. */
  function renderPlan() {
    const plan = project.plan;
    $('planWrap').hidden = !plan;
    if (!plan) return;
    $('planPath').textContent = plan.path.join(' › ');
    $('plan').innerHTML = plan.steps.map(s => `<li><button type="button" class="plan-step" data-plan="${s.n}"><span class="plan-n">${s.n}</span><span class="plan-name">${escHtml(s.name)}</span>${depthChip(s.depth)}</button></li>`).join('');
  }
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
    $('stepBody').innerHTML = `<p class="step-depth">${depthChip(step.depth)} ${withCode(BUILDER.DEPTHS[step.depth].means)}</p>
      <h4>Its role in the project</h4><p>${withCode(step.summary)}</p>
      ${step.usual ? `<h4>Usually made with</h4><p>${withCode(step.usual)}</p>` : ''}
      ${step.learn ? `<h4>Learn first</h4><p>${withCode(step.learn)}</p>` : ''}
      ${places.length ? `<div class="step-go">${places.map(p => `<button type="button" class="btn small primary" data-go-sec="${escHtml(p.sec.id)}" data-go-line="${p.line}">Go to its sentences in ${escHtml(SECTION_META[p.sec.file].title)}</button>`).join('')}</div>` : ''}
      <div class="bp-actions step-nav">
        <button type="button" class="btn small" data-step-to="${step.n - 1}"${step.n > 1 ? '' : ' disabled'}>← Step ${step.n - 1 || ''}</button>
        <button type="button" class="btn small" data-step-to="${step.n + 1}"${step.n < plan.steps.length ? '' : ' disabled'}>Step ${step.n < plan.steps.length ? step.n + 1 : ''} →</button>
      </div>`;
    $('stepModal').hidden = false;
  }
  function closeStep() { $('stepModal').hidden = true; }
  $('plan').addEventListener('click', (e) => { const b = e.target.closest('[data-plan]'); if (b) openStep(+b.dataset.plan); });
  $('stepClose').addEventListener('click', closeStep);
  $('stepModal').addEventListener('click', (e) => {
    if (e.target.id === 'stepModal') return closeStep();
    const to = e.target.closest('[data-step-to]');
    if (to) return openStep(+to.dataset.stepTo);
    const go = e.target.closest('[data-go-sec]');
    if (go) { closeStep(); setMode('write'); if (go.dataset.goSec !== project.active) openSection(go.dataset.goSec); goToLine(+go.dataset.goLine); }
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
    const { files, skipped } = await filesToProject(list);
    importProject(files, skipped ? `Skipped ${skipped} files that aren't Python or project notes (images, caches, virtual environments…).` : '');
  });
  $('impZip').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    $('impNote').textContent = 'Opening the .zip…';
    try {
      const R = await Runner.reader((s) => setStatus(s));
      importProject(R.readZip(new Uint8Array(await f.arrayBuffer())), '');
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
      const R = await Runner.reader((s) => setStatus(s));
      return importProject(R.readZip(new Uint8Array(await list[0].file.arrayBuffer())), '');
    }
    const { files, skipped } = await filesToProject(list);
    if (entries.some(en => en.isDirectory)) importProject(files, skipped ? `Skipped ${skipped} files that aren't Python or project notes.` : '');
    else { closeImport(); addFiles(files); }
  });

  $('impGo').addEventListener('click', () => {
    const text = $('impText').value;
    if (!text.trim()) { $('impNote').textContent = 'Paste some code first, or choose files or a folder.'; return; }
    let name = $('impName').value.trim() || 'pasted.py';
    if (!CODE_FILE.test(name) && !/\.pyw$/i.test(name)) name += '.py';   // (a name like blink.ino or app.js keeps its language)
    closeImport();
    $('impText').value = '';
    addFiles([{ name, source: text.replace(/\r\n?/g, '\n') }]);
  });

  /* A folder, zip or example replaces what was imported before; single files are added to it. */
  async function importProject(files, note) {
    closeImport();
    if (!files.some(f => CODE_FILE.test(f.name))) { tLine('No Python, JavaScript, HTML or CSS files were found there.', 't-err'); return; }
    reads = { files, active: -1 };
    await afterImport(note);
  }
  async function addFiles(files) {
    for (const f of files) {
      const at = reads.files.findIndex(x => x.name === f.name);
      if (at >= 0) reads.files[at] = f; else reads.files.push(f);
    }
    reads.active = pyFiles().findIndex(x => x.name === files[0].name);
    await afterImport('');
  }
  async function afterImport(note) {
    readFocus = null;
    saveReads();
    setMode('read');
    await analyse();
    if (pyFiles().length === 1) reads.active = 0;
    renderRead();
    const counts = {};
    for (const f of pyFiles()) { const l = LANG_NAME[langOfPath(f.name)] || 'code'; counts[l] = (counts[l] || 0) + 1; }
    const parts = Object.entries(counts).map(([l, c]) => `${c} ${l}`);
    const n = pyFiles().length;
    tLine(`Imported ${n} file${n === 1 ? '' : 's'}${parts.length ? ` (${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]})` : ''}.` + (note ? ' ' + note : ''), 't-sys');
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
  const usesImages = () => project.kind === 'website' || project.kind === 'python';
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
      if (!IMAGE_NAME.test(name)) { tLine(`${f.name} isn't a picture IntuCode can use: PNG, JPEG, GIF, WebP or SVG.`, 't-err'); continue; }
      if (f.size > IMAGE_MAX) { tLine(`${f.name} is ${kb(f.size)}; pictures can be up to 8 MB. (A copy exported "for the web" is usually far smaller, and loads faster.)`, 't-err'); continue; }
      const { entry, replaced } = await keepImage(name, new Uint8Array(await f.arrayBuffer()));
      added.push(entry);
      tLine(`${replaced ? 'Replaced' : 'Added'} images/${name}${entry.w ? ` (${entry.w} × ${entry.h} pixels)` : ''}.`, 't-sys');
    }
    if (!added.length) return;
    imagesChanged();
    const say = imageSentence(added[0].name);
    if (say) tLine(`In ${SECTION_META[activeSec().file].title} it's used like this: ${say}  (Use, beside it on the left, puts that in for you.)`, 't-sys');
    if (project.kind === 'python' && /\.(jpe?g|webp|svg)$/i.test(added[0].name)) tLine('tkinter shows PNG and GIF pictures. Save a copy as PNG to use this one in a window.', 't-sys');
  }
  function imagesChanged() { save(); autosave(); renderImages(); if (project.kind === 'website') runWebsite(false); }

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
    if (want.some(im => imageUrls.has(im.key)) && project.kind === 'website') runWebsite(false);
  }
  /* Pictures neither the project nor the previous one ("restore") uses are let go. */
  async function pruneImages() {
    const keep = new Set([...images(), ...((store.get(PREVIOUS_KEY, null) || {}).images || [])].map(im => im && im.key));
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
      if (!names.includes(im.name)) { tLine(`images/${im.name} isn't in the folder any more, so sentences that use it show nothing. Add it again with File → Add an image.`, 't-err'); continue; }
      try {
        const { entry } = await keepImage(im.name, fromB64(await invoke('read_bytes', { path: join(folder, 'images/' + im.name) })));
        imagesWritten.add(`${folder}|${entry.name}|${entry.key}`);
      } catch (e) { tLine(`Could not read images/${im.name}: ${e}`, 't-err'); }
    }
    const extra = names.filter(n => IMAGE_NAME.test(n) && !images().some(im => im.name === n));
    if (extra.length) tLine(`images/ also has ${extra.join(', ')}, not part of the project yet. File → Add an image adds ${extra.length > 1 ? 'them' : 'it'}.`, 't-sys');
    renderImages();
    if (project.kind === 'website') runWebsite(false);
  }

  /* ------------------------------------------------------------------ */
  /* Desktop app (Tauri): real folders, real Python, shell commands      */
  /* ------------------------------------------------------------------ */

  const TAURI = window.__TAURI__;
  const desk = { on: !!(TAURI && TAURI.core), linux: /Linux/.test(navigator.userAgent), folder: null, python: null, venv: null, git: null, proc: null, nextId: 1, saveTimer: null, dirty: false };
  const invoke = (cmd, args) => TAURI.core.invoke(cmd, args);
  const baseName = (p) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop();
  const join = (a, b) => a.replace(/[\\/]+$/, '') + '/' + b;

  /* The app's own folder dialog: the desktop layer only lets the window use folders picked here. */
  async function pickFolder(title) {
    try { return await invoke('pick_folder', { title }); }
    catch (e) { tLine('The folder picker could not open: ' + e, 't-err'); return null; }
  }
  function showFolder() {
    const el = $('folderName');
    el.hidden = !desk.on;
    el.textContent = desk.folder ? baseName(desk.folder) + '/' : 'not saved yet';
    el.title = desk.folder || 'This project is not saved to a folder yet. Press Save.';
    el.classList.toggle('unsaved', desk.dirty);
    document.title = desk.folder ? `IntuCode — ${baseName(desk.folder)}` : 'IntuCode';
  }

  /* Save: the code files are the real project; sentences live in .intuicode/ next to them. */
  async function saveProject(pick) {
    if (!desk.on) return;
    clearTimeout(desk.saveTimer);
    if (!desk.folder) {
      if (pick === 'quiet') return;   // autosave only writes to a folder that was chosen
      const f = await pickFolder('Choose a folder to save this project in');
      if (!f) return;
      // never write over another project's files
      const names = project.sections.map(s => (s.file === 'sketch' ? baseName(f) + '.ino' : fileName(s))).concat('.intuicode/project.json');
      const taken = [];
      for (const n of names) { try { await invoke('read_text', { path: join(f, n) }); taken.push(n); } catch (_) { /* not there: free */ } }
      if (taken.length) {
        tLine(`Nothing was saved: ${baseName(f)} already has ${taken.join(', ')}, and saving would write over ${taken.length > 1 ? 'them' : 'it'}. Choose an empty folder, or use File → Open folder to open that project.`, 't-err');
        return;
      }
      desk.folder = f;
    }
    activeSec().text = ta.value;
    compile();
    // everything to write is taken now: another project may be opened while the files are written
    const folder = desk.folder, names = project.sections.map(fileName);
    const files = project.sections.map((s, i) => [names[i], secResult(s.id).text]).concat([['.intuicode/project.json', JSON.stringify({ ...project, folder: undefined }, null, 2)]]);
    try {
      for (const [name, content] of files) await invoke('write_text', { path: join(folder, name), content });
      await writeImages(folder);
      if (desk.folder === folder) { desk.dirty = false; showFolder(); }
      if (pick !== 'quiet') tLine(`Saved to ${folder}: ${names.join(', ')}${images().length ? `, ${images().length} picture${images().length > 1 ? 's' : ''} in images/` : ''} (and your sentences, in .intuicode/).`, 't-sys');
    } catch (e) { tLine('Could not save: ' + e, 't-err'); }
  }
  function autosave() {
    if (!desk.on) return;
    desk.dirty = true;
    showFolder();
    if (!desk.folder) return;
    clearTimeout(desk.saveTimer);
    desk.saveTimer = setTimeout(() => saveProject('quiet'), 1500);
  }

  /* Open a folder in Write mode. Code on disk wins over saved sentences if they disagree. */
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
        // did anyone change the code outside IntuCode?
        compile();
        const changed = [];
        for (const s of project.sections) {
          const onDisk = await read(fileName(s));
          if (onDisk != null && onDisk.replace(/\r\n/g, '\n').trim() !== secResult(s.id).text.trim()) changed.push(s);
        }
        for (const s of changed) {
          if (secLang(s) !== 'python') {
            const res = await rebuildSection(folder, s, read);
            if (res && res.ok) { s.text = res.text; tLine(`${fileName(s)} was changed outside IntuCode, so its sentences were rebuilt from the code.${res.exact ? ' ✓ Checked exact.' : ' ' + res.reason}`, res.exact ? 't-sys' : 't-err'); }
            else tLine(`${fileName(s)} was changed outside IntuCode and couldn't be turned back into sentences${res && res.error ? ': ' + res.error : ''}. The sentences may be out of date; Read mode shows the file as it is.`, 't-err');
            continue;
          }
          const res = await sentencesFor(await read(fileName(s)));
          if (res) { s.text = res.text; tLine(`${fileName(s)} was changed outside IntuCode, so its sentences were rebuilt from the code.${res.exact ? ' ✓ Checked exact.' : ''}`, 't-sys'); }
        }
        if (changed.length) { ta.value = activeSec().text; refreshAll(); }
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
      tLine(`${baseName(folder)} isn't an IntuCode project, so it opens in Read mode.`, 't-sys');
      desk.readFolder = folder;
      return importProject(files, '');
    }
    desk.folder = folder;
    await saveProject('quiet');
    tLine(`${baseName(folder)} was empty, so the current project was saved into it.`, 't-sys');
  }

  async function openFolderRead() {
    const folder = await pickFolder('Open a folder to read');
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
        const R = await Runner.reader((s) => setStatus(s));
        importProject(R.readZip(fromB64(await invoke('read_bytes', { path: paths[0] }))), '');
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
    if (!files.length) { tLine(`Nothing to read there: IntuCode reads code files (Python, JavaScript, HTML, CSS, C++ and Arduino sketches), folders of them, and .zip files.`, 't-err'); return; }
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
    try { for (const s of project.sections) await invoke('write_text', { path: join(dir, fileName(s)), content: secResult(s.id).text }); await writeImages(dir); }
    catch (e) { tLine('Could not write the program files: ' + e, 't-err'); return; }
    try { desk.venv = await invoke('find_venv', { cwd: dir }); } catch (_) { desk.venv = null; }
    const id = desk.nextId++;
    desk.proc = { id, kind: 'python', err: '' };
    tLine(`▶ Running main.py with ${desk.venv ? `the project's own Python (${desk.venv})` : `Python ${desk.python[1]} (installed on this computer)`}${desk.folder ? '' : ', from a temporary folder: press Save to keep the project'}`, 't-sys');
    setRunning(true);
    termIn.focus({ preventScroll: true });
    try { await invoke('run_program', { id, program: desk.python[0], args: ['-u', 'main.py'], cwd: dir }); }
    catch (e) { tLine(String(e), 't-err'); desk.proc = null; setRunning(false); }
  }
  async function runDesktopCpp() {
    const dir = desk.folder || await invoke('scratch_folder');
    const win = /Win/i.test(navigator.userAgent);
    try { await invoke('write_text', { path: join(dir, 'main.cpp'), content: secResult('program').text }); }
    catch (e) { tLine('Could not write main.cpp: ' + e, 't-err'); return; }
    // the built program goes in .intuicode/build, not among your files
    const exe = '.intuicode/build/intuicode-program' + (win ? '.exe' : '');
    try { await invoke('write_text', { path: join(dir, '.intuicode/build/.gitignore'), content: '*\n' }); } catch (_) { /* compiling says why */ }
    const id = desk.nextId++;
    desk.proc = { id, kind: 'compile', err: '', out: '', dir, exe };
    const msvc = desk.cpp[0] === 'msvc';
    tLine(`▶ Compiling main.cpp with ${msvc ? desk.cpp[1] : desk.cpp[0]}…${msvc ? ' (Visual Studio takes a few seconds to start.)' : ''}`, 't-sys');
    setRunning(true, 'compiling…');
    try { await invoke('compile_cpp', { id, source: 'main.cpp', output: exe, cwd: dir }); }
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
    try { await invoke('write_text', { path: join(dir, name + '.ino'), content: secResult('sketch').text }); }
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
    desk.proc = { id, kind: 'ino-compile', err: '', out: '', dir, name, port, fqbn };
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
        compilerErrors(all, p.name + '.ino', 'sketch');
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
      const baud = (secResult('sketch').text.match(/Serial\.begin\((\d+)\)/) || [])[1];
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
    $('btnOpenFolder').addEventListener('click', () => (mode === 'read' ? openFolderRead() : openFolderWrite()));
    $('btnSave').addEventListener('click', () => saveProject());
    $('btnStop').addEventListener('click', () => { if (desk.proc) invoke('stop_program', { id: desk.proc.id }); });
    // the import dialog's folder button uses the native picker
    $('impFolder').closest('label').addEventListener('click', (e) => { e.preventDefault(); openFolderRead(); });
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
        compilerErrors(p.err + '\n' + (p.out || ''));
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && desk.on) { e.preventDefault(); saveProject(); }
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
      else if (!$('builderModal').hidden) closeBuilder();
      else if (!$('newModal').hidden) closeNewProject();
      else if (!$('fileList').hidden) setFileMenu(false);
      else if (!$('bpModal').hidden) closeBlueprints();
      else if (!$('impModal').hidden) closeImport();
      else if (!ac.hidden) closeAc();
      else if (!$('index').hidden) closeIndex();
    }
  });

  function start() {
    applyLayout();
    applyDropDown();
    ta.value = activeSec().text;
    renderSectionHeader();
    refreshAll();
    $('work').classList.toggle('web', project.kind === 'website');
    showBottom(project.kind === 'website' ? 'preview' : 'terminal');
    updateChip();
    if (project.kind === 'website') runWebsite(false);
    loadImages().then(pruneImages);
    tLine('IntuCode terminal. Press Run to run your program, or type help.', 't-sys');
    setupDesktop();
    $('btnTutor').setAttribute('aria-pressed', String(tutor.on));
    setTimeout(async () => {
      await ensurePython();
      if (tutor.on) loadTutorReader();
      if (reads.files.length) { await analyse(); if (mode === 'read') renderRead(); }
    }, 1200);
  }

  window.addEventListener('resize', () => { measure(); syncScroll(); placeTip(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); syncScroll(); });
  start();
})();
